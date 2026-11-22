// 구역 완료 (#139, notes/growth-loop.md 7-1절): 구역 완료 요약 한 장 · 깨어나는 곳·다시 들어올 때 고르기 · 빠른 마차·지름길 · 구역 기록. 우두머리는 boss.js
// - 구역 완료 = 그 구역 우두머리를 쫓아냄 (save.boss.done). 요약: 치운 수·쫓아낸 수(save.boss.log, 우두머리가 끝나면 지움)·얻은 것·장비 점수 변화·다음 구역 권장 점수
// - 쓰러지면 마지막으로 지난(30m 안) 구역 클린하우스에서 깨어남 (hp.js startAt → late.wakeAt). 들머리·가게 거리로 내려오면 들머리
// - 다시 들어온 사람: 그 클린하우스에서 시작할지 들머리에서 시작할지 (start.js → late.afterEnter)
// - 구역을 한 번 끝낸 사람: 구역 클린하우스 옆 '빠른 마차'(가게 거리까지 기다림 없이), 구역 들어오는 곳 옆 '지름길'(구역 위쪽 끝, 다음 구역 문턱 앞)
//   (지금은 화면이 어두워졌다 밝아지는 임시 연출. 길·마차 모양은 나중에. 순간 이동이 서버 warpGap 에 걸리지 않게 12초에 한 번)
// 저장 save.boss = { done: {구역: 끝낸 수}, beat: {구역: 쫓아낸 ms}, log: {구역: {pick, repel, s0}}, wake: 구역, mats: {재료 이름: 수} }
// (파일 순서는 src/modules.js: pace 뒤, boss 앞. 적 후크(hooks.js)를 감쌈)
import * as THREE from 'three';
import { ZONE_BOSS as B, ZONES, CART } from '../balance.js';
import { parkedFastCart } from '../rides.js';
import { STREET } from '../streetlayout.js';
import { gradHard } from '../toon.js';
import { gearScore, myLv, zoneToneLv, zoneRecLv } from '../gearscore.js';
import { tierColor, zoneShort, josaEulReul } from '../zonelook.js';
import { height } from '../world.js';
import { state, late } from './state.js';
import { $, save, persist } from './save.js';
import { scene, quality } from './scene.js';
import { trash, player, life, hp, col } from './place.js';
import { toast, closePanels } from './hud.js';
import { interactables } from './stores.js';
import { field } from './field.js';
import { cam } from './camera.js';
import { dismountRide, leaveCart } from './ride.js';
import { ic, icon } from '../icons.js';

export const ON = !!(trash && field && field.bosses?.length);
const LOOP = (z) => field?.loops?.[z] || null;
const lite = () => quality.level === 0;
const nowS = () => performance.now() / 1000;

/* ---------- 저장 ---------- */
export const S = (() => {
  const o = save.boss = (save.boss && typeof save.boss === 'object' && !Array.isArray(save.boss)) ? save.boss : {};
  for (const k of ['done', 'beat', 'log', 'mats']) if (!o[k] || typeof o[k] !== 'object' || Array.isArray(o[k])) o[k] = {};
  for (const k in o.done) if (!(o.done[k] > 0) || !B.list[k]) delete o.done[k];
  for (const k in o.beat) if (!(Number(o.beat[k]) > 0) || !B.list[k]) delete o.beat[k];
  for (const k in o.log) { const l = o.log[k]; if (!B.list[k] || !l || typeof l !== 'object') delete o.log[k]; else { l.pick = l.pick | 0; l.repel = l.repel | 0; l.s0 = Number(l.s0) || 0; l.l0 = Number(l.l0) || 0; } }
  for (const k in o.mats) if (!(o.mats[k] > 0)) delete o.mats[k];
  if (!(o.wake >= 1 && o.wake <= 5 && LOOP(o.wake)?.ch)) o.wake = 0;
  return o;
})();
export const isDone = (z) => (S.done[z] || 0) > 0;
export function logOf(z) { return S.log[z] || (S.log[z] = { pick: 0, repel: 0, s0: gearScore(save).total, l0: myLv(save) }); /* l0 시작 레벨 (#251, 옛 기록엔 없음) */ }

