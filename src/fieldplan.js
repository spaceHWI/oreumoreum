// 맵 전체 쓰기 자리 정하기 (#138, notes/growth-loop.md 6절·7-1절). three 없이 계산만 (trash.js 들판 더미, field.js 소굴·보물·볼거리·우두머리 빈터가 같이 씀)
// 구역 안 8자 고리: 길로 들어와 길가 더미 → 왼쪽 들판 → 구역 클린하우스 → 오른쪽 들판 → 우두머리 빈터 → 문턱
// - 길 위 점(trail.samples)을 오르막 쪽으로 돌려 놓고, 구역 클린하우스 높이보다 낮은 길 = 아래 반(lower), 높은 길 = 위 반(upper)
// - 왼쪽 들판 = 아래 반 길의 왼쪽(오르막을 볼 때), 오른쪽 들판 = 위 반 길의 오른쪽, 우두머리 빈터 = 가장 높은 길(top) 둘레
// 같은 seed·같은 입력이면 늘 같은 자리 (멀티에서 모두 같게)

// 구역마다 고리 재료. samples: trail.samples(step) [[x, z, 방향 x, 방향 z]…], chs: 클린하우스 [{x, z}…], far(zone, x, z): 쓰지 않을 곳(구역 1 은 들머리에서 먼 자락)
export function zoneLoops({ samples, zoneAt, height, chs, far = () => false, zones = [1, 2, 3, 4, 5] }) {
  const out = {}, every = [];
  for (const p of samples) {
    let dx = p[2], dz = p[3];
    if (height(p[0] + dx * 3, p[1] + dz * 3) < height(p[0] - dx * 3, p[1] - dz * 3)) { dx = -dx; dz = -dz; } // 오르막 쪽으로
    const q = { x: p[0], z: p[1], dx, dz, y: height(p[0], p[1]), zone: zoneAt(p[0], p[1]) }; every.push(q);
    if (q.zone && !far(q.zone, q.x, q.z)) (out[q.zone] ||= { all: [] }).all.push(q);
  }
  // 길이 안으로 들어가지 않는 구역(굼부리): 옆 구역 길에서 25~65m 옆이 그 구역인 길 점을 씀
  for (const zone of zones) {
    if (out[zone]?.all.length >= 12) continue;
    const edge = every.filter((q) => !far(zone, q.x, q.z) && [25, 45, 65].some((d) => zoneAt(q.x - q.dz * d, q.z + q.dx * d) === zone || zoneAt(q.x + q.dz * d, q.z - q.dx * d) === zone));
    if (edge.length) out[zone] = { all: edge, edge: true };
  }
  for (const k in out) {
    const L = out[k], zone = +k, all = L.all;
    // 구역 클린하우스: 구역 길 가운데에서 가장 가까운 것 (버리기·화살표도 가장 가까운 곳으로 감)
    const cx = all.reduce((s, p) => s + p.x, 0) / all.length, cz = all.reduce((s, p) => s + p.z, 0) / all.length;
    let ch = null; { let bd = 1e18; for (const c of chs) { const d = (c.x - cx) ** 2 + (c.z - cz) ** 2; if (d < bd) { bd = d; ch = c; } } }
    const chY = ch ? height(ch.x, ch.z) : 0, ys = all.map((p) => p.y).sort((a, b) => a - b), med = ys[Math.floor(ys.length / 2)];
    let lower = all.filter((p) => p.y <= chY), upper = all.filter((p) => p.y > chY);
    if (lower.length < 6 || upper.length < 6) { lower = all.filter((p) => p.y <= med); upper = all.filter((p) => p.y > med); } // 클린하우스가 끝에 붙어 있으면 가운데 높이로 나눔
    const top = all.filter((p) => p.y >= ys[Math.floor(ys.length * 0.85)]);
    Object.assign(L, { zone, ch, chY, lower, upper, top, entry: all.reduce((a, b) => (b.y < a.y ? b : a)), exit: all.reduce((a, b) => (b.y > a.y ? b : a)) });
  }
  return out;
}

// 한쪽 들판에 하나 놓기. pool: 길 점들, side: -1 왼쪽 / +1 오른쪽 (오르막을 볼 때, 0 = 어느 쪽이든), d: 길에서 [가까이, 멀리] m, R: 반경
// ok(x, z): 놓을 수 있는 땅, taken: [{x, z, r}] 이미 놓인 것, flat: 가장자리 높이 차 허용(R 배율), trailDist(x, z, lim): 길까지 거리
export function placeSide({ pool, side, d, R, rnd, zone, zoneAt, ok, height, trailDist, taken, gap, flat = 0.45, tries = 500 }) {
  if (!pool.length) return null;
  for (let t = 0; t < tries; t++) {
    const relax = t > tries * 0.7, s = t < tries * 0.5 ? side : side ? (rnd() < 0.75 ? side : -side) : 0;
    const p = pool[Math.floor(rnd() * pool.length)], sg = s || (rnd() < 0.5 ? -1 : 1);
    const lo = relax ? d[0] * 0.7 : d[0], hi = relax ? d[1] * 1.25 : d[1], off = lo + R + rnd() * (hi - lo), al = (rnd() - 0.5) * 12;
    // 오른쪽 = (-dz, dx) (y 위, 앞 (dx, dz) 기준)
    const x = p.x - p.dz * sg * off + p.dx * al, z = p.z + p.dx * sg * off + p.dz * al;
    if (zoneAt(x, z) !== zone) continue;
    if (trailDist(x, z, lo * 0.8 + R + 0.1) < lo * 0.8 + R) continue; // 길에서 떨어지게
    if (taken.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + R + gap * (relax ? 0.5 : 1))) continue;
    let ylo = 1e9, yhi = -1e9, sum = 0; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, y = height(x + Math.cos(a) * R * 0.8, z + Math.sin(a) * R * 0.8); ylo = Math.min(ylo, y); yhi = Math.max(yhi, y); sum += y; }
    if (yhi - ylo > R * (relax ? flat * 1.8 : flat) + 0.3) continue; // 너무 가파른 곳
    let good = true; for (const rho of [0, R * 0.55, R + 0.35]) { const n = rho ? Math.max(6, Math.ceil(2 * Math.PI * rho / 1.2)) : 1; for (let i = 0; i < n && good; i++) { const a = i / n * Math.PI * 2; if (!ok(x + Math.cos(a) * rho, z + Math.sin(a) * rho)) good = false; } if (!good) break; }
    if (!good) continue;
    return { x, z, y: Math.min(sum / 8, ylo + 0.4), side: sg, fromX: p.x, fromZ: p.z };
  }
  return null;
}

// 고리 한 바퀴 (직선 거리 합 × detour): 들어옴 → 길가 더미(낮은 것부터) → 왼쪽 들판(가까운 것부터) → 클린하우스 → 오른쪽 들판 → 빈터 → 문턱
export function loopLength(L, groups, detour = 1.15) {
  let cur = L.entry, sum = 0;
  const go = (p) => { sum += Math.hypot(p.x - cur.x, p.z - cur.z) * detour; cur = p; };
  const nn = (list) => { const left = list.slice(); while (left.length) { let bi = 0, bd = 1e18; left.forEach((p, i) => { const dd = Math.hypot(p.x - cur.x, p.z - cur.z); if (dd < bd) { bd = dd; bi = i; } }); go(left.splice(bi, 1)[0]); } };
  for (const g of groups) { if (Array.isArray(g)) nn(g); else if (g) go(g); }
  go(L.exit);
  return sum;
}
