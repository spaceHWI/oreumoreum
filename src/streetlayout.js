// 가게 거리 자리 (#57): 계산만 (그림 없음). nsbound(돌담이 둘러야 할 곳)·namsongi(나무 비우기·판석 길)·main 이 같이 씀
// 골목 좌표 P(s, t): s = 들머리 길 가운데에서 골목 안쪽(시작에서 오름을 볼 때 왼쪽)으로, t = 오름 쪽(+)
import { nsAlong } from './namsongi.js';
import { SHOP_ST } from './balance.js';

const S = SHOP_ST;
const o = nsAlong('approach', S.d), q = nsAlong('approach', S.d + 1);
const fl = Math.hypot(q.x - o.x, q.z - o.z) || 1, fx = (q.x - o.x) / fl, fz = (q.z - o.z) / fl; // 길 방향(오름 쪽)
const ax = fz, az = -fx; // 골목 방향 = 길 왼쪽 (오른쪽 +u = (-fz, fx) 의 반대)
const P = (s, t) => ({ x: o.x + ax * s + fx * t, z: o.z + az * s + fz * t });
const rotOf = (dx, dz) => Math.atan2(dx, dz); // 앞(+Z)이 (dx,dz) 를 보는 rotation.y

// 터: 앞 가운데(front)·가운데(x,z)·방향(rot: 앞이 골목 쪽)·폭 w·깊이 d. i 는 1부터
const lots = S.lots.map((L, k) => {
  let front, center, rot, back;
  if (L.side === 0) { // 골목 끝: 앞이 길 쪽
    front = P(S.end + S.gap, 0); center = P(S.end + S.gap + L.d / 2, 0); rot = rotOf(-ax, -az); back = { x: ax, z: az };
  } else {
    const t0 = L.side * (S.half + S.gap);
    front = P(L.s, t0); center = P(L.s, t0 + L.side * L.d / 2); rot = rotOf(-L.side * fx, -L.side * fz); back = { x: L.side * fx, z: L.side * fz };
  }
  return { i: k + 1, ...L, x: center.x, z: center.z, front, rot, back };
});

// 나무·바위 비우기: 터마다 원 하나, 골목 따라 원 여럿
const clear = lots.map((l) => ({ x: l.x, z: l.z, clearR: Math.hypot(l.w, l.d) / 2 + S.clearPad }));
for (let s = 0; s <= S.end; s += 4) { const p = P(s, 0); clear.push({ x: p.x, z: p.z, clearR: S.half + S.clearPad }); }
// 돌담이 꼭 둘러야 할 곳 (nsbound must)
const must = lots.map((l) => ({ x: l.x, z: l.z, r: Math.hypot(l.w, l.d) / 2 + S.bound }));
const mid = P(S.end / 2, 0);
// 가로등 [x, z, 팔 방향]: 골목 가장자리, 팔이 골목 쪽 (들머리 가로등과 같이 그림)
const lamps = S.lamps.map(([s, side]) => { const p = P(s, side * (S.half + S.gap + 0.35)); return [p.x, p.z, Math.atan2(-side * fx, -side * fz)]; });

export const STREET = {
  P, lots, clear, must, lamps, fx, fz, ax, az,
  alley: [[o.x, o.z], (() => { const p = P(S.end, 0); return [p.x, p.z]; })()], // 판석 길 가운데 선 (길 그림에 더함)
  center: { x: mid.x, z: mid.z }, radius: Math.max(...lots.map((l) => Math.hypot(l.x - mid.x, l.z - mid.z) + Math.hypot(l.w, l.d) / 2)),
  lot: (i) => lots[i - 1],
};
