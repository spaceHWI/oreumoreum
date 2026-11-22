// 멀티 확인 (#7): node tools/online.js [서버주소=http://127.0.0.1:8787] [deer: 노루(#92)만 | cart: 지나가는 마차(#120)만 | raid: 레이드(#181)만 | cave: 동굴 칸(#195)·동굴 적 같이 보기(#205)만]
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
  const { NET } = await import('../src/balance.js'); const { ZONE_GYUL, HEAP_DEFS } = await import('../server/src/heaps.js'); // 몫·줍기 한도는 balance.js 값으로 (#144)
  const until = async (X, fn, arg, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await X.p.evaluate(fn, arg).catch(() => false)) return true; await wait(X.p, 250); } return false; }; // 느린 환경: 고정 시간 대신 조건이 될 때까지
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
    // 오래 멈춤(#157): 검사 화면은 손을 대지 않으므로 8분 뒤 서버가 닫고(4004) 클라이언트도 쉬러 감 → 뒤쪽 검사(노루 먹이·엔딩)가 B 에 닿지 않던 원인 (#193). 조작이 있는 것처럼 둠
    await p.evaluate(() => { const i = window.__oreum.idle; if (!i) return; i.set({ warn: 1e6, rest: 1e6, hidden: 1e6 }); setInterval(() => i.act?.(), 20000); });
    console.log(name, 'ready');
    return { ctx, p };
  };
  const A = await open('A'), B = await open('B');
  const raidCheck = async () => { // 오름 레이드 (#181): A 가 바로 열고(로컬 서버 STATS_OPEN) 둘이 같이 → B 가 맞히면 A 화면에서도 기운이 줆 → 부서진 더미 줍기 → 둘 다 보상. 다시 열고 방장 A 가 나가면 B 가 이어받음
    await A.p.setViewportSize({ width: 480, height: 320 });
    await A.p.evaluate(() => { const o = window.__oreum; o.player.pose = 'throw'; o.player.poseT = 0; o.player.pos.x += 0.3; });
    ok(await until(B, () => window.__oreum.peerFight().some((p) => p.on), null, 10000), "A 가 던지면 B 화면 A 머리 위에 '전투 중'");
    for (const X of [A, B]) await X.p.evaluate(() => { window.__oreum.raid.go(12 + Math.random() * 4); });
    await A.p.evaluate(() => window.__oreum.raid.start());
    ok(await until(A, () => window.__oreum.raid.state().ph === 2 && window.__oreum.raid.state().body, null, 40000) && await until(B, () => window.__oreum.raid.state().ph === 2 && window.__oreum.raid.state().body, null, 20000), '레이드: 둘 다 같은 대왕을 봄');
    const rs = await Promise.all([A, B].map((X) => X.p.evaluate(() => window.__oreum.raid.state())));
    ok(rs[0].host !== rs[1].host && rs.some((r) => r.puppet), `한 사람이 굴리고 다른 사람은 받아서 그림 (방장 ${rs.map((r) => r.host)}, 받음 ${rs.map((r) => r.puppet)})`);
    const hp0 = rs[0].hp; await B.p.evaluate(() => window.__oreum.raid.hit(200));
    ok(await until(A, (h) => window.__oreum.raid.state().hp < h - 100, hp0, 10000), 'B 가 맞히면 A 화면에서도 기운이 줆');
    const c0 = await Promise.all([A, B].map((X) => X.p.evaluate(() => window.__oreum.save.coins)));
    for (let k = 0; k < 80 && (await A.p.evaluate(() => window.__oreum.raid.state().ph)) === 2; k++) { for (const X of [A, B]) await X.p.evaluate(() => window.__oreum.raid.hit(150)); await wait(A.p, 400); }
    ok(await until(B, () => window.__oreum.raid.state().ph === 3 && window.__oreum.raid.state().heaps === 8, null, 10000), '기운 0 → 둘 다 부서진 더미 8개');
    const hs = await A.p.evaluate(() => window.__oreum.raid.heaps());
    for (let i = 0; i < hs.length; i++) { const X = i % 2 ? B : A; for (let k = 0; k < 40 && !(await until(X, (i) => !(window.__oreum.raid.state().h || [])[i], i, 300)); k++) await X.p.evaluate((i) => window.__oreum.raid.pick(i), i); } // 소프트웨어 GL 은 느려 걸어 줍기(tools/raid.js)는 시간 안에 못 끝냄: 방에 바로 줍기
    ok(await until(A, () => window.__oreum.raid.state().ph === 4, null, 10000), '더미를 다 주우면 성공');
    const c1 = await Promise.all([A, B].map((X) => X.p.evaluate(() => window.__oreum.save.coins)));
    ok(c1[0] - c0[0] >= 3000 && c1[1] - c0[1] >= 3000, `둘 다 보상 (A +${c1[0] - c0[0]}, B +${c1[1] - c0[1]})`);
    // 이어받기: 다시 열고 싸움 중에 방장(A)이 나감
    await wait(A.p, 16000); await A.p.evaluate(() => { window.__oreum.raid.go(14); window.__oreum.raid.start(); }); await B.p.evaluate(() => window.__oreum.raid.go(14));
    await until(B, () => window.__oreum.raid.state().ph === 2 && window.__oreum.raid.state().body, null, 30000);
    await B.p.evaluate(() => window.__oreum.raid.hit(300)); await wait(B.p, 1500);
    const hb = await B.p.evaluate(() => window.__oreum.raid.state().hp);
    await A.ctx.close(); A.closed = true;
    ok(await until(B, () => { const s = window.__oreum.raid.state(); return s.host && s.body && !s.puppet; }, null, 20000), '방장이 나가면 B 가 이어받아 굴림');
    const hb2 = await B.p.evaluate(() => window.__oreum.raid.state());
    ok(hb2.ph === 2 && hb2.hp <= hb + 1, `이어받아도 기운은 그대로 (${hb} → ${hb2.hp}, 다시 가득 차지 않음)`);
  };
  const caveCheck = async () => { // 동굴 같이 들어가기 (#195 4번 조각): 같은 날·같은 층 사람끼리만 보이고, 오름 사람에게 동굴 사람은 안 보임
    await A.p.evaluate(() => window.__oreum.cave.enter());
    const hid = await until(B, () => { const l = [...window.__oreum.net.peersById.values()]; return l.length > 0 && l.every((e) => !e.runner.root.visible && e.ck); }, null, 15000);
    await B.p.evaluate(() => window.__oreum.cave.enter());
    const at = await A.p.evaluate(() => { const o = window.__oreum; o.cave.goPile(0); return [o.player.pos.x, o.player.pos.z]; });
    const see = await until(B, ([x, z]) => [...window.__oreum.net.peersById.values()].some((e) => e.runner.root.visible && e.runner.root.parent?.name === 'cave' && Math.hypot(e.tpos.x - x, e.tpos.z - z) < 1.5), at, 15000);
    let shIds = [];
    { // 동굴 적 같이 보기 (#205): 먼저 들어온 A 가 칸 주인. A 가 깨운 적을 B 도 같은 번호로 봄 → B 가 맞히면 A 화면에서도 기운이 줆
      ok(await until(A, () => window.__oreum.cave.share().host && window.__oreum.cave.share().hostKey === window.__oreum.cave.share().key, null, 10000) && await until(B, () => { const s = window.__oreum.cave.share(); return !s.host && s.hostKey === s.key && s.hostId; }, null, 10000), '동굴 칸 주인: 먼저 들어온 A, B 는 받는 쪽');
      const nA = await A.p.evaluate(() => window.__oreum.cave.wakeAll());
      await until(A, () => { const l = window.__oreum.cave.netMobs(); return l.length > 0 && l.every((e) => e.nid != null); }, null, 10000); // 번호는 같은 칸 사람이 있을 때 보내면서 붙음
      const ids = await A.p.evaluate(() => window.__oreum.cave.netMobs().filter((e) => e.state !== 'flee' && e.state !== 'leave').map((e) => e.nid));
      shIds = ids;
      const same = await until(B, (ids) => { const l = window.__oreum.cave.netMobs(); return ids.length > 0 && l.length > 0 && l.every((e) => e.net) && ids.filter((i) => l.some((e) => e.nid === i)).length >= ids.length - 1; }, ids, 15000);
      const bl = await B.p.evaluate(() => window.__oreum.cave.netMobs());
      ok(nA > 0 && same, `동굴 적: A 가 깨운 ${nA}마리를 B 도 같은 번호로 봄 (B ${bl.length}마리, 모두 받은 것 ${bl.every((e) => e.net)})`);
      const tg = bl.find((e) => e.state !== 'flee' && e.hp > 25) || bl[0];
      const h0 = await A.p.evaluate((n) => window.__oreum.cave.netMobs().find((e) => e.nid === n)?.hp, tg?.nid);
      if (tg) await B.p.evaluate((n) => window.__oreum.cave.hitNet(n, 20), tg.nid);
      ok(tg && await until(A, ([n, h]) => { const e = window.__oreum.cave.netMobs().find((o) => o.nid === n); return !!e && (e.hp <= h - 15 || e.state === 'flee'); }, [tg.nid, h0], 10000), `B 가 맞히면 A 화면에서도 기운이 줆 (${tg?.kind} ${h0} → ${await A.p.evaluate((n) => window.__oreum.cave.netMobs().find((e) => e.nid === n)?.hp, tg?.nid)})`);
      ok(await until(B, ([n, h]) => { const e = window.__oreum.cave.netMobs().find((o) => o.nid === n); return !!e && (e.hp <= h - 15 || e.state === 'flee'); }, [tg?.nid, h0], 10000), 'B 화면에서도 칸 주인이 셈한 기운');
    }
    await A.p.evaluate(() => window.__oreum.cave.down());
    const hid2 = await until(B, () => [...window.__oreum.net.peersById.values()].every((e) => !e.runner.root.visible), null, 15000);
    ok(await until(B, (ids) => { const s = window.__oreum.cave.share(), l = window.__oreum.cave.netMobs(); return s.host && s.mode === 'host' && l.length > 0 && l.every((e) => !e.net) && l.some((e) => ids.includes(e.nid)); }, shIds, 15000), '동굴 칸 주인 A 가 아래층으로 가면 B 가 받던 적을 같은 번호로 이어 굴림 (#205)');
    await A.p.evaluate(() => window.__oreum.cave.exit()); await B.p.evaluate(() => window.__oreum.cave.exit());
    const back = await until(B, () => [...window.__oreum.net.peersById.values()].some((e) => e.runner.root.visible && e.runner.root.parent?.type === 'Scene' && e.runner.root.parent?.name !== 'cave' && !e.ck), null, 15000);
    ok(hid && see && hid2 && back, `동굴 칸: 오름 B 에겐 동굴 A 가 안 보임 ${hid} · 같이 들어가면 보임 ${see} · A 가 아래층이면 안 보임 ${hid2} · 둘 다 나오면 다시 보임 ${back}`);
  };
  ok(await A.p.evaluate(() => document.getElementById('enter').textContent === '손님으로 하기' && !document.getElementById('acct-box').hidden), '첫 화면: 손님으로 하기·베타 안내');
  ok(await A.p.evaluate(() => /7일/.test(document.getElementById('acct-box').textContent)), '베타 안내 문구');
  for (const X of [A, B]) { await X.p.evaluate(() => document.getElementById('enter').click()) /* 화면 셋이 소프트웨어 GL 로 돌면 page.click 이 프레임을 기다리다 30초를 넘김 (#193) */; await wait(X.p, 500); }
  ok(await until(A, () => window.__oreum.net.ready && window.__oreum.net.count === 1), 'A 가 B 를 봄');
  ok(await until(B, () => window.__oreum.net.count === 1), 'B 가 A 를 봄');
  if (ONLY === 'cart') { // 지나가는 마차 (#120): A 가 달리는 마차에 타면 B 화면에도 앉은 모습, B 는 A 가 앉은 자리를 피해 앉음
    const run = (X) => X.p.evaluate(() => { const o = window.__oreum, c = o.rides.cart.api; for (let t = 0; t < 240; t += 0.5) { o.rides.cart.shift(t); c.update(0, Date.now() / 1000 + t); if (c.state.moving && c.state.speed > 2 && c.state.left > 20) return t; } return null; });
    const t = await run(A); await B.p.evaluate((t) => window.__oreum.rides.cart.shift(t), t);
    const side = () => { const o = window.__oreum, c = o.rides.cart.api, h = c.heading; o.keys.clear(); o.tp(c.pos.x + Math.cos(h) * 2.4, c.pos.z - Math.sin(h) * 2.4, h); o.rides.cart.board(); return o.player.cart && o.player.cart.seat; };
    const sa = await A.p.evaluate(side); await wait(A.p, 1500);
    ok(sa != null && await until(B, () => [...window.__oreum.net.peersById.values()].some((e) => e.data.rd === 'cart')), `A 가 달리는 마차에 타면 B 에게 '마차' 로 보임 (자리 ${sa})`);
    const near = await B.p.evaluate(() => { const o = window.__oreum, c = o.rides.cart.api, e = [...o.net.peersById.values()][0]; return +Math.hypot(e.tpos.x - c.pos.x, e.tpos.z - c.pos.z).toFixed(1); });
    ok(near < 3, `B 화면에서 A 는 마차 위 (${near}m)`);
    const sb = await B.p.evaluate(side);
    ok(sb != null && sb !== sa, `B 는 A 의 자리를 피해 앉음 (A ${sa} · B ${sb})`);
    const off = await A.p.evaluate(() => { const o = window.__oreum, m = o.rides.cart.api.state.moving; o.rides.cart.leave(false); return m && !o.player.cart && o.rides.state().road; });
    ok(off && await until(B, () => [...window.__oreum.net.peersById.values()].every((e) => e.data.rd !== 'cart')), 'A 가 달리는 중 내리면 B 화면에서도 내림');
    await A.ctx.close(); await B.ctx.close(); await b.close(); web.close(); return;
  }
  { // 지금 접속 (#186): 두 명이 들어오면 2 (로컬 서버는 STATS_OPEN 이라 로그인 없이 볼 수 있음)
    let o = null; for (let i = 0; i < 20 && !(o && o.n >= 2); i++) { o = await fetch(SRV + '/admin/online', { headers: { Origin: 'http://127.0.0.1:5173' } }).then((r) => r.json()).catch(() => null); if (!(o && o.n >= 2)) await wait(A.p, 250); }
    const ns = (o?.rooms || []).find((r) => r.map === 'namsongi');
    ok(o && o.n === 2 && ns && ns.n === 2 && o.peak.n >= 2, `지금 접속 2명 (${JSON.stringify(o && { n: o.n, rooms: o.rooms, peak: o.peak.n })})`);
  }
  if (ONLY === 'cave') { await caveCheck(); await A.ctx.close(); await B.ctx.close(); await b.close(); web.close(); return; } // node tools/online.js <서버> cave: 동굴 칸만 (#195)
  if (ONLY === 'raid') { await raidCheck(); if (!A.closed) await A.ctx.close(); await B.ctx.close(); await b.close(); web.close(); return; } // node tools/online.js <서버> raid: 레이드만 (#181)
  { // 옷·닉네임은 바뀔 때만 보냄 (#115): A 가 보내는 것을 세고, 옷을 바꾸면 B 화면에 바로
    await A.p.evaluate(() => { window.__sent = []; const s0 = WebSocket.prototype.send; WebSocket.prototype.send = function (d) { if (typeof d === 'string' && d.startsWith('{"t":"p"')) window.__sent.push(d); return s0.call(this, d); }; window.__sent0 = performance.now(); });
    for (let k = 0; k < 6; k++) { await A.p.evaluate(() => { window.__oreum.player.pos.x += 0.5; }); await wait(A.p, 200); }
    const s1 = await A.p.evaluate(() => ({ n: __sent.length, withO: __sent.filter((d) => d.includes('"o":')).length, ms: performance.now() - __sent0 }));
    const hat = await A.p.evaluate(() => { const o = window.__oreum.save.outfit; o.hat.type = o.hat.type === 'straw' ? 'bucket' : 'straw'; window.__oreum.player.pos.x += 0.5; return o.hat.type; });
    await wait(A.p, 1200);
    const s2 = await A.p.evaluate(() => ({ n: __sent.length, withO: __sent.filter((d) => d.includes('"o":')).length, ms: performance.now() - __sent0 }));
    // NET.identMs 마다 한 번 더 싣는 것(#115)은 느린 환경에서 이 사이에 들어올 수 있음 (#144): 지난 시간만큼은 봐줌
    const per = (ms) => Math.ceil(ms / NET.identMs);
    ok(s1.n >= 3 && s1.withO <= per(s1.ms) && s1.withO < s1.n && s2.withO >= 1 && s2.withO <= 1 + per(s2.ms), `옷·닉네임은 바뀔 때만 실음 (자리만 ${s1.n}번·그중 옷 ${s1.withO}번, 옷 바꾼 뒤 ${s2.withO}번, ${(s2.ms / 1000).toFixed(1)}초)`);
    ok(await B.p.evaluate((h) => [...window.__oreum.net.peersById.values()][0]?.data.o?.h === h, hat), `옷 바꾸면 B 화면에 바로 (${hat})`);
    // 기본 옷 색 (#155): A 가 고른 색이 B 에게 (장비 id 'top:w-tee~3' 로 실림, B 는 그 장비로 그림)
    const tee = await A.p.evaluate(() => { const o = window.__oreum; o.save.look = { ...(o.save.look || { sex: 'm', skin: 0 }), colors: { hat: 0, top: 3, bottom: 0, shoes: 0 } }; o.clothes.wear('top', 'top:w-tee'); o.player.pos.x += 0.5; return o.save.outfit.gear.top; });
    const seenTee = await until(B, (t) => [...window.__oreum.net.peersById.values()].some((e) => e.data.o?.gr?.top === t), tee);
    ok(tee === 'top:w-tee~3' && seenTee, `A 가 고른 기본 옷 색이 B 화면에 (${tee})`);
    // 레벨 (#159): 문이 열린 A 의 레벨이 B 화면 이름표에 (바뀔 때만 실림)
    const alv = await A.p.evaluate(() => { const o = window.__oreum; o.save.journey = { ...(o.save.journey || {}), seen: { ...(o.save.journey?.seen || {}), level: '2026-01-01' } }; o.level.setXp(5000); o.player.pos.x += 0.5; return o.level.state().lv; });
    const seenLv = await until(B, (lv) => [...window.__oreum.net.peersById.values()].some((e) => e.lv === lv), alv);
    ok(alv > 1 && seenLv, `B 가 A 의 레벨을 봄 (레벨 ${alv})`);
    // 칭호 (#165): A 가 단 칭호가 B 화면 이름표 위에 (번호 tt 만 오가고 글은 목록에서)
    const tt = await A.p.evaluate(() => { const o = window.__oreum, i = o.punkWorld.title.list.findIndex((t) => t.badge === 'b-first'); o.ach.state.badges['b-first'] ||= { at: Date.now(), claimed: false }; o.punkWorld.title.set(i); o.player.pos.x += 0.5; return o.punkWorld.title.list[i].t; });
    ok(await until(B, (t) => [...window.__oreum.net.peersById.values()].some((e) => e.title === t && e.label?.scale.y > 0.9), tt), `A 가 단 칭호가 B 화면 이름표 위에 (${tt})`);
    await A.p.evaluate(() => { window.__oreum.punkWorld.title.set(-1); window.__oreum.player.pos.x += 0.5; });
    ok(await until(B, () => [...window.__oreum.net.peersById.values()].every((e) => !e.title)), '칭호를 떼면 B 화면에서도 사라짐');
    const C = await open('C'); await C.p.evaluate(() => document.getElementById('enter').click()) /* 화면 셋이 소프트웨어 GL 로 돌면 page.click 이 프레임을 기다리다 30초를 넘김 (#193) */;
    const an = await A.p.evaluate(() => window.__oreum.save.nick);
    await until(C, ([n, h]) => [...window.__oreum.net.peersById.values()].some((e) => e.nick === n && e.data.o?.h === h), [an, hat], 90000); /* 화면 셋: C 가 방에 붙기까지 30초를 넘기도 함 (#193) */ // 느린 환경: 3초 고정 대신 보일 때까지 (#119)
    const cs = await C.p.evaluate(() => [...window.__oreum.net.peersById.values()].map((e) => [e.nick, e.data.o?.h]));
    ok(cs.some(([n, h]) => n === an && h === hat), `새로 들어온 C 에게 A 의 옷·닉네임 (${JSON.stringify(cs)})`);
    await C.ctx.close(); await wait(A.p, 800);
  }
  // A 를 움직이면 B 화면의 A 가 따라옴
  await A.p.evaluate(() => { const o = window.__oreum; o.player.pos.x += 5; });
  const ax = await A.p.evaluate(() => window.__oreum.player.pos.x);
  await until(B, (ax) => { const e = [...window.__oreum.net.peersById.values()][0]; return e && Math.abs(e.tpos.x - ax) < 0.5; }, ax, 10000); /* 0.8초 고정 대신: 느린 화면에선 다음 자리 보내기가 늦음 (#193) */
  const d = await B.p.evaluate(() => { const e = [...window.__oreum.net.peersById.values()][0]; return e ? e.tpos.x : null; });
  ok(d != null && Math.abs(d - ax) < 0.5, `위치 이어 받기 (A ${ax.toFixed(1)} / B 가 본 A ${d?.toFixed(1)})`);
  { // 무기 3~6단계 (#123): A 가 쏜 탄·던진 폭탄이 B 화면에 보임 (presence wf 사건만, 보내는 양은 그대로)
    await B.p.evaluate(() => { const f = window.__oreum.weapon.fx; window.__vis = { shot: 0, lob: 0 }; const s0 = f.shoot, l0 = f.lob; f.shoot = function (...a) { if (a[2]?.vis) window.__vis.shot++; return s0.apply(this, a); }; f.lob = function (...a) { if (a[2]?.vis) window.__vis.lob++; return l0.apply(this, a); }; });
    await A.p.evaluate(() => { const o = window.__oreum; o.save.coins += 20; o.save.equip.weapon = 6; o.weapon.use(3); o.weapon.fire(); });
    const gotShot = await until(B, () => window.__vis.shot > 0, null, 15000);
    await A.p.evaluate(() => { const o = window.__oreum; o.weapon.use(6); o.weapon.fire(); });
    const gotLob = await until(B, () => window.__vis.lob > 0, null, 15000);
    const wf = await A.p.evaluate(() => JSON.stringify(window.__oreum.net.test?.last?.wf ?? null));
    ok(gotShot && gotLob, `A 의 귤 총 탄·귤 폭탄이 B 화면에 보임 (탄 ${gotShot}, 폭탄 ${gotLob}${wf !== 'null' ? ', ' + wf : ''})`);
    await A.p.evaluate(() => { const o = window.__oreum; o.save.equip.weapon = 1; o.weapon.use(1); });
  }
  { // 모아 쏘기 (#129): A 가 모으는 빛(presence cg)과 모아 쏜 센 샷(wf 7번째 칸)이 B 화면에 보임
    await B.p.evaluate(() => { const f = window.__oreum.charge.fx; window.__cv = { orb: 0, glow: 0 }; const o0 = f.orb, g0 = f.glow; f.orb = function (...a) { window.__cv.orb++; return o0.apply(this, a); }; f.glow = function (...a) { if (a[0] !== 0) window.__cv.glow++; return g0.apply(this, a); }; });
    await A.p.evaluate(() => { const o = window.__oreum; o.save.coins += 20; document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; }); });
    const ctxOk = await A.p.evaluate(() => window.__oreum.aim.ctx() === 'throw');
    let glow = false;
    if (ctxOk) { await A.p.keyboard.down('f'); glow = await until(B, () => window.__cv.glow > 0, null, 15000); await A.p.keyboard.up('f'); }
    await A.p.evaluate(() => window.__oreum.charge.shoot(1, 'hand'));
    const orb = await until(B, () => window.__cv.orb > 0, null, 15000);
    ok(orb && (glow || !ctxOk), `A 의 모으는 빛·모아 쏜 귤이 B 화면에 보임 (빛 ${ctxOk ? glow : '던지기 버튼 아님, 건너뜀'}, 센 귤 ${orb})`);
  }
  // 더미 줍기: A 가 0번 더미에서 하나 → B 의 0번 더미도 하나 줄어듦
  const before = await B.p.evaluate(() => window.__oreum.trash.api.store.left(0));
  await A.p.evaluate(() => { const t = window.__oreum.trash.api; t.store.takeOne(0); });
  await wait(A.p, 600);
  const after = await B.p.evaluate(() => window.__oreum.trash.api.store.left(0));
  ok(after === before - 1, `더미 함께 쓰기 (B: ${before} → ${after})`);
  // 동료 (#172): A 화면의 동료 셋은 B 에게 안 보이고(사람 수 그대로), 동료가 줄인 더미는 B 에도 줄어듦(btake)
  {
    const aOn = await A.p.evaluate(() => { const Bd = window.__oreum.buddies; if (!Bd) return -1; ['sunja', 'minsu', 'jenny'].forEach((id) => Bd.come(id)); Bd.sim(0.6); return Bd.list().filter((x) => x.on).length; });
    await wait(A.p, 1500);
    const bSee = await B.p.evaluate(() => ({ n: window.__oreum.net.count, keys: Object.keys([...window.__oreum.net.peersById.values()][0]?.data || {}) }));
    if (aOn === -1) ok(bSee.n === 1 && !bSee.keys.some((k) => /mate|bud/i.test(k)), `동료 꺼짐(#190 BUDDIES.on=false): B 가 보는 사람 ${bSee.n}명, 동료 값 없음`); /* 동료를 다시 켜면 아래 줄이 다시 봄 (#193) */
    else ok(aOn >= 1 && bSee.n === 1 && !bSee.keys.some((k) => /mate|bud/i.test(k)), `동료는 내 화면에만: A 동료 ${aOn}명, B 가 보는 사람 ${bSee.n}명`);
    const h = await A.p.evaluate(() => { const t = window.__oreum.trash.api; return t.heaps.findIndex((x, i) => t.store.left(i) > Math.ceil(t.store.full(i) * 0.2) + 1); });
    const b0 = await B.p.evaluate((h) => window.__oreum.trash.api.store.left(h), h);
    await A.p.evaluate((h) => window.__oreum.trash.api.buddyTake(h), h); await wait(A.p, 700);
    const b1 = await B.p.evaluate((h) => window.__oreum.trash.api.store.left(h), h);
    ok(b1 === b0 - 1, `동료 줍기도 방으로 (B: ${b0} → ${b1})`);
  }
  // 다시 쌓기 (#131): 방장이 아니어도 움직이는 사람 둘레 투기꾼은 쌓고, 가만히 있던 사람이 쌓은 건 방이 되돌림
  {
    const L = (X) => X.p.evaluate(() => window.__oreum.trash.api.store.left(0));
    const v0 = await L(A);
    const still = await B.p.evaluate(() => { const o = window.__oreum; o.player.speed = 0; return o.trash.api.store.putBack(0, 1); });
    await wait(B.p, 900);
    const [a1, b1] = [await L(A), await L(B)];
    ok(still === 1 && a1 === v0 && b1 === v0, `가만히 있던 B 가 쌓은 건 방이 되돌림 (A ${a1} · B ${b1}, 처음 ${v0})`);
    // B 를 몇 m 씩 걸려 움직인 사람으로 (서버 이동 판정 안쪽으로 나눠 감)
    for (let i = 0; i < 6; i++) { await B.p.evaluate(() => { const o = window.__oreum; o.player.pos.x += 1.2; o.player.pos.y = o.groundAt(o.player.pos.x, o.player.pos.z); }); await wait(B.p, 350); }
    const moved = await B.p.evaluate(() => window.__oreum.trash.api.store.putBack(0, 1));
    const got = await until(A, (v) => window.__oreum.trash.api.store.left(0) === v, v0 + 1, 6000);
    ok(moved === 1 && got, `움직이는 B 가 쌓은 건 받아 줌 (A: ${await L(A)}, 기대 ${v0 + 1})`);
  }
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
    let bp, ap; /* 두 화면을 차례로 읽는 사이 노루가 움직이므로 몇 번 다시 잼 (#193: 화면이 무거워져 한 번 재면 1.98m 로 흔들림) */
    for (let k = 0; k < 6; k++) {
      bp = await B.p.evaluate(() => { const d = window.__oreum.player.riding; return [d.pos.x, d.pos.z]; });
      ap = await A.p.evaluate((id) => { const d = window.__oreum.life.deerById(id); return [d.pos.x, d.pos.z]; }, id);
      if (Math.hypot(ap[0] - bp[0], ap[1] - bp[1]) < 1.5) break; await wait(A.p, 700);
    }
    // 차이 상한 1.5m (#131): 소프트웨어 GL 둘이 같이 도는 확인 환경에서는 보내기(sendMs)·틱·보간이 밀려 1m 안팎으로 흔들림 (dev 에서도 1.02~1.10m 로 실패하던 것)
    ok(seen.rider === bId && seen.st === 'ridden' && seen.dr === id && seen.gap < 0.3 && seen.lift > 0.6 && Math.hypot(ap[0] - bp[0], ap[1] - bp[1]) < 1.5, `A 화면: B 가 노루에 걸터앉아 같이 움직임 (${JSON.stringify(seen)}, 차이 ${Math.hypot(ap[0] - bp[0], ap[1] - bp[1]).toFixed(2)}m)`);
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
  // 엔딩 (#168): A 가 끝내면 방이 시작 시각을 정해 B 도 같은 시각에 같은 시네마틱. 같은 날 두 번째는 끝낸 사람(A)만
  {
    await A.p.evaluate(() => window.__oreum.story.play('end'));
    const got = await until(B, () => !!window.__oreum.story.ending.state(), null, 15000);
    const sa = await A.p.evaluate(() => window.__oreum.story.ending.state()), sb = await B.p.evaluate(() => window.__oreum.story.ending.state());
    ok(got && sa && sb && sa.mine === true && !sb.mine, `엔딩: A 가 끝내면 B 화면에도 같이 (A ${JSON.stringify(sa)} · B ${JSON.stringify(sb)})`);
    await until(A, () => window.__oreum.story.ending.state()?.cine === true, null, 15000);
    const ua = await A.p.evaluate(() => window.__oreum.story.ending.state()?.u), ub = await B.p.evaluate(() => window.__oreum.story.ending.state()?.u);
    ok(Number.isFinite(ua) && Number.isFinite(ub) && Math.abs(ua - ub) < 1.5, `엔딩: 같은 시각에 시작 (A ${ua}초 · B ${ub}초)`);
    const c0 = await A.p.evaluate(() => window.__oreum.save.coins);
    await A.p.evaluate(() => window.__oreum.story.ending.stop()); await B.p.evaluate(() => window.__oreum.story.ending.stop());
    ok(await until(A, (c0) => window.__oreum.save.coins > c0 && window.__oreum.story.state().done.includes('end'), c0, 10000), '엔딩: 끝낸 A 만 보상·이야기 끝');
    await A.p.evaluate(() => window.__oreum.story.play('end')); await wait(A.p, 3000);
    const a2 = await A.p.evaluate(() => window.__oreum.story.ending.state()), b2 = await B.p.evaluate(() => window.__oreum.story.ending.state());
    ok(!!a2 && !b2, `엔딩: 같은 날 두 번째는 끝낸 사람만 (A ${!!a2} · B ${!!b2})`);
    await A.p.evaluate(() => window.__oreum.story.ending.stop());
    { let c = -1; for (let k = 0; k < 20; k++) { const n = await A.p.evaluate(() => window.__oreum.save.coins); if (n === c) break; c = n; await wait(A.p, 2000); } } /* 억지로 다시 튼 엔딩의 보상(귤 날아가는 효과 뒤 숫자 올림)이 아래 '귤 40' 뒤에 들어와 340 이 되던 것 (#193) */
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
  ok(c < 999999 && c <= 40 + NET.earnBurst + NET.earnPerSec * 60, `귤 부풀리기 바로잡힘 (999999 → ${c})`);
  // 보안 (#84)
  if (await A.p.evaluate(() => !document.getElementById('intro').hidden)) { await A.p.evaluate(() => document.getElementById('enter').click()) /* 화면 셋이 소프트웨어 GL 로 돌면 page.click 이 프레임을 기다리다 30초를 넘김 (#193) */.catch(() => {}); }
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
  // 너무 빠른 줍기(초당 NET.takePerSec 넘게) → 방이 거절 → 배낭·누적 수에서 되돌림. 한 틱에 60개면 takeMax 씩 나눠 보내고 takePerSec 만 받힘 (#144)
  await wait(A.p, 1500); // 앞의 줍기 몫이 다시 차게
  const undo = await A.p.evaluate(async () => {
    const t = window.__oreum.trash.api, st = t.store, n = t.heaps.length;
    let h = 0; for (let i = 1; i < n; i++) if (st.left(i) > st.left(h)) h = i;
    const sum = () => ['can', 'pet', 'vinyl', 'foam', 'gear'].reduce((a, k) => a + (st.bag[k] || 0), 0);
    const bag0 = sum(), tot0 = st.totalCount(), left0 = st.left(h);
    let took = 0; for (let k = 0; k < 60; k++) if (t.take({ h }, 99)) took++;
    await new Promise((ok) => setTimeout(ok, 2000));
    return { h, left0, took, kept: sum() - bag0, tot: st.totalCount() - tot0, left: st.left(h) };
  });
  ok(undo.took === 60 && undo.kept >= NET.takePerSec - 1 && undo.kept <= NET.takePerSec + 3 && undo.tot === undo.kept && undo.left === undo.left0 - undo.kept, `방이 거절한 줍기는 배낭에서 되돌림 (${JSON.stringify(undo)})`);
  { // 번 몫 (#144): 방이 받아 준 줍기만큼은 버린 귤로 받아 주고, 그보다 많이 부풀리면 바로잡힘
    await wait(A.p, 2000); // 방 → 계정으로 번 몫이 넘어가게 (earnFlushMs)
    const per = ZONE_GYUL[HEAP_DEFS[undo.h].zone - 1], legit = Math.floor(undo.kept * per * 0.9);
    const c0 = await A.p.evaluate(() => window.__oreum.save.coins);
    await A.p.evaluate((g) => { const o = window.__oreum; o.save.coins += g; return o.online.account().push(); }, legit); await wait(A.p, 800);
    const c1 = await A.p.evaluate(() => window.__oreum.save.coins);
    ok(c1 === c0 + legit, `주운 만큼 번 귤은 받아 줌 (${undo.kept}개 × ${per.toFixed(0)} 의 90% = +${legit}: ${c0} → ${c1})`);
    await A.p.evaluate(() => { const o = window.__oreum; o.save.coins += 100000; return o.online.account().push(); }); await wait(A.p, 800);
    const c2 = await A.p.evaluate(() => window.__oreum.save.coins);
    ok(c2 <= c1 + NET.earnBurst + Math.ceil(undo.kept * per * 0.1) + NET.earnPerSec * 30, `10만 귤 부풀리기 바로잡힘 (${c1} + 100000 → ${c2})`);
  }
  { // 서버가 아는 귤 (#188): 깎이면 알림·의견에 붙일 정보, 저장해 둔 전설 장비를 팔면 안 깎임
    const cut = await A.p.evaluate(() => window.__oreum.save.lastCut);
    ok(cut && cut.n > 0 && cut.before > cut.after, `깎이면 알림 정보가 남음 (-${cut?.n})`);
    const it = { s: 'weapon', t: 6, g: 3, e: 5 };
    await A.p.evaluate((it) => { const o = window.__oreum; o.save.lootAuto = 0; o.save.loot.push(it); return o.online.account().push(); }, it); await wait(A.p, 800);
    const s0 = await A.p.evaluate(() => window.__oreum.save.coins);
    const v = await A.p.evaluate(() => { const o = window.__oreum, i = o.save.loot.findIndex((x) => x.t === 6 && x.g === 3 && x.e === 5); const v = o.loot.sell(i); o.online.account().push(); return v; }); await wait(A.p, 1200);
    const s1 = await A.p.evaluate(() => ({ c: window.__oreum.save.coins, sold: window.__oreum.save.sold }));
    ok(v > NET.earnBurst && s1.c === s0 + v && !s1.sold, `가진 전설 무기를 팔면 서버가 그 귤을 인정 (+${v}, 몫 ${NET.earnBurst} 넘음)·판 것 목록 비움`);
  }
  // 랭킹 (#11): 버리면 저장을 바로 보내고 오늘 순위가 오르면 토스트, 순위표에 내 줄, 손님은 이 기기 기록만
  await wait(A.p, 4000); // 앞의 줍기 몫(초당 takePerSec)이 지나가게
  // 이름은 저장으로 못 바꿈 (#162): 이름 바꾸기 창으로 (첫 바꾸기 무료, 서버 POST /nick)
  const nick = '랭킹확인' + (Date.now() % 1000);
  await A.p.evaluate((n) => { document.getElementById('menu-nick').click(); const i = document.getElementById('nick-new'); i.value = n; i.dispatchEvent(new Event('input')); document.getElementById('nick-new-go').click(); }, nick);
  for (let k = 0; k < 60 && (await A.p.evaluate(() => window.__oreum.save.nick)) !== nick; k++) await wait(A.p, 250);
  ok((await A.p.evaluate(() => window.__oreum.save.nick)) === nick, `이름 바꾸기 창 → 서버가 바꿈 (${nick})`);
  await A.p.evaluate(() => { const o = window.__oreum; const st = o.trash.api.store; let h = 0; for (let i = 1; i < o.trash.api.heaps.length; i++) if (st.left(i) > st.left(h)) h = i; for (let k = 0; k < 3; k++) o.trash.api.take({ h }, 99); });
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
  await A.p.evaluate(() => window.__oreum.rank.open()); await listed();
  const rk = await A.p.evaluate(() => { const me = document.querySelector('#rank-list .rk-row.me'); return { me: me && me.querySelector('.rk-nick').textContent, no: me && me.querySelector('.rk-no').textContent, rows: document.querySelectorAll('#rank-list .rk-row').length, medal: !!document.querySelector('#rank-list .rk-row.m1'), note: document.getElementById('rank-note').textContent }; });
  ok(rk.me === nick && +rk.no >= 1 && rk.medal, `순위표에 내 줄·1위 메달 (${JSON.stringify(rk)})`);
  await A.p.evaluate(() => document.querySelector('#rank-range [data-v="all"]').click()); await listed();
  ok(await A.p.evaluate(() => !!document.querySelector('#rank-list .rk-row.me')), '전체 탭에도 내 줄');
  ok(await A.p.evaluate(() => !document.getElementById('rank-srv') && window.__oreum.save.server === 'battle' && window.__oreum.online.account().rank('day', 'clean').then((r) => r.srv === 'battle')), '서버 탭 없음·예전 clean 저장은 battle·예전 srv=clean 요청도 battle 순위 (#98)');
  await A.p.setViewportSize({ width: 390, height: 640 }); await A.p.evaluate(() => document.querySelector('#rank-range [data-v="day"]').click()); await listed(); await wait(A.p, 800);
  await A.p.screenshot({ path: 'dist/rank-online.png' });
  await B.p.evaluate(() => window.__oreum.rank.open()); await wait(B.p, 500);
  ok(await B.p.evaluate(() => document.querySelectorAll('#rank-list .rk-mine').length === 3 && /로그인하면/.test(document.getElementById('rank-note').textContent)), '손님: 이 기기 기록 셋과 로그인 안내');
  await caveCheck(); // 동굴 칸 (#195): 앞 검사(가만히 있던 사람·엔딩)에 걸리지 않게 끝에서
  await raidCheck();
  if (!A.closed) await A.ctx.close(); await B.ctx.close(); await b.close(); web.close();
  // 귤 주기 (#175): 둘 다 로그인한 깨끗한 브라우저로 따로 (A 가 B 옆에서 누르고 있으면 B 귤이 늘고 A 는 준 만큼 줄어듦) — tools/give.js
  if (!ONLY) { try { require('child_process').execFileSync('node', [path.join(__dirname, 'give.js'), SRV], { stdio: 'inherit' }); } catch (e) { process.exitCode = 1; } }
})().catch((e) => { console.error(e); process.exit(1); });
