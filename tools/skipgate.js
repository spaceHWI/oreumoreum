/* #302 다 건너뛰기 → 정낭 열림·칸 정낭 열림·저장. node tools/skipgate.js */
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  p.on('pageerror', (e) => { fails++; console.log('ERR', e.message.slice(0, 200)); });
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await p.waitForTimeout(6000);
  await p.click('#enter').catch(() => {}); await p.waitForTimeout(4000);
  if (await p.evaluate(() => !document.getElementById('look').hidden)) { await p.click('#look-ok'); await p.waitForTimeout(1500); }
  await p.evaluate(() => window.__oreum.tut.skipAll()); await p.waitForTimeout(1000);
  const s = await p.evaluate(() => { const o = window.__oreum; return { done: o.save.tut.done, jeong: o.save.jeong, open: o.jeong.isOpen, pens: !!o.tut.pens(), cells: o.tut.cells().map((c) => c.open), shop: o.tut.shopGate()?.open }; });
  ok(s.done && s.jeong === 1 && s.open, '건너뛰면 끝남·정낭 열림·저장');
  ok(!s.pens && s.cells.every(Boolean) && s.shop, '칸 정낭·가게 쪽 정낭도 열림, 칸 담 없어짐');
  await b.close(); console.log(fails ? 'FAIL' : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
