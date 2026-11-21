// 소품(표지석·벤치·징검돌·하르방·돌탑), 사물 충돌, 돌담, 들머리 개울, 가게 거리, 쓰레기·오름 안 클린하우스·꽃, 마차, 러너(player), HP (#86 에서 main.js 를 나눔. 파일 순서는 src/main.js, 규칙은 notes/prototype-v1.md 코드 구조)
import { TEXCS } from '../boot.js';
import { createTrash, createLocalTrashStore } from '../trash.js';
import { CLEANHOUSE, CAIRN, TUT, SHOPS, LIFE_MODELS, ZONE_LOOK } from '../balance.js';
import { rideRig, createCart } from '../rides.js';
import { STREET } from '../streetlayout.js';
import { createShopStreet, SHOP_BUILD, createRoofSigns } from '../shops.js';
import { createBuff } from '../buff.js';
import { createHp } from '../hp.js';
import { createStream } from '../stream.js';
import { streamCross } from '../streamshape.js';
import { createCollide } from '../collide.js';
import { createCleanhouse, createMiniCleanhouse } from '../cleanhouse.js';
import { gradHard } from '../toon.js';
import * as THREE from 'three';
import { height, groundAt, addWalkable, surfaceAt } from '../world.js';
import { LOW } from '../gfx2.js';
import { buildRunner, DEFAULT_OUTFIT } from '../runner.js';
import { createLife } from '../life.js';
import { createBloom } from '../bloom.js';
import { createBloomFx } from '../bloomfx.js';
import { buildSign } from '../props.js';
import * as NSB from '../nsbound.js';
import { createStoneWall, createCrossWall } from '../stonewall.js';
import { state, late } from './state.js';
import { $, save, wearV, persist, rnd } from './save.js';
import { quality, scene, NSW, camera, spots } from './scene.js';

// ---------- 소품 ----------
const basalt = ['#4a4744', '#5a5550', '#3f3c3a', '#625c55'];
const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...o });
function stoneTexture(lines) {
  const c = document.createElement('canvas'); c.width = 96; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#3b3936'; g.fillRect(0, 0, 96, 256);
  g.fillStyle = '#f3efe2'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 30px sans-serif';
  [...lines[0]].forEach((ch, i) => g.fillText(ch, 48, 28 + i * 36));
  g.font = 'bold 20px sans-serif'; g.fillText(lines[1], 48, 232);
  const t = new THREE.CanvasTexture(c); t.colorSpace = TEXCS;
  return t;
}
// 표지석
export const P = spots.photo;
export const summitOut = P.out.clone();
export const summitTan = new THREE.Vector3(-summitOut.z, 0, summitOut.x);
if (!spots.tutorial) {
  const g = new THREE.Group(); const stoneMat = lam('#3b3936');
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.6, 0.9), [stoneMat, stoneMat, stoneMat, stoneMat, new THREE.MeshLambertMaterial({ map: stoneTexture(P.text) }), stoneMat]);
  body.position.y = 1.8; g.add(body);
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 1.6), lam('#5a5550')); base.position.y = 0.2; g.add(base);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.position.copy(P.stone); g.rotation.y = Math.atan2(summitOut.x, summitOut.z); scene.add(g);
}
export const photoSpot = P.stone.clone().addScaledVector(summitTan, 2.2).addScaledVector(summitOut, 0.6); photoSpot.y = height(photoSpot.x, photoSpot.z);
// 벤치
const benchPos = spots.bench.pos, benchOut = spots.bench.out; export { benchPos }; export { benchOut };
{
  const wood = lam('#8a6040'); const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.2, 0.9), wood); seat.position.y = 0.55; g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.7, 0.15), wood); back.position.set(0, 1.0, -0.42); g.add(back);
  [-1.3, 1.3].forEach((x) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.55, 0.8), wood); l.position.set(x, 0.27, 0); g.add(l); });
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.position.copy(benchPos); g.rotation.y = Math.atan2(benchOut.x, benchOut.z); scene.add(g);
}
// 뛰어넘기 연습용 징검돌 (길을 가로질러 낮게)
if (spots.jumpStones) { const J = spots.jumpStones, c = Math.cos(J.dir), s = Math.sin(J.dir), mat = new THREE.MeshToonMaterial({ color: '#56524e', gradientMap: gradHard }), geo = new THREE.DodecahedronGeometry(0.5, 0);
  for (let i = -3; i <= 3; i++) { const x = J.pos.x + c * i * 0.85 + s * Math.sin(i * 2.1) * 0.25, z = J.pos.z - s * i * 0.85 + c * Math.sin(i * 2.1) * 0.25; const st = new THREE.Mesh(geo, mat); st.position.set(x, height(x, z) + 0.12, z); st.rotation.set(i * 1.3, i * 2.2, i * 0.7); st.scale.set(1.1, 0.62 + 0.12 * Math.sin(i * 3), 0.9); st.castShadow = true; st.receiveShadow = true; scene.add(st); } }
