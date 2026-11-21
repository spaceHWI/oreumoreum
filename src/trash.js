// 쓰레기 (#45): 구역마다 놓인 쓰레기 더미 · 튜토리얼용 낱개 6개 · 줍기 찾기
// 쓰레기 상태(서버별 더미마다 남은 양, 배낭, 누적 수, 도감)를 읽고 쓰는 곳은 createLocalTrashStore 하나뿐.
// 멀티가 붙으면 같은 모양(left/takeOne/putBack/setLeft/bag/commit …)의 서버 저장소로 바꿔 끼운다
// 더미 자리는 고정 난수(HEAP.seed)로 정해짐. 다시 쌓이는 것은 투기꾼·트럭 (#47 src/dumpers.js → refill)
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gradHard } from './toon.js';
import { TRASH_TYPES, TRASH, HEAP, ZONES, DEX, FISH, FIELD, BUDDIES } from './balance.js';
import { zoneAt } from './zones.js';
import { HEAP_DEFS, HEAP_FULL, HEAP_SIG, HEAP_TOTAL } from './heapdefs.js';
import { zoneLoops, placeSide } from './fieldplan.js';
export { HEAP_DEFS, HEAP_SIG, HEAP_TOTAL };
import { kstDay, weekStart, SRVS } from './rankday.js';

// 도감 목록: id 'kind:번호' (흔한 것 0~3, 드문 것 r0~r1). 순서는 종류 순서대로 흔한 4 + 드문 2
export const DEX_LIST = [];
TRASH_TYPES.forEach((t) => { DEX.common[t.id].forEach((name, i) => DEX_LIST.push({ id: `${t.id}:${i}`, kind: t.id, name, rare: false })); DEX.rare.filter((r) => r.kind === t.id).forEach((r, i) => DEX_LIST.push({ id: `${t.id}:r${i}`, kind: t.id, name: r.name, rare: true })); });
// 개울 칸 (#44): 낚시로 잡는 물고기 3종 'fish:번호'. 쓰레기가 아니라 kind 'fish', sec 'stream'
FISH.species.forEach((f, i) => DEX_LIST.push({ id: `fish:${i}`, kind: 'fish', name: f.name, rare: false, sec: 'stream' }));
// 볼거리 칸 (#138): 오름 들판의 전망 바위·샘·산담·방사탑 'sight:번호' (FIELD.sight.list 순서). 처음 찾으면 등록
FIELD.sight.list.forEach((s, i) => DEX_LIST.push({ id: `sight:${i}`, kind: 'sight', sk: s[1], name: s[2], rare: false, sec: 'sight' }));

// 더미 목록 (자리와 상관없이 정해지는 순서)은 src/heapdefs.js (서버와 같이 씀). 저장의 heaps[i] 가 이 순서

