+++
title = "Nix packaging"
date = 2026-01-12
tags = ["tech"]
references = [
    "https://nixos.org/",
    "https://github.com/sharkdp/bat",
    "https://github.com/NixOS/nixpkgs/blob/25.11/doc/build-helpers/fetchers.chapter.md#fetchfromgithub-fetchfromgithub",
    "https://github.com/NixOS/nixpkgs/blob/25.11/doc/languages-frameworks/rust.section.md#buildrustpackage-compiling-rust-applications-with-cargo-compiling-rust-applications-with-cargo",
    "https://github.com/NixOS/nixpkgs/blob/25.11/pkgs/by-name/ba/bat/package.nix",
    "https://nixos.org/manual/nixpkgs/stable/#function-library-lib.customisation.callPackageWith",
    "https://nix.dev/manual/nix/2.18/command-ref/new-cli/nix3-flake",
    "https://nix.dev/manual/nix/2.33/command-ref/new-cli/nix3-eval.html",
    "https://jvns.ca/blog/2023/11/11/notes-on-nix-flakes/",
]
+++

I have been using Nix for a couple of month, from a purely _consumer_
perspective. In all tools that I wanted to master, _producing_ is a great
teaching tool, sometimes more than _consuming_.

In that effect, I wanted to see how I could install `bat`, without using the
predefined package.

## The plan

1. Download the source code

    This is achieved with `fetchFromGitHub`.

2. Compile the rust binary

    This is achieved with `buildRustPackage`.

3. Install it

    This step varies, see below.

## Nix-only

### Build

```nix
# ./bat/default.nix
{
  rustPlatform,
  fetchFromGitHub,
  lib,
  pkgs,
  ...
}:

let
  repo = "bat";
  version = "v0.26.1";
in

rustPlatform.buildRustPackage {
  pname = repo;
  version = version;

  src = fetchFromGitHub {
    owner = "sharkdp";
    repo = "bat";
    rev = version;
    hash = "sha256-[redacted]";
  };

  cargoHash = "sha256-[redacted]";

  meta = {
    description = "A cat(1) clone with wings";
    homepage = "https://github.com/sharkdp/bat";
    license = lib.licenses.asl20;
  };
}
```

- `fetchFromGitHub` fetches the repository, based on its `owner`, `repo` and
  `rev` (commit, tag, or branch), and validates the downloaded content against
  the `hash`.

  It enables precise installation, instead of "latest"-only, and ensures that if
  a branch/tag changes. You need to update the hash manually, reminding you that
  you probably should inspect the diff as well.

- `rustPlatform.buildRustPackage` builds the Rust package, from its `src`.

  - `cargoHash` ensures the downloaded content, including dependencies, is locked.
  - `meta` adds various metadata to the package.


### Install

In your `configuration.nix`, add the following:

```nix
{ pkgs, ... }:
let
  bat = pkgs.callPackage ./bat { };
in
{
  # ...
  environment.systemPackages =  [ bat ];
  # ...
}
```

This binds the variable `bat` to the result of the `bat/default.nix`
compilation. You can then install it, here as a system package.

## Nix with flake

`nix flake` is an experimental feature that enables packaging nix code in a
reproducible and discoverable way. It's like a `Dockerfile`, but better.

### Build


```nix
# ./bat_flake/flake.nix
{
  inputs.nixpkgs.url = "nixpkgs";

  outputs =
    { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };

      repo = "bat";
      version = "v0.26.0";
    in
    {
      packages.${system}.default = pkgs.rustPlatform.buildRustPackage {
        pname = repo;
        version = version;

        src = pkgs.fetchFromGitHub {
          owner = "sharkdp";
          repo = repo;
          rev = version;
          hash = "sha256-[redacted]";
        };

        cargoHash = "sha256-[redacted]";

        meta = with pkgs.lib; {
          description = "A cat(1) clone with wings";
          homepage = "https://github.com/sharkdp/bat";
          license = licenses.asl20;
          platforms = platforms.linux;
        };
      };

      bat = self.packages.${system}.default;
    };
}
```

Lots of similarities with the no-flake version, and some differences:

- `inputs`: the dependencies for this flake, here only rely on `nixpkgs`, and
  using the default.

- `outputs`: the "product" of this flake.

- `outputs.let`: defines some variables to be used for making the output.

    - `system`: the current system, adapt to your needs.
    - `pkgs` imports `nixpkgs` as defined earlier, using the current system's
    version.

- `outputs.packages.${system}.default` the "default" output for the specified
  system.

    It directly uses the result of `buildRustPackage`, as seen previously.

    It is required to exist when running `nix build`, or `nixos-rebuild`.

- `outputs.bat`: the package and its name.

    This creates an alias name for the default result, used for easier
    referencing.

    ℹ️ This is _not_ how the binary is called. It is an exported name to be
    used in nix.

### Test

Flakes enable easy testing with `nix build`.

It creates a `flake.lock` to lock components to their hash, and produces a
`result` directory:

```shell
$ tree -l
.
├── flake.lock
├── flake.nix
└── result -> /nix/store/[redacted]-bat-v0.26.0
    └── bin
        └── bat
```

### Install

In your `configuration.nix`, add the following:

```nix
{ ... }:
let
  bat = (builtins.getFlake (toString ./bat_flake)).bat;
in
{
  # ...
  environment.systemPackages =  [ bat ];
  # ...
}
```

The only difference with the previous method is the usage of `builtins.getFlake`
to build the specified flake.

`toString` is used to convert the relative path `./bat_flake` to an absolute
path. E.g.
```shell
$ nix eval --expr 'builtins.toString ./bat_flake'
"/path/to/nixos/packages/bat_flake"
```

## Rebuilding

In both cases, rebuilding can be achieved with:

```shell
$ nixos-rebuild
```

## Thoughts

- In a non-`flake`d environment, using a non-`flake` installation method seems
  simpler, as it requires fewer steps around the actual fetch+compilation.
- Flake enable a faster iteration, as it doesn't require a full-rebuild each
  time during prototyping.
- Flake are _still_ experimental, but at this point it seems to be mostly an
  historical naming, because it's one of the most used feature of nix.
- In either case, having the ability to lock down any package to the version, or
  _commit_ creates amazing possibilities.

## Future

- Explore how to install two versions side by side. This require some post-build
  steps that I don't yet know how to perform.
- Probably not move my config to Flake-based, as I don't see too much
  benefits for now.
