// WebGL 잃음 기억 (#304): 폰이 GPU 문맥을 빼앗는 일(#161)을 이 기기에 기억해 다음 시작을 가볍게 한다
// - 화면이 보이는 동안 잃으면: 다음 시작부터 안티에일리어싱 끔(aaOff). 짧은 시간(CRASH.gl.twiceS)에 두 번 잃으면 한 칸 더 낮춤(drop)
// - 잃고 CRASH.glWait 안에 돌아오지 않으면 한 칸 낮춰(drop+1) 한 번만 스스로 다시 불러옴(scene.js). 탭 세션에 한 번, 되풀이는 reloadwhy.js 의 간격도 막음
// - 기억은 CRASH.gl.keepDays 동안 잃지 않으면 지움. 다시 불러온 까닭은 다음 시작에 오류 알림 한 줄로(takeGlNote)
// quality.js 가 다른 모듈보다 먼저 읽어서 저장소를 직접 읽는다
import { CRASH } from './balance.js';

const K = 'oreumoreum.gl', SK = 'oreumoreum.glre';
const L = () => { try { return localStorage; } catch (e) { return null; } };
const S = () => { try { return sessionStorage; } catch (e) { return null; } };
const fresh = () => ({ drop: 0, aaOff: 0, lost: [], at: 0 });
function read() {
  const ls = L(); if (!ls) return fresh();
  let g; try { g = JSON.parse(ls.getItem(K) || 'null'); } catch (e) { g = null; }
  if (!g || typeof g !== 'object') return fresh();
  if (Date.now() - (+g.at || 0) > CRASH.gl.keepDays * 864e5) return fresh();
  return { drop: Math.max(0, Math.min(CRASH.gl.maxDrop, g.drop | 0)), aaOff: g.aaOff ? 1 : 0, lost: Array.isArray(g.lost) ? g.lost.filter((t) => typeof t === 'number').slice(-4) : [], at: +g.at || 0, note: typeof g.note === 'string' ? g.note : '' };
}
function write(g) { const ls = L(); if (!ls) return; try { ls.setItem(K, JSON.stringify(g)); } catch (e) { /* 저장 불가 */ } }

const boot = read();
export const GL_START = { drop: boot.drop, aaOff: boot.aaOff }; // 이번 시작에 쓴 값 (렌더러를 만들 때 정해짐)
export const glInfo = { lost: 0, restored: 0, lastLostUp: 0 }; // 이번 실행

// 잃음 하나 기록. hidden: 화면이 숨은 동안(백그라운드)이면 낮추지 않음
export function noteGlLost(hidden) {
  glInfo.lost++; glInfo.lastLostUp = Math.round(performance.now() / 1000);
  if (hidden) return;
  const g = read(), now = Date.now();
  g.aaOff = 1; g.lost.push(now); g.lost = g.lost.slice(-4); g.at = now;
  const n = g.lost.filter((t) => now - t < CRASH.gl.twiceS * 1000).length;
  if (n >= 2) { g.drop = Math.min(CRASH.gl.maxDrop, g.drop + 1); g.lost = [now]; } /* 짧은 사이에 두 번: 한 칸 더 */
  write(g);
}
export function noteGlRestored() { glInfo.restored++; }
// 돌아오지 않음 → 한 칸 낮추고 다시 불러올 수 있는지. 탭 세션에 CRASH.gl.reloadOnceS 안 한 번만
export function glAutoReload(note) {
  const g = read(); g.drop = Math.min(CRASH.gl.maxDrop, g.drop + 1); g.aaOff = 1; g.at = Date.now(); g.note = String(note || '').slice(0, 160); write(g);
  const st = S(); let last = 0; try { last = +(st && st.getItem(SK)) || 0; } catch (e) { /* 없음 */ }
  if (Date.now() - last < CRASH.gl.reloadOnceS * 1000) return false;
  try { st && st.setItem(SK, String(Date.now())); } catch (e) { /* 저장 불가 */ }
  return true;
}
// 지난번 스스로 다시 불러온 까닭 (한 번만)
export function takeGlNote() { const g = read(); if (!g.note) return ''; const s = g.note; g.note = ''; write(g); return s; }
// 오류 알림에 붙일 짧은 글: 켠 지 몇 초·품질 단계·안티에일리어싱·이번 실행 잃음/되살아남·기기 낮춤
export function glCtx(level, aa) {
  return `켠${Math.round(performance.now() / 1000)}s q${level}${aa ? '' : ' aa0'}${glInfo.lost ? ` gl잃음${glInfo.lost}/되살${glInfo.restored}` : ''}${GL_START.drop ? ' 낮춤' + GL_START.drop : ''}`;
}
