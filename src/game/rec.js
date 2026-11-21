// 게임 안 촬영 모드 (#185): 플레이하면서 UI 없는 영상(릴스) 녹화
// - 게임 화면은 WebGL 캔버스, 버튼·위 줄은 그 위의 HTML. 캔버스만 녹화하므로 영상에는 게임 장면만 담김 (이름표·말풍선은 3D 스프라이트라 담김)
// - 세로 9:16: 숨은 2D 캔버스(REC.size)에 게임 캔버스 가운데를 잘라 매 프레임 그림(update.js 가 그린 바로 뒤 late.recFrame). 폰 세로 화면·'화면 그대로' 는 자르지 않음
// - 소리: 게임 WebAudio(sound.master)를 MediaStreamDestination 으로 같이 담음(설정에서 끔). 마이크는 쓰지 않음
// - 형식: MediaRecorder.isTypeSupported 로 REC.types 순서(mp4 → webm). 멈추면 파일 저장(폰은 공유 시트)
// - '방금 30초'(PC 만, 기본 끔): 두 녹화기를 REC.buf/2 씩 엇갈려 돌려, 누르면 더 오래 돈 쪽(buf/2~buf 초)을 저장
// - 녹화하지 않을 때는 숨은 캔버스·스트림을 만들지 않음
// 저장 save.rec = { on, shape: 'v'|'full', snd, wm, buf, lv, webm, tag }
import { REC } from '../balance.js';
import { TIER } from '../quality.js';
import { state, late } from './state.js';
import { $, isTouch, save, persist } from './save.js';
import { canvas } from './scene.js';
import { toast } from './hud.js';

const R = save.rec = Object.assign({ on: 0, shape: 'v', snd: 1, wm: 0, buf: 0, lv: 0, webm: 0, tag: 0 }, save.rec || {});
const can = typeof MediaRecorder !== 'undefined' && !!canvas.captureStream;
const TYPE = can ? REC.types.find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch (_) { return false; } }) || '' : '';
const EXT = /mp4/.test(TYPE) ? 'mp4' : 'webm';
const phone = isTouch || innerWidth <= 600;
let bufForce = false; // 검사용 (tools/rec.js: 헤드리스는 저사양이라)
const bufOk = () => can && (bufForce || (!phone && TIER > 0)); // '방금 30초' 는 PC 만 (녹화기 둘 → 인코딩 두 배)

const ui = { btn: $('rec-btn'), time: $('rec-time'), box: $('rec-ui'), clip: $('rec-clip'), frame: $('rec-frame'), ready: $('rec-ready'), msg: $('rec-msg'), tag: $('rec-tag'), share: $('rec-share'), dl: $('rec-dl'), x: $('rec-x'), menu: $('menu-rec'), shape: $('rec-shape'), snd: $('rec-snd'), wm: $('rec-wm'), buf: $('rec-buf') };

