// True wind estimation from GPS course only (no instruments).
//
// 1. Cut the COG stream into steady segments (≥ 20 s, COG spread < 5°, SOG > 2 kn).
// 2. Classify segments against the current wind guess: upwind/downwind × stbd/port.
// 3. TWD = bisector of recency-weighted stbd and port headings (upwind and/or downwind).
//    With only one tack seen: heading ± polar beat/gybe angle (lower confidence).
// 4. TWS = from tacking angle (beat angle narrows with wind) and from boat speed vs polar.
// Priors (announced bearing to windward mark, Open-Meteo forecast) seed the first guess.

import * as G from './geo.js?v=8';
import * as P from './polar.js?v=8';

const WIN = 20;          // s, steadiness window
const SPREAD = 5;        // °, max circular std dev inside a steady window
const MIN_SOG = 2;       // kn
const HALF_LIFE = 300;   // s, recency weighting of segments
const KEEP = 1800;       // s, history kept
const LEEWAY = 3;        // °, COG is wider than heading upwind

function circStd(angles) {
  let s = 0, c = 0;
  for (const a of angles) { s += Math.sin(G.toRad(a)); c += Math.cos(G.toRad(a)); }
  const r = Math.hypot(s, c) / angles.length;
  return G.toDeg(Math.sqrt(Math.max(0, -2 * Math.log(Math.max(r, 1e-9)))));
}

function wMean(items) {
  // items: [{h, w}] → weighted circular mean, total weight
  let s = 0, c = 0, w = 0;
  for (const it of items) { s += it.w * Math.sin(G.toRad(it.h)); c += it.w * Math.cos(G.toRad(it.h)); w += it.w; }
  return w > 0 ? { h: G.norm360(G.toDeg(Math.atan2(s, c))), w } : null;
}

export class WindEstimator {
  constructor() {
    this.samples = [];   // 1 Hz {t, cog, sog}
    this.segments = [];  // {t0, t1, hdg, sog, n}
    this.open = null;
    this.prior = { twd: null, tws: null, src: null };
    this.manual = { twd: null, tws: null };
    this.est = { twd: null, tws: null, src: 'нет данных', conf: 0, tackAngle: null, refs: {} };
    this.maneuvers = []; // {t, from, to, kind}
  }

  setPrior(p) { Object.assign(this.prior, p); }

  add(fix) {
    const t = fix.t / 1000;
    const last = this.samples[this.samples.length - 1];
    if (last && t - last.t < 0.9) return;
    this.samples.push({ t, cog: fix.cog, sog: fix.sog });
    while (this.samples.length && t - this.samples[0].t > WIN + 5) this.samples.shift();

    const win = this.samples.filter((s) => t - s.t <= WIN);
    const steady = win.length >= WIN * 0.7 &&
      win.every((s) => s.sog > MIN_SOG) &&
      circStd(win.map((s) => s.cog)) < SPREAD;

    if (steady) {
      const hdg = G.circMean(win.map((s) => s.cog));
      const sog = win.reduce((a, s) => a + s.sog, 0) / win.length;
      if (this.open && Math.abs(G.norm180(hdg - this.open.hdg)) < 8) {
        const n = this.open.n + 1;
        this.open.hdg = G.norm360(this.open.hdg + G.norm180(hdg - this.open.hdg) / n);
        this.open.sog += (sog - this.open.sog) / n;
        this.open.n = n;
        this.open.t1 = t;
      } else {
        this.close();
        this.open = { t0: t - WIN, t1: t, hdg, sog, n: 1 };
      }
    } else {
      this.close();
    }
    this.segments = this.segments.filter((s) => t - s.t1 < KEEP);
    this.estimate(t);
  }

  close() {
    if (!this.open) return;
    const prev = this.segments[this.segments.length - 1];
    if (prev && this.open.t0 - prev.t1 < 90) {
      const turn = Math.abs(G.norm180(this.open.hdg - prev.hdg));
      if (turn > 60) this.maneuvers.push({ t: this.open.t0, from: prev.hdg, to: this.open.hdg, turn, sog: (prev.sog + this.open.sog) / 2 });
      if (this.maneuvers.length > 50) this.maneuvers.shift();
    }
    this.segments.push(this.open);
    this.open = null;
  }

