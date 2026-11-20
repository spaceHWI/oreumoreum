// 구역 구분 (#136): 초보(1~2)·중수(3)·고수(4~5)가 눈으로 구분되게
// 1) 문턱: 탐방로가 묶음 경계를 넘는 곳마다. 초보→중수 = 열린 정낭 + 양옆 낮은 돌담, 중수→고수 = 큰 바위 문 + 방사탑. 옆에 안내판(구역 이름·나오는 적·권장 장비 점수)
// 2) 분위기: 땅·풀 색(namsongi.js uMood), 구역 소품(들꽃·억새·돌무더기·쓰러진 나무·그을린 자국·까마귀)
//    소품은 플레이어 둘레(drawR)만 한 메시로 모아 그림(draw call 1). 부딪힘 없음(길·지형·마차 길 그대로)
// 수치는 balance.js ZONE_LOOK. 지형 높이·길 모양은 건드리지 않는다
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gradHard } from './toon.js';
import { ZONE_LOOK as ZL, ZONES, ENEMIES, ENEMY_SPAWN, WALL } from './balance.js';
import { createPens } from './stonewall.js';
import { ZONE_BOX } from './zones.js';
import { TEXCS } from './boot.js';

export const tierOf = (z) => ZL.tier[z] || 0;
export const tierName = (z) => ZL.tiers[tierOf(z)]?.name || '';
export const tierColor = (z) => ZL.tiers[tierOf(z)]?.color || '#ffffff';
export const zoneName = (z) => ZONES.find((Z) => Z.id === z)?.name || '';
export const zoneShort = (z) => zoneName(z).replace('오름 자락 ', ''); // 배너·안내판용 짧은 이름 (숲길)
export const zoneEnemy = (z) => ENEMY_SPAWN.byZone[z] || null;
export const enemyName = (k) => ENEMIES[k]?.name || '';
export const josaIGa = (w) => { const c = (w || '').charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 ? '이' : '가'; };
export const josaEulReul = (w) => { const c = (w || '').charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 ? '을' : '를'; };
const mulberry = (seed) => { let s = seed >>> 0; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

// 적 그림 (48×48 SVG): 안내판·지도·경고에 같이 씀
const SK = 'stroke="#2a241c" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"';
const eye = (x, y, c = '#2a241c') => `<circle cx="${x}" cy="${y}" r="1.9" fill="${c}"/>`;
export const ENEMY_ICON = {
  piglet: `<ellipse cx="24" cy="29" rx="13" ry="9" fill="#c99a6e" ${SK}/><path d="M16 37v4M22 38v3M28 38v3M33 36v4" ${SK}/><circle cx="12" cy="25" r="6.5" fill="#c99a6e" ${SK}/><ellipse cx="7" cy="27" rx="2.6" ry="2.2" fill="#e8b9a0" ${SK}/><path d="M13 19l2-4 2 5" fill="#c99a6e" ${SK}/>${eye(11.5, 23.5)}<path d="M20 26h10M21 31h10" stroke="#f1d6b4" stroke-width="2"/>`,
  dog: `<path d="M12 30q2-8 14-8h8q4 0 4 5v4q0 3-3 3H15q-3 0-3-4z" fill="#d6a964" ${SK}/><path d="M16 34v7M22 34v7M31 34v7M36 33v7" ${SK}/><path d="M38 25q5-4 6-9" fill="none" ${SK}/><path d="M6 22q0-7 7-7 5 0 6 5v4q-1 4-6 4H9q-3 0-3-3z" fill="#d6a964" ${SK}/><path d="M13 15l-1-5 4 3" fill="#a87a3e" ${SK}/>${eye(13, 19)}<circle cx="6.5" cy="23" r="1.6" fill="#2a241c"/>`,
  boar: `<path d="M8 29q0-11 16-11 14 0 16 10 1 8-6 9H14q-6 0-6-8z" fill="#6e5038" ${SK}/><path d="M14 37v5M20 37v5M30 37v5M35 36v5" ${SK}/><path d="M20 18l4-5 3 5 4-4 2 5" fill="#4e3726" ${SK}/><ellipse cx="7" cy="30" rx="3.4" ry="3" fill="#8e6c50" ${SK}/><path d="M9 33q-1 4-4 4" fill="none" stroke="#fbf6e6" stroke-width="2.4" stroke-linecap="round"/>${eye(13, 25)}`,
  rabid: `<path d="M12 30q2-8 14-8h8q4 0 4 5v4q0 3-3 3H15q-3 0-3-4z" fill="#8e8a86" ${SK}/><path d="M16 34v7M22 34v7M31 34v7M36 33v7" ${SK}/><path d="M38 25l4-3 1 4 3-4" fill="none" ${SK}/><path d="M5 22q0-7 7-7 5 0 6 5v4q-1 4-6 4H8q-3 0-3-3z" fill="#8e8a86" ${SK}/><path d="M12 15l0-6 4 4" fill="#6e6a66" ${SK}/>${eye(12, 19, '#e23a2a')}<path d="M6 27l1 3 1-3 1 3 1-3" fill="#fbf6e6" ${SK} stroke-width="1.2"/><path d="M8 28q0 4 1 6" stroke="#9fd0e0" stroke-width="1.6" fill="none"/>`,
  alien: `<path d="M24 6q13 0 13 13 0 9-13 21Q11 28 11 19 11 6 24 6z" fill="#8fd06a" ${SK}/><ellipse cx="18.5" cy="20" rx="4.2" ry="5.6" fill="#1c1c22" transform="rotate(-22 18.5 20)"/><ellipse cx="29.5" cy="20" rx="4.2" ry="5.6" fill="#1c1c22" transform="rotate(22 29.5 20)"/><circle cx="17.5" cy="18" r="1.3" fill="#fff"/><circle cx="28.5" cy="18" r="1.3" fill="#fff"/><path d="M24 6V2M24 2h-0.01" ${SK}/><circle cx="24" cy="2.5" r="2" fill="#ffd23f" ${SK} stroke-width="1.4"/>`,
};
export const enemySvg = (k, attrs = '') => `<svg viewBox="0 0 48 48" ${attrs} aria-hidden="true">${ENEMY_ICON[k] || ''}</svg>`;

// ---------- 문턱 자리 ----------
// paths: {이름: [[x,z],...]}. 반환 [{ x, z, fx, fz (낮은 묶음 → 높은 묶음 방향), ux, uz (길과 직각), from, to (구역), kind 'jeong'|'rock' }]
export function findGates(paths, zoneAt) {
  const out = [];
  for (const P of Object.values(paths)) for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], za = zoneAt(a[0], a[1]), zb = zoneAt(b[0], b[1]), ta = tierOf(za), tb = tierOf(zb);
    if (ta === tb || !ta || !tb) continue;
    let lo = 0, hi = 1; for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (tierOf(zoneAt(a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m)) === ta) lo = m; else hi = m; }
    const t = (lo + hi) / 2, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
    const dl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, s = tb > ta ? 1 : -1, fx = (b[0] - a[0]) / dl * s, fz = (b[1] - a[1]) / dl * s;
    if (out.some((g) => Math.hypot(g.x - x, g.z - z) < ZL.merge)) continue;
    const hiZ = tb > ta ? zb : za, loZ = tb > ta ? za : zb;
    out.push({ x, z, fx, fz, ux: -fz, uz: fx, from: loZ, to: hiZ, kind: tierOf(hiZ) >= 3 ? 'rock' : 'jeong' });
  }
  return out;
}

