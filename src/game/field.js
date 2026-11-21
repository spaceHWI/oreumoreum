// 맵 전체 쓰기 (#138, notes/growth-loop.md 6절·7-1절) 게임 연결. 자리·모양은 src/field.js, 고리 계산은 src/fieldplan.js, 수치는 balance.js FIELD
// - 적 소굴: 가까이 가면 그 구역 적 무리가 나오고, 다 쫓아내면 닫히며 귤 묶음(late.denLoot 자리: 재료는 다음 이슈). FIELD.den.reopen 초 뒤 다시 열림
// - 숨은 보물: 하루(한국 시간) 한 번씩 열기(상호작용). 귤 + 가끔 드문 쓰레기(도감)
// - 볼거리: 처음 가까이 가면 도감(볼거리 칸) + 귤
// - 길 밖 걷기: 오름 위 풀밭은 조금 느림(신발 단계가 높을수록 덜) → update.js 가 late.fieldSlow 를 곱함
// - 가 본 곳: 지도 격자에 밝혀 save.field.fog 에. 큰 지도(area.js drawMap → late.fieldMap)·미니맵(#minimap)에 가 본 곳·아이콘
// - 줍기·클린하우스 자동 걷기의 길 밖 구간은 막히면 격자 길 찾기로 (autowalk.js setRoutePass)
// 저장 save.field = { den: {id: 닫은 ms}, tr: {d: 날 번호, got: [id]}, sight: [id], fog: base64 }
// (파일 순서는 src/modules.js: dump 뒤)
import * as THREE from 'three';
import { FIELD, ENEMY_DROP, ZONES, TRASH_TYPES, BAGS, POCKET } from '../balance.js';
import { shoeTier } from '../gearscore.js';
import { createField } from '../field.js';
import { DEX_LIST } from '../trash.js';
import { kstDay } from '../rankday.js';
import { ZONE_BOX } from '../zones.js';
import { setRoutePass } from '../autowalk.js';
import { loopLength } from '../fieldplan.js';
import { height, surfaceAt } from '../world.js';
import { LOW } from '../gfx2.js';
import { state, late } from './state.js';
import { $, save, persist } from './save.js';
import { scene, NSW, spots } from './scene.js';
import { trash, bloom, col, player, life, hp, CHS, stream } from './place.js';
import { toast, addCoins, onDexGet, panelOpen } from './hud.js';
import { interactables } from './stores.js';
import { buildMapBase, mapXY } from './area.js';
import { cam } from './camera.js';

export const field = trash && NSW ? createField({ scene, height, trash, low: LOW, col, chs: CHS.map((c) => c.front) }) : null;

/* ---------- 저장 ---------- */
const F = (() => {
  const o = save.field = (save.field && typeof save.field === 'object') ? save.field : {};
  if (!o.den || typeof o.den !== 'object') o.den = {};
  for (const k in o.den) if (!(Number(o.den[k]) > 0)) delete o.den[k];
  if (!o.tr || typeof o.tr !== 'object' || !Array.isArray(o.tr.got)) o.tr = { d: 0, got: [] };
  if (!Array.isArray(o.sight)) o.sight = [];
  if (typeof o.fog !== 'string') o.fog = '';
  return o;
})();
const today = () => kstDay();
const trGot = (t) => F.tr.d === today() && F.tr.got.includes(t.id);
const denOpen = (d) => { const t = F.den[d.id]; return !t || Date.now() - t > FIELD.den.reopen * 1000 || Date.now() < t; };
if (field) { field.state.denClosed = (d) => !denOpen(d); field.state.chestOpen = trGot; }
const v3 = (o, dy = 0) => new THREE.Vector3(o.x, (o.y ?? height(o.x, o.z)) + dy, o.z);

