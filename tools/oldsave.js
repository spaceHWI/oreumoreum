// 예전·깨진 저장으로 들어와도 오류가 없는지 (#16). node tools/oldsave.js
const { chromium } = require('playwright');
const SAVES = {
  empty: {},
  v0: { nick: '예전 사람', coins: 321, equip: { tool: 3 }, outfit: { hat: { type: 'cap', color: '#222222' } }, owned: { 'shirt:tee:#ff0000': 1 }, totalSteps: 999, nsV1: 1, ach: { done: {} } },
  broken: { nick: '깨진 사람', coins: 'abc', equip: 5, clothes: 3, rides: 'x', trash: { srv: 1, bag: null, dex: 7 }, ach: { daily: 3, life: null, badges: [] }, tut: 'x', look: { sex: 'q', skin: 99 }, hairs: 2, buff: { id: 'nope', left: 5 }, recycle: [], server: 'nope', wishes: null },
  old8: { nick: '8일 전 사람', coins: 777, music: 0, gfx: 'low', lastSeen: Date.now() - 8 * 864e5 },
  midV: { nick: '중간 사람', coins: 1500, equip: { tool: 2, bag: 1, shoes: 2, weapon: 9 }, nsV1: 1, nsV2: 1, nsV3: 1, tut: { step: 4, done: false, v: 2 }, bagV: 1, server: 'battle', trash: { srv: { battle: { sig: 'old', heaps: [1, 2] } }, bag: { can: 3 } } },
  // #138: 들판 기록이 깨진 저장 · 예전 더미 서명(h1)
  field: { nick: '들판 사람', coins: 50, entered: 1, tut: { step: 99, done: true, v: 3 }, field: { den: 'x', tr: { d: 'q', got: 5 }, sight: 'a', fog: '!!!' }, trash: { srv: { battle: { sig: 'h1:1s10', heaps: [3, 4] } } } },
  field2: { nick: '들판 사람2', coins: 50, entered: 1, tut: { step: 99, done: true, v: 3 }, field: { den: { 'd2-0': -5, x: 'y' }, tr: { d: 1, got: ['t1-0'] }, sight: ['sight:0', 7], fog: 'AAAA' } },
  // #176: 감독 기록이 깨진 저장
  journey: { nick: '감독 사람', coins: 50, entered: 1, tut: { step: 99, done: true, v: 3 }, jeong: 1, journey: { step: 'x', seen: 7, day: 3, n: 'q' }, pace: { first: 1, bloomed: 1, hint: { w: 3, t: 1 } } },
  // #155: 기본 옷 색 번호가 깨진 저장
  lookc: { nick: '색 사람', coins: 50, entered: 1, tut: { step: 99, done: true, v: 3 }, jeong: 1, look: { sex: 'f', skin: 2, colors: { hat: 99, top: 'x', bottom: -3, shoes: 2.5 } } },
  // #98: 깨끗한 오름 기록 → 전투 오름으로 (장비·귤·치운 양 그대로, 랭킹 기록은 battle 에 더함)
  clean: { nick: '깨끗한 사람', coins: 4321, equip: { tool: 3, bag: 2, shoes: 1, weapon: 2 }, nsV1: 1, nsV2: 1, nsV3: 1, entered: 1, look: { sex: 'f', skin: 1 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, server: 'clean', srvSwitch: 1,
    trash: { total: 900, srv: { clean: { sig: 'old', heaps: [0, 0] } }, bag: { can: 2 }, rk: { d: 0, w: 0, day: { clean: 5, battle: 1 }, week: { clean: 50, battle: 10 }, all: { clean: 800, battle: 100 } } } },
  // #140: 깨진 재료·등급·강화·안 쓰는 장비 · 예전 우두머리 귀한 재료(이름)는 재료 주머니로
  loot: { nick: '전리품 사람', coins: 90, entered: 1, tut: { step: 99, done: true, v: 3 }, equip: { tool: 2, bag: 1, shoes: 1, weapon: 2 }, mats: { m1: -3, zz: 5, m2: 'x', m3: 4 }, gearUp: { tool: { g: 9, e: 7 }, foo: 1, bag: 'x' }, clothes: { own: {}, wear: {}, up: 'x' }, loot: [{ s: 'tool', t: 99 }, 5, { s: 'hat', t: 2, g: 1, e: 2 }, { s: 'weapon', t: 2, g: 2, e: 0 }], lootAuto: 'q', boss: { mats: { '대장 들개 이빨': 2 }, done: {}, beat: {}, log: {} } },
};
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  let bad = 0;
  for (const [name, data] of Object.entries(SAVES)) {
    const ctx = await b.newContext({ viewport: { width: 480, height: 300 } }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
    await p.addInitScript((d) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', 1); localStorage.setItem('oreumoreum.dev', d); localStorage.setItem('oreumoreum.v1', d); } }, JSON.stringify(data));
    await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await p.waitForTimeout(8000);
    await p.click('#enter', { timeout: 30000 }).catch(() => {}); await p.waitForTimeout(800);
    await p.waitForTimeout(5000);
    if (await p.evaluate(() => !document.getElementById('look').hidden).catch(() => false)) { await p.click('#look-ok').catch(() => {}); await p.waitForTimeout(1500); }
    const st = await p.evaluate(() => { const o = window.__oreum; return { frames: o.renderer.info.render.frame, coins: o.save.coins, equip: o.save.equip, tut: o.save.tut?.step, ls: !!o.save.lastSeen, expMsg: !document.getElementById('intro-expired').hidden, g: document.getElementById('guest-days').textContent, srv: o.save.server, slots: Object.keys(o.save.trash?.srv || {}), total: o.save.trash?.total, rkAll: o.save.trash?.rk?.all, mats: o.save.mats, up: o.save.gearUp, nloot: o.save.loot?.length, step: !document.querySelector('#intro-step, #intro-srv, #srv-go, #menu-server') }; }).catch((e) => ({ fail: e.message.slice(0, 120) }));
    await p.waitForTimeout(2000);
    const f2 = await p.evaluate(() => window.__oreum.renderer.info.render.frame).catch(() => -1);
    console.log(name, JSON.stringify(st), 'frames+', f2 - (st.frames || 0), errs.length ? 'ERR ' + errs.join(' | ') : 'ok');
    if (errs.length || st.fail || !(f2 > (st.frames || 0))) bad++;
    if (!st.step || (st.srv && st.srv !== 'battle')) { bad++; console.log(name, '서버 고르기 흔적·clean 이 남음'); }
    if (name === 'clean' && !(st.coins === 4321 && st.equip.tool === 3 && st.equip.weapon === 2 && st.total === 900 && st.slots.join() === 'battle' && st.rkAll?.battle === 900 && !('clean' in st.rkAll))) { bad++; console.log(name, '옮기기 실패'); }
    if (name === 'loot' && !(st.mats?.r2 === 2 && st.mats?.m3 === 4 && !('m1' in st.mats) && !('zz' in st.mats) && st.up?.tool?.g === 3 && st.up.tool.e === 5 && st.nloot <= 2)) { bad++; console.log(name, '전리품 저장 바로잡기 실패'); }
    await ctx.close();
  }
  console.log(bad ? `문제 ${bad}` : '모두 통과'); await b.close();
})();
