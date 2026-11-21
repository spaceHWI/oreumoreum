// 모아 쏘기 (#129): 던지기 버튼(F·상호작용 버튼)을 길게 눌렀다 놓으면 더 센 한 방. 수치는 balance.js CHARGE, 효과 src/chargefx.js
// - 손·활·총·폭탄: 누르는 동안 모으고 놓을 때 쏨. CHARGE.start 초 전에 놓으면 예전 한 발 그대로
// - 머신건·레이저: 누르는 동안 예전처럼 쏘면서 모으고, 놓는 순간 마무리(집중 연사·굵은 줄기, game/arms.js chargedArm)
// - 모으는 동안 이동 CHARGE.slow 배, 사거리 늘어남(throw.js fireR). 받히거나 탈것·노루·마차에 타면 풀림(그때는 예전처럼 누르면 바로·이어 쏨)
// - 귤: 손은 0 → cost 개, 무기는 한 발 몫 1 → cost 배 (모은 만큼). 모자라면 있는 만큼만 모임
// - 멀티: 모으는 동안 presence cg(모은 정도), 센 샷은 무기 사건 wf 7번째 칸(arms.js sendShot). 받는 쪽은 같은 빛·센 탄을 그림
import * as THREE from 'three';
import { CHARGE, WEAPONS, BOW } from '../balance.js';
import { createChargeFx } from '../chargefx.js';
import { LOW } from '../gfx2.js';
import { state, late } from './state.js';
import { save } from './save.js';
import { scene, camera } from './scene.js';
import { life, runner, player, hp } from './place.js';
import { busy, ui } from './hud.js';
import { weaponNow, bowArmed, aimTarget, setHoldBow, fireWeapon } from './throw.js';
import { holding, chargedArm, spend, units, holdAim } from './arms.js';
import { marker } from './input.js';

export const chargeFx = createChargeFx({ scene, LOW }); chargeFx.setCamera(camera);
const C = { on: false, t: 0, k: 0, w: null, dead: false, full: false, pin: false, shots: [] };
state.chargeShot = null; // 놓을 때 throw.js releaseTangerine·releaseArrow, arms.js releaseBomb 이 씀: { k, mul, size, rng }
state.shake = 0;
const span = CHARGE.full - CHARGE.start;
const SINGLE = new Set(['hand', 'bow', 'gun', 'bomb']);
const curW = () => (bowArmed() ? weaponNow() : WEAPONS[0]); // 무기 귤이 없거나 탈것 위면 손
export const chargeOk = () => !player.riding && !player.ride && !player.cart; // 모아 쏘기가 맡는 때
const able = () => chargeOk() && !player.knock && !busy() && !hp.isDown && !hp.pending;
const charging = () => C.on && !C.dead && C.t >= CHARGE.start && C.k > 0;
export const chargeOf = (k) => ({ k, mul: 1 + (CHARGE.dmg - 1) * k, size: 1 + (CHARGE.size - 1) * k, rng: 1 + (CHARGE.range - 1) * k });
let tmpRng = 1;
const chargeRange = () => (charging() ? 1 + (CHARGE.range - 1) * C.k : state.chargeShot?.rng || tmpRng);
const chargeSlow = () => (charging() ? CHARGE.slow : 1);
// 가진 것으로 모을 수 있는 정도 (0~1)
function maxK(w) {
  if (w.id === 'mg' || w.id === 'laser') return units(w) > 0 ? 1 : 0;
  const U = units(w);
  if (w.id === 'hand') return Math.min(1, U / CHARGE.cost);
  return U < 1 ? 0 : Math.min(1, (U - 1) / (CHARGE.cost - 1));
}

// 버튼을 누름 (stores.js throwAct.act). 탈것 위 등 모아 쏘기가 안 되면 예전처럼 바로 쏨
export function pressFire() {
  if (!able()) { fireWeapon(); return; }
  const w = curW();
  Object.assign(C, { on: true, t: 0, k: 0, w, dead: false, full: false, pin: false });
  if (w.id === 'mg' || w.id === 'laser') fireWeapon(); // 누르는 동안 예전처럼 쏨
}
export function chargeCancel() {
  if (!C.on) return;
  unpin(); C.dead = true; C.k = 0; endFx();
}
function unpin() {
  if (!C.pin) return; C.pin = false;
  if ((player.pose === 'throw' && !state.throwPending) || (player.pose === 'bow' && !state.bowPending)) player.pose = 'move';
}
function endFx() { chargeFx.endGlow(0); late.sound?.chargeHum?.(null); ring(0); }

