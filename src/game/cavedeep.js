// 동굴 탐험 (#195) 3번 조각: 하루 판 수 · 함정(무너지는 바닥·낙석·좁은 물길) · 길 찾기(발광 이끼 화살표) · 숨은 방 상자 · 동굴의 주인
// - 판: 오름에서 동굴로 들어갈 때마다 한 판(cavelife.js caveIn 이 save.cave.runs 를 셈). 오늘 CAVE.runs.full 판을 넘으면 동굴 쓰레기 귤 절반(cavelife.js runK)
//   더미는 판마다 다시 참. 상자(층마다)·주인 큰 보상은 하루 한 번(save.cave.chest·save.cave.boss). 서버 earn.js 8) 이 하루 몫·상자·주인을 따로 셈
// - 함정: 층을 만들 때(caveFloor) 같은 씨앗으로 자리를 정함
//   무너지는 바닥 = 방 사이 통로 가운데 금 간 자리. 밟으면 CAVE.trap.crumble.warn 초 금이 번지다 무너짐 → 안에 있으면 피해, 들어오기 전 자리로. down 초 동안 구멍(못 지나감)
//   낙석 = 줄 방 빼고 방 안에 있으면 every 초마다 플레이어 둘레에 그림자 → warn 초 뒤 돌이 떨어짐 (주인 방은 주인이 더 자주·크게)
//   좁은 물길 = 곁방(숨은 방)으로 가는 통로를 가로지름(p 확률). 테왁 배낭(#164 float)이면 헤엄쳐 건넘, 아니면 못 건넘
// - 길 찾기: 줄 방 → 구멍(맨 아래 층은 주인 방) 길의 방마다 나가는 통로 입구에 발광 이끼 화살표, 곁방 갈림길에는 큰길 쪽 화살표
// - 상자: 곁방에 하나. 귤 CAVE.chest.gyul[층] + 재료·장비(#140 dropLoot 'treasure', 높은 구역)
// - 동굴의 주인: 맨 아래 주인 방에 들어서면 깨어남(ENEMIES.robot 을 k 배). 낙석 비·기운이 줄면 드론 부르기. 싸움이 풀리면 쉬며 기운이 참(#183)
//   화면 위 이름·기운 줄은 우두머리 줄(#boss-bar)을 빌려 씀. 쫓아내면 그날 처음 한 번만 큰 보상
// dev: __oreum.cave (deep·runs·traps·goChest·openChest·goOwner·owner·repelOwner·crumbleHere·rockHere·goWater)
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CAVE, BACK_LOOKS } from '../balance.js';
import { rng } from '../cavegen.js';
import { kstDate } from '../daily.js';
import { restRegen } from '../enemies.js';
import { state, late } from './state.js';
import { $, save, persist } from './save.js';
import { spots } from './scene.js';
import { player, hp, life } from './place.js';
import { toast } from './hud.js';
import { interactables } from './stores.js';
import { dropLoot } from './loot.js';

const T = CAVE.trap, CH = CAVE.chest, OW = CAVE.owner, L3 = CAVE.lines3;
const irange = (R, [a, b]) => a + Math.floor(R() * (b - a + 1));
const frange = (R, [a, b]) => a + R() * (b - a);
const AGGRO = new Set(['charge', 'wind', 'dash', 'back', 'stagger']);
const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...o });
const basic = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, ...o });
const cv = () => late.caveSave();
const today = () => kstDate();

// ---------- 저장: 상자·주인 ----------
function chestRec() { const c = cv(); if (!c.chest || typeof c.chest !== 'object' || c.chest.d !== today() || !Array.isArray(c.chest.got)) c.chest = { d: today(), got: [] }; return c.chest; }
const chestGot = (id) => chestRec().got.includes(id);
const ownerGot = () => cv().boss === today();
const floats = () => BACK_LOOKS.some((b) => b.float && save.backs?.cur === b.id && !!save.backs?.own?.[b.id] && (save.equip?.bag || 0) >= b.need);

