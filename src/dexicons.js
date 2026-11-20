// 쓰레기 도감 아이콘 (48x48 SVG). 종류별 기본 모양 + 칸마다 색·장식이 달라짐. 드문 것은 따로 그림
const K = '#33402a', W = '#fbf6e6';
const s = (d) => `stroke="${K}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" ${d || ''}`;
const can = (c) => `<rect x="14" y="13" width="20" height="26" rx="4" fill="${c}" ${s()}/><ellipse cx="24" cy="13" rx="10" ry="2.5" fill="#c9ccd2" ${s()}/><path d="M14 22 H34" ${s()}/>`;
const pet = (c) => `<path d="M20 7 h8 v5 l5 5 v22 q0 3 -3 3 H18 q-3 0 -3 -3 V17 l5 -5z" fill="${c}" ${s()}/><rect x="20" y="5" width="8" height="5" rx="1.5" fill="#3a7fd0" ${s()}/><path d="M15 25 H33" ${s()}/>`;
const vinyl = (c) => `<path d="M10 22 q6 -11 14 -7 q10 -4 14 9 q4 10 -6 15 q-10 4 -18 -2 q-8 -6 -4 -15z" fill="${c}" ${s()}/><path d="M17 24 q4 4 11 0" fill="none" ${s()}/>`;
const foam = (c) => `<path d="M8 22 l8 -7 h20 l5 7 v14 q0 3 -3 3 H11 q-3 0 -3 -3z" fill="${c}" ${s()}/><path d="M8 22 H41" ${s()}/><circle cx="17" cy="30" r="1.3" fill="${K}"/><circle cx="26" cy="31" r="1.3" fill="${K}"/><circle cx="34" cy="29" r="1.3" fill="${K}"/>`;
const gear = (c) => `<circle cx="24" cy="26" r="12" fill="none" ${s('stroke-width="6" stroke="' + c + '"')}/><circle cx="24" cy="26" r="12" fill="none" ${s('stroke-dasharray="5 4"')}/><path d="M33 16 l7 -6" ${s()}/>`;
const BASE = { can, pet, vinyl, foam, gear };
// 흔한 것 4개: 기본 모양에 색을 바꾸고 작은 장식
const COL = {
  can: ['#e0b23a', '#d9a02b', '#4f86c6', '#b9bcc4'], pet: ['#d9eef5', '#cfe9d0', '#f2d6a6', '#e9dccb'],
  vinyl: ['#f4f4f0', '#e6a24a', '#e8dcb8', '#cfd4dc'], foam: ['#f7f7f2', '#f2e4c2', '#ecebe4', '#f2efe2'], gear: ['#e2683a', '#3e7fc4', '#8aa08f', '#b5a07a'],
};
const DECO = {
  can: ['', `<path d="M18 28 h12 M18 33 h12" ${s('stroke-width="1.8"')}/>`, `<circle cx="24" cy="30" r="4" fill="#fff" ${s('stroke-width="1.8"')}/>`, `<path d="M16 26 l6 4 -4 6 M30 22 l4 6" fill="none" ${s('stroke-width="1.8"')}/>`],
  pet: ['', `<circle cx="24" cy="32" r="3" fill="#fff" ${s('stroke-width="1.8"')}/>`, `<path d="M17 33 h14" ${s('stroke-width="1.8"')}/>`, `<rect x="16" y="26" width="16" height="7" fill="#8a5a3a" opacity=".6"/>`],
  vinyl: ['', `<circle cx="30" cy="22" r="3" fill="#d8423a" ${s('stroke-width="1.8"')}/>`, `<path d="M16 30 h14" ${s('stroke-width="1.8"')}/>`, `<path d="M12 14 l6 5 M36 14 l-5 5" ${s('stroke-width="1.8"')}/>`],
  foam: ['', `<path d="M16 17 q4 4 8 0" fill="none" ${s('stroke-width="1.8"')}/>`, `<path d="M12 34 h26" ${s('stroke-width="1.8"')}/>`, `<path d="M26 22 l-3 8 4 6" fill="none" ${s('stroke-width="1.8"')}/>`],
  gear: ['', `<circle cx="38" cy="36" r="4" fill="#ffd23f" ${s('stroke-width="1.8"')}/>`, `<path d="M10 40 h28" ${s('stroke-width="1.8"')}/>`, `<path d="M12 36 q6 -4 12 0" fill="none" ${s('stroke-width="1.8"')}/>`],
};
// 드문 것(kind:r0, kind:r1)
const RARE = {
  'can:r0': `<rect x="8" y="17" width="32" height="21" rx="4" fill="#a9643a" ${s()}/><path d="M8 24 H40" ${s()}/><path d="M16 17 q8 -9 16 0" fill="none" ${s()}/><path d="M14 30 l4 3 M30 29 l5 2" ${s('stroke="#6b3b1f" stroke-width="2"')}/>`,
  'can:r1': `<rect x="15" y="14" width="18" height="26" rx="3" fill="#e9eef5" ${s()}/><path d="M15 22 H33 M15 32 H33" ${s()}/><circle cx="24" cy="27" r="2.6" fill="#3c7fc9"/><path d="M19 14 q5 -7 10 0" fill="none" ${s()}/>`,
  'pet:r0': `<path d="M19 8 h10 v6 l4 5 v19 q0 3 -3 3 H18 q-3 0 -3 -3 V19 l4 -5z" fill="#cfe9e4" ${s()}/><rect x="20" y="5" width="8" height="5" rx="2" fill="#c39a4c" ${s()}/><rect x="19" y="24" width="10" height="9" rx="1" fill="${W}" ${s('stroke-width="1.6"')} transform="rotate(-12 24 28)"/><path d="M21 28 h6" ${s('stroke-width="1.4"')}/>`,
  'pet:r1': `<path d="M20 6 h8 v10 l5 6 v17 q0 3 -3 3 H18 q-3 0 -3 -3 V22 l5 -6z" fill="#8fc7a1" ${s()}/><path d="M15 29 H33" ${s()}/><rect x="17" y="30" width="14" height="7" fill="#e8f2e0" opacity=".7"/>`,
  'vinyl:r0': `<path d="M8 33 q2 -15 14 -16 q8 -1 12 7 q3 5 8 6 q2 5 -4 6 H12 q-4 0 -4 -3z" fill="#3a3a40" ${s()}/><path d="M14 22 q5 -4 10 -1" fill="none" ${s('stroke="' + W + '" stroke-width="1.8"')}/>`,
  'vinyl:r1': `<path d="M10 15 H38 l-2 24 H12z" fill="#e8c13a" ${s()}/><path d="M10 15 q14 -6 28 0" fill="#d8423a" ${s()}/><path d="M18 24 h12 M17 30 h14" ${s('stroke="#d8423a" stroke-width="2"')}/>`,
  'foam:r0': `<path d="M7 20 H41 V38 q0 2 -2 2 H9 q-2 0 -2 -2z" fill="#4f86c6" ${s()}/><path d="M7 20 L12 13 H36 L41 20z" fill="${W}" ${s()}/><path d="M18 27 h12" ${s('stroke="' + W + '"')}/>`,
  'foam:r1': `<path d="M8 18 H40 V36 q0 3 -3 3 H11 q-3 0 -3 -3z" fill="#e6dcc0" ${s()}/><path d="M8 18 L11 12 H37 L40 18" fill="#c9bf9c" ${s()}/><path d="M16 26 q4 -3 6 2 t6 -2 M14 33 h18" fill="none" ${s('stroke-width="1.8"')}/>`,
  'gear:r0': `<ellipse cx="24" cy="29" rx="12" ry="9" fill="#d8423a" ${s()}/><path d="M12 29 H36" ${s()}/><path d="M24 20 V10 l5 -3" fill="none" ${s()}/><circle cx="29.5" cy="6.5" r="2.5" fill="${W}" ${s('stroke-width="1.8"')}/><path d="M14 33 h4 M30 24 h4" ${s('stroke="' + W + '" stroke-width="2"')}/>`,
  'gear:r1': `<path d="M6 16 H42 M6 24 H42 M6 32 H42 M12 10 V38 M20 10 V38 M28 10 V38 M36 10 V38" fill="none" ${s('stroke-width="1.8"')}/><path d="M8 38 q10 -4 14 -10 t18 -8" fill="none" ${s('stroke="#4f7a5a" stroke-width="3"')}/>`,
};
// 개울 칸 물고기 (#44): 은어·붕어·참게, (#55) 잭팟 다금바리·황금 옥돔·귤색 잉어
const FISHI = [
  `<path d="M6 25 q10 -10 26 -4 l8 -6 v18 l-8 -6 q-16 6 -26 -2z" fill="#a9c2b8" ${s()}/><path d="M12 25 q10 3 20 -2" fill="none" ${s('stroke-width="1.8"')}/><path d="M18 19 l4 -4 4 4" fill="#e8c13a" ${s('stroke-width="1.8"')}/><circle cx="12" cy="23" r="1.6" fill="${K}"/>`,
  `<path d="M7 25 q9 -15 24 -8 l9 -7 v26 l-9 -7 q-15 7 -24 -4z" fill="#c9a24a" ${s()}/><path d="M20 15 q3 -5 8 -1" fill="#b08a3a" ${s('stroke-width="1.8"')}/><path d="M22 22 q3 3 0 7 M27 21 q3 4 0 8" fill="none" ${s('stroke-width="1.6"')}/><circle cx="13" cy="23" r="1.8" fill="${K}"/>`,
  `<ellipse cx="24" cy="28" rx="11" ry="8" fill="#8a5a3a" ${s()}/><path d="M13 26 l-6 -6 M13 30 l-7 0 M14 34 l-6 5 M35 26 l6 -6 M35 30 l7 0 M34 34 l6 5" fill="none" ${s()}/><path d="M16 21 q-6 -6 -2 -11 q4 2 4 6z M32 21 q6 -6 2 -11 q-4 2 -4 6z" fill="#a8693f" ${s()}/><circle cx="21" cy="22" r="1.5" fill="${K}"/><circle cx="27" cy="22" r="1.5" fill="${K}"/>`,
  `<path d="M4 25 q12 -14 30 -6 l10 -7 v26 l-10 -7 q-18 8 -30 -6z" fill="#a8553c" ${s()}/><path d="M16 18 q4 -6 10 -2" fill="#7d3a28" ${s('stroke-width="1.8"')}/><path d="M14 25 q10 4 20 -1" fill="none" ${s('stroke-width="1.6"')}/><circle cx="10" cy="23" r="1.8" fill="${K}"/>`,
  `<path d="M4 25 q12 -14 30 -6 l10 -7 v26 l-10 -7 q-18 8 -30 -6z" fill="#f2c230" ${s()}/><path d="M16 18 q4 -6 10 -2" fill="#c9961a" ${s('stroke-width="1.8"')}/><path d="M20 21 l2 3 -2 3 M26 21 l2 3 -2 3" fill="none" ${s('stroke-width="1.6"')}/><circle cx="10" cy="23" r="1.8" fill="${K}"/>`,
  `<path d="M4 25 q12 -14 30 -6 l10 -7 v26 l-10 -7 q-18 8 -30 -6z" fill="#f08a1c" ${s()}/><path d="M16 18 q4 -6 10 -2" fill="#c4650e" ${s('stroke-width="1.8"')}/><path d="M22 22 q3 3 0 7 M28 21 q3 4 0 8" fill="none" ${s('stroke-width="1.6"')}/><circle cx="10" cy="23" r="1.8" fill="${K}"/>`,
];
// 볼거리 칸 (#138): 전망 바위·샘·산담·방사탑
const SIGHTI = {
  view: `<path d="M5 40 L12 24 L22 20 L34 22 L43 40z" fill="#6b6d74" ${s()}/><path d="M12 24 H34" ${s('stroke-width="1.8"')}/><path d="M28 12 l4 -4 4 4" fill="none" ${s('stroke-width="1.8"')}/><circle cx="16" cy="11" r="3" fill="#ffd23f" ${s('stroke-width="1.8"')}/>`,
  spring: `<ellipse cx="24" cy="31" rx="17" ry="8" fill="#6b6d74" ${s()}/><ellipse cx="24" cy="30" rx="11" ry="4.6" fill="#6fc0e0" ${s('stroke-width="1.8"')}/><path d="M24 11 q5 7 0 11 q-5 -4 0 -11z" fill="#6fc0e0" ${s('stroke-width="1.8"')}/>`,
  sandam: `<rect x="7" y="14" width="34" height="26" rx="2" fill="#6b6d74" ${s()}/><rect x="12" y="19" width="24" height="16" rx="2" fill="#8fbf62" ${s('stroke-width="1.8"')}/><path d="M16 32 q8 -12 16 0" fill="#6f9a4a" ${s('stroke-width="1.8"')}/>`,
  tower: `<path d="M12 41 L19 15 H29 L36 41z" fill="#6b6d74" ${s()}/><path d="M14.5 33 H33.5 M17 24 H31" ${s('stroke-width="1.8"')}/><rect x="22" y="5" width="4" height="10" rx="1" fill="#8a8c92" ${s('stroke-width="1.8"')}/>`,
};
export function dexIcon(d) {
  const [kind, k] = d.id.split(':');
  if (kind === 'fish') return FISHI[Number(k)] || '';
  if (kind === 'sight') return SIGHTI[d.sk] || '';
  if (d.rare) return RARE[d.id] || '';
  const i = Number(k);
  return BASE[kind](COL[kind][i]) + DECO[kind][i];
}
