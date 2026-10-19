// Course library. Göcek / Fethiye Gulf, from Göcek Yacht Club course cards (Marmaris: marmaris.js):
//  • GSRW 2026 "Rota card" (Göcek Spring Race Week, May 2026):
//    gocekyachtclub.org/images/yarislar/70/20260522_gyc_2026_gsrw_rotalar.pdf
//  • GSRW/GARW 2021–2023 course cards (race pages 22, 23, 47, 48, 51), Kış Trofesi 2024 (53),
//    Atatürk Kupası 2025 (65): gocekyachtclub.org/tr/Yarislar/Yaris-Detay/<id>/x
// Island outlines: OpenStreetMap convex hulls. Mark positions are approximate (as the SIs say).

import * as G from './geo.js?v=8';
import { snap, path } from './route.js?v=8';
import { ISLANDS_M, STARTS_M, COURSES_M } from './marmaris.js?v=8';

// Islands as convex hulls [lat, lon]. A course rounds them on the given side.
export const ISLANDS = {
  GOCEK: { name: 'Гёчек', hull: [[36.71749,28.93919],[36.71896,28.93607],[36.72023,28.93528],[36.72374,28.93355],[36.7305,28.93519],[36.73418,28.93634],[36.73687,28.93913],[36.73692,28.93943],[36.73684,28.93974],[36.73383,28.94348],[36.73198,28.94563],[36.72752,28.94939],[36.72613,28.95049],[36.72508,28.94951],[36.71763,28.93943]] },
  KATRANCIK: { name: 'Катранджик', hull: [[36.6922,29.0098],[36.69316,29.00704],[36.69374,29.0065],[36.69712,29.00436],[36.69788,29.00502],[36.69837,29.00599],[36.69851,29.0074],[36.69834,29.00796],[36.69584,29.01258],[36.69525,29.01309],[36.69499,29.01314],[36.69371,29.01262],[36.69321,29.01202],[36.69221,29.00988]] },
  TAVSAN: { name: 'Тавшан', hull: [[36.66832,29.03015],[36.67016,29.02929],[36.67067,29.02935],[36.67094,29.02958],[36.67128,29.03028],[36.67163,29.03169],[36.67164,29.03212],[36.67136,29.03228],[36.67041,29.03266],[36.66893,29.03276],[36.66869,29.03271]] },
  KIZIL_F: { name: 'Кызыл-Ада (Фетхие)', hull: [[36.65218,29.04355],[36.6523,29.04335],[36.65325,29.04298],[36.6613,29.04099],[36.66489,29.04587],[36.66492,29.04604],[36.66103,29.05371],[36.66082,29.05395],[36.66059,29.05395],[36.65684,29.05282],[36.65397,29.04813],[36.65252,29.04475],[36.6524,29.0444]] },
  // Zeytinli + Şeytanlı + Yassıca islets with the Yassıcalar north cardinal (36.71369, 28.91835).
  YASSICALAR: { name: 'Яссыджалар (с кардиналами)', hull: [[36.71369,28.91835],[36.71062,28.93474],[36.71031,28.93499],[36.70589,28.93543],[36.70031,28.93383],[36.69757,28.93263],[36.69626,28.93373],[36.69543,28.93394],[36.6942,28.93263],[36.69323,28.92622],[36.69425,28.92487],[36.69506,28.92416],[36.69851,28.92364],[36.69947,28.92403]] },
  ZEY_SEY: { name: 'Зейтинли и Шейтанлы', hull: [[36.69323,28.92622],[36.69425,28.92487],[36.69506,28.92416],[36.69851,28.92364],[36.69947,28.92403],[36.69988,28.92442],[36.69997,28.9276],[36.69757,28.93263],[36.69626,28.93373],[36.69543,28.93394],[36.6942,28.93263]] },
  ZEYTIN: { name: 'Зейтинли', hull: [[36.69323,28.92622],[36.69425,28.92487],[36.69506,28.92416],[36.69851,28.92364],[36.69947,28.92403],[36.69988,28.92442],[36.69997,28.9276],[36.69992,28.9286],[36.69938,28.92956],[36.6982,28.92992],[36.69663,28.92993],[36.6958,28.92939],[36.69416,28.9277]] },
  TERSANE: { name: 'Тершане', hull: [[36.65472,28.91538],[36.65629,28.91271],[36.664,28.91092],[36.67119,28.9093],[36.67418,28.91],[36.67972,28.91221],[36.68168,28.91335],[36.68209,28.91543],[36.68181,28.91667],[36.67583,28.93641],[36.67469,28.93944],[36.67312,28.93871],[36.65499,28.91662]] },
  DOMUZ: { name: 'Домуз', hull: [[36.65127,28.907],[36.6519,28.90326],[36.65253,28.90213],[36.66516,28.88963],[36.66849,28.8864],[36.67079,28.88879],[36.67019,28.89705],[36.66572,28.90681],[36.66241,28.90829],[36.65451,28.90911],[36.65177,28.90822]] },
  PEKSIMET: { name: 'Пексимет', hull: [[36.56693,28.82488],[36.56694,28.82456],[36.5672,28.82457],[36.56792,28.82476],[36.56813,28.82505],[36.5676,28.82554],[36.5671,28.82522]] },
};

