// 들판 떼 몹 패턴 (#254, 수치 balance.js SWARM.pat): 서바이벌 한 판의 떼 몹이 구역·물결에 따라 다섯 가지로 섞여 나옴 (새 모델 없이 그 구역 적 모양 + 색 곱)
// - rush 돌진: 표 값 덮기(windD·windT·dashK·dashT, enemies.js)로 멀리서 멈춰 몸을 낮췄다 곧게 달림. 조짐 동안 바닥에 방향 띠(여기서 그림)
// - circle 포위: def.ctl 로 플레이어 둘레를 돌다 등 뒤에서 들어옴(그 뒤는 보통 쫓기·조짐 고리)
// - throw 던지기: def.ctl 로 거리를 두고 썩은 귤을 포물선으로. 떨어질 자리에 원(차오름)이 먼저 보임
// - pack 무리: 작고 빠른 것 여럿을 한 무리로 (swarm.js spawn 이 n 마리)
// - shield 방패: 앞에서 맞으면 덜 아픔(dmgK, swarm.js 가 life.hooks.dmgIn 에 곱함). 앞에 판 하나
// 모든 공격은 피할 수 있는 예고가 있음: 돌진 띠 windT 초 · 포위 뒤 보통 조짐 고리 · 던지기 원 fly 초
// 그리기: 띠·원·썩은 귤은 InstancedMesh 셋(+ 차오르는 원 하나)이라 몹 수와 상관없이 draw call 4
import * as THREE from 'three';
import { SWARM } from '../balance.js';
import { height } from '../world.js';
import { scene } from './scene.js';
import { player, life } from './place.js';

const P = SWARM.pat;
const rnd = (a, b) => a + Math.random() * (b - a);
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/* 구역·물결에서 패턴 하나 뽑기 */
export function pickPat(zone, wave) {
  const L = (P.zone[zone] || P.zone[1]).filter((p) => wave >= p[2]); let x = Math.random() * L.reduce((s, p) => s + p[1], 0);
  for (const p of L) { x -= p[1]; if (x <= 0) return p[0]; } return L[0][0];
}
export const patKinds = (zone, wave) => (P.zone[zone] || P.zone[1]).filter((p) => wave >= p[2]).map((p) => p[0]);

/* spawn 전 over(표 값 덮기)를 패턴에 맞춤. B 바탕 적(ENEMIES), 돌려주는 값: 모양 크기 배 k 를 바꿀 때 그 값 */
export function patOver(pat, B, over) {
  over.pat = pat;
  if (pat === 'rush') { const c = P.rush; Object.assign(over, { windD: c.windD, windT: c.windT, dashK: c.dashK, dashT: c.dashT }); over.ranged = null; }
  else if (pat === 'circle') { over.ctl = circleCtl; over.ranged = null; }
  else if (pat === 'throw') { over.ctl = throwCtl; over.ranged = null; }
  else if (pat === 'shield') { over.walk = B.walk * P.shield.walk; over.chase = B.chase * P.shield.walk; }
  else if (pat === 'pack') { const c = P.pack; over.hp *= c.hp; over.chase = B.chase * c.speed; over.rush = (B.rush ?? B.chase) * c.speed; over.walk = B.walk * c.speed; if (over.sg != null) over.sg = Math.random() < c.gyul ? over.sg : 0; return c.k; }
  return 0;
}

