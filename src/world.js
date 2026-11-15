import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { G, softMat, fluffyGeo, cedarGeo as mkCedar, skyDome, cloudShadow, seaMat, roundNormals, createEoksae, LOW } from './gfx2.js';

// 다랑쉬오름 절차 지형 — 1 unit ≈ 1.9m (비고 약 227m를 rim 120 units로)
export const R_RIM = 110;
export const R_BASE = 340;
export const H_RIM = 120;
export const SUMMIT_A = -Math.PI / 2; // 북쪽(-z)이 정상
export const EXTENT = 620;
export const WALL_R = 470;
export const SEG = 190;

const rimH = (a) => H_RIM + 12 * Math.cos(a - SUMMIT_A) + 3 * Math.sin(3 * a + 1);
export const smooth = (t) => t * t * (3 - 2 * t);

// 아끈다랑쉬 — 동남쪽 작은 굼부리
const AKKEUN = { x: 330, z: 300, r: 95, h: 26 };

// 다른 맵(돈내코)이 지형 함수를 갈아끼울 수 있게
let altImpl = null; // { height(x,z), surface(x,z), color(x,z,h,c) }
export function setMapImpl(impl) { altImpl = impl; }
export function heightAnalytic(x, z) {
  if (altImpl) return altImpl.height(x, z);
  const r = Math.hypot(x, z);
  const a = Math.atan2(z, x);
  const rh = rimH(a);
  let h;
  if (r < R_RIM) {
    const t = r / R_RIM;
    h = rh - 72 * (1 - t * t) * (1 - 0.15 * t);
    h += 1.2 * Math.sin(a * 7) * Math.sin(t * Math.PI) + 0.8 * Math.sin(r * 0.3);
  } else if (r < R_BASE) {
    const t = (r - R_RIM) / (R_BASE - R_RIM);
    h = rh * Math.pow(1 - t, 1.55);
    h += 2.2 * Math.sin(a * 9 + r * 0.05) * Math.sin(t * Math.PI);
  } else {
    h = 0;
  }
  // 능선을 완만한 둔덕으로 (메시 해상도와 맞추기 위해)
  const d = r - R_RIM;
  if (Math.abs(d) < 7) { const w = smooth(1 - Math.abs(d) / 7); h = h * (1 - w) + (rh - 0.08 * d * d) * w; }
  // 바깥 들판 기복
  h += 1.6 * Math.sin(x * 0.012) * Math.cos(z * 0.015) * smooth(Math.min(1, Math.max(0, (r - 200) / 200)));
  // 아끈다랑쉬
  const dx = x - AKKEUN.x, dz = z - AKKEUN.z;
  const ra = Math.hypot(dx, dz);
  if (ra < AKKEUN.r) {
    const t = ra / AKKEUN.r;
    const ring = t < 0.45 ? (AKKEUN.h - 12 * (1 - (t / 0.45) ** 2)) : AKKEUN.h * Math.pow(1 - (t - 0.45) / 0.55, 1.4);
    h = Math.max(h, ring);
  }
  return h;
}

// 탐방로: 남쪽 입구에서 시계 반대 방향으로 감아 올라 분화구 둘레에 닿음
export const TRAIL_START_A = Math.PI / 2;
const SWEEP = -1.25 * Math.PI;
export const trail = [];
{
  const N = 420;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = TRAIL_START_A + SWEEP * t;
    const r = (R_BASE + 35) - (R_BASE + 35 - (R_RIM + 1)) * Math.pow(t, 0.9);
    trail.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
  }
}
export const TRAIL_END_A = TRAIL_START_A + SWEEP;

function distToTrail(x, z) {
  let best = 1e9, bi = 0;
  for (let i = 0; i < trail.length - 1; i++) {
    const p = trail[i], q = trail[i + 1];
    const vx = q.x - p.x, vz = q.y - p.y;
    const wx = x - p.x, wz = z - p.y;
    const tt = Math.max(0, Math.min(1, (wx * vx + wz * vz) / (vx * vx + vz * vz)));
    const d = Math.hypot(wx - vx * tt, wz - vz * tt);
    if (d < best) { best = d; bi = i; }
  }
  return [best, bi];
}

