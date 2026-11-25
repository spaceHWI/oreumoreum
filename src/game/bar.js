// Bar 소설 (#316): 가게 거리 8번 터의 책 읽는 바 (건물 src/bar.js, 수치 balance.js BAR, 글 src/bartext.js). 파일 순서는 game/firepit.js 뒤 (innExtra·innPeer 를 감쌈)
// - 열림: 가게 열기(#206 SHOP_ST.unlock 'bar': Lv 9 또는 굼부리) + 해 질 무렵부터 밤에만(lampNight > BAR.openNight, 아침 closeNight 아래면 닫음). 낮엔 입간판 '저녁에 열어요'
// - 창(가게 팝업 #shoppop 'bar'): [한 잔](귤 하이볼)·[귤 에이드](술 없이) 중 고름, 효과·값 같음. 값 = base + 레벨 × perLv, 하루 perDay 번. 읽은 편 n/20
// - 읽기: 귤을 내고 바 높은 의자에 앉아(pose 'warm': 두 손으로 책을 든 모습) BAR.read 초 책장을 넘김. 화면 가장자리 어둠(불멍과 같은 body.mung)·짧은 소설 한 편(종이 카드)·책 넘기는 소리
//   다 읽으면 버프 '여운' BAR.buffSec 초(놀이 시간). 중간에 일어나면 책갈피(save.bar.p): 그날 다시 앉으면 값 없이 이어 읽음
// - '여운': 경험치(level.js) ×(1+xp) · 혼잣말 사이(mutter.js) ×(1+mutter) · 쪽지 나올 확률(punkworld.js) ×(1+note) · 밤 시야(scene.js applySky). 싸움 수치 없음. 식사·개운함·멍과 같이 걸림
// - 짧은 소설: 안 읽은 편부터. 다 읽으면 업적 b-bar-all → 칭호 '애독자'. 곁가지 퀘스트 b-read (late.questEv('barRead'))
// - 남의 화면: 앉아 읽는 동안 presence bs = 의자 번호 + 1 → 그 사람도 앉아 읽는 모습(room.js innPeer)
// - 저장 save.bar = { d 마지막 읽은 날(KST), n 그날 읽은 수, t 모두 읽은 수, left '여운' 남은 놀이 초, read 읽은 편 번호[], p 책갈피(값을 내고 다 못 읽음) }. 옛 저장은 없음(읽은 적 없음)
//   서버 server/src/bar.js 가 값(새로 읽은 수 × 값)·하루 한도·날짜·경험치를 확인
// dev: __oreum.bar (state()·open()·order(drink, free)·skip()·stand()·left(s)·day(d)·night(on)·go()·api)
import { BAR } from '../balance.js';
import { BAR_STORIES, BAR_MUTTER } from '../bartext.js';
import { kstDate } from '../daily.js';
import { levelOf } from '../augments.js';
import { icon } from '../icons.js';
import { height } from '../world.js';
import { state, late } from './state.js';
import { $, save, persist } from './save.js';
import { applySky, lampNight } from './scene.js';
import { shopsBuilt, player, hp } from './place.js';
import { toast, updateStats, closePanels, ach, topFit } from './hud.js';
import { refreshShopPop } from './stores.js';
import { marker, keys, joy } from './input.js';
import { cam } from './camera.js';
import { dismountRide, leaveCart } from './ride.js';