// Point marks (buoys, capes): rounded at the point itself (cape/islet with a clearance).
const PT = (name, lat, lon, clear = 0, safe = null) => ({ name, hull: [[lat, lon]], pt: true, clear, safe });
Object.assign(ISLANDS, {
  IZ: PT('Из-Каясы (жёлтый буй)', 36.675, 28.98833),
  // North cardinal: shoal (0 m) to its south — always pass 80 m north of it.
  SIGLIK: PT('Сев. кардинал (мель южнее)', 36.71369, 28.91835, 0, 0),
  YILANLI: PT('о. Йыланлы', 36.70709, 28.91711, 150),
  M2E1: PT('Знак 1 (Китлебюкю)', 36.695, 28.88333),
  M2E2: PT('Знак 2 (зап. Тершане)', 36.675, 28.89167),
  M3A1: PT('Знак 1 (зап. Тершане)', 36.675, 28.88667),
  M3B1: PT('Знак 1 (3B)', 36.67333, 28.89167),
  M3A2: PT('Знак 2 (Сыралыбюк)', 36.69167, 28.875),
  M3A3: PT('Знак 3 (у старта Йыланлы)', 36.7045, 28.9223),
  M4A2: PT('Знак 2 (вост. Зейтинли)', 36.695, 28.93667),
  NAR: PT('о. Нар', 36.6274, 28.76362, 200),
  KURTOGLU: PT('м. Куртоглу', 36.5886, 28.84601, 300),
});

// Start/finish areas from the course cards (RC boat + pin ~0.2 nm). Approximate — ping the real ones.
export const STARTS = {
  GOCEK: { name: 'Гёчек (Акмуден, южный вход в бухту)', rc: { lat: 36.74667, lon: 28.93167 }, pin: { lat: 36.74667, lon: 28.93583 } },
  YILANLI: { name: 'Йыланлы (южнее о. Йыланлы)', rc: { lat: 36.705, lon: 28.91833 }, pin: { lat: 36.7038, lon: 28.9223 } },
  INLICE: { name: 'Инлидже (у пляжа)', rc: { lat: 36.71833, lon: 28.97167 }, pin: { lat: 36.7178, lon: 28.9676 } },
};

