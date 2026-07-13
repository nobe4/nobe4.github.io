+++
title = "Slow git push from a worktree"
date = 2026-06-25
tags = ["tech", "git", "work"]
references = [ ]
+++

I started using worktrees as part of [my setup], and have been enjoying what it
has to offer.

However, a `git push` from a worktree burned ~30 seconds of local CPU before
sending a single byte. Which was not expected.

As per usual, the following debug led up to a bunch of fun learnings.

## Symptom

I immediately started running my command with some extra debug setup:

```bash
GIT_TRACE_PACKET=1 GIT_TRACE=2 GIT_SSH_COMMAND="ssh -v" git push
```

Appeared to hang ~30s right after:

```
debug1: Sending command: git-receive-pack 'ORG/REPO.git'
...
pkt-line.c:85  packet:  push< 0000
```

The `push< 0000` means "server finished advertising refs." The client read it
quickly, then spent ~30 seconds in local computation. No packets flow during
that time, so the trace shows nothing. The gap is the bottleneck, not the
packet.

<details>
<summary> Aside: what <code>push< 0000</code> means </summary>

Read `push < 0000` as:

- program `push`
- direction `<` (received from remote)
- payload `0000`

git's wire format is [pkt-line]. Each message is length-prefixed: 4 hex-ASCII
bytes that include themselves. E.g. a 2-byte payload `"a\n"` is `0006a\n` on the
wire. Reserved lengths carry no payload:

- `0000`: flush-pkt (section delimiter, "this block is done")
- `0001`: delim-pkt (protocol v2 separator)
- `0002`: response-end-pkt

In a push ([pack-protocol v0/v1]), the client talks to
[`git-receive-pack`] on the server:

1. Server sends **ref advertisement**: one pkt-line per ref it has, e.g.:
   ```
   <oid> refs/heads/main\0<capabilities>
   ```
2. Server sends `0000` flush-pkt (done advertising).
3. Client sends update commands (`<old-oid> <new-oid> <refname>`), a `0000`,
   then the packfile with the objects the server needs.

The [Transfer Protocols] chapter in Pro Git walks through this with examples.

</details>

This trace is unfortunately misleading: `GIT_TRACE_PACKET` only prints when
packets move. After reading the last advertisement packet, git does local work.
No packets means no output. The cursor sits on `push< 0000` for ~30 seconds.

A trace stuck on a `<` line usually means "waiting on server" _or_ "client is
busy locally." To know which, we will compare `real` vs `user` time and check
`GIT_TRACE2_EVENT` regions.

## Investigation

### 1. The time is local CPU

To confirm if the time is spent on packet sending, we can use [`--dry-run`],
which does "everything except actually send the updates."

```bash
$ time git push --dry-run origin HEAD
# real 24.7s   user 22.6s   sys 0.18s
```

So the time is spent _not sending updates_, but somewhere else.

### 2. Trace2 points at submodules

We can use [`GIT_TRACE2_EVENT`] to get json-formatted telemetry-ready events,
which gives us some useful timing information, especially:

- [`<category>`]: the broad category of events
- [`<t_rel>`]: the relative time spent on the current region[^region]

```bash
$ GIT_TRACE2_EVENT=trace.txt git push --dry-run origin HEAD
$ grep '^{' trace.txt | jq -r 'select(.category and .t_rel) | "\(.category) \(.t_rel)"'
transport_push 1.843025
transport_push 27.665349
transport_push 0.128060
push 30.068257
```

We can see clearly that the ~30 seconds region is `push_submodules`.

### 3. A sampling profile confirms the call stack

Using macOS's [sample], we can look at what the process is actually doing:

```bash
$ git push --dry-run origin HEAD & sleep 4
$ sample "$(pgrep -x git | head -1)" 10
```

Truncated result:

```
Call graph:
    8474 Thread_11463894   DispatchQueue_1: com.apple.main-thread  (serial)
      8474 start  (in dyld) + 6992  [0x18dfd7e00]
        8474 main  (in git) + 40  [0x102d626d4]
          8474 cmd_main  (in git) + 568  [0x102c9688c]
            8474 handle_builtin  (in git) + 340  [0x102c96e40]
              8474 run_builtin  (in git) + 456  [0x102c979c0]
                8474 cmd_push  (in git) + 3700  [0x102d1f058]
                  8474 transport_push  (in git) + 696  [0x102ec6bec]
                    8474 push_unpushed_submodules  (in git) + 96  [0x102eb2530]
                      8474 find_unpushed_submodules  (in git) + 184  [0x102eb20d0]
                        8376 collect_changed_submodules  (in git) + 252  [0x102eb241c]
                        + 8371 diff_tree_combined_merge  (in git) + 96  [0x102d8cb94]
                        + ! 8358 diff_tree_combined  (in git) + 1964  [0x102d8c8e4]
                        + ! : 8357 find_paths_multitree  (in git) + 148  [0x102d8ca1c]
                        + ! : | 8357 diff_tree_paths  (in git) + 52  [0x102ec89bc]
                        + ! : |   6594 ll_diff_tree_paths  (in git) + 1048  [0x102ec8de4]
                        + ! : |   + 6592 emit_path  (in git) + 1104  [0x102ec966c]
                        + ! : |   + ! 6018 ll_diff_tree_paths  (in git) + 1048  [0x102ec8de4]
                        ...
                        ... recurse over emit_path and ll_diff_tree_paths

Sort by top of stack, same collapsed (when >= 5):
        decode_tree_entry  (in git)        1398
        _platform_memmove  (in libsystem_platform.dylib)        1048
        _platform_memcmp  (in libsystem_platform.dylib)        859
        inflate  (in libz.1.dylib)        781
        _platform_strlen  (in libsystem_platform.dylib)        752
        _platform_memset  (in libsystem_platform.dylib)        439
        ll_diff_tree_paths  (in git)        386
        ...
```

We can see that `transport_push` finds the unpushed submodules, and then loops
recursively over diff tree paths.

The top stack reflects this with diff'ing the tree paths, inflating the
compressed tree information, and decoding the tree entries.

It seems that our push is slow because it's trying to push changes to
submodules. That's especially interesting because the repository has _no
submodule_.

## Root Cause

Why do we try pushing submodules?

In [`transport_push`]:

```c
if ((flags & (TRANSPORT_RECURSE_SUBMODULES_ON_DEMAND |
              TRANSPORT_RECURSE_SUBMODULES_ONLY)) &&
    !is_bare_repository()) {
    ...
    push_unpushed_submodules(r, &commits, transport->remote, ...);
}
```

Both conditions are true:

- Recursion was true because [`submodule.recurse = true`] was set globally.
- `!is_bare_repository()` is true in a worktree.

Then, [`find_unpushed_submodules`] builds:

```c
strvec_push(&argv, "find_unpushed_submodules");
oid_array_for_each_unique(commits, append_oid_to_argv, &argv);
strvec_push(&argv, "--not");
strvec_pushf(&argv, "--remotes=%s", remotes_name);
```

Effectively running:

```bash
git rev-list <tips-being-pushed> --not --remotes=origin
```

In other words:

> Every commit reachable from what I push, minus everything already on
> `refs/remotes/origin/*`.

Then `collect_changed_submodules` walks that list and runs tree-diff on every
commit looking for [gitlink] entries.

Okay, but how big is this list?

```bash
$ git rev-list --count HEAD --not --remotes=origin
371170
```

371k... That's the _entire_ commit history, surely this is incorrect?

However, if we count the refs in the repo:

```bash
git for-each-ref refs/heads   | wc -l   # 2597
git for-each-ref refs/remotes | wc -l   # 0
git config --get remote.origin.fetch    # (empty)
```

`refs/remotes/origin/*` is empty. Nothing subtracted from the `rev-list`, and it
becomes the entire history.

