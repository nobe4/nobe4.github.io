+++
title = "Accents"
date = 2025-07-13
tags = ["technology"]
references = [
    "http://www.x.org/releases/individual/data/xkeyboard-config/xkeyboard-config-2.44.tar.xz",
    "https://espanso.org/",
    "https://qmk.fm/",
    "https://docs.qmk.fm/how_keyboards_work",
    "https://www.usb.org/sites/default/files/documents/hid1_11.pdf",
    "https://www.usb.org/sites/default/files/documents/hut1_12v2.pdf",
    "https://www.x.org/wiki/XKB/",
    "https://sw.kovidgoyal.net/kitty/keyboard-protocol/",
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


### 1. Keyboard's `scancode`

Pressing a key on a keyboard triggers the keyboard firmeware to send a
`scancode`. Those are _not_ character, only predefined values that are expected
to be sent and received by keyboards.

Excerpt:

```
UsageID(Dec) UsageID(Hex) UsageName
0            00           Reserved (no event indicated)
...
4            04           Keyboard a and   A
5            05           Keyboard b and   B
6            06           Keyboard c and   C
7            07           Keyboard d and   D
8            08           Keyboard e and   E
...
30           1E           Keyboard 1 and   !
31           1F           Keyboard 2 and   @
32           20           Keyboard 3 and   #
...
228          E4           Keyboard RightControl
229          E5           Keyboard RightShift
230          E6           Keyboard RightAlt
231          E7           Keyboard Right
232-65535    E8-FFFF      Reserved
```

Because those have fixed values (see [section "10 Keyboard/Keypad Page (0x07)",
page 53)](https://www.usb.org/sites/default/files/documents/hut1_12v2.pdf), one
of the main job of a keyboard's firmeware is to correctly map the physical key
pressed to the correct scancode.

You'll notice that this list also doesn't contain accented characters or special
symbols. We'll get to them in a second.

### 2. USB-HID events

The OS receives keycodes from the keyboard that we can visualize with
`usbhid-dump`:

- Pressing `e`

    ```
    ~ sudo usbhid-dump -s 1:6 -f -e all # Simplified view
     00 00 08 00 00 00 00 00
     00 00 00 00 00 00 00 00
    ```

    It registers the `0x08` keycode. This corresponds to the character `e` as
    defined by the HID table.

- Pressing `é`

    ```
    ~ sudo usbhid-dump -s 1:6 -f -e all # Simplified view
     40 00 00 00 00 00 00 00
     40 00 0A 00 00 00 00 00
     40 00 00 00 00 00 00 00
     00 00 00 00 00 00 00 00
    ```

    We get the modifier `0x40` and the keycode `0x0A`.

    - The keycode `0x0A` corresponds to the character `g`.

    - The modifier equals `01000000`, which is the "RightAlt"/"AltGr" modifier
    (see [section "8.3 Report Format for Array Items", page
    66](https://www.usb.org/sites/default/files/documents/hid1_11.pdf)):

        ```
        Bit Key         Mask
        0   LEFT_CTRL   00000001
        1   LEFT_SHIFT  00000010
        2   LEFT_ALT    00000100
        3   LEFT_GUI    00001000
        4   RIGHT_CTRL  00010000
        5   RIGHT_SHIFT 00100000
        6   RIGHT_ALT   01000000
        7   RIGHT_GUI   10000000
        ```


### 3. Keyboard's mapping




wev

key 26 is ADO3 is 'e'
key 108 is RALT is 'AltGr'
    ISO_Level3_Shift is an alternative name for AltGr
key 45 is ACO5 is 'g'

[14:     wl_keyboard] key: serial: 4363; time: 804224; key: 26; state: 1 (pressed)
                      sym: e            (101), utf8: 'e'
[14:     wl_keyboard] key: serial: 4364; time: 804273; key: 26; state: 0 (released)
                      sym: e            (101), utf8: ''

[14:     wl_keyboard] key: serial: 4365; time: 805629; key: 108; state: 1 (pressed)
                      sym: ISO_Level3_Shift (65027), utf8: ''
[14:     wl_keyboard] key: serial: 4367; time: 805630; key: 42; state: 1 (pressed)
                      sym: eacute       (233), utf8: 'é'
[14:     wl_keyboard] key: serial: 4368; time: 805631; key: 42; state: 0 (released)
                      sym: eacute       (233), utf8: ''
[14:     wl_keyboard] key: serial: 4369; time: 805632; key: 108; state: 0 (released)
                      sym: ISO_Level3_Shift (65027), utf8: ''

kitten show-key --key-mode=kitty

101 is 0x065 is unicode 'e'
103 is 0x067 is unicode 'g'
223 is 0x0E9 is unicode 'é'
0x3 is end of text character
57453 is Kitty's ISO_LEVEL3_SHIFT or AltGr

Kitty's repoorting the end of text

e PRESS e
CSI 101 ;  ; 101 u
e RELEASE
CSI 101 ; 1 : 3 u

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