// 표면 종류 격자: 0 풀, 1 송이길, 2 계단, 3 둘레 흙길
export const SURF_RES = 2;
const SURF_N = Math.ceil((EXTENT * 2) / SURF_RES);
const surf = new Uint8Array(SURF_N * SURF_N);
export function surfaceAt(x, z) {
  if (altImpl) return altImpl.surface(x, z);
  const i = Math.floor((x + EXTENT) / SURF_RES), j = Math.floor((z + EXTENT) / SURF_RES);
  if (i < 0 || j < 0 || i >= SURF_N || j >= SURF_N) return 0;
  return surf[j * SURF_N + i];
}
function fillSurface() {
  const bound = R_BASE + 60;
  for (let j = 0; j < SURF_N; j++) {
    const z = -EXTENT + (j + 0.5) * SURF_RES;
    if (Math.abs(z) > bound) continue;
    for (let i = 0; i < SURF_N; i++) {
      const x = -EXTENT + (i + 0.5) * SURF_RES;
      const r = Math.hypot(x, z);
      if (r > bound) continue;
      if (Math.abs(r - R_RIM) < 3.2) { surf[j * SURF_N + i] = 3; continue; }
      if (r < R_RIM - 4) continue;
      const [d] = distToTrail(x, z);
      if (d < 3.2) surf[j * SURF_N + i] = r < 255 ? 2 : 1;
    }
  }
}

