// 들판 떼 몹 패턴 (#254, 수치 balance.js SWARM.pat): 서바이벌 한 판의 떼 몹이 구역·물결에 따라 다섯 가지로 섞여 나옴 (새 모델 없이 그 구역 적 모양 + 색 곱)
// - rush 돌진: 표 값 덮기(windD·windT·dashK·dashT, enemies.js)로 멀리서 멈춰 몸을 낮췄다 곧게 달림. 조짐 동안 바닥에 방향 띠(여기서 그림)
// - circle 포위: def.ctl 로 플레이어 둘레를 돌다 등 뒤에서 들어옴(그 뒤는 보통 쫓기·조짐 고리)
// - throw 던지기: def.ctl 로 거리를 두고 썩은 귤을 포물선으로. 떨어질 자리에 원(차오름)이 먼저 보임
// - pack 무리: 작고 빠른 것 여럿을 한 무리로 (swarm.js spawn 이 n 마리)
// - shield 방패: 앞에서 맞으면 덜 아픔(dmgK, swarm.js 가 life.hooks.dmgIn 에 곱함). 앞에 판 하나
// - #296 zip 잽싼 놈(작고 빠름, 지그재그) · heavy 묵직한 놈(크고 느림, 밀리지 않음, 크게 휘두르는 조짐 뒤 큰 빈틈) · rock 빅풋(돌을 들어 올렸다 던짐, 떨어진 돌이 잠깐 길을 막음)
//   길가 무리(game/foes.js)도 같은 패턴 값을 씀: 던진 것이 판 밖에서도 맞음(b.road). 설인 눈덩이(foes.js lobSnow)도 여기서 그림
//   머리 위 표시: 역할마다 색이 다른 작은 마름모 하나(InstancedMesh 하나, 색은 instanceColor)
// 모든 공격은 피할 수 있는 예고가 있음: 돌진 띠 windT 초 · 포위 뒤 보통 조짐 고리 · 던지기 원 fly 초
// 그리기: 띠·원·썩은 귤은 InstancedMesh 셋(+ 차오르는 원 하나)이라 몹 수와 상관없이 draw call 4
import * as THREE from 'three';
import { SWARM } from '../balance.js';
import { height } from '../world.js';
import { scene } from './scene.js';
import { player, life } from './place.js';
import { state, late } from './state.js';
import { isTouch } from './save.js';
import { LOW } from '../gfx2.js';

const P = SWARM.pat;
const rnd = (a, b) => a + Math.random() * (b - a);
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/* 구역·물결에서 패턴 하나 뽑기 */
export function pickPat(zone, wave, list = null) {
  const full = list && throwN(list) >= throwMax(); /* #296 던지는 놈은 한 화면에 throwMax 까지 */
  const L = (P.zone[zone] || P.zone[1]).filter((p) => wave >= p[2] && !(full && THROWS.has(p[0]))); let x = Math.random() * L.reduce((s, p) => s + p[1], 0);
  for (const p of L) { x -= p[1]; if (x <= 0) return p[0]; } return L[0][0];
}
export const THROWS = new Set(['throw', 'rock']);
export const throwMax = () => (LOW || isTouch ? P.throwMax.phone : P.throwMax.pc);
export const throwN = (list) => { let n = 0; for (const e of list) if (e.thrower && e.state !== 'flee' && e.state !== 'leave') n++; return n; };
export const patKinds = (zone, wave) => (P.zone[zone] || P.zone[1]).filter((p) => wave >= p[2]).map((p) => p[0]);

