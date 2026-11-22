// 오름 레이드 '쓰레기 대왕' (#181). 수치는 balance.js RAID, 규칙(시각·기운·더미·기여·보상)은 src/raidcore.js
// - 매일 RAID.times(한국 시간)에 굼부리 한가운데(zones.js CRATER)에 나타남. lead 초 전부터 화면 위 알림·지도 표시·말 한 줄(감독)
// - 기운은 방(서버)이 셈: 누가 맞혀도 피해는 {t:'rh'} 로 방에, 방이 사람마다 초당 RAID.dps 까지만 받아 줌. 서버가 없으면 내 화면의 같은 코드(createRaid)
// - 몸 움직임은 방장이 굴리고 {t:'rs'} 로 알림(우두머리 #139 의 틀). 방장이 바뀌어도 기운은 방에 있어 그대로 이어짐 (몸 자리만 받던 자리에서)
// - 패턴: ① 쓰레기 봉투 던지기(바닥 원 → 떨어짐) ② 기운 RAID.phase 아래: 무리 부르기(각자 화면) + 몸통 돌진(바닥 띠) ③ 기운 0: 부서져 더미 RAID.heaps 개
//   부서진 더미는 가까이 가면 저절로 하나씩 주움({t:'rp'}). breakSec 안에 다 주우면 성공, 못 주우면 남은 기운으로 다시 뭉침. limit 초가 지나면 흩어짐
// - 보상은 방이 줌({t:'rw'}): 귤·경험치, 그날 첫 성공엔 상자. 기여 1~3위 이름. save.raid = { wins, day }
// (파일 순서는 src/modules.js: boss 뒤)
import * as THREE from 'three';
import { RAID as R, BOAR, COLLIDE, ENEMIES } from '../balance.js';
import { createRaid, RAID_PH as PH, raidHeapSpots } from '../raidcore.js';
import { CRATER } from '../zones.js';
import { __geo as heapGeo } from '../trash.js';
import { gradHard } from '../toon.js';
import { height } from '../world.js';
import { state, late } from './state.js';
import { $, save, persist } from './save.js';
import { scene, quality } from './scene.js';
import { trash, bfx, player, life, hp } from './place.js';
import { addCoins, toast, panelOpen } from './hud.js';
import { say } from './director.js';
import { ON } from './zonedone.js';