/* ---------- 적 소굴 ---------- */
const act = new Map(); // 소굴 id → { foes: [적], fled: Set }
let denT = 0, denWait = 0;
const live = (e) => life.enemies.list.includes(e) && e.state !== 'flee' && e.state !== 'leave';
function closeDen(d, s) {
  act.delete(d.id); F.den[d.id] = Date.now(); persist(); field.dirty();
  life.scatterTangerines(v3(d, 0.8), FIELD.den.gyul[d.zone] || 0, ENEMY_DROP.max);
  toast('소굴을 닫았어요! 떨어진 귤을 주워요', 3); late.sound?.coin?.();
  late.denLoot?.(d, s); // 다음 이슈(전리품·재료)가 씀
}
function tickDens(dt) {
  if ((denT -= dt) > 0) return; denT = 0.25; denWait -= 0.25;
  const p = player.pos;
  for (const d of field.dens) {
    const s = act.get(d.id), dist = Math.hypot(d.x - p.x, d.z - p.z);
    if (s) {
      s.foes.forEach((e) => { if (e.state === 'flee') s.fled.add(e); });
      if (dist > FIELD.den.leave || hp.isDown) { s.foes.forEach((e) => { if (live(e)) { e.state = 'leave'; e.st = 0; e.bar.g.visible = false; } }); act.delete(d.id); continue; } // 멀어지면 돌아감(소굴은 열린 채)
      if (s.foes.some(live)) continue;
      if (s.foes.every((e) => s.fled.has(e))) closeDen(d, s); else act.delete(d.id); // 하나라도 쫓아내지 못하고 떠났으면 열린 채
      continue;
    }
    if (act.size || denWait > 0 || dist > FIELD.den.near || !denOpen(d) || bloom?.isBloomed(d.zone)) continue;
    if (!state.sessionOn || late.tut?.active || hp.isDown || player.riding || player.cart) continue;
    const before = new Set(life.enemies.list), [a, b] = FIELD.den.group, n = a + Math.floor(Math.random() * (b - a + 1));
    life.enemies.spawnPlan({ kind: d.kind, n, x: d.x, z: d.z, zone: d.zone });
    const foes = life.enemies.list.filter((e) => !before.has(e));
    if (!foes.length) { denWait = 5; continue; } // 적이 가득 차 있으면 조금 뒤에
    act.set(d.id, { foes, fled: new Set() });
    toast('소굴에서 적이 나왔어요! 다 쫓아내면 소굴이 닫혀요', 3);
  }
}

/* ---------- 숨은 보물 ---------- */
const chestPos = (t) => new THREE.Vector3(t.x - Math.sin(t.rot) * 1.25, t.y, t.z - Math.cos(t.rot) * 1.25);
function openTreasure(t) {
  if (trGot(t)) return;
  if (F.tr.d !== today()) F.tr = { d: today(), got: [] };
  F.tr.got.push(t.id); persist(); field.dirty();
  life.scatterTangerines(chestPos(t).setY(t.y + 0.8), FIELD.treasure.gyul[t.zone] || 0, ENEMY_DROP.max);
  toast('숨은 보물! 귤이 쏟아져요', 3); late.sound?.coin?.();
  if (Math.random() < FIELD.treasure.rare) { const rares = DEX_LIST.filter((x) => x.rare), dx = rares[Math.floor(Math.random() * rares.length)]; const isNew = trash.store.dexAdd(dx.id); trash.store.commit(); setTimeout(() => onDexGet(dx, isNew), 1200); }
  late.treasureLoot?.(t); // 다음 이슈(장비 드롭)가 씀
}
if (field) for (const t of field.treasures) interactables.push({ label: '보물 열기', ic: 'chest', pos: chestPos(t), r: FIELD.treasure.r, when: () => !trGot(t), act: () => openTreasure(t) });

/* ---------- 볼거리 ---------- */
let sightT = 0;
function tickSights(dt) {
  if ((sightT -= dt) > 0) return; sightT = 0.3;
  if (!state.sessionOn || late.tut?.active) return;
  for (const s of field.sights) {
    if (F.sight.includes(s.id) || Math.hypot(s.x - player.pos.x, s.z - player.pos.z) > FIELD.sight.r + (s.kind === 'sandam' ? 3 : 0)) continue;
    F.sight.push(s.id); persist();
    const dx = DEX_LIST.find((x) => x.id === s.id);
    if (dx) { const isNew = trash.store.dexAdd(dx.id); trash.store.commit(); onDexGet(dx, isNew); }
    addCoins(FIELD.sight.gyul[s.zone] || 0, `볼거리 · ${s.name}`);
    if (s.kind === 'view') state.awe = 4;
    late.sightFound?.(s);
  }
}