/* spawn 전 over(표 값 덮기)를 패턴에 맞춤. B 바탕 적(ENEMIES), 돌려주는 값: 모양 크기 배 k 를 바꿀 때 그 값 */
export function patOver(pat, B, over) {
  over.pat = pat;
  if (pat === 'rush') { const c = P.rush; Object.assign(over, { windD: c.windD, windT: c.windT, dashK: c.dashK, dashT: c.dashT }); over.ranged = null; }
  else if (pat === 'circle') { over.ctl = circleCtl; over.ranged = null; }
  else if (pat === 'throw') { over.ctl = throwCtl; over.ranged = null; }
  else if (pat === 'rock') { const c = P.rock; over.ctl = rockCtl; over.ranged = null; over.hp *= c.hp; gyulK(over, c.gyul); }
  else if (pat === 'zip') { const c = P.zip; over.hp *= c.hp; over.chase = B.chase * c.speed; over.walk = B.walk * c.speed; over.windT = c.windT; over.dmg = (over.dmg ?? B.dmg) * c.dmgK; over.ctl = zipCtl; over.ranged = null; gyulK(over, c.gyul); return c.k; }
  else if (pat === 'heavy') { const c = P.heavy; over.hp *= c.hp; over.chase = B.chase * c.speed; over.walk = B.walk * c.speed; over.rush = (B.rush ?? B.chase) * c.speed; Object.assign(over, { windD: c.windD, windT: c.windT, dashK: c.dashK, dashT: c.dashT, staggerT: c.staggerT, heavy: true }); over.dmg = (over.dmg ?? B.dmg) * c.dmgK; over.ranged = null; gyulK(over, c.gyul); return c.k; }
  else if (pat === 'shield') { over.walk = B.walk * P.shield.walk; over.chase = B.chase * P.shield.walk; }
  else if (pat === 'pack') { const c = P.pack; over.hp *= c.hp; over.chase = B.chase * c.speed; over.rush = (B.rush ?? B.chase) * c.speed; over.walk = B.walk * c.speed; if (over.sg != null) over.sg = Math.random() < c.gyul ? over.sg : 0; return c.k; }
  return 0;
}

/* 귤 보상 배 (떼는 sg, 길가는 reward.gyul) */
function gyulK(over, k) {
  if (over.sg != null) over.sg = Math.floor(over.sg * k) + (Math.random() < (over.sg * k) % 1 ? 1 : 0);
  else if (over.reward) over.reward = { ...over.reward, gyul: Math.round(over.reward.gyul * k) };
}

/* 색 곱 (재질은 패턴·원래 재질마다 하나씩 만들어 같이 씀) · 방패 판 */
const tintC = new Map();
const shieldGeo = new THREE.BoxGeometry(0.95, 0.75, 0.12), shieldMat = new THREE.MeshLambertMaterial({ color: '#7f8b99', flatShading: true });
export function patLook(e, pat) {
  e.pat = pat; e.ps = null; e.thrower = THROWS.has(pat);
  const c = P[pat]?.tint; if (c) {
    e.root.traverse((o) => {
      if (!o.isMesh || !o.material || Array.isArray(o.material) || !o.material.color) return;
      const k = o.material.uuid + c; let m = tintC.get(k);
      if (!m) { m = o.material.clone(); m.color.multiply(new THREE.Color(c)); tintC.set(k, m); }
      o.material = m;
    });
  }
  if (pat === 'shield') { const s = e.root.scale.x || 1, h = e.h / s, m = new THREE.Mesh(shieldGeo, shieldMat); m.position.set(0, h * 0.5, 0.62 * e.def.size / s); m.scale.setScalar(Math.max(0.7, e.def.size / s)); e.root.add(m); }
}

/* 방패: 받는 피해 배수 (swarm.js dmgIn 이 곱함) */
export function patDmg(e) {
  if (e.pat !== 'shield') return 1;
  const ux = player.pos.x - e.pos.x, uz = player.pos.z - e.pos.z, L = Math.hypot(ux, uz) || 1;
  const c = (Math.sin(e.heading) * ux + Math.cos(e.heading) * uz) / L;
  return c > P.shield.cos ? P.shield.front : P.shield.side;
}

