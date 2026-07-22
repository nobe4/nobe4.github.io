+++
title = "NixOS on an Intel macBook"
date = 2026-07-22
tags = ["tech", "nix"]
references = [ ]
+++

I had a MacBook Pro sitting unused. An Intel, with an Apple T2 security chip. I
thought with NixOS on it, it might actually be useful again.

Here's how that journey went.

## The wrong ISO

My first attempt went like this:

- Download a standard [NixOS 26.05 minimal ISO]
- Write it to USB

  ```bash
  pv nixos-*.iso > /dev/sdX
  ```

- Plug it in
- Hold Option on startup, pick the USB drive
- Get greeted by

  ```
  unable to verify startup disk
  ```

  The Mac's Startup Security blocks unsigned media.

- Go into Recovery (Cmd-R at boot)
- Set "Allow booting from external media", and reboot
- Same error: the setting didn't persist after reboot

- Reinstall macOS (it took 3h21m, thanks Tahoe)
- The NixOS ISO finally booted, but froze on:

  ```
  probe with driver applesmc failed with error -5
  ```

The [T2 chip] blocks standard Linux kernels. I learned the hard way that
the vanilla NixOS ISO doesn't include the T2 drivers.

## The right ISO

The [t2linux] project maintains patched kernels and ISOs for T2 Macs. They
have a NixOS-specific ISO with all the drivers baked in.

Once more:

- Grab the [nixos-t2-iso] release
- Write it to USB

  ```bash
  pv nixos-t2-*.iso > /dev/sdX
  ```

- Reboot and hold Option
- Pick "EFI Boot"
- Finally the installer loads

## The brcm firmware

T2 Macs use a Broadcom Wi-Fi chip. Linux needs the firmware blobs that Apple
doesn't distribute for Linux. The [t2linux firmware script] extracts them from
macOS.

I used Method 2: run the script on macOS, which creates a `firmware.tar` in
`~/Downloads`. Then copy the tarball to the NixOS installer.

The NixOS config then installs the firmware at build time:

```nix
hardware.firmware = [
  (pkgs.stdenvNoCC.mkDerivation (final: {
    name = "brcm-firmware";
    src = ./firmware.tar;
    dontUnpack = true;
    installPhase = ''
      mkdir -p $out/lib/firmware/brcm
      tar -xf ${final.src} -C $out/lib/firmware/brcm
    '';
  }))
];
```

Keep `firmware.tar` in the NixOS host dir so rebuilds pick it up.

## Installation

I followed the [t2linux NixOS guide]. Two critical warnings:

- Do **not** delete the EFI partition.
- Do **not** delete the Apple APFS partition.

So, I used macOS Disk Utility to [carve out the disk]: 100GB for macOS, 900GB
for NixOS.

The setup is pretty standard after running `nixos-install`.

The installer config pulls in T2 hardware support and the Wi-Fi firmware:

```nix
{ config, lib, pkgs, ... }:

{
  imports = [
    ./hardware-configuration.nix
    "${builtins.fetchGit { url = "https://github.com/NixOS/nixos-hardware.git"; }}/apple/t2"
  ];

  hardware.firmware = [
    (pkgs.stdenvNoCC.mkDerivation (final: {
      name = "brcm-firmware";
      # ...
    }))
  ];

  boot.loader.systemd-boot.enable = true;
  boot.loader.efi.efiSysMountPoint = "/boot";

  networking.networkmanager.enable = true;

  environment.systemPackages = with pkgs; [ vim wget git ];

  services.openssh = {
    enable = true;
    settings.PermitRootLogin = "yes";
  };

  system.stateVersion = "26.11";
}
```

I configured Wi-Fi manually, enabled SSH, and switched to managing it remotely.

## Remote rebuild

I pulled the config into my dotfiles and ran:

```bash
nixos-rebuild switch --target-host root@10.0.0.10 \
  -I nixos-config=./configuration.nix \
  -I nixpkgs=channel:nixos-unstable
```

This broke in a few ways. Each one taught me something about [`nixos-rebuild`].

### SSH drops mid-switch

`nixos-rebuild switch` activates the new config live. It restarts
NetworkManager and dbus-broker, which kills the SSH connection.

But we can prevent those services from restarting during activation:

```nix
systemd.services.NetworkManager.stopIfChanged = false;
systemd.services.dbus-broker.stopIfChanged = false;
```

### Chicken-and-egg on first deploy

The `stopIfChanged` fix only takes effect _after_ it's deployed. The first
deploy still uses the old activation config and drops SSH.

The fix is to run `boot` instead of `switch` for the first deploy. It installs
the config but doesn't activate it. Then reboot manually:

```bash
nixos-rebuild boot --target-host root@10.0.0.10 \
  -I nixos-config=./configuration.nix \
  -I nixpkgs=channel:nixos-unstable

ssh root@10.0.0.10 reboot
```

After reboot, the `stopIfChanged` settings are active. Future `switch`
commands work fine.

### Wrong hardware-configuration.nix

The config used to import `/etc/nixos/hardware-configuration.nix` as an absolute
path. Since the build runs locally, it used the local hardware config. The
target booted into "timed out waiting for device" because of wrong disk UUIDs.

I had to copy the target's hardware config into the local machine:

```bash
scp root@10.0.0.10:/etc/nixos/hardware-configuration.nix \
  ./hardware-configuration.nix
```

Then use a relative import: `./hardware-configuration.nix`.

### Stale transient unit

After interrupting a failed `switch`, systemd left behind a stale service
unit:

```
Failed to start transient service unit: Unit
nixos-rebuild-switch-to-configuration.service was already loaded
```

The fix was to manually stop it on the target:

```bash
systemctl stop nixos-rebuild-switch-to-configuration.service
```

## Finishing up

After the rebuild landed, I set up the user:

```bash
ssh root@10.0.0.10 passwd nobe4
ssh root@10.0.0.10 "su - nobe4 -c \"ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N '' -C nobe4@10.0.0.10\""
```

Then disabled root SSH by dropping the authorized key from the config, replacing
it instead by the user's `authorizedKeys`.

```nix
  users.users.nobe4 = {
    openssh.authorizedKeys.keys = [
      # ...
    ];
  };
```

## Default boot

T2 Macs use Apple's boot manager, not standard UEFI boot order. Installing a
bootloader to the EFI partition isn't enough. The T2 chip keeps macOS as the
default unless you explicitly `bless` another `.efi` file.

Running `bless` from macOS failed with `0xe00002e2`: the T2 chip blocks boot
device changes from the full OS. I had to do it from Recovery mode, which has
higher privilege:

Boot and hold Cmd-R, then run:

```bash
diskutil list
# find the ~300MB EFI partition, here disk0s1

sudo mkdir -p /Volumes/EFI
sudo mount -t msdos /dev/disk0s1 /Volumes/EFI
sudo bless --mount /Volumes/EFI \
  --setBoot \
  --file /Volumes/EFI/EFI/systemd/systemd-bootx64.efi
```

After that, the Mac boots straight into NixOS.

[NixOS 26.05 minimal ISO]: https://nixos.org/download/#minimal-iso-image
[T2 chip]: https://support.apple.com/en-us/103265
[t2linux]: https://t2linux.org/
[nixos-t2-iso]: https://github.com/t2linux/nixos-t2-iso/releases
[carve out the disk]: https://wiki.t2linux.org/guides/preinstall/
[t2linux NixOS guide]: https://wiki.t2linux.org/distributions/nixos/installation/
[t2linux firmware script]: https://wiki.t2linux.org/guides/wifi-bluetooth/
[`nixos-rebuild`]: https://nixos.wiki/wiki/Nixos-rebuild
