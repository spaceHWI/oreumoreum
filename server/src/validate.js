// 저장 확인 (#7): 클라이언트가 보낸 저장을 그대로 믿지 않는다
// - 가진 것(옷·탈것·머리·장비 단계)은 목록에 있는 것만
// - 새로 산 것의 값을 더하고, 귤이 늘어난 몫(번 귤 = 지금 귤 + 쓴 귤 - 지난 귤)은 계정의 '벌 수 있는 몫' 안에서만 (#144)
//   ① credit: 시간이 지나면 earnPerSec 씩 차고 earnBurst 에서 멈춤 (토큰 통. 적·업적·낚시·보너스)
//   ③ swarm: 저장의 save.swarm.earn(들판 떼로 번 귤 누적, #173)이 늘어난 몫을 지난 저장 뒤 시간 × swarmPerSec 까지 (모아 두지 않음: 자주 저장해도 늘지 않음)
//   ② bank: 방이 받아 준 줍기 × 더미 구역 값 (roomcore → Accounts.earn). 클린하우스에 버린 귤 몫. 번 귤은 ② 에서 먼저 씀
// - 치운 양(누적)도 같은 방식
import { cleanText, nickOk, nickBad, randomNick } from '../../src/safetext.js';
import { NET, TOOLS, BAGS, SHOES, BOOTS, WEAPONS, CLOTHES, WEAR_START, wearPrice, RIDES, HAIR, LOOK_COLORS, SEASON, BACK_LOOKS, WEEKLY, LEVEL, SWARM, TOKEN, INN } from '../../src/balance.js';
import { cleanXmas, calOpenable, calCost, calReward, calClothIds, calFull, CAL_ALL_CLOTHES } from '../../src/seasoncal.js';
import { normLoot } from '../../src/loot.js';
import { checkLv, levelOf } from '../../src/augments.js';
import { TITLES, NOTES } from '../../src/punktext.js';
import { recognize, cleanSold, normCred } from './earn.js';
import { WEEKLY_IDS, weeklyBuyable } from '../../src/weekly.js';
import { normTok, TOK_CLOTHES } from '../../src/token.js';
import { tokenCheck } from './token.js';
import { kstDay, weekStart } from '../../src/rankday.js';
import { dateOfDay } from '../../src/daily.js';

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

