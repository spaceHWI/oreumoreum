// 오름펑크 상호작용 소리 (#163): 하르방 코 '탁'·까마귀 '까악'. audio.js 의 Sound(ctx·sfx·noise)를 받아 그 자리에서 만든다 (audio.js 는 40KB 가까워 따로 둠)
const ok = (s) => s && s.on && s.sfxOn && s.ctx;

// 탁: 짧고 마른 돌 두드림 (잡음 한 번 + 낮은 울림)
export function tak(s, vol = 1) {
  if (!ok(s)) return;
  const c = s.ctx, t = c.currentTime;
  const n = c.createBufferSource(); n.buffer = s.noise; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 2.5;
  const g = c.createGain(); g.gain.setValueAtTime(0.3 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  n.connect(f); f.connect(g); g.connect(s.sfx); n.start(t, Math.random()); n.stop(t + 0.06);
  const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.09);
  const go = c.createGain(); go.gain.setValueAtTime(0.16 * vol, t); go.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  o.connect(go); go.connect(s.sfx); o.start(t); o.stop(t + 0.13);
}

// 까악: 거친 톱니파가 내려가는 소리 두 번 (vol: 거리)
export function caw(s, vol = 1, n = 2) {
  if (!ok(s) || vol <= 0.02) return;
  const c = s.ctx, t0 = c.currentTime;
  for (let i = 0; i < n; i++) {
    const t = t0 + i * 0.32;
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(760, t); o.frequency.linearRampToValueAtTime(980, t + 0.05); o.frequency.exponentialRampToValueAtTime(420, t + 0.24);
    const am = c.createOscillator(); am.frequency.value = 55; const amg = c.createGain(); amg.gain.value = 260; am.connect(amg); amg.connect(o.frequency); // 거칠게 떨림
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 1.2;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.12 * vol, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 0.27);
    o.connect(f); f.connect(g); g.connect(s.sfx); o.start(t); am.start(t); o.stop(t + 0.28); am.stop(t + 0.28);
  }
}
