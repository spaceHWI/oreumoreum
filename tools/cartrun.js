// #120 지나가는 마차 타기 확인: 달리는 마차 옆에서 타기(폴짝)·달리는 중 내리기·만석
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 480, height: 300 } });
  p.on('pageerror', (e) => console.log('ERR', e.message.slice(0, 300)));
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await p.waitForTimeout(6000);
  await p.click('#enter').catch(() => {}); await p.click('#srv-go').catch(() => {}); await p.waitForTimeout(6000);
  await p.evaluate(() => {
    const O = window.__oreum; O.save.jeong = 1; O.save.tut = { ...(O.save.tut || {}), done: 1 }; O.cam.mode = 'follow';
    try { O.look.close(); } catch { /* 없음 */ }
    try { O.tut.skipAll(); } catch { /* 없음 */ } document.body.classList.remove('tut');
  });
  const res = {};
  // 달리는 중(속도 2 넘게, 다음 정류장까지 15초 넘게)으로 시각 맞추고, 수레 옆 2.4m 에 세움
  const toRun = () => p.evaluate(() => {
    const O = window.__oreum, c = O.rides.cart.api;
    for (let t = 0; t < 240; t += 0.5) { O.rides.cart.shift(t); c.update(0, Date.now() / 1000 + t); if (c.state.moving && c.state.speed > 2 && c.state.left > 15) break; }
    const h = c.heading, x = c.pos.x + Math.cos(h) * 2.4, z = c.pos.z - Math.sin(h) * 2.4; O.keys.clear(); O.tp(x, z, h);
    return { moving: c.state.moving, speed: +c.state.speed.toFixed(1) };
  });
  res['달리는 마차'] = await toRun();
  await p.waitForTimeout(300);
  res['버튼'] = await p.evaluate(() => window.__oreum.aim.ctx());
  res['타기'] = await p.evaluate(() => { const O = window.__oreum, pl = O.player; let c = pl.cart; window.__st = ''; Object.defineProperty(pl, 'cart', { configurable: true, get() { return c; }, set(v) { if (!v && c && !window.__st) window.__st = new Error().stack.split('\n').slice(2, 5).map((l) => l.trim()).join(' < '); c = v; } }); O.rides.cart.board(); return !!O.player.cart; });
  for (let k = 0; k < 3 && !res['타기']; k++) { await p.waitForTimeout(700); res['타기'] = await p.evaluate(() => { const O = window.__oreum, c = O.rides.cart.api, h = c.heading; O.tp(c.pos.x + Math.cos(h) * 2.4, c.pos.z - Math.sin(h) * 2.4, h); O.rides.cart.board(); return !!O.player.cart; }); } // 구역에 처음 들어선 때 잠깐 바쁨
  await p.waitForTimeout(150);
  res['폴짝 중 높이'] = await p.evaluate(() => { const O = window.__oreum; return { hop: O.player.cart?.hop != null, y: +(O.player.pos.y - O.rides.cart.ground(O.player.pos.x, O.player.pos.z)).toFixed(2) }; });
  await p.waitForTimeout(1200);
  res['앉음'] = await p.evaluate(() => { const O = window.__oreum, c = O.rides.cart.api; if (!O.player.cart) return { off: window.__st, toast: document.getElementById('toast').textContent }; const s = c.seat(O.player.cart.seat); return { hop: O.player.cart.hop, off: +Math.hypot(s.x - O.player.pos.x, s.z - O.player.pos.z).toFixed(2), code: O.rides.state().code, btn: O.aim.ctx() }; });
  // 달리는 중 내리기
  res['내리기'] = await p.evaluate(() => {
    const O = window.__oreum, c = O.rides.cart.api, m = c.state.moving; O.rides.cart.leave(false);
    const pl = O.player, B = c.block; let clr = 99; for (let k = 0; k < B.length; k += 3) clr = Math.min(clr, Math.hypot(pl.pos.x - B[k], pl.pos.z - B[k + 1]) - B[k + 2]);
    return { moving: m, off: !pl.cart, road: O.rides.state().road, clr: +clr.toFixed(2), dy: +Math.abs(pl.pos.y - O.rides.cart.ground(pl.pos.x, pl.pos.z)).toFixed(2), blocked: O.col.blocked(pl.pos.x, pl.pos.z, 0.3) };
  });
  // 멀리(5m)에서는 버튼 없음
  res['5m 밖'] = await p.evaluate(() => { const O = window.__oreum, c = O.rides.cart.api, h = c.heading; O.tp(c.pos.x + Math.cos(h) * 5, c.pos.z - Math.sin(h) * 5, h); return null; });
  await p.waitForTimeout(200); res['5m 밖'] = await p.evaluate(() => window.__oreum.aim.ctx());
  // 만석: 마차를 탄 가짜 사람 4명을 자리마다
  await toRun();
  res['만석'] = await p.evaluate(() => {
    const O = window.__oreum, c = O.rides.cart.api, net = O.net || O.social?.net;
    return !!net;
  });
  const fullNet = await p.evaluate(() => !!(window.__oreum.net && window.__oreum.net.test));
  if (fullNet) {
    res['만석'] = await p.evaluate(() => {
      const O = window.__oreum, c = O.rides.cart.api, net = O.net;
      for (let i = 0; i < 4; i++) { const s = c.seat(i); net.test.fake({ peer: 'fake' + i, presence: { x: s.x, z: s.z, rd: 'cart', nick: 'p' + i } }); }
      const h = c.heading; O.tp(c.pos.x + Math.cos(h) * 2.4, c.pos.z - Math.sin(h) * 2.4, h);
      const solo = net.solo; O.rides.cart.board(); const on = !!O.player.cart;
      const toast = document.getElementById('toast')?.textContent || '';
      for (let i = 1; i < 4; i++) net.test.drop('fake' + i);
      if (on) O.rides.cart.leave(false);
      O.tp(c.pos.x + Math.cos(c.heading) * 2.4, c.pos.z - Math.sin(c.heading) * 2.4, c.heading);
      O.rides.cart.board(); const on2 = !!O.player.cart, seat2 = O.player.cart?.seat;
      net.test.drop('fake0');
      return { solo, full: !on, toast, oneTaken: on2, seat2 };
    });
  } else res['만석'] = 'net 없음';
  console.log(JSON.stringify(res, null, 1));
  await b.close();
})();