// 생태계 · 하르방 · 표지판
export const life = createLife({ scene, onToast: (m) => late.toast(m), rnd, hooks: {}, spots });
life.hooks.dmgMul = () => buff.mul('dmg'); // 식사 버프(#50) 귤 던지기 피해
spots.hareubangs.forEach((h) => life.addHareubang(h.pos, h.heading));
if (!spots.sign.silent) { const sg = buildSign(spots.sign.board); sg.position.copy(spots.sign.pos); sg.rotation.y = spots.sign.rot; scene.add(sg); }

// 소원 돌탑: 바닥 돌 3개 위로 모두의 돌이 쌓임 (한 사람당 돌탑마다 하나, 다시 올리면 맨 위로)
const STACK_MAX = CAIRN.max;
export const cairns = [];
const stoneGeo = new THREE.DodecahedronGeometry(0.3, 0);
const stoneMat = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: gradHard });
spots.cairns.forEach((cd, ci) => {
  const g = new THREE.Group(); g.position.copy(cd.pos); scene.add(g);
  let y = 0;
  [1.0, 0.82, 0.66].forEach((s, i) => { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), lam(basalt[i])); m.scale.y = 0.55; m.rotation.y = i * 1.3; m.position.y = y + s * 0.5; y += s * 0.8; m.castShadow = true; m.receiveShadow = true; g.add(m); });
  const im = new THREE.InstancedMesh(stoneGeo, stoneMat, STACK_MAX);
  im.count = 0; im.castShadow = false; im.frustumCulled = false; g.add(im);
  cairns.push({ ...cd, group: g, base: y, im, count: 0, drop: 0, lean: ci * 2.1 + 0.7, n: 0, P: new Float32Array(STACK_MAX * 3), Q: new Float32Array(STACK_MAX * 4), S: new Float32Array(STACK_MAX), T: new Float32Array(STACK_MAX * 3), TS: new Float32Array(STACK_MAX), C: new Uint8Array(STACK_MAX), stride: 0, anim: 0, fromN: 0 });
});
const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), eul = new THREE.Euler(), tv = new THREE.Vector3(), ts = new THREE.Vector3();
// 큰 돌 → 작은 돌: 맨 아래가 가장 크고 층마다 3~6% 작아진다. 돌이 많으면 맨 위 크기를 고정해 밑동을 굵게 (#82)
function cairnSizes(n, out) {
  const [lo, hi] = CAIRN.shrink; let p = 1; const r = [];
  for (let i = 0; i < n - 1; i++) { r.push(1 - (lo + (hi - lo) * (0.5 + 0.5 * Math.sin(i * 2.7 + 1)))); p *= r[i]; }
  const k = p < CAIRN.minTaper ? Math.log(CAIRN.minTaper) / Math.log(p) : 1; // 너무 가팔라지면 하한에 맞춘다
  let s = Math.min(CAIRN.maxBottom, CAIRN.topSize / Math.pow(p, k));
  for (let i = 0; i < n; i++) { out[i] = s; if (i < n - 1) s *= Math.pow(r[i], k); }
}
const cairnTmp = new Float32Array(STACK_MAX);
export function layoutCairn(c) {
  const list = late.social.stones.get(c.id) || [];
  const n = Math.min(STACK_MAX, list.length);
  // 지금 보이는 모양을 기억해 두었다가 새 모양으로 0.3초에 걸쳐 바꾼다
  const hadN = c.n; if (hadN && n) { c.fromP = c.P.slice(0, hadN * 3); c.fromS = c.S.slice(0, hadN); c.fromN = hadN; c.anim = CAIRN.resize; }
  cairnSizes(n, cairnTmp);
  let y = c.base;
  const cx = Math.cos(c.lean), cz = Math.sin(c.lean);
  for (let i = 0; i < n; i++) {
    const e = list[list.length - n + i];
    const s = cairnTmp[i];
    const h = y - c.base;
    // 위로 갈수록 한쪽으로 휘고 살짝 흔들림
    const bend = Math.pow(h / CAIRN.bendH, 1.5) * CAIRN.bend, sway = Math.sin(h * 0.9 + c.lean) * 0.07 * Math.min(1, h / 2);
    const jx = Math.sin(i * 2.4) * 0.07 * s, jz = Math.cos(i * 2.4) * 0.07 * s; // 층마다 살짝 어긋남
    eul.set(0.12 * Math.sin(i * 1.7), i * 2.1, 0.12 * Math.cos(i * 1.3)); q.setFromEuler(eul);
    c.T[i * 3] = cx * bend - cz * sway + jx; c.T[i * 3 + 1] = y + 0.07 * s; c.T[i * 3 + 2] = cz * bend + cx * sway + jz;
    c.Q[i * 4] = q.x; c.Q[i * 4 + 1] = q.y; c.Q[i * 4 + 2] = q.z; c.Q[i * 4 + 3] = q.w;
    c.TS[i] = s; c.C[i] = e.mine ? 255 : i % 4;
    y += CAIRN.step * s;
  }
  c.n = n; c.top = y; c.count = list.length;
  if (!c.anim || !c.fromN) { c.P.set(c.T.subarray(0, n * 3)); c.S.set(c.TS.subarray(0, n)); c.anim = 0; }
  else stepCairn(c, 0);
  c.stride = 0; fillCairn(c, c.want || 1);
}
// 크기 변화 보간 (표시용 P·S 를 이전 모양에서 새 모양으로)
export function stepCairn(c, dt) {
  c.anim = Math.max(0, c.anim - dt);
  const t = 1 - c.anim / CAIRN.resize, e = t * t * (3 - 2 * t);
  for (let i = 0; i < c.n; i++) {
    const fi = i < c.fromN ? i : -1;
    for (let k = 0; k < 3; k++) c.P[i * 3 + k] = fi < 0 ? c.T[i * 3 + k] : c.fromP[fi * 3 + k] + (c.T[i * 3 + k] - c.fromP[fi * 3 + k]) * e;
    c.S[i] = fi < 0 ? c.TS[i] : c.fromS[fi] + (c.TS[i] - c.fromS[fi]) * e;
  }
  if (c.anim <= 0) c.fromN = 0;
  c.stride = 0;
}
const mineCol = new THREE.Color('#c9b48a');
const basaltCols = basalt.map((b) => new THREE.Color(b));
// 먼 돌탑은 돌을 건너뛰어 크게 그려 단순하게 (stride 1 = 전부)
export function fillCairn(c, stride) {
  if (c.stride === stride) return;
  c.stride = stride;
  let k = 0;
  const big = stride > 1 ? 1 + (stride - 1) * 0.45 : 1;
  for (let i = 0; i < c.n; i += stride) {
    q.set(c.Q[i * 4], c.Q[i * 4 + 1], c.Q[i * 4 + 2], c.Q[i * 4 + 3]);
    const s = c.S[i] * big;
    mtx.compose(tv.set(c.P[i * 3], c.P[i * 3 + 1], c.P[i * 3 + 2]), q, ts.set(s, s * CAIRN.flat * (stride > 1 ? stride * 0.7 : 1), s));
    c.im.setMatrixAt(k, mtx);
    c.im.setColorAt(k, c.C[i] === 255 ? mineCol : basaltCols[c.C[i]]); k++;
  }
  c.im.count = k; c.im.instanceMatrix.needsUpdate = true; if (c.im.instanceColor) c.im.instanceColor.needsUpdate = true;
}
let cairnLodT = 0;
export function tickCairnLod(dt) {
  cairnLodT -= dt; if (cairnLodT > 0) return; cairnLodT = 0.5;
  cairns.forEach((c) => { if (!c.n) return; const d = Math.hypot(camera.position.x - c.pos.x, camera.position.z - c.pos.z); fillCairn(c, c.want = d > CAIRN.farD ? (LOW ? 5 : 3) : 1); });
}