// ---------- 층 ----------
const D = { cs: null, g: null, F: null, fi: 0, crumble: [], water: [], arrows: 0, chest: null, owner: null, ownerRoom: null, calls: [], rocks: [], rockT: 6, rainT: 5, safe: new THREE.Vector3(), msgT: 0, swimSaid: false, ownerSeen: false, barOn: false };
const chestPos = new THREE.Vector3(1e9, 0, 1e9);
const geoms = [], mats = [];
const keep = (x) => { if (x.isBufferGeometry) geoms.push(x); else mats.push(x); return x; };
function disposeAll() {
  for (const e of D.calls) if (life.enemies.list.includes(e)) life.enemies.remove(e);
  if (D.owner && life.enemies.list.includes(D.owner)) life.enemies.remove(D.owner);
  D.g?.remove(...rockIM); rockIM.forEach((im) => { im.count = 0; });
  if (D.g) D.cs?.remove(D.g);
  geoms.forEach((x) => x.dispose()); mats.forEach((x) => x.dispose()); geoms.length = 0; mats.length = 0;
  Object.assign(D, { g: null, F: null, crumble: [], water: [], arrows: 0, chest: null, owner: null, ownerRoom: null, calls: [], rocks: [], ownerSeen: false });
  chestPos.set(1e9, 0, 1e9); bossBar(false);
}
function walkNear(F, x, z, max = 6) {
  if (F.walk(x, z)) return [x, z];
  for (let r = 0.4; r < max; r += 0.4) for (let a = 0; a < 6.28; a += 0.5) { const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (F.walk(px, pz)) return [px, pz]; }
  return null;
}
// 방 그래프에서 줄 방(0) → 가장 먼 방 길 (방 번호 목록)
function mainPath(F) {
  const far = F.rooms.findIndex((o) => o.kind === 'down' || o.kind === 'boss'); if (far < 0) return [0];
  const prev = new Map([[0, -1]]), q = [0];
  while (q.length) { const a = q.shift(); if (a === far) break; for (const [x, y] of F.edges) { const b = x === a ? y : y === a ? x : -1; if (b >= 0 && !prev.has(b)) { prev.set(b, a); q.push(b); } } }
  const out = []; for (let k = far; k >= 0; k = prev.get(k)) out.unshift(k);
  return out[0] === 0 ? out : [0];
}
const corrOf = (F, a, b) => F.corr.find((c) => (c.a === a && c.b === b) || (c.a === b && c.b === a));
// 통로 점(방 좌표) → 세계 좌표, a 쪽에서 b 쪽으로 늘어놓음
const ptsFrom = (F, c, a) => (c.a === a ? c.pts : c.pts.slice().reverse()).map(([x, z]) => [F.ox + x, F.oz + z]);

