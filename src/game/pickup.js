// 줍기·배낭, 구역 확인, 더미·꽃밭 효과 (#86 에서 main.js 를 나눔. 파일 순서는 src/main.js, 규칙은 notes/prototype-v1.md 코드 구조)
import { gearScore, zoneTone, zoneRec } from '../gearscore.js';
import { upMul, legendOn } from '../loot.js';
import { LOOT } from '../balance.js';
import { TOOLS, BAGS, POCKET, CLEANHOUSE, BLOOM, BLOOM_FX, SHOP_ST, PACE, PICK_SEEK, TUT, BLOOM_HOLD } from '../balance.js';
import { STREET } from '../streetlayout.js';
import { ZONE_IDS } from '../zones.js';
import * as THREE from 'three';
import { groundAt } from '../world.js';
import { drape } from '../drape.js';
import { state, late } from './state.js';
import { $, save, wearV, lookS, ab, persist } from './save.js';
import { augV } from '../augments.js';
import { scene, wx, spots, sunEvent } from './scene.js';
import { life, street, buff, trash, CH, CH_MINI, bloom, bfx, player, hp } from './place.js';
import { cam, followCam } from './camera.js';
import { topFit, toast, pickMsg, tips, updateStats, panelOpen, busy, ach, onDexGet } from './hud.js';
import { keys, marker, setTarget, joy } from './input.js';
import { setHoldBow } from './throw.js';
import { icon } from '../icons.js';

Object.assign(late, { startPick, pressPick }); // 앞 파일에서 부르는 함수