export const patMode = { few: false }; /* #273 swarmwave.js: 남은 몹이 적으면 포위·던지기도 곧장 다가옴 */
const turn = (e, h, k) => { e.heading += wrapA(h - e.heading) * k; };

/* 포위: 둘레를 돌다 등 뒤에서 들어옴. -1 이면 보통 쫓기 (받은 뒤 쉬는 동안 다시 돎) */
function circleCtl(e, dt, time, d, to) {
  const c = P.circle, d0 = e.def;
  if (patMode.few) return -1;
  if (!e.ps || (e.ps.go && e.rest > 0)) e.ps = { t: 0, go: false, dir: Math.random() < 0.5 ? 1 : -1 };
  const s = e.ps; if (s.go) return -1;
  s.t += dt;
  const fx = Math.sin(player.heading), fz = Math.cos(player.heading), bx = -to.x / (d || 1), bz = -to.z / (d || 1);
  if ((fx * bx + fz * bz < c.behind && d < c.R + 2.5 && s.t > 1.2) || s.t > c.max) { s.go = true; return -1; } /* 등 뒤 → 들어옴 */
  const a = Math.atan2(bx, bz) + s.dir * c.w, gx = player.pos.x + Math.sin(a) * c.R, gz = player.pos.z + Math.cos(a) * c.R;
  turn(e, Math.atan2(gx - e.pos.x, gz - e.pos.z), Math.min(1, dt * 4));
  return d > c.R + 6 ? d0.chase : d0.chase * 0.85;
}

/* 던지기: 거리를 두고 옆으로 걷다 때마다 멈춰 썩은 귤 */
function throwCtl(e, dt, time, d, to, c = P.throw, type = 'rot') {
  const d0 = e.def;
  if (patMode.few && !(e.ps?.aim > 0)) return -1;
  if (!e.ps) e.ps = { cd: rnd(1.2, c.every[1]), aim: 0, side: Math.random() < 0.5 ? 1 : -1 };
  const s = e.ps, face = Math.atan2(to.x, to.z);
  if (s.aim > 0) { s.aim -= dt; turn(e, face, Math.min(1, dt * 8)); if (s.aim <= 0) lob(e, c, type); return 0; }
  if ((s.cd -= dt) <= 0 && d < c.keep[1] + 5 && !player.down) { s.aim = c.aim; s.cd = rnd(c.every[0], c.every[1]); return 0; }
  if (d > c.keep[1]) { turn(e, face, Math.min(1, dt * 3)); return d0.chase; }
  if (d < c.keep[0]) { turn(e, face + Math.PI, Math.min(1, dt * 3)); return d0.walk * 1.3; }
  turn(e, face + s.side * Math.PI / 2, Math.min(1, dt * 2)); return d0.walk * 0.7;
}

/* #296 잽싼 놈: 멀리선 지그재그로 파고듦, 가까우면 보통 조짐(짧은 windT) */
function zipCtl(e, dt, time, d, to) {
  const c = P.zip; if (d < (e.def.windD ?? 6) + 1.5 || patMode.few && d < 12) return -1;
  turn(e, Math.atan2(to.x, to.z) + Math.sin(time * c.zigW + e.seed) * c.zig, Math.min(1, dt * 6)); return e.def.chase;
}
/* #296 빅풋: 거리를 두고 돌을 오래 들어 올렸다 던짐 (e.ps.aim > 0 이면 모양이 팔을 듦) */
function rockCtl(e, dt, time, d, to) { return throwCtl(e, dt, time, d, to, P.rock, 'rock'); }

