// 숙소 오피스제주 마당 불멍 화로 (#290). 코드로 만든 로우폴리 임시 모양 (toon 재질, 꼭짓점 색)
// 옆마당 잔디 위: 현무암 돌 고리 화로·장작 셋·캠핑 의자 둘(화로를 사이에 두고 마주 봄)·장작 더미·닫혔을 때 덮개
// 그리는 수는 가게 하나 수준: 몸체 1 + 덮개 1 + 불꽃 1 + 불빛 1 + 불티 1 + 빛웅덩이 1. 멀면(INN.fire.far) 통째로 감춤
// 로컬 좌표: 원점 = 화로 가운데 바닥, +Z = 의자 0 쪽. 의자 0 은 +Z, 의자 1 은 -Z 에 놓여 화로를 봄
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gradHard } from './toon.js';
import { INN } from './balance.js';
import { glowSprite } from './propmodel.js';

const F = INN.fire;
const M4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
function piece(g, color, m) {
  g = g.index ? g.toNonIndexed() : g; if (g.attributes.uv) g.deleteAttribute('uv'); if (m) g.applyMatrix4(m); g.computeVertexNormals();
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
const box = (w, h, d, c, m) => piece(new THREE.BoxGeometry(w, h, d), c, m);
const toonMat = () => new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradHard });

// 캠핑 의자 (등받이가 +Z 쪽, 앉으면 -Z 를 봄): 천은 짙은 청록, 다리는 회색
function chair(P, z, flip) {
  const s = flip ? -1 : 1, CL = '#2f6f6a', LG = '#5a5f63', zz = (v) => z + s * v;
  P.push(box(0.56, 0.05, 0.5, CL, M4(0, 0.42, zz(0))));
  P.push(box(0.56, 0.5, 0.05, CL, M4(0, 0.7, zz(0.27), s * 0.18)));
  for (const a of [-1, 1]) {
    P.push(box(0.04, 0.46, 0.04, LG, M4(a * 0.26, 0.21, zz(-0.2), s * -0.25)), box(0.04, 0.46, 0.04, LG, M4(a * 0.26, 0.21, zz(0.2), s * 0.25)));
    P.push(box(0.05, 0.04, 0.46, LG, M4(a * 0.3, 0.6, zz(0.02)))); /* 팔걸이 */
  }
}

