// 남송이 탐방로 선 모양 한곳 (#67). 꺾인 곳을 둥글게, 굼부리 둘레 갈림길은 Y 자로.
// 길 그림(pathTex)·길 격자·길 따라 놓인 것(가로등·돌담·쓰레기 더미·자동 걷기·투기 트럭)이 모두 이 선(nsPaths)을 쓴다.
// 입력·계산은 실제 m, 마지막에 K 를 곱해 게임 단위로.
import { RIM } from './namsongidata.js';
import { TRAIL } from './balance.js';

const PI = Math.PI;
const len = (p) => { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; };
// 길이를 따라 고른 간격(n 등분)으로 다시 찍기. 끝점은 그대로
export function resample(p, step) {
  const L = len(p), n = Math.max(1, Math.round(L / step)), o = [p[0].slice()];
  let i = 1, acc = 0, segA = 0; // segA: p[i-1] 까지 누적 길이
  for (let k = 1; k < n; k++) {
    const s = L * k / n;
    while (i < p.length - 1 && segA + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]) < s) { segA += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); i++; }
    const a = p[i - 1], b = p[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, t = Math.min(1, Math.max(0, (s - segA) / l));
    o.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  o.push(p[p.length - 1].slice()); void acc;
  return o;
}
// 1m 간격 선을 가우스로 고르기. 끝은 점대칭으로 늘여서 끝점·끝 방향이 그대로 (곧은 길은 곧은 채)
function smooth(p, sigma) {
  const n = p.length, R = Math.ceil(sigma * 3), w = []; let ws = 0;
  for (let k = -R; k <= R; k++) { const v = Math.exp(-k * k / (2 * sigma * sigma)); w.push(v); ws += v; }
  const at = (i) => i < 0 ? [2 * p[0][0] - p[-i][0], 2 * p[0][1] - p[-i][1]] : i >= n ? [2 * p[n - 1][0] - p[2 * n - 2 - i][0], 2 * p[n - 1][1] - p[2 * n - 2 - i][1]] : p[i];
  const o = [];
  for (let i = 0; i < n; i++) { if (i === 0 || i === n - 1) { o.push(p[i].slice()); continue; } let x = 0, z = 0; for (let k = -R; k <= R; k++) { const q = at(Math.min(2 * n - 2, Math.max(-(n - 1), i + k))); x += q[0] * w[k + R]; z += q[1] * w[k + R]; } o.push([x / ws, z / ws]); }
  return o;
}
// 3차 베지어 (a → b, a 에서 방향 da, b 에 방향 db 로 들어옴)
function bez(a, da, b, db, pull, step) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]) * pull, c1 = [a[0] + da[0] * d, a[1] + da[1] * d], c2 = [b[0] - db[0] * d, b[1] - db[1] * d], o = [];
  for (let i = 0; i <= 64; i++) { const t = i / 64, u = 1 - t; o.push([u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b[0], u * u * u * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b[1]]); }
  return resample(o, step);
}
const unit = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
// 선 p 에서 처음부터 s m 지점의 점 번호 (1m 간격 선)
const idxAt = (p, s) => Math.max(1, Math.min(p.length - 2, Math.round(s)));

// 거의 되돌아가는 꺾임(머리핀): 꼭짓점 v 를 반지름 r 의 둥근 머리로 바꿈. p: 들어오는 쪽 이웃, q: 나가는 쪽 이웃
// a: 들어와서 머리 끝까지, b: 머리 끝에서 나가는 쪽까지 (a 끝 = b 처음)
function hairpin(p, v, q, r) {
  const u = unit(v, p), w = unit(v, q), bl = Math.hypot(u[0] + w[0], u[1] + w[1]) || 1, b = [(u[0] + w[0]) / bl, (u[1] + w[1]) / bl]; // b: 두 길 사이(안쪽)
  const c = [v[0] - b[0] * r * 0.4, v[1] - b[1] * r * 0.4], a0 = Math.atan2(-b[1], -b[0]); // 머리 가운데, 끝 쪽 각
  const side = Math.sign((u[0] * b[1] - u[1] * b[0]) || 1), pt = (k) => [c[0] + Math.cos(a0 + side * k) * r, c[1] + Math.sin(a0 + side * k) * r];
  const A = [], B = [];
  for (let i = 0; i <= 6; i++) A.push(pt((6 - i) / 6 * PI / 2));
  for (let i = 0; i <= 6; i++) B.push(pt(-i / 6 * PI / 2));
  return { a: A, b: B };
}

