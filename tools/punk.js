// 오름펑크 아이템 확인 (#164). node tools/punk.js [--shot]
//   감귤 박스 헬멧: LEAP 에 있음·사서 쓰면 박스 시야(끌 수 있음)·받는 피해 -5%. 테왁 배낭: 장비점에서 사기·배낭 3단계부터 멤·망사리 불룩·개울에서 뜸(빠지지 않음)·돌담 밖으로 못 나감
//   --shot: 두 아이템을 입은 모습·물에 뜬 모습 dist/punk-*.jpg
const { chromium } = require('playwright');
const SHOT = process.argv.includes('--shot');
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 400 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await p.waitForTimeout(5000);
  await p.click('#enter').catch(() => {}); await p.waitForTimeout(2500);
  await p.evaluate(() => { const o = window.__oreum; o.tut.skipAll?.(); o.look.close?.(); document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; }); o.setWeather('clear'); o.setTod(13); });
  await p.waitForTimeout(1200);
  // 박스 헬멧
  const box = await p.evaluate(() => { const o = window.__oreum; o.save.coins = 99999; const items = o.leap.items('hat').map((i) => i.id); o.clothes.buy('hat:p-box'); o.clothes.wear('hat', 'hat:p-box'); return { items, own: !!o.save.clothes.own['hat:p-box'], wear: o.save.clothes.wear.hat, gear: o.save.outfit.gear.hat }; });
  ok(box.items.includes('hat:p-box') && box.own && box.wear === 'hat:p-box', `LEAP 모자에 감귤 박스 헬멧, 사서 씀 (${box.gear})`);
  await p.waitForTimeout(800);
  const bv = await p.evaluate(() => ({ on: window.__oreum.punk.boxView(), bw: getComputedStyle(document.getElementById('box-view')).borderTopWidth, btn: !document.getElementById('menu-boxview').hidden }));
  ok(bv.on && parseFloat(bv.bw) > 20 && bv.btn, `박스 시야 켜짐 (테두리 ${bv.bw}), 설정 스위치 보임`);
  const off = await p.evaluate(async () => { document.getElementById('menu-boxview').click(); await new Promise((r) => setTimeout(r, 300)); const v = window.__oreum.punk.boxView(); document.getElementById('menu-boxview').click(); return v; });
  ok(!off, '박스 시야 끄기');
  const dmg = await p.evaluate(() => { const o = window.__oreum, h = o.hp, h0 = h.hp; o.player.iframe = 0; const def = { dmg: 20 }; const before = h.hp; const r = o.life.hooks; return { has: typeof o.punk.thud === 'function' }; });
  ok(dmg.has, '박스 소리 있음');
  // 테왁
  const tw = await p.evaluate(() => { const o = window.__oreum; o.save.equip.bag = 2; const a = o.punk.buy('tewak'); const g1 = o.save.outfit.gear.back; o.save.equip.bag = 3; o.punk.pick('tewak'); const g2 = o.save.outfit.gear.back; return { a, g1, g2, own: o.save.backs }; });
  ok(tw.a && !/tewak/.test(tw.g1) && /^back:tewak[0-2]$/.test(tw.g2), `테왁 배낭 사기, 배낭 3단계부터 멤 (2단계 ${tw.g1} → 3단계 ${tw.g2})`);
  // 망사리: 배낭을 채우면 불룩
  const fill = await p.evaluate(async () => { const o = window.__oreum, until = async (f) => { for (let i = 0; i < 40 && !f(); i++) await new Promise((r) => setTimeout(r, 200)); };
    o.trash.api.test.fillBag(o.trash.state().cap); await until(() => o.save.outfit.gear.back === 'back:tewak2'); const g = o.save.outfit.gear.back;
    o.trash.api.test.emptyBag(); await until(() => o.save.outfit.gear.back === 'back:tewak0'); return [g, o.save.outfit.gear.back]; });
  ok(fill[0] === 'back:tewak2' && fill[1] === 'back:tewak0', `망사리가 찰수록 불룩 (${fill.join(' → ')})`);
  // 개울: 테왁이면 뜸, 아니면 빠짐
  const swim = await p.evaluate(async () => {
    const o = window.__oreum, s = o.stream; const [x, z] = s.at(s.centerOff(20), 20); o.player.pos.set(x, o.groundAt(x, z), z); await new Promise((r) => setTimeout(r, 700));
    const r1 = { swim: o.punk.swim(), busy: s.busy, y: +(o.player.pos.y - s.waterY(x, z)).toFixed(2) };
    // 돌담(수문)과 만나는 곳 바로 안에서 물길 따라 바깥으로 헤엄쳐 봄
    const start = { x: o.player.pos.x, z: o.player.pos.z }, res = [];
    for (const wl of s.walls || []) {
      const dir = Math.sign(wl) || 1, [ax, az] = s.at(s.centerOff(wl - dir * 6), wl - dir * 6); o.player.pos.set(ax, o.groundAt(ax, az), az); o.player.target = null; await new Promise((r) => setTimeout(r, 300));
      const [bx, bz] = s.at(s.centerOff(wl + dir * 25), wl + dir * 25); o.player.target = new o.player.pos.constructor(bx, 0, bz);
      await new Promise((r) => setTimeout(r, 7000)); o.player.target = null;
      res.push({ lat: Math.round(wl), swim: o.punk.swim(), inside: +o.bound.insideBy(o.player.pos.x, o.player.pos.z).toFixed(1) });
    }
    const out1 = Math.min(...res.map((r) => r.inside)), end1 = res, out2 = out1, end2 = '';
    const far = Math.hypot(o.player.pos.x - start.x, o.player.pos.z - start.z);
    o.punk.pick(null); const [x2, z2] = s.at(s.centerOff(-20), -20); o.player.target = null; o.player.pos.set(x2, o.groundAt(x2, z2), z2); await new Promise((r) => setTimeout(r, 900));
    return { r1, far: Math.round(far), out1, out2, end1, end2, fell: s.busy };
  });
  ok(swim.r1.swim && !swim.r1.busy && swim.r1.y < -0.3, `테왁이면 개울에 떠 있음 (물낯 아래 ${-swim.r1.y}m, 빠짐 ${swim.r1.busy})`);
  ok(swim.end1.length && swim.out1 > -0.5, `돌담 수문 쪽으로 헤엄쳐도 돌담 안에서 멈춤 ${JSON.stringify(swim.end1)}`);
  ok(swim.fell, '테왁을 벗으면 예전처럼 빠짐');
  if (SHOT) {
    await p.evaluate(async () => { const o = window.__oreum; while (o.stream.busy) await new Promise((r) => setTimeout(r, 300)); o.punk.pick('tewak'); o.trash.api.test.fillBag(99); const sp = o.stream.near(1, 6); o.player.pos.set(sp[0], o.groundAt(sp[0], sp[1]), sp[1]); o.cam.dist = 4; o.snap(); });
    await p.waitForTimeout(2000); await p.screenshot({ path: 'dist/punk-wear.jpg', type: 'jpeg', quality: 70 });
    await p.evaluate(async () => { const o = window.__oreum, s = o.stream; const [x, z] = s.at(s.centerOff(14), 14); o.player.pos.set(x, o.groundAt(x, z), z); o.cam.dist = 5; o.snap(); });
    await p.waitForTimeout(2000); await p.screenshot({ path: 'dist/punk-swim.jpg', type: 'jpeg', quality: 70 });
  }
  ok(!errs.length, '페이지 오류 없음' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
})();
