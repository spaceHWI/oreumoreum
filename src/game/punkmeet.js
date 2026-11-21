// 오름펑크 상호작용 (#163): 하르방 하이파이브·관광객 사진 부탁·까마귀 도둑. 수치 balance.js MEET, 모양 src/punkmodels.js, 소리 src/punksound.js
// - 하르방: 들머리·가게 거리(life.hareubangs)와 구역 지킴이(#119 guard.js, 서 있을 때) 앞에서 '인사하기' → 하이파이브 동작(emotes.js 'five', 남에게도 보임)
//   → 코에 닿는 순간 '탁'·들썩·눈 반짝·말풍선. 하루 한 번(KST 자정) 10분 버프(귤 모으는 범위·이동), 버프 칸은 스톤 식사 버프와 따로 (#punk-pill)
// - 관광객: 8~12분마다 한 명, 플레이어와 가까운 볼거리(들머리·정상 전망대·능선 볼거리)에 걸어와 손을 흔듦 → '사진 찍어 주기' → 3초 뒤 찰칵(사진 기능의 번쩍·셔터 소리)
//   → 귤. 3번에 1번은 쓰레기를 버리고 돌아섬: 귤로 맞히면 도로 줍고 귤을 더 줌, 안 맞히면 근처 더미에 쌓임(투기꾼 봉투와 같은 trash.drop)
// - 까마귀: 배낭이 가득 찬 채 30초 넘게 다니면 가끔 날아와 배낭 쓰레기 1개를 물고 머리 위를 맴돌다 감. 맞히면 그것과 반짝이는 것(귤)을 떨어뜨림
// 멀티: 투기꾼처럼 관광객·까마귀는 화면마다 따로(모양만). 더미를 바꾸는 것은 trash.drop 하나(방에선 방장만 쌓음). 하이파이브는 감정 표현으로 보임
import * as THREE from 'three';
import { MEET, TRASH_TYPES } from '../balance.js';
import { kstDate } from '../achievements.js';
import { height } from '../world.js';
import { LOW } from '../gfx2.js';
import { shakeHareubang } from '../lifemodels.js';
import { buildTourist, buildLitter, buildCrow, cameraIcon, sparkle, shadowDisc } from '../punkmodels.js';
import { tak, caw } from '../punksound.js';
import { state, late } from './state.js';
import { $, save, persist } from './save.js';
import { scene } from './scene.js';
import { life, player, trash, CH, NS_TUT, photoSpot, summitTan, hp } from './place.js';
import { toast, tips, busy } from './hud.js';
import { say, director } from './director.js';
import { social } from './room.js';
import { interactables } from './stores.js';
import { bagRoom, updateTrashUI } from './pickup.js';
import { field } from './field.js';
import { sound } from './hooks.js';

const H = MEET.hb, T = MEET.tourist, C = MEET.crow;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const tutOn = () => !!late.tut?.active || (!!NS_TUT && !save.tut?.done);
// 감독 문 (#176 balance.js JOURNEY): 관광객은 구역 2, 까마귀는 구역 3 에 들어선 뒤부터 (확인용 __oreum.punk 는 문과 상관없이 부름)
director.register({ id: 'tourist' });
director.register({ id: 'crow' });
const doorOpen = (id) => !director.isOpen || director.isOpen(id);
const reward = (wp, n) => life.hooks.reclaim?.(wp, n); // 귤 + 귤 효과 (hooks.js)

/* ---------- 저장 ---------- */
// save.meet = { hbDay: 'YYYY-MM-DD' 버프를 받은 날, hbLeft: 남은 초, crowDay·crowN: 오늘 까마귀 온 수, crowAt: 마지막 온 시각(ms) }
if (!save.meet || typeof save.meet !== 'object' || Array.isArray(save.meet)) save.meet = {};
const S = save.meet;
if (typeof S.hbDay !== 'string') S.hbDay = '';
if (!(Number(S.hbLeft) > 0)) S.hbLeft = 0; else S.hbLeft = Math.min(H.buffSec, Number(S.hbLeft));
if (typeof S.crowDay !== 'string') S.crowDay = '';
S.crowN = Math.max(0, Math.floor(Number(S.crowN) || 0)); S.crowAt = Math.max(0, Number(S.crowAt) || 0);

