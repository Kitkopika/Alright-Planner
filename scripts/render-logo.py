#!/usr/bin/env python3
"""
Renders the app assets from the Alright logo (assets/logo.svg).

The logo is an upside-down "V" forming an "A" (purple on white):
  - White square backdrop
  - Outer "A" polygon   #6C5CE7
  - Inner "A" counter   #4F46E5
  - Crossbar            #8B8FF8 (rounded rect)

Outputs (into assets/):
  icon.png                    1024 full logo, opaque white backdrop
  favicon.png                 48   full logo
  splash-icon.png             1024 full logo
  android-icon-background.png 1024 solid white (adaptive background)
  android-icon-foreground.png 1024 A mark only, transparent, safe-zone centered
  android-icon-monochrome.png 1024 A mark only, white on transparent

The logo is deliberately smaller than the canvas so the icon reads as a
small mark with generous margin:
  - Full-logo renders: the A spans ~50% of the icon.
  - Adaptive foreground: the A spans ~45% of the canvas, safely inside the
    OS mask (~66%).

Requires Pillow (e.g. PYTHONPATH=/tmp/pillow-lib).
"""

import sys
from PIL import Image, ImageDraw

SS = 4  # supersample factor for anti-aliasing

# Logo geometry in the 512x512 viewBox.
OUTER = [(256, 96), (420, 416), (356, 416), (256, 210), (156, 416), (92, 416)]
INNER = [(256, 210), (356, 416), (316, 416), (256, 292), (196, 416), (156, 416)]
CROSSBAR = (196, 340, 196 + 120, 340 + 34)
CROSSBAR_R = 12

C_DARK = (108, 92, 231, 255)    # #6C5CE7
C_MID = (79, 70, 229, 255)      # #4F46E5
C_BAR = (139, 143, 248, 255)    # #8B8FF8
C_WHITE = (255, 255, 255, 255)
C_CLEAR = (0, 0, 0, 0)

# A's bounding box in viewBox units is 328 wide x 320 tall.
# Full logo: 328 * s / 1024 = 0.50  -> s = 1.5625.
FULL_SCALE = 800 / 512
# Adaptive foreground: 320 * s / 1024 = 0.45 -> s = 1.4375.
FOREGROUND_SCALE = 460 / 320


def pt(points, ox, oy, s):
    return [(x * s + ox, y * s + oy) for (x, y) in points]


def render(size, *, output_scale, backdrop, dark=C_DARK, mid=C_MID, bar=C_BAR):
    """Render at `size`; `output_scale` maps the 512 viewBox to output pixels
    (e.g. 2.0 for a 1024 full-logo icon, 1.856 for a centered foreground mark)."""
    big = size * SS
    img = Image.new("RGBA", (big, big), C_CLEAR)
    d = ImageDraw.Draw(img)
    if backdrop == "white":
        d.rectangle((0, 0, big, big), fill=C_WHITE)
    s = output_scale * SS
    ox = big / 2 - 256 * s
    oy = big / 2 - 256 * s
    d.polygon(pt(OUTER, ox, oy, s), fill=dark)
    d.polygon(pt(INNER, ox, oy, s), fill=mid)
    x0, y0, x1, y1 = CROSSBAR
    d.rounded_rectangle(
        (x0 * s + ox, y0 * s + oy, x1 * s + ox, y1 * s + oy),
        radius=CROSSBAR_R * s,
        fill=bar,
    )
    return img.resize((size, size), Image.LANCZOS).convert("RGBA")


def main():
    out = "assets"
    # Full logo (opaque white backdrop): A ~50% of the canvas.
    render(1024, output_scale=FULL_SCALE, backdrop="white").save(f"{out}/icon.png")
    render(48, output_scale=FULL_SCALE * 48 / 1024, backdrop="white").save(f"{out}/favicon.png")
    render(1024, output_scale=FULL_SCALE, backdrop="white").save(f"{out}/splash-icon.png")
    # Adaptive icon: flat white background + foreground mark in the safe zone.
    render(1024, output_scale=1.0, backdrop="white").save(f"{out}/android-icon-background.png")
    # Foreground mark: ~45% of the canvas (inside the OS mask).
    render(1024, output_scale=FOREGROUND_SCALE, backdrop=None).save(f"{out}/android-icon-foreground.png")
    render(1024, output_scale=FOREGROUND_SCALE, backdrop=None, dark=C_WHITE, mid=C_WHITE, bar=C_WHITE).save(
        f"{out}/android-icon-monochrome.png"
    )
    print("assets rendered")


if __name__ == "__main__":
    sys.exit(main())
