// 감독 (#176): 화면에 말을 거는 것(안내·팁·이벤트·대사)을 한 번에 하나씩, 유저 저니 순서대로 내보낸다. 설계는 notes/journey.md 3절
// 그림·DOM 없이 차례만 정함 (tools/journey.js 가 node 에서 그대로 돌려 30분 시간표를 뽑음). 실제 화면에 띄우는 건 game/director.js
//
// 1. 한 번에 하나: ask(kind, id, show, { sec, ttl }) → 지금 나가도 되면 show() 를 부르고 true, 아니면 줄에 세우고 false (ttl 초 안에 차례가 오면 그때 show)
//    우선순위는 JOURNEY.prio 순서(앞이 높음). 낮은 것은 높은 것이 끝나고 JOURNEY.gap 초 뒤, 같거나 높은 것은 JOURNEY.quick 초 뒤.
//    JOURNEY.preempt 보다 높은(앞) 것은 지금 나가는 낮은 것을 끊고 바로 나감. 싸우는 중(hooks.fight)에는 앞 JOURNEY.fightMax 개만
//    show 가 창(끝을 모름)이면 sec: Infinity 로 하고 닫힐 때 end(id)
// 2. 문 열기: JOURNEY.doors 순서. register({ id, gate, intro, kind }) 로 등록한 문만 본다(등록 안 된 문은 건너뜀 = 아직 없는 시스템)
//    문은 after(앞 문, 기본은 표에서 바로 앞의 등록된 문)가 열렸고 need({사실: 최소값})·gate(facts) 가 맞으면 열림 → intro() 를 ask(kind 기본 'intro')
// 3. 하루에 새로 소개하는 문(count: 1)은 JOURNEY.perDay 개까지. 넘치면 다음 날로
// 4. 속도 조절: note('act')(줍기·싸움·이동 목표) 없이 JOURNEY.idleSec 지나면 clue 를 등록한 것들에게 차례로 실마리를 부탁(되면 true). 바쁘면(싸움·hooks.busy) 세지 않음
// 5. 옛 저장·건너뛴 사람: save.journey 가 없던 저장(진행이 있음)은 처음 볼 때 조건을 넘긴 문을 한꺼번에 조용히 연다(소개 없이, 하루 개수에 안 셈)
// 저장 save.journey = { step 열린 문 수, seen {문 id: 연 날 'YYYY-MM-DD'}, day 오늘, n 오늘 소개한 수, days 놀아 본 날 수 }
// hooks: facts() 사실 값들(tut·picked·bloomed·…), busy() 바깥 사정으로 지금 말을 걸면 안 됨(패널·다른 토스트 등, danger 는 무시),
//        fight() 싸우는 중, log(e) 기록 하나
import { JOURNEY } from './balance.js';

