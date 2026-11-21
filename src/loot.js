// 전리품·재료·강화·장비 등급 셈 (#140, notes/growth-loop.md 5절). DOM 없는 순수 함수: 게임(src/game/loot.js·forge.js)·서버(validate.js)·도구(tools/loot.js·econ.js)가 같이 씀
// 저장
//   save.mats = { m1~m5 구역 재료, r1~r5 귀한 재료: 수 }   재료 주머니 (가방과 따로, 무게 없음)
//   save.gearUp = { tool|bag|shoes|weapon: { g 등급 0~3, e 강화 0~5 } }   지금 그 칸 단계 장비의 등급·강화 (단계를 새로 사면 0 으로, 예전 것은 안 쓰는 장비로)
//   save.clothes.up = { 옷 id: { g, e } }   옷은 옷마다 (갈아입어도 따라감)
//   save.loot = [{ s 칸, t 단계, g, e }]   안 쓰는 장비 (얻었지만 안 입은 것)
//   save.lootAuto = 1|0   칸마다 가장 좋은 것 하나만 남기고 자동으로 귤로 바꾸기 (기본 켬)
import { LOOT, GROWTH, ZONE_BOSS, TOOLS, BAGS, SHOES, WEAPONS, CLOTHES, WEAR, WEAR_START } from './balance.js';
import { GEAR_SLOTS, itemScore, slotTier, slotUp, abilityCloth } from './gearscore.js';

export { GEAR_SLOTS };
export const GEAR4 = ['tool', 'bag', 'shoes', 'weapon'];
export const WEAR_K = WEAR.slots.map((w) => w.k);
export const MATS = LOOT.mats;
export const MAT = Object.fromEntries(MATS.flatMap((m) => [[m.id, { ...m, kind: 'mat' }], [m.rare, { z: m.z, id: m.rare, name: ZONE_BOSS.list[m.z]?.mat || m.name, color: '#ffd27a', kind: 'rare' }]]));
export const matOfZone = (z) => MATS[Math.max(1, Math.min(MATS.length, z | 0)) - 1];
const CLOTH = Object.fromEntries(CLOTHES.map((c) => [c.id, c]));
const START = new Set(Object.values(WEAR_START));
export const clothId = (k, t) => CLOTHES.find((c) => c.slot === k && c.tier === t)?.id || null;
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const int = (v, lo, hi, d = lo) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
const TOP_T = { tool: TOOLS.length, bag: BAGS.length, shoes: SHOES.length, weapon: WEAPONS.length };
const topT = (k) => TOP_T[k] || 5;

// 저장 바로잡기 (게임 불러올 때·서버 확인). 바뀐 칸 이름 목록을 돌려줌
export function normLoot(s) {
  const fixed = [];
  if (!isObj(s.mats)) { if (s.mats != null) fixed.push('mats'); s.mats = {}; }
  for (const k of Object.keys(s.mats)) {
    const v = Math.floor(Number(s.mats[k]));
    if (!MAT[k] || !Number.isFinite(v) || v < 0) { delete s.mats[k]; fixed.push('mats'); continue; }
    if (v === 0) { delete s.mats[k]; continue; }
    if (v > 99999) { s.mats[k] = 99999; fixed.push('mats'); } else s.mats[k] = v;
  }
  const up = (o, key) => { // { g, e } 바로잡기
    if (!isObj(o)) return null;
    const g = Math.floor(Number(o.g)) || 0, e = Math.floor(Number(o.e)) || 0;
    if (g < 0 || g > 3 || e < 0 || e > GROWTH.enhMax || !Number.isFinite(g) || !Number.isFinite(e)) fixed.push(key);
    const r = { g: int(g, 0, 3), e: int(e, 0, GROWTH.enhMax) };
    return r.g || r.e ? r : null;
  };
  if (!isObj(s.gearUp)) { if (s.gearUp != null) fixed.push('gearUp'); s.gearUp = {}; }
  for (const k of Object.keys(s.gearUp)) { const r = GEAR4.includes(k) ? up(s.gearUp[k], 'gearUp') : (fixed.push('gearUp'), null); if (r) s.gearUp[k] = r; else delete s.gearUp[k]; }
  if (isObj(s.clothes)) {
    if (!isObj(s.clothes.up)) { if (s.clothes.up != null) fixed.push('clothesUp'); s.clothes.up = {}; }
    for (const id of Object.keys(s.clothes.up)) { const r = CLOTH[id] ? up(s.clothes.up[id], 'clothesUp') : (fixed.push('clothesUp'), null); if (r) s.clothes.up[id] = r; else delete s.clothes.up[id]; }
  }
  if (!Array.isArray(s.loot)) { if (s.loot != null) fixed.push('loot'); s.loot = []; }
  const L = [];
  for (const it of s.loot) {
    if (!isObj(it) || !GEAR_SLOTS.includes(it.s)) { fixed.push('loot'); continue; }
    const t = Math.floor(Number(it.t)), g = Math.floor(Number(it.g)) || 0, e = Math.floor(Number(it.e)) || 0;
    if (!(t >= 1 && t <= topT(it.s)) || (WEAR_K.includes(it.s) && !clothId(it.s, t)) || g < 0 || g > 3 || e < 0 || e > GROWTH.enhMax) { fixed.push('loot'); continue; }
    L.push({ s: it.s, t, g, e });
  }
  if (L.length > LOOT.spareMax) { L.length = LOOT.spareMax; fixed.push('loot'); }
  s.loot = L;
  s.lootAuto = s.lootAuto === 0 || s.lootAuto === false ? 0 : 1;
  return [...new Set(fixed)];
}

