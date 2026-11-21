// 무기 3~6단계 (#123): 귤 총(한 발씩)·귤 머신건(누르고 있으면 연사)·귤즙 레이저(누르는 동안 줄기)·귤 폭탄(포물선, 광역)
// 쏘기·누르고 있기·탄 표시·무기 고르기(내 가방 무기 탭 #166)·멀티에 보이기(presence wf 사건만)
// 효과는 src/weaponfx.js, 손에 든 모양 src/weaponmodels.js, 소리 src/weaponsound.js, 수치 balance.js WEAPONS·WEAPON_FX
// 활(#38)·손 던지기는 throw.js 그대로. throw.js fireWeapon 이 3~6단계면 late.fireArm 을 부름
import * as THREE from 'three';
import { WEAPONS, WEAPON_FX as F, CHARGE } from '../balance.js';
import { Sound } from '../audio.js';
import { weaponSounds } from '../weaponsound.js';
import { createWeaponFx } from '../weaponfx.js';
import { MUZZLE } from '../weaponmodels.js';
import { LOW } from '../gfx2.js';
import { height } from '../world.js';
import { state, late } from './state.js';
import { $, save, persist } from './save.js';
import { scene } from './scene.js';
import { life, buff, runner, player } from './place.js';
import { updateStats, busy, toast, ui } from './hud.js';
import { keys, marker } from './input.js';
import { weaponNow, bowReady, bowArmed, armedFor, aimTarget, aimHeading, setHoldBow, fireWeapon } from './throw.js';

Object.assign(Sound.prototype, weaponSounds); // gun·mg·laser·lob·boom
const sfx = () => late.sound;
export const armFx = createWeaponFx({ scene, life, LOW, sound: { splat: () => sfx()?.splat?.(), boom: () => sfx()?.boom?.() } });
const W = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));
const ARM_IDS = ['gun', 'mg', 'laser', 'bomb'], CH_IDS = ['hand', 'bow']; // 손·활은 모아 쏜 한 방만 보냄 (#129)
const A = { cd: 0, aimT: 0, kick: 0, held: false, lasing: false, beam: null, tick: 0, burstT: 0, seq: 0, out: null, outT: 0, bombCd: 0, flash: 0, mgB: null, thick: null }; // mgB·thick: 모아 쏜 머신건 연사·레이저 굵은 줄기 (#129)
state.lobPending = false;
state.armKick = 0; // runner 'aim' 반동 (update.js 가 animate 에 넘김)

const peers = () => (late.net?.solo ? [] : [...late.net.peersById.values()].map((e) => ({ id: e.peer, pos: e.pos })));
const fwd = () => new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
const tmpV = new THREE.Vector3();
// 총구 자리: 겨눈 자세가 다 올라왔으면 손에 든 무기 끝, 아니면 어림(앞·왼쪽·어깨 높이)
function muzzle(id) {
  const arm = runner.root.userData.parts?.armL;
  if (arm && player.pose === 'aim' && player.poseT > 0.1 && MUZZLE[id]) { runner.root.updateMatrixWorld(true); const h = arm.localToWorld(tmpV.set(...MUZZLE[id])); if (isFinite(h.x + h.y + h.z)) return h.clone(); }
  const f = fwd(), p = player.pos.clone().addScaledVector(f, 0.8); p.x += f.z * 0.16; p.z -= f.x * 0.16; p.y += 1.45 + player.jumpY; return p;
}
// 대상의 겨눌 점 (움직이면 날아갈 시간만큼 앞)
function aimPoint(t, from, speed) {
  const p = new THREE.Vector3(t.pos.x, t.pos.y + t.h, t.pos.z);
  if (t.vel && speed) p.addScaledVector(t.vel, from.distanceTo(p) / speed);
  return p;
}
// 귤 하나로 탄 채우기. 모자라면 false
function useAmmo(w) {
  if ((save.ammo[w.id] || 0) <= 0) { if (save.coins < 1) return false; save.coins -= 1; save.ammo[w.id] = w.perGyul || 1; updateStats(); A.flash = 1; }
  return true;
}
function startAim(t) {
  setHoldBow(true); state.emo?.stop();
  player.target = null; player.onArrive = null; marker.visible = false;
  if (player.pose !== 'aim') { player.pose = 'aim'; player.poseT = 0; }
  state.throwAim = t || null; A.aimT = F.aimT;
}
// 한 발 (총·머신건)
function shot(w, spread = 0, ch = null) { // ch: 모아 쏘기 { k, mul, size } (#129)
  const t = aimTarget(); startAim(t);
  if (t) player.heading = aimHeading(t); // 겨눈 쪽을 바로 봄 (빠른 탄)
  const from = muzzle(w.id);
  let v;
  if (t) { const p = aimPoint(t, from, w.speed), T = from.distanceTo(p) / w.speed; v = p.sub(from).divideScalar(T); v.y += 0.5 * w.grav * T; }
  else v = fwd().multiplyScalar(w.speed).setY(w.grav * 0.1);
  if (spread) { v.applyAxisAngle(THREE.Object3D.DEFAULT_UP, (Math.random() - 0.5) * 2 * spread); v.y += (Math.random() - 0.5) * spread * w.speed; }
  const dmg = (w.dps ? w.dmg / w.rate : w.dmg) * buff.mul('dmg') * (ch?.mul || 1);
  const s = armFx.shoot(from, v, { dmg, grav: w.grav, life: w.range * (ch?.rng || 1) / w.speed + 0.15, peersFn: peers, quiet: !!w.dps, home: t, ch: ch?.k, size: ch?.size }); // 유도 (#148)
  if (!ch) save.ammo[w.id] -= 1; A.kick = 1; persist();
  if (w.id === 'gun') sfx()?.gun?.(); else sfx()?.mg?.();
  const tp = t ? aimPoint(t, from, 0) : from.clone().addScaledVector(v.clone().normalize(), w.range);
  if (ch && w.id === 'gun') { late.chargeLaunch?.(ch, 'gun', s.p, () => armFx.shots.includes(s), t); sendShot('gun', tp, ch.k); }
  else if (!ch || !A.mgB || A.mgB.left === A.mgB.n) sendShot(w.id, tp, ch ? ch.k : 0);
}

