// 가게 거리 (#57): 골목 판석·빈 터('준비 중' 팻말)·벤치·화분·입구 간판, 그리고 가게 건물 build 함수 표
// 가게를 더하려면: balance.js SHOPS 에 한 줄 + 여기 SHOP_BUILD[id]·SHOP_ICON[id] (+ game/stores.js SHOP_POP 팝업, game/shop.js 가게 안내의 파는 것 SHOP_ITEMS). 건물은 Tripo 모델(#71, src/model-*.js + propmodel.js)
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gradHard } from './toon.js';
import { SHOP_ST, SHOPS, STONE, SALON, LEAP, GEAR_SHOP, MANJOK } from './balance.js';
import { createManjok, SPOON } from './manjok.js';
import { createGearShop, HAMMER } from './hardware.js';
import { createStone } from './stone.js';
import { FORK_KNIFE } from './stoneicons.js';
import { ic } from './icons.js';
import { createSalon } from './salon.js';
import { createLeap } from './leap.js';
import { createRideShop, RIDE_SHOP, RIDE_ICON } from './rides.js';
import { glowSprite } from './propmodel.js';

// 가위 (루이네 미장원 #58, 상호작용 '머리' 아이콘과 같음)
// 옷 (LEAP #59, 상호작용 '옷' 아이콘과 같음)
export const SHIRT = ic('wear');
export const SCISSORS = ic('cut');

// 가장자리 표시·입구 간판 아이콘 (24×24 선 그림)
export const SHOP_ICON = {
  stone: FORK_KNIFE,
  salon: SCISSORS,
  leap: SHIRT,
  ride: RIDE_ICON.scoot, // 탈것 가게 (#69)
  gear: HAMMER, // 장비점 (#128)
  manjok: SPOON, // 만족한상회 (#167): 수저
};

// 가게마다 건물 하나. lot = streetlayout 의 터, 반환 { door: 상호작용 자리, signPos: 가장자리 표시 기준, update?(dt, night), api }
export const SHOP_BUILD = {
  stone: ({ scene, height, lot, low, col, addWalkable }) => {
    const k = STONE.D / 2 + 0.3; // 터 앞 = 테라스 앞끝 조금 앞, 그 뒤 모델 가운데
    const site = { x: lot.front.x + lot.back.x * k, z: lot.front.z + lot.back.z * k, rot: lot.rot };
    const api = createStone({ scene, height, site, low, col, addWalkable });
    return { api, door: api.terrace, signPos: api.signPos, r: STONE.r, update: (dt, night) => api.update(dt, night) };
  },
  salon: ({ scene, height, lot, low, col }) => {
    const k = SALON.fore + SALON.D / 2; // 터 앞 = 드럼통 앞, 그 뒤 모델 가운데
    const site = { x: lot.front.x + lot.back.x * k, z: lot.front.z + lot.back.z * k, rot: lot.rot };
    const api = createSalon({ scene, height, site, low, col });
    return { api, door: api.door, signPos: api.signPos, r: SALON.r, update: (dt, night) => api.update(dt, night) };
  },
  leap: ({ scene, height, lot, low, col, addWalkable }) => {
    const k = LEAP.fore + LEAP.D / 2; // 터 앞 = 디딤판 앞, 그 뒤 모델 가운데
    const site = { x: lot.front.x + lot.back.x * k, z: lot.front.z + lot.back.z * k, rot: lot.rot };
    const api = createLeap({ scene, height, site, low, col, addWalkable });
    return { api, door: api.door, signPos: api.signPos, r: LEAP.r, update: (dt, night) => api.update(dt, night) };
  },
  gear: ({ scene, height, lot, low, col }) => { // 장비점 (#128, 임시 모양 hardware.js)
    const k = GEAR_SHOP.fore + GEAR_SHOP.D / 2;
    const site = { x: lot.front.x + lot.back.x * k, z: lot.front.z + lot.back.z * k, rot: lot.rot };
    const api = createGearShop({ scene, height, site, low, col });
    return { api, door: api.door, signPos: api.signPos, r: GEAR_SHOP.r, update: () => {} };
  },
  manjok: ({ scene, height, lot, low, col, addWalkable }) => { // 만족한상회 (#167, 코드로 만든 임시 모양 manjok.js). 원점 = 터 앞
    const api = createManjok({ scene, height, site: { x: lot.front.x, z: lot.front.z, rot: lot.rot }, low, col, addWalkable });
    return { api, door: api.terrace, signPos: api.signPos, r: MANJOK.r, update: (dt, night) => api.update(dt, night) };
  },
  ride: ({ scene, height, lot, low, col }) => { // 탈것 가게 (#69, 임시 모양)
    const k = RIDE_SHOP.fore + RIDE_SHOP.D / 2;
    const site = { x: lot.front.x + lot.back.x * k, z: lot.front.z + lot.back.z * k, rot: lot.rot };
    const api = createRideShop({ scene, height, site, low, col });
    return { api, door: api.door, signPos: api.signPos, r: RIDE_SHOP.r, update: () => {} };
  },
};