/* ---------- 구역 완료 요약 ---------- */
const IC = {
  pick: icon('bag'),
  repel: icon('gyul-throw'),
  got: icon('chest'),
  score: icon('stand'),
};
const TONE_C = { r: '#ff5a4a', y: '#ffd23f', g: '#8fe36a' };
export function openSummary(z, got) {
  const el = $('zdone'), D = B.list[z], lv = myLv(save), l0 = got.l0 || got.log?.l0 || lv, d = lv - l0;
  el.style.setProperty('--tier', tierColor(z));
  $('zdone-t').textContent = `${zoneShort(z)} 구역 완료`;
  $('zdone-rows').innerHTML = [
    [IC.pick, '치운 쓰레기', `${got.log.pick}개`],
    [IC.repel, '쫓아낸 적', `${got.log.repel}마리`],
    [IC.got, '얻은 것', `귤 ${got.gyul} · ${D.mat}`],
    [IC.score, '레벨', d > 0 ? `Lv ${l0} → ${lv} <b class="up">▲${d}</b>` : `Lv ${lv}`],
  ].map(([ic, k, v]) => `<div>${ic}<span>${k}</span><b>${v}</b></div>`).join('');
  const open = []; if (got.first) { if (fastSpot(z)) open.push('빠른 마차 열림'); if (cutSpot(z)) open.push('지름길 열림'); }
  $('zdone-open').innerHTML = open.map((t) => `<span>${t}</span>`).join(''); $('zdone-open').hidden = !open.length;
  const nz = z + 1, Z = ZONES.find((q) => q.id === nz);
  $('zdone-next').innerHTML = Z ? `<span class="tone" style="background:${TONE_C[zoneToneLv(save, nz)] || '#fff'}"></span>다음은 ${zoneShort(nz)} · 권장 Lv ${zoneRecLv(nz)}` : '정상까지 다 지켰어요! 다른 구역도 다시 둘러봐요';
  closePanels(); el.hidden = false;
}
for (const id of ['zdone-close', 'zdone-ok']) $(id).addEventListener('click', () => { $('zdone').hidden = true; });

/* ---------- 깨어나는 곳·다시 들어올 때 ---------- */
// 구역 클린하우스: 지나간(30m 안) 마지막 구역. 쓰러지면 그곳에서 깨어남
export function chSpot(z) {
  const L = LOOP(z); if (!L?.ch) return null;
  let q = null, bd = 1e9; for (const p of L.all) { const d = Math.hypot(p.x - L.ch.x, p.z - L.ch.z); if (d < bd) { bd = d; q = p; } }
  const h = q ? Math.atan2(q.x - L.ch.x, q.z - L.ch.z) : 0;
  return { x: L.ch.x + Math.sin(h) * 1.6, z: L.ch.z + Math.cos(h) * 1.6, h };
}
const wakeOk = (z) => { const L = LOOP(z); return !!L?.ch && trash.zoneAt(L.ch.x, L.ch.z) !== 0; }; // 들머리 클린하우스가 가장 가까운 구역은 들머리 그대로
late.wakeAt = () => (S.wake && wakeOk(S.wake) ? chSpot(S.wake) : null);
let wakeT = 0;
function tickWake(dt) {
  if ((wakeT -= dt) > 0) return; wakeT = 0.5;
  if (!state.sessionOn || late.tut?.active || hp.isDown || !$('wake-pick').hidden) return;
  for (let z = 1; z <= 5; z++) { if (z !== S.wake && wakeOk(z) && Math.hypot(player.pos.x - LOOP(z).ch.x, player.pos.z - LOOP(z).ch.z) < 30) { S.wake = z; persist(); } }
  if (S.wake && trash.zoneAt(player.pos.x, player.pos.z) === 0) { S.wake = 0; persist(); } // 들머리·가게 거리로 내려오면 들머리에서
}
let wakePick = null; // 고르는 창을 띄울 때 정한 자리 (창이 떠 있는 동안 들머리에 있어도 그대로)
late.afterEnter = () => {
  const s = late.wakeAt(); if (!ON || !s || !save.tut?.done) return;
  wakePick = { s, z: S.wake }; $('wake-ch').textContent = `${zoneShort(S.wake)} 클린하우스`;
  closePanels(); $('wake-pick').hidden = false;
};
$('wake-ch').addEventListener('click', () => { $('wake-pick').hidden = true; const w = wakePick; wakePick = null; if (w) { S.wake = w.z; persist(); travel(w.s, 'steps', `${zoneShort(w.z)} 클린하우스로`, B.shortcut); } });
$('wake-start').addEventListener('click', () => { $('wake-pick').hidden = true; wakePick = null; });

