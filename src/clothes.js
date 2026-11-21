// 옷 모양 (#52): balance.js CLOTHES 의 look 값으로 코드에서 만드는 로우폴리 옷
// - 좌표는 기본 자세(T포즈, 키 0.98) 기준. 몸통·팔·다리를 감싸는 관(tube)과 껍질(shell)로 만들고, runner 가 몸과 같은 뼈대로 휘게 붙임
// - #106: 옷은 기본 몸(basebody.js) 위에 얹는 껍데기. 맨살(팔뚝·종아리·발)은 몸이 그리고, 옷이 덮는 몸 부위는 covers 로 감춤
// - 재질 이름: main 바탕, acc 포인트 (양말 색은 runner 가 몸의 발 색으로 넣음)
// - 겹치는 순서(안 → 밖): 피부 < 양말 < 바지 < 티셔츠 < 잠바 < 베스트
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CLOTHES } from './balance.js';

const SE = 2.6; // 몸통 단면 모양 (2 = 타원, 클수록 네모에 가까움)
// 몸통 단면: [y, 반폭, 앞 z, 뒤 z]
// #177 체형: 다리(가랑이 아래)를 키의 약 27%로 늘리고 그만큼 배·골반을 줄임. 어깨 위(팔·목·머리)와 발은 그대로
// 몸통은 어깨(0.52) 반폭 0.185 > 허리(0.42) 0.171 < 골반 0.166 + 다리. 티셔츠(TORSO)가 바지(HIPS) 바깥에 오게 겹치는 곳(0.33~0.4)은 TORSO 가 조금 넓음
export const TORSO = [[0.33, 0.174, 0.158, -0.08], [0.38, 0.174, 0.162, -0.092], [0.42, 0.171, 0.162, -0.098], [0.47, 0.18, 0.165, -0.105], [0.52, 0.185, 0.16, -0.108], [0.56, 0.163, 0.142, -0.093], [0.59, 0.12, 0.12, -0.072], [0.615, 0.085, 0.1, -0.05]];
export const HIPS = [[0.265, 0.152, 0.122, -0.045], [0.29, 0.16, 0.135, -0.056], [0.33, 0.165, 0.143, -0.066], [0.4, 0.166, 0.152, -0.085]];
export const ARM = { y: 0.507, z: 0.04 }; // 팔 중심선
export const LEG = { x: 0.098, z: 0.035 }; // 다리 중심
// 몸 높이 (#177): 가랑이(몸통 아래 끝)·골반 관절(다리 뼈 머리, runner 의 hipY)·허벅지/정강이 나눔(바지 덮기 경계, 반바지 끝단보다 위)
export const BODY = { crotch: 0.265, hipY: 0.34, knee: 0.22 };
// 다리 단면 [y, 반지름] (위 → 아래). 양말·긴바지가 이 표를 따라 감쌈
export const LEG_R = [[0.36, 0.074], [0.32, 0.073], [0.28, 0.071], [0.24, 0.067], [0.2, 0.063], [0.165, 0.058], [0.13, 0.054], [0.095, 0.051], [0.065, 0.049], [0.045, 0.047]];
export const legR = (y) => { const T = LEG_R; if (y >= T[0][0]) return T[0][1]; for (let i = 1; i < T.length; i++) if (y >= T[i][0]) { const a = T[i - 1], b = T[i], k = (a[0] - y) / (a[0] - b[0]); return a[1] + (b[1] - a[1]) * k; } return T[T.length - 1][1]; };
export const pw = (v) => Math.sign(v) * Math.pow(Math.abs(v), 2 / SE);
export const prof = (T, y) => { if (y <= T[0][0]) return T[0]; for (let i = 1; i < T.length; i++) if (y <= T[i][0]) { const a = T[i - 1], b = T[i], k = (y - a[0]) / (b[0] - a[0]); return a.map((v, j) => v + (b[j] - v) * k); } return T[T.length - 1]; };
export const frontZ = (y, pad = 0) => prof(TORSO, y)[2] + pad;

