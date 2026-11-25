// 한 계정 한 접속 (#303) 화면 검사: node tools/bumprun.js
// 밀려난 쪽 창이 뜨고(그리기 멈춤·쉬는 화면이 깨우지 않음) [여기서 다시 하기] 로 닫히는지. 폰·PC. 서버 쪽은 tools/sec.js
const { chromium } = require('playwright');
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [tag, vp] of [['PC', { width: 960, height: 600 }], ['폰', { width: 390, height: 760, isMobile: true, hasTouch: true }]]) {
    const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
    await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi');
    await p.waitForFunction(() => window.__oreum?.bump, null, { timeout: 60000 });
    await p.click('#enter').catch(() => {}); await p.waitForTimeout(4000);
    await p.evaluate(() => window.__oreum.bump.show());
    await p.waitForTimeout(300);
    const s1 = await p.evaluate(() => { const r = document.querySelector('#bump').getBoundingClientRect(), g = document.querySelector('#bump-go').getBoundingClientRect(); return { vis: !document.querySelector('#bump').hidden && r.width > 0, btnIn: g.left >= 0 && g.right <= innerWidth && g.bottom <= innerHeight, txt: document.querySelector('#bump-t').textContent, st: window.__oreum.bump.state() }; });
    ok(s1.vis && s1.st.on && /다른 브라우저/.test(s1.txt), `[${tag}] 밀려난 창이 뜸`);
    ok(s1.btnIn, `[${tag}] [여기서 다시 하기] 버튼이 화면 안`);
    await p.evaluate(() => window.__oreum.idle?.set({ warn: 0.2, rest: 0.4, hidden: 0.4 }));
    await p.waitForTimeout(1200);
    ok(await p.evaluate(() => window.__oreum.idle.state().mode !== 'rest'), `[${tag}] 밀려난 동안 쉬는 화면이 끼어들지 않음`);
    if (tag === '폰') await p.screenshot({ path: 'notes/shots/303-bump.png', scale: 'css' });
    await p.click('#bump-go'); await p.waitForTimeout(600);
    const s2 = await p.evaluate(() => ({ hidden: document.querySelector('#bump').hidden, st: window.__oreum.bump.state() }));
    ok(s2.hidden && !s2.st.on, `[${tag}] 다시 하기를 누르면 창이 닫힘`);
    await p.evaluate(() => window.__oreum.idle?.set({ warn: 600, rest: 900, hidden: 900 }));
    ok(!errs.length, `[${tag}] 페이지 오류 0 ${errs.join(' | ')}`);
    await ctx.close();
  }
  await b.close();
  console.log(bad ? `FAIL ${bad}` : 'ALL OK'); process.exit(bad ? 1 : 0);
})();
