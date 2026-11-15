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
export function trailRoute(g, from, to) {
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
