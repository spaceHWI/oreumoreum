// 돌탑 소원 확인 (#127): node tools/wish.js [서버주소=http://127.0.0.1:8787]
// 로컬 서버(cd server && npm run dev, 가짜 로그인 켬)에 브라우저 둘(A·B, 가짜 로그인)을 붙여
// A 가 창에서 소원을 쓰고 → B 가 창에서 보고 함께 기도(귤 +) → 돌탑 가까이에서 소원이 떠오름 → A 가 다시 들어오면 '○명이 함께 빌어 줬어요' → B 신고
// 먼저 node build.mjs
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const SRV = process.argv[2] || 'http://127.0.0.1:8787';
const ROOT = path.join(process.cwd(), 'dist');
const web = http.createServer((q, r) => { const f = path.join(ROOT, q.url.split('?')[0].split('#')[0]); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); r.end(fs.readFileSync(f)); });
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
const wait = (p, ms) => p.waitForTimeout(ms);
(async () => {
  await new Promise((r) => web.listen(0, '127.0.0.1', r));
  const { WISH } = await import('../src/balance.js');
  const URL0 = `http://127.0.0.1:${web.address().port}/test.html?server=${encodeURIComponent(SRV)}#namsongi`;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const until = async (p, fn, arg, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await wait(p, 250); } return false; };
  const toasts = (p) => p.evaluate(() => window.__toasts || []);
  const open = async (name) => {
    const ctx = await b.newContext({ viewport: { width: 480, height: 320 } });
    await ctx.route(/^https:\/\//, (r) => r.abort());
    const p = await ctx.newPage(); p.setDefaultNavigationTimeout(180000);
    p.on('pageerror', (e) => console.log(name, 'ERR', e.message.slice(0, 200)));
    await p.goto(URL0);
    await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
    await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1, nickSet: 1 }); localStorage.setItem(Object.keys(localStorage).find((k) => k.startsWith('oreumoreum') && !k.includes('.ab')) || 'oreumoreum.v1', JSON.stringify(o.save)); });
    // 가짜 로그인 → 계정 사본으로 새로고침
    await p.evaluate((n) => { window.__old = 1; window.__oreum.online.fake(n); }, 'wish-' + name + '-' + Date.now());
    await p.waitForFunction(() => document.querySelector('#acct-ask [data-v="1"]'), null, { timeout: 15000 }).then(() => p.evaluate(() => document.querySelector('#acct-ask [data-v="1"]').click())).catch(() => {});
    await until(p, () => !window.__old && !!(window.__oreum?.online?.account?.()?.loggedIn && window.__oreum.renderer.info.render.frame > 2), null, 180000);
    await p.evaluate(() => { window.__toasts = []; new MutationObserver(() => { const e = document.getElementById('msg-log'); if (e && e.textContent) window.__toasts.push(e.textContent); }).observe(document.body, { subtree: true, childList: true, characterData: true }); });
    for (let k = 0; k < 20 && (await p.evaluate(() => !document.getElementById('intro').hidden)); k++) { await p.evaluate(() => document.getElementById('enter').click()).catch(() => {}); await wait(p, 1500); }
    await until(p, () => window.__oreum.net.ready, null, 30000);
    await wait(p, 1500); await p.evaluate(() => { const o = window.__oreum; if (o.look.state().open) o.look.close(); });
    console.log(name, 'ready');
    return { ctx, p };
  };
  const go = (p) => p.evaluate(() => { const o = window.__oreum, c = o.cairns[0]; o.player.pos.set(c.pos.x + 2.5, o.groundAt(c.pos.x + 2.5, c.pos.z), c.pos.z); o.snap(); return c.id; });
  const A = await open('A');
  const cid = await go(A.p);
  await A.p.evaluate(() => window.__oreum.wish.open(window.__oreum.cairns[0]));
  ok(await A.p.evaluate(() => !document.getElementById('wishes').hidden && !document.getElementById('wish-input').disabled && document.getElementById('wish-input').maxLength === 30), '로그인하면 소원 칸이 열림 (30자)');
  await A.p.fill('#wish-input', '시1발 합격');
  await A.p.click('#wish-submit');
  ok(await until(A.p, () => (window.__toasts || []).some((t) => t.includes('다른 말로')), null, 5000) && await A.p.evaluate(() => !document.getElementById('wishes').hidden), "금칙어는 '다른 말로 써 주세요' (창 그대로)");
  await A.p.fill('#wish-input', '우리 가족 모두 건강하게');
  await A.p.click('#wish-submit');
  ok(await until(A.p, () => (window.__toasts || []).some((t) => t.includes('돌을 올렸어요')), null, 20000), 'A: 소원 쓰고 돌 올림');
  if (process.env.DBG) console.log(await A.p.evaluate(() => ({ open: [...document.querySelectorAll('.overlay')].filter((e) => !e.hidden).map((e) => e.id), cm: window.__oreum.cam.mode, hp: [window.__oreum.hp.isDown, window.__oreum.hp.pending], kn: window.__oreum.player.knock, res: !!window.__oreum.player.rescue, panels: ['omap', 'sign', 'wishes', 'chat', 'actions', 'menu', 'ach', 'dex', 'feedback', 'notes', 'shoppop', 'rank', 'inbox', 'zdone', 'wake-pick', 'quest', 'qlog', 'xmas', 'mate-talk', 'aug-pick', 'nickwin'].filter((i) => !document.getElementById(i).hidden), intro: !document.getElementById('intro').hidden, fr: window.__oreum.renderer.info.render.frame, t: window.__toasts, w: window.__oreum.save.wishes, pose: window.__oreum.player.pose, tgt: !!window.__oreum.player.target, p: window.__oreum.player.pos })));
  const srv = await fetch(SRV + '/wish?c=' + cid, { headers: { Origin: 'http://127.0.0.1:5173' } }).then((r) => r.json());
  const aw = srv.list.find((w) => w.text === '우리 가족 모두 건강하게');
  ok(!!aw, `서버에 저장됨 (${cid}, ${aw?.nick})`);

  const B = await open('B');
  await go(B.p);
  const c0 = await B.p.evaluate(() => window.__oreum.save.coins);
  await B.p.evaluate(() => window.__oreum.wish.open(window.__oreum.cairns[0]));
  ok(await until(B.p, (t) => [...document.querySelectorAll('#wish-list .wish span')].some((e) => e.textContent === t), aw.text, 10000), 'B: 창에 A 의 소원이 보임');
  ok(await B.p.evaluate(() => /돌 [1-9]/.test(document.getElementById('wish-count').textContent)), 'B: 남의 소원도 돌로 셈');
  if (process.env.DBG) console.log(await B.p.evaluate(() => ({ cnt: document.getElementById('wish-count').textContent, fl: { ...window.__oreum.wish.float }, st: [...window.__oreum.social.stones.entries()].map(([k, v]) => [k, v.length]), hid: document.hidden })));
  await B.p.evaluate(() => document.querySelector('#wish-list .wish-pray').click());
  ok(await until(B.p, ([c, g]) => window.__oreum.save.coins >= c + g, [c0, WISH.prayGyul], 10000), `B: 함께 기도 → 귤 +${WISH.prayGyul}`);
  ok(await until(B.p, () => (window.__toasts || []).some((t) => t.includes('함께 빌었어요')), null, 3000), 'B: 함께 빌었어요 토스트');
  ok(await until(B.p, () => window.__oreum.wish.float.i > 0, null, 8000), `B: 돌탑 ${WISH.near}m 안에서 소원이 떠오름`);
  if (process.env.DBG) console.log(await B.p.evaluate(() => { const o = window.__oreum, c = o.cairns[0]; return { fl: { ...o.wish.float }, d: Math.hypot(c.pos.x - o.player.pos.x, c.pos.z - o.player.pos.z), hid: document.hidden, cache: [...o.wish.cache.keys()], ready: o.net.ready, intro: !document.getElementById('intro').hidden }; }));
  await B.p.evaluate(() => window.__oreum.wish.open(window.__oreum.cairns[0]));
  await until(B.p, () => document.querySelector('#wish-list .wish-pray[aria-pressed="true"]'), null, 8000);
  await B.p.evaluate(() => document.querySelector('#wish-list .wish-pray').click());
  ok(await until(B.p, () => (window.__toasts || []).some((t) => t.includes('오늘은 이 소원에')), null, 3000), 'B: 같은 소원 두 번째는 안 됨');

  // A 다시 들어오기 → 내 돌탑 소식
  const a0 = await A.p.evaluate(() => window.__oreum.save.coins);
  await A.p.evaluate(() => { window.__old = 1; location.reload(); });
  await until(A.p, () => !window.__old && window.__oreum?.renderer?.info.render.frame > 2, null, 180000);
  await A.p.evaluate(() => { window.__toasts = []; new MutationObserver(() => { const e = document.getElementById('msg-log'); if (e && e.textContent) window.__toasts.push(e.textContent); }).observe(document.body, { subtree: true, childList: true, characterData: true }); });
  for (let k = 0; k < 20 && (await A.p.evaluate(() => !document.getElementById('intro').hidden)); k++) { await A.p.evaluate(() => document.getElementById('enter').click()).catch(() => {}); await wait(A.p, 1500); }
  ok(await until(A.p, () => (window.__toasts || []).some((t) => t.includes('함께 빌어 줬어요')), null, 20000), "A: 다시 들어오면 '1명이 내 소원에 함께 빌어 줬어요'");
  ok(await until(A.p, ([c, g]) => window.__oreum.save.coins >= c + g, [a0, WISH.gotGyul], 5000), `A: 쓴 사람 귤 +${WISH.gotGyul}`);
  // B 신고 (두 번 눌러야)
  await B.p.evaluate(() => window.__oreum.wish.open(window.__oreum.cairns[0]));
  await until(B.p, () => document.querySelector('#wish-list .wish-rep'), null, 8000); await wait(B.p, 3000); // 창이 서버 목록으로 다시 그려진 뒤
  await B.p.evaluate(() => document.querySelector('#wish-list .wish-rep').click());
  ok(await B.p.evaluate(() => !!document.querySelector('#wish-list .wish-rep[data-sure]')), 'B: 신고는 한 번 더 눌러야');
  const nRep = await B.p.evaluate(() => document.querySelectorAll('#wish-list .wish-rep').length);
  await B.p.evaluate(() => document.querySelector('#wish-list .wish-rep').click());
  ok(await until(B.p, (n) => document.querySelectorAll('#wish-list .wish-rep').length === n - 1, nRep, 5000), 'B: 신고하면 목록에서 빠짐');
  await b.close(); web.close();
  process.exit(process.exitCode || 0);
})().catch((e) => { console.error(e); process.exit(1); });
