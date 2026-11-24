// #270 숙소 오피스제주 확인: 닫힘 → 열림 → 숙박(귤 나감·연출·버프·아이콘·남에게 안 보임) → 하루 한 번 → 버프 끝 → 시작 자리 → 다시 읽기
// 쓰기: node build.mjs && node tools/innrun.js [d|m] [--shot]   (그림은 dist/innrun-*.jpg, --shot 일 때만)
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
    const shot = (n) => SHOT && p.screenshot({ path: `dist/innrun-${mode}-${n}.jpg`, type: 'jpeg', quality: 60, timeout: 150000 });
    const ready = () => p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
    const enter = async () => {
      await p.click('#enter').catch(() => {}); await p.click('#srv-go').catch(() => {}); await W(5000);
      await E(() => { const O = window.__oreum; try { O.look.close(); } catch { /* 없음 */ } document.body.classList.remove('tut'); for (const id of ['fs-tip']) { const el = document.getElementById(id); if (el) el.hidden = true; } });
    };
    await p.goto(URL); await ready();
    // 옛 저장 + 깨진 숙소 기록: 레벨 1, 구역 1, 귤 넉넉
    await E(() => { const O = window.__oreum; Object.assign(O.save, { entered: 1, server: 'battle', look: O.save.look || { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1, coins: 5000, inn: 'broken', shopGate: { init: 1, open: { gear: 1, manjok: 1, stone: 1, salon: 1, leap: 1, ride: 1 } } }); O.save.journey = { ...(O.save.journey || {}), maxZ: 1 }; const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum.v')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(O.save)); });
    await p.reload(); await ready(); await enter();
    let st = await E(() => window.__oreum.inn.state());
    ok(st.inn && st.inn.n === 0 && st.inn.d === '' && st.inn.left === 0, `깨진 숙소 기록은 빈 기록으로 (${JSON.stringify(st.inn)})`);
    ok(!!(await E(() => window.__oreum.inn.api)), '가게 거리에 숙소 건물');
    // 닫힘: 셔터·준비 중
    ok(!st.open && (await E(() => window.__oreum.shopGate.why('inn'))).includes('능선'), `처음엔 닫힘 ('${await E(() => window.__oreum.shopGate.why('inn'))}')`);
    await E(() => window.__oreum.inn.go()); await W(800);
    ok(await E(() => window.__oreum.aim.ctx()) !== 'bed', '닫힌 숙소 앞: 상호작용 없음');
    ok(await E(() => window.__oreum.shopGate.shutter('inn')?.visible), '닫힌 숙소 셔터');
    // 열림: 능선에 들어섬 → 감독 차례로 알림
    await E(() => { window.__oreum.save.journey.maxZ = 3; });
    ok(await until(() => JSON.stringify(window.__oreum.director.state().waiting || []).includes('shop-inn'), 20000), '능선에 들어서면 열림 알림이 감독 줄에 섬');
    await E(() => window.__oreum.shopGate.open('inn')); /* 감독 차례가 오면 하는 일 (줄 앞의 다른 말을 기다리지 않음) */
    ok(await until(() => window.__oreum.shopGate.isOpen('inn') && window.__oreum.shopGate.shutter('inn')?.visible === false, 25000), '열림: 셔터가 올라감');
    ok(await until(() => window.__oreum.quest.givers.get('shop:inn')?.root.visible === true, 5000), '주인(안녕 매니저)이 나와 있음');
    // 숙박 창
    await E(() => window.__oreum.inn.go()); await W(1000);
    ok(await until(() => window.__oreum.aim.ctx() === 'bed', 4000), `앞마당: 상호작용 '숙박' (${await E(() => window.__oreum.aim.ctx())})`);
    await E(() => window.__oreum.inn.open()); await W(400);
    const price = await E(() => window.__oreum.inn.price()), lv = await E(() => window.__oreum.level?.state?.().lv || 1);
    ok(await E(() => document.getElementById('shoppop-name').textContent === '오피스제주 O-Peace'), '창 이름');
    ok(price === Math.round((50 + lv * 30) * 0.5), `첫 숙박 반값 (Lv ${lv} → ${price})`);
    ok(await E(() => !document.getElementById('inn-stay').disabled), '[숙박하기] 누를 수 있음');
    await shot('1-pop');
    // 숙박: 귤 나감 → 연출 → 버프
    const c0 = await E(() => window.__oreum.save.coins), hp0 = await E(() => window.__oreum.hp.max);
    await E(() => window.__oreum.hp.set(10));
    if (mode === 'm') await p.tap('#inn-stay'); else await p.click('#inn-stay');
    await W(300);
    st = await E(() => window.__oreum.inn.state());
    ok(st.busy && c0 - (await E(() => window.__oreum.save.coins)) === price, `귤 ${price} 나가고 연출 시작 (${st.phase})`);
    ok(st.net?.inn === 1, `남에게 보내는 상태에 inn (${JSON.stringify(st.net)})`);
    await W(1200); st = await E(() => window.__oreum.inn.state());
    ok(st.hidden, '묵는 동안 몸이 안 보임');
    ok(await E(() => { const e = { data: { inn: 1 }, runner: { root: { scale: { s: 1, setScalar(v) { this.s = v; } } } } }; window.__oreum.inn.peer(e); return e.runner.root.scale.s < 0.01; }), '남의 화면: 묵는 사람은 안 보임');
    await shot('2-zzz');
    ok(await until(() => window.__oreum.inn.state().phase === 'sun', 5000), '아침 햇살');
    await shot('3-sun');
    ok(await until(() => !window.__oreum.inn.busy(), 5000), '5초 남짓에 일어남');
    st = await E(() => window.__oreum.inn.state());
    const hp1 = await E(() => ({ hp: window.__oreum.hp.hp, max: window.__oreum.hp.max }));
    ok(st.on && Math.abs(st.inn.left - 1800) < 5 && st.inn.n === 1 && st.today, `개운함 30분 (${JSON.stringify(st.inn)})`);
    ok(Math.abs(hp1.max - hp0 * 1.3) < 0.01 && Math.abs(hp1.hp - hp1.max) < 0.01, `기운 가득·최대 기운 ×1.3 (${hp0} → ${hp1.hp}/${hp1.max})`);
    ok(Math.abs(st.mul.speed - 1.15) < 1e-6 && Math.abs(st.mul.dmg - 1.25) < 1e-6 && Math.abs(st.mul.pick - 1.25) < 1e-6 && Math.abs(st.mul.xp - 1.2) < 1e-6, `배수 ${JSON.stringify(st.mul)}`);
    ok(await E(() => window.__oreum.stone.mul('speed') === 1.15 && window.__oreum.stone.mul('dmg') === 1.25), '이동·피해 버프가 게임 배수(buff.mul)에 들어감');
    ok(!st.hidden && /^(30|29):\d\d$/.test(st.pill || ''), `레벨 곁 아이콘·남은 시간 (${st.pill})`);
    ok(await E(() => { const a = document.getElementById('buff-pill'), b = document.getElementById('inn-pill'); return !!a && a.nextElementSibling === b; }), '아이콘이 버프 바로 곁');
    ok((await log()).includes('개운해요'), '일어나면 한 줄');
    await shot('4-buff');
    // 하루 한 번
    const c1 = await E(() => window.__oreum.save.coins);
    ok(!(await E(() => window.__oreum.inn.stay())) && (await E(() => window.__oreum.save.coins)) === c1, '같은 날 두 번은 안 됨 (귤 그대로)');
    await E(() => window.__oreum.inn.open()); await W(300);
    ok(await E(() => document.getElementById('inn-stay').disabled), '창: 오늘은 묵었어요');
    await E(() => document.getElementById('shoppop').hidden = true);
    // 쓰러져도 버프는 남음
    await E(() => window.__oreum.hp.set(0)); await W(1500);
    ok(await E(() => window.__oreum.inn.state().on), '쓰러져도 개운함은 남음');
    await until(() => !window.__oreum.hp.isDown, 30000); await W(500);
    // 끝나기 1분 전 한 줄 → 끝
    await E(() => window.__oreum.inn.left(61)); await W(2500);
    ok((await log()).includes('1분 남았어요'), '끝나기 1분 전 한 줄');
    await E(() => window.__oreum.inn.left(0.6)); await W(1500);
    st = await E(() => window.__oreum.inn.state());
    ok(!st.on && st.pill === false && st.mul.speed === 1, '버프 끝: 아이콘 사라짐·배수 1');
    ok((await log()).includes('개운함이 끝났어요'), '끝 한 줄');
    // 다시 읽기: 기록이 남고, '어디서 시작' 에 오피스제주
    await E(() => { const O = window.__oreum; O.inn.left(900); O.street.go?.(0, 5); }); await W(6000);
    await p.reload(); await ready(); await enter();
    st = await E(() => window.__oreum.inn.state());
    ok(st.inn.n === 1 && st.today && st.inn.left > 800 && st.inn.left <= 900, `다시 읽어도 기록·남은 시간 (${JSON.stringify(st.inn)})`);
    ok(await until(() => !document.getElementById('wake-pick').hidden && !document.getElementById('wake-inn').hidden, 8000), "'어디서 시작' 에 오피스제주");
    await shot('5-wake');
    const d0 = await E(() => { const O = window.__oreum, d = O.inn.api.door; return Math.hypot(O.player.pos.x - d.x, O.player.pos.z - d.z); });
    if (mode === 'm') await p.tap('#wake-inn'); else await p.click('#wake-inn');
    ok(await until(() => { const O = window.__oreum, d = O.inn.api.door; return Math.hypot(O.player.pos.x - d.x, O.player.pos.z - d.z) < 2; }, 8000), `오피스제주 앞에서 시작 (전 ${d0.toFixed(0)}m)`);
    // 퀘스트: 첫 숙박 퀘스트를 받은 뒤 묵으면 셈 (다음 날로 돌려 한 번 더)
    const q = await E(() => { const O = window.__oreum, Q = O.quest; return { has: !!Q.givers.get('shop:inn') }; });
    ok(q.has, '안녕 매니저(곁가지 퀘스트 주는 사람)');
    ok(errs === 0, `페이지 오류 ${errs}`);
    await ctx.close();
  }
  await b.close(); console.log(fail ? `${fail} FAIL` : 'all ok'); process.exit(fail ? 1 : 0);
})();
