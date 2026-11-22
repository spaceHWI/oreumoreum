// 서버가 아는 귤 (#188): 큰 귤이 생기는 일마다 저장의 기록을 보고 서버가 그 몫을 인정한다
// 인정한 몫은 계정의 bank(#144 번 몫)에 더함 → 귤이 그보다 늦게 들어와도(우두머리 귤 알갱이를 나중에 주움) 다음 저장에서 씀
// - 전리품 팔기: 저장의 sold = [{ s 칸, t 단계, g 등급, e 강화 }] (지난 저장 뒤 판 것, 클라이언트 src/loot.js noteSold).
//   지난 저장의 loot·입은 장비에 있던 것은 그대로, 없던 것은 '새로 떨어진 것' 으로 보고 떨어질 수 있는 양(fresh 통) 안에서만.
//   새로 떨어진 것은 강화 0 이고 단계는 지금 그 칸 단계 이하 (rollGear). 전설은 따로 적은 통
// - 퀘스트: save.quest.done 에 새로 들어온 퀘스트의 보상 귤. 계정마다 퀘스트 하나에 한 번 (cred.q, 처음부터 다시 해도 두 번 안 받음)
// - 우두머리: save.boss.done[구역] 이 늘면 ZONE_BOSS 귤. 구역마다 bossGap 초에 한 번
// - 소굴: save.field.den[id] 닫은 시각이 새로우면 FIELD.den 귤. 소굴마다 denGap 초에 한 번
// - 보물: save.field.tr.got 의 새 id (서버 날짜 하루에 한 번), 볼거리: save.field.sight 의 새 id (계정마다 한 번)
// - 오늘의 할 일 (#125, src/daily.js): save.ach.daily 의 받은 할 일(claimed)·셋 다(all). 서버 날짜(오늘·어제)의 그날 목록에 있는 것만, 할 일마다 하루 한 번
//   이어 오기: 서버가 저장을 받은 날로 따로 셈(cred.run). save.ach.run.got 에 새로 들어온 날 수가 서버의 연속 날 수 이하면, 이번 연속에서 한 번
//   보상 구역은 지난 저장의 journey.maxZ (받은 저장은 지난 것 + 1 까지만 믿음)
// - 동굴 (#195): save.cave.out(들고 나온 동굴 쓰레기 귤 누적)이 늘어난 몫 × caveK. 통(cred.cave)은 초당 cavePerSec 씩 차고 caveBurst 에서 멈춤
//   하루(서버 날짜)에 인정한 동굴 쓰레기 몫(cred.cd)이 caveDayFull 을 넘으면 넘는 몫은 CAVE.runs.halfK 만 (하루 판 수를 속여도 하루 몫은 같음)
//   상자: save.cave.chest.got 의 새 id 'c<층>' (서버 날짜 하루에 한 번, cred.cc) · 주인: save.cave.boss 가 오늘(또는 어제) 날짜로 바뀌면 그날 한 번 (cred.cb)
// - 들판 떼 한 판 (#202): save.swarm.won[구역] = { at, b } 의 at 이 새로우면 덤 b (SWARM.run.bonusMax 까지). 구역마다 쉬는 시간(SWARM.run.rest × swarmRestK) 안에 두 번 인정하지 않음 (서버 시계)
// - 금고 (#212): save.myst.safe 가 새로 1 이 되면 MYST.safe.gyul. 계정마다 한 번 (cred.safe, 처음부터 다시 해도 두 번 안 받음)
// - 미확인 제보 (#238, src/cases/reports.js): save.report = { d, id, got } 의 got 이 서버 날짜(오늘·어제)면 REPORT.gyul. 날마다 한 번 (cred.rp 날짜)
// 기록이 없는 것(적·업적·낚시 등)은 지금처럼 credit 에서
import { NET, QUESTS, ZONE_BOSS, FIELD, LOOT, SWARM, CAVE, MYST, REPORT } from '../../src/balance.js';
import { REPORT_BY } from '../../src/cases/reports.js';
import { sellValue, GEAR_SLOTS, curItem, clothId, WEAR_K } from '../../src/loot.js';
import { slotTier } from '../../src/gearscore.js';
import { kstDay } from '../../src/rankday.js';
import { normTkCred } from './token.js';
import { todaysTasks, taskGyul, allGyul, runGyul, RUN_DAYS, dateOfDay, runStep } from '../../src/daily.js';

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
    boss: isObj(o.boss) ? o.boss : {}, den: isObj(o.den) ? o.den : {}, sw: isObj(o.sw) ? o.sw : {},
    tr: isObj(o.tr) && Array.isArray(o.tr.got) ? { d: num(o.tr.d), got: o.tr.got.slice(0, 64) } : { d: 0, got: [] },
    sight: Array.isArray(o.sight) ? o.sight.slice(0, 64) : [],
    dl: isObj(o.dl) && typeof o.dl.d === 'string' ? { d: o.dl.d.slice(0, 10), ids: Array.isArray(o.dl.ids) ? o.dl.ids.slice(0, 3) : [], all: o.dl.all ? 1 : 0 } : { d: '', ids: [], all: 0 }, // 오늘의 할 일 (#125)
    dlp: isObj(o.dlp) && typeof o.dlp.d === 'string' ? { d: o.dlp.d.slice(0, 10), ids: Array.isArray(o.dlp.ids) ? o.dlp.ids.slice(0, 3) : [], all: o.dlp.all ? 1 : 0 } : { d: '', ids: [], all: 0 }, // 어제 것 (자정 넘어 저장)
    cave: num(o.cave, E.caveBurst), // 동굴 통 (#195)
    safe: o.safe ? 1 : 0, // 금고를 연 계정 (#212)
    rp: typeof o.rp === 'string' ? o.rp.slice(0, 10) : '', // 미확인 제보를 인정한 마지막 날 (#238)
    cd: isObj(o.cd) ? { d: num(o.cd.d), g: num(o.cd.g) } : { d: 0, g: 0 }, // 동굴 오늘 인정한 쓰레기 몫 (3번 조각)
    cc: isObj(o.cc) && Array.isArray(o.cc.got) ? { d: num(o.cc.d), got: o.cc.got.filter((x) => typeof x === 'string').slice(0, CAVE.floors) } : { d: 0, got: [] }, // 동굴 오늘 연 상자
    cb: typeof o.cb === 'string' ? o.cb.slice(0, 10) : '', // 동굴 주인 큰 보상을 준 날
    ...normTkCred(o), // 징표 통·구역별 버틴 판 (#255, server/src/token.js)
    run: isObj(o.run) ? { n: num(o.run.n), last: num(o.run.last), paid: Array.isArray(o.run.paid) ? o.run.paid.filter((x) => RUN_DAYS.includes(x)) : [] } : { n: 0, last: 0, paid: [] },
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
  const why = { sold: 0, quest: 0, boss: 0, den: 0, tr: 0, sight: 0, daily: 0, run: 0, cave: 0, swarm: 0, safe: 0, report: 0 };
  // 통 채우기 (지난 시각부터)
  const dt = Math.max(0, Math.min(NET.earnWindow * 6, (t - (C.at || t)) / 1000));
  C.fresh = Math.min(E.freshBurst, C.fresh + dt * E.freshPerSec);
  C.legend = Math.min(E.legendBurst, C.legend + dt * E.legendPerSec);
  C.cave = Math.min(E.caveBurst, C.cave + dt * E.cavePerSec);
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
  // 6-2) 금고 (#212): 계정마다 한 번
  if (S.myst?.safe === 1 && P.myst?.safe !== 1 && !C.safe) { C.safe = 1; why.safe = MYST.safe.gyul; }
  // 6-3) 미확인 제보 (#238): 서버 날짜(오늘·어제)의 끝낸 제보, 하루 한 번
  { const R = S.report, d = isObj(R) && typeof R.d === 'string' ? R.d : '';
    if (d && R.got && REPORT_BY[R.id] && (d === dateOfDay(day) || d === dateOfDay(day - 1)) && C.rp !== d && C.rp < d) { C.rp = d; why.report = REPORT.gyul; } }
  // 7) 오늘의 할 일 (#125)
  const pz = Math.max(1, Math.min(5, Math.floor(Number(P.journey?.maxZ)) || 1)), z = Math.max(pz, Math.min(pz + 1, Math.floor(Number(S.journey?.maxZ)) || 1));
  const SD = isObj(S.ach?.daily) ? S.ach.daily : null, today = dateOfDay(day), yday = dateOfDay(day - 1);
  if (C.dl.d !== today) { C.dlp = C.dl.d === yday ? C.dl : { d: yday, ids: [], all: 0 }; C.dl = { d: today, ids: [], all: 0 }; }
  if (SD && (SD.date === today || SD.date === yday) && Array.isArray(SD.items)) {
    const R = SD.date === today ? C.dl : C.dlp, want = todaysTasks(SD.date).map((x) => x.id);
    for (const it of SD.items.slice(0, 3)) {
      if (!isObj(it) || !it.claimed || !want.includes(it.id) || R.ids.includes(it.id)) continue;
      R.ids.push(it.id); why.daily += taskGyul(z);
    }
    if (SD.all && !R.all && want.every((id) => R.ids.includes(id))) { R.all = 1; why.daily += allGyul(z); }
  }
  // 이어 오기: 서버가 본 날로 셈 (저장을 받은 날)
  { const r = runStep({ n: C.run.n, last: C.run.last, got: C.run.paid }, day); C.run = { n: r.run.n, last: r.run.last, paid: r.run.got }; }
  const got = Array.isArray(S.ach?.run?.got) ? S.ach.run.got : [];
  for (const n of RUN_DAYS) {
    if (!got.includes(n) || C.run.paid.includes(n) || C.run.n < n) continue;
    C.run.paid.push(n); why.run += runGyul(n, z);
  }
  // 8) 동굴: 들고 나온 몫 (#195). 하루 몫(caveDayFull)을 넘으면 절반 · 상자 · 주인
  { const o = Math.max(0, (Number(S.cave?.out) || 0) - (Number(P.cave?.out) || 0));
    if (C.cd.d !== day) C.cd = { d: day, g: 0 };
    const full = Math.min(o * E.caveK, Math.max(0, E.caveDayFull - C.cd.g)), rest = o * E.caveK - full, want = full + rest * CAVE.runs.halfK, g = Math.min(want, Math.max(0, C.cave));
    C.cave -= g; C.cd.g += Math.min(g, full); why.cave = Math.floor(g); }
  { if (C.cc.d !== day) C.cc = { d: day, got: [] };
    const cg = isObj(S.cave?.chest) && S.cave.chest.d === dateOfDay(day) && Array.isArray(S.cave.chest.got) ? S.cave.chest.got : [];
    for (const id of cg.slice(0, 8)) { const m = /^c(\d)$/.exec(id); if (!m || +m[1] >= CAVE.floors || C.cc.got.includes(id)) continue; C.cc.got.push(id); why.cave += CAVE.chest.gyul[+m[1]] || 0; }
    const bd = typeof S.cave?.boss === 'string' ? S.cave.boss : '';
    if (bd && bd !== P.cave?.boss && (bd === dateOfDay(day) || bd === dateOfDay(day - 1)) && C.cb !== bd) { C.cb = bd; why.cave += CAVE.owner.gyul; } }
  // 9) 들판 떼 한 판 버팀 (#202)
  const W = isObj(S.swarm?.won) ? S.swarm.won : {}, PW = isObj(P.swarm?.won) ? P.swarm.won : {};
  for (let z = 1; z <= 5; z++) {
    const w = W[z]; if (!isObj(w)) continue;
    if (!((Number(w.at) || 0) > (Number(PW[z]?.at) || 0))) continue;
    if (t - (Number(C.sw[z]) || 0) < SWARM.run.rest * 1000 * E.swarmRestK) continue;
    C.sw[z] = t; why.swarm += Math.max(0, Math.min(SWARM.run.bonusMax[z] || 0, Math.floor(Number(w.b) || 0)));
  }
  const room = Object.values(why).reduce((a, b) => a + b, 0);
  return { room, cred: C, why, bad };
}
