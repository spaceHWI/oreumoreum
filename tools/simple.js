// 모바일 화면 단순하게 (#189): node tools/simple.js [tag] [--off] [--ua]
// 폰 세로(390x844)·가로(844x390) 에서 평소 / 싸우는 중 / 들판 / 가게 앞 네 장면을 찍고(dist/s-<tag>-<p|l>-<장면>.png),
// 화면에 동시에 떠 있는 HUD 요소 수와 서로 겹치는 쌍을 적는다. --off: '화면 단순하게' 를 끄고 찍기
// --ua: 전체 화면 안내가 안드로이드·아이폰·아이폰 크롬·홈 화면 앱에서 각각 맞게 뜨는지 검사만
const { chromium, devices } = require('playwright');
const args = process.argv.slice(2), TAG = args.find((a) => !a.startsWith('--')) || 'now', OFF = args.includes('--off');
const LA = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const URL = 'file://' + process.cwd() + '/dist/test.html#namsongi';
const ready = (p) => p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 150000 });
// 화면에 보이는 HUD 요소: 이름 → 선택자
const HUD = {
  joy: '#joy', pick: '#btn-pick', ctx: '#btn-ctx', jump: '#btn-jump', speed: '#btn-speed', ride: '#btn-ride', armMore: '#arm-more', rideMore: '#ride-more',
  gyul: '#gyul-pill', lv: '#lv-pill', score: '#score-pill', bag: '#bag-pill', clean: '#clean-pill', hp: '#hp-bar', buff: '#buff-pill', zone: '#zone-pill', xy: '#xy-pill', ach: '#ach-chip', fs: '#fs-chip', fb: '#fb-chip',
  minimap: '#minimap', mapDot: '#map-dot', quest: '#quest-track', swarm: '#swarm-bar', dockAct: '#btn-actions', dockChat: '#btn-chat', dockAch: '#btn-ach', menu: '#btn-menu',
  rec: '#rec-ui', newver: '#newver', mutter: '#mutter', cart: '#cart-mark', chArrow: '#ch-arrow', shopMark: '#shop-mark', shopArrow: '#shop-arrow',
};
const count = (p, HUD) => p.evaluate((HUD) => {
  const W = innerWidth, H = innerHeight, vis = [];
  for (const [k, sel] of Object.entries(HUD)) {
    const el = document.querySelector(sel); if (!el) continue;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    let e = el, ok = true; while (e && e !== document.body) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) { ok = false; break; } e = e.parentElement; }
    if (!ok || el.hidden) continue;
    if (r.right < 0 || r.bottom < 0 || r.left > W || r.top > H) continue;
    vis.push({ k, r: [r.left, r.top, r.right, r.bottom].map(Math.round) });
  }
  const over = [];
  for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
    const a = vis[i].r, b = vis[j].r, w = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), h = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
    if (w > 4 && h > 4) over.push(vis[i].k + '×' + vis[j].k);
  }
  return { n: vis.length, keys: vis.map((v) => v.k), over };
}, HUD);
async function scenes(b) {
  const out = {};
  for (const [n, vp] of Object.entries({ p: { width: 390, height: 844 }, l: { width: 844, height: 390 } })) {
    const ctx = await b.newContext({ ...devices['Pixel 7'], viewport: vp, deviceScaleFactor: 1 });
    const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('ERR', n, e.message.slice(0, 200)));
    await p.goto(URL); await ready(p);
    await p.evaluate((OFF) => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1, recycle: { visits: 3 }, fsTip: { off: 1 } }); if (OFF) o.save.simple = 0; const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); }, OFF);
    await p.reload(); await ready(p);
    await p.click('#enter', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1500);
    await p.evaluate(() => { const o = window.__oreum; o.pace.pacing.test.first.done = true; o.pace.pacing.test.first.bloomed = true; o.setTod(13); o.setWeather('clear'); o.save.coins = 500; document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; }); });
    const shot = async (k) => { await p.waitForTimeout(1600); await p.screenshot({ path: `dist/s-${TAG}-${n}-${k}.png`, timeout: 150000 }); const c = await count(p, HUD); out[n + '.' + k] = c; console.log(n, k, c.n, c.keys.join(','), c.over.length ? '겹침 ' + c.over.join(' ') : ''); };
    await shot('1usual');
    await p.evaluate(() => { const o = window.__oreum; o.enemies.test.clear(); for (let i = 0; i < 2; i++) { const e = o.enemies.test.spawn('boar', Math.sin(i) * 8, 8 + i); if (e) { e.state = 'charge'; e.st = 0; } } });
    await shot('2fight');
    await p.evaluate(() => { const o = window.__oreum; o.enemies.test.clear(); o.director?.open?.('field'); o.swarm?.start?.(1); });
    await shot('3field');
    await p.evaluate(() => { const o = window.__oreum; o.swarm?.stop?.(); o.enemies.test.clear(); o.street?.go?.(1); o.snap(); });
    await shot('4shop');
    await ctx.close();
  }
  return out;
}
// 전체 화면 안내: 기기마다 맞는 안내인지
async function ua(b) {
  const cases = [
    ['android', devices['Pixel 7'], 'api'],
    ['iphone', devices['iPhone 13'], 'ios'],
    ['iphone-chrome', { ...devices['iPhone 13'], userAgent: devices['iPhone 13'].userAgent.replace('Version/', 'CriOS/120.0 Version/') }, 'ios-other'],
    ['standalone', devices['iPhone 13'], 'none', true],
    ['pc', { viewport: { width: 1280, height: 800 } }, 'none'],
  ];
  let bad = 0;
  for (const [name, dev, want, standalone] of cases) {
    const ctx = await b.newContext({ ...dev, deviceScaleFactor: 1 });
    if (standalone) await ctx.addInitScript(() => { const m = window.matchMedia.bind(window); window.matchMedia = (q) => (/display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : m(q)); });
    const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('ERR', name, e.message.slice(0, 200)));
    await p.goto(URL); await ready(p);
    const got = await p.evaluate(() => window.__oreum.fsTip.kind());
    const shown = await p.evaluate(() => { const t = window.__oreum.fsTip; t.reset(); return t.offer() ? document.getElementById('fs-tip').dataset.kind : 'none'; });
    const ok = got === want && shown === want; if (!ok) bad++;
    console.log(ok ? 'ok ' : 'BAD', name, '종류', got, '뜬 안내', shown, '기대', want);
    if (shown !== 'none') await p.screenshot({ path: `dist/s-fstip-${name}.png` });
    await ctx.close();
  }
  return bad;
}
(async () => {
  const b = await chromium.launch({ args: LA });
  if (args.includes('--ua')) { const bad = await ua(b); await b.close(); process.exit(bad ? 1 : 0); }
  const out = await scenes(b);
  require('fs').writeFileSync(`dist/s-${TAG}.json`, JSON.stringify(out, null, 1));
  await b.close();
})();
