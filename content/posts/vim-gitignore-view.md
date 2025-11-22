+++
title = 'Vim Gitignore view'
description = 'How to test gitignore patterns'
date = 2016-03-06
tags = ["technology"]
+++

# Introduction

One workflow I came across a lot during my programing days is the following:

```bash
git status
vi .gitignore
# [Edition ...]
git status
vi .gitignore
# [Edition ...]
git status
git commit
```

I don't usually create the best gitignore pattern on the first time, so I need to test multiple times for correctness.

> Wait, that seems to be a lot of repetition ! Let's create a vim plugin !

# Git ignore

To check which files are considered by Vim, you can use the `git ls-files` command.

The options that interest us are:

- `--others`: show files that are not tracked by git
- `--ignored`: show only ignored files
- `--exclude-from=<file>`: read the exclude patterns from the `<file>`

e.g.

```bash
$ git ls-file --others --ignored --exclude-from=.gitignore
```

This will show all files normally excluded by git, as we read the exclude patterns from the `.gitignore` file.

# Plugin organisation

The plugin is straightforward and runs as follow:

- Open a new buffer
- Export the first line as the excluded pattern
- Insert the excluded files list in the buffer

We choose to create a file in the `/tmp` folder and to read/write from here. The file path is stored in the `s:gitignore_file` variable.

## Write the pattern

This part is simple as vim provides us the `getline` function that fetchs the line in the current buffer.

To write it to the gitignore file, we can use the common `echo` method from bash along with the operator `>` to override the file.

```vim
let l:line = getline(1)
let l:export_command = "echo '".l:line."' > ".s:gitignore_file
call system(l:export_command)
```

**Note**: at first I didn't put enclosing `''` to the content of the line. But in zsh, some patterns expanded before writing to the file. e.g. `*` expanded to all file in the current folder.

## Read the excluded files

To read an external command, vim has multiple solutions. I tried to use the `:read!` command but I found out the `:systemlist` was better for my case.

The `systemlist` command runs a system command and returns its output as a list, whereas the `system` command returns it as a string. It's more practical to this case because we will get a list of files.

Then to insert it in the document, the `setline` command can take a list as second argument (the content to be inserted), it's exactly what we need. We can now insert the files at the second line to refresh the document.

```vim
let l:gitignore_command = 'git ls-files --others --ignored --exclude-from='.s:gitignore_file
let l:result = systemlist(l:gitignore_command)
call setline(2, l:result)
```

## Clear the file

The last step we need to complete the plugin is to clear the file between reload. The main issue here is to do so without moving the cursor.

The simplest solution is `:2,$d`, but it changes the cursor position. Instead, we can use the `setline` command to set blank lines to all lines. Then when inserting the new excluded files, we may have blank line at the end of the file, but at least the cursor don't move.

To do so we build an array of empty strings to be inserted on all lines from the second line to the last one and insert it with `setline`.

```vim
let l:current_line = 1
let l:last_line = line('$')
let l:reset_lines = []

while l:current_line < l:last_line
  let l:reset_lines += ['']
  let l:current_line += 1
endwhile

call setline(2, l:reset_lines)
```

## Improvements

I already saw some improvements I could make to speed up the process. Building only one array, adding the existing gitignore option to prevent matching files already excluded, ... I will consider adding them later.

# Result

You can check an example of use here:

[![asciicast](https://asciinema.org/a/8mk6yk5r6q9rcr6dze3e2ops8.png)](https://asciinema.org/a/8mk6yk5r6q9rcr6dze3e2ops8)

Please feel free to leave a comment or go see the project on [github](https://github.com/nobe4/gitignore_view/)