// 바깥을 보게 삼각형 방향 맞춤. out(무게중심) 또는 고정 방향(Vector3) = 바깥
function orient(pos, idx, from, to, out) {
  const P = (i) => new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
  for (let t = from; t < to; t += 3) {
    const a = P(idx[t]), b = P(idx[t + 1]), c = P(idx[t + 2]);
    const n = b.clone().sub(a).cross(c.clone().sub(a)), d = out.isVector3 ? out : out(a.add(b).add(c).multiplyScalar(1 / 3));
    if (n.dot(d) < 0) { const s = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = s; }
  }
}
// 고리(ring)를 줄줄이 이어 붙인 면. closed 면 끝과 처음을 이음. caps: [고리 번호, 가운데 점, 바깥 방향]
function sweep(rings, closed, out, caps = []) {
  const pos = [], idx = [], n = rings[0].length;
  rings.forEach((ring) => ring.forEach((p) => pos.push(...p)));
  const cols = closed ? n : n - 1;
  for (let r = 0; r < rings.length - 1; r++) for (let c = 0; c < cols; c++) {
    const a = r * n + c, b = r * n + (c + 1) % n, d = a + n, e = b + n; idx.push(a, d, b, b, d, e);
  }
  orient(pos, idx, 0, idx.length, out);
  caps.forEach(([ri, center, dir]) => { const ci = pos.length / 3, i0 = idx.length; pos.push(...center); for (let c = 0; c < cols; c++) idx.push(ci, ri * n + c, ri * n + (c + 1) % n); orient(pos, idx, i0, idx.length, dir); });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// 몸통 껍질: T 단면을 따라 y0~y1, pad 만큼 부풀림. open: 앞쪽(+z)을 이 각도(rad)만큼 양옆으로 틔움 (조끼)
export function shell(T, y0, y1, pad, { rows = 8, n = 18, open = 0, capLo = false } = {}) {
  const rings = [], a0 = open ? Math.PI / 2 + open : 0, len = open ? Math.PI * 2 - open * 2 : Math.PI * 2, cnt = open ? n + 1 : n;
  for (let r = 0; r <= rows; r++) {
    const y = y0 + (y1 - y0) * r / rows, [, hw, zf, zb] = prof(T, y), ring = [];
    for (let c = 0; c < cnt; c++) { const th = a0 + len * c / n, cx = Math.cos(th), sz = Math.sin(th); ring.push([(hw + pad) * pw(cx), y, sz >= 0 ? (zf + pad) * pw(sz) : (zb - pad) * pw(-sz)]); }
    rings.push(ring);
  }
  const zc = (y) => { const p = prof(T, y); return (p[2] + p[3]) / 2; };
  return sweep(rings, !open, (m) => new THREE.Vector3(m.x, 0, m.z - zc(m.y)), capLo ? [[0, [0, y0, zc(y0)], new THREE.Vector3(0, -1, 0)]] : []);
}
// 관: axis 'y'(다리) 는 c = [x, z], axis 'x'(팔) 는 c = [y, z]. a0→a1 동안 반경 r0→r1. ez: z 방향 늘림. capLo·capHi: a0·a1 쪽 막음
export function tube(axis, a0, a1, r0, r1, c, { n = 12, rows = 3, ez = 1.06, capLo = false, capHi = false } = {}) {
  const rings = [], Y = axis === 'y', pt = (a, r, th) => Y ? [c[0] + r * Math.cos(th), a, c[1] + r * ez * Math.sin(th)] : [a, c[0] + r * Math.cos(th), c[1] + r * ez * Math.sin(th)];
  for (let i = 0; i <= rows; i++) { const k = i / rows, a = a0 + (a1 - a0) * k, r = r0 + (r1 - r0) * k, ring = []; for (let j = 0; j < n; j++) ring.push(pt(a, r, (j / n) * Math.PI * 2)); rings.push(ring); }
  const dir = (s) => Y ? new THREE.Vector3(0, s, 0) : new THREE.Vector3(s, 0, 0), sg = Math.sign(a1 - a0) || 1;
  const caps = []; if (capLo) caps.push([0, pt(a0, 0, 0), dir(-sg)]); if (capHi) caps.push([rows, pt(a1, 0, 0), dir(sg)]);
  return sweep(rings, true, (m) => Y ? new THREE.Vector3(m.x - c[0], 0, m.z - c[1]) : new THREE.Vector3(0, m.y - c[0], m.z - c[1]), caps);
}
const mesh = (g, m) => new THREE.Mesh(g, m);
const both = (f) => [f(1), f(-1)]; // 왼쪽·오른쪽
const at = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); return o; };
const G = (...ms) => { const g = new THREE.Group(); ms.flat(3).forEach((m) => m && g.add(m)); return g; };
export const dark = (c, k = 0.82) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
const side2 = (m) => { m.side = THREE.DoubleSide; return m; };

