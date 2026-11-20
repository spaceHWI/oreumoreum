// 귤 던지기·귤 활·조준 표시·화면 밖 적 방향 (#86 에서 main.js 를 나눔. 파일 순서는 src/main.js, 규칙은 notes/prototype-v1.md 코드 구조)
import { THROW_AIM, WEAPONS } from '../balance.js';
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
// 무기 (#38): 귤 활을 샀으면 F 로 활을 쏨. 말 탄 동안은 손 던지기
export const weaponNow = () => WEAPONS[save.equip.weapon - 1] || WEAPONS[0]; late.weaponNow = weaponNow;
export const bowReady = () => weaponNow().id === 'bow' && !player.riding && !player.ride && !player.cart;
export const bowArmed = () => bowReady() && (save.bowAmmo > 0 || save.coins > 0); // 귤이 0이고 남은 화살도 없으면 손 던지기
export function setHoldBow(v) {
  if (state.holdBow === v) return; state.holdBow = v;
  syncEquipGear(); runner.apply(save.outfit); late.net.send(true);
}
const aimFwd = new THREE.Vector3();
export function aimTarget() {
  let best = null, bd = bowArmed() ? weaponNow().range : THROW_AIM.range;
  // 화면 가운데에 가까운 쪽을 우선: 카메라 앞쪽과 이루는 각이 클수록 거리를 더 먼 것으로 침
  camera.getWorldDirection(aimFwd); const fl = Math.hypot(aimFwd.x, aimFwd.z) || 1;
  let bs = Infinity;
  for (const t of life.aimTargets()) {
    const dx = t.pos.x - player.pos.x, dz = t.pos.z - player.pos.z, d = Math.hypot(dx, dz); if (d >= bd) continue;
    const cos = (dx * aimFwd.x + dz * aimFwd.z) / (Math.max(d, 0.01) * fl), sc = d * (1.6 - 0.6 * cos);
    if (sc < bs) { bs = sc; best = t; }
  }
  return best;
}
export const aimHeading = (t) => Math.atan2(t.pos.x - player.pos.x, t.pos.z - player.pos.z);
export function throwTangerine() {
  if (busy() || player.knock || player.pose === 'throw' || player.pose === 'bow') return;
  state.emo?.stop();
  state.throwAim = player.riding ? null : aimTarget();
  if (player.riding) { releaseTangerine(); return; }
  player.target = null; player.onArrive = null; marker.visible = false;
  player.pose = 'throw'; player.poseT = 0; state.throwPending = true; late.sound.beep(false);
}
// 손이 앞으로 뻗는 순간 손 위치에서 귤이 떠난다
export function releaseTangerine() {
  state.throwPending = false;
  const t = state.throwAim; state.throwAim = null;
  let dir = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
  let from = player.pos.clone().addScaledVector(dir, 0.6); from.y += 1.4 + player.jumpY + (player.riding ? 0.95 : 0);
  if (!player.riding) { const arm = runner.root.userData.parts?.armR; if (arm) { runner.root.updateMatrixWorld(true); const h = arm.localToWorld(new THREE.Vector3(0, -0.5, 0)); if (isFinite(h.x + h.y + h.z)) from = h; } }
  const peers = () => [...[...late.net.peersById.values()].map((e) => ({ id: e.peer, pos: e.pos }))];
  const shot = t && aimShot(from, t);
  if (shot) life.throwTangerine(from, shot.dir, shot.vh, peers, shot.vy);
  else life.throwTangerine(from, dir, THROW_AIM.power + (player.running ? THROW_AIM.runBonus : 0), peers);
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
export function fireWeapon() { if (bowArmed()) shootBow(); else throwTangerine(); }
function shootBow() {
  if (busy() || player.knock || player.pose === 'throw' || player.pose === 'bow') return;
  state.emo?.stop();
  const w = weaponNow();
  if (save.bowAmmo <= 0) { if (save.coins < 1) { throwTangerine(); return; } save.coins -= 1; save.bowAmmo = w.perGyul; updateStats(); ammoFlash = 1; }
  save.bowAmmo -= 1; persist(); updateAmmo();
  setHoldBow(true);
  state.throwAim = aimTarget();
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
  const vel = (t && arrowShot(from, t, w)) || fwd.clone().multiplyScalar(w.speed).setY(w.grav * 0.12);
  life.shootArrow(from, vel, { dmg: w.dmg * buff.mul('dmg'), grav: w.grav, peersFn: peers });
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
// 남은 화살 표시: 상호작용 버튼 위 작은 점 5개 (활을 쓸 때만)
let ammoFlash = 0, ammoKey = '';
export function updateAmmo() {
  const el = $('ammo'); if (!el) return;
  const on = bowReady(), n = save.bowAmmo, key = `${on}|${n}|${save.coins > 0}`;
  if (key === ammoKey) return; ammoKey = key;
  el.hidden = !on; if (!on) return;
  el.classList.toggle('empty', n <= 0 && save.coins <= 0);
  el.innerHTML = Array.from({ length: weaponNow().perGyul }, (_, i) => `<b class="${i < n ? 'on' : ''}"></b>`).join('');
  if (ammoFlash) { ammoFlash = 0; el.classList.remove('use'); void el.offsetWidth; el.classList.add('use'); }
}
// 겨눈 대상 발밑 표시
export const aimMark = new THREE.Mesh(new THREE.RingGeometry(0.78, 1, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff8a1f', transparent: true, opacity: 0.85, depthWrite: false }));
aimMark.visible = false; aimMark.renderOrder = 3; scene.add(aimMark);
const aimTri = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 3).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: '#ff8a1f', depthTest: false, transparent: true }));
aimTri.visible = false; aimTri.renderOrder = 9; scene.add(aimTri);
export function tickAimMark(time) {
  const t = state.throwAim || (!player.riding ? aimTarget() : null) || (state.ctxTarget === late.throwAct ? aimTarget() : null);
  aimMark.visible = aimTri.visible = !!t;
  if (!t) return;
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
