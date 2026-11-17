// 클린하우스(버리기·화살표·자동 걷기), 상호작용 버튼이 고르는 할 일 (#86 에서 main.js 를 나눔. 파일 순서는 src/main.js, 규칙은 notes/prototype-v1.md 코드 구조)
import { nsPaths } from '../namsongi.js';
import { TRASH_TYPES, CLEANHOUSE, TUT } from '../balance.js';
import { RIDE_ICON } from '../rides.js';
import { SCISSORS, SHIRT } from '../shops.js';
import { FORK_KNIFE } from '../stoneicons.js';
import { buildTrailGraph, trailRoute } from '../autowalk.js';
import * as THREE from 'three';
import { height } from '../world.js';
import { LOW } from '../gfx2.js';
import { state, late } from './state.js';
import { $, save, wearV, persist } from './save.js';
import { scene, camera } from './scene.js';
import { life, trash, CH, CHS, chNear, cart, player, hp } from './place.js';
import { cam } from './camera.js';
import { ui, topFit, toast, addCoins, panelOpen, busy, ach } from './hud.js';
import { marker, setTarget } from './input.js';
import { updateAmmo } from './throw.js';
import { rideOffAct, cartOnAct, cartOffAct } from './ride.js';
import { mountDeer, rePoseAct } from './moves.js';
import { social } from './room.js';
import { mealS, skipAct, cutS, cutSkipAct, interactables, fishAct, dismountAct, standAct, throwAct, pickBtn } from './stores.js';
import { pickS, bagRoom, canPick, updateTrashUI } from './pickup.js';

Object.assign(late, { dumpBag, placeArrow, stopAutoGo, startAutoGo }); // 앞 파일에서 부르는 함수

