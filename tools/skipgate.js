// #302 '다 건너뛰기' → 정낭이 다 열림 → 새로고침해도 열림. node build.mjs && node tools/skipgate.js [d|m]
const { chromium, devices } = require('playwright');
const mode = process.argv[2] || 'd'; let fails = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext(mode === 'm' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } }); const p = await ctx.newPage(); let errs = 0;
  p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 200)); });
  const W = (ms) => p.waitForTimeout(ms), ev = (f, a) => p.evaluate(f, a);
  const boot = async () => { await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await W(6000); await p.click('#enter').catch(() => {}); await W(4000); if (await ev(() => !document.getElementById('look').hidden)) { await p.click('#look-ok').catch(() => {}); await W(1500); } await ev(() => window.__oreum.setTod(14)); };
  const st = () => ev(() => { const o = window.__oreum; return { open: o.jeong.isOpen, sj: o.save.jeong, done: !!o.save.tut?.done, pens: !!o.tut.pens(), active: o.tut.active }; });
  await boot();
  let s = await st(); ok(!s.open && !s.done && s.pens, '처음엔 정낭이 닫혀 있고 칸 담이 있음');
  await ev(() => window.__oreum.tut.skipAll()); await W(1500);
  s = await st(); ok(s.open && s.sj === 1 && s.done && !s.pens && !s.active, `건너뛰면 정낭 열림·칸 담 사라짐·튜토리얼 끝 ${JSON.stringify(s)}`);
  await boot(); s = await st(); ok(s.open && s.sj === 1 && s.done && !s.pens, `새로고침해도 열려 있음 ${JSON.stringify(s)}`);
  const r = await ev(async () => { const o = window.__oreum, g = o.spots.tut?.beyond; if (!g) return null; const a = o.spots.tut.gate || g; const from = { x: g.x, z: g.z }; o.player.pos.set(from.x, o.groundAt(from.x, from.z), from.z); o.snap(); await new Promise((r) => setTimeout(r, 800)); return { x: o.player.pos.x, z: o.player.pos.z, x0: from.x, z0: from.z, hit: !!o.col }; });
  ok(!!r, '정낭 너머 자리에 설 수 있음');
  ok(errs === 0, `페이지 오류 ${errs}`);
  console.log(fails ? `FAIL ${fails}` : 'ALL OK'); await b.close(); process.exit(fails ? 1 : 0);
})();
