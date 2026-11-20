// 연출 감독 연결 (#89): src/pacing.js 가 정한 차례대로 투기꾼·트럭·몹을 부르고, 긴장(tension 0~1)을 화면·소리·카메라에 옮긴다
// 힐링 시간이 바탕이고 공격 시간은 조짐 3초 → 짧은 공격 → 보상·쉼. 수치는 balance.js PACE (파일 순서는 src/modules.js, 규칙은 notes/prototype-v1.md)
import { PACE } from '../balance.js';
import { createPacing } from '../pacing.js';
import { DUMP_PER_HOUR } from '../dumpers.js';
import * as THREE from 'three';
import { height } from '../world.js';
import { state, late } from './state.js';
import { save, persist } from './save.js';
import { scene, renderer, spots, lampNight } from './scene.js';
import { life, NS_TUT, trash, player, hp, bloom, stream } from './place.js';
import { cam } from './camera.js';
import { toast, panelOpen, updateStats } from './hud.js';
import { sound, dumpers, enemyWarn, dumpWarn, gyulShower } from './hooks.js';

state.tension = 0; state.hitStop = 0; state.paceRare = 1;
// 저장: pace.first 첫 공격을 겪음, pace.bloomed 꽃을 한 번 피움. 예전 저장은 더미를 치운 적이 있으면 둘 다 된 것으로
if (!save.pace || typeof save.pace !== 'object') { const old = (save.ach?.life?.['heap-clear'] || 0) > 0; save.pace = { first: old ? 1 : 0, bloomed: old ? 1 : 0 }; }
const first = { done: !!save.pace.first, bloomed: !!save.pace.bloomed };
let loose = false; const cleared = new Map(); // 더미 번호 → 다 치운 시각(감독 시계) : PACE.protect 동안 투기꾼이 다시 쌓지 않음
const tutBusy = () => !!NS_TUT && !save.jeong && !save.tut?.done;

let cur = null; // 지금 공격: { dumpers: [투기꾼], mob: 몹 자리 계획 }
const threats = () => (dumpers ? dumpers.activeN() : 0) + life.enemies.activeN();
const pacing = createPacing({
  perHour: DUMP_PER_HOUR, first,
  hooks: {
    busy: () => !state.sessionOn || document.hidden || tutBusy() || !!state.fishing?.busy || !!state.fishing?.active || late.mealS?.on || late.cutS?.on || !!player.cart || panelOpen() || cam.mode !== 'follow' || hp.isDown || hp.pending || !!player.rescue,
    threats,
    omen(plan) {
      cur = { dumpers: [], mob: null };
      if (plan.mob) cur.mob = life.enemies.planWave(false, null, plan.group);
      if (plan.mob && !cur.mob && !plan.dumpers.length) plan.dumpers.push({ kind: 'walker', amt: pacing.test.dumpAmts().walker }); // 몹이 못 나오는 곳(들머리·다 핀 구역)이면 투기꾼이라도
      for (const d of plan.dumpers) {
        let o = dumpers?.come(d.kind, { amt: d.amt, hold: PACE.omen });
        if (!o && dumpers) { loose = true; o = dumpers.come(d.kind, { amt: d.amt, hold: PACE.omen }); loose = false; } // 빈 자리가 방금 치운 더미뿐이면 거기라도
        if (o) cur.dumpers.push(o);
      }
      if (!cur.mob && !cur.dumpers.length) { cur = null; return false; }
      // 방향 표시는 몹 자리(없으면 첫 투기꾼), 그 쪽에서 새들이 날아오름
      const at = cur.mob ? { x: cur.mob.x, z: cur.mob.z } : { x: cur.dumpers[0].pos.x, z: cur.dumpers[0].pos.z };
      (cur.mob ? enemyWarn : dumpWarn).start(at);
      if (bloom) { const dx = at.x - player.pos.x, dz = at.z - player.pos.z, L = Math.hypot(dx, dz) || 1, k = Math.min(1, 40 / L); bloom.flushUp(player.pos.x + dx * k, player.pos.z + dz * k); }
      sound.crow?.();
      return true;
    },
    attack(plan) {
      if (!cur) return false;
      let n = 0, eta = 0;
      if (cur.mob) { const w = life.enemies.spawnPlan(cur.mob); if (w) n += w.n; }
      for (const d of cur.dumpers) if (dumpers.list.includes(d)) { n++; eta = Math.max(eta, dumpers.routeLen(d) / d.def.speed); }
      if (plan.first && cur.dumpers[0]) toast('쓰레기를 버리러 누가 와요! 귤을 던져 쫓아내요');
      return n ? { n, eta } : false;
    },
    forceEnd() { life.enemies.leaveAll(); dumpers?.hurryAll(); },
    end(info) {
      cur = null;
      if (info.bonus > 0) { save.coins += info.bonus; persist(); updateStats(); gyulShower(info.bonus); }
      if (info.full) toast(`오름을 지켜 냈어요 · 귤 +${info.bonus}`);
      else if (info.bonus > 0) toast(`조용해졌어요 · 귤 +${info.bonus}`);
      // 숨 돌릴 틈: 새들이 다시 돌아와 둥글게 돎
      if (bloom) setTimeout(() => bloom.flock(player.pos.x, player.pos.z), 1500);
      setTimeout(() => sound.on && sound.bird?.(), 2200);
    },
    firstDone() { save.pace.first = 1; persist(); },
    delight,
  },
});
// 다 치운 더미 (pickup.js heap-clear, 내가 치운 것만)
function onCleared(h) { cleared.set(h, pacing.t); pacing.note('bloom'); if (!save.pace.bloomed) { save.pace.bloomed = 1; persist(); } }
// 투기꾼이 노릴 더미 무게: 방금 치운 더미는 0, 플레이어 가까운 더미(PACE.near)를 먼저
function heapW(i) {
  const at = cleared.get(i); if (!loose && at != null && pacing.t - at < PACE.protect) return 0;
  const h = trash?.heaps[i]; if (!h) return 1;
  return Math.hypot(h.x - player.pos.x, h.z - player.pos.z) < PACE.near ? 4 : 1;
}