// 원래 꺾은선(조절점). A1: 능선 남쪽 끝, A0: 능선 북쪽 끝
const A0 = RIM[0], A1 = RIM[RIM.length - 1], CR = [36, -292], CRR = 62, KN = [0, -442];
export const TRAIL_CTRL = {
  approach: [[-620, 190], [-470, 120], [-330, 70], A1],
  rim: RIM,
  toCrater: [A0, [-60, -290], [CR[0] - CRR, CR[1]]],
  north: [[24, -394], KN, [-10, -560], [40, -700]], // 첫 점에서 두 갈래로 갈라져 둘레에 붙음 (예전: 둘레 북쪽 끝 → [12, -390])
};

export function buildTrails(K, opt = TRAIL) {
  const { step, sigma } = opt, sc = (p) => p.map((q) => [q[0] * K, q[1] * K]);
  // 1) 들머리 → 능선(남→북) → 굼부리 가는 길을 한 줄로 이어 고르기 → 다시 세 토막
  const C = TRAIL_CTRL, uturn = hairpin(C.rim[1], C.rim[0], C.toCrater[1], opt.uR);
  const rimRev = [...C.rim.slice(1).reverse(), ...uturn.a], tcIn = [...uturn.b, ...C.toCrater.slice(1)]; // 능선 북쪽 끝은 되돌아 나오는 U 자
  const chain = [...C.approach, ...rimRev.slice(1), ...tcIn.slice(1)];
  const fine = smooth(resample(chain, 1), sigma), Lf = fine.length - 1; // 1m 간격이라 번호 ≈ 거리
  const scale = Lf / len(chain), i1 = Math.round(len(C.approach) * scale), i0 = Math.round((len(C.approach) + len(rimRev)) * scale);
  const approach = resample(fine.slice(0, i1 + 1), step), rim = resample(fine.slice(i1, i0 + 1), step).reverse();
  const tc = fine.slice(i0);
  // 2) 굼부리 둘레 (닫힌 원, 0번 = 동쪽, 각도 증가 = 남쪽(+z) 으로 돎)
  const N = Math.max(24, Math.round(2 * PI * CRR / step / 4) * 4), ring = [];
  for (let i = 0; i <= N; i++) ring.push([CR[0] + Math.cos(i / N * 2 * PI) * CRR, CR[1] + Math.sin(i / N * 2 * PI) * CRR]);
  const dk = Math.max(1, Math.round(opt.yAng / 360 * N));
  const tan = (i, s) => { const a = i / N * 2 * PI; return [-Math.sin(a) * s, Math.cos(a) * s]; }; // s=+1 각도 증가 방향
  const ringIdx = (p) => { const a = Math.atan2(p[1] - CR[1], p[0] - CR[0]); return Math.round(((a + 2 * PI) % (2 * PI)) / (2 * PI) * N); }; // p 쪽을 보는 둘레 점
  const wrap = (i) => ((i % N) + N) % N;
  // 갈림점 Y(방향 d: 둘레 쪽) 에서 둘레의 두 점(갈림점 쪽 둘레 점 ± dk)으로 접선 따라 붙는 두 갈래 (Y → 둘레)
  const fork = (Y, d) => { const c = ringIdx(Y), a = wrap(c + dk), b = wrap(c - dk); return [bez(Y, d, ring[a], tan(a, 1), opt.yPull, step), bez(Y, d, ring[b], tan(b, -1), opt.yPull, step)]; };
  // 3) 굼부리 가는 길 끝: Y 자. 줄기는 둘레에서 yStem 앞에서 끝나고 두 갈래가 둘레에 접선으로 붙음
  const qi = idxAt(tc, len(tc) - opt.yStem), Q = tc[qi], [tcA, tcB] = fork(Q, unit(tc[qi - 1], tc[qi + 1]));
  const toCrater = [...resample(tc.slice(0, qi + 1), step), ...tcA.slice(1)];
  // 4) 북쪽 길: 첫 점에서 Y 자로 둘레에 붙고, 소로기촐리 쪽으로
  const nf = smooth(resample(C.north, 1), sigma), [nA, nB] = fork(nf[0], unit(nf[1], nf[0]));
  const north = [...nA.reverse(), ...resample(nf, step).slice(1)];
  nB.reverse();
  return {
    approach: sc(approach), rim: sc(rim), toCrater: sc(toCrater), toCraterB: sc(tcB),
    crater: sc(ring), north: sc(north), northB: sc(nB),
  };
}
