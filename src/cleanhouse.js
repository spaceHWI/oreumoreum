// 클린하우스(재활용장): 지붕 있는 작은 정류장 꼴 + 종류별 통 5개. 로우폴리 임시 모양
// 통 순서는 balance.js 의 TRASH_TYPES 순서(캔·페트병·비닐·스티로폼·폐어구)
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gradHard } from './toon.js';
import { TRASH_TYPES, CLEANHOUSE } from './balance.js';

function piece(g, color) { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); g.computeVertexNormals(); const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }

export function createCleanhouse({ scene, height, x, z, rot, low, trashGeos }) {
  const root = new THREE.Group();
  // 땅이 기울어도 뜨지 않게: 네 귀퉁이 중 가장 낮은 곳에 맞추고 바닥판을 두껍게
  const W = 7.2, D = 2.8, H = 2.9;
  const fw = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot)), rt = new THREE.Vector3(Math.cos(rot), 0, -Math.sin(rot));
  let y0 = 1e9; for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) y0 = Math.min(y0, height(x + rt.x * a * W / 2 + fw.x * b * D / 2, z + rt.z * a * W / 2 + fw.z * b * D / 2));
  root.position.set(x, y0, z); root.rotation.y = rot;
  const parts = [];
  // 바닥 (현무암 판)
  parts.push(piece(new THREE.BoxGeometry(W + 0.6, 0.9, D + 0.8).translate(0, -0.3, 0), '#5a5f63'));
  // 기둥 4개
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push(piece(new THREE.BoxGeometry(0.18, H, 0.18).translate(a * (W / 2 - 0.1), H / 2 + 0.15, b * (D / 2 - 0.1)), '#3b4a42'));
  // 지붕: 앞이 조금 높은 한쪽 경사
  const roof = new THREE.BoxGeometry(W + 0.9, 0.16, D + 1.2); roof.rotateX(-0.12); roof.translate(0, H + 0.3, 0.1);
  parts.push(piece(roof, '#2f7d5b'));
  parts.push(piece(new THREE.BoxGeometry(W + 0.95, 0.22, 0.12).translate(0, H + 0.48, D / 2 + 0.68), '#f2efe4')); // 앞 처마 띠
  // 뒷벽 (아래쪽만 막음)
  parts.push(piece(new THREE.BoxGeometry(W - 0.1, 1.5, 0.1).translate(0, 0.9, -D / 2 + 0.1), '#d9d4c4'));
  // 통 5개 (몸통만, 뚜껑은 따로 움직임)
  const BW = 1.12, gap = 0.18, x0 = -((BW + gap) * 4) / 2;
  const binCols = CLEANHOUSE.binColors;
  const binX = [];
  for (let i = 0; i < 5; i++) {
    const bx = x0 + i * (BW + gap); binX.push(bx);
    parts.push(piece(new THREE.BoxGeometry(BW, 1.15, 1.0, 1, 1, 1).translate(bx, 0.15 + 0.575, -0.15), binCols[i]));
    parts.push(piece(new THREE.BoxGeometry(BW * 0.62, 0.42, 0.02).translate(bx, 0.82, 0.36), '#f7f5ee')); // 앞 표지판
    parts.push(piece(new THREE.BoxGeometry(BW + 0.06, 0.08, 1.06).translate(bx, 0.2, -0.15), '#2b2f33')); // 바닥 테
  }
  const mat = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradHard });
  const body = new THREE.Mesh(mergeGeometries(parts), mat); body.castShadow = !low; body.receiveShadow = !low; root.add(body);
  // 뚜껑 (통에 들어갈 때 살짝 들썩)
  const lidGeo = piece(new THREE.BoxGeometry(BW + 0.06, 0.1, 1.06), '#ffffff');
  const lids = binCols.map((c, i) => { const m = new THREE.Mesh(lidGeo, new THREE.MeshToonMaterial({ color: new THREE.Color(c).lerp(new THREE.Color('#ffffff'), 0.18), vertexColors: true, gradientMap: gradHard })); m.position.set(binX[i], 1.37, -0.15); m.castShadow = !low; root.add(m); return m; });
  // 표지판 위 종류 그림 (쓰레기 모양을 작게)
  const signMat = new THREE.MeshToonMaterial({ color: '#4a4f55', vertexColors: true, gradientMap: gradHard });
  if (trashGeos) trashGeos.forEach((g, i) => { const m = new THREE.Mesh(g, signMat); const s = i === 4 ? 0.34 : 0.55; m.scale.set(s, s, s * 0.2); m.position.set(binX[i], 0.74, 0.38); root.add(m); });
  // 밤 조명: 지붕 밑 등 + 바닥 빛웅덩이 (+ 저사양이 아니면 실제 광원 하나, 늘 켜 두고 세기만 바꿈)
  const bulbMat = new THREE.MeshLambertMaterial({ color: '#fff3c4', emissive: '#ffd27a', emissiveIntensity: 0 });
  const bulb = new THREE.Mesh(new THREE.BoxGeometry(W * 0.7, 0.08, 0.22), bulbMat); bulb.position.set(0, H + 0.12, 0.2); root.add(bulb);
  const poolTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(255,215,140,1)'); gr.addColorStop(0.5, 'rgba(255,200,120,0.4)'); gr.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(W + 5, D + 6).rotateX(-Math.PI / 2), poolMat); pool.position.set(0, 0.2, 1.2); pool.renderOrder = 2; root.add(pool);
  const light = low ? null : new THREE.PointLight('#ffd08a', 0, 14, 2);
  if (light) { light.position.set(0, H - 0.2, 0.8); root.add(light); }
  scene.add(root);
  root.updateMatrixWorld(true);
  const toWorld = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyMatrix4(root.matrixWorld);
  const binTop = binX.map((bx) => toWorld(bx, 1.45, -0.15));
  const front = toWorld(0, 0, D / 2 + 1.6); front.y = height(front.x, front.z);
  const center = toWorld(0, 0, 0);
  const bump = [0, 0, 0, 0, 0];
  function update(dt, night) {
    bulbMat.emissiveIntensity = night * 1.5; poolMat.opacity = night * 0.55;
    if (light) light.intensity = night * 22;
    for (let i = 0; i < 5; i++) { if (bump[i] <= 0) continue; bump[i] = Math.max(0, bump[i] - dt * 4); const k = Math.sin(bump[i] * Math.PI); lids[i].position.y = 1.37 + k * 0.18; lids[i].rotation.x = -k * 0.25; }
  }
  return { root, binTop, front, center, update, pop: (i) => { bump[i] = 1; }, types: TRASH_TYPES };
}
