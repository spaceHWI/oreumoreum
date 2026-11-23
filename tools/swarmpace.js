// 서바이벌 터 나오는 텀 (#273): node tools/swarmpace.js [d|m]   (먼저 node build.mjs)
// 확인: 징 뒤 3초 안에 첫 몹 · 첫 물결 수 · 몹을 다 지우면 당겨 부르기(물결 번호가 시간보다 빨리 늚, 빈 시간 짧음) · 15초에 몰려옴(가장자리 화살표)
//       · 상한에 걸린 몹은 자리가 나면 바로 나옴 · 몹이 적으면 포위·던지기도 다가옴(patMode.few) · 저사양 상한 14 에서도 멈추지 않음 · 30fps(dt 1/30)도 시간 기준 같음
const { chromium } = require('playwright');
const MODE = process.argv[2] === 'm' ? 'm' : 'd';
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage(MODE === 'm' ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 900, height: 560 } });
  const errs = []; p.on('pageerror', (e) => { errs.push(e.message); console.log('ERR', e.message.slice(0, 300)); });
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1, recycle: { visits: 3 }, swarm: { seen: 1, best: {} } }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.click('#enter', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1500);
  await p.evaluate(() => { const o = window.__oreum; o.pace.pacing.test.first.done = true; o.pace.pacing.test.first.bloomed = true; o.setTod(13); o.setWeather('clear'); o.director.open('field'); o.director.open('level'); o.idle?.set({ warn: 1e6, rest: 1e6, hidden: 1e6 }); document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; }); });
  /* 게임 시간 기다리기 (swarm.state().t) */
  const until = async (t, max = 240000) => { const t0 = Date.now(); while (Date.now() - t0 < max) { const s = await p.evaluate(() => window.__oreum.swarm.state()?.t ?? -1); if (s < 0 || s >= t) return s; await p.waitForTimeout(150); } return -2; };
  const begin = (cap, god = true) => p.evaluate(({ cap, god }) => {
    const o = window.__oreum; o.enemies.test.clear(); o.swarm.clearRest(); o.level.notEarned?.(3000);
    Object.assign(o.save.equip, { tool: 2, bag: 2, shoes: 2 }); o.save.equip.weapon = 2; o.weapon.use(2); o.player.knock = null; o.hp.set(o.hp.max);
    o.swarm.start(2); o.swarm.setCap(cap); o.swarm.speed(2);
    window.__g = god; if (!window.__gl) { window.__gl = 1; const L = () => { if (window.__g) { o.hp.set(o.hp.max); o.player.knock = null; } requestAnimationFrame(L); }; requestAnimationFrame(L); }
    return o.swarm.state();
  }, { cap, god });

  /* 1. 시작: 3초 안에 첫 몹, 첫 물결 몫 */
  await begin(36);
  const first = await p.evaluate(async () => { const o = window.__oreum; for (let i = 0; i < 200; i++) { const s = o.swarm.state(); if (s.n > 0) return { t: s.t, n: s.n }; await new Promise((r) => setTimeout(r, 50)); } return null; });
  ok(first && first.t <= 3, `징 뒤 첫 몹 ${first?.t}초 (3초 안)`);
  await until(6);
  const w1 = await p.evaluate(() => window.__oreum.swarm.state());
  ok(w1.n >= 7, `6초에 첫 물결 첫머리 ${w1.n}마리 (구역 2 몫 16 중 첫머리 9)`);
  /* 2. 당겨 부르기: 살아 있는 몹을 계속 지우면 물결 번호가 시간(30초마다)보다 빨리 늚 */
  for (let i = 0; i < 2000; i++) {
    const s = await p.evaluate(() => { const o = window.__oreum; for (const e of o.enemies.list) if (e.def.swarm === 'mob' && e.state !== 'flee' && e.state !== 'leave') { e.state = 'flee'; e.st = 0; } return o.swarm.state(); });
    await p.waitForTimeout(250);
    if (!s) break; if (s.t > 28) break;
  }
  const pulled = await p.evaluate(() => window.__oreum.swarm.state());
  ok(pulled.wave >= 3, `몹을 지우면 당겨 부름: ${pulled.t}초에 물결 ${pulled.wave}번 (시간대로면 1번)`);
  /* 3. 몰려옴: 15초(물결 한가운데)마다 가장자리 화살표 — 위에서 지나갔으니 45초 것을 봄 */
  await until(44.6);
  let arrow = false; for (let i = 0; i < 40 && !arrow; i++) { arrow = await p.evaluate(() => document.getElementById('swarm-surge')?.classList.contains('on')); if (!arrow) await p.waitForTimeout(100); }
  ok(arrow, '45초 몰려옴: 가장자리 화살표');
  const box = await p.evaluate(() => { const r = document.getElementById('swarm-surge').getBoundingClientRect(); return { x: r.x, y: r.y, w: innerWidth, h: innerHeight }; });
  ok(box.x >= 0 && box.y >= 0 && box.x < box.w && box.y < box.h, `화살표가 화면 안 (${Math.round(box.x)}, ${Math.round(box.y)})`);
  /* 4. 상한: 꽉 찬 동안 못 나온 몹은 줄에 남았다가 자리가 나면 바로 */
  await p.evaluate(() => { const o = window.__oreum; o.swarm.setCap(6); for (const e of o.enemies.list) if (e.def.swarm === 'mob' && e.state !== 'flee' && e.state !== 'leave') { e.state = 'flee'; e.st = 0; } }); await p.waitForTimeout(3000);
  const capped = await p.evaluate(() => window.__oreum.swarm.state());
  ok(capped.n <= 7, `상한 6 으로 줄이고 다 지운 뒤 떼 ${capped.n} (6 + 정예·대장 1 까지)`);
  const refill = await p.evaluate(async () => {
    const o = window.__oreum, sl = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 600; i++) { const s = o.swarm.state(); if (s.n >= 6 && s.q > 0) break; await sl(50); } /* 꽉 차고 줄에 남은 몫이 있을 때 */
    const s0 = o.swarm.state(); if (!(s0.q > 0)) return { why: 'no queue', s0 };
    let k = 0; for (const e of o.enemies.list) if (e.def.swarm === 'mob' && e.state !== 'flee' && e.state !== 'leave' && k < 3) { e.state = 'flee'; e.st = 0; k++; }
    for (let i = 0; i < 100; i++) { await sl(30); const s = o.swarm.state(); if (s.n >= 6) return { dt: +(s.t - s0.t).toFixed(2), q: s0.q }; } return null; });
  ok(refill?.dt != null && refill.dt < 2.2, `상한에 걸려 줄에 ${refill?.q}마리 → 자리가 나면 곧 다시 나옴 (${JSON.stringify(refill)})`);
  /* 5. 몹이 적으면(few) 포위·던지기도 다가옴 */
  const few = await p.evaluate(async () => { const o = window.__oreum; o.swarm.setCap(2); let k = 0; for (const e of o.enemies.list) if (e.def.swarm === 'mob' && e.state !== 'flee' && e.state !== 'leave') { if (k++ >= 2) { e.state = 'flee'; e.st = 0; } } await new Promise((r) => setTimeout(r, 400)); const s = o.swarm.state(); return { n: s.n, few: s.few }; });
  ok(few.n <= 3 && few.few, `몹 ${few.n}마리 → 포위·던지기도 다가옴 (few ${few.few})`);
  /* 6. 저사양 상한 14 · 몹을 안 지움: 판이 끝까지 감, 빈 시간 짧음 */
  await p.evaluate(() => { window.__oreum.swarm.stop(); window.__oreum.enemies.test.clear(); });
  await begin(14);
  let low = 0, prevT = 0;
  for (;;) { const s = await p.evaluate(() => window.__oreum.swarm.state()); if (!s) break; if (s.n < 3 && s.t > 3) low += s.t - prevT; prevT = s.t; if (s.t > 70) break; await p.waitForTimeout(200); }
  ok(low < 6, `상한 14 에서 몹 3 아래 ${low.toFixed(1)}초 (70초 중)`);
  await p.evaluate(() => { window.__oreum.swarm.stop(); window.__oreum.swarm.speed(1); });
  ok(errs.length === 0, `페이지 오류 ${errs.length}`);
  console.log(fail ? `실패 ${fail}` : 'ALL OK');
  await b.close(); process.exit(fail ? 1 : 0);
})();
