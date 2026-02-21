+++
title = 'Nix-Darwin shell override'
date = 2026-02-14T17:24:28+01:00
tags = ["tech", "nix"]
references = [
    "https://github.com/NixOS/nix/blob/8fadcceb6d5c4458915fce58267695ef12bb048f/src/libutil/util.cc#L74-L84",
    "https://github.com/NixOS/nixpkgs/blob/master/nixos/doc/manual/development/replace-modules.section.md",
    "https://github.com/NixOS/nixpkgs/blob/nixos-25.11/nixos/modules/programs/bash/bash.nix",
    "https://github.com/NixOS/nixpkgs/blob/nixos-25.11/nixos/modules/programs/zsh/zsh.nix",
    "https://github.com/nix-darwin/nix-darwin/blob/6c5a56295d2a24e43bcd8af838def1b9a95746b2/modules/programs/bash/default.nix",
    "https://github.com/nix-darwin/nix-darwin/blob/6c5a56295d2a24e43bcd8af838def1b9a95746b2/modules/programs/zsh/default.nix",
    "https://github.com/nix-darwin/nix-darwin/blob/6c5a56295d2a24e43bcd8af838def1b9a95746b2/modules/programs/zsh/default.nix#L210",
    "https://github.com/nobe4/dotfiles/blob/0281789d26fa16b68a98c7e1a5f9b1ef915bbc11/nixos/packages/shell/aliases.nix",
    "https://github.com/nobe4/dotfiles/blob/0281789d26fa16b68a98c7e1a5f9b1ef915bbc11/nixos/packages/shell/shell.nix",
    "https://github.com/nobe4/dotfiles/blob/beced1a1b4106c8478412dfe644794984a541be6/nixos/modules/darwin-shell.nix",
    "https://github.com/nobe4/dotfiles/commit/cb8bd6d707dc75fbacd5bed7a054f062d2d96de1",
]
+++

_All code snippets are simplified for clarity._

## Moving aliases to Nix

I recently decided to move my shell aliases, and ZSH options to Nix.

There are predefined Nix options for this, all under [`programs.zsh`] and [`programs.bash`].

And since I use the same aliases for `zsh` and `bash`, here's the configuration
I came to:

- [`packages/shell/aliases.nix`]

  ```nix
  { lib, pkgs, ... }:
  {
    "ls" = "ls --color=auto";
    "ll" = "ls -la";
  }
  // lib.optionalAttrs pkgs.stdenv.isDarwin {
    "kitty" = "$HOME/Applications/kitty.app/Contents/MacOS/kitty";
  }
  ```

- [`packages/shell/shell.nix`]

  ```nix
  { lib, pkgs, ... }:
  let
    shellAliases = import ./aliases.nix { lib = lib; pkgs = pkgs; };
  in
  {
    programs.zsh = {
      enable = true;
      setOptions = [ "ALWAYS_TO_END" ];
      shellAliases = shellAliases;
    };

    programs.bash = {
      enable = true;
      shellAliases = shellAliases;
    };
  }
  ```

And I can import `shell.nix` wherever needed, so far so good.

## Enter nix-darwin

On one of my system, I use [nix-darwin] to configure all my macOS settings. It
has been a great help.

When running `darwin-rebuild switch` I was greeted with

```
error: The option `programs.bash.shellAliases` does not exist.
Did you mean `programs.bash.enable`, ... ?
```

Upon looking at [`darwin.programs.bash`], it turns out that it is indeed not
defined. Uh, OK. What about [`darwin.programs.zsh`]? Same absence.

Turns out that neither `shellAliases` nor `setOptions` are defined, and some
[default ZSH options] are used.

This got me wondering, how does NixOS actually achieve this?

## Back to NixOS

Looking back at [`programs.zsh`], we can see how the `setOptions` is done:

_`bash` is similar_.

