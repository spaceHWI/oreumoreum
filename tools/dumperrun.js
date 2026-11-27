// 투기꾼 퀘스트 보장 (#260): 새 저장으로 튜토리얼을 건너뛰고 구역 1 길 위에서 투기꾼 퀘스트(dumper1, n=1)를 건 뒤 5분(임의) 안에 조건을 채우는지 본다
// 투기꾼이 나타나면 귤로 맞힌 것처럼 쫓아냄(dumpers.test.hit). node tools/dumperrun.js [d|m]  (먼저 node build.mjs)
const { chromium, devices } = require('playwright');
const mode = process.argv[2] || 'd'; let fails = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext(mode === 'm' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage(); let errs = 0; p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
  const W = (ms) => p.waitForTimeout(ms), ev = (fn, a) => p.evaluate(fn, a);
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await W(6000);
  await p.click('#enter').catch(() => {}); await W(4000);
  if (await ev(() => !document.getElementById('look').hidden)) { await p.click('#look-ok'); await W(1500); }
  await ev(() => { const o = window.__oreum; o.setTod(14); o.tut.skipAll(); o.quest.next?.off(true); }); await W(4000);
  await ev(() => { const t = document.getElementById('fs-tip'); if (t && !t.hidden) document.getElementById('fs-tip-x')?.click(); }); await W(800); // 폰: 전체 화면 안내 닫기 (#189)
  // 오늘의 일일 목표를 모두 끝난 것으로 고정: 투기꾼 쫓기 목표가 뽑히는 날에도 left() 가 같은 값 (#320)
  await ev(() => { const d = window.__oreum.ach.ensureDaily(); for (const x of d.items) { x.done = true; x.claimed = true; } });
  // 구역 1 길 위: 더미 하나 옆
  await ev(() => { const o = window.__oreum; const i = o.trash.api.heaps.findIndex((h) => h.zone === 1 && !h.field); o.trash.goHeap(i); o.snap(); });
  ok(await ev(() => { const q = window.__oreum.save.quest; q.cur = { id: 'dumper1', base: { dumper: q.c.dumper || 0 }, r: 0 }; return window.__oreum.quest.api.list().on.some((o) => o.q.id === 'dumper1'); }), '퀘스트 dumper1 걸림 (저장에 직접 넣음)');
  ok(await ev(() => window.__oreum.dumperQ.left() === 1), '남은 투기꾼 1명으로 셈');
  // 게임 시간을 직접 돌림(느린 렌더에서도 같은 결과): dumpers.update 를 0.5초씩 (연출 감독·화면은 그대로 두고 투기꾼·퀘스트 보장 시계만)
  let g = 0, seen = 0, filled = false;
  const step = (n) => ev((n) => { const o = window.__oreum; for (let i = 0; i < n; i++) o.dumpers.api.update(0.5, performance.now() / 1000); }, n);
  while (g < 300) {
    await step(10); g += 5; await W(150);
    const s = await ev(() => { const o = window.__oreum; const d = o.dumpers.api.list; return { n: d.length, quest: d.some((x) => x.quest), left: o.dumperQ.left() }; });
    if (s.n && !seen) { seen = g; ok(s.quest, `퀘스트용 투기꾼이 게임 시간 ${g}초에 나타남`); await step(10); { const v = await ev(() => window.__oreum.villain?.state()); ok(v && v.live.length && v.live.every((x) => x.style === v.style && x.bag), `#291 투기꾼이 악당 모습(${v && v.style})·자루를 멤 (${JSON.stringify(v && v.live)})`); } await ev(() => window.__oreum.dumpers.hit(0)); await step(1); { const v = await ev(() => window.__oreum.villain.state()); ok(v.live.every((x) => !x.bag), `#291 맞으면 자루를 떨굼 (${JSON.stringify(v.live)})`); } }
    if (seen && s.left === 0) { filled = true; break; }
  }
  console.log(JSON.stringify(await ev(() => { const q = window.__oreum.dumperQ; return { w: q.wait(), gap: q.gap(), ok: q.ok(), spot: q.spot(), why: q.why() }; })));
  ok(seen > 0 && seen <= 75, `questGap(60초) 안팎으로 나타남 (${seen}초)`);
  ok(filled, `조건 수를 5분(300초) 안에 채움 (${g}초)`);
  ok(errs === 0, '페이지 오류 없음');
  await b.close(); process.exit(fails ? 1 : 0);
})();
