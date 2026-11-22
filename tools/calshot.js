// 크리스마스 어드벤트 달력 화면 (#222): 서버 날짜를 12월 1·13·25일로 돌려 데스크톱·폰 화면, 문 여는 움직임 연속 그림, 다 열기 받기까지 확인
// node tools/calshot.js [저장 폴더=notes/shots]   (먼저 node build.mjs)
const { chromium, devices } = require('playwright');
const path = require('path');
const OUT = process.argv[2] || 'notes/shots';
const fails = [];
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails.push(m); };
const KST = (d) => Date.UTC(2026, 11, d, 3); // 12월 d일 정오(KST)
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [tag, opt] of [['pc', { viewport: { width: 1100, height: 760 } }], ['phone', { ...devices['iPhone 13'] }]]) {
    const p = await b.newPage(opt); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
    const seed = JSON.stringify({ nick: '달력 사람', coins: 500, entered: 1, look: { sex: 'f', skin: 1 }, tut: { step: 99, done: true, v: 3 }, jeong: 1 });
    await p.addInitScript((d) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', 1); localStorage.setItem('oreumoreum.dev', d); localStorage.setItem('oreumoreum.v1', d); } }, seed);
    await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await p.waitForTimeout(6000);
    await p.click('#enter').catch(() => {}); await p.waitForTimeout(5000);
    if (await p.evaluate(() => !document.getElementById('look').hidden).catch(() => false)) { await p.click('#look-ok').catch(() => {}); await p.waitForTimeout(1500); }
    await p.evaluate(() => window.__oreum.director?.api?.close?.()).catch(() => {});
    const shot = async (name) => { const el = await p.$('#xmas .panel'); await el.screenshot({ path: path.join(OUT, `cal-222-${tag}-${name}.png`) }); };
    const at = async (d, days) => p.evaluate(([ms, days]) => { const o = window.__oreum; o.season.mode('on'); o.season.now(ms); if (!o.save.season || typeof o.save.season !== 'object') o.save.season = {}; o.save.season.xmas = { days, gift: [], tree: 0, snow: 0, full: 0, gd: 0, gn: 0, seen: 0, lp: 0 }; o.save.coins = 500; o.season.open(); }, [KST(d), days]);
    await at(1, []); await p.waitForTimeout(400); await shot('d01');
    ok(await p.evaluate(() => document.querySelectorAll('#xmas-cal .xm-d').length === 25 && !!document.querySelector('#xmas-cal .xm-d.today')), `[${tag}] 1일: 문 25개·오늘 문 흔들림`);
    await at(13, [1, 2, 3, 4, 5, 6, 7, 8, 9, 11]); await p.waitForTimeout(400); await shot('d13');
    const s13 = await p.evaluate(() => ({ miss: document.querySelectorAll('#xmas-cal .xm-d.miss').length, lock: document.querySelectorAll('#xmas-cal .xm-d.lock').length, done: document.querySelectorAll('#xmas-cal .xm-d.done').length, fit: (() => { const r = document.querySelector('#xmas .panel').getBoundingClientRect(); return r.width <= innerWidth && r.left >= 0; })() }));
    ok(s13.miss === 2 && s13.lock === 12 && s13.done === 10 && s13.fit, `[${tag}] 13일: 놓친 문 2(눈 덮임)·잠긴 문 12·연 문 10, 화면 안 ${JSON.stringify(s13)}`);
    await at(25, Array.from({ length: 24 }, (_, i) => i + 1)); await p.waitForTimeout(400); await shot('d25');
    await p.click('#xmas-cal .xm-d.today');
    let tAt = 0;
    for (const ms of [60, 220, 420, 800]) { await p.waitForTimeout(ms - tAt); tAt = ms; await shot(`open-${ms}`); }
    const r25 = await p.evaluate(() => ({ ready: window.__oreum.season.fullReady(), btn: !document.getElementById('xmas-full-get').hidden }));
    ok(r25.ready && r25.btn, `[${tag}] 25일 문을 열면 '다 열면' 받기 단추`);
    const c0 = await p.evaluate(() => window.__oreum.save.coins);
    await p.click('#xmas-full-get'); await p.waitForTimeout(500); await shot('full');
    const g = await p.evaluate(() => ({ coins: window.__oreum.save.coins, full: window.__oreum.save.season.xmas.full, own: ['jacket:x-coat', 'bottom:x-pants'].every((id) => window.__oreum.save.clothes.own[id]), again: window.__oreum.season.full() }));
    ok(g.full === 1 && g.own && g.coins === c0 + 500 && g.again === false, `[${tag}] 다 열기: 귤 +500·산타 한 벌·두 번은 안 됨 ${JSON.stringify(g)}`);
    ok(!errs.length, `[${tag}] 페이지 오류 0 ${errs.join(' | ')}`);
    await p.close();
  }
  await b.close();
  console.log(fails.length ? `FAIL ${fails.length}` : 'ALL OK');
  process.exit(fails.length ? 1 : 0);
})();
