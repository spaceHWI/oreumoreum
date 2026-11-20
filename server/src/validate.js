// 저장 확인 (#7): 클라이언트가 보낸 저장을 그대로 믿지 않는다
// - 가진 것(옷·탈것·머리·장비 단계)은 목록에 있는 것만
// - 새로 산 것의 값을 더하고, 귤이 늘어난 몫(번 귤 = 지금 귤 + 쓴 귤 - 지난 귤)은 계정의 '벌 수 있는 몫(credit)' 안에서만
//   credit 은 시간이 지나면 earnPerSec 씩 차고 earnBurst 에서 멈춤 (토큰 통)
// - 치운 양(누적)도 같은 방식
import { cleanText } from '../../src/safetext.js';
import { NET, TOOLS, BAGS, SHOES, WEAPONS, CLOTHES, WEAR_START, wearPrice, RIDES, HAIR } from '../../src/balance.js';

const CLOTH = Object.fromEntries(CLOTHES.map((c) => [c.id, c]));
const RIDE = Object.fromEntries(RIDES.list.map((r) => [r.id, r]));
const START_CLOTH = new Set(Object.values(WEAR_START));
const START_HAIR = new Set(Object.values(HAIR.start));
const W_TOP = WEAPONS.filter((w) => !w.soon).length;
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const int = (v, lo, hi, d) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
const TIERS = { tool: [1, TOOLS], bag: [0, BAGS], shoes: [1, SHOES] };

export const FRESH = { coins: 5, equip: { tool: 1, bag: 0, shoes: 1, weapon: 1 }, clothes: { own: {}, wear: {} }, rides: { own: [], cur: null }, hairs: {}, trash: { total: 0 } };

function norm(s) {
  s.coins = int(s.coins, 0, 1e9, 0);
  if (!isObj(s.equip)) s.equip = {};
  for (const [k, [lo]] of Object.entries(TIERS)) s.equip[k] = int(s.equip[k], lo, 5, lo);
  s.equip.weapon = int(s.equip.weapon, 1, W_TOP, 1);
  if (!isObj(s.clothes)) s.clothes = {};
  const C = s.clothes; if (!isObj(C.own)) C.own = {}; if (!isObj(C.wear)) C.wear = {};
  for (const id of Object.keys(C.own)) if (!CLOTH[id]) delete C.own[id];
  for (const [k, id] of Object.entries(C.wear)) if (id && !(CLOTH[id]?.slot === k && (C.own[id] || START_CLOTH.has(id)))) delete C.wear[k];
  if (!isObj(s.rides)) s.rides = {};
  s.rides.own = Array.isArray(s.rides.own) ? s.rides.own.filter((id, i, a) => RIDE[id] && a.indexOf(id) === i) : [];
  if (!s.rides.own.includes(s.rides.cur)) s.rides.cur = s.rides.own[s.rides.own.length - 1] || null;
  if (!isObj(s.hairs)) s.hairs = {};
  for (const k of Object.keys(s.hairs)) if (!(HAIR.byKey[k] || START_HAIR.has(k))) delete s.hairs[k];
  if (!isObj(s.trash)) s.trash = {};
  s.trash.total = int(s.trash.total, 0, 1e9, 0);
  s.mealFree = s.mealFree ? 1 : 0; // 스톤 첫 식사 무료를 썼는지 (#93)
  s.nick = cleanText(s.nick, NET.nickMax); // 제어·방향 글자·꺾쇠 빼고 16자 (#84)
  return s;
}

