// 장비점 (#128): 가게 거리 빈 터의 작은 철물점 (로우폴리 임시 모양, 실제 가게가 정해지면 바꿈). 수치는 balance.js GEAR_SHOP
// 현무암 벽 + 앞이 트인 가게, 함석 지붕·귤색 차양. 안 진열: 벽에 건 집게·갈퀴, 선반의 배낭, 귤 활. 앞 간판에 집게·배낭·활 그림
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gradHard } from './toon.js';
import { GEAR_SHOP } from './balance.js';

// 지붕 간판·가장자리 표시 아이콘 (24×24 선 그림): 망치
export const HAMMER = '<path d="M4 20l9.5-9.5"/><path d="M12.8 5.6l5.6 5.6-2.2 2.2-5.6-5.6z"/><path d="M12.8 5.6L10.6 3.4"/>';
// 앞 간판 그림: 집게·배낭·활
export const GEAR_SIGN = [
  '<path d="M10 3l1 18M14 3l-1 18M9 8h6"/>',
  '<path d="M6 8h12v13H6zM9 8V6a3 3 0 0 1 6 0v2M9 13h6v4H9z"/>',
  '<path d="M6 3c7 2 11 8 9 18M6 3l9 18M10 12l10-6M20 6l-3-.5M20 6l-.5 3"/><circle cx="19" cy="6" r="1.6"/>',
];

const M4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
function piece(g, color, m) {
  g = g.index ? g.toNonIndexed() : g; if (g.attributes.uv) g.deleteAttribute('uv'); if (m) g.applyMatrix4(m); g.computeVertexNormals();
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
const box = (w, h, d, c, m) => piece(new THREE.BoxGeometry(w, h, d), c, m);
const cyl = (rt, rb, h, c, m, seg = 8) => piece(new THREE.CylinderGeometry(rt, rb, h, seg), c, m);

export function createGearShop({ scene, height, site, low = false, col = null }) {
  const { W, D } = GEAR_SHOP, g = new THREE.Group(), H = 3.6;
  const y0 = Math.min(...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => { const s = Math.sin(site.rot), c = Math.cos(site.rot), lx = a * W / 2, lz = b * D / 2; return height(site.x + c * lx + s * lz, site.z - s * lx + c * lz); }));
  g.position.set(site.x, y0, site.z); g.rotation.y = site.rot; scene.add(g);
  const BS = ['#4b5054', '#555a5e', '#43474a'], TIN = '#5f7f8a', WD = '#8a6440';
  const P = [
    box(W, 0.3, D, '#6b6f73', M4(0, 0, 0)), box(W - 0.3, 0.06, D - 0.3, '#9a958a', M4(0, 0.17, 0)), // 바닥 (시멘트)
    box(W, H, 0.3, BS[0], M4(0, H / 2, -D / 2 + 0.15)), // 뒷벽 (현무암)
    box(0.3, H, D, BS[1], M4(W / 2 - 0.15, H / 2, 0)), box(0.3, H, D, BS[2], M4(-W / 2 + 0.15, H / 2, 0)), // 옆벽
    box(W + 0.6, 0.12, D + 1.0, TIN, M4(0, H + 0.18, 0.2, 0.1)), // 함석 지붕 (앞으로 기움)
    box(W + 0.4, 0.55, 0.06, '#ff8a1f', M4(0, H - 0.2, D / 2 + 0.7)), // 귤색 차양 끝
    box(W - 0.8, 0.9, 0.7, WD, M4(0, 0.6, 1.0)), box(W - 0.7, 0.08, 0.8, '#b08350', M4(0, 1.08, 1.0)), // 계산대
    box(W - 0.9, 0.08, 0.5, WD, M4(0, 1.5, -D / 2 + 0.55)), box(W - 0.9, 0.08, 0.5, WD, M4(0, 2.4, -D / 2 + 0.55)), // 뒷벽 선반
    box(2.2, 1.4, 0.06, '#3a2c22', M4(-2.0, 2.1, -D / 2 + 0.33)), // 공구 거는 판
  ];
  // 벽에 건 집게·갈퀴 (판 위)
  for (const [x, h] of [[-2.7, 1.1], [-2.2, 1.2], [-1.6, 1.0]]) { P.push(box(0.05, h, 0.05, '#c8c2b4', M4(x, 2.1, -D / 2 + 0.4))); P.push(box(0.3, 0.06, 0.05, '#c8c2b4', M4(x, 2.1 - h / 2, -D / 2 + 0.4))); }
  // 선반의 배낭 (색 셋)
  ['#3d9a4a', '#3c7fc9', '#d8423a'].forEach((c, i) => { const x = 0.6 + i * 0.95; P.push(box(0.6, 0.6, 0.4, c, M4(x, 1.85, -D / 2 + 0.55)), box(0.36, 0.22, 0.08, '#2b2b2b', M4(x, 1.8, -D / 2 + 0.79))); });
  // 위 선반: 귤 바구니·귤 활
  P.push(cyl(0.34, 0.26, 0.2, '#8a6a3c', M4(-0.6, 2.56, -D / 2 + 0.55)));
  for (let i = 0; i < 5; i++) { const a = i * 1.25; P.push(piece(new THREE.IcosahedronGeometry(0.1, 0), '#ff9a2e', M4(-0.6 + Math.cos(a) * 0.15, 2.7, -D / 2 + 0.55 + Math.sin(a) * 0.15))); }
  P.push(piece(new THREE.TorusGeometry(0.55, 0.04, 4, 10, Math.PI), '#7a4a2c', M4(1.6, 2.95, -D / 2 + 0.5, 0, 0, -Math.PI / 2)), box(0.02, 1.1, 0.02, '#f3ecdc', M4(1.6, 2.95, -D / 2 + 0.5)));
  // 앞 기둥
  for (const a of [-1, 1]) P.push(box(0.2, H, 0.2, '#3b4044', M4(a * (W / 2 - 0.1), H / 2, D / 2 - 0.1)));
  const m = new THREE.Mesh(mergeGeometries(P), new THREE.MeshToonMaterial({ color: '#ffffff', vertexColors: true, gradientMap: gradHard }));
  m.castShadow = !low; m.receiveShadow = !low; g.add(m);
  // 앞 간판: 집게·배낭·활 그림
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#2f3336'; x.fillRect(0, 0, 512, 128); x.strokeStyle = '#ff8a1f'; x.lineWidth = 8; x.strokeRect(4, 4, 504, 120);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  GEAR_SIGN.forEach((path, i) => { const img = new Image(); img.onload = () => { x.drawImage(img, 76 + i * 136, 14, 100, 100); tex.needsUpdate = true; }; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100" height="100" fill="none" stroke="#f3ecdc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`); });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: tex })); sign.position.set(0, H - 0.2, D / 2 + 0.74); sign.rotation.x = -0.1; g.add(sign);
  g.updateMatrixWorld(true);
  const w = (lx, lz, ly = 0) => new THREE.Vector3(lx, ly, lz).applyMatrix4(g.matrixWorld);
  if (col) { const b = w(0, 0); col.addBox(b.x, b.z, site.rot, W / 2 - 0.1, D / 2 - 0.2); }
  const door = w(0, D / 2 + 1.6); door.y = height(door.x, door.z);
  return { door, signPos: w(0, D / 2 + 0.74, H), update() {}, group: g };
}
