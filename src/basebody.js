// 기본 몸 (#106): 옷 없는 매끈한 몸 하나. 옷·장비는 이 위에 따로 얹는 껍데기(clothes.js·gear.js)
// - 좌표는 기본 자세(T포즈, 키 0.98) 기준. 몸통 단면은 옷(clothes.js TORSO·HIPS)과 같은 표에서 조금 안쪽(BODY_IN)으로 만들어 옷이 늘 몸 바깥에 있음
// - 조각: 몸통+목(한 덩어리), 팔 2(위팔·아래팔), 손 2(벙어리장갑 모양), 다리 2(허벅지·정강이), 발 2
// - 정점마다 부위 번호(region). 옷이 덮는 부위는 runner 가 hideR 로 그리지 않음 → 옷 사이로 몸이 뚫고 나오지 않음
//   부위 경계에서는 정점을 둘로 나눠 한 삼각형이 늘 한 부위에만 속함(법선은 나누기 전에 계산해 경계에 음영 금이 없음)
// - 피부색은 재질 색 하나(runner), 발은 양말 색을 따로 받음(cFoot)
// - 체형(남·여)은 bodyWarp 로 허리·골반 폭만 조금 다르게. 옷(휘는 것)도 같은 함수를 거쳐 몸에 맞음
import * as THREE from 'three';
import { TORSO, HIPS, ARM, LEG, prof, pw } from './clothes.js';