// ---------- 사물 충돌 (#15, 남송이만) ----------
export const col = NSW ? createCollide() : null;
if (col) {
  NSW.solids.forEach(([x, z, r]) => col.add(x, z, r));
  spots.hareubangs.forEach((h) => col.add(h.pos.x, h.pos.z, 0.75));
  spots.cairns.forEach((c) => col.add(c.pos.x, c.pos.z, 1.0));
  (spots.lamps || []).forEach(([x, z]) => col.add(x, z, LIFE_MODELS.lamp.colR)); // 가로등 기둥 (#2)
  { const a = Math.atan2(P.out.x, P.out.z); col.addBox(P.stone.x, P.stone.z, a, 1.3, 0.8); }
  col.addBox(spots.bench.pos.x, spots.bench.pos.z, Math.atan2(spots.bench.out.x, spots.bench.out.z), 1.6, 0.4, 0, -0.2);
  if (!spots.sign.silent) { const r = spots.sign.rot; [-1.3, 1.3].forEach((u) => col.add(spots.sign.pos.x + Math.cos(r) * u - Math.sin(r) * 0.1, spots.sign.pos.z - Math.sin(r) * u - Math.cos(r) * 0.1, 0.25)); }
  if (spots.cleanhouse) { const c = spots.cleanhouse; col.addBox(c.x, c.z, c.rot, 3.6, 1.4); col.addBox(c.x, c.z, c.rot, 0.95, 0.55, 3.6 + 2.6 + 0, 0.6); }
}
// ---------- 현무암 돌담 경계 (#25, 남송이만) ----------
export const wallPl = { value: new THREE.Vector3() };
const STREAM_LINE = NSW && spots.tut?.stream ? NSB.crossLine(TUT.streamD) : null, STREAM_X = STREAM_LINE ? streamCross(STREAM_LINE, NSB.insideBy) : null; // 개울이 돌담 밑을 지나는 곳 (#41)
export const wall = NSW ? createStoneWall({ scene, height, line: NSB.boundLine, gate: NSB.gate, low: LOW, col, uPl: wallPl, arches: STREAM_X ? STREAM_X.pts : [] }) : null;
// ---------- 들머리(#31): 개울·징검다리·낚시 NPC, 들머리와 오름 사이 돌담·정낭 ----------
export const NS_TUT = NSW && spots.tut?.stream ? spots.tut : null;
export const stream = NS_TUT ? createStream({ scene, height, groundAt, addWalkable, line: STREAM_LINE, walls: STREAM_X.lats, buildRunner, outfit: DEFAULT_OUTFIT, low: LOW, sound: { splash: () => late.sound.splash(), reel: (d) => late.sound.reel(d) } }) : null;
if (stream) { const L = STREAM_LINE; NSW.grass.noStream?.(L.c.x, L.c.z, L.fx, L.fz, TUT.streamW, STREAM_X.lats); }
export const jeongReady = () => save.equip.tool >= 2 && save.equip.bag >= 1;
if (stream && col) col.add(stream.npcPos[0], stream.npcPos[1], 0.6); // 낚시 NPC·앉은 바위
export const jeong = NS_TUT ? createCrossWall({ scene, height, line: NSB.crossLine(TUT.gateD), low: LOW, col, open: !!save.jeong || !!save.tut?.done || jeongReady() }) : null;
if (jeong && jeong.isOpen && !save.jeong) { save.jeong = 1; persist(); }
// 정낭이 열리는 때: 집게·배낭을 둘 다 가졌을 때, 튜토리얼을 마치거나 건너뛰었을 때. 한 번 열리면 계속 열림
export function openJeong(anim = true) { if (!jeong || !jeong.open(anim)) return; save.jeong = 1; persist(); if (anim) late.sound.gate?.(); }
// ---------- 가게 거리 (#57): 길 왼쪽 골목, 터 6개. 가게는 balance.js SHOPS 한 줄 + shops.js SHOP_BUILD. 충돌을 쓰레기 더미보다 먼저 등록 ----------
export const street = NS_TUT ? createShopStreet({ scene, height, street: STREET, low: LOW, col }) : null;
export const shopsBuilt = street ? SHOPS.filter((sh) => STREET.lot(sh.lot) && SHOP_BUILD[sh.id]).map((sh) => ({ ...sh, ...SHOP_BUILD[sh.id]({ scene, height, lot: STREET.lot(sh.lot), low: LOW, col, addWalkable }) })) : [];
export const STN = shopsBuilt.find((sh) => sh.id === 'stone')?.api || null; // 레스토랑 스톤 (#50)
export const SAL = shopsBuilt.find((sh) => sh.id === 'salon')?.api || null; // 루이네 미장원 (#58)
export const LEAPB = shopsBuilt.find((sh) => sh.id === 'leap')?.api || null; // LEAP (#59): 있으면 옷·신발은 여기서만 삼
export const GEARB = shopsBuilt.find((sh) => sh.id === 'gear') || null; // 장비점 (#128): 도구·배낭·무기는 여기서만 삼
export const roofSigns = street ? createRoofSigns({ scene, height, street: STREET, shops: shopsBuilt }) : null; // 지붕 위 아이콘 간판 (#128)
export const buff = createBuff({ save, persist, onEnd: (m) => { if (m) { late.toast('식사 버프가 끝났어요'); late.tips.event('buffEnd'); } } });
// ---------- 쓰레기 (남송이): 오름 위(사면·능선·굼부리)에만 (#25) ----------
export const trash = NSW ? createTrash({ scene, store: createLocalTrashStore({ save, persist }), height, paths: NSB.oreumPaths, inBounds: NSB.onOreum, low: LOW, fixed: spots.tut?.trash || [], col, origin: spots.cleanhouse, chs: [spots.cleanhouse, ...(spots.cleanMinis || [])].filter(Boolean), rareMul: () => wearV('hat') * (state.paceRare || 1) }) : null; // 구역마다 쓰레기 더미 (#45)
export const CH = trash && spots.cleanhouse ? createCleanhouse({ scene, height, ...spots.cleanhouse, low: LOW, trashGeos: trash.geos }) : null;
if (CH && col) col.addBox(CH.boardAt.x, CH.boardAt.z, spots.cleanhouse.rot, 0.9, 0.2); // 랭킹 게시판 (#11)
// 오름 안 작은 클린하우스 (#78). 충돌은 더미 자리를 정한 뒤에 등록(더미 자리·저장이 바뀌지 않게)
export const CH_MINI = CH ? (spots.cleanMinis || []).map((m) => { const c = createMiniCleanhouse({ scene, height, ...m, low: LOW, trashGeos: trash.geos }); c.id = m.id; c.name = m.name; if (col) { col.addBox(m.x, m.z, m.rot, 2.3, 1.05); } return c; }) : [];
export const CHS = CH ? [CH, ...CH_MINI] : []; // 모든 클린하우스. 버리기·화살표·자동 걷기는 가장 가까운 곳
export const chNear = (p = player.pos) => { let b = null, bd = 1e18; for (const c of CHS) { const d = (c.front.x - p.x) ** 2 + (c.front.z - p.z) ** 2; if (d < bd) { bd = d; b = c; } } return b; };
export const chActs = CHS.map((c) => ({ ch: c, ic: 'dump', label: '버리기', pos: c.front, r: CLEANHOUSE.r, act: () => late.dumpBag(c) }));
// 클린하우스 옆 가판대 (#128): 튜토리얼 동안만 장비점 좌판(집게·배낭 사기). 끝나면 사는 것은 가게 거리 장비점에서
export const shopAct = CH && { ic: 'shop', label: '장비점', pos: CH.shopFront, r: CLEANHOUSE.shopR, when: () => !!late.tut?.active || !GEARB, act: () => late.openShopPop('gear') };
// 깨끗해진 구역에 꽃과 어린 나무 (#46): 풀 색·꽃·나무·나비·새, 다 핀 구역엔 노루가 돌아오고 몹이 나오지 않음
export const bloom = trash ? createBloom({ scene, ns: NSW, trash, height, onPath: (x, z) => surfaceAt(x, z) !== 0, col, low: LOW, ambFly: (z) => ZONE_LOOK.butterflies[z] || 0 }) : null;
export const bfx = bloom ? createBloomFx({ scene, height, tier: () => (LOW ? 0 : quality.level) }) : null; // 치웠을 때·꽃밭 효과 (#65)
// ---------- 마차 (#69): 들머리 ↔ 능선 ↔ 정상 아래. 위치는 시각에서 계산 ----------
export const cart = NS_TUT ? createCart({ scene, height, low: LOW, col }) : null;
state.cartShift = 0; // 확인용: 마차 시각을 앞당김 (__oreum.rides.cart.shift)

