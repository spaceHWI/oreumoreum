// UI 를 누르면 무엇인지 알려 주는 토스트 (#60). 눌러서 창이 열리거나 동작하는 UI 는 대상이 아님
// 문구는 아래 표 한 곳에 모은다. 각 줄: [눌린 곳 선택자, () => '이름 + 지금 값' 한 줄]
export const TIP_SEC = 1.8;
export function initUiTips({ $, toast, get }) {
  // 구역 권장 장비 점수 (#137): 빨강 낮음 · 노랑 맞음 · 초록 넘음
  const TONE = { r: '버거워요', y: '알맞아요', g: '넉넉해요' };
  const recText = () => { const z = $('zone-pill'), rec = +z.dataset.rec; return rec ? ` · 권장 점수 ${rec} ${TONE[z.dataset.tone] || ''}` : ''; };
  const TABLE = [
    ['#bag-pill', () => `${get.bagName()} ${$('bag-n').textContent}/${$('bag-cap').textContent}`],
    ['#clean-pill', () => `오름 깨끗한 정도 ${$('clean-n').textContent}%`],
    ['#score-pill', () => { const g = get.score(); return `장비 점수 ${g.total} · 줍는 힘 ${g.pick} · 싸우는 힘 ${g.fight}`; }], // #137
    ['#zone-pill', () => `${$('zone-n').textContent}구역 깨끗한 정도 ${$('zone-pill').dataset.c || 0}%${recText()}`],
    ['#buff-pill', () => { const b = $('buff-pill'); return `${b.title || '식사 버프'} · ${b.querySelector('b').textContent} 남음`; }],
    ['#hp-bar', () => `HP ${Math.ceil(get.hp())}/${Math.round(get.hpMax())}`],
    ['#xy-pill', () => { const xy = `${$('xy-x').textContent}, ${$('xy-z').textContent}`; // 좁은 화면에선 구역과 합쳐짐 (#75)
      if ($('topbar').dataset.fit !== '0' && $('xy-pill').classList.contains('inzone')) return `${$('zone-n').textContent}구역 깨끗한 정도 ${$('zone-pill').dataset.c || 0}%${recText()} · 좌표 ${xy}`;
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
