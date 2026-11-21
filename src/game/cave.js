// 동굴 탐험 (#195) 1번 조각: 굼부리 바닥 용암 동굴 입구, 별도 동굴 장면 띄우기·내리기, 절차 생성 층(src/cavegen.js), 걷기·카메라·헤드랜턴, 줄(밖으로)·구멍(아래층)
// - 별도 맵: 동굴은 오름 땅 밖 자리(CAVE.x0·z0)에 따로 만든 장면(caveScene). 들어가면 update.js 가 오름 장면 대신 이것만 그림(late.caveFrame)
//   오름 장면의 것은 그리지 않을 뿐 그대로 둠(나올 때 바로 돌아가게). 동굴 층은 나오거나 층을 바꿀 때 지움(dispose)
// - 땅 높이: world.js setCaveGround → height()/groundAt() 이 동굴 자리에서는 동굴 바닥. 벽은 spots.clamp 를 감싸 칸으로 막음
// - 멀티: 서버 이동 판정에는 입구 자리, 동굴 자리는 cx·cz·층 cv·날짜 cd 로 따로 (net.js netCave). 같은 날·층 사람끼리만 보임 (4번 조각)
// - 열림: CAVE.open ('admin' = 개발자 메뉴가 켜진 사람만, true = 레벨·구역 조건, false = 막음)
// dev: __oreum.cave (enter·exit·down·state·stats)
import * as THREE from 'three';
import { CAVE } from '../balance.js';
import { genFloor, caveMesh, caveDots, caveSeed } from '../cavegen.js';
import { kstDate } from '../daily.js';
import { height, setCaveGround } from '../world.js';
import { CRATER } from '../zones.js';
import { netCave } from '../net.js';
import { lvNow } from '../augments.js';
import { state, late } from './state.js';
import { $, save } from './save.js';
import { renderer, scene, camera, spots } from './scene.js';
import { player, runner, hp } from './place.js';
import { cam, followCam } from './camera.js';
import { toast, closePanels } from './hud.js';
import { interactables } from './stores.js';
import { devOn } from './menu.js';
import { isDone } from './zonedone.js';
import { dismountRide, leaveCart } from './ride.js';

state.cave = null;
const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...o });

