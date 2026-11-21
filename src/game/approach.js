// 다가가서 쏘기 (#132): 던지기 버튼(F·상호작용 버튼)을 누르면 감지 거리(APPROACH.detect) 안 적을 잡아, 사거리 밖이면 스스로 다가가고 닿으면 쏜다.
// 쫓아내면 다음 적으로 이어 가고, 근처에 적이 없으면 멈춘다. 적이 아예 없을 때 누르면 예전처럼 앞으로 던짐 (켜지지 않음)
// - 고르는 순서: 나를 쫓는 적 > 투기꾼·트럭·흡연자 > 가까운 순. 손일 때 손으로 못 잡는 적(APPROACH.handHard)은 뒤로, 그것뿐이면 '무기가 필요해요'
// - 멈춤: 직접 움직임(방향키·조이스틱·땅 누르기), 줍기 버튼(pickup.js pressPick), 쓰러짐·창·탈것·튜토리얼, 무기 귤이 떨어짐(알림), 길이 막혀 가까워지지 않음
// - 기운이 APPROACH.lowHp 아래면 다가가지 않고 제자리에서만 쏨. 누르고 있는 동안(모아 쏘기 #129)은 다가가지도 쏘지도 않고, 놓으면 charge.js 가 쏨
// - 타겟 고정·표시는 throw.js(#148) 그대로. 켜져 있는 동안 throw.js 가 잡아 두는 거리를 detect 로 늘림 (late.approachR)
// - 길 찾기는 줍기와 같은 late.trailRoute(돌담·물·비탈)
import * as THREE from 'three';
import { APPROACH } from '../balance.js';
import { groundAt } from '../world.js';
import { state, late } from './state.js';
import { life, player, hp } from './place.js';
import { toast, busy } from './hud.js';
import { keys, joy, marker, setTarget } from './input.js';
import { refreshLock, fireR, setLock, fireWeapon, bowArmed, bowReady, armedFor, weaponNow } from './throw.js';
import { holding } from './arms.js';
import { stopSeek } from './pickup.js';

const AP = { on: false, t: null, route: null, i: 0, cur: null, goal: null, routeT: 0, fireT: 0, best: Infinity, bestT: 0, shots: 0, repelled: 0, why: '' };
const flat = (t) => Math.hypot(t.pos.x - player.pos.x, t.pos.z - player.pos.z);
const alive = (t) => !!t && (!t.ok || t.ok());
const hard = (t) => !bowArmed() && APPROACH.handHard.includes(t.kind);
const rank = (t) => (t.chase ? 0 : !t.enemy ? 1 : 2); // 쫓는 적 > 투기꾼·트럭·흡연자 > 나머지
const can = () => state.sessionOn !== false && !late.tut?.active && !busy() && !hp.isDown && !hp.pending && !player.riding && !player.ride && !player.cart;
const lowHp = () => hp.hp < hp.max * APPROACH.lowHp;
const moving = () => (joy.active && Math.hypot(joy.x, joy.y) > 0.15) || ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].some((k) => keys.has(k));

// 감지 거리 안 다음 타겟. { t, onlyHard }
function pickNext() {
  let best = null, bs = Infinity, any = false;
  for (const t of life.aimTargets()) {
    if (t.kind === 'hareubang' || t.kind === 'target' || !alive(t)) continue;
    const d = flat(t); if (d >= APPROACH.detect) continue;
    any = true;
    const sc = (hard(t) ? 1e7 : 0) + rank(t) * 1e5 + d;
    if (sc < bs) { bs = sc; best = t; }
  }
  return { t: best, onlyHard: any && !!best && hard(best) };
}
function walkStop() {
  if (AP.cur && player.target === AP.cur) { player.target = null; player.onArrive = null; marker.visible = false; }
  AP.cur = null; AP.route = null; AP.goal = null;
}
export function stopApproach(why = 'stop') {
  if (!AP.on) return; AP.on = false; AP.why = why; walkStop(); AP.t = null;
}
function take(t) { AP.t = t; state.lock = t; state.lockPick = false; setLock(t); state.lockPick = false; AP.best = flat(t); AP.bestT = 0; }
// 다음 적으로. 없으면 멈춤 → false
function next() {
  const n = pickNext();
  if (!n.t) { stopApproach('none'); return false; }
  if (n.onlyHard) { toast('무기가 필요해요'); stopApproach('hard'); return false; }
  take(n.t); return true;
}
// 버튼을 누른 순간 (stores.js throwAct.act, pressFire 앞). 켜면 true. 누른 것 자체는 그대로 charge.js 가 받음(짧게 놓으면 여기서 쏨)
export function approachPress() {
  if (AP.on) return true;
  if (!can() || moving()) return false; // 움직이면서 누르면 예전처럼 그 자리에서 던짐
  refreshLock(true);
  let t = state.lock && state.lock.kind !== 'hareubang' && alive(state.lock) && flat(state.lock) < APPROACH.detect ? state.lock : null;
  if (t && hard(t)) { const n = pickNext(); if (n.t && !n.onlyHard) t = n.t; }
  if (!t) { const n = pickNext(); if (!n.t) return false; t = n.t; }
  if (hard(t)) { toast('무기가 필요해요'); return false; }
  if (bowReady() && !armedFor(weaponNow())) return false; // 귤이 없어요 (버튼 글자)
  AP.on = true; AP.shots = 0; AP.repelled = 0; AP.why = ''; AP.fireT = 0; take(t);
  return true;
}
// 서 있을 자리: 적에서 나 쪽으로 사거리 × stand
function standAt(t) {
  const a = Math.atan2(player.pos.x - t.pos.x, player.pos.z - t.pos.z), r = fireR() * APPROACH.stand;
  return { x: t.pos.x + Math.sin(a) * r, z: t.pos.z + Math.cos(a) * r };
}
function walkTo(t) {
  const to = standAt(t);
  const r = late.trailRoute ? late.trailRoute(player.pos, to) : [to];
  AP.route = r.map((q) => new THREE.Vector3(q.x, groundAt(q.x, q.z), q.z)); AP.i = 0; AP.goal = { x: t.pos.x, z: t.pos.z }; AP.routeT = 0;
  stopSeek(); late.stopAutoGo?.();
  wp();
}
function wp() { setTarget(AP.route[AP.i], null); marker.visible = false; AP.cur = player.target; }

