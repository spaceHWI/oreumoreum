// 현무암 돌담 (#25, #39): 걸을 수 있는 범위(nsbound.js 경계선)를 따라 허리 높이의 밭담.
// Tripo 돌담 조각 모델(wallmodel.js) 하나를 경계를 따라 InstancedMesh 로 이어 붙인다. 덩어리마다 가까우면 400 삼각형,
// 조금 멀면 48 삼각형 조각, 그보다 먼 곳은 단순한 띠 하나(가까우면 셰이더에서 버림).
// 들머리 뒤쪽에 정낭 입구(정주석 두 개 + 정낭)를 두지만 나갈 수는 없다. 로우폴리 임시 모양
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gradHard } from './toon.js';
import { WALL, STREAM } from './balance.js';
import { NSMODE, TEXCS } from './boot.js';
import { WM_NEAR, WM_FAR } from './wallmodel.js';

function mulberry(seed) { let s = seed >>> 0; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// 숭숭 뚫린 구멍 무늬
function poreTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), r = mulberry(7);
  x.fillStyle = '#d8d8d8'; x.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 46; i++) { const px = r() * 64, py = r() * 64, s = 0.8 + r() * 2.4; x.fillStyle = `rgba(20,20,24,${0.35 + r() * 0.4})`; x.beginPath(); x.ellipse(px, py, s * 1.3, s, r() * 3, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; return t;
}

// 돌담 조각 모델 (x = 길이, y = 높이·바닥 0, z = 두께)
const b64 = (s, T) => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new T(u.buffer); };
function pieceGeo(M) {
  const pos = b64(M.pos, Float32Array), nq = b64(M.nor, Int8Array), nor = new Float32Array(nq.length); for (let i = 0; i < nq.length; i++) nor[i] = nq[i] / 127;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(b64(M.uv, Float32Array), 2)); g.setIndex(new THREE.BufferAttribute(b64(M.idx, Uint16Array), 1));
  g.computeBoundingSphere(); return g;
}
function pieceMat(M) {
  const tex = new THREE.TextureLoader().load(M.tex); tex.colorSpace = TEXCS; tex.flipY = false; tex.anisotropy = 4;
  // 멧돼지처럼: 툰 3단 명암 + 텍스처 색에 비례한 약한 자체 빛 → 밤에 까맣게 뭉개지지 않게
  const m = NSMODE ? new THREE.MeshToonMaterial({ map: tex, gradientMap: gradHard, emissive: '#ffffff', emissiveIntensity: WALL.glow })
    : new THREE.MeshLambertMaterial({ map: tex, emissive: '#ffffff', emissiveIntensity: WALL.glow * 2 });
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance *= diffuseColor.rgb / max(diffuse, vec3(0.001));'); };
  return m;
}
let SHARED = null;
const shared = () => SHARED || (SHARED = { near: pieceGeo(WM_NEAR), far: pieceGeo(WM_FAR), nearM: pieceMat(WM_NEAR), farM: pieceMat(WM_FAR) });

