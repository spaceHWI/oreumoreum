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
  const t = await T();
  await W(1500);
  // ----- 칸 구조 -----
  const cells = await p.evaluate(() => window.__oreum.tut.cells());
  ok(cells.length >= 3, `칸 ${cells.length}개`);
  const inCell = (pt, i, pad = 0.6) => p.evaluate(([x, z, i, pad]) => { const o = window.__oreum, L = o.tut.local(x, z), cs = o.tut.cells()[i], l = cs.l, r = cs.r; return L.d > cs.from + pad && L.d < cs.to - pad && L.lat > -l + pad && L.lat < r - pad; }, [pt[0], pt[1], i, pad]);
  const where = [['walk', t.walk, 0], ['run', t.run, 0], ...t.gyul.map((g, k) => ['gyul' + k, g, 1]), ['target', t.target, 1], ...t.trash.map((g, k) => ['trash' + k, g, 2]), ['clean', t.dump, 3], ['shop', t.shop, 3]];
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
  await go(...t.walk, t.run); await W(1500); await shot('03-run');
  await act('Shift', '#btn-speed'); await go(...t.run, t.gyul[0]); await W(1500);
  // 느린 화면에서는 달리기 입력이 늦게 들어감 (#144): 고정 시간 대신 열릴 때까지 넉넉히 기다리고, 안 열리면 달리기 원에 한 번 더 들어감
  let open1 = await until(() => window.__oreum.tut.cells()[0].open, 20000);
  if (!open1) { console.log('  (1칸 다시)', await state()); await go(...t.walk, t.run); await W(1500); await act('Shift', '#btn-speed'); await go(...t.run, t.gyul[0]); open1 = await until(() => window.__oreum.tut.cells()[0].open, 30000); }
  ok(open1, '1칸을 마치면 정낭이 열림');
  await stepIs(2); await W(300); await shot('04-gyul');
  for (let i = 0; i < t.gyul.length; i++) { const g = t.gyul[i]; await go(g[0] + 0.6, g[1] + 0.3, g); await W(400); ok(await pick((n) => window.__oreum.save.tut.gyul.length > n || window.__oreum.save.tut.step > 2, i), `귤 ${i + 1}`); await W(300); }
  await stepIs(3);
  const tp = [t.gyul[2][0] + (t.target[0] - t.gyul[2][0]) * 0.2, t.gyul[2][1] + (t.target[1] - t.gyul[2][1]) * 0.2];
  await go(...tp, t.target); await W(1500); await shot('05-throw');
  const coins0 = await p.evaluate(() => window.__oreum.save.coins);
  for (let i = 0; i < 8 && !(await p.evaluate(() => window.__oreum.save.tut.step > 3)); i++) { const h = await p.evaluate(() => window.__oreum.save.tut.hits); await act('f', '#btn-ctx'); await until((h) => window.__oreum.save.tut.hits > h, 8000, h); await until(() => window.__oreum.player.pose !== 'throw', 6000); await W(300); }
  ok(await p.evaluate(() => window.__oreum.save.tut.step > 3), '과녁 3번');
  ok(await p.evaluate((c) => window.__oreum.save.coins >= c, coins0), '던져도 귤이 줄지 않음');
  ok(await until(() => window.__oreum.tut.cells()[1].open, 4000), '2칸 정낭 열림');
  // 쓰레기 3개
  await stepIs(4); await go(...t.trash[0], t.trash[1]); await W(1200); await shot('06-pick');
  for (let i = 0; i < t.trash.length; i++) { const g = t.trash[i]; await go(g[0] + 0.5, g[1] + 0.4, g); await W(400); const v0 = await p.evaluate(() => window.__oreum.trash.state().vol); await pick((v) => window.__oreum.trash.state().vol > v, v0); await until(() => !window.__oreum.trash.state().picking, 4000); }
  ok(await until(() => window.__oreum.tut.cells()[2].open, 6000), '3칸 정낭 열림');
  await stepIs(5); await W(600);
  await p.evaluate(() => window.__oreum.cleanhouse.go()); await W(1500); await shot('07-dump');
  await act('f', '#btn-ctx'); await until(() => window.__oreum.save.tut.step >= 6, 15000); await W(600); await shot('08-bonus'); await until(() => window.__oreum.save.tut.step >= 7, 90000);
  await stepIs(7);
  await p.evaluate(() => { const o = window.__oreum, c = o.cleanhouse.api.shopFront; o.player.pos.set(c.x, o.groundAt(c.x, c.z), c.z); o.snap(); }); await W(1200); await shot('09-tongs');
  await act('f', '#btn-ctx'); await W(1200);
  const TOOL = '#shoppop .buy-group[data-k="tool"] .buy-card.next .buy-btn', BAG = '#shoppop .buy-group[data-k="bag"] .buy-card.next .buy-btn'; // 장비점 좌판 (#128)
  ok(await p.evaluate(() => window.__oreum.street?.popNow?.() === 'gear' || !document.getElementById('shoppop').hidden), '좌판에서 장비점 창');
  ok(await p.evaluate(() => document.querySelector('.tut-focus')?.classList.contains('buy-btn')), '집게 사기 버튼이 빛남');
  if (mode === 'm') await p.tap(TOOL); else await p.click(TOOL);
  ok(await until(() => window.__oreum.save.equip.tool >= 2, 10000), '집게 삼');
  await stepIs(8); await W(300); await shot('10-bag');
  if (mode === 'm') { await W(400); ok(await p.evaluate(() => document.querySelector('.tut-focus')?.dataset.tab === 'bag'), '폰: 배낭 탭이 빛남'); await p.tap('#shoppop-tabs [data-tab="bag"]'); await W(800); }
  if (mode === 'm') await p.tap(BAG); else await p.click(BAG);
  ok(await until(() => window.__oreum.save.equip.bag >= 1, 10000), '배낭 삼');
  await stepIs(9); await p.click('#shoppop-close').catch(() => {}); await W(1500); await shot('11-gate');
  ok(await p.evaluate(() => window.__oreum.tut.cells()[3].open), '마지막 정낭 열림');
  await go(...t.beyond); await until(() => window.__oreum.save.tut.done, 30000); await W(1500); await shot('12-done');
  ok(await p.evaluate(() => window.__oreum.save.tut.done), '튜토리얼 끝');
  ok(await p.evaluate(() => !window.__oreum.tut.pens()), '칸 돌담이 사라짐');
  ok(await cross(c0.to - 4, c0.to + 4, 5) > c0.to, '끝난 뒤엔 칸 담이 막지 않음');
  ok(await p.evaluate(() => window.__oreum.net.solo === false), '끝나면 혼자 아님');
  ok(errs === 0, `페이지 오류 ${errs}`);
  console.log(fails ? `FAIL ${fails}` : 'ALL OK', `(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  await b.close(); process.exit(fails ? 1 : 0);
})();
