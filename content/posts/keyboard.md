+++
title = "Keyboard"
date = 2025-05-27
tags = ["technology", "keyboard"]
+++

<style>
pre code {
    font-size: large;
}
</style>

This keyboard layout is the latest _and smallest_ iteration in my keyboard
journey. I've managed to fit everything into 34 keys, while removing anything
superfluous.

Letting the classical QWERTY layout go in favor of one that made _sense to me_
really helped shaping a more personal and simple layout.

See the code at https://github.com/nobe4/keyboards/blob/main/ferris/keymap.c

<details>
<summary>Glossary</summary>

- <kbd>[ ]</kbd>: space key
- <kbd>GUI</kbd>: "command", "super", or "windows".
- <kbd>OS</kbd>: OS layer
- <kbd>SY</kbd>: Symbol layer

</details>

# Default layer

```
q    w    f    p    g         j    l    u    y    '
a    r    s    t    d         h    n    e    i    o
z    x    c    v    b         k    m    ,    .    ↵
               ⇑    [ ]       CTRL SY
```

# <kbd>⇑</kbd> held: Shift layer

```
Q    W    F    P    G         J    L    U    Y    "
A    R    S    T    D         H    N    E    I    O
Z    X    C    V    B         K    M    ;    :    ↵
               ⇑    [ ]       CTRL SY
```

Changing the defaults to have more logical shifted characters:  `'"`, `,;`,
`.:`.

# <kbd>SY</kbd> held: Symbol layer

```
0    1    2    3    +        (    )    [    ]    |
␛    4    5    6    =        ←    ↓    ↑    →    \
⇒    7    8    9    -        {    }    <    >    /
                    GUI      CTRL OS
```

Fun how the arrows stay in the HJKL place, because Vim ingrained those in my
head.

# Normal layer + long press

Long pressing on some keys bring some _less common_ symbols, and the GUI
modifier.

```
#                                            $    `

*    %    @    ^    GUI      &    _    ?    !
 

```

This leaves <kbd>GUI</kbd> + <kbd>acvxzt</kbd> available for common operations.

# <kbd>OS</kbd> held: OS layer

```
F1   F2   F3   F4   F5       🔊
F6   F7   F8   F9   F10      🔈 ⏯
F11  F12  F13  F14  F15      🔉
 
```
