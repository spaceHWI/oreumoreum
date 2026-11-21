// 동굴 탐험 (#195) 2번 조각: 외계 쓰레기 더미 줍기 · 들고 나오기 · 동굴 적(박쥐·눈먼 게) · 층 지킴이
// - 더미: 줄 방 빼고 방마다 CAVE.junk.perRoom 개(곁방은 pocket 개). 오늘 날짜·층 씨앗으로 같은 자리. 주운 양은 save.cave.taken(그날 그 판만)에 남아 새로고침해도 다시 차지 않음. 새 판(save.cave.runs, 3번 조각)이면 다시 참
//   주운 쓰레기는 보통 배낭(trash.store.bag)에 그 종류(CAVE.junk.kinds[].as)로 들어가고, 구역 5 의 2배 귤 중 종류 귤을 뺀 나머지는 bag.xv 에 얹음 → 클린하우스에서 보통처럼 버림
//   동굴 안엔 클린하우스가 없으니 '들고 나와야' 귤이 됨. 지금 동굴에서 든 몫은 save.cave.held, 나오면 save.cave.out(누적)에 더함 → 서버(earn.js 8)가 그 몫을 인정
//   쓰러지면 든 동굴 쓰레기의 CAVE.junk.lose 를 잃음 (오름에서 든 쓰레기는 그대로). 동굴 안에서 새로고침하면 쓰러진 것으로 봄
// - 적: 방에 들어서면(CAVE.mobs.wake) 그 방 몫이 나옴. life.enemies 의 보통 적(조짐·쉬는 시간 #148·#149, 무리 #146)이고 벽은 spots.inBounds 를 감싸 막음
// - 지킴이: 구멍 방(맨 아래 층은 주인 방 앞 방)에 정예 하나. 쫓아내야 구멍이 열림. 싸움이 풀리면 쉬며 기운이 참 (#183 restRegen)
// - 그리기: 적·귤·무기 효과는 오름 장면(life.group 등)에 있어서, 동굴 안에서는 그 묶음을 동굴 장면으로 옮겨 그림(caveIn/caveOut). 멀리 있는 것은 그리는 동안만 숨김(caveDraw)
// dev: __oreum.cave (junk·goPile·pickAll·held·mobs·guard·wakeAll·down2)
import * as THREE from 'three';
import { CAVE, TRASH_TYPES } from '../balance.js';
import { rng } from '../cavegen.js';
import { kstDate } from '../daily.js';
import { restRegen } from '../enemies.js';
import { state, late } from './state.js';
import { save, persist } from './save.js';
import { scene, spots } from './scene.js';
import { player, hp, trash, life } from './place.js';
import { toast, pickMsg } from './hud.js';
import { setTarget, marker } from './input.js';
import { toolNow, bagRoom, updateTrashUI, pickS } from './pickup.js';
import { aimMark, aimTri } from './throw.js';
import { armFx } from './arms.js';

const J = CAVE.junk, MB = CAVE.mobs, L2 = CAVE.lines2;
const TT = Object.fromEntries(TRASH_TYPES.map((t) => [t.id, t]));
const KV = J.kinds.map((k) => { const t = TT[k.as], g = t.vol * J.perVol; return { ...k, vol: t.vol, g, xv: g - t.gyul }; }); // 하나의 귤·부피
const irange = (R, [a, b]) => a + Math.floor(R() * (b - a + 1));
const AGGRO = new Set(['charge', 'wind', 'dash', 'back', 'stagger']);