const RON = ON && !!CRATER;
const C = RON ? { x: CRATER.x, z: CRATER.z } : { x: 0, z: 0 };
const lite = () => quality.level === 0;
const nowS = () => performance.now() / 1000;
const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
const distC = (p) => Math.hypot(p.x - C.x, p.z - C.z);
const kst = (ms) => { const d = new Date(ms + 9 * 3600e3); return `${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
if (!save.raid || typeof save.raid !== 'object' || Array.isArray(save.raid)) save.raid = { wins: 0 }; // 예전 저장엔 없음
save.raid.wins = Math.max(0, save.raid.wins | 0);

/* ---------- 방(서버) 또는 내 화면 ---------- */
let room = null, live = false;
const myId = () => (live && room?.id) || 'me';
const isHost = () => !live || !!room?.isHost;
const local = RON ? createRaid({ send: (id, o) => { if (!live) onMsg(o); }, who: () => ({ nick: save.nick || '나', here: true }) }) : null;
const tx = (o) => { if (live) room.send(o); else if (o.t === 'rh') local.hit('me', o.d); else if (o.t === 'rp') local.pick('me', o.i); else if (o.t === 'rj') local.join('me'); else if (o.t === 'rgo') local.start(o.f === 1); };

// 방이 알려 준 상태
const S = { id: 0, ph: PH.idle, at: 0, end: 0, hp: 0, max: 1, n: 1, broke: 0, h: null, off: 0 }; // off: 서버 시계 - 내 시계 (ms, hi 의 now)
const srvNow = () => Date.now() + S.off;
function onMsg(m) {
  if (!m || !RON) return;
  if (m.t === 'rv' && Array.isArray(m.s) && m.s.length >= 8) {
    const [id, ph, at, end, hpv, max, n, broke] = m.s, was = S.ph;
    Object.assign(S, { id, ph, at, end, hp: hpv, max: Math.max(1, max), n, broke, h: Array.isArray(m.h) ? m.h : ph === PH.broke ? S.h : null });
    if (was !== ph) phaseChanged(was, ph);
  } else if (m.t === 'rs') onRs(m);
  else if (m.t === 'rw') reward(m);
}

/* ---------- 모양: 쓰레기 산 몸 + 눈 둘 · 바닥 원·띠 · 봉투 · 부서진 더미 ---------- */
const mat = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradHard });
function blob() {
  const g = new THREE.Group(), low = lite();
  const body = new THREE.Mesh(heapGeo.makeHeapGeo('mt', 0, low), mat); const bb = new THREE.Box3().setFromObject(body), sz = bb.getSize(new THREE.Vector3());
  const k = 1.15 / Math.max(sz.x, sz.z) * 2; body.scale.set(k, k * 1.25, k); g.add(body); // 바탕 크기 약 지름 2.3 × 높이 (모양 root 가 RAID.k 배로 키움)
  const head = new THREE.Mesh(heapGeo.makeHeapGeo('l', 0, low), mat); head.scale.setScalar(k * 0.75); head.position.y = sz.y * k * 1.05; head.rotation.y = 1.3; g.add(head);
  const eyeW = new THREE.MeshBasicMaterial({ color: '#fff7d0' }), eyeB = new THREE.MeshBasicMaterial({ color: '#1b1a17' });
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), eyeW); w.position.set(s * 0.26, sz.y * k * 1.1, 0.78); const b = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), eyeB); b.position.set(0, 0, 0.12); w.add(b); g.add(w); }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = !low; } });
  return g;
}
const warnMat = (o) => new THREE.MeshBasicMaterial({ color: '#ff3b24', transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide, fog: false });
const DISC_N = 20;
function disc() {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((DISC_N + 1) * 3), 3));
  const idx = []; for (let i = 0; i < DISC_N; i++) idx.push(0, i + 1, ((i + 1) % DISC_N) + 1); g.setIndex(idx);
  const m = new THREE.Mesh(g, warnMat(0.3)); m.visible = false; m.frustumCulled = false; m.renderOrder = 3; scene.add(m); return m;
}
function layDisc(m, x, z, r) {
  const p = m.geometry.attributes.position; p.setXYZ(0, x, height(x, z) + 0.14, z);
  for (let i = 0; i < DISC_N; i++) { const a = i / DISC_N * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; p.setXYZ(i + 1, px, height(px, pz) + 0.14, pz); }
  p.needsUpdate = true; m.visible = true;
}
const STRIP_N = 16;
const strip = (() => {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((STRIP_N + 1) * 2 * 3), 3));
  const idx = []; for (let i = 0; i < STRIP_N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
  const m = new THREE.Mesh(g, warnMat(0.32)); m.visible = false; m.frustumCulled = false; m.renderOrder = 3; scene.add(m); return m;
})();
function layStrip(ax, az, bx, bz, w) {
  const p = strip.geometry.attributes.position, L = Math.hypot(bx - ax, bz - az) || 1, ux = (bx - ax) / L, uz = (bz - az) / L, sx = -uz * w / 2, sz = ux * w / 2;
  for (let i = 0; i <= STRIP_N; i++) { const t = i / STRIP_N, cx = ax + (bx - ax) * t, cz = az + (bz - az) * t; for (const [j, s] of [[0, 1], [1, -1]]) { const x = cx + sx * s, z = cz + sz * s; p.setXYZ(i * 2 + j, x, height(x, z) + 0.12, z); } }
  p.needsUpdate = true; strip.visible = true;
}
const discs = RON ? Array.from({ length: R.bag.n }, disc) : [];
const bagGeo = new THREE.IcosahedronGeometry(0.55, 0), bagMat = new THREE.MeshToonMaterial({ color: '#2e2e34', gradientMap: gradHard });
const bags = RON ? discs.map(() => { const m = new THREE.Mesh(bagGeo, bagMat); m.visible = false; scene.add(m); return m; }) : [];
let heapMs = []; // 부서진 더미 모양 [{ m, x, z }]
function showHeaps(on) {
  if (!on) { for (const h of heapMs) { scene.remove(h.m); } heapMs = []; return; }
  if (heapMs.length) return;
  const geo = heapGeo.makeHeapGeo('l', 0, lite());
  heapMs = raidHeapSpots(S.id, C.x, C.z).map(([x, z]) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, height(x, z), z); m.scale.setScalar(0.8); scene.add(m); return { m, x, z }; });
}

/* ---------- 몸 (적 목록에 우두머리로 넣음: 맞히기·겨누기·충돌은 적과 같이) ---------- */
let body = null; // { e, act, seq, gapT, callT, chargeT, net:{x,z,h}, netT, sendT }
let seqN = 0;
function spawnBody() {
  if (body || !life?.enemies) return;
  const D = { name: R.name, hp: S.max, dmg: R.dmg, k: R.k, gyul: 0, ctl: (e, dt) => ctl(e, dt), remoteHurt: (d) => { hitAcc += d; }, puppet: !isHost() };
  const at = body?.net || { x: C.x, z: C.z };
  const e = life.enemies.spawnBoss(R.kind, at.x, at.z, D);
  e.root.children.slice().forEach((o) => { if (o !== e.bar.g) o.visible = false; }); // 멧돼지 모양은 감추고 쓰레기 산
  const g = blob(); e.root.add(g); e.raid = true;
  body = { e, act: null, seq: -1, gapT: 2, callT: R.call.every * 0.5, chargeT: R.charge.every * 0.6, net: { x: at.x, z: at.z, h: 0 }, netT: nowS(), sendT: 0 };
  syncHp();
  if (bfx && distC(player.pos) < 120) bfx.burst(C.x, height(C.x, C.z) + 0.5, C.z, { petals: lite() ? 12 : 50, sparks: 0, up: 4, spread: 2.4, color: '#8a7c66' });
  late.sound?.boar?.();
}
function despawnBody(burst) {
  if (!body) return;
  const e = body.e; endAct();
  if (burst && bfx) bfx.burst(e.pos.x, e.pos.y + 1.5, e.pos.z, { petals: lite() ? 30 : 120, sparks: lite() ? 10 : 50, up: 7, spread: 2, color: '#a89878' });
  if (life.enemies.list.includes(e)) life.enemies.remove(e);
  body = null;
}
function syncHp() { if (!body) return; const e = body.e; e.hp = S.hp; e.def = { ...e.def, hp: S.max }; }
function setMode() { if (!body) return; const p = !isHost(); body.e.puppet = p; body.net = { x: body.e.pos.x, z: body.e.pos.z, h: body.e.heading }; body.netT = nowS(); }

// 싸우는 사람: 나 + 방장이면 자리 가까운 다른 사람
function people() {
  const out = [];
  if (!hp.isDown && !hp.pending && distC(player.pos) < R.r) out.push({ id: myId(), x: player.pos.x, z: player.pos.z, me: true });
  if (live && room?.isHost) for (const [id, e] of late.net?.peersById || []) if (e?.pos && distC(e.pos) < R.r) out.push({ id, x: e.pos.x, z: e.pos.z });
  return out;
}
function target() { const e = body.e; let b = null, bd = 1e9; for (const p of people()) { const d = Math.hypot(p.x - e.pos.x, p.z - e.pos.z); if (d < bd) { bd = d; b = p; } } return b && { ...b, d: bd }; }

/* ---------- 패턴 ---------- */
function startAct(k, o, left = null) {
  endAct(); if (!body) return;
  const A = { k, t: 0, hit: false, seq: o.seq ?? ++seqN, ...o };
  if (k === 'bag') { A.warn = left ?? R.bag.warn; A.pts.forEach((p, i) => { if (discs[i]) layDisc(discs[i], p[0], p[1], R.bag.r); }); }
  else if (k === 'charge') { A.warn = left ?? R.charge.warn; A.dir = Math.atan2(o.bx - o.ax, o.bz - o.az); A.len = Math.hypot(o.bx - o.ax, o.bz - o.az); A.dashT = A.len / R.charge.speed; layStrip(o.ax, o.az, o.bx, o.bz, R.charge.w); }
  else if (k === 'call') { A.warn = 0; callMinions(); }
  body.act = A; body.seq = A.seq;
  if (isHost()) sendRs(true);
}
function endAct() { strip.visible = false; discs.forEach((m) => { m.visible = false; }); bags.forEach((m) => { m.visible = false; }); if (body) body.act = null; }
function callMinions() {
  const e = body.e; if (distC(player.pos) > R.r + 10 || !life.enemies.spawnPlan) return;
  const live2 = life.enemies.list.filter((m) => m.raidMinion && m.state !== 'flee' && m.state !== 'leave').length; if (live2 >= R.call.max) return;
  const [a, b] = R.call.n, n = Math.min(R.call.max - live2, a + Math.floor(Math.random() * (b - a + 1))), before = new Set(life.enemies.list);
  life.enemies.spawnPlan({ kind: ENEMIES[R.call.kind] ? R.call.kind : 'boar', n, x: e.pos.x, z: e.pos.z, zone: 4, forceKind: true }, true);
  life.enemies.list.filter((m) => !before.has(m)).forEach((m) => { m.raidMinion = true; m.state = 'charge'; m.st = 0; });
  say('danger', 'raidCall', `${R.name}가 무리를 불렀어요!`, 2.2, { ttl: 3 });
}
const hurtMe = (dir, k = 1) => life.hooks.enemyHit?.(dir, { name: R.name, dmg: R.dmg * k }, R.kind);
function tickAct(dt) {
  const A = body?.act; if (!A) return;
  A.t += dt; const e = body.e, me = player.pos;
  if (A.k === 'bag') {
    const u = Math.min(1, A.t / A.warn);
    discs.forEach((m, i) => { if (!m.visible) return; m.material.opacity = 0.2 + 0.25 * Math.abs(Math.sin(A.t * 8)) + 0.2 * u; const p = A.pts[i], b = bags[i]; if (p && b) { b.visible = true; b.position.set(e.pos.x + (p[0] - e.pos.x) * u, height(p[0], p[1]) + 1 + (1 - u) * 4 + Math.sin(u * Math.PI) * 8, e.pos.z + (p[1] - e.pos.z) * u); b.rotation.x += dt * 5; } });
    if (A.t >= A.warn && !A.hit) {
      A.hit = true; discs.forEach((m) => { m.visible = false; }); bags.forEach((m) => { m.visible = false; }); late.sound?.thud?.(true);
      for (const p of A.pts) { if (bfx && !lite()) bfx.ring(p[0], p[1], R.bag.r * 1.3, 0.5, '#8a7c66', 0, 1); const d = Math.hypot(me.x - p[0], me.z - p[1]); if (!player.down && d < R.bag.r && player.jumpY < 1.2) { const k = d > 0.01 ? 1 / d : 0; hurtMe(new THREE.Vector3((me.x - p[0]) * k, 0, (me.z - p[1]) * k), 0.8); break; } }
    }
    if (A.t > A.warn + 0.5) endAct();
  } else if (A.k === 'charge') {
    if (A.t < A.warn) strip.material.opacity = 0.22 + 0.2 * Math.abs(Math.sin(A.t * 9));
    else {
      strip.material.opacity = Math.max(0, strip.material.opacity - dt * 1.4);
      if (!A.hit && !player.down && Math.hypot(me.x - e.pos.x, me.z - e.pos.z) < BOAR.bodyR * e.def.size + COLLIDE.player + 0.4 && player.jumpY < BOAR.jumpClear) { A.hit = true; hurtMe(new THREE.Vector3(Math.sin(A.dir), 0, Math.cos(A.dir))); }
      if (A.t > A.warn + A.dashT + R.charge.rest) endAct();
    }
  } else if (A.t > 1) endAct();
}
// 방장(혼자) 몸: 가까운 사람 쪽으로 걷다가 틈마다 패턴 하나. 자리 밖으로는 안 나감
function ctl(e, dt) {
  if (!body || body.e !== e) return 0;
  e.snap = false;
  if (e.puppet) { const n = body.net, k = Math.min(1, dt * 8), ox = e.pos.x, oz = e.pos.z, x = ox + (n.x - ox) * k, z = oz + (n.z - oz) * k; e.pos.set(x, height(x, z), z); e.heading += Math.atan2(Math.sin(n.h - e.heading), Math.cos(n.h - e.heading)) * k; return Math.hypot(x - ox, z - oz) / Math.max(dt, 1e-3); }
  const A = body.act;
  if (A?.k === 'charge') { if (A.t < A.warn) { e.heading = A.dir; return 0; } if (A.t < A.warn + A.dashT) { e.heading = A.dir; e.snap = true; return R.charge.speed; } return 0; }
  if (A) return 0;
  const t = target();
  if (!t) { const dx = C.x - e.pos.x, dz = C.z - e.pos.z; if (Math.hypot(dx, dz) < 4) return 0; e.heading = Math.atan2(dx, dz); return R.walk * 0.6; }
  const face = Math.atan2(t.x - e.pos.x, t.z - e.pos.z); e.heading += Math.atan2(Math.sin(face - e.heading), Math.cos(face - e.heading)) * Math.min(1, dt * 3);
  body.gapT -= dt; body.callT -= dt; body.chargeT -= dt;
  if (body.gapT <= 0) { pick(t); const g = R.bag.gap; body.gapT = g[0] + Math.random() * (g[1] - g[0]); return 0; }
  return t.d > 7 && distC(e.pos) < R.r - 8 ? R.walk : 0;
}
function pick(t) {
  const e = body.e, ph1 = S.hp < S.max * R.phase;
  if (ph1 && body.callT <= 0) { body.callT = R.call.every; startAct('call', {}); return; }
  if (ph1 && body.chargeT <= 0) {
    body.chargeT = R.charge.every; const dir = Math.atan2(t.x - e.pos.x, t.z - e.pos.z); let len = Math.min(R.charge.len, t.d + 6);
    for (; len > 6; len -= 1) { const bx = e.pos.x + Math.sin(dir) * len, bz = e.pos.z + Math.cos(dir) * len; if (Math.hypot(bx - C.x, bz - C.z) < R.r - 4 && (!trash.ok || trash.ok(bx, bz))) break; }
    startAct('charge', { ax: e.pos.x, az: e.pos.z, bx: e.pos.x + Math.sin(dir) * len, bz: e.pos.z + Math.cos(dir) * len }); return;
  }
  const pts = [[t.x, t.z]]; for (let i = 1; i < R.bag.n; i++) { const a = Math.random() * Math.PI * 2, r = R.bag.spread * (0.5 + Math.random() * 0.6); pts.push([t.x + Math.sin(a) * r, t.z + Math.cos(a) * r]); }
  startAct('bag', { pts });
}
function sendRs(force) {
  if (!body || !live || !room?.isHost) return;
  if (!force && (body.sendT -= 1) > 0) return;
  const e = body.e, A = body.act, o = { t: 'rs', s: [r1(e.pos.x), r1(e.pos.z), r2(e.heading)] };
  if (A && A.t < (A.warn || 0) + (A.dashT || 0) + 0.3) { const left = r2(Math.max(0, (A.warn || 0) - A.t)); o.a = A.k === 'bag' ? [1, A.seq, left, ...A.pts.flatMap((p) => [r1(p[0]), r1(p[1])])] : A.k === 'charge' ? [2, A.seq, left, r1(A.ax), r1(A.az), r1(A.bx), r1(A.bz)] : [3, A.seq, 0]; }
  room.send(o);
}
function onRs(m) {
  if (isHost() || !Array.isArray(m.s) || m.s.length < 3) return;
  if (!body) return; // 몸은 단계(rv)를 보고 띄움
  body.net = { x: m.s[0], z: m.s[1], h: m.s[2] }; body.netT = nowS();
  const a = m.a; if (Array.isArray(a) && a[1] !== body.seq) {
    if (a[0] === 1) { const pts = []; for (let i = 3; i + 1 < a.length; i += 2) pts.push([a[i], a[i + 1]]); startAct('bag', { seq: a[1], pts }, a[2]); }
    else if (a[0] === 2) startAct('charge', { seq: a[1], ax: a[3], az: a[4], bx: a[5], bz: a[6] }, a[2]);
    else if (a[0] === 3) startAct('call', { seq: a[1] });
  }
}

/* ---------- 피해·줍기·참가 보내기 ---------- */
let hitAcc = 0, hitT = 0, pickT = 0, joinT = 0;
function flush(dt) {
  if ((hitT -= dt) <= 0 && hitAcc > 0) { hitT = 0.25; const d = Math.min(hitAcc, 300); tx({ t: 'rh', d: Math.round(d * 10) / 10 }); hitAcc = Math.min(R.dpsBurst, hitAcc - d); } // 한 번에 NET.bossHitMax 까지, 남은 것은 다음에
  const near = distC(player.pos) < R.r;
  if (near && S.ph >= PH.soon && S.ph <= PH.broke && (joinT -= dt) <= 0) { joinT = 3; tx({ t: 'rj' }); }
  if (S.ph === PH.broke && S.h && !hp.isDown && (pickT -= dt) <= 0) {
    for (let i = 0; i < heapMs.length; i++) { const h = heapMs[i]; if ((S.h[i] | 0) > 0 && Math.hypot(player.pos.x - h.x, player.pos.z - h.z) < R.pickR + 1.2) { pickT = R.pickEvery; tx({ t: 'rp', i }); late.sound?.pick?.(); break; } }
  }
}

/* ---------- 단계 바뀜·보상 ---------- */
function phaseChanged(was, ph) {
  if (ph === PH.soon) say('danger', 'raidSoon', `${kst(S.at)} 굼부리에 '${R.name}'가 나타나요. 함께 잡아요!`, 4, { ttl: 30 });
  if (ph === PH.on && was === PH.broke) say('danger', 'raidReform', `더미를 다 줍지 못해 ${R.name}가 다시 뭉쳤어요!`, 3, { ttl: 6 });
  else if (ph === PH.on && distC(player.pos) < R.r + 80) say('danger', 'raidOn', `${R.name}가 나타났어요! 바닥 경고를 보고 피해요`, 3, { ttl: 8 });
  if (ph === PH.broke) { despawnBody(true); if (distC(player.pos) < R.r + 40) say('quest', 'raidBroke', `${R.name}가 부서졌어요! 흩어진 더미를 모두 주워요`, 3.4, { ttl: 8 }); }
  if (ph === PH.lost && distC(player.pos) < R.r + 80) say('danger', 'raidLost', `${R.name}가 흩어져 사라졌어요. 다음 시각에 다시`, 3, { ttl: 8 });
  if (ph === PH.won) { showHeaps(false); for (const m of life.enemies.list) if (m.raidMinion && m.state !== 'flee') { m.state = 'leave'; m.st = 0; } }
  if (ph !== PH.broke) showHeaps(false);
  if (ph !== PH.on) despawnBody(false);
}
function reward(m) {
  if (!(m.g > 0)) { if (m.cap) toast('오늘 레이드 보상은 모두 받았어요'); return; }
  const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  save.raid.wins = (save.raid.wins | 0) + 1; save.raid.day = day;
  addCoins(m.g | 0); // 서버는 이 몫을 번 몫(#144)에 넣어 둠
  if (bfx) { state.slowMo = 1.2; state.slowK = 0.35; bfx.burst(player.pos.x, player.pos.y + 1.2, player.pos.z, { petals: lite() ? 30 : 100, sparks: lite() ? 12 : 50, up: 6, spread: 1.4, color: '#ffb030' }); }
  late.sound?.fanfare?.();
  const top = Array.isArray(m.top) ? m.top.slice(0, R.top).map((s, i) => `${i + 1}. ${String(s).slice(0, 16)}`).join('  ') : '';
  say('quest', 'raidWon', `${R.name}를 물리쳤어요! 귤 ${m.g}${m.box ? ' (오늘 첫 상자 포함)' : ''}${top ? ' · ' + top : ''}`, 5, { ttl: 10 });
  if (save.raid.wins === R.vest) toast(`레이드 ${R.vest}번 성공! '대왕 잡은 조끼' 자격을 얻었어요`);
  persist();
}

/* ---------- 화면 위 줄 ---------- */
let barKey = '';
function tickBar() {
  const el = $('raid-bar'); if (!el) return;
  const near = distC(player.pos) < R.r + 25, t = srvNow();
  let on = false, txt = '', f = -1;
  if (S.ph === PH.soon) { on = true; const s = Math.max(0, Math.ceil((S.at - t) / 1000)); txt = `${R.name} · ${s >= 60 ? Math.ceil(s / 60) + '분 뒤' : s + '초 뒤'} 굼부리`; }
  else if (S.ph === PH.on && near) { on = true; f = S.hp / S.max; txt = `${R.name}${S.n > 1 ? ` · ${S.n}명` : ''} · ${Math.max(0, Math.ceil((S.end - t) / 1000))}초`; }
  else if (S.ph === PH.broke && near) { on = true; const left = (S.h || []).reduce((a, v) => a + Math.max(0, v), 0); f = left / (R.heaps * R.heapN); txt = `더미 줍기 · 남은 ${left} · ${Math.max(0, Math.ceil((S.broke - t) / 1000))}초`; }
  on = on && !panelOpen() && !late.tut?.active && !state.cine;
  if (el.hidden === on) el.hidden = !on;
  if (!on) return;
  const k = txt + '|' + (f < 0 ? '' : f.toFixed(3));
  if (k === barKey) return; barKey = k;
  $('raid-name').textContent = txt; $('raid-track').hidden = f < 0; if (f >= 0) $('raid-fill').style.width = (Math.max(0, f) * 100).toFixed(1) + '%';
  el.classList.toggle('ph1', S.ph === PH.on && f < R.phase); el.classList.toggle('pick', S.ph === PH.broke);
}

/* ---------- 지도 표시 (field.js drawIcons 가 부름) ---------- */
late.raidIcons = (x, uv, s, inC) => {
  if (!RON || S.ph < PH.soon || S.ph > PH.broke) return;
  const [u, v] = uv(C.x, C.z); if (!inC(u, v)) return;
  x.fillStyle = S.ph === PH.soon ? '#ffb030' : '#ff4a3a'; x.strokeStyle = '#fff'; x.lineWidth = Math.max(1, s / 7);
  x.beginPath(); x.arc(u, v, s * 0.55, 0, Math.PI * 2); x.fill(); x.stroke();
  x.fillStyle = '#fff'; x.beginPath(); x.arc(u - s * 0.18, v - s * 0.08, s * 0.1, 0, 7); x.arc(u + s * 0.18, v - s * 0.08, s * 0.1, 0, 7); x.fill();
};

/* ---------- 매 프레임 ---------- */
late.tickRaid = (dt) => {
  if (!RON) return;
  if (!live) local.tick();
  flush(dt);
  const near = distC(player.pos) < R.r + 70;
  if (S.ph === PH.on && near && state.sessionOn && !late.tut?.active) spawnBody(); else if (body && (S.ph !== PH.on || !near)) despawnBody(false);
  if (S.ph === PH.broke && distC(player.pos) < R.r + 100) showHeaps(true); else if (S.ph !== PH.broke) showHeaps(false);
  heapMs.forEach((h, i) => { const n = S.h ? S.h[i] | 0 : 0; h.m.visible = n > 0; h.m.scale.setScalar(0.35 + 0.45 * n / R.heapN); });
  if (body) {
    if (!life.enemies.list.includes(body.e)) body = null;
    else {
      syncHp(); tickAct(dt);
      if (isHost() && live && (body.sendT -= dt * 1000 / R.netMs) <= 0) { body.sendT = 1; sendRs(true); }
      if (distC(player.pos) < R.r) state.tension = Math.max(state.tension || 0, 0.8);
    }
  }
  tickBar();
};
late.raidFight = () => !!body && S.ph === PH.on && distC(player.pos) < R.r; // 들판 떼(#173)는 레이드 동안 쉼
late.raidNet = {
  link(r) {
    if (!r.on || !RON) return; room = r;
    r.on('hi', (m) => { live = true; if (Number.isFinite(m.now)) S.off = m.now - Date.now(); if (m.raid) onMsg(m.raid); setMode(); });
    r.on('host', () => setMode());
    r.on('close', () => { live = false; setMode(); });
    r.on('rv', onMsg); r.on('rs', onMsg); r.on('rw', onMsg);
  },
};

/* ---------- 확인용 (window.__oreum.raid) ---------- */
// start(force): 바로 열기 (5초 뒤 시작. 서버는 STATS_OPEN 방·어드민만, force 는 남은 레이드도 지움 #245) · state() · go(): 굼부리 가운데로 · hit(d): 내가 맞힌 것처럼 · heaps(): 더미 자리
late.raidApi = RON ? {
  start(force) { tx(force ? { t: 'rgo', f: 1 } : { t: 'rgo' }); return true; },
  state: () => ({ ...S, h: S.h && S.h.slice(), live, host: isHost(), body: !!body, act: body?.act?.k || null, x: body && +body.e.pos.x.toFixed(1), z: body && +body.e.pos.z.toFixed(1), puppet: !!body?.e.puppet, heaps: heapMs.length, wins: save.raid.wins }),
  go(d = 14) { const x = C.x + d, z = C.z; player.pos.set(x, height(x, z), z); player.heading = -Math.PI / 2; late.placeRunner?.(); return { x: +x.toFixed(1), z: +z.toFixed(1) }; },
  center: () => ({ ...C, r: R.r }),
  hit(d = 100) { if (body) life.enemies.hurt(body.e, d, true); else hitAcc += d; return S.hp; },
  pick: (i) => { tx({ t: 'rp', i }); return true; }, // 걸어가지 않고 더미 i 에서 하나 (멀티 확인용)
  heaps: () => heapMs.map((h, i) => ({ x: +h.x.toFixed(1), z: +h.z.toFixed(1), n: S.h ? S.h[i] : 0 })),
  local: () => local && { ph: local.ph, hp: local.hp, max: local.max },
} : null;
