// 공용 도구($·isTouch·clamp·wrapA), 저장 불러오기·예전 저장 고치기·persist, 맵·서버 결정, 장비→겉모습 (#86 에서 main.js 를 나눔. 파일 순서는 src/main.js, 규칙은 notes/prototype-v1.md 코드 구조)
import { tintGear, lcClean } from '../lookcolors.js'; // #155
import { NSMODE } from '../boot.js';
import { useNamsongi } from '../namsongi.js';
import { WEAPONS, HAIR, WEAR, CLOTHES, WEAR_START, BACK_LOOKS } from '../balance.js';
import { RIDE_BY } from '../rides.js';
import { equipGear, ACCESSORIES } from '../gear.js';
import { useDonnaeko } from '../donnaeko.js';
import { useGate } from '../gate.js';
import { OUTFIT_OPTIONS, DEFAULT_OUTFIT, itemPrice, SKIN_TONES } from '../runner.js';
import { pickMapId } from '../maps.js';
import { createAbStats } from '../server.js';
import { saveKey, loadSave, stampGuest } from '../online.js';
import { state } from './state.js';
import { normLoot, wearUp } from '../loot.js';
import { ADJ, NOUN } from '../nickwords.js';

export const $ = (id) => document.getElementById(id);
export const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---------- 저장 ----------
export const KEY = saveKey(__DEV__ ? 'oreumoreum.dev' : 'oreumoreum.v1'); // 개발 서버는 기록을 따로. 로그인했으면 계정 사본 (#7)
export { ADJ, NOUN }; // 무작위 이름 낱말은 nickwords.js 에 (#162, 서버와 같이 씀)
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const save = loadSave(KEY);
const freshSave = !save.nick || !!save.reset; delete save.reset; // 처음 온 사람
save.nick ||= `${pick(ADJ)} ${pick(NOUN)}`;
save.outfit = { ...structuredClone(DEFAULT_OUTFIT), ...(save.outfit || {}) };
if (!save.hatBackV) { save.outfit.hat.back = true; save.hatBackV = 1; }
if (!save.nsV3) { save.tut = { step: 0, done: false, v: 3 }; if (save.trash) save.trash.tp = []; save.nsV1 = save.nsV2 = save.nsV3 = 1; save.jeong = 0; } // 새 튜토리얼(#31): 기존 유저도 한 번 다시 봄
if (!save.styleV5) { save.outfit.hat.color = '#5c9a3c'; save.outfit.shirt.color = '#e8d9b5'; save.outfit.pants.color = '#8a6a3c'; save.outfit.shoes.color = '#26262b'; save.styleV5 = 1; } // 모델 캐릭터 기본 색으로 한 번만 초기화
if (!save.styleV2) { save.outfit.hat.type = 'none'; save.outfit.glasses.type = 'none'; save.styleV2 = 1; } // 똥머리가 보이게 한 번만 초기화 save.outfit.shirt.type ||= 'tee'; save.outfit.shoes.type ||= 'road';
save.totalSteps ||= 0;
if (typeof save.coins !== 'number') save.coins = 5;
save.owned ||= {};
save.wishes ||= {};
if (!save.equip || typeof save.equip !== 'object') save.equip = {};
// 배낭(#31): 0 = 호주머니(처음), 1~5 = 배낭. 예전 저장의 1단계(용량 20)는 첫 배낭(BAGS[0], 20)을 가진 것으로 그대로 둠
if (!save.bagV) { if (freshSave || typeof save.equip.bag !== 'number') save.equip.bag = freshSave ? 0 : 1; save.bagV = 1; }
{ const v = Math.floor(Number(save.equip.weapon)), top = WEAPONS.filter((w) => !w.soon).length; save.equip.weapon = Math.max(1, Math.min(top, Number.isFinite(v) ? v : 1)); } // 무기 단계 (#38, 1 = 손)
// 탈것 (#69): save.rides = { own: [id], cur: id }. 예전 저장엔 없음
if (!save.rides || typeof save.rides !== 'object') save.rides = {};
save.rides.own = Array.isArray(save.rides.own) ? save.rides.own.filter((id, i, a) => RIDE_BY[id] && a.indexOf(id) === i) : [];
if (!save.rides.own.includes(save.rides.cur)) save.rides.cur = save.rides.own[save.rides.own.length - 1] || null;
save.rides.walk = save.rides.walk ? 1 : 0; // 1 = 탈것 없이 걸어 다니기를 골라 둠 (#109)
save.bowAmmo = Math.max(0, Math.min(5, Math.floor(Number(save.bowAmmo)) || 0)); // 예전(귤 하나에 5발)에 남은 화살. 다 쓸 때까지 귤을 안 씀 (#178: 지금은 한 발에 귤 1개라 새로 채워지지 않음)
// 무기 3~6단계 (#123): weaponUse = 골라 쓰는 무기 단계(가진 것 안), ammo = 총·머신건 귤 하나로 남은 발 수, 레이저는 남은 귤 몫 0~1 (활은 예전대로 bowAmmo)
{ const v = Math.floor(Number(save.weaponUse)); save.weaponUse = Math.max(1, Math.min(save.equip.weapon, Number.isFinite(v) && v > 0 ? v : save.equip.weapon)); }
if (!save.ammo || typeof save.ammo !== 'object' || Array.isArray(save.ammo)) save.ammo = {};
for (const w of WEAPONS) if (w.id !== 'bow' && (w.perGyul || w.gyulPerSec)) { const v = Number(save.ammo[w.id]), top = w.perGyul || 1; save.ammo[w.id] = Number.isFinite(v) ? Math.max(0, Math.min(top, w.perGyul ? Math.floor(v) : v)) : 0; }
for (const k of ['tool', 'bag', 'shoes']) { const lo = k === 'bag' ? 0 : 1, v = Math.floor(Number(save.equip[k])); save.equip[k] = Math.max(lo, Math.min(5, Number.isFinite(v) ? v : 1)); } // 장비 단계 (상점에서 다음 단계만 삼)
// 장비 단계 → 캐릭터 겉모습(outfit.gear 의 손·등·신발). 네트워크에도 그대로 실려 감
state.holdBow = false; // 귤 활을 손에 들고 있음 (#38): 쏘면 활, 줍기 누르면 다시 도구
state.holdRod = false; // 낚시하는 동안 손 도구를 숨김 (#44, 낚싯대는 fishing.js 가 따로 그림)
// 옷 (#52): save.clothes = { own: {id: 1}, wear: {칸: id} }. 머리는 모자와 다른 칸(hair)
const CLOTH = Object.fromEntries(CLOTHES.map((c) => [c.id, c])), WSLOT = Object.fromEntries(WEAR.slots.map((w) => [w.k, w])); export { CLOTH }; export { WSLOT };
if (!save.clothes || typeof save.clothes !== 'object') save.clothes = {};
export const CL = save.clothes; if (!CL.own || typeof CL.own !== 'object') CL.own = {}; if (!CL.wear || typeof CL.wear !== 'object') CL.wear = {};
Object.keys(CL.own).forEach((id) => { if (!CLOTH[id]) delete CL.own[id]; }); Object.values(WEAR_START).forEach((id) => { CL.own[id] = 1; });
WEAR.slots.forEach(({ k }) => { const id = CL.wear[k]; if (id && !(CLOTH[id]?.slot === k && CL.own[id])) delete CL.wear[k]; if (!CL.wear[k] && WEAR_START[k] && !(k in CL.wear)) CL.wear[k] = WEAR_START[k]; });
if (!save.outfit.gear || typeof save.outfit.gear !== 'object') save.outfit.gear = {};
{ const g = save.outfit.gear; if (ACCESSORIES[g.hat]?.slot === 'hair' || g.hat === 'hat:cap') { if (g.hat !== 'hat:cap') g.hair = g.hat; delete g.hat; } } // 예전 저장: 머리가 hat 칸에 있었음
export let wearRefund = 0; // 예전 옷 색 구매·초록 모자 머리를 귤로 돌려줌 (한 번만)
if (!save.wearV) {
  Object.keys(save.owned || {}).forEach((k) => { const [part, kind, ...v] = k.split(':'); if (!OUTFIT_OPTIONS[part]) return; const pr = itemPrice(part, kind, v.join(':')); if (pr > 0) wearRefund += pr; });
  if (save.hairs?.['hat:cap']) { wearRefund += HAIR.capRefund; delete save.hairs['hat:cap']; }
  save.owned = {}; ['hat', 'shirt', 'pants', 'shoes'].forEach((k) => { save.outfit[k] = structuredClone(DEFAULT_OUTFIT[k]); });
  if (wearRefund) save.coins += wearRefund; save.wearV = 1;
}
const wearTier = (k) => { const id = CL.wear[k]; return id && CLOTH[id] ? CLOTH[id].tier : 0; };
normLoot(save); // 재료·장비 등급·강화·안 쓰는 장비 (#140, src/loot.js)
export const wearV = (k) => wearUp(save, k, WSLOT[k].v[wearTier(k)]); // 지금 입은 옷의 능력치 (#140 등급·강화를 얹음)
export const clothGear = () => { const hasHair = ACCESSORIES[save.outfit.gear.hair]?.slot === 'hair' && !ACCESSORIES[save.outfit.gear.hair].builtin, out = {};
  WEAR.slots.forEach(({ k }) => { out[k] = CL.wear[k] || `${k}:none`; });
  if (!hasHair) out.hat = 'hat:cap'; // 머리를 고르기 전(구운 머리·모자)엔 모자를 겹쳐 쓰지 않음
  return out; };
