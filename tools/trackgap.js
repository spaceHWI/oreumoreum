// 추적 줄이 비는 구간 (#256, notes/journey.md 2-1절 '다음 할 일은 늘 하나가 추적 줄에'): 여정 단계마다(레벨·가 본 구역·끝낸 우두머리·버틴 터·끝낸 사건) 상태를 놓고 추적 줄을 읽는다
// 두 번 돎: (가) 퀘스트를 그대로 둠 (나) 줄기·곁가지 퀘스트를 다 끝낸 것으로 (이어 줄 것만 남음). 단계마다 추적 줄이 비면 FAIL
// node build.mjs && node tools/trackgap.js [d|m]
const { chromium, devices } = require('playwright');
const mode = process.argv[2] || 'd';
let fails = 0; const ok = (c, msg) => { console.log(c ? 'ok  ' : 'FAIL', msg); if (!c) fails++; };
/* 여정 단계: [이름, 레벨, 가 본 구역, 끝낸 우두머리 구역들, 버틴 터 구역들, 끝낸 사건] */
const STAGES = [
  ['구역 1 들어섬', 1, 1, [], [], []],
  ['구역 1 사건 1 레벨', 3, 1, [], [], []],
  ['구역 1 사건 1 끝', 4, 1, [], [], ['c1']],
  ['구역 1 터 버팀', 4, 1, [], [1], ['c1']],
  ['구역 1 완료', 5, 2, [1], [1], ['c1']],
  ['구역 2 사건 2 레벨', 6, 2, [1], [1], ['c1']],
  ['구역 2 완료', 7, 3, [1, 2], [1, 2], ['c1', 'c2']],
  ['구역 3 사건 3 레벨', 8, 3, [1, 2], [1, 2], ['c1', 'c2']],
  ['구역 3 완료', 10, 4, [1, 2, 3], [1, 2, 3], ['c1', 'c2', 'c3']],
  ['구역 4 사건 4 레벨', 12, 4, [1, 2, 3], [1, 2, 3], ['c1', 'c2', 'c3']],
  ['구역 4 완료', 13, 5, [1, 2, 3, 4], [1, 2, 3, 4], ['c1', 'c2', 'c3', 'c4']],
  ['구역 5 사건 5 레벨', 15, 5, [1, 2, 3, 4], [1, 2, 3, 4], ['c1', 'c2', 'c3', 'c4']],
  ['엔딩 뒤', 16, 5, [1, 2, 3, 4, 5], [1, 2, 3, 4, 5], ['c1', 'c2', 'c3', 'c4', 'c5']],
];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext(mode === 'm' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage(); let errs = 0;
  p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
  const W = (ms) => p.waitForTimeout(ms), ev = (fn, a) => p.evaluate(fn, a);
  const until = async (fn, ms = 6000, a) => { const t1 = Date.now(); while (Date.now() - t1 < ms) { if (await ev(fn, a)) return true; await W(250); } return false; };
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await W(6000);
  await p.click('#enter').catch(() => {}); await W(4000);
  await ev(() => window.__oreum.setTod(14));
  if (await ev(() => !document.getElementById('look').hidden)) { await p.click('#look-ok').catch(() => {}); await W(1500); }
  await ev(() => window.__oreum.tut.skipAll());
  ok(await until(() => window.__oreum.director.state().open.includes('quest'), 8000), '정낭을 나섬');
  await W(3000);
  await ev(() => { const o = window.__oreum, g = o.spots.tut?.beyond; if (g) { o.player.pos.set(g.x, o.groundAt(g.x, g.z), g.z); o.snap(); } o.quest.next.off(true); });
  for (const pass of ['퀘스트 그대로', '퀘스트 다 끝냄']) {
    console.log(`--- ${pass}`);
    for (const [name, L, mz, bossZ, wonZ, cases] of STAGES) {
      const t = await ev(async ({ L, mz, bossZ, wonZ, cases, all }) => {
        const o = window.__oreum, s = o.save;
        o.level.setXp(0); for (let x = 0; o.level.state().lv < L && x < 5e6; x += Math.max(50, x * 0.05)) o.level.setXp(x);
        s.journey = { ...(s.journey || {}), maxZ: mz };
        for (let z = 1; z <= 5; z++) o.boss.setDone(z, bossZ.includes(z) ? 1 : 0);
        s.swarm = s.swarm || {}; s.swarm.won = s.swarm.won || {}; for (let z = 1; z <= 5; z++) { if (wonZ.includes(z)) s.swarm.won[z] = { at: Date.now() - 1000, b: 0 }; else delete s.swarm.won[z]; }
        const Q = o.quest.api.state(), defs = o.quest.api.defs;
        if (all) { const cq = (q) => /^case:/.test(q.need || '') && !cases.includes(q.need.slice(5)); Q.done = Q.done.filter((id) => !(defs.side || []).some((q) => q.id === id && cq(q))); for (const q of [...defs.main, ...(defs.side || [])]) if (!Q.done.includes(q.id) && !cq(q)) Q.done.push(q.id); Q.cur = null; for (const k of Object.keys(Q.side || {})) delete Q.side[k]; }
        else for (const id of cases) { const ql = (defs.side || []).filter((q) => q.need === 'case:' + id); for (const q of ql) if (!Q.done.includes(q.id)) Q.done.push(q.id); }
        o.quest.next.reset();
        await new Promise((r) => setTimeout(r, 1600));
        const tr = o.quest.info(); return { text: tr?.text || '', k: tr?.k || '', why: o.quest.next.why(), lv: o.level.state().lv };
      }, { L, mz, bossZ, wonZ, cases, all: pass !== '퀘스트 그대로' });
      ok(!!t.text, `${name} (Lv ${t.lv}): ${t.k || 'quest'} · ${t.text || '(비어 있음)'}  [${t.why}]`);
    }
  }
  ok(!errs, `페이지 오류 ${errs}`);
  await b.close(); process.exit(fails ? 1 : 0);
})();
