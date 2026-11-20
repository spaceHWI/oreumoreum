// 적 무리 버티기 (#108): 휴대폰 흉내로 연출 감독 경로(조짐 → 공격)를 따라 적 무리를 3번 부르고 30초 이상 버틴다
// node tools/enemyrun.js [iphone|android|all] [--live] [--dead]
//  - --dead: 캐릭터 말고 모델 .bin 을 끝까지 끊음 → 적이 임시 모양(placeholder)으로 나와도 멈추지 않는지
//  - 기본: dist/ 를 GitHub Pages 처럼 http 로 올려 index.html 을 엶 (모델 .bin 을 따로 받고 meshopt wasm 으로 풂 = 실서버와 같은 길)
//  - --live: 실서버(https://spacehwi.github.io/oreumoreum/) 를 엶. 공개 빌드라 __oreum 이 없으니 들어가서 오래 서 있기만 함(적은 감독이 부를 때만)
//  - 휴대폰: 폰 UA·터치·작은 화면(→ 게임이 LOW), CPU 4배 느리게
// 기록: 페이지 오류·콘솔 오류·페이지 크래시·WebGL context lost·JS 힙·프레임 수. 하나라도 문제가 있으면 exit 1
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');

const args = process.argv.slice(2), LIVE = args.includes('--live'), DEAD = args.includes('--dead');
const which = args.find((a) => !a.startsWith('--')) || 'all';
const PROFILES = {
  iphone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', cpu: 4 },
  android: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A536N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36', cpu: 6 },
};
const ROOT = path.join(__dirname, '../dist');
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0].split('#')[0]) || '/');
  const file = fs.existsSync(f) && fs.statSync(f).isDirectory() ? path.join(f, 'index.html') : f;
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  const raw = fs.readFileSync(file), text = /\.(html|js|json|webmanifest)$/.test(file), body = text ? zlib.gzipSync(raw) : raw;
  const type = file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'text/javascript; charset=utf-8' : file.endsWith('.png') ? 'image/png' : 'application/octet-stream';
  res.writeHead(200, { 'content-type': type, ...(text ? { 'content-encoding': 'gzip' } : {}), 'cache-control': 'no-store' }); res.end(body);
});

