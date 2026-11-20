// 맵 전체 쓰기 확인 (#138): 구역마다 놓은 수·길에서 거리(m)·8자 고리 한 바퀴 길이·권장 배낭이 차는 곳에서 구역 클린하우스까지,
// 그리고 소굴(가까이 가면 적 → 쫓아내면 닫힘)·보물(하루 한 번)·볼거리(처음 찾음)·길 밖 걷기 느림·미니맵·자동 걷기 길 밖 우회를 실제로 해 봄
//   node tools/field.js            (먼저 node build.mjs)
//   node tools/field.js --shot     미니맵·큰 지도·구역 2 위에서 본 그림을 notes/shots/ 에 (작게)
const { chromium } = require('playwright');
const path = require('path');
const shot = process.argv.includes('--shot');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 300)));
  const url = 'file://' + path.join(__dirname, '../dist/test.html') + '#namsongi';
  await p.goto(url); await p.waitForTimeout(6000);
  // 튜토리얼을 끝낸 저장으로 다시 엶 (tools/perf.js 와 같음)
  await p.evaluate(() => { const o = window.__oreum; o.save.entered = 1; o.save.look = { sex: 'm', skin: 0 }; o.save.hairs = o.save.hairs || {}; o.save.tut = { step: 99, done: true, v: 3 }; o.save.jeong = 1; o.save.soundOff = 1; o.save.tipsSeen = o.save.tipsSeen || {}; const k = Object.keys(localStorage).find((q) => q.startsWith('oreumoreum')); localStorage.setItem(k || 'oreumoreum.v1', JSON.stringify(o.save)); });
  await p.goto(url); await p.waitForTimeout(6000);
  await p.click('#enter').catch(() => {}); await p.waitForTimeout(4000);
  await p.evaluate(() => { const o = window.__oreum; if (o.tut?.active) o.tut.skipAll(); o.cam.mode = 'follow'; document.body.classList.remove('tut'); for (const id of ['tut-toast', 'intro-help', 'intro']) { const e = document.getElementById(id); if (e) e.hidden = true; } });
  const rep = await p.evaluate(() => window.__oreum.field.report());
  console.table(rep.map((r) => ({ 구역: r.zone, 길가: r.road, '길가 거리': r.roadD, 들판: r.field, 소굴: r.dens, '소굴 거리': r.denD, 보물: r.treasures, '보물 거리': r.trD, 빈터: r.boss, '고리(m)': r.loop, 배낭: r.bagCap, '배낭 참(번)': r.fills, 'CH까지 최대': r.chD, '반쯤 CH': r.halfD })));
  rep.forEach((r) => console.log(`구역 ${r.zone} 볼거리: ${r.sights || '-'}`));
  const ok = (c, m) => { console.log((c ? '통과 ' : '실패 ') + m); if (!c) process.exitCode = 1; };
  // 구역 1 은 길에서 가장 가까운 클린하우스(들머리)가 140m 넘게 떨어져 있어(클린하우스는 옮기지 않음) 80m 를 맞출 수 없음 → 알리기만
  const chFar = rep.filter((r) => r.halfD != null && r.halfD > 80 && !(r.zone === 1 && r.chMin > 80));
  rep.filter((r) => r.zone === 1 && r.chMin > 80).forEach((r) => console.log(`참고 구역 1: 구역 길에서 가장 가까운 클린하우스도 ${r.chMin}m (반쯤 지점 ${r.halfD}m)`));
  ok(!chFar.length, `길가 더미를 반쯤 치운 곳(더미 가장자리)에서 가장 가까운 클린하우스 80m 안 (${rep.map((r) => r.zone + ':' + r.halfD + 'm').join(' ')})`);
  // 소굴
  const den = await p.evaluate(async () => {
    const o = window.__oreum, F = o.field, d0 = F.dens().find((d) => d.zone === 2) || F.dens()[0];
    o.life.enemies.test.clear(); F.openDen(d0.id); F.go('den', F.dens().findIndex((d) => d.id === d0.id));
    const W = (ms) => new Promise((r) => setTimeout(r, ms)), get = () => F.dens().find((d) => d.id === d0.id);
    for (let i = 0; i < 20 && !get().active; i++) await W(250);
    const a = get(), n = o.life.enemies.list.length;
    for (let k = 0; k < 3; k++) { for (const e of o.life.enemies.list.slice()) o.life.enemies.hitArea(e.pos, 1, 9999); await W(400); }
    for (let i = 0; i < 12 && get().open; i++) await W(250);
    const c = get();
    return { id: d0.id, active: a.active, spawned: n, closed: !c.open, coins: o.save.coins };
  });
  ok(den.active && den.spawned > 0 && den.closed, `소굴 ${den.id}: 가까이 가니 적 ${den.spawned} → 다 쫓아내니 닫힘`);
  // 보물
  const tr = await p.evaluate(() => { const o = window.__oreum, F = o.field, t = F.treasures()[0]; const a = F.openTreasure(t.id), again = F.openTreasure(t.id); return { id: t.id, got: a, again, left: F.treasures().filter((q) => !q.got).length }; });
  ok(tr.got && tr.again, `보물 ${tr.id}: 열림, 오늘 다시는 안 열림 (남은 보물 ${tr.left})`);
  // 볼거리
  const sg = await p.evaluate(async () => { const o = window.__oreum, F = o.field, c0 = o.save.coins; F.go('sight', 0); await new Promise((r) => setTimeout(r, 900)); return { found: F.save.sight.slice(), dex: o.trash.dex()['sight:0'] || 0, gyul: o.save.coins - c0 }; });
  ok(sg.found.length >= 1 && sg.dex > 0, `볼거리: 찾음 ${sg.found.join(',')} · 도감 ${sg.dex} · 귤 +${sg.gyul}`);
  // 길 밖 느림
  const sl = await p.evaluate(() => { const o = window.__oreum, F = o.field; F.go('den', 0); let off = 1; for (let i = 0; i < 12 && off === 1; i++) { o.player.pos.x += 3; off = F.slow(); } o.save.equip.shoes = 5; o.player.pos.z += 0.8; const off5 = F.slow(); o.save.equip.shoes = 1; return { off, off5 }; });
  ok(sl.off < 1 && sl.off5 > sl.off, `길 밖 걷기 빠르기 신발1 ×${sl.off} · 신발5 ×${sl.off5}`);
  // 줍기 자동 걷기가 들판 더미까지 (길 밖)
  const seek = await p.evaluate(async () => {
    const o = window.__oreum, F = o.field, hs = o.trash.heaps().filter((h) => h.field); const h = hs[1] || hs[0];
    o.trash.emptyBag(); o.save.equip.bag = 3; o.save.equip.tool = 2;
    const a = Math.random() * 6.28, x = h.x + Math.sin(a) * (h.r + 16), z = h.z + Math.cos(a) * (h.r + 16); o.player.pos.set(x, o.height(x, z), z);
    const t0 = performance.now(); o.trash.press();
    for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 250)); if (o.trash.state().picking) break; }
    return { picking: o.trash.state().picking, sec: +((performance.now() - t0) / 1000).toFixed(1), d: Math.round(Math.hypot(o.player.pos.x - h.x, o.player.pos.z - h.z) - h.r) };
  });
  ok(seek.picking, `줍기 버튼: 들판 더미까지 걸어가 주움 (${seek.sec}초, 가장자리 ${seek.d}m)`);
  const fog = await p.evaluate(() => window.__oreum.field.fog());
  ok(fog > 0, `가 본 곳 ${Math.round(fog * 100)}%`);
  const mm = await p.evaluate(() => { const m = document.getElementById('minimap'); return { hidden: m.hidden, w: m.width }; });
  ok(!mm.hidden && mm.w > 0, `미니맵 보임 (${mm.w}px)`);
  if (shot) {
    const dir = path.join(__dirname, '../notes/shots');
    await p.screenshot({ path: path.join(dir, '138-minimap.jpg'), quality: 70, type: 'jpeg', clip: { x: 900 - 200, y: 0, width: 200, height: 220 } });
    await p.evaluate(() => { window.__oreum.field.revealAll(); window.__oreum.field.go('den', 2); }); await p.waitForTimeout(400);
    await p.evaluate(() => document.getElementById('zone-pill').click()); await p.waitForTimeout(600);
    await p.screenshot({ path: path.join(dir, '138-map.jpg'), quality: 70, type: 'jpeg' });
  }
  ok(!errs.length, `페이지 오류 없음${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await b.close();
})();
