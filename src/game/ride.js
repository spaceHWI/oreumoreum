// 탈것(스케이트보드·스쿠터·조랑말), 마차 (#86 에서 main.js 를 나눔. 파일 순서는 src/main.js, 규칙은 notes/prototype-v1.md 코드 구조)
import { RIDES, CART, SHOP_ST } from '../balance.js';
import { augV } from '../augments.js';
import { RIDE_BY, RIDE_ICON, rideRig, rideSpeed } from '../rides.js';
import { STREET } from '../streetlayout.js';
import * as THREE from 'three';
import { height, groundAt, surfaceAt } from '../world.js';
import { state, late } from './state.js';
import { $, save, persist } from './save.js';
import { col, NS_TUT, stream, street, cart, rig, player, hp } from './place.js';
import { cam } from './camera.js';
import { toast, updateStats, panelOpen, busy, ach } from './hud.js';
import { marker } from './input.js';
import { setHoldBow } from './throw.js';

Object.assign(late, { toggleRide, openRideWin }); // 앞 파일에서 부르는 함수

// ---------- 탈것 (#69): 스케이트보드·스쿠터·조랑말. 버튼 하나로 타고 내림(길게 누르면 고르기), 길 밖은 느림, 개울·밟는 구조물·가게 안은 자동으로 내림 ----------
export const rideCode = () => (player.cart ? 'cart' : player.ride ? (player.rideC ? 'skate-c' : player.ride) : ''); // 다른 사람에게 보내는 값
function syncRideLook() { rig.set(player.cart ? '' : player.ride ? (player.rideC ? 'skate-c' : player.ride) : ''); }
// 길 위: 탐방로·들머리 길(surface) + 가게 골목
export function onRoad(x, z) {
  if (surfaceAt(x, z) !== 0) return true;
  if (!street) return false;
  const [a, b] = STREET.alley, dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L));
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < SHOP_ST.half + 0.6;
}
const inLot = (x, z) => !!street && STREET.lots.some((l) => { const ux = x - l.x, uz = z - l.z, al = ux * l.back.x + uz * l.back.z, lat = ux * l.back.z - uz * l.back.x; return Math.abs(al) < l.d / 2 && Math.abs(lat) < l.w / 2; });
// 탈것을 못 타는 곳: 개울(돌다리 포함)·밟는 구조물(징검돌·디딤판·테라스)·가게 터 안
export function noRideZone(x, z) {
  if (stream) { const [al, lat] = stream.local(x, z); if (Math.abs(al - stream.centerOff(lat)) < stream.halfW(lat) + 1.6) return 'stream'; }
  if (groundAt(x, z) - height(x, z) > 0.06) return 'step';
  if (inLot(x, z)) return 'shop';
  return null;
}
const RIDE_ZONE_LINE = { stream: '개울에서는 내려서 건너요', step: '여기서는 내려서 걸어요', shop: '가게 안에서는 내려요' };
const canMount = () => !busy() && !player.riding && !player.cart && !player.air && !player.knock && !player.rescue && !hp.isDown && !hp.pending && !state.fishing?.active && !late.mealS.on && !late.cutS.on && !state.photoState;
export function mountRide(id = save.rides.cur, quiet = false) {
  if (!RIDE_BY[id] || !save.rides.own.includes(id) || !canMount()) return false;
  const z = noRideZone(player.pos.x, player.pos.z); if (z) { if (!quiet) toast(RIDE_ZONE_LINE[z]); return false; }
  setHoldBow(false);
  player.ride = id; player.rideC = false; player.rideAuto = null;
  if (save.rides.cur !== id || save.rides.walk) { save.rides.cur = id; save.rides.walk = 0; persist(); }
  syncRideLook(); updateRideBtn(); late.net.send(true);
  if (!quiet) ach.emit('ride-' + id);
  return true;
}
export function dismountRide() {
  if (!player.ride) return;
  player.ride = null; player.rideC = false; player.rideAuto = null; player.speed = Math.min(player.speed, 5);
  syncRideLook(); updateRideBtn(); late.net.send(true);
}
export function toggleRide() {
  if (player.cart) return;
  if (player.ride) { dismountRide(); return; }
  if (!save.rides.own.length) return;
  if (save.rides.walk) { openRideWin(); return; } // 걸어 다니기를 골라 둔 때는 고르는 창 (#109)
  mountRide();
}
// 이번 프레임 목표 속도. 기울기는 진행 방향 앞뒤 땅 높이로. 스케이트보드는 오르막이면 들고 걷고, 손을 떼도 관성으로 미끄러짐
const _coast = new THREE.Vector3();
export function rideWant(dt, dir, slow) {
  const p = player, R = RIDE_BY[p.ride];
  const hx = dir ? dir.x : Math.sin(p.heading), hz = dir ? dir.z : Math.cos(p.heading);
  const g = (height(p.pos.x + hx * 1.5, p.pos.z + hz * 1.5) - height(p.pos.x - hx * 1.5, p.pos.z - hz * 1.5)) / 3;
  p.rideG = g;
  if (!R.up && dir) { const c = p.rideC ? g > RIDES.carryOut : g > RIDES.carryIn; if (c !== p.rideC) { p.rideC = c; syncRideLook(); late.net.send(true); } }
  const k = slow ? 0.6 : 1;
  if (p.rideC) return { want: dir ? RIDES.carry * k : 0, acc: 8 };
  const v = rideSpeed(p.ride, g, onRoad(p.pos.x, p.pos.z)) * (1 + augV(save, 'deer')); // 노루 친구 (#159): 탈것 속도
  if (dir) return { want: v * k, acc: R.glide ? RIDES.glideAccel : RIDES.accel };
  if (R.glide && p.speed > 0.3) { _coast.set(Math.sin(p.heading), 0, Math.cos(p.heading)); return g < -0.02 ? { want: v, acc: 0.5, coast: _coast } : { want: 0, acc: RIDES.glideStop, coast: _coast }; }
  return { want: 0, acc: RIDES.accel };
}
// 못 타는 곳에 들어가면 내리고(rideAuto 에 기억), 벗어나 clearT 지나면 다시 탐
let rideToastT = -1e9;
export function tickRideZone(dt) {
  const p = player, z = noRideZone(p.pos.x, p.pos.z);
  if (p.ride) {
    if (z && !p.air) { const id = p.ride; dismountRide(); p.rideAuto = id; p.rideClear = 0; if (performance.now() - rideToastT > 12000) { rideToastT = performance.now(); toast(RIDE_ZONE_LINE[z]); } }
    return;
  }
  if (z || p.air || !canMount()) { p.rideClear = 0; return; }
  p.rideClear += dt; if (p.rideClear > RIDES.clearT) { const id = p.rideAuto; p.rideAuto = null; mountRide(id, true); }
}
export const rideOffAct = { label: '내리기', ic: 'down', act: () => dismountRide() };
// 버튼: 가진 뒤에만 보임. 짧게 누르면 타기·내리기, 길게 누르거나 옆 ▾ 를 누르면 내 가방 탈것 탭 (#109, #166)
const rideBtn = $('btn-ride'), rideMore = $('ride-more');
export function updateRideBtn() {
  const own = save.rides.own.length > 0;
  if (rideBtn.hidden === own) rideBtn.hidden = !own;
  if (rideMore.hidden === own) rideMore.hidden = !own;
  if (!own) return;
  const id = player.ride || save.rides.cur;
  rideBtn.classList.toggle('on', !!player.ride);
  if (rideBtn.dataset.id !== id) { rideBtn.dataset.id = id; rideBtn.querySelector('svg').innerHTML = RIDE_ICON[id]; }
  rideBtn.title = `${RIDE_BY[id].name} ${player.ride ? '내리기' : '타기'} (Q) · 길게 누르면 바꾸기`;
  late.bagRefresh?.('ride');
}
export const WALK_ICON = '<circle cx="13" cy="4.5" r="1.8"/><path d="M12 8l-2 5 3 2 1 5M10 13l-3 2M12 8l4 3 2-1M13 15l-2 5"/>';
// 예전 탈것 창(#ridewin)은 내 가방(#166, bag.js) 탈것 탭으로 합침
export function openRideWin() { late.openBag?.('ride'); }
// 고르기. '' = 걸어 다니기. 타고 있으면 내렸다가 새 탈것으로 탐 (못 타는 곳이면 고르기만)
export function chooseRide(id) {
  const was = player.ride;
  if (!id) { save.rides.walk = 1; persist(); if (was) dismountRide(); updateRideBtn(); return; }
  if (!RIDE_BY[id] || !save.rides.own.includes(id)) return;
  save.rides.cur = id; save.rides.walk = 0; persist();
  if (was === id) { updateRideBtn(); return; }
  if (was) { dismountRide(); mountRide(id, true); }
  updateRideBtn();
}
{
  let holdTimer = null;
  const clear = () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } };
  rideBtn.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button) return; e.preventDefault(); clear(); holdTimer = setTimeout(() => { holdTimer = null; openRideWin(); }, RIDES.holdT * 1000); });
  rideBtn.addEventListener('pointerup', () => { if (holdTimer) { clear(); toggleRide(); } });
  rideBtn.addEventListener('pointercancel', clear); rideBtn.addEventListener('pointerleave', clear);
  rideBtn.addEventListener('click', (e) => { if (e.detail === 0) toggleRide(); });
  rideBtn.addEventListener('contextmenu', (e) => e.preventDefault());
  rideMore.addEventListener('click', (e) => { e.stopPropagation(); openRideWin(); });
}
// 탈것 가게 팝업 카드 (가게 거리 3번 터). 가진 것은 눌러서 고르기
export const RIDE_LOGO = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96"><circle cx="12" cy="12" r="11.5" fill="#ff8a1f"/><g transform="translate(3.6 3.4) scale(.7)" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${RIDE_ICON.scoot}</g></svg>`);
export const rideStat = (R) => `→ ×${R.flat} · ↗ ${R.up ? '×' + R.up : '들고'} · ↘ ×${R.down}`;
export function buildRideMenu(grid) {
  for (const R of RIDES.list) {
    const own = save.rides.own.includes(R.id), cur = own && save.rides.cur === R.id;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'menu-card'; b.dataset.id = R.id;
    b.classList.toggle('poor', !own && save.coins < R.price); b.classList.toggle('on', cur); b.title = `${R.name} · 평지 ×${R.flat} · 오르막 ${R.up ? '×' + R.up : '들고 걷기'} · 내리막 ×${R.down}`;
    b.innerHTML = `<svg class="food" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${RIDE_ICON[R.id]}</svg><span class="mn"><b>${R.name}</b><small>${rideStat(R)}</small></span>`
      + `<span class="mv">${own ? '<span class="bf">✓</span>' : `<span class="price"><i></i>${R.price.toLocaleString()}</span>`}</span>`;
    b.addEventListener('click', () => (own ? pickRide(R) : buyRide(R, b)));
    grid.append(b);
  }
}
function pickRide(R) { save.rides.cur = R.id; save.rides.walk = 0; persist(); if (player.ride && player.ride !== R.id) { dismountRide(); mountRide(R.id, true); } updateRideBtn(); late.refreshShopPop(); }
export function buyRide(R, cell) {
  if (save.rides.own.includes(R.id)) return;
  if (save.coins < R.price) { toast(`귤이 ${R.price - save.coins}개 모자라요`); return; }
  const from = save.coins; save.coins -= R.price; save.rides.own.push(R.id); save.rides.cur = R.id; save.rides.walk = 0; persist(); updateStats(); late.sound.coin?.();
  ach.emit('ride-buy'); ach.emit('ride-buy-' + R.id);
  updateRideBtn(); late.refreshShopPop();
  const c = document.querySelector(`#shoppop-cards .menu-card[data-id="${R.id}"]`) || cell;
  if (c) { c.classList.add('tier-pop'); late.spendFx(c, R.price, from, document.querySelector('#shoppop .coins-pill'), $('shoppop-coins')); }
  toast(save.rides.own.length === 1 ? `${R.name}을(를) 샀어요. 오른쪽 아래 버튼으로 타요` : `${R.name}을(를) 샀어요`);
}

