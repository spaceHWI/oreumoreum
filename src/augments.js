// 레벨과 증강 (#159): 저장(save)만 읽고 쓰는 순수 함수. 게임(game/level.js·여러 능력치 자리)·서버(validate.js)·tools/econ.js 가 같이 씀
// 저장 save.lv = { xp 누적 경험치, aug { 증강 id: 겹친 수 }, draw [지금 보여 줄 3개 id] | null, rr 이번 뽑기에서 다시 뽑기를 썼는지, old 옛 저장을 한 번 셌는지 }
// 레벨은 xp 로 늘 다시 셈 (저장에 따로 두지 않음). 고를 증강 수 = 레벨 - 1 - 고른 수
import { LEVEL, AUGMENTS, ENEMIES } from './balance.js';

export const AUG_BY = Object.fromEntries(AUGMENTS.list.map((a) => [a.id, a]));
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

// 레벨 L 에서 L+1 까지 드는 경험치
export const needXp = (L) => Math.round(LEVEL.base * L ** LEVEL.pow * (LEVEL.late && L >= LEVEL.late.from ? LEVEL.late.k : 1));
// 누적 경험치 → { lv, into 이번 레벨에서 모은 것, need 이번 레벨에 드는 것, k 0~1 }
export function levelOf(xp) {
  let lv = 1, left = Math.max(0, xp || 0);
  while (lv < LEVEL.max && left >= needXp(lv)) { left -= needXp(lv); lv++; }
  const need = lv < LEVEL.max ? needXp(lv) : 0;
  return { lv, into: Math.floor(left), need, k: need ? left / need : 1 };
}
// 레벨 L 에 닿는 누적 경험치
export const xpAt = (L) => { let s = 0; for (let i = 1; i < Math.min(L, LEVEL.max); i++) s += needXp(i); return s; };

// 저장 고치기: 없거나 깨진 칸을 바로잡음 (예전 저장도)
export function lvSave(save) {
  let L = save.lv;
  if (!isObj(L)) L = save.lv = { xp: 0, aug: {}, draw: null, rr: 0 };
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

// 경험치 값 (LEVEL.xp)
export const enemyXp = (def) => Math.max(LEVEL.xp.enemyMin, Math.round((def?.reward?.gyul || 0) * LEVEL.xp.enemyK));
// 옛 저장 (#159 앞): 지금까지 한 일(업적 평생 기록 A.life·치운 양)로 경험치를 한 번 셈
export function oldXp(save) {
  const L = save.ach?.life || {}, X = LEVEL.xp, n = (k) => Math.max(0, +L[k] || 0);
  let xp = Math.max(n('trash'), save.trash?.total || 0) * X.trash + n('heap-clear') * X.heap + n('boss-repel') * X.boss + n('dumper-repel') * X.dumper;
  let known = 0;
  for (const [k, def] of Object.entries(ENEMIES)) { const c = n('enemy-repel-' + k); known += c; xp += c * enemyXp(def); }
  xp += Math.max(0, n('enemy-repel') - known) * enemyXp(ENEMIES.piglet);
  return Math.round(xp);
}

// 서버 확인 (validate.js): 레벨 0~max, 증강은 아는 것만·종류마다 max 이하·모두 합쳐 (레벨 - 1) 이하. 넘치면 귤 벌이에 닿는 것부터가 아니라 뒤에서부터 덜어 냄
export function checkLv(s) {
  if (!('lv' in s)) return false;
  const L = s.lv; let bad = false;
  if (!isObj(L)) { s.lv = { xp: 0, aug: {}, draw: null, rr: 0 }; return true; }
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
  for (const k of Object.keys(L)) if (!['xp', 'aug', 'draw', 'rr', 'old'].includes(k)) { delete L[k]; bad = true; }
  return bad;
}
