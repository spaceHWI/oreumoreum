// F 키 점검 (#309): 상호작용 물건마다 그 앞에서 F 를 눌러 act 가 도는지. node tools/fkey.js [d|m]  (먼저 node build.mjs)
const { chromium, devices } = require('playwright');
const mode = process.argv[2] || 'd';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext(mode === 'm' ? { ...devices['iPhone 13'] } : { viewport: { width: 960, height: 540 } });
  const p = await ctx.newPage(); let errs = 0; p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
  const W = (ms) => p.waitForTimeout(ms), ev = (fn, a) => p.evaluate(fn, a);
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await W(6000);
  await p.click('#enter').catch(() => {}); await W(4000);
  if (await ev(() => !document.getElementById('look')?.hidden)) { await p.click('#look-ok').catch(() => {}); await W(1200); }
  await ev(() => { const o = window.__oreum; o.tut.skipAll(); o.setTod(14); });
  await W(1500);
  /* 1) 망원경: 진짜로 시작·F 로 끝 (같은 keydown 에서 시작하자마자 꺼지던 문제, #309) */
  const sp = await ev(() => window.__oreum.summit.spots());
  const go = (v) => ev((v) => { const o = window.__oreum; o.player.pos.set(v[0], o.groundAt(v[0], v[2]), v[2]); o.player.target = null; o.snap(); }, v);
  const run = () => ev(() => window.__oreum.summit.state().run?.kind || null);
  let fails = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
  await go(sp.scope); await W(2500);
  await p.keyboard.press('KeyF'); await W(700); ok((await run()) === 'scope', '망원경 앞에서 F → 보기 시작');
  await p.keyboard.press('KeyF'); await W(700); ok((await run()) === null, '다시 F → 끝');
  /* 2) 상호작용 물건 전부: 그 자리에서 F 를 누르면 그 물건의 act 가 도는지 (act 는 세어만 보고 실제로는 안 함) */
  const items = await ev(() => { const o = window.__oreum; return o.ctxAll().map((it, i) => ({ i, label: it.label || (it.cairn ? '돌탑' : '?'), pos: [it.pos.x, it.pos.y, it.pos.z] })); });
  const rows = [];
  for (const it of items) {
    await ev((i) => { const o = window.__oreum, x = o.ctxAll()[i]; if (!x.__real) { x.__real = x.act; x.act = () => { x.__n = (x.__n || 0) + 1; }; } x.__n = 0; }, it.i);
    await go(it.pos); await W(500);
    const st = await ev((i) => { const o = window.__oreum, x = o.ctxAll()[i]; return { on: !x.when || !!x.when(), picked: o.ctxNow() === x, now: document.getElementById('btn-ctx').title }; }, it.i);
    let res = 'when 닫힘';
    if (st.on) {
      if (!st.picked) res = '다른 물건이 앞섬 (' + st.now.replace(' (F)', '') + ')';
      else { await p.keyboard.press('KeyF'); await W(200); const n = await ev((i) => window.__oreum.ctxAll()[i].__n, it.i); res = n === 1 ? 'F 됨' : 'F 안 됨 (act ' + n + '번)'; if (n !== 1) fails++; }
    }
    rows.push(`${it.label} | ${res}`);
  }
  console.log('\n| 물건 | 결과 |\n|---|---|\n' + rows.map((r) => '| ' + r.replace(' | ', ' | ') + ' |').join('\n'));
  console.log(fails || errs ? `FAIL ${fails}건 오류 ${errs}` : 'ok   F 점검 통과');
  await b.close(); process.exit(fails || errs ? 1 : 0);
})();
