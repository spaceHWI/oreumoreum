// 클린하우스(버리기·화살표·자동 걷기), 상호작용 버튼이 고르는 할 일 (#86 에서 main.js 를 나눔. 파일 순서는 src/main.js, 규칙은 notes/prototype-v1.md 코드 구조)
import { nsPaths } from '../namsongi.js';
import { TRASH_TYPES, CLEANHOUSE, TUT } from '../balance.js';
import { ic } from '../icons.js';
import { buildTrailGraph, trailRoute } from '../autowalk.js';
import * as THREE from 'three';
import { height } from '../world.js';
import { LOW } from '../gfx2.js';
import { state, late } from './state.js';
import { $, save, wearV, persist } from './save.js';
import { augV } from '../augments.js';
import { scene, camera } from './scene.js';
import { life, trash, CH, CHS, chNear, cart, GEARB, roofSigns, player, hp } from './place.js';
import { cam } from './camera.js';
import { ui, topFit, toast, addCoins, panelOpen, busy, ach } from './hud.js';
import { marker, setTarget } from './input.js';
import { updateAmmo } from './throw.js';
import { rideOffAct, cartOnAct, cartOffAct, cartNear } from './ride.js';
import { mountDeer, rePoseAct } from './moves.js';
import { social } from './room.js';
import { mealS, skipAct, cutS, cutSkipAct, interactables, fishAct, dismountAct, standAct, throwAct, pickBtn } from './stores.js';
import { pickS, bagRoom, canPick, updateTrashUI, seekS, seekable } from './pickup.js';

Object.assign(late, { dumpBag, placeArrow, stopAutoGo, startAutoGo }); // 앞 파일에서 부르는 함수

