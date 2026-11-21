// 서버가 아는 귤 (#188): 큰 귤이 생기는 일마다 저장의 기록을 보고 서버가 그 몫을 인정한다
// 인정한 몫은 계정의 bank(#144 번 몫)에 더함 → 귤이 그보다 늦게 들어와도(우두머리 귤 알갱이를 나중에 주움) 다음 저장에서 씀
// - 전리품 팔기: 저장의 sold = [{ s 칸, t 단계, g 등급, e 강화 }] (지난 저장 뒤 판 것, 클라이언트 src/loot.js noteSold).
//   지난 저장의 loot·입은 장비에 있던 것은 그대로, 없던 것은 '새로 떨어진 것' 으로 보고 떨어질 수 있는 양(fresh 통) 안에서만.
//   새로 떨어진 것은 강화 0 이고 단계는 지금 그 칸 단계 이하 (rollGear). 전설은 따로 적은 통
// - 퀘스트: save.quest.done 에 새로 들어온 퀘스트의 보상 귤. 계정마다 퀘스트 하나에 한 번 (cred.q, 처음부터 다시 해도 두 번 안 받음)
// - 우두머리: save.boss.done[구역] 이 늘면 ZONE_BOSS 귤. 구역마다 bossGap 초에 한 번
// - 소굴: save.field.den[id] 닫은 시각이 새로우면 FIELD.den 귤. 소굴마다 denGap 초에 한 번
// - 보물: save.field.tr.got 의 새 id (서버 날짜 하루에 한 번), 볼거리: save.field.sight 의 새 id (계정마다 한 번)
// 기록이 없는 것(적·업적·낚시 등)은 지금처럼 credit 에서
import { NET, QUESTS, ZONE_BOSS, FIELD, LOOT } from '../../src/balance.js';
import { sellValue, GEAR_SLOTS, curItem, clothId, WEAR_K } from '../../src/loot.js';
import { slotTier } from '../../src/gearscore.js';
import { kstDay } from '../../src/rankday.js';

const E = NET.earnRec;
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const QREW = new Map([...QUESTS.main, ...(QUESTS.side || [])].map((q) => [q.id, q.reward?.gyul || 0]));
const key = (it) => `${it.s}|${it.t}|${it.g}|${it.e}`;

// 계정의 인정 기록 (acc.cred, JSON). 예전 계정·이상한 값은 비움
export function normCred(c) {
  const o = isObj(c) ? c : {};
  const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
  return {
    fresh: num(o.fresh, E.freshBurst), legend: num(o.legend, E.legendBurst), at: num(o.at, 0),
    q: Array.isArray(o.q) ? o.q.filter((id) => QREW.has(id)) : [],
    boss: isObj(o.boss) ? o.boss : {}, den: isObj(o.den) ? o.den : {},
    tr: isObj(o.tr) && Array.isArray(o.tr.got) ? { d: num(o.tr.d), got: o.tr.got.slice(0, 64) } : { d: 0, got: [] },
    sight: Array.isArray(o.sight) ? o.sight.slice(0, 64) : [],
  };
}

// 판 것 목록 바로잡기: 정해진 칸만, 64개까지
export function cleanSold(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const it of list.slice(0, E.soldMax)) {
    if (!isObj(it) || !GEAR_SLOTS.includes(it.s)) continue;
    const t = Math.floor(Number(it.t)), g = Math.floor(Number(it.g)) || 0, e = Math.floor(Number(it.e)) || 0;
    if (!(t >= 1 && t <= 6) || g < 0 || g > 3 || e < 0 || e > 5) continue;
    if (WEAR_K.includes(it.s) && !clothId(it.s, t)) continue;
    out.push({ s: it.s, t, g, e });
  }
  return out;
}

