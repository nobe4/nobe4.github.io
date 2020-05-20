---

layout: post
title: Reaper Video Processing Cheat Sheet
image:
  link: TODO
  credit_link: TODO

---

IN PROGRESS:
 - [ ] Rough draft

TODOs:
 - [ ] Wording consistency
 - [ ] Examples
 - [ ] Terminology
 - [ ] Code color
 - [ ] Remove function parameters from titles
 - [ ] Add all vars/functions in links

# Introduction

This post is as much for me to understand how to edit videos in
[reaper](https://www.reaper.fm/) as it is to provide some clear examples of how
to use each functions.

This builds on the amazing work of [this
site](https://mespotin.uber.space/Ultraschall/Reaper_API_Video_Documentation.html#)
which expands on the provided video help.

To inspect anything, you can use `<C-k>` (that is `Ctrl` + `k`) when the cursor is on a variable when the cursor is on a variable).

# Links

To build, run from the page, and insert here.
```javascript
Array.from(document.querySelectorAll("h2")).map(x=>x.innerText.split(" ").map(y=>`[${y}](#${x.id})`).join("\n")).join("\n")
```

[**Variables**](#variables)

[**Functions**](#functions)

# Variables

## `project_time`
Project time in seconds.

E.g.
```c
project_time == 0.46666666... (start of project)
project_time == 0.86666666... (after 1 bar)
```

## `project_tempo`
Current tempo in BPM.

E.g.
```c
project_tempo == 144.000
```

## `project_ts_num`
Current time signature numerator.

E.g.
```c
project_ts_num == 4.00000
```

## `project_ts_denom`
Current time signature denominator.

E.g.
```c
project_ts_denom == 4.00000
```

## `project_time_qn`
current project position in QN
TODO

## `time`
Item time in seconds when inside an item.

E.g.
```c
project_time == 0.01666666... (start of project)
project_time == 0.88333333... (after 1 bar)
```

## `framerate`
Project FPS (frames per second).

E.g.
```c
framerate == 30.00000
```

## `project_w`
Project preferred video width.
You can update this value before drawing.

E.g.
```c
project_w == 1080.0000
// Updating the width
project_w = 720
```

## `project_h`
Project preferred video height.
You can update this value before drawing.

E.g.
```c
project_h == 720.0000
// Updating the width
project_h = 480
```

## `project_wh_valid`
Equals `1` if the project's size reflect the settings.
Equals `0` if the project's size has been changed via media/code.

E.g.
```c
// Default project size
project_wh_valid == 1.0000
// Media defined project size
project_wh_valid == 0.0000
```

## `colorspace`
current rendering colorspace, e.g. 'RGBA', 'YV12', or 'YUY2'. You can override this before drawing (or between drawing). This may be set to 0 initially if the user has the Auto project colorspace set. It will be automatically changed if 0 and a drawing operation occurs or an input is successfully queried via input_info().
TODO

## `param_wet`
if in FX form, wet/dry mix of effect.
TODO

## `param1..param24`
Parameters values

E.g.
```c
//@param 1:a 'a'
// See below for default param values.
a == 0
```

Parameters are defined using the following format:
```c
//@param [<idx>[:varname]|varname] 'name' [default min max center step]
```
`name` is displayed on the side and `varname` can be used in the code.
`varname` cannot be one of the special variables.

E.g.
```c
// Defaults to 0 0 1 0.5 0.01
//@param 1:a 'a'

// From 0 to 100, default to 10, centered on 50 with increment of 1
//@param 2:b 'b' 10 0 100 50 1
```

## `gfx_r` `gfx_g` `gfx_b` `gfx_a` `gfx_a2`
Respectively red, green, blue, alpha and alpha channel for current drawing colors.
All values are between `0` and `1`
Values can be set in the code with `gfx_set` or directly with their name.

E.g.
```c
gfx_blit(-2, 0); // Ignore this line for now

// rgb
gfx_set(1, 0, 1); gfx_fillrect(0,   0, 100, 100);
gfx_set(0, 1, 0); gfx_fillrect(100, 0, 100, 100);
gfx_set(1, 0, 0); gfx_fillrect(200, 0, 100, 100);

// rgba
gfx_set(1, 1, 1,   1);  gfx_fillrect(0,  0, 100, 100);
gfx_set(1, 1, 1, 0.5); gfx_fillrect(100, 0, 100, 100);
gfx_set(1, 1, 1,   0); gfx_fillrect(200, 0, 100, 100);
```

```c
gfx_blit(-2, 0);

// Display cat picture in the background.
gfx_blit(0, -1, 0, 0, 300, 300, 900, 1500, 1000, 1000);

// a2 to 0 and 1 for 3 different colors and a = 0.5.
gfx_set(1, 1, 0, 0.5, 0); gfx_fillrect(100, 0,   100, 100);
gfx_set(1, 1, 0, 0.5, 1); gfx_fillrect(200, 0,   100, 100);

gfx_set(0, 1, 0, 0.5, 0); gfx_fillrect(100, 100, 100, 100);
gfx_set(0, 1, 0, 0.5, 1); gfx_fillrect(200, 100, 100, 100);

gfx_set(1, 0, 1, 0.5, 0); gfx_fillrect(100, 200, 100, 100);
gfx_set(1, 0, 1, 0.5, 1); gfx_fillrect(200, 200, 100, 100);
```

![rgb]({{ site.url }}{{ site.image.path }}/posts/reaper-video/rgb.png)

![rgba]({{ site.url }}{{ site.image.path }}/posts/reaper-video/rgba.png)

![rgbaa2]({{ site.url }}{{ site.image.path }}/posts/reaper-video/rgbaa2.png)

## `gfx_mode`
Drawing mode:
- `0` : normal
- `1` : additive
- `3` : multiply (very different in YUV and RGBA)
- `17` : `(dest + src * gfx_a) * 0.5 + 0.5` (YUV only)
- `18` : `dest + (src - 0.5) * gfx_a * 2.0` (YUV only)
- `19` : absolute difference: `abs(dest - src) * gfx_a` (YUV only)

Following flags are `or`ed to the mode above:
- `0x100` : for blit() to enable filtering (if possible)
- `0x10000` : to use source alpha (RGBA only)
- `0x40000` : to use extra clamping in normal mode (for out of range alpha/gradient values)
- `0x80000` : to interpret gfx_r/gfx_g/gfx_b as YUV values (YUV only)

Value can be set with `gfx_set` or directly with `gfx_mode`.

E.g.
```c
gfx_blit(-2,1);

// Yellow background
gfx_set(1, 1, 0, 1, 0);  gfx_fillrect(0,   50, 300, 100);
// Blue squares
gfx_set(0, 0, 1, 1, 0);  gfx_fillrect(0,   0,  100, 100);
gfx_set(0, 0, 1, 1, 1);  gfx_fillrect(100, 0,  100, 100);
gfx_set(0, 0, 1, 1, 3);  gfx_fillrect(200, 0,  100, 100);

// TODO do the flags
```

## `gfx_dest`
destination image handle, or -1 for main framebuffer
Value can be set with `gfx_set` or directly with `gfx_dest`.

E.g.
```c
gfx_blit(-2, 0); // Clear the screen

// Create image.
i1 = gfx_img_alloc(100, 100, 1);

// Fill image with two squares, will be clipped to 100x100.
// gfx_set set the destination to the image.
gfx_set(1, 0, 0, 1, 0, i1); gfx_fillrect(0, 0, 100, 100);
gfx_set(1, 1, 0, 1, 0, i1); gfx_fillrect(25, 25, 100, 100);
// Set the destination to the framebuffer.
gfx_dest = -1;
gfx_blit(i1, 0, 0, 0, 100, 100);

// Or directly in the framebuffer.
gfx_set(1, 0, 0, 1, 0, -1); gfx_fillrect(110, 0, 100, 100);
gfx_set(1, 1, 0, 1, 0, -1); gfx_fillrect(135, 25, 100, 100);

// Free up memory.
gfx_img_free(i1);
```

![gfx dest]({{ site.url }}{{ site.image.path }}/posts/reaper-video/gfx_dest.png)

# Functions

## `input_count()`
Returns number of inputs available. I.e. all the video tracks that will account for rendering.

E.g.:
If a video is present in the current track, 1 will be returned.
If the video is muted, it will be 0.
If there's a video on the current track and in a track above, it will be 2.
See below for example.

## `input_track_count()`
Returns the number of available inputs on current track.
See below for example.

## `input_track_exact_count()`
Returns the number of tracks above the current track that contain video items.
More or less `input_count() - input_track_count()`.

E.g.
```c
// Debug code, ignore
function t(n, i)(t="";sprintf(#t,"%d",n);gfx_str_draw(#t,100,100+i*20););
gfx_blit(-2,1); gfx_set(1);

t(input_count(), 0);
t(input_track(), 1);
t(input_track_exact_count(), 2);
```

![input count]({{ site.url }}{{ site.image.path }}/posts/reaper-video/input_count.png)

## `input_track(int x)`
Returns id of the item in the `x`th track above the current track. The id is built such as the 1st element is alwas at the bottom-most track first. In case of overlapping, the first element will be assigned the smallest id.
This can be thought of as "give me the item number top-to-bottom".
`-1` shows whichever id will be on top.

E.g.
```c
// Debug code, ignore.
function t(n, i)(t="";sprintf(#t,"%d",n);gfx_str_draw(#t,100,100+i*20););
gfx_blit(-2,1); gfx_set(1);

// Show item for displayed, current track, 1st below and 2nd below.
t(input_track(-1), -1);
t(input_track(0),  0);
t(input_track(1),  1);
t(input_track(2),  2);
```

![input track]({{ site.url }}{{ site.image.path }}/posts/reaper-video/input_track.png)

## `input_track_exact(int x)`
Returns id of the item on the relative `x`th track above the current one. Similar to `input_track()` but also returns `-1000` if no video track is present, or `-10000` if no video tracks are present later.

E.g.
```c
function t(n, i)(t="";sprintf(#t,"%d",n);gfx_str_draw(#t,100,100+i*20););
gfx_blit(-2,1);
gfx_set(1);

t(input_track_exact(-1), -1);
t(input_track_exact(0), 0);
t(input_track_exact(1), 1);
```

![input track exact]({{ site.url }}{{ site.image.path }}/posts/reaper-video/input_track_exact.png)

## `input_next_item(int x)`
Returns the next input after x which is on a different item or track.
TODO

## `input_next_track(int x)`
Returns the next input after x which is on a different track.
TODO

## `input_ismaster()`
Returns 1.0 if current FX is on master chain, 2.0 if on monitoring FX chain, 0 otherwise.

E.g.
```c
// Master track
function t(n, i)(t="";sprintf(#t,"%f",n);gfx_str_draw(#t,0,0+i*20););
gfx_blit(0,-1); gfx_set(1);

t(input_ismaster(), 0);

// Non-master track
function t(n, i)(t="";sprintf(#t,"%f",n);gfx_str_draw(#t,0,0+i*20);); 
gfx_blit(0,-1); gfx_set(1);

t(input_ismaster(), 1);
```

![input is master]({{ site.url }}{{ site.image.path }}/posts/reaper-video/input_ismaster.png)

## `input_info(int input, int w, int h [, int srctime, int wet, int parm1, ...])`
Returns 1 if `input` is available.
Additionnaly sets `w`/`h` to dimensions of the input.
If `srctime` specified, it will be set with the source-local time of the underlying media. 
If `input` is a video processor in effect form, automated parameters can be queried via `wet`/`parm1`/...

E.g.
```c
// Fx 1: a 'a' 1 - video processor
//@param1:a 'a' 1

// Fx 2: Video processor
function t(n, i)(t="";sprintf(#t,"%f",n);gfx_str_draw(#t,0,0+i*20);); 
gfx_blit(0,-1); gfx_set(1); 

input_info(0,w,h,s,wt,p1);
t(w, 0);
t(h, 1);
t(s, 2);
t(wt, 3);
t(p1, 4);
```

![input info]({{ site.url }}{{ site.image.path }}/posts/reaper-video/input_info.png)

## `input_get_name(input, #str)`
Gets the input take name or track name. Returns 1 if name was found, 0 otherwise.

E.g.
```c
function t(n, i)(t="";a=input_get_name(n,#t);gfx_str_draw(#t,100,100+i*20););
gfx_blit(-2,1); gfx_set(1);

t(0, 0);
t(1, 1);
t(2, 2);
```

![input get name]({{ site.url }}{{ site.image.path }}/posts/reaper-video/input_get_name.png)

## `gfx_img_alloc([int width, int height, bool clear])`
Creates a new image with specified size, and black background if `clear` equals to `1`. You can create up to 32 images using this method.
The returned index can be used in `gfx_dest`, `gfx_blit` and in other places.

E.g.
```c
gfx_blit(-2, 0); // Clear the screen

// Create three images.
i1 = gfx_img_alloc(100, 100, 1);
i2 = gfx_img_alloc(50,  50,  1);
i3 = gfx_img_alloc(25,  25,  1);

// Fill image with squares: a big red, medium green and small blue.
gfx_set(1, 0, 0, 1, 0, i1); gfx_fillrect(0, 0, 100, 100);
gfx_set(0, 1, 0, 1, 0, i2); gfx_fillrect(0, 0, 50,  50);
gfx_set(0, 0, 1, 1, 0, i3); gfx_fillrect(0, 0, 25,  25);

// Draw all the squares on the screen.
gfx_dest = -1;
gfx_blit(i1, 0, 0,   0, 100, 100);
gfx_blit(i2, 0, 100, 0, 50,  50);
gfx_blit(i3, 0, 150, 0, 25,  25);

// Draw the small squares in the big ones.
gfx_dest = i2; gfx_blit(i3, 0, 12, 12, 25, 25); // now i2 contains also i3.
gfx_dest = i1; gfx_blit(i2, 0, 25, 25, 50, 50); // i1 contains i2 and i3.
gfx_dest = -1;

// And draw the updated squares on screen.
gfx_blit(i1, 0, 0,   100, 100, 100);
gfx_blit(i2, 0, 100, 100, 50,  50);

// Free up memory.
gfx_img_free(i1); gfx_img_free(i2); gfx_img_free(i3);
```

![gfx img alloc]({{ site.url }}{{ site.image.path }}/posts/reaper-video/gfx_img_alloc.png)

## `gfx_img_resize(int handle, int w, int h[, bool clear])`
Copy the content of the handle into a new image and return its id. The `-1` handle can be used for the framebuffer.
`clear=1` will remove the content of the image, `clear=-1` will clear only if a resize occured.
If handle is invalid, it will behave like `gfx_img_alloc`.

Here the `handle` is not to be confused with `input` that `gfx_blit` uses.

E.g.
```c
// Show background image
gfx_blit(0, 1);

r = gfx_img_resize(input_track(0), 100, 100);
gfx_blit(r, 1, 400, 50, 100, 100);
gfx_img_free(r);

// or simply
gfx_blit(0, 1, 600, 50, 100, 100);
```

![gfx img resize]({{ site.url }}{{ site.image.path }}/posts/reaper-video/gfx_img_resize.png)

## `gfx_img_hold(int handle)`
Save a cheap and read-only copy of the image handle. Needs to be released with `gfx_img_free()`.
Can hold up to 32 images.

Look at `gfx_img_getptr` for example.

## `gfx_img_getptr(int handle)
Get a unique identifier for the image, while the image is in memory.
Can be used with `gfx_img_hold` to detect changes in low frame rate video.

E.g.
```c
i1 = gfx_img_alloc(100, 100, 1);
gfx_set(1, 0, 0, 1, 0, i1); gfx_fillrect(0, 0, 100, 100);
h1 = gfx_img_hold(i1);
p1 = gfx_img_getptr(h1);

i2 = gfx_img_alloc(100, 100, 1);
gfx_set(1, 0, 0, 1, 0, i2); gfx_fillrect(0, 0, 100, 100);
h2 = gfx_img_hold(i2);
p2 = gfx_img_getptr(h2);

p1; // 11203977...
p2; // 11203457...

gfx_img_free(i1); gfx_img_free(i2);
gfx_img_free(h1); gfx_img_free(h2);
```

## `gfx_img_free(int handle)`
Releases an earlier allocated image index.

E.g.
```c
r = gfx_img_resize(0, 100, 100);
gfx_img_free(r);
```

## `gfx_img_info(int handle, int #w, int #h)`
Gets dimensions of image, returns 1 if valid (resize if inexplicably invalidated)
TODO ???

## `gfx_set(float r, [float g = r, float b = r,float a = 1,int mode = 0, int dest, float a2 = 1])`
Updates `r`/`g`/`b`/`a`/`mode`/`a2` to values specified, `dest` is only updated if parameter specified.
See `gfx_...` for reference on the different parameters.
`dest` is the integer to a destination item to draw on.

E.g.
```c
gfx_blit(-2, 0); // Clear the screen

gfx_set(1, 0, 0, 1, 0, -1, 1); gfx_fillrect(0, 0, 100, 100);
gfx_set(1, 1, 0, 1, 0, -1, 1); gfx_fillrect(0, 100, 100, 100);
gfx_set(1, 0, 1, 0.5, 0, -1, 1); gfx_fillrect(100, 0, 100, 100);
gfx_set(0, 1, 1, 1, 0, -1, 1); gfx_fillrect(100, 100, 75, 75);
gfx_set(1, 1, 1, 1, 1, -1, 1); gfx_fillrect(125, 125, 75, 75);
// For dest, check `gfx_img_alloc` example
```

![gfx set]({{ site.url }}{{ site.image.path }}/posts/reaper-video/gfx_set.png)

## `gfx_blit(int input[, bool preserve_aspect=0, int x, int y, int w, int h, int srcx, int srcy, int srcw, int srch])`
Draw input into the selected destination, check `gfx_img_alloc` example for destination change.

`x`,`y`,`w`,`h` control the destination position and size of the image.
`srcx`,`srcy`,`srcw`,`srch` control the source position and size of the image.

E.g.
```c
// To see change in `input`, check `gfx_img_alloc`.
gfx_blit(0, 1);
gfx_blit(0, 0, 400, 0, 100, 100);
gfx_blit(0, 1, 400, 100, 100, 100);
gfx_blit(0, 1, 400, 200, 100, 100, 1000, 1000, 2000, 2000);
gfx_blit(0, 0, 600, 0);
gfx_blit(0, -1, 600, 100);
gfx_blit(0, 1, 600, 200);
```

![gfx blit]({{ site.url }}{{ site.image.path }}/posts/reaper-video/gfx_blit.png)

## `gfx_fillrect(x,y,w,h)`
Fills a rectangle with the current color/mode/alpha

E.g.
```c
gfx_blit(-2, 1);

i = 0; inc = 40;
loop(10,
    gfx_set(i/10,      0, 1-i/10); gfx_fillrect(inc*i,                 inc*i, 100, 100);
    gfx_set(0,    1-i/10, i/10);   gfx_fillrect(inc/2+(i*inc), inc/2+(i*inc), 100, 100);
    i += 1
);
```

![gfx fillrect]({{ site.url }}{{ site.image.path }}/posts/reaper-video/gfx_fillrect.png)

## `gfx_procrect(int x, int y, int w, int h, ??? channel_tab[, int mode])`
Processes a rectangle with 768-entry channel table [256 items of 0..1 per channel]. specify mode=1 to use Y value for U/V source channels (colorization mode)

TODO: What's a channel tab format?

## `gfx_evalrect(x,y,w,h,code_string[,flags,src,init_code_string,src2])`
Processes a rectangle with code_string being executed for every pixel/pixel-group. Returns -1 if code_string failed to compile. Code should reference per pixel values (0-255, unclamped), depending on colorspace:
    RGBA:  r/g/b/a (0-255, unclamped)
    YUY2: y1,y2, u, v (0-255, unclamped; u/v are centered at 128)
    YV12: y1-y4, u, v (0-255, unclamped; u/v are centered at 128)
Additional options:
    flags|=1 in order to prevent multiprocessing (if your routine needs  to process pixels in-order)
    flags|=2 to ignore output (analysis-only). This is only valid when not using src2 and not using one of the 4/8 modes.
    flags|=4,8 -- only valid in RGBA/YV12, and only if src/src2 not specified. flags&8 means process in vertical slices (top to bottom unless flags&4). flags&4 but not flags&8 means right-to-left. In each case y1-y4 are reordered for convenience (the same filter code can typically be used in various orientations).
    If init_code_string specified, it will be executed in each thread context before processing
    If src specified (and >= -1), sr/sg/sb/sa, sy1/su/sv etc will be available to read. In this case only the intersection of valid rectangles between src and the destination buffer will be processed. 
    If src and src2 specified (and >= -1), s2r/s2g/s2b/s2a, s2y1/s2u/s2v etc will also be available to read. 
    Note: variables _1-_99 are thread-local variables which will always be initialized to 0, and _0 will be initialized to the thread index (usually 0 or 1)

E.g.
```c
// All the code below will run in the following context:
gfx_blit(-2, 1);
colorspace = 'RGBA';
code="..."; // Copy paste the codes below
gfx_evalrect(0, 0, 1000, 1000, code, 0);

// All yellow pixels
r=255; g=255; b=0; a=255;

// From Black to White
i1+=1;
r=i1/1e6*255;
g=i1/1e6*255;
b=i1/1e6*255;

// 


```


TODO: Fix this
Create un damier
```c
//@param 1:size 'size' 500 100 2000 100 10

gfx_blit(0, 1);

colorspace = 'RGBA';
count = size / 100;
init="
sx = 0;
sy = 0;
";
code="
(i%size == 0) ? (
  x = 0; sx = 0;
  i != 0 ? (
    y += 1;
    y % count == 0 ? sy += 1;
  );
) : (
  x += 1;
  x % count == 0 ? sx += 1;
);

c = (sx+sy)%2 ? 0 : 255;

r=c; g=c; b=c;
i += 1;
";

gfx_evalrect(0, 0, size, size, code, 0, init);
```

## `gfx_gradrect(x,y,w,h, r,g,b,a [,drdx,dgdx,dbdx,dadx, drdy,dgdy,dbdy,dady])`
Fills rectangle. r/g/b/a supply color at top left corner, drdx (if specified) is amount red changes per X-pixel, etc.

Fills a rectangle with a gradient from the top-left corner.
The initial color is specified by `r`, `g`, `b` and `a`.
`dZdx` specify the amount of change for the color `Z` horizontally.
`dZdy` specify the amount of change for the color `Z` vertically.

If the amount of "delta" for a color change over 1, it will create nice glitchy effects (see examples).

```c
gfx_blit(-2, 1);
size = 300; grad_inc = 1 / size;
gfx_gradrect(
  0,               0, size,     size,
  0,               0, 0,           1, // Black
  grad_inc,        0, grad_inc,    0, // Purple
  0,        grad_inc, grad_inc,    0 // Light blue
);
gfx_gradrect(
  size,            0, size,         size,
  0,               1, 0,               0, // Transparent Green
  0,        grad_inc, grad_inc, grad_inc, // Opaque Light Blue
  grad_inc,        0, 0,        grad_inc  // Opaque Yellow
);
gfx_gradrect(
  0, size, size, size,
  0, 0, 0, 1,
  3, 3, 3, 0,
  3, 3, 3, 0
);
gfx_gradrect(
  size, size, size, size,
  0, 0, 0, 1,
  1, 2, 3, 0,
  4, 5, 6, 0
);
```

![gfx gradrect]({{ site.url }}{{ site.image.path }}/posts/reaper-video/gfx_gradrect.png)

## `gfx_rotoblit(srcidx, angle [,x, y, w, h, srcx, srcy, w, h, cliptosrcrect=0, centxoffs=0, centyoffs=0])`
Blits with rotate. This function behaves a bit odd when the source and destination sizes/aspect ratios differ, so gfx_deltablit() is generally more useful.
TODO

## `gfx_deltablit(srcidx, x,y,w,h srcx,srcy, dsdx, dtdx, dsdy, dtdy, dsdxdy, dtdxdy[, dadx, dady, dadxdy])`
Blits with source pixel transformation control. S and T refer to source coordinates: dsdx is  how much the source X position changes with each X destination pixel, dtdx is how much the source Y position changes with each X destination pixel, etc.
TODO

## `gfx_xformblit(srcidx, x,y,w,h,  wdiv, hdiv, tab[, wantalpha=0])`
Blits with a transformation table. tab is wdiv*hdiv*2 table of source point coordinates. If wantalpha=1, tab is wdiv*hdiv*3 table of src points including alpha for each point.
TODO

## `gfx_keyedblit(input[,x,y,w,h,srcx,srcy,kv1,kv2,kv3,kv4])`
Chroma-key blits, using the source color as key. kv1-kv4 meaning depends on colorspace:
    YV12/YUY2:
        kv1 is U target (-0.5 default)
        kv2 is V target (-0.5 default)
        kv3 is closeness-factor (0.4 default)
        kv4 is the gain (2.0 default)
    RGBA:
        kv1 is green-factor (1.0 default)
        kv2 is blue-factor (-1.0 default)
        kv3 is offset (-1.0 default)
        kv4 enables spill removal (1.0 default)
TODO

## `gfx_destkeyedblit(input[,x,y,w,h,srcx,srcy,kv1,kv2,kv3,kv4])`
Chroma-key blits, using destination color as key. ignores gfx_a and gfx_mode. See gfx_keyedblit() for kv1-kv4 explanation.
TODO

## `gfx_setfont(pxsize[,#fontname, flags)`
Sets a font. flags are specified as a multibyte integer, using a combination of the following flags (specify multiple as 'BI' or 'OI' or 'OBI' etc):
    'B' - Bold
    'I' - Italics
    'R' - Blur
    'V' - Invert
    'M' - Mono
    'S' - Shadow
    'O' - Outline
TODO

## `gfx_str_measure(#string[,w,h])`
Measures the size of #string, returns width
TODO

## `gfx_str_draw(#string[,x,y,fxc_r,fxc_g,fxc_b])`
Draw string, fxc_r/g/b are the FX color if Shadow/Outline are set in the font
TODO

## `gfx_getpixel(input,x,y,v1,v2,v3[,v4])`
Gets the value of a pixel from input at x,y. v1/v2/v3 will be YUV or RGB (v4 can be used to get A), returns 1 on success
TODO

## `rgb2yuv(float r, float g, float b)`
Converts *RGB* to *YUV*, does not clamp the values to [0..1].
TODO

## `yuv2rgb(float r,float g, float b)`
Converts YUV to r,g,b, not clamping [0..1]
TODO
