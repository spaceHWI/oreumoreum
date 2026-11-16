// 남송이 걸을 수 있는 범위 (#25): 오름(사면·능선·굼부리) + 들머리(시작·클린하우스·가판대) + 그 사이 탐방로 + 조금의 여유.
// 중심에서 본 각도마다 반지름 R(θ) 하나로 나타낸 닫힌 선이다. 이 선을 따라 돌담을 두르고(stonewall.js),
// 걷기 막기·동물 범위·쓰레기 자리(오름에만)가 모두 여기 값을 쓴다
import { relAt, nsPaths, nsAlong, nsSummit } from './namsongi.js';
import { BOUND, TUT } from './balance.js';
import { STREET } from './streetlayout.js';

const N = 720, TAU = Math.PI * 2;

// 중심: 오름(많이 솟은 땅)의 무게중심
let cx = 0, cz = 0, cn = 0;
for (let z = -1000; z <= 1000; z += 20) for (let x = -1000; x <= 1000; x += 20) {
  if (Math.hypot(x - nsSummit.x, z - nsSummit.z) > 900) continue;
  if (relAt(x, z) > 15) { cx += x; cz += z; cn++; }
}
cx /= cn; cz /= cn;

// 1) 오름 자락: 각도마다 바깥으로 훑어 마지막으로 솟은 곳
const R = new Float32Array(N), need = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const a = i / N * TAU, ux = Math.cos(a), uz = Math.sin(a);
  let last = 0, low = 0;
  for (let d = 0; d < 1600; d += 5) {
    if (relAt(cx + ux * d, cz + uz * d) > BOUND.rel) { last = d; low = 0; } else if ((low += 5) > BOUND.gapStop) break;
  }
  R[i] = last + BOUND.margin;
}
// 2) 꼭 안에 들어야 하는 곳: 점 (x,z) 둘레 c 만큼
function must(x, z, c) {
  const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz), a0 = Math.atan2(dz, dx);
  const span = d > c ? Math.asin(c / d) : Math.PI;
  const k0 = Math.floor((a0 - span) / TAU * N), k1 = Math.ceil((a0 + span) / TAU * N);
  for (let k = k0; k <= k1; k++) {
    const i = ((k % N) + N) % N, s = Math.sin(k / N * TAU - a0), co = Math.cos(k / N * TAU - a0);
    const disc = c * c - d * d * s * s; if (disc < 0 && d > c) continue;
    const r = d * co + Math.sqrt(Math.max(0, disc));
    if (r > need[i]) need[i] = r;
  }
}
nsPaths.approach.forEach((p) => must(p[0], p[1], BOUND.approach));
const plaza = [nsAlong('approach', 0), nsAlong('approach', 5), nsAlong('approach', 24), nsAlong('approach', TUT.cleanD, 1, 7.5), nsAlong('approach', TUT.cleanD, 1, 16)]; // 시작·클린하우스·가판대 (#31: 클린하우스는 개울 너머)
plaza.forEach((p) => must(p.x, p.z, BOUND.plaza));
STREET.must.forEach((p) => must(p.x, p.z, p.r)); // 가게 거리 터 (#57)
for (let i = 0; i < N; i++) R[i] = Math.max(R[i], need[i]);
// 3) 부드럽게: 여러 번 이웃 평균 → 꼭 들어야 할 곳은 다시 채움
function blur(passes, w) {
  const t = new Float32Array(N);
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < N; i++) { let s = 0; for (let k = -w; k <= w; k++) s += R[(i + k + N) % N]; t[i] = s / (2 * w + 1); }
    for (let i = 0; i < N; i++) R[i] = Math.max(t[i], need[i]);
  }
}
blur(4, BOUND.smooth); blur(3, 3);

const Rat = (a) => { let f = (a / TAU) * N; f = ((f % N) + N) % N; const i = Math.floor(f), u = f - i; return R[i] * (1 - u) + R[(i + 1) % N] * u; };
// 경계 반지름에서 얼마나 안쪽인가 (+ 안쪽, - 바깥). 각도 방향 거리라 대략값
export function insideBy(x, z) { const dx = x - cx, dz = z - cz; return Rat(Math.atan2(dz, dx)) - Math.hypot(dx, dz); }
export const inBound = (x, z, m = 0) => insideBy(x, z) > m;
// 바깥(혹은 안쪽 여유 inset 넘어)이면 경계 안쪽으로 당긴 점, 아니면 null
export function clampBound(x, z, inset = 0) {
  const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz), r = Rat(Math.atan2(dz, dx)) - inset;
  if (d <= r) return null; return { x: cx + dx / d * r, z: cz + dz / d * r };
}
// 쓰레기 자리: 오름 위(솟은 땅)이고 돌담에서 충분히 안쪽
export const onOreum = (x, z) => relAt(x, z) > BOUND.trashRel && insideBy(x, z) > BOUND.trashWall;

// 경계선 (돌담 자리): 일정한 길이로 다시 나눈 닫힌 선 [[x,z], ...]
export const boundLine = (() => {
  const raw = []; for (let i = 0; i < N; i++) { const a = i / N * TAU; raw.push([cx + Math.cos(a) * R[i], cz + Math.sin(a) * R[i]]); }
  raw.push(raw[0]);
  return raw;
})();

// 정낭 입구: 들머리 시작점 뒤쪽(탐방로를 거꾸로 이은 방향)이 경계와 만나는 곳
export const gate = (() => {
  const a = nsAlong('approach', 0), b = nsAlong('approach', 6);
  const ux = a.x - b.x, uz = a.z - b.z, l = Math.hypot(ux, uz);
  let d = 0; while (d < 400 && inBound(a.x + ux / l * d, a.z + uz / l * d)) d += 0.25;
  const x = a.x + ux / l * d, z = a.z + uz / l * d;
  return { x, z, dx: ux / l, dz: uz / l, ux: -uz / l, uz: ux / l, path: [[a.x, a.z], [x + ux / l * 70, z + uz / l * 70]] }; // path: 정낭 밖으로 이어지는 길 모양(그림만)
})();

// 쓰레기 길 기준: 오름 위에 있는 탐방로 구간만 (들머리 평지·접근로 제외)
export const oreumPaths = (() => {
  const out = [];
  for (const k in nsPaths) { let run = []; for (const p of nsPaths[k]) { if (onOreum(p[0], p[1])) run.push(p); else { if (run.length > 1) out.push(run); run = []; } } if (run.length > 1) out.push(run); }
  return out;
})();
export const BOUND_CENTER = { x: cx, z: cz };

// 들머리와 오름 사이를 가로지르는 안쪽 돌담 자리(#31): 들머리 탐방로 TUT.gateD 지점에서 길에 수직으로 양쪽 바깥 돌담까지.
// 반환 { a:[x,z] 한쪽 끝, b:[x,z] 다른 쪽 끝, c:{x,z} 길 위 정낭 가운데, ux,uz 선 방향, fx,fz 오름 쪽 }
export function crossLine(d) {
  const p = nsAlong('approach', d), q = nsAlong('approach', d + 1), fl = Math.hypot(q.x - p.x, q.z - p.z) || 1, fx = (q.x - p.x) / fl, fz = (q.z - p.z) / fl;
  const ux = -fz, uz = fx, end = (s) => { let t = 0; while (t < 300 && insideBy(p.x + ux * s * t, p.z + uz * s * t) > -1.2) t += 0.25; return [p.x + ux * s * t, p.z + uz * s * t]; };
  return { a: end(-1), b: end(1), c: { x: p.x, z: p.z }, ux, uz, fx, fz };
}
