// 가게를 퀘스트 순서대로 하나씩 열기 (#206): 어느 가게가 열렸는지만 셈 (그림·DOM 없음). 게임에 붙이는 건 game/shopgate.js
// 표는 balance.js SHOP_ST.unlock. 저장 save.shopGate = { open: {가게 id: 1}, init: 1, full: 첫 배낭이 가득 찼었음, fd: 가득 찬 뒤 버림, dumps: 그때 버린 수 }
// 1. 처음 볼 때(init 없음): 조건(need·old)을 넘겼거나 그 가게를 쓴 적이 있으면(hooks.used) 조용히 엶 → 옛 저장에서 쓰던 가게가 닫히지 않음
// 2. 그 뒤: check() 가 새로 조건을 채운 가게 id 를 돌려줌 (열지는 않음). 게임이 알림을 띄울 때 open(id)
// 3. 한 번 열린 가게는 닫히지 않음. hooks.force() 가 참이면(어드민 '가게 모두 열기'·촬영 모드) 모두 열린 것으로 봄
// hooks: facts() → { jeong, fullDump, zd1, zd2, zone, lv, dumps, … }, used(id) 쓴 적이 있나, force()
export function createShopGate({ save, persist = () => {}, defs = [], hooks = {} }) {
  const BY = new Map(defs.map((d) => [d.id, d]));
  const S = () => {
    let g = save.shopGate;
    if (!g || typeof g !== 'object' || Array.isArray(g)) g = save.shopGate = { open: {}, init: 0 };
    if (!g.open || typeof g.open !== 'object' || Array.isArray(g.open)) g.open = {};
    for (const k of Object.keys(g.open)) if (!BY.has(k) || g.open[k] !== 1) delete g.open[k];
    return g;
  };
  const call = (f, ...a) => { try { return f ? f(...a) : undefined; } catch { return undefined; } };
  const meets = (need, f) => Array.isArray(need) && need.some((o) => o && Object.entries(o).every(([k, n]) => (+f[k] || 0) >= n));
  const force = () => !!call(hooks.force);
  const facts = () => call(hooks.facts) || {};
  function check() {
    const g = S(), f = facts();
    if (!g.init) {
      g.init = 1;
      for (const d of defs) if (meets(d.need, f) || meets(d.old, f) || call(hooks.used, d.id)) g.open[d.id] = 1;
      persist(); return [];
    }
    return defs.filter((d) => !g.open[d.id] && meets(d.need, f)).map((d) => d.id);
  }
  function open(id) { const g = S(); if (!BY.has(id) || g.open[id]) return false; g.open[id] = 1; persist(); return true; }
  const isOpen = (id) => !BY.has(id) || force() || !!S().open[id]; // 표에 없는 가게는 늘 열림
  const opened = (id) => !BY.has(id) || !!S().open[id]; // force 를 빼고 (셔터 그림이 force 를 따로 봄)
  const why = (id) => (isOpen(id) ? '' : BY.get(id).how || '');
  return { check, open, isOpen, opened, why, def: (id) => BY.get(id) || null, force, state: () => JSON.parse(JSON.stringify(S())), S };
}
