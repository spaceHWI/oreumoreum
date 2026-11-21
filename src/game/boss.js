// 구역 우두머리·구역 완료 (#139, notes/growth-loop.md 2절·7-1절). 수치는 balance.js ZONE_BOSS
// - 구역이 ZONE_BOSS.appear(80%) 깨끗해지고 최근(ZONE_GUARD.holdSec 안)에 쫓아낸 적이 없으면, 그 구역 우두머리 빈터(field.bosses)에 우두머리가 나옴
//   모양은 그 구역 적(enemies.js spawnBoss)을 키우고 색을 곱하고 머리 위 왕관·발밑 빛 고리. 빈터 가까이 오면 싸움 시작(화면 위 이름·기운 줄)
// - 패턴: 기운 50%·20% 에서 단계가 바뀜(포효). 돌진(바닥 띠 경고 → 달림) · 무리 부르기(그 구역 적) · 광선(바닥 원 경고 → 하늘 빛 기둥). 경고를 보고 피할 수 있음
//   여럿이면 기운이 사람 수에 맞춰 늚. 쓰러지면 마지막으로 지난 구역 클린하우스에서 깨어남(hp.js startAt → late.wakeAt), 우두머리는 빈터로 돌아가 기운을 채움
// - 쫓아내면: 느린 화면 + 큰 전리품(귤 + 귀한 재료 자리 save.boss.mats, #140 강화가 씀) → 돌하르방(guard.js raise) → 구역 완료 요약 한 장
// - 구역 완료(save.boss.done)로 열리는 것: 그 구역 클린하우스 옆 '빠른 마차'(가게 거리까지 기다림 없이), 구역 들어오는 곳 옆 '지름길'(구역 위쪽 끝으로), 요약에 다음 구역 권장 점수
//   (빠른 마차·지름길은 지금은 화면이 어두워졌다 밝아지는 임시 연출. 길·마차 모양은 나중에)
// - 멀티: 방장이 굴림. {t:'bs'} 로 자리·기운·패턴을 알리고, 받는 쪽은 그대로 보이고(puppet) 맞힌 피해를 {t:'bh'} 로 방장에게. 경고·맞음은 각자 화면에서 제 캐릭터만 셈
//   쫓아내면 방장이 {t:'bs', done, f: 싸움에 낀 사람} 과 {t:'bd'}(방이 돌하르방을 세워 zg 로 알림). 보상은 낀 사람 모두에게. 부하 적은 각자 화면(적은 지금도 각자)
// 구역 완료 요약·깨어나는 곳·다시 들어올 때·빠른 마차·지름길·저장(save.boss)은 zonedone.js
// (파일 순서는 src/modules.js: zonedone 뒤)
import * as THREE from 'three';
import { ZONE_BOSS as B, ZONE_GUARD, ENEMIES, ENEMY_SPAWN, BOAR, COLLIDE } from '../balance.js';
import { gradHard } from '../toon.js';
import { gearScore } from '../gearscore.js';
import { tierColor, zoneShort, josaIGa, josaEulReul } from '../zonelook.js';
import { height } from '../world.js';
import { state, late } from './state.js';
import { $, save, persist } from './save.js';
import { scene, quality } from './scene.js';
import { enemyWarn } from './hooks.js';
import { trash, bfx, player, life, hp } from './place.js';
import { toast, panelOpen } from './hud.js';
import { interactables } from './stores.js';
import { field } from './field.js';
import { S, ON, isDone, logOf, openSummary, chSpot, fastSpot, cutSpot, warp, tickZoneDone, zoneDoneTest } from './zonedone.js';

const ARENA = new Map(); for (const b of field?.bosses || []) ARENA.set(b.zone, b);
const name = (z) => B.list[z]?.name || '우두머리';
const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
const lite = () => quality.level === 0;
const nowS = () => performance.now() / 1000;
const netBeat = {}; // 방에서 들은 쫓아낸 시각 (구역 → 기기 ms)
const beatAt = (z) => Math.max(Number(S.beat[z]) || 0, netBeat[z] || 0);
const recent = (z) => Date.now() - beatAt(z) < ZONE_GUARD.holdSec * 1000;


