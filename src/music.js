// 배경 음악 (#64, #292) — 음원 파일 없이 Web Audio 로 그때그때 만든다
// 평소(calm, #292): 장조 5음 음계 가락 조각을 엮어 연주(악보·음색 src/musiccalm.js). 곳(place)·밤에 따라 빠르기·음색·옥타브가 바뀌고
//   MUSIC.calm.play 초 연주 뒤 rest 초 쉼. 들머리·가게 거리 밝게, 숲길·사면 잔잔히, 능선·굼부리 비우고, 정상 높은 음, 밤 느리고 낮게, 불멍 기타
// 적 근처(tense): 낮은 반복 베이스 + 떨리는 감화음 + 둥둥 북. 적이 오면 MUSIC.fadeIn 초에 걸쳐 바뀌고,
// 사라지면 MUSIC.holdOut 초 뒤 MUSIC.fadeOut 초에 걸쳐 원래 음악으로
// 시계: 타이머 없음. Sound 의 스케줄러 하나가 tick(now) 를 부르고, 모든 음은 AudioContext 시계로 ahead 초 앞까지 잡아 둠 (프레임 상한과 무관)
// 동시에 울리는 음은 MUSIC.voices 개 안 (_room). 검사: tools/musicrun.js (OfflineAudioContext, clock 을 바꿔 끼움)
import { MUSIC, SEASON } from './balance.js';
import { hz, degMidi, pickFrag, PROGS, playNote, playPad, arpMidi } from './musiccalm.js';

const T_BASS = [38, 38, 41, 38, 38, 44, 38, 37]; // 8분음표 한 마디
const T_PAD = [[50, 53, 56], [49, 53, 56]];
const MEL = [5, 6, 7, 8, 9, 10]; // 꽃·겨울 종이 쓰는 5음 음계 칸 (한 옥타브 위)

export class Music {
  constructor(ctx, out, noise) {
    this.c = ctx; this.noise = noise; this.clock = null;
    this.calm = ctx.createGain(); this.calm.gain.value = 1;
    this.tense = ctx.createGain(); this.tense.gain.value = 0;
    this.zoneG = ctx.createGain(); this.zoneG.connect(out); this.zoneLP = 1; // 구역마다 평소 음악 크기·밝기 (#136)
    this.sess = ctx.createGain(); this.sess.gain.value = 0; this.sess.connect(this.zoneG); // 연주·쉼 (#292)
    this.placeG = ctx.createGain(); this.placeG.gain.value = 1; this.placeG.connect(this.sess);
    this.calm.connect(this.placeG); this.tense.connect(out);
    // 패드 필터 (밤엔 더 어둡게)
    this.padLP = ctx.createBiquadFilter(); this.padLP.type = 'lowpass'; this.padLP.frequency.value = 900; this.padLP.Q.value = 0.3;
    this.padLP.connect(this.calm);
    // 메아리: 지연 + 낮은 통과 되먹임
    this.echo = ctx.createDelay(1.5); this.echo.delayTime.value = 0.48;
    const fb = ctx.createGain(); fb.gain.value = 0.33;
    const elp = ctx.createBiquadFilter(); elp.type = 'lowpass'; elp.frequency.value = 1800;
    this.echoWet = ctx.createGain(); this.echoWet.gain.value = MUSIC.calm.echo;
    this.echo.connect(elp); elp.connect(fb); fb.connect(this.echo); elp.connect(this.echoWet); this.echoWet.connect(this.calm);
    this.echoT = ctx.createGain(); this.echoT.gain.value = 0.3; elp.connect(this.echoT); this.echoT.connect(this.tense);
    // 긴장 패드: 떨림(LFO)
    this.trem = ctx.createGain(); this.trem.gain.value = 0.6;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.2; const lg = ctx.createGain(); lg.gain.value = 0.4;
    lfo.connect(lg); lg.connect(this.trem.gain); lfo.start();
    this.tLP = ctx.createBiquadFilter(); this.tLP.type = 'lowpass'; this.tLP.frequency.value = 850;
    this.trem.connect(this.tLP); this.tLP.connect(this.tense);

    this.mode = 'calm'; this.threat = false; this.lastThreat = -1e9; this.tenseUntil = 0;
    this.beatT = 0; this.step = 0; this.bar = 0;
    this.night = false; this.day = 1; this.active = false; this.swellUntil = 0; this.swellT = 0; this.swellI = 0;
    this.winter = false; this.bellT = 0; this.bellI = 0; // 겨울 판 (#180): 철 이벤트 기간에 종·방울 한 겹 (평소 음악 위)
    // 평소 음악 (#292)
    this.place = 'calm'; this.prof = 'calm'; this.barT = 0; this.barI = 0; this.prog = PROGS[0]; this.recent = []; this.lastDeg = null;
    this.playing = false; this.sessEnd = 0; this.restEnd = 0; this.vox = []; this.log = null; this.now = 0;
  }
  _now() { return this.clock ? this.clock() : this.c.currentTime; }
  setZone(vol = 1, lp = 1) { const t = this._now(); this.zoneLP = lp; this.zoneG.gain.setTargetAtTime(vol, t, 2); }
  _ramp(g, v, dur) {
    const p = g.gain, t = this._now();
    p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(v, t + dur);
  }
  // 동시에 울리는 음 (#292): [시작, 끝] 사이 어느 때든 n 개를 더해 voices 를 넘으면 false. 넘지 않으면 자리를 잡음
  _room(s, e, n = 1) {
    const V = this.vox, pts = [s];
    for (const v of V) if (v[0] > s && v[0] < e) pts.push(v[0]);
    for (const p of pts) { let k = n; for (const v of V) if (v[0] <= p && p < v[1]) k += v[2]; if (k > MUSIC.voices) return false; }
    V.push([s, e, n]); return true;
  }
  voices(t = this._now()) { let k = 0; for (const v of this.vox) if (v[0] <= t && t < v[1]) k += v[2]; return k; }
  _log(e) { if (this.log) this.log.push(e); }