```nix
{ config, lib, options, pkgs, ... }:
let
  zshAliases = builtins.concatStringsSep "\n" (
    lib.mapAttrsToList (k: v: "alias -- ${k}=${lib.escapeShellArg v}") (
      lib.filterAttrs (k: v: v != null) cfg.shellAliases
    )
  );
in
{
  options.programs.zsh = {
    shellAliases = lib.mkOption {
      type = with lib.types; attrsOf (nullOr (either str path));
      default = { };
    };
    setOptions = lib.mkOption {
      type = lib.types.listOf lib.types.str;
      default = [ "HIST_IGNORE_DUPS" ];
    };
  };

  config = lib.mkIf cfg.enable {
    environment.etc.zshrc.text = ''
      # /etc/zshrc: DO NOT EDIT -- this file has been generated automatically.

      ${lib.optionalString (cfg.setOptions != [ ]) ''
        # Set zsh options.
        setopt ${builtins.concatStringsSep " " cfg.setOptions}
      ''}

      # Setup aliases.
      ${zshAliases}
    '';
  };
}
```

The logic is pretty straightforward:

1. the options are defined following a specific type
2. the values are formatted
3. the formatted result is added to `/etc/zshrc`.

Looks pretty straightforward[^why /etc/zshrc].

How hard would it be to add this back into Nix-Darwin?

## First attempt: `mkAfter`

I remember reading `mkAfter` in the past and it was my first idea: appends the
options/aliases to the `environment.etc.zshrc.text` value.

Starting with the easiest to format: `setOptions` , I arrived at [a working
`mkAfter` code]:

```nix
{ config, lib, ... }:
let
  cfg = config.programs.zsh;
in
{
  options = {
    programs.zsh = {
      setOptions = lib.mkOption {
        type = lib.types.listOf lib.types.str;
        default = [ "HIST_IGNORE_DUPS" ];
      };
    };

  };

  config = lib.mkIf cfg.enable {
    environment.etc.zshrc.text = lib.mkAfter ''
      ${lib.optionalString (cfg.setOptions != [ ]) ''
        # Set zsh options.
        setopt ${builtins.concatStringsSep " " cfg.setOptions}
      ''}
    '';
  };
}
```

This draws inspiration from [`programs.zsh`] and was pretty easy to come up
with.

Running again, the build worked and `/etc/zshrc` was updated accordingly:

```shell
$ grep setopt /etc/zshrc
setopt HIST_IGNORE_DUPS SHARE_HISTORY HIST_FCNTL_LOCK            # default
setopt ALWAYS_TO_END INTERACTIVE_COMMENTS AUTO_CD AUTO_LIST  ... # custom
```

This is almost correct, because I might not want to keep the default values. So
`mkAfter` doesn't work entirely.

## Trying [`builtins.replaceStrings`]

My next idea was to replace the default `setopt` with the custom string.

Here's what I tried:

```nix
  config = lib.mkIf cfg.enable {
    environment.etc.zshrc.text =
      builtins.replaceStrings
        [ "setopt HIST_IGNORE_DUPS SHARE_HISTORY HIST_FCNTL_LOCK" ]
        [
          ''
            ${lib.optionalString (cfg.setOptions != [ ]) ''
              # Set zsh options.
              setopt ${builtins.concatStringsSep " " cfg.setOptions}
            ''}
          ''
        ]
        environment.etc.zshrc.text;
  };
```

It failed with:

```
error: infinite recursion encountered
```

This _seems_ to come from the fact that `zshrc.text` is not the string value,
but a reference to what it will eventually be. Nix is a lazy-evaluated language,
after all. My best guess at understanding what happens, it still feels like
magic to me, is that `zshrc.text` becomes dependent on its own value, which
create an infinite dependency loop.

## Override and `disabledModule`

[@tebriel] suggested that I use an override, whose main idea is to replace a Nix
module with another one. Combined with [`disabledModules`] it completely
replaces a module's functionality.

E.g.

```nix
{}:{
    disabledModules = [ "path/to/module" ];
    imports = [ "path/to/custom/module" ];
}
```

