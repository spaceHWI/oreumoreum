// 만족한상회 주인 그림 (#279): node tools/manjokowner.js → notes/shots/279/owner-day.jpg · owner-night.jpg
// 가게가 다 열린 저장으로 들어가 평상 앞에서 주인 쪽을 보고 낮(14시)·밤(22시)으로 찍음
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const out = 'notes/shots/279'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 400 } }); let errs = 0; p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
  const W = (ms) => p.waitForTimeout(ms), E = (f, a) => p.evaluate(f, a);
  await p.goto('file://' + process.cwd() + '/dist/test.html?aa=1#namsongi'); await W(5000);
  await E(() => { const o = window.__oreum; Object.assign(o.save, { entered: 1, look: o.save.look || { sex: 'm', skin: 0 }, nickSet: 1, tut: { step: 99, done: true, v: 4 }, jeong: 1, soundOff: 1, mealFree: 1, shopGate: { init: 1, open: { gear: 1, manjok: 1, stone: 1, salon: 1, leap: 1, ride: 1, inn: 1 } } }); const k = ['oreumoreum.v1', 'oreumoreum.dev'].find((k) => localStorage.getItem(k)) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await W(5000); await p.click('#enter').catch(() => {}); await W(4000);
  if (await E(() => !document.getElementById('look').hidden).catch(() => false)) { await p.click('#look-ok').catch(() => {}); await W(800); }
  if (await E(() => { const f = document.getElementById('fs-tip'); return f && !f.hidden; })) await p.click('#fs-tip-x').catch(() => {});
  for (const [n, h] of [['day', 14], ['night', 22]]) {
    await E((h) => { const o = window.__oreum, g = o.quest.givers.get('shop:satis'), t = o.manjok.api.terrace; o.setTod(h); const f = g.face, x = g.pos.x + Math.sin(f) * 2.6, z = g.pos.z + Math.cos(f) * 2.6; o.player.pos.set(x, o.groundAt(x, z), z); o.player.heading = f + Math.PI; o.cam.dist = 4.2; o.cam.yaw = f + 0.5; o.snap(); }, h);
    await W(2500); await p.screenshot({ path: `${out}/owner-${n}.jpg`, type: 'jpeg', quality: 70 });
    console.log('shot', n);
  }
  console.log(errs ? `ERR ${errs}` : 'ok'); await b.close(); process.exit(errs ? 1 : 0);
})();