// ---------- 마차 (#69): 정류장에서 상호작용으로 타고(무료), 정류장에서 내리거나 가는 중에 점프로 뛰어내림 ----------
export const cartOnAct = { label: '마차 타기', ic: 'cart', act: () => boardCart() };
export const cartOffAct = { label: '내리기', ic: 'down', act: () => leaveCart(false) };
export function boardCart() {
  if (!cart || player.cart || hp.isDown || busy()) return;
  if (cart.boardable(player.pos) < 0) return;
  if (player.ride) dismountRide(); if (player.riding) late.dismountDeer(); late.stopAutoGo(); setHoldBow(false); if (state.fishing?.active) state.fishing.stop();
  player.rideAuto = null;
  player.cart = { seat: Math.floor(Math.random() * CART.seats) };
  Object.assign(player, { target: null, onArrive: null, speed: 0, air: false, jumpY: 0, jumpV: 0, pose: 'move' }); marker.visible = false; player.kb.set(0, 0, 0);
  syncRideLook(); late.net.send(true); ach.emit('cart');
  if (!save.cartSeen) { save.cartSeen = 1; persist(); toast('마차는 정해진 길만 다녀요. 점프하면 뛰어내려요'); }
}
export function tickCartRide(dt) {
  const p = player;
  cart.seat(p.cart.seat, p.pos); p.pos.y -= RIDES.sitDrop; p.heading = cart.heading; p.speed = 0; p.driving = false;
  late.placeRunner(dt); late.checkViewpoint();
}
export function leaveCart(jump) {
  const p = player; if (!p.cart) return;
  const st = cart.state, h = cart.heading, rx = Math.cos(h), rz = -Math.sin(h);
  p.cart = null;
  if (!jump && st.stop >= 0) p.pos.copy(cart.exitAt(st.stop));
  else {
    let x = p.pos.x + rx * CART.jumpOff, z = p.pos.z + rz * CART.jumpOff;
    if (col && col.blocked(x, z, 0.3)) { x = p.pos.x - rx * CART.jumpOff; z = p.pos.z - rz * CART.jumpOff; }
    p.pos.set(x, 0, z);
  }
  p.pos.y = groundAt(p.pos.x, p.pos.z); p.visY = p.pos.y; p.pose = 'move';
  if (jump) { p.air = true; p.jumpV = 6; p.jumpY = 0.9; p.kb.set(Math.sin(h) * st.speed * 0.6 + rx * 2.5, 0, Math.cos(h) * st.speed * 0.6 + rz * 2.5); late.sound.step(surfaceAt(p.pos.x, p.pos.z), true); }
  syncRideLook(); late.net.send(true);
}
export const jumpOffCart = () => leaveCart(true);
// 화면 가장자리 마차 표시 (정낭이 열린 뒤, 마차가 조금 멀 때)
export const cartMark = $('cart-mark');
export function tickCartMark() {
  if (!cart) return;
  const d = player.pos.distanceTo(cart.pos);
  const on = !player.cart && (!NS_TUT || !!save.jeong) && d > CART.markNear && d < CART.markFar && !panelOpen() && cam.mode === 'follow' && !late.mealS.on && !late.cutS.on && (!late.pace || late.pace.canMark()); // 긴장 때는 적 표시만 (#89)
  if (!on) { if (!cartMark.hidden) cartMark.hidden = true; return; }
  cartMark.hidden = false; late.placeArrow(cartMark, cart.pos, 3.2);
}

// 다른 사람의 탈것 (#69): presence rd 값대로 모양·자세·높이
export function peerRide(e, dt) {
  const dr = typeof e.data.dr === 'string' && e.data.dr ? late.deerNet?.peerDeer(e) : null; // 노루를 탄 사람 (#92): 걸터앉아 노루 등 높이로
  if (dr) { e.rig?.set(''); return { pose: 'ride', lift: (dr.seatY ?? 0.95) + (dr.speed > 4 ? Math.abs(Math.sin(dr.phase * 0.5)) * 0.25 : 0), fwd: dr.seatZ || 0 }; }
  const rd = typeof e.data.rd === 'string' ? e.data.rd : '';
  if (!rd && !e.rig) return null;
  if (!e.rig) e.rig = rideRig(e.runner);
  e.rig.set(rd === 'cart' ? '' : rd); e.rig.tick(dt, e.speed);
  if (rd === 'cart') return { pose: 'sit', lift: CART.seatPos[0][1] * CART.scale - RIDES.sitDrop, still: true };
  return rd && e.rig.state ? { pose: e.rig.pose(), lift: e.rig.lift(), still: e.rig.still() } : null;
}
updateRideBtn();
