// Geodesy and flat-plane vector helpers.
// Short racing distances (<10 nm) → local tangent plane is accurate to centimetres.

export const R = 6371008.8;
export const NM = 1852;
export const KN = 1852 / 3600; // m/s per knot

export const toRad = (d) => (d * Math.PI) / 180;
export const toDeg = (r) => (r * 180) / Math.PI;
export const norm360 = (a) => ((a % 360) + 360) % 360;
export const norm180 = (a) => {
  const x = norm360(a);
  return x > 180 ? x - 360 : x;
};

export function distance(a, b) {
  const p1 = toRad(a.lat), p2 = toRad(b.lat);
  const dp = p2 - p1, dl = toRad(b.lon - a.lon);
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearing(a, b) {
  const p1 = toRad(a.lat), p2 = toRad(b.lat), dl = toRad(b.lon - a.lon);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return norm360(toDeg(Math.atan2(y, x)));
}

export function destination(p, brg, dist) {
  const d = dist / R, t = toRad(brg), p1 = toRad(p.lat), l1 = toRad(p.lon);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(t));
  const l2 = l1 + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return { lat: toDeg(p2), lon: toDeg(l2) };
}

export const midpoint = (a, b) => ({ lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 });

// Local east/north metres around an origin.
export function frame(origin) {
  const k = Math.cos(toRad(origin.lat));
  return {
    xy: (p) => ({ x: toRad(p.lon - origin.lon) * R * k, y: toRad(p.lat - origin.lat) * R }),
    ll: (v) => ({ lat: origin.lat + toDeg(v.y / R), lon: origin.lon + toDeg(v.x / (R * k)) }),
  };
}

export const unit = (brg) => ({ x: Math.sin(toRad(brg)), y: Math.cos(toRad(brg)) });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
export const dot = (a, b) => a.x * b.x + a.y * b.y;
export const cross = (a, b) => a.x * b.y - a.y * b.x;
export const len = (a) => Math.hypot(a.x, a.y);
export const vbearing = (v) => norm360(toDeg(Math.atan2(v.x, v.y)));

export function circMean(angles) {
  let s = 0, c = 0;
  for (const a of angles) { s += Math.sin(toRad(a)); c += Math.cos(toRad(a)); }
  return norm360(toDeg(Math.atan2(s, c)));
}

// Write vector D as a*u + b*v (distances on two headings, e.g. two tacks).
export function decompose(D, u, v) {
  const den = cross(u, v);
  if (Math.abs(den) < 1e-9) return null;
  return { a: cross(D, v) / den, b: cross(u, D) / den };
}
