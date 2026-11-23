// 노루 친구 (#247): 들판 노루를 귤로 사귀면 내 노루가 되어 따라다니고 언제든 탐. 수치는 balance.js DEERPAL (모두 임의)
// - 사귀기: 들판 노루 가까이 행동 버튼 '귤 주기'(귤 1개) 또는 던진 귤을 먹음(life.hooks.fed) → 같은 노루에게 DEERPAL.feed 번이면 이름을 붙이고 내 노루
//   구역 DEERPAL.zone 에 들어서기 전에는 귤만 먹고 달아남. 한 번에 한 마리, 새로 사귀면 앞 노루는 무리로 돌아감
// - 내 노루는 무리(life.deer)와 따로 그린다. 사귄 무리 노루는 d.taken 으로 숨기고 멈춤 (life.js). 멀티 노루(#92 deernet.js)는 그대로
// - 따라오기: 플레이어 발자취(crumbs)를 따라옴, 멀거나 막히면 순간 이동. 싸움·서바이벌 판·동굴·가게 안·튜토리얼 칸에서는 밖에서 기다림
// - 타기: moves.js mountDeer/dismountDeer 를 같이 씀 (d.pal 이면 방에 묻지 않음). 빠르기는 update.js 가 late.deerPalWant 로 (안장·친해짐·배고픔)
// - 휘파람: 동작 부채꼴 맨 끝 한 칸(emotes.js extra, 내 노루가 있을 때만)·PC 는 V
// - 멀티: presence dp(이름)·dpr(타는 중)만 보냄. 받는 쪽이 그 사람 뒤를 따라오게 그림 (좌표는 보내지 않음). 남의 노루는 탈 수 없음
// - 저장 save.deerPal = { n: 이름, id: 사귄 무리 노루 id, fed: 먹인 귤 합계(친해짐), hg: 배고픔 0~1, sd: 안장, open: 사귈 수 있음, f: { 노루 id: 준 귤 } }
//   옛 저장: 탈것 가게에 '노루' 는 없었으므로(RIDES.list 는 스케이트·스쿠터·조랑말) 바꿀 것이 없음. 안장을 샀는데 내 노루가 없으면 그 자리에서 한 마리를 줌
import * as THREE from 'three';
import { DEERPAL as DP, DEER } from '../balance.js';
import { buildDeer, wantDeer } from '../lifemodels.js';
import { height } from '../world.js';
import { cleanText, nickOk } from '../safetext.js';
import { ic } from '../icons.js';
import { state, late } from './state.js';
import { $, save, persist, pick } from './save.js';
import { scene } from './scene.js';
import { life, player, NS_TUT } from './place.js';
import { toast, updateStats, busy, ach } from './hud.js';
import { mountDeer, dismountDeer } from './moves.js';
import { noRideZone } from './ride.js';
import { zoneNow } from './pickup.js';
import { net } from './room.js';
import { setActions } from './menu.js';
import { pressBtn } from './input.js';

const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const S = (() => {
  let s = save.deerPal; if (!s || typeof s !== 'object' || Array.isArray(s)) s = save.deerPal = {};
  if (typeof s.n !== 'string' || !nickOk(s.n)) s.n = ''; if (typeof s.id !== 'string') s.id = '';
  s.fed = Math.max(0, Math.floor(+s.fed || 0)); s.hg = Math.max(0, Math.min(1, Number.isFinite(+s.hg) ? +s.hg : 1));
  s.sd = s.sd ? 1 : 0; s.open = s.open ? 1 : 0; if (!s.f || typeof s.f !== 'object' || Array.isArray(s.f)) s.f = {};
  return s;
})();
export const palLv = () => { let l = 0; for (let i = 0; i < DP.bond.length; i++) if (S.fed >= DP.bond[i]) l = i; return l; };
const say = (k) => { const t = DP.say[k]; if (!late.mutterApi?.line?.('deerpal:' + k, t)) toast(t); };
const hiddenNow = () => !!NS_TUT && !save.tut?.done; // 튜토리얼 칸에는 들어오지 않음

