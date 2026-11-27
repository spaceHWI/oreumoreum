// 바람·음악 검사 (#292): OfflineAudioContext 로 30초씩 그려 소리 크기(RMS)·최고값·2kHz 위 에너지 비율을 앞뒤로 재고,
// 곳·밤·싸움 전환·연주와 쉼·동시에 울리는 음 수·가락이 되풀이되지 않는지 봄. 본보기 wav 둘을 notes/sounds/ 에 씀
//   node tools/musicrun.js          (wav 도 씀)
//   node tools/musicrun.js nowav    (재기만)
// '앞' 은 #292 전 코드: 바람은 이 파일 안 OLD_WIND(그때 audio.js _wind·_gusts 그대로), 음악은 git 의 #292 전 music.js (없으면 건너뜀)
const { chromium } = require('playwright');
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BEFORE = '405a837'; // #292 전 dev
const NOWAV = process.argv.includes('nowav');
const SR = 22050, SEC = 30;

function bundle() {
  const entry = `import { Music } from './src/music.js'; import { Wind } from './src/wind.js'; import { MUSIC, WIND, ZONE_LOOK } from './src/balance.js'; window.K = { Music, Wind, MUSIC, WIND, ZONE_LOOK };`;
  const r = esbuild.buildSync({ stdin: { contents: entry, resolveDir: ROOT, loader: 'js' }, bundle: true, format: 'iife', write: false, logLevel: 'silent' });
  let old = '';
  try {
    let src = execSync(`git show ${BEFORE}:src/music.js`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    src = src.replace(/import \{ MUSIC, SEASON \} from '\.\/balance\.js';/, `const MUSIC = { gain: 0.6, tense: 1.6, vol: 0.6, fadeIn: 2.5, holdOut: 5, fadeOut: 4, nightK: 0.35, chord: { day: 9, night: 12 }, note: { day: [2.5, 6], night: [4, 9] }, bpm: 92 }; const SEASON = { xmas: { music: { gain: 0.5, bell: [2, 5] } } };`).replace('export class Music', 'class OldMusic') + '\nwindow.OldMusic = OldMusic;';
    old = esbuild.transformSync(src, { loader: 'js' }).code;
  } catch (_) { old = ''; }
  return r.outputFiles[0].text + '\n' + old;
}

// 페이지 안에서 도는 쪽 (문자열로 넘김)
const PAGE = String.raw`
window.noiseBuf = (c) => { const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; };
// 소리를 ch0 그대로, ch1 은 2kHz 위만(하이패스 두 겹) 으로 그려 둘을 잼
window.measure = (buf, from = 0) => {
  const a = buf.getChannelData(0), h = buf.getChannelData(1), i0 = Math.floor(from * buf.sampleRate);
  let s = 0, sh = 0, pk = 0; for (let i = i0; i < a.length; i++) { s += a[i] * a[i]; sh += h[i] * h[i]; pk = Math.max(pk, Math.abs(a[i])); }
  const n = a.length - i0; return { rms: +Math.sqrt(s / n).toFixed(5), peak: +pk.toFixed(4), hi: +(sh / (s || 1)).toFixed(4) };
};
window.rig = (c) => {
  const out = c.createGain(), m = c.createChannelMerger(2), hp1 = c.createBiquadFilter(), hp2 = c.createBiquadFilter();
  hp1.type = hp2.type = 'highpass'; hp1.frequency.value = hp2.frequency.value = 2000;
  out.connect(m, 0, 0); out.connect(hp1); hp1.connect(hp2); hp2.connect(m, 0, 1); m.connect(c.destination); return out;
};
// #292 전 바람 (audio.js _wind·_gusts 그대로, 빗소리는 0 이라 뺌)
window.OLD_WIND = (c, out, noise, T) => {
  const src = () => { const s = c.createBufferSource(); s.buffer = noise; s.loop = true; return s; };
  const s1 = src(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
  const g1 = c.createGain(); g1.gain.value = 0.16; const lfo = c.createOscillator(); lfo.frequency.value = 0.07; const lg = c.createGain(); lg.gain.value = 0.1; lfo.connect(lg); lg.connect(g1.gain);
  s1.connect(lp); lp.connect(g1); g1.connect(out);
  const s2 = src(), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 4200; bp.Q.value = 0.8;
  const g2 = c.createGain(); g2.gain.value = 0.02; const lfo2 = c.createOscillator(); lfo2.frequency.value = 0.13; const lg2 = c.createGain(); lg2.gain.value = 0.018; lfo2.connect(lg2); lg2.connect(g2.gain);
  s2.connect(bp); bp.connect(g2); g2.connect(out);
  [s1, s2, lfo, lfo2].forEach((n) => n.start());
  for (let t = 6 + Math.random() * 12; t < T; t += 6 + Math.random() * 12) { const up = 1.5 + Math.random() * 2; lp.frequency.setValueAtTime(380, t); lp.frequency.linearRampToValueAtTime(760, t + up); lp.frequency.linearRampToValueAtTime(380, t + up + 3 + Math.random() * 3); }
};
// 새 바람·음악을 시계를 바꿔 끼워 T 초까지 미리 잡음. ev: [[초, fn(music, wind)]]
window.drive = (c, music, wind, T, ev = []) => {
  let sim = 0; if (music) music.clock = () => sim;
  const list = ev.slice().sort((a, b) => a[0] - b[0]); let k = 0, maxV = 0;
  for (sim = 0; sim < T; sim += 0.2) {
    while (k < list.length && list[k][0] <= sim) list[k++][1](music, wind, sim);
    wind?.tick(sim); if (music) { music.tick(sim); for (let t = sim; t < sim + 1.2; t += 0.05) maxV = Math.max(maxV, music.voices(t)); }
  }
  return maxV;
};
window.wav = (buf) => { const d = buf.getChannelData(0), n = d.length, ab = new ArrayBuffer(44 + n * 2), v = new DataView(ab);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
  let s = ''; const u = new Uint8Array(ab); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
`;

(async () => {
  const code = bundle();
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.setContent('<html><body></body></html>');
  await p.addScriptTag({ content: PAGE + '\n' + code });
  const fails = [];
  const ok = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) fails.push(msg); };

  // ---- 1. 바람 앞뒤 (구역 배율 1, 30초) ----
  const wind = await p.evaluate(async ({ SR, SEC }) => {
    const r = {};
    { const c = new OfflineAudioContext(2, SR * SEC, SR), o = rig(c), m = c.createGain(); m.gain.value = 0.9; m.connect(o); OLD_WIND(c, m, noiseBuf(c), SEC); r.before = measure(await c.startRendering(), 2); }
    for (const [k, z, top, rain] of [['after', 1, 0, 0], ['ridge', K.ZONE_LOOK.wind[5], 0, 0], ['top', K.ZONE_LOOK.wind[5], 1, 0], ['rain', 1, 0, 1]]) {
      const c = new OfflineAudioContext(2, SR * SEC, SR), o = rig(c), m = c.createGain(); m.gain.value = 0.9; m.connect(o);
      const w = new K.Wind(c, m, noiseBuf(c), false); w.setZone(z, 1, 0); w.setTop(top, 0);
      drive(c, null, w, SEC); if (rain) w.setRain(1, 0); r[k] = measure(await c.startRendering(), 2);
      if (k === 'after') r.gusts = w.gustT > 0;
    }
    return r;
  }, { SR, SEC });
  console.log('바람 앞', JSON.stringify(wind.before), '· 뒤', JSON.stringify(wind.after), '· 굼부리', JSON.stringify(wind.ridge), '· 정상', JSON.stringify(wind.top), '· 비', JSON.stringify(wind.rain));
  ok(wind.after.rms < wind.before.rms * 0.5, `바람 평소 크기 절반 아래 (${wind.after.rms} < ${(wind.before.rms * 0.5).toFixed(5)})`);
  ok(wind.after.hi < 0.02 && wind.after.hi < wind.before.hi / 5, `바람 2kHz 위 비율 (${wind.before.hi} → ${wind.after.hi})`);
  ok(wind.top.rms > wind.after.rms && wind.top.rms < wind.before.rms, `정상은 조금 더 (${wind.top.rms})`);
  ok(wind.rain.rms > wind.after.rms, `비 오는 날 조금 더 (${wind.rain.rms})`);

  // ---- 2. 음악: 낮 숲길·밤 30초 (+ 앞 음악) ----
  const mus = await p.evaluate(async ({ SR, SEC, NOWAV }) => {
    const r = {};
    const one = async (opt) => {
      const c = new OfflineAudioContext(2, SR * SEC, SR), o = rig(c), noise = noiseBuf(c);
      const master = c.createGain(); master.gain.value = 0.9; master.connect(o);
      const bus = c.createGain(); bus.gain.value = K.MUSIC.gain * K.MUSIC.vol * K.MUSIC.vol; bus.connect(master);
      const music = new K.Music(c, bus, noise); music.active = true; music.day = opt.day; music.place = opt.place;
      let w = null; if (opt.wind) { const wg = c.createGain(); wg.connect(master); w = new K.Wind(c, wg, noise, false); w.setZone(1, 1, 0); }
      const maxV = drive(c, music, w, SEC);
      const buf = await c.startRendering(), m = measure(buf, 5);
      return { ...m, maxV, bars: music.log ? 0 : music.barI, prof: music.prof, wav: opt.wav && !NOWAV ? wav(buf) : null };
    };
    r.day = await one({ day: 1, place: 'calm' }); r.night = await one({ day: 0.1, place: 'calm' });
    r.dayMix = await one({ day: 1, place: 'calm', wind: true, wav: 1 }); r.nightMix = await one({ day: 0.1, place: 'calm', wind: true, wav: 1 });
    if (window.OldMusic) {
      // 앞 음악: 시계(currentTime)·상태를 바꿔 끼운 ctx 로 미리 잡음
      const c = new OfflineAudioContext(2, SR * SEC, SR), o = rig(c), noise = noiseBuf(c);
      const master = c.createGain(); master.gain.value = 0.9; master.connect(o);
      const bus = c.createGain(); bus.gain.value = 0.6 * 0.6 * 0.6; bus.connect(master);
      let sim = 0; const px = new Proxy(c, { get: (t, k) => (k === 'currentTime' ? sim : k === 'state' ? 'running' : typeof t[k] === 'function' ? t[k].bind(t) : t[k]) });
      const om = new OldMusic(px, bus, noise); clearInterval(om._iv); om.active = true; om.day = 1;
      for (sim = 0; sim < SEC; sim += 0.2) om.tick();
      r.before = measure(await c.startRendering(), 5);
    }
    return r;
  }, { SR, SEC, NOWAV });
  for (const k of ['before', 'day', 'night']) if (mus[k]) console.log('음악', k, JSON.stringify({ rms: mus[k].rms, peak: mus[k].peak, hi: mus[k].hi, maxV: mus[k].maxV, prof: mus[k].prof }));
  ok(mus.day.rms > 0.002 && mus.day.peak < 0.5, `낮 숲길 음악 소리 남 (rms ${mus.day.rms}, 최고 ${mus.day.peak})`);
  ok(mus.night.rms > 0.001 && mus.night.prof === 'night', `밤 음악 (rms ${mus.night.rms}, ${mus.night.prof})`);
  ok(mus.night.hi <= mus.day.hi + 0.01, `밤은 더 어둡게 (2kHz 위 ${mus.day.hi} → ${mus.night.hi})`);
  ok(Math.max(mus.day.maxV, mus.night.maxV) <= 8, `동시에 울리는 음 8개 안 (낮 ${mus.day.maxV}, 밤 ${mus.night.maxV})`);
  if (mus.before) ok(mus.day.rms < mus.before.rms, `기본 음악 크기 작게 (앞 ${mus.before.rms} → 뒤 ${mus.day.rms})`);
  if (!NOWAV) {
    const dir = path.join(ROOT, 'notes/sounds'); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'day-forest.wav'), Buffer.from(mus.dayMix.wav, 'base64'));
    fs.writeFileSync(path.join(dir, 'night.wav'), Buffer.from(mus.nightMix.wav, 'base64'));
    console.log('wav: notes/sounds/day-forest.wav, notes/sounds/night.wav');
  }

  // ---- 3. 전환·연주와 쉼·가락 (그리지 않고 잡기만, 420초) ----
  const tr = await p.evaluate(() => {
    const c = new OfflineAudioContext(1, 8000, 8000), music = new K.Music(c, c.destination, noiseBuf(c)); music.active = true; music.log = [];
    const set = (k, v) => (m) => { m[k] = v; };
    const maxV = drive(c, music, null, 420, [[0, set('place', 'bright')], [20, set('place', 'calm')], [40, set('place', 'sparse')], [60, set('place', 'top')], [80, set('place', 'fire')], [100, set('place', 'calm')],
      [110, set('day', 0.1)], [130, set('day', 1)], [140, set('threat', true)], [155, set('threat', false)]]);
    const L = music.log, bars = L.filter((e) => e.k === 'bar');
    const barLen = (a, b) => { const x = bars.filter((e) => e.t >= a && e.t < b); return x.length > 1 ? +((x[x.length - 1].t - x[0].t) / (x.length - 1)).toFixed(3) : 0; };
    const places = L.filter((e) => e.k === 'place').map((e) => e.v + '@' + Math.round(e.t));
    const modes = L.filter((e) => e.k === 'mode').map((e) => ({ v: e.v, t: +e.t.toFixed(1) }));
    const sess = L.filter((e) => e.k === 'play' || e.k === 'rest').map((e) => ({ k: e.k, t: Math.round(e.t) }));
    // 되풀이: 4마디 묶음이 바로 앞 묶음과 똑같은 적
    const ids = bars.filter((e) => e.id !== 'arp').map((e) => e.id); let rep = 0; for (let i = 8; i <= ids.length; i += 4) if (ids.slice(i - 4, i).join() === ids.slice(i - 8, i - 4).join()) rep++;
    const frags = new Set(ids.filter((x) => x !== '-').map((x) => x.replace(/[+-]$/, '')));
    return { maxV, places, modes, sess, rep, frags: frags.size, groups: Math.floor(ids.length / 4), len: { bright: barLen(2, 18), calm: barLen(22, 38), sparse: barLen(42, 58), night: barLen(113, 128), fire: barLen(82, 98) }, back: music.tenseUntil };
  });
  console.log('전환', JSON.stringify(tr));
  const want = (bpm) => +(8 * 30 / bpm).toFixed(3), P = (await p.evaluate(() => K.MUSIC.calm.places));
  for (const k of ['bright', 'calm', 'sparse', 'night', 'fire']) ok(Math.abs(tr.len[k] - want(P[k].bpm)) < 0.02, `${k} 빠르기 ${P[k].bpm} (마디 ${tr.len[k]}초)`);
  ok(['bright', 'calm', 'sparse', 'top', 'fire', 'night'].every((k) => tr.places.some((x) => x.startsWith(k + '@'))), `곳 바뀜: ${tr.places.join(' ')}`);
  const tense = tr.modes.find((m) => m.v === 'tense'), calm = tr.modes.find((m) => m.v === 'calm');
  ok(tense && tense.t >= 140 && tense.t < 141, `싸움 음악으로 (${tense?.t}초)`);
  ok(calm && calm.t >= 160 && calm.t < 161 && Math.abs(tr.back - calm.t - 3) < 0.01, `싸움 끝나고 5초 뒤 3초에 걸쳐 돌아옴 (${calm?.t}초)`);
  const rest = tr.sess.find((s) => s.k === 'rest'), again = tr.sess.filter((s) => s.k === 'play')[1];
  ok(rest && rest.t >= 120 && rest.t <= 190, `2~3분 연주하고 쉼 (${rest?.t}초)`);
  ok(again && rest && Math.abs(again.t - rest.t - 60) <= 1, `1분 쉬고 다시 (${again?.t}초)`);
  ok(tr.rep === 0 && tr.frags >= 8, `같은 4마디가 이어 되풀이되지 않음 (되풀이 ${tr.rep}/${tr.groups}, 조각 ${tr.frags}개)`);
  ok(tr.maxV <= 8, `동시에 울리는 음 8개 안 (싸움 전환 포함 ${tr.maxV})`);
  // ---- 4. 가락 없이 맺는 마디만 이어질 때 (#321): 가락이 한 번도 안 뽑히게 하고 100초 ----
  const cad = await p.evaluate(() => {
    const c = new OfflineAudioContext(1, 8000, 8000), music = new K.Music(c, c.destination, noiseBuf(c)); music.active = true; music.log = []; music.place = 'top';
    const rnd = Math.random; Math.random = () => 0.99; let err = '';
    try { drive(c, music, null, 100); } catch (e) { err = e.message; } finally { Math.random = rnd; }
    const ids = music.log.filter((e) => e.k === 'bar').map((e) => e.id);
    return { err, bars: ids.length, cads: ids.filter((x) => x[0] === 'c'), frags: ids.filter((x) => x[0] === 'f').length };
  });
  const cadRep = cad.cads.some((x, i) => i && x === cad.cads[i - 1]);
  ok(!cad.err && cad.cads.length >= 5 && cad.frags === 0 && !cadRep, `맺는 마디만 이어져도 멈추지 않음 (마디 ${cad.bars}, 맺음 ${cad.cads.join(' ')}${cad.err ? ', ' + cad.err : ''})`);
  ok(!errs.length, `페이지 오류 없음 ${errs.slice(0, 2).join(' | ')}`);
  await b.close();
  console.log(fails.length ? `실패 ${fails.length}` : '모두 통과');
  process.exit(fails.length ? 1 : 0);
})();
