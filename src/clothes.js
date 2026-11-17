// 옷 모양 (#52): balance.js CLOTHES 의 look 값으로 코드에서 만드는 로우폴리 옷
// - 좌표는 기본 자세(T포즈, 키 0.98) 기준. 몸통·팔·다리를 감싸는 관(tube)과 껍질(shell)로 만들고, runner 가 몸과 같은 뼈대로 휘게 붙임
// - 옷을 입으면 몸 메시에 구운 재킷·반바지·운동화·배낭은 감춤(hide 'body', 손만 남김). 그래서 맨살(팔뚝·종아리)도 여기서 'skin' 재질로 만듦
// - 재질 이름: main 바탕, acc 포인트, skin 피부색(runner 가 피부색을 넣음), foot 발(양말을 신으면 양말 색, 아니면 피부색)
// - 겹치는 순서(안 → 밖): 피부 < 양말 < 바지 < 티셔츠 < 잠바 < 베스트
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CLOTHES } from './balance.js';

const SE = 2.6; // 몸통 단면 모양 (2 = 타원, 클수록 네모에 가까움)
// 몸통 단면: [y, 반폭, 앞 z, 뒤 z]
const TORSO = [[0.17, 0.188, 0.172, -0.085], [0.23, 0.2, 0.19, -0.11], [0.3, 0.205, 0.2, -0.125], [0.38, 0.203, 0.195, -0.128], [0.46, 0.197, 0.185, -0.128], [0.52, 0.188, 0.17, -0.12], [0.56, 0.165, 0.15, -0.1], [0.59, 0.12, 0.125, -0.075], [0.615, 0.085, 0.1, -0.05]];
const HIPS = [[0.12, 0.168, 0.138, -0.052], [0.16, 0.176, 0.152, -0.062], [0.22, 0.18, 0.16, -0.072], [0.3, 0.178, 0.165, -0.085]];
const ARM = { y: 0.507, z: 0.04 }; // 팔 중심선
const LEG = { x: 0.098, z: 0.035 }; // 다리 중심
const pw = (v) => Math.sign(v) * Math.pow(Math.abs(v), 2 / SE);
const prof = (T, y) => { if (y <= T[0][0]) return T[0]; for (let i = 1; i < T.length; i++) if (y <= T[i][0]) { const a = T[i - 1], b = T[i], k = (y - a[0]) / (b[0] - a[0]); return a.map((v, j) => v + (b[j] - v) * k); } return T[T.length - 1]; };
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
const dark = (c, k = 0.82) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
const side2 = (m) => { m.side = THREE.DoubleSide; return m; };

// ---- 팔·다리 맨살 ----
const forearms = (skin) => both((s) => mesh(tube('x', s * 0.27, s * 0.395, 0.05, 0.044, [ARM.y, ARM.z], { capHi: true }), skin));
const shins = (skin, top = 0.14) => both((s) => mesh(tube('y', 0.03, top, 0.048, 0.054, [s * LEG.x, LEG.z], { capLo: true }), skin));
// 몸통에 붙는 띠 (줄무늬·반사띠·벨트)
const band = (m, y0, y1, pad, open = 0) => mesh(shell(TORSO, y0, y1, pad, { rows: 1, open }), m);

