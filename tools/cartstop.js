// #244 마차 타기 확인: 튜토리얼을 막 마친 저장(탈것 가게는 아직 닫힘)으로 정류장에 가서 버튼(폰)·F(PC)로 타고, 다음 정류장에서 내리기.
// 달리는 마차 옆에서도 버튼이 '마차 타기' 로 뜨는지 (#120). 쓰기: node build.mjs && node tools/cartstop.js [d|m]
const { chromium, devices } = require('playwright');
const modes = process.argv[2] ? [process.argv[2]] : ['d', 'm'];
let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m); if (!c) fail++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const mode of modes) {
    console.log(`--- ${mode === 'm' ? '폰' : 'PC'}`);
    const ctx = await b.newContext(mode === 'm' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } });
    const p = await ctx.newPage(); let errs = 0;
    p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
    const E = (f, a) => p.evaluate(f, a);
    const W = (ms) => p.waitForTimeout(ms);
    const until = async (f, ms, a) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await E(f, a).catch(() => false)) return true; await W(200); } return false; };
    const act = async () => { if (mode === 'm') await p.tap('#btn-ctx', { force: true }).catch(() => {}); else await p.keyboard.press('f'); };
    await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await W(6000);
    await p.click('#enter').catch(() => {}); await p.click('#srv-go').catch(() => {}); await W(6000);
    await E(() => {
      const O = window.__oreum; O.save.jeong = 1; O.save.tut = { ...(O.save.tut || {}), done: 1 }; O.cam.mode = 'follow';
      try { O.look.close(); } catch { /* 없음 */ }
      try { O.tut.skipAll(); } catch { /* 없음 */ } document.body.classList.remove('tut');
    });
    ok(await E(() => !window.__oreum.shopGate.isOpen('ride')), '탈것 가게는 아직 닫힘 (튜토리얼 막 마친 저장)');
    // 정류장 0 에 마차가 서 있는 시각으로 맞추고 팻말 앞에 섬
    const t0 = await E(() => { const O = window.__oreum; const t = O.rides.cart.at(0); O.rides.cart.goStop(0); O.keys.clear?.(); return t; });
    ok(t0 != null, `정류장 0 에 서 있는 시각 찾음 (${t0})`);
    ok(await until(() => window.__oreum.aim.ctx() === 'cart', 4000), '정류장: 버튼이 마차 타기');
    await act();
    ok(await until(() => !!window.__oreum.player.cart, 3000), mode === 'm' ? '버튼을 눌러 탐' : 'F 로 탐');
    const from = await E(() => window.__oreum.rides.cart.state());
    // 다음 정류장으로 시각을 옮김
    const to = from.to;
    await E((i) => window.__oreum.rides.cart.at(i), to); await W(1500);
    const st = await E(() => { const O = window.__oreum, c = O.rides.cart.api; return { stop: c.state.stop, moving: c.state.moving, on: !!O.player.cart, btn: O.aim.ctx() }; });
    ok(st.on && !st.moving && st.stop === to, `다음 정류장(${to})에 탄 채 도착 ${JSON.stringify(st)}`);
    ok(st.btn === 'down', '도착: 버튼이 내리기');
    await act();
    ok(await until(() => !window.__oreum.player.cart, 3000), '내림');
    const off = await E((i) => { const O = window.__oreum, q = O.rides.cart.api.exitAt(i), pl = O.player.pos; return +Math.hypot(pl.x - q.x, pl.z - q.z).toFixed(2); }, to);
    ok(off < 1.5, `정류장 팻말 앞 길가에 내림 (${off}m)`);
    // 달리는 마차 옆 (#120). 테스트 화면은 프레임이 느려(폰 탭 한 번 1.5초) 막 떠나는 느린 마차 옆에 서고, 버튼은 페이지 안에서 바로 누름(같은 pointerdown·F 처리)
    let sawBtn = false, rode = false, diag = null;
    for (let k = 0; k < 6 && !rode; k++) {
      diag = await E(async (m) => {
        const O = window.__oreum, c = O.rides.cart.api, raf = () => new Promise((r) => requestAnimationFrame(r));
        for (let t = 0; t < 400; t += 0.1) { O.rides.cart.shift(t); c.update(0, Date.now() / 1000 + t); if (c.state.moving && c.state.speed > 0.2 && c.state.speed < 0.8 && c.state.left > 10) break; }
        const h = c.heading; O.keys.clear?.(); O.tp(c.pos.x + Math.cos(h) * 1.9, c.pos.z - Math.sin(h) * 1.9, h);
        await raf(); await raf();
        const r = { btn: O.aim.ctx(), moving: c.state.moving, d: +c.runDist(O.player.pos).toFixed(2) };
        if (r.btn !== 'cart') return r;
        if (m === 'm') document.getElementById('btn-ctx').dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true, cancelable: true }));
        else document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', key: 'f', bubbles: true }));
        r.on = !!O.player.cart; return r;
      }, mode);
      if (diag.btn === 'cart') sawBtn = true;
      if (diag.on) rode = true;
    }
    ok(sawBtn, `달리는 마차 옆: 버튼이 마차 타기 ${JSON.stringify(diag)}`);
    ok(rode, `달리는 마차에 탐 ${JSON.stringify(diag)}`);
    await E(() => window.__oreum.rides.cart.leave(false));
    ok(errs === 0, `페이지 오류 ${errs}`);
    await ctx.close();
  }
  await b.close();
  console.log(fail ? `실패 ${fail}` : '모두 통과');
  process.exit(fail ? 1 : 0);
})();
