/* ==========================================================
   轻量音效（WebAudio 合成，无外部资源）
   ========================================================== */

const SFX = {
  ctx: null,
  enabled: true,

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    } catch (e) { this.ctx = null; }
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  tone(freq, dur, type, vol, slideTo, delay) {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.ctx.currentTime + (delay || 0);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol || 0.06, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  },

  _last: {},
  _ok(key, gap) {
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (this._last[key] && now - this._last[key] < gap) return false;
    this._last[key] = now;
    return true;
  },

  click()  { this.tone(520, 0.07, 'triangle', 0.05, 720); },
  join()   { if (!this._ok('join', 95)) return; this.tone(660, 0.09, 'sine', 0.05, 990); },
  eat()    { if (!this._ok('eat', 75)) return; this.tone(300, 0.09, 'square', 0.045, 150); },
  eaten()  { if (!this._ok('eaten', 120)) return; this.tone(200, 0.12, 'sawtooth', 0.04, 90); },
  skill()  { this.tone(420, 0.10, 'triangle', 0.06, 880); this.tone(680, 0.14, 'sine', 0.05, 1180, 0.07); },
  win()    { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.07, null, i * 0.11)); },
  lose()   { [440, 370, 294, 220].forEach((f, i) => this.tone(f, 0.26, 'sine', 0.06, null, i * 0.13)); },
  coin()   { this.tone(880, 0.08, 'square', 0.04, 1320); },
  achieve(){ [784, 988, 1318].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.06, null, i * 0.09)); },
};
