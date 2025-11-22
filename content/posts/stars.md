+++
title = "Stars"
date = 2025-01-23
tags = ["philosophy", "technology", "work"]
references = [
    "https://en.wikipedia.org/wiki/Object_permanence",
]
+++

Being idealistic is hard for me to brush off. I overly enjoy perfection and the
feeling of having created something _just right_.

Having guidelines, or rules matters only if consistently applied. Code fits
greatly to this via linter, type checkers, formatters, etc.

For other things, I find it useful to have guiding principles, less as strong
rules and more as _unreachable states_. Aiming, if never reaching, for something
**perfectly great**.

Here is a constantly-updated list of guiding stars I collected.

TBD: write a small paragraph for each.

{{< table-of-contents >}}

## It's written, so it exists

Having an awful memory, and low object permanence, it's a challenge to trust
what is in my head and what people _say_. Using a written proof of an exchange,
decision, idea, and tracking it (ideally with a VCS), is the best way to make it
**real**.

Relates to [existence isn't correctness](#existence-isnt-correctness).

## It's tested, so it might work

## Comments lie

Comments are often under less scrutiny than code. It is more difficult to lint
and test them. So they often drift from the code and offer little help.

Consider:

```go
// make sure we get a correct difference between x and y
func Diff(x, y int) int {
    // substract y from x only if x is bigger than y
    if (x > y) { return x - y }
    // otherwise substract x from y
    return y - x
}
```

Every comment here is misleading or useless. They add only to the clutter and
confusion of the code they are surrounding.

Corollary to [comment via types and names](#comment-via-types-and-names).

## Comment via types and names

Programming languages offer many functionality to _explain_ code that doesn't
require comments: the types and names of functions, variables, namespaces, etc.

Consider:

```go
type length int

func AbsoluteDiff(x, y length) length {
    if (x > y) { return x - y }
    return y - x
}
```

Corollary to [comments lie](#comments-lie).

## Everything decays

## Code create bugs

## Understanding is a muscle

## Geniuses are liabilities

## Completion is illusory

## API is mandatory

## Everything should have a URL

https://ben.balter.com/2015/11/12/why-urls/

## Compose from small

## Prefer the least

Whenever it's about clothings, tools, third party libraries, ... Each brings
additional responsibility. Caring for the end result should be prioritized over
caring for the way to get there.

Find what is truly necessary, learn to live with less.

## It's never about you

## Speak less, listen more

## Become nonessential

## Feedback over feelings

> Prefer intelligent pushback to thoughtless acceptance. -
> [@gleeblezoid](https://corner.gleeblezoid.com/)

## ISO 8601

> What where you doing on 08-03-11?

> I was either:
>
> - Celebrating the 100th anniversary of International Women's Day (2011-03-08)
> - Dancing to the #1 song: Crazy In Love - Beyonce Ft JayZ (2003-08-11)
> - Hearing that W. H. Taft got elected 27th president of the USA (1908-11-03)

Time is confusing enough as it is, there's no need to sprinkle some nonsensical
ordering in the mix.

Large to small, always.

## RFC 1925: 8, 11

## Existence isn't correctness

## Tenacity isn't correctness

## New isn't good; old isn't good

## Underwhelm rather than overwhelm

https://www.youtube.com/watch?v=Jf0cjocP8Wk

## It always takes more time

## Non-security features must be opt-in