// 조각 하나 [p, q](경계선 위 두 점)의 행렬: 길이 방향은 땅 기울기만큼 비스듬히(세로는 곧게 = 기울이지 않고 밀기),
// 끝을 WALL.overlap 만큼 겹치고, 반은 180° 돌려(앞뒤 바꿈) 반복이 티 나지 않게. 바닥은 조각 아래 땅에서 가장 낮은 곳보다 WALL.bury 묻음
const _m = new THREE.Matrix4(), _c = new THREE.Color();
function placePiece(im, i, p, q, height, rnd) {
  const L = WM_NEAR.size[0], H = WM_NEAR.size[1], D = WM_NEAR.size[2];
  const dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l, nx = -uz, nz = ux;
  const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2, yp = height(p[0], p[1]), yq = height(q[0], q[1]), slope = (yq - yp) / l, yc = (yp + yq) / 2;
  const len = l + WALL.overlap * (0.8 + rnd() * 0.4), hgt = WALL.height * (0.93 + rnd() * 0.14), thk = WALL.width * (0.92 + rnd() * 0.16);
  // 조각 밑 땅이 기울기 선보다 낮은 곳을 찾아 그만큼 내림 (길이 5곳 × 두께 3곳)
  let off = 0;
  for (let a = -0.5; a <= 0.5; a += 0.25) for (const b of [-0.5, 0, 0.5]) {
    const t = a * len, x = mx + ux * t + nx * b * thk, z = mz + uz * t + nz * b * thk;
    off = Math.min(off, height(x, z) - (yc + slope * t));
  }
  const sx = len / L, sy = hgt / H, sz = thk / D, f = rnd() < 0.5 ? -1 : 1;
  _m.set(
    ux * sx * f, 0, nx * sz * f, mx,
    slope * sx * f, sy, 0, yc + off - WALL.bury + (rnd() - 0.5) * 0.06,
    uz * sx * f, 0, nz * sz * f, mz,
    0, 0, 0, 1);
  im.setMatrixAt(i, _m);
  const v = 0.94 + rnd() * 0.14; im.setColorAt(i, _c.setRGB(v, v, v * 1.02));
  return { mx, mz, rot: Math.atan2(-dz, dx), hl: l / 2 };
}

// 조각 여러 개를 가까이용·멀리용 InstancedMesh 두 벌로 (같은 행렬)
function pieceMeshes(scene, pieces, height, rnd, low, col) {
  const S = shared(), near = new THREE.InstancedMesh(S.near, S.nearM, pieces.length), far = new THREE.InstancedMesh(S.far, S.farM, pieces.length);
  let cx = 0, cz = 0;
  const info = pieces.map(([p, q], i) => { const it = placePiece(near, i, p, q, height, rnd); cx += it.mx / pieces.length; cz += it.mz / pieces.length; if (col) col.addBox(it.mx, it.mz, it.rot, it.hl, WALL.thick); return it; });
  far.instanceMatrix.copy(near.instanceMatrix); far.instanceColor = near.instanceColor;
  near.name = 'wall-near'; far.name = 'wall-far';
  for (const m of [near, far]) { m.computeBoundingSphere(); m.receiveShadow = true; m.visible = false; scene.add(m); }
  near.castShadow = !low;
  const r = Math.max(...info.map((it) => Math.hypot(it.mx - cx, it.mz - cz) + it.hl)) + 1;
  return { near, far, cx, cz, r };
}

