// 사물 충돌(#15): 나무·바위·구조물을 원 하나 이상으로 등록하고, 칸(격자)으로 가까운 것만 검사한다.
// 부딪히면 멈추지 않고 법선 방향으로만 밀려나므로 옆으로 미끄러진다.
// 좌표는 월드 x,z. heading(rot) 규약은 three 의 rotation.y (앞 = (sin, cos), 오른쪽 = (cos, -sin)).
import { COLLIDE } from './balance.js';

export function createCollide() {
  const C = COLLIDE.cell, cells = new Map();
  const X = [], Z = [], R = [], OFF = []; // OFF[i] 이면 잠시 꺼 둔 것 (열린 정낭 #31)
  const key = (cx, cz) => cx * 73856093 ^ cz * 19349663;
  function add(x, z, r) {
    const i = X.length; X.push(x); Z.push(z); R.push(r); OFF.push(0);
    const x0 = Math.floor((x - r - COLLIDE.player) / C), x1 = Math.floor((x + r + COLLIDE.player) / C);
    const z0 = Math.floor((z - r - COLLIDE.player) / C), z1 = Math.floor((z + r + COLLIDE.player) / C);
    for (let a = x0; a <= x1; a++) for (let b = z0; b <= z1; b++) { const k = key(a, b); let l = cells.get(k); if (!l) cells.set(k, l = []); l.push(i); }
    return i;
  }
  // 상자(폭 2*hw, 깊이 2*hd)를 폭 방향으로 원을 이어 근사
  function addBox(x, z, rot, hw, hd, ox = 0, oz = 0) {
    const s = Math.sin(rot), c = Math.cos(rot), rx = c, rz = -s, fx = s, fz = c;
    const cx = x + rx * ox + fx * oz, cz = z + rz * ox + fz * oz;
    const n = Math.max(1, Math.ceil(hw / hd)), step = n > 1 ? (2 * hw - 2 * hd) / (n - 1) : 0;
    const ids = []; for (let i = 0; i < n; i++) { const u = n > 1 ? -hw + hd + step * i : 0; ids.push(add(cx + rx * u, cz + rz * u, hd)); }
    return ids;
  }
  const setOff = (ids, off) => ids.forEach((i) => { OFF[i] = off ? 1 : 0; });
  // (x, z) 에서 반지름 pr 인 원이 겹치는가
  function blocked(x, z, pr = 0) {
    const l = cells.get(key(Math.floor(x / C), Math.floor(z / C))); if (!l) return false;
    for (let j = 0; j < l.length; j++) { const i = l[j], d = R[i] + pr; if (!OFF[i] && (x - X[i]) ** 2 + (z - Z[i]) ** 2 < d * d) return true; }
    return false;
  }
  const out = { x: 0, z: 0, hit: false };
  function push(pr) {
    const l = cells.get(key(Math.floor(out.x / C), Math.floor(out.z / C))); if (!l) return;
    for (let it = 0; it < 3; it++) {
      let any = false;
      for (let j = 0; j < l.length; j++) {
        const i = l[j], dx = out.x - X[i], dz = out.z - Z[i], m = R[i] + pr, d2 = dx * dx + dz * dz;
        if (d2 >= m * m || OFF[i]) continue;
        const d = Math.sqrt(d2) || 1e-4; out.x = X[i] + dx / d * m; out.z = Z[i] + dz / d * m; any = true; out.hit = true;
      }
      if (!any) break;
    }
  }
  // (ox,oz) → (nx,nz) 로 가되 사물에 겹치지 않게 밀어낸 결과(재사용 객체). 빨리 움직여도 뚫지 않게 잘게 나눈다
  function move(ox, oz, nx, nz, pr = COLLIDE.player) {
    const dx = nx - ox, dz = nz - oz, n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / COLLIDE.sub));
    out.x = ox; out.z = oz; out.hit = false;
    for (let k = 1; k <= n; k++) { out.x = ox + dx * k / n; out.z = oz + dz * k / n; push(pr); }
    return out;
  }
  return { add, addBox, setOff, blocked, move, count: () => X.length };
}
