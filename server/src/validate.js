// 저장 확인 (#7): 클라이언트가 보낸 저장을 그대로 믿지 않는다
// - 가진 것(옷·탈것·머리·장비 단계)은 목록에 있는 것만
// - 새로 산 것의 값을 더하고, 귤이 늘어난 몫(번 귤 = 지금 귤 + 쓴 귤 - 지난 귤)은 계정의 '벌 수 있는 몫' 안에서만 (#144)
//   ① credit: 시간이 지나면 earnPerSec 씩 차고 earnBurst 에서 멈춤 (토큰 통. 적·업적·낚시·보너스)
//   ③ swarm: 저장의 save.swarm.earn(들판 떼로 번 귤 누적, #173)이 늘어난 몫을 지난 저장 뒤 시간 × swarmPerSec 까지 (모아 두지 않음: 자주 저장해도 늘지 않음)
//   ② bank: 방이 받아 준 줍기 × 더미 구역 값 (roomcore → Accounts.earn). 클린하우스에 버린 귤 몫. 번 귤은 ② 에서 먼저 씀
// - 치운 양(누적)도 같은 방식
import { cleanText, nickOk, nickBad, randomNick } from '../../src/safetext.js';
import { NET, TOOLS, BAGS, SHOES, BOOTS, WEAPONS, CLOTHES, WEAR_START, wearPrice, RIDES, HAIR, LOOK_COLORS, SEASON, BACK_LOOKS } from '../../src/balance.js';
import { cleanXmas, calOpenable, calCost, calReward, calClothIds } from '../../src/seasoncal.js';
import { normLoot } from '../../src/loot.js';
import { checkLv } from '../../src/augments.js';
import { TITLES, NOTES } from '../../src/punktext.js';
import { recognize, cleanSold, normCred } from './earn.js';

