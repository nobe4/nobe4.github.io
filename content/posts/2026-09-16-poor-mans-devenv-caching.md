+++
title = "Poor Man's devenv: Now with Caching"
date = 2026-09-16
tags = ["nix", "tech"]
+++

In [Poor Man's devenv], I wrote a small bash script called [`use`]. It finds
project files, maps them to Nix packages, and opens a shell with:

```bash
exec nix-shell -p "${packages[@]}"
```

It worked, but every shell still paid the `nix-shell` setup cost. It was just
slow enough for me to change it.

The new version caches the built environment.

## One cache per package set

`use` sorts and deduplicates the package names, then hashes the result:

```bash
hash_input="$(printf '%s\n' "${shell_packages[@]}" | LC_ALL=C sort -u)"
package_key="$(printf '%s\n' "$hash_input" | md5sum)"
```

Order does not matter. `use go jq` and `use jq go` share the same cache.

The hash is only used as a file name. It is not used for security, so MD5 is
enough.

## Build once, reuse later

[`nix print-dev-env`] evaluates the [`mkShell`] expression and prints a bash
script that recreates its build environment. Unlike [`nix develop`], it does not
start a shell. This makes its output easy to save and source later:

```bash
nix print-dev-env \
    --impure \
    --expr "with import <nixpkgs> {}; mkShell { packages = [ ${shell_packages[*]} ]; }" \
    --profile "$HOME/.local/state/use/${package_key}.profile" \
    > "$HOME/.local/state/use/${package_key}.bash"
```

- `<hash>.bash` is the generated shell script. Sourcing it restores the build
  environment, including its variables and shell functions, without calling Nix
  again.

- `<hash>.profile` is the Nix profile created by `--profile`. It keeps the
  store paths used by that environment alive and available to `<hash>.bash`.

Later runs source the saved environment and start the user's shell:

```bash
. "$HOME/.local/state/use/${package_key}.bash"
exec "$SHELL" -i
```

## Conclusion

This keeps `use` small and efficient:

- Detect packages.
- Build each package set once.
- Enter it fast.

See the [full diff].

[Poor Man's devenv]: /posts/poor-mans-devenv/
[`use`]: https://github.com/nobe4/dotfiles/blob/65c82292011801921eb61e01adfb5d0d574e6af5/bin/use
[`nix print-dev-env`]: https://nix.dev/manual/nix/latest/command-ref/new-cli/nix3-print-dev-env
[`mkShell`]: https://nixos.org/manual/nixpkgs/stable/#sec-pkgs-mkShell
[`nix develop`]: https://nix.dev/manual/nix/latest/command-ref/new-cli/nix3-develop
[full diff]: https://github.com/nobe4/dotfiles/commit/65c82292011801921eb61e01adfb5d0d574e6af5