/* ---------- 모양: 왕관·발밑 고리·경고 띠·경고 원·빛 기둥 ---------- */
const crownGeo = (() => {
  const band = new THREE.CylinderGeometry(0.34, 0.3, 0.2, 10, 1, true);
  const parts = [band]; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, c = new THREE.ConeGeometry(0.08, 0.26, 5).translate(Math.sin(a) * 0.31, 0.22, Math.cos(a) * 0.31); parts.push(c); }
  const g = new THREE.BufferGeometry(); const pos = [], nor = [];
  for (const p of parts) { const q = p.toNonIndexed(); pos.push(...q.attributes.position.array); nor.push(...q.attributes.normal.array); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return g;
})();
const crownMat = new THREE.MeshToonMaterial({ color: '#ffcf3a', emissive: '#a86a00', emissiveIntensity: 0.55, gradientMap: gradHard, side: THREE.DoubleSide });
const addMat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
const warnMat = (o) => new THREE.MeshBasicMaterial({ color: '#ff3b24', transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide, fog: false });
const crown = new THREE.Mesh(crownGeo, crownMat); crown.visible = false; scene.add(crown);
const aura = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 32).rotateX(-Math.PI / 2), addMat('#ffb040', 0.5)); aura.visible = false; aura.renderOrder = 3; scene.add(aura);
// 땅을 따라 덮는 띠 (돌진 경고): 세로 N 칸, 매번 정점 높이를 땅에 맞춤
const STRIP_N = 16;
const strip = (() => {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((STRIP_N + 1) * 2 * 3), 3));
  const idx = []; for (let i = 0; i < STRIP_N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
  const m = new THREE.Mesh(g, warnMat(0.32)); m.visible = false; m.frustumCulled = false; m.renderOrder = 3; scene.add(m); return m;
})();
function layStrip(ax, az, bx, bz, w) {
  const p = strip.geometry.attributes.position, L = Math.hypot(bx - ax, bz - az) || 1, ux = (bx - ax) / L, uz = (bz - az) / L, sx = -uz * w / 2, sz = ux * w / 2;
  for (let i = 0; i <= STRIP_N; i++) { const t = i / STRIP_N, cx = ax + (bx - ax) * t, cz = az + (bz - az) * t;
    for (const [j, s] of [[0, 1], [1, -1]]) { const x = cx + sx * s, z = cz + sz * s; p.setXYZ(i * 2 + j, x, height(x, z) + 0.12, z); } }
  p.needsUpdate = true; strip.geometry.computeBoundingSphere(); strip.visible = true;
}
// 땅을 따라 덮는 원 (광선 경고) 셋
const DISC_N = 20;
const discs = [0, 1, 2].map(() => {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((DISC_N + 1) * 3), 3));
  const idx = []; for (let i = 0; i < DISC_N; i++) idx.push(0, i + 1, ((i + 1) % DISC_N) + 1); g.setIndex(idx);
  const m = new THREE.Mesh(g, warnMat(0.3)); m.visible = false; m.frustumCulled = false; m.renderOrder = 3; scene.add(m); return m;
});
function layDisc(m, x, z, r) {
  const p = m.geometry.attributes.position; p.setXYZ(0, x, height(x, z) + 0.14, z);
  for (let i = 0; i < DISC_N; i++) { const a = i / DISC_N * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; p.setXYZ(i + 1, px, height(px, pz) + 0.14, pz); }
  p.needsUpdate = true; m.geometry.computeBoundingSphere(); m.visible = true;
}
const beamGeo = new THREE.CylinderGeometry(1, 1, 30, 14, 1, true).translate(0, 15, 0);
const beams = [0, 1, 2].map(() => { const m = new THREE.Mesh(beamGeo, addMat('#fff2c0', 0)); m.visible = false; m.frustumCulled = false; m.renderOrder = 4; scene.add(m); return { m, t: -1 }; });

// 우두머리 색: 모양의 재질을 복제해 tint 를 곱함 (받은 모델로 재질이 바뀌면 다시)
function tintBoss(e, color) {
  const c = new THREE.Color(color);
  e.root.traverse((o) => {
    if (!o.isMesh || !o.material || o.material.userData?.bossTint || Array.isArray(o.material)) return;
    const src = o.material, m = src.clone(); m.onBeforeCompile = src.onBeforeCompile; if (src.customProgramCacheKey) m.customProgramCacheKey = src.customProgramCacheKey;
    if (m.color) m.color.multiply(c); if (m.emissive) m.emissive.multiply(c); m.userData.bossTint = true; o.material = m;
  });
}

/* ---------- 지금 우두머리 ---------- */
// cur = { z, e, base(1명 기운), max, ph, fight, n(싸우는 사람), act, seq, gapT, callT, beamT, minions, fighters: Map(id → ms), hitByMe, puppet, net:{x,z,h} }
let cur = null, seqN = 0;
let room = null, live = false;
const myId = () => (live && room?.id) || 'me';
const isHost = () => !live || !!room?.isHost;

// 싸울 수 있는 사람들: 나(쓰러지지 않았고 튜토리얼 밖) + 방장이면 다른 사람
function people() {
  const out = [];
  if (state.sessionOn && !late.tut?.active && !hp.isDown && !hp.pending) out.push({ id: myId(), x: player.pos.x, z: player.pos.z, me: true });
  if (live && room?.isHost) for (const [id, e] of late.net?.peersById || []) if (e?.pos) out.push({ id, x: e.pos.x, z: e.pos.z });
  return out;
}
const distA = (z, p) => { const a = ARENA.get(z); return a ? Math.hypot(p.x - a.x, p.z - a.z) : 1e9; };

