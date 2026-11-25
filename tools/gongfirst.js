// 징 → 첫 적 (#310): node tools/gongfirst.js [d|m]   (먼저 node build.mjs)
// 구역 1~5 터마다 징 앞(길 쪽)에서 징을 보고 F(폰은 상호작용 버튼과 같은 길) → 판 시작
// 잼: 첫 몹이 생긴 때(spawn) · 첫 몹이 화면 안(카메라 앞, 화면 테두리 안, 40m 안)에 보인 때(see) · 첫 몹이 플레이어 6m 안(쏘는 적은 쏠 수 있는 거리 안)에 온 때(fight)
// 목표: see ≤ 3초, fight ≤ 5초 (판 시계 run.t = 게임 시간, 느린 소프트웨어 GL 에서도 같은 기준)
const { chromium } = require('playwright');
const MODE = process.argv[2] === 'm' ? 'm' : 'd';
let fails = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage(MODE === 'm' ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 900, height: 560 } });
  const errs = []; p.on('pageerror', (e) => { errs.push(e.message); console.log('ERR', e.message.slice(0, 300)); });
  const ev = (fn, a) => p.evaluate(fn, a);
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await ev(() => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1, recycle: { visits: 3 }, swarm: { seen: 1, best: {} } }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.click('#enter', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1500);
  await ev(() => { const o = window.__oreum; o.pace.pacing.test.first.done = true; o.pace.pacing.test.first.bloomed = true; o.setTod(13); o.setWeather('clear'); o.director.open('field'); o.director.open('level'); o.idle?.set({ warn: 1e6, rest: 1e6, hidden: 1e6 }); document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; }); });
  const rows = [];
  for (let z = 1; z <= 5; z++) {
    const r = await ev(async (z) => {
      const o = window.__oreum, a = o.arena.list().find((q) => q.zone === z), P = o.player, sl = (ms) => new Promise((r) => setTimeout(r, ms));
      o.swarm.stop(); o.enemies.test.clear(); o.hp.set(o.hp.max); o.swarm.clearRest(z); P.knock = null;
      const f = a.face; o.tp(a.gong.x + Math.sin(f) * 1.8, a.gong.z + Math.cos(f) * 1.8, f + Math.PI, 0.25, 11); P.target = null;
      for (let t = 0; t < 5000 && !o.arena.ui().tag; t += 200) await sl(200); await sl(600);
      if (o.swarm.gong(z)) return { z, err: o.swarm.why(z) };
      const C = o.camObj, out = { z, spawn: -1, see: -1, fight: -1, d0: -1 };
      let g = 0; const v = { x: 0, y: 0, z: 0 };
      await new Promise((done) => {
        const L = () => {
          const s = o.swarm.state(); if (!s) return done();
          o.hp.set(o.hp.max); P.knock = null; const t = s.t;
          const mobs = o.enemies.list.filter((e) => e.def.swarm && e.state !== 'leave' && e.state !== 'flee');
          if (mobs.length && out.spawn < 0) { out.spawn = t; out.d0 = Math.round(Math.min(...mobs.map((e) => Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z)))); }
          for (const e of mobs) {
            const d = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z);
            if (out.fight < 0 && d < (e.def.ranged ? e.def.ranged.range : 6)) out.fight = t; /* 쏘는 적(드론·외계인)은 쏠 수 있는 거리 */
            if (out.see < 0 && d < 40) {
              const q = e.root.position.clone(); q.y += (e.h || 0.8) * 0.5; const w = q.clone().applyMatrix4(C.matrixWorldInverse); q.project(C);
              if (w.z < 0 && Math.abs(q.x) < 0.95 && Math.abs(q.y) < 0.95 && e.root.visible) out.see = t;
            }
          }
          if ((out.see >= 0 && out.fight >= 0) || t > 15 || ++g > 4000) return done();
          requestAnimationFrame(L);
        };
        requestAnimationFrame(L);
      });
      o.swarm.stop(); o.enemies.test.clear(); o.swarm.clearRest(z);
      return out;
    }, z);
    rows.push(r);
  }
  console.log(`구역 | 첫 몹 생김 | 화면에 보임 | 싸움 거리 (초, 판 시계) | 처음 거리 m  [${MODE}]`);
  for (const r of rows) console.log(r.err ? `${r.z} | 시작 안 됨: ${r.err}` : `${r.z} | ${r.spawn.toFixed(1)} | ${r.see.toFixed(1)} | ${r.fight.toFixed(1)} | ${r.d0}`);
  for (const r of rows) ok(!r.err && r.see >= 0 && r.see <= 3 && r.fight >= 0 && r.fight <= 5, `구역 ${r.z}: 징 → 화면에 첫 적 ${r.see?.toFixed?.(1)}초(≤3) · 싸움 ${r.fight?.toFixed?.(1)}초(≤5)`);
  ok(!errs.length, `페이지 오류 ${errs.length}`);
  await b.close(); console.log(fails ? `FAIL ${fails}` : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