// ---------- 입구 (오름 굼부리 바닥) ----------
const ENT = (() => { const x = CRATER.x, z = CRATER.z; return new THREE.Vector3(x, height(x, z), z); })();
const entFace = Math.atan2(-ENT.x, -ENT.z); // 입구가 오름 가운데 쪽을 봄
const entFront = new THREE.Vector3(ENT.x + Math.sin(entFace) * 3.2, 0, ENT.z + Math.cos(entFace) * 3.2); entFront.y = height(entFront.x, entFront.z);
{
  const g = new THREE.Group(); g.position.copy(ENT); g.rotation.y = entFace; g.name = 'cave-mouth';
  const rock = [lam('#3f3c3a'), lam('#4a4744'), lam('#34312f')], rg = new THREE.DodecahedronGeometry(1, 0);
  // 현무암 아치: 반원으로 돌을 쌓음
  for (let k = 0; k <= 8; k++) { const a = Math.PI * k / 8, m = new THREE.Mesh(rg, rock[k % 3]); m.position.set(Math.cos(a) * 2.3, Math.sin(a) * 2.2 + 0.2, 0); const s = 0.75 + ((k * 37) % 10) / 22; m.scale.set(s, s * 0.85, s * 1.1); m.rotation.set(k, k * 2, 0); m.castShadow = true; g.add(m); }
  // 굴 안 어둠
  const hole = new THREE.Mesh(new THREE.CircleGeometry(2.05, 14, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#050505', fog: false })); hole.position.set(0, 0.15, -0.25); g.add(hole);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(2.0, 10), new THREE.MeshBasicMaterial({ color: '#0b0b0a' })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.06, -1.2); floor.scale.set(1, 0.6, 1); g.add(floor);
  // 고사리
  const fern = lam('#3d6b2e'), fg = new THREE.ConeGeometry(0.35, 0.9, 5);
  [[-2.9, 0.5], [2.8, 0.7], [-2.2, 1.4], [2.1, 1.5], [3.4, -0.3], [-3.5, -0.2]].forEach(([x, z], i) => { const m = new THREE.Mesh(fg, fern); m.position.set(x, 0.4, z); m.rotation.set(0.5 * (i % 2 ? 1 : -1), i, 0.4); g.add(m); });
  // 찬 김: 옅은 판 둘이 천천히 오르내림 (tickMouth)
  const mist = new THREE.MeshBasicMaterial({ color: '#dfe8ee', transparent: true, opacity: 0.12, depthWrite: false });
  const mg = new THREE.PlaneGeometry(2.6, 1.4); g.userData.mist = [0, 1].map((i) => { const m = new THREE.Mesh(mg, mist); m.position.set(0, 0.8 + i * 0.6, 0.3); g.add(m); return m; });
  scene.add(g); state.caveMouth = g;
}
let mouthT = 0;
function tickMouth(dt) {
  const g = state.caveMouth; if (!g || g.position.distanceTo(player.pos) > 60) return;
  mouthT += dt; g.userData.mist.forEach((m, i) => { m.position.y = 0.8 + i * 0.6 + Math.sin(mouthT * 0.6 + i * 2) * 0.25; m.material.opacity = 0.08 + 0.05 * Math.sin(mouthT * 0.8 + i); });
}

// 들어갈 수 있나: [ok, 못 들어가면 할 말]
export function caveCan() {
  if (CAVE.open === false) return [false, CAVE.lines.locked];
  if (devOn) return [true, ''];
  if (CAVE.open === 'admin') return [false, CAVE.lines.locked];
  if (lvNow(save) < CAVE.minLv || !isDone(CAVE.needZone)) return [false, CAVE.lines.locked];
  return [true, ''];
}
interactables.push({ label: '동굴 들어가기', ic: 'down', pos: ENT, r: CAVE.near + 2.2, when: () => !state.cave && !late.tut?.active, act: () => { const [ok, why] = caveCan(); if (!ok) { toast(why); return; } enterCave(); } });

// ---------- 동굴 장면 ----------
let cs = null, lamp = null, floorG = null;
const ropePos = new THREE.Vector3(), holePos = new THREE.Vector3();
function makeScene() {
  cs = new THREE.Scene(); cs.name = 'cave';
  cs.background = new THREE.Color('#000000');
  cs.fog = new THREE.Fog('#000000', CAVE.fog[0], CAVE.fog[1]);
  cs.add(new THREE.AmbientLight('#8796b8', CAVE.ambient));
  cs.add(new THREE.HemisphereLight('#6d7890', '#2a2622', 0.35));
  lamp = new THREE.PointLight(CAVE.lamp.color, CAVE.lamp.i, CAVE.lamp.r, 1.4); cs.add(lamp);
}
const caveMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
function disposeFloor() {
  if (!floorG) return;
  floorG.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material !== caveMat) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); });
  cs.remove(floorG); floorG = null;
}
function buildFloor(fi) {
  disposeFloor();
  const day = kstDate(), F = genFloor(CAVE, fi, caveSeed(day, fi)); netCave.fi = fi; netCave.day = day; /* 같이 들어가기 (4번 조각): 같은 날·층 사람끼리 */
  const M = caveMesh(F, CAVE), geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(M.pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(M.col, 3)); geo.computeVertexNormals(); geo.computeBoundingSphere();
  const g = new THREE.Group(); g.name = 'cave-floor-' + fi;
  g.add(new THREE.Mesh(geo, caveMat));
  // 발광 이끼·수정 (한 종류에 그리기 한 번)
  const D = caveDots(F, CAVE), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  const moss = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.32, 0), new THREE.MeshBasicMaterial({ color: '#ffffff' }), D.moss.length);
  D.moss.forEach((d, i) => { q.setFromEuler(new THREE.Euler(0, d.a, 0)); s.set(d.s * 1.4, 0.18, d.s); p.set(d.x, d.y + 0.05, d.z); m4.compose(p, q, s); moss.setMatrixAt(i, m4); moss.setColorAt(i, c.set(d.c > 0.5 ? '#2fe0b0' : '#7cf05a').multiplyScalar(0.55)); });
  const crys = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.4, 0), new THREE.MeshBasicMaterial({ color: '#ffffff' }), D.crystal.length);
  D.crystal.forEach((d, i) => { q.setFromEuler(new THREE.Euler(0.3 * (d.c - 0.5), d.a, 0.4 * (d.c - 0.5))); s.set(d.s * 0.7, d.s * 1.9, d.s * 0.7); p.set(d.x, d.y + d.s * 0.5, d.z); m4.compose(p, q, s); crys.setMatrixAt(i, m4); crys.setColorAt(i, c.set(d.c > 0.66 ? '#9b7bff' : d.c > 0.33 ? '#5ad1ff' : '#ff8ad8').multiplyScalar(0.8)); });
  g.add(moss, crys);
  // 줄(밖으로): 첫 방 가운데, 천장 구멍에서 내려온 밧줄과 옅은 빛
  ropePos.set(F.start.x, F.floorY(F.start.x, F.start.z), F.start.z);
  const top = F.ceilY(F.start.x, F.start.z);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, top - ropePos.y + 1, 5), lam('#a07a4a')); rope.position.set(ropePos.x, (top + ropePos.y) / 2, ropePos.z); g.add(rope);
  const knot = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 4, 8), lam('#8a6a40')); knot.rotation.x = Math.PI / 2; knot.position.set(ropePos.x, ropePos.y + 0.08, ropePos.z); g.add(knot);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.8, top - ropePos.y, 10, 1, true), new THREE.MeshBasicMaterial({ color: '#cfe4ff', transparent: true, opacity: fi ? 0.05 : 0.11, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  shaft.position.set(ropePos.x, (top + ropePos.y) / 2, ropePos.z); g.add(shaft);
  // 구멍(아래층으로): 가장 먼 방
  if (F.far && F.far.kind === 'down') {
    holePos.set(F.far.x, F.floorY(F.far.x, F.far.z), F.far.z);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(1.6, 12), new THREE.MeshBasicMaterial({ color: '#000000', fog: false })); hole.rotation.x = -Math.PI / 2; hole.position.set(holePos.x, holePos.y + 0.04, holePos.z); g.add(hole);
    const ring = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.4, 0), lam('#2f2d2b'), 9);
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; m4.compose(p.set(holePos.x + Math.cos(a) * 1.9, holePos.y + 0.15, holePos.z + Math.sin(a) * 1.9), q.setFromEuler(new THREE.Euler(k, k * 2, 0)), s.set(1, 0.7, 1)); ring.setMatrixAt(k, m4); }
    g.add(ring);
  } else holePos.set(1e9, 0, 1e9);
  cs.add(g); floorG = g;
  return { F, tris: M.tris };
}

