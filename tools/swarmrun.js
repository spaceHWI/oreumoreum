// 들판 떼 한 판 (#202): node tools/swarmrun.js [zone...] [--speed 3] [--mortal]
// dist/test.html 남송이 전투 오름에서 구역마다 권장 장비로 들판에 서서 __oreum.swarm.start(구역) → 0.6초(게임 시간)마다 던지며 한 판을 끝까지
// 기본은 기운을 늘 채우고 제자리에 둠(판의 모양을 보려고, 받혀 밀려도 되돌림). --mortal 이면 기운을 채우지 않음
// 적는 것: 물결별 나온 수 · 걸린 시간 · 쫓아낸 수 · 판에서 번 귤 · 덤 · 끝난 뒤 조용한지(쉬는 시간 · 5초 동안 새 판 없음) · 쉬는 시간을 지워도 저절로 시작하지 않고 징(#231)으로 다시 시작하는지
const { chromium } = require('playwright');
const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : +args[i + 1]; };
const ZONES = args.filter((a, i) => /^\d$/.test(a) && !/^--/.test(args[i - 1] || '')).map(Number); if (!ZONES.length) ZONES.push(1, 2);
const SPEED = arg('--speed', 3), GOD = !args.includes('--mortal');
const wait = (p, fn, arg0, ms = 400, max = 600) => (async () => { for (let i = 0; i < max; i++) { const v = await p.evaluate(fn, arg0); if (v) return v; if (i % 40 === 39) console.log('…', JSON.stringify(await p.evaluate(() => { const s = window.__oreum.swarm.state(); const L = window.__oreum.level.state(); return { t: s?.t, wall: s?.wall, stage: s?.stage, kills: s?.kills, n: s?.n, open: L.open, paused: L.paused, pend: L.pend, dr: L.draw, err: window.__lerr }; }))); await p.waitForTimeout(ms); } return null; })();
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 400 } });
  const errs = []; p.on('pageerror', (e) => { errs.push(e.message); console.log('ERR', e.message.slice(0, 300)); });
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1, recycle: { visits: 3 }, swarm: { seen: 1, best: {} } }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.click('#enter', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1500);
  console.log('들어옴'); await p.evaluate(() => { const o = window.__oreum; o.pace.pacing.test.first.done = true; o.pace.pacing.test.first.bloomed = true; o.setTod(13); o.setWeather('clear'); o.director.open('field'); o.director.open('level'); o.idle?.set({ warn: 1e6, rest: 1e6, hidden: 1e6 }); }); /* #273: 조작 없이 판 두 개를 돌면 '오래 멈춤' 쉬는 화면(#157)이 떠 게임이 멈췄음 */
  const res = [];
  for (const zn of ZONES) {
    const ok = await p.evaluate(({ zn, SPEED, GOD }) => {
      const o = window.__oreum; o.enemies.test.clear(); document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; });
      o.pace.pacing.test.soon(1e6); o.swarm.clearRest();
      Object.assign(o.save.equip, { tool: zn, bag: zn, shoes: zn }); o.save.equip.weapon = Math.max(1, zn); o.weapon.use(zn); o.level.notEarned(3000); o.save.coins = 3000; o.save.bowAmmo = 0; o.save.ammo = { gun: 0, mg: 0, laser: 0 };
      o.player.knock = null; o.hp.set(o.hp.max);
      const at = o.swarm.start(zn); if (!at) return false;
      o.swarm.speed(SPEED); o.swarm.setCap(24);
      const C = (window.__c = { t0: o.weapon.t(), next: 0, coins0: o.save.coins, lastS: null, lv0: o.level.state().lv });
      const loop = () => {
        const gt = o.weapon.t() - C.t0; if (gt >= C.next) { o.weapon.fire(); C.next = gt + 0.6; }
        if (GOD) { o.hp.set(o.hp.max); o.player.knock = null; }
        if (Math.hypot(o.player.pos.x - at.x, o.player.pos.z - at.z) > 2) { o.player.pos.x = at.x; o.player.pos.z = at.z; } /* 받혀 밀려도 제자리 (구역 밖으로 나가지 않게) */
        try { if (o.level.state().open) o.level.pick(0); } catch (e) { window.__lerr = String(e); }
        const s = o.swarm.state(); if (s) C.lastS = s;
        if (!C.stop) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop); return true;
    }, { zn, SPEED, GOD });
    if (!ok) { console.log('구역', zn, '들판 자리를 못 찾음'); continue; }
    const done = await wait(p, () => { const o = window.__oreum; return !o.swarm.state() && o.swarm.last ? o.swarm.last : null; }, null, 500, 900);
    const end = await p.evaluate(() => { const o = window.__oreum, C = window.__c; return { gt: +(o.weapon.t() - C.t0).toFixed(1), coins: o.save.coins - C.coins0, won: o.swarm.won(), lvUp: o.level.state().lv - C.lv0, s: C.lastS }; });
    const restZ = await p.evaluate((zn) => window.__oreum.swarm.rest(zn), zn);
    await p.waitForTimeout(5000 / SPEED + 1500);
    const quiet = await p.evaluate(() => { const o = window.__oreum; return { run: !!o.swarm.state(), why: o.swarm.why(), swarmLive: o.enemies.list.filter((e) => e.def.swarm && e.state !== 'leave' && e.state !== 'flee').length }; });
    await p.evaluate(() => window.__oreum.swarm.ageRest(1e4));
    const selfStart = await wait(p, () => !!window.__oreum.swarm.state(), null, 300, 15); /* #231: 쉬는 시간이 끝나도 징을 울리기 전엔 시작하지 않아야 함 */
    const again = !selfStart && (await p.evaluate((z) => window.__oreum.swarm.gong(z) === '', zn)) && (await wait(p, () => !!window.__oreum.swarm.state(), null, 300, 30));
    await p.evaluate(() => { const o = window.__oreum; window.__c.stop = 1; o.swarm.stop(); o.swarm.speed(1); o.enemies.test.clear(); o.swarm.clearRest(); });
    const row = { 구역: zn, 끝: done?.why, '판(초)': done?.wall, 게임초: end.gt, 물결별: (done?.waves || []).join('/'), 쫓아냄: done?.kills, '번 귤(판)': done?.gyul, 덤: done?.bonus, '귤 차이': end.coins, '쉬는 시간(초)': Math.round(restZ), '끝난 뒤 판': quiet.run, 까닭: quiet.why, '남은 떼': quiet.swarmLive, '저절로 시작': !!selfStart, '징으로 다시 시작': !!again, 레벨업: end.lvUp };
    console.log(JSON.stringify(row)); res.push(row);
    await p.waitForTimeout(800);
  }
  console.table(res);
  const bad = res.filter((r) => r.끝 !== 'win' || r['끝난 뒤 판'] || r.까닭 !== 'rest' || r['저절로 시작'] || !r['징으로 다시 시작'] || !(r.덤 > 0));
  console.log(errs.length ? `페이지 오류 ${errs.length}` : '페이지 오류 없음', bad.length ? `· 실패 ${bad.map((r) => r.구역).join(',')}` : '· ALL OK');
  await b.close();
  process.exit(bad.length || errs.length ? 1 : 0);
})();
