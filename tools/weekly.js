// 주간 옷장 한정 옷 (#126): node tools/weekly.js [dist 폴더] → /tmp/claude-0/shots/weekly-stand.png · -run.png · -back.png
// 주마다 한 사람: 기본 차림(1단계 옷) 위에 그 주 한정 옷 2~3벌을 입힌 캐릭터 8명(0~7번 주)을 한 줄로 세움. 살이 뚫리는지 봄
// 끝에 한정 옷마다 장비가 있는지, 주마다 2~3벌인지 확인 (실패하면 종료 코드 1)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOTDIR = process.argv[2] || 'dist', OUT = process.env.SHOTS || '/tmp/claude-0/shots/'; fs.mkdirSync(OUT, { recursive: true });
const server = http.createServer((req, res) => { const f = path.join(ROOTDIR, decodeURIComponent(req.url.split('?')[0].split('#')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  const t = f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream'; res.writeHead(200, { 'content-type': t }); res.end(fs.readFileSync(f)); });
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1200, height: 420 } }); let errs = 0;
  p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
  const base = `http://127.0.0.1:${server.address().port}/test.html`;
  await p.goto(base + '#namsongi'); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1 }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.click('#enter', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(800);
  await p.waitForFunction(() => { const a = window.__oreum.assets; return !a || a.done >= a.total; }, null, { timeout: 120000 });
  const chk = await p.evaluate(() => { const st = document.createElement('style'); st.textContent = 'body > *:not(canvas){display:none!important}'; document.head.append(st);
    const o = window.__oreum, K = o.charKit; o.setTod(13); o.setWeather('clear');
    const S = K.CLOTHES.filter((c) => c.week != null), A = K.ACCESSORIES || {}, per = {};
    S.forEach((c) => { per[c.week] = (per[c.week] || 0) + 1; });
    return { n: S.length, noAcc: S.filter((c) => !A[c.id]).map((c) => c.id), per, hasAcc: !!K.ACCESSORIES };
  });
  console.log('한정 옷', chk.n, '벌, 주마다', JSON.stringify(chk.per), chk.hasAcc ? `장비 없음 ${chk.noAcc.length}` : '(ACCESSORIES 를 charKit 에서 못 봄)');
  const lay = async (mode) => p.evaluate((mode) => {
    const o = window.__oreum, K = o.charKit, THREE = K.THREE;
    (o.__chars || []).forEach((r) => r.root.removeFromParent());
    o.scene.children.forEach((c) => { if (!c.isLight && !c.userData.__keep) c.visible = false; });
    o.scene.background = new THREE.Color('#9fc7a8'); if (o.scene.fog) { o.scene.fog.near = 1e4; o.scene.fog.far = 2e4; }
    const C = K.CLOTHES, t1 = (slot) => (C.find((c) => c.slot === slot && c.tier === 1) || {}).id;
    const baseG = { hand: 'hand:none', back: 'back:bag1', shoes: 'shoes:slip', hat: 'hat:none', top: t1('top'), bottom: t1('bottom'), vest: 'vest:none', jacket: 'jacket:none', socks: 'socks:none', face: 'face:none' };
    const W = C.filter((c) => c.week != null), list = [...new Set(W.map((c) => c.week))].sort((a, b) => a - b).map((w) => Object.fromEntries(W.filter((c) => c.week === w).map((c) => [c.slot, c.id])));
    const cols = 8, P = o.player.pos, X = P.x, Y = P.y + 200, Z = P.z, dx = 1.6, dy = 2.9; o.__chars = [];
    list.forEach((g, i) => { const col = i % cols, row = Math.floor(i / cols), sex = i % 2 ? 'f' : 'm';
      const r = K.buildRunner(); r.apply({ ...o.save.outfit, skin: { color: K.SKIN_TONES[i % 3] }, gear: { ...baseG, ...g, hair: K.HAIR.start[sex] }, sex });
      r.root.position.set(X + (col - (cols - 1) / 2) * dx, Y - row * dy, Z); r.root.rotation.y = mode === 'run' ? 1.4 : mode === 'back' ? Math.PI + 0.3 : 0.35;
      r.root.userData.__keep = true; o.scene.add(r.root); const a = mode === 'run' ? { speed: 7, running: true, pose: 'move' } : { speed: 0, pose: 'move' };
      for (let k = 0; k < (mode === 'run' ? 9 : 3); k++) r.animate(0.033, { running: false, t: 0.3, breath: 0, lid: 0, ...a }); o.__chars.push(r); });
    const rows = Math.ceil(list.length / cols);
    o.runner.root.visible = false; o.cam.mode = 'free'; const c = o.camObj; c.fov = 30; c.updateProjectionMatrix(); const cy = Y - (rows - 1) * dy / 2 + 1.2; c.position.set(X, cy, Z + 17); c.lookAt(X, cy, Z);
  }, mode);
  for (const m of ['stand', 'run', 'back']) { await lay(m); await p.waitForTimeout(2500); await p.screenshot({ path: `${OUT}weekly-${m}.png` }); console.log('찍음', `${OUT}weekly-${m}.png`); }
  await b.close(); server.close();
  const bad = errs || !chk.n || Object.values(chk.per).some((v) => v < 2 || v > 3) || (chk.hasAcc && chk.noAcc.length);
  console.log(bad ? 'FAIL' : '통과'); process.exit(bad ? 1 : 0);
})();