// ---- 티셔츠 ----
function tee(mat, L) {
  const M = mat('main', L.main), A = mat('acc', L.acc), out = [mesh(shell(TORSO, 0.205, 0.615, 0), M)];
  if (L.long) out.push(...both((s) => mesh(tube('x', s * 0.14, s * 0.37, 0.072, 0.058, [ARM.y, ARM.z]), M)), ...both((s) => mesh(tube('x', s * 0.36, s * 0.39, 0.061, 0.059, [ARM.y, ARM.z], { rows: 1, capHi: true }), A)));
  else out.push(...both((s) => mesh(tube('x', s * 0.14, s * 0.29, 0.072, 0.066, [ARM.y, ARM.z]), M)), ...both((s) => mesh(tube('x', s * 0.275, s * 0.295, 0.069, 0.069, [ARM.y, ARM.z], { rows: 1 }), A)), ...forearms(mat('skin', '#e8bf99')));
  for (let i = 0; i < (L.stripes || 0); i++) { const y = 0.27 + i * 0.075; out.push(band(A, y, y + 0.032, 0.003)); }
  if (L.panel) out.push(band(A, 0.5, 0.6, 0.004), ...both((s) => mesh(tube('x', s * 0.15, s * 0.23, 0.075, 0.073, [ARM.y, ARM.z], { rows: 1 }), A)));
  const col = new THREE.Mesh(new THREE.TorusGeometry(0.093, 0.016, 6, 18), L.collar ? mat('collar', L.collar) : A); col.rotation.x = Math.PI / 2; col.position.set(0, 0.6, 0.025); col.scale.set(1, 1.1, 1); out.push(col);
  return G(out);
}
// ---- 바지 ----
function pants(mat, L) {
  const M = mat('main', L.main), A = mat('acc', L.acc), out = [mesh(shell(HIPS, 0.125, 0.3, 0, { rows: 4, capLo: true }), M)];
  if (L.kind === 'shorts') {
    out.push(...both((s) => mesh(tube('y', 0.105, 0.2, 0.084, 0.082, [s * LEG.x, LEG.z]), M)), ...both((s) => mesh(tube('y', 0.1, 0.12, 0.086, 0.085, [s * LEG.x, LEG.z], { rows: 1, capLo: true }), A)), ...shins(mat('skin', '#e8bf99'), 0.12));
  } else {
    out.push(...both((s) => mesh(tube('y', 0.035, 0.2, 0.066, 0.084, [s * LEG.x, LEG.z], { rows: 4 }), M)), ...both((s) => mesh(tube('y', 0.03, 0.058, 0.069, 0.07, [s * LEG.x, LEG.z], { rows: 1, capLo: true }), A)));
    if (L.knee) out.push(...both((s) => at(new RoundedBoxGeometry(0.08, 0.05, 0.03, 2, 0.012), A, s * LEG.x, 0.115, LEG.z + 0.074)));
  }
  if (L.pockets) out.push(...both((s) => at(new RoundedBoxGeometry(0.03, 0.06, 0.07, 2, 0.01), A, s * 0.186, L.kind === 'shorts' ? 0.16 : 0.14, LEG.z)));
  if (L.belt) { out.push(mesh(shell(HIPS, 0.265, 0.3, 0.006, { rows: 1 }), A)); out.push(at(new RoundedBoxGeometry(0.05, 0.04, 0.02, 2, 0.008), mat('buckle', '#3f9a5a'), 0, 0.282, prof(HIPS, 0.28)[2] + 0.014)); }
  return G(out);
}
// ---- 베스트 (앞이 트인 조끼, 가장 바깥) ----
function vest(mat, L) {
  const M = mat('main', L.main), A = mat('acc', L.acc), pad = L.puff ? 0.05 : 0.04, open = 0.42, out = [mesh(shell(TORSO, 0.25, 0.585, pad, { rows: 7, open }), side2(M))];
  if (L.puff) { const S = mat('seam', dark(L.main, 0.78)); [0.33, 0.42, 0.51].forEach((y) => out.push(band(S, y, y + 0.012, pad + 0.004, open))); }
  if (L.bands) [0.34, 0.45].forEach((y) => out.push(band(L.leaf ? mat('band', '#fff4e0') : A, y, y + 0.032, pad + 0.004, open)));
  const pk = L.pockets || 0, spots = [[1, 0.32], [-1, 0.32], [1, 0.44], [-1, 0.44]].slice(0, pk === 1 ? 2 : pk === 2 ? 2 : 4);
  if (pk) spots.forEach(([s, y]) => out.push(at(new RoundedBoxGeometry(0.075, 0.062, 0.026, 2, 0.01), A, s * 0.115, y, frontZ(y, pad) - 0.016)));
  if (pk >= 3) out.push(at(new RoundedBoxGeometry(0.05, 0.045, 0.024, 2, 0.008), A, 0.12, 0.52, frontZ(0.52, pad) - 0.018));
  if (L.leaf) { out.push(at(new THREE.SphereGeometry(0.03, 10, 8), mat('gyul', '#ffb347'), -0.12, 0.53, frontZ(0.53, pad) - 0.004)); const lf = at(new THREE.SphereGeometry(0.022, 8, 6), mat('leaf', '#3f9a5a'), -0.095, 0.56, frontZ(0.56, pad) - 0.01); lf.scale.set(1.3, 0.55, 0.5); out.push(lf); }
  return G(out);
}
// ---- 잠바 (긴소매, 티셔츠 위) ----
function jacket(mat, L) {
  const M = mat('main', L.main), A = mat('acc', L.acc), pad = L.puff ? 0.026 : 0.018;
  const out = [mesh(shell(TORSO, 0.16, 0.6, pad, { rows: 9 }), M), ...both((s) => mesh(tube('x', s * 0.13, s * 0.375, 0.086, 0.07, [ARM.y, ARM.z]), M))];
  out.push(at(new THREE.BoxGeometry(0.016, 0.43, 0.012), A, 0, 0.385, frontZ(0.385, pad) - 0.002)); // 지퍼
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.13, 0.06, 18, 1, true), side2(M)); col.position.set(0, 0.615, 0.025); col.scale.z = 1.12; out.push(col);
  if (L.cuffs) out.push(...both((s) => mesh(tube('x', s * 0.355, s * 0.385, 0.074, 0.072, [ARM.y, ARM.z], { rows: 1, capHi: true }), A)));
  if (L.hood) { const h = at(new THREE.SphereGeometry(0.15, 14, 10), M, 0, 0.6, -0.1); h.scale.set(1.25, 0.62, 0.95); out.push(h); }
  if (L.puff) { const S = mat('seam', dark(L.main, 0.78)); [0.28, 0.38, 0.48].forEach((y) => out.push(band(S, y, y + 0.012, pad + 0.003))); }
  if (L.bands) { const B = mat('band', '#e8ecef'); out.push(band(B, 0.22, 0.25, pad + 0.004), ...both((s) => mesh(tube('x', s * 0.3, s * 0.325, 0.081, 0.081, [ARM.y, ARM.z], { rows: 1 }), B))); }
  return G(out);
}
// ---- 양말 ----
function socks(mat, L) {
  const M = mat('main', L.main), A = mat('acc', L.acc), h = L.h || 0.11, r = L.thick ? 0.064 : 0.058, out = [];
  out.push(...both((s) => mesh(tube('y', 0.02, h, r - 0.003, r, [s * LEG.x, LEG.z], { rows: 2, capLo: true }), M)));
  out.push(...both((s) => mesh(tube('y', h - 0.022, h, r + 0.004, r + 0.004, [s * LEG.x, LEG.z], { rows: 1 }), A)));
  for (let i = 0; i < (L.stripes || 0); i++) { const y = h - 0.05 - i * 0.03; out.push(...both((s) => mesh(tube('y', y, y + 0.014, r + 0.002, r + 0.002, [s * LEG.x, LEG.z], { rows: 1 }), A))); }
  if (L.dots) { const D = mat('dots', L.dots); for (const s of [1, -1]) for (let i = 0; i < 4; i++) { const th = (i / 4) * Math.PI * 2 + 0.4, y = 0.07 + (i % 2) * 0.04; out.push(at(new THREE.SphereGeometry(0.012, 6, 4), D, s * LEG.x + Math.cos(th) * r, y, LEG.z + Math.sin(th) * r * 1.06)); } }
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
export const CLOTH_BUILD = { tee, shorts: pants, long: pants, vest, jacket, socks, cap: hat, straw: hat, bucket: hat, boonie: hat, flower: hat };
// 쓰레빠 (신발 1단계): 맨발(또는 양말) + 얇은 밑창 + 끈
export const slippers = (mat) => {
  const F = mat('foot', '#e8bf99'), S = mat('sole', '#3c8fd0'), B = mat('strap', '#2f6db5');
  return G(both((s) => [at(new RoundedBoxGeometry(0.11, 0.06, 0.2, 2, 0.026), F, s * 0.106, 0.052, 0.075), at(new RoundedBoxGeometry(0.13, 0.024, 0.235, 2, 0.01), S, s * 0.106, 0.012, 0.078), at(new RoundedBoxGeometry(0.124, 0.03, 0.05, 2, 0.012), B, s * 0.106, 0.07, 0.12)]));
};
// ACCESSORIES 에 옷을 붙임 (gear.js 가 부름)
export function addClothes(ACC) {
  CLOTHES.forEach((c) => {
    const L = c.look || {}, f = CLOTH_BUILD[L.kind] || (c.slot === 'hat' ? hat : c.slot === 'top' ? tee : c.slot === 'bottom' ? pants : c.slot === 'vest' ? vest : c.slot === 'jacket' ? jacket : socks);
    const rigid = c.slot === 'hat';
    ACC[c.id] = { slot: c.slot, label: c.name, tier: c.tier, cloth: true, ...(rigid ? { bone: 'head' } : { skin: true }), hide: c.slot === 'top' || c.slot === 'bottom' ? ['body'] : [], foot: c.slot === 'socks' ? L.main : undefined,
      build: (mat) => f(mat, { kind: c.slot === 'top' ? 'tee' : c.slot === 'hat' ? 'cap' : 'socks', main: '#bbbbbb', acc: '#888888', ...L }) };
  });
}