/* ---------- 저장소 (기기 저장) ---------- */
export function createLocalTrashStore({ save, persist }) {
  const server = 'battle'; // 서버는 전투 오름 하나 (#98)
  const T = save.trash = (save.trash && typeof save.trash === 'object') ? save.trash : {};
  // 서버별 더미 남은 양 (#35, #45): srv[서버] = { sig, heaps:[남은 수…] }. 예전(흩뿌리기) 기록 date·picked 는 버림
  if (!T.srv || typeof T.srv !== 'object') T.srv = {};
  delete T.date; delete T.picked; delete T.today;
  // #98: 예전 깨끗한 오름 칸은 전투 오름 칸이 없을 때만 그 자리로 옮기고 지움
  if (T.srv.clean) { if (!T.srv.battle) T.srv.battle = T.srv.clean; delete T.srv.clean; }
  let S = null;
  const slot = (id) => {
    const o = T.srv[id] = (T.srv[id] && typeof T.srv[id] === 'object') ? T.srv[id] : {};
    delete o.date; delete o.picked;
    if (o.sig !== HEAP_SIG || !Array.isArray(o.heaps) || o.heaps.length !== HEAP_FULL.length) { o.sig = HEAP_SIG; o.heaps = HEAP_FULL.slice(); } // 처음·더미 구성이 바뀌면 가득 찬 상태로
    o.heaps = o.heaps.map((v, i) => Math.max(0, Math.min(HEAP_FULL[i], Math.floor(Number(v)) || 0)));
    return o;
  };
  if (!T.bag || typeof T.bag !== 'object') T.bag = {};
  TRASH_TYPES.forEach((t) => { T.bag[t.id] = Math.max(0, Math.floor(Number(T.bag[t.id]) || 0)); });
  T.bag.xv = Math.max(0, Number(T.bag.xv) || 0); // #137 구역 귤 배수로 더 받을 귤 (쓰레기 종류 귤 × (ZONES gv - 1) 의 합). 예전 저장엔 없음 = 0
  T.total = Math.max(0, Math.floor(Number(T.total) || 0));
  if (!Array.isArray(T.tp)) T.tp = []; // 튜토리얼용 낱개 쓰레기: 주운 번호(0부터). 누적 수엔 세지 않음
  if (!T.dex || typeof T.dex !== 'object') T.dex = {}; // 도감: id → 주운 수
  { const ok = new Set(DEX_LIST.map((d) => d.id)); Object.keys(T.dex).forEach((k) => { if (!ok.has(k)) delete T.dex[k]; }); } // #16: 도감이 'undefined' 로 쌓이던 기록 지움
  S = slot(server);
  for (const k in T.srv) if (k !== server) delete T.srv[k];
  // 이 기기의 치운 수 (#11 랭킹, 손님·서버 없을 때 보여 줌): rk = { d: 오늘 날 번호, w: 이번 주 월요일 날 번호, day/week/all: { battle } }
  // 처음엔 그동안의 누적 수를 전체로. 예전 clean 칸은 battle 에 더해 한 줄로 (#98)
  const rk = (() => {
    const o = T.rk = (T.rk && typeof T.rk === 'object') ? T.rk : { all: { battle: T.total } };
    for (const k of ['day', 'week', 'all']) {
      const v = o[k] = (o[k] && typeof o[k] === 'object') ? o[k] : {};
      const n = (x) => Math.max(0, Math.floor(Number(x)) || 0);
      if ('clean' in v) { v.battle = n(v.battle) + n(v.clean); delete v.clean; }
      SRVS.forEach((s) => { v[s] = n(v[s]); });
    }
    return o;
  })();
  const rkRoll = () => { const d = kstDay(), w = weekStart(d); if (rk.d !== d) { rk.d = d; SRVS.forEach((s) => { rk.day[s] = 0; }); } if (rk.w !== w) { rk.w = w; SRVS.forEach((s) => { rk.week[s] = 0; }); } };
  rkRoll();
  const rkSrv = () => server;
  const rkAdd = (n) => { rkRoll(); const s = rkSrv(); for (const k of ['day', 'week', 'all']) rk[k][s] = Math.max(0, rk[k][s] + n); };
  let dirty = false;
  return {
    server: () => server,
    resetTutorial() { T.tp = []; dirty = true; },
    left: (h) => S.heaps[h],
    full: (h) => HEAP_FULL[h],
    // 더미 h 에서 하나 꺼냄 (누적 수 +1)
    takeOne(h) { if (!(S.heaps[h] > 0)) return false; S.heaps[h]--; T.total++; rkAdd(1); dirty = true; return true; },
    // 동료가 하나 줄임 (#172): 누적 수·랭킹·배낭·도감엔 안 셈. 마지막 keep 몫은 남김
    nibble(h) { if (!(S.heaps[h] > Math.ceil(HEAP_FULL[h] * BUDDIES.keep))) return false; S.heaps[h]--; dirty = true; return true; },
    // 방이 '늦었다'고 거절한 줍기 되돌리기 (#84): 배낭에서 그 종류 하나·누적 수 하나를 뺌
    untake(kind, xv = 0) { if (T.bag[kind] > 0) T.bag[kind]--; T.bag.xv = Math.max(0, T.bag.xv - xv); T.total = Math.max(0, T.total - 1); rkAdd(-1); dirty = true; },
    // 이 기기의 치운 수 (#11): { day, week, all } (srv 기본은 지금 서버)
    localRank(srv = rkSrv()) { rkRoll(); return { day: rk.day[srv] || 0, week: rk.week[srv] || 0, all: rk.all[srv] || 0 }; },
    // 다시 쌓기 (#37 멧돼지가 흘림 · 뒤 이슈 투기꾼): 넣은 수
    putBack(h, n) { const add = Math.max(0, Math.min(n, HEAP_FULL[h] - S.heaps[h])); S.heaps[h] += add; if (add) dirty = true; return add; },
    setLeft(h, n) { S.heaps[h] = Math.max(0, Math.min(HEAP_FULL[h], Math.floor(n))); dirty = true; }, // 테스트용
    isTutPicked: (k) => T.tp.includes(k),
    markTutPicked(k) { if (T.tp.includes(k)) return false; T.tp.push(k); dirty = true; return true; },
    pickedCount: () => HEAP_TOTAL - S.heaps.reduce((a, b) => a + b, 0), // 이 서버 오름에서 치운 수
    totalCount: () => T.total,
    bag: T.bag,
    dex: T.dex,
    dexAdd(id) { const isNew = !T.dex[id]; T.dex[id] = (T.dex[id] || 0) + 1; return isNew; },
    dexSpecies: () => DEX_LIST.reduce((n, d) => n + (T.dex[d.id] > 0 ? 1 : 0), 0),
    // 마지막 접속 시각 (#47, 서버별 ms). 0 이면 처음
    seen: () => Math.max(0, Number(S.seen) || 0),
    setSeen(t) { S.seen = t; },
    commit() { dirty = false; persist(); },
  };
}

/* ---------- 탐방로 ---------- */
export function mulberry(seed) { let s = seed >>> 0; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function makeTrail(paths) {
  const segs = []; let L = 0;
  for (const pts of paths) for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 1e-3) continue; segs.push({ ax: a[0], az: a[1], bx: b[0], bz: b[1], l, c0: L }); L += l; }
  const TC = 25, grid = new Map();
  segs.forEach((s, k) => { const n = Math.ceil(s.l / 8); for (let j = 0; j <= n; j++) { const x = s.ax + (s.bx - s.ax) * j / n, z = s.az + (s.bz - s.az) * j / n, key = Math.floor(x / TC) * 8191 + Math.floor(z / TC); let a = grid.get(key); if (!a) grid.set(key, a = []); if (a[a.length - 1] !== k) a.push(k); } });
  // 길까지 거리 (lim 보다 멀면 lim)
  const dist = (x, z, lim) => { let b = lim; const r = Math.ceil(lim / TC), ci = Math.floor(x / TC), cj = Math.floor(z / TC), seen = new Set();
    for (let i = ci - r; i <= ci + r; i++) for (let j = cj - r; j <= cj + r; j++) { const a = grid.get(i * 8191 + j); if (!a) continue; for (const k of a) { if (seen.has(k)) continue; seen.add(k); const s = segs[k]; const dx = s.bx - s.ax, dz = s.bz - s.az; let t = ((x - s.ax) * dx + (z - s.az) * dz) / (s.l * s.l); t = t < 0 ? 0 : t > 1 ? 1 : t; const d = Math.hypot(x - s.ax - dx * t, z - s.az - dz * t); if (d < b) b = d; } }
    return b; };
  // 길 위 점들 (step 마다): [x, z, 길 방향 x, 길 방향 z]
  const samples = (step) => { const o = []; for (const s of segs) { const n = Math.max(1, Math.round(s.l / step)); for (let j = 0; j < n; j++) o.push([s.ax + (s.bx - s.ax) * j / n, s.az + (s.bz - s.az) * j / n, (s.bx - s.ax) / s.l, (s.bz - s.az) / s.l]); } return o; };
  return { dist, samples, L };
}

