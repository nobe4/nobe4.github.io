+++
title = "Speeding Up My Shell"
date = 2026-07-03T21:26:44+02:00
tags = ["tech"]
+++

I spend all my time in a terminal. So much so that I have a custom macOS
launcher ([`sling`]) written around my terminal emulator, instead of using
Alfred, Raycast, or others.

I always notice when something feels sticky. Even a couple milliseconds can
interrupt the flow.

Recently, new sessions felt slow to start, and opening a terminal repeatedly
felt _terrible_. This post walks through how I measured and fixed my setup.

By the end, opening a new terminal went from 570 ms to 50 ms.

## Part 0: the setup

1. A global shortcut (`shift` + `space`) triggers a [Hammerspoon] function.
1. Hammerspoon opens a new [Kitty] terminal.
1. Kitty starts `zsh -l -c sling`.
1. I select my program and run it.

## Part 1: shell startup

### Profiling

I measured the `zsh` startup time with two tools.

Per-function timing with [`zprof`]:

```zsh
zmodload zsh/zprof
# ...
# the rest of my .zshrc
# ...
zprof
```

`zprof` prints results sorted by time. However, it only times zsh functions,
not subprocess spawns like `eval "$(brew shellenv)"`. So I also measured
wall time (real elapsed time, start to finish):

```bash
$ for i in 1 2 3; do time zsh -lic exit; done
```

The `-l` flag starts a login shell, which sources `.zprofile` and `.zlogin`,
`-i` makes it interactive, which in turn sources `.zshrc`. This matches how a
terminal emulator launches a shell.

The first `zprof` run pointed at two functions:

```
1) _mise_hook   18.74 ms
2) compinit     11.55 ms
```

[Mise] requires adding `eval "$(mise activate zsh)"` to `.zshrc`. `_mise_hook`
runs on every prompt, not just at startup. It spawns the `mise` binary each time
to refresh the environment.

[`compinit`] sets up zsh completion.

Wall time was worse than `zprof` suggested, at around 110 ms, partly because
three lines each spawned a subprocess on startup that `zprof` could not see:

```zsh
eval "$(brew shellenv)"
eval "$(mise activate zsh)"
eval "$(direnv hook zsh)"
```

### Fix 1. Cache the hooks

`brew shellenv`, `mise activate`, and `direnv hook` all print the same shell
code every time unless the tool binary changes. Despite the prettiness of the
`eval` lines, running them on every shell start was wasteful.

I now cache the output to a file and re-source it, refreshing only when the
binary is newer than the cache.

```zsh
# .zprofile
brew_cache="${XDG_CACHE_HOME:-$HOME/.cache}/brew-shellenv.zsh"
if [[ ! -f $brew_cache || ${BREW_PREFIX}/bin/brew -nt $brew_cache ]]; then
  "${BREW_PREFIX}/bin/brew" shellenv > "$brew_cache"
fi
source "$brew_cache"

# .zshrc
direnv_cache="${XDG_CACHE_HOME:-$HOME/.cache}/direnv-hook.zsh"
if [[ ! -f $direnv_cache || $commands[direnv] -nt $direnv_cache ]]; then
  direnv hook zsh > "$direnv_cache"
fi
source "$direnv_cache"

mise_cache="${XDG_CACHE_HOME:-$HOME/.cache}/mise-shims.zsh"
if [[ ! -f $mise_cache || $commands[mise] -nt $mise_cache ]]; then
  mise activate zsh > "$mise_cache"
fi
source "$mise_cache"
```

[`$commands`] is a zsh builtin hash of all available command paths:

```zsh
$ echo $commands[ls]
/bin/ls
```

It's like `which` but saves a fork.

### Fix 2. Switching Mise to shims

Caching `mise activate` removed the startup spawn, but `_mise_hook` still ran on
every prompt for about 19 ms. In hook mode that cost is unavoidable: the hook re-evaluates the environment on
every `cd`.

The fix is [shims mode], which adds the mise shim directory to `PATH` with no
per-prompt hook:

```zsh
mise activate zsh --shims > "$mise_cache"
```

Shims do not auto-update when tools change, so a small wrapper reshims
after the commands that add or remove tools:

```zsh
mise() {
  command mise "$@"
  local ret=$?
  case $1 in install|i|use|u|uninstall|rm|remove) command mise reshim ;; esac
  return $ret
}
```

This also drops mise's environment variable loading. I use [`direnv`] for that
instead, whose overhead is minimal.

### Fix 3. Move the `compinit` rebuild off the critical path

[`compinit`] has two modes:

- a fast path that trusts the cached dump (`-C`)
- a slow path that rebuilds it (`-i`)

The rebuild is expensive: about 400 ms warm and up to 4.5 s cold, because it
scans a large [`fpath`] of 1000+ completion functions.

<details><summary> List loaded functions </summary>

```zsh
print -l ${^fpath}/*(N:t)
```

`${^fpath}` expands each directory in `fpath` individually. `*(N:t)` globs all
files, suppresses errors for empty dirs (`N`), and strips the path to keep only
the filename (`:t`). The result is one function name per line.

</details>

The old config ran the rebuild in the foreground whenever the dump was stale, so
roughly once a day a shell would block for seconds. The new config always loads
fast with `-C`, and forks the rebuild into the background when the dump is stale:

```zsh
autoload -Uz compinit
if [[ -f $HOME/.zcompdump ]]; then
  compinit -C
else
  compinit -i
fi
if [[ -n $HOME/.zcompdump(#qN.mh+168) ]]; then
  { compinit -i && zcompile "$HOME/.zcompdump" } &!
fi
```

`(#qN.mh+168)` is a zsh glob qualifier: `N` suppresses errors if nothing
matches, `.` requires a regular file, `mh+168` selects files **m**odified more than
168 **h**ours ago (one week). So the condition is true only when `.zcompdump` is
older than a week.

`&!` forks the block into the background and disowns it, so the shell does not
wait for it to finish.

Now every shell pays only about 6 ms for `compinit -C`, and the slow rebuild
happens silently at most once a week. [`zcompile`] compiles the dump so later
loads are faster still.

### Results

Warm startup, measured with

```zsh
for i in 1 2 3; do time zsh -lic exit; done
```

| Stage                           | Warm startup |
| ------------------------------- | ------------ |
| Before                          | ~110 ms      |
| + all hooks cached              | ~80 ms       |
| + compinit rebuild backgrounded | ~63 ms       |
| + mise shims                    | ~42 ms       |

## Part 2: terminal launch

My command launcher (Hammerspoon -> Kitty -> `sling`) felt slow as well, so I
profiled each layer separately.

_Note_: I'm ignoring Hammerspoon's profiling here, as it turns out it was
negligible.

### Profiling

The hotkey runs `kitty` with `/bin/zsh -l -c sling`, so there are three
layers:

- Kitty's startup
- the login shell
- `sling`

```bash
# Layer 1: the login shell
for i in 1 2 3; do time zsh -l -c exit; done

# Layer 2: sling up to the picker.
# FZF_DEFAULT_OPTS forces fzf to abort on start.
for i in 1 2 3; do time zsh -l -c 'FZF_DEFAULT_OPTS="--bind=start:abort" sling'; done

# Layer 3: cold Kitty start running a shell, then close.
# The overrides make Kitty actually quit so `time` returns on its own.
for i in 1 2 3; do time kitty -o macos_quit_when_last_window_closed=yes -o confirm_os_window_close=0 /bin/zsh -l -c exit; done
```

| Layer               | Time    |
| ------------------- | ------- |
| 1. `zsh -l -c`      | ~17 ms  |
| 2. `sling`          | ~65 ms  |
| 3. Kitty cold start | ~570 ms |

Kitty cold start is about 550 ms after subtracting the shell, which is roughly
90% of the whole launch. `zsh -l -c` and `sling` are noise by comparison.

To check whether my Kitty config was to blame, I compared against no config at
all and against dropping my custom Python tab bar:

| Variant                   | Time    |
| ------------------------- | ------- |
| full config               | ~570 ms |
| `--config NONE`           | ~550 ms |
| `-o tab_bar_style=hidden` | ~560 ms |

No meaningful difference. The cost is Kitty and macOS booting a fresh GPU app
process, not my config.

### Fix 4. Single-instance

Kitty's [`--single-instance`/`-1`] starts one process the first time, then later
launches connect to it over a socket, open a new window, and exit.

[`--instance-group`] scopes the sharing so `sling` windows pool together and
stay separate from normal terminal windows.

```bash
## Prime the instance (cold, once)
kitty -1 --instance-group sling /bin/zsh -l -c exit

## Warm launches reuse the running process
for i in 1 2 3; do time kitty -1 --instance-group sling /bin/zsh -l -c exit; done
```

| Approach                | Per launch |
| ----------------------- | ---------- |
| separate process (cold) | ~570 ms    |
| single-instance (warm)  | ~49 ms     |

About 10 times faster. The change to `hammerspoon` is just the two extra flags:

```lua
hs.task.new(kitty, nil, {
    "--single-instance", "--instance-group", "sling",
    "/bin/zsh", "-l", "-c", "sling"
}):start()
```

## Conclusion

You can see the [full diff].

[`sling`]: https://github.com/nobe4/dotfiles/blob/de893018a5f8ab64559ad0f1e93fa582ca74b1f9/bin/sling
[Hammerspoon]: https://www.hammerspoon.org/
[Kitty]: https://sw.kovidgoyal.net/kitty/
[Mise]: https://mise.jdx.dev/
[`compinit`]: https://zsh.sourceforge.io/Doc/Release/Completion-System.html#Completion-System
[`zprof`]: https://zsh.sourceforge.io/Doc/Release/Zsh-Modules.html#The-zsh_002fzprof-Module
[`$commands`]: https://zsh.sourceforge.io/Doc/Release/Zsh-Modules.html#index-commands
[shims mode]: https://mise.jdx.dev/dev-tools/shims.html#mise-activate-shims
[`direnv`]: https://direnv.net/
[`zcompile`]: https://zsh.sourceforge.io/Doc/Release/Shell-Builtin-Commands.html#index-zcompile
[`--single-instance`/`-1`]: https://sw.kovidgoyal.net/kitty/invocation/#cmdoption-kitty-single-instance
[`--instance-group`]: https://sw.kovidgoyal.net/kitty/invocation/#cmdoption-kitty-instance-group
[full diff]: https://github.com/nobe4/dotfiles/commit/4e9375d81442df12a82bc01450d46d6b92ca83e0
[`fpath`]: https://zsh.sourceforge.io/Doc/Release/Functions.html
