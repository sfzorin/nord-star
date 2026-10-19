#!/usr/bin/env python3
"""Draw the NORD STAR sail plan (side view, to scale) into index.html (<svg class="boatArt">).

Dimensions: IRC/ORC certificates (LOA 10.99, LWL 9.97, T 2.20, J 4.06, IG 14.14, P 13.98, E 4.87, BAS 1.64).
Hull look from photos of the Dufour 36 Performance: plumb stem, straight sheer, ~1.3 m freeboard, vertical
transom with almost no overhang, dark hull-window strips, very low coachroof with a window band, spray hood,
twin wheels, thin boot line, two swept spreaders, backstay, boom with lazy bag.
Run:  python3 tools/make_boat_svg.py
"""
import os
import re

S = 26.0            # px per metre
WL = 470.0          # waterline y
STEM = 643.0        # stem x (bow faces right)
X = lambda m: STEM - m * S          # metres aft of the stem → x
Y = lambda m: WL - m * S            # metres above the waterline → y

sheer_bow, sheer_aft = Y(1.32), Y(1.25)
stern = X(10.99)
deck_mast = Y(1.30)
mast_x = X(4.06)
boom = deck_mast - 1.642 * S
head = boom - 13.98 * S
fore = deck_mast - 14.137 * S
clew = mast_x - 4.87 * S


def q(p0, c, p1, t):
    return tuple((1 - t) ** 2 * p0[i] + 2 * (1 - t) * t * c[i] + t * t * p1[i] for i in range(2))


def f(v):
    return f'{v:.1f}'


# --- sails
luff = mast_x - 3.4
mh, mc, mcl = (luff - 22, head + 2), (436.0, 205.0), (clew + 1, boom - 2)
main = f'M{f(luff)},{f(boom - 1)} L{f(luff)},{f(head + 1.5)} L{f(mh[0])},{f(mh[1])} Q{f(mc[0])},{f(mc[1])} {f(mcl[0])},{f(mcl[1])} Z'
leech = [q(mh, mc, mcl, t / 12) for t in range(13)]
battens = ''.join(f'<line x1="{f(p[0])}" y1="{f(p[1])}" x2="{f(p[0] + 38)}" y2="{f(p[1] + 1.5)}"/>' for p in (leech[i] for i in (2, 4, 6, 8, 10)))
seams = ''.join(
    f'<line x1="{f(luff)}" y1="{y}" x2="{f(q(mh, mc, mcl, (y - mh[1]) / (mcl[1] - mh[1]))[0])}" y2="{y + 6}"/>'
    for y in (80, 130, 180, 230, 280, 330, 370))
tack, jhead, jclew = (STEM - 2, sheer_bow - 3), (mast_x + 3.6, fore + 3), (mast_x - 15, deck_mast - 9)
jib = (f'M{f(tack[0])},{f(tack[1])} L{f(jhead[0])},{f(jhead[1])} Q{f(mast_x - 3)},250 {f(jclew[0])},{f(jclew[1])} '
       f'Q{f((jclew[0] + tack[0]) / 2)},{f(deck_mast - 1)} {f(tack[0])},{f(tack[1])} Z')
jseams = ''.join(
    f'<line x1="{f(jhead[0] + (tack[0] - jhead[0]) * t)}" y1="{f(jhead[1] + (tack[1] - jhead[1]) * t)}" '
    f'x2="{f(jhead[0] + (jclew[0] - jhead[0]) * t)}" y2="{f(jhead[1] + (jclew[1] - jhead[1]) * t)}"/>' for t in (0.2, 0.4, 0.6, 0.8))

# --- hull: plumb stem, straight sheer, transom bottom just above the WL, LWL ends 1 m forward of it
lwl_aft = X(9.97)
hull = (f'M{f(STEM)},{f(sheer_bow)} L{f(STEM)},{f(WL)} C{f(STEM - 3)},{f(WL + 7)} {f(STEM - 20)},{f(WL + 11)} {f(X(1.6))},{f(WL + 12)} '
        f'L{f(X(8.2))},{f(WL + 11)} C{f(X(9.2))},{f(WL + 9)} {f(lwl_aft + 6)},{f(WL + 4)} {f(lwl_aft)},{f(WL)} '
        f'Q{f(X(10.5))},{f(Y(0.12))} {f(stern)},{f(Y(0.16))} L{f(stern)},{f(sheer_aft)} Z')