/* ---------- 더미 자리 ---------- */
// ok(x, z): 놓을 수 있는 땅(오름 위, 사물과 안 겹침). 같은 seed 면 늘 같은 자리
function placeHeaps(trail, ok, height, origin, chs = [], entry = null) {
  const far = (z, x, y) => origin && ZONES[z - 1].maxD && Math.hypot(x - origin.x, y - origin.z) > ZONES[z - 1].maxD;
  const rnd = mulberry(HEAP.seed);
  const tr = trail.samples(4);
  // 구역 칸 (빈터 후보): 8 단위 격자
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; tr.forEach((p) => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); });
  const cells = {}; ZONES.forEach((Z) => { cells[Z.id] = []; });
  for (let z = z0 - 200; z <= z1 + 200; z += 8) for (let x = x0 - 200; x <= x1 + 200; x += 8) { const k = zoneAt(x, z); if (k && !far(k, x, z) && trail.dist(x, z, HEAP.freeMax + 1) <= HEAP.freeMax) cells[k].push([x, z]); }
  const near = {}; ZONES.forEach((Z) => { near[Z.id] = []; }); tr.forEach((p) => { const k = zoneAt(p[0], p[1]); if (k && !far(k, p[0], p[1])) near[k].push(p); });
  const ring = (x, z, R, fn) => { for (const rho of [0, R * 0.55, R + 0.35]) { const n = rho ? Math.max(6, Math.ceil(2 * Math.PI * rho / 0.85)) : 1; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; if (!fn(x + Math.cos(a) * rho, z + Math.sin(a) * rho)) return false; } } return true; };
  const out = [];
  HEAP_DEFS.forEach((d) => {
    if (d.field) return; // 들판 더미 (#138) 는 아래에서 따로 (길가 더미 자리가 예전과 같게 난수 순서를 그대로 둠)
    const R = HEAP.sizes[d.k].r; let best = null;
    for (let t = 0; t < 900 && !best; t++) {
      const relax = t > 600, isNear = t < 300 ? rnd() < HEAP.nearFrac : rnd() < 0.3; let x, z;
      if (isNear && near[d.zone].length) { const p = near[d.zone][Math.floor(rnd() * near[d.zone].length)], side = rnd() < 0.5 ? -1 : 1, off = HEAP.trailMin + R + rnd() * (HEAP.trailMax - HEAP.trailMin); x = p[0] - p[3] * side * off; z = p[1] + p[2] * side * off; }
      else { const c = cells[d.zone]; if (!c.length) continue; const p = c[Math.floor(rnd() * c.length)]; x = p[0] + (rnd() - 0.5) * 8; z = p[1] + (rnd() - 0.5) * 8; }
      if (zoneAt(x, z) !== d.zone || far(d.zone, x, z)) continue;
      const chMax = ZONES[d.zone - 1].chMax; if (chMax && chs.length && t < 800 && !chs.some((c) => Math.hypot(c.x - x, c.z - z) < chMax)) continue; // #138 배낭이 찰 때 클린하우스가 가깝게 (7-1절)
      if (!relax && [0, 1, 2, 3].some((i) => zoneAt(x + Math.cos(i * 1.57) * (R + 1), z + Math.sin(i * 1.57) * (R + 1)) !== d.zone)) continue;
      if (trail.dist(x, z, R + HEAP.trailMin + 0.1) < R + HEAP.trailMin) continue; // 길을 막지 않게
      if (out.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + R + HEAP.gap * (relax ? 0.5 : 1))) continue;
      let lo = 1e9, hi = -1e9, sum = 0; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, y = height(x + Math.cos(a) * R * 0.8, z + Math.sin(a) * R * 0.8); lo = Math.min(lo, y); hi = Math.max(hi, y); sum += y; }
      if (hi - lo > R * (relax ? 0.8 : 0.45) + 0.3) continue; // 너무 가파른 곳
      if (!ring(x, z, R, ok)) continue;
      best = { x, z, y: Math.min(sum / 8, lo + 0.4) - 0.1 };
    }
    if (!best) { const c = cells[d.zone][Math.floor(rnd() * cells[d.zone].length)] || [0, 0]; best = { x: c[0], z: c[1], y: height(c[0], c[1]) - 0.12 }; } // 끝내 못 찾으면 구역 안 아무 데나
    out.push({ ...best, r: R, k: d.k, zone: d.zone, n: d.n, gv: d.gv, rot: rnd() * Math.PI * 2 });
  });
  if (entry) placeEntry(out, entry, trail, height, ring);
  // 들판 더미·쓰레기 산 (#138): 8자 고리의 왼쪽 들판(구역 클린하우스보다 낮은 길의 왼쪽), 길에서 FIELD.heapD. 고정 난수 FIELD.seed
  const fr = mulberry(FIELD.seed), farF = (z, x, y) => origin && ZONES[z - 1].maxD && Math.hypot(x - origin.x, y - origin.z) > ZONES[z - 1].maxD;
  const loops = zoneLoops({ samples: tr, zoneAt, height, chs, far: farF });
  const taken = [...out.map((o) => ({ x: o.x, z: o.z, r: o.r })), ...chs.map((c) => ({ x: c.x, z: c.z, r: 6 }))];
  HEAP_DEFS.forEach((d) => {
    if (!d.field) return;
    const R = HEAP.sizes[d.k].r, L = loops[d.zone];
    const q = L && (placeSide({ pool: L.lower, side: L.edge ? 0 : -1, d: FIELD.heapD, R, rnd: fr, zone: d.zone, zoneAt, ok, height, trailDist: trail.dist, taken, gap: FIELD.gap })
      || placeSide({ pool: L.all, side: 0, d: FIELD.heapD, R, rnd: fr, zone: d.zone, zoneAt, ok, height, trailDist: trail.dist, taken, gap: FIELD.gap * 0.5, flat: 0.8 }));
    const best = q ? { x: q.x, z: q.z, y: q.y - 0.12 } : (() => { const c = cells[d.zone][Math.floor(fr() * cells[d.zone].length)] || [0, 0]; return { x: c[0], z: c[1], y: height(c[0], c[1]) - 0.12 }; })();
    taken.push({ x: best.x, z: best.z, r: R });
    out.push({ ...best, r: R, k: d.k, zone: d.zone, n: d.n, gv: d.gv, field: true, rot: fr() * Math.PI * 2 });
  });
  out.loops = loops;
  return out;
}

