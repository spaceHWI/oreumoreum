import * as THREE from 'three';
import { height, R_RIM, R_BASE, SUMMIT_A, TRAIL_START_A, trail, WALL_R } from './world.js';
import { DN, dnTrail, DN_SHELTER_I, dnTrailDir, DN_SIGN_TEXT } from './donnaeko.js';
import { SIGN_TEXT } from './props.js';
import { GATE, gatePaths } from './gate.js';
import { MAP_ID } from './boot.js';
import { inBound as nsIn, clampBound as nsClamp, gate as nsGate } from './nsbound.js';
import { TUT } from './balance.js';
import { K as NK, NS_E, nsPaths, nsAlong, nsLen, nsSummit, nsDistToRim, relAt, NS_SIGN_TEXT } from './namsongi.js';

// 어떤 맵인지: 주소 해시(#donnaeko) → 저장값 → 기본 다랑쉬
// 지금은 남송이오름 하나만 연다. 예전 맵 셋은 지우지 않고 숨겨 둠 (주소 해시로만 열림)
export const MAPS = {
  namsongi: { id: 'namsongi', name: '남송이오름', short: '남송이', where: '안덕면 서광리' },
  gate: { id: 'gate', name: '탐방로 입구', short: '입구', where: '오름 가는 길', hidden: true },
  darangswi: { id: 'darangswi', name: '다랑쉬오름', short: '다랑쉬', where: '구좌읍 세화리', hidden: true },
  donnaeko: { id: 'donnaeko', name: '한라산 돈내코', short: '돈내코', where: '서귀포시 상효동', hidden: true },
};
export function pickMapId() { return MAP_ID; }

const V = (x, z) => { const v = new THREE.Vector3(x, 0, z); v.y = height(x, z); return v; };
const radialOut = (v) => new THREE.Vector3(v.x, 0, v.z).normalize();
const atRim = (a, dr) => V(Math.cos(a) * (R_RIM + dr), Math.sin(a) * (R_RIM + dr));

// 맵별 배치·규칙. 지형이 만들어진 뒤에 호출해야 height가 맞음
export function buildSpots(id) {
  if (id === 'namsongi') return namsongiSpots();
  if (id === 'gate') return gateSpots();
  if (id === 'donnaeko') return donnaekoSpots();
  return darangswiSpots();
}

