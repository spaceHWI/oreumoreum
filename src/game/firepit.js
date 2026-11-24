// 숙소 오피스제주 마당 불멍 (#290). 화로 모양은 src/firepit.js (src/inn.js 가 옆마당에 세움), 수치는 balance.js INN.fire. 파일 순서는 game/inn.js 뒤 (src/modules.js)
// - 화로: 숙소가 닫혀 있으면(능선 전·Lv 8 전) 덮개. 열려 있으면 해 질 무렵(lampNight > litNight)부터 불, 낮에도 누가 앉으면 붙고 잠깐 더 탐. 불빛·불티·타닥 소리(가까울수록 큼)
// - [불멍] 의자에 앉아(pose 'sit', 손 쬐기 'warm') INN.fire.sit 초 → 버프 '멍' buffSec 초. 중간에 일어나면(일어나기·움직이기) 버프 없음. 무료, 하루 perDay 번
//   앉은 동안 화면 가장자리가 어두워지고 UI 가 옅어짐(body.mung), 가끔 한 줄 혼잣말(punktext.js MUTTER_TEXT fire1~fire8, mutter 의 line)
//   남도 앉은 모습(room.js innExtra mf = 의자 번호 + 1 → innPeer 'warm'). 남이 둘레 pairR 안 의자에 앉아 있으면 버프 + pair 초
// - '멍': 귤 모으는 범위(hooks.js pickR2)·드문 쓰레기(place.js rareMul)·쓰러졌을 때 대기(hp.js waitMul)·밤·안개 시야(scene.js applySky) — late.fireMul(k)·late.fireSee(). 싸움 수치 없음
//   개운함·식사 버프와 같이 걸림. 위쪽 줄 칸 #fire-pill (식사·개운함과 같은 꼴). 놀이 시간(접속 중)만 줄어듦
// - 저장 save.inn.fire = { d: 그날 KST, n: 그날 앉은 수, until: '멍' 남은 놀이 초, t: 모두 앉은 수 }. 옛 저장은 없음(앉은 적 없음). 서버 validate.js 는 모양만 바로잡음(귤이 오가지 않음)
// dev: __oreum.fire (state()·sit(i)·stand()·skip()·left(s)·go()·lit()·peer(e))
import { INN } from '../balance.js';
import { kstDate } from '../daily.js';
import { icon } from '../icons.js';
import { height } from '../world.js';
import { MUTTER_TEXT } from '../punktext.js';
import { state, late } from './state.js';
import { $, save, persist } from './save.js';
import { camera, applySky, lampNight } from './scene.js';
import { shopsBuilt, player, hp } from './place.js';
import { toast, closePanels, topFit } from './hud.js';
import { interactables } from './stores.js';
import { marker, keys, joy } from './input.js';
import { cam } from './camera.js';
import { dismountRide, leaveCart } from './ride.js';

const F = INN.fire;
const A = shopsBuilt.find((s) => s.id === 'inn')?.api || null, FP = A?.fire || null;
const isO = (v) => v && typeof v === 'object' && !Array.isArray(v);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const LINES = Object.keys(MUTTER_TEXT).filter((k) => /^fire\d+$/.test(k));
// 옛·깨진 기록 바로잡기 (없으면 그대로 없음)
function norm() {
  const o = save.inn?.fire; if (o === undefined) return;
  if (!isO(o)) { delete save.inn.fire; return; }
  save.inn.fire = { d: typeof o.d === 'string' && DAY_RE.test(o.d) ? o.d : '', n: Math.max(0, Math.min(F.perDay, Math.floor(+o.n) || 0)), until: Math.max(0, Math.min(F.buffSec + F.pair, +o.until || 0)), t: Math.max(0, Math.floor(+o.t) || 0) };
}
norm();
const R = () => save.inn?.fire || { d: '', n: 0, until: 0, t: 0 };
const W = () => { if (!save.inn) save.inn = { d: '', n: 0, left: 0 }; if (!isO(save.inn.fire)) save.inn.fire = { d: '', n: 0, until: 0, t: 0 }; return save.inn.fire; };
const todayN = () => (R().d === kstDate() ? R().n : 0);
const on = () => R().until > 0;
const isOpen = () => !!A && late.shopOpen?.('inn') !== false;

/* ---------- 버프 배수 ---------- */
late.fireMul = (k) => (on() && F.buff[k] ? 1 + F.buff[k] : 1);
late.fireSee = () => (on() ? F.buff.see : 0);
const fogMul = () => (on() ? 1 + F.buff.fog : 1);
late.fireFog = fogMul;

