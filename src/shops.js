// 가게 거리 (#57): 골목 판석·빈 터('준비 중' 팻말)·벤치·화분·입구 간판, 그리고 가게 건물 build 함수 표
// 가게를 더하려면: balance.js SHOPS 에 한 줄 + 여기 SHOP_BUILD[id]·SHOP_ICON[id] (+ main 의 팝업). 건물 모양은 나중에 Tripo 모델로 바꿈
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gradHard } from './toon.js';
import { SHOP_ST, SHOPS, STONE, SALON } from './balance.js';
import { createStone } from './stone.js';
import { FORK_KNIFE } from './stoneicons.js';
import { createSalon } from './salon.js';

// 가위 (루이네 미장원 #58, 상호작용 '머리' 아이콘과 같음)
export const SCISSORS = '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/>';

// 가장자리 표시·입구 간판 아이콘 (24×24 선 그림)
export const SHOP_ICON = {
  stone: FORK_KNIFE,
  salon: SCISSORS,
};

// 가게마다 건물 하나. lot = streetlayout 의 터, 반환 { door: 상호작용 자리, signPos: 가장자리 표시 기준, update?(dt, night), api }
export const SHOP_BUILD = {
  stone: ({ scene, height, lot, low, col, addWalkable }) => {
    const k = STONE.T + STONE.D / 2; // 터 앞 = 테라스 앞끝, 그 뒤 건물 가운데
    const site = { x: lot.front.x + lot.back.x * k, z: lot.front.z + lot.back.z * k, rot: lot.rot };
    const api = createStone({ scene, height, site, low, col, addWalkable });
    return { api, door: api.terrace, signPos: api.signPos, r: STONE.r, update: (dt, night) => api.update(dt, night) };
  },
  salon: ({ scene, height, lot, low, col }) => {
    const k = SALON.fore + SALON.D / 2; // 터 앞 = 드럼통 앞, 그 뒤 건물 가운데
    const site = { x: lot.front.x + lot.back.x * k, z: lot.front.z + lot.back.z * k, rot: lot.rot };
    const api = createSalon({ scene, height, site, low, col });
    return { api, door: api.door, signPos: api.signPos, r: SALON.r, update: (dt, night) => api.update(dt, night) };
  },
};

function piece(g, color, jit = 0, seed = 1) {
  g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); g.computeVertexNormals();
  const c = new THREE.Color(color); if (jit) c.multiplyScalar(1 + (((Math.sin(seed * 12.9898) * 43758.5453) % 1 + 1) % 1 - 0.5) * jit);
  const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
const hash = (n) => { const v = Math.sin(n * 91.345) * 47453.5453; return v - Math.floor(v); };
const BASALT = ['#4b5054', '#555a5e', '#43474a', '#5d6266'];

