// 적 역할·정상 설인 (#296): node tools/foes.js
// 1) 길가 무리 역할 뽑기 (구역별 잽싼·묵직한·던지는·빅풋 비율, 첫 싸움 전엔 없음)
// 2) 길가 무리를 실제로 불러 역할이 섞이는지·묵직한 놈이 밀리지 않는지·빅풋 돌이 떨어져 길을 막는지
// 3) 정상 설인: 나옴 → 눈덩이 셋 → 맞으면 느려짐 → 귤 두 번 맞으면 사라짐(기운 그대로) → 사건 5 종결이면 안 나옴
// 4) 서바이벌 판(구역 3) 첫 물결부터 여러 패턴이 섞이는지, 던지는 놈 동시 상한
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 400 } });
  const errs = []; p.on('pageerror', (e) => { errs.push(e.message); console.log('ERR', e.message.slice(0, 300)); });
  const url = 'file://' + process.cwd() + '/dist/test.html#namsongi';
  await p.goto(url); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1, pace: { first: 1, bloomed: 1 } }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.click('#enter', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1500);
  await p.evaluate(() => { const o = window.__oreum; o.pace.pacing.test.first.done = true; o.pace.pacing.test.first.bloomed = true; o.pace.pacing.test.soon(1e6); o.setTod(13); o.setWeather('clear'); o.hp.set(o.hp.max); });

  /* 1) 역할 뽑기 */
  const dist = await p.evaluate(() => { const o = window.__oreum, K = { 1: 'piglet', 2: 'dog', 3: 'boar', 4: 'rabid', 5: 'alien' }, out = {};
    for (const z of [1, 2, 3, 4, 5]) { const c = {}; for (let i = 0; i < 2000; i++) { const r = o.foes.role(K[z], z); const k = r ? r.pat + (r.kind !== K[z] ? ':' + r.kind : '') : 'base'; c[k] = (c[k] || 0) + 1; } out[z] = c; }
    const f = o.save.pace.first; o.save.pace.first = 0; const none = o.foes.role('dog', 2); o.save.pace.first = f; return { out, none }; });
  for (const z of [1, 2, 3, 4, 5]) console.log('  구역', z, JSON.stringify(dist.out[z]));
  ok(!dist.out[1].throw && !dist.out[1].rock && dist.out[1].zip > 200 && dist.out[1].heavy > 100, '구역 1: 잽싼·묵직한 놈만 조금 (던지는 놈 없음)');
  ok(dist.out[2].throw > 200, '구역 2 부터 던지는 놈');
  ok(dist.out[3]['rock:bigfoot'] > 150 && dist.out[4]['rock:bigfoot'] > 150, '구역 3·4 빅풋');
  ok(dist.none === null, '첫 싸움 전(save.pace.first 0)엔 역할 없음');

  /* 2) 길가 무리 (구역 3) */
  const road = await p.evaluate(async () => {
    const o = window.__oreum, E = o.enemies, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const zs = o.trash.api.zoneAt, pts = []; for (let x = -400; x < 400; x += 12) for (let z = -600; z < 300; z += 12) if (zs(x, z) === 3 && (!o.spots.enemyOk || o.spots.enemyOk(x, z))) pts.push([x, z]);
    const [x, z] = pts[Math.floor(pts.length / 2)]; o.player.pos.set(x, o.groundAt(x, z), z);
    E.test.clear(); const seen = {}; let heavy = null;
    for (let k = 0; k < 12; k++) { E.test.clear(); E.spawnPlan({ kind: 'boar', n: 3, x: x + 14, z, zone: 3 }); for (const e of E.list) { seen[e.pat || 'base'] = (seen[e.pat || 'base'] || 0) + 1; if (e.pat === 'heavy' && !heavy) heavy = { hp: e.hp, base: o.balance?.ENEMIES?.boar?.hp ?? null, size: e.root.scale.x }; } }
    /* 묵직한 놈: 맞아도 밀리지 않음 */
    E.test.clear(); let mv = null;
    for (let k = 0; k < 40 && mv == null; k++) { E.spawnPlan({ kind: 'boar', n: 3, x: x + 10, z, zone: 3 }); const h = E.list.find((e) => e.pat === 'heavy'); if (h) { const p0 = h.pos.clone(); h.state = 'wind'; h.st = 0; E.hurt(h, 1, false); const fl = h.fl || 0; mv = { fl, still: h.state === 'wind' }; } else E.test.clear(); }
    /* 빅풋 돌: 떨어져 잠깐 남음 */
    E.test.clear(); let bf = null;
    for (let k = 0; k < 60 && !bf; k++) { E.spawnPlan({ kind: 'boar', n: 3, x: x + 13, z, zone: 3 }); bf = E.list.find((e) => e.kind === 'bigfoot') || null; if (!bf) E.test.clear(); }
    let rock = 0, stay = 0, aim = false;
    if (bf) { for (const e of E.list) if (e !== bf) E.remove(e); bf.state = 'charge'; bf.st = 0; bf.ps = { cd: 0.1, aim: 0, side: 1 }; for (let t = 0; t < 70; t++) { await sleep(100); o.hp.set(o.hp.max); if (bf.ps?.aim > 0) aim = true; const s = o.swarm.state?.() || null; const ps = o.foes.state(); const pt = o.foes.pat; rock = Math.max(rock, pt ? pt.balls().filter((q) => q.type === 'rock').length : 0); stay = Math.max(stay, pt ? pt.stays().length : 0); if (stay) break; } }
    E.test.clear();
    return { seen, heavy, mv, bf: !!bf, aim, rock, stay };
  });
  console.log('  길가', JSON.stringify(road));
  ok(Object.keys(road.seen).length >= 3, '길가 무리에 역할이 섞임');
  ok(road.mv && road.mv.fl === 0 && road.mv.still, '묵직한 놈은 맞아도 밀리지 않고 휘두르기 조짐이 이어짐');
  ok(road.bf && road.aim && road.rock >= 1 && road.stay >= 1, '빅풋: 돌을 들어 올림 → 던짐 → 떨어진 돌이 남음');

  /* 3) 정상 설인 */
  const yeti = await p.evaluate(async () => {
    const o = window.__oreum, E = o.enemies, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let t = 0; t < 300 && (o.hp.isDown || o.hp.pending || o.player.knock); t++) await sleep(100); /* 길가 빅풋 돌에 쓰러졌으면 일어날 때까지 */
    const zs = o.trash.api.zoneAt; let best = null; for (let x = -200; x < 200; x += 6) for (let z = -200; z < 200; z += 6) if (zs(x, z) === 5 && (!o.spots.enemyOk || o.spots.enemyOk(x, z)) && (!best || Math.hypot(x, z) < Math.hypot(best[0], best[1]))) best = [x, z];
    o.player.pos.set(best[0], o.groundAt(best[0], best[1]), best[1]); o.hp.set(o.hp.max); E.test.clear();
    const zone = zs(best[0], best[1]);
    o.foes.cd(0); let y = null; for (let t = 0; t < 40 && !y; t++) { await sleep(100); y = o.foes.state().yeti; }
    const why = o.foes.state().why;
    let snow = 0, slow = 0, hp0 = o.hp.hp, hit = false;
    const ye = E.list.find((e) => e.kind === 'yeti');
    const H = o.life.hooks, eh = H.enemyHit; H.enemyHit = function (dir, def, kind) { const h = o.hp.hp; const r = eh.apply(this, arguments); if (kind === 'yeti' && o.hp.hp < h - 0.01) hit = true; return r; };
    if (ye) { ye.ps = { cd: 0.05, aim: 0, n: 0, gapT: 0, side: 1 }; ye.yLife = 60; for (let t = 0; t < 60; t++) { await sleep(100); const pt = o.foes.pat; snow = Math.max(snow, pt.balls().filter((q) => q.type === 'snow').length); if (o.foes.state().slow > 0) slow = 1; if (hit && snow === 0 && t > 20) break; } }
    H.enemyHit = eh; const active = E.activeN();
    let hp1 = null, st1 = null, gone = false;
    if (ye) { const h = ye.hp; E.hurt(ye, 50, false); hp1 = ye.hp === h; st1 = ye.state; await sleep(300); E.hurt(ye, 50, false); for (let t = 0; t < 30; t++) { await sleep(100); if (!E.list.includes(ye)) { gone = true; break; } } }
    /* 사건 5 종결이면 안 나옴 */
    const was = o.cases.isClosed; o.cases.isClosed = (id) => id === 'c5' || was(id); o.foes.cd(0); await sleep(1500); const closed = o.foes.state(); o.cases.isClosed = was;
    return { zone, y: !!y, why, snow, hit, slow, active, hp1, st1, gone, closedYeti: !!closed.yeti, closedWhy: closed.why };
  });
  console.log('  설인', JSON.stringify(yeti));
  ok(yeti.zone === 5 && yeti.y, '정상에 설인이 나옴');
  ok(yeti.snow >= 2, '눈덩이를 연달아 던짐 (떨어질 자리 원)');
  ok(yeti.hit && yeti.slow, '눈덩이에 맞으면 기운이 깎이고 느려짐');
  ok(yeti.active === 0, '설인은 싸움으로 세지 않음 (감독·카메라)');
  ok(yeti.hp1 === true && yeti.gone, '귤을 맞으면 기운 그대로 물러나고 두 번째에 사라짐');
  ok(!yeti.closedYeti && yeti.closedWhy === 'closed', '사건 5 종결 뒤엔 안 나옴');

  /* 4) 서바이벌 판 구역 3: 첫 물결부터 섞임, 던지는 놈 상한 */
  const run = await p.evaluate(async () => {
    const o = window.__oreum, sleep = (ms) => new Promise((r) => setTimeout(r, ms)); o.enemies.test.clear(); o.director.open('field');
    const at = o.swarm.start(3); if (!at) return null; o.swarm.speed(3); const seen = {}; let maxT = 0, max = o.foes.state().max;
    for (let t = 0; t < 260; t++) { await sleep(100); o.hp.set(o.hp.max); const s = o.swarm.state(); if (!s) break; for (const [k, v] of Object.entries(s.pats || {})) seen[k] = Math.max(seen[k] || 0, v); seen.stage = Math.max(seen.stage || 0, s.stage); if (t % 8 === 0) for (const e of o.enemies.list.slice()) if (e.def.swarm === 'mob' && e.state !== 'flee' && e.state !== 'leave') o.enemies.hurt(e, 1e4, true); /* 쫓아내야 새로 나옴 */ maxT = Math.max(maxT, o.foes.state().throwers); }
    const T = o.swarm.state()?.t; o.swarm.speed(1); o.swarm.stop(); o.enemies.test.clear(); return { seen, maxT, max, T };
  });
  console.log('  판', JSON.stringify(run));
  ok(run && Object.keys(run.seen).length >= 6 && (run.seen.throw || run.seen.rock), '판 앞쪽(' + (run && run.T) + '초)에 패턴 다섯 이상·던지는 놈');
  ok(run && run.maxT <= run.max, '던지는 놈 동시 ' + (run && run.maxT) + ' ≤ ' + (run && run.max));
  ok(!errs.length, '페이지 오류 ' + errs.length);
  await b.close();
  console.log(fails ? `실패 ${fails}` : '모두 통과'); process.exit(fails ? 1 : 0);
})();
