// 모아 쏘기 확인 (#129): node tools/charge.js
// dist/test.html 남송이 전투 오름에서 무기마다 큰 기운의 묶인 적(멧돼지)을 12m 앞에 세우고
// F 를 짧게(80ms) 한 번 / 길게(1.4초) 한 번 눌러 적 기운이 준 양(피해)·쓴 귤·밀린 거리를 잼. 시간은 게임 시간
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 400 } });
  const errs = []; p.on('pageerror', (e) => { errs.push(e.message); console.log('ERR', e.message.slice(0, 300)); });
  const url = 'file://' + process.cwd() + '/dist/test.html#namsongi';
  await p.goto(url); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1 }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.click('#enter', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1500);
  await p.evaluate(() => { const o = window.__oreum; o.pace.pacing.test.first.done = true; o.pace.pacing.test.first.bloomed = true; o.setTod(13); o.setWeather('clear'); });
  const gt = () => p.evaluate(() => window.__oreum.weapon.t());
  const waitG = async (sec) => { const t0 = await gt(); while ((await gt()) - t0 < sec) await p.waitForTimeout(30); };
  const res = [];
  for (const tier of [1, 2, 3, 4, 5, 6]) for (const mode of ['짧게', '길게']) {
    await p.evaluate(({ tier }) => {
      const o = window.__oreum; o.enemies.test.clear(); document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; });
      o.save.equip.weapon = 6; o.weapon.use(tier); o.save.coins = 500; o.save.bowAmmo = 0; o.save.ammo = { gun: 0, mg: 0, laser: 0 };
      const x = -60, z = 40; o.player.pos.set(x, o.groundAt(x, z), z); o.player.heading = Math.PI / 2; o.player.knock = null; o.player.pose = 'move';
      const e = o.enemies.test.spawn('boar', 12, 0); e.def = { ...e.def, walk: 0, chase: 0, flee: 9, rootEvery: [999, 999] }; e.hp = e.max = 1e5; e.heading = -Math.PI / 2;
      window.__e = e; window.__home = e.pos.clone(); window.__c0 = o.save.coins; window.__push = 0;
      const loop = () => { const q = window.__e; if (!q) return; window.__push = Math.max(window.__push, Math.hypot(q.pos.x - window.__home.x, q.pos.z - window.__home.z)); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
    }, { tier });
    await waitG(0.4);
    const ms = mode === '짧게' ? 80 : 1400;
    await p.keyboard.down('f'); const st0 = await p.evaluate(() => window.__oreum.charge.state());
    if (mode === '길게') { await waitG(1.4); } else await p.waitForTimeout(ms);
    const st = await p.evaluate(() => ({ ...window.__oreum.charge.state(), pose: window.__oreum.player.pose }));
    await p.keyboard.up('f');
    await waitG(tier === 6 ? 2.6 : 2.0);
    const r = await p.evaluate(() => { const o = window.__oreum, e = window.__e; return { dmg: +(e.max - e.hp).toFixed(1), gyul: window.__c0 - o.save.coins, push: +window.__push.toFixed(2), shots: o.charge.state().shots.slice(-1)[0] }; });
    const row = { 무기: ['손', '활', '총', '머신건', '레이저', '폭탄'][tier - 1], 누름: mode, '모은 정도': st.k, 피해: r.dmg, '쓴 귤': r.gyul, '밀린 m': r.push, 자세: st.pose };
    console.log(JSON.stringify(row)); res.push(row);
  }
  console.table(res);
  console.log(errs.length ? `오류 ${errs.length}` : '오류 없음');
  await b.close();
  process.exit(errs.length ? 1 : 0);
})();
