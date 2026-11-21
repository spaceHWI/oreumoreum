// 뱃지 아이콘 (48x48 SVG, 원 배경 위에 얹음). #184: 가운데 그림은 아이콘 세트(icons.js)로, 단계 숫자는 오른쪽 아래 작은 원
// 그림(PNG)으로 바꾸려면 src/iconart.js 에 뱃지 id('b-first' 등) 또는 그림 id 로 주소를 넣는다
import { ICONS } from './icons.js';
import { ICON_ART } from './iconart.js';
const W = '#fbf6e6', K = '#33402a';
const glyph = (key, id) => {
  const art = ICON_ART[key] || ICON_ART[id];
  if (art) return `<image href="${art}" x="5" y="5" width="38" height="38"/>`;
  return `<g transform="translate(9.5 9.5) scale(1.208)" style="color:${W}" fill="none" stroke="${W}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[id] || ''}</g>`;
};
const num = (t) => `<circle cx="37.5" cy="37.5" r="8.5" fill="${W}"/><text x="37.5" y="41" text-anchor="middle" font-size="${t.length > 1 ? 9.5 : 11}" font-weight="800" font-family="system-ui,sans-serif" fill="${K}">${t}</text>`;
// 뱃지 id → [그림 id, 숫자]
const B = {
  'b-arm-bow': ['bow'], 'b-arm-gun': ['gun'], 'b-arm-mg': ['mg'], 'b-arm-laser': ['laser'], 'b-arm-bomb': ['bomb'], // 무기 첫 구매 (#123)
  'b-first': ['walk'], 'b-10k': ['shoe'], 'b-50k': ['mountain'], 'b-sunrise': ['sunrise'], 'b-sunset': ['sunset'],
  'b-deer-friend': ['deer'], 'b-stones': ['cairn'], 'b-boar': ['boar'], 'b-photo': ['photo'],
  'b-streak-3': ['calendar', '3'], 'b-streak-7': ['calendar', '7'], 'b-streak-30': ['calendar', '30'],
  trash: ['trash'], recycle: ['recycle'], heap: ['heap'], dex: ['dex'], // 단계 있는 뱃지 (fam)
  'b-kind-can': ['can'], 'b-kind-pet': ['bottle'], 'b-kind-vinyl': ['vinyl'], 'b-kind-foam': ['foam'], 'b-kind-gear': ['fish'],
  'b-gear-one': ['gear'], 'b-rank-10': ['rank', '10'], 'b-rank-1': ['rank', '1'], 'b-gear-all': ['score'],
  'b-nosmoke': ['smoke-no'], // #156
  // #165 칭호가 열리는 업적
  'b-earn-10k': ['coins'], 'b-stare': ['eye'], 'b-unpaid': ['unpaid'], 'b-alien-cs': ['alien'], 'b-crow': ['crow'], 'b-hare-five': ['hareubang'],
  'b-dumper': ['trash-x'], 'b-guard-1': ['trees'], 'b-notes': ['notes'], 'b-ending': ['planet'],
};
export const BADGE_GLYPH = Object.fromEntries(Object.entries(B).map(([k, [id]]) => [k, id]));
export const BADGE_ICONS = Object.fromEntries(Object.entries(B).map(([k, [id, n]]) => [k, glyph(k, id) + (n ? num(n) : '')]));
export const DAILY_ICON = glyph('daily', 'gyul');
export const ALLDAY_ICON = glyph('allday', 'star');
export const iconSvg = (inner) => `<svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">${inner}</svg>`;
