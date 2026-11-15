import * as THREE from 'three';
import { TEXCS } from './boot.js';
import { G, softMat, fluffyGeo, cedarGeo as mkCedar, roundNormals, cloudShadow, LOW } from './gfx2.js';
import { vnoise, setMapImpl, addWalkable, contactShadows, PAL } from './world.js';

// 탐방로 입구: 처음 오는 사람이 걸으면서 조작을 익히는 작은 마당.
// 남쪽 쉼터에서 출발 → 북쪽으로 난 길을 따라 귤·하르방·개울·돌탑을 지나 → 갈림길 표지판에서
// 서쪽 길은 다랑쉬오름, 동쪽 길은 돈내코로 이어짐. 길 끝에 닿으면 그 오름으로 넘어감.
export const GATE = {
  start: { x: 0, z: 46 }, startHeading: Math.PI,
  fork: { x: 0, z: -22 },
  exits: { darangswi: { x: -118, z: -46 }, donnaeko: { x: 118, z: -46 } },
  props: { gyul: [[1.2, 30], [-1.0, 26], [0.8, 22]], hareubang: { x: 4.2, z: 12, heading: Math.PI + 0.5 }, stream: { z: 2, w: 2.2 }, cairn: { x: -4.4, z: -12 }, bench: { x: -5.5, z: 44 }, sign: { x: 0, z: -24 } },
  R: 150,
};
const V2 = (x, z) => new THREE.Vector2(x, z);
// 길: 본길(남→북) + 두 갈래
const mainPath = [V2(0, 52), V2(0.6, 40), V2(-0.4, 28), V2(0.5, 14), V2(0, 2), V2(-0.3, -10), V2(0, -22)];
const westPath = [V2(0, -22), V2(-14, -26), V2(-30, -28), V2(-48, -31), V2(-66, -35), V2(-84, -38), V2(-102, -42), V2(-118, -46)];
const eastPath = [V2(0, -22), V2(14, -26), V2(30, -28), V2(48, -31), V2(66, -35), V2(84, -38), V2(102, -42), V2(118, -46)];
export const gatePaths = { main: mainPath, west: westPath, east: eastPath };
function distToPolyline(x, z, pts) {
  let best = 1e9;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]; const abx = b.x - a.x, abz = b.y - a.y; const l2 = abx * abx + abz * abz;
    let t = ((x - a.x) * abx + (z - a.y) * abz) / l2; t = Math.max(0, Math.min(1, t));
    const dx = x - (a.x + abx * t), dz = z - (a.y + abz * t); best = Math.min(best, Math.hypot(dx, dz));
  }
  return best;
}
export const gatePathDist = (x, z) => Math.min(distToPolyline(x, z, mainPath), distToPolyline(x, z, westPath), distToPolyline(x, z, eastPath));

function gateHeight(x, z) {
  const r = Math.hypot(x, z);
  let h = vnoise(x * 0.025 + 3, z * 0.025) * 2.6 + vnoise(x * 0.08, z * 0.08) * 0.5;
  h += Math.max(0, -z - 30) * 0.06; // 북쪽으로 완만히 올라감 (오름 쪽)
  h += Math.max(0, r - 120) * 0.12; // 가장자리 둔덕
  const d = gatePathDist(x, z); if (d < 2.4) h -= 0.12 * (1 - d / 2.4); // 길은 살짝 패임
  // 개울: 얕은 골
  const sd = Math.abs(z - GATE.props.stream.z); if (sd < GATE.props.stream.w + 1.2) h -= 0.55 * Math.cos((sd / (GATE.props.stream.w + 1.2)) * Math.PI / 2) ** 2 * (Math.abs(x) < 60 ? 1 : 0);
  return h;
}
function gateSurface(x, z) {
  return gatePathDist(x, z) < 2.2 ? 1 : 0;
}
function gateColor(x, z, h, c, n, n2) {
  const d = gatePathDist(x, z);
  if (d < 2.2) { c.set('#a8785a').lerp(new THREE.Color('#c09a78'), n * 0.5); return; }
  const sd = Math.abs(z - GATE.props.stream.z);
  if (sd < GATE.props.stream.w * 0.75 && Math.abs(x) < 60) { c.set('#79b0c6').lerp(new THREE.Color('#9fd0df'), n2); return; }
  c.set('#8fbd62').lerp(new THREE.Color('#a9c86e'), n).lerp(new THREE.Color('#d9c66e'), Math.max(0, n2 - 0.55) * 0.9);
  if (d < 3.6) c.lerp(new THREE.Color('#b9b267'), 1 - (d - 2.2) / 1.4);
}
export function useGate() { setMapImpl({ height: gateHeight, surface: gateSurface, color: gateColor, extent: 180, seg: 240 }); }