/* ---------- 그리기: 돌진 띠 · 떨어질 원 · 썩은 귤 ---------- */
const flat = (g) => g.rotateX(-Math.PI / 2);
const mk = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.count = 0; m.frustumCulled = false; m.renderOrder = 3; scene.add(m); return m; };
const STRIP_SEG = 4, STRIP_N = 48;
const stripMesh = mk(flat(new THREE.PlaneGeometry(1, 1)).translate(0, 0, 0.5), new THREE.MeshBasicMaterial({ color: '#ff3b2f', transparent: true, opacity: 0.45, depthWrite: false }), STRIP_N);
const RING_N = 24;
const ringMesh = mk(flat(new THREE.RingGeometry(0.86, 1, 28)), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false }), RING_N);
const fillMesh = mk(flat(new THREE.CircleGeometry(1, 24)), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false }), RING_N);
ringMesh.setColorAt(0, new THREE.Color('#d8ff4a')); fillMesh.setColorAt(0, new THREE.Color('#a9c43a')); /* 색은 던진 것마다 (instanceColor, 처음부터 있어야 셰이더가 씀) */
/* 던진 것 모양 (#296): rot 썩은 귤 · rock 빅풋 돌 · snow 설인 눈덩이. 종류마다 InstancedMesh 하나 */
const BALL = {
  rot: mk(new THREE.IcosahedronGeometry(0.26, 0), new THREE.MeshLambertMaterial({ color: '#6b7a2c', flatShading: true }), RING_N),
  rock: mk(new THREE.DodecahedronGeometry(0.55, 0), new THREE.MeshLambertMaterial({ color: '#7a6f63', flatShading: true }), 8),
  snow: mk(new THREE.IcosahedronGeometry(0.3, 1), new THREE.MeshLambertMaterial({ color: '#f4f8fb', flatShading: true }), 12),
};
for (const m of Object.values(BALL)) m.renderOrder = 0;
const RING_C = { rot: ['#d8ff4a', '#a9c43a'], rock: ['#ff9a3c', '#c9772e'], snow: ['#bfe6ff', '#8cc4ea'] };
/* 땅에 남은 돌 (#296 rock.stay 초, 반지름 block 로 플레이어 길을 막음) */
const STAY_N = 8, stayMesh = mk(new THREE.DodecahedronGeometry(0.55, 0), BALL.rock.material, STAY_N); stayMesh.renderOrder = 0;
const stays = []; // { x, z, y, t, s }
/* 머리 위 표시 (#296): 역할마다 색 */
const MARK_C = { zip: '#ffd23a', heavy: '#6b5a4e', throw: '#9bd03a', rock: '#c47a3a', rush: '#ff5a3c', circle: '#6f8cff', shield: '#9aa7b6', pack: '#ffb43a' };
const MARK_N = 56, markMesh = mk(new THREE.OctahedronGeometry(0.17, 0).scale(1, 1.5, 1), new THREE.MeshBasicMaterial({ color: '#ffffff' }), MARK_N);
markMesh.renderOrder = 0; markMesh.setColorAt(0, new THREE.Color('#fff'));
const _c = new THREE.Color();
const pv = { x: 0, z: 0 }, pl = { x: 0, z: 0 }; // 플레이어 걷는 빠르기 (던질 자리 앞당김)
const balls = []; // { a 던진 곳, b 떨어질 곳, t, T, def, kind, type, c 값, road 판 밖에서도 맞음 }
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);

function lob(e, c = P.throw, type = 'rot', lead = c.fly * 0.45, jit = 0) {
  if (balls.length >= RING_N || BALL[type].count >= BALL[type].instanceMatrix.count) return false;
  const a = Math.random() * 6.283, bx = player.pos.x + pv.x * lead + Math.sin(a) * jit, bz = player.pos.z + pv.z * lead + Math.cos(a) * jit; /* 걷는 쪽으로 조금 앞 (멈추거나 꺾으면 피함) */
  balls.push({ a: new THREE.Vector3(e.pos.x, e.pos.y + e.h * 0.8, e.pos.z), b: new THREE.Vector3(bx, height(bx, bz), bz), t: 0, T: c.fly, def: e.def, kind: e.kind, type, c, road: !e.def.swarm });
  return true;
}
/* 설인 눈덩이 한 개 (game/foes.js 가 n 번 부름) */
export function lobSnow(e, k = 0) { return lob(e, P.snow, 'snow', P.snow.fly * (0.3 + 0.25 * k), k ? 1.6 : 0); }
export function clearPat() { balls.length = 0; stays.length = 0; ringMesh.count = fillMesh.count = stripMesh.count = stayMesh.count = 0; for (const m of Object.values(BALL)) m.count = 0; }

