// UI 를 누르면 무엇인지 알려 주는 토스트 (#60). 눌러서 창이 열리거나 동작하는 UI 는 대상이 아님
// 문구는 아래 표 한 곳에 모은다. 각 줄: [눌린 곳 선택자, () => '이름 + 지금 값' 한 줄]
export const TIP_SEC = 1.8;
export function initUiTips({ $, toast, get }) {
  const num = (n) => Number(n || 0).toLocaleString('ko-KR');
  const TABLE = [
    ['#bag-pill', () => `${get.bagName()} ${$('bag-n').textContent}/${$('bag-cap').textContent}`],
    ['#clean-pill', () => `오름 깨끗한 정도 ${$('clean-n').textContent}%`],
    ['#zone-pill', () => `${$('zone-n').textContent}구역 깨끗한 정도 ${$('zone-c').textContent}%`],
    ['#buff-pill', () => { const b = $('buff-pill'); return `${b.title || '식사 버프'} · ${b.querySelector('b').textContent} 남음`; }],
    ['#hp-bar', () => `HP ${Math.ceil(get.hp())}/${Math.round(get.hpMax())}`],
    ['#wx-pill', () => $('wx-pill').title.replace(/^지금 날씨: /, '날씨 · ')],
    ['#sun-chip', () => $('sun-chip').textContent],
    ['.hud-left .place', () => `${$('place-name').textContent} · ${$('peers').textContent}`],
    ['.hud-right .status-row:first-child', () => `걸음 ${$('steps').textContent}`],
    ['#laps-row', () => `굼부리 둘레 ${num($('laps').textContent)}바퀴`],
    ['#compass', () => '나침반 · 빨간 바늘이 북쪽'],
  ];
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!t.closest) return;
    for (const [sel, fn] of TABLE) {
      const el = t.closest(sel);
      if (!el || el.hidden) continue;
      let msg = ''; try { msg = fn(); } catch { /* 값을 못 읽으면 토스트 없음 */ }
      if (msg) toast(msg, TIP_SEC);
      return;
    }
  });
  return { TABLE };
}
