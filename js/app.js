import * as G from './geo.js?v=8';
import * as P from './polar.js?v=8';
import { BOAT } from './boat.js?v=8';
import { Horn, StartTimer } from './timer.js?v=8';
import { RealGPS } from './gps.js?v=8';
import { RaceMap } from './map.js?v=8';
import { WindEstimator } from './wind.js?v=8';
import { depthAt, getNav, setHazards } from './depth.js?v=8';
import { DEFAULT_HAZARDS, hazardAhead } from './hazards.js?v=8';
import { VENUES, venueAt } from './venues.js?v=8';
import { COURSES, ISLANDS, STARTS, buildCourse } from './courses.js?v=8';

const KEY = 'nordstar.race.v1';
const AREA = { lat: 36.645, lon: 29.012 }; // Fethiye Körfezi, between Fethiye and Göcek
const DECLINATION = 5.5; // °E, Fethiye 2026
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- state
function wlCourse(mid, brg, distNm, laps) {
  const W = { id: 'W1', name: 'W1', ...G.destination(mid, brg, distNm * G.NM), approx: false };
  const Lw = { id: 'L1', name: 'L1', ...G.destination(mid, brg, 0.06 * G.NM), approx: false };
  const course = [];
  for (let i = 0; i < laps; i++) { if (i) course.push('L1'); course.push('W1'); }
  return { marks: [W, Lw], course };
}

// First launch: no course and no line — the start banner walks the crew through setting them up.
function defaults() {
  return {
    pin: null,
    rc: null,
    marks: [],
    course: [],
    legIdx: 0,
    announcedBrg: null,
    manualWind: { twd: null, tws: null },
    set: { sound: true, voice: true, preset: 300, bowOffset: 7, accelSec: 8, roundRadius: 40, follow: true },
  };
}

function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
const saved = load();
const D0 = defaults();
const st = { ...D0, ...saved, set: { ...D0.set, ...(saved.set || {}) } };
delete st.gpsMode; delete st.sim;
// Hazards are built into the app (not edited on board).
st.hazards = DEFAULT_HAZARDS;
if (!VENUES[st.venue]) st.venue = venueAt(lineMid() || AREA) || 'gocek';
setHazards(st.hazards);
let saveT = null;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* storage off */ } }, 300);
}

// runtime only
const R = {
  fix: null, gpsErr: null, track: [], lastTrackT: 0,
  prevLine: null, ocs: false, started: false, startedAt: null, finishedAt: null,
  place: null, round: null, forecast: null, compass: null, windHist: [], lastD: null,
  depth: { here: null, ahead: null, at: null, t: 0, warned: false },
};

// ---------------------------------------------------------------- services
const horn = new Horn();
horn.sound = st.set.sound;
horn.voice = st.set.voice;
const timer = new StartTimer(horn);
timer.preset = st.set.preset;
// Restore a running countdown / race after a reload or Android killing the tab.
if (st.race?.gun) {
  timer.gun = st.race.gun;
  timer.lastSec = Math.ceil(timer.remaining());
  timer.gunFired = timer.remaining() <= 0;
  Object.assign(R, { started: !!st.race.started, startedAt: st.race.startedAt || null, finishedAt: st.race.finishedAt || null, ocs: !!st.race.ocs });
}
function saveRace() {
  st.race = timer.running ? { gun: timer.gun, started: R.started, startedAt: R.startedAt, finishedAt: R.finishedAt, ocs: R.ocs } : null;
  save();
}
timer.onGun = () => {
  if (R.prevLine && R.prevLine.d > 0) { R.ocs = true; setTimeout(() => horn.say('Фальстарт. Вернитесь'), 900); }
  saveRace();
};

const wind = new WindEstimator();
wind.manual = { ...st.manualWind };
function applyPriors() {
  const f = R.forecast;
  wind.setPrior({
    twd: st.announcedBrg ?? f?.twd ?? null,
    tws: f?.tws ?? null,
    src: st.announcedBrg != null ? 'азимут на знак' : f ? 'прогноз' : null,
  });
}
applyPriors();

let gps = null;

const map = new RaceMap($('map'), lineMid() || AREA, {
  onClick: handlePlace,
  onDrag: (what, p, id) => {
    if (what === 'pin') st.pin = p;
    else if (what === 'rc') st.rc = p;
    else if (what === 'mark') { const m = st.marks.find((x) => x.id === id); if (m) Object.assign(m, p, { approx: false }); renderCourse(); }
    save();
  },
  onUserPan: () => { st.set.follow = false; save(); renderFollow(); },
});

function startGps() {
  R.fix = null;
  R.gpsErr = null;
  gps = new RealGPS(onFix, (msg) => (R.gpsErr = msg));
  gps.start();
}

function onFix(fix) {
  R.fix = fix;
  wind.add(fix);
  pollDepth(fix);
  if (fix.t - R.lastTrackT > 2000 && fix.sog > 0.3) {
    R.lastTrackT = fix.t;
    R.track.push({ lat: fix.lat, lon: fix.lon, t: fix.t, sog: fix.sog });
    if (R.track.length > 30000) R.track.shift();
    map.addTrack(fix);
  }
}

// Depth under the boat and 200 m ahead, re-queried every ~60 m or 20 s.
const SHALLOW = BOAT.draft + 3; // m
function pollDepth(fix) {
  const d = R.depth;
  if (d.at && G.distance(d.at, fix) < 60 && fix.t - d.t < 20000) return;
  d.at = { lat: fix.lat, lon: fix.lon };
  d.t = fix.t;
  depthAt(fix).then((v) => (d.here = v));
  const ahead = G.destination(fix, fix.cog, Math.max(200, fix.sog * G.KN * 120));
  depthAt(ahead).then((v) => {
    d.ahead = v;
    if (v != null && v < SHALLOW) {
      if (!d.warned) { horn.beep(500, 0.5); horn.say('Мелко впереди'); d.warned = true; }
    } else d.warned = false;
  });
}

// ---------------------------------------------------------------- geometry helpers
function lineMid() { return st.pin && st.rc ? G.midpoint(st.pin, st.rc) : null; }
function courseMarks() { return st.course.map((id) => st.marks.find((m) => m.id === id)).filter(Boolean); }

function nextMarkId() { const c = courseMarks(); return st.legIdx < c.length ? c[st.legIdx].id : null; }

// Vector D = a·u + b·v solved for two headings; returns sailing distance on each.
function twoLeg(fromXY, h1, h2) {
  const dec = G.decompose(G.mul(fromXY, -1), G.unit(h1), G.unit(h2));
  return dec;
}