const J = JOURNEY;
export const PRIO = Object.fromEntries(J.prio.map((k, i) => [k, i]));
const pri = (kind) => (kind in PRIO ? PRIO[kind] : J.prio.length);
const dayOf = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function createDirector({ save, persist = () => {}, hooks = {}, today = () => dayOf() }) {
  const regs = new Map(); // id → { id, gate, intro, kind, clue }
  let clock = 0, cur = null, lastEnd = -1e9, lastPrio = 99, idle = 0, nudges = 0, gateT = 0, fresh = false;
  const queue = []; // { kind, id, show, sec, exp, at }
  const log = []; // { t, ev, kind, id, sec }
  const rec = (ev, kind, id, extra) => { const e = { t: +clock.toFixed(2), ev, kind, id, ...extra }; log.push(e); if (log.length > 400) log.shift(); hooks.log?.(e); };

  const S = () => {
    let j = save.journey;
    if (!j || typeof j !== 'object' || Array.isArray(j)) { j = save.journey = { step: 0, seen: {}, day: '', n: 0, days: 0 }; fresh = true; }
    if (!j.seen || typeof j.seen !== 'object') j.seen = {};
    const d = today(); if (j.day !== d) { j.day = d; j.n = 0; j.days = (j.days | 0) + 1; }
    return j;
  };
  S();
  // 옛 저장: 튜토리얼을 마친(또는 건너뛴) 저장에 journey 가 처음 생겼으면 조건을 넘긴 문을 조용히 연다 (첫 gate 확인 때)
  let catchUp = fresh && !!(save.tut?.done || save.jeong);

  const facts = () => { let f = {}; try { f = hooks.facts?.() || {}; } catch { f = {}; } f.days = S().days; return f; };
  const busy = () => { try { return !!hooks.busy?.(); } catch { return false; } };
  const fight = () => { try { return !!hooks.fight?.(); } catch { return false; } };

  // ---------- 1. 한 번에 하나 ----------
  function can(kind, { ignoreQueue = false } = {}) {
    const p = pri(kind);
    if (cur) { if (!(p < J.preempt && p < pri(cur.kind))) return false; }
    else if (clock - lastEnd < (p > lastPrio ? J.gap : J.quick)) return false;
    if (p > 0 && busy()) return false;
    if (p >= J.fightMax && fight()) return false;
    if (!ignoreQueue && queue.some((q) => q.exp > clock && pri(q.kind) < p)) return false; // 더 높은 것이 기다리는 중
    return true;
  }
  function finish(why = 'end') {
    if (!cur) return;
    rec(why, cur.kind, cur.id, { len: +(clock - cur.t0).toFixed(2) });
    lastEnd = clock; lastPrio = pri(cur.kind); cur = null;
  }
  function show(kind, id, fn, sec) {
    if (cur) finish('cut'); // 앞 것을 끊음 (preempt)
    cur = { kind, id, t0: clock, until: clock + sec };
    rec('show', kind, id, { sec: Number.isFinite(sec) ? sec : -1 }); idle = 0; // 말을 걸었으면 한가함은 처음부터
    try { fn?.(); } catch (e) { rec('err', kind, id, { msg: String(e?.message || e).slice(0, 80) }); }
    return true;
  }
  function ask(kind, id, fn, { sec = J.sec, ttl = J.ttl, queue: q = true } = {}) {
    if (cur && cur.id === id) return true; // 이미 나가는 중
    if (can(kind)) { const i = queue.findIndex((x) => x.id === id); if (i >= 0) queue.splice(i, 1); return show(kind, id, fn, sec); }
    if (q) {
      const old = queue.find((x) => x.id === id);
      if (old) { old.show = fn; old.sec = sec; old.exp = clock + ttl; }
      else { queue.push({ kind, id, show: fn, sec, exp: clock + ttl, at: clock }); rec('wait', kind, id); }
    }
    return false;
  }
  // 바깥에서 띄운 것을 감독이 알게 함 (tips.js 처럼 스스로 때를 보는 것). can 을 먼저 볼 것
  function begin(kind, id, sec = J.sec) { return show(kind, id, null, sec); }
  function end(id) { if (cur && (id == null || cur.id === id)) finish('end'); }
  function drain() {
    for (let i = queue.length - 1; i >= 0; i--) if (queue[i].exp <= clock) { rec('drop', queue[i].kind, queue[i].id); queue.splice(i, 1); }
    if (!queue.length) return;
    const best = queue.slice().sort((a, b) => pri(a.kind) - pri(b.kind) || a.at - b.at)[0];
    if (can(best.kind, { ignoreQueue: true })) { queue.splice(queue.indexOf(best), 1); show(best.kind, best.id, best.show, best.sec); }
  }

  // ---------- 2·3·5. 문 열기 ----------
  const DOOR = new Map(J.doors.map((d, i) => [d.id, { ...d, i }]));
  const isOpen = (id) => !!S().seen[id];
  function afterOf(d) { // 앞 문: 적힌 after 가 등록 안 됐으면 그 문의 앞 문을 따라감. after 가 없으면 표에서 바로 앞의 등록된 문, null 이면 없음
    if (d.after === null) return null;
    if (d.after) { const a = DOOR.get(d.after); if (!a) return null; return regs.has(a.id) ? a.id : afterOf(a); }
    for (let i = d.i - 1; i >= 0; i--) if (regs.has(J.doors[i].id)) return J.doors[i].id;
    return null;
  }
  function needOk(d, f) {
    for (const [k, v] of Object.entries(d.need || {})) if (!((+f[k] || 0) >= v)) return false;
    const r = regs.get(d.id); if (r?.gate) { try { if (!r.gate(f)) return false; } catch { return false; } }
    return true;
  }
  function open(id, { quiet = false } = {}) {
    const j = S(); if (j.seen[id]) return false;
    j.seen[id] = j.day; j.step = Object.keys(j.seen).filter((k) => DOOR.has(k)).length;
    const d = DOOR.get(id), r = regs.get(id);
    if (!quiet && d?.count) j.n = (j.n | 0) + 1;
    persist(); rec(quiet ? 'open-quiet' : 'open', 'door', id);
    if (!quiet && r?.intro) ask(r.kind || 'intro', 'intro:' + id, r.intro, { sec: r.sec ?? J.sec, ttl: J.introTtl });
    try { r?.onOpen?.(quiet); } catch { /* 무시 */ }
    return true;
  }
  function gates() {
    const f = facts(), j = S();
    let more = true, guard = 0;
    while (more && guard++ < J.doors.length + 2) { // 한 번에 여러 문이 열릴 수 있음(옛 저장)
      more = false;
      for (const d of J.doors) {
        if (!regs.has(d.id) || j.seen[d.id]) continue;
        const a = afterOf(DOOR.get(d.id)); if (a && !j.seen[a]) continue;
        if (!needOk(d, f)) continue;
        if (catchUp) { open(d.id, { quiet: true }); more = true; continue; }
        if (d.count && (j.n | 0) >= J.perDay) continue; // 오늘 소개는 다 함 → 내일
        open(d.id); more = true;
      }
    }
    catchUp = false;
  }

  // ---------- 4. 속도 조절 ----------
  function note(what) { if (what === 'act') { idle = 0; nudges = 0; } }
  function pull() {
    for (const r of regs.values()) {
      if (!r.clue || (DOOR.has(r.id) && !isOpen(r.id))) continue;
      let ok = false; try { ok = !!r.clue(); } catch { ok = false; }
      if (ok) { rec('clue', 'clue', r.id); return true; }
    }
    return false;
  }

  function tick(dt) {
    clock += dt;
    if (cur && clock >= cur.until) finish();
    if ((gateT -= dt) <= 0) { gateT = J.gateSec; gates(); }
    drain();
    if (fight() || busy() || cur) idle = Math.min(idle, J.idleSec * 0.5); // 바쁘면 미룸 (끝나면 반부터 다시 셈)
    else idle += dt;
    if (idle >= J.idleSec * 2 ** Math.min(nudges, J.idleBack) && !cur) { if (pull()) nudges++; else idle -= J.retry; } // 못 하면 조금 뒤 다시
  }

  return {
    ask, can: (k) => can(k), begin, end, tick, note, isOpen, open: (id) => open(id), register(r) { regs.set(r.id, r); gateT = 0; return r; },
    get busy() { return !!cur; }, get cur() { return cur ? { ...cur } : null; }, get clock() { return clock; }, get idle() { return idle; },
    state() {
      const j = S();
      return {
        step: j.step, day: j.day, today: j.n | 0, days: j.days, cur: cur && { kind: cur.kind, id: cur.id, left: Number.isFinite(cur.until) ? +(cur.until - clock).toFixed(1) : -1 },
        open: Object.keys(j.seen), next: J.doors.filter((d) => regs.has(d.id) && !j.seen[d.id]).map((d) => d.id),
        waiting: queue.map((q) => ({ kind: q.kind, id: q.id, ttl: +(q.exp - clock).toFixed(1) })), idle: +idle.toFixed(1), registered: [...regs.keys()],
      };
    },
    log, reset() { save.journey = null; queue.length = 0; cur = null; S(); persist(); },
  };
}
