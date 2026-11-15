// 뱃지 아이콘 (48x48 SVG, 원 배경 위에 얹음)
const K = '#33402a', W = '#fbf6e6', O = '#f29a2e', P = '#e9719a', G = '#6fae4a', Y = '#ffd23f';
const s = (d) => `stroke="${K}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" ${d || ''}`;
const eyes = (x1, x2, y) => `<circle cx="${x1}" cy="${y}" r="1.7" fill="${K}"/><circle cx="${x2}" cy="${y}" r="1.7" fill="${K}"/>`;
const cheeks = (x1, x2, y) => `<circle cx="${x1}" cy="${y}" r="2" fill="${P}" opacity=".7"/><circle cx="${x2}" cy="${y}" r="2" fill="${P}" opacity=".7"/>`;

export const BADGE_ICONS = {
  // 첫 발: 발자국
  'b-first': `<ellipse cx="24" cy="29" rx="8" ry="10" fill="${W}" ${s()}/><circle cx="16" cy="15" r="3" fill="${W}" ${s()}/><circle cx="22" cy="12" r="3.2" fill="${W}" ${s()}/><circle cx="28.5" cy="12.5" r="3" fill="${W}" ${s()}/><circle cx="33.5" cy="16.5" r="2.6" fill="${W}" ${s()}/>${eyes(21, 27, 28)}<path d="M21.5 32 q2.5 2 5 0" fill="none" ${s()}/>`,
  // 만 보: 운동화
  'b-10k': `<path d="M8 30 q0-9 6-12 l5 4 q4 2 8 2 l9 3 q5 2 5 6 v2 H8z" fill="${W}" ${s()}/><path d="M8 33 H41 v3 H8z" fill="${O}" ${s()}/><path d="M17 22 l3 -2 M21 24 l3 -2" fill="none" ${s()}/><path d="M2 20 h5 M1 26 h5" ${s('opacity=".7"')}/>`,
  // 오름 지기: 깃발 꽂힌 오름
  'b-50k': `<path d="M4 38 Q24 8 44 38z" fill="${G}" ${s()}/><path d="M24 17 V7" ${s()}/><path d="M24 7 l9 3 -9 3z" fill="${Y}" ${s()}/>${eyes(20, 28, 28)}${cheeks(16.5, 31.5, 31)}<path d="M22 31 q2 2 4 0" fill="none" ${s()}/>`,
  // 굼부리 열 바퀴: 분화구 + 도는 화살표
  'b-lap-10': `<ellipse cx="24" cy="28" rx="17" ry="9" fill="${G}" ${s()}/><ellipse cx="24" cy="28" rx="10" ry="4.5" fill="#4f7a36" ${s()}/><path d="M9 20 q15 -12 30 0" fill="none" ${s('stroke-dasharray="3 3.5"')}/><path d="M39 20 l-5 -1 M39 20 l1 -5" ${s()}/><text x="24" y="31" font-size="9" font-weight="900" text-anchor="middle" fill="${W}" font-family="Noto Sans KR, sans-serif">10</text>`,
  // 남벽: 바위 절벽 + 작은 나무
  'b-wall': `<path d="M6 40 L10 18 L16 22 L20 9 L27 15 L31 8 L37 17 L42 40z" fill="#9a958a" ${s()}/><path d="M16 26 l3 4 M27 20 l-2 6 M33 24 l3 5" fill="none" ${s()}/><path d="M9 40 l3 -8 3 8z M37 40 l2.5 -7 2.5 7z" fill="${G}" ${s()}/>`,
  // 해돋이: 수평선 위로 웃는 해
  'b-sunrise': `<path d="M24 6 v4 M10 12 l3 3 M38 12 l-3 3 M5 24 h4 M39 24 h4" ${s()}/><path d="M10 31 a14 14 0 0 1 28 0z" fill="${Y}" ${s()}/>${eyes(19.5, 28.5, 24)}<path d="M21 27 q3 2.5 6 0" fill="none" ${s()}/><path d="M4 31 H44" ${s()}/><path d="M9 37 h8 M22 37 h12 M14 42 h10" ${s('opacity=".8"')}/>`,
  // 노을: 바다로 지는 해
  'b-sunset': `<circle cx="24" cy="26" r="12" fill="#ff8a3d" ${s()}/><path d="M17 23 q2.5 -2 5 0 M26 23 q2.5 -2 5 0" fill="none" ${s()}/><path d="M21 28 q3 2 6 0" fill="none" ${s()}/><rect x="3" y="31" width="42" height="12" fill="#5b8fc9" ${s()}/><path d="M9 36 q3 -2 6 0 t6 0 M25 39 q3 -2 6 0 t6 0" fill="none" ${s('stroke="' + W + '"')}/>`,
  // 노루 친구: 노루 얼굴 + 하트
  'b-deer-friend': `<path d="M14 14 l-4 -7 M14 14 l-6 -2 M34 14 l4 -7 M34 14 l6 -2" fill="none" ${s()}/><ellipse cx="13" cy="19" rx="5" ry="3" fill="#c9a27a" ${s()}/><ellipse cx="35" cy="19" rx="5" ry="3" fill="#c9a27a" ${s()}/><path d="M15 18 q9 -6 18 0 q2 10 -4 18 q-5 4 -10 0 q-6 -8 -4 -18z" fill="#c9a27a" ${s()}/>${eyes(20, 28, 24)}<ellipse cx="24" cy="32" rx="3" ry="2" fill="${K}"/><path d="M36 33 c0-3 4-3 4 0 c0-3 4-3 4 0 c0 3-4 5-4 6 c0-1-4-3-4-6z" fill="${P}" ${s('stroke-width="1.8"')}/>`,
  // 노루 기수: 달리는 노루 옆모습
  'b-rider': `<path d="M10 26 q2 -6 10 -6 h10 l4 -6 q4 -2 6 1 l-1 4 -4 2 q-1 7 -6 8 H16 q-5 0 -6 -3z" fill="#c9a27a" ${s()}/><path d="M16 29 l-4 9 M22 29 l2 9 M28 29 l-2 9 M32 27 l5 8" fill="none" ${s()}/><path d="M36 14 l-1 -6 M38 14 l3 -5" fill="none" ${s()}/><circle cx="36.5" cy="17" r="1.4" fill="${K}"/><path d="M2 22 h5 M3 28 h4" ${s('opacity=".7"')}/><path d="M18 20 q4 -6 9 0" fill="${O}" ${s()}/>`,
  // 돌탑: 쌓인 돌
  'b-stones': `<ellipse cx="24" cy="37" rx="13" ry="4.5" fill="#b9b3a6" ${s()}/><ellipse cx="24" cy="29" rx="10" ry="4" fill="#cfc9bc" ${s()}/><ellipse cx="24" cy="22" rx="7.5" ry="3.5" fill="#b9b3a6" ${s()}/><ellipse cx="24" cy="15.5" rx="5" ry="3" fill="#cfc9bc" ${s()}/><path d="M24 7 l1.4 2.8 3 .4 -2.2 2 .6 3 -2.8 -1.5 -2.8 1.5 .6 -3 -2.2 -2 3 -.4z" fill="${Y}" ${s('stroke-width="1.6"')}/>${eyes(21, 27, 29)}`,
  // 멧돼지: 멧돼지 얼굴 + 귤
  'b-boar': `<path d="M12 14 l3 7 M36 14 l-3 7" ${s()}/><path d="M11 13 l6 4 -4 4z M37 13 l-6 4 4 4z" fill="#6a5040" ${s()}/><ellipse cx="24" cy="26" rx="13" ry="11" fill="#6a5040" ${s()}/><ellipse cx="24" cy="31" rx="6" ry="4" fill="#d9a48a" ${s()}/><circle cx="22" cy="31" r="1" fill="${K}"/><circle cx="26" cy="31" r="1" fill="${K}"/><path d="M17 33 l-2 3 M31 33 l2 3" stroke="${W}" stroke-width="2.4" stroke-linecap="round"/><circle cx="19" cy="23" r="1.7" fill="${W}"/><circle cx="29" cy="23" r="1.7" fill="${W}"/><circle cx="39" cy="38" r="5" fill="${O}" ${s()}/><path d="M39 33 l2 -2" stroke="${G}" stroke-width="2.4" stroke-linecap="round"/>`,
  // 인증샷: 카메라
  'b-photo': `<rect x="7" y="15" width="34" height="23" rx="5" fill="${W}" ${s()}/><path d="M17 15 l3 -5 h8 l3 5" fill="${W}" ${s()}/><circle cx="24" cy="26.5" r="7.5" fill="#5b8fc9" ${s()}/><circle cx="21.5" cy="24" r="2" fill="${W}"/><circle cx="35" cy="20" r="1.6" fill="${O}"/>`,
  // 함께 걷는 길: 맞잡은 두 손 + 하트
  'b-hand': `<path d="M6 30 q4 -8 12 -8 l6 4" fill="none" ${s('stroke-width="5" stroke="' + K + '"')}/><path d="M6 30 q4 -8 12 -8 l6 4" fill="none" stroke="#f2c9a0" stroke-width="2.6" stroke-linecap="round"/><path d="M42 30 q-4 -8 -12 -8 l-6 4" fill="none" ${s('stroke-width="5"')}/><path d="M42 30 q-4 -8 -12 -8 l-6 4" fill="none" stroke="#a87650" stroke-width="2.6" stroke-linecap="round"/><circle cx="24" cy="27" r="4.5" fill="#d4a27a" ${s()}/><path d="M20 11 c0-4 5-4 4 0 c-1-4 4-4 4 0 c0 4-4 6-4 7 c0-1-4-3-4-7z" fill="${P}" ${s('stroke-width="1.8"')}/>`,
  // 사흘 개근: 달력 3
  'b-streak-3': `<rect x="9" y="11" width="30" height="28" rx="4" fill="${W}" ${s()}/><path d="M9 19 H39" ${s()}/><rect x="9" y="11" width="30" height="8" rx="3" fill="#e2683c" ${s()}/><path d="M16 8 v6 M32 8 v6" ${s()}/><text x="24" y="35" font-size="15" font-weight="900" text-anchor="middle" fill="${K}" font-family="Noto Sans KR, sans-serif">3</text>`,
  // 일주일 개근: 달력 7 + 별
  'b-streak-7': `<rect x="9" y="11" width="30" height="28" rx="4" fill="${W}" ${s()}/><rect x="9" y="11" width="30" height="8" rx="3" fill="#2f6db5" ${s()}/><path d="M16 8 v6 M32 8 v6" ${s()}/><text x="22" y="35" font-size="15" font-weight="900" text-anchor="middle" fill="${K}" font-family="Noto Sans KR, sans-serif">7</text><path d="M36 26 l1.8 3.6 4 .6 -2.9 2.8 .7 4 -3.6 -1.9 -3.6 1.9 .7 -4 -2.9 -2.8 4 -.6z" fill="${Y}" ${s('stroke-width="1.8"')}/>`,
  // 두 길의 러너: 갈림길 이정표
  'b-both': `<path d="M24 40 V12" ${s('stroke-width="3"')}/><path d="M24 14 H38 l4 4 -4 4 H24z" fill="${W}" ${s()}/><path d="M24 24 H10 l-4 4 4 4 H24z" fill="${Y}" ${s()}/><path d="M16 42 q8 -4 16 0" fill="none" ${s()}/>`,
};