const SH = shopsBuilt.find((s) => s.id === 'bar') || null, A = SH?.api || null;
const isO = (v) => v && typeof v === 'object' && !Array.isArray(v);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/, NS = BAR_STORIES.length;
// 옛·깨진 기록 바로잡기 (없으면 그대로 없음)
function norm() {
  if (save.bar === undefined) return;
  const o = isO(save.bar) ? save.bar : {}, int = (v, hi) => Math.max(0, Math.min(hi, Math.floor(+v) || 0));
  const read = Array.isArray(o.read) ? [...new Set(o.read.filter((i) => Number.isInteger(i) && i >= 0 && i < NS))] : [];
  save.bar = { d: typeof o.d === 'string' && DAY_RE.test(o.d) ? o.d : '', n: int(o.n, BAR.perDay), t: int(o.t, 1e6), left: Math.max(0, Math.min(BAR.buffSec, +o.left || 0)), read, ...(o.p ? { p: 1 } : {}) };
}
norm();
const B = () => save.bar || { d: '', n: 0, t: 0, left: 0, read: [] };
const W = () => { if (!isO(save.bar)) save.bar = { d: '', n: 0, t: 0, left: 0, read: [] }; return save.bar; };
const lvNow = () => { try { return levelOf(save.lv?.xp || 0).lv; } catch { return 1; } };
export const barPrice = () => Math.max(1, Math.round(BAR.price.base + lvNow() * BAR.price.perLv));
const todayN = () => (B().d === kstDate() ? B().n : 0);
const marked = () => !!B().p && B().d === kstDate(); /* 책갈피: 오늘 값을 냈는데 다 못 읽음 */
const on = () => B().left > 0;
const gateOpen = () => !!A && late.shopOpen?.('bar') !== false;
let nightOn = lampNight > BAR.openNight, nightForce = null; /* 해 질 무렵 열고 아침에 닫음 (사이 값은 앞 상태 그대로) */
const isNight = () => (nightForce != null ? nightForce : nightOn);
const serving = () => gateOpen() && isNight();

/* ---------- '여운': 배수·밤 시야 ---------- */
late.barMul = (k) => (on() && BAR.buff[k] && k !== 'see' ? 1 + BAR.buff[k] : 1);
late.barSee = () => (on() ? BAR.buff.see : 0);

