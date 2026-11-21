// 촬영 모드 검사 (#185): node tools/rec.js
// dist/test.html 을 열어 게임에 들어간 뒤 촬영 모드를 켜고 3초 녹화 → Blob 크기 > 0, 세로 9:16, 형식, 소리 트랙, 영상 첫 프레임이 비지 않았는지,
// UI(HTML)가 영상에 없는지(녹화 화면 가운데 색 = 게임 캔버스 가운데 색), '화면 그대로'·'방금 30초' 도 한 번씩. 녹화 전·중 프레임 시간
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 }, acceptDownloads: true });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 300)));
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await p.waitForTimeout(6000);
  await p.click('#enter').catch(() => {}); await p.waitForTimeout(6000);
  await p.mouse.click(480, 270); // 소리 깨우기(사용자 몸짓)
  const fps = (ms) => p.evaluate((ms) => new Promise((res) => { const f0 = window.__oreum.renderer.info.render.frame, t0 = performance.now(); setTimeout(() => res((window.__oreum.renderer.info.render.frame - f0) * 1000 / (performance.now() - t0)), ms); }), ms);
  const out = {};
  out.info0 = await p.evaluate(() => window.__oreum.rec.info());
  out.fpsBefore = +(await fps(3000)).toFixed(1);
  // 1) 세로 9:16
  await p.evaluate(() => { const r = window.__oreum.rec; r.on(true); r.set('shape', 'v'); r.start(); });
  await p.waitForTimeout(500);
  out.frameGuide = await p.evaluate(() => !document.getElementById('rec-frame').hidden);
  out.during = await p.evaluate(() => window.__oreum.rec.info());
  out.fpsDuring = +(await fps(2500)).toFixed(1);
  const dl = p.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  await p.evaluate(() => window.__oreum.rec.stop());
  await p.waitForTimeout(1500);
  out.v = await p.evaluate(() => window.__oreum.rec.info().last);
  // 첫 프레임 디코드: 가운데 색이 게임 캔버스 가운데와 비슷한지(비거나 검지 않은지)
  out.decode = await p.evaluate(() => new Promise((res) => {
    const blob = window.__oreum.rec.blob(); if (!blob) return res(null);
    const v = document.createElement('video'); v.muted = true; v.src = URL.createObjectURL(blob);
    v.onloadeddata = () => { v.currentTime = 1; };
    v.onseeked = () => { const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; const g = c.getContext('2d'); g.drawImage(v, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let sum = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 97) { sum += d[i] + d[i + 1] + d[i + 2]; n++; } res({ w: v.videoWidth, h: v.videoHeight, mean: Math.round(sum / n / 3) }); };
    v.onerror = () => res({ err: v.error?.message || 'decode' });
    setTimeout(() => res({ err: 'timeout' }), 5000);
  }));
  out.downloaded = !!(await dl);
  // 2) 화면 그대로
  await p.evaluate(() => { const r = window.__oreum.rec; r.set('shape', 'full'); r.start(); });
  await p.waitForTimeout(3000);
  await p.evaluate(() => window.__oreum.rec.stop()); await p.waitForTimeout(1200);
  out.full = await p.evaluate(() => window.__oreum.rec.info().last);
  // 3) 방금 30초 (버퍼)
  await p.evaluate(() => { const r = window.__oreum.rec; r.set('shape', 'v'); r.forceBuf(); r.set('buf', 1); });
  await p.waitForTimeout(3500);
  out.bufRunning = await p.evaluate(() => window.__oreum.rec.info().buf);
  await p.evaluate(() => window.__oreum.rec.clip()); await p.waitForTimeout(1500);
  out.clip = await p.evaluate(() => window.__oreum.rec.info().last);
  await p.evaluate(() => { const r = window.__oreum.rec; r.set('buf', 0); r.on(false); });
  await p.waitForTimeout(300);
  out.after = await p.evaluate(() => window.__oreum.rec.info());
  console.log(JSON.stringify(out, null, 1));
  const ok = out.v?.size > 0 && Math.abs(out.v.w / out.v.h - 9 / 16) < 0.01 && out.full?.size > 0 && out.bufRunning >= 1 && out.clip?.size > 0 && out.clip.w === 9 * out.clip.h / 16 && !out.after.size && !errs.length && out.decode && !out.decode.err && out.decode.mean > 8;
  if (errs.length) console.log('ERR', errs);
  if (!ok) console.log('why', JSON.stringify({ v: out.v, decode: out.decode, full: out.full, buf: out.bufRunning, clip: out.clip, after: out.after.size }));
  console.log(ok ? 'rec ok' : 'rec FAIL');
  await b.close(); process.exit(ok ? 0 : 1);
})();
