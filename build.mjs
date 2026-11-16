// node build.mjs → dist/oreumoreum.html (claude.ai 아티팩트용, 뼈대 없음) + dist/index.html (Pages·로컬 확인용 완성 페이지)
// DEV=1 이면 개발 서버용: 저장 키를 따로 써서 실서버 기록과 섞이지 않게 한다
import * as esbuild from 'esbuild';
import fs from 'fs';
const DEV = !!process.env.DEV;
const r = await esbuild.build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020', define: { __DEV__: String(DEV) } });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const page = fs.readFileSync('src/page.html', 'utf8');
const i = page.indexOf('__BUNDLE__');
fs.mkdirSync('dist', { recursive: true });
const body = page.slice(0, i) + js + page.slice(i + 10);
fs.writeFileSync('dist/oreumoreum.html', body);
// 파비콘·공유 이미지 (#72). og:image 는 게시할 때 함께 올리는 og.png (src/og.png, tools/og.mjs 로 만듦)
const { logoMark } = await import('./src/logo.js');
const SITE = 'https://spacehwi.github.io/oreumoreum/' + (DEV ? 'dev/' : '');
const meta = ''
  + `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(logoMark())}">`
  + '<meta name="description" content="제주 오름을 걸으며 쓰레기를 줍고 귤을 모으는 웹 게임">'
  + '<meta property="og:title" content="오름오름"><meta property="og:description" content="제주 오름을 걸으며 쓰레기를 줍고 귤을 모으는 웹 게임">'
  + `<meta property="og:type" content="website"><meta property="og:url" content="${SITE}"><meta property="og:image" content="${SITE}og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image">`;
const full = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">' + meta + '</head><body>' + body + '</body></html>';
fs.copyFileSync('src/og.png', 'dist/og.png');
fs.writeFileSync('dist/index.html', full);
fs.writeFileSync('dist/test.html', full);
console.log('ok', (fs.statSync('dist/oreumoreum.html').size / 1024).toFixed(0) + 'KB', DEV ? '(dev)' : '');
// 로고 시안 (#72): 밝은 배경·어두운 배경에 3개 나란히 → dist/logo-sian.html
{
  const { logoSvg, LOGO_PICK } = await import('./src/logo.js');
  const cell = (n, dark) => `<div class="c ${dark ? 'dk' : ''}">${logoSvg(n, { dark })}</div>`;
  const rows = [1, 2, 3].map((n) => `<section><h2>시안 ${n}${n === LOGO_PICK ? ' · 지금 쓰는 것' : ''}</h2><div class="r">${cell(n, false)}${cell(n, true)}</div></section>`).join('');
  fs.writeFileSync('dist/logo-sian.html', `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>오름오름 로고 시안</title><link rel="icon" href="data:image/svg+xml,${encodeURIComponent(logoMark())}"><style>body{margin:0;padding:16px;font-family:system-ui,sans-serif;background:#eee9da;color:#33402a}h1{font-size:20px}h2{font-size:15px;margin:18px 0 8px}.r{display:grid;grid-template-columns:1fr 1fr;gap:12px}.c{background:#fbf6e6;border-radius:14px;padding:24px;display:grid;place-items:center}.c.dk{background:#24251f}.c svg{width:100%;max-width:340px;height:auto;max-height:200px}.m{display:flex;gap:16px;align-items:center}.m svg{width:64px;height:64px}@media(max-width:600px){.r{grid-template-columns:1fr}}</style></head><body><h1>오름오름 로고 시안</h1><p>굵고 둥근 선 글자 + 겹친 오름 능선 둘 + 귤색 포인트 하나. 고르면 <code>src/logo.js</code> 의 LOGO_PICK 을 바꿔요.</p>${rows}<section><h2>파비콘</h2><div class="m">${logoMark()}<span>탭 아이콘·작은 자리</span></div></section></body></html>`);
}