// ---------------------------------------------------------------- main computation
function compute() {
  const now = Date.now();
  const D = { now, rem: timer.remaining(now) };
  const fix = R.fix;
  const twd = wind.twd, tws = wind.tws;
  D.twd = twd; D.tws = tws;
  D.beat = P.beat(tws); D.run = P.run(tws);
  if (!fix || twd == null) return D;

  const twa = G.norm180(twd - fix.cog);
  D.twa = twa;
  D.polarSpd = P.speed(tws, twa);
  D.perf = D.polarSpd > 0.5 && fix.sog > 0.5 ? (fix.sog / D.polarSpd) * 100 : null;
  const a = Math.abs(twa);
  D.target = a < 60 ? D.beat.speed : a > 120 ? D.run.speed : D.polarSpd;
  D.tackHdg = G.norm360(2 * twd - fix.cog);
  D.shift = fix.sog > 1.5 ? wind.shift(fix.cog, twa) : null;

  // ---- start line
  if (st.pin && st.rc) {
    const mid = lineMid();
    const F = G.frame(mid);
    const Pp = F.xy(st.pin), Bp = F.xy(st.rc);
    const e = G.sub(Bp, Pp), L = G.len(e), eu = G.mul(e, 1 / L);
    const first = courseMarks().find((m) => !m.via && G.distance(mid, m) > 300);
    const up = first ? G.unit(G.bearing(mid, first)) : G.unit(twd);
    let n = { x: -eu.y, y: eu.x };
    if (G.dot(n, up) < 0) n = G.mul(n, -1);
    const hd = G.unit(fix.cog);
    const bow = G.add(F.xy(fix), G.mul(hd, st.set.bowOffset));
    const rel = G.sub(bow, Pp);
    const d = G.dot(rel, n); // > 0: course side (OCS before the gun)
    const along = G.dot(rel, eu);
    const ln = { L, d, along, brg: G.vbearing(e) };

    // Bias: how much further upwind one end is (wind axis).
    const pr = G.dot(e, G.unit(twd));
    ln.bias = { end: pr >= 0 ? 'rc' : 'pin', m: Math.abs(pr), deg: G.toDeg(Math.asin(Math.min(1, Math.abs(pr) / L))) };

    // Time to line on current course & speed.
    const v = G.mul(hd, fix.sog * G.KN);
    const vn = G.dot(v, n);
    ln.ttlNow = d < 0 && vn > 0.05 ? -d / vn : null;
    if (ln.ttlNow != null) {
      ln.crossFrac = (along + G.dot(v, eu) * ln.ttlNow) / L;
      ln.crossLL = F.ll(G.add(Pp, G.mul(eu, ln.crossFrac * L)));
    }

    // Time to line at full polar speed (current heading if it reaches the line and isn't
    // pinching, otherwise close-hauled on the best tack) + acceleration and turn penalty.
    if (d < 0) {
      let hdg = fix.cog, spd = D.polarSpd;
      const towards = G.dot(hd, n);
      if (!(towards > 0.15 && a >= D.beat.angle - 3)) {
        const sideNow = twa >= 0 ? 1 : -1;
        const cands = [sideNow, -sideNow].map((s) => ({ h: G.norm360(twd - s * D.beat.angle), s }));
        cands.forEach((c) => (c.vn = G.dot(G.unit(c.h), n)));
        const pick = cands.find((c) => c.vn > 0.25) || cands.sort((x, y) => y.vn - x.vn)[0];
        hdg = pick.h;
        spd = D.beat.speed;
      }
      spd = Math.max(spd, fix.sog); // never slower than we already go
      const vnT = G.dot(G.unit(hdg), n) * spd * G.KN;
      if (vnT > 0.05 && spd > 0.5) {
        const turn = Math.abs(G.norm180(hdg - fix.cog));
        const turnPen = turn > 100 ? 8 : turn > 30 ? 3 : 0;
        const accelPen = (st.set.accelSec * Math.max(0, 1 - fix.sog / spd)) / 2;
        ln.ttlFull = -d / vnT + accelPen + turnPen;
        ln.fullHdg = hdg;
      }
      if (timer.running && D.rem > 0 && ln.ttlFull != null) ln.burn = D.rem - ln.ttlFull;
    }
    D.line = ln;
  }

  // ---- next mark / finish
  const marks = courseMarks();
  let target = null;
  if (st.legIdx < marks.length) {
    const m = marks[st.legIdx];
    const real = m.via ? marks.slice(st.legIdx).find((x) => !x.via) : m;
    target = { name: m.via ? `обход → ${real ? real.name : 'финиш'}` : m.name, ll: m, approx: m.approx, isFinish: false, wpt: !!m.wp };
  } else if (D.line) {
    // Finish = start line: aim at the nearest point of the line.
    const t = Math.max(0, Math.min(1, D.line.along / D.line.L));
    target = { name: 'ФИНИШ', ll: { lat: st.pin.lat + (st.rc.lat - st.pin.lat) * t, lon: st.pin.lon + (st.rc.lon - st.pin.lon) * t }, isFinish: true };
  }
  if (target) {
    const brg = G.bearing(fix, target.ll), dst = G.distance(fix, target.ll);
    const mTwa = G.norm180(twd - brg);
    const am = Math.abs(mTwa);
    const leg = am < D.beat.angle ? 'beat' : am > D.run.angle ? 'run' : 'reach';
    const M = { ...target, brg, dst, leg, mTwa };
    M.vmc = fix.sog * Math.cos(G.toRad(fix.cog - brg));
    const Fm = G.frame(target.ll);
    const bp = Fm.xy(fix);
    if (leg === 'beat' || leg === 'run') {
      // Track over ground is ~3° wider than the heading upwind (leeway).
      const ang = leg === 'beat' ? D.beat.angle + 3 : D.run.angle;
      const spd = leg === 'beat' ? D.beat.speed : D.run.speed;
      const hS = G.norm360(twd - ang), hP = G.norm360(twd + ang);
      const dec = twoLeg(bp, hS, hP);
      if (dec) {
        M.legS = dec.a; M.legP = dec.b;
        M.etaSec = (Math.max(0, dec.a) + Math.max(0, dec.b)) / (spd * G.KN);
        const onS = twa >= 0;
        const mine = onS ? dec.a : dec.b, other = onS ? dec.b : dec.a;
        if (other < -20 || mine < -20) M.lay = { kind: 'over' };
        else if (other <= 20) M.lay = { kind: 'fetch' };
        else if (mine <= 0) M.lay = { kind: 'over' };
        else M.lay = { kind: 'to', dist: mine, sec: mine / Math.max(0.5, fix.sog) / G.KN, nextHdg: onS ? hP : hS };
      }
      const back = 180, len = 2.5 * G.NM;
      D.laylines = [
        { a: target.ll, b: G.destination(target.ll, hS + back, len), color: '#34e27a' },
        { a: target.ll, b: G.destination(target.ll, hP + back, len), color: '#ff4f4f' },
      ];
    } else {
      M.etaSec = dst / (Math.max(0.5, P.speed(tws, mTwa)) * G.KN);
      D.laylines = [];
    }
    D.mark = M;
  }
  return D;
}