// ---------- 저장 ----------
function cv() {
  const c = (save.cave && typeof save.cave === 'object') ? save.cave : (save.cave = {});
  c.out = Math.max(0, Number(c.out) || 0);
  if (!c.held || typeof c.held !== 'object') c.held = {};
  const h = c.held; h.g = Math.max(0, Number(h.g) || 0); h.xv = Math.max(0, Number(h.xv) || 0); if (!h.k || typeof h.k !== 'object') h.k = {};
  if (!c.runs || typeof c.runs !== 'object' || c.runs.d !== kstDate()) c.runs = { d: kstDate(), n: 0 }; /* 오늘 판 수 (3번 조각) */
  c.runs.n = Math.max(0, Math.floor(Number(c.runs.n)) || 0);
  if (!c.taken || typeof c.taken !== 'object' || c.taken.d !== kstDate() || (c.taken.r ?? c.runs.n) !== c.runs.n) c.taken = { d: kstDate(), r: c.runs.n, p: {} };
  return c;
}
const heldN = () => Object.values(cv().held.k).reduce((s, n) => s + (Number(n) || 0), 0);
// 든 동굴 쓰레기 가운데 k 비율을 배낭에서 뺌. 뺀 귤 몫을 돌려줌
function loseHeld(k) {
  const c = cv(), h = c.held, bag = trash?.store.bag; if (!bag || !h.g) return 0;
  let lostG = 0; const want = h.g * k, big = [...KV].sort((a, b) => b.g - a.g), K = Number(h.K) || 1;
  for (let go = true; go;) { go = false; for (const kv of big) { const have = Math.floor(Number(h.k[kv.as]) || 0), g = kv.g * K; if (have > 0 && (bag[kv.as] || 0) > 0 && lostG + g <= want + g * 0.5) { bag[kv.as]--; h.k[kv.as] = have - 1; lostG += g; go = true; break; } } } /* 비싼 것부터 하나씩, 목표(든 몫 × k)에 가장 가깝게. K: 절반 판이면 하나 값도 절반 */
  const lostX = h.g > 0 ? h.xv * Math.min(1, lostG / h.g) : 0;
  bag.xv = Math.max(0, (bag.xv || 0) - lostX); h.xv = Math.max(0, h.xv - lostX); h.g = Math.max(0, h.g - lostG);
  trash.store.commit(); return lostG;
}
// 들고 나옴: 든 몫을 out 에 더하고 비움
function carryOut() { const c = cv(), g = Math.round(c.held.g); if (g > 0) c.out += g; c.held = { g: 0, xv: 0, k: {} }; persist(); return g; }
// 이번 판 쓰레기 귤 배수: 오늘 온전한 판(CAVE.runs.full)을 넘으면 halfK
const runK = () => (cv().runs.n > CAVE.runs.full ? CAVE.runs.halfK : 1);

// ---------- 층: 더미 ----------
const canGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.4, 7), partGeo = (() => { const g = new THREE.BoxGeometry(0.46, 0.22, 0.32); return g; })();
const canMat = new THREE.MeshBasicMaterial({ color: '#ffffff' }), partMat = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true });
const CL = { cs: null, F: null, fi: 0, piles: [], ims: [], mobs: [], rooms: [], guard: null, guardDone: false, guardRoom: -1, pk: null, hidden: [], borrowed: [], packN: 0 };
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3(), col = new THREE.Color(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
function walkNear(F, x, z) {
  if (F.walk(x, z)) return [x, z];
  for (let r = 0.5; r < 6; r += 0.5) for (let a = 0; a < 6.28; a += 0.6) { const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (F.walk(px, pz)) return [px, pz]; }
  return null;
}
function clearFloor() {
  for (const e of CL.mobs) if (life.enemies.list.includes(e)) life.enemies.remove(e);
  CL.mobs = []; CL.guard = null; CL.pk = null;
  for (const im of CL.ims) { CL.cs?.remove(im); im.dispose(); }
  CL.ims = []; CL.piles = []; CL.rooms = []; CL.F = null;
}
function buildFloor(F, fi) {
  clearFloor(); CL.F = F; CL.fi = fi; CL.guardDone = false;
  const R = rng((F.seed ^ 0x2c1b3c6d) >>> 0), c = cv(), piles = [];
  F.rooms.forEach((o, ri) => {
    if (ri === 0) return;
    const n = o.kind === 'pocket' ? J.pocket : irange(R, J.perRoom), w = F.world(o);
    for (let k = 0; k < n; k++) {
      const a = R() * Math.PI * 2, d = o.r * (0.2 + R() * 0.4), at = walkNear(F, w.x + Math.cos(a) * d, w.z + Math.sin(a) * d); if (!at) continue;
      const id = `${fi}:${ri}:${k}`, full = irange(R, J.n), items = []; for (let i = 0; i < full; i++) items.push(R() < KV[0].p ? 0 : 1);
      const left = c.taken.p[id] != null ? Math.max(0, Math.min(full, c.taken.p[id])) : full;
      piles.push({ id, x: at[0], z: at[1], y: F.floorY(at[0], at[1]), room: ri, items, n: left, slot: [] });
    }
  });
  // 모양: 종류마다 InstancedMesh 하나 (빛나는 캔은 스스로 빛나 어둠에서도 보임)
  const cnt = [0, 0]; piles.forEach((p) => p.items.forEach((t) => cnt[t]++));
  const ims = [new THREE.InstancedMesh(canGeo, canMat, Math.max(1, cnt[0])), new THREE.InstancedMesh(partGeo, partMat, Math.max(1, cnt[1]))];
  const at = [0, 0];
  for (const p of piles) p.items.forEach((t, i) => {
    const a = i * 2.4 + p.x, r = 0.15 + Math.sqrt(i / p.items.length) * J.r * 0.85, y = p.y + 0.12 + (p.items.length - i) * 0.035;
    pv.set(p.x + Math.cos(a) * r, y, p.z + Math.sin(a) * r); q.setFromEuler(new THREE.Euler(t ? 0.3 * Math.sin(i) : Math.PI / 2 * (i % 2), a, 0.4 * Math.cos(i * 1.7))); sv.setScalar(0.85 + (i % 3) * 0.12);
    const k = at[t]++; p.slot.push([t, k]); m4.compose(pv, q, sv); ims[t].setMatrixAt(k, i < p.n ? m4 : ZERO);
    ims[t].setColorAt(k, t ? col.set(i % 3 ? '#8c96a3' : '#b8a46a') : col.set(i % 3 ? '#5cffc8' : '#b6ff5a'));
  });
  ims.forEach((im, t) => { im.count = cnt[t]; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); CL.cs.add(im); });
  CL.ims = ims; CL.piles = piles;
  // 적이 나올 방 (줄 방 빼고). 지킴이 방: 구멍 방, 맨 아래 층은 주인 방 앞(줄에서 두 번째로 먼 큰 방)
  const st = F.world(F.rooms[0]), dist = (o) => { const w = F.world(o); return Math.hypot(w.x - st.x, w.z - st.z); };
  const main = F.rooms.map((o, i) => ({ o, i })).filter(({ o, i }) => i > 0 && o.kind !== 'pocket').sort((a, b) => dist(b.o) - dist(a.o));
  CL.guardRoom = (fi < CAVE.floors - 1 ? main[0] : main[1] || main[0])?.i ?? -1;
  CL.rooms = F.rooms.map((o, i) => ({ i, o, w: F.world(o), woke: i === 0 }));
}