export const REGION = { neck: 0, chest: 1, waist: 2, pelvis: 3, upperarm: 4, forearm: 5, hand: 6, thigh: 7, shin: 8, foot: 9 };
export const REGION_N = 10;
const BODY_IN = 0.014; // 옷 안쪽으로 들어간 정도
const SE = 2.6;
// 몸통 단면 [y, 반폭, 앞 z, 뒤 z]: 아래는 골반(HIPS), 위는 가슴(TORSO), 0.2~0.3 에서 섞고 목은 가늘게 이어 머리 안까지
function trunkProf(y) {
  if (y > 0.615) { const k = Math.min(1, (y - 0.615) / 0.03); const a = prof(TORSO, 0.615); return [y, a[1] + (0.07 - a[1]) * k, a[2] + (0.09 - a[2]) * k, a[3] + (-0.04 - a[3]) * k]; }
  const h = prof(HIPS, y), t = prof(TORSO, y), k = Math.min(1, Math.max(0, (y - 0.2) / 0.1)), s = k * k * (3 - 2 * k);
  return h.map((v, i) => v + (t[i] - v) * s);
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// 체형: 여(f)는 허리를 조금 좁히고 골반을 조금 넓힘. 팔(T포즈 y 0.45 위)·발(0.1 아래)은 그대로
export function bodyWarp(pos, sex) {
  if (sex !== 'f') return pos;
  for (let i = 0; i < pos.length; i += 3) {
    const y = pos[i + 1]; if (y < 0.1 || y > 0.46) continue;
    const hip = smooth(0.1, 0.17, y) * (1 - smooth(0.22, 0.3, y)), waist = smooth(0.27, 0.34, y) * (1 - smooth(0.4, 0.46, y));
    pos[i] *= 1 + 0.045 * hip - 0.05 * waist;
  }
  return pos;
}
// 고리를 이어 만든 관(piece). rings: [[점...]...], capA·capB: [가운데 점, 바깥 방향]. out(가운데) → 바깥 방향 (삼각형 앞면을 맞춤)
function piece(rings, capA, capB, regionOf, out) {
  const n = rings[0].length, pos = [], idx = [];
  rings.forEach((r) => r.forEach((p) => pos.push(...p)));
  const V = (i) => new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
  const tri = (a, b, c, dir) => { const A = V(a), B = V(b), C = V(c), nn = B.clone().sub(A).cross(C.clone().sub(A)), d = dir || out(A.clone().add(B).add(C).multiplyScalar(1 / 3)); if (nn.dot(d) < 0) idx.push(a, c, b); else idx.push(a, b, c); };
  for (let r = 0; r < rings.length - 1; r++) for (let c = 0; c < n; c++) { const a = r * n + c, b = r * n + (c + 1) % n; tri(a, b, a + n); tri(b, b + n, a + n); }
  const cap = (ri, [ctr, dir]) => { const ci = pos.length / 3; pos.push(...ctr); const D = new THREE.Vector3(...dir); for (let c = 0; c < n; c++) tri(ci, ri * n + c, ri * n + (c + 1) % n, D); };
  if (capA) cap(0, capA); if (capB) cap(rings.length - 1, capB);
  return finish(pos, idx, regionOf);
}
// 법선 계산 → 삼각형마다 부위(가운데 점으로) → 경계 정점을 부위별로 나눔
function finish(pos, idx, regionOf) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  g.computeVertexNormals();
  const nor = g.attributes.normal.array, P = [], N = [], R = [], I = [], map = new Map();
  for (let t = 0; t < idx.length; t += 3) {
    const cy = (pos[idx[t] * 3 + 1] + pos[idx[t + 1] * 3 + 1] + pos[idx[t + 2] * 3 + 1]) / 3, cx = (pos[idx[t] * 3] + pos[idx[t + 1] * 3] + pos[idx[t + 2] * 3]) / 3;
    const reg = regionOf(cx, cy);
    for (let k = 0; k < 3; k++) { const v = idx[t + k], key = v * 16 + reg; let o = map.get(key);
      if (o == null) { o = P.length / 3; map.set(key, o); P.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); N.push(nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]); R.push(reg); }
      I.push(o); }
  }
  return { P, N, R, I };
}
// 몸통: 아래(가랑이)는 막고 위(목)는 머리 안에서 막음
function trunk() {
  const n = 22, ys = [0.115, 0.13, 0.15, 0.175, 0.2, 0.23, 0.26, 0.3, 0.34, 0.38, 0.42, 0.46, 0.5, 0.53, 0.555, 0.575, 0.595, 0.615, 0.635, 0.66];
  const rings = ys.map((y) => { const [, hw0, zf0, zb0] = trunkProf(y), hw = hw0 - BODY_IN, zf = zf0 - BODY_IN, zb = zb0 + BODY_IN, ring = [];
    for (let c = 0; c < n; c++) { const th = (c / n) * Math.PI * 2, cx = Math.cos(th), sz = Math.sin(th); ring.push([hw * pw(cx, SE), y, sz >= 0 ? zf * pw(sz, SE) : zb * pw(-sz, SE)]); }
    return ring; });
  const zc = (y) => { const p = trunkProf(y); return (p[2] + p[3]) / 2; };
  return piece(rings, [[0, 0.105, zc(0.115)], [0, -1, 0]], [[0, 0.665, zc(0.66)], [0, 1, 0]], (x, y) => (y > 0.57 ? REGION.neck : y > 0.3 ? REGION.chest : y > 0.2 ? REGION.waist : REGION.pelvis),
    (m) => new THREE.Vector3(m.x, 0, m.z - zc(m.y)));
}
// 팔: x 축 관. s = +1 왼쪽(+x), -1 오른쪽. [x, 반지름]
const ARM_R = [[0.125, 0.064], [0.155, 0.064], [0.185, 0.062], [0.215, 0.06], [0.245, 0.056], [0.27, 0.053], [0.3, 0.05], [0.335, 0.047], [0.37, 0.044], [0.395, 0.042]];
function arm(s) {
  const n = 14, ez = 1.06;
  const rings = ARM_R.map(([x, r]) => { const ring = []; for (let c = 0; c < n; c++) { const th = (c / n) * Math.PI * 2; ring.push([s * x, ARM.y + r * Math.cos(th), ARM.z + r * ez * Math.sin(th)]); } return ring; });
  return piece(rings, null, [[s * 0.4, ARM.y, ARM.z], [s, 0, 0]], (x) => (Math.abs(x) > 0.272 ? REGION.forearm : REGION.upperarm), (m) => new THREE.Vector3(0, m.y - ARM.y, m.z - ARM.z));
}
// 다리: y 축 관 (위 → 아래). [y, 반지름]
const LEG_R = [[0.25, 0.074], [0.215, 0.073], [0.18, 0.07], [0.15, 0.066], [0.118, 0.059], [0.09, 0.053], [0.065, 0.049], [0.045, 0.047]];
function leg(s) {
  const n = 14, ez = 1.06, cx = s * LEG.x;
  const rings = LEG_R.map(([y, r]) => { const ring = []; for (let c = 0; c < n; c++) { const th = (c / n) * Math.PI * 2; ring.push([cx + r * Math.cos(th), y, LEG.z + r * ez * Math.sin(th)]); } return ring; });
  return piece(rings, null, [[cx, 0.035, LEG.z], [0, -1, 0]], (x, y) => (y > 0.117 ? REGION.thigh : REGION.shin), (m) => new THREE.Vector3(m.x - cx, 0, m.z - LEG.z));
}
// 둥근 덩어리(손·발): 늘린 구
function blob(c, r, region, ws = 14, hs = 10) {
  const g = new THREE.SphereGeometry(1, ws, hs); g.scale(r[0], r[1], r[2]); g.translate(c[0], c[1], c[2]); g.computeVertexNormals();
  const P = Array.from(g.attributes.position.array), N = Array.from(g.attributes.normal.array), I = Array.from(g.index.array), R = new Array(P.length / 3).fill(region);
  return { P, N, R, I };
}
const hand = (s) => [blob([s * 0.43, ARM.y - 0.002, ARM.z + 0.005], [0.052, 0.03, 0.052], REGION.hand), blob([s * 0.41, ARM.y + 0.004, ARM.z + 0.06], [0.026, 0.02, 0.026], REGION.hand, 10, 8)];
const foot = (s) => blob([s * (LEG.x + 0.005), 0.042, 0.082], [0.058, 0.042, 0.1], REGION.foot);