/* ---------- 화면: 가장자리 어둠·UI 옅게·위쪽 줄 칸 ---------- */
const css = document.createElement('style');
css.textContent = `
#mung-veil { position: fixed; inset: 0; z-index: 3; pointer-events: none; opacity: 0; transition: opacity 1.6s ease; background: radial-gradient(ellipse at 50% 55%, rgba(0,0,0,0) 45%, rgba(10,6,4,.55) 100%); }
body.mung #mung-veil { opacity: 1; } body.mung #sit-line { white-space: nowrap; }
body.mung .panel:not(#sitbar):not(#toast):not(#msg-log), body.mung #btn-ctx, body.mung .stick, body.mung #minimap { opacity: .32 !important; transition: opacity 1.2s ease; }
#fire-pill .ring svg.r .fg { stroke: #ff9a3c; } #fire-pill.end b { color: var(--acc); }
.inn-card .io.fire-row { grid-template-columns: auto 1fr auto; display: grid; align-items: center; gap: 10px; padding: 10px 14px; }
.inn-card .io.fire-row svg { width: 20px; height: 20px; color: #ff9a3c; }
.inn-card .io.fire-row b { font: 800 13.5px/1.3 var(--display); } .inn-card .io.fire-row small { opacity: .72; font-size: 12px; }
`;
document.head.appendChild(css);
const veil = document.createElement('div'); veil.id = 'mung-veil'; document.body.append(veil);
const pill = document.createElement('div'); pill.className = 'panel tpill bpill'; pill.id = 'fire-pill'; pill.hidden = true; pill.setAttribute('role', 'button'); pill.tabIndex = 0;
pill.innerHTML = `<span class="ring"><svg class="r" viewBox="0 0 28 28"><circle class="bg" cx="14" cy="14" r="12"/><circle class="fg" cx="14" cy="14" r="12" stroke-dasharray="75.4" stroke-dashoffset="0"/></svg>${icon('flame').replace('<svg', '<svg class="ic"')}</span><b></b>`;
{ const ip = $('inn-pill') || $('buff-pill'); if (ip) ip.after(pill); else $('topbar')?.querySelector('.tb-c')?.append(pill); }
const buffLine = () => `귤 모으는 범위 +${Math.round(F.buff.pickR * 100)}% · 드문 쓰레기 +${Math.round(F.buff.rare * 100)}% · 쓰러짐 대기 ${Math.round(F.buff.down * 100)}% · 밤눈 밝게`;
const fmt = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
pill.title = `${F.name} · ${buffLine()}`;
pill.addEventListener('click', () => toast(`${F.name} · ${buffLine()} · ${fmt(R().until)} 남음`, 4));
let pillKey = '';
function paintPill() {
  const show = on() && !state.cave;
  if (!show) { if (!pill.hidden) { pill.hidden = true; topFit.dirty(); } pillKey = ''; return; }
  const t = fmt(R().until); if (t === pillKey && !pill.hidden) return; pillKey = t;
  if (pill.hidden) { pill.hidden = false; topFit.dirty(); }
  pill.querySelector('b').textContent = t; pill.classList.toggle('end', R().until <= F.warnSec);
  pill.querySelector('.fg').style.strokeDashoffset = String(75.4 * (1 - Math.min(1, R().until / F.buffSec)));
}

/* ---------- 숙소 창 카드 한 줄 (game/inn.js fillInn 이 부름) ---------- */
late.fireCard = () => {
  if (!FP) return '';
  const left = F.perDay - todayN();
  return `<div class="io fire-row">${icon('fire')}<b>마당 불멍 · 무료</b><small>${left > 0 ? `오늘 ${left}번 · ${F.name} ${Math.round(F.buffSec / 60)}분` : '오늘은 다 멍했어요'}</small></div>`;
};

