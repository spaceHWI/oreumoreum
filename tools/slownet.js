// 느린 연결·받기 실패 확인 (#90): dist/index.html(GitHub Pages 처럼 모델 .bin 을 따로 받음)을 3G 흉내로 열어
// 첫 화면까지 걸린 시간, 임시 모양이 보이는 시간, 받다가 실패해도 게임이 멈추지 않는지 본다.
//   node tools/slownet.js [3g|fail|dead]   (먼저 node build.mjs)
//   3g   : 1.6Mbps · RTT 300ms (Chrome '3G' 정도). 모델이 다 올 때까지 시간을 잰다
//   fail : 3g + 모델 .bin 요청마다 처음 두 번은 끊음 → 다시 받기(4초 뒤)로 결국 다 오는지
//   dead : 3g + 캐릭터(runner) 말고 모델 .bin 을 끝까지 끊음 → 임시 모양 그대로 걸을 수 있는지
// (날씨 API 429·일부러 끊은 요청의 콘솔 오류는 셈하지 않음)
// 끝 화면은 dist/slownet-<모드>.jpg
// 확인: 페이지 오류 0, 프레임이 계속 늘어남(멈추지 않음), 걷기로 위치가 바뀜
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.resolve(__dirname, '../dist');
const MODE = process.argv[2] || '3g';
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0].split('#')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  const raw = fs.readFileSync(f), text = /\.(html|js|json)$/.test(f), gz = text ? zlib.gzipSync(raw) : raw;
  const type = f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'application/octet-stream';
  res.writeHead(200, { 'content-type': type, ...(text ? { 'content-encoding': 'gzip' } : {}), 'content-length': gz.length, 'cache-control': 'no-store' });
  res.end(gz);
});
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/index.html#namsongi`;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 480, height: 320 } });
  const p = await ctx.newPage();
  const errs = [], warns = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
  p.on('console', (m) => { if (m.type() === 'error' && !/429|ERR_CONNECTION_RESET|ERR_FAILED/.test(m.text())) errs.push(m.text().slice(0, 200)); if (m.type() === 'warning' && /모델/.test(m.text())) warns.push(m.text().slice(0, 80)); });
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 300, downloadThroughput: 1.6e6 / 8, uploadThroughput: 0.75e6 / 8 });
  const tries = {}; let cut = 0;
  await p.route('**/a/*.bin', (route) => {
    const n = route.request().url().split('/').pop().replace(/-[0-9a-f]+\.bin$/, '');
    tries[n] = (tries[n] || 0) + 1;
    if ((MODE === 'fail' && tries[n] <= 2) || (MODE === 'dead' && n !== 'runner')) { cut++; return route.abort('connectionreset'); }
    return route.continue();
  });
  const t0 = Date.now();
  await p.goto(url, { timeout: 180000 });
  const tShow0 = await p.waitForSelector('#enter', { state: 'visible', timeout: 180000 }).then(() => (Date.now() - t0) / 1000); await p.waitForSelector('#enter:not([disabled])', { timeout: 180000 });
  const tTitle = (Date.now() - t0) / 1000;
  await p.click('#enter').catch(() => {}); await p.click('#intro-srv button').catch(() => {}); await p.click('#srv-go').catch(() => {});
  await p.waitForTimeout(2500); await p.click('#look-ok').catch(() => {}); await p.waitForTimeout(1500);
  const tGame = (Date.now() - t0) / 1000;
  const snap = () => p.evaluate(() => { const o = window.__oreum; return { f: o.renderer.info.render.frame, done: o.assets.done, total: o.assets.total, x: +o.player.pos.x.toFixed(1), z: +o.player.pos.z.toFixed(1) }; });
  const log = []; let s = await snap(), tAll = null; const atStart = `${s.done}/${s.total}`;
  const limit = MODE === 'dead' ? 40 : 150;
  for (let i = 0; i < limit; i += 5) {
    await p.keyboard.down('w'); await p.waitForTimeout(2500); await p.keyboard.up('w'); await p.waitForTimeout(2500);
    const n = await snap(); log.push({ t: Math.round((Date.now() - t0) / 1000), frames: n.f - s.f, models: `${n.done}/${n.total}`, moved: Math.hypot(n.x - s.x, n.z - s.z).toFixed(1) }); s = n;
    if (n.done >= n.total && tAll == null) { tAll = (Date.now() - t0) / 1000; if (MODE !== 'dead') break; }
  }
  console.table(log);
  await p.screenshot({ path: path.join(ROOT, `slownet-${MODE}.jpg`), quality: 70 }); // 끝 화면 (dead 면 임시 모양)
  const stuck = log.some((r) => r.frames === 0);
  console.log(`${MODE}: 첫 화면 ${tShow0.toFixed(1)}초(누를 수 있게 ${tTitle.toFixed(1)}초), 게임 시작 ${tGame.toFixed(1)}초, 시작 때 모델 ${atStart}, 모델 다 옴 ${tAll ? tAll.toFixed(1) + '초' : '안 옴'}, 끊은 요청 ${cut}, 받기 실패 경고 ${warns.length}, 페이지 오류 ${errs.length}${stuck ? ', 멈춘 구간 있음' : ''}`);
  errs.slice(0, 5).forEach((e) => console.log('ERR', e));
  await b.close(); server.close();
  process.exit(errs.length || stuck ? 1 : 0);
})();
