A deploy of this code is available at https://alec-mitnik-color-bloom.netlify.app/

An algorithmically-generated bloom of color will initiate on load at the center of the screen, and will continue until it fills up the canvas, which is initialized to 1920x1200, and should encompass most screens.  The starting hue and the hue variation rate are randomized on load.  The saturation and value/lightness settings are configurable but fixed to what I feel are their optimal values.

You can interact with the loaded page.  Clicking while a bloom is progressing will stop it.  Clicking without a bloom progressing will start a new bloom at the mouse position, using the same hue settings if left-clicking and new randomized ones if right-clicking.

You can enter fullscreen mode in your browser with F11 (on Windows) or fn(f) (on Mac - also be sure to configure browser tabs to hide when fullscreen) and then take a screenshot in order to save the generated artwork.  Works best if your monitor resolution falls within the resolution of the canvas.  You can always just download the HTML file yourself and change the canvas size or whatever other settings you like and run it locally.

I experimented with both HSV and HSL color spaces.  The latter requires restriction on the allowed lightness ranges to look nice, but does allow for greater highlights in the generated artwork, plus it is natively supported rather than needing manual conversion, so I have it set to HSL by default, but there is a flag you can set in the code file to choose between them.  Restricting the max lightness value to 0.5 for HSL gives essentially the same output as HSV, and I only set the max lightness to 0.6, so it's not that big of a difference as is.

I noticed that for some reason the hue gradient gives a large range for green, while giving very little for light blue (between dark blue and cyan), for orange (between red and yellow), and almost none for purple (between dark blue and magenta).  I did some manual adjustment to how quick or slow the hue changes around those ranges, and I think I have a better color balance because of it.


Color Bloom Art Maker - https://alec-mitnik-color-bloom.netlify.app/art.html

A whole image making application, implemented from scratch, utilizing the color bloom algorithm, with customizable settings.  Greating for making special art or device wallpapers.  Lots of nifty features.  Details for each toolbar option are available in the application.


Color Bloom Library - https://alec-mitnik-color-bloom.netlify.app/color-bloom.js

A standalone library that allows various color bloom effects to be utilized on any website.  Used for my own portfolio site (https://alec-mitnik.github.io/).