// 누르기 (throw.js fireWeapon → 3~6단계)
function fireArm() {
  const w = weaponNow();
  if (busy() || player.knock || player.pose === 'throw' || player.pose === 'bow') return;
  if (w.id === 'gun') { if (A.cd > 0) return; if (!useAmmo(w)) return; shot(w); A.cd = w.cd; }
  else if (w.id === 'mg') { if (A.cd > 0) return; if (!useAmmo(w)) return; shot(w, w.spread); A.cd = 1 / w.rate; A.held = true; }
  else if (w.id === 'laser') { if (!A.lasing && ((save.ammo.laser || 0) > 0 || save.coins > 0)) { A.lasing = true; A.held = true; A.burstT = 0.15; A.tick = 0; A.seq++; } }
  else if (w.id === 'bomb') {
    if (A.bombCd > 0) { toast('폭탄을 다시 쥐는 중이에요'); return; }
    if (save.coins < w.cost) return;
    const t = aimTarget();
    save.coins -= w.cost; updateStats(); persist(); A.bombCd = w.cd;
    setHoldBow(true); state.emo?.stop();
    player.target = null; player.onArrive = null; marker.visible = false;
    state.throwAim = t; player.pose = 'throw'; player.poseT = 0; state.throwPending = true; state.lobPending = true;
    late.sound?.beep?.(false);
  }
}
// 던지는 동작에서 손이 앞으로 뻗는 순간 (throw.js releaseTangerine)
function releaseBomb(t) {
  const w = W.bomb, B = F.bomb;
  let from = player.pos.clone().addScaledVector(fwd(), 0.6); from.y += 1.5 + player.jumpY;
  const arm = runner.root.userData.parts?.armR; if (arm) { runner.root.updateMatrixWorld(true); const h = arm.localToWorld(new THREE.Vector3(-0.43, 0.505, 0.1)); if (isFinite(h.x + h.y + h.z)) from = h; }
  let to;
  if (t) { to = new THREE.Vector3(t.pos.x, t.pos.y + 0.3, t.pos.z); const T0 = 0.35 + from.distanceTo(to) * 0.03; if (t.vel) to.addScaledVector(t.vel, T0); }
  else { to = player.pos.clone().addScaledVector(fwd(), 14); to.y = height(to.x, to.z); }
  const vel = lobVel(from, to, B), ch = state.chargeShot; state.chargeShot = null; // 모아 쏘기 (#129)
  armFx.lob(from, vel, { dmg: w.dmg * buff.mul('dmg') * (ch?.mul || 1), r: w.r * (ch ? 1 + (CHARGE.bombR - 1) * ch.k : 1), ch: ch?.k, size: ch?.size });
  if (ch) { const b = armFx.bombs[armFx.bombs.length - 1]; late.chargeLaunch?.(ch, 'bomb', b.g.position, () => armFx.bombs.includes(b), t); }
  sfx()?.lob?.(); sendShot('bomb', to, ch ? ch.k : 0);
}
function lobVel(from, to, B) {
  const dx = to.x - from.x, dz = to.z - from.z, D = Math.max(0.5, Math.hypot(dx, dz));
  const vh = Math.min(B.vMax, Math.max(B.vMin, Math.sqrt(B.grav * D * 0.5 / B.k)));
  const T = D / vh, vy = (to.y - from.y + 0.5 * B.grav * T * T) / T;
  return new THREE.Vector3(dx / D * vh, vy, dz / D * vh);
}

