// 오름오름 로고 (#87): 획 굵기가 고른 굵은 고딕 '오름오름'. 첫 '오'의 ㅇ 은 귤(귤색 원 + 작은 초록 잎), 두 번째 ㅇ 은 외계인 얼굴(#150). 능선 장식 없음.
// 글꼴에 기대지 않고 선(path)으로만 그려서 첫 화면·파비콘·공유 이미지·사진 틀 어디서나 똑같이 보임. 가로형 하나로 통일.
// 색: 밝은 배경에선 짙은 먹색, 어두운 배경(dark)에선 흰색. 귤만 색.
export const LOGO_COLORS = { ink: '#211f1c', white: '#ffffff', paper: '#fbf6e6', gyul: '#ff8a1f', leaf: '#3f9a3a', alien: '#8fd06a', eye: '#1c1c22', tip: '#ffd23f' }; // alien·eye·tip: 게임 외계인 아이콘(zonelook.js)과 같은 색
export const LOGO_WEIGHTS = { bold: 13, heavy: 16.5 }; // 글자 획 굵기 (글자 칸 100×120 기준). 굵게 / 아주 굵게
export const LOGO_WEIGHT = 'bold'; // 지금 쓰는 굵기
const H = 120, ADV = 103; // 글자 높이, 글자 사이(폭 100 + 3: 촘촘히)

// 글자 한 칸의 선 경로(가운데 선, 끝은 자른 모양). '오' 의 ㅇ 은 귤로 따로 돌려줌
function syl(ch, x, w) {
  const X = (v) => +(x + v).toFixed(2), h = w / 2, f = (v) => +v.toFixed(2);
  if (ch === '오') {
    const R = 29, cy = 4 + R; // 귤(ㅇ): 바깥 반지름 R
    const bar = H - h, top = cy + R + Math.max(4, w * 0.35);
    return { gyul: { cx: X(50), cy, r: R }, d: `M${X(50)} ${f(top)}V${f(H - w)}M${X(0)} ${f(bar)}H${X(100)}` };
  }
  // 름: 가로획 6개(ㄹ 3·ㅡ 1·ㅁ 2)를 남는 높이에 고르게
  const free = H - 6 * w, g1 = free * 0.15, g2 = free * 0.17, c = free * 0.36;
  const y1 = h, y2 = y1 + w + g1, y3 = y2 + w + g1, y4 = y3 + w + g2, y5 = y4 + w + g2, y6 = y5 + w + c;
  const L = 12, Rr = 88;
  const rieul = `M${X(L)} ${f(y1)}H${X(Rr - h)}V${f(y2)}H${X(L + h)}V${f(y3)}H${X(Rr)}`;
  const eu = `M${X(0)} ${f(y4)}H${X(100)}`;
  const mieum = `M${X(L + h)} ${f(y5)}H${X(Rr - h)}V${f(y6)}H${X(L + h)}Z`;
  return { d: rieul + eu + mieum };
}
// 귤 하나: 귤색 원 + 오른쪽 위로 뻗은 작은 잎
const LEAF = (cx, cy, r, s = 1, fill = LOGO_COLORS.leaf, extra = '') => {
  const x = cx + r * 0.12, y = cy - r * 0.86;
  return `<path d="M${f2(x)} ${f2(y)}c${f2(5 * s)} ${f2(-11 * s)} ${f2(16 * s)} ${f2(-15 * s)} ${f2(26 * s)} ${f2(-12 * s)}c${f2(-5 * s)} ${f2(10 * s)} ${f2(-15 * s)} ${f2(15 * s)} ${f2(-26 * s)} ${f2(12 * s)}z" fill="${fill}"${extra}/>`;
};
const f2 = (v) => +v.toFixed(2);
const GYUL = (cx, cy, r, s) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${LOGO_COLORS.gyul}"/>` + LEAF(cx, cy, r, s);
// 귤 둘레 테두리(halo): 같은 모양을 테두리 색으로 굵게
const GYUL_HALO = (cx, cy, r, c, sw) => { const e = ` stroke="${c}" stroke-width="${sw}" stroke-linejoin="round"`; return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}"${e}/>` + LEAF(cx, cy, r, 1, c, e); };
// 외계인 얼굴 (#150): 귤과 같은 원(같은 반지름·자리) + 크고 기운 검은 눈 둘 + 잎 자리에 더듬이 둘
const ANT = (cx, cy, r, stem, tip, sw = 0, extra = '') => [-1, 1].map((k) => {
  const x0 = cx + k * r * 0.3, y0 = cy - r * 0.9, x1 = cx + k * r * 0.56, y1 = cy - r - 11;
  return `<path d="M${f2(x0)} ${f2(y0)}Q${f2(cx + k * r * 0.34)} ${f2(y1 + 2)} ${f2(x1)} ${f2(y1)}" fill="none" stroke="${stem}" stroke-width="${f2(4 + sw)}" stroke-linecap="round"/>`
    + `<circle cx="${f2(x1)}" cy="${f2(y1)}" r="3.8" fill="${tip}"${extra}/>`;
}).join('');
const ALIEN = (cx, cy, r) => {
  const C = LOGO_COLORS, ex = r * 0.36, ey = cy + r * 0.08, rx = r * 0.25, ry = r * 0.37;
  const eye = (k) => `<ellipse cx="${f2(cx + k * ex)}" cy="${f2(ey)}" rx="${f2(rx)}" ry="${f2(ry)}" fill="${C.eye}" transform="rotate(${k * 24} ${f2(cx + k * ex)} ${f2(ey)})"/>`
    + `<circle cx="${f2(cx + k * ex - r * 0.06)}" cy="${f2(ey - ry * 0.42)}" r="${f2(r * 0.075)}" fill="#fff"/>`;
  return ANT(cx, cy, r, C.alien, C.tip) + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.alien}"/>` + eye(-1) + eye(1);
};
const ALIEN_HALO = (cx, cy, r, c, sw) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}" stroke="${c}" stroke-width="${sw}"/>` + ANT(cx, cy, r, c, c, sw, ` stroke="${c}" stroke-width="${sw}"`);