/* ---------- 화면: 위쪽 줄 칸·읽는 종이 ---------- */
const css = document.createElement('style');
css.textContent = `
#bar-pill .ring svg.r .fg { stroke: #b8a6ff; } #bar-pill.end b { color: var(--acc); }
#bar-page { position: fixed; left: 50%; bottom: calc(var(--safe-b, 0px) + 84px); transform: translate(-50%, 12px); z-index: 7; width: min(440px, calc(100vw - 32px)); pointer-events: none; opacity: 0; transition: opacity .8s ease, transform .8s ease;
  padding: 16px 20px 14px; border-radius: 6px; color: #3a2e22; background: linear-gradient(180deg, #f6efdd, #eee3c8); box-shadow: 0 10px 30px rgba(0,0,0,.45), inset 0 0 0 1px rgba(120,90,50,.18); font-family: "Noto Serif KR", "Nanum Myeongjo", serif; }
#bar-page.on { opacity: 1; transform: translate(-50%, 0); }
#bar-page h3 { margin: 0 0 8px; font: 700 15px/1.3 inherit; letter-spacing: .02em; display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
#bar-page h3 small { font: 600 11px/1 var(--display, sans-serif); opacity: .55; white-space: nowrap; }
#bar-page p { margin: 0; font: 500 14.5px/1.7 inherit; word-break: keep-all; }
@media (max-width: 600px) { #bar-page { bottom: calc(var(--safe-b, 0px) + 72px); padding: 12px 14px; } #bar-page p { font-size: 13.5px; line-height: 1.6; } }
.inn-card .ib.yeoun span { background: rgba(184,166,255,.16); } .inn-card .ib.yeoun svg { color: #b8a6ff; }
.inn-card .io-top .drk { display: inline-flex; gap: 4px; align-items: center; }
.bar-acts .btn small { display: block; font-size: 11px; opacity: .7; font-weight: 600; }
.inn-card .io.read-row { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; padding: 10px 14px; }
.inn-card .io.read-row svg { width: 20px; height: 20px; color: #b8a6ff; } .inn-card .io.read-row b { font: 800 13.5px/1.3 var(--display); } .inn-card .io.read-row small { opacity: .72; font-size: 12px; }
`;
document.head.appendChild(css);
const pill = document.createElement('div'); pill.className = 'panel tpill bpill'; pill.id = 'bar-pill'; pill.hidden = true; pill.setAttribute('role', 'button'); pill.tabIndex = 0;
pill.innerHTML = `<span class="ring"><svg class="r" viewBox="0 0 28 28"><circle class="bg" cx="14" cy="14" r="12"/><circle class="fg" cx="14" cy="14" r="12" stroke-dasharray="75.4" stroke-dashoffset="0"/></svg>${icon('moon').replace('<svg', '<svg class="ic"')}</span><b></b>`;
{ const ip = $('fire-pill') || $('inn-pill') || $('buff-pill'); if (ip) ip.after(pill); else $('topbar')?.querySelector('.tb-c')?.append(pill); }
const page = document.createElement('div'); page.id = 'bar-page'; page.hidden = true; page.setAttribute('aria-live', 'polite'); page.innerHTML = '<h3><span></span><small></small></h3><p></p>'; document.body.append(page);
const WORD = { xp: '경험치', mutter: '혼잣말 자주', note: '쪽지 잘 나옴', see: '밤눈 밝게' }, BIC = { xp: 'star', mutter: 'chat', note: 'notes', see: 'eye' };
const chip = (k, v) => (k === 'xp' ? `${WORD[k]} +${Math.round(v * 100)}%` : WORD[k]);
const buffLine = () => Object.entries(BAR.buff).map(([k, v]) => chip(k, v)).join(' · ');
const fmt = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
pill.title = `${BAR.buffName} · ${buffLine()}`;
pill.addEventListener('click', () => toast(`${BAR.buffName} · ${buffLine()} · ${fmt(B().left)} 남음`, 4));
let pillKey = '';
function paintPill() {
  const show = on() && !state.cave;
  if (!show) { if (!pill.hidden) { pill.hidden = true; topFit.dirty(); } pillKey = ''; return; }
  const t = fmt(B().left); if (t === pillKey && !pill.hidden) return; pillKey = t;
  if (pill.hidden) { pill.hidden = false; topFit.dirty(); }
  pill.querySelector('b').textContent = t; pill.classList.toggle('end', B().left <= BAR.warnSec);
  pill.querySelector('.fg').style.strokeDashoffset = String(75.4 * (1 - Math.min(1, B().left / BAR.buffSec)));
}

/* ---------- 창 ---------- */
late.fillBar = (grid) => {
  const c = document.createElement('div'); c.className = 'inn-card';
  const p = barPrice(), left = BAR.perDay - todayN(), mk = marked(), night = isNight(), poor = !mk && save.coins < p, done = !mk && left <= 0;
  const off = !night || done || poor || !!sit, rd = B().read.length;
  c.innerHTML = `<div class="io"><div class="io-top"><b>한 잔 하며 한 쪽 읽기</b><span class="price"><i></i>${mk ? '책갈피' : p}</span></div>`
    + `<p class="io-sub">${BAR.buffName} ${Math.round(BAR.buffSec / 60)}분 · ${BAR.read}초 읽기 · ${night ? `오늘 ${Math.max(0, left)}번 남음` : '해 질 무렵부터 열어요'}</p>`
    + `<div class="ib yeoun">${Object.entries(BAR.buff).map(([k, v]) => `<span>${icon(BIC[k])}${chip(k, v)}</span>`).join('')}</div></div>`
    + `<div class="io read-row">${icon('book')}<b>읽은 책 ${rd}/${NS}</b><small>${rd >= NS ? `칭호 '${BAR.title}'` : `다 읽으면 칭호 '${BAR.title}'`}</small></div>`
    + `<div class="win-acts bar-acts">${BAR.drinks.map((d) => `<button type="button" class="btn${d.id === 'highball' ? ' primary' : ''}" data-drink="${d.id}"${off ? ' disabled' : ''}>${icon(d.id === 'highball' ? 'glass' : 'sour')}<span>${d.name}<small>${d.sub}</small></span></button>`).join('')}</div>`
    + (!night ? '<small class="note">저녁에 열어요 · 해가 지면 불이 켜져요</small>' : done ? '<small class="note">오늘은 다 읽었어요 · 내일 밤에 또 와요</small>' : poor ? `<small class="note">귤이 ${p - save.coins}개 모자라요</small>` : mk ? '<small class="note">책갈피를 꽂아 뒀어요 · 값 없이 이어 읽어요</small>' : '<small class="note">한 잔과 에이드는 효과가 같아요</small>');
  grid.append(c);
  c.querySelectorAll('[data-drink]').forEach((b) => b.addEventListener('click', () => order(b.dataset.drink)));
};

