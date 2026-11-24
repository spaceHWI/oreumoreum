// 바람·억새·빗소리 (#292). audio.js 에서 떼어 냄 (audio.js 가 40KB 를 넘어)
// 바람: 흰 소음을 그대로 내지 않고 낮게 거른 소리(로우패스 WIND.lp)에 느린 세기 물결(WIND.wave 초)과 가끔 스치는 돌풍(WIND.gust)
//   귀에 거슬리는 높은 대역은 한 번 더 깎음(WIND.cut). 크기는 구역 배율(setZone)·정상(setTop)·비(setRain)로 조금 더
// 억새: 예전엔 4.2kHz 대역 '쉬—' 였음 → 1.3kHz 언저리 낮은 사각거림, 위는 깎음
// 시계는 하나: Sound 의 스케줄러가 tick(now) 를 부름 (타이머 없음). 미리 ahead 초까지 세기·필터 변화를 잡아 둠
import { WIND } from './balance.js';

export class Wind {
  constructor(ctx, out, noise, forest = false) {
    const c = this.c = ctx; this.forest = forest;
    this.zone = 1; this.top = 0; this.rain = 0; this.waveT = 0; this.gustT = 0; this.gustEnd = 0;
    const src = () => { const s = c.createBufferSource(); s.buffer = noise; s.loop = true; return s; };
    const lp = (f, q = 0.5) => { const b = c.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = f; b.Q.value = q; return b; };
    // 마지막 깎기: 높은 대역(cut 위)을 두 번 거름
    this.out = c.createGain(); this.out.gain.value = 1;
    const cut1 = lp(WIND.cut, 0.5), cut2 = lp(WIND.cut * 1.2, 0.5);
    this.out.connect(cut1); cut1.connect(cut2); cut2.connect(out);
    // 바람: 노이즈 → 로우패스 두 겹(가파르게) → 물결 세기(wave) → 구역 세기(level)
    const s1 = src(); this.lp1 = lp(WIND.lp[forest ? 0 : 1], 0.7); this.lp2 = lp(WIND.lp[forest ? 0 : 1] * 1.4, 0.4);
    this.wave = c.createGain(); this.wave.gain.value = WIND.waveLo;
    this.level = c.createGain(); this.level.gain.value = 0;
    s1.connect(this.lp1); this.lp1.connect(this.lp2); this.lp2.connect(this.wave); this.wave.connect(this.level); this.level.connect(this.out);
    // 억새: 낮은 대역 사각거림 (느린 물결은 바람 물결을 따라감)
    const s2 = src(); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = WIND.reed.f; bp.Q.value = 0.7;
    this.reedG = c.createGain(); this.reedG.gain.value = 0;
    s2.connect(bp); bp.connect(this.reedG); this.reedG.connect(this.wave);
    // 빗소리: 좁은 대역 잡음 두 겹 (평소엔 0). 쉿 소리가 귀를 찌르지 않게 위를 깎음
    const s3 = src(), s4 = src(); const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
    const rlp = lp(WIND.rainLp, 0.4); const bp2 = c.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = 600; bp2.Q.value = 0.5;
    this.rainG = c.createGain(); this.rainG.gain.value = 0;
    s3.connect(hp); hp.connect(rlp); rlp.connect(this.rainG); s4.connect(bp2); bp2.connect(this.rainG); this.rainG.connect(out);
    for (const s of [s1, s2, s3, s4]) s.start(0, Math.random() * 1.5);
    this.reed = 1; this._level(0, 0.01);
  }
  // 구역 배율 (balance ZONE_LOOK wind·reed): 천천히 바뀜
  setZone(wind = 1, reed = 1, now) { this.zone = wind; this.reed = reed; this._level(now ?? this.c.currentTime, 1.5); }
  setTop(v, now) { v = v ? 1 : 0; if (v === this.top) return; this.top = v; this._level(now ?? this.c.currentTime, 2); }
  setRain(v, now) { v = Math.max(0, Math.min(1, +v || 0)); const t = now ?? this.c.currentTime; if (Math.abs(v - this.rain) > 0.02) { this.rain = v; this._level(t, 2); } this.rainG.gain.setTargetAtTime(v * WIND.rain, t, 0.8); }
  // 지금 바람 크기 (구역·정상·비)
  amount() { return WIND.base * this.zone * (1 + WIND.topK * this.top) * (1 + WIND.rainK * this.rain); }
  _level(t, tau) { this.level.gain.setTargetAtTime(this.amount(), t, tau); this.reedG.gain.setTargetAtTime(WIND.reed.g * this.reed, t, tau); }

  // 스케줄러가 부름: 물결(느린 세기 변화)과 돌풍을 ahead 초 앞까지 잡음
  tick(now, ahead = 1.2) {
    const end = now + ahead, W = WIND;
    if (this.waveT < now - 1) this.waveT = now;
    while (this.waveT < end) {
      // 다음 물결 꼭짓점: 한 물결(wave[0]~wave[1] 초)의 절반 뒤, 세기 waveLo~waveHi 사이 아무 데
      const dur = (W.wave[0] + Math.random() * (W.wave[1] - W.wave[0])) / 2, v = W.waveLo + Math.random() * (W.waveHi - W.waveLo);
      this.wave.gain.setTargetAtTime(v, this.waveT, dur / 3);
      this.waveT += dur;
    }
    if (this.gustT < now - 1) this.gustT = now + W.gust.gap[0] * Math.random();
    if (this.gustT < end) {
      // 돌풍: 필터가 잠깐 열리고(그래도 cut 아래) 세기도 조금 오름. 숲은 덜
      const t = this.gustT, up = W.gust.up[0] + Math.random() * (W.gust.up[1] - W.gust.up[0]), hold = 1 + Math.random() * 2, down = 3 + Math.random() * 3;
      const lo = W.lp[this.forest ? 0 : 1], hi = lo * W.gust.open * (this.forest ? 0.8 : 1);
      for (const [f, k] of [[this.lp1.frequency, 1], [this.lp2.frequency, 1.4]]) {
        f.cancelScheduledValues(t); f.setTargetAtTime(hi * k, t, up / 3); f.setTargetAtTime(lo * k, t + up + hold, down / 3);
      }
      this.wave.gain.setTargetAtTime(W.waveHi * W.gust.lift, t, up / 3);
      this.waveT = Math.max(this.waveT, t + up + hold);
      this.gustEnd = t + up + hold + down;
      this.gustT = t + W.gust.gap[0] + Math.random() * (W.gust.gap[1] - W.gust.gap[0]);
    }
  }
  state() { return { level: +this.level.gain.value.toFixed(3), amount: +this.amount().toFixed(3), wave: +this.wave.gain.value.toFixed(2), lp: Math.round(this.lp1.frequency.value), top: this.top, rain: this.rain, gust: this.c.currentTime < this.gustEnd }; }
}