// ---------- 줍기·배낭 ----------
export const pickS = { held: false, cyc: -1, got: false, fullT: 0, combo: 0, comboAt: -1e9 }; late.pickS = pickS;
export const toolNow = () => { const t = TOOLS[save.equip.tool - 1], k = buff.mul('pick') * upMul(save, 'tool'), rk = legendOn(save, 'reach') ? LOOT.fx.reach.k : 1; return k === 1 && rk === 1 ? t : { ...t, time: t.time / k, r: t.r * rk }; }; // 식사 버프(#50) 줍는 속도, 장비 등급·강화·전설 줍는 거리 (#140)
export const bagCap = () => Math.floor((save.equip.bag ? BAGS[save.equip.bag - 1] : POCKET).cap * buff.mul('bag') * upMul(save, 'bag')) + wearV('bottom'); // 식사 버프(#50) 배낭 용량, 바지 주머니(#52)
export const bagRoom = () => (trash ? bagCap() - trash.bagVol() : 0); late.bagRoom = bagRoom;
export const canPick = () => !!trash && !player.riding && !player.ride && !player.cart && !player.air && trash.any(player.pos.x, player.pos.z, toolNow().r, bagRoom()); // 튜토리얼 귤은 #151 부터 지나가면 모임 (tutorial.js)
const trashFull = () => !!trash && bagRoom() < 1 && trash.any(player.pos.x, player.pos.z, toolNow().r, 99);
function fullToast(force) { if (!force && performance.now() - pickS.fullT < 4000) return; pickS.fullT = performance.now(); const w = save.equip.bag ? '배낭이' : '호주머니가'; toast(CH ? `${w} 가득 찼어요 · 가까운 클린하우스에 버려요` : `${w} 가득 찼어요`); }
const pickBlocked = () => panelOpen() || cam.mode === 'wardrobe' || lookS.open || ['sit', 'photo', 'photo-wait'].includes(player.pose) || player.riding || player.ride || player.cart || player.air || !!player.rescue || hp.isDown || hp.pending;
// 꽃 피는 동안 잠깐 멈춤 (#110): 더미·구역 마지막 쓰레기를 주워 꽃 연출이 시작되면 BLOOM_HOLD 초 동안 자동 이어가기를 쉼.
// 직접 움직이거나(조이스틱·방향키·땅 탭), 적이 가깝거나 맞는 중이면 바로 풀림
const bloomHold = { t: 0, x: 0, z: 0 };
function holdBloom(sec, x, z) { if (sec > bloomHold.t) bloomHold.t = sec; bloomHold.x = x; bloomHold.z = z; if (cam.mode === 'follow') state.camPullT = 0; }
function bloomHolding() {
  if (bloomHold.t <= 0) return false;
  const moved = joy.active || ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].some((k) => keys.has(k)) || !!player.target || !!player.knock || (life.enemies.near(player.pos, 25) || (!!late.dumpers && late.dumpers.list.some((d) => Math.hypot(d.pos.x - player.pos.x, d.pos.z - player.pos.z) < 25)));
  if (moved) { bloomHold.t = 0; return false; }
  return true;
}
function tickBloomHold(dt) {
  if (bloomHold.t <= 0) return;
  if (!bloomHolding()) return;
  bloomHold.t -= dt;
  if (!seekS.on && pickS.cyc < 0 && !player.air) player.heading = Math.atan2(bloomHold.x - player.pos.x, bloomHold.z - player.pos.z) || player.heading; // 꽃 쪽을 바라봄
}
export function startPick() {
  if (!trash || pickS.cyc >= 0 || pickBlocked()) return;
  stopSeek();
  const list = trash.candidates(player.pos.x, player.pos.z, toolNow().r, bagRoom());
  if (!list.length) { if (trashFull()) fullToast(); return; }
  const c = list[0];
  player.target = null; player.onArrive = null; marker.visible = false;
  player.heading = Math.atan2(c.x - player.pos.x, c.z - player.pos.z) || player.heading;
  player.pose = 'crouch'; player.poseT = 0; player.speed = 0; setHoldBow(false); // 줍기는 도구로 (#38)
  pickS.cyc = 0; pickS.got = false;
}
function takeNow() {
  const tool = toolNow(); let room = bagRoom(), n = 0;
  // 더미는 한 곳에서 도구의 한 번 양(per)만큼 꺼냄 (#45). 튜토리얼 낱개는 하나씩
  for (const c of trash.candidates(player.pos.x, player.pos.z, tool.r, room)) {
    while (n < tool.per && room >= 1) {
      const it = trash.take(c, room); if (!it) break;
      room -= it.type.vol; n++; flyToBag(it); late.sound.pick?.(it.type.id); pickMsg(it.type.name);
      if (c.h == null) break;
      if (room >= 1 && Math.random() < augV(save, 'bighand')) { const it2 = trash.take(c, room); if (it2) { room -= it2.type.vol; flyToBag(it2); late.sound.pick?.(it2.type.id); } } // 큰손 (#159): 하나 더 (도구 한 번 양에 안 셈)
    }
    if (n >= tool.per || room < 1) break;
  }
  if (n) { trash.store.commit(); updateTrashUI(true); late.tut.notify('trash', n); const now = performance.now() / 1000; pickS.combo = now - pickS.comboAt < PACE.combo.gap ? Math.min(PACE.combo.max, pickS.combo + 1) : 0; pickS.comboAt = now; late.sound.combo?.(pickS.combo); } // 이어 주우면 음이 올라감 (#89)
  if (bagRoom() < 1) { late.sound.full?.(); fullToast(); }
}
export function tickPick(dt) {
  if (!trash) return;
  tickBloomHold(dt); tickLook(dt); tickSeek(); tickPickMark(performance.now() / 1000);
  const holding = (pickS.held || keys.has('e')) && !bloomHolding();
  if (pickS.cyc < 0) {
    if (holding && state.holdBow && !pickBlocked()) setHoldBow(false); // 줍기를 누르면 활을 내리고 도구를 듦 (#38)
    if (holding && !pickBlocked() && player.pose !== 'crouch') { if (canPick()) startPick(); else if (trashFull()) fullToast(); }
    return;
  }
  const tool = toolNow(); pickS.cyc += dt;
  if (!pickS.got && pickS.cyc >= tool.time * 0.5) { pickS.got = true; takeNow(); }
  if (pickS.cyc >= tool.time) {
    pickS.cyc = -1;
    if (player.pose === 'crouch') player.pose = 'move';
    if (holding && canPick()) startPick();
    else if (holding && !pickBlocked()) startSeek(true); // 누르고 있으면 다음 가까운 것으로 이어서 감 (#104)
  }
}
// ---------- 줍기 버튼: 가까운 쓰레기로 걸어가서 줍기 (#104) ----------
// 범위 안에 있으면 바로 줍고, 없으면 PICK_SEEK.range 안 가장 가까운 쓰레기(낱개·더미, 튜토리얼 귤 단계면 귤)로 걸어가 도착하면 바로 주움.
// 길·충돌은 클린하우스 자동 걷기(#40, autowalk.js)와 같음. 조이스틱·방향키·땅 탭·버튼 다시 누르기·패널·쓰러짐이면 멈춤
export const seekS = { on: null }; // { t: {kind,i,x,z,R}, route, i, cur }
const pickMark = new THREE.Mesh(new THREE.RingGeometry(0.78, 1, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: PICK_SEEK.color, transparent: true, opacity: 0.85, depthWrite: false }));
const pickTri = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 3).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: PICK_SEEK.color, depthTest: false, transparent: true }));
pickMark.visible = pickTri.visible = false; pickMark.renderOrder = 3; pickTri.renderOrder = 9; scene.add(pickMark, pickTri);
const placePickMark = drape(pickMark, groundAt); // 비탈에서도 땅에 묻히지 않게 (#151)
// 찾는 거리 안에서 가장 가까운 것 (가장자리까지 거리). 쓰레기 상태는 trash 에서만 읽음
function seekFind() {
  const px = player.pos.x, pz = player.pos.z; let best = null;
  const c = trash.candidates(px, pz, PICK_SEEK.range, bagRoom())[0];
  if (c && (!best || c.d < best.d)) best = { kind: c.h != null ? 'h' : 'k', i: c.h != null ? c.h : c.k, x: c.x, z: c.z, R: Math.max(0, Math.hypot(c.x - px, c.z - pz) - c.d), d: c.d };
  return best;
}
const seekAlive = (t) => t.kind === 'h' ? trash.heaps[t.i].st >= 0 && bagRoom() >= 1 : !trash.store.isTutPicked(t.i) && bagRoom() >= 1;
export function stopSeek() {
  const s = seekS.on; if (!s) return; seekS.on = null; pickMark.visible = pickTri.visible = false;
  if (player.target && player.target === s.cur) { player.target = null; player.onArrive = null; marker.visible = false; }
}
// quiet: 누르고 있어 이어 갈 때는 없어도 토스트 없음
export function startSeek(quiet = false) {
  if (!trash || seekS.on || pickBlocked() || busy()) return false;
  const t = seekFind();
  if (!t) { if (!quiet) { if (bagRoom() < 1) fullToast(true); else toast('근처에 쓰레기가 없어요'); } return false; }
  // 설 자리: 쓰레기 가장자리에서 플레이어 쪽으로 도구 반경의 stand 만큼
  const a = Math.atan2(player.pos.x - t.x, player.pos.z - t.z), off = t.R + toolNow().r * PICK_SEEK.stand;
  const to = { x: t.x + Math.sin(a) * off, z: t.z + Math.cos(a) * off };
  const r = late.trailRoute ? late.trailRoute(player.pos, to) : [to];
  const route = r.map((q) => new THREE.Vector3(q.x, groundAt(q.x, q.z), q.z));
  late.stopAutoGo?.();
  setHoldBow(false);
  seekS.on = { t, route, i: 0, cur: null };
  seekNextWp(); return true;
}
function seekNextWp() { const s = seekS.on; setTarget(s.route[s.i], null); marker.visible = false; s.cur = player.target; }
function tickSeek() {
  const s = seekS.on; if (!s) return;
  if (busy() || hp.isDown || player.riding || player.ride || player.cart || player.target !== s.cur) { stopSeek(); return; }
  if (!seekAlive(s.t)) { stopSeek(); if ((pickS.held || keys.has('e')) && !bloomHolding()) startSeek(true); return; } // 다른 데서 치워짐
  if (canPick() && !bloomHolding()) { startPick(); return; } // 닿으면 바로 주움
  const last = s.i === s.route.length - 1, dc = Math.hypot(s.cur.x - player.pos.x, s.cur.z - player.pos.z);
  if (!last && dc < 2.4) { s.i++; seekNextWp(); }
}
// 고른 쓰레기 표시 (#56 겨눔 표시와 같은 모양, 색만 다름)
function tickPickMark(time) {
  const s = seekS.on; if (!s) return;
  const t = s.t, R = t.kind === 'h' ? t.R : 0, sc = Math.max(0.6, R + 0.5) * (1 + Math.sin(time * 6) * 0.08), gy = groundAt(t.x, t.z);
  pickMark.visible = pickTri.visible = true;
  placePickMark(t.x, t.z, Math.round(sc * 50) / 50, 0, 0.02);
  pickTri.position.set(t.x, gy + (t.kind === 'h' ? R * 0.8 + 1.8 : 1.3) + Math.sin(time * 6) * 0.1, t.z); pickTri.rotation.y = time * 2;
}
// 튜토리얼 작은 더미를 다 치움 (#151): 본게임 더미와 같은 꽃·빛·소리, 안내 한 줄, TUT.heapLookT 초 동안 카메라가 더미 쪽을 봄. 저장·구역·업적엔 안 셈
const heapLook = { t: 0, yaw: 0 };
function tutHeapFx(d) {
  bfx?.heap({ x: d.x, z: d.z, r: d.r, size: 's', color: BLOOM.zones[1]?.color || '#ffffff', gyul: 0 });
  late.sound.heapClear?.(0, 1); state.cheerQ = 1.5;
  toast('쓰레기를 다 치우면 꽃이 피어요');
  holdBloom(TUT.heapLookT, d.x, d.z);
  if (cam.mode === 'follow') { heapLook.t = TUT.heapLookT; heapLook.yaw = Math.atan2(player.pos.x - d.x, player.pos.z - d.z); }
}
function tickLook(dt) {
  if (heapLook.t <= 0) return; heapLook.t -= dt;
  let dy = heapLook.yaw - cam.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); cam.yaw += dy * Math.min(1, dt * 4);
}
// 버튼(E)을 누른 순간: 걷는 중이면 멈춤, 범위 안이면 줍기, 아니면 찾아 감
export function pressPick() {
  late.stopApproach?.(); // 다가가서 쏘기(#132) 중이면 줍기로 넘어감
  if (seekS.on) { stopSeek(); return; }
  if (!trash || pickS.cyc >= 0 || pickBlocked()) return;
  if (canPick()) { startPick(); return; }
  if (trashFull()) { fullToast(true); return; }
  startSeek();
}
// 줍기 버튼을 흐리게 할지: 찾는 거리 안에도 없을 때 (0.3초마다)
let seekT = 0, seekHas = false;
export function seekable() { const now = performance.now() / 1000; if (now - seekT > PICK_SEEK.retry) { seekT = now; seekHas = !!trash && !pickBlocked() && !!seekFind(); } return seekHas; }
// 주운 쓰레기가 배낭으로 빨려 들어가는 연출
const flyPool = [];
function flyToBag(it) {
  const m = new THREE.Mesh(trash.geos[it.t], trash.fxMats[it.t].clone()); m.material.color.set(it.color);
  m.position.copy(it.pos); scene.add(m); flyPool.push({ m, from: it.pos.clone(), t: 0 });
}
export function tickFly(dt) {
  for (let i = flyPool.length - 1; i >= 0; i--) {
    const f = flyPool[i]; f.t += dt; const k = Math.min(1, f.t / 0.42), e = k * k;
    const back = player.pos.clone(); back.y = player.visY + player.jumpY + 1.45; back.addScaledVector(new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading)), -0.35);
    f.m.position.lerpVectors(f.from, back, e); f.m.position.y += Math.sin(k * Math.PI) * 0.9;
    f.m.rotation.y += dt * 9; f.m.rotation.x += dt * 5; f.m.scale.setScalar(1 - 0.75 * e);
    if (k >= 1) { scene.remove(f.m); f.m.material.dispose(); flyPool.splice(i, 1); }
  }
}
const nearTop = () => spots.isViewpoint(player.pos) || player.pos.distanceTo(spots.sunWatch.pos) <= spots.sunWatch.r;
let lastTrashUI = ''; state.lastZoneUI = ''; let zoneNow = 0; let zoneT = 0; export { zoneNow };
// 구역 확인 (0.3초마다): 바뀌면 HUD 갱신
export function tickZone(dt) { if (!trash || (zoneT -= dt) > 0) return; zoneT = 0.3; const z = trash.zoneAt(player.pos.x, player.pos.z); if (z !== zoneNow) { const prev = zoneNow; zoneNow = z; updateTrashUI(false); late.zoneEnter?.(z, prev); } } // #136 구역 이름 배너·소리 (area.js)
export function updateTrashUI(bump) {
  if (!trash) return;
  const vol = trash.bagVol(), cap = bagCap(), c = trash.clean() * 100;
  const cs = c > 0 && c < 10 ? c.toFixed(1) : String(Math.floor(c));
  const key = `${vol}/${cap}/${cs}`;
  const pk = save.equip.bag === 0; if ($('bag-pill').classList.contains('pocket') !== pk) { $('bag-pill').classList.toggle('pocket', pk); $('bag-pill').title = pk ? '호주머니: 담은 양 / 용량' : '배낭: 담은 양 / 용량 (부피)'; } // 배낭이 없으면 호주머니 아이콘 (#31)
  if (key !== lastTrashUI) { lastTrashUI = key; $('bag-n').textContent = vol; $('bag-cap').textContent = cap; $('clean-n').textContent = cs; $('clean-ring').setAttribute('stroke-dasharray', `${(Math.min(100, c) / 100 * 37.7).toFixed(1)} 37.7`); $('bag-pill').classList.toggle('full', vol >= cap); topFit.dirty(); }
  // 지금 구역 번호·깨끗한 정도 (#45). 들머리(0)에서는 숨김
  const zc = zoneNow ? Math.floor(trash.zoneClean(zoneNow) * 100) : 0;
  const zb = bloom ? bloom.bloomed().join('') : '', tone = zoneNow ? zoneTone(gearScore(save).total, zoneNow) : '', zk = `${zoneNow}/${zc}/${zb}/${tone}`;
  if (zk !== state.lastZoneUI) { state.lastZoneUI = zk; $('zone-pill').hidden = !zoneNow; $('zone-n').textContent = zoneNow; $('zone-pill').dataset.c = zc;
    // 권장 장비 점수와 견준 색 (#137): 빨강 낮음 · 노랑 맞음 · 초록 넘음. 좁은 화면에서 구역이 좌표와 합쳐지면 좌표 칸에
    for (const el of [$('zone-pill'), $('xy-pill')]) { if (tone) el.dataset.tone = tone; else delete el.dataset.tone; }
    $('zone-pill').dataset.rec = zoneNow ? zoneRec(zoneNow) : ''; $('zone-pill').classList.toggle('done', zc >= 100); $('xy-pill').classList.toggle('inzone', !!zoneNow);
    // 꽃 아이콘 (#46): 지금 구역이 다 피었으면 꽃 모양(귤색), 깨끗한 정도 옆엔 다 핀 구역마다 작은 점. 색은 흰색·귤색만 (#75)
    const bl = !!(bloom && zoneNow && bloom.isBloomed(zoneNow)); $('zone-pill').classList.toggle('bloom', bl);
    const row = $('bloom-row'); row.hidden = !zb; row.innerHTML = [...zb].map((z) => `<i title="${z}구역 ${BLOOM.zones[z].name}"></i>`).join(''); topFit.dirty(); }
  if (bump) { const b = $('bag-pill'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
}
if (trash) {
  $('bag-pill').hidden = $('clean-pill').hidden = false; topFit.dirty();
  trash.on((ev, d) => {
    if (ev === 'trash') { ab.picked(); ach.emit('trash'); ach.emit('trash-' + d.kind); if (nearTop()) ach.emit('trash-top'); if (sunEvent()) ach.emit('trash-sun'); if (wx.kind === 'rain') ach.emit('trash-rain'); onDexGet(d.dex, d.dexNew); }
    else if (ev === 'dex-test') onDexGet(d.dex, d.dexNew);
    else if (ev === 'tut-heap-clear') tutHeapFx(d);
    else if (ev === 'heap-clear') { if (!d.by) { late.pace?.cleared(d.h); const hh = trash.heaps[d.h]; if (hh) holdBloom(BLOOM_HOLD.heap, hh.x, hh.z); } late.sound.swell?.(PACE.bloomLayer.heap); tips.event('heapClear'); ach.emit('heap-clear'); toast('쓰레기 더미 하나를 다 치웠어요'); heapFx(d.h, { by: d.by, gyul: d.gyul }); }
    else if (ev === 'zone-clear') { ach.emit('zone-clear'); ach.emit('zone-clear-' + d.zone); if (!d.by) holdBloom(BLOOM_HOLD.zone, bloomHold.x, bloomHold.z); } // 글 대신 꽃밭 배너 (#65, zone-bloom)
    updateTrashUI(false);
  });
  updateTrashUI(false);
}
// 더미를 다 치웠을 때·구역이 꽃밭이 될 때 효과 (#65). 3D 는 bloomfx.js, 여기선 소리·진동·기뻐하는 동작·카메라·배너
// by: 치운 사람(없으면 나). 다른 사람이 치운 건 가까이(otherR) 있을 때만 보이고 소리는 작게, 진동·동작 없음 (멀티 대비, 지금은 구조만)
state.cheerQ = 0;
const HEAP_LVL = { s: 0, l: 1, xl: 2 };
const canVib = () => 'vibrate' in navigator && matchMedia('(pointer: coarse)').matches;
function heapFx(hi, { by = null, gyul = 0 } = {}) {
  const h = trash?.heaps[hi]; if (!h || !bfx) return;
  const mine = !by, far = Math.hypot(h.x - player.pos.x, h.z - player.pos.z);
  if (!mine && far > BLOOM_FX.otherR) return;
  const H = BLOOM_FX.heap[h.k] || BLOOM_FX.heap.s;
  bfx.heap({ x: h.x, z: h.z, r: h.r, size: h.k, color: BLOOM.zones[h.zone]?.color || '#ffffff', gyul });
  late.sound.heapClear?.(HEAP_LVL[h.k] ?? 0, mine ? 1 : Math.max(0.15, 1 - far / BLOOM_FX.otherR));
  if (!mine) return;
  state.cheerQ = 1.5;
  if (canVib()) try { navigator.vibrate(H.vib); } catch { /* 진동 막힘 */ }
}
function zoneFx(z) {
  if (!bfx) return;
  const C = BLOOM_FX.zone, color = BLOOM.zones[z]?.color || '#ffffff', here = trash.zoneAt(player.pos.x, player.pos.z) === z;
  late.sound.bloomFanfare?.();
  if (here) { bfx.zone({ x: player.pos.x, z: player.pos.z, color }); if (cam.mode === 'follow') state.camPullT = 0; }
  const gl = $('bloom-glow'); gl.style.setProperty('--bg-t', C.glowT + 's'); gl.classList.remove('go'); void gl.offsetWidth; gl.classList.add('go');
  const bn = $('bloom-banner'), fl = (s) => `<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="${color}" stroke="rgba(0,0,0,.28)" stroke-width=".6">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="12" cy="6.4" rx="3.6" ry="5" transform="rotate(${a + s} 12 12)"/>`).join('')}</g><circle cx="12" cy="12" r="2.6" fill="#ffb01f"/></svg>`;
  bn.innerHTML = `<span class="bz">${icon('zone')}<b>${z}</b></span><svg class="ba" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"/></svg><span class="bf">${fl(0)}${fl(36)}${fl(12)}</span>`;
  bn.title = `${z}구역 ${BLOOM.zones[z]?.name || ''}`; bn.style.setProperty('--bb-t', C.bannerT + 's');
  bn.hidden = false; bn.classList.remove('go'); void bn.offsetWidth; bn.classList.add('go');
  clearTimeout(zoneFx.t); zoneFx.t = setTimeout(() => { bn.hidden = true; bn.classList.remove('go'); }, C.bannerT * 1000 + 100);
  if (canVib()) try { navigator.vibrate(C.vib); } catch { /* 진동 막힘 */ }
}
// 콘솔 확인 (#65): __oreum.bloom.test.heap(10|50|200) 가장 가까운 그 크기 더미 옆으로 가서 효과, .zone(z) 지금(또는 z) 구역 꽃밭 효과. 저장은 바꾸지 않음
export const bloomTest = {
  heap(size = 10, { other = false, clear = false } = {}) { // clear: 더미를 실제로 비움(저장됨, 되돌리기 __oreum.trash.setHeap(i, 원래 수))
    const k = size >= 200 ? 'xl' : size >= 50 ? 'l' : 's'; let bi = -1, bd = 1e9;
    trash.heaps.forEach((h, i) => { if (h.k !== k) return; const d = Math.hypot(h.x - player.pos.x, h.z - player.pos.z); if (d < bd) { bd = d; bi = i; } });
    if (bi < 0) return null; const h = trash.heaps[bi];
    if (!other) { const a = Math.atan2(player.pos.x - h.x, player.pos.z - h.z), d = h.r + 1.6, x = h.x + Math.sin(a) * d, z = h.z + Math.cos(a) * d; player.pos.set(x, groundAt(x, z), z); player.visY = player.pos.y; player.heading = a + Math.PI; cam.yaw = a; followCam(0, true); }
    if (clear) trash.test.setHeap(bi, 0); else bloom.replay({ heap: bi });
    heapFx(bi, { by: other ? 'test' : null }); return { heap: bi, size: k, zone: h.zone, n: h.n };
  },
  zone(z) { z = z || trash.zoneAt(player.pos.x, player.pos.z) || 1; bloom.replay({ zone: z }); zoneFx(z); if (trash.zoneAt(player.pos.x, player.pos.z) === z) bloom.flock(player.pos.x, player.pos.z); return z; },
  fx: () => bfx.counts(),
};
// 다 핀 구역 (#46): 소리·새 떼·노루. 노루는 구역마다 한 무리, 시들면 떠남
export const bloomDeer = {};
export function syncBloomDeer() {
  if (!bloom || life.remote) return; // 멀티에서 방장이 아니면 방장이 알려 준 노루만 (#92)
  for (const z of ZONE_IDS) {
    const on = bloom.isBloomed(z);
    if (on && !bloomDeer[z]) { const p = bloom.spotIn(z, spots.deerZone); if (p) bloomDeer[z] = life.addDeer(p.x, p.z, BLOOM.deer, Array.from({ length: BLOOM.deer }, (_, k) => `b${z}-${k}`)); }
    else if (!on && bloomDeer[z]) { const left = life.removeDeer(bloomDeer[z]); bloomDeer[z] = left.length ? left : null; }
  }
}
if (bloom) {
  bloom.on((ev, d) => {
    if (ev === 'zone-bloom') { late.pace?.note('bloom'); late.sound.swell?.(PACE.bloomLayer.zone); ach.emit('zone-bloom'); zoneFx(d.zone); if (trash.zoneAt(player.pos.x, player.pos.z) === d.zone) bloom.flock(player.pos.x, player.pos.z); [1.6, 2.5, 3.6].forEach((t) => setTimeout(() => late.sound.on && late.sound.bird?.(), t * 1000)); }
    syncBloomDeer(); state.lastZoneUI = ''; updateTrashUI(false);
  });
  syncBloomDeer();
  life.hooks.spawnBlock = (x, z) => bloom.isBloomed(trash.zoneAt(x, z));
}
if (CH_MINI.length) { const bl = life.hooks.spawnBlock, K2 = CLEANHOUSE.keep ** 2; life.hooks.spawnBlock = (x, z) => CH_MINI.some((c) => (c.center.x - x) ** 2 + (c.center.z - z) ** 2 < K2) || !!bl?.(x, z); } // 클린하우스 둘레엔 몹 없음 (#78)
if (street) { const bl = life.hooks.spawnBlock, R = STREET.radius + SHOP_ST.keepPad; life.hooks.spawnBlock = (x, z) => Math.hypot(x - STREET.center.x, z - STREET.center.z) < R || !!bl?.(x, z); } // 가게 거리 둘레엔 몹 없음 (#57)
if (trash) life.hooks.zoneAt = (x, z) => trash.zoneAt(x, z); // 구역별 몹 (#48): 플레이어가 있는 구역의 종류가 나옴
