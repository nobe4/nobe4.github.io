+++
title = 'When Go user.Lookup fails'
date = 2026-06-11
tags = ["tech", "work"]
references = [
    "https://sssd.io/troubleshooting/basics.html",
]
+++

A Docker base image bump turned into a multi-day debug of Go's `os/user`
package, NSS, SSSD, LDAP and GLIBC ABI. Here is what happened and what I
learned.

Throughout this post, `alice` is an admin account with a hardcoded entry in
`/etc/passwd`, and `bob` is a regular user who only exists in the central LDAP
directory. All details of `/bin/client` are fictitious for the purpose of this
post.

## How it started: GLIBC errors

After deploying a routine docker update, users started seeing errors:

```shell
/bin/client: /lib/x86_64-linux-gnu/libc.so.6: version 'GLIBC_2.34' not found (required by /bin/client)
/bin/client: /lib/x86_64-linux-gnu/libc.so.6: version 'GLIBC_2.32' not found (required by /bin/client)
/bin/client failed: exit code 1
```

Go's CGO build links against the libc on the build host and embeds versioned
symbols. The resulting binary refuses to run on a target with older libc.

To check what the host ships:

```shell
$ strings /lib/x86_64-linux-gnu/libc.so.6 | grep '^GLIBC_'
GLIBC_2.2.5
...
GLIBC_2.30
GLIBC_PRIVATE

$ ldd --version
ldd (Ubuntu GLIBC 2.31-0ubuntu9.18+esm1) 2.31
```

The max symbol on the host is `GLIBC_2.30` but the binary asks for `GLIBC_2.32`
and `GLIBC_2.34`.

My first instinct was to rebuild with `CGO_ENABLED=0` to get a fully static,
libc-free binary. This is when the real fun started.

## The second bug: `user: unknown user bob`

With the static binary deployed, the client failed in a new way:

```
user: unknown user bob
```

The offending code is a one-liner calling Go's stdlib:

```go
if _, err := user.Lookup(name); err != nil { return err }
```

But... the user exists on the host:

```shell
$ id bob
uid=2222(bob) gid=100(users) groups=100(users)
```

## Reproducing the behavior

I wrote a tiny Go program to bisect the behaviour:

```go
package main

import (
    "fmt"
    "os/user"
)

func main() {
    fmt.Println(user.Lookup("alice"))
    fmt.Println(user.Lookup("bob"))
    fmt.Println(user.Lookup("must-not-exist"))
}
```

- Building on the host, with CGO on:

  ```shell
  $ CGO_ENABLED=1 go build main.go && ./main
  &{1111 100 alice alice /home/alice} <nil>
  &{2222 100 bob bob /home/bob} <nil>
  <nil> user: unknown user must-not-exist
  ```

  Both real users found.

- Building on the host, with CGO off:

  ```shell
  $ CGO_ENABLED=0 go build main.go && ./main
  &{1111 100 alice alice /home/alice} <nil>
  <nil> user: unknown user bob
  <nil> user: unknown user must-not-exist
  ```

  Suddenly, `bob` vanished.

## When `os/user` diverges

Straight from the [Go docs]:

> For most Unix systems, this package has two internal implementations of
> resolving user and group ids to names, and listing supplementary group IDs.
> One is written in pure Go and parses /etc/passwd and /etc/group. The other is
> cgo-based and relies on the standard C library (libc) routines such as
> getpwuid_r, getgrnam_r, and getgrouplist.
>
> When cgo is available, and the required routines are implemented in libc for a
> particular platform, cgo-based (libc-backed) code is used. This can be
> overridden by using osusergo build tag, which enforces the pure Go
> implementation.

So "pure Go vs libc" is not a small detail. They look at different data sources.

### Pure-Go path: just `/etc/passwd`

The [non-cgo path] is essentially:

```go
f, err := os.Open("/etc/passwd")
if err != nil {
    return nil, err
}
defer f.Close()
return findUsername(username, f)
```

`strace` confirms:

```shell
$ strace -e openat,write ./main
openat(AT_FDCWD, "/etc/passwd", O_RDONLY|O_CLOEXEC) = 3
write(1, "&{1111 100 alice alice /home/alice} <nil>\n", 43)
openat(AT_FDCWD, "/etc/passwd", O_RDONLY|O_CLOEXEC) = 3
write(1, "<nil> user: unknown user bob\n", 32)
```

On this host, `/etc/passwd` only holds a handful of admin accounts:

```shell
$ grep alice /etc/passwd
alice:x:1111:100:alice,,,:/home/alice:/bin/bash

$ grep bob /etc/passwd
# nothing
```