// ---------- 러너 ----------
export const runner = buildRunner();
runner.apply(save.outfit);
scene.add(runner.root);
export const rig = rideRig(runner); // 탈것 모양 (#69)
export const player = {
  pos: spots.start.clone(), heading: spots.startHeading, gait: 0, running: false, speed: 0,
  target: null, onArrive: null, pose: 'move', poseT: 0, strideAcc: 0, steps: 0,
  jumpY: 0, jumpV: 0, air: false, driving: false, kb: new THREE.Vector3(), yellowUntil: 0, riding: null,
  ride: null, rideC: false, rideAuto: null, rideClear: 0, cart: null, // 탈것 (#69): ride = 타고 있는 개인 탈것 id, rideC = 스케이트보드를 들고 걸음, cart = 마차 { seat }
  visY: 0, viewSeen: false,
};
player.pos.y = height(player.pos.x, player.pos.z); player.visY = player.pos.y;
// ---------- HP·쓰러짐·들것 귀환 (#36) ----------
export const hp = createHp({ scene, height, buildRunner, outfit: DEFAULT_OUTFIT, save, persist, start: spots.start, startHeading: spots.startHeading, startAt: () => late.wakeAt?.(), enabled: () => state.sessionOn, showBar: () => (state.tension || 0) > 0.02, regenMul: () => buff.mul('regen') * wearV('socks'), maxMul: () => wearV('top'),
  el: { bar: $('hp-bar'), fill: $('hp-fill'), dim: $('hp-dim'), wait: $('hp-wait'), ring: $('hp-ring'), num: $('hp-num') },
  onDown: () => { late.closePanels(); if (player.riding) late.dismountDeer(); if (player.pose === 'sit') late.standUp(); state.emo?.stop(); late.ach.emit('down'); },
  onUp: () => late.tips.event('carried'), // 들것으로 돌아옴 (#66)
});
