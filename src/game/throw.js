// 귤 던지기·귤 활·조준 표시·화면 밖 적 방향 (#86 에서 main.js 를 나눔. 파일 순서는 src/main.js, 규칙은 notes/prototype-v1.md 코드 구조)
import { THROW_AIM, WEAPONS, COMBAT } from '../balance.js';
import * as THREE from 'three';
import { height } from '../world.js';
import { state, late } from './state.js';
import { $, save, syncEquipGear, persist } from './save.js';
import { scene, camera } from './scene.js';
import { life, buff, runner, player } from './place.js';
import { topFit, updateStats, busy } from './hud.js';
import { marker } from './input.js';

// 귤 던지기 (#34): 상호작용 버튼(F)으로, 할 일이 없을 때. 손으로 던지기는 무료라 가진 귤이 줄지 않음
// 자동 조준: 사거리 안 가장 가까운 대상(적·하르방)을 겨눠 몸을 돌려 던지고, 대상 발밑에 표시. 없으면 보는 방향으로
state.throwPending = false, state.throwAim = null;
// 무기 (#38): 귤 활 이상을 골라 쓰면 F 로 그 무기를 씀. 말·탈것·마차 위에서는 손 던지기. 3~6단계는 game/arms.js (#123)
export const weaponNow = () => WEAPONS[save.weaponUse - 1] || WEAPONS[0]; late.weaponNow = weaponNow;
export const bowReady = () => weaponNow().id !== 'hand' && !player.riding && !player.ride && !player.cart; // 무기를 쓸 수 있음 (이름은 #38 그대로)
// 남은 탄이 있거나 귤로 채울 수 있음. 귤이 0이고 남은 탄도 없으면 손 던지기
export const armedFor = (w) => w.id === 'bow' ? save.bowAmmo > 0 || save.coins > 0 : w.id === 'bomb' ? save.coins >= w.cost : w.id === 'hand' ? false : (save.ammo?.[w.id] || 0) > 0 || save.coins > 0;
export const bowArmed = () => bowReady() && armedFor(weaponNow());
export function setHoldBow(v) {
  if (state.holdBow === v) return; state.holdBow = v;
  syncEquipGear(); runner.apply(save.outfit); late.net.send(true);
}
const aimFwd = new THREE.Vector3();
// 타겟 고정 (#148): 감지 거리 안에서 가장 위험한 것 하나를 잡아 두고, 쫓아내거나(목록에서 빠짐) 멀어질 때까지 바꾸지 않음
// 순서: 나를 쫓는 적 > 가까운 것 > 화면 가운데. 하르방은 잡아 두지 않고 사거리 안에서만 (예전처럼). 화면에서 누르거나 Tab 으로 바꿈
// state.lock: life.aimTargets() 의 한 항목. 사거리(fireR) 밖이면 aimTarget() 은 null 이고 버튼에 '멀어요' (다가가기는 #132)
state.lock = null; state.lockPick = false;
const fireR = () => (bowArmed() ? weaponNow().range : THROW_AIM.range) * (late.chargeRange?.() ?? 1); // 모으는 중엔 더 멀리 (#129)
const detectR = () => (bowArmed() ? weaponNow().range + COMBAT.detectPad : COMBAT.detectHand);
const flat = (t) => Math.hypot(t.pos.x - player.pos.x, t.pos.z - player.pos.z);
function aimScore(t, fl) {
  const dx = t.pos.x - player.pos.x, dz = t.pos.z - player.pos.z, d = Math.hypot(dx, dz);
  const cos = (dx * aimFwd.x + dz * aimFwd.z) / (Math.max(d, 0.01) * fl); // 화면 가운데에 가까울수록 작게
  return (t.chase ? 0 : 1000) + d * (1.6 - 0.6 * cos);
}
let lockAt = -1, lockOut = null; // 고르기는 0.1초에 한 번 (사라진 것은 바로 놓음)
export function refreshLock(force = false) {
  const now = performance.now();
  if (!force && now - lockAt < 100 && (!lockOut || !lockOut.ok || lockOut.ok()) && (!state.lock || !state.lock.ok || state.lock.ok())) return lockOut;
  lockAt = now; return (lockOut = pickTarget());
}
function pickTarget() {
  const list = life.aimTargets(), R = detectR();
  let L = state.lock;
  if (L && (!list.includes(L) || (L.ok && !L.ok()) || flat(L) > R + COMBAT.losePad)) { L = null; state.lockPick = false; }
  camera.getWorldDirection(aimFwd); const fl = Math.hypot(aimFwd.x, aimFwd.z) || 1;
  let best = null, bs = Infinity;
  for (const t of list) { if (t.kind === 'hareubang' || flat(t) >= R) continue; const sc = aimScore(t, fl); if (sc < bs) { bs = sc; best = t; } }
  if (!L || (!state.lockPick && !L.chase && best?.chase)) L = best; // 쫓아오는 적이 생기면 그쪽으로 (직접 고른 것은 그대로)
  state.lock = L;
  if (L) return L;
  // 하르방: 사거리 안 가장 알맞은 것 (잡아 두지 않음)
  let hb = null; bs = Infinity;
  for (const t of list) { if (t.kind !== 'hareubang' || flat(t) >= fireR()) continue; const sc = aimScore(t, fl); if (sc < bs) { bs = sc; hb = t; } }
  return hb;
}
export function aimTarget() { const t = refreshLock(); return t && flat(t) < fireR() ? t : null; }
export const lockFar = () => !!state.lock && flat(state.lock) >= fireR();
// 다음 타겟 (Tab): 감지 거리 안 것들을 가까운 순으로 돌아가며
export function cycleLock() {
  refreshLock(true);
  const R = detectR(), list = life.aimTargets().filter((t) => t.kind !== 'hareubang' && flat(t) < R).sort((a, b) => flat(a) - flat(b));
  if (list.length < 2 && list[0] === state.lock) return !!list.length;
  if (!list.length) return false;
  state.lock = list[(list.indexOf(state.lock) + 1) % list.length]; state.lockPick = true; lockAt = -1; return true;
}
// 화면을 누른 자리 (x, y px) 가까이 적이 있으면 그 적으로 바꿈 → true (땅 누르기로 걷지 않음)
const pv = new THREE.Vector3();
export function pickLock(x, y) {
  let best = null, bd = COMBAT.pickPx;
  for (const t of life.aimTargets()) {
    if (t.kind === 'hareubang' || flat(t) > detectR()) continue;
    pv.set(t.pos.x, t.pos.y + t.h, t.pos.z).project(camera); if (pv.z > 1) continue;
    const d = Math.hypot((pv.x * 0.5 + 0.5) * innerWidth - x, (-pv.y * 0.5 + 0.5) * innerHeight - y);
    if (d < bd) { bd = d; best = t; }
  }
  if (!best) return false;
  state.lock = best; state.lockPick = true; lockAt = -1; return true;
}
export function setLock(t) { state.lock = t || null; state.lockPick = !!t; lockAt = -1; }
Object.assign(late, { pickLock, cycleLock });
export const aimHeading = (t) => Math.atan2(t.pos.x - player.pos.x, t.pos.z - player.pos.z);
export function throwTangerine() {
  if (busy() || player.knock || player.pose === 'throw' || player.pose === 'bow') return;
  state.emo?.stop();
  state.throwAim = aimTarget() || state.lock; // 사거리 밖 타겟도 그쪽으로 던져 휘게 함 (#148). 노루 위에서도 같게
  if (player.riding) { releaseTangerine(); return; }
  player.target = null; player.onArrive = null; marker.visible = false;
  player.pose = 'throw'; player.poseT = 0; state.throwPending = true; late.sound.beep(false);
}
// 손이 앞으로 뻗는 순간 손 위치에서 귤이 떠난다
export function releaseTangerine() {
  state.throwPending = false;
  const t = state.throwAim; state.throwAim = null;
  if (state.lobPending) { state.lobPending = false; late.releaseBomb(t); return; } // 귤 폭탄 (#123): 같은 던지기 동작으로 폭탄을 놓음
  let dir = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
  let from = player.pos.clone().addScaledVector(dir, 0.6); from.y += 1.4 + player.jumpY + (player.riding ? 0.95 : 0);
  if (!player.riding) { const arm = runner.root.userData.parts?.armR; if (arm) { runner.root.updateMatrixWorld(true); const h = arm.localToWorld(new THREE.Vector3(0, -0.5, 0)); if (isFinite(h.x + h.y + h.z)) from = h; } }
  const peers = () => (late.net.solo ? [] : [...[...late.net.peersById.values()].map((e) => ({ id: e.peer, pos: e.pos }))]); // #100 튜토리얼 중엔 혼자
  const ch = state.chargeShot; state.chargeShot = null; // 모아 쏘기 (#129): game/charge.js 가 놓을 때 넣음
  const shot = t && aimShot(from, t);
  let tg;
  if (shot) tg = life.throwTangerine(from, shot.dir, shot.vh, peers, shot.vy, t, ch); // 타겟 쪽으로 휨 (#148)
  else tg = life.throwTangerine(from, dir, (THROW_AIM.power + (player.running ? THROW_AIM.runBonus : 0)) * (ch ? Math.sqrt(ch.rng) : 1), peers, undefined, null, ch);
  if (ch) late.chargeLaunch?.(ch, 'hand', tg.mesh.position, () => !tg.enemyHit && !tg.landed && tg.mesh.parent, t);
}
// 손 위치에서 대상의 겨눌 점까지 포물선(중력 22)으로 닿는 속도. 움직이는 대상은 날아가는 동안 갈 곳을 미리 겨눔
function aimShot(from, t) {
  const aim = new THREE.Vector3(t.pos.x, t.pos.y + t.h, t.pos.z);
  let vh = THROW_AIM.power, k = THROW_AIM.k;
  for (let i = 0; i < 2; i++) {
    const p = aim.clone();
    if (t.vel && i) p.addScaledVector(t.vel, THROW_AIM.lead * Math.hypot(aim.x - from.x, aim.z - from.z) / vh);
    const dx = p.x - from.x, dz = p.z - from.z, D = Math.hypot(dx, dz), dy = p.y - from.y;
    if (D < 0.5) return null;
    k = Math.min(THROW_AIM.kMax, Math.max(THROW_AIM.k, (dy + 0.25 * D) / D));
    const den = k * D - dy; if (den <= 0.05) return null;
    vh = Math.min(THROW_AIM.vMax, Math.max(THROW_AIM.vMin, Math.sqrt(11 * D * D / den)));
    if (i === 1 || !t.vel) return { dir: new THREE.Vector3(dx / D, 0, dz / D), vh, vy: k * vh };
  }
  return null;
}
// 귤 활 쏘기 (#38): 5발에 귤 1개. 남은 화살이 없으면 귤 하나를 써서 채움
state.bowPending = false;
export function fireWeapon() { if (!bowArmed()) throwTangerine(); else if (weaponNow().id === 'bow') shootBow(); else late.fireArm(); }
function shootBow() {
  if (busy() || player.knock || player.pose === 'throw' || player.pose === 'bow') return;
  state.emo?.stop();
  const w = weaponNow();
  if (save.bowAmmo <= 0) { if (save.coins < 1) { throwTangerine(); return; } save.coins -= 1; save.bowAmmo = w.perGyul; updateStats(); ammoFlash = 1; }
  save.bowAmmo -= 1; persist(); updateAmmo();
  setHoldBow(true);
  state.throwAim = aimTarget() || state.lock;
  player.target = null; player.onArrive = null; marker.visible = false;
  player.pose = 'bow'; player.poseT = 0; state.bowPending = true;
}
export function releaseArrow() {
  state.bowPending = false;
  const t = state.throwAim; state.throwAim = null;
  const w = weaponNow(), fwd = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
  let from = player.pos.clone().addScaledVector(fwd, 0.7); from.y += 1.45 + player.jumpY;
  { const arm = runner.root.userData.parts?.armL; if (arm) { runner.root.updateMatrixWorld(true); const h = arm.localToWorld(new THREE.Vector3(0, -0.5, 0)); if (isFinite(h.x + h.y + h.z)) from = h.addScaledVector(fwd, 0.25); } }
  const peers = () => [...late.net.peersById.values()].map((e) => ({ id: e.peer, pos: e.pos }));
  const ch = state.chargeShot; state.chargeShot = null; // 모아 쏘기 (#129)
  const vel = (t && arrowShot(from, t, w)) || fwd.clone().multiplyScalar(w.speed).setY(w.grav * 0.12);
  const a = life.shootArrow(from, vel, { dmg: w.dmg * buff.mul('dmg') * (ch?.mul || 1), grav: w.grav, peersFn: peers, home: t, ch: ch?.k, size: ch?.size });
  if (ch) late.chargeLaunch?.(ch, 'bow', a.mesh.position, () => life.arrows.includes(a), t);
  late.sound.bow?.();
}
// 거의 곧게 날아가는 화살: 날아갈 시간만큼 중력과 대상의 움직임을 미리 셈
function arrowShot(from, t, w) {
  const aim = new THREE.Vector3(t.pos.x, t.pos.y + t.h, t.pos.z), p = aim.clone();
  let T = 0;
  for (let i = 0; i < 2; i++) {
    p.copy(aim); if (t.vel) p.addScaledVector(t.vel, T);
    const D = Math.hypot(p.x - from.x, p.z - from.z); if (D < 0.3) return null;
    T = D / w.speed;
  }
  return new THREE.Vector3((p.x - from.x) / T, (p.y - from.y) / T + 0.5 * w.grav * T, (p.z - from.z) / T);
}
// 남은 화살 표시: 상호작용 버튼 위 작은 점 5개 (활을 쓸 때만). 3~6단계 무기는 game/arms.js armsAmmo (#123)
let ammoFlash = 0, ammoKey = '';
export function updateAmmo() {
  const el = $('ammo'); if (!el) return;
  const w = weaponNow(), on = bowReady();
  if (on && w.id !== 'bow') { ammoKey = ''; late.armsAmmo?.(el); return; }
  const n = save.bowAmmo, key = `${on}|${n}|${save.coins > 0}`;
  if (key === ammoKey) return; ammoKey = key;
  el.hidden = !on; if (!on) return;
  el.className = 'ammo'; el.style.removeProperty('--k');
  el.classList.toggle('empty', n <= 0 && save.coins <= 0);
  el.innerHTML = Array.from({ length: w.perGyul }, (_, i) => `<b class="${i < n ? 'on' : ''}"></b>`).join('');
  if (ammoFlash) { ammoFlash = 0; el.classList.remove('use'); void el.offsetWidth; el.classList.add('use'); }
}
// 겨눈 대상 발밑 표시
export const aimMark = new THREE.Mesh(new THREE.RingGeometry(0.78, 1, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff8a1f', transparent: true, opacity: 0.85, depthWrite: false }));
aimMark.visible = false; aimMark.renderOrder = 3; scene.add(aimMark);
const aimTri = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 3).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: '#ff8a1f', depthTest: false, transparent: true }));
aimTri.visible = false; aimTri.renderOrder = 9; scene.add(aimTri);
export function tickAimMark(time) {
  const t = state.throwAim || refreshLock(); // 고정한 타겟은 늘 보임 (#148, 탈것 위에서도). 사거리 밖이면 흐리게
  aimMark.visible = aimTri.visible = !!t;
  if (!t) return;
  { const far = flat(t) >= fireR() ? 0.35 : 0.85; aimMark.material.opacity = far; aimTri.material.opacity = far + 0.15; }
  const s = t.size * THROW_AIM.mark * (1 + Math.sin(time * 6) * 0.08);
  aimMark.scale.set(s, 1, s); aimMark.position.set(t.pos.x, height(t.pos.x, t.pos.z) + 0.08, t.pos.z); aimMark.rotation.y = time * 1.5;
  aimTri.position.set(t.pos.x, t.pos.y + (t.h || 0.8) * 2 + 0.9 + Math.sin(time * 6) * 0.1, t.pos.z); aimTri.rotation.y = time * 2;
}
// 화면 밖 가까운 적 방향 표시 (#56): 가장자리에 귤색 세모 + 종류 아이콘, 가까울수록 크고 진하게, 최대 3개
const EDGE_IC = () => ({ boar: '<b>멧</b>', truck: late.DUMP_IC, target: '<b>◎</b>' }); // target: 튜토리얼 과녁 (#62)
const edgeEls = Array.from({ length: 3 }, (_, i) => { const el = document.createElement('div'); el.className = 'edge-aim'; el.hidden = true; el.setAttribute('aria-hidden', 'true'); document.body.appendChild(el); return el; });
const edgeV = new THREE.Vector3();
export function tickEdgeAim() {
  const list = [];
  for (const t of life.aimTargets()) {
    const d = Math.hypot(t.pos.x - player.pos.x, t.pos.z - player.pos.z); if (d > THROW_AIM.edgeRange) continue;
    edgeV.set(t.pos.x, t.pos.y + 1, t.pos.z).project(camera);
    if (edgeV.z < 1 && Math.abs(edgeV.x) < 0.95 && Math.abs(edgeV.y) < 0.95) continue; // 화면 안
    let x = edgeV.x, y = edgeV.y; if (edgeV.z > 1) { x = -x; y = -y; }
    list.push({ t, d, x, y });
  }
  list.sort((a, b) => a.d - b.d);
  const W = innerWidth, H = innerHeight, m = 30;
  edgeEls.forEach((el, i) => {
    const e = list[i]; el.hidden = !e; if (!e) return;
    const k = 1 / Math.max(Math.abs(e.x), Math.abs(e.y), 1e-3), x = e.x * k, y = e.y * k;
    const px = Math.min(W - m, Math.max(m, (x * 0.5 + 0.5) * W)), py = Math.min(H - m, Math.max(topFit.bottom + 72, (-y * 0.5 + 0.5) * H));
    const near = 1 - e.d / THROW_AIM.edgeRange, sc = 0.7 + 0.5 * near, ang = Math.atan2(-e.y, e.x) * 180 / Math.PI + 90;
    el.style.transform = `translate(${px - 22}px, ${py - 22}px) scale(${sc})`; el.style.opacity = String(0.45 + 0.55 * near);
    el.style.setProperty('--a', ang + 'deg');
    const kind = e.t.kind || 'boar'; if (el.dataset.k !== kind) { el.dataset.k = kind; el.innerHTML = '<i></i><span>' + (EDGE_IC()[kind] || '!') + '</span>'; }
  });
}