// ---------- 지루할 때 작은 즐거움 ----------
const fxG = new THREE.Group(); scene.add(fxG);
let lucky = null, deerVisit = null, flies = null;
function nearestHeap(maxD) { let b = null, bd = maxD; trash?.heaps.forEach((h, i) => { if (!(trash.store.left(i) > 0)) return; const d = Math.hypot(h.x - player.pos.x, h.z - player.pos.z); if (d < bd) { bd = d; b = h; } }); return b; }
function delight(kind) {
  if (kind === 'lucky') { // 드문 쓰레기 반짝임: 가까운 더미 위 반짝이 + 잠깐 드문 것이 잘 나옴
    const h = nearestHeap(90); if (!h || lucky) return false;
    const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: '#ffe27a', transparent: true, depthWrite: false });
    for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), m); s.userData.a = i / 6 * 6.28; g.add(s); }
    g.position.set(h.x, height(h.x, h.z) + 1.2, h.z); fxG.add(g);
    lucky = { g, m, t: PACE.delight.luckyT, r: Math.max(1.2, h.r * 0.6) }; state.paceRare = PACE.delight.luckyMul;
    return true;
  }
  if (kind === 'deer') { // 노루가 지나감
    if (deerVisit || player.riding) return false;
    for (let k = 0; k < 8; k++) {
      const a = player.heading + (Math.random() - 0.5) * 2, r = 18 + Math.random() * 10, x = player.pos.x + Math.sin(a) * r, z = player.pos.z + Math.cos(a) * r;
      if (spots.inBounds && !spots.inBounds(x, z)) continue;
      if (life.remote) return late.deerNet.askVisit(x, z); // 멀티에서 방장이 아니면 방장에게 부탁해 모두에게 같이 보이게 (#92)
      deerVisit = { list: life.addDeer(x, z, 2), t: PACE.delight.deerT }; return true;
    }
    return false;
  }
  if (kind === 'fireflies') { // 반딧불이 떼 (어두울 때만)
    if (lampNight < 0.5 || flies) return false;
    const N = 28, pos = new Float32Array(N * 3), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: '#d8ff8a', size: 0.22, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; fxG.add(pts);
    flies = { pts, m, pos, seed: Array.from({ length: N }, () => [Math.random() * 6.28, 2 + Math.random() * 7, Math.random() * 6.28, 0.6 + Math.random() * 1.6]), t: PACE.delight.flyT };
    return true;
  }
  if (kind === 'jackpot') { // 잭팟 조짐: 개울 가까이면 다음 입질이 큰 것
    if (!stream || !state.fishing) return false;
    const [, lat] = stream.local(player.pos.x, player.pos.z), [x, z] = stream.at(stream.centerOff(lat), Math.max(-20, Math.min(20, lat)));
    if (Math.hypot(x - player.pos.x, z - player.pos.z) > 40) return false;
    state.fishing.test.jack(true); stream.ring?.(x, height(x, z), z); toast('개울에 커다란 그림자가 지나가요');
    return true;
  }
  return false;
}
function tickDelight(dt, now) {
  if (lucky) {
    lucky.t -= dt; const k = Math.min(1, lucky.t / 3);
    lucky.g.children.forEach((s, i) => { const a = s.userData.a + now * 1.4; s.position.set(Math.cos(a) * lucky.r, Math.sin(now * 3 + i) * 0.3, Math.sin(a) * lucky.r); s.scale.setScalar(0.6 + 0.6 * Math.abs(Math.sin(now * 4 + i * 1.7))); s.rotation.y = now * 3; });
    lucky.m.opacity = k;
    if (lucky.t <= 0) { fxG.remove(lucky.g); lucky.g.children.forEach((s) => s.geometry.dispose()); lucky.m.dispose(); lucky = null; state.paceRare = 1; }
  }
  if (deerVisit) { deerVisit.t -= dt; if (deerVisit.t <= 0) { deerVisit.list = life.removeDeer(deerVisit.list); if (!deerVisit.list.length) deerVisit = null; else deerVisit.t = 5; } }
  if (flies) {
    flies.t -= dt; const P = player.pos;
    flies.seed.forEach(([a, r, ph, sp], i) => { const u = a + now * sp * 0.25; const x = P.x + Math.cos(u) * r, z = P.z + Math.sin(u) * r; flies.pos[i * 3] = x; flies.pos[i * 3 + 1] = height(x, z) + 0.6 + Math.sin(now * sp + ph) * 0.5; flies.pos[i * 3 + 2] = z; });
    flies.pts.geometry.attributes.position.needsUpdate = true; flies.m.opacity = Math.min(1, flies.t / 4, (PACE.delight.flyT - flies.t) / 2) * (0.6 + 0.4 * Math.sin(now * 5));
    if (flies.t <= 0) { fxG.remove(flies.pts); flies.pts.geometry.dispose(); flies.m.dispose(); flies = null; }
  }
}