// 가게 하나 세우기: SHOP_BUILD 결과에 그 가게가 장면에 더한 물건(objs)을 붙임 (#182 지붕 간판이 건물 경계 상자를 잼)
export function buildShop(id, args) {
  const { scene } = args, n0 = scene.children.length, r = SHOP_BUILD[id](args);
  return { ...r, objs: scene.children.slice(n0) };
}

// 지붕 위 큰 아이콘 간판 (#128·#182): 가게마다 늘 카메라를 보는 둥근 판(현무암 바탕·귤색 테·흰 아이콘), 살 수 있는 새 물건이 있으면 오른쪽 위 귤색 점
// 자리·높이는 가게 모델 경계 상자에서 자동 (건물 가운데 위, 꼭대기 + 반지름 + roofGap). Tripo 모델이 늦게 오면 다시 잼. 가는 현무암 기둥이 받침
// 둘레 눈높이에서 그래도 가려지는 간판만 맨 위에 그림(가까이선 살짝 투명). 멀면 화면 최소 크기만큼 키움, 밤엔 뒤에 따뜻한 빛
// shops = place.js shopsBuilt (objs 포함). 반환 { signs, dot(id, on), off(id, on), update(dt, night, camera, viewH), fit(), seen(from) }
export function createRoofSigns({ scene, height, street, shops }) {
  const S = SHOP_ST, signs = {};
  const dotMat = new THREE.SpriteMaterial({ map: canvasTex(64, 64, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ff8a1f'; g.beginPath(); g.arc(32, 32, 23, 0, Math.PI * 2); g.fill(); }), depthWrite: false, transparent: true });
  const poleMat = new THREE.MeshToonMaterial({ color: '#3b4044', gradientMap: gradHard }), poleGeo = new THREE.CylinderGeometry(S.roofPole, S.roofPole * 1.3, 1, 6).translate(0, 0.5, 0);
  for (const sh of shops) {
    const L = street.lot(sh.lot); if (!L || !SHOP_ICON[sh.id]) continue;
    const tex = canvasTex(128, 128, (g, up) => {
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(66, 68, 58, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2f3336'; g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.fill(); g.lineWidth = 8; g.strokeStyle = '#ff8a1f'; g.stroke();
      svgImg(SHOP_ICON[sh.id], '#f3ecdc', (img) => { g.drawImage(img, 26, 26, 76, 76); up(); });
    });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
    sp.scale.setScalar(S.roofSize); sp.renderOrder = 3; scene.add(sp);
    const dot = new THREE.Sprite(dotMat.clone()); dot.renderOrder = 4; dot.visible = false; scene.add(dot);
    const glow = glowSprite('#ffcf7a', 1); glow.renderOrder = 2; scene.add(glow);
    const pole = new THREE.Mesh(poleGeo, poleMat); pole.castShadow = false; scene.add(pole);
    const meshes = []; for (const o of sh.objs || []) o.traverseVisible((m) => { if (m.isMesh && !m.isSprite) meshes.push(m); }); // 숨긴 것(머리 자르기 효과·접시)은 뺌
    // 모델이 없으면(objs 없음) 터 가운데 위 6m
    const k = L.d * 0.45;
    signs[sh.id] = { sp, dot, glow, pole, meshes, L, reach: Math.max(L.w, L.d), pos: sp.position, top: height(L.x, L.z) + 6, roofY: height(L.x, L.z) + 4, x: L.front.x + L.back.x * k, z: L.front.z + L.back.z * k, size: S.roofSize, onTop: false, sig: '' };
  }
  const box = new THREE.Box3(), tmp = new THREE.Box3(), ray = new THREE.Raycaster(), V = new THREE.Vector3(), D = new THREE.Vector3();
  const sigOf = (s) => s.meshes.map((m) => m.geometry.uuid).join();
  // 가게 경계 상자 → 자리·높이, 지붕 면(가운데에서 아래로 쏨) → 기둥 밑
  function place(s) {
    if (!s.meshes.length) return;
    box.makeEmpty(); const C = new THREE.Vector3();
    for (const m of s.meshes) { m.updateWorldMatrix(true, false); if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); tmp.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld); tmp.getCenter(C); if (Math.hypot(C.x - s.L.x, C.z - s.L.z) > s.reach) continue; box.union(tmp); } // 터 밖 물건은 뺌
    if (box.isEmpty()) return;
    s.x = (box.min.x + box.max.x) / 2; s.z = (box.min.z + box.max.z) / 2; s.top = box.max.y;
    ray.set(V.set(s.x, s.top + 1, s.z), D.set(0, -1, 0)); ray.far = s.top - box.min.y + 1;
    const hit = ray.intersectObjects(s.meshes, false)[0]; s.roofY = hit ? hit.point.y : box.min.y;
    s.sig = sigOf(s);
  }
  // 간판 둘레 눈높이 자리에서 간판 가운데까지 막는 물건(지형·간판 빼고 간판 15m 안 물건)이 있는지
  let near = null;
  function nearObjs() {
    const out = [], c = new THREE.Vector3(), sph = new THREE.Sphere(), own = new Set();
    for (const s of Object.values(signs)) own.add(s.sp).add(s.dot).add(s.glow).add(s.pole);
    scene.traverse((m) => {
      if (!m.isMesh || m.isSprite || own.has(m) || !m.visible || !m.geometry || m.isInstancedMesh || m.isSkinnedMesh) return; // 여러 벌 그리는 나무·풀은 맵 전체라 뺌 (가게 터 둘레는 나무를 비움)
      if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
      m.updateWorldMatrix(true, false); sph.copy(m.geometry.boundingSphere).applyMatrix4(m.matrixWorld);
      if (sph.radius > 25) return; // 지형·큰 판은 뺌
      for (const s of Object.values(signs)) { c.set(s.x, sph.center.y, s.z); if (sph.center.distanceTo(c) - sph.radius < 15) { out.push(m); break; } }
    });
    return out;
  }
  function blocked(s, from) {
    D.copy(s.sp.position).sub(from); const d = D.length(); ray.set(from, D.normalize()); ray.far = d - s.size * 0.3;
    return ray.intersectObjects(near, false).some((h) => !(h.object.material && h.object.material.transparent && h.object.material.opacity < 0.3));
  }
  // 둘레 12방향 × roofSee 거리, 땅 + roofSeeH 에서 봐서 하나라도 가리면 맨 위에 그림
  function check(s) {
    let n = 0;
    for (const r of S.roofSee) for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, x = s.x + Math.sin(a) * r, z = s.z + Math.cos(a) * r; if (blocked(s, V.set(x, height(x, z) + S.roofSeeH, z).clone())) n++; }
    s.onTop = n > 0; s.blockN = n;
  }
  function setY(s) {
    const y = s.top + s.size / 2 + S.roofGap;
    s.sp.position.set(s.x, y, s.z); s.sp.scale.setScalar(s.size);
    s.dot.position.set(s.x, y + s.size * 0.36, s.z); s.dot.scale.setScalar(s.size * 0.34); s.dot.center.set(-0.9, 0.5);
    s.glow.position.set(s.x, y, s.z); s.glow.scale.setScalar(s.size * 1.7);
    s.pole.position.set(s.x, s.roofY - 0.1, s.z); s.pole.scale.y = Math.max(0.1, y - s.size * 0.4 - s.roofY + 0.1); // 간판 아래 테두리까지 (아이콘을 가로지르지 않게)
  }
  function fit() {
    for (const s of Object.values(signs)) { place(s); s.size = S.roofSize; setY(s); }
    near = nearObjs(); for (const s of Object.values(signs)) check(s);
  }
  fit();
  let wait = 0, waited = 0;
  function update(dt, night, camera, viewH) {
    // Tripo 모델이 늦게 오면 경계 상자가 바뀜: 0.5초마다 보고 바뀌었으면 다시 잼 (2분까지)
    if (waited < 120 && (wait += dt) > 0.5) { waited += wait; wait = 0; if (Object.values(signs).some((s) => s.meshes.length && sigOf(s) !== s.sig)) fit(); }
    const tanH = Math.tan((camera.fov * Math.PI) / 360), cp = camera.position;
    for (const s of Object.values(signs)) {
      const d = Math.hypot(cp.x - s.x, cp.y - s.sp.position.y, cp.z - s.z);
      const want = Math.min(S.roofSize * S.roofMaxK, Math.max(S.roofSize, (S.roofMinPx * 2 * d * tanH) / Math.max(1, viewH)));
      if (Math.abs(want - s.size) > 0.02) { s.size = want; setY(s); }
      const dh0 = Math.hypot(cp.x - s.x, cp.z - s.z), vis = dh0 < S.roofShow; // 멀리서는 감춤 (#201)
      if (s.sp.visible !== vis) { s.sp.visible = vis; s.glow.visible = vis; }
      if (!vis) continue;
      const dh = dh0, top = s.onTop && dh > S.roofTopNear && d < S.roofTopFar, m = s.sp.material;
      if (m.depthTest === top) { m.depthTest = !top; s.dot.material.depthTest = !top; s.glow.material.depthTest = !top; s.sp.renderOrder = top ? 999 : 3; s.dot.renderOrder = top ? 1000 : 4; }
      m.opacity = top && d < S.roofNear ? S.roofFade : 1;
      s.glow.material.opacity = s.off ? 0 : night * S.roofGlow; /* 닫힌 가게는 간판이 꺼짐 (#206) */
    }
  }
  const seen = (from) => Object.fromEntries(Object.entries(signs).map(([k, s]) => [k, !blocked(s, from)]));
  // 닫힌 가게 (#206): 간판을 어둡게, 밤빛 없이
  const off = (id, on) => { const s = signs[id]; if (!s || !!s.off === !!on) return; s.off = !!on; s.sp.material.color.set(on ? 0x55585a : 0xffffff); };
  return { signs, dot: (id, on) => { const s = signs[id]; if (s && s.dot.visible !== on) s.dot.visible = on; }, off, update, fit, seen, nearN: () => near.length };
}

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
  // 안내도 앞 (#128): 판 앞(걸어오는 쪽) 1.4m, 상호작용 '가게 안내'
  const front = new THREE.Vector3(bp.x + Math.sin(bry) * 1.4, 0, bp.z + Math.cos(bry) * 1.4); front.y = height(front.x, front.z);
  return { board, soon: soonSigns.length, boardFront: front, boardTop: new THREE.Vector3(bp.x, by + 3.6, bp.z) };
}
