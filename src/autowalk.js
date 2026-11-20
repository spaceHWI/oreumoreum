// 탐방로 선(nsPaths)을 그래프로 써서 가장 가까운 길로 붙은 뒤 길을 따라가는 길 찾기 (#40)
// 노드 = 선 위의 점(간격 ≤ 8), 간선 = 같은 선에서 이웃한 점 + 다른 선과 가까이 만나는 점
export function buildTrailGraph(paths, join = 6) {
  const nodes = [], adj = [];
  const add = (p) => { nodes.push({ x: p[0], z: p[1] }); adj.push([]); return nodes.length - 1; };
  const link = (a, b) => { const d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z); adj[a].push([b, d]); adj[b].push([a, d]); };
  const segOf = [];
  for (const k in paths) { let prev = -1; for (const p of paths[k]) { const i = add(p); segOf.push(k); if (prev >= 0) link(prev, i); prev = i; } }
  // 다른 선과 끝이 맞닿은 곳 잇기 (격자 해시)
  const C = 16, cell = new Map();
  nodes.forEach((n, i) => { const key = Math.floor(n.x / C) * 8191 + Math.floor(n.z / C); (cell.get(key) || cell.set(key, []).get(key)).push(i); });
  nodes.forEach((n, i) => { const ci = Math.floor(n.x / C), cj = Math.floor(n.z / C);
    for (let a = ci - 1; a <= ci + 1; a++) for (let b = cj - 1; b <= cj + 1; b++) { const l = cell.get(a * 8191 + b); if (!l) continue; for (const j of l) if (j > i && segOf[j] !== segOf[i] && Math.hypot(nodes[j].x - n.x, nodes[j].z - n.z) < join) link(i, j); } });
  return { nodes, adj, cell, C };
}
function nearest(g, x, z) { let b = -1, bd = 1e12; for (let i = 0; i < g.nodes.length; i++) { const n = g.nodes[i], d = (n.x - x) * (n.x - x) + (n.z - z) * (n.z - z); if (d < bd) { bd = d; b = i; } } return { i: b, d: Math.sqrt(bd) }; }
// from → to 길 찾기. 반환: [{x,z},...] (from 은 빼고 to 까지). 직선이 길보다 충분히 짧으면 직선
// 길 밖 구간 (#138): 들판으로 들어가는 처음·마지막 구간이 돌담·바위·비탈에 막히면 격자 길 찾기로 돌아감
// setRoutePass(fn): fn(x, z) = 지나갈 수 있는가 (게임이 부딪힘·오름 경계·비탈로 넣음). 없으면 예전처럼 직선
let PASS = null;
export function setRoutePass(fn) { PASS = fn; }
function clearLine(a, b) { const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / 0.8); for (let i = 1; i < n; i++) { const t = i / n; if (!PASS(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false; } return true; }
// a → b 를 2m 격자 A* 로 (막힌 칸 비켜 감). 찾으면 [{x,z}…] (a 는 빼고 b 까지, 보이는 점끼리 줄임), 못 찾으면 null
function gridLeg(a, b, S = 2, pad = 26) {
  const x0 = Math.min(a.x, b.x) - pad, z0 = Math.min(a.z, b.z) - pad, nx = Math.ceil((Math.max(a.x, b.x) + pad - x0) / S), nz = Math.ceil((Math.max(a.z, b.z) + pad - z0) / S);
  if (nx * nz > 60000) return null;
  const N = nx * nz, cx = (i) => x0 + (i % nx + 0.5) * S, cz = (i) => z0 + (Math.floor(i / nx) + 0.5) * S;
  const ci = (x, z) => Math.min(nz - 1, Math.max(0, Math.floor((z - z0) / S))) * nx + Math.min(nx - 1, Math.max(0, Math.floor((x - x0) / S)));
  const st = ci(a.x, a.z), gl = ci(b.x, b.z), ok = new Int8Array(N); ok[st] = ok[gl] = 1; // 0 모름, 1 됨, -1 막힘
  const pass = (i) => { if (!ok[i]) ok[i] = PASS(cx(i), cz(i)) ? 1 : -1; return ok[i] > 0; };
  const g = new Float32Array(N).fill(1e9), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N), open = [st]; g[st] = 0;
  const hh = (i) => Math.hypot(cx(i) - b.x, cz(i) - b.z);
  for (let it = 0; it < 20000 && open.length; it++) {
    let bi = 0, bf = 1e18; for (let k = 0; k < open.length; k++) { const f = g[open[k]] + hh(open[k]); if (f < bf) { bf = f; bi = k; } }
    const u = open[bi]; open[bi] = open[open.length - 1]; open.pop(); if (done[u]) continue; done[u] = 1;
    if (u === gl) break;
    const ux = u % nx, uz = Math.floor(u / nx);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dz) continue; const vx = ux + dx, vz = uz + dz; if (vx < 0 || vz < 0 || vx >= nx || vz >= nz) continue;
      const v = vz * nx + vx; if (done[v] || !pass(v)) continue; if (dx && dz && (!pass(uz * nx + vx) || !pass(vz * nx + ux))) continue; // 모서리를 끼고 돌지 않게
      const w = g[u] + (dx && dz ? 1.414 : 1) * S; if (w < g[v]) { g[v] = w; prev[v] = u; open.push(v); } }
  }
  if (prev[gl] < 0 && gl !== st) return null;
  const pts = []; for (let i = gl; i >= 0 && i !== st; i = prev[i]) pts.push({ x: cx(i), z: cz(i) }); pts.reverse(); if (pts.length) pts[pts.length - 1] = { x: b.x, z: b.z }; else pts.push({ x: b.x, z: b.z });
  const out = []; let cur = a; // 보이는 가장 먼 점으로 건너뜀
  for (let i = 0; i < pts.length;) { let j = pts.length - 1; while (j > i && !clearLine(cur, pts[j])) j--; out.push(pts[j]); cur = pts[j]; i = j + 1; }
  return out;
}
// 구간마다 막혔으면 돌아가는 길로 바꿈
function detour(from, pts) {
  if (!PASS) return pts;
  const out = []; let cur = from;
  pts.forEach((p, k) => { const edge = k === 0 || k === pts.length - 1; if (edge && !clearLine(cur, p)) { const leg = gridLeg(cur, p); if (leg) out.push(...leg); else out.push(p); } else out.push(p); cur = p; });
  return out;
}
export function trailRoute(g, from, to) { return detour(from, trailRoute0(g, from, to)); }
function trailRoute0(g, from, to) {
  const s = nearest(g, from.x, from.z), t = nearest(g, to.x, to.z);
  const direct = Math.hypot(to.x - from.x, to.z - from.z);
  if (s.i < 0 || direct < s.d + t.d + 6) return [{ x: to.x, z: to.z }];
  const N = g.nodes.length, dist = new Float64Array(N).fill(1e12), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N);
  dist[s.i] = 0;
  for (let it = 0; it < N; it++) {
    let u = -1, ud = 1e12; for (let i = 0; i < N; i++) if (!done[i] && dist[i] < ud) { ud = dist[i]; u = i; }
    if (u < 0 || u === t.i) break; done[u] = 1;
    for (const [v, w] of g.adj[u]) if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; }
  }
  if (dist[t.i] >= 1e12) return [{ x: to.x, z: to.z }];
  const out = []; for (let i = t.i; i >= 0; i = prev[i]) out.push({ x: g.nodes[i].x, z: g.nodes[i].z });
  out.reverse(); out.push({ x: to.x, z: to.z });
  return out;
}
