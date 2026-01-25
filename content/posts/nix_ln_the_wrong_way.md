+++
title = 'Nix ln, the wrong way'
date = 2026-01-25
tags = ["tech", "nix"]
references = [
    "https://github.com/nix-community/home-manager",
    "https://nixos.org/manual/nixpkgs/stable/#sec-using-stdenv",
    "https://nixos.org/manual/nixpkgs/stable/#sec-tools-of-stdenv",
    "https://nixos.org/manual/nixpkgs/stable/#function-library-lib.strings.concatMapStringsSep",
    "https://nixos.org/manual/nixpkgs/stable/#trivial-builder-runCommand",
    "https://www.foodogsquared.one/posts/2023-03-24-managing-mutable-files-in-nixos/",
    "https://github.com/NixOS/nixpkgs/blob/078d69f03934859a181e81ba987c2bb033eebfc5/nixos/modules/system/activation/activation-script.nix#L184",
    "https://github.com/NixOS/nixpkgs/blob/078d69f03934859a181e81ba987c2bb033eebfc5/nixos/modules/system/activation/activation-script.nix#L323",
    "https://nix.dev/manual/nix/2.28/command-ref/conf-file.html#conf-sandbox-paths",
    "https://discourse.nixos.org/t/what-is-sandboxing-and-what-does-it-entail/15533",
    "https://github.com/NixOS/nixpkgs/blob/078d69f03934859a181e81ba987c2bb033eebfc5/nixos/modules/system/activation/activation-script.nix#L138",
    "https://discourse.nixos.org/t/why-is-useractivationscripts-generally-frowned-upon-and-what-to-use-instead/13526",
    "https://jade.fyi/blog/use-nix-less/",
]
+++

**TL;DR**: don't do this, everyone suggests to using `home-manager`, or a non-Nix
solution.

In the exploration of porting my configuration to Nix, the next step was to find
a way to manage all the links. This article shows a couple of wrong way to do
it, they are still good learning paths, hence this writing.

Unless otherwise specified, all code examples are simplified for clarity.

## Current configuration

Whenever I need to link a new file, I add a line in:

```shell
# install.sh
ln -sfv "$DOTFILE_FOLDER/.zshrc" "$HOME/.zshrc"
ln -sfv "$DOTFILE_FOLDER/kitty/" "$HOME/.config/kitty"
# ...
```

This works well enough for a single system, but is not easily configurable.
Using Nix's options seemed like a good solution for this.

I had head of `home-manager`, but didn't want to use it until I absolutely
needed to.

## Using `mkDerivation`

```nix
# ln.nix
{ stdenv, lib }:
{
  ln =
    {
      name,
      links, # list of [ src, dst ] tuples
    }:
    stdenv.mkDerivation {
      installPhase = ''
        ${lib.strings.concatMapStringsSep "\n" (
          link:
          let
            src = builtins.elemAt link 0;
            dst = builtins.elemAt link 1;
          in ''ln -s ${dst} ${src}''
        ) links}
      '';
    };
}

# configuration.nix
{ pkgs, lib, ... }:
let
  ln = (import ./ln.nix { inherit (pkgs) stdenv lib; }).ln;
in
{
  environment.systemPackages = [
    (ln {
      links = [
        [ "$DOTFILE_FOLDER/.zshrc" "$HOME/.zshrc" ]
        [ "$DOTFILE_FOLDER/kitty" "$HOME/.config/kitty" ]
        # ...
      ];
    })
  ];
  # ...
}
```

- `mkDerivation` builds a package in the standard environment, with
  various build tools (`ln` is available).
- `installPhase` is responsible for "installing" the package, here _install_
  means _linking_, since the file already exists.
- `concatMapStringsSep` loops through its 3rd argument, applies its 2nd
  argument on each item and then join the result with its 1st.

Why this doesn't work:
- `installPhase` expect the result to be installed in a directory called "$out"
  which exists only in the Nix store.
- Writing to a path outside of the Nix store is explicitly forbidden.

## Using `runCommand`

```nix
# ln.nix
{ pkgs }:
{
  ln =
    { links }:
    pkgs.runCommand "ln" { } ''
      ${lib.concatMapStringsSep "\n" (
        link:
        let
          src = builtins.elemAt link 0;
          dst = builtins.elemAt link 1;
        in ''ln -s ${dst} ${src}''
      ) links}
    '';
}

# configuration.nix
{ pkgs, ... }:
let
  ln = (import ./ln.nix { inherit pkgs; }).ln;
in
{
  # ... similar as before
}
```

- `runCommand` runs a specific shell command upon invocation.
- The rest of the code looks similar.

Why this doesn't work:
- `runCommand` is also bound to the nix store, making writing to any file
  outside of it impossible.

## Caveat on `runCommand` and `etc`

It's technically possible to use the result of `runCommand` if the file is
expected to be in `/etc`:

```nix
{ pkgs, ... }:
let
  dotfiles = pkgs.runCommand "ln" { } ''ln -s $DOTFILE_FOLDER $out'';
in
{
  enviroment.etc = {
    "kitty".source = "${dotfiles}/kitty";
    # ...
  };
  # ...
}
```

This doesn't work if the file is expected to live in `$HOME/`, or `$XDG_CONFIG/`.

## Using `userActivationScripts`

```nix
# ln.nix
{ config, lib, ... }:
{
  options.ln = lib.mkOption {
    type = with lib.types; listOf (listOf str);
    default = [ ];
  };
  config.system.userActivationScripts.ln.text = lib.concatMapStringsSep "\n" (
    tuple:
    let
      src = builtins.elemAt tuple 0;
      dst = builtins.elemAt tuple 1;
    in
    ''ln -s ${src} ${dst}''
  ) config.ln;
}


# configuration.nix
{ ... }:
{
  imports = [
    ./utils/ln.nix
    # ...
  ];
  ln = [
    [ "$DOTFILE_FOLDER/.zshrc" "$HOME/.zshrc" ]
    [ "$DOTFILE_FOLDER/kitty" "$HOME/.config/kitty" ]
  ];
  # ...
}
```

- `userActivationScripts` is a collection of scripts executed when the
  configuration is activated, either by booting or running `nixos-rebuild
  switch`.
- The scripts are executed outside of the Nix sandbox, where
  `$HOME` is available to write.

This works well for user-owned files and folders, but not for `root`-owned.

For `root`-owned files, one can use `activationScripts`, which is fundamentally
similar except that `root` runs it.

E.g.

```nix
# ln.nix
{
  # ... adding to the previous
  options.ln-root = lib.mkOption {
    type = with lib.types; listOf (listOf str);
    default = [ ];
  };
  config.system.activationScripts.ln-root.text = lib.concatMapStringsSep "\n" (
    tuple:
    let
      src = builtins.elemAt tuple 0;
      dst = builtins.elemAt tuple 1;
    in
    ''ln -vfs ${src} ${dst} ''
  ) config.ln-root;
  #...
}

# configuration.nix
{ pkgs, ... }:
{
  # ...
  ln-root = [
    [ "${pkgs.gojq}/bin/gojq" "/usr/bin/jq" ]
  ];
  # ...
}
```

Why it's not ideal:
- The scripts are run _on every activation_, meaning each boot, which is highly
  unnecessary.
- It's not what those scripts are typically meant for.

## Moving forward

While it's technically possible to build a link farm with `*activationScripts`,
it's not recommended, nor the paved path.

I shall explore `home-manager` next and see how it solves it.