  allSegments() { return this.open ? [...this.segments, this.open] : this.segments; }

  estimate(now) {
    const segs = this.allSegments();
    let ref = this.est.twd ?? this.prior.twd;
    let tws = this.est.tws ?? this.prior.tws ?? 10;

    // No reference at all: take the last ~90° course change as a tack.
    if (ref == null && this.maneuvers.length) {
      const m = this.maneuvers[this.maneuvers.length - 1];
      if (m.turn > 70 && m.turn < 115) ref = G.circMean([m.from, m.to]);
    }
    // Recent tacks/gybes vote for the wind axis; they override a prior that disagrees by > 40°.
    const votes = [];
    for (const m of this.maneuvers) {
      if (now - m.t > 900 || m.turn < 70 || m.turn > 115) continue;
      const bis = G.circMean([m.from, m.to]);
      // Tack or gybe: compare the turn and the speed with what the polar expects for each.
      const b = P.beat(tws), r = P.run(tws);
      const tackTurn = 2 * (b.angle + LEEWAY), gybeTurn = 2 * (180 - r.angle);
      const score = Math.abs(m.turn - tackTurn) / 10 + Math.abs(m.sog - b.speed)
        - Math.abs(m.turn - gybeTurn) / 10 - Math.abs(m.sog - r.speed);
      const isTack = score <= 0;
      votes.push(isTack ? bis : G.norm360(bis + 180));
    }
    if (votes.length >= 2) {
      const v = G.circMean(votes);
      if (ref == null || Math.abs(G.norm180(v - ref)) > 40) ref = v;
    }
    if (ref == null) { this.publish(null, null, 'нет данных', 0); return; }

    let result = null;
    for (let iter = 0; iter < 3; iter++) {
      const bins = { uS: [], uP: [], dS: [], dP: [] };
      for (const s of segs) {
        const twa = G.norm180(ref - s.hdg);
        const age = now - s.t1;
        const w = (s.t1 - s.t0) * Math.pow(0.5, age / HALF_LIFE);
        const a = Math.abs(twa);
        const key = a < 58 ? 'u' : a > 125 ? 'd' : null;
        if (!key) continue;
        bins[key + (twa > 0 ? 'S' : 'P')].push({ h: s.hdg, w, sog: s.sog });
      }
      const m = Object.fromEntries(Object.entries(bins).map(([k, v]) => [k, wMean(v)]));
      const beat = P.beat(tws), run = P.run(tws);
      const ests = [];
      let tackAngle = null, src = null, conf = 0;
      if (m.uS && m.uP) {
        ests.push({ h: G.circMean([m.uS.h, m.uP.h]), w: Math.min(m.uS.w, m.uP.w) * 2 });
        tackAngle = Math.abs(G.norm180(m.uP.h - m.uS.h));
        src = 'по поворотам'; conf = 3;
      }
      if (m.dS && m.dP) {
        ests.push({ h: G.norm360(G.circMean([m.dS.h, m.dP.h]) + 180), w: Math.min(m.dS.w, m.dP.w) * 2 });
        src = src ? 'по поворотам и фордевиндам' : 'по фордевиндам'; conf = 3;
      }
      // One tack + polar is only trusted next to a strong prior (committee's bearing to the
      // windward mark); a forecast is too loose to classify a single course against.
      if (!ests.length && this.prior.src === 'азимут на знак') {
        const ba = beat.angle + LEEWAY;
        if (m.uS) ests.push({ h: G.norm360(m.uS.h + ba), w: m.uS.w });
        if (m.uP) ests.push({ h: G.norm360(m.uP.h - ba), w: m.uP.w });
        if (m.dS) ests.push({ h: G.norm360(m.dS.h + run.angle), w: m.dS.w });
        if (m.dP) ests.push({ h: G.norm360(m.dP.h - run.angle), w: m.dP.w });
        if (ests.length) { src = 'по одному галсу + поляра'; conf = 2; }
      }
        if (!ests.length) {
        // No tack classified yet: still learn TWS from speed on any steady course.
        const v = segs.length ? P.twsFromSpeed(segs[segs.length - 1].sog, Math.max(Math.abs(G.norm180(ref - segs[segs.length - 1].hdg)), beat.angle)) : null;
        if (v) result = { twd: ref, tws: v, src: this.prior.src || 'по первому курсу', conf: this.prior.twd != null ? 1 : 0, tackAngle: null, refs: {} };
        break;
      }
      let twd = wMean(ests).h;
      // Single-tack estimates lean on the prior while it exists.
      if (conf === 2 && this.prior.twd != null) twd = G.circMean([twd, twd, this.prior.twd]);

      // TWS from tacking angle and from speed on upwind legs.
      const twsEst = [];
      if (tackAngle) {
        const ba = tackAngle / 2 - LEEWAY;
        if (ba > 35 && ba < 50) twsEst.push(P.twsFromBeatAngle(ba));
      }
      // Speed vs polar on the most recent steady segments, any point of sail.
      const recent = segs.filter((s) => now - s.t1 < 600).slice(-4);
      for (const s of recent) {
        const a = Math.abs(G.norm180(twd - s.hdg));
        if (a < 35 || a > 165) continue;
        const v = P.twsFromSpeed(s.sog, Math.max(a, beat.angle));
        if (v) twsEst.push(v);
      }
      if (!twsEst.length && this.prior.tws != null) twsEst.push(this.prior.tws);
      if (twsEst.length) tws = twsEst.reduce((a, b) => a + b, 0) / twsEst.length;

      result = { twd, tws, src, conf, tackAngle, refs: m };
      if (Math.abs(G.norm180(twd - ref)) < 0.5) break;
      ref = twd;
    }

    if (result) this.publish(result.twd, result.tws, result.src, result.conf, result.tackAngle, result.refs);
    else this.publish(this.prior.twd, this.prior.tws, this.prior.src || 'нет данных', this.prior.twd != null ? 1 : 0);
  }

