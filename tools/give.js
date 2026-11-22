// 귤 주기 확인 (#175): node tools/give.js [서버주소=http://127.0.0.1:8787]
// 로컬 서버(cd server && npm run dev: FAKE_AUTH·GIFT_NEW_SEC 0)에 브라우저 둘을 가짜 로그인으로 붙이고, A 가 B 옆에서 상호작용을 누르고 있으면 B 귤이 늘고 A 는 준 만큼 주는지 본다
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const SRV = process.argv[2] || 'http://127.0.0.1:8787';
const ROOT = path.join(process.cwd(), 'dist');
const web = http.createServer((q, r) => { const f = path.join(ROOT, q.url.split('?')[0].split('#')[0]); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
const wait = (p, ms) => p.waitForTimeout(ms);
(async () => {
  await new Promise((r) => web.listen(0, '127.0.0.1', r));
  const URL0 = `http://127.0.0.1:${web.address().port}/test.html?server=${encodeURIComponent(SRV)}#namsongi`;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const until = async (X, fn, arg, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await X.p.evaluate(fn, arg).catch(() => false)) return true; await wait(X.p, 250); } return false; };
  const ready = (p) => p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 180000 });
  const open = async (name) => {
    const ctx = await b.newContext({ viewport: { width: 480, height: 320 } });
    await ctx.route(/^https:\/\//, (r) => r.abort());
    const p = await ctx.newPage(); p.setDefaultNavigationTimeout(180000);
    p.on('pageerror', (e) => console.log(name, 'ERR', e.message.slice(0, 200)));
    await p.goto(URL0); await ready(p);
    // 가짜 로그인 → 계정 사본으로 새로고침 (기기 기록은 옮기지 않음)
    await p.evaluate((n) => { window.__old = 1; window.__oreum.online.fake(n); }, name + '-' + Date.now());
    await p.waitForFunction(() => document.querySelector('#acct-ask [data-v="0"]'), null, { timeout: 8000 }).then(() => p.evaluate(() => document.querySelector('#acct-ask [data-v="0"]').click())).catch(() => {});
    for (let k = 0; k < 180; k++) { await wait(p, 1000); if (await p.evaluate(() => !window.__old && !!(window.__oreum?.online?.account?.()?.loggedIn && window.__oreum.renderer.info.render.frame > 2)).catch(() => false)) break; }
    // 튜토리얼 끝낸 기록으로 저장하고 다시 엶 (튜토리얼 중엔 혼자라 남이 안 보임)
    const rev0 = await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1 }); const k = Object.keys(localStorage).find((x) => x.endsWith('.acct')); if (k) localStorage.setItem(k, JSON.stringify(o.save)); return o.save._rev || 0; }); // 이 기기 사본에도 바로
    for (let k = 0; k < 15; k++) { await p.evaluate(() => window.__oreum.online.account().push()); if (await p.evaluate((r) => (window.__oreum.save._rev || 0) > r, rev0)) break; await wait(p, 1000); } /* push 는 앞 저장이 도는 중이면 건너뜀: 서버가 받을 때까지 (#205, 안 그러면 새로 고친 뒤 서버 사본의 튜토리얼 처음으로 돌아가 혼자가 됨) */
    await p.reload(); await ready(p);
    const introOpen = () => p.evaluate(() => !document.getElementById('intro').hidden);
    if (await introOpen().catch(async () => { await ready(p); return introOpen(); })) await p.click('#enter').catch(() => {}); /* 로그인 뒤 페이지가 한 번 더 새로 고쳐지며 읽던 문맥이 사라지기도 함 (#193) */
    const X = { ctx, p };
    ok(await until(X, () => window.__oreum.net.ready && window.__oreum.online.account().loggedIn, null, 40000), `${name}: 로그인한 채로 방에 붙음`);
    console.log(name, 'ready');
    return X;
  };
  const A = await open('giver'), B = await open('taker');
  const diag = (X) => X.p.evaluate(() => { const o = window.__oreum; return { tut: o.tut?.active, done: o.save.tut?.done, ready: o.net.ready, n: o.net.count, solo: o.net.solo, srv: o.save.server, pos: [Math.round(o.player.pos.x), Math.round(o.player.pos.z)], intro: !document.getElementById('intro').hidden }; });
  const seenB = await until(A, () => window.__oreum.net.count >= 1, null, 90000);
  ok(seenB, 'A 가 B 를 봄' + (seenB ? '' : ` (A ${JSON.stringify(await diag(A))} · B ${JSON.stringify(await diag(B))})`));
  // A 는 귤을 넉넉히 (처음 몫 안), B 를 A 옆으로
  await A.p.evaluate(() => { const o = window.__oreum; o.save.coins = 500; return o.online.account().push(); }); await wait(A.p, 800);
  const ap = await A.p.evaluate(() => { const p = window.__oreum.player.pos; return [p.x, p.z]; });
  await B.p.evaluate(([x, z]) => { const o = window.__oreum; o.player.pos.set(x + 1.2, o.groundAt(x + 1.2, z), z); }, ap);
  const seen = await until(A, () => !!window.__oreum.give.target(), null, 20000);
  const why = await A.p.evaluate(() => { const o = window.__oreum; return { st: o.give.state(), peers: [...o.net.peersById.values()].map((e) => ({ ac: e.data.ac, ng: e.data.ng, vis: e.runner.root.visible, d: +e.pos.distanceTo(o.player.pos).toFixed(1) })) }; });
  ok(seen, `B 가 가까우면 받을 사람으로 (${JSON.stringify(why)})`);
  await until(A, () => /귤 주기/.test(document.querySelector('#btn-ctx span').textContent), null, 3000);
  ok(await A.p.evaluate(() => /귤 주기/.test(document.querySelector('#btn-ctx span').textContent)), `버튼이 '귤 주기' (${await A.p.evaluate(() => document.querySelector('#btn-ctx span').textContent)})`);
  const snap = (X) => X.p.evaluate(() => ({ c: window.__oreum.save.coins, g: { ...window.__oreum.save.gift }, t: (window.__oreum.msglog?.state().lines || []).map((l) => l.text).join(' / ') || document.getElementById('toast')?.textContent || '' })); /* 알림은 메시지 줄로 (#252) */
  // 한 번 누르면 1개
  const a0 = await snap(A), b0 = await snap(B);
  await A.p.evaluate(() => { const o = window.__oreum; o.give.press(); }); await wait(A.p, 1200);
  const a1 = await snap(A), b1 = await snap(B);
  ok(a0.c - a1.c === 1 && b1.c - b0.c === 1 && a1.g.out - (a0.g.out || 0) === 1, `한 번 누르면 1개 (A ${a0.c}→${a1.c}, B ${b0.c}→${b1.c})`);
  // 누르고 있으면 빨라짐
  await A.p.evaluate(() => { const o = window.__oreum; o.keys.add('f'); o.give.press(); });
  await wait(A.p, 1000); const mid = await A.p.evaluate(() => ({ ...window.__oreum.give.state(), keyF: window.__oreum.keys.has('f') })); console.log('  누르는 중', JSON.stringify(mid));
  await wait(A.p, 2000);
  await A.p.evaluate(() => { window.__oreum.keys.delete('f'); });
  await wait(A.p, 1500);
  const a2 = await snap(A), b2 = await snap(B);
  const gave = a2.g.out - a1.g.out, got = b2.g.in - b1.g.in;
  ok(gave >= 15 && gave === got && a1.c - a2.c === gave && b2.c - b1.c === got, `누르고 있으면 빨라지며 준 만큼 정확히 옮겨짐 (A ${a1.c}→${a2.c}, B ${b1.c}→${b2.c}, ${gave}개)`);
  ok(/님에게 귤 \d+개/.test(a2.t) && /님이 귤 \d+개를 줬어요/.test(b2.t), `한 줄 알림 (A '${a2.t}' · B '${b2.t}')`);
  // 저장해도 서버 값과 같음 (두 번 세지 않음)
  await A.p.evaluate(() => window.__oreum.online.account().push()); await B.p.evaluate(() => window.__oreum.online.account().push()); await wait(A.p, 1200);
  const a3 = await snap(A), b3 = await snap(B);
  ok(a3.c === a2.c && b3.c === b2.c, `저장 뒤에도 그대로 (A ${a3.c}, B ${b3.c})`);
  // 받지 않기: B 가 메뉴에서 끄면 A 버튼이 사라짐
  await B.p.evaluate(() => document.getElementById('menu-gift').click());
  ok(await until(A, () => !window.__oreum.give.target(), null, 8000), "B 가 '귤 선물: 안 받음' 이면 A 에게 버튼이 안 나옴");
  await A.ctx.close(); await B.ctx.close(); await b.close(); web.close();
})().catch((e) => { console.error(e); process.exit(1); });