function buildDeep(F, fi) {
  disposeAll(); D.F = F; D.fi = fi;
  const R = rng((F.seed ^ 0x7f4a7c15) >>> 0), g = new THREE.Group(); g.name = 'cave-deep-' + fi; D.g = g; D.cs.add(g);
  const path = mainPath(F), onPath = new Set(path);
  // 발광 이끼 화살표: 길의 방마다 다음 통로 입구 + 곁방 갈림길
  const arrows = [];
  for (let k = 0; k < path.length - 1; k++) {
    const c = corrOf(F, path[k], path[k + 1]); if (!c) continue;
    const P = ptsFrom(F, c, path[k]), A = F.world(F.rooms[path[k]]), rr = F.rooms[path[k]].r * 0.8;
    const i = P.findIndex(([x, z]) => Math.hypot(x - A.x, z - A.z) > rr); if (i < 0 || i >= P.length - 1) continue;
    arrows.push([P[i][0], P[i][1], Math.atan2(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1])]);
  }
  for (const c of F.corr) {
    if (c.a !== -1) continue;
    const [px, pz] = c.pts[0], host = F.corr.find((h) => h.a >= 0 && h.pts.some(([x, z]) => x === px && z === pz)); if (!host || !onPath.has(host.a) || !onPath.has(host.b)) continue;
    const from = path.indexOf(host.a) < path.indexOf(host.b) ? host.a : host.b, P = ptsFrom(F, host, from), i = P.findIndex(([x, z]) => Math.abs(x - (F.ox + px)) < 1e-6 && Math.abs(z - (F.oz + pz)) < 1e-6);
    if (i >= 0 && i < P.length - 1) { const x = P[i][0] + (P[i + 1][0] - P[i][0]) * 0.6, z = P[i][1] + (P[i + 1][1] - P[i][1]) * 0.6; arrows.push([x, z, Math.atan2(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1])]); }
  }
  if (arrows.length) {
    const s = T.arrow.s, ag = keep(new THREE.BufferGeometry());
    ag.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.6 * s, -0.55 * s, 0, -0.1 * s, -0.3 * s, 0, -0.35 * s, 0, 0, 0.6 * s, -0.3 * s, 0, -0.35 * s, 0, 0, 0.18 * s, 0, 0, 0.6 * s, 0, 0, 0.18 * s, 0.3 * s, 0, -0.35 * s, 0, 0, 0.6 * s, 0.3 * s, 0, -0.35 * s, 0.55 * s, 0, -0.1 * s], 3));
    const im = new THREE.InstancedMesh(ag, keep(basic('#7cf05a', { side: THREE.DoubleSide, fog: false, transparent: true, opacity: 0.85 })), arrows.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    arrows.forEach(([x, z, a], i) => { m4.compose(new THREE.Vector3(x, F.floorY(x, z) + 0.07, z), q.setFromEuler(new THREE.Euler(0, a, 0)), new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i, m4); });
    im.computeBoundingSphere(); g.add(im); D.arrows = arrows.length;
  }
  // 무너지는 바닥: 방 사이 통로 가운데 (줄 방에서 이어지는 통로 첫 것은 뺌: 들어오자마자 막히지 않게)
  const cands = F.corr.filter((c) => c.a >= 0 && c.pts.length >= 6 && !(c.a === 0 && path[1] === c.b));
  const want = Math.min(cands.length, irange(R, T.crumble.n)), crackGeo = keep(new THREE.CircleGeometry(T.crumble.r, 12)), pitGeo = keep(new THREE.CircleGeometry(T.crumble.r * 0.92, 12));
  for (let k = 0; k < want; k++) {
    const c = cands.splice(Math.floor(R() * cands.length), 1)[0], P = c.pts[Math.floor(c.pts.length / 2)], x = F.ox + P[0], z = F.oz + P[1], y = F.floorY(x, z);
    const o = new THREE.Group(); o.position.set(x, y + 0.04, z);
    const crack = new THREE.Mesh(crackGeo, keep(basic('#2a221c', { transparent: true, opacity: 0.85, depthWrite: false }))); crack.rotation.x = -Math.PI / 2; o.add(crack);
    const lines = new THREE.Group(); o.add(lines);
    { const gs = []; for (let j = 0; j < 5; j++) { const q = new THREE.PlaneGeometry(0.06, T.crumble.r * (0.6 + R() * 0.5)); q.rotateZ(j * 1.26 + R()); gs.push(q); } /* 금 다섯 줄을 한 번에 그림 (#218) */
      const l = new THREE.Mesh(keep(mergeGeometries(gs)), keep(basic('#c86a2a', { transparent: true, opacity: 0.35, depthWrite: false }))); gs.forEach((q) => q.dispose()); l.rotation.x = -Math.PI / 2; l.position.y = 0.01; lines.add(l); }
    const pit = new THREE.Mesh(pitGeo, keep(basic('#000000', { fog: false }))); pit.rotation.x = -Math.PI / 2; pit.position.y = 0.02; pit.visible = false; o.add(pit);
    g.add(o); D.crumble.push({ x, z, y, o, crack, lines, pit, st: 'ok', t: 0 });
  }
  // 곁방: 좁은 물길(p 확률)·상자
  for (const pk of F.rooms.filter((o) => o.kind === 'pocket')) {
    const c = F.corr.find((q) => q.a === -1 && q.b === pk.i); if (!c) continue;
    if (R() < T.water.p) {
      const a = [F.ox + c.pts[0][0], F.oz + c.pts[0][1]], b = [F.ox + c.pts[2][0], F.oz + c.pts[2][1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L;
      const cx = F.ox + c.pts[1][0], cz = F.oz + c.pts[1][1]; let top = -1e9; for (let u = -1; u <= 1; u++) for (let v = -2; v <= 2; v++) top = Math.max(top, F.floorY(cx + dx * u * T.water.w * 0.5 - dz * v, cz + dz * u * T.water.w * 0.5 + dx * v));
      const m = new THREE.Mesh(keep(new THREE.PlaneGeometry(6, T.water.w)), keep(basic('#2f7fb8', { transparent: true, opacity: 0.55, depthWrite: false, fog: false })));
      m.rotation.set(-Math.PI / 2, 0, Math.atan2(dx, dz) + Math.PI / 2); m.position.set(cx, top + 0.06, cz); g.add(m);
      const shine = new THREE.Mesh(keep(new THREE.PlaneGeometry(5.6, 0.12)), keep(basic('#bfe8ff', { transparent: true, opacity: 0.5, depthWrite: false, fog: false })));
      shine.rotation.copy(m.rotation); shine.position.set(cx, top + 0.08, cz); g.add(shine);
      D.water.push({ x: cx, z: cz, dx, dz, m, shine, y: top });
    }
    if (!D.chest) {
      const w = F.world(pk), at = walkNear(F, w.x + 0.8, w.z) || [w.x, w.z], y = F.floorY(at[0], at[1]), id = 'c' + fi;
      const o = new THREE.Group(); o.position.set(at[0], y, at[1]); o.rotation.y = R() * 6.28;
      o.add(new THREE.Mesh(keep(new THREE.BoxGeometry(1.1, 0.6, 0.7)).translate(0, 0.3, 0), keep(lam('#6b4a2a'))));
      const lid = new THREE.Group(); lid.position.set(0, 0.6, -0.35); o.add(lid);
      lid.add(new THREE.Mesh(keep(new THREE.BoxGeometry(1.14, 0.22, 0.74)).translate(0, 0.11, 0.35), keep(lam('#7d5832'))));
      const band = new THREE.Mesh(keep(new THREE.BoxGeometry(1.16, 0.1, 0.76)).translate(0, 0.45, 0), keep(lam('#c9a23a'))); o.add(band);
      const glow = new THREE.Mesh(keep(new THREE.CircleGeometry(1.2, 14)), keep(basic('#ffd27a', { transparent: true, opacity: 0.18, depthWrite: false, fog: false }))); glow.rotation.x = -Math.PI / 2; glow.position.y = 0.05; o.add(glow);
      g.add(o); D.chest = { id, o, lid, glow, x: at[0], z: at[1], y }; chestPos.set(at[0], y, at[1]);
      if (chestGot(id)) { lid.rotation.x = -1.9; glow.visible = false; }
    }
  }
  // 동굴의 주인 방
  if (F.far?.kind === 'boss') D.ownerRoom = { x: F.far.x, z: F.far.z, r: F.far.r };
  D.rockT = frange(R, T.rock.every); D.safe.copy(player.pos);
}

// ---------- 무너지는 바닥 ----------
const inPatch = (p, x, z, k = 1) => Math.hypot(x - p.x, z - p.z) < T.crumble.r * k;
function tickCrumble(dt) {
  const px = player.pos.x, pz = player.pos.z, C = T.crumble;
  let inAny = false;
  for (const p of D.crumble) {
    const on = inPatch(p, px, pz, 0.85) && !player.air;
    if (inPatch(p, px, pz, 1.05)) inAny = true;
    if (p.st === 'ok' && on) { p.st = 'warn'; p.t = C.warn; toast(L3.crack, 1.4); late.sound?.stone?.(); }
    if (p.st === 'warn') {
      p.t -= dt; const k = 1 - p.t / C.warn;
      p.crack.material.color.setRGB(0.16 + 0.5 * k, 0.13 + 0.12 * k, 0.11); p.lines.children.forEach((l) => { l.material.opacity = 0.35 + 0.6 * k; l.scale.set(1 + k * 0.6, 1 + k * 0.6, 1); });
      p.o.position.x = p.x + Math.sin(p.t * 60) * 0.03 * k;
      if (p.t <= 0) {
        p.st = 'down'; p.t = C.down; p.pit.visible = true; p.lines.visible = false; p.o.position.x = p.x; late.sound?.boom?.();
        if (inPatch(p, player.pos.x, player.pos.z, 1.0) && !(hp.isDown || hp.pending)) {
          hp.hit(C.dmg); late.feel?.hurt(); toast(L3.crumble, 2);
          player.pos.set(D.safe.x, D.F.floorY(D.safe.x, D.safe.z), D.safe.z); player.visY = player.pos.y; player.target = null; player.onArrive = null; player.speed = 0;
        }
      }
    } else if (p.st === 'down' && (p.t -= dt) <= 0) {
      p.st = 'ok'; p.pit.visible = false; p.lines.visible = true; p.crack.material.color.set('#2a221c'); p.lines.children.forEach((l) => { l.material.opacity = 0.35; l.scale.set(1, 1, 1); });
    }
  }
  if (!inAny && !player.air && D.F.walk(px, pz)) D.safe.set(px, player.pos.y, pz);
}

// ---------- 낙석 ----------
const rockGeo = new THREE.DodecahedronGeometry(0.5, 0), rockMat = lam('#4a4541'), shadowGeo = new THREE.CircleGeometry(1, 14), shadowMat = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.45, depthWrite: false });
const ringMat = new THREE.MeshBasicMaterial({ color: '#ff6a3a', transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, fog: false }), ringGeo = new THREE.RingGeometry(0.9, 1, 18);
/* 낙석은 그림자·경고 고리·돌 셋을 묶어 그림 (#218: 하나하나 그리면 주인 방 낙석 비에 draw call 이 늘어남). 한 층에 ROCK_MAX 개까지 */
const ROCK_MAX = 24, rockIM = [[shadowGeo, shadowMat], [ringGeo, ringMat], [rockGeo, rockMat]].map(([g, m]) => { const im = new THREE.InstancedMesh(g, m, ROCK_MAX); im.count = 0; im.frustumCulled = false; im.name = 'cave-rocks'; return im; });
rockIM[0].renderOrder = 1; rockIM[1].renderOrder = 2;
const rk = new THREE.Object3D(), flat = new THREE.Euler(-Math.PI / 2, 0, 0), up = new THREE.Euler(0, 0, 0);
function rockSet(im, i, x, y, z, s, e) { rk.position.set(x, y, z); rk.rotation.copy(e); rk.scale.setScalar(s); rk.updateMatrix(); im.setMatrixAt(i, rk.matrix); }
function rockDraw() {
  let a = 0, b = 0, c = 0;
  for (const k of D.rocks) {
    rockSet(rockIM[0], a++, k.x, k.y + 0.05, k.z, k.sh, flat);
    if (k.st === 'warn') rockSet(rockIM[1], b++, k.x, k.y + 0.06, k.z, k.r, flat);
    if (k.ry != null) rockSet(rockIM[2], c++, k.x, k.y + k.ry, k.z, k.r * 0.75, up);
  }
  [a, b, c].forEach((n, i) => { const im = rockIM[i]; im.count = n; if (n) im.instanceMatrix.needsUpdate = true; });
}
function dropRock(x, z, r, dmg) {
  const F = D.F; if (!F || !F.walk(x, z) || D.rocks.length >= ROCK_MAX) return;
  const y = F.floorY(x, z), top = F.ceilY(x, z) - 0.4;
  if (!rockIM[0].parent) D.g.add(...rockIM);
  D.rocks.push({ x, y, z, r, dmg, sh: r * 0.3, ry: null, t: T.rock.warn, top: top - y, st: 'warn' });
  rockDraw();
}
function rockRain(n, r, dmg, near) {
  const R = Math.random;
  for (let k = 0; k < n; k++) { const a = R() * 6.28, d = k === 0 ? R() * 1.2 : 1 + R() * near, at = walkNear(D.F, player.pos.x + Math.cos(a) * d, player.pos.z + Math.sin(a) * d, 2); if (at) dropRock(at[0], at[1], r, dmg); }
}
const hitDir = new THREE.Vector3();
function tickRocks(dt) {
  if (!D.rocks.length) { if (rockIM[0].count) rockDraw(); return; }
  for (let i = D.rocks.length - 1; i >= 0; i--) {
    const k = D.rocks[i];
    if (k.st === 'warn') {
      k.t -= dt; const f = 1 - Math.max(0, k.t) / T.rock.warn; k.sh = k.r * (0.3 + 0.7 * f); ringMat.opacity = 0.3 + 0.4 * Math.abs(Math.sin(f * 12));
      if (k.t <= 0.25) k.ry = k.top * Math.max(0, k.t / 0.25);
      if (k.t <= 0) {
        k.st = 'lie'; k.t = T.rock.lie; k.ry = k.r * 0.3; late.sound?.stone?.();
        const dx = player.pos.x - k.x, dz = player.pos.z - k.z;
        if (Math.hypot(dx, dz) < k.r && !player.air) { hitDir.set(dx, 0, dz); if (hitDir.lengthSq() < 1e-4) hitDir.set(Math.sin(player.heading), 0, Math.cos(player.heading)).negate(); hitDir.normalize(); life.hooks.enemyHit?.(hitDir, { dmg: k.dmg, name: L3.rock }); }
      }
    } else if ((k.t -= dt) <= 0) D.rocks.splice(i, 1);
    else if (k.t < 0.6) k.ry = k.r * 0.3 - (0.6 - k.t) * k.r;
  }
  rockDraw();
}
// 줄 방 빼고 방 안에 있으면 가끔 낙석 (주인 방은 주인이 따로)
function roomAt(x, z) { const F = D.F; for (const o of F.rooms) { const w = F.world(o); if (Math.hypot(x - w.x, z - w.z) < o.r) return o; } return null; }
function tickRockfall(dt) {
  if ((D.rockT -= dt) > 0) return;
  D.rockT = frange(Math.random, T.rock.every);
  const o = roomAt(player.pos.x, player.pos.z); if (!o || o.kind === 'start' || o.kind === 'boss' || hp.isDown || hp.pending) return;
  rockRain(irange(Math.random, T.rock.n), T.rock.r, T.rock.dmg, T.rock.near);
}

