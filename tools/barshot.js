// #316 Bar 소설 그림 (겉 낮·밤·주인·가게 창·앉아 읽는 모습, PC·폰): node build.mjs && node tools/barshot.js [pc|phone] → notes/shots/316/
const { chromium, devices } = require('playwright');
const OUT = 'notes/shots/316';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const mode = process.argv[2] || 'pc'; require('fs').mkdirSync(OUT, { recursive: true });
  const ctx = await b.newContext(mode === 'phone' ? { ...devices['iPhone 13'] } : { viewport: { width: 960, height: 600 } }), p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message.slice(0, 200)));
  const E = (f, a) => p.evaluate(f, a), W = (ms) => p.waitForTimeout(ms);
  const ready = () => p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi?aa=1'); await ready();
  await E(() => { const O = window.__oreum; Object.assign(O.save, { entered: 1, server: 'battle', look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1, coins: 5000, shopGate: { init: 1, open: { gear: 1, manjok: 1, stone: 1, salon: 1, leap: 1, ride: 1, inn: 1, bar: 1 } } }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum.v')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(O.save)); });
  await p.reload(); await ready(); await p.click('#enter').catch(() => {}); await W(5000);
  await E(() => { for (const id of ['fs-tip']) { const el = document.getElementById(id); if (el) el.hidden = true; } });
  for (const [n, tod] of ('day:13,night:22.5').split(',').map((x) => x.split(':'))) {
    await E(([tod]) => { const O = window.__oreum, A = O.bar.api, d = A.door, h = A.rot + Math.PI; O.setTod(+tod); const x = d.x - Math.sin(h) * 2.2, z = d.z - Math.cos(h) * 2.2; O.tp(x, z, h, 0.22, 7.5, 0.45); }, [tod]);
    await W(3500);
    const dc = await E(async () => { const O = window.__oreum, r = O.bar.api.root, sl = (ms) => new Promise((k) => setTimeout(k, ms)), c = () => O.renderer.info.render.calls; const a = c(); r.visible = false; await sl(1200); const b = c(); r.visible = true; await sl(1200); return `${a} (바 빼면 ${b}, 바 ${a - b})`; });
    await p.screenshot({ path: `${OUT}/bar-${mode}-${n}.jpg`, type: 'jpeg', quality: 60, timeout: 150000 });
    console.log(n, 'draw', dc);
  }
  await E(() => { const O = window.__oreum; O.setTod(22.5); O.bar.night(true); O.bar.go(); O.bar.open(); }); await W(1500);
  await p.screenshot({ path: `${OUT}/bar-${mode}-pop.jpg`, type: 'jpeg', quality: 60, timeout: 150000 });
  await E(() => { document.getElementById('shoppop').hidden = true; window.__oreum.bar.order(); }); await W(4000);
  await p.screenshot({ path: `${OUT}/bar-${mode}-read.jpg`, type: 'jpeg', quality: 60, timeout: 150000 });
  await b.close();
})();
