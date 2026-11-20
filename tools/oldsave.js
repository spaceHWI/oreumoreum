// 예전·깨진 저장으로 들어와도 오류가 없는지 (#16). node tools/oldsave.js
const { chromium } = require('playwright');
const SAVES = {
  empty: {},
  v0: { nick: '예전 사람', coins: 321, equip: { tool: 3 }, outfit: { hat: { type: 'cap', color: '#222222' } }, owned: { 'shirt:tee:#ff0000': 1 }, totalSteps: 999, nsV1: 1, ach: { done: {} } },
  broken: { nick: '깨진 사람', coins: 'abc', equip: 5, clothes: 3, rides: 'x', trash: { srv: 1, bag: null, dex: 7 }, ach: { daily: 3, life: null, badges: [] }, tut: 'x', look: { sex: 'q', skin: 99 }, hairs: 2, buff: { id: 'nope', left: 5 }, recycle: [], server: 'nope', wishes: null },
  old8: { nick: '8일 전 사람', coins: 777, music: 0, gfx: 'low', lastSeen: Date.now() - 8 * 864e5 },
  midV: { nick: '중간 사람', coins: 1500, equip: { tool: 2, bag: 1, shoes: 2, weapon: 9 }, nsV1: 1, nsV2: 1, nsV3: 1, tut: { step: 4, done: false, v: 2 }, bagV: 1, server: 'battle', trash: { srv: { battle: { sig: 'old', heaps: [1, 2] } }, bag: { can: 3 } } },
};
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  let bad = 0;
  for (const [name, data] of Object.entries(SAVES)) {
    const ctx = await b.newContext({ viewport: { width: 480, height: 300 } }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
    await p.addInitScript((d) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', 1); localStorage.setItem('oreumoreum.dev', d); localStorage.setItem('oreumoreum.v1', d); } }, JSON.stringify(data));
    await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await p.waitForTimeout(8000);
    await p.click('#enter', { timeout: 30000 }).catch(() => {}); await p.waitForTimeout(800);
    await p.evaluate(() => document.querySelector('#intro-srv [data-srv]')?.click()).catch(() => {}); await p.click('#srv-go', { timeout: 3000 }).catch(() => {}); await p.waitForTimeout(5000);
    if (await p.evaluate(() => !document.getElementById('look').hidden).catch(() => false)) { await p.click('#look-ok').catch(() => {}); await p.waitForTimeout(1500); }
    const st = await p.evaluate(() => { const o = window.__oreum; return { frames: o.renderer.info.render.frame, coins: o.save.coins, equip: o.save.equip, tut: o.save.tut?.step, ls: !!o.save.lastSeen, expMsg: !document.getElementById('intro-expired').hidden, g: document.getElementById('guest-days').textContent }; }).catch((e) => ({ fail: e.message.slice(0, 120) }));
    await p.waitForTimeout(2000);
    const f2 = await p.evaluate(() => window.__oreum.renderer.info.render.frame).catch(() => -1);
    console.log(name, JSON.stringify(st), 'frames+', f2 - (st.frames || 0), errs.length ? 'ERR ' + errs.join(' | ') : 'ok');
    if (errs.length || st.fail || !(f2 > (st.frames || 0))) bad++;
    await ctx.close();
  }
  console.log(bad ? `문제 ${bad}` : '모두 통과'); await b.close();
})();