// ---------- 좁은 물길 ----------
const inWater = (w, x, z) => { const ux = x - w.x, uz = z - w.z, along = ux * w.dx + uz * w.dz, side = -ux * w.dz + uz * w.dx; return Math.abs(along) < T.water.w * 0.5 && Math.abs(side) < 3; };
const waterAt = (x, z) => D.water.find((w) => inWater(w, x, z));
const pitAt = (x, z) => D.crumble.find((p) => p.st === 'down' && inPatch(p, x, z, 0.9));
{
  const oc = spots.clamp;
  spots.clamp = function (x, z) {
    const r = oc.call(this, x, z), c = state.cave; if (!c || !D.F || !c.F.inside(x, z)) return r;
    const nx = r ? r.x : x, nz = r ? r.z : z, p = player.pos;
    const w = waterAt(nx, nz);
    if (w && !floats() && !waterAt(p.x, p.z)) { if (D.msgT <= 0) { toast(L3.water, 2.2); D.msgT = 3; } return { x: p.x, z: p.z, hit: '' }; }
    if (w && floats() && !D.swimSaid) { D.swimSaid = true; toast(L3.swim, 1.8); }
    if (pitAt(nx, nz) && !pitAt(p.x, p.z)) return { x: p.x, z: p.z, hit: '' };
    return r;
  };
}
let wt = 0;
function tickWater(dt) {
  wt += dt; for (const w of D.water) { w.shine.position.x = w.x + w.dz * Math.sin(wt * 1.3) * 0.6; w.shine.position.z = w.z - w.dx * Math.sin(wt * 1.3) * 0.6; w.m.material.opacity = 0.5 + 0.06 * Math.sin(wt * 2); }
}

