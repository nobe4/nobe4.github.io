---
layout: post
title: "Vim Syntax Generator"
modified: 10 Nov 2015
categories: posts
description: 'How to create a dynamicly generated Vim syntax file'
tags: [Vim, syntax]
image:
  feature: posts/vim-syntax-generator/presentation.png
  credit:
  creditlink:
comments: true
share: true
date: 2015-11-10T23:34:48+01:00
---

> When you feel like knowing all this syntax stuff, perhaps write a blog post ;)

I may not know everything about the syntax mechanisms in Vim, but at least I'll share what I understood building a syntax file generator.

**TL;DR:** How I created a syntax file generator for displaying StackExchange API values.

The purpose of the code explained below was to interface with a plugin a friend and I were writing at a time. This plugin displayed results from StackExchange API  calls using a user defined formatting. In this blog post I will focus only on the rendering part of the process.

# Defining the datas

There are 4 data types used to build up the syntax file and to display the information: 

- A set of datas (e.g. [questions from StackOverflow](https://api.stackexchange.com/2.2/questions?order=desc&sort=activity&site=stackoverflow)),
- A formatting string, that represent how the user wants the informations to be displayed,
- A map to match the informations and the user formatting string,
- A syntax formatting option.

## Dataset

The StackExchange API produce a dataset that is well defined, I can extract the following informations from it: 

{% highlight JSON %}
[ 
  {
    "answer_count": 1,
    "creation_date": 1441047662,
    "is_answered": false,
    "last_activity_date": 1441047900,
    "link": "http://thelink",
    "owner": {
      "display_name": "John Doe",
      "reputation": 2278,
      "user_id": 237115,
    },
    "question_id": 32318151,
    "score": 0,
    "tags": ["javascript", "nodejs", "html5"],
    "title": "the title",
    "view_count": 7
  }
]
{% endhighlight %}

## Formatting String

The user should be able to select the informations he wants and the order/styling he wants. For example, I defined the syntax as follow:

{% highlight vim %}
let g:questions_format="{title}\n
        \[{score}][{answers}][{views}]\n
        \Created {creation} (Modified {last_activity})\n
        \By {owner} {reputation}rep\n
        \{tags}\n\n"
{% endhighlight %}

## Mapping

I can make a relation between the datas and the formatting string. I could use the JSON key as is, but instead I wanted to be able to manipulate the data a little more, hence the current mapping:

{% highlight vim %}
let s:map = {
      \ 'title':         'title',
      \ 'answers':       'answer_count',
      \ 'creation':      {'function' : 'GetDiffDate', 'param' : 'creation_date'},
      \ 'last_activity': {'function' : 'GetDiffDate', 'param' : 'last_activity_date'},
      \ 'tags':          {'function' : 'GetTagsFromList', 'param' : 'tags' },
      \ 'score':         'score',
      \ 'views':         'view_count',
      \ 'id':            'question_id',
      \ 'owner':         ['owner', 'display_name'],
      \ 'reputation':    ['owner', 'reputation']
      \ }
{% endhighlight %}

Some keys remains unchanged, but on others, I change the name or add functionalities, I will see them later on.

## Syntax Format

This format is based on the mapping, but add syntax only functionalities:

{% highlight vim %}
let s:syntax_rules={
      \ "question": {
      \   "id":            { "link" : "Ignore" },
      \   "title":         { "link" : "Tag",        "show" : 1, "matchgroup" : 1},
      \   "score":         { "link" : "Function",   "show" : 1, "matchgroup" : 1},
      \   "answers":       { "link" : "Constant",   "show" : 1, "matchgroup" : 1},
      \   "views":         { "link" : "Identifier", "show" : 1, "matchgroup" : 1},
      \   "creation":      { "link" : "Include",    "show" : 1, "matchgroup" : 1},
      \   "last_activity": { "link" : "Underlined", "show" : 1, "matchgroup" : 1},
      \   "owner":         { "link" : "Structure",  "show" : 1, "matchgroup" : 1},
      \   "reputation":    { "link" : "Special",    "show" : 1, "matchgroup" : 1},
      \   "tags":          { "link" : "Error",      "show" : 1, "matchgroup" : 1},
      \  }
      \ }
{% endhighlight %}

We will see the defined options in the next part, but the main comment I can say is that each key defined in the mapping object will have display options through the syntax.


# Workflow

Here is how the data is handled:

- I build the content from the parsed formatting string and the dataset
- I add the content in a buffer
- I set the syntax of this buffer (this will trigger the syntax auto-generation)

# Building The Content

This step uses the datas and the formatting string to create the formatted dataset that will be displayed.

## Main Function

{% highlight vim %}
let l:content = []
  for l:item in a:items
  let l:description = <SID>SubstituteMap(a:group_name, a:format, l:item, a:map)
    call add(l:content, l:description)
  endfor
return l:content
{% endhighlight %}

I fill the `l:content` array with all _lines_ of formatted datas.

## SubstituteMap

The `SubstituteMap` is defined as follow:

{% highlight vim %}
function! s:SubstituteMap(group_name, format, item, map) abort
  let l:format = a:format
  for [l:key, l:value] in items(a:map)
    if type("string") == type(l:value)
      let l:format = substitute(l:format,
            \ '{'.l:key.'}',
            \ <SID>WrapValue(a:group_name, l:key, a:item[l:value]), '')
    elseif type({}) == type(l:value)
      let l:format = substitute(l:format,
            \ '{'.l:key.'}',
            \ <SID>WrapValue(a:group_name, l:key,
            \   call('<SID>'.l:value['function'],
            \        [a:item[l:value['param']]]))
            \ ,'')
    elseif type([]) == type(l:value)
      let l:format = substitute(l:format,
            \ '{'.l:key.'}',
            \ <SID>WrapValue(a:group_name, l:key,
            \     a:item[l:value[0]][l:value[1]])
            \ , '')
    endif
    unlet l:value
  endfor
  return l:format
endfunction
{% endhighlight %}

Let's break this down:

{% highlight vim %}
  let l:format = a:format
  for [l:key, l:value] in items(a:map)
    " ...
    unlet l:value
  endfor
  return l:format
{% endhighlight %}

I process each items of the `a:map` map, note that the l:value type may change (`"string"`, `{object}`, or `[array]`) so I make sure I `unlet` the value before the next iteration).

Next I have the 3 cases of type for `l:value`.

### String
{% highlight vim %}
if type("string") == type(l:value)
  let l:format = substitute(l:format,
        \ '{'.l:key.'}',
        \ <SID>WrapValue(a:group_name, l:key, a:item[l:value]), '')
{% endhighlight %}

This is pretty straightforward: I replace in the `l:format` string the `{key}` block with some value (I will explain the `WrapValue` function just after).

### Object
{% highlight vim %}
elseif type({}) == type(l:value)
  let l:format = substitute(l:format,
        \ '{'.l:key.'}',
        \ <SID>WrapValue(a:group_name, l:key,
        \   call('<SID>'.l:value['function'],
        \        [a:item[l:value['param']]]))
        \ ,'')
{% endhighlight %}

Remember a sample mapping: 
{% highlight vim %}
'last_activity': { 
    'function' : 'GetDiffDate', 
    'param' : 'last_activity_date'
}
{% endhighlight %}

I defined a function named `GetDiffDate` that calcul the difference between a timestamps and the current timestamps.

I am also replacing in the `l:format` string, I have a custom `call` :
{% highlight vim %}
call('<SID>'.l:value['function'], [a:item[l:value['param']]])
{% endhighlight %}

This call the function named in the object and pass as argument the value of the item defined in the object. 

With the previous values, the function call will be:
{% highlight vim%}
call <SID>GetDiffDate(a:item['last_activity_date'])
{% endhighlight %}

### Array
{% highlight vim %}
elseif type([]) == type(l:value)
  let l:format = substitute(l:format,
        \ '{'.l:key.'}',
        \ <SID>WrapValue(a:group_name, l:key,
        \     a:item[l:value[0]][l:value[1]])
        \ , '')
{% endhighlight %}

You can guess what this part does by looking again at the mapping: 

{% highlight vim %}
'owner': ['owner', 'display_name']
{% endhighlight %}

This will take the following value from the dataset: 
{% highlight vim %}
a:item['owner']['display_name']
{% endhighlight %}

### WrapValue
This function is wrapping the value inside custom defined blocks to enhance the syntax: 

{% highlight vim %}
function! s:WrapValue(group, key, value) abort
  return '{'.a:group.'_'.a:key.'}'.a:value.'{/'.a:group.'_'.a:key.'}'
endfunction
{% endhighlight %}

The group is `questions` in this example, so a generated example will be:

{% highlight vim %}
return '{questions_title}The Title{/questions_title}';
{% endhighlight %}

# Inserting the content

This part will be quicker, as it is not our main concern. For each generated line, I append it inside a buffer, splitting all lines by `\n`.
{% highlight vim %}
for l:line in a:lines
  call append(0, split(l:line, '\n'))
endfor
setlocal syntax=customsyntax
setlocal concealcursor=n
{% endhighlight %}

Now I set the syntax to be our custom defined syntax and to conceal the cursor to normal mode (more on this later on).

# Generating The Syntax

Creating a syntax on Vim is quite a journey, doing it automatically is interesting and this is what we will see here.

We will only see three part of the syntax: clearing, defining, linking. Even if there is more to see (`:h syntax`).

## Introduction On Syntax
I will try to introduce as clearly as possible the few concepts behind Vim's syntax that we will use.

Setting a syntax with `:syntax enable` or `:syntax on` does multiple things (`:h syntax-loading`):

- Clear all previous syntax,
- Source a color palette for the currently chosen colorscheme,
- Source any filetype.

You can put anything in the filetype, any valid `ex` command (just like in you `.vimrc`). The file will be sourced and will apply it modifications to the current buffer.

There are multiple types of syntax items (`:h :syn-define`):

- Keyword: simple word,
- Match:   regex match,
- Region:  match between a `start` and an `end` pattern.

I defined a syntax that will suit the region item: `{start}value{/end}`, so this is what I will be using.

The last part is highlight the matched syntax item. You can define your own background/foreground color or link the group to an existing one (`:h group-name`).

There is a mechanism that really fascinates me when I understood what can be made with: `conceal`.
Conceals means that a part of the region will be hidden or replaced. The texte is still in the file (you don't replace anything, it is only a display setting) but you can render otherwise.

As an example of this you can take a look at the [lambdify](https://github.com/calebsmith/vim-lambdify) plugin that displays `λ` instead of `function`. The `function` is still here (the file will be valid) but you see a lambda instead.

In our case, we want to display only the content of the region (and not the enclosing pattern), or to hide completely the content.


## Syntax Rules
In my syntax rules mapping I defined some options to render the items:

{% highlight vim %}
let rule = { 
  \ "show" : 1,         " Shoud the item appears ?
  \ "link" : "Tag",     " Highlight linking category
  \ "matchgroup" : 1    " Capture the matchgroup
}
{% endhighlight %}

There are two basic cases: an element we want on screen, and an element hidden (but still in the buffer).
Keeping datas in the buffer without displaying them can be usefull for further reference to an item (for example, hidding his `id`).

## Defining The Regions
Based on the two cases, I defined a function that create the two possible syntax region definitions:

{% highlight vim %}
syntax region QuestionId start="{id}" end="{/id}" conceal
syntax region QuestionTitle matchgroup=QuestionTitleWrapper start="{tite}" end="{/title}" concealends
{% endhighlight %}

The function simply takes the rule and expand it into the proper format. For each field in the rule, add the corresponding part of the syntax:

{% highlight vim %}
let l:syntax_string = "syntax region"
let l:syntax_string .= " ".a:group_name
if(has_key(a:properties, 'matchgroup'))
  let l:syntax_string .= " matchgroup=".a:group_name."_wrapper"
endif
let l:syntax_string .= " start='{".a:group_name."}' end='{/".a:group_name."}'"
if(has_key(a:properties, 'show'))
  let l:syntax_string .= " concealends"
else
  let l:syntax_string .= " conceal"
endif
exec l:syntax_string
{% endhighlight %}

## Linking the region to a highlight group
We can define a set of colors for every one of our syntax region, but for the seek of this example I decided to reuse the existing color groups.

You can see all the defined syntax-group in the documentation: `:h group-name`. Thus, it is only a matter of taste to chose which color goes to which group.

The linkin is pretty straightforward:

{% highlight vim %}
exec 'highlight link '.a:group_name.' '.a:link_name
{% endhighlight %}

# Result !

Here is the fecthed result without the syntax :


<style type="text/css">
<!--
#vimCodeElement { font-family: monospace; color: #ffd7af; background-color: #262626; }
#vimCodeElement .LineNr { color: #767676; }
-->
</style>

<pre id='vimCodeElement'>
<span id="L1" class="LineNr">  1 </span>{question_id}32318063{/question_id}{question_title}Remove empty list tags in apache cxf (camel){/question_title}
<span id="L2" class="LineNr">  2 </span>[{question_score}0{/question_score}][{question_answers}0{/question_answers}][{question_views}2{/question_views}]
<span id="L3" class="LineNr">  3 </span>Created {question_creation}31 Aug{/question_creation} (Modified {question_last_activity}31 Aug{/question_last_activity})
<span id="L4" class="LineNr">  4 </span>By {question_owner}Bart{/question_owner} {question_reputation}126{/question_reputation}rep
<span id="L5" class="LineNr">  5 </span>{question_tags}[cxf-codegen-plugin]{/question_tags}
<span id="L6" class="LineNr">  6 </span>
<span id="L7" class="LineNr">  7 </span>{question_id}32317186{/question_id}{question_title}Reference to a Method in a Package{/question_title}
<span id="L8" class="LineNr">  8 </span>[{question_score}1{/question_score}][{question_answers}3{/question_answers}][{question_views}22{/question_views}]
<span id="L9" class="LineNr">  9 </span>Created {question_creation}31 Aug{/question_creation} (Modified {question_last_activity}31 Aug{/question_last_activity})
<span id="L10" class="LineNr"> 10 </span>By {question_owner}Sammy Esmail{/question_owner} {question_reputation}21{/question_reputation}rep
<span id="L11" class="LineNr"> 11 </span>{question_tags}[dispatch]{/question_tags}
<span id="L12" class="LineNr"> 12 </span>
<span id="L13" class="LineNr"> 13 </span>{question_id}11786310{/question_id}{question_title}Incorporating External Html into a jQuery Mobile page{/question_title}
<span id="L14" class="LineNr"> 14 </span>[{question_score}2{/question_score}][{question_answers}2{/question_answers}][{question_views}7835{/question_views}]
<span id="L15" class="LineNr"> 15 </span>Created {question_creation}02 Aug{/question_creation} (Modified {question_last_activity}31 Aug{/question_last_activity})
<span id="L16" class="LineNr"> 16 </span>By {question_owner}Ben Pearce{/question_owner} {question_reputation}1240{/question_reputation}rep
<span id="L17" class="LineNr"> 17 </span>{question_tags}[inject]{/question_tags}
<span id="L18" class="LineNr"> 18 </span>
<span id="L19" class="LineNr"> 19 </span>{question_id}32317251{/question_id}{question_title}Plotting random point on Function - Pandas{/question_title}
<span id="L20" class="LineNr"> 20 </span>[{question_score}0{/question_score}][{question_answers}3{/question_answers}][{question_views}14{/question_views}]
<span id="L21" class="LineNr"> 21 </span>Created {question_creation}31 Aug{/question_creation} (Modified {question_last_activity}31 Aug{/question_last_activity})
<span id="L22" class="LineNr"> 22 </span>By {question_owner}Nicky Feller{/question_owner} {question_reputation}52{/question_reputation}rep
<span id="L23" class="LineNr"> 23 </span>{question_tags}[ipython]{/question_tags}
<span id="L24" class="LineNr"> 24 </span> ...
</pre>



`:set syntax=mysyntax`


<style type="text/css">
<!--
#vimCodeElement { font-family: monospace; color: #ffd7af; background-color: #262626; }
#vimCodeElement .Function { color: #afaf00; font-weight: bold; }
#vimCodeElement .Error { color: #262626; background-color: #d75f5f; padding-bottom: 1px; font-weight: bold; }
#vimCodeElement .Underlined { color: #87afaf; text-decoration: underline; }
#vimCodeElement .Include { color: #87af87; }
#vimCodeElement .LineNr { color: #767676; }
#vimCodeElement .Constant { color: #d787af; }
#vimCodeElement .Special { color: #ff8700; }
#vimCodeElement .Identifier { color: #87afaf; }
#vimCodeElement .Structure { color: #87af87; }
-->
</style>
<pre id='vimCodeElement'>
<span id="L1" class="LineNr">  1 </span><span class="Special">Remove empty list tags in apache cxf (camel)</span>
<span id="L2" class="LineNr">  2 </span>[<span class="Function">0</span>][<span class="Constant">0</span>][<span class="Identifier">2</span>]
<span id="L3" class="LineNr">  3 </span>Created <span class="Include">31 Aug</span> (Modified <span class="Underlined">31 Aug</span>)
<span id="L4" class="LineNr">  4 </span>By <span class="Structure">Bart</span> <span class="Special">126</span>rep
<span id="L5" class="LineNr">  5 </span><span class="Error">[cxf-codegen-plugin]</span>
<span id="L6" class="LineNr">  6 </span>
<span id="L7" class="LineNr">  7 </span><span class="Special">Reference to a Method in a Package</span>
<span id="L8" class="LineNr">  8 </span>[<span class="Function">1</span>][<span class="Constant">3</span>][<span class="Identifier">22</span>]
<span id="L9" class="LineNr">  9 </span>Created <span class="Include">31 Aug</span> (Modified <span class="Underlined">31 Aug</span>)
<span id="L10" class="LineNr"> 10 </span>By <span class="Structure">Sammy Esmail</span> <span class="Special">21</span>rep
<span id="L11" class="LineNr"> 11 </span><span class="Error">[dispatch]</span>
<span id="L12" class="LineNr"> 12 </span>
<span id="L13" class="LineNr"> 13 </span><span class="Special">Incorporating External Html into a jQuery Mobile page</span>
<span id="L14" class="LineNr"> 14 </span>[<span class="Function">2</span>][<span class="Constant">2</span>][<span class="Identifier">7835</span>]
<span id="L15" class="LineNr"> 15 </span>Created <span class="Include">02 Aug</span> (Modified <span class="Underlined">31 Aug</span>)
<span id="L16" class="LineNr"> 16 </span>By <span class="Structure">Ben Pearce</span> <span class="Special">1240</span>rep
<span id="L17" class="LineNr"> 17 </span><span class="Error">[inject]</span>
<span id="L18" class="LineNr"> 18 </span>
<span id="L19" class="LineNr"> 19 </span><span class="Special">Plotting random point on Function - Pandas</span>
<span id="L20" class="LineNr"> 20 </span>[<span class="Function">0</span>][<span class="Constant">3</span>][<span class="Identifier">14</span>]
<span id="L21" class="LineNr"> 21 </span>Created <span class="Include">31 Aug</span> (Modified <span class="Underlined">31 Aug</span>)
<span id="L22" class="LineNr"> 22 </span>By <span class="Structure">Nicky Feller</span> <span class="Special">52</span>rep
<span id="L23" class="LineNr"> 23 </span><span class="Error">[ipython]</span>
<span id="L24" class="LineNr"> 24 </span> ...
</pre>

And there you go, you have a fully customizable syntax and highlight generator. Here you can see the result with [the colorscheme I use](https://github.com/morhetz/gruvbox) generated directly within vim: `:TOhtml`.

# Conclusion

I played a lot with Vim to build this little piece of code, but yet I didn't scratch the surface of all the Vim syntax can offer.