/* ---------- 1. 하르방 하이파이브 ---------- */
const hbList = [];
for (const h of life.hareubangs) hbList.push({ pos: h.pos, root: h.root, head: h.head, life: h, up: () => true });
if (late.guard?.guards) for (const g of late.guard.guards.values()) hbList.push({ pos: new THREE.Vector3(g.s.x, g.s.y, g.s.z), root: g.hb.root, head: g.hb.head, up: () => g.k >= 1 && g.mode !== 'down' });
const shakes = []; // 지킴이 하르방 흔들림 (life 것은 life.js 가 hitT 로 흔듦)
const glints = []; // 눈 반짝임 { s, t }
let pendingFive = null;
function eyes(hb) { // 모델 크기에서 눈 자리 어림 (모델을 받기 전이면 임시 상자 크기)
  const m = hb.head.children[0]; if (!m?.geometry) return null;
  if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
  const b = m.geometry.boundingBox, s = m.scale.y, top = b.max.y * s, fz = b.max.z * m.scale.z;
  return [-1, 1].map((k) => new THREE.Vector3(k * top * 0.075, top * 0.78, fz * 0.85));
}
function highFive(hb) {
  if (!state.emo || pendingFive) return;
  player.heading = Math.atan2(hb.pos.x - player.pos.x, hb.pos.z - player.pos.z);
  if (!state.emo.perform('five')) return;
  pendingFive = { hb, t: H.hitAt };
}
function fiveHit(hb) {
  tak(sound, 1);
  if (hb.life) hb.life.hitT = 1; else shakes.push({ hb, t: 1 });
  if (!LOW) { const e = eyes(hb); if (e) for (const p of e) { const s = sparkle('#fff7c2', 0.42); s.position.copy(p); hb.head.add(s); glints.push({ s, t: 0 }); } }
  social.showBubble('hb', hb.root, pick(H.lines), 3.7);
  const day = kstDate();
  if (S.hbDay !== day) { S.hbDay = day; S.hbLeft = H.buffSec; persist(); updatePill(true); toast('하르방 기운! 10분 동안 귤이 더 멀리서 모이고 조금 빨라져요', 3.2); }
}
for (const hb of hbList) interactables.push({ label: '인사하기', ic: 'hand', pos: hb.pos, r: H.r, when: () => hb.up() && !pendingFive, act: () => highFive(hb) });

// 버프 칸 (스톤 식사 버프와 따로 한 칸)
const pill = $('punk-pill'); let pillKey = '', saveT = 0, lastT = 0;
function updatePill(force) {
  if (!pill) return;
  if (!(S.hbLeft > 0)) { if (!pill.hidden) pill.hidden = true; pillKey = ''; return; }
  const sec = Math.ceil(S.hbLeft), txt = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  if (txt === pillKey && !force) return; pillKey = txt;
  pill.hidden = false; pill.querySelector('.fg').style.strokeDashoffset = String(75.4 * (1 - S.hbLeft / H.buffSec));
  pill.querySelector('b').textContent = txt; pill.classList.toggle('end', S.hbLeft < 30);
}
function tickBuff() { // 실제 흐른 시간으로 (buff.js 와 같음). 1초 넘게 끊긴 동안은 빼고 셈
  const t = performance.now(), dt = lastT ? Math.min(1, (t - lastT) / 1000) : 0; lastT = t;
  if (!(S.hbLeft > 0)) return;
  S.hbLeft -= dt; saveT += dt;
  if (S.hbLeft <= 0) { S.hbLeft = 0; persist(); toast('하르방 기운이 다했어요'); }
  else if (saveT > 5) { saveT = 0; persist(); }
  updatePill();
}
late.punkPickR = () => (S.hbLeft > 0 ? H.pickR : 0); // hooks.js pickR2 가 더함
late.punkSpeed = () => (S.hbLeft > 0 ? 1 + H.speed : 1); // update.js 걸음 빠르기에 곱함

