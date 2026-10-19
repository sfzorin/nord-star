// Depth from EMODnet Bathymetry REST (for Turkey it serves GEBCO 2024, ~100–450 m grid).
// Coarse: good for "deep water / getting shallow", not for rocks or harbour entrances.

const API = 'https://rest.emodnet-bathymetry.eu/depth_sample?geom=';
const cache = new Map(); // key: lat/lon rounded to ~100 m → depth (m, positive) | null
const pending = new Map();

const key = (p) => `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;

// Offline lookup per venue from <venue>/depth_lut.png (same model as the map overlay).
import { VENUES, venueAt } from './venues.js?v=8';
const luts = {};
async function loadLut(id) {
  const dir = VENUES[id].data;
  const meta = await (await fetch(`${dir}/depth.json`)).json();
  const img = new Image();
  img.src = `${dir}/depth_lut.png`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  return { meta, data: ctx.getImageData(0, 0, img.width, img.height).data, w: img.width, h: img.height };
}
const lutReady = Promise.all(Object.keys(VENUES).map(async (id) => {
  try { luts[id] = await loadLut(id); } catch { luts[id] = null; }
}));

const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
function fromLut(lut, p) {
  const [[S, W], [N, E]] = lut.meta.bounds;
  if (p.lat < S || p.lat > N || p.lon < W || p.lon > E) return undefined;
  const x = Math.floor(((p.lon - W) / (E - W)) * lut.w);
  const y = Math.floor(((mercY(N) - mercY(p.lat)) / (mercY(N) - mercY(S))) * lut.h);
  const i = (Math.min(lut.h - 1, y) * lut.w + Math.min(lut.w - 1, x)) * 4;
  if (lut.data[i + 2] < 128) return 0; // land
  return (lut.data[i] * 256 + lut.data[i + 1]) / 10;
}

import { hazardDepth } from './hazards.js?v=8';
let hazards = [];
export function setHazards(list) { hazards = list || []; }

export async function depthAt(p) {
  const v = await modelDepth(p);
  return v == null ? v : hazardDepth(hazards, p, v);
}

async function modelDepth(p) {
  await lutReady;
  const lut = luts[venueAt(p)];
  if (lut) { const v = fromLut(lut, p); if (v !== undefined) return v; }
  const k = key(p);
  if (cache.has(k)) return cache.get(k);
  if (pending.has(k)) return pending.get(k);
  const req = fetch(`${API}POINT(${p.lon.toFixed(5)}%20${p.lat.toFixed(5)})`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      const v = j && Number.isFinite(j.smoothed ?? j.avg) ? -(j.smoothed ?? j.avg) : null;
      const d = v != null && v > 0 ? v : v != null ? 0 : null; // ≤ 0 → land / drying
      cache.set(k, d);
      return d;
    })
    .catch(() => null)
    .finally(() => pending.delete(k));
  pending.set(k, req);
  return req;
}

export const SOURCE = 'модель: EMODnet/GEBCO 2024 + берег OSM, сглажено';

// Navigation grid (water with ~100 m clearance) for keeping course legs off land.
import { makeNav } from './route.js?v=8';
// Hazards (shoals) are closed for routing with a 50 m margin; rebuilt on each call (~tens of ms).
export async function getNav(venue) {
  await lutReady;
  const lut = luts[venue];
  if (!lut) return null;
  const water = new Uint8Array(lut.w * lut.h);
  for (let i = 0; i < water.length; i++) water[i] = lut.data[i * 4 + 2] >= 128 ? 1 : 0;
  const N0 = makeNav({ w: lut.w, h: lut.h, bounds: lut.meta.bounds, water }, 0);
  for (const h of hazards) {
    const c = N0.cellOf(h), rc = Math.ceil((h.r + 50) / 50) + 1;
    for (let y = c.y - rc; y <= c.y + rc; y++) {
      for (let x = c.x - rc; x <= c.x + rc; x++) {
        if (x < 0 || y < 0 || x >= lut.w || y >= lut.h) continue;
        const p = N0.llOf(x, y);
        const dy = (p.lat - h.lat) * 111320, dx = (p.lon - h.lon) * 111320 * Math.cos((h.lat * Math.PI) / 180);
        if (Math.hypot(dx, dy) < h.r + 50) water[y * lut.w + x] = 0;
      }
    }
  }
  return makeNav({ w: lut.w, h: lut.h, bounds: lut.meta.bounds, water }, 2);
}
