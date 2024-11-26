+++
title = "Code organization"
date = 2024-11-26
+++

Here's a pattern I use to organize all my development work.

```shell
~/dev/{owner}/{repo}
```

This makes understanding _where_ a repository is much easier than having a flat
structure.

It becomes easy to switch context using a function
[like `z`](https://github.com/nobe4/dotfiles/blob/main/functions/z):

```bash
#!/usr/bin/env bash

cd "$(
	fd . "${HOME}/dev" \
		--type d \
		--color never \
		--max-depth 2 \
		| fzf --select-1 --query "${*}"
)" || exit
```

E.g.
```shell
$ z

  /Users/nobe4/dev/nobe4/cli/
  /Users/nobe4/dev/cli/go-gh/
  /Users/nobe4/dev/cli/cli/
▌ /Users/nobe4/dev/cli/
  4/117 ────────────────────
> cli
```

Using this pattern in mind, I wrote
[`projector.sh`](https://github.com/nobe4/projector.sh).

It speeds up the cloning, switching, and managing of local projects.