export function buildGateDecor(scene, height) {
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...o });
  const m = new THREE.Matrix4(), qn = new THREE.Quaternion(), e = new THREE.Euler();
  const put = (list, geo, mat, opts = {}) => {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([x, z, sc, ry], i) => { e.set(0, ry, 0); qn.setFromEuler(e); m.compose(new THREE.Vector3(x, height(x, z) - (opts.sink || 0.15), z), qn, new THREE.Vector3(sc, sc * (opts.sy || 1), sc)); im.setMatrixAt(i, m); });
    im.castShadow = !!opts.shadow; im.receiveShadow = true; scene.add(im); return im;
  };
  // 나무: 마당 가장자리와 갈림길 뒤쪽으로 숲, 길 근처는 비움
  const cedar = [], broad = [], shrubs = [], grass = [];
  for (let i = 0; i < 420; i++) {
    const a = rnd() * Math.PI * 2, r = 55 + rnd() * 95; const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (gatePathDist(x, z) < 7 || Math.hypot(x - GATE.start.x, z - GATE.start.z) < 18) continue;
    (z < -10 || rnd() < 0.3 ? cedar : broad).push([x, z, 0.7 + rnd() * 0.8, rnd() * 6.28]);
  }
  for (let i = 0; i < 260; i++) {
    const x = (rnd() - 0.5) * 240, z = (rnd() - 0.5) * 200; if (gatePathDist(x, z) < 3.2 || Math.hypot(x, z) > 118) continue;
    shrubs.push([x, z, 0.5 + rnd() * 0.7, rnd() * 6.28]);
  }
  for (let i = 0; i < 1800; i++) {
    const x = (rnd() - 0.5) * 230, z = (rnd() - 0.5) * 190; if (gatePathDist(x, z) < 2.6 || Math.hypot(x, z) > 115) continue;
    grass.push([x, z, 0.6 + rnd() * 0.7, rnd() * 6.28]);
  }
  const cedarGeo = mkCedar(4, 2.3, 4.4, 2.5, 3.2);
  const broadGeo = fluffyGeo(LOW ? 6 : 11, 3.0, 2.2, 5.0, 3, 1);
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.55, 5.0, 7); trunkGeo.translate(0, 2.4, 0); const cTrunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 3.2, 6); cTrunkGeo.translate(0, 1.5, 0);
  const shrubGeo = roundNormals(new THREE.IcosahedronGeometry(1.1, 1)); shrubGeo.translate(0, 0.7, 0);
  const grassGeo = new THREE.ConeGeometry(0.22, 0.9, 3, 1); grassGeo.translate(0, 0.4, 0);
  put(cedar, cedarGeo, softMat({ a: G.cedarA, b: G.cedarB, wind: 0.6 }), { shadow: true });
  put(broad, broadGeo, softMat({ a: G.leafA, b: G.leafB, wind: 1 }), { shadow: true });
  put(broad, trunkGeo, softMat({ a: '#5a4030', b: '#a07a56' }), { shadow: true }); put(cedar, cTrunkGeo, softMat({ a: '#4a3628', b: '#8a6a4c' }), {});
  put(shrubs, shrubGeo, softMat({ a: G.leaf2A, b: G.leaf2B }), { sink: 0.3 });
  contactShadows(scene, cedar, 1.9); contactShadows(scene, broad, 2.8);

  // 바깥: 넓은 들판 원판과 먼 둔덕들 (지형 바깥이 비어 보이지 않게)
  { const far = new THREE.Mesh(new THREE.CircleGeometry(3000, 48), cloudShadow(new THREE.MeshLambertMaterial({ color: '#7db552' }))); far.rotation.x = -Math.PI / 2; far.position.y = -0.6; far.receiveShadow = true; scene.add(far);
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2 + rnd() * 0.3, r = 260 + rnd() * 320; const rr = 60 + rnd() * 90, hh = 18 + rnd() * 30;
      const d = new THREE.Mesh(new THREE.SphereGeometry(rr, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), lam(i % 3 ? '#7fa55e' : '#9db5b0')); d.scale.y = hh / rr; d.position.set(Math.cos(a) * r, -2, Math.sin(a) * r); scene.add(d); }
    const farTree = new THREE.ConeGeometry(2.4, 12, 5, 1); farTree.translate(0, 6, 0); const ft = [];
    for (let i = 0; i < 220; i++) { const a = rnd() * Math.PI * 2, r = 185 + rnd() * 160; ft.push([Math.cos(a) * r, Math.sin(a) * r, 0.9 + rnd() * 1.2, rnd() * 6.28]); }
    put(ft, farTree, softMat({ a: G.cedarA, b: G.cedarB }), { sink: 1 });
  }
  // 쉼터: 기둥 넷에 지붕 (출발점)
  { const wood = lam('#8a6a48'); const sx = GATE.start.x, sz = GATE.start.z + 4; const gy = height(sx, sz);
    const g = new THREE.Group(); g.position.set(sx, gy, sz);
    [[-3, -2.2], [3, -2.2], [-3, 2.2], [3, 2.2]].forEach(([px, pz]) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.2, 0.3), wood); p.position.set(px, 1.6, pz); p.castShadow = true; g.add(p); });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.6, 1.8, 4, 1), lam('#5c6e4a')); roof.position.y = 4.0; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.25, 5.4), lam('#a88a66')); floor.position.y = 0.12; floor.receiveShadow = true; g.add(floor);
    scene.add(g); addWalkable(sx, sz, 0, 3.6, 2.7, gy + 0.25);
  }
  // 개울: 징검돌 둘
  { const stone = lam('#8e8a80'); [[-1.0, GATE.props.stream.z - 0.5], [1.1, GATE.props.stream.z + 0.6]].forEach(([x, z]) => { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.3, 7), stone); s.position.set(x, height(x, z) + 0.35, z); s.castShadow = true; scene.add(s); }); }
  // 갈림길 표지판: 기둥 하나에 양쪽 화살표 판. 글자는 이름만, 그림으로 어느 오름인지 보여 줌
  { const f = GATE.props.sign; const gy = height(f.x, f.z); const g = new THREE.Group(); g.position.set(f.x, gy, f.z);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.34, 3.4, 0.34), lam('#7a5636')); post.position.y = 1.7; post.castShadow = true; g.add(post);
    const board = (dir, label, drawIcon) => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 160; const x = c.getContext('2d');
      x.fillStyle = '#efe3c2'; x.fillRect(0, 0, 512, 160);
      x.strokeStyle = '#5a4630'; x.lineWidth = 10; x.strokeRect(5, 5, 502, 150);
      x.save(); x.translate(dir > 0 ? 420 : 92, 80); drawIcon(x); x.restore();
      x.fillStyle = '#3b3a33'; x.font = '700 60px "Jua", "Noto Sans KR", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(label, dir > 0 ? 200 : 312, 84);
      // 화살표 끝
      x.fillStyle = '#5a4630'; x.beginPath(); if (dir > 0) { x.moveTo(470, 20); x.lineTo(508, 80); x.lineTo(470, 140); } else { x.moveTo(42, 20); x.lineTo(4, 80); x.lineTo(42, 140); } x.closePath(); x.fill();
      const t = new THREE.CanvasTexture(c); t.colorSpace = TEXCS; t.anisotropy = 4;
      const geo = new THREE.BoxGeometry(3.2, 1.0, 0.12);
      const mats = [lam('#7a5636'), lam('#7a5636'), lam('#7a5636'), lam('#7a5636'), new THREE.MeshLambertMaterial({ map: t }), lam('#7a5636')];
      const mesh = new THREE.Mesh(geo, mats); mesh.castShadow = true; return mesh;
    };
    const oreumIcon = (x) => { x.fillStyle = '#7fae5a'; x.beginPath(); x.moveTo(-60, 40); x.quadraticCurveTo(-30, -40, 0, -38); x.quadraticCurveTo(30, -40, 60, 40); x.closePath(); x.fill(); x.fillStyle = '#5a7f3a'; x.beginPath(); x.ellipse(0, -30, 26, 9, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = '#d9c66e'; for (let i = -40; i <= 40; i += 20) { x.fillRect(i - 2, 10, 4, 28); } };
    const hallaIcon = (x) => { x.fillStyle = '#8fa3b6'; x.beginPath(); x.moveTo(-64, 42); x.lineTo(-10, -42); x.lineTo(10, -42); x.lineTo(64, 42); x.closePath(); x.fill(); x.fillStyle = '#3f6b3b'; [[-40, 20], [-20, 30], [20, 28], [40, 18]].forEach(([tx, ty]) => { x.beginPath(); x.moveTo(tx, ty - 26); x.lineTo(tx + 12, ty + 12); x.lineTo(tx - 12, ty + 12); x.closePath(); x.fill(); }); };
    const left = board(-1, '다랑쉬오름', oreumIcon); left.position.set(-1.8, 2.75, 0); left.rotation.y = 0.35; g.add(left);
    const right = board(1, '돈내코', hallaIcon); right.position.set(1.8, 2.15, 0); right.rotation.y = -0.35; g.add(right);
    scene.add(g);
  }
  // 길 끝 문: 나무 아치 (여기를 지나면 그 오름으로)
  Object.entries(GATE.exits).forEach(([id, p]) => {
    const dir = id === 'darangswi' ? -1 : 1; const gy = height(p.x, p.z);
    const g = new THREE.Group(); g.position.set(p.x, gy, p.z); g.rotation.y = Math.atan2(0.25, dir); // 문의 트인 방향(로컬 x)을 길 방향에 맞춤
    const wood = lam('#7a5636');
    [-2.2, 2.2].forEach((ox) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 4.2, 6), wood); c.position.set(0, 2.1, ox); c.castShadow = true; g.add(c); });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 5.2, 6), wood); top.rotation.x = Math.PI / 2; top.position.y = 4.2; g.add(top);
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), lam('#6aa04a')); leaf.position.set(0, 4.4, -1.2); g.add(leaf);
    const leaf2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), lam('#7fb25a')); leaf2.position.set(0, 4.3, 1.4); g.add(leaf2);
    scene.add(g);
  });
}