function canSpawn(z) {
  if (!ON || !ARENA.has(z) || !B.list[z] || !state.sessionOn || late.tut?.active || !save.tut?.done) return false;
  return trash.zoneClean(z) >= B.appear - 1e-9 && !recent(z);
}
function spawn(z, puppet = false, at = null) {
  const a = ARENA.get(z), D = B.list[z]; if (!a || !D) return null;
  const x = at ? at.x : a.x, zz = at ? at.z : a.z;
  const e = life.enemies.spawnBoss(D.kind, x, zz, { ...D, ctl: puppet ? puppetCtl : aiCtl, remoteHurt: puppet ? sendHit : null, puppet });
  e.heading = Math.atan2(player.pos.x - x, player.pos.z - zz);
  tintBoss(e, D.tint);
  cur = { z, e, base: D.hp, max: D.hp, ph: 0, fight: false, n: 1, act: null, seq: -1, gapT: 1.5, callT: 4, beamT: 2, minions: [], fighters: new Map(), hitByMe: false, puppet, net: null, tintT: 0, sendT: 0, roarT: 0, bornT: nowS() };
  crown.visible = aura.visible = true; aura.material.color.set(tierColor(z));
  if (!puppet) { // 나타남: 흙먼지·포효·방향 표시
    if (bfx && Math.hypot(x - player.pos.x, zz - player.pos.z) < 160) { bfx.ring(x, zz, 7, 1.0, '#e9d2a6', 0, 1.4); bfx.burst(x, height(x, zz) + 0.3, zz, { petals: lite() ? 10 : 40, sparks: 0, up: 3, spread: 2, color: '#b8a07c' }); }
    late.sound?.boar?.();
  }
  if (Math.hypot(x - player.pos.x, zz - player.pos.z) < B.near + 10) toast(`${zoneShort(z)} 우두머리 '${name(z)}'${josaIGa(name(z))} 빈터에 나타났어요!`, 3.2);
  enemyWarn.start({ x, z: zz });
  return cur;
}
function despawn(quiet = true) {
  if (!cur) return;
  const e = cur.e; if (life.enemies.list.includes(e) && e.state === 'boss') life.enemies.remove(e);
  if (!quiet) toast(`${name(cur.z)}${josaIGa(name(cur.z))} 숲으로 돌아갔어요`);
  endAct(); cur = null; crown.visible = aura.visible = false; bar(false);
}

/* ---------- 패턴 ---------- */
function startAct(k, o, warnLeft = null) {
  endAct();
  const c = cur; if (!c) return;
  const A = { k, t: 0, hit: false, seq: o.seq ?? ++seqN, ...o };
  if (k === 'charge') {
    A.warn = warnLeft ?? B.charge.warn; A.dir = Math.atan2(o.bx - o.ax, o.bz - o.az); A.len = Math.hypot(o.bx - o.ax, o.bz - o.az);
    const bd = ENEMIES[B.list[c.z].kind]; A.speed = (bd.rush ?? bd.chase) * B.charge.speed; A.dashT = A.len / A.speed; // #149: 졸개 chase 를 낮춰도 우두머리 돌진은 그대로 (rush)
    layStrip(o.ax, o.az, o.bx, o.bz, B.charge.w);
  } else if (k === 'beam') {
    A.warn = warnLeft ?? B.beam.warn; A.pts.forEach((p, i) => { if (discs[i]) layDisc(discs[i], p[0], p[1], B.beam.r); });
  } else if (k === 'call') {
    A.warn = 0; roar(c, false);
    if (Math.hypot(c.e.pos.x - player.pos.x, c.e.pos.z - player.pos.z) < B.leash + 10) callMinions(c);
  }
  c.act = A; c.seq = A.seq;
  if (!c.puppet) sendState(true);
}
function endAct() { strip.visible = false; discs.forEach((m) => { m.visible = false; }); if (cur) cur.act = null; }
function callMinions(c) {
  const D = B.list[c.z], kind = ENEMY_SPAWN.byZone[c.z] || D.kind; c.minions = c.minions.filter((m) => life.enemies.list.includes(m) && m.state !== 'flee' && m.state !== 'leave');
  if (c.minions.length >= B.call.max) return;
  const before = new Set(life.enemies.list), [a, b] = B.call.n, n = Math.min(B.call.max - c.minions.length, a + Math.floor(Math.random() * (b - a + 1)));
  life.enemies.spawnPlan({ kind, n, x: c.e.pos.x, z: c.e.pos.z, zone: c.z, forceKind: true }, true);
  const got = life.enemies.list.filter((m) => !before.has(m)); got.forEach((m) => { m.state = 'charge'; m.st = 0; }); c.minions.push(...got);
  if (got.length) toast(`${name(c.z)}${josaIGa(name(c.z))} 무리를 불렀어요!`, 2.2);
}
function roar(c, phase) {
  late.sound?.boar?.(); c.roarT = 0.6;
  const el = $('boss-bar'); el.classList.remove('roar'); void el.offsetWidth; el.classList.add('roar');
  if (phase) toast(c.ph === 1 ? `${name(c.z)}${josaIGa(name(c.z))} 화가 났어요! 무리를 불러요` : `${name(c.z)}${josaIGa(name(c.z))} 몹시 화가 났어요! 바닥의 빨간 원을 피해요`, 2.8);
  if (bfx && !lite()) bfx.ring(c.e.pos.x, c.e.pos.z, 5, 0.6, '#ff8a5a', 0, 1.2);
}
// 내 캐릭터가 맞았나 (각자 화면에서 제 캐릭터만)
function hurtMe(dir, dmgK) {
  const D = B.list[cur.z]; if (!D) return;
  life.hooks.enemyHit?.(dir, { name: D.name, dmg: D.dmg * dmgK }, D.kind);
}
function tickAct(dt) {
  const c = cur, A = c?.act; if (!A) return;
  A.t += dt;
  const e = c.e, me = player.pos;
  if (A.k === 'charge') {
    const u = A.t / A.warn;
    if (A.t < A.warn) strip.material.opacity = 0.22 + 0.2 * Math.abs(Math.sin(A.t * 9)) + 0.15 * u;
    else {
      strip.material.opacity = Math.max(0, strip.material.opacity - dt * 1.4);
      if (!A.hit && !player.down) { // 달리는 동안 몸에 닿으면 받힘
        const minD = BOAR.bodyR * e.def.size + COLLIDE.player + 0.5;
        if (Math.hypot(me.x - e.pos.x, me.z - e.pos.z) < minD && player.jumpY < BOAR.jumpClear) { A.hit = true; hurtMe(new THREE.Vector3(Math.sin(A.dir), 0, Math.cos(A.dir)), 1); }
      }
      if (A.t > A.warn + A.dashT + B.charge.rest) endAct();
    }
  } else if (A.k === 'beam') {
    if (A.t < A.warn) discs.forEach((m) => { if (m.visible) m.material.opacity = 0.2 + 0.25 * Math.abs(Math.sin(A.t * 8)) + 0.2 * (A.t / A.warn); });
    else if (!A.struck) {
      A.struck = true; discs.forEach((m) => { m.visible = false; });
      A.pts.forEach((p, i) => { const b = beams[i]; if (!b) return; b.t = 0; b.m.position.set(p[0], height(p[0], p[1]) - 0.5, p[1]); b.m.scale.set(B.beam.r * 0.55, 1, B.beam.r * 0.55); b.m.visible = true; if (bfx && !lite()) bfx.ring(p[0], p[1], B.beam.r * 1.4, 0.5, '#fff2a8', 0, 1); });
      late.sound?.thud?.(true);
      if (!player.down) for (const p of A.pts) { const d = Math.hypot(me.x - p[0], me.z - p[1]); if (d < B.beam.r && player.jumpY < 1.2) { const k = d > 0.01 ? 1 / d : 0; hurtMe(new THREE.Vector3((me.x - p[0]) * k, 0, (me.z - p[1]) * k), B.beam.dmgK); break; } }
    } else if (A.t > A.warn + 0.7) endAct();
  } else if (A.t > 1.2) endAct();
}
function tickBeams(dt) {
  for (const b of beams) { if (b.t < 0) continue; b.t += dt; const u = b.t / 0.55; if (u >= 1) { b.t = -1; b.m.visible = false; continue; } b.m.material.opacity = (u < 0.15 ? u / 0.15 : (1 - u) / 0.85) * 0.9; }
}

