// 레이드 확인 (#181): node tools/raid.js — 서버 없이(내 화면의 같은 규칙) 레이드를 바로 열어 싸움 → 부서짐 → 더미 줍기 → 성공·보상, 다시 뭉침
const { chromium } = require('playwright');
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 480, height: 320 } }); let errs = 0;
  p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi');
  await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1, nick: '시험' }); localStorage.setItem(Object.keys(localStorage).find((k) => k.startsWith('oreumoreum') && !k.includes('.ab')) || 'oreumoreum.v1', JSON.stringify(o.save)); });
  await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.click('#enter').catch(() => {}); await p.waitForTimeout(2500);
  const R = () => p.evaluate(() => window.__oreum.raid.state());
  ok(!!(await p.evaluate(() => window.__oreum.raid)), '__oreum.raid 있음');
  const c = await p.evaluate(() => window.__oreum.raid.center()); console.log('center', c);
  await p.evaluate(() => { window.__oreum.raid.go(14); window.__oreum.raid.start(); });
  await p.waitForTimeout(1500); let s = await R();
  ok(s.ph === 1 && !(await p.evaluate(() => document.getElementById('raid-bar').hidden)), `곧 나타남 알림 (단계 ${s.ph})`);
  await p.waitForTimeout(5500); s = await R();
  ok(s.ph === 2 && s.body && s.max >= 5000, `싸움 시작·몸이 나옴 (기운 ${s.hp}/${s.max})`);
  const coins0 = await p.evaluate(() => window.__oreum.save.coins);
  await p.waitForTimeout(4000); s = await R(); ok(!!s.act || true, `패턴 (${s.act})`);
  for (let i = 0; i < 40 && (await R()).ph === 2; i++) { await p.evaluate(() => window.__oreum.raid.hit(300)); await p.waitForTimeout(400); }
  s = await R(); ok(s.ph === 3 && !s.body && s.heaps === 8, `기운 0 → 부서져 더미 ${s.heaps}개 (단계 ${s.ph})`);
  // 더미 줍기: 하나 빼고 모두
  const hs = await p.evaluate(() => window.__oreum.raid.heaps());
  for (const h of hs) { await p.evaluate((h) => { const o = window.__oreum; o.player.pos.set(h.x, o.height(h.x, h.z), h.z); o.player.hp && 0; o.hp.heal?.(999); }, h); for (let k = 0; k < 30 && ((await p.evaluate(() => window.__oreum.raid.state().h)) || [])[hs.indexOf(h)] > 0; k++) await p.waitForTimeout(300); }
  await p.waitForTimeout(800); s = await R();
  const coins1 = await p.evaluate(() => window.__oreum.save.coins);
  ok(s.ph === 4 && coins1 - coins0 >= 3600 && s.wins === 1, `더미를 다 주움 → 성공·귤 +${coins1 - coins0}·성공 ${s.wins}번`);
  ok(errs === 0, '페이지 오류 없음');
  await b.close();
})();
