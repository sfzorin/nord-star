// Dufour 36 Performance polar — ORC Club Certificate 2026, sister ship VIVID (IRL 9007,
// cert 26091, asym spinnaker). Source: data.orc.org/public/WPub.dll/CC/05180004FEU.pdf

export const SOURCE = 'ORC 2026 · VIVID IRL 9007 (Dufour 36 Perf)';
export const TWS = [4, 6, 8, 10, 12, 14, 16, 20, 24];
const BEAT_ANGLE = [47.0, 44.5, 42.2, 40.6, 39.3, 38.6, 38.2, 38.5, 39.3];
const BEAT_VMG = [2.26, 3.28, 4.04, 4.61, 5.0, 5.18, 5.27, 5.3, 5.23];
const TWA = [52, 60, 75, 90, 110, 120, 135, 150];
const BSP = [
  /* 52 */ [3.58, 5.06, 6.07, 6.76, 7.17, 7.37, 7.45, 7.52, 7.52],
  /* 60 */ [3.87, 5.36, 6.36, 6.99, 7.36, 7.57, 7.67, 7.76, 7.78],
  /* 75 */ [4.09, 5.57, 6.56, 7.16, 7.52, 7.78, 7.97, 8.16, 8.25],
  /* 90 */ [4.15, 5.82, 6.92, 7.48, 7.73, 7.91, 8.08, 8.5, 8.74],
  /*110 */ [4.26, 5.96, 7.1, 7.7, 8.11, 8.45, 8.69, 9.09, 9.45],
  /*120 */ [4.13, 5.82, 6.99, 7.62, 8.07, 8.5, 8.92, 9.57, 10.11],
  /*135 */ [3.64, 5.21, 6.44, 7.27, 7.77, 8.21, 8.67, 9.72, 11.42],
  /*150 */ [3.01, 4.39, 5.55, 6.53, 7.24, 7.68, 8.04, 8.81, 9.74],
];
const RUN_VMG = [2.61, 3.8, 4.8, 5.65, 6.29, 6.74, 7.13, 7.78, 8.46];
const GYBE_ANGLE = [139.0, 142.9, 147.1, 149.3, 152.1, 156.6, 161.2, 162.0, 156.4];

const cosd = (a) => Math.cos((a * Math.PI) / 180);
const BEAT_SPEED = BEAT_ANGLE.map((a, i) => BEAT_VMG[i] / cosd(a));
const RUN_SPEED = GYBE_ANGLE.map((a, i) => RUN_VMG[i] / -cosd(a));

// Per-TWS curve of [twa, bsp], 0..180.
const CURVES = TWS.map((_, i) => {
  const pts = [[0, 0], [25, 0], [BEAT_ANGLE[i], BEAT_SPEED[i]]];
  TWA.forEach((a, r) => pts.push([a, BSP[r][i]]));
  pts.push([GYBE_ANGLE[i], RUN_SPEED[i]]);
  pts.sort((p, q) => p[0] - q[0]);
  // Dead run: keep the run VMG, i.e. bsp(180) = run VMG.
  pts.push([180, RUN_VMG[i]]);
  return pts;
});

function curveAt(i, twa) {
  const pts = CURVES[i];
  for (let k = 1; k < pts.length; k++) {
    if (twa <= pts[k][0]) {
      const [a0, s0] = pts[k - 1], [a1, s1] = pts[k];
      return a1 === a0 ? s1 : s0 + ((s1 - s0) * (twa - a0)) / (a1 - a0);
    }
  }
  return pts[pts.length - 1][1];
}

function seg(tws) {
  if (tws <= TWS[0]) return [0, 0];
  if (tws >= TWS[TWS.length - 1]) return [TWS.length - 2, 1];
  let i = 0;
  while (TWS[i + 1] < tws) i++;
  return [i, (tws - TWS[i]) / (TWS[i + 1] - TWS[i])];
}

function lerpArr(arr, tws) {
  const [i, f] = seg(tws);
  return arr[i] * (1 - f) + arr[i + 1] * f;
}

export function speed(tws, twa) {
  if (tws <= 0) return 0;
  const a = Math.min(180, Math.abs(twa));
  if (tws < TWS[0]) return curveAt(0, a) * (tws / TWS[0]);
  const [i, f] = seg(tws);
  return curveAt(i, a) * (1 - f) + curveAt(i + 1, a) * f;
}

export function beat(tws) {
  const angle = lerpArr(BEAT_ANGLE, tws);
  const scale = tws < TWS[0] ? Math.max(0, tws / TWS[0]) : 1;
  const spd = lerpArr(BEAT_SPEED, tws) * scale;
  return { angle, speed: spd, vmg: spd * cosd(angle) };
}

export function run(tws) {
  const angle = lerpArr(GYBE_ANGLE, tws);
  const scale = tws < TWS[0] ? Math.max(0, tws / TWS[0]) : 1;
  const spd = lerpArr(RUN_SPEED, tws) * scale;
  return { angle, speed: spd, vmg: -spd * cosd(angle) };
}

// Inverse: TWS that gives this beat angle (tacking angle / 2). Beat angle narrows with wind
// up to ~16 kn, so only that monotonic part is usable.
export function twsFromBeatAngle(angle) {
  if (angle >= BEAT_ANGLE[0]) return TWS[0];
  for (let i = 1; i <= 6; i++) {
    if (angle >= BEAT_ANGLE[i]) {
      const f = (BEAT_ANGLE[i - 1] - angle) / (BEAT_ANGLE[i - 1] - BEAT_ANGLE[i]);
      return TWS[i - 1] + f * (TWS[i] - TWS[i - 1]);
    }
  }
  return TWS[6];
}

// Inverse: TWS at which the boat sailing `perf` of polar would do `bsp` at `twa`.
export function twsFromSpeed(bsp, twa, perf = 0.9) {
  const target = bsp / perf;
  let lo = 0, hi = Math.abs(twa) < 52 ? 18 : 30;
  if (speed(hi, twa) < target) return null; // faster than polar → unreliable
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2;
    if (speed(mid, twa) < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export function table() {
  return TWS.map((tws, i) => ({
    tws,
    beatAngle: BEAT_ANGLE[i], beatSpeed: BEAT_SPEED[i], beatVmg: BEAT_VMG[i],
    gybeAngle: GYBE_ANGLE[i], runSpeed: RUN_SPEED[i], runVmg: RUN_VMG[i],
  }));
}
