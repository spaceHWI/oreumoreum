// 옷 그림 (#52, 상점·옷장). balance.js CLOTHES 의 look 색으로 칠한 작은 그림. viewBox 40
const OL = 'stroke="#17171a" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"';
const P = (d, f, extra = '') => `<path d="${d}" fill="${f}" ${OL} ${extra}/>`;
function hat(L) {
  const m = L.main, a = L.acc;
  if (L.kind === 'cap') return P('M7 25c0-9 6-15 13-15s13 6 13 15z', m) + P('M20 25h15c0 2-2 3.5-4 3.5H20z', a) + `<circle cx="20" cy="10" r="1.6" fill="${a}"/>`;
  if (L.kind === 'santa') return P('M6 28c2-12 8-19 16-20 6 0 9 4 11 9l-6 3c-1-3-3-5-6-5-4 1-7 6-8 13z', m) + P('M5 26h24v5H5z', a) + `<circle cx="32" cy="18" r="3" fill="${a}" ${OL}/>`; // 산타 모자 (#180)
  if (L.kind === 'antler') return P('M8 30c0-11 5-17 12-17s12 6 12 17', 'none', `stroke="${a}" stroke-width="2.6"`) + P('M13 15l-3-8M11 10l-4-1M27 15l3-8M29 10l4-1', 'none', `stroke="${m}" stroke-width="2.6"`); // 루돌프 머리띠
  if (L.kind === 'straw') return P('M3 27c0-3 8-5 17-5s17 2 17 5-8 4-17 4S3 30 3 27z', m) + P('M11 25c0-8 4-13 9-13s9 5 9 13z', m) + P('M11.4 21.5h17.2v3H11.4z', a);
  const wide = L.kind === 'boonie' ? 3 : L.kind === 'flower' ? 4 : 6;
  let s = P(`M${wide} 30l7-6h20l7 6z`, m) + P('M12 24l2-12h12l2 12z', m) + P('M12.6 20.5h14.8v3H12.6z', a);
  if (L.kind === 'flower') s += P(`M${wide} 30h${40 - wide * 2}`, 'none', `stroke="${a}" stroke-width="2.2"`) + ['0,-3', '3,-1', '2,2.5', '-2,2.5', '-3,-1'].map((o) => { const [x, y] = o.split(','); return `<circle cx="${30 + +x}" cy="${16 + +y}" r="2.4" fill="${L.petal || '#fff'}"/>`; }).join('') + `<circle cx="30" cy="16" r="1.5" fill="${a}"/><circle cx="24" cy="27" r="2.6" fill="#ffa330" ${OL}/>`;
  if (L.kind === 'boonie') s += `<circle cx="14" cy="16" r="1.4" fill="${a}"/><circle cx="26" cy="16" r="1.4" fill="${a}"/>`;
  return s;
}
function top(L) {
  const m = L.main, a = L.acc;
  let s = L.long ? P('M13 7l-7 4-3 18h5l3-12v17h18V17l3 12h5l-3-18-7-4c-1 3-4 4-7 4s-6-1-7-4z', m) : P('M13 7l-8 5 3 6 4-2v18h16V16l4 2 3-6-8-5c-1 3-4 4-7 4s-6-1-7-4z', m);
  for (let i = 0; i < (L.stripes || 0); i++) s += `<path d="M12 ${18 + i * 4}h16" stroke="${a}" stroke-width="2"/>`;
  if (L.panel) s += `<path d="M13.5 8.5c2 2 4 2.6 6.5 2.6s4.5-.6 6.5-2.6" fill="none" stroke="${a}" stroke-width="2.4"/>`;
  s += `<path d="M14 7.6c1 2.6 3.4 3.6 6 3.6s5-1 6-3.6" fill="none" stroke="${L.collar || a}" stroke-width="1.8"/>`;
  if (!L.long) s += `<path d="M6 13.5l2.6 4.6M34 13.5l-2.6 4.6" stroke="${a}" stroke-width="1.8"/>`;
  if (L.gyul) s += [[16, 15], [24, 15], [20, 24], [15, 28], [25, 28]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="${L.gyul}"/>`).join(''); // 못생긴 스웨터 귤 무늬
  return s;
}
function bottom(L) {
  const m = L.main, a = L.acc;
  if (L.kind === 'shorts') return P('M10 9h20l2 18h-9l-3-9-3 9H8z', m) + `<path d="M8.6 24h9.2M22.2 24h9.2" stroke="${a}" stroke-width="2"/>` + (L.pockets ? P('M9.5 15h4v5h-4zM26.5 15h4v5h-4z', a) : '');
  let s = P('M11 5h18l2 31h-8l-3-20-3 20H9z', m) + `<path d="M9.4 33h7.8M23 33h7.8" stroke="${a}" stroke-width="2"/>`;
  if (L.belt) s += P('M11 5h18v3H11z', a);
  if (L.knee) s += `<path d="M10.6 22h5M24.4 22h5" stroke="${a}" stroke-width="2.6"/>`;
  if (L.pockets) s += P('M10.8 12h3.6v5h-3.6zM25.6 12h3.6v5h-3.6z', a);
  return s;
}
function vest(L) {
  const m = L.main, a = L.acc;
  if (L.kind === 'scarf') return P('M9 12c3 3 7 4 11 4s8-1 11-4v5c-3 3-7 4-11 4s-8-1-11-4z', m) + P('M22 19h6l-1 15h-6z', m) + `<path d="M21.3 31.5h5.6" stroke="${a}" stroke-width="2.4"/>`; // 목도리 (#180)
  let s = P('M13 6l-5 4v24h11V15zM27 6l5 4v24H21V15z', m);
  if (L.bands) s += `<path d="M8.6 20h10M21.4 20h10M8.6 26h10M21.4 26h10" stroke="${L.leaf ? '#fff4e0' : a}" stroke-width="2"/>`;
  if (L.pockets) s += P('M10 28h5v4h-5zM25 28h5v4h-5z', a) + (L.pockets >= 3 ? P('M25 14h4v3.5h-4z', a) : '');
  if (L.puff) s += `<path d="M8.6 17h10M21.4 17h10M8.6 24h10M21.4 24h10" stroke="#17171a" stroke-width=".8" opacity=".5"/>`;
  if (L.leaf) s += `<circle cx="13.5" cy="14" r="2.4" fill="#ffb347" ${OL}/>`;
  return s;
}
function jacket(L) {
  const m = L.main, a = L.acc;
  let s = L.hood ? P('M13 8c0-4 3-6 7-6s7 2 7 6', m) : '';
  s += P('M13 7l-7 4-3 18h5l3-12v17h18V17l3 12h5l-3-18-7-4c-1 2-4 3-7 3s-6-1-7-3z', m) + `<path d="M20 10v24" stroke="${a}" stroke-width="2"/>`;
  if (L.cuffs) s += `<path d="M3.4 27.5h4.6M32 27.5h4.6" stroke="${a}" stroke-width="2.4"/>`;
  if (L.puff) s += `<path d="M11 19h18M11 25h18" stroke="#17171a" stroke-width=".8" opacity=".5"/>`;
  if (L.bands) s += `<path d="M11 30h18" stroke="#e8ecef" stroke-width="2"/>`;
  return s;
}
function socks(L) {
  const m = L.main, a = L.acc, top = L.h > 0.16 ? 2 : L.h > 0.125 ? 6 : 10;
  let s = P(`M14 ${top}h10v${24 - top}l6 4c2.4 1.8 1.4 6-1.6 6H16c-2 0-3-1-3-3V${top}z`, m) + `<path d="M14 ${top + 2}h10" stroke="${a}" stroke-width="3"/>`;
  for (let i = 0; i < (L.stripes || 0); i++) s += `<path d="M14 ${top + 7 + i * 4}h10" stroke="${a}" stroke-width="2"/>`;
  if (L.dots) s += `<circle cx="17" cy="20" r="1.5" fill="${L.dots}"/><circle cx="21" cy="25" r="1.5" fill="${L.dots}"/><circle cx="25" cy="31" r="1.5" fill="${L.dots}"/>`;
  if (L.thick) s += `<path d="M13 ${top + 4}h12" stroke="${a}" stroke-width="1.2"/>`;
  return s;
}
const F = { hat, top, bottom, vest, jacket, socks };
// c: CLOTHES 한 줄 (없으면 '없음' 그림)
export function clothSvg(c, cls = 'art') {
  const inner = c ? F[c.slot]?.(c.look || {}) || '' : '<circle cx="20" cy="20" r="11" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3"/><path d="M13 27l14-14" stroke="currentColor" stroke-width="2"/>';
  return `<svg class="${cls}" viewBox="0 0 40 40" aria-hidden="true">${inner}</svg>`;
}
// 능력치 아이콘(24, 선)과 글
export const WEAR_STAT_ICON = {
  rare: '<path d="M12 3l2 6.5L20.5 12 14 14.5 12 21l-2-6.5L3.5 12 10 9.5z"/>',
  hp: '<path d="M12 20s-7.5-4.6-9-9.4C2 7.3 4 4.5 7 4.5c2 0 3.5 1.2 5 3 1.5-1.8 3-3 5-3 3 0 5 2.8 4 6.1-1.5 4.8-9 9.4-9 9.4z"/>',
  pocket: '<path d="M5 5h14v8a7 7 0 0 1-14 0zM5 9h14"/>',
  gyul: '<circle cx="12" cy="13.5" r="7"/><path d="M12 6.5c0-2 2-3.5 4.5-3.5"/>',
  guard: '<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/>',
  regen: '<path d="M12 20s-7-4.4-8.5-9C2.6 8 4.4 5 7.3 5c2 0 3.4 1.1 4.7 2.8C13.3 6.1 14.7 5 16.7 5c2.9 0 4.7 3 3.8 6-1.5 4.6-8.5 9-8.5 9zM12 10v6M9 13h6"/>',
};
export const wearStatText = (stat, v) => stat === 'pocket' ? `+${v}` : stat === 'gyul' ? `+${Math.round(v * 100)}%` : stat === 'guard' ? (v ? `-${Math.round(v * 100)}%` : '0%') : `×${v}`;
