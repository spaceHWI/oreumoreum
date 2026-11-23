// #248 수거 관 확인: 두 클린하우스에 버린 저장으로 투입구 → 목록 → 이동 → 도착. 귤이 떨구는 수만큼 줄어듦, 귤 0개로도 탐, 한 곳만 연결이면 안내,
// 연출 길이(2.5초 안), 못 타는 때(탈것), 옛 저장 미루어 채우기. 쓰기: node build.mjs && node tools/tuberun.js [d|m]
const { chromium, devices } = require('playwright');
const modes = process.argv[2] ? [process.argv[2]] : ['d', 'm'];
let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m); if (!c) fail++; };
const URL = 'file://' + process.cwd() + '/dist/test.html#namsongi';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const mode of modes) {
    console.log(`--- ${mode === 'm' ? '폰' : 'PC'}`);
    const ctx = await b.newContext(mode === 'm' ? { ...devices['iPhone 13'] } : { viewport: { width: 800, height: 450 } });
    const p = await ctx.newPage(); let errs = 0;
    p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
    const E = (f, a) => p.evaluate(f, a);
    const W = (ms) => p.waitForTimeout(ms);
    const until = async (f, ms, a) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await E(f, a).catch(() => false)) return true; await W(100); } return false; };
    const act = async () => { if (mode === 'm') await p.tap('#btn-ctx', { force: true }).catch(() => {}); else await p.keyboard.press('f'); };
    const toast = () => E(() => document.getElementById('msg-log')?.textContent || ''); /* #252 뒤로 알림은 #msg-log (#267) */
    await p.goto(URL); await W(6000);
    await p.click('#enter').catch(() => {}); await p.click('#srv-go').catch(() => {}); await W(6000);
    await E(() => {
      const O = window.__oreum; O.save.jeong = 1; O.save.tut = { ...(O.save.tut || {}), done: 1 }; O.cam.mode = 'follow';
      try { O.look.close(); } catch { /* 없음 */ }
      try { O.tut.skipAll(); } catch { /* 없음 */ } document.body.classList.remove('tut');
      O.tube.reset([]); O.save.coins = 500;
    });
    const list = await E(() => window.__oreum.tube.list());
    console.log('클린하우스:', list.map((t) => `${t.id}(${t.name}, 구역 ${t.zone}, ${t.x},${t.z})`).join(' / '));
    ok(list.length === 5, `클린하우스 5곳에 투입구 (${list.length})`);
    // 들머리에 버림 → 연결 하나: '아직 갈 곳이 없어요'
    const dumpAt = async (i) => E((k) => { const O = window.__oreum; if (k < 0) O.cleanhouse.go(); else O.cleanhouse.goMini(k); O.trash.api.store.bag.can = (O.trash.api.store.bag.can || 0) + 3; O.cleanhouse.dump(); }, i);
    await dumpAt(-1);
    ok(await until(() => window.__oreum.tube.linked().includes('gate'), 30000), '들머리에 버리니 연결됨');
    await until(() => !document.querySelector('.fx-recycle'), 60000); /* 버리기 연출이 끝나야 다음 버리기 */
    await E(() => window.__oreum.tube.stand('gate')); await W(600);
    ok(await until(() => window.__oreum.aim.ctx() === 'tube', 3000), '투입구 앞: 버튼이 수거 관');
    { // draw call: 투입구 하나 = 1 (그림자 1)
      const dc = await E(async () => { const O = window.__oreum, sl = (ms) => new Promise((r) => setTimeout(r, ms)), c = () => O.renderer.info.render.calls; O.tube.show(false); await sl(2500); const a = c(); O.tube.show(true); await sl(2500); return [a, c()]; });
      ok(dc[1] - dc[0] <= 2, `투입구 draw call ${dc[1] - dc[0]} (그림자 포함, ${dc[0]} → ${dc[1]})`);
    }
    await act(); await W(300);
    const t1 = await toast();
    ok(!(await E(() => window.__oreum.tube.state().pick)) && t1.includes('아직 갈 곳이 없어요'), `한 곳만 연결: 안내 (${t1})`);
    // 남쪽 사면에도 버림 → 둘
    await dumpAt(1);
    ok(await until(() => window.__oreum.tube.linked().includes('slope'), 30000), '남쪽 사면에 버리니 연결됨');
    ok(await until(async () => (document.getElementById('msg-log').textContent || '').includes('수거 관 연결됨'), 60000), '토스트: 수거 관 연결됨');
    await E(() => window.__oreum.tube.stand('slope')); await W(600);
    ok(await until(() => window.__oreum.aim.ctx() === 'tube', 3000), '남쪽 사면 투입구 앞: 수거 관');
    await act();
    ok(await until(() => window.__oreum.tube.state().pick, 2000), '목록이 열림');
    const rows = await E(() => window.__oreum.tube.rows());
    const drop = await E(() => window.__oreum.tube.drop('slope', 'gate'));
    ok(rows && rows.length === 1 && rows[0].id === 'gate' && rows[0].text.includes(`귤 ${drop}개쯤`), `목록: 들머리 하나·귤 ${drop}개쯤 ${JSON.stringify(rows)}`);
    const c0 = await E(() => window.__oreum.save.coins);
    if (mode === 'm') await p.tap('#tube-pick .tp-row', { force: true }); else await p.click('#tube-pick .tp-row');
    ok(await until(() => !!window.__oreum.tube.state().run, 5000), '빨려 들어감 시작');
    ok(await until(() => window.__oreum.tube.state().ride, 30000), '관 속 화면');
    await until(() => !window.__oreum.tube.state().run, 90000); const took = await E(() => window.__oreum.tube.state().lastT);
    const st = await E(() => { const O = window.__oreum, g = O.tube.list().find((t) => t.id === 'gate'); return { ...O.tube.state(), d: Math.hypot(O.player.pos.x - g.fx, O.player.pos.z - g.fz), scale: O.runner.root.scale.x, cine: !!O.state?.cine }; });
    ok(st.d < 2.5, `들머리 배출구 앞에 도착 (${st.d.toFixed(1)}m)`);
    ok(st.coins === c0 - drop, `귤이 ${drop}개 줄어듦 (${c0} → ${st.coins})`);
    ok(took <= 2.5 && took >= 2.2, `연출 ${took}초 (게임 시간, 2.5초 안)`);
    ok(st.peel && Math.abs(st.scale - 1) < 1e-6 && st.tb === 'o', `귤 껍질·크기 1·도착 표시 (${st.peel}, ${st.scale}, ${st.tb})`);
    ok(await until(() => window.__oreum.tube.state().tb === '', 60000), '도착 표시가 곧 꺼짐');
    // 귤 0개로도 탐
    await E(() => { window.__oreum.save.coins = 0; window.__oreum.tube.stand('gate'); }); await W(500);
    await E(() => window.__oreum.tube.open('gate')); await W(200);
    const r0 = await E(() => window.__oreum.tube.rows());
    ok(r0 && r0[0].text.includes('떨어질 귤이 없어요'), '귤 0개: 떨어질 귤이 없어요');
    await E(() => window.__oreum.tube.choose('slope'));
    await until(() => !window.__oreum.tube.state().run, 90000);
    const st2 = await E(() => { const O = window.__oreum, g = O.tube.list().find((t) => t.id === 'slope'); return { coins: O.save.coins, d: Math.hypot(O.player.pos.x - g.fx, O.player.pos.z - g.fz) }; });
    ok(st2.coins === 0 && st2.d < 2.5, `귤 0개로 남쪽 사면에 옴 (${JSON.stringify(st2)})`);
    // 탈것에 탄 채로는 못 탐
    const why = await E(() => { const O = window.__oreum; O.player.cart = { seat: 0 }; const w = O.tube.whyNot(); O.player.cart = null; return w; });
    ok(!!why && why.includes('탈것'), `탈것에 탄 채로: ${why}`);
    const cl = await E(() => window.__oreum.crash.crashLog?.() || []);
    ok(errs === 0 && !cl.length, `페이지 오류 없음 ${cl.map((c) => c.text).join(' | ')}`);
    await ctx.close();
  }
  // 옛 저장: save.tube 없음 · 버린 적 있음 · 지난 구역 2 → 구역 2 안의 클린하우스가 연결
  {
    console.log('--- 옛 저장');
    const ctx = await b.newContext({ viewport: { width: 640, height: 400 } }); const p = await ctx.newPage(); let errs = 0;
    p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
    const data = { nick: '옛 관', coins: 50, entered: 1, tut: { step: 99, done: true, v: 3 }, jeong: 1, recycle: { visits: 4, gyul: 40 }, journey: { step: 3, maxZ: 2, seen: {} } };
    await p.addInitScript((d) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', 1); localStorage.setItem('oreumoreum.dev', d); localStorage.setItem('oreumoreum.v1', d); } }, JSON.stringify(data));
    await p.goto(URL); await p.waitForTimeout(9000);
    const L = await p.evaluate(() => ({ linked: window.__oreum.tube.linked(), list: window.__oreum.tube.list().filter((t) => t.zone <= 2).map((t) => t.id) }));
    ok(L.linked.length && L.linked.length === L.list.length && L.list.every((id) => L.linked.includes(id)), `옛 저장: 구역 2 까지 연결 ${JSON.stringify(L.linked)}`);
    ok(errs === 0, '옛 저장 페이지 오류 없음');
    await ctx.close();
  }
  await b.close();
  console.log(fail ? `실패 ${fail}` : '모두 통과'); process.exit(fail ? 1 : 0);
})();