// ---------- 전환: 화면 가장자리 색·하늘·카메라·HP 막대 ----------
const edge = document.createElement('div'); edge.id = 'pace-edge'; edge.setAttribute('aria-hidden', 'true');
Object.assign(edge.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '4', opacity: '0', background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 58%, rgba(196,74,38,.55) 100%)' });
document.body.appendChild(edge);
const EXPO = renderer.toneMappingExposure;
let lastEdge = -1;
export function tickPace(dt, now) {
  if (!trash) return; // 남송이(쓰레기가 있는 맵)만
  pacing.update(dt);
  const k = pacing.tension; state.tension = k;
  const e = Math.round(k * PACE.edge * 100) / 100; if (e !== lastEdge) { lastEdge = e; edge.style.opacity = String(e); }
  renderer.toneMappingExposure = EXPO * (1 - PACE.sky * k);
  if (state.hitStop > 0) state.hitStop -= dt;
  tickDelight(dt, now);
}
// 맞혔을 때 짧은 멈춤·소리 (dumpers·enemies hooks.hit)
function onHit(pos, dead) { state.hitStop = PACE.hitStop; sound.thud?.(dead); }
export const pace = {
  note: (k) => pacing.note(k), cleared: onCleared, heapW, hit: onHit,
  canTip: () => pacing.canTip(), canJack: () => pacing.canJack(), canMark: () => pacing.canMark(),
  threat: () => pacing.phase === 'omen' || pacing.phase === 'tense',
  get phase() { return pacing.phase; }, get tension() { return pacing.tension; },
  pacing,
};
late.pace = pace;