// ---------- 걷기·땅 ----------
const caveGround = (x, z) => { const c = state.cave; return c && c.F.inside(x, z) ? c.F.floorY(x, z) : null; };
const oClamp = spots.clamp;
spots.clamp = function (x, z) {
  const c = state.cave; if (!c || !c.F.inside(x, z)) return oClamp.call(this, x, z);
  const F = c.F; if (F.walk(x, z)) return null;
  const p = player.pos;
  if (F.walk(x, p.z)) return { x, z: p.z, hit: '' };
  if (F.walk(p.x, z)) return { x: p.x, z, hit: '' };
  return { x: p.x, z: p.z, hit: '' };
};
// 걸을 수 있는 가까운 점 (나선으로 찾기)
function walkNear(F, x, z) {
  if (F.walk(x, z)) return [x, z];
  for (let r = 0.6; r < 12; r += 0.6) for (let a = 0; a < 6.28; a += 0.5) { const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (F.walk(px, pz)) return [px, pz]; }
  return [x, z];
}
function placeAt(F, x, z, face) {
  const [px, pz] = walkNear(F, x, z);
  player.pos.set(px, F.floorY(px, pz), pz); player.visY = player.pos.y; player.prevX = px; player.prevY = player.pos.y; player.prevZ = pz;
  player.heading = face; player.speed = 0; player.target = null; player.onArrive = null; player.kb?.set(0, 0, 0);
  cam.yaw = face + Math.PI;
}

