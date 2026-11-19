// node build.mjs → dist/index.html + dist/main-해시.js + dist/a/*.bin (Pages: 모델은 따로 받음, #85)
//                 + dist/oreumoreum.html (claude.ai 아티팩트용 한 파일, 뼈대 없음) + dist/test.html (한 파일 완성 페이지: tools/ 가 file:// 로 엶)
// DEV=1 이면 개발 서버용: 저장 키를 따로 써서 실서버 기록과 섞이지 않게 한다
// PUBLIC=1 이면 공개 빌드(release): 콘솔 확인 함수 window.__oreum 은 어드민에게만 (#84)
// 코드 줄이기·이름 줄이기(minify)는 하지만 보안으로 치지 않는다. 지킬 것은 서버(server/)가 지킨다
// 캐시 (#85): JS·모델 파일 이름에 내용 해시를 붙여, 바뀐 것만 다시 받게 한다 (index.html 만 매번 새로)
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { packAssets } from './tools/packassets.mjs';
const DEV = !!process.env.DEV, PUBLIC = process.env.PUBLIC === '1';
const hash = (b) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 10);
fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync('dist/a', { recursive: true });
// 모델 묶기: 이름 → { url | b64, meta }
const packed = await packAssets(path.resolve('src'));
const listSplit = {}, listOne = {};
for (const a of packed) {
  const f = `a/${a.name}-${hash(a.buf)}.bin`; fs.writeFileSync('dist/' + f, a.buf);
  listSplit[a.name] = { url: f, meta: a.meta }; listOne[a.name] = { b64: a.buf.toString('base64'), meta: a.meta };
}
const assetPlugin = (list) => ({ name: 'assetlist', setup(b) { b.onLoad({ filter: /src[\\/]assetlist\.js$/ }, () => ({ contents: 'export const ASSETS = ' + JSON.stringify(list) + ';', loader: 'js' })); } });
const bundle = async (list) => (await esbuild.build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020', legalComments: 'none', plugins: [assetPlugin(list)], define: { __DEV__: String(DEV), __PUBLIC__: String(PUBLIC) } })).outputFiles[0].text;
const js = (await bundle(listOne)).replace(/<\/script/gi, '<\\/script'); // 한 파일용: 모델이 JS 안에
const jsSplit = await bundle(listSplit);
const mainName = `main-${hash(jsSplit)}.js`;
fs.writeFileSync('dist/' + mainName, jsSplit);
const page = fs.readFileSync('src/page.html', 'utf8');
const i = page.indexOf('__BUNDLE__');
const body = page.slice(0, i) + js + page.slice(i + 10);
// Pages 용: 인라인 스크립트 대신 해시 붙은 main-*.js 를 부름
const sTag = page.lastIndexOf('<script>', i), eTag = page.indexOf('</script>', i) + 9;
const bodySplit = page.slice(0, sTag) + `<script src="${mainName}"></script>` + page.slice(eTag);
fs.writeFileSync('dist/oreumoreum.html', body);
// 파비콘·공유 이미지 (#72). og:image 는 게시할 때 함께 올리는 og.png (src/og.png, tools/og.mjs 로 만듦)
const { logoMark } = await import('./src/logo.js');
const SITE = 'https://spacehwi.github.io/oreumoreum/' + (DEV ? 'dev/' : '');
const meta = ''
  + `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(logoMark())}">`
  + '<link rel="apple-touch-icon" href="apple-touch-icon.png"><link rel="manifest" href="manifest.webmanifest"><meta name="theme-color" content="#24251f">'
  + '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="오름오름"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'
  + '<meta name="description" content="제주 오름을 걸으며 쓰레기를 줍고 귤을 모으는 웹 게임">'
  + '<meta property="og:title" content="오름오름"><meta property="og:description" content="제주 오름을 걸으며 쓰레기를 줍고 귤을 모으는 웹 게임">'
  + `<meta property="og:type" content="website"><meta property="og:url" content="${SITE}"><meta property="og:image" content="${SITE}og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image">`;
// 페이지 보안 (#84): GitHub Pages 는 응답 헤더를 못 바꾸므로 meta CSP. 게임 코드(인라인 스크립트)는 해시로만 허용,
// 바깥은 구글 로그인(GIS)·글꼴·날씨(open-meteo)·멀티 서버(https/wss, ?server= 로 바꿔 끼울 수 있어 넓게)만
// Pages(index.html) 는 같은 곳의 main-*.js 만('self'), 한 파일(test.html)은 인라인 스크립트 해시로
const scriptHash = crypto.createHash('sha256').update(js, 'utf8').digest('base64');
const csp = (scriptSrc) => [
  "default-src 'self'",
  `script-src ${scriptSrc} 'wasm-unsafe-eval' https://accounts.google.com/gsi/client`, // wasm: 모델 풀기(meshopt, #85). JS eval 은 여전히 막음
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https: wss: data: blob: http://127.0.0.1:* ws://127.0.0.1:* http://localhost:* ws://localhost:*",
  'frame-src https://accounts.google.com/gsi/',
  "media-src 'self' data: blob:", "worker-src 'self' blob:",
  "manifest-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'none'",
].join('; ');
const wrap = (CSP, b) => '<!doctype html><html lang="ko"><head><meta charset="utf-8">' + `<meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="referrer" content="strict-origin-when-cross-origin">` + '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">' + meta + '</head><body>' + b + '</body></html>';
fs.copyFileSync('src/og.png', 'dist/og.png');
// 홈 화면 추가 (#91): 앱 아이콘 PNG(tools/icons.mjs 로 구워 src/icons 에 커밋)와 manifest. 주소는 상대 경로라 /oreumoreum/ 과 /oreumoreum/dev/ 어디서나 맞음
for (const f of fs.readdirSync('src/icons')) fs.copyFileSync('src/icons/' + f, 'dist/' + f);
fs.writeFileSync('dist/manifest.webmanifest', JSON.stringify({
  name: '오름오름', short_name: '오름오름', description: '제주 오름을 걸으며 쓰레기를 줍고 귤을 모으는 웹 게임',
  lang: 'ko', start_url: './', scope: './', id: './', display: 'standalone', orientation: 'any',
  background_color: '#24251f', theme_color: '#24251f',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
  ],
}, null, 2));
// 내 캐릭터 모델은 게임 코드와 나란히 받게 미리 알림 (main.js 가 fetch 로 씀)
const pre = packed.filter((a) => a.core).map((a) => `<link rel="preload" href="${listSplit[a.name].url}" as="fetch" crossorigin>`).join('');
fs.writeFileSync('dist/index.html', wrap(csp("'self'"), bodySplit).replace('</head>', pre + '</head>'));
fs.writeFileSync('dist/test.html', wrap(csp(`'sha256-${scriptHash}'`), body));
const kb = (n) => (n / 1024).toFixed(0) + 'KB';
const aTot = packed.reduce((t, a) => t + a.buf.length, 0);
console.log('ok', kb(fs.statSync('dist/oreumoreum.html').size), '· Pages:', mainName, kb(jsSplit.length), '+ 모델', packed.length + '개', kb(aTot), DEV ? '(dev)' : '', PUBLIC ? '(public)' : '');
// 로고 시안 (#87): 고딕 '오름오름' 굵게·아주 굵게를 밝은·어두운 배경에 나란히 + 파비콘 크기별 + 앱 아이콘 → dist/logo-sian.html
{
  const { logoSvg, logoIcon, LOGO_WEIGHT } = await import('./src/logo.js');
  const NAME = { bold: '굵게', heavy: '아주 굵게' };
  const col = (wt) => `<section><h2>${NAME[wt]}${wt === LOGO_WEIGHT ? ' · 지금 쓰는 것' : ''}</h2><div class="c">${logoSvg({ weight: wt })}</div><div class="c dk">${logoSvg({ weight: wt, dark: true })}</div></section>`;
  const fav = (dark) => `<div class="m${dark ? ' dk' : ''}">${[16, 24, 32, 48, 64].map((s) => `<span><img src="data:image/svg+xml,${encodeURIComponent(logoMark())}" width="${s}" height="${s}" alt=""><small>${s}</small></span>`).join('')}</div>`;
  fs.writeFileSync('dist/logo-sian.html', `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>오름오름 로고</title><link rel="icon" href="data:image/svg+xml,${encodeURIComponent(logoMark())}"><style>body{margin:0;padding:16px;font-family:system-ui,sans-serif;background:#eee9da;color:#211f1c}h1{font-size:20px}h2{font-size:15px;margin:18px 0 8px}.r{display:grid;grid-template-columns:1fr 1fr;gap:12px}.c{background:#fbf6e6;border-radius:14px;padding:24px;display:grid;place-items:center;margin-bottom:12px}.c.dk,.m.dk{background:#24251f;color:#fff}.c svg{width:100%;max-width:360px;height:auto}.m{display:flex;gap:18px;align-items:end;background:#fbf6e6;border-radius:14px;padding:16px;margin-bottom:12px}.m span{display:grid;justify-items:center;gap:4px}.m small{font-size:11px;opacity:.6}.ic{display:flex;gap:16px}.ic svg{width:96px;height:96px}@media(max-width:600px){.r{grid-template-columns:1fr}}</style></head><body><h1>오름오름 로고</h1><p>획 굵기가 고른 고딕 글자, 두 '오'의 ㅇ 은 귤. 글자는 밝은 배경에서 먹색, 어두운 배경에서 흰색. 굵기는 <code>src/logo.js</code> 의 LOGO_WEIGHT.</p><div class="r">${col('bold')}${col('heavy')}</div><section><h2>파비콘 (귤 하나)</h2>${fav(false)}${fav(true)}</section><section><h2>앱 아이콘</h2><div class="ic">${logoIcon()}${logoIcon({ dark: true })}</div></section><section><h2>홈 화면 아이콘 4장 (#91)</h2><div class="ic">${['apple-touch-icon 180','icon-192 192','icon-512 512','icon-maskable-512 512'].map((t) => { const [n, z] = t.split(' '); return `<figure style="margin:0;text-align:center"><img src="${n}.png" width="96" height="96" alt="${n}"><figcaption style="font-size:11px">${n}<br>${z}px</figcaption></figure>`; }).join('')}</div></section></body></html>`);
}
