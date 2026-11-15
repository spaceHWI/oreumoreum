// 쓰레기: 날짜로 정해지는 배치 · 칸 단위로 가까운 것만 그리기 · 줍기 찾기 · 더미
// 쓰레기 상태(오늘 날짜, 주운 비트셋, 배낭, 오늘·누적 수)를 읽고 쓰는 곳은 createLocalTrashStore 하나뿐.
// 멀티가 붙으면 같은 모양(date/reset/isPicked/markPicked/pickedCount/bag/commit)의 서버 저장소로 바꿔 끼운다
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gradHard } from './toon.js';
import { TRASH_TYPES, TRASH } from './balance.js';
import { kstDate } from './achievements.js';

const N = TRASH.total, NH = TRASH.heaps * TRASH.heapN, NS = N - NH; // 0..NS-1 흩어진 것, NS.. 더미 칸(더미 h 의 s번째 = NS + h*heapN + s)
export const TRASH_N = N;

/* ---------- 저장소 (기기 저장) ---------- */
const enc = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 4096) s += String.fromCharCode.apply(null, u8.subarray(i, i + 4096)); return btoa(s); };
const dec = (s, n) => { const u = new Uint8Array(n); try { const b = atob(s || ''); for (let i = 0; i < Math.min(n, b.length); i++) u[i] = b.charCodeAt(i); } catch (e) { /* 깨진 값은 비움 */ } return u; };
const popc = (u8) => { let c = 0; for (let i = 0; i < u8.length; i++) { let v = u8[i]; while (v) { v &= v - 1; c++; } } return c; };
export function createLocalTrashStore({ save, persist }) {
  const T = save.trash = (save.trash && typeof save.trash === 'object') ? save.trash : {};
  if (typeof T.date !== 'string') T.date = '';
  if (!T.bag || typeof T.bag !== 'object') T.bag = {};
  TRASH_TYPES.forEach((t) => { T.bag[t.id] = Math.max(0, Math.floor(Number(T.bag[t.id]) || 0)); });
  T.total = Math.max(0, Math.floor(Number(T.total) || 0));
  const bits = dec(T.picked, Math.ceil(N / 8));
  T.today = popc(bits);
  let dirty = false;
  return {
    date: () => T.date,
    reset(date) { T.date = date; bits.fill(0); T.today = 0; dirty = true; this.commit(); },
    isPicked: (i) => (bits[i >> 3] >> (i & 7)) & 1,
    markPicked(i) { if ((bits[i >> 3] >> (i & 7)) & 1) return false; bits[i >> 3] |= 1 << (i & 7); T.today++; T.total++; dirty = true; return true; },
    pickedCount: () => T.today,
    totalCount: () => T.total,
    bag: T.bag,
    commit() { if (dirty) { T.picked = enc(bits); dirty = false; } persist(); },
  };
}

/* ---------- 배치 ---------- */
function mulberry(seed) { let s = seed >>> 0; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const strSeed = (str) => { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

function makeTrail(paths) {
  const segs = []; let L = 0;
  for (const pts of paths) for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 1e-3) continue; segs.push({ ax: a[0], az: a[1], bx: b[0], bz: b[1], l, c0: L }); L += l; }
  const TC = 25, grid = new Map();
  segs.forEach((s, k) => { const n = Math.ceil(s.l / 8); for (let j = 0; j <= n; j++) { const x = s.ax + (s.bx - s.ax) * j / n, z = s.az + (s.bz - s.az) * j / n, key = Math.floor(x / TC) * 8191 + Math.floor(z / TC); let a = grid.get(key); if (!a) grid.set(key, a = []); if (a[a.length - 1] !== k) a.push(k); } });
  // 길까지 거리 (lim 보다 멀면 lim)
  const dist = (x, z, lim) => { let b = lim; const r = Math.ceil(lim / TC), ci = Math.floor(x / TC), cj = Math.floor(z / TC), seen = new Set();
    for (let i = ci - r; i <= ci + r; i++) for (let j = cj - r; j <= cj + r; j++) { const a = grid.get(i * 8191 + j); if (!a) continue; for (const k of a) { if (seen.has(k)) continue; seen.add(k); const s = segs[k]; const dx = s.bx - s.ax, dz = s.bz - s.az; let t = ((x - s.ax) * dx + (z - s.az) * dz) / (s.l * s.l); t = t < 0 ? 0 : t > 1 ? 1 : t; const d = Math.hypot(x - s.ax - dx * t, z - s.az - dz * t); if (d < b) b = d; } }
    return b; };
  // 길 위 한 점 (길이 비례로 고름): [x, z, 길 방향 x, 길 방향 z]
  const at = (u) => { let lo = 0, hi = segs.length - 1; const c = u * L; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (segs[m].c0 <= c) lo = m; else hi = m - 1; } const s = segs[lo], t = Math.min(1, (c - s.c0) / s.l); return [s.ax + (s.bx - s.ax) * t, s.az + (s.bz - s.az) * t, (s.bx - s.ax) / s.l, (s.bz - s.az) / s.l]; };
  return { dist, at, L };
}

