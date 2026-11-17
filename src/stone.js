// 레스토랑 스톤 (#50): 아담한 현무암 단층 레스토랑. 가게 거리(#57) 안쪽 끝 터. 건물은 Tripo 모델(#71, model-stone.js), 야자수·받침만 로우폴리
// 로컬 좌표: +Z = 앞(테라스·골목 너머 개울·바다 쪽), +X = 하류 쪽(탐방로 쪽). 원점 = 건물 가운데 바닥
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gradHard } from './toon.js';
import { STONE } from './balance.js';
import { STONE_LOGO } from './stonelogo.js';
import { propMesh, glowSprite } from './propmodel.js';
import { STONE_M } from './model-stone.js';

function piece(g, color, jit = 0, seed = 1) {
  g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); g.computeVertexNormals();
  const c = new THREE.Color(color); if (jit) { const k = 1 + (Math.sin(seed * 12.9898) * 43758.5453 % 1) * jit; c.multiplyScalar(k); }
  const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

// 둥근 간판: 크림색 원판에 실제 로고(model/stone/logo.png → stonelogo.js)
function logoTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#f1e6cc'; g.beginPath(); g.arc(128, 128, 128, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const img = new Image(); img.onload = () => { const w = 200, h = w * img.height / img.width; g.drawImage(img, 128 - w / 2, 128 - h / 2, w, h); t.needsUpdate = true; }; img.src = STONE_LOGO;
  return t;
}

// 모델 좌표(Tripo shop-stone, 크기 약 1, 앞 = +z) 로 잰 자리. 로컬(m) = 모델 × STONE.s, 바닥(테라스 나무 위)이 로컬 y=0
const M = {
  floor: 0.075, // 테라스 나무 바닥 높이
  house: { x: 0.43, z0: -0.46, z1: 0.085 }, // 건물 벽 (반폭, 뒤·앞)
  deck: { x: 0.42, z0: 0.085, z1: 0.47 }, // 테라스
  tables: [[-0.26, 0.28], [0.27, 0.32]], // 탁자 (왼쪽 · 파라솔 밑)
  tableTop: 0.165, chairs: 0.1, // 탁자 윗면 높이, 의자까지 반경
  seat: [-0.17, 0.19], // 앉는 의자: 왼쪽 탁자 건물 쪽 오른 의자
  logo: [0, 0.43, 0.118, 0.062], // 둥근 간판 가운데·반지름
  windows: [[-0.33, -0.165, 0.21, 0.36, 0.08], [0.155, 0.315, 0.21, 0.36, 0.08], [-0.035, 0.035, 0.23, 0.29, 0.07]], // 창 (x0, x1, y0, y1, 앞면 z) · 마지막은 문 창
  bulbs: [[-0.385, 0.46], [-0.29, 0.415], [-0.19, 0.415], [-0.115, 0.455], [0.105, 0.455], [0.185, 0.415], [0.275, 0.415], [0.37, 0.46]], bulbZ: 0.11,
  top: 0.589,
};