// ---------- 층: 적 ----------
function spawnIn(room, kind, n, over = null, k = 1) {
  const F = CL.F, R = Math.random, pk = 900000 + (++CL.packN), got = [];
  for (let j = 0; j < n; j++) {
    for (let t = 0; t < 12; t++) {
      const a = R() * Math.PI * 2, d = room.o.r * (0.25 + R() * 0.45), at = walkNear(F, room.w.x + Math.cos(a) * d, room.w.z + Math.sin(a) * d);
      if (!at || Math.hypot(at[0] - player.pos.x, at[1] - player.pos.z) < 5) continue;
      const e = life.enemies.spawnStory(kind, at[0], at[1], { id: 'cave', pack: pk, k, over: over || undefined }); e.cave = true; CL.mobs.push(e); got.push(e); break;
    }
  }
  return got;
}
function wake(room) {
  room.woke = true;
  const R = Math.random, pocket = room.o.kind === 'pocket';
  if (room.i === CL.guardRoom) {
    const G = MB.guard, [e] = spawnIn(room, G.kind, 1, { name: G.name, hp: G.hp, dmg: G.dmg, walk: G.walk, reward: { gyul: G.gyul, rare: 0.25 }, life: 1e9 }, G.k);
    if (e) { e.guard = true; e.home = new THREE.Vector3(e.pos.x, 0, e.pos.z); CL.guard = e; }
  }
  if (!pocket) spawnIn(room, 'bat', irange(R, MB.bats));
  const nc = pocket ? 1 : irange(R, MB.crabs); if (nc) spawnIn(room, 'crab', nc);
}
function tickMobs(dt) {
  for (const r of CL.rooms) if (!r.woke && Math.hypot(player.pos.x - r.w.x, player.pos.z - r.w.z) < r.o.r + MB.wake) wake(r);
  CL.mobs = CL.mobs.filter((e) => life.enemies.list.includes(e));
  const g = CL.guard;
  if (g && !CL.guardDone) {
    const gone = !life.enemies.list.includes(g) || g.state === 'flee';
    if (gone) { CL.guardDone = true; if (!(hp.isDown || hp.pending)) toast(L2.guardGone, 3.2); late.ach?.emit?.('cave-guard'); }
    else {
      if (AGGRO.has(g.state)) g.calmT = 0; else restRegen(g, dt, g.def.hp); // #183: 싸움이 풀리면 쉬며 기운이 참
      if (g.state === 'wander' && Math.hypot(g.pos.x - g.home.x, g.pos.z - g.home.z) > 7) g.heading = Math.atan2(g.home.x - g.pos.x, g.home.z - g.pos.z); // 구멍 둘레를 지킴
    }
  }
}