// ---------- 클린하우스: 배낭 비우고 귤 받기 ----------
// 귤·저장은 누르는 순간 한 번에 처리하고, 날아가는 쓰레기와 올라가는 숫자는 연출만 한다
const dumpS = { list: [], t: 0, dur: 0, total: 0, shown: 0, el: null, sndT: 0 };
export function dumpBag(ch = chNear()) {
  if (!ch || dumpS.el) return;
  const bag = trash.store.bag, per = []; let n = 0, g = 0;
  const vk = 1 + wearV('vest'); // 베스트(#52): 받는 귤 더함
  TRASH_TYPES.forEach((t, k) => { const c = bag[t.id] || 0; if (c > 0) { const pg = Math.round(c * t.gyul * vk); per.push({ k, c, g: pg }); n += c; g += pg; } });
  if (!n) { toast('배낭이 비었어요. 쓰레기를 주워 와요'); return; }
  TRASH_TYPES.forEach((t) => { bag[t.id] = 0; });
  save.recycle.visits++; save.recycle.gyul += g;
  trash.store.commit();
  addCoins(g); late.tut.notify('dump');
  // 첫 보너스(#31): 처음 버릴 때 한 번만 귤이 TUT.firstBonus(200)가 되도록 채움. 연출은 버리기가 끝난 뒤 귤이 쏟아짐
  if (!save.firstBonus) { save.firstBonus = 1; const b = Math.max(0, TUT.firstBonus - save.coins); save.coins += b; persist(); late.tut.notify('bonus');
    if (b > 0) setTimeout(() => late.gyulShower(b), CLEANHOUSE.dumpTime * 1000 + 150); }
  ach.emit('recycle'); ach.emit('earn', g);
  updateTrashUI(true);
  // 날아갈 모양: 종류마다 개수 비례로 나누되 종류마다 하나는
  const cap = LOW ? CLEANHOUSE.flyMaxLow : CLEANHOUSE.flyMax, m = Math.min(n, cap);
  const vis = per.map((p) => Math.max(1, Math.round(m * p.c / n)));
  const seq = []; per.forEach((p, j) => { let left = p.g; for (let i = 0; i < vis[j]; i++) { const share = i === vis[j] - 1 ? left : Math.floor(p.g / vis[j]); left -= share; seq.push({ k: p.k, share }); } });
  for (let i = seq.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [seq[i], seq[j]] = [seq[j], seq[i]]; } // 종류를 섞어서 차례로
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
  if (allDone && !dumpS.end) { dumpS.end = true; late.sound.recycle?.(); toast(`클린하우스에 버렸어요 · 귤 +${dumpS.total}`); }
  if (dumpS.t > dumpS.dur + 0.9) { if (late.canBuyGear().length) state.shopHintUntil = performance.now() + CLEANHOUSE.shopHint * 1000; dumpS.el.remove(); dumpS.el = null; dumpS.end = false; dumpS.list.forEach((f) => scene.remove(f.mesh)); dumpS.list = []; }
}
// 배낭이 찼을 때 클린하우스 방향: 화면 밖이면 가장자리 화살표, 보이면 위에서 가리킴
const chArrow = $('ch-arrow'), shopArrow = $('shop-arrow');
state.shopHintUntil = 0; // 버린 직후 살 수 있는 장비가 있으면 이때까지 가판대 쪽 표시
// 목표가 화면 안이면 위에서 가리키고, 밖이면 가장자리에서 그 방향 화살표
const edgeAt = new Map();
export function placeArrow(el, wp, lift) {
  // 표시끼리 겹치면 비켜 놓음 (#16: 클린하우스·가판대·마차 표시가 한 자리에 겹침). 지금 보이는 다른 표시의 마지막 자리와 비교
  const edgeUsed = []; edgeAt.forEach((v, o) => { if (o !== el && !o.hidden) edgeUsed.push(v); });
  chV.copy(wp); chV.y += lift; chV.project(camera);
  const W = innerWidth, H = innerHeight, behind = chV.z > 1;
  let x = chV.x, y = chV.y; if (behind) { x = -x; y = -y; }
  const vis = !behind && Math.abs(x) < 0.85 && Math.abs(y) < 0.8;
  let sx, sy, ang;
  if (vis) { sx = (x * 0.5 + 0.5) * W; sy = (-y * 0.5 + 0.5) * H - 30; ang = Math.PI / 2; }
  else {
    // 가운데에서 그 방향으로 뻗어 화면 안쪽 테두리에 닿는 곳
    const phone = W <= 600, mL = 40, mR = 40, mT = topFit.bottom + 72, mB = phone ? 190 : 120; // 위쪽 줄·토스트 아래 (#75)
    let dx = x * W / 2, dy = -y * H / 2; if (Math.hypot(dx, dy) < 1e-3) dy = 1;
    const cx = W / 2, cy = H / 2;
    const tx = dx > 0 ? (W - mR - cx) / dx : dx < 0 ? (mL - cx) / dx : 1e9, ty = dy > 0 ? (H - mB - cy) / dy : dy < 0 ? (mT - cy) / dy : 1e9;
    const t = Math.min(tx, ty); sx = cx + dx * t; sy = cy + dy * t; ang = Math.atan2(dy, dx);
    const side = tx <= ty, G = 46;
    for (let k = 0; k < 6 && edgeUsed.some(([ux, uy]) => Math.hypot(ux - sx, uy - sy) < G); k++) {
      if (side) { sy += sy > cy ? -G : G; sy = Math.max(mT, Math.min(H - mB, sy)); } else { sx += sx > cx ? -G : G; sx = Math.max(mL, Math.min(W - mR, sx)); }
    }
  }
  if (vis) for (let k = 0; k < 4 && edgeUsed.some(([ux, uy]) => Math.hypot(ux - sx, uy - sy) < 40); k++) sy -= 40; // 화면 안에서 가리키는 표시는 위로 쌓음
  edgeAt.set(el, [sx, sy]);
  el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
  el.style.setProperty('--a', ang.toFixed(3) + 'rad');
}
// 클린하우스 표시를 누르면 탐방로를 따라 자동으로 걸어감 (#40). 조이스틱·방향키·다시 누르기·패널 열림·쓰러짐이면 멈춤
let autoGo = null, trailG = null; export { autoGo };
export function stopAutoGo() { if (!autoGo) return; player.running = autoGo.run; player.gait = autoGo.gait; autoGo = null; if (player.target) { player.target = null; player.onArrive = null; marker.visible = false; } }
// 길 거리로 가장 가까운 클린하우스 (#78)
const routeLen = (from, r) => { let L = 0, a = from; for (const q of r) { L += Math.hypot(q.x - a.x, q.z - a.z); a = q; } return L; };
export function chRoute() {
  if (!trailG) trailG = buildTrailGraph(nsPaths, 6);
  let best = null;
  for (const c of CHS) { const r = trailRoute(trailG, player.pos, c.front), L = routeLen(player.pos, r); if (!best || L < best.L) best = { ch: c, r, L }; }
  return best;
}
export function startAutoGo() {
  if (!CH || autoGo || busy() || player.riding || hp.isDown) return;
  const b = chRoute(); if (!b) return;
  const route = b.r.map((q) => new THREE.Vector3(q.x, height(q.x, q.z), q.z));
  if (player.pos.distanceTo(b.ch.front) < CLEANHOUSE.arrowNear * 0.4) return;
  autoGo = { route, i: 0, cur: null, run: player.running, gait: player.gait, ch: b.ch }; player.running = true;
  const nextWp = () => { const last = autoGo.i === autoGo.route.length - 1; setTarget(autoGo.route[autoGo.i], last ? () => { stopAutoGo(); } : null); if (!last) marker.visible = false; autoGo.cur = player.target; };
  autoGo.next = nextWp; nextWp();
}
export function tickAutoGo() {
  if (!autoGo) return;
  if (busy() || hp.isDown || player.riding || player.target !== autoGo.cur || !CH) { stopAutoGo(); return; }
  const last = autoGo.i === autoGo.route.length - 1;
  const dc = Math.hypot(autoGo.cur.x - player.pos.x, autoGo.cur.z - player.pos.z);
  if (!last && dc < 2.4) { autoGo.i++; autoGo.next(); } else if (last && dc < 0.9) stopAutoGo(); // 도착하면 멈추기만 함(버리기는 직접)
}
chArrow.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); });
chArrow.addEventListener('click', (e) => { e.stopPropagation(); if (autoGo) stopAutoGo(); else startAutoGo(); });
export function tickChArrow() {
  const full = !!CH && bagRoom() < 1;
  const ch = autoGo?.ch || chNear(); // 가는 중이면 그곳, 아니면 가장 가까운 곳 (#78)
  const on = !!ch && !dumpS.el && cam.mode !== 'wardrobe' && !panelOpen() && (player.pos.distanceTo(ch.front) > CLEANHOUSE.arrowNear || !!autoGo);
  if (!on) { if (!chArrow.hidden) chArrow.hidden = true; }
  else {
    chArrow.hidden = false; placeArrow(chArrow, ch.center, ch.small ? 3.2 : 4.2);
    chArrow.classList.toggle('full', full); chArrow.classList.toggle('going', !!autoGo);
    const d = Math.round(player.pos.distanceTo(ch.front)) + 'm', dn = chArrow.querySelector('small'); if (dn.textContent !== d) dn.textContent = d;
  }
  // 가판대 쪽 짧은 표시: 앞에 오면 끝
  if (state.shopHintUntil && (performance.now() > state.shopHintUntil || player.pos.distanceTo(CH.shopFront) < CLEANHOUSE.shopR || !late.canBuyGear().length)) state.shopHintUntil = 0;
  const so = !!state.shopHintUntil && !dumpS.el && cam.mode !== 'wardrobe' && !panelOpen();
  if (!so) { if (!shopArrow.hidden) shopArrow.hidden = true; return; }
  shopArrow.hidden = false; placeArrow(shopArrow, CH.stallTop, 0.9);
}
export function updateContext() {
  let best = null, bd = 1e9;
  if (state.photoState && !state.photoState.shot) best = rePoseAct; // 찍기 전: 다시 누르면 포즈 바꾸기 (#70)
  else if (player.pose === 'sit') best = mealS.on ? skipAct : cutS.on ? cutSkipAct : standAct;
  else if (player.riding && !busy()) best = dismountAct;
  else if (player.cart) best = cart.state.moving ? null : cartOffAct; // 마차 (#69): 서 있을 때만 내리기, 가는 중엔 점프로 뛰어내림
  else if (!busy() && !player.onArrive) {
    for (const it of interactables) { if (it.when && !it.when()) continue; const d = it.pos.distanceTo(player.pos); if (d < it.r && d < bd) { bd = d; best = it; } }
    const d = life.nearestDeer(player.pos, 2.6);
    if (d) { if (!state.deerAct || state.deerAct.deer !== d) state.deerAct = { deer: d, label: '노루 타기', act: () => mountDeer(d) }; best = state.deerAct; }
    if (cart && !best && cart.boardable(player.pos) >= 0) best = cartOnAct; // 정류장에 마차가 서 있으면 타기 (#69)
    if (state.fishing && !player.ride && (state.fishing.active || (!best && state.fishing.canFish()))) best = fishAct; // 개울 물가면 낚시 (#44)
    if (!best) best = player.ride ? rideOffAct : throwAct; // 할 일이 없으면 귤 던지기 (탈것 위에선 내리기)
  }
  if (best !== state.ctxTarget) { state.ctxTarget = best; ui.ctx.classList.toggle('idle', !best); ui.ctx.classList.toggle('soft', best === throwAct); }
  { const bite = best === fishAct && state.fishing.phase === 'bite'; if (ui.ctx.classList.contains('bite') !== bite) ui.ctx.classList.toggle('bite', bite); }
  let label = '상호작용';
  if (best) label = best.cairn ? ((social.stones.get(best.cairn.id) || []).some((e) => e.mine) ? '소원 보기' : '돌 올리기') : best.label;
  const span = ui.ctx.querySelector('span');
  if (span.textContent !== label) { span.textContent = label; ui.ctx.title = `${label} (F)`; }
  const ic = best ? (best.ic || (best.cairn ? 'cairn' : best.deer ? 'deer' : best.peer ? 'hand' : 'do')) : 'do';
  if (ui.ctx.dataset.ic !== ic) { ui.ctx.dataset.ic = ic; ui.ctx.querySelector('svg').innerHTML = CTX_ICON[ic] || CTX_ICON.do; }
  updateAmmo();
  // 줍기 버튼: 도구 반경 안에 주울 쓰레기가 없으면 흐리게
  const can = pickS.cyc >= 0 || canPick();
  if (pickBtn.classList.contains('dim') === can) pickBtn.classList.toggle('dim', !can);
}
// 상호작용 버튼 아이콘 (지금 될 동작)
const CTX_ICON = {
  do: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',
  bow: '<path d="M6 3c7 2 11 8 9 18M6 3l9 18M10 12l10-6M20 6l-3-.5M20 6l-.5 3"/><circle cx="19" cy="6" r="1.6"/>',
  throw: '<circle cx="11" cy="14" r="6"/><path d="M11 8c0-2 1-3 3-4M8 5c1 1 2 2 3 3M19 5l2-2M20 9h2"/>',
  dump: '<path d="M4 10l8-6 8 6M6 9v11h12V9M10 20v-5h4v5"/><path d="M12 4v-2" />',
  shop: '<path d="M3 9l2-5h14l2 5M3 9h18M3 9c0 2 2 3 3 3s3-1 3-3c0 2 2 3 3 3s3-1 3-3c0 2 2 3 3 3s3-1 3-3M5 12v8h14v-8"/><circle cx="12" cy="16" r="2"/>',
  cairn: '<ellipse cx="12" cy="19" rx="7" ry="2.5"/><ellipse cx="12" cy="13.5" rx="5" ry="2.2"/><ellipse cx="12" cy="8.5" rx="3.5" ry="2"/><ellipse cx="12" cy="4.5" rx="2" ry="1.4"/>',
  photo: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  sit: '<path d="M4 11h16M5 11V8h14v3M6 11v8M18 11v8M4 15h16"/>',
  sign: '<rect x="4" y="4" width="16" height="11" rx="1"/><path d="M12 15v6M8 8h8M8 11h5"/>',
  deer: '<path d="M8 3l1 3-2 1M16 3l-1 3 2 1M9 7h6l1 4-2 2v7M10 13v7M8 11l1-4"/>',
  hand: '<circle cx="7" cy="5" r="2"/><circle cx="17" cy="5" r="2"/><path d="M7 8v6l-2 7M17 8v6l2 7M7 10h10"/>',
  stand: '<circle cx="12" cy="4.5" r="1.8"/><path d="M12 7v7M12 14l-2.5 7M12 14l2.5 7M9 10l3-2 3 2M19 12V5M16.5 7.5L19 5l2.5 2.5"/>',
  down: '<path d="M12 4v13M6 11l6 6 6-6M5 21h14"/>',
  ride: RIDE_ICON.scoot, cart: '<path d="M3 9h11v6H3zM2 9h13M14 12l3-1"/><circle cx="7" cy="18" r="2.5"/><ellipse cx="19" cy="10.5" rx="2.6" ry="1.8"/><path d="M18 12.5v5M21 12v5"/>', // 탈것 가게·마차 (#69)
  fish: '<path d="M3 21L18 3M18 3v11a3 3 0 0 1-6 0"/><circle cx="12" cy="11" r="1.2"/><path d="M4 17c2 1 4 1 6 0"/>',
  reel: '<circle cx="9" cy="15" r="5.5"/><circle cx="9" cy="15" r="1.3"/><path d="M14.5 15H18v3M18 2v8M15 5l3-3 3 3"/>',
  eat: FORK_KNIFE, // 식사 (#50)
  cut: SCISSORS, // 머리 (#58)
  wear: SHIRT, // 옷 (#59)
  skip: '<path d="M5 5l7 7-7 7M13 5l7 7-7 7"/>',
};