/* ---------- 2. 관광객 사진 부탁 ---------- */
// 나올 자리: 들머리(클린하우스 옆)·정상 전망대(사진사 반대쪽)·능선 볼거리(field.sights)
const tSpots = [];
if (CH) { const f = CH.front, c = CH.center, dx = f.x - c.x, dz = f.z - c.z, l = Math.hypot(dx, dz) || 1; tSpots.push({ x: f.x + dx / l * 3 - dz / l * 4, z: f.z + dz / l * 3 + dx / l * 4, name: '들머리' }); }
if (photoSpot) { const p = photoSpot.clone().addScaledVector(summitTan, -6); tSpots.push({ x: p.x, z: p.z, name: '정상' }); }
if (field) for (const s of field.sights) { const a = s.rot || 0; tSpots.push({ x: s.x + Math.sin(a) * 4.5, z: s.z + Math.cos(a) * 4.5, name: s.name }); }
let tour = null, tourT = rand(T.every[0], T.every[1]) * 0.5; // 처음은 조금 일찍
const tPos = new THREE.Vector3(), tVel = new THREE.Vector3();
function spawnTourist(force = false) {
  if (tour) return false;
  let best = null, bd = force ? 1e9 : T.near;
  for (const s of tSpots) { const d = Math.hypot(s.x - player.pos.x, s.z - player.pos.z); if (d < bd && (force || d > 10)) { bd = d; best = s; } }
  if (!best) return false;
  const m = buildTourist(), a = Math.random() * Math.PI * 2;
  const from = { x: best.x + Math.sin(a) * T.walkIn, z: best.z + Math.cos(a) * T.walkIn };
  const icon = cameraIcon(); icon.position.y = 2.75; icon.visible = false; m.root.add(icon);
  tour = { m, icon, spot: best, goal: { x: best.x, z: best.z }, state: 'in', t: 0, heading: Math.atan2(best.x - from.x, best.z - from.z), speed: 0, litter: null, phase: Math.random() * 6 };
  tPos.set(from.x, height(from.x, from.z), from.z); m.root.position.copy(tPos); scene.add(m.root);
  return true;
}
function removeTourist() { if (!tour) return; scene.remove(tour.m.root); if (tour.litter && !tour.litter.keep) scene.remove(tour.litter.g); tour = null; tourT = rand(T.every[0], T.every[1]); }
function tourLeave() { const a = tour.heading + Math.PI + rand(-0.6, 0.6); tour.goal = { x: tPos.x + Math.sin(a) * 30, z: tPos.z + Math.cos(a) * 30 }; tour.state = 'out'; tour.t = 0; tour.icon.visible = false; }
let shotCount = null;
function shootTourist() {
  if (!tour || tour.state !== 'wait') return;
  tour.state = 'pose'; tour.t = 0; tour.icon.visible = false;
  player.heading = Math.atan2(tPos.x - player.pos.x, tPos.z - player.pos.z); player.target = null; player.onArrive = null;
  tour.heading = Math.atan2(player.pos.x - tPos.x, player.pos.z - tPos.z);
  const cd = $('countdown'); if (cd && !state.photoState) { cd.hidden = false; cd.textContent = String(T.pose); shotCount = T.pose; }
  sound.beep?.(false);
}
function snap() {
  sound.shutter?.();
  const flash = $('flash'); if (flash) { flash.hidden = false; flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go'); }
  const cd = $('countdown'); if (cd && shotCount != null && !state.photoState) cd.hidden = true; shotCount = null;
  social.showBubble('tourist', tour.m.root, pick(T.thanks), 3.1);
  reward(new THREE.Vector3(tPos.x, tPos.y + 1.8, tPos.z), T.gyul);
  late.ach?.emit?.('punk-photo');
}
const tourAim = { kind: 'tourist', pos: tPos, h: 1.2, size: 0.8, vel: tVel, ok: () => !!tour && tour.state === 'litter' };
interactables.push({ label: '사진 찍어 주기', ic: 'photo', pos: tPos, r: T.r, when: () => !!tour && tour.state === 'wait', act: shootTourist });
function dropLitter() {
  const g = buildLitter(), x = tPos.x + Math.sin(tour.heading) * 0.6, z = tPos.z + Math.cos(tour.heading) * 0.6; g.position.set(x, height(x, z), z); scene.add(g);
  tour.litter = { g, x, z, t: 0 };
}
function litterStays() { // 안 맞힘: 근처 더미에 쌓임 (투기꾼이 떨군 봉투와 같은 길, 방에선 방장만)
  const L = tour.litter; if (!L) return;
  if (trash && !trash.drop(L.x, L.z, T.litterN, 40)) { let bi = -1, bd = 1e9; trash.heaps.forEach((h, i) => { const d = Math.hypot(h.x - L.x, h.z - L.z); if (d < bd) { bd = d; bi = i; } }); if (bi >= 0) trash.refill(bi, T.litterN); }
  trash?.store.commit();
  L.keep = true; L.t = 0; strayLitter.push(L); // 바닥 모양은 조금 더 보이다 사라짐
}
const strayLitter = [];
function tourHit() {
  tour.state = 'sorry'; tour.t = 0;
  tour.heading = Math.atan2(tour.litter.x - tPos.x, tour.litter.z - tPos.z);
  social.showBubble('tourist', tour.m.root, pick(T.sorry), 3.1); sound.beep?.(true);
  reward(new THREE.Vector3(tPos.x, tPos.y + 1.8, tPos.z), T.sorryGyul);
}
function walkTo(dt, goal, speed) {
  const dx = goal.x - tPos.x, dz = goal.z - tPos.z, d = Math.hypot(dx, dz);
  if (d < 0.25) { tour.speed = 0; return true; }
  const want = Math.atan2(dx, dz); let dh = want - tour.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); tour.heading += dh * Math.min(1, dt * 6);
  tour.speed = speed; const s = Math.min(d, speed * dt); tPos.x += dx / d * s; tPos.z += dz / d * s; tPos.y = height(tPos.x, tPos.z);
  return false;
}
function tickTourist(dt, time) {
  for (let i = strayLitter.length - 1; i >= 0; i--) { const L = strayLitter[i]; L.t += dt; if (L.t > 20 || Math.hypot(L.x - player.pos.x, L.z - player.pos.z) < 1.2) { scene.remove(L.g); strayLitter.splice(i, 1); } }
  if (!tour) {
    if (tutOn() || !tSpots.length || !doorOpen('tourist')) return;
    if ((tourT -= dt) <= 0) { if (!spawnTourist()) tourT = T.retry; }
    return;
  }
  const t = tour, m = t.m; t.t += dt; tVel.set(0, 0, 0);
  const dP = Math.hypot(player.pos.x - tPos.x, player.pos.z - tPos.z);
  if (t.state === 'in') { if (walkTo(dt, t.goal, T.speed)) { t.state = 'wait'; t.t = 0; t.icon.visible = true; } }
  else if (t.state === 'wait') {
    if (dP < 14) t.heading += Math.atan2(Math.sin(Math.atan2(player.pos.x - tPos.x, player.pos.z - tPos.z) - t.heading), Math.cos(Math.atan2(player.pos.x - tPos.x, player.pos.z - tPos.z) - t.heading)) * Math.min(1, dt * 3);
    if (dP < 16 && !t.asked) { t.asked = true; social.showBubble('tourist', m.root, pick(T.lines), 3.1); }
    if (t.t > T.wait) tourLeave();
  } else if (t.state === 'pose') {
    if (shotCount != null) { const n = Math.max(1, T.pose - Math.floor(t.t)); if (n !== shotCount) { shotCount = n; const cd = $('countdown'); if (cd && !state.photoState) cd.textContent = String(n); sound.beep?.(false); } }
    if (t.t >= T.pose) { snap(); t.state = 'thanks'; t.t = 0; }
  } else if (t.state === 'thanks') {
    if (t.t > 1.3) { if (Math.random() < T.litterP) { t.state = 'drop'; t.t = 0; m.bag.visible = true; } else tourLeave(); }
  } else if (t.state === 'drop') {
    if (t.t > 0.6 && !t.litter) { m.bag.visible = false; dropLitter(); t.heading += Math.PI; const a = t.heading; t.goal = { x: tPos.x + Math.sin(a) * 30, z: tPos.z + Math.cos(a) * 30 }; t.state = 'litter'; t.t = 0; }
  } else if (t.state === 'litter') {
    walkTo(dt, t.goal, T.speed * 0.8); tVel.set(Math.sin(t.heading) * t.speed, 0, Math.cos(t.heading) * t.speed);
    if (t.t > T.litterT) { litterStays(); t.state = 'out'; t.t = 0; }
  } else if (t.state === 'sorry') {
    if (t.t < 1.2) walkTo(dt, t.litter, T.speed * 1.6);
    else if (t.t < 2.2) { if (t.litter && !t.litter.keep) { scene.remove(t.litter.g); t.litter = null; } }
    else tourLeave();
  } else if (t.state === 'out') { walkTo(dt, t.goal, T.speed); if (t.t > 7 || (t.speed === 0 && t.t > 1)) { const k = Math.max(0, 1 - (t.t - 7)); m.root.scale.setScalar(Math.max(0.01, k)); if (t.t > 8) { removeTourist(); return; } } }
  // 모양
  m.root.position.copy(tPos); m.root.rotation.y = t.heading;
  if (dP > 120) return; // 멀면 몸짓은 쉼
  const sw = Math.sin(time * 7 + t.phase) * Math.min(1, t.speed / 1.2) * 0.6;
  m.legs[0].rotation.x = sw; m.legs[1].rotation.x = -sw;
  const bend = t.state === 'sorry' && t.t > 1.2 && t.t < 2.2 ? Math.sin((t.t - 1.2) * Math.PI) * 0.7 : 0; m.body.rotation.x = bend;
  if (t.state === 'wait') { m.arms[1].rotation.set(0, 0, 0); m.arms[0].rotation.x = 0; m.arms[0].rotation.z = -2.6 + Math.sin(time * 9) * 0.35; } // 손 흔들기
  else if (t.state === 'pose') { m.arms[0].rotation.set(0, 0, -2.4); m.arms[1].rotation.set(-0.3, 0, 0.5); } // 브이
  else if (t.state === 'thanks') { m.arms[0].rotation.set(0, 0, -2.8 + Math.sin(time * 12) * 0.2); m.arms[1].rotation.set(0, 0, 2.8 - Math.sin(time * 12) * 0.2); }
  else if (t.state === 'drop') { m.arms[1].rotation.set(-0.6 * Math.min(1, t.t / 0.5), 0, 0); m.arms[0].rotation.set(0, 0, 0); }
  else { m.arms[0].rotation.set(-sw, 0, 0); m.arms[1].rotation.set(sw, 0, 0); }
  if (t.icon.visible) t.icon.position.y = 2.75 + Math.sin(time * 3) * 0.08;
}