// ---------- 머리 위 표시 (하트·?) ----------
function signTex(ch, color) { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d'); g.fillStyle = color; g.font = 'bold 54px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 32, 36); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
let heartTex = null, askTex = null;
function sign(tex) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); sp.scale.set(0.7, 0.7, 1); sp.position.y = 2.3; sp.visible = false; return sp; }
function makeDeer(at, heading) {
  heartTex ||= signTex('♥', '#e9719a'); askTex ||= signTex('?', '#ffffff');
  const d = buildDeer(), heart = sign(heartTex), q = sign(askTex); d.root.add(heart, q); scene.add(d.root);
  const o = { ...d, pal: true, id: '', kind: 'deer', heart, q, heartT: 0, qT: 0, pos: at.clone(), heading, speed: 0, phase: 0, state: 'follow', t: 0, target: null, followUntil: 0 };
  o.pos.y = height(o.pos.x, o.pos.z); d.root.position.copy(o.pos); d.root.rotation.y = heading; return o;
}
function animate(o, dt, time, headX) {
  o.phase += dt * (o.speed > 0.1 ? o.speed * (o.state === 'ridden' ? 1.4 : 2.2) : 0);
  o.root.position.copy(o.pos); o.root.rotation.y = o.heading;
  if (o.speed > 4) o.root.position.y += Math.abs(Math.sin(o.phase * 0.5)) * 0.25;
  const a = o.speed > 0.1 ? 0.6 : 0, s = Math.sin(o.phase) * a;
  if (o.legs) { o.legs[0].rotation.x = s; o.legs[3].rotation.x = s; o.legs[1].rotation.x = -s; o.legs[2].rotation.x = -s; }
  if (o.head) o.head.rotation.x = headX ?? (o.speed < 0.2 && o.state === 'graze' ? 0.9 + Math.sin(time * 1.5) * 0.1 : 0.15);
  o.fx?.(dt, time, o);
  for (const [sp, k] of [[o.heart, 'heartT'], [o.q, 'qT']]) { if (o[k] > 0) { o[k] -= dt; sp.visible = true; sp.position.y = 2.3 + (2.5 - Math.min(2.5, o[k])) * 0.3; sp.material.opacity = Math.min(1, o[k]); } else if (sp.visible) sp.visible = false; }
}

// ---------- 내 노루 ----------
let pal = null;
const crumbs = []; // 플레이어 발자취 [x, z] (오래된 것이 앞)
let ci = -1, stuck = 0, lastD = 0, calling = false, oddT = 0, oddAt = null, emptyTold = false, saveT = 0;
function behindPlayer(d) { return new THREE.Vector3(player.pos.x - Math.sin(player.heading) * d, 0, player.pos.z - Math.cos(player.heading) * d); }
function spawnPal(at) {
  if (pal) { scene.remove(pal.root); }
  pal = makeDeer(at || behindPlayer(DP.back[1]), player.heading); pal.name = S.n; ci = -1; stuck = 0; calling = false;
}
function dropPal() { if (!pal) return; if (player.riding === pal) dismountDeer(); scene.remove(pal.root); pal = null; hungerUI(); }
// 사귄 무리 노루를 숨김(d.taken). 내 노루를 놓아주면 그 노루가 무리로 돌아감
const takenSet = new Set();
function syncTaken() {
  for (const d of life.deer) {
    const t = !!pal && !!S.id && d.id === S.id;
    if (t && !d.taken) { d.taken = true; d.root.visible = false; takenSet.add(d); }
    else if (!t && d.taken) { d.taken = false; d.root.visible = true; takenSet.delete(d); }
  }
}
function releasePal() {
  const old = S.id ? life.deerById(S.id) : null;
  if (old && pal && !life.remote) { old.pos.copy(pal.pos); old.home.copy(pal.pos); old.state = 'walk'; old.t = 2; }
  const name = S.n; dropPal(); S.id = ''; syncTaken();
  if (name) toast(`${name}은(는) 무리로 돌아갔어요`);
}
function befriend(src, name) {
  const at = src?.pos ? src.pos.clone() : behindPlayer(2.5);
  if (pal || S.n) releasePal();
  S.n = name; S.id = src?.id && src.id[0] === 'h' ? src.id : ''; S.fed = DP.feed; S.hg = 1; S.f = {}; persist();
  if (src && src.id && src.id[0] !== 'h') life.removeDeer([src]); // 다 핀 구역·지나가는 노루는 이름이 저장되지 않으므로 그냥 데려감
  spawnPal(at); syncTaken(); pal.heartT = 2.5;
  say('got'); ach.emit('deer-pal'); net?.send?.(true);
}

