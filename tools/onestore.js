// 원스토어 SDK 흐름 확인 (#97): node build.mjs 뒤 node tools/onestore.js
// dist/ 를 Pages 처럼 서버에 올려 연다. 진짜 SDK 주소(h5sdk.onestore.net)는 막아 둔다 (오프라인·차단이어도 게임이 뜨는지)
//  1) 일반 주소: SDK 없이 평소처럼 뜨고 시작 버튼이 켜지는지, 앱 표시(.onestore)가 없는지
//  2) ?onestore=mock: 진행률 → 100·startGame, safeArea → --safe-t, 구글 버튼 숨김, pause → 프레임·소리 멈춤, resume → 다시, exit → 저장, 뒤로 → 메뉴 닫기
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.bin': 'application/octet-stream', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
const rows = []; const ok = (c, t) => { rows.push(c); console.log(c ? 'OK  ' : 'FAIL', t); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const open = async (q) => {
    const p = await b.newPage({ viewport: { width: 420, height: 800 } });
    const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && /onestore|Content Security/i.test(m.text())) errs.push(m.text()); });
    let sdkHit = 0; await p.route('https://h5sdk.onestore.net/**', (rt) => { sdkHit++; rt.abort(); });
    const t0 = Date.now(); await p.goto(base + q);
    await p.waitForFunction(() => { const e = document.getElementById('enter'); return e && !e.disabled; }, null, { timeout: 60000 });
    return { p, errs, ms: Date.now() - t0, sdk: () => sdkHit };
  };
  try {
    // 1) 일반 브라우저 (SDK 막힘)
    { const { p, errs, ms, sdk } = await open('#namsongi');
      ok(sdk() > 0, `SDK 스크립트를 첫 화면에서 요청함 (막힌 채로 ${sdk()}번)`);
      ok(true, `SDK 가 막혀도 시작 버튼 켜짐 (${(ms / 1000).toFixed(1)}초)`);
      ok(!(await p.evaluate(() => document.documentElement.classList.contains('onestore'))), '일반 브라우저: 앱 표시 없음');
      ok(!errs.length, '오류 없음' + (errs.length ? ': ' + errs.join(' | ').slice(0, 300) : ''));
      await p.close(); }
    // 2) 가짜 SDK
    { const { p, errs } = await open('?onestore=mock#namsongi');
      await p.waitForFunction(() => window.__onestoreMock?.started, null, { timeout: 15000 }).catch(() => {});
      const m = await p.evaluate(() => ({ started: __onestoreMock.started, log: __onestoreMock.log.slice() }));
      const prog = m.log.filter((l) => l.startsWith('progress')).map((l) => +l.split(' ')[1]);
      ok(m.started && prog.at(-1) === 100 && prog.every((v, i) => !i || v >= prog[i - 1]), `진행률 ${prog.join('→')} 뒤 startGame`);
      ok(await p.evaluate(() => document.documentElement.classList.contains('onestore') && getComputedStyle(document.documentElement).getPropertyValue('--safe-t').includes('28px')), 'safeArea → --safe-t (28px)');
      const gis = await p.evaluate(() => { const g = document.querySelector('.acct-gis'); return !g || getComputedStyle(g).display === 'none'; });
      ok(gis, '구글 로그인 버튼 숨김');
      await p.click('#enter').catch(() => {}); await p.click('#intro-srv button').catch(() => {}); await p.click('#srv-go').catch(() => {}); await sleep(3000);
      const fr = () => p.evaluate(() => window.__oreum?.renderer.info.render.frame ?? -1);
      const snd = () => p.evaluate(() => window.__oreum?.sound?.ctx?.state || (document.querySelector('#menu-sound')?.getAttribute('aria-pressed') ?? 'none'));
      const f0 = await fr(); await sleep(800); const f1 = await fr();
      ok(f1 > f0, `입장 뒤 프레임 진행 (${f0}→${f1})`);
      await p.evaluate(() => __onestoreMock.pause('test')); await sleep(300);
      const a = await fr(); await sleep(1000); const c = await fr(); const sP = await snd();
      ok(c === a, `pause: 프레임 멈춤 (${a}→${c}), 소리 ${sP}`);
      await p.evaluate(() => __onestoreMock.resume({})); await sleep(1000); const d = await fr();
      ok(d > c, `resume: 다시 그림 (${c}→${d}), 소리 ${await snd()}`);
      const w = await p.evaluate(() => { let n = 0; const o = Storage.prototype.setItem; Storage.prototype.setItem = function (...x) { n++; return o.apply(this, x); }; __onestoreMock.exit(); Storage.prototype.setItem = o; return n; });
      ok(w > 0, `exit: 기기에 바로 저장 (${w}번)`);
      const backs = await p.evaluate(async () => { const r = []; for (let i = 0; i < 4; i++) { const v = __onestoreMock.back(); r.push(v === true); if (v !== true) break; await new Promise((ok) => setTimeout(ok, 200)); } return r; });
      ok(backs.at(-1) === false && backs.length <= 3, `뒤로: 닫을 것이 없으면(첫 입장의 캐릭터 고르기 포함) false → 앱 종료 확인 (${backs.join(',')})`);
      await p.click('#look-ok').catch(() => {}); await sleep(300); // 캐릭터 고르기 끝
      await p.evaluate(() => { document.getElementById('menu').hidden = false; });
      const r = await p.evaluate(() => __onestoreMock.back()); const shut = await p.evaluate(() => document.getElementById('menu').hidden);
      ok(r === true && shut, '뒤로: 메뉴가 열려 있으면 닫고 true');
      ok(!errs.length, '오류 없음' + (errs.length ? ': ' + errs.join(' | ').slice(0, 300) : ''));
      await p.close(); }
    // 3) 기기 무음으로 시작
    { const { p } = await open('?onestore=mock&silent=1#namsongi');
      await p.waitForFunction(() => window.__onestoreMock?.started, null, { timeout: 15000 }).catch(() => {});
      await p.click('#enter').catch(() => {}); await p.click('#intro-srv button').catch(() => {}); await p.click('#srv-go').catch(() => {}); await sleep(1500);
      ok((await p.evaluate(() => document.getElementById('menu-sound').getAttribute('aria-pressed'))) === 'false', 'ringerSilent: 소리 끈 채 시작');
      await p.close(); }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${rows.filter(Boolean).length}/${rows.length} 통과`);
  process.exit(rows.every(Boolean) ? 0 : 1);
})();
