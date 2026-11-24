// 사건 파일 Tripo 모델 검사 (#262): node tools/casemodels.js [dist 폴더=dist] [출력 폴더=notes/shots/262]
// 여섯 모델을(사진사는 #268 에서 빠짐, 오름지기 #305) 플레이어 앞 한 줄에 세워 모델이 뜨는지(큰 모델·멀리용), 모션마다 뼈가 움직이는지, 그리는 수(draw call)가 모델마다 2 이하인지 보고 찍음
// #272: 멀어지면 큰 모델을 GPU 에서 내리고 다시 오면 올리는지도 봄
// 찍는 것: all-front.jpg(한 줄 앞), all-side.jpg(옆), <모델>.jpg(앞·옆·모션 둘 한 장에). 실패하면 exit 1
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOTDIR = process.argv[2] || 'dist', OUT = process.argv[3] || 'notes/shots/262';
fs.mkdirSync(OUT, { recursive: true });
const server = http.createServer((req, res) => { const f = path.join(ROOTDIR, decodeURIComponent(req.url.split('?')[0].split('#')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  const t = f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream'; res.writeHead(200, { 'content-type': t }); res.end(fs.readFileSync(f)); });
const bad = []; const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) bad.push(msg); };
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/index.html`;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 640, height: 400 } })).newPage();
  const errs = []; p.on('pageerror', (e) => { errs.push(e.message); console.log('ERR', e.message.slice(0, 300)); });
  const got = []; p.on('request', (r) => { const m = /\/a\/(case-[a-z-]+?)-[0-9a-f]{10}\.bin/.exec(r.url()); if (m) got.push(m[1]); });
  await p.goto(base + '#namsongi'); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1 }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  const gotFirst = got.slice();
  await p.click('#enter', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(800);
  await p.waitForFunction(() => { const a = window.__oreum.assets; return !a || a.done >= a.total; }, null, { timeout: 180000 }).catch(() => {});
  await p.waitForTimeout(1500);
  check(gotFirst.length === 0, '첫 화면 전에는 사건 모델·소품을 받지 않음 (받은 것: ' + (gotFirst.join(',') || '없음') + ')');
  const LATE305 = /^case-(jigi|stall|gong|chute|mango)/; /* #305: 들어온 뒤 CASE_MODELS.jigiDelay 초가 지나면 받음 */
  const got0 = got.filter((n) => !LATE305.test(n));
  check(got0.length === 0, '첫 화면·한가할 때는 사건 모델을 받지 않음 (받은 것: ' + (got.join(',') || '없음') + ')');
  await p.evaluate(() => { const st = document.createElement('style'); st.textContent = 'body > *:not(canvas){display:none!important}'; document.head.append(st); const o = window.__oreum; o.setWeather('clear'); o.setTod(13); o.pace?.test?.hold?.(); });
  /* 한 줄로 세움: 플레이어 앞 9m, 옆으로 2.6m 간격. 그리는 수는 세우기 전·후 차이 */
  await p.evaluate(() => { window.__oreum.cam.mode = 'free'; window.__calls = () => new Promise((ok) => { const r = window.__oreum.renderer; requestAnimationFrame(() => { r.info.autoReset = false; r.info.reset(); requestAnimationFrame(() => { const n = r.info.render.calls, t = r.info.render.triangles; r.info.autoReset = true; ok([n, t]); }); }); }); });
  await p.evaluate(() => {
    const o = window.__oreum, M = o.caseModel, P = o.player.pos, list = M.names, h = o.player.heading, fx = Math.sin(h), fz = Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h);
    window.__cm = list.map((n, i) => { const m = M(n), k = i - (list.length - 1) / 2, x = P.x + fx * 9 + rx * k * 2.6, z = P.z + fz * 9 + rz * k * 2.6;
      m.root.position.set(x, o.groundAt(x, z), z); m.root.rotation.y = h + Math.PI; o.scene.add(m.root); m.near(true); return m; });
    window.__cmCam = (side) => { const c = o.camObj, d = side ? 0 : 1; const cx = P.x + fx * (9 - 8.5 * d) + rx * 9.5 * (side ? 1 : 0), cz = P.z + fz * (9 - 8.5 * d) + rz * 9.5 * (side ? 1 : 0); c.position.set(cx, o.groundAt(P.x + fx * 9, P.z + fz * 9) + 2.2, cz); c.lookAt(P.x + fx * 9, o.groundAt(P.x + fx * 9, P.z + fz * 9) + 1.3, P.z + fz * 9); };
    window.__cmCam(false);
  });
  await p.waitForFunction(() => window.__cm.every((m) => m.loaded.hi && m.loaded.lo), null, { timeout: 60000 }).catch(() => {});
  const ld = await p.evaluate(() => window.__cm.map((m) => m.name + ':' + (m.loaded.hi ? 'hi' : '-') + (m.loaded.lo ? '+lo' : '')));
  check(ld.every((s) => s.endsWith('hi+lo')), ld.length + '개 모델 받음 ' + ld.join(' '));
  await p.waitForTimeout(1200);
  const calls1 = await p.evaluate(() => window.__calls());
  const calls0 = await p.evaluate(async () => { window.__cm.forEach((m) => { m.root.visible = false; }); const c = await window.__calls(); window.__cm.forEach((m) => { m.root.visible = true; }); return c; });
  const NM = ld.length;
  check(calls1[0] - calls0[0] <= NM * 2, `그리는 수 늘어남 ${calls1[0] - calls0[0]} (모델 ${NM}, 그림자 포함 모델마다 2 이하) · 삼각형 +${calls1[1] - calls0[1]}`);
  const tri = await p.evaluate(() => window.__cm.map((m) => { let hi = 0, lo = 0; m.root.traverse((o) => { if (o.isSkinnedMesh) { const n = o.geometry.index.count / 3; if (n > 1600 || m.name === 'hose' && n > 400) hi = n; else lo = n; } }); return [m.name, hi, lo]; }));
  console.log('삼각형 (큰·멀리용):', tri.map((t) => t.join(' ')).join(' · '));
  await p.screenshot({ path: path.join(OUT, 'all-front.jpg'), quality: 72 });
  await p.evaluate(() => window.__cmCam(true)); await p.waitForTimeout(600); await p.screenshot({ path: path.join(OUT, 'all-side.jpg'), quality: 72 });
  /* 모션: 뼈 회전이 바뀌는지 (모션마다 0.6초 돌려 뼈 각도 합 차이) */
  /* 모션마다 1초 돌리며 뼈 각도가 가장 많이 바뀐 양 + 쉼 자세(모델 그대로)에서 벗어난 양 (라디안 합). 앉기처럼 멈춘 자세도, 거의 안 움직이는 검은 양복 stand 도 0 보다는 큼 */
  const mv = await p.evaluate(() => window.__cm.map((m) => { const out = {}, sig = () => Object.values(m.bones).map((b) => [b.rotation.x, b.rotation.y, b.rotation.z, b.position.y * 3, b.scale.y]).flat();
    for (const k of window.__oreum.caseModel.moves(m.name)) { m.play(k, { restart: true }); m.update(0.5); const a = sig(); let most = 0; for (let i = 0; i < 30; i++) { m.update(1 / 30); const c = sig(); most = Math.max(most, c.reduce((s, v, j) => s + Math.abs(v - a[j]), 0)); } const pose = Object.values(m.bones).reduce((s, b) => s + Math.abs(b.rotation.x) + Math.abs(b.rotation.y) + Math.abs(b.rotation.z), 0); out[k] = +(most + pose).toFixed(3); } return [m.name, out]; }));
  for (const [n, o] of mv) check(Object.values(o).every((v) => v > 0.002), `모션 ${n}: ${Object.entries(o).map(([k, v]) => k + ' ' + v).join(', ')}`);
  /* 모델마다 한 장: 앞 · 옆 · 모션 둘 (가까이에서) */
  const PICK = { yeti: ['sit+tie', 'walk'], mib: ['talk', 'walk'], 'ghost-keeper': ['pinch', 'lookback'], 'arena-keeper': ['wave', 'offer'], hose: ['wriggle', 'rise'], jigi: ['note', 'wave'] };
  for (let i = 0; i < mv.length; i++) {
    const n = mv[i][0], shots = [];
    for (const [k, side] of [['idle', 0], ['idle', 1], [PICK[n][0], 0], [PICK[n][1], 0]]) {
      const f = path.join(OUT, `_${n}-${shots.length}.png`);
      await p.evaluate(([i, k, side]) => { const o = window.__oreum, m = window.__cm[i], P = m.root.position, h = m.root.rotation.y + (side ? Math.PI / 2 : 0), s = m.root.scale.x;
        window.__cm.forEach((x, j) => { x.root.visible = j === i; });
        m.play(k, { restart: true }); for (let t = 0; t < (k === 'rise' ? 22 : 30); t++) m.update(1 / 30);
        o.camObj.position.set(P.x + Math.sin(h) * s * 1.6, P.y + s * 0.6, P.z + Math.cos(h) * s * 1.6); o.camObj.lookAt(P.x, P.y + s * 0.45, P.z); }, [i, k, side]);
      await p.waitForTimeout(500); await p.screenshot({ path: f, clip: { x: 170, y: 20, width: 300, height: 360 } }); shots.push(f);
    }
    require('child_process').execFileSync('python3', ['-c', `import sys\nfrom PIL import Image\nims=[Image.open(f) for f in sys.argv[2:]]\no=Image.new('RGB',(300*len(ims),360))\nfor i,im in enumerate(ims): o.paste(im,(300*i,0))\no.save(sys.argv[1], quality=72, optimize=True)`, path.join(OUT, n + '.jpg'), ...shots]);
    shots.forEach((f) => fs.unlinkSync(f));
  }
  /* #272: 멀어지면 큰 모델을 GPU 에서 내리고, 다시 가까이 가면 저절로 다시 올림 */
  const rel = await p.evaluate(async () => {
    const o = window.__oreum, G = o.caseModel.gpu, mem = () => ({ ...o.renderer.info.memory }), fr = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    window.__cm.forEach((m) => { m.root.visible = true; m.near(false); });
    await fr(); const m0 = mem();
    const c = o.camObj, P = window.__cm[0].root.position, keep = c.position.clone(); c.position.set(P.x + 400, P.y + 30, P.z); c.lookAt(P.x + 500, P.y, P.z);
    await fr(); for (let i = 0; i < 20; i++) G.tick();
    await fr(); const m1 = mem(), st = G.state(), far = window.__cm.map((m) => m.far);
    c.position.copy(keep); c.lookAt(P.x, P.y + 1, P.z); window.__cmCam(false);
    for (let i = 0; i < 4; i++) await fr(); G.tick(); await fr(); const m2 = mem();
    return { m0, m1, m2, st, far, hiBack: window.__cm.filter((m) => !m.far).length };
  });
  check(Object.values(rel.st).every((e) => !e.on && e.n >= 1) && rel.far.every(Boolean), '멀어지면 큰 모델을 GPU 에서 내림 ' + JSON.stringify(rel.st));
  check(rel.m1.textures < rel.m0.textures && rel.m1.geometries < rel.m0.geometries, `내린 뒤 텍스처 ${rel.m0.textures}→${rel.m1.textures} · 지오메트리 ${rel.m0.geometries}→${rel.m1.geometries}`);
  check(rel.hiBack > 0 && rel.m2.textures > rel.m1.textures, `다시 가까이 가면 다시 올림 (큰 모델 ${rel.hiBack}개, 텍스처 ${rel.m1.textures}→${rel.m2.textures})`);
  check(!errs.length, '페이지 오류 없음 ' + errs.slice(0, 2).join(' | '));
  await b.close(); server.close();
  console.log(bad.length ? `실패 ${bad.length}` : '모두 통과');
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
