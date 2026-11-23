// 사건 파일 끝 '버리는 자' (#237): 사건을 다 종결한 저장 → 수사 보드에서 빨간 실이 이어지고 위(하늘)를 가리킴 → 혼잣말·칭호 → 엔딩
// node tools/casefin.js [d|m]   (먼저 node build.mjs)
// 저장 셋: all 모든 사건 종결(엔딩 안 봄) · short 정상 우두머리만 쫓음(사건 없음, 엔딩이 줄에 서지 않음) · seen 엔딩을 이미 본 옛 저장(막히지 않음)
const { chromium, devices } = require('playwright');
const mode = process.argv[2] || 'd';
let fails = 0; const ok = (c, msg) => { console.log(c ? 'ok  ' : 'FAIL', msg); if (!c) fails++; };
(async () => {
  const { CASES } = await import('../src/cases/index.js');
  const base = { nick: '조사관', coins: 100, entered: 1, tut: { step: 99, done: true, v: 3 }, jeong: 1, lv: { xp: 999999 }, boss: { done: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 } } };
  const T0 = Date.now() - 864e5;
  const all = { ...base,
    cases: Object.fromEntries(CASES.map((c) => [c.id, { w: T0, ev: c.ev.map((e) => e.id), f: 1, r: 1, ...(c.v ? { v: c.v } : {}) }])),
    quest: { v: 1, cur: null, done: CASES.flatMap((c) => (c.quests || []).map((q) => q.id)), side: {}, cp: {}, c: {} },
    punk: { notes: Object.fromEntries(CASES.flatMap((c) => (c.notes || []).map((n) => [n.id, T0]))), unread: [] },
    clothes: { own: Object.fromEntries(CASES.filter((c) => c.cloth).map((c) => [c.cloth.id, 1])), wear: {} },
    story: { done: ['mom', 'pair', 'night', 'howl', 'truck', 'meet', 'tour', 'sign', 'ufo'], wait: [] } };
  const SAVES = { all, short: { ...base, story: { done: ['ufo'], wait: ['end'] } }, seen: { ...base, story: { done: ['end'], wait: [], seen: 1 } }, bad: { ...base, caseFin: 'x' } };
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [name, data] of Object.entries(SAVES)) {
    const ctx = await b.newContext(mode === 'm' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } });
    const p = await ctx.newPage(); let errs = 0;
    p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
    await p.addInitScript((d) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', 1); localStorage.setItem('oreumoreum.dev', d); localStorage.setItem('oreumoreum.v1', d); } }, JSON.stringify(data));
    const W = (ms) => p.waitForTimeout(ms), ev = (fn, arg) => p.evaluate(fn, arg);
    const until = async (fn, ms = 8000, arg) => { const t1 = Date.now(); while (Date.now() - t1 < ms) { if (await ev(fn, arg).catch(() => false)) return true; await W(250); } return false; };
    await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await W(6000);
    await p.click('#enter').catch(() => {}); await W(4000);
    if (await ev(() => !document.getElementById('look').hidden)) { await p.click('#look-ok').catch(() => {}); await W(1500); }
    await ev(() => { const o = window.__oreum; o.swarm?.disable?.(true); o.tut.skipAll?.(); o.quest.next?.off?.(true); o.setTod(14); });
    await until(() => { const t = document.getElementById('fs-tip'); if (t && !t.hidden) document.getElementById('fs-tip-x')?.click(); return true; }, 1000);
    const F = () => ev(() => window.__oreum.caseFin.state());
    console.log('--', name, JSON.stringify(await F()));
    if (name === 'all') {
      ok((await F()).all, `사건 ${CASES.length}개 모두 종결`);
      ok(!(await ev(() => window.__oreum.story.fire('end'))), '연출 전엔 엔딩이 줄에 서지 않음');
      ok(await until(() => { const t = document.getElementById('fs-tip'); if (t && !t.hidden) document.getElementById('fs-tip-x')?.click(); /* 폰 전체 화면 안내 (#189) */ return !!window.__oreum.caseFin.state().run || window.__oreum.caseFin.state().t > 0; }, 60000), '조용해지면 연출 시작');
      ok(await until(() => window.__oreum.cases.fileOpen(), 3000), '수사 보드가 열림');
      await W(800);
      const mid = await ev(() => [...document.querySelectorAll('#case-file .cf-thread path')].map((e) => ({ c: e.getAttribute('class'), off: +e.getAttribute('stroke-dashoffset') })));
      ok(mid.some((x) => x.off > 0 && x.off < 1), `실이 이어지는 중 ${JSON.stringify(mid.slice(0, 2))}`);
      ok(await until(() => window.__oreum.caseFin.state().run?.said, 8000), '혼잣말 한 줄');
      ok(await until(() => !window.__oreum.caseFin.state().run, 8000), '연출 끝');
      const bd = await ev(() => { const s = document.querySelector('#case-file .cf-thread'), B = s.getBoundingClientRect(); return { up: [...s.querySelectorAll('path.up')].map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.top - B.top), Math.round(r.bottom - B.top)]; }), sky: !!document.querySelector('#case-file .cf-board.up .cf-sky'), loose: s.querySelectorAll('path.loose').length, pins: document.querySelectorAll('#case-file .cf-pin').length, img: document.querySelectorAll('#case-file .cf-pic.done img').length }; });
      ok(bd.up.length === CASES.length && bd.up.every(([t]) => t <= 16) && bd.sky && !bd.loose, `다섯 줄 모두 위(하늘)로 ${JSON.stringify(bd)}`);
      ok(bd.pins === CASES.length && bd.img === CASES.length, `사진 ${bd.img}·핀 ${bd.pins}`);
      ok(await ev(() => !!window.__oreum.save.ach.badges['b-case-all']), "칭호 '수석 조사관'");
      ok(await ev(() => window.__oreum.story.state().wait.includes('end') || window.__oreum.story.state().cur === 'end'), '엔딩이 줄에 섬');
      await ev(() => window.__oreum.director.open('aliens')); /* 감독 문 (구역 4 에 닿으면 열림) */
      await p.click('#case-file-close').catch(() => {});
      const t0 = Date.now(), why = [], c0 = await ev(() => window.__oreum.director.api.clock);
      /* 실제 시간 대신 게임 시계로 60초 (#286: 느린 소프트웨어 GL 에서는 실제 90초가 게임 10초도 안 됨). 실제로는 10분까지 */
      let st = false;
      while (Date.now() - t0 < 600000) {
        const r = await ev((c0) => { const o = window.__oreum, s = o.story.state(), c = o.director.api.clock;
          if (!window.__w || c - window.__w > 5) { window.__w = c; (window.__why = window.__why || []).push({ t: Math.round(performance.now() / 1000), c: +c.toFixed(1), w: o.director.why?.('story'), q: o.director.state().waiting.map((x) => x.id), sw: s.wait }); }
          return s.cur === 'end' || s.done.includes('end') ? 'ok' : c - c0 > 60 ? 'late' : ''; }, c0).catch(() => '');
        if (r) { st = r === 'ok'; break; }
        await W(250);
      }
      why.push(...await ev(() => (window.__why || []).slice(-8)));
      console.log('   기다린 시간', Math.round((Date.now() - t0) / 1000) + '초 (게임 ' + Math.round((await ev(() => window.__oreum.director.api.clock)) - c0) + '초)', st ? '' : JSON.stringify({ why, log: await ev(() => window.__oreum.director.log.slice(-12)) }));
      ok(st, `창을 닫으면 엔딩 시작 ${JSON.stringify(await ev(() => ({ s: window.__oreum.story.state(), door: window.__oreum.director.state().open.includes('aliens'), can: window.__oreum.director.can('story'), cur: window.__oreum.director.state().cur })))}`);
      const rs = await ev(() => { const k = Object.keys(localStorage).find((x) => /^oreumoreum\.(dev|v1)$/.test(x) && JSON.parse(localStorage.getItem(x)).caseFin); return { f: window.__oreum.caseFin.state(), ls: k && JSON.parse(localStorage.getItem(k)).caseFin }; });
      ok(rs.f.t > 0 && !rs.f.run && rs.ls?.t > 0, `연출은 한 번 (저장 ${JSON.stringify(rs.ls)})`);
      await ev(() => window.__oreum.cases.file()); await W(600);
      ok(await ev(() => document.querySelectorAll('#case-file .cf-thread path.up').length) === CASES.length, '다시 연 보드도 위를 가리킴');
    }
    if (name === 'short') {
      await W(3000);
      const s = await ev(() => ({ f: window.__oreum.story.fire('end'), st: window.__oreum.story.state(), c: window.__oreum.caseFin.state() }));
      ok(!s.f && !s.c.ready && s.st.cur !== 'end', `사건이 덜 끝나면 엔딩을 미룸 ${JSON.stringify(s.st)}`);
    }
    if (name === 'seen') { const s = await F(); ok(s.ready && s.saw && !s.run, '엔딩을 본 옛 저장은 막히지 않음'); }
    if (name === 'bad') { const s = await F(); ok(s.t === 0 && !s.run, '깨진 기록'); }
    ok(errs === 0, `${name} 페이지 오류 ${errs}`);
    await ctx.close();
  }
  await b.close();
  console.log(fails ? `실패 ${fails}` : '모두 통과'); process.exit(fails ? 1 : 0);
})();