// 예전 값 (#144): 실서버 클라이언트가 아직 #137 앞 값 표(v0.23.7)일 수 있음. 그때 값으로 산 장비가 되돌려지지 않게, 쓴 귤은 지금 값과 이 값 중 작은 쪽으로 셈
//   release 가 #137 뒤 값 표로 나가고 옛 클라이언트가 다 바뀌면(roomcore MIN_VER) 지움
const OLD_PRICE = { tool: [0, 100, 400, 1000, 2100], bag: [80, 200, 650, 1100, 2100], shoes: [0, 150, 550, 1100, 2100], weapon: [0, 850], wear: [0, 50, 200, 400, 900], wearNone: 40 };
const priceOf = (now, old) => (old == null ? now : Math.min(now, old));
const CLOTH = Object.fromEntries(CLOTHES.map((c) => [c.id, c]));
const BACK = Object.fromEntries(BACK_LOOKS.map((b) => [b.id, b]));
const backOwn = (s) => (s.backs && s.backs.own) || {};
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
  s.equip.boots = int(s.equip.boots, 0, 2, 0); // 고진의 파란장화 (#167): 0 없음 · 1 가짐 · 2 신음
  if (!isObj(s.clothes)) s.clothes = {};
  const C = s.clothes; if (!isObj(C.own)) C.own = {}; if (!isObj(C.wear)) C.wear = {};
  for (const id of Object.keys(C.own)) if (!CLOTH[id]) delete C.own[id];
  for (const [k, id] of Object.entries(C.wear)) if (id && !(CLOTH[id]?.slot === k && (C.own[id] || START_CLOTH.has(id)))) delete C.wear[k];
  if (C.tint !== undefined) { const T = isObj(C.tint) ? C.tint : {}, o = {}; for (const id of Object.keys(T)) { const n = T[id]; if (CLOTH[id]?.tint && Number.isInteger(n) && n > 0 && n < LOOK_COLORS.style.length) o[id] = n; } C.tint = o; } // 겉모습 옷 색 (#179): 색 바꿀 수 있는 옷·범위 안 번호만
  if (!isObj(s.rides)) s.rides = {};
  s.rides.own = Array.isArray(s.rides.own) ? s.rides.own.filter((id, i, a) => RIDE[id] && a.indexOf(id) === i) : [];
  if (!s.rides.own.includes(s.rides.cur)) s.rides.cur = s.rides.own[s.rides.own.length - 1] || null;
  if (!isObj(s.hairs)) s.hairs = {};
  for (const k of Object.keys(s.hairs)) if (!(HAIR.byKey[k] || START_HAIR.has(k))) delete s.hairs[k];
  if (!isObj(s.trash)) s.trash = {};
  s.trash.total = int(s.trash.total, 0, 1e9, 0);
  s.mealFree = s.mealFree ? 1 : 0; // 스톤 첫 식사 무료를 썼는지 (#93)
  if (isObj(s.look) && 'colors' in s.look) { // 기본 옷 색 번호 (#155): 줄마다 0 ~ 색 수-1 만 남김 (범위 밖·이상한 값은 버림 → 기본색)
    const c = s.look.colors, o = {};
    if (isObj(c)) for (const k of ['hat', 'top', 'bottom', 'shoes']) { const n = c[k]; if (Number.isInteger(n) && n >= 0 && n < LOOK_COLORS[k].length) o[k] = n; }
    s.look.colors = o;
  }
  if (!isObj(s.swarm)) s.swarm = {}; s.swarm.earn = int(s.swarm.earn, 0, 1e12, 0); // 들판 떼(#173)로 번 귤 누적 (③)
  if (isObj(s.season) || s.season !== undefined) s.season = isObj(s.season) && s.season.xmas !== undefined ? { xmas: cleanXmas(s.season.xmas) } : undefined; // 철 이벤트 (#180)
  if (s.season === undefined) delete s.season;
  if (s.backs !== undefined) { // 배낭 겉모습 (#164): 목록에 있는 것만, 고른 것은 가진 것만
    const B = isObj(s.backs) ? s.backs : {}, own = {};
    if (isObj(B.own)) for (const id of Object.keys(B.own)) if (BACK[id] && B.own[id]) own[id] = 1;
    s.backs = { own, cur: own[B.cur] ? B.cur : null };
  }
  s.nick = cleanText(s.nick, NET.nickMax); // 제어·방향 글자·꺾쇠 빼고 16자 (#84)
  if (s.punk !== undefined) { // 오름펑크 (#165): 칭호 번호는 범위만, 쪽지는 목록에 있는 것만. 귤과는 상관없음
    const k = isObj(s.punk) ? s.punk : {}, ids = new Set(NOTES.map((n) => n.id)), notes = {};
    if (isObj(k.notes)) for (const [id, t] of Object.entries(k.notes)) if (ids.has(id)) notes[id] = int(t, 0, 1e15, 0);
    s.punk = { title: Number.isInteger(k.title) && k.title >= 0 && k.title < TITLES.length ? k.title : -1, notes, unread: Array.isArray(k.unread) ? k.unread.filter((id) => notes[id] !== undefined).slice(0, NOTES.length) : [], radio: k.radio === 0 ? 0 : 1,
      day: isObj(k.day) ? { d: typeof k.day.d === 'string' ? k.day.d.slice(0, 10) : '', n: int(k.day.n, 0, 1e6, 0) } : { d: '', n: 0 }, ev: isObj(k.ev) ? Object.fromEntries(Object.keys(k.ev).filter((e) => /^[a-z0-9-]{1,24}$/.test(e)).slice(0, 32).map((e) => [e, 1])) : {} };
  }
  s._lootFix = normLoot(s); // 재료·등급·강화·안 쓰는 장비 (#140): 강화 +6·없는 등급·재료 음수·없는 칸은 바로잡음
  return s;
}
// 레벨·증강 (#159, src/augments.js checkLv): 레벨 0~30(경험치 범위), 증강은 아는 것만·종류마다 3 이하·합이 (레벨 - 1) 이하. 넘는 값은 덜어 냄
//   분리수거 달인·큰손처럼 귤 벌이에 닿는 증강이 레벨보다 많이 붙지 않게