// ---------- 안내판 ----------
function signFace(z) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 352; const x = c.getContext('2d');
  const col = tierColor(z), ek = zoneEnemy(z), Z = ZONES.find((q) => q.id === z);
  x.fillStyle = '#7a5636'; x.fillRect(0, 0, 512, 352); // 테두리 = 나무 색 (기둥·지붕도 이 색을 씀)
  x.fillStyle = '#fbf6e6'; x.fillRect(12, 12, 488, 328);
  x.fillStyle = col; x.fillRect(12, 12, 488, 64);
  x.fillStyle = '#20180c'; x.textBaseline = 'middle'; x.textAlign = 'left';
  x.font = '800 38px "Gothic A1", sans-serif'; x.fillText(`${tierName(z)} 구역`, 34, 46);
  x.textAlign = 'right'; x.font = '800 30px "Gothic A1", sans-serif'; x.fillText(`${z}구역 ▲`, 478, 46);
  x.textAlign = 'left'; x.fillStyle = '#2a2f22'; x.font = '800 62px "Gothic A1", sans-serif'; x.fillText(zoneShort(z), 34, 126);
  x.fillStyle = '#5d6a4f'; x.font = '700 28px "Gothic A1", sans-serif'; x.fillText(`${enemyName(ek)}${josaIGa(enemyName(ek))} 나와요`, 150, 210);
  x.fillStyle = '#9c4a33'; x.font = '800 30px "Gothic A1", sans-serif'; x.fillText(`권장 장비 점수 ${Z?.rec ?? '-'}`, 34, 290);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = TEXCS; tex.anisotropy = 4;
  if (ek && typeof Image !== 'undefined') { const im = new Image(); im.onload = () => { x.fillStyle = '#efe7d0'; x.beginPath(); x.arc(84, 210, 52, 0, 7); x.fill(); x.drawImage(im, 40, 166, 88, 88); tex.needsUpdate = true; }; im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="96" height="96">${ENEMY_ICON[ek]}</svg>`); }
  return tex;
}
function buildSign(z, low) {
  const g = new THREE.Group(), W = 2.4, H = 1.65, Y = 1.75;
  const parts = [new THREE.BoxGeometry(0.14, Y + H / 2 + 0.1, 0.14).translate(-W / 2 + 0.1, (Y + H / 2 + 0.1) / 2, -0.09), new THREE.BoxGeometry(0.14, Y + H / 2 + 0.1, 0.14).translate(W / 2 - 0.1, (Y + H / 2 + 0.1) / 2, -0.09),
    new THREE.BoxGeometry(W + 0.12, H + 0.12, 0.1).translate(0, Y, -0.06), new THREE.BoxGeometry(W + 0.4, 0.09, 0.42).rotateX(0.28).translate(0, Y + H / 2 + 0.16, 0.02)];
  // 나무 부분은 그림의 테두리(나무 색) 한 점을 씀 → 안내판 전체가 한 메시·한 재질 (그리기 1번)
  parts.forEach((p) => { const uv = p.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 4 / 512, 1 - 4 / 352); });
  const tex = signFace(z), face = new THREE.PlaneGeometry(W, H).translate(0, Y, 0.002);
  const m = new THREE.Mesh(mergeGeometries([...parts, face].map((p) => p.toNonIndexed())), new THREE.MeshToonMaterial({ map: tex, gradientMap: gradHard, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.35 }));
  m.receiveShadow = true; void low; g.add(m);
  return g;
}

// ---------- 바위 문 + 방사탑 (한 메시) ----------
function lumpy(geo, rnd, amt) { const p = geo.attributes.position, seen = new Map(); for (let i = 0; i < p.count; i++) { const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`; let d = seen.get(k); if (!d) seen.set(k, d = [(rnd() - 0.5) * amt, (rnd() - 0.5) * amt, (rnd() - 0.5) * amt]); p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]); } geo.computeVertexNormals(); return geo; }
const paint = (geo, hex, rnd, v = 0.12) => { const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i += 3) { const k = 1 - v / 2 + rnd() * v; for (let j = 0; j < 3 && i + j < n; j++) { a[(i + j) * 3] = c.r * k; a[(i + j) * 3 + 1] = c.g * k; a[(i + j) * 3 + 2] = c.b * k; } } geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo; };
// 로컬: x = 길과 직각(u), z = 높은 묶음 쪽(f). 바위 둘은 길 양옆, 방사탑은 +x 바깥
// spot: { L: [왼쪽 바위 x, 오른쪽 바위 x] (빈 곳이면 null), small: [작은 돌 x 둘], tower: [x, z] }
function rockGateGeo(rnd, spot) {
  const out = [];
  spot.L.forEach((bx, i) => { if (bx == null) return; const s = i ? 1 : -1;
    const g = lumpy(new THREE.IcosahedronGeometry(1, 1).toNonIndexed(), rnd, 0.35);
    g.scale(1.25 + rnd() * 0.3, 2.3 + rnd() * 0.5, 1.15 + rnd() * 0.25).rotateZ(-s * 0.12).translate(bx, 1.6, 0);
    out.push(paint(g, '#55565c', rnd)); });
  spot.small.forEach((p) => { const g2 = lumpy(new THREE.IcosahedronGeometry(0.7, 0).toNonIndexed(), rnd, 0.25); g2.translate(p[0], 0.4, p[1]); out.push(paint(g2, '#4a4b50', rnd)); });
  // 방사탑: 돌을 원뿔꼴로 쌓은 탑 + 꼭대기 길쭉한 돌
  const tw = []; const [TX, TZ] = spot.tower;
  for (let r = 0; r < 7; r++) { const y = r * 0.42, R = 1.45 - r * 0.17, n = Math.max(4, Math.round(R * 5));
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + r * 0.5 + rnd() * 0.2, st = lumpy(new THREE.IcosahedronGeometry(0.26 + rnd() * 0.08, 0).toNonIndexed(), rnd, 0.1); st.scale(1.3, 0.85, 1.1).rotateY(-a).translate(TX + Math.cos(a) * R, y + 0.2, TZ + Math.sin(a) * R); tw.push(paint(st, rnd() < 0.5 ? '#4c4d52' : '#5d5e63', rnd)); } }
  const core = lumpy(new THREE.CylinderGeometry(0.4, 1.35, 2.9, 7, 3).toNonIndexed(), rnd, 0.12); core.translate(TX, 1.45, TZ); tw.push(paint(core, '#444549', rnd));
  const top = lumpy(new THREE.BoxGeometry(0.28, 1.0, 0.24, 1, 2, 1).toNonIndexed(), rnd, 0.06); top.rotateZ(0.12).translate(TX, 3.3, TZ); tw.push(paint(top, '#606166', rnd));
  return mergeGeometries([...out, ...tw]);
}

