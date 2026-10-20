#!/usr/bin/env python3
"""Draw the Android launcher icons from the same shapes as icon.svg (two sails over a hull on dark blue)."""
import os
from PIL import Image, ImageDraw

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
res = os.path.join(root, 'android', 'app', 'src', 'main', 'res')
BG = (5, 13, 22, 255)
SHAPES = [((32, 8), (32, 50), (12, 50), '#ffb020'), ((35, 14), (35, 50), (52, 50), '#4fc3f7')]
HULL = [(8, 54), (56, 54), (50, 60), (14, 60)]


def draw(size, inset, bg=True, round_=False):
    k = 4  # supersample
    S = size * k
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if bg:
        if round_:
            d.ellipse([0, 0, S - 1, S - 1], fill=BG)
        else:
            d.rounded_rectangle([0, 0, S - 1, S - 1], radius=S * 0.18, fill=BG)
    sc = S * (1 - 2 * inset) / 64
    off = S * inset
    tr = lambda p: (off + p[0] * sc, off + p[1] * sc)
    for a, b, c, col in SHAPES:
        d.polygon([tr(a), tr(b), tr(c)], fill=col)
    d.polygon([tr(p) for p in HULL], fill='#eaf3fb')
    return im.resize((size, size), Image.LANCZOS)


SIZES = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
for dpi, s in SIZES.items():
    folder = os.path.join(res, f'mipmap-{dpi}')
    draw(s, 0.08).save(os.path.join(folder, 'ic_launcher.png'))
    draw(s, 0.16, round_=True).save(os.path.join(folder, 'ic_launcher_round.png'))
    # Adaptive icon foreground: 108 dp canvas, the safe zone is the central 66 dp.
    draw(int(s * 108 / 48), 0.27, bg=False).save(os.path.join(folder, 'ic_launcher_foreground.png'))

with open(os.path.join(res, 'values', 'ic_launcher_background.xml'), 'w') as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#050D16</color>\n</resources>\n')
print('icons written')
