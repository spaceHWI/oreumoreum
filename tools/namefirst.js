// 처음 시작할 때 이름 정하기·메뉴 맨 위 이름 줄 (#230): 새 저장 → 꾸미기 창 맨 위 이름 단계, 비우면 기본 이름, 적으면 그 이름. 메뉴를 열면 스크롤 없이 이름 줄 → 이름 바꾸기 창
// node tools/namefirst.js [shots]   (먼저 node build.mjs. shots 를 주면 notes/shots/230-*.jpg)
const { chromium, devices } = require('playwright');
const SHOTS = process.argv.includes('shots');
const fails = [];
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails.push(m); };
const W = (p, ms) => p.waitForTimeout(ms);
async function boot(b, opt, seed) {
  const ctx = await b.newContext(opt), p = await ctx.newPage(), errs = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
  if (seed) await p.addInitScript((d) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', 1); localStorage.setItem('oreumoreum.dev', d); localStorage.setItem('oreumoreum.v1', d); } }, JSON.stringify(seed));
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await W(p, 6000);
  await p.click('#enter').catch(() => {}); await W(p, 5000);
  return { p, ctx, errs };
}
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [tag, opt] of [['pc', { viewport: { width: 1100, height: 720 } }], ['phone', { ...devices['iPhone 13'] }]]) {
    // 1. 새 저장: 이름 단계가 보이고, 비워 두면 기본(흐린) 이름으로 시작
    let { p, ctx, errs } = await boot(b, opt, null);
    const s1 = await p.evaluate(() => { const r = document.getElementById('look-nickrow'), lab = r.querySelector('.nk-lab'), i = document.getElementById('look-nick'), q = lab.getBoundingClientRect(); return { look: !document.getElementById('look').hidden, row: !r.hidden, lab: q.height > 0 && q.top >= 0 && q.bottom <= innerHeight, val: i.value, ph: i.placeholder, hint: document.getElementById('look-nick-hint').textContent, okOn: !document.getElementById('look-ok').disabled }; });
    ok(s1.look && s1.row && s1.lab && s1.val === '' && s1.ph && s1.okOn && /설정에서 바꿀/.test(s1.hint), `[${tag}] 새 저장: 이름 단계 보임·칸 비움·기본 이름 '${s1.ph}'·'설정에서 바꿀 수 있어요'`);
    if (SHOTS) await p.screenshot({ path: `notes/shots/230-${tag}-look.jpg`, quality: 70, scale: 'css' });
    await p.click('#look-ok'); await W(p, 1200);
    const s2 = await p.evaluate(() => ({ nick: window.__oreum.save.nick, set: window.__oreum.save.nickSet, look: !document.getElementById('look').hidden }));
    ok(s2.nick === s1.ph && s2.set === 1 && !s2.look, `[${tag}] 비워 두고 시작 → 기본 이름 '${s2.nick}' 로 정해짐`);
    // 2. 메뉴 맨 위 이름 줄 (스크롤 없이) → 이름 바꾸기 창
    await p.evaluate(() => document.getElementById('btn-menu').click()); await W(p, 500); /* 튜토리얼 첫 단계 안내가 단추를 덮을 수 있어 직접 누름 */
    const m = await p.evaluate(() => { const l = document.getElementById('menu-nickline'), r = l.getBoundingClientRect(), menu = document.getElementById('menu'); return { open: !menu.hidden, vis: r.height > 0 && r.top >= 0 && r.bottom <= innerHeight, scroll: menu.scrollTop, name: document.getElementById('menu-nick-now').textContent, at: Math.round(r.top), h: innerHeight }; });
    ok(m.open && m.vis && m.scroll === 0 && m.name === s2.nick, `[${tag}] 메뉴를 열면 스크롤 없이 '이름: ${m.name} 바꾸기 ›' (위에서 ${m.at}px / 화면 ${m.h}px)`);
    if (SHOTS) await p.screenshot({ path: `notes/shots/230-${tag}-menu.jpg`, quality: 70, scale: 'css' });
    await p.click('#menu-nickline'); await W(p, 400);
    ok(await p.evaluate(() => !document.getElementById('nickwin').hidden), `[${tag}] 이름 줄을 누르면 이름 바꾸기 창`);
    ok(!errs.length, `[${tag}] 페이지 오류 0 ${errs.join(' | ')}`);
    await ctx.close();
    // 3. 새 저장에서 이름을 적고 시작 / 걸리는 이름은 시작 못 함
    ({ p, ctx, errs } = await boot(b, opt, null));
    await p.fill('#look-nick', '시발'); await W(p, 100);
    const bad = await p.evaluate(() => document.getElementById('look-ok').disabled && !document.getElementById('look-nick-err').hidden);
    ok(bad, `[${tag}] 걸리는 이름은 시작 단추가 꺼짐`);
    await p.fill('#look-nick', '귤줍는사람'); await W(p, 100); await p.click('#look-ok'); await W(p, 1000);
    ok(await p.evaluate(() => window.__oreum.save.nick === '귤줍는사람' && window.__oreum.save.nickSet === 1), `[${tag}] 적은 이름으로 시작`);
    await ctx.close();
    // 4. 이미 이름을 정한 저장은 묻지 않음
    ({ p, ctx, errs } = await boot(b, opt, { nick: '옛 사람', nickSet: 1, coins: 5, entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1 }));
    ok(await p.evaluate(() => document.getElementById('look').hidden && window.__oreum.save.nick === '옛 사람'), `[${tag}] 이름을 정한 저장은 이름 단계 없이 그대로`);
    await ctx.close();
  }
  await b.close();
  console.log(fails.length ? `FAIL ${fails.length}` : 'ALL OK');
  process.exit(fails.length ? 1 : 0);
})();
