
$ cat /usr/share/dict/words | tr 'A-Z' 'a-z' | grep -v "'"| cut -c 1 | sort | uniq -c
   4378 a
   4497 b
   7083 c
   4538 d
   2974 e
   3165 f
   2560 g
   2809 h
   2903 i
    877 j
    810 k
   2477 l
   4295 m
   1501 n
   1769 o
   5713 p
    358 q
   4190 r
   8564 s
   3754 t
   1714 u
   1164 v
   2066 w
     76 x
    298 y
    200 z

$ cat /usr/share/dict/words | tr 'A-Z' 'a-z' | grep -v "'" | xargs -I{} -P20 bash -c 'printf {} | md5sum' | cut -c 1 | sort | uniq -c
   4546 0
   4573 1
   4686 2
   4454 3
   4725 4
   4807 5
   4777 6
   4789 7
   4643 8
   4706 9
   4761 a
   4612 b
   4599 c
   4599 d
   4730 e
   4737 f

$ cat /usr/share/dict/words | tr 'A-Z' 'a-z' | grep -v "'" | xargs -I{} -P20 bash -c 'printf {} | sha1sum' | cut -c 1 | sort | uniq -c
   4627 0
   4784 1
   4668 2
   4754 3
   4615 4
   4662 5
   4706 6
   4630 7
   4714 8
   4594 9
   4613 a
   4525 b
   4650 c
   4629 d
   4740 e
   4833 f

$ cat /usr/share/dict/words | tr 'A-Z' 'a-z' | grep -v "'" | xargs -I{} -P20 bash -c 'printf {} | sha256sum' | cut -c 1 | sort | uniq -c
   4725 0
   4546 1
   4843 2
   4731 3
   4665 4
   4716 5
   4696 6
   4587 7
   4728 8
   4684 9
   4629 a
   4546 b
   4630 c
   4664 d
   4583 e
   4771 f


package main

import (
	"crypto/md5"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/hex"
	"fmt"
	"os"
	"sort"
	"strings"
)

const listPath = "/usr/share/dict/words"

type hasher func(string) string

var (
	Hashes = map[string]hasher{
		"noop": func(s string) string {
			return s
		},
		"md5": func(s string) string {
			h := md5.New()
			h.Write([]byte(s))
			return hex.EncodeToString(h.Sum(nil))
		},
		"sha1": func(s string) string {
			h := sha1.New()
			h.Write([]byte(s))
			return hex.EncodeToString(h.Sum(nil))
		},
		"sha256": func(s string) string {
			h := sha256.New()
			h.Write([]byte(s))
			return hex.EncodeToString(h.Sum(nil))
		},
		"sha512": func(s string) string {
			h := sha512.New()
			h.Write([]byte(s))
			return hex.EncodeToString(h.Sum(nil))
		},
	}
)

type Stat map[string]int
type Stats map[string]Stat

func main() {
	stats := Stats{}

	file, err := os.ReadFile(listPath)
	if err != nil {
		panic(err)
	}

	lines := strings.Split(string(file), "\n")
	for i, line := range lines {
		lines[i] = strings.ToLower(line)
	}

	for hash, hasher := range Hashes {
		stat := Stat{}

		for _, line := range lines {
			if line == "" {
				continue
			}

			h := hasher(line)
			t := string(h[0])
			if len(h) > 1 {
				t += string(h[1])
			}
			stat[t]++
		}

		stats[hash] = stat
	}

	for hash, stat := range stats {
		fmt.Println(hash)

		sortedKeys := make([]string, 0, len(stat))
		for k := range stat {
			sortedKeys = append(sortedKeys, k)
		}
		sort.Strings(sortedKeys)

		for _, k := range sortedKeys {
			if count, ok := stat[k]; ok {
				fmt.Printf("\t%s: %d\n", k, count)
			}
		}
	}
}