function genLayout(date, trail, ok) {
  const rnd = mulberry(strSeed('trash-' + date));
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const X = new Float32Array(N), Z = new Float32Array(N), R = new Float32Array(N), TY = new Uint8Array(N);
  // 종류: 비율대로 정확히 나눠 섞음
  let o = 0; TRASH_TYPES.forEach((t, k) => { const n = k === TRASH_TYPES.length - 1 ? N - o : Math.round(N * t.ratio); TY.fill(k, o, o + n); o += n; });
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)), t = TY[i]; TY[i] = TY[j]; TY[j] = t; }
  const D = TRASH.trailD;
  const nearPt = () => { const [x, z, dx, dz] = trail.at(rnd()); const side = (rnd() * 2 - 1) * D * 0.96, along = (rnd() - 0.5) * 6; return [x - dz * side + dx * along, z + dx * side + dz * along]; };
  const farPt = () => { const [x, z] = trail.at(rnd()); const a = rnd() * Math.PI * 2, r = D + 2 + (TRASH.offMax - D) * Math.pow(rnd(), 1.4); return [x + Math.cos(a) * r, z + Math.sin(a) * r]; };
  const okNear = (x, z) => ok(x, z) && trail.dist(x, z, D + 1) <= D;
  const okFar = (x, z) => ok(x, z) && trail.dist(x, z, D + 3) > D + 2;
  const pickPt = (gen, test) => { for (let k = 0; k < 30; k++) { const p = gen(); if (test(p[0], p[1])) return p; } return gen(); };
  // 뭉치는 자리
  const cN = [], cF = []; for (let k = 0; k < 700; k++) cN.push(pickPt(nearPt, okNear)); for (let k = 0; k < 320; k++) cF.push(pickPt(farPt, okFar));
  // 더미 60곳: 40곳은 길 옆, 20곳은 숲·들판. 서로 40 이상 떨어지게
  const heaps = [];
  for (let h = 0; h < TRASH.heaps; h++) {
    const near = h < 40; let best = null;
    for (let k = 0; k < 40 && !best; k++) {
      const p = near ? (() => { const [x, z, dx, dz] = trail.at(rnd()); const side = (rnd() < 0.5 ? -1 : 1) * (6 + rnd() * 12); return [x - dz * side, z + dx * side]; })() : farPt();
      if (!(near ? okNear : okFar)(p[0], p[1])) continue;
      if (heaps.some((q) => Math.hypot(q.x - p[0], q.z - p[1]) < 40)) continue;
      best = p;
    }
    best ||= pickPt(nearPt, okNear);
    heaps.push({ x: best[0], z: best[1], near, rot: rnd() * 6.28 });
  }
  const nearHeapItems = 40 * TRASH.heapN, nNear = Math.round(N * TRASH.nearTrail) - nearHeapItems; // 흩어진 것 중 길 옆
  for (let i = 0; i < NS; i++) {
    const near = i < nNear, cs = near ? cN : cF, test = near ? okNear : okFar, gen = near ? nearPt : farPt;
    let p = null;
    if (rnd() < (near ? 0.55 : 0.65)) { const c = cs[Math.floor(rnd() * cs.length)], sg = near ? 3.5 : 6; for (let k = 0; k < 4 && !p; k++) { const x = c[0] + gauss() * sg, z = c[1] + gauss() * sg; if (test(x, z)) p = [x, z]; } }
    p ||= pickPt(gen, test);
    X[i] = p[0]; Z[i] = p[1]; R[i] = rnd() * Math.PI * 2;
  }
  for (let h = 0; h < heaps.length; h++) for (let s = 0; s < TRASH.heapN; s++) { const i = NS + h * TRASH.heapN + s; X[i] = heaps[h].x; Z[i] = heaps[h].z; R[i] = 0; }
  return { X, Z, R, TY, heaps };
}

