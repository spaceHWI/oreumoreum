// 가로등 방향 (#174): 팔(귤 등, 모델 앞 +z)이 가장 가까운 길 가운데를 보게 돌림각을 다시 계산
// - lines: 길 가운데 선 목록 [[[x, z], ...], ...] (탐방로들·가게 거리 골목)
// - 갈림길·꺾인 곳: 가까이(fork m 안) 지나는 다른 길도 같이 봐서 그 방향들의 가운데를 봄
// - 길에서 far m 넘게 떨어진 것은 길 가운데에서 pull m 자리로 당김 (빛 웅덩이가 길에 닿게)
// 반환 { lamps: [x, z, 돌림각][], before·after: 팔 방향과 가장 가까운 길 쪽 방향의 차이(도), moved: 당긴 수 }
import { LAMP_AIM } from './balance.js';

function nearestOn(line, x, z) {
  let bd = 1e18, bx = 0, bz = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)), px = a[0] + dx * t, pz = a[1] + dz * t, d = (px - x) ** 2 + (pz - z) ** 2;
    if (d < bd) { bd = d; bx = px; bz = pz; }
  }
  return { x: bx, z: bz, d: Math.sqrt(bd) };
}
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) * 180 / Math.PI;
// 길 쪽 방향(돌림각)과 가장 가까운 길까지 거리
export function roadAim(x, z, lines, fork = LAMP_AIM.fork) {
  const hits = lines.filter((l) => l && l.length > 1).map((l) => nearestOn(l, x, z)).sort((a, b) => a.d - b.d);
  if (!hits.length) return null;
  const near = hits.filter((h) => h.d < Math.max(fork, hits[0].d + 0.5));
  let sx = 0, sz = 0; near.forEach((h) => { const l = Math.hypot(h.x - x, h.z - z) || 1; sx += (h.x - x) / l; sz += (h.z - z) / l; });
  if (Math.hypot(sx, sz) < 0.2) { sx = hits[0].x - x; sz = hits[0].z - z; } // 두 길 사이 한가운데면 가까운 길
  return { rot: Math.atan2(sx, sz), d: hits[0].d, p: hits[0] };
}
export function aimLamps(L, lines) {
  const before = [], after = []; let moved = 0;
  const lamps = L.map(([x0, z0, r0 = 0]) => {
    let x = x0, z = z0, A = roadAim(x, z, lines); if (!A) return [x0, z0, r0];
    const toNear = (q, xx, zz) => Math.atan2(q.p.x - xx, q.p.z - zz); // 잴 때는 가장 가까운 길 한 곳 기준
    before.push(angDiff(r0, toNear(A, x, z)));
    if (A.d > LAMP_AIM.far) { const k = LAMP_AIM.pull / A.d; x = A.p.x + (x - A.p.x) * k; z = A.p.z + (z - A.p.z) * k; moved++; A = roadAim(x, z, lines); }
    after.push(angDiff(A.rot, toNear(A, x, z)));
    return [x, z, A.rot];
  });
  return { lamps, before, after, moved };
}