// 모으는 자세: 손·폭탄은 팔을 뒤로 젖힌 채, 활은 당긴 채, 총은 겨눈 채 멈춤
const PIN = { throw: 0.3, bow: BOW.release - 0.06 };
function pin(w) {
  const t = aimTarget() || state.lock;
  player.target = null; player.onArrive = null; marker.visible = false; state.emo?.stop();
  if (w.id === 'hand' || w.id === 'bomb') {
    if (w.id === 'bomb') setHoldBow(true);
    if (player.pose === 'move' || (C.pin && player.pose === 'throw')) { player.pose = 'throw'; player.poseT = PIN.throw; state.throwPending = false; C.pin = true; }
  } else if (w.id === 'bow') {
    setHoldBow(true);
    if (player.pose === 'move' || (C.pin && player.pose === 'bow')) { player.pose = 'bow'; player.poseT = PIN.bow; state.bowPending = false; C.pin = true; }
  } else holdAim(t);
  state.throwAim = t || null; // 모으는 동안 타겟 쪽을 봄 (update.js)
}
// 손 자리 (빛이 모이는 곳)
const hv = new THREE.Vector3();
function handPos(rn, pos, heading, w) {
  const parts = rn.root.userData.parts, arm = w === 'hand' || w === 'bomb' ? parts?.armR : parts?.armL;
  if (arm) { rn.root.updateMatrixWorld(true); const h = arm.localToWorld(hv.set(0, -0.55, 0.05)); if (isFinite(h.x + h.y + h.z)) return h; }
  return hv.set(pos.x + Math.sin(heading) * 0.6, pos.y + 1.4, pos.z + Math.cos(heading) * 0.6);
}

// 놓음
function release() {
  const w = C.w, k = C.k, ok = C.t >= CHARGE.start && k > 0;
  C.on = false; endFx();
  if (!ok) { unpin(); if (SINGLE.has(w.id)) fireWeapon(); return; } // 짧게: 예전 한 발 (머신건·레이저는 이미 쏘는 중)
  fireCharged(w, k);
}
// 모은 한 방 (확인용 __oreum.charge.shoot(k) 도 씀)
export function fireCharged(w, k) {
  const ch = chargeOf(k);
  tmpRng = ch.rng;
  const t = aimTarget() || state.lock;
  if (w.id === 'mg' || w.id === 'laser') { chargedArm(w, ch); tmpRng = 1; return true; }
  if (!spend(w, w.id === 'hand' ? CHARGE.cost * k : 1 + (CHARGE.cost - 1) * k)) { tmpRng = 1; unpin(); fireWeapon(); return false; }
  C.shots.push({ w: w.id, k: +k.toFixed(2) }); if (C.shots.length > 20) C.shots.shift();
  player.target = null; player.onArrive = null; marker.visible = false; state.emo?.stop();
  if (w.id === 'hand') {
    state.chargeShot = ch; state.throwAim = t;
    if (!(C.pin && player.pose === 'throw')) { player.pose = 'throw'; player.poseT = PIN.throw; }
    state.throwPending = true; late.sound?.chargeShot?.(k);
  } else if (w.id === 'bow') {
    setHoldBow(true); state.chargeShot = ch; state.throwAim = t;
    if (!(C.pin && player.pose === 'bow')) { player.pose = 'bow'; player.poseT = PIN.bow; }
    state.bowPending = true; late.sound?.chargeShot?.(k);
  } else chargedArm(w, ch);
  C.pin = false; tmpRng = 1;
  return true;
}

