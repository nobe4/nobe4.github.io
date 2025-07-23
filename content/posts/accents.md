+++
title = "Accents"
date = 2025-07-13
tags = ["technology"]
references = [
    "https://docs.kernel.org/hid/hidintro.html",
    "https://docs.kernel.org/hid/index.html",
    "https://docs.qmk.fm/how_keyboards_work",
    "https://espanso.org/",
    "https://github.com/torvalds/linux/blob/347e9f5043c89695b01e66b3ed111755afcf1911/include/uapi/linux/input-event-codes.h",
    "https://gitlab.freedesktop.org/xkeyboard-config/xkeyboard-config",
    "https://qmk.fm/",
    "https://sw.kovidgoyal.net/kitty/keyboard-protocol/",
    "https://unix.stackexchange.com/a/545281",
    "https://unix.stackexchange.com/questions/537982/why-do-evdev-keycodes-and-x11-keycodes-differ-by-8",
    "https://wayland.freedesktop.org/architecture.html",
    "https://wiki.archlinux.org/title/X_keyboard_extension",
    "https://www.kernel.org/doc/html/v6.6/hid/hidintro.html",
    "https://www.usb.org/sites/default/files/documents/hid1_11.pdf",
    "https://www.usb.org/sites/default/files/documents/hut1_12v2.pdf",
    "https://www.x.org/releases/current/doc/xproto/x11protocol.html#Keyboards",
    "https://www.x.org/wiki/XKB/",
    "https://xkeyboard-config.freedesktop.org/layouts/analyzer/#?model=ansi-60&layout=us",
]
+++

In this post, I explain the various steps I used to type accents on my QMK-based
keyboard.

I by no mean am an expert in this domain, but I learned a lot and wants to share
my understanding.

**Note**: Whenever possible, simplified views of various output is given. Some
of the tools used are _very_ verbose.

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
at first glance. For a user, "tapping the key with é" and "seeing é on the
screen" are so common, that we rarely try to understand what is going on under
the hood.

I'll use XKB here, because it's the one I ended up playing with, but this logic
follows for other keyboard systems.

### 1. Keyboard's `scancode`

Pressing a key on a keyboard triggers the keyboard firmeware to send a HID
`scancode`. Those are _not_ character, only predefined values that are expected
to be sent and received by keyboards.

