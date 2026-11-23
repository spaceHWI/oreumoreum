// 로딩 창·첫 화면 계정 검사 (#281): node tools/loadrun.js d|m [그림 폴더]   (먼저 node build.mjs)
// dist 를 http 로 띄우고 게임 코드(main-*.js)·모델을 느리게 보내(느린 연결 흉내) Pages 빌드(index.html)를 연다. 서버는 가로채 흉내 낸다
// 1. 손님: 로딩 창이 먼저 덮음(가운데를 누르면 로딩 창) → 막대가 중간값을 거쳐 오름(되돌아가지 않음) → 걷힌 뒤 첫 화면·'시작' 을 누를 수 있음
// 2. 새 버전 다시 받기: '새로고침' → 바로 '새 버전 받는 중' 로딩 창 → 새 페이지도 로딩 창부터 (html 바탕은 밤색)
// 3. 로그인(가짜 계정) → 첫 화면 계정 칸(첫 글자·이름·가린 메일·로그아웃), 설정 창에도 같은 칸
// 4. 로그아웃: 한 번 더 묻고 → 서버 /logout → 토큰·계정 사본 지움 → 손님 첫 화면. 다른 계정으로 다시 로그인하면 그 계정 이름, 손님 저장은 그대로
// 5. 받지 못함(main 404) → 바로 '다시 시도'. 응답이 멈춤 → 10초 '조금만 더요', 30초 '다시 시도' (시계를 빨리 감아 봄)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium, devices } = require('playwright');
const MODE = process.argv[2] === 'm' ? 'm' : 'd', SHOT = process.argv[3] || '';
let fails = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) { fails++; process.exitCode = 1; } };
const DIST = path.resolve('dist'), SRV = 'https://oreumoreum.spacehwi.workers.dev';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let MAIN_MS = 4000, MAIN_404 = false, MAIN_HANG = false;
const srv = http.createServer(async (q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]), f = path.join(DIST, u);
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  const ct = f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.json') ? 'application/json' : 'application/octet-stream';
  const buf = fs.readFileSync(f), main = /\/main-[^/]+\.js$/.test(u);
  if (main && MAIN_404) { r.writeHead(404); r.end(); return; }
  if (main && MAIN_HANG) return; /* 응답 없이 멈춤 */
  r.writeHead(200, { 'content-type': ct, 'content-length': buf.length, 'cache-control': main || u.startsWith('/a/') ? 'max-age=600' : 'no-cache' });
  if (main) { const N = 20; for (let i = 0; i < N; i++) { r.write(buf.subarray(Math.floor(buf.length * i / N), Math.floor(buf.length * (i + 1) / N))); await sleep(MAIN_MS / N); } r.end(); return; }
  if (u.startsWith('/a/')) await sleep(400);
  r.end(buf);
});
const tok = (sub) => 'x.' + Buffer.from(JSON.stringify({ s: sub })).toString('base64url') + '.y';
const NICKS = { 'fake-tester': '한라봉', 'fake-other': '다른이' };
(async () => {
  await new Promise((res) => srv.listen(0, '127.0.0.1', res));
  const URL0 = `http://127.0.0.1:${srv.address().port}/index.html#namsongi`;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const calls = [];
  const mk = async () => {
    const ctx = await b.newContext(MODE === 'm' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 760 } });
    await ctx.route(/^https:\/\//, (rt) => {
      const u = new URL(rt.request().url()), h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
      if (!rt.request().url().startsWith(SRV)) return rt.abort(); /* 글꼴·구글 로그인·날씨: 막힌 환경에서 멈추지 않게 */
      if (rt.request().method() === 'OPTIONS') return rt.fulfill({ status: 204, headers: h });
      const auth = rt.request().headers().authorization || '', sub = (() => { try { return JSON.parse(Buffer.from(auth.split('.')[1], 'base64url').toString()).s; } catch (e) { return ''; } })();
      calls.push(rt.request().method() + ' ' + u.pathname + (sub ? ' ' + sub : ''));
      const J = (o) => rt.fulfill({ status: 200, headers: h, contentType: 'application/json', body: JSON.stringify(o) });
      if (u.pathname === '/auth/google') { const c = JSON.parse(rt.request().postData() || '{}').credential || '', s = 'fake-' + c.slice(5); return J({ token: tok(s), exp: Date.now() + 864e6, hasSave: true, nick: NICKS[s] }); }
      if (u.pathname === '/me') return sub ? J({ admin: false, keepUntil: Date.now() + 864e6, save: { nick: NICKS[sub] || '누구', coins: 77, entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 } }, rev: 1 }) : rt.fulfill({ status: 401, headers: h, body: '{}' });
      if (u.pathname === '/save') return J({ rev: 2, keepUntil: Date.now() + 864e6 });
      return J({});
    });
    const p = await ctx.newPage(); p.errs = 0; p.setDefaultNavigationTimeout(120000);
    p.on('pageerror', (e) => { p.errs++; console.log('ERR', e.message.slice(0, 300)); });
    return { ctx, p };
  };
  const shot = async (p, n) => { if (!SHOT) return; fs.mkdirSync(SHOT, { recursive: true }); await p.screenshot({ path: path.join(SHOT, `load-${MODE}-${n}.png`) }).catch(() => {}); };
  const until = async (p, fn, ms, arg) => { const t1 = Date.now(); while (Date.now() - t1 < ms) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await sleep(150); } return false; };
  const B = (p) => p.evaluate(() => { const s = window.__boot?.state(); if (!s) return null; const e = document.getElementById('boot'), r = innerWidth / 2, t = innerHeight / 2, hit = document.elementFromPoint(r, t); return { ...s, op: +getComputedStyle(e).opacity, cover: !!hit?.closest('#boot'), inapp: !!window.__inapp }; }).catch(() => null);
  /* 로딩 창이 걷힐 때까지 보며: 걷히기 전에는 늘 덮음, 막대는 되돌아가지 않음 */
  const watch = async (p, ms = 120000, tag = '') => {
    const t1 = Date.now(); let last = -1, back = false, mids = 0, open = 0, leak = 0, snapped = false;
    while (Date.now() - t1 < ms) {
      const s = await B(p);
      if (s && !s.done) { open++; if (s.shown < last - 0.5) back = true; last = Math.max(last, s.shown); if (s.shown > 5 && s.shown < 95) mids++; if (!(s.op > 0.99 && s.cover)) leak++; if (!snapped && s.shown > 30) { snapped = true; await shot(p, 'boot' + tag); } }
      if (s && s.done && s.hidden) return { open, back, mids, leak, s };
      await sleep(120);
    }
    return { open, back, mids, leak, s: await B(p), timeout: true };
  };

  // ---- 1. 손님 첫 열기 ----
  { const { ctx, p } = await mk(); MAIN_MS = 4000;
    await p.goto(URL0, { waitUntil: 'commit' });
    const w = await watch(p);
    ok(!w.timeout && w.open > 5, `로딩 창이 먼저 덮고 걷힘 (본 횟수 ${w.open}${w.timeout ? ', 시간 넘김' : ''})`);
    ok(w.mids >= 3 && !w.back, `막대가 중간값을 거쳐 오르고 되돌아가지 않음 (중간 ${w.mids}번)`);
    ok(w.leak === 0, `걷히기 전에 캔버스·첫 화면이 비치지 않음 (가운데가 로딩 창이 아니었던 때 ${w.leak}번)`);
    ok(w.s?.log?.some((l) => /p 3\d|p [4-9]/.test(l)) ?? false, '게임 코드 받은 양이 막대에 들어감');
    ok(await p.evaluate(() => getComputedStyle(document.documentElement).backgroundColor === 'rgb(36, 37, 31)'), 'html 바탕이 로딩 창과 같은 밤색');
    await sleep(300);
    ok(await p.evaluate(() => !document.getElementById('intro').hidden && document.getElementById('boot').hidden && !!document.getElementById('view').classList.contains('drawn')), '걷힌 뒤 첫 화면');
    ok(await p.evaluate(() => /손님으로 하는 중/.test(document.getElementById('acct-box').textContent)), "첫 화면 손님 줄: '손님으로 하는 중 · 로그인하면 기록이 남아요'");
    await shot(p, 'title-guest');
    let clicked = true; await p.click('#enter', { timeout: 15000 }).catch(() => { clicked = false; });
    ok(clicked && await until(p, () => document.getElementById('intro').hidden, 8000), "로딩 창 때문에 '시작' 을 못 누르는 일 없음");
    // ---- 2. 새 버전 다시 받기 ----
    await until(p, () => !!window.__oreum?.ticks, 20000);
    const s1 = await p.evaluate(() => { document.getElementById('newver').hidden = false; document.getElementById('newver-go').click(); return window.__boot.state(); });
    ok(!!s1 && !s1.done && !s1.hidden && /새 버전 받는 중/.test(s1.wit), "'새로고침' → 바로 '새 버전 받는 중' 로딩 창");
    await p.waitForEvent('framenavigated', { timeout: 20000 }).catch(() => {});
    await shot(p, 'newver');
    const w2 = await watch(p, 120000, '-2');
    ok(w2.open > 2 && w2.leak === 0 && !w2.timeout, `다시 받은 페이지도 로딩 창부터, 비침 없음 (본 횟수 ${w2.open}, 비침 ${w2.leak})`);
    ok(p.errs === 0, '손님·새 버전: 페이지 오류 없음');
    await ctx.close(); }

  // ---- 3·4. 로그인 → 계정 칸 → 로그아웃 → 다른 계정 ----
  { const { ctx, p } = await mk(); MAIN_MS = 600;
    await p.goto(URL0, { waitUntil: 'commit' }); await watch(p);
    await until(p, () => !!window.__oreum?.online?.account?.(), 30000);
    const GK = await p.evaluate(() => Object.keys(localStorage).find((k) => /^oreumoreum\.(v1|dev)$/.test(k)));
    await p.evaluate(() => { const o = window.__oreum; o.save.coins = 123; o.save.nick = '손님이'; localStorage.setItem(Object.keys(localStorage).find((k) => /^oreumoreum\.(v1|dev)$/.test(k)), JSON.stringify(o.save)); });
    const guest0 = await p.evaluate((k) => JSON.parse(localStorage.getItem(k)).coins, GK);
    await p.evaluate(() => { const o = window.__oreum; o.online.fake('tester'); });
    await p.waitForEvent('framenavigated', { timeout: 20000 }).catch(() => {});
    const w3 = await watch(p);
    ok(!w3.timeout && w3.leak === 0, '로그인 뒤 다시 열 때도 로딩 창');
    const card = () => p.evaluate(() => { const c = document.querySelector('#acct-box .acct-card'); return c && { av: c.querySelector('.acct-av').textContent, nick: c.querySelector('.acct-nick').textContent, mail: c.querySelector('.acct-mail').textContent, out: !!c.querySelector('.acct-logout') }; });
    const c1 = await card();
    ok(!!c1 && c1.av === '한' && c1.nick === '한라봉' && c1.out, `첫 화면 계정 칸: 첫 글자·이름·로그아웃 (${JSON.stringify(c1)})`);
    ok(!!c1 && c1.mail === '구글 계정으로 로그인됨 · tes***@test.local', `메일은 앞 3글자만 (${c1?.mail})`);
    ok(await p.evaluate(() => !/eyJ|x\.ey|Bearer/.test(document.body.innerText) && !JSON.stringify(localStorage).includes('tester@')), '화면·저장에 토큰·원래 메일 없음');
    await shot(p, 'title-acct');
    ok(await p.evaluate(() => { const c = document.querySelector('#m-acct-card .acct-card'); return !!c && c.querySelector('.acct-nick').textContent === '한라봉'; }), '설정 창에도 같은 계정 칸');
    await p.click('#acct-box .acct-logout', { timeout: 10000 });
    ok(await until(p, () => !!document.getElementById('acct-ask-out'), 3000), '로그아웃: 한 번 더 물음');
    ok(await p.evaluate(() => /서버에 남아요/.test(document.getElementById('acct-ask-out').textContent)), '물음에 이 기기 저장이 어떻게 되는지 한 줄');
    await shot(p, 'logout-ask');
    await p.click('#acct-ask-out [data-v="0"]'); await sleep(300);
    ok(await p.evaluate(() => !document.getElementById('acct-ask-out') && window.__oreum.online.account().loggedIn), "'그대로 두기' 면 로그인 그대로");
    calls.length = 0;
    await p.click('#acct-box .acct-logout'); await p.click('#acct-ask-out [data-v="1"]');
    await p.waitForEvent('framenavigated', { timeout: 20000 }).catch(() => {});
    await watch(p);
    ok(calls.some((c) => c.startsWith('POST /logout fake-tester')), '서버 /logout 으로 토큰을 버림');
    ok(await p.evaluate(() => !Object.keys(localStorage).some((k) => /\.(sess|acct)$/.test(k))), '이 기기의 토큰·계정 사본 지움');
    ok(await p.evaluate(() => !window.__oreum.online.account().loggedIn && /손님으로 하는 중/.test(document.getElementById('acct-box').textContent)), '손님 첫 화면으로');
    ok(await p.evaluate((k) => JSON.parse(localStorage.getItem(k)).coins, GK) === guest0, '손님 저장은 그대로 (계정 기록과 섞이지 않음)');
    await until(p, () => !!window.__oreum?.online?.account?.(), 30000);
    await p.evaluate(() => { const o = window.__oreum; o.online.fake('other'); });
    await p.waitForEvent('framenavigated', { timeout: 20000 }).catch(() => {});
    await watch(p);
    const c2 = await card();
    ok(!!c2 && c2.nick === '다른이' && c2.av === '다' && /oth\*\*\*@test\.local/.test(c2.mail), `다른 계정으로 다시 로그인하면 그 계정 (${JSON.stringify(c2)})`);
    ok(await p.evaluate(() => window.__oreum.save.coins) === 77, '그 계정 저장을 불러옴 (손님 귤과 섞이지 않음)');
    ok(p.errs === 0, '로그인·로그아웃: 페이지 오류 없음');
    await ctx.close(); }

  // ---- 5. 받지 못함·느림 ----
  { const { ctx, p } = await mk(); MAIN_404 = true;
    await p.goto(URL0, { waitUntil: 'commit' });
    ok(await until(p, () => { const s = window.__boot?.state(); return s && s.retry && !s.done; }, 15000), "게임 코드를 받지 못하면 바로 '다시 시도'");
    await shot(p, 'fail');
    MAIN_404 = false; await ctx.close(); }
  { const { ctx, p } = await mk(); MAIN_HANG = true;
    await ctx.clock.install();
    await p.goto(URL0, { waitUntil: 'commit' });
    await until(p, () => !!window.__boot, 10000);
    const s0 = await B(p);
    ok(!!s0 && !s0.slow && !s0.retry, '처음에는 늦음 줄·다시 시도 없음');
    await p.clock.runFor(11000);
    const s10 = await B(p);
    ok(!!s10 && s10.slow && !s10.retry, "10초 넘으면 '조금만 더요'");
    await p.clock.runFor(20000);
    const s30 = await B(p);
    ok(!!s30 && s30.retry, "30초 넘으면 '다시 시도'");
    const wits = new Set(); for (let i = 0; i < 6; i++) { wits.add((await B(p))?.wit); await p.clock.runFor(3000); }
    ok(wits.size >= 4, `위트 한 줄이 3초마다 바뀜 (${[...wits].join(' / ')})`);
    await shot(p, 'slow');
    MAIN_HANG = false; await ctx.close(); }

  await b.close(); srv.close();
  console.log(fails ? `FAIL ${fails}` : 'loadrun 통과');
  process.exit(fails ? 1 : 0);
})();