// 레이저 한 프레임: 대상(없으면 앞)까지 줄기, tick 마다 피해·젖음, 초당 귤 gyulPerSec
function tickLaser(dt, w) {
  const left = (save.ammo.laser || 0) - w.gyulPerSec * dt * (A.thick ? 1 + (CHARGE.cost - 1) * A.thick.k : 1);
  if (left <= 0) { if (save.coins < 1) { stopLaser(); return; } save.coins -= 1; save.ammo.laser = left + 1; updateStats(); A.flash = 1; } else save.ammo.laser = left;
  const t = aimTarget(); startAim(t);
  if (t) player.heading += Math.atan2(Math.sin(aimHeading(t) - player.heading), Math.cos(aimHeading(t) - player.heading)) * Math.min(1, dt * 14);
  const from = muzzle('laser');
  const to = t ? aimPoint(t, from, 0) : from.clone().addScaledVector(fwd().setY(-0.08).normalize(), w.range);
  if (!A.beam) A.beam = armFx.beam();
  A.tick -= dt; let hit = null;
  if (A.tick <= 0) {
    A.tick += w.tick;
    // 줄기를 따라 0.5m 마다 맞는지 봄 (가장 가까운 것 하나)
    const dir = to.clone().sub(from), L = dir.length(); dir.divideScalar(L || 1);
    const T = A.thick; // 모아 쏜 굵은 줄기 (#129): 피해 × mul, 맞으면 더 밀림
    for (let s = 0.5; s <= L + 0.6 && !hit; s += 0.5) hit = life.hitAt(tmpV.copy(from).addScaledVector(dir, s), w.dmg * w.tick * buff.mul('dmg') * (T ? T.mul : 1), null, { quiet: true, hb: false, ch: T ? T.k * 0.5 : 0 });
    if (hit && hit !== true) armFx.wet(hit);
    A.lastHit = hit ? 0.25 : Math.max(0, (A.lastHit || 0) - w.tick);
  }
  armFx.setBeam(A.beam, from, to, dt, (A.lastHit || 0) > 0, A.thick ? 1 + (CHARGE.laser.w - 1) * A.thick.k : 1);
  sfx()?.laser?.(true); A.kick = 0.25 + Math.sin(performance.now() / 30) * 0.1;
  sendBurst('laser', to);
}
function stopLaser() {
  A.thick = null;
  if (!A.lasing) return;
  A.lasing = false; armFx.offBeam(A.beam); A.beam = null; sfx()?.laser?.(false); endBurst();
}

