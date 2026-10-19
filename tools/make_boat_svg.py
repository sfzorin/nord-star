#!/usr/bin/env python3
"""Draw the NORD STAR side elevation (to scale) into index.html (<svg class="boatArt">).

Dimensions from the IRC/ORC certificates: LOA 10.99, LWL 9.97, T 2.20, J 4.06, IG 14.14, P 13.98, E 4.87,
BAS 1.64 (m). Look from photos/reviews of the Dufour 36 Performance (Umberto Felci): plumb stem, nearly vertical
topsides with a hard chine aft, ~1.3 m freeboard, stern lifting clear of the water (bottom leaves the water ~1 m
forward of the transom), hull-window strips, very low coachroof with a window band, twin wheels, straight boot
line, fractional rig with two swept spreaders, split backstay, deep T-keel with bulb, spade rudder.
Run:  python3 tools/make_boat_svg.py
"""
import math
import os
import re

S = 30.0                 # px per metre
WL = 560.0               # waterline y
STEM = 880.0             # stem x; the boat faces right
X = lambda m: STEM - m * S       # metres aft of the stem → x
Y = lambda m: WL - m * S         # metres above the waterline → y
f = lambda v: f'{v:.1f}'
P = lambda m, h: f'{f(X(m))},{f(Y(h))}'    # point from (metres aft, metres up)

LOA, LWL = 10.99, 9.97
TRANSOM_LOW = 0.20               # transom lower edge above the waterline
SHEER_BOW, SHEER_AFT = 1.32, 1.22
DECK_AT_MAST = 1.30
MAST = 4.06                      # J: stem to mast front
BAS, PL, E, IG = 1.642, 13.98, 4.87, 14.137
boom_h = DECK_AT_MAST + BAS
head_h = boom_h + PL
hounds_h = DECK_AT_MAST + IG


def sheer(m):
    """Sheer height (m) at a station: straight line with a hint of spring."""
    t = m / LOA
    return SHEER_BOW + (SHEER_AFT - SHEER_BOW) * t - 0.04 * 4 * t * (1 - t)


sheer_pts = [m for m in [LOA - 0.5 * i for i in range(1, 22)] if m > 0]

# ---------------------------------------------------------------- hull
hull = (f'M{P(0, SHEER_BOW)} L{P(0, 0)} '
        f'C{P(0.05, -0.22)} {P(0.35, -0.36)} {P(1.0, -0.40)} '            # forefoot under the plumb stem
        f'C{P(2.5, -0.43)} {P(5.0, -0.43)} {P(6.0, -0.40)} '              # flat, U-shaped canoe body
        f'C{P(7.6, -0.33)} {P(9.0, -0.16)} {P(LWL, 0.0)} '                # run reaches the WL at the LWL end
        f'C{P(10.3, 0.06)} {P(10.7, 0.14)} {P(LOA, TRANSOM_LOW)} '        # …and lifts clear to the transom
        f'L{P(LOA, SHEER_AFT)} '
        + ' '.join(f'L{P(m, sheer(m))}' for m in sheer_pts)
        + f' L{P(0, SHEER_BOW)} Z')
below = f'M{f(X(LOA) - 5)},{f(WL)} H{f(STEM + 5)} V{f(WL + 40)} H{f(X(LOA) - 5)} Z'
# Hard chine: from amidships, rising to the transom corner.
chine = f'M{P(4.8, 0.05)} C{P(7.0, 0.1)} {P(9.0, 0.2)} {P(LOA, TRANSOM_LOW + 0.12)}'


def strip(a, b, h, t=0.085, slant=0.05):
    """Hull-window strip a→b metres aft, centred h m above WL, ends slanted like the real glazing."""
    y0, y1 = Y(h + t / 2), Y(h - t / 2)
    return (f'M{f(X(a))},{f(y0)} L{f(X(b))},{f(y0)} L{f(X(b) + slant * S)},{f(y1)} '
            f'L{f(X(a) + slant * S)},{f(y1)} Z')


windows = strip(0.95, 5.05, 0.76) + strip(5.2, 5.85, 0.76) + strip(6.0, 10.7, 0.76)
# Coachroof (from the photos): very low and long — gentle wedge forward, flat top ~0.22–0.25 m above the
# deck, near-vertical aft face at the companionway; a long thin window band with a rounded forward end.
R = lambda m, h: P(m, sheer(m) + h)
roof = (f'M{R(2.75, 0)} C{R(3.1, 0.05)} {R(3.35, 0.19)} {R(3.9, 0.215)} '
        f'L{R(7.78, 0.245)} Q{R(8.02, 0.245)} {R(8.04, 0.2)} L{R(8.07, 0)} Z')
