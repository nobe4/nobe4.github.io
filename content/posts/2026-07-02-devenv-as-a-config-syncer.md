+++
title = 'Devenv as a Config Syncer'
date = 2026-07-02T20:34:25+02:00
tags = ["nix", "tech"]
+++

I keep a [golangci-lint](https://golangci-lint.run/) config that I share across
my Go projects. Sync'ing it around gets old fast: I have to remember which repos
use it and update them all.

[Devenv](https://devenv.sh/) already manages my dev shells. Turns out it can
also fetch and install config files automatically.

## The idea

`pkgs.fetchurl` downloads a file at build time and pins it by hash.
Devenv [tasks](https://devenv.sh/tasks/) can run before the shell starts.

Combine the two: fetch a remote config, symlink it into the project.

## The setup

Here is a minimal Go project using this pattern.

```nix
# devenv.nix
{
  pkgs,
  ...
}:
let
  golangci-lint-config = pkgs.fetchurl {
    url = "https://example.com/.golangci.yaml";
    hash = "sha256-AAAA...";
  };
in
{
  packages = with pkgs; [
    git
    go
    golangci-lint
  ];

  tasks."config:install" = {
    before = [ "devenv:enterShell" ];
    exec = "ln -sf ${golangci-lint-config} .golangci.yaml";
  };
}
```

What happens:

1. `pkgs.fetchurl` downloads the config and stores it in the nix store.
2. The `config:install` task runs before `devenv:enterShell`.
3. It symlinks the nix store path to `.golangci.yaml` in the project root.

When you enter the shell (via `direnv` or `devenv shell`), the config is
already in place. `golangci-lint run` picks it up.

## Updating the config

When the upstream config changes, the hash no longer matches. The process would
be: clear the hash, rebuild, paste the new one.

One could also imagine using a versioning system's website with a commit in the
URL, for even more reproducibility.

## Scaling it

The pattern works for any config file. Fetch multiple files, symlink them all:

```nix
let
  golangci-config = pkgs.fetchurl { ... };
  editorconfig = pkgs.fetchurl { ... };
in
{
  tasks."config:install" = {
    before = [ "devenv:enterShell" ];
    exec = ''
      ln -sf ${golangci-config} .golangci.yaml
      ln -sf ${editorconfig} .editorconfig
    '';
  };
}
```

## Trade-offs

The symlink is read-only. You can't edit the config in the project dir. That is
the point: one source of truth. So editing the config must be done at the
source.

The hash pin means you get reproducible builds. No surprise config changes.
But you do have to update the hash manually when you want the latest version.

CI that would constantly pull a new version would fail. But that's an acceptable
tradeoff.
