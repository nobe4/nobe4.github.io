---
layout: post
title:  "Building Emmet Show"
date:   2015-07-03
categories: vim plugin
---

Before using Vim, I used Sublime Text 2/3. On Sublime, there was a plugin which made me love this editor (until I found out that the plugin was not Sublime-only).

[Emmet](http://emmet.io/) (formally Zen-Coding) speeds up the html creation with a css-like syntax.

On Vim, a plugin for emmet exists : [emmet-vim](https://github.com/mattn/emmet-vim).

But I allways had this workflow when trying to create _the_ pattern that do whatever I want : 

1. write a pattern
2. expand
3. undo the expand, go back to 1 and repeat

So I thought maybe we can speed up the workflow by creating a plugin. 

(spoiler : this is my first Vim plugin)

## What should I do ?
To speed up I want to show in real time the expand when editing the pattern. I need a few things :

* create a new buffer
* detect the insert change
* expand the pattern
* save the pattern

## The New Buffer
To create a new buffer in Vimscript it is as simple as `new`.

For display purpose, I add a `set ft=html` to enable syntax color.

## buffer.on('insertChange')
To detect a change on insert I used an autocommand that match the event `CursorMovedI` only for this buffer.

There is a lot of event I could use (see `:h autocommand-events`), but this one works perfectly.

When this event is triggered it will calls a custom function that will display the emmet expand.

{% highlight vim %}
autocmd CursorMovedI <buffer> :call EmmetAutoShow()
{% endhighlight %}

## Expand The Pattern
This is the tricky part. I wasn't really sure how to do this. But here is what I came up with : 

Save the current cursor position and duplicate the current line : `normal mayyp`.

If there are more than two lines, remove from the 3rd one to the end of the file. This delete the previous expand.

{% highlight vim %}
if line('$') > 2
  :3,$:d
endif
{% endhighlight %}

At the end of the deletion I am on the 2nd line. To expand the pattern I need to go to the end of the line : `normal $`.

Now on emmet triggering, there are multiple way of extending the pattern as shown [here](https://github.com/mattn/emmet-vim/blob/master/plugin/emmet.vim#L100-L134).

The one I need is an expand from normal mode, the line that seems appropriate is : 

{% highlight vim %}
\ {'mode': 'n', 'var': 'user_emmet_expandabbr_key', 'key': ',', 'plug': 'emmet-expand-abbr', 'func': ':call emmet#expandAbbr(3,"")<cr>'},
{% endhighlight %}

I copied the `'func'`, removed the `:` and the `<cr>` (they are not needed in a script) and it worked instantly.

Finally, I can go back to the previous position (saved in the mark a) with `` `a``.

But at this point I am in normal mode so I need to go back in insert mode. I do this with `startinsert!`.


