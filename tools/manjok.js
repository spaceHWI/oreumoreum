// 고진의 파란장화·만족한상회 확인 (#167): node tools/manjok.js [--shot]
// 장화 사기·신기·벗기(빠르기·점수·겉모습)·옛 저장, 만족한상회 메뉴·식사·버프(받는 피해·범위·두 가지 버프)
const { chromium } = require('playwright');
const SHOT = process.argv.includes('--shot');
let fails = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 640 } }); let errs = 0; p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
  const W = (ms) => p.waitForTimeout(ms), E = (f, a) => p.evaluate(f, a);
  const shot = (n) => SHOT && p.screenshot({ path: `dist/manjok-${n}.jpg`, type: 'jpeg', quality: 60, timeout: 150000 });
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await W(5000);
  // 옛 저장(장화 칸 없음, 이상한 값)으로 시작
  await E(() => { const o = window.__oreum; Object.assign(o.save, { entered: 1, look: o.save.look || { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1, mealFree: 1, shopGate: { init: 1, open: { gear: 1, manjok: 1, stone: 1, salon: 1, leap: 1 } } }); /* #206 뒤로 가게가 차례로 열림: 확인할 가게는 열어 둠 (#270 에서 낡은 검사 고침) */ o.save.equip.boots = 'x'; o.save.buff = { id: 'nope', left: 30 }; const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum.v')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await W(5000); await p.click('#enter').catch(() => {}); await W(5000);
  if (await E(() => !document.getElementById('look').hidden)) { await p.click('#look-ok'); await W(1500); }
  ok(await E(() => window.__oreum.save.equip.boots === 0 && !window.__oreum.save.buff), '옛·깨진 저장: 장화 0, 버프 지움');
  await E(() => { const o = window.__oreum; o.setTod(14); o.save.coins = 99999; o.save.equip.shoes = 2; });
  // 장화: LEAP 신발 칸에 카드
  await E(() => { const o = window.__oreum; o.leap.go(); o.leap.open(); o.leap.slot('shoes'); }); await W(500);
  const items = await E(() => window.__oreum.leap.items('shoes').map((i) => i.id));
  ok(items.includes('shoes:boots'), `LEAP 신발 칸에 장화 (${items.join(',')})`);
  ok(await E(() => { const o = window.__oreum; o.leap.pick('shoes:boots'); return o.save.outfit.gear.shoes !== 'shoes:boots'; }), '입어 보기는 저장 안 함');
  await shot('1-leap');
  ok(await E(() => window.__oreum.leap.buy('shoes:boots')), '장화 사기');
  const st = await E(() => { const o = window.__oreum; return { b: o.save.equip.boots, g: o.save.outfit.gear.shoes, c: o.save.coins }; });
  ok(st.b === 2 && st.g === 'shoes:boots', `사면 바로 신음 (${JSON.stringify(st)})`);
  // 빠르기: 신은 채 걸으면 1.35 배
  const spd = await E(async () => { const o = window.__oreum; document.getElementById('shoppop').hidden = true; o.street.go(0, 20); const p = o.player; const x0 = p.pos.x, z0 = p.pos.z; o.keys.add('w'); await new Promise((r) => setTimeout(r, 1200)); o.keys.delete('w'); return p.speed; });
  console.log('   speed with boots', spd);
  ok(await E(() => { const o = window.__oreum; o.leap.open(); o.leap.slot('shoes'); o.leap.pick('shoes:2'); return o.save.equip.boots === 1 && o.save.outfit.gear.shoes === 'shoes:s2'; }), '가진 단계 신발을 누르면 장화를 벗음');
  ok(await E(() => { const o = window.__oreum; o.leap.pick('shoes:boots'); return o.save.equip.boots === 2; }), '다시 누르면 신음');
  // 만족한상회
  const mj = await E(() => { const o = window.__oreum; return { has: !!o.manjok, shops: o.street.shops.map((s) => s.id), ctx: o.interactables.filter((i) => i.shop === 'manjok').length }; });
  ok(mj.has && mj.shops.includes('manjok'), `가게 거리에 만족한상회 (${mj.shops})`);
  await E(() => { document.getElementById('shoppop').hidden = true; window.__oreum.manjok.go(); }); await W(800);
  ok(await E(() => window.__oreum.aim.ctx()) === 'eat', `평상 앞 상호작용 '식사' (${await E(() => window.__oreum.aim.ctx())})`);
  await E(() => window.__oreum.manjok.open()); await W(400);
  const menu = await E(() => [...document.querySelectorAll('#shoppop-cards .menu-card')].map((c) => c.dataset.id));
  ok(menu.length === 5 && menu.includes('tonggalchi'), `메뉴 5개 (${menu})`);
  ok(await E(() => document.getElementById('shoppop-name').textContent === '만족한상회'), '창 이름');
  await shot('2-menu');
  const c0 = await E(() => window.__oreum.save.coins);
  await E(() => window.__oreum.manjok.order('tonggalchi')); await W(4000);
  ok(await E(() => window.__oreum.stone.meal().on), '평상으로 가서 먹는 중');
  await shot('3-eat');
  await E(() => window.__oreum.stone.finish()); await W(300);
  const bf = await E(() => { const o = window.__oreum; return { id: o.save.buff?.id, dmg: o.stone.mul('dmg'), sp: o.stone.mul('speed'), c: o.save.coins }; });
  ok(bf.id === 'tonggalchi' && Math.abs(bf.dmg - 1.3) < 1e-6 && Math.abs(bf.sp - 1.1) < 1e-6 && c0 - bf.c === 320, `통갈치한상 버프 피해×1.3·이동×1.1, 귤 320 (${JSON.stringify(bf)})`);
  for (const [id, k, v] of [['manjok', 'guard', 0.2], ['hwanggae', 'gyulR', 1]]) {
    await E((id) => { window.__oreum.manjok.order(id); }, id); await W(300); await E(() => window.__oreum.stone.finish());
    ok(await E(([k]) => window.__oreum.stone.api && window.__oreum.save.buff && window.__oreum.stone.buff.add(k), [k]) === v, `${id} → ${k} ${v}`);
  }
  ok(await E(() => document.getElementById('buff-pill').title.includes('귤 모으는 범위')), '버프 표시 글');
  // 주인 (#279): 문 옆 사장님, '갈치는 뼈가 없다' 퀘스트 셈·고등어구이 한 번 할인권·식사 뒤 말
  const ow = await E(() => { const o = window.__oreum, g = o.quest.givers.get('shop:satis'); return g && { vis: g.root.visible, shop: g.def.shop, d: +Math.hypot(g.pos.x - o.manjok.api.terrace.x, g.pos.z - o.manjok.api.terrace.z).toFixed(1) }; });
  ok(ow && ow.vis && ow.shop === 'manjok' && ow.d < 7, `만족한상회 주인이 가게 앞에 (${JSON.stringify(ow)})`);
  const mq = await E(() => { const o = window.__oreum, Q = o.quest.api; const sq = o.save.quest; sq.done = (sq.done || []).filter((x) => x !== 'm-eat'); if (!Q.accept('m-eat')) sq.side['m-eat'] = { base: { satisMeal: sq.c?.satisMeal | 0 }, r: 0 }; /* 가게 퀘스트 문(shopQuests)이 아직이면 바로 받은 것으로 */ o.manjok.order('galchigui'); o.stone.finish(); const pr = Q.prog('m-eat'), rd = Q.ready('m-eat'); const r = o.quest.done('m-eat'); return { pr, rd, cp: o.save.quest.cp?.satis | 0, r: !!r }; });
  ok(mq.pr === 1 && mq.rd && mq.r && mq.cp === 1, `만족한상회 식사가 퀘스트로 셈, 보상 할인권 (${JSON.stringify(mq)})`);
  const cpu = await E(() => { const o = window.__oreum, c0 = o.save.coins; o.manjok.order('godeungeo'); const c1 = o.save.coins; o.stone.finish(); return { paid: c0 - c1, cp: o.save.quest.cp?.satis | 0 }; });
  ok(cpu.paid === 0 && cpu.cp === 0, `할인권으로 고등어구이 한 번 (${JSON.stringify(cpu)})`);
  ok(await E(() => { const o = window.__oreum, c0 = o.save.coins; o.manjok.order('godeungeo'); const d = c0 - o.save.coins; o.stone.finish(); return d === 150; }), '할인권을 쓴 뒤엔 값을 냄');
  ok(await E(() => { const o = window.__oreum, so = o.social, f = so?.showBubble, said = []; if (!so) return false; so.showBubble = (k, r, t, y) => { said.push([k, t]); return f(k, r, t, y); }; o.manjok.order('galchigui'); o.stone.finish(); so.showBubble = f; return said.some(([k, t]) => k === 'npc-q-shop:satis' && /만족|뼈|쓰레기/.test(t)); }), '식사 뒤 사장님 말풍선');
  // 가게 겉모습
  await E(() => { const o = window.__oreum, m = o.manjok.api; o.player.pos.set(m.terrace.x, o.groundAt(m.terrace.x, m.terrace.z), m.terrace.z); o.player.heading = Math.atan2(m.center.x - m.terrace.x, m.center.z - m.terrace.z) + Math.PI; o.snap(); }); await W(800);
  await shot('4-shop');
  ok(errs === 0, `페이지 오류 ${errs}`);
  await b.close(); console.log(fails ? `${fails} FAIL` : 'all ok'); process.exit(fails ? 1 : 0);
})();
