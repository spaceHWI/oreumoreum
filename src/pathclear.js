// 길 둘레 비우기 (#227): 길 중심선에서 '반폭 + PATHCLEAR.pad' 안에는 돌·걸림돌을 두지 않는다.
// 한 번 지우는 것이 아니라 배치 규칙: 놓을 때 길과의 거리를 보고, 길 밖으로 밀 수 있으면 밀고(풍경 유지) 아니면 뺀다.
// lines: [{ pts: [[x, z], ...], w: 반폭, floor: 건물 바닥이라 걷는 길이 아님 }]. 칸(격자)에 선분을 넣어 가까운 것만 본다.
import { PATHCLEAR } from './balance.js';

export function createPathIndex(lines, cell = 16) {
  const segs = [], cells = new Map(), key = (i, j) => i * 92821 + j;
  lines.forEach((L) => { const p = L.pts || []; for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1], s = { ax: a[0], az: a[1], bx: b[0], bz: b[1], w: L.w, walk: !L.floor }, k = segs.push(s) - 1, pad = L.w + PATHCLEAR.pad + PATHCLEAR.maxR;
    const i0 = Math.floor((Math.min(a[0], b[0]) - pad) / cell), i1 = Math.floor((Math.max(a[0], b[0]) + pad) / cell);
    const j0 = Math.floor((Math.min(a[1], b[1]) - pad) / cell), j1 = Math.floor((Math.max(a[1], b[1]) + pad) / cell);
    for (let u = i0; u <= i1; u++) for (let v = j0; v <= j1; v++) { const kk = key(u, v); let l = cells.get(kk); if (!l) cells.set(kk, l = []); l.push(k); }
  } });
  const near = { d: 0, x: 0, z: 0, w: 0, gap: 0 };
  /* (x, z) 에서 가장 '모자란' 길: gap = 중심선 거리 - 반폭 (작을수록 길에 가까움). 근처에 길이 없으면 null */
  function nearest(x, z) {
    const l = cells.get(key(Math.floor(x / cell), Math.floor(z / cell))); if (!l) return null;
    let best = 1e9, hit = false;
    for (let j = 0; j < l.length; j++) {
      const s = segs[l[j]], dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz;
      const t = L2 ? Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / L2)) : 0;
      const px = s.ax + dx * t, pz = s.az + dz * t, d = Math.hypot(x - px, z - pz), g = d - s.w;
      if (g < best) { best = g; hit = true; near.d = d; near.x = px; near.z = pz; near.w = s.w; near.gap = g; }
    }
    return hit ? near : null;
  }
  /* 반지름 r 인 것이 길 둘레 비울 곳에 걸리는가 */
  const onPath = (x, z, r = 0) => { const n = nearest(x, z); return !!n && n.gap < PATHCLEAR.pad + r; };
  return { nearest, onPath, segs };
}

// items: [{ x, z, r }] (r 은 보이는 반지름). ok(x, z) 가 거짓인 자리로는 밀지 않음. 결과: 남길 것 목록 + 센 수
export function keepOffPath(items, idx, ok = () => true) {
  const out = [], stat = { moved: 0, removed: 0 };
  for (const it of items) {
    const n = idx.nearest(it.x, it.z), need = PATHCLEAR.pad + it.r;
    if (!n || n.gap >= need) { out.push(it); continue; }
    let dx = it.x - n.x, dz = it.z - n.z; const d = Math.hypot(dx, dz);
    if (d < 1e-3) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
    const k = n.w + need + 0.05, x = n.x + dx * k, z = n.z + dz * k;
    if (it.r <= PATHCLEAR.maxR && ok(x, z) && !idx.onPath(x, z, it.r)) { it.x = x; it.z = z; out.push(it); stat.moved++; } else stat.removed++;
  }
  return { items: out, stat };
}