// ---------- 들어가기·나가기 ----------
let busyT = 0;
const info = () => { const m = renderer.info.memory; return { geo: m.geometries, tex: m.textures, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null }; };
const log = { trips: [], ms: [] };
// 장면 바꾸기에 걸린 시간(ms, 어두운 동안 하는 일): 3초 안이 목표
function timed(go) { const t0 = performance.now(); go(); log.lastMs = Math.round(performance.now() - t0); log.ms.push(log.lastMs); if (log.ms.length > 20) log.ms.shift(); }
function fade(text, mid) {
  const el = $('fade-go'), T = CAVE.fade;
  el.querySelector('svg').innerHTML = ''; el.querySelector('span').textContent = text;
  el.style.setProperty('--ft', T + 's'); el.hidden = false; void el.offsetWidth; el.classList.add('on');
  busyT = T * 2 + CAVE.hold + 0.2;
  setTimeout(() => { try { mid(); } finally { el.classList.remove('on'); } }, (T + CAVE.hold) * 1000);
  setTimeout(() => { el.hidden = true; }, (T * 2 + CAVE.hold) * 1000 + 60);
}
function leaveOreumThings() {
  closePanels(); if (player.ride) dismountRide(); if (player.cart) leaveCart(false); if (player.riding) late.dismountDeer?.(); if (player.pose === 'sit') late.standUp?.();
  late.stopAutoGo?.(); late.stopSeek?.(); player.target = null; player.onArrive = null;
}
export function enterCave(now = false) {
  if (state.cave || busyT > 0) return false;
  leaveOreumThings();
  const go = () => {
    const before = info();
    if (!cs) makeScene();
    const back = { x: entFront.x, z: entFront.z, yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist };
    state.cave = { fi: 0, F: null, back, t: 0, before };
    const b = buildFloor(0); state.cave.F = b.F; state.cave.tris = b.tris;
    setCaveGround(caveGround); netCave.at = { x: entFront.x, z: entFront.z }; netCave.scene = cs;
    cs.add(runner.root);
    placeAt(b.F, b.F.start.x + 2.2, b.F.start.z, 0);
    cam.dist = CAVE.cam.dist; cam.pitch = CAVE.cam.pitch; followCam(0, true);
    late.caveIn?.(cs); late.caveFloor?.(b.F, 0); /* 2번 조각 (cavelife.js): 적·불빛 장면 옮기기, 이 층 더미·적 */
    state.cave.after = info();
    toast(CAVE.lines.enter + ' 1층');
  };
  if (now) timed(go); else fade(CAVE.lines.enter, () => timed(go));
  return true;
}
export function caveDown(now = false) {
  const c = state.cave; if (!c || busyT > 0 || c.fi >= CAVE.floors - 1) return false;
  const go = () => { late.caveFloorOff?.(); c.fi++; const b = buildFloor(c.fi); c.F = b.F; c.tris = b.tris; placeAt(b.F, b.F.start.x + 2.2, b.F.start.z, 0); followCam(0, true); late.caveFloor?.(b.F, c.fi); toast(`${CAVE.lines.enter} ${c.fi + 1}층`); };
  if (now) timed(go); else fade(CAVE.lines.down, () => timed(go));
  return true;
}
export function exitCave(now = false) {
  const c = state.cave; if (!c || (busyT > 0 && !now)) return false;
  const go = () => {
    late.caveOut?.(hp.isDown || hp.pending); /* 2번 조각: 들고 나온 쓰레기·쓰러지면 절반 잃음, 적 지우기, 장면 되돌리기 */
    disposeFloor();
    scene.add(runner.root);
    setCaveGround(null); netCave.at = null; netCave.scene = null; state.cave = null;
    player.pos.set(c.back.x, height(c.back.x, c.back.z), c.back.z); player.visY = player.pos.y; player.prevX = c.back.x; player.prevY = player.pos.y; player.prevZ = c.back.z;
    player.heading = entFace; player.speed = 0; player.target = null;
    cam.yaw = c.back.yaw; cam.pitch = c.back.pitch; cam.dist = c.back.dist; followCam(0, true);
    log.trips.push({ before: c.before, inside: c.after, after: info(), sec: Math.round(c.t) });
    if (!hp.isDown) toast(CAVE.lines.out);
  };
  if (now) timed(go); else fade(CAVE.lines.out, () => timed(go));
  return true;
}
interactables.push({ label: '밖으로 나가기', ic: 'steps', pos: ropePos, r: CAVE.near, when: () => !!state.cave, act: () => exitCave() });
interactables.push({ label: '더 내려가기', ic: 'down', pos: holePos, r: CAVE.near + 0.6, when: () => !!state.cave && state.cave.fi < CAVE.floors - 1, act: () => { if (late.caveGuard?.()) { toast(CAVE.lines2.guard); return; } caveDown(); } });
// 줍기 버튼: 동굴 안에서는 동굴 쓰레기 더미 (cavelife.js late.cavePick). 오름 쓰레기로 걸어가지 않게
{ const pp = late.pressPick; late.pressPick = (...a) => (state.cave ? late.cavePick?.() : pp(...a)); }

