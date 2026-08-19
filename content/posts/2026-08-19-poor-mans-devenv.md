+++
title = "Poor Man's devenv"
date = 2026-08-19
tags = ["nix", "tech"]
+++

[devenv](https://devenv.sh/) is great. Declarative dev shells, hooks, scripts,
tasks.

At work, using `nix` is fairly uncommon, so I don't want to litter everyone's
repo with `devenv` or `shell.nix` files.

Devenv can also be slow to init, and enter, especially on a fresh machine or after a
`devenv.lock` update. Sometimes I just want a shell with the right tools, fast.

I used to run `nix-shell -p <my tool>` but after doing it 10 times per day, I
wanted something better.

## [`use`]

`use` is a small bash script I wrote. It scans the current directory, matches
file extensions to Nix packages, deduplicates them, and drops you into a
`nix-shell`.

```bash
exec nix-shell -p "${packages[@]}"
```

That's the core. The rest is pattern matching.

## How it works

A rules table maps glob patterns to packages:

```bash
rules=(
    '*.go   | go gopls golangci-lint golangci-lint-langserver'
    '*.py   | python3 python3Packages.python-lsp-server'
    '*.ts   | nodejs typescript-language-server'
    # ...
)
```

For each rule, it checks if any matching file exists:

```bash
if rg --files -L -q -g "$pattern"; then
    read -r -a package_set <<< "${rule#*| }"
    packages+=("${package_set[@]}")
fi
```

Then it deduplicates and calls `nix-shell -p`. No config files. No lock files.
No setup. Just packages.

It's also possible to pass extra packages directly:

```bash
use jq ripgrep
```

[`use`]: https://github.com/nobe4/dotfiles/blob/a2c9080c04629b04010430bf22016fabd73a135f/bin/use
