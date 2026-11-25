// Bar 소설 확인 (#316): 클라이언트가 적은 읽은 수·날짜를 그대로 믿지 않는다 (로직 src/game/bar.js, 수치 balance.js BAR)
// - 모양: save.bar = { d 마지막 읽은 날(KST), n 그날 읽은 수(perDay 까지), t 모두 읽은 수, left '여운' 남은 초(buffSec 까지), read 읽은 편 번호[], p 책갈피 }
// - 값: 새로 읽은 수(t 차이) × 값(지난 저장의 레벨) 을 산 값(spentOf)에 넣음 → 값을 안 내면 귤을 깎음·번 귤·경험치 몫이 바로 잡힘. 못 냈으면 읽지 않은 것으로(revert)
// - 기록: 읽은 편 수는 모두 읽은 수(값을 낸 수)까지만. 모두 읽은 수는 줄지 않고, 날이 바뀌려면 수가 늘어야 하며, 새 날은 서버 날짜 오늘(또는 어제)까지만, 그날 읽은 수 = (같은 날이면 지난 n) + 새로 읽은 수, perDay 까지
// - '여운' 경험치: 마지막 읽은 날이 서버 날짜 오늘·어제이고 '여운' 이 남아 있으면 경험치 상한 × (1 + BAR.buff.xp)
import { BAR } from '../../src/balance.js';
import { BAR_STORIES } from '../../src/bartext.js';
import { levelOf } from '../../src/augments.js';
import { kstDay } from '../../src/rankday.js';
import { dateOfDay } from '../../src/daily.js';

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/, NS = BAR_STORIES.length;
const int = (v, hi) => Math.max(0, Math.min(hi, Math.floor(Number(v)) || 0));
const EMPTY = () => ({ d: '', n: 0, t: 0, left: 0, read: [] });

export function normBar(s) {
  if (s.bar === undefined) return;
  const o = isObj(s.bar) ? s.bar : {};
  const read = Array.isArray(o.read) ? [...new Set(o.read.filter((i) => Number.isInteger(i) && i >= 0 && i < NS))] : [];
  s.bar = { d: typeof o.d === 'string' && DAY_RE.test(o.d) ? o.d : '', n: int(o.n, BAR.perDay), t: int(o.t, 1e6), left: Math.max(0, Math.min(BAR.buffSec, Number(o.left) || 0)), read, ...(o.p ? { p: 1 } : {}) };
}
const barT = (s) => (isObj(s.bar) ? s.bar.t : 0);
// 새로 읽은 수 × 값 (지난 저장의 레벨로 셈)
export function barSpent(P, S) {
  const k = barT(S) - barT(P); if (k <= 0) return 0;
  const lv = levelOf(Number(P.lv?.xp) || 0).lv;
  return Math.round(BAR.price.base + lv * BAR.price.perLv) * k;
}
// 기록 바로잡기 (fixed 에 'bar')
export function barCheck(P, S, t, fixed) {
  if (!isObj(S.bar) && !isObj(P.bar)) return;
  const p = isObj(P.bar) ? P.bar : EMPTY(); if (!isObj(S.bar)) S.bar = { ...p, read: [...p.read] };
  const s = S.bar, day = kstDay(t), ok = new Set([dateOfDay(day), dateOfDay(day - 1)]), k = s.t - p.t;
  const same = s.d === p.d, want = (same ? p.n : 0) + Math.max(0, k);
  const bad = k < 0 || k > BAR.perDay || (!same && (k <= 0 || !ok.has(s.d))) || (k > 0 && s.n !== want) || (k === 0 && s.n !== p.n) || s.n > BAR.perDay;
  if (bad) { S.bar = { ...p, read: [...p.read], left: Math.min(s.left, same || ok.has(p.d) ? BAR.buffSec : 0) }; fixed.push('bar'); return; }
  if (s.read.length > s.t) { s.read = s.read.slice(0, s.t); fixed.push('bar'); } /* 읽은 편은 모두 읽은 수까지만 (값을 낸 뒤 다 읽으면 편이 늘어남: 책갈피) */
}
// 값을 못 냈으면 읽지 않은 것으로 (revertItems)
export function barRevert(P, S) {
  if (barT(S) > barT(P)) { if (isObj(P.bar)) S.bar = { ...P.bar, read: [...P.bar.read] }; else delete S.bar; }
}
// '여운' 경험치 배수
export function barXp(P, S, t) {
  const o = isObj(S.bar) ? S.bar : null; if (!o || !(o.left > 0 || P.bar?.left > 0)) return 1;
  const day = kstDay(t); return o.d === dateOfDay(day) || o.d === dateOfDay(day - 1) ? 1 + BAR.buff.xp : 1;
}