// ---------------------------------------------------------------- events
function detectEvents(D) {
  const fix = R.fix;
  const ln = D.line;
  if (ln) {
    const prev = R.prevLine;
    R.prevLine = ln;
    if (prev) {
      const crossed = Math.sign(prev.d) !== Math.sign(ln.d) && ln.along > -30 && ln.along < ln.L + 30;
      const afterGun = timer.running && D.rem <= 0;
      if (afterGun && !R.started) {
        if (R.ocs && ln.d < 0) { R.ocs = false; saveRace(); horn.say('Вернулись. Стартуйте'); }
        else if (!R.ocs && crossed && prev.d < 0 && ln.d >= 0) {
          R.started = true;
          R.startedAt = Date.now();
          st.legIdx = 0;
          saveRace();
          horn.say('Стартовали');
          switchTab('race');
        }
      }
      if (R.started && !R.finishedAt && st.legIdx >= courseMarks().length && crossed) {
        R.finishedAt = Date.now();
        saveRace();
        horn.horn(1.2);
        horn.say('Финиш');
      }
    }
  }

  // Mark rounding → next leg.
  const M = D.mark;
  const practice = !timer.running;
  // Island waypoints: passed once the next target is closer than from the waypoint itself.
  if (M && M.wpt && fix && (R.started || practice)) {
    const nxt = courseMarks()[st.legIdx + 1] || lineMid();
    if (nxt && M.dst < 900 && G.distance(fix, nxt) < G.distance(M.ll, nxt)) {
      st.legIdx++; R.round = null; save(); renderCourse();
    }
  } else if (M && !M.isFinish && fix && (R.started || practice)) {
    roundMark(M, fix);
  }

  // Wind trend history (10 s).
  if (D.twd != null && (!R.windHist.length || D.now - R.windHist[R.windHist.length - 1].t > 10000)) {
    R.windHist.push({ t: D.now, twd: D.twd });
    while (R.windHist.length && D.now - R.windHist[0].t > 15 * 60000) R.windHist.shift();
  }
}

// Regular marks: pass inside the rounding radius, then open up → next leg.
// Approximate marks (bearing only): a real rounding is a turn > 100° (a tack is ~90°) —
// the closest point then becomes the mark's true position.
function roundMark(M, fix) {
  const zone = M.approx ? 400 : st.set.roundRadius * 3;
  if (M.dst < zone) {
    if (!R.round || R.round.name !== M.name) R.round = { name: M.name, minD: M.dst, minPos: { lat: fix.lat, lon: fix.lon }, hdgIn: fix.cog };
    if (M.dst < R.round.minD) Object.assign(R.round, { minD: M.dst, minPos: { lat: fix.lat, lon: fix.lon } });
    const turn = Math.abs(G.norm180(fix.cog - R.round.hdgIn));
    const passed = M.dst > R.round.minD + 25;
    const ok = M.approx ? turn > 100 : R.round.minD < st.set.roundRadius;
    if (passed && ok) {
      const mk = st.marks.find((m) => m.id === nextMarkId());
      if (mk && mk.approx) { Object.assign(mk, R.round.minPos, { approx: false }); toast(`Знак ${mk.name} уточнён`); }
      st.legIdx++;
      R.round = null;
      save();
      renderCourse();
      horn.say(`Знак ${M.name} пройден`);
    }
  } else if (R.round && R.round.name === M.name) {
    R.round = null;
  }
}

// ---------------------------------------------------------------- formatting
const pad = (n) => String(n).padStart(2, '0');
function fmtSec(s, sign = false) {
  if (s == null || !Number.isFinite(s)) return '—';
  const neg = s < 0;
  const v = Math.round(Math.abs(s));
  const h = Math.floor(v / 3600), m = Math.floor((v % 3600) / 60), x = v % 60;
  const body = h ? `${h}:${pad(m)}:${pad(x)}` : `${m}:${pad(x)}`;
  return (neg ? '−' : sign ? '+' : '') + body;
}
function fmtDist(m) {
  if (m == null || !Number.isFinite(m)) return ['—', ''];
  return m < 1000 ? [String(Math.round(m)), 'м'] : [(m / G.NM).toFixed(2), 'nm'];
}
const deg = (a) => (a == null ? '—' : String(Math.round(G.norm360(a))).padStart(3, '0'));
const clock = (t) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };

function set(id, text, cls) {
  const el = $(id);
  if (!el) return;
  if (el.textContent !== text) el.textContent = text;
  if (cls !== undefined && el.dataset.cls !== cls) { el.className = el.className.split(' ').filter((c) => !['good', 'warn', 'bad', 'info', 'blink', 'last', 'final', 'race'].includes(c)).concat(cls ? cls.split(' ') : []).join(' '); el.dataset.cls = cls; }
}

// ---------------------------------------------------------------- render
function render(D) {
  const fix = R.fix;
  set('clock', clock(D.now));

  // gps chip
  if (R.gpsErr && !fix) set('gpsChip', 'GPS ✕', 'bad');
  else if (!fix) set('gpsChip', 'GPS: поиск…', 'warn');
  else set('gpsChip', `GPS ±${Math.round(fix.acc)} м`, fix.acc < 15 ? 'good' : 'warn');

  // wind chip + rose
  const confTxt = ['', '≈', '~', ''][wind.conf] || '';
  set('windChip', D.twd == null ? 'ветер —' : `ветер ${confTxt}${deg(D.twd)}° ${Math.round(D.tws)} kn`, wind.conf >= 3 ? 'good' : wind.conf === 2 ? 'warn' : '');
  if (D.twd != null) {
    $('windArrow').style.transform = `rotate(${D.twd + 90}deg)`;
    set('windRoseTxt', `${deg(D.twd)}° · ${Math.round(D.tws)} kn`);
  }

  const dp = R.depth;
  if (dp.here == null) set('depthChip', 'глуб. —', '');
  else set('depthChip', `глуб. ${dp.here < 1 ? '<1' : Math.round(dp.here)} м${dp.ahead != null ? ` · впереди ${Math.round(dp.ahead)}` : ''}`,
    dp.here < SHALLOW || (dp.ahead != null && dp.ahead < SHALLOW) ? 'bad' : dp.here < 10 || (dp.ahead != null && dp.ahead < 10) ? 'warn' : '');
  const hz = hazardAhead(st.hazards, fix);
  const shallow = fix && dp.ahead != null && dp.ahead < SHALLOW;
  $('shallowWarn').hidden = !hz && !shallow;
  if (hz) {
    set('shallowWarn', hz.inside ? `В ЗОНЕ МЕЛИ! ${hz.h.name} — ${hz.h.note || 'выходи'}` : `МЕЛЬ ПО КУРСУ ${Math.round(hz.dist)} м · ${hz.h.note || hz.h.name}`);
    if (!R.hazWarned || R.hazWarned !== hz.h.id) { horn.beep(500, 0.6); horn.say(hz.inside ? 'Зона мели' : 'Мель по курсу'); R.hazWarned = hz.h.id; }
  } else {
    R.hazWarned = null;
    if (shallow) set('shallowWarn', `МЕЛКО ВПЕРЕДИ · ${dp.ahead < 1 ? 'берег/<1' : Math.round(dp.ahead)} м · осадка ${BOAT.draft} м`);
  }

  renderStart(D);
  renderRace(D);
  renderWind(D);
  renderMap(D);
}