/* ---------- 모양 (로우폴리 임시) ---------- */
function piece(g, color) { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); g.computeVertexNormals(); const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
function jitter(g, amt, seed) { const r = mulberry(seed), p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + (r() - 0.5) * amt, p.getY(i) + (r() - 0.5) * amt, p.getZ(i) + (r() - 0.5) * amt); return g; }
function makeGeos() {
  const can = mergeGeometries([piece(new THREE.CylinderGeometry(0.12, 0.12, 0.34, 7), '#ffffff'), piece(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 7).translate(0, 0.18, 0), '#d0d3d8')]).rotateZ(Math.PI / 2).translate(0, 0.11, 0);
  const pet = mergeGeometries([piece(new THREE.CylinderGeometry(0.14, 0.14, 0.42, 7), '#ffffff'), piece(new THREE.CylinderGeometry(0.06, 0.135, 0.14, 7).translate(0, 0.28, 0), '#ffffff'), piece(new THREE.CylinderGeometry(0.065, 0.065, 0.06, 6).translate(0, 0.38, 0), '#3a7fd0')]).rotateZ(Math.PI / 2).translate(0, 0.13, 0);
  const vinyl = piece(jitter(new THREE.IcosahedronGeometry(0.3, 0), 0.14, 3).scale(1.3, 0.45, 1).translate(0, 0.09, 0), '#ffffff');
  const foam = piece(jitter(new THREE.BoxGeometry(0.62, 0.28, 0.44, 2, 1, 2), 0.07, 5).translate(0, 0.14, 0), '#ffffff');
  const gear = mergeGeometries([piece(new THREE.TorusGeometry(0.42, 0.11, 4, 9).rotateX(Math.PI / 2).translate(0, 0.1, 0), '#ffffff'), piece(jitter(new THREE.IcosahedronGeometry(0.36, 0), 0.12, 9).scale(1.2, 0.4, 1).translate(0.55, 0.08, 0.2), '#7f9a86')]);
  return [can, pet, vinyl, foam, gear];
}
const PAL = [
  ['#d8423a', '#c9ccd2', '#3c8f5a', '#e0b23a', '#2f62b8'], // 캔
  ['#d9eef5', '#e9f5e3', '#f4f4f4', '#bfe0ec'], // 페트병
  ['#f4f4f0', '#2e2e34', '#4f86c6', '#e9e2c9', '#c94f4f'], // 비닐
  ['#f7f7f2', '#ecebe4', '#f2efe2'], // 스티로폼
  ['#e2683a', '#3e7fc4', '#e8d24a', '#3f9a5a'], // 폐어구
];
function makeHeapGeo() {
  const parts = [piece(jitter(new THREE.IcosahedronGeometry(1.3, 0), 0.35, 11).scale(1, 0.5, 1).translate(0, 0.35, 0), '#56606a')];
  const r = mulberry(77), cols = ['#f4f4f0', '#d8423a', '#4f86c6', '#e2683a', '#f7f7f2', '#2e2e34', '#c9ccd2'];
  for (let k = 0; k < 14; k++) { const a = r() * 6.28, d = r() * 1.0, y = 0.45 + (1 - d) * 0.35; const g = k % 3 === 0 ? new THREE.BoxGeometry(0.5, 0.26, 0.36) : k % 3 === 1 ? new THREE.CylinderGeometry(0.13, 0.13, 0.36, 6).rotateZ(1.57) : jitter(new THREE.IcosahedronGeometry(0.28, 0), 0.12, k);
    g.rotateY(r() * 6.28).translate(Math.cos(a) * d, y, Math.sin(a) * d); parts.push(piece(g, cols[k % cols.length])); }
  return mergeGeometries(parts);
}

