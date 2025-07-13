+++
title = "Accents"
date = 2025-07-13
tags = ["technology"]
references = [
    "http://www.x.org/releases/individual/data/xkeyboard-config/xkeyboard-config-2.44.tar.xz",
    "https://espanso.org/",
    "https://qmk.fm/",
    "https://docs.qmk.fm/how_keyboards_work",
    "https://www.usb.org/sites/default/files/documents/hut1_12v2.pdf",
    "https://www.x.org/wiki/XKB/",
]
+++

In this post, I explain the various steps I used to type accents on my QMK-based
keyboard.

I by no mean am an expert in this domain, but I learned a lot and wants to share
my understanding.

## Espanso

Until very recently, I had been using this [Espanso
configuration](https://github.com/nobe4/dotfiles/blob/e121ff838942e2df5aca50d696f8cca6f5d3afea/espanso/match/accents.yml)
to manage typing accents on a non-accented keyboard.

E.g.

```yaml
matches:
  - trigger: ",er"
    replace: "€"

  - trigger: ",cc"
    replace: "ç"
  - triggers: [",Cc", ",CC"]
    replace: "Ç"

  - trigger: ",ae"
    replace: "æ"
  - triggers: [",Ae", ",AE"]
    replace: "Æ"
```

This worked pretty easily, granted the occasional trigger after a comma without
a following whitespace.

On NixOS, with Wayland, there's unfortunately no way to run Espanso. This
has been a [long-standing issue](https://github.com/NixOS/nixpkgs/pull/328890)
and has only seen limited update recently.

This prompted me to try to bring this basic keyboard functionality into my
keyboard, literally.

## How to type accents?

Typing accents requires a whole lot of processing that seems counter-intuitive
at first glance. For a user, "pressing the key with é" and "seeing é on the
screen" are so common, that we rarely try to understand what is going on under
the hood.

I'll use XKB here, because it's the one I ended up playing with, but this logic
follows for other keyboard systems.


1. Pressing a key on a keyboard triggers the keyboard firmeware to send a
    `scancode`. Those are _not_ character, only predefined values that are
    expected to be sent and received by keyboards.

    Excerpt:

    ```
    UsageID(Dec) UsageID(Hex) UsageName
    0            00           Reserved (no event indicated)
    ...
    4            04           Keyboard a and   A
    5            05           Keyboard b and   B
    6            06           Keyboard c and   C
    ...
    30           1E           Keyboard 1 and   !
    31           1F           Keyboard 2 and   @
    32           20           Keyboard 3 and   #
    ...
    224          E0           Keyboard LeftControl
    225          E1           Keyboard LeftShift
    226          E2           Keyboard LeftAlt
    227          E3           Keyboard Left
    228          E4           Keyboard RightControl
    229          E5           Keyboard RightShift
    230          E6           Keyboard RightAlt
    231          E7           Keyboard Right
    232-65535    E8-FFFF      Reserved
    ```

    Because those have [fixed values (see page
    53)](https://www.usb.org/sites/default/files/documents/hut1_12v2.pdf), one
    of the main job of a keyboard's firmeware is to correctly map the physical
    key pressed to the correct scancode.

    You'll notice that this list also doesn't contain accented characters or
    special symbols. We'll get to them in a second.

2. The OS receives keycodes



wev

[14:     wl_keyboard] key: serial: 34958; time: 6873636; key: 38; state: 1 (pressed)
                      sym: a            (97), utf8: 'a'
[14:     wl_keyboard] key: serial: 34959; time: 6873679; key: 38; state: 0 (released)
                      sym: a            (97), utf8: ''

[14:     wl_keyboard] key: serial: 34960; time: 6875245; key: 108; state: 1 (pressed)
                      sym: ISO_Level3_Shift (65027), utf8: ''
[14:     wl_keyboard] key: serial: 34962; time: 6875246; key: 42; state: 1 (pressed)
                      sym: eacute       (233), utf8: 'é'
[14:     wl_keyboard] key: serial: 34963; time: 6875247; key: 42; state: 0 (released)
                      sym: eacute       (233), utf8: ''
[14:     wl_keyboard] key: serial: 34964; time: 6875248; key: 108; state: 0 (released)
                      sym: ISO_Level3_Shift (65027), utf8: ''

kitten show-key --key-mode=kitty

a PRESS a
CSI 97 ;  ; 97 u
a RELEASE
CSI 97 ; 1 : 3 u

ISO_LEVEL3_SHIFT PRESS
CSI 57453 u
é PRESS é
CSI 233 :  : 103 ;  ; 233 u
Alternate key: g
é RELEASE
CSI 233 :  : 103 ; 1 : 3 u
Alternate key: g
ISO_LEVEL3_SHIFT RELEASE
CSI 57453 ; 1 : 3 u