/* ---------- 길 밖 걷기 ---------- */
let slowK = 1, slowX = 1e9, slowZ = 1e9;
late.fieldSlow = () => {
  if (!field) return 1;
  const p = player.pos; if (Math.abs(p.x - slowX) + Math.abs(p.z - slowZ) < 0.6) return slowK;
  slowX = p.x; slowZ = p.z;
  slowK = trash.zoneAt(p.x, p.z) && surfaceAt(p.x, p.z) === 0 ? FIELD.off[Math.max(0, Math.min(FIELD.off.length - 1, shoeTier(save) - 1))] : 1;
  return slowK;
};

/* ---------- 길 밖 자동 걷기: 부딪힘·오름 경계·가파른 비탈은 비켜 감 ---------- */
if (field) setRoutePass((x, z) => {
  if (col && col.blocked(x, z, 0.55)) return false;
  if (spots.clamp && spots.clamp(x, z)) return false;
  const gx = height(x + 1, z) - height(x - 1, z), gz = height(x, z + 1) - height(x, z - 1);
  return Math.hypot(gx, gz) / 2 < 1.1; // 45° 넘는 비탈
});

/* ---------- 적이 밀려 들어가면 안 되는 곳 (#146 enemypack.js): 사물·물·45° 넘는 비탈 ---------- */
life.hooks.enemyPass = (x, z, r) => {
  if (col && col.blocked(x, z, r)) return false;
  if (stream && stream.inWater(x, z)) return false;
  const gx = height(x + 1, z) - height(x - 1, z), gz = height(x, z + 1) - height(x, z - 1);
  return Math.hypot(gx, gz) / 2 < 1.1;
};

/* ---------- 가 본 곳 (격자 비트) ---------- */
const FN = FIELD.fog.n, fogBits = new Uint8Array(FN * FN / 8), fogZone = new Uint8Array(FN * FN);
try { if (F.fog) { const b = atob(F.fog); if (b.length === fogBits.length) for (let i = 0; i < b.length; i++) fogBits[i] = b.charCodeAt(i); } } catch { /* 망가진 기록은 처음부터 */ }
const fcs = ZONE_BOX.size / FN;
if (field) for (let j = 0; j < FN; j++) for (let i = 0; i < FN; i++) fogZone[j * FN + i] = trash.zoneAt(ZONE_BOX.x0 + (i + 0.5) * fcs, ZONE_BOX.z0 + (j + 0.5) * fcs);
const seen = (i) => (fogBits[i >> 3] >> (i & 7)) & 1;
const seenAt = (x, z) => { const i = Math.floor((x - ZONE_BOX.x0) / fcs), j = Math.floor((z - ZONE_BOX.z0) / fcs); return i < 0 || j < 0 || i >= FN || j >= FN || !fogZone[j * FN + i] || !!seen(j * FN + i); };
let fogT = 0, fogSaveT = 0, fogDirty = false, fogVer = 1;
function tickFog(dt) {
  if ((fogT -= dt) > 0) return; fogT = 0.4;
  const R = FIELD.fog.r, ci = (player.pos.x - ZONE_BOX.x0) / fcs, cj = (player.pos.z - ZONE_BOX.z0) / fcs, rr = R / fcs;
  for (let j = Math.floor(cj - rr); j <= Math.ceil(cj + rr); j++) for (let i = Math.floor(ci - rr); i <= Math.ceil(ci + rr); i++) {
    if (i < 0 || j < 0 || i >= FN || j >= FN || (i + 0.5 - ci) ** 2 + (j + 0.5 - cj) ** 2 > rr * rr) continue;
    const k = j * FN + i; if (!seen(k)) { fogBits[k >> 3] |= 1 << (k & 7); fogDirty = true; fogVer++; }
  }
  if (fogDirty && (fogSaveT -= 0.4) <= 0) { fogSaveT = 12; fogDirty = false; let s = ''; for (let i = 0; i < fogBits.length; i++) s += String.fromCharCode(fogBits[i]); F.fog = btoa(s); persist(); }
}
// 안 가 본 오름 칸을 어둡게 (작은 캔버스, 바뀔 때만 다시 칠함)
const fogC = document.createElement('canvas'); fogC.width = fogC.height = FN; let fogCV = 0;
function fogCanvas() {
  if (fogCV === fogVer) return fogC; fogCV = fogVer;
  const x = fogC.getContext('2d'), img = x.createImageData(FN, FN);
  for (let k = 0; k < FN * FN; k++) if (fogZone[k] && !seen(k)) { img.data[k * 4] = 14; img.data[k * 4 + 1] = 16; img.data[k * 4 + 2] = 12; img.data[k * 4 + 3] = 170; }
  x.putImageData(img, 0, 0); return fogC;
}

