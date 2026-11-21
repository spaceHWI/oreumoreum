// 옷 그림 (#52, 상점·옷장). balance.js CLOTHES 의 look 색으로 칠한 작은 그림. viewBox 40
const OL = 'stroke="#17171a" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"';
const P = (d, f, extra = '') => `<path d="${d}" fill="${f}" ${OL} ${extra}/>`;
const C = (cx, cy, r, f, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}" ${OL} ${extra}/>`;
const HAT2 = { // 겉모습 모자 그림 (#179)
  goggle: (m, a) => P('M5 21h30', 'none', `stroke="${m}" stroke-width="3"`) + C(14, 20, 6, a, `stroke-width="2.4"`) + C(26, 20, 6, a, `stroke-width="2.4"`),
  beanie: (m, a) => P('M8 27c0-10 5-16 12-16s12 6 12 16z', m) + P('M7 25h26v5H7z', m, 'opacity=".85"') + P('M20 11V6', 'none', `stroke="${a}" stroke-width="2.4"`) + P('M21 7c3-3 7-3 9-1-2 3-6 3-9 1z', a),
  harubang: (m, a) => P('M10 28V14c0-5 4-8 10-8s10 3 10 8v14z', m) + P('M8 26h24v5H8z', a),
  halfgyul: (m, a) => P('M5 27c0-10 7-17 15-17s15 7 15 17z', m) + P('M5 27h30', 'none', `stroke="${a}" stroke-width="2.6"`) + P('M20 10V6', 'none', 'stroke="#3f9a5a" stroke-width="2.4"') + P('M14 14c2 4 2 9 2 13M26 14c-2 4-2 9-2 13', 'none', `stroke="${a}" stroke-width="1" opacity=".6"`),
  gat: (m, a) => P('M2 26c0-2 8-3 18-3s18 1 18 3-8 2-18 2S2 28 2 26z', m) + P('M14 23V11h12v12z', m) + P('M12 28l-1 7M28 28l1 7', 'none', `stroke="${a}" stroke-width="1.4"`),
  chef: (m, a) => P('M11 30V22h18v8z', a) + P('M11 22c-6 0-7-9-1-10 1-5 7-6 10-3 3-3 9-2 10 3 6 1 5 10-1 10z', m),
  hardhat: (m, a) => P('M7 26c0-10 6-16 13-16s13 6 13 16z', m) + P('M4 26h32v4H4z', m) + P('M20 10v16', 'none', `stroke="${a}" stroke-width="2.4"`),
  lamp: (m, a) => P('M5 22h30', 'none', `stroke="${m}" stroke-width="3.4"`) + P('M15 17h10v10H15z', m) + C(20, 22, 3, a) + P('M20 13V8M27 15l3-3M13 15l-3-3', 'none', `stroke="${a}" stroke-width="2"`),
  antenna: (m, a) => P('M8 32c0-10 5-15 12-15s12 5 12 15', 'none', `stroke="${m}" stroke-width="2.6"`) + P('M15 18c-2-4-4-7-6-10M25 18c2-4 4-7 6-10', 'none', `stroke="${m}" stroke-width="2"`) + C(9, 7, 3.4, a) + C(31, 7, 3.4, a),
  paperbag: (m, a) => P('M8 6h24v28H8z', m) + P('M8 10h24', 'none', 'stroke="#17171a" stroke-width="1" opacity=".5"') + `<circle cx="15" cy="19" r="2.4" fill="${a}"/><circle cx="25" cy="19" r="2.4" fill="${a}"/><path d="M16 27h8" stroke="${a}" stroke-width="1.6"/>`,
  shades: (m, a) => P('M4 17h32', 'none', `stroke="${a}" stroke-width="2"`) + P('M6 16h12l-1 6c-1 3-9 3-10 0z', m) + P('M22 16h12l-1 6c-1 3-9 3-10 0z', m),
};
function hat(L) {
  const m = L.main, a = L.acc;
  if (L.kind === 'cap') return P('M7 25c0-9 6-15 13-15s13 6 13 15z', m) + P('M20 25h15c0 2-2 3.5-4 3.5H20z', a) + `<circle cx="20" cy="10" r="1.6" fill="${a}"/>`;
  if (L.kind === 'box') return P('M7 9h26v24H7z', m) + `<circle cx="15" cy="18" r="2.2" fill="#1c1712"/><circle cx="25" cy="18" r="2.2" fill="#1c1712"/><path d="M13 27h14" stroke="${L.ink || '#6a4a2a'}" stroke-width="1.6"/><circle cx="31" cy="12" r="3.2" fill="${a}" ${OL}/>`; // 감귤 박스 헬멧 (#164)
  if (L.kind === 'santa') return P('M6 28c2-12 8-19 16-20 6 0 9 4 11 9l-6 3c-1-3-3-5-6-5-4 1-7 6-8 13z', m) + P('M5 26h24v5H5z', a) + `<circle cx="32" cy="18" r="3" fill="${a}" ${OL}/>`; // 산타 모자 (#180)
  if (L.kind === 'antler') return P('M8 30c0-11 5-17 12-17s12 6 12 17', 'none', `stroke="${a}" stroke-width="2.6"`) + P('M13 15l-3-8M11 10l-4-1M27 15l3-8M29 10l4-1', 'none', `stroke="${m}" stroke-width="2.6"`); // 루돌프 머리띠
  { const h = HAT2[L.kind]; if (h) return h(m, a, L); } // 겉모습 모자 (#179)
  if (L.kind === 'straw') return P('M3 27c0-3 8-5 17-5s17 2 17 5-8 4-17 4S3 30 3 27z', m) + P('M11 25c0-8 4-13 9-13s9 5 9 13z', m) + P('M11.4 21.5h17.2v3H11.4z', a);
  const wide = L.kind === 'boonie' ? 3 : L.kind === 'flower' ? 4 : 6;
  let s = P(`M${wide} 30l7-6h20l7 6z`, m) + P('M12 24l2-12h12l2 12z', m) + P('M12.6 20.5h14.8v3H12.6z', a);
  if (L.kind === 'flower') s += P(`M${wide} 30h${40 - wide * 2}`, 'none', `stroke="${a}" stroke-width="2.2"`) + ['0,-3', '3,-1', '2,2.5', '-2,2.5', '-3,-1'].map((o) => { const [x, y] = o.split(','); return `<circle cx="${30 + +x}" cy="${16 + +y}" r="2.4" fill="${L.petal || '#fff'}"/>`; }).join('') + `<circle cx="30" cy="16" r="1.5" fill="${a}"/><circle cx="24" cy="27" r="2.6" fill="#ffa330" ${OL}/>`;
  if (L.kind === 'boonie') s += `<circle cx="14" cy="16" r="1.4" fill="${a}"/><circle cx="26" cy="16" r="1.4" fill="${a}"/>`;
  return s;
}
function top(L) {
  const m = L.main, a = L.acc;
  if (L.kind === 'tank') return P('M13 6h4c0 3 1.5 5 3 5s3-2 3-5h4l1 6-2 2v20H14V14l-2-2z', m) + P('M15 6v28M25 6v28', 'none', `stroke="${a}" stroke-width="2"`); // 멜빵 러닝 (#179)
  let s = L.long ? P('M13 7l-7 4-3 18h5l3-12v17h18V17l3 12h5l-3-18-7-4c-1 3-4 4-7 4s-6-1-7-4z', m) : P('M13 7l-8 5 3 6 4-2v18h16V16l4 2 3-6-8-5c-1 3-4 4-7 4s-6-1-7-4z', m);
  for (let i = 0; i < (L.stripes || 0); i++) s += `<path d="M12 ${18 + i * 4}h16" stroke="${a}" stroke-width="2"/>`;
  if (L.panel) s += `<path d="M13.5 8.5c2 2 4 2.6 6.5 2.6s4.5-.6 6.5-2.6" fill="none" stroke="${a}" stroke-width="2.4"/>`;
  s += `<path d="M14 7.6c1 2.6 3.4 3.6 6 3.6s5-1 6-3.6" fill="none" stroke="${L.collar || a}" stroke-width="1.8"/>`;
  if (!L.long) s += `<path d="M6 13.5l2.6 4.6M34 13.5l-2.6 4.6" stroke="${a}" stroke-width="1.8"/>`;
  if (L.print) s += `<path d="M14 ${L.heart ? 26 : 19}h12M15.5 ${L.heart ? 30 : 23}h9" stroke="${L.print}" stroke-width="2"/>`; // 글씨 티 (#179)
  if (L.heart) s += P('M20 22c-4-2-6-4-6-6.3 0-2 2.5-3 4-1.6l2 1.6 2-1.6c1.5-1.4 4-.4 4 1.6 0 2.3-2 4.3-6 6.3z', L.heart);
  if (L.num) s += `<circle cx="20" cy="28" r="3" fill="${a}"/>`;
  if (L.flowers) s += [[15, 16], [25, 19], [17, 27], [26, 29]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4" fill="${L.flowers}"/><circle cx="${x}" cy="${y}" r=".9" fill="#f2c94c"/>`).join('');
  if (L.gyul) s += [[16, 15], [24, 15], [20, 24], [15, 28], [25, 28]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="${L.gyul}"/>`).join(''); // 못생긴 스웨터 귤 무늬
  return s;
}
function bottom(L) {
  const m = L.main, a = L.acc;
  if (L.kind === 'mombbe') return P('M10 5h20l3 29h-9l-4-18-4 18H7z', m) + `<path d="M7.4 32h8.4M24.2 32h8.4M10 7h20" stroke="${a}" stroke-width="2"/>` + [[13, 13], [24, 12], [12, 22], [27, 24], [18, 9]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.7" fill="${L.dots}"/>`).join(''); // 몸뻬 (#179)
  if (L.kind === 'shorts') return P('M10 9h20l2 18h-9l-3-9-3 9H8z', m) + (L.check ? `<path d="M10.5 14h19M9.6 19h21M15 9.5v15M25 9.5v15" stroke="${a}" stroke-width="1.4" opacity=".8"/>` : '') + `<path d="M8.6 24h9.2M22.2 24h9.2" stroke="${a}" stroke-width="2"/>` + (L.pockets ? P('M9.5 15h4v5h-4zM26.5 15h4v5h-4z', a) : '');
  let s = P('M11 5h18l2 31h-8l-3-20-3 20H9z', m) + `<path d="M9.4 33h7.8M23 33h7.8" stroke="${a}" stroke-width="2"/>`;
  if (L.belt) s += P('M11 5h18v3H11z', a);
  if (L.rips) s += `<path d="M11.5 20l3 1-2.5 1M25 26l3.5 1-3 1" stroke="${L.rips}" stroke-width="1.6"/>`; // 찢어진 청바지 (#179)
  if (L.bib) s += P('M14 0h12v6H14z', m) + `<path d="M15 0v-2M25 0v-2" stroke="${a}" stroke-width="2"/>`;
  if (L.tight) s += `<path d="M10.5 9l-.5 24M29.5 9l.5 24" stroke="${a}" stroke-width="1.4"/>`;
  if (L.knee) s += `<path d="M10.6 22h5M24.4 22h5" stroke="${a}" stroke-width="2.6"/>`;
  if (L.pockets) s += P('M10.8 12h3.6v5h-3.6zM25.6 12h3.6v5h-3.6z', a);
  return s;
}
function vest(L) {
  const m = L.main, a = L.acc;
  if (L.kind === 'scarf') return P('M9 12c3 3 7 4 11 4s8-1 11-4v5c-3 3-7 4-11 4s-8-1-11-4z', m) + P('M22 19h6l-1 15h-6z', m) + `<path d="M21.3 31.5h5.6" stroke="${a}" stroke-width="2.4"/>`; // 목도리 (#180)
  if (L.kind === 'boxarmor') return P('M7 9h26v24H7z', m) + `<circle cx="15" cy="19" r="4" fill="${a}" ${OL}/><path d="M21 18h8M21 23h6M7 13h26" stroke="${L.ink || '#6a4a2a'}" stroke-width="1.6"/>`; // 귤 상자 갑옷 (#179)
  if (L.kind === 'basket') return P('M8 14h24l-4 20H12z', m) + `<path d="M9.5 20h21M10.6 26h18.8" stroke="#17171a" stroke-width=".9" opacity=".5"/>` + [[14, 12], [20, 10], [26, 12], [17, 8], [23, 8]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" fill="${a}" ${OL}/>`).join(''); // 귤 바구니
  let s = P('M13 6l-5 4v24h11V15zM27 6l5 4v24H21V15z', m);
  if (L.bands) s += `<path d="M8.6 20h10M21.4 20h10M8.6 26h10M21.4 26h10" stroke="${L.leaf ? '#fff4e0' : a}" stroke-width="2"/>`;
  if (L.pockets > 4) s += [10, 25].map((x) => [16, 21, 26, 31].map((y) => P(`M${x} ${y}h5v3.4h-5z`, a)).join('')).join(''); // 주머니 12개 (#179)
  else if (L.pockets) s += P('M10 28h5v4h-5zM25 28h5v4h-5z', a) + (L.pockets >= 3 ? P('M25 14h4v3.5h-4z', a) : '');
  if (L.puff) s += `<path d="M8.6 17h10M21.4 17h10M8.6 24h10M21.4 24h10" stroke="#17171a" stroke-width=".8" opacity=".5"/>`;
  if (L.leaf) s += `<circle cx="13.5" cy="14" r="2.4" fill="#ffb347" ${OL}/>`;
  if (L.studs) s += [12, 18, 24, 30].map((y) => `<circle cx="11" cy="${y}" r="1.2" fill="${a}"/><circle cx="29" cy="${y}" r="1.2" fill="${a}"/>`).join('');
  return s;
}
function jacket(L) {
  const m = L.main, a = L.acc;
  let s = L.hood ? P('M13 8c0-4 3-6 7-6s7 2 7 6', m) : '';
  s += P('M13 7l-7 4-3 18h5l3-12v17h18V17l3 12h5l-3-18-7-4c-1 2-4 3-7 3s-6-1-7-3z', m) + `<path d="M20 10v24" stroke="${a}" stroke-width="2"/>`;
  if (L.hem) s += P('M11 33h18l2 5H9z', m); // 긴 자락 (#179)
  if (L.goreum) s += `<path d="M20 18l4 9M20 18l-1 8" stroke="${a}" stroke-width="2.2"/>`;
  if (L.cuffs) s += `<path d="M3.4 27.5h4.6M32 27.5h4.6" stroke="${a}" stroke-width="2.4"/>`;
  if (L.puff) s += `<path d="M11 19h18M11 25h18" stroke="#17171a" stroke-width=".8" opacity=".5"/>`;
  if (L.bands) s += `<path d="M11 30h18" stroke="#e8ecef" stroke-width="2"/>`;
  return s;
}
function socks(L) {
  const m = L.main, a = L.acc, top = L.h > 0.16 ? 2 : L.h > 0.125 ? 6 : 10;
  if (L.kind === 'oddsocks') return P('M6 8h8v18l4 3c2 1.5 1 4.6-1.2 4.6H8c-1.4 0-2-.8-2-2z', m) + P('M22 12h8v14l4 3c2 1.5 1 4.6-1.2 4.6H24c-1.4 0-2-.8-2-2z', a); // 짝짝이 (#179)
  let s = P(`M14 ${top}h10v${24 - top}l6 4c2.4 1.8 1.4 6-1.6 6H16c-2 0-3-1-3-3V${top}z`, m) + `<path d="M14 ${top + 2}h10" stroke="${a}" stroke-width="3"/>`;
  for (let i = 0; i < (L.stripes || 0); i++) s += `<path d="M14 ${top + 7 + i * 4}h10" stroke="${a}" stroke-width="2"/>`;
  if (L.dots) s += `<circle cx="17" cy="20" r="1.5" fill="${L.dots}"/><circle cx="21" cy="25" r="1.5" fill="${L.dots}"/><circle cx="25" cy="31" r="1.5" fill="${L.dots}"/>`;
  if (L.thick) s += `<path d="M13 ${top + 4}h12" stroke="${a}" stroke-width="1.2"/>`;
  if (L.rainbow) s += ['#e0443a', '#f29a2e', '#f2d03a', '#5cb84a', '#3f78c0'].map((c, i) => `<path d="M14 ${top + 5 + i * 4}h10" stroke="${c}" stroke-width="3"/>`).join(''); // #179
  if (L.toes) s += ['#e0443a', '#f29a2e', '#f2d03a', '#5cb84a', '#3f78c0'].map((c, i) => `<circle cx="${18 + i * 2.6}" cy="${33 - (i % 2)}" r="1.4" fill="${c}"/>`).join('');
  if (L.rim) s += P('M11 28h20l4 4c0 2-2 3-4 3H13c-2 0-3-1-3-3z', a);
  if (L.fur) s += P(`M11 ${top}h16v4H11z`, a);
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