// 매 프레임 (update.js, tickArms 뒤)
export function tickApproach(dt) {
  if (!AP.on) return;
  if (!can()) { stopApproach('busy'); return; }
  if (moving() || (player.target && player.target !== AP.cur)) { stopApproach('move'); return; } // 직접 움직이면 바로 풀림
  if (bowReady() && !armedFor(weaponNow())) { toast('귤이 떨어졌어요'); stopApproach('empty'); return; }
  // 타겟: 쫓아냈거나 사라졌으면 다음. 화면 누르기·Tab 으로 바꾼 것·쫓아오는 적으로 바뀐 것은 따름
  if (!alive(AP.t) || !life.aimTargets().includes(AP.t)) { AP.repelled++; if (!next()) return; }
  refreshLock();
  if (state.lock && state.lock !== AP.t && state.lock.kind !== 'hareubang') { AP.t = state.lock; AP.best = flat(AP.t); AP.bestT = 0; walkStop(); }
  else if (!state.lock) take(AP.t);
  if (hard(AP.t)) { const n = pickNext(); if (n.t && !n.onlyHard) take(n.t); else { toast('무기가 필요해요'); stopApproach('hard'); return; } }
  const t = AP.t, d = flat(t);
  if (d >= APPROACH.detect + 6) { if (!next()) return; }
  if (holding()) { walkStop(); return; } // 모으는 동안은 그대로 (놓으면 charge.js 가 타겟에게 쏨)
  AP.fireT = Math.max(0, AP.fireT - dt);
  if (d < fireR()) { // 닿음: 서서 쏨
    walkStop(); AP.bestT = 0; AP.best = d;
    if (AP.fireT <= 0 && player.pose !== 'throw' && player.pose !== 'bow' && !player.knock && (late.armReady?.() ?? true)) { fireWeapon(); AP.shots++; AP.fireT = APPROACH.gap; }
    return;
  }
  if (lowHp()) { // 기운이 낮으면 제자리에서만 (사거리 밖이어도 그쪽으로 던져 휨 #148)
    walkStop();
    if (AP.fireT <= 0 && player.pose !== 'throw' && player.pose !== 'bow' && !player.knock && (late.armReady?.() ?? true)) { fireWeapon(); AP.shots++; AP.fireT = APPROACH.gap; }
    return;
  }
  // 다가감: 길이 없거나 적이 많이 움직였으면 다시 찾음
  AP.routeT += dt;
  if (!AP.route || (AP.routeT > APPROACH.reroute && Math.hypot(t.pos.x - AP.goal.x, t.pos.z - AP.goal.z) > APPROACH.moved)) walkTo(t);
  else if (player.target !== AP.cur || !AP.cur) walkTo(t);
  else { const last = AP.i === AP.route.length - 1, dc = Math.hypot(AP.cur.x - player.pos.x, AP.cur.z - player.pos.z); if (!last && dc < 2.4) { AP.i++; wp(); } else if (last && dc < 0.6) walkTo(t); }
  // 막힘: stuckT 초 동안 1m 도 가까워지지 않으면 멈춤
  if (d < AP.best - 1) { AP.best = d; AP.bestT = 0; } else if ((AP.bestT += dt) > APPROACH.stuckT) { toast('길이 막혀 다가갈 수 없어요'); stopApproach('stuck'); }
}
export const approachOn = () => AP.on;
export const approachState = () => ({ on: AP.on, kind: AP.t?.kind || null, d: AP.t ? +flat(AP.t).toFixed(1) : null, walking: !!AP.cur, shots: AP.shots, repelled: AP.repelled, why: AP.why });
Object.assign(late, { approachPress, approachOn, stopApproach, tickApproach, approachR: () => (AP.on ? APPROACH.detect + 6 : 0), approach: { state: approachState, press: approachPress, stop: stopApproach, next: pickNext } });