/* ---------- 방장(혼자 하기) 우두머리 움직임 ---------- */
// 가장 가까운 싸우는 사람을 쫓다가, 쉬는 시간이 끝나면 단계에 맞는 패턴 하나
function target(c) {
  let best = null, bd = 1e9; for (const p of people()) { const d = Math.hypot(p.x - c.e.pos.x, p.z - c.e.pos.z); if (d < bd && distA(c.z, p) < B.leash) { bd = d; best = p; } }
  return best && { ...best, d: bd };
}
function aiCtl(e, dt) {
  const c = cur; if (!c || c.e !== e) return 0;
  const D = B.list[c.z], base = ENEMIES[D.kind], a = ARENA.get(c.z);
  e.snap = false;
  if (c.hold) return 0; // 확인용: 제자리에 묶음 (tools/boss.js 맞히기만 잰 시간)
  const A = c.act;
  if (A && A.k === 'charge') {
    if (A.t < A.warn) { e.heading += Math.atan2(Math.sin(A.dir - e.heading), Math.cos(A.dir - e.heading)) * Math.min(1, dt * 10); e.chg = 1; return 0; } // 앞발 구르기
    if (A.t < A.warn + A.dashT) { e.heading = A.dir; e.snap = true; return A.speed; }
    return 0; // 숨 고르기 (맞히기 좋은 때)
  }
  if (A) return 0; // 광선·부르기 동안 멈춤
  if (!c.fight) { // 빈터를 어슬렁거림
    const dx = a.x - e.pos.x, dz = a.z - e.pos.z, dc = Math.hypot(dx, dz);
    if (dc > a.r * 0.5) { e.heading += Math.atan2(Math.sin(Math.atan2(dx, dz) - e.heading), Math.cos(Math.atan2(dx, dz) - e.heading)) * Math.min(1, dt * 2); return base.walk * 0.8; }
    if (Math.random() < dt * 0.4) e.heading += (Math.random() - 0.5) * 2;
    return base.walk * 0.4;
  }
  const t = target(c); if (!t) return 0;
  const face = Math.atan2(t.x - e.pos.x, t.z - e.pos.z);
  e.heading += Math.atan2(Math.sin(face - e.heading), Math.cos(face - e.heading)) * Math.min(1, dt * 3);
  c.gapT -= dt; c.callT -= dt; c.beamT -= dt;
  if (c.gapT <= 0) { pickAct(c, t); const g = B.gap[c.ph]; c.gapT = g[0] + Math.random() * (g[1] - g[0]); return 0; }
  return t.d > 6 ? base.walk * B.walk + (t.d > 16 ? (base.rush ?? base.chase) * 0.35 : 0) : 0;
}
function pickAct(c, t) {
  const e = c.e;
  const live2 = c.minions.filter((m) => life.enemies.list.includes(m) && m.state !== 'flee' && m.state !== 'leave').length;
  if (c.ph >= 2 && c.beamT <= 0) { // 광선: 대상 자리 + 둘레 (조금 앞날 자리)
    c.beamT = B.beam.every; const pts = [[t.x, t.z]];
    for (let i = 1; i < B.beam.n; i++) { const a = Math.random() * Math.PI * 2, r = B.beam.spread * (0.6 + Math.random() * 0.6); pts.push([t.x + Math.sin(a) * r, t.z + Math.cos(a) * r]); }
    startAct('beam', { pts }); return;
  }
  if (c.ph >= 1 && c.callT <= 0 && live2 < B.call.max) { c.callT = B.call.every; startAct('call', {}); return; }
  // 돌진: 대상 쪽으로 len 만큼 (빈터에서 너무 멀어지지 않게 자름)
  const dir = Math.atan2(t.x - e.pos.x, t.z - e.pos.z), a = ARENA.get(c.z);
  let len = Math.max(8, Math.min(B.charge.len, t.d + 5));
  for (; len > 6; len -= 1) { const bx = e.pos.x + Math.sin(dir) * len, bz = e.pos.z + Math.cos(dir) * len; if (Math.hypot(bx - a.x, bz - a.z) < B.leash - 4 && trash.ok(bx, bz)) break; }
  startAct('charge', { ax: e.pos.x, az: e.pos.z, bx: e.pos.x + Math.sin(dir) * len, bz: e.pos.z + Math.cos(dir) * len });
}

