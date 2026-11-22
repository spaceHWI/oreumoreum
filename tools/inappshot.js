/* 인앱 안내 검사 (#239): 앱 5종 × 기기 2종 UA 로 열어 그 앱 안내만 보이는지 본다. 먼저 node build.mjs */
const { chromium } = require('playwright');
const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 ';
const AND = 'Mozilla/5.0 (Linux; Android 14; SM-S911N) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 ';
const APPS = { 카카오톡: 'KAKAOTALK 10.0', 인스타그램: 'Instagram 300.0', 페이스북: 'FBAN/FBIOS;FBAV/400', '네이버 앱': 'NAVER(inapp; search; 1000; 12.0)', 라인: 'Line/13.0' };
(async () => {
  const b = await chromium.launch(); let bad = 0;
  for (const [name, tag] of Object.entries(APPS)) for (const [dev, base] of [['아이폰', IOS], ['안드로이드', AND]]) {
    const c = await b.newContext({ userAgent: base + tag, viewport: { width: 360, height: 640 } });
    const p = await c.newPage();
    await p.goto('file://' + process.cwd() + '/dist/index.html#namsongi', { waitUntil: 'commit' }).catch(() => {}); await p.waitForTimeout(1500);
    const r = await p.evaluate(() => { const o = document.getElementById('inapp'), t = document.getElementById('inapp-title').textContent, bt = document.getElementById('inapp-open');
      const box = o.firstElementChild.getBoundingClientRect(); return { show: !o.hidden, t, steps: document.querySelectorAll('#inapp-steps li').length, btn: bt.style.display === 'none' ? '' : bt.textContent, fit: box.height <= innerHeight, small: [...document.querySelectorAll('#inapp-steps li')].every(l => parseFloat(getComputedStyle(l).fontSize) >= 15) }; });
    const ok = r.show && r.t === name + ' 안에서는 잘 안 돼요' && r.steps >= 2 && r.steps <= 3 && r.fit && r.small && (r.btn === '' ? (dev === '아이폰' && name !== '카카오톡') : r.btn === (dev === '아이폰' ? '사파리로 열기' : '크롬으로 열기'));
    console.log(ok ? 'OK ' : 'BAD', name, dev, JSON.stringify(r)); if (!ok) bad++;
    await p.screenshot({ path: `/tmp/inapp-${name}-${dev}.png` }); await c.close();
  }
  const c = await b.newContext({ viewport: { width: 360, height: 640 } }), p = await c.newPage();
  await p.goto('file://' + process.cwd() + '/dist/index.html#namsongi', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
  const plain = await p.evaluate(() => document.getElementById('inapp').hidden); console.log(plain ? 'OK ' : 'BAD', '일반 브라우저는 안내 없음'); if (!plain) bad++;
  await b.close(); process.exit(bad ? 1 : 0);
})();
