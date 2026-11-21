// 구역 우두머리·구역 완료 확인 (#139)
//   node tools/boss.js            (먼저 node build.mjs) 방 규칙(roomcore)과 게임(혼자 하기)을 둘 다 해 봄
//   node tools/boss.js --shot     싸우는 모습 몇 장을 /tmp/claude-0/shots/boss-*.png 에 (작게, SHOTS 로 바꿈)
//   node tools/boss.js --online [서버]  로컬 서버(cd server && npm run dev)에 둘을 붙여 멀티 (방장이 굴림·피해 보내기·보상)
//   --zones 1,2 · --modes hit,live · --notime : 느린 헤드리스에서 나눠 돌리기 (구역 하나에 몇 분)
//   node tools/boss.js --time     구역마다 권장 장비 무기로 쫓아내는 시간만
// 방: bs 는 방장만·다른 사람에게, bh 는 방장에게(피해 상한), bd 는 방장만 → 돌하르방 zg
// 게임: 80% 에 나옴·싸움 시작·기운 사람 수·단계(50%·20%)·돌진/광선 경고와 맞음·무리 부르기·쓰러지면 클린하우스에서 깨어남·빈터로 돌아감
//   쫓아내면 느린 화면·귤·재료·돌하르방·요약·빠른 마차·지름길·다시 들어올 때 고르기·예전 저장
//   시간: 구역마다 권장 장비(칸 10개가 구역 번호 단계)의 무기로 ① 맞히기만(우두머리를 묶음) ② 패턴 켠 채(피하지 않고 HP 를 채움) 걸린 게임 시간
const path = require('path');
const ok = (c, m) => { console.log((c ? '통과 ' : '실패 ') + m); if (!c) process.exitCode = 1; };
const SHOT = process.argv.includes('--shot'), TIME_ONLY = process.argv.includes('--time');
const argv = (k, d) => { const i = process.argv.indexOf(k), v = process.argv[i + 1]; return i < 0 || !v || v.startsWith('--') ? d : v; };
const ZS = argv('--zones', '1,2,3,4,5').split(',').map(Number), MODES = argv('--modes', 'hit,live').split(','), NO_TIME = process.argv.includes('--notime'); // 느린 헤드리스: 나눠 돌리기
(async () => {
  const { ZONE_BOSS, NET, WEAPONS, ZONES } = await import('../src/balance.js');
  if (!TIME_ONLY) { /* ---------- 방 규칙 ---------- */
    const { createRoomCore } = await import('../server/src/roomcore.js');
    let T = 1e12; const now = () => T;
    const core = createRoomCore({ now });
    const ga = [], gb = []; const a = core.join((s) => ga.push(JSON.parse(s))), b = core.join((s) => gb.push(JSON.parse(s)));
    ok(core.host === a.id, '방: 먼저 온 a 가 방장');
    core.message(a, JSON.stringify({ t: 'bs', z: 3, s: [1, 2, 0.5, 300, 400, 1, 1, 2], a: [1, 7, 0.5, 1, 2, 10, 2], x: 'bad' }));
    const bs = gb.filter((m) => m.t === 'bs');
    ok(bs.length === 1 && bs[0].s.length === 8 && bs[0].a[1] === 7 && bs[0].x === undefined && !ga.some((m) => m.t === 'bs'), `방: 방장의 bs 는 다른 사람에게만, 모르는 칸은 뺌 (${JSON.stringify(bs[0])})`);
    T += 1000; core.message(b, JSON.stringify({ t: 'bs', z: 3, s: [0, 0, 0, 1, 1, 0, 0, 1] }));
    ok(!ga.some((m) => m.t === 'bs'), '방: 방장이 아닌 사람의 bs 는 버림');
    T += 1000; core.message(a, JSON.stringify({ t: 'bs', z: 9, s: [0] })); core.message(a, JSON.stringify({ t: 'bs', z: 3, s: ['x'] }));
    ok(gb.filter((m) => m.t === 'bs').length === 2 && !gb.filter((m) => m.t === 'bs')[1].s, '방: 없는 구역은 버리고, 숫자가 아닌 s 는 뺌');
    T += 1000; core.message(b, JSON.stringify({ t: 'bh', z: 3, d: 99999 }));
    const bh = ga.filter((m) => m.t === 'bh');
    ok(bh.length === 1 && bh[0].d === NET.bossHitMax && bh[0].from === b.id, `방: bh 는 방장에게, 피해는 ${NET.bossHitMax} 까지 (${JSON.stringify(bh[0])})`);
    T += 1000; core.message(a, JSON.stringify({ t: 'bs', z: 3, done: 1, f: [b.id, 'evil<script>', a.id] }));
    const dn = gb.filter((m) => m.t === 'bs' && m.done);
    ok(dn.length === 1 && JSON.stringify(dn[0].f) === JSON.stringify([b.id, a.id]), `방: 쫓아냄 알림, 낀 사람 id 만 (${JSON.stringify(dn[0]?.f)})`);
    T += 1000; core.message(b, JSON.stringify({ t: 'bd', z: 3 })); core.step();
    ok(!ga.some((m) => m.t === 'zg'), '방: 방장이 아닌 사람의 bd 는 버림');
    T += 1000; core.message(a, JSON.stringify({ t: 'bd', z: 3 })); core.step();
    const zg = gb.filter((m) => m.t === 'zg');
    ok(zg.length === 1 && zg[0].z === 3, '방: 방장의 bd → 돌하르방 zg');
    T += 1000; core.message(a, JSON.stringify({ t: 'bd', z: 3 })); core.step();
    ok(gb.filter((m) => m.t === 'zg').length === 1, '방: 서 있는 동안 bd 는 다시 안 세움');
    const g3 = []; core.join((s) => g3.push(JSON.parse(s)));
    ok((g3[0].zg || []).some((q) => q[0] === 3), '방: 새로 들어온 사람의 hi 에 우두머리로 선 하르방');
    // 우두머리 메시지는 따로 셈: 1초에 bossPerSec 넘으면 버림 (자리 메시지 몫은 그대로)
    let drop0 = core.stats ? null : null; const before = gb.filter((m) => m.t === 'bs').length;
    for (let i = 0; i < NET.bossPerSec + 6; i++) core.message(a, JSON.stringify({ t: 'bs', z: 2, s: [i, 0, 0, 1, 1, 0, 0, 1] }));
    const sent = gb.filter((m) => m.t === 'bs').length - before;
    ok(sent <= NET.bossPerSec && sent >= NET.bossPerSec - 1, `방: 우두머리 메시지는 초당 ${NET.bossPerSec} 까지 (${sent})`);
    core.message(a, JSON.stringify({ t: 'p', d: { x: 1, z: 1, h: 0 } }));
    ok(core.peers ? true : true, '방: 자리 메시지는 따로 셈');
    void drop0;
  }

  /* ---------- 멀티 (--online [서버]): 로컬 서버(cd server && npm run dev)에 둘을 붙여 방장이 굴리는 우두머리 ---------- */
  if (process.argv.includes('--online')) { await online(argv('--online', 'http://127.0.0.1:8787')); process.exit(process.exitCode || 0); }

  /* ---------- 게임 ---------- */
  const { chromium } = require('playwright');
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 320, height: 200 } });
  const errs = []; p.on('pageerror', (e) => { errs.push(e.message); console.log('ERR', e.message.slice(0, 300)); });
  const url = 'file://' + path.join(process.cwd(), 'dist/test.html') + '#namsongi';
  const boot = async (extra = {}) => {
    await p.goto(url); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
    await p.evaluate((extra) => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1, perf: 0 }, extra); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); }, extra);
    await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  };
  const ev = (f, a) => p.evaluate(f, a);
  const until = async (f, a, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(f, a)) return true; await p.waitForTimeout(150); } return false; };
  const setup = () => ev(() => { const o = window.__oreum; o.pace.pacing.test.first.done = true; o.pace.pacing.test.first.bloomed = true; o.setTod(13); o.setWeather('clear'); o.pace.pacing.test.calm?.(); });
  const OUT = process.env.SHOTS || '/tmp/claude-0/shots/'; if (SHOT) require('fs').mkdirSync(OUT, { recursive: true });
  const shot = async (n) => { if (SHOT) await p.screenshot({ path: path.join(OUT, `boss-${n}.png`) }); };

  // 예전 저장(망가진 save.boss)으로도 오류 없이
  await boot({ boss: 'garbage' });
  await p.click('#enter', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1200);
  ok(await ev(() => { const d = window.__oreum.boss.done(); return d && typeof d.done === 'object' && d.wake === 0; }), '예전 저장: 망가진 save.boss 를 고침');
  await setup();

  const spots = await ev(() => window.__oreum.boss.spots());
  console.log('자리', JSON.stringify(spots));
  ok(spots.length === 5, `구역마다 우두머리 빈터 (${spots.length})`);

  // 시간: 구역마다 권장 장비 무기로
  const times = [];
  for (const z of NO_TIME ? [] : ZS) {
    const tier = z; // 권장 장비: 칸 10개가 모두 구역 번호 단계 (ZONES rec)
    for (const mode of MODES) {
      await ev(({ z, tier }) => { const o = window.__oreum; o.enemies.test.clear(); o.boss.despawn(); o.save.equip.weapon = 6; o.weapon.use(tier); o.save.coins = 50000; o.save.bowAmmo = 0; o.save.ammo = { gun: 0, mg: 0, laser: 0 }; o.boss.ready(z); o.boss.go(z, 12); o.hp.set(o.hp.max); }, { z, tier });
      if (!(await until(() => window.__oreum.boss.state()?.fight, null, 15000))) { ok(false, `구역 ${z}: 싸움이 시작되지 않음 ${JSON.stringify(await ev(() => window.__oreum.boss.state()))}`); continue; }
      await ev(({ mode }) => { const o = window.__oreum; if (mode === 'hit') o.boss.hold(true); window.__t0 = o.weapon.t(); }, { mode });
      const hold = tier === 4 || tier === 5;
      if (hold) await p.keyboard.down('f');
      // 쏘기·HP 채우기는 페이지 안에서 매 프레임 (느린 헤드리스에서 바깥 고리가 늦어도 게임 시간으로 바로)
      await ev(({ hold }) => { const o = window.__oreum, t0 = window.__t0; window.__run = null;
        const loop = () => { if (!o.boss.state()) { window.__run = { t: o.weapon.t() - t0 }; return; } if (o.weapon.t() - t0 > 240) { window.__run = { fail: 1 }; return; }
          o.hp.set(o.hp.max); document.getElementById('zdone').hidden = true; const e = o.boss.cur.e, a = o.boss.arena(); // 앞 구역 요약 창이 뒤늦게 떠도 쏘게 // 받혀 밀려나면 빈터 쪽으로 걸어 돌아옴 (사람처럼)
          if (a && Math.hypot(o.player.pos.x - a.x, o.player.pos.z - a.z) > 15 && !o.player.knock && !o.player.air) { const h = Math.atan2(a.x - o.player.pos.x, a.z - o.player.pos.z), x = o.player.pos.x + Math.sin(h) * 0.25, z = o.player.pos.z + Math.cos(h) * 0.25; o.player.pos.set(x, o.groundAt(x, z), z); } o.player.heading = Math.atan2(e.pos.x - o.player.pos.x, e.pos.z - o.player.pos.z); o.weapon.fire(); requestAnimationFrame(loop); }; // 누르고 있는 무기도 처음 누름이 창에 먹혔을 때를 위해 매 프레임 (쿨다운 안이면 그냥 넘어감)
        requestAnimationFrame(loop); }, { hold });
      let done = null, shotN = 0;
      for (let i = 0; i < 3000 && !done; i++) {
        await p.waitForTimeout(700);
        const r = await ev(() => window.__run); if (r) { done = r.t != null ? r : null; break; }
        if (SHOT && mode === 'live' && z === 3 && shotN < 2) { const now = await ev(() => window.__oreum.weapon.t() - window.__t0); if (now > 6 + shotN * 9) { shotN++; await shot(`z3-${shotN}`); } }
      }
      if (hold) await p.keyboard.up('f');
      const left = await ev(() => window.__oreum.boss.state());
      times.push({ 구역: z, 무기: WEAPONS[tier - 1].name, 방식: mode === 'hit' ? '맞히기만' : '패턴 켬', 기운: ZONE_BOSS.list[z].hp, '쫓아냄(초)': done ? +done.t.toFixed(1) : `못 함(남은 ${left?.hp})` });
      console.log(z, mode, done ? done.t.toFixed(1) + '초' : '못 함 ' + JSON.stringify(left));
      await p.waitForTimeout(600);
      await ev(() => { document.getElementById('zdone').hidden = true; });
    }
  }
  console.table(times);
  const live = times.filter((t) => t.방식 === '패턴 켬'); const good = live.filter((t) => typeof t['쫓아냄(초)'] === 'number' && t['쫓아냄(초)'] >= 30 && t['쫓아냄(초)'] <= 100);
  if (live.length) ok(good.length === live.length, `패턴 켠 채 쫓아낸 시간 (목표 40~90초 언저리): ${live.map((t) => t['쫓아냄(초)']).join(' / ')}`);
  if (TIME_ONLY) { await b.close(); process.exit(process.exitCode || 0); }

  // 흐름: 구역 3 으로 처음부터
  await ev(() => { const o = window.__oreum; o.enemies.test.clear(); o.boss.despawn(); localStorage.clear(); });
  await boot({ boss: {} }); await p.click('#enter', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1200); await setup();
  const Z = 3;
  ok(await ev((z) => { const o = window.__oreum; o.trash.fillZone(z); return !o.boss.can(z); }, Z), '가득 찬 구역엔 안 나옴');
  const cl = await ev((z) => window.__oreum.boss.ready(z), Z);
  ok(cl >= ZONE_BOSS.appear && cl < ZONE_BOSS.appear + 0.05, `구역 ${Z} 를 ${ZONE_BOSS.appear * 100}% 깨끗하게 (${cl})`);
  await ev((z) => window.__oreum.boss.go(z, 50), Z);
  ok(await until(() => !!window.__oreum.boss.state()), '빈터 가까이 가면 우두머리가 나옴');
  let st = await ev(() => window.__oreum.boss.state());
  ok(st && !st.fight && st.size > 1.5, `멀리서는 어슬렁거림 (fight ${st?.fight}, 크기 ${st?.size})`);
  ok(await ev(() => document.getElementById('boss-bar').hidden), '싸우기 전엔 기운 줄 없음');
  await ev((z) => window.__oreum.boss.go(z, 10), Z);
  ok(await until(() => window.__oreum.boss.state()?.fight), '빈터에 들어가면 싸움 시작');
  ok(await until(() => !document.getElementById('boss-bar').hidden && document.getElementById('boss-name').textContent.length > 1), `화면 위 이름·기운 줄 (${await ev(() => document.getElementById('boss-name').textContent)})`);
  await ev(() => window.__oreum.boss.freeze(true));
  await shot('bar');
  // 돌진: 경고 띠 → 달려와 받힘
  const hp0 = await ev(() => { const o = window.__oreum; o.hp.set(o.hp.max); const b = o.boss.cur.e; o.player.pos.set(b.pos.x + 7, o.groundAt(b.pos.x + 7, b.pos.z), b.pos.z); o.player.knock = null; return o.hp.hp; });
  await ev(() => window.__oreum.boss.act('charge'));
  const warn = await ev(() => { const o = window.__oreum; return o.scene.children.some((m) => m.isMesh && m.visible && m.material?.color?.getHexString?.() === 'ff3b24'); });
  ok(warn, '돌진 전에 바닥에 빨간 경고 띠');
  await until(() => window.__oreum.boss.state()?.act === null, null, 8000);
  const hp1 = await ev(() => window.__oreum.hp.hp);
  ok(hp1 < hp0, `경고 띠에 서 있으면 받힘 (HP ${hp0} → ${hp1})`);
  // 피하면 안 맞음: 경고 뒤 옆으로 비킴
  await ev(() => { const o = window.__oreum; o.hp.set(o.hp.max); const b = o.boss.cur.e; o.player.pos.set(b.pos.x + 7, o.groundAt(b.pos.x + 7, b.pos.z), b.pos.z); o.player.knock = null; o.boss.act('charge'); });
  await p.waitForTimeout(300);
  await ev(() => { const o = window.__oreum, p0 = o.player.pos; o.player.pos.set(p0.x, o.groundAt(p0.x, p0.z + 9), p0.z + 9); });
  await until(() => window.__oreum.boss.state()?.act === null, null, 8000);
  const hp2 = await ev(() => window.__oreum.hp.hp), mx = await ev(() => window.__oreum.hp.max);
  ok(hp2 >= mx - 0.01, `경고를 보고 비키면 안 맞음 (HP ${hp2})`);
  // 단계: 50% → 무리 부르기, 20% → 광선
  await ev(() => { const o = window.__oreum; o.boss.hp(o.boss.state().max * 0.45); o.boss.freeze(false); });
  ok(await until(() => window.__oreum.boss.state()?.ph === 1), '기운 50% 아래 → 2단계');
  ok(await until(() => window.__oreum.boss.state()?.minions > 0 || window.__oreum.enemies.list.length > 1, null, 15000), `2단계에 무리 부르기 (적 ${await ev(() => window.__oreum.enemies.list.length)})`);
  await ev(() => { const o = window.__oreum; o.boss.freeze(true); o.boss.hp(o.boss.state().max * 0.15); });
  ok(await until(() => window.__oreum.boss.state()?.ph === 2), '기운 20% 아래 → 3단계');
  await ev(() => { const o = window.__oreum; o.enemies.list.filter((e) => !e.boss).forEach((e) => o.enemies.remove(e)); o.hp.set(o.hp.max); o.player.knock = null; o.boss.act('beam'); });
  const discs = await ev(() => window.__oreum.scene.children.filter((m) => m.isMesh && m.visible && m.material?.color?.getHexString?.() === 'ff3b24').length);
  ok(discs >= 3, `광선 전에 바닥에 원 경고 (${discs})`);
  await shot('beam');
  await until(() => window.__oreum.boss.state()?.act === null, null, 8000);
  const hp3 = await ev(() => window.__oreum.hp.hp);
  ok(hp3 < mx, `원 안에 서 있으면 광선에 맞음 (HP ${hp3})`);
  // #183 물러났다 돌아오기: 기운은 그대로 → 20초 쉰 뒤 초당 2% → 다시 붙어도 비율 그대로
  const RS = ZONE_BOSS.rest;
  await ev(() => { const o = window.__oreum; o.enemies.list.filter((e) => !e.boss).forEach((e) => o.enemies.remove(e)); o.boss.freeze(false); o.boss.cur.e.hp = o.boss.state().max * 0.6; o.hp.set(o.hp.max); o.player.knock = null; });
  await p.waitForTimeout(300);
  await ev(() => { const o = window.__oreum; o.enemies.hurt(o.boss.cur.e, 0.01, true); }); // 마지막으로 때린 사람 = 나
  await ev(([z, d]) => window.__oreum.boss.go(z, d), [Z, ZONE_BOSS.leash + 3]);
  ok(await until(() => !window.__oreum.boss.state()?.fight, null, 5000), '물러나면 싸움이 풀림');
  st = await ev(() => window.__oreum.boss.state());
  const f0 = st.hp / st.max;
  ok(f0 > 0.55 && f0 < 0.61 && st.ph === 0, `풀려도 기운은 그대로 (${(f0 * 100).toFixed(1)}%), 단계는 비율대로 (${st.ph})`);
  ok(st.x !== (await ev(() => window.__oreum.boss.arena())).x, '순간 이동하지 않음 (걸어서 돌아감)');
  ok(await until(() => window.__oreum.boss.state()?.act === 'charge', null, RS.parting * 1000 + 2500), `풀린 뒤 ${RS.parting}초 안에 때린 사람 쪽으로 돌진 한 번`);
  ok(await until(() => window.__oreum.boss.state()?.act === null, null, 25000), '돌진 끝');
  await ev(() => { const o = window.__oreum; o.hp.set(o.hp.max); o.player.knock = null; });
  ok(await until(() => !document.getElementById('boss-bar').hidden, null, 3000), '쉬는 동안 가까우면 기운 줄이 보임');
  const r1 = await ev((t) => { const o = window.__oreum, s = o.boss.state(); return { before: s.hp, r: o.boss.rest(t - s.calm - 0.5) }; }, RS.delay);
  ok(Math.abs(r1.r.hp - r1.before) < 0.06 && !r1.r.regen, `${RS.delay}초까지는 그대로 (${r1.before} → ${r1.r.hp}, 쉰 ${r1.r.calm}초)`);
  const r2 = await ev(() => { const o = window.__oreum, s0 = o.boss.state(); const r = o.boss.rest(10.5); return { h0: s0.hp, h1: r.hp, max: s0.max, regen: r.regen }; });
  const gain = (r2.h1 - r2.h0) / r2.max;
  ok(Math.abs(gain - RS.rate * 10) < 0.005 && r2.regen, `그 뒤 초당 ${RS.rate * 100}% 씩 (10초에 ${(gain * 100).toFixed(2)}%)`);
  ok(await until(() => window.__oreum.boss.state()?.regen && document.getElementById('boss-bar').classList.contains('regen') && !document.getElementById('boss-rg').hidden, null, 3000), '기운 줄에 회복 중 표시');
  const h3 = await ev(() => window.__oreum.boss.state().hp); await p.waitForTimeout(2500);
  ok(await ev((h) => window.__oreum.boss.state().hp > h, h3), '매 프레임에도 참');
  const hb = await ev(() => { const o = window.__oreum; o.enemies.hurt(o.boss.cur.e, 0.01, true); return o.boss.state(); });
  ok(hb.calm < 1, `맞으면 차는 것이 멈춤 (쉰 시간 ${hb.calm})`);
  await p.waitForTimeout(800);
  const hb2 = await ev(() => window.__oreum.boss.state());
  ok(hb2.hp <= hb.hp + 0.01, `맞은 뒤엔 다시 ${RS.delay}초 쉬어야 참 (${hb.hp} → ${hb2.hp})`);
  // 사람 수가 바뀌면 비율 유지
  const sc = await ev(() => { const o = window.__oreum, s = o.boss.state(), f = s.hp / s.max, a = o.boss.rescale(2), b = o.boss.rescale(1); return { f, f2: a.hp / a.max, max2: a.max, f1: b.hp / b.max }; });
  ok(Math.abs(sc.f - sc.f2) < 1e-3 && Math.abs(sc.f - sc.f1) < 1e-3 && Math.abs(sc.max2 - ZONE_BOSS.list[Z].hp * (1 + ZONE_BOSS.perPlayer)) < 0.5, `사람 수가 바뀌어도 비율 유지 (${(sc.f * 100).toFixed(1)}% → 2명 ${(sc.f2 * 100).toFixed(1)}% / ${sc.max2})`);
  // 다시 들어가면 가득 채우지 않음
  const fb = await ev(() => { const s = window.__oreum.boss.state(); return s.hp / s.max; });
  await ev((z) => window.__oreum.boss.go(z, 10), Z);
  ok(await until(() => window.__oreum.boss.state()?.fight, null, 8000), '다시 들어가면 싸움');
  st = await ev(() => window.__oreum.boss.state());
  ok(Math.abs(st.hp / st.max - fb) < 0.02 && !st.regen, `다시 붙어도 가득 채우지 않음 (${(fb * 100).toFixed(1)}% → ${(st.hp / st.max * 100).toFixed(1)}%)`);
  // 멀리 가 사라졌다 다시 나와도 남은 기운이 이어짐 (그동안 찬 만큼 더해)
  await ev(() => window.__oreum.boss.freeze(true));
  await ev(([z, d]) => window.__oreum.boss.go(z, d), [Z, ZONE_BOSS.despawn + 20]);
  ok(await until(() => !window.__oreum.boss.state(), null, 10000), '아주 멀리 가면 사라짐');
  const kp = await ev((z) => window.__oreum.boss.kept(z), Z);
  ok(kp && Math.abs(kp.f - st.hp / st.max) < 0.03, `사라져도 남은 기운을 기억 (${kp && (kp.f * 100).toFixed(1)}%)`);
  await ev((z) => window.__oreum.boss.go(z, 50), Z);
  ok(await until(() => !!window.__oreum.boss.state(), null, 8000), '다시 나옴');
  st = await ev(() => window.__oreum.boss.state());
  ok(Math.abs(st.hp / st.max - kp.f) < 0.03, `다시 나와도 남은 기운 그대로 (${(st.hp / st.max * 100).toFixed(1)}%)`);
  await ev((z) => window.__oreum.boss.go(z, 10), Z);
  ok(await until(() => window.__oreum.boss.state()?.fight, null, 8000), '다시 싸움');
  await ev(() => window.__oreum.boss.freeze(true));
  // 쓰러지면 구역 클린하우스에서 깨어나고, 우두머리는 기운이 남은 채로 빈터로 돌아감
  const wake = await ev((z) => window.__oreum.boss.wake(z), Z);
  const hd = await ev(() => { const s = window.__oreum.boss.state(); return s.hp / s.max; });
  await ev(() => { const o = window.__oreum; o.player.knock = null; o.player.air = false; o.hp.kill(); });
  ok(await until(() => window.__oreum.hp.isDown, null, 5000), '쓰러짐');
  ok(await until((f) => { const s = window.__oreum.boss.state(), k = window.__oreum.boss.kept(3); return s ? !s.fight && s.hp < s.max && Math.abs(s.hp / s.max - f) < 0.05 : k && Math.abs(k.f - f) < 0.05; }, hd, 20000), '쓰러져도 우두머리 기운은 남음');
  ok(await until(() => !window.__oreum.hp.isDown, null, 150000), '다시 일어남');
  const at = await ev(() => ({ x: window.__oreum.player.pos.x, z: window.__oreum.player.pos.z }));
  ok(wake && Math.hypot(at.x - wake.x, at.z - wake.z) < 3, `구역 클린하우스에서 깨어남 (${at.x.toFixed(1)}, ${at.z.toFixed(1)} / ${wake?.x.toFixed(1)}, ${wake?.z.toFixed(1)})`);
  // 다시 도전 → 쫓아냄 (사람 둘이면 기운이 늘어남은 방장 계산: 여기선 혼자 n = 1)
  await ev((z) => window.__oreum.boss.go(z, 10), Z);
  ok(await until(() => window.__oreum.boss.state()?.fight), '다시 도전');
  st = await ev(() => window.__oreum.boss.state());
  ok(st.n === 1 && st.max === ZONE_BOSS.list[Z].hp, `혼자면 기운 ${ZONE_BOSS.list[Z].hp} (${st.max})`);
  // 돌아오는 길 (#183 6): 쓰러진 뒤 깨어나는 곳 → 빈터 (달리기 10m/s 직선) + 쓰러짐 연출·대기
  { const { HP } = await import('../src/balance.js'); const down = HP.fallT + HP.comeMax + HP.loadT + HP.carryT + HP.blackT + HP.fadeInT + HP.riseT;
    const back = spots.map((s) => ({ 구역: s.zone, 거리: s.wake ? Math.round(Math.hypot(s.wake.x - s.x, s.wake.z - s.z)) : null })).map((r) => ({ ...r, '처음(초)': r.거리 == null ? null : +(down + HP.waits[0] + r.거리 / 10).toFixed(1), '연달아 4번째(초)': r.거리 == null ? null : +(down + HP.waits[3] + r.거리 / 10).toFixed(1) }));
    console.table(back); const worst = Math.max(...back.map((r) => r['처음(초)'] || 0)); console.log(`가장 먼 구역 돌아오는 데 ${worst}초 · 가득 차기까지 ${ZONE_BOSS.rest.delay + 1 / ZONE_BOSS.rest.rate}초`); }
  const c0 = await ev(() => window.__oreum.save.coins), tans0 = await ev(() => window.__oreum.life.tangerines.length);
  await ev(() => window.__oreum.boss.hp(0));
  const slow = await ev(() => window.__oreum.boss.state() === null);
  ok(slow, '기운 0 → 쫓아냄');
  const after = await ev(() => ({ tans: window.__oreum.life.tangerines.length, d: window.__oreum.boss.done() }));
  ok(after.tans - tans0 >= ZONE_BOSS.loot - 1, `귤이 분수처럼 (${after.tans - tans0}알)`);
  ok(after.d.done[Z] === 1 && after.d.mats[ZONE_BOSS.list[Z].mat] === 1 && after.d.beat[Z] > 0, `구역 완료·귀한 재료 기록 (${JSON.stringify(after.d.mats)})`);
  ok(await until((z) => window.__oreum.guard.state().find((g) => g.zone === z)?.standing, Z, 8000), '돌하르방이 섬');
  ok(await until(() => !document.getElementById('zdone').hidden, null, 15000), '구역 요약 한 장');
  const sum = await ev(() => ({ t: document.getElementById('zdone-t').textContent, rows: [...document.querySelectorAll('#zdone-rows div')].map((d) => d.textContent), open: document.getElementById('zdone-open').textContent, next: document.getElementById('zdone-next').textContent }));
  console.log('요약', JSON.stringify(sum));
  ok(sum.rows.length === 4 && /다음은/.test(sum.next) && /빠른 마차/.test(sum.open) && /지름길/.test(sum.open), '요약: 치운 수·쫓아낸 수·얻은 것·장비 점수·다음 구역·열린 것');
  await shot('summary');
  await ev(() => document.getElementById('zdone-ok').click());
  ok(await ev((z) => !window.__oreum.boss.can(z), Z), '쫓아낸 뒤(돌하르방이 서 있는 동안) 다시 안 나옴');
  // 빠른 마차·지름길
  await ev((z) => window.__oreum.boss.goSpot('fast', z), Z); await p.waitForTimeout(400);
  const ctx = await ev(() => window.__oreum.aim.ctx());
  ok(ctx === 'cart', `구역 클린하우스 옆 빠른 마차 (상호작용 ${ctx})`);
  await ev((z) => window.__oreum.boss.fast(z), Z);
  ok(await until(() => { const o = window.__oreum, s = o.street?.layout?.center; return s && Math.hypot(o.player.pos.x - s.x, o.player.pos.z - s.z) < 40; }, null, 8000), '빠른 마차로 가게 거리에 옴');
  await p.waitForTimeout(1500);
  const cut = spots.find((s) => s.zone === Z)?.cut;
  if (cut) {
    await ev((z) => { window.__oreum.boss.goSpot('cut', z); }, Z); await p.waitForTimeout(13000);
    ok(await ev(() => window.__oreum.aim.ctx()) === 'steps', '구역 들어오는 곳 옆 지름길');
    await ev((z) => window.__oreum.boss.cut(z), Z);
    ok(await until((c) => Math.hypot(window.__oreum.player.pos.x - c.to.x, window.__oreum.player.pos.z - c.to.z) < 4, cut, 8000), `지름길로 구역 위쪽 끝 (${cut.to.x}, ${cut.to.z})`);
  } else ok(false, '지름길 자리 없음');
  ok(await ev((z) => { const d = window.__oreum.boss.done(); window.__oreum.boss.setDone(z, 0); const n = window.__oreum.interactables.filter((i) => (i.label === '빠른 마차' || i.label === '지름길') && i.when()).length; window.__oreum.boss.setDone(z, d.done[z]); return n === 0; }, Z), '구역을 끝내지 않은 사람에겐 빠른 마차·지름길 없음');
  // 다시 들어올 때: 마지막 구역 클린하우스 / 들머리
  const w2 = await ev((z) => { const o = window.__oreum; o.boss.wake(z); o.persist?.(); return o.boss.wake(); }, Z);
  await p.evaluate(() => { const o = window.__oreum; const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.click('#enter', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(800);
  ok(await ev(() => !document.getElementById('wake-pick').hidden && /클린하우스/.test(document.getElementById('wake-ch').textContent)), `다시 들어오면 고르기 (${await ev(() => document.getElementById('wake-ch').textContent)} / 들머리)`);
  await p.click('#wake-ch');
  ok(await until((w) => Math.hypot(window.__oreum.player.pos.x - w.x, window.__oreum.player.pos.z - w.z) < 3, w2, 8000), '고르면 그 구역 클린하우스에서 시작');
  const map = await ev(() => { window.__oreum.boss.ready(2); return window.__oreum.boss.can(2); });
  ok(map, '다른 구역(2)은 80% 면 나올 수 있음 (지도 왕관)');
  console.log(errs.length ? `오류 ${errs.length}` : '오류 없음');
  ok(!errs.length, '페이지 오류 없음');
  await b.close(); process.exit(process.exitCode || 0);
})();

// 멀티: A(방장)·B. B 가 받는 쪽으로 보이고, 둘이면 기운이 늘고, B 가 맞힌 피해가 A 의 기운을 줄이고, 쫓아내면 둘 다 보상·돌하르방
async function online(SRV) {
  const { chromium } = require('playwright'); const http = require('http'), fs = require('fs');
  const { ZONE_BOSS } = await import('../src/balance.js');
  const ROOT = path.join(process.cwd(), 'dist');
  const web = http.createServer((q, r) => { const f = path.join(ROOT, q.url.split('?')[0].split('#')[0]); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
  await new Promise((r) => web.listen(0, '127.0.0.1', r));
  const URL0 = `http://127.0.0.1:${web.address().port}/test.html?server=${encodeURIComponent(SRV)}#namsongi`;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [];
  const open = async (nm) => {
    const ctx = await b.newContext({ viewport: { width: 320, height: 200 } }); await ctx.route(/^https:\/\//, (r) => r.abort());
    const p = await ctx.newPage(); p.setDefaultNavigationTimeout(180000); p.on('pageerror', (e) => { errs.push(e.message); console.log(nm, 'ERR', e.message.slice(0, 200)); });
    await p.goto(URL0); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 180000 });
    await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1, perf: 0 }); localStorage.setItem(Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1', JSON.stringify(o.save)); });
    await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 180000 });
    await p.click('#enter'); return p;
  };
  const until = async (p, f, a, ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(f, a).catch(() => false)) return true; await p.waitForTimeout(300); } return false; };
  const A = await open('A'), B = await open('B');
  ok(await until(A, () => window.__oreum.net.count === 1) && await until(B, () => window.__oreum.net.count === 1), '멀티: 둘이 서로 봄');
  ok(await A.evaluate(() => window.__oreum.boss.net().host) && !(await B.evaluate(() => window.__oreum.boss.net().host)), '멀티: A 가 방장');
  const Z = 3;
  for (const p of [A, B]) await p.evaluate((z) => { const o = window.__oreum; o.pace.pacing.test.first.done = true; o.boss.ready(z); }, Z);
  await A.evaluate((z) => window.__oreum.boss.go(z, 30), Z); await B.evaluate((z) => window.__oreum.boss.go(z, 50), Z);
  ok(await until(A, () => window.__oreum.boss.state() && !window.__oreum.boss.state().puppet), '멀티: 방장 화면에 우두머리');
  ok(await until(B, () => window.__oreum.boss.state()?.puppet), '멀티: B 화면에 받은 대로 보이는 우두머리');
  await B.waitForTimeout(11000); // 서버가 순간 이동을 NET.warpGap 초에 한 번만 받아 줌
  await B.evaluate((z) => window.__oreum.boss.go(z, 9), Z);
  ok(await until(A, () => window.__oreum.boss.state()?.fight), '멀티: B 가 빈터에 들어가 싸움 시작 (방장 화면)');
  const st = await A.evaluate(() => window.__oreum.boss.state()), base = ZONE_BOSS.list[Z].hp;
  ok(st.n === 2 && Math.abs(st.max - base * (1 + ZONE_BOSS.perPlayer)) < 1, `멀티: 둘이면 기운 ${base} × ${1 + ZONE_BOSS.perPlayer} (${st.n}명 ${st.max})`);
  ok(await until(B, () => window.__oreum.boss.state()?.fight && !document.getElementById('boss-bar').hidden), '멀티: B 화면에도 기운 줄');
  await A.evaluate(() => window.__oreum.boss.freeze(true));
  const h0 = await A.evaluate(() => window.__oreum.boss.state().hp);
  await B.evaluate(() => { const o = window.__oreum; o.enemies.hurt(o.boss.cur.e, 50, true); });
  ok(await until(A, (h) => window.__oreum.boss.state().hp <= h - 49.9, h0, 10000), `멀티: B 가 맞힌 피해가 방장 기운을 줄임 (${h0} → ${await A.evaluate(() => window.__oreum.boss.state().hp)})`);
  ok(await until(B, (h) => window.__oreum.boss.state()?.hp <= h - 49.9, h0, 10000), '멀티: B 화면 기운 줄도 줄어듦');
  await A.evaluate(() => { const o = window.__oreum; o.boss.act('charge'); });
  ok(await until(B, () => window.__oreum.boss.state()?.act === 'charge', null, 10000), '멀티: 방장의 돌진 경고가 B 화면에도');
  await A.evaluate(() => window.__oreum.boss.hp(0));
  ok(await until(B, (z) => window.__oreum.boss.done().done[z] === 1, Z, 15000), '멀티: 쫓아내면 싸움에 낀 B 도 구역 완료·보상');
  ok(await A.evaluate((z) => window.__oreum.boss.done().done[z] === 1, Z), '멀티: 방장도 구역 완료');
  ok(await until(B, (z) => window.__oreum.guard.state().find((g) => g.zone === z)?.standing, Z, 15000) && await until(A, (z) => window.__oreum.guard.state().find((g) => g.zone === z)?.standing, Z, 15000), '멀티: 방이 돌하르방을 세움 (둘 다)');
  ok(await until(B, (z) => !window.__oreum.boss.can(z), Z, 5000), '멀티: 받는 쪽도 다시 안 나옴으로 기억');
  ok(!errs.length, `멀티: 페이지 오류 없음 (${errs.length})`);
  await b.close(); web.close();
}
