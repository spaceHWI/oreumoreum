// 모자 틈 보기 (#198): node tools/hats.js [dist] [모자 id,...] → /tmp/claude-0/shots/hats-<모자>-<m|f>.png
// 모자 하나마다 남녀 한 장씩, 머리 3종(줄)을 앞·옆·뒤·위 네 방향과 달리기 한 컷으로 가까이 찍음. 머리(살색·머리카락)가 틈으로 비치는지 눈으로 봄
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOTDIR = process.argv[2] || 'dist', OUT = process.env.SHOTS || '/tmp/claude-0/shots/'; fs.mkdirSync(OUT, { recursive: true });
const HATS = (process.argv[3] || 'hat:x-santa,hat:x-rudolph,hat:p-box,hat:s-beanie,hat:s-chef,hat:s-gat').split(',');
const server = http.createServer((req, res) => { const f = path.join(ROOTDIR, decodeURIComponent(req.url.split('?')[0].split('#')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  const t = f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream'; res.writeHead(200, { 'content-type': t }); res.end(fs.readFileSync(f)); });
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1200, height: 700 } }); let errs = 0;
  p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
  await p.goto(`http://127.0.0.1:${server.address().port}/test.html#namsongi`); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1 }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.click('#enter', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(800);
  await p.evaluate(() => { const st = document.createElement('style'); st.textContent = 'body > *:not(canvas){display:none!important}'; document.head.append(st); const o = window.__oreum; o.setTod(13); o.setWeather('clear'); });
  for (const hat of HATS) for (const sx of ['m', 'f']) {
    await p.evaluate(([hat, sx]) => {
      const o = window.__oreum, K = o.charKit, THREE = K.THREE, C = K.CLOTHES, t1 = (slot) => (C.find((c) => c.slot === slot && c.tier === 1) || {}).id;
      (o.__chars || []).forEach((r) => r.root.removeFromParent());
      o.scene.children.forEach((c) => { if (!c.isLight && !c.userData.__keep) c.visible = false; });
      o.scene.background = new THREE.Color('#9fc7a8'); if (o.scene.fog) { o.scene.fog.near = 1e4; o.scene.fog.far = 2e4; }
      const P = o.player.pos, X = P.x, Y = P.y + 200, Z = P.z, dx = 1.5, dy = 2.1; o.__chars = [];
      const hairs = ['hat:short', 'hat:bob', 'hat:bun'], views = [0, Math.PI / 2, Math.PI, 'top', 'run'];
      hairs.forEach((hair, hi) => [sx].forEach((sex, si) => views.forEach((v, vi) => {
        const r = K.buildRunner(); r.apply({ ...o.save.outfit, skin: { color: K.SKIN_TONES[(hi + si) % 3] }, gear: { hand: 'hand:none', back: 'back:none', shoes: 'shoes:slip', top: t1('top'), bottom: t1('bottom'), vest: 'vest:none', jacket: 'jacket:none', socks: 'socks:none', face: 'face:none', hat, hair }, sex });
        const row = hi; r.root.position.set(X + (vi - 2) * dx, Y - row * dy - 1.5, Z);
        if (v === 'top') { r.root.rotation.set(1.0, 0.4, 0); } else r.root.rotation.y = v === 'run' ? 1.2 : v;
        r.root.userData.__keep = true; o.scene.add(r.root);
        const a = v === 'run' ? { speed: 7, running: true, pose: 'move' } : { speed: 0, pose: 'move' };
        for (let k = 0; k < (v === 'run' ? 7 : 3); k++) r.animate(0.033, { running: false, t: 0.3, breath: 0, lid: 0, ...a }); o.__chars.push(r);
      })));
      o.runner.root.visible = false; o.cam.mode = 'free'; const c = o.camObj; c.fov = 30; c.updateProjectionMatrix(); const cy = Y - 1 * dy; c.position.set(X, cy + 0.8, Z + 13); c.lookAt(X, cy, Z);
    }, [hat, sx]);
    await p.waitForTimeout(2000); const f = `${OUT}hats-${hat.replace(/[:~]/g, '_')}-${sx}.png`; await p.screenshot({ path: f }); console.log('찍음', f);
  }
  await b.close(); server.close(); console.log(errs ? 'FAIL' : '통과'); process.exit(errs ? 1 : 0);
})();