export function createStone({ scene, height, site, low, col, addWalkable }) {
  const { x, z, rot } = site, S = STONE.s;
  const L = (v) => v * S, LY = (v) => (v - M.floor) * S; // 모델 → 로컬
  const fw = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot)), rt = new THREE.Vector3(Math.cos(rot), 0, -Math.sin(rot));
  const wpt = (lx, lz) => [x + rt.x * lx + fw.x * lz, z + rt.z * lx + fw.z * lz];
  const hw = L(0.45), zb = L(-0.49), zf = L(M.deck.z1);
  // 바닥 높이: 건물·테라스 귀퉁이 중 가장 높은 곳 + 조금 (풀이 판 위로 안 나오게)
  let yHi = -1e9, yLo = 1e9; for (const a of [-1, 0, 1]) for (const b of [zb, 0, zf]) { const [px, pz] = wpt(a * hw, b); const h = height(px, pz); yHi = Math.max(yHi, h); yLo = Math.min(yLo, h); }
  const y0 = yHi + 0.3;
  const root = new THREE.Group(); root.position.set(x, y0, z); root.rotation.y = rot;
  // 건물 (Tripo 모델): 현무암 벽·나무 처마·테라스·탁자·의자·파라솔·전구 줄·둥근 간판까지 한 덩어리
  const model = propMesh(STONE_M, S, { floor: M.floor, low, glow: 0.12 }); root.add(model);
  const parts = [];
  // 받침(현무암): 비탈에서 모델 밑이 뜨지 않게
  const plH = y0 - yLo + 0.6;
  parts.push(piece(box(hw * 2 - 0.2, plH, zf - zb - 0.2, 0, LY(0) + 0.3 - plH / 2, (zf + zb) / 2), '#3b4044')); // 위끝이 모델 받침 안에 숨음
  // 야자수 둘 (로고처럼 양옆)
  const palmTop = [], palmAt = [];
  for (const s of [-1, 1]) {
    const bx = s * (hw + 1.4), bz = L(0.12); let px = bx, py = -0.6, pz = bz; palmAt.push([bx, bz]);
    for (let k = 0; k < 7; k++) { const h = 0.8, nx = px + s * 0.07 * k * 0.6, ny = py + h; const g = new THREE.CylinderGeometry(0.17 - k * 0.012, 0.2 - k * 0.012, h + 0.04, 7); const m = new THREE.Matrix4().makeRotationZ(-s * 0.06 * k).setPosition(nx, py + h / 2, pz); g.applyMatrix4(m); parts.push(piece(g, k % 2 ? '#8a6d4f' : '#7a5e43')); px = nx; py = ny; }
    palmTop.push([px, py, pz]);
    for (let f = 0; f < 8; f++) { const a = f / 8 * Math.PI * 2 + s * 0.3; let fx = px, fy = py, fzz = pz;
      for (let j = 0; j < 4; j++) { const len = 0.62, droop = 0.25 + j * 0.32, dx = Math.cos(a) * len * Math.cos(droop), dz = Math.sin(a) * len * Math.cos(droop), dy = -Math.sin(droop) * len + (j === 0 ? 0.18 : 0);
        const g = new THREE.BoxGeometry(len + 0.05, 0.04, 0.42 - j * 0.07); const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, -a, Math.atan2(dy, Math.hypot(dx, dz)), 'YXZ')).setPosition(fx + dx / 2, fy + dy / 2, fzz + dz / 2); g.applyMatrix4(m); parts.push(piece(g, j % 2 ? '#3f8a45' : '#4f9a4a', 0.1, f * 7 + j)); fx += dx; fy += dy; fzz += dz; } }
    for (let k = 0; k < 3; k++) { const a = k * 2.1; parts.push(piece(new THREE.IcosahedronGeometry(0.13, 0).translate(px + Math.cos(a) * 0.18, py - 0.15, pz + Math.sin(a) * 0.18), '#6b4a2a')); }
  }
  const mat = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradHard });
  const body = new THREE.Mesh(mergeGeometries(parts), mat); body.castShadow = !low; body.receiveShadow = !low; root.add(body);
  // 둥근 간판에 실제 로고
  const logo = new THREE.Mesh(new THREE.CircleGeometry(L(M.logo[3]), 32), new THREE.MeshBasicMaterial({ map: logoTexture() }));
  logo.position.set(L(M.logo[0]), LY(M.logo[1]), L(M.logo[2]) + 0.03); root.add(logo);
  // 밤: 창이 따뜻하게 빛남 (창 자리에 더하기 섞기 판), 처마 밑 전구도 빛남
  const winMat = new THREE.MeshBasicMaterial({ color: '#ffb85a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const wins = M.windows.map(([x0, x1, wy0, wy1, wz]) => new THREE.PlaneGeometry(L(x1 - x0), L(wy1 - wy0)).translate(L((x0 + x1) / 2), LY((wy0 + wy1) / 2), L(wz) + 0.03));
  root.add(new THREE.Mesh(mergeGeometries(wins), winMat));
  const bulbs = M.bulbs.map(([bx, by]) => { const sp = glowSprite('#ffcf7a', 0.9); sp.position.set(L(bx), LY(by), L(M.bulbZ) + 0.05); root.add(sp); return sp; });
  // 밤 빛웅덩이 + (저사양이 아니면) 광원 하나
  const T = L(M.deck.z1 - M.deck.z0), tzc = L((M.deck.z0 + M.deck.z1) / 2);
  const poolTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(255,210,140,1)'); gr.addColorStop(0.5, 'rgba(255,195,120,0.4)'); gr.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2 + 3, T + 4).rotateX(-Math.PI / 2), poolMat); pool.position.set(0, 0.04, tzc); pool.renderOrder = 2; root.add(pool);
  const light = low ? null : new THREE.PointLight('#ffc77a', 0, 16, 2);
  if (light) { light.position.set(0, 2.2, tzc); root.add(light); }
  scene.add(root); root.updateMatrixWorld(true);
  const toWorld = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyMatrix4(root.matrixWorld);

  // 충돌: 건물·받침 옆면은 막고, 테라스는 걸어 올라감. 탁자(의자 포함)·야자수
  const tables = M.tables.map(([tx, tz]) => ({ x: L(tx), z: L(tz) }));
  if (col) {
    { const [cx, cz] = wpt(0, L((M.house.z0 + M.house.z1) / 2)); col.addBox(cx, cz, rot, L(M.house.x) + 0.15, L((M.house.z1 - M.house.z0) / 2) + 0.1); }
    tables.forEach((t) => { const [tx, tz] = wpt(t.x, t.z); col.add(tx, tz, L(M.chairs) + 0.15); });
    palmAt.forEach(([px0, pz0]) => { const [px, pz] = wpt(px0, pz0); col.add(px, pz, 0.35); });
  }
  if (addWalkable) { const [cx, cz] = wpt(0, tzc); addWalkable(cx, cz, rot, L(M.deck.x) + 0.25, T / 2 + 0.25, y0 + 0.02); }

  // 자리: 왼쪽 탁자의 건물 쪽 의자 (탁자 너머 골목·개울을 봄)
  const tm = tables[0], seatL = [L(M.seat[0]), L(M.seat[1])];
  const seat = toWorld(seatL[0], 0.05, seatL[1]);
  const seatGo = toWorld(seatL[0] + 0.9, 0.05, seatL[1] - 0.2); // 의자 옆에서 앉음
  const tableTop = LY(M.tableTop);
  const table = toWorld(tm.x, tableTop, tm.z);
  const terrace = toWorld(0, 0.05, tzc);
  const center = toWorld(0, 0, 0);
  const signPos = toWorld(0, LY(M.top) + 0.4, L(M.house.z1));
  const toTable = Math.atan2(tm.x - seatL[0], tm.z - seatL[1]);
  const seatHeading = rot + toTable; // 탁자를 봄

  // 식탁 위 음식: 접시 + 음식 덩이 (먹으면 줄어듦)
  const plate = new THREE.Group(); plate.visible = false; scene.add(plate);
  const plateMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.04, 12), new THREE.MeshToonMaterial({ color: '#f7f5ee', gradientMap: gradHard }));
  const foodMat = new THREE.MeshToonMaterial({ color: '#f2a65a', gradientMap: gradHard });
  const food = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 1).scale(1, 0.5, 1), foodMat); food.position.y = 0.06;
  const glassM = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.22, 8), new THREE.MeshToonMaterial({ color: '#c2416b', gradientMap: gradHard, transparent: true, opacity: 0.85 })); glassM.position.y = 0.12;
  plate.add(plateMesh, food, glassM);
  plate.position.copy(toWorld(tm.x + (seatL[0] - tm.x) * 0.35, tableTop + 0.02, tm.z + (seatL[1] - tm.z) * 0.35)); plate.rotation.y = seatHeading;
  function serve(item) { plate.visible = !!item; if (!item) return; plateMesh.visible = food.visible = !item.drink; glassM.visible = !!item.drink; foodMat.color.set(item.food); glassM.material.color.set(item.food); setLeft(1); }
  function setLeft(k) { food.scale.setScalar(Math.max(0.05, k)); glassM.scale.set(1, Math.max(0.05, k), 1); glassM.position.y = 0.12 * Math.max(0.05, k); }

  function update(dt, night) {
    winMat.opacity = night * 0.75; for (const b of bulbs) b.material.opacity = night; poolMat.opacity = night * 0.5;
    if (light) light.intensity = night * 20;
  }
  return { root, center, terrace, seat, seatGo, seatHeading, table, signPos, update, serve, setLeft, y0 };
}
