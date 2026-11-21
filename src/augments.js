// 레벨과 증강 (#159): 저장(save)만 읽고 쓰는 순수 함수. 게임(game/level.js·여러 능력치 자리)·서버(validate.js)·tools/econ.js 가 같이 씀
// 저장 save.lv = { xp 누적 경험치 = 지금까지 번 귤(#202), aug { 증강 id: 겹친 수 }, draw [지금 보여 줄 3개 id] | null, rr 이번 뽑기에서 다시 뽑기를 썼는지, v 2 = 번 귤 경험치 }
// v 가 없는 저장(#159·#194 경험치)은 migrateLv 가 한 번 바꿈: 기록으로 번 귤을 어림하고, 옛 곡선의 레벨보다 내려가지 않게
// 레벨은 xp 로 늘 다시 셈 (저장에 따로 두지 않음). 고를 증강 수 = 레벨 - 1 - 고른 수
import { LEVEL, AUGMENTS, QUESTS } from './balance.js';

export const AUG_BY = Object.fromEntries(AUGMENTS.list.map((a) => [a.id, a]));
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

// 레벨 L 에서 L+1 까지 드는 귤 (#202): base × k^(L-1), from 부터는 앞 레벨의 k2 배씩
export const needXp = (L) => Math.round(LEVEL.base * LEVEL.k ** (Math.min(L, LEVEL.from - 1) - 1) * LEVEL.k2 ** Math.max(0, L - LEVEL.from + 1));
const walk = (xp, need) => {
  let lv = 1, left = Math.max(0, xp || 0);
  while (lv < LEVEL.max && left >= need(lv)) { left -= need(lv); lv++; }
  return { lv, left };
};
// 누적 경험치 → { lv, into 이번 레벨에서 모은 것, need 이번 레벨에 드는 것, k 0~1 }
export function levelOf(xp) {
  const { lv, left } = walk(xp, needXp), need = lv < LEVEL.max ? needXp(lv) : 0;
  return { lv, into: Math.floor(left), need, k: need ? left / need : 1 };
}
// 레벨 L 에 닿는 누적 경험치
export const xpAt = (L) => { let s = 0; for (let i = 1; i < Math.min(L, LEVEL.max); i++) s += needXp(i); return s; };

// 옛 저장 (#202 앞): 옛 곡선(#159, #194 의 뒤쪽 1.25배 앞)으로 본 레벨 · 기록으로 어림한 번 귤
const needOld = (L) => Math.round(LEVEL.old.base * L ** LEVEL.old.pow);
export const oldLevel = (xp) => walk(xp, needOld).lv;
const QREW = new Map([...QUESTS.main, ...(QUESTS.side || [])].map((q) => [q.id, q.reward?.gyul || 0]));
export function earnedGuess(save) {
  const A = save.ach?.life || {}, n = (k) => Math.max(0, Math.min(1e10, +A[k] || 0));
  let g = n('earn') + n('pickup') + Math.max(0, Math.min(1e10, +save.swarm?.earn || 0)); /* 버려 받은 귤·낚시(earn) + 주운 귤 알갱이(pickup: 적·우두머리·소굴) + 들판 떼 */
  for (const id of Array.isArray(save.quest?.done) ? save.quest.done : []) g += QREW.get(id) || 0;
  return Math.round(g);
}
// v 2 로 바꿈: 번 귤 어림과 '옛 레벨에 닿는 귤' 가운데 큰 쪽 (고른 증강은 그대로). 바꿨으면 true
export function migrateLv(save) {
  const L = save.lv; if (!isObj(L) || L.v === LEVEL.v) return false;
  const lv0 = oldLevel(Number.isFinite(+L.xp) ? +L.xp : 0);
  L.xp = Math.min(xpAt(LEVEL.max), Math.max(earnedGuess(save), xpAt(lv0)));
  L.v = LEVEL.v; delete L.old;
  return true;
}