// ---------- 장비 하나 ----------
export function baseName(k, t) {
  if (k === 'tool') return TOOLS[t - 1]?.name || '';
  if (k === 'bag') return BAGS[t - 1]?.name || '';
  if (k === 'shoes') return SHOES[t - 1]?.name || '';
  if (k === 'weapon') return WEAPONS[t - 1]?.name || '';
  return CLOTH[clothId(k, t)]?.name || '';
}
export const gradeName = (g) => LOOT.gradeName[g] || '';
export const gradeColor = (g) => LOOT.gradeColor[g] || LOOT.gradeColor[0];
export const itemName = (it) => `${it.g ? gradeName(it.g) + ' ' : ''}${baseName(it.s, it.t)}${it.e ? ` +${it.e}` : ''}`;
export const itemPts = (it) => itemScore(it.t, it.g, it.e);
// 지금 그 칸에 쓰는 장비 (옷은 능력을 주는 옷, #179)
export function curItem(save, k) { const t = slotTier(save, k), u = slotUp(save, k); return { s: k, t, g: u.g, e: u.e, id: WEAR_K.includes(k) ? abilityCloth(save, k) : null }; } // 옷은 능력을 주는 옷 (#179)
// 입을 수 있나: 장비는 지금 단계와 같을 때만(낮은 단계로 내려가면 산 단계를 잃음), 옷은 가진 옷일 때만 (값을 내지 않은 것을 얻지 않게)
export function canEquip(save, it) {
  if (GEAR4.includes(it.s)) return it.t >= 1 && it.t === slotTier(save, it.s);
  const id = clothId(it.s, it.t); return !!id && (!!save?.clothes?.own?.[id] || START.has(id));
}
// 견주기: 이 장비를 입으면 점수가 얼마나 달라지나
export const diffPts = (save, it) => itemPts(it) - itemPts(curItem(save, it.s));
// 귤로 바꾸면 받는 귤
export const sellValue = (it) => Math.max(1, Math.round((GROWTH.price[Math.max(1, it.t)] || 0) * (LOOT.sell[it.g] || 0) * (1 + LOOT.sellEnh * (it.e || 0))));
// 전설 효과 이름 (칸에 따라)
export const fxOf = (k) => Object.keys(LOOT.fx).find((f) => LOOT.fx[f].slots.includes(k)) || null;

// ---------- 능력 ----------
// 그 칸 장비의 능력 배율 (1 + 등급) × (1 + 강화 × 12%). 무기는 가장 높은 무기를 골라 쓸 때만 (손에 바꿔 들면 그 무기 값)
export function upMul(save, k) {
  if (k === 'weapon' && (save?.weaponUse || save?.equip?.weapon) !== save?.equip?.weapon) return 1;
  if (!slotTier(save, k) && k !== 'weapon') return 1;
  const u = slotUp(save, k); return (1 + (GROWTH.grade[u.g] || 0)) * (1 + GROWTH.enh * u.e);
}
// 신발·옷: 기본(unit)보다 나은 몫에만 statK 만큼
export function statUp(save, k, v, unit) { const m = upMul(save, k); if (m === 1) return v; const sk = LOOT.statK[k] ?? 1; return unit + (v - unit) * (1 + (m - 1) * sk); }
// 입은 것 중 전설 효과가 있나
export function legendOn(save, fx) { const F = LOOT.fx[fx]; return !!F && F.slots.some((k) => slotTier(save, k) > 0 && slotUp(save, k).g === 3); }