// #160 들머리 더미: 구역 1 작은 더미 앞쪽 몇 개(저장 순서 그대로)를 정낭 밖 들머리 길가로 옮김. 나머지는 위에서 고른 자리 그대로
// entry = { pts 들머리 길 [[x,z]…], from 정낭까지 길 m, ch 들머리 클린하우스 {x,z}, eye 정낭 바로 밖 {x,z}, ok(x,z) 놓을 수 있는 땅, blocked(x,z,r) 사물 }
// 고정 난수(HEAP.entry.seed)라 늘 같은 자리. 못 찾은 더미는 원래 자리에 둠
function placeEntry(out, E, trail, height, ring) {
  const C = HEAP.entry; if (!C || !E?.ch || !E.pts?.length) return;
  const idx = out.map((o, i) => i).filter((i) => out[i].zone === 1 && !out[i].field && out[i].k === 's');
  const rnd = mulberry(C.seed), road = makeTrail([E.pts]), S = []; let L = 0;
  for (let i = 0; i < E.pts.length - 1; i++) { const a = E.pts[i], b = E.pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 1e-3) continue; const n = Math.ceil(l / 2); for (let j = 0; j < n; j++) if (L + l * j / n >= E.from + C.from) S.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n, (b[0] - a[0]) / l, (b[1] - a[1]) / l]); L += l; }
  const view = (x, z, R) => { const dx = x - E.eye.x, dz = z - E.eye.z, D = Math.hypot(dx, dz); for (let t = 2; t < D - R - 0.5; t += 1) if (E.blocked(E.eye.x + dx / D * t, E.eye.z + dz / D * t, 0.3)) return false; return true; };
  const moved = new Set(), keep = () => out.filter((o, i) => !idx.includes(i) || moved.has(i));
  let k = 0;
  C.bands.forEach(([d0, d1, n], b) => {
    const pool = S.filter((p) => { const D = Math.hypot(p[0] - E.ch.x, p[1] - E.ch.z); return D > d0 - 12 && D < d1 + 12; });
    for (let m = 0; m < n && k < idx.length; m++, k++) {
      const i = idx[k], R = out[i].r; let best = null;
      for (let t = 0; t < 800 && !best && pool.length; t++) {
        const p = pool[Math.floor(rnd() * pool.length)], side = rnd() < 0.5 ? -1 : 1, off = C.off[0] + R + rnd() * (C.off[1] - C.off[0]);
        const x = p[0] - p[3] * side * off, z = p[1] + p[2] * side * off, D = Math.hypot(x - E.ch.x, z - E.ch.z);
        if (D < d0 || D > d1) continue;
        if (road.dist(x, z, R + C.off[0]) < R + C.off[0] - 0.05) continue; // 길을 막지 않게
        if (trail.dist(x, z, R + HEAP.trailMin + 0.1) < R + HEAP.trailMin) continue;
        if (keep().some((o) => Math.hypot(o.x - x, o.z - z) < o.r + R + C.gap)) continue;
        let lo = 1e9, hi = -1e9, sum = 0; for (let a8 = 0; a8 < 8; a8++) { const a = a8 / 8 * Math.PI * 2, y = height(x + Math.cos(a) * R * 0.8, z + Math.sin(a) * R * 0.8); lo = Math.min(lo, y); hi = Math.max(hi, y); sum += y; }
        if (hi - lo > R * 0.45 + 0.3) continue;
        if (!ring(x, z, R, E.ok)) continue;
        if (C.view && b === 0 && E.eye && E.blocked && !view(x, z, R)) continue; // 정낭에서 보이게
        best = { x, z, y: Math.min(sum / 8, lo + 0.4) - 0.1 };
      }
      if (best) { Object.assign(out[i], best, { entry: true }); moved.add(i); }
    }
  });
}