function darangswiSpots() {
  const a0 = TRAIL_START_A;
  const summitPos = atRim(SUMMIT_A, 6);
  const benchPos = atRim(SUMMIT_A + 0.42, 6);
  const route = [];
  trail.forEach((p) => route.push(new THREE.Vector3(p.x, 0, p.y)));
  const endA = Math.atan2(route[route.length - 1].z, route[route.length - 1].x);
  for (let i = 0; i <= 120; i++) { const a = endA - (i / 120) * Math.PI * 2; route.push(new THREE.Vector3(Math.cos(a) * (R_RIM + 0.5), 0, Math.sin(a) * (R_RIM + 0.5))); }
  trail.slice().reverse().forEach((p) => route.push(new THREE.Vector3(p.x, 0, p.y)));
  route.forEach((p) => { p.y = height(p.x, p.z); });
  return {
    id: 'darangswi', name: '다랑쉬오름', laps: true,
    start: V(0, R_BASE + 48), startHeading: Math.PI,
    photo: { stone: summitPos, out: radialOut(summitPos), text: ['다랑쉬오름', '382m'], title: '다랑쉬오름 382m' },
    bench: { pos: benchPos, out: radialOut(benchPos), line: '억새 너머로 바람이 지나가요' },
    cairns: [
      { id: 'trailhead', name: '탐방로 입구 돌탑', pos: V(Math.cos(a0 - 0.035) * (R_BASE + 32), Math.sin(a0 - 0.035) * (R_BASE + 32)) },
      { id: 'rim', name: '남쪽 굼부리 돌탑', pos: atRim(Math.PI / 2, 7) },
      { id: 'east', name: '동쪽 둘레길 돌탑', pos: atRim(SUMMIT_A + 0.9, 7) },
    ],
    hareubangs: [
      { pos: V(Math.cos(a0 + 0.022) * (R_BASE + 40), Math.sin(a0 + 0.022) * (R_BASE + 40)), heading: Math.PI + 0.4 },
      { pos: V(Math.cos(a0 - 0.022) * (R_BASE + 40), Math.sin(a0 - 0.022) * (R_BASE + 40)), heading: Math.PI - 0.4 },
      (() => { const p = atRim(SUMMIT_A - 0.3, 7); return { pos: p, heading: Math.atan2(p.x, p.z) + Math.PI }; })(),
    ],
    sign: { pos: V(Math.cos(a0 + 0.04) * (R_BASE + 34), Math.sin(a0 + 0.04) * (R_BASE + 34)), rot: Math.PI + 0.3, html: SIGN_TEXT },
    clamp(x, z) { const r = Math.hypot(x, z); if (r > WALL_R - 1.2) return { x: x * (WALL_R - 1.2) / r, z: z * (WALL_R - 1.2) / r, hit: '여기부터는 남의 밭이에요. 오름 쪽으로 돌아가요' }; return null; },
    inBounds: (x, z) => Math.hypot(x, z) < WALL_R - 4,
    enemyOk: (x, z) => Math.hypot(x, z) < WALL_R - 14, // 적(#37)이 나타날 수 있는 곳
    isViewpoint: (p) => Math.abs(Math.hypot(p.x, p.z) - R_RIM) < 12 && p.y > 100,
    viewpointLine: '굼부리가 열렸어요. 바람 소리를 들으며 둘러보세요',
    npcRoute: route,
    // 생태
    deerHerds: [[-210, 160], [170, -230], [40, 300]],
    deerZone: (x, z) => { const r = Math.hypot(x, z); return r > R_RIM + 4 && r < WALL_R - 6; },
    horses: { count: 5, ring: [R_BASE + 70, R_BASE + 110], zone: (x, z) => { const r = Math.hypot(x, z); return r > R_BASE + 20 && r < WALL_R - 6; } },
    crows: { cx: 0, cz: -40, minY: 140 },
    flowers: [[18, 360], [-30, 330], [150, 250], [-120, 280]],
    pickSpot: (rnd) => { const a = rnd() * Math.PI * 2, r = R_RIM + 2 + rnd() * (R_BASE + 60 - R_RIM); return [Math.cos(a) * r, Math.sin(a) * r]; },
    sunWatch: { pos: summitPos, r: 40 },
    lamps: (() => { const L = []; for (let i = 6; i < trail.length; i += 14) { const p = trail[i]; const q = trail[Math.min(trail.length - 1, i + 1)]; const d = Math.atan2(q.x - p.x, q.y - p.y); const s = (Math.floor(i / 14) % 2) ? 1 : -1; L.push([p.x + Math.cos(d) * 2.8 * s, p.y - Math.sin(d) * 2.8 * s, d + Math.PI / 2 * -s]); }
      for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 + 0.2; L.push([Math.cos(a) * (R_RIM + 4), Math.sin(a) * (R_RIM + 4), -a]); }
      [[0, R_BASE + 44], [-8, R_BASE + 54], [9, R_BASE + 54]].forEach(([x, z]) => L.push([x, z, Math.PI])); return L; })(),
  };
}