/* ---------- 빠른 마차·지름길 (구역 완료로 열림) ---------- */
const FADE_IC = {
  cart: ic('cart'),
  steps: ic('steps'),
};
let travelT = 0, lastWarp = -1e9;
export function warp(s) {
  player.pos.set(s.x, height(s.x, s.z), s.z); player.visY = player.pos.y; player.prevX = s.x; player.prevY = player.pos.y; player.prevZ = s.z;
  player.heading = s.h; cam.yaw = s.h + Math.PI; player.target = null; player.onArrive = null; player.speed = 0; player.kb?.set(0, 0, 0);
  late.placeRunner?.(); late.net?.send?.(true); lastWarp = nowS();
}
// 화면이 어두워졌다 그곳에서 밝아짐 (순간 이동이 서버 warpGap 에 걸리지 않게 12초에 한 번)
function travel(s, ic, text, F) {
  if (travelT > 0) return false;
  if (nowS() - lastWarp < 12) { toast('조금 뒤에 다시 해 봐요'); return false; }
  closePanels(); if (player.ride) dismountRide(); if (player.cart) leaveCart(false); if (player.riding) late.dismountDeer?.(); if (player.pose === 'sit') late.standUp?.();
  const el = $('fade-go'); el.querySelector('svg').innerHTML = FADE_IC[ic] || ''; el.querySelector('span').textContent = text;
  el.style.setProperty('--ft', F.fade + 's'); el.hidden = false; void el.offsetWidth; el.classList.add('on');
  travelT = F.fade * 2 + F.hold;
  if (late.sound?.ctx) late.sound[ic === 'cart' ? 'horseBell' : 'step']?.('stone', false); // 소리 장치를 아직 안 켰으면 조용히
  setTimeout(() => { warp(s); el.classList.remove('on'); }, (F.fade + F.hold) * 1000);
  setTimeout(() => { el.hidden = true; }, (F.fade * 2 + F.hold) * 1000 + 50);
  return true;
}
// 빠른 마차 정류장: 구역 클린하우스에서 가까운 길가. 클린하우스 앞('버리기')과 겹치지 않게 FAST_GAP m 넘게 떨어진 길 점의, 클린하우스 반대쪽 길가
const FAST_GAP = 11;
const fastCache = new Map();
export function fastSpot(z) {
  if (fastCache.has(z)) return fastCache.get(z);
  const L = LOOP(z); let out = null;
  if (L?.ch && STREET && wakeOk(z)) {
    let q = null, bd = 1e9; for (const p of L.all) { const d = Math.hypot(p.x - L.ch.x, p.z - L.ch.z); if (d >= FAST_GAP && d < bd) { bd = d; q = p; } }
    if (q && bd < 70) for (const sd of [-1, 1]) {
      const s0 = Math.sign((L.ch.x - q.x) * -q.dz + (L.ch.z - q.z) * q.dx) || 1, k = -s0 * sd, x = q.x - q.dz * k * 3.2, zz = q.z + q.dx * k * 3.2;
      if (Math.hypot(x - L.ch.x, zz - L.ch.z) < FAST_GAP - 1 || !trash.ok(x, zz) || col?.blocked?.(x, zz, 0.5)) continue;
      out = { x, z: zz, y: height(x, zz), rot: Math.atan2(q.x - x, q.z - zz) }; break;
    }
  }
  fastCache.set(z, out); return out;
}
// 지름길: 구역에 들어오는 곳 옆 → 구역 위쪽 끝(다음 구역 문턱 앞). 길이 구역 안으로 안 들어가는 굼부리·마지막 정상은 없음
// 들어오는 곳: 아래 구역(길이 들어가는 가장 가까운 아래 구역) 길과 가장 가까운 이 구역 길 점, 없으면 가장 낮은 점. 마지막 구역(정상)과 짧은 구역은 없음
function entryOf(z) {
  const L = LOOP(z); let prev = null; for (let k = z - 1; k >= 1 && !prev; k--) { const P = LOOP(k); if (P && !P.edge) prev = P; }
  if (!prev) return L.entry;
  let q = null, bd = 1e18; for (const a of L.all) for (const b of prev.all) { const d = (a.x - b.x) ** 2 + (a.z - b.z) ** 2; if (d < bd) { bd = d; q = a; } }
  return q || L.entry;
}
export function cutSpot(z) {
  const L = LOOP(z); if (!L || L.edge || !L.exit || !ZONES.find((Q) => Q.id === z + 1)) return null;
  const q = entryOf(z), off = B.shortcut.off; if (!q || Math.hypot(q.x - L.exit.x, q.z - L.exit.z) < 60) return null;
  for (const sd of [1, -1]) { const x = q.x - q.dz * sd * off, zz = q.z + q.dx * sd * off; if (trash.ok(x, zz) && !col?.blocked?.(x, zz, 0.6)) return { x, z: zz, y: height(x, zz), rot: Math.atan2(q.dx, q.dz), to: { x: L.exit.x - L.exit.dx * 2, z: L.exit.z - L.exit.dz * 2, h: Math.atan2(L.exit.dx, L.exit.dz) } }; }
  return null;
}
const streetIn = () => { const p = STREET.P(5, 0); return { x: p.x, z: p.z, h: Math.atan2(STREET.ax, STREET.az) }; };
// 모양: 정류장 팻말(기둥 + 판 + 귤빛 띠) · 돌계단(납작한 돌 셋)
const signMat = new THREE.MeshToonMaterial({ color: '#ffffff', vertexColors: true, gradientMap: gradHard });
function colored(g, c) { const n = g.attributes.position.count, a = new Float32Array(n * 3), cc = new THREE.Color(c); for (let i = 0; i < n; i++) { a[i * 3] = cc.r; a[i * 3 + 1] = cc.g; a[i * 3 + 2] = cc.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g.toNonIndexed(); }
function merge(list) { const pos = [], nor = [], colr = []; for (const g of list) { pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); colr.push(...g.attributes.color.array); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); return g; }
const signGeo = merge([colored(new THREE.BoxGeometry(0.16, 2.2, 0.16).translate(0, 1.1, 0), '#7a5a3a'), colored(new THREE.BoxGeometry(1.5, 0.7, 0.1).translate(0, 2.0, 0), '#efe2c4'), colored(new THREE.BoxGeometry(1.5, 0.14, 0.12).translate(0, 1.62, 0), '#ff9a1f'), colored(new THREE.BoxGeometry(0.5, 0.26, 0.12).translate(-0.25, 2.02, 0.02), '#6b4a2a'), colored(new THREE.CylinderGeometry(0.11, 0.11, 0.13, 8).rotateX(Math.PI / 2).translate(-0.38, 1.86, 0.02), '#3b3a33'), colored(new THREE.CylinderGeometry(0.11, 0.11, 0.13, 8).rotateX(Math.PI / 2).translate(-0.1, 1.86, 0.02), '#3b3a33')]);
const stepGeo = merge([0, 1, 2].map((i) => colored(new THREE.BoxGeometry(1.6 - i * 0.25, 0.22, 1.1 - i * 0.2).translate(0, 0.11 + i * 0.22, i * 0.25), i % 2 ? '#8a8a86' : '#6f706c')));
const exits = [];
if (ON) for (let z = 1; z <= 5; z++) {
  const f = fastSpot(z);
  if (f) { const m = new THREE.Mesh(signGeo, signMat); m.position.set(f.x, f.y, f.z); m.rotation.y = f.rot; m.visible = false; m.castShadow = !lite(); scene.add(m);
    { // 세워 둔 빠른 마차 (#174): 팻말 뒤 길가에 말 둘 + 깃발. 부딪힘은 마차와 같은 원들
      const cg = parkedFastCart(lite()), bz = -B.fast.park; cg.position.set(0, 0, bz); m.add(cg);
      m.updateMatrixWorld(true); const v = new THREE.Vector3();
      if (col) CART.block.forEach(([lx, lz, r]) => { v.set(lx, 0, bz + lz).applyMatrix4(m.matrixWorld); col.add(v.x, v.z, r * 0.9); }); }
    const pos = new THREE.Vector3(f.x, f.y, f.z); exits.push({ m, z });
    interactables.push({ label: '빠른 마차', ic: 'cart', pos, r: B.fast.r, when: () => isDone(z) && !late.bossFight?.(), act: () => { if (travel(streetIn(), 'cart', '빠른 마차를 타고 가게 거리로', B.fast)) setTimeout(() => toast('가게 거리에 왔어요'), (B.fast.fade + B.fast.hold) * 1000 + 300); } }); }
  const c = cutSpot(z);
  if (c) { const m = new THREE.Mesh(stepGeo, signMat); m.position.set(c.x, c.y - 0.05, c.z); m.rotation.y = c.rot; m.visible = false; scene.add(m);
    const pos = new THREE.Vector3(c.x, c.y, c.z); exits.push({ m, z });
    interactables.push({ label: '지름길', ic: 'steps', pos, r: B.shortcut.r, when: () => isDone(z) && !late.bossFight?.(), act: () => { if (travel(c.to, 'steps', `지름길로 ${zoneShort(z)} 위쪽까지`, B.shortcut)) setTimeout(() => toast(`지름길로 ${zoneShort(z)}${josaEulReul(zoneShort(z))} 건너뛰었어요`), (B.shortcut.fade + B.shortcut.hold) * 1000 + 300); } }); }
}
let exitT = 0;
function tickExits(dt) { if ((exitT -= dt) > 0) return; exitT = 1; for (const x of exits) x.m.visible = isDone(x.z) && Math.hypot(x.m.position.x - player.pos.x, x.m.position.z - player.pos.z) < 160; }

/* ---------- 구역 기록 (요약용): 줍기·쫓아내기 ---------- */
let logDirty = false;
if (ON) {
  trash.on((ev) => { if (ev !== 'trash' || !state.sessionOn || late.tut?.active) return; const z = trash.zoneAt(player.pos.x, player.pos.z); if (B.list[z]) { logOf(z).pick++; logDirty = true; } });
  const prev = life.hooks.enemyRepel;
  life.hooks.enemyRepel = (kind, pos, def, e) => { prev?.(kind, pos, def, e); const z = trash.zoneAt(pos.x, pos.z); if (B.list[z]) { logOf(z).repel++; logDirty = true; } };
}

/* ---------- 매 프레임 (boss.js 가 부름) ---------- */
let logT = 0;
export function tickZoneDone(dt) {
  if (!ON) return;
  if (travelT > 0) travelT -= dt;
  tickWake(dt); tickExits(dt);
  if ((logT -= dt) <= 0) { logT = 5; if (logDirty) { logDirty = false; persist(); } }
}
export const zoneDoneTest = { streetIn, entryOf, exitsShown: () => exits.filter((x) => x.m.visible).map((x) => x.z), setExitT: (v) => { exitT = v; }, resetWarp: () => { lastWarp = -1e9; } };
