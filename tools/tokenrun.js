// 징표 (#255): node tools/tokenrun.js
// 1) 서버 셈(브라우저 없이): 한 판 징표는 상한까지만, 쉬는 시간 안 두 번째 버팀 거절, 귤로는 못 삼(징표 없이 산 무기는 되돌림), 옛 저장은 징표 0
// 2) 게임(dist/test.html 남송이): 구역 1 터 한 판을 버팀(시간을 끝 무렵으로) → 징표 얻음 → 좌판 창에 무기·옷 → 귤이 많아도 징표가 모자라면 못 삼
//    → 징표로 연발 1단계 삼 → 징표 줄어듦 → 들면 무기가 연발 값 · 옷 입은 칸은 싸움 값/줍기 몫 없음 · 차림 묶음 저장·입기 · 징을 칠 때 묻기
const { chromium } = require('playwright');
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) fail++; };
(async () => {
  /* ---------- 1) 서버 ---------- */
  const { checkSave, FRESH } = await import('../server/src/validate.js');
  const { TOKEN, SWARM } = await import('../src/balance.js');
  const { runMax, armPrice } = await import('../src/token.js');
  const t = Date.now(), acc = { credit: 0, pickCredit: 1e6, bank: 0, savedAt: t - 60000, cred: {} };
  const P = { ...JSON.parse(JSON.stringify(FRESH)), coins: 1000, nick: '징지기', tok: { n: 0, got: 0, own: {}, rec: {} } };
  let r = checkSave(P, { ...P, tok: { n: 6, got: 6, own: {}, rec: { 1: { at: t, n: 6, win: 1 } } } }, acc, t);
  ok(!r.fixed.includes('tok') && r.save.tok.n === 6, `구역 1 버틴 판 징표 6(상한) 인정 (${r.save.tok.n})`);
  const r2 = checkSave(r.save, { ...r.save, tok: { ...r.save.tok, n: 12, got: 12, rec: { 1: { at: t + 60000, n: 6, win: 1 } } } }, { ...r.acc, savedAt: t }, t + 60000);
  ok(r2.fixed.includes('tok') && r2.save.tok.n === 6, `쉬는 시간 안에 같은 구역 두 번째 버팀은 거절 (${r2.save.tok.n})`);
  const r3 = checkSave(P, { ...P, tok: { n: 999, got: 999, own: {}, rec: { 2: { at: t, n: 999, win: 1 } } } }, acc, t);
  ok(r3.fixed.includes('tok') && r3.save.tok.n === runMax(2), `상한 넘는 징표는 구역 2 상한 ${runMax(2)} 로 깎음 (${r3.save.tok.n})`);
  const r4 = checkSave(P, { ...P, coins: 1000, tok: { n: 0, got: 0, own: { rapid: 1 }, arm: 'rapid', rec: {} } }, acc, t);
  ok(r4.fixed.includes('tokItems') && !r4.save.tok.own.rapid && r4.save.coins === 1000, '징표 없이(귤만 있고) 산 연발은 되돌림, 귤은 그대로');
  const r5 = checkSave({ ...P, tok: { n: 20, got: 20, own: {}, rec: {} } }, { ...P, tok: { n: 20 - armPrice('rapid', 1), got: 20, own: { rapid: 1 }, arm: 'rapid', rec: {} } }, acc, t);
  ok(!r5.fixed.length && r5.save.tok.own.rapid === 1, `징표로 산 연발(${armPrice('rapid', 1)})은 그대로`);
  const r6 = checkSave({ ...P, tok: { n: 20, got: 20, own: {}, rec: {} } }, { ...P, tok: { n: 20, got: 20, own: { rapid: 1 }, rec: {} } }, acc, t);
  ok(r6.fixed.includes('tok') && r6.save.tok.n === 20 - armPrice('rapid', 1), `값을 안 빼고 산 것은 남은 징표를 깎음 (${r6.save.tok.n})`);
  const cl = { ...P, tok: { n: 0, got: 0, own: {}, rec: {} } }, r7 = checkSave(cl, { ...cl, clothes: { own: { 'top:t-gong': 1 }, wear: { top: 'top:t-gong' } } }, acc, t);
  ok(r7.fixed.includes('tokItems') && !r7.save.clothes.own['top:t-gong'] && !r7.fixed.includes('items'), '징표 없이 가진 징표 옷은 되돌림(귤 값으로 보지 않음)');
  const old = checkSave({ ...JSON.parse(JSON.stringify(FRESH)), coins: 50, nick: '옛사람' }, { ...JSON.parse(JSON.stringify(FRESH)), coins: 50, nick: '옛사람' }, acc, t);
  ok(old.save.tok && old.save.tok.n === 0 && !old.fixed.length, '옛 저장(tok 없음)은 징표 0 으로');
  let bucket = checkSave(P, P, acc, t).acc.cred.tk; ok(bucket === TOKEN.server.burst, `징표 통 ${bucket}`);
  { let s = P, a = { ...acc, savedAt: t, cred: { tk: 0 } }; const x = checkSave(s, { ...s, tok: { n: 4, got: 4, own: {}, rec: { 1: { at: t, n: 4, win: 0 } } } }, a, t); ok(x.save.tok.n === 0 && x.fixed.includes('tok'), '통이 빈 채 징표는 거절'); }
  void SWARM;

  /* ---------- 2) 게임 ---------- */
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 400 } });
  const errs = []; p.on('pageerror', (e) => { errs.push(e.message); console.log('ERR', e.message.slice(0, 300)); });
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1, recycle: { visits: 3 }, swarm: { seen: 1, best: {} } }); delete o.save.tok; const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.click('#enter', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1500);
  await p.evaluate(() => { const o = window.__oreum; o.pace.pacing.test.first.done = true; o.pace.pacing.test.first.bloomed = true; o.setTod(13); o.setWeather('clear'); o.director.open('field'); });
  await p.waitForFunction(() => !!window.__oreum.tok, null, { timeout: 20000 });
  const s0 = await p.evaluate(() => window.__oreum.tok.state());
  ok(s0.n === 0 && !s0.arming, `옛 저장으로 시작: 징표 0 (${s0.n})`);
  const st = await p.evaluate(() => window.__oreum.tok.stalls());
  ok(st.length >= 5, `좌판 ${st.length}곳 (${st.map((s) => s.zone).join(',')})`);
  // 한 판 버팀
  await p.evaluate(() => { const o = window.__oreum; o.enemies.test.clear(); o.swarm.clearRest(); o.swarm.start(1); });
  await p.waitForTimeout(500);
  await p.evaluate(() => { const o = window.__oreum, s = o.swarm.state(); o.swarm.t(s.T - 1.5); window.__god = setInterval(() => { o.hp.set(o.hp.max); o.player.knock = null; }, 50); });
  await p.waitForFunction(() => !window.__oreum.swarm.state() && window.__oreum.swarm.last, null, { timeout: 60000 });
  const s1 = await p.evaluate(() => { clearInterval(window.__god); const o = window.__oreum; return { ...o.tok.state(), last: o.swarm.last, tl: o.tok.last }; });
  const want = await p.evaluate(() => window.__oreum.tok.runTokens({ zone: 1, win: true, leader: false, clean: true, waves: 6 }));
  ok(s1.last.why === 'win' && s1.n === want && s1.rec[1]?.win === 1 && s1.rec[1]?.n === want, `구역 1 버팀 → 징표 ${s1.n} (기대 ${want}), 기록 ${JSON.stringify(s1.rec[1])}`);
  // 좌판 창
  await p.evaluate(() => { const o = window.__oreum; o.tok.go(1); o.save.coins = 99999; o.tok.open(1); });
  await p.waitForTimeout(300);
  const c0 = await p.evaluate(() => ({ open: window.__oreum.tok.shopOpen(), cards: window.__oreum.tok.cards(), coins: document.getElementById('shoppop-coins').textContent }));
  ok(c0.open && c0.cards.some((c) => c.id === 'rapid') && c0.cards.some((c) => c.id === 'top:t-gong') && !c0.cards.some((c) => c.id === 'blast'), `구역 1 좌판: 연발·옷 2칸, 폭발 없음 (${c0.cards.map((c) => c.id).join(',')}) · 위 숫자 ${c0.coins}`);
  ok(c0.coins === String(s1.n), '좌판 위 숫자는 귤이 아니라 징표');
  const poor = await p.evaluate(() => { const o = window.__oreum, c = o.save.coins, r = o.tok.buyArm('rapid', 1); return { r, coins: o.save.coins === c, n: o.tok.state().n }; });
  ok(!poor.r && poor.coins, `징표가 모자라면(귤 99999 있어도) 못 삼 (징표 ${poor.n})`);
  const bought = await p.evaluate(() => { const o = window.__oreum; o.tok.give(20, 1, false); const n0 = o.tok.state().n, c = o.save.coins, r = o.tok.buyArm('rapid', 1), s = o.tok.state(); return { r, n0, n: s.n, coins: o.save.coins === c, arm: s.arming, w: s.weapon, dmg: s.dmg }; });
  const pr = armPrice('rapid', 1);
  ok(bought.r && bought.n === bought.n0 - pr && bought.coins, `징표로 연발 1단계 삼: ${bought.n0} → ${bought.n} (값 ${pr}), 귤 그대로`);
  ok(bought.arm === 'rapid' && bought.w === 'mg' && bought.dmg === TOKEN.arms[0].lv[0].dmg, `든 무기 = 연발 (쏘는 방식 ${bought.w}, 피해 ${bought.dmg})`);
  const fire = await p.evaluate(async () => { const o = window.__oreum; o.enemies.test.clear(); o.save.coins = 500; o.weapon.fire(); await new Promise((r) => setTimeout(r, 400)); return { ok: true }; });
  ok(fire.ok && !errs.length, '연발 쏘기 오류 없음');
  // 귤 무기를 고르면 내려놓음
  const back = await p.evaluate(() => { const o = window.__oreum; o.weapon.use(1); o.weapon.set(o.save.equip.weapon); const a = o.tok.state().arming; o.tok.hold('rapid'); return { a, b: o.tok.state().arming }; });
  ok(back.b === 'rapid', `내 가방에서 다시 들 수 있음 (${back.a} → ${back.b})`);
  // 옷
  const cl1 = await p.evaluate(() => { const o = window.__oreum; o.tok.give(40, 1, false); const cap0 = o.clothes.bagCap(), hp0 = o.hp.max; const a = o.tok.buyCloth('top:t-gong', 1), b = o.tok.buyCloth('socks:t-gong', 1); const c = o.tok.buyCloth('vest:t-gong', 1); return { a, b, c, hp0, hp1: o.hp.max, top: o.tok.wearV('top'), cap0, cap1: o.clothes.bagCap() }; });
  ok(cl1.a && cl1.b && !cl1.c && cl1.hp1 >= cl1.hp0, `옷 2칸 삼(구역 1), 띠는 구역 1 좌판에 없음 · 기운 ${cl1.hp0} → ${cl1.hp1}`);
  const lost = await p.evaluate(() => { const o = window.__oreum; o.tok.give(40, 1, false); o.tok.buyCloth('bottom:t-gong', 5); return { lost: o.tok.lost(), v: o.tok.wearV('bottom') }; });
  ok(lost.lost.length === 1 && lost.v === 0, `바지 칸은 줍기 몫(주머니) 0 · 내 가방에 '${lost.lost.join(',')}' 줄어듦 표시`);
  // 차림 묶음 + 징 묻기
  const kit = await p.evaluate(() => { const o = window.__oreum; o.tok.saveKit('fight'); o.clothes.wear('top', 'top:w-tee'); o.weapon.use(1); o.swarm.clearRest(); const a = o.arena.list()[0]; o.player.pos.set(a.gong.x + 1, a.gong.y, a.gong.z + 1); const w = o.swarm.gong(a.zone); return { w, asking: o.tok.asking(), run: !!o.swarm.state(), zone: a.zone }; });
  ok(kit.w === '' && kit.asking && !kit.run, '싸움 차림이 다르면 징을 칠 때 한 번 묻고, 고르기 전엔 판이 안 열림');
  const kit2 = await p.evaluate(() => { const o = window.__oreum; o.tok.answer(true); const s = o.tok.state(); return { run: !!o.swarm.state(), arm: s.arming, top: o.save.clothes.wear.top }; });
  ok(kit2.run && kit2.arm === 'rapid' && kit2.top === 'top:t-gong', `'갈아입기' → 싸움 차림(${kit2.top}·${kit2.arm}) 입고 판 시작`);
  await p.evaluate(() => window.__oreum.swarm.stop());
  await b.close();
  console.log(errs.length ? `페이지 오류 ${errs.length}` : '페이지 오류 없음', fail ? `· 실패 ${fail}` : '· ALL OK');
  process.exit(fail || errs.length ? 1 : 0);
})();
