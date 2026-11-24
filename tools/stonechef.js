// 스톤 셰프 그림 (#299): node tools/stonechef.js [out] → notes/shots/299/chef-front.jpg · chef-side.jpg · chef-close.jpg · chef-far.jpg (멀리서 검게 보이지 않는지)
// 가게가 다 열린 저장으로 들어가 스톤 가게 앞 주인을 앞·옆·가까이에서 낮(14시)에 찍음
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const out = process.argv[2] || 'notes/shots/299'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 400 } }); let errs = 0; p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
  const W = (ms) => p.waitForTimeout(ms), E = (f, a) => p.evaluate(f, a);
  await p.goto('file://' + process.cwd() + '/dist/test.html?aa=1#namsongi'); await W(5000);
  await E(() => { const o = window.__oreum; Object.assign(o.save, { entered: 1, look: o.save.look || { sex: 'm', skin: 0 }, nickSet: 1, tut: { step: 99, done: true, v: 4 }, jeong: 1, soundOff: 1, mealFree: 1, shopGate: { init: 1, open: { gear: 1, manjok: 1, stone: 1, salon: 1, leap: 1, ride: 1, inn: 1 } } }); const k = ['oreumoreum.v1', 'oreumoreum.dev'].find((k) => localStorage.getItem(k)) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await W(5000); await p.click('#enter').catch(() => {}); await W(4000);
  if (await E(() => !document.getElementById('look').hidden).catch(() => false)) { await p.click('#look-ok').catch(() => {}); await W(800); }
  if (await E(() => { const f = document.getElementById('fs-tip'); return f && !f.hidden; })) await p.click('#fs-tip-x').catch(() => {});
  await E(() => window.__oreum.pace?.test?.hold?.());
  if (!(await E(() => !!window.__oreum.quest?.givers?.get('shop:stone')))) { console.log('FAIL 스톤 셰프 없음'); await b.close(); process.exit(1); }
  for (const [n, yaw, dist] of [['front', -0.2, 3.2], ['side', 0.9, 3.0], ['close', -0.25, 1.7], ['far', -0.1, 16]]) {
    await E(([yaw, dist]) => { const o = window.__oreum, g = o.quest.givers.get('shop:stone'), f = g.face; o.setTod(14); o.setWeather?.('clear');
      const x = g.pos.x + Math.sin(f) * (dist + 1.5), z = g.pos.z + Math.cos(f) * (dist + 1.5); o.player.pos.set(x, o.groundAt(x, z), z); o.player.heading = f + Math.PI;
      o.cam.mode = 'free'; const a = f + yaw, gy = g.pos.y, cl = dist < 2.5; o.camObj.position.set(g.pos.x + Math.sin(a) * dist, gy + (cl ? 2.0 : 1.8), g.pos.z + Math.cos(a) * dist); o.camObj.lookAt(g.pos.x, gy + (cl ? 1.75 : 1.25), g.pos.z);
      o.runner.root.visible = false;
      let st = document.getElementById('__sshot'); if (!st) { st = document.createElement('style'); st.id = '__sshot'; document.head.append(st); }
      st.textContent = 'body > *:not(#view){visibility:hidden!important} #view{visibility:visible!important}'; }, [yaw, dist]);
    await W(2500); await p.screenshot({ path: `${out}/chef-${n}.jpg`, type: 'jpeg', quality: 72 });
    console.log('shot', n);
  }
  console.log(errs ? `ERR ${errs}` : 'ok'); await b.close(); process.exit(errs ? 1 : 0);
})();