// ---------- 상자 ----------
function openChest() {
  const c = D.chest; if (!c || chestGot(c.id)) { if (c) toast(L3.chestGot, 1.6); return; }
  chestRec().got.push(c.id); persist();
  c.lid.rotation.x = -1.9; c.glow.visible = false;
  const at = new THREE.Vector3(c.x, c.y + 0.9, c.z);
  life.scatterTangerines(at, CH.gyul[D.fi] || CH.gyul[0], 40);
  dropLoot('treasure', CH.loot, new THREE.Vector3(c.x, c.y, c.z));
  toast(L3.chest, 3); late.sound?.coin?.(); late.ach?.emit?.('cave-chest');
}
interactables.push({ label: '상자 열기', ic: 'chest', pos: chestPos, r: CH.r, when: () => !!state.cave && !!D.chest && !chestGot(D.chest.id), act: openChest });

// ---------- 동굴의 주인 ----------
function wakeOwner(at0 = null) { // at0: 동굴 적 받는 쪽 (#205)이 칸 주인 자리에 만듦
  const R = D.ownerRoom, at = at0 || walkNear(D.F, R.x, R.z) || [R.x, R.z];
  const e = life.enemies.spawnStory(OW.kind, at[0], at[1], { id: 'cave', k: OW.k, over: { name: OW.name, hp: OW.hp, dmg: OW.dmg, walk: OW.walk, reward: { gyul: ownerGot() ? OW.small : 0, rare: 0 }, life: 1e9 } });
  e.cave = true; e.owner = true; e.calls = 0; e.fled = 0; e.heading = Math.atan2(player.pos.x - e.pos.x, player.pos.z - e.pos.z);
  D.owner = e; D.ownerSeen = true; D.rainT = frange(Math.random, OW.rain.every);
  toast(L3.owner, 3); late.sound?.fanfare?.();
  return e;
}
function ownerGone() {
  const e = D.owner; e.fled = 1;
  if (hp.isDown || hp.pending) return;
  const at = new THREE.Vector3(e.pos.x, D.F.floorY(e.pos.x, e.pos.z), e.pos.z);
  if (!ownerGot()) {
    cv().boss = today(); persist();
    life.scatterTangerines(at.clone().setY(at.y + 1.2), OW.gyul, 60);
    dropLoot('boss', OW.loot, at);
    toast(L3.ownerGone, 4); late.sound?.fanfare?.(); late.ach?.emit?.('cave-owner');
  } else toast(L3.ownerAgain, 3);
  for (const m of D.calls) if (life.enemies.list.includes(m) && m.state !== 'flee') { m.state = 'flee'; m.st = 0; }
}
function tickOwner(dt) {
  const R = D.ownerRoom; if (!R) return;
  const d = Math.hypot(player.pos.x - R.x, player.pos.z - R.z), host = late.caveHost?.() ?? true; /* 동굴 적 같이 보기 (#205): 칸 주인만 깨움(같은 칸 사람이 다가가도) */
  if (!D.ownerSeen && host && ((d < R.r + OW.wake && !(hp.isDown || hp.pending)) || (late.cavePeers?.() || []).some((p) => Math.hypot(p.x - R.x, p.z - R.z) < R.r + OW.wake))) wakeOwner();
  const e = D.owner; if (!e) return;
  D.calls = D.calls.filter((m) => life.enemies.list.includes(m));
  const live = life.enemies.list.includes(e) && e.state !== 'flee';
  if (!live) { if (!e.fled) ownerGone(); if (life.enemies.list.includes(e) && (e.fledT = (e.fledT || 0) + dt) > 3) life.enemies.remove(e); bossBar(false); return; }
  const fight = AGGRO.has(e.state) || d < R.r + 2;
  if (e.net) { /* 받는 쪽: 기운·드론은 칸 주인 값 */ } else if (AGGRO.has(e.state)) e.calmT = 0; else restRegen(e, dt, e.def.hp);
  if (fight && !(hp.isDown || hp.pending)) {
    if ((D.rainT -= dt) <= 0) { D.rainT = frange(Math.random, OW.rain.every); rockRain(irange(Math.random, OW.rain.n), OW.rain.r, OW.rain.dmg, 5); }
    const f = e.hp / e.def.hp;
    while (!e.net && e.calls < OW.call.at.length && f < OW.call.at[e.calls]) {
      e.calls++;
      for (let k = 0; k < OW.call.n; k++) { const a = Math.random() * 6.28, at = walkNear(D.F, e.pos.x + Math.cos(a) * 4, e.pos.z + Math.sin(a) * 4); if (!at) continue; const m = life.enemies.spawnStory(OW.call.kind, at[0], at[1], { id: 'cave' }); m.cave = true; D.calls.push(m); }
      toast('주인이 드론을 불렀어요!', 2);
    }
  }
  bossBar(d < R.r + 14, e);
}
function bossBar(on, e) {
  const el = $('boss-bar'); if (!el) return;
  if (on !== D.barOn) { D.barOn = on; el.hidden = !on; document.body.classList.toggle('boss-on', on); if (on) { $('boss-name').textContent = OW.name; el.style.setProperty('--tier', '#7dffb0'); $('boss-n').hidden = true; } }
  if (!on || !e) return;
  $('boss-fill').style.width = (Math.max(0, e.hp / e.def.hp) * 100).toFixed(1) + '%';
  const rg = !AGGRO.has(e.state) && e.hp < e.def.hp - 0.01; el.classList.toggle('regen', rg); $('boss-rg').hidden = !rg;
}