// 철 이벤트 (#180): 달력·선물 옷은 값을 안 셈
const freeCloths = (S) => new Set(S.season?.xmas ? [...calClothIds(S.season.xmas.days), ...S.season.xmas.gift] : []);
// 새로 산 것들의 값
function spentOf(P, S) {
  const free = freeCloths(S);
  let sp = 0;
  // 장비는 순서 없이 산다 (#111): 올라간 단계의 값만 (건너뛴 아래 단계 값은 더하지 않음)
  for (const [k, [, list]] of Object.entries(TIERS)) if (S.equip[k] > P.equip[k]) sp += priceOf(list[S.equip[k] - 1]?.price || 0, OLD_PRICE[k][S.equip[k] - 1]);
  if (S.equip.weapon > P.equip.weapon) sp += priceOf(WEAPONS[S.equip.weapon - 1]?.price || 0, OLD_PRICE.weapon[S.equip.weapon - 1]);
  for (const id of Object.keys(S.clothes.own)) if (!P.clothes.own[id] && !START_CLOTH.has(id) && !free.has(id)) { const c = CLOTH[id]; sp += priceOf(wearPrice(c) || 0, c.tier === 1 ? (wearPrice(c) ? OLD_PRICE.wearNone : 0) : OLD_PRICE.wear[c.tier - 1]); }
  if (S.equip.boots && !P.equip.boots) sp += BOOTS.price; // 고진의 파란장화 (#167): 신고 벗기(1↔2)는 공짜
  for (const id of S.rides.own) if (!P.rides.own.includes(id)) sp += RIDE[id].price;
  for (const k of Object.keys(S.hairs)) if (!P.hairs[k] && !START_HAIR.has(k)) sp += HAIR.price[k] || 0;
  for (const id of Object.keys(backOwn(S))) if (!backOwn(P)[id]) sp += BACK[id].price; // 배낭 겉모습 (#164)
  return sp;
}
function revertItems(P, S) {
  const free = freeCloths(S);
  for (const k of [...Object.keys(TIERS), 'weapon']) S.equip[k] = Math.min(S.equip[k], P.equip[k]);
  if (!P.equip.boots) S.equip.boots = 0;
  for (const id of Object.keys(S.clothes.own)) if (!P.clothes.own[id] && !START_CLOTH.has(id) && !free.has(id)) delete S.clothes.own[id];
  for (const [k, id] of Object.entries(S.clothes.wear)) if (id && !(S.clothes.own[id] || START_CLOTH.has(id))) delete S.clothes.wear[k];
  if (isObj(S.clothes.tint)) for (const id of Object.keys(S.clothes.tint)) if (!S.clothes.own[id]) delete S.clothes.tint[id];
  S.rides.own = S.rides.own.filter((id) => P.rides.own.includes(id)); if (!S.rides.own.includes(S.rides.cur)) S.rides.cur = S.rides.own[S.rides.own.length - 1] || null;
  for (const k of Object.keys(S.hairs)) if (!P.hairs[k] && !START_HAIR.has(k)) delete S.hairs[k];
  if (S.backs) { for (const id of Object.keys(S.backs.own)) if (!backOwn(P)[id]) delete S.backs.own[id]; if (!S.backs.own[S.backs.cur]) S.backs.cur = null; }
}

