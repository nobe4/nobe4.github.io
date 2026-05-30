+++
title = "Shallow clone lies"
date = 2026-05-30
tags = ["tech", "work"]
references = [
    "https://git-scm.com/docs/git-clone#Documentation/git-clone.txt---revisionrev",
    "https://git-scm.com/docs/git-clone#Documentation/git-clone.txt---depthltdepthgt",
    "https://git-scm.com/docs/shallow",
    "https://git-scm.com/docs/partial-clone",
    "https://github.com/actions/checkout#fetch-all-history-for-all-tags-and-branches",
    "https://docs.github.com/en/rest/commits/commits#list-commits",
]
+++

A GitHub CI script at work checks who last edited a config file. If the author
isn't the expected one, the build fails. Good guardrail, until it started lying.

The script reported the wrong author: someone who never touched the file. The
check failed, even though the right person had made the last edit.

## The setup

The CI workflow uses `actions/checkout` with the default settings, then checks
who last edited a config file:

```yaml
- uses: actions/checkout
- run: |
    author=$(git log --format=%an -n1 --no-merges -- path/to/config)
    if [ "$author" != "nobe4" ]; then
      echo "Unauthorized editor: $author"
      exit 1
    fi
```

Only `nobe4` is allowed to edit that file. Simple.

## Why it broke

`actions/checkout` defaults to `fetch-depth: 1`. That's a shallow clone. No
history behind it.

```bash
$ git rev-list --all --count
1
$ cat .git/shallow
abc1234...   # the one SHA at the cut
```

The tip commit has no parent. When `git log -- <path>` checks if a commit
touched a file, it diffs against the parent. No parent means no diff base. Git
treats a parentless commit like a root commit: every file in the tree looks like
it was introduced by that commit.

`git log -n1 -- path/to/config` always returns the tip commit, regardless of
whether it actually modified the file.

The script got an author. The wrong one. Whoever made the latest push to the
branch became the "last editor" of every file.

## Example

Take [`cli/cli/commit/b49fc31`](https://github.com/cli/cli/commit/b49fc3124a7c385dcb5c556937a0a706ec0af48e)
by [`@williammartin`](https://github.com/williammartin). That commit touches
workflow and docs files. It does not touch `go.mod`.

```bash
$ git clone https://github.com/cli/cli.git --depth=1 --revision=b49fc3124a7c385dcb5c556937a0a706ec0af48e
$ git -C cli log --format='%an' -n1 -- go.mod
William Martin
```

Wrong: see with a full clone at the same commit:

```bash
$ git clone https://github.com/cli/cli.git --revision=b49fc3124a7c385dcb5c556937a0a706ec0af48e
$ git -C cli log --format='%an' -n1 -- go.mod
dependabot[bot]
```

The real last editor of `go.mod` is `dependabot[bot]`. But the shallow clone
only has one commit, so git blames everything on it.

## Not a Git bug

Shallow clones are documented as truncated history. Partial answers are part of
the deal.

With no parent to diff against, git has two choices: say "every file changed"
or say "nothing changed". Neither is correct, and Git picks the first one.

## Fix options

### Full clone

Set `fetch-depth: 0` in `actions/checkout`. No code change but slow on large
repos.

```yaml
- uses: actions/checkout
  with:
    fetch-depth: 0
```

### Deepen on demand

`git fetch --deepen=N`

Smaller than full clone. But if N is wrong, the data is still incorrect.

### Use the GitHub commits API

Call the API instead of `git log`. Works without a cloned repository and with
the default GITHUB_TOKEN provided in actions.

```bash
author=$(
    gh api \
      "repos/{owner}/{repo}/commits?path=path/to/config&sha={ref}&per_page=1" \
      --jq '.[0].commit.author.name'
)
```

Using the same `cli/cli` example from earlier:

```bash
$ gh api \
    "repos/cli/cli/commits?path=go.mod&sha=b49fc3124a7c385dcb5c556937a0a706ec0af48e&per_page=1" \
    --jq '.[0].commit.author.name'
dependabot[bot]
```

The API hits the server's full copy of the repo. It walks the real commit
graph and you always get the _actual_ last author.