/* ---------- 앉기 ---------- */
let sit = null; // { i, t, pair, said, sayAt, done }
let litT = 0; // 낮에 앉았다 일어난 뒤 불이 더 타는 시간
late.fireSit = () => !!sit;
late.fireSeatY = () => (sit ? FP.seats[sit.i].y : null);
const peerSeats = () => { const out = new Set(); const pb = late.net?.solo ? null : late.net?.peersById; if (pb) for (const e of pb.values()) if (e.data?.mf && e.pos && FP && e.pos.distanceTo(FP.center) < F.pairR) out.add(e.data.mf - 1); return out; };
function freeSeat() {
  const taken = peerSeats(), p = player.pos;
  const l = [0, 1].filter((i) => !taken.has(i)).sort((a, b) => FP.seats[a].pos.distanceTo(p) - FP.seats[b].pos.distanceTo(p));
  return l.length ? l[0] : -1;
}
function sitDown(i = freeSeat()) {
  if (!FP || sit) return false;
  if (!isOpen()) { toast(`준비 중 — ${late.shopWhy?.('inn') || ''} 열려요`); return false; }
  if (i < 0) { toast('의자가 다 찼어요 · 잠깐 기다려요'); return false; }
  if (state.cine || hp.isDown || late.tut?.active || late.innBusy?.()) return false;
  closePanels(); late.stopAutoGo?.(); if (player.riding) late.dismountDeer?.(); if (player.ride) dismountRide(); if (player.cart) leaveCart(false); if (player.pose === 'sit') late.standUp?.(); state.emo?.stop?.(); if (state.fishing?.active) state.fishing.stop();
  const s = FP.seats[i];
  player.target = null; player.onArrive = null; player.speed = 0; marker.visible = false;
  player.pos.set(s.pos.x, s.y, s.pos.z); player.visY = player.pos.y; player.heading = s.h; player.pose = 'sit'; player.poseT = 0;
  sit = { i, t: 0, pair: false, said: 0, sayAt: 2 + Math.random() * 2, done: todayN() >= F.perDay, cam: { pitch: cam.pitch, dist: cam.dist } };
  cam.yaw = s.h + Math.PI + F.camYaw; cam.pitch = F.camPitch; cam.dist = Math.min(cam.dist, F.camDist); /* 옆에서 불과 얼굴이 같이 보이게 */
  FP.setLit(true);
  $('sit-line').textContent = sit.done ? '불을 본다' : `불멍 · ${fmt(F.sit)}`; $('sitbar').hidden = false; document.body.classList.add('sitting', 'mung');
  if (sit.done) toast(`오늘 ${F.name} 은 다 받았어요 · 그냥 쉬어 가요`);
  late.net?.send?.(true);
  return true;
}
function standUp(quiet = false) {
  const r = sit; if (!r) return; sit = null;
  litT = 60; /* 일어나도 잠깐 더 탐 */
  if (r.cam) { cam.pitch = r.cam.pitch; cam.dist = r.cam.dist; }
  if (player.pose === 'sit') { player.pose = 'move'; const o = FP.seats[r.i].out; player.pos.set(o.x, height(o.x, o.z), o.z); player.visY = player.pos.y; }
  $('sitbar').hidden = true; document.body.classList.remove('sitting', 'mung');
  if (!quiet && !r.done && r.t < F.sit) toast(`조금 더 앉아 있어야 멍해져요 · ${Math.ceil(F.sit - r.t)}초 남았었어요`);
  late.net?.send?.(true);
}
late.fireStand = () => standUp();
function finish() {
  const r = sit; r.done = true;
  const o = W(), d = kstDate(); if (o.d !== d) { o.d = d; o.n = 0; }
  o.n = Math.min(F.perDay, o.n + 1); o.t = (o.t | 0) + 1;
  const sec = F.buffSec + (r.pair ? F.pair : 0); o.until = Math.max(o.until || 0, sec); persist(); warned = false;
  applySky(); paintPill();
  late.ach?.emit?.('fire-mung');
  toast(`${r.pair ? '같이 ' : ''}멍해졌어요! · ${F.name} ${Math.round(sec / 60)}분 · ${buffLine()}`, 5, 'get');
  $('sit-line').textContent = '불을 본다';
}
function tickSit(dt) {
  const r = sit; if (!r) return;
  if (player.pose !== 'sit' || hp.isDown || state.cine) { standUp(true); return; } /* 다른 일이 가로챔 */
  const mv = ['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].some((k) => keys.has(k)) || (joy.active && Math.hypot(joy.x, joy.y) > 0.4);
  if (mv) { standUp(); return; }
  r.t += dt;
  if (!r.pair && peerSeats().size) r.pair = true;
  if (!r.done) { $('sit-line').textContent = `불멍 · ${fmt(F.sit - r.t)}`; if (r.t >= F.sit) finish(); }
  if (r.t >= r.sayAt && LINES.length) { /* 한 줄 혼잣말: 덜 말한 것부터 */
    r.sayAt = r.t + F.sayGap[0] + Math.random() * (F.sayGap[1] - F.sayGap[0]);
    const seen = save.mutter?.seen || {}, id = LINES.slice().sort((a, b) => (seen[a] | 0) - (seen[b] | 0) || Math.random() - 0.5)[0];
    if (late.mutterApi?.line?.(id, MUTTER_TEXT[id])) r.said++; /* 본 수는 mutter 가 셈 */
  }
}

/* ---------- 소리: 타닥 (가까울수록 큼) ---------- */
function crack(vol) {
  const s = late.sound; if (!s || !s.on || !s.sfxOn || !s.ctx || vol < 0.02) return;
  const c = s.ctx, t = c.currentTime;
  const n = c.createBufferSource(); n.buffer = s.noise; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400 + Math.random() * 2600; f.Q.value = 1.5 + Math.random() * 2;
  const g = c.createGain(), v = (0.05 + Math.random() * 0.09) * vol, len = 0.015 + Math.random() * 0.04;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  n.connect(f); f.connect(g); g.connect(s.sfx); n.start(t, Math.random() * 1.5, len + 0.01);
}

/* ---------- 남의 화면 (room.js) ---------- */
{ const prev = late.innExtra; late.innExtra = () => ({ ...(prev?.() || {}), ...(sit ? { mf: sit.i + 1 } : {}) }); }
{ const prev = late.innPeer; late.innPeer = (e, dt) => { const r = prev?.(e, dt); if (r) return r; return e.data?.mf ? { pose: 'warm', still: true } : null; }; }

/* ---------- 시간 ---------- */
let last = 0, saveT = 0, warned = false, sndT = 0, wasOn = false;
late.tickFire = (dt) => {
  if (!FP) return;
  const t = performance.now(), rdt = last ? Math.min(1, (t - last) / 1000) : 0; last = t;
  tickSit(dt);
  const open = isOpen(); FP.setCover(!open);
  if (litT > 0) litT -= dt;
  FP.setLit(open && (lampNight > F.litNight || !!sit || litT > 0 || peerSeats().size > 0));
  FP.update(dt, camera.position, lampNight);
  if (FP.lit && FP.shown && !state.cave) {
    const d = player.pos.distanceTo(FP.center);
    if (d < F.soundR && (sndT -= dt) <= 0) { sndT = 0.06 + Math.random() * 0.35; const k = 1 - d / F.soundR; crack(k * k); }
  }
  const o = save.inn?.fire;
  if (o && o.until > 0 && state.sessionOn) {
    o.until = Math.max(0, o.until - rdt); saveT += rdt;
    if (!warned && o.until <= F.warnSec && o.until > 0) { warned = true; toast(`${F.name} 이 ${Math.round(F.warnSec / 60)}분 남았어요`); }
    if (o.until <= 0) { o.until = 0; persist(); toast(`${F.name} 이 끝났어요 · 밤이면 또 불멍`); }
    else if (saveT > 5) { saveT = 0; persist(); }
  }
  if (o && o.until > F.warnSec) warned = false;
  if (on() !== wasOn) { wasOn = on(); applySky(); }
  paintPill();
};

/* ---------- 상호작용 ---------- */
if (FP) interactables.push({ label: '불멍', ic: 'fire', pos: FP.center, r: F.r + F.chairR, when: () => FP.shown && isOpen() && !sit && !late.innBusy?.() && !late.tut?.active && !state.cave, act: () => sitDown() });

/* ---------- 확인용 (window.__oreum.fire) ---------- */
late.fireApi = {
  state: () => ({ fire: save.inn?.fire ? { ...save.inn.fire } : null, on: on(), today: todayN(), open: isOpen(), lit: !!FP?.lit, covered: !!FP?.covered, sit: sit && { i: sit.i, t: +sit.t.toFixed(1), pair: sit.pair, said: sit.said, done: sit.done }, mung: document.body.classList.contains('mung'), pill: !pill.hidden && pill.querySelector('b').textContent, mul: Object.fromEntries(['pickR', 'rare', 'down'].map((k) => [k, late.fireMul(k)])), see: late.fireSee(), net: late.innExtra?.() }),
  sit: (i) => sitDown(i == null ? undefined : i), stand: () => standUp(), skip: () => { if (sit) sit.t = Math.max(sit.t, F.sit - 0.05); },
  left: (s) => { const o = W(); o.until = Math.max(0, Math.min(F.buffSec + F.pair, +s || 0)); if (o.until > F.warnSec) warned = false; persist(); paintPill(); },
  day: (d) => { const o = W(); o.d = d; persist(); },
  go: () => { if (!FP) return null; const s = FP.seats[0].front; player.pos.set(s.x, height(s.x, s.z), s.z); player.visY = player.pos.y; late.placeRunner?.(); return { x: +s.x.toFixed(1), z: +s.z.toFixed(1) }; },
  peer: (e) => late.innPeer(e), lines: LINES, api: FP, card: () => late.fireCard(),
};