/* ---------- 3. 까마귀 도둑 ---------- */
let crow = null, fullT = 0, rollT = -1;
const cPos = new THREE.Vector3(), cVel = new THREE.Vector3(), cPrev = new THREE.Vector3();
const crowAim = { kind: 'crow', pos: cPos, h: 0, size: 0.7, vel: cVel, ok: () => !!crow && (crow.state === 'circle' || crow.state === 'leave') && !!crow.kind };
function crowToday() { const d = kstDate(); if (S.crowDay !== d) { S.crowDay = d; S.crowN = 0; } return S.crowN; }
function spawnCrow() {
  if (crow) return false;
  const m = buildCrow(), sh = shadowDisc(), a = Math.random() * Math.PI * 2;
  m.loot.visible = false;
  cPos.set(player.pos.x + Math.sin(a) * 45, player.pos.y + 28, player.pos.z + Math.cos(a) * 45);
  m.root.position.copy(cPos); scene.add(m.root); scene.add(sh);
  crow = { m, sh, state: 'warn', t: 0, a: a + Math.PI, R: rand(C.rMin, C.rMax), y: rand(C.yMin, C.yMax), w: rand(1.1, 1.5) * (Math.random() < 0.5 ? -1 : 1), from: cPos.clone(), kind: null, xv: 0, vy: 0 };
  caw(sound, 0.8); tips.event('crow');
  say('danger', 'crowCome', '까악! 까마귀가 배낭을 노려요', 2.4, { ttl: 4 });
  return true;
}
function removeCrow() { if (!crow) return; scene.remove(crow.m.root); scene.remove(crow.sh); crow.sh.geometry.dispose(); crow.sh.material.dispose(); crow = null; }
function steal() {
  const bag = trash.store.bag; let best = null, bn = 0;
  for (const ty of TRASH_TYPES) if ((bag[ty.id] || 0) > bn) { bn = bag[ty.id]; best = ty.id; }
  if (!best) return false;
  const all = TRASH_TYPES.reduce((s, ty) => s + (bag[ty.id] || 0), 0), xv = all > 0 ? (bag.xv || 0) / all : 0;
  bag[best]--; bag.xv = Math.max(0, (bag.xv || 0) - xv); trash.store.commit(); updateTrashUI(true);
  crow.kind = best; crow.xv = xv; crow.m.loot.visible = true;
  crowToday(); S.crowN++; S.crowAt = Date.now(); persist();
  caw(sound, 1, 1); toast('까마귀가 쓰레기를 물어 갔어요! 귤로 맞혀요', 2.6);
  return true;
}
function crowHit() {
  crow.state = 'fall'; crow.t = 0; crow.vy = 0; crow.m.loot.visible = false;
  crow.drop = { p: cPos.clone(), vy: 2 }; // 떨어지는 쓰레기·반짝이
  crow.dropM = new THREE.Group(); const lm = crow.m.loot.clone(); lm.visible = true; lm.position.set(0, 0, 0); crow.dropM.add(lm);
  if (!LOW) { const s = sparkle('#ffe9a0', 0.9); crow.dropM.add(s); }
  crow.dropM.position.copy(cPos); scene.add(crow.dropM);
  caw(sound, 1, 3); sound.beep?.(true);
}
function landDrop() {
  const p = crow.dropM.position, g = new THREE.Vector3(p.x, height(p.x, p.z), p.z);
  scene.remove(crow.dropM); crow.dropM = null;
  // 물고 있던 것: 배낭에 자리가 있으면 도로 넣음, 아니면 근처 더미로
  if (crow.kind) {
    const ty = TRASH_TYPES.find((x) => x.id === crow.kind);
    if (ty && bagRoom() >= ty.vol) { trash.store.bag[ty.id] = (trash.store.bag[ty.id] || 0) + 1; trash.store.bag.xv = (trash.store.bag.xv || 0) + crow.xv; trash.store.commit(); updateTrashUI(true); }
    else trash.drop(g.x, g.z, 1, 40);
    crow.kind = null;
  }
  // 반짝이는 것: 표에서 하나 (귀한 귤 #130·영수증 #165 이 아직 없으면 귤)
  let r = Math.random(), it = C.drop[0];
  for (const d of C.drop) { if (r < d[1]) { it = d; break; } r -= d[1]; }
  const done = it[0] === 'rare' ? late.rareGive?.(g, it[2]) : it[0] === 'receipt' ? late.receiptDrop?.(g) : false; // 귀한 귤 #130 · 영수증 쪽지 #165
  if (!done) life.scatterTangerines(g, it[2], LOW ? 6 : 10);
  toast(done ? '까마귀가 반짝이는 것을 떨어뜨렸어요!' : `까마귀가 쓰레기와 귤 ${it[2]}개를 떨어뜨렸어요!`, 2.6);
  late.ach?.emit?.('punk-crow');
}
function tickCrow(dt, time) {
  // 오기 조건: 배낭이 가득 찬 채 fullT 초, 쉬는 시간·하루 수, 튜토리얼·쓰러짐 아님
  const full = !!trash && bagRoom() < 1 && !tutOn() && !hp.isDown && doorOpen('crow');
  fullT = full ? fullT + dt : 0;
  if (!crow) {
    if (fullT > C.fullT && Date.now() - S.crowAt > C.cd * 1000 && crowToday() < C.dayMax && !player.cart) {
      if (rollT < 0) rollT = rand(C.roll[0], C.roll[1]);
      if ((rollT -= dt) <= 0) { rollT = -1; spawnCrow(); }
    } else rollT = -1;
    return;
  }
  const c = crow, m = c.m; c.t += dt; cPrev.copy(cPos);
  const head = new THREE.Vector3(player.pos.x, player.pos.y + 1.6, player.pos.z);
  if (c.state === 'warn') { // 그림자가 다가오며 짙어짐, 까마귀는 멀리서 다가옴
    const k = Math.min(1, c.t / C.warn);
    cPos.lerpVectors(c.from, head.clone().add(new THREE.Vector3(Math.sin(c.a + Math.PI) * 8, 9, Math.cos(c.a + Math.PI) * 8)), k * k);
    if (c.t >= C.warn) { c.state = 'swoop'; c.t = 0; c.from = cPos.clone(); }
  } else if (c.state === 'swoop') {
    const k = Math.min(1, c.t / C.swoop); cPos.lerpVectors(c.from, head, k * k * (3 - 2 * k));
    if (c.t >= C.swoop) {
      if (trash.bagVol() <= 0 || !steal()) { c.state = 'leave'; c.t = 0; } // 그새 배낭을 비웠으면 그냥 감
      else { c.state = 'circle'; c.t = 0; c.a = Math.atan2(cPos.x - player.pos.x, cPos.z - player.pos.z); }
    }
  } else if (c.state === 'circle') {
    c.a += c.w * dt; const R = c.R * Math.min(1, 0.3 + c.t / 1.2), y = player.pos.y + Math.min(c.y, 1.6 + c.t * 6) + Math.sin(time * 1.7) * 0.4;
    cPos.set(player.pos.x + Math.sin(c.a) * R, y, player.pos.z + Math.cos(c.a) * R);
    if (c.t >= C.circle) { c.state = 'leave'; c.t = 0; }
  } else if (c.state === 'leave') {
    const dir = new THREE.Vector3(Math.sin(c.a), 0, Math.cos(c.a)); cPos.addScaledVector(dir, (6 + c.t * 4) * dt); cPos.y += 3 * dt;
    if (c.t >= C.leave) { if (c.kind) toast('까마귀가 쓰레기를 물고 가 버렸어요'); removeCrow(); return; }
  } else if (c.state === 'fall') { // 맞음: 퍼덕이며 위로 달아남, 떨군 것은 땅으로
    cPos.y += (4 + c.t * 3) * dt; cPos.x += Math.sin(c.a) * 5 * dt; cPos.z += Math.cos(c.a) * 5 * dt;
    if (c.dropM) { const d = c.drop; d.vy -= 14 * dt; c.dropM.position.y += d.vy * dt; c.dropM.rotation.y += dt * 4; if (c.dropM.position.y <= height(c.dropM.position.x, c.dropM.position.z) + 0.15) landDrop(); }
    if (c.t > 3 && !c.dropM) { removeCrow(); return; }
  }
  cVel.subVectors(cPos, cPrev).divideScalar(Math.max(1e-3, dt));
  m.root.position.copy(cPos);
  if (cVel.x * cVel.x + cVel.z * cVel.z > 0.01) m.root.rotation.y = Math.atan2(cVel.x, cVel.z);
  m.root.rotation.z = c.state === 'fall' ? Math.sin(c.t * 18) * 0.6 : 0;
  const f = Math.sin(time * (c.state === 'fall' ? 30 : 18)) * 0.7; m.wings[0].rotation.z = f; m.wings[1].rotation.z = -f;
  // 그림자: 오기 전·내려올 때 발밑에 (까마귀 아래 땅)
  const gy = height(cPos.x, cPos.z), show = c.state === 'warn' || c.state === 'swoop';
  const sx = show && c.state === 'warn' ? THREE.MathUtils.lerp(cPos.x, player.pos.x, 0.6) : cPos.x, sz = show && c.state === 'warn' ? THREE.MathUtils.lerp(cPos.z, player.pos.z, 0.6) : cPos.z;
  c.sh.visible = show || c.state === 'circle'; c.sh.position.set(sx, height(sx, sz) + 0.06, sz);
  c.sh.material.opacity = c.state === 'warn' ? 0.12 + 0.25 * Math.min(1, c.t / C.warn) : Math.max(0.06, 0.32 - (cPos.y - gy) * 0.025);
  c.sh.scale.setScalar(c.state === 'warn' ? 1.6 - Math.min(1, c.t / C.warn) * 0.6 : 1);
}

