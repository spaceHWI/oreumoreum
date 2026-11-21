// 퀘스트 (#158): 받기 → 하기 → 돌아가 보상. 그림·DOM 없이 차례와 진행만 셈 (tools/questrun.js 가 게임 안에서, node 에서도 그대로 씀)
// 화면(주는 사람·머리 위 표시·창·추적 줄·지도)은 game/quest.js. 퀘스트 표는 balance.js QUESTS
// - 줄기(main): 한 번에 하나. 앞에서부터 끝내지 않은 첫 퀘스트(need 가 없는 것은 건너뜀)를 그 퀘스트의 giver 가 줌. 받으면 to(없으면 giver)에게 돌려줌
// - 곁가지(side): door(감독 문)가 열렸고 after(앞 퀘스트)를 끝냈으면 giver 가 줌. 여럿을 같이 할 수 있음. 그만두기는 없음
// - 진행: ask.k 셈 값(val)에서 받을 때 값(base)을 뺀 것. ever 면 받기 전 것도 셈(우두머리·구역처럼 다시 못 하는 것)
// - 옛 저장(save.quest 가 없는데 튜토리얼을 마친 저장): 앞에서부터 이미 한 줄기 퀘스트(oldDone)를 보상 없이 끝낸 것으로 치고, 아직 안 한 첫 것부터 줌
// 저장 save.quest = { v, cur: { id, base, r } | null, done: [id], side: { id: { base, r } }, cp: { 가게: 할인권 수 }, c: { 셈 이름: 수 }, skip: [옛 저장으로 건너뛴 id] }
// hooks: val(k) 셈 값, has(need) 있는 기능인가, door(id) 감독 문이 열렸나, open() 줄기 퀘스트를 줄 때가 됐나(정낭을 나섬), oldDone(q) 옛 저장에서 이미 한 것인가, ready(q) 조건을 막 채움
export function createQuests({ save, persist = () => {}, defs, hooks = {} }) {
  const MAIN = defs.main, SIDE = defs.side, BY = new Map([...MAIN, ...SIDE].map((q) => [q.id, q]));
  const isMain = (q) => MAIN.includes(q);
  const call = (f, ...a) => { try { return f?.(...a); } catch { return undefined; } };
  let fresh = false;
  const S = () => {
    let s = save.quest;
    if (!s || typeof s !== 'object' || Array.isArray(s)) { s = save.quest = { v: 1, cur: null, done: [], side: {}, cp: {}, c: {} }; fresh = true; }
    if (!Array.isArray(s.done)) s.done = []; s.done = s.done.filter((id) => BY.has(id));
    if (s.cur && (typeof s.cur !== 'object' || !BY.has(s.cur.id) || !isMain(BY.get(s.cur.id)) || s.done.includes(s.cur.id))) s.cur = null;
    if (!s.side || typeof s.side !== 'object' || Array.isArray(s.side)) s.side = {};
    for (const id of Object.keys(s.side)) if (!BY.has(id) || isMain(BY.get(id)) || s.done.includes(id) || typeof s.side[id] !== 'object') delete s.side[id];
    for (const k of ['cp', 'c']) if (!s[k] || typeof s[k] !== 'object' || Array.isArray(s[k])) s[k] = {};
    return s;
  };
  S();
  const wasFresh = fresh;
  const isDone = (id) => S().done.includes(id);
  const has = (q) => !q.need || !!call(hooks.has, q.need);
  const val = (k) => { const v = Number(call(hooks.val, k)); return Number.isFinite(v) ? v : 0; };
  const baseOf = (q) => { const b = {}; if (!q.ask.ever) b[q.ask.k] = val(q.ask.k); return b; };
  function prog(q, e) { const n = q.ask.n, v = val(q.ask.k) - (q.ask.ever ? 0 : (+e?.base?.[q.ask.k] || 0)); return Math.max(0, Math.min(n, Math.floor(v))); }
  const entry = (q) => (isMain(q) ? (S().cur?.id === q.id ? S().cur : null) : S().side[q.id] || null);
  const ready = (q) => { const e = entry(q); return !!e && prog(q, e) >= q.ask.n; };
  const turnIn = (q) => q.to || q.giver;

  // 줄기: 끝내지 않은 첫 것 (need 없는 것은 건너뜀)
  function mainNext() { for (const q of MAIN) { if (isDone(q.id)) continue; if (!has(q)) continue; return q; } return null; }
  const mainOpen = () => !!call(hooks.open);
  function sideOk(q) {
    if (isDone(q.id) || !has(q)) return false;
    if (q.door && !call(hooks.door, q.door)) return false;
    if (q.after && !isDone(q.after)) { const a = BY.get(q.after); if (!a || has(a)) return false; } // 앞 것이 있는 기능인데 아직이면 기다림 (앞 것이 없는 기능이면 건너뜀)
    if (q.giver === 'jigi' && !mainOpen()) return false;
    return true;
  }

  // 옛 저장: 앞에서부터 이미 한 것은 끝낸 것으로 (보상 없이)
  function catchUp() {
    const s = S(), skip = [];
    for (const q of MAIN) {
      if (isDone(q.id)) continue; if (!has(q)) continue;
      if (!call(hooks.oldDone, q)) break;
      s.done.push(q.id); skip.push(q.id);
    }
    if (skip.length) { s.skip = skip; persist(); }
    return skip;
  }

  // 이 사람에게 할 것: [{ q, st: 'ready'|'offer'|'on', main }] (돌려줄 것 → 줄기 받기 → 곁가지 받기 → 하는 중)
  function at(giver) {
    const s = S(), out = [];
    if (s.cur) { const q = BY.get(s.cur.id); if (turnIn(q) === giver && ready(q)) out.push({ q, st: 'ready', main: true }); else if (q.giver === giver || turnIn(q) === giver) out.push({ q, st: 'on', main: true }); }
    else if (mainOpen()) { const q = mainNext(); if (q && q.giver === giver) out.push({ q, st: 'offer', main: true }); }
    for (const q of SIDE) {
      if (q.giver !== giver && q.to !== giver) continue;
      if (s.side[q.id]) out.push({ q, st: ready(q) && turnIn(q) === giver ? 'ready' : 'on', main: false });
      else if (q.giver === giver && sideOk(q)) out.push({ q, st: 'offer', main: false });
    }
    const rank = { ready: 0, offer: 1, on: 2 };
    return out.sort((a, b) => rank[a.st] - rank[b.st] || (b.main - a.main));
  }
  // 머리 위 표시: '?' 돌려줄 것 · '!' 줄기 받기 · 'w' 곁가지 받기 · 'g' 하는 중 · null
  function mark(giver) {
    const l = at(giver); if (!l.length) return null; const a = l[0];
    if (a.st === 'ready') return '?';
    if (a.st === 'offer') return a.main ? '!' : (l.some((x) => x.st === 'offer' && x.main) ? '!' : 'w');
    return 'g';
  }
  function accept(id) {
    const q = BY.get(id), s = S(); if (!q || isDone(id)) return false;
    if (isMain(q)) { if (s.cur || mainNext() !== q || !mainOpen()) return false; s.cur = { id, base: baseOf(q), r: 0 }; }
    else { if (s.side[id] || !sideOk(q)) return false; s.side[id] = { base: baseOf(q), r: 0 }; }
    persist(); return true;
  }
  // 끝내기: 보상을 돌려줌 (주는 것은 game/quest.js)
  function complete(id) {
    const q = BY.get(id), s = S(); if (!q || !ready(q)) return null;
    if (isMain(q)) s.cur = null; else delete s.side[id];
    s.done.push(id);
    const cp = q.reward?.coupon; if (cp) s.cp[cp[0]] = (s.cp[cp[0]] | 0) + cp[1];
    persist(); return q.reward || {};
  }
  // 추적할 것: 줄기 하는 중 → 곁가지 하는 중 → 줄기 받으러 가기
  function tracked() {
    const s = S();
    const mk = (q, e, st) => ({ q, st, p: e ? prog(q, e) : 0, n: q.ask.n, ready: !!e && prog(q, e) >= q.ask.n, to: turnIn(q), main: isMain(q) });
    if (s.cur) { const q = BY.get(s.cur.id); return mk(q, s.cur, 'on'); }
    for (const q of SIDE) if (s.side[q.id] && ready(q)) return mk(q, s.side[q.id], 'on');
    if (mainOpen()) { const q = mainNext(); if (q) return mk(q, null, 'offer'); }
    for (const q of SIDE) if (s.side[q.id]) return mk(q, s.side[q.id], 'on');
    return null;
  }
  // 조건을 막 채운 것을 한 번 알림
  function tick() {
    const s = S(), es = [];
    if (s.cur) es.push([BY.get(s.cur.id), s.cur]);
    for (const id of Object.keys(s.side)) es.push([BY.get(id), s.side[id]]);
    for (const [q, e] of es) { if (e.r || prog(q, e) < q.ask.n) continue; e.r = 1; persist(); call(hooks.ready, q); }
  }
  const coupons = (shop) => S().cp[shop] | 0;
  function useCoupon(shop) { const s = S(); if (!(s.cp[shop] > 0)) return false; s.cp[shop]--; if (!s.cp[shop]) delete s.cp[shop]; persist(); return true; }
  // 셈 하나 올리기 (game/quest.js 가 사건마다)
  function count(k, n = 1) { const c = S().c; c[k] = (c[k] || 0) + n; }
  function list() { // 퀘스트 창: 하는 중·끝낸 것, 주는 사람별
    const s = S(), on = [], done = [];
    if (s.cur) on.push(BY.get(s.cur.id)); for (const id of Object.keys(s.side)) on.push(BY.get(id));
    for (const id of s.done) done.push(BY.get(id));
    return { on: on.map((q) => ({ q, p: prog(q, entry(q)), n: q.ask.n, ready: ready(q), main: isMain(q) })), done, skip: s.skip || [] };
  }
  return {
    defs, BY, at, mark, accept, complete, tracked, tick, prog: (id) => { const q = BY.get(id); return q ? prog(q, entry(q)) : 0; }, ready: (id) => { const q = BY.get(id); return !!q && ready(q); },
    isDone, mainNext, catchUp, count, coupons, useCoupon, list, wasFresh, state: S,
    reset() { save.quest = null; S(); persist(); },
  };
}