/* 색 곱 (재질은 패턴·원래 재질마다 하나씩 만들어 같이 씀) · 방패 판 */
const tintC = new Map();
const shieldGeo = new THREE.BoxGeometry(0.95, 0.75, 0.12), shieldMat = new THREE.MeshLambertMaterial({ color: '#7f8b99', flatShading: true });
export function patLook(e, pat) {
  e.pat = pat; e.ps = null;
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

const turn = (e, h, k) => { e.heading += wrapA(h - e.heading) * k; };

/* 포위: 둘레를 돌다 등 뒤에서 들어옴. -1 이면 보통 쫓기 (받은 뒤 쉬는 동안 다시 돎) */
function circleCtl(e, dt, time, d, to) {
  const c = P.circle, d0 = e.def;
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
function throwCtl(e, dt, time, d, to) {
  const c = P.throw, d0 = e.def;
  if (!e.ps) e.ps = { cd: rnd(1.2, c.every[1]), aim: 0, side: Math.random() < 0.5 ? 1 : -1 };
  const s = e.ps, face = Math.atan2(to.x, to.z);
  if (s.aim > 0) { s.aim -= dt; turn(e, face, Math.min(1, dt * 8)); if (s.aim <= 0) lob(e); return 0; }
  if ((s.cd -= dt) <= 0 && d < c.keep[1] + 5 && !player.down) { s.aim = c.aim; s.cd = rnd(c.every[0], c.every[1]); return 0; }
  if (d > c.keep[1]) { turn(e, face, Math.min(1, dt * 3)); return d0.chase; }
  if (d < c.keep[0]) { turn(e, face + Math.PI, Math.min(1, dt * 3)); return d0.walk * 1.3; }
  turn(e, face + s.side * Math.PI / 2, Math.min(1, dt * 2)); return d0.walk * 0.7;
}

/* ---------- 그리기: 돌진 띠 · 떨어질 원 · 썩은 귤 ---------- */
const flat = (g) => g.rotateX(-Math.PI / 2);
const mk = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.count = 0; m.frustumCulled = false; m.renderOrder = 3; scene.add(m); return m; };
const STRIP_SEG = 4, STRIP_N = 48;
const stripMesh = mk(flat(new THREE.PlaneGeometry(1, 1)).translate(0, 0, 0.5), new THREE.MeshBasicMaterial({ color: '#ff3b2f', transparent: true, opacity: 0.45, depthWrite: false }), STRIP_N);
const RING_N = 16;
const ringMesh = mk(flat(new THREE.RingGeometry(0.86, 1, 28)), new THREE.MeshBasicMaterial({ color: '#d8ff4a', transparent: true, opacity: 0.85, depthWrite: false }), RING_N);
const fillMesh = mk(flat(new THREE.CircleGeometry(1, 24)), new THREE.MeshBasicMaterial({ color: '#a9c43a', transparent: true, opacity: 0.35, depthWrite: false }), RING_N);
const ballMesh = mk(new THREE.IcosahedronGeometry(0.26, 0), new THREE.MeshLambertMaterial({ color: '#6b7a2c', flatShading: true }), RING_N);
ballMesh.renderOrder = 0;
const pv = { x: 0, z: 0 }, pl = { x: 0, z: 0 }; // 플레이어 걷는 빠르기 (던질 자리 앞당김)
const balls = []; // { a 던진 곳, b 떨어질 곳, t, T, dmg, def, kind }
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);

function lob(e) {
  const c = P.throw; if (balls.length >= RING_N) return;
  const lead = c.fly * 0.45, bx = player.pos.x + pv.x * lead, bz = player.pos.z + pv.z * lead; /* 걷는 쪽으로 조금 앞 (멈추거나 꺾으면 피함) */
  balls.push({ a: new THREE.Vector3(e.pos.x, e.pos.y + e.h * 0.8, e.pos.z), b: new THREE.Vector3(bx, height(bx, bz), bz), t: 0, T: c.fly, def: e.def, kind: e.kind });
}
export function clearPat() { balls.length = 0; ringMesh.count = fillMesh.count = ballMesh.count = stripMesh.count = 0; }

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
  /* 썩은 귤: 포물선, 떨어지면 원 안이면 맞음 */
  const c = P.throw;
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i]; b.t += dt;
    if (b.t < b.T) continue;
    const hitP = on && !player.down && Math.hypot(player.pos.x - b.b.x, player.pos.z - b.b.z) < c.r && (player.jumpY || 0) < 0.6;
    if (hitP) { const dir = new THREE.Vector3(player.pos.x - b.a.x, 0, player.pos.z - b.a.z).normalize(); life.hooks.enemyHit?.(dir, { ...b.def, dmg: b.def.dmg * c.dmgK }, b.kind); }
    balls.splice(i, 1);
  }
  const m = balls.length; ringMesh.count = fillMesh.count = ballMesh.count = m;
  for (let i = 0; i < m; i++) {
    const b = balls[i], u = b.t / b.T, y = b.b.y + 0.06;
    _q.identity(); _m.compose(_p.set(b.b.x, y, b.b.z), _q, _s.set(c.r, 1, c.r)); ringMesh.setMatrixAt(i, _m);
    _m.compose(_p.set(b.b.x, y + 0.01, b.b.z), _q, _s.set(c.r * u, 1, c.r * u)); fillMesh.setMatrixAt(i, _m);
    _p.lerpVectors(b.a, b.b, u); _p.y += Math.sin(u * Math.PI) * 4.5; _m.compose(_p, _q.setFromAxisAngle(_y, u * 9), _s.set(1, 1, 1)); ballMesh.setMatrixAt(i, _m);
  }
  if (m) { ringMesh.instanceMatrix.needsUpdate = fillMesh.instanceMatrix.needsUpdate = ballMesh.instanceMatrix.needsUpdate = true; }
}
export const patState = () => ({ balls: balls.length, strips: stripMesh.count / STRIP_SEG });
