// 무기 3~6단계 확인 (#123): node tools/arms.js [shot]
// dist/test.html 남송이 전투 오름에서 무기마다 적(멧돼지·외계인)을 불러 쫓아내는 시간·쓴 귤·쏜 수를 잼. 적은 움직이지 않게(쏘지도 않게) 묶음
// 시간은 게임 시간(느린 헤드리스에서도 실제 초). 머신건·레이저는 F 를 누르고 있음, 총·활·폭탄은 cd 마다 F. shot 을 주면 무기마다 쏘는 순간을 /tmp/claude-0/shots/arms-*.png 로
const { chromium } = require('playwright');
const SHOT = process.argv[2] === 'shot', OUT = process.env.SHOTS || '/tmp/claude-0/shots/';
if (SHOT) require('fs').mkdirSync(OUT, { recursive: true });
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
  const res = [];
  for (const [kind, tiers] of [['boar', [1, 2, 3, 4, 5, 6]], ['alien', [3, 4, 5, 6]]]) for (const tier of tiers) {
    await p.evaluate(({ tier, kind }) => {
      const o = window.__oreum; o.enemies.test.clear(); document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; });
      o.save.equip.weapon = 6; o.weapon.use(tier); o.save.coins = 5000; o.save.bowAmmo = 0; o.save.ammo = { gun: 0, mg: 0, laser: 0 };
      const x = -60, z = 40; o.player.pos.set(x, o.groundAt(x, z), z); o.player.heading = Math.PI / 2; o.player.knock = null;
      // 적을 앞 12m 에 세우고 움직이지 않게 (쏘지도 않게)
      const e = o.enemies.test.spawn(kind, 12, 0); e.def = { ...e.def, walk: 0, chase: 0, flee: 9, rootEvery: [999, 999], ...(e.def.ranged ? { ranged: { ...e.def.ranged, every: 999 } } : {}) }; e.heading = -Math.PI / 2; e.shotT = 999;
      window.__t0 = o.weapon.t(); window.__c0 = o.save.coins;
    }, { tier, kind });
    const hold = tier === 4 || tier === 5, gap = { 1: 650, 2: 650, 3: 720, 6: 2050 }[tier];
    let done = null, fired = 0, shot = false, next = 0;
    if (hold) await p.keyboard.down('f');
    for (let i = 0; i < 600 && !done; i++) {
      const now = await p.evaluate(() => window.__oreum.weapon.t() - window.__t0);
      if (now > 60) break;
      if (!hold && now >= next) { await p.keyboard.press('f'); fired++; next = now + gap / 1000; }
      await p.waitForTimeout(60);
      if (SHOT && !shot && now > 0.35) { shot = true; await p.screenshot({ path: `${OUT}arms-${kind}-${tier}.png` }); }
      done = await p.evaluate(() => { const o = window.__oreum, e = o.enemies.list[0]; return !e || e.state === 'flee' ? { t: o.weapon.t() - window.__t0, gy: window.__c0 - o.save.coins } : null; });
    }
    if (hold) await p.keyboard.up('f');
    const info = await p.evaluate(() => { const o = window.__oreum; return { w: o.weapon.now(), hp: o.enemies.list[0]?.hp, pose: o.player.pose, fx: { shots: o.weapon.fx.shots.length, bombs: o.weapon.fx.bombs.length } }; });
    console.log(kind, tier, done ? done.t.toFixed(1) + '초' : '못 함', info.hp);
    res.push({ 적: kind, 무기: info.w, '쫓아냄(초)': done ? +done.t.toFixed(1) : '못 함', '쓴 귤': done ? done.gy : '-', 누름: hold ? '계속' : fired, '남은 기운': done ? 0 : info.hp });
  }
  console.table(res);
  // 무기 창·▾ 버튼
  const ui = await p.evaluate(() => { const o = window.__oreum; o.weapon.open(); const n = document.querySelectorAll('#armwin-cards .menu-card').length, on = document.querySelector('#armwin-cards .menu-card.on b')?.textContent; document.getElementById('armwin').hidden = true; return { cards: n, on, more: !document.getElementById('arm-more').hidden, ammo: document.getElementById('ammo').className }; });
  console.log('창', JSON.stringify(ui));
  console.log(errs.length ? `오류 ${errs.length}` : '오류 없음');
  await b.close(); process.exit(errs.length ? 1 : 0);
})();
