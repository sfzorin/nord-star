// Shared drawing kit for the "Учебник" diagrams: water background, top-view yacht with sails,
// wind field, inflatable buoys, labels on a dark pill.

export const C = {
  WIND: '#6fd0ff', RIGHT: '#4a8dff', GIVE: '#ffb020', OK: '#3ee08a', TXT: '#eaf3fb', MUTED: '#8fa9c0', WARN: '#ff7a6b',
};

const f = (v) => (Math.round(v * 10) / 10).toString();

// Deterministic ripples so every diagram has the same calm-water texture.
const RIPPLES = Array.from({ length: 26 }, (_, i) => {
  const x = (i * 97) % 340 + 10, y = (i * 53) % 300 + 12, w = 10 + (i % 4) * 4;
  return `M${x},${y} q${w / 2},-3 ${w},0`;
}).join(' ');

export function svg(w, h, body, label = '') {
  return `<svg class="lsvg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">
    <rect width="${w}" height="${h}" rx="12" fill="#0d2a42"/>
    <path d="${RIPPLES}" fill="none" stroke="#7fb8de" stroke-width="1" opacity="0.12" stroke-linecap="round"/>
    ${body}</svg>`;
}

export const text = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-size="${o.size || 12}" fill="${o.fill || C.TXT}" text-anchor="${o.anchor || 'start'}"${o.bold ? ' font-weight="700"' : ''} font-family="system-ui,Arial,sans-serif">${s}</text>`;

// Label on a dark rounded pill — readable over water, boats and lines.
export function pill(x, y, s, color = C.TXT, anchor = 'middle', size = 12) {
  const w = s.length * size * 0.56 + 14, h = size + 9;
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  return `<rect x="${f(x0)}" y="${f(y - h + 5)}" width="${f(w)}" height="${h}" rx="${h / 2}" fill="#071523" fill-opacity="0.82" stroke="${color}" stroke-opacity="0.55"/>`
    + `<text x="${f(x0 + w / 2)}" y="${f(y)}" font-size="${size}" font-weight="700" fill="${color}" text-anchor="middle" font-family="system-ui,Arial,sans-serif">${s}</text>`;
}

export function arrow(x1, y1, x2, y2, c = C.WIND, w = 3) {
  const a = Math.atan2(y2 - y1, x2 - x1), h = 10;
  return `<line x1="${x1}" y1="${y1}" x2="${f(x2 - 6 * Math.cos(a))}" y2="${f(y2 - 6 * Math.sin(a))}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`
    + `<path d="M${f(x2 - h * Math.cos(a - 0.42))},${f(y2 - h * Math.sin(a - 0.42))} L${x2},${y2} L${f(x2 - h * Math.cos(a + 0.42))},${f(y2 - h * Math.sin(a + 0.42))} Z" fill="${c}"/>`;
}

// Wind as a small field of parallel streamlines blowing in `dir` (degrees the wind blows TOWARDS, 180 = down).
export function wind(x = 30, y = 10, dir = 180, len = 40) {
  const a = (dir - 90) * Math.PI / 180, nx = -Math.sin(a), ny = Math.cos(a);
  const ux = Math.cos(a), uy = Math.sin(a);
  const one = (o, l) => arrow(f(x + nx * o), f(y + ny * o), f(x + nx * o + ux * l), f(y + ny * o + uy * l), C.WIND, 2.4);
  return `<g opacity="0.95">${one(-11, len * 0.75)}${one(0, len)}${one(11, len * 0.75)}</g>${pill(x, y + len + 18, 'ветер', C.WIND, 'middle', 11)}`;
}

// Inflatable buoy with a highlight and a soft shadow.
export const buoy = (x, y) => `<ellipse cx="${x + 2}" cy="${y + 4}" rx="9" ry="5" fill="#000" opacity="0.3"/><circle cx="${x}" cy="${y}" r="8.5" fill="#ff8a2a" stroke="#fff" stroke-width="1.4"/><ellipse cx="${x - 3}" cy="${y - 3.5}" rx="2.6" ry="1.6" fill="#fff" opacity="0.7"/>`;

// Yacht seen from above, bow along `hdg` (0 = up). `rel` = wind angle on the bow, + = wind over starboard
// (starboard tack, sails out to port). `boomDeg` overrides the sail angle (0 = sheeted on the centreline).
export function boatTop(x, y, hdg, color = C.RIGHT, rel = 0, opts = {}) {
  const a = Math.abs(rel);
  const th = opts.boomDeg ?? (a < 60 ? 10 : a < 100 ? 34 : a < 140 ? 58 : 80);
  const side = rel >= 0 ? -1 : 1;
  const r = (d) => d * Math.PI / 180;
  const mast = [0, -5], bl = 20;
  const boomEnd = [side * Math.sin(r(th)) * bl, -5 + Math.cos(r(th)) * bl];
  const crescent = (p0, p1, bulge) => {
    const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L * side * -1, ny = dx / L * side * -1;
    return `M${f(p0[0])},${f(p0[1])} Q${f(mx + nx * bulge)},${f(my + ny * bulge)} ${f(p1[0])},${f(p1[1])} Q${f(mx + nx * bulge * 0.35)},${f(my + ny * bulge * 0.35)} ${f(p0[0])},${f(p0[1])} Z`;
  };
  const jibEnd = [side * (3 + 9 * Math.sin(r(Math.min(th, 50)))), -4 + 3 * Math.cos(r(Math.min(th, 50)))];
  const sails = opts.noSail ? '' :
    `<path d="${crescent([0, -21], jibEnd, 7.5)}" fill="#f4f7fa" stroke="#52677a" stroke-width="0.8"/>`
    + `<path d="${crescent(mast, boomEnd, 9.5)}" fill="#f4f7fa" stroke="#52677a" stroke-width="0.8"/>`
    + `<line x1="0" y1="-5" x2="${f(boomEnd[0])}" y2="${f(boomEnd[1])}" stroke="#e3e9ef" stroke-width="1.8" stroke-linecap="round"/>`;
  const hull = 'M0,-22 C6,-18 9,-9 9.5,3 L9,19 C6,21 -6,21 -9,19 L-9.5,3 C-9,-9 -6,-18 0,-22 Z';
  const sc = opts.scale ?? 1.2;
  return `<g transform="translate(${f(x)},${f(y)}) rotate(${f(hdg)}) scale(${sc})">
      <path d="${hull}" transform="translate(2,3)" fill="#000" opacity="0.32"/>
      <path d="${hull}" fill="${color}" stroke="#061422" stroke-width="1"/>
      <path d="M0,-18 C4.5,-15 7,-8 7.4,3 L7,16 L-7,16 L-7.4,3 C-7,-8 -4.5,-15 0,-18 Z" fill="#fff" opacity="0.16"/>
      <rect x="-4.5" y="-3" width="9" height="9" rx="3" fill="#fff" opacity="0.28"/>
      <rect x="-5.5" y="9" width="11" height="8" rx="2" fill="#061422" opacity="0.45"/>
      ${sails}
      <circle cx="0" cy="-5" r="1.6" fill="#e9eef3"/>
    </g>`;
}

export const route = (d, c = C.MUTED, w = 2, dash = '6 5') => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-dasharray="${dash}" stroke-linecap="round" stroke-linejoin="round"/>`;

// Point at distance `len` along compass bearing `brg` (0 = up the page) from (x, y).
export const at = (x, y, brg, len) => [x + Math.sin(brg * Math.PI / 180) * len, y - Math.cos(brg * Math.PI / 180) * len];
