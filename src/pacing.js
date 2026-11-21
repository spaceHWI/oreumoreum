// 연출 감독 (#89): 힐링 시간과 공격 시간이 번갈아 흐르게 차례를 정한다. 수치는 balance.js PACE
// 그림·DOM 없이 박자만 셈 (tools/pace.js 가 node 에서 그대로 돌려 20분 시간표를 뽑음). 실제로 적을 부르고 화면을 바꾸는 건 game/pace.js 의 hooks
//   calm(힐링) → omen(조짐 PACE.omen 초) → tense(공격, 다 쫓아내거나 attack 초) → rest(쉼 PACE.rest 초, 새 적 없음) → calm …
// 꽃이 피면(note('bloom')) PACE.bloomQuiet 초 동안 조짐도 시작하지 않음. 낚시·가게·마차 중(hooks.busy)이면 미룸
// 팁·잭팟·마차 표시는 canTip()·canJack()·canMark() 로 긴장 때 겹치지 않게
// hooks: busy() 지금 공격을 시작하면 안 되나, threats() 살아 있는 적 수, omen(plan) 조짐(적 자리를 정함, 못 정하면 false),
//        attack(plan) 나타남({ eta } 또는 false), forceEnd() 시간이 다 됨(남은 적을 돌려보냄), end(info) 끝·보상, delight(kind) 작은 즐거움(되면 true),
//        firstDone() 첫 공격이 끝남(저장)
// first: { done 첫 공격을 이미 겪음, bloomed 꽃을 한 번 피움 } (튜토리얼 뒤 첫 공격은 꽃 한 번 뒤 약한 투기꾼 하나)
// perHour: 투기꾼이 한 시간에 쌓을 양(DUMP_PER_HOUR). 한 번 올 때 양은 이 평균이 맞게 나눔
// crowd(): 같이 있는 사람 수 (#131, 방이 셈. 없으면 1). 한 사람 몫 = perHour × crowdShare(n), 간격은 crowdGap(n) 배 먼저 늘리고 나머지는 양을 줄임
import { PACE, DUMP } from './balance.js';
import { crowdShare, crowdGap } from './refill.js';

const rr = (rnd, [a, b]) => a + rnd() * (b - a);
const ri = (rnd, [a, b]) => a + Math.floor(rnd() * (b - a + 1));
const mid = ([a, b]) => (a + b) / 2;
export const DELIGHTS = ['lucky', 'deer', 'fireflies', 'jackpot'];