win = lambda a, b, h=0.72, t=0.11: f'<rect x="{f(X(b))}" y="{f(Y(h) - t * S / 2)}" width="{f((b - a) * S)}" height="{f(t * S)}" rx="1.2"/>'
hull_windows = win(0.85, 5.1) + win(5.25, 6.0) + win(6.15, 10.85)
roof = (f'M{f(X(2.9))},{f(sheer_bow + 0.5)} C{f(X(3.0))},{f(sheer_bow - 4)} {f(X(3.3))},{f(sheer_bow - 5.5)} {f(X(3.8))},{f(sheer_bow - 5.5)} '
        f'L{f(X(7.7))},{f(sheer_bow - 5)} C{f(X(7.95))},{f(sheer_bow - 4.5)} {f(X(8.1))},{f(sheer_bow - 2)} {f(X(8.1))},{f(sheer_aft + 0.5)} Z')
# Spray hood: rounded canvas box over the companionway, ~0.9 m above deck.
hood = (f'M{f(X(6.35))},{f(sheer_bow - 5)} C{f(X(6.45))},{f(Y(2.0))} {f(X(6.7))},{f(Y(2.2))} {f(X(7.0))},{f(Y(2.2))} '
        f'L{f(X(7.95))},{f(Y(2.12))} C{f(X(8.15))},{f(Y(2.1))} {f(X(8.25))},{f(Y(1.9))} {f(X(8.25))},{f(sheer_aft)} '
        f'L{f(X(7.7))},{f(sheer_aft - 0.5)} L{f(X(7.6))},{f(sheer_bow - 4)} Z')
hood_win = f'M{f(X(6.55))},{f(Y(1.75))} C{f(X(6.65))},{f(Y(2.02))} {f(X(6.85))},{f(Y(2.08))} {f(X(7.1))},{f(Y(2.08))} L{f(X(7.1))},{f(Y(1.75))} Z'
stanchions = ''.join(f'<line x1="{f(X(m))}" y1="{f(Y(1.3))}" x2="{f(X(m))}" y2="{f(Y(1.3) - 0.62 * S)}"/>' for m in (1.0, 2.6, 4.2, 5.8, 7.4, 8.9))
wheels = ''.join(f'<ellipse cx="{f(X(m))}" cy="{f(sheer_aft - 13)}" rx="2.6" ry="12" fill="none" stroke="#9db4c6" stroke-width="1.6"/>' for m in (9.35, 9.75))
grid = (''.join(f'<line x1="{x}" y1="20" x2="{x}" y2="590"/>' for x in range(330, 720, 26))
        + ''.join(f'<line x1="330" y1="{y}" x2="715" y2="{y}"/>' for y in range(28, 592, 26)))
mono = 'ui-monospace,Menlo,monospace'

