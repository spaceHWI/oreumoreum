// 구역 지킴이 돌하르방 확인 (#119)
//   node tools/guard.js            (먼저 node build.mjs) 방 규칙(roomcore)과 게임(혼자 하기)을 둘 다 해 봄
//   node tools/guard.js --shot     선 모습 한 장을 notes/shots/guard.png 에 (작게)
// 방: 구역 더미를 모두 주우면 zg 알림·hi 에 실림·다시 쌓여도 남음·holdSec 뒤 다시 치우면 또 섬
// 게임: 구역마다 자리(길 옆·기존 하르방과 떨어짐) → 구역을 비우면 솟음·메시지 → hold 를 짧게 하면 가라앉음 → 다시 비우면 또 섬
const path = require('path');
const ok = (c, m) => { console.log((c ? '통과 ' : '실패 ') + m); if (!c) process.exitCode = 1; };
const shot = process.argv.includes('--shot');
(async () => {
  /* ---------- 방 규칙 ---------- */
  const { createRoomCore } = await import('../server/src/roomcore.js');
  const { HEAP_DEFS } = await import('../server/src/heaps.js');
  const { ZONE_GUARD, NET } = await import('../src/balance.js');
  let T = 1e12; const now = () => T;
  const core = createRoomCore({ now });
  const got = []; const p = core.join((s) => got.push(JSON.parse(s)));
  const z = 2, hs = HEAP_DEFS.map((d, i) => [d, i]).filter(([d]) => d.zone === z && !d.own).map(([, i]) => i); /* #300 방은 함께 더미(쓰레기 산)만 셈 */
  const empty = () => { for (const h of hs) { let left = core.heaps()[h]; while (left > 0) { T += 1000; core.message(p, JSON.stringify({ t: 'take', h, n: NET.takeMax })); left = core.heaps()[h]; } } core.step(); };
  empty();
  const zg = got.filter((m) => m.t === 'zg');
  ok(zg.length === 1 && zg[0].z === z, `방: 구역 ${z} 더미 ${hs.length}개를 다 주우니 zg 알림 하나 (${JSON.stringify(zg)})`);
  const hsAt = got.findIndex((m) => m.t === 'hs'), zgAt = got.findIndex((m) => m.t === 'zg');
  ok(hsAt >= 0 && hsAt < zgAt, '방: 더미 알림(hs) 뒤에 zg (꽃이 먼저)');
  const g2 = []; const p2 = core.join((s) => g2.push(JSON.parse(s)));
  ok(JSON.stringify(g2[0].zg) === JSON.stringify([[z, zg[0].at]]), `방: 새로 들어온 사람의 hi 에 zg ${JSON.stringify(g2[0].zg)}`);
  core.leave(p); const q = core.join((s) => got.push(JSON.parse(s)));
  // 방장이 다시 쌓아도(put) 남음
  ok(core.host === p2.id, '방: 방장이 바뀜');
  core.message(p2, JSON.stringify({ t: 'put', h: hs[0], n: 3 })); core.step();
  ok(core.heaps()[hs[0]] > 0, '방: 다시 쌓임');
  const g3 = []; core.join((s) => g3.push(JSON.parse(s)));
  ok((g3[0].zg || []).length === 1, '방: 다시 쌓여도 지킴이는 남음');
  ok(core.guardsDirty() === true && Array.isArray(core.guards()), '방: 저장할 것 있음 (room.js 가 zg 로 저장)');
  // 시간이 지나면 빠지고, 다시 다 치우면 또 섬
  T += ZONE_GUARD.holdSec * 1000 + 1;
  const g4 = []; core.join((s) => g4.push(JSON.parse(s)));
  ok((g4[0].zg || []).length === 0, `방: ${ZONE_GUARD.holdSec}초 뒤 hi 에서 빠짐`);
  got.length = 0; const pp = q; for (const h of hs) { let left = core.heaps()[h]; while (left > 0) { T += 1000; core.message(pp, JSON.stringify({ t: 'take', h, n: NET.takeMax })); left = core.heaps()[h]; } } core.step();
  ok(got.filter((m) => m.t === 'zg').length === 1, '방: 다시 다 치우니 또 섬');
  const core2 = createRoomCore({ now, guards: core.guards() });
  const g5 = []; core2.join((s) => g5.push(JSON.parse(s)));
  ok((g5[0].zg || []).length === 1, '방: 저장한 zg 로 다시 만들어도 이어짐');
  const core3 = createRoomCore({ now, guards: 'junk' }); const g6 = []; core3.join((s) => g6.push(JSON.parse(s)));
  ok(Array.isArray(g6[0].zg) && !g6[0].zg.length, '방: 망가진 저장값은 버림');

  /* ---------- 게임 ---------- */
  const { chromium } = require('playwright');
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 640, height: 400 } }); const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message.slice(0, 300)));
  const url = 'file://' + path.join(__dirname, '../dist/test.html') + '#namsongi';
  await pg.goto(url); await pg.waitForTimeout(6000);
  await pg.evaluate(() => { const o = window.__oreum; o.save.entered = 1; o.save.look = { sex: 'm', skin: 0 }; o.save.hairs = o.save.hairs || {}; o.save.tut = { step: 99, done: true, v: 3 }; o.save.jeong = 1; o.save.soundOff = 1; o.save.tipsSeen = o.save.tipsSeen || {}; o.save.zg = { 9: 'x', 3: -1 }; const k = Object.keys(localStorage).find((q) => q.startsWith('oreumoreum') && !q.includes('.ab') && !q.includes('inbox')); localStorage.setItem(k || 'oreumoreum.v1', JSON.stringify(o.save)); });
  await pg.reload(); await pg.waitForTimeout(6000);
  await pg.click('#enter').catch(() => {}); await pg.waitForTimeout(4000);
  await pg.evaluate(() => { const o = window.__oreum; if (o.tut?.active) o.tut.skipAll(); o.cam.mode = 'follow'; document.body.classList.remove('tut'); for (const id of ['tut-toast', 'intro-help', 'intro']) { const e = document.getElementById(id); if (e) e.hidden = true; } });
  const sp = await pg.evaluate(() => { const o = window.__oreum; return { spots: o.guard?.spots(), old: o.spots.hareubangs.map((h) => [h.pos.x, h.pos.z]), zg: o.save.zg }; });
  console.table(sp.spots);
  ok(sp.spots && sp.spots.length === 5, `자리: 구역 5곳 모두 (${(sp.spots || []).map((s) => s.zone).join(',')})`);
  ok((sp.spots || []).every((s) => s.trail <= 10), '자리: 모두 길 옆 10m 안 (굼부리는 옆 길)');
  const minOld = Math.min(...sp.spots.flatMap((s) => sp.old.map(([x, z]) => Math.hypot(s.x - x, s.z - z))));
  ok(minOld >= 10, `자리: 있던 하르방에서 ${minOld.toFixed(1)}m 떨어짐`);
  ok(JSON.stringify(sp.zg) === '{}', '저장: 망가진 예전 save.zg 는 지움 ' + JSON.stringify(sp.zg));
  // 구역을 비움 → 솟음·메시지
  const Z = 3;
  const r1 = await pg.evaluate(async (Z) => {
    const o = window.__oreum, W = (ms) => new Promise((r) => setTimeout(r, ms)), G = o.guard;
    o.trash.fillZone(Z); G.go(Z); await W(300);
    const before = G.state().find((s) => s.zone === Z);
    G.clear(Z); await W(200);
    const at = o.save.zg[Z], s0 = G.state().find((s) => s.zone === Z), toasts = [];
    for (let i = 0; i < 100 && !(i > 30 && G.state().find((s) => s.zone === Z).k >= 1); i++) { await W(200); const t = document.getElementById('toast'); if (!t.hidden && !toasts.includes(t.textContent)) toasts.push(t.textContent); for (const n of document.querySelectorAll('#msg-log > *')) if (!toasts.includes(n.textContent)) toasts.push(n.textContent); } /* #201 뒤 알림은 메시지 줄(#msg-log)로 */
    const s1 = G.state().find((s) => s.zone === Z), hb = G.guards.get(Z).hb.root;
    return { before, at: !!at, s0, s1, toasts, y: hb.position.y, gy: G.guards.get(Z).s.y, vis: hb.visible, glance: !!o.cam };
  }, Z);
  ok(!r1.before.standing && r1.at && r1.s0.standing, `구역 ${Z} 을 비우니 세운 시각 저장`);
  ok(r1.s1.k === 1 && r1.vis && Math.abs(r1.y - r1.gy) < 0.05, '꽃 뒤 솟아 다 섬');
  ok(r1.toasts.some((t) => t.includes('구역을 다 치웠어요')), `메시지: ${r1.toasts.join(' / ')}`);
  if (shot) {
    await pg.evaluate((Z) => { const o = window.__oreum, g = o.guard.guards.get(Z).s; o.tp(g.x + Math.sin(g.rot) * 9, g.z + Math.cos(g.rot) * 9, g.rot + Math.PI, 0.18, 11, 0.5); }, Z);
    await pg.waitForTimeout(1500); await pg.screenshot({ path: path.join(__dirname, '../notes/shots/guard.png') });
  }
  // 다시 쌓여도 남음, hold 를 짧게 → 가라앉음, 다시 비우면 또 섬
  const r2 = await pg.evaluate(async (Z) => {
    const o = window.__oreum, W = (ms) => new Promise((r) => setTimeout(r, ms)), G = o.guard, st = () => G.state().find((s) => s.zone === Z);
    o.trash.fillZone(Z); await W(1500); const refill = st();
    G.hold(3); for (let i = 0; i < 30 && st().k > 0; i++) await W(250); const sunk = st(), vis = G.guards.get(Z).hb.root.visible;
    G.clear(Z); await W(200); const again = st().standing;
    await W(300); o.trash.fillZone(Z); await W(200); G.clear(Z); // 서 있는 동안 다시 비워도 그대로
    G.hold(1800);
    return { refill, sunk, vis, again };
  }, Z);
  ok(r2.refill.standing && r2.refill.k === 1, '다시 쌓여도 서 있음');
  ok(!r2.sunk.standing && r2.sunk.k === 0 && !r2.vis, 'hold 3초로 줄이니 가라앉아 사라짐');
  ok(r2.again, '다시 비우니 또 섬');
  // 새로 불러와도(저장) 서 있음 · 연출 없이
  await pg.reload(); await pg.waitForTimeout(6000); await pg.click('#enter').catch(() => {}); await pg.waitForTimeout(3000);
  const r3 = await pg.evaluate((Z) => window.__oreum.guard.state().find((s) => s.zone === Z), Z);
  ok(r3.standing && r3.k === 1 && !r3.mode, `다시 불러와도 바로 서 있음 (남은 ${r3.left}초)`);
  ok(!errs.length, '페이지 오류 없음' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})();