// ---------- 줍기 ----------
const nextKind = (p) => KV[p.items[p.n - 1]];
function nearestPile(maxD) { let best = null, bd = maxD; for (const p of CL.piles) { if (p.n <= 0) continue; const d = Math.hypot(p.x - player.pos.x, p.z - player.pos.z); if (d < bd) { bd = d; best = p; } } return best && { p: best, d: bd }; }
const pickBlocked = () => !state.cave || hp.isDown || hp.pending || player.knock || player.air || state.cine;
export function cavePick() {
  if (pickBlocked() || CL.pk) return;
  const tool = toolNow(), n = nearestPile(J.walkR);
  if (!n) { toast(L2.none); return; }
  if (bagRoom() < nextKind(n.p).vol) { toast(L2.full); late.sound?.full?.(); return; }
  const reach = tool.r + J.r + 0.3;
  if (n.d <= reach) { startPick(n.p); return; }
  const a = Math.atan2(player.pos.x - n.p.x, player.pos.z - n.p.z), d = J.r + Math.min(tool.r, 1.2) * 0.6;
  setTarget(new THREE.Vector3(n.p.x + Math.sin(a) * d, n.p.y, n.p.z + Math.cos(a) * d), () => cavePick()); marker.visible = false;
}
function startPick(p) {
  player.target = null; player.onArrive = null; player.speed = 0;
  player.heading = Math.atan2(p.x - player.pos.x, p.z - player.pos.z) || player.heading;
  player.pose = 'crouch'; player.poseT = 0;
  CL.pk = { p, t: toolNow().time, x: player.pos.x, z: player.pos.z };
}
function takeFrom(p) {
  const c = cv(), bag = trash.store.bag, tool = toolNow(); let n = 0;
  while (n < tool.per && p.n > 0) {
    const kv = nextKind(p); if (bagRoom() < kv.vol) break;
    p.n--; const [t, k] = p.slot[p.n]; CL.ims[t].setMatrixAt(k, ZERO); CL.ims[t].instanceMatrix.needsUpdate = true;
    const K = runK(), g = Math.round(kv.g * K), xv = Math.max(0, g - (kv.g - kv.xv)); /* 절반 판이면 귤도 절반 (종류 귤은 그대로, 나머지 xv 를 줄임) */
    bag[kv.as] = (bag[kv.as] || 0) + 1; bag.xv = (bag.xv || 0) + xv;
    c.held.k[kv.as] = (Number(c.held.k[kv.as]) || 0) + 1; c.held.g += g; c.held.xv += xv; c.held.K = K;
    pickMsg(kv.name); late.sound?.pick?.(kv.as); n++;
  }
  if (n) { c.taken.p[p.id] = p.n; trash.store.commit(); persist(); updateTrashUI(true); late.ach?.emit?.('cave-pick', n); }
  return n;
}
function tickPick(dt) {
  const k = CL.pk; if (!k) return;
  if (pickBlocked() || player.target || Math.hypot(player.pos.x - k.x, player.pos.z - k.z) > 0.6) { CL.pk = null; return; }
  if ((k.t -= dt) > 0) return;
  CL.pk = null; takeFrom(k.p);
  if (k.p.n > 0 && bagRoom() < nextKind(k.p).vol) { toast(L2.full); late.sound?.full?.(); return; }
  if (pickS.held) { if (k.p.n > 0) startPick(k.p); else cavePick(); }
}

// ---------- 장면 옮기기 ----------
const borrowList = () => [life.group, armFx.group, aimMark, aimTri, late.lootGroup].filter(Boolean); /* 전리품(#140)도: 동굴 상자·주인 (3번 조각) */
function caveIn(cs) { const c = cv(); c.runs.n++; persist(); /* 오름에서 들어올 때마다 한 판 (3번 조각) */
  CL.cs = cs; CL.borrowed = borrowList(); for (const o of CL.borrowed) cs.add(o); }
