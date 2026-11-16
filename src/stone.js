// 레스토랑 스톤 (#50): 아담한 현무암 단층 레스토랑. 가게 거리(#57) 안쪽 끝 터. 로우폴리 임시 모양
// 로컬 좌표: +Z = 앞(테라스·골목 너머 개울·바다 쪽), +X = 하류 쪽(탐방로 쪽). 원점 = 건물 가운데 바닥
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gradHard } from './toon.js';
import { STONE } from './balance.js';
import { STONE_LOGO } from './stonelogo.js';

function piece(g, color, jit = 0, seed = 1) {
  g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); g.computeVertexNormals();
  const c = new THREE.Color(color); if (jit) { const k = 1 + (Math.sin(seed * 12.9898) * 43758.5453 % 1) * jit; c.multiplyScalar(k); }
  const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

// 간판 그림: 크림색 판에 로고 + Stone
function signTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 192; const g = c.getContext('2d');
  g.fillStyle = '#f3ecdc'; g.fillRect(0, 0, 512, 192);
  g.strokeStyle = '#2b2b2b'; g.lineWidth = 8; g.strokeRect(6, 6, 500, 180);
  g.fillStyle = '#1d1d1d'; g.font = '800 92px Georgia, "Times New Roman", serif'; g.textBaseline = 'middle'; g.fillText('Stone', 220, 92);
  g.font = 'italic 20px Georgia, serif'; g.fillStyle = '#555'; g.fillText('Maximize all the Pleasure', 222, 152);
  const t = new THREE.CanvasTexture(c);
  const img = new Image(); img.onload = () => { g.drawImage(img, 26, 12, 186, 168); t.needsUpdate = true; }; img.src = STONE_LOGO;
  return t;
}

