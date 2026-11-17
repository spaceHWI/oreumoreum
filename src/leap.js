// LEAP (#59): 가게 거리 2번 터의 러닝·트레일 러닝 편집숍. 귤로 옷·신발을 삼. 건물은 Tripo 모델(#71, model-leap.js) + SVG 간판 글자
// 실제 가게(제주시 서부두길 14): 노출 콘크리트 벽에 굵은 검정 기울임 글자 'LEAP', 바닥부터 천장까지 유리 진열창,
// 안에는 러닝화가 줄지어 놓인 선반 벽과 옷걸이, 밖에 검은 A자 입간판
// 로컬 좌표: +Z = 앞(골목 쪽), 원점 = 모델 가운데 · 디딤판 위
import * as THREE from 'three';
import { gradHard } from './toon.js';
import { LEAP } from './balance.js';
import { propMesh, svgTexture } from './propmodel.js';

function piece(g, color, jit = 0, seed = 1) {
  g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); g.computeVertexNormals();
  const c = new THREE.Color(color); if (jit) c.multiplyScalar(1 + ((((Math.sin(seed * 12.9898) * 43758.5453) % 1) + 1) % 1 - 0.5) * jit);
  const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

// 간판 그림: 콘크리트 회색 판(거푸집 이음·폼타이 구멍) + 굵은 검정 기울임 'LEAP'
export function drawLeapSign(g, w, h, { ties = true } = {}) {
  g.fillStyle = '#b4b5b1'; g.fillRect(0, 0, w, h);
  let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '40,40,40'},${0.04 + rnd() * 0.05})`; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 6 + rnd() * h * 0.25, 4 + rnd() * h * 0.12, rnd() * 3, 0, Math.PI * 2); g.fill(); }
  if (ties) {
    g.strokeStyle = 'rgba(60,60,60,.18)'; g.lineWidth = Math.max(1, h * 0.012);
    for (let x = w / 3; x < w - 1; x += w / 3) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    g.fillStyle = 'rgba(50,50,50,.35)';
    for (let x = w / 6; x < w; x += w / 3) for (const y of [h * 0.14, h * 0.86]) { g.beginPath(); g.arc(x, y, h * 0.025, 0, Math.PI * 2); g.fill(); }
  }
  g.save(); g.translate(w / 2, h / 2); g.transform(1, 0, -0.22, 1, 0, 0);
  g.fillStyle = '#111214'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 ${Math.round(h * 0.62)}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  g.fillText('LEAP', 0, h * 0.04, w * 0.8);
  g.restore();
}
// 팝업 위 로고 (간판과 같은 그림)
let logoUrl = '';
export function leapLogo() {
  if (logoUrl) return logoUrl;
  const c = document.createElement('canvas'); c.width = 480; c.height = 128; drawLeapSign(c.getContext('2d'), 480, 128, { ties: false });
  return (logoUrl = c.toDataURL('image/png'));
}
// 간판 글자 (SVG): 모델 위 검은 간판 띠에 굵은 기울임 'LEAP' (띠가 검정이라 글자는 흰색)
const SIGN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="192" viewBox="0 0 1024 192">'
  + '<text x="512" y="104" text-anchor="middle" dominant-baseline="middle" transform="skewX(-12) translate(22 0)" fill="#f4f4f1" font-weight="900" font-style="italic" font-size="150" letter-spacing="6" font-family="Arial Black, Helvetica Neue, Arial, sans-serif">LEAP</text></svg>';

// 모델 좌표(Tripo shop-leap, 크기 약 1, 앞 = +z) 로 잰 자리. 로컬(m) = 모델 × LEAP.s, 디딤판 위가 로컬 y=0
const M = {
  floor: 0.046,
  house: { x0: -0.37, x1: 0.41, z0: -0.42, z1: 0.35 }, // 건물 (콘크리트 상자)
  slab: 0.49, // 디딤판 반폭
  aframe: [-0.32, 0.4], // 검은 A자 입간판
  door: [-0.03, 0.18], // 유리문 (가운데 창살 ~ 오른쪽 끝)
  glass: [-0.35, 0.18, 0.06, 0.43], glassZ: 0.34, // 통유리 진열창 (x0, x1, y0, y1)
  band: [-0.37, 0.28, 0.54, 0.655, 0.359], // 검은 간판 띠 (x0, x1, y0, y1, 앞면 z)
  top: 0.767,
};

export function createLeap({ scene, height, site, low, col, addWalkable }) {
  const { x, z, rot } = site, S = LEAP.s;
  const L = (v) => v * S, LY = (v) => (v - M.floor) * S;
  const fw = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot)), rt = new THREE.Vector3(Math.cos(rot), 0, -Math.sin(rot));
  const wpt = (lx, lz) => [x + rt.x * lx + fw.x * lz, z + rt.z * lx + fw.z * lz];
  const hs = L(M.slab);
  let yHi = -1e9, yLo = 1e9;
  for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) { const [px, pz] = wpt(a * hs, b * hs); const h = height(px, pz); yHi = Math.max(yHi, h); yLo = Math.min(yLo, h); }
  const y0 = yHi + 0.12;
  const root = new THREE.Group(); root.position.set(x, y0, z); root.rotation.y = rot;
  // 건물 (Tripo 모델): 콘크리트 상자·검은 간판 띠·통유리 진열창(러닝화 선반·마네킹)·A자 입간판·디딤판
  const model = propMesh('leap', S, { floor: M.floor, low, glow: 0.12 }); root.add(model);
  // 받침: 비탈에서 디딤판 밑이 뜨지 않게
  const plH = y0 - yLo + 0.5;
  const plinth = new THREE.Mesh(piece(box(hs * 2 - 0.1, plH, hs * 2 - 0.1, 0, LY(0) + 0.05 - plH / 2, 0), '#6c6f6d'), new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradHard }));
  plinth.receiveShadow = !low; root.add(plinth);
  // 유리: 진열창 앞. 밤엔 안이 따뜻하게 밝음
  const glassMat = new THREE.MeshLambertMaterial({ color: '#a9c8d6', transparent: true, opacity: 0.16, depthWrite: false, emissive: '#ffd98a', emissiveIntensity: 0 });
  const [gx0, gx1, gy0, gy1] = M.glass;
  const glass = new THREE.Mesh(box(L(gx1 - gx0), L(gy1 - gy0), 0.03, L((gx0 + gx1) / 2), LY((gy0 + gy1) / 2), L(M.glassZ)), glassMat); glass.renderOrder = 3; root.add(glass);
  // 간판 글자 (SVG)
  const [bx0, bx1, by0, by1, bz] = M.band;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(L(bx1 - bx0), L(by1 - by0)), new THREE.MeshBasicMaterial({ map: svgTexture(SIGN_SVG, 1024, 192), transparent: true, depthWrite: false }));
  sign.position.set(L((bx0 + bx1) / 2), LY((by0 + by1) / 2), L(bz) + 0.04); root.add(sign);

  scene.add(root); root.updateMatrixWorld(true);
  const toWorld = (a, b, c) => new THREE.Vector3(a, b, c).applyMatrix4(root.matrixWorld);
  const H = M.house;
  if (col) {
    { const [cx, cz] = wpt(L((H.x0 + H.x1) / 2), L((H.z0 + H.z1) / 2)); col.addBox(cx, cz, rot, L((H.x1 - H.x0) / 2) + 0.1, L((H.z1 - H.z0) / 2) + 0.1); }
    { const [px, pz] = wpt(L(M.aframe[0]), L(M.aframe[1])); col.add(px, pz, 0.45); }
  }
  if (addWalkable) addWalkable(x, z, rot, hs, hs, y0);
  // 자리: 문 앞(상호작용·옷 입어 보는 곳). 입어 볼 때는 골목 쪽(+Z)을 봄 → 카메라가 골목에서 가게를 등진 캐릭터를 봄
  const doorX = L((M.door[0] + M.door[1]) / 2);
  const door = toWorld(doorX, 0, L(H.z1) + 1.5); door.y = height(door.x, door.z);
  const front = toWorld(0, 0, LEAP.D / 2 + LEAP.fore); front.y = height(front.x, front.z);
  const signPos = toWorld(0, LY(M.top) + 0.4, L(H.z1));
  const center = toWorld(0, 0, 0);

  let night = 0;
  function update(dt, n) { night = n; glassMat.emissiveIntensity = n * 0.95; glassMat.opacity = 0.16 + n * 0.34; }
  return { root, center, front, door, face: rot, signPos, update, y0, get night() { return night; } };
}