/* ---------- 지도 아이콘 ---------- */
// uv(x, z) → [u, v] 화면 자리, s 아이콘 크기(px)
function drawIcons(x, uv, s, clip = null) {
  const inC = (u, v) => !clip || (u - clip[0]) ** 2 + (v - clip[1]) ** 2 < clip[2] ** 2;
  x.lineWidth = Math.max(1, s / 6);
  // 더미: 길가는 작은 회색 점, 들판(큰 더미·쓰레기 산)은 검은 봉투
  trash.heaps.forEach((h, i) => { if (!(trash.store.left(i) > 0)) return; const [u, v] = uv(h.x, h.z); if (!inC(u, v)) return;
    if (!h.field) { x.fillStyle = 'rgba(70,64,56,.9)'; x.strokeStyle = 'rgba(255,255,255,.75)'; x.beginPath(); x.arc(u, v, s * 0.28, 0, 7); x.fill(); x.stroke(); return; }
    const k = h.k === 'mt' ? 1.25 : 0.9; x.fillStyle = '#2e2e34'; x.strokeStyle = '#fff'; x.beginPath(); x.moveTo(u - s * 0.5 * k, v + s * 0.45 * k); x.quadraticCurveTo(u - s * 0.62 * k, v - s * 0.3 * k, u - s * 0.14 * k, v - s * 0.38 * k); x.lineTo(u, v - s * 0.62 * k); x.lineTo(u + s * 0.14 * k, v - s * 0.38 * k); x.quadraticCurveTo(u + s * 0.62 * k, v - s * 0.3 * k, u + s * 0.5 * k, v + s * 0.45 * k); x.closePath(); x.fill(); x.stroke(); });
  late.bossIcons?.(x, uv, s, inC); // 우두머리 빈터 (#139)
  late.shopIcons?.(x, uv, s, inC); // 가게 거리 가게 (#128, game/shop.js)
  // 소굴: 열림 빨강·닫힘 회색 (가 본 곳만)
  for (const d of field.dens) { if (!seenAt(d.x, d.z)) continue; const [u, v] = uv(d.x, d.z); if (!inC(u, v)) continue; const o = denOpen(d);
    x.fillStyle = o ? '#e0483a' : '#7b7b80'; x.strokeStyle = '#fff'; x.beginPath(); x.arc(u, v, s * 0.5, 0, 7); x.fill(); x.stroke();
    x.strokeStyle = '#fff'; x.beginPath(); for (const o2 of [-0.22, 0, 0.22]) { x.moveTo(u + o2 * s - s * 0.08, v - s * 0.26); x.lineTo(u + o2 * s + s * 0.08, v + s * 0.26); } x.stroke(); }
  // 보물: 오늘 안 연 것만, 가 본 곳만 (금빛 별)
  for (const t of field.treasures) { if (trGot(t) || !seenAt(t.x, t.z)) continue; const [u, v] = uv(t.x, t.z); if (!inC(u, v)) continue;
    x.fillStyle = '#ffd23f'; x.strokeStyle = '#5a3a08'; x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = (i % 2 ? 0.24 : 0.55) * s; i ? x.lineTo(u + Math.cos(a) * r, v + Math.sin(a) * r) : x.moveTo(u + Math.cos(a) * r, v + Math.sin(a) * r); } x.closePath(); x.fill(); x.stroke(); }
  // 볼거리: 찾은 것 청록 마름모, 가 봤지만 못 찾은 것은 빈 마름모
  for (const g of field.sights) { if (!seenAt(g.x, g.z)) continue; const [u, v] = uv(g.x, g.z); if (!inC(u, v)) continue; const got = F.sight.includes(g.id), r = s * 0.5;
    x.beginPath(); x.moveTo(u, v - r); x.lineTo(u + r, v); x.lineTo(u, v + r); x.lineTo(u - r, v); x.closePath(); x.fillStyle = got ? '#4fe3c1' : 'rgba(255,255,255,.18)'; x.strokeStyle = got ? '#fff' : '#4fe3c1'; x.fill(); x.stroke(); }
}
// 큰 지도 (area.js drawMap 이 부름)
late.fieldMap = (x, W) => {
  if (!field) return;
  x.save(); x.imageSmoothingEnabled = true; x.drawImage(fogCanvas(), 0, 0, W, W); x.restore();
  drawIcons(x, (a, b) => mapXY(a, b, W), W / 32);
};

