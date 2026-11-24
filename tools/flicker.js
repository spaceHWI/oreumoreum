// 깜박임 검사 (#280): node tools/flicker.js d|m [dist 폴더]   (d 노트북 1280×760, m 폰 390×844 배율 3·터치). 실패 기준: 튐 0
// 가. 다시 받기: 밤(제주 21시, 가짜 시계를 흐르게)에 dist/test.html 을 한 번 열어 캐시를 채우고 빈 쪽에서 다시 열고, 화면 합성 프레임(CDP screencast)을
//     첫 그림 뒤 3초까지 받아 밝기 평균을 잰다. 크게 밝아졌다가 다시 어두워지는(또는 반대) 되돌이를 '튐' 으로 센다
//     (예전: 밤색 바탕 → 받는 동안 캔버스 바탕 낮 하늘색 #cfe0dc 2~3초 → 밤 첫 화면)
// 나. 건너뛴 프레임: 가짜 시계 60Hz 에서 상한을 절약(30)으로 두고 창 크기·발열 단계(픽셀 배율)를 바꾸며, 캔버스가 비워진 뒤(setSize)
//     그리지 않고 지나간 rAF 를 센다 (빈 캔버스가 한 프레임 보이는 것, game/fps.js due)
// 다. 처음 방문 (#287 사용자 메모 '첫 화면 로딩될 때'): dist 를 http 로 띄워 Pages 빌드(index.html, 로딩 창 #boot)를 캐시·저장 없는 새 프로필로 열고
//     문서 이동부터 로딩 창이 걷히고 3초 뒤까지 프레임을 받아 색 평균(RGB)을 잰다. 앞뒤 프레임 사이(서서히 바뀜)에서 벗어난 짧은 프레임 묶음(3장 이하)을 '번쩍임' 으로 센다
//     (하늘색·흰색·검은색 등 이름을 붙여 적음). 밤·낮 둘 다. 노트북이면 아래 '나' 와 같은 크기
const { chromium } = require('playwright');
const path = require('path'), http = require('http'), fs = require('fs');
const MODE = process.argv[2] === 'm' ? 'm' : 'd';
const DEV = MODE === 'm' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 760 } };
const DIST = process.argv[3] || 'dist'; /* 앞 빌드와 견줄 때: node tools/flicker.js d <다른 dist 폴더> */
const URL = 'file://' + path.resolve(DIST, 'test.html') + '#namsongi';
const NIGHT = new Date('2026-11-23T21:00:00+09:00');
const ready = (p) => p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 180000 });

async function meanOf(p, jpgs) { /* 밝기 평균: 빈 쪽에서 그림을 캔버스에 그려 잼 */
  return p.evaluate(async (list) => {
    const c = document.createElement('canvas'), x = c.getContext('2d', { willReadFrequently: true }), out = [];
    for (const b64 of list) {
      const im = new Image(); im.src = 'data:image/jpeg;base64,' + b64; await im.decode();
      c.width = 160; c.height = Math.round(160 * im.height / im.width); x.drawImage(im, 0, 0, c.width, c.height);
      const d = x.getImageData(0, 0, c.width, c.height).data; let s = 0;
      for (let i = 0; i < d.length; i += 4) s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      out.push(s / (d.length / 4));
    }
    return out;
  }, jpgs);
}
function reversals(ms, th = 30) { /* 같은 쪽으로 이어지는 변화는 한 덩어리(서서히 밝아짐)로 묶고, 큰 덩어리가 반대로 이어지면 튐 */
  const seg = []; let cur = 0;
  for (let i = 1; i < ms.length; i++) { const d = ms[i] - ms[i - 1]; if (Math.abs(d) < 2) continue; if (cur && Math.sign(d) !== Math.sign(cur)) { seg.push(cur); cur = 0; } cur += d; }
  if (cur) seg.push(cur);
  const big = seg.filter((s) => Math.abs(s) > th); let n = 0;
  for (let i = 1; i < big.length; i++) if (Math.sign(big[i]) !== Math.sign(big[i - 1])) n++;
  return { n, seg: big.map((s) => Math.round(s)) };
}

