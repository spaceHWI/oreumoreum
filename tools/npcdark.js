// 검은 NPC 검사 (#269): node tools/npcdark.js [d|m] [dist 폴더=dist] [출력 폴더=notes/shots/269]
// 사건 모델(caseModel.names)·플레이어 캐릭터(러너, NPC·남의 캐릭터와 같은 그리기)·노루를 플레이어 앞에 하나씩 세워 낮·밤·밤 비·안개에서 찍고,
// 그 모델이 그려진 픽셀(모델을 감춘 화면과 다른 곳)의 평균 밝기가 NPC_LIGHT.testFloor 아래면 실패
// 받는 중(slow): 텍스처 그림(blob: 이미지)을 NPC_LIGHT.testDelay ms 늦게 풀어 '자료는 왔는데 텍스처는 아직' 인 때를 만들고 같은 검사 + 텍스처 없이 그려지는 메시 수 0
// 찍는 것: <조건>.jpg (모델들을 한 장에). 실패하면 exit 1
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), cp = require('child_process');
const DEV = process.argv[2] || 'd', ROOTDIR = process.argv[3] || 'dist', OUT = process.argv[4] || 'notes/shots/269';
fs.mkdirSync(OUT, { recursive: true });
const server = http.createServer((req, res) => { const f = path.join(ROOTDIR, decodeURIComponent(req.url.split('?')[0].split('#')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  const t = f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream'; res.writeHead(200, { 'content-type': t }); res.end(fs.readFileSync(f)); });
const bad = []; const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) bad.push(msg); };
/* 두 장(모델 있음·없음)에서 다른 픽셀만 골라 평균 밝기(0~255, 사람 눈 가중) */
const PY = `import sys, json
from PIL import Image, ImageChops
a = Image.open(sys.argv[1]).convert('RGB'); b = Image.open(sys.argv[2]).convert('RGB')
d = ImageChops.difference(a, b).convert('L').point(lambda v: 255 if v > 18 else 0)
L = a.convert('L'); n = 0; s = 0
for m, l in zip(d.tobytes(), L.tobytes()):
  if m: n += 1; s += l
print(json.dumps([n, s / n if n else -1]))`;
const lum = (fa, fb) => JSON.parse(cp.execFileSync('python3', ['-c', PY, fa, fb]).toString());
const W = DEV === 'm' ? 390 : 480, H = DEV === 'm' ? 300 : 300;

async function open(b, slow) {
  const ctx = await b.newContext(DEV === 'm' ? { ...devices['iPhone 13'], viewport: { width: 844, height: 390 } } : { viewport: { width: W, height: H } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => { errs.push(e.message); console.log('ERR', e.message.slice(0, 300)); });
  if (slow) await p.addInitScript((ms) => { /* 텍스처 그림 풀기를 늦춤: three ImageLoader 는 img.src = blob: 로 연다 */
    const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    Object.defineProperty(HTMLImageElement.prototype, 'src', { configurable: true, get() { return d.get.call(this); }, set(v) { if (String(v).startsWith('blob:') && !window.__fastTex) { const img = this; setTimeout(() => d.set.call(img, v), ms); } else d.set.call(this, v); } });
  }, 9000);
  await p.goto(`http://127.0.0.1:${server.address().port}/index.html#namsongi`); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1 }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.click('#enter', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(800);
  await p.waitForFunction(() => { const a = window.__oreum.assets; return !a || a.done >= a.total; }, null, { timeout: 180000 }).catch(() => {});
  await p.evaluate(() => { const st = document.createElement('style'); st.textContent = 'body > *:not(canvas){display:none!important}'; document.head.append(st); const o = window.__oreum; o.cam.mode = 'free'; o.pace?.test?.hold?.(); });
  /* 세울 것: 사건 모델 + 러너(NPC 와 같은 그리기) + 노루(멀티의 남의 노루와 같은 모델) */
  await p.evaluate(() => {
    const o = window.__oreum, P = o.player.pos, h = o.player.heading, L = o.spots.lamps || [];
    /* 가로등 빛에서 먼 자리 (밤 검사가 가로등 밑이면 밝게 나옴): 플레이어 둘레 후보 중 가장 가까운 가로등이 가장 먼 곳 */
    let best = null; for (let r = 8; r <= 40; r += 8) for (let a = 0; a < 16; a++) { const cx = P.x + Math.sin(a / 16 * 6.283) * r, cz = P.z + Math.cos(a / 16 * 6.283) * r, dl = Math.min(99, ...L.map((l) => Math.hypot(l[0] - cx, l[1] - cz))); if (!best || dl > best[2] + 0.5) best = [cx, cz, dl]; }
    const x = best[0], z = best[1], y = o.groundAt(x, z); window.__lampD = best[2];
    const list = o.caseModel.names.map((n) => { const m = o.caseModel(n); m.root.position.set(x, y, z); m.root.rotation.y = h + Math.PI; o.scene.add(m.root); m.near(true); return { name: n, root: m.root, m, s: m.root.scale.x * 1 }; });
    const r = o.buildRunner(); r.apply(o.save.outfit); r.root.position.set(x, y, z); r.root.rotation.y = h + Math.PI; o.scene.add(r.root); list.push({ name: 'runner', root: r.root, s: 2.4 });
    o.runner.root.visible = false; window.__hideMe = () => { o.runner.root.visible = false; };
    window.__npcs = list; window.__at = { x, y, z, h };
    window.__solo = (i) => { list.forEach((e, j) => { e.root.visible = j === i; }); const e = list[i]; if (!e) return; const s = e.s, hh = e.root.rotation.y;
      o.camObj.position.set(x + Math.sin(hh) * s * 1.5, y + s * 0.55, z + Math.cos(hh) * s * 1.5); o.camObj.lookAt(x, y + s * 0.42, z); };
    /* 텍스처 없이(이미지 없음) 그려질 메시: 가려 둔 것(userData.texOn = 0 이면 회색으로 그림)은 빼고 셈 */
    window.__blackMesh = () => { const out = []; o.scene.traverseVisible((m) => { if (!m.isMesh) return; for (const mt of [].concat(m.material || [])) { const t = mt.map; if (t && !t.image && !(mt.userData?.texOn && mt.userData.texOn.value < 1)) { let q = m, path = []; while (q && path.length < 5) { path.push(q.name || q.type); q = q.parent; } out.push(path.join('<') + ' ' + mt.type + ' ' + (t.name || t.uuid.slice(0, 6))); } } }); return out; };
  });
  return { p, errs, ctx };
}
async function shoot(p, tag, cond) {
  await p.evaluate(([w, t]) => { const o = window.__oreum; o.setWeather(w); o.setTod(t); window.__hideMe(); }, cond.at);
  await p.waitForTimeout(700);
  const names = await p.evaluate(() => window.__npcs.map((e) => e.name)), res = [], tiles = [];
  for (let i = 0; i < names.length; i++) {
    const fa = path.join(OUT, `_${tag}-${i}a.png`), fb = path.join(OUT, `_${tag}-${i}b.png`);
    await p.evaluate((i) => { window.__solo(i); window.__npcs.forEach((e) => e.m?.update?.(1 / 30)); }, i); await p.waitForTimeout(350); await p.screenshot({ path: fa });
    await p.evaluate(() => window.__npcs.forEach((e) => { e.root.visible = false; })); await p.waitForTimeout(250); await p.screenshot({ path: fb });
    const [n, l] = lum(fa, fb); res.push([names[i], n, l]); tiles.push(fa); fs.unlinkSync(fb);
  }
  cp.execFileSync('python3', ['-c', `import sys\nfrom PIL import Image\nims=[Image.open(f).convert('RGB') for f in sys.argv[2:]]\nw,h=ims[0].size\nk=240/w\nims=[i.resize((int(w*k),int(h*k))) for i in ims]\nw,h=ims[0].size\no=Image.new('RGB',(w*4,h*((len(ims)+3)//4)))\nfor i,im in enumerate(ims): o.paste(im,((i%4)*w,(i//4)*h))\no.save(sys.argv[1], quality=70, optimize=True)`, path.join(OUT, `${tag}-${DEV}.jpg`), ...tiles]);
  tiles.forEach((f) => fs.unlinkSync(f));
  return res;
}
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const FLOOR = await (async () => { const { p, ctx } = await open(b, false); const f = await p.evaluate(() => window.__oreum.npcLight); await ctx.close(); return f; })();
  check(!!FLOOR, 'NPC_LIGHT 값 읽음 ' + JSON.stringify(FLOOR));
  const floor = FLOOR?.testFloor ?? 40, nightFloor = FLOOR?.testNight ?? 28;
  /* 1) 받는 중: 자료(모양)는 왔고 텍스처 그림은 아직 */
  { const { p, errs, ctx } = await open(b, true);
    await p.waitForFunction(() => window.__npcs.every((e) => !e.m || e.m.loaded.hi), null, { timeout: 60000 }).catch(() => {});
    /* 러너 몸 텍스처(runner.js modelTex)는 #269 에서 '첫 화면 전에 받는 것' 이라 회색 막이 없음: 그 그림(이것도 blob 이라 늦춰짐)이 온 뒤에 셈 (#271: 프레임 상한으로 로딩이 빨라져 9초 전에 세던 일) */
    await p.waitForFunction(() => { let ok = true; window.__oreum.scene.traverseVisible((m) => { if (m.isSkinnedMesh) for (const mt of [].concat(m.material || [])) if (mt.map && !mt.map.image && !mt.userData?.texOn) ok = false; }); return ok; }, null, { timeout: 30000 }).catch(() => {});
    const blk = await p.evaluate(() => window.__blackMesh());
    check(blk.length === 0, '받는 중 텍스처 없이 그려지는 메시 ' + blk.length + (blk.length ? ' (' + [...new Set(blk)].slice(0, 6).join(',') + ')' : ''));
    if (process.env.ONLY === 'blk') { console.log(blk); process.exit(0); }
    const r = await shoot(p, 'loading', { at: ['clear', 13] });
    for (const [n, px, l] of r) check(px < 50 || l >= floor, `받는 중 낮 ${n}: 밝기 ${l.toFixed(0)} (픽셀 ${px}) ≥ ${floor}`);
    check(!errs.length, '받는 중 페이지 오류 없음 ' + errs.slice(0, 2).join(' | ')); await ctx.close(); }
  /* 2) 다 받은 뒤: 낮·밤·밤 비·안개 */
  { const { p, errs, ctx } = await open(b, false);
    await p.waitForFunction(() => window.__npcs.every((e) => !e.m || e.m.loaded.hi), null, { timeout: 60000 }).catch(() => {});
    await p.waitForFunction(() => window.__blackMesh().length === 0, null, { timeout: 30000 }).catch(() => {});
    for (const [tag, at, f] of [['day', ['clear', 13], floor], ['fog', ['fog', 9], floor], ['night', ['clear', 23], nightFloor], ['nightrain', ['rain', 1], nightFloor]]) {
      const r = await shoot(p, tag, { at });
      for (const [n, px, l] of r) check(px >= 50 && l >= f, `${tag} ${n}: 밝기 ${l.toFixed(0)} (픽셀 ${px}) ≥ ${f}`);
    }
    check(!errs.length, '페이지 오류 없음 ' + errs.slice(0, 2).join(' | ')); await ctx.close(); }
  await b.close(); server.close();
  console.log(bad.length ? `실패 ${bad.length}` : '모두 통과');
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