// 로고 SVG 문자열 (가로형). opts.dark: 어두운 배경용(흰 글자), opts.weight: 'bold'|'heavy',
// opts.halo: 글자 둘레 테두리 색(장면 위에 얹을 때 떼어 보이게), opts.cls·opts.label
export function logoSvg({ dark = false, weight = LOGO_WEIGHT, halo = '', cls = '', label = '오름오름' } = {}) {
  const w = LOGO_WEIGHTS[weight] || LOGO_WEIGHTS.bold, ink = dark ? LOGO_COLORS.white : LOGO_COLORS.ink;
  let d = '', gy = '', hg = '';
  [...'오름오름'].forEach((ch, i) => {
    const s = syl(ch, i * ADV, w); d += s.d;
    if (s.gyul) { const { cx, cy, r } = s.gyul, al = i > 0; gy += al ? ALIEN(cx, cy, r) : GYUL(cx, cy, r); if (halo) hg += al ? ALIEN_HALO(cx, cy, r, halo, 12) : GYUL_HALO(cx, cy, r, halo, 12); } // 두 번째 '오' 는 외계인 (#150)
  });
  const st = (c, sw) => `fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="butt" stroke-linejoin="miter"`;
  const pad = halo ? 10 : 2, top = 18; // 위: 잎 자리
  const W = ADV * 3 + 100;
  const body = (halo ? `<path d="${d}" ${st(halo, w + 12)}/>${hg}` : '') + `<path d="${d}" ${st(ink, w)}/>${gy}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-top - pad} ${W + pad * 2} ${H + top + pad * 2}"${cls ? ` class="${cls}"` : ''} role="img" aria-label="${label}">${body}</svg>`;
}
// 파비콘: 귤 하나만(잎 포함). 외계인 얼굴(#150)은 16px 에서 눈이 뭉개져 파비콘·앱 아이콘은 귤 그대로. 배경 없음. 16px 에서도 또렷하게 원을 크게, 잎은 굵게
export function logoMark() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="29" cy="38" r="25" fill="${LOGO_COLORS.gyul}"/><path d="M31 15c2 -10 15 -16 30 -12c-5 12 -18 16 -30 12z" fill="${LOGO_COLORS.leaf}"/></svg>`;
}
// 앱 아이콘: 둥근 타일 안에 귤 하나. opts.square: 모서리 없이 꽉 찬 네모(iOS 는 스스로 둥글림, 투명 없음),
// opts.safe: 귤을 가운데로 줄여 가장자리가 잘려도 되게(maskable, 귤이 가운데 60% 안)
export function logoIcon({ dark = false, square = false, safe = false } = {}) {
  const bg = dark ? '#24251f' : LOGO_COLORS.paper, k = safe ? 0.8 : 1;
  const art = `<circle cx="124" cy="146" r="78" fill="${LOGO_COLORS.gyul}"/><path d="M130 70c10 -26 42 -38 76 -28c-12 28 -44 38 -76 28z" fill="${LOGO_COLORS.leaf}"/>`;
  const body = safe ? `<g transform="translate(128 128) scale(${k}) translate(-128 -128)">${art}</g>` : art;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256"${square || safe ? '' : ' rx="58"'} fill="${bg}"/>${body}</svg>`;
}
export const svgUrl = (svg) => 'data:image/svg+xml,' + encodeURIComponent(svg);