// ---------- 구역 소품 모양 (정점 색, 한 메시에 모아 그림) ----------
// 각 모양: { pos, nor, col, tint(1 이면 그 정점은 소품마다 색), ground(정점마다 땅 높이에 붙임) }
const KEEP = ['position', 'normal', 'color', 'tint'];
function kit(geos, opt = {}) { const g = mergeGeometries(geos.map((q) => { q = q.index ? q.toNonIndexed() : q; for (const k of Object.keys(q.attributes)) if (!KEEP.includes(k)) q.deleteAttribute(k); return q; })); const n = g.attributes.position.count; return { pos: g.attributes.position.array, nor: g.attributes.normal.array, col: g.attributes.color.array, tint: g.attributes.tint ? g.attributes.tint.array : new Float32Array(n), n, ...opt }; }
const tint = (geo, v) => { const n = geo.attributes.position.count; geo.setAttribute('tint', new THREE.BufferAttribute(new Float32Array(n).fill(v), 1)); return geo; };
function shapes() {
  const r = mulberry(1361), K = {};
  // 들꽃 무리: 잎 몇 장 + 꽃송이 5개(색은 소품마다)
  { const gs = []; for (let i = 0; i < 4; i++) { const a = i * 1.6, l = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, Math.cos(a) * 0.32, 0.18, Math.sin(a) * 0.32, Math.cos(a + 0.4) * 0.12, 0.05, Math.sin(a + 0.4) * 0.12], 3)); l.computeVertexNormals(); gs.push(tint(paint(l, '#5f9a45', r), 0)); }
    for (let i = 0; i < 5; i++) { const a = i * 2.4 + r(), d = 0.08 + r() * 0.22, b = new THREE.OctahedronGeometry(0.075, 0).toNonIndexed(); b.scale(1, 0.6, 1).translate(Math.cos(a) * d, 0.2 + r() * 0.14, Math.sin(a) * d); gs.push(tint(paint(b, '#ffffff', r, 0.05), 1)); }
    K.flower = kit(gs); }
  // 억새 포기: 가는 잎 9장 + 금빛 이삭
  { const gs = []; for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28 + r() * 0.5, h = 1.1 + r() * 0.7, lean = 0.25 + r() * 0.35, w = 0.05, tx = Math.cos(a) * lean, tz = Math.sin(a) * lean, px = -Math.sin(a) * w, pz = Math.cos(a) * w;
      const bl = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([px, 0, pz, -px, 0, -pz, tx, h, tz], 3)); bl.computeVertexNormals(); gs.push(tint(paint(bl, '#a8a65a', r, 0.2), 0));
      if (i % 2 === 0) { const pl = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([tx + px * 1.6, h - 0.05, tz + pz * 1.6, tx - px * 1.6, h - 0.05, tz - pz * 1.6, tx * 1.35, h + 0.42, tz * 1.35], 3)); pl.computeVertexNormals(); gs.push(tint(paint(pl, '#efe2b4', r, 0.08), 0)); } }
    K.reed = kit(gs); }
  // 돌무더기
  { const gs = []; const P = [[0, 0.22, 0, 0.42], [0.45, 0.16, 0.2, 0.3], [-0.38, 0.15, 0.25, 0.28], [0.05, 0.5, 0.05, 0.25], [0.1, 0.12, -0.42, 0.26]];
    for (const [x, y, z, s] of P) { const g = lumpy(new THREE.IcosahedronGeometry(s, 0).toNonIndexed(), r, s * 0.4); g.scale(1.2, 0.8, 1).translate(x, y, z); gs.push(tint(paint(g, r() < 0.5 ? '#5b5c61' : '#6e6f73', r), 0)); }
    K.cairn = kit(gs); }
  // 쓰러진 나무: 누운 줄기 + 그루터기 + 마른 가지
  { const gs = [], bark = '#6a5a48';
    const t = lumpy(new THREE.CylinderGeometry(0.22, 0.3, 3.6, 6, 2).toNonIndexed(), r, 0.06); t.rotateZ(Math.PI / 2).rotateY(0.15).translate(0.4, 0.24, 0); gs.push(tint(paint(t, bark, r), 0));
    const st = new THREE.CylinderGeometry(0.26, 0.34, 0.6, 6).toNonIndexed(); st.translate(-1.7, 0.28, -0.4); gs.push(tint(paint(st, '#7a6a55', r), 0));
    for (const [x, a, l] of [[0.9, 0.7, 1.0], [-0.3, -0.9, 0.8], [1.5, 2.3, 0.7]]) { const b = new THREE.CylinderGeometry(0.04, 0.07, l, 4).toNonIndexed(); b.translate(0, l / 2, 0).rotateX(a).translate(x, 0.3, 0); gs.push(tint(paint(b, '#5a4c3e', r), 0)); }
    K.log = kit(gs); }
  // 그을린 자국: 들쭉날쭉한 검은 원판 (정점마다 땅에 붙음), 가운데가 더 검음
  { const pos = [], col = [], n = 14, dark = new THREE.Color('#1d1a18'), mid = new THREE.Color('#3b3128'), edge = new THREE.Color('#5a4733');
    const rad = []; for (let i = 0; i < n; i++) rad.push(0.75 + r() * 0.45);
    for (let i = 0; i < n; i++) { const a0 = i / n * 6.28, a1 = (i + 1) / n * 6.28, r0 = rad[i], r1 = rad[(i + 1) % n];
      const ring = [[0, 0, dark], [Math.cos(a1) * r1 * 0.55, Math.sin(a1) * r1 * 0.55, mid], [Math.cos(a0) * r0 * 0.55, Math.sin(a0) * r0 * 0.55, mid]];
      const out = [[Math.cos(a0) * r0 * 0.55, Math.sin(a0) * r0 * 0.55, mid], [Math.cos(a1) * r1 * 0.55, Math.sin(a1) * r1 * 0.55, mid], [Math.cos(a1) * r1, Math.sin(a1) * r1, edge], [Math.cos(a0) * r0 * 0.55, Math.sin(a0) * r0 * 0.55, mid], [Math.cos(a1) * r1, Math.sin(a1) * r1, edge], [Math.cos(a0) * r0, Math.sin(a0) * r0, edge]];
      for (const [x, z, c] of [...ring, ...out]) { pos.push(x, 0, z); col.push(c.r, c.g, c.b); } }
    const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)).setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    K.scorch = kit([tint(g, 0)], { ground: 0.05 }); }
  // 까마귀: 몸·머리·부리·꼬리
  { const gs = [], blk = '#26262c';
    const body = new THREE.OctahedronGeometry(0.2, 1).toNonIndexed(); body.scale(0.75, 0.7, 1.25).translate(0, 0.28, 0); gs.push(tint(paint(body, blk, r, 0.05), 0));
    const head = new THREE.OctahedronGeometry(0.11, 1).toNonIndexed(); head.translate(0, 0.44, 0.22); gs.push(tint(paint(head, blk, r, 0.05), 0));
    const beak = new THREE.ConeGeometry(0.035, 0.13, 4).toNonIndexed(); beak.rotateX(Math.PI / 2).translate(0, 0.43, 0.36); gs.push(tint(paint(beak, '#3c3a36', r, 0.02), 0));
    const tail = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-0.08, 0.3, -0.18, 0.08, 0.3, -0.18, 0, 0.22, -0.48], 3)); tail.computeVertexNormals(); gs.push(tint(paint(tail, blk, r, 0.02), 0));
    for (const s of [-1, 1]) { const leg = new THREE.CylinderGeometry(0.012, 0.012, 0.14, 3).toNonIndexed(); leg.translate(s * 0.05, 0.07, 0); gs.push(tint(paint(leg, '#3c3a36', r, 0), 0)); }
    K.crow = kit(gs); }
  return K;
}
const FLOWER_C = ['#fff6d8', '#ffe07a', '#c9a8ff', '#ffb8d0', '#ffffff'].map((h) => new THREE.Color(h));