// legs: [islandOrMark, 'S' starboard | 'P' port]. Same geometry used in several years is merged.
const C = (id, name, nm, src, start, legs) => ({ id, kind: 'coastal', venue: 'gocek', name, nm, src, start, legs });
export const COURSES = [
  C('AR_S', 'Вокруг о. Гёчек правым', 4, '2026 №3 · 2025 №3', 'GOCEK', [['GOCEK', 'S']]),
  C('AR_P', 'Вокруг о. Гёчек левым', 4, '2026 №3A · 2025 №4', 'GOCEK', [['GOCEK', 'P']]),
  C('LOOP_S', 'Гёчек + Яссыджалар, петля правым', 6, '2026 №5 · 2025 №7 · 2021–23 2B (7.5)', 'GOCEK', [['GOCEK', 'S'], ['YASSICALAR', 'S'], ['GOCEK', 'S']]),
  C('LOOP_P', 'Гёчек + Яссыджалар, петля левым', 6, '2026 №5A · 2025 №8 · 2021–23 2A (7.5)', 'GOCEK', [['GOCEK', 'P'], ['YASSICALAR', 'P'], ['GOCEK', 'P']]),
  C('F8_A', 'Восьмёрка: Гёчек левым, Яссыджалар правым', 8, '2026 №2 · 2025 №1 · 2021–23 2G (9)', 'GOCEK', [['GOCEK', 'P'], ['YASSICALAR', 'S'], ['GOCEK', 'P']]),
  C('F8_B', 'Восьмёрка: Гёчек правым, Яссыджалар левым', 8, '2026 №2A · 2025 №2 · 2021–23 2F (9)', 'GOCEK', [['GOCEK', 'S'], ['YASSICALAR', 'P'], ['GOCEK', 'S']]),
  C('2C', 'Гёчек — Из-Каясы — Яссыджалар, всё правым', 11.5, '2021–23 2C', 'GOCEK', [['GOCEK', 'S'], ['IZ', 'S'], ['YASSICALAR', 'S'], ['GOCEK', 'S']]),
  C('2D', 'Гёчек — Из-Каясы — Яссыджалар — Гёчек левым', 13, '2021–23 2D', 'GOCEK', [['GOCEK', 'S'], ['IZ', 'S'], ['YASSICALAR', 'S'], ['GOCEK', 'P']]),
  C('2E', 'Гёчек — Сыглык — Йыланлы — знаки Скопеа', 10, '2021–23 2E', 'GOCEK', [['GOCEK', 'P'], ['SIGLIK', 'P'], ['YILANLI', 'P'], ['M2E1', 'P'], ['M2E2', 'P'], ['YILANLI', 'P'], ['SIGLIK', 'P'], ['GOCEK', 'S']]),
  C('C1', 'Гёчек — Катранджик', 12, '2026 №1', 'GOCEK', [['GOCEK', 'S'], ['KATRANCIK', 'S'], ['GOCEK', 'S']]),
  C('C1A', 'Гёчек — Катранджик — Зейтинли', 15, '2026 №1A', 'GOCEK', [['GOCEK', 'S'], ['KATRANCIK', 'S'], ['ZEYTIN', 'S'], ['GOCEK', 'S']]),
  C('1A', 'Гёчек — Катранджик — Тавшан — Кызыл-Ада', 17, '2021–23 1A', 'GOCEK', [['GOCEK', 'S'], ['KATRANCIK', 'P'], ['TAVSAN', 'P'], ['KIZIL_F', 'P'], ['KATRANCIK', 'P'], ['GOCEK', 'P']]),
  C('1B', 'Гёчек — Зейтинли — Тавшан — Кызыл-Ада — Катранджик', 17, '2021–23 1B', 'GOCEK', [['GOCEK', 'P'], ['ZEYTIN', 'P'], ['TAVSAN', 'P'], ['KIZIL_F', 'P'], ['KATRANCIK', 'S'], ['GOCEK', 'S']]),
  C('6', 'Пексимет', 20, '2026 №6', 'GOCEK', [['PEKSIMET', 'S']]),
  C('1D', 'Гёчек — Кызыл-Ада — Пексимет', 30, 'GARW 2023 1D', 'GOCEK', [['GOCEK', 'S'], ['KIZIL_F', 'S'], ['PEKSIMET', 'S'], ['GOCEK', 'P']]),
  C('6A', 'Пексимет — Нар — м. Куртоглу', 30, '2026 №6A (Сыглыклар не отмечены)', 'GOCEK', [['PEKSIMET', 'S'], ['NAR', 'S'], ['KURTOGLU', 'P']]),
  C('1C', 'Гёчек — Яссыджалар — Тершане — Пексимет', 35, 'GARW 2023 1C (борта под вопросом)', 'GOCEK', [['GOCEK', 'S'], ['YASSICALAR', 'S'], ['TERSANE', 'S'], ['PEKSIMET', 'S'], ['GOCEK', 'P']]),
  C('3A', 'Скопеа: знаки 1-2-3-1', 10, '2021–23 3A · 2026 №4 (7) · 2025 №5 (7) · Зима-24 C', 'YILANLI', [['M3A1', 'S'], ['M3A2', 'S'], ['M3A3', 'S'], ['M3A1', 'S']]),
  C('3B', 'Скопеа: знаки 1-2', 6, '2021–23 3B · 2026 №4A (7) · 2025 №6 · Зима-24 D', 'YILANLI', [['M3B1', 'S'], ['M3A2', 'S']]),
  C('4A', 'Инлидже — Из-Каясы — вост. Зейтинли', 8, 'GSRW 2021 4A', 'INLICE', [['IZ', 'S'], ['M4A2', 'S']]),
  { id: 'L1', kind: 'wl', venue: 'gocek', name: 'L1 · наветр.-подветр., отбойник + ворота, 2 круга', nm: 6, src: '2026 L1 · 2025 L1-A · 2021–23 5B', legNm: 1.4, seq: ['1', '1A', '4', '1', '1A'] },
  { id: 'L2', kind: 'wl', venue: 'gocek', name: 'L2 · наветр.-подветр., отбойник, 1 круг', nm: 4, src: '2026 L2 · 2025 L1-B', legNm: 1.9, seq: ['1', '1A'] },
  { id: 'L3', kind: 'wl', venue: 'gocek', name: 'L3 · треугольник 1-2-3-1', nm: 8, src: '2026 L3 · 2025 L2-A · 2021–23 5C', legNm: 1.8, seq: ['1', '2', '3', '1'] },
  { id: 'L4', kind: 'wl', venue: 'gocek', name: 'L4 · 1-2 (наветренный + боковой)', nm: 5, src: '2026 L4 · 2025 L2-B', legNm: 2.0, seq: ['1', '2'] },
  ...COURSES_M,
];
Object.assign(ISLANDS, ISLANDS_M);
Object.assign(STARTS, STARTS_M);

const CLEAR = 200; // m off the island hull

