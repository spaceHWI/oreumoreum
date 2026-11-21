// 오늘의 할 일·이어 오기 확인 (#125): node tools/daily.js (먼저 node build.mjs)
// 1) 어제까지 이틀 이어 온 저장(구역 2) → 들어오면 이어 오기 3일째 귤·뱃지, 토스트 한 번
// 2) 오늘 할 일 3개를 사건으로 채우고 받기 → 셋 다 받기. 비 오면 두 배로 세는 할 일
// 3) 튜토리얼 중인 저장은 세지 않음
// 4) 날짜를 바꿔 가며 목록 (사흘치)
const { chromium } = require('playwright');
(async () => {
  const D = await import('../src/daily.js');
  const day = D.kstDayN();
  const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
  for (let i = 0; i < 3; i++) { const d = D.dateOfDay(day + i); console.log(d, D.todaysTasks(d).map((t) => `[${D.CAT_NAME[t.cat]}] ${t.name}`).join(' / ')); }
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const run = async (save, fn) => {
    const ctx = await b.newContext({ viewport: { width: 480, height: 300 } }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
    await p.addInitScript((d) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', 1); localStorage.setItem('oreumoreum.dev', d); localStorage.setItem('oreumoreum.v1', d); } }, JSON.stringify(save));
    await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await p.waitForTimeout(7000);
    await p.click('#enter').catch(() => {}); await p.waitForTimeout(12000);
    const r = await fn(p); ok(!errs.length, '페이지 오류 없음 ' + errs.join(' | ')); await ctx.close(); return r;
  };
  const base = { nick: '할 일 사람', coins: 100, entered: 1, nsV1: 1, nsV2: 1, nsV3: 1, tut: { step: 99, done: true, v: 4 }, jeong: 1, journey: { maxZ: 2 }, look: { sex: 'f', skin: 1 }, nickSet: 1 };
  // 1·2
  const waitRun = (p) => p.waitForFunction(() => window.__oreum.ach.state.daily.seen === 1, null, { timeout: 40000 }).catch(() => {}); // 느린 화면(swiftshader)은 프레임 시간이 깎여 6초가 늦게 참
  await run({ ...base, ach: { life: {}, badges: {}, run: { n: 2, last: day - 1, got: [] } } }, async (p) => {
    await waitRun(p);
    const s = await p.evaluate(() => { const o = window.__oreum, A = o.ach.state; return { run: A.run, coins: o.save.coins, badge: !!A.badges['b-run-3'], seen: A.daily.seen, items: A.daily.items.map((x) => x.id) }; });
    ok(s.run.n === 3 && s.run.got.includes(3) && s.badge, `이어 오기 3일째 (n ${s.run.n}, 뱃지 ${s.badge})`);
    ok(s.coins === 100 + D.runGyul(3, 2), `이어 오기 귤 ${D.runGyul(3, 2)} (귤 ${s.coins})`);
    ok(s.seen === 1, '오늘의 할 일 토스트 한 번');
    const r = await p.evaluate((x2rain) => {
      const o = window.__oreum, A = o.ach; o.setWeather('rain');
      const D = A.ensureDaily(), out = [];
      for (const it of D.items) { const def = A.defD(it.id); const before = it.prog; A.emit(def.ev, 1); out.push({ id: it.id, x2: def.x2, step: it.prog - before }); for (let k = 0; k < def.goal; k++) A.emit(def.ev, 1); }
      const c0 = o.save.coins; const got = D.items.map((it) => A.claim('daily', it.id)?.reward || 0); const all = A.claim('all'); const again = A.claim('all');
      return { out, done: D.items.every((x) => x.done && x.claimed), got, all: all?.reward, again, unc: A.unclaimed(), c0 };
    });
    ok(r.done && r.got.every((g) => g === D.taskGyul(2)), `할 일 셋 다 하고 받음 (하나 ${D.taskGyul(2)})`);
    ok(r.all === D.allGyul(2) && r.again === null, `셋 다 보상 ${D.allGyul(2)} 한 번만`);
    for (const x of r.out) if (x.x2 === 'rain') ok(x.step === 2, `비 올 때 ${x.id} 두 배로 셈`); else if (!x.x2) ok(x.step === 1, `${x.id} 한 번에 하나`);
    await p.evaluate(() => window.__oreum.ach && document.getElementById('ach-chip').click()); await p.waitForTimeout(400);
    const ui = await p.evaluate(() => ({ open: !document.getElementById('ach').hidden, rows: document.querySelectorAll('#ach-list .ach-item').length, run: document.getElementById('ach-run').textContent, h: document.querySelector('#ach .ach-head h3').textContent }));
    ok(ui.open && ui.rows === 4 && /이어 오기 3일째/.test(ui.run) && ui.h === '오늘의 할 일', `업적 창: ${ui.h} 줄 ${ui.rows}(셋 + 셋 다) · ${ui.run}`);
    if (process.argv.includes('--shot')) await p.screenshot({ path: 'notes/shots/125-daily.png' });
  });
  // 1-b: 하루 빠진 저장은 다시 1부터
  await run({ ...base, ach: { life: {}, badges: {}, run: { n: 6, last: day - 2, got: [3] } } }, async (p) => {
    await waitRun(p);
    const s = await p.evaluate(() => window.__oreum.ach.state.run);
    ok(s.n === 1 && !s.got.length, `하루 빠지면 다시 1 (n ${s.n})`);
  });
  // 3: 튜토리얼 중엔 세지 않음
  await run({ nick: '새 사람', coins: 0, entered: 1 }, async (p) => {
    const s = await p.evaluate(() => { const o = window.__oreum, A = o.ach, it = A.ensureDaily().items[1], def = A.defD(it.id); A.emit(def.ev, 1); return { prog: it.prog, tut: !!o.tut?.active, run: A.state.run.n, seen: A.state.daily.seen }; });
    ok(s.prog === 0 && s.run === 0 && !s.seen, `튜토리얼 중: 셈 ${s.prog} · 이어 오기 ${s.run} · 토스트 ${s.seen}`);
  });
  await b.close();
})();
