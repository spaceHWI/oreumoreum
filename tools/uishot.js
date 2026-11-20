// UI 스크린샷. 기본: 폰 세로 4장 (dist/u-m0~3.png)
// node tools/uishot.js both  → 폰 세로(390x844)·가로(844x390) 두 벌로 주요 화면 (#105): dist/u-p-*.png, dist/u-l-*.png
//   첫 화면·캐릭터 고르기·튜토리얼·게임·메뉴·스톤·미장원·LEAP·탈것·랭킹·의견·사진, 그리고 돌려서(세로→가로) 바로 맞는지
const { chromium, devices } = require('playwright');
const BOTH = process.argv[2] === 'both';
const LA = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const URL = 'file://' + process.cwd() + '/dist/test.html#namsongi';
async function legacy(b) {
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto(URL); await p.waitForTimeout(5000);
  await p.screenshot({ path: 'dist/u-m0.png', timeout: 150000 });
  await p.click('#enter').catch(() => {}); await p.waitForTimeout(1500);
  await p.evaluate(() => { const o = window.__oreum; o.setTod(15); o.save.tut.done = true; document.body.classList.remove('tut'); const h = document.getElementById('tut-toast'); if (h) h.hidden = true; });
  await p.waitForTimeout(4000); await p.screenshot({ path: 'dist/u-m1.png', timeout: 150000 });
  await p.click('#btn-menu'); await p.waitForTimeout(1200); await p.screenshot({ path: 'dist/u-m2.png', timeout: 150000 });
  await p.evaluate(() => { document.getElementById('menu').hidden = true; document.getElementById('ach-chip').click(); }); await p.waitForTimeout(1200); await p.screenshot({ path: 'dist/u-m3.png', timeout: 150000 });
  await ctx.close();
}
// 화면 밖으로 넘친 보이는 요소(창·버튼)를 찾아 알림
const overflow = (p) => p.evaluate(() => {
  const W = innerWidth, H = innerHeight, bad = [];
  for (const el of document.querySelectorAll('.pop, .panel, button, #look .look-card, .intro-card, #joy, .pad > *')) {
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    // 스크롤되는 부모 안이면 그 부모 기준
    let sp = el.parentElement, clip = null;
    while (sp && sp !== document.body) { const o = getComputedStyle(sp).overflowY; if (o === 'auto' || o === 'scroll') { clip = sp; break; } sp = sp.parentElement; }
    if (clip) continue;
    if (r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1) bad.push(`${el.id || el.className || el.tagName}`.slice(0, 40) + ` [${r.left | 0},${r.top | 0},${r.right | 0},${r.bottom | 0}]`);
  }
  return bad.slice(0, 8);
});
async function both(b) {
  const sets = { p: { width: 390, height: 844 }, l: { width: 844, height: 390 } };
  for (const [n, vp] of Object.entries(sets)) {
    const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: vp, deviceScaleFactor: 1 });
    const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('ERR', n, e.message));
    const shot = async (k) => { await p.waitForTimeout(900); await p.screenshot({ path: `dist/u-${n}-${k}.png`, timeout: 150000 }); const o = await overflow(p); console.log(n, k, o.length ? '넘침 ' + o.join(' | ') : 'ok'); };
    await p.goto(URL); await p.waitForTimeout(6000); await shot('0intro');
    await p.click('#enter').catch(() => {}); await p.waitForTimeout(2500);
    if (await p.evaluate(() => !document.getElementById('look').hidden)) { await shot('1look'); await p.click('#look-ok').catch(() => {}); await p.waitForTimeout(2500); }
    if (await p.evaluate(() => document.body.classList.contains('tut'))) await shot('2tut');
    await p.evaluate(() => { const o = window.__oreum; o.setTod?.(15); o.save.tut.done = true; o.save.coins = 500; document.body.classList.remove('tut'); for (const id of ['tut-toast', 'tut-skip', 'tut-focus']) { const h = document.getElementById(id); if (h) h.hidden = true; } });
    await p.waitForTimeout(2500); await shot('3game'); console.log(n, '화면', JSON.stringify(await p.evaluate(() => window.__oreum.screen())));
    await p.click('#btn-menu').catch(() => {}); await shot('4menu');
    await p.evaluate(() => { document.getElementById('menu').hidden = true; });
    for (const k of ['stone', 'salon', 'leap', 'ride']) {
      const ok = await p.evaluate((k) => { const o = window.__oreum; o.street?.open?.(k); return !document.getElementById('shoppop').hidden; }, k);
      if (ok) { await shot('5' + k); await p.evaluate(() => { document.getElementById('shoppop').hidden = true; }); } else console.log(n, k, '못 엶');
    }
    await p.evaluate(() => document.getElementById('menu-rank').click()); await shot('6rank'); await p.evaluate(() => { document.getElementById('rank').hidden = true; });
    await p.evaluate(() => document.getElementById('menu-feedback').click()); await shot('7feedback'); await p.evaluate(() => { document.getElementById('feedback').hidden = true; });
    await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 1200; c.height = 900; const g = c.getContext('2d'); g.fillStyle = '#7a9'; g.fillRect(0, 0, 1200, 900); document.getElementById('photo-img').src = c.toDataURL(); document.getElementById('photo').hidden = false; });
    await shot('8photo'); await p.evaluate(() => { document.getElementById('photo').hidden = true; });
    // 돌리기: 다시 불러오지 않고 바로 맞는지
    const fov0 = await p.evaluate(() => window.__oreum.screen().fov);
    await p.setViewportSize({ width: vp.height, height: vp.width }); await p.waitForTimeout(1500);
    const fov1 = await p.evaluate(() => window.__oreum.screen().fov);
    await shot('9rot'); console.log(n, '돌림 fov', fov0, '→', fov1);
    await ctx.close();
  }
}
(async () => {
  const b = await chromium.launch({ args: LA });
  await (BOTH ? both(b) : legacy(b));
  await b.close();
})();