/* ---------- 미니맵 ---------- */
const mini = $('minimap');
let miniBase = null, miniT = 0;
const MB = 1024; // 미니맵 바탕 해상도 (오름 전체)
function drawMini() {
  const dpr = Math.min(2, window.devicePixelRatio || 1), css = mini.clientWidth || FIELD.mini.px[0], W = Math.round(css * dpr);
  if (mini.width !== W) { mini.width = mini.height = W; }
  if (!miniBase) miniBase = buildMapBase(MB, false);
  const x = mini.getContext('2d'), R = FIELD.mini.r, k = W / (2 * R), px = player.pos.x, pz = player.pos.z;
  x.clearRect(0, 0, W, W); x.save(); x.beginPath(); x.arc(W / 2, W / 2, W / 2, 0, 7); x.clip();
  x.fillStyle = '#1d2219'; x.fillRect(0, 0, W, W);
  const sb = MB / ZONE_BOX.size, [bu, bv] = mapXY(px, pz, MB);
  x.imageSmoothingEnabled = true; x.drawImage(miniBase, bu - R * sb, bv - R * sb, 2 * R * sb, 2 * R * sb, 0, 0, W, W);
  const fu = (px - ZONE_BOX.x0) / fcs, fv = (pz - ZONE_BOX.z0) / fcs; x.drawImage(fogCanvas(), fu - R / fcs, fv - R / fcs, 2 * R / fcs, 2 * R / fcs, 0, 0, W, W);
  drawIcons(x, (a, b) => [(a - px) * k + W / 2, (b - pz) * k + W / 2], W / 9, [W / 2, W / 2, W / 2 - 2]);
  x.restore();
  // 나 (가운데, 보는 방향)
  const h = player.heading, s = W / 11; x.save(); x.translate(W / 2, W / 2); x.rotate(-h + Math.PI); x.beginPath(); x.moveTo(0, -s); x.lineTo(s * 0.62, s * 0.7); x.lineTo(0, s * 0.35); x.lineTo(-s * 0.62, s * 0.7); x.closePath(); x.fillStyle = '#ff8a1f'; x.fill(); x.lineWidth = W / 60; x.strokeStyle = '#fff'; x.stroke(); x.restore();
}
const miniOn = () => !!field && state.sessionOn && !late.tut?.active && !panelOpen() && !document.body.classList.contains('tut') && cam.mode !== 'wardrobe';
if (mini) mini.addEventListener('click', () => late.openMap?.());

/* ---------- 매 프레임 ---------- */
let t0 = 0;
late.tickField = (dt) => {
  if (!field) return;
  t0 += dt;
  field.update(dt, player.pos, t0);
  tickDens(dt); tickSights(dt); tickFog(dt);
  const on = miniOn(); if (mini && mini.hidden === on) mini.hidden = !on;
  if (on && (miniT -= dt) <= 0) { miniT = 0.2; drawMini(); }
};

