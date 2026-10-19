#!/usr/bin/env python3
"""Build a smooth, coast-aware depth overlay for the Fethiye–Göcek gulf.

Inputs (downloaded beforehand):
  mean.tif   EMODnet Bathymetry WCS GetCoverage (emodnet:mean, EPSG:4326, float32, elevation m)
  coast.json Overpass `way["natural"="coastline"](bbox); out geom;`
Outputs (into the app):
  data/depth_vec.json smoothed band polygons + isobath lines + land polygons (offline base map)
  data/depth_lut.png  depth lookup, 16-bit (R=hi, G=lo) decimetres, ~50 m grid
  data/depth.json     bounds of both images

Steps: bilinear upsampling of the grid → OSM water mask (coastline rasterised as a wall, sea
flood-filled from seed points) → cells the grid calls land but OSM calls water are in-painted
from neighbours → near the shore depth is capped at SLOPE × distance to coast → light blur.
"""
import json
import math
import sys

import numpy as np
from PIL import Image, ImageDraw

import argparse
ap = argparse.ArgumentParser()
ap.add_argument('tif'); ap.add_argument('coast'); ap.add_argument('out_dir')
ap.add_argument('--bbox', default='28.74,36.54,29.16,36.79', help='W,S,E,N — same as the WCS request')
ap.add_argument('--seeds', default='36.65,29.00;36.58,28.90;36.70,28.96;36.68,28.89', help='lat,lon;… points in open water')
ap.add_argument('--width', type=int, default=3000, help='output pixels across (~12.5 m for the Göcek bbox)')
a = ap.parse_args()
src_tif, src_coast, out_dir = a.tif, a.coast, a.out_dir

# Grid bbox requested from WCS; output covers the same bbox, rows uniform in Web Mercator.
W0, S0, E0, N0 = map(float, a.bbox.split(','))
OUT_W = a.width
SLOPE = 0.15        # max depth gain per metre from the shore (1:7, conservative)
TRUST = 150         # m: the coarse grid is not trusted closer than this to the shore
BANDS = [0, 2, 5, 10, 20, 30]  # m
COLORS = ['#3b8bd6', '#5fa8e6', '#93c7f1', '#bcdcf7', '#dcedfb', '#f4f9fe']
CONTOURS = [2, 5, 10, 20, 50, 100, 200]

def merc_y(lat):
    return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))

yN, yS = merc_y(N0), merc_y(S0)
OUT_H = round(OUT_W * (yN - yS) / math.radians(E0 - W0))
lon = W0 + (np.arange(OUT_W) + 0.5) / OUT_W * (E0 - W0)
ym = yN - (np.arange(OUT_H) + 0.5) / OUT_H * (yN - yS)
lat = np.degrees(2 * np.arctan(np.exp(ym)) - math.pi / 2)
px_m = (E0 - W0) / OUT_W * 111320 * math.cos(math.radians((N0 + S0) / 2))
print(f'output {OUT_W}x{OUT_H}, {px_m:.1f} m/px')

# ---- depth grid → bilinear onto output grid
g = np.array(Image.open(src_tif), dtype=np.float32)
gh, gw = g.shape
depth_src = np.clip(-g, 0, None)  # metres, land = 0
gx = (lon - W0) / (E0 - W0) * gw - 0.5
gy = (N0 - lat) / (N0 - S0) * gh - 0.5
x0 = np.clip(np.floor(gx).astype(int), 0, gw - 2); fx = np.clip(gx - x0, 0, 1)
y0 = np.clip(np.floor(gy).astype(int), 0, gh - 2); fy = np.clip(gy - y0, 0, 1)
X0, Y0 = np.meshgrid(x0, y0); FX, FY = np.meshgrid(fx, fy)
d = (depth_src[Y0, X0] * (1 - FX) * (1 - FY) + depth_src[Y0, X0 + 1] * FX * (1 - FY)
     + depth_src[Y0 + 1, X0] * (1 - FX) * FY + depth_src[Y0 + 1, X0 + 1] * FX * FY)

# ---- OSM water mask
def to_px(la, lo):
    return ((lo - W0) / (E0 - W0) * OUT_W, (yN - merc_y(la)) / (yN - yS) * OUT_H)

wall = Image.new('L', (OUT_W, OUT_H), 0)
dr = ImageDraw.Draw(wall)
for e in json.load(open(src_coast))['elements']:
    pts = [to_px(p['lat'], p['lon']) for p in e.get('geometry', [])]
    if len(pts) > 1:
        dr.line(pts, fill=255, width=3)
seeds = [tuple(map(float, x.split(','))) for x in a.seeds.split(';')]
for la, lo in seeds:
    x, y = to_px(la, lo)
    if wall.getpixel((int(x), int(y))) == 0:
        ImageDraw.floodfill(wall, (int(x), int(y)), 128)
water = np.array(wall) == 128
print(f'water fraction {water.mean():.2f}')

# ---- distance to coast (m), capped, via iterative dilation of land
land = ~water
dist = np.full(land.shape, np.inf, dtype=np.float32)
dist[land] = 0
front = land.copy()
CAP = 80  # px
for k in range(1, CAP + 1):
    grown = front.copy()
    grown[1:, :] |= front[:-1, :]; grown[:-1, :] |= front[1:, :]
    grown[:, 1:] |= front[:, :-1]; grown[:, :-1] |= front[:, 1:]
    new = grown & ~front
    dist[new] = k * px_m
    front = grown
dist[np.isinf(dist)] = CAP * px_m * 1.5