roof_top = f'M{R(3.95, 0.215)} L{R(7.75, 0.245)}'
roof_win = (f'M{R(3.72, 0.165)} L{R(7.62, 0.19)} L{R(7.6, 0.115)} L{R(3.8, 0.1)} '
            f'Q{R(3.62, 0.105)} {R(3.62, 0.135)} Q{R(3.62, 0.162)} {R(3.72, 0.165)} Z')
roof_port = f'M{R(4.15, 0.06)} h{f(0.32 * S)} v-2.2 h-{f(0.32 * S)} Z'
handrail = f'M{R(4.3, 0.215)} l0,-2 L{f(X(7.3))},{f(Y(sheer(7.3) + 0.245) - 2)} l0,2'

# ---------------------------------------------------------------- appendages
keel = f'M{P(4.55, -0.30)} L{P(5.70, -0.30)} L{P(5.62, -1.86)} L{P(4.98, -1.86)} Z'
bulb = (f'M{P(4.30, -2.03)} C{P(4.30, -1.88)} {P(4.55, -1.85)} {P(4.9, -1.85)} '
        f'L{P(6.0, -1.88)} C{P(6.35, -1.9)} {P(6.6, -2.0)} {P(6.75, -2.03)} '
        f'C{P(6.6, -2.07)} {P(6.35, -2.14)} {P(6.0, -2.17)} '
        f'L{P(4.9, -2.20)} C{P(4.55, -2.20)} {P(4.30, -2.15)} {P(4.30, -2.03)} Z')
rudder = (f'M{P(9.02, -0.05)} L{P(9.62, -0.0)} C{P(9.66, -0.6)} {P(9.62, -1.25)} {P(9.48, -1.55)} '
          f'C{P(9.4, -1.64)} {P(9.22, -1.64)} {P(9.16, -1.55)} C{P(9.1, -1.15)} {P(9.05, -0.55)} {P(9.02, -0.05)} Z')

# ---------------------------------------------------------------- rig
mx = X(MAST)                                   # mast front
mast = (f'M{f(mx)},{f(Y(DECK_AT_MAST))} L{f(mx)},{f(Y(head_h))} L{f(mx - 3.2)},{f(Y(head_h) - 1)} '
        f'L{f(mx - 5.4)},{f(Y(hounds_h))} L{f(mx - 5.6)},{f(Y(DECK_AT_MAST))} Z')
spreaders = ''.join(f'<line x1="{f(mx - 2)}" y1="{f(Y(h))}" x2="{f(mx - 2 - 0.42 * S)}" y2="{f(Y(h) + 1.5)}"/>'
                    for h in (DECK_AT_MAST + 5.7, DECK_AT_MAST + 10.4))
chain = X(4.45)
bs_split = (X(9.5), Y(sheer(9.5) + 2.0))
rigging = (f'<line x1="{f(X(-0.06))}" y1="{f(Y(SHEER_BOW + 0.05))}" x2="{f(mx)}" y2="{f(Y(hounds_h))}" stroke-width="1.4"/>'
           f'<line x1="{f(mx - 4)}" y1="{f(Y(hounds_h))}" x2="{f(chain)}" y2="{f(Y(sheer(4.45)))}" opacity="0.6"/>'
           f'<line x1="{f(mx - 4)}" y1="{f(Y(DECK_AT_MAST + 10.4))}" x2="{f(chain + 4)}" y2="{f(Y(sheer(4.45)))}" opacity="0.45"/>'
           f'<line x1="{f(mx - 3)}" y1="{f(Y(head_h))}" x2="{f(bs_split[0])}" y2="{f(bs_split[1])}"/>'
           f'<line x1="{f(bs_split[0])}" y1="{f(bs_split[1])}" x2="{f(X(LOA - 0.12))}" y2="{f(Y(SHEER_AFT))}"/>'
           f'<line x1="{f(bs_split[0])}" y1="{f(bs_split[1])}" x2="{f(X(LOA - 0.5))}" y2="{f(Y(sheer(LOA - 0.5)))}" opacity="0.6"/>')