/* ---------- 맞히기 (life.addTargets: 귤·화살·무기, 타겟 고정 #148) ---------- */
const seg = (p, tg, x, y, z) => { // 지난 0.1초 동안 지나온 선분과 점(x,y,z)의 거리 (투기꾼과 같은 어림)
  const vx = tg.vel.x * 0.1, vy = tg.vel.y * 0.1, vz = tg.vel.z * 0.1, vl = vx * vx + vy * vy + vz * vz;
  let u = vl > 1e-6 ? ((x - (p.x - vx)) * vx + (y - (p.y - vy)) * vy + (z - (p.z - vz)) * vz) / vl : 1; u = u < 0 ? 0 : u > 1 ? 1 : u;
  return Math.hypot(p.x - vx * (1 - u) - x, p.y - vy * (1 - u) - y, p.z - vz * (1 - u) - z);
};
life.addTargets({
  hitTest(p, tg) {
    if (crowAim.ok() && seg(p, tg, cPos.x, cPos.y, cPos.z) < C.hitR) { tg.vel.set(-tg.vel.x * 0.3, 2, -tg.vel.z * 0.3); crowHit(); return true; }
    if (tourAim.ok()) {
      const vx = tg.vel.x * 0.1, vz = tg.vel.z * 0.1, vl = vx * vx + vz * vz;
      let u = vl > 1e-6 ? ((tPos.x - (p.x - vx)) * vx + (tPos.z - (p.z - vz)) * vz) / vl : 1; u = u < 0 ? 0 : u > 1 ? 1 : u;
      if (Math.hypot(p.x - vx * (1 - u) - tPos.x, p.z - vz * (1 - u) - tPos.z) < T.hitR && p.y < tPos.y + 2.4 && p.y > tPos.y - 0.3) { tg.vel.set(-tg.vel.x * 0.3, 2.5, -tg.vel.z * 0.3); tourHit(); return true; }
    }
    return false;
  },
  aimTargets(out) { if (crowAim.ok()) out.push(crowAim); if (tourAim.ok()) out.push(tourAim); },
});

