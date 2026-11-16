// 오름오름 로고 (#72): 굵고 둥근 선으로 그린 한글 '오름오름' + 겹친 오름 능선 둘 + 귤색 포인트 하나.
// 글꼴에 기대지 않고 선(path)으로만 그려서 첫 화면·파비콘·공유 이미지·사진 틀 어디서나 똑같이 보임. 후처리 없는 납작한 그림체.
// 시안 3개: 1 능선 위 글자(우선), 2 한 줄 능선 + 글자, 3 둥근 타일. dark: 어두운 배경용 색.
export const LOGO_COLORS = { ink: '#33402a', paper: '#fbf6e6', green: '#4f7a36', green2: '#8fb35a', gyul: '#ff8a1f', leaf: '#3f6b2c' };
const SW = 13; // 글자 선 굵기 (글자 칸 100 기준)

// 글자 한 칸(가로 100, 세로 108)의 선 경로. o: ㅇ 은 따로 돌려줌(귤색으로 칠할 수 있게)
function syl(ch, x) {
  const X = (v) => x + v;
  if (ch === '오') return { ring: { cx: X(50), cy: 31, r: 24 }, d: `M${X(50)} 74V96M${X(10)} 100H${X(90)}` };
  return { d: `M${X(18)} 6H${X(82)}V26H${X(18)}V46H${X(82)}M${X(8)} 64H${X(92)}M${X(22)} 80H${X(78)}V102H${X(22)}Z` }; // 름
}
// 글자 '오름오름'. gyulAt: 귤색 ㅇ 자리(0·2, 없으면 -1). halo: 글자 둘레 테두리 색(배경과 떼어 보이게)
const GYUL = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r + SW / 2}" fill="${LOGO_COLORS.gyul}"/><path d="M${cx + 2} ${cy - r - 4}c4 -9 14 -12 22 -9c-4 8 -13 12 -22 9z" fill="${LOGO_COLORS.leaf}"/>`;
const RING = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`;
function word(ink, gyulAt = 0, halo = '', text = '오름오름', adv = 106) {
  let d = '', all = '', rings = '';
  [...text].forEach((ch, i) => {
    const s = syl(ch, i * adv); d += s.d; all += s.d;
    if (s.ring) { const { cx, cy, r } = s.ring; all += RING(cx, cy, r); if (i === gyulAt) rings += GYUL(cx, cy, r); else d += RING(cx, cy, r); }
  });
  const st = (c, w) => `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
  return (halo ? `<path d="${all}" ${st(halo, SW + 14)}/>` : '') + `<path d="${d}" ${st(ink, SW)}/>${rings}`;
}
const W4 = 106 * 3 + 100; // 글자 넷의 폭

// 1: 겹친 두 능선이 글자 뒤로 깔리고, 첫 '오'의 ㅇ 이 귤 (우선)
function sian1(dark) {
  const C = LOGO_COLORS, ink = dark ? C.paper : C.ink, bg = dark ? '#24251f' : C.paper;
  const W = W4 + 40, H = 200;
  const back = `M0 ${H - 12}C70 ${H - 30} 150 70 250 62C320 56 380 120 ${W} ${H - 40}V${H}H0Z`;
  const front = `M0 ${H}C40 ${H - 40} 70 104 132 98C196 92 230 150 300 ${H - 20}C330 ${H - 6} 360 ${H} ${W} ${H}Z`;
  return { w: W, h: H, body: `<path d="${back}" fill="${dark ? '#3e5a2e' : C.green2}"/><path d="${front}" fill="${dark ? '#2f4624' : C.green}"/><g transform="translate(20 ${H - 128})">${word(ink, 0, bg)}</g>` };
}
// 2: 글자 위로 한 획 능선(봉우리 둘이 겹침), 마지막 '오'의 ㅇ 이 귤 — 위에 해처럼 걸림
function sian2(dark) {
  const C = LOGO_COLORS, ink = dark ? C.paper : C.ink;
  const W = W4 + 20, H = 190;
  const ridge = `M8 70C60 66 92 14 150 12C190 11 210 40 226 46C250 30 280 22 312 24C370 28 400 64 ${W - 8} 70`;
  return { w: W, h: H, body: `<path d="${ridge}" fill="none" stroke="${dark ? C.green2 : C.green}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<g transform="translate(10 80)">${word(ink, 2)}</g>` };
}
// 3: 둥근 초록 타일 안에 '오름/오름' 두 줄, 두 능선 겹침, 첫 ㅇ 이 귤 (앱 아이콘·파비콘에도 쓰기 좋음)
function sian3(dark) {
  const C = LOGO_COLORS, S = 260;
  const tile = dark ? '#3e5a2e' : C.green, fg = C.paper;
  const two = (x, y, gy) => `<g transform="translate(${x} ${y}) scale(.84)">${word(fg, gy ? 0 : -1, '', '오름')}</g>`;
  return { w: S, h: S, body: `<rect width="${S}" height="${S}" rx="58" fill="${tile}"/><path d="M0 ${S - 50}C50 ${S - 70} 80 ${S - 110} 130 ${S - 112}C170 ${S - 114} 200 ${S - 80} ${S} ${S - 66}V${S - 58}A58 58 0 0 1 ${S - 58} ${S}H58A58 58 0 0 1 0 ${S - 58}Z" fill="${dark ? '#2f4624' : '#3f6b2c'}"/>`
    + two(44, 30, true) + two(44, 137, false) };
}
const SIANS = [sian1, sian2, sian3];
// 로고 SVG 문자열. n: 시안 번호(1~3), opts.dark, opts.cls·opts.label
export function logoSvg(n = 1, { dark = false, cls = '', label = '오름오름' } = {}) {
  const s = SIANS[(n - 1) % 3](dark);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s.w} ${s.h}"${cls ? ` class="${cls}"` : ''} role="img" aria-label="${label}">${s.body}</svg>`;
}
// 파비콘·작은 자리: 둥근 타일에 겹친 능선 둘 + 귤 (글자 없이)
export function logoMark() {
  const C = LOGO_COLORS;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${C.paper}"/><circle cx="40" cy="20" r="9" fill="${C.gyul}"/><path d="M41 11c1 -3 5 -4 8 -3c-2 3 -5 4 -8 3z" fill="${C.leaf}"/><path d="M0 50C10 44 16 26 28 25C38 24 44 40 64 44V50A14 14 0 0 1 50 64H14A14 14 0 0 1 0 50Z" fill="${C.green2}"/><path d="M0 52C8 48 14 36 24 35C34 34 40 48 54 52C58 53 62 53 64 53V50A14 14 0 0 1 50 64H14A14 14 0 0 1 0 50Z" fill="${C.green}"/></svg>`;
}
export const svgUrl = (svg) => 'data:image/svg+xml,' + encodeURIComponent(svg);
export const LOGO_PICK = 1; // 지금 쓰는 시안 (고르면 바꿈)
