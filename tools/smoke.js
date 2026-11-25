// 살아 있는지 보는 검사 (#193): node tools/smoke.js [d|m]  (아무것도 안 주면 PC·폰 둘 다, 2분 안)
// 오류가 나지 않고 조용히 멈추는 버그(#182: 게임 루프 한 줄 중간 // 주석으로 튜토리얼이 시작되지 않음)를 잡는다
// 1) 새 사용자: 들어가기 → 캐릭터 고르기 닫기 → 5초 안에 튜토리얼 첫 단계
// 2) 게임 루프 셈(__oreum.ticks): 3초 동안 모든 칸이 늘었는지. 루프에 새 시스템을 붙이면 src/game/update.js 의 state.ticks 와 아래 LOOP 에 한 줄 더한다
// 3) 튜토리얼을 건너뛴 저장: 걷기·줍기 한 번·던지기 한 번·가게 창 열고 닫기·내 가방 열고 닫기
// 4) 손님(서버 주소 있음, 로그인 안 함) 줍기 한 번: 프레임 오류 없음·순위 안내 (#285)
// 먼저 node build.mjs (dist/test.html 을 씀)
const { chromium, devices } = require('playwright');
const LOOP = ['frame', 'player', 'trash', 'arena', 'shops', 'shopGate', 'buff', 'tut', 'lamps', 'season', 'quest', 'ufoseen', 'summit', 'myst', 'traces', 'talk', 'cases', 'tube', 'reports'];
LOOP.push('msg'); // 메시지 줄 (#252)
LOOP.push('deerPal'); // 노루 친구 (#247)
LOOP.push('inn'); // 숙소 오피스제주 (#270)
LOOP.push('fire'); // 숙소 마당 불멍 (#290)
LOOP.push('villain'); // 투기꾼 악당 모습 (#291)
LOOP.push('foes'); // 적 역할·정상 설인 (#296)
LOOP.push('fps'); // 프레임 상한·발열 지킴 (#271)
const modes = process.argv[2] ? [process.argv[2]] : ['d', 'm'];
let fails = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
const URL = 'file://' + process.cwd() + '/dist/test.html#namsongi';
(async () => {
  const t0 = Date.now();
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const mode of modes) {
    const tag = mode === 'm' ? '[폰]' : '[PC]';
    const ctx = await b.newContext(mode === 'm' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } });
    const p = await ctx.newPage(); let errs = 0, cdp = null;
    p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
    const W = (ms) => p.waitForTimeout(ms), E = (f, a) => p.evaluate(f, a);
    const until = async (fn, ms, arg) => { const t1 = Date.now(); while (Date.now() - t1 < ms) { if (await E(fn, arg).catch(() => false)) return true; await W(100); } return false; };
    const ready = () => until(() => !!window.__oreum?.ticks, 30000);
    // ----- 1) 새 사용자 -----
    await p.goto(URL); ok(await ready(), `${tag} 게임이 읽힘`);
    await p.click('#enter').catch(() => {});
    ok(await until(() => !document.getElementById('look').hidden, 15000), `${tag} 캐릭터 고르기 창`);
    await p.click('#look-ok').catch(() => {});
    const tLook = Date.now();
    const first = await until(() => window.__oreum.tut.active && !!window.__oreum.tut.step, 5000);
    ok(first, `${tag} 캐릭터 고르기를 닫고 5초 안에 튜토리얼 첫 단계 (${first ? ((Date.now() - tLook) / 1000).toFixed(1) + '초, ' + await E(() => window.__oreum.tut.step) : '시작 안 됨'})`);
    // ----- 2) 게임 루프 셈 -----
    const a = await E(() => ({ ...window.__oreum.ticks })); await W(3000); const c = await E(() => ({ ...window.__oreum.ticks }));
    const dead = LOOP.filter((k) => !(c[k] > a[k]));
    ok(!dead.length, `${tag} 게임 루프 셈 3초 동안 모두 늘어남${dead.length ? ' — 멈춤: ' + dead.join(',') : ''} (frame +${c.frame - a.frame})`);
    // ----- 3) 튜토리얼을 건너뛴 저장 -----
    await E(() => { const o = window.__oreum; Object.assign(o.save, { entered: 1, look: o.save.look || { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 4 }, jeong: 1, soundOff: 1 }); o.save.coins = Math.max(o.save.coins || 0, 30); const k = ['oreumoreum.v1', 'oreumoreum.dev'].find((k) => localStorage.getItem(k)) || 'oreumoreum.v1'; /* 'oreumoreum.v1.ab' 같은 딸린 키를 고르지 않게 */ localStorage.setItem(k, JSON.stringify(o.save)); });
    await p.reload(); await ready(); await p.click('#enter').catch(() => {}); await W(2500);
    if (await E(() => !document.getElementById('look').hidden)) { await p.click('#look-ok').catch(() => {}); await W(800); }
    await E(() => { window.__oreum.setTod(14); });
    if (await E(() => { const f = document.getElementById('fs-tip'); return f && !f.hidden; })) { await p.click('#fs-tip-x').catch(() => {}); await W(400); } /* 폰: 전체 화면 안내(#189)가 처음 한 번 뜸 — 닫고 논다 */
    ok(await E(() => !window.__oreum.tut.active), `${tag} 튜토리얼 건너뛴 저장`);
    // 걷기
    const pos0 = await E(() => [window.__oreum.player.pos.x, window.__oreum.player.pos.z]);
    if (mode === 'm') {
      const r = await E(() => { const q = document.getElementById('joy').getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
      cdp = cdp || await ctx.newCDPSession(p); /* 손가락으로 조이스틱을 밀고 있기 */
      const T = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: r[0], y, id: 1 }] });
      await T('touchStart', r[1]); for (let k = 1; k <= 4; k++) await T('touchMove', r[1] - k * 10);
    } else await p.keyboard.down('w');
    await until((a) => Math.hypot(window.__oreum.player.pos.x - a[0], window.__oreum.player.pos.z - a[1]) > 1, 10000, pos0); /* 느린 기계(소프트웨어 GL)에서도 */
    if (mode === 'm') await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); else await p.keyboard.up('w');
    const pos1 = await E(() => [window.__oreum.player.pos.x, window.__oreum.player.pos.z]);
    const moved = Math.hypot(pos1[0] - pos0[0], pos1[1] - pos0[1]);
    ok(moved > 1, `${tag} 걷기 (${moved.toFixed(1)}m)`);
    // 던지기 한 번
    await W(400);
    const c0 = await E(() => window.__oreum.save.coins);
    const seen = E(() => new Promise((res) => { const o = window.__oreum, t1 = performance.now(), c = o.save.coins; (function f() { if (/throw|bow/.test(o.player.pose) || o.save.coins < c) return res(true); if (performance.now() - t1 > 4000) return res(false); requestAnimationFrame(f); })(); }));
    if (mode === 'm') await p.tap('#btn-ctx').catch(() => {}); else await p.keyboard.press('f');
    ok(await seen, `${tag} 던지기 한 번 (귤 ${c0} → ${await E(() => window.__oreum.save.coins)})`);
    await W(800);
    // 하르방 곁에서는 자동으로 겨누지 않음 (#249)
    const hbT = await E(async () => { const o = window.__oreum, h = o.life.hareubangs[0], q = o.player.pos.clone(); o.player.pos.set(h.pos.x + 1.5, o.groundAt(h.pos.x + 1.5, h.pos.z), h.pos.z); let hit = 0; for (let i = 0; i < 20; i++) { await new Promise((r) => setTimeout(r, 150)); if (o.aim.target() || o.aim.lock()) hit++; } o.player.pos.copy(q); o.aim.setLock(null); return hit; });
    ok(hbT === 0, `${tag} 하르방 곁에서 자동 겨누기 없음 (${hbT}회 잡힘)`);
    // 줍기 한 번: 줍기 버튼(가장 가까운 쓰레기로 걸어가 주움, #104)
    await E(() => { window.__oreum.trash.goHeap(0); }); await W(600); /* 더미 옆으로 옮겨 가까운 쓰레기를 줍게 */
    const pk0 = await E(() => window.__oreum.trash.state().picked);
    if (mode === 'm') await p.tap('#btn-pick').catch(() => {}); else await E(() => window.__oreum.trash.press());
    let picked = false;
    for (let i = 0; i < 4 && !picked; i++) {
      if (mode !== 'm') { await p.keyboard.down('e'); }
      picked = await until((n) => window.__oreum.trash.state().picked > n, 6000, pk0);
      if (mode !== 'm') await p.keyboard.up('e');
      if (!picked && mode === 'm') await p.tap('#btn-pick').catch(() => {});
    }
    ok(picked, `${tag} 줍기 한 번 (${await E(() => window.__oreum.trash.state().picked)})`);
    await E(() => window.__oreum.trash.stopSeek?.());
    // 가게 창 열고 닫기
    await E(() => window.__oreum.street.open('gear')); await W(500);
    ok(await E(() => !document.getElementById('shoppop').hidden && document.querySelectorAll('#shoppop-cards > *').length > 0), `${tag} 가게 창 열림`);
    await p.click('#shoppop-close').catch(() => {}); await W(400);
    ok(await E(() => document.getElementById('shoppop').hidden), `${tag} 가게 창 닫힘`);
    // 내 가방 열고 닫기
    await E(() => document.getElementById('bag-pill').click()); await W(500);
    ok(await E(() => window.__oreum.bag.s().open && !document.getElementById('wardrobe').hidden), `${tag} 내 가방 열림`);
    await E(() => window.__oreum.bag.close()); await W(400);
    ok(await E(() => !window.__oreum.bag.s().open && document.getElementById('wardrobe').hidden), `${tag} 내 가방 닫힘`);
    // 그 뒤에도 루프가 도는지
    const a2 = await E(() => ({ ...window.__oreum.ticks })); await W(1500); const c2 = await E(() => ({ ...window.__oreum.ticks }));
    const dead2 = LOOP.filter((k) => k !== 'tut' && !(c2[k] > a2[k]));
    ok(!dead2.length, `${tag} 놀고 난 뒤 루프 셈${dead2.length ? ' — 멈춤: ' + dead2.join(',') : ''}`);
    ok(errs === 0, `${tag} 페이지 오류 ${errs}`);
    // ----- 4) 로그인 안 한 손님의 줍기 (#285): 서버 주소가 있으면 계정이 생기고(닿지 않아도 손님), 줍기 길의 손님 안내(#261)가 돎. 프레임 오류는 pageerror 가 아니라 콘솔로 나옴 -----
    if (mode === modes[0]) {
      const ferr = []; p.on('console', (m) => { if (/오름오름 오류/.test(m.text())) ferr.push(m.text().slice(0, 160)); });
      await E(() => { const o = window.__oreum; delete o.save.rankNudge; o.save.trash = Object.assign(o.save.trash || {}, { total: 20 }); const k = ['oreumoreum.v1', 'oreumoreum.dev'].find((k) => localStorage.getItem(k)) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
      await ctx.route(/^https?:\/\//, (r) => r.abort());
      await p.goto(URL.replace('#', '?server=' + encodeURIComponent('http://127.0.0.1:9') + '#')); await ready(); await p.click('#enter').catch(() => {}); await W(2500);
      const guest = await E(() => { const a = window.__oreum.online?.account?.(); return !!a && !a.loggedIn; });
      await E(() => { window.__oreum.trash.goHeap(0); }); await W(600);
      const g0 = await E(() => window.__oreum.trash.state().picked); let gp = false;
      if (mode === 'm') await p.tap('#btn-pick').catch(() => {}); else await E(() => window.__oreum.trash.press());
      for (let i = 0; i < 4 && !gp; i++) {
        if (mode !== 'm') await p.keyboard.down('e');
        gp = await until((n) => window.__oreum.trash.state().picked > n, 6000, g0);
        if (mode !== 'm') await p.keyboard.up('e');
        if (!gp && mode === 'm') await p.tap('#btn-pick').catch(() => {});
      }
      await W(400);
      ok(guest && gp && !ferr.length && await E(() => window.__oreum.save.rankNudge === 1), `${tag} 손님 줍기에 오류 없고 순위 안내 한 번 (손님 ${guest}, 주움 ${gp}${ferr.length ? ' — ' + ferr[0] : ''})`);
    }
    await ctx.close();
  }
  console.log(`${fails ? 'FAIL ' + fails : 'ALL OK'} (${((Date.now() - t0) / 1000).toFixed(0)}초)`);
  await b.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