export function hash(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
export function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  const u = smooth(xf), v = smooth(zf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export const PAL = {
  grass: new THREE.Color('#62a644'),
  grassDark: new THREE.Color('#3f8a3c'),
  eoksae: new THREE.Color('#c2c47c'),
  eoksae2: new THREE.Color('#aab266'),
  songi: new THREE.Color('#9c4a33'),
  dirt: new THREE.Color('#8a6a4a'),
  crater: new THREE.Color('#6fae4a'),
  field: new THREE.Color('#7db552'),
  field2: new THREE.Color('#a2cc5e'),
};

// 메시 삼각형 기준 높이 샘플러: 발이 지면에 정확히 붙도록 (각진 곳에서 뜨는 문제 방지)
let meshPos = null, meshN = 0, meshCell = 1, meshExt = EXTENT;
export function height(x, z) {
  if (!meshPos) return heightAnalytic(x, z);
  const u = (x + meshExt) / meshCell, v = (z + meshExt) / meshCell;
  let ix = Math.floor(u), iz = Math.floor(v);
  if (ix < 0 || iz < 0 || ix >= meshN - 1 || iz >= meshN - 1) return heightAnalytic(x, z);
  const fu = u - ix, fv = v - iz;
  const H = (i, j) => meshPos[((j * meshN) + i) * 3 + 1];
  const a = H(ix, iz), b = H(ix, iz + 1), c = H(ix + 1, iz + 1), d = H(ix + 1, iz);
  // PlaneGeometry 삼각형: (a,b,d) 와 (b,c,d), 대각선 u+v=1
  if (fu + fv <= 1) return a + (d - a) * fu + (b - a) * fv;
  return c + (b - c) * (1 - fu) + (d - c) * (1 - fv);
}
export function buildTerrain() {
  if (!altImpl) fillSurface();
  const ext = altImpl?.extent || EXTENT, seg = altImpl?.seg || SEG;
  const geo = new THREE.PlaneGeometry(ext * 2, ext * 2, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAnalytic(x, z);
    pos.setY(i, h);
    groundColor(x, z, c, h);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, dithering: true });
  cloudShadow(mat);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'terrain';
  // 샘플러 등록 (정점 순서: ix가 빠르게, iz가 느리게 증가. x,z 모두 -EXTENT부터)
  meshPos = pos.array; meshN = seg + 1; meshCell = (ext * 2) / seg; meshExt = ext;
  if (Math.abs(pos.getX(0) + ext) > 1e-3 || Math.abs(pos.getZ(0) + ext) > 1e-3 || Math.abs(pos.getX(1) - pos.getX(0) - meshCell) > 1e-3) { meshPos = null; }
  return mesh;
}
export function groundColor(x, z, c, h = heightAnalytic(x, z)) {
  {
    const r = Math.hypot(x, z);
    const n = vnoise(x * 0.03, z * 0.03);
    const n2 = vnoise(x * 0.11 + 7, z * 0.11 - 3);
    const s = surfaceAt(x, z);
    if (altImpl) altImpl.color(x, z, h, c, n, n2);
    else if (s === 1 || s === 2) c.copy(PAL.songi).lerp(PAL.dirt, n2 * 0.4);
    else if (s === 3) c.copy(PAL.dirt).lerp(PAL.songi, 0.25);
    else if (r < R_RIM - 3) c.copy(PAL.crater).lerp(PAL.grassDark, n * 0.6).lerp(PAL.eoksae, Math.max(0, n2 - 0.6));
    else if (r < R_BASE + 10) {
      const e = smooth(Math.min(1, Math.max(0, (n - 0.35) * 3)));
      c.copy(PAL.grass).lerp(PAL.grassDark, (1 - n2) * 0.35).lerp(PAL.eoksae, e * 0.6).lerp(PAL.eoksae2, n2 * 0.2 * e);
    } else {
      // 밭과 들판 — 제주 밭담 느낌의 조각 무늬
      const cell = hash(Math.floor(x / 60), Math.floor(z / 45));
      c.copy(PAL.field).lerp(PAL.field2, cell).lerp(PAL.grassDark, n * 0.25);
    }
  }
  return c;
}

export function trailDir(i) {
  const p = trail[Math.max(0, i - 1)], q = trail[Math.min(trail.length - 1, i + 1)];
  return Math.atan2(q.x - p.x, q.y - p.y);
}

// 장식: 계단, 억새, 삼나무, 먼 오름
// 접지 그림자: 나무·구조물 발밑에 깔리는 어두운 원판 (그림자맵이 못 잡는 먼 곳까지 싸게 땅에 붙여 줌)
const contactGeo = new THREE.CircleGeometry(1, 10); contactGeo.rotateX(-Math.PI / 2);
const contactMat = new THREE.MeshBasicMaterial({ color: '#26331f', transparent: true, opacity: 0.26, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
export function contactShadows(scene, items, baseR, lift = 0.07) {
  if (!items.length) return null;
  const im = new THREE.InstancedMesh(contactGeo, contactMat, items.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3();
  items.forEach(([x, z, s], k) => { const r = baseR * (s || 1); one.set(r, 1, r * 0.85); m.compose(new THREE.Vector3(x, height(x, z) + lift, z), q, one); im.setMatrixAt(k, m); });
  im.renderOrder = -1; im.frustumCulled = false; scene.add(im); return im;
}

// 밟을 수 있는 구조물(계단·데크): 회전된 직사각형 윗면. 4m 격자로 찾음
const walkGrid = new Map();
const WCELL = 4;
export function addWalkable(x, z, rotY, hx, hz, top) {
  const w = { x, z, c: Math.cos(rotY), s: Math.sin(rotY), hx, hz, top };
  const R = Math.hypot(hx, hz);
  for (let gx = Math.floor((x - R) / WCELL); gx <= Math.floor((x + R) / WCELL); gx++)
    for (let gz = Math.floor((z - R) / WCELL); gz <= Math.floor((z + R) / WCELL); gz++) {
      const k = gx * 100003 + gz; if (!walkGrid.has(k)) walkGrid.set(k, []); walkGrid.get(k).push(w);
    }
}
export function groundAt(x, z) {
  let y = height(x, z);
  const list = walkGrid.get(Math.floor(x / WCELL) * 100003 + Math.floor(z / WCELL));
  if (list) for (const w of list) {
    const dx = x - w.x, dz = z - w.z;
    // 로컬 좌표 (three.js Y 회전: x' = c*dx - s*dz, z' = s*dx + c*dz)
    const lx = w.c * dx - w.s * dz, lz = w.s * dx + w.c * dz;
    if (Math.abs(lx) <= w.hx && Math.abs(lz) <= w.hz && w.top > y) y = w.top;
  }
  return y;
}
export function buildDecor(scene) {
  const wood = new THREE.MeshLambertMaterial({ color: '#9a7449', flatShading: true });
  // 계단: 탐방로 상부
  const steps = [];
  let acc = 0;
  for (let i = 1; i < trail.length; i++) {
    const p = trail[i - 1], q = trail[i];
    acc += p.distanceTo(q);
    const r = q.length();
    if (r < 255 && acc > 1.15) { acc = 0; steps.push(i); }
  }
  const stepGeo = new THREE.BoxGeometry(4.8, 0.9, 1.05); stepGeo.translate(0, -0.34, 0); // 디딤판 아래를 막아 공중에 뜬 틈이 없게
  const stepMesh = new THREE.InstancedMesh(stepGeo, wood, steps.length);
  stepMesh.castShadow = true; stepMesh.receiveShadow = true;
  const m = new THREE.Matrix4(), qn = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
  steps.forEach((i, k) => {
    const p = trail[i];
    e.set(0, trailDir(i), 0);
    qn.setFromEuler(e);
    const sy = height(p.x, p.y) - 0.08;
    m.compose(new THREE.Vector3(p.x, sy, p.y), qn, one);
    stepMesh.setMatrixAt(k, m);
    addWalkable(p.x, p.y, trailDir(i), 2.4, 0.525, sy + 0.11);
  });
  scene.add(stepMesh);

  // 로프 난간 기둥
  const postGeo = new THREE.BoxGeometry(0.25, 1.2, 0.25);
  const posts = [];
  for (let i = 4; i < trail.length; i += 6) posts.push(i);
  const postMesh = new THREE.InstancedMesh(postGeo, wood, posts.length * 2);
  postMesh.castShadow = true;
  posts.forEach((i, k) => {
    const p = trail[i];
    const d = trailDir(i);
    const nx = Math.cos(d) * 3.4, nz = -Math.sin(d) * 3.4;
    [1, -1].forEach((sgn, s) => {
      const x = p.x + nx * sgn, z = p.y + nz * sgn;
      m.makeTranslation(x, height(x, z) + 0.5, z);
      postMesh.setMatrixAt(k * 2 + s, m);
    });
  });
  scene.add(postMesh);

  // 억새밭: 가는 줄기 + 은빛 이삭, 바람에 흔들림. 억새 군락 노이즈가 높은 곳에 빽빽하게
  let seed = 1;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const eok = [];
  let tries = 0;
  // 억새는 오름 사면에만, 서너 줄기씩 포기로 모여 군락을 이룸 (들판에는 없음)
  const EOK_N = LOW ? 30000 : 70000;
  while (eok.length < EOK_N && tries++ < 400000) {
    const a = rnd() * Math.PI * 2, r = R_RIM + 4 + rnd() * (R_BASE - R_RIM - 40);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (surfaceAt(x, z) !== 0) continue;
    const n = vnoise(x * 0.03, z * 0.03) * 0.75 + vnoise(x * 0.11 + 5, z * 0.11) * 0.25;
    const edge = Math.min(1, (R_BASE - 40 - r) / 50);
    if (n < 0.5 || rnd() > (n - 0.46) * 3.2 * edge) continue;
    const k = 5 + Math.floor(rnd() * 5), hh = 1.5 + rnd() * 1.1;
    for (let q = 0; q < k; q++) { const ex = x + (rnd() - 0.5) * 0.8, ez = z + (rnd() - 0.5) * 0.8; if (surfaceAt(ex, ez) === 0) eok.push([ex, ez, hh * (0.8 + rnd() * 0.4)]); }
  }
  createEoksae({ scene, list: eok, height });

  // 나무: 밭담을 따라 삼나무 방풍림, 군데군데 팽나무·소나무 군락 (노이즈로 자연스럽게)
  const treeMat = softMat({ a: G.cedarA, b: G.cedarB, wind: 0.6 }); const farTreeMat = softMat({ a: G.cedarA, b: G.cedarB });
  const treeMat2 = softMat({ a: G.cedarA, b: G.leafB, wind: 0.6 });
  const broadMat = softMat({ a: G.leafA, b: G.leafB, wind: 1 }); const broadMat2 = softMat({ a: G.leaf2A, b: G.leaf2B, wind: 1 });
  const trunkMat = softMat({ a: '#5a4030', b: '#a07a56' });
  const cedar = [], cedar2 = [], broad = [], trunks = [];
  const okSpot = (x, z) => Math.hypot(x, z) > R_BASE + 40 && Math.hypot(x - AKKEUN.x, z - AKKEUN.z) > AKKEUN.r + 10 && !(Math.abs(x) < 10 && z > 0);
  // 방풍림: 밭담 선을 따라 띄엄띄엄 (빈 구간이 있어야 자연스러움)
  // 방풍림: 짧은 토막들이 밭담 모서리를 따라 띄엄띄엄, 각 토막은 살짝 휘고 두 줄로 흐트러짐
  for (let seg = 0; seg < 70; seg++) {
    const horiz = rnd() < 0.55;
    const cx = (rnd() - 0.5) * 1100, cz = (rnd() - 0.5) * 1100;
    const len = 25 + rnd() * 70, ang = (horiz ? 0 : Math.PI / 2) + (rnd() - 0.5) * 0.35;
    const bend = (rnd() - 0.5) * 0.02;
    for (let t = -len / 2; t < len / 2; t += 3.2 + rnd() * 3.5) {
      const off = (rnd() - 0.5) * 3 + Math.sin(t * 0.3) * 1.2 + bend * t * t;
      const x = cx + Math.cos(ang) * t - Math.sin(ang) * off, z = cz + Math.sin(ang) * t + Math.cos(ang) * off;
      if (!okSpot(x, z) || rnd() < 0.12) continue;
      (rnd() < 0.7 ? cedar : cedar2).push([x, z, 0.55 + rnd() * 0.8, rnd() * 6.28]);
    }
  }
  // 흩어진 나무 몇 그루
  for (let i = 0; i < 140; i++) {
    const x = (rnd() - 0.5) * 1150, z = (rnd() - 0.5) * 1150;
    if (!okSpot(x, z) || vnoise(x * 0.01, z * 0.01) < 0.5) continue;
    (rnd() < 0.5 ? cedar : broad).push([x, z, 0.6 + rnd() * 0.8, rnd() * 6.28]);
  }
  // 팽나무·소나무 군락: 노이즈 봉우리 주변에 둥글게
  for (let g = 0; g < 26; g++) {
    const a = rnd() * Math.PI * 2, r = R_BASE + 60 + rnd() * 160;
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
    const n = 4 + Math.floor(rnd() * 9);
    for (let i = 0; i < n; i++) {
      const rr = rnd() * 14, aa = rnd() * Math.PI * 2;
      const x = cx + Math.cos(aa) * rr, z = cz + Math.sin(aa) * rr;
      if (!okSpot(x, z)) continue;
      broad.push([x, z, 0.7 + rnd() * 0.8, rnd() * 6.28]);
    }
  }
  // 오름 기슭 소나무 몇 그루
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2, r = R_BASE - 60 + rnd() * 70;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (surfaceAt(x, z) !== 0 || vnoise(x * 0.03, z * 0.03) > 0.5) continue;
    broad.push([x, z, 0.5 + rnd() * 0.5, rnd() * 6.28]);
  }
  const cedarGeo = mkCedar(4, 2.3, 4.4, 2.5, 3.2);
  const cedarGeo2 = mkCedar(3, 2.0, 4.2, 2.4, 3.0);
  const broadGeo = fluffyGeo(LOW ? 6 : 11, 3.0, 2.2, 5.0, 3, 1), broadGeo2 = fluffyGeo(LOW ? 5 : 8, 2.4, 2.0, 5.0, 8, 1);
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.55, 5.0, 7); trunkGeo.translate(0, 2.4, 0);
  const cTrunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 3.2, 6); cTrunkGeo.translate(0, 1.5, 0);
  const place = (list, geo, mat, sy) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([x, z, s, ry], k) => {
      e.set(0, ry, 0); qn.setFromEuler(e);
      m.compose(new THREE.Vector3(x, height(x, z) - 0.2, z), qn, new THREE.Vector3(s, s * sy, s));
      im.setMatrixAt(k, m);
    });
    im.castShadow = true; scene.add(im); return im;
  };
  place(cedar, cedarGeo, treeMat, 1);
  place(cedar2, cedarGeo2, treeMat2, 1.1);
  place(broad.filter((_, i) => i % 2 === 0), broadGeo, broadMat, 1);
  place(broad.filter((_, i) => i % 2 === 1), broadGeo2, broadMat2, 1);
  place([...cedar, ...cedar2], cTrunkGeo, trunkMat, 1);
  place(broad, trunkGeo, trunkMat, 1);
  contactShadows(scene, [...cedar, ...cedar2], 1.9);
  contactShadows(scene, broad, 3.0);

  // (돌담은 보기 안 좋아 제거. 활동 범위 WALL_R는 보이지 않는 경계로만 유지)

  // 들꽃: 억새 사이 (인스턴스, 색 4종)
  {
    const petal = new THREE.ConeGeometry(0.22, 0.12, 5, 1, true); petal.rotateX(Math.PI); petal.translate(0, 0.42, 0);
    const stem = new THREE.CylinderGeometry(0.02, 0.025, 0.42, 3); stem.translate(0, 0.21, 0);
    const colors = ['#f2c94c', '#e9719a', '#f3f0e4', '#8f7bd6'];
    const lists = colors.map(() => []);
    let tries = 0;
    while (tries++ < 9000 && lists.reduce((a, l) => a + l.length, 0) < 1400) {
      const a = rnd() * Math.PI * 2, r = R_RIM + 6 + rnd() * (R_BASE + 120 - R_RIM);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (surfaceAt(x, z) !== 0) continue;
      const n = vnoise(x * 0.05 + 11, z * 0.05 + 4);
      if (n < 0.55) continue;
      lists[Math.floor(vnoise(x * 0.01, z * 0.01) * 3.99) % 4].push([x, z, 0.8 + rnd() * 0.7]);
    }
    const stemMat = new THREE.MeshLambertMaterial({ color: '#5f8a3e' });
    lists.forEach((list, ci) => {
      if (!list.length) return;
      const pm = new THREE.InstancedMesh(petal, new THREE.MeshLambertMaterial({ color: colors[ci], emissive: colors[ci], emissiveIntensity: 0.25 }), list.length);
      const sm = new THREE.InstancedMesh(stem, stemMat, list.length);
      list.forEach(([x, z, sc], k) => {
        m.compose(new THREE.Vector3(x, height(x, z) - 0.05, z), qn.identity(), new THREE.Vector3(sc, sc, sc));
        pm.setMatrixAt(k, m); sm.setMatrixAt(k, m);
      });
      scene.add(pm, sm);
    });
  }

  // 먼 풍경: 넓은 들판 지면, 오름 군락, 한라산, 성산일출봉, 바다
  const farMat = (col) => cloudShadow(new THREE.MeshLambertMaterial({ color: col }));
  // 바깥 들판 (저해상도, 밭 조각 색)
  {
    const FAR = 4200, FSEG = 96;
    const g = new THREE.PlaneGeometry(FAR * 2, FAR * 2, FSEG, FSEG); g.rotateX(-Math.PI / 2);
    const ps = g.attributes.position; const cols = new Float32Array(ps.count * 3); const c = new THREE.Color();
    for (let i = 0; i < ps.count; i++) {
      const x = ps.getX(i), z = ps.getZ(i); const r = Math.hypot(x, z);
      const inside = Math.max(0, Math.min(1, (r - 520) / 160));
      let h = (vnoise(x * 0.0025, z * 0.0025) - 0.5) * 60 + (vnoise(x * 0.012 + 3, z * 0.012) - 0.5) * 8;
      h = Math.max(h, -14);
      h *= inside; h -= (1 - inside) * 5;
      // 북동쪽 해안으로 갈수록 낮아져 바다(-35) 아래로
      const coast = Math.max(0, (x * 0.6 - z * 0.8) - 1500) / 600;
      h -= coast * 60;
      ps.setY(i, h);
      const cell = hash(Math.floor(x / 90 + 100), Math.floor(z / 70 + 100));
      const n = vnoise(x * 0.004, z * 0.004);
      c.copy(PAL.field).lerp(PAL.field2, cell).lerp(PAL.grassDark, n * 0.35).lerp(new THREE.Color('#7f9a6a'), Math.min(1, r / 4000) * 0.5);
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, cloudShadow(new THREE.MeshLambertMaterial({ vertexColors: true })));
    m.position.y = -0.5; scene.add(m);
  }
  // 오름 군락: 형태가 제각각인 봉우리 (정점 노이즈 돔)
  const oreumDome = (r, h, seed, grassy) => {
    const g = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const ps = g.attributes.position; const cols = new Float32Array(ps.count * 3); const c = new THREE.Color();
    for (let i = 0; i < ps.count; i++) {
      const x = ps.getX(i), y = ps.getY(i), z = ps.getZ(i);
      const n = vnoise(x * 2.2 + seed, z * 2.2 + seed * 1.7);
      const k = 1 + (n - 0.5) * 0.35;
      ps.setX(i, x * r * k); ps.setZ(i, z * r * k); ps.setY(i, Math.pow(y, 1.3) * h * (1 + (n - 0.5) * 0.25));
      const t = y;
      c.copy(grassy ? PAL.grass : new THREE.Color('#3d6b3a')).lerp(PAL.eoksae, grassy ? t * 0.7 : t * 0.15).lerp(PAL.grassDark, (1 - n) * 0.3);
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
    return new THREE.Mesh(g, cloudShadow(new THREE.MeshLambertMaterial({ vertexColors: true })));
  };
  const spots = [[1100, 700, 150, 70, 1], [-900, -1000, 220, 90, 0], [1400, -600, 170, 60, 1], [-1300, 600, 200, 75, 0], [700, -1400, 240, 95, 1], [-700, 1500, 180, 65, 1], [1900, 300, 260, 110, 0], [-2000, -300, 300, 120, 0], [-1700, 1300, 230, 85, 1], [500, 2000, 210, 80, 1], [-2600, 500, 350, 140, 0], [2300, 1300, 280, 100, 1], [-400, -2200, 260, 95, 0], [1600, -1900, 220, 80, 1], [-2400, -1500, 320, 130, 0], [-3000, 1600, 380, 150, 0], [-1100, 2400, 240, 90, 1], [2800, -1100, 200, 70, 1]];
  spots.forEach(([x, z, r, h, gr], i) => { const o = oreumDome(r, h, i * 3.1, !!gr); o.position.set(x, -2, z); const dd = Math.hypot(x, z); if (dd > 2000) { o.material.vertexColors = false; o.material.color.set('#9db5b0'); } scene.add(o); });
  // 한라산: 완만한 큰 산체 + 능선 노이즈
  // 한라산: 멀리 서남쪽, 안개 낀 푸른 산체 (지도 안까지 닿지 않게 반경 제한)
  { // 한 덩어리 산체: 완만한 사면 → 정상부 어깨 → 백록담 분화구 테두리와 얕은 화구
    const prof = [[3200, 0], [2600, 110], [2050, 240], [1600, 380], [1250, 510], [980, 615], [800, 685], [680, 728], [590, 755], [530, 770], [490, 776], [450, 766], [400, 740], [330, 726], [180, 720], [0, 719]]
      .map(([r, y]) => new THREE.Vector2(r, y)).reverse();
    const g = new THREE.LatheGeometry(prof, 56);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i); const r = Math.hypot(x, z); if (r < 1) continue;
      const a = Math.atan2(z, x);
      // 능선·계곡 결 (반지름 방향 골), 테두리는 들쭉날쭉한 암벽
      const ridges = Math.sin(a * 9 + r * 0.002) * 0.035 + Math.sin(a * 23 + 1.3) * 0.015;
      const rimJag = r < 520 && y > 740 ? Math.sin(a * 7 + 0.6) * 18 + Math.sin(a * 17) * 8 : 0;
      const k = 1 + ridges * Math.min(1, r / 800);
      pos.setX(i, x * k); pos.setZ(i, z * k); pos.setY(i, y + rimJag);
    }
    g.computeVertexNormals();
    const halla = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: '#9fb3c4', flatShading: true, fog: false, side: THREE.DoubleSide }));
    halla.scale.set(1.5, 1.25, 1.1); halla.position.set(-6600, -80, 2700); scene.add(halla);
    const ridge = oreumDome(1800, 380, 31, false); ridge.scale.set(1.8, 1, 1); ridge.position.set(-4600, -60, 3900);
    ridge.material = new THREE.MeshLambertMaterial({ color: '#a9bcc8', flatShading: true, fog: false }); scene.add(ridge); }
  // 성산일출봉
  const seongsan = new THREE.Mesh(new THREE.CylinderGeometry(240, 330, 150, 12, 1), farMat('#8aa49a'));
  seongsan.material.fog = false; seongsan.position.set(2600, 20, -1700); scene.add(seongsan);
  // 바다: 북동쪽 수평선
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000), seaMat());
  sea.rotation.x = -Math.PI / 2; sea.position.set(4200, -30, -3400); sea.rotation.z = 0.6; scene.add(sea);
  // 먼 삼나무 띠 (저밀도)
  const farTreeGeo = new THREE.ConeGeometry(14, 60, 5, 1); farTreeGeo.translate(0, 28, 0);
  const farTrees = [];
  for (let i = 0; i < 260; i++) {
    const a = rnd() * Math.PI * 2, r = 700 + rnd() * 2600;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (x * 0.6 - z * 0.8 > 1700) continue;
    farTrees.push([x, z]);
  }
  const farTreeMesh = new THREE.InstancedMesh(farTreeGeo, farTreeMat, farTrees.length);
  farTrees.forEach(([x, z], k) => { m.makeTranslation(x, -4, z); farTreeMesh.setMatrixAt(k, m); });
  scene.add(farTreeMesh);
}

