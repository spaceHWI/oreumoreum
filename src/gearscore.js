// 장비 점수 (#137, notes/growth-loop.md 3절). 수치는 balance.js GROWTH·ZONES. 저장(save)만 읽는 순수 함수라 게임·도구·멀티가 같이 씀
// 칸 10개: 도구·배낭·신발·무기 (save.equip) + 옷 6칸 (save.clothes.wear 에 입은 옷의 단계). 합이 장비 점수
// 등급·강화 자리 (다음 이슈에서 채움): 장비는 save.gearUp = { 칸: { g, e } }, 옷은 save.clothes.up = { 옷 id: { g, e } }. 없으면 0
import { GROWTH, ZONES, WEAR, CLOTHES, GYUL_PICK } from './balance.js';

const CLOTH = Object.fromEntries(CLOTHES.map((c) => [c.id, c]));
const WEAR_K = WEAR.slots.map((w) => w.k);
export const GEAR_SLOTS = ['tool', 'bag', 'shoes', 'weapon', ...WEAR_K];
const int = (v, lo, hi) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo; };

// 장비 하나 점수: 단계(0 = 없음·호주머니)·등급(0 보통 ~ 3 전설)·강화(0~enhMax)
export function itemScore(tier, grade = 0, enh = 0) {
  const b = GROWTH.score[int(tier, 0, GROWTH.score.length - 1)] || 0;
  if (!b) return 0;
  return Math.round(b * (1 + (GROWTH.grade[int(grade, 0, GROWTH.grade.length - 1)] || 0)) * (1 + GROWTH.enh * int(enh, 0, GROWTH.enhMax)));
}
const isObj = (v) => v && typeof v === 'object';
// 칸 k 의 지금 단계 (옷은 입은 옷의 단계)
export function slotTier(save, k) {
  if (WEAR_K.includes(k)) { const id = save?.clothes?.wear?.[k]; return id && CLOTH[id] ? CLOTH[id].tier : 0; }
  return int(save?.equip?.[k], 0, 6);
}
// 칸 k 의 등급·강화 (cloth 를 주면 그 옷)
export function slotUp(save, k, clothId) {
  const u = WEAR_K.includes(k) ? (isObj(save?.clothes?.up) ? save.clothes.up[clothId ?? save?.clothes?.wear?.[k]] : null) : (isObj(save?.gearUp) ? save.gearUp[k] : null);
  return isObj(u) ? { g: int(u.g, 0, 3), e: int(u.e, 0, GROWTH.enhMax) } : { g: 0, e: 0 };
}
export function slotScore(save, k) { const u = slotUp(save, k); return itemScore(slotTier(save, k), u.g, u.e); }
// 장비 점수 { total, pick 줍는 힘, fight 싸우는 힘, by: {칸: 점수} }
export function gearScore(save) {
  const by = {}; let total = 0;
  for (const k of GEAR_SLOTS) { by[k] = slotScore(save, k); total += by[k]; }
  const sum = (ks) => ks.reduce((s, k) => s + (by[k] || 0), 0);
  return { total, pick: sum(GROWTH.pick), fight: sum(GROWTH.fight), by };
}
// 칸 k 를 단계 tier(옷이면 그 옷 id)로 바꾸면 점수가 얼마나 달라지나 (상점·옷장 ▲/▼)
export function scoreDiff(save, k, tier, clothId) {
  const u = clothId ? slotUp(save, k, clothId) : { g: 0, e: 0 };
  return itemScore(tier, u.g, u.e) - slotScore(save, k);
}
// 구역 권장 점수와 견준 색: 'r' 빨강(낮음) · 'y' 노랑(맞음) · 'g' 초록(넘음). 구역이 없으면 ''
export function zoneTone(score, zone) {
  const Z = ZONES.find((z) => z.id === zone); if (!Z) return '';
  const k = score / Z.rec;
  return k < GROWTH.red ? 'r' : k >= GROWTH.green ? 'g' : 'y';
}
export const zoneRec = (zone) => ZONES.find((z) => z.id === zone)?.rec || 0;

// 귤 모으는 범위(m, #151): 기본 + 배낭 단계마다 더함 (호주머니·배낭 1단계 = 기본). 전리품 장비(#140)의 같은 능력치도 여기에 더한다
export const gyulPickR = (save) => GYUL_PICK.r + GYUL_PICK.perBag * Math.max(0, (save?.equip?.bag || 0) - 1);