export function createPacing({ rnd = Math.random, hooks = {}, first = { done: true, bloomed: true }, perHour = 0, crowd = () => 1 }) {
  let t = 0, phase = 'calm', phaseT = 0, nextAt = 0, restUntil = 0, quietUntil = 0, lastEvent = 0, tension = 0, wave = 0, busyN = 0;
  let plan = null, atk = null, delightI = Math.floor(rnd() * DELIGHTS.length);
  const log = [{ t: 0, phase: 'calm' }], events = [];
  const cfg = () => PACE.battle; // 서버는 전투 오름 하나 (#98)
  const gapMul = () => crowdGap(crowd()); // 사람이 많으면 공격·투기꾼 간격을 늘림 (#131)
  const gap = () => { const g = cfg().gap, k = gapMul(); return [g[0] * k, g[1] * k]; };
  // 첫 공격 시각: 지금부터 gap 의 0.4~0.7 (첫 공격을 아직 안 겪었으면 꽃을 피울 때 정함)
  const schedFirst = () => { nextAt = first.done ? t + rr(rnd, gap()) * (0.4 + rnd() * 0.3) : first.bloomed ? t + PACE.firstDelay + 30 : Infinity; };
  schedFirst();
  function go(p) { if (p === phase) return; phase = p; phaseT = 0; log.push({ t: +t.toFixed(2), phase: p }); }
  function ev(kind, data = {}) { events.push({ t: +t.toFixed(2), kind, ...data }); }

  // 한 번 올 때 투기꾼 양: 한 시간 양 × 평균 간격 ÷ (투기꾼이 오는 차례 비율). 투기꾼은 DUMP.walker.amt 그대로, 트럭이 나머지 (truckMax 까지)
  // 같이 있으면 (#131): 간격이 gapMul 배로 늘었으니, 한 번 양은 혼자일 때 양 × 한 사람 몫 × gapMul (≤ 1)
  function dumpAmts() {
    const C = cfg(), share = 1 / C.dumpEvery, per = perHour * mid(C.gap) / 3600 / share;
    const W = DUMP.walker.amt, p = DUMP.truckP, solo = Math.min(PACE.truckMax, Math.max(W, Math.round((per - (1 - p) * W) / p)));
    const n = crowd(), f = Math.min(1, crowdShare(n) * gapMul());
    return { walker: W, truck: Math.max(W, Math.round(solo * f)) };
  }
  function makePlan() {
    const amt = dumpAmts();
    wave++;
    if (!first.done) return { first: true, wave, dumpers: [{ kind: 'walker', amt: amt.walker }], mob: false };
    const withDump = wave % PACE.battle.dumpEvery === 0;
    return { wave, mob: true, group: PACE.battle.group, dumpers: withDump ? [rnd() < DUMP.truckP ? { kind: 'truck', amt: amt.truck } : { kind: 'walker', amt: amt.walker }] : [] };
  }
  function end(forced) {
    if (forced) hooks.forceEnd?.();
    const full = !!atk && atk.total > 0 && atk.repelled >= atk.total;
    const bonus = !atk || !atk.total || !atk.repelled ? 0 : full ? cfg().bonus : Math.ceil(cfg().bonus / 3);
    const info = { full, bonus, repelled: atk?.repelled || 0, total: atk?.total || 0, forced: !!forced, first: !!plan?.first, len: +phaseT.toFixed(1) };
    ev('end', info);
    if (plan?.first) { first.done = true; hooks.firstDone?.(); }
    hooks.end?.(info);
    restUntil = t + PACE.rest; lastEvent = t;
    nextAt = Math.max((atk?.start ?? t) + rr(rnd, gap()), restUntil);
    plan = null; atk = null; go('rest');
  }

  function update(dt) {
    t += dt; phaseT += dt;
    const want = phase === 'omen' || phase === 'tense' ? 1 : 0;
    tension = want > tension ? Math.min(1, tension + dt / PACE.riseT) : Math.max(0, tension - dt / PACE.fallT);
    if (phase === 'calm' || phase === 'rest') {
      if (phase === 'rest' && t >= restUntil) go('calm');
      // 감독이 부르지 않은 적(개발자 버튼 등)이 오면 그대로 긴장으로
      const n = hooks.threats ? hooks.threats() : 0;
      if (n > 0) { plan = { wave, adhoc: true, dumpers: [] }; atk = { start: t, cap: PACE.attack[1], total: n, repelled: 0 }; ev('adhoc', { n }); go('tense'); return; }
      if (phase === 'calm' && t >= nextAt && t >= quietUntil) {
        if (hooks.busy?.()) { nextAt = t + PACE.busyWait; busyN++; ev('busy'); }
        else {
          plan = makePlan();
          if (hooks.omen && !hooks.omen(plan)) { ev('nospot', { wave: plan.wave }); wave--; plan = null; nextAt = t + 30; }
          else { ev('omen', { wave: plan.wave, mob: plan.mob, dumpers: plan.dumpers.map((d) => d.kind).join('+'), first: !!plan.first }); go('omen'); }
        }
      }
      if ((phase === 'calm' || phase === 'rest') && t - lastEvent >= PACE.calmMax && t >= quietUntil) { // 지루함: 작은 즐거움 하나
        for (let k = 0; k < DELIGHTS.length; k++) { const kind = DELIGHTS[(delightI + k) % DELIGHTS.length]; if (!hooks.delight || hooks.delight(kind)) { delightI += k + 1; ev('delight', { what: kind }); break; } }
        lastEvent = t;
      }
    } else if (phase === 'omen') {
      if (phaseT >= PACE.omen) {
        const info = hooks.attack ? hooks.attack(plan) : { eta: 0, n: 1 };
        if (!info) { ev('nospot', { wave: plan.wave }); plan = null; nextAt = t + 30; go('calm'); return; }
        const cap = Math.min(PACE.attack[1], Math.max(rr(rnd, PACE.attack), (info.eta || 0) + DUMP.dumpT + 8));
        atk = { start: t, cap, total: info.n ?? 1, repelled: 0 }; ev('attack', { cap: +cap.toFixed(1), n: atk.total }); go('tense');
      }
    } else if (phase === 'tense') {
      const n = hooks.threats ? hooks.threats() : 0;
      if (n <= 0 && phaseT > 1) end(false);
      else if (phaseT >= atk.cap) end(true);
    }
  }
  // 일이 생김: bloom 꽃이 핌(더미·구역), repel 하나 쫓아냄, event 그 밖의 사건(잭팟·팁 등, 지루함 시계를 되돌림)
  function note(kind) {
    if (kind === 'bloom') {
      quietUntil = Math.max(quietUntil, t + PACE.bloomQuiet); lastEvent = t; ev('bloom');
      if (!first.bloomed) first.bloomed = true;
      if (!first.done && !Number.isFinite(nextAt)) nextAt = t + PACE.bloomQuiet + PACE.firstDelay; // 튜토리얼 뒤 꽃 한 번 → 첫 공격
      if (phase === 'calm') nextAt = Math.max(nextAt, quietUntil);
    } else if (kind === 'repel') { if (atk) atk.repelled++; ev('repel'); }
    else { lastEvent = t; ev(kind); }
  }
  const quiet = () => phase === 'omen' || phase === 'tense';
  return {
    update, note,
    get phase() { return phase; }, get tension() { return tension; }, get t() { return t; }, get wave() { return wave; },
    get plan() { return plan; }, get nextIn() { return Math.max(0, Math.max(nextAt, quietUntil) - t); },
    canTip: () => !quiet() && t >= quietUntil,
    canJack: () => !quiet(),
    canMark: () => !quiet(),
    log, events, busyN: () => busyN,
    // 확인용: 다음 공격을 s 초 뒤로
    test: { soon(s = 0) { if (!first.done) { first.bloomed = true; } nextAt = t + s; quietUntil = Math.min(quietUntil, t); if (phase === 'rest') { restUntil = t; } }, first, dumpAmts: () => dumpAmts(), gap: () => gap() },
  };
}