// 저장 고치기: 없거나 깨진 칸을 바로잡음 (예전 저장도)
export function lvSave(save) {
  let L = save.lv;
  if (!isObj(L)) L = save.lv = { xp: 0, aug: {}, draw: null, rr: 0, v: LEVEL.v };
  L.xp = Number.isFinite(+L.xp) ? Math.max(0, Math.min(xpAt(LEVEL.max), +L.xp)) : 0;
  if (!isObj(L.aug)) L.aug = {};
  for (const [k, n] of Object.entries(L.aug)) { if (!AUG_BY[k]) delete L.aug[k]; else L.aug[k] = Math.max(0, Math.min(AUGMENTS.max, Math.floor(+n) || 0)); }
  if (!Array.isArray(L.draw) || L.draw.length !== 3 || !L.draw.every((id) => AUG_BY[id])) L.draw = null;
  L.rr = L.rr ? 1 : 0;
  return L;
}
// 고른 증강이 (레벨 - 1) 보다 많으면 뒤에서부터 덜어 냄 (깨진·고친 저장, 서버 checkLv 와 같은 규칙)
export function trimAug(save) {
  const L = save.lv; if (!L?.aug) return false;
  let room = Math.max(0, levelOf(L.xp).lv - 1), cut = false;
  for (const k of Object.keys(L.aug)) { const take = Math.min(L.aug[k], room); if (take < L.aug[k]) cut = true; if (take > 0) L.aug[k] = take; else delete L.aug[k]; room -= take; }
  return cut;
}
export const lvNow = (save) => levelOf(save.lv?.xp || 0).lv;
export const augCount = (save) => Object.values(save.lv?.aug || {}).reduce((s, n) => s + (n | 0), 0);
export const pendingPicks = (save) => Math.max(0, lvNow(save) - 1 - augCount(save));
// 겹친 수, 효과 값 (겹친 수 × v). 능력치 자리는 이 값을 장비 값에 더함
export const augN = (save, id) => Math.max(0, Math.min(AUGMENTS.max, (save?.lv?.aug?.[id] | 0)));
export const augV = (save, id) => augN(save, id) * (AUG_BY[id]?.v || 0);

// 3개 뽑기: 세 갈래(청소·전투·생존)에서 하나씩. 다 채운(max) 것은 빼고, 갈래가 비면 다른 갈래에서 채움
export function rollDraw(save, rnd = Math.random, not = []) {
  const free = AUGMENTS.list.filter((a) => augN(save, a.id) < AUGMENTS.max);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const out = [];
  const avoid = (a) => !out.includes(a.id) && !not.includes(a.id);
  for (const b of AUGMENTS.branches) { const c = free.filter((a) => a.br === b.id && avoid(a)); if (c.length) out.push(pick(c).id); }
  while (out.length < 3) { let c = free.filter(avoid); if (!c.length) c = free.filter((a) => !out.includes(a.id)); if (!c.length) break; out.push(pick(c).id); }
  return out.length ? out : null;
}
export const augText = (a, n = 1) => a.text.replace('{v}', String(a.text.includes('{v}%') ? Math.round(a.v * n * 1000) / 10 : Math.round(a.v * n * 100) / 100)); // n 번 겹친 값

// 서버 확인 (validate.js): 레벨 0~max, 증강은 아는 것만·종류마다 max 이하·모두 합쳐 (레벨 - 1) 이하. 넘치면 귤 벌이에 닿는 것부터가 아니라 뒤에서부터 덜어 냄
export function checkLv(s) {
  if (!('lv' in s)) return false;
  const L = s.lv; let bad = false;
  if (!isObj(L)) { s.lv = { xp: 0, aug: {}, draw: null, rr: 0, v: LEVEL.v }; return true; }
  migrateLv(s);
  const xp = Number.isFinite(+L.xp) ? Math.max(0, Math.min(xpAt(LEVEL.max), +L.xp)) : 0; if (xp !== L.xp) bad = true; L.xp = xp;
  const aug = {}; let sum = 0; const lv = levelOf(xp).lv, room = Math.max(0, lv - 1);
  if (isObj(L.aug)) for (const [k, v] of Object.entries(L.aug)) {
    const n = Math.floor(+v);
    if (!AUG_BY[k] || !Number.isFinite(n) || n < 0 || n > AUGMENTS.max) { bad = true; continue; }
    const take = Math.min(n, room - sum); if (take < n) bad = true;
    if (take > 0) { aug[k] = take; sum += take; }
  } else if (L.aug != null) bad = true;
  L.aug = aug;
  if (L.draw != null && !(Array.isArray(L.draw) && L.draw.length <= 3 && L.draw.every((id) => AUG_BY[id]))) { L.draw = null; bad = true; }
  L.rr = L.rr ? 1 : 0;
  for (const k of Object.keys(L)) if (!['xp', 'aug', 'draw', 'rr', 'v'].includes(k)) { delete L[k]; bad = true; }
  return bad;
}