// 배낭 겉모습 (#164): save.backs = { own: { id: 1 }, cur }. 예전·깨진 저장은 비움
export const BACK_BY = Object.fromEntries(BACK_LOOKS.map((b) => [b.id, b]));
{ const B = save.backs; if (B !== undefined) { const own = {}; if (B && typeof B.own === 'object') for (const k of Object.keys(B.own)) if (BACK_BY[k] && B.own[k]) own[k] = 1; save.backs = { own, cur: own[B?.cur] ? B.cur : null }; } }
export const syncEquipGear = () => { save.outfit.gear = { ...(save.outfit.gear && typeof save.outfit.gear === 'object' ? save.outfit.gear : {}), ...equipGear(save.equip), ...clothGear() }; tintGear(save.outfit.gear, save.look?.colors); /* 기본 옷은 고른 색 (#155) */ { const b = BACK_BY[save.backs?.cur]; if (b && save.backs.own?.[b.id] && (save.equip.bag || 0) >= b.need) save.outfit.gear.back = 'back:' + b.id + (state.backFill || 0); } /* 배낭 겉모습 (#164) */ if (state.holdBow) save.outfit.gear.hand = 'hand:' + ((WEAPONS[save.weaponUse - 1] || WEAPONS[1]).id === 'hand' ? 'bow' : (WEAPONS[save.weaponUse - 1] || WEAPONS[1]).id); if (state.holdRod) save.outfit.gear.hand = 'hand:none'; };
syncEquipGear();
// 캐릭터 고르기 (#51): save.look = { sex: 'm'|'f', skin: 0~2 }. 없으면 입장 뒤 튜토리얼보다 먼저 고르기 화면. save.hairs = 가진 머리(hat 칸 장비)
export const lookS = { open: false, t: 0, sex: 'm', skin: 0, colors: { hat: 0, top: 0, bottom: 0, shoes: 0 }, oldPlayer: !freshSave && !save.look }; // 예전부터 하던 사람은 쓰던 초록 모자도 가짐
if (!save.hairs || typeof save.hairs !== 'object') save.hairs = {};
if (save.look && typeof save.look === 'object') {
  save.look.sex = save.look.sex === 'f' ? 'f' : 'm'; save.look.skin = Math.max(0, Math.min(SKIN_TONES.length - 1, Math.floor(Number(save.look.skin)) || 0));
  save.hairs[HAIR.start[save.look.sex]] = 1;
  if (!save.hairs[save.outfit.gear.hair]) save.outfit.gear.hair = HAIR.start[save.look.sex]; // 안 가진 머리를 쓰고 있으면 기본 머리로
  syncEquipGear();
  save.outfit.skin = { color: SKIN_TONES[save.look.skin] };
  if (save.look.colors != null) save.look.colors = lcClean(save.look.colors); // 기본 옷 색 (#155): 없으면 지금 기본색
} else delete save.look;
if (!save.recycle || typeof save.recycle !== 'object') save.recycle = {};
save.recycle.visits = Math.max(0, Math.floor(Number(save.recycle.visits) || 0)); // 클린하우스에 버린 횟수
save.recycle.gyul = Math.max(0, Math.floor(Number(save.recycle.gyul) || 0)); // 클린하우스에서 번 귤 누적
state.resetting = false;
// 서버 (#35 → #98): 전투 오름 하나. 예전 save.server = clean 은 battle 로 (장비·귤·치운 양은 그대로, 쓰레기 칸은 trash.js 에서 합침)
if (save.server != null) save.server = 'battle';
delete save.srvSwitch; // 예전 '서버 바꾸기' 새로고침 표시
export const ab = createAbStats(KEY + '.ab'); // 서버별 접속 횟수·플레이 시간·주운 수 (기기 기록, 처음부터 다시 해도 남음)
export const writeLocal = () => { stampGuest(save); try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* 저장 불가 환경 */ } };
state.account = null; // 멀티 서버 계정 (#7). 서버 주소가 없으면 null
export const persist = () => { if (state.resetting) return; writeLocal(); state.account?.dirty(); };

export const MAP_ID = pickMapId(save.map);
export const prevMap = save.prevMap || null; save.prevMap = null;
save.map = MAP_ID; persist();
if (MAP_ID === 'donnaeko') useDonnaeko();
if (MAP_ID === 'gate') useGate();
if (NSMODE) useNamsongi();

let seedN = 7;
export const rnd = () => { seedN = (seedN * 16807) % 2147483647; return seedN / 2147483647; };