/* ---------- 받는 쪽(멀티) ---------- */
function puppetCtl(e, dt) {
  const c = cur, n = c?.net; if (!c || c.e !== e || !n) return 0;
  const k = Math.min(1, dt * 9), ox = e.pos.x, oz = e.pos.z;
  const x = ox + (n.x - ox) * k, z = oz + (n.z - oz) * k; e.pos.set(x, height(x, z), z);
  e.heading += Math.atan2(Math.sin(n.h - e.heading), Math.cos(n.h - e.heading)) * k;
  return Math.hypot(x - ox, z - oz) / Math.max(dt, 1e-3);
}
let hitAcc = 0, hitT = 0;
function sendHit(dmg) { if (!cur) return; cur.hitByMe = true; hitAcc += dmg; if (hitT <= 0) hitT = 0.25; }
function flushHit(dt) {
  if (hitT <= 0) return; hitT -= dt; if (hitT > 0) return;
  if (cur && live && hitAcc > 0) room.send({ t: 'bh', z: cur.z, d: Math.round(hitAcc * 10) / 10 }); hitAcc = 0;
}
function sendState(force) {
  const c = cur; if (!c || c.puppet || !live || !room?.isHost) return;
  if (!force && (c.sendT -= 1) > 0) return;
  const e = c.e, A = c.act, o = { t: 'bs', z: c.z, s: [r1(e.pos.x), r1(e.pos.z), r2(e.heading), Math.ceil(e.hp), Math.round(c.max), c.ph, c.fight ? 1 : 0, c.n] };
  if (A && A.t < (A.warn || 0) + (A.dashT || 0) + 0.4) {
    const left = Math.max(0, (A.warn || 0) - A.t);
    o.a = A.k === 'charge' ? [1, A.seq, r2(left), r1(A.ax), r1(A.az), r1(A.bx), r1(A.bz)] : A.k === 'beam' ? [2, A.seq, r2(left), ...A.pts.flatMap((p) => [r1(p[0]), r1(p[1])])] : [3, A.seq, 0];
  }
  room.send(o);
}
function onBs(m) {
  if (isHost() || !ON || !B.list[m.z]) return;
  if (m.gone) { if (cur?.z === m.z) despawn(); return; }
  if (m.done) { netBeat[m.z] = Date.now(); if (cur?.z === m.z) defeated(cur, (m.f || []).includes(myId()) || cur.hitByMe); return; }
  const s = m.s; if (!Array.isArray(s) || s.length < 8) return;
  if (cur && (cur.z !== m.z || !cur.puppet)) despawn();
  if (!cur) { if (!spawn(m.z, true, { x: s[0], z: s[1] })) return; }
  const c = cur; c.net = { x: s[0], z: s[1], h: s[2] }; c.netT = nowS(); c.e.hp = Math.max(0, s[3]); c.max = Math.max(1, s[4]);
  if (s[5] > c.ph && c.fight) roar(c, true);
  c.ph = s[5] | 0; c.fight = !!s[6]; c.n = s[7] | 0;
  const a = m.a; if (Array.isArray(a) && a[1] !== c.seq) {
    if (a[0] === 1) startAct('charge', { seq: a[1], ax: a[3], az: a[4], bx: a[5], bz: a[6] }, a[2]);
    else if (a[0] === 2) { const pts = []; for (let i = 3; i + 1 < a.length; i += 2) pts.push([a[i], a[i + 1]]); startAct('beam', { seq: a[1], pts }, a[2]); }
    else if (a[0] === 3) startAct('call', { seq: a[1] });
  }
}
function onBh(m) {
  if (!isHost() || !cur || cur.puppet || cur.z !== m.z || !(m.d > 0)) return;
  if (!life.enemies.list.includes(cur.e) || cur.e.state !== 'boss') return;
  cur.fighters.set(m.from, Date.now());
  life.enemies.hurt(cur.e, m.d, true);
}
// 방장이 바뀜: 받던 우두머리를 이어 굴리거나, 내가 굴리던 것을 받는 쪽으로
function setMode() {
  if (!cur) return;
  const host = isHost(), e = cur.e;
  if (host && cur.puppet) { cur.puppet = false; e.puppet = false; e.ctl = aiCtl; e.remoteHurt = null; }
  else if (!host && !cur.puppet) { cur.puppet = true; e.puppet = true; e.ctl = puppetCtl; e.remoteHurt = sendHit; cur.net = { x: e.pos.x, z: e.pos.z, h: e.heading }; cur.netT = nowS(); }
}
late.bossNet = {
  link(r) {
    if (!r.on) return; room = r;
    r.on('hi', () => { live = true; setMode(); });
    r.on('host', () => setMode());
    r.on('close', () => { live = false; setMode(); });
    r.on('bs', onBs); r.on('bh', onBh);
  },
};

