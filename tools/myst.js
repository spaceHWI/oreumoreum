// 미스터리 장치 (#212): 4:04·금고·발자국·크롭서클·뒤돌아보면을 콘솔 훅으로 띄워 본다. node tools/myst.js [d|m] [shots]  (먼저 node build.mjs)
// 확인: 시계·번호판·시간표에 가면 본 곳으로 셈 · 관리 안내 방송 첫 줄이 4시 4분 · 04:04 에 본 곳 · 넷 넘게 보면 혼잣말 한 번
//       금고: 틀리면 창이 그대로, 0404 면 귤·쪽지 n404·칭호 '눈썰미', 두 번째는 안 열림 · 크롭서클(단계 1)·가운데 혼잣말 · 밤 발자국 · 뒤돌아보면 실루엣 0.5초 · 도감 '흔적'
const { chromium, devices } = require('playwright');
const mode = process.argv[2] || 'd', SHOTS = !!process.argv[3];
let fails = 0; const ok = (c, msg) => { console.log(c ? 'ok  ' : 'FAIL', msg); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext(mode === 'm' ? { ...devices['iPhone 13'] } : { viewport: { width: 960, height: 540 } });
  const p = await ctx.newPage(); let errs = 0;
  p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
  const W = (ms) => p.waitForTimeout(ms), ev = (fn, arg) => p.evaluate(fn, arg);
  const until = async (fn, ms = 20000, arg) => { const t1 = Date.now(); while (Date.now() - t1 < ms) { if (await ev(fn, arg)) return true; await W(300); } return false; }; /* 느린 화면에선 게임 1초가 몇 초 */
  let n = 0; const shot = async (k) => { if (SHOTS) await p.screenshot({ path: `dist/myst-${mode}-${n++}-${k}.jpg`, type: 'jpeg', quality: 55, scale: 'css', timeout: 150000 }); };
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await W(6000);
  await p.click('#enter').catch(() => {}); await W(4000);
  if (await ev(() => !document.getElementById('look')?.hidden)) { await p.click('#look-ok').catch(() => {}); await W(1200); }
  await ev(() => { const o = window.__oreum; o.tut.skipAll(); o.setTod(14); o.myst.reset(); });
  await W(1500);
  const M = () => ev(() => window.__oreum.myst.state()), TR = () => ev(() => window.__oreum.traces.state());
  const snap = () => ev(() => { const o = window.__oreum; o.player.target = null; o.snap(); });
  let s = await M();
  ok(['clock', 'lamp', 'stop'].every((k) => s.spots.includes(k)) && !!s.hut, `시계·번호판·시간표·초소가 섬 (${s.spots})`);
  ok(s.notes.includes('n1c') && s.notes.includes('nc1') && s.notes.includes('n404'), `4:04 가 든 쪽지 (${s.notes})`);
  for (const k of ['clock', 'lamp', 'stop']) {
    await ev((k) => window.__oreum.myst.go(k), k); await snap(); await until((k) => window.__oreum.myst.state().seen.includes(k), 20000, k);
    if (k === 'clock') await shot('clock');
  }
  s = await M(); ok(['clock', 'lamp', 'stop'].every((k) => s.seen.includes(k)), `가까이 가면 본 곳 (${s.seen})`);
  ok(!s.said, '셋까지는 혼잣말 없음');
  // 방송: 새로 풀린 관리 안내가 먼저
  await ev(() => window.__oreum.ufoSeen.set(0));
  const line = await ev(() => { const r = window.__oreum.punkWorld.radio; r.fire(true); return r.last(); });
  ok(line.includes('4시 4분'), `첫 관리 안내 방송: ${line}`);
  const line2 = await ev(() => { const r = window.__oreum.punkWorld.radio; r.fire(true); return r.last(); });
  ok(!line2.includes('하늘길'), '단계 0 에서는 단계 2 안내가 안 나옴');
  // 04:04
  await ev(() => window.__oreum.setTod(4 + 4.5 / 60)); await until(() => window.__oreum.myst.state().said === 1);
  s = await M(); ok(s.now404 && s.seen.includes('time') && s.said === 1, `04:04 도 본 곳, 넷이면 혼잣말 한 번 (${s.seen.length}, said ${s.said})`);
  await shot('404');
  // 금고
  await ev(() => window.__oreum.setTod(14));
  await ev(() => window.__oreum.myst.go('safe')); await snap(); await W(1200);
  await shot('hut');
  const c0 = await ev(() => window.__oreum.save.coins);
  ok(await ev(() => window.__oreum.myst.open()), '금고 창이 열림');
  await shot('safe-win');
  ok(await ev(() => window.__oreum.myst.code('1234')) === 'wrong' && await ev(() => window.__oreum.myst.shown()), '틀리면 그대로 (벌 없음)');
  ok((await ev(() => window.__oreum.save.coins)) <= c0 + 5, '틀려도 귤은 그대로');
  ok(await ev(() => window.__oreum.myst.code('0404')) === 'open', '0404 로 열림');
  await W(1500);
  const after = await ev(() => { const o = window.__oreum; return { coins: o.save.coins, safe: o.save.myst.safe, note: o.punkWorld.note.got().includes('n404'), badge: !!o.ach?.state?.badges?.['b-eye'] || !!(o.save.ach?.badges?.['b-eye']) }; });
  ok(after.coins >= c0 + 300 && after.safe === 1 && after.note, `열면 귤·쪽지 (${after.coins - c0}, note ${after.note})`);
  await shot('safe-note');
  await ev(() => window.__oreum.punkWorld.note.close?.());
  ok(!(await ev(() => window.__oreum.myst.open())), '두 번째는 안 열림');
  // 크롭서클 (단계 1)
  await ev(() => window.__oreum.ufoSeen.set(1)); await W(1500);
  const cp = await ev(() => window.__oreum.traces.crop());
  ok(!!cp, `크롭서클 자리 ${cp && cp.x.toFixed(0)},${cp && cp.z.toFixed(0)}`);
  if (cp) {
    await ev(() => window.__oreum.traces.goCrop(9)); await snap(); await W(1500);
    const op0 = (await TR()).crop.op; await shot('crop-ground');
    await ev(() => window.__oreum.traces.goCrop(0)); await snap(); await until(() => window.__oreum.traces.state().tr.crop === 1);
    const t = await TR(); ok(t.tr.crop === 1, `가운데 서면 흔적으로 셈 (땅에서 흐리게 ${op0})`);
    if (SHOTS) { await ev(() => window.__oreum.traces.peek(6)); await W(2500); await shot('crop-high'); }
  }
  await ev(() => window.__oreum.ufoSeen.set(0)); await until(() => !window.__oreum.traces.state().crop);
  ok(!(await TR()).crop, '단계 0 에선 크롭서클 없음');
  // 발자국 (밤)
  await ev(() => window.__oreum.setTod(23)); await until(() => window.__oreum.traces.state().footOp === 1);
  let t = await TR(); ok(t.prints > 8 && t.footOp === 1, `밤 발자국 ${t.prints}개`);
  await ev(() => window.__oreum.traces.goFoot()); await snap(); await until(() => window.__oreum.traces.state().tr.fp === 1);
  t = await TR(); ok(t.tr.fp === 1, `발자국 곁에 가면 흔적으로 셈 (${t.near} m, ${t.footOp})`);
  await shot('foot-night');
  await ev(() => window.__oreum.setTod(13)); await until(() => window.__oreum.traces.state().footOp === 0);
  ok((await TR()).footOp === 0, '낮엔 지워짐');
  // 뒤돌아보면
  await ev(() => window.__oreum.setTod(14));
  ok(await ev(() => window.__oreum.traces.back(50)), '실루엣이 섬');
  await W(150); await shot('glance');
  await until(() => !window.__oreum.traces.state().fig, 6000); t = await TR(); ok(!t.fig && t.tr.back === 1, '0.5초 뒤 사라짐');
  // 도감
  await ev(() => window.__oreum.myst.dex()); await W(800);
  const dex = await ev(() => [...document.querySelectorAll('.dex-sec')].map((e) => e.textContent).find((x) => x.startsWith('흔적')));
  ok(dex === '흔적 4/4', `도감 칸 ${dex}`);
  ok(errs === 0, '페이지 오류 0');
  await b.close();
  console.log(fails ? `FAIL ${fails}` : 'ALL OK');
  process.exitCode = fails ? 1 : 0;
})();