const cache = {};
// 몸 메시 하나(BufferGeometry: position·normal·region). 체형마다 한 번 만들어 둠
export function baseBodyGeo(sex = 'm') {
  if (cache[sex]) return cache[sex];
  const parts = [trunk(), arm(1), arm(-1), ...hand(1), ...hand(-1), leg(1), leg(-1), foot(1), foot(-1)];
  const P = [], N = [], R = [], I = [];
  parts.forEach((p) => { const o = P.length / 3; P.push(...p.P); N.push(...p.N); R.push(...p.R); p.I.forEach((i) => I.push(i + o)); });
  const pos = bodyWarp(new Float32Array(P), sex);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('region', new THREE.Float32BufferAttribute(R, 1)); g.setIndex(I);
  return (cache[sex] = g);
}
// 몸 재질 패치: 덮인 부위는 그리지 않음(정점을 화면 밖으로 접어 삼각형이 사라짐), 발은 양말 색
export const patchBody = (U) => (sh) => {
  sh.uniforms.hideR = U.hideR; sh.uniforms.cFoot = U.cFoot;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\nattribute float region; uniform float hideR[${REGION_N}]; varying float vFoot;`)
    .replace('#include <project_vertex>', `#include <project_vertex>\nvFoot = step(${REGION.foot - 0.5}, region) * step(region, ${REGION.foot + 0.5});\nif (hideR[int(region + 0.5)] > 0.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);`);
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 cFoot; varying float vFoot;')
    .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, cFoot, step(0.5, vFoot));');
};
// 장비가 가리는 부위 목록 → hideR 값
export function hideMask(list, out) { for (let i = 0; i < REGION_N; i++) out[i] = 0; list.forEach((k) => { if (REGION[k] != null) out[REGION[k]] = 1; }); return out; }
