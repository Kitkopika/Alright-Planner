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
    # Full logo (opaque white backdrop, viewBox 512 -> 1024).
    render(1024, output_scale=1024 / 512, backdrop="white").save(f"{out}/icon.png")
    render(48, output_scale=48 / 512, backdrop="white").save(f"{out}/favicon.png")
    render(1024, output_scale=1024 / 512, backdrop="white").save(f"{out}/splash-icon.png")
    # Adaptive icon: flat white background + foreground mark in the safe zone.
    render(1024, output_scale=1.0, backdrop="white").save(f"{out}/android-icon-background.png")
    # Foreground mark: A height 320 viewBox units -> ~58% of 1024 (safe zone).
    mark_scale = 594 / 320
    render(1024, output_scale=mark_scale, backdrop=None).save(f"{out}/android-icon-foreground.png")
    render(1024, output_scale=mark_scale, backdrop=None, dark=C_WHITE, mid=C_WHITE, bar=C_WHITE).save(
        f"{out}/android-icon-monochrome.png"
    )
    print("assets rendered")


if __name__ == "__main__":
    sys.exit(main())
