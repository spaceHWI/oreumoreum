// UI 를 누르면 무엇인지 알려 주는 토스트 (#60). 눌러서 창이 열리거나 동작하는 UI 는 대상이 아님
// 문구는 아래 표 한 곳에 모은다. 각 줄: [눌린 곳 선택자, () => '이름 + 지금 값' 한 줄]
export const TIP_SEC = 1.8;
export function initUiTips({ $, toast, get }) {
  const TABLE = [
    ['#bag-pill', () => `${get.bagName()} ${$('bag-n').textContent}/${$('bag-cap').textContent}`],
    ['#clean-pill', () => `오름 깨끗한 정도 ${$('clean-n').textContent}%`],
    ['#zone-pill', () => `${$('zone-n').textContent}구역 깨끗한 정도 ${$('zone-pill').dataset.c || 0}%`],
    ['#buff-pill', () => { const b = $('buff-pill'); return `${b.title || '식사 버프'} · ${b.querySelector('b').textContent} 남음`; }],
    ['#hp-bar', () => `HP ${Math.ceil(get.hp())}/${Math.round(get.hpMax())}`],
    ['#xy-pill', () => { const xy = `${$('xy-x').textContent}, ${$('xy-z').textContent}`; // 좁은 화면에선 구역과 합쳐짐 (#75)
      if ($('topbar').dataset.fit !== '0' && $('xy-pill').classList.contains('inzone')) return `${$('zone-n').textContent}구역 깨끗한 정도 ${$('zone-pill').dataset.c || 0}% · 좌표 ${xy}`;
      return `좌표 ${xy} · 귤색 화살표가 북쪽`; }],
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