boom_x0, boom_x1 = mx - 5.4, mx - 5.4 - E * S
boom = (f'M{f(boom_x0)},{f(Y(boom_h) - 2)} L{f(boom_x1)},{f(Y(boom_h) - 1.5)} '
        f'L{f(boom_x1 + 2)},{f(Y(boom_h) + 3)} L{f(boom_x0)},{f(Y(boom_h) + 3.5)} Z')
vang = f'M{f(boom_x0 - 1.1 * S)},{f(Y(boom_h) + 3)} L{f(mx - 6)},{f(Y(DECK_AT_MAST + 0.35))}'
mainsheet = f'M{f(boom_x1 + 0.6 * S)},{f(Y(boom_h) + 3)} L{f(X(8.05))},{f(Y(sheer(8.05) + 0.14))}'


def q(p0, c, p1, t):
    return tuple((1 - t) ** 2 * p0[i] + 2 * (1 - t) * t * c[i] + t * t * p1[i] for i in range(2))


# Mainsail: luff on the mast track, square-ish head, roach, foot on the boom.
luff_x = mx - 5.6
m_head = (luff_x - 0.85 * S, Y(head_h) + 2)
m_clew = (boom_x1 + 2, Y(boom_h) - 3)
m_ctrl = ((m_head[0] + m_clew[0]) / 2 - 1.15 * S, (m_head[1] + m_clew[1]) / 2)
main = (f'M{f(luff_x)},{f(Y(boom_h) - 3)} L{f(luff_x)},{f(Y(head_h) + 1.5)} L{f(m_head[0])},{f(m_head[1])} '
        f'Q{f(m_ctrl[0])},{f(m_ctrl[1])} {f(m_clew[0])},{f(m_clew[1])} '
        f'Q{f((luff_x + m_clew[0]) / 2)},{f(Y(boom_h) - 9)} {f(luff_x)},{f(Y(boom_h) - 3)} Z')
battens = ''
for t in (0.1, 0.3, 0.5, 0.7, 0.86):
    px, py = q(m_head, m_ctrl, m_clew, t)
    length = (luff_x - px) if t < 0.15 else 1.6 * S
    battens += f'<line x1="{f(px)}" y1="{f(py)}" x2="{f(px + length)}" y2="{f(py + 1.5)}"/>'
draft = ''
for t in (0.28, 0.55, 0.8):
    px, py = q(m_head, m_ctrl, m_clew, t)
    draft += f'<path d="M{f(luff_x)},{f(py + 4)} Q{f((luff_x + px) / 2 - 6)},{f(py + 9)} {f(px + 4)},{f(py + 3)}"/>'

# Jib (~105 %): tack at the stem, head just under the hounds, clew a little aft of the mast.
j_tack = (X(0.05), Y(SHEER_BOW + 0.18))
j_head = (mx + 4, Y(hounds_h - 0.3))
j_clew = (mx - 0.55 * S, Y(DECK_AT_MAST + 0.45))
jib = (f'M{f(j_tack[0])},{f(j_tack[1])} L{f(j_head[0])},{f(j_head[1])} '
       f'Q{f(mx - 0.1 * S)},{f(Y(hounds_h * 0.45))} {f(j_clew[0])},{f(j_clew[1])} '
       f'Q{f((j_clew[0] + j_tack[0]) / 2)},{f(Y(DECK_AT_MAST + 0.2))} {f(j_tack[0])},{f(j_tack[1])} Z')
jdraft = ''
for t in (0.3, 0.55, 0.8):
    ax, ay = j_head[0] + (j_tack[0] - j_head[0]) * t, j_head[1] + (j_tack[1] - j_head[1]) * t
    bx, by = j_head[0] + (j_clew[0] - j_head[0]) * t, j_head[1] + (j_clew[1] - j_head[1]) * t
    jdraft += f'<path d="M{f(ax)},{f(ay)} Q{f((ax + bx) / 2)},{f((ay + by) / 2 + 7)} {f(bx)},{f(by)}"/>'
jsheet = f'M{f(j_clew[0])},{f(j_clew[1])} L{f(X(6.1))},{f(Y(sheer(6.1) + 0.05))}'

