// #174 마차·정류장·가로등 확인: node tools/cartshot.js [이름] → /tmp/claude-0/shots/<이름>-cart-day.png · -cart-night.png · -stop.png · -lamps.png
// 마차 한 대의 메시 수(그리기)·삼각형 수, 가로등 어긋남(앞 → 뒤)·당긴 수를 출력
const { chromium } = require('playwright');
const fs = require('fs');
const TAG = process.argv[2] || 'now', OUT = process.env.SHOTS || '/tmp/claude-0/shots/'; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  p.on('pageerror', (e) => console.log('ERR', e.message.slice(0, 300)));
  await p.goto('file://' + process.cwd() + '/dist/test.html' + (process.env.HI ? '?hi' : '') + '#namsongi'); await p.waitForTimeout(6000);
  await p.click('#enter').catch(() => {}); await p.click('#intro-srv button[data-srv="battle"]').catch(() => {}); await p.click('#srv-go').catch(() => {}); await p.waitForTimeout(6000);
  await p.waitForFunction(() => { const a = window.__oreum.assets; return !a || a.done >= a.total; }, null, { timeout: 120000 }).catch(() => {});
  const info = await p.evaluate(() => {
    const O = window.__oreum, c = O.rides.cart.api; let meshes = 0, tris = 0;
    c.mesh.traverse((o) => { if (o.isMesh && o.visible) { meshes++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
    const A = O.lampAim, st = (a) => a && { n: a.length, over30: a.filter((d) => d > 30).length, over90: a.filter((d) => d > 90).length, mean: +(a.reduce((s, d) => s + d, 0) / (a.length || 1)).toFixed(1), max: +Math.max(...a).toFixed(1) };
    const st2 = document.createElement('style'); st2.textContent = 'body > *:not(canvas){display:none!important}'; document.head.append(st2);
    return { meshes, tris: Math.round(tris), lamps: A && { before: st(A.before), after: st(A.after), moved: A.moved } };
  });
  console.log(JSON.stringify(info));
  const shot = async (nm, tod, setup) => {
    await p.evaluate(([tod, setup]) => { const O = window.__oreum; O.setTod(tod); O.setWeather('clear'); O.cam.mode = 'free'; new Function('O', setup)(O); }, [tod, setup]);
    await p.waitForTimeout(1800); await p.screenshot({ path: `${OUT}${TAG}-${nm}.png` });
  };
  // 마차를 정류장 1(능선 입구)에 세우고 옆·앞 비스듬히
  await p.evaluate(() => { const O = window.__oreum, t = O.rides.cart.at(1); O.rides.cart.shift(t); });
  const camAt = `const t0 = O.rides.cart.at(1); O.rides.cart.shift(t0); O.rides.cart.api.update(0, Date.now() / 1000 + t0, null, 0); const c = O.rides.cart.api, h = c.heading, s = Math.sin(h), co = Math.cos(h), k = O.camObj, P = c.pos; O.player.pos.set(P.x + co * 14, P.y, P.z - s * 14);
    const ex = P.x + co * 7 + s * 6, ez = P.z - s * 7 + co * 6; k.fov = 40; k.updateProjectionMatrix(); k.position.set(ex, P.y + 3.2, ez); k.lookAt(P.x + s * 1.2, P.y + 1.6, P.z + co * 1.2);`;
  await shot('cart-day', 13, camAt);
  await shot('cart-back', 13, camAt.replace('co * 7 + s * 6', 'co * 5 - s * 7').replace('- s * 7 + co * 6', '- s * 5 - co * 7'));
  await shot('cart-night', 21.5, camAt);
  await shot('stop', 13, `const S = O.rides.cart.api.stops[0], g = S.g, k = O.camObj; O.player.pos.set(S.pos.x + 12, S.pos.y, S.pos.z); g.updateMatrixWorld(true); const f = new O.charKit.THREE.Vector3(2.5, 2.2, 6).applyMatrix4(g.matrixWorld), l = new O.charKit.THREE.Vector3(0, 1.1, 0).applyMatrix4(g.matrixWorld); k.fov = 40; k.updateProjectionMatrix(); k.position.copy(f); k.lookAt(l);`);
  // 밤의 가로등 길: 들머리 길 위에서 앞을 봄
  await shot('lamps', 21.5, `const L = O.lamps.points, i = Math.min(4, L.length - 1), a = L[i], k = O.camObj; O.player.pos.set(a.x + 3, a.y, a.z + 3); k.fov = 55; k.updateProjectionMatrix(); k.position.set(a.x + 9, a.y + 7, a.z + 9); k.lookAt(a.x, a.y, a.z);`);
  await b.close();
})();
