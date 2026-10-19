// Position source: the tablet's GPS.

import * as G from './geo.js?v=8';

export class RealGPS {
  constructor(onFix, onError) {
    this.onFix = onFix;
    this.onError = onError;
    this.watch = null;
    this.prev = null;
    this.sog = 0;
    this.cog = 0;
  }

  start() {
    if (!navigator.geolocation) { this.onError('Геолокация недоступна'); return; }
    this.watch = navigator.geolocation.watchPosition(
      (p) => this.handle(p),
      (e) => this.onError({ 1: 'доступ запрещён — разрешите геолокацию', 2: 'нет сигнала', 3: 'нет ответа' }[e.code] || 'ошибка'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  }

  stop() {
    if (this.watch !== null) navigator.geolocation.clearWatch(this.watch);
    this.watch = null;
  }

  handle(p) {
    const c = p.coords, t = p.timestamp;
    const fix = { lat: c.latitude, lon: c.longitude, acc: c.accuracy, t };
    let sog = Number.isFinite(c.speed) ? c.speed / G.KN : null;
    let cog = Number.isFinite(c.heading) ? c.heading : null;
    if (this.prev && (sog === null || cog === null)) {
      const dt = (t - this.prev.t) / 1000;
      if (dt > 0.3) {
        const d = G.distance(this.prev, fix);
        if (sog === null) sog = d / dt / G.KN;
        if (cog === null && d > 0.5) cog = G.bearing(this.prev, fix);
      }
    }
    if (sog !== null) this.sog = this.sog * 0.4 + sog * 0.6;
    if (cog !== null && this.sog > 0.6) this.cog = G.norm360(this.cog + G.norm180(cog - this.cog) * 0.6);
    this.prev = fix;
    this.onFix({ ...fix, sog: this.sog, cog: this.cog, src: 'gps' });
  }
}