function land(b, on) {
  const c = b.c, hitP = (on || b.road) && !player.down && Math.hypot(player.pos.x - b.b.x, player.pos.z - b.b.z) < c.r && (player.jumpY || 0) < 0.6;
  if (hitP) {
    const dir = new THREE.Vector3(player.pos.x - b.a.x, 0, player.pos.z - b.a.z).normalize();
    life.hooks.enemyHit?.(dir, { ...b.def, dmg: b.def.dmg * c.dmgK }, b.kind);
    if (b.type === 'snow') { state.swarmSlow = Math.max(state.swarmSlow || 0, c.slowT); late.snowHit?.(); }
  }
  if (b.type === 'rock' && stays.length < STAY_N) stays.push({ x: b.b.x, z: b.b.z, y: b.b.y, t: 0, s: 0.9 + Math.random() * 0.3, r: Math.random() * 6 });
  if (b.type !== 'rot') late.sound?.boar?.();
}

export function tickPat(dt, list, on) {
  if (dt > 0) { const k = Math.min(1, dt * 5); pv.x += (Math.min(12, Math.max(-12, (player.pos.x - pl.x) / dt)) - pv.x) * k; pv.z += (Math.min(12, Math.max(-12, (player.pos.z - pl.z) / dt)) - pv.z) * k; } pl.x = player.pos.x; pl.z = player.pos.z;
  /* 돌진 띠: 조짐(wind) 동안 달릴 길이만큼 */
  let n = 0;
  if (on) for (const e of list) {
    if (e.pat !== 'rush' || e.state !== 'wind' || n + STRIP_SEG > STRIP_N) continue;
    const d0 = e.def, len = Math.max(8, (d0.rush ?? d0.chase) * d0.dashK) * d0.dashT, w = Math.max(0.9, d0.size * 1.3), u = Math.min(1, e.st / d0.windT);
    const sx = Math.sin(e.heading), sz = Math.cos(e.heading), seg = len * (0.35 + 0.65 * u) / STRIP_SEG;
    _q.setFromAxisAngle(_y, e.heading); _s.set(w, 1, seg);
    for (let i = 0; i < STRIP_SEG; i++) { const x = e.pos.x + sx * seg * i, z = e.pos.z + sz * seg * i, y = Math.max(height(x, z), height(x + sx * seg, z + sz * seg)) + 0.07; _m.compose(_p.set(x, y, z), _q, _s); stripMesh.setMatrixAt(n++, _m); }
  }
  stripMesh.count = n; if (n) { stripMesh.instanceMatrix.needsUpdate = true; stripMesh.material.opacity = 0.3 + 0.25 * Math.abs(Math.sin(performance.now() / 90)); }
  /* 던진 것: 포물선, 떨어지면 원 안이면 맞음 */
  for (let i = balls.length - 1; i >= 0; i--) { const b = balls[i]; b.t += dt; if (b.t >= b.T) { land(b, on); balls.splice(i, 1); } }
  const m = balls.length; ringMesh.count = fillMesh.count = m; const bn = { rot: 0, rock: 0, snow: 0 };
  for (let i = 0; i < m; i++) {
    const b = balls[i], u = b.t / b.T, y = b.b.y + 0.06, r = b.c.r, C = RING_C[b.type];
    _q.identity(); _m.compose(_p.set(b.b.x, y, b.b.z), _q, _s.set(r, 1, r)); ringMesh.setMatrixAt(i, _m); ringMesh.setColorAt(i, _c.set(C[0]));
    _m.compose(_p.set(b.b.x, y + 0.01, b.b.z), _q, _s.set(r * u, 1, r * u)); fillMesh.setMatrixAt(i, _m); fillMesh.setColorAt(i, _c.set(C[1]));
    _p.lerpVectors(b.a, b.b, u); _p.y += Math.sin(u * Math.PI) * (b.type === 'snow' ? 3 : 4.5); _m.compose(_p, _q.setFromAxisAngle(_y, u * 9), _s.set(1, 1, 1)); const M = BALL[b.type]; M.setMatrixAt(bn[b.type]++, _m);
  }
  for (const k in BALL) { BALL[k].count = bn[k]; if (bn[k]) BALL[k].instanceMatrix.needsUpdate = true; }
  if (m) { ringMesh.instanceMatrix.needsUpdate = fillMesh.instanceMatrix.needsUpdate = true; ringMesh.instanceColor.needsUpdate = fillMesh.instanceColor.needsUpdate = true; }
  tickStay(dt); tickMarks(list);
}
/* 떨어진 돌: stay 초 남아 길을 막음 (플레이어를 바깥으로 밀어 냄), 끝에 가라앉음 */
function tickStay(dt) {
  const c = P.rock; let k = 0;
  for (let i = stays.length - 1; i >= 0; i--) { const o = stays[i]; o.t += dt; if (o.t >= c.stay) { stays.splice(i, 1); continue; }
    const dx = player.pos.x - o.x, dz = player.pos.z - o.z, d = Math.hypot(dx, dz), R = c.block * o.s + 0.35;
    if (d < R && (player.jumpY || 0) < 0.8) { const u = d > 1e-3 ? 1 / d : 0; player.pos.x = o.x + (u ? dx * u : 1) * R; player.pos.z = o.z + (u ? dz * u : 0) * R; } }
  for (const o of stays) { const sink = Math.max(0, (o.t - (c.stay - 0.5)) / 0.5); _q.setFromAxisAngle(_y, o.r); _m.compose(_p.set(o.x, o.y + 0.3 * o.s - sink * 0.8, o.z), _q, _s.setScalar(o.s * 1.6)); stayMesh.setMatrixAt(k++, _m); }
  stayMesh.count = k; if (k) stayMesh.instanceMatrix.needsUpdate = true;
}
/* 머리 위 표시: 역할 있는 적 머리 위 작은 마름모 (천천히 돎) */
function tickMarks(list) {
  let k = 0; const t = performance.now() / 1000;
  for (const e of list) {
    const c = e.pat && MARK_C[e.pat]; if (!c || k >= MARK_N || e.state === 'flee' || e.state === 'leave' || !e.root.visible) continue;
    _q.setFromAxisAngle(_y, t * 2 + e.seed); _m.compose(_p.set(e.pos.x, e.pos.y + e.h + P.mark + 0.4 + Math.sin(t * 3 + e.seed) * 0.06, e.pos.z), _q, _s.setScalar(Math.max(0.8, e.def.size))); markMesh.setMatrixAt(k, _m); markMesh.setColorAt(k, _c.set(c)); k++;
  }
  markMesh.count = k; if (k) { markMesh.instanceMatrix.needsUpdate = true; markMesh.instanceColor.needsUpdate = true; }
}
export const patState = () => ({ balls: balls.length, strips: stripMesh.count / STRIP_SEG, rocks: stays.length, marks: markMesh.count, snow: balls.filter((b) => b.type === 'snow').length });
export const patTest = { balls: () => balls.map((b) => ({ type: b.type, x: +b.b.x.toFixed(1), z: +b.b.z.toFixed(1), t: +(b.T - b.t).toFixed(2), r: b.c.r })), stays: () => stays.map((o) => ({ x: o.x, z: o.z, t: o.t })) };