// 쏜 센 탄: 따라가는 빛, 다른 사람에게 사건 (총·폭탄은 arms.js 가 보냄)
const tp = new THREE.Vector3();
function chargeLaunch(ch, kind, pos, alive, t) {
  chargeFx.follow(pos, ch.k, alive);
  if (kind === 'hand' || kind === 'bow') {
    if (t) tp.set(t.pos.x, t.pos.y + (t.h || 0.8), t.pos.z); else tp.set(player.pos.x + Math.sin(player.heading) * 20, player.pos.y + 1, player.pos.z + Math.cos(player.heading) * 20);
    late.armsSend?.(kind, tp, ch.k);
  }
}
// 다른 사람의 센 샷 (보이기만)
function chargePeerShot(e, kind, to, k, from) {
  const sp = { hand: 22, bow: 40, gun: 60, mg: 60, laser: 80, bomb: 16 }[kind] || 30;
  if (kind === 'laser') { chargeFx.burst(to, k); return; }
  chargeFx.orb(from, to, k, sp, kind === 'bomb' ? () => late.armFx?.boom(to, (WEAPONS[5].r || 6) * (1 + (CHARGE.bombR - 1) * k)) : null);
}
// 맞음 (enemies.js hurt): 모은 만큼 더 밀리고(enemies.js), 가득 모았으면 터지는 빛·즙·화면 흔들림
let lastBurst = 0;
const hp3 = new THREE.Vector3();
life.hooks.chargeHit = (pos, k, e) => {
  const now = performance.now(); if (now - lastBurst < 120) return; // 머신건 연사가 잇달아 터지지 않게
  if (k < 0.3) return;
  lastBurst = now;
  hp3.set(pos.x, pos.y + (e?.h || 0.8), pos.z);
  chargeFx.burst(hp3, k);
  if (k >= 0.999) {
    const n = LOW ? 1 : CHARGE.burst; for (let i = 0; i < n; i++) life.juiceSplash(hp3, null);
    state.shake = Math.max(state.shake, CHARGE.shakeT);
  }
};

// 버튼 둘레 고리
const ringEl = document.createElement('i'); ringEl.className = 'chg'; ringEl.setAttribute('aria-hidden', 'true'); ringEl.hidden = true; ui.ctx.appendChild(ringEl);
let ringK = -1;
function ring(k, full = false) {
  const v = Math.round(k * 40) / 40; if (v === ringK && ringEl.classList.contains('full') === full) return; ringK = v;
  ringEl.hidden = v <= 0; ringEl.style.setProperty('--k', String(v)); ringEl.classList.toggle('full', full);
}

// 매 프레임 (update.js, tickArms 앞)
function tickCharge(dt) {
  if (C.on) {
    const h = holding();
    if (C.dead) { if (!h) C.on = false; }
    else if (!able() || curW().id !== C.w.id) chargeCancel(); // 받힘·탈것·창 열림·무기 바뀜
    else {
      C.t += dt;
      const kMax = maxK(C.w), raw = Math.max(0, Math.min(1, (C.t - CHARGE.start) / span));
      C.k = Math.min(kMax, raw);
      if (charging()) {
        pin(C.w);
        const full = C.k > 0 && C.k >= kMax - 1e-6; // 가득 (귤이 모자라면 모일 수 있는 데까지)
        if (full && !C.full) late.sound?.chargeFull?.();
        C.full = full;
        chargeFx.glow(0, handPos(runner, player.pos, player.heading, C.w.id), C.k, dt, full);
        late.sound?.chargeHum?.(C.k); ring(C.k, full);
      }
      if (!h) release();
    }
  }
  // 다른 사람이 모으는 빛
  const net = late.net;
  if (net?.peersById && !net.solo) for (const e of net.peersById.values()) {
    const k = e.data?.cg;
    if (!(Number.isFinite(k) && k > 0) || !e.runner.root.visible || e.pos.distanceTo(player.pos) > 60) continue;
    const pose = e.data.pose; if (PIN[pose] != null) e.poseT = PIN[pose];
    const w = pose === 'throw' ? 'hand' : 'bow';
    chargeFx.glow(e.peer, handPos(e.runner, e.pos, e.heading, w), Math.min(1, k), dt, k >= 1);
  }
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt);
  chargeFx.update(dt);
}
export const chargePresence = () => (charging() ? { cg: Math.round(C.k * 10) / 10 } : {});
export const chargeState = () => ({ on: C.on, dead: C.dead, t: +C.t.toFixed(2), k: +C.k.toFixed(2), w: C.w?.id || null, full: C.full, pin: C.pin, slow: chargeSlow(), rng: chargeRange(), shots: C.shots.slice() });
Object.assign(late, { pressFire, chargeOk, chargeCancel, chargeRange, chargeSlow, chargeLaunch, chargePeerShot, tickCharge, chargePresence, chargeFx, charge: { state: chargeState, shoot: (k = 1, id) => fireCharged(id ? WEAPONS.find((w) => w.id === id) : curW(), k), fx: chargeFx, of: chargeOf } });
