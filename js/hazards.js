// Known dangers (shoals, rocks). Built-in ones + the crew's own, kept in st.hazards.
import * as G from './geo.js?v=8';
import { HAZARDS_M } from './marmaris.js?v=8';

// Göcek gulf north cardinal (OSM node, black-over-yellow pillar, two cones up) south of which
// there is a shoal drying to ~0 m — the crew has grounded there. Extent is not charted in OSM:
// conservative circle 10–170 m south of the buoy, adjust on the map.
export const DEFAULT_HAZARDS = [
  {
    id: 'H_GOCEK_N', venue: 'gocek', name: 'Мель 0 м у сев. кардинала', lat: 36.71288, lon: 28.91835, r: 80, depth: 0,
    buoy: { lat: 36.71369, lon: 28.91835, type: 'N' }, note: 'проходить севернее кардинала', builtin: true,
  },
  ...HAZARDS_M,
];

// Depth cap inside a hazard: 0 m in the core, back to the model at the edge.
export function hazardDepth(hazards, p, modelDepth) {
  let d = modelDepth;
  for (const h of hazards) {
    const dist = G.distance(h, p);
    if (dist < h.r) d = Math.min(d ?? Infinity, h.depth ?? 0);
    else if (dist < h.r + 60) d = Math.min(d ?? Infinity, (h.depth ?? 0) + ((dist - h.r) / 60) * 6);
  }
  return d;
}

// Closest danger along the next `seconds` of the current track (or the one we're in).
export function hazardAhead(hazards, fix, seconds = 180, margin = 30) {
  if (!fix) return null;
  let best = null;
  const len = Math.max(150, fix.sog * G.KN * seconds);
  for (const h of hazards) {
    const F = G.frame(fix);
    const c = F.xy(h);
    const u = G.unit(fix.cog);
    const along = G.dot(c, u);
    const off = Math.abs(G.cross(u, c));
    const R = h.r + margin;
    const here = G.len(c);
    if (here < h.r) return { h, inside: true, dist: 0 };
    if (along > 0 && along < len + R && off < R) {
      const dist = Math.max(0, along - Math.sqrt(Math.max(0, R * R - off * off)));
      if (!best || dist < best.dist) best = { h, inside: false, dist };
    }
  }
  return best;
}
