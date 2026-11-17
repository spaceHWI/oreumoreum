// 노루·돌하르방·가로등 화면 확인 (#2): node tools/lifeshots.js <dist 폴더> <index.html|test.html> <이름> [모델 늦추기 ms]
// 낮·밤으로 하르방·가로등·노루(풀 뜯기·걷기·경계·도망)·노루 타기를 찍어 $SHOTS(기본 /tmp/claude-0/shots/)<이름>-*.png. 전·후 비교에 씀
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const [,, ROOTDIR, PAGE, TAG, DELAY] = process.argv;
const OUT = process.env.SHOTS || '/tmp/claude-0/shots/'; fs.mkdirSync(OUT, { recursive: true });
const server = http.createServer((req, res) => { const f = path.join(ROOTDIR, decodeURIComponent(req.url.split('?')[0].split('#')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  const t = f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream'; res.writeHead(200, { 'content-type': t }); res.end(fs.readFileSync(f)); });
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/${PAGE}`;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 560, height: 360 } })).newPage();
  const errs = []; p.on('pageerror', (e) => { errs.push(e.message); console.log('ERR', e.message.slice(0, 300)); });
  if (DELAY) await p.route('**/a/*.bin', async (r) => { if (r.request().url().includes('runner')) return r.continue(); await new Promise((ok) => setTimeout(ok, +DELAY)); r.continue(); });
  await p.goto(base + '#namsongi'); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { server: 'clean', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1 }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.click('#enter', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(800);
  await p.evaluate(() => { const st = document.createElement('style'); st.textContent = 'body > *:not(canvas){display:none!important}'; document.head.append(st); const o = window.__oreum; o.setWeather('clear'); if (o.pace?.test?.hold) o.pace.test.hold(); });
  if (!DELAY) { await p.evaluate(() => { const L = window.__oreum.life.deer; if (L[0]) L[0].pos.copy(window.__oreum.player.pos); }); await p.waitForTimeout(500);
    await p.waitForFunction(() => { const a = window.__oreum.assets; return !a || a.done >= a.total; }, null, { timeout: 120000 }); await p.waitForTimeout(1500); }
  const shot = async (name, tod, setup) => {
    await p.evaluate(([tod, setup]) => { const o = window.__oreum; o.setTod(tod); o.cam.mode = 'free'; new Function('o', setup)(o); }, [tod, setup]);
    await p.waitForTimeout(1800); await p.screenshot({ path: `${OUT}${TAG}-${name}.png` });
  };
  // 하르방: 앞에서 조금 비스듬히
  const hb = `const h = o.life.hareubangs[0], a = h.root.rotation.y + 0.5, y = o.groundAt(h.pos.x, h.pos.z); o.player.pos.set(h.pos.x + Math.sin(a) * 14, y, h.pos.z + Math.cos(a) * 14); const c = o.camObj; c.position.set(h.pos.x + Math.sin(a) * 6.5, y + 2.4, h.pos.z + Math.cos(a) * 6.5); c.lookAt(h.pos.x, y + 1.5, h.pos.z);`;
  // 가로등: 길에서 옆으로
  const lamp = `const L = o.spots.lamps, i = Math.min(2, L.length - 1), [x, z, ry] = L[i], y = o.height(x, z), a = ry + 1.9; o.player.pos.set(x + Math.sin(a) * 18, o.groundAt(x + Math.sin(a) * 18, z + Math.cos(a) * 18), z + Math.cos(a) * 18); const c = o.camObj; c.position.set(x + Math.sin(a) * 8, y + 2.6, z + Math.cos(a) * 8); c.lookAt(x + Math.sin(ry) * 0.6, y + 2, z + Math.cos(ry) * 0.6);`;
  // 노루 넷을 한 줄로 (풀 뜯기·걷기·경계·도망 자세). 플레이어는 멀리
  const deer = `const P = o.player.pos, s = o.spots.start, X = o.life.hareubangs[0].pos.x + 12, Z = o.life.hareubangs[0].pos.z + 4, y = o.height(X, Z); const st = ['graze', 'walk', 'alert', 'flee'];
    o.life.deer.slice(0, 4).forEach((d, k) => { d.pos.set(X + (k - 1.5) * 2.4, 0, Z); d.pos.y = o.height(d.pos.x, d.pos.z); d.home.copy(d.pos); d.heading = -0.6; d.state = st[k]; d.t = 30; d.speed = [0, 1.6, 0, 7][k]; d.target = null; });
    P.set(X, o.groundAt(X, Z - 40), Z - 40); const c = o.camObj; c.position.set(X - 2.5, y + 2.6, Z + 6.5); c.lookAt(X, y + 0.8, Z);`;
  await shot('hb-day', 13, hb); await shot('lamp-day', 13, lamp); await shot('lamp-night', 22, lamp); await shot('hb-night', 22, hb);
  await shot('deer-day', 13, deer); await shot('deer-night', 22, deer);
  // 노루 타기 (#2 새 몸에 맞춘 자리)
  if (await p.evaluate(() => !!window.__oreum.lifeModels)) {
    await p.evaluate(() => { const o = window.__oreum, d = o.life.deer[0]; o.player.pos.copy(d.pos); d.state = 'graze'; o.lifeModels.mount(0); o.cam.mode = 'follow'; });
    await shot('ride', 13, `const d = o.player.riding, y = d.pos.y; const c = o.camObj, a = d.heading + 1.5; c.position.set(d.pos.x + Math.sin(a) * 4.5, y + 2, d.pos.z + Math.cos(a) * 4.5); c.lookAt(d.pos.x, y + 1.3, d.pos.z);`);
    const r = await p.evaluate(() => ({ riding: !!window.__oreum.player.riding, lamps: window.__oreum.lifeModels.lamps() })); console.log('ride', JSON.stringify(r));
  }
  console.log(TAG, 'errors', errs.length, JSON.stringify(await p.evaluate(() => window.__oreum.assets)));
  await b.close(); server.close();
})();