/* ---------- 읽기: 주문 → 앉기 → 15초 → 여운 ---------- */
let sit = null; // { i 의자, t, s 편 번호, drink, sayAt, cam }
late.barSit = () => !!sit;
const peerSeats = () => { const out = new Set(); const pb = late.net?.solo ? null : late.net?.peersById; if (pb && A) for (const e of pb.values()) if (e.data?.bs && e.pos && e.pos.distanceTo(A.center) < 8) out.add(e.data.bs - 1); return out; };
function freeSeat() { const taken = peerSeats(), l = [0, 1].filter((i) => !taken.has(i)); return l.length ? l[0] : -1; }
function pickStory() {
  const r = new Set(B().read), un = []; for (let i = 0; i < NS; i++) if (!r.has(i)) un.push(i);
  const pool = un.length ? un : [...Array(NS).keys()]; return pool[Math.floor(Math.random() * pool.length)];
}
function order(drink = 'highball', free = false) {
  if (!A || sit) return false;
  if (!gateOpen()) { toast(`준비 중 — ${late.shopWhy?.('bar') || ''} 열려요`); return false; }
  if (!isNight()) { toast('저녁에 열어요 · 해가 지면 불이 켜져요'); return false; }
  if (state.cine || hp.isDown || late.tut?.active || late.innBusy?.() || late.fireSit?.()) return false;
  const mk = marked(), p = free || mk ? 0 : barPrice();
  if (!mk && !free && todayN() >= BAR.perDay) { toast('오늘은 다 읽었어요 · 내일 밤에 또 와요'); return false; }
  if (save.coins < p) { toast(`귤이 ${p - save.coins}개 모자라요`); return false; }
  const i = freeSeat(); if (i < 0) { toast('자리가 다 찼어요 · 잠깐 기다려요'); return false; }
  closePanels(); late.stopAutoGo?.(); if (player.riding) late.dismountDeer?.(); if (player.ride) dismountRide(); if (player.cart) leaveCart(false); if (player.pose === 'sit') late.standUp?.(); state.emo?.stop?.(); if (state.fishing?.active) state.fishing.stop();
  if (!mk) { /* 값을 낸 것과 읽은 수는 같이 저장 (서버 server/src/bar.js 가 값을 셈) */
    save.coins -= p; late.coinsSync?.(); updateStats(); if (p) late.sound?.coin?.();
    const o = W(), d = kstDate(); if (o.d !== d) { o.d = d; o.n = 0; } o.n = Math.min(BAR.perDay, o.n + 1); o.t = (o.t | 0) + 1; o.p = 1; persist();
  }
  const s = A.seats[i], dk = BAR.drinks.find((x) => x.id === drink) || BAR.drinks[0];
  player.target = null; player.onArrive = null; player.speed = 0; marker.visible = false;
  player.pos.set(s.pos.x, s.y, s.pos.z); player.visY = player.pos.y; player.heading = s.h; player.pose = 'warm'; player.poseT = 0; late.placeRunner?.();
  sit = { i, t: 0, s: pickStory(), drink: dk.id, sayAt: 4 + Math.random() * 2, said: 0, cam: { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist } };
  cam.yaw = s.h + Math.PI + BAR.camYaw; cam.pitch = BAR.camPitch; cam.dist = BAR.camDist; A.setReading(true); /* 앞 유리창 밖에서 들여다봄 (창 등빛 번짐은 감춤) */
  const st = BAR_STORIES[sit.s]; page.querySelector('h3 span').textContent = st.t; page.querySelector('h3 small').textContent = `${dk.name} · ${sit.s + 1}/${NS}`; page.querySelector('p').textContent = st.b;
  page.hidden = false; void page.offsetWidth; page.classList.add('on'); turnSound();
  $('sit-line').textContent = `${BAR.buffName} · ${fmt(BAR.read)}`; $('sitbar').hidden = false; document.body.classList.add('sitting', 'mung', 'reading');
  toast(mk ? '책갈피를 펼쳐요' : `${dk.id === 'highball' ? dk.sub : dk.name} 한 잔 · 책장을 넘겨요`, 3);
  late.net?.send?.(true);
  return true;
}
function standUp(quiet = false) {
  const r = sit; if (!r) return; sit = null;
  if (r.cam) { cam.pitch = r.cam.pitch; cam.dist = r.cam.dist; } A.setReading(false);
  if (player.pose === 'warm' || player.pose === 'sit') { player.pose = 'move'; const o = A.seats[r.i].out; player.pos.set(o.x, height(o.x, o.z), o.z); player.visY = player.pos.y; player.heading = A.rot; late.placeRunner?.(); }
  $('sitbar').hidden = true; document.body.classList.remove('sitting', 'mung', 'reading');
  page.classList.remove('on'); setTimeout(() => { if (!sit) page.hidden = true; }, 820);
  if (!quiet && r.t < BAR.read) toast(`책갈피를 꽂았어요 · 오늘 밤 다시 앉으면 이어 읽어요`, 4);
  late.net?.send?.(true);
}
late.barStand = () => standUp();
function finish() {
  const r = sit, o = W();
  delete o.p; o.left = BAR.buffSec; if (!o.read.includes(r.s)) o.read.push(r.s); persist(); warned = false;
  applySky(); paintPill();
  ach.emit('bar-read'); late.questEv?.('barRead');
  if (o.read.length >= NS) ach.emit('bar-all'); /* 업적 b-bar-all → 칭호 '애독자' */
  toast(`${BAR.buffName}이 남아요 · ${buffLine()} · ${Math.round(BAR.buffSec / 60)}분`, 5, 'get');
  late.sound?.coin?.();
  standUp(true);
}
function tickSit(dt) {
  const r = sit; if (!r) return;
  if (player.pose !== 'warm' || hp.isDown || state.cine) { standUp(true); return; } /* 다른 일이 가로챔 (책갈피는 남음) */
  const mv = ['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].some((k) => keys.has(k)) || (joy.active && Math.hypot(joy.x, joy.y) > 0.4);
  if (mv) { standUp(); return; }
  r.t += dt; $('sit-line').textContent = `${BAR.buffName} · ${fmt(BAR.read - r.t)}`;
  if (r.t >= r.sayAt) { r.sayAt = r.t + BAR.sayGap[0] + Math.random() * (BAR.sayGap[1] - BAR.sayGap[0]); const ids = Object.keys(BAR_MUTTER), id = ids[Math.floor(Math.random() * ids.length)]; if (late.mutterApi?.line?.(id, BAR_MUTTER[id])) r.said++; turnSound(); }
  if (r.t >= BAR.read) finish();
}
// 책장 넘기는 소리: 짧게 쓸리는 잡음 (game/noteview.js 와 같은 꼴)
function turnSound() {
  const s = late.sound; if (!s?.on || !s.sfxOn || !s.ctx || !s.noise) return;
  try {
    const c = s.ctx, t = c.currentTime, n = c.createBufferSource(); n.buffer = s.noise;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.9; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(3200, t + 0.16);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    n.connect(f); f.connect(g); g.connect(s.sfx); n.start(t, Math.random() * 1.5, 0.22);
  } catch { /* 소리 없이도 됨 */ }
}

/* ---------- 남의 화면 (room.js): 앉아 읽는 모습 ---------- */
{ const prev = late.innExtra; late.innExtra = () => ({ ...(prev?.() || {}), ...(sit ? { bs: sit.i + 1 } : {}) }); }
{ const prev = late.innPeer; late.innPeer = (e, dt) => { const r = prev?.(e, dt); if (r) return r; return e.data?.bs ? { pose: 'warm', still: true } : null; }; }

/* ---------- 시간 ---------- */
let last = 0, saveT = 0, warned = false, wasOn = false, openShown = null;
late.tickBar = (dt) => {
  if (!A) return;
  const t = performance.now(), rdt = last ? Math.min(1, (t - last) / 1000) : 0; last = t;
  if (lampNight > BAR.openNight) nightOn = true; else if (lampNight < BAR.closeNight) nightOn = false;
  const open = serving(); if (open !== openShown) { openShown = open; A.setOpen(open); }
  tickSit(dt);
  const o = save.bar;
  if (o && o.left > 0 && state.sessionOn && !sit) {
    o.left = Math.max(0, o.left - rdt); saveT += rdt;
    if (!warned && o.left <= BAR.warnSec && o.left > 0) { warned = true; toast(`${BAR.buffName}이 ${Math.round(BAR.warnSec / 60)}분 남았어요`); }
    if (o.left <= 0) { o.left = 0; persist(); toast(`${BAR.buffName}이 끝났어요 · 밤이면 또 소설`); }
    else if (saveT > 5) { saveT = 0; persist(); }
  }
  if (o && o.left > BAR.warnSec) warned = false;
  if (on() !== wasOn) { wasOn = on(); applySky(); }
  paintPill();
};

/* ---------- 확인용 (window.__oreum.bar) ---------- */
late.barApi = {
  state: () => ({ bar: save.bar ? { ...save.bar, read: [...(save.bar.read || [])] } : null, on: on(), today: todayN(), price: barPrice(), gate: gateOpen(), night: isNight(), open: serving(), board: !!A?.board.visible, marked: marked(), sit: sit && { i: sit.i, t: +sit.t.toFixed(1), s: sit.s, drink: sit.drink, said: sit.said }, mung: document.body.classList.contains('mung'), page: !page.hidden && page.querySelector('h3 span').textContent, pill: !pill.hidden && pill.querySelector('b').textContent, mul: Object.fromEntries(['xp', 'mutter', 'note'].map((k) => [k, late.barMul(k)])), see: late.barSee(), net: late.innExtra?.(), pose: player.pose }),
  open: () => late.openShopPop?.('bar'), order, stand: () => standUp(), skip: () => { if (sit) sit.t = Math.max(sit.t, BAR.read - 0.05); },
  left: (s) => { const o = W(); o.left = Math.max(0, Math.min(BAR.buffSec, +s || 0)); if (o.left > BAR.warnSec) warned = false; persist(); paintPill(); },
  day: (d) => { const o = W(); o.d = d; persist(); }, night: (v) => { nightForce = v == null ? null : !!v; }, read: (list) => { const o = W(); o.read = list.slice(); persist(); },
  go: () => { if (!A) return null; const d = A.door; player.pos.set(d.x, height(d.x, d.z), d.z); player.visY = player.pos.y; player.heading = A.rot + Math.PI; late.placeRunner?.(); return { x: +d.x.toFixed(1), z: +d.z.toFixed(1) }; },
  peer: (e) => late.innPeer(e), stories: NS, api: A, shop: SH, refresh: () => refreshShopPop(), price: barPrice,
};
