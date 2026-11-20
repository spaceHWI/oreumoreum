// 무기 3~6단계 소리 (#123): audio.js Sound 에 붙여 쓰는 함수들 (this = Sound: ctx·sfx·noise·on·sfxOn)
// 귤 총 '뽁', 머신건 짧은 '뽁뽁', 레이저 '위잉'(누르는 동안 이어짐), 폭탄 던지기 '휙'·터짐 '쿵'
const env = (c, g, t, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.001, t + a + d); };
function pop(S, f0, f1, vol, len) {
  const c = S.ctx, t = c.currentTime;
  const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + len);
  const g = c.createGain(); env(c, g, t, 0.004, vol, len); o.connect(g); g.connect(S.sfx); o.start(t); o.stop(t + len + 0.02);
  const s = c.createBufferSource(); s.buffer = S.noise; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4; f.frequency.value = 1800;
  const sg = c.createGain(); env(c, sg, t, 0.003, vol * 0.5, len * 0.6); s.connect(f); f.connect(sg); sg.connect(S.sfx); s.start(t, Math.random()); s.stop(t + len);
}
export const weaponSounds = {
  gun() { if (!this.on || !this.sfxOn) return; pop(this, 900, 220, 0.2, 0.12); },
  mg() { if (!this.on || !this.sfxOn) return; pop(this, 760 + Math.random() * 120, 260, 0.1, 0.06); },
  // 레이저: 켜면 낮은 톱니 + 떨리는 높은 음, 끄면 사그라듦. 한 개만
  laser(on) {
    if (!this.on || !this.sfxOn) on = false;
    const c = this.ctx; if (!c) return;
    const t = c.currentTime;
    if (on && !this._lz) {
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.07, t + 0.06); g.connect(this.sfx);
      const o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 110;
      const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = 880;
      const lfo = c.createOscillator(); lfo.frequency.value = 23; const lg = c.createGain(); lg.gain.value = 60; lfo.connect(lg); lg.connect(o2.frequency);
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
      o1.connect(f); f.connect(g); const g2 = c.createGain(); g2.gain.value = 0.5; o2.connect(g2); g2.connect(g);
      [o1, o2, lfo].forEach((o) => o.start(t)); this._lz = { g, os: [o1, o2, lfo] };
    } else if (!on && this._lz) {
      const z = this._lz; this._lz = null;
      z.g.gain.cancelScheduledValues(t); z.g.gain.setValueAtTime(Math.max(0.0001, z.g.gain.value), t); z.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      z.os.forEach((o) => o.stop(t + 0.14));
    }
  },
  lob() { if (!this.on || !this.sfxOn) return; const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(1800, t + 0.25);
    const g = c.createGain(); env(c, g, t, 0.05, 0.08, 0.25); s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t, Math.random()); s.stop(t + 0.32); },
  boom() { if (!this.on || !this.sfxOn) return; const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.45);
    const g = c.createGain(); env(c, g, t, 0.01, 0.42, 0.5); o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + 0.55);
    const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(300, t + 0.5);
    const sg = c.createGain(); env(c, sg, t, 0.005, 0.35, 0.55); s.connect(f); f.connect(sg); sg.connect(this.sfx); s.start(t, Math.random()); s.stop(t + 0.6);
    this.splat?.(); },
};