// ---------- 이어 붙이기 (cave.js · cavelife.js 의 late 고리를 감쌈) ----------
{
  const ci = late.caveIn, cf = late.caveFloor, co = late.caveFloorOff, out = late.caveOut, tk = late.caveTick;
  late.caveIn = (cs) => {
    ci(cs); D.cs = cs; life.dropCap = CAVE.drop; /* 흩어지는 귤 알갱이 줄이기 (#218) */
    const c = cv(), n = c.runs.n, full = CAVE.runs.full;
    setTimeout(() => toast(n > full ? L3.half : `${L3.today} · ${Math.min(n, full)}/${full}판`, 2.6), 1300);
  };
  late.caveFloor = (F, fi) => { cf(F, fi); buildDeep(F, fi); };
  late.caveFloorOff = () => { co(); disposeAll(); };
  late.caveOut = (downed) => { disposeAll(); life.dropCap = null; out(downed); };
  late.caveTick = (dt, F) => {
    tk(dt, F); if (!D.F) return;
    if (D.msgT > 0) D.msgT -= dt;
    tickCrumble(dt); tickRocks(dt); tickRockfall(dt); tickWater(dt); tickOwner(dt);
    if (D.chest && !chestGot(D.chest.id)) D.chest.glow.material.opacity = 0.14 + 0.08 * Math.sin(performance.now() / 300);
  };
}

