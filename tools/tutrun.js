// 튜토리얼 처음부터 끝까지 (#62): 단계마다 화면을 찍는다. node tools/tutrun.js [d|m]  → dist/tut-<d|m>-<n>.jpg
const { chromium, devices } = require('playwright');
const mode = process.argv[2] || 'd';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext(mode === 'm' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage(); let errs = 0;
  p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
  const W = (ms) => p.waitForTimeout(ms);
  const shot = async (n) => { await p.screenshot({ path: `dist/tut-${mode}-${n}.jpg`, type: 'jpeg', quality: 62, timeout: 150000 }); console.log('shot', n, await state()); };
  const state = () => p.evaluate(() => { const o = window.__oreum; return JSON.stringify({ step: o.tut.step, s: o.save.tut.step, hits: o.save.tut.hits, gyul: o.save.tut.gyul, coins: o.save.coins, tool: o.save.equip.tool, bag: o.save.equip.bag, focus: o.tut.focus()?.id || o.tut.focus()?.className || null }); });
  const go = (x, z, lookAt) => p.evaluate(([x, z, l]) => { const o = window.__oreum; o.player.pos.set(x, o.groundAt(x, z), z); o.player.target = null; if (l) o.player.heading = Math.atan2(l[0] - x, l[1] - z); o.snap(); }, [x, z, lookAt]);
  const T = () => p.evaluate(() => { const t = window.__oreum.spots.tut; const v = (q) => q && [q.x, q.z]; return { walk: v(t.walk), run: v(t.run), gyul: t.gyul.map(v), target: v(t.target), trash: t.trash.map(v), beyond: v(t.beyond), gate: v(t.gate) }; });
  const press = async (k, ms = 80) => { await p.keyboard.down(k); await W(ms); await p.keyboard.up(k); };
  const until = async (fn, ms = 8000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg)) return true; await W(200); } return false; };
  const hold = async (k, fn, ms = 8000, arg) => { await p.keyboard.down(k); const ok = await until(fn, ms, arg); await p.keyboard.up(k); await until(() => !window.__oreum.trash.state().picking, 4000); return ok; };
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await W(6000);
  await p.click('#enter').catch(() => {}); await W(4000);
  await p.evaluate(() => window.__oreum.setTod(14));
  if (await p.evaluate(() => !document.getElementById('look').hidden)) { await shot('01-look'); await p.click('#look-ok'); await W(1500); }
  const t = await T();
  const lerp = (a, c, k) => [a[0] + (c[0] - a[0]) * k, a[1] + (c[1] - a[1]) * k];
  await W(1500); await shot('02-walk');
  // 벽 확인: 걷기 전에 앞으로 밀면 막히는가
  const blocked = await p.evaluate(() => { const o = window.__oreum, w = o.tut.walls[0]; return w && o.col.blocked(w.L.c.x, w.L.c.z, 0.3); });
  console.log('wall0 blocked', blocked);
  await go(...t.walk, t.run); await W(1200); await shot('03-run');
  await press('Shift'); await go(...t.run, t.gyul[0]); await W(1200); await press('Shift');
  await go(...lerp(t.run, t.gyul[0], 0.75), t.gyul[0]); await W(1200); await shot('04-gyul');
  for (let i = 0; i < t.gyul.length; i++) { const g = t.gyul[i]; await go(g[0] + 0.6, g[1] + 0.3, g); await W(300); console.log('gyul', i, await hold('e', (n) => window.__oreum.save.tut.gyul.length > n || window.__oreum.save.tut.step > 2, 20000, i)); }
  await W(800);
  const tp = lerp(t.gyul[2], t.target, 0.35);
  await go(...tp, t.target); await W(1500); await shot('05-throw');
  for (let i = 0; i < 6 && !(await p.evaluate(() => window.__oreum.save.tut.step > 3)); i++) { const h = await p.evaluate(() => window.__oreum.save.tut.hits); await press('f'); await until((h) => window.__oreum.save.tut.hits > h, 12000, h); await until(() => window.__oreum.player.pose !== 'throw', 6000); await W(300); if (i === 0) await shot('05b-throw-hit'); console.log('hits', h, '->', await p.evaluate(() => window.__oreum.save.tut.hits)); }
  await W(1000);
  // 쓰레기 6개
  await go(...lerp(t.trash[0], t.target, 0.25), t.trash[0]); await W(1200); await shot('06-pick');
  for (let i = 0; i < t.trash.length; i++) { const g = t.trash[i]; await go(g[0] + 0.5, g[1] + 0.4, g); await W(300); const v0 = await p.evaluate(() => window.__oreum.trash.state().vol); await hold('e', (v) => window.__oreum.trash.state().vol > v, 20000, v0); await until(() => window.__oreum.save.tut.step > 4, 300); }
  console.log('after trash', await state());
  await W(1200); await shot('07-dump-go');
  await p.evaluate(() => window.__oreum.cleanhouse.go()); await W(1500); await shot('07b-dump');
  await press('f'); await until(() => window.__oreum.save.tut.step >= 6, 15000); await W(600); await shot('08-bonus'); await until(() => window.__oreum.save.tut.step >= 7, 90000);
  await p.evaluate(() => { const o = window.__oreum, c = o.cleanhouse.api.shopFront; o.player.pos.set(c.x + 3, o.groundAt(c.x + 3, c.z), c.z); o.snap(); }); await W(1200); await shot('09-tongs');
  await p.evaluate(() => { const o = window.__oreum, c = o.cleanhouse.api.shopFront; o.player.pos.set(c.x, o.groundAt(c.x, c.z), c.z); }); await W(800); await press('f'); await W(1200); await shot('09b-tongs-shop');
  await p.click('#shop-body .tier-buy'); await until(() => window.__oreum.save.tut.step >= 8, 30000); await W(1500); await shot('10-bag-shop');
  await p.click('#shop-tabs [data-tab="bag"]'); await W(800); await shot('10b-bag-buy');
  await p.click('#shop-body .tier-buy'); await until(() => window.__oreum.save.tut.step >= 9, 30000); await W(1200); await p.click('#shop-close'); await W(2500); await shot('11-gate');
  await go(...t.beyond); await until(() => window.__oreum.save.tut.done, 30000); await W(1500); await shot('12-done');
  console.log('errors', errs, 'done', await p.evaluate(() => window.__oreum.save.tut.done));
  await b.close();
})();