function donnaekoSpots() {
  const last = dnTrail[dnTrail.length - 1];
  const vp = V(last.x, last.y);
  const stone = V(vp.x + 4, vp.z + 1.5);
  const sh = dnTrail[DN_SHELTER_I]; const sd = dnTrailDir(DN_SHELTER_I);
  const benchPos = V(sh.x - Math.cos(sd) * 4.5, sh.y + Math.sin(sd) * 4.5);
  const route = dnTrail.map((p) => new THREE.Vector3(p.x, 0, p.y));
  const full = [...route, ...route.slice().reverse()];
  full.forEach((p) => { p.y = height(p.x, p.z); });
  const t0 = dnTrail[0];
  const onTrail = (i, side, off) => { const p = dnTrail[i]; const d = dnTrailDir(i); return V(p.x + Math.cos(d) * off * side, p.y - Math.sin(d) * off * side); };
  return {
    id: 'donnaeko', name: '한라산 돈내코', laps: false,
    start: V(t0.x, t0.y - 6), startHeading: Math.PI,
    photo: { stone, out: new THREE.Vector3(0, 0, 1), text: ['남벽분기점', '1600m'], title: '남벽분기점 1,600m' },
    bench: { pos: benchPos, out: new THREE.Vector3(0, 0, 1), line: '평궤대피소 처마 밑에서 숨을 고르는 중' },
    cairns: [
      { id: 'dn-start', name: '돈내코 입구 돌탑', pos: onTrail(8, 1, 5.5) },
      { id: 'dn-shelter', name: '평궤대피소 돌탑', pos: onTrail(DN_SHELTER_I + 6, -1, 5) },
      { id: 'dn-wall', name: '남벽분기점 돌탑', pos: V(vp.x - 5, vp.z + 2) },
    ],
    hareubangs: [
      { pos: onTrail(3, 1, 4.2), heading: Math.PI - 0.3 },
      { pos: onTrail(3, -1, 4.2), heading: Math.PI + 0.3 },
    ],
    sign: { pos: onTrail(14, -1, 4.8), rot: 0.3, html: DN_SIGN_TEXT, board: { title: '돈내코 탐방로', sub: '한라산국립공원 · 남벽분기점 방향', l1: '평궤대피소 · 남벽분기점(1,600m)', go: '▲ 남벽분기점까지 숲길' } },
    clamp(x, z) {
      let nx = Math.max(-560, Math.min(560, x)), nz = Math.max(DN.limitZ, Math.min(600, z));
      if (nx !== x || nz !== z) return { x: nx, z: nz, hit: nz === DN.limitZ ? '여기부터는 남벽 출입금지 구역이에요' : '탐방로 밖으로는 더 갈 수 없어요' };
      return null;
    },
    inBounds: (x, z) => Math.abs(x) < 550 && z > DN.limitZ + 4 && z < 590,
    enemyOk: (x, z) => Math.abs(x) < 540 && z > DN.limitZ + 14 && z < 580, // 적(#37)이 나타날 수 있는 곳
    isViewpoint: (p) => p.z < -360,
    viewpointLine: '남벽이 눈앞에 솟았어요. 뒤로 돌면 서귀포 바다가 보여요',
    npcRoute: full,
    deerHerds: [[-60, 300], [70, 120], [-50, -60], [40, -250], [-30, -330]],
    deerZone: (x, z) => Math.abs(x) < 520 && z > DN.limitZ + 6 && z < 570,
    horses: null,
    crows: { cx: 0, cz: -470, minY: 360 },
    flowers: [],
    pickSpot: (rnd) => { const i = Math.floor(rnd() * dnTrail.length); const p = dnTrail[i]; return [p.x + (rnd() - 0.5) * 8, p.y + (rnd() - 0.5) * 8]; },
    sunWatch: { pos: vp, r: 30 },
    lamps: (() => { const L = []; for (let i = 4; i < dnTrail.length; i += 12) { const s = (Math.floor(i / 12) % 2) ? 1 : -1; const q = onTrail(i, s, 3.2); const d = dnTrailDir(i); L.push([q.x, q.z, d + Math.PI / 2 * -s]); } L.push([vp.x - 7, vp.z + 3, 0], [vp.x + 7, vp.z + 3, 0]); return L; })(),
  };
}

function gateSpots() {
  const P = GATE.props;
  const start = V(GATE.start.x, GATE.start.z);
  const route = [...gatePaths.main.map((p) => new THREE.Vector3(p.x, 0, p.y)), ...gatePaths.west.slice(1, 4).map((p) => new THREE.Vector3(p.x, 0, p.y))];
  const full = [...route, ...route.slice().reverse()]; full.forEach((p) => { p.y = height(p.x, p.z); });
  const benchPos = V(P.bench.x, P.bench.z);
  const stone = V(3.2, GATE.start.z - 2);
  return {
    id: 'gate', name: '탐방로 입구', laps: false, tutorial: true,
    tut: { gyul: P.gyul[0], hareubang: [P.hareubang.x, P.hareubang.z], jump: [0, P.stream.z], cairn: [P.cairn.x, P.cairn.z], speed: [0, P.cairn.z - 5], fork: [GATE.fork.x, GATE.fork.z] },
    start, startHeading: GATE.startHeading,
    photo: { stone, out: new THREE.Vector3(0, 0, 1), text: ['오름 가는 길', ''], title: '오름 가는 길' },
    bench: { pos: benchPos, out: new THREE.Vector3(1, 0, 0), line: '쉼터 그늘. 출발 전에 숨 한 번' },
    cairns: [{ id: 'gate-cairn', name: '입구 돌탑', pos: V(P.cairn.x, P.cairn.z) }],
    hareubangs: [{ pos: V(P.hareubang.x, P.hareubang.z), heading: P.hareubang.heading }],
    sign: { pos: V(P.sign.x, P.sign.z), rot: 0, html: '', board: null, silent: true },
    exits: Object.entries(GATE.exits).map(([id, p]) => ({ id, pos: V(p.x, p.z), r: 5 })),
    clamp(x, z) { const r = Math.hypot(x, z); if (r > GATE.R - 1.5) return { x: x * (GATE.R - 1.5) / r, z: z * (GATE.R - 1.5) / r, hit: '' }; return null; },
    inBounds: (x, z) => Math.hypot(x, z) < GATE.R - 4,
    isViewpoint: () => false, viewpointLine: '',
    npcRoute: full, npcCount: 2,
    deerHerds: [[-40, 20]], deerZone: (x, z) => Math.hypot(x, z) < GATE.R - 8 && Math.hypot(x, z - GATE.start.z) > 14,
    horses: null,
    crows: { cx: -60, cz: -60, minY: 30 },
    flowers: [[-8, 36], [7, 18], [-9, -2]],
    pickupCount: 3, pickSpot: (() => { let i = 0; return () => { const g = P.gyul[i % P.gyul.length]; i++; return [g[0], g[1]]; }; })(),
    enemyOk: null, // 적 없음 (#37)
    sunWatch: { pos: V(0, -22), r: 30 },
    lamps: (() => { const L = [[-3.2, 40, Math.PI / 2], [3.4, 24, -Math.PI / 2], [-3.4, 6, Math.PI / 2], [3.6, -8, -Math.PI / 2], [-3.2, -19, Math.PI / 2], [3.2, -19, -Math.PI / 2]];
      gatePaths.west.filter((_, i) => i % 2 === 1).forEach((q) => L.push([q.x, q.y + 3.2, 0])); gatePaths.east.filter((_, i) => i % 2 === 1).forEach((q) => L.push([q.x, q.y + 3.2, 0])); return L; })(),
  };
}

