// NMEA 0183 sentences from the boat instruments (via the YDWG-02 Wi-Fi gateway or any NMEA 0183 source).
// parse() updates a plain state object; every value carries its own timestamp so stale data can be ignored.
//
//   wind:    MWV (apparent R / true T, angle off the bow), MWD (true direction), VWR, VWT
//   speed:   VHW (speed through water + heading)
//   heading: HDG (magnetic + variation), HDM, HDT
//   depth:   DPT (with transducer offset), DBT
//   other:   MTW (water temperature)

const KN = { N: 1, M: 1.943844, K: 1 / 1.852 };
const num = (s) => (s === undefined || s === '' ? null : Number(s));
const norm360 = (a) => ((a % 360) + 360) % 360;

export function checksumOk(line) {
  const star = line.lastIndexOf('*');
  if (star < 0) return true; // some sources omit it
  let cs = 0;
  for (let i = 1; i < star; i++) cs ^= line.charCodeAt(i);
  return cs === parseInt(line.slice(star + 1, star + 3), 16);
}

// Returns the sentence type that was understood (e.g. 'MWV'), or null.
export function parse(line, S, now = Date.now()) {
  line = line.trim();
  if (!/^[$!][A-Z]{5}/.test(line) || !checksumOk(line)) return null;
  const f = line.slice(1, line.lastIndexOf('*') > 0 ? line.lastIndexOf('*') : undefined).split(',');
  const type = f[0].slice(2);
  const put = (k, v) => { if (v != null && Number.isFinite(v)) S[k] = { v, t: now }; };
  switch (type) {
    case 'MWV': {
      if (f[5] && f[5] !== 'A') return null;
      const ang = num(f[1]), spd = num(f[3]) * (KN[f[4]] ?? 1);
      if (f[2] === 'R') { put('awa', norm180(ang)); put('aws', spd); } else if (f[2] === 'T') { put('twa', norm180(ang)); put('tws', spd); }
      return type;
    }
    case 'MWD': {
      const dirT = num(f[1]), dirM = num(f[3]);
      const kn = num(f[5]) ?? (num(f[7]) != null ? num(f[7]) * KN.M : null);
      if (dirT != null) put('twd', norm360(dirT)); else if (dirM != null) put('twdM', norm360(dirM));
      put('tws', kn);
      return type;
    }
    case 'VWR': case 'VWT': {
      const a = num(f[1]), side = f[2] === 'L' ? -1 : 1, kn = num(f[3]);
      if (type === 'VWR') { put('awa', side * a); put('aws', kn); } else { put('twa', side * a); put('tws', kn); }
      return type;
    }
    case 'VHW': {
      put('stw', num(f[5]) ?? (num(f[7]) != null ? num(f[7]) * KN.K : null));
      if (num(f[1]) != null) put('hdgT', norm360(num(f[1])));
      else if (num(f[3]) != null) put('hdgM', norm360(num(f[3])));
      return type;
    }
    case 'HDG': {
      const h = num(f[1]);
      if (h == null) return null;
      const dev = (num(f[2]) ?? 0) * (f[3] === 'W' ? -1 : 1);
      const vr = num(f[4]);
      put('hdgM', norm360(h + dev));
      if (vr != null) { put('var', vr * (f[5] === 'W' ? -1 : 1)); put('hdgT', norm360(h + dev + S.var.v)); }
      return type;
    }
    case 'HDM': put('hdgM', num(f[1]) == null ? null : norm360(num(f[1]))); return type;
    case 'HDT': put('hdgT', num(f[1]) == null ? null : norm360(num(f[1]))); return type;
    case 'DPT': {
      const d = num(f[1]), off = num(f[2]) ?? 0;
      // Positive offset = transducer to waterline (depth of water); negative = transducer to keel.
      put('depth', d == null ? null : off > 0 ? d + off : d);
      if (d != null && off < 0) put('underKeel', d + off);
      return type;
    }
    case 'DBT': put('depth', num(f[3]) ?? (num(f[1]) != null ? num(f[1]) * 0.3048 : null)); return type;
    case 'MTW': put('waterT', num(f[1])); return type;
    default: return null;
  }
}

function norm180(a) { const x = norm360(a); return x > 180 ? x - 360 : x; }