/* ---------- 쓰레기 세상 ---------- */
export function createTrash({ scene, store, height, paths, inBounds, low }) {
  const trail = makeTrail(paths);
  const ok = (x, z) => inBounds(x, z) && height(x, z) > 2; // 바다·맵 밖 제외
  const geos = makeGeos();
  const mat = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradHard });
  const CAP = low ? 900 : 1700, DRAW_R = low ? TRASH.drawRLow : TRASH.drawR;
  const meshes = geos.map((g) => { const im = new THREE.InstancedMesh(g, mat, CAP); im.count = 0; im.frustumCulled = false; im.receiveShadow = !low; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.setColorAt(0, new THREE.Color()); scene.add(im); return im; });
  const heapMesh = new THREE.InstancedMesh(makeHeapGeo(), mat, TRASH.heaps); heapMesh.frustumCulled = false; heapMesh.castShadow = !low; heapMesh.receiveShadow = !low; scene.add(heapMesh);
  const fxMats = PAL.map((p) => new THREE.MeshToonMaterial({ color: p[0], vertexColors: true, gradientMap: gradHard }));
  let L = null, cells = null, heapLeft = null;
  const C = TRASH.cell, ck = (cx, cz) => (cx + 2048) * 4096 + (cz + 2048);
  const listeners = [];
  const emit = (ev, d) => listeners.forEach((f) => f(ev, d));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
  const Y = new Float32Array(N);
  function layout(date) {
    L = genLayout(date, trail, ok);
    for (let i = 0; i < N; i++) Y[i] = height(L.X[i], L.Z[i]);
    const m = new Map();
    for (let i = 0; i < NS; i++) { const k = ck(Math.floor(L.X[i] / C), Math.floor(L.Z[i] / C)); let a = m.get(k); if (!a) m.set(k, a = []); a.push(i); }
    cells = new Map(); for (const [k, a] of m) cells.set(k, Int32Array.from(a));
    heapLeft = L.heaps.map((_, h) => { let n = 0; for (let s = 0; s < TRASH.heapN; s++) if (!store.isPicked(NS + h * TRASH.heapN + s)) n++; return n; });
    // 각 쓰레기의 색 (번호로 정해짐)
    L.col = new Uint8Array(N); for (let i = 0; i < N; i++) L.col[i] = (Math.imul(i, 2654435761) >>> 24) % PAL[L.TY[i]].length;
    layoutHeaps(); dirty = true;
  }
  function layoutHeaps() {
    L.heaps.forEach((h, k) => { const f = heapLeft[k] / TRASH.heapN, s = f > 0 ? 0.35 + 0.65 * Math.sqrt(f) : 0; e.set(0, h.rot, 0); q.setFromEuler(e); v.set(h.x, height(h.x, h.z) - 0.1, h.z); m4.compose(v, q, new THREE.Vector3(s, s, s)); heapMesh.setMatrixAt(k, m4); });
    heapMesh.instanceMatrix.needsUpdate = true;
  }
  let dirty = true, lastX = 1e9, lastZ = 1e9;
  function rebuild(px, pz) {
    lastX = px; lastZ = pz; dirty = false;
    const cnt = [0, 0, 0, 0, 0], r2 = DRAW_R * DRAW_R, rc = Math.ceil(DRAW_R / C), cx = Math.floor(px / C), cz = Math.floor(pz / C);
    for (let i = cx - rc; i <= cx + rc; i++) for (let j = cz - rc; j <= cz + rc; j++) {
      const a = cells.get(ck(i, j)); if (!a) continue;
      for (let n = 0; n < a.length; n++) {
        const id = a[n], dx = L.X[id] - px, dz = L.Z[id] - pz; if (dx * dx + dz * dz > r2 || store.isPicked(id)) continue;
        const t = L.TY[id], c = cnt[t]; if (c >= CAP) continue;
        e.set(0, L.R[id], 0); q.setFromEuler(e); v.set(L.X[id], Y[id], L.Z[id]); m4.compose(v, q, one);
        meshes[t].setMatrixAt(c, m4); meshes[t].setColorAt(c, col.set(PAL[t][L.col[id]])); cnt[t] = c + 1;
      }
    }
    meshes.forEach((im, t) => { im.count = cnt[t]; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; });
  }
  // 반경 안에서 주울 수 있는 것들 (가까운 순). room: 배낭 남은 부피
  function each(px, pz, r, room, fn) {
    const r2 = r * r;
    for (let i = Math.floor((px - r) / C); i <= Math.floor((px + r) / C); i++) for (let j = Math.floor((pz - r) / C); j <= Math.floor((pz + r) / C); j++) {
      const a = cells.get(ck(i, j)); if (!a) continue;
      for (let n = 0; n < a.length; n++) { const id = a[n], dx = L.X[id] - px, dz = L.Z[id] - pz, d2 = dx * dx + dz * dz; if (d2 > r2 || store.isPicked(id) || TRASH_TYPES[L.TY[id]].vol > room) continue; if (fn(id, d2)) return true; }
    }
    const hr = r + TRASH.heapR;
    for (let h = 0; h < L.heaps.length; h++) {
      if (!heapLeft[h]) continue; const H = L.heaps[h], d2 = (H.x - px) ** 2 + (H.z - pz) ** 2; if (d2 > hr * hr) continue;
      for (let s = 0; s < TRASH.heapN; s++) { const id = NS + h * TRASH.heapN + s; if (store.isPicked(id) || TRASH_TYPES[L.TY[id]].vol > room) continue; if (fn(id, Math.max(0, Math.sqrt(d2) - TRASH.heapR) ** 2)) return true; break; }
    }
    return false;
  }
  const any = (px, pz, r, room) => each(px, pz, r, room, () => true);
  function candidates(px, pz, r, room) { const out = []; each(px, pz, r, room, (id, d2) => { out.push({ id, d2 }); return false; }); out.sort((a, b) => a.d2 - b.d2); return out.map((o) => o.id); }
  const isHeap = (id) => id >= NS;
  function take(id) {
    if (!store.markPicked(id)) return null;
    const t = L.TY[id], type = TRASH_TYPES[t];
    store.bag[type.id] = (store.bag[type.id] || 0) + 1;
    let heapClear = false;
    if (isHeap(id)) { const h = Math.floor((id - NS) / TRASH.heapN); heapLeft[h]--; layoutHeaps(); if (!heapLeft[h]) heapClear = true; }
    dirty = true;
    emit('trash', { kind: type.id });
    if (heapClear) emit('heap-clear', {});
    return { id, t, type, pos: new THREE.Vector3(L.X[id], Y[id] + (isHeap(id) ? 0.6 : 0.15), L.Z[id]), color: PAL[t][L.col[id]] };
  }
  const bagVol = () => TRASH_TYPES.reduce((s, t) => s + (store.bag[t.id] || 0) * t.vol, 0);
  function ensureDay() { const d = kstDate(); if (store.date() !== d) { const first = !store.date(); store.reset(d); layout(d); emit('reset', { first }); return true; } return false; }
  if (store.date() === kstDate()) layout(store.date()); else { store.reset(kstDate()); layout(kstDate()); }
  let dayT = 0;
  function update(dt, pos) {
    const now = Date.now(); if (now - dayT > 1000) { dayT = now; ensureDay(); } // 1초마다 한국 날짜 확인 (자정이면 바로 새 배치)
    if (dirty || Math.abs(pos.x - lastX) > 5 || Math.abs(pos.z - lastZ) > 5) rebuild(pos.x, pos.z);
  }
  const clean = () => store.pickedCount() / N;
  // 테스트용
  const test = {
    fillClean(pct) { const want = Math.min(N, Math.round(N * pct / 100)); for (let i = 0; i < N && store.pickedCount() < want; i++) if (!store.isPicked(i)) store.markPicked(i); heapLeft = L.heaps.map((_, h) => { let n = 0; for (let s = 0; s < TRASH.heapN; s++) if (!store.isPicked(NS + h * TRASH.heapN + s)) n++; return n; }); layoutHeaps(); dirty = true; store.commit(); emit('changed', {}); return clean(); },
    fillBag(vol, kind = 'can') { const t = TRASH_TYPES.find((x) => x.id === kind) || TRASH_TYPES[0]; store.bag[t.id] += Math.max(0, Math.floor(vol / t.vol)); store.commit(); emit('changed', {}); return bagVol(); },
    emptyBag() { TRASH_TYPES.forEach((t) => { store.bag[t.id] = 0; }); store.commit(); emit('changed', {}); },
    nearest(px, pz) { let b = null, bd = 1e18; for (let i = 0; i < NS; i++) { if (store.isPicked(i)) continue; const d = (L.X[i] - px) ** 2 + (L.Z[i] - pz) ** 2; if (d < bd) { bd = d; b = i; } } return b == null ? null : { id: b, x: L.X[b], z: L.Z[b], kind: TRASH_TYPES[L.TY[b]].id, d: Math.sqrt(bd) }; },
    heaps: () => L.heaps.map((h, k) => ({ x: h.x, z: h.z, left: heapLeft[k] })),
    drawn: () => meshes.reduce((s, m) => s + m.count, 0),
  };
  return { update, any, candidates, take, bagVol, clean, store, geos, fxMats, on: (f) => listeners.push(f), test, ensureDay, layout: () => L };
}