// ---------- 이름 짓기 창 ----------
let pending = null; // 사귈 노루(무리 노루) 또는 'gift'(안장을 샀는데 내 노루가 없을 때)
const nameVal = () => cleanText($('deer-name').value, 16);
function nameRefresh() {
  const v = nameVal(), ok = nickOk(v);
  $('deer-name').setAttribute('aria-invalid', String(!!v && !ok));
  $('deer-name-err').hidden = !v || ok; $('deer-name-err').textContent = '이 이름은 쓸 수 없어요';
  $('deer-name-go').disabled = !ok;
}
function askName(src) {
  pending = src; $('deer-name').value = pick(DP.names.filter((n) => n !== S.n));
  $('deer-name-note').textContent = S.n ? `${S.n}은(는) 무리로 돌아가요` : '이름을 붙여 주세요';
  nameRefresh(); $('deerwin').hidden = false;
}
function nameDone(useDefault) {
  if ($('deerwin').hidden) return;
  let v = nameVal(); if (!nickOk(v)) { if (!useDefault) { nameRefresh(); return; } v = pick(DP.names); }
  $('deerwin').hidden = true; const src = pending; pending = null;
  befriend(src === 'gift' ? null : src, v);
}
$('deer-name').addEventListener('input', nameRefresh);
$('deer-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); nameDone(false); } else if (e.key === 'Escape') nameDone(true); });
$('deer-name-dice').addEventListener('click', () => { $('deer-name').value = pick(DP.names); nameRefresh(); });
$('deer-name-go').addEventListener('click', () => nameDone(false));
$('deerwin-close').addEventListener('click', () => nameDone(true)); // 닫아도 노루는 데려감 (이름은 아무거나)

// ---------- 귤 주기 ----------
function payGyul() { if (save.coins < 1) { toast('귤이 없어요'); return false; } save.coins -= 1; updateStats(); persist(); late.sound?.crunch?.(); return true; }
function flee(d) { if (life.remote) return; d.state = 'flee'; d.t = 2.5; d.target = null; d.followUntil = 0; const ax = d.pos.x - player.pos.x, az = d.pos.z - player.pos.z; d.heading = Math.atan2(ax, az); late.sound?.deerHop?.(); }
// 들판 노루가 내 귤을 먹음 (손으로 줌·던진 귤). 같은 노루 DP.feed 번이면 내 노루
function onFed(d) {
  if (!d || d.pal || d.taken) return;
  if (!S.open) { say('shy'); flee(d); return; }
  const n = (S.f[d.id] | 0) + 1; S.f[d.id] = n;
  const ks = Object.keys(S.f); if (ks.length > 12) delete S.f[ks[0]];
  persist();
  if (n >= DP.feed) { delete S.f[d.id]; askName(d); }
  else if (n === DP.feed - 1) say('near');
}
function feedWild(d) {
  if (!d || !payGyul()) return;
  d.heart.visible = true; d.heartT = 2.5; if (!life.remote) { d.state = 'eat'; d.t = 1.5; d.speed = 0; d.heading = Math.atan2(player.pos.x - d.pos.x, player.pos.z - d.pos.z); }
  prevFed?.('deer', d); onFed(d);
}
function feedPal() {
  if (!pal || !payGyul()) return;
  const lv = palLv(); S.hg = Math.min(1, S.hg + DP.meal); S.fed++; pal.heartT = 2.5; emptyTold = false; persist();
  ach.emit('feed');
  if (palLv() > lv) toast(`${S.n}와(과) 더 친해졌어요 (${palLv() + 1}단계)`); else toast(`${S.n} 배고픔 ${Math.round(S.hg * 100)}%`, 1.4);
  hungerUI(true);
}
const prevFed = life.hooks.fed;
life.hooks.fed = (k, a) => { prevFed?.(k, a); if (k === 'deer' && a) onFed(a); }; // 던진 귤을 먹은 노루 (life.js feedStep)

// ---------- 행동 버튼 (dump.js updateContext) ----------
const palD = () => (pal ? Math.hypot(pal.pos.x - player.pos.x, pal.pos.z - player.pos.z) : Infinity);
const rideAct = { label: '타기', ic: 'deer', mine: true, act: () => mountPal() }; // mine: 다른 할 일이 없을 때만 (dump.js)
const palFeedAct = { label: '귤 주기', ic: 'deer', mine: true, act: () => feedPal() };
const wildAct = { label: '귤 주기', ic: 'deer', deer: null, act: () => feedWild(wildAct.deer) };
late.deerPalAct = () => {
  if (player.riding || player.cart || state.cave) return null;
  if (pal && pal.root.visible && palD() < DP.rideR) return S.hg < DP.askBelow && save.coins > 0 ? palFeedAct : rideAct;
  const d = life.nearestDeer(player.pos, DP.feedR);
  if (d && !d.byPeer) { wildAct.deer = d; return wildAct; }
  return null;
};
function mountPal() {
  if (!pal || busy() || player.riding || player.cart) return;
  calling = false; pal.qT = 0; oddAt = null;
  mountDeer(pal, true); net?.send?.(true); hungerUI(true);
}
// 탈 때 빠르기 (update.js): 안장 없으면 DP.bare 배, 친해짐 단계마다 +DP.bondSpeed, 배고픔 0 이면 걷는 빠르기까지만
late.deerPalWant = (w) => { let v = w * (S.sd ? 1 : DP.bare) * (1 + DP.bondSpeed * palLv()); if (S.hg <= 0) v = Math.min(v, 5); return v; };

// ---------- 휘파람 ----------
function whistle() {
  if (!pal || player.riding === pal) return;
  late.sound?.beep?.(true);
  if (state.cave) { toast('여기서는 휘파람이 닿지 않아요'); return; }
  if (palD() > DP.whistle[palLv()]) { toast('휘파람이 닿지 않았어요'); return; }
  calling = true; oddAt = null; pal.qT = 0; toast(`${S.n}이(가) 달려와요`, 1.6);
}
const WHISTLE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="14" r="5"/><path d="M13 11l7-4v4l-5 2"/><path d="M16 4.5l1-1.5M19 6l1.6-.8"/></svg>';
const whistleCell = { id: 'whistle', name: '휘파람', svg: WHISTLE_SVG, act: () => { setActions(false); whistle(); } };
function bindEmo() { if (state.emo && !state.emo.__pal) { state.emo.__pal = 1; state.emo.extra = () => (pal && player.riding !== pal && !hiddenNow() ? whistleCell : null); } }
addEventListener('keydown', (e) => { if (e.repeat || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; if (e.key.toLowerCase() === 'v' || e.code === 'KeyV') whistle(); });

// ---------- 배고픔 띠 (탈 때만) ----------
const hb = $('dp-hunger');
pressBtn(hb, (e) => { e.stopPropagation?.(); feedPal(); });
let hbV = -1;
function hungerUI(force = false) {
  const on = !!pal && player.riding === pal;
  if (hb.hidden === on) hb.hidden = !on;
  if (!on) return;
  const v = Math.round(S.hg * 50) / 50; if (!force && v === hbV) return; hbV = v;
  hb.style.setProperty('--h', String(v)); hb.classList.toggle('low', S.hg < DP.askBelow);
  hb.title = `${S.n} 배고픔 ${Math.round(S.hg * 100)}% · 눌러서 귤 주기`;
}

// ---------- 이상한 것에 반응 (읽기만: traces.js·cases.js) ----------
const oddCool = new Map();
function oddSpots() {
  const out = [], t = late.tracesOdd?.();
  if (t?.crop) out.push(['crop', t.crop[0], t.crop[1]]);
  if (t?.foot && pal) { let b = null, bd = DP.odd; for (const [x, z] of t.foot) { const d = Math.hypot(x - pal.pos.x, z - pal.pos.z); if (d < bd) { bd = d; b = [x, z]; } } if (b) out.push(['foot', b[0], b[1]]); }
  const C = late.cases; if (C?.list) for (const id of C.list) { const st = C.state(id); if (!st?.open || st.closed) continue; const sp = C.spots(id); for (const [k, p] of Object.entries(sp?.ev || {})) if (p) out.push([`case:${id}:${k}`, p[0], p[1]]); }
  return out;
}
function checkOdd(now) {
  for (const [k, x, z] of oddSpots()) {
    if (Math.hypot(x - pal.pos.x, z - pal.pos.z) > DP.odd) continue;
    const key = k === 'foot' ? 'foot' : `${k}:${Math.round(x)}:${Math.round(z)}`;
    if ((oddCool.get(key) || 0) > now) continue;
    oddCool.set(key, now + DP.oddCool * 1000); oddAt = new THREE.Vector3(x, 0, z); oddT = DP.oddT; pal.qT = DP.oddT; pal.speed = 0;
    if (palD() < 25) say('odd');
    return;
  }
}

// ---------- 따라오기 ----------
function addCrumb() {
  const l = crumbs[crumbs.length - 1];
  if (l && Math.hypot(player.pos.x - l[0], player.pos.z - l[1]) < DP.crumb) return;
  if (l && Math.hypot(player.pos.x - l[0], player.pos.z - l[1]) > 20) { crumbs.length = 0; ci = -1; } // 순간 이동한 플레이어: 발자취를 새로
  crumbs.push([player.pos.x, player.pos.z]); if (crumbs.length > 90) { crumbs.shift(); if (ci > 0) ci--; }
}
// 발자취에서 플레이어 뒤로 dist m 되는 자리 번호
function crumbBack(dist) { let acc = 0, x = player.pos.x, z = player.pos.z; for (let i = crumbs.length - 1; i >= 0; i--) { acc += Math.hypot(crumbs[i][0] - x, crumbs[i][1] - z); x = crumbs[i][0]; z = crumbs[i][1]; if (acc >= dist) return i; } return 0; }
function teleport() {
  const i = crumbs.length > 2 ? crumbBack(8) : -1, p = i >= 0 ? new THREE.Vector3(crumbs[i][0], 0, crumbs[i][1]) : behindPlayer(6);
  pal.pos.set(p.x, height(p.x, p.z), p.z); pal.heading = player.heading; pal.speed = 0; ci = i; stuck = 0;
}
function moveTo(tx, tz, want, dt, turn) {
  const dx = tx - pal.pos.x, dz = tz - pal.pos.z, d = Math.hypot(dx, dz);
  if (d > 0.05) pal.heading += wrapA(Math.atan2(dx, dz) - pal.heading) * Math.min(1, dt * turn);
  pal.speed += (want - pal.speed) * Math.min(1, dt * 4);
  if (pal.speed > 0.05) {
    const step = Math.min(pal.speed * dt, d + 0.2), nx = pal.pos.x + Math.sin(pal.heading) * step, nz = pal.pos.z + Math.cos(pal.heading) * step;
    if (noRideZone(nx, nz) === 'shop') { pal.speed = 0; return d; } // 가게 터 안에는 들어가지 않음
    pal.pos.set(nx, height(nx, nz), nz);
  }
  return d;
}
const fightNow = () => !!(life.enemies?.active?.() || late.swarmOn?.());
function tickFollow(dt, time) {
  const turn = DP.turn[palLv()], dp = palD();
  pal.state = 'follow';
  if (state.cave) { pal.speed = 0; pal.state = 'graze'; return; } // 동굴: 밖에서 기다림
  if (late.innBusy?.()) { pal.speed = 0; pal.state = 'graze'; return; } // 숙소에서 묵는 동안 (#270): 앞마당에서 기다림
  if (calling) { // 휘파람: 곧장 달려옴
    if (dp < 2.2) { calling = false; pal.speed = 0; pal.heading = Math.atan2(player.pos.x - pal.pos.x, player.pos.z - pal.pos.z); return; }
    if (dp > DP.tp) teleport(); moveTo(player.pos.x, player.pos.z, DP.run * 1.1, dt, 8); ci = -1; return;
  }
  if (fightNow()) { // 싸움·서바이벌 판: 멀찍이 물러나 기다림
    if (dp < DP.wait) { const ax = pal.pos.x - player.pos.x, az = pal.pos.z - player.pos.z, k = (DP.wait + 1) / Math.max(0.1, dp); moveTo(player.pos.x + ax * k, player.pos.z + az * k, 6, dt, 6); }
    else { pal.speed += (0 - pal.speed) * Math.min(1, dt * 4); pal.state = 'graze'; }
    ci = -1; return;
  }
  if (oddT > 0 && oddAt) { oddT -= dt; pal.speed = 0; pal.heading += wrapA(Math.atan2(oddAt.x - pal.pos.x, oddAt.z - pal.pos.z) - pal.heading) * Math.min(1, dt * 5); pal.state = 'alert'; return; }
  if (dp > DP.tp) { teleport(); return; }
  const back = player.speed > 6 ? DP.back[1] : DP.back[0];
  if (dp < back + 0.4 || crumbs.length < 2) { // 가까움: 멈춰 플레이어 쪽을 봄 (풀 뜯기)
    pal.speed += (0 - pal.speed) * Math.min(1, dt * 5); if (dp < back + 0.4) pal.heading += wrapA(Math.atan2(player.pos.x - pal.pos.x, player.pos.z - pal.pos.z) - pal.heading) * Math.min(1, dt * 2);
    pal.state = player.speed < 0.3 ? 'graze' : 'follow'; stuck = 0; lastD = dp; return;
  }
  // 발자취 따라: ci 번째 자리로, 닿으면 다음. 목표는 플레이어 뒤 back m
  const goal = crumbBack(back);
  if (ci < 0 || ci >= crumbs.length) { let b = 0, bd = Infinity; for (let i = 0; i < crumbs.length; i++) { const d = Math.hypot(crumbs[i][0] - pal.pos.x, crumbs[i][1] - pal.pos.z); if (d < bd) { bd = d; b = i; } } ci = b; }
  while (ci < goal && Math.hypot(crumbs[ci][0] - pal.pos.x, crumbs[ci][1] - pal.pos.z) < 1.0) ci++;
  if (ci > goal) ci = goal;
  const [tx, tz] = crumbs[ci];
  moveTo(tx, tz, Math.min(DP.run, Math.max(2, player.speed) + (dp - back) * (0.6 + 0.2 * palLv())), dt, turn);
  // 막힘: 멀리 있는데 stuckT 초 동안 가까워지지 않음 → 순간 이동
  if (dp > 8 && dp >= lastD - 0.02) { stuck += dt; if (stuck > DP.stuckT) teleport(); } else stuck = 0;
  lastD = dp;
}
function tickRidden(dt) {
  pal.state = 'ridden';
  const k = Math.min(1, pal.speed / DEER.rideRun);
  if (k > 0.02) { S.hg = Math.max(0, S.hg - (dt * k) / DP.hungerT * (S.sd ? DP.saddle.hunger : 1)); if (S.hg <= 0 && !emptyTold) { emptyTold = true; toast(`${S.n}이(가) 배고파요. 띠를 눌러 귤을 주면 다시 달려요`, 3.4); } }
}

// ---------- 남의 노루 (presence dp·dpr) ----------
const peerPals = new Map(); // 사람 id → 노루
function tickPeers(dt, time) {
  const peers = net?.peersById, want = [];
  if (peers && !net.solo) for (const [id, e] of peers) { const n = e.data?.dp; if (typeof n !== 'string' || !n || n.length > 16) continue; const d = Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z); if (d < DP.peerR) want.push([d, id, e]); }
  want.sort((a, b) => a[0] - b[0]); const keep = new Set(want.slice(0, DP.peers).map((w) => w[1]));
  for (const [id, o] of peerPals) if (!keep.has(id)) { scene.remove(o.root); peerPals.delete(id); }
  for (const [, id, e] of want.slice(0, DP.peers)) {
    let o = peerPals.get(id);
    if (!o) { const at = new THREE.Vector3(e.pos.x - Math.sin(e.heading) * 4, 0, e.pos.z - Math.cos(e.heading) * 4); o = makeDeer(at, e.heading); peerPals.set(id, o); }
    if (e.data.dpr) { o.state = 'ridden'; o.pos.set(e.pos.x, height(e.pos.x, e.pos.z), e.pos.z); o.heading = e.heading; o.speed = e.speed || 0; }
    else {
      o.state = 'follow';
      const bx = e.pos.x - Math.sin(e.heading) * DP.back[0], bz = e.pos.z - Math.cos(e.heading) * DP.back[0], dx = bx - o.pos.x, dz = bz - o.pos.z, d = Math.hypot(dx, dz);
      if (d > 30) { o.pos.set(bx, 0, bz); o.speed = 0; }
      else if (d > 0.6) { o.heading += wrapA(Math.atan2(dx, dz) - o.heading) * Math.min(1, dt * 5); o.speed += (Math.min(DP.run, (e.speed || 0) + d * 0.8) - o.speed) * Math.min(1, dt * 4); const st = Math.min(o.speed * dt, d); o.pos.x += Math.sin(o.heading) * st; o.pos.z += Math.cos(o.heading) * st; }
      else { o.speed *= Math.max(0, 1 - dt * 5); o.heading += wrapA(e.heading - o.heading) * Math.min(1, dt * 2); }
      o.pos.y = height(o.pos.x, o.pos.z);
    }
    animate(o, dt, time, o.state === 'ridden' ? 0.1 : undefined);
  }
}

// ---------- 루프 (update.js) ----------
let slow = 0, apiSet = false;
late.tickDeerPal = (dt) => {
  const time = performance.now() / 1000;
  bindEmo();
  if (!apiSet && window.__oreum) { apiSet = true; window.__oreum.deerPal = api; }
  if (!S.open && (zoneNow >= DP.zone || (save.journey?.maxZ || 0) >= DP.zone)) { S.open = 1; persist(); }
  if ((slow -= dt) <= 0) {
    slow = 1;
    if (pending && $('deerwin').hidden) { $('deerwin').hidden = false; nameDone(true); } // 다른 창이 닫아 버렸으면(closePanels) 아무 이름으로 데려감
    if (S.n && !pal && !hiddenNow()) spawnPal(null);
    syncTaken();
    if (pal && player.riding !== pal && !calling && oddT <= 0 && !fightNow()) checkOdd(performance.now());
  }
  tickPeers(dt, time);
  if (!pal) { hungerUI(); return; }
  const hide = hiddenNow(); if (pal.root.visible === hide) pal.root.visible = !hide;
  if (hide) return;
  addCrumb();
  if (player.riding === pal) tickRidden(dt);
  else { S.hg = Math.min(1, S.hg + dt / DP.regenT); tickFollow(dt, time); }
  if ((saveT -= dt) <= 0) { saveT = 5; persist(); }
  animate(pal, dt, time, player.riding === pal ? 0.1 : pal.state === 'alert' ? -0.25 : undefined);
  wantDeer(palD());
  hungerUI();
};

// ---------- 가게·가방 ----------
const SADDLE_STAT = `빠르기 ×${(1 / DP.bare).toFixed(2)} · 배고픔 -${Math.round((1 - DP.saddle.hunger) * 100)}%`;
function buySaddle(cell) {
  if (S.sd) return;
  const P = DP.saddle.price; if (save.coins < P) { toast(`귤이 ${P - save.coins}개 모자라요`); return; }
  const from = save.coins; save.coins -= P; S.sd = 1; persist(); updateStats(); late.sound?.coin?.();
  late.refreshShopPop?.();
  const c = document.querySelector('#shoppop-cards .menu-card[data-id="saddle"]') || cell;
  if (c) { c.classList.add('tier-pop'); late.spendFx?.(c, P, from, document.querySelector('#shoppop .coins-pill'), $('shoppop-coins')); }
  toast(pal ? `노루 안장을 샀어요. ${S.n}이(가) 더 빨라요` : '노루 안장을 샀어요. 노루 한 마리가 따라와요');
  if (!pal) askName('gift'); // 내 노루가 없으면 바로 한 마리 (잃는 것이 없게)
}
const DEER_SVG = (c = 'food') => `<svg class="${c}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ic('deer')}</svg>`;
const api = {
  state: () => ({ open: !!S.open, name: S.n, id: S.id, fed: S.fed, lv: palLv(), hunger: +S.hg.toFixed(4), saddle: !!S.sd, f: { ...S.f }, on: !!pal, vis: !!pal?.root.visible, d: pal ? +palD().toFixed(2) : null, st: pal?.state || null, riding: !!pal && player.riding === pal, calling, odd: oddT > 0, crumbs: crumbs.length, peers: peerPals.size, nameOpen: !$('deerwin').hidden }),
  pal: () => pal, act: () => late.deerPalAct()?.label || null, doAct: () => late.deerPalAct()?.act(),
  feedWild: (id) => feedWild(id ? life.deerById(id) : life.nearestDeer(player.pos, 1e9)), feedPal, onFed: (id) => onFed(life.deerById(id)),
  name: (v) => { $('deer-name').value = v; nameRefresh(); nameDone(false); return !$('deerwin').hidden; }, closeName: () => nameDone(true),
  mount: mountPal, off: () => { if (player.riding === pal) dismountDeer(); }, whistle, want: (w) => late.deerPalWant(w),
  hunger: (v) => { S.hg = Math.max(0, Math.min(1, v)); emptyTold = false; hungerUI(true); }, teleport: () => pal && teleport(), release: releasePal,
  buySaddle: () => buySaddle(null), odd: oddSpots, emoCell: () => !!state.emo?.extra?.(), presence: () => late.deerPal.presence(),
  reset: () => { dropPal(); save.deerPal = {}; Object.assign(S, { n: '', id: '', fed: 0, hg: 1, sd: 0, open: 0, f: {} }); save.deerPal = S; syncTaken(); persist(); },
};
late.deerPal = {
  presence: () => (pal && !hiddenNow() ? { dp: S.n, ...(player.riding === pal ? { dpr: 1 } : {}) } : {}),
  peerMount: (e) => peerPals.get(e.peer) || null, // ride.js peerRide: 남이 자기 노루를 탔을 때 걸터앉는 높이
  saddleCard(grid) {
    const own = !!S.sd, b = document.createElement('button'); b.type = 'button'; b.className = 'menu-card'; b.dataset.id = 'saddle';
    b.classList.toggle('poor', !own && save.coins < DP.saddle.price); b.classList.toggle('on', own); b.title = `노루 안장 · 내 노루 ${SADDLE_STAT}`;
    b.innerHTML = `${DEER_SVG()}<span class="mn"><b>노루 안장</b><small>${SADDLE_STAT}</small></span><span class="mv">${own ? '<span class="bf">✓</span>' : `<span class="price"><i></i>${DP.saddle.price.toLocaleString()}</span>`}</span>`;
    if (!own) b.addEventListener('click', () => buySaddle(b));
    grid.append(b);
  },
  bagCard(g, card, close) {
    if (!S.n) return;
    const on = !!pal && player.riding === pal, x = document.createElement('button'); x.type = 'button'; x.className = 'chip go call'; x.textContent = on ? '내리기' : '부르기';
    x.addEventListener('click', (e) => { e.stopPropagation(); close?.(); if (on) dismountDeer(); else whistle(); });
    g.append(card({ icon: DEER_SVG(''), name: S.n, sub: `친해짐 ${palLv() + 1}단계 · 배 ${Math.round(S.hg * 100)}%${S.sd ? ' · 안장' : ''}`, on, own: true, click: null, extra: x }));
  },
};
