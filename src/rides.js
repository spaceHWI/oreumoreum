// 탈것 (#69): 스케이트보드·스쿠터·조랑말(개인 탈것) 모양·속도 계산, 오름 길을 오가는 마차·정류장
// 모양은 로우폴리 임시 (나중에 Tripo). 수치는 balance.js RIDES·CART
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gradHard } from './toon.js';
import { RIDES, CART } from './balance.js';
import { nsAlong, nsLen } from './namsongi.js';
import { ic } from './icons.js';

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
export function buildPony({ coat = '#8a5a36', mane = '#2a1e18', saddle = '#b8452f', scale = 1, tack = true, shaggy = false } = {}) {
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
  if (shaggy) hp.push(box(0.2, 0.42, 0.3, mane, M4(0, 0.52, 0.0, 0.5)), box(0.22, 0.14, 0.14, mane, M4(0, 0.7, 0.4, 0.9)), box(0.3, 0.05, 0.05, '#3a2a20', M4(0, 0.38, 0.6, 0.35)), box(0.04, 0.05, 0.6, '#3a2a20', M4(0.13, 0.33, 0.25, 0.35)), box(0.04, 0.05, 0.6, '#3a2a20', M4(-0.13, 0.33, 0.25, 0.35))); // 덥수룩한 갈기·앞머리·굴레
  head.add(mesh(hp));
  // 꼬리
  const tail = new THREE.Group(); tail.position.set(0, 1.18, -0.68); root.add(tail);
  tail.add(mesh(shaggy ? [box(0.16, 0.66, 0.14, mane, M4(0, -0.3, -0.06, 0.25)), box(0.1, 0.3, 0.1, mane, M4(0, -0.6, -0.12, 0.1))] : [box(0.12, 0.6, 0.1, mane, M4(0, -0.28, -0.06, 0.25))]));
  if (shaggy) b.geometry = mergeGeometries([b.geometry, box(0.3, 0.32, 0.12, '#3a2a20', M4(0, 1.08, 0.38)), box(0.76, 0.06, 0.06, '#3a2a20', M4(0, 1.36, 0.36))]); // 목사리(끌채에 거는 띠)
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

// 마차 모양 (#174 오름펑크): 제주 조랑말 + 노란 감귤 콘테나를 이어 붙인 짐칸, 나무 바퀴 둘, 양옆 긴 의자, 귤색·흰 줄무늬 천막,
// 앞에 밀짚모자 마부, 뒤에 '오름 순환' 손글씨 팻말과 초롱(밤에 켜짐). fast: 빠른 마차(#139)는 말 둘 + 깃발. 원점 = 바퀴 축 아래 땅, 앞 +z
// 그리기: 말 7(몸·머리·꼬리·다리 4) + 수레 1 + 바퀴 1 + 팻말 1 + 초롱 1 (+ 마부). 저사양은 천막 한 색·초롱 빛 없음
const CRATE = '#f2c12e', CRATE2 = '#d9a514', SLOT = '#6b5320';
// 콘테나 하나: 노란 상자 + 세로 갈비 + 손잡이 구멍(밖을 보는 면 nx, nz)
function crate(P, x, y, z, w, h, d, nx, nz) {
  P.push(box(w, h, d, CRATE, M4(x, y, z)), box(w + 0.02, 0.04, d + 0.02, CRATE2, M4(x, y + h / 2 - 0.02, z))); // 몸·윗테
  const along = nx ? d : w, k = along / 3;
  for (const t of [-k, k]) P.push(nx ? box(0.02, h * 0.8, 0.04, CRATE2, M4(x + nx * (w / 2 + 0.005), y - 0.02, z + t)) : box(0.04, h * 0.8, 0.02, CRATE2, M4(x + t, y - 0.02, z + nz * (d / 2 + 0.005))));
  P.push(nx ? box(0.02, 0.06, along * 0.3, SLOT, M4(x + nx * (w / 2 + 0.008), y + h * 0.22, z)) : box(along * 0.3, 0.06, 0.02, SLOT, M4(x, y + h * 0.22, z + nz * (d / 2 + 0.008))));
}
let signTex = null;
function cartSignTex() {
  if (signTex) return signTex;
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#e8cf9e'; x.fillRect(0, 0, 256, 128); x.strokeStyle = '#7a5432'; x.lineWidth = 10; x.strokeRect(5, 5, 246, 118);
  x.fillStyle = '#3a2a1a'; x.font = '700 50px "Nanum Pen Script", "Gaegu", "Noto Sans KR", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.save(); x.translate(128, 62); x.rotate(-0.04); x.fillText('오름 순환', 0, 0); x.restore();
  x.fillStyle = '#ff8a1f'; x.beginPath(); x.arc(28, 100, 9, 0, Math.PI * 2); x.fill(); x.beginPath(); x.arc(228, 100, 9, 0, Math.PI * 2); x.fill();
  signTex = new THREE.CanvasTexture(c); signTex.colorSpace = THREE.SRGBColorSpace; return signTex;
}
function buildCartMesh(low, { fast = false } = {}) {
  const g = new THREE.Group(), body0 = new THREE.Group(); body0.scale.setScalar(CART.scale); g.add(body0);
  const ps = RIDES.size.horse / CART.scale, coat = '#7a4a2a', mane = '#2a1e18';
  const ponies = (fast ? [0.5, -0.5] : [0]).map((x) => { const p = buildPony({ scale: ps, coat, mane, tack: false, shaggy: true }); p.root.position.set(x, 0, 2.3); body0.add(p.root); return p; });
  const WD = '#a8774a', WD2 = '#7a5432';
  const P = [
    box(1.7, 0.1, 2.1, WD, M4(0, 0.78, 0)), // 바닥 판
    cyl(0.03, 0.03, 2.3, WD2, M4(0.42, 0.95, 1.95, Math.PI / 2 - 0.08)), cyl(0.03, 0.03, 2.3, WD2, M4(-0.42, 0.95, 1.95, Math.PI / 2 - 0.08)), // 끌채
  ];
  if (fast) P.push(box(1.5, 0.05, 0.05, WD2, M4(0, 0.97, 3.05))); // 두 말을 잇는 가름대
  // 콘테나 짐칸: 양옆 셋씩(등받이 높이), 앞·뒤 둘씩(낮게)
  for (const s of [1, -1]) for (const z of [-0.68, 0, 0.68]) crate(P, s * 0.74, 1.08, z, 0.26, 0.5, 0.66, s, 0);
  for (const x of [-0.31, 0.31]) { crate(P, x, 0.99, 0.95, 0.6, 0.32, 0.22, 0, 1); crate(P, x, 0.99, -0.95, 0.6, 0.32, 0.22, 0, -1); }
  // 양옆 긴 의자(앉는 자리 CART.seatPos 가 이 위): 판 + 다리
  for (const s of [1, -1]) { P.push(box(0.4, 0.08, 1.7, '#c98f5a', M4(s * 0.41, 1.18, -0.04))); for (const z of [-0.75, 0.67]) P.push(box(0.06, 0.32, 0.06, WD2, M4(s * 0.41, 0.98, z))); }
  // 마부 자리: 앞 콘테나 위 널빤지
  P.push(box(0.7, 0.06, 0.32, '#c98f5a', M4(0, CART.driverPos[1] - 0.03, CART.driverPos[2])), box(0.08, 0.3, 0.08, WD2, M4(0.3, 1.05, CART.driverPos[2])), box(0.08, 0.3, 0.08, WD2, M4(-0.3, 1.05, CART.driverPos[2])));
  // 천막: 기둥 넷(앉은 사람 모자가 지붕을 뚫지 않게 높게, #16) + 박공 지붕 줄무늬
  for (const x of [0.8, -0.8]) for (const z of [0.98, -0.98]) P.push(cyl(0.035, 0.035, 2.0, '#5a3e26', M4(x, 1.8, z)));
  const N = low ? 1 : 4, slope = Math.atan2(0.22, 0.96);
  for (const s of [1, -1]) for (let i = 0; i < N; i++) {
    const w = 0.98 / N, cx = s * (w * (i + 0.5)), y = 3.02 - 0.22 * (Math.abs(cx) / 0.96);
    P.push(box(w / Math.cos(slope) + 0.01, 0.05, 2.36, low || i % 2 === 0 ? '#ff8a1f' : '#fbf3e4', M4(cx, y, 0, 0, 0, -s * slope)));
  }
  for (const z of [1.18, -1.18]) for (let i = 0; i < 6; i++) { const x = -0.9 + 0.36 * i; P.push(box(0.36, 0.1, 0.03, i % 2 && !low ? '#fbf3e4' : '#ff8a1f', M4(x + 0.18, 2.75, z))); } // 앞뒤 늘어진 단
  if (fast) P.push(cyl(0.025, 0.025, 1.1, '#5a3e26', M4(0.8, 3.4, -0.98)), piece(new THREE.CylinderGeometry(0.0, 0.32, 0.6, 3, 1), '#ff5a1f', M4(0.8, 3.72, -1.28, Math.PI / 2, 0, 0, 1, 1, 0.5))); // 깃발
  const body = mesh(P, !low); body0.add(body);
  // 바퀴 둘(한 축으로 같이 돎)
  const axle = new THREE.Group(); axle.position.set(0, 0.5, -0.05); body0.add(axle);
  const WP = []; for (const x of [0.95, -0.95]) WP.push(WHEEL(0.5, 0.08, '#5a3e26', M4(x)), WHEEL(0.12, 0.12, '#3a2a1a', M4(x)), ...[0, 1, 2, 3].map((k) => box(0.04, 0.9, 0.05, '#7a5432', M4(x, 0, 0, k * Math.PI / 4))));
  axle.add(mesh(WP, !low));
  const wheels = [axle];
  // 뒤 팻말 + 초롱
  if (!fast) { const sg = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), new THREE.MeshToonMaterial({ map: cartSignTex(), gradientMap: gradHard })); sg.position.set(0, 1.35, -1.08); sg.rotation.y = Math.PI; body0.add(sg); }
  const lanternMat = new THREE.MeshLambertMaterial({ color: '#ffb347', emissive: '#ff9a2e', emissiveIntensity: 0 });
  const lantern = new THREE.Mesh(mergeGeometries([new THREE.CylinderGeometry(0.11, 0.11, 0.2, 8).translate(0, -0.2, 0), new THREE.CylinderGeometry(0.06, 0.08, 0.05, 8).translate(0, -0.08, 0), new THREE.CylinderGeometry(0.01, 0.01, 0.12, 4)]), lanternMat);
  lantern.position.set(-0.86, 2.6, -1.04); body0.add(lantern);
  // 자리 (수레 기준): 앉은 엉덩이 자리
  const seats = CART.seatPos.slice(0, CART.seats).map(([x, y, z]) => new THREE.Vector3(x * CART.scale, y * CART.scale, z * CART.scale));
  return { g, pony: ponies[0], ponies, wheels, seats, lantern, lanternMat, body0 };
}
// 빠른 마차(#139) 세워 둔 모양: 말 둘 + 깃발, 마부·초롱 빛 없음
export function parkedFastCart(low) { const C = buildCartMesh(low, { fast: true }); C.lantern.visible = false; return C.g; }
// 정류장 팻말 글: 정류장 이름 + 다음 마차까지 (가까울 때만 다시 그림)
function stopBoard(name) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; let last = null;
  const draw = (line) => { if (line === last) return; last = line; const x = c.getContext('2d');
    x.fillStyle = '#d9b98a'; x.fillRect(0, 0, 256, 160); x.strokeStyle = '#6a4a2c'; x.lineWidth = 10; x.strokeRect(5, 5, 246, 150);
    x.fillStyle = '#2b2116'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '800 40px "Noto Sans KR", sans-serif'; x.fillText(name, 128, 52);
    x.fillStyle = '#b8452f'; x.font = '700 30px "Noto Sans KR", sans-serif'; x.fillText(line, 128, 112); t.needsUpdate = true; };
  draw('마차 정류장'); return { tex: t, draw };
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