export function buildSky(scene) {
  const u = skyDome(scene);
  const setColors = (zen, hor) => { u.zen.value.copy(zen); u.hor.value.copy(hor); };
  // 낮은 구름: 둥글게 뭉친 덩어리
  const cloudMat = softMat({ a: G.cloudA, b: G.cloudB, fog: 0.3, rim: 0.6 });
  const clouds = new THREE.Group();
  for (let i = 0; i < 18; i++) {
    const parts = []; const n = 5 + Math.floor(Math.random() * 5);
    for (let k = 0; k < n; k++) { const g = roundNormals(new THREE.IcosahedronGeometry(34 + Math.random() * 40, LOW ? 1 : 2)); g.scale(1.5, 0.62, 1); g.translate((k - n / 2) * 42 + Math.random() * 20, Math.random() * 18, Math.random() * 34); parts.push(g); }
    const g = new THREE.Mesh(mergeGeometries(parts), cloudMat);
    const a = (i / 18) * Math.PI * 2 + Math.random() * 0.3, r = 1900 + Math.random() * 1500;
    g.position.set(Math.cos(a) * r, 520 + Math.random() * 420, Math.sin(a) * r);
    g.rotation.y = Math.random() * 3; g.scale.setScalar(1 + Math.random() * 1.2);
    clouds.add(g);
  }
  scene.add(clouds);
  return { clouds, setColors, u };
}