async function run(b, name, base) {
  const pr = PROFILES[name], { cpu, ...ctxOpt } = pr;
  const ctx = await b.newContext(ctxOpt), p = await ctx.newPage();
  if (DEAD) await ctx.route(/\/a\/.*\.bin/, (r) => (/runner/.test(r.request().url()) ? r.continue() : r.abort()));
  let testing = false; const bad = [], log = (k, m) => { if (testing && /시험|오름오름 오류|ContextLost/.test(String(m))) return; bad.push(k + ' ' + m); console.log(name, k, String(m).slice(0, 300)); };
  p.on('pageerror', (e) => log('ERR', e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/모델을 받지 못함|WebSocket|onestore|ERR_|net::|Failed to load resource|googleapis|gsi/i.test(m.text())) log('CON', m.text()); });
  p.on('crash', () => log('CRASH', '페이지가 죽음'));
  const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }); await cdp.send('Performance.enable');
  await p.addInitScript(() => {
    window.__ctxLost = 0;
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...a) { if (!this.__w) { this.__w = 1; this.addEventListener('webglcontextlost', () => { window.__ctxLost++; }); } return orig.apply(this, a); };
  });
  const heap = async () => { const m = (await cdp.send('Performance.getMetrics')).metrics; const v = (k) => m.find((x) => x.name === k)?.value || 0; return Math.round(v('JSHeapUsedSize') / 1e6) + 'MB'; };
  await p.goto(base + '#namsongi'); await p.waitForTimeout(12000);
  await p.evaluate(() => { const g = document.getElementById('guest') || document.getElementById('enter'); g?.click(); }).catch(() => {});
  await p.waitForTimeout(6000);
  await p.evaluate(() => document.getElementById('enter')?.click()).catch(() => {});
  await p.waitForTimeout(6000);
  const hasO = await p.evaluate(() => !!window.__oreum);
  const frames = () => p.evaluate(() => window.__oreum?.renderer.info.render.frame ?? -1);
  let waves = 0, maxEn = 0, enT = 0;
  if (hasO) {
    await p.evaluate(() => {
      const O = window.__oreum;
      try { O.look.close(); } catch { /* 없음 */ }
      O.cam.mode = 'follow'; O.save.jeong = 1; O.save.tut = { ...(O.save.tut || {}), done: 1 };
      document.body.classList.remove('tut'); const h = document.getElementById('tut-toast'); if (h) h.hidden = true;
      for (let i = 0; i < O.trash.api.heaps.length; i += 3) O.trash.setHeap(i, Math.floor(O.trash.api.heaps[i].n / 2));
      const x = -60, z = 40; O.player.pos.set(x, O.groundAt(x, z), z); O.snap();
      if (!O.sound.on) O.sound.start(); // 소리·적 음악까지 (실제 폰은 첫 터치에 켜짐)
      O.pace.pacing.test.first.done = true; O.pace.pacing.test.first.bloomed = true;
    });
    const f0 = await frames();
    const ZONES = [2, 5, 4]; // 들개 · 외계인 · 광견병 들개 (따로 받는 모델을 처음 쓰는 경우)
    for (let w = 0; w < 3; w++) {
      const at = await p.evaluate((zn) => {
        const O = window.__oreum, i = O.trash.api.heaps.findIndex((h) => h.zone === zn);
        if (i >= 0) { O.trash.goHeap(i); O.player.pos.x += 6; O.player.pos.y = O.groundAt(O.player.pos.x, O.player.pos.z); O.snap(); }
        O.pace.pacing.test.soon(0); return i;
      }, ZONES[w]);
      // 조짐(3초) → 공격: 게임 루프가 스스로 감독을 돌림. 적이 나오면 12초 버팀
      let seen = false;
      for (let s = 0; s < 60; s++) {
        await p.waitForTimeout(500);
        const n = await p.evaluate(() => { const O = window.__oreum, P = O.pace.pacing; if (!O.enemies.list.length && (P.phase === 'calm' || P.phase === 'rest')) P.test.soon(0); return O.enemies.list.length; }).catch(() => -1); // 앞 공격이 아직 끝나지 않았으면 끝난 뒤 다시
        if (n > 0) { seen = true; maxEn = Math.max(maxEn, n); }
        if (seen) enT += 0.5;
        if (seen && enT >= (w + 1) * 12) break;
      }
      if (seen) waves++; else log('NOWAVE', `${w + 1}번째 무리가 나오지 않음`);
      console.log(name, `무리 ${w + 1} (구역 ${ZONES[w]}, 더미 ${at})`, seen ? 'ok' : '없음', '힙', await heap(), '프레임', await frames(), await p.evaluate(() => window.__oreum.enemies.list.map((e) => e.kind).join(',') + ' 음악 ' + JSON.stringify(window.__oreum.sound.music?.state?.() || null)));
      await p.evaluate(() => { const O = window.__oreum; O.enemies.leaveAll(); O.dumpers?.state().forEach((d, i) => O.dumpers.hit(i)); });
      await p.waitForTimeout(1500);
    }
    const f1 = await frames();
    if (f1 - f0 < 60) log('STALL', `프레임이 거의 안 늘어남 ${f0}→${f1}`);
    const lost0 = await p.evaluate(() => window.__ctxLost); if (lost0) log('CTXLOST', lost0 + '번'); testing = true;
    // 안전장치 (#108): 적 하나가 오류 → 그 적만 사라짐 · 프레임 안 오류 → 다음 프레임 계속 · WebGL 잃음 → 안내 → 되살아남 · 오류는 한 번씩 의견함으로
    const S = await p.evaluate(async () => {
      const O = window.__oreum, got = [], wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const fr = () => O.renderer.info.render.frame;
      O.crash.setCrashSink(async (items) => { got.push(...items); }); // 서버 대신 받아 봄
      try { localStorage.removeItem('oreumoreum.crash'); } catch { /* 없음 */ }
      const r = {};
      // 1) 적 한 마리가 매 프레임 오류
      const e = O.enemies.test.spawn('dog', 6, 6); const n0 = O.enemies.list.length;
      e.fx = () => { throw new Error('시험 적 오류'); };
      const f0 = fr(); await wait(1500);
      r.enemy = { removed: !O.enemies.list.includes(e), n: n0 + '→' + O.enemies.list.length, frames: fr() - f0 };
      // 2) 프레임 안에서 오류 (같은 오류가 계속 나도 알림은 한 번)
      const tb = O.social.tickBubbles; let k = 0;
      O.social.tickBubbles = function () { if (k++ < 30) throw new Error('시험 프레임 오류'); return tb.apply(this, arguments); };
      const f1 = fr(); await wait(2000); O.social.tickBubbles = tb;
      r.frame = { frames: fr() - f1, threw: k };
      // 3) WebGL 잃음 → 되살아남
      const ext = O.renderer.getContext().getExtension('WEBGL_lose_context');
      if (ext) {
        ext.loseContext(); await wait(400);
        r.lost = { shown: !document.getElementById('gl-lost').hidden };
        ext.restoreContext(); await wait(1500);
        const f2 = fr(); await wait(1500);
        Object.assign(r.lost, { hidden: document.getElementById('gl-lost').hidden, frames: fr() - f2, gl: !O.renderer.getContext().isContextLost() });
      }
      // 4) 처리 못 한 promise 오류
      Promise.reject(new Error('시험 promise 오류')); await wait(300);
      // 5) 같은 오류 하루 3번: 새로 켠 것처럼 seen 을 지우고 4번 보냄
      for (let i = 0; i < 4; i++) O.crash.reportCrash(new Error('반복 시험'), 'day');
      await wait(300);
      r.got = got.map((it) => it.kind + ' ' + it.text.slice(0, 90));
      try { r.day = Object.values(JSON.parse(localStorage.getItem('oreumoreum.crash')).n); } catch { r.day = null; }
      r.priv = got.every((it) => it.x == null && it.z == null && it.nick == null);
      return r;
    });
    console.log(name, '안전장치', JSON.stringify(S, null, 1));
    if (!S.enemy.removed || S.enemy.frames < 3) log('SAFE', '적 오류 뒤 멈춤');
    if (S.frame.frames < 3) log('SAFE', '프레임 오류 뒤 멈춤');
    if (S.lost && !(S.lost.shown && S.lost.hidden && S.lost.frames > 2 && S.lost.gl)) log('SAFE', 'WebGL 되살리기 실패');
    const kinds = S.got.join('\n');
    if (!/시험 적 오류/.test(kinds) || !/시험 프레임 오류/.test(kinds) || !/시험 promise 오류/.test(kinds) || !/webglcontextlost/.test(kinds)) log('SAFE', '알림이 빠짐');
    if (S.got.filter((t) => /시험 프레임 오류/.test(t)).length !== 1) log('SAFE', '같은 오류가 여러 번 알려짐');
    if (!S.priv) log('SAFE', '알림에 좌표·닉네임');
    if (S.got.filter((t) => /반복 시험/.test(t)).length !== 1 || !S.day || S.day.some((n) => n !== 1)) log('SAFE', '하루 횟수 기록이 이상함');
    testing = false;
  } else {
    // 실서버: 그냥 오래 서 있으며 오류만 봄
    for (let s = 0; s < 6; s++) { await p.waitForTimeout(10000); console.log(name, `${(s + 1) * 10}초`, '힙', await heap()); }
  }
  if (!hasO) { const lost = await p.evaluate(() => window.__ctxLost).catch(() => -1); if (lost) log('CTXLOST', lost + '번'); }
  console.log(name, hasO ? `무리 ${waves}/3 · 최대 ${maxEn}마리 · 적과 ${enT}초` : '(__oreum 없음)', '힙', await heap().catch(() => '-'), '오류', bad.length);
  await ctx.close();
  return bad.length;
}

(async () => {
  let base = 'https://spacehwi.github.io/oreumoreum/';
  if (!LIVE) { await new Promise((r) => server.listen(0, r)); base = `http://127.0.0.1:${server.address().port}/`; }
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  let fail = 0;
  for (const n of which === 'all' ? Object.keys(PROFILES) : [which]) fail += await run(b, n, base);
  await b.close(); server.close();
  console.log(fail ? `실패 ${fail}` : '통과');
  process.exitCode = fail ? 1 : 0;
})();
