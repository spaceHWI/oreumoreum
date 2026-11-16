import { STEP_SAMPLES } from './stepsamples.js';
// Web Audio 합성 사운드 — 외부 음원 없이 억새 바람·까마귀·말 방울·발소리·숨소리
export class Sound {
  constructor() { this.ctx = null; this.on = false; this.ambOn = true; this.sfxOn = true; this.forest = false; this.day = 1; }

  start() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
      this.amb = this.ctx.createGain(); this.amb.connect(this.master);
      this.sfx = this.ctx.createGain(); this.sfx.connect(this.master);
      this.noise = this._noiseBuffer();
      this._loadSteps();
      this._wind();
      this._scheduleCrow();
      if (!this.forest) this._scheduleBell();
      this._scheduleBird();
      this._gusts();
    }
    this.ctx.resume();
    this.on = true;
    this._applyGains();
    return true;
  }
  stop() { this.on = false; this._applyGains(); }
  setAmb(v) { this.ambOn = v; this._applyGains(); }
  setSfx(v) { this.sfxOn = v; this._applyGains(); }
  _applyGains() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.amb.gain.setTargetAtTime(this.on && this.ambOn ? 1 : 0, t, 0.3);
    this.sfx.gain.setTargetAtTime(this.on && this.sfxOn ? 1 : 0, t, 0.05);
  }

  _noiseBuffer() {
    const len = this.ctx.sampleRate * 2;
    const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  _src() { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; return s; }

  _wind() {
    const c = this.ctx;
    // 낮은 바람
    const s1 = this._src(); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    const g1 = c.createGain(); g1.gain.value = 0.16; this.windGain = g1; this.windLP = lp;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07; const lg = c.createGain(); lg.gain.value = 0.1;
    lfo.connect(lg); lg.connect(g1.gain);
    s1.connect(lp); lp.connect(g1); g1.connect(this.amb);
    // 억새 사각거림
    const s2 = this._src(); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 4200; bp.Q.value = 0.8;
    const g2 = c.createGain(); g2.gain.value = 0.02;
    const lfo2 = c.createOscillator(); lfo2.frequency.value = 0.13; const lg2 = c.createGain(); lg2.gain.value = 0.018;
    lfo2.connect(lg2); lg2.connect(g2.gain);
    s2.connect(bp); bp.connect(g2); g2.connect(this.amb);
    // 빗소리: 좁은 대역 잡음 두 겹 (평소엔 0)
    const s3 = this._src(), s4 = this._src(); const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
    const bp2 = c.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = 600; bp2.Q.value = 0.5;
    const rg = c.createGain(); rg.gain.value = 0; this.rainGain = rg;
    s3.connect(hp); hp.connect(rg); s4.connect(bp2); bp2.connect(rg); rg.connect(this.amb); s3.start(); s4.start();
    [s1, s2, lfo, lfo2].forEach((n) => n.start());
  }
  setRain(v) { if (this.rainGain) this.rainGain.gain.setTargetAtTime(v * 0.1, this.ctx.currentTime, 0.8); }

  // 바람이 가끔 세게 불었다 잦아듦
  _gusts() {
    const next = 6000 + Math.random() * 12000;
    setTimeout(() => {
      if (this.ctx && this.windLP) {
        const t = this.ctx.currentTime, up = 1.5 + Math.random() * 2;
        this.windLP.frequency.cancelScheduledValues(t);
        this.windLP.frequency.setValueAtTime(this.windLP.frequency.value, t);
        this.windLP.frequency.linearRampToValueAtTime(this.forest ? 520 : 760, t + up);
        this.windLP.frequency.linearRampToValueAtTime(this.forest ? 260 : 380, t + up + 3 + Math.random() * 3);
      }
      this._gusts();
    }, next);
  }
  // 새소리: 낮에는 작은 새(휘파람새·동박새 느낌), 숲에서는 더 자주. 밤에는 가끔 소쩍새 같은 낮은 소리
  _scheduleBird() {
    const base = this.forest ? 3500 : 9000;
    const next = base + Math.random() * base * 1.5;
    setTimeout(() => { if (this.on && this.ambOn) { if (this.day > 0.3) this.bird(); else if (Math.random() < 0.5) this.owl(); } this._scheduleBird(); }, next);
  }
  bird() {
    const c = this.ctx; const t0 = c.currentTime;
    const pan = c.createStereoPanner ? c.createStereoPanner() : null;
    if (pan) { pan.pan.value = Math.random() * 1.8 - 0.9; pan.connect(this.amb); }
    const out = pan || this.amb;
    const kind = Math.random();
    const notes = kind < 0.4 ? 3 + Math.floor(Math.random() * 4) : kind < 0.75 ? 2 : 6 + Math.floor(Math.random() * 5);
    let t = t0;
    const f0 = 2600 + Math.random() * 1800;
    for (let i = 0; i < notes; i++) {
      const o = c.createOscillator(); o.type = 'sine';
      const m = c.createOscillator(); m.frequency.value = 40 + Math.random() * 60; const mg = c.createGain(); mg.gain.value = 120 + Math.random() * 200; m.connect(mg); mg.connect(o.frequency);
      const g = c.createGain();
      let dur, fa, fb;
      if (kind < 0.4) { dur = 0.08 + Math.random() * 0.06; fa = f0 * (1 + (Math.random() - 0.5) * 0.3); fb = fa * (0.8 + Math.random() * 0.5); }
      else if (kind < 0.75) { dur = i === 0 ? 0.55 : 0.32; fa = i === 0 ? f0 * 0.55 : f0 * 0.9; fb = i === 0 ? f0 * 0.6 : f0 * 1.25; } // 휘파람새: 길게 '호-' 다음 '호케교'
      else { dur = 0.05; fa = f0 * (1 + 0.15 * Math.sin(i)); fb = fa * 1.1; }
      o.frequency.setValueAtTime(fa, t); o.frequency.exponentialRampToValueAtTime(fb, t + dur);
      const vol = (this.forest ? 0.035 : 0.025) * (0.6 + Math.random() * 0.4);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.02, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(out); o.start(t); m.start(t); o.stop(t + dur + 0.02); m.stop(t + dur + 0.02);
      t += dur + (kind < 0.4 ? 0.04 + Math.random() * 0.05 : kind < 0.75 ? 0.08 : 0.03);
    }
  }
  owl() {
    const c = this.ctx; const t0 = c.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = t0 + i * 0.6;
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(520, t); o.frequency.linearRampToValueAtTime(470, t + 0.35);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.03, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      o.connect(g); g.connect(this.amb); o.start(t); o.stop(t + 0.45);
    }
  }
  setDaylight(k) { this.day = k; }
  _scheduleCrow() {
    const next = 14000 + Math.random() * 26000;
    setTimeout(() => { if (this.on && this.ambOn) this.crow(); this._scheduleCrow(); }, next);
  }
  crow() {
    const c = this.ctx; const t0 = c.currentTime;
    const pan = c.createStereoPanner ? c.createStereoPanner() : null;
    if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; pan.connect(this.amb); }
    const n = 2 + (Math.random() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * 0.42;
      const o = c.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(820, t); o.frequency.exponentialRampToValueAtTime(520, t + 0.28);
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 3;
      const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      o.connect(f); f.connect(g); g.connect(pan || this.amb);
      o.start(t); o.stop(t + 0.35);
    }
  }

  _scheduleBell() {
    const next = 22000 + Math.random() * 30000;
    setTimeout(() => { if (this.on && this.ambOn) this.horseBell(); this._scheduleBell(); }, next);
  }
  horseBell() {
    const c = this.ctx; const t0 = c.currentTime;
    for (let i = 0; i < 5; i++) {
      const t = t0 + i * (0.35 + Math.random() * 0.15);
      [1560, 2340, 3900].forEach((fr, k) => {
        const o = c.createOscillator(); o.frequency.value = fr * (1 + (Math.random() - 0.5) * 0.01);
        const g = c.createGain(); g.gain.setValueAtTime(0.012 / (k + 1), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
        o.connect(g); g.connect(this.amb); o.start(t); o.stop(t + 0.75);
      });
    }
  }

  _loadSteps() {
    this.steps = {};
    const dec = (b64) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Promise((res) => this.ctx.decodeAudioData(u.buffer, res, () => res(null))); };
    for (const [k, list] of Object.entries(STEP_SAMPLES)) Promise.all(list.map(dec)).then((bufs) => { this.steps[k] = bufs.filter(Boolean); });
  }
  // 녹음 샘플 발소리. 표면마다 샘플·필터·피치를 달리하고 매번 무작위로 골라 반복감을 줄임
  _sampleStep(surface, running) {
    const kind = surface === 1 ? 'gravel' : surface === 0 ? 'sand' : 'stone';
    const list = this.steps?.[kind]; if (!list || !list.length) return false;
    let i = Math.floor(Math.random() * list.length); if (list.length > 1 && i === this._lastStep) i = (i + 1) % list.length; this._lastStep = i;
    const c = this.ctx; const t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = list[i];
    const rate = { 0: 1.05, 1: 1.0, 2: 0.82, 3: 0.92 }[surface] ?? 1;
    src.playbackRate.value = rate * (0.93 + Math.random() * 0.14) * (running ? 1.06 : 1);
    const f = c.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.value = surface === 0 ? 2600 : surface === 2 ? 1800 : 6000;
    const g = c.createGain();
    const base = surface === 0 ? 0.32 : surface === 1 ? 0.42 : 0.38;
    g.gain.value = base * (running ? 1.25 : 0.9) * (0.85 + Math.random() * 0.3);
    src.connect(f); f.connect(g); g.connect(this.sfx);
    src.start(t, 0, running ? 0.3 : 0.42);
    if (surface === 0) { // 풀잎 스치는 소리 살짝
      const n = c.createBufferSource(); n.buffer = this.noise;
      const hf = c.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = 5200; hf.Q.value = 0.8;
      const ng = c.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(0.025, t + 0.03); ng.gain.exponentialRampToValueAtTime(0.0005, t + 0.18);
      n.connect(hf); hf.connect(ng); ng.connect(this.sfx); n.start(t, Math.random() * 1.5); n.stop(t + 0.2);
    }
    if (surface === 2) { // 나무 데크 울림
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 150 + Math.random() * 30;
      const og = c.createGain(); og.gain.setValueAtTime(0.07, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(og); og.connect(this.sfx); o.start(t); o.stop(t + 0.14);
    }
    return true;
  }

  // surface: 0 풀, 1 송이, 2 계단, 3 흙
  step(surface, running) {
    if (!this.on || !this.sfxOn) return;
    if (this._sampleStep(surface, running)) return;
    const c = this.ctx; const t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter();
    const g = c.createGain();
    const vol = (running ? 0.22 : 0.15) * (0.8 + Math.random() * 0.4);
    const jit = 0.85 + Math.random() * 0.3;
    if (surface === 1) { f.type = 'bandpass'; f.frequency.value = 2600 * jit; f.Q.value = 0.7; }
    else if (surface === 2) { f.type = 'bandpass'; f.frequency.value = 420 * jit; f.Q.value = 2.5; }
    else if (surface === 3) { f.type = 'lowpass'; f.frequency.value = 900 * jit; }
    else { f.type = 'highpass'; f.frequency.value = 3500; }
    const dur = surface === 1 ? 0.11 : surface === 2 ? 0.07 : 0.09;
    g.gain.setValueAtTime(vol * (surface === 0 ? 0.5 : 1), t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfx);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
    if (surface === 2) { // 나무 계단 통 울림
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = 180;
      const og = c.createGain(); og.gain.setValueAtTime(0.06, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.connect(og); og.connect(this.sfx); o.start(t); o.stop(t + 0.1);
    }
  }

  // 숨소리: inhale=true 들숨, dur초
  breath(inhale, dur) {
    if (!this.on || !this.sfxOn) return;
    const c = this.ctx; const t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(inhale ? 900 : 1300, t);
    f.frequency.linearRampToValueAtTime(inhale ? 1500 : 700, t + dur);
    const g = c.createGain();
    const peak = inhale ? 0.09 : 0.12;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + dur * (inhale ? 0.6 : 0.25));
    g.gain.linearRampToValueAtTime(0.0001, t + dur * 0.95);
    s.connect(f); f.connect(g); g.connect(this.sfx);
    s.start(t); s.stop(t + dur);
  }

  stone() {
    if (!this.on || !this.sfxOn) return;
    const c = this.ctx; const t = c.currentTime;
    [0, 0.09].forEach((dt, i) => {
      const o = c.createOscillator(); o.type = 'square'; o.frequency.value = 520 - i * 120;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 4;
      const g = c.createGain(); g.gain.setValueAtTime(0.12 / (i + 1), t + dt); g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.06);
      o.connect(f); f.connect(g); g.connect(this.sfx); o.start(t + dt); o.stop(t + dt + 0.08);
    });
  }

  beep(hi) {
    if (!this.on || !this.sfxOn) return;
    const c = this.ctx; const t = c.currentTime;
    const o = c.createOscillator(); o.type = 'square'; o.frequency.value = hi ? 1320 : 880;
    const g = c.createGain(); g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + 0.14);
  }

  crunch() {
    if (!this.on || !this.sfxOn) return;
    const c = this.ctx; const t0 = c.currentTime;
    for (let i = 0; i < 4; i++) {
      const t = t0 + i * 0.14 + Math.random() * 0.03;
      const s = c.createBufferSource(); s.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800 + Math.random() * 1200; f.Q.value = 1.5;
      const g = c.createGain(); g.gain.setValueAtTime(0.14, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t, Math.random()); s.stop(t + 0.08);
    }
  }
  // 귤 즙 터지는 소리: 껍질 까는 바스락 + 촉촉한 쭙 + 작은 반짝 종소리
  juice() {
    if (!this.on || !this.sfxOn) return;
    const c = this.ctx; const t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 6;
    f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(2600, t + 0.12);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.32, t + 0.015); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t, Math.random()); s.stop(t + 0.25);
    for (let i = 0; i < 5; i++) { // 보글보글 즙
      const tt = t + 0.04 + i * 0.035 + Math.random() * 0.02;
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(500 + Math.random() * 500, tt); o.frequency.exponentialRampToValueAtTime(1400 + Math.random() * 600, tt + 0.05);
      const og = c.createGain(); og.gain.setValueAtTime(0.06, tt); og.gain.exponentialRampToValueAtTime(0.001, tt + 0.06);
      o.connect(og); og.connect(this.sfx); o.start(tt); o.stop(tt + 0.07);
    }
    [1318.5, 1760, 2637].forEach((fr, i) => { // 회복 반짝
      const tt = t + 0.18 + i * 0.07;
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = fr;
      const og = c.createGain(); og.gain.setValueAtTime(0.0001, tt); og.gain.linearRampToValueAtTime(0.07, tt + 0.01); og.gain.exponentialRampToValueAtTime(0.001, tt + 0.35);
      o.connect(og); og.connect(this.sfx); o.start(tt); o.stop(tt + 0.4);
    });
  }
  // 귤 활 (#38): 줄이 튕기는 '퉁' + 바람 가르는 '슉'
  bow() {
    if (!this.on || !this.sfxOn) return;
    const c = this.ctx; const t = c.currentTime;
    const o = c.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.18);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + 0.24);
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(2400, t + 0.02); f.frequency.exponentialRampToValueAtTime(900, t + 0.2);
    const sg = c.createGain(); sg.gain.setValueAtTime(0.0001, t + 0.02); sg.gain.linearRampToValueAtTime(0.07, t + 0.05); sg.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    s.connect(f); f.connect(sg); sg.connect(this.sfx); s.start(t + 0.02, Math.random()); s.stop(t + 0.24);
  }
  // 귤 화살이 맞아 즙이 터지는 소리: 촉촉한 '퍽' + 짧은 보글
  splat() {
    if (!this.on || !this.sfxOn) return;
    const c = this.ctx; const t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(2200, t); f.frequency.exponentialRampToValueAtTime(400, t + 0.12);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.28, t + 0.008); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t, Math.random()); s.stop(t + 0.16);
    for (let i = 0; i < 3; i++) {
      const tt = t + 0.03 + i * 0.03 + Math.random() * 0.015;
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(380 + Math.random() * 300, tt); o.frequency.exponentialRampToValueAtTime(1100 + Math.random() * 400, tt + 0.04);
      const og = c.createGain(); og.gain.setValueAtTime(0.05, tt); og.gain.exponentialRampToValueAtTime(0.001, tt + 0.05);
      o.connect(og); og.connect(this.sfx); o.start(tt); o.stop(tt + 0.06);
    }
  }
  deerHop() {
    if (!this.on || !this.sfxOn) return;
    const c = this.ctx; const t0 = c.currentTime;
    for (let i = 0; i < 3; i++) { const t = t0 + i * 0.18; const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.06); const g = c.createGain(); g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08); o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + 0.1); }
  }
  boar() {
    if (!this.on || !this.sfxOn) return;
    const c = this.ctx; const t0 = c.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = t0 + i * 0.22;
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(110 + Math.random() * 20, t); o.frequency.linearRampToValueAtTime(80, t + 0.16);
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(f); f.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + 0.2);
    }
  }
  fanfare() {
    if (!this.on || !this.sfxOn) return;
    const c = this.ctx; const t0 = c.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((fr, i) => {
      const t = t0 + i * 0.11;
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = fr;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + (i === 3 ? 0.7 : 0.25));
      o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + 0.75);
    });
  }
  // 구역에 꽃이 만발 (#46): 밝게 올라가는 종소리 + 반짝임
  bloom() {
    if (!this.on || !this.sfxOn) return;
    const c = this.ctx, t0 = c.currentTime;
    [587.3, 740, 880, 1174.7, 1480, 1760].forEach((fr, i) => {
      const t = t0 + i * 0.13, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = fr; o2.type = 'triangle'; o2.frequency.value = fr * 2.01;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0008, t + 1.1);
      o.connect(g); o2.connect(g); g.connect(this.sfx); o.start(t); o2.start(t); o.stop(t + 1.2); o2.stop(t + 1.2);
    });
    const n = c.createBufferSource(); n.buffer = this.noise; const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000; const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.025, t0 + 0.4); g.gain.exponentialRampToValueAtTime(0.0005, t0 + 1.8);
    n.connect(hp); hp.connect(g); g.connect(this.sfx); n.start(t0); n.stop(t0 + 1.9);
  }
  coin() {
    if (!this.on || !this.sfxOn) return;
    const c = this.ctx; const t = c.currentTime;
    [1318.5, 1760].forEach((fr, i) => { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = fr; const g = c.createGain(); g.gain.setValueAtTime(0.035, t + i * 0.07); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.12); o.connect(g); g.connect(this.sfx); o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.14); });
  }
  // 쓰레기 줍는 소리: 캔은 땡그랑, 페트병은 통통, 나머지는 바스락
  pick(kind) {
    if (!this.on || !this.sfxOn) return;
    const c = this.ctx; const t = c.currentTime;
    if (kind === 'can' || kind === 'pet') {
      const fr = kind === 'can' ? [1900, 2850] : [520, 780];
      fr.forEach((f, i) => { const o = c.createOscillator(); o.type = kind === 'can' ? 'triangle' : 'sine'; o.frequency.setValueAtTime(f, t + i * 0.05); if (kind === 'pet') o.frequency.exponentialRampToValueAtTime(f * 0.7, t + i * 0.05 + 0.1);
        const g = c.createGain(); g.gain.setValueAtTime(0.0001, t + i * 0.05); g.gain.linearRampToValueAtTime(0.06, t + i * 0.05 + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + (kind === 'can' ? 0.22 : 0.12));
        o.connect(g); g.connect(this.sfx); o.start(t + i * 0.05); o.stop(t + i * 0.05 + 0.25); });
    }
    const n = kind === 'can' || kind === 'pet' ? 1 : 3;
    for (let i = 0; i < n; i++) {
      const tt = t + i * 0.06 + Math.random() * 0.02;
      const s = c.createBufferSource(); s.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = (kind === 'gear' ? 900 : kind === 'foam' ? 2400 : 3600) + Math.random() * 800; f.Q.value = 1.2;
      const g = c.createGain(); g.gain.setValueAtTime(0.12, tt); g.gain.exponentialRampToValueAtTime(0.001, tt + 0.06);
      s.connect(f); f.connect(g); g.connect(this.sfx); s.start(tt, Math.random()); s.stop(tt + 0.07);
    }
  }
  // 클린하우스에 다 버렸을 때: 올라가는 세 음 + 반짝
  recycle() {
    if (!this.on || !this.sfxOn) return;
    const c = this.ctx; const t = c.currentTime;
    [659.25, 830.6, 987.8, 1318.5].forEach((f, i) => { const tt = t + i * 0.08; const o = c.createOscillator(); o.type = i === 3 ? 'square' : 'triangle'; o.frequency.value = f; const g = c.createGain(); g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(i === 3 ? 0.035 : 0.07, tt + 0.01); g.gain.exponentialRampToValueAtTime(0.001, tt + (i === 3 ? 0.35 : 0.18)); o.connect(g); g.connect(this.sfx); o.start(tt); o.stop(tt + 0.4); });
  }
  // 배낭이 다 찼을 때: 낮은 두 음
  full() {
    if (!this.on || !this.sfxOn) return;
    const c = this.ctx; const t = c.currentTime;
    [440, 330].forEach((f, i) => { const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f; const g = c.createGain(); g.gain.setValueAtTime(0.0001, t + i * 0.12); g.gain.linearRampToValueAtTime(0.07, t + i * 0.12 + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.2); o.connect(g); g.connect(this.sfx); o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.22); });
  }
  // 개울에 빠짐: 첨벙 (낮게 퍼지는 잡음 + 물방울) (#31)
  splash() {
    if (!this.on || !this.sfxOn) return;
    const c = this.ctx; const t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(400, t + 0.5);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.32, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t, Math.random()); s.stop(t + 0.65);
    for (let i = 0; i < 4; i++) { const tt = t + 0.08 + i * 0.07 + Math.random() * 0.04, o = c.createOscillator(); o.type = 'sine'; const f0 = 700 + Math.random() * 900; o.frequency.setValueAtTime(f0, tt); o.frequency.exponentialRampToValueAtTime(f0 * 1.8, tt + 0.06);
      const gg = c.createGain(); gg.gain.setValueAtTime(0.0001, tt); gg.gain.linearRampToValueAtTime(0.04, tt + 0.005); gg.gain.exponentialRampToValueAtTime(0.001, tt + 0.08); o.connect(gg); gg.connect(this.sfx); o.start(tt); o.stop(tt + 0.1); }
  }
  // 낚싯줄에 걸림 (#41): 찌가 쑥 들어가는 '퐁' + 줄이 팽팽해지는 높은 '띵'
  bite() {
    if (!this.on || !this.sfxOn) return;
    const c = this.ctx; const t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(180, t + 0.12);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16); o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + 0.18);
    const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.setValueAtTime(1320, t + 0.1); o2.frequency.linearRampToValueAtTime(1480, t + 0.3);
    const g2 = c.createGain(); g2.gain.setValueAtTime(0.0001, t + 0.1); g2.gain.linearRampToValueAtTime(0.06, t + 0.11); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.38); o2.connect(g2); g2.connect(this.sfx); o2.start(t + 0.1); o2.stop(t + 0.4);
  }
  // 낚싯줄 감는 소리: 짧은 딸깍 여러 번
  reel(dur = 1) {
    if (!this.on || !this.sfxOn) return;
    const c = this.ctx; const t = c.currentTime, n = Math.round(dur * 14);
    for (let i = 0; i < n; i++) { const tt = t + i / 14; const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 4200; f.Q.value = 3;
      const g = c.createGain(); g.gain.setValueAtTime(0.08, tt); g.gain.exponentialRampToValueAtTime(0.001, tt + 0.025); s.connect(f); f.connect(g); g.connect(this.sfx); s.start(tt, Math.random()); s.stop(tt + 0.03); }
  }
  // 낚싯대 던지기 (#44): 바람 가르는 '휙'
  cast() {
    if (!this.on || !this.sfxOn) return;
    const c = this.ctx; const t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.6;
    f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(2600, t + 0.18); f.frequency.exponentialRampToValueAtTime(1200, t + 0.32);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.12); g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
    s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t, Math.random()); s.stop(t + 0.36);
  }
  // 찌가 물에 떨어짐: 작은 '퐁'
  plop() {
    if (!this.on || !this.sfxOn) return;
    const c = this.ctx; const t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(380, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.07);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.08, t + 0.008); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1); o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + 0.12);
  }
  // 정낭 나무 막대가 내려지는 소리: 나무 부딪는 둔탁한 두 번
  gate() {
    if (!this.on || !this.sfxOn) return;
    const c = this.ctx; const t = c.currentTime;
    [0, 0.42, 0.9].forEach((dt, i) => { const tt = t + dt; const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(i === 2 ? 180 : 240, tt); o.frequency.exponentialRampToValueAtTime(90, tt + 0.12);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(0.14, tt + 0.006); g.gain.exponentialRampToValueAtTime(0.001, tt + 0.2); o.connect(g); g.connect(this.sfx); o.start(tt); o.stop(tt + 0.22);
      const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.5; const gn = c.createGain(); gn.gain.setValueAtTime(0.12, tt); gn.gain.exponentialRampToValueAtTime(0.001, tt + 0.07); s.connect(f); f.connect(gn); gn.connect(this.sfx); s.start(tt, Math.random()); s.stop(tt + 0.08); });
  }
  shutter() {
    if (!this.on || !this.sfxOn) return;
    const c = this.ctx; const t = c.currentTime;
    [0, 0.07].forEach((dt) => {
      const s = c.createBufferSource(); s.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2000;
      const g = c.createGain(); g.gain.setValueAtTime(0.25, t + dt); g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.04);
      s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t + dt); s.stop(t + dt + 0.05);
    });
  }
  // 가위질 한 번 (#58): 짧고 높은 쇳소리 둘
  snip() {
    if (!this.on || !this.sfxOn) return;
    const c = this.ctx; const t = c.currentTime;
    [0, 0.05].forEach((dt, i) => {
      const s = c.createBufferSource(); s.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = i ? 5200 : 6800; f.Q.value = 4;
      const g = c.createGain(); g.gain.setValueAtTime(0.16, t + dt); g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.035);
      s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t + dt, Math.random()); s.stop(t + dt + 0.04);
    });
  }
}
