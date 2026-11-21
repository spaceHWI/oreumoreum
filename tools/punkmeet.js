// 오름펑크 상호작용 확인 (#163)
//   node tools/punkmeet.js          (먼저 node build.mjs)
// 하르방 인사하기 → 하루 한 번 버프 칸·두 번째는 말풍선만 / 관광객 → 사진(귤 10) → 쓰레기 버리고 돌아섬 → 귤로 맞히면 귤 15 / 안 맞히면 더미에 쌓임
// 까마귀: 배낭이 가득 차면 → 경고 → 쓰레기 1개를 물고 맴돎 → 귤로 맞히면 돌려받고 귤 / 안 맞히면 1개 잃음. 망가진 예전 save.meet 로 시작해도 오류 없음
const path = require('path');
const ok = (c, m) => { console.log((c ? '통과 ' : '실패 ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const { chromium } = require('playwright');
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 360, height: 240 } }); const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message.slice(0, 300)));
  const url = 'file://' + path.join(__dirname, '../dist/test.html') + '#namsongi';
  await pg.goto(url); await pg.waitForTimeout(6000);
  await pg.evaluate(() => { const o = window.__oreum; o.save.entered = 1; o.save.look = { sex: 'm', skin: 0 }; o.save.hairs = o.save.hairs || {}; o.save.tut = { step: 99, done: true, v: 3 }; o.save.jeong = 1; o.save.soundOff = 1; o.save.meet = 'junk'; const k = Object.keys(localStorage).find((q) => q.startsWith('oreumoreum') && !q.includes('.ab') && !q.includes('inbox')); localStorage.setItem(k || 'oreumoreum.v1', JSON.stringify(o.save)); });
  await pg.reload(); await pg.waitForTimeout(6000);
  await pg.click('#enter').catch(() => {}); await pg.waitForTimeout(4000);
  await pg.evaluate(() => { const o = window.__oreum; if (o.tut?.active) o.tut.skipAll(); o.cam.mode = 'follow'; document.body.classList.remove('tut'); for (const id of ['tut-toast', 'intro-help', 'intro']) { const e = document.getElementById(id); if (e) e.hidden = true; }
    o.save.coins = 2000; window.__rw = []; const r = o.life.hooks.reclaim; o.life.hooks.reclaim = (wp, v = 1) => { window.__rw.push(v); r(wp, v); }; }); // 받은 귤 기록 (던진 귤을 도로 주운 것은 1)
  const s0 = await pg.evaluate(() => window.__oreum.punk.state());
  console.log(s0);
  ok(!!s0 && s0.hareubangs >= 1 && s0.spots >= 2, `자리: 하르방 ${s0?.hareubangs}곳, 관광객 자리 ${s0?.spots}곳`);
  ok(s0.buff === 0 && s0.hbDay === '', '망가진 예전 save.meet 는 새로');

  /* 하르방 */
  const h = await pg.evaluate(async () => {
    const o = window.__oreum, W = (ms) => new Promise((r) => setTimeout(r, ms)), P = o.punk;
    await W(2500); o.player.pose = 'move'; const ok1 = P.five(); await W(200); const pose = o.player.pose; for (let i = 0; i < 60 && !P.state().buff; i++) await W(250);
    const a = P.state(), pill = !document.getElementById('punk-pill').hidden;
    for (let i = 0; i < 60 && o.player.pose === 'five'; i++) await W(250); o.player.pose = 'move'; P.five(); await W(6000); const b2 = P.state();
    // 상호작용 버튼이 '인사하기' 로 바뀜
    for (let i = 0; i < 60 && o.player.pose === 'five'; i++) await W(250); o.player.pose = 'move'; await W(1500); const ctx = o.aim.ctx();
    return { ok1, pose, a, pill, b2, ctx };
  });
  ok(h.ok1 && h.pose === 'five', `하이파이브 동작 (${h.pose})`);
  ok(h.a.buff > 590 && h.pill, `하루 한 번 버프 ${h.a.buff}초·버프 칸 보임`);
  ok(h.b2.buff <= h.a.buff, '두 번째 인사는 버프를 새로 주지 않음');
  ok(h.ctx === 'hand', `하르방 앞 상호작용 버튼 = 인사하기 (${h.ctx})`);

  /* 관광객 */
  const t = await pg.evaluate(async () => {
    const o = window.__oreum, W = (ms) => new Promise((r) => setTimeout(r, ms)), P = o.punk, out = {};
    P.tourist(true); out.spawn = P.state().tourist;
    for (let i = 0; i < 400 && P.state().tourist?.state !== 'wait'; i++) await W(200);
    out.wait = P.state().tourist?.state; P.goTourist(); await W(1500); out.ctx = o.aim.ctx();
    window.__rw.length = 0; P.shoot(); out.cd = !document.getElementById('countdown').hidden;
    for (let i = 0; i < 200 && !['thanks', 'drop', 'litter'].includes(P.state().tourist?.state); i++) await W(150);
    await W(1500); out.photo = window.__rw.filter((v) => v > 1).reduce((a, v) => a + v, 0);
    for (let i = 0; i < 200 && P.state().tourist?.state !== 'litter'; i++) await W(150);
    out.litter = P.state().tourist?.state;
    // 진짜로 귤을 던져 맞힘 (타겟 고정)
    window.__rw.length = 0;
    for (let i = 0; i < 60 && P.state().tourist?.state === 'litter'; i++) { if (i % 4 === 0) P.goTourist(); o.aim.throw(); for (let k = 0; k < 20 && o.player.pose === 'throw'; k++) await W(150); await W(400); } // 던지는 동작이 끝나야 다음 귤
    out.real = P.state().tourist?.state === 'sorry'; if (P.state().tourist?.state === 'litter') P.hitTourist();
    out.hit = P.state().tourist?.state; await W(4000); out.sorry = window.__rw.filter((v) => v > 1).reduce((a, v) => a + v, 0);
    // 안 맞히는 경우: 더미 남은 수가 늘어남
    for (let i = 0; i < 200 && P.state().tourist; i++) await W(250);
    P.tourist(true); for (let i = 0; i < 400 && P.state().tourist?.state !== 'wait'; i++) await W(200);
    P.goTourist(); await W(500); P.shoot(); for (let i = 0; i < 300 && P.state().tourist?.state !== 'litter'; i++) await W(150);
    const A = o.trash.api; let hi = -1, hd = 1e9; A.heaps.forEach((h, k) => { const d = Math.hypot(h.x - o.player.pos.x, h.z - o.player.pos.z); if (d < hd) { hd = d; hi = k; } }); if (hi >= 0) { A.store.setLeft(hi, Math.max(0, A.heaps[hi].n - 5)); A.store.commit(); } // 가까운 더미에 빈자리
    const pos = P.state().tourist; const far = { x: o.player.pos.x, z: o.player.pos.z };
    const left0 = o.trash.api.heaps.reduce((s, _, k) => s + o.trash.api.store.left(k), 0);
    for (let i = 0; i < 300 && P.state().tourist?.state === 'litter'; i++) await W(250);
    const left1 = o.trash.api.heaps.reduce((s, _, k) => s + o.trash.api.store.left(k), 0);
    out.stay = left1 - left0; out.pos = pos; out.far = far;
    return out;
  });
  console.log(t);
  ok(!!t.spawn && t.wait === 'wait', `관광객이 와서 손을 흔듦 (${t.spawn?.spot})`);
  ok(t.ctx === 'photo', `관광객 앞 상호작용 버튼 = 사진 찍어 주기 (${t.ctx})`);
  ok(t.cd && t.photo === 10, `3·2·1 뒤 찰칵, 귤 +${t.photo}`);
  ok(t.litter === 'litter', '쓰레기를 버리고 돌아섬');
  ok(t.hit === 'sorry' && t.sorry === 15, `귤로 맞히니 사과·귤 +${t.sorry} (${t.real ? '던진 귤로 맞힘' : '던진 귤이 빗나가 hitTourist 로'})`);
  ok(t.stay === 2, `안 맞히면 근처 더미에 쓰레기 ${t.stay}개`);

  /* 까마귀 */
  const c = await pg.evaluate(async () => {
    const o = window.__oreum, W = (ms) => new Promise((r) => setTimeout(r, ms)), P = o.punk, out = {};
    o.guard?.go?.(1) || o.cleanhouse.go(); await W(300);
    const vol = () => o.trash.api.bagVol();
    P.crow(); out.v0 = vol(); out.warn = P.state().crow?.state; out.tip = document.getElementById('toast').textContent;
    for (let i = 0; i < 150 && P.state().crow?.state !== 'circle'; i++) await W(200);
    out.circle = P.state().crow; out.v1 = vol();
    window.__rw.length = 0;
    for (let i = 0; i < 90 && P.state().crow?.state === 'circle'; i++) { o.aim.throw(); for (let k = 0; k < 20 && o.player.pose === 'throw'; k++) await W(150); await W(300); }
    out.hit = P.state().crow?.state; const tt = []; const d0 = o.life.tangerines.filter((q) => q.drop).length; let dmax = 0;
    for (let i = 0; i < 160 && P.state().crow; i++) { await W(250); const x = document.getElementById('toast'); if (!x.hidden && !tt.includes(x.textContent)) tt.push(x.textContent); dmax = Math.max(dmax, o.life.tangerines.filter((q) => q.drop).length - d0); }
    out.toasts = tt; out.drops = dmax;
    out.v2 = vol(); 
    // 안 맞힘: 1개 잃음
    P.crow(); for (let i = 0; i < 150 && P.state().crow?.state !== 'circle'; i++) await W(200);
    const v3 = vol(); for (let i = 0; i < 400 && P.state().crow; i++) await W(200);
    out.lost = v3 === vol() && !P.state().crow; out.v3 = v3; out.v4 = vol(); out.n = P.state().crowN;
    return out;
  });
  console.log(c);
  ok(c.warn === 'warn', '까마귀: 먼저 경고 (까악·그림자)');
  ok(c.circle?.state === 'circle' && !!c.circle.kind && c.v1 < c.v0, `쓰레기 하나를 물고 머리 위 ${c.circle?.y}m 를 맴돎 (배낭 ${c.v0} → ${c.v1})`);
  ok(['fall', 'leave'].includes(c.hit) && c.v2 === c.v0 && (c.drops > 0 || c.toasts.some((x) => x.includes('반짝이는 것'))) && c.toasts.some((x) => x.includes('떨어뜨렸어요')), `귤로 맞히니 떨어뜨림: 배낭 ${c.v2}, 바닥 귤 ${c.drops}알(귀한 귤·쪽지면 0) (${c.toasts.join(' / ')})`);
  ok(c.lost && c.v4 === c.v3, `안 맞히면 쓰레기 하나만 잃음 (${c.v3} → ${c.v4}), 오늘 ${c.n}번`);
  ok(!errs.length, '페이지 오류 없음 ' + errs.join(' | '));
  await b.close();
})();