// ---------- 담는 캔버스 ----------
let cv = null, g = null, stream = null, audioDest = null, lv = Math.max(R.lv | 0, phone || TIER === 0 ? 1 : 0), lastDraw = 0;
const portraitScreen = () => innerHeight > innerWidth;
const crop = () => R.shape === 'v' && !portraitScreen();
function sizeFor(l) {
  const [w, h] = REC.size[Math.min(l, REC.size.length - 1)];
  if (crop()) return [w, h];
  // 자르지 않음: 화면 비율 그대로, 긴 변을 단계 크기에
  const sw = canvas.width || innerWidth, sh = canvas.height || innerHeight, long = h, k = long / Math.max(sw, sh);
  return [Math.round(sw * k / 2) * 2, Math.round(sh * k / 2) * 2];
}
function makeStream() {
  cv = document.createElement('canvas');
  [cv.width, cv.height] = sizeFor(lv);
  g = cv.getContext('2d', { alpha: false });
  stream = cv.captureStream(REC.fps);
  const snd = late.sound;
  if (R.snd && snd?.ctx && snd.master && snd.ctx.createMediaStreamDestination) {
    try { audioDest = snd.ctx.createMediaStreamDestination(); snd.master.connect(audioDest); for (const t of audioDest.stream.getAudioTracks()) stream.addTrack(t); } catch (_) { audioDest = null; }
  }
  draw(true);
}
function dropStream() {
  if (audioDest) { try { late.sound.master.disconnect(audioDest); } catch (_) {} audioDest = null; }
  stream?.getTracks().forEach((t) => t.stop());
  stream = null; cv = null; g = null;
}
function draw(force) {
  if (!g) return;
  const now = performance.now();
  if (!force && now - lastDraw < 1000 / REC.fps - 4) return; // 30fps 로 충분 (게임이 60 이어도)
  lastDraw = now;
  const sw = canvas.width, sh = canvas.height, W = cv.width, H = cv.height;
  if (!sw || !sh) return;
  let sx = 0, sy = 0, cw = sw, ch = sh;
  const want = W / H;
  if (sw / sh > want) { cw = sh * want; sx = (sw - cw) / 2; } else { ch = sw / want; sy = (sh - ch) / 2; } // 가운데 자르기 (캐릭터가 늘 가운데)
  try { g.drawImage(canvas, sx, sy, cw, ch, 0, 0, W, H); } catch (_) { return; }
  if (R.wm) mark(W, H);
}
function mark(W, H) { // 오른쪽 아래 작은 로고 글자
  const s = H / 1920, fs = Math.round(40 * s), pad = Math.round(36 * s);
  g.save(); g.font = `800 ${fs}px "Gothic A1", sans-serif`; g.textAlign = 'right'; g.textBaseline = 'bottom';
  const t = '오름오름', w = g.measureText(t).width, x = W - pad, y = H - pad;
  g.globalAlpha = 0.85; g.fillStyle = 'rgba(20,20,24,.45)'; g.beginPath(); g.roundRect?.(x - w - fs * 0.9, y - fs * 1.35, w + fs * 1.3, fs * 1.55, fs * 0.5); g.fill();
  g.fillStyle = '#ff9a1f'; g.beginPath(); g.arc(x - w - fs * 0.42, y - fs * 0.58, fs * 0.22, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.fillText(t, x - fs * 0.2, y - fs * 0.12); g.restore();
}

// ---------- 녹화기 ----------
function newRec() {
  const opts = { videoBitsPerSecond: REC.bps[Math.min(lv, REC.bps.length - 1)], audioBitsPerSecond: 128000 };
  if (TYPE) opts.mimeType = TYPE;
  const mr = new MediaRecorder(stream, opts), parts = [];
  mr.ondataavailable = (e) => { if (e.data?.size) parts.push(e.data); };
  const rec = { mr, parts, t0: performance.now(), done: null, w: cv.width, h: cv.height };
  rec.done = new Promise((res) => { mr.onstop = () => res(new Blob(parts, { type: (TYPE || 'video/webm').split(';')[0] })); });
  mr.start(1000);
  return rec;
}
const S = { main: null, bufs: [], swapT: 0, marks: 0, fpsLow: 0, frames: 0, fpsT: 0, last: null };

function start() {
  if (!can) { toast('이 브라우저는 녹화를 할 수 없어요', 3); return false; }
  if (S.main) return true;
  if (!stream) makeStream();
  try { S.main = newRec(); } catch (e) { toast('녹화를 시작할 수 없어요', 3); if (!S.bufs.length) dropStream(); return false; }
  S.marks = 0; S.fpsLow = 0; S.frames = 0; S.fpsT = performance.now();
  sync();
  if (EXT === 'webm' && !R.webm) { R.webm = 1; persist(); toast('webm 으로 저장돼요. 인스타에 올리려면 mp4 로 바꿔야 할 수 있어요', 5); }
  return true;
}
async function stop() {
  const r = S.main; if (!r) return;
  S.main = null; sync();
  try { r.mr.state !== 'inactive' && r.mr.stop(); } catch (_) {}
  const blob = await r.done;
  if (!S.bufs.length) dropStream();
  done(blob, (performance.now() - r.t0) / 1000, r);
}
export function toggleRec() { if (!R.on) setOn(true); return S.main ? (stop(), false) : start(); }

// '방금 30초': 둘을 buf/2 씩 엇갈려 돌림. 각자 buf 초가 되면 새로 시작
function bufTick(now) {
  if (!(R.on && R.buf && bufOk())) { if (S.bufs.length) bufStop(); return; }
  if (!stream) makeStream();
  const half = REC.buf * 500;
  if (!S.bufs.length) { try { S.bufs = [newRec()]; S.swapT = now + half; } catch (_) { R.buf = 0; return; } }
  if (S.bufs.length === 1 && now >= S.swapT) { try { S.bufs.push(newRec()); } catch (_) {} }
  for (let i = 0; i < S.bufs.length; i++) {
    const b = S.bufs[i];
    if (now - b.t0 >= REC.buf * 1000) { try { b.mr.stop(); } catch (_) {} S.bufs[i] = newRec(); }
  }
}
function bufStop() { for (const b of S.bufs) { try { b.mr.stop(); } catch (_) {} } S.bufs = []; if (!S.main) dropStream(); }
async function saveClip() {
  if (!S.bufs.length) return;
  const old = S.bufs.reduce((a, b) => (b.t0 < a.t0 ? b : a));
  const i = S.bufs.indexOf(old), sec = (performance.now() - old.t0) / 1000;
  try { old.mr.stop(); } catch (_) {}
  try { S.bufs[i] = newRec(); } catch (_) { S.bufs.splice(i, 1); }
  done(await old.done, sec, old);
}

// ---------- 끝내기: 파일 저장 / 공유 ----------
const pad2 = (n) => String(n).padStart(2, '0');
function fileName() { const d = new Date(); return `오름오름-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}.${EXT}`; }
function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
let pending = null;
function done(blob, sec, r) {
  S.last = { size: blob.size, type: blob.type, sec, ext: EXT, w: r.w, h: r.h }; S.blob = blob; // blob 은 검사용(tools/rec.js)
  if (!blob.size) { toast('영상이 비었어요', 3); return; }
  const name = fileName(), file = typeof File !== 'undefined' ? new File([blob], name, { type: blob.type }) : null;
  let shareOk = false; try { shareOk = !!(isTouch && file && navigator.canShare?.({ files: [file] })); } catch (_) {}
  const first = !R.tag;
  if (first) { R.tag = 1; persist(); }
  if (!shareOk && !first) { download(blob, name); toast(`영상 저장: ${name}`, 3); return; }
  // 폰(공유 되는 곳) 또는 처음 저장: 작은 창 (공유는 누른 순간에만 열 수 있음)
  pending = { blob, name, file };
  ui.msg.textContent = `영상이 준비됐어요 · ${Math.round(sec)}초`;
  ui.tag.hidden = !first; ui.tag.textContent = `${REC.tag} 으로 올려 주세요`;
  ui.share.hidden = !shareOk; ui.ready.hidden = false;
  if (!shareOk) { download(blob, name); ui.msg.textContent = `영상을 저장했어요 · ${Math.round(sec)}초`; ui.dl.hidden = true; } else ui.dl.hidden = false;
}
ui.share.addEventListener('click', async () => {
  if (!pending) return;
  try { await navigator.share({ files: [pending.file], title: '오름오름', text: REC.tag }); closeReady(); }
  catch (e) { if (e?.name !== 'AbortError') { download(pending.blob, pending.name); closeReady(); } }
});
ui.dl.addEventListener('click', () => { if (pending) download(pending.blob, pending.name); closeReady(); });
ui.x.addEventListener('click', closeReady);
function closeReady() { ui.ready.hidden = true; ui.dl.hidden = false; pending = null; }

// ---------- 매 프레임 (update.js 가 그린 바로 뒤) ----------
function tick() {
  const now = performance.now();
  bufTick(now);
  if (!stream) return;
  draw(false);
  const r = S.main; if (!r) return;
  const sec = (now - r.t0) / 1000;
  ui.time.textContent = `${Math.floor(sec / 60)}:${pad2(Math.floor(sec % 60))}`;
  if (S.marks < REC.marks.length && sec >= REC.marks[S.marks]) { cue(REC.marks[S.marks]); S.marks++; }
  if (sec >= REC.maxSec) { toast(`${REC.maxSec / 60}분이 되어 녹화를 멈췄어요`, 3); stop(); return; }
  // 프레임이 크게 떨어지면 한 단계 낮춤 (다음 녹화도 그 단계부터)
  S.frames++;
  if (now - S.fpsT >= 1000) {
    const fps = S.frames * 1000 / (now - S.fpsT); S.frames = 0; S.fpsT = now;
    S.fpsLow = fps < REC.dropFps ? S.fpsLow + 1 : 0;
    if (S.fpsLow >= REC.dropSec && lv < REC.size.length - 1) { lv++; R.lv = lv; persist(); S.fpsLow = 0; [cv.width, cv.height] = sizeFor(lv); toast('녹화 화질을 한 단계 낮췄어요', 2.5); }
  }
}
late.recFrame = tick;
function cue(s) { // 진동 + 작은 소리 (스피커로만, 영상엔 안 담김)
  try { navigator.vibrate?.(80); } catch (_) {}
  const c = late.sound?.ctx;
  if (c) { try { const o = c.createOscillator(), gg = c.createGain(), t = c.currentTime; o.frequency.value = 880; gg.gain.setValueAtTime(0.06, t); gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); o.connect(gg); gg.connect(c.destination); o.start(t); o.stop(t + 0.2); } catch (_) {} }
  toast(`${s}초`, 1.2);
}