function renderStart(D) {
  const ln = D.line, fix = R.fix;
  // timer
  let txt, cls = '';
  if (!timer.running) txt = fmtSec(timer.preset);
  else if (D.rem > 0) { txt = fmtSec(Math.ceil(D.rem)); cls = D.rem <= 10 ? 'final' : D.rem <= 60 ? 'last' : ''; }
  else { txt = fmtSec(-D.rem, true); cls = 'race'; }
  set('timer', txt, cls);
  const ns = timer.nextSignal();
  set('timerSub', !timer.running ? `Процедура ${timer.preset / 60} мин · нажмите «Старт»` : ns ? `сигнал «${ns.name}» через ${fmtSec(ns.in)}` : 'гонка идёт');

  // status
  const [stTxt, stCls] = startStatus(D);
  set('startStatus', stTxt, stCls);

  const [dv, du] = ln ? fmtDist(Math.abs(ln.d)) : ['—', ''];
  set('vLineDist', ln ? (ln.d > 0 ? '−' : '') + dv : '—');
  set('vLineDistU', ln && ln.d > 0 ? `${du} за линией` : du);
  set('vTTL', fmtSec(ln?.ttlFull));
  set('vTTLsub', ln?.ttlNow != null ? `текущим ${fmtSec(ln.ttlNow)}` : ln?.fullHdg != null ? `курсом ${deg(ln.fullHdg)}°` : '');
  set('vBurn', ln?.burn != null ? (ln.burn >= 0 ? '+' : '−') + Math.round(Math.abs(ln.burn)) : '—', ln?.burn == null ? '' : ln.burn > 3 ? 'good' : ln.burn >= -2 ? 'good' : 'bad');
  set('vSogS', fix ? fix.sog.toFixed(1) : '—');
  if (ln) {
    set('vBias', ln.bias.m < 2 ? 'ровно' : ln.bias.end === 'pin' ? 'Пин' : 'Комитет');
    set('vBiasSub', ln.bias.m < 2 ? '' : `+${Math.round(ln.bias.m)} м · ${Math.round(ln.bias.deg)}°${wind.conf < 3 ? ' · ветер ≈' : ''}`);
    if (ln.crossFrac != null) {
      const f = ln.crossFrac;
      set('vCross', f < 0 ? 'мимо' : f > 1 ? 'мимо' : `${Math.round(f * 100)}%`, f < 0 || f > 1 ? 'bad' : '');
      set('vCrossSub', f < 0 ? 'за пином' : f > 1 ? 'за комитетом' : 'от пина');
    } else { set('vCross', '—', ''); set('vCrossSub', 'не идём к линии'); }
  }
  const src = !st.pin || !st.rc ? 'не задана' : ({ ping: 'пинг', si: 'из гоночной инструкции ≈', tap: 'тапом на карте' }[st.lineSrc] || 'примерная ≈');
  set('startFoot', `Линия: ${src}${ln ? ` · ${Math.round(ln.L)} м · ${deg(ln.brg)}°` : ''} · ветер: ${wind.source}`);
}

function startStatus(D) {
  const ln = D.line;
  if (!timer.running) {
    // Before the sequence the banner says what to do next.
    if (!R.fix) return [R.gpsErr ? `1 · GPS: ${R.gpsErr}` : '1 · Ждём позицию GPS…', 'warn'];
    if (!courseMarks().length) return ['2 · Загрузите дистанцию — вкладка «Маршрут»', 'warn'];
    if (!st.pin || !st.rc || st.lineSrc !== 'ping') return ['3 · Пингуйте пин и комитет (удерживайте кнопки)', 'warn'];
    return [ln && ln.d > 0 ? 'Вы на стороне дистанции · по сигналу «Старт»' : 'Готово · по сигналу нажмите «Старт / синхр.»', 'good'];
  }
  if (!R.fix) return [R.gpsErr ? `GPS: ${R.gpsErr}` : 'Ждём позицию GPS…', 'info'];
  if (!ln) return ['Нет линии — пингуйте пин и комитет', 'info'];
  if (D.rem > 0) {
    if (ln.d > 0) return ['ЗА ЛИНИЕЙ — ВЕРНИТЕСЬ', 'bad blink'];
    const b = ln.burn;
    if (b == null) return ['Не идём к линии', 'info'];
    if (b > 15) return [`РАНО · жги ${fmtSec(b)}`, 'warn'];
    if (b > 3) return [`ЗАПАС ${Math.round(b)} с`, 'good'];
    if (b >= -2) return ['В ТАЙМИНГ — ПОЛНЫЙ ХОД', 'good'];
    return [`ОПАЗДЫВАЕМ ${Math.round(-b)} с`, 'bad'];
  }
  if (R.ocs) return ['ФАЛЬСТАРТ — ВЕРНИТЕСЬ ЗА ЛИНИЮ', 'bad blink'];
  if (R.started) return [`СТАРТОВАЛИ +${fmtSec((R.startedAt - timer.gun) / 1000)}`, 'good'];
  return [`Старт был ${fmtSec(-D.rem)} назад — пересеките линию`, 'warn'];
}

function renderRace(D) {
  const M = D.mark, fix = R.fix;
  const marks = courseMarks();
  const legName = { beat: 'лавировка', run: 'фордевинд', reach: 'галфвинд / бакштаг' };
  const groups = courseGroups();
  const gi = groups.findIndex((g) => st.legIdx <= g.end);
  const nextReal = gi >= 0 ? groups[gi] : null;
  const legNo = `знак ${gi >= 0 ? gi + 1 : groups.length + 1} из ${groups.length + 1}`;
  if (M) {
    set('vMarkName', (nextReal && !M.via ? nextReal.name : M.name) + (M.approx ? ' ≈' : ''));
    set('vLegType', `${legName[M.leg]} · ${legNo}`);
  } else if (!marks.length) {
    set('vMarkName', 'Дистанция не загружена');
    set('vLegType', 'выберите её во вкладке «Маршрут»');
  } else {
    // Course is loaded but there is no position yet: show what is next, numbers come with GPS.
    set('vMarkName', nextReal ? nextReal.name : 'ФИНИШ');
    set('vLegType', `${legNo} · ${R.gpsErr ? 'GPS: ' + R.gpsErr : 'ждём позицию GPS'}`);
  }
  set('vBrg', M ? deg(M.brg) : '—');
  const [dv, du] = fmtDist(M?.dst);
  set('vDst', dv); set('vDstU', du);
  set('vEta', M?.etaSec != null ? clock(D.now + M.etaSec * 1000).slice(0, 5) : '—');
  set('vEtaSub', M?.etaSec != null ? `через ${fmtSec(M.etaSec)}` : '');
  set('vSog', fix ? fix.sog.toFixed(1) : '—');
  const windOk = wind.conf >= 2;
  const perf = windOk && D.perf != null && D.perf <= 150 ? D.perf : null;
  set('vTarget', windOk && D.target != null ? `/ ${D.target.toFixed(1)}` : '');
  set('vPerf', perf != null ? String(Math.round(perf)) : '—', perf == null ? '' : perf >= 95 ? 'good' : perf >= 85 ? '' : 'bad');
  set('vTwa', D.twa != null ? String(Math.round(Math.abs(D.twa))) : '—');
  set('vTwaSub', D.twa != null ? `° ${D.twa >= 0 ? 'правый' : 'левый'}${windOk ? '' : ' ≈'}` : '');

  let lay = ['—', 'info'];
  if (M?.lay) {
    if (M.lay.kind === 'fetch') lay = ['ЛЕЖИМ НА ЗНАК', 'good'];
    else if (M.lay.kind === 'over') lay = ['ПЕРЕБРАЛИ ЛЕЙЛАЙН — поворот', 'bad'];
    else { const [v, u] = fmtDist(M.lay.dist); lay = [`До лейлайна ${v} ${u} · ${fmtSec(M.lay.sec)} · затем ${deg(M.lay.nextHdg)}°`, 'warn']; }
  } else if (M) lay = [`Прямо на знак · VMC ${M.vmc.toFixed(1)} kn`, 'info'];
  set('laylineStatus', lay[0], lay[1]);

  if (D.shift != null) {
    set('vShift', `${Math.round(Math.abs(D.shift)) === 0 ? '' : D.shift > 0 ? '+' : '−'}${Math.round(Math.abs(D.shift))}°`, Math.abs(D.shift) < 3 ? '' : D.shift > 0 ? 'good' : 'bad');
    set('vShiftSub', Math.abs(D.shift) < 3 ? 'ровно' : D.shift > 0 ? 'заходит' : 'отходит');
  } else { set('vShift', '—', ''); set('vShiftSub', `после поворота ${deg(D.tackHdg)}°`); }

  const el = R.finishedAt ? (R.finishedAt - timer.gun) / 1000 : timer.running && D.rem < 0 ? -D.rem : null;
  set('vElapsed', fmtSec(el));
  set('vFinish', R.finishedAt ? `финиш ${clock(R.finishedAt)}` : '');
  set('vCorrected', el != null ? fmtSec(el * BOAT.tcc) : '—');
}