// 개울이 돌담 밑을 지나는 곳 (#41): 낮은 돌 수문. 담은 이어지고 물은 아치 구멍(창살) 밑으로 흐른다. 사람은 못 지나감
// P0→P1 = 비운 돌담 조각들의 처음·끝, cross = 물길 가운데, w = 물 반폭
function buildArch(scene, P0, P1, cross, w, height, low, map) {
  const dx = P1[0] - P0[0], dz = P1[1] - P0[1], L0 = Math.hypot(dx, dz) || 1, ux = dx / L0, uz = dz / L0, L = L0 + 0.7;
  const mx = (P0[0] + P1[0]) / 2, mz = (P0[1] + P1[1]) / 2;
  let gmin = 1e9, gmax = -1e9; for (let k = -0.5; k <= 0.5; k += 0.05) { const h = height(mx + ux * k * L, mz + uz * k * L); gmin = Math.min(gmin, h); gmax = Math.max(gmax, h); }
  const base = gmin - 0.4, H = gmax + 1.72 - base, xc = (cross.x - mx) * ux + (cross.z - mz) * uz, hc = height(cross.x, cross.z) - base;
  const ow = Math.min(2 * w + 0.6, L - 1.2), n = Math.max(1, Math.round(ow / STREAM.archOpen)), pier = 0.42, bw = (ow - (n - 1) * pier) / n;
  const x0c = Math.max(-L / 2 + 0.6, Math.min(L / 2 - 0.6 - ow, xc - ow / 2));
  const spring = hc + 0.5, rise = Math.min(bw * 0.42, 0.55);
  const shape = new THREE.Shape(); shape.moveTo(-L / 2, 0); shape.lineTo(L / 2, 0); shape.lineTo(L / 2, H); shape.lineTo(-L / 2, H); shape.lineTo(-L / 2, 0);
  const bars = [];
  for (let k = 0; k < n; k++) {
    const a = x0c + k * (bw + pier), b = a + bw, h = new THREE.Path();
    h.moveTo(a, 0.1); h.lineTo(b, 0.1); h.lineTo(b, spring); h.quadraticCurveTo((a + b) / 2, spring + rise * 2, a, spring); h.lineTo(a, 0.1); shape.holes.push(h);
    // 수문 창살
    const nb = Math.max(2, Math.round(bw / 0.6));
    for (let j = 1; j <= nb; j++) { const x = a + bw * j / (nb + 1), u = (x - (a + b) / 2) / (bw / 2), top = spring + rise * (1 - u * u) - 0.02;
      bars.push(new THREE.CylinderGeometry(0.035, 0.035, top - 0.1, 5).translate(x, (top + 0.1) / 2, 0)); }
  }
  const D = WALL.width * 0.95;
  const g = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: false, curveSegments: 6 }).translate(0, 0, -D / 2);
  const grp = new THREE.Group(); grp.position.set(mx, base, mz); grp.rotation.y = Math.atan2(-uz, ux); scene.add(grp);
  const m = new THREE.Mesh(g, new THREE.MeshToonMaterial({ color: new THREE.Color(0.32, 0.32, 0.34), map, gradientMap: gradHard })); m.castShadow = !low; m.receiveShadow = true; grp.add(m);
  const bm = new THREE.Mesh(mergeGeometries(bars), new THREE.MeshToonMaterial({ color: '#2c2b2a', gradientMap: gradHard })); grp.add(bm);
  return grp;
}

