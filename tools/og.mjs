// 공유 이미지(og:image) 만들기 (#72): node tools/og.mjs → src/og.png (1200×630). 로고 시안을 바꾸면 다시 돌려 커밋
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs';
import { logoSvg, LOGO_PICK, LOGO_COLORS as C } from '../src/logo.js';
const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0}body{width:1200px;height:630px;background:${C.paper};display:grid;place-items:center;overflow:hidden}
svg{width:760px;height:auto}</style>
<body>${logoSvg(LOGO_PICK)}</body>`;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.setContent(html); await p.screenshot({ path: 'src/og.png' }); await b.close();
console.log('src/og.png', (fs.statSync('src/og.png').size / 1024).toFixed(0) + 'KB');
