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

// Split a rope into runs of equal layer and colour; returns [{z, svg}] for global sorting.
function rope(P, z, n, hiFrom, pal = OLD) {
  const runs = [];
  for (let i = 0; i < n - 1; i++) {
    const col = i >= hiFrom ? (pal === BLUE ? BLUE : NEW) : pal, zi = z[i] ?? 1;
    const last = runs[runs.length - 1];
    if (last && last.z === zi && last.col === col && last.end === i) { last.end = i + 1; last.d += seg(P, i); } else runs.push({ z: zi, col, end: i + 1, d: `M${f(P[i][0])},${f(P[i][1])}` + seg(P, i) });
  }
  const out = runs.map((r) => ({
    z: r.z, svg: `<g stroke-linecap="butt"><path d="${r.d}" fill="none" stroke="${r.col[0]}" stroke-width="9.5"/>`
      + `<path d="${r.d}" fill="none" stroke="${r.col[1]}" stroke-width="6.5"/>`
      + `<path d="${r.d}" fill="none" stroke="${r.col[2]}" stroke-width="5" stroke-dasharray="0.5 3.6" stroke-linecap="round" opacity="0.5"/>`
      + `<path d="${r.d}" fill="none" stroke="#fff" stroke-width="1.3" opacity="0.35" transform="translate(-0.8,-0.8)"/></g>`,
  }));
  // Whipped ends.
  const end = (p, col, zz) => ({ z: zz, svg: `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="4.6" fill="${col[0]}"/><circle cx="${f(p[0])}" cy="${f(p[1])}" r="3.1" fill="${col[1]}"/>` });
  out.push(end(P[0], hiFrom <= 0 ? (pal === BLUE ? BLUE : NEW) : pal, z[0] ?? 1));
  out.push(end(P[n - 1], n - 2 >= hiFrom ? (pal === BLUE ? BLUE : NEW) : pal, z[n - 2] ?? 1));
  return out;
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

// One knot = ropes [{P, z, pal}], props [{z, svg}], steps [{n: [points shown per rope], hi: [highlight from], next, cap}].
function knot(name, def) {
  const W = 140, H = 150;
  const panels = def.steps.map((s, k) => {
    const items = [...(def.props || [])];
    def.ropes.forEach((r, i) => { if (s.n[i] > 1) items.push(...rope(r.P, r.z, s.n[i], s.hi[i], r.pal)); });
    items.sort((a, b) => a.z - b.z);
    return `<g transform="translate(${k * W},0)">${k ? `<line x1="0" y1="10" x2="0" y2="${H - 10}" stroke="#2b4a63"/>` : ''}
      <g stroke-linecap="round" stroke-linejoin="round">${items.map((it) => it.svg).join('')}</g>${next(s.next)}
      <circle cx="16" cy="16" r="10" fill="${C.GIVE}"/><text x="16" y="20.5" font-size="12" font-weight="800" text-anchor="middle" fill="#1a1000" font-family="system-ui,Arial,sans-serif">${k + 1}</text>
      ${pill(W / 2, H - 8, s.cap, C.TXT, 'middle', 10)}</g>`;
  }).join('');
  return svg(W * def.steps.length, H, panels, name);
}

const zs = (n, over = {}, base = 1) => Array.from({ length: n }, (_, i) => over[i] ?? base);

// Props.
const rail = { z: 1, svg: `<rect x="0" y="62" width="140" height="14" rx="7" fill="#8fa5b8" stroke="#33495c"/><rect x="0" y="64.5" width="140" height="3" fill="#fff" opacity="0.35"/>` };
const ring = { z: 1, svg: `<circle cx="30" cy="72" r="17" fill="none" stroke="#33495c" stroke-width="8"/><circle cx="30" cy="72" r="17" fill="none" stroke="#b9c7d3" stroke-width="5"/>` };
const cleat = { z: 1, svg: `<rect x="56" y="56" width="28" height="30" rx="5" fill="#5d7387" stroke="#22374a"/>`
  + `<path d="M22,71 C22,64 40,62 70,62 C100,62 118,64 118,71 C118,78 100,80 70,80 C40,80 22,78 22,71 Z" fill="#a7b8c7" stroke="#22374a"/>`
  + `<path d="M30,67 C50,65 90,65 110,67" stroke="#fff" opacity="0.45" fill="none"/>` };

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
const CLEAT = [[6, 128], [40, 110], [80, 92], [112, 84], [126, 72], [118, 58], [100, 56], [70, 70], [40, 84], [20, 80], [14, 66], [26, 56], [44, 58], [72, 72], [100, 86], [120, 82], [124, 68], [110, 54], [84, 52], [58, 62], [34, 70], [20, 62], [26, 50], [44, 52], [66, 44]];
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

export const KNOT_ART = {
  'Восьмёрка': knot('Восьмёрка', {
    ropes: [{ P: FIG8, z: zs(17, { 0: 2, 1: 0, 3: 2, 6: 0, 7: 2, 11: 0, 14: 2, 15: 0 }) }],
    steps: [
      { n: [9], hi: [3], next: [[78, 56], [92, 40], [84, 24], [66, 26]], cap: 'петля' },
      { n: [14], hi: [8], next: [[34, 62], [46, 80], [62, 92]], cap: 'вокруг коренного' },
      { n: [18], hi: [13], cap: 'в петлю, затянуть' },
    ],
  }),
  'Булинь': knot('Булинь', {
    ropes: [{ P: BOWL, z: zs(28, { 0: 2, 2: 2, 4: 0, 5: 2, 8: 0, 9: 2, 10: 0, 18: 0, 20: 3, 22: 0, 24: 3, 25: 0, 27: 3 }) }],
    steps: [
      { n: [19], hi: [2], next: [[61.9,  93.7], [63.2,  74.8], [61.9,  50.5], [60.5,  28.9]], cap: 'озеро и петля' },
      { n: [26], hi: [18], next: [[80.8,  42.4], [78.1,  61.3], [76.8,  82.9]], cap: 'из озера, вокруг дерева' },
      { n: [29], hi: [25], cap: 'назад в озеро' },
    ],
  }),
  'Выбленочный': knot('Выбленочный', {
    props: [rail],
    ropes: [{ P: CLOVE, z: zs(17, { 0: 2, 1: 2, 2: 2, 3: 2, 4: 0, 5: 0, 6: 2, 7: 3, 8: 3, 11: 0, 12: 0, 14: 1.5, 15: 2 }, 2) }],
    steps: [
      { n: [8], hi: [0], next: [[74, 48], [84, 58], [90, 74]], cap: 'оборот' },
      { n: [14], hi: [7], next: [[104, 58], [94, 48], [80, 62]], cap: 'второй крест-накрест' },
      { n: [18], hi: [13], cap: 'конец под диагональ' },
    ],
  }),
  'Прямой': (() => {
    const A = { z: zs(8, { 1: 2, 2: 0, 4: 2, 6: 0 }) }, B = { z: zs(12, { 0: 2, 1: 2, 2: 0, 3: 0, 9: 2, 10: 0, 11: 0 }) };
    return knot('Прямой', {
      ropes: [{ P: REEF_A1, z: zs(7, { 2: 2, 4: 0 }) }, { P: REEF_B1, z: zs(7, { 2: 0, 4: 2 }), pal: BLUE },
        { P: REEF_A, z: A.z }, { P: REEF_B, z: B.z, pal: BLUE }, { P: squeeze(REEF_A), z: A.z }, { P: squeeze(REEF_B), z: B.z, pal: BLUE }],
      steps: [
        { n: [8, 8, 0, 0, 0, 0], hi: [2, 2, 0, 0, 0, 0], cap: 'левый над правым' },
        { n: [0, 0, 9, 13, 0, 0], hi: [0, 0, 1, 1, 0, 0], cap: 'правый над левым' },
        { n: [0, 0, 0, 0, 9, 13], hi: [99, 99, 99, 99, 99, 99], cap: 'затянуть' },
      ],
    });
  })(),
  'Шкотовый': knot('Шкотовый', {
    ropes: [{ P: SHEET_B, z: zs(6), pal: BLUE }, { P: SHEET_A, z: zs(15, { 2: 0, 4: 2, 6: 0, 7: 0, 8: 0, 11: 2, 13: 0.5, 14: 0.5 }) }],
    steps: [
      { n: [7, 0], hi: [0, 0], next: [[10, 126], [44, 116], [64, 100], [66, 78]], cap: 'петля из толстого' },
      { n: [7, 6], hi: [99, 0], next: [[76, 38], [96, 34], [106, 60], [106, 84]], cap: 'тонкий снизу в петлю' },
      { n: [7, 16], hi: [99, 5], cap: 'вокруг и под себя' },
    ],
  }),
  'На утке': knot('На утке', {
    props: [cleat],
    ropes: [{ P: CLEAT, z: zs(24, { 3: 0, 4: 0, 5: 0, 9: 0, 10: 0, 14: 0, 15: 0, 16: 0, 20: 0, 21: 0, 22: 1.5 }, 2) }],
    steps: [
      { n: [7], hi: [2], next: [[100, 56], [70, 70], [40, 84]], cap: 'оборот у основания' },
      { n: [19], hi: [6], next: [[84, 52], [58, 62], [34, 70]], cap: 'восьмёрка' },
      { n: [25], hi: [18], cap: 'петля-стопор' },
    ],
  }),
  'Два полуштыка с оборотом': knot('Два полуштыка с оборотом', {
    props: [ring],
    ropes: [{ P: RTURN, z: zs(32, { 3: 2, 5: 0, 9: 2, 11: 0, 16: 2, 19: 0, 21: 0, 25: 2, 28: 0, 30: 0 }) }],
    steps: [
      { n: [14], hi: [2], next: [[60, 96], [76, 93], [86, 90], [90, 70]], cap: 'полный оборот' },
      { n: [24], hi: [13], next: [[106, 96], [114, 90], [118, 70]], cap: 'первый полуштык' },
      { n: [33], hi: [23], cap: 'второй полуштык' },
    ],
  }),
  'Бухта троса': knot('Бухта троса', {
    ropes: [{ P: COIL, z: zs(COIL.length - 1) }, { P: WRAP, z: zs(15, { 1: 2, 2: 2, 3: 2, 6: 2, 7: 2, 8: 2, 9: 2, 12: 0, 13: 0 }, 1) }],
    steps: [
      { n: [COIL.length, 0], hi: [1, 0], next: [[96, 30], [100, 46], [70, 50]], cap: 'ровные шлаги' },
      { n: [COIL.length, 11], hi: [99, 0], next: [[44, 44], [70, 34], [74, 18]], cap: 'обмотать конец' },
      { n: [COIL.length, 16], hi: [99, 10], cap: 'петлю через верх' },
    ],
  }),
};
