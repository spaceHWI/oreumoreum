// 쏠 때마다 가장 가까운 적 (#319): node tools/nearaim.js
// dist/test.html 남송이 전투 오름에서 멈춰 선 적을 세우고 __oreum.aim 으로 확인
//  1) 먼 적을 잡은 채 가까운 적이 다가오면 다음 발(shot)이 가까운 적에게
//  2) 직접 고른(setLock) 먼 적은 COMBAT.pickHold 초 동안 유지, 그 뒤 가까운 적
//  3) 거의 같은 거리(차이 < COMBAT.nearHys) 두 적 사이에서 머신건 연사 중 타겟이 떨리지 않음(바뀐 횟수)
//  4) 머신건 연사 중 한 발마다 다시 고름: 연사 도중 더 가까운 적이 나타나면 다음 발부터 그쪽
//  5) 쏘지 않을 때의 표시(aim.target)도 가장 가까운 적
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
  // spots: [dx, dz] 플레이어 기준. 적은 멈춰 있고 잘 죽지 않게
  const setup = (spots, weapon = 1) => p.evaluate(({ spots, weapon }) => {
    const o = window.__oreum; o.enemies.test.clear(); document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; });
    o.save.equip.weapon = Math.max(o.save.equip.weapon || 1, weapon); o.weapon.use(weapon); o.save.coins = 5000;
    const x = -60, z = 40; o.player.pos.set(x, o.groundAt(x, z), z); o.player.heading = Math.PI / 2; o.player.knock = null; o.player.pose = 'move'; o.player.target = null;
    o.aim.setLock(null); o.approach?.stop?.();
    window.__es = spots.map(([dx, dz]) => { const e = o.enemies.test.spawn('piglet', dx, dz); e.def = { ...e.def, walk: 0, chase: 0, sight: 0, rootEvery: [999, 999] }; e.hp = e.max = 1e6; return e; });
    window.__ix = (t) => window.__es.findIndex((e) => e.pos === t?.pos);
  }, { spots, weapon });
  const idx = (fn) => p.evaluate((fn) => window.__ix(window.__oreum.aim[fn]()), fn);
  const out = {};
  // 1) 먼 적(18m)만 있을 때 잡힘 → 가까운 적(6m)으로 옮겨 오면 다음 발은 가까운 적
  await setup([[18, 0], [0, 26]]); await p.waitForTimeout(300);
  const a1 = await idx('shot');
  await p.evaluate(() => { const o = window.__oreum, e = window.__es[1]; e.pos.set(o.player.pos.x + 1, e.pos.y, o.player.pos.z + 6); });
  const b1 = await idx('shot');
  out['다가온 적을 쏨'] = { 처음: a1, 다음발: b1, ok: a1 === 0 && b1 === 1 };
  // 2) 직접 고른 먼 적은 유지 → pickHold 초 뒤 가까운 적
  await setup([[18, 0], [6, 2]]); await p.waitForTimeout(300);
  await p.evaluate(() => { const o = window.__oreum; o.aim.setLock(o.life.aimTargets().find((t) => t.pos === window.__es[0].pos)); });
  const held = await idx('shot');
  await p.waitForTimeout(1500); const mid = await idx('shot');
  const hold = 4; /* COMBAT.pickHold */ await p.waitForTimeout(hold * 1000 - 1000);
  const after = await idx('shot');
  out['직접 고른 타겟 유지'] = { 고름: held, '1.5초': mid, [`${hold}.5초`]: after, ok: held === 0 && mid === 0 && after === 1 };
  // 3) 거의 같은 거리 두 적(10m, 10.3m) 사이에서 머신건 연사, 플레이어가 조금씩 흔들려도 타겟이 떨리지 않음
  await setup([[10, 0], [0, 10.3]], 4); await p.waitForTimeout(300);
  await p.evaluate(() => { const P = window.__es.map((e) => e.pos.clone()); window.__pinE = true; const pin = () => { if (!window.__pinE) return; window.__es.forEach((e, i) => e.pos.copy(P[i])); requestAnimationFrame(pin); }; requestAnimationFrame(pin); }); /* 맞아 밀려나는 것(flinch)은 빼고 거리 차이만 봄 */
  const s0 = await p.evaluate(() => window.__oreum.aim.swaps());
  await p.keyboard.down('f');
  for (let i = 0; i < 20; i++) { await p.evaluate((i) => { const o = window.__oreum; o.player.pos.x += (i % 2 ? 0.12 : -0.12); o.player.pos.z += (i % 2 ? -0.1 : 0.1); }, i); await p.waitForTimeout(100); }
  await p.keyboard.up('f');
  const s3 = await p.evaluate(() => window.__oreum.aim.swaps()) - s0; await p.evaluate(() => { window.__pinE = false; });
  out['연사 중 떨림 없음'] = { 바뀐횟수: s3, ok: s3 === 0 };
  // 4) 연사 중 더 가까운 적이 나타나면 다음 발부터 그쪽 (한 발마다 다시 고름)
  await setup([[14, 0]], 4); await p.waitForTimeout(300);
  await p.keyboard.down('f'); await p.waitForTimeout(500);
  const firstT = await p.evaluate(() => window.__ix(window.__oreum.aim.lock()));
  await p.evaluate(() => { const o = window.__oreum, e = o.enemies.test.spawn('piglet', 0, 5); e.def = { ...e.def, walk: 0, chase: 0, sight: 0, rootEvery: [999, 999] }; e.hp = e.max = 1e6; window.__es.push(e); });
  await p.waitForTimeout(500);
  const nowT = await p.evaluate(() => window.__ix(window.__oreum.aim.lock()));
  await p.keyboard.up('f');
  out['연사 중 가까운 적으로'] = { 처음: firstT, 나중: nowT, ok: firstT === 0 && nowT === 1 };
  // 5) 쏘지 않을 때 표시도 가장 가까운 적
  await setup([[16, 3], [7, -4], [12, 9]]); await p.waitForTimeout(400);
  const mk = await idx('target'), mkVis = await p.evaluate(() => window.__oreum.aim.mark.visible);
  out['표시 = 가장 가까운 적'] = { 표시: mk, 보임: mkVis, ok: mk === 1 && mkVis };
  console.table(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v])));
  const bad = Object.entries(out).filter(([, v]) => !v.ok).map(([k]) => k);
  console.log(bad.length ? '실패: ' + bad.join(', ') : '모두 통과', errs.length ? `오류 ${errs.length}` : '오류 없음');
  await b.close(); process.exit(bad.length || errs.length ? 1 : 0);
})();