// ---------- 강화 ----------
// 단계 t 장비를 e → e+1 로: { z 구역, mat 재료 id, n 수, rare 귀한 재료 id, rn 수, gyul } (끝이면 null)
export function enhCost(t, e) {
  if (e >= GROWTH.enhMax || t < 1) return null;
  const M = matOfZone(Math.min(5, t)), E = LOOT.enh;
  return { z: M.z, mat: M.id, n: E.mats[e], rare: M.rare, rn: E.rare[e] || 0, gyul: Math.round((GROWTH.price[t] || GROWTH.price[1]) * E.gyul[e]) };
}
export const canPay = (save, c) => !!c && (save.coins || 0) >= c.gyul && (save.mats?.[c.mat] || 0) >= c.n && (!c.rn || (save.mats?.[c.rare] || 0) >= c.rn);
// 강화할 수 있는 칸인가 (호주머니·안 입은 옷 칸은 안 됨)
export const enhOk = (save, k) => slotTier(save, k) >= 1;
// 칸 k 를 한 번 강화 (값을 냈으면 true). 저장만 바꿈 (persist·화면은 부르는 쪽)
export function enhance(save, k) {
  if (!enhOk(save, k)) return false;
  const cur = curItem(save, k), c = enhCost(cur.t, cur.e); if (!canPay(save, c)) return false;
  save.coins -= c.gyul; save.mats[c.mat] -= c.n; if (c.rn) save.mats[c.rare] -= c.rn;
  for (const id of [c.mat, c.rare]) if (save.mats[id] <= 0) delete save.mats[id];
  setUp(save, k, { g: cur.g, e: cur.e + 1 }, cur.id);
  return true;
}
// 칸의 등급·강화를 씀 (옷은 그 옷 id)
export function setUp(save, k, u, clothIdNow) {
  const v = u && (u.g || u.e) ? { g: u.g | 0, e: u.e | 0 } : null;
  if (WEAR_K.includes(k)) { const id = clothIdNow ?? abilityCloth(save, k); if (!id) return; save.clothes.up ||= {}; if (v) save.clothes.up[id] = v; else delete save.clothes.up[id]; return; }
  save.gearUp ||= {}; if (v) save.gearUp[k] = v; else delete save.gearUp[k];
}

// ---------- 떨어지는 것 ----------
const pickW = (w, r) => { const s = w.reduce((a, b) => a + b, 0); let x = r() * s; for (let i = 0; i < w.length; i++) { if ((x -= w[i]) < 0) return i; } return w.length - 1; };
// 장비 하나 굴리기: src 'enemy'|'den'|'treasure'|'boss'
export function rollGear(save, src, zone, r = Math.random) {
  const z = Math.max(1, Math.min(5, zone | 0));
  const slots = GEAR_SLOTS.filter((k) => slotTier(save, k) >= 1); if (!slots.length) return null;
  const k = slots[Math.floor(r() * slots.length)];
  const zt = k === 'weapon' && z === 5 && r() < 0.5 ? 6 : z;
  const t = Math.min(zt, slotTier(save, k)); if (t < 1 || (WEAR_K.includes(k) && !clothId(k, t))) return null;
  let g = pickW(LOOT.grade[src] || LOOT.grade.enemy, r);
  if (g === 3 && !((src === 'boss' || src === 'treasure') && z >= LOOT.legendZ)) g = 2;
  return { s: k, t, g, e: 0 };
}
// 한 번 얻는 것: { mats: { id: 수 }, gear: 장비|null }
export function rollDrop(save, src, zone, r = Math.random) {
  const z = Math.max(1, Math.min(5, zone | 0)), M = matOfZone(z), out = { mats: {}, gear: null };
  const add = (id, n) => { if (n > 0) out.mats[id] = (out.mats[id] || 0) + n; };
  if (src === 'enemy') { if (r() < LOOT.enemy.mat) add(M.id, 1); if (r() < LOOT.enemy.gear) out.gear = rollGear(save, src, z, r); }
  else if (src === 'den') { add(M.id, LOOT.den.mats[z]); if (r() < LOOT.den.gear) out.gear = rollGear(save, src, z, r); }
  else if (src === 'treasure') { add(M.id, LOOT.treasure.mats[z]); if (r() < LOOT.treasure.gear) out.gear = rollGear(save, src, z, r); }
  else if (src === 'boss') { add(M.rare, 1); add(M.id, LOOT.boss.mats[z]); if (r() < LOOT.boss.gear) out.gear = rollGear(save, src, z, r); }
  return out;
}

