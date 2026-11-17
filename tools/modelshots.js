// 모델 화면 확인 (#85): node tools/modelshots.js <dist 폴더> <index.html|test.html> <이름> [모델 늦추기 ms]
// 가게 3곳·머리 4종·적 4종을 찍어 /tmp/claude-0/shots/<이름>-*.png. 늦추기를 주면 받기 전 임시 모양을 찍음. 전·후 비교에 씀
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
  const ctx = await b.newContext({ viewport: { width: 640, height: 400 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => { errs.push(e.message); console.log('ERR', e.message.slice(0, 300)); });
  if (DELAY) await p.route('**/a/*.bin', async (r) => { if (r.request().url().includes('runner')) return r.continue(); await new Promise((ok) => setTimeout(ok, +DELAY)); r.continue(); });
  const open = async (srv) => {
    await p.goto(base + '#namsongi'); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
    await p.evaluate((srv) => { const o = window.__oreum; Object.assign(o.save, { server: srv, entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1 }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); }, srv);
    await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
    await p.click('#enter', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(800);
    await p.evaluate(() => { const st = document.createElement('style'); st.textContent = 'body > *:not(canvas){display:none!important}'; document.head.append(st); const o = window.__oreum; o.setTod(13); o.setWeather('clear'); });
  };
  const waitAssets = async () => { if (DELAY) return; await p.waitForFunction(() => { const a = window.__oreum.assets; return !a || a.done >= a.total; }, null, { timeout: 120000 }); await p.waitForTimeout(1500); };
  await open('clean'); await waitAssets();
  // 가게 거리: 1~3번 터 앞
  const look = (px, py, pz, tx, ty, tz) => p.evaluate(([px, py, pz, tx, ty, tz]) => { const o = window.__oreum; o.cam.mode = 'free'; const c = o.camObj; c.position.set(px, py, pz); c.lookAt(tx, ty, tz); }, [px, py, pz, tx, ty, tz]);
  for (const i of [1, 2, 3]) {
    const v = await p.evaluate((i) => { const o = window.__oreum, L = o.street.layout.lot(i), f = L.front; const dx = f.x - L.x, dz = f.z - L.z, d = Math.hypot(dx, dz); const k = 13 / d; const cx = L.x + dx * (1 + k), cz = L.z + dz * (1 + k); o.player.pos.set(cx, o.groundAt(cx, cz), cz); return [cx, o.height(L.x, L.z) + 5, cz, L.x, o.height(L.x, L.z) + 1.5, L.z]; }, i);
    await look(...v);
    await p.waitForTimeout(2500); await p.screenshot({ path: `${OUT}${TAG}-shop${i}.png` });
  }
  // 머리 3종 + 기본: 플레이어 앞에 줄 세움
  await p.evaluate(() => { const o = window.__oreum, P = o.player.pos, base = JSON.parse(JSON.stringify(o.save.outfit || {}));
    const s = o.spots.start, X = s.x + 30, Z = s.z + 30;
    ['hair:base', 'hat:short', 'hat:bob', 'hat:bun'].forEach((h, k) => { const r = o.buildRunner(); r.apply({ ...base, gear: { ...(base.gear || {}), hair: h, hat: 'hat:none' } }); const x = X + (k - 1.5) * 1.3, z = Z; r.root.position.set(x, o.groundAt(x, z), z); r.root.rotation.y = 0; o.scene.add(r.root); });
    o.player.pos.set(X, o.groundAt(X, Z - 10), Z - 10); o.cam.mode = 'free'; const c = o.camObj; const y = o.groundAt(X, Z); c.position.set(X, y + 2.2, Z + 6); c.lookAt(X, y + 1.5, Z); });
  await p.waitForTimeout(3000); await p.screenshot({ path: `${OUT}${TAG}-hair.png` });
  // 전투 오름: 멧돼지·들개·아기 멧돼지·외계인
  await open('battle'); await waitAssets();
  await p.evaluate(() => { const o = window.__oreum, t = o.life.enemies.test, P = o.player.pos; t.clear(); ['boar', 'dog', 'piglet', 'alien'].forEach((k, i) => t.spawn(k, (i - 1.5) * 3.2, 8));
    o.cam.mode = 'free'; const c = o.camObj, y = o.groundAt(P.x, P.z + 8); c.position.set(P.x, y + 4, P.z - 3); c.lookAt(P.x, y + 0.8, P.z + 8); });
  await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}${TAG}-enemy.png` });
  console.log(TAG, 'errors', errs.length);
  await b.close(); server.close();
})();
