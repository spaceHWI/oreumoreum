// 이름 짓기·바꾸기 확인 (#162): node tools/nick.js [--shot] — dist/test.html 손님 기준 (서버 쪽은 tools/sec.js)
const { chromium } = require('playwright');
const SHOT = process.argv.includes('--shot');
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) fail = 1; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 420, height: 760 } });
  p.on('pageerror', (e) => { console.log('ERR', e.message.slice(0, 300)); fail = 1; });
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await p.waitForTimeout(6000);
  await p.click('#enter').catch(() => {}); await p.waitForTimeout(5000);
  ok(await p.evaluate(() => !document.getElementById('look').hidden && !document.getElementById('look-nickrow').hidden), '처음: 캐릭터 고르기에 이름 칸');
  const first = await p.inputValue('#look-nick');
  ok(first.length >= 2, `무작위 이름이 들어 있음 (${first})`);
  await p.fill('#look-nick', '시1발'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => document.getElementById('look-ok').disabled && !document.getElementById('look-nick-err').hidden), '걸리는 이름: 시작 버튼 안 눌림·한 줄 안내');
  await p.fill('#look-nick', '운영자'); ok(await p.evaluate(() => document.getElementById('look-ok').disabled), '사칭 이름 막힘');
  await p.fill('#look-nick', 'a'); ok(await p.evaluate(() => document.getElementById('look-ok').disabled), '한 글자 막힘');
  await p.click('#look-nick-dice'); ok(await p.evaluate(() => !document.getElementById('look-ok').disabled), '주사위로 다시 뽑기');
  await p.fill('#look-nick', ''); await p.waitForTimeout(100);
  ok(await p.evaluate(() => !document.getElementById('look-ok').disabled && !document.getElementById('look-nick-hint').hidden && /설정/.test(document.getElementById('look-nick-hint').textContent)), '#230 비워 두면 기본 이름으로 넘어감·설정 안내 한 줄');
  await p.fill('#look-nick', '귤 줍는 하니🍊'); await p.waitForTimeout(100);
  if (SHOT) await p.screenshot({ path: 'shot-look-nick.png' });
  await p.click('#look-ok'); await p.waitForTimeout(400);
  let s = await p.evaluate(() => ({ nick: __oreum.save.nick, set: __oreum.save.nickSet, open: !document.getElementById('look').hidden }));
  ok(s.nick === '귤 줍는 하니🍊' && s.set === 1 && !s.open, `지은 이름으로 시작 (${s.nick})`);
  // 이름 바꾸기: 처음 한 번 무료
  await p.evaluate(() => { __oreum.save.coins = 2500; document.getElementById('menu-nick').click(); });
  await p.waitForTimeout(200);
  ok(await p.evaluate(() => !document.getElementById('nickwin').hidden && /무료/.test(document.getElementById('nick-new-go').textContent)), '이름 바꾸기 창: 첫 바꾸기 무료');
  await p.fill('#nick-new', 'fu ck'); ok(await p.evaluate(() => document.getElementById('nick-new-go').disabled && !document.getElementById('nick-new-err').hidden), '바꾸기도 같은 거르기');
  await p.fill('#nick-new', '오름 지킴이');
  if (SHOT) await p.screenshot({ path: 'shot-nickwin.png' });
  await p.click('#nick-new-go'); await p.waitForTimeout(200);
  s = await p.evaluate(() => ({ nick: __oreum.save.nick, coins: __oreum.save.coins, ren: __oreum.save.nickRen, open: !document.getElementById('nickwin').hidden }));
  ok(s.nick === '오름 지킴이' && s.coins === 2500 && s.ren.n === 1 && !s.open, `무료로 바뀜 (${JSON.stringify(s)})`);
  // 같은 날 두 번째: 막힘
  await p.evaluate(() => document.getElementById('menu-nick').click()); await p.fill('#nick-new', '두번째 이름');
  ok(await p.evaluate(() => document.getElementById('nick-new-go').disabled && /하루/.test(document.getElementById('nick-new-note').textContent)), '하루 한 번');
  // 다음 날: 2,000 귤
  await p.evaluate(() => { __oreum.save.nickRen.day -= 1; document.getElementById('nickwin-close').click(); document.getElementById('menu-nick').click(); });
  await p.fill('#nick-new', '두번째 이름');
  ok(await p.evaluate(() => /2,000/.test(document.getElementById('nick-new-go').textContent)), '두 번째는 귤 2,000');
  await p.click('#nick-new-go'); await p.waitForTimeout(200);
  s = await p.evaluate(() => ({ nick: __oreum.save.nick, coins: __oreum.save.coins, ren: __oreum.save.nickRen }));
  ok(s.nick === '두번째 이름' && s.coins === 500 && s.ren.n === 2, `귤 2,000 빠지고 바뀜 (${s.coins})`);
  await p.evaluate(() => { __oreum.save.nickRen.day -= 1; document.getElementById('menu-nick').click(); });
  await p.fill('#nick-new', '세번째 이름');
  ok(await p.evaluate(() => document.getElementById('nick-new-go').disabled && /2,500귤 더 필요/.test(document.getElementById('nick-new-go').textContent)), '모자라면 \'2,500귤 더 필요\' (값 3,000)');
  // #230 메뉴 맨 위 '이름: 지금 이름 바꾸기 ›' (스크롤 없이)
  await p.evaluate(() => { document.getElementById('nickwin-close').click(); document.getElementById('btn-menu').click(); }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => { const e = document.getElementById('menu-nick'), r = e.getBoundingClientRect(); return document.getElementById('menu-nick-name').textContent === '두번째 이름' && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight && document.getElementById('menu').scrollTop === 0; }), '#230 메뉴 맨 위에 지금 이름·바꾸기');
  await p.evaluate(() => document.getElementById('menu-nick').click()); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !document.getElementById('nickwin').hidden), '#230 메뉴 이름 줄 → 이름 바꾸기 창');
  // 내 가방 이름 옆 버튼
  await p.evaluate(() => { document.getElementById('nickwin-close').click(); __oreum.save.coins = 99999; });
  await p.evaluate(() => document.getElementById('menu-wardrobe').click()); await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.getElementById('nick-mirror').textContent === '두번째 이름'), '내 가방에 지금 이름');
  await p.evaluate(() => document.getElementById('nick-reroll').click()); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !document.getElementById('nickwin').hidden), '내 가방 → 이름 바꾸기 창');
  if (SHOT) await p.screenshot({ path: 'shot-nickwin-bag.png' });
  await b.close();
  process.exit(fail);
})();