Acceptable scancodes are  fixed values (see [section "10 Keyboard/Keypad Page
(0x07)", page
53)](https://www.usb.org/sites/default/files/documents/hut1_12v2.pdf), one of
the main job of a keyboard's firmeware is to correctly map the physical key
pressed to the correct scancode.

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

You'll notice that this list also doesn't contain accented characters or special
symbols.

### 2. USB's `HID events`

The OS receives HID events from the keyboard; we can visualize them with
`usbhid-dump`:


```shell
$ sudo usbhid-dump -s 1:6 -f -e all
# tapping `e`
00 00 08 00 00 00 00 00
00 00 00 00 00 00 00 00
...
```

It registers the `0x08` keycode. This corresponds to the character `e` as
defined by the HID table.


```shell
...
# Tapping `é`
40 00 00 00 00 00 00 00
40 00 0A 00 00 00 00 00
40 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00
```

We get the modifier `0x40` and the keycode `0x0A`. The modifier `0x40` stays
pressed while the keycode `0x0A` gets pressed and released.

The keycode `0x0A` corresponds to the character `g` as defined by the HID
table.

The modifier equals `0b01000000`, which is the "RightAlt"/"AltGr" modifier
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

Those are immediately handled by the kernel.

### 3. Linux kernel's `evdev`

Upon receiving the `scancodes`, Linux HID's subsystem translate those into
device events: `evdev`.

The device events are defined in the [linux
kernel](https://github.com/torvalds/linux/blob/347e9f5043c89695b01e66b3ed111755afcf1911/include/uapi/linux/input-event-codes.h):

```c
...
#define KEY_W        17
#define KEY_E        18
#define KEY_R        19
...
#define KEY_F        33
#define KEY_G        34
#define KEY_H        35
...
#define KEY_SYSRQ    99
#define KEY_RIGHTALT 100
#define KEY_LINEFEED 101
...
```

Interestingly, the QWERTY keyboard is used as the official layout for
interpreting keycodes, instead of the HID alphabetical order.

```shell
$ sudo libinput record -o record /dev/input/event18 --show-keycodes --with-hidraw
Receiving events: [              *      ]^C
```

After tapping `e` and `é`, we get:

```yaml
devices:
- node: /dev/input/event18
  evdev:
    # Supported Events:
    # ...
    #   Event code 18 (KEY_E)
    # ...
    #   Event code 34 (KEY_G)
    # ...
    #   Event code 100 (KEY_RIGHTALT)
  events:

  # tapping 'e'
  - hid:
      hidraw2: [ 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00 ]
  - evdev:
    - [  1, 348988,   1,  18,       1] # EV_KEY / KEY_E        1
  - hid:
      hidraw2: [ 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 ]
  - evdev:
    - [  1, 385986,   1,  18,       0] # EV_KEY / KEY_E        0

  # tapping 'é'
  - hid:
      hidraw2: [ 0x40, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 ]
  - evdev:
    - [  2, 989974,   1, 100,       1] # EV_KEY / KEY_RIGHTALT 1
  - hid:
      hidraw2: [ 0x40, 0x00, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00 ]
  - evdev:
    - [  2, 990972,   1,  34,       1] # EV_KEY / KEY_G        1
  - hid:
      hidraw2: [ 0x40, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 ]
  - evdev:
    - [  2, 991969,   1,  34,       0] # EV_KEY / KEY_G        0
  - hid:
      hidraw2: [ 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 ]
  - evdev:
    - [  2, 992970,   1, 100,       0] # EV_KEY / KEY_RIGHTALT 0
```

Each `hid` event is converted into a `evdev` event that maps expectedly to the
Linux code definition. `1` is for press, `0` for release.

In summary:
| HID        | evdev | key            |
| ---        | ---   | ---            |
| `0x000008` | 18    | `KEY_E`        |
| `0x400000` | 100   | `KEY_RIGHTALT` |
| `0x00000a` | 34    | `KEY_G`        |


### 4. X's `keycode`

Now that the evdev event is generated by the kernel, X (or other display
servers) can handle them according to their inner logic.

X and Wayland both use XKB to handle keyboard mappings, so we'll study it here.

X's keycodes represent logical keys and are left to the server for
interpretation.

We can look at the X's events with:
```shell
$ xev -evenv keyboard
# tapping 'e'
KeyPress event, serial 28, synthetic NO, window 0x600001,
    state 0x0, keycode 26 (keysym 0x65, e), same_screen YES,
    XLookupString gives 1 bytes: (65) "e"
KeyRelease event, serial 28, synthetic NO, window 0x600001,
    state 0x0, keycode 26 (keysym 0x65, e), same_screen YES,
    XLookupString gives 1 bytes: (65) "e"

# tapping 'é'
KeyPress event, serial 28, synthetic NO, window 0x600001,
    state 0x0, keycode 108 (keysym 0xfe03, ISO_Level3_Shift), same_screen YES,
    XKeysymToKeycode returns keycode: 92
KeyPress event, serial 28, synthetic NO, window 0x600001,
    state 0x80, keycode 42 (keysym 0xe9, eacute), same_screen YES,
    XLookupString gives 2 bytes: (c3 a9) "é"
KeyRelease event, serial 28, synthetic NO, window 0x600001,
    state 0x80, keycode 42 (keysym 0xe9, eacute), same_screen YES,
    XLookupString gives 2 bytes: (c3 a9) "é"
KeyRelease event, serial 28, synthetic NO, window 0x600001,
    state 0x80, keycode 108 (keysym 0xfe03, ISO_Level3_Shift), same_screen YES,
    XKeysymToKeycode returns keycode: 92
```

We get a very similar output, with an interesting difference, all the keycodes
are shifted by `8`.

Indeed, the
[function](https://gitlab.freedesktop.org/xorg/driver/xf86-input-evdev/-/blob/master/src/evdev.c?ref_type=heads#L282-307)
that converts `evdev` into keycodes [adds
`8`](https://gitlab.freedesktop.org/xorg/driver/xf86-input-evdev/-/blob/master/src/evdev.c?ref_type=heads#L73)
to all codes before storing them:

```c
#DEFINE MIN_KEYCODE 8
// ...
void
EvdevQueueKbdEvent(InputInfoPtr pInfo, struct input_event *ev, int value)
{
    EventQueuePtr pQueue;

    // ...

    if ((pQueue = EvdevNextInQueue(pInfo)))
    {
        pQueue->type = EV_QUEUE_KEY;
        pQueue->detail.key = ev->code + MIN_KEYCODE;
        pQueue->val = value;
    }
}
```

## 5. XKB's keyboard layout

After X captures the evdev and converts it to a keycode, a two step process
happens:

1. The X keycode are mapped to a keyboard key.

    X's key are names for the position of the key traditionally found on a
    keyboard.

    In the basic
    [`evdev`](https://gitlab.freedesktop.org/xkeyboard-config/xkeyboard-config/-/blob/master/keycodes/evdev?ref_type=heads)
    layout, one can see how this is setup:

    ```
    default xkb_keycodes "evdev" {
        <TLDE> = 49;
        <AE01> = 10;
        <AE02> = 11;
        ...
        <AE11> = 20;
        <AE12> = 21;
        <BKSP> = 22;
        ...
    }
    ```

    Those codes are layout-agnostic, but can be easily visualized on an [US ANSI
    keyboard](https://xkeyboard-config.freedesktop.org/layouts/analyzer/#?model=ansi-60&layout=us):

    ```
    TLDE AEO1 AEO2 AEO3 AEO4 AEO5 AEO6 AEO7 AEO8 AEO9 AE10 AE11 AE12 BKSP
    TAB  AD01 AD02 AD03 AD04 AD05 AD06 AD07 AD08 AD09 AD10 AD11 AD12 BKSL
    CAPS   AC01 AC02 AC03 AC04 AC05 AC06 AC07 AC08 AC09 AC10 AC11    RTRN
    LFSH     AB01 AB02 AB03 AB04 AB05 AB06 AB07 AB08 AB09 AB10       RTSH
    LCTL  LWIN  LALT              SPCE             RALT  RWIN  COMP  RCTL
    ```


    Here are the keycodes that interest us:

    - `<AD05> = 28;`
    - `<AC05> = 42;`
    - `<RALT> = 108;`

2. The keyboard keycode is mapped to symbols.

    X then uses a symbol mapping list to determin which symbol corresponds to
    the pressed keycode. Those are configurable by the user and is where one can
    change the locality of the keyboard layout.

    Let's look at
    [`eu`](https://gitlab.freedesktop.org/xkeyboard-config/xkeyboard-config/-/blob/master/symbols/eu)
    since it contains a lot of commonly used accents for european languages:

    ```
    xkb_symbols "basic"  {
        // Mod        NONE      SHIFT          ALTGR           SHIFT+ALTGR
        key <TLDE> {[ grave,    asciitilde,    dead_grave,     dead_tilde    ]};
        key <AE01> {[ 1,        exclam,        exclamdown,     onesuperior   ]};
        key <AE02> {[ 2,        at,            ordfeminine,    twosuperior   ]};
        ...
        key <AD01> {[ q,        Q,             ae,             AE            ]};
        key <AD02> {[ w,        W,             aring,          Aring         ]};
        key <AD03> {[ e,        E,             ediaeresis,     Ediaeresis    ]};
        key <AD04> {[ r,        R,             yacute,         Yacute        ]};
        ...
        key <AC05> {[ g,        G,             eacute,         Eacute        ]};
        ...
    };
    ```

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