function renderWind(D) {
  set('vTwd', D.twd == null ? '—' : deg(D.twd));
  set('vTwdSub', `° ${['', '≈ из прогноза/азимута', '~ один галс', ''][wind.conf] || ''}`);
  set('vTws', Math.round(D.tws).toString());
  const old = R.windHist.find((h) => D.now - h.t <= 10 * 60000);
  if (old && D.twd != null && D.now - R.windHist[0].t > 120000) {
    const tr = G.norm180(D.twd - old.twd);
    set('vTrend', `${tr >= 0 ? '+' : '−'}${Math.round(Math.abs(tr))}°`);
    set('vTrendSub', Math.abs(tr) < 2 ? 'стабильно' : tr > 0 ? 'вправо' : 'влево');
  } else { set('vTrend', '—'); set('vTrendSub', 'копим данные'); }
  const e = wind.est;
  set('windSrc', `Источник: ${wind.source}. ${wind.manual.twd != null ? '' : 'Ветер — биссектриса устойчивых курсов правого и левого галса за последние минуты.'}`);
  set('vBeatA', `${Math.round(D.beat.angle)}°`); set('vBeatS', `${D.beat.speed.toFixed(1)} kn`);
  set('vRunA', `${Math.round(D.run.angle)}°`); set('vRunS', `${D.run.speed.toFixed(1)} kn`);
  set('vTackAngle', e.tackAngle ? String(Math.round(e.tackAngle)) : '—');
  const f = R.forecast;
  set('vForecast', f ? `${deg(f.twd)}°` : '—');
  set('vForecastSub', f ? `${Math.round(f.tws)}–${Math.round(f.gust)} kn` : 'нет сети');
  $('btnAuto').classList.toggle('on', wind.manual.twd == null);
  $('btnManual').classList.toggle('on', wind.manual.twd != null);
  if (activeTab === 'wind') drawHist(D);
}

let histT = 0;
function drawHist(D) {
  if (D.now - histT < 1000) return;
  histT = D.now;
  const bins = wind.histogram(D.now);
  const max = Math.max(1, ...bins);
  const r = wind.est.refs || {};
  let s = '';
  bins.forEach((v, i) => {
    if (!v) return;
    const h = (v / max) * 92, x = i * 5;
    const hdg = i * 5 + 2.5;
    const twa = D.twd != null ? G.norm180(D.twd - hdg) : 0;
    const col = twa >= 0 ? 'var(--stbd)' : 'var(--port)';
    s += `<rect x="${x}" y="${100 - h}" width="4.5" height="${h}" fill="${col}" opacity="0.85"/>`;
  });
  for (let a = 0; a < 360; a += 90) s += `<text x="${a + 2}" y="116" fill="var(--muted)" font-size="9">${a}°</text>`;
  if (D.twd != null) {
    const x = G.norm360(D.twd);
    s += `<line x1="${x}" y1="0" x2="${x}" y2="100" stroke="var(--info)" stroke-width="1.5" stroke-dasharray="3 3"/>`;
    s += `<text x="${Math.min(x + 3, 300)}" y="10" fill="var(--info)" font-size="10">ветер ${deg(x)}°</text>`;
  }
  for (const [k, lbl] of [['uS', 'пр'], ['uP', 'лев'], ['dS', 'пр↓'], ['dP', 'лев↓']]) {
    if (r[k]) s += `<text x="${Math.min(G.norm360(r[k].h), 330)}" y="22" fill="var(--fg)" font-size="9">${lbl} ${deg(r[k].h)}</text>`;
  }
  $('hist').innerHTML = s;
}

function renderMap(D) {
  const fix = R.fix;
  let ext = null;
  if (D.line) {
    ext = [G.destination(st.pin, D.line.brg + 180, 0.5 * G.NM), G.destination(st.rc, D.line.brg, 0.5 * G.NM)];
  }
  map.setLine(st.pin, st.rc, ext);
  map.setMarks(st.marks, nextMarkId(), st.course);
  map.setHazards(st.hazards);
  map.setBoat(fix, false);
  autoFrame(D);
  if (fix) {
    map.setVector([fix, G.destination(fix, fix.cog, fix.sog * G.KN * 60)]);
    map.setToMark(D.mark ? [fix, D.mark.ll] : null);
  }
  map.setRoute(routePts(), (st.islands || []).map((x) => ({ hull: ISLANDS[x.key]?.hull, side: x.side })).filter((x) => x.hull));
  const showStart = timer.running && D.rem > 0;
  map.setCross(showStart && D.line?.crossLL ? D.line.crossLL : null);
  map.setLaylines(showStart ? [] : D.laylines || []);
}

// Course as the crew sees it: one entry per rounding (an island's waypoints and routing vias collapse).
function courseGroups() {
  const marks = courseMarks();
  const base = (m) => m.name.replace(/ \d+\/\d+$/, '');
  const out = [];
  for (let i = 0; i < marks.length; i++) {
    if (marks[i].via) continue;
    const g = { name: base(marks[i]), start: i, end: i };
    for (let k = i + 1; k < marks.length; k++) {
      if (marks[k].via) continue;
      if (marks[i].wp && marks[k].wp && base(marks[k]) === g.name && / \d+\/\d+$/.test(marks[k].name) && !/ 1\/\d+$/.test(marks[k].name)) g.end = k;
      else break;
    }
    // Vias leading to this rounding belong to it.
    while (g.start > 0 && marks[g.start - 1].via) g.start--;
    out.push(g);
    i = g.end;
  }
  return out;
}

function routePts() {
  const mid = lineMid();
  if (!mid) return [];
  return [mid, ...courseMarks(), mid];
}

// Follow mode frames what matters: before the start the boat and the line, racing the boat and the next mark.
let frameT = 0;
function autoFrame(D) {
  const fix = R.fix;
  if (!st.set.follow || !fix || D.now - frameT < 3000) return;
  frameT = D.now;
  const pts = [fix];
  const preStart = timer.running && D.rem > 0;
  if ((preStart || !R.started) && st.pin && st.rc && D.line && Math.abs(D.line.d) < 3000) pts.push(st.pin, st.rc);
  else if (D.mark && D.mark.dst < 8 * G.NM) pts.push(D.mark.ll);
  if (pts.length > 1) map.fit(pts); else map.center(fix);
}

