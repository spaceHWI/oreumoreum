// 퀘스트 (#158): 새로 시작해 구역 1 줄기 퀘스트를 끝까지 따라가 본다. node tools/questrun.js [d|m] [shots]
// d = 데스크톱, m = 폰 세로. shots 를 주면 dist/quest-<d|m>-<n>.jpg 로 작게 찍음 (먼저 node build.mjs)
// 확인: 튜토리얼을 건너뛰면 감독 문 quest 가 열리고 오름지기 머리 위에 노란 ! · 추적 줄 '오름지기에게 가기' → 누르면 자동으로 걸어가 창이 열림 → 받기
//       퀘스트마다 추적 줄 글·화살표, 조건을 채우면 노란 '돌아가기'·오름지기 ?, 보상 귤이 그대로 들어옴, 다음 퀘스트가 같은 창에서 이어짐, 구역 2 표지판에서 2장 줄이 이어짐
//       곁가지(흰 !)·가게 주인(첫 버리기 뒤 장비점), 할인권 쓰기, 퀘스트 창(L), 저장을 다시 읽어도 그대로
// 조건(줍기·싸움)은 셈을 바로 넣어 채우고(실제 놀이는 tools/econ.js·field.js·boss.js 가 봄), 걸린 시간은 아래 어림으로 표를 낸다:
//   걷기 = 앞 자리 → 할 곳 → 돌려줄 사람 직선 × 1.15 ÷ 달리기 10m/s, 하기 = TASK 어림(초). 첫날 1시간(구역 1 줄) 안인지 봄
const { chromium, devices } = require('playwright');
const mode = process.argv[2] || 'd', SHOTS = !!process.argv[3];
let fails = 0; const ok = (c, msg) => { console.log(c ? 'ok  ' : 'FAIL', msg); if (!c) fails++; };
// 하기 어림(초): 집게(0.4초/개) 기준, 배낭 20 → 클린하우스 왕복 포함
const TASK = { trash: (n) => n * 1.6, heapRoad: () => 75, heapField: () => 150, recycle: (n) => n * 70, 'repel:piglet': (n) => Math.ceil(n / 2.5) * 130, gearTB: () => 20, dumper: () => 200, 'den@1': () => 110, 'boss@1': () => 900, zone: () => 0 };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext(mode === 'm' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage(); let errs = 0;
  p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
  const W = (ms) => p.waitForTimeout(ms);
  let shotN = 0; const shot = async (n) => { if (SHOTS) await p.screenshot({ path: `dist/quest-${mode}-${shotN++}-${n}.jpg`, type: 'jpeg', quality: 55, scale: 'css', timeout: 150000 }); };
  const ev = (fn, arg) => p.evaluate(fn, arg);
  const until = async (fn, ms = 8000, arg) => { const t1 = Date.now(); while (Date.now() - t1 < ms) { if (await ev(fn, arg)) return true; await W(250); } return false; };
  const go = (x, z) => ev(([x, z]) => { const o = window.__oreum; o.player.pos.set(x, o.groundAt(x, z), z); o.player.target = null; o.snap(); }, [x, z]);
  const Q = () => ev(() => { const q = window.__oreum.quest; return { st: q.state(), track: q.track(), where: q.where(), win: q.win(), coins: window.__oreum.save.coins }; });
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await W(6000);
  await p.click('#enter').catch(() => {}); await W(4000);
  await ev(() => window.__oreum.setTod(14));
  if (await ev(() => !document.getElementById('look').hidden)) { await p.click('#look-ok'); await W(1500); }
  // ----- 튜토리얼 건너뛰기 → 정낭 -----
  ok(await ev(() => window.__oreum.quest.track() === null || !window.__oreum.quest.track().shown), '튜토리얼 동안 추적 줄 없음');
  await ev(() => { const o = window.__oreum; o.tut.skipAll(); o.quest.next?.off(true); }); // 잠깐 바뀌는 안내(#142 배낭 참·귤 닿음·HP)는 tools/nexthint.js 가 봄
  ok(await until(() => window.__oreum.director.state().open.includes('quest'), 8000), '감독 문 quest 열림 (정낭을 나섬)');
  const where = (await Q()).where; ok(!!where.jigi, `오름지기 자리 ${JSON.stringify(where.jigi)}`);
  ok(Object.keys(where).filter((k) => k.startsWith('b:')).length >= 3, `구역 표지판 ${Object.keys(where).filter((k) => k.startsWith('b:')).join(',')}`);
  ok(Object.keys(where).filter((k) => k.startsWith('shop:')).length >= 4, `가게 주인 ${Object.keys(where).filter((k) => k.startsWith('shop:')).join(',')}`);
  // 정낭 바로 너머에서 오름지기가 보임
  const gate = await ev(() => { const g = window.__oreum.spots.tut?.beyond; return g && [g.x, g.z]; });
  if (gate) { await go(gate[0], gate[1]); await W(600); }
  ok(await until(() => window.__oreum.quest.where().jigi.mark === '!', 4000), '오름지기 머리 위 노란 !');
  if (gate) ok(Math.hypot(where.jigi.x - gate[0], where.jigi.z - gate[1]) < 25, '정낭 너머 25m 안에 오름지기');
  // 폰: 튜토리얼 뒤 전체 화면 안내(#189 #fs-tip)가 한 번 열림 → 닫음 (창이 열려 있으면 추적 줄을 숨김)
  ok(await until(() => { const t = document.getElementById('fs-tip'); if (t && !t.hidden) document.getElementById('fs-tip-x')?.click(); return window.__oreum.quest.track()?.shown; }, 8000), '추적 줄 보임');
  let s = await Q(); ok(/오름지기에게 가기/.test(s.track?.text || ''), `추적 줄: ${s.track?.text}`);
  await shot('start');
  // 추적 줄을 누르면 자동으로 걸어가 창이 열림 (토스트·창이 없게 기다림)
  await until(() => document.getElementById('toast').hidden, 6000);
  await p.click('#quest-track .qt');
  ok(await until(() => !!window.__oreum.quest.win(), 40000), '추적 줄 → 오름지기까지 걸어가 창 열림');
  s = await Q(); ok(s.win?.id === 'can' && s.win?.st === 'offer', `첫 퀘스트 창 ${JSON.stringify(s.win)}`);
  await shot('offer');
  if (mode === 'm') { const r = await ev(() => { const b = document.getElementById('quest-go').getBoundingClientRect(), pp = document.querySelector('#quest .pop').getBoundingClientRect(); return { h: b.height, bottom: Math.round(innerHeight - pp.bottom) }; }); ok(r.h >= 44 && r.bottom <= 2, `폰: 아래 시트·버튼 ${r.h}px`); }
  // ----- 구역 1 줄 따라가기 -----
  const rows = []; let at = where.jigi, total = 0;
  const main1 = await ev(() => window.__oreum.quest.api.defs.main.filter((q) => q.z === 1).map((q) => ({ id: q.id, name: q.name, k: q.ask.k, n: q.ask.n, ever: !!q.ask.ever, go: q.go || null, to: q.to || q.giver, gyul: q.reward.gyul || 0 })));
  for (const q of main1) {
    s = await Q();
    if (!s.win || s.win.id !== q.id) { await ev((gid) => window.__oreum.quest.open(gid), 'jigi'); await W(300); s = await Q(); }
    ok(s.win?.id === q.id && s.win.st === 'offer', `${q.id} 받기 창`);
    await ev(() => window.__oreum.quest.press()); await W(400);
    s = await Q(); ok(s.st.cur?.id === q.id, `${q.id} 받음`);
    await until(() => window.__oreum.quest.track()?.text, 3000);
    s = await Q(); const tgt = s.track?.target;
    ok(!!s.track && (s.track.prog === (q.n > 1 ? `0/${q.n}` : '') || q.ever), `${q.id} 추적 줄 '${s.track?.text}' ${s.track?.prog} → ${tgt ? tgt.join(',') : '(화살표 없음)'}`);
    if (q.go) ok(!!tgt, `${q.id} 화살표가 가리킬 곳 있음`);
    // 어림 시간
    const toPos = q.to === 'jigi' ? [where.jigi.x, where.jigi.z] : (s.where[q.to] ? [s.where[q.to].x, s.where[q.to].z] : null);
    const mid = tgt || toPos || [at.x, at.z], d1 = Math.hypot(mid[0] - at.x, mid[1] - at.z), d2 = toPos ? Math.hypot(toPos[0] - mid[0], toPos[1] - mid[1]) : 0;
    const walk = (d1 + d2) * 1.15 / 10, task = TASK[q.k] ? TASK[q.k](q.n) : 60, sec = walk + task; total += sec;
    rows.push({ 퀘스트: q.name, 할일: s.track?.text, 걷기분: +(walk / 60).toFixed(1), 하기분: +(task / 60).toFixed(1), 누적분: +(total / 60).toFixed(1), 보상: q.gyul });
    // 조건 채우기
    if (q.k === 'gearTB') await ev(() => { const o = window.__oreum; o.save.equip.bag += 1; });
    else if (q.k === 'boss@1') await ev(() => { const o = window.__oreum; o.save.boss.done[1] = 1; });
    else if (q.k === 'zone') await ev(() => { window.__oreum.save.journey.maxZ = 2; });
    else await ev(([k, n]) => { const o = window.__oreum; o.quest.count(k, n); if (k === 'recycle') o.save.recycle.visits += n; }, [q.k, q.n]); // 버린 횟수는 감독 문(shopQuest)도 봄
    ok(await until((id) => window.__oreum.quest.api.ready(id), 3000, q.id), `${q.id} 조건 채움`);
    ok(await until(() => { const t = window.__oreum.quest.track(); return t?.ready && /돌아가기/.test(t.text); }, 5000), `${q.id} 추적 줄 노랗게 '${(await Q()).track?.text}'`);
    if (q.to === 'jigi') ok(await until(() => window.__oreum.quest.where().jigi.mark === '?', 5000), `${q.id} 오름지기 머리 위 ?`);
    s = await Q();
    if (q.id === 'heap1') await shot('ready');
    const before = s.coins;
    if (toPos) { await go(toPos[0] + 1.5, toPos[1] + 1.5); at = { x: toPos[0], z: toPos[1] }; }
    await ev((gid) => window.__oreum.quest.open(gid), q.to); await W(300);
    s = await Q(); ok(s.win?.id === q.id && s.win.st === 'ready', `${q.id} 끝내기 창 (${q.to})`);
    await ev(() => window.__oreum.quest.press()); await W(400);
    s = await Q(); ok(s.st.done.includes(q.id) && s.coins - before === q.gyul, `${q.id} 보상 귤 ${s.coins - before}/${q.gyul}`);
  }
  console.table(rows);
  ok(total <= 3600, `구역 1 줄 어림 ${(total / 60).toFixed(0)}분 (첫날 1시간 안)`);
  // 구역 2 표지판에서 2장 줄이 이어짐
  s = await Q(); ok(s.win?.id === 'note' && s.win.st === 'offer', `구역 2 표지판에서 바로 다음 '떨어진 쪽지' (${JSON.stringify(s.win)})`);
  await shot('board');
  await ev(() => window.__oreum.quest.close());
  // ----- 곁가지·가게 주인 -----
  s = await Q(); ok(s.where.jigi.mark === 'w', `오름지기 곁가지 흰 ! (${s.where.jigi.mark})`);
  ok(await until(() => window.__oreum.director.state().open.includes('shopQuest'), 4000), '감독 문 shopQuest (첫 버리기 뒤)');
  ok(await until(() => window.__oreum.quest.where()['shop:gear']?.mark === 'w', 4000), '철물 삼춘 흰 !');
  await ev(() => { const q = window.__oreum.quest; q.give('g-tool'); q.count('x', 0); window.__oreum.save.equip.tool += 1; });
  ok(await until(() => window.__oreum.quest.api.ready('g-tool'), 3000), 'g-tool 조건');
  await ev(() => window.__oreum.quest.done('g-tool'));
  s = await Q(); ok(s.st.cp.gear === 1, '장비점 할인권 1장');
  const buy = await ev(() => { const o = window.__oreum, k = 'shoes', c0 = o.save.coins; o.save.coins = 99999; const lv = o.save.equip[k]; o.cleanhouse.buyGear(k, lv); return { lv0: lv, lv1: o.save.equip[k], cp: o.save.quest.cp.gear | 0 }; });
  ok(buy.lv1 === buy.lv0 + 1 && !buy.cp, `할인권으로 사기 ${JSON.stringify(buy)}`);
  // ----- 퀘스트 창(L) -----
  await ev(() => window.__oreum.quest.close());
  if (mode === 'd') await p.keyboard.press('l'); else await p.tap('#quest-track .ql').catch(() => ev(() => window.__oreum.quest.log()));
  ok(await until(() => !document.getElementById('qlog').hidden, 3000), '퀘스트 창 열림');
  const logN = await ev(() => document.querySelectorAll('#qlog .q-row.done').length); ok(logN >= 10, `끝낸 것 ${logN}줄`);
  await shot('log');
  await ev(() => { document.getElementById('qlog').hidden = true; });
  // ----- 다시 읽어도 그대로 -----
  const keep = await ev(() => JSON.stringify(window.__oreum.save.quest.done));
  await p.reload(); await W(6000); await p.click('#enter').catch(() => {}); await W(4000);
  if (await ev(() => !document.getElementById('look').hidden)) { await p.click('#look-ok'); await W(1500); }
  ok(await ev((k) => JSON.stringify(window.__oreum.save.quest.done) === k, keep), '다시 읽어도 끝낸 퀘스트 그대로');
  ok(errs === 0, `페이지 오류 ${errs}`);
  console.log(fails ? `FAIL ${fails}` : '모두 통과'); await b.close(); process.exit(fails ? 1 : 0);
})();
