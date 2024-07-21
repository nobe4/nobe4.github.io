+++
title = "Lazy Lazy Loading"
date = 2024-07-21
+++


In this blog post, I showcase how I maintain my [cat website](https://cats.nobe4.fr).

# Past

I used to maintain a piece of code that roughly did the following:

```python
content = "<body>"

for picture in ls("./pictures"):
    content += picture

content += "</body>"
```

Which generated an HTML file I could then deploy:

```html
<body>
    <img src="pictures/0.jpeg"/>
    <img src="pictures/1.jpeg"/>
    <img src="pictures/2.jpeg"/>
    ...
</body>
```

That meant that for any new picture, the build script would have to run again. I
removed the build step by doing something much worse.

# Present

Given that all the pictures are numerically sorted, it's possible to iterate
through each one.

When would it stop? When the picture doesn't exist, meaning that it reached
the last picture.

In JavaScript, we can use
[`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)
like so:

```javascript
for (let i = 0; ; i++) {
    const image = fetch(`path/to/picture_${i}.jpeg`)
    if (!image) {
        break;
    }
    body.append(image)
}
```

Except that `fetch` is an sync function, which needs either `await` or wrapping
everything in an `async function(){}`.

Bah, both sounds too complex, let's do something simpler.

Let's use `<img>` event to loop through the pictures:
- `onload` the image was loaded correctly, load the next one
- `onerror` the image wasn't found, stop loading

`onerror` needs to also remove the current image from the page, since it didn't
load.

Here's the result:

```html
<body>
    <main id="cats"></main>
    <script>
        function load_next(i) {
            if (event) {
                event.target.onload = ''
                event.target.onerror = ''
            }

            cats.insertAdjacentHTML(
                "beforeend",
                `<img src="pictures/${i}.jpeg" onload="load_next(${i + 1})" onerror="done()"/>`
            )
        }
        load_next(0)

        function done() {
            cats.removeChild(cats.lastChild)
        }
    </script>
</body>
```

# Future

Have another look at [the website](https://cats.nobe4.fr/), some other things
are there, all terrible. At least there's some cute cats!
