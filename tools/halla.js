// 한라산 원경 확인 (#81): node tools/halla.js [mobile] → dist/halla-<곳>-<때>.png
// 곳: 정상(photo.stone)·능선(bench)·들머리(start), 때: 낮 13시·해 질 녘 17.15시·밤 21시·(해 뜰 녘 7.5시). 카메라는 한라산 쪽(동북동)을 본다
const { chromium, devices } = require('playwright');
(async () => {
  const mob = process.argv[2] === 'mobile', only = process.argv[3];
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext(mob ? { ...devices['iPhone 13'] } : { viewport: { width: 960, height: 540 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message.slice(0, 300)));
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi');
  await p.click('#enter', { timeout: 60000 }).catch(() => {}); await p.waitForTimeout(1500);
  await p.click('#intro-srv button >> nth=0', { timeout: 5000 }).catch(() => {}); await p.waitForTimeout(500); await p.click('#srv-go', { timeout: 5000 }).catch(() => {});
  await p.waitForFunction(() => { const e = document.getElementById('intro'); return !e || e.hidden || getComputedStyle(e).display === 'none' || getComputedStyle(e).opacity === '0'; }, null, { timeout: 30000 }).catch(() => console.log('intro still open'));
  await p.waitForTimeout(2000);
  const H = Math.PI - 40 * Math.PI / 180; // 한라산 쪽 heading (HALLA.bearing, heading 은 남쪽 기준)
  const spots = { top: 'photo.stone', ridge: 'bench.pos', trail: 'start' }, tods = { day: 13, dusk: 17.15, night: 21, dawn: 7.5 };
  for (const [sk, path] of Object.entries(spots)) for (const [tk, t] of Object.entries(tods)) {
    if (only && !only.split(',').some((o) => o === sk || o === tk || o === sk + '-' + tk)) continue;
    if (!only && tk === 'dawn') continue;
    await p.evaluate(([path, t, H]) => { const o = window.__oreum; let v = path.split('.').reduce((a, k) => a[k], o.spots); if (path === 'photo.stone') v = { x: v.x - o.spots.photo.out.x * 6, z: v.z - o.spots.photo.out.z * 6 }; // 정상: 돌 표지석 안쪽
      document.querySelectorAll('#intro,.hud,.pad,.dock,#ach-chip,#hint,#compass,#toast,#top,#tips').forEach((e) => (e.style.visibility = 'hidden'));
      o.look?.close?.(); o.setTod(t); o.tp(v.x, v.z, H, 0.02, 5, 0.25); }, [path, t, H]);
    await p.waitForTimeout(3500);
    await p.screenshot({ path: `dist/halla-${mob ? 'm-' : ''}${sk}-${tk}.png` });
    console.log(sk, tk, process.env.DBG ? await p.evaluate(() => { const o = window.__oreum, c = o.camObj; let m; o.scene.traverse((x) => { if (x.name === 'halla-main') m = x; }); const v = m.position.clone(); v.y = 13700; v.project(c); return [c.position.x | 0, c.position.y | 0, c.position.z | 0, v.x.toFixed(2), v.y.toFixed(2), v.z.toFixed(4)].join(' '); }) : '');
  }
  await b.close();
})();