  publish(twd, tws, src, conf, tackAngle = null, refs = {}) {
    this.est = { twd, tws, src, conf, tackAngle, refs };
  }

  // Wind from the boat's wind sensor (via the instruments gateway); expires after 8 s without data.
  setInstrument(w) { this.inst = w ? { ...w, t: Date.now() } : null; }
  get instLive() { return !!this.inst && Date.now() - this.inst.t < 8000; }

  // Effective wind used by the app: manual override, then the wind sensor, then the GPS estimate.
  get twd() { return this.manual.twd ?? (this.instLive ? this.inst.twd : null) ?? this.est.twd ?? this.prior.twd; }
  get tws() { return this.manual.tws ?? (this.instLive ? this.inst.tws : null) ?? this.est.tws ?? this.prior.tws ?? 10; }
  get source() {
    if (this.manual.twd != null) return 'вручную';
    if (this.instLive) return 'датчик ветра';
    return this.est.conf ? this.est.src : this.prior.src || 'нет данных';
  }
  get conf() { return this.manual.twd != null || this.instLive ? 3 : this.est.conf || (this.prior.twd != null ? 1 : 0); }

  // Lift (+) / header (−) of the current heading vs the mean of that tack.
  shift(cog, twa) {
    const r = this.est.refs || {};
    const a = Math.abs(twa);
    if (a < 58) {
      if (twa > 0 && r.uS) return G.norm180(cog - r.uS.h);
      if (twa < 0 && r.uP) return G.norm180(r.uP.h - cog);
    } else if (a > 125) {
      if (twa > 0 && r.dS) return -G.norm180(cog - r.dS.h);
      if (twa < 0 && r.dP) return -G.norm180(r.dP.h - cog);
    }
    return null;
  }

  // Heading histogram for display: 72 bins × 5°, weighted by recent segment duration.
  histogram(now) {
    const bins = new Array(72).fill(0);
    for (const s of this.allSegments()) {
      const w = (s.t1 - s.t0) * Math.pow(0.5, (now / 1000 - s.t1) / HALF_LIFE);
      bins[Math.floor(G.norm360(s.hdg) / 5) % 72] += w;
    }
    return bins;
  }
}