/* ---------- 매 프레임 ---------- */
late.tickMeet = (dt, time) => {
  if (pendingFive) { pendingFive.t -= dt; if (pendingFive.t <= 0) { const hb = pendingFive.hb; pendingFive = null; if (player.pose === 'five') fiveHit(hb); } }
  for (let i = shakes.length - 1; i >= 0; i--) { const s = shakes[i]; s.t = Math.max(0, s.t - dt); shakeHareubang({ head: s.hb.head, hitT: s.t }); if (s.t <= 0) shakes.splice(i, 1); }
  for (let i = glints.length - 1; i >= 0; i--) { const g = glints[i]; g.t += dt; const k = g.t / 0.7; if (k >= 1) { g.s.parent?.remove(g.s); g.s.material.dispose(); glints.splice(i, 1); continue; } const e = Math.sin(k * Math.PI); g.s.scale.setScalar(0.15 + e * 0.45); g.s.material.rotation = k * 2; g.s.material.opacity = e; }
  tickBuff();
  if (!trash) return;
  tickTourist(dt, time);
  tickCrow(dt, time);
};
updatePill(true);

/* ---------- 확인용 (window.__oreum.punk 에 #164 것과 함께 실림, late.meet) ---------- */
// tourist(): 가장 가까운 자리에 관광객 바로 · crow(): 까마귀 바로(배낭을 채워 둠) · five(): 가장 가까운 하르방 앞으로 가서 인사 · state()
late.meet = {
  tourist(litter) { if (tour) removeTourist(); const ok = spawnTourist(true); if (ok && litter != null) { const P0 = T.litterP; T.litterP = litter ? 1 : 0; setTimeout(() => { T.litterP = P0; }, (T.wait + 30) * 1000); } return ok; },
  crow() { if (crow) removeCrow(); if (trash && bagRoom() >= 1) trash.test.fillBag?.(bagRoom()); updateTrashUI(true); return spawnCrow(); },
  hitCrow() { if (!crowAim.ok()) return false; crowHit(); return true; },
  hitTourist() { if (!tourAim.ok()) return false; tourHit(); return true; },
  shoot: () => shootTourist(),
  litterNow() { if (tour) removeTourist(); if (!spawnTourist(true)) return false; const a = player.heading, x = player.pos.x + Math.sin(a) * 6, z = player.pos.z + Math.cos(a) * 6; tPos.set(x, height(x, z), z); tour.heading = a; tour.state = 'drop'; tour.t = 0.6; tour.m.bag.visible = true; return true; }, // 플레이어 앞 6m 에서 바로 쓰레기를 버리고 돌아섬
  goTourist() { if (!tour) return null; const a = tour.heading, x = tPos.x + Math.sin(a) * 2, z = tPos.z + Math.cos(a) * 2; player.pos.set(x, height(x, z), z); player.heading = a + Math.PI; return { x: +x.toFixed(1), z: +z.toFixed(1) }; },
  five(i = -1) {
    const list = hbList.filter((h) => h.up()); if (!list.length) return false;
    const hb = i >= 0 ? list[i] : list.reduce((b, h) => (h.pos.distanceTo(player.pos) < b.pos.distanceTo(player.pos) ? h : b));
    const a = hb.root.rotation.y, x = hb.pos.x + Math.sin(a) * 1.8, z = hb.pos.z + Math.cos(a) * 1.8; player.pos.set(x, height(x, z), z); player.visY = player.pos.y;
    highFive(hb); return true;
  },
  state: () => ({
    tourist: tour && { state: tour.state, t: +tour.t.toFixed(1), spot: tour.spot.name, x: +tPos.x.toFixed(1), z: +tPos.z.toFixed(1), litter: !!tour.litter },
    crow: crow && { state: crow.state, t: +crow.t.toFixed(1), kind: crow.kind, y: +(cPos.y - player.pos.y).toFixed(1) },
    buff: +S.hbLeft.toFixed(0), hbDay: S.hbDay, crowN: S.crowN, fullT: +fullT.toFixed(1), tourT: +tourT.toFixed(0), spots: tSpots.length, hareubangs: hbList.length,
  }),
  resetDay() { S.hbDay = ''; S.hbLeft = 0; S.crowN = 0; S.crowAt = 0; persist(); updatePill(true); },
  save: S,
};
