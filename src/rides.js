// 탈것 (#69): 스케이트보드·스쿠터·조랑말(개인 탈것) 모양·속도 계산, 오름 길을 오가는 마차·정류장
// 모양은 로우폴리 임시 (나중에 Tripo). 수치는 balance.js RIDES·CART
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gradHard } from './toon.js';
import { RIDES, CART } from './balance.js';
import { nsAlong, nsLen } from './namsongi.js';

export const RIDE_BY = Object.fromEntries(RIDES.list.map((r) => [r.id, r]));

// ---------- 속도 ----------
// grade = 진행 방향 기울기(높이/거리, 오르막 +), onPath = 길 위. 반환 속도 배율 × base (스케이트보드 오르막은 따로 carry)
export function rideSpeed(id, grade, onPath) {
  const R = RIDE_BY[id]; if (!R) return 0;
  const k = Math.max(-1, Math.min(1, grade / RIDES.grade));
  const m = k >= 0 ? R.flat + ((R.up || R.flat) - R.flat) * k : R.flat + (R.down - R.flat) * -k;
  return RIDES.base * m * (onPath ? 1 : RIDES.off);
}

// ---------- 모양 ----------
function piece(g, color, mat4) {
  g = g.index ? g.toNonIndexed() : g; if (g.attributes.uv) g.deleteAttribute('uv'); if (mat4) g.applyMatrix4(mat4); g.computeVertexNormals();
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
const M4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const box = (w, h, d, c, m) => piece(new THREE.BoxGeometry(w, h, d), c, m);
const cyl = (rt, rb, h, c, m, seg = 8) => piece(new THREE.CylinderGeometry(rt, rb, h, seg), c, m);
const ball = (r, c, m, d = 1) => piece(new THREE.IcosahedronGeometry(r, d), c, m);
let MAT = null;
const mat = () => MAT || (MAT = new THREE.MeshToonMaterial({ color: '#ffffff', vertexColors: true, gradientMap: gradHard }));
const mesh = (parts, shadow = true) => { const m = new THREE.Mesh(mergeGeometries(parts), mat()); m.castShadow = shadow; return m; };
const WHEEL = (r, w, c, m) => cyl(r, r, w, c, new THREE.Matrix4().multiplyMatrices(m, M4(0, 0, 0, 0, 0, Math.PI / 2)), 10);

// 스케이트보드: 판 윗면 y ≈ 0.16 (발 딛는 곳), 앞이 +z
export function buildSkate() {
  const P = [
    box(0.26, 0.04, 0.78, '#f08a3a', M4(0, 0.14, 0)), // 판
    box(0.26, 0.04, 0.12, '#f08a3a', M4(0, 0.165, 0.42, -0.35)), box(0.26, 0.04, 0.12, '#f08a3a', M4(0, 0.165, -0.42, 0.35)), // 앞뒤 들린 끝
    box(0.24, 0.006, 0.74, '#2b2b2e', M4(0, 0.163, 0)), // 사포
    box(0.2, 0.04, 0.05, '#9aa0a6', M4(0, 0.1, 0.28)), box(0.2, 0.04, 0.05, '#9aa0a6', M4(0, 0.1, -0.28)), // 트럭
  ];
  for (const z of [0.28, -0.28]) for (const x of [0.11, -0.11]) P.push(WHEEL(0.045, 0.04, '#f3ecdc', M4(x, 0.05, z)));
  return mesh(P);
}
// 스쿠터: 발판 윗면 y ≈ 0.17, 손잡이 y ≈ 1.05
export function buildScoot() {
  const P = [
    box(0.16, 0.05, 0.62, '#3fb3a8', M4(0, 0.12, -0.04)), box(0.15, 0.008, 0.56, '#26272b', M4(0, 0.148, -0.04)),
    cyl(0.025, 0.025, 0.98, '#c9ced3', M4(0, 0.6, 0.3, -0.18)), // 기둥 (앞으로 조금 기움)
    cyl(0.02, 0.02, 0.52, '#c9ced3', M4(0, 1.07, 0.21, 0, 0, Math.PI / 2)), // 손잡이 막대
    cyl(0.03, 0.03, 0.1, '#26272b', M4(0.24, 1.07, 0.21, 0, 0, Math.PI / 2)), cyl(0.03, 0.03, 0.1, '#26272b', M4(-0.24, 1.07, 0.21, 0, 0, Math.PI / 2)),
    box(0.05, 0.05, 0.14, '#3fb3a8', M4(0, 0.13, 0.32)), box(0.06, 0.03, 0.16, '#3fb3a8', M4(0, 0.16, -0.38)), // 앞 목·뒤 흙받이
    WHEEL(0.075, 0.04, '#26272b', M4(0, 0.075, 0.36)), WHEEL(0.075, 0.04, '#26272b', M4(0, 0.075, -0.36)),
  ];
  return mesh(P);
}
// 조랑말 (제주마 느낌: 다리 짧고 몸통 통통, 갈기 짙음). 반환 { root, legs[4](어깨 기준 회전), head, tail, seatY(안장 윗면) }
export function buildPony({ coat = '#8a5a36', mane = '#2a1e18', saddle = '#b8452f', scale = 1, tack = true } = {}) {
  const root = new THREE.Group(), s = scale;
  const body = [
    piece(new THREE.CapsuleGeometry(0.36, 0.72, 4, 10), coat, M4(0, 1.02, 0, Math.PI / 2, 0, 0, 1, 1, 0.98)),
    box(0.16, 0.3, 0.6, mane, M4(0, 1.3, 0.03, 0, 0, 0, 1, 1, 1)), // 등 갈기 끝 (목과 이어짐)
  ];
  if (tack) body.push(box(0.6, 0.06, 0.5, saddle, M4(0, 1.38, -0.05)), box(0.5, 0.14, 0.12, saddle, M4(0, 1.42, -0.3)), box(0.06, 0.4, 0.08, '#3a2a20', M4(0.36, 1.12, -0.05)), box(0.06, 0.4, 0.08, '#3a2a20', M4(-0.36, 1.12, -0.05)));
  const b = mesh(body); root.add(b);
  // 목·머리 (하나로 움직임)
  const head = new THREE.Group(); head.position.set(0, 1.2, 0.5); root.add(head);
  const hp = [
    piece(new THREE.CapsuleGeometry(0.17, 0.45, 3, 8), coat, M4(0, 0.25, 0.12, 0.55)), // 목
    box(0.26, 0.26, 0.5, coat, M4(0, 0.5, 0.42, 0.35)), box(0.22, 0.2, 0.18, '#5a3a24', M4(0, 0.36, 0.66, 0.35)), // 머리·주둥이
    box(0.07, 0.14, 0.05, coat, M4(0.09, 0.72, 0.28, -0.2)), box(0.07, 0.14, 0.05, coat, M4(-0.09, 0.72, 0.28, -0.2)), // 귀
    box(0.07, 0.5, 0.36, mane, M4(0, 0.48, 0.02, 0.55)), // 목 갈기
    ball(0.035, '#151515', M4(0.13, 0.55, 0.5)), ball(0.035, '#151515', M4(-0.13, 0.55, 0.5)),
  ];
  if (tack) hp.push(box(0.28, 0.04, 0.04, '#3a2a20', M4(0, 0.4, 0.58, 0.35)));
  head.add(mesh(hp));
  // 꼬리
  const tail = new THREE.Group(); tail.position.set(0, 1.18, -0.68); root.add(tail);
  tail.add(mesh([box(0.12, 0.6, 0.1, mane, M4(0, -0.28, -0.06, 0.25))]));
  // 다리 (짧고 굵게, 발굽 짙게)
  const legs = [];
  for (const [x, z] of [[0.2, 0.42], [-0.2, 0.42], [0.2, -0.42], [-0.2, -0.42]]) {
    const g = new THREE.Group(); g.position.set(x, 0.86, z); root.add(g);
    g.add(mesh([cyl(0.085, 0.07, 0.72, coat, M4(0, -0.38, 0)), cyl(0.08, 0.085, 0.12, '#2a2220', M4(0, -0.8, 0))]));
    legs.push(g);
  }
  root.scale.setScalar(s);
  return { root, legs, head, tail, seatY: 1.42 * s };
}
// 걷는 다리 (phase 누적, 빠를수록 크게)
function gait(P, phase, amt) {
  const a = Math.min(0.75, amt);
  P.legs.forEach((g, i) => { g.rotation.x = Math.sin(phase + (i === 0 || i === 3 ? 0 : Math.PI)) * a; });
  P.head.rotation.x = Math.sin(phase * 2) * 0.05 * Math.min(1, amt * 2);
  P.tail.rotation.x = 0.15 + Math.sin(phase * 0.7) * 0.15;
}

// 러너 하나에 붙는 탈것 모양 (나·다른 사람 모두). set(state): '' | skate | skate-c(들고 걸음) | scoot | horse
// 반환 lift = 몸을 올릴 높이, pose = 러너 자세, still = 걷기 다리 흔들기 끔
const POSE = { skate: 'board', scoot: 'scoot', horse: 'ride', 'skate-c': 'move' };
export function rideRig(runner) {
  const o = { state: '', parts: {}, phase: 0 };
  function part(k) {
    if (o.parts[k]) return o.parts[k];
    let p;
    if (k === 'skate' || k === 'skate-c') { p = o.parts.skate || o.parts['skate-c']; if (!p) { p = { root: buildSkate() }; p.root.scale.setScalar(RIDES.size.skate); } }
    else if (k === 'scoot') { p = { root: buildScoot() }; p.root.scale.setScalar(RIDES.size.scoot); }
    else if (k === 'horse') { p = buildPony({ scale: RIDES.size.horse }); }
    p.root.visible = false; if (!p.root.parent) runner.root.add(p.root);
    o.parts[k] = p; return p;
  }
  function set(st) {
    if (st === o.state) return;
    for (const k in o.parts) o.parts[k].root.visible = false;
    o.state = st || '';
    if (!o.state || !POSE[o.state]) { o.state = ''; return; }
    const p = part(o.state), r = p.root; r.visible = true;
    if (o.state === 'skate-c') { r.position.set(0.62, 0.95, 0.05); r.rotation.set(0, 0, -Math.PI / 2 + 0.12); } // 옆구리에 세워 듦
    else if (o.state === 'horse') { r.position.set(0, -RIDES.lift.horse, 0.06); r.rotation.set(0, 0, 0); } // 발굽이 땅에, 안장이 엉덩이 밑에
    else { r.position.set(0, -RIDES.lift[o.state], 0); r.rotation.set(0, 0, 0); } // 바퀴가 땅에
  }
  // speed = 땅 위 속도
  function tick(dt, speed) {
    if (o.state !== 'horse') return;
    const p = o.parts.horse; o.phase += dt * speed * 1.25;
    gait(p, o.phase, speed > 0.3 ? 0.25 + speed * 0.035 : 0);
  }
  const lift = () => (o.state && o.state !== 'skate-c' ? RIDES.lift[o.state] : 0);
  return { set, tick, lift, get state() { return o.state; }, pose: () => POSE[o.state] || null, still: () => !!o.state && o.state !== 'skate-c' };
}

// 가게 진열 모양 (탈것 가게)
export const rideDisplay = { skate: buildSkate, scoot: buildScoot, horse: () => buildPony().root };

// ---------- 마차 ----------
// 길: 첫 정류장(들머리 길)에서 들머리 길 끝(능선 남쪽 끝)까지, 거기서 능선을 정상 쪽으로. route s → { x, z, dir }
function makeRoute() {
  const st = CART.stops, A = st[0].d, AL = nsLen('approach'), RL = nsLen('rim');
  const LA = AL - A; // 들머리 길 부분 길이
  const at = (s) => {
    if (s <= LA) return nsAlong('approach', A + Math.max(0, s));
    const q = nsAlong('rim', RL - (s - LA)); return { x: q.x, z: q.z, dir: q.dir + Math.PI }; // 능선 길은 북→남 순서라 거꾸로 감
  };
  const sOf = (S) => (S.path === 'approach' ? S.d - A : LA + (RL - S.d));
  const ss = st.map(sOf);
  return { at, ss, len: ss[ss.length - 1], side: (S, k = 1) => { const q = S.path === 'approach' ? nsAlong('approach', S.d, k, CART.side) : nsAlong('rim', S.d, -k, CART.side); return q; } };
}
// 시간표: 0..lap 안에서 [정차|이동] 구간 목록. 정류장 0 → 끝 → 0 (끝 정류장 사이도 정차)
function makeSchedule(route) {
  const n = route.ss.length, seq = [...Array(n).keys(), ...Array.from({ length: n - 2 }, (_, i) => n - 2 - i)]; // 0 1 2 3 2 1
  const legs = seq.map((a, i) => [a, seq[(i + 1) % seq.length]]);
  const dist = legs.reduce((s, [a, b]) => s + Math.abs(route.ss[b] - route.ss[a]), 0);
  const moveT = CART.lap - CART.dwell * seq.length, v = dist / moveT; // 평균 속도
  const ev = []; let t = 0;
  legs.forEach(([a, b]) => { ev.push({ kind: 'stop', stop: a, t0: t, t1: t + CART.dwell }); t += CART.dwell; const T = Math.abs(route.ss[b] - route.ss[a]) / v; ev.push({ kind: 'move', from: a, to: b, t0: t, t1: t + T }); t += T; });
  return { ev, v };
}
const rampPos = (u, a) => { const vm = 1 / (1 - a); return u < a ? 0.5 * vm * u * u / a : u > 1 - a ? 1 - 0.5 * vm * (1 - u) * (1 - u) / a : vm * (u - a / 2); };
const rampVel = (u, a) => { const vm = 1 / (1 - a); return u < a ? vm * u / a : u > 1 - a ? vm * (1 - u) / a : vm; };

export function cartState(now, R = cartRoute()) {
  const S = cartSched(R), t = ((now % CART.lap) + CART.lap) % CART.lap;
  const e = S.ev.find((x) => t >= x.t0 && t < x.t1) || S.ev[S.ev.length - 1];
  if (e.kind === 'stop') { const s = R.ss[e.stop], nxt = S.ev[(S.ev.indexOf(e) + 1) % S.ev.length]; return { s, moving: false, stop: e.stop, left: e.t1 - t, dir: R.ss[nxt.to] >= s ? 1 : -1, speed: 0 }; }
  const u = (t - e.t0) / (e.t1 - e.t0), a = R.ss[e.from], b = R.ss[e.to];
  return { s: a + (b - a) * rampPos(u, CART.ramp), moving: true, stop: -1, left: e.t1 - t, dir: b >= a ? 1 : -1, speed: Math.abs(b - a) / (e.t1 - e.t0) * rampVel(u, CART.ramp), to: e.to };
}
// 정류장 i 에 다음 마차가 오기까지(초). 지금 서 있으면 0
export function cartWait(i, now) {
  const S = cartSched(), t = ((now % CART.lap) + CART.lap) % CART.lap;
  let best = 1e9;
  for (const e of S.ev) { if (e.kind !== 'stop' || e.stop !== i) continue; if (t >= e.t0 && t < e.t1) return 0; const w = ((e.t0 - t) % CART.lap + CART.lap) % CART.lap; if (w < best) best = w; }
  return best;
}
let route0 = null, sched0 = null;
export const cartRoute = () => route0 || (route0 = makeRoute());
const cartSched = () => sched0 || (sched0 = makeSchedule(cartRoute()));

// 마차 모양: 앞 조랑말 + 뒤 두 바퀴 수레(벤치 둘, 천 지붕). 원점 = 수레 바퀴 축 아래 땅, 앞 +z
function buildCartMesh(low) {
  const g = new THREE.Group(), body0 = new THREE.Group(); body0.scale.setScalar(CART.scale); g.add(body0);
  const pony = buildPony({ scale: RIDES.size.horse / CART.scale, saddle: '#d28a2a' }); pony.root.position.set(0, 0, 2.3); body0.add(pony.root);
  const WD = '#a8774a', WD2 = '#7a5432';
  const P = [
    box(1.7, 0.1, 2.1, WD, M4(0, 0.78, 0)), // 바닥
    box(1.7, 0.36, 0.08, WD2, M4(0, 0.98, -1.05)), box(0.08, 0.3, 2.1, WD2, M4(0.85, 0.96, 0)), box(0.08, 0.3, 2.1, WD2, M4(-0.85, 0.96, 0)), box(1.7, 0.5, 0.08, WD2, M4(0, 1.05, 1.05)), // 둘레
    box(1.5, 0.08, 0.42, '#c98f5a', M4(0, 1.18, 0.42)), box(1.5, 0.08, 0.42, '#c98f5a', M4(0, 1.18, -0.5)), // 벤치 둘 (앞을 봄)
    box(1.5, 0.36, 0.07, '#c98f5a', M4(0, 1.4, 0.2)), box(1.5, 0.36, 0.07, '#c98f5a', M4(0, 1.4, -0.72)), // 등받이
    cyl(0.03, 0.03, 2.3, WD2, M4(0.42, 0.95, 1.95, Math.PI / 2 - 0.08)), cyl(0.03, 0.03, 2.3, WD2, M4(-0.42, 0.95, 1.95, Math.PI / 2 - 0.08)), // 끌채
  ];
  for (const x of [0.8, -0.8]) for (const z of [0.98, -0.98]) P.push(cyl(0.035, 0.035, 2.0, '#5a3e26', M4(x, 1.8, z))); // 지붕 기둥 (#16: 앉은 사람 모자가 지붕을 뚫지 않게 높임)
  P.push(box(1.9, 0.06, 2.3, '#f3ecdc', M4(0, 2.82, 0)), box(1.92, 0.12, 0.08, '#ff8a1f', M4(0, 2.76, 1.15)), box(1.92, 0.12, 0.08, '#ff8a1f', M4(0, 2.76, -1.15))); // 천 지붕 (귤색 테)
  const body = mesh(P, !low); body0.add(body);
  const wheels = [0.95, -0.95].map((x) => { const w = new THREE.Group(); w.position.set(x, 0.5, -0.05); w.add(mesh([WHEEL(0.5, 0.08, '#5a3e26', M4()), WHEEL(0.12, 0.12, '#3a2a1a', M4()), ...[0, 1, 2, 3].map((k) => box(0.04, 0.9, 0.05, '#7a5432', M4(0, 0, 0, k * Math.PI / 4)))], !low)); body0.add(w); return w; });
  // 자리 (수레 기준): 앉은 엉덩이 자리
  const seats = [[0.38, 0.42], [-0.38, 0.42], [0.38, -0.5], [-0.38, -0.5]].slice(0, CART.seats).map(([x, z]) => new THREE.Vector3(x * CART.scale, 1.22 * CART.scale, z * CART.scale));
  return { g, pony, wheels, seats };
}
// 정류장: 나무 팻말(마차 그림) + 벤치. 팻말 위에 남은 시간 고리 (Sprite, 캔버스)
function cartIconTex() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#d9b98a'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#6a4a2c'; x.lineWidth = 8; x.strokeRect(4, 4, 120, 120);
  x.strokeStyle = '#2b2b2e'; x.fillStyle = '#2b2b2e'; x.lineWidth = 7; x.lineCap = 'round'; x.lineJoin = 'round';
  x.beginPath(); x.rect(22, 52, 50, 26); x.stroke(); x.beginPath(); x.moveTo(18, 48); x.lineTo(76, 48); x.stroke(); // 수레
  x.beginPath(); x.arc(46, 88, 13, 0, Math.PI * 2); x.stroke();
  x.beginPath(); x.moveTo(72, 70); x.lineTo(92, 64); x.stroke(); x.beginPath(); x.ellipse(98, 64, 12, 8, 0, 0, Math.PI * 2); x.fill(); x.beginPath(); x.moveTo(104, 60); x.lineTo(110, 44); x.lineTo(114, 56); x.fill(); // 말
  x.beginPath(); x.moveTo(92, 70); x.lineTo(90, 90); x.moveTo(104, 70); x.lineTo(106, 90); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function ringSprite() {
  const c = document.createElement('canvas'); c.width = c.height = 96; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, sizeAttenuation: false }));
  sp.scale.set(0.07, 0.07, 1); sp.renderOrder = 5; let last = -1;
  sp.userData.draw = (f, here) => { // f = 남은 비율(1 → 0), here = 마차가 서 있음
    const k = here ? -1 : Math.round(f * 60); if (k === last) return; last = k;
    const x = c.getContext('2d'); x.clearRect(0, 0, 96, 96);
    x.fillStyle = 'rgba(20,20,24,.6)'; x.beginPath(); x.arc(48, 48, 44, 0, Math.PI * 2); x.fill();
    x.lineWidth = 9; x.lineCap = 'round'; x.strokeStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.arc(48, 48, 32, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = '#ff8a1f'; x.beginPath(); if (here) x.arc(48, 48, 32, 0, Math.PI * 2); else x.arc(48, 48, 32, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - f)); x.stroke();
    // 가운데 작은 바퀴 그림
    x.strokeStyle = '#fff'; x.lineWidth = 5; x.beginPath(); x.arc(48, 48, 12, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.moveTo(36, 48); x.lineTo(60, 48); x.moveTo(48, 36); x.lineTo(48, 60); x.stroke();
    t.needsUpdate = true;
  };
  return sp;
}

