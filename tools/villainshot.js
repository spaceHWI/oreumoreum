// #291 투기꾼 악당 모습 그림: node build.mjs && node tools/villainshot.js [d|m] → notes/shots/291/*.jpg
// 안 셋(A·B·C)을 플레이어 앞에 나란히 세우고(__oreum.villain.lineup) 동작마다 찍음: 살금살금·두리번·던지기·화들짝·줄행랑·주먹, 밤(손전등), 폰
const { chromium, devices } = require('playwright');
(async () => {
  const M = process.argv[2] === 'm', tag = M ? 'm' : 'd';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext(M ? { ...devices['iPhone 13'] } : { viewport: { width: 1000, height: 600 } }); const p = await ctx.newPage();
  let errs = 0; p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
  const E = (f, a) => p.evaluate(f, a), W = (ms) => p.waitForTimeout(ms);
  const ready = () => p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.goto('file://' + process.cwd() + '/dist/test.html?aa=1#namsongi'); await ready();
  await E(() => { const O = window.__oreum; Object.assign(O.save, { entered: 1, server: 'battle', look: O.save.look || { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1, coins: 50 }); O.persist?.(); });
  await p.reload(); await ready();
  await p.click('#enter').catch(() => {}); await p.click('#srv-go').catch(() => {}); await W(5000);
  await E(() => { try { window.__oreum.look.close(); } catch { /* 없음 */ } document.body.classList.remove('tut'); });
  const set = async (tod) => E((h) => { const O = window.__oreum; O.setTod(h); O.street.go(0, 4); const P = O.player.pos; O.tp(P.x, P.z, O.player.heading, 0.14, 8, 0); O.runner.root.visible = false; }, tod);
  const shot = async (n) => { await W(1200); await p.screenshot({ path: `notes/shots/291/${n}-${tag}.jpg`, type: 'jpeg', quality: 55 }); };
  await set(13); console.log('lineup', await E(() => window.__oreum.villain.lineup('come')));
  await E(() => window.__oreum.runner.root.visible = false); await shot('1-sneak');
  await E(() => window.__oreum.villain.pose('dump', 1.2)); await W(300); await shot('2-look');
  await E(() => window.__oreum.villain.pose('dump', 3.4)); await W(150); await shot('3-windup');
  await E(() => window.__oreum.villain.pose('startle', 0.3)); await shot('4-startle');
  await E(() => window.__oreum.villain.pose('fist')); await shot('5-fist');
  await set(21); await E(() => { window.__oreum.villain.lineup('come'); window.__oreum.runner.root.visible = false; }); await shot('6-night');
  /* 실제 투기꾼 한 명: 와서 두리번 → 던짐(날아가는 자루) → 돌아감, 산타 차림 */
  const r = await E(() => { const O = window.__oreum, V = O.villain; V.clear(); O.setTod(13); if (!V.spawn('A')) return 'no spawn'; const D = O.dumpers.api, d = D.list[D.list.length - 1]; d.hold = 0; d.root.visible = true; d.villain.santa(d);
    let fly = 0, st = []; for (let i = 0; i < 1600 && D.list.includes(d) && d.state !== 'leave'; i++) { D.update(0.1, i / 10); V.state().flying && fly++; if (st[st.length - 1] !== d.state) st.push(d.state); }
    return { st, fly, santa: !!d.santa, bag: d.bag.visible }; });
  console.log('dump', JSON.stringify(r));
  console.log(JSON.stringify(await E(() => window.__oreum.villain.state())), 'errs', errs);
  await b.close();
})();