# ---------------------------------------------------------------- deck gear
stations = [1.2, 2.8, 4.4, 6.0, 7.6, 8.9]
stanch = ''.join(f'<line x1="{f(X(m))}" y1="{f(Y(sheer(m)))}" x2="{f(X(m))}" y2="{f(Y(sheer(m) + 0.62))}"/>' for m in stations)
lifelines = ''.join(
    f'<polyline points="{P(0.45, SHEER_BOW + h)} ' + ' '.join(P(m, sheer(m) + h) for m in stations) + f' {P(LOA - 0.05, SHEER_AFT + h)}"/>'
    for h in (0.62, 0.33))
pulpit = f'M{P(0.02, SHEER_BOW)} L{P(0.0, SHEER_BOW + 0.62)} Q{P(0.05, SHEER_BOW + 0.7)} {P(0.45, SHEER_BOW + 0.62)} L{P(0.5, SHEER_BOW)}'
pushpit = f'M{P(LOA - 0.05, SHEER_AFT)} L{P(LOA - 0.05, SHEER_AFT + 0.62)} L{P(9.6, sheer(9.6) + 0.62)} L{P(9.55, sheer(9.55))}'


def wheel(m, near=True):
    """Stainless helm wheel seen from the side with a little perspective, on a pedestal just forward of it."""
    cx, cy = X(m), Y(sheer(m) + 0.36)
    r, rx = 0.46 * S, 0.46 * S * 0.42
    rim, spoke, op = ('#d3dce4', '#b7c4cf', 1.0) if near else ('#9fb0bf', '#8a9bab', 0.75)
    px = cx + 0.16 * S                                          # pedestal forward of the wheel
    g = [f'<g opacity="{op}">',
         f'<path d="M{f(px - 1.8)},{f(Y(sheer(m) - 0.02))} L{f(px - 1.1)},{f(cy - 2)} L{f(px + 1.1)},{f(cy - 2)} L{f(px + 1.8)},{f(Y(sheer(m) - 0.02))} Z" fill="#8e9daa"/>',
         f'<rect x="{f(px - 1)}" y="{f(cy - 7)}" width="5" height="7" rx="1.2" fill="#26323d"/>',
         f'<line x1="{f(cx)}" y1="{f(cy)}" x2="{f(px)}" y2="{f(cy - 1.5)}" stroke="#8e9daa" stroke-width="1.6"/>']
    for k in range(6):
        a = math.radians(30 + 60 * k)
        g.append(f'<line x1="{f(cx)}" y1="{f(cy)}" x2="{f(cx + rx * math.cos(a))}" y2="{f(cy + r * math.sin(a))}" stroke="{spoke}" stroke-width="0.8"/>')
    g.append(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(r)}" fill="none" stroke="{rim}" stroke-width="1.8"/>')
    g.append(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="1.8" fill="{rim}"/></g>')
    return ''.join(g)


wheels = wheel(9.72, near=False) + wheel(9.32)
grid = (''.join(f'<line x1="{x:.0f}" y1="30" x2="{x:.0f}" y2="652"/>' for x in [STEM - k * S for k in range(-1, 14)])
        + ''.join(f'<line x1="{f(X(12.5))}" y1="{y:.0f}" x2="{f(X(-1))}" y2="{y:.0f}"/>' for y in [WL - k * S for k in range(-3, 18)]))
mono = 'ui-monospace,Menlo,monospace'
dim = lambda x1, y1, x2, y2: f'<line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}"/>'
sheer_line = f'M{P(LOA, SHEER_AFT)} ' + ' '.join(f'L{P(m, sheer(m))}' for m in sheer_pts) + f' L{P(0, SHEER_BOW)}'

svg = f'''<svg class="boatArt" viewBox="0 0 960 680" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Профиль NORD STAR, RUS 3635, Dufour 36 Performance">
      <defs>
        <clipPath id="hullClip"><path d="{hull}"/></clipPath>
        <linearGradient id="topsides" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.7" stop-color="#eef2f6"/><stop offset="1" stop-color="#d9e1e9"/></linearGradient>
        <linearGradient id="bottom" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b3550"/><stop offset="1" stop-color="#10233a"/></linearGradient>
        <linearGradient id="mainG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e6ecf1"/><stop offset="0.35" stop-color="#ffffff"/><stop offset="1" stop-color="#e1e8ee"/></linearGradient>
        <linearGradient id="jibG" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#e4eaf0"/><stop offset="0.4" stop-color="#fbfcfd"/><stop offset="1" stop-color="#dde4eb"/></linearGradient>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d2c44"/><stop offset="1" stop-color="#071a2b"/></linearGradient>
        <marker id="tk" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M3 0V6" stroke="#5fa8d3" stroke-width="1"/></marker>
      </defs>
      <rect width="960" height="680" fill="#071523"/>
      <g stroke="#0f2638" stroke-width="0.6">{grid}</g>
      <rect x="{f(X(12.5))}" y="{f(WL)}" width="{f(13.5 * S)}" height="{f(680 - WL)}" fill="url(#sea)" opacity="0.85"/>
      <line x1="{f(X(12.5))}" y1="{f(WL)}" x2="{f(X(-1))}" y2="{f(WL)}" stroke="#2c6b94" stroke-width="1" stroke-dasharray="6 4"/>
      <text x="{f(X(12.4))}" y="{f(WL - 5)}" font-family="{mono}" font-size="10" fill="#4f8fb8">КВЛ</text>

      <g stroke="#9db4c6" stroke-width="1" fill="none">{rigging}</g>
      <path d="{jib}" fill="url(#jibG)" stroke="#8ea6b9" stroke-width="1"/>
      <g stroke="#b6c5d2" stroke-width="0.9" fill="none" opacity="0.8">{jdraft}</g>
      <path d="{jsheet}" stroke="#9db4c6" stroke-width="0.9" fill="none"/>
      <path d="{main}" fill="url(#mainG)" stroke="#8ea6b9" stroke-width="1"/>
      <g stroke="#b6c5d2" stroke-width="0.9" fill="none" opacity="0.8">{draft}</g>
      <g stroke="#8aa2b6" stroke-width="1.6" stroke-linecap="round">{battens}</g>
      <g transform="translate({f(luff_x - 0.75 * S)},{f(Y(head_h - 2.2))}) scale(0.85)"><path d="M0,-13 l4,9 10,1 -7.5,6.5 2.4,10 -8.9,-5.3 -8.9,5.3 2.4,-10 -7.5,-6.5 10,-1 Z" fill="#ffb020"/></g>
      <g font-family="system-ui,Arial" font-weight="800" fill="#0b2a46" text-anchor="end">
        <text x="{f(luff_x - 0.3 * S)}" y="{f(Y(head_h - 4.6))}" font-size="22">RUS</text>
        <text x="{f(luff_x - 0.3 * S)}" y="{f(Y(head_h - 5.8))}" font-size="30">3635</text>
      </g>
      <path d="{mast}" fill="#c3ced7"/>
      <g stroke="#c3ced7" stroke-width="2.2" stroke-linecap="round">{spreaders}</g>
      <path d="{boom}" fill="#b9c5cf"/>
      <path d="{vang}" stroke="#9db4c6" stroke-width="2"/>
      <path d="{mainsheet}" stroke="#9db4c6" stroke-width="0.9"/>

      <path d="{hull}" fill="url(#topsides)"/>
      <g clip-path="url(#hullClip)">
        <path d="{below}" fill="url(#bottom)"/>
        <line x1="{f(X(LWL - 0.3))}" y1="{f(Y(0.11))}" x2="{f(STEM)}" y2="{f(Y(0.11))}" stroke="#25323e" stroke-width="1.6"/>
        <path d="{chine}" fill="none" stroke="#b4c2ce" stroke-width="1.2"/>
        <path d="{windows}" fill="#26323d"/>
        <text x="{f(X(3.4))}" y="{f(Y(0.36))}" font-family="system-ui,Arial" font-weight="800" font-size="10" letter-spacing="1.6" fill="#26323d">NORD STAR</text>
      </g>
      <path d="{hull}" fill="none" stroke="#7f97ab" stroke-width="1"/>
      <path d="{sheer_line}" fill="none" stroke="#9aaebf" stroke-width="2.2"/>
      <path d="{roof}" fill="#edf1f5" stroke="#9fb3c4" stroke-width="0.8"/>
      <path d="{roof_top}" fill="none" stroke="#ffffff" stroke-width="1.2" opacity="0.9"/>
      <path d="{roof_win}" fill="#26323d"/>
      <path d="{roof_port}" fill="#26323d" opacity="0.85"/>
      <path d="{handrail}" fill="none" stroke="#a9b8c5" stroke-width="1"/>
      <g stroke="#9db4c6" stroke-width="1" fill="none">{stanch}{lifelines}<path d="{pulpit}" stroke-width="1.4"/><path d="{pushpit}" stroke-width="1.4"/></g>
      {wheels}
      <path d="M{P(0, SHEER_BOW + 0.02)} L{P(-0.28, SHEER_BOW + 0.04)} L{P(-0.26, SHEER_BOW - 0.08)} L{P(0, SHEER_BOW - 0.1)} Z" fill="#c3ced7"/>
      <rect x="{f(X(0.12))}" y="{f(Y(SHEER_BOW + 0.22))}" width="7" height="6" rx="2" fill="#9db4c6"/>

      <path d="{keel}" fill="url(#bottom)" stroke="#2a4a66" stroke-width="0.8"/>
      <path d="{bulb}" fill="#132a42" stroke="#2a4a66" stroke-width="0.8"/>
      <path d="{rudder}" fill="url(#bottom)" stroke="#2a4a66" stroke-width="0.8"/>

      <g stroke="#5fa8d3" stroke-width="0.9" fill="none" marker-start="url(#tk)" marker-end="url(#tk)">
        {dim(X(LOA), 664, STEM, 664)}
        {dim(X(LWL), 642, STEM, 642)}
        {dim(STEM + 28, WL, STEM + 28, Y(-2.2))}
        {dim(mx, Y(SHEER_BOW + 1.05), STEM, Y(SHEER_BOW + 1.05))}
        {dim(boom_x1, Y(boom_h) - 12, luff_x, Y(boom_h) - 12)}
        {dim(X(11.6), WL, X(11.6), Y(head_h))}
      </g>
      <g font-family="{mono}" font-size="12" fill="#8fc3e6">
        <text x="{f(X(6.2))}" y="678">LOA 10.99 м</text>
        <text x="{f(X(5.9))}" y="637">LWL 9.97 м</text>
        <text x="{f(STEM + 33)}" y="{f(Y(-1.2))}">T 2.20</text>
        <text x="{f(mx + 34)}" y="{f(Y(SHEER_BOW + 1.05) - 5)}">J 4.06</text>
        <text x="{f(boom_x1 + 1.6 * S)}" y="{f(Y(boom_h) - 17)}">E 4.87</text>
        <text x="{f(X(11.6) + 14)}" y="{f(Y(8))}" transform="rotate(-90 {f(X(11.6) + 14)} {f(Y(8))})">≈ 17 м над КВЛ</text>
      </g>

      <g font-family="system-ui,Arial">
        <text x="36" y="84" font-size="40" font-weight="800" fill="#eaf3fb" letter-spacing="2">NORD STAR</text>
        <text x="38" y="120" font-size="26" font-weight="800" fill="#ffb020" letter-spacing="2">RUS 3635</text>
        <line x1="36" y1="140" x2="300" y2="140" stroke="#1d3650"/>
        <text x="36" y="168" font-size="15" fill="#c9d8e6">Dufour 36 Performance</text>
        <text x="36" y="188" font-size="13" fill="#7e98b0">Umberto Felci · 2012</text>
        <g font-family="{mono}" font-size="12.5" fill="#9fb8cc">
          <text x="36" y="224">LOA   10.99 м</text><text x="36" y="244">LWL    9.97 м</text>
          <text x="36" y="264">B      3.61 м</text><text x="36" y="284">T      2.20 м</text>
          <text x="36" y="304">Δ      5950 кг</text><text x="36" y="324">P 13.98 · E 4.87</text><text x="36" y="344">J 4.06 · IG 14.14</text>
          <text x="36" y="366">IRC TCC 0.997</text>
        </g>
        <text x="36" y="398" font-size="12" fill="#7e98b0">Масштаб</text>
        <g stroke="#5fa8d3" stroke-width="1"><line x1="36" y1="412" x2="{36 + 5 * S:.0f}" y2="412"/>{''.join(f'<line x1="{36 + i * S:.0f}" y1="408" x2="{36 + i * S:.0f}" y2="416"/>' for i in range(6))}</g>
        <text x="36" y="430" font-family="{mono}" font-size="10" fill="#7e98b0">0</text>
        <text x="{36 + 5 * S - 14:.0f}" y="430" font-family="{mono}" font-size="10" fill="#7e98b0">5 м</text>
      </g>
    </svg>'''

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = os.path.join(root, 'index.html')
s = open(p).read()
s = re.sub(r'<svg class="boatArt".*?</svg>', lambda _: svg, s, count=1, flags=re.S)
open(p, 'w').write(s)
print('boat drawing written')