/* ---------- 쫓아냄 ---------- */
life.hooks.bossRepel = (e) => {
  const c = cur; if (!c || c.e !== e) return;
  const f = new Set([...c.fighters].filter(([, t]) => Date.now() - t < 120000).map(([id]) => id));
  const meIn = c.hitByMe || distA(c.z, player.pos) < B.leash; if (meIn) f.add(myId());
  if (live && room?.isHost) { room.send({ t: 'bs', z: c.z, done: 1, f: [...f] }); room.send({ t: 'bd', z: c.z }); }
  S.beat[c.z] = Date.now(); persist();
  defeated(c, meIn);
};
function defeated(c, mine) {
  const e = c.e, z = c.z, D = B.list[z], pos = e.pos.clone();
  if (c.puppet) { e.puppet = false; e.ctl = null; e.remoteHurt = null; if (e.state === 'boss') { e.state = 'flee'; e.st = 0; } }
  for (const m of c.minions) if (life.enemies.list.includes(m) && m.state !== 'flee') { m.state = 'leave'; m.st = 0; m.bar.g.visible = false; }
  endAct(); cur = null; crown.visible = aura.visible = false; bar(false);
  if (!isHost()) netBeat[z] = Date.now();
  const near = Math.hypot(pos.x - player.pos.x, pos.z - player.pos.z) < 90;
  if (near) { state.slowMo = B.slow.t; state.slowK = B.slow.k; }
  if (near && bfx) { const col2 = tierColor(z); bfx.ring(pos.x, pos.z, 8, 1.2, '#fff3b0', 0, 2); bfx.burst(pos.x, pos.y + 1, pos.z, { petals: lite() ? 30 : 110, sparks: lite() ? 12 : 60, up: 7, spread: 1.6, color: col2 }); }
  late.sound?.fanfare?.();
  late.guard?.raise(z, !late.guard?.server?.());
  if (!mine) { if (near) toast(`${name(z)}${josaEulReul(name(z))} 쫓아냈어요!`); return; }
  // 보상: 귤(분수처럼) + 귀한 재료 자리
  life.scatterTangerines(pos, D.gyul, B.loot);
  S.mats[D.mat] = (S.mats[D.mat] || 0) + 1;
  const first = !isDone(z); S.done[z] = (S.done[z] || 0) + 1;
  const log = logOf(z), got = { gyul: D.gyul, mat: D.mat, first, log: { ...log, repel: log.repel + 1 }, s0: log.s0 };
  delete S.log[z]; persist();
  toast(`${name(z)}${josaEulReul(name(z))} 쫓아냈어요! 귤 ${D.gyul} · ${D.mat}`, 3.4);
  late.ach?.emit?.('boss-repel'); late.pace?.note?.('repel');
  pendingSummary = { z, got, at: nowS() + ZONE_GUARD.afterBloom + B.summaryAt }; // 하르방이 솟는 동안 보고 나서
}
let pendingSummary = null;


/* ---------- 화면 위 이름·기운 줄 ---------- */
let barOn = false;
function bar(on) {
  const el = $('boss-bar'); if (barOn === on) return; barOn = on; el.hidden = !on; document.body.classList.toggle('boss-on', on);
  if (on && cur) { $('boss-name').textContent = name(cur.z); el.style.setProperty('--tier', tierColor(cur.z)); document.body.style.setProperty('--boss-h', (el.offsetHeight + 8) + 'px'); }
}
function tickBar() {
  const c = cur, on = !!c && c.fight && distA(c.z, player.pos) < B.leash + 8 && !panelOpen() && !late.tut?.active;
  bar(on); if (!on) return;
  const el = $('boss-bar'), f = Math.max(0, c.e.hp / c.max);
  $('boss-fill').style.width = (f * 100).toFixed(1) + '%';
  el.classList.toggle('ph1', c.ph === 1); el.classList.toggle('ph2', c.ph === 2);
  const n = $('boss-n'); n.hidden = !(c.n > 1); if (c.n > 1) n.textContent = `${c.n}명`;
}


/* ---------- 지도 아이콘 (field.js drawIcons 가 부름) ---------- */
// 우두머리가 있으면 빨간 왕관, 나올 수 있으면 귤빛 왕관
late.bossIcons = (x, uv, s, inC) => {
  for (const [z, a] of ARENA) {
    const here = cur?.z === z, can = !here && canSpawn(z); if (!here && !can) continue;
    const [u, v] = uv(a.x, a.z); if (!inC(u, v)) continue;
    x.fillStyle = here ? '#ff4a3a' : '#ffb030'; x.strokeStyle = '#fff'; x.lineWidth = Math.max(1, s / 7);
    x.beginPath(); x.moveTo(u - s * 0.5, v + s * 0.35); x.lineTo(u - s * 0.55, v - s * 0.3); x.lineTo(u - s * 0.22, v); x.lineTo(u, v - s * 0.45); x.lineTo(u + s * 0.22, v); x.lineTo(u + s * 0.55, v - s * 0.3); x.lineTo(u + s * 0.5, v + s * 0.35); x.closePath(); x.fill(); x.stroke();
  }
};


