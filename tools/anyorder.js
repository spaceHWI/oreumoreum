// 장비 순서 없이 사기·귤이 모자라면 흑백 (#111). node tools/anyorder.js
const { chromium } = require('playwright');
let fails = 0; const ok = (c, msg) => { console.log(c ? 'ok  ' : 'FAIL', msg); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  p.on('pageerror', (e) => { console.log('ERR', e.message.slice(0, 300)); fails++; });
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await p.waitForTimeout(6000);
  await p.click('#enter').catch(() => {}); await p.waitForTimeout(6000);
  const r = await p.evaluate(async () => {
    const O = window.__oreum, s = O.save, C = O.cleanhouse, out = {};
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    O.tut.skipAll?.(); await wait(300); out.dev = !!document.getElementById("dev-gyul");
    s.coins = 500; s.equip.tool = 1; O.closePanels?.();
    C.openShop('tool'); await wait(100);
    const cells = () => [...document.querySelectorAll('#shop-body .tier')].map((c) => c.className.replace('tier', '').trim());
    out.cells0 = cells(); out.locks = document.querySelectorAll('#shop-body .tier .st svg path[d^="M7 11"]').length;
    out.canBuy = C.canBuyGear();
    // 3단계(갈퀴 400)를 바로 산다
    document.querySelector('#shop-body .tier[data-i="2"]').click(); await wait(50);
    out.btnShort = document.querySelector('#shop-body .tier-buy').classList.contains('short');
    document.querySelector('#shop-body .tier-buy').click(); await wait(100);
    out.after = { tool: s.equip.tool, coins: s.coins }; out.cells1 = cells();
    // 5단계: 귤 모자람 → 흑백·토스트
    document.querySelector('#shop-body .tier[data-i="4"]').click(); await wait(50);
    const bb = document.querySelector('#shop-body .tier-buy'); out.shortTop = bb.classList.contains('short'); bb.click(); await wait(100);
    out.toast = document.querySelector('#toast')?.textContent || [...document.querySelectorAll('.toast')].map((t) => t.textContent).pop();
    out.tool5 = s.equip.tool;
    // 귤이 늘면 바로 색이 돌아옴
    s.coins = 99999; O.updateStats ? O.updateStats() : null; window.__oreum.save.coins = 99999;
    document.querySelector('#menu') && null;
    return out;
  });
  console.log(JSON.stringify(r));
  ok(r.cells0.filter((c) => c.includes('poor')).length >= 2 && !r.cells0[1].includes('poor'), '귤 500: 집게는 색, 비싼 단계는 흑백');
  ok(r.locks === 0, '자물쇠 없음');
  ok(r.after.tool === 3 && r.after.coins === 100, '갈퀴를 바로 삼 (값은 400만)');
  ok(r.cells1[0].includes('own') && r.cells1[1].includes('own'), '건너뛴 단계는 가짐');
  ok(r.shortTop && r.tool5 === 3, '모자라면 못 삼');
  // 귤 수가 바뀌면 다시 그림
  const g = await p.evaluate(async () => {
    const O = window.__oreum, s = O.save; s.coins += 100000; O.devAddCoins?.();
    document.getElementById('dev-gyul')?.click(); // 개발자 버튼이 없으면 아래로
    await new Promise((r) => setTimeout(r, 50));
    return [...document.querySelectorAll('#shop-body .tier.poor')].length;
  });
  ok(g === 0, '귤이 늘면 흑백이 사라짐 (' + g + ')');
  // LEAP 신발 건너뛰기
  const l = await p.evaluate(async () => {
    const O = window.__oreum, s = O.save; if (!O.leap) return null; s.coins = 100000; s.equip.shoes = 1;
    O.leap.open(); O.leap.slot('shoes'); await new Promise((r) => setTimeout(r, 100));
    const items = O.leap.items('shoes'); const top = items[items.length - 1];
    O.leap.pick(top.id); const okb = O.leap.buy(top.id);
    return { okb, shoes: s.equip.shoes, locked: document.querySelectorAll('#shoppop-cards .leap-card.locked').length };
  });
  console.log(JSON.stringify(l));
  if (l) ok(l.okb && l.shoes === 5 && !l.locked, 'LEAP 신발 5단계를 바로 삼');
  const pr = await p.evaluate(async () => {
    const O = window.__oreum, s = O.save; s.coins = 0; O.leap?.open(); O.leap?.slot('top'); await new Promise((r) => setTimeout(r, 50));
    document.getElementById('dev-gyul'); const n = document.querySelectorAll('#shoppop-cards .leap-card.poor').length;
    const f = getComputedStyle(document.querySelector('#shoppop-cards .leap-card.poor .food') || document.body).filter; return { n, f };
  });
  ok(pr.n > 0 && /grayscale/.test(pr.f), 'LEAP 옷: 귤 0 이면 흑백 ' + JSON.stringify(pr));
  await b.close(); console.log(fails ? `FAIL ${fails}` : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