/* ---------- 모양 (로우폴리 임시) ---------- */
function piece(g, color) { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); g.computeVertexNormals(); const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
// 흩뜨리기: 같은 자리의 꼭짓점은 같은 만큼 움직임 (#154). 인덱스 없는 Icosahedron·모서리 점이 면마다 따로인 Box·Torus 도 면 사이가 벌어지지 않게
function jitter(g, amt, seed) { const r = mulberry(seed), p = g.attributes.position, M = new Map(); for (let i = 0; i < p.count; i++) { const k = Math.round(p.getX(i) * 1e4) + ',' + Math.round(p.getY(i) * 1e4) + ',' + Math.round(p.getZ(i) * 1e4); let d = M.get(k); if (!d) M.set(k, d = [(r() - 0.5) * amt, (r() - 0.5) * amt, (r() - 0.5) * amt]); p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]); } return g; }
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
// 더미 모양: 크기 k, 단계 st(0 가득 ~ 3 거의 다 치움). 어두운 쓰레기 덩어리 위에 봉투·상자·타이어·스티로폼·그물·캔·병
const STG_R = [1, 0.8, 0.6, 0.42], STG_H = [1, 0.72, 0.48, 0.26];
const stageOf = (f) => { let st = 0; for (let i = 1; i < HEAP.stages.length; i++) if (f <= HEAP.stages[i]) st = i; return st; };
function heapParts(k, st, low) {
  const S = HEAP.sizes[k], R = S.r * STG_R[st], Hh = S.h * STG_H[st], r = mulberry(901 + st * 31 + k.length * 7 + (k === 'mt' ? 5 : 0)), sc = { s: 0.72, l: 1.0, xl: 1.5, mt: 1.9 }[k];
  const parts = [piece(jitter(new THREE.IcosahedronGeometry(1, 1), 0.16, 5 + st).scale(R, Hh * 0.82, R), '#5a5248'), piece(jitter(new THREE.IcosahedronGeometry(1, 0), 0.2, 9 + st).scale(R * 0.55, Hh * 0.35, R * 0.55).translate(R * 0.1, Hh * 0.62, -R * 0.08), '#3a3a40')];
  const N = Math.round({ s: 12, l: 28, xl: 64, mt: 96 }[k] * [1, 0.72, 0.5, 0.3][st] * (low ? 0.7 : 1));
  const BAG = ['#2e2e34', '#2e2e34', '#3b5ea8', '#e8e4d8', '#55606a'], BOX = ['#b8915a', '#a07a48'], NET = ['#3f9a5a', '#e2683a', '#3e7fc4'], SMALL = ['#d8423a', '#d9eef5', '#e0b23a', '#c9ccd2'];
  for (let i = 0; i < N; i++) {
    const kind = i % 7, s = sc * (0.8 + r() * 0.5); let g, c;
    if (kind === 0 || kind === 4) { g = jitter(new THREE.IcosahedronGeometry(0.4, 0), 0.16, i + st).scale(1, 0.85, 1); c = BAG[Math.floor(r() * BAG.length)]; }
    else if (kind === 1) { g = new THREE.BoxGeometry(0.58, 0.42, 0.46); c = BOX[i % 2]; }
    else if (kind === 2) { g = new THREE.TorusGeometry(0.34, 0.14, 4, 8).rotateX(Math.PI / 2 + (r() - 0.5) * 1.2); c = '#26262a'; }
    else if (kind === 3) { g = jitter(new THREE.BoxGeometry(0.62, 0.24, 0.42), 0.05, i); c = '#f4f4ee'; }
    else if (kind === 5) { g = jitter(new THREE.TorusGeometry(0.42, 0.06, 3, 7), 0.12, i).rotateX(Math.PI / 2 + (r() - 0.5)); c = NET[i % 3]; }
    else { g = new THREE.CylinderGeometry(0.12, 0.12, 0.38, 6).rotateZ(Math.PI / 2); c = SMALL[i % 4]; }
    const top = i >= N - Math.max(1, Math.round(N * 0.12)); // 꼭대기에 몇 개 얹음
    const rho = top ? r() * R * 0.18 : R * 0.88 * Math.sqrt(r()), a = r() * Math.PI * 2;
    const y = Hh * 0.82 * Math.sqrt(Math.max(0, 1 - (rho / R) ** 2));
    g.scale(s, s, s).rotateY(r() * 6.28).rotateX((r() - 0.5) * 0.8).translate(Math.cos(a) * rho, y + 0.05 * s, Math.sin(a) * rho);
    parts.push(piece(g, c));
  }
  return parts;
}
const makeHeapGeo = (k, st, low) => mergeGeometries(heapParts(k, st, low));
export const __geo = { makeGeos, makeHeapGeo, heapParts }; // tools/heapgeo.js 검사용 (#154)

