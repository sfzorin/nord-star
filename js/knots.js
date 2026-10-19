// Step-by-step knot drawings for the "Учебник". A rope is a smooth Catmull-Rom curve through points; each
// segment has a layer (z) so crossings read as over/under (the upper strand's dark edge cuts the lower one).
// In every step the part of the rope moved in this step is orange, the dashed arrow shows the next move.

import { svg, pill, C } from './learnkit.js?v=8';

const f = (v) => (Math.round(v * 10) / 10).toString();
const OLD = ['#2a1c0a', '#e6d6a6', '#b39556'], NEW = ['#3a1600', '#ffb766', '#c9772c'], BLUE = ['#0b2238', '#9cc8f0', '#5f8fbd'];

function seg(P, i) {
  const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
  const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
  const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
  return `C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
}

const palOf = (pal, hot) => (hot ? (pal === BLUE ? BLUE : NEW) : pal);
const ropeStyle = (d, col, outline = true, off = 0) => (outline ? `<path d="${d}" fill="none" stroke="${col[0]}" stroke-width="8"/>` : '')
  + `<path d="${d}" fill="none" stroke="${col[1]}" stroke-width="5.4"/>`
  + `<path d="${d}" fill="none" stroke="${col[2]}" stroke-width="4.2" stroke-dasharray="0.5 3.6" stroke-dashoffset="${f(off)}" stroke-linecap="round" opacity="0.5"/>`
  + `<path d="${d}" fill="none" stroke="#fff" stroke-width="1.3" opacity="0.35" transform="translate(-0.8,-0.8)"/>`;

// Sample a rope into a fine polyline: [{x, y, i (segment), s (arc length)}].
function sample(P) {
  const out = [];
  let s = 0;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    for (let k = i ? 1 : 0; k <= 16; k++) {
      const t = k / 16, u = 1 - t;
      const x = u * u * u * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p2[0];
      const y = u * u * u * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p2[1];
      if (out.length) { const q = out[out.length - 1]; s += Math.hypot(x - q.x, y - q.y); }
      out.push({ x, y, i, s });
    }
  }
  return out;
}

// All crossings between ropes (and a rope with itself), with who is on top. mode 'alt' = alternating along
// the ropes (how a correctly drawn knot looks), 'later' = the part laid later is on top; flip = crossing indices to invert.
function crossings(ropes, mode = 'alt', flip = []) {
  const S = ropes.map((r) => sample(r.P)), X = [];
  for (let a = 0; a < S.length; a++) for (let b = a; b < S.length; b++) {
    if ((ropes[a].g ?? 0) !== (ropes[b].g ?? 0)) continue;  // ropes of different steps never meet
    const A = S[a], B = S[b];
    for (let i = 0; i < A.length - 1; i++) for (let j = a === b ? i + 2 : 0; j < B.length - 1; j++) {
      if (a === b && Math.abs(B[j].s - A[i].s) < 14) continue;
      const p = A[i], q = A[i + 1], r = B[j], t = B[j + 1];
      const d = (q.x - p.x) * (t.y - r.y) - (q.y - p.y) * (t.x - r.x);
      if (!d) continue;
      const u = ((r.x - p.x) * (t.y - r.y) - (r.y - p.y) * (t.x - r.x)) / d, v = ((r.x - p.x) * (q.y - p.y) - (r.y - p.y) * (q.x - p.x)) / d;
      if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
      X.push({ ra: a, sa: p.s + u * (q.s - p.s), ia: p.i, rb: b, sb: r.s + v * (t.s - r.s), ib: r.i, x: p.x + u * (q.x - p.x), y: p.y + u * (q.y - p.y) });
    }
  }
  // A strand behind a prop (z < 1) is always under one in front of it.
  const back = (r, i) => ((ropes[r].z || [])[i] ?? 1) < 1;
  X.forEach((c) => { const ba = back(c.ra, c.ia), bb = back(c.rb, c.ib); if (ba !== bb) { c.top = ba ? 'b' : 'a'; c.forced = true; } });
  // Visits in rope order.
  const visits = [];
  X.forEach((c, k) => { visits.push({ k, r: c.ra, s: c.sa, side: 'a' }, { k, r: c.rb, s: c.sb, side: 'b' }); });
  visits.sort((p, q) => p.r - q.r || p.s - q.s);
  X.forEach((c, k) => { c.order = visits.findIndex((v) => v.k === k); });
  const laterIsB = (c) => c.rb > c.ra || (c.rb === c.ra && c.sb > c.sa);
  if (mode === 'later') X.forEach((c) => { if (!c.top) c.top = laterIsB(c) ? 'b' : 'a'; });
  else if (mode === 'first') X.forEach((c) => { if (!c.top) c.top = laterIsB(c) ? 'a' : 'b'; });
  else {
    const prev = {};
    for (const v of visits) {
      const c = X[v.k];
      if (c.forced) continue;  // passing behind a prop does not count in the over/under rhythm
      if (c.top) { prev[v.r] = c.top === v.side; continue; }
      const over = prev[v.r] === undefined ? true : !prev[v.r];
      c.top = over ? v.side : (v.side === 'a' ? 'b' : 'a');
      prev[v.r] = over;
    }
  }
  const byOrder = [...X].sort((p, q) => p.order - q.order);
  flip.forEach((n) => { const c = byOrder[n]; if (c) c.top = c.top === 'a' ? 'b' : 'a'; });
  return { S, X: byOrder };
}

// A rope drawn up to point n: runs split by layer (z < 1 = behind the prop) and colour.
function ropeRuns(P, z, n, hiFrom, pal, Sr) {
  const runs = [];
  for (let i = 0; i < n - 1; i++) {
    const col = palOf(pal, i >= hiFrom), back = (z[i] ?? 1) < 1;
    const last = runs[runs.length - 1];
    if (last && last.back === back && last.col === col && last.end === i) { last.end = i + 1; last.d += seg(P, i); } else runs.push({ back, col, end: i + 1, s0: (Sr.find((p) => p.i === i) || { s: 0 }).s, d: `M${f(P[i][0])},${f(P[i][1])}` + seg(P, i) });
  }
  const out = runs.map((r) => ({ back: r.back, svg: `<g stroke-linecap="butt">${ropeStyle(r.d, r.col, true, r.s0)}</g>` }));
  const end = (p, col, back) => ({ back, svg: `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="4" fill="${col[0]}"/><circle cx="${f(p[0])}" cy="${f(p[1])}" r="2.7" fill="${col[1]}"/>` });
  out.push(end(P[0], palOf(pal, hiFrom <= 0), (z[0] ?? 1) < 1), end(P[n - 1], palOf(pal, n - 2 >= hiFrom), (z[n - 2] ?? 1) < 1));
  return out;
}

// The upper strand's short piece redrawn over a crossing.
function patch(Sr, s0, col) {
  const pts = Sr.filter((p) => Math.abs(p.s - s0) <= 9);
  const core = Sr.filter((p) => Math.abs(p.s - s0) <= 6.5);
  if (pts.length < 2) return '';
  const d = (q) => 'M' + q.map((p) => `${f(p.x)},${f(p.y)}`).join(' L');
  return `<g stroke-linecap="butt" stroke-linejoin="round"><path d="${d(core)}" fill="none" stroke="${col[0]}" stroke-width="8"/>${ropeStyle(d(pts), col, false, pts[0].s)}</g>`;
}

// Dashed arrow along points: the next move.
function next(P) {
  if (!P || P.length < 2) return '';
  let d = `M${f(P[0][0])},${f(P[0][1])}`;
  for (let i = 0; i < P.length - 1; i++) d += seg(P, i);
  const a = P[P.length - 1], b = P[P.length - 2], ang = Math.atan2(a[1] - b[1], a[0] - b[0]), h = 7;
  return `<path d="${d}" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="4 3" opacity="0.9"/>`
    + `<path d="M${f(a[0] - h * Math.cos(ang - 0.5))},${f(a[1] - h * Math.sin(ang - 0.5))} L${f(a[0])},${f(a[1])} L${f(a[0] - h * Math.cos(ang + 0.5))},${f(a[1] - h * Math.sin(ang + 0.5))}" fill="none" stroke="#fff" stroke-width="1.8"/>`;
}

// One knot = ropes [{P, z, pal}], props [svg], mode/flip for crossings,
// steps [{n: [points shown per rope], hi: [highlight from point], next, cap}].
export const KNOT_DEFS = {};
function knot(name, def) {
  KNOT_DEFS[name] = def;
  const W = 140, H = 150;
  const { S, X } = crossings(def.ropes, def.mode, def.flip);
  const panels = def.steps.map((st, k) => {
    const back = [], front = [];
    def.ropes.forEach((r, i) => {
      if (st.n[i] < 2) return;
      for (const it of ropeRuns(r.P, r.z || [], st.n[i], st.hi[i], r.pal || OLD, S[i])) (it.back ? back : front).push(it.svg);
    });
    // Crossing patches: only where both strands are already laid in this step.
    const shown = (ri, seg) => seg < st.n[ri] - 1;
    for (const c of X) {
      if (!shown(c.ra, c.ia) || !shown(c.rb, c.ib)) continue;
      const [ri, s0, si] = c.top === 'a' ? [c.ra, c.sa, c.ia] : [c.rb, c.sb, c.ib];
      const r = def.ropes[ri], col = palOf(r.pal || OLD, si >= st.hi[ri]);
      ((r.z || [])[si] ?? 1) < 1 ? back.push(patch(S[ri], s0, col)) : front.push(patch(S[ri], s0, col));
    }
    return `<g transform="translate(${k * W},0)">${k ? `<line x1="0" y1="10" x2="0" y2="${H - 10}" stroke="#2b4a63"/>` : ''}
      <g stroke-linecap="round" stroke-linejoin="round">${back.join('')}${(def.props || []).join('')}${front.join('')}</g>${next(st.next)}
      <circle cx="16" cy="16" r="10" fill="${C.GIVE}"/><text x="16" y="20.5" font-size="12" font-weight="800" text-anchor="middle" fill="#1a1000" font-family="system-ui,Arial,sans-serif">${k + 1}</text>
      ${pill(W / 2, H - 8, st.cap, C.TXT, 'middle', 10)}</g>`;
  }).join('');
  return svg(W * def.steps.length, H, panels, name);
}

// Debug: crossing list for tuning (window.__knotX = knotX in the console).
export const knotX = (def) => crossings(def.ropes, def.mode, def.flip).X.map((c, n) => `${n}: (${f(c.x)},${f(c.y)}) top=${c.top === 'a' ? c.ra + '@' + c.ia : c.rb + '@' + c.ib}`);

const zs = (n, over = {}, base = 1) => Array.from({ length: n }, (_, i) => over[i] ?? base);

// Props.
const rail = `<rect x="0" y="62" width="140" height="14" rx="7" fill="#8fa5b8" stroke="#33495c"/><rect x="0" y="64.5" width="140" height="3" fill="#fff" opacity="0.35"/>`;
const post = `<rect x="20" y="14" width="16" height="116" rx="4" fill="#8fa5b8" stroke="#33495c"/><rect x="23" y="16" width="3.5" height="112" fill="#fff" opacity="0.35"/>`;
const cleat = `<rect x="54" y="58" width="32" height="28" rx="6" fill="#4d6276" stroke="#22374a"/>`
  + `<path d="M16,72 C16,66 28,64 48,65 L92,65 C112,64 124,66 124,72 C124,78 112,80 92,79 L48,79 C28,80 16,78 16,72 Z" fill="#a7b8c7" stroke="#22374a"/>`
  + `<path d="M24,69 C40,67 100,67 116,69" stroke="#fff" opacity="0.45" fill="none"/>`;

const FIG8 = [[40, 22], [56, 48], [72, 74], [84, 100], [70, 118], [48, 112], [44, 92], [58, 76], [78, 56], [92, 40], [84, 24], [66, 26], [40, 44], [34, 62], [46, 80], [62, 92], [80, 112], [100, 124]];
const BOWL = [[70.0,  12],  [70.0,  23.5],  [70.0,  42.4],  [83.5,  55.9],  [86.2,  74.8],  [72.7,  88.3],  [56.5,  80.2],  [51.1,  61.3],  [59.2,  47.8],  [67.3,  43.1],  [78.1,  37.0],  [100,  50],  [114,  82],  [102,  114],  [76,  126],  [48,  122],  [32,  108],  [45.7,  99.1],  [61.9,  93.7],  [63.2,  74.8],  [61.9,  50.5],  [60.5,  28.9],  [67.3,  12.7],  [80.8,  10.0],  [88.9,  23.5],  [80.8,  42.4],  [78.1,  61.3],  [76.8,  82.9],  [75.4,  104.5]];
const CLOVE = [[62, 6], [62, 36], [63, 66], [64, 84], [70, 93], [76, 86], [76, 66], [77, 54], [80, 48], [85, 54], [62, 71], [40, 88], [33, 94], [27, 86], [27, 64], [29, 52], [34, 47], [41, 53], [47, 70], [51, 90], [53, 116]];
// Reef knot as in the reference drawing: each rope's two parts lie over (or under) the other bight; the
// diagonals cross the other way. Coordinates in a 650×350 frame, mapped into the panel.
const RM = (P) => P.map(([x, y]) => [4 + x * 0.203, 30 + y * 0.215]);
const REEF_R = RM([[0, 245], [150, 245], [250, 245], [290, 270], [330, 320], [385, 340], [440, 320], [455, 260], [455, 180], [455, 100], [440, 40], [385, 22], [330, 45], [290, 95], [250, 122], [200, 122], [105, 122]]);
const REEF_B = RM([[650, 245], [500, 245], [400, 245], [360, 270], [320, 320], [265, 340], [210, 320], [195, 260], [195, 180], [195, 100], [210, 40], [265, 22], [320, 55], [360, 100], [400, 122], [440, 122], [545, 122]]);
const squeeze = (P) => P.map(([x, y], i) => [i === 0 || i === P.length - 1 ? x : 70 + (x - 70) * 0.78, 66 + (y - 66) * 0.86]);
const SHEET_K = [[4, 50], [40, 50], [56, 46], [70, 28], [96, 22], [120, 32], [131, 56], [123, 78], [100, 88], [70, 88], [40, 88], [4, 88]];
const SHEET_T = [[138, 36], [126, 42], [110, 58], [94, 76], [88, 90], [80, 102], [60, 106], [36, 104], [24, 92], [20, 70], [22, 48], [30, 36], [42, 34], [52, 52], [62, 74], [70, 92], [76, 106], [86, 118], [100, 124]];
const CLEAT = [[6, 128], [40, 112], [80, 96], [106, 88], [114, 82], [117, 74], [114, 66], [108, 63], [94, 63], [70, 72], [44, 84], [30, 84], [24, 78], [23, 70], [30, 61], [46, 59], [70, 72], [96, 85], [110, 86], [116, 78], [115, 68], [106, 56], [84, 56], [58, 66], [34, 74], [18, 78], [8, 70], [12, 60], [26, 56], [44, 70], [56, 82]];
const RTURN = [[136, 58], [100, 58], [66, 58], [46, 56], [30, 59], [16, 63], [11, 68], [18, 71], [32, 73], [42, 76], [46, 80], [38, 82], [24, 85], [14, 88], [11, 93], [18, 96], [32, 98], [44, 101], [58, 100], [72, 98], [82, 90], [85, 72], [86, 52], [80, 44], [72, 48], [70, 60], [72, 74], [82, 80], [94, 80], [104, 82], [111, 70], [112, 52], [106, 44], [99, 48], [97, 60], [99, 74], [110, 80], [122, 84], [132, 96]];
const COIL = (() => {
  const P = [[34, 122]];
  for (let k = 0; k < 4; k++) {
    const dx = (k - 1.5) * 5;
    for (let a = 180; a <= 540; a += 45) P.push([70 + dx + 26 * Math.sin(a * Math.PI / 180), 74 - 40 * Math.cos(a * Math.PI / 180)]);
  }
  return P;
})();
const WRAP = [[96, 36], [100, 46], [70, 50], [40, 46], [44, 38], [70, 42], [98, 40], [100, 52], [70, 56], [40, 52], [44, 44], [70, 34], [74, 18], [68, 12], [62, 20], [66, 38]];


const REEF_FLIP = [1, 4, 7, 10], SHEET_FLIP = [1, 3, 4], CLEAT_FLIP = [8], RTURN_FLIP = [1, 3];

export const KNOT_ART = {
  'Восьмёрка': knot('Восьмёрка', {
    ropes: [{ P: FIG8 }],
    steps: [
      { n: [9], hi: [3], next: [[78, 56], [92, 40], [84, 24], [66, 26]], cap: 'петля' },
      { n: [14], hi: [8], next: [[34, 62], [46, 80], [62, 92]], cap: 'вокруг коренного' },
      { n: [18], hi: [13], cap: 'в петлю, затянуть' },
    ],
  }),
  'Булинь': knot('Булинь', {
    ropes: [{ P: BOWL }],
    steps: [
      { n: [19], hi: [2], next: [[61.9, 93.7], [63.2, 74.8], [61.9, 50.5], [60.5, 28.9]], cap: 'озеро и петля' },
      { n: [26], hi: [18], next: [[80.8, 42.4], [78.1, 61.3], [76.8, 82.9]], cap: 'из озера, вокруг дерева' },
      { n: [29], hi: [25], cap: 'назад в озеро' },
    ],
  }),
  'Выбленочный': knot('Выбленочный', {
    props: [rail], flip: [0],  // both the standing part and the end pass under the diagonal
    ropes: [{ P: CLOVE, z: zs(20, { 5: 0, 6: 0, 13: 0, 14: 0 }) }],
    steps: [
      { n: [10], hi: [0], next: [[85, 54], [62, 71], [40, 88]], cap: 'оборот' },
      { n: [18], hi: [9], next: [[41, 53], [47, 70], [51, 90]], cap: 'второй — поверх коренного' },
      { n: [21], hi: [17], cap: 'конец под диагональ' },
    ],
  }),
  'Прямой': knot('Прямой', {
    mode: 'first', flip: REEF_FLIP,
    ropes: [{ P: REEF_R }, { P: REEF_B, pal: BLUE }, { P: squeeze(REEF_R), g: 1 }, { P: squeeze(REEF_B), pal: BLUE, g: 1 }],
    steps: [
      { n: [9, 9, 0, 0], hi: [2, 2, 99, 99], next: [REEF_R[8], REEF_R[10], REEF_R[12]], cap: 'левый над правым' },
      { n: [17, 17, 0, 0], hi: [8, 8, 99, 99], cap: 'правый над левым' },
      { n: [0, 0, 17, 17], hi: [99, 99, 99, 99], cap: 'затянуть' },
    ],
  }),
  'Шкотовый': knot('Шкотовый', {
    mode: 'first', flip: SHEET_FLIP,
    ropes: [{ P: SHEET_K, pal: BLUE }, { P: SHEET_T }],
    steps: [
      { n: [12, 0], hi: [0, 0], next: [[138, 36], [126, 42], [110, 58], [94, 76]], cap: 'петля из толстого' },
      { n: [12, 13], hi: [99, 0], next: [[42, 34], [52, 52], [62, 74], [70, 92]], cap: 'через петлю и вокруг' },
      { n: [12, 19], hi: [99, 12], cap: 'и под себя' },
    ],
  }),
  'На утке': knot('На утке', {
    props: [cleat], mode: 'later', flip: CLEAT_FLIP,
    ropes: [{ P: CLEAT, z: zs(30, { 4: 0, 5: 0, 12: 0, 13: 0, 19: 0, 20: 0 }) }],
    steps: [
      { n: [9], hi: [2], next: [[94, 63], [70, 72], [44, 84]], cap: 'под дальний рог' },
      { n: [23], hi: [8], next: [[84, 56], [58, 66], [34, 74]], cap: 'восьмёрка' },
      { n: [31], hi: [22], cap: 'шлаг-стопор' },
    ],
  }),
  'Два полуштыка с оборотом': knot('Два полуштыка с оборотом', {
    props: [post], mode: 'later', flip: RTURN_FLIP,
    ropes: [{ P: RTURN, z: zs(38, { 7: 0, 8: 0, 15: 0, 16: 0 }) }],
    steps: [
      { n: [18], hi: [3], next: [[44, 101], [58, 100], [76, 96], [84, 76]], cap: 'полный оборот' },
      { n: [29], hi: [17], next: [[94, 80], [104, 82], [111, 66]], cap: 'первый полуштык' },
      { n: [39], hi: [28], cap: 'второй полуштык' },
    ],
  }),
  'Бухта троса': knot('Бухта троса', {
    mode: 'later',
    ropes: [{ P: COIL }, { P: WRAP, z: zs(15, { 12: 0, 13: 0 }) }],
    steps: [
      { n: [COIL.length, 0], hi: [1, 0], next: [[96, 30], [100, 46], [70, 50]], cap: 'ровные шлаги' },
      { n: [COIL.length, 11], hi: [99, 0], next: [[44, 44], [70, 34], [74, 18]], cap: 'обмотать конец' },
      { n: [COIL.length, 16], hi: [99, 10], cap: 'петлю через верх' },
    ],
  }),
};

