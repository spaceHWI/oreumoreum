// 장비 순서 없이 사기·귤이 모자라면 흑백 (#111). node tools/anyorder.js
const { chromium } = require('playwright');
let fails = 0; const ok = (c, msg) => { console.log(c ? 'ok  ' : 'FAIL', msg); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  p.on('pageerror', (e) => { console.log('ERR', e.message.slice(0, 300)); fails++; });
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await p.waitForTimeout(6000);
  await p.click('#enter').catch(() => {}); await p.waitForTimeout(6000);
  // 장비점 창(가게 거리 장비점, #128)의 집게 묶음. 옛 상점 창(#shop-body .tier)은 #128 에서 없어져 이 검사를 새 창에 맞춤 (#193)
  const r = await p.evaluate(async () => {
    const O = window.__oreum, s = O.save, out = {};
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    O.tut.skipAll?.(); await wait(300); out.dev = !!document.getElementById('dev-gyul');
    s.coins = 1000; s.equip.tool = 1; O.closePanels?.();
    O.street.open('gear'); await wait(150);
    const cards = () => [...document.querySelectorAll('#shoppop .buy-group[data-k="tool"] .buy-card')].map((c) => c.className.replace('buy-card', '').trim());
    const btn = (i) => document.querySelector(`#shoppop .buy-group[data-k="tool"] .buy-card[data-i="${i}"] .buy-btn`);
    out.cells0 = cards(); out.locks = document.querySelectorAll('#shoppop .buy-group[data-k="tool"] .buy-card.lock, #shoppop .buy-group[data-k="tool"] .buy-card .lock').length;
    // 3단계(갈퀴 800)를 바로 산다 (집게를 건너뜀)
    out.btnShort = btn(2)?.classList.contains('short'); btn(2)?.click(); await wait(150);
    out.after = { tool: s.equip.tool, coins: s.coins }; out.cells1 = cards();
    // 5단계: 귤 모자람 → 흑백·못 삼
    const bb = btn(4); out.shortTop = !!bb?.classList.contains('short'); bb?.click(); await wait(100);
    out.tool5 = s.equip.tool;
    return out;
  });
  console.log(JSON.stringify(r));
  ok(r.cells0[3].includes('poor') && r.cells0[4].includes('poor') && !r.cells0[1].includes('poor') && !r.cells0[2].includes('poor'), '귤 1000: 집게·갈퀴는 색, 비싼 단계는 흑백');
  ok(r.locks === 0, '자물쇠 없음');
  ok(!r.btnShort && r.after.tool === 3 && r.after.coins === 200, '갈퀴를 바로 삼 (값은 800만)');
  ok(r.cells1[0].includes('own') && r.cells1[1].includes('own') && r.cells1[2].includes('own'), '건너뛴 단계는 가짐');
  ok(r.shortTop && r.tool5 === 3, '모자라면 못 삼');
  // 귤 수가 바뀌면 다시 그림
  const g = await p.evaluate(async () => {
    const O = window.__oreum, s = O.save; s.coins = 100000; if (O.updateStats) O.updateStats(); else O.street.open('gear'); /* 귤 칸 갱신이 창을 다시 그림 */
    for (let i = 0; i < 20 && document.querySelectorAll('#shoppop .buy-card.poor').length; i++) await new Promise((r) => setTimeout(r, 100));
    return document.querySelectorAll('#shoppop .buy-group[data-k="tool"] .buy-card.poor').length;
  });
  ok(g === 0, '귤이 늘면 흑백이 사라짐 (' + g + ')');
  await p.evaluate(() => { document.getElementById('shoppop-close')?.click(); });
  // LEAP 신발 건너뛰기
  const l = await p.evaluate(async () => {
    const O = window.__oreum, s = O.save; if (!O.leap) return null; s.coins = 100000; s.equip.shoes = 1;
    O.leap.open(); O.leap.slot('shoes'); await new Promise((r) => setTimeout(r, 100));
    const items = O.leap.items('shoes'); const top = items.filter((i) => i.shoes).pop(); /* 맨 끝은 특별 신발 장화(#167)라 단계 신발 중 맨 위 (#193) */
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