# ---- in-paint water cells the coarse grid thinks are land / too shallow
valid = water & (((d > 6) & (dist > TRUST)) | (dist > 600))
filled = np.where(valid, d, 0).astype(np.float32)
wsum = valid.astype(np.float32)
for _ in range(800):
    if (water & ~valid).sum() == 0:
        break
    acc = np.zeros_like(filled); cnt = np.zeros_like(filled)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        acc += np.roll(np.roll(filled * wsum, dy, 0), dx, 1)
        cnt += np.roll(np.roll(wsum, dy, 0), dx, 1)
    grow = water & ~valid & (cnt > 0)
    filled[grow] = acc[grow] / cnt[grow]
    wsum[grow] = 1
    valid |= grow
filled[~water] = 0

# ---- shore shoaling + blur
depth = np.minimum(filled, SLOPE * dist)

def blur(a, r):
    k = np.exp(-0.5 * (np.arange(-3 * r, 3 * r + 1) / r) ** 2); k /= k.sum()
    a = np.apply_along_axis(lambda m: np.convolve(m, k, mode='same'), 1, a)
    return np.apply_along_axis(lambda m: np.convolve(m, k, mode='same'), 0, a)

wf = water.astype(np.float32)
depth = blur(depth * wf, 4) / np.maximum(blur(wf, 4), 1e-3)
depth = np.minimum(depth, SLOPE * dist)
depth[~water] = 0

# ---- vector depth: smoothed band polygons + isobath lines (GeoJSON-ish compact arrays)
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

def px2ll(xs, ys):
    lo = W0 + xs / OUT_W * (E0 - W0)
    la = np.degrees(2 * np.arctan(np.exp(yN - ys / OUT_H * (yN - yS))) - math.pi / 2)
    return la, lo

def chaikin(pts, closed, it=3):
    for _ in range(it):
        if len(pts) < 3:
            break
        a = pts if closed else pts[:-1]
        b = np.roll(pts, -1, 0) if closed else pts[1:]
        q = 0.75 * a + 0.25 * b
        r = 0.25 * a + 0.75 * b
        mid = np.empty((len(q) * 2, 2)); mid[0::2] = q; mid[1::2] = r
        pts = mid if closed else np.vstack([pts[:1], mid, pts[-1:]])
    return pts

def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    keep = np.zeros(len(pts), bool); keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        a, b = pts[i], pts[j]
        ab = b - a; L = np.hypot(*ab) or 1e-9
        seg = pts[i + 1:j]
        if not len(seg):
            continue
        d = np.abs(ab[0] * (seg[:, 1] - a[1]) - ab[1] * (seg[:, 0] - a[0])) / L
        k = int(np.argmax(d))
        if d[k] > eps:
            m = i + 1 + k; keep[m] = True
            stack += [(i, m), (m, j)]
    return pts[keep]

def split_path(path):
    rings, cur = [], []
    for v, c in zip(path.vertices, path.codes if path.codes is not None else [1] + [2] * (len(path.vertices) - 1)):
        if c == 1 and cur:
            rings.append(np.array(cur)); cur = []
        if c != 79:
            cur.append(v)
    if cur:
        rings.append(np.array(cur))
    return rings

def to_ll(ring, closed):
    ring = rdp(chaikin(ring, closed), 0.35)  # px; ~4 m
    la, lo = px2ll(ring[:, 0], ring[:, 1])
    return [[round(float(a), 5), round(float(b), 5)] for a, b in zip(la, lo)]

Z = np.where(water, depth, -1.0)
Xg, Yg = np.meshgrid(np.arange(OUT_W) + 0.5, np.arange(OUT_H) + 0.5)
fig = plt.figure()
levels = [0.0] + BANDS[1:] + [100000]
cf = plt.contourf(Xg, Yg, Z, levels=levels)
bands = []
for i, path in enumerate(cf.get_paths()):
    rings = [to_ll(r, True) for r in split_path(path) if len(r) >= 4]
    rings = [r for r in rings if len(r) >= 4]
    bands.append({'from': levels[i], 'to': levels[i + 1], 'color': COLORS[i], 'rings': rings})
iso = []
cl = plt.contour(Xg, Yg, Z, levels=CONTOURS)
for lev, path in zip(CONTOURS, cl.get_paths()):
    lines = [to_ll(r, False) for r in split_path(path) if len(r) >= 6]
    iso.append({'depth': lev, 'lines': [l for l in lines if len(l) >= 3]})
plt.close(fig)
# Land for the offline base map: same OSM water mask, so land and depth never overlap or gap.
lf = plt.contourf(Xg, Yg, (~water).astype(float), levels=[0.5, 1.5])
land = []
for path in lf.get_paths():
    land += [r for r in (to_ll(r, True) for r in split_path(path) if len(r) >= 4) if len(r) >= 4]
plt.close('all')
json.dump({'bands': bands, 'isobaths': iso, 'land': land}, open(f'{out_dir}/depth_vec.json', 'w'), separators=(',', ':'))
print('vector:', sum(len(r) for b in bands for r in b['rings']), 'band pts,', sum(len(l) for x in iso for l in x['lines']), 'isobath pts')

# ---- lookup image (~50 m), decimetres in R/G, land = 0 with B=0, water B=255
step = 4
lut = depth[::step, ::step]
dm = np.clip(np.round(lut * 10), 0, 65535).astype(np.uint16)
img = np.zeros(lut.shape + (3,), dtype=np.uint8)
img[..., 0] = dm >> 8
img[..., 1] = dm & 255
img[..., 2] = np.where(water[::step, ::step], 255, 0)
Image.fromarray(img).save(f'{out_dir}/depth_lut.png', optimize=True)

json.dump({'bounds': [[S0, W0], [N0, E0]], 'w': OUT_W, 'h': OUT_H, 'lutW': img.shape[1], 'lutH': img.shape[0],
           'source': 'EMODnet Bathymetry (GEBCO 2024) + OSM coastline, smoothed'},
          open(f'{out_dir}/depth.json', 'w'))
print('done')
