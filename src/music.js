// 배경 음악 (#64) — 음원 파일 없이 Web Audio 로 그때그때 만든다
// 평소(calm): 느리고 따뜻한 패드 + 드문드문한 종소리 음, 낮은 장조·밤은 낮고 어두운 단조
// 적 근처(tense): 낮은 반복 베이스 + 떨리는 감화음 + 둥둥 북. 적이 오면 MUSIC.fadeIn 초에 걸쳐 바뀌고,
// 사라지면 MUSIC.holdOut 초 뒤 MUSIC.fadeOut 초에 걸쳐 원래 음악으로
import { MUSIC } from './balance.js';

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
// [베이스, 패드 음들]
const DAY = [[41, [53, 57, 60, 64]], [36, [52, 55, 60, 62]], [45, [57, 60, 64, 67]], [43, [55, 60, 62, 64]]]; // Fmaj7 · C/E · Am7 · G6sus
const NIGHT = [[45, [48, 52, 55, 59]], [41, [48, 52, 53, 57]], [38, [53, 57, 60, 64]], [40, [52, 55, 59, 62]]]; // Am9 · Fmaj7 · Dm9 · Em7
const DAY_MEL = [72, 74, 76, 79, 81, 84];
const NIGHT_MEL = [64, 67, 69, 72, 74, 76];
const T_BASS = [38, 38, 41, 38, 38, 44, 38, 37]; // 8분음표 한 마디
const T_PAD = [[50, 53, 56], [49, 53, 56]];

export class Music {
  constructor(ctx, out, noise) {
    this.c = ctx; this.noise = noise;
    this.calm = ctx.createGain(); this.calm.gain.value = 1;
    this.tense = ctx.createGain(); this.tense.gain.value = 0;
    this.calm.connect(out); this.tense.connect(out);
    // 패드 필터 (밤엔 더 어둡게)
    this.padLP = ctx.createBiquadFilter(); this.padLP.type = 'lowpass'; this.padLP.frequency.value = 1500; this.padLP.Q.value = 0.3;
    this.padLP.connect(this.calm);
    // 메아리: 지연 + 낮은 통과 되먹임
    this.echo = ctx.createDelay(1.5); this.echo.delayTime.value = 0.48;
    const fb = ctx.createGain(); fb.gain.value = 0.33;
    const elp = ctx.createBiquadFilter(); elp.type = 'lowpass'; elp.frequency.value = 1800;
    this.echoWet = ctx.createGain(); this.echoWet.gain.value = 0.45;
    this.echo.connect(elp); elp.connect(fb); fb.connect(this.echo); elp.connect(this.echoWet); this.echoWet.connect(this.calm);
    this.echoT = ctx.createGain(); this.echoT.gain.value = 0.3; elp.connect(this.echoT); this.echoT.connect(this.tense);
    // 긴장 패드: 떨림(LFO)
    this.trem = ctx.createGain(); this.trem.gain.value = 0.6;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.2; const lg = ctx.createGain(); lg.gain.value = 0.4;
    lfo.connect(lg); lg.connect(this.trem.gain); lfo.start();
    this.tLP = ctx.createBiquadFilter(); this.tLP.type = 'lowpass'; this.tLP.frequency.value = 850;
    this.trem.connect(this.tLP); this.tLP.connect(this.tense);

    this.mode = 'calm'; this.threat = false; this.lastThreat = -1e9; this.tenseUntil = 0;
    this.chordT = 0; this.chordI = 0; this.noteT = 0; this.beatT = 0; this.step = 0; this.bar = 0;
    this.night = false; this.day = 1; this.active = false;
    this._iv = setInterval(() => this.tick(), 200);
  }

  _ramp(g, v, dur) {
    const p = g.gain, t = this.c.currentTime;
    p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(v, t + dur);
  }

  tick() {
    const c = this.c;
    if (!this.active || c.state !== 'running') return;
    const now = c.currentTime, ahead = now + 1.2;
    if (this.threat) {
      this.lastThreat = now;
      if (this.mode === 'calm') {
        this.mode = 'tense'; this._ramp(this.calm, 0, MUSIC.fadeIn); this._ramp(this.tense, MUSIC.tense, MUSIC.fadeIn);
        this.beatT = now + 0.05; this.step = 0; this.bar = 0;
      }
    } else if (this.mode === 'tense' && now - this.lastThreat >= MUSIC.holdOut) {
      this.mode = 'calm'; this.tenseUntil = now + MUSIC.fadeOut;
      this._ramp(this.calm, 1, MUSIC.fadeOut); this._ramp(this.tense, 0, MUSIC.fadeOut);
      this.chordT = now; this.noteT = now + 2;
    }
    if (this.mode === 'calm') {
      if (this.chordT < now - 0.5) this.chordT = now;
      if (this.noteT < now - 0.5) this.noteT = now + 1;
      while (this.chordT < ahead) this._chord(this.chordT);
      while (this.noteT < ahead) this._note(this.noteT);
    }
    if (this.mode === 'tense' || now < this.tenseUntil) {
      if (this.beatT < now - 0.5) { this.beatT = now + 0.05; this.step = 0; }
      while (this.beatT < ahead) this._beat(this.beatT);
    }
  }