// ---------- 모아 쏘기 (#129): game/charge.js 가 놓을 때 부름. ch = { k, mul, size, rng, units } ----------
// 총: 큰 한 발(cd 무시). 머신건: 짧은 집중 연사(한 발마다 탄 × cost 배). 레이저: 굵은 줄기 t 초. 폭탄: 큰 폭탄(던지기 동작)
export function chargedArm(w, ch) {
  if (w.id === 'gun') { shot(w, 0, ch); A.cd = w.cd; sfx()?.chargeShot?.(ch.k); }
  else if (w.id === 'mg') { const n = Math.max(2, Math.round(CHARGE.mg.n * ch.k)); A.mgB = { n, left: n, T: 0, ch }; sfx()?.chargeShot?.(ch.k); }
  else if (w.id === 'laser') {
    A.thick = { t: Math.max(0.25, CHARGE.laser.t * ch.k), k: ch.k, mul: ch.mul };
    if (!A.lasing) { A.lasing = true; A.held = true; A.tick = 0; A.seq++; }
    A.burstT = A.thick.t; sfx()?.chargeShot?.(ch.k);
  } else if (w.id === 'bomb') {
    const t = aimTarget(); A.bombCd = w.cd;
    setHoldBow(true); state.emo?.stop();
    player.target = null; player.onArrive = null; marker.visible = false;
    state.chargeShot = ch; state.throwAim = t; state.throwPending = true; state.lobPending = true;
    if (player.pose !== 'throw') { player.pose = 'throw'; player.poseT = 0.3; }
  }
}
function tickMgBurst(dt, w, ok) {
  const B = A.mgB;
  if (!ok || w.id !== 'mg' || player.knock) { A.mgB = null; return; }
  B.T -= dt;
  while (B.T <= 0 && B.left > 0) {
    if (!spend(w, 1 + (CHARGE.cost - 1) * B.ch.k)) { B.left = 0; break; }
    shot(w, CHARGE.mg.spread, B.ch); B.left--; B.T += 1 / CHARGE.mg.rate;
  }
  if (B.left <= 0) { A.mgB = null; A.cd = 1 / w.rate; }
}
// 탄 u 몫을 씀 (모자라면 귤로 채움). 다 못 쓰면 false
export function spend(w, u) {
  if (w.id === 'bomb' || w.id === 'hand') { const c = Math.ceil(u * (w.cost || 1) - 1e-6); if (save.coins < c) return false; save.coins -= c; updateStats(); persist(); return true; }
  const per = w.perGyul || 1, get = () => (w.id === 'bow' ? save.bowAmmo : save.ammo[w.id] || 0), set = (v) => { if (w.id === 'bow') save.bowAmmo = v; else save.ammo[w.id] = v; };
  let a = get();
  while (a < u - 1e-6 && save.coins >= 1) { save.coins -= 1; a += per; A.flash = 1; }
  if (a < u - 1e-6) { set(a); updateStats(); persist(); return false; }
  set(Math.max(0, a - u)); updateStats(); persist(); return true;
}
// 쓸 수 있는 탄 몫 (가진 탄 + 귤로 채울 수 있는 것)
export function units(w) {
  if (w.id === 'hand') return save.coins;
  if (w.id === 'bomb') return Math.floor(save.coins / w.cost);
  return (w.id === 'bow' ? save.bowAmmo : save.ammo[w.id] || 0) + save.coins * (w.perGyul || 1);
}
// 모으는 동안 겨눈 자세 유지 (총·머신건·레이저)
export function holdAim(t) { startAim(t); }
export const armsBusy = () => !!(A.mgB || A.thick) || A.lasing;

// ---------- 누르고 있기: F 키 또는 상호작용 버튼 (그 순간 할 일이 던지기일 때만) ----------
let ctxHeld = false;
ui.ctx.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button) return; ctxHeld = state.ctxTarget === late.throwAct; if (ctxHeld) { try { ui.ctx.setPointerCapture(e.pointerId); } catch (_) { /* 무시 */ } } });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) ui.ctx.addEventListener(ev, () => { ctxHeld = false; });
addEventListener('blur', () => { ctxHeld = false; });
export const holding = () => ctxHeld || keys.has('f');

// ---------- 매 프레임 (update.js updatePlayer) ----------
function tickArms(dt) {
  A.gt = (A.gt || 0) + dt; // 게임 시간 (tools/arms.js 확인용)
  A.cd = Math.max(0, A.cd - dt); A.bombCd = Math.max(0, A.bombCd - dt); A.kick = Math.max(0, A.kick - dt / F.kick);
  state.armKick = A.kick;
  const w = weaponNow(), ok = bowReady() && !busy() && !player.knock;
  if (A.thick) { A.thick.t -= dt; if (A.thick.t <= 0) A.thick = null; else A.burstT = Math.max(A.burstT, A.thick.t); } // 굵은 줄기는 놓아도 t 초 이어짐 (#129)
  if (A.lasing) { A.burstT -= dt; if (ok && w.id === 'laser' && (holding() || A.burstT > 0)) tickLaser(dt, w); else stopLaser(); }
  if (A.mgB) tickMgBurst(dt, w, ok);
  if (A.held && w.id === 'mg') {
    if (ok && holding() && armedFor(w)) { if (A.cd <= 0 && useAmmo(w)) { shot(w, w.spread); A.cd += 1 / w.rate; } }
    else { A.held = false; endBurst(); }
  } else if (A.held && w.id !== 'laser') A.held = false;
  // 누르고 있으면 쉬지 않고 이어서 (#148): 받혀 끊겼거나 손·활·총·폭탄이어도 다음 발. 폭탄은 다시 쥐면
  // 모아 쏘기 (#129) 가 맡을 때는 손·활·총·폭탄은 이어 쏘지 않음 (놓을 때 game/charge.js 가 쏨). 머신건·레이저는 그대로 이어 쏨
  const cont = !late.chargeOk?.() || (bowReady() && (w.id === 'mg' || w.id === 'laser'));
  if (cont && !A.mgB && holding() && state.ctxTarget === late.throwAct && !busy() && !player.knock && !A.lasing && !(A.held && w.id === 'mg') && player.pose !== 'throw' && player.pose !== 'bow' && !(w.id === 'bomb' && bowReady() && A.bombCd > 0)) fireWeapon();
  if (player.pose === 'aim') {
    A.aimT -= dt;
    if (A.aimT <= 0 || !ok) { player.pose = 'move'; state.throwAim = null; }
  }
  if (A.outT > 0) { A.outT -= dt; if (A.outT <= 0) A.out = null; }
  tickPeers(dt);
  armFx.update(dt);
}

