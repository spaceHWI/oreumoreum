// 겉모습 옷 40벌 한 장 (#179): node tools/clothes40.js [dist 폴더] → /tmp/claude-0/shots/clothes40-stand.png · -run.png · -back.png · -sets.png
// 기본 차림(1단계 옷) 위에 겉모습 옷 하나씩 입힌 캐릭터를 10×4 로 세움. 서기(앞)·달리기(옆)·뒤 세 장으로 살이 뚫리는지 봄. 한 벌 맞춤 6세트는 따로 한 장
// 끝에 겉모습 옷마다 장비가 있는지·그림이 있는지·색 바꾸기 장비가 있는지 숫자로 확인 (실패하면 종료 코드 1)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOTDIR = process.argv[2] || 'dist', OUT = process.env.SHOTS || '/tmp/claude-0/shots/'; fs.mkdirSync(OUT, { recursive: true });
const server = http.createServer((req, res) => { const f = path.join(ROOTDIR, decodeURIComponent(req.url.split('?')[0].split('#')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  const t = f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream'; res.writeHead(200, { 'content-type': t }); res.end(fs.readFileSync(f)); });
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 820 } }); let errs = 0;
  p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
  const base = `http://127.0.0.1:${server.address().port}/test.html`;
  await p.goto(base + '#namsongi'); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1 }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.click('#enter', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(800);
  await p.waitForFunction(() => { const a = window.__oreum.assets; return !a || a.done >= a.total; }, null, { timeout: 120000 });
  const chk = await p.evaluate(() => { const st = document.createElement('style'); st.textContent = 'body > *:not(canvas){display:none!important}'; document.head.append(st);
    const o = window.__oreum, K = o.charKit; o.setTod(13); o.setWeather('clear');
    const S = K.CLOTHES.filter((c) => c.style), A = K.ACCESSORIES || {};
    return { n: S.length, noAcc: S.filter((c) => !A[c.id]).map((c) => c.id), tintMiss: S.filter((c) => c.tint && !A[c.id + '~3']).map((c) => c.id), kinds: [...new Set(S.map((c) => c.look.kind))].length, hasAcc: !!K.ACCESSORIES };
  });
  console.log('겉모습 옷', chk.n, '벌, 모양 종류', chk.kinds, chk.hasAcc ? `장비 없음 ${chk.noAcc.length} 색 장비 없음 ${chk.tintMiss.length}` : '(ACCESSORIES 를 charKit 에서 못 봄)');
  const lay = async (mode) => p.evaluate((mode) => {
    const o = window.__oreum, K = o.charKit, THREE = K.THREE;
    (o.__chars || []).forEach((r) => r.root.removeFromParent());
    o.scene.children.forEach((c) => { if (!c.isLight && !c.userData.__keep) c.visible = false; });
    o.scene.background = new THREE.Color('#9fc7a8'); if (o.scene.fog) { o.scene.fog.near = 1e4; o.scene.fog.far = 2e4; }
    const C = K.CLOTHES, t1 = (slot) => (C.find((c) => c.slot === slot && c.tier === 1) || {}).id;
    const baseG = { hand: 'hand:none', back: 'back:bag1', shoes: 'shoes:slip', hat: 'hat:none', top: t1('top'), bottom: t1('bottom'), vest: 'vest:none', jacket: 'jacket:none', socks: 'socks:none', face: 'face:none' };
    const SETS = K.OUTFIT_SETS || [];
    const list = mode === 'sets' ? SETS.map((s) => Object.fromEntries(s.items.map((id) => [C.find((c) => c.id === id).slot, id]))) : C.filter((c) => c.style).map((c) => ({ [c.slot]: c.id }));
    const cols = mode === 'sets' ? 6 : 10, P = o.player.pos, X = P.x, Y = P.y + 200, Z = P.z, dx = 1.55, dy = 2.9; o.__chars = [];
    list.forEach((g, i) => { const col = i % cols, row = Math.floor(i / cols), sex = i % 2 ? 'f' : 'm';
      const r = K.buildRunner(); r.apply({ ...o.save.outfit, skin: { color: K.SKIN_TONES[i % 3] }, gear: { ...baseG, ...g, hair: K.HAIR.start[sex] }, sex });
      r.root.position.set(X + (col - (cols - 1) / 2) * dx, Y - row * dy, Z); r.root.rotation.y = mode === 'run' ? 1.4 : mode === 'back' ? Math.PI + 0.3 : 0.35;
      r.root.userData.__keep = true; o.scene.add(r.root); const a = mode === 'run' ? { speed: 7, running: true, pose: 'move' } : { speed: 0, pose: 'move' };
      for (let k = 0; k < (mode === 'run' ? 9 : 3); k++) r.animate(0.033, { running: false, t: 0.3, breath: 0, lid: 0, ...a }); o.__chars.push(r); });
    const rows = Math.ceil(list.length / cols);
    o.runner.root.visible = false; o.cam.mode = 'free'; const c = o.camObj; c.fov = 30; c.updateProjectionMatrix(); const cy = Y - (rows - 1) * dy / 2 + 1.2; c.position.set(X, cy, Z + (mode === 'sets' ? 22 : 34)); c.lookAt(X, cy, Z);
  }, mode);
  for (const m of ['stand', 'run', 'back', 'sets']) { await lay(m); await p.waitForTimeout(2500); await p.screenshot({ path: `${OUT}clothes40-${m}.png` }); console.log('찍음', `${OUT}clothes40-${m}.png`); }
  await b.close(); server.close();
  const bad = errs || chk.n < 40 || (chk.hasAcc && (chk.noAcc.length || chk.tintMiss.length));
  console.log(bad ? 'FAIL' : '통과'); process.exit(bad ? 1 : 0);
})();
