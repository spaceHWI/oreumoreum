// 투기꾼 퀘스트 보장 (#260): 투기꾼을 조건으로 하는 퀘스트·오늘의 할 일이 진행 중이면 길·들판에서 DUMPER_Q.questGap 초 안에 한 명이 나타남
// 수치는 balance.js DUMPER_Q. 매 프레임은 dumpers.update 를 감싸 돎 (smoker.js 와 같은 방식)
import { DUMPER_Q as Q, PACE } from '../balance.js';
import { state, late } from './state.js';
import { save } from './save.js';
import { spots } from './scene.js';
import { trash, player, hp } from './place.js';
import { cam } from './camera.js';
import { panelOpen } from './hud.js';
import { dumpers } from './hooks.js';
import { quests } from './quest.js';
import { STREET } from '../streetlayout.js';

const rnd = Math.random;
/* 남은 투기꾼 수: 진행 중(받았고 아직 안 채운) 퀘스트·오늘의 할 일 중 가장 많이 남은 것 */
export function dumperLeft() {
  let left = 0;
  try {
    for (const o of quests.list().on) { const k = o.q.ask?.k || ''; if ((k === 'dumper' || k.startsWith('dumper@')) && !o.ready) left = Math.max(left, o.n - o.p); }
    const d = late.ach?.ensureDaily?.(); if (d) for (const it of d.items) { const def = late.ach.defD(it.id); if (def?.ev === 'dumper-repel' && !it.done) left = Math.max(left, def.goal - it.prog); }
  } catch (e) { /* 셈은 게임을 멈추지 않음 */ }
  return left;
}
// 앞쪽 더미 하나와, 플레이어에서 ahead m 떨어진 시작점. 없으면 null
function spot() {
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), taken = new Set(dumpers.list.map((d) => d.heap)), A = Q.ahead;
  const pick = (hem, room) => {
    const c = [];
    trash.heaps.forEach((h, i) => {
      if (taken.has(i) || h.field || (room && !(h.n - trash.store.left(i) > 0))) return;
      const dx = h.x - player.pos.x, dz = h.z - player.pos.z, D = Math.hypot(dx, dz);
      if (D < A[1] + 6 || D > Q.farMax || (hem && (dx * fx + dz * fz) / D < Q.view)) return;
      const r = A[0] + rnd() * (A[1] - A[0]), x = player.pos.x + dx / D * r, z = player.pos.z + dz / D * r;
      if (spots.inBounds && !spots.inBounds(x, z)) return;
      c.push({ heap: i, start: [x, z], amt: room ? undefined : 0 });
    });
    return c.length ? c[Math.floor(rnd() * c.length)] : null;
  };
  const far = pick(true, true) || pick(false, true) || pick(true, false) || pick(false, false); if (far) return far; // 쌓을 자리(빈자리 있는 더미)가 없으면 양 0 으로 와서 그냥 서성임 (새 저장·다 찬 더미에서도 퀘스트가 막히지 않게)
  let b = null, bd = 1e9; // 먼 더미가 없으면 어느 더미든 (시작점은 돌담 바깥, dumpers.js 가 정함): 플레이어에서 ahead 평균에 가까운 것
  trash.heaps.forEach((h, i) => { if (taken.has(i)) return; const D = Math.abs(Math.hypot(h.x - player.pos.x, h.z - player.pos.z) - (A[0] + A[1]) / 2); if (D < bd) { bd = D; b = i; } });
  return b == null ? null : { heap: b, start: null, amt: trash.heaps[b].n - trash.store.left(b) > 0 ? undefined : 0 };
}
let t = 0, gap = Q.questGap, last = 0;
const ok = () => !!trash && !!dumpers && state.sessionOn && !document.hidden && !!save.tut?.done && !late.tut?.active && !state.cave && !state.cine && !panelOpen() && cam.mode === 'follow'
  && !hp.isDown && !hp.pending && !player.rescue && !player.cart && !state.fishing?.busy && !state.fishing?.active && !late.mealS?.on && !late.cutS?.on && !late.swarmArena?.zone?.()
  && !(STREET?.center && Math.hypot(player.pos.x - STREET.center.x, player.pos.z - STREET.center.z) < (STREET.radius || 30)); /* 가게 거리 밖 어디든(길·들판) */
function tick(dt) {
  if (!ok() || dumpers.list.length) { t = 0; return; } // 이미 와 있으면 그 사람부터
  if (!dumperLeft()) { t = 0; gap = Q.questGap; return; }
  if (late.pace?.threat?.()) return; // 연출 감독의 공격 중엔 겹치지 않음 (시계는 그대로)
  if ((t += dt) < gap) return;
  const s = spot(); if (!s) { t = gap - 10; return; }
  const d = dumpers.come('walker', { hold: PACE.omen, heap: s.heap, ...(s.start ? { start: s.start } : {}), ...(s.amt === 0 ? { amt: 0 } : {}) });
  if (d) { d.quest = true; last = Date.now(); t = 0; gap = Q.questGap; }
}
if (dumpers) {
  const u0 = dumpers.update; dumpers.update = (dt, time) => { u0(dt, time); tick(dt); };
  late.dumperQ = { why: () => ({ sess: state.sessionOn, tut: late.tut?.active, cave: state.cave, cine: state.cine, panel: panelOpen(), cam: cam.mode, down: hp.isDown, pend: hp.pending, resc: player.rescue, cart: player.cart, fb: state.fishing?.busy, fa: state.fishing?.active, meal: late.mealS?.on, cut: late.cutS?.on, sw: late.swarmArena?.zone?.() }), ok, left: dumperLeft, wait: () => +t.toFixed(1), gap: () => gap, last: () => last, spot, force: () => { t = gap; } };
  late.dumperQRepel = () => { if (dumperLeft() > 0) { gap = Q.repelGap; t = 0; } }; // 쫓아낸 뒤 조건이 남았으면 repelGap 초 뒤 다음 사람 (hooks.js repel)
}
