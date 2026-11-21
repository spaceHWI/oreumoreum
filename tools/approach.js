// 다가가서 쏘기 확인 (#132): node tools/approach.js
// dist/test.html 남송이 전투 오름에서 사거리(손 24m) 밖 30~40m 에 멈춰 선 아기 멧돼지 3마리를 세우고 F 를 한 번(80ms) 눌러
// 차례로 다가가 쫓아내는지, 직접 움직이면(W) 풀리는지, 기운이 낮으면 다가가지 않는지, 적이 없으면 예전처럼 앞으로 던지는지 봄
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 400 } });
  const errs = []; p.on('pageerror', (e) => { errs.push(e.message); console.log('ERR', e.message.slice(0, 300)); });
  const url = 'file://' + process.cwd() + '/dist/test.html#namsongi';
  await p.goto(url); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1 }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.click('#enter', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1500);
  await p.evaluate(() => { const o = window.__oreum; o.pace.pacing.test.first.done = true; o.pace.pacing.test.first.bloomed = true; o.setTod(13); o.setWeather('clear'); });
  const gt = () => p.evaluate(() => window.__oreum.weapon.t());
  const waitG = async (sec) => { const t0 = await gt(); while ((await gt()) - t0 < sec) await p.waitForTimeout(50); };
  const setup = (spots, hpFrac = 1) => p.evaluate(({ spots, hpFrac }) => {
    const o = window.__oreum; o.enemies.test.clear(); document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; });
    o.save.equip.weapon = 1; o.weapon.use(1); o.save.coins = 500;
    const x = -60, z = 40; o.player.pos.set(x, o.groundAt(x, z), z); o.player.heading = Math.PI / 2; o.player.knock = null; o.player.pose = 'move'; o.player.target = null;
    o.hp.set(o.hp.max * hpFrac); window.__pin = hpFrac < 1; if (window.__pin) { const pin = () => { if (!window.__pin) return; o.hp.set(o.hp.max * hpFrac); requestAnimationFrame(pin); }; requestAnimationFrame(pin); } // 기운이 저절로 차지 않게 o.aim.setLock(null); o.approach.stop();
    window.__es = spots.map(([dx, dz, kind = 'piglet']) => { const e = o.enemies.test.spawn(kind, dx, dz); e.def = { ...e.def, walk: 0, chase: 0, sight: 0, rootEvery: [999, 999] }; e.hp = e.max = 1; return e; });
    window.__x0 = { x: o.player.pos.x, z: o.player.pos.z };
  }, { spots, hpFrac });
  const st = () => p.evaluate(() => { const o = window.__oreum; return { ...o.approach.state(), left: window.__es.filter((e) => o.enemies.list.includes(e) && e.state !== 'flee' && e.state !== 'leave').length, moved: +Math.hypot(o.player.pos.x - window.__x0.x, o.player.pos.z - window.__x0.z).toFixed(1) }; });
  const tap = async () => { await p.keyboard.down('f'); await p.waitForTimeout(80); await p.keyboard.up('f'); };
  const out = {};
  if (process.argv[2] === 'low') { await setup([[40, 0]], 0.2); await waitG(0.3); await tap(); for (let i = 0; i < 6; i++) { await waitG(0.4); console.log(JSON.stringify(await st()), await p.evaluate(() => [window.__oreum.hp.hp, window.__oreum.hp.max])); } await b.close(); return; }
  // 1) 사거리 밖 3마리를 버튼 한 번으로
  await setup([[32, 0], [30, 14], [36, -14]]); await waitG(0.3); await tap();
  let s; const log = [];
  for (let i = 0; i < 60; i++) { await waitG(1); s = await st(); log.push(`${i + 1}s d=${s.d} 걸음=${s.walking} 남은=${s.left} 던짐=${s.shots}`); if (!s.on) break; }
  console.log(log.join('\n'));
  out['3마리 차례로'] = { ...s, ok: s.left === 0 && !s.on && s.why === 'none' && s.moved > 3 };
  // 2) 직접 움직이면 풀림
  await setup([[40, 0]]); await waitG(0.3); await tap(); await waitG(1); const s2a = await st();
  await p.keyboard.down('w'); await waitG(0.3); await p.keyboard.up('w'); const s2 = await st();
  out['W 누르면 풀림'] = { 누르기전: s2a.on && s2a.walking, ...s2, ok: s2a.on && s2a.walking && !s2.on && s2.why === 'move' };
  // 3) 기운 낮으면 다가가지 않음
  await setup([[40, 0]], 0.2); await waitG(0.3); await tap(); await waitG(2); const s3 = await st();
  out['기운 20% 제자리'] = { ...s3, ok: s3.on && !s3.walking && s3.moved < 1 && s3.shots > 0 };
  // 4) 줍기 버튼이면 줍기로
  await setup([[40, 0]]); await waitG(0.3); await tap(); await waitG(0.5); await p.evaluate(() => window.__oreum.trash?.press()); await waitG(0.2); const s4 = await st();
  out['줍기 누르면 풀림'] = { ...s4, ok: !s4.on };
  // 6) 손으로 못 잡는 외계인뿐이면 켜지지 않고 '무기가 필요해요'
  await setup([[40, 0, 'alien']]); await waitG(0.3); await tap(); await waitG(0.3); const s6 = await st(); const t6 = await p.evaluate(() => document.getElementById('toast').textContent);
  out['외계인뿐(손)'] = { ...s6, toast: t6, ok: !s6.on && /무기가 필요/.test(t6) };
  // 7) 외계인과 아기 멧돼지가 같이 있으면 멧돼지부터
  await setup([[30, 0, 'alien'], [38, 6]]); await waitG(0.3); await tap(); await waitG(0.2); const s7 = await st();
  out['외계인은 뒤로'] = { ...s7, ok: s7.on && s7.kind === 'piglet' };
  // 8) 길게 누르는 동안은 다가가지 않고 모으기만, 놓으면 쏨
  await setup([[34, 0]]); await waitG(0.3); await p.keyboard.down('f'); await waitG(1.3); const s8a = await st(); const k8 = await p.evaluate(() => window.__oreum.charge.state().k); await p.keyboard.up('f'); await waitG(0.4); const sh8 = await p.evaluate(() => window.__oreum.charge.state().shots.length);
  out['모으는 동안 멈춤'] = { ...s8a, k: k8, ok: s8a.on && !s8a.walking && s8a.moved < 1.5 && k8 > 0.5 && sh8 > 0 };
  // 5) 적이 없으면 예전처럼 앞으로 던짐
  await setup([]); await waitG(0.3); await tap(); await waitG(0.6); const s5 = await st(); const pose = await p.evaluate(() => window.__oreum.charge.state().shots.length);
  out['적 없음'] = { ...s5, ok: !s5.on && s5.moved < 0.5 };
  console.table(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { ok: v.ok, why: v.why, shots: v.shots, moved: v.moved, left: v.left }])));
  const bad = Object.entries(out).filter(([, v]) => !v.ok).map(([k]) => k);
  console.log(bad.length ? '실패: ' + bad.join(', ') : '모두 통과', errs.length ? `오류 ${errs.length}` : '오류 없음');
  await b.close();
  process.exit(errs.length || bad.length ? 1 : 0);
})();
