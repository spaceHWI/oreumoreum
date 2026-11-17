// 의견 보내기 확인 (#77): node tools/feedback.js [서버주소]
// 서버 없이: 기기에 모아 두기·1분 막기·첫 화면 버튼. 서버 주소를 주면(cd server && npm run dev) 모아 둔 글이 서버로 가는지
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const SRV = process.argv.slice(2).find((a) => !a.startsWith('--')) || '';
const ROOT = path.join(process.cwd(), 'dist');
const web = http.createServer((q, r) => { const f = path.join(ROOT, q.url.split('?')[0].split('#')[0]); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); r.end(fs.readFileSync(f)); });
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
(async () => {
  await new Promise((r) => web.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${web.address().port}/test.html`;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 700 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => { console.log('ERR', e.message.slice(0, 200)); process.exitCode = 1; });
  const ready = () => p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.goto(base + '?server=0#namsongi'); await ready();
  // 첫 화면 버튼 → 창이 첫 화면 위에 보임
  await p.click('#intro-feedback');
  ok(await p.evaluate(() => { const r = document.getElementById('feedback-send').getBoundingClientRect(); const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return el && el.id === 'feedback-send'; }), '첫 화면에서 창이 위에 열림');
  ok(await p.evaluate(() => document.getElementById('feedback-input').maxLength === 500), '500자 상한');
  await p.fill('#feedback-input', '테스트 의견 하나');
  await p.click('#feedback-send'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.getElementById('feedback').hidden && window.__oreum.feedback.pending === 1), '서버 없음: 기기에 모아 둠');
  if (process.argv.includes('--shot')) await p.screenshot({ path: 'dist/feedback-intro.png' });
  await p.click('#intro-feedback'); await p.fill('#feedback-input', '바로 또 보냄'); await p.click('#feedback-send'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !document.getElementById('feedback').hidden && window.__oreum.feedback.pending === 1 && window.__oreum.feedback.wait() > 0), '1분 안 다시 보내기 막음');
  const q = await p.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.endsWith('.fb')))).q[0]);
  ok(q && q.ver && q.srv && q.dev && Number.isFinite(q.x) && q.nick && !('email' in q), `같이 가는 값 ${JSON.stringify(q)}`);
  if (SRV) {
    await p.goto(base + `?server=${encodeURIComponent(SRV)}#namsongi`); await ready(); await p.waitForTimeout(1500);
    ok(await p.evaluate(() => window.__oreum.feedback.pending === 0), '서버가 붙으면 모아 둔 글을 보냄');
    const list = await (await fetch(SRV + '/feedback')).json();
    ok(Array.isArray(list) && list.some((it) => it.text === '테스트 의견 하나'), `서버에 저장됨 (${list.length}건)`);
    await p.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.endsWith('.fb')); const o = JSON.parse(localStorage.getItem(k)); o.last = 0; localStorage.setItem(k, JSON.stringify(o)); });
    await p.reload(); await ready();
    const r = await p.evaluate(() => window.__oreum.feedback.send('바로 보내기'));
    ok(r === 'ok', '서버 있음: 바로 보냄 → ' + r);
  }
  await b.close(); web.close();
})();