/* ---------- 확인용 (window.__oreum.field) ---------- */
// report(): 구역마다 놓은 수·길에서 거리·고리 한 바퀴 길이·배낭이 차는 곳에서 구역 클린하우스까지 (tools/field.js)
late.field = field && {
  api: field, save: F, seenAt, fog: () => { let n = 0, m = 0; for (let k = 0; k < FN * FN; k++) if (fogZone[k]) { m++; n += seen(k); } return +(n / m).toFixed(3); },
  revealAll() { fogBits.fill(255); fogVer++; fogDirty = true; },
  go(kind, i = 0) { const o = { den: field.dens, tr: field.treasures, sight: field.sights, boss: field.bosses, heap: trash.heaps.filter((h) => h.field) }[kind]?.[i]; if (!o) return null; const a = Math.random() * 6.28, d = (o.r || 3) + 3, x = o.x + Math.sin(a) * d, z = o.z + Math.cos(a) * d; player.pos.set(x, height(x, z), z); player.heading = a + Math.PI; return { x: +x.toFixed(1), z: +z.toFixed(1) }; },
  dens: () => field.dens.map((d) => ({ id: d.id, zone: d.zone, kind: d.kind, open: denOpen(d), active: act.has(d.id), x: Math.round(d.x), z: Math.round(d.z) })),
  openDen(id) { delete F.den[id]; field.dirty(); }, closeDen(id) { const d = field.dens.find((q) => q.id === id); if (d) closeDen(d, { foes: [] }); },
  treasures: () => field.treasures.map((t) => ({ id: t.id, zone: t.zone, got: trGot(t), x: Math.round(t.x), z: Math.round(t.z) })),
  openTreasure(id) { const t = field.treasures.find((q) => q.id === id); if (t) openTreasure(t); return t && trGot(t); },
  slow: () => late.fieldSlow(),
  report() {
    const T = trash.trail, out = [];
    const vol = (z) => ZONES[z - 1].mix.reduce((s, m, j) => s + m * TRASH_TYPES[j].vol, 0);
    for (const Z of ZONES) {
      const L = field.loops[Z.id]; if (!L) continue;
      const hs = trash.heaps.filter((h) => h.zone === Z.id), road = hs.filter((h) => !h.field), fh = hs.filter((h) => h.field);
      const d = (o) => Math.round(T.dist(o.x, o.z, 200));
      const dens = field.dens.filter((q) => q.zone === Z.id), trs = field.treasures.filter((q) => q.zone === Z.id), sg = field.sights.filter((q) => q.zone === Z.id), bo = field.bosses.find((q) => q.zone === Z.id);
      // 8자 고리 순서: 길가 더미(낮은 것부터) → 왼쪽 들판(들판 더미·소굴) → 클린하우스 → 오른쪽 들판(보물·볼거리) → 빈터
      const roadSorted = road.slice().sort((a, b) => a.y - b.y);
      const len = loopLength(L, [roadSorted, [...fh, ...dens], L.ch, [...trs, ...sg], bo]);
      // 권장 배낭(ZONES gear.bag)으로 길가 더미를 고리 순서대로 치움: 배낭이 찰 때마다 그 더미에서 가장 가까운 클린하우스까지 (7-1절: 80m 안)
      const cap = (Z.gear.bag ? BAGS[Z.gear.bag - 1] : POCKET).cap, v = vol(Z.id), road0 = road.reduce((s, h) => s + h.n, 0);
      const chAll = CHS.map((c) => c.front), chOf = (h) => Math.round(Math.min(...chAll.map((c) => Math.hypot(h.x - c.x, h.z - c.z)) ) - h.r);
      let bag = 0, done = 0, fills = [], half = null; for (const h of roadSorted) { let left = h.n; while (left > 0) { const k = Math.min(left, Math.floor((cap - bag) / v) || 0); if (k <= 0) { fills.push(chOf(h)); bag = 0; continue; } bag += k * v; left -= k; done += k; } if (!half && done >= road0 / 2) half = h; }
      const chD = fills.length ? Math.max(...fills) : (half ? chOf(half) : null);
      out.push({ zone: Z.id, road: road.length, roadD: road.length ? `${Math.min(...road.map(d))}~${Math.max(...road.map(d))}` : '-', field: fh.map((h) => `${h.k}@${d(h)}`).join(' '),
        dens: dens.length, denD: dens.map(d).join(','), treasures: trs.length, trD: trs.map(d).join(','), sights: sg.map((q) => q.name + '@' + d(q)).join(', '), boss: bo ? d(bo) : null,
        loop: Math.round(len), bagCap: cap, fills: fills.length, chD, halfD: half ? chOf(half) : null, chMin: Math.round(Math.min(...L.all.map((q) => Math.min(...chAll.map((c) => Math.hypot(q.x - c.x, q.z - c.z)))))), ch: L.ch && { x: Math.round(L.ch.x), z: Math.round(L.ch.z) } });
    }
    return out;
  },
};
