// 서버 (#35 → #98): 서버는 전투 오름(battle) 하나. 깨끗한 오름(clean)은 #98 에서 없앰
// 예전 저장·방·랭킹의 clean 은 battle 로 바꿔 읽는다 (save.js · trash.js · server/src)
export const SERVERS = ['battle'];
const cur = 'battle';
export const serverId = () => cur;
export const isBattle = () => true; // 도구(tools/*)·개발자 창 호환용
// 멀티 방 이름: 'oreum-<맵>-battle' 하나 (예전 clean 방 'oreum-<맵>' 은 서버가 battle 방으로 보냄)
export const roomFor = (base) => base + '-battle';

// 어느 서버를 얼마나 했는지 (기기 기록, '처음부터 다시' 에도 남도록 저장 키를 따로 씀)
export function createAbStats(key) {
  let d = {};
  try { d = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { d = {}; }
  if (typeof d !== 'object' || Array.isArray(d)) d = {};
  for (const s of SERVERS) {
    const o = d[s] = (d[s] && typeof d[s] === 'object') ? d[s] : {};
    for (const k of ['visits', 'sec', 'picked']) o[k] = Math.max(0, Number(o[k]) || 0);
  }
  if (!Array.isArray(d.log)) d.log = []; // 서버 고른 기록 [{t, s}] 최근 50개
  const write = () => { try { localStorage.setItem(key, JSON.stringify(d)); } catch (e) { /* 저장 불가 환경 */ } };
  let acc = 0;
  return {
    visit() { d[cur].visits++; d.log.push({ t: Date.now(), s: cur }); if (d.log.length > 50) d.log.splice(0, d.log.length - 50); write(); },
    picked(n = 1) { d[cur].picked += n; },
    tick(dt) { if (dt > 0 && dt < 1) { d[cur].sec += dt; acc += dt; if (acc > 10) { acc = 0; write(); } } },
    flush: write,
    get() {
      const out = { now: cur };
      for (const s of SERVERS) out[s] = { visits: d[s].visits, min: Math.round(d[s].sec / 6) / 10, picked: d[s].picked };
      out.log = d.log.slice();
      return out;
    },
  };
}