// 새로 산 것들의 값
function spentOf(P, S) {
  let sp = 0;
  // 장비는 순서 없이 산다 (#111): 오른 단계의 값만 (건너뛴 단계 값은 더하지 않음)
  for (const [k, [, list]] of Object.entries(TIERS)) if (S.equip[k] > P.equip[k]) sp += list[S.equip[k] - 1]?.price || 0;
  if (S.equip.weapon > P.equip.weapon) sp += WEAPONS[S.equip.weapon - 1]?.price || 0;
  for (const id of Object.keys(S.clothes.own)) if (!P.clothes.own[id] && !START_CLOTH.has(id)) sp += wearPrice(CLOTH[id]) || 0;
  for (const id of S.rides.own) if (!P.rides.own.includes(id)) sp += RIDE[id].price;
  for (const k of Object.keys(S.hairs)) if (!P.hairs[k] && !START_HAIR.has(k)) sp += HAIR.price[k] || 0;
  return sp;
}
function revertItems(P, S) {
  for (const k of [...Object.keys(TIERS), 'weapon']) S.equip[k] = Math.min(S.equip[k], P.equip[k]);
  for (const id of Object.keys(S.clothes.own)) if (!P.clothes.own[id] && !START_CLOTH.has(id)) delete S.clothes.own[id];
  for (const [k, id] of Object.entries(S.clothes.wear)) if (id && !(S.clothes.own[id] || START_CLOTH.has(id))) delete S.clothes.wear[k];
  S.rides.own = S.rides.own.filter((id) => P.rides.own.includes(id)); if (!S.rides.own.includes(S.rides.cur)) S.rides.cur = S.rides.own[S.rides.own.length - 1] || null;
  for (const k of Object.keys(S.hairs)) if (!P.hairs[k] && !START_HAIR.has(k)) delete S.hairs[k];
}

// prev: 지난 저장(없으면 null), next: 받은 저장, acc: { credit, pickCredit, savedAt }, t: 지금(ms)
// → { save, fixed: [바로잡은 칸], acc: 새 credit }
// free: 어드민 계정 (#84, 시크릿 ADMIN_SUBS). 귤·치운 양 몫을 보지 않음 (개발자 버튼 '귤 채우기')
export function checkSave(prev, next, acc, t, { migrate = false, free = false } = {}) {
  if (!isObj(next)) throw new Error('bad save');
  const S = norm(JSON.parse(JSON.stringify(next)));
  const P = norm(JSON.parse(JSON.stringify(prev || FRESH)));
  const fixed = [];
  const dt = Math.max(0, Math.min(NET.earnWindow, (t - (acc.savedAt || t)) / 1000));
  let credit = Math.min(NET.earnBurst, (acc.credit ?? NET.earnBurst) + dt * NET.earnPerSec);
  let pickCredit = Math.min(NET.pickBurst, (acc.pickCredit ?? NET.pickBurst) + dt * NET.pickPerSec);
  if (free) return { save: S, fixed, acc: { credit, pickCredit } };
  if (P.mealFree && !S.mealFree) { S.mealFree = 1; fixed.push('mealFree'); } // 한 번 쓴 첫 식사는 되돌릴 수 없음 (어드민은 위에서 free 로 빠짐)
  if (migrate && !prev) {
    // 기기 기록 옮기기: 지난 기록을 확인할 길이 없어 목록 확인과 귤 상한만
    if (S.coins > NET.migrateCoinsMax) { S.coins = NET.migrateCoinsMax; fixed.push('coins'); }
    return { save: S, fixed, acc: { credit, pickCredit } };
  }
  let spent = spentOf(P, S);
  if (spent > P.coins + credit) { revertItems(P, S); spent = 0; fixed.push('items'); }
  const gain = S.coins + spent - P.coins;
  if (gain > credit) { S.coins = Math.max(0, Math.floor(P.coins + credit - spent)); fixed.push('coins'); }
  credit -= Math.max(0, S.coins + spent - P.coins);
  const pg = S.trash.total - P.trash.total;
  if (pg > pickCredit) { S.trash.total = Math.floor(P.trash.total + pickCredit); fixed.push('picked'); }
  pickCredit -= Math.max(0, S.trash.total - P.trash.total);
  return { save: S, fixed, acc: { credit, pickCredit } };
}