// makeDriver: () => 러너 (마부, 밀짚모자). sfx(kind, 크기 0..1): 'hoof' 말발굽·'bell' 방울 (가까울 때만 부름)
export function createCart({ scene, height, low = false, col = null, makeDriver = null, sfx = null }) {
  const R = cartRoute();
  const C = buildCartMesh(low); scene.add(C.g);
  // 마부: 앞 널빤지에 걸터앉아 두 손으로 고삐 (서 있는 캐릭터를 'ride' 자세로)
  const driver = makeDriver ? makeDriver() : null;
  if (driver) { const [dx, dy, dz] = CART.driverPos; driver.root.position.set(dx, dy - RIDES.sitDrop / CART.scale, dz); driver.root.scale.setScalar(1 / CART.scale); C.body0.add(driver.root);
    for (let k = 0; k < 4; k++) driver.animate(0.1, { speed: 0, running: false, pose: 'ride', t: 1, lid: 0 }); }
  // 정류장: 현무암 돌기둥에 나무 팻말(이름·다음 마차까지), 작은 평상
  const stops = CART.stops.map((S, i) => {
    const q = R.side(S, 1), c = nsAlong(S.path, S.d), g = new THREE.Group();
    const y = height(q.x, q.z); g.position.set(q.x, y, q.z); g.rotation.y = Math.atan2(c.x - q.x, c.z - q.z); // 앞이 길
    const BS = '#4a4844', BS2 = '#5e5b55', WD = '#b98a58', WD2 = '#6a4a2c';
    g.add(mesh([piece(new THREE.CylinderGeometry(0.2, 0.26, 1.1, 6), BS, M4(-0.9, 0.55, 0, 0, 0.3)), piece(new THREE.CylinderGeometry(0.17, 0.2, 0.9, 6), BS2, M4(-0.9, 1.55, 0, 0.04, 0.9)), ball(0.16, BS, M4(-0.9, 2.05, 0, 0, 0, 0, 1, 0.6, 1), 0), // 돌기둥 (구멍 숭숭 현무암 느낌으로 두 덩이)
      box(0.08, 0.08, 0.12, WD2, M4(-0.9, 2.12, 0.18)), // 팻말 걸이
      box(1.7, 0.08, 1.0, WD, M4(0.55, 0.42, -0.1)), box(1.7, 0.03, 0.06, WD2, M4(0.55, 0.47, 0.38)), ...[[-0.25, 0.3], [1.35, 0.3], [-0.25, -0.5], [1.35, -0.5]].map(([x, z]) => box(0.08, 0.4, 0.08, WD2, M4(x, 0.2, z)))])); // 평상
    const B = stopBoard(S.name);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.56), new THREE.MeshToonMaterial({ map: B.tex, gradientMap: gradHard, side: THREE.DoubleSide }));
    board.position.set(-0.9, 1.75, 0.24); g.add(board);
    const ring = ringSprite(); ring.position.set(-0.9, 2.7, 0); g.add(ring);
    scene.add(g);
    g.updateMatrixWorld(true);
    if (col) { const p = new THREE.Vector3(-0.9, 0, 0).applyMatrix4(g.matrixWorld); col.add(p.x, p.z, 0.3); } // 돌기둥
    return { i, name: S.name, g, ring, board: B, pos: new THREE.Vector3(q.x, y, q.z), path: c };
  });
  const st = { now: 0, s: 0, heading: 0, moving: false, stop: -1, speed: 0, wheel: 0, phase: 0 };
  const pos = new THREE.Vector3(), _a = new THREE.Vector3();
  const blk = new Array(CART.block.length * 3).fill(0); if (col) col.setDyn(blk); // 움직이는 부딪힘 (#117)
  function place(now) {
    const c = cartState(now, R); Object.assign(st, c, { now });
    const p = R.at(c.s), h = p.dir + (c.dir < 0 ? Math.PI : 0);
    // 앞뒤 높이 차로 앞뒤 기울기
    const fx = Math.sin(h), fz = Math.cos(h), y0 = height(p.x - fx * 1.4, p.z - fz * 1.4), y1 = height(p.x + fx * 3.2, p.z + fz * 3.2);
    pos.set(p.x, height(p.x, p.z), p.z);
    // 방향은 부드럽게 (꺾인 곳·되돌아가는 곳)
    let dh = h - st.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); st.heading += st.inited ? dh * Math.min(1, 0.12 + (c.moving ? 0.1 : 0.05)) : dh; st.inited = true;
    C.g.position.copy(pos); C.g.rotation.set(-Math.atan2(y1 - y0, 4.6) * 0.8, st.heading, 0, 'YXZ');
    if (col) { // 부딪힘 자리도 함께 (#117)
      const s = Math.sin(st.heading), c = Math.cos(st.heading);
      CART.block.forEach(([lx, lz, r], k) => { blk[k * 3] = pos.x + c * lx + s * lz; blk[k * 3 + 1] = pos.z - s * lx + c * lz; blk[k * 3 + 2] = r; });
    }
  }
  const fx = { tail: 0, tailT: 3, bell: 2 };
  const d0 = (eye) => (eye ? Math.hypot(eye.x - pos.x, eye.z - pos.z) : 1e9);
  // night: 0 낮 .. 1 밤 (초롱)
  function update(dt, now, eye, night = 0) {
    place(now);
    st.wheel += st.speed * dt / (0.5 * CART.scale); C.wheels.forEach((w) => { w.rotation.x = st.wheel; });
    const ph0 = st.phase; st.phase += dt * st.speed * 1.3;
    C.ponies.forEach((p, k) => gait(p, st.phase + k * 0.6, st.speed > 0.3 ? 0.3 + st.speed * 0.03 : 0));
    // 가끔 꼬리를 침
    if ((fx.tailT -= dt) <= 0) { fx.tail = 0.9; fx.tailT = 4 + Math.random() * 6; }
    if (fx.tail > 0) { fx.tail -= dt; C.ponies.forEach((p) => { p.tail.rotation.z = Math.sin((0.9 - fx.tail) * 14) * 0.45 * (fx.tail / 0.9); }); }
    if (!low) C.lanternMat.emissiveIntensity = night * 1.6;
    if (driver) driver.root.visible = d0(eye) < (low ? CART.driverR * 0.6 : CART.driverR); // 마부는 가까울 때만 (사람 모델이라 무거움)
    // 소리: 가까울 때만. 말발굽은 걸음 반 바퀴마다, 방울은 가끔
    const d = eye ? Math.hypot(eye.x - pos.x, eye.z - pos.z) : 1e9;
    if (sfx && d < CART.soundR) {
      const vol = 1 - d / CART.soundR;
      if (st.speed > 0.3 && Math.floor(st.phase / Math.PI) !== Math.floor(ph0 / Math.PI)) sfx('hoof', vol);
      if ((fx.bell -= dt) <= 0) { fx.bell = st.speed > 0.3 ? 2.5 + Math.random() * 2 : 6 + Math.random() * 6; sfx('bell', vol); }
    }
    // 정류장 고리·팻말 글: 가까운 곳만
    for (const S of stops) {
      const near = eye && S.pos.distanceTo(eye) < CART.ringR; S.ring.visible = !!near; if (!near) continue;
      const w = cartWait(S.i, now); S.ring.userData.draw(Math.min(1, w / CART.lap), w === 0);
      S.board.draw(w === 0 ? '마차 와 있어요' : w < 60 ? `${Math.ceil(w / 10) * 10}초 뒤` : `${Math.ceil(w / 60)}분 뒤`);
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
  // 달리는 마차 수레까지 거리 (#120). 서 있으면 Infinity. 수레 앞뒤 [-bodyL, bodyL] 선분까지
  function runDist(p) {
    if (!st.moving) return Infinity;
    const s = Math.sin(st.heading), c = Math.cos(st.heading), dx = p.x - pos.x, dz = p.z - pos.z;
    const lz = Math.max(-CART.bodyL, Math.min(CART.bodyL, dx * s + dz * c)), ex = dx - s * lz, ez = dz - c * lz;
    return Math.hypot(ex, ez);
  }
  // 정류장 쪽 내릴 자리 (팻말 앞 길가)
  const exitAt = (i) => { const q = nsAlong(CART.stops[i].path, CART.stops[i].d, CART.stops[i].path === 'approach' ? 1 : -1, CART.side - 1.6); return _a.set(q.x, height(q.x, q.z), q.z).clone(); };
  update(0, Date.now() / 1000);
  return { update, seat, boardable, runDist, exitAt, stops, pos, block: blk, state: st, get heading() { return st.heading; }, mesh: C.g, route: R, driver };
}

// ---------- 탈것 가게 (가게 거리 빈 터, 임시 모양) ----------
// 앞이 트인 나무 헛간: 뒷벽·옆벽 반쯤·귤색 차양 지붕, 안에 스케이트보드(벽에 기댐)·스쿠터·조랑말. 간판에 스쿠터 그림
export const RIDE_ICON = {
  skate: ic('skate'),
  scoot: ic('ride'),
  horse: ic('horse'),
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
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: tex })); sign.position.set(0, H - 0.4, D / 2 + 1.0); sign.rotation.x = -0.06; g.add(sign); // 차양 앞에 걺 (#182)
  g.updateMatrixWorld(true);
  const w = (lx, lz, ly = 0) => new THREE.Vector3(lx, ly, lz).applyMatrix4(g.matrixWorld);
  if (col) { const b = w(0, -0.5); col.addBox(b.x, b.z, site.rot, W / 2 - 0.2, D / 2 - 0.9); }
  const door = w(0, D / 2 + 1.6); door.y = height(door.x, door.z);
  return { door, signPos: w(0, D / 2 + 0.86, H), update() {}, group: g };
}