/* ---------- 매 프레임 ---------- */
let spawnT = 0;
function tickHost(dt) {
  if ((spawnT -= dt) <= 0) {
    spawnT = 0.5;
    const ps = people();
    if (!cur) { // 나올 수 있는 구역 빈터 가까이에 누가 있으면
      for (const z of ARENA.keys()) if (canSpawn(z) && ps.some((p) => distA(z, p) < B.near)) { spawn(z); break; }
    } else {
      const c = cur, a = ARENA.get(c.z), inL = ps.filter((p) => distA(c.z, p) < B.leash);
      if (!c.fight) {
        if (!ps.some((p) => distA(c.z, p) < B.despawn) || !canSpawn(c.z)) { if (live) room.send({ t: 'bs', z: c.z, gone: 1 }); despawn(); return; }
        if (ps.some((p) => Math.hypot(p.x - c.e.pos.x, p.z - c.e.pos.z) < a.r + B.fight || distA(c.z, p) < a.r + B.fight)) { // 싸움 시작
          c.fight = true; c.gapT = 1.2; c.callT = 4; c.beamT = 2; c.n = Math.max(1, inL.length);
          c.max = c.base * (1 + B.perPlayer * (c.n - 1)); c.e.hp = c.max; c.e.def = { ...c.e.def, hp: c.max };
          roar(c, false); toast(`${name(c.z)}${josaIGa(name(c.z))} 덤벼요! 바닥 경고를 보고 피해요`, 3);
          sendState(true);
        }
      } else if (!inL.length) { // 모두 멀어지거나 쓰러짐: 빈터로 돌아가 기운을 채움
        if (distA(c.z, player.pos) < B.leash + 40 || hp.isDown) toast(`${name(c.z)}${josaIGa(name(c.z))} 빈터로 돌아갔어요. 다시 도전해요`, 3);
        endAct(); c.fight = false; c.ph = 0; c.n = 1; c.max = c.base; c.e.hp = c.base; c.e.pos.set(a.x, height(a.x, a.z), a.z); c.minions.length = 0; c.fighters.clear(); c.hitByMe = false;
        sendState(true);
      } else if (inL.length > c.n) { const n = inL.length, k = (1 + B.perPlayer * (n - 1)) / (1 + B.perPlayer * (c.n - 1)); c.n = n; c.max *= k; c.e.hp *= k; }
    }
  }
  if (!cur || cur.puppet) return;
  const c = cur, f = c.e.hp / c.max, ph = f <= B.phase[1] ? 2 : f <= B.phase[0] ? 1 : 0;
  if (c.fight && ph > c.ph) { c.ph = ph; roar(c, true); c.gapT = Math.min(c.gapT, 0.6); if (ph === 1) c.callT = 0; if (ph === 2) c.beamT = 0; sendState(true); }
  if (live && (c.sendT -= dt * 1000 / B.netMs) <= 0) { c.sendT = 1; sendState(true); }
}
late.tickBoss = (dt) => {
  if (!ON) return;
  if (pendingSummary && nowS() >= pendingSummary.at && !hp.isDown && !panelOpen() && !state.photoState) { const p = pendingSummary; pendingSummary = null; openSummary(p.z, p.got); }
  tickZoneDone(dt); flushHit(dt); tickBeams(dt);
  if (cur && !life.enemies.list.includes(cur.e)) { endAct(); cur = null; crown.visible = aura.visible = false; bar(false); } // 확인용 지우기 등
  if (isHost()) tickHost(dt);
  else if (cur?.puppet && nowS() - (cur.netT || 0) > 3) despawn(); // 방장이 3초 넘게 알리지 않음 (방장 화면엔 없음)
  const c = cur;
  if (c) {
    tickAct(dt);
    const e = c.e, y = e.pos.y + e.h + 0.55 + Math.sin(nowS() * 2.2) * 0.08;
    crown.position.set(e.pos.x, y, e.pos.z); crown.rotation.y += dt * 1.2; crown.scale.setScalar(0.9 + e.def.size * 0.35);
    aura.position.set(e.pos.x, e.pos.y + 0.1, e.pos.z); aura.scale.setScalar(BOAR.bodyR * e.def.size * 1.5); aura.material.opacity = 0.35 + 0.2 * Math.sin(nowS() * 4) + (c.roarT > 0 ? 0.3 : 0);
    if (c.roarT > 0) c.roarT -= dt;
    if ((c.tintT -= dt) <= 0) { c.tintT = 0.5; tintBoss(e, B.list[c.z].tint); }
    if (c.fight && distA(c.z, player.pos) < B.leash) state.tension = Math.max(state.tension || 0, 0.75);
  }
  tickBar();
};

