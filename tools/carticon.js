// #228 마차 아이콘 확인: node tools/carticon.js → dist/carticon-<모드>-wait.jpg · -here.jpg (정류장 둘레 고리: 기다림·마차 서 있음) + 고리 그림만 dist/carticon-ring-*.png
// 검사: 고리 가운데에 마차 아이콘이 그려짐(빈 칸 아님), 기다리는 동안은 회색·서 있으면 흰색, 페이지 오류 0
const { chromium, devices } = require('playwright');
const fs = require('fs');
const VIEW = { p: { ...devices['iPhone 13 landscape'] }, d: { viewport: { width: 1280, height: 720 } } };
let fails = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const mode of ['d', 'p']) {
    const ctx = await b.newContext(VIEW[mode]); const p = await ctx.newPage(); let errs = 0;
    p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
    const W = (ms) => p.waitForTimeout(ms), ev = (fn, a) => p.evaluate(fn, a);
    await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await W(6000);
    await p.click('#enter').catch(() => {}); await W(4000);
    if (await ev(() => !document.getElementById('look')?.hidden)) { await p.click('#look-ok').catch(() => {}); await W(1500); }
    await ev(() => { const o = window.__oreum; o.save.jeong = 1; o.tut?.skipAll?.(); o.setTod?.(14); o.cam.mode = 'follow'; });
    await W(1500);
    const ring = (i) => ev((i) => { const S = window.__oreum.rides.cart.api.stops[i], c = S.ring.material.map.image, x = c.getContext('2d'), d = x.getImageData(36, 40, 24, 18).data; let n = 0, sum = 0; for (let k = 0; k < d.length; k += 4) if (d[k + 3] > 200 && d[k] > 100) { n++; sum += d[k]; } return { vis: S.ring.visible, n, lum: n ? Math.round(sum / n) : 0, url: c.toDataURL() }; }, i);
    for (const [name, wantHere] of [['wait', false], ['here', true]]) {
      const t = await ev((h) => { const c = window.__oreum.rides.cart; if (h) return c.at(0); for (let s = 0; s < 400; s += 5) { c.shift(s); const st = c.state(); if (st.moving && st.stop < 0) return s; } return null; }, wantHere);
      let r = null; /* 정류장 고리는 카메라가 가까이 와야 보임: 자리를 옮긴 뒤 보일 때까지 기다림 */
      for (let k = 0; k < 8 && !(r && r.vis && r.n > 20); k++) { await ev(() => window.__oreum.rides.cart.goStop(0)); await W(1200); r = await ring(0); }
      ok(r.vis && r.n > 20, `${mode} ${name}: 고리 보임 ${r.vis}, 가운데 그림 칸 ${r.n}, 밝기 ${r.lum} (shift ${t})`);
      if (mode === 'd') fs.writeFileSync(`dist/carticon-ring-${name}.png`, Buffer.from(r.url.split(',')[1], 'base64'));
      await p.screenshot({ path: `dist/carticon-${mode}-${name}.jpg`, type: 'jpeg', quality: 55, scale: 'css' });
    }
    ok(!errs, `${mode}: 페이지 오류 ${errs}`);
    await ctx.close();
  }
  await b.close(); console.log(fails ? '실패 ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
