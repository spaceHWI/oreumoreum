// 멀티 확인 (#7): node tools/online.js [서버주소=http://127.0.0.1:8787] [deer: 노루(#92)만]
// 로컬 서버(cd server && npm run dev, 가짜 로그인 켬)에 브라우저 둘을 붙여 서로 보이는지, 더미를 주우면 다른 쪽에도 줄어드는지,
// 가짜 로그인 → 계정 저장 → 귤 부풀리기가 서버에서 바로잡히는지 본다
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const SRV = process.argv[2] || 'http://127.0.0.1:8787', ONLY = process.argv[3] || '';
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
    await ctx.route(/^https:\/\//, (r) => r.abort()); // 바깥(글꼴·구글 로그인·날씨)은 막음: 막힌 환경에서 load 가 멈추지 않게
    const p = await ctx.newPage(); p.setDefaultNavigationTimeout(180000); // 소프트웨어 GL 둘이 같이 돌면 느림
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
  // 노루 (#92): 노루 무리는 방장(A) 화면이 주인, 누가 어느 노루를 탔는지는 방이 관리
  {
    await wait(A.p, 1500);
    const bId = await B.p.evaluate(() => window.__oreum.net.myPeer);
    ok(await A.p.evaluate(() => window.__oreum.deerNet().host) && await B.p.evaluate(() => !window.__oreum.deerNet().host && window.__oreum.life.remote), '노루 방장은 먼저 온 A, B 는 받기만');
    const pos = (X) => X.p.evaluate(() => Object.fromEntries(window.__oreum.life.deer.map((d) => [d.id, [d.pos.x, d.pos.z]])));
    const [pa, pb] = await Promise.all([pos(A), pos(B)]);
    const ids = Object.keys(pa).filter((k) => k[0] === 'h'); let worst = 0; for (const k of ids) worst = Math.max(worst, pb[k] ? Math.hypot(pa[k][0] - pb[k][0], pa[k][1] - pb[k][1]) : 1e9);
    ok(ids.length > 0 && worst < 4, `노루 위치가 두 화면에서 같음 (${ids.length}마리, 가장 큰 차이 ${worst.toFixed(2)}m)`);
    // B 가 노루를 탐 → A 화면에서 그 노루가 B 를 태우고 같이 움직임
    const id = ids[0];
    await B.p.evaluate((id) => { const o = window.__oreum, d = o.life.deerById(id); o.player.pos.set(d.pos.x + 2, d.pos.y, d.pos.z); }, id);
    await A.p.evaluate((id) => { const o = window.__oreum, d = o.life.deerById(id); o.player.pos.set(d.pos.x - 5, d.pos.y, d.pos.z + 5); o.player.heading = Math.atan2(3.5, -4); }, id);
    await wait(B.p, 800);
    await B.p.evaluate((id) => { const o = window.__oreum; o.lifeModels.mount(o.life.deer.findIndex((d) => d.id === id)); }, id);
    await wait(B.p, 1200);
    ok(await B.p.evaluate((id) => window.__oreum.player.riding?.id === id, id), `B 가 노루 ${id} 를 탐 (방이 허락)`);
    await B.p.evaluate(() => { const d = window.__oreum.player.riding; d.pos.x -= 1.5; d.pos.z += 1; d.heading = 2.2; });
    await wait(A.p, 1500);
    const seen = await A.p.evaluate(({ id, bId }) => { const o = window.__oreum, d = o.life.deerById(id), e = o.net.peersById.get(bId); return { rider: o.deerNet().rides.get(id), st: d.state, dr: e?.data.dr, gap: e ? Math.hypot(d.pos.x - e.pos.x, d.pos.z - e.pos.z) : -1, lift: e ? e.runner.root.position.y - e.pos.y : 0 }; }, { id, bId });
    const bp = await B.p.evaluate(() => { const d = window.__oreum.player.riding; return [d.pos.x, d.pos.z]; });
    const ap = await A.p.evaluate((id) => { const d = window.__oreum.life.deerById(id); return [d.pos.x, d.pos.z]; }, id);
    ok(seen.rider === bId && seen.st === 'ridden' && seen.dr === id && seen.gap < 0.3 && seen.lift > 0.6 && Math.hypot(ap[0] - bp[0], ap[1] - bp[1]) < 1, `A 화면: B 가 노루에 걸터앉아 같이 움직임 (${JSON.stringify(seen)}, 차이 ${Math.hypot(ap[0] - bp[0], ap[1] - bp[1]).toFixed(2)}m)`);
    await A.p.screenshot({ path: 'dist/deer-ride-a.png' }); await B.p.screenshot({ path: 'dist/deer-ride-b.png' });
    // 같은 노루를 A 가 타려 하면: 화면에서 바로 막고, 화면 기록을 지워 억지로 물어도 방이 거절
    const tryA = async () => { await A.p.evaluate((id) => { const o = window.__oreum; window.__toasts = []; const t = document.getElementById('toast'); window.__tob?.disconnect(); window.__tob = new MutationObserver(() => window.__toasts.push(t.textContent)); window.__tob.observe(t, { childList: true, characterData: true, subtree: true }); o.lifeModels.mount(o.life.deer.findIndex((d) => d.id === id)); }, id); await wait(A.p, 1000); return A.p.evaluate(() => ({ riding: !!window.__oreum.player.riding, t: window.__toasts.join('/') })); };
    let r = await tryA(); ok(!r.riding && /다른 사람이 타고/.test(r.t), `같은 노루를 둘이 못 탐: 화면에서 막음 (${r.t})`);
    await A.p.evaluate(() => window.__oreum.deerNet().rides.clear());
    r = await tryA(); ok(!r.riding && /다른 사람이 타고/.test(r.t), `같은 노루를 둘이 못 탐: 방이 거절 (${r.t})`);
    await wait(A.p, 500);
    // B 가 내림 → 풀림
    await B.p.evaluate(() => window.__oreum.lifeModels.dismount()); await wait(A.p, 1200);
    ok(await A.p.evaluate((id) => { const o = window.__oreum; return o.deerNet().rides.size === 0 && o.life.deerById(id).state !== 'ridden'; }, id), '내리면 풀림');
    // 노루가 지나감 (#89): 받는 쪽(B)이 방장에게 부탁 → 두 화면에 같은 노루
    const n0 = await A.p.evaluate(() => window.__oreum.life.deer.length);
    await B.p.evaluate(() => { const o = window.__oreum; o.deerNet().askVisit(o.player.pos.x + 14, o.player.pos.z + 6); });
    let vis = []; for (let k = 0; k < 20; k++) { await wait(B.p, 500); vis = await Promise.all([A, B].map((X) => X.p.evaluate(() => window.__oreum.life.deer.map((d) => d.id).sort().join(',')))); if (vis[0] === vis[1] && vis[0].split(',').length === n0 + 2) break; } // 소프트웨어 GL 둘이면 프레임이 느림
    ok(vis[0].split(',').length === n0 + 2 && vis[0] === vis[1], `노루가 지나감도 두 화면에 같이 (${n0} → ${vis[0].split(',').length}, 같음 ${vis[0] === vis[1]})`);
    // 귤 먹이: B 가 던진 귤을 방장 화면의 노루가 먹고 B 를 따라감
    const fid = ids[1] || ids[0];
    await B.p.evaluate((fid) => { const o = window.__oreum, d = o.life.deerById(fid); window.__toasts = []; const t = document.getElementById('toast'); new MutationObserver(() => window.__toasts.push(t.textContent)).observe(t, { childList: true, characterData: true, subtree: true }); const T = o.life.deer[0].pos.constructor; o.life.throwTangerine(new T(d.pos.x + 3, d.pos.y + 1.2, d.pos.z), new T(-1, 0, 0), 2); }, fid);
    let fed = null; for (let k = 0; k < 90 && !fed?.ok; k++) { await wait(A.p, 500); fed = await A.p.evaluate(({ fid, bId }) => { const d = window.__oreum.life.deerById(fid); return { ok: d.state === 'follow' && d.followWho === bId, st: d.state }; }, { fid, bId }); }
    for (let k = 0; k < 20 && !(await B.p.evaluate(() => /귤을 먹고/.test(window.__toasts.join('/')))); k++) await wait(B.p, 500);
    const bt = await B.p.evaluate(() => window.__toasts.join('/'));
    if (!fed?.ok) console.log('  ', await A.p.evaluate((fid) => { const d = window.__oreum.life.deerById(fid); return JSON.stringify({ st: d.state, tg: d.target && { eatT: d.target.eatT, eaten: d.target.eaten, feeder: d.target.feeder }, fu: d.followUntil, fw: d.followWho, t: performance.now() / 1000 }); }, fid));
    ok(fed?.ok && /귤을 먹고/.test(bt), `B 가 던진 귤을 노루가 먹고 B 를 따라감 (${fed?.st} · ${bt})`);
  }
  if (ONLY === 'deer') {
    // 타는 중 접속이 끊기면 풀림
    const id = await A.p.evaluate(() => window.__oreum.life.deer.find((d) => d.state !== 'ridden' && d.state !== 'follow').id);
    await B.p.evaluate((id) => { const o = window.__oreum; o.lifeModels.mount(o.life.deer.findIndex((d) => d.id === id)); }, id); await wait(B.p, 1200);
    const on = await A.p.evaluate((id) => window.__oreum.deerNet().rides.has(id), id);
    await B.ctx.close(); await wait(A.p, 2000);
    ok(on && await A.p.evaluate((id) => { const o = window.__oreum; return !o.deerNet().rides.has(id) && o.life.deerById(id).state !== 'ridden'; }, id), '타는 중 끊기면 노루가 풀림');
    await A.ctx.close(); await b.close(); web.close(); return;
  }
  // 가짜 로그인 → 계정 사본으로 새로고침
  await A.p.evaluate(() => { window.__oreum.save.coins = 40; });
  await A.p.evaluate(() => { window.__old = 1; window.__oreum.online.fake('tester-' + Date.now()); }); // __old: 새로 고친 뒤의 페이지인지 가리려고
  await A.p.waitForFunction(() => document.querySelector('#acct-ask [data-v="1"]'), null, { timeout: 15000 }).then(() => A.p.evaluate(() => document.querySelector('#acct-ask [data-v="1"]').click())).catch((e) => console.log('  (옮기기 창 없음)', e.message.slice(0, 80)));
  for (let k = 0; k < 180; k++) { await wait(A.p, 1000); if (await A.p.evaluate(() => !window.__old && !!(window.__oreum?.online?.account?.()?.loggedIn && window.__oreum.renderer.info.render.frame > 2)).catch(() => false)) break; }
  await wait(A.p, 2000);
  ok(await A.p.evaluate(() => window.__oreum.online.account().loggedIn), '로그인됨');
  ok(await A.p.evaluate(() => window.__oreum.save.coins === 40), '기기 기록을 계정으로 옮김 (귤 40)');
  ok(await A.p.evaluate(() => !document.getElementById('m-acct').hidden && /일 남음/.test(document.getElementById('acct-days').textContent)), '메뉴: 남은 날짜');
  // 귤 부풀리기 → 서버가 바로잡음
  await A.p.evaluate(() => { const o = window.__oreum; o.save.coins = 999999; return o.online.account().push(); });
  await wait(A.p, 500);
  const c = await A.p.evaluate(() => window.__oreum.save.coins);
  ok(c < 999999 && c <= 40 + 1500 + 10, `귤 부풀리기 바로잡힘 (${c})`);
  // 보안 (#84)
  if (await A.p.evaluate(() => !document.getElementById('intro').hidden)) { await A.p.click('#enter').catch(() => {}); await wait(A.p, 500); await A.p.click('#srv-go').catch(() => {}); }
  for (let k = 0; k < 30 && !(await A.p.evaluate(() => window.__oreum.net.ready)); k++) await wait(A.p, 1000);
  ok(await A.p.evaluate(() => window.__oreum.net.ready), '로그인한 채로 방에 붙음 (토큰은 하위 프로토콜)');
  ok(await A.p.evaluate(() => document.getElementById('m-dev').hidden), '서버가 있으면 어드민이 아닌 계정에 개발자 메뉴 없음');
  // 순간 이동 두 번 → 서버가 되돌림
  await A.p.evaluate(() => { const o = window.__oreum; o.player.pos.x += 300; }); await wait(A.p, 700);
  await A.p.evaluate(() => { const o = window.__oreum; o.player.pos.x -= 300; }); await wait(A.p, 700); // 한 번은 받아 줌 (들것 귀환 같은 것)
  const x0 = await A.p.evaluate(() => window.__oreum.player.pos.x);
  await A.p.evaluate(() => { const o = window.__oreum; o.player.pos.x += 300; }); await wait(A.p, 1500);
  const x1 = await A.p.evaluate(() => window.__oreum.player.pos.x);
  ok(Math.abs(x1 - x0) < 30, `잦은 순간 이동은 서버가 되돌림 (${x0.toFixed(0)} → ${x1.toFixed(0)})`);
  // 너무 빠른 줍기(초당 NET.takePerSec 넘게) → 방이 거절 → 배낭·누적 수에서 되돌림
  const undo = await A.p.evaluate(async () => {
    const t = window.__oreum.trash.api, st = t.store, n = t.heaps.length;
    let h = 0; for (let i = 1; i < n; i++) if (st.left(i) > st.left(h)) h = i;
    const sum = () => Object.values(st.bag).reduce((a, b) => a + b, 0);
    const bag0 = sum(), tot0 = st.totalCount(), left0 = st.left(h);
    let took = 0; for (let k = 0; k < 12; k++) if (t.take({ h }, 99)) took++;
    await new Promise((ok) => setTimeout(ok, 1500));
    return { h, left0, took, kept: sum() - bag0, tot: st.totalCount() - tot0 };
  });
  ok(undo.took === 12 && undo.kept <= 7 && undo.kept >= 5 && undo.tot === undo.kept, `방이 거절한 줍기는 배낭에서 되돌림 (${JSON.stringify(undo)})`);
  // 랭킹 (#11): 버리면 저장을 바로 보내고 오늘 순위가 오르면 토스트, 순위표에 내 줄, 손님은 이 기기 기록만
  await wait(A.p, 4000); // 앞의 줍기 몫(초당 takePerSec)이 지나가게
  const nick = await A.p.evaluate(() => { const o = window.__oreum; o.save.nick = '랭킹확인' + (Date.now() % 1000); const st = o.trash.api.store; let h = 0; for (let i = 1; i < o.trash.api.heaps.length; i++) if (st.left(i) > st.left(h)) h = i; for (let k = 0; k < 3; k++) o.trash.api.take({ h }, 99); return o.save.nick; });
  await wait(A.p, 1200);
  const rk0 = await A.p.evaluate(() => window.__oreum.rank.state().last[window.__oreum.server.id()]?.rank ?? -1); // 들어올 때 잡은 기준 순위
  await A.p.evaluate(() => { const o = window.__oreum; o.trash.api.store.bag.can = (o.trash.api.store.bag.can || 0) + 3; window.__toasts = []; const t = document.getElementById('toast'); new MutationObserver(() => window.__toasts.push(t.textContent)).observe(t, { childList: true, characterData: true, subtree: true }); o.cleanhouse.dump(); });
  for (let k = 0; k < 240 && !(await A.p.evaluate(() => window.__toasts.some((x) => /오늘 .*위/.test(x)))); k++) await wait(A.p, 250); // 소프트웨어 GL 둘이면 느림
  const tl = await A.p.evaluate(() => window.__toasts.filter((x) => /위/.test(x)));
  const rk1 = await A.p.evaluate(() => window.__oreum.online.account().rankMe(window.__oreum.server.id()).then((r) => r.day.rank));
  if (!rk0 || rk1 < rk0) ok(tl.some((x) => x === (rk0 ? `오늘 ${rk0}위 → ${rk1}위` : `오늘 ${rk1}위`)), `버린 뒤 순위가 오르면 토스트 (${rk0} → ${rk1}: ${tl.join(' / ')})`);
  else ok(!tl.length, `순위가 그대로면 토스트 없음 (${rk0} → ${rk1})`);
  ok(await A.p.evaluate(() => { const B = window.__oreum.save.ach.badges; return !!(B['b-rank-10'] || B['b-rank-1']); }), '업적: rank-top10 / rank-top1');
  const listed = async () => { for (let k = 0; k < 60 && (await A.p.evaluate(() => /불러오는/.test(document.getElementById('rank-note').textContent))); k++) await wait(A.p, 250); };
  await A.p.evaluate(() => window.__oreum.rank.open('clean')); await listed();
  const rk = await A.p.evaluate(() => { const me = document.querySelector('#rank-list .rk-row.me'); return { me: me && me.querySelector('.rk-nick').textContent, no: me && me.querySelector('.rk-no').textContent, rows: document.querySelectorAll('#rank-list .rk-row').length, medal: !!document.querySelector('#rank-list .rk-row.m1'), note: document.getElementById('rank-note').textContent }; });
  ok(rk.me === nick && +rk.no >= 1 && rk.medal, `순위표에 내 줄·1위 메달 (${JSON.stringify(rk)})`);
  await A.p.evaluate(() => document.querySelector('#rank-range [data-v="all"]').click()); await listed();
  ok(await A.p.evaluate(() => !!document.querySelector('#rank-list .rk-row.me')), '전체 탭에도 내 줄');
  await A.p.evaluate(() => document.querySelector('#rank-srv [data-v="battle"]').click()); await listed();
  ok(await A.p.evaluate(() => { const me = document.querySelector('#rank-list .rk-row.me'); return !me || me.classList.contains('out'); }), '전투 오름 탭: 치운 적 없으면 내 줄은 아래 따로');
  await A.p.setViewportSize({ width: 390, height: 640 }); await A.p.evaluate(() => document.querySelector('#rank-srv [data-v="clean"]').click()); await listed(); await wait(A.p, 800);
  await A.p.screenshot({ path: 'dist/rank-online.png' });
  await B.p.evaluate(() => window.__oreum.rank.open()); await wait(B.p, 500);
  ok(await B.p.evaluate(() => document.querySelectorAll('#rank-list .rk-mine').length === 3 && /로그인하면/.test(document.getElementById('rank-note').textContent)), '손님: 이 기기 기록 셋과 로그인 안내');
  await A.ctx.close(); await B.ctx.close(); await b.close(); web.close();
})().catch((e) => { console.error(e); process.exit(1); });
