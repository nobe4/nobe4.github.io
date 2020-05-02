---

layout: post
title: Reaper Video Processing Cheat Sheet
image:
  link: TODO
  credit_link: TODO

---

# Introduction

This post is as much for me to understand how to edit videos in
[reaper](https://www.reaper.fm/) as it is to provide some clear examples of how
to use each functions.

This builds on the amazing work of [this
site](https://mespotin.uber.space/Ultraschall/Reaper_API_Video_Documentation.html#)
which expands on the provided video help.

To inspect anything, you can use `<C-k>` (that is `Ctrl` + `k` when the cursor is on a variable when the cursor is on a variable).

# Links

[**Variables**](#variables)


[**Functions**](#functions)
[`gfx_str_draw`](#gfx_str_draw)

# Variables

## `project_time`
Project time in seconds.

E.g.
```
project_time == 0.46666666... (start of project)
project_time == 0.86666666... (after 1 bar)
```

## `project_tempo`
Current tempo in BPM.

E.g.
```
project_tempo == 144.000
```

## `project_ts_num`
Current time signature numerator.

E.g.
```
project_ts_num == 4.00000
```

## `project_ts_denom`
Current time signature denominator.

E.g.
```
project_ts_denom == 4.00000
```

## `project_time_qn`
current project position in QN
TODO

## `time`
Item time in seconds when inside an item.

E.g.
```
project_time == 0.01666666... (start of project)
project_time == 0.88333333... (after 1 bar)
```

## `framerate`
Project FPS (frames per second).

E.g.
```
framerate == 30.00000
```

## `project_w`
Project preferred video width.
You can update this value before drawing.

E.g.
```
project_w == 1080.0000
// Updating the width
project_w = 720
```

## `project_h`
Project preferred video height.
You can update this value before drawing.

E.g.
```
project_h == 720.0000
// Updating the width
project_h = 480
```

## `project_wh_valid`
Equals `1` if the project's size reflect the settings.
Equals `0` if the project's size has been changed via media/code.

E.g.
```
// Default project size
project_wh_valid == 1.0000
// Media defined project size
project_wh_valid == 0.0000
```

## `colorspace`
current rendering colorspace, e.g. 'RGBA', 'YV12', or 'YUY2'. You can override this before drawing (or between drawing). This may be set to 0 initially if the user has the Auto project colorspace set. It will be automatically changed if 0 and a drawing operation occurs or an input is successfully queried via input_info().

?? TODO

## `param_wet`
if in FX form, wet/dry mix of effect.

?? TODO

## `param1..param24`
Parameters values

E.g.
```
//@param 1:a 'a'
// See below for default param values.
a == 0
```

Parameters are defined using the following format:
```
//@param [<idx>[:varname]|varname] 'name' [default min max center step]
```
`name` is displayed on the side and `varname` can be used in the code.
`varname` cannot be one of the special variables.

E.g.
```
Defaults to 0 0 1 0.5 0.01
//@param 1:a 'a'
From 0 to 100, default to 10, centered on 50 with increment of 1
//@param 2:b 'b' 10 0 100 50 1
```

## `gfx_r` `gfx_g` `gfx_b` `gfx_a` `gfx_a2`
Respectively red, green, blue, alpha and alpha channel current drawing colors.
All values are between `0` and `1`
Values can be set in the code with `gfx_set`.

E.g.
```
gfx_blit(-2,1); // Ignore this line for now

// rgb below
gfx_set(1, 0, 1); gfx_fillrect(0,   0, 100, 100);
gfx_set(0, 1, 0); gfx_fillrect(100, 0, 100, 100);
gfx_set(1, 0, 0); gfx_fillrect(200, 0, 100, 100);

// rgba
gfx_set(1, 1, 1,   1);  gfx_fillrect(0,  0, 100, 100);
gfx_set(1, 1, 1, 0.5); gfx_fillrect(100, 0, 100, 100);
gfx_set(1, 1, 1,   0); gfx_fillrect(200, 0, 100, 100);

// rgba2
TODO
```

// TODO: Screenshots on desktop

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

Value can be set with `gfx_set`.

E.g.
```
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
Value can be set with `gfx_set`.

E.g.
```
// TODO
```

# Functions

## `input_count()`
Returns number of inputs available (total), range [0..n)

## `input_track_count()`
Returns the number of available inputs on discrete tracks

## `input_track(x)`
Returns input for bottommost item or FX on discrete-track x (0 is first track with video item above current, etc)

## `input_track_exact_count()`
Returns the number of tracks above the current track that could possibly contain video items.

## `input_track_exact(x)`
Returns input for bottommost item or FX on track relative to current track. Returns -1000 if track does not contain any video items at the current time, or -10000 if no further tracks contain video.

## `input_next_item(x)`
Returns the next input after x which is on a different item or track

## `input_next_track(x)`
Returns the next input after x which is on a different track

## `input_ismaster()`
Returns 1.0 if current FX is on master chain, 2.0 if on monitoring FX chain

## `input_info(input, w, h[,srctime, wet, parm1, ...])`
Returns 1 if input is available, sets w/h to dimensions. If srctime specified, it will be set with the source-local time of the underlying media. if input is a video processor in effect form, automated parameters can be queried via wet/parm1/...

## `input_get_name(input, #str)`
Gets the input take name or track name. returns >0 on success

## `gfx_img_alloc([w,h,clear])`
Returns an image index for drawing (can create up to 32 images). contents of image undefined unless clear set.

## `gfx_img_resize(handle,w,h[,clear])`
Sets an image size (handle can be -1 for main framebuffer). contents of image undefined after resize, unless clear set. clear=-1 will only clear if resize occurred. Returns the image handle (if handle is invalid, returns a newly-allocated image handle)

## `gfx_img_hold(handle)`
Retains (cheaply) a read-only copy of an image in handle. This copy should be released using gfx_img_free() when finished. Up to 32 images can be held.

## `gfx_img_getptr(handle)`
Gets a unique identifier for an image, valid for while the image is retained. can be used (along with gfx_img_hold) to detect when frames change in a low frame rate video

## `gfx_img_free(handle)`
Releases an earlier allocated image index.

## `gfx_img_info(handle,w,h)`
Gets dimensions of image, returns 1 if valid (resize if inexplicably invalidated)

## `gfx_set(r,[g=r,b=r,a=1,mode=0,dest,a2=1])`
Updates r/g/b/a/mode to values specified, dest is only updated if parameter specified.

## `gfx_blit(input[,preserve_aspect=0,x,y,w,h,srcx,srcy,srcw,srch])`
Draws input to framebuffer. preserve_aspect=-1 for no fill in pad areas

## `gfx_fillrect(x,y,w,h)`
Fills a rectangle with the current color/mode/alpha

## `gfx_procrect(x,y,w,h,channel_tab[,mode])`
Processes a rectangle with 768-entry channel table [256 items of 0..1 per channel]. specify mode=1 to use Y value for U/V source channels (colorization mode)

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

## `gfx_gradrect(x,y,w,h, r,g,b,a [,drdx,dgdx,dbdx,dadx, drdy,dgdy,dbdy,dady])`
Fills rectangle. r/g/b/a supply color at top left corner, drdx (if specified) is amount red changes per X-pixel, etc.

## `gfx_rotoblit(srcidx, angle [,x, y, w, h, srcx, srcy, w, h, cliptosrcrect=0, centxoffs=0, centyoffs=0])`
Blits with rotate. This function behaves a bit odd when the source and destination sizes/aspect ratios differ, so gfx_deltablit() is generally more useful.

## `gfx_deltablit(srcidx, x,y,w,h srcx,srcy, dsdx, dtdx, dsdy, dtdy, dsdxdy, dtdxdy[, dadx, dady, dadxdy])`
Blits with source pixel transformation control. S and T refer to source coordinates: dsdx is  how much the source X position changes with each X destination pixel, dtdx is how much the source Y position changes with each X destination pixel, etc.

## `gfx_xformblit(srcidx, x,y,w,h,  wdiv, hdiv, tab[, wantalpha=0])`
Blits with a transformation table. tab is wdiv*hdiv*2 table of source point coordinates. If wantalpha=1, tab is wdiv*hdiv*3 table of src points including alpha for each point.

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

## `gfx_destkeyedblit(input[,x,y,w,h,srcx,srcy,kv1,kv2,kv3,kv4])`
Chroma-key blits, using destination color as key. ignores gfx_a and gfx_mode. See gfx_keyedblit() for kv1-kv4 explanation.

## `gfx_setfont(pxsize[,#fontname, flags)`
Sets a font. flags are specified as a multibyte integer, using a combination of the following flags (specify multiple as 'BI' or 'OI' or 'OBI' etc):
    'B' - Bold
    'I' - Italics
    'R' - Blur
    'V' - Invert
    'M' - Mono
    'S' - Shadow
    'O' - Outline

## `gfx_str_measure(#string[,w,h])`
Measures the size of #string, returns width

## `gfx_str_draw(#string[,x,y,fxc_r,fxc_g,fxc_b])`
Draw string, fxc_r/g/b are the FX color if Shadow/Outline are set in the font

## `gfx_getpixel(input,x,y,v1,v2,v3[,v4])`
Gets the value of a pixel from input at x,y. v1/v2/v3 will be YUV or RGB (v4 can be used to get A), returns 1 on success

## `rgb2yuv(r,g,b)`
Converts r,g,b to YUV, does not clamp [0..1]

## `yuv2rgb(r,g,b)`
Converts YUV to r,g,b, not clamping [0..1]