function caveOut(downed) {
  let lost = 0;
  if (downed && cv().held.g > 0) lost = loseHeld(J.lose);
  const g = carryOut();
  if (lost > 0) setTimeout(() => toast(L2.lost, 3.4), 900);
  else if (g > 0) setTimeout(() => toast(L2.carry, 3.4), 900);
  clearFloor();
  for (const o of CL.borrowed) scene.add(o);
  CL.borrowed = [];
  if (g > 0 || lost > 0) updateTrashUI(true);
}
// 그리는 동안만 멀리 있는 오름 것(노루·까마귀·오름 적)을 숨김 (draw call 아끼기)
function caveDraw(on) {
  if (on) { const g = life.group, px = player.pos.x, pz = player.pos.z; for (const o of g.children) if (o.visible && Math.abs(o.position.x - px) + Math.abs(o.position.z - pz) > 60) { o.visible = false; CL.hidden.push(o); } }
  else { for (const o of CL.hidden) o.visible = true; CL.hidden.length = 0; }
}
function caveTick(dt) { tickMobs(dt); tickPick(dt); }

// 벽: 동굴 칸 안에서는 걸을 수 있는 칸만 (적 움직임 spots.inBounds)
{ const ib = spots.inBounds; spots.inBounds = function (x, z) { const c = state.cave; if (c && c.F.inside(x, z)) return c.F.walk(x, z); return ib.call(this, x, z); }; }

// 동굴 안에서 새로고침함: 쓰러진 것으로 보고 절반을 잃은 뒤 들고 나온 것으로
if (cv().held.g > 0 && trash) { loseHeld(J.lose); carryOut(); setTimeout(() => toast(L2.lostLoad, 3.6), 4000); }

Object.assign(late, { caveCanPick: () => !!CL.pk || !!nearestPile(J.walkR), caveIn, caveOut, caveFloor: buildFloor, caveFloorOff: clearFloor, caveTick, caveDraw, cavePick, caveGuard: () => !!state.cave && CL.fi < CAVE.floors - 1 && !CL.guardDone, caveSave: cv, caveRunK: runK, caveFloorNow: () => CL });

// ---------- 확인용 (__oreum.cave 에 더함) ----------
Object.assign(late.caveApi || (late.caveApi = {}), {
  junk: () => ({ perVol: J.perVol, kinds: KV.map(({ id, as, vol, g, xv }) => ({ id, as, vol, g, xv })), piles: CL.piles.map((p) => ({ id: p.id, n: p.n, of: p.items.length, x: +p.x.toFixed(1), z: +p.z.toFixed(1) })) }),
  goPile: (i = 0) => { const p = CL.piles.filter((o) => o.n > 0)[i]; if (!p) return null; player.pos.set(p.x + 1.2, p.y, p.z); player.visY = p.y; player.heading = Math.atan2(-1.2, 0); return p.id; },
  pick: () => cavePick(), picking: () => !!CL.pk,
  pickAll: () => { let n = 0; for (const p of CL.piles) while (p.n > 0) { const k = takeFrom(p); if (!k) return n; n += k; } return n; },
  held: () => { const c = cv(); return { held: { ...c.held, k: { ...c.held.k } }, n: heldN(), out: c.out, bag: { ...trash.store.bag }, room: bagRoom() }; },
  mobs: () => CL.mobs.map((e) => ({ kind: e.kind, state: e.state, hp: Math.round(e.hp), guard: !!e.guard, x: +e.pos.x.toFixed(1), z: +e.pos.z.toFixed(1), walk: CL.F ? CL.F.walk(e.pos.x, e.pos.z) : null })),
  guard: () => ({ room: CL.guardRoom, e: CL.guard && { hp: Math.round(CL.guard.hp), max: CL.guard.def.hp, state: CL.guard.state }, done: CL.guardDone, blocks: late.caveGuard() }),
  wakeAll: () => { for (const r of CL.rooms) if (!r.woke) wake(r); return CL.mobs.length; },
  hurtGuard: (k = 0.5) => { const g = CL.guard; if (!g) return null; g.hp = Math.max(1, g.hp - g.def.hp * k); g.calmT = 0; return Math.round(g.hp); },
  repelGuard: () => { const g = CL.guard; if (!g) return false; life.enemies.hurt(g, g.hp + 1, true); return true; },
  goGuard: () => { const r = CL.rooms[CL.guardRoom]; if (!r) return null; const at = walkNear(CL.F, r.w.x, r.w.z); player.pos.set(at[0], CL.F.floorY(at[0], at[1]), at[1]); player.visY = player.pos.y; return true; },
});