// ---------- 얻기·입기·귤로 바꾸기 (저장만 바꿈) ----------
// 안 쓰는 장비 정리: 자동이면 입을 수 없거나 지금 것보다 못한 것은 귤로, 칸마다 가장 좋은 것 하나만. 칸 수가 넘으면 낮은 것부터. → 귤로 바꾼 [장비, 귤]
export function tidySpare(save) {
  const out = [], keep = [];
  const L = save.loot.slice().sort((a, b) => itemPts(b) - itemPts(a));
  const best = {};
  for (const it of L) {
    const bad = save.lootAuto && (!canEquip(save, it) || diffPts(save, it) <= 0 || best[it.s]);
    if (bad) out.push(it); else { keep.push(it); best[it.s] = 1; }
  }
  while (keep.length > LOOT.spareMax) out.push(keep.pop());
  save.loot = keep;
  const sold = out.map((it) => [it, sellValue(it)]); for (const [it, v] of sold) { save.coins += v; noteSold(save, it); }
  return sold;
}
// 새 장비를 안 쓰는 장비 칸에 넣음
export function addSpare(save, it) { save.loot.push({ s: it.s, t: it.t, g: it.g | 0, e: it.e | 0 }); }
// 안 쓰는 장비 i 를 입음: 지금 것은 안 쓰는 장비로 (등급·강화가 있는 것만, 보통 +0 은 산 단계 그대로라 남길 게 없음). 입었으면 true
export function equipSpare(save, i) {
  const it = save.loot[i]; if (!it || !canEquip(save, it)) return false;
  const cur = curItem(save, it.s);
  save.loot.splice(i, 1);
  if (cur.t >= 1 && (cur.g || cur.e)) addSpare(save, cur);
  if (WEAR_K.includes(it.s)) { const id = clothId(it.s, it.t); setUp(save, it.s, it, id); } // 겉모습(wear)은 그대로, 능력은 가진 옷 중 가장 좋은 것 (#179)
  else setUp(save, it.s, it);
  return true;
}
export function sellSpare(save, i) { const it = save.loot[i]; if (!it) return 0; save.loot.splice(i, 1); const v = sellValue(it); save.coins += v; noteSold(save, it); return v; }
// 판 것 목록 (#188): 다음 서버 저장에 실어 보내 서버가 그 귤을 인정함 (서버가 받으면 online.js 가 보낸 만큼 지움). 멀티가 아니면 쌓이기만 하니 64개까지
export function noteSold(save, it) { const L = Array.isArray(save.sold) ? save.sold : (save.sold = []); L.push({ s: it.s, t: it.t, g: it.g | 0, e: it.e | 0 }); if (L.length > 64) L.splice(0, L.length - 64); }
// 장비 단계를 새로 샀을 때(부르는 쪽이 equip 을 바꾸기 전): 예전 단계 장비의 등급·강화는 안 쓰는 장비로
export function tierUp(save, k) {
  const cur = curItem(save, k); if (!GEAR4.includes(k)) return;
  if (cur.t >= 1 && (cur.g || cur.e)) addSpare(save, cur);
  setUp(save, k, null);
}

// ---------- 게임이 쓰는 능력 (식사 버프와 따로 곱함) ----------
export const shoeSpeed = (save) => statUp(save, 'shoes', SHOES[Math.max(1, save?.equip?.shoes || 1) - 1].speed, 1);
export const weaponMul = (save) => upMul(save, 'weapon');
const WEAR_UNIT = { rare: 1, hp: 1, regen: 1, pocket: 0, gyul: 0, guard: 0 };
const WEAR_CAP = { guard: 0.6 };
// 옷 칸 k 의 능력치 v(기본 단계 값)에 등급·강화를 얹음
export function wearUp(save, k, v) {
  const st = WEAR.slots.find((w) => w.k === k)?.stat, u = WEAR_UNIT[st] ?? 1;
  let r = statUp(save, k, v, u); if (WEAR_CAP[st] != null) r = Math.min(WEAR_CAP[st], r);
  return st === 'pocket' ? Math.round(r) : Math.round(r * 1000) / 1000;
}
// 입은 것 가운데 가장 높은 등급 (멀티 이름표 색)
export const topGrade = (save) => GEAR_SLOTS.reduce((m, k) => (slotTier(save, k) > 0 ? Math.max(m, slotUp(save, k).g) : m), 0);
