// #316 Bar 소설 확인: 닫힘(가게 열기) → 열림 → 낮엔 '저녁에 열어요' → 밤에 [한 잔] → 귤 나감·앉아 읽기(짧은 소설·화면 어둡게·남에게 앉은 모습)
//   → 15초 → '여운'(경험치·혼잣말·쪽지·밤눈) → 중간에 일어나면 책갈피 → 하루 3번 → 다 읽으면 칭호 '애독자' → 다시 읽기 → 버프 끝
// 쓰기: node build.mjs && node tools/barrun.js [d|m] [--shot]   (그림은 dist/barrun-*.jpg, --shot 일 때만)
const { chromium, devices } = require('playwright');
const modes = process.argv[2] && !process.argv[2].startsWith('-') ? [process.argv[2]] : ['d', 'm'];
const SHOT = process.argv.includes('--shot');
let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m); if (!c) fail++; };
const URL = 'file://' + process.cwd() + '/dist/test.html#namsongi';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const mode of modes) {
    console.log(`--- ${mode === 'm' ? '폰' : 'PC'}`);
    const ctx = await b.newContext(mode === 'm' ? { ...devices['iPhone 13'] } : { viewport: { width: 1000, height: 600 } });
    const p = await ctx.newPage(); let errs = 0;
    p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
    const E = (f, a) => p.evaluate(f, a);
    const W = (ms) => p.waitForTimeout(ms);
    const until = async (f, ms, a) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await E(f, a).catch(() => false)) return true; await W(150); } return false; };
    const log = () => E(() => document.getElementById('msg-log')?.textContent || '');
    const shot = (n) => SHOT && p.screenshot({ path: `dist/barrun-${mode}-${n}.jpg`, type: 'jpeg', quality: 60, timeout: 150000 });
    const ready = () => p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
    const enter = async () => {
      await p.click('#enter').catch(() => {}); await p.click('#srv-go').catch(() => {}); await W(5000);
      await E(() => { const O = window.__oreum; try { O.look.close(); } catch { /* 없음 */ } document.body.classList.remove('tut'); for (const id of ['fs-tip']) { const el = document.getElementById(id); if (el) el.hidden = true; } });
    };
    await p.goto(URL); await ready();
    // 옛 저장 + 깨진 바 기록: 레벨 1, 구역 1, 귤 넉넉
    await E(() => { const O = window.__oreum; Object.assign(O.save, { entered: 1, server: 'battle', look: O.save.look || { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1, coins: 5000, bar: { d: 'x', n: 99, t: -2, left: 1e9, read: [0, 0, 3, 99, 'a'] }, shopGate: { init: 1, open: { gear: 1, manjok: 1, stone: 1, salon: 1, leap: 1, ride: 1, inn: 1 } } }); O.save.journey = { ...(O.save.journey || {}), maxZ: 1 }; const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum.v')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(O.save)); });
    await p.reload(); await ready(); await enter();
    let st = await E(() => window.__oreum.bar.state());
    ok(st.bar && st.bar.d === '' && st.bar.n === 3 && st.bar.t === 0 && st.bar.left > 1400 && st.bar.left <= 1500 && JSON.stringify(st.bar.read) === '[0,3]', `깨진 바 기록은 한도 안으로 (${JSON.stringify(st.bar)})`);
    await E(() => { window.__oreum.save.bar = { d: '', n: 0, t: 0, left: 0, read: [] }; });
    ok(!!(await E(() => window.__oreum.bar.api)), '가게 거리 8번 터에 바 건물');
    ok(await E(() => window.__oreum.street.shops.some((s) => s.id === 'bar' && s.lot === 8)), '가게 표에 소설');
    // 닫힘: 셔터·준비 중
    ok(!st.gate && (await E(() => window.__oreum.shopGate.why('bar'))).includes('레벨 9'), `처음엔 닫힘 ('${await E(() => window.__oreum.shopGate.why('bar'))}')`);
    await E(() => window.__oreum.bar.go()); await W(800);
    ok(await E(() => window.__oreum.aim.ctx()) !== 'book', '닫힌 바 앞: 상호작용 없음');
    ok(await E(() => window.__oreum.shopGate.shutter('bar')?.visible), '닫힌 바 셔터');
    ok(!(await E(() => window.__oreum.bar.order())), '닫힌 바: 주문 안 됨');
    // 열림: 굼부리에 들어섬 → 감독 차례로 알림
    await E(() => { window.__oreum.save.journey.maxZ = 4; });
    ok(await until(() => JSON.stringify(window.__oreum.director.state().waiting || []).includes('shop-bar') || window.__oreum.shopGate.isOpen('bar'), 20000), '굼부리에 들어서면 열림 알림이 감독 줄에 섬');
    await E(() => window.__oreum.shopGate.open('bar'));
    ok(await until(() => window.__oreum.shopGate.isOpen('bar') && window.__oreum.shopGate.shutter('bar')?.visible === false, 25000), '열림: 셔터가 올라감');
    ok(await until(() => window.__oreum.quest.givers.get('shop:bar')?.root.visible === true, 5000), '주인(소설 사장)이 나와 있음');
    // 낮: 입간판 '저녁에 열어요', 창은 열리되 버튼은 막힘
    await E(() => window.__oreum.setTod(13)); await W(1500);
    st = await E(() => window.__oreum.bar.state());
    ok(st.gate && !st.night && !st.open && st.board, `낮엔 닫음·입간판 (${JSON.stringify({ night: st.night, board: st.board })})`);
    await E(() => window.__oreum.bar.go()); await W(900);
    ok(await until(() => window.__oreum.aim.ctx() === 'book', 4000), `툇마루: 상호작용 '한 잔' (${await E(() => window.__oreum.aim.ctx())})`);
    await E(() => window.__oreum.bar.open()); await W(400);
    ok(await E(() => document.getElementById('shoppop-name').textContent === 'Bar 소설'), '창 이름');
    ok(await E(() => [...document.querySelectorAll('#shoppop [data-drink]')].every((b) => b.disabled) && document.querySelector('#shoppop .inn-card').textContent.includes('저녁에 열어요')), "낮: 버튼 막힘·'저녁에 열어요'");
    await shot('0-day');
    await E(() => { document.getElementById('shoppop').hidden = true; });
    ok(!(await E(() => window.__oreum.bar.order())) && (await log()).includes('저녁에 열어요'), '낮엔 주문 안 됨');
    // 밤: 열림
    await E(() => window.__oreum.setTod(22.5)); await W(1500);
    st = await E(() => window.__oreum.bar.state());
    ok(st.night && st.open && !st.board, `밤엔 엶·입간판 감춤 (${JSON.stringify({ night: st.night, board: st.board })})`);
    await E(() => window.__oreum.bar.open()); await W(400);
    const price = await E(() => window.__oreum.bar.price()), lv = await E(() => window.__oreum.level?.state?.().lv || 1);
    ok(price === 60 + lv * 20, `값 60 + 레벨 × 20 (Lv ${lv} → ${price})`);
    ok(await E(() => [...document.querySelectorAll('#shoppop [data-drink]')].length === 2 && [...document.querySelectorAll('#shoppop [data-drink]')].every((b) => !b.disabled)), '[한 잔]·[귤 에이드] 누를 수 있음');
    ok(await E(() => document.querySelector('#shoppop .inn-card').textContent.includes('읽은 책 0/20')), '읽은 책 0/20');
    await shot('1-pop');
    // 주문 → 앉아 읽기
    const c0 = await E(() => window.__oreum.save.coins);
    if (mode === 'm') await p.tap('#shoppop [data-drink="ade"]'); else await p.click('#shoppop [data-drink="ade"]');
    await W(1200);
    st = await E(() => window.__oreum.bar.state());
    ok(st.sit && st.sit.drink === 'ade' && c0 - (await E(() => window.__oreum.save.coins)) === price, `귤 ${price} 나가고 앉음 (${JSON.stringify(st.sit)})`);
    ok(st.bar.n === 1 && st.bar.t === 1 && st.bar.p === 1, `값을 낸 것과 읽은 수를 같이 적음 (${JSON.stringify(st.bar)})`);
    ok(st.mung && !!st.page && st.pose === 'warm', `화면 가장자리 어둡게·짧은 소설 '${st.page}'·두 손으로 든 자세`);
    ok(st.net?.bs === st.sit.i + 1, `남에게 보내는 상태에 의자 번호 (${JSON.stringify(st.net)})`);
    ok(await E(() => window.__oreum.bar.peer({ data: { bs: 1 } })?.pose === 'warm'), '남의 화면: 앉아 읽는 자세');
    ok(await E(() => { const O = window.__oreum, s = O.bar.api.seats[O.bar.state().sit.i]; return Math.hypot(O.player.pos.x - s.pos.x, O.player.pos.z - s.pos.z) < 0.2; }), '바 의자에 앉음 (충돌에 밀려나지 않음)');
    await W(1500); await shot('2-read');
    // 중간에 일어나면 책갈피
    await E(() => window.__oreum.bar.stand()); await W(400);
    st = await E(() => window.__oreum.bar.state());
    ok(!st.sit && !st.on && st.marked && !st.mung && (await log()).includes('책갈피'), `중간에 일어나면 버프 없음·책갈피 (${JSON.stringify(st.bar)})`);
    const c1 = await E(() => window.__oreum.save.coins);
    await E(() => window.__oreum.bar.order('highball')); await W(300);
    st = await E(() => window.__oreum.bar.state());
    ok(st.sit && (await E(() => window.__oreum.save.coins)) === c1 && st.bar.t === 1, '책갈피: 값 없이 이어 읽음');
    await E(() => window.__oreum.bar.skip()); await W(800);
    st = await E(() => window.__oreum.bar.state());
    ok(!st.sit && st.on && Math.abs(st.bar.left - 1500) < 5 && st.bar.read.length === 1 && !st.bar.p, `15초 읽으면 '여운' 25분·읽은 편 하나 (${JSON.stringify(st.bar)})`);
    ok(Math.abs(st.mul.xp - 1.15) < 1e-6 && Math.abs(st.mul.mutter - 0.6) < 1e-6 && Math.abs(st.mul.note - 1.5) < 1e-6 && st.see > 0, `배수 ${JSON.stringify(st.mul)} · 밤눈 ${st.see}`);
    ok(/^(25|24):\d\d$/.test(st.pill || '') && (await log()).includes('여운이 남아요'), `위쪽 줄 칸·한 줄 (${st.pill})`);
    ok(await E(() => window.__oreum.stone.mul('dmg') === 1 && window.__oreum.stone.mul('speed') === 1), '싸움 수치는 그대로');
    ok(await E(() => window.__oreum.quest.state?.()?.side?.includes?.('b-read') ?? true), '곁가지 퀘스트 셈 (b-read)');
    await shot('3-buff');
    // 하루 세 번
    for (let k = 0; k < 2; k++) { await E(() => window.__oreum.bar.order()); await W(200); await E(() => window.__oreum.bar.skip()); await W(500); }
    st = await E(() => window.__oreum.bar.state());
    ok(st.today === 3 && st.bar.t === 3 && st.bar.read.length === 3 && new Set(st.bar.read).size === 3, `하루 세 번·안 읽은 편부터 (${JSON.stringify(st.bar)})`);
    const c2 = await E(() => window.__oreum.save.coins);
    ok(!(await E(() => window.__oreum.bar.order())) && (await E(() => window.__oreum.save.coins)) === c2, '네 번째는 안 됨 (귤 그대로)');
    // 다 읽으면 칭호 '애독자'
    await E(() => { const O = window.__oreum; O.bar.read([...Array(O.bar.stories - 1).keys()].map((i) => i + 1)); O.bar.day('2026-01-01'); });
    await E(() => window.__oreum.bar.order()); await W(200);
    ok((await E(() => window.__oreum.bar.state().sit?.s)) === 0, '남은 한 편이 나옴');
    await E(() => window.__oreum.bar.skip()); await W(800);
    ok(await E(() => !!window.__oreum.ach.state.badges['b-bar-all']), "다 읽으면 업적 '애독자' (칭호)");
    // 다시 읽기: 기록이 남음
    await E(() => window.__oreum.bar.left(700)); await W(6000);
    await p.reload(); await ready(); await enter();
    st = await E(() => window.__oreum.bar.state());
    ok(st.bar.t === 4 && st.bar.read.length === 20 && st.bar.left > 600 && st.bar.left <= 700 && st.on, `다시 읽어도 기록·'여운' 남은 시간 (${JSON.stringify({ t: st.bar.t, n: st.bar.read.length, left: st.bar.left })})`);
    // 끝나기 1분 전 한 줄 → 끝
    await E(() => window.__oreum.bar.left(61)); await W(2500);
    ok((await log()).includes('1분 남았어요'), '끝나기 1분 전 한 줄');
    await E(() => window.__oreum.bar.left(0.6)); await W(1500);
    st = await E(() => window.__oreum.bar.state());
    ok(!st.on && st.pill === false && st.mul.xp === 1, '버프 끝: 아이콘 사라짐·배수 1');
    ok(errs === 0, `페이지 오류 ${errs}`);
    await ctx.close();
  }
  await b.close();
  console.log(fail ? `FAIL ${fail}` : 'ALL OK');
  process.exit(fail ? 1 : 0);
})();