// P: 지난 저장(norm 한 것), S: 받은 저장(norm 한 것), sold: 판 것(cleanSold), cred: normCred, t: 지금(ms)
// → { room: 인정한 귤, cred, why: { sold, quest, boss, den, tr, sight }, bad: [거절한 판 것] }
export function recognize(P, S, sold, cred, t) {
  const C = normCred(JSON.parse(JSON.stringify(cred || {})));
  const why = { sold: 0, quest: 0, boss: 0, den: 0, tr: 0, sight: 0 };
  // 통 채우기 (지난 시각부터)
  const dt = Math.max(0, Math.min(NET.earnWindow * 6, (t - (C.at || t)) / 1000));
  C.fresh = Math.min(E.freshBurst, C.fresh + dt * E.freshPerSec);
  C.legend = Math.min(E.legendBurst, C.legend + dt * E.legendPerSec);
  C.at = t;
  // 1) 전리품 팔기
  const pool = new Map(); const addPool = (it) => { const k = key(it); pool.set(k, (pool.get(k) || 0) + 1); };
  for (const it of P.loot || []) addPool(it);
  for (const k of GEAR_SLOTS) { const c = curItem(P, k); if (c.t >= 1 && (c.g || c.e)) addPool({ s: k, t: c.t, g: c.g, e: c.e }); }
  const bad = [];
  for (const it of sold) {
    const k = key(it), n = pool.get(k) || 0;
    if (n > 0) { pool.set(k, n - 1); why.sold += sellValue(it); continue; }
    // 새로 떨어진 것: 강화 0, 단계는 지금(또는 지난) 그 칸 단계 이하 (무기는 5구역에서 6단계까지)
    const top = Math.max(slotTier(S, it.s), slotTier(P, it.s));
    const okT = it.t <= top || (it.s === 'weapon' && it.t === 6 && top >= 5);
    if (it.e || !okT || C.fresh < 1 || (it.g === 3 && C.legend < 1)) { bad.push(it); continue; }
    C.fresh -= 1; if (it.g === 3) C.legend -= 1;
    why.sold += sellValue(it);
  }
  // 2) 퀘스트
  const done = Array.isArray(S.quest?.done) ? S.quest.done : [];
  const pdone = new Set(Array.isArray(P.quest?.done) ? P.quest.done : []);
  const skip = new Set(Array.isArray(S.quest?.skip) ? S.quest.skip : []);
  let nq = 0;
  for (const id of done) {
    if (pdone.has(id) || skip.has(id) || !QREW.has(id) || C.q.includes(id) || nq >= E.questPerSave) continue;
    C.q.push(id); nq++; why.quest += QREW.get(id);
  }
  // 3) 우두머리
  const bd = isObj(S.boss?.done) ? S.boss.done : {}, pbd = isObj(P.boss?.done) ? P.boss.done : {};
  for (const z of Object.keys(ZONE_BOSS.list)) {
    if (!((Number(bd[z]) || 0) > (Number(pbd[z]) || 0))) continue;
    if (t - (Number(C.boss[z]) || 0) < E.bossGap * 1000) continue;
    C.boss[z] = t; why.boss += ZONE_BOSS.list[z].gyul || 0;
  }
  // 4) 소굴: id 'd<구역>-<번호>'
  const den = isObj(S.field?.den) ? S.field.den : {}, pden = isObj(P.field?.den) ? P.field.den : {};
  for (const id of Object.keys(den).slice(0, 40)) {
    const m = /^d([1-5])-(\d{1,2})$/.exec(id); if (!m) continue;
    const z = +m[1]; if (+m[2] >= (FIELD.den.n[z] || 0)) continue;
    if (!((Number(den[id]) || 0) > (Number(pden[id]) || 0))) continue;
    if (t - (Number(C.den[id]) || 0) < E.denGap * 1000) continue;
    C.den[id] = t; why.den += FIELD.den.gyul[z] || 0;
  }
  // 5) 보물: id 't<구역>-<번호>', 서버 날짜 하루에 한 번
  const day = kstDay(t);
  if (C.tr.d !== day) C.tr = { d: day, got: [] };
  const tg = Array.isArray(S.field?.tr?.got) ? S.field.tr.got : [], ptg = new Set(P.field?.tr?.d === S.field?.tr?.d && Array.isArray(P.field?.tr?.got) ? P.field.tr.got : []);
  for (const id of tg.slice(0, 40)) {
    const m = /^t([1-5])-(\d{1,2})$/.exec(id); if (!m) continue;
    const z = +m[1]; if (+m[2] >= (FIELD.treasure.n[z] || 0)) continue;
    if (ptg.has(id) || C.tr.got.includes(id)) continue;
    C.tr.got.push(id); why.tr += FIELD.treasure.gyul[z] || 0;
  }
  // 6) 볼거리: id 'sight:<번호>', 계정마다 한 번
  const sg = Array.isArray(S.field?.sight) ? S.field.sight : [], psg = new Set(Array.isArray(P.field?.sight) ? P.field.sight : []);
  for (const id of sg.slice(0, 40)) {
    const m = /^sight:(\d{1,2})$/.exec(id); if (!m) continue;
    const s = FIELD.sight.list[+m[1]]; if (!s) continue;
    if (psg.has(id) || C.sight.includes(id)) continue;
    C.sight.push(id); why.sight += FIELD.sight.gyul[s[0]] || 0;
  }
  const room = Object.values(why).reduce((a, b) => a + b, 0);
  return { room, cred: C, why, bad };
}
