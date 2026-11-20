// 맵 전체 쓰기 (#138): 적 소굴·숨은 보물·볼거리·우두머리 빈터 자리와 모양, 들판 더미 위 까마귀·연기
// 자리는 src/fieldplan.js (8자 고리: 소굴 = 왼쪽 들판, 보물·볼거리 = 오른쪽 들판, 빈터 = 가장 높은 길 둘레). 같은 seed 면 늘 같은 자리
// 모양은 지금 그림체(toon 재질, 정점 색) 로우폴리 임시. 종류마다 InstancedMesh 하나, drawR 밖·없는 것은 안 그림
// 게임 연결(소굴 적 부르기·보물 열기·볼거리 찾기·지도)은 src/game/field.js
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gradHard } from './toon.js';
import { FIELD, ENEMY_SPAWN, CLEANHOUSE } from './balance.js';
import { mulberry } from './trash.js';
import { placeSide } from './fieldplan.js';

/* ---------- 모양 ---------- */
function piece(g, color, rnd = null, v = 0) {
  g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k); g.computeVertexNormals();
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 3) { const k = rnd ? 1 - v / 2 + rnd() * v : 1; for (let j = 0; j < 3 && i + j < n; j++) { a[(i + j) * 3] = c.r * k; a[(i + j) * 3 + 1] = c.g * k; a[(i + j) * 3 + 2] = c.b * k; } }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
function lumpy(g, rnd, amt) { g = g.index ? g.toNonIndexed() : g; const p = g.attributes.position, seen = new Map(); for (let i = 0; i < p.count; i++) { const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`; let d = seen.get(k); if (!d) seen.set(k, d = [(rnd() - 0.5) * amt, (rnd() - 0.5) * amt, (rnd() - 0.5) * amt]); p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]); } return g; }
const rock = (r, R, sx, sy, sz, hex, x = 0, y = 0, z = 0, ry = 0) => piece(lumpy(new THREE.IcosahedronGeometry(R, 0), r, R * 0.3).scale(sx, sy, sz).rotateY(ry).translate(x, y, z), hex, r, 0.14);

// 소굴: 멧돼지 굴(흙 둔덕 + 검은 굴 입구) · 들개 터(눌린 풀 + 뼈) · 외계인 착륙 자국(그을린 고리 + 반쯤 박힌 원반)
function denGeo(kind) {
  const r = mulberry(7001 + kind.length * 13), out = [];
  if (kind === 'piglet' || kind === 'boar') {
    out.push(piece(lumpy(new THREE.IcosahedronGeometry(1, 1), r, 0.3).scale(3.2, 1.4, 2.6).translate(0, 0.1, 0), '#6b4f35', r, 0.16));
    out.push(piece(new THREE.CircleGeometry(0.95, 9).scale(1.2, 1, 1).rotateX(0).translate(0, 0.62, 2.1), '#1a1410'));
    out.push(piece(new THREE.SphereGeometry(0.9, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.15, 0.8, 0.9).rotateX(Math.PI / 2).translate(0, 0.62, 2.05), '#120d0a'));
    for (let i = 0; i < 7; i++) { const a = -0.9 + i * 0.3 + r() * 0.2, d = 3.2 + r() * 0.9; out.push(rock(r, 0.32 + r() * 0.2, 1.2, 0.5, 1, '#7a5a3c', Math.sin(a) * d, 0.08, Math.cos(a) * d, r() * 6)); }
    for (let i = 0; i < 3; i++) { const a = r() * 6.28; out.push(piece(new THREE.CylinderGeometry(0.06, 0.08, 2.2 + r(), 4).rotateZ(Math.PI / 2 - 0.15).rotateY(a).translate(Math.cos(a) * 2.2, 0.9 + r() * 0.3, Math.sin(a) * 1.6), '#5a4126')); }
    if (kind === 'boar') out.push(piece(lumpy(new THREE.IcosahedronGeometry(1, 1), r, 0.3).scale(1.6, 0.9, 1.4).translate(-2.4, 0.2, -1.4), '#5d4430', r, 0.16));
  } else if (kind === 'dog' || kind === 'rabid') {
    out.push(piece(new THREE.CircleGeometry(3.4, 11).rotateX(-Math.PI / 2).translate(0, 0.03, 0), kind === 'rabid' ? '#5a4a3a' : '#7d7a4a'));
    for (let i = 0; i < 9; i++) { const a = r() * 6.28, d = 0.6 + r() * 2.4, rot = r() * 6.28;
      out.push(piece(new THREE.CylinderGeometry(0.05, 0.05, 0.62, 4).rotateZ(Math.PI / 2).rotateY(rot).translate(Math.cos(a) * d, 0.08, Math.sin(a) * d), '#ece6d6'));
      for (const e of [-1, 1]) out.push(piece(new THREE.IcosahedronGeometry(0.08, 0).translate(Math.cos(a) * d + Math.cos(-rot) * 0.31 * e, 0.09, Math.sin(a) * d + Math.sin(-rot) * 0.31 * e), '#f2ecdc')); }
    for (let i = 0; i < 4; i++) { const a = i * 1.6 + r(); out.push(rock(r, 0.5 + r() * 0.3, 1.2, 0.7, 1, '#4c4d52', Math.cos(a) * 3.6, 0.2, Math.sin(a) * 3.6, r() * 6)); }
    out.push(piece(lumpy(new THREE.BoxGeometry(1.5, 0.12, 1.1, 2, 1, 2), r, 0.1).rotateY(0.4).translate(0.6, 0.08, -0.4), kind === 'rabid' ? '#7a2c24' : '#8a6e4a', r, 0.1)); // 낡은 담요
    if (kind === 'rabid') for (let i = 0; i < 4; i++) { const a = r() * 6.28, d = r() * 2.6; out.push(piece(new THREE.CircleGeometry(0.3 + r() * 0.25, 6).rotateX(-Math.PI / 2).translate(Math.cos(a) * d, 0.05, Math.sin(a) * d), '#6e1a16')); }
  } else { // alien
    out.push(piece(new THREE.RingGeometry(2.4, 4.0, 14).rotateX(-Math.PI / 2).translate(0, 0.04, 0), '#2a2622'));
    out.push(piece(new THREE.CircleGeometry(2.4, 14).rotateX(-Math.PI / 2).translate(0, 0.03, 0), '#4a4038'));
    out.push(piece(new THREE.CylinderGeometry(1.7, 2.1, 0.45, 12).rotateZ(0.42).translate(0.3, 0.55, 0), '#9aa3ad'));
    out.push(piece(new THREE.SphereGeometry(0.9, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(0.42).translate(-0.05, 0.95, 0), '#7fe0c8'));
    for (let i = 0; i < 6; i++) { const a = i * 1.05 + r() * 0.3; out.push(piece(new THREE.OctahedronGeometry(0.14, 0).translate(Math.cos(a) * 3.1, 0.18, Math.sin(a) * 3.1), '#8dffb0')); }
  }
  return mergeGeometries(out);
}
// 닫힌 소굴: 입구를 막은 돌 무더기 (소굴 위에 겹쳐 그림)
function plugGeo() { const r = mulberry(7301), out = []; for (let i = 0; i < 6; i++) { const a = r() * 6.28, d = r() * 0.9; out.push(rock(r, 0.42 + r() * 0.2, 1.1, 0.8, 1, '#56575c', Math.cos(a) * d, 0.55 + r() * 0.5, 2.0 + Math.sin(a) * d * 0.5, r() * 6)); } return mergeGeometries(out); }
// 숨은 보물: 바위 뒤 귤 상자(뚜껑 귤색). 바위는 늘, 상자는 오늘 안 열었을 때만
function stoneGeo() { const r = mulberry(7401); return mergeGeometries([rock(r, 1, 1.5, 1.1, 1.2, '#4f5056', 0, 0.6, 0), rock(r, 0.6, 1.2, 0.8, 1, '#5a5b60', 1.1, 0.25, 0.7, 1)]); }
function chestGeo() {
  const r = mulberry(7501), out = [piece(new THREE.BoxGeometry(0.9, 0.5, 0.6), '#a8773e').translate(0, 0.25, 0), piece(new THREE.BoxGeometry(0.96, 0.14, 0.66).translate(0, 0.56, 0), '#f08a24')];
  for (const x of [-0.3, 0, 0.3]) out.push(piece(new THREE.IcosahedronGeometry(0.15, 0).translate(x, 0.66, (r() - 0.5) * 0.2), '#ff9d2e'));
  out.push(piece(new THREE.BoxGeometry(0.1, 0.18, 0.04).translate(0, 0.42, 0.31), '#ffd75a'));
  return mergeGeometries(out).translate(0, 0, -1.25);
}
// 볼거리: 전망 바위 · 샘 · 산담(무덤을 두른 네모 돌담) · 방사탑
function sightGeo(kind) {
  const r = mulberry(7601 + kind.length * 17), out = [];
  if (kind === 'view') {
    out.push(rock(r, 1, 3.0, 1.3, 2.4, '#4a4b51', 0, 0.9, 0)); out.push(piece(new THREE.CylinderGeometry(2.2, 2.6, 0.5, 8).translate(0.2, 2.15, 0.1), '#56575d', r, 0.1));
    out.push(rock(r, 0.7, 1.4, 0.9, 1.2, '#55565b', 2.4, 0.4, 1.6)); out.push(rock(r, 0.5, 1.2, 0.8, 1, '#5d5e63', 1.6, 0.25, 2.5));
  } else if (kind === 'spring') {
    out.push(piece(new THREE.CircleGeometry(1.7, 12).rotateX(-Math.PI / 2).translate(0, 0.06, 0), '#3f8fb8'));
    out.push(piece(new THREE.CircleGeometry(1.0, 10).rotateX(-Math.PI / 2).translate(0.2, 0.07, -0.2), '#6fc0e0'));
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28 + r() * 0.2; out.push(rock(r, 0.34 + r() * 0.12, 1.2, 0.7, 1, '#46474c', Math.cos(a) * 2.0, 0.15, Math.sin(a) * 2.0, -a)); }
    for (let i = 0; i < 5; i++) { const a = r() * 6.28; out.push(piece(new THREE.ConeGeometry(0.08, 0.9, 4).translate(Math.cos(a) * 2.5, 0.45, Math.sin(a) * 2.5), '#4c8a3a')); }
  } else if (kind === 'sandam') {
    const W = 3.2, D = 4.2;
    for (const [ax, az, L, rot] of [[0, -D, W, 0], [0, D, W, 0], [-W, 0, D, 1], [W, 0, D, 1]]) { const n = Math.round(L * 2 / 0.62);
      for (let i = 0; i < n; i++) { const u = -L + (i + 0.5) * (2 * L / n); for (let y = 0; y < 2; y++) out.push(rock(r, 0.32, 1.1, 0.75, 0.9, y ? '#3f4045' : '#4a4b50', rot ? ax : u, 0.22 + y * 0.42, rot ? u : az, r() * 6)); } }
    out.push(piece(lumpy(new THREE.SphereGeometry(1.8, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), r, 0.12).scale(1, 0.55, 1.3), '#6f9a4a', r, 0.1));
  } else { // tower 방사탑
    for (let k = 0; k < 7; k++) { const y = k * 0.42, R = 1.45 - k * 0.17, n = Math.max(4, Math.round(R * 5));
      for (let i = 0; i < n; i++) { const a = i / n * 6.28 + k * 0.5 + r() * 0.2; out.push(piece(lumpy(new THREE.IcosahedronGeometry(0.26 + r() * 0.08, 0), r, 0.1).scale(1.3, 0.85, 1.1).rotateY(-a).translate(Math.cos(a) * R, y + 0.2, Math.sin(a) * R), k % 2 ? '#3d3e43' : '#4a4b50', r, 0.12)); } }
    out.push(piece(lumpy(new THREE.CylinderGeometry(0.4, 1.35, 2.9, 7, 3), r, 0.12).translate(0, 1.45, 0), '#444549', r, 0.12));
    out.push(piece(new THREE.BoxGeometry(0.28, 1.0, 0.24).rotateZ(0.12).translate(0, 3.3, 0), '#606166'));
  }
  return mergeGeometries(out);
}
const SIGHT_R = { view: 3.0, spring: 2.2, sandam: 4.6, tower: 1.6 }; // 놓을 자리 반경
const SIGHT_COL = { view: [[0, 0, 2.6], [2.4, 1.6, 1.1]], spring: [], sandam: [[0, 0, 2.2]], tower: [[0, 0, 1.45]] }; // 부딪힘 원 [x, z, r] (산담 안 봉분만, 담은 넘어 들어갈 수 있게 낮음)

/* ---------- 자리 정하기 ---------- */
// trash: createTrash 결과(loops·trail·ok·heaps), col: 부딪힘(놓은 뒤 등록)
// chs: 클린하우스 앞 [{x, z}…] (둘레 CLEANHOUSE.keep 엔 몹이 안 나오므로 소굴 등은 그 밖에)
export function createField({ scene, height, trash, low = false, col = null, chs = [] }) {
  const loops = trash.loops || {}, rnd = mulberry(FIELD.seed + 1);
  const taken = [...trash.heaps.map((h) => ({ x: h.x, z: h.z, r: h.r })), ...chs.map((c) => ({ x: c.x, z: c.z, r: CLEANHOUSE.keep + 2 }))];
  const put = (pool, side, d, R, zone, flat = 0.45) => {
    const q = placeSide({ pool, side, d, R, rnd, zone, zoneAt: trash.zoneAt, ok: trash.ok, height, trailDist: trash.trail.dist, taken, gap: FIELD.gap, flat })
      || placeSide({ pool: loops[zone].all, side: 0, d, R, rnd, zone, zoneAt: trash.zoneAt, ok: trash.ok, height, trailDist: trash.trail.dist, taken, gap: FIELD.gap * 0.4, flat: flat * 1.8 });
    if (q) taken.push({ x: q.x, z: q.z, r: R });
    return q;
  };
  const dens = [], treasures = [], sights = [], bosses = [];
  for (const k of Object.keys(loops).map(Number).sort((a, b) => a - b)) {
    const L = loops[k];
    // 우두머리 빈터 먼저 (넓은 곳을 차지): 가장 높은 길 둘레
    { const q = put(L.top, 0, FIELD.boss.d, FIELD.boss.r, k, 0.35); if (q) bosses.push({ zone: k, x: q.x, z: q.z, y: q.y, r: FIELD.boss.r }); }
    for (let i = 0; i < (FIELD.den.n[k] || 0); i++) { const q = put(L.lower, L.edge ? 0 : -1, FIELD.spotD, FIELD.den.r, k); if (q) dens.push({ id: `d${k}-${i}`, zone: k, kind: ENEMY_SPAWN.byZone[k], x: q.x, z: q.z, y: q.y, rot: Math.atan2(q.fromX - q.x, q.fromZ - q.z) }); }
    FIELD.sight.list.forEach((s, i) => { if (s[0] !== k) return; const q = put(L.upper, L.edge ? 0 : 1, FIELD.spotD, SIGHT_R[s[1]], k, 0.5); if (q) sights.push({ id: `sight:${i}`, i, zone: k, kind: s[1], name: s[2], x: q.x, z: q.z, y: q.y, rot: rnd() * 6.28 }); });
    for (let i = 0; i < (FIELD.treasure.n[k] || 0); i++) { const q = put(L.upper, L.edge ? 0 : 1, FIELD.spotD, 1.8, k, 0.7); if (q) treasures.push({ id: `t${k}-${i}`, zone: k, x: q.x, z: q.z, y: q.y, rot: rnd() * 6.28 }); }
  }
  if (col) {
    dens.forEach((d) => { if (d.kind === 'piglet' || d.kind === 'boar') col.add(d.x, d.z, 2.4); });
    treasures.forEach((t) => col.add(t.x, t.z, 1.25));
    sights.forEach((s) => SIGHT_COL[s.kind].forEach(([ox, oz, r]) => { const c = Math.cos(s.rot), sn = Math.sin(s.rot); col.add(s.x + ox * c + oz * sn, s.z - ox * sn + oz * c, r); }));
  }

  /* ---------- 그리기 ---------- */
  const mat = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradHard });
  const mk = (geo, cap) => { const im = new THREE.InstancedMesh(geo, mat, Math.max(1, cap)); im.count = 0; im.visible = false; im.frustumCulled = false; im.castShadow = !low; im.receiveShadow = !low; scene.add(im); return im; };
  const denKinds = [...new Set(dens.map((d) => d.kind))], DM = Object.fromEntries(denKinds.map((k) => [k, mk(denGeo(k), dens.filter((d) => d.kind === k).length)]));
  const plugM = mk(plugGeo(), dens.length), stoneM = mk(stoneGeo(), treasures.length), chestM = mk(chestGeo(), treasures.length);
  const SK = ['view', 'spring', 'sandam', 'tower'], SM = Object.fromEntries(SK.map((k) => [k, mk(sightGeo(k), sights.filter((s) => s.kind === k).length)]));
  // 들판 더미 표시: 까마귀(머리 위를 돎)·연기(위로 오르며 커짐). 남은 쓰레기가 있는 들판 더미만
  const fieldHeaps = trash.heaps.map((h, i) => ({ h, i })).filter((o) => o.h.field);
  const crowGeo = mergeGeometries([piece(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.35, -0.9, 0.12, -0.1, 0, 0, -0.25, 0, 0, 0.35, 0, 0, -0.25, 0.9, 0.12, -0.1], 3)), '#1d1c22'), piece(new THREE.IcosahedronGeometry(0.16, 0).scale(1, 0.8, 1.8), '#25242a')]);
  const crowM = new THREE.InstancedMesh(crowGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), Math.max(1, fieldHeaps.length * FIELD.mark.crows)); crowM.count = 0; crowM.frustumCulled = false; scene.add(crowM);
  const PUFF = low ? 3 : 5, smokeM = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0x8c8780, transparent: true, opacity: 0.55, depthWrite: false, flatShading: true }), Math.max(1, fieldHeaps.length * PUFF)); smokeM.count = 0; smokeM.frustumCulled = false; scene.add(smokeM);

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), sc = new THREE.Vector3();
  const DR = low ? 150 : 220, MR = low ? FIELD.mark.drawRLow : FIELD.mark.drawR;
  let lastX = 1e9, lastZ = 1e9, dirty = true;
  const state = { denClosed: () => false, chestOpen: () => false };
  const setAt = (im, n, x, y, z, rot) => { e.set(0, rot, 0); q.setFromEuler(e); v.set(x, y, z); m4.compose(v, q, one); im.setMatrixAt(n, m4); };
  const near = (o, px, pz, R) => (o.x - px) ** 2 + (o.z - pz) ** 2 < R * R;
  function rebuild(px, pz) {
    lastX = px; lastZ = pz; dirty = false;
    const cnt = new Map(); const add = (im, o, y = o.y) => { const n = cnt.get(im) || 0; setAt(im, n, o.x, y, o.z, o.rot || 0); cnt.set(im, n + 1); };
    for (const d of dens) if (near(d, px, pz, DR)) { add(DM[d.kind], d); if (state.denClosed(d)) add(plugM, d); }
    for (const t of treasures) if (near(t, px, pz, DR)) { add(stoneM, t); if (!state.chestOpen(t)) add(chestM, t); }
    for (const s of sights) if (near(s, px, pz, DR * 1.3)) add(SM[s.kind], s);
    for (const im of [...Object.values(DM), plugM, stoneM, chestM, ...Object.values(SM)]) { im.count = cnt.get(im) || 0; im.visible = im.count > 0; im.instanceMatrix.needsUpdate = true; }
  }
  function update(dt, pos, time) {
    if (dirty || Math.abs(pos.x - lastX) > 8 || Math.abs(pos.z - lastZ) > 8) rebuild(pos.x, pos.z);
    // 까마귀·연기 (매 프레임, 적은 수)
    let nc = 0, ns = 0;
    for (const { h, i } of fieldHeaps) {
      if (!(trash.store.left(i) > 0) || !near(h, pos.x, pos.z, MR)) continue;
      const top = h.y + (h.k === 'mt' ? 6.5 : h.k === 'xl' ? 4.5 : 2.6);
      for (let c = 0; c < FIELD.mark.crows; c++) { const a = time * (0.55 + c * 0.13) + c * 2.1 + i, R = 4 + c * 1.6 + h.r, y = top + 6 + c * 1.4 + Math.sin(time * 1.3 + c) * 0.6;
        e.set(Math.sin(time * 9 + c) * 0.3, -a, -0.35); q.setFromEuler(e); v.set(h.x + Math.cos(a) * R, y, h.z + Math.sin(a) * R); sc.set(1.1, 1 + Math.sin(time * 14 + c * 3) * 0.6, 1.1); m4.compose(v, q, sc); crowM.setMatrixAt(nc++, m4); }
      for (let p = 0; p < PUFF; p++) { const f = (time * 0.12 + p / PUFF + i * 0.37) % 1, s = 0.6 + f * 2.4;
        v.set(h.x + Math.sin(f * 5 + i) * (0.6 + f * 2), top + f * 14, h.z + Math.cos(f * 4 + i) * (0.6 + f * 1.5)); q.identity(); sc.set(s, s * 0.8, s); m4.compose(v, q, sc); smokeM.setMatrixAt(ns++, m4); }
    }
    crowM.count = nc; smokeM.count = ns; crowM.visible = nc > 0; smokeM.visible = ns > 0; crowM.instanceMatrix.needsUpdate = smokeM.instanceMatrix.needsUpdate = true;
  }
  return { dens, treasures, sights, bosses, loops, update, state, dirty: () => { dirty = true; }, meshes: () => ({ dens: Object.values(DM), plugM, stoneM, chestM, sights: Object.values(SM), crowM, smokeM }) };
}
