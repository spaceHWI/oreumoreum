// 사람 수에 맞춘 쓰레기 쌓이는 속도 확인 (#131): node tools/crowd.js [--pick 3000] [--chase 0.5] [--min 60]
// 1) 모두 나간 뒤 10·30·60·90분에 빈자리가 채워진 비율 (구역별·전체, src/refill.js)
// 2) 방(server/src/roomcore.js)을 Node 에서 가짜 시계로: 빈 방 채우기, 사람 수 세기(움직임·튜토리얼·따라가기), 다시 쌓기 한도
// 3) 1·3·10·30명이 1시간 동안 쌓이는 양·치우는 양·남는 양 (src/pacing.js 를 사람마다 그대로 돌림)
//    가정 (어림): 오름은 가득에서 시작, 한 사람이 1시간에 줍는 수 --pick(기본 3000, 중간 장비), 투기꾼은 --chase 비율만큼 쫓아내 안 쌓임,
//    몹이 헤집는 쓰레기는 셈하지 않음, 낚시·가게로 바쁜 시간 없음. '거의 다 치움' = 오름 전체의 10% 이하
const path = require('path');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : +process.argv[i + 1]; };
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
(async () => {
  const imp = (f) => import(path.join(__dirname, '..', f));
  const { DUMP, PACE, NET } = await imp('src/balance.js');
  const { emptyFill, offlineAdds, crowdMul, crowdShare, crowdGap } = await imp('src/refill.js');
  const { HEAP_DEFS, HEAP_FULL, HEAP_TOTAL } = await imp('src/heapdefs.js');
  const { createPacing } = await imp('src/pacing.js');
  const { createRoomCore } = await imp('server/src/roomcore.js');
  const zones = [...new Set(HEAP_DEFS.map((d) => d.zone))];
  const HZ = HEAP_DEFS.map((d) => d.zone);

  // 1) 빈 동안 채움
  console.log(`\n1) 모두 나간 뒤 채워진 비율 (빈자리 기준. 30분 절반 · ${DUMP.offlineMaxH * 60}분 가득, 구역 배율 ${JSON.stringify(DUMP.offlineZone)})`);
  const empty = HEAP_FULL.map(() => 0), rowsF = [];
  for (const m of [1, 10, 30, 60, 90, 120]) {
    const adds = offlineAdds(empty, HEAP_FULL, HZ, m * 60), tot = adds.reduce((s, a) => s + a[1], 0);
    const r = { 분: m }; zones.forEach((z) => { const zf = HEAP_DEFS.reduce((s, d) => s + (d.zone === z ? d.n : 0), 0), zg = adds.reduce((s, [i, n]) => s + (HZ[i] === z ? n : 0), 0); r['구역' + z] = Math.round(zg / zf * 100) + '%'; });
    r.전체 = Math.round(tot / HEAP_TOTAL * 100) + '%'; rowsF.push(r);
  }
  console.table(rowsF);
  const f30 = offlineAdds(empty, HEAP_FULL, HZ, 1800).reduce((s, a) => s + a[1], 0) / HEAP_TOTAL, f90 = offlineAdds(empty, HEAP_FULL, HZ, 5400).reduce((s, a) => s + a[1], 0) / HEAP_TOTAL;
  ok(f30 >= 0.45 && f30 <= 0.65, `30분 비면 절반쯤 (${Math.round(f30 * 100)}%)`);
  ok(f90 >= 0.999, `90분 비면 가득 (${Math.round(f90 * 100)}%)`);
  ok(emptyFill(30, 1) === 0 && emptyFill(1800, 1) > emptyFill(1800, 5), '1분 안쪽은 세지 않고, 구역 1 이 구역 5 보다 먼저 참');

  // 2) 방
  console.log('\n2) 방 (roomcore, 가짜 시계)');
  let T = 1e12; const now = () => T;
  const half = HEAP_FULL.map((n) => Math.floor(n / 2));
  const core = createRoomCore({ now, heaps: half, seen: T - 30 * 60e3 });
  const inbox = new Map(); const mk = (name) => { inbox.set(name, []); return core.join((s) => inbox.get(name).push(JSON.parse(s)), { acct: name }); };
  const a = mk('a'), hi = inbox.get('a')[0];
  const filled = hi.heaps.reduce((s, v) => s + v, 0) - half.reduce((s, v) => s + v, 0), want = offlineAdds(half, HEAP_FULL, HZ, 1800).reduce((s, x) => s + x[1], 0);
  ok(hi.fill === filled && filled === want && filled > 0, `빈 방 30분 뒤 첫 사람이 들어오면 방이 채움 (${filled}개, hi.fill ${hi.fill})`);
  const b = mk('b'); ok(!inbox.get('b')[0].fill, '두 번째 사람은 채우지 않음');
  const msg = (p, o) => core.message(p, JSON.stringify(o));
  const walk = (p, x, z) => msg(p, { t: 'p', d: { x, z, h: 0 } });
  // 가만히 있는 b 가 쌓기 → 거절 (방장 a 는 늘 됨)
  const H = () => core.heaps(); const h0 = HEAP_FULL.findIndex((n, i) => H()[i] + 5 < n);
  walk(b, 0, 0); T += 1000; const v0 = H()[h0]; msg(b, { t: 'put', h: h0, n: 3 });
  ok(H()[h0] === v0, '가만히 있는 사람(방장 아님)의 다시 쌓기는 거절');
  for (let i = 1; i <= 5; i++) { T += 1000; walk(b, i * 2, 0); }
  msg(b, { t: 'put', h: h0, n: 3 }); ok(H()[h0] === v0 + 3, '움직이는 사람의 다시 쌓기는 받아 줌');
  // 튜토리얼 중이면 세지 않음
  const c = mk('c'); for (let i = 1; i <= 5; i++) { T += 1000; msg(c, { t: 'p', d: { x: 100 + i * 2, z: 0, h: 0, tu: 1 } }); }
  ok(core.active() === 1, `사람 수: 움직인 b 만 (튜토리얼 중 c, 처음 자리 그대로인 a 는 뺌) → ${core.active()}`);
  // 따라가기: 30명이 움직이기 시작하면 1분 안쪽에 따라감
  const many = Array.from({ length: 27 }, (_, i) => mk('m' + i));
  for (let s = 0; s < 70; s++) { T += 1000; many.forEach((p, i) => walk(p, 300 + i * 10, s * 2)); walk(b, 20 + s * 2, 0); for (let k = 0; k < 10; k++) core.step(); if (s === 10) var at10 = core.crowd; if (s === 30) var at30 = core.crowd; }
  const np = inbox.get('a').filter((m) => m.t === 'np').map((m) => m.n);
  ok(at10 > 1.5 && at10 < 20 && at30 > at10 && core.crowd > 27, `사람 수가 서서히 따라감 (10초 ${at10.toFixed(1)} · 30초 ${at30.toFixed(1)} · 70초 ${core.crowd.toFixed(1)}, 알림 ${np.length}번 마지막 ${np[np.length - 1]})`);
  // 방 전체 한도: putPerMin × crowd^0.8. 1분 동안 모두 마구 쌓아도 이 안 (+ 처음 putBurst)
  const H1 = H().map(() => 0); core.heaps().forEach((v, i) => { H1[i] = v; });
  for (let i = 0; i < HEAP_FULL.length; i++) core.heaps()[i] = 0; // 빈 오름으로
  let put = 0; const tot0 = () => core.heaps().reduce((s, v) => s + v, 0);
  for (let s = 0; s < 60; s++) { T += 1000; [b, ...many].forEach((p, i) => { walk(p, 2000 + s * 2.5, i * 10); for (let k = 0; k < 3; k++) msg(p, { t: 'put', h: (i * 3 + k) % HEAP_FULL.length, n: 10 }); }); }
  put = tot0();
  const lim = NET.putBurst + NET.putPerMin * crowdMul(core.crowd);
  ok(put <= lim + 30 && put > NET.putPerMin * 5, `방 전체 다시 쌓기 한도 (1분 ${put}개 ≤ ${Math.round(lim)}, 30명 기준 몫 ${Math.round(NET.putPerMin * crowdMul(30))}/분)`);
  [a, b, c, ...many].forEach((p) => core.leave(p));
  ok(core.seen === T, '모두 나가면 그 시각을 기억');

  // 3) 1시간 흉내
  const PICK = arg('--pick', 3000), CHASE = arg('--chase', 0.5), MIN = arg('--min', 60), DT = 1;
  console.log(`\n3) 1시간 동안 (가득에서 시작, 한 사람 1시간 줍기 ${PICK}개, 투기꾼 ${CHASE * 100}% 쫓아냄, 오름 전체 ${HEAP_TOTAL}개)`);
  const mul32 = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const { DUMP_PER_HOUR } = await imp('src/dumpers.js').catch(() => ({ DUMP_PER_HOUR: HEAP_TOTAL * DUMP.hourFrac })); // three 없이 못 읽으면 같은 식
  const rows = [];
  const SEEDS = arg('--seeds', 8);
  function hour(n, seed) {
    let stock = HEAP_TOTAL, dumped = 0, picked = 0, clearAt = null, attacks = 0;
    const P = Array.from({ length: n }, (_, k) => {
      const rnd = mul32(k * 7919 + n + seed * 104729), prnd = mul32(k * 31 + n * 3 + seed * 7); let threats = [], tNow = 0;
      const pc = createPacing({ rnd, perHour: DUMP_PER_HOUR, crowd: () => n, hooks: {
        threats: () => threats.filter((x) => !x.done).length,
        omen: () => true,
        attack: (plan) => { attacks++; threats = plan.dumpers.map((d) => ({ at: tNow + 25, amt: d.amt, rep: prnd() < CHASE, done: false })); if (plan.mob) threats.push({ at: tNow + 20, amt: 0, rep: true, done: false }); return { n: threats.length, eta: 20 }; },
        forceEnd: () => threats.forEach((x) => { x.done = true; }), end: () => {}, delight: () => true,
      } });
      return { pc, tick: (t) => { tNow = t; for (const x of threats) if (!x.done && t >= x.at) { x.done = true; if (!x.rep && x.amt) { const add = Math.min(x.amt, HEAP_TOTAL - stock); stock += add; dumped += add; } } } };
    });
    for (let t = 0; t < MIN * 60; t += DT) {
      for (const p of P) { p.tick(t); p.pc.update(DT); }
      const take = Math.min(stock, n * PICK / 3600 * DT); stock -= take; picked += take;
      if (clearAt == null && stock <= HEAP_TOTAL * 0.1) clearAt = t;
    }
    return { dumped, picked, stock, clearAt, attacks };
  }
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  for (const n of [1, 3, 10, 30]) {
    const R = Array.from({ length: SEEDS }, (_, s) => hour(n, s)), cl = R.map((r) => r.clearAt).filter((v) => v != null);
    const dumped = avg(R.map((r) => r.dumped)), picked = avg(R.map((r) => r.picked));
    rows.push({ 사람: n, ['쌓는 배율(n^' + DUMP.crowdExp + ')']: +crowdMul(n).toFixed(1), '한 사람 몫': +crowdShare(n).toFixed(2), '간격 배율': +crowdGap(n).toFixed(2), '한 사람 공격(1시간)': +(avg(R.map((r) => r.attacks)) / n).toFixed(1), 쌓인: Math.round(dumped), '한 사람 둘레 쌓인': Math.round(dumped / n), 치운: Math.round(picked), 남은: Math.round(avg(R.map((r) => r.stock))), '거의 다 치움(분)': cl.length < R.length ? '못 함' : +(avg(cl) / 60).toFixed(1) });
  }
  console.table(rows);
})();