/* ---------- 확인용 (window.__oreum.boss) ---------- */
// state(): 지금 우두머리 · spots(): 빈터·빠른 마차·지름길 자리 · go(z): 빈터 앞으로 · ready(z): 그 구역을 80% 로 비움 · spawn(z) · fight() · hp(v) · act(k)
// beat(z)/done(): 기록, summary(z): 요약 창 · fast(z)/cut(z): 빠른 마차·지름길 · wake(z): 깨어날 구역 · net(): 멀티 상태
late.bossFight = () => !!cur?.fight;
late.boss = ON ? {
  state: () => cur && { zone: cur.z, hp: +cur.e.hp.toFixed(1), max: +cur.max.toFixed(1), ph: cur.ph, fight: cur.fight, n: cur.n, act: cur.act?.k || null, actT: cur.act ? +cur.act.t.toFixed(2) : null, puppet: cur.puppet, x: +cur.e.pos.x.toFixed(1), z: +cur.e.pos.z.toFixed(1), minions: cur.minions.length, state: cur.e.state, size: +cur.e.def.size.toFixed(2) },
  spots: () => [...ARENA].map(([z, a]) => ({ zone: z, x: Math.round(a.x), z: Math.round(a.z), r: a.r, fast: fastSpot(z) && { x: Math.round(fastSpot(z).x), z: Math.round(fastSpot(z).z) }, cut: cutSpot(z) && { x: Math.round(cutSpot(z).x), z: Math.round(cutSpot(z).z), to: { x: Math.round(cutSpot(z).to.x), z: Math.round(cutSpot(z).to.z) } }, wake: chSpot(z) && { x: Math.round(chSpot(z).x), z: Math.round(chSpot(z).z) } })),
  go(z, d = 22) { const a = ARENA.get(z); if (!a) return null; const h = Math.atan2(player.pos.x - a.x, player.pos.z - a.z) || 0, x = a.x + Math.sin(h) * d, zz = a.z + Math.cos(h) * d; warp({ x, z: zz, h: h + Math.PI }); zoneDoneTest.resetWarp(); return { x: +x.toFixed(1), z: +zz.toFixed(1) }; },
  goSpot(kind, z) { const s = kind === 'fast' ? fastSpot(z) : kind === 'cut' ? cutSpot(z) : chSpot(z); if (!s) return null; warp({ x: s.x + 1.2, z: s.z + 1.2, h: 0 }); zoneDoneTest.resetWarp(); return { x: +s.x.toFixed(1), z: +s.z.toFixed(1) }; },
  ready(z) { let need = Math.ceil(trash.heaps.filter((h) => h.zone === z).reduce((s, h) => s + h.n, 0) * (1 - B.appear)); trash.heaps.forEach((h, i) => { if (h.zone !== z) return; const n = Math.min(h.n, need); trash.test.setHeap(i, n); need -= n; }); delete S.beat[z]; netBeat[z] = 0; return +trash.zoneClean(z).toFixed(3); },
  can: (z) => canSpawn(z), spawn: (z) => (cur ? null : !!spawn(z)), despawn: () => despawn(),
  arena: (z = cur?.z) => { const a = ARENA.get(z); return a ? { x: a.x, z: a.z, r: a.r } : null; },
  fight() { if (!cur) return false; spawnT = 0; cur.e.pos.set(player.pos.x + 6, height(player.pos.x + 6, player.pos.z), player.pos.z); return true; },
  hp(v) { if (!cur) return null; if (v != null) life.enemies.hurt(cur.e, Math.max(0, cur.e.hp - v), true); return cur ? cur.e.hp : 0; },
  act(k) { if (!cur || cur.puppet) return null; const t = target(cur) || { x: player.pos.x, z: player.pos.z, d: Math.hypot(player.pos.x - cur.e.pos.x, player.pos.z - cur.e.pos.z) }; if (k === 'beam') cur.beamT = 0; if (k === 'call') cur.callT = 0; const ph = cur.ph; if (k !== 'charge') cur.ph = 2; if (k === 'call') cur.beamT = 99; pickAct(cur, t); cur.ph = ph; return cur.act?.k; },
  freeze(on) { if (cur) cur.gapT = on ? 1e9 : 1; return !!cur; },
  hold(on) { if (cur) { cur.hold = !!on; cur.gapT = on ? 1e9 : 1; } return !!cur; },
  done: () => ({ done: { ...S.done }, beat: { ...S.beat }, mats: { ...S.mats }, log: JSON.parse(JSON.stringify(S.log)), wake: S.wake }),
  setDone(z, n = 1) { if (n) S.done[z] = n; else delete S.done[z]; persist(); zoneDoneTest.setExitT(0); },
  summary(z) { openSummary(z, { gyul: B.list[z].gyul, mat: B.list[z].mat, first: true, log: { pick: 123, repel: 9 }, s0: Math.max(0, gearScore(save).total - 12) }); return !$('zdone').hidden; },
  fast(z) { const f = interactables.find((i) => i.label === '빠른 마차' && i.pos.distanceTo(new THREE.Vector3(fastSpot(z)?.x, fastSpot(z)?.y, fastSpot(z)?.z)) < 0.1); return f && f.when() ? f.act() : null; },
  cut(z) { const f = interactables.find((i) => i.label === '지름길' && i.pos.distanceTo(new THREE.Vector3(cutSpot(z)?.x, cutSpot(z)?.y, cutSpot(z)?.z)) < 0.1); return f && f.when() ? f.act() : null; },
  wake(z) { if (z != null) { S.wake = z; persist(); } return late.wakeAt(); },
  net: () => ({ live, host: isHost(), id: myId(), netBeat: { ...netBeat } }),
  get cur() { return cur; },
} : null;
