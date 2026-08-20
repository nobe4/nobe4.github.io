+++
title = "Bash over Node"
date = 2026-08-20
tags = ["work", "tech"]
+++

A GitHub Action at work goes from a Node.js action to a composite action running
a single bash script.

The scenario is ideal: the action only does an HTTP request, JSON parsing, and
some conditions.

<!-- more -->

## Before and after

|                   | Before (Node)               | After (Bash)            |
| ----------------- | --------------------------- | ----------------------- |
| Files             | ~15                         | 1                       |
| Size              | 137M                        | 36K                     |
| Runtime           | `node20`                    | `composite` + bash      |
| Dependencies      | 19 npm packages             | `curl`, `jq`, `openssl` |
| Build step        | ncc bundle + commit `dist/` | none                    |
| Lines of logic    | 2000                        | ~179                    |
| CI workflows      | lint, format, test, pkg     | `bash -n`               |
| Supply chain risk | medium (npm)                | near zero               |

_Before_ file tree:

```
.babelrc
.eslintignore
.eslintrc.json
.prettierignore
.prettierrc.json
.node-version
action.yml
package.json          (7 deps, 12 devDeps)
package-lock.json
node_modules/         (hundreds of packages)
dist/index.js         (bundled with ncc)
src/main.js
src/functions/service.js
```

_After_ file tree:

```
action.sh
action.yml
```

## Benefits

- **Fewer moving parts.**

  _Before:_ Babel transpiles, ncc bundles, eslint lints, prettier formats, jest
  tests, got makes HTTP calls, `@actions/core` reads inputs, crypto signs.

  _After:_ one script, three system tools: `curl` for HTTP, `jq` for JSON,
  `openssl` for HMAC signing.

- **No JS or npm to manage.**

  _Before:_ 19 packages, each can ship a breaking change, get a CVE, or add
  Dependabot noise.

  _After:_ tools pinned to the runner image.

  At this point, I would rather not have to touch Javascript anymore.

- **No build step, simpler CI.**

  _Before:_ every JS change needs `ncc build`, then commit `dist/`. Forget to
  build? The action runs stale code. CI needs lint + format-check + test +
  package-check + acceptance just to catch that.

  _After:_ edit the script, push. CI is shellcheck + acceptance.

- **Smaller attack surface.**

  _Before:_ `node_modules` exposes transitive dep injection vectors. JS crypto
  wrapper in between.

  _After:_ no `node_modules`. HMAC signing uses `openssl dgst` directly.

- **Simple to reason about.**

  Linear logic: fetch, check, set an output. No async, no class hierarchy, no
  module graph. If the runner has `curl`, `jq`, and `openssl`, there's nothing
  to install.

## Shortcomings

Bash does not fit when:

- You need rich SDK features: pagination, GraphQL clients, retries with backoff.
- The logic branches heavily or manages complex state.
- You need unit tests with mocks for many code paths.

## Conclusion

The best code is code you don't maintain. Bash gives this action fewer files,
fewer deps, fewer failure modes, and the same result.

If everything you need is already in the default Unix toolbox, use it.
