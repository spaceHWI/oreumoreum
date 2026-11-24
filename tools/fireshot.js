// #290 불멍 그림: node build.mjs && node tools/fireshot.js [d|m] → notes/shots/290-fire-{day,night}-{d,m}.jpg (숙소를 열고 화로 앞에서 앉아 낮·밤)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const M = process.argv[2] === 'm'; const { devices } = require('playwright'); const ctx = await b.newContext(M ? { ...devices['iPhone 13'] } : { viewport: { width: 1000, height: 600 } }); const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message.slice(0, 300)));
  const E = (f, a) => p.evaluate(f, a), W = (ms) => p.waitForTimeout(ms);
  await p.goto('file://' + process.cwd() + '/dist/test.html?aa=1#namsongi');
  await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await E(() => { const O = window.__oreum; Object.assign(O.save, { entered: 1, server: 'battle', look: O.save.look || { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1, coins: 5000 }); O.save.journey = { ...(O.save.journey || {}), maxZ: 3 }; O.persist?.(); });
  await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.click('#enter').catch(() => {}); await p.click('#srv-go').catch(() => {}); await W(5000);
  await E(() => { try { window.__oreum.look.close(); } catch {} document.body.classList.remove('tut'); });
  await E(() => window.__oreum.shopGate.open('inn')); await W(3000);
  console.log(await E(() => window.__oreum.fire.go()));
  await W(1500);
  console.log(JSON.stringify(await E(() => { const O = window.__oreum; return { st: O.fire.state(), ctx: O.aim.ctx(), sess: O.state?.sessionOn, pose: O.player.pose, cam: O.camObj.position.distanceTo(O.fire.api.center), tut: !!O.tut?.active, down: O.hp.isDown }; })));
  console.log(await E(() => window.__oreum.fire.sit()));
  await W(3000);
  console.log(JSON.stringify(await E(() => window.__oreum.fire.state())));
  const tag = M ? 'm' : 'd';
  await E(() => window.__oreum.setTod(13)); await W(1500);
  await p.screenshot({ path: `notes/shots/290-fire-day-${tag}.jpg`, type: 'jpeg', quality: 55 });
  await E(() => window.__oreum.setTod(21)); await W(2000);
  await p.screenshot({ path: `notes/shots/290-fire-night-${tag}.jpg`, type: 'jpeg', quality: 55 });
  await E(() => window.__oreum.fire.stand()); await W(500); await E(() => window.__oreum.fire.go()); await W(1500);
  await p.screenshot({ path: `dist/fireshot-stand-${tag}.jpg`, type: 'jpeg', quality: 55 });
  await b.close();
})();
