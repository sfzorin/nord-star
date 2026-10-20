// Boat instruments over Wi-Fi: wind, log, compass and depth from the SeaTalkNG / NMEA 2000 network through a
// Yacht Devices YDWG-02 gateway (factory default: access point «YDWG», 192.168.4.1, TCP 1456, NMEA 0183).
//
// In the Android app (Capacitor) the native NmeaTcp plugin opens the TCP socket. A web page cannot open raw
// sockets, so in the browser we can only read a WebSocket that carries the same NMEA text (tools/nmea_sim.py
// provides one for testing on localhost).

import { parse } from './nmea.js?v=8';

const Cap = window.Capacitor;
export const isNative = !!Cap?.isNativePlatform?.();
// No bundler, so no @capacitor/core: the native bridge exposes the plugin proxy directly.
const NmeaTcp = isNative ? (Cap.Plugins?.NmeaTcp ?? Cap.registerPlugin?.('NmeaTcp') ?? null) : null;

const norm360 = (a) => ((a % 360) + 360) % 360;

export class Instruments {
  constructor() {
    this.S = {};            // latest value of every field: { v, t }
    this.state = 'off';     // off | connecting | on | error
    this.msg = '';
    this.lines = 0;
    this.lastData = 0;
    this.ws = null;
    this.subs = [];
    this.buf = '';
  }

  fresh(k, ms = 8000) { const x = this.S[k]; return x && Date.now() - x.t < ms ? x.v : null; }
  get live() { return this.state === 'on' && Date.now() - this.lastData < 5000; }

  feed(text) {
    this.buf += text;
    const parts = this.buf.split(/\r?\n/);
    this.buf = parts.pop();
    const now = Date.now();
    for (const ln of parts) if (parse(ln, this.S, now)) { this.lines++; this.lastData = now; }
    if (this.buf.length > 4096) this.buf = '';
  }

  async start(host, port) {
    await this.stop();
    this.state = 'connecting';
    this.msg = `${host}:${port}`;
    if (NmeaTcp) {
      this.subs.push(await NmeaTcp.addListener('data', (e) => this.feed(e.text)));
      this.subs.push(await NmeaTcp.addListener('status', (e) => { this.state = e.state; this.msg = e.message || ''; }));
      try { await NmeaTcp.connect({ host, port: Number(port) }); } catch (e) { this.state = 'error'; this.msg = e.message || String(e); }
      return;
    }
    if (location.protocol === 'https:' && !/^(localhost|127\.)/.test(host)) {
      this.state = 'error';
      this.msg = 'в браузере приборы недоступны — нужно Android-приложение';
      return;
    }
    this.openWs(host, port);
  }

  openWs(host, port) {
    const ws = new WebSocket(`ws://${host}:${port}`);
    this.ws = ws;
    ws.onopen = () => { this.state = 'on'; this.msg = `${host}:${port}`; };
    ws.onmessage = (e) => this.feed(typeof e.data === 'string' ? e.data : '');
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.state = 'connecting';
      this.retry = setTimeout(() => this.ws === ws && this.openWs(host, port), 3000);
    };
    ws.onerror = () => { this.msg = `нет связи с ${host}:${port}`; };
  }

  async stop() {
    clearTimeout(this.retry);
    if (this.ws) { const ws = this.ws; this.ws = null; ws.close(); }
    for (const s of this.subs) await s.remove();
    this.subs = [];
    if (NmeaTcp) { try { await NmeaTcp.disconnect(); } catch { /* not connected */ } }
    this.state = 'off';
  }

  // True heading if the network has one (HDT, HDG with variation, or magnetic + local declination).
  heading(declination) {
    const t = this.fresh('hdgT');
    if (t != null) return t;
    const m = this.fresh('hdgM');
    return m == null ? null : norm360(m + (this.fresh('var', 600000) ?? declination));
  }

  // True wind from the instruments: direction (from) and speed, or null.
  trueWind(cog, declination) {
    const tws = this.fresh('tws');
    if (tws == null) return null;
    let twd = this.fresh('twd');
    if (twd == null && this.fresh('twdM') != null) twd = norm360(this.fresh('twdM') + declination);
    if (twd == null) {
      const twa = this.fresh('twa');
      const hdg = this.heading(declination) ?? cog;
      if (twa != null && hdg != null) twd = norm360(hdg + twa);
    }
    return twd == null ? null : { twd, tws };
  }
}
