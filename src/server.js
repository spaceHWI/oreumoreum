// 서버 고르기 (#35): 깨끗한 오름(clean, 적 없음) / 전투 오름(battle, 적·HP·무기)
// 지금은 싱글이라 서버는 모드 값(save.server). 코드에서는 isBattle() 하나로 묻는다.
// 멀티가 붙으면 roomFor() 로 방 이름을 서버별로 나눈다
// 귤·장비·옷·업적은 같이 쓰고, 쓰레기 주운 기록만 서버별 (trash.js createLocalTrashStore 의 srv 칸)
export const SERVERS = ['clean', 'battle'];
let cur = 'clean';
export const serverId = () => cur;
export const isBattle = () => cur === 'battle';
export const validServer = (id) => SERVERS.includes(id);
export function setServerId(id) { if (validServer(id)) cur = id; return cur; }
// 깨끗한 오름은 예전 방 이름 그대로
export const roomFor = (base) => (cur === 'battle' ? base + '-battle' : base);

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

// 시작 화면·메뉴의 그림 카드 (글자 없음, 임시 SVG)
const SKY = '<defs><linearGradient id="sv-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fc8e8"/><stop offset="1" stop-color="#dff0e6"/></linearGradient></defs><rect width="160" height="110" fill="url(#sv-sky)"/>';
const HILL = '<path d="M-4 112 C28 106 40 52 70 46 C82 44 88 54 96 54 C104 54 110 44 120 46 C146 52 150 100 168 112 Z" fill="#5f9440"/><path d="M-4 112 C40 96 70 92 168 104 L168 112 Z" fill="#4a7a32"/><path d="M70 110 C78 92 88 80 96 66" fill="none" stroke="#c99a5e" stroke-width="3" stroke-dasharray="5 4" stroke-linecap="round"/>';
const TANG = (x, y, r = 6) => `<g transform="translate(${x} ${y})"><circle r="${r}" fill="#ff8a1f" stroke="#c45f08" stroke-width="1.2"/><path d="M0 ${-r} q3 -4 7 -3 q-3 4 -7 3" fill="#4e8f2e"/></g>`;
export const SERVER_ART = {
  clean: `<svg viewBox="0 0 160 110" aria-hidden="true">${SKY}<circle cx="128" cy="24" r="11" fill="#ffd36b"/><g fill="#fff" opacity=".9"><ellipse cx="40" cy="24" rx="16" ry="6"/><ellipse cx="52" cy="20" rx="10" ry="6"/></g>${HILL}<g><circle cx="30" cy="96" r="2.6" fill="#ffe27a"/><circle cx="40" cy="100" r="2.2" fill="#fff"/><circle cx="124" cy="98" r="2.6" fill="#f5a3c0"/><circle cx="134" cy="94" r="2.2" fill="#ffe27a"/></g><g transform="translate(112 62)"><rect x="-1.5" y="0" width="3" height="10" fill="#6b4a2a"/><circle cy="-2" r="7" fill="#3f7a2c"/></g><g transform="translate(58 74)"><path d="M0 -10 l3 4 -6 0 z" fill="none"/><circle r="2.6" fill="#26262b"/><rect x="-2.6" y="2" width="5.2" height="7" rx="2" fill="#e8d9b5"/></g></svg>`,
  battle: `<svg viewBox="0 0 160 110" aria-hidden="true">${SKY}<circle cx="128" cy="24" r="11" fill="#ffb347"/>${HILL}<g transform="translate(96 82)"><ellipse cx="0" cy="0" rx="22" ry="12" fill="#5a4636"/><path d="M-20 -4 q-10 2 -12 10 q8 2 14 -2" fill="#4a3a2c"/><circle cx="-26" cy="3" r="2" fill="#2a1e16"/><path d="M-29 7 q-5 1 -6 -3" stroke="#f3ead6" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M-12 -12 l3 -5 3 5" fill="#4a3a2c"/><path d="M-6 -11 q10 -6 22 -1" stroke="#3a2c22" stroke-width="2" fill="none"/><rect x="-14" y="9" width="4" height="7" fill="#3a2c22"/><rect x="8" y="9" width="4" height="7" fill="#3a2c22"/><path d="M21 -2 q5 -2 4 -7" stroke="#3a2c22" stroke-width="1.6" fill="none"/></g><g stroke="#fff" stroke-width="1.6" stroke-dasharray="2 3" fill="none" opacity=".85"><path d="M20 96 Q40 40 66 58"/><path d="M26 98 Q56 30 82 50"/><path d="M18 92 Q30 60 50 70"/></g>${TANG(66, 58)}${TANG(84, 49, 5)}${TANG(50, 70, 5)}${TANG(112, 40, 4)}<g fill="#fff" opacity=".9"><path d="M120 62 l3 -6 1 6 5 -3 -3 6 6 1 -6 2 3 5 -5 -3 -1 6 -2 -6 -5 3 3 -5 -6 -2 6 -1 -3 -5 z" transform="translate(-14 4) scale(.7)"/></g></svg>`,
};
export const SERVER_LABEL = { clean: '깨끗한 오름 (적 없음)', battle: '전투 오름 (멧돼지·귤)' };
