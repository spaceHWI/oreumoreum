// 떠다니는 이동 스틱 검사 (#211): node tools/stick.js [shot폴더]  (먼저 node build.mjs)
// 폰 세로·가로에서 손가락 흉내(CDP 터치)로: 구역 안 세 곳에서 눌러 끌기 → 그 자리에 바탕이 생기고 캐릭터가 끈 쪽으로 감,
// 반지름 밖으로 끌면 바탕이 따라옴, 오른손으로 시점을 돌리며 동시에 이동, 버튼 위에서 시작하면 이동 안 됨, 톡 치면 그 땅으로 걸어감, '고정' 설정이면 예전 스틱
const { chromium, devices } = require('playwright');
const URL = 'file://' + process.cwd() + '/dist/test.html#namsongi';
const SHOT = process.argv[2] || '';
let fails = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const land of [false, true]) {
    const tag = land ? '[가로]' : '[세로]', d = devices['iPhone 13'];
    const ctx = await b.newContext({ ...d, viewport: land ? { width: d.viewport.height, height: d.viewport.width } : d.viewport });
    const p = await ctx.newPage(); let errs = 0;
    p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
    const W = (ms) => p.waitForTimeout(ms), E = (f, a) => p.evaluate(f, a);
    const until = async (fn, ms, arg) => { const t1 = Date.now(); while (Date.now() - t1 < ms) { if (await E(fn, arg).catch(() => false)) return true; await W(100); } return false; };
    await p.goto(URL); await until(() => !!window.__oreum?.ticks, 30000);
    await E(() => { const o = window.__oreum; Object.assign(o.save, { entered: 1, look: o.save.look || { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 4 }, jeong: 1, soundOff: 1, fsTip: 1 }); const k = ['oreumoreum.v1', 'oreumoreum.dev'].find((k) => localStorage.getItem(k)) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
    await p.reload(); await until(() => !!window.__oreum?.ticks, 30000); await p.click('#enter').catch(() => {}); await W(2500);
    if (await E(() => !document.getElementById('look').hidden)) { await p.click('#look-ok').catch(() => {}); await W(800); }
    if (await E(() => { const f = document.getElementById('fs-tip'); return f && !f.hidden; })) { await p.click('#fs-tip-x').catch(() => {}); await W(400); }
    await E(() => { window.__oreum.setTod(14); });
    const cdp = await ctx.newCDPSession(p);
    const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
    const vw = await E(() => [innerWidth, innerHeight]);
    ok(await E(() => document.body.classList.contains('stick-float')), `${tag} 기본은 떠다니는 스틱`);
    if (SHOT) await p.screenshot({ path: `${SHOT}/stick-${land ? 'land' : 'port'}-idle.png` });
    ok(await E(() => { const m = document.getElementById('menu-stick'); return !!m && !m.hidden && m.closest('.opt-g')?.dataset.g === 'ctl' && m.querySelectorAll('.seg-b button').length === 2; }), `${tag} 설정 '조작' 묶음에 '이동 스틱: 떠다님 / 고정'`);
    const pos = () => E(() => [window.__oreum.player.pos.x, window.__oreum.player.pos.z]);
    const fwd = () => E(() => { const c = window.__oreum.camObj, e = c.matrixWorld.elements; return [-e[8], -e[10]]; });
    // 1) 구역 안 세 곳
    const spots = [[vw[0] * 0.12, vw[1] * 0.85], [vw[0] * 0.3, vw[1] * 0.7], [vw[0] * 0.2, vw[1] * 0.55]];
    for (const [x, y] of spots) {
      const p0 = await pos(), f = await fwd();
      await T('touchStart', [[x, y, 1]]); await W(50);
      for (let k = 1; k <= 4; k++) { await T('touchMove', [[x, y - k * 9, 1]]); await W(30); }
      const at = await E(() => { const j = window.__oreum.joy, r = document.getElementById('joy').getBoundingClientRect(); return { a: j.active, cx: j.cx, cy: j.cy, ex: r.left + r.width / 2, ey: r.top + r.height / 2 }; });
      await until((a) => Math.hypot(window.__oreum.player.pos.x - a[0], window.__oreum.player.pos.z - a[1]) > 1.2, 8000, p0);
      if (SHOT && x === spots[1][0]) await p.screenshot({ path: `${SHOT}/stick-${land ? 'land' : 'port'}-drag.png` });
      await T('touchEnd', []); await W(300);
      const p1 = await pos(), dx = p1[0] - p0[0], dz = p1[1] - p0[1], m = Math.hypot(dx, dz), fl = Math.hypot(f[0], f[1]) || 1;
      const dot = m ? (dx * f[0] + dz * f[1]) / (m * fl) : 0;
      ok(at.a && Math.abs(at.cx - x) < 2 && Math.abs(at.ey - y) < 3 && Math.abs(at.ex - x) < 3 && m > 1 && dot > 0.6, `${tag} (${x | 0},${y | 0}) 누른 자리에 바탕 (${at.ex | 0},${at.ey | 0}), 위로 끌면 앞으로 ${m.toFixed(1)}m (방향 ${dot.toFixed(2)})`);
      ok(await E(() => !window.__oreum.joy.active && !document.getElementById('joy').classList.contains('on')), `${tag} 손을 떼면 스틱이 사라지고 멈춤`);
    }
    // 2) 반지름 밖으로 끌면 바탕이 따라옴
    { const [x, y] = spots[0]; await T('touchStart', [[x, y, 1]]); for (let k = 1; k <= 8; k++) { await T('touchMove', [[x + k * 25, y - k * 20, 1]]); await W(20); }
      const j = await E(() => { const j = window.__oreum.joy; return { cx: j.cx, cy: j.cy, m: Math.hypot(j.x, j.y) }; });
      const fx = x + 200, fy = y - 160, r = Math.hypot(fx - j.cx, fy - j.cy);
      ok(Math.hypot(j.cx - x, j.cy - y) > 100 && r < 80 && j.m > 0.99, `${tag} 반지름 밖으로 끌면 바탕이 따라옴 (바탕 ${(j.cx) | 0},${(j.cy) | 0}, 손가락까지 ${r.toFixed(0)}px)`);
      // 3) 구역 밖으로 나가도 계속 이동, 오른손으로 시점 돌리기 동시에
      const y0 = await E(() => window.__oreum.cam.yaw), p0 = await pos(), rx = vw[0] * 0.8, ry = vw[1] * 0.4;
      await T('touchMove', [[fx, fy, 1], [rx, ry, 2]]);
      for (let k = 1; k <= 6; k++) { await T('touchMove', [[fx, fy, 1], [rx - k * 15, ry, 2]]); await W(40); }
      await W(600); const y1 = await E(() => window.__oreum.cam.yaw), p1 = await pos(), still = await E(() => window.__oreum.joy.active);
      await T('touchEnd', []); await W(300);
      ok(Math.abs(y1 - y0) > 0.1 && still && Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 0.3, `${tag} 오른손 시점 돌리기와 동시에 이동 (시점 ${(y1 - y0).toFixed(2)}rad)`);
    }
    // 4) 버튼 위에서 시작하면 이동 안 됨 (구역 안에 버튼이 있으면 그것, 없으면 줍기 버튼)
    { const r = await E(() => { const q = [...document.querySelectorAll('#btn-pick, .pad button, #btn-jump')].map((e) => e.getBoundingClientRect()).find((b) => b.width > 0); return q && [q.left + q.width / 2, q.top + q.height / 2]; });
      await T('touchStart', [[r[0], r[1], 3]]); for (let k = 1; k <= 3; k++) await T('touchMove', [[r[0] - k * 20, r[1] - k * 10, 3]]);
      const a = await E(() => window.__oreum.joy.active); await T('touchEnd', []); await W(300);
      ok(!a, `${tag} 버튼 위에서 시작한 터치는 이동이 아님`); }
    // 5) 구역 안을 톡 치면 그 땅으로 걸어감
    { await E(() => { window.__oreum.player.target = null; window.__oreum.stick.STICK.tapT = 5; }); /* 소프트웨어 GL 에서는 터치 사이가 느려서 시간 한도만 늘림 */ const [x, y] = spots[1]; await T('touchStart', [[x, y, 4]]); await W(40); await T('touchEnd', []); await W(200);
      ok(await E(() => !!window.__oreum.player.target), `${tag} 구역을 톡 치면 그 땅으로 걸어감`); await E(() => { window.__oreum.player.target = null; window.__oreum.stick.STICK.tapT = 0.25; }); }
    // 6) 왼쪽 가장자리 16px 은 이동 아님
    { await T('touchStart', [[6, vw[1] * 0.8, 5]]); await T('touchMove', [[30, vw[1] * 0.8 - 30, 5]]); const a = await E(() => window.__oreum.joy.active); await T('touchEnd', []); await W(200);
      ok(!a, `${tag} 왼쪽 가장자리에서 시작한 쓸기는 이동 아님`); }
    // 7) 설정 '고정'
    { await E(() => { window.__oreum.save.stick = 'fixed'; window.__oreum.stick.guide(); });
      const [x, y] = spots[1]; await T('touchStart', [[x, y, 6]]); await T('touchMove', [[x, y - 30, 6]]); const a = await E(() => window.__oreum.joy.active); await T('touchEnd', []);
      const r = await E(() => { const q = document.getElementById('joy').getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
      await T('touchStart', [[r[0], r[1], 7]]); await T('touchMove', [[r[0], r[1] - 30, 7]]); const b2 = await E(() => window.__oreum.joy.active && !window.__oreum.joy.float); await T('touchEnd', []);
      ok(!a && b2, `${tag} '고정' 설정이면 화면 구역은 시점, 제자리 스틱만 이동`);
      await E(() => { delete window.__oreum.save.stick; window.__oreum.stick.guide(); }); }
    ok(errs === 0, `${tag} 페이지 오류 0`);
    await ctx.close();
  }
  await b.close();
  console.log(fails ? `FAIL ${fails}` : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
