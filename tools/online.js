// 멀티 확인 (#7): node tools/online.js [서버주소=http://127.0.0.1:8787]
// 로컬 서버(cd server && npm run dev, 가짜 로그인 켬)에 브라우저 둘을 붙여 서로 보이는지, 더미를 주우면 다른 쪽에도 줄어드는지,
// 가짜 로그인 → 계정 저장 → 귤 부풀리기가 서버에서 바로잡히는지 본다
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const SRV = process.argv[2] || 'http://127.0.0.1:8787';
const ROOT = path.join(process.cwd(), 'dist');
const web = http.createServer((q, r) => { const f = path.join(ROOT, q.url.split('?')[0].split('#')[0]); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); r.end(fs.readFileSync(f)); });
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
const wait = (p, ms) => p.waitForTimeout(ms);
(async () => {
  await new Promise((r) => web.listen(0, '127.0.0.1', r));
  const URL0 = `http://127.0.0.1:${web.address().port}/test.html?server=${encodeURIComponent(SRV)}#namsongi`;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const open = async (name) => {
    console.log(name, 'open');
    const ctx = await b.newContext({ viewport: { width: 480, height: 320 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => console.log(name, 'ERR', e.message.slice(0, 200)));
    await p.goto(URL0);
    await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
    // 튜토리얼 끝낸 손님으로 들어감
    await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { server: 'clean', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1 }); localStorage.setItem(Object.keys(localStorage).find((k) => k.startsWith('oreumoreum') && !k.includes('.ab')) || 'oreumoreum.v1', JSON.stringify(o.save)); });
    await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
    console.log(name, 'ready');
    return { ctx, p };
  };
  const A = await open('A'), B = await open('B');
  ok(await A.p.evaluate(() => document.getElementById('enter').textContent === '손님으로 하기' && !document.getElementById('acct-box').hidden), '첫 화면: 손님으로 하기·베타 안내');
  ok(await A.p.evaluate(() => /7일/.test(document.getElementById('acct-box').textContent)), '베타 안내 문구');
  for (const X of [A, B]) { await X.p.click('#enter'); await wait(X.p, 500); }
  await wait(A.p, 2500);
  ok(await A.p.evaluate(() => window.__oreum.net.ready && window.__oreum.net.count === 1), 'A 가 B 를 봄');
  ok(await B.p.evaluate(() => window.__oreum.net.count === 1), 'B 가 A 를 봄');
  // A 를 움직이면 B 화면의 A 가 따라옴
  await A.p.evaluate(() => { const o = window.__oreum; o.player.pos.x += 5; });
  await wait(A.p, 800);
  const d = await B.p.evaluate(() => { const e = [...window.__oreum.net.peersById.values()][0]; return e ? e.tpos.x : null; });
  const ax = await A.p.evaluate(() => window.__oreum.player.pos.x);
  ok(d != null && Math.abs(d - ax) < 0.5, `위치 이어 받기 (A ${ax.toFixed(1)} / B 가 본 A ${d?.toFixed(1)})`);
  // 더미 줍기: A 가 0번 더미에서 하나 → B 의 0번 더미도 하나 줄어듦
  const before = await B.p.evaluate(() => window.__oreum.trash.api.store.left(0));
  await A.p.evaluate(() => { const t = window.__oreum.trash.api; t.store.takeOne(0); });
  await wait(A.p, 600);
  const after = await B.p.evaluate(() => window.__oreum.trash.api.store.left(0));
  ok(after === before - 1, `더미 함께 쓰기 (B: ${before} → ${after})`);
  // 다시 쌓기는 방장만: B(나중에 온 사람)가 쌓으면 0
  const put = await B.p.evaluate(() => window.__oreum.trash.api.store.putBack(0, 1));
  ok(put === 0, '방장이 아니면 다시 쌓기 안 됨');
  // 가짜 로그인 → 계정 사본으로 새로고침
  await A.p.evaluate(() => { window.__oreum.save.coins = 40; });
  await A.p.evaluate(() => { window.__oreum.online.fake('tester-' + Date.now()); });
  await A.p.waitForFunction(() => document.querySelector('#acct-ask [data-v="1"]'), null, { timeout: 15000 }).then(() => A.p.evaluate(() => document.querySelector('#acct-ask [data-v="1"]').click())).catch((e) => console.log('  (옮기기 창 없음)', e.message.slice(0, 80)));
  for (let k = 0; k < 60; k++) { await wait(A.p, 1000); if (await A.p.evaluate(() => !!(window.__oreum?.online?.account?.()?.loggedIn && window.__oreum.renderer.info.render.frame > 2)).catch(() => false)) break; }
  await wait(A.p, 2000);
  ok(await A.p.evaluate(() => window.__oreum.online.account().loggedIn), '로그인됨');
  ok(await A.p.evaluate(() => window.__oreum.save.coins === 40), '기기 기록을 계정으로 옮김 (귤 40)');
  ok(await A.p.evaluate(() => !document.getElementById('m-acct').hidden && /일 남음/.test(document.getElementById('acct-days').textContent)), '메뉴: 남은 날짜');
  // 귤 부풀리기 → 서버가 바로잡음
  await A.p.evaluate(() => { const o = window.__oreum; o.save.coins = 999999; return o.online.account().push(); });
  await wait(A.p, 500);
  const c = await A.p.evaluate(() => window.__oreum.save.coins);
  ok(c < 999999 && c <= 40 + 1500 + 10, `귤 부풀리기 바로잡힘 (${c})`);
  await A.ctx.close(); await B.ctx.close(); await b.close(); web.close();
})().catch((e) => { console.error(e); process.exit(1); });