// ---------- 매 프레임 (동굴 안: update.js 가 오름 장면 대신 부름) ----------
const L = new THREE.Vector3(), Cp = new THREE.Vector3(), fwd = new THREE.Vector3();
function caveFrame(dt) {
  const c = state.cave, F = c.F; c.t += dt;
  // 쓰러지면 바로 밖으로 (든 동굴 쓰레기 절반을 잃음: cavelife.js caveOut)
  if (hp.isDown || hp.pending) { exitCave(true); renderer.render(scene, camera); return; }
  // 오름 쪽으로 걷게 하는 것(자동 걷기·퀘스트 길 안내 등)은 끔
  if (player.target && !F.inside(player.target.x, player.target.z)) { player.target = null; player.onArrive = null; late.stopAutoGo?.(); }
  // 카메라: 가깝게, 벽·천장을 뚫지 않게 (플레이어 머리에서 카메라 쪽으로 걸어 보며 막히는 곳 앞에서 멈춤)
  if (cam.dist > CAVE.cam.max) cam.dist = CAVE.cam.max;
  if (cam.mode === 'follow') {
    L.set(player.pos.x, player.visY + 1.5, player.pos.z); Cp.copy(cam.pos);
    let safe = 1; const n = 16;
    for (let k = 1; k <= n; k++) { const t = k / n, x = L.x + (Cp.x - L.x) * t, z = L.z + (Cp.z - L.z) * t, y = L.y + (Cp.y - L.y) * t; if (!F.open(x, z) || y > F.ceilY(x, z) - 0.4 || y < F.floorY(x, z) + 0.3) { safe = Math.max(0.1, (k - 1.5) / n); break; } }
    if (safe < 1) { cam.pos.lerpVectors(L, Cp, safe); camera.position.copy(cam.pos); camera.lookAt(cam.look); }
  }
  // 헤드랜턴: 머리 앞 조금 위
  fwd.set(Math.sin(player.heading), 0, Math.cos(player.heading));
  lamp.position.set(player.pos.x + fwd.x * 1.2, player.visY + 2.0, player.pos.z + fwd.z * 1.2);
  // 수정이 천천히 깜빡임
  const fc = floorG?.children[2]; if (fc) fc.material.color.setScalar(0.85 + 0.15 * Math.sin(c.t * 2.2));
  late.caveTick?.(dt, F); /* 더미·적·지킴이 (cavelife.js) */
  late.caveDraw?.(true); renderer.render(cs, camera); late.caveDraw?.(false);
}
function tickCave(dt) { if (busyT > 0) busyT -= dt; tickMouth(dt); }
// 동굴 바닥 누르기 (input.js tapGround): 광선을 따라 걸으며 바닥 아래로 들어가는 첫 점
function caveRay(ray) {
  const c = state.cave; if (!c) return null; const F = c.F, o = ray.ray.origin, d = ray.ray.direction;
  for (let t = 0.5; t < 30; t += 0.25) { const x = o.x + d.x * t, z = o.z + d.z * t, y = o.y + d.y * t; if (!F.open(x, z)) return null; if (y <= F.floorY(x, z)) return { point: new THREE.Vector3(x, F.floorY(x, z), z) }; }
  return null;
}
Object.assign(late, { caveFrame, caveRay, tickCave });
// 매 프레임 (오름·동굴 모두): busy 시간·입구 김. update.js 를 건드리지 않게 requestAnimationFrame 하나로
{ let last = performance.now(); const loop = (t) => { requestAnimationFrame(loop); const dt = Math.min(0.05, (t - last) / 1000); last = t; try { tickCave(dt); } catch (e) { /* 다음 프레임 */ } }; requestAnimationFrame(loop); }

// ---------- 확인용 (__oreum.cave) ----------
late.caveApi = {
  enter: () => enterCave(true), exit: () => exitCave(true), down: () => caveDown(true), can: caveCan, ent: () => ({ x: +ENT.x.toFixed(1), z: +ENT.z.toFixed(1), fx: +entFront.x.toFixed(1), fz: +entFront.z.toFixed(1) }),
  goEnt: () => { player.pos.copy(entFront); player.visY = player.pos.y; player.heading = entFace + Math.PI; },
  state: () => { const c = state.cave; return c && { fi: c.fi, rooms: c.F.rooms.length, branch: c.F.branch, cells: c.F.floorCells, tris: c.tris, x: +player.pos.x.toFixed(1), z: +player.pos.z.toFixed(1), y: +player.pos.y.toFixed(2), walk: c.F.walk(player.pos.x, player.pos.z), rope: { x: ropePos.x, z: ropePos.z }, hole: c.F.far?.kind === 'down' ? { x: holePos.x, z: holePos.z } : null, far: c.F.far, t: +c.t.toFixed(1) }; },
  stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, ...info(), lastMs: log.lastMs, ms: log.ms, trips: log.trips }),
  scene: () => cs, gen: (fi = 0, day = kstDate()) => genFloor(CAVE, fi, caveSeed(day, fi)),
};