export function createCart({ scene, height, low = false, col = null }) {
  const R = cartRoute();
  const C = buildCartMesh(low); scene.add(C.g);
  // 정류장
  const icon = cartIconTex();
  const stops = CART.stops.map((S, i) => {
    const q = R.side(S, 1), c = nsAlong(S.path, S.d), g = new THREE.Group();
    const y = height(q.x, q.z); g.position.set(q.x, y, q.z); g.rotation.y = Math.atan2(c.x - q.x, c.z - q.z); // 앞이 길
    g.add(mesh([cyl(0.07, 0.08, 2.4, '#6a4a2c', M4(-0.9, 1.2, 0)), box(0.1, 0.1, 0.1, '#6a4a2c', M4(-0.9, 2.42, 0)),
      box(1.6, 0.08, 0.45, '#b98a58', M4(0.5, 0.48, 0)), box(1.6, 0.42, 0.06, '#b98a58', M4(0.5, 0.78, -0.24, -0.12)), box(0.08, 0.46, 0.4, '#6a4a2c', M4(-0.22, 0.23, 0)), box(0.08, 0.46, 0.4, '#6a4a2c', M4(1.22, 0.23, 0))]));
    const board = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.72), new THREE.MeshToonMaterial({ map: icon, gradientMap: gradHard, side: THREE.DoubleSide }));
    board.position.set(-0.9, 2.0, 0.09); g.add(board);
    const ring = ringSprite(); ring.position.set(-0.9, 2.85, 0); g.add(ring);
    scene.add(g);
    g.updateMatrixWorld(true);
    if (col) { const p = new THREE.Vector3(-0.9, 0, 0).applyMatrix4(g.matrixWorld); col.add(p.x, p.z, 0.25); } // 팻말 기둥
    return { i, name: S.name, g, ring, pos: new THREE.Vector3(q.x, y, q.z), path: c };
  });
  const st = { now: 0, s: 0, heading: 0, moving: false, stop: -1, speed: 0, wheel: 0, phase: 0 };
  const pos = new THREE.Vector3(), _a = new THREE.Vector3();
  function place(now) {
    const c = cartState(now, R); Object.assign(st, c, { now });
    const p = R.at(c.s), h = p.dir + (c.dir < 0 ? Math.PI : 0);
    // 앞뒤 높이 차로 앞뒤 기울기
    const fx = Math.sin(h), fz = Math.cos(h), y0 = height(p.x - fx * 1.4, p.z - fz * 1.4), y1 = height(p.x + fx * 3.2, p.z + fz * 3.2);
    pos.set(p.x, height(p.x, p.z), p.z);
    // 방향은 부드럽게 (꺾인 곳·되돌아가는 곳)
    let dh = h - st.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); st.heading += st.inited ? dh * Math.min(1, 0.12 + (c.moving ? 0.1 : 0.05)) : dh; st.inited = true;
    C.g.position.copy(pos); C.g.rotation.set(-Math.atan2(y1 - y0, 4.6) * 0.8, st.heading, 0, 'YXZ');
  }
  function update(dt, now, eye) {
    place(now);
    st.wheel += st.speed * dt / (0.5 * CART.scale); C.wheels.forEach((w) => { w.rotation.x = st.wheel; });
    st.phase += dt * st.speed * 1.3; gait(C.pony, st.phase, st.speed > 0.3 ? 0.3 + st.speed * 0.03 : 0);
    // 정류장 고리: 가까운 곳만
    for (const S of stops) {
      const near = eye && S.pos.distanceTo(eye) < CART.ringR; S.ring.visible = !!near; if (!near) continue;
      const w = cartWait(S.i, now); S.ring.userData.draw(Math.min(1, w / CART.lap), w === 0);
    }
  }
  // 자리 i 의 월드 위치(엉덩이), 마차가 보는 방향
  function seat(i, out = new THREE.Vector3()) { C.g.updateMatrixWorld(true); return out.copy(C.seats[i % C.seats.length]).applyMatrix4(C.g.matrixWorld); }
  // 지금 탈 수 있는 정류장(마차가 서 있고 p 가 팻말이나 마차 가까이) 번호, 없으면 -1
  function boardable(p) {
    if (st.moving || st.stop < 0) return -1;
    const S = stops[st.stop];
    return Math.hypot(p.x - S.pos.x, p.z - S.pos.z) < CART.r || Math.hypot(p.x - pos.x, p.z - pos.z) < CART.cartR ? st.stop : -1;
  }
  // 정류장 쪽 내릴 자리 (팻말 앞 길가)
  const exitAt = (i) => { const q = nsAlong(CART.stops[i].path, CART.stops[i].d, CART.stops[i].path === 'approach' ? 1 : -1, CART.side - 1.6); return _a.set(q.x, height(q.x, q.z), q.z).clone(); };
  update(0, Date.now() / 1000);
  return { update, seat, boardable, exitAt, stops, pos, state: st, get heading() { return st.heading; }, mesh: C.g, route: R };
}