**In summary**: before pushing, git tries to find submodules for all 370k
commits on the repo. This is very slow!

## Why a normal clone is fast

During a [normal `git clone`]:

> This default configuration is achieved by creating references to the remote
> branch heads under `refs/remotes/origin` and by initializing
> `remote.origin.url` and `remote.origin.fetch` configuration variables.

Effectively setting:

```config
remote.origin.fetch = +refs/heads/*:refs/remotes/origin/*
```

So `refs/remotes/origin/*` is populated. The scan subtracts all of origin's
history and finds no new commits. The scan returns instantly.

## Why `--bare` skips remote-tracking refs

During a [`git clone --bare`]:

> the branch heads at the remote are copied directly to corresponding local
> branch heads, without mapping them to `refs/remotes/origin/`. When this option
> is used, neither remote-tracking branches nor the related configuration
> variables are created.

The difference:

```bash
$ git clone         # config +refs/heads/*:refs/remotes/origin/*  (tracking refs)
$ git clone --bare  # copies heads 1:1 to refs/heads/*            (no tracking)
```

The distinction: `refs/heads/*` are _local_ branches. `refs/remotes/origin/*`
are local copies of what the remote had last time you fetched. The two
namespaces exist so git can differentiate "local work" from "remote work" and
compute ahead/behind without a network round-trip.

We usually want `refs/remotes/origin/*` (for ahead/behind and cheap submodule
scans), but `--bare` deliberately does not create them.

## Fixes

- _Quick_: stop the useless scan for repos that don't need it:

  ```bash
  $ git config push.recurseSubmodules no
  ```

- _One-off_: push without scanning for submodules

  ```
  $ git push --no-recurse-submodules
  ```

- _Proper_: give the repo remote-tracking refs

  Git's config and `refs/remotes/*` live in the shared common dir, used by
  every worktree:

  ```bash
  $ git config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'
  $ git fetch origin
  ```

  It's also possible to set it during cloning:

  ```bash
  $ git clone --bare \
      --config 'remote.origin.fetch=+refs/heads/*:refs/remotes/origin/*' \
      ...
  $ git fetch origin
  ```

[`transport_push`]: https://github.com/git/git/blob/v2.54.0/transport.c#L1469-L1493
[`find_unpushed_submodules`]: https://github.com/git/git/blob/v2.54.0/submodule.c#L1081-L1096
[my setup]: https://github.com/nobe4/dotfiles/commit/b06d149ab17a21e972dc2a5bf55b4859842a7254
[pack-protocol v0/v1]: https://git-scm.com/docs/pack-protocol
[`git-receive-pack`]: https://git-scm.com/docs/git-receive-pack
[Transfer Protocols]: https://git-scm.com/book/en/v2/Git-Internals-Transfer-Protocols
[pkt-line]: https://git-scm.com/docs/protocol-common#_pkt_line_format
[`--dry-run`]: https://git-scm.com/docs/git-push#Documentation/git-push.txt---dry-run
[`GIT_TRACE2_EVENT`]: https://git-scm.com/docs/api-trace2#_the_event_format_target
[`<category>`]: https://git-scm.com/docs/api-trace2#Documentation/technical/api-trace2.txt-category
[`<t_rel>`]: https://git-scm.com/docs/api-trace2#Documentation/technical/api-trace2.txt-trel
[sample]: https://www.unix.com/man-page/osx/1/sample/
[`submodule.recurse = true`]: https://github.com/nobe4/dotfiles/blob/416e1644538f8112f0d12ee0a0d9cd11e015c871/.gitconfig#L60-L61
[gitlink]: https://git-scm.com/docs/gitsubmodules
[normal `git clone`]: https://git-scm.com/docs/git-clone#_description
[`git clone --bare`]: https://git-scm.com/docs/git-clone#Documentation/git-clone.txt---bare

[^region]:
    timed span, each region starts with a `region_enter` and ends with
    `region_leave`, at which point the `t_rel` is calculated.
