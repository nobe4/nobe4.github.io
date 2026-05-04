+++
title = "Nix RPi Bootstrapping"
date = 2026-05-03
tags = ["tech", "nix"]
references = [
    "https://github.com/FiloSottile/age",
    "https://github.com/nobe4/dotfiles/tree/nixos/nixos/hosts/bach",
    "https://github.com/nobe4/dotfiles/tree/nixos/nixos/hosts/rpi_bootstrap",
    "https://github.com/ryantm/agenix",
    "https://mattbun.io/posts/building-nixos-rpi-images/",
    "https://nix.dev/manual/nix/2.28/command-ref/conf-file.html#conf-filter-syscalls",
    "https://nix.dev/manual/nix/2.28/command-ref/conf-file.html#conf-sandbox",
    "https://w1.fi/wpa_supplicant/",
    "https://wiki.nixos.org/wiki/NixOS_on_ARM/Raspberry_Pi",
    "https://wiki.nixos.org/wiki/Nixos-rebuild",
    "https://wiki.nixos.org/wiki/QEMU",
"https://determinate.systems/blog/moving-stuff-around-with-nix/",
]
+++

I can never remember how to set up a Raspberry Pi. Every time I flash an SD
card, I end up searching for the same wifi configuration, the same SSH setup,
the same boot options.

During my recent exploration of Nix, this felt like an immediate candidate for
improvement: the whole configuration lives in code, and rebuilding is one
command.

This post covers getting NixOS onto an RPi from scratch, and the problems I hit
while deploying updates to it. It is simplified for clarity and covers three
areas: building a minimal bootstrap image, handling secrets with agenix, and
deploying updates over SSH.

The example host is called `bach` (`aarch64-linux`, 1GB RAM). My build host is
`verdi` (`x86_64-linux`).

## Minimal bootstrap

The goal is to flash a single SD card and get a working machine on the network,
without any manual setup after boot.

I didn't want to boot a generic NixOS installer and configure it by hand. The
whole point is that the first SD image comes out already configured with wifi,
SSH, and a hostname. Insert the card, power on, and the machine is ready.

The image contains the bare minimum: root SSH access with key authentication,
wifi configuration, and mDNS via avahi.

```nix
{
  hostName ? throw "--argstr hostName is required",
  ssid ? throw "--argstr ssid is required",
  psk ? throw "--argstr psk is required",
  system ? "aarch64-linux",
}:
(import <nixpkgs/nixos> {
  inherit system;
  configuration =
    { config, ... }:
    {
      imports = [
        <nixpkgs/nixos/modules/installer/sd-card/sd-image-aarch64.nix>
      ];

      users.users.root = {
        openssh.authorizedKeys.keys = [ "ssh-ed25519 ..." ];
        password = "root"; # temporary, overridden later
      };

      services.openssh.enable = true;

      networking = {
        inherit hostName;
        wireless.enable = true;
        wireless.networks."${ssid}".pskRaw = "${psk}";
      };
    };
}).config.system.build.sdImage
```

<details>
<summary>How <code>--argstr</code> works</summary>

`nix-build` passes values to a Nix expression with `--argstr`:

```bash
nix-build \
  --argstr hostName "bach" \
  --argstr ssid "MyWifi" \
  --argstr psk "abc123..." \
  configuration.nix
```

Each `--argstr name value` binds `name` to the string `value` in the
expression. The `? throw "..."` syntax makes an argument required: if you
forget one, Nix fails with that message instead of a cryptic error.

This only works because the file is a Nix _function_ (the top-level
`{ hostName, ssid, psk, system }:` declares its arguments). A NixOS
`configuration.nix` is normally a module - an attrset, not a function
that takes arbitrary arguments. `--argstr` can't inject values into a
module. Wrapping the module in a function gives us a place to receive
the arguments, then pass them down into the configuration via closures.

</details>

`import <nixpkgs/nixos>` loads the NixOS evaluation entry point from your
channel. It takes `{ system; configuration; }` and returns the full NixOS
configuration, including build outputs like `config.system.build.sdImage`.

The bootstrap script handles the following steps:

1. Reads the wifi SSID and PSK from the local iwd configuration
2. Builds an SD image using `sd-image-aarch64.nix`
3. Flashes the image to the SD card with `dd`
4. Waits until `bach.local` is reachable on the network
5. Grabs `bach`'s SSH host public keys for agenix

`sd-image-aarch64.nix` is a NixOS module from nixpkgs that builds a bootable SD
card image for `aarch64` boards like the RPi. It sets up the partition layout,
U-Boot bootloader, and kernel. The output is a raw `.img` file, ready to `dd`
onto a card.

After booting, `bach` is on the network, reachable by name, and accepts SSH.
From here, everything happens over the wire.

The main challenge was figuring out how to build an RPi image at all. Most NixOS
documentation assumes you will run `nixos-rebuild switch` on the target machine.
For the RPi, I needed to build an SD image from scratch. Existing guides helped,
but none matched my setup exactly, and piecing it together took some digging
into the nixpkgs source.

