// 캐릭터 표 (#106): 남·여 x 피부색 3 x 장비 단계 1·3·5 x 자세(서기·달리기·줍기·던지기·앉기)
// node tools/chars.js [이름] [dist 폴더] → /tmp/claude-0/shots/<이름>-t1.png · -t3.png · -t5.png (+ -t<단계>-stand·throw·run.png 가까이)
// 단계마다 한 장: 가로 = 남(피부 1·2·3)·여(피부 1·2·3), 세로 = 자세. 바탕은 평평한 색으로 지움
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const TAG = process.argv[2] || 'chars', ROOTDIR = process.argv[3] || 'dist';
const OUT = process.env.SHOTS || '/tmp/claude-0/shots/'; fs.mkdirSync(OUT, { recursive: true });
const server = http.createServer((req, res) => { const f = path.join(ROOTDIR, decodeURIComponent(req.url.split('?')[0].split('#')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  const t = f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream'; res.writeHead(200, { 'content-type': t }); res.end(fs.readFileSync(f)); });
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/test.html`;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 760 } });
  p.on('pageerror', (e) => console.log('ERR', e.message.slice(0, 300)));
  await p.goto(base + '#namsongi'); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1 }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.click('#enter', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(800);
  await p.waitForFunction(() => { const a = window.__oreum.assets; return !a || a.done >= a.total; }, null, { timeout: 120000 });
  await p.evaluate(() => { const st = document.createElement('style'); st.textContent = 'body > *:not(canvas){display:none!important}'; document.head.append(st);
    const o = window.__oreum; o.setTod(13); o.setWeather('clear'); });
  for (const tier of [1, 3, 5]) {
    const info = await p.evaluate((tier) => {
      const o = window.__oreum, K = o.charKit, THREE = K.THREE;
      (o.__chars || []).forEach((r) => r.root.removeFromParent());
      o.scene.children.forEach((c) => { if (!c.isLight && !c.userData.__keep) { c.userData.__was = c.userData.__was ?? c.visible; c.visible = false; } });
      o.scene.background = new THREE.Color('#9fc7a8'); if (o.scene.fog) { o.scene.fog.near = 1e4; o.scene.fog.far = 2e4; }
      const C = K.CLOTHES, pick = (slot) => (C.find((c) => c.slot === slot && c.tier === tier) || {}).id;
      const gear = { hand: K.TOOL_GEAR[tier - 1], back: K.BAG_GEAR[tier - 1], shoes: K.SHOE_GEAR[tier - 1], hat: pick('hat'), top: pick('top'), bottom: pick('bottom'), vest: tier >= 3 ? pick('vest') : 'vest:none', jacket: tier >= 5 ? pick('jacket') : 'jacket:none', socks: tier >= 3 ? pick('socks') : 'socks:none', face: 'face:none' };
      const looks = [['m', 0], ['m', 1], ['m', 2], ['f', 0], ['f', 1], ['f', 2]];
      const poses = [[{ speed: 0, pose: 'move' }, 3], [{ speed: 7, running: true, pose: 'move' }, 9], [{ speed: 0, pose: 'crouch' }, 12], [{ speed: 0, pose: 'throw', t: 0.45 }, 3], [{ speed: 0, pose: 'sit', t: 0.6 }, 12]];
      const P = o.player.pos, X = P.x, Y = P.y + 200, Z = P.z; o.__chars = [];
      const dx = 1.5, dy = 2.9;
      poses.forEach(([a, steps], row) => looks.forEach(([sex, skin], col) => {
        const r = K.buildRunner(); r.apply({ ...o.save.outfit, skin: { color: K.SKIN_TONES[skin] }, gear: { ...gear, hair: K.HAIR.start[sex] }, sex });
        const x = X + (col - 2.5) * dx, y = Y - row * dy; r.root.position.set(x, y, Z); r.root.rotation.y = row === 1 ? 0.9 : row === 3 ? -0.5 : 0.25;
        r.root.userData.__keep = true; o.scene.add(r.root); for (let k = 0; k < steps; k++) r.animate(0.033, { running: false, t: 0.3, breath: 0, lid: 0, ...a }); o.__chars.push(r); }));
      o.runner.root.visible = false; o.cam.mode = 'free'; const c = o.camObj; c.fov = 30; c.updateProjectionMatrix(); c.position.set(X, Y - 2 * dy + 1.2, Z + 30); c.lookAt(X, Y - 2 * dy + 1.2, Z);
      o.renderer.info.autoReset = true; return { gear };
    }, tier);
    await p.waitForTimeout(2500); await p.screenshot({ path: `${OUT}${TAG}-t${tier}.png` });
    if (tier === 1) console.log('gear t1', JSON.stringify(info.gear));
    // 가까이: 서기(위)·던지기(아래) 줄의 남 피부 1·2·여 피부 1
    for (const [row, nm] of [[0, 'stand'], [3, 'throw'], [1, 'run']]) {
      await p.evaluate((row) => { const o = window.__oreum, c = o.camObj, r0 = o.__chars[row * 6].root, r1 = o.__chars[row * 6 + 3].root, cx = (r0.position.x + r1.position.x) / 2 - 0.75;
        c.fov = 30; c.updateProjectionMatrix(); c.position.set(cx, r0.position.y + 1.5, r0.position.z + 7.5); c.lookAt(cx, r0.position.y + 1.2, r0.position.z); }, row);
      await p.waitForTimeout(1200); await p.screenshot({ path: `${OUT}${TAG}-t${tier}-${nm}.png` });
    }
  }
  await b.close(); server.close();
})();