// 동굴 적 같이 보기 (#205, game/caveshare.js): 받는 쪽이 주인·드론을 만들고 고리를 붙임
late.caveDeep = { D, owner: (x, z) => wakeOwner([x, z]), call: (m) => { D.calls.push(m); }, seen: () => D.ownerSeen, setSeen: () => { D.ownerSeen = true; } };

// ---------- 확인용 (__oreum.cave 에 더함) ----------
const tp = (x, z) => { const at = walkNear(D.F, x, z) || [x, z]; player.pos.set(at[0], D.F.floorY(at[0], at[1]), at[1]); player.visY = player.pos.y; player.target = null; D.safe.copy(player.pos); return { x: +at[0].toFixed(1), z: +at[1].toFixed(1) }; };
Object.assign(late.caveApi || (late.caveApi = {}), {
  runs: () => { const c = cv(); return { ...c.runs, k: late.caveRunK(), full: CAVE.runs.full, chest: { ...chestRec() }, boss: c.boss || null }; },
  setRuns: (n) => { cv().runs.n = n; persist(); return late.caveRunK(); },
  deep: () => D.F && { fi: D.fi, arrows: D.arrows, crumble: D.crumble.map((p) => ({ st: p.st, x: +p.x.toFixed(1), z: +p.z.toFixed(1) })), water: D.water.map((w) => ({ x: +w.x.toFixed(1), z: +w.z.toFixed(1) })), chest: D.chest && { id: D.chest.id, got: chestGot(D.chest.id) }, owner: !!D.ownerRoom, rocks: D.rocks.length, floats: floats() },
  goChest: () => (D.chest ? tp(D.chest.x + 1.2, D.chest.z) : null), openChest: () => { openChest(); return D.chest && chestGot(D.chest.id); },
  goOwner: () => (D.ownerRoom ? tp(D.ownerRoom.x + D.ownerRoom.r * 0.5, D.ownerRoom.z) : null),
  owner: () => { const e = D.owner; return { room: D.ownerRoom && { x: +D.ownerRoom.x.toFixed(1), z: +D.ownerRoom.z.toFixed(1), r: +D.ownerRoom.r.toFixed(1) }, seen: D.ownerSeen, got: ownerGot(), e: e && { hp: Math.round(e.hp), max: e.def.hp, state: e.state, calls: e.calls, fled: e.fled, walk: D.F.walk(e.pos.x, e.pos.z) }, calls: D.calls.length }; },
  hurtOwner: (k = 0.5) => { const e = D.owner; if (!e) return null; e.hp = Math.max(1, e.hp - e.def.hp * k); e.calmT = 0; return Math.round(e.hp); },
  repelOwner: () => { const e = D.owner; if (!e) return false; life.enemies.hurt(e, e.hp + 1, true); return true; },
  crumbleHere: (i = 0) => { const p = D.crumble[i]; if (!p) return null; const out = walkNear(D.F, p.x + T.crumble.r + 1.2, p.z) || walkNear(D.F, p.x - T.crumble.r - 1.2, p.z); const at = tp(p.x, p.z); if (out) D.safe.set(out[0], D.F.floorY(out[0], out[1]), out[1]); return at; },
  rockHere: () => { dropRock(player.pos.x, player.pos.z, T.rock.r, T.rock.dmg); return D.rocks.length; },
  goWater: (i = 0, side = -1) => { const w = D.water[i]; if (!w) return null; return tp(w.x + w.dx * side * (T.water.w * 0.5 + 0.9), w.z + w.dz * side * (T.water.w * 0.5 + 0.9)); },
  water: (i = 0) => { const w = D.water[i]; return w && { x: w.x, z: w.z, dx: w.dx, dz: w.dz, inside: !!waterAt(player.pos.x, player.pos.z) }; },
});
