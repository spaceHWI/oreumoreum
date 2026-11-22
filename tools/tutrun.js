// 튜토리얼 처음부터 끝까지 (#62 → #100 칸 구조): 단계마다 상태·토스트를 찍고 확인한다. node tools/tutrun.js [d|m] [shots]
// d = 데스크톱(키보드), m = 폰 세로(터치만: 화면 버튼 탭). shots 를 주면 dist/tut-<d|m>-<n>.jpg 로 작게 찍음
// 확인: 칸 4개·정낭이 단계에 맞춰 열림, 닫힌 정낭·담은 막힘, 단계에 필요한 것이 그 칸 안, 10초 손가락·30초 쉬운 말, 귤이 모자라지 않음, 끝나면 칸이 사라짐
const { chromium, devices } = require('playwright');
const mode = process.argv[2] || 'd', SHOTS = !!process.argv[3];
let fails = 0; const ok = (c, msg) => { console.log(c ? 'ok  ' : 'FAIL', msg); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext(mode === 'm' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage(); let errs = 0; const t0 = Date.now();
  p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
  const W = (ms) => p.waitForTimeout(ms);
  const shot = async (n) => { if (SHOTS) await p.screenshot({ path: `dist/tut-${mode}-${n}.jpg`, type: 'jpeg', quality: 55, scale: 'css', timeout: 150000 }); console.log('  @', n, await state()); };
  const state = () => p.evaluate(() => { const o = window.__oreum, t = o.tut.toast(); return JSON.stringify({ step: o.tut.step, s: o.save.tut.step, coins: o.save.coins, toast: t && (t.text + (t.n ? ' ' + t.n : '')), focus: o.tut.focus()?.id || o.tut.focus()?.className || null, shop: document.getElementById('shoppop').hidden ? null : document.querySelector('#shoppop .buy-group.on')?.dataset.k }); });
  const go = (x, z, lookAt) => p.evaluate(([x, z, l]) => { const o = window.__oreum; o.player.pos.set(x, o.groundAt(x, z), z); o.player.target = null; if (l) o.player.heading = Math.atan2(l[0] - x, l[1] - z); o.snap(); }, [x, z, lookAt]);
  const T = () => p.evaluate(() => { const o = window.__oreum, t = o.spots.tut; const v = (q) => q && [q.x, q.z]; const c = o.cleanhouse.api; return { walk: v(t.walk), run: v(t.run), gyul: t.gyul.map(v), target: v(t.target), trash: t.trash.map(v), beyond: v(t.beyond), gate: v(t.gate), dump: v(c.front), shop: v(c.shopFront) }; });
  const press = async (k, ms = 80) => { await p.keyboard.down(k); await W(ms); await p.keyboard.up(k); };
  const until = async (fn, ms = 8000, arg) => { const t1 = Date.now(); while (Date.now() - t1 < ms) { if (await p.evaluate(fn, arg)) return true; await W(200); } return false; };
  // 폰은 화면 버튼을 탭, PC 는 키
  const act = async (key, sel) => { if (mode === 'm') await p.tap(sel); else await press(key); };
  const pick = async (fn, arg) => { if (mode === 'm') { await p.tap('#btn-pick'); return until(fn, 20000, arg); } await p.keyboard.down('e'); const r = await until(fn, 20000, arg); await p.keyboard.up('e'); return r; };
  const stepIs = (n) => until((n) => window.__oreum.save.tut.step >= n && window.__oreum.tut.step, 15000, n);
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await W(6000);
  await p.click('#enter').catch(() => {}); await W(4000);
  await p.evaluate(() => window.__oreum.setTod(14));
  if (await p.evaluate(() => !document.getElementById('look').hidden)) { await p.click('#look-ok'); await W(1500); }
  const t = await T(); const tStart = Date.now();
  await W(1500);
  // ----- 칸 구조 -----
  const cells = await p.evaluate(() => window.__oreum.tut.cells());
  ok(cells.length >= 3, `칸 ${cells.length}개`);
  const inCell = (pt, i, pad = 0.6) => p.evaluate(([x, z, i, pad]) => { const o = window.__oreum, L = o.tut.local(x, z), cs = o.tut.cells()[i], l = cs.l, r = cs.r; return L.d > cs.from + pad && L.d < cs.to - pad && L.lat > -l + pad && L.lat < r - pad; }, [pt[0], pt[1], i, pad]);
  const where = [['walk', t.walk, 0], ['run', t.run, 0], ...t.gyul.map((g, k) => ['gyul' + k, g, 1]), ['target', t.target, 1], ...t.trash.map((g, k) => ['trash' + k, g, 2]), ['clean', t.dump, 3]]; /* #221 장비는 가게 거리 장비점 (칸 밖) */
  for (const [n, pt, i] of where) ok(await inCell(pt, i), `${n} 이 ${i + 1}번 칸 안`);
  ok(await p.evaluate(() => window.__oreum.wx.kind === 'clear'), '튜토리얼 동안 맑음');
  ok(await p.evaluate(() => window.__oreum.net.solo === true), '튜토리얼 동안 혼자');
  // 닫힌 정낭·담: 칸 경계를 가로질러 걸어가 보면 막힘 (col.move 로 한 걸음씩)
  const cross = (d0, d1, lat) => p.evaluate(([d0, d1, lat]) => { const o = window.__oreum, a = o.spots.tut.walk; const L = o.tut.local(a.x, a.z); // 걷기 원을 기준으로 길 방향 구하기
    const b = o.spots.tut.run, Lb = o.tut.local(b.x, b.z), k = 1 / (Lb.d - L.d), fx = (b.x - a.x) * k, fz = (b.z - a.z) * k, ux = -fz, uz = fx;
    const P = (d, s) => [a.x + fx * (d - L.d) + ux * (s - L.lat), a.z + fz * (d - L.d) + uz * (s - L.lat)];
    let [x, z] = P(d0, lat); const [tx, tz] = P(d1, lat);
    for (let i = 0; i < 400; i++) { const dx = tx - x, dz = tz - z, l = Math.hypot(dx, dz); if (l < 0.2) break; const r = o.col.move(x, z, x + dx / l * 0.15, z + dz / l * 0.15, 0.35); x = r[0] ?? r.x; z = r[1] ?? r.z; }
    return o.tut.local(x, z).d; }, [d0, d1, lat]);
  const c0 = cells[0];
  ok(await cross(c0.to - 4, c0.to + 4, 0) < c0.to, '닫힌 정낭(1→2칸) 막힘');
  ok(await cross(c0.to - 4, c0.to + 4, 5) < c0.to, '칸 사이 담 막힘');
  // ----- 걷기: 토스트, 10초 손가락, 30초 쉬운 말 -----
  await shot('02-walk');
  ok(!!(await p.evaluate(() => window.__oreum.tut.toast()?.text)), '걷기 토스트');
  await p.evaluate(() => window.__oreum.tut.setIdle(10.5)); await W(400);
  ok(await p.evaluate(() => window.__oreum.tut.idle() >= 10), '10초 진행 없음');
  if (mode === 'm') ok(await p.evaluate(() => window.__oreum.tut.finger()), '손가락이 누를 곳을 가리킴');
  const before = await p.evaluate(() => window.__oreum.tut.toast().text);
  await p.evaluate(() => window.__oreum.tut.setIdle(30.5)); await W(400);
  const ez = await p.evaluate(() => window.__oreum.tut.toast());
  ok(ez.easy && ez.shake && ez.text !== before, `30초: 흔들고 쉬운 말 (${before} → ${ez.text})`);
  await go(...t.walk, t.run); await W(1500);
  // ----- #151 확대·축소: 휠(PC) / 두 손가락(폰, 여기선 cam.dist 를 바꿔 흉내) -----
  ok(await until(() => window.__oreum.tut.step === 'zoom', 30000), '확대 단계'); /* 느린 화면(소프트웨어 GL 1~4fps)에선 '잘했어요' 뒤 다음 단계가 늦게 옴 (#193) */
  await shot('025-zoom');
  await p.evaluate(() => { window.__oreum.cam.dist *= 0.8; }); await W(800); ok(await p.evaluate(() => window.__oreum.tut.step === 'zoom'), '카메라 거리가 저절로 바뀐 것은 안 셈');
  if (mode === 'm') { ok(await p.evaluate(() => !document.getElementById('tut-pinch').hidden), '폰: 두 손가락 그림'); await p.evaluate(() => { window.__oreum.cam.zoomed *= 0.8; }); } // 두 손가락은 흉내만 (input.js userZoom 과 같은 값)
  else { await p.mouse.move(640, 360); for (let i = 0; i < 2; i++) { await p.mouse.wheel(0, -100); await W(150); } }
  ok(await until(() => window.__oreum.save.tut.step >= 2, 6000), '확대·축소로 넘어감');
  await shot('03-run');
  await act('Shift', '#btn-speed'); await go(...t.run, t.gyul[0]); await W(1500);
  // 느린 화면에서는 달리기 입력이 늦게 들어감 (#144): 고정 시간 대신 열릴 때까지 넉넉히 기다리고, 안 열리면 달리기 원에 한 번 더 들어감
  let open1 = await until(() => window.__oreum.tut.cells()[0].open, 20000);
  if (!open1) { console.log('  (1칸 다시)', await state()); await go(...t.walk, t.run); await W(1500); await act('Shift', '#btn-speed'); await go(...t.run, t.gyul[0]); open1 = await until(() => window.__oreum.tut.cells()[0].open, 30000); }
  ok(open1, '1칸을 마치면 정낭이 열림');
  await stepIs(3); await W(300); await shot('04-gyul');
  // #151 귤은 줍기 없이 지나가면 모임: 귤에서 3m 떨어진 곳에 서기만 함
  ok(await p.evaluate(() => document.getElementById('btn-pick').classList.contains('tut-on') === false), '귤 단계엔 줍기 버튼이 아직 없음');
  for (let i = 0; i < t.gyul.length; i++) { const g = t.gyul[i]; await go(g[0] + 2.4, g[1] + 1.6, g); ok(await until((n) => window.__oreum.save.tut.gyul.length > n || window.__oreum.save.tut.step > 3, 6000, i), `귤 ${i + 1} (지나가며)`); await W(200); }
  await stepIs(4);
  const tp = [t.gyul[2][0] + (t.target[0] - t.gyul[2][0]) * 0.2, t.gyul[2][1] + (t.target[1] - t.gyul[2][1]) * 0.2];
  await go(...tp, t.target); await W(1500); await shot('05-throw');
  const coins0 = await p.evaluate(() => window.__oreum.save.coins);
  for (let i = 0; i < 8 && !(await p.evaluate(() => window.__oreum.save.tut.step > 4)); i++) { const h = await p.evaluate(() => window.__oreum.save.tut.hits); await act('f', '#btn-ctx'); await until((h) => window.__oreum.save.tut.hits > h, 8000, h); await until(() => window.__oreum.player.pose !== 'throw', 6000); await W(300); }
  ok(await p.evaluate(() => window.__oreum.save.tut.step > 4), '과녁 3번');
  ok(await p.evaluate((c) => window.__oreum.save.coins >= c, coins0), '던져도 귤이 줄지 않음');
  ok(await until(() => window.__oreum.tut.cells()[1].open, 4000), '2칸 정낭 열림');
  // 작은 더미 (#151): 쓰레기 3개를 다 주우면 꽃 연출·안내
  await stepIs(5); const hp0 = await p.evaluate(() => window.__oreum.spots.tut.heap); ok(!!hp0, '튜토리얼 더미 자리');
  await go(hp0.x + 1.2, hp0.z + 0.8, [hp0.x, hp0.z]); await W(1200); await shot('06-pick');
  const fx0 = await p.evaluate(() => window.__oreum.bloom?.fx?.counts?.().petals || 0), tot0 = await p.evaluate(() => window.__oreum.trash.state().total);
  for (let i = 0; i < 3 && (await p.evaluate(() => window.__oreum.tut.step === 'pick')); i++) { const v0 = await p.evaluate(() => window.__oreum.trash.state().vol); await pick((v) => window.__oreum.trash.state().vol > v, v0); await until(() => !window.__oreum.trash.state().picking, 4000); }
  ok(await p.evaluate(() => (window.__oreum.bloom?.fx?.counts?.().petals || 0)) > fx0, '더미를 다 치우면 꽃잎 연출');
  ok(await p.evaluate((n) => window.__oreum.trash.state().total === n, tot0), '튜토리얼 더미는 누적 수에 안 셈');
  ok(await until(() => window.__oreum.tut.cells()[2].open, 6000), '3칸 정낭 열림');
  await stepIs(6); await W(600);
  // #151 가게 거리 쪽은 닫힌 정낭: 안내 한 번, 뚫고 나갈 수 없음
  const sg = await p.evaluate(() => window.__oreum.tut.shopGate());
  ok(!!sg, '가게 거리 쪽 정낭');
  if (sg) {
    const out = await p.evaluate((g) => { const o = window.__oreum, l = Math.hypot(g.ux, g.uz), nx = g.uz / l, nz = -g.ux / l; // 정낭과 수직(길 왼쪽 = 가게 쪽 바깥)
      const sgn = Math.sign(o.tut.local(g.x + nx, g.z + nz).lat - o.tut.local(g.x, g.z).lat) || 1, ox = nx * -sgn, oz = nz * -sgn; // 바깥 = lat 이 작아지는 쪽
      let x = g.x - ox * 3, z = g.z - oz * 3; o.player.pos.set(x, o.groundAt(x, z), z); o.snap();
      for (let i = 0; i < 60; i++) { const r = o.col.move(x, z, x + ox * 0.15, z + oz * 0.15, 0.35); x = r[0] ?? r.x; z = r[1] ?? r.z; }
      return (x - g.x) * ox + (z - g.z) * oz; }, sg);
    ok(out < 0.2, `가게 쪽 정낭을 뚫고 나갈 수 없음 (정낭 너머 ${out.toFixed(2)}m)`);
    await W(500); ok(await p.evaluate(() => window.__oreum.tut.shopGate().said), '다가가면 안내 한 번');
  }
  await p.evaluate(() => window.__oreum.cleanhouse.go()); await W(1500); await shot('07-dump');
  await act('f', '#btn-ctx'); await until(() => window.__oreum.save.tut.step >= 7, 15000); await W(600); await shot('08-bonus'); await until(() => window.__oreum.save.tut.step >= 8, 90000);
  await stepIs(8);
  // #221 들머리 좌판 대신 가게 거리 장비점까지 걸어감: 튜토리얼 원(tut.target)을 따라 클릭 이동처럼 걷기
  ok(await until(() => window.__oreum.tut.shopGate()?.open && window.__oreum.shopGate.isOpen('gear'), 6000), '가게 쪽 정낭·장비점이 열림');
  ok(await p.evaluate(() => !window.__oreum.cleanhouse.api.mark.visible), '들머리 좌판 표시 없음');
  const follow = async (doneFn, ms) => { const t1 = Date.now(); let vias = 0, lastVia = false;
    while (Date.now() - t1 < ms) {
      const r = await p.evaluate(() => { const o = window.__oreum, g = o.tut.target(); if (g) { o.player.target = o.player.pos.clone().set(g.x, o.groundAt(g.x, g.z), g.z); o.player.onArrive = null; } return { via: !!g && g.r < 1.5 }; });
      if (r.via && !lastVia) vias++; lastVia = r.via;
      if (await p.evaluate(doneFn)) return { s: (Date.now() - t1) / 1000, vias };
      await W(250);
    } return null; };
  const wk = await follow(() => window.__oreum.aim.ctx() === 'gear', 90000);
  ok(!!wk, `장비점 문 앞까지 걸어감 ${wk ? wk.s.toFixed(1) + 's, 정낭 거치기 ' + wk.vias : ''}`);
  ok(await p.evaluate(() => window.__oreum.tut.gyuls.filter((g) => g.at === 'shop' && !g.m.visible).length >= 1), '골목 귤을 주움');
  await W(600); await shot('09-tongs');
  console.log('  (문 앞 토스트)', (await p.evaluate(() => window.__oreum.tut.toast()?.text)));
  await act('f', '#btn-ctx'); await W(1200);
  const TOOL = '#shoppop .buy-group[data-k="tool"] .buy-card.next .buy-btn', BAG = '#shoppop .buy-group[data-k="bag"] .buy-card.next .buy-btn'; // 장비점 창 (#128)
  ok(await p.evaluate(() => window.__oreum.street?.popNow?.() === 'gear'), '가게 거리 장비점 창');
  // 창을 닫아 버리면 다시 안내 (토스트 흔들림), 다시 열기
  await p.click('#shoppop-close').catch(() => {}); await W(700);
  ok(await p.evaluate(() => window.__oreum.tut.toast()?.shake && window.__oreum.tut.step === 'tongs'), '창을 닫으면 다시 안내');
  await act('f', '#btn-ctx'); await W(1200);
  ok(await until(() => document.querySelector('.tut-focus')?.classList.contains('buy-btn'), 4000), '집게 사기 버튼이 빛남');
  console.log('  (빛나는 곳)', await p.evaluate(() => { const f = document.querySelector('.tut-focus'); return f && (f.id || f.className); }), await state());
  if (mode === 'm') await p.tap(TOOL); else await p.click(TOOL);
  ok(await until(() => window.__oreum.save.equip.tool >= 2, 10000), '집게 삼');
  await stepIs(9); await W(300); await shot('10-bag');
  if (mode === 'm') { await W(400); ok(await p.evaluate(() => document.querySelector('.tut-focus')?.dataset.tab === 'bag'), '폰: 배낭 탭이 빛남'); await p.tap('#shoppop-tabs [data-tab="bag"]'); await W(800); }
  if (mode === 'm') await p.tap(BAG); else await p.click(BAG);
  ok(await until(() => window.__oreum.save.equip.bag >= 1, 10000), '배낭 삼');
  await stepIs(10); await p.click('#shoppop-close').catch(() => {}); await W(1500); await shot('11-gate');
  ok(await p.evaluate(() => window.__oreum.tut.cells()[3].open), '마지막 정낭 열림');
  const wk2 = await follow(() => window.__oreum.save.tut.done, 90000);
  ok(!!wk2, `정낭 지나 오름까지 걸어감 ${wk2 ? wk2.s.toFixed(1) + 's, 정낭 거치기 ' + wk2.vias : ''}`);
  await W(1500); await shot('12-done');
  ok(await p.evaluate(() => window.__oreum.save.tut.done), '튜토리얼 끝');
  console.log('  튜토리얼 걸린 시간', ((Date.now() - tStart) / 1000).toFixed(0) + 's');
  ok(await p.evaluate(() => !window.__oreum.tut.pens()), '칸 돌담이 사라짐');
  ok(await cross(c0.to - 4, c0.to + 4, 5) > c0.to, '끝난 뒤엔 칸 담이 막지 않음');
  ok(await p.evaluate(() => window.__oreum.net.solo === false), '끝나면 혼자 아님');
  ok(errs === 0, `페이지 오류 ${errs}`);
  console.log(fails ? `FAIL ${fails}` : 'ALL OK', `(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  await b.close(); process.exit(fails ? 1 : 0);
})();
