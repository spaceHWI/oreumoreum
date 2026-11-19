// 줍기·배낭, 구역 확인, 더미·꽃밭 효과 (#86 에서 main.js 를 나눔. 파일 순서는 src/main.js, 규칙은 notes/prototype-v1.md 코드 구조)
import { TOOLS, BAGS, POCKET, CLEANHOUSE, BLOOM, BLOOM_FX, SHOP_ST, PACE } from '../balance.js';
import { STREET } from '../streetlayout.js';
import { ZONE_IDS } from '../zones.js';
import * as THREE from 'three';
import { groundAt } from '../world.js';
import { state, late } from './state.js';
import { $, save, wearV, lookS, ab, persist } from './save.js';
import { scene, wx, spots, sunEvent } from './scene.js';
import { life, street, buff, trash, CH, CH_MINI, bloom, bfx, player, hp } from './place.js';
import { cam, followCam } from './camera.js';
import { topFit, toast, tips, updateStats, panelOpen, ach, onDexGet } from './hud.js';
import { keys, marker } from './input.js';
import { setHoldBow } from './throw.js';

Object.assign(late, { startPick }); // 앞 파일에서 부르는 함수

// ---------- 줍기·배낭 ----------
export const pickS = { held: false, cyc: -1, got: false, fullT: 0, gyul: -1, combo: 0, comboAt: -1e9 }; late.pickS = pickS;
export const toolNow = () => { const t = TOOLS[save.equip.tool - 1], k = buff.mul('pick'); return k === 1 ? t : { ...t, time: t.time / k }; }; // 식사 버프(#50) 줍는 속도
export const bagCap = () => Math.floor((save.equip.bag ? BAGS[save.equip.bag - 1] : POCKET).cap * buff.mul('bag')) + wearV('bottom'); // 식사 버프(#50) 배낭 용량, 바지 주머니(#52)
export const bagRoom = () => (trash ? bagCap() - trash.bagVol() : 0); late.bagRoom = bagRoom;
export const canPick = () => !!trash && !player.riding && !player.ride && !player.cart && !player.air && (late.tut.gyulNear(player.pos) >= 0 || trash.any(player.pos.x, player.pos.z, toolNow().r, bagRoom())); // 튜토리얼 귤(#62)도 줍기로
const trashFull = () => !!trash && bagRoom() < 1 && trash.any(player.pos.x, player.pos.z, toolNow().r, 99);
function fullToast() { if (performance.now() - pickS.fullT < 4000) return; pickS.fullT = performance.now(); const w = save.equip.bag ? '배낭' : '호주머니'; toast(CH ? `${w}가 가득 찼어요 · 가까운 클린하우스에 버려요` : `${w}가 가득 찼어요`); }
const pickBlocked = () => panelOpen() || cam.mode === 'wardrobe' || lookS.open || ['sit', 'photo', 'photo-wait'].includes(player.pose) || player.riding || player.ride || player.cart || player.air || !!player.rescue || hp.isDown || hp.pending;
export function startPick() {
  if (!trash || pickS.cyc >= 0 || pickBlocked()) return;
  const gi = player.riding || player.air ? -1 : late.tut.gyulNear(player.pos); // 튜토리얼 귤 3개 (#62): 쓰레기보다 먼저
  if (gi >= 0) { const g = late.tut.gyuls[gi]; player.target = null; player.onArrive = null; marker.visible = false; player.heading = Math.atan2(g.x - player.pos.x, g.z - player.pos.z) || player.heading; player.pose = 'crouch'; player.poseT = 0; player.speed = 0; setHoldBow(false); pickS.cyc = 0; pickS.got = false; pickS.gyul = gi; return; }
  const list = trash.candidates(player.pos.x, player.pos.z, toolNow().r, bagRoom());
  if (!list.length) { if (trashFull()) fullToast(); return; }
  const c = list[0];
  player.target = null; player.onArrive = null; marker.visible = false;
  player.heading = Math.atan2(c.x - player.pos.x, c.z - player.pos.z) || player.heading;
  player.pose = 'crouch'; player.poseT = 0; player.speed = 0; setHoldBow(false); // 줍기는 도구로 (#38)
  pickS.cyc = 0; pickS.got = false;
}
function takeNow() {
  if (pickS.gyul >= 0) { const at = late.tut.takeGyul(pickS.gyul); pickS.gyul = -1; if (at) { save.coins += 1; persist(); updateStats(); late.sound.coin?.(); late.coinFx(at, 1); } return; } // 튜토리얼 귤 (#62) +1
  const tool = toolNow(); let room = bagRoom(), n = 0;
  // 더미는 한 곳에서 도구의 한 번 양(per)만큼 꺼냄 (#45). 튜토리얼 낱개는 하나씩
  for (const c of trash.candidates(player.pos.x, player.pos.z, tool.r, room)) {
    while (n < tool.per && room >= 1) {
      const it = trash.take(c, room); if (!it) break;
      room -= it.type.vol; n++; flyToBag(it); late.sound.pick?.(it.type.id);
      if (c.h == null) break;
    }
    if (n >= tool.per || room < 1) break;
  }
  if (n) { trash.store.commit(); updateTrashUI(true); late.tut.notify('trash', n); const now = performance.now() / 1000; pickS.combo = now - pickS.comboAt < PACE.combo.gap ? Math.min(PACE.combo.max, pickS.combo + 1) : 0; pickS.comboAt = now; late.sound.combo?.(pickS.combo); } // 이어 주우면 음이 올라감 (#89)
  if (bagRoom() < 1) { late.sound.full?.(); fullToast(); }
}
export function tickPick(dt) {
  if (!trash) return;
  const holding = pickS.held || keys.has('e');
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
  }
}
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
export function tickZone(dt) { if (!trash || (zoneT -= dt) > 0) return; zoneT = 0.3; const z = trash.zoneAt(player.pos.x, player.pos.z); if (z !== zoneNow) { zoneNow = z; updateTrashUI(false); } }
export function updateTrashUI(bump) {
  if (!trash) return;
  const vol = trash.bagVol(), cap = bagCap(), c = trash.clean() * 100;
  const cs = c > 0 && c < 10 ? c.toFixed(1) : String(Math.floor(c));
  const key = `${vol}/${cap}/${cs}`;
  const pk = save.equip.bag === 0; if ($('bag-pill').classList.contains('pocket') !== pk) { $('bag-pill').classList.toggle('pocket', pk); $('bag-pill').title = pk ? '호주머니: 담은 양 / 용량' : '배낭: 담은 양 / 용량 (부피)'; } // 배낭이 없으면 호주머니 아이콘 (#31)
  if (key !== lastTrashUI) { lastTrashUI = key; $('bag-n').textContent = vol; $('bag-cap').textContent = cap; $('clean-n').textContent = cs; $('clean-ring').setAttribute('stroke-dasharray', `${(Math.min(100, c) / 100 * 37.7).toFixed(1)} 37.7`); $('bag-pill').classList.toggle('full', vol >= cap); topFit.dirty(); }
  // 지금 구역 번호·깨끗한 정도 (#45). 들머리(0)에서는 숨김
  const zc = zoneNow ? Math.floor(trash.zoneClean(zoneNow) * 100) : 0;
  const zb = bloom ? bloom.bloomed().join('') : '', zk = `${zoneNow}/${zc}/${zb}`;
  if (zk !== state.lastZoneUI) { state.lastZoneUI = zk; $('zone-pill').hidden = !zoneNow; $('zone-n').textContent = zoneNow; $('zone-pill').dataset.c = zc; $('zone-pill').classList.toggle('done', zc >= 100); $('xy-pill').classList.toggle('inzone', !!zoneNow);
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
    else if (ev === 'heap-clear') { if (!d.by) late.pace?.cleared(d.h); late.sound.swell?.(PACE.bloomLayer.heap); tips.event('heapClear'); ach.emit('heap-clear'); toast('쓰레기 더미 하나를 다 치웠어요'); heapFx(d.h, { by: d.by, gyul: d.gyul }); }
    else if (ev === 'zone-clear') { ach.emit('zone-clear'); ach.emit('zone-clear-' + d.zone); } // 글 대신 꽃밭 배너 (#65, zone-bloom)
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
  bn.innerHTML = `<span class="bz"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20l6.5-11 4 6 2.5-3.5L21 20z"/></svg><b>${z}</b></span><svg class="ba" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"/></svg><span class="bf">${fl(0)}${fl(36)}${fl(12)}</span>`;
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
