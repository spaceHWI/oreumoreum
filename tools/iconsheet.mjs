// 아이콘 시트 (#184): 화면에 나오는 아이콘을 한 장에 모아 찍음. node tools/iconsheet.mjs [이름] → notes/shots/icons-<이름>-{phone,pc}.jpg
// - 위: src/icons.js 의 아이콘 세트(id 이름과 함께). 있으면
// - 가운데: 아직 소스에 손으로 남아 있는 선 그림(page.html 의 <svg>, 게임 파일의 '<path…>' 글자)
// - 아래: 업적 뱃지
// 폰 크기(위쪽 칸 15px·버튼 22px)와 PC 크기(18·24px) 두 장
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');
const name = process.argv[2] || 'now';
const ROOT = process.cwd();
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// 1. 세트
let set = [];
if (fs.existsSync('src/icons.js')) {
  const M = await import(path.join(ROOT, 'src/icons.js'));
  set = Object.keys(M.ICONS).map((id) => ({ id, svg: M.icon(id), src: M.ICON_SRC?.[id] || '' }));
}
// 2. 손으로 남은 선 그림
const left = [];
const html = fs.readFileSync('src/page.html', 'utf8');
for (const m of html.matchAll(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/g)) {
  if (/data-i=/.test(m[1]) || !m[2].trim()) continue;
  const pre = html.slice(Math.max(0, m.index - 200), m.index), id = [...pre.matchAll(/id="([^"]+)"/g)].pop()?.[1] || '';
  left.push({ id: 'page:' + id, svg: `<svg${m[1].replace(/\s(width|height|class)="[^"]*"/g, '')}>${m[2]}</svg>` });
}
const files = ['src/game', 'src'].flatMap((d) => fs.readdirSync(d).filter((f) => f.endsWith('.js')).map((f) => path.join(d, f)))
  .filter((f) => !/icons\.js$|badgeicons|dexicons|clothicons|stoneicons|logo|model-|data\.js$|stonelogo|punktext/.test(f));
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/(['`])((?:<(?:path|circle|rect|ellipse|g)\b[^'`$]*?)+)\1/g)) {
    if (!/viewBox|^<(path|circle|rect|ellipse)/.test(m[2])) continue;
    const key = s.slice(Math.max(0, m.index - 40), m.index).match(/([\w-]+)\s*[:=(]\s*$/)?.[1] || '';
    left.push({ id: path.basename(f, '.js') + ':' + key, svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${m[2]}</svg>` });
  }
}
// 3. 뱃지
const B = await import(path.join(ROOT, 'src/badgeicons.js'));
const badges = Object.entries(B.BADGE_ICONS).map(([id, inner]) => ({ id, svg: `<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#6b7f4a"/>${inner}</svg>` })); // 원 색은 업적마다 다름(여기선 한 색)

const cell = (o, cls = '') => `<figure class="${cls}"><span>${o.svg}</span><figcaption>${esc(o.id)}${o.src ? `<i>${esc(o.src)}</i>` : ''}</figcaption></figure>`;
const page = (sz) => `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:16px;background:#2b2e2a;color:#f3ecdc;font:11px/1.25 system-ui,sans-serif;width:${sz.w}px}
h2{font-size:14px;margin:14px 0 8px;font-weight:700}h2 small{font-weight:400;opacity:.6;margin-left:6px}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(${sz.cell}px,1fr));gap:6px}
figure{margin:0;display:grid;justify-items:center;gap:4px;padding:8px 2px 6px;border-radius:10px;background:rgba(255,255,255,.06)}
figure span{display:flex;gap:8px;align-items:center}
figure svg{width:${sz.a}px;height:${sz.a}px}figure svg+svg{width:${sz.b}px;height:${sz.b}px}
figure.b svg{width:${sz.b * 1.8}px;height:${sz.b * 1.8}px}
figcaption{text-align:center;word-break:break-all;opacity:.8;font-size:10px}figcaption i{display:block;opacity:.55;font-style:normal}
</style>
${set.length ? `<h2>아이콘 세트 src/icons.js<small>${set.length}개 · 크기 ${sz.a}px / ${sz.b}px</small></h2><div class="g">${set.map((o) => cell({ ...o, svg: o.svg + o.svg })).join('')}</div>` : ''}
<h2>손으로 그린 선 그림 (소스에 남은 것)<small>${left.length}개</small></h2><div class="g">${left.map((o) => cell({ ...o, svg: o.svg + o.svg })).join('')}</div>
<h2>업적 뱃지<small>${badges.length}개</small></h2><div class="g">${badges.map((o) => cell(o, 'b')).join('')}</div>`;
fs.mkdirSync('notes/shots', { recursive: true });
const b = await chromium.launch();
for (const [k, sz] of Object.entries({ phone: { w: 390, cell: 76, a: 15, b: 22 }, pc: { w: 1000, cell: 92, a: 18, b: 24 } })) {
  const p = await b.newPage({ viewport: { width: sz.w + 32, height: 600 }, deviceScaleFactor: 1 });
  await p.setContent(page(sz));
  const out = `notes/shots/icons-${name}-${k}.jpg`;
  await p.screenshot({ path: out, fullPage: true, type: 'jpeg', quality: 82 });
  console.log(out, set.length, '세트 ·', left.length, '손 그림 ·', badges.length, '뱃지');
  await p.close();
}
await b.close();