// ---------- 화면·메뉴 ----------
function sync() {
  const rec = !!S.main;
  ui.box.hidden = !R.on; ui.btn.classList.toggle('on', rec);
  ui.btn.setAttribute('aria-label', rec ? '녹화 멈춤 (V)' : '녹화 시작 (V)');
  if (!rec) ui.time.textContent = '';
  ui.clip.hidden = !(R.on && R.buf && bufOk());
  ui.frame.hidden = !(rec && crop());
  ui.menu.setAttribute('aria-pressed', String(!!R.on)); ui.menu.textContent = `촬영: ${R.on ? '켬' : '끔'}`;
  for (const k of ['shape', 'snd', 'wm', 'buf']) ui[k].hidden = !R.on;
  if (!bufOk()) ui.buf.hidden = true;
  ui.shape.textContent = `영상: ${R.shape === 'v' ? '세로 9:16' : '화면 그대로'}`;
  ui.snd.textContent = `영상 소리: ${R.snd ? '켬' : '끔'}`; ui.snd.setAttribute('aria-pressed', String(!!R.snd));
  ui.wm.textContent = `로고: ${R.wm ? '켬' : '끔'}`; ui.wm.setAttribute('aria-pressed', String(!!R.wm));
  ui.buf.textContent = `방금 ${REC.buf}초: ${R.buf ? '켬' : '끔'}`; ui.buf.setAttribute('aria-pressed', String(!!R.buf));
}
function setOn(on) {
  if (on && !can) { toast('이 브라우저는 녹화를 할 수 없어요', 3); return; }
  R.on = on ? 1 : 0; persist();
  if (!on) { if (S.main) stop(); bufStop(); }
  else toast('빨간 점을 누르면 녹화 · 버튼은 영상에 안 찍혀요', 3.5);
  sync();
}
ui.menu.addEventListener('click', () => setOn(!R.on));
ui.shape.addEventListener('click', () => { R.shape = R.shape === 'v' ? 'full' : 'v'; persist(); sync(); if (S.main) toast('다음 녹화부터 바뀌어요', 2); });
ui.snd.addEventListener('click', () => { R.snd = R.snd ? 0 : 1; persist(); sync(); if (S.main) toast('다음 녹화부터 바뀌어요', 2); });
ui.wm.addEventListener('click', () => { R.wm = R.wm ? 0 : 1; persist(); sync(); });
ui.buf.addEventListener('click', () => { R.buf = R.buf ? 0 : 1; persist(); if (!R.buf) bufStop(); sync(); });
ui.btn.addEventListener('click', () => toggleRec());
ui.clip.addEventListener('click', () => saveClip());
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyV' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (!R.on) return; // 촬영 모드를 켠 사람만
  toggleRec();
});
addEventListener('resize', sync); // 돌리면 안내선(세로 화면이면 없음)
document.addEventListener('visibilitychange', () => { if (document.hidden && S.main) stop(); }); // 백그라운드로 가면 멈추고 저장
if (!can) ui.menu.title = '이 브라우저는 녹화를 할 수 없어요';
sync();

state.rec = { get on() { return !!R.on; }, get recording() { return !!S.main; } };
export const recInfo = () => ({ can, type: TYPE, ext: EXT, on: !!R.on, recording: !!S.main, buf: S.bufs.length, lv, size: cv ? [cv.width, cv.height] : null, audio: !!audioDest, last: S.last });
export const recApi = { info: recInfo, blob: () => S.blob, forceBuf: (v = true) => { bufForce = v; sync(); }, on: setOn, start, stop, toggle: toggleRec, clip: saveClip, set: (k, v) => { R[k] = v; persist(); sync(); } };