// 철 이벤트 (#180) 확인: 열린 달력 칸·선물 옷·트리 선물은 늘기만 하고, 새로 연 칸은 서버 날짜로 오늘까지만(지난 날은 귤 miss).
// → { spent: 지난 날 연 값, room: 달력·트리로 늘 수 있는 귤 }. 서버 날짜 xday = 12월 며칠(기간 밖 0), treeDone = 모두의 트리가 다 참
function seasonCheck(P, S, { xday = 0, treeDone = false }, fixed, budget = Infinity) {
  const out = { spent: 0, room: 0 };
  const PX = P.season?.xmas || null;
  if (!S.season?.xmas) { if (PX) S.season = { xmas: PX }; return out; } // 옛 클라이언트가 빼고 보내도 지우지 않음 (지웠다 다시 열어 귤을 또 받지 못하게)
  const SX = S.season.xmas, P0 = PX || cleanXmas(null);
  const add = SX.days.filter((d) => !P0.days.includes(d)).sort((a, b) => calCost(a, xday) - calCost(b, xday)), ok = [];
  for (const d of add) { // 오늘 칸(무료)부터. 지난 날 칸은 가진 귤 + 늘 수 있는 귤 안에서만
    if (!calOpenable(d, xday)) continue;
    const c = calCost(d, xday), r = calReward(d).coins || 0;
    if (c && out.spent + c > budget + out.room + r) continue;
    ok.push(d); out.spent += c; out.room += r;
  }
  if (ok.length !== add.length) fixed.push('season');
  SX.days = [...new Set([...P0.days, ...ok])].sort((a, b) => a - b);
  const gAdd = SX.gift.filter((id) => !P0.gift.includes(id));
  if (gAdd.length && !xday) fixed.push('season');
  SX.gift = [...new Set([...P0.gift, ...(xday ? gAdd : [])])].slice(0, Math.max(P0.gift.length, SEASON.xmas.santa.giftMax));
  if (SX.tree && !P0.tree) { if (treeDone && xday) out.room += SEASON.xmas.tree.gift; else { SX.tree = 0; fixed.push('season'); } }
  if (P0.tree) SX.tree = 1;
  if (SX.snow && !SX.days.includes(SEASON.xmas.cal.days)) SX.snow = 0;
  return out;
}

// 이름 (#162): 저장으로는 처음 지을 때(서버 기록 없음, 또는 아직 캐릭터를 안 고르고 이름도 안 정함)만 바뀜. 그 뒤 바꾸기는 POST /nick (Accounts.rename)
// 걸리는 이름(욕설·사칭)은 앞 이름으로, 앞 이름도 걸리면 무작위 이름으로 바꾸고 bad 를 알림 (그 뒤 첫 바꾸기 무료)
function fixNick(prev, P, S, free, fixed) {
  const pn = P.nick, sn = S.nick, open = !prev || !pn || free || (!P.nickSet && !isObj(P.look));
  let out = open ? sn : pn, bad = false;
  if (out !== pn || !prev) { if (!nickOk(out)) out = prev && pn && !nickBad(pn) ? pn : ''; }
  if (out && nickBad(out)) out = '';
  if (!out) { out = randomNick(); bad = true; }
  if (out !== pn && prev) S.nickSet = 1;
  if (P.nickSet && !free) S.nickSet = 1; // 한 번 정한 표시는 되돌릴 수 없음
  if (out !== sn) fixed.push('nick');
  S.nick = out;
  return bad;
}

