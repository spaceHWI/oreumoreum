// 맞은 뒤 몸이 바로 서는지 (#107, #80): 여러 상황에서 적에게 맞게 한 뒤 2초 지나 캐릭터 몸(root)의 위쪽이 하늘 쪽과 5도 안인지 본다
//   node build.mjs && node tools/hittilt.js   → 상황마다 기울기(도), 넘으면 FAIL 과 exit 1
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 480, height: 300 } }); const errs = [];
  p.on('pageerror', (e) => { errs.push(e.message.slice(0, 200)); console.log('ERR', e.message.slice(0, 200)); });
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await p.waitForTimeout(6000);
  await p.click('#enter').catch(() => {}); await p.click('#intro-srv button[data-srv="battle"]').catch(() => {}); await p.click('#srv-go').catch(() => {}); await p.waitForTimeout(6000);
  const ok = await p.evaluate(() => !!(window.__oreum && window.__oreum.life && window.__oreum.life.hooks.enemyHit));
  // 게임 시간으로 기다림 (느린 헤드리스는 한 프레임 dt 가 0.05 로 잘려 실제 시간보다 느리게 감)
  await p.evaluate(() => { window.__gt = 0; let l = performance.now(); const f = (n) => { window.__gt += Math.min(0.05, (n - l) / 1000); l = n; requestAnimationFrame(f); }; requestAnimationFrame(f); });
  const waitGame = async (sec) => { const t0 = await p.evaluate(() => window.__gt); await p.waitForFunction((e) => window.__gt >= e, t0 + sec, { timeout: 120000, polling: 50 }); };
  if (!ok) { console.log('FAIL __oreum.life.hooks.enemyHit 없음'); await b.close(); process.exit(1); }
  // 기본 자리: 플레이어 근처 평지·비탈 하나씩 찾음
  const spots = await p.evaluate(() => {
    const O = window.__oreum, P = O.player.pos, slope = (x, z) => Math.hypot(O.height(x + 0.5, z) - O.height(x - 0.5, z), O.height(x, z + 0.5) - O.height(x, z - 0.5));
    let flat = null, steep = null, best = 0;
    for (let r = 0; r < 60 && (!flat || !steep); r += 3) for (let a = 0; a < 6.28; a += 0.5) {
      const x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r, s = slope(x, z);
      if (!flat && s < 0.05) flat = [x, z];
      if (s > best) { best = s; steep = [x, z]; }
    }
    return { flat: flat || [P.x, P.z], steep, grade: +best.toFixed(2) };
  });
  console.log('평지', spots.flat.map((v) => v.toFixed(1)).join(','), '비탈', spots.steep && spots.steep.map((v) => v.toFixed(1)).join(','), '기울기', spots.grade);
  // 한 상황: 자리 잡고(prep) → 맞음(n번, gap 초 간격) → 2초 뒤 기울기
  async function run(name, { at = 'flat', prep = null, n = 1, gap = 0.25, move = null, dmg = 0 } = {}) {
    await p.evaluate(([xz, h]) => { const O = window.__oreum; O.keys.clear(); O.rides?.off?.(); O.lifeModels?.dismount?.(); O.tp(xz[0], xz[1], h); }, [spots[at] || spots.flat, Math.random() * 6.28]);
    await p.waitForTimeout(300);
    if (prep) { await p.evaluate(prep).catch((e) => console.log('  prep 실패', e.message.slice(0, 100))); await p.waitForTimeout(250); }
    if (move) await p.evaluate((k) => window.__oreum.keys.add(k), move);
    for (let i = 0; i < n; i++) {
      await p.evaluate((dmg) => { const O = window.__oreum, a = Math.random() * 6.28; O.life.hooks.enemyHit(new O.player.pos.constructor(Math.sin(a), 0, Math.cos(a)), { dmg, name: '멧돼지' }); }, dmg);
      await waitGame(gap);
    }
    const mid = await p.evaluate(() => { const r = window.__oreum.runner.root; const u = new r.up.constructor(0, 1, 0).applyQuaternion(r.quaternion); return Math.acos(Math.min(1, u.y)) * 180 / Math.PI; });
    if (move) { await waitGame(0.6); await p.evaluate(() => window.__oreum.keys.clear()); await waitGame(1.4); } else await waitGame(2);
    const r = await p.evaluate(() => { const O = window.__oreum, root = O.runner.root; root.updateMatrixWorld(true); const u = new root.up.constructor(0, 1, 0).applyQuaternion(root.quaternion); return { deg: Math.acos(Math.min(1, u.y)) * 180 / Math.PI, knock: !!O.player.knock, down: !!O.hp.isDown }; });
    return { name, mid: +mid.toFixed(1), deg: +r.deg.toFixed(1), knock: r.knock, down: r.down };
  }
  const out = [];
  out.push(await run('평지 한 번'));
  out.push(await run('비탈 한 번', { at: 'steep' }));
  out.push(await run('연달아 4번', { n: 4, gap: 0.15 }));
  out.push(await run('비탈 연달아', { at: 'steep', n: 3, gap: 0.3 }));
  out.push(await run('달리는 중', { move: 'w', prep: () => { window.__oreum.save.walk = 0; } }));
  out.push(await run('맞고 바로 움직임 (#80)', { move: 'd' }));
  out.push(await run('던지는 중', { prep: () => window.__oreum.aim.throw() }));
  out.push(await run('줍는 중', { prep: () => window.__oreum.aim.pick() }));
  out.push(await run('동작 중', { prep: () => window.__oreum.doEmote(window.__oreum.emo ? 'wave' : 'wave') }));
  out.push(await run('탈것', { prep: () => { const O = window.__oreum; O.rides.give('scoot'); O.rides.mount('scoot'); } }));
  out.push(await run('노루 타기', { prep: () => window.__oreum.lifeModels.mount(0) }));
  // 쓰러졌다 일어나기 (전투 오름 #36): 체력 0 → 들것 → 되살아남. 끝날 때까지 기다림
  const battle = await p.evaluate(() => window.__oreum.server.isBattle());
  if (battle) {
    const r = await run('쓰러진 뒤 되살아남', { dmg: 999 });
    await p.waitForFunction(() => !window.__oreum.hp.isDown && !window.__oreum.hp.pending, null, { timeout: 90000 }).catch(() => {});
    await waitGame(2);
    r.deg = await p.evaluate(() => { const root = window.__oreum.runner.root; const u = new root.up.constructor(0, 1, 0).applyQuaternion(root.quaternion); return +(Math.acos(Math.min(1, u.y)) * 180 / Math.PI).toFixed(1); });
    r.down = await p.evaluate(() => !!window.__oreum.hp.isDown);
    out.push(r);
  } else console.log('(깨끗한 서버라 쓰러짐은 건너뜀)');
  let fail = 0;
  for (const r of out) { const bad = r.deg > 5 || r.knock || r.down; if (bad) fail++; console.log(`${bad ? 'FAIL' : 'ok  '} ${r.name}: 맞은 직후 ${r.mid}° → 2초 뒤 ${r.deg}°${r.knock ? ' (아직 넉백)' : ''}${r.down ? ' (아직 쓰러짐)' : ''}`); }
  if (errs.length) { fail++; console.log('페이지 오류', errs.length); }
  await b.close();
  process.exit(fail ? 1 : 0);
})();