export function createFirePit({ scene, height, x, z, rot, low = false, col = null }) {
  const y = height(x, z);
  const root = new THREE.Group(); root.position.set(x, y, z); root.rotation.y = rot; scene.add(root);
  const P = [];
  P.push(piece(new THREE.CircleGeometry(2.6, 10).rotateX(-Math.PI / 2), '#6f9a4c', M4(0, 0.02, 0))); /* 잔디 자리 */
  P.push(piece(new THREE.CylinderGeometry(0.42, 0.46, 0.06, 9), '#2c2a28', M4(0, 0.04, 0))); /* 재 바닥 */
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; P.push(piece(new THREE.DodecahedronGeometry(0.17, 0), i % 2 ? '#3f4448' : '#4c5155', M4(Math.cos(a) * 0.55, 0.11, Math.sin(a) * 0.55, a, a * 2, 0, 1.1, 0.8, 1))); }
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.4; P.push(piece(new THREE.CylinderGeometry(0.06, 0.07, 0.7, 6), '#6b4a2e', M4(Math.cos(a) * 0.12, 0.2, Math.sin(a) * 0.12, 0.9 * Math.sin(a), 0, -0.9 * Math.cos(a)))); } /* 장작 셋 (가운데로 기대) */
  chair(P, F.chairR, false); chair(P, -F.chairR, true);
  /* 장작 더미: 의자 옆(-X) */
  for (let r = 0; r < 3; r++) for (let k = 0; k < 4 - r; k++) P.push(piece(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 6), k % 2 ? '#8a6640' : '#7a5636', M4(-1.15, 0.08 + r * 0.15, -0.25 + (k + r * 0.5) * 0.17 - 0.1, Math.PI / 2, 0, 0)));
  const body = new THREE.Mesh(mergeGeometries(P), toonMat()); body.castShadow = !low; body.receiveShadow = !low; root.add(body);
  /* 덮개 (숙소가 닫혀 있을 때): 화로 위 둥근 회색 천 */
  const cover = new THREE.Mesh(mergeGeometries([piece(new THREE.SphereGeometry(0.72, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2), '#7d8588', M4(0, 0.05, 0, 0, 0, 0, 1, 0.55, 1)), box(0.1, 0.05, 1.3, '#5a5f63', M4(0, 0.42, 0))]), toonMat()); root.add(cover);
  /* 불꽃: 두 겹 원뿔 (주황 + 노랑), 더해 그림 */
  const fl = [];
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; fl.push(piece(new THREE.ConeGeometry(0.16, 0.6, 6), '#ff7a1a', M4(Math.cos(a) * 0.09, 0.42, Math.sin(a) * 0.09))); }
  fl.push(piece(new THREE.ConeGeometry(0.12, 0.42, 6), '#ffd25a', M4(0, 0.36, 0)));
  const flameMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const flame = new THREE.Mesh(mergeGeometries(fl), flameMat); flame.renderOrder = 3; root.add(flame);
  const glow = glowSprite('#ffae5a', 2.6); glow.position.set(0, 0.6, 0); root.add(glow);
  /* 빛웅덩이 */
  const poolTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(255,190,110,1)'); gr.addColorStop(0.5, 'rgba(255,160,80,0.35)'); gr.addColorStop(1, 'rgba(255,140,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 5.5).rotateX(-Math.PI / 2), poolMat); pool.position.y = 0.05; pool.renderOrder = 2; root.add(pool);
  /* 불티: 점 몇 개가 올라가다 사라짐 (CPU 로 자리만 옮김) */
  const NE = low ? 8 : 16, ep = new Float32Array(NE * 3), ev = [];
  for (let i = 0; i < NE; i++) ev.push({ t: Math.random() * 1.6, T: 1.2 + Math.random() * 0.8, x: 0, z: 0, vx: 0, vz: 0 });
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(ep, 3));
  const em = new THREE.PointsMaterial({ color: '#ffb35a', size: low ? 0.09 : 0.07, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const embers = new THREE.Points(eg, em); embers.frustumCulled = false; embers.renderOrder = 3; root.add(embers);
  root.updateMatrixWorld(true);
  const toWorld = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyMatrix4(root.matrixWorld);
  if (col) { col.add(x, z, 0.75); const p = toWorld(-1.15, 0, -0.15); col.add(p.x, p.z, 0.4); }
  /* 의자 자리 (앉는 곳·보는 쪽): 의자 0 은 -Z(화로) 쪽을 봄 */
  const fwd = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot));
  const seats = [F.chairR, -F.chairR].map((lz, i) => ({ pos: toWorld(0, 0.05, lz + (i ? -0.14 : 0.14)) /* 등받이 쪽으로 조금: 앉은 다리가 불에 닿지 않게 */, y: y + 0.42 - 0.5 + 0.06, h: rot + (i ? 0 : Math.PI), front: toWorld(0, 0.05, lz + (i ? -0.75 : 0.75)) }));
  /* 의자 앞에서 일어난 자리: 화로와 의자 사이가 아니라 의자 옆 */
  for (const s of seats) s.out = s.pos.clone().addScaledVector(new THREE.Vector3(fwd.z, 0, -fwd.x), 0.85);
  let state = { lit: false, cover: false, k: 0, vis: true };
  cover.visible = false; flame.visible = false; glow.visible = false; pool.visible = false; embers.visible = false;
  function setLit(on) { if (state.lit === on) return; state.lit = on; flame.visible = glow.visible = pool.visible = embers.visible = on && !state.cover; }
  function setCover(on) { if (state.cover === on) return; state.cover = on; cover.visible = on; if (on) setLit(false); }
  let clock = 0;
  // camPos 로 멀면 감춤. night 0..1 은 빛웅덩이 세기
  function update(dt, camPos, night = 0) {
    const vis = !camPos || camPos.distanceToSquared(root.position) < F.far * F.far;
    if (vis !== state.vis) { state.vis = vis; root.visible = vis; }
    if (!vis || !state.lit) return;
    clock += dt;
    const fk = 0.85 + Math.sin(clock * 13) * 0.08 + Math.sin(clock * 7.3) * 0.07;
    flame.scale.set(1 + Math.sin(clock * 9) * 0.06, fk, 1 + Math.cos(clock * 11) * 0.06); flame.rotation.y = clock * 0.6;
    glow.material.opacity = 0.45 + 0.4 * night + Math.sin(clock * 15) * 0.05; glow.scale.setScalar(2.4 + fk * 0.5);
    poolMat.opacity = (0.2 + 0.5 * night) * fk;
    for (let i = 0; i < NE; i++) {
      const e = ev[i]; e.t += dt;
      if (e.t >= e.T) { e.t = 0; e.T = 1.1 + Math.random() * 0.9; e.x = (Math.random() - 0.5) * 0.3; e.z = (Math.random() - 0.5) * 0.3; e.vx = (Math.random() - 0.5) * 0.3; e.vz = (Math.random() - 0.5) * 0.3; }
      const u = e.t / e.T; ep[i * 3] = e.x + e.vx * e.t + Math.sin(clock * 3 + i) * 0.05; ep[i * 3 + 1] = 0.5 + u * 2.0; ep[i * 3 + 2] = e.z + e.vz * e.t;
    }
    eg.attributes.position.needsUpdate = true; em.opacity = 0.6 + 0.35 * night;
  }
  return { root, seats, center: root.position.clone(), update, setLit, setCover, get lit() { return state.lit; }, get covered() { return state.cover; }, get shown() { return state.vis; } };
}