// 불멍 기록 (#290): d 그날(KST)·n 그날 앉은 수·until 버프 '멍' 남은 놀이 초·t 모두 앉은 수
const fireNorm = (f) => ({ d: typeof f.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f.d) ? f.d : '', n: Math.max(0, Math.min(INN.fire.perDay, Math.floor(Number(f.n)) || 0)), until: Math.max(0, Math.min(INN.fire.buffSec + INN.fire.pair, Number(f.until) || 0)), t: Math.max(0, Math.min(1e6, Math.floor(Number(f.t)) || 0)) });

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
  if (s.cave !== undefined) { // 동굴 (#195, earn.js 8): 들고 나온 쓰레기 귤 누적 · 오늘 판 수 · 연 상자 · 주인을 쫓아낸 날
    if (!isObj(s.cave)) s.cave = {}; s.cave.out = int(s.cave.out, 0, 1e12, 0);
    if (s.cave.runs !== undefined) s.cave.runs = isObj(s.cave.runs) ? { d: String(s.cave.runs.d || '').slice(0, 10), n: int(s.cave.runs.n, 0, 999, 0) } : undefined;
    if (s.cave.chest !== undefined) s.cave.chest = isObj(s.cave.chest) ? { d: String(s.cave.chest.d || '').slice(0, 10), got: Array.isArray(s.cave.chest.got) ? s.cave.chest.got.filter((x) => typeof x === 'string' && /^c\d$/.test(x)).slice(0, 8) : [] } : undefined;
    if (s.cave.boss !== undefined) s.cave.boss = typeof s.cave.boss === 'string' ? s.cave.boss.slice(0, 10) : undefined;
  }
  { const rs = {}, wn = {}, R0 = isObj(s.swarm.rest) ? s.swarm.rest : {}, W0 = isObj(s.swarm.won) ? s.swarm.won : {}; /* 한 판 (#202): 구역 1~5 만, 숫자만 */
    for (let z = 1; z <= 5; z++) { if (Number.isFinite(+R0[z])) rs[z] = Math.max(0, Math.floor(+R0[z])); const w = W0[z]; if (isObj(w)) wn[z] = { at: int(w.at, 0, 1e14, 0), b: int(w.b, 0, SWARM.run.bonusMax[z] || 0, 0) }; }
    s.swarm.rest = rs; s.swarm.won = wn; }
  if (isObj(s.season) || s.season !== undefined) s.season = isObj(s.season) && s.season.xmas !== undefined ? { xmas: cleanXmas(s.season.xmas) } : undefined; // 철 이벤트 (#180)
  if (s.season === undefined) delete s.season;
  if (s.backs !== undefined) { // 배낭 겉모습 (#164): 목록에 있는 것만, 고른 것은 가진 것만
    const B = isObj(s.backs) ? s.backs : {}, own = {};
    if (isObj(B.own)) for (const id of Object.keys(B.own)) if (BACK[id] && B.own[id]) own[id] = 1;
    s.backs = { own, cur: own[B.cur] ? B.cur : null };
  }
  { const g = isObj(s.gift) ? s.gift : {}; s.gift = { in: int(g.in, 0, 1e12, 0), out: int(g.out, 0, 1e12, 0) }; } // 귤 주기 (#175): 이 저장에 들어간 받은·준 귤 누적 (서버 값 acc.gin·gout 까지)
  s.nick = cleanText(s.nick, NET.nickMax); // 제어·방향 글자·꺾쇠 빼고 16자 (#84)
  if (s.punk !== undefined) { // 오름펑크 (#165): 칭호 번호는 범위만, 쪽지는 목록에 있는 것만. 귤과는 상관없음
    const k = isObj(s.punk) ? s.punk : {}, ids = new Set(NOTES.map((n) => n.id)), notes = {};
    if (isObj(k.notes)) for (const [id, t] of Object.entries(k.notes)) if (ids.has(id)) notes[id] = int(t, 0, 1e15, 0);
    s.punk = { title: Number.isInteger(k.title) && k.title >= 0 && k.title < TITLES.length ? k.title : -1, notes, unread: Array.isArray(k.unread) ? k.unread.filter((id) => notes[id] !== undefined).slice(0, NOTES.length) : [], radio: k.radio === 0 ? 0 : 1,
      day: isObj(k.day) ? { d: typeof k.day.d === 'string' ? k.day.d.slice(0, 10) : '', n: int(k.day.n, 0, 1e6, 0) } : { d: '', n: 0 }, ev: isObj(k.ev) ? Object.fromEntries(Object.keys(k.ev).filter((e) => /^[a-z0-9-]{1,24}$/.test(e)).slice(0, 32).map((e) => [e, 1])) : {} };
  }
  if (s.inn !== undefined) { const o = isObj(s.inn) ? s.inn : {}; s.inn = { d: typeof o.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.d) ? o.d : '', n: int(o.n, 0, 1e6, 0), left: Math.max(0, Math.min(INN.buffSec, Number(o.left) || 0)), ...(isObj(o.fire) ? { fire: fireNorm(o.fire) } : {}) }; } /* 숙소 (#270): 마지막 묵은 날·묵은 수·개운함 남은 초. fire = 마당 불멍 (#290, 귤이 오가지 않아 모양만 바로잡음) */
  normTok(s); // 징표 (#255, server/src/token.js)
  s._lootFix = normLoot(s); // 재료·등급·강화·안 쓰는 장비 (#140): 강화 +6·없는 등급·재료 음수·없는 칸은 바로잡음
  return s;
}
// 레벨·증강 (#159, src/augments.js checkLv): 레벨 0~30(경험치 범위), 증강은 아는 것만·종류마다 3 이하·합이 (레벨 - 1) 이하. 넘는 값은 덜어 냄
//   분리수거 달인·큰손처럼 귤 벌이에 닿는 증강이 레벨보다 많이 붙지 않게