Using this method, I copied the entire [`darwin.programs.zsh`] and
[`darwin.programs.bash`] into my dotfile repo and [added the missing options]:

- `hosts/brahms.nix`

  ```nix {hl_lines=[2 4]}
  {}:{
    disabledModules = [ "programs/zsh" ];
    imports = [
      ../modules/darwin-zsh.nix
    ];
  }
  ```

- `modules/darwin-zsh.nix`

  A copy of [`darwin.programs.zsh`] with some additions copied straight from
  [`programs.zsh`]:

  ```nix {hl_lines=["6-9" "18-21"]}
  {}:{
      programs.zsh.histFile = mkOption {
        type = types.str;
      };

      programs.zsh.setOptions = lib.mkOption {
        type = lib.types.listOf lib.types.str;
        default = [ "HIST_IGNORE_DUPS" ];
      };

      programs.zsh.enableCompletion = mkOption {
        type = types.bool;
      };

      environment.etc."zshrc".text = ''
        HISTFILE=${cfg.histFile}

        ${lib.optionalString (cfg.setOptions != [ ]) ''
          # Set zsh options.
          setopt ${builtins.concatStringsSep " " cfg.setOptions}
        ''}

        bindkey -e
      '';
  }
  ```

This offered two advantages:

1. It worked, I could have the `zsh` options set correctly.
2. It offered an easy way to prepare a patch to send this change upstream.

Adding the remaining functionalities were similar, so I'll spare the repetition
here. You can view the [final changes].

## Porting the changes upstream

- https://github.com/nix-darwin/nix-darwin/pull/1697
- https://github.com/nix-darwin/nix-darwin/pull/1698

## Acknowledgements

Thanks [@tebriel] for the [initial code], the reviews and
improvements.

[initial code]: https://github.com/nobe4/dotfiles/pull/50
[final changes]: https://github.com/nobe4/dotfiles/pull/51
[added the missing options]: https://github.com/nobe4/dotfiles/commit/cb8bd6d707dc75fbacd5bed7a054f062d2d96de1
[`disabledModules`]: https://github.com/NixOS/nixpkgs/blob/master/nixos/doc/manual/development/replace-modules.section.md
[`builtins.replaceStrings`]: https://github.com/NixOS/nix/blob/8fadcceb6d5c4458915fce58267695ef12bb048f/src/libutil/util.cc#L74-L84
[a working `mkAfter` code]: https://github.com/nobe4/dotfiles/blob/beced1a1b4106c8478412dfe644794984a541be6/nixos/modules/darwin-shell.nix
[default ZSH options]: https://github.com/nix-darwin/nix-darwin/blob/6c5a56295d2a24e43bcd8af838def1b9a95746b2/modules/programs/zsh/default.nix#L210
[`darwin.programs.bash`]: https://github.com/nix-darwin/nix-darwin/blob/6c5a56295d2a24e43bcd8af838def1b9a95746b2/modules/programs/bash/default.nix
[`darwin.programs.zsh`]: https://github.com/nix-darwin/nix-darwin/blob/6c5a56295d2a24e43bcd8af838def1b9a95746b2/modules/programs/zsh/default.nix
[`programs.zsh`]: https://github.com/NixOS/nixpkgs/blob/nixos-25.11/nixos/modules/programs/zsh/zsh.nix
[`programs.bash`]: https://github.com/NixOS/nixpkgs/blob/nixos-25.11/nixos/modules/programs/bash/bash.n
[`packages/shell/shell.nix`]: https://github.com/nobe4/dotfiles/blob/0281789d26fa16b68a98c7e1a5f9b1ef915bbc11/nixos/packages/shell/shell.nix
[`packages/shell/aliases.nix`]: https://github.com/nobe4/dotfiles/blob/0281789d26fa16b68a98c7e1a5f9b1ef915bbc11/nixos/packages/shell/aliases.nix
[@tebriel]: https://blog.frodux.org

[^why /etc/zshrc]: Note that NixOS only installs ZSH options in the _global_
config at `/etc/zshrc` and not `~/.zshrc`.