/* ---------- 쓰레기 세상 ---------- */
// paths: 오름 위 탐방로 (더미 자리 기준), inBounds: 오름 위인가, fixed: 튜토리얼 낱개 [{x,z,t,r}], col: 사물 충돌 (더미도 등록), origin: 클린하우스 자리 (ZONES maxD 기준)
// chs: 클린하우스 자리 [{x, z}…] (들머리 + 오름 안, #138 고리 기준·들판 더미가 비켜 감)
// entry: 들머리 더미 자리 (#160, placeEntry). 없으면 구역 1 더미도 오름 위에만
// tutHeap {x, z}: 튜토리얼 낱개를 작은 더미 하나로 그림 (#151). 남은 수에 따라 줄어들고 다 주우면 'tut-heap-clear'. 저장(heaps)·구역·업적엔 안 들어감
export function createTrash({ scene, store, height, paths, inBounds, low, fixed = [], col = null, origin = null, rareMul = null, chs = [], entry = null, tutHeap = null }) {
  const trail = makeTrail(paths);
  const ok = (x, z) => inBounds(x, z) && height(x, z) > 2 && !(col && col.blocked(x, z, 0.45)); // 사물과 겹치지 않게 (#15)
  const heaps = placeHeaps(trail, ok, height, origin, chs, entry && { ...entry, ok: (x, z) => entry.walk(x, z) && !(col && col.blocked(x, z, 0.45)), blocked: (x, z, r) => !!col && col.blocked(x, z, r) });
  const geos = makeGeos();
  const mat = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradHard });
  const fxMats = PAL.map((p) => new THREE.MeshToonMaterial({ color: p[0], vertexColors: true, gradientMap: gradHard }));
  const listeners = [];
  const emit = (ev, d) => listeners.forEach((f) => f(ev, d));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), colr = new THREE.Color();
  // 튜토리얼 낱개 (종류별 InstancedMesh)
  const CAP = Math.max(1, fixed.length);
  const meshes = geos.map((g) => { const im = new THREE.InstancedMesh(g, mat, CAP); im.count = 0; im.frustumCulled = false; im.receiveShadow = !low; im.setColorAt(0, new THREE.Color()); scene.add(im); return im; });
  const FY = fixed.map((f) => height(f.x, f.z)), FC = fixed.map((f, k) => (Math.imul(k + 7, 2654435761) >>> 24) % PAL[f.t].length);
  // #151 튜토리얼 작은 더미: 단계 0~2 (3개 → 2 → 1), 크기는 작은 더미의 TH_K 배
  const TH_K = 0.62, thGeo = tutHeap ? [0, 1, 2].map((st) => makeHeapGeo('s', st, low).scale(TH_K, TH_K, TH_K)) : null;
  const thMesh = tutHeap ? new THREE.Mesh(thGeo[0], mat) : null;
  if (thMesh) { thMesh.position.set(tutHeap.x, height(tutHeap.x, tutHeap.z), tutHeap.z); thMesh.castShadow = !low; thMesh.receiveShadow = !low; scene.add(thMesh); }
  const tutLeft = () => fixed.reduce((n, f, k) => n + (store.isTutPicked(k) ? 0 : 1), 0);
  // 더미 (크기·단계별 InstancedMesh)
  const HM = {}; ['s', 'l', 'xl', 'mt'].forEach((k) => { const cap = Math.max(1, heaps.filter((h) => h.k === k).length); HM[k] = [0, 1, 2, 3].map((st) => { const im = new THREE.InstancedMesh(makeHeapGeo(k, st, low), mat, cap); im.count = 0; im.frustumCulled = false; im.castShadow = !low; im.receiveShadow = !low; scene.add(im); return im; }); });
  // 더미 충돌: 단계마다 원 하나씩 등록해 두고 지금 단계 것만 켬
  heaps.forEach((h) => { h.cols = col ? [0, 1, 2, 3].map((st) => col.add(h.x, h.z, h.r * STG_R[st] * 0.85 + HEAP.colPad)) : null; h.st = -2; });
  const stOf = (i) => { const n = store.left(i); return n > 0 ? stageOf(n / heaps[i].n) : -1; };
  function syncCols() { heaps.forEach((h, i) => { const st = stOf(i); if (st === h.st || !h.cols) { h.st = st; return; } h.st = st; h.cols.forEach((id, s) => col.setOff([id], s !== st)); }); }
  const curR = (i) => heaps[i].r * STG_R[Math.max(0, heaps[i].st)];
  let dirty = true, lastX = 1e9, lastZ = 1e9;
  const recent = []; // 최근 더미 줍기 { h, kind } (#84 되돌리기용)
  const DRAW_R = low ? TRASH.drawRLow : TRASH.drawR, HDRAW = low ? TRASH.heapDrawRLow : TRASH.heapDrawR;
  function rebuild(px, pz) {
    lastX = px; lastZ = pz; dirty = false;
    const cnt = [0, 0, 0, 0, 0];
    if (thMesh) { const n = tutLeft(); thMesh.visible = n > 0; if (n > 0) thMesh.geometry = thGeo[Math.max(0, Math.min(2, fixed.length - n))]; }
    fixed.forEach((f, k) => {
      if (thMesh || store.isTutPicked(k) || (f.x - px) ** 2 + (f.z - pz) ** 2 > DRAW_R * DRAW_R) return;
      const t = f.t, c = cnt[t]; e.set(0, f.r || 0, 0); q.setFromEuler(e); v.set(f.x, FY[k], f.z); m4.compose(v, q, one);
      meshes[t].setMatrixAt(c, m4); meshes[t].setColorAt(c, colr.set(PAL[t][FC[k]])); cnt[t] = c + 1;
    });
    meshes.forEach((im, t) => { im.count = cnt[t]; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; });
    const hc = { s: [0, 0, 0, 0], l: [0, 0, 0, 0], xl: [0, 0, 0, 0], mt: [0, 0, 0, 0] };
    heaps.forEach((h) => {
      if (h.st < 0 || (h.x - px) ** 2 + (h.z - pz) ** 2 > HDRAW * HDRAW) return;
      e.set(0, h.rot, 0); q.setFromEuler(e); v.set(h.x, h.y, h.z); m4.compose(v, q, one);
      HM[h.k][h.st].setMatrixAt(hc[h.k][h.st]++, m4);
    });
    for (const k in HM) HM[k].forEach((im, st) => { im.count = hc[k][st]; im.instanceMatrix.needsUpdate = true; });
  }
  // 반경 r 안에서 주울 수 있는 것 (가까운 순): { h 더미 번호 | k 튜토리얼 번호, x, z, d 가장자리까지 거리 }. room: 배낭 남은 부피
  function candidates(px, pz, r, room) {
    const out = [];
    if (room >= 1) heaps.forEach((h, i) => { if (h.st < 0) return; const d = Math.max(0, Math.hypot(h.x - px, h.z - pz) - curR(i)); if (d <= r) out.push({ h: i, x: h.x, z: h.z, d }); });
    fixed.forEach((f, k) => { if (store.isTutPicked(k) || TRASH_TYPES[f.t].vol > room) return; const d = Math.hypot(f.x - px, f.z - pz); if (d <= r) out.push({ k, x: f.x, z: f.z, d }); });
    return out.sort((a, b) => a.d - b.d);
  }
  const any = (px, pz, r, room) => candidates(px, pz, r, room).length > 0;
  const zoneTotal = {}; heaps.forEach((h) => { zoneTotal[h.zone] = (zoneTotal[h.zone] || 0) + h.n; });
  const zoneLeft = (z) => heaps.reduce((s, h, i) => s + (h.zone === z ? store.left(i) : 0), 0);
  // 구역 쓰레기 종류: 그 구역 비율대로, 배낭에 들어가는 것만
  function rollType(zone, room) {
    const mix = ZONES[zone - 1].mix; let sum = 0; TRASH_TYPES.forEach((t, j) => { if (t.vol <= room) sum += mix[j]; });
    let x = Math.random() * sum; for (let j = 0; j < TRASH_TYPES.length; j++) { if (TRASH_TYPES[j].vol > room) continue; x -= mix[j]; if (x <= 0) return j; }
    return 0;
  }
  function rollDex(type) {
    const rares = DEX_LIST.filter((d) => d.kind === type.id && d.rare), commons = DEX_LIST.filter((d) => d.kind === type.id && !d.rare);
    // 모자(#52)가 드문 쓰레기 확률을 올림. (#16: 예전엔 이 주석이 줄 가운데 있어 뒤가 잘려 도감이 기록되지 않았음)
    return Math.random() < DEX.rareChance * (rareMul ? rareMul() : 1) && rares.length ? rares[Math.floor(Math.random() * rares.length)] : commons[Math.floor(Math.random() * commons.length)];
  }
  // 하나 줍기. c: candidates 의 항목, room: 배낭 남은 부피. 못 주우면 null
  function take(c, room = 99) {
    let t, pos, color;
    if (c.h != null) {
      const h = heaps[c.h]; if (room < 1 || !store.takeOne(c.h)) return null;
      t = rollType(h.zone, room); color = PAL[t][Math.floor(Math.random() * PAL[t].length)];
      const R = curR(c.h) * 0.5, a = Math.random() * 6.28; pos = new THREE.Vector3(h.x + Math.cos(a) * R, h.y + HEAP.sizes[h.k].h * STG_H[Math.max(0, h.st)] * 0.7, h.z + Math.sin(a) * R);
    } else {
      const f = fixed[c.k]; if (!store.markTutPicked(c.k)) return null;
      t = f.t; color = PAL[t][FC[c.k]]; pos = new THREE.Vector3(f.x, FY[c.k] + (thMesh ? 0.45 : 0.15), f.z);
    }
    const type = TRASH_TYPES[t];
    store.bag[type.id] = (store.bag[type.id] || 0) + 1;
    const xv = c.h != null ? type.gyul * ((heaps[c.h].gv || ZONES[heaps[c.h].zone - 1]?.gv || 1) - 1) : 0; // #137 구역마다 쓰레기 귤 배수 (#138 쓰레기 산은 × HEAP.sizes.mt.gv)
    if (xv > 0) store.bag.xv = (store.bag.xv || 0) + xv;
    if (c.h != null) { recent.push({ h: c.h, kind: type.id, xv }); if (recent.length > 80) recent.shift(); } // 방이 한 번에 되돌리라는 수(NET.takeAsk 64)보다 넉넉히 // 방이 거절하면 되돌릴 수 있게 (#84)
    const dx = rollDex(type), dexNew = store.dexAdd(dx.id);
    dirty = true;
    emit('trash', { kind: type.id, dex: dx, dexNew });
    if (c.k != null && thMesh && !tutLeft()) emit('tut-heap-clear', { x: tutHeap.x, z: tutHeap.z, r: HEAP.sizes.s.r * TH_K });
    if (c.h != null) {
      const before = heaps[c.h].st; syncCols();
      if (heaps[c.h].st < 0) { emit('heap-clear', { h: c.h, zone: heaps[c.h].zone }); if (!zoneLeft(heaps[c.h].zone)) emit('zone-clear', { zone: heaps[c.h].zone }); }
      else if (heaps[c.h].st !== before) emit('heap-stage', { h: c.h, st: heaps[c.h].st });
    }
    return { t, type, dex: dx, dexNew, pos, color };
  }
  // 흘리기 (#37 멧돼지가 헤집음): (x, z) 둘레 r 안 가장 가까운 덜 찬 더미에 n 개를 되돌림. 둘레에 더미가 없으면 0
  function drop(x, z, n, r) {
    let best = -1, bd = 1e9; heaps.forEach((h, i) => { const d = Math.hypot(h.x - x, h.z - z) - h.r; if (d <= r && d < bd && store.left(i) < h.n) { bd = d; best = i; } });
    if (best < 0) return 0;
    const got = store.putBack(best, n); if (got) { syncCols(); dirty = true; store.commit(); emit('changed', {}); }
    return got;
  }
  // 다시 쌓기 (#47 투기꾼·트럭): 더미 i 에 n 개. 넘치면 같은 구역의 가까운 덜 찬 더미로. quiet 면 알리지 않음(나중에 relayout). 쌓은 수
  function refill(i, n, quiet = false) {
    const h0 = heaps[i]; if (!h0) return 0;
    let got = store.putBack(i, n);
    if (got < n) heaps.map((h, j) => j).filter((j) => j !== i && heaps[j].zone === h0.zone && store.left(j) < heaps[j].n).sort((a, b) => Math.hypot(heaps[a].x - h0.x, heaps[a].z - h0.z) - Math.hypot(heaps[b].x - h0.x, heaps[b].z - h0.z)).forEach((j) => { if (got < n) got += store.putBack(j, n - got); });
    if (got && !quiet) { syncCols(); dirty = true; emit('changed', {}); emit('refill', { h: i, zone: h0.zone, n: got }); }
    return got;
  }
  // 동료 줍기 (#172): 더미 i 를 하나 줄임 (배낭·귤·도감·누적 수 없음, 마지막 BUDDIES.keep 몫은 남김). 줄였으면 true
  function buddyTake(i) {
    if (!heaps[i] || !store.nibble?.(i)) return false;
    const before = heaps[i].st; syncCols(); dirty = true;
    if (heaps[i].st !== before) emit('heap-stage', { h: i, st: heaps[i].st });
    return true;
  }
  const bagVol = () => TRASH_TYPES.reduce((s, t) => s + (store.bag[t.id] || 0) * t.vol, 0);
  // 방(서버)이 더미 h 줍기를 거절했을 때 (#84): 그 더미에서 가장 최근에 주운 것 하나를 배낭에서 뺌. 뺐으면 true
  function undoTake(h) {
    for (let i = recent.length - 1; i >= 0; i--) if (recent[i].h === h) { store.untake(recent[i].kind, recent[i].xv); recent.splice(i, 1); dirty = true; emit('changed', {}); return true; }
    return false;
  }
  function relayout() { syncCols(); dirty = true; emit('changed', {}); } // 서버를 바꾼 뒤 (#35)
  syncCols();
  function update(dt, pos) { if (dirty || Math.abs(pos.x - lastX) > 6 || Math.abs(pos.z - lastZ) > 6) rebuild(pos.x, pos.z); }
  const clean = () => store.pickedCount() / HEAP_TOTAL; // 오름 전체 깨끗한 정도 0~1
  const zoneClean = (z) => (zoneTotal[z] ? 1 - zoneLeft(z) / zoneTotal[z] : 1);
  // 권장 장비로 혼자 치우는 시간 어림 (분): 줍기 + 클린하우스 왕복. from: 클린하우스 자리 {x,z} 또는 여럿 [{x,z}] (더미마다 가장 가까운 곳, #78)
  function estimate(from, { TOOLS, BAGS, SHOES, walk = 10, detour = 1.15 }) {
    const fs = Array.isArray(from) ? from : [from], dOf = (h) => Math.min(...fs.map((f) => Math.hypot(h.x - f.x, h.z - f.z)));
    return ZONES.map((Z) => {
      const hs = heaps.filter((h) => h.zone === Z.id), n = hs.reduce((s, h) => s + h.n, 0);
      const tool = TOOLS[Z.gear.tool - 1], bag = BAGS[Z.gear.bag - 1], speed = walk * SHOES[Z.gear.shoes - 1].speed;
      const vol = Z.mix.reduce((s, m, j) => s + m * TRASH_TYPES[j].vol, 0);
      const pick = n * tool.time / tool.per, trips = Math.ceil(n * vol / bag.cap);
      const avgD = hs.reduce((s, h) => s + h.n * dOf(h), 0) / Math.max(1, n) * detour;
      // 더미 사이를 한 번 도는 거리 (가까운 것부터 차례로)
      let tour = 0; { const left = hs.slice(); let cur = left.shift(); while (cur && left.length) { let bi = 0, bd = 1e9; left.forEach((h, i) => { const d = Math.hypot(h.x - cur.x, h.z - cur.z); if (d < bd) { bd = d; bi = i; } }); tour += bd * detour; cur = left.splice(bi, 1)[0]; } }
      const walkT = (trips * 2 * avgD + tour) / speed;
      return { zone: Z.id, heaps: hs.length, n, trips, avgD: Math.round(avgD), tour: Math.round(tour), pickMin: +(pick / 60).toFixed(1), walkMin: +(walkT / 60).toFixed(1), min: +((pick + walkT) / 60).toFixed(1), goal: Z.min };
    });
  }
  // 테스트용
  const setZone = (z, full) => { heaps.forEach((h, i) => { if (!z || h.zone === z) store.setLeft(i, full ? h.n : 0); }); syncCols(); dirty = true; store.commit(); emit('changed', {}); };
  const test = {
    clearZone(z) { const had = zoneLeft(z) > 0; setZone(z, false); if (had) emit('zone-clear', { zone: z }); return zoneClean(z); }, // 구역 z 비우기 (0 이면 전부)
    fillZone(z) { setZone(z, true); return zoneClean(z); }, // 구역 z 가득 채우기 (0 이면 전부)
    setHeap(i, n) { store.setLeft(i, n); syncCols(); dirty = true; store.commit(); emit('changed', {}); return store.left(i); },
    fillClean(pct) { const want = Math.round(HEAP_TOTAL * (1 - pct / 100)); let left = want; heaps.forEach((h, i) => { const n = Math.min(h.n, left); store.setLeft(i, n); left -= n; }); syncCols(); dirty = true; store.commit(); emit('changed', {}); return clean(); },
    fillBag(vol, kind = 'can') { const t = TRASH_TYPES.find((x) => x.id === kind) || TRASH_TYPES[0]; store.bag[t.id] += Math.max(0, Math.floor(vol / t.vol)); store.commit(); emit('changed', {}); return bagVol(); },
    emptyBag() { TRASH_TYPES.forEach((t) => { store.bag[t.id] = 0; }); store.bag.xv = 0; store.commit(); emit('changed', {}); },
    heaps: () => heaps.map((h, i) => ({ i, zone: h.zone, k: h.k, x: +h.x.toFixed(1), z: +h.z.toFixed(1), r: h.r, n: h.n, left: store.left(i), st: h.st, field: !!h.field, gv: h.gv })),
    nearestHeap(px, pz) { let b = null, bd = 1e18; heaps.forEach((h, i) => { if (h.st < 0) return; const d = Math.hypot(h.x - px, h.z - pz); if (d < bd) { bd = d; b = { i, x: h.x, z: h.z, r: curR(i), zone: h.zone, k: h.k, left: store.left(i), d }; } }); return b; },
    zoneAt, zoneClean, zoneLeft, estimate,
    dex: () => ({ ...store.dex }), dexForce(id) { const d = DEX_LIST.find((x) => x.id === id); if (!d) return false; const n = store.dexAdd(id); emit('dex-test', { dex: d, dexNew: n }); store.commit(); return n; },
    heapBox: (k = 'xl') => HM[k].map((m) => { m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox; return [+b.min.y.toFixed(2), +b.max.y.toFixed(2), +(b.max.x - b.min.x).toFixed(2)]; }),
    drawn: () => meshes.reduce((s, m) => s + m.count, 0) + Object.values(HM).flat().reduce((s, m) => s + m.count, 0),
  };
  // 땅에 없던 쓰레기를 배낭에 바로 넣음 (#44 낚시로 건진 것). 자리가 없으면 false
  function addToBag(kind, cap) { const t = TRASH_TYPES.find((x) => x.id === kind); if (!t || bagVol() + t.vol > cap) return false; store.bag[t.id] = (store.bag[t.id] || 0) + 1; store.commit(); emit('changed', {}); return true; }
  return { update, any, candidates, take, undoTake, buddyTake, drop, refill, addToBag, bagVol, clean, zoneClean, zoneAt, store, geos, fxMats, on: (f) => listeners.push(f), test, relayout, heaps, trail, loops: heaps.loops, ok };
}