export function createStoneWall({ scene, height, line, gate, low, col, uPl, arches = [] }) {
  // 경계선을 길이로 매개화
  const P = line, cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const LEN = cum[cum.length - 1];
  const at = (s) => { s = ((s % LEN) + LEN) % LEN; let lo = 0, hi = P.length - 1; while (lo < hi - 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const a = P[lo], b = P[lo + 1], l = cum[lo + 1] - cum[lo] || 1, t = (s - cum[lo]) / l; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
  // 정낭 자리의 길이 위치
  let sG = 0, bd = 1e9; for (let i = 0; i < P.length; i++) { const d = Math.hypot(P[i][0] - gate.x, P[i][1] - gate.z); if (d < bd) { bd = d; sG = cum[i]; } }
  // 정낭 가운데(gate.x,z)·길 직각 방향(gate.ux,uz) 한 묶음에서 돌담 시작점을 구한다 (#61):
  // 경계선을 따라 양쪽으로 가다가 정낭 기둥 바깥(길 직각 거리 GW+0.38)에 닿는 곳에서 돌담을 시작·끝낸다
  const GW = WALL.gateW, GAP = GW + 0.38;
  const offU = (s) => { const p = at(s); return Math.abs((p[0] - gate.x) * gate.ux + (p[1] - gate.z) * gate.uz); };
  let sF = sG; while (sF < sG + 40 && offU(sF) < GAP) sF += 0.05;
  let sB = sG; while (sB > sG - 40 && offU(sB) < GAP) sB -= 0.05;
  const s0 = sF, span = LEN - (sF - sB), n = Math.max(1, Math.round(span / WALL.seg)), seg = span / n;

  /* 가까운 곳: 돌담 조각 (덩어리마다 가까이용·멀리용) */
  const rnd = mulberry(2511), chunks = [];
  // 개울이 지나는 곳의 조각은 비우고(충돌은 남김) 수문으로 바꿈 (#41)
  const skip = arches.map(() => []);
  const segD = (p, q, x, z) => { const vx = q[0] - p[0], vz = q[1] - p[1], l2 = vx * vx + vz * vz || 1, k = Math.max(0, Math.min(1, ((x - p[0]) * vx + (z - p[1]) * vz) / l2)); return Math.hypot(p[0] + vx * k - x, p[1] + vz * k - z); };
  for (let k0 = 0; k0 < n; k0 += WALL.chunk) {
    const pieces = [];
    for (let k = k0; k < Math.min(n, k0 + WALL.chunk); k++) {
      const p = at(s0 + k * seg), q = at(s0 + (k + 1) * seg), ai = arches.findIndex((A) => segD(p, q, A.x, A.z) < A.w + 1.0);
      if (ai < 0) { pieces.push([p, q]); continue; }
      skip[ai].push([p, q]);
      if (col) { const dx = q[0] - p[0], dz = q[1] - p[1]; col.addBox((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, Math.atan2(-dz, dx), Math.hypot(dx, dz) / 2, WALL.thick); }
    }
    if (pieces.length) chunks.push(pieceMeshes(scene, pieces, height, rnd, low, col));
  }
  const mat = { map: poreTex() };
  const archMeshes = arches.map((A, i) => skip[i].length ? buildArch(scene, skip[i][0][0], skip[i][skip[i].length - 1][1], A, A.w, height, low, mat.map) : null);

  /* 먼 곳: 단순한 띠 (가까운 곳은 셰이더에서 버림) */
  const NR = low ? WALL.nearRLow : WALL.nearR, NR1 = low ? WALL.lodRLow : WALL.lodR;
  {
    const pos = [], idx = [], r = mulberry(99), STEP = 4;
    const m = Math.round(span / STEP);
    for (let k = 0; k <= m; k++) {
      const s = s0 + span * k / m, p = at(s), q = at(s + 0.5), dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
      const y = height(p[0], p[1]), top = y + 1.6 + r() * 0.25;
      pos.push(p[0] + nx * 0.4, y - 0.3, p[1] + nz * 0.4, p[0] + nx * 0.28, top, p[1] + nz * 0.28, p[0] - nx * 0.28, top, p[1] - nz * 0.28, p[0] - nx * 0.4, y - 0.3, p[1] - nz * 0.4);
      if (k) { const b = (k - 1) * 4, d = k * 4; for (const [u, v] of [[0, 1], [1, 2], [2, 3]]) idx.push(b + u, d + u, b + v, b + v, d + u, d + v); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const fm = new THREE.MeshToonMaterial({ color: new THREE.Color(0.3, 0.3, 0.32), gradientMap: gradHard, side: THREE.DoubleSide });
    fm.onBeforeCompile = (s) => {
      s.uniforms.uPl = uPl;
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWxz;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWxz=(modelMatrix*vec4(transformed,1.0)).xz;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec2 vWxz;\nuniform vec3 uPl;`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\nif(length(vWxz-uPl.xz)<${NR.toFixed(1)}) discard;`);
    };
    const far = new THREE.Mesh(g, fm); far.receiveShadow = true; scene.add(far);
  }

  /* 정낭 입구: 정주석 두 개, 정낭 하나는 가로로 걸치고 둘은 내려 둠 */
  {
    const ux = gate.ux, uz = gate.uz; // 길과 직각 (#61)
    const gx = gate.x, gz = gate.z, rot = Math.atan2(-uz, ux), parts = [];
    const r = mulberry(31);
    const post = (side) => { const g = new THREE.BoxGeometry(0.66, 2.2, 0.6, 1, 3, 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + (r() - 0.5) * 0.1, p.getY(i), p.getZ(i) + (r() - 0.5) * 0.1); g.translate(side * (GW + 0.05), 0.95, 0); return g; };
    const stoneParts = [post(-1), post(1)].map((g) => g.toNonIndexed());
    const bar = (g) => { g = g.toNonIndexed(); return g; };
    const woodParts = [];
    const pole = () => new THREE.CylinderGeometry(0.075, 0.085, 2 * GW + 0.9, 6);
    woodParts.push(bar(pole().rotateZ(Math.PI / 2).translate(0, 1.25, 0))); // 가로로 걸친 정낭 하나
    woodParts.push(bar(pole().rotateZ(Math.PI / 2).rotateY(0.08).translate(0, 0.12, 0.55))); // 내려 둔 둘 (안쪽 땅에)
    woodParts.push(bar(pole().rotateZ(Math.PI / 2).rotateY(-0.05).translate(0.3, 0.12, 0.8)));
    const ys = height(gx, gz) - 0.1;
    const sMesh = new THREE.Mesh(mergeGeometries(stoneParts), new THREE.MeshToonMaterial({ color: new THREE.Color(0.3, 0.3, 0.32), map: mat.map, gradientMap: gradHard }));
    const wMesh = new THREE.Mesh(mergeGeometries(woodParts), new THREE.MeshToonMaterial({ color: '#8a6a48', gradientMap: gradHard }));
    for (const o of [sMesh, wMesh]) { o.position.set(gx, ys, gz); o.rotation.y = rot; o.castShadow = !low; o.receiveShadow = true; scene.add(o); }
    if (col) { col.addBox(gx, gz, rot, GW + 0.4, WALL.thick); } // 트여 보여도 지나갈 수는 없음
  }

  function update(pos) {
    for (const ch of chunks) { const d = Math.hypot(ch.cx - pos.x, ch.cz - pos.z) - ch.r; ch.near.visible = d < NR1; ch.far.visible = !ch.near.visible && d < NR; }
  }
  return { update, arches: archMeshes, length: LEN, chunks: chunks.length, modules: n, nearR: NR, lodR: NR1, tris: () => chunks.reduce((t, ch) => t + (ch.near.visible ? ch.near.count * ch.near.geometry.index.count / 3 : 0) + (ch.far.visible ? ch.far.count * ch.far.geometry.index.count / 3 : 0), 0) };
}

// 들머리와 오름 사이를 가로막는 안쪽 돌담 + 정낭(#31). line = nsbound.crossLine(TUT.gateD)
// 정주석(구멍 뚫린 돌기둥) 둘 사이에 긴 나무 막대(정낭) 둘이 걸쳐 길을 막는다. open() 하면 막대가 한쪽으로 내려지고 그 뒤로는 계속 열림
export function createCrossWall({ scene, height, line, low, col, open: open0 = false }) {
  const GW = WALL.gateW, { a, b, c } = line;
  const mat = { map: poreTex() }, rnd = mulberry(4417);
  // 정낭 양옆 두 토막 (a → 정낭 왼쪽, 정낭 오른쪽 → b)
  const la = Math.hypot(c.x - a[0], c.z - a[1]), lb = Math.hypot(b[0] - c.x, b[1] - c.z), g0 = GW + 0.35;
  const pieces = [];
  const run = (p0, p1) => { const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), n = Math.max(1, Math.round(L / WALL.seg)); for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n; pieces.push([[p0[0] + (p1[0] - p0[0]) * t0, p0[1] + (p1[1] - p0[1]) * t0], [p0[0] + (p1[0] - p0[0]) * t1, p0[1] + (p1[1] - p0[1]) * t1]]); } };
  run(a, [c.x + (a[0] - c.x) * g0 / la, c.z + (a[1] - c.z) * g0 / la]);
  run([c.x + (b[0] - c.x) * g0 / lb, c.z + (b[1] - c.z) * g0 / lb], b);
  const chunks = []; for (let k = 0; k < pieces.length; k += WALL.chunk) chunks.push(pieceMeshes(scene, pieces.slice(k, k + WALL.chunk), height, rnd, low, col));
  const NR1 = low ? WALL.lodRLow : WALL.lodR;
  // 가까우면 가까이용, 아니면 멀리용 (바깥 돌담과 달리 띠가 없어 늘 보임)
  function lod(pos) { for (const ch of chunks) { ch.near.visible = Math.hypot(ch.cx - pos.x, ch.cz - pos.z) - ch.r < NR1; ch.far.visible = !ch.near.visible; } }
  lod({ x: c.x, z: c.z });

  // 정낭: 돌기둥 둘(막대 꽂는 구멍 셋) + 막대 둘
  const rot = Math.atan2(-line.uz, line.ux), ys = height(c.x, c.z) - 0.1, r = mulberry(77);
  const gate = new THREE.Group(); gate.position.set(c.x, ys, c.z); gate.rotation.y = rot; scene.add(gate);
  const post = (side) => { const g = new THREE.BoxGeometry(0.62, 1.9, 0.58, 1, 3, 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + (r() - 0.5) * 0.1, p.getY(i), p.getZ(i) + (r() - 0.5) * 0.1); g.translate(side * (GW + 0.05), 0.85, 0); return g.toNonIndexed(); };
  const stoneM = new THREE.MeshToonMaterial({ color: new THREE.Color(0.3, 0.3, 0.32), map: mat.map, gradientMap: gradHard });
  const posts = new THREE.Mesh(mergeGeometries([post(-1), post(1)]), stoneM); posts.castShadow = !low; posts.receiveShadow = true; gate.add(posts);
  const holeM = new THREE.MeshBasicMaterial({ color: '#141416' }), holeG = new THREE.CircleGeometry(0.1, 8);
  { const hs = [], o = new THREE.Object3D(); // 구멍 12개를 한 메시로 (#79 그리기 횟수)
    for (const side of [-1, 1]) for (const hy of [0.62, 1.05, 1.48]) for (const zz of [0.3, -0.3]) { o.position.set(side * (GW + 0.05), hy + 0.1, zz); o.rotation.set(0, zz < 0 ? Math.PI : 0, 0); o.updateMatrix(); hs.push(holeG.clone().applyMatrix4(o.matrix)); }
    gate.add(new THREE.Mesh(mergeGeometries(hs), holeM)); }
  const woodM = new THREE.MeshToonMaterial({ color: '#8a6a48', gradientMap: gradHard });
  const BL = 2 * GW + 0.9, pivX = -(GW + 0.05), bars = [];
  [1.15, 0.72].forEach((by, i) => {
    const piv = new THREE.Group(); piv.position.set(pivX, by, 0); gate.add(piv);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, BL, 6).rotateZ(Math.PI / 2), woodM); pole.position.x = BL / 2 - 0.45; pole.castShadow = !low; piv.add(pole);
    bars.push({ piv, by, yEnd: 0.1 + i * 0.15, rEnd: -2.85 + i * 0.12 });
  });
  const barrier = col ? col.addBox(c.x, c.z, rot, GW + 0.4, WALL.thick) : [];
  let isOpen = false, t = -1;
  const pose = (k) => { const e = k * k * (3 - 2 * k); bars.forEach((B) => { B.piv.position.y = B.by + (B.yEnd - B.by) * e + Math.sin(k * Math.PI) * 0.35; B.piv.rotation.y = B.rEnd * e; B.piv.rotation.z = Math.sin(k * Math.PI) * 0.25; }); };
  function open(anim = true) { if (isOpen) return false; isOpen = true; if (col) col.setOff(barrier, true); if (anim) t = 0; else pose(1); return true; }
  if (open0) open(false);
  function update(dt) { if (t < 0) return; t += dt / 1.4; if (t >= 1) { pose(1); t = -1; } else pose(t); }
  return { open, update, lod, get isOpen() { return isOpen; }, center: new THREE.Vector3(c.x, height(c.x, c.z), c.z), modules: pieces.length, tris: () => chunks.reduce((t, ch) => t + (ch.near.visible ? ch.near.count * ch.near.geometry.index.count / 3 : 0) + (ch.far.visible ? ch.far.count * ch.far.geometry.index.count / 3 : 0), 0) };
}