// ---------- 탈것 가게 (가게 거리 빈 터, 임시 모양) ----------
// 앞이 트인 나무 헛간: 뒷벽·옆벽 반쯤·귤색 차양 지붕, 안에 스케이트보드(벽에 기댐)·스쿠터·조랑말. 간판에 스쿠터 그림
export const RIDE_ICON = {
  skate: '<path d="M3 13h18l-1.5 2.5h-15z"/><circle cx="7" cy="18.5" r="1.6"/><circle cx="17" cy="18.5" r="1.6"/>',
  scoot: '<circle cx="5.5" cy="18" r="2.2"/><circle cx="18.5" cy="18" r="2.2"/><path d="M5.5 18h10l3-13M15.5 5h5"/>',
  horse: '<path d="M5 20v-6l2-3h7l3-4 3 1-1 3-2 1v8M8 14v6M14 14v6M17 7l1-3"/>',
};
export const RIDE_SHOP = { W: 7.2, D: 5.6, fore: 0.6, r: 6.5 };
export function createRideShop({ scene, height, site, low = false, col = null }) {
  const { W, D } = RIDE_SHOP, g = new THREE.Group();
  const y0 = Math.min(...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => { const s = Math.sin(site.rot), c = Math.cos(site.rot), lx = a * W / 2, lz = b * D / 2; return height(site.x + c * lx + s * lz, site.z - s * lx + c * lz); }));
  g.position.set(site.x, y0, site.z); g.rotation.y = site.rot; scene.add(g);
  const WD = '#b98a58', WD2 = '#7a5432', H = 3.7;
  const P = [
    box(W, 0.3, D, '#6b6f73', M4(0, 0.0, 0)), box(W - 0.2, 0.06, D - 0.2, '#c99a66', M4(0, 0.17, 0)), // 현무암 바닥 + 나무 마루
    box(W, H, 0.16, WD, M4(0, H / 2, -D / 2 + 0.08)), // 뒷벽
    box(0.16, H, D, WD, M4(W / 2 - 0.08, H / 2, 0)), box(0.16, H, D, WD, M4(-W / 2 + 0.08, H / 2, 0)), // 옆벽
    box(W + 0.5, 0.14, D + 1.2, WD2, M4(0, H + 0.2, 0.3, 0.12)), // 지붕 (앞으로 기움)
    box(W + 0.5, 0.5, 0.06, '#ff8a1f', M4(0, H - 0.05, D / 2 + 0.82)), // 차양 끝
    box(0.18, H, 0.18, WD2, M4(W / 2 - 0.1, H / 2, D / 2 - 0.1)), box(0.18, H, 0.18, WD2, M4(-W / 2 + 0.1, H / 2, D / 2 - 0.1)), // 앞 기둥
    box(W - 0.6, 0.08, 0.5, WD2, M4(0, 1.6, -D / 2 + 0.4)), // 뒷벽 선반
    box(0.1, 1.2, 0.1, WD2, M4(2.4, 0.8, 0.8)), box(1.2, 0.08, 0.08, WD2, M4(2.4, 1.3, 0.8)), // 말 매는 기둥
  ];
  for (let k = 0; k < 4; k++) P.push(box(W - 0.4, 0.04, 0.02, '#8a6440', M4(0, 0.5 + k * 0.7, -D / 2 + 0.17))); // 벽 판자 줄
  g.add(mesh(P, !low));
  // 진열: 벽에 기댄 스케이트보드 둘, 스쿠터, 조랑말
  const sk1 = buildSkate(); sk1.scale.setScalar(RIDES.size.skate); sk1.position.set(-2.6, 0.6, -D / 2 + 0.35); sk1.rotation.set(-1.25, 0, 0); g.add(sk1);
  const sk2 = buildSkate(); sk2.scale.setScalar(RIDES.size.skate); sk2.position.set(-1.9, 1.64, -D / 2 + 0.4); sk2.rotation.set(0, Math.PI / 2, 0); g.add(sk2);
  const sc = buildScoot(); sc.scale.setScalar(RIDES.size.scoot); sc.position.set(-0.6, 0.2, 0.2); sc.rotation.y = 0.5; g.add(sc);
  const po = buildPony({ scale: RIDES.size.horse }); po.root.position.set(1.6, 0.2, -0.4); po.root.rotation.y = -0.35; g.add(po.root);
  // 간판: 스쿠터·말 그림
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#2f3336'; x.fillRect(0, 0, 512, 128); x.strokeStyle = '#ff8a1f'; x.lineWidth = 8; x.strokeRect(4, 4, 504, 120);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  ['skate', 'scoot', 'horse'].forEach((k, i) => { const img = new Image(); img.onload = () => { x.drawImage(img, 76 + i * 136, 14, 100, 100); tex.needsUpdate = true; }; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100" height="100" fill="none" stroke="#f3ecdc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${RIDE_ICON[k]}</svg>`); });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: tex })); sign.position.set(0, H - 0.15, D / 2 + 0.86); sign.rotation.x = -0.12; g.add(sign);
  g.updateMatrixWorld(true);
  const w = (lx, lz, ly = 0) => new THREE.Vector3(lx, ly, lz).applyMatrix4(g.matrixWorld);
  if (col) { const b = w(0, -0.5); col.addBox(b.x, b.z, site.rot, W / 2 - 0.2, D / 2 - 0.9); }
  const door = w(0, D / 2 + 1.6); door.y = height(door.x, door.z);
  return { door, signPos: w(0, D / 2 + 0.86, H), update() {}, group: g };
}