  tick(now = this._now(), ahead = 1.2) {
    const c = this.c;
    if (!this.active || (!this.clock && c.state !== 'running')) return;
    this.now = now; const end = now + ahead;
    if (this.vox.length > 40 || (this.vox.length && this.vox[0][1] < now)) this.vox = this.vox.filter((v) => v[1] > now);
    if (this.threat) {
      this.lastThreat = now;
      if (this.mode === 'calm') {
        this.mode = 'tense'; this._ramp(this.calm, 0, MUSIC.fadeIn); this._ramp(this.tense, MUSIC.tense, MUSIC.fadeIn);
        this.beatT = now + 0.05; this.step = 0; this.bar = 0; this._log({ t: now, k: 'mode', v: 'tense' });
      }
    } else if (this.mode === 'tense' && now - this.lastThreat >= MUSIC.holdOut) {
      this.mode = 'calm'; this.tenseUntil = now + MUSIC.fadeOut;
      this._ramp(this.calm, 1, MUSIC.fadeOut); this._ramp(this.tense, 0, MUSIC.fadeOut); this._log({ t: now, k: 'mode', v: 'calm' });
    }
    this._session(now);
    if (this.mode === 'calm' || now < this.tenseUntil) {
      if (this.barT < now - 0.5) this.barT = now + 0.1;
      while (this.barT < end) this._bar(this.barT);
    }
    if (this.mode === 'calm') {
      if (this.winter) { if (this.bellT < now - 0.5) this.bellT = now + 1; while (this.bellT < end) this._bell(this.bellT); }
      if (now < this.swellUntil) { if (this.swellT < now - 0.5) this.swellT = now + 0.1; while (this.swellT < Math.min(end, this.swellUntil)) this._swell(this.swellT); }
    }
    if (this.mode === 'tense' || now < this.tenseUntil) {
      if (this.beatT < now - 0.5) { this.beatT = now + 0.05; this.step = 0; }
      while (this.beatT < end) this._beat(this.beatT);
    }
  }

