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
const ropeStyle = (d, col, outline = true, off = 0) => (outline ? `<path d="${d}" fill="none" stroke="${col[0]}" stroke-width="9.5"/>` : '')
  + `<path d="${d}" fill="none" stroke="${col[1]}" stroke-width="6.5"/>`
  + `<path d="${d}" fill="none" stroke="${col[2]}" stroke-width="5" stroke-dasharray="0.5 3.6" stroke-dashoffset="${f(off)}" stroke-linecap="round" opacity="0.5"/>`
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
  if (mode === 'later') X.forEach((c) => { if (!c.top) c.top = (c.rb > c.ra || (c.rb === c.ra && c.sb > c.sa)) ? 'b' : 'a'; });
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
  const end = (p, col, back) => ({ back, svg: `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="4.6" fill="${col[0]}"/><circle cx="${f(p[0])}" cy="${f(p[1])}" r="3.1" fill="${col[1]}"/>` });
  out.push(end(P[0], palOf(pal, hiFrom <= 0), (z[0] ?? 1) < 1), end(P[n - 1], palOf(pal, n - 2 >= hiFrom), (z[n - 2] ?? 1) < 1));
  return out;
}

// The upper strand's short piece redrawn over a crossing.
function patch(Sr, s0, col) {
  const pts = Sr.filter((p) => Math.abs(p.s - s0) <= 9);
  const core = Sr.filter((p) => Math.abs(p.s - s0) <= 6.5);
  if (pts.length < 2) return '';
  const d = (q) => 'M' + q.map((p) => `${f(p.x)},${f(p.y)}`).join(' L');
  return `<g stroke-linecap="butt" stroke-linejoin="round"><path d="${d(core)}" fill="none" stroke="${col[0]}" stroke-width="9.5"/>${ropeStyle(d(pts), col, false, pts[0].s)}</g>`;
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
const ring = `<circle cx="30" cy="72" r="17" fill="none" stroke="#33495c" stroke-width="8"/><circle cx="30" cy="72" r="17" fill="none" stroke="#b9c7d3" stroke-width="5"/>`;
const cleat = `<rect x="56" y="56" width="28" height="30" rx="5" fill="#5d7387" stroke="#22374a"/>`
  + `<path d="M22,71 C22,64 40,62 70,62 C100,62 118,64 118,71 C118,78 100,80 70,80 C40,80 22,78 22,71 Z" fill="#a7b8c7" stroke="#22374a"/>`
  + `<path d="M30,67 C50,65 90,65 110,67" stroke="#fff" opacity="0.45" fill="none"/>`;

const FIG8 = [[40, 22], [56, 48], [72, 74], [84, 100], [70, 118], [48, 112], [44, 92], [58, 76], [78, 56], [92, 40], [84, 24], [66, 26], [40, 44], [34, 62], [46, 80], [62, 92], [80, 112], [100, 124]];
const BOWL = [[70.0,  12],  [70.0,  23.5],  [70.0,  42.4],  [83.5,  55.9],  [86.2,  74.8],  [72.7,  88.3],  [56.5,  80.2],  [51.1,  61.3],  [59.2,  47.8],  [67.3,  43.1],  [78.1,  37.0],  [100,  50],  [114,  82],  [102,  114],  [76,  126],  [48,  122],  [32,  108],  [45.7,  99.1],  [61.9,  93.7],  [63.2,  74.8],  [61.9,  50.5],  [60.5,  28.9],  [67.3,  12.7],  [80.8,  10.0],  [88.9,  23.5],  [80.8,  42.4],  [78.1,  61.3],  [76.8,  82.9],  [75.4,  104.5]];
const CLOVE = [[40, 14], [44, 40], [48, 66], [52, 86], [62, 94], [68, 80], [66, 58], [74, 48], [84, 58], [90, 74], [94, 88], [104, 92], [108, 78], [104, 58], [94, 48], [80, 62], [74, 84], [72, 112]];
const REEF_A1 = [[6, 108], [40, 108], [62, 100], [74, 86], [76, 70], [66, 58], [52, 50], [42, 34]];
const REEF_B1 = [[134, 108], [100, 108], [78, 100], [66, 86], [64, 70], [74, 58], [88, 50], [98, 34]];
const REEF_A = [[6, 54], [40, 54], [76, 56], [96, 64], [102, 77], [96, 90], [76, 98], [40, 100], [6, 100]];
const REEF_B = [[134, 66], [100, 68], [72, 64], [52, 54], [36, 44], [22, 58], [20, 78], [24, 98], [38, 110], [54, 100], [72, 88], [100, 86], [134, 88]];
const squeeze = (P) => P.map(([x, y]) => [70 + (x - 70) * 0.8, 77 + (y - 77) * 0.66]);
const SHEET_B = [[134, 50], [86, 50], [56, 54], [44, 72], [56, 90], [86, 94], [134, 94]];
const SHEET_A = [[8, 128], [44, 116], [64, 100], [66, 78], [68, 54], [76, 38], [96, 34], [106, 60], [106, 84], [104, 102], [96, 112], [84, 110], [78, 88], [72, 78], [60, 74], [50, 72]];
const CLEAT = [[6, 128], [40, 110], [80, 92], [112, 84], [126, 72], [118, 58], [100, 56], [70, 70], [40, 84], [20, 80], [14, 66], [26, 56], [44, 58], [72, 72], [100, 86], [120, 82], [124, 68], [110, 54], [84, 52], [58, 62], [34, 70], [20, 62], [26, 50], [50, 54], [76, 60], [100, 66]];
const RTURN = [[136, 64], [100, 64], [70, 62], [52, 56], [40, 62], [36, 76], [42, 90], [54, 92], [60, 80], [54, 64], [42, 68], [38, 80], [46, 94], [60, 96], [76, 93], [86, 90], [90, 76], [90, 52], [82, 46], [76, 56], [76, 72], [80, 86], [94, 98], [106, 96], [114, 90], [118, 76], [118, 52], [110, 46], [104, 56], [104, 72], [108, 86], [122, 98], [134, 100]];
const COIL = (() => {
  const P = [[34, 122]];
  for (let k = 0; k < 4; k++) {
    const dx = (k - 1.5) * 5;
    for (let a = 180; a <= 540; a += 45) P.push([70 + dx + 26 * Math.sin(a * Math.PI / 180), 74 - 40 * Math.cos(a * Math.PI / 180)]);
  }
  return P;
})();
const WRAP = [[96, 36], [100, 46], [70, 50], [40, 46], [44, 38], [70, 42], [98, 40], [100, 52], [70, 56], [40, 52], [44, 44], [70, 34], [74, 18], [68, 12], [62, 20], [66, 38]];

// Sheet bend = a bowline with its loop cut: thin rope collars the thick bight. Turned so the bight points right.
const rot = (P) => P.map(([x, y]) => [140 - y, x + 4]);
const SHEET_T = rot([[70, 2], ...BOWL.slice(0, 12)]), SHEET_K = [[4, 66], [26, 66], ...rot(BOWL.slice(18)), [4, 80]];

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
    props: [rail],
    ropes: [{ P: CLOVE, z: zs(17, { 4: 0, 5: 0, 11: 0, 12: 0 }) }],
    steps: [
      { n: [8], hi: [0], next: [[74, 48], [84, 58], [90, 74]], cap: 'оборот' },
      { n: [14], hi: [7], next: [[104, 58], [94, 48], [80, 62]], cap: 'второй крест-накрест' },
      { n: [18], hi: [13], cap: 'конец под диагональ' },
    ],
  }),
  'Прямой': knot('Прямой', {
    ropes: [{ P: REEF_A1 }, { P: REEF_B1, pal: BLUE }, { P: REEF_A, g: 1 }, { P: REEF_B, pal: BLUE, g: 1 }, { P: squeeze(REEF_A), g: 2 }, { P: squeeze(REEF_B), pal: BLUE, g: 2 }],
    steps: [
      { n: [8, 8, 0, 0, 0, 0], hi: [2, 2, 0, 0, 0, 0], cap: 'левый над правым' },
      { n: [0, 0, 9, 13, 0, 0], hi: [0, 0, 1, 1, 0, 0], cap: 'правый над левым' },
      { n: [0, 0, 0, 0, 9, 13], hi: [99, 99, 99, 99, 99, 99], cap: 'затянуть' },
    ],
  }),
  'Шкотовый': knot('Шкотовый', {
    ropes: [{ P: SHEET_K, pal: BLUE }, { P: SHEET_T }],
    steps: [
      { n: [SHEET_K.length, 0], hi: [0, 0], next: rot([[70, 4], [70, 24], [84, 52]]), cap: 'петля из толстого' },
      { n: [SHEET_K.length, 9], hi: [99, 0], next: rot([[59.2, 47.8], [67.3, 43.1], [78.1, 37]]), cap: 'тонкий вокруг петли' },
      { n: [SHEET_K.length, 13], hi: [99, 8], cap: 'и под себя' },
    ],
  }),
  'На утке': knot('На утке', {
    props: [cleat], mode: 'later', flip: [7],  // the tail is locked under the last turn
    ropes: [{ P: CLEAT, z: zs(25, { 3: 0, 4: 0, 5: 0, 9: 0, 10: 0, 14: 0, 15: 0, 16: 0, 20: 0, 21: 0 }) }],
    steps: [
      { n: [7], hi: [2], next: [[100, 56], [70, 70], [40, 84]], cap: 'оборот у основания' },
      { n: [19], hi: [6], next: [[84, 52], [58, 62], [34, 70]], cap: 'восьмёрка' },
      { n: [26], hi: [18], cap: 'петля-стопор' },
    ],
  }),
  'Два полуштыка с оборотом': knot('Два полуштыка с оборотом', {
    props: [ring],
    ropes: [{ P: RTURN, z: zs(32, { 5: 0, 11: 0 }) }],
    steps: [
      { n: [14], hi: [2], next: [[60, 96], [76, 93], [86, 90], [90, 70]], cap: 'полный оборот' },
      { n: [24], hi: [13], next: [[106, 96], [114, 90], [118, 70]], cap: 'первый полуштык' },
      { n: [33], hi: [23], cap: 'второй полуштык' },
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

