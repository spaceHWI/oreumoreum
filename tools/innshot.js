// #270 숙소 건물 그림 (낮·밤·폰): node build.mjs && node tools/innshot.js [out 폴더]  → notes/shots/270/
const { chromium, devices } = require('playwright');
const OUT = process.argv[2] || 'notes/shots/270';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [mode, opt] of [['pc', { viewport: { width: 960, height: 600 } }], ['phone', { ...devices['iPhone 13'], isMobile: true }]]) {
    const ctx = await b.newContext(opt), p = await ctx.newPage(); let errs = 0;
    p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 200)); });
    const E = (f, a) => p.evaluate(f, a), W = (ms) => p.waitForTimeout(ms);
    const ready = () => p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
    await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await ready();
    await E(() => { const O = window.__oreum; Object.assign(O.save, { entered: 1, server: 'battle', look: O.save.look || { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1, coins: 5000, shopGate: { init: 1, open: { gear: 1, manjok: 1, stone: 1, salon: 1, leap: 1, ride: 1, inn: 1 } } }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum.v')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(O.save)); });
    await p.reload(); await ready(); await p.click('#enter').catch(() => {}); await W(5000);
    await E(() => { for (const id of ['fs-tip']) { const el = document.getElementById(id); if (el) el.hidden = true; } });
    for (const [n, tod] of [['day', 13], ['night', 22.5]]) {
      await E(([tod]) => { const O = window.__oreum, A = O.inn.api, d = A.door, h = A.rot + Math.PI; O.setTod(tod); const x = d.x - Math.sin(h) * 5, z = d.z - Math.cos(h) * 5; O.tp(x, z, h, 0.12, 15); }, [tod]);
      await W(4000);
      const dc = await E(async () => { const O = window.__oreum, r = O.inn.api.root, sl = (ms) => new Promise((k) => setTimeout(k, ms)), c = () => O.renderer.info.render.calls; const a = c(); r.visible = false; await sl(1500); const b = c(); r.visible = true; await sl(1500); return `${a} (숙소 빼면 ${b}, 숙소 ${a - b})`; });
      await p.screenshot({ path: `${OUT}/inn-${mode}-${n}.jpg`, type: 'jpeg', quality: 70, timeout: 150000 });
      console.log(mode, n, 'draw calls', dc);
    }
    console.log(mode, '페이지 오류', errs);
    await ctx.close();
  }
  await b.close();
})();
