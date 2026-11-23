// 클린하우스(재활용장): 지붕 있는 작은 정류장 꼴 + 종류별 통 5개 + 옆 귤 가판대(상점). 로우폴리 임시 모양
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
  // 옆 귤 가판대(상점 입구): 지붕 띠·계산대·귤 바구니. 클린하우스 오른쪽
  const stall = new THREE.Group(); const SX = W / 2 + 2.6, SZ = 0.6;
  { const sp = [], sw = 1.9, sd = 1.1;
    sp.push(piece(new THREE.BoxGeometry(sw, 1.0, sd).translate(0, 0.5, 0), '#b08350')); // 계산대
    sp.push(piece(new THREE.BoxGeometry(sw + 0.1, 0.08, sd + 0.1).translate(0, 1.04, 0), '#8a6a3c'));
    for (const a of [-1, 1]) sp.push(piece(new THREE.BoxGeometry(0.1, 2.3, 0.1).translate(a * (sw / 2 - 0.05), 1.15, -sd / 2 + 0.05), '#3b4a42'));
    for (let i = 0; i < 4; i++) sp.push(piece(new THREE.BoxGeometry(sw / 4 + 0.02, 0.1, 1.0).rotateX(0.35).translate(-sw / 2 + sw / 8 + i * sw / 4, 2.3, -0.1), i % 2 ? '#f2efe4' : '#ff8a1f')); // 줄무늬 차양
    sp.push(piece(new THREE.CylinderGeometry(0.42, 0.32, 0.22, 8).translate(-0.35, 1.19, 0), '#8a6a3c')); // 바구니
    const gy = new THREE.IcosahedronGeometry(0.12, 0); for (let i = 0; i < 6; i++) { const a = i * 1.05; sp.push(piece(gy.clone().translate(-0.35 + Math.cos(a) * 0.18, 1.33 + (i % 2) * 0.05, Math.sin(a) * 0.18), '#ff9a2e')); }
    sp.push(piece(new THREE.BoxGeometry(0.5, 0.36, 0.06).translate(0.45, 1.3, 0.2), '#f7f5ee')); // 가격표
    const sx = x + rt.x * SX + fw.x * SZ, sz = z + rt.z * SX + fw.z * SZ;
    stall.add(new THREE.Mesh(mergeGeometries(sp), mat)); stall.position.set(sx, height(sx, sz) - 0.05, sz); stall.rotation.y = rot;
    stall.traverse((o) => { if (o.isMesh) { o.castShadow = !low; o.receiveShadow = !low; } }); scene.add(stall); }
  // 랭킹 게시판 (#11): 클린하우스 왼쪽. 현무암 판에 귤색 메달과 시상대 막대 (로우폴리 임시 모양)
  const BX = -(W / 2 + 2.2), BZ = 0.5;
  const board = new THREE.Group();
  { const bp = [], bw = 1.6, bh = 1.15;
    for (const a of [-1, 1]) bp.push(piece(new THREE.BoxGeometry(0.12, 2.1, 0.12).translate(a * (bw / 2 - 0.02), 1.05, -0.02), '#3b4a42')); // 기둥
    bp.push(piece(new THREE.BoxGeometry(bw + 0.14, bh + 0.14, 0.1).translate(0, 1.45, 0), '#2f3236')); // 테
    bp.push(piece(new THREE.BoxGeometry(bw, bh, 0.12).translate(0, 1.45, 0.01), '#4a4f55')); // 현무암 판
    bp.push(piece(new THREE.BoxGeometry(bw + 0.3, 0.1, 0.34).translate(0, 2.08, 0.04), '#2f7d5b')); // 작은 지붕
    [[-0.42, 0.3], [0, 0.46], [0.42, 0.2]].forEach(([px, h]) => bp.push(piece(new THREE.BoxGeometry(0.34, h, 0.04).translate(px, 0.98 + h / 2, 0.08), '#f2efe4'))); // 시상대 막대
    bp.push(piece(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 10).rotateX(Math.PI / 2).translate(0, 1.72, 0.09), '#ff9a1f')); // 메달
    bp.push(piece(new THREE.BoxGeometry(0.06, 0.2, 0.03).translate(-0.07, 1.92, 0.08), '#3c7fc9'), piece(new THREE.BoxGeometry(0.06, 0.2, 0.03).translate(0.07, 1.92, 0.08), '#d8423a')); // 메달 끈
    const bx = x + rt.x * BX + fw.x * BZ, bz = z + rt.z * BX + fw.z * BZ;
    board.add(new THREE.Mesh(mergeGeometries(bp), mat)); board.position.set(bx, height(bx, bz) - 0.05, bz); board.rotation.y = rot;
    board.traverse((o) => { if (o.isMesh) { o.castShadow = !low; o.receiveShadow = !low; } }); scene.add(board); }
  const boardFront = new THREE.Vector3(x + rt.x * BX + fw.x * (BZ + 1.4), 0, z + rt.z * BX + fw.z * (BZ + 1.4)); boardFront.y = height(boardFront.x, boardFront.z);
  const boardAt = { x: x + rt.x * BX + fw.x * BZ, z: z + rt.z * BX + fw.z * BZ };
  // 가판대 위 귤 표시: 화면에서 늘 같은 크기라 멀리서도 보임
  const markTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.arc(33, 36, 24, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ff8a1f'; g.beginPath(); g.arc(32, 34, 23, 0, Math.PI * 2); g.fill();
    g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke();
    g.fillStyle = 'rgba(0,0,0,.14)'; g.beginPath(); g.arc(37, 39, 15, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3d9a4a'; g.beginPath(); g.ellipse(36, 10, 9, 4.5, -0.4, 0, Math.PI * 2); g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: markTex, sizeAttenuation: false, depthWrite: false, transparent: true }));
  mark.scale.setScalar(CLEANHOUSE.stallMark); mark.renderOrder = 3;
  const markY = stall.position.y + 3.4; mark.position.set(stall.position.x, markY, stall.position.z); scene.add(mark);
  let markT = 0;
  const shopFront = new THREE.Vector3(x + rt.x * SX + fw.x * (SZ + 1.6), 0, z + rt.z * SX + fw.z * (SZ + 1.6)); shopFront.y = height(shopFront.x, shopFront.z);
  scene.add(root);
  root.updateMatrixWorld(true);
  const toWorld = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyMatrix4(root.matrixWorld);
  const binTop = binX.map((bx) => toWorld(bx, 1.45, -0.15));
  const front = toWorld(0, 0, D / 2 + 1.6); front.y = height(front.x, front.z);
  const center = toWorld(0, 0, 0);
  const bump = [0, 0, 0, 0, 0];
  function update(dt, night) {
    markT += dt; mark.position.y = markY + Math.sin(markT * 2.2) * 0.18;
    bulbMat.emissiveIntensity = night * 1.5; poolMat.opacity = night * 0.55; pool.visible = night > 0.02; /* #272 */
    if (light) light.intensity = night * 22;
    for (let i = 0; i < 5; i++) { if (bump[i] <= 0) continue; bump[i] = Math.max(0, bump[i] - dt * 4); const k = Math.sin(bump[i] * Math.PI); lids[i].position.y = 1.37 + k * 0.18; lids[i].rotation.x = -k * 0.25; }
  }
  return { root, binTop, front, center, shopFront, stallTop: mark.position, mark, boardFront, boardAt, board, update, pop: (i) => { bump[i] = 1; }, types: TRASH_TYPES };
}

// 오름 안 작은 클린하우스 (#78): 지붕 있는 통 넷(캔·페트병·비닐·스티로폼+폐어구). 가판대·실제 광원 없음
// 비탈이면 현무암 단을 높은 쪽에 맞춰 쌓아 통이 묻히지 않게 함. 돌려주는 모양은 createCleanhouse 와 같음(binTop·pop 은 쓰레기 종류 번호)
export function createMiniCleanhouse({ scene, height, x, z, rot, low, trashGeos }) {
  const root = new THREE.Group();
  const W = 4.0, D = 1.7, H = 2.15, MAP = CLEANHOUSE.miniBins;
  const fw = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot)), rt = new THREE.Vector3(Math.cos(rot), 0, -Math.sin(rot));
  let lo = 1e9, hi = -1e9; for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) { const y = height(x + rt.x * a * W / 2 + fw.x * b * D / 2, z + rt.z * a * W / 2 + fw.z * b * D / 2); lo = Math.min(lo, y); hi = Math.max(hi, y); }
  const top = hi + 0.08, base = top - lo + 0.5; // 단 높이: 가장 낮은 귀퉁이 밑까지
  root.position.set(x, top, z); root.rotation.y = rot;
  const parts = [];
  parts.push(piece(new THREE.BoxGeometry(W + 0.5, base, D + 0.6).translate(0, -base / 2, 0), '#5a5f63')); // 현무암 단
  parts.push(piece(new THREE.BoxGeometry(W + 0.62, 0.1, D + 0.72).translate(0, -0.03, 0), '#4a4f53')); // 단 테
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push(piece(new THREE.BoxGeometry(0.14, H, 0.14).translate(a * (W / 2 - 0.08), H / 2, b * (D / 2 - 0.08)), '#3b4a42'));
  const roof = new THREE.BoxGeometry(W + 0.6, 0.13, D + 0.8); roof.rotateX(-0.14); roof.translate(0, H + 0.12, 0.05);
  parts.push(piece(roof, '#2f7d5b'));
  parts.push(piece(new THREE.BoxGeometry(W + 0.64, 0.16, 0.1).translate(0, H + 0.26, D / 2 + 0.45), '#f2efe4')); // 앞 처마 띠
  const BW = 0.84, gap = 0.12, x0 = -((BW + gap) * 3) / 2, cols = CLEANHOUSE.binColors, binX = [];
  for (let i = 0; i < 4; i++) {
    const bx = x0 + i * (BW + gap); binX.push(bx);
    parts.push(piece(new THREE.BoxGeometry(BW, 0.95, 0.82).translate(bx, 0.475, -0.12), cols[i]));
    parts.push(piece(new THREE.BoxGeometry(BW * 0.62, 0.34, 0.02).translate(bx, 0.6, 0.3), '#f7f5ee'));
    parts.push(piece(new THREE.BoxGeometry(BW + 0.05, 0.07, 0.88).translate(bx, 0.04, -0.12), '#2b2f33'));
  }
  // 표지판 위 종류 그림: 쓰레기 모양을 납작하게 본체에 합침 (그리기 횟수 줄이기)
  if (trashGeos) [0, 1, 2, 3].forEach((i) => { const g = trashGeos[i].clone(); g.deleteAttribute('color'); parts.push(piece(g.scale(0.42, 0.42, 0.08).translate(binX[i], 0.54, 0.32), '#4a4f55')); });
  const mat = miniMat();
  const body = new THREE.Mesh(mergeGeometries(parts), mat); body.castShadow = !low; body.receiveShadow = !low; root.add(body);
  const lidY = 1.0;
  const lids = binX.map((bx, i) => { const m = new THREE.Mesh(piece(new THREE.BoxGeometry(BW + 0.05, 0.08, 0.88), new THREE.Color(cols[i]).lerp(new THREE.Color('#ffffff'), 0.18)), mat); m.position.set(bx, lidY, -0.12); m.castShadow = !low; root.add(m); return m; });
  // 밤: 지붕 밑 등 + 바닥 빛웅덩이만 (실제 광원은 들머리 것 하나)
  const bulbMat = new THREE.MeshLambertMaterial({ color: '#fff3c4', emissive: '#ffd27a', emissiveIntensity: 0 });
  const bulb = new THREE.Mesh(new THREE.BoxGeometry(W * 0.6, 0.07, 0.18), bulbMat); bulb.position.set(0, H - 0.04, 0.15); root.add(bulb);
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(W + 3, D + 4).rotateX(-Math.PI / 2), poolMat); pool.position.set(0, 0.04, 0.9); pool.renderOrder = 2; root.add(pool);
  scene.add(root); root.updateMatrixWorld(true);
  const toWorld = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyMatrix4(root.matrixWorld);
  const binTop = MAP.map((b) => toWorld(binX[b], lidY + 0.1, -0.12));
  const front = toWorld(0, 0, D / 2 + 1.5); front.y = height(front.x, front.z);
  const center = toWorld(0, 0, 0);
  const bump = [0, 0, 0, 0];
  function update(dt, night) {
    bulbMat.emissiveIntensity = night * 1.5; poolMat.opacity = night * 0.5; pool.visible = night > 0.02; /* #272 */
    for (let i = 0; i < 4; i++) { if (bump[i] <= 0) continue; bump[i] = Math.max(0, bump[i] - dt * 4); const k = Math.sin(bump[i] * Math.PI); lids[i].position.y = lidY + k * 0.15; lids[i].rotation.x = -k * 0.25; }
  }
  return { root, binTop, front, center, shopFront: null, stallTop: null, update, pop: (k) => { bump[MAP[k]] = 1; }, types: TRASH_TYPES, small: true };
}
let poolTex = null, miniM = null;
const miniMat = () => miniM || (miniM = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradHard }));
function poolTexture() {
  if (poolTex) return poolTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(255,215,140,1)'); gr.addColorStop(0.5, 'rgba(255,200,120,0.4)'); gr.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  poolTex = new THREE.CanvasTexture(c); poolTex.colorSpace = THREE.SRGBColorSpace; return poolTex;
}