// ---------- 탄 표시: 총은 점 8개, 머신건·레이저는 막대(남은 몫), 폭탄은 다시 쥐는 막대 ----------
let ammoKey = '';
function armsAmmo(el) {
  const w = weaponNow();
  let k, dots = 0;
  if (w.id === 'gun') { dots = w.perGyul; k = save.ammo.gun || 0; }
  else if (w.id === 'mg') k = (save.ammo.mg || 0) / w.perGyul;
  else if (w.id === 'laser') k = save.ammo.laser || 0;
  else k = 1 - A.bombCd / w.cd;
  const empty = !armedFor(w), key = `${w.id}|${dots ? k : Math.round(k * 40)}|${empty}`;
  if (key === ammoKey && !A.flash) return; ammoKey = key;
  el.hidden = false; el.className = 'ammo' + (dots ? '' : ' bar') + (empty ? ' empty' : '');
  if (dots) { if (el.childElementCount !== dots || el.firstElementChild?.tagName !== 'B' || el.dataset.w !== w.id) el.innerHTML = '<b></b>'.repeat(dots); [...el.children].forEach((b, i) => b.classList.toggle('on', i < k)); }
  else { if (el.dataset.w !== w.id || el.childElementCount !== 1) el.innerHTML = '<b></b>'; el.style.setProperty('--k', String(Math.max(0, Math.min(1, k)))); }
  el.dataset.w = w.id;
  if (A.flash) { A.flash = 0; el.classList.remove('use'); void el.offsetWidth; el.classList.add('use'); }
}