One thing the bootstrap image _can't_ include is secrets. agenix encrypts
secrets with the host's SSH public key, and that key only gets generated on
first boot. Copying a private key into the SD image would expose it in the Nix
store, so the simpler approach is to fetch the public key after boot and encrypt
against it.

### Managing secrets with agenix

agenix encrypts files with age, using SSH public keys as recipients.
`secrets.nix` declares which keys can encrypt and decrypt each secret:

```nix
let
  nobe4_verdi = "ssh-ed25519 AAAA... nobe4@verdi";
  root_bach = "ssh-ed25519 AAAA... root@bach";
in
{
  "wifi-nwf-psk.age".publicKeys = [
    nobe4_verdi
    root_bach
  ];
}
```

Each `.age` file is encrypted for both `nobe4@verdi` (so I can edit secrets on
my main machine) and `root@bach` (so the RPi can decrypt them at activation
time). To update a secret, I run `agenix -e wifi-nwf-psk.age` on `verdi`, which
opens the decrypted file in an editor and re-encrypts it on save.

One caveat: after reflashing the SD card, `bach` gets a new SSH host key. The
old key in `secrets.nix` no longer matches, so I need to grab the new public
key, update `secrets.nix`, and rekey all secrets with `agenix -r`.

## Deploying updates

With the bootstrap working, the next step was deploying the real configuration:
users, packages, secrets, and firmware. My naive approach didn't work:

```bash
nixos-rebuild switch \
  --target-host root@bach.local \
  -I nixos-config=nixos/hosts/bach/configuration.nix
```

It failed in several different ways, each teaching me something about
cross-building for the RPi with Nix.

### Cross-building

`bach` runs `aarch64`, while `verdi` runs `x86_64`. Building on `verdi` without
telling Nix about the target architecture produces `x86_64` binaries, and running
them on `bach` gives an exec format error.

The fix is to cross-build via QEMU binfmt. The build host needs:

```nix
boot.binfmt.emulatedSystems = [ "aarch64-linux" ];
```

With this enabled, Nix can build `aarch64` binaries on `x86_64` through emulation.

### Limited RAM

`bach` has only 1GB of RAM. Building NixOS on it triggers the OOM killer, which
sends a SIGKILL mid-build.

This ruled out building on `bach` directly. The approach instead is to build on
`verdi`, copy the result to `bach`, and activate it there.

### Using Nix commands

I wanted to stick to Nix tooling as much as possible. The final build command
looks like this:

```bash
nix-build '<nixpkgs/nixos>' \
  -A system \
  -I nixos-config=nixos/hosts/bach/configuration.nix \
  --argstr system aarch64-linux \
  --option sandbox false \
  --option filter-syscalls false
```

`--argstr system aarch64-linux` tells Nix to evaluate for `aarch64` instead of
the host's `x86_64`. The two `--option` flags disable Nix's build sandbox and
seccomp filter, which are needed because QEMU binfmt emulation doesn't support
the syscalls that the sandbox relies on.

Then comes copying and activating the result, or "closure".

A closure is a store path plus every dependency it needs. Building a NixOS
system create `./result` as a single store path that references all its
dependencies transitively. `nix-copy-closure` copies that entire tree to a
remote machine over SSH, so `bach` has everything it needs to run. It's similar
to running `rsync`.

`nix-env --set` points the system profile at the new closure, and
`switch-to-configuration switch` activates it (services, mounts, and so on)
without rebooting. This is essentially what `nixos-rebuild switch` does under
the hood - here we run the steps by hand because we built and copied the
closure separately.

```bash
nix-copy-closure --to root@bach.local ./result

ssh root@bach.local \
  "nix-env -p /nix/var/nix/profiles/system \
    --set $(readlink ./result) && \
  $(readlink ./result)/bin/switch-to-configuration switch"
```

### RPi-specific configuration

The bootstrap image imports `sd-image-aarch64.nix`, which sets up boot and
filesystem automatically. The real configuration doesn't import that module, so
those need to be defined by hand:

```nix
boot.loader = {
  grub.enable = false;
  generic-extlinux-compatible = {
    enable = true;
    configurationLimit = 2;
  };
};

hardware.firmware = [ pkgs.linux-firmware ];
hardware.enableRedistributableFirmware = true;

fileSystems."/" = {
  device = "/dev/disk/by-label/NIXOS_SD";
  fsType = "ext4";
};
```

The RPi uses U-Boot with extlinux, not grub. A regular NixOS install has a
`hardware-configuration.nix` generated by the installer, but the RPi doesn't
have one, so boot and filesystem configuration must be written directly in
`configuration.nix`.

The wifi firmware also needs explicit inclusion. `sd-image-aarch64.nix` pulls it
in for the bootstrap, but the real configuration doesn't. Without
`hardware.enableRedistributableFirmware` and `pkgs.linux-firmware`, there is no
`wlan0` after switching configurations.

## Thoughts

The whole process took more iterations than I expected, but the result is
exactly what I wanted: a reproducible setup that I can reflash and redeploy
without remembering anything. The bootstrap script produces a working machine
in one step, and the deploy script updates it in another.

Most of the difficulty came from the RPi being a different architecture and
having limited resources. Once I understood that building had to happen on
`verdi` and the closure had to be copied over, the rest fell into place.
