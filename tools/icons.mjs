// 홈 화면 앱 아이콘 굽기 (#91): node tools/icons.mjs → src/icons/*.png (로고의 logoIcon() SVG → PNG, tools/og.mjs 와 같은 방식)
// apple-touch-icon 180(네모 꽉 참), 안드로이드 192·512, maskable 512(귤이 가운데 60% 안). 로고를 바꾸면 다시 돌려 커밋. build.mjs 가 dist 로 복사
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs';
import { logoIcon } from '../src/logo.js';
const OUT = [
  ['apple-touch-icon.png', 180, { square: true }],
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-512.png', 512, { safe: true }],
];
fs.mkdirSync('src/icons', { recursive: true });
const b = await chromium.launch();
for (const [name, n, o] of OUT) {
  const p = await b.newPage({ viewport: { width: n, height: n } });
  await p.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${n}px;height:${n}px}</style>${logoIcon(o)}`);
  await p.screenshot({ path: 'src/icons/' + name, omitBackground: true });
  await p.close();
  console.log(name, n, (fs.statSync('src/icons/' + name).size / 1024).toFixed(1) + 'KB');
}
await b.close();
