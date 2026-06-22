+++
title = "Custom Kitty Tab Titles"
date = 2026-06-19
tags = ["tech"]
references = [
    "https://ecma-international.org/wp-content/uploads/ECMA-48_5th_edition_june_1991.pdf",
    "https://jvns.ca/blog/2025/03/07/escape-code-standards/",
    "https://sw.kovidgoyal.net/kitty/keyboard-protocol/",
    "https://github.com/rothgar/mastering-zsh/blob/master/docs/config/hooks.md",
    "https://invisible-island.net/xterm/ctlseqs/ctlseqs.html",
    "https://github.com/nobe4/dotfiles/commit/c2afd17187570793fa8406b243bdbd621859f4e8",
]
+++

I changed my Kitty tab bar to show a better context:

- `owner/repo:branch process` for git repos;
- `~/d/n/dirname process` (shortened path) otherwise.

For simplicity, it updates only when something changes (cd, command start,
prompt).

## OSC Escape Sequences

[ANSI escape sequences] are sequences starting with `ESC` (`\e`),
ending with `BEL` (`\a`) that control terminal behavior. They include:

- **CSI** (Control Sequence Introducer, `ESC [`): controls the text grid; cursor
  movement, colors, scrolling, etc.

- **OSC** (Operating System Command, `ESC ]`): controls things outside the grid;
  window titles, terminal palette, clipboard, hyperlinks, notifications, etc.

### OSC Syntax

```
ESC ] Ps ; Pt BEL
```

- `ESC ]` start OSC sequence
- `Ps` parameter number
- `;` separator
- `Pt` payload text, and additional parameters
- `BEL` terminator

| Ps  | Effect                       |
| --- | ---------------------------- |
| 0   | Set icon name + window title |
| 1   | Set icon name only           |
| 2   | Set window title only        |
| 21  | Set color                    |
| 52  | Set clipboard content        |
| 99  | Send a notification          |

E.g.

```bash
printf '\e]0;hello\a'                       # set window title to "hello"
printf '\e]21;cursor=blue\a'                # set the cursor blue
printf "\e]52;c;$(echo "hello" | base64)\a" # set the clipboard content
printf '\e]99;;Hello world\a'               # send notification
```

See [ANSI list] for more.

## The Title Function

Here's the full code I came up with:

```zsh
# functions/set_tab_title
local cwd="$PWD"
local path=""

# try git info
local remote branch
remote=$(git remote get-url origin 2>/dev/null)
if [[ -n "$remote" ]]; then
  branch=$(git branch --show-current 2>/dev/null)
  remote="${remote%.git}"
  if [[ "$remote" == *@*:* ]]; then
    # git@github.com:owner/repo → owner/repo
    path="${remote##*:}:${branch}"
  else
    # https://github.com/owner/repo → owner/repo
    local owner_repo="${remote%/*}"
    owner_repo="${owner_repo##*/}/${remote##*/}"
    path="${owner_repo}:${branch}"
  fi
else
  # shorten: ~/dev/nobe4/dotfiles → ~/d/n/dotfiles
  local short="${cwd/#$HOME/~}"
  local parts=("${(@s:/:)short}")
  local last="${parts[-1]}"
  local result=""
  for ((i=1; i<${#parts[@]}; i++)); do
    result+="${parts[$i][1]}/"
  done
  path="${result}${last}"
fi

local proc="${1:-${ZSH_NAME:-zsh}}"

print -Pn "\e]0;${path} ${proc}\a"
```

The function uses several [zsh-specific substitution patterns]:

`#`/`##` trims the prefix, `%`/`%%` trims the suffix. Single `#`/`%` removes the
shortest match, double `##`/`%%` removes the longest match.

- `${remote%.git}`: remove shortest suffix.

  `"nobe4/dotfiles.git"` → `"nobe4/dotfiles"`.

- `${remote##*:}`: remove longest prefix up to `:`.

  `"github.com:nobe4/dotfiles"` → `"nobe4/dotfiles"`.

- `${remote%/*}`: remove shortest suffix from last `/`.

  `"github.com/nobe4/dotfiles"` → `"github.com/nobe4"`.

- `${owner_repo##*/}`: remove longest prefix up to last `/`.

  `"github.com/nobe4"` → `"nobe4"`.

- `${cwd/#$HOME/~}`: anchored substitution.

  `"/home/nobe4/dev/project"` → `"~/dev/project"`.

- `${(@s:/:)short}`: split on `/` into an array.

  `"~/dev/nobe4/dotfiles"` → `("~" "dev" "nobe4" "dotfiles")`.

- `${#parts[@]}`: array length.

  `("~" "dev" "nobe4" "dotfiles")` → `4`.

- `${parts[$i][1]}`: first character of the i-th element.

  `"dev"` → `"d"`.

- `$1` in `preexec`: zsh passes the command line as first argument.

  Running `nvim` → `proc=nvim`.

## Hooking It Up

Zsh has [hook function arrays] that fire at specific moments:

| Hook                | When it fires                |
| ------------------- | ---------------------------- |
| `precmd_functions`  | Before each prompt display   |
| `preexec_functions` | Before each command executes |
| `chpwd_functions`   | After directory change       |

E.g.

```zsh
function exec-smth {
	printf "\e]99;;executing $1\a"
}
preexec_functions+=(exec-smth)

function changed-dir {
	printf 'changed dir'
}
chpwd_functions+=(changed-dir)
```

Zsh can also autoload functions from files in [`$fpath`]. The file content is
the function body (no wrapper needed), so `set_tab_title` lives as a file:

```zsh
# in .zshrc
autoload -U functions/*(:t)

precmd_functions+=(set_tab_title)
chpwd_functions+=(set_tab_title)
preexec_functions+=(set_tab_title)
```

## [Kitty] Configuration

Kitty comes with [shell integration] and many settings, the interesting ones
here are:

```conf
# don't let kitty's shell integration override our title
shell_integration no-title

# use the OSC-set title in the tab bar template
tab_title_template "{title}"
```

`shell_integration` with `no-title` disables kitty's title management,
which would otherwise overwrite the OSC escape we set.

[`tab_title_template`] has `{title}` in the template which is the window's
OSC-set title. Compare with `{tab.active_exe}` which is just the process name.

## Final flow

1. User types `cd ~/project` or runs `nvim`
2. Zsh fires `chpwd`/`preexec` hook
3. `set_tab_title` computes "owner/repo:branch process"

   ```bash
   print -Pn "\e]0;nobe4/dotfiles:main nvim\a"
   ```

4. kitty receives OSC 0, stores as window title and sets the tab title.

[Kitty]: https://sw.kovidgoyal.net/kitty/
[zsh-specific substitution patterns]: https://zsh.sourceforge.io/Doc/Release/Expansion.html#Parameter-Expansion
[`$fpath`]: https://zsh.sourceforge.io/Doc/Release/Functions.html
[hook function arrays]: http://zsh.sourceforge.net/Doc/Release/Functions.html#Hook-Functions
[ANSI list]: https://gist.github.com/ConnerWill/d4b6c776b509add763e17f9f113fd25b
[ANSI escape sequences]: https://en.wikipedia.org/wiki/ANSI_escape_code
[shell integration]: https://sw.kovidgoyal.net/kitty/shell-integration/
[`tab_title_template`]: https://sw.kovidgoyal.net/kitty/conf/#opt-kitty.tab_title_template