async function reloadTest(b) {
  const ctx = await b.newContext(DEV), p = await ctx.newPage(), aux = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  await p.clock.install({ time: NIGHT }); await p.clock.resume();
  await p.goto(URL); await ready(p); await p.waitForTimeout(1500); /* 한 번 받아 캐시를 채움 */
  await p.goto('about:blank');
  const cdp = await ctx.newCDPSession(p), frames = [];
  cdp.on('Page.screencastFrame', (f) => { frames.push({ t: Date.now(), d: f.data }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 50, maxWidth: 480, maxHeight: 480, everyNthFrame: 1 });
  await p.waitForTimeout(300);
  const tNav = Date.now(); await p.goto(URL, { waitUntil: 'commit' }); /* 빈 쪽에서 다시 받기: 앞 화면이 섞이지 않게 */
  await ready(p); const tDraw = Date.now(); await p.waitForTimeout(3000);
  await cdp.send('Page.stopScreencast');
  const after = frames.filter((f) => f.t >= tNav);
  let ms = await meanOf(aux, after.map((f) => f.d));
  { let i = 0; while (i < ms.length && ms[i] > 250) i++; ms = ms.slice(i); } /* 새 문서가 처음 칠해지기 전의 흰 빈 쪽(about:blank)은 뺌 */
  const use = ms;
  const r = reversals(ms);
  console.log(`가. 다시 받기 [${MODE}] 프레임 ${use.length} · 첫 그림 ${((tDraw - tNav) / 1000).toFixed(1)}s · 밝기 ${ms.map((m) => Math.round(m)).join(' ')}`);
  console.log(`   큰 변화 ${JSON.stringify(r.seg)} → 튐 ${r.n}${errs.length ? ' · 오류 ' + errs.join(' | ') : ''}`);
  await ctx.close(); return r.n + errs.length;
}

async function rgbOf(p, jpgs) { /* 색 평균 [r,g,b] */
  return p.evaluate(async (list) => {
    const c = document.createElement('canvas'), x = c.getContext('2d', { willReadFrequently: true }), out = [];
    for (const b64 of list) {
      const im = new Image(); im.src = 'data:image/jpeg;base64,' + b64; await im.decode();
      c.width = 96; c.height = Math.max(1, Math.round(96 * im.height / im.width)); x.drawImage(im, 0, 0, c.width, c.height);
      const d = x.getImageData(0, 0, c.width, c.height).data; const s = [0, 0, 0];
      for (let i = 0; i < d.length; i += 4) { s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; }
      const n = d.length / 4; out.push(s.map((v) => Math.round(v / n)));
    }
    return out;
  }, jpgs);
}
const cdist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const cname = (c) => { const [r, g, b] = c, m = (r + g + b) / 3; if (m > 225) return '흰색'; if (m < 18) return '검은색'; if (m > 120 && b > r + 8 && g > r) return '하늘색'; return `rgb(${c.join(',')})`; };
function flashes(cs, T = 40, maxRun = 3) { /* 앞뒤 프레임을 잇는 선(서서히 바뀜)에서 T 넘게 벗어난 짧은 묶음 */
  const out = [];
  for (let i = 1; i < cs.length - 1; i++) {
    for (let L = 1; L <= maxRun && i + L < cs.length; L++) {
      const a = cs[i - 1], z = cs[i + L], run = cs.slice(i, i + L);
      if (run.every((c) => cdist(c, a) + cdist(c, z) > cdist(a, z) + T)) { out.push({ at: i, n: L, c: cname(run[0]) }); i += L - 1; break; }
    }
  }
  return out;
}
function serveDist() {
  const DIR = path.resolve(DIST);
  const srv = http.createServer((q, r) => {
    const u = decodeURIComponent(q.url.split('?')[0]), f = path.join(DIR, u);
    if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
    const ct = f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.json') ? 'application/json' : f.endsWith('.css') ? 'text/css' : 'application/octet-stream';
    r.writeHead(200, { 'content-type': ct, 'cache-control': 'no-cache' }); r.end(fs.readFileSync(f));
  });
  return new Promise((res) => srv.listen(0, '127.0.0.1', () => res(srv)));
}
async function firstVisit(b, srv, when, tag) {
  const ctx = await b.newContext(DEV), p = await ctx.newPage(), aux = await ctx.newPage();
  await ctx.route(/^https:\/\//, (rt) => rt.abort()); /* 글꼴·로그인·서버: 손님 처음 방문, 막힌 환경에서 멈추지 않게 */
  const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  await p.clock.install({ time: when }); await p.clock.resume();
  const cdp = await ctx.newCDPSession(p), frames = [];
  cdp.on('Page.screencastFrame', (f) => { frames.push({ t: Date.now(), d: f.data }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 60, maxWidth: 360, maxHeight: 360, everyNthFrame: 1 });
  await p.waitForTimeout(300);
  const tNav = Date.now(); await p.goto(`http://127.0.0.1:${srv.address().port}/index.html#namsongi`, { waitUntil: 'commit' });
  await p.waitForFunction(() => { const e = document.getElementById('boot'); return e && e.hidden; }, null, { timeout: 240000, polling: 200 });
  const tOff = Date.now(); await p.waitForTimeout(3000);
  await cdp.send('Page.stopScreencast');
  let cs = await rgbOf(aux, frames.filter((f) => f.t >= tNav).map((f) => f.d));
  { let i = 0; while (i < cs.length && Math.min(...cs[i]) > 250) i++; cs = cs.slice(i); } /* 새 문서가 칠해지기 전 about:blank 흰 쪽은 뺌 */
  const fl = flashes(cs), names = [...new Set(cs.map(cname).filter((n) => !n.startsWith('rgb')))];
  console.log(`다. 처음 방문 ${tag} [${MODE}] 프레임 ${cs.length} · 로딩 창 걷힘 ${((tOff - tNav) / 1000).toFixed(1)}s · 첫 프레임 ${cname(cs[0] || [0, 0, 0])} · 마지막 ${cname(cs[cs.length - 1] || [0, 0, 0])}`);
  console.log(`   번쩍임 ${fl.length}${fl.length ? ' ' + JSON.stringify(fl) : ''}${names.length ? ' · 이름 붙은 색이 보인 프레임: ' + names.join(',') : ''}${errs.length ? ' · 오류 ' + errs.join(' | ') : ''}`);
  if (process.env.FLK_LOG) console.log('   ' + cs.map((c) => c.join('/')).join(' '));
  await ctx.close(); return fl.length + errs.length;
}

async function skipTest(b) {
  const ctx = await b.newContext(DEV), p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  await p.clock.install({ time: NIGHT }); /* 가짜 시계가 rAF 를 바꾸니 그 뒤에 감쌈 */
  await p.addInitScript(() => { /* 게임 rAF(frame)를 알아내 그 호출마다 셈: 캔버스를 비운(setSize) 뒤 게임 프레임이 그리지 않고 끝나면 빈 캔버스가 한 프레임 보인 것 */
    const F = window.__flk = { idx: 0, cur: null, game: null, pend: false, blank: 0, sets: 0, draws: 0, log: [] };
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf((t) => {
      const prev = F.cur; F.cur = cb; const g = cb === F.game; if (g) F.idx++;
      try { cb(t); } finally { F.cur = prev; if (g && F.pend) { F.blank++; F.pend = false; F.log.push('빈@' + F.idx); } }
    });
    F.hook = (r) => {
      const s0 = r.setSize.bind(r), r0 = r.render.bind(r);
      r.setSize = (...a) => { const c = r.domElement, w = c.width, h = c.height; const res = s0(...a); if (c.width !== w || c.height !== h) { F.sets++; F.pend = true; F.log.push('set@' + F.idx); } return res; };
      r.render = (s, c) => { const res = r0(s, c); if (r.getRenderTarget() === null) { if (F.cur && !F.game) F.game = F.cur; F.pend = false; F.draws++; F.log.push('d@' + F.idx); } return res; };
    };
  });
  await p.goto(URL + ''); await p.clock.runFor(100);
  for (let i = 0; i < 400 && !(await p.evaluate(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2).catch(() => false)); i++) await p.clock.runFor(500);
  await p.evaluate(() => { const o = window.__oreum; window.__flk.hook(o.renderer); o.fps.pick('eco'); window.__flk.blank = 0; });
  const sizes = MODE === 'm' ? [[844, 390], [390, 844], [400, 700], [390, 844]] : [[1000, 700], [1280, 760], [900, 600], [1280, 760]];
  for (const [w, h] of sizes) { await p.setViewportSize({ width: w, height: h }); for (let i = 0; i < 7; i++) await p.clock.runFor(16.7); }
  for (const k of [1, 0, 1, 0]) { await p.evaluate((k) => window.__oreum.fps.heat(k), k); for (let i = 0; i < 7; i++) await p.clock.runFor(16.7); }
  for (let i = 0; i < 30; i++) { if (i % 3 === 0) await p.evaluate(() => dispatchEvent(new Event('resize'))); await p.clock.runFor(16.7); }
  const F = await p.evaluate(() => ({ ...window.__flk, hook: 0, cur: 0, game: 0, fps: window.__oreum.fps.state() }));
  if (process.env.FLK_LOG) console.log(F.log.join(' '));
  console.log(`나. 건너뛴 프레임 [${MODE}] 상한 ${F.fps.cap} · 캔버스 다시 잡음 ${F.sets} · 그림 ${F.draws} · 건너뜀 ${F.fps.skipped ?? '?'} · 비운 채 지나간 프레임 ${F.blank}${errs.length ? ' · 오류 ' + errs.join(' | ') : ''}`);
  await ctx.close(); return F.blank + errs.length;
}

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  let bad = 0;
  const only = process.env.FLK_ONLY || ''; /* 'first' 면 다만 */
  const srv = await serveDist();
  try {
    if (!only) { bad += await reloadTest(b); bad += await skipTest(b); }
    if (!only || only === 'first') { bad += await firstVisit(b, srv, NIGHT, '밤'); bad += await firstVisit(b, srv, new Date('2026-11-24T13:00:00+09:00'), '낮'); }
  } finally { await b.close(); srv.close(); }
  console.log(bad ? `실패: 튐 ${bad}` : '통과: 튐 0');
  process.exit(bad ? 1 : 0);
})();