// ---------------------------------------------------------------- course UI
function renderCourse() {
  const marks = courseMarks();
  let html = '<span class="chipc fixed">Старт</span>';
  // Island waypoints ("Гёчек лев. 1/3 … 3/3") collapse into one chip per rounding.
  const base = (m) => m.name.replace(/ \d+\/\d+$/, '');
  for (let i = 0; i < marks.length; i++) {
    if (marks[i].via) continue;
    let j = i;
    // Extend over the same rounding (k/n waypoints), stepping over routing vias in between.
    for (let k = i + 1; k < marks.length; k++) {
      if (marks[k].via) continue;
      if (marks[i].wp && marks[k].wp && base(marks[k]) === base(marks[i]) && /\d+\/\d+$/.test(marks[k].name) && !/ 1\/\d+$/.test(marks[k].name)) j = k;
      else break;
    }
    let k0 = i; while (k0 > 0 && marks[k0 - 1].via) k0--;
    const cur = st.legIdx >= k0 && st.legIdx <= j;
    html += `<span class="chipc ${cur ? 'cur' : ''}" data-act="chipGo" data-i="${i}">${base(marks[i])}<button data-act="chipDel" data-i="${i}" data-n="${j - i + 1}">✕</button></span>`;
    i = j;
  }
  html += `<span class="chipc fixed ${st.legIdx >= marks.length ? 'cur' : ''}" data-act="chipGo" data-i="${marks.length}">Финиш</span>`;
  $('courseChips').innerHTML = html;

  const mid = lineMid();
  $('marksCount').textContent = `(${st.marks.filter((m) => !m.via).length})`;
  $('markList').innerHTML = st.marks.filter((m) => !m.via).map((m) => {
    const meta = mid ? `${deg(G.bearing(mid, m))}° ${(G.distance(mid, m) / G.NM).toFixed(2)} nm${m.approx ? ' ≈' : ''}` : '';
    return `<div class="mrow"><input data-name="${m.id}" value="${m.name}"><span class="meta">${meta}</span>
      <button data-act="markTap" data-id="${m.id}">тап</button>
      <button data-act="markGps" data-id="${m.id}">GPS</button>
      <button data-act="markAdd" data-id="${m.id}">+ в маршрут</button>
      <button data-act="markDel" data-id="${m.id}" class="dim">✕</button></div>`;
  }).join('') || '<div class="foot">Знаков нет</div>';
  $('inBrg').placeholder = st.announcedBrg ?? '290';
}

// Windward mark is anchored where the depth suits the committee's anchor (15–60 m):
// slide the windward leg length within ±35 % to the nearest such depth.
async function placeByDepth(def, mid, brg) {
  const base = def.legNm;
  const cands = [];
  for (let f = 0.65; f <= 1.351; f += 0.05) cands.push(base * f);
  const depths = await Promise.all(cands.map((nm) => depthAt(G.destination(mid, brg, nm * G.NM))));
  let best = null;
  cands.forEach((nm, i) => {
    const d = depths[i];
    if (d == null || d < 15 || d > 60) return;
    if (!best || Math.abs(nm - base) < Math.abs(best.nm - base)) best = { nm, d };
  });
  if (!best) { toast('Глубина 15–60 м на этом азимуте не найдена — знак по умолчанию'); return; }
  const c = buildCourse(def, { mid, brg, legNm: best.nm });
  Object.assign(st, { marks: c.marks, course: c.course });
  save(); renderCourse();
  toast(`Знак 1: ${best.nm.toFixed(2)} nm, глубина ~${Math.round(best.d)} м`);
}

function newMarkId() { let i = 1; while (st.marks.some((m) => m.id === `M${i}`)) i++; return `M${i}`; }
function addMark(p, approx = false, name) {
  const id = newMarkId();
  const m = { id, name: name || `Знак ${id.slice(1)}`, lat: p.lat, lon: p.lon, approx };
  st.marks.push(m);
  st.course.push(id);
  save();
  renderCourse();
  return m;
}

function renderBoat() {
  const b = BOAT;
  $('boatInfo').innerHTML = `<div class="lbl">${b.name} · ${b.sail} · ${b.design}</div><div class="kv">
    <span>LOA / LWL</span><span>${b.loa} / ${b.lwl} м</span><span>B / T</span><span>${b.beam} / ${b.draft} м</span>
    <span>Δ</span><span>${b.displacement} кг</span><span>IRC TCC</span><span>${b.tcc} (без спин. ${b.tccNonSpin})</span>
    <span>Экипаж</span><span>${b.crew}</span><span>IRC</span><span>№ ${b.ircCert}</span></div>`;
  $('polarSrc').textContent = P.SOURCE;
  $('polarTable').innerHTML = '<tr><th>TWS</th><th>Бейд. угол</th><th>скор.</th><th>VMG</th><th>Форд. угол</th><th>скор.</th><th>VMG</th></tr>' +
    P.table().map((r) => `<tr><td>${r.tws}</td><td>${r.beatAngle.toFixed(1)}°</td><td>${r.beatSpeed.toFixed(2)}</td><td>${r.beatVmg.toFixed(2)}</td><td>${r.gybeAngle.toFixed(1)}°</td><td>${r.runSpeed.toFixed(2)}</td><td>${r.runVmg.toFixed(2)}</td></tr>`).join('');
  $('setPreset').value = String(st.set.preset);
  $('setSound').checked = st.set.sound;
  $('setVoice').checked = st.set.voice;
  $('setBow').value = st.set.bowOffset;
  $('setAccel').value = st.set.accelSec;
  $('setRound').value = st.set.roundRadius;
}

function renderFollow() { $('btnFollow').classList.toggle('on', st.set.follow); }

// ---------------------------------------------------------------- interaction
let activeTab = 'start';
function switchTab(t) {
  activeTab = t;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
  document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('on', p.dataset.pane === t));
  if (t === 'course') renderCourse();
}

function setPlace(place, text) {
  R.place = place;
  $('placeHint').hidden = !place;
  $('placeTxt').textContent = text || '';
}

function handlePlace(p) {
  if (!R.place) { showDepth(p); return; }
  const pl = R.place;
  if (pl.what === 'pin') { st.pin = p; st.lineSrc = 'tap'; }
  else if (pl.what === 'rc') { st.rc = p; st.lineSrc = 'tap'; }
  else if (pl.what === 'mark') { const m = st.marks.find((x) => x.id === pl.id); if (m) Object.assign(m, p, { approx: false }); }
  else if (pl.what === 'newmark') addMark(p);
  setPlace(null);
  save();
  renderCourse();
}

function showDepth(p) {
  map.popup(p, 'глубина…');
  depthAt(p).then((v) => map.popup(p, v == null ? 'нет данных о глубине' : v < 1 ? 'берег / &lt;1 м' : `<b>${Math.round(v)} м</b> <small>модель глубин, не для навигации</small>`));
}

let toastT = null;
function toast(msg, ms = 2200) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => (el.hidden = true), ms);
}

function needFix() { if (!R.fix) { toast('Нет позиции GPS'); return false; } return true; }

