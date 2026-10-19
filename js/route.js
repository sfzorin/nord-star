// Routing over water: keeps course legs off land.
// Grid = depth lookup (≈50 m cells, Web-Mercator rows). Navigable = water with CLEAR_CELLS of water around.

const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const invMercY = (y) => (Math.atan(Math.exp(y)) * 360) / Math.PI - 90;

// grid: {w, h, bounds: [[S, W], [N, E]], water: Uint8Array (1 = water)}
export function makeNav(grid, clearCells = 2) {
  const { w, h } = grid;
  const [[S, W], [N, E]] = grid.bounds;
  const yN = mercY(N), yS = mercY(S);
  const erode = (r) => {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let ok = grid.water[y * w + x] === 1;
        for (let dy = -r; ok && dy <= r; dy++) {
          for (let dx = -r; ok && dx <= r; dx++) {
            if (dx * dx + dy * dy > r * r) continue;
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h || grid.water[yy * w + xx] !== 1) ok = false;
          }
        }
        out[y * w + x] = ok ? 1 : 0;
      }
    }
    return out;
  };
  // A* keeps ~100 m off the shore; straight legs only need ~50 m (fewer zig-zags in channels).
  const nav = erode(clearCells);
  const vis = erode(Math.max(1, clearCells - 1));
  const cellOf = (p) => ({
    x: Math.floor(((p.lon - W) / (E - W)) * w),
    y: Math.floor(((yN - mercY(p.lat)) / (yN - yS)) * h),
  });
  const llOf = (x, y) => ({ lon: W + ((x + 0.5) / w) * (E - W), lat: invMercY(yN - ((y + 0.5) / h) * (yN - yS)) });
  const inside = (c) => c.x >= 0 && c.y >= 0 && c.x < w && c.y < h;
  const ok = (c) => inside(c) && nav[c.y * w + c.x] === 1;
  const see = (c) => inside(c) && vis[c.y * w + c.x] === 1;
  return { w, h, nav, cellOf, llOf, inside, ok, see };
}

// Every ~half cell along a→b must be navigable. Points outside the grid count as open sea.
export function clearLine(N, a, b) {
  const ca = N.cellOf(a), cb = N.cellOf(b);
  const n = Math.max(2, Math.ceil(Math.hypot(cb.x - ca.x, cb.y - ca.y) * 2));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const c = N.cellOf({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t });
    if (N.inside(c) && !N.see(c)) return false;
  }
  return true;
}

// Nearest navigable point (spiral search), or the point itself if already fine / off-grid.
export function snap(N, p, maxCells = 40) {
  const c = N.cellOf(p);
  if (!N.inside(c) || N.ok(c)) return p;
  for (let r = 1; r <= maxCells; r++) {
    let best = null, bd = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const q = { x: c.x + dx, y: c.y + dy };
        if (N.ok(q)) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = q; } }
      }
    }
    if (best) return N.llOf(best.x, best.y);
  }
  return p;
}

// A* on the 8-connected grid, then string-pulled to the fewest straight legs.
export function path(N, a, b) {
  if (clearLine(N, a, b)) return [];
  const s = N.cellOf(snap(N, a)), g = N.cellOf(snap(N, b));
  if (!N.inside(s) || !N.inside(g)) return [];
  const { w, h } = N;
  const idx = (x, y) => y * w + x;
  const gScore = new Float64Array(w * h).fill(Infinity);
  const closed = new Uint8Array(w * h);
  const came = new Int32Array(w * h).fill(-1);
  const open = new MinHeap();
  const H = (x, y) => Math.hypot(x - g.x, y - g.y);
  gScore[idx(s.x, s.y)] = 0;
  open.push(idx(s.x, s.y), H(s.x, s.y));
  const goal = idx(g.x, g.y);
  const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  let found = false;
  while (open.size) {
    const cur = open.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === goal) { found = true; break; }
    const cx = cur % w, cy = (cur - cx) / w;
    for (const [dx, dy, cost] of D) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || !N.nav[idx(nx, ny)]) continue;
      const ng = gScore[cur] + cost;
      const ni = idx(nx, ny);
      if (ng < gScore[ni]) { gScore[ni] = ng; came[ni] = cur; open.push(ni, ng + H(nx, ny)); }
    }
  }
  if (!found) return [];
  const cells = [];
  for (let c = goal; c !== -1; c = came[c]) cells.push(c);
  cells.reverse();
  const pts = cells.map((c) => N.llOf(c % w, Math.floor(c / w)));
  // String-pull: from the current anchor jump to the farthest visible cell until b is in sight.
  const out = [];
  let anchor = snap(N, a), i = 0;
  while (i < pts.length && !clearLine(N, anchor, b)) {
    let j = i;
    while (j + 1 < pts.length && clearLine(N, anchor, pts[j + 1])) j++;
    out.push(pts[j]);
    anchor = pts[j];
    i = j + 1;
  }
  return out;
}

class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v;
    k.push(key); v.push(val);
    let i = k.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (v[p] <= v[i]) break;
      [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]];
      i = p;
    }
  }
  pop() {
    const k = this.k, v = this.v;
    const top = k[0];
    const lk = k.pop(), lv = v.pop();
    if (k.length) {
      k[0] = lk; v[0] = lv;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < k.length && v[l] < v[m]) m = l;
        if (r < k.length && v[r] < v[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]];
        i = m;
      }
    }
    return top;
  }
}
