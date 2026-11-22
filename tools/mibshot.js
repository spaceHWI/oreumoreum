// 사건 3 검은 양복 모델 (#264) 맨발·인사 찍기: node tools/mibshot.js [dist] [출력=notes/shots/264]   (먼저 node build.mjs)
// 평지에 mib 를 세우고 talk · bow · 발치(맨발)를 가까이 찍어 한 장으로. 페이지 오류·모델 받기만 확인
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOTDIR = process.argv[2] || 'dist', OUT = process.argv[3] || 'notes/shots/264';
fs.mkdirSync(OUT, { recursive: true });
const server = http.createServer((req, res) => { const f = path.join(ROOTDIR, decodeURIComponent(req.url.split('?')[0].split('#')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); res.end(fs.readFileSync(f)); });
let bad = 0; const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) bad++; };
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/index.html`;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 640, height: 400 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(base + '#namsongi'); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1 }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.click('#enter', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1500);
  await p.evaluate(() => { const st = document.createElement('style'); st.textContent = 'body > *:not(canvas){display:none!important}'; document.head.append(st); const o = window.__oreum; o.setWeather('clear'); o.setTod(13); o.pace?.test?.hold?.(); o.cam.mode = 'free'; });
  await p.evaluate(() => {
    const o = window.__oreum, P = o.player.pos, h = o.player.heading, fx = Math.sin(h), fz = Math.cos(h), x = P.x + fx * 5, z = P.z + fz * 5;
    const m = o.caseModel('mib'); m.root.position.set(x, o.groundAt(x, z), z); m.root.rotation.y = h + Math.PI; o.scene.add(m.root); m.near(true); window.__m = m;
  });
  await p.waitForFunction(() => window.__m.loaded.hi, null, { timeout: 60000 }).catch(() => {});
  check(await p.evaluate(() => window.__m.loaded.hi), 'mib 큰 모델 받음');
  const shots = [];
  for (const [k, cam] of [['talk', 'front'], ['bow', 'side'], ['bow', 'feet']]) {
    const f = path.join(OUT, `_${shots.length}.png`);
    await p.evaluate(([k, cam]) => { const o = window.__oreum, m = window.__m, P = m.root.position, h = m.root.rotation.y, s = m.root.scale.x, c = o.camObj;
      m.play(k, { restart: true }); for (let t = 0; t < 40; t++) m.update(1 / 30);
      if (cam === 'front') { c.position.set(P.x + Math.sin(h) * s * 1.6, P.y + s * 0.6, P.z + Math.cos(h) * s * 1.6); c.lookAt(P.x, P.y + s * 0.45, P.z); }
      else if (cam === 'side') { const a = h + Math.PI / 2; c.position.set(P.x + Math.sin(a) * s * 1.7, P.y + s * 0.55, P.z + Math.cos(a) * s * 1.7); c.lookAt(P.x, P.y + s * 0.4, P.z); }
      else { const a = h + 0.5; c.position.set(P.x + Math.sin(a) * 1.4, P.y + 1.1, P.z + Math.cos(a) * 1.4); c.lookAt(P.x + Math.sin(h) * 0.25, P.y + 0.08, P.z + Math.cos(h) * 0.25); } }, [k, cam]);
    await p.waitForTimeout(600); await p.screenshot({ path: f, clip: { x: 170, y: 20, width: 300, height: 360 } }); shots.push(f);
  }
  require('child_process').execFileSync('python3', ['-c', `import sys\nfrom PIL import Image\nims=[Image.open(f) for f in sys.argv[2:]]\no=Image.new('RGB',(300*len(ims),360))\nfor i,im in enumerate(ims): o.paste(im,(300*i,0))\no.save(sys.argv[1], quality=72, optimize=True)`, path.join(OUT, 'mib-talk-bow-feet.jpg'), ...shots]);
  shots.forEach((f) => fs.unlinkSync(f));
  check(!errs.length, '페이지 오류 없음 ' + errs.slice(0, 2).join(' | '));
  await b.close(); server.close(); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