function namsongiSpots() {
  const at = (name, d, side = 0, off = 0) => { const q = nsAlong(name, d, side, off); const v = V(q.x, q.z); v.dir = q.dir; return v; };
  const s0 = at('approach', 5);
  const sm = V(nsSummit.x, nsSummit.z);
  // 능선 안쪽(굼부리)에서 바깥을 보는 방향
  let cx = 0, cz = 0; nsPaths.rim.forEach((q) => { cx += q[0]; cz += q[1]; }); cx /= nsPaths.rim.length; cz /= nsPaths.rim.length;
  const outOf = (v) => new THREE.Vector3(v.x - cx, 0, v.z - cz).normalize();
  const smOut = outOf(sm);
  const stone = V(sm.x + smOut.x * 5, sm.z + smOut.z * 5);
  // 능선 길에서 정상이 어디쯤인지
  let si = 0, sb = 1e9; nsPaths.rim.forEach((q, i) => { const d = Math.hypot(q[0] - sm.x, q[1] - sm.z); if (d < sb) { sb = d; si = i; } });
  const rimD = si / (nsPaths.rim.length - 1) * nsLen('rim');
  const benchPos = at('rim', Math.min(nsLen('rim') - 10, rimD + 70), 1, 5.5);
  const LA = nsLen('approach'), LR = nsLen('rim');
  const route = [...nsPaths.approach, ...nsPaths.rim.slice().reverse()].map((q) => new THREE.Vector3(q[0], 0, q[1]));
  const full = [...route, ...route.slice().reverse()]; full.forEach((q) => { q.y = height(q.x, q.z); });
  // 들머리(#31): 시작 → 걷기 원 → 달리기 원 → 개울 → 쓰레기 6개 → 클린하우스·가판대 → 정낭(TUT.gateD) → 오름. 하르방·돌탑·귤은 정낭 너머로
  const G0 = TUT.gateD;
  const T1 = { gyul: [at('approach', G0 + 14, 1, 0.8), at('approach', G0 + 19, -1, 0.7), at('approach', G0 + 24, 1, 0.5)], hare: at('approach', G0 + 6, 1, 4.4), cairn: at('approach', G0 + 34, -1, 4.6) };
  const pickPts = [...nsPaths.approach, ...nsPaths.rim, ...nsPaths.toCrater, ...nsPaths.crater].filter((q) => nsIn(q[0], q[1], 14)); // 돌담 안만
  let pickI = 0;
  return {
    id: 'namsongi', name: '남송이오름', laps: false,
    start: s0, startHeading: s0.dir,
    photo: { stone, out: smOut, text: ['남송이오름', '339m'], title: '남송이오름 339m' },
    bench: { pos: benchPos, out: outOf(benchPos), line: '솔바람 소리를 들으며 숨을 고르는 중' },
    cairns: [
      { id: 'ns-head', name: '들머리 돌탑', pos: T1.cairn },
      { id: 'ns-ridge', name: '능선 돌탑', pos: at('rim', LR - 30, 1, 5) },
      { id: 'ns-rim', name: '정상 돌탑', pos: at('rim', Math.max(10, rimD - 14), -1, 5) },
    ],
    hareubangs: [
      { pos: T1.hare, heading: T1.hare.dir + Math.PI - 0.5 },
      { pos: at('approach', G0 + 6, -1, 4.4), heading: T1.hare.dir + Math.PI + 0.5 },
      { pos: at('approach', LA - 14, -1, 4.4), heading: at('approach', LA - 14).dir + Math.PI + 0.4 },
      { pos: V(stone.x - smOut.z * 6, stone.z + smOut.x * 6), heading: Math.atan2(-smOut.x, -smOut.z) },
    ],
    sign: { pos: at('approach', G0 + 9, -1, 5), rot: at('approach', G0 + 9).dir + Math.PI + 0.35, html: NS_SIGN_TEXT, board: { title: '남송이오름 탐방로', sub: '서귀포시 안덕면 서광리', l1: '능선 · 정상(339m)', go: '▲ 정상까지 솔숲길' } },
    // 걸을 수 있는 범위(#25): 돌담(충돌)이 먼저 막고, 이건 돌담 바로 뒤의 안전망. 안내 문구 없음(돌담이 보이니까)
    clamp(x, z) { const c = nsClamp(x, z, -0.3); return c ? { x: c.x, z: c.z, hit: '' } : null; },
    inBounds: (x, z) => nsIn(x, z, 6),
    gateHint: { x: nsGate.x, z: nsGate.z, r: 5.5, line: '정낭 너머는 아직 갈 수 없어요' },
    isViewpoint: (p) => relAt(p.x, p.z) > 100 && nsDistToRim(p.x, p.z) < 14,
    viewpointLine: '능선에 올랐어요. 서쪽은 바다, 동쪽은 한라산이에요',
    npcRoute: full,
    // 노루 무리: 돌담 안 오름 자락 (#25)
    deerHerds: [[s0.x + 330, s0.z - 40], [sm.x - 350, sm.z + 280], [sm.x + 220, sm.z - 120]].filter(([x, z]) => nsIn(x, z, 30)),
    deerZone: (x, z) => nsIn(x, z, 20),
    horses: null,
    crows: { cx: sm.x, cz: sm.z, minY: sm.y + 14 },
    flowers: [],
    pickSpot: (rnd) => { if (pickI < 3) { const g = T1.gyul[pickI++]; return [g.x, g.z]; } const q = pickPts[Math.floor(rnd() * pickPts.length)]; return [q[0] + (rnd() - 0.5) * 9, q[1] + (rnd() - 0.5) * 9]; },
    enemyOk: (x, z) => nsIn(x, z, 12), // 적(#37)이 나타날 수 있는 곳: 돌담 안
    sunWatch: { pos: sm, r: 45 },
    lamps: (() => { const L = []; for (let d = 10, i = 0; d < LA; d += 46, i++) { if (Math.abs(d - TUT.streamD) < TUT.streamW + 4 || Math.abs(d - G0) < 5) continue; const s = i % 2 ? 1 : -1, q = nsAlong('approach', d, s, 3.4); L.push([q.x, q.z, q.dir + Math.PI / 2 * -s]); }
      for (let d = 30, i = 0; d < LR; d += 90, i++) { const s = i % 2 ? 1 : -1, q = nsAlong('rim', d, s, 3.4); L.push([q.x, q.z, q.dir + Math.PI / 2 * -s]); } return L; })(),
    // 튜토리얼(#31): 걷기·달리기 원, 개울(징검돌), 늘 그 자리의 쓰레기 6개(캔·페트병·비닐), 안쪽 정낭
    tut: (() => {
      const st = at('approach', TUT.streamD);
      return {
        walk: at('approach', TUT.walkD), run: at('approach', TUT.runD),
        gyul: TUT.gyulD.map((d, k) => at('approach', d, k % 2 ? 1 : -1, 0.8)), // #62 귤 3개
        target: at('approach', TUT.targetD, 1, TUT.targetLat), // #62 과녁 (앞이 시작 쪽)
        trash: TUT.trashD.map((d, k) => { const q = at('approach', d, k % 2 ? 1 : -1, 0.9 + (k % 3) * 0.35); return { x: q.x, z: q.z, t: k % 3, r: q.x * 3.1 % 6.28 }; }),
        stream: { x: st.x, z: st.z, dir: st.dir },
        farBank: at('approach', TUT.streamD + TUT.streamW + 2.2),
        gate: at('approach', G0), beyond: at('approach', G0 + 6),
      };
    })(),
    // 클린하우스(재활용장): 개울과 정낭 사이 길 오른쪽. 앞면이 길을 봄
    cleanhouse: (() => { const q = nsAlong('approach', TUT.cleanD, 1, 7.5); const c = nsAlong('approach', TUT.cleanD); return { x: q.x, z: q.z, rot: Math.atan2(c.x - q.x, c.z - q.z) }; })(),
  };
}