// 철 이벤트 (#180): 달력·선물 옷은 값을 안 셈
// 달력을 다 연 옷(#222)은 seasonCheck 가 확인한 all 일 때만 (seasonCheck 가 spentOf 보다 먼저 돎)
const freeCloths = (S) => new Set([...(S.season?.xmas ? [...calClothIds(S.season.xmas.days), ...S.season.xmas.gift, ...(S.season.xmas.all ? CAL_ALL_CLOTHES : [])] : []), ...TOK_CLOTHES.map((c) => c.id)]); /* 징표 옷(#255)은 귤 값이 아님: tokenCheck 가 봄 */
// 새로 산 것들의 값
function spentOf(P, S) {
  const free = freeCloths(S);
  let sp = 0;
  // 장비는 순서 없이 산다 (#111): 올라간 단계의 값만 (건너뛴 아래 단계 값은 더하지 않음)
  for (const [k, [, list]] of Object.entries(TIERS)) if (S.equip[k] > P.equip[k]) sp += list[S.equip[k] - 1]?.price || 0;
  if (S.equip.weapon > P.equip.weapon) sp += WEAPONS[S.equip.weapon - 1]?.price || 0;
  for (const id of Object.keys(S.clothes.own)) if (!P.clothes.own[id] && !START_CLOTH.has(id) && !free.has(id)) { const c = CLOTH[id]; sp += c.price != null ? c.price : wearPrice(c) || 0; }
  if (S.equip.boots && !P.equip.boots) sp += BOOTS.price; // 고진의 파란장화 (#167): 신고 벗기(1↔2)는 공짜
  for (const id of S.rides.own) if (!P.rides.own.includes(id)) sp += RIDE[id].price;
  for (const k of Object.keys(S.hairs)) if (!P.hairs[k] && !START_HAIR.has(k)) sp += HAIR.price[k] || 0;
  for (const id of Object.keys(backOwn(S))) if (!backOwn(P)[id]) sp += BACK[id].price; // 배낭 겉모습 (#164)
  sp += innSpent(P, S); // 숙소 (#270)
  return sp;
}
// 숙소 (#270): 새로 묵은 수 × 값 (지난 저장의 레벨로 셈. 첫 숙박은 반값). 값을 셈에 넣어야 같은 저장 사이에 번 귤·경험치 몫이 바로 잡힘
const innN = (s) => (isObj(s.inn) ? s.inn.n : 0);
function innSpent(P, S) {
  const k = innN(S) - innN(P); if (k <= 0) return 0;
  const lv = levelOf(Number(P.lv?.xp) || 0).lv, one = INN.price.base + lv * INN.price.perLv;
  return Math.round(one * (innN(P) ? 1 : INN.price.first)) + Math.round(one) * (k - 1);
}
// 숙소 기록 바로잡기: 묵은 수는 줄지 않고, 날이 바뀌려면 수가 늘어야 하며, 새 날은 서버 날짜 오늘(또는 어제: 자정 직전에 묵은 저장이 늦게 옴)까지만, 하루에 한 번
function innCheck(P, S, t, fixed) {
  if (!isObj(S.inn) && !isObj(P.inn)) return;
  const p = isObj(P.inn) ? P.inn : { d: '', n: 0, left: 0 }; if (!isObj(S.inn)) S.inn = { ...p };
  const day = kstDay(t), ok = new Set([dateOfDay(day), dateOfDay(day - 1)]), more = S.inn.n > p.n;
  const bad = S.inn.n < p.n || (S.inn.d !== p.d && (!more || !ok.has(S.inn.d))) || (more && (S.inn.n - p.n > 1 || p.d === S.inn.d));
  if (bad) { S.inn = { ...p, left: Math.min(S.inn.left, p.d === S.inn.d || ok.has(p.d) ? INN.buffSec : 0) }; fixed.push('inn'); }
}
// 개운함 경험치 (#270 INN.buff.xp): 마지막 묵은 날이 서버 날짜 오늘·어제이고 개운함이 남아 있으면 그만큼 더 받아 줌
function innXp(P, S, t) {
  const o = isObj(S.inn) ? S.inn : null; if (!o || !(o.left > 0 || P.inn?.left > 0)) return 1;
  const day = kstDay(t); return o.d === dateOfDay(day) || o.d === dateOfDay(day - 1) ? 1 + INN.buff.xp : 1;
}
function revertItems(P, S) {
  const free = freeCloths(S);
  for (const k of [...Object.keys(TIERS), 'weapon']) S.equip[k] = Math.min(S.equip[k], P.equip[k]);
  if (!P.equip.boots) S.equip.boots = 0;
  for (const id of Object.keys(S.clothes.own)) if (!P.clothes.own[id] && !START_CLOTH.has(id) && !free.has(id)) delete S.clothes.own[id];
  for (const [k, id] of Object.entries(S.clothes.wear)) if (id && !(S.clothes.own[id] || START_CLOTH.has(id))) delete S.clothes.wear[k];
  if (isObj(S.clothes.tint)) for (const id of Object.keys(S.clothes.tint)) if (!S.clothes.own[id]) delete S.clothes.tint[id];
  if (innN(S) > innN(P)) S.inn = isObj(P.inn) ? { ...P.inn } : undefined; // 숙소 (#270): 값을 못 냈으면 묵지 않은 것으로
  if (S.inn === undefined) delete S.inn;
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
  // 다 열면 (#222): 25칸이 다 찬 저장에서 처음 all 이 1 이 될 때 한 번 귤 calAll.coins. 칸은 줄지 않으니(P0 를 늘 합침) 지웠다 다시 받을 수 없음
  if (SX.all && !P0.all) { if (calFull(SX.days)) out.room += SEASON.xmas.calAll.coins; else { SX.all = 0; fixed.push('season'); } }
  if (P0.all) SX.all = 1;
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

// 귤 주기 (#175): 서버가 옮긴 귤(acc.gin 받은 누적·acc.gout 준 누적)은 번 귤이 아님. 클라이언트가 이미 넣은 몫(save.gift)은 지난 귤에 더하고 빼서 보고,
//   아직 못 넣은 몫(끊겨서 못 받은 알림·보내는 중이던 저장)은 서버가 넣어 'gift' 로 알림 (클라이언트는 fix.gift·fix.coins 로 맞춤)
function giftBase(P, S, acc) {
  const GI = Math.max(0, Math.floor(Number(acc.gin) || 0)), GO = Math.max(0, Math.floor(Number(acc.gout) || 0));
  const cin = Math.max(Math.min(P.gift.in, GI), Math.min(S.gift.in, GI)), cout = Math.max(Math.min(P.gift.out, GO), Math.min(S.gift.out, GO));
  P.coins = Math.max(0, P.coins + (cin - Math.min(P.gift.in, GI)) - (cout - Math.min(P.gift.out, GO)));
  return { GI, GO, miss: (GI - cin) - (GO - cout), bad: S.gift.in !== cin || S.gift.out !== cout };
}
function giftDone(S, g, fixed) {
  if (g.miss) S.coins = Math.max(0, S.coins + g.miss);
  if (g.miss || g.bad || S.gift.in !== g.GI || S.gift.out !== g.GO) fixed.push('gift');
  S.gift = { in: g.GI, out: g.GO };
}

// prev: 지난 저장(없으면 null), next: 받은 저장, acc: { credit, pickCredit, bank, savedAt, cred, gin, gout }, t: 지금(ms)
// → { save, fixed: [바로잡은 칸], acc: 새 credit·pickCredit·bank·cred, rec: 서버가 인정한 몫(#188), clamp: 깎인 귤, nickBad: 걸린 이름을 무작위로 바꿨음 }
// free: 어드민 계정 (#84, 시크릿 ADMIN_SUBS). 귤·치운 양 몫을 보지 않음 (개발자 버튼 '귤 채우기')
// grant: 운영자가 보낸 귤 가운데 이 저장이 받았다고 한 몫 (#188 POST /admin/grant)
// 기기 기록 옮기기의 '오늘 치운 수' (#261): 기기 기록(trash.rk)의 날이 서버의 오늘이고, 이번 주·전체 치운 수·남은 줍기 몫을 넘지 않는 만큼만
export function migDay(next, S, t, pickCredit) {
  const rk = isObj(next?.trash?.rk) ? next.trash.rk : null;
  if (!rk || Number(rk.d) !== kstDay(t)) return 0;
  const day = int(rk.day?.battle, 0, 1e9, 0), week = Number(rk.w) === weekStart(kstDay(t)) ? int(rk.week?.battle, 0, 1e9, 0) : day;
  return Math.max(0, Math.floor(Math.min(day, week, S.trash.total, pickCredit)));
}
export function checkSave(prev, next, acc, t, { migrate = false, free = false, xday = 0, treeDone = false, grant = 0 } = {}) {
  if (!isObj(next)) throw new Error('bad save');
  const S = norm(JSON.parse(JSON.stringify(next)));
  const P = norm(JSON.parse(JSON.stringify(prev || FRESH)));
  const fixed = [...S._lootFix]; delete S._lootFix; delete P._lootFix;
  const sold = cleanSold(next.sold); delete S.sold; delete P.sold; // 판 것 목록 (#188): 셈에만 쓰고 저장하지 않음
  let cred = normCred(acc.cred);
  const nickBadNow = fixNick(prev, P, S, free, fixed);
  if (checkLv(S) && !free) fixed.push('lv'); // #159
  const lvNew = !('lv' in P) || P.lv?.v !== LEVEL.v; if ('lv' in P) checkLv(P); /* #202: 지난 저장이 옛 경험치면 이번 한 번은 몫을 보지 않음 (migrateLv 로 바꾸는 저장) */
  const dt = Math.max(0, Math.min(NET.earnWindow, (t - (acc.savedAt || t)) / 1000));
  let credit = Math.min(NET.earnBurst, (acc.credit ?? NET.earnBurst) + dt * NET.earnPerSec);
  let pickCredit = Math.min(NET.pickBurst, (acc.pickCredit ?? NET.pickBurst) + dt * NET.pickPerSec);
  let bank = Math.max(0, Math.min(NET.earnBankMax, Number(acc.bank) || 0));
  const keep = () => ({ credit, pickCredit, bank, cred });
  const gift = giftBase(P, S, acc); // 귤 주기 (#175)
  const done = (o) => { giftDone(S, gift, fixed); return o; };
  if (free) return done({ save: S, fixed, acc: keep(), rec: null, clamp: null, nickBad: nickBadNow });
  if (P.mealFree && !S.mealFree) { S.mealFree = 1; fixed.push('mealFree'); } // 한 번 쓴 첫 식사는 되돌릴 수 없음 (어드민은 위에서 free 로 빠짐)
  if (migrate && !prev) {
    // 기기 기록 옮기기: 지난 기록을 확인할 길이 없어 목록 확인과 귤 상한만
    if (S.coins > NET.migrateCoinsMax) { S.coins = NET.migrateCoinsMax; fixed.push('coins'); }
    if (S.tok.n > TOKEN.server.migrateMax) { S.tok.n = TOKEN.server.migrateMax; fixed.push('tok'); } // 징표 (#255)
    const rkDay = migDay(next, S, t, pickCredit); pickCredit -= rkDay; /* #261: 손님 때 오늘 치운 몫은 오늘·이번 주 표에도. 치운 양 빠르기(pickBurst) 안에서만 */
    return done({ save: S, fixed, acc: keep(), rec: null, clamp: null, nickBad: nickBadNow, rkDay });
  }
  if (P.cave && (!S.cave || S.cave.out < P.cave.out)) { S.cave = { ...(S.cave || {}), out: P.cave.out }; } // 동굴 누적은 줄지 않음 (#195: 줄였다 다시 올려 두 번 받기 막음)
  const rc = recognize(P, S, sold, cred, t); cred = rc.cred; // 서버가 아는 큰 귤 (#188): bank 에 더해 늦게 들어오는 귤도 받음
  bank = Math.min(NET.earnBankMax, bank + rc.room);
  grant = Math.max(0, Number(grant) || 0);
  const sx = seasonCheck(P, S, { xday, treeDone }, fixed, P.coins + credit + bank); // 철 이벤트 (#180)
  const swarm = Math.min(Math.max(0, S.swarm.earn - P.swarm.earn), dt * NET.swarmPerSec); // ③ 들판 떼 몫 (#173): 적힌 만큼, 시간당 상한까지
  const room = credit + bank + sx.room + swarm + grant; // 이번에 늘 수 있는 귤
  { // 주간 옷장 (#126): 새로 가진 한정 옷은 서버 시계로 이번 주 것만 (바뀐 직후 grace 안은 지난주 것도). 아니면 되돌림
    const wk = weeklyBuyable(t, WEEKLY.grace);
    for (const id of Object.keys(S.clothes.own)) if (WEEKLY_IDS.has(id) && !P.clothes.own[id] && !wk.has(id)) { delete S.clothes.own[id]; if (!fixed.includes('items')) fixed.push('items'); }
    for (const [k, id] of Object.entries(S.clothes.wear)) if (id && WEEKLY_IDS.has(id) && !S.clothes.own[id]) delete S.clothes.wear[k];
  }
  { const tk = tokenCheck(P, S, cred, t, dt); cred = tk.cred; for (const f of tk.fixed) fixed.push(f); } // 징표 (#255): 귤과 따로
  innCheck(P, S, t, fixed); // 숙소 (#270)
  let spent = spentOf(P, S) + sx.spent;
  if (spent > P.coins + room) { revertItems(P, S); spent = sx.spent; fixed.push('items'); }
  const gain = S.coins + spent - P.coins;
  if (gain > room) { S.coins = Math.max(0, Math.floor(P.coins + room - spent)); fixed.push('coins'); }
  const used = Math.max(0, S.coins + spent - P.coins - sx.room - grant), fromBank = Math.min(bank, used), fromSwarm = Math.min(swarm, used - fromBank);
  bank -= fromBank; credit -= used - fromBank - fromSwarm;
  let lvCut = 0;
  if (isObj(S.lv) && !lvNew) { /* 레벨 (#202): 경험치(번 귤)는 이번에 받아 준 귤 가운데 판 귤을 뺀 만큼만 늘 수 있음 (운영자 귤·철 선물·받은 귤은 used 에 없음) */
    const cap = (Number(P.lv?.xp) || 0) + Math.max(0, used - Math.min(used, rc.why.sold)) * innXp(P, S, t); /* #270 개운함 경험치 */
    if (S.lv.xp > cap) { lvCut = S.lv.xp - cap; S.lv.xp = Math.max(0, Math.floor(cap)); checkLv(S); fixed.push('lvxp'); }
  }
  const pg = S.trash.total - P.trash.total;
  if (pg > pickCredit) { S.trash.total = Math.floor(P.trash.total + pickCredit); fixed.push('picked'); }
  pickCredit -= Math.max(0, S.trash.total - P.trash.total);
  const ask = int(next.coins, 0, 1e9, 0), cut = fixed.includes('coins') || fixed.includes('items') ? { amt: Math.max(0, ask - S.coins), before: P.coins, ask, after: S.coins, why: fixed.filter((f) => f === 'coins' || f === 'items').join(','), room: Math.floor(room), rec: rc.room, bad: rc.bad.length } : null;
  return done({ save: S, fixed, acc: keep(), rec: rc, clamp: cut, nickBad: nickBadNow, lvCut });
}