export function createStone({ scene, height, site, low, col, addWalkable }) {
  const { x, z, rot } = site, W = STONE.W, D = STONE.D, H = STONE.H, T = STONE.T;
  const fw = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot)), rt = new THREE.Vector3(Math.cos(rot), 0, -Math.sin(rot));
  const wpt = (lx, lz) => [x + rt.x * lx + fw.x * lz, z + rt.z * lx + fw.z * lz];
  // 바닥 높이: 건물·테라스 네 귀퉁이 중 가장 높은 곳 + 조금 (풀이 판 위로 안 나오게)
  let yHi = -1e9, yLo = 1e9; for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [0, -1]]) { const [px, pz] = wpt(a * W / 2, b < 0 ? -D / 2 : D / 2 + T * (b > 0 ? 1 : 0)); const h = height(px, pz); yHi = Math.max(yHi, h); yLo = Math.min(yLo, h); }
  const y0 = yHi + 0.3;
  const root = new THREE.Group(); root.position.set(x, y0, z); root.rotation.y = rot;
  const parts = []; let seed = 1;
  // 받침(현무암) + 테라스 나무 바닥
  const plH = y0 - yLo + 0.6;
  parts.push(piece(box(W + 0.5, plH, D + T + 0.5, 0, -plH / 2, T / 2), '#3b4044'));
  for (let i = 0; i < 9; i++) { const pw = (W + 0.2) / 9; parts.push(piece(box(pw - 0.04, 0.1, T, -W / 2 - 0.1 + pw * (i + 0.5), 0.05, D / 2 + T / 2), '#a67a4e', 0.12, i + 3)); }
  // 현무암 벽: 줄마다 폭이 다른 돌 블록을 쌓음 (색·튀어나옴 조금씩)
  const BASALT = ['#4b5054', '#555a5e', '#43474a', '#5d6266'];
  function wall(len, h, place, holes = []) { // place(u, y, w, hh) → 그 자리 블록 추가. u 는 0..len
    const rows = Math.round(h / 0.4), rh = h / rows;
    for (let r = 0; r < rows; r++) {
      let u = (r % 2) * -0.35;
      while (u < len) {
        const w = 0.6 + ((Math.sin((seed++) * 7.31) + 1) / 2) * 0.6, u0 = Math.max(0, u), u1 = Math.min(len, u + w), yc = r * rh + rh / 2;
        u += w; if (u1 - u0 < 0.12) continue;
        const cut = holes.find((o) => yc > o.y0 && yc < o.y1 && u1 > o.u0 && u0 < o.u1);
        if (cut) { // 구멍(창·문) 둘레만 남김
          if (u0 < cut.u0) place(u0, yc, cut.u0 - u0, rh); if (u1 > cut.u1) place(cut.u1, yc, u1 - cut.u1, rh); continue;
        }
        place(u0, yc, u1 - u0, rh);
      }
    }
  }
  const blk = (geo) => parts.push(piece(geo, BASALT[(seed++) % 4], 0.08, seed));
  const th = 0.4;
  // 뒷벽·옆벽
  wall(W, H, (u, y, w, hh) => blk(box(w - 0.03, hh - 0.03, th + ((seed % 3) * 0.03), -W / 2 + u + w / 2, y, -D / 2 + th / 2)));
  for (const s of [-1, 1]) wall(D - th, H, (u, y, w, hh) => blk(box(th + ((seed % 3) * 0.03), hh - 0.03, w - 0.03, s * (W / 2 - th / 2), y, -D / 2 + th + u + w / 2)), [{ u0: 1.4, u1: 3.6, y0: 0.9, y1: 2.4 }]);
  // 앞벽: 큰 창 둘 + 가운데 문
  const front = [{ u0: 0.6, u1: 3.7, y0: 0.55, y1: 2.45 }, { u0: 3.9, u1: 5.1, y0: -1, y1: 2.35 }, { u0: 5.3, u1: 8.4, y0: 0.55, y1: 2.45 }];
  wall(W, H, (u, y, w, hh) => blk(box(w - 0.03, hh - 0.03, th + ((seed % 3) * 0.03), -W / 2 + u + w / 2, y, D / 2 - th / 2)), front);
  // 창틀·문 (어두운 나무)
  const WOOD = '#4a3426';
  for (const o of [front[0], front[2]]) { const cx = -W / 2 + (o.u0 + o.u1) / 2, w = o.u1 - o.u0, hh = o.y1 - o.y0, cy = (o.y0 + o.y1) / 2;
    parts.push(piece(box(w + 0.1, 0.1, 0.5, cx, o.y0, D / 2 - 0.15), WOOD), piece(box(w + 0.1, 0.1, 0.5, cx, o.y1, D / 2 - 0.15), WOOD), piece(box(0.08, hh, 0.12, cx, cy, D / 2 - 0.2), WOOD)); }
  { const o = front[1], cx = -W / 2 + (o.u0 + o.u1) / 2; parts.push(piece(box(o.u1 - o.u0, o.y1, 0.12, cx, o.y1 / 2, D / 2 - 0.3), '#6b4a32'), piece(box(0.06, 0.3, 0.1, cx + 0.38, 1.1, D / 2 - 0.22), '#d6b06a')); }
  // 옆벽 창틀
  for (const s of [-1, 1]) parts.push(piece(box(0.5, 0.1, 2.3, s * (W / 2 - 0.2), 0.9, -D / 2 + th + 2.5), WOOD), piece(box(0.5, 0.1, 2.3, s * (W / 2 - 0.2), 2.4, -D / 2 + th + 2.5), WOOD));
  // 지붕: 평평한 판 + 밝은 처마 띠
  parts.push(piece(box(W + 1.0, 0.3, D + 1.2, 0, H + 0.15, 0.3), '#2f3235'));
  parts.push(piece(box(W + 1.06, 0.26, 0.1, 0, H + 0.13, D / 2 + 0.92), '#e7dfcc'));
  for (const s of [-1, 1]) parts.push(piece(box(0.1, 0.26, D + 1.2, s * (W / 2 + 0.53), H + 0.13, 0.3), '#e7dfcc'));
  // 테라스: 둥근 탁자 셋 + 의자 둘씩 + 파라솔
  const tables = [-2.9, 0.1, 3.0].map((tx, i) => ({ x: tx, z: D / 2 + T / 2 + (i === 1 ? 0.35 : -0.1) }));
  const PARA = ['#ece2c8', '#c8643c', '#ece2c8'];
  tables.forEach((t, i) => {
    parts.push(piece(new THREE.CylinderGeometry(0.58, 0.58, 0.06, 10).translate(t.x, 0.78, t.z), '#f1ede4'));
    parts.push(piece(new THREE.CylinderGeometry(0.06, 0.08, 0.72, 6).translate(t.x, 0.42, t.z), '#2e2e2e'));
    parts.push(piece(new THREE.CylinderGeometry(0.28, 0.3, 0.05, 8).translate(t.x, 0.1, t.z), '#2e2e2e'));
    for (const s of [-1, 1]) { const cz = t.z + s * 0.85; // 의자: 앞뒤
      parts.push(piece(box(0.46, 0.06, 0.44, t.x, 0.47, cz), '#8a5a36'));
      for (const a of [-1, 1]) for (const b of [-1, 1]) parts.push(piece(box(0.04, 0.44, 0.04, t.x + a * 0.19, 0.24, cz + b * 0.18), '#2e2e2e'));
      parts.push(piece(box(0.46, 0.42, 0.05, t.x, 0.72, cz + s * 0.21), '#8a5a36')); }
    parts.push(piece(new THREE.CylinderGeometry(0.03, 0.03, 2.3, 5).translate(t.x, 1.2, t.z), '#d9d2c2'));
    const cone = new THREE.ConeGeometry(1.35, 0.45, 8).translate(t.x, 2.45, t.z); parts.push(piece(cone, PARA[i]));
  });
  // 테라스 앞 기둥 둘 (전구 줄을 거는 곳)
  const posts = [[-W / 2 + 0.2, D / 2 + T - 0.2], [W / 2 - 0.2, D / 2 + T - 0.2]];
  for (const [px, pz] of posts) parts.push(piece(box(0.12, 2.7, 0.12, px, 1.35, pz), '#3a2c22'));
  // 야자수 둘 (로고처럼 양옆)
  const palmTop = [];
  for (const s of [-1, 1]) {
    const bx = s * (W / 2 + 1.5), bz = D / 2 + 0.6; let px = bx, py = -0.2, pz = bz;
    for (let k = 0; k < 7; k++) { const h = 0.75, nx = px + s * 0.07 * k * 0.6, ny = py + h; const g = new THREE.CylinderGeometry(0.17 - k * 0.012, 0.2 - k * 0.012, h + 0.04, 7); const m = new THREE.Matrix4().makeRotationZ(-s * 0.06 * k).setPosition(nx, py + h / 2, pz); g.applyMatrix4(m); parts.push(piece(g, k % 2 ? '#8a6d4f' : '#7a5e43')); px = nx; py = ny; }
    palmTop.push([px, py, pz]);
    for (let f = 0; f < 8; f++) { const a = f / 8 * Math.PI * 2 + s * 0.3; let fx = px, fy = py, fzz = pz;
      for (let j = 0; j < 4; j++) { const len = 0.62, droop = 0.25 + j * 0.32, dx = Math.cos(a) * len * Math.cos(droop), dz = Math.sin(a) * len * Math.cos(droop), dy = -Math.sin(droop) * len + (j === 0 ? 0.18 : 0);
        const g = new THREE.BoxGeometry(len + 0.05, 0.04, 0.42 - j * 0.07); const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, -a, Math.atan2(dy, Math.hypot(dx, dz)), 'YXZ')).setPosition(fx + dx / 2, fy + dy / 2, fzz + dz / 2); g.applyMatrix4(m); parts.push(piece(g, j % 2 ? '#3f8a45' : '#4f9a4a', 0.1, f * 7 + j)); fx += dx; fy += dy; fzz += dz; } }
    for (let k = 0; k < 3; k++) { const a = k * 2.1; parts.push(piece(new THREE.IcosahedronGeometry(0.13, 0).translate(px + Math.cos(a) * 0.18, py - 0.15, pz + Math.sin(a) * 0.18), '#6b4a2a')); }
  }
  const mat = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradHard });
  const body = new THREE.Mesh(mergeGeometries(parts), mat); body.castShadow = !low; body.receiveShadow = !low; root.add(body);
  // 창 유리: 낮엔 어둡게, 밤엔 따뜻하게
  const glassMat = new THREE.MeshLambertMaterial({ color: '#2a3a44', emissive: '#ffc46a', emissiveIntensity: 0 });
  const glass = [];
  for (const o of [front[0], front[2]]) glass.push(box(o.u1 - o.u0, o.y1 - o.y0, 0.04, -W / 2 + (o.u0 + o.u1) / 2, (o.y0 + o.y1) / 2, D / 2 - 0.22));
  for (const s of [-1, 1]) glass.push(box(0.04, 1.5, 2.2, s * (W / 2 - 0.22), 1.65, -D / 2 + th + 2.5));
  root.add(new THREE.Mesh(mergeGeometries(glass), glassMat));
  // 간판: 문 위 앞벽
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.9), new THREE.MeshBasicMaterial({ map: signTexture() }));
  sign.position.set(-W / 2 + 4.5, 2.85, D / 2 + 0.03); root.add(sign);
  const signBack = new THREE.Mesh(box(2.55, 1.02, 0.08, -W / 2 + 4.5, 2.85, D / 2 - 0.02), mat); signBack.geometry = piece(signBack.geometry, '#2b2b2b'); root.add(signBack);
  // 전구 줄: 지붕 앞 끝 → 테라스 기둥, 처진 줄 위 작은 전구
  const bulbs = [], wire = [];
  const roofEdge = [[-W / 2 + 0.3, H + 0.02, D / 2 + 0.9], [W / 2 - 0.3, H + 0.02, D / 2 + 0.9]];
  const strands = [[roofEdge[0], [posts[0][0], 2.65, posts[0][1]]], [roofEdge[1], [posts[1][0], 2.65, posts[1][1]]], [[posts[0][0], 2.65, posts[0][1]], [posts[1][0], 2.65, posts[1][1]]], [[0, H + 0.02, D / 2 + 0.9], [0, 2.4, D / 2 + T - 0.2]]];
  for (const [a, b] of strands) {
    const n = Math.max(4, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.8)); let prev = null;
    for (let i = 0; i <= n; i++) { const t = i / n, p = new THREE.Vector3(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * 0.35, a[2] + (b[2] - a[2]) * t);
      if (prev) { const d = p.distanceTo(prev), g = new THREE.BoxGeometry(0.02, 0.02, d); g.lookAt(p.clone().sub(prev)); g.translate((p.x + prev.x) / 2, (p.y + prev.y) / 2, (p.z + prev.z) / 2); wire.push(piece(g, '#222')); }
      if (i > 0 && i < n) bulbs.push(new THREE.IcosahedronGeometry(0.07, 0).translate(p.x, p.y - 0.08, p.z)); prev = p; }
  }
  root.add(new THREE.Mesh(mergeGeometries(wire), mat));
  const bulbMat = new THREE.MeshLambertMaterial({ color: '#fff3c4', emissive: '#ffcf7a', emissiveIntensity: 0 });
  root.add(new THREE.Mesh(mergeGeometries(bulbs), bulbMat));
  // 밤 빛웅덩이 + (저사양이 아니면) 광원 하나
  const poolTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(255,210,140,1)'); gr.addColorStop(0.5, 'rgba(255,195,120,0.4)'); gr.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(W + 3, T + 4).rotateX(-Math.PI / 2), poolMat); pool.position.set(0, 0.13, D / 2 + T / 2); pool.renderOrder = 2; root.add(pool);
  const light = low ? null : new THREE.PointLight('#ffc77a', 0, 16, 2);
  if (light) { light.position.set(0, 2.2, D / 2 + T / 2); root.add(light); }
  scene.add(root); root.updateMatrixWorld(true);
  const toWorld = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyMatrix4(root.matrixWorld);

  // 충돌: 건물·받침 옆면은 막고, 테라스는 걸어 올라감 (뒤·옆). 탁자·야자수·기둥
  if (col) {
    col.addBox(x, z, rot, W / 2 + 0.25, D / 2 + 0.25);
    tables.forEach((t) => { const [tx, tz] = wpt(t.x, t.z); col.add(tx, tz, 0.62); });
    palmTop.forEach((_, i) => { const [px, pz] = wpt((i ? 1 : -1) * (W / 2 + 1.5), D / 2 + 0.6); col.add(px, pz, 0.35); });
    posts.forEach(([a, b]) => { const [px, pz] = wpt(a, b); col.add(px, pz, 0.15); });
  }
  if (addWalkable) { const [cx, cz] = wpt(0, D / 2 + T / 2); addWalkable(cx, cz, rot, W / 2 + 0.25, T / 2 + 0.25, y0 + 0.1); }

  // 자리: 가운데 탁자 건물 쪽 의자(바다를 봄)
  const tm = tables[1], seatL = [tm.x, tm.z - 0.85];
  const seat = toWorld(seatL[0], 0.1, seatL[1] + 0.05);
  const seatGo = toWorld(seatL[0] + 0.9, 0.1, seatL[1]); // 의자 옆에서 앉음
  const table = toWorld(tm.x, 0.82, tm.z);
  const terrace = toWorld(0, 0.1, D / 2 + T / 2);
  const center = toWorld(0, 0, 0);
  const signPos = toWorld(-W / 2 + 4.5, H + 0.9, D / 2);
  const seatHeading = rot; // 앞(+Z) = 바다 쪽

  // 식탁 위 음식: 접시 + 음식 덩이 (먹으면 줄어듦)
  const plate = new THREE.Group(); plate.visible = false; scene.add(plate);
  const plateMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.04, 12), new THREE.MeshToonMaterial({ color: '#f7f5ee', gradientMap: gradHard }));
  const foodMat = new THREE.MeshToonMaterial({ color: '#f2a65a', gradientMap: gradHard });
  const food = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 1).scale(1, 0.5, 1), foodMat); food.position.y = 0.06;
  const glassM = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.22, 8), new THREE.MeshToonMaterial({ color: '#c2416b', gradientMap: gradHard, transparent: true, opacity: 0.85 })); glassM.position.y = 0.12;
  plate.add(plateMesh, food, glassM);
  plate.position.copy(table).add(new THREE.Vector3(-fw.x * 0.25, 0.02, -fw.z * 0.25)); plate.rotation.y = rot;
  function serve(item) { plate.visible = !!item; if (!item) return; plateMesh.visible = food.visible = !item.drink; glassM.visible = !!item.drink; foodMat.color.set(item.food); glassM.material.color.set(item.food); setLeft(1); }
  function setLeft(k) { food.scale.setScalar(Math.max(0.05, k)); glassM.scale.set(1, Math.max(0.05, k), 1); glassM.position.y = 0.12 * Math.max(0.05, k); }

  function update(dt, night) {
    glassMat.emissiveIntensity = night * 0.9; bulbMat.emissiveIntensity = night * 1.6; poolMat.opacity = night * 0.5;
    if (light) light.intensity = night * 20;
  }
  return { root, center, terrace, seat, seatGo, seatHeading, table, signPos, update, serve, setLeft, y0 };
}