That is the asymmetry. One user is hardcoded, the other only exists in the
central LDAP directory.

### CGO path: `getpwnam_r` → NSS → SSSD → LDAP

The [cgo path] [calls] `getpwnam_r`:

```go
func lookupUser(username string) (*User, error) {
    // ...
    err := retryWithBuffer(userBuffer, func(buf []byte) syscall.Errno {
        var errno syscall.Errno
        pwd, found, errno = _C_getpwnam_r((*_C_char)(unsafe.Pointer(&nameC[0])), (*_C_char)(unsafe.Pointer(&buf[0])), _C_size_t(len(buf)))
        return errno
    })
    // ...
}
```

[`getpwnam_r`] reads [`nsswitch.conf`] and walks the chain of [NSS] modules:

```shell
$ grep passwd /etc/nsswitch.conf
passwd:         compat sss
```

- `compat` is the classic NSS module that reads `/etc/passwd`.
- `sss` is the SSSD module, configured to use extra authentication methods.

You can watch the chain at work with [`getent`], a CLI tool that queries NSS the
same way `getpwnam_r` does:

```shell
$ strace -e openat getent passwd alice
openat(AT_FDCWD, "/etc/nsswitch.conf", O_RDONLY|O_CLOEXEC) = 3
openat(AT_FDCWD, "/etc/passwd", O_RDONLY|O_CLOEXEC) = 3
# found in /etc/passwd -> stop
alice:x:1111:100:alice,,,:/home/alice:/bin/bash

$ strace -e openat getent passwd bob
openat(AT_FDCWD, "/etc/nsswitch.conf", O_RDONLY|O_CLOEXEC) = 3
openat(AT_FDCWD, "/etc/passwd", O_RDONLY|O_CLOEXEC) = 3
# not found, fall through to next NSS module
openat(AT_FDCWD, "/var/lib/sss/mc/passwd", O_RDONLY|O_CLOEXEC) = 3
bob:*:2222:100:bob:/home/bob:/bin/bash
```

`/var/lib/sss/mc/passwd` is SSSD's memory cache file. The lookup did
`/etc/passwd` (miss) → SSSD cache (hit).

SSSD itself is configured to talk to LDAP:

```ini
# /etc/sssd/sssd.conf
[sssd]
services = nss, pam, ssh
domains = example.net

[nss]
filter_groups = root

[domain/example.net]
ldap_uri = ldaps://ldap-consumer.service.example.net
```

[`sssctl`] confirms the flow end-to-end:

```
$ sudo sssctl --debug 7 user-show bob
... [confdb_init_db] LDIF file to import: ...
... [sysdb_domain_init_internal] DB File for example.net: /var/lib/sss/db/cache_example.net.ldb
... [sss_domain_get_state] Domain example.net is Active
... [sss_parse_name_for_domains] name 'bob' matched without domain, user is bob
... [sss_parse_name_for_domains] using default domain [example.net]
Name: bob
```

## Conclusion

The static `CGO_ENABLED=0` binary skipped NSS entirely. It only "saw" the admin
users hardcoded in `/etc/passwd`. Anyone whose identity lived elsewhere looked
like an unknown user.

- **CGO off:** binary runs, but cannot resolve all users.
- **CGO on, built on noble:** binary cannot load on the old host.
- **CGO on, built on focal:** works, but defeats the point of bumping the base image.

I had no choice but to turn CGO back on. Cross-compiling Go against an older
GLIBC is not first-class. The only remaining pragmatic fix is to retire the host
stuck on the old GLIBC and use only the newer image.

[Go docs]: https://pkg.go.dev/os/user
[non-cgo path]: https://cs.opensource.google/go/go/+/refs/tags/go1.26.3:src/os/user/lookup_unix.go;l=218-225
[cgo path]: https://cs.opensource.google/go/go/+/refs/tags/go1.26.3:src/os/user/cgo_lookup_cgo.go;l=32-39
[calls]: https://cs.opensource.google/go/go/+/refs/tags/go1.26.3:src/os/user/cgo_lookup_unix.go;l=22-41
[`getpwnam_r`]: https://linux.die.net/man/3/getpwnam_r
[`nsswitch.conf`]: https://man7.org/linux/man-pages/man5/nsswitch.conf.5.html
[NSS]: https://man7.org/linux/man-pages/man5/nss.5.html
[`getent`]: https://man7.org/linux/man-pages/man1/getent.1.html
[`sssctl`]: https://manpages.debian.org/trixie/sssd-tools/sssctl.8.en.html