function setManual(dTwd, dTws) {
  if (wind.manual.twd == null) wind.manual.twd = Math.round(wind.twd ?? st.announcedBrg ?? 0);
  if (wind.manual.tws == null) wind.manual.tws = Math.round(wind.tws);
  wind.manual.twd = G.norm360(wind.manual.twd + dTwd);
  wind.manual.tws = Math.max(1, wind.manual.tws + dTws);
  st.manualWind = { ...wind.manual };
  save();
}

function readBrgInput() {
  let b = parseFloat($('inBrg').value);
  if (!Number.isFinite(b)) { toast('Введите азимут'); return null; }
  // Committees usually announce magnetic bearings; the app works in true.
  if ($('inBrgRef').value === 'M') b += DECLINATION;
  const d = parseFloat($('inDist').value);
  return { brg: G.norm360(b), dist: Number.isFinite(d) && d > 0 ? d : null };
}

function resetRace() {
  R.ocs = false; R.started = false; R.startedAt = null; R.finishedAt = null; R.round = null;
  st.legIdx = 0;
  save();
}

const actions = {
  startSync: () => {
    const counting = timer.running && timer.remaining() > 0;
    // Sync is pressed on a committee signal: a tap far from a whole minute is a slip of the hand.
    if (counting) {
      const r = timer.remaining(), off = Math.abs(r - Math.round(r / 60) * 60);
      if (off > 10) { toast('Синхр. — только в момент сигнала (±10 с от минуты)'); return; }
    }
    // After the gun a stray tap must not wipe the race: a new sequence needs confirmation (general recall).
    if (timer.running && !counting && !confirm('Гонка идёт. Начать новую процедуру старта (общий отзыв)?')) return;
    timer.startOrSync();
    if (!counting) { resetRace(); switchTab('start'); }
    saveRace();
  },
  tminus: () => { timer.shift(-60); saveRace(); },
  tplus: () => { timer.shift(60); saveRace(); },
  treset: () => { if (confirm('Сбросить таймер?')) { timer.reset(); timer.preset = st.set.preset; resetRace(); saveRace(); } },
  pingPin: () => { if (!needFix()) return; st.pin = { lat: R.fix.lat, lon: R.fix.lon }; R.pinged = { ...R.pinged, pin: true }; if (R.pinged.rc) st.lineSrc = 'ping'; save(); horn.beep(1400, 0.1); toast('Пин записан'); },
  pingRc: () => { if (!needFix()) return; st.rc = { lat: R.fix.lat, lon: R.fix.lon }; R.pinged = { ...R.pinged, rc: true }; if (R.pinged.pin) st.lineSrc = 'ping'; save(); horn.beep(1400, 0.1); toast('Комитет записан'); },
  placePin: () => setPlace({ what: 'pin' }, 'Тапните по карте: ПИН'),
  placeRc: () => setPlace({ what: 'rc' }, 'Тапните по карте: КОМИТЕТ'),
  cancelPlace: () => setPlace(null),
  legPrev: () => { st.legIdx = Math.max(0, st.legIdx - 1); R.round = null; save(); renderCourse(); },
  legNext: () => { st.legIdx = Math.min(courseMarks().length, st.legIdx + 1); R.round = null; save(); renderCourse(); },
  chipGo: (el) => { st.legIdx = +el.dataset.i; R.round = null; save(); renderCourse(); },
  chipDel: (el, ev) => {
    ev.stopPropagation();
    const i = +el.dataset.i, n = +(el.dataset.n || 1);
    st.course.splice(i, n);
    if (st.legIdx >= i + n) st.legIdx -= n; else if (st.legIdx > i) st.legIdx = i;
    st.legIdx = Math.min(st.legIdx, st.course.length);
    save(); renderCourse();
  },
  buildWL: () => {
    const v = readBrgInput(); if (!v) return;
    const mid = lineMid() || R.fix || AREA;
    const c = wlCourse(mid, v.brg, v.dist ?? 1.0, +$('inLaps').value);
    if (!v.dist) c.marks[0].approx = true;
    st.marks = c.marks; st.course = c.course; st.legIdx = 0;
    st.announcedBrg = v.brg;
    applyPriors();
    save(); renderCourse();
    toast(`W1 на ${deg(v.brg)}°${v.dist ? ` ${v.dist} nm` : ' (≈1 nm)'}`);
  },
  addByBrg: () => {
    const v = readBrgInput(); if (!v) return;
    const mid = lineMid() || R.fix || AREA;
    addMark(G.destination(mid, v.brg, (v.dist ?? 1.0) * G.NM), !v.dist);
  },
  loadLib: async () => {
    const def = COURSES.find((c) => c.id === $('libCourse').value);
    if (!def) return;
    if (def.kind === 'coastal') {
      const c = buildCourse(def, { nav: await getNav(def.venue) });
      Object.assign(st, { marks: c.marks, course: c.course, legIdx: 0, islands: c.islands, pin: { ...c.start.pin }, rc: { ...c.start.rc }, announcedBrg: null, lineSrc: 'si' });
      R.pinged = {};
      applyPriors();
      toast(`Загружено: ${def.name}, ${def.nm} nm. Линия старта примерная — на воде пингуйте пин и комитет`, 5000);
      map.center(G.midpoint(st.pin, st.rc), 13);
    } else {
      const v = readBrgInput(); if (!v) return;
      const mid = lineMid() || R.fix || AREA;
      const c = buildCourse(def, { mid, brg: v.brg, legNm: v.dist, exact: !!v.dist });
      Object.assign(st, { marks: c.marks, course: c.course, legIdx: 0, islands: [], announcedBrg: v.brg });
      applyPriors();
      if (!v.dist) placeByDepth(def, mid, v.brg);
    }
    save(); renderCourse();
  },
  addMarkTap: () => setPlace({ what: 'newmark' }, 'Тапните по карте: новый знак'),
  addMarkGps: () => { if (needFix()) addMark({ lat: R.fix.lat, lon: R.fix.lon }); },
  clearCourse: () => { st.course = []; st.legIdx = 0; save(); renderCourse(); },
  markTap: (el) => setPlace({ what: 'mark', id: el.dataset.id }, 'Тапните по карте: новое место знака'),
  markGps: (el) => { if (!needFix()) return; const m = st.marks.find((x) => x.id === el.dataset.id); Object.assign(m, { lat: R.fix.lat, lon: R.fix.lon, approx: false }); save(); renderCourse(); },
  markAdd: (el) => { st.course.push(el.dataset.id); save(); renderCourse(); },
  markDel: (el) => {
    const id = el.dataset.id;
    st.legIdx -= st.course.slice(0, st.legIdx).filter((x) => x === id).length;
    st.marks = st.marks.filter((m) => m.id !== id);
    st.course = st.course.filter((x) => x !== id);
    st.legIdx = Math.max(0, Math.min(st.legIdx, st.course.length));
    save(); renderCourse();
  },
  'twd-10': () => setManual(-10, 0), 'twd-2': () => setManual(-2, 0), 'twd+2': () => setManual(2, 0), 'twd+10': () => setManual(10, 0),
  'tws-1': () => setManual(0, -1), 'tws+1': () => setManual(0, 1),
  manualWind: () => { $('manualBox').hidden = false; setManual(0, 0); },
  autoWind: () => { wind.manual = { twd: null, tws: null }; st.manualWind = { twd: null, tws: null }; $('manualBox').hidden = true; save(); },
  compassWind: () => {
    if (R.compass == null) { toast('Компас планшета недоступен'); return; }
    wind.manual.twd = Math.round(G.norm360(R.compass + DECLINATION));
    if (wind.manual.tws == null) wind.manual.tws = Math.round(wind.tws);
    st.manualWind = { ...wind.manual };
    $('manualBox').hidden = false;
    save();
    toast(`Ветер ${deg(wind.manual.twd)}° по компасу`);
  },
  pickVenue: (el) => {
    st.venue = el.dataset.venue;
    $('venue').value = st.venue;
    save(); renderLib(); libInfo();
    const v = VENUES[st.venue];
    st.set.follow = false; renderFollow();
    map.center(v.center, v.zoom);
    $('home').hidden = true;
    map.invalidate();
  },
  home: () => { $('home').hidden = false; },
  follow: () => { st.set.follow = !st.set.follow; save(); renderFollow(); if (st.set.follow && R.fix) map.center(R.fix); },
  fullscreen: () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); },
  gpx: exportGpx,
  resetAll: () => { if (confirm('Сбросить линию, знаки и настройки?')) { localStorage.removeItem(KEY); location.reload(); } },
};

