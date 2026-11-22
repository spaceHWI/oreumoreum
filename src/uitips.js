// UI 를 누르면 무엇인지 알려 주는 토스트 (#60). 눌러서 창이 열리거나 동작하는 UI 는 대상이 아님
// 문구는 아래 표 한 곳에 모은다. 각 줄: [눌린 곳 선택자, () => '이름 + 지금 값' 한 줄]
import { IN_FRAME } from './mview.js';
export const TIP_SEC = 1.8;
export const LONG_MS = 500; // 길게 누르기 (#196)
export function initUiTips({ $, toast, get }) {
  const TABLE = [
    ['#bag-pill', () => ''], // #166 누르면 내 가방이 열림: 토스트 없음
    ['#zone-pill', () => ''], // #136 누르면 오름 지도(area.js)가 열림: 토스트 없음
    ['#buff-pill', () => { const b = $('buff-pill'); return `${b.title || '식사 버프'} · ${b.querySelector('b').textContent} 남음`; }],
    ['#hp-bar', () => `HP ${Math.ceil(get.hp())}/${Math.round(get.hpMax())}`],
    ['#xy-pill', () => { // 지금 있는 곳 이름 (#153). 좁은 화면에서 구역과 합쳐지면 누르면 오름 지도(area.js)가 열림
      if ($('topbar').dataset.fit !== '0' && $('xy-pill').classList.contains('inzone')) return '';
      const c = $('where-c'); return `지금 있는 곳: ${$('where').textContent}${c && !c.hidden ? ` · 이 구역 깨끗함 ${$('where-cn').textContent}%` : ''} · 귤색 화살표가 북쪽`; }],
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
  // 폰: 글자 라벨이 없는 버튼·칸(#196)을 길게 누르면 이름(title)을 토스트로. 누르고 있으면 계속되는 줍기·던지기(모아 쏘기)·탈것(고르기)·조이스틱은 제외
  const LONG = '.topbar .tpill, .dock button, #btn-menu, #btn-jump, #btn-speed, #arm-more, #ride-more, #minimap, #ch-arrow';
  let lpT = 0, lpEl = null, lpEat = false;
  const lpStop = () => { clearTimeout(lpT); lpT = 0; lpEl = null; };
  document.addEventListener('pointerdown', (e) => {
    lpStop(); if ((e.pointerType !== 'touch' && !IN_FRAME) || !e.target.closest) return;
    const el = e.target.closest(LONG); if (!el || !el.title) return;
    lpEl = el; const x0 = e.clientX, y0 = e.clientY;
    lpT = setTimeout(() => { if (lpEl !== el) return; lpT = 0; lpEat = true; setTimeout(() => { lpEat = false; }, 700); toast(el.title.replace(/\s*\([A-Z]\)\s*/g, ' ').trim(), TIP_SEC); }, LONG_MS);
    el.addEventListener('pointermove', function mv(m) { if (Math.hypot(m.clientX - x0, m.clientY - y0) > 12) { lpStop(); el.removeEventListener('pointermove', mv); } });
  }, true);
  for (const ev of ['pointerup', 'pointercancel']) document.addEventListener(ev, () => { if (lpT) lpStop(); }, true);
  document.addEventListener('click', (e) => { if (lpEat) { lpEat = false; e.stopPropagation(); e.preventDefault(); } }, true); // 길게 눌러 이름을 봤으면 그 손을 뗄 때 누름은 건너뜀
  document.addEventListener('contextmenu', (e) => { if (e.target.closest?.(LONG)) e.preventDefault(); });
  return { TABLE, LONG };
}