// ---------- 클린하우스: 배낭 비우고 귤 받기 ----------
// 귤·저장은 누르는 순간 한 번에 처리하고, 날아가는 쓰레기와 올라가는 숫자는 연출만 한다
const dumpS = { list: [], t: 0, dur: 0, total: 0, shown: 0, el: null, sndT: 0 };
export function dumpBag(ch = chNear()) {
  if (!ch || dumpS.el) return;
  const bag = trash.store.bag, per = []; let n = 0, g = 0;
  const vk = 1 + wearV('vest') + augV(save, 'recycle'); // 베스트(#52)·분리수거 달인 증강(#159): 받는 귤 더함
  // 구역 귤 배수 (#137): 주울 때 모아 둔 bag.xv 를 종류별 귤에 비례해 나눠 더함
  const base = TRASH_TYPES.reduce((s, t) => s + (bag[t.id] || 0) * t.gyul, 0), zk = base > 0 ? 1 + (bag.xv || 0) / base : 1;
  TRASH_TYPES.forEach((t, k) => { const c = bag[t.id] || 0; if (c > 0) { const pg = Math.round(c * t.gyul * zk * vk); per.push({ k, c, g: pg }); n += c; g += pg; } });
  if (!n) { toast('배낭이 비었어요. 쓰레기를 주워 와요'); return; }
  TRASH_TYPES.forEach((t) => { bag[t.id] = 0; }); bag.xv = 0;
  save.recycle.visits++; save.recycle.gyul += g;
  trash.store.commit();
  late.gyulExpect?.(g); addCoins(g); late.tut.notify('dump'); // 귤 숫자는 쏟아지는 연출 뒤에 올라감 (#133)
  // 첫 보너스(#31): 처음 버릴 때 한 번만 귤이 TUT.firstBonus(200)가 되도록 채움. 연출은 버리기가 끝난 뒤 귤이 쏟아짐
  if (!save.firstBonus) { save.firstBonus = 1; const b = Math.max(0, TUT.firstBonus - save.coins); if (b > 0) late.gyulExpect?.(b); save.coins += b; persist(); late.tut.notify('bonus');
    if (b > 0) setTimeout(() => late.gyulShower(b), CLEANHOUSE.dumpTime * 1000 + 150); }
  ach.emit('recycle'); ach.emit('earn', g);
  updateTrashUI(true);
  // 날아갈 모양: 종류마다 개수 비례로 나누되 종류마다 하나는
  const cap = LOW ? CLEANHOUSE.flyMaxLow : CLEANHOUSE.flyMax, m = Math.min(n, cap);
  const vis = per.map((p) => Math.max(1, Math.round(m * p.c / n)));
  const seq = []; per.forEach((p, j) => { let left = p.g; for (let i = 0; i < vis[j]; i++) { const share = i === vis[j] - 1 ? left : Math.floor(p.g / vis[j]); left -= share; seq.push({ k: p.k, share }); } });
  // 종류별로 좌르륵 (#141): 섞지 않고 종류 하나씩 차례로 (per 는 종류 순서)
  const flyT = 0.5, spread = Math.max(0, CLEANHOUSE.dumpTime - flyT - 0.1), cols = trash.fxMats;
  const back = player.pos.clone(); back.y = player.visY + 1.45;
  dumpS.list = seq.map((q, i) => {
    const mesh = new THREE.Mesh(trash.geos[q.k], cols[q.k]); mesh.visible = false; scene.add(mesh);
    return { ...q, mesh, t0: seq.length > 1 ? spread * i / (seq.length - 1) : 0, dur: flyT, from: back.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, Math.random() * 0.3, (Math.random() - 0.5) * 0.6)), done: false };
  });
  dumpS.t = 0; dumpS.dur = CLEANHOUSE.dumpTime; dumpS.total = g; dumpS.shown = 0; dumpS.sndT = 0;
  const el = document.createElement('div'); el.className = 'fx-recycle'; el.innerHTML = '<i></i><b>+0</b>'; document.body.append(el); dumpS.el = el;
  player.target = null; player.onArrive = null; marker.visible = false; player.speed = 0;
  dumpS.ch = ch; player.heading = Math.atan2(ch.center.x - player.pos.x, ch.center.z - player.pos.z) || player.heading;
}
const chV = new THREE.Vector3();
export function tickDump(dt) {
  if (!dumpS.el) return;
  dumpS.t += dt; dumpS.sndT -= dt;
  for (const f of dumpS.list) {
    if (f.done) continue;
    const k = (dumpS.t - f.t0) / f.dur; if (k < 0) continue;
    const to = dumpS.ch.binTop[f.k];
    if (k >= 1) {
      f.done = true; scene.remove(f.mesh); dumpS.ch.pop(f.k); dumpS.shown += f.share;
      if (dumpS.sndT <= 0) { late.sound.pick?.(TRASH_TYPES[f.k].id); dumpS.sndT = 0.07; }
      continue;
    }
    f.mesh.visible = true; const e = k * k * (3 - 2 * k);
    f.mesh.position.lerpVectors(f.from, to, e); f.mesh.position.y += Math.sin(k * Math.PI) * 2.2;
    f.mesh.rotation.set(k * 7, k * 9, 0); f.mesh.scale.setScalar(1 - 0.35 * k);
  }
  const allDone = dumpS.list.every((f) => f.done);
  const n = allDone ? dumpS.total : dumpS.shown;
  const b = dumpS.el.querySelector('b'), txt = `+${n}`; if (b.textContent !== txt) { b.textContent = txt; dumpS.el.classList.remove('tick'); void dumpS.el.offsetWidth; dumpS.el.classList.add('tick'); }
  chV.copy(dumpS.ch.center); chV.y += dumpS.ch.small ? 3.6 : 4.6; chV.project(camera);
  dumpS.el.style.left = ((chV.x * 0.5 + 0.5) * innerWidth) + 'px'; dumpS.el.style.top = ((-chV.y * 0.5 + 0.5) * innerHeight - Math.min(1, dumpS.t / dumpS.dur) * 26) + 'px';
  dumpS.el.style.visibility = chV.z > 1 ? 'hidden' : '';
  if (allDone && !dumpS.end) { dumpS.end = true; late.sound.recycle?.(); if (dumpS.total > 0) late.gyulShower?.(dumpS.total); // 귤이 쏟아짐 (#89)
    toast(`클린하우스에 버렸어요 · 귤 +${dumpS.total}`); setTimeout(() => late.rankAfterDump?.(), 1600); } // 순위가 오르면 토스트는 버린 토스트 뒤에 (#11)
  if (dumpS.t > dumpS.dur + 0.9) { if (late.canBuyGear().length) { state.shopHintUntil = performance.now() + CLEANHOUSE.shopHint * 1000; cartHint(dumpS.ch); } dumpS.el.remove(); dumpS.el = null; dumpS.end = false; dumpS.list.forEach((f) => scene.remove(f.mesh)); dumpS.list = []; }
}
// 능선·굼부리(정상 아래) 클린하우스에서 버리고 살 장비가 있으면: 가게 거리까지는 마차가 빠르다는 안내 (#128, 세션에 한 번. 순간 이동은 없음)
let cartHinted = false;
function cartHint(ch) { if (cartHinted || !cart || !['rest', 'crater'].includes(ch?.id) || !late.goShop) return; cartHinted = true; setTimeout(() => toast('장비점은 가게 거리에 있어요 · 마차를 타면 빨라요'), 2600); }
// 배낭이 찼을 때 클린하우스 방향: 화면 밖이면 가장자리 화살표, 보이면 위에서 가리킴
const chArrow = $('ch-arrow'), shopArrow = $('shop-arrow');
state.shopHintUntil = 0; // 버린 직후 살 수 있는 장비가 있으면 이때까지 장비점 쪽 표시
// 목표가 화면 안이면 위에서 가리키고, 밖이면 가장자리에서 그 방향 화살표
const edgeAt = new Map();
// 표시 크기(반폭·반높이). 클린하우스 표시는 아래 거리 글자까지 (#90)
const markBox = (el) => { let b = el._box; if (!b) { const w = el.offsetWidth || 40, h = el.offsetHeight || 40; b = el._box = [w / 2 + 3, h / 2 + 3, el.querySelector('small') ? 16 : 0]; } return b; };
const TOP_IDS = ['msg-log', 'msg-pin', 'tut-toast'], topAt = [-1, 0]; /* #252 메시지 줄 */
// 위쪽 줄 + 그 아래 토스트·팁·배너 (보일 때) 아래로 (#90: 다시 들어올 때 긴 토스트가 가장자리 표시를 가림). 프레임마다 한 번만 잼
const topLimit = (fr) => { if (topAt[0] !== fr) { let b = topFit.bottom + 72; for (const id of TOP_IDS) { const e = document.getElementById(id); if (e && !e.hidden && e.childElementCount + (id === 'tut-toast' ? 1 : 0)) b = Math.max(b, e.getBoundingClientRect().bottom + 30); } topAt[0] = fr; topAt[1] = b; } return topAt[1]; };
export function placeArrow(el, wp, lift) {
  // 표시끼리 겹치면 비켜 놓음 (#16: 클린하우스·가판대·마차 표시가 한 자리에 겹침).
  // #90: 이번 프레임에 이미 놓인 표시만 비교하고(지난 프레임 자리와 비교하면 순간 이동·카메라가 돌 때 겹침), 크기(거리 글자 포함)로 겹침을 잼
  const fr = document.timeline?.currentTime ?? 0, me = markBox(el), edgeUsed = [];
  edgeAt.forEach((v, o) => { if (o !== el && !o.hidden && v[2] === fr) edgeUsed.push(v); });
  const hit = (x, y) => edgeUsed.some(([ux, uy, , b]) => Math.abs(ux - x) < me[0] + b[0] && (uy < y ? y - uy < me[1] + b[1] + b[2] : uy - y < me[1] + b[1] + me[2]));
  chV.copy(wp); chV.y += lift; chV.project(camera);
  const W = innerWidth, H = innerHeight, behind = chV.z > 1;
  let x = chV.x, y = chV.y; if (behind) { x = -x; y = -y; }
  const vis = !behind && Math.abs(x) < 0.85 && Math.abs(y) < 0.8;
  let sx, sy, ang;
  if (vis) { sx = (x * 0.5 + 0.5) * W; sy = (-y * 0.5 + 0.5) * H - 30; ang = Math.PI / 2; }
  else {
    // 가운데에서 그 방향으로 뻗어 화면 안쪽 테두리에 닿는 곳
    const phone = W <= 600, mL = 40, mR = 40, mT = Math.min(H / 2 - 40, topLimit(fr)), mB = phone ? 240 : 120; // 위쪽 줄·토스트 아래 (#75). 폰 아래는 동작 버튼 위 (#90)
    let dx = x * W / 2, dy = -y * H / 2; if (Math.hypot(dx, dy) < 1e-3) dy = 1;
    const cx = W / 2, cy = H / 2;
    const tx = dx > 0 ? (W - mR - cx) / dx : dx < 0 ? (mL - cx) / dx : 1e9, ty = dy > 0 ? (H - mB - cy) / dy : dy < 0 ? (mT - cy) / dy : 1e9;
    const t = Math.min(tx, ty); sx = cx + dx * t; sy = cy + dy * t; ang = Math.atan2(dy, dx);
    const side = tx <= ty, G = 24, bx = sx, by = sy;
    // 테두리를 따라 가까운 빈자리: 가운데 쪽·바깥쪽을 번갈아 조금씩 넓혀 감
    for (let k = 1; k < 24 && hit(sx, sy); k++) {
      const off = Math.ceil(k / 2) * G * (k % 2 ? 1 : -1);
      if (side) { sx = bx; sy = Math.max(mT, Math.min(H - mB, by + (by > cy ? -off : off))); } else { sy = by; sx = Math.max(mL, Math.min(W - mR, bx + (bx > cx ? -off : off))); }
    }
  }
  if (vis) { // 화면 안에서 가리키는 표시는 위로 쌓음. 위쪽 줄·토스트 아래로만 (#90: 멀리 있는 곳을 가리키면 토스트에 겹침), 위가 막히면 아래로
    const minY = topLimit(fr) - 30 + me[1]; sy = Math.max(sy, minY); const by = sy;
    for (let k = 1; k <= 12 && hit(sx, sy); k++) { const c = k <= 6 ? by - 24 * k : by + 24 * (k - 6); if (c >= minY) sy = c; }
  }
  edgeAt.set(el, [sx, sy, fr, me]);
  el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
  el.style.setProperty('--a', ang.toFixed(3) + 'rad');
}
// 클린하우스 표시를 누르면 탐방로를 따라 자동으로 걸어감 (#40). 조이스틱·방향키·다시 누르기·패널 열림·쓰러짐이면 멈춤
let autoGo = null, trailG = null; export { autoGo };
export function stopAutoGo() { if (!autoGo) return; player.running = autoGo.run; player.gait = autoGo.gait; autoGo = null; if (player.target) { player.target = null; player.onArrive = null; marker.visible = false; } }
// dest (#128 가게 길 안내): { pos, near, arrive() } 가 있으면 클린하우스 대신 그곳까지. 도착하면 arrive()
// 길 거리로 가장 가까운 클린하우스 (#78)
const routeLen = (from, r) => { let L = 0, a = from; for (const q of r) { L += Math.hypot(q.x - a.x, q.z - a.z); a = q; } return L; };
export function chRoute() {
  if (!trailG) trailG = buildTrailGraph(nsPaths, 6);
  let best = null;
  for (const c of CHS) { const r = trailRoute(trailG, player.pos, c.front), L = routeLen(player.pos, r); if (!best || L < best.L) best = { ch: c, r, L }; }
  return best;
}
late.trailRoute = (from, to) => { if (!trailG) trailG = buildTrailGraph(nsPaths, 6); return trailRoute(trailG, from, to); }; // 줍기 버튼 걷기도 같은 길 찾기 (#104)
export function startAutoGo(dest = null) {
  if ((!CH && !dest) || busy() || player.riding || hp.isDown) return false;
  if (autoGo) { if (!dest) return false; stopAutoGo(); }
  let route, ch = null;
  if (dest) {
    if (player.pos.distanceTo(dest.pos) < (dest.near || 2)) { dest.arrive?.(); return true; }
    route = late.trailRoute(player.pos, dest.pos).map((q) => new THREE.Vector3(q.x, height(q.x, q.z), q.z));
    const last = route[route.length - 1]; if (!last || Math.hypot(last.x - dest.pos.x, last.z - dest.pos.z) > 0.5) route.push(dest.pos.clone());
  } else {
    const b = chRoute(); if (!b) return false; ch = b.ch;
    route = b.r.map((q) => new THREE.Vector3(q.x, height(q.x, q.z), q.z));
    if (player.pos.distanceTo(b.ch.front) < CLEANHOUSE.arrowNear * 0.4) return false;
  }
  autoGo = { route, i: 0, cur: null, run: player.running, gait: player.gait, ch, dest }; player.running = true;
  const nextWp = () => { const last = autoGo.i === autoGo.route.length - 1; setTarget(autoGo.route[autoGo.i], last ? () => { const d = autoGo?.dest; stopAutoGo(); d?.arrive?.(); } : null); if (!last) marker.visible = false; autoGo.cur = player.target; };
  autoGo.next = nextWp; nextWp();
  return true;
}
export function tickAutoGo() {
  if (!autoGo) return;
  if (busy() || hp.isDown || player.riding || player.target !== autoGo.cur || (!CH && !autoGo.dest)) { stopAutoGo(); return; }
  const last = autoGo.i === autoGo.route.length - 1;
  const dc = Math.hypot(autoGo.cur.x - player.pos.x, autoGo.cur.z - player.pos.z);
  if (!last && dc < 2.4) { autoGo.i++; autoGo.next(); } else if (last && dc < 0.9) { const d = autoGo.dest; stopAutoGo(); d?.arrive?.(); } // 클린하우스는 도착하면 멈추기만 함(버리기는 직접), 가게는 창을 엶
}
chArrow.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); });
chArrow.addEventListener('click', (e) => { e.stopPropagation(); if (autoGo?.ch) stopAutoGo(); else startAutoGo(); });
// 길 안내는 한 번에 하나 (#201): 배낭이 찬 클린하우스·장비점 짧은 표시·추적 퀘스트가 있으면 마차·가게 가장자리 표시(ride.js·stores.js)는 쉼
late.guideBusy = () => !chArrow.hidden || !shopArrow.hidden || !!late.questGuiding?.();
export function tickChArrow() {
  const full = !!CH && bagRoom() < 1;
  const ch = autoGo?.ch || chNear(); // 가는 중이면 그곳, 아니면 가장 가까운 곳 (#78)
  const on = !!ch && (full || !!autoGo?.ch) && !dumpS.el && cam.mode !== 'wardrobe' && !panelOpen() && (player.pos.distanceTo(ch.front) > CLEANHOUSE.arrowNear || !!autoGo?.ch); // 배낭이 찼거나 가는 중일 때만 (#201)
  if (!on) { if (!chArrow.hidden) chArrow.hidden = true; }
  else {
    chArrow.hidden = false; placeArrow(chArrow, ch.center, ch.small ? 3.2 : 4.2);
    chArrow.classList.toggle('full', full); chArrow.classList.toggle('going', !!autoGo?.ch);
    const d = Math.round(player.pos.distanceTo(ch.front)) + 'm', dn = chArrow.querySelector('small'); if (dn.textContent !== d) dn.textContent = d;
  }
  // 장비점 쪽 짧은 표시 (#128): 가게 거리 장비점 지붕 간판 (거리가 없는 맵만 옆 가판대). 앞에 오면 끝. #221 튜토리얼도 거리 장비점
  if (!CH) return;
  { const stall = !GEARB; if (CH.mark.visible !== stall) CH.mark.visible = stall; } /* 가판대 위 귤 표시는 가게 거리가 없는 맵만 */
  const hint = !GEARB ? { at: CH.stallTop, door: CH.shopFront, r: CLEANHOUSE.shopR } : { at: roofSigns?.signs.gear?.pos || GEARB.signPos, door: GEARB.door, r: GEARB.r };
  if (state.shopHintUntil && (performance.now() > state.shopHintUntil || player.pos.distanceTo(hint.door) < hint.r || !late.canBuyGear().length)) state.shopHintUntil = 0;
  const so = !!state.shopHintUntil && !dumpS.el && cam.mode !== 'wardrobe' && !panelOpen();
  if (!so) { if (!shopArrow.hidden) shopArrow.hidden = true; return; }
  shopArrow.hidden = false; placeArrow(shopArrow, hint.at, 0.9);
}
export function updateContext() {
  let best = null, bd = 1e9;
  if (state.photoState && !state.photoState.shot) best = rePoseAct; // 찍기 전: 다시 누르면 포즈 바꾸기 (#70)
  else if (player.pose === 'sit') best = mealS.on ? skipAct : cutS.on ? cutSkipAct : standAct;
  else if (player.riding && !busy()) best = dismountAct;
  else if (player.cart) best = cartOffAct; // 마차 (#69): 내리기. 달리는 중에도 옆 길 위로 (#120), 점프는 뛰어내리기
  else if (!busy() && !player.onArrive) {
    for (const it of interactables) { if (it.when && !it.when()) continue; const d = it.pos.distanceTo(player.pos); if (d < it.r && d < bd) { bd = d; best = it; } }
    const d = life.nearestDeer(player.pos, 2.6);
    if (d) { if (!state.deerAct || state.deerAct.deer !== d) state.deerAct = { deer: d, label: '노루 타기', act: () => mountDeer(d) }; best = state.deerAct; }
    if (cart && !best && cartNear()) best = cartOnAct; // 정류장에 마차가 서 있거나 (#69) 달리는 마차 가까이면 (#120) 타기. 탈것 가게가 닫혀 있어도 마차는 탐 (#244)
    if (state.fishing && !player.ride && (state.fishing.active || (!best && state.fishing.canFish()))) best = fishAct; // 개울 물가면 낚시 (#44)
    if (!best) best = player.ride ? rideOffAct : throwAct; // 할 일이 없으면 귤 던지기 (탈것 위에선 내리기)
  }
  if (best !== state.ctxTarget) { state.ctxTarget = best; ui.ctx.classList.toggle('idle', !best); ui.ctx.classList.toggle('soft', best === throwAct); }
  { const em = best === throwAct && throwAct.empty; if (ui.ctx.classList.contains('empty') !== em) ui.ctx.classList.toggle('empty', em); } // 귤이 없음 (#148)
  { const bite = best === fishAct && state.fishing.phase === 'bite'; if (ui.ctx.classList.contains('bite') !== bite) ui.ctx.classList.toggle('bite', bite); }
  let label = '상호작용';
  if (best) label = best.cairn ? ((social.stones.get(best.cairn.id) || []).some((e) => e.mine) ? '소원 보기' : '돌 올리기') : best.label;
  const span = ui.ctx.querySelector('span');
  if (span.textContent !== label) { span.textContent = label; ui.ctx.title = `${label} (F)`; }
  const ic = best ? (best.ic || (best.cairn ? 'cairn' : best.deer ? 'deer' : best.peer ? 'hand' : 'do')) : 'do';
  if (ui.ctx.dataset.ic !== ic) { ui.ctx.dataset.ic = ic; ui.ctx.querySelector('svg').innerHTML = CTX_ICON[ic] || CTX_ICON.do; }
  updateAmmo();
  // 줍기 버튼: 찾는 거리(#104) 안에도 주울 쓰레기가 없으면 흐리게
  const can = state.cave ? !!late.caveCanPick?.() : pickS.cyc >= 0 || !!seekS.on || canPick() || seekable(); /* 동굴 안은 동굴 더미 (#195) */
  if (pickBtn.classList.contains('dim') === can) pickBtn.classList.toggle('dim', !can);
}
// 상호작용 버튼 아이콘 (지금 될 동작)
const CTX_ICON = {
  do: ic('do'),
  bow: ic('bow'),
  gun: ic('gun'), // 무기 3~6단계 (#123, 상점 그림과 같음)
  mg: ic('mg'),
  laser: ic('laser'),
  bomb: ic('bomb'),
  throw: ic('gyul-throw'),
  dump: ic('cleanhouse'),
  tube: ic('recycle'), // 수거 관 (#248)
  give: ic('gift'),
  field: ic('field'), // 서바이벌 터 징 (#231, game/arena.js) // 귤 주기 (#175)
  chest: ic('chest'), // 숨은 보물 (#138)
  shop: ic('shop'),
  cairn: ic('cairn'),
  photo: ic('photo'),
  sit: ic('sit'),
  sign: ic('sign'),
  quest: ic('quest'), // 퀘스트 주는 사람에게 말 걸기 (#158)
  rank: ic('rank'), // 랭킹 (#11)
  deer: ic('deer'),
  hand: ic('together'),
  stand: ic('stand'),
  down: ic('down'),
  ride: ic('ride'), cart: ic('cart'), // 탈것 가게·마차 (#69)
  fish: ic('fish'),
  reel: ic('reel'),
  eat: ic('eat'), // 식사 (#50)
  cut: ic('cut'), // 머리 (#58)
  wear: ic('wear'), // 옷 (#59)
  gear: ic('gear'), // 장비점 (#128)
  dir: ic('map'), // 가게 안내도 (#128)
  skip: ic('skip'),
  steps: ic('steps'), // 지름길 (#139)
};