  // ── 평소 (#292) ──
  // 연주 play 초 → 쉼 rest 초. 쉼에 들어가면 fade 초에 걸쳐 작아지고, 다시 시작하면 커짐
  _session(now) {
    const C = MUSIC.calm, P = C.play;
    if (!this.playing && now >= this.restEnd) {
      this.playing = true; this.sessEnd = now + P[0] + Math.random() * (P[1] - P[0]);
      const g = this.sess.gain; g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(1, now + C.fade);
      this.barT = Math.max(this.barT, now + 0.1); this.barI = 0; this._log({ t: now, k: 'play' });
    } else if (this.playing && now >= this.sessEnd && this.barI % 4 === 0) {
      this.playing = false; this.restEnd = now + C.rest;
      const g = this.sess.gain; g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0, now + C.fade);
      this._log({ t: now, k: 'rest' });
    }
  }
  // 지금 곳 (밤이면 밤, 불멍은 밤에도 불멍)
  _prof() { this.night = this.day < MUSIC.nightK; return this.place === 'fire' ? 'fire' : this.night ? 'night' : (MUSIC.calm.places[this.place] ? this.place : 'calm'); }
  _bar(t) {
    const C = MUSIC.calm, name = this._prof(), P = C.places[name], c = this.c;
    const e8 = 30 / P.bpm, len = e8 * 8;
    if (name !== this.prof) { this.prof = name; this._log({ t, k: 'place', v: name }); }
    this.placeG.gain.setTargetAtTime(P.vol, t, 1.5);
    this.padLP.frequency.setTargetAtTime(900 * P.lp * this.zoneLP, t, 2);
    this.echo.delayTime.setTargetAtTime(Math.min(1.4, e8 * (name === 'night' ? 3 : 2)), t, 1);
    if (!this.playing) { this.barT = t + len; return; } /* 쉼: 마디만 넘김 */
    const k = this.barI % 4; if (k === 0) this.prog = PROGS[Math.floor(Math.random() * PROGS.length)];
    const ch = this.prog[k];
    // 패드: 베이스 + 위 음 하나 (밤·불멍은 한 옥타브 내림 없이 그대로 낮음)
    if (P.pad > 0.01) for (const [m, v] of [[ch[0], 0.065], [ch[1] - (name === 'night' ? 12 : 0), 0.04]]) {
      const pe = t + len + 1.6; if (this._room(t, pe)) playPad(c, hz(m), t, len, v * P.pad, this.padLP);
    }
    const mel = [];
    if (P.arp) { for (let i = 0; i < 8; i++) if (i === 0 || Math.random() > P.drop) mel.push([i, arpMidi(ch, i) + P.oct + 12]); this._log({ t, k: 'bar', id: 'arp', ch: ch[0] }); }
    else if (k === 3 || Math.random() < P.fill) {
      const [id, f] = pickFrag(this.recent, this.lastDeg, k === 3);
      const sh = Math.random() < 0.25 ? (Math.random() < 0.5 ? -1 : 1) : 0;
      this.recent.push(id); if (this.recent.length > 3) this.recent.shift();
      let first = true;
      f.forEach((d, i) => { if (d == null) return; const dd = Math.max(0, Math.min(10, d + (k === 3 ? 0 : sh))); if (first || Math.random() > P.drop) { mel.push([i, degMidi(dd) + P.oct]); this.lastDeg = dd; } first = false; });
      this._log({ t, k: 'bar', id: id + (sh ? (sh > 0 ? '+' : '-') : ''), ch: ch[0] });
    } else this._log({ t, k: 'bar', id: '-', ch: ch[0] });
    for (const [i, m] of mel) {
      const tt = t + i * e8 + (i ? (Math.random() - 0.5) * 0.02 : 0), v = (0.065 + Math.random() * 0.015) * (i === 0 ? 1.1 : 1);
      const dEnd = tt + (P.inst === 'bell' ? 2.6 : P.inst === 'kalimba' ? 1.7 : 1.4) * P.decay;
      if (!this._room(tt, dEnd)) continue;
      playNote(c, P.inst, hz(m), tt, v, P.decay, this.calm, this.echo);
      this._log({ t: tt, k: 'note', m });
    }
    this.barI++; this.barT = t + len;
  }

  // 꽃이 필 때 한 겹 더 (#89): 높은 종소리 아르페지오가 sec 초 동안 (끝 4초는 점점 작게)
  swell(sec) { const now = this._now(); this.swellUntil = Math.max(this.swellUntil, now + sec); }
  _swell(t) {
    const c = this.c, m = degMidi(MEL[(this.swellI++ * 2) % MEL.length] - (this.night ? 5 : 0));
    const fade = Math.max(0, Math.min(1, (this.swellUntil - t) / 4)), v = 0.03 * fade;
    if (v > 0.002 && this._room(t, t + 1.45)) {
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(m); o.connect(g); g.connect(this.calm); g.connect(this.echo); o.start(t); o.stop(t + 1.45);
    }
    this.swellT = t + (this.swellI % 4 === 0 ? 0.6 : 0.3);
  }

  // 겨울 판 (#180): 썰매 방울(잘게 떨리는 높은 소리 네 번) 또는 맑은 종(지금 화음 위 음 둘)
  _bell(t) {
    const c = this.c, W = SEASON.xmas.music, v = 0.05 * W.gain, mel = MEL.map((d) => degMidi(d - (this.night ? 5 : 0)));
    if (this.bellI++ % 3 !== 2) { // 방울
      for (let k = 0; k < 4; k++) {
        const tt = t + k * 0.11, n = c.createBufferSource(); n.buffer = this.noise;
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 6200 + Math.random() * 800; bp.Q.value = 9;
        const g = c.createGain(); g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(v * 0.9, tt + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.09);
        n.connect(bp); bp.connect(g); g.connect(this.calm); n.start(tt, Math.random() * 1.5); n.stop(tt + 0.1);
      }
    } else { // 종
      for (const [m, dt] of [[mel[(this.bellI * 2) % mel.length] + 12, 0], [mel[(this.bellI * 2 + 2) % mel.length] + 12, 0.32]]) {
        const tt = t + dt; if (!this._room(tt, tt + 2.3)) continue;
        const g = c.createGain(); g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(v * 0.7, tt + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, tt + 2.2);
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = hz(m);
        const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = hz(m) * 2.76; const g2 = c.createGain(); g2.gain.value = 0.3; // 종 배음
        o.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.calm); g.connect(this.echo); o.start(tt); o2.start(tt); o.stop(tt + 2.3); o2.stop(tt + 2.3);
      }
    }
    const [a, b] = W.bell; this.bellT = t + a + Math.random() * (b - a);
  }

  // ── 적 근처 ──
  _beat(t) {
    const c = this.c, e8 = 30 / MUSIC.bpm, s = this.step % 8;
    // 베이스
    const f = hz(T_BASS[s]), room = (a, b, n = 1) => this._room(a, b, n);
    if (room(t, t + e8)) {
      const bo = c.createOscillator(); bo.type = 'triangle'; bo.frequency.value = f;
      const blp = c.createBiquadFilter(); blp.type = 'lowpass'; blp.frequency.value = 520;
      const bg = c.createGain(); bg.gain.setValueAtTime(0.0001, t); bg.gain.linearRampToValueAtTime(s === 0 ? 0.16 : 0.11, t + 0.012); bg.gain.exponentialRampToValueAtTime(0.0001, t + e8 * 0.95);
      bo.connect(blp); blp.connect(bg); bg.connect(this.tense); bo.start(t); bo.stop(t + e8); }
    /* 긴장 음도 자리를 잡고, 넘치면(바뀌는 사이 평소 음이 아직 울림) 건너뜀 */
    // 북: 1·3박 + 두 마디째 끝 당김
    if ((s === 0 || s === 4 || (s === 7 && this.bar % 2 === 1)) && room(t, t + 0.36)) {
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
      const len = e8 * 16, chord = T_PAD[(this.bar / 2) % 2];
      if (this.bar % 2 === 0 && room(t, t + len + 0.3, chord.length + 1)) {
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

  state() { return { mode: this.mode, threat: this.threat, night: this.night, active: this.active, calm: +this.calm.gain.value.toFixed(2), tense: +this.tense.gain.value.toFixed(2), place: this.place, prof: this.prof, playing: this.playing, sess: +this.sess.gain.value.toFixed(2), voices: this.voices(), rest: this.playing ? 0 : Math.max(0, Math.round(this.restEnd - this._now())) }; }
}
