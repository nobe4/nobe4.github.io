+++
title = 'Nix bin alias'
date = 2026-02-18T16:08:07+01:00
tags = ["nix", "tech"]
references = [
    "https://discourse.nixos.org/t/etc-profiles-per-user-user/17004",
    "https://github.com/NixOS/nixpkgs/blob/master/doc/stdenv/stdenv.chapter.md",
    "https://github.com/NixOS/nixpkgs/blob/master/pkgs/stdenv/generic/make-derivation.nix",
    "https://github.com/itchyny/gojq?tab=readme-ov-file#difference-to-jq",
    "https://github.com/jqlang/jq",
    "https://nix.dev/manual/nix/2.28/package-management/profiles.html",
    "https://nobe4.fr/posts/nix-ln-the-wrong-ways/",
    "https://search.nixos.org/options?channel=25.11&query=environment.variables",
    "https://wiki.nixos.org/wiki/Derivations",
    "https://wiki.nixos.org/wiki/Derivations#The_result_of_a_derivation",
]
+++

In one of my [previous post], I explored how to use `ln` to link files across a
NixOS system. The two initial needs were to link configuration files, and create
a binary alias.

I tend to install [`gojq`] and use it as [`jq`], it makes more sense to me to
have a consistent experience between the CLI and library. I have not _yet_
suffered from this choice, despite my intense [`jq`] usage.

In this post, we'll use it to explore how to create a direct link to the `gojq`
binary. The logic can be applied to any other binary of your choice.

## `ln-root`

In my [previous post], I showed how using `activationScripts` allowed to create
root-owned symlink. I had used it to create a global link:

```nix
ln-root = [
    [ "${pkgs.gojq}/bin/gojq" "/usr/bin/jq" ]
];
```

And this worked well:

```shell
$ readlink /usr/bin/jq
/nix/store/<hash>-gojq-0.12.17/bin/gojq
```

`/usr/bin/` is however not in the `$PATH`, so it wouldn't be useable right away.

## Updating `$PATH`

This would be the obvious solution, which could be achieved in a couple of
different ways:

- `.zprofile`

    ```zsh
    export PATH="$PATH:/usr/bin"
    ```

- `configuration.nix`

    ```nix
    {
      environment.sessionVariables.PATH = [ "/usr/bin" ];
    }
    ```

This technically works. However I know that in a couple of months, I'll look
back and think "Why did I wanted to add this path?" I would rather not create
any ambiguity.

## [`mkDerivation`]

A better solution is to create a whole new [derivation] in nix, which creates the
link for us.

[`mkDerivation`] is "the fundamental building block" of nixpkgs and empowers
users and contributors to create new derivations.

In our case, we want:
1. get the path to the installed `gojq`
2. create a link to it, called `jq`.

### Path to `gojq`

The path to any Nix package is available directly from the package itself:

```nix
stdenv.mkDerivation {
  buildCommand = ''echo ${pkgs.gojq}'';
}
```

Result:

```shell
/nix/store/<hash>-gojq-0.12.17
```

Note that this doesn't point to the `gojq` binary, but to the package's
path. To get to the binary, we need:

```nix
stdenv.mkDerivation {
  buildCommand = ''echo ${pkgs.gojq}/bin/gojq'';
}
```

### [`mkDerivation`]

[`mkDerivation`] expects installed content in specific locations:

- `$out/bin` for binaries
- `$out/lib` for binaries
- `$out/include` for binaries

[`$out`] is a special variable that stores the result of a derivation. It's
given by the `stdenv` builder and can be used directly.

The `$out` are symlinked and added into the user's `$PATH`.

Additional information:
- `mkDerivation.name` is the required name of the package
- `mkDerivation.version` is the optional version of the package

Both are used in the final path to the package:

```shell
/nix/store/<hash>-<name>-<version>
```

### Linking `gojq`

The final version of our custom link is:

```nix
stdenv.mkDerivation {
  name = "jq";
  version = gojq.version;
  buildCommand = ''
    mkdir -p $out/bin
    ln -s ${gojq}/bin/gojq $out/bin/jq
  '';
}
```

And can even be added directly in `users.users.<user>.package`:

```nix
{ pkgs, ... }: {
  users.users.nobe4.packages = with pkgs; [
    gojq

    (stdenv.mkDerivation {
      name = "jq";
      version = gojq.version;
      buildCommand = ''
        mkdir -p $out/bin
        ln -s ${gojq}/bin/gojq $out/bin/jq
      '';
    })
  ];
}
```

This, IMHO, is the best way to explicitly declare that `jq` is a link to `gojq`.
The Nix configuration shows what it is, and if any additional comments are
needed, they can be added _here_ and not lack context.


## A list of links

Let's now look at the full chain of links:

```shell
$ which jq
/etc/profiles/per-user/nobe4/bin/jq
$ readlink /etc/profiles/per-user/nobe4/bin/jq
/nix/store/<hash>-jq/bin/jq
$ readlink /nix/store/<hash>-jq/bin/jq
/nix/store/<hash>-gojq-0.12.17/bin/gojq
```

The [`/etc/profiles/per-user/<user>/`] folder is a managed user profile, where
all the binaries, libraries, headers, etc, are linked for a user. It is similar
in spirit to [`~/.nix-profile`].

[previous post]: https://nobe4.fr/posts/nix-ln-the-wrong-ways/
[`gojq`]: https://github.com/itchyny/gojq?tab=readme-ov-file#difference-to-jq
[`jq`]: https://github.com/jqlang/jq
[derivation]: https://wiki.nixos.org/wiki/Derivations
[`mkDerivation`]: https://github.com/NixOS/nixpkgs/blob/master/pkgs/stdenv/generic/make-derivation.nix
[`$out`]: https://wiki.nixos.org/wiki/Derivations#The_result_of_a_derivation
[`/etc/profiles/per-user/<user>/`]: https://discourse.nixos.org/t/etc-profiles-per-user-user/17004
[`~/.nix-profile`]: https://nix.dev/manual/nix/2.28/package-management/profiles.html
