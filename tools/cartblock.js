// #117 마차 부딪힘 확인: 앞·옆·뒤에서 걸어 들어가기, 다가오는 마차에 밀리기, 타고 내리기
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 480, height: 300 } });
  p.on('pageerror', (e) => console.log('ERR', e.message.slice(0, 300)));
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await p.waitForTimeout(6000);
  await p.click('#enter').catch(() => {}); await p.click('#intro-srv button[data-srv="battle"]').catch(() => {}); await p.click('#srv-go').catch(() => {}); await p.waitForTimeout(6000);
  // 여유(clearance) 기록: 플레이어 원과 마차 원 사이 가장 깊이 겹친 값(음수면 뚫음)
  await p.evaluate(() => {
    const O = window.__oreum; O.save.jeong = 1; O.save.tut = { ...(O.save.tut || {}), done: 1 }; O.cam.mode = 'follow';
    try { O.look.close(); } catch { /* 없음 */ }
    document.body.classList.remove('tut'); const h = document.getElementById('tut-toast'); if (h) h.hidden = true;
    window.__clr = 99; window.__dy = 0; window.__freeze = 0;
    const f = () => { if (window.__freeze) O.rides.cart.shift(window.__freeze - Date.now() / 1000); const c = O.rides.cart.api, pl = O.player; if (!pl.cart) { const B = O.rides.cart.block(); for (let k = 0; k < B.length; k += 3) window.__clr = Math.min(window.__clr, Math.hypot(pl.pos.x - B[k], pl.pos.z - B[k + 1]) - B[k + 2] - 0.45); window.__dy = Math.max(window.__dy, Math.abs(pl.pos.y - O.rides.cart.ground(pl.pos.x, pl.pos.z))); } requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
  const res = {};
  // 1) 서 있는 마차에 앞·옆·뒤에서 걸어 들어감 (탭 이동으로 반대편 목표)
  const at = await p.evaluate(() => { const O = window.__oreum, t = O.rides.cart.at(1); window.__freeze = Date.now() / 1000 + t; return t; }); console.log('정류장 시각 앞당김', at);
  for (const [name, lx, lz] of [['앞', 0, 1], ['옆', 1, 0], ['뒤', 0, -1], ['조랑말 옆', 1, 0.75]]) {
    await p.evaluate(([lx, lz]) => {
      const O = window.__oreum, c = O.rides.cart.api, h = c.heading, s = Math.sin(h), co = Math.cos(h), V = O.charKit.THREE.Vector3;
      const cz = lz === 0.75 ? 3.4 : lz > 0 ? 1.5 : 0, w = (u, v) => [c.pos.x + co * u + s * v, c.pos.z - s * u + co * v];
      const dx = lx === 1 ? 1 : 0, dz = lz === 1 ? 1 : lz === -1 ? -1 : 0, ofz = lz === 0.75 ? 3.4 : 0;
      const [ax, az] = w(dx * 6, dz * 7 + ofz + (dz > 0 ? 3 : 0)), [bx, bz] = w(-dx * 6, -dz * 7 + ofz);
      O.keys.clear(); O.tp(ax, az, 0); O.player.target = new V(bx, O.rides.cart.ground(bx, bz), bz); window.__clr = 99; window.__dy = 0;
    }, [lx, lz]);
    for (let i = 0; i < 20; i++) { await p.waitForTimeout(1500); const st = await p.evaluate(() => { const O = window.__oreum, pl = O.player; return { t: !!pl.target, x: +pl.pos.x.toFixed(1), z: +pl.pos.z.toFixed(1), sp: +pl.speed.toFixed(1) }; }); if (process.env.V) console.log(name, JSON.stringify(st)); if (!st.t) break; }
    res[name] = await p.evaluate(() => { const O = window.__oreum, c = O.rides.cart.api, h = c.heading, dx = O.player.pos.x - c.pos.x, dz = O.player.pos.z - c.pos.z; return { clr: +window.__clr.toFixed(2), moving: c.state.moving, end: [+(Math.cos(h) * dx - Math.sin(h) * dz).toFixed(1), +(Math.sin(h) * dx + Math.cos(h) * dz).toFixed(1)] }; });
  }
  // 2) 가는 마차 앞에 서 있기
  const mv = await p.evaluate(() => {
    const O = window.__oreum, c = O.rides.cart.api; O.player.target = null; window.__freeze = 0;
    for (let t = 0; t < 240; t += 0.5) { O.rides.cart.shift(t); c.update(0, Date.now() / 1000 + t); if (c.state.moving && c.state.speed > 2) break; }
    const h = c.heading, x = c.pos.x + Math.sin(h) * 9, z = c.pos.z + Math.cos(h) * 9; O.keys.clear(); O.tp(x, z, h + Math.PI); window.__clr = 99; window.__dy = 0;
    return { speed: +c.state.speed.toFixed(1), x0: x, z0: z };
  });
  await p.waitForTimeout(5000);
  res['다가오는 마차'] = await p.evaluate((m) => { const O = window.__oreum, pl = O.player; return { speed: m.speed, clr: +window.__clr.toFixed(2), dy: +window.__dy.toFixed(2), shoved: +Math.hypot(pl.pos.x - m.x0, pl.pos.z - m.z0).toFixed(1), air: !!pl.air }; }, mv);
  // 3) 타고 내리기
  await p.evaluate(() => { const O = window.__oreum, t = O.rides.cart.at(1); window.__freeze = Date.now() / 1000 + t; });
  await p.waitForTimeout(500);
  res['타기'] = await p.evaluate(() => { const O = window.__oreum; O.rides.cart.goStop(1); O.rides.cart.board(); return !!O.player.cart; });
  await p.waitForTimeout(1000);
  res['내리기'] = await p.evaluate(() => { const O = window.__oreum; window.__clr = 99; O.rides.cart.leave(false); return !O.player.cart; });
  await p.waitForTimeout(1500);
  res['내린 뒤 여유'] = await p.evaluate(() => +window.__clr.toFixed(2));
  res['다가가서 타기'] = await p.evaluate(() => { const O = window.__oreum; O.rides.cart.goCart(); O.rides.cart.board(); const ok = !!O.player.cart; return ok; });
  // 가는 중 뛰어내리기
  await p.evaluate(() => { window.__freeze += 14; }); // 정류장을 떠나 가는 중으로
  await p.waitForTimeout(1500);
  res['가는 중 뛰어내림'] = await p.evaluate(() => { const O = window.__oreum, m = O.rides.cart.state().moving; window.__clr = 99; O.rides.cart.leave(true); return { moving: m, off: !O.player.cart }; });
  await p.waitForTimeout(2500);
  res['뛰어내린 뒤 여유'] = await p.evaluate(() => +window.__clr.toFixed(2));
  console.log(JSON.stringify(res, null, 1));
  await b.close();
})();
