// Start countdown (RRS 26: warning 5', preparatory 4', one-minute 1', start 0) + sounds.

const MIN_WORDS = { 1: 'одна минута', 2: 'две минуты', 3: 'три минуты', 4: 'четыре минуты', 5: 'пять минут', 6: 'шесть минут', 10: 'десять минут' };

export class Horn {
  constructor() { this.ctx = null; this.sound = true; this.voice = true; }

  unlock() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* no audio */ }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  beep(freq = 880, dur = 0.15, gain = 0.35) {
    if (!this.sound || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  horn(dur = 0.9) { this.beep(330, dur, 0.5); }

  say(text) {
    if (!this.voice || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU';
    u.rate = 1.15;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }
}

export class StartTimer {
  constructor(horn) {
    this.horn = horn;
    this.gun = null;
    this.preset = 300;
    this.lastSec = null;
    this.onGun = null;
    this.gunFired = false;
  }

  get running() { return this.gun !== null; }
  remaining(now = Date.now()) { return this.gun === null ? this.preset : (this.gun - now) / 1000; }

  start(preset) {
    if (preset) this.preset = preset;
    this.gun = Date.now() + this.preset * 1000;
    this.lastSec = Math.ceil(this.preset);
    this.gunFired = false;
    this.horn.horn();
    this.horn.say(MIN_WORDS[this.preset / 60] || '');
  }

  // Start button: starts if idle, otherwise snaps to the nearest whole minute.
  startOrSync() {
    if (!this.running || this.remaining() < 0) return this.start();
    const m = Math.round(this.remaining() / 60) * 60;
    this.gun = Date.now() + m * 1000;
    this.lastSec = Math.ceil(m);
    this.horn.beep(1200, 0.12);
  }

  shift(sec) {
    if (!this.running) { this.preset = Math.max(60, this.preset + sec); return; }
    this.gun += sec * 1000;
    this.lastSec = Math.ceil(this.remaining());
  }

  reset() { this.gun = null; this.lastSec = null; this.gunFired = false; }

  nextSignal() {
    if (!this.running) return null;
    const r = this.remaining();
    for (const [k, name] of [[240, '4 мин'], [60, '1 мин'], [0, 'старт']]) {
      if (r > k) return { name, in: r - k };
    }
    return null;
  }

  tick() {
    if (!this.running) return;
    const s = Math.ceil(this.remaining());
    if (this.lastSec === null) this.lastSec = s;
    if (this.lastSec - s > 3) this.lastSec = s + 1; // tab was asleep: don't replay a burst
    while (this.lastSec > s) {
      this.lastSec--;
      if (this.lastSec >= 0) this.signal(this.lastSec);
    }
    // Sync / −1′ / a sleeping tab can jump over second 0: still fire the gun once.
    if (!this.gunFired && this.remaining() <= 0) this.signal(0);
  }

  signal(k) {
    if (k < 0) return;
    if (k === 0) {
      if (this.gunFired) return;
      this.gunFired = true;
      this.horn.horn(1.4);
      this.horn.say('Старт');
      this.onGun?.();
    } else if (k % 60 === 0) {
      const big = k === 240 || k === 60 || k === this.preset;
      if (big) this.horn.horn(); else this.horn.beep(660, 0.3);
      this.horn.say(MIN_WORDS[k / 60] || `${k / 60} минут`);
    } else if (k === 30 || k === 20 || k === 15) {
      this.horn.beep(880, 0.2);
      this.horn.say(`${k} секунд`);
    } else if (k <= 10) {
      this.horn.beep(k <= 5 ? 1320 : 990, 0.12);
      if (k === 10) this.horn.say('десять');
    }
  }
}
