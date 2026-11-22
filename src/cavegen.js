// 동굴 만들기 (#195): 씨앗 하나로 방과 통로를 이어 붙인 한 층. three.js 없이 숫자만 (node 로 확인 가능, tools/caverun.js)
// 한 층 = grid×grid 칸(칸 cell m). 방(원)과 통로(굽은 띠)를 칸에 새긴 뒤, 바닥·천장 높이는 함수로
// 그리는 모양(caveMesh)은 칸 모서리 점을 흔들어(같은 점은 늘 같은 만큼) 바닥·벽·천장이 이어지게
// 걷기 판정(walk)은 칸으로. 벽에서 조금 떨어지도록 주변 네 점이 모두 바닥이어야 걸을 수 있음

// 씨앗 → 0~1 난수 (mulberry32)
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
// 정수 두 개 → 0~1 (같은 점은 늘 같은 값)
function h2(i, j, s) { let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 982451653); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
// 부드러운 잡음 (값 잡음, 0~1)
function vnoise(x, z, s) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = h2(i, j, s), b = h2(i + 1, j, s), c = h2(i, j + 1, s), d = h2(i + 1, j + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// 오늘의 동굴 씨앗: 날짜(KST) 글자 → 숫자. 층마다 따로
export const caveSeed = (day, floor) => hashStr('cave:' + day + ':' + floor);

// 카메라 안 (#214): 안마다 쓰는 값. 'a' 내려다보기(벽을 cut 높이에서 자르고 천장 없음) · 'b' 넓은 굴(길이 S 배, 천장 ceilK 배, 층 자리 따로) · 그 밖 = K 그대로
// 'b' 는 같은 씨앗에서 난수 순서가 같아 지금 굴을 그대로 S 배 키운 모양. 칸 수는 같아 삼각형 수도 같음
const KM = new Map();
export function caveK(K, mode) {
  if (mode !== 'a' && mode !== 'b') return K;
  const key = K.x0 + ':' + mode; if (KM.has(key)) return KM.get(key);
  let o;
  if (mode === 'a') o = { ...K, mode, cut: K.view.a.cut };
  else { const w = K.view.b, S = w.k; o = { ...K, mode, S, cell: K.cell * S, roomR: K.roomR.map((r) => r * S), bossR: K.bossR * S, corrW: K.corrW * S, ceil: { corr: K.ceil.corr * w.ceilK, room: K.ceil.room.map((h) => h * w.ceilK) }, x0: w.x0, floorGap: w.floorGap, cam: w.cam }; }
  KM.set(key, o); return o;
}

// 한 층 만들기. K = balance.js CAVE (또는 caveK 로 고친 것), fi = 층 번호(0 부터), seed
export function genFloor(K, fi, seed) {
  const R = rng(seed), N = K.grid, C = K.cell, span = N * C, S = K.S || 1; /* S: 넓은 굴(#214 b) 길이 배율. 고정 거리·잡음 결도 같이 */
  const ox = K.x0 + fi * K.floorGap - span / 2, oz = K.z0 - span / 2; // 칸 (0,0) 의 세계 자리
  const last = fi === K.floors - 1;
  const nRoom = K.rooms[0] + Math.floor(R() * (K.rooms[1] - K.rooms[0] + 1));
  // 방 놓기: 가장자리에서 떨어지고 서로 겹치지 않게 (안 되면 조금씩 작게)
  const rooms = [], pad = 6 * S;
  for (let k = 0, tries = 0; rooms.length < nRoom && tries < 600; tries++) {
    const boss = last && rooms.length === nRoom - 1;
    let r = boss ? K.bossR : K.roomR[0] + R() * (K.roomR[1] - K.roomR[0]); if (tries > 300) r *= 0.8;
    const x = pad + r + R() * (span - 2 * (pad + r)), z = pad + r + R() * (span - 2 * (pad + r));
    if (rooms.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + r + 7 * S)) rooms.push({ i: k++, x, z, r, h: K.ceil.room[0] + R() * (K.ceil.room[1] - K.ceil.room[0]), kind: 'room' });
  }
  // 첫 방 = 줄(밖으로·위층으로) 방. 거기서 가장 먼 방 = 아래로 내려가는 구멍(맨 아래 층은 동굴의 주인 방)
  const start = rooms[0];
  let far = rooms[1] || start; for (const o of rooms) if (Math.hypot(o.x - start.x, o.z - start.z) > Math.hypot(far.x - start.x, far.z - start.z)) far = o;
  if (last) { // 주인 방은 큰 방으로: 가장 먼 방과 마지막(큰) 방을 맞바꿈
    const big = rooms[rooms.length - 1]; if (big !== far) { [big.x, far.x] = [far.x, big.x]; [big.z, far.z] = [far.z, big.z]; [big.r, far.r] = [far.r, big.r]; far = big; }
  }
  start.kind = 'start'; if (far !== start) far.kind = last ? 'boss' : 'down';
  // 통로: 가까운 것끼리 잇는 나무(프림) + 갈림길용 몇 줄 더
  const edges = [], inT = new Set([0]);
  while (inT.size < rooms.length) {
    let best = null;
    for (const a of inT) for (const b of rooms) if (!inT.has(b.i)) { const d = Math.hypot(rooms[a].x - b.x, rooms[a].z - b.z); if (!best || d < best.d) best = { a, b: b.i, d }; }
    edges.push([best.a, best.b]); inT.add(best.b);
  }
  const has = (a, b) => edges.some((e) => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a));
  const cand = [];
  for (const a of rooms) for (const b of rooms) if (a.i < b.i && !has(a.i, b.i)) cand.push([a.i, b.i, Math.hypot(a.x - b.x, a.z - b.z)]);
  cand.sort((p, q) => p[2] - q[2]);
  let added = 0;
  if (rooms.length >= 4 && R() < 0.35) for (const c of cand) { if (added >= K.extra) break; if (c[2] < span * 0.6) { edges.push([c[0], c[1]]); added++; } }
  // 통로 모양: 가운데를 옆으로 밀어 굽은 2차 곡선, 점 여러 개
  const corr = edges.map(([a, b]) => {
    const A = rooms[a], B = rooms[b], dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz), bend = (R() - 0.5) * L * 0.5;
    const mx = (A.x + B.x) / 2 - dz / L * bend, mz = (A.z + B.z) / 2 + dx / L * bend, pts = [], n = Math.max(6, Math.ceil(L / 3));
    for (let k = 0; k <= n; k++) { const t = k / n, u = 1 - t; pts.push([u * u * A.x + 2 * u * t * mx + t * t * B.x, u * u * A.z + 2 * u * t * mz + t * t * B.z]); }
    return { a, b, pts, w: K.corrW * (0.85 + R() * 0.35) };
  });
  // 곁방(맨 아래 층 빼고 하나): 통로 하나의 가운데에서 옆으로 빠지는 막다른 작은 방 = 갈림길. 숨은 방·보물 자리(3번 조각)
  const pockets = [];
  if (!last) for (let tries = 0; tries < 40 && !pockets.length; tries++) {
    const c = corr[Math.floor(R() * corr.length)], k = Math.floor(c.pts.length / 2), p = c.pts[k], q = c.pts[Math.min(c.pts.length - 1, k + 1)];
    const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz) || 1, side = R() < 0.5 ? -1 : 1, d = (10 + R() * 5) * S, r = (3.5 + R() * 1.2) * S;
    const x = p[0] - dz / L * d * side, z = p[1] + dx / L * d * side;
    if (x < pad + r || z < pad + r || x > span - pad - r || z > span - pad - r) continue;
    if (!rooms.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + r + 4 * S)) continue;
    const o = { i: rooms.length, x, z, r, h: K.ceil.room[0], kind: 'pocket' }; rooms.push(o); pockets.push(o);
    corr.push({ a: -1, b: o.i, pts: [p, [(p[0] + x) / 2 + dx / L * 2 * S, (p[1] + z) / 2 + dz / L * 2 * S], [x, z]], w: K.corrW * 0.8 });
  }
  // 갈림길 수: 곁방 + 더 이은 통로(고리)
  const branch = pockets.length + added;
  // 칸 새기기
  const cells = new Uint8Array(N * N), sN = seed & 0xffff;
  const segD = (px, pz, p, q) => { const vx = q[0] - p[0], vz = q[1] - p[1], L2 = vx * vx + vz * vz || 1; let t = ((px - p[0]) * vx + (pz - p[1]) * vz) / L2; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - p[0] - vx * t, pz - p[1] - vz * t); };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const px = (i + 0.5) * C, pz = (j + 0.5) * C, wob = (vnoise(px * 0.18 / S, pz * 0.18 / S, sN) - 0.5) * 2;
    let on = false;
    for (const o of rooms) if (Math.hypot(px - o.x, pz - o.z) < o.r * (1 + wob * 0.18)) { on = true; break; }
    if (!on) for (const c of corr) { const w = c.w * (1 + wob * 0.25); for (let k = 0; k < c.pts.length - 1 && !on; k++) if (segD(px, pz, c.pts[k], c.pts[k + 1]) < w) on = true; if (on) break; }
    if (on && (i < 2 || j < 2 || i > N - 3 || j > N - 3)) on = false;
    cells[j * N + i] = on ? 1 : 0;
  }
  // 바닥에 칸이 이어지지 않은 외딴 조각은 지움 (줄 방에서 닿는 칸만 남김)
  { const seen = new Uint8Array(N * N), q = [], si = Math.floor(start.x / C), sj = Math.floor(start.z / C);
    if (cells[sj * N + si]) { q.push(sj * N + si); seen[sj * N + si] = 1; }
    while (q.length) { const c = q.pop(), i = c % N, j = (c - i) / N; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= N || b >= N) continue; const k = b * N + a; if (cells[k] && !seen[k]) { seen[k] = 1; q.push(k); } } }
    for (let k = 0; k < N * N; k++) if (!seen[k]) cells[k] = 0; }
  // 높이: 바닥은 낮게 출렁이고 통로는 조금 비탈, 천장은 방 가운데가 높은 둥근 지붕
  const floorL = (lx, lz) => (vnoise(lx * 0.07 / S, lz * 0.07 / S, sN + 7) - 0.5) * 2.4 + (vnoise(lx * 0.4, lz * 0.4, sN + 9) - 0.5) * 0.3;
  const ceilL = (lx, lz) => {
    let c = K.ceil.corr + (vnoise(lx * 0.3 / S, lz * 0.3 / S, sN + 3) - 0.5) * 0.9 * S;
    for (const o of rooms) { const d = Math.hypot(lx - o.x, lz - o.z) / o.r; if (d < 1.15) { const k = Math.max(0, 1 - d * d); c = Math.max(c, K.ceil.corr + (o.h - K.ceil.corr) * Math.sqrt(k) + (vnoise(lx * 0.25 / S, lz * 0.25 / S, sN + 5) - 0.5) * 1.4 * S); } }
    return c;
  };
  const cellAt = (lx, lz) => { const i = Math.floor(lx / C), j = Math.floor(lz / C); return i >= 0 && j >= 0 && i < N && j < N ? cells[j * N + i] : 0; };
  const m = 0.45; // 벽에서 떨어지는 거리(m)
  const F = {
    fi, seed, ox, oz, span, N, C, rooms, corr, edges, branch, cells,
    inside: (x, z) => x >= ox && z >= oz && x < ox + span && z < oz + span,
    walk: (x, z) => { const lx = x - ox, lz = z - oz; return !!(cellAt(lx - m, lz - m) && cellAt(lx + m, lz - m) && cellAt(lx - m, lz + m) && cellAt(lx + m, lz + m)); },
    open: (x, z) => !!cellAt(x - ox, z - oz), // 카메라용: 칸 하나만
    floorY: (x, z) => floorL(x - ox, z - oz),
    ceilY: (x, z) => { const lx = x - ox, lz = z - oz; return floorL(lx, lz) + ceilL(lx, lz); },
    world: (o) => ({ x: ox + o.x, z: oz + o.z }),
    sN,
  };
  F.start = F.world(start); F.startR = start.r; F.far = far !== start ? { ...F.world(far), r: far.r, kind: far.kind } : null;
  F.floorCells = cells.reduce((s, v) => s + v, 0);
  return F;
}