// 캔버스 그림 → 텍스처
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; draw(g, () => { t.needsUpdate = true; }); return t; }
const svgImg = (path, color, done) => { const img = new Image(); img.onload = () => done(img); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`); };
// '준비 중' 팻말: 나무판에 주황 고깔 + 점 세 개 (글자 없이)
const soonTex = () => canvasTex(256, 192, (g) => {
  g.fillStyle = '#d9b98a'; g.fillRect(0, 0, 256, 192); g.strokeStyle = '#7a5a3a'; g.lineWidth = 10; g.strokeRect(5, 5, 246, 182);
  g.fillStyle = '#ff8a1f'; g.beginPath(); g.moveTo(92, 40); g.lineTo(124, 40); g.lineTo(150, 140); g.lineTo(66, 140); g.closePath(); g.fill();
  g.fillStyle = '#fff'; g.fillRect(84, 72, 48, 14); g.fillRect(76, 104, 64, 14);
  g.fillStyle = '#5a4030'; g.fillRect(50, 140, 116, 14);
  g.fillStyle = '#5a4030'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(184 + i * 0, 70 + i * 28, 9, 0, Math.PI * 2); g.fill(); }
});
// 입구 간판: 현무암 판에 가게 아이콘 + 빈 터 수만큼 고깔 점
const boardTex = (shops, soon) => canvasTex(160, 512, (g, up) => {
  g.fillStyle = '#2f3336'; g.fillRect(0, 0, 160, 512); g.strokeStyle = '#ff8a1f'; g.lineWidth = 8; g.strokeRect(4, 4, 152, 504);
  const n = shops.length + (soon ? 1 : 0), step = 480 / Math.max(3, n);
  shops.forEach((s, i) => { const y = 16 + step * i + step / 2; g.fillStyle = '#f3ecdc'; g.beginPath(); g.arc(80, y, 56, 0, Math.PI * 2); g.fill();
    if (SHOP_ICON[s.id]) svgImg(SHOP_ICON[s.id], '#1d1d1d', (img) => { g.drawImage(img, 80 - 40, y - 40, 80, 80); up(); }); });
  if (soon) { const y = 16 + step * shops.length + step / 2; g.fillStyle = '#ff8a1f'; g.beginPath(); g.moveTo(70, y - 40); g.lineTo(90, y - 40); g.lineTo(108, y + 30); g.lineTo(52, y + 30); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.fillRect(64, y - 12, 32, 10); }
});

// 골목·빈 터·벤치·화분·간판. 가게 건물은 main 이 SHOP_BUILD 로 따로 세움
export function createShopStreet({ scene, height, street, low, col }) {
  const S = SHOP_ST, { P, fx, fz, ax, az } = street, parts = [];
  const rotA = Math.atan2(ax, az); // 앞(+Z)이 골목 안쪽을 보는 회전
  // 두 점 사이 띠 충돌 (collide.addBox 는 로컬 X 를 따라 원을 이음)
  const wallCol = (a, b, hd) => { const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz); col.addBox((a.x + b.x) / 2, (a.z + b.z) / 2, Math.atan2(-dz, dx), Math.max(hd, len / 2), hd); };
  const place = (g, x, y, z, ry) => { g.applyMatrix4(new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z)); return g; };
  // 1) 골목 바닥: 엇갈린 현무암 판석 (땅 높이를 따라 한 장씩)
  let seed = 1;
  for (let s = 1.6; s < S.end + S.gap + 0.2; ) {
    const len = 0.9 + hash(seed++) * 0.6;
    for (let t = -S.half; t < S.half - 0.05; ) {
      const wd = Math.min(S.half - t, 0.8 + hash(seed++) * 0.7), sc = s + len / 2, tc = t + wd / 2, p = P(sc, tc);
      const y = Math.max(height(p.x, p.z), height(P(s, t).x, P(s, t).z), height(P(s + len, t + wd).x, P(s + len, t + wd).z));
      parts.push(piece(place(new THREE.BoxGeometry(wd - 0.07, 0.16, len - 0.07), p.x, y + 0.01, p.z, rotA), BASALT[seed % 4], 0.14, seed));
      t += wd;
    }
    s += len;
  }
  // 골목 가장자리 연석
  for (const side of [-1, 1]) for (let s = 1.6; s < S.end; s += 1.5) { const p = P(s + 0.75, side * (S.half + 0.12)); parts.push(piece(place(new THREE.BoxGeometry(0.24, 0.22, 1.42), p.x, height(p.x, p.z) + 0.04, p.z, rotA), '#3b4044', 0.1, seed++)); }
  // 2) 빈 터: 낮은 현무암 돌담(앞 가운데는 트임) + '준비 중' 팻말
  const used = new Set(SHOPS.map((s) => s.lot)), soonSigns = [];
  for (const L of street.lots) {
    if (used.has(L.i)) continue;
    const fw = new THREE.Vector3(Math.sin(L.rot), 0, Math.cos(L.rot)), rt = new THREE.Vector3(fw.z, 0, -fw.x);
    const wpt = (lx, lz) => ({ x: L.x + rt.x * lx + fw.x * lz, z: L.z + rt.z * lx + fw.z * lz });
    const hw = L.w / 2 - 0.5, hd = L.d / 2 - 0.3, gate = 1.6;
    const segs = [[[-hw, -hd], [hw, -hd]], [[-hw, -hd], [-hw, hd]], [[hw, -hd], [hw, hd]], [[-hw, hd], [-gate, hd]], [[gate, hd], [hw, hd]]];
    for (const [[x0, z0], [x1, z1]] of segs) {
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 0.55));
      for (let i = 0; i < n; i++) { const u = (i + 0.5) / n, p = wpt(x0 + (x1 - x0) * u, z0 + (z1 - z0) * u), r = 0.3 + hash(seed++) * 0.12;
        parts.push(piece(new THREE.DodecahedronGeometry(r, 0).scale(1, 0.75, 1).rotateY(hash(seed++) * 6).translate(p.x, height(p.x, p.z) + r * 0.55, p.z), BASALT[seed % 4], 0.15, seed));
        if (hash(seed++) < 0.55) { const r2 = r * 0.8; parts.push(piece(new THREE.DodecahedronGeometry(r2, 0).scale(1, 0.75, 1).rotateY(hash(seed++) * 6).translate(p.x, height(p.x, p.z) + r * 1.05 + r2 * 0.4, p.z), BASALT[(seed + 1) % 4], 0.15, seed)); } }
      if (col) wallCol(wpt(x0, z0), wpt(x1, z1), 0.35);
    }
    // 팻말: 트인 곳 옆, 골목 쪽을 봄
    const sp = wpt(gate + 1.3, hd + 0.4), y = height(sp.x, sp.z);
    parts.push(piece(place(new THREE.BoxGeometry(0.12, 1.3, 0.12), sp.x, y + 0.65, sp.z, L.rot), '#6b4a32'));
    soonSigns.push({ x: sp.x, y: y + 1.35, z: sp.z, rot: L.rot });
    if (col) col.add(sp.x, sp.z, 0.2);
  }
  // 3) 벤치·화분 (골목 가장자리)
  const edge = (s, side, k = 0.75) => P(s, side * (S.half + S.gap + k));
  for (const [s, side] of S.benches) {
    const p = edge(s, side, 0.5), y = height(p.x, p.z), ry = rotA + Math.PI / 2; // 긴 쪽이 골목을 따라
    parts.push(piece(place(new THREE.BoxGeometry(1.8, 0.08, 0.5).translate(0, 0.46, 0), p.x, y, p.z, ry), '#a67a4e', 0.1, seed++));
    for (const a of [-0.7, 0.7]) parts.push(piece(place(new THREE.BoxGeometry(0.22, 0.44, 0.44).translate(a, 0.22, 0), p.x, y, p.z, ry), '#3b4044'));
    if (col) wallCol(P(s - 0.9, side * (S.half + S.gap + 0.5)), P(s + 0.9, side * (S.half + S.gap + 0.5)), 0.3);
  }
  for (const [s, side] of S.planters) {
    const p = edge(s, side, 0.5), y = height(p.x, p.z);
    parts.push(piece(new THREE.CylinderGeometry(0.42, 0.34, 0.55, 8).translate(p.x, y + 0.27, p.z), '#4b5054', 0.1, seed++));
    parts.push(piece(new THREE.IcosahedronGeometry(0.5, 0).scale(1, 0.8, 1).translate(p.x, y + 0.8, p.z), '#4f9a4a', 0.15, seed++));
    for (let i = 0; i < 4; i++) { const a = i * 1.7 + s; parts.push(piece(new THREE.IcosahedronGeometry(0.11, 0).translate(p.x + Math.cos(a) * 0.32, y + 1.0 + (i % 2) * 0.12, p.z + Math.sin(a) * 0.32), i % 2 ? '#ff8a1f' : '#f2d04a')); }
    if (col) col.add(p.x, p.z, 0.45);
  }
  // 4) 입구 간판: 골목 어귀 시작 쪽 모서리, 길을 봄 (가게 아이콘을 세로로)
  const bp = P(2.4, -(S.half + 1.2)), by = height(bp.x, bp.z), bry = Math.atan2(-fx * 0.8 - ax * 0.6, -fz * 0.8 - az * 0.6); // 시작에서 걸어오는 쪽을 보고 길 쪽으로 조금 돌림
  for (const a of [-0.48, 0.48]) parts.push(piece(place(new THREE.BoxGeometry(0.14, 3.6, 0.14).translate(a, 1.8, 0), bp.x, by, bp.z, bry), '#3a2c22'));
  parts.push(piece(place(new THREE.BoxGeometry(1.2, 0.14, 0.3).translate(0, 3.66, 0), bp.x, by, bp.z, bry), '#3a2c22'));
  if (col) col.add(bp.x, bp.z, 0.6);
  const mat = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradHard });
  const body = new THREE.Mesh(mergeGeometries(parts), mat); body.receiveShadow = !low; body.castShadow = false; scene.add(body);
  const shops = SHOPS.filter((s) => street.lot(s.lot));
  const board = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 2.7), new THREE.MeshBasicMaterial({ map: boardTex(shops, soonSigns.length > 0), side: THREE.DoubleSide }));
  board.position.set(bp.x, by + 2.1, bp.z); board.rotation.y = bry; scene.add(board);
  if (soonSigns.length) {
    const sMat = new THREE.MeshBasicMaterial({ map: soonTex(), side: THREE.DoubleSide }), sGeo = [];
    for (const s of soonSigns) sGeo.push(new THREE.PlaneGeometry(0.9, 0.68).applyMatrix4(new THREE.Matrix4().makeRotationY(s.rot).setPosition(s.x, s.y, s.z)));
    scene.add(new THREE.Mesh(mergeGeometries(sGeo), sMat));
  }
  return { board, soon: soonSigns.length };
}
