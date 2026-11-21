// 날씨 모습 비교 (#147): node tools/wxshot.js [--out notes/shots/weather.png]  (먼저 node build.mjs)
// 맑음·흐림·비·눈 × 낮·해 질 녘·밤을 같은 자리에서 작게 찍어 한 장(4줄 × 3칸)으로 붙인다. 섞이는 시간(실제 초)도 잰다
const path = require('path');
const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : path.join(__dirname, '../notes/shots/weather.png');
(async () => {
  const { chromium } = require('playwright');
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 320, height: 200 } }); const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
  await pg.goto('file://' + path.join(__dirname, '../dist/test.html') + '#namsongi'); await pg.waitForTimeout(6000);
  await pg.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1 }); const k = Object.keys(localStorage).find((q) => q.startsWith('oreumoreum') && !q.includes('.ab') && !q.includes('inbox')); localStorage.setItem(k || 'oreumoreum.v1', JSON.stringify(o.save)); });
  await pg.reload(); await pg.waitForTimeout(6000); await pg.click('#enter').catch(() => {}); await pg.waitForTimeout(3000);
  await pg.evaluate(() => { const o = window.__oreum; if (o.tut?.active) o.tut.skipAll(); document.body.classList.add('shot-clean'); for (const id of ['intro', 'intro-help', 'wake']) { const e = document.getElementById(id); if (e) e.hidden = true; } const st = document.createElement('style'); st.textContent = 'body > *:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; } #minimap { visibility: hidden !important; }'; document.head.appendChild(st); });
  // 섞이는 시간: 맑음 → 비, 실제 초
  const blend = await pg.evaluate(async () => { const o = window.__oreum, W = (ms) => new Promise((r) => setTimeout(r, ms)); o.wx.set('clear'); await W(9000); const t0 = performance.now(); o.wx.set('rain'); while (o.wx.cur.rain < 0.9 && performance.now() - t0 < 30000) await W(100); return (performance.now() - t0) / 1000; });
  console.log(`섞이는 시간: 맑음 → 비 90% ${blend.toFixed(1)}초 (실제 시간)`);
  const kinds = ['clear', 'overcast', 'rain', 'snow'], tods = [13, 17.6, 22];
  const shots = [];
  for (const k of kinds) for (const h of tods) {
    await pg.evaluate(async ([k, h]) => { const o = window.__oreum, W = (ms) => new Promise((r) => setTimeout(r, ms)); o.wx.set(k); o.setTod(h); o.tp(-600, 135, 2.4, 0.12, 12, 0.4); for (let i = 0; i < 150 && !o.wx.settled; i++) await W(100); o.setTod(h); await W(600); }, [k, h]);
    shots.push((await pg.screenshot()).toString('base64'));
  }
  // 한 장으로 붙이기
  await pg.setViewportSize({ width: 960, height: 800 });
  await pg.setContent(`<body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(3,320px)">${shots.map((s) => `<img src="data:image/png;base64,${s}" width="320" height="200">`).join('')}</body>`);
  await pg.waitForTimeout(300); await pg.screenshot({ path: out });
  console.log('찍음:', out, '(줄: ' + kinds.join('·') + ', 칸: ' + tods.join('시·') + '시)');
  if (errs.length) { console.log('페이지 오류:', errs.join(' | ')); process.exitCode = 1; }
  await b.close();
})();