// 그리는 모양: 위치·색 배열 (삼각형 목록, 인덱스 없음). 바닥·천장은 칸마다 사각형, 벽은 바닥 칸과 막힌 칸 사이 변마다 세로 3줄
// 칸 모서리 (i,j) 는 늘 같은 만큼 흔들림 → 바닥·벽·천장이 틈 없이 이어짐
// 삼각형 앞면: 바닥은 위, 천장은 아래, 벽은 굴 안(빈 칸) 쪽. 내려다보기(#214 a, K.cut)는 앞면만 그려 카메라 쪽 벽이 안 보이고(단면),
//   천장 없이 벽을 바닥 + cut 높이에서 자름. 자른 윗면(바위 칸 가운데 빈 칸에 닿는 것)은 cap 으로 따로 (검게)
export function caveMesh(F, K) {
  const { N, C, cells, ox, oz, sN } = F, W = K.wobble * C, cut = K.cut || 0, cap = [];
  const jx = (i, j) => (h2(i, j, sN + 11) - 0.5) * 2 * W, jz = (i, j) => (h2(i, j, sN + 13) - 0.5) * 2 * W;
  const pos = [], col = [];
  const P = (i, j) => { const x = ox + i * C + jx(i, j), z = oz + j * C + jz(i, j); return [x, z]; };
  const rock = (x, z, y, k) => { // 현무암 색 (선형색): 어두운 회색에 조금씩 다른 결, 바닥은 살짝 따뜻하게·젖은 곳은 더 어둡게
    const n = vnoise(x * 0.35, z * 0.35 + y * 0.2, sN + 17), wet = vnoise(x * 0.09, z * 0.09, sN + 19);
    let r = 0.055 + n * 0.04, g = 0.054 + n * 0.038, b = 0.06 + n * 0.04;
    if (k === 0) { r += 0.03; g += 0.022; b += 0.01; if (wet > 0.68) { r *= 0.6; g *= 0.65; b *= 0.8; } }
    if (k === 2) { r *= 0.8; g *= 0.8; b *= 0.85; }
    return [r, g, b];
  };
  const tri = (a, b, c, k) => { for (const v of [a, b, c]) { pos.push(v[0], v[1], v[2]); const cc = rock(v[0], v[2], v[1], k); col.push(cc[0], cc[1], cc[2]); } };
  const at = (i, j) => (i >= 0 && j >= 0 && i < N && j < N ? cells[j * N + i] : 0);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    if (!at(i, j)) continue;
    const c00 = P(i, j), c10 = P(i + 1, j), c01 = P(i, j + 1), c11 = P(i + 1, j + 1);
    const f = (c) => [c[0], F.floorY(c[0], c[1]), c[1]], t = (c) => [c[0], F.ceilY(c[0], c[1]), c[1]], topY = (c) => (cut ? F.floorY(c[0], c[1]) + cut : F.ceilY(c[0], c[1]));
    // 바닥 (위에서 보아 반시계 = 위를 봄)
    tri(f(c00), f(c01), f(c11), 0); tri(f(c00), f(c11), f(c10), 0);
    // 천장 (아래를 봄)
    if (!cut) { tri(t(c00), t(c11), t(c01), 2); tri(t(c00), t(c10), t(c11), 2); }
    // 벽: 막힌 이웃 쪽 변
    const sides = [[0, -1, c00, c10], [1, 0, c10, c11], [0, 1, c11, c01], [-1, 0, c01, c00]];
    for (const [di, dj, a, b] of sides) {
      if (at(i + di, j + dj)) continue;
      // 세로 3줄. 가운데 줄 점은 바위 쪽(바깥)으로 불룩/움푹
      const rows = 3, ya = [F.floorY(a[0], a[1]), topY(a)], yb = [F.floorY(b[0], b[1]), topY(b)];
      const pt = (c, ys, r, key) => { const t0 = r / rows, y = ys[0] + (ys[1] - ys[0]) * t0, bulge = r > 0 && r < rows ? (h2(key, r, sN + 23) - 0.5) * W * 1.6 : 0; return [c[0] + di * bulge, y, c[1] + dj * bulge]; };
      const ka = (i + (a === c10 || a === c11 ? 1 : 0)) * 7919 + (j + (a === c01 || a === c11 ? 1 : 0)), kb = (i + (b === c10 || b === c11 ? 1 : 0)) * 7919 + (j + (b === c01 || b === c11 ? 1 : 0));
      for (let r = 0; r < rows; r++) {
        const a0 = pt(a, ya, r, ka), a1 = pt(a, ya, r + 1, ka), b0 = pt(b, yb, r, kb), b1 = pt(b, yb, r + 1, kb);
        tri(a0, b0, b1, 1); tri(a0, b1, a1, 1);
      }
    }
  }
  if (cut) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { /* 자른 윗면: 빈 칸 둘레(8칸) 바위 칸만. 위를 봄 */
    if (at(i, j) || !(at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1) || at(i - 1, j - 1) || at(i + 1, j - 1) || at(i - 1, j + 1) || at(i + 1, j + 1))) continue;
    const u = (c) => [c[0], F.floorY(c[0], c[1]) + cut, c[1]], c00 = u(P(i, j)), c10 = u(P(i + 1, j)), c01 = u(P(i, j + 1)), c11 = u(P(i + 1, j + 1));
    cap.push(...c00, ...c01, ...c11, ...c00, ...c11, ...c10);
  }
  return { pos: new Float32Array(pos), col: new Float32Array(col), tris: pos.length / 9 + cap.length / 9, cap: cap.length ? new Float32Array(cap) : null };
}

// 이끼·수정 자리: 벽 가까운 바닥 칸(이끼), 방 안 벽가(수정). 층마다 같은 씨앗이면 같은 자리
export function caveDots(F, K) {
  const R = rng(F.seed ^ 0x5bd1e995), { N, C, cells, ox, oz } = F, edge = [];
  for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) if (cells[j * N + i] && (!cells[j * N + i + 1] || !cells[j * N + i - 1] || !cells[(j + 1) * N + i] || !cells[(j - 1) * N + i])) edge.push([i, j]);
  const pick = (n) => { const out = []; for (let k = 0; k < n && edge.length; k++) { const [i, j] = edge[Math.floor(R() * edge.length)]; const x = ox + (i + 0.5) * C, z = oz + (j + 0.5) * C; out.push({ x, z, y: F.floorY(x, z), s: 0.5 + R() * 0.9, a: R() * Math.PI * 2, c: R() }); } return out; };
  return { moss: pick(K.moss), crystal: pick(K.crystal) };
}
