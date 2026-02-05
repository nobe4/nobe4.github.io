+++
title = 'When ln is not idempotent'
date = 2026-02-04T18:02:56+01:00
+++

**TL;DR:** `ln -T`

I was refactoring more my Nix config, and specifically replacing my link farm
with nix as described in [my previous post](/posts/nix_ln_the_wrong_ways#using-useractivationscripts).

When I noticed that links were being created in the wrong places. I would run
`ln` more than once and would get links in random locations:

```shell
$ ln -vfs "$DOTFILE_FOLDER/nvim/" "$HOME/.config/nvim"
'/home/nobe4/.config/nvim' -> '/home/nobe4/dev/nobe4/dotfiles/nvim'

$ ls -la "$HOME/.config/nvim"
lrwxrwxrwx 1 nobe4 users 35 Feb  4 20:12 /home/nobe4/.config/nvim -> /home/nobe4/dev/nobe4/dotfiles/nvim
# all good!

# do some testing ...

$ ln -vfs "$DOTFILE_FOLDER/nvim/" "$HOME/.config/nvim"
'/home/nobe4/.config/nvim/nvim' -> '/home/nobe4/dev/nobe4/dotfiles/nvim'
# uh, what now?

$ ls -la $DOTFILE_FOLDER/nvim/nvim
lrwxrwxrwx 1 nobe4 users 35 Feb  4 20:12 /home/nobe4/dev/nobe4/dotfiles/nvim/nvim -> /home/nobe4/dev/nobe4/dotfiles/nvim
# what the hell
```

In a simplified form:

```shell
$ mkdir a
$ ln -vfs a b
'b' -> 'a'
$ ln -vfs a b
'b/a' -> 'a'
$ tree
.
├── a
│   └── a -> a
└── b -> a
```

That prompted me to do an overly zealous study of what `ln` do in various
scenario. The conclusion of this post is everyone's favorite: _RTFM_.

## The test scenario

All the commands are ran with:

```shell
link () {
    ln --verbose --force --symbolic "$(pwd)/${1:?}" "$(pwd)/${2:?}"
}
```

- `$1` is the _target_, what the link points to.
- `$2` is _link name_, but not always, it is sometimes the _directory_.

<details><summary>Legend </summary>

- �: Missing File, Directory, or Link.
- F: File
- D: Directory
- FL: Link to a File
- DL: Link to a Directory
- �FL: Broken link to a File
- �DL: Broken link to a Directory
- `/`: Ends with a `/`
</details>
<br>

`$1` \ `$2` | �       | F       | D
---         | ---     | ---     | ---
�           | `0` ❌  | `14` ❌ | `28` ❌
�`/`        | `1` ❌  | `15` ❌ | `29` ❌
F           | `2` ✅  | `16` ✅ | `30` ⚠️
F`/`        | `3` ❌  | `17` ❌ | `31` ❌
D           | `4` ✅  | `18` ✅ | `32` ⚠️
D`/`        | `5` ✅  | `19` ✅ | `33` ⚠️
�FL         | `6` ❌  | `20` ❌ | `34` ❌
�FL`/`      | `7` ❌  | `21` ❌ | `35` ❌
FL          | `8` ✅  | `22` ✅ | `36` ⚠️
FL`/`       | `9` ❌  | `23` ❌ | `37` ❌
�DL         | `10` ❌ | `24` ❌ | `38` ❌
�DL`/`      | `11` ❌ | `25` ❌ | `39` ❌
DL          | `12` ✅ | `26` ✅ | `40` ⚠️
DL`/`       | `13` ✅ | `27` ✅ | `41` ⚠️

_Notes:_

- The indexes correspond to the test results listed below.

- Results:

    - ✅: the link is valid
    - ❌: the link is broken
    - ⚠️: the link exists but might not be what you want


- ⚠️: All the links are created _inside_ the directory, rather than _being_ the
    directory.

    E.g. for the same command `link a b`:

    ```shell
    # instead of
    ### [16] ###
    .
    ├── a
    └── b -> /tmp/ln/a

    # we get
    ### [30] ###
    .
    ├── a
    └── b
        └── a -> /tmp/ln/a
    ```

    This is what `man ln` calls the `3rd and 4th forms`:

    > In the 3rd  and  4th  forms,  create links to each TARGET in DIRECTORY.

    If you look back before the table, that's what the "sometimes" means for `$2`.

<details>
<summary> Full test results </summary>

- `run.sh`
    ```shell
    #!/usr/bin/env bash
    link () {
        ln --verbose --force --symbolic "$(pwd)/${1:?}" "$(pwd)/${2:?}"
    }

    clean() { find . -not -name run.sh -delete ; }

    run() {
        echo -e "\n### [${id}] ###: $1"
        eval "$1"
        tree -I 'run.sh' | head -n -2
        find . -xtype l -exec echo "Broken link: {}" \;
        id=$((id + 1))
        clean
    }

    id=0
    cases=(
        # column 1
        "link a b"
        "link a/ b"
        "touch a && link a b"
        "touch a && link a/ b"
        "mkdir a && link a b"
        "mkdir a && link a/ b"
        "link a b && link b c"
        "link a b && link b/ c"
        "touch a && link a b && link b c"
        "touch a && link a b && link b/ c"
        "link a/ b && link b c"
        "link a/ b && link b/ c"
        "mkdir a && link a b && link b c"
        "mkdir a && link a b && link b/ c"
        # column 2
        "touch b && link a b"
        "touch b && link a/ b"
        "touch b && touch a && link a b"
        "touch b && touch a && link a/ b"
        "touch b && mkdir a && link a b"
        "touch b && mkdir a && link a/ b"
        "touch c && link a b && link b c"
        "touch c && link a b && link b/ c"
        "touch c && touch a && link a b && link b c"
        "touch c && touch a && link a b && link b/ c"
        "touch c && link a/ b && link b c"
        "touch c && link a/ b && link b/ c"
        "touch c && mkdir a && link a b && link b c"
        "touch c && mkdir a && link a b && link b/ c"
        # column 2
        "mkdir b && link a b"
        "mkdir b && link a/ b"
        "mkdir b && touch a && link a b"
        "mkdir b && touch a && link a/ b"
        "mkdir b && mkdir a && link a b"
        "mkdir b && mkdir a && link a/ b"
        "mkdir c && link a b && link b c"
        "mkdir c && link a b && link b/ c"
        "mkdir c && touch a && link a b && link b c"
        "mkdir c && touch a && link a b && link b/ c"
        "mkdir c && link a/ b && link b c"
        "mkdir c && link a/ b && link b/ c"
        "mkdir c && mkdir a && link a b && link b c"
        "mkdir c && mkdir a && link a b && link b/ c"
    )

    for t in "${cases[@]}"; do
        run "$t"
    done
    ```

- Output
    ```shell
    ### [0] ###: link a b
    '/tmp/ln/b' -> '/tmp/ln/a'
    .
    └── b -> /tmp/ln/a
    Broken link: ./b

    ### [1] ###: link a/ b
    '/tmp/ln/b' -> '/tmp/ln/a/'
    .
    └── b -> /tmp/ln/a/
    Broken link: ./b

    ### [2] ###: touch a && link a b
    '/tmp/ln/b' -> '/tmp/ln/a'
    .
    ├── a
    └── b -> /tmp/ln/a

    ### [3] ###: touch a && link a/ b
    '/tmp/ln/b' -> '/tmp/ln/a/'
    .
    ├── a
    └── b -> /tmp/ln/a/
    Broken link: ./b

    ### [4] ###: mkdir a && link a b
    '/tmp/ln/b' -> '/tmp/ln/a'
    .
    ├── a
    └── b -> /tmp/ln/a

    ### [5] ###: mkdir a && link a/ b
    '/tmp/ln/b' -> '/tmp/ln/a/'
    .
    ├── a
    └── b -> /tmp/ln/a/

    ### [6] ###: link a b && link b c
    '/tmp/ln/b' -> '/tmp/ln/a'
    '/tmp/ln/c' -> '/tmp/ln/b'
    .
    ├── b -> /tmp/ln/a
    └── c -> /tmp/ln/b
    Broken link: ./c
    Broken link: ./b

    ### [7] ###: link a b && link b/ c
    '/tmp/ln/b' -> '/tmp/ln/a'
    '/tmp/ln/c' -> '/tmp/ln/b/'
    .
    ├── b -> /tmp/ln/a
    └── c -> /tmp/ln/b/
    Broken link: ./c
    Broken link: ./b

    ### [8] ###: touch a && link a b && link b c
    '/tmp/ln/b' -> '/tmp/ln/a'
    '/tmp/ln/c' -> '/tmp/ln/b'
    .
    ├── a
    ├── b -> /tmp/ln/a
    └── c -> /tmp/ln/b

    ### [9] ###: touch a && link a b && link b/ c
    '/tmp/ln/b' -> '/tmp/ln/a'
    '/tmp/ln/c' -> '/tmp/ln/b/'
    .
    ├── a
    ├── b -> /tmp/ln/a
    └── c -> /tmp/ln/b/
    Broken link: ./c

    ### [10] ###: link a/ b && link b c
    '/tmp/ln/b' -> '/tmp/ln/a/'
    '/tmp/ln/c' -> '/tmp/ln/b'
    .
    ├── b -> /tmp/ln/a/
    └── c -> /tmp/ln/b
    Broken link: ./c
    Broken link: ./b

    ### [11] ###: link a/ b && link b/ c
    '/tmp/ln/b' -> '/tmp/ln/a/'
    '/tmp/ln/c' -> '/tmp/ln/b/'
    .
    ├── b -> /tmp/ln/a/
    └── c -> /tmp/ln/b/
    Broken link: ./c
    Broken link: ./b

    ### [12] ###: mkdir a && link a b && link b c
    '/tmp/ln/b' -> '/tmp/ln/a'
    '/tmp/ln/c' -> '/tmp/ln/b'
    .
    ├── a
    ├── b -> /tmp/ln/a
    └── c -> /tmp/ln/b

    ### [13] ###: mkdir a && link a b && link b/ c
    '/tmp/ln/b' -> '/tmp/ln/a'
    '/tmp/ln/c' -> '/tmp/ln/b/'
    .
    ├── a
    ├── b -> /tmp/ln/a
    └── c -> /tmp/ln/b/

    ### [14] ###: touch b && link a b
    '/tmp/ln/b' -> '/tmp/ln/a'
    .
    └── b -> /tmp/ln/a
    Broken link: ./b

    ### [15] ###: touch b && link a/ b
    '/tmp/ln/b' -> '/tmp/ln/a/'
    .
    └── b -> /tmp/ln/a/
    Broken link: ./b

    ### [16] ###: touch b && touch a && link a b
    '/tmp/ln/b' -> '/tmp/ln/a'
    .
    ├── a
    └── b -> /tmp/ln/a

    ### [17] ###: touch b && touch a && link a/ b
    '/tmp/ln/b' -> '/tmp/ln/a/'
    .
    ├── a
    └── b -> /tmp/ln/a/
    Broken link: ./b

    ### [18] ###: touch b && mkdir a && link a b
    '/tmp/ln/b' -> '/tmp/ln/a'
    .
    ├── a
    └── b -> /tmp/ln/a

    ### [19] ###: touch b && mkdir a && link a/ b
    '/tmp/ln/b' -> '/tmp/ln/a/'
    .
    ├── a
    └── b -> /tmp/ln/a/

    ### [20] ###: touch c && link a b && link b c
    '/tmp/ln/b' -> '/tmp/ln/a'
    '/tmp/ln/c' -> '/tmp/ln/b'
    .
    ├── b -> /tmp/ln/a
    └── c -> /tmp/ln/b
    Broken link: ./c
    Broken link: ./b

    ### [21] ###: touch c && link a b && link b/ c
    '/tmp/ln/b' -> '/tmp/ln/a'
    '/tmp/ln/c' -> '/tmp/ln/b/'
    .
    ├── b -> /tmp/ln/a
    └── c -> /tmp/ln/b/
    Broken link: ./c
    Broken link: ./b

    ### [22] ###: touch c && touch a && link a b && link b c
    '/tmp/ln/b' -> '/tmp/ln/a'
    '/tmp/ln/c' -> '/tmp/ln/b'
    .
    ├── a
    ├── b -> /tmp/ln/a
    └── c -> /tmp/ln/b

    ### [23] ###: touch c && touch a && link a b && link b/ c
    '/tmp/ln/b' -> '/tmp/ln/a'
    '/tmp/ln/c' -> '/tmp/ln/b/'
    .
    ├── a
    ├── b -> /tmp/ln/a
    └── c -> /tmp/ln/b/
    Broken link: ./c

    ### [24] ###: touch c && link a/ b && link b c
    '/tmp/ln/b' -> '/tmp/ln/a/'
    '/tmp/ln/c' -> '/tmp/ln/b'
    .
    ├── b -> /tmp/ln/a/
    └── c -> /tmp/ln/b
    Broken link: ./c
    Broken link: ./b

    ### [25] ###: touch c && link a/ b && link b/ c
    '/tmp/ln/b' -> '/tmp/ln/a/'
    '/tmp/ln/c' -> '/tmp/ln/b/'
    .
    ├── b -> /tmp/ln/a/
    └── c -> /tmp/ln/b/
    Broken link: ./c
    Broken link: ./b

    ### [26] ###: touch c && mkdir a && link a b && link b c
    '/tmp/ln/b' -> '/tmp/ln/a'
    '/tmp/ln/c' -> '/tmp/ln/b'
    .
    ├── a
    ├── b -> /tmp/ln/a
    └── c -> /tmp/ln/b

    ### [27] ###: touch c && mkdir a && link a b && link b/ c
    '/tmp/ln/b' -> '/tmp/ln/a'
    '/tmp/ln/c' -> '/tmp/ln/b/'
    .
    ├── a
    ├── b -> /tmp/ln/a
    └── c -> /tmp/ln/b/

    ### [28] ###: mkdir b && link a b
    '/tmp/ln/b/a' -> '/tmp/ln/a'
    .
    └── b
        └── a -> /tmp/ln/a
    Broken link: ./b/a

    ### [29] ###: mkdir b && link a/ b
    '/tmp/ln/b/a' -> '/tmp/ln/a/'
    .
    └── b
        └── a -> /tmp/ln/a/
    Broken link: ./b/a

    ### [30] ###: mkdir b && touch a && link a b
    '/tmp/ln/b/a' -> '/tmp/ln/a'
    .
    ├── a
    └── b
        └── a -> /tmp/ln/a

    ### [31] ###: mkdir b && touch a && link a/ b
    '/tmp/ln/b/a' -> '/tmp/ln/a/'
    .
    ├── a
    └── b
        └── a -> /tmp/ln/a/
    Broken link: ./b/a

    ### [32] ###: mkdir b && mkdir a && link a b
    '/tmp/ln/b/a' -> '/tmp/ln/a'
    .
    ├── a
    └── b
        └── a -> /tmp/ln/a

    ### [33] ###: mkdir b && mkdir a && link a/ b
    '/tmp/ln/b/a' -> '/tmp/ln/a/'
    .
    ├── a
    └── b
        └── a -> /tmp/ln/a/

    ### [34] ###: mkdir c && link a b && link b c
    '/tmp/ln/b' -> '/tmp/ln/a'
    '/tmp/ln/c/b' -> '/tmp/ln/b'
    .
    ├── b -> /tmp/ln/a
    └── c
        └── b -> /tmp/ln/b
    Broken link: ./c/b
    Broken link: ./b

    ### [35] ###: mkdir c && link a b && link b/ c
    '/tmp/ln/b' -> '/tmp/ln/a'
    '/tmp/ln/c/b' -> '/tmp/ln/b/'
    .
    ├── b -> /tmp/ln/a
    └── c
        └── b -> /tmp/ln/b/
    Broken link: ./c/b
    Broken link: ./b

    ### [36] ###: mkdir c && touch a && link a b && link b c
    '/tmp/ln/b' -> '/tmp/ln/a'
    '/tmp/ln/c/b' -> '/tmp/ln/b'
    .
    ├── a
    ├── b -> /tmp/ln/a
    └── c
        └── b -> /tmp/ln/b

    ### [37] ###: mkdir c && touch a && link a b && link b/ c
    '/tmp/ln/b' -> '/tmp/ln/a'
    '/tmp/ln/c/b' -> '/tmp/ln/b/'
    .
    ├── a
    ├── b -> /tmp/ln/a
    └── c
        └── b -> /tmp/ln/b/
    Broken link: ./c/b

    ### [38] ###: mkdir c && link a/ b && link b c
    '/tmp/ln/b' -> '/tmp/ln/a/'
    '/tmp/ln/c/b' -> '/tmp/ln/b'
    .
    ├── b -> /tmp/ln/a/
    └── c
        └── b -> /tmp/ln/b
    Broken link: ./c/b
    Broken link: ./b

    ### [39] ###: mkdir c && link a/ b && link b/ c
    '/tmp/ln/b' -> '/tmp/ln/a/'
    '/tmp/ln/c/b' -> '/tmp/ln/b/'
    .
    ├── b -> /tmp/ln/a/
    └── c
        └── b -> /tmp/ln/b/
    Broken link: ./c/b
    Broken link: ./b

    ### [40] ###: mkdir c && mkdir a && link a b && link b c
    '/tmp/ln/b' -> '/tmp/ln/a'
    '/tmp/ln/c/b' -> '/tmp/ln/b'
    .
    ├── a
    ├── b -> /tmp/ln/a
    └── c
        └── b -> /tmp/ln/b

    ### [41] ###: mkdir c && mkdir a && link a b && link b/ c
    '/tmp/ln/b' -> '/tmp/ln/a'
    '/tmp/ln/c/b' -> '/tmp/ln/b/'
    .
    ├── a
    ├── b -> /tmp/ln/a
    └── c
        └── b -> /tmp/ln/b/
    ```

</details>

## The problem

Going back to my initial scenario:

```shell
$ ln -vfs "$DOTFILE_FOLDER/nvim/" "$HOME/.config/nvim"
```

We now understand the weird behavior:

1. First run, the `$HOME/.config/nvim` link is created, it points to the
   directory `$DOTFILE_FOLDER/nvim/`.

    ```shell
    $HOME/.config/nvim -> $DOTFILE_FOLDER/nvim
    ```

2. Second run, `ln` sees a directory, and assumes that you want to link _into
   the directory_, rather than link _the directory_.

    ```shell
    $DOTFILE_FOLDER/nvim/nvim -> $HOME/.config/nvim -> $DOTFILE_FOLDER/nvim
    ```

3. The result is a new link inside the linked directory:

    ```shell
    $DOTFILE_FOLDER/nvim/nvim -> $DOTFILE_FOLDER/nvim
    ```

## The solution

Per usual, _RTFM_:

```man
   -T, --no-target-directory
          treat LINK_NAME as a normal file always
```

This means that no matter what `LINK_NAME` is, it always takes as the name of
the link, never the directory in which to put the link.

Using this new flag:

```shell
$ ln -vfsT "$DOTFILE_FOLDER/nvim/" "$HOME/.config/nvim"
'/home/nobe4/.config/nvim' -> '/home/nobe4/dev/nobe4/dotfiles/nvim'

$ ls -la "$HOME/.config/nvim"
lrwxrwxrwx 1 nobe4 users 35 Feb  4 20:12 /home/nobe4/.config/nvim -> /home/nobe4/dev/nobe4/dotfiles/nvim
# all good!

# do some testing ...

$ ln -vfsT "$DOTFILE_FOLDER/nvim/" "$HOME/.config/nvim"
'/home/nobe4/.config/nvim' -> '/home/nobe4/dev/nobe4/dotfiles/nvim'
# looking good!

$ ls -la $DOTFILE_FOLDER/nvim/nvim
ls: cannot access '/home/nobe4/dev/nobe4/dotfiles/nvim/nvim': No such file or directory
# yeee
```

In a simplified form:

```shell
$ mkdir a
$ ln -vfsT a b
'b' -> 'a'
$ ln -vfsT a b
'b' -> 'a'
$ tree
.
├── a
└── b -> a
```

## The new test scenario

All the commands are ran with:

```shell
link () {
    ln --verbose --force --symbolic --no-target-directory "$(pwd)/${1:?}" "$(pwd)/${2:?}"
}
```

`$1` \ `$2` | �       | F       | D
---         | ---     | ---     | ---
�           | `0` ❌  | `14` ❌ | `28` 💥
�`/`        | `1` ❌  | `15` ❌ | `29` 💥
F           | `2` ✅  | `16` ✅ | `30` 💥
F`/`        | `3` ❌  | `17` ❌ | `31` 💥
D           | `4` ✅  | `18` ✅ | `32` 💥
D`/`        | `5` ✅  | `19` ✅ | `33` 💥
�FL         | `6` ❌  | `20` ❌ | `34` 💥
�FL`/`      | `7` ❌  | `21` ❌ | `35` 💥
FL          | `8` ✅  | `22` ✅ | `36` 💥
FL`/`       | `9` ❌  | `23` ❌ | `37` 💥
�DL         | `10` ❌ | `24` ❌ | `38` 💥
�DL`/`      | `11` ❌ | `25` ❌ | `39` 💥
DL          | `12` ✅ | `26` ✅ | `40` 💥
DL`/`       | `13` ✅ | `27` ✅ | `41` 💥

_Notes:_

- Results:
    - Same as before

    - 💥: The command fail with `Cannot overwrite directory`.

        This happens for the entire column, because the directory already exists
        and `ln` _does not_ override it if it's supposed to be a _normal file_.

        To get a valid link the full path must be specified, inside the
        directory.

        E.g.

        ```shell
        $ mkdir a b
        $ link a b
        ln: /tmp/ln/b: cannot overwrite directory
        $ link a b/a
        '/tmp/ln/b/a' -> '/tmp/ln/a'
        $ tree
        .
        ├── a
        └── b
            └── a -> /tmp/ln/a
        ```

<details>
<summary> Full test results </summary>

- `run.sh`

  ```patch
    link () {
  -    ln --verbose --force --symbolic "$(pwd)/${1:?}" "$(pwd)/${2:?}"
  +    ln --verbose --force --symbolic --no-target-directory "$(pwd)/${1:?}" "$(pwd)/${2:?}"
    }
  ```

- Output

    ```shell
    ### [0] ###: link a b
    '/tmp/ln/b' -> '/tmp/ln/a'
    .
    └── b -> /tmp/ln/a
    Broken link: ./b

    ### [1] ###: link a/ b
    '/tmp/ln/b' -> '/tmp/ln/a/'
    .
    └── b -> /tmp/ln/a/
    Broken link: ./b

    ### [2] ###: touch a && link a b
    '/tmp/ln/b' -> '/tmp/ln/a'
    .
    ├── a
    └── b -> /tmp/ln/a

    ### [3] ###: touch a && link a/ b
    '/tmp/ln/b' -> '/tmp/ln/a/'
    .
    ├── a
    └── b -> /tmp/ln/a/
    Broken link: ./b

    ### [4] ###: mkdir a && link a b
    '/tmp/ln/b' -> '/tmp/ln/a'
    .
    ├── a
    └── b -> /tmp/ln/a

    ### [5] ###: mkdir a && link a/ b
    '/tmp/ln/b' -> '/tmp/ln/a/'
    .
    ├── a
    └── b -> /tmp/ln/a/

    ### [6] ###: link a b && link b c
    '/tmp/ln/b' -> '/tmp/ln/a'
    '/tmp/ln/c' -> '/tmp/ln/b'
    .
    ├── b -> /tmp/ln/a
    └── c -> /tmp/ln/b
    Broken link: ./c
    Broken link: ./b

    ### [7] ###: link a b && link b/ c
    '/tmp/ln/b' -> '/tmp/ln/a'
    '/tmp/ln/c' -> '/tmp/ln/b/'
    .
    ├── b -> /tmp/ln/a
    └── c -> /tmp/ln/b/
    Broken link: ./c
    Broken link: ./b

    ### [8] ###: touch a && link a b && link b c
    '/tmp/ln/b' -> '/tmp/ln/a'
    '/tmp/ln/c' -> '/tmp/ln/b'
    .
    ├── a
    ├── b -> /tmp/ln/a
    └── c -> /tmp/ln/b

    ### [9] ###: touch a && link a b && link b/ c
    '/tmp/ln/b' -> '/tmp/ln/a'
    '/tmp/ln/c' -> '/tmp/ln/b/'
    .
    ├── a
    ├── b -> /tmp/ln/a
    └── c -> /tmp/ln/b/
    Broken link: ./c

    ### [10] ###: link a/ b && link b c
    '/tmp/ln/b' -> '/tmp/ln/a/'
    '/tmp/ln/c' -> '/tmp/ln/b'
    .
    ├── b -> /tmp/ln/a/
    └── c -> /tmp/ln/b
    Broken link: ./c
    Broken link: ./b

    ### [11] ###: link a/ b && link b/ c
    '/tmp/ln/b' -> '/tmp/ln/a/'
    '/tmp/ln/c' -> '/tmp/ln/b/'
    .
    ├── b -> /tmp/ln/a/
    └── c -> /tmp/ln/b/
    Broken link: ./c
    Broken link: ./b

    ### [12] ###: mkdir a && link a b && link b c
    '/tmp/ln/b' -> '/tmp/ln/a'
    '/tmp/ln/c' -> '/tmp/ln/b'
    .
    ├── a
    ├── b -> /tmp/ln/a
    └── c -> /tmp/ln/b

    ### [13] ###: mkdir a && link a b && link b/ c
    '/tmp/ln/b' -> '/tmp/ln/a'
    '/tmp/ln/c' -> '/tmp/ln/b/'
    .
    ├── a
    ├── b -> /tmp/ln/a
    └── c -> /tmp/ln/b/

    ### [14] ###: touch b && link a b
    '/tmp/ln/b' -> '/tmp/ln/a'
    .
    └── b -> /tmp/ln/a
    Broken link: ./b

    ### [15] ###: touch b && link a/ b
    '/tmp/ln/b' -> '/tmp/ln/a/'
    .
    └── b -> /tmp/ln/a/
    Broken link: ./b

    ### [16] ###: touch b && touch a && link a b
    '/tmp/ln/b' -> '/tmp/ln/a'
    .
    ├── a
    └── b -> /tmp/ln/a

    ### [17] ###: touch b && touch a && link a/ b
    '/tmp/ln/b' -> '/tmp/ln/a/'
    .
    ├── a
    └── b -> /tmp/ln/a/
    Broken link: ./b

    ### [18] ###: touch b && mkdir a && link a b
    '/tmp/ln/b' -> '/tmp/ln/a'
    .
    ├── a
    └── b -> /tmp/ln/a

    ### [19] ###: touch b && mkdir a && link a/ b
    '/tmp/ln/b' -> '/tmp/ln/a/'
    .
    ├── a
    └── b -> /tmp/ln/a/

    ### [20] ###: touch c && link a b && link b c
    '/tmp/ln/b' -> '/tmp/ln/a'
    '/tmp/ln/c' -> '/tmp/ln/b'
    .
    ├── b -> /tmp/ln/a
    └── c -> /tmp/ln/b
    Broken link: ./c
    Broken link: ./b

    ### [21] ###: touch c && link a b && link b/ c
    '/tmp/ln/b' -> '/tmp/ln/a'
    '/tmp/ln/c' -> '/tmp/ln/b/'
    .
    ├── b -> /tmp/ln/a
    └── c -> /tmp/ln/b/
    Broken link: ./c
    Broken link: ./b

    ### [22] ###: touch c && touch a && link a b && link b c
    '/tmp/ln/b' -> '/tmp/ln/a'
    '/tmp/ln/c' -> '/tmp/ln/b'
    .
    ├── a
    ├── b -> /tmp/ln/a
    └── c -> /tmp/ln/b

    ### [23] ###: touch c && touch a && link a b && link b/ c
    '/tmp/ln/b' -> '/tmp/ln/a'
    '/tmp/ln/c' -> '/tmp/ln/b/'
    .
    ├── a
    ├── b -> /tmp/ln/a
    └── c -> /tmp/ln/b/
    Broken link: ./c

    ### [24] ###: touch c && link a/ b && link b c
    '/tmp/ln/b' -> '/tmp/ln/a/'
    '/tmp/ln/c' -> '/tmp/ln/b'
    .
    ├── b -> /tmp/ln/a/
    └── c -> /tmp/ln/b
    Broken link: ./c
    Broken link: ./b

    ### [25] ###: touch c && link a/ b && link b/ c
    '/tmp/ln/b' -> '/tmp/ln/a/'
    '/tmp/ln/c' -> '/tmp/ln/b/'
    .
    ├── b -> /tmp/ln/a/
    └── c -> /tmp/ln/b/
    Broken link: ./c
    Broken link: ./b

    ### [26] ###: touch c && mkdir a && link a b && link b c
    '/tmp/ln/b' -> '/tmp/ln/a'
    '/tmp/ln/c' -> '/tmp/ln/b'
    .
    ├── a
    ├── b -> /tmp/ln/a
    └── c -> /tmp/ln/b

    ### [27] ###: touch c && mkdir a && link a b && link b/ c
    '/tmp/ln/b' -> '/tmp/ln/a'
    '/tmp/ln/c' -> '/tmp/ln/b/'
    .
    ├── a
    ├── b -> /tmp/ln/a
    └── c -> /tmp/ln/b/

    ### [28] ###: mkdir b && link a b
    ln: /tmp/ln/b: cannot overwrite directory
    .
    └── b

    ### [29] ###: mkdir b && link a/ b
    ln: /tmp/ln/b: cannot overwrite directory
    .
    └── b

    ### [30] ###: mkdir b && touch a && link a b
    ln: /tmp/ln/b: cannot overwrite directory
    .
    ├── a
    └── b

    ### [31] ###: mkdir b && touch a && link a/ b
    ln: /tmp/ln/b: cannot overwrite directory
    .
    ├── a
    └── b

    ### [32] ###: mkdir b && mkdir a && link a b
    ln: /tmp/ln/b: cannot overwrite directory
    .
    ├── a
    └── b

    ### [33] ###: mkdir b && mkdir a && link a/ b
    ln: /tmp/ln/b: cannot overwrite directory
    .
    ├── a
    └── b

    ### [34] ###: mkdir c && link a b && link b c
    '/tmp/ln/b' -> '/tmp/ln/a'
    ln: /tmp/ln/c: cannot overwrite directory
    .
    ├── b -> /tmp/ln/a
    └── c
    Broken link: ./b

    ### [35] ###: mkdir c && link a b && link b/ c
    '/tmp/ln/b' -> '/tmp/ln/a'
    ln: /tmp/ln/c: cannot overwrite directory
    .
    ├── b -> /tmp/ln/a
    └── c
    Broken link: ./b

    ### [36] ###: mkdir c && touch a && link a b && link b c
    '/tmp/ln/b' -> '/tmp/ln/a'
    ln: /tmp/ln/c: cannot overwrite directory
    .
    ├── a
    ├── b -> /tmp/ln/a
    └── c

    ### [37] ###: mkdir c && touch a && link a b && link b/ c
    '/tmp/ln/b' -> '/tmp/ln/a'
    ln: /tmp/ln/c: cannot overwrite directory
    .
    ├── a
    ├── b -> /tmp/ln/a
    └── c

    ### [38] ###: mkdir c && link a/ b && link b c
    '/tmp/ln/b' -> '/tmp/ln/a/'
    ln: /tmp/ln/c: cannot overwrite directory
    .
    ├── b -> /tmp/ln/a/
    └── c
    Broken link: ./b

    ### [39] ###: mkdir c && link a/ b && link b/ c
    '/tmp/ln/b' -> '/tmp/ln/a/'
    ln: /tmp/ln/c: cannot overwrite directory
    .
    ├── b -> /tmp/ln/a/
    └── c
    Broken link: ./b

    ### [40] ###: mkdir c && mkdir a && link a b && link b c
    '/tmp/ln/b' -> '/tmp/ln/a'
    ln: /tmp/ln/c: cannot overwrite directory
    .
    ├── a
    ├── b -> /tmp/ln/a
    └── c

    ### [41] ###: mkdir c && mkdir a && link a b && link b/ c
    '/tmp/ln/b' -> '/tmp/ln/a'
    ln: /tmp/ln/c: cannot overwrite directory
    .
    ├── a
    ├── b -> /tmp/ln/a
    └── c
    ```

</details>

# Conclusion

`-T`'s behavior reminds me a lot of the JavaScript's `===`: it's the most
logical to me, and yet not the default behavior.

But also, _RTFM_.