// 옷이 덮는 기본 몸 부위 (#106, basebody.js REGION)
export const COVER = { boots: ['foot', 'shin'],  tee: ['chest', 'waist', 'upperarm'], teeLong: ['chest', 'waist', 'upperarm', 'forearm'], shorts: ['pelvis', 'waist', 'thigh'], long: ['pelvis', 'waist', 'thigh', 'shin'], jacket: ['chest', 'waist', 'upperarm', 'forearm'] };
// 몸통에 붙는 띠 (줄무늬·반사띠·벨트)
const band = (m, y0, y1, pad, open = 0) => mesh(shell(TORSO, y0, y1, pad, { rows: 1, open }), m);

// ---- 티셔츠 ----
function tee(mat, L) {
  const M = mat('main', L.main), A = mat('acc', L.acc), out = [mesh(shell(TORSO, 0.345, 0.615, 0), M)];
  if (L.long) out.push(...both((s) => mesh(tube('x', s * 0.14, s * 0.37, 0.072, 0.058, [ARM.y, ARM.z]), M)), ...both((s) => mesh(tube('x', s * 0.36, s * 0.39, 0.061, 0.059, [ARM.y, ARM.z], { rows: 1, capHi: true }), A)));
  else out.push(...both((s) => mesh(tube('x', s * 0.14, s * 0.29, 0.072, 0.066, [ARM.y, ARM.z]), M)), ...both((s) => mesh(tube('x', s * 0.275, s * 0.295, 0.069, 0.069, [ARM.y, ARM.z], { rows: 1 }), A)));
  for (let i = 0; i < (L.stripes || 0); i++) { const y = 0.375 + i * 0.055; out.push(band(A, y, y + 0.026, 0.003)); }
  if (L.panel) out.push(band(A, 0.5, 0.6, 0.004), ...both((s) => mesh(tube('x', s * 0.15, s * 0.23, 0.075, 0.073, [ARM.y, ARM.z], { rows: 1 }), A)));
  if (L.gyul) { const Gm = mat('gyul', L.gyul), Lf = mat('leaf', '#3f9a5a'); [[-0.09, 0.5], [0.09, 0.5], [0, 0.445], [-0.11, 0.405], [0.11, 0.405]].forEach(([x, y]) => { const d = at(new THREE.SphereGeometry(0.022, 8, 6), Gm, x, y, frontZ(y, 0.002) - 0.004); d.scale.z = 0.35; out.push(d); out.push(at(new THREE.SphereGeometry(0.009, 6, 4), Lf, x + 0.012, y + 0.02, frontZ(y + 0.02, 0.002) - 0.004)); }); } // 못생긴 스웨터 귤 무늬 (#180)
  const col = new THREE.Mesh(new THREE.TorusGeometry(0.093, 0.016, 6, 18), L.collar ? mat('collar', L.collar) : A); col.rotation.x = Math.PI / 2; col.position.set(0, 0.6, 0.025); col.scale.set(1, 1.1, 1); out.push(col);
  return G(out);
}
// ---- 바지 ----
function pants(mat, L) {
  const M = mat('main', L.main), A = mat('acc', L.acc), out = [mesh(shell(HIPS, 0.262, 0.4, 0, { rows: 4, capLo: true }), M)];
  if (L.kind === 'shorts') {
    out.push(...both((s) => mesh(tube('y', 0.2, 0.34, 0.082, 0.085, [s * LEG.x, LEG.z]), M)), ...both((s) => mesh(tube('y', 0.195, 0.215, 0.086, 0.086, [s * LEG.x, LEG.z], { rows: 1, capLo: true }), A)));
  } else {
    out.push(...both((s) => mesh(tube('y', 0.035, 0.34, 0.068, 0.09, [s * LEG.x, LEG.z], { rows: 6 }), M)), ...both((s) => mesh(tube('y', 0.03, 0.058, 0.071, 0.072, [s * LEG.x, LEG.z], { rows: 1, capLo: true }), A)));
    if (L.knee) out.push(...both((s) => at(new RoundedBoxGeometry(0.08, 0.05, 0.03, 2, 0.012), A, s * LEG.x, 0.17, LEG.z + 0.08)));
  }
  if (L.pockets) out.push(...both((s) => at(new RoundedBoxGeometry(0.03, 0.06, 0.07, 2, 0.01), A, s * 0.172, L.kind === 'shorts' ? 0.29 : 0.285, LEG.z)));
  if (L.belt) { out.push(mesh(shell(HIPS, 0.325, 0.352, 0.006, { rows: 1 }), A)); out.push(at(new RoundedBoxGeometry(0.05, 0.03, 0.02, 2, 0.008), mat('buckle', '#3f9a5a'), 0, 0.329, prof(HIPS, 0.329)[2] + 0.014)); }
  return G(out);
}
// ---- 베스트 (앞이 트인 조끼, 가장 바깥) ----
function vest(mat, L) {
  const M = mat('main', L.main), A = mat('acc', L.acc), pad = L.puff ? 0.05 : 0.04, open = 0.42, out = [mesh(shell(TORSO, 0.37, 0.585, pad, { rows: 7, open }), side2(M))];
  if (L.puff) { const S = mat('seam', dark(L.main, 0.78)); [0.42, 0.48, 0.54].forEach((y) => out.push(band(S, y, y + 0.012, pad + 0.004, open))); }
  if (L.bands) [0.42, 0.5].forEach((y) => out.push(band(L.leaf ? mat('band', '#fff4e0') : A, y, y + 0.032, pad + 0.004, open)));
  const pk = L.pockets || 0, spots = [[1, 0.41], [-1, 0.41], [1, 0.49], [-1, 0.49]].slice(0, pk === 1 ? 2 : pk === 2 ? 2 : 4);
  if (pk) spots.forEach(([s, y]) => out.push(at(new RoundedBoxGeometry(0.075, 0.062, 0.026, 2, 0.01), A, s * 0.115, y, frontZ(y, pad) - 0.016)));
  if (pk >= 3) out.push(at(new RoundedBoxGeometry(0.05, 0.045, 0.024, 2, 0.008), A, 0.12, 0.52, frontZ(0.52, pad) - 0.018));
  if (L.leaf) { out.push(at(new THREE.SphereGeometry(0.03, 10, 8), mat('gyul', '#ffb347'), -0.12, 0.53, frontZ(0.53, pad) - 0.004)); const lf = at(new THREE.SphereGeometry(0.022, 8, 6), mat('leaf', '#3f9a5a'), -0.095, 0.56, frontZ(0.56, pad) - 0.01); lf.scale.set(1.3, 0.55, 0.5); out.push(lf); }
  return G(out);
}
// ---- 잠바 (긴소매, 티셔츠 위) ----
function jacket(mat, L) {
  const M = mat('main', L.main), A = mat('acc', L.acc), pad = L.puff ? 0.026 : 0.018;
  const out = [mesh(shell(TORSO, 0.31, 0.6, pad, { rows: 9 }), M), ...both((s) => mesh(tube('x', s * 0.13, s * 0.375, 0.086, 0.07, [ARM.y, ARM.z]), M))];
  out.push(at(new THREE.BoxGeometry(0.016, 0.28, 0.012), A, 0, 0.455, frontZ(0.455, pad) - 0.002)); // 지퍼
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.13, 0.06, 18, 1, true), side2(M)); col.position.set(0, 0.615, 0.025); col.scale.z = 1.12; out.push(col);
  if (L.cuffs) out.push(...both((s) => mesh(tube('x', s * 0.355, s * 0.385, 0.074, 0.072, [ARM.y, ARM.z], { rows: 1, capHi: true }), A)));
  if (L.hood) { const h = at(new THREE.SphereGeometry(0.15, 14, 10), M, 0, 0.6, -0.1); h.scale.set(1.25, 0.62, 0.95); out.push(h); }
  if (L.puff) { const S = mat('seam', dark(L.main, 0.78)); [0.38, 0.45, 0.52].forEach((y) => out.push(band(S, y, y + 0.012, pad + 0.003))); }
  if (L.bands) { const B = mat('band', '#e8ecef'); out.push(band(B, 0.335, 0.36, pad + 0.004), ...both((s) => mesh(tube('x', s * 0.3, s * 0.325, 0.081, 0.081, [ARM.y, ARM.z], { rows: 1 }), B))); }
  return G(out);
}
// ---- 양말 ----
function socks(mat, L) {
  // 목 높이 h 는 예전(짧은 다리) 기준 값 → 길어진 정강이에 맞춰 늘림 (#177). 굵기는 다리 단면(legR)을 따라 감쌈
  const M = mat('main', L.main), A = mat('acc', L.acc), h = 0.045 + ((L.h || 0.11) - 0.045) * 1.25, pad = L.thick ? 0.014 : 0.008, r = (y) => legR(y) + pad, out = [];
  out.push(...both((s) => mesh(tube('y', 0.02, h, r(0.04) - 0.003, r(h), [s * LEG.x, LEG.z], { rows: 3, capLo: true }), M)));
  out.push(...both((s) => mesh(tube('y', h - 0.022, h, r(h - 0.022) + 0.004, r(h) + 0.004, [s * LEG.x, LEG.z], { rows: 1 }), A)));
  for (let i = 0; i < (L.stripes || 0); i++) { const y = h - 0.055 - i * 0.032; out.push(...both((s) => mesh(tube('y', y, y + 0.014, r(y) + 0.002, r(y + 0.014) + 0.002, [s * LEG.x, LEG.z], { rows: 1 }), A))); }
  if (L.dots) { const D = mat('dots', L.dots); for (const s of [1, -1]) for (let i = 0; i < 4; i++) { const th = (i / 4) * Math.PI * 2 + 0.4, y = 0.075 + (i % 2) * 0.05; out.push(at(new THREE.SphereGeometry(0.012, 6, 4), D, s * LEG.x + Math.cos(th) * r(y), y, LEG.z + Math.sin(th) * r(y) * 1.06)); } }
  return G(out);
}
// ---- 목도리 (#180, 베스트 칸): 목을 두른 두꺼운 고리 + 앞에 늘어진 두 자락(끝에 흰 술)
function scarf(mat, L) {
  const M = mat('main', L.main), A = mat('acc', L.acc), out = [];
  const ring = at(new THREE.TorusGeometry(0.11, 0.04, 8, 20), M, 0, 0.6, 0.02); ring.rotation.x = Math.PI / 2 - 0.12; ring.scale.set(1.05, 1.15, 1); out.push(ring);
  [[0.05, 0.5, 0.16, 0.06], [-0.03, 0.47, 0.2, -0.04]].forEach(([x, y, h, r]) => {
    const z = frontZ(y, 0.03); const tail = at(new RoundedBoxGeometry(0.07, h, 0.03, 2, 0.012), M, x, y, z); tail.rotation.z = r; out.push(tail);
    out.push(at(new RoundedBoxGeometry(0.072, 0.02, 0.034, 2, 0.008), A, x + Math.sin(r) * h * 0.45, y - h / 2 + 0.01, z + 0.002));
  });
  return G(out);
}
// ---- 모자 (머리 뼈에 붙는 단단한 것). 머리 위 가운데 (0, 0.83, 0.045) ----
const HC = { y: 0.8, z: 0.042 };
function hat(mat, L) {
  const M = mat('main', L.main), A = mat('acc', L.acc), out = [];
  const crown = (rt, rb, h, y) => { const c = at(new THREE.CylinderGeometry(rt, rb, h, 22, 1), M, 0, y, HC.z); c.scale.z = 1.04; const top = at(new THREE.SphereGeometry(rt, 22, 6, 0, Math.PI * 2, 0, Math.PI / 2), M, 0, y + h / 2, HC.z); top.scale.set(1, 0.28, 1.04); return [c, top]; };
  if (L.kind === 'cap') {
    const d = at(new THREE.SphereGeometry(0.252, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), M, 0, HC.y, HC.z); d.scale.set(1, 0.76, 1.07); out.push(d);
    const brim = at(new THREE.CylinderGeometry(0.21, 0.21, 0.026, 18, 1, false, -Math.PI / 2, Math.PI), A, 0, HC.y + 0.02, HC.z + 0.17); brim.scale.z = 0.95; brim.rotation.x = 0.12; out.push(brim);
    out.push(at(new THREE.SphereGeometry(0.024, 8, 6), A, 0, HC.y + 0.19, HC.z));
  } else if (L.kind === 'straw') {
    out.push(...crown(0.205, 0.255, 0.17, HC.y + 0.105), at(new THREE.CylinderGeometry(0.42, 0.44, 0.02, 26, 1), M, 0, HC.y + 0.03, HC.z));
    out.push(at(new THREE.CylinderGeometry(0.258, 0.258, 0.045, 22, 1, true), side2(A), 0, HC.y + 0.06, HC.z));
  } else if (L.kind === 'santa') { // 산타 모자 (#180): 흰 털 테 + 뒤로 꺾인 빨간 고깔 + 방울
    const rim = at(new THREE.TorusGeometry(0.255, 0.05, 8, 26), A, 0, HC.y + 0.03, HC.z); rim.rotation.x = Math.PI / 2; rim.scale.set(1, 1.06, 1); out.push(rim);
    const cone = new THREE.Group(); cone.position.set(0, HC.y + 0.05, HC.z); cone.rotation.x = -0.55; out.push(cone);
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.42, 20, 3), M); c.position.y = 0.2; cone.add(c);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), A); pom.position.y = 0.42; cone.add(pom);
  } else if (L.kind === 'antler') { // 루돌프 머리띠 (#180): 머리 위를 넘는 띠 + 갈래 뿔 둘 + 작은 빨간 방울
    const bandG = new THREE.TorusGeometry(0.262, 0.016, 6, 24, Math.PI); const b = at(bandG, A, 0, HC.y - 0.07, HC.z - 0.01); b.scale.set(1.02, 1.05, 1); out.push(b); // 귀에서 귀로 머리 위를 넘음
    both((s) => {
      const g = new THREE.Group(); g.position.set(s * 0.12, HC.y + 0.16, HC.z - 0.01); g.rotation.z = -s * 0.35; out.push(g);
      const t = (h, x, y, rz) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, h, 6), M); m.position.set(x, y + h / 2 * Math.cos(rz), 0); m.rotation.z = rz; g.add(m); };
      t(0.2, 0, 0, 0); t(0.09, s * 0.03, 0.08, -s * 0.9); t(0.08, -s * 0.02, 0.13, s * 0.8);
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), A); bell.position.set(0, -0.01, 0); g.add(bell);
    });
  } else { // bucket · boonie · flower: 둥근 통 + 비스듬한 챙
    const wide = L.kind === 'boonie' ? 0.44 : L.kind === 'flower' ? 0.4 : 0.36;
    out.push(...crown(0.215, 0.258, 0.16, HC.y + 0.1));
    const br = at(new THREE.CylinderGeometry(0.257, wide, L.kind === 'boonie' ? 0.04 : 0.065, 26, 1, true), side2(M), 0, HC.y + 0.01, HC.z); out.push(br);
    out.push(at(new THREE.CylinderGeometry(0.262, 0.262, 0.04, 22, 1, true), side2(A), 0, HC.y + 0.055, HC.z)); // 띠
    if (L.kind === 'boonie') { both((s) => out.push(at(new THREE.SphereGeometry(0.018, 8, 6), A, s * 0.255, HC.y + 0.12, HC.z))); }
    if (L.kind === 'flower') { // 챙 끝 귤색 테 + 귤꽃 한 송이·잎·귤 하나
      const rim = at(new THREE.TorusGeometry(wide, 0.012, 6, 30), A, 0, HC.y - 0.022, HC.z); rim.rotation.x = Math.PI / 2; out.push(rim);
      const P = mat('petal', L.petal), fx = 0.17, fy = HC.y + 0.08, fz = HC.z + 0.2;
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2, p = at(new THREE.SphereGeometry(0.03, 8, 6), P, fx + Math.cos(a) * 0.036, fy + Math.sin(a) * 0.036, fz); p.scale.z = 0.4; out.push(p); }
      out.push(at(new THREE.SphereGeometry(0.02, 8, 6), A, fx, fy, fz + 0.012));
      const lf = mat('leaf', L.leaf); [[-0.07, 0.03, 0.6], [-0.03, -0.05, -0.5]].forEach(([dx, dy, r]) => { const l = at(new THREE.SphereGeometry(0.034, 8, 6), lf, fx + dx, fy + dy, fz - 0.005); l.scale.set(1.4, 0.55, 0.35); l.rotation.z = r; out.push(l); });
      out.push(at(new THREE.SphereGeometry(0.04, 10, 8), mat('gyul', '#ffa330'), fx - 0.1, fy - 0.01, fz - 0.03));
    }
  }
  return G(out);
}
// ---- 장화 (#167 '고진의 파란장화'): 무릎 아래까지 오는 고무장화. 발 상자 + 정강이를 감싸는 관 + 윗단·밑창은 더 어두운 색 ----
export function boots(mat, L) {
  const M = mat('main', L.main), A = mat('acc', L.acc), top = BODY.knee - 0.015, r = (y) => legR(y) + 0.022, out = [];
  out.push(...both((s) => [
    at(new RoundedBoxGeometry(0.146, 0.034, 0.25, 2, 0.014), A, s * 0.106, 0.017, 0.08), // 밑창
    at(new RoundedBoxGeometry(0.138, 0.085, 0.235, 3, 0.04), M, s * 0.106, 0.07, 0.078), // 발등
    mesh(tube('y', 0.05, top, r(0.06) + 0.006, r(top) + 0.012, [s * LEG.x, LEG.z], { rows: 4, capLo: true }), M), // 목
    mesh(tube('y', top - 0.03, top + 0.004, r(top - 0.03) + 0.016, r(top) + 0.018, [s * LEG.x, LEG.z], { rows: 1 }), A), // 윗단
  ]));
  return G(out);
}
export const HAT_CLIP = 0.97; // 모자 윗면 조금 아래: 머리카락(똥머리 등)이 이보다 위로 나오면 감춤 (#106)
export const CLOTH_BUILD = { tee, shorts: pants, long: pants, vest, jacket, socks, boots, cap: hat, straw: hat, bucket: hat, boonie: hat, flower: hat, santa: hat, antler: hat, scarf };
// 쓰레빠 (신발 1단계): 얇은 밑창 + 끈. 발(맨발·양말)은 기본 몸이 그림 (#106)
export const slippers = (mat, sole = '#3c8fd0', strap = '#2f6db5') => { // 색은 처음 고르기(#155)에서 바꿀 수 있음
  const S = mat('sole', sole), B = mat('strap', strap);
  return G(both((s) => [at(new RoundedBoxGeometry(0.13, 0.016, 0.235, 2, 0.007), S, s * 0.104, 0.008, 0.08), at(new RoundedBoxGeometry(0.128, 0.026, 0.05, 2, 0.011), B, s * 0.104, 0.062, 0.115)]));
};
// 옷 하나 → ACCESSORIES 항목. look 을 주면 그 모양 값으로 (처음 고르는 기본 옷 색 #155)
export function clothAcc(c, look = c.look) {
  const L = look || {}, f = CLOTH_BUILD[L.kind] || (c.slot === 'hat' ? hat : c.slot === 'top' ? tee : c.slot === 'bottom' ? pants : c.slot === 'vest' ? vest : c.slot === 'jacket' ? jacket : socks);
  const rigid = c.slot === 'hat';
  const covers = c.slot === 'top' ? (L.long ? COVER.teeLong : COVER.tee) : c.slot === 'bottom' ? (L.kind === 'long' ? COVER.long : COVER.shorts) : c.slot === 'jacket' ? COVER.jacket : [];
  return { slot: c.slot, label: c.name, tier: c.tier, cloth: true, ...(rigid ? { bone: 'head', clip: L.kind === 'antler' ? undefined : HAT_CLIP } : { skin: true }), covers, foot: c.slot === 'socks' ? L.main : undefined,
    build: (mat) => f(mat, { kind: c.slot === 'top' ? 'tee' : c.slot === 'hat' ? 'cap' : 'socks', main: '#bbbbbb', acc: '#888888', ...L }) };
}
// ACCESSORIES 에 옷을 붙임 (gear.js 가 부름)
export function addClothes(ACC) { CLOTHES.forEach((c) => { ACC[c.id] = clothAcc(c); }); }