svg = f'''<svg class="boatArt" viewBox="0 0 900 600" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Чертёж парусности NORD STAR, RUS 3635, Dufour 36 Performance">
      <defs>
        <clipPath id="hullClip"><path d="{hull}"/></clipPath>
        <marker id="tk" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M3 0V6" stroke="#5fa8d3" stroke-width="1"/></marker>
      </defs>
      <rect width="900" height="600" fill="#071523"/>
      <g stroke="#10283b" stroke-width="0.6">{grid}</g>
      <rect x="330" y="{f(WL)}" width="385" height="120" fill="#0a2335" opacity="0.7"/>
      <line x1="330" y1="{f(WL)}" x2="715" y2="{f(WL)}" stroke="#2c6b94" stroke-width="1" stroke-dasharray="5 4"/>
      <text x="334" y="{f(WL - 4)}" font-family="{mono}" font-size="10" fill="#4f8fb8">КВЛ</text>
      <g stroke="#9db4c6" stroke-width="1.1" fill="none">
        <line x1="{f(STEM)}" y1="{f(sheer_bow)}" x2="{f(mast_x + 2)}" y2="{f(fore)}"/>
        <line x1="{f(mast_x)}" y1="{f(head)}" x2="{f(stern + 3)}" y2="{f(sheer_aft)}"/>
        <line x1="{f(mast_x)}" y1="{f(fore)}" x2="{f(X(4.4))}" y2="{f(sheer_bow)}" opacity="0.55"/>
        <line x1="{f(mast_x)}" y1="175" x2="{f(X(4.4))}" y2="{f(sheer_bow)}" opacity="0.4"/>
      </g>
      <path d="{jib}" fill="#eef3f7" stroke="#8ea6b9" stroke-width="1.2"/>
      <g stroke="#c9d6e1" stroke-width="0.8">{jseams}</g>
      <path d="{main}" fill="#f5f8fa" stroke="#8ea6b9" stroke-width="1.2"/>
      <g stroke="#c9d6e1" stroke-width="0.8">{seams}</g>
      <g stroke="#7f98ad" stroke-width="1.6">{battens}</g>
      <path d="M498,112 l5,11 12,1 -9,8 3,12 -11,-6 -11,6 3,-12 -9,-8 12,-1 Z" fill="#ffb020"/>
      <text x="452" y="206" font-family="system-ui,Arial" font-weight="800" font-size="22" fill="#0b2a46">RUS</text>
      <text x="446" y="238" font-family="system-ui,Arial" font-weight="800" font-size="28" fill="#0b2a46">3635</text>
      <rect x="{f(mast_x - 3)}" y="{f(head)}" width="5.5" height="{f(deck_mast - head)}" fill="#c3ced7"/>
      <g stroke="#c3ced7" stroke-width="2"><line x1="{f(mast_x + 2)}" y1="175" x2="{f(mast_x + 12)}" y2="178"/><line x1="{f(mast_x + 2)}" y1="300" x2="{f(mast_x + 14)}" y2="303"/></g>
      <line x1="{f(mast_x - 1)}" y1="{f(boom)}" x2="{f(clew)}" y2="{f(boom + 1)}" stroke="#c3ced7" stroke-width="4" stroke-linecap="round"/>
      <path d="M{f(mast_x - 4)},{f(boom + 2)} L{f(clew + 8)},{f(boom + 3)} L{f(clew + 10)},{f(boom + 8)} L{f(mast_x - 6)},{f(boom + 9)} Z" fill="#2a3540"/>
      <line x1="{f(X(5.0))}" y1="{f(boom + 9)}" x2="{f(mast_x - 2)}" y2="{f(deck_mast - 10)}" stroke="#9db4c6" stroke-width="1.2"/>
      <path d="{hull}" fill="#f7f9fb"/>
      <g clip-path="url(#hullClip)">
        <rect x="340" y="{f(WL - 0.5)}" width="320" height="30" fill="#162f46"/>
        <line x1="{f(X(10.4))}" y1="{f(Y(0.11))}" x2="{f(STEM)}" y2="{f(Y(0.11))}" stroke="#2a3540" stroke-width="1.6"/>
      </g>
      <g fill="#2a3540">{hull_windows}</g>
      <path d="{hull}" fill="none" stroke="#8ea6b9" stroke-width="1"/>
      <line x1="{f(stern)}" y1="{f(sheer_aft)}" x2="{f(STEM)}" y2="{f(sheer_bow)}" stroke="#d9e2ea" stroke-width="1.6"/>
      <path d="{roof}" fill="#eef2f6" stroke="#9fb3c4" stroke-width="0.8"/>
      <rect x="{f(X(7.4))}" y="{f(sheer_bow - 4)}" width="{f(3.9 * S)}" height="2.4" rx="1.2" fill="#2a3540"/>
      <path d="{hood}" fill="#c4d0da" stroke="#9fb3c4" stroke-width="0.8"/>
      <path d="{hood_win}" fill="#5d7489" opacity="0.8"/>
      <g stroke="#9db4c6" stroke-width="1">{stanchions}</g>
      <polyline points="{f(X(0.25))},{f(sheer_bow)} {f(X(0.3))},{f(Y(1.95))} {f(X(8.9))},{f(Y(1.92))}" fill="none" stroke="#9db4c6" stroke-width="0.9" opacity="0.8"/>
      <path d="M{f(stern + 1)},{f(sheer_aft)} L{f(stern + 1)},{f(Y(1.95))} L{f(X(9.9))},{f(Y(1.95))}" fill="none" stroke="#9db4c6" stroke-width="1.1"/>
      {wheels}
      <path d="M{f(STEM)},{f(sheer_bow + 1)} L{f(STEM + 8)},{f(sheer_bow + 1.5)} L{f(STEM + 7)},{f(sheer_bow + 4)} L{f(STEM)},{f(sheer_bow + 4)}" fill="#c3ced7"/>
      <text x="{f(X(3.2))}" y="{f(Y(0.25))}" font-family="system-ui,Arial" font-weight="800" font-size="8.5" letter-spacing="1.2" fill="#2a3540">NORD STAR</text>
      <path d="M526,486 L519,517 L505,518 L498,486 Z" fill="#162f46"/>
      <ellipse cx="512" cy="521" rx="30" ry="6.5" fill="#162f46"/>
      <path d="M{f(X(9.15))},{f(WL + 12)} L{f(X(9.65))},{f(WL + 11)} L{f(X(9.55))},{f(Y(-1.65))} L{f(X(9.25))},{f(Y(-1.62))} Z" fill="#162f46"/>
      <g stroke="#5fa8d3" stroke-width="0.9" fill="none" marker-start="url(#tk)" marker-end="url(#tk)">
        <line x1="{f(stern)}" y1="572" x2="{f(STEM)}" y2="572"/>
        <line x1="{f(lwl_aft)}" y1="550" x2="{f(STEM)}" y2="550"/>
        <line x1="694" y1="{f(WL)}" x2="694" y2="527"/>
        <line x1="{f(mast_x)}" y1="{f(Y(1.75))}" x2="{f(STEM)}" y2="{f(Y(1.75))}"/>
        <line x1="{f(clew)}" y1="{f(boom - 8)}" x2="{f(mast_x)}" y2="{f(boom - 8)}"/>
        <line x1="350" y1="{f(WL)}" x2="350" y2="{f(head)}"/>
      </g>
      <g font-family="{mono}" font-size="12" fill="#8fc3e6">
        <text x="470" y="589">LOA 10.99 м</text>
        <text x="476" y="545">LWL 9.97 м</text>
        <text x="699" y="503">T 2.20</text>
        <text x="{f(mast_x + 30)}" y="{f(Y(1.75) - 4)}">J 4.06</text>
        <text x="448" y="{f(boom - 12)}">E 4.87</text>
        <text x="356" y="240" transform="rotate(-90 356 240)">≈ 17.0 м над КВЛ</text>
      </g>
      <g font-family="system-ui,Arial">
        <text x="40" y="96" font-size="40" font-weight="800" fill="#eaf3fb" letter-spacing="2">NORD STAR</text>
        <text x="42" y="132" font-size="26" font-weight="800" fill="#ffb020" letter-spacing="2">RUS 3635</text>
        <line x1="40" y1="152" x2="300" y2="152" stroke="#1d3650"/>
        <text x="40" y="180" font-size="15" fill="#c9d8e6">Dufour 36 Performance</text>
        <text x="40" y="200" font-size="13" fill="#7e98b0">Felci Yacht Design · 2012</text>
        <g font-family="{mono}" font-size="12.5" fill="#9fb8cc">
          <text x="40" y="236">LOA   10.99 м</text><text x="40" y="256">LWL    9.97 м</text>
          <text x="40" y="276">B      3.61 м</text><text x="40" y="296">T      2.20 м</text>
          <text x="40" y="316">Δ      5950 кг</text><text x="40" y="336">P 13.98 · E 4.87</text><text x="40" y="356">J 4.06 · IG 14.14</text>
          <text x="40" y="378">IRC TCC 0.997</text>
        </g>
        <text x="40" y="410" font-size="12" fill="#7e98b0">Чертёж парусности, масштаб</text>
        <g stroke="#5fa8d3" stroke-width="1"><line x1="40" y1="426" x2="170" y2="426"/>{''.join(f'<line x1="{40 + i * 26}" y1="422" x2="{40 + i * 26}" y2="430"/>' for i in range(6))}</g>
        <text x="40" y="444" font-family="{mono}" font-size="10" fill="#7e98b0">0</text>
        <text x="160" y="444" font-family="{mono}" font-size="10" fill="#7e98b0">5 м</text>
      </g>
    </svg>'''

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = os.path.join(root, 'index.html')
s = open(p).read()
s = re.sub(r'<svg class="boatArt".*?</svg>', lambda _: svg, s, count=1, flags=re.S)
open(p, 'w').write(s)
print('boat drawing written')