// ---------- 멀티 (presence wf): [무기, x, y, z, 번호]. 총·폭탄은 번호가 바뀔 때마다 한 발, 머신건·레이저는 누르는 동안 같은 번호로 겨눈 점만 바뀜 ----------
const r1 = (v) => Math.round(v * 10) / 10;
function sendShot(id, p, k = 0) { if (id === 'mg' && !k) { sendBurst('mg', p); return; } A.seq++; A.out = [id, r1(p.x), r1(p.y), r1(p.z), A.seq]; if (k) A.out.push(0, r1(k)); A.outT = k ? CHARGE.peerMs / 1000 : F.peerSeq; } // k: 모아 쏜 정도 (#129, 7번째 칸)
function sendBurst(id, p) { if (!A.out || A.out[0] !== id || A.out[5] !== 1) A.seq++; A.out = [id, r1(p.x), r1(p.y), r1(p.z), A.seq, 1]; A.outT = 0.35; }
function endBurst() { if (A.out && A.out[5] === 1) { A.out = null; A.outT = 0; } }
export const armsPresence = () => (A.out ? { wf: A.out } : {});
late.armsSend = sendShot; // 모아 쏜 손·활 (#129, game/charge.js)
late.armsPresence = armsPresence;
const peerFx = new Map(); // peer → { seq, beam, mgT, seen }
const pv = new THREE.Vector3();
function peerMuzzle(e, id) {
  const arm = e.runner.root.userData.parts?.armL;
  if (arm && id !== 'bomb' && MUZZLE[id]) { const h = arm.localToWorld(pv.set(...MUZZLE[id])); if (isFinite(h.x + h.y + h.z)) return h.clone(); }
  const f = new THREE.Vector3(Math.sin(e.heading), 0, Math.cos(e.heading)); return e.pos.clone().addScaledVector(f, 0.7).setY(e.pos.y + 1.5);
}
function tickPeers(dt) {
  const net = late.net; if (!net?.peersById) return;
  const alone = !!net.solo;
  for (const [id, s] of peerFx) if (!net.peersById.has(id) || alone) { armFx.offBeam(s.beam); peerFx.delete(id); }
  if (alone) return;
  for (const e of net.peersById.values()) {
    const d = e.data?.wf; let s = peerFx.get(e.peer);
    const chk = Array.isArray(d) && Number.isFinite(d[6]) ? Math.max(0, Math.min(1, d[6])) : 0;
    const valid = Array.isArray(d) && d.length >= 5 && (ARM_IDS.includes(d[0]) || (chk > 0 && CH_IDS.includes(d[0]))) && [d[1], d[2], d[3], d[4]].every(Number.isFinite) && e.runner.root.visible && e.pos.distanceTo(player.pos) < 90;
    if (!valid) { if (s?.beam) { armFx.offBeam(s.beam); s.beam = null; } continue; }
    if (!s) { s = { seq: d[4], beam: null, mgT: 0, fresh: true }; peerFx.set(e.peer, s); }
    const to = new THREE.Vector3(d[1], d[2], d[3]), kind = d[0], burst = d[5] === 1, isNew = s.seq !== d[4] || s.fresh; s.fresh = false;
    if (Math.abs(to.x - e.pos.x) > 80 || Math.abs(to.z - e.pos.z) > 80) continue;
    if (kind !== 'laser' && s.beam) { armFx.offBeam(s.beam); s.beam = null; }
    if (burst) {
      if (kind === 'laser') { if (!s.beam) s.beam = armFx.beam(); const f = peerMuzzle(e, 'laser'); armFx.setBeam(s.beam, f, to, dt, true); }
      else if (kind === 'mg') { s.mgT -= dt; if (s.mgT <= 0) { s.mgT = 1 / W.mg.rate; visShot(e, 'mg', to); } }
    } else if (isNew && chk > 0) late.chargePeerShot?.(e, kind, to, chk, kind === 'bomb' || kind === 'hand' ? e.pos.clone().setY(e.pos.y + 1.5) : peerMuzzle(e, kind)); // 모아 쏜 센 샷 (#129)
    else if (isNew) { if (kind === 'bomb') { const f = peerMuzzle(e, 'bomb'); armFx.lob(f, lobVel(f, to, F.bomb), { vis: true, r: W.bomb.r }); } else visShot(e, kind, to); }
    s.seq = d[4];
  }
}
function visShot(e, kind, to) {
  const w = W[kind], f = peerMuzzle(e, kind), v = to.clone().sub(f), D = v.length(); if (D < 0.5) return;
  v.multiplyScalar(w.speed / D); if (w.spread) v.applyAxisAngle(THREE.Object3D.DEFAULT_UP, (Math.random() - 0.5) * 2 * w.spread);
  armFx.shoot(f, v, { vis: true, life: D / w.speed + 0.05 });
}

// ---------- 무기 고르기: 예전 창(#armwin)은 내 가방(#166, bag.js) 무기 탭으로 합침. 던지기 버튼 옆 ▾ 가 그 탭을 엶 ----------
const armMore = $('arm-more');
export const armSub = (w) => w.id === 'hand' ? '귤 던지기 · 무료' : w.dps ? `초당 ${w.dmg} · ${w.range}m` : w.r ? `${w.dmg} · 반경 ${w.r}m` : `${w.dmg} · ${w.range}m`;
export function openArmWin() { late.openBag?.('arm'); }
export function chooseArm(tier) {
  if (tier < 1 || tier > save.equip.weapon) return;
  stopLaser(); A.held = false;
  save.weaponUse = tier; persist(); setHoldBow(false); late.net?.send(true);
  updateArmBtn();
  late.sound?.beep?.(true);
}
// ▾ 는 손 말고 무기를 하나라도 가졌을 때만, 전투 오름에서만(무기가 있는 곳)
export function updateArmBtn() {
  const show = save.equip.weapon > 1;
  if (armMore.hidden === show) armMore.hidden = !show;
  late.bagRefresh?.('arm');
}
armMore.addEventListener('click', (e) => { e.stopPropagation(); openArmWin(); });
updateArmBtn();
export function armsChanged() { stopLaser(); A.held = false; A.cd = 0; A.mgB = null; late.chargeCancel?.(); setHoldBow(false); updateArmBtn(); }

export const armsTime = () => A.gt || 0;
Object.assign(late, { armsTime, fireArm, releaseBomb, tickArms, armsAmmo, openArmWin, armsChanged, armFx, chargedArm });
