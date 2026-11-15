// 현무암 돌담 (#25): 걸을 수 있는 범위(nsbound.js 경계선)를 따라 허리 높이의 구멍 숭숭한 밭담.
// 가까운 곳은 돌 하나하나(마디 InstancedMesh, 덩어리별로 켜고 끔), 먼 곳은 단순한 띠 하나(가까우면 셰이더에서 버림).
// 들머리 뒤쪽에 정낭 입구(정주석 두 개 + 정낭)를 두지만 나갈 수는 없다. 로우폴리 임시 모양
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gradHard } from './toon.js';
import { WALL } from './balance.js';

function mulberry(seed) { let s = seed >>> 0; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// 숭숭 뚫린 구멍 무늬
function poreTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), r = mulberry(7);
  x.fillStyle = '#d8d8d8'; x.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 46; i++) { const px = r() * 64, py = r() * 64, s = 0.8 + r() * 2.4; x.fillStyle = `rgba(20,20,24,${0.35 + r() * 0.4})`; x.beginPath(); x.ellipse(px, py, s * 1.3, s, r() * 3, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; return t;
}

// 돌담 한 마디: 길이 L(x 방향), 돌 3켜. 돌 사이를 조금씩 띄워 틈으로 빛이 보이게
function moduleGeo(L) {
  const r = mulberry(25), parts = [];
  const stone = (x, y, sx, sy, sz) => {
    const g = new THREE.IcosahedronGeometry(0.5, 0); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + (r() - 0.5) * 0.14, p.getY(i) + (r() - 0.5) * 0.12, p.getZ(i) + (r() - 0.5) * 0.14);
    g.scale(sx, sy, sz); g.rotateY((r() - 0.5) * 0.5); g.translate(x, y, (r() - 0.5) * 0.08);
    const n = g.attributes.position.count, col = new Float32Array(n * 3), v = 0.82 + r() * 0.3; col.fill(v);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); parts.push(g);
  };
  const row = (n, y, w, h, d, off, skip) => { const step = L / n; for (let i = 0; i < n; i++) { if (skip && r() < skip) continue; stone(-L / 2 + step * (i + 0.5) + off + (r() - 0.5) * 0.14, y + (r() - 0.5) * 0.06, w * (0.85 + r() * 0.25), h * (0.85 + r() * 0.3), d * (0.9 + r() * 0.2)); } };
  row(4, 0.3, 0.98, 0.72, 0.74, 0);
  row(4, 0.86, 0.9, 0.62, 0.64, L / 8);
  row(3, 1.32, 0.95, 0.5, 0.56, 0, 0.15);
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
}

export function createStoneWall({ scene, height, line, gate, low, col, uPl }) {
  // 경계선을 길이로 매개화
  const P = line, cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const LEN = cum[cum.length - 1];
  const at = (s) => { s = ((s % LEN) + LEN) % LEN; let lo = 0, hi = P.length - 1; while (lo < hi - 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const a = P[lo], b = P[lo + 1], l = cum[lo + 1] - cum[lo] || 1, t = (s - cum[lo]) / l; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
  // 정낭 자리의 길이 위치
  let sG = 0, bd = 1e9; for (let i = 0; i < P.length; i++) { const d = Math.hypot(P[i][0] - gate.x, P[i][1] - gate.z); if (d < bd) { bd = d; sG = cum[i]; } }
  const GW = WALL.gateW, s0 = sG + GW + 0.35, span = LEN - 2 * (GW + 0.35), n = Math.max(1, Math.round(span / WALL.seg)), seg = span / n;

  /* 가까운 곳: 돌 하나하나 */
  const geo = moduleGeo(WALL.seg);
  const mat = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, map: poreTex(), gradientMap: gradHard });
  const rnd = mulberry(2511), m4 = new THREE.Matrix4(), xa = new THREE.Vector3(), ya = new THREE.Vector3(), za = new THREE.Vector3(), c = new THREE.Color();
  const chunks = [];
  let cur = null;
  for (let k = 0; k < n; k++) {
    if (!cur || cur.items.length >= WALL.chunk) chunks.push(cur = { items: [], cx: 0, cz: 0 });
    const sa = s0 + k * seg, sb = sa + seg, a = at(sa), b = at(sb), mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    const ya0 = height(a[0], a[1]), yb0 = height(b[0], b[1]), ym = height(mx, mz);
    cur.items.push({ a, b, mx, mz, y: Math.min(ym, (ya0 + yb0) / 2) - 0.08, dy: yb0 - ya0 });
  }
  for (const ch of chunks) {
    const im = new THREE.InstancedMesh(geo, mat, ch.items.length);
    ch.items.forEach((it, i) => {
      const dx = it.b[0] - it.a[0], dz = it.b[1] - it.a[1], l = Math.hypot(dx, dz) || 1, flip = rnd() < 0.5 ? -1 : 1;
      xa.set(dx * flip, it.dy * flip, dz * flip).normalize(); ya.set(0, 1, 0); za.crossVectors(xa, ya).normalize(); ya.crossVectors(za, xa).normalize();
      m4.makeBasis(xa.multiplyScalar(l / WALL.seg * 1.02), ya.multiplyScalar(1.12 + rnd() * 0.16), za); m4.setPosition(it.mx, it.y, it.mz);
      im.setMatrixAt(i, m4); const v = 0.26 + rnd() * 0.08; im.setColorAt(i, c.setRGB(v, v, v * 1.06));
      ch.cx += it.mx / ch.items.length; ch.cz += it.mz / ch.items.length;
      if (col) col.addBox(it.mx, it.mz, Math.atan2(-dz, dx), l / 2, WALL.thick);
    });
    im.computeBoundingSphere(); im.castShadow = !low; im.receiveShadow = true; im.visible = false;
    ch.r = Math.max(...ch.items.map((it) => Math.hypot(it.mx - ch.cx, it.mz - ch.cz))) + WALL.seg;
    ch.mesh = im; scene.add(im);
  }

  /* 먼 곳: 단순한 띠 (가까운 곳은 셰이더에서 버림) */
  const NR = low ? WALL.nearRLow : WALL.nearR;
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
    const a = at(sG - 1), b = at(sG + 1), tx = b[0] - a[0], tz = b[1] - a[1], tl = Math.hypot(tx, tz), ux = tx / tl, uz = tz / tl;
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
    for (const ch of chunks) ch.mesh.visible = Math.hypot(ch.cx - pos.x, ch.cz - pos.z) - ch.r < NR;
  }
  return { update, length: LEN, chunks: chunks.length, modules: n, nearR: NR };
}
