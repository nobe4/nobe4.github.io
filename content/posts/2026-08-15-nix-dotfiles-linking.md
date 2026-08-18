+++
title = 'Shipping dotfiles with Nix'
date = 2026-08-15
tags = ["tech", "nix"]
references = [ ]
+++

I manage a remote headless machine (brahms) with [colmena]. During deployment, I
quickly hit a problem: my dotfiles live in a git repo on my workstation. Brahms
has no copy of it, and I didn't want to add a `git clone` as part of my setup.

The solution turned out to be a one-line change in my Nix config.

## `ln.nix` primer

After [exploring several wrong approaches][wrong-ways], I ended up using the
`userActivationScripts` solution to create symlinks. [`ln.nix`][ln] exposes a
list option:

```nix
options.ln = lib.mkOption {
  type = with lib.types; listOf (listOf str);
  default = [ ];
};
```

Each entry is a `[ rel, dst ]` tuple. `rel` is relative to `config.dotfiles`.
`dst` is the symlink target. For each tuple it runs:

```bash
ln "$src" "$dst"
```

NixOS merges all list options across imports, so all tuples collect into one
final set of symlinks applied on `nixos-rebuild switch`.

## The `config.dotfiles` string

Everything depends on one option, defined in [`dotfiles.nix`][dotfiles]:

```nix
options.dotfiles = lib.mkOption {
  type = lib.types.str;
  default = "${config.home}/.config/dotfiles";
};
```

This allows different machines to use different dotfiles.

This worked well until I shipped my config to a machine that _did not_ have a
`~/.config/dotfiles` present.

## Enabling Nix paths

The Nix language has a native [path type][nix-path]. When a path literal
(e.g. `../../..`) is interpolated into a string, Nix copies it into the store.
That copy is what we need here to ship the dotfiles.

`options.dotfiles` was updated to:

```nix
options.dotfiles = lib.mkOption {
  type = lib.types.coercedTo lib.types.path (p: "${p}") lib.types.str;
  default = "${config.home}/.config/dotfiles";
};
```

The original type `lib.types.str` would reject a path literal like `../../..`.
`coercedTo` extends it: if the value is a path, apply `(p: "${p}")` first, then
accept the result as a string. The `"${p}"` interpolation is what triggers the
store copy:

> A path in an interpolated expression is first copied into the Nix store, and
> the resulting string is the store path of the newly created store object. -
> [reference][nix-path-interp]

- Passing a string keeps it as-is.
- Passing `../../..` copies the tree into the store and hands back
  `/nix/store/<hash>-source`.

## On [verdi][verdi-config]: string

Verdi is my main dev machine, so I want to keep the fast feedback loop of direct
links. Running `nixos-rebuild` on each change is not ideal.

It keeps the default string value and creates one extra symlink to point
`~/.config/dotfiles` at the live repo checkout:

```nix
system.userActivationScripts.dotfiles-link.text = ''
  ln --verbose --force --symbolic --no-target-directory \
    "/home/nobe4/dev/nobe4/dotfiles" \
    "/home/nobe4/.config/dotfiles" >> /tmp/ln-logs 2>&1
'';
```

All `ln` tuples resolve through that to the live repo, keeping changes live.

## On [brahms][brahms-config]: path

Brahms is a machine I have no intention of developing on, and will mostly act
as a server, so I'm fine with a read-only config.

It sets the dotfiles to:

```nix
dotfiles = ../../..;
```

`../../..` is a nix path literal pointing at the repo root. With this, Nix
copies the entire tree into `/nix/store/<hash>-source/` at evaluation time. The
`coercedTo` turns that into a string, so `config.dotfiles` holds the store path.

Brahms then links that store path into place:

```nix
ln = with config; [
  [ "" "${home}/.config/dotfiles" ]
  [ ".zprofile" "${home}/.zprofile" ]
  [ ".zshrc" "${home}/.zshrc" ]
];
```

The first tuple links the store copy to `~/.config/dotfiles`. All other
packages' `ln` tuples still resolve to `~/.config/dotfiles/...`, which now
points into the store.

## The result

Running `colmena apply` from my workstation:

1. Nix evaluates brahms's config, sees `dotfiles = ../../..`, copies the repo
   tree into the store.
2. colmena builds the closure and pushes it to brahms over SSH.
3. Activation scripts run on brahms, creating all the symlinks.

Brahms never needs git, SSH keys to the repo, or network access to fetch
configs. Everything ships as part of the Nix closure.

## Update

With [`builtins.path`], it's possible to avoid the magic one-liner that's
`lib.types.coercedTo lib.types.path (p: "${p}") lib.types.str;`

This function builds upon the path type, with extra attributes. In this
configuration, it means that brahms defines:

```nix
dotfiles = builtins.path { path = ../../..; name = "dotfiles"; };
```

The `dotfiles` type can be a simple string again. `builtins.path` copies the
folder to the nix store.

Also, remember to run [`git gc`] once in a while.

Thanks [@tebriel] for the info.

[wrong-ways]: /posts/2026-01-25-nix-ln-the-wrong-ways/
[ln]: https://github.com/nobe4/dotfiles/blob/main/nixos/utils/ln.nix
[dotfiles]: https://github.com/nobe4/dotfiles/blob/main/nixos/utils/dotfiles.nix
[colmena]: https://colmena.cli.rs/
[nix-path-interp]: https://nix.dev/manual/nix/stable/language/string-interpolation#interpolated-expression
[nix-path]: https://nix.dev/manual/nix/stable/language/types#type-path
[verdi-config]: https://github.com/nobe4/dotfiles/blob/main/nixos/hosts/verdi/configuration.nix
[brahms-config]: https://github.com/nobe4/dotfiles/blob/main/nixos/hosts/brahms/configuration.nix
[`builtins.path`]: https://nix.dev/manual/nix/2.34/language/builtins.html#builtins-path
[@tebriel]: https://blog.frodux.org
[`git gc`]: https://git-scm.com/docs/git-gc
