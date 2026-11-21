// 처음 고르는 기본 옷 색 (#155): 기본 모자·반팔·반바지·쓰레빠의 색 번호 → 장비 id(`id~번호`), 색 동그라미 줄
// 색 표는 balance.js LOOK_COLORS. 저장 save.look.colors = { hat, top, bottom, shoes } (없으면 0 = 지금 기본색). gear.js 가 ~번호 장비를 미리 만들어 둠
import { LOOK_COLORS as LC } from './balance.js';
export const LC_SLOTS = ['hat', 'top', 'bottom', 'shoes'];
export const lcIndex = (colors, k) => { const n = Math.floor(Number(colors?.[k])); return n >= 0 && n < LC[k].length ? n : 0; };
export const lcVariant = (k, i) => (i > 0 ? `${LC.ids[k]}~${i}` : LC.ids[k]);
export const lcClean = (colors) => { const o = {}; LC_SLOTS.forEach((k) => { o[k] = lcIndex(colors, k); }); return o; };
// 장비 묶음에서 기본 옷을 고른 색 id 로 (gear 를 바꿔서 돌려줌)
export function tintGear(gear, colors) {
  if (!gear) return gear;
  LC_SLOTS.forEach((k) => { const g = gear[k]; if (g === LC.ids[k] || (typeof g === 'string' && g.startsWith(LC.ids[k] + '~'))) gear[k] = lcVariant(k, lcIndex(colors, k)); });
  return gear;
}
// 색 동그라미 한 줄 (캐릭터 고르기·내 가방). pick(i) 로 알림
export function colorDots(k, cur, pick) {
  const row = document.createElement('div'); row.className = 'lc-dots'; row.setAttribute('role', 'radiogroup'); row.setAttribute('aria-label', `${LC.names[k]} 색`); row.dataset.k = k;
  LC[k].forEach(([c, name], i) => {
    const b = document.createElement('button'); b.type = 'button'; b.style.background = c; b.dataset.i = i; b.setAttribute('aria-label', `${LC.names[k]} ${name}`); b.title = name;
    b.setAttribute('aria-pressed', String(i === cur)); b.addEventListener('click', () => pick(i)); row.append(b);
  });
  return row;
}
export const markDots = (row, cur) => row.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.i === cur)));
