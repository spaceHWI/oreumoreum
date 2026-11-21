// 아이콘 글자 라벨 (#184): 아이콘만으로 뜻이 부족한 자리(위쪽 칸·아래 두 버튼·메뉴·동작)에 2~4글자
// 처음 ICON_LABEL.days 일 동안은 늘 보이고, 그 뒤엔 튜토리얼을 마치고 ICON_LABEL.taps 번 넘게 눌렀으면 사라짐 (body.newbie)
// 폰에서 아래 두 버튼(줍기·상호작용)·메뉴·동작 버튼은 원래 글자를 감추는데, 이 기간에만 보임 (page.html CSS)
import { ICON_LABEL } from '../balance.js';
import { $, save, persist } from './save.js';
import { warmThumbs } from './thumbs.js';

// 위쪽 칸: 칸 아래 작은 글자
const TOP = { 'gyul-pill': '귤', 'lv-pill': '레벨', 'score-pill': '장비', 'bag-pill': '배낭', 'clean-pill': '깨끗함', 'hp-bar': '체력', 'buff-pill': '식사', 'zone-pill': '구역', 'ach-chip': '업적', 'fs-chip': '전체 화면' };
for (const [id, t] of Object.entries(TOP)) { const el = $(id); if (el && !el.querySelector(':scope > .lb')) el.insertAdjacentHTML('beforeend', `<span class="lb" aria-hidden="true">${t}</span>`); }

const L = save.lbl && typeof save.lbl === 'object' ? save.lbl : (save.lbl = { t0: Date.now(), n: 0 });
if (!(L.t0 > 0)) L.t0 = Date.now(); if (!(L.n >= 0)) L.n = 0;
const newbie = () => Date.now() - L.t0 < ICON_LABEL.days * 864e5 || L.n < ICON_LABEL.taps;
const apply = () => document.body.classList.toggle('newbie', newbie());
apply();
// 라벨이 붙은 것을 누른 수 (튜토리얼 뒤만)
const TAPPED = [...Object.keys(TOP), 'btn-ctx', 'btn-pick', 'btn-menu', 'btn-actions', 'btn-ach', 'btn-chat'];
let dirty = 0;
for (const id of TAPPED) $(id)?.addEventListener('pointerdown', () => {
  if (!save.tut?.done || L.n >= ICON_LABEL.taps) return;
  L.n++; if (++dirty >= 5 || L.n >= ICON_LABEL.taps) { dirty = 0; persist(); apply(); }
});
setInterval(apply, 600000); // 3일이 지나는 순간 (켜 둔 채로)

warmThumbs(); // 물건 그림 미리 찍기 (thumbs.js)