// Distance from hull centre to its edge along a bearing (support function), metres.
function support(isl, brg) {
  const c = centre(isl);
  const F = G.frame(c), u = G.unit(brg);
  let m = 0;
  for (const [lat, lon] of isl.hull) m = Math.max(m, G.dot(F.xy({ lat, lon }), u));
  return m;
}

export function centre(isl) {
  const n = isl.hull.length;
  return { lat: isl.hull.reduce((a, p) => a + p[0], 0) / n, lon: isl.hull.reduce((a, p) => a + p[1], 0) / n };
}

// Waypoints to round an island coming from `prev` and leaving towards `next`.
// Starboard rounding = clockwise (island on the right), port = anticlockwise.
function roundIsland(isl, side, prev, next) {
  const c = centre(isl);
  if (isl.pt) {
    if (isl.safe != null) return [G.destination(c, isl.safe, 80)];
    if (!isl.clear) return [c];
    // Off a cape/islet: on the outside of the turn.
    const out = G.norm360(G.circMean([G.bearing(c, prev), G.bearing(c, next)]) + 180);
    return [G.destination(c, out, isl.clear)];
  }
  const a0 = G.bearing(c, prev), a1 = G.bearing(c, next);
  const cw = side === 'S';
  let sweep = cw ? G.norm360(a1 - a0) : G.norm360(a0 - a1);
  // Arriving and leaving on the same side means going round it, not brushing past.
  if (Math.abs(G.norm180(a1 - a0)) < 60 && sweep < 180) sweep += 360;
  const n = Math.max(1, Math.round(sweep / 70));
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (cw ? 1 : -1) * sweep * ((i + 0.5) / n);
    pts.push(G.destination(c, a, support(isl, a) + CLEAR));
  }
  return pts;
}

// Build marks + course order for a library course.
export function buildCourse(def, ctx) {
  if (def.kind === 'coastal') {
    const start = STARTS[def.start];
    const mid = G.midpoint(start.rc, start.pin);
    // Pass 1 aims at island centres; pass 2 re-rounds each island between the actual neighbouring waypoints.
    let wpsByLeg = def.legs.map(([key]) => [centre(ISLANDS[key])]);
    for (let pass = 0; pass < 2; pass++) {
      wpsByLeg = def.legs.map(([key, side], i) => {
        const prev = i ? wpsByLeg[i - 1][wpsByLeg[i - 1].length - 1] : mid;
        const next = i < def.legs.length - 1 ? wpsByLeg[i + 1][0] : mid;
        return roundIsland(ISLANDS[key], side, prev, next);
      });
    }
    const marks = [], course = [];
    const nav = ctx?.nav;
    let last = mid, vias = 0;
    const addVia = (to) => {
      if (!nav) return;
      for (const v of path(nav, last, to)) {
        const id = `${def.id}_v${vias++}`;
        marks.push({ id, name: 'обход', ...v, approx: false, wp: true, via: true });
        course.push(id);
        last = v;
      }
    };
    def.legs.forEach(([key, side], i) => {
      const isl = ISLANDS[key], wps = wpsByLeg[i];
      wps.forEach((p0, j) => {
        // Rounding points may fall on another shore in narrow channels: move them onto water.
        const p = nav && !isl.pt ? snap(nav, p0) : p0;
        addVia(p);
        const id = `${def.id}_${i}_${j}`;
        const label = `${isl.name} ${side === 'S' ? 'пр.' : 'лев.'}${wps.length > 1 ? ` ${j + 1}/${wps.length}` : ''}`;
        marks.push({ id, name: label, ...p, approx: false, wp: !isl.pt || !!isl.clear });
        course.push(id);
        last = p;
      });
    });
    addVia(mid);
    return { marks, course, start, islands: def.legs.filter(([k]) => !ISLANDS[k].pt).map(([k, s]) => ({ key: k, side: s })) };
  }

  // Windward/leeward family, laid from the line mid along the announced bearing.
  const { mid, brg } = ctx;
  const L = (ctx.legNm ?? def.legNm) * G.NM;
  const pos = {
    1: G.destination(mid, brg, L),
    '1A': G.destination(G.destination(mid, brg, L), brg - 90, 0.1 * G.NM),
    2: G.destination(G.destination(mid, brg, L), brg + 180 + 45, (L / Math.SQRT2)),
    3: G.destination(mid, brg, 0.06 * G.NM),
    4: G.destination(mid, brg, 0.06 * G.NM),
  };
  const names = { 1: '1 наветр.', '1A': '1A отбойник', 2: '2 боковой', 3: '3 подветр.', 4: '4S/4P ворота' };
  const used = [...new Set(def.seq)];
  const marks = used.map((k) => ({ id: `W${k}`, name: names[k], ...pos[k], approx: !ctx.exact && k === '1' }));
  return { marks, course: def.seq.map((k) => `W${k}`) };
}
