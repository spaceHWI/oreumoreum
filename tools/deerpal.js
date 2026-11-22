// #247 노루 친구 확인: 구역 2 전에는 귤만 먹고 달아남 → 구역 2 저장으로 들판 노루에게 귤 3번(행동 버튼) → 이름 → 내 노루 → 따라옴·순간 이동
// → 타기 → 배고픔 0 이면 걷는 빠르기 → 띠를 눌러 귤 주기 → 휘파람으로 부르기 → 노루 안장 → 다시 불러와도 남음 · 안장만 가진 저장은 노루를 바로 받음
// 쓰기: node build.mjs && node tools/deerpal.js [d|m]
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
    p.on('console', (m) => { if (m.text().startsWith('UNRIDE')) console.log(m.text()); }); p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
    const E = (f, a) => p.evaluate(f, a);
    const W = (ms) => p.waitForTimeout(ms);
    const until = async (f, ms, a) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await E(f, a).catch(() => false)) return true; await W(200); } return false; };
    const act = async () => { if (mode === 'm') await p.tap('#btn-ctx', { force: true }).catch(() => {}); else await p.keyboard.press('f'); };
    const boot = async () => {
      await p.click('#enter').catch(() => {}); await p.click('#srv-go').catch(() => {}); await W(6000);
      await E(() => {
        const O = window.__oreum; O.save.jeong = 1; O.save.tut = { ...(O.save.tut || {}), done: 1 }; O.cam.mode = 'follow';
        const ln = document.getElementById('look-nick'); if (ln && !ln.value) ln.value = '노루검사'; /* 처음 이름 (#230): 비어 있으면 창이 닫히지 않음 */
        try { O.look.close(); } catch { /* 없음 */ }
        try { O.tut.skipAll(); } catch { /* 없음 */ } document.body.classList.remove('tut');
        document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; }); document.activeElement?.blur?.(); /* 처음 이름 칸(#230)에 글자 칸이 잡혀 있으면 키가 먹지 않음 */
      });
      await until(() => !!window.__oreum.deerPal, 5000);
    };
    await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await W(6000);
    await boot();
    const D = () => E(() => window.__oreum.deerPal.state());
    // 들판 노루 하나 골라 옆에 섬 (적은 끔: 싸움 중이면 노루가 물러남)
    const near = async (id) => E((id) => { const O = window.__oreum, d = O.life.deerById(id); O.enemies?.test?.clear?.(); d.state = 'graze'; d.t = 30; d.speed = 0; O.keys.clear?.(); O.tp(d.pos.x + 2.1, d.pos.z, -Math.PI / 2); return O.deerPal.act(); }, id);
    const id = await E(() => { const O = window.__oreum; O.save.coins = 500; O.deerPal.reset(); O.save.journey = { ...(O.save.journey || {}), maxZ: 1 }; return O.life.deer.find((d) => d.id[0] === 'h').id; });
    // 1) 구역 2 전: 귤만 먹고 달아남
    ok(await near(id) === '귤 주기', '들판 노루 곁: 행동 버튼이 귤 주기');
    let c0 = await E(() => window.__oreum.save.coins);
    await act(); await W(600);
    let s = await D();
    ok(!s.open && !Object.keys(s.f).length && await E((id) => window.__oreum.life.deerById(id).state === 'flee', id) && await E(() => window.__oreum.save.coins) === c0 - 1, `구역 2 전: 귤 1개 먹고 달아남 (${JSON.stringify(s.f)})`);
    // 2) 구역 2 에 들어선 저장: 세 번 주면 이름 창
    await E(() => { window.__oreum.save.journey.maxZ = 2; });
    ok(await until(() => window.__oreum.deerPal.state().open, 3000), '구역 2 에 들어선 저장: 사귈 수 있음');
    for (let k = 0; k < 8 && !(await D()).nameOpen; k++) { const n0 = (await D()).f[id] || 0; await near(id); await act(); await until((a) => (window.__oreum.deerPal.state().f[a[0]] || 0) > a[1] || window.__oreum.deerPal.state().nameOpen, 3000, [id, n0]); } /* 느린 화면에서 키가 빠지면 다시 */
    s = await D();
    ok(s.nameOpen, `귤 3번 → 이름 짓는 창 (${JSON.stringify(s.f)})`);
    const bad = await E(() => window.__oreum.deerPal.name('운영자'));
    ok(bad, '닉네임 거르기: 쓸 수 없는 이름은 창이 남음');
    await E(() => window.__oreum.deerPal.name('보리'));
    s = await D();
    ok(s.on && s.name === '보리' && s.id === id && s.lv === 0 && !s.nameOpen, `내 노루 '보리' (${JSON.stringify({ id: s.id, fed: s.fed })})`);
    ok(await E((id) => { const d = window.__oreum.life.deerById(id); return d.taken && !d.root.visible; }, id), '사귄 무리 노루는 무리에서 숨김');
    ok(await E(() => window.__oreum.deerPal.presence().dp === '보리'), '멀티 presence: dp 에 이름만');
    const dc = await E(async () => { const O = window.__oreum, q = O.deerPal.pal(), raf = () => new Promise((r) => requestAnimationFrame(r)); const m = async () => { let a = 1e9; for (let i = 0; i < 6; i++) { await raf(); a = Math.min(a, O.renderer.info.render.calls); } return a; }; const on = await m(); const par = q.root.parent; par.remove(q.root); const off = await m(); par.add(q.root); return [on, off]; });
    ok(dc[0] - dc[1] <= 4, `내 노루 draw call +${dc[0] - dc[1]} (${dc[1]} → ${dc[0]}, 4 안)`);
    // 3) 따라옴: 앞으로 20m 걸어감
    const st0 = await E(() => { const O = window.__oreum, P = O.player; document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; }); P.target = null; P.pose = 'move'; return [P.pos.x, P.pos.z, O.busy?.()]; });
    await p.keyboard.down('w'); await until((a) => Math.hypot(window.__oreum.player.pos.x - a[0], window.__oreum.player.pos.z - a[1]) > 14, 40000, st0); await p.keyboard.up('w'); /* 검사 화면은 프레임이 느려 게임 시간이 천천히 감 */
    await W(2500);
    s = await D(); const went = await E((a) => Math.hypot(window.__oreum.player.pos.x - a[0], window.__oreum.player.pos.z - a[1]), st0);
    ok(s.d < 7 && went > 10, `${went.toFixed(1)}m 걸어간 뒤 따라와 곁에 (${s.d}m, 발자취 ${s.crumbs})`);
    // 멀리 순간 이동하면 따라잡음
    await E(() => { const O = window.__oreum, P = O.player; O.tp(P.pos.x + 70, P.pos.z + 10, 0); });
    await W(1500);
    for (let k = 0; k < 6; k++) { await E(() => { const O = window.__oreum, P = O.player; O.tp(P.pos.x + 0.7, P.pos.z, 0); }); await W(150); }
    await W(1500);
    s = await D(); ok(s.d < 15, `멀리 가면 순간 이동으로 따라잡음 (${s.d}m)`);
    // 4) 타기
    await E(() => { const O = window.__oreum, q = O.deerPal.pal(), P = O.player; O.enemies?.test?.clear?.(); O.keys.clear?.(); O.tp(q.pos.x + 1.5, q.pos.z, 0); O.save.coins = 500; });
    ok(await until(() => window.__oreum.deerPal.act() === '타기', 3000), '내 노루 곁: 행동 버튼이 타기');
    await act();
    ok(await until(() => window.__oreum.deerPal.state().riding, 3000), mode === 'm' ? '버튼으로 탐' : 'F 로 탐');
    ok(await E(() => !document.getElementById('dp-hunger').hidden), '탈 때 배고픔 띠가 보임');
    if (process.env.DPDBG) await E(() => { const P = window.__oreum.player; let v = P.riding; Object.defineProperty(P, 'riding', { configurable: true, get: () => v, set: (x) => { if (!x && v) console.log('UNRIDE', new Error().stack.slice(0, 600)); v = x; } }); });
    const w = await E(() => { const O = window.__oreum; const a = O.deerPal.want(15); O.deerPal.hunger(0); const z = O.deerPal.want(15); return [a, z]; });
    ok(Math.abs(w[0] - 15 * 0.85) < 0.01 && w[1] <= 5, `안장 없음 ×0.85 (${w[0].toFixed(2)}), 배고픔 0 이면 걷기까지 (${w[1]})`);
    c0 = await E(() => window.__oreum.save.coins);
    console.log('   띠 자리:', await E(() => { const r = document.getElementById('dp-hunger').getBoundingClientRect(), el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return `${r.x | 0},${r.y | 0} ${r.width | 0}x${r.height | 0} → ${el?.id || el?.className}`; }));
    if (mode === 'm') await p.tap('#dp-hunger', { force: true }); else await p.click('#dp-hunger', { force: true });
    await W(300);
    s = await D();
    ok(Math.abs(s.hunger - 0.25) < 0.02 && await E(() => window.__oreum.save.coins) === c0 - 1 && s.fed === 4, `띠를 눌러 귤 1개 → 배고픔 ${s.hunger} (먹인 귤 ${s.fed})`);
    // 달리면 배고픔이 줆
    await E(() => { const O = window.__oreum; O.deerPal.hunger(1); O.enemies?.test?.clear?.(); document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; }); });
    const r0 = await E(() => [window.__oreum.player.pos.x, window.__oreum.player.pos.z]);
    await p.keyboard.down('w'); await until((a) => Math.hypot(window.__oreum.player.pos.x - a[0], window.__oreum.player.pos.z - a[1]) > 8, 30000, r0); await p.keyboard.up('w');
    s = await D(); const rm = await E((a) => Math.hypot(window.__oreum.player.pos.x - a[0], window.__oreum.player.pos.z - a[1]), r0);
    ok(s.hunger < 1 && s.hunger > 0.95, `타고 ${rm.toFixed(1)}m 가면 배고픔이 조금씩 줆 (${s.hunger}, 타는 중 ${s.riding})`);
    await E(() => window.__oreum.deerPal.off());
    ok(!(await D()).riding, '내림');
    // 5) 휘파람: 50m 밖에 둔 노루를 부름
    ok(await E(() => window.__oreum.deerPal.emoCell()), '내 노루가 있을 때 동작 부채꼴 맨 끝에 휘파람 칸');
    await E(() => { const O = window.__oreum, q = O.deerPal.pal(), P = O.player; q.pos.set(P.pos.x + 35, P.pos.y, P.pos.z + 35); });
    if (mode === 'm') { await E(() => document.getElementById('btn-actions').click()); await W(600); /* 단순 화면(#189)은 버튼이 메뉴 타일 안: 같은 click */ await p.tap('.emo-c[data-id="whistle"]', { force: true }).catch(() => {}); }
    else await p.keyboard.press('v');
    await W(200);
    ok((await D()).calling, mode === 'm' ? '부채꼴 휘파람 칸으로 부름' : 'V 로 휘파람');
    ok(await until(() => window.__oreum.deerPal.state().d < 3, 12000), `휘파람 → 달려와 곁에 (${(await D()).d}m)`);
    // 6) 노루 안장
    await E(() => { window.__oreum.save.coins = 7000; window.__oreum.deerPal.buySaddle(); });
    s = await D();
    ok(s.saddle && await E(() => window.__oreum.save.coins) === 1000 && Math.abs(await E(() => window.__oreum.deerPal.want(15)) - 15) < 0.01, '노루 안장: 귤 6000, 빠르기 그대로(15)');
    // 7) 다시 불러와도 남음
    await E(() => window.__oreum.persist?.() ?? null);
    await W(5500);
    await p.reload(); await W(6000); await boot(); await W(1500);
    s = await D();
    ok(s.on && s.name === '보리' && s.saddle && s.id === id, `다시 불러와도 '보리'·안장이 남음 (${JSON.stringify({ on: s.on, name: s.name, saddle: s.saddle })})`);
    ok(await E((id) => window.__oreum.life.deerById(id).taken, id), '다시 불러와도 사귄 무리 노루는 숨김');
    // 8) 새 노루를 사귀면 앞 노루는 무리로
    const id2 = await E((id) => window.__oreum.life.deer.find((d) => d.id[0] === 'h' && d.id !== id).id, id);
    await E(() => { window.__oreum.save.coins = 100; });
    for (let k = 0; k < 3; k++) { await near(id2); await E((i) => window.__oreum.deerPal.feedWild(i), id2); await W(300); }
    await E(() => window.__oreum.deerPal.name('콩이'));
    s = await D();
    ok(s.name === '콩이' && s.id === id2 && await E((id) => { const d = window.__oreum.life.deerById(id); return !d.taken && d.root.visible; }, id), '새 노루 콩이: 앞 노루 보리는 무리로 돌아감');
    // 9) 안장만 있고 노루가 없는 저장 (가게 노루는 없었음): 안장을 사면 그 자리에서 한 마리
    await E(() => { const O = window.__oreum; O.deerPal.reset(); O.save.coins = 7000; O.deerPal.buySaddle(); });
    ok((await D()).nameOpen, '노루 없이 안장을 사면 이름 창 → 한 마리를 줌');
    await E(() => window.__oreum.deerPal.closeName());
    s = await D(); ok(s.on && !!s.name && s.saddle, `닫아도 아무 이름으로 데려감 (${s.name})`);
    ok(errs === 0, `페이지 오류 없음 (${errs})`);
    await ctx.close();
  }
  await b.close();
  console.log(fail ? `실패 ${fail}` : '모두 통과');
  process.exit(fail ? 1 : 0);
})();
