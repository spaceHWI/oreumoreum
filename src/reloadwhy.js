// 새로고침 한곳 (#287): 게임이 location.reload 하는 곳은 모두 reloadFor(까닭) 로 부른다.
// - auto(사용자가 누르지 않은 새로고침: 다른 기기 기록 'rev'·서버 바로잡기 'fix')는 이 탭에서 CRASH.reloadGap 안에 두 번 하지 않음 → 되풀이 막음
// - 까닭은 탭 세션(sessionStorage)에 남기고(검사·어드민용 reloads()), 날짜별로 세어 두었다가 다음에 열 때 하루 한 번 'reload: 까닭×수' 를 오류 알림으로 (takeReloadNote)
// 새로고침하는 곳 표는 notes/history.md #287
import { CRASH } from './balance.js';

const SK = 'oreumoreum.reloads', LK = 'oreumoreum.reloadlog';
const get = (st, k) => { try { return JSON.parse(st.getItem(k) || 'null'); } catch (e) { return null; } };
const put = (st, k, v) => { try { st.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 불가 */ } };
const S = () => { try { return sessionStorage; } catch (e) { return null; } };
const L = () => { try { return localStorage; } catch (e) { return null; } };
const day = () => new Date().toISOString().slice(0, 10);

export const reloads = () => { const st = S(); const a = st && get(st, SK); return Array.isArray(a) ? a : []; };
export function canAuto(now = Date.now()) { return !reloads().some((r) => r.auto && now - r.at < CRASH.reloadGap); }

function note(why, auto) {
  const st = S(), a = reloads(); a.push({ why, at: Date.now(), auto: auto ? 1 : 0 }); if (a.length > 20) a.shift(); if (st) put(st, SK, a);
  const ls = L(); if (!ls) return;
  let g = get(ls, LK); if (!g || typeof g !== 'object' || !g.n) g = { day: day(), n: {}, auto: 0 };
  g.n[why] = (g.n[why] | 0) + 1; if (auto) g.auto = (g.auto | 0) + 1; put(ls, LK, g);
}
// why: 'rev'·'fix'·'newver'·'login'·'logout'·'map'… auto: 사용자가 누르지 않음. 막히면 false (새로고침 안 함)
export function reloadFor(why, { auto = false, url = '' } = {}) {
  if (auto && !canAuto()) return false;
  note(String(why || '?').slice(0, 20), auto);
  if (url) location.href = url; else location.reload();
  return true;
}
// 알릴 묶음: 날짜가 바뀌었으면 지난 묶음(조건이 맞을 때)을 돌려주고 새로. 같은 날이면 그날 한 번만
export function takeReloadNote() {
  const ls = L(); if (!ls) return '';
  const g = get(ls, LK); if (!g || !g.n) return '';
  const tot = Object.values(g.n).reduce((a, b) => a + (b | 0), 0), today = g.day === day();
  if (today && g.sent) return '';
  const want = (g.auto | 0) > 0 || tot > CRASH.reloadRep;
  if (!today) put(ls, LK, { day: day(), n: {}, auto: 0 });
  else if (want) put(ls, LK, { day: g.day, n: {}, auto: 0, sent: 1 });
  if (!want || !tot) return '';
  return 'reload: ' + Object.entries(g.n).map(([k, v]) => `${k}×${v}`).join(' ') + ` (${g.day})`;
}
