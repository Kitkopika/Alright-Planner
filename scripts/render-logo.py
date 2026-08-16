#!/usr/bin/env python3
"""
Renders the app assets from the Alright logo (assets/logo.svg).

The logo is an upside-down "V" (a chevron) filled with the app's accent
gradient (#726BEA -> #423BC0) on white.

Outputs (into assets/):
  icon.png                    1024 full logo, opaque white backdrop
  favicon.png                 48   full logo
  splash-icon.png             1024 full logo
  android-icon-background.png 1024 solid white (adaptive background)
  android-icon-foreground.png 1024 V mark only, transparent, safe-zone centered
  android-icon-monochrome.png 1024 V mark only, white on transparent

The logo is deliberately smaller than the canvas so the icon reads as a
small mark with generous margin.

Requires Pillow (e.g. PYTHONPATH=/tmp/pillow-lib).
"""

import sys
from PIL import Image, ImageDraw

SS = 4  # supersample factor for anti-aliasing

# Logo geometry in the 512x512 viewBox: a thick chevron (upside-down V).
V = [(256, 120), (430, 400), (330, 400), (256, 260), (182, 400), (82, 400)]

C_TOP = (114, 107, 234, 255)   # #726BEA (light accent)
C_BOT = (66, 59, 192, 255)     # #423BC0 (deep accent)
C_WHITE = (255, 255, 255, 255)
C_CLEAR = (0, 0, 0, 0)

# V's bounding box in viewBox units is 348 wide x 280 tall.
FULL_SCALE = 800 / 512          # full logo: ~50% of the canvas
FOREGROUND_SCALE = 460 / 320    # adaptive foreground: ~45% of the canvas


def pt(points, ox, oy, s):
    return [(x * s + ox, y * s + oy) for (x, y) in points]


def gradient_fill(img, poly, color_top, color_bottom):
    """Fill `poly` (in img coordinates) with a vertical linear gradient."""
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    x0, y0, x1, y1 = int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))
    if x1 <= x0 or y1 <= y0:
        return
    w, h = x1 - x0 + 1, y1 - y0 + 1
    grad = Image.new("RGBA", (w, h), C_CLEAR)
    gd = ImageDraw.Draw(grad)
    for y in range(h):
        t = y / max(h - 1, 1)
        r = int(color_top[0] + (color_bottom[0] - color_top[0]) * t)
        g = int(color_top[1] + (color_bottom[1] - color_top[1]) * t)
        b = int(color_top[2] + (color_bottom[2] - color_top[2]) * t)
        gd.line((0, y, w, y), fill=(r, g, b, 255))
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).polygon([(px - x0, py - y0) for (px, py) in poly], fill=255)
    img.paste(grad, (x0, y0), mask)


def render(size, *, output_scale, backdrop, top=C_TOP, bot=C_BOT):
    big = size * SS
    img = Image.new("RGBA", (big, big), C_CLEAR)
    if backdrop == "white":
        ImageDraw.Draw(img).rectangle((0, 0, big, big), fill=C_WHITE)
    s = output_scale * SS
    ox = big / 2 - 256 * s
    oy = big / 2 - 256 * s
    gradient_fill(img, pt(V, ox, oy, s), top, bot)
    return img.resize((size, size), Image.LANCZOS).convert("RGBA")


def main():
    out = "assets"
    render(1024, output_scale=FULL_SCALE, backdrop="white").save(f"{out}/icon.png")
    render(48, output_scale=FULL_SCALE * 48 / 1024, backdrop="white").save(f"{out}/favicon.png")
    render(1024, output_scale=FULL_SCALE, backdrop="white").save(f"{out}/splash-icon.png")
    render(1024, output_scale=1.0, backdrop="white").save(f"{out}/android-icon-background.png")
    render(1024, output_scale=FOREGROUND_SCALE, backdrop=None).save(f"{out}/android-icon-foreground.png")
    render(1024, output_scale=FOREGROUND_SCALE, backdrop=None, top=C_WHITE, bot=C_WHITE).save(
        f"{out}/android-icon-monochrome.png"
    )
    print("assets rendered")


if __name__ == "__main__":
    sys.exit(main())