  // ── 평소 ──
  _chord(t) {
    const night = this.night = this.day < MUSIC.nightK;
    const prog = night ? NIGHT : DAY;
    const [bass, notes] = prog[this.chordI++ % prog.length];
    const len = night ? MUSIC.chord.night : MUSIC.chord.day, att = 3, rel = 4.5;
    this.padLP.frequency.setTargetAtTime(night ? 850 : 1500, t, 2);
    this.echo.delayTime.setTargetAtTime(night ? 0.62 : 0.48, t, 1);
    const v = night ? 0.034 : 0.036;
    for (const m of notes) this._pad(t, hz(m), v, att, len, rel);
    this._pad(t, hz(bass), v * 1.5, att, len, rel, true);
    this.chordT = t + len;
  }
  _pad(t, f, v, att, len, rel, solo = false) {
    const c = this.c, g = c.createGain(), end = t + len + rel;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + att); g.gain.setValueAtTime(v, t + len); g.gain.linearRampToValueAtTime(0, end);
    g.connect(this.padLP);
    const oscs = solo ? [['sine', 0]] : [['sine', -5], ['triangle', 6]];
    for (const [type, cents] of oscs) { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = cents; o.connect(g); o.start(t); o.stop(end + 0.05); }
  }
  _note(t) {
    const c = this.c, night = this.night;
    const mel = night ? NIGHT_MEL : DAY_MEL;
    const m = mel[Math.floor(Math.random() * mel.length)];
    const v = (night ? 0.035 : 0.045) * (0.7 + Math.random() * 0.3), dec = night ? 3.2 : 2.4;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    const o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.value = hz(m);
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = hz(m) * 2.005; const g2 = c.createGain(); g2.gain.value = 0.25;
    o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.calm); g.connect(this.echo);
    o1.start(t); o2.start(t); o1.stop(t + dec + 0.05); o2.stop(t + dec + 0.05);
    // 가끔 바로 이어지는 두 번째 음
    const [a, b] = night ? MUSIC.note.night : MUSIC.note.day;
    this.noteT = t + (Math.random() < 0.25 ? 0.45 + Math.random() * 0.3 : a + Math.random() * (b - a));
  }

  // ── 적 근처 ──
  _beat(t) {
    const c = this.c, e8 = 30 / MUSIC.bpm, s = this.step % 8;
    // 베이스
    const f = hz(T_BASS[s]);
    const bo = c.createOscillator(); bo.type = 'triangle'; bo.frequency.value = f;
    const blp = c.createBiquadFilter(); blp.type = 'lowpass'; blp.frequency.value = 520;
    const bg = c.createGain(); bg.gain.setValueAtTime(0.0001, t); bg.gain.linearRampToValueAtTime(s === 0 ? 0.16 : 0.11, t + 0.012); bg.gain.exponentialRampToValueAtTime(0.0001, t + e8 * 0.95);
    bo.connect(blp); blp.connect(bg); bg.connect(this.tense); bo.start(t); bo.stop(t + e8);
    // 북: 1·3박 + 두 마디째 끝 당김
    if (s === 0 || s === 4 || (s === 7 && this.bar % 2 === 1)) {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.2);
      const g = c.createGain(); g.gain.setValueAtTime(s === 0 ? 0.32 : 0.22, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      o.connect(g); g.connect(this.tense); o.start(t); o.stop(t + 0.36);
    }
    // 부드러운 셰이커 (뒷박)
    if (s % 2 === 1) {
      const n = c.createBufferSource(); n.buffer = this.noise;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 1.2;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3500;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.018, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      n.connect(bp); bp.connect(lp); lp.connect(g); g.connect(this.tense); n.start(t, Math.random() * 1.5); n.stop(t + 0.08);
    }
    if (s === 0) {
      // 두 마디마다 떨리는 감화음 + 높은 긴 음
      if (this.bar % 2 === 0) {
        const len = e8 * 16, chord = T_PAD[(this.bar / 2) % 2];
        const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03, t + 0.8); g.gain.setValueAtTime(0.03, t + len - 0.6); g.gain.linearRampToValueAtTime(0, t + len + 0.3);
        g.connect(this.trem);
        for (const m of chord) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = (Math.random() - 0.5) * 10; o.connect(g); o.start(t); o.stop(t + len + 0.35); }
        const hi = c.createOscillator(); hi.type = 'sine'; hi.frequency.value = hz(this.bar % 4 === 0 ? 74 : 75);
        const hg = c.createGain(); hg.gain.setValueAtTime(0, t); hg.gain.linearRampToValueAtTime(0.022, t + 1.6); hg.gain.linearRampToValueAtTime(0, t + len);
        hi.connect(hg); hg.connect(this.tense); hg.connect(this.echo); hi.start(t); hi.stop(t + len + 0.05);
      }
    }
    this.step++; if (this.step % 8 === 0) this.bar++;
    this.beatT = t + e8;
  }

  state() { return { mode: this.mode, threat: this.threat, night: this.night, active: this.active, calm: +this.calm.gain.value.toFixed(2), tense: +this.tense.gain.value.toFixed(2) }; }
}
