// 동료 캐릭터 확인 (#172)
//   node tools/buddies.js          (먼저 node build.mjs) 방 규칙(roomcore btake)과 게임을 둘 다 해 봄
//   node tools/buddies.js --shot   셋이 선 모습 한 장을 notes/shots/buddies.png 에 (작게)
// 방: btake 는 더미를 줄이지만 번 몫(takeEarned)엔 안 셈·마지막 keep 은 남김·줍기 몫(takeTok)을 같이 씀
// 게임: 대사 25줄씩·문이 열리면 나옴·말 걸기 창·같이 가요·몫(share) 없으면 안 줄임/있으면 그만큼만·마지막 keep 남김·민수가 적을 맞힘·
//       사람이 많으면 줄어듦·설정으로 끔·감정 표현 따라 함·저장(save) 에 동료 기록이 안 섞임
const path = require('path');
const ok = (c, m) => { console.log((c ? '통과 ' : '실패 ') + m); if (!c) process.exitCode = 1; };
const shot = process.argv.includes('--shot');
(async () => {
  /* ---------- 방 규칙 ---------- */
  const { createRoomCore } = await import('../server/src/roomcore.js');
  const { HEAP_FULL } = await import('../server/src/heaps.js');
  const { BUDDIES, NET } = await import('../src/balance.js');
  let T = 1e12; const core = createRoomCore({ now: () => T });
  const got = []; const p = core.join((s) => got.push(JSON.parse(s)), { acct: 'a1' });
  const h = HEAP_FULL.findIndex((n) => n >= 10), keep = Math.ceil(HEAP_FULL[h] * BUDDIES.keep);
  for (let i = 0; i < HEAP_FULL[h] + 5; i++) { T += 100; core.message(p, JSON.stringify({ t: 'btake', h })); }
  core.step();
  ok(core.heaps()[h] === keep, `방: btake 로 더미 ${HEAP_FULL[h]} → ${core.heaps()[h]} (마지막 ${keep} 남김)`);
  ok(core.takeEarned() === null, '방: btake 는 번 몫에 안 셈 (동료 몫이 내 귤로 안 잡힘)');
  const h2 = HEAP_FULL.findIndex((n, i) => i !== h && n >= NET.takePerSec * 2);
  for (let i = 0; i < NET.takePerSec * 2; i++) core.message(p, JSON.stringify({ t: 'btake', h: h2 }));
  ok(HEAP_FULL[h2] - core.heaps()[h2] <= NET.takePerSec, `방: 한꺼번에 btake 는 줍기 몫(초당 ${NET.takePerSec}) 안에서만 (${HEAP_FULL[h2] - core.heaps()[h2]})`);
  T += 2000; core.message(p, JSON.stringify({ t: 'take', h: h2 })); core.step();
  ok((core.takeEarned() || []).length === 1, '방: 보통 줍기(take)는 그대로 번 몫');

  /* ---------- 대사 ---------- */
  const { LINES } = await import('../src/buddylines.js');
  for (const d of BUDDIES.list) ok(LINES[d.id]?.talk?.length >= 25, `대사: ${d.name} ${LINES[d.id]?.talk?.length}줄`);
  const early = BUDDIES.list.flatMap((d) => LINES[d.id].talk.filter(([w, t]) => !/c4|c5/.test(w) && /클린하우스/.test(t) && /외계|UFO|그 녀석|원래/.test(t)));
  ok(!early.length, '대사: 4장 전에는 외계인과 클린하우스를 잇지 않음' + (early.length ? ' ' + early.map((x) => x[1]).join(' / ') : ''));

  /* ---------- 게임 ---------- */
  const { chromium } = require('playwright');
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 480, height: 300 } }); const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message.slice(0, 300)));
  pg.on('console', (m) => { if (m.type() === 'error' && /오름오름 오류/.test(m.text())) errs.push(m.text().slice(0, 300)); });
  await pg.goto('file://' + path.join(__dirname, '../dist/test.html') + '#namsongi'); await pg.waitForTimeout(6000);
  await pg.evaluate(() => { const o = window.__oreum; o.save.entered = 1; o.save.look = { sex: 'm', skin: 0 }; o.save.hairs = o.save.hairs || {}; o.save.tut = { step: 99, done: true, v: 3 }; o.save.jeong = 1; o.save.soundOff = 1; o.save.tipsSeen = o.save.tipsSeen || {}; o.save.equip.tool = 2; o.save.equip.bag = 1; });
  await pg.reload(); await pg.waitForTimeout(6000);
  await pg.click('#enter').catch(() => {}); await pg.waitForTimeout(4000);
  await pg.evaluate(() => { const o = window.__oreum; if (o.tut?.active) o.tut.skipAll(); o.cam.mode = 'follow'; document.body.classList.remove('tut'); for (const id of ['tut-toast', 'intro-help', 'intro']) { const e = document.getElementById(id); if (e) e.hidden = true; } });
  if (!(await pg.evaluate(() => !!window.__oreum.buddies))) { console.log('동료가 꺼져 있음 (#190 BUDDIES.on): 화면 검사 건너뜀'); await b.close(); return; }
  const r0 = await pg.evaluate(async () => { const o = window.__oreum, W = (ms) => new Promise((r) => setTimeout(r, ms)); await W(1500); return { list: o.buddies.list(), st: o.buddies.state(), open: o.director.state().open }; });
  console.table(r0.list);
  ok(r0.list.find((x) => x.id === 'sunja').on && !r0.list.find((x) => x.id === 'minsu').on, `문: 정낭을 나섰으면 순자 삼춘만 (${r0.st.allowed})`);
  const low = await pg.evaluate(async () => { const o = window.__oreum, W = (ms) => new Promise((r) => setTimeout(r, ms)); o.buddies.come('minsu'); o.buddies.come('jenny'); await W(800); return { tier: o.quality.tier, n: o.buddies.list().filter((x) => x.on).length }; });
  if (low.tier === 0) ok(low.n === 1, `저사양(단계 0)은 동료 1명 (${low.n})`);
  // 보통 단계로 다시 (?tier=1)
  await pg.goto('file://' + path.join(__dirname, '../dist/test.html') + '?tier=1#namsongi'); await pg.waitForTimeout(6000);
  await pg.click('#enter').catch(() => {}); await pg.waitForTimeout(4000);
  await pg.evaluate(() => { const o = window.__oreum; if (o.tut?.active) o.tut.skipAll(); o.cam.mode = 'follow'; document.body.classList.remove('tut'); for (const id of ['tut-toast', 'intro-help', 'intro']) { const e = document.getElementById(id); if (e) e.hidden = true; } });
  const fps = await pg.evaluate(async () => { const o = window.__oreum, f0 = o.renderer.info.render.frame; await new Promise((r) => setTimeout(r, 3000)); return (o.renderer.info.render.frame - f0) / 3; });
  console.log('fps', fps.toFixed(1));
  // 셋 다 불러 세움
  const r1 = await pg.evaluate(async () => {
    const o = window.__oreum, W = (ms) => new Promise((r) => setTimeout(r, ms)), Bd = o.buddies;
    Bd.come('minsu'); Bd.come('jenny'); Bd.come('sunja'); await W(800);
    const L = Bd.list(); return { L, ok: L.every((x) => x.on && x.visible && x.d < 30) };
  });
  ok(r1.ok, '셋 다 내 둘레에 나옴: ' + r1.L.map((x) => `${x.id} ${x.d}m`).join(', '));
  if (shot) {
    await pg.evaluate(() => { const o = window.__oreum; o.buddies.mates.forEach((m, i) => { const a = o.player.heading + (i - 1) * 0.45; m.pos.set(o.player.pos.x + Math.sin(a) * 5, 0, o.player.pos.z + Math.cos(a) * 5); m.pos.y = o.groundAt(m.pos.x, m.pos.z); m.heading = a + Math.PI; m.wait = 30; m.route = null; }); o.buddies.bank = 0; });
    await pg.waitForTimeout(1200); await pg.screenshot({ path: path.join(__dirname, '../notes/shots/buddies.png') });
  }
  // 말 걸기·같이 가요
  const r2 = await pg.evaluate(async () => {
    const o = window.__oreum, W = (ms) => new Promise((r) => setTimeout(r, ms)), Bd = o.buddies;
    Bd.come('sunja'); await W(300);
    Bd.talk('sunja'); await W(200);
    const win = !document.getElementById('mate-talk').hidden, line = document.querySelector('#mate-talk .mt-line').textContent;
    document.getElementById('mt-follow').click(); await W(200);
    const st = Bd.state();
    const p0 = o.player.pos.clone(); let q = null; for (let a = 0; a < 6.28 && !q; a += 0.4) { const x = p0.x + Math.sin(a) * 20, z = p0.z + Math.cos(a) * 20; if (!o.col.blocked(x, z, 0.6) && o.trash.api.trail.dist(x, z, 40) < 4) q = [x, z]; } if (q) { o.player.pos.set(q[0], o.groundAt(q[0], q[1]), q[1]); } await W(7000);
    const d = Bd.list().find((x) => x.id === 'sunja').d;
    Bd.follow('sunja', false); o.player.pos.copy(p0);
    return { win, line, st, d, closed: document.getElementById('mate-talk').hidden };
  });
  ok(r2.win && r2.line.length > 3 && r2.closed, `말 걸기 창: "${r2.line}"`);
  ok(r2.st.follow === 'sunja' && r2.d < 15, `같이 가요: 순자 삼춘이 따라옴 (${r2.d}m)`);
  // 몫: 없으면 안 줄임, 있으면 그만큼만, 마지막 keep 은 남김
  const r3 = await pg.evaluate(async (keepK) => {
    const o = window.__oreum, W = (ms) => new Promise((r) => setTimeout(r, ms)), Bd = o.buddies, T = o.trash.api;
    o.setTod(12); // 낮 (밤엔 들머리 평상에서 쉼)
    const total = () => T.heaps.reduce((s, h, i) => s + T.store.left(i), 0);
    const pts0 = o.save.trash.total, coins0 = o.save.coins, bag0 = JSON.stringify(o.save.trash.bag);
    // 동료 셋 둘레에 더미를 놓고 몫 0
    const hi = T.heaps.map((h, i) => i).filter((i) => !T.heaps[i].field && T.store.left(i) > T.store.full(i) * 0.6).sort((a, b) => Math.hypot(T.heaps[a].x - o.player.pos.x, T.heaps[a].z - o.player.pos.z) - Math.hypot(T.heaps[b].x - o.player.pos.x, T.heaps[b].z - o.player.pos.z));
    o.trash.goHeap(hi[0]); o.player.pos.x += 3; ['sunja', 'minsu', 'jenny'].forEach((id) => Bd.come(id)); await W(500);
    Bd.bank = 0; const t0 = total(); Bd.sim(20); const t1 = total();
    Bd.bank = 3; Bd.sim(60); const t2 = total(), b2 = Bd.bank;
    // 더미 하나를 keep 바로 위로 두고 몫을 많이
    const i = hi[0], full = T.store.full(i), kp = Math.ceil(full * keepK); T.store.setLeft(i, kp + 1); T.relayout();
    const m = Bd.mates[0]; m.pos.set(T.heaps[i].x + T.heaps[i].r + 1, 0, T.heaps[i].z); m.pos.y = o.groundAt(m.pos.x, m.pos.z); m.route = null; m.task = null; m.wait = 0;
    Bd.bank = 6; Bd.sim(30); const left = T.store.left(i);
    return { t0, t1, t2, b2, left, kp, picked: Bd.list().map((x) => x.picked), pts: o.save.trash.total - pts0, coins: o.save.coins - coins0, bag: JSON.stringify(o.save.trash.bag) === bag0 };
  }, BUDDIES.keep);
  ok(r3.t1 === r3.t0, `몫이 없으면 더미를 안 줄임 (${r3.t0} → ${r3.t1})`);
  ok(r3.t0 - r3.t2 <= 3 && r3.t0 - r3.t2 >= 1, `몫 3 이면 3개까지만 줄임 (${r3.t0 - r3.t2}개, 남은 몫 ${r3.b2})`);
  ok(r3.left >= r3.kp, `더미의 마지막 ${r3.kp}개는 남김 (남은 ${r3.left})`);
  ok(r3.pts === 0 && r3.coins === 0 && r3.bag, `동료가 주워도 내 누적 수·귤·배낭은 그대로 (누적 +${r3.pts}, 귤 +${r3.coins})`);
  // 민수가 적을 맞힘
  const r4 = await pg.evaluate(async () => {
    const o = window.__oreum, W = (ms) => new Promise((r) => setTimeout(r, ms)), Bd = o.buddies, E = o.enemies;
    E.test.clear(); Bd.come('minsu'); await W(200);
    const e = E.test.spawn('boar', 9, 0); e.state = 'charge'; e.st = 0; e.hp = 999; const hp0 = e.hp;
    let thr = 0; for (let i = 0; i < 40; i++) { Bd.sim(0.25); if (Bd.list().find((x) => x.id === 'minsu').pose === 'throw') thr++; o.player.pos.y = o.groundAt(o.player.pos.x, o.player.pos.z); }
    const hp1 = e.hp, flee = Bd.list().find((x) => x.id === 'jenny');
    E.test.clear(); return { hp0, hp1, thr, jenny: flee.d };
  });
  ok(r4.hp1 < r4.hp0 && r4.thr > 0, `민수가 귤을 던져 맞힘 (기운 ${r4.hp0} → ${r4.hp1})`);
  // 밤: 들머리 평상에서 쉼
  const rN = await pg.evaluate(async () => { const o = window.__oreum, Bd = o.buddies; o.setTod(23); await new Promise((r) => setTimeout(r, 600)); Bd.sim(240); const L = Bd.list(); o.setTod(12); await new Promise((r) => setTimeout(r, 600)); return L.map((x) => x.mode + ':' + x.pose); });
  ok(rN.every((x) => x === 'rest:sitg'), `밤엔 들머리 평상에 앉아 쉼 (${rN})`);
  // 사람 수·설정
  const r5 = await pg.evaluate(async () => {
    const o = window.__oreum, W = (ms) => new Promise((r) => setTimeout(r, ms)), Bd = o.buddies, net = o.net;
    const add = (n) => { for (let i = 0; i < n; i++) net.test.fake({ peer: 'fake' + i, presence: { x: o.player.pos.x + 30 + i, z: o.player.pos.z + 30, nick: 'p' + i } }); };
    add(5); Bd.sim(0.6); const a5 = Bd.list().filter((x) => x.on).length;
    add(9); Bd.sim(0.6); const a9 = Bd.list().filter((x) => x.on).length;
    for (let i = 0; i < 9; i++) net.test.drop('fake' + i); Bd.sim(0.6); const a0 = Bd.list().filter((x) => x.on).length;
    document.getElementById('menu-mates').click(); Bd.sim(0.6); const off = Bd.list().filter((x) => x.on).length, offS = o.save.mates.off;
    document.getElementById('menu-mates').click(); Bd.sim(0.6); const back = Bd.list().filter((x) => x.on).length;
    return { a5, a9, a0, off, offS, back, keys: Object.keys(o.save.mates) };
  });
  ok(r5.a5 === 1 && r5.a9 === 0 && r5.a0 === 3, `방 사람 5명이면 1명, 9명이면 0명, 다시 혼자면 3명 (${r5.a5}/${r5.a9}/${r5.a0})`);
  ok(r5.off === 0 && r5.offS === 1 && r5.back === 3, '메뉴 설정 동료 끄기·다시 켜기');
  ok(r5.keys.join() === 'off', `저장엔 설정만 (save.mates = ${r5.keys})`);
  // 감정 표현 따라 하기·인사
  const r6 = await pg.evaluate(async () => {
    const o = window.__oreum, W = (ms) => new Promise((r) => setTimeout(r, ms)), Bd = o.buddies;
    Bd.come('jenny'); const m = Bd.mates.find((x) => x.def.id === 'jenny'); m.route = null; m.task = null; m.emo = null; m.inGreet = true; m.greetAt = performance.now() / 1000; Bd.sim(0.2);
    o.emo.perform('clap'); let seen = false; for (let i = 0; i < 12; i++) { Bd.sim(0.15); if (Bd.list().find((x) => x.id === 'jenny').pose === 'clap') seen = true; }
    return { seen };
  });
  ok(r6.seen, '내가 박수 치니 제니도 박수');
  ok(!errs.length, '페이지 오류 없음' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})();