// Hold-to-confirm buttons (pinging the line ends): a plain tap does nothing.
let holdT = null, holdDone = false;
document.addEventListener('pointerdown', (ev) => {
  const b = ev.target.closest('[data-hold]');
  if (!b) return;
  holdDone = false;
  b.classList.add('holding');
  holdT = setTimeout(() => { holdDone = true; b.classList.remove('holding'); actions[b.dataset.hold](b); }, 700);
});
for (const t of ['pointerup', 'pointercancel']) {
  document.addEventListener(t, () => { clearTimeout(holdT); document.querySelectorAll('.holding').forEach((x) => x.classList.remove('holding')); }, true);
}

document.addEventListener('click', (ev) => {
  const tab = ev.target.closest('[data-tab]');
  if (tab) { switchTab(tab.dataset.tab); return; }
  const hb = ev.target.closest('[data-hold]');
  if (hb) { if (!holdDone) toast('Удерживайте кнопку, чтобы записать'); holdDone = false; return; }
  const b = ev.target.closest('[data-act]');
  if (b && actions[b.dataset.act]) actions[b.dataset.act](b, ev);
});

document.addEventListener('change', (ev) => {
  const t = ev.target;
  if (t.dataset.name) { const m = st.marks.find((x) => x.id === t.dataset.name); if (m) m.name = t.value.trim() || m.name; save(); renderCourse(); return; }
  switch (t.id) {
    case 'setPreset': st.set.preset = +t.value; if (!timer.running) timer.preset = st.set.preset; break;
    case 'setSound': st.set.sound = horn.sound = t.checked; break;
    case 'setVoice': st.set.voice = horn.voice = t.checked; break;
    case 'setBow': st.set.bowOffset = +t.value || 0; break;
    case 'setAccel': st.set.accelSec = +t.value || 0; break;
    case 'setRound': st.set.roundRadius = +t.value || 40; break;
    default: return;
  }
  save();
});

// Audio, wake lock and compass need a user gesture on Android.
let wakeLock = null;
async function keepAwake() {
  try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => (wakeLock = null)); } } catch { /* denied */ }
}
document.addEventListener('pointerdown', () => { horn.unlock(); keepAwake(); }, { passive: true });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });

window.addEventListener('deviceorientationabsolute', (e) => {
  if (e.alpha == null) return;
  const screenAngle = screen.orientation?.angle || 0;
  R.compass = G.norm360(360 - e.alpha + screenAngle);
});

window.addEventListener('resize', () => map.invalidate());

// ---------------------------------------------------------------- forecast (Open-Meteo)
async function fetchForecast() {
  const p = lineMid() || AREA;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${p.lat.toFixed(3)}&longitude=${p.lon.toFixed(3)}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kn&timezone=auto`;
  try {
    const r = await fetch(url);
    const j = await r.json();
    const c = j.current;
    R.forecast = { twd: c.wind_direction_10m, tws: c.wind_speed_10m, gust: c.wind_gusts_10m, time: c.time };
    applyPriors();
  } catch { /* offline */ }
}

// ---------------------------------------------------------------- GPX
function exportGpx() {
  if (!R.track.length) { toast('Трек пуст'); return; }
  const pts = R.track.map((p) => `<trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}"><time>${new Date(p.t).toISOString()}</time></trkpt>`).join('\n');
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="NordStar Race"><trk><name>${BOAT.name} ${new Date().toISOString().slice(0, 10)}</name><trkseg>\n${pts}\n</trkseg></trk></gpx>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([gpx], { type: 'application/gpx+xml' }));
  a.download = `nordstar-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.gpx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------------------------------------------------------------- go
$('venue').innerHTML = Object.entries(VENUES).map(([id, v]) => `<option value="${id}">${v.name}</option>`).join('');
$('venue').value = st.venue;
function renderLib() {
  const mine = COURSES.filter((c) => !c.venue || c.venue === st.venue);
  const coastal = mine.filter((c) => c.kind === 'coastal');
  $('libCourse').innerHTML =
    (coastal.length ? `<optgroup label="Маршрутные (вокруг островов и знаков)">${coastal.map((c) => `<option value="${c.id}">${c.name} · ${c.nm} nm</option>`).join('')}</optgroup>` : '') +
    `<optgroup label="Наветренно-подветренные (по азимуту)">${mine.filter((c) => c.kind === 'wl').map((c) => `<option value="${c.id}">${c.name} · ~${c.nm} nm</option>`).join('')}</optgroup>`;
}
renderLib();
$('venue').addEventListener('change', () => {
  st.venue = $('venue').value;
  save(); renderLib(); libInfo();
  const v = VENUES[st.venue];
  map.center(v.center, v.zoom);
});
const libInfo = () => { const c = COURSES.find((x) => x.id === $('libCourse').value); $('libInfo').textContent = c ? `${c.src}${c.kind === 'wl' ? ' · нужен азимут ниже' : ` · старт ≈ ${(STARTS[c.start]?.name || '').split(' (')[0]}`}` : ''; };
$('libCourse').addEventListener('change', libInfo);
libInfo();
renderBoat();
renderCourse();
renderFollow();
$('manualBox').hidden = wind.manual.twd == null;
if (!window.isSecureContext) toast('Нет HTTPS: GPS, компас и запрет сна экрана не работают');
startGps();
fetchForecast();
setInterval(fetchForecast, 30 * 60000);
setInterval(() => {
  timer.tick();
  const D = compute();
  detectEvents(D);
  render(D);
  R.lastD = D;
}, 250);

// Offline: cache the whole app in the browser (needs https or localhost).
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('sw.js').then(async () => {
    await navigator.serviceWorker.ready;
    const keys = await caches.keys();
    $('offlineState').textContent = keys.some((k) => k.startsWith('nordstar-')) ? 'Офлайн: приложение сохранено в браузере ✓' : 'Офлайн: сохраняется…';
  }).catch(() => { $('offlineState').textContent = 'Офлайн: не удалось сохранить'; });
} else {
  $('offlineState').textContent = 'Офлайн недоступен: откройте по https';
}

window.__race = { st, R, wind, timer, map, feed: onFix }; // debugging: __race.feed(fix) injects a position