// #13 새 뱃지: 단계형은 fam 이름(trash·recycle·heap·dex)으로 한 아이콘을 같이 씀
Object.assign(BADGE_ICONS, {
  // 줍는 사람: 쓰레기 봉투
  trash: `<path d="M16 14 q8 -6 16 0 l4 22 q-12 6 -24 0z" fill="#3f9a5a" ${s()}/><path d="M18 14 l-2 -5 5 3 M30 14 l2 -5 -5 3" fill="none" ${s()}/>${eyes(21, 27, 26)}<path d="M21.5 30 q2.5 2 5 0" fill="none" ${s()}/>`,
  // 재활용 단골: 도는 화살표
  recycle: `<path d="M24 9 l7 12 h-14z" fill="${G}" ${s()}/><path d="M12 35 l7 -12 7 12z" fill="#5b8fc9" transform="rotate(-60 19 29)" ${s()}/><path d="M36 35 l-7 -12 -7 12z" fill="${Y}" transform="rotate(60 29 29)" ${s()}/>`,
  // 더미 해결사: 쓰레기 더미 + 반짝
  heap: `<path d="M5 38 Q24 8 43 38z" fill="#7a6a58" ${s()}/><rect x="14" y="26" width="9" height="5" rx="1.5" fill="${W}" ${s('stroke-width="1.8"')}/><circle cx="30" cy="29" r="3.2" fill="#d8423a" ${s('stroke-width="1.8"')}/><path d="M36 9 v8 M32 13 h8" ${s('stroke="' + Y + '" stroke-width="3"')}/>`,
  // 도감 수집가: 책
  dex: `<path d="M8 12 H24 V38 H8z M24 12 H40 V38 H24z" fill="${W}" ${s()}/><path d="M12 19 h8 M12 24 h8 M28 19 h8" fill="none" ${s()}/><circle cx="32" cy="29" r="3" fill="${O}" ${s('stroke-width="1.8"')}/>`,
  'b-kind-can': `<rect x="14" y="12" width="20" height="26" rx="4" fill="#d8423a" ${s()}/><path d="M14 18 H34 M14 32 H34" ${s()}/><ellipse cx="24" cy="12" rx="10" ry="2.5" fill="#c9ccd2" ${s()}/>`,
  'b-kind-pet': `<path d="M20 6 h8 v5 l5 5 v22 q0 3 -3 3 H18 q-3 0 -3 -3 V16 l5 -5z" fill="#d9eef5" ${s()}/><rect x="20" y="4" width="8" height="5" rx="1.5" fill="#3a7fd0" ${s()}/><path d="M15 22 H33 M15 31 H33" ${s()}/>`,
  'b-kind-vinyl': `<path d="M10 20 q6 -10 14 -6 q10 -4 14 8 q4 10 -6 16 q-10 4 -18 -2 q-8 -6 -4 -16z" fill="${W}" ${s()}/><path d="M18 22 q4 4 10 0" fill="none" ${s()}/>`,
  'b-kind-foam': `<rect x="8" y="17" width="32" height="20" rx="3" fill="${W}" ${s()}/><path d="M8 24 H40" ${s()}/><circle cx="16" cy="31" r="1.4" fill="${K}"/><circle cx="24" cy="31" r="1.4" fill="${K}"/><circle cx="32" cy="31" r="1.4" fill="${K}"/>`,
  'b-kind-gear': `<circle cx="24" cy="25" r="13" fill="none" ${s('stroke-width="5" stroke="#e2683a"')}/><circle cx="24" cy="25" r="13" fill="none" ${s('stroke-dasharray="6 5"')}/><path d="M36 10 l5 -4" ${s()}/>`,
  'b-streak-30': `<rect x="9" y="11" width="30" height="28" rx="4" fill="${W}" ${s()}/><rect x="9" y="11" width="30" height="8" rx="3" fill="#d6a13b" ${s()}/><path d="M16 8 v6 M32 8 v6" ${s()}/><text x="24" y="35" font-size="14" font-weight="900" text-anchor="middle" fill="${K}" font-family="Noto Sans KR, sans-serif">30</text>`,
  'b-gear-one': `<path d="M10 38 L30 18" ${s('stroke-width="5"')}/><path d="M10 38 L30 18" stroke="#c39a4c" stroke-width="2.4" stroke-linecap="round"/><path d="M28 10 l10 0 -2 8 -8 0z M34 22 l8 -2 M32 26 l7 4" fill="${W}" ${s()}/><path d="M36 6 v4 M40 9 h-4" ${s('stroke="' + Y + '"')}/>`,
  'b-gear-all': `<path d="M24 5 l16 6 v12 q0 14 -16 20 q-16 -6 -16 -20 V11z" fill="#e8b94a" ${s()}/><path d="M24 14 l3 6 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1z" fill="${W}" ${s('stroke-width="1.8"')}/>`,
});

export const DAILY_ICON = `<circle cx="24" cy="24" r="12" fill="${O}" ${s()}/><path d="M24 12 q3 -5 7 -4 q-1 4 -7 4z" fill="${G}" ${s('stroke-width="1.8"')}/>${eyes(20, 28, 23)}<path d="M21 27 q3 2.5 6 0" fill="none" ${s()}/>`;
export const ALLDAY_ICON = `<path d="M24 6 l5 10 11 1.5 -8 7.5 2 11 -10 -5.5 -10 5.5 2 -11 -8 -7.5 11 -1.5z" fill="${Y}" ${s()}/>${eyes(20.5, 27.5, 22)}<path d="M21.5 26 q2.5 2 5 0" fill="none" ${s()}/>`;

export const iconSvg = (inner) => `<svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">${inner}</svg>`;