// prev: 지난 저장(없으면 null), next: 받은 저장, acc: { credit, pickCredit, bank, savedAt, cred }, t: 지금(ms)
// → { save, fixed: [바로잡은 칸], acc: 새 credit·pickCredit·bank·cred, rec: 서버가 인정한 몫(#188), clamp: 깎인 귤, nickBad: 걸린 이름을 무작위로 바꿨음 }
// free: 어드민 계정 (#84, 시크릿 ADMIN_SUBS). 귤·치운 양 몫을 보지 않음 (개발자 버튼 '귤 채우기')
// grant: 운영자가 보낸 귤 가운데 이 저장이 받았다고 한 몫 (#188 POST /admin/grant)
export function checkSave(prev, next, acc, t, { migrate = false, free = false, xday = 0, treeDone = false, grant = 0 } = {}) {
  if (!isObj(next)) throw new Error('bad save');
  const S = norm(JSON.parse(JSON.stringify(next)));
  const P = norm(JSON.parse(JSON.stringify(prev || FRESH)));
  const fixed = [...S._lootFix]; delete S._lootFix; delete P._lootFix;
  const sold = cleanSold(next.sold); delete S.sold; delete P.sold; // 판 것 목록 (#188): 셈에만 쓰고 저장하지 않음
  let cred = normCred(acc.cred);
  const nickBadNow = fixNick(prev, P, S, free, fixed);
  if (checkLv(S) && !free) fixed.push('lv'); // #159
  const dt = Math.max(0, Math.min(NET.earnWindow, (t - (acc.savedAt || t)) / 1000));
  let credit = Math.min(NET.earnBurst, (acc.credit ?? NET.earnBurst) + dt * NET.earnPerSec);
  let pickCredit = Math.min(NET.pickBurst, (acc.pickCredit ?? NET.pickBurst) + dt * NET.pickPerSec);
  let bank = Math.max(0, Math.min(NET.earnBankMax, Number(acc.bank) || 0));
  const keep = () => ({ credit, pickCredit, bank, cred });
  if (free) return { save: S, fixed, acc: keep(), rec: null, clamp: null, nickBad: nickBadNow };
  if (P.mealFree && !S.mealFree) { S.mealFree = 1; fixed.push('mealFree'); } // 한 번 쓴 첫 식사는 되돌릴 수 없음 (어드민은 위에서 free 로 빠짐)
  if (migrate && !prev) {
    // 기기 기록 옮기기: 지난 기록을 확인할 길이 없어 목록 확인과 귤 상한만
    if (S.coins > NET.migrateCoinsMax) { S.coins = NET.migrateCoinsMax; fixed.push('coins'); }
    return { save: S, fixed, acc: keep(), rec: null, clamp: null, nickBad: nickBadNow };
  }
  const rc = recognize(P, S, sold, cred, t); cred = rc.cred; // 서버가 아는 큰 귤 (#188): bank 에 더해 늦게 들어오는 귤도 받음
  bank = Math.min(NET.earnBankMax, bank + rc.room);
  grant = Math.max(0, Number(grant) || 0);
  const sx = seasonCheck(P, S, { xday, treeDone }, fixed, P.coins + credit + bank); // 철 이벤트 (#180)
  const swarm = Math.min(Math.max(0, S.swarm.earn - P.swarm.earn), dt * NET.swarmPerSec); // ③ 들판 떼 몫 (#173): 적힌 만큼, 시간당 상한까지
  const room = credit + bank + sx.room + swarm + grant; // 이번에 늘 수 있는 귤
  let spent = spentOf(P, S) + sx.spent;
  if (spent > P.coins + room) { revertItems(P, S); spent = sx.spent; fixed.push('items'); }
  const gain = S.coins + spent - P.coins;
  if (gain > room) { S.coins = Math.max(0, Math.floor(P.coins + room - spent)); fixed.push('coins'); }
  const used = Math.max(0, S.coins + spent - P.coins - sx.room - grant), fromBank = Math.min(bank, used), fromSwarm = Math.min(swarm, used - fromBank);
  bank -= fromBank; credit -= used - fromBank - fromSwarm;
  const pg = S.trash.total - P.trash.total;
  if (pg > pickCredit) { S.trash.total = Math.floor(P.trash.total + pickCredit); fixed.push('picked'); }
  pickCredit -= Math.max(0, S.trash.total - P.trash.total);
  const ask = int(next.coins, 0, 1e9, 0), cut = fixed.includes('coins') || fixed.includes('items') ? { amt: Math.max(0, ask - S.coins), before: P.coins, ask, after: S.coins, why: fixed.filter((f) => f === 'coins' || f === 'items').join(','), room: Math.floor(room), rec: rc.room, bad: rc.bad.length } : null;
  return { save: S, fixed, acc: keep(), rec: rc, clamp: cut, nickBad: nickBadNow };
}