// scene, height, zoneAt, paths (nsPaths), heaps (trash.heaps), col, low, onPath(x,z), isBloomed(구역), ns (buildNamsongi 결과: zoneMood)
export function createZoneLook({ scene, height, zoneAt, paths, heaps = [], col = null, low = false, onPath = () => false, isBloomed = () => false, ns = null, avoid = [] }) { // avoid: 안내판을 가리지 않게 피할 자리 [[x,z],...] (가로등)
  const rnd = mulberry(1360);
  // 땅·풀 색 (namsongi.js 셰이더)
  if (ns?.zoneMood) ZL.mood.forEach((m, z) => ns.zoneMood[z]?.set(m[0], m[1], m[2]));
  const nearHeap = (x, z, pad) => heaps.some((h) => Math.hypot(h.x - x, h.z - z) < h.r + pad);
  const free = (x, z, r) => !onPath(x, z) && !(col && col.blocked(x, z, r)) && !nearHeap(x, z, r + 0.6);

  /* 1) 문턱 */
  const gates = findGates(paths, zoneAt), built = [];
  const GW = WALL.gateW;
  for (const G of gates) {
    const { x, z, fx, fz, ux, uz } = G, objs = [];
    if (G.kind === 'jeong') {
      // 양옆 돌담: 기둥 바깥에서 wallLen 까지, 더미·나무·다른 길에 닿기 전에 멈춤
      const runs = [];
      for (const s of [-1, 1]) { const a = GW + 0.35; let L = 0; while (L < ZL.wallLen) { const d = a + L + 0.5, px = x + ux * s * d, pz = z + uz * s * d; if (nearHeap(px, pz, 1.4) || (col && col.blocked(px, pz, 0.5)) || onPath(px, pz)) break; L += 0.5; }
        if (L >= 1.5) runs.push([[x + ux * s * a, z + uz * s * a], [x + ux * s * (a + L), z + uz * s * (a + L)]]); }
      G.pens = createPens({ scene, height, runs, gates: [{ c: { x, z }, ux, uz, open: true }], low, col, hk: 0.62, hideR: low ? 80 : 110 });
      objs.push(G.pens.gates[0].gate);
    } else {
      // 로컬 x 가 월드 (ux,uz) 방향이 되게: rotation.y = atan2(fx, fz) 이면 로컬 +z → f, 로컬 +x → (fz, -fx) = -u. 그래서 x 를 뒤집어 씀
      const W = (lx, lz) => [x - ux * lx + fx * lz, z - uz * lx + fz * lz];
      const okL = (lx, lz, r) => { const [px, pz] = W(lx, lz); return !(col && col.blocked(px, pz, r)) && !nearHeap(px, pz, r) && !onPath(px, pz); };
      const L = [-1, 1].map((s) => { for (let d = GW + 0.7; d < GW + 3.2; d += 0.25) if (okL(s * d, 0, 1.2)) return s * d; return null; });
      const small = [-1, 1].map((s) => [s * (GW + 1.9), 0.8 * s]).filter(([a, b]) => okL(a, b, 0.6));
      let tower = null; for (const tz of [1.2, 3, -1.5, 5]) { for (const tx of [GW + ZL.towerOff, -(GW + ZL.towerOff), GW + ZL.towerOff + 2]) if (okL(tx, tz, 1.6)) { tower = [tx, tz]; break; } if (tower) break; }
      tower ||= [GW + ZL.towerOff, 1.2];
      const geo = rockGateGeo(mulberry(Math.round(x * 7 + z * 13)), { L, small, tower });
      const m = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradHard, flatShading: true }));
      m.castShadow = !low; m.receiveShadow = true; m.position.set(x, height(x, z) - 0.25, z); m.rotation.y = Math.atan2(fx, fz); scene.add(m); objs.push(m);
      if (col) { L.forEach((bx) => { if (bx == null) return; const [px, pz] = W(bx, 0); col.add(px, pz, 1.3); }); small.forEach(([a, b]) => { const [px, pz] = W(a, b); col.add(px, pz, 0.6); }); const [tx, tz] = W(tower[0], tower[1]); col.add(tx, tz, 1.5); }
      G.tower = W(tower[0], tower[1]);
    }
    // 안내판: 낮은 묶음 쪽 2.6m 앞, 바위 문이면 방사탑 반대편
    // 후보 중 빈 곳, 가로등에서 가장 먼 곳 (가로등이 안내판을 가리지 않게)
    let sp = null, best = -1; for (const back of [2.6, 5, 7.5]) for (const s of G.kind === 'rock' ? [1, -1] : [-1, 1]) { const d = GW + ZL.signOff, px = x + ux * s * d - fx * back, pz = z + uz * s * d - fz * back; if (!free(px, pz, 0.8)) continue;
      const far = Math.min(14, ...avoid.map((a) => Math.hypot(a[0] - px, a[1] - pz))) - back * 0.3; if (far > best) { best = far; sp = [px, pz]; } }
    if (!sp) { const d = GW + ZL.signOff; sp = [x - ux * d - fx * 2.6, z - uz * d - fz * 2.6]; }
    const sign = buildSign(G.to, low); sign.position.set(sp[0], height(sp[0], sp[1]) - 0.05, sp[1]); sign.rotation.y = Math.atan2(-fx, -fz); scene.add(sign); objs.push(sign);
    if (col) { col.add(sp[0] + ux * 1.1, sp[1] + uz * 1.1, 0.25); col.add(sp[0] - ux * 1.1, sp[1] - uz * 1.1, 0.25); }
    G.sign = { x: sp[0], z: sp[1] }; G.objs = objs; built.push(G);
  }

  /* 2) 구역 소품 */
  const D = ZL.decor, K = shapes(), items = []; // { k, x, z, y, rot, s, zone, c }
  const kinds = ['flower', 'reed', 'cairn', 'log', 'scorch', 'crow'];
  const pad = { flower: 0.3, reed: 0.5, cairn: 0.8, log: 2.0, scorch: 1.2, crow: 0.3 };
  const pathPad = { flower: 0, reed: 0.6, cairn: 2.2, log: 3.2, scorch: 1.6, crow: 0.8 };
  const nearPath = (x, z, p) => { if (onPath(x, z)) return true; if (!p) return false; for (let i = 0; i < 4; i++) { const a = i * 1.5708; if (onPath(x + Math.cos(a) * p, z + Math.sin(a) * p)) return true; } return false; };
  const okAt = (k, x, z) => !nearPath(x, z, pathPad[k]) && !(col && col.blocked(x, z, pad[k])) && !nearHeap(x, z, pad[k] + 0.8) && !built.some((G) => Math.hypot(G.x - x, G.z - z) < 12);
  const add = (k, x, z, zone) => items.push({ k, x, z, y: height(x, z) - (k === 'log' ? 0.08 : 0.02), rot: rnd() * 6.283, s: k === 'crow' ? 1.1 + rnd() * 0.3 : k === 'reed' ? 0.9 + rnd() * 0.5 : k === 'flower' ? 1.5 + rnd() * 0.8 : 0.8 + rnd() * 0.5, zone, c: FLOWER_C[Math.floor(rnd() * FLOWER_C.length)] });
  for (const k of kinds) {
    const per = low ? D[k].perLow : D[k].per, st = Math.sqrt(per), { x0, z0, size } = ZONE_BOX;
    for (let zz = z0; zz < z0 + size; zz += st) for (let xx = x0; xx < x0 + size; xx += st) {
      const x = xx + rnd() * st, z = zz + rnd() * st, zone = zoneAt(x, z);
      if (!zone || tierOf(zone) !== D[k].tier || !okAt(k, x, z)) continue;
      add(k, x, z, zone);
    }
    // 쓰레기 더미 둘레 (구역 느낌에 맞게)
    if (D[k].heap) heaps.forEach((h) => { if (tierOf(h.zone) !== D[k].tier) return; for (let i = 0; i < D[k].heap; i++) { for (let t = 0; t < 6; t++) { const a = rnd() * 6.283, d = h.r + (k === 'scorch' ? 1.6 : 0.8) + rnd() * 2.6, x = h.x + Math.cos(a) * d, z = h.z + Math.sin(a) * d; if (onPath(x, z) || (col && col.blocked(x, z, pad[k]))) continue; add(k, x, z, h.zone); break; } } });
  }
  // 칸(32)별 목록
  const CELL = 32, cells = new Map(); items.forEach((it, i) => { const key = Math.floor(it.x / CELL) * 8191 + Math.floor(it.z / CELL); let a = cells.get(key); if (!a) cells.set(key, a = []); a.push(i); });

  // 한 메시: 가까운 소품을 매번 정점 버퍼에 통째로 씀
  const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradHard, side: THREE.DoubleSide });
  const geo = new THREE.BufferGeometry(); let cap = 0;
  const mesh = new THREE.Mesh(geo, mat); mesh.name = 'zone-decor'; mesh.receiveShadow = !low; mesh.frustumCulled = true; scene.add(mesh);
  const ensure = (n) => { if (n <= cap) return; cap = Math.ceil(n * 1.3); for (const [k, sz] of [['position', 3], ['normal', 3], ['color', 3]]) { const a = new THREE.BufferAttribute(new Float32Array(cap * sz), sz); a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, a); } };
  let lastX = 1e9, lastZ = 1e9, dirty = true, drawn = 0, verts = 0, fleeT = 0, fleeKey = '';
  const DR = low ? D.drawRLow : D.drawR;
  const hidden = (it, px, pz) => ((it.k === 'scorch' || it.k === 'crow') && isBloomed(it.zone)) || (it.k === 'crow' && Math.hypot(it.x - px, it.z - pz) < D.crowFlee);
  function rebuild(px, pz) {
    lastX = px; lastZ = pz; dirty = false;
    const cr = Math.ceil(DR / CELL), ci = Math.floor(px / CELL), cj = Math.floor(pz / CELL), list = [];
    let nv = 0;
    for (let i = ci - cr; i <= ci + cr; i++) for (let j = cj - cr; j <= cj + cr; j++) { const a = cells.get(i * 8191 + j); if (!a) continue;
      for (const k of a) { const it = items[k]; if ((it.x - px) ** 2 + (it.z - pz) ** 2 > DR * DR || hidden(it, px, pz)) continue; list.push(it); nv += K[it.k].n; } }
    ensure(Math.max(nv, 3));
    const P = geo.attributes.position.array, N = geo.attributes.normal.array, C = geo.attributes.color.array;
    let o = 0;
    for (const it of list) {
      const S = K[it.k], c = Math.cos(it.rot), s = Math.sin(it.rot), sc = it.s;
      for (let v = 0; v < S.n; v++) {
        const lx = S.pos[v * 3] * sc, ly = S.pos[v * 3 + 1] * sc, lz = S.pos[v * 3 + 2] * sc, wx = it.x + c * lx + s * lz, wz = it.z - s * lx + c * lz;
        P[o] = wx; P[o + 1] = S.ground ? height(wx, wz) + S.ground : it.y + ly; P[o + 2] = wz;
        const nx = S.nor[v * 3], nz = S.nor[v * 3 + 2]; N[o] = c * nx + s * nz; N[o + 1] = S.nor[v * 3 + 1]; N[o + 2] = -s * nx + c * nz;
        if (S.tint[v]) { C[o] = it.c.r; C[o + 1] = it.c.g; C[o + 2] = it.c.b; } else { C[o] = S.col[v * 3]; C[o + 1] = S.col[v * 3 + 1]; C[o + 2] = S.col[v * 3 + 2]; }
        o += 3;
      }
    }
    for (const k of ['position', 'normal', 'color']) { const a = geo.attributes[k]; a.needsUpdate = true; a.clearUpdateRanges?.(); }
    geo.setDrawRange(0, nv); drawn = list.length; verts = nv;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(px, height(px, pz), pz), DR + 4);
  }

  // 문턱 감추기 (멀면 안 그림). 정낭 돌담은 createPens 가 거리로
  const SHOW_R = low ? 80 : 110; // 이보다 멀면 문턱(정낭·바위 문·안내판)을 안 그림
  function update(dt, pos) {
    if (dirty || (pos.x - lastX) ** 2 + (pos.z - lastZ) ** 2 > D.moveStep * D.moveStep) rebuild(pos.x, pos.z);
    else if ((fleeT -= dt) <= 0) { fleeT = 0.3; let key = ''; for (const it of items) if (it.k === 'crow' && Math.abs(it.x - pos.x) < D.crowFlee && Math.abs(it.z - pos.z) < D.crowFlee && Math.hypot(it.x - pos.x, it.z - pos.z) < D.crowFlee) key += it.x.toFixed(0); if (key !== fleeKey) { fleeKey = key; rebuild(pos.x, pos.z); } }
    for (const G of built) { const on = Math.hypot(G.x - pos.x, G.z - pos.z) < SHOW_R; if (G.on !== on) { G.on = on; G.objs.forEach((o) => { o.visible = on; }); } if (G.pens) G.pens.lod(pos); }
  }
  const counts = () => Object.fromEntries(kinds.map((k) => [k, items.filter((it) => it.k === k).length]));
  return { gates: built, update, dirty: () => { dirty = true; }, items, counts, stats: () => ({ drawn, verts, tris: verts / 3 }) };
}
