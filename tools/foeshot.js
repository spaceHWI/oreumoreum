// 적 역할 그림 (#296): node tools/foeshot.js → notes/shots/296/foes.jpg
// 구역 3 길가 적(멧돼지) 보통·잽싼·묵직한·던지는 + 빅풋 + 설인을 한 줄로 세워 찍음 (머리 위 표시·색·크기 비교)
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 760, height: 420 } });
  const url = 'file://' + process.cwd() + '/dist/test.html?aa=1#namsongi';
  await p.goto(url); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1, pace: { first: 1, bloomed: 1 } }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.click('#enter', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1500);
  await p.evaluate(async () => {
    const o = window.__oreum, E = o.enemies, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    o.pace.pacing.test.soon(1e6); o.setTod(13); o.setWeather('clear'); E.test.clear(); o.foes.cd(1e6);
    const zs = o.trash.api.zoneAt; let best = null; for (let x = -200; x < 200; x += 6) for (let z = -200; z < 200; z += 6) if (zs(x, z) === 5 && (!best || Math.hypot(x, z) < Math.hypot(best[0], best[1]))) best = [x, z];
    const [x0, z0] = best; o.tp(x0, z0, 0, 0.18, 14);
    const want = ['base', 'zip', 'heavy', 'throw', 'rock'], got = {};
    for (let k = 0; k < 400 && Object.keys(got).length < want.length; k++) {
      E.spawnPlan({ kind: 'boar', n: 3, x: x0, z: z0 + 30, zone: 3 });
      for (const e of E.list.slice()) { const pt = e.pat || 'base'; if (Object.values(got).includes(e)) continue; if (want.includes(pt) && !got[pt]) got[pt] = e; else E.remove(e); }
    }
    const y = E.spawnSwarm('yeti', x0, z0 + 20, {}, null, 1); const L = [...want.map((k) => got[k]).filter(Boolean), y];
    const h = o.cam.yaw - Math.PI, fx = Math.sin(h), fz = Math.cos(h); /* 카메라가 보는 쪽 */
    L.forEach((e, i) => { const u = (i - (L.length - 1) / 2) * 3.2, x = x0 + fx * 9 + fz * u, z = z0 + fz * 9 - fx * u; e.pos.set(x, o.groundAt(x, z), z); e.heading = h + Math.PI; e.state = 'calm'; e.calmR = 0; e.def = { ...e.def, ctl: null }; e.life = 1e9; });
    o.tp(x0, z0, h, 0.16, 7, 0.5); if (o.camObj?.isPerspectiveCamera) { o.camObj.fov = 34; o.camObj.updateProjectionMatrix(); } /* 좁은 화각으로 당겨 봄 */
    document.querySelectorAll('.toast, #toasts, #msglog').forEach((d) => { d.style.display = 'none'; }); const f0 = o.renderer.info.render.frame; for (let k = 0; k < 600 && o.renderer.info.render.frame < f0 + 40; k++) await sleep(100); for (const e of L) e.pos.y = o.groundAt(e.pos.x, e.pos.z);
    return { n: L.length, got: Object.keys(got), cam: Object.keys(o).filter((k) => /cam/i.test(k)), yaw: o.cam?.yaw, L: L.map((e) => { let v = true, q = e.root; while (q) { if (!q.visible) v = false; q = q.parent; } let top = e.root; while (top.parent) top = top.parent; return [e.kind, e.pat, Math.round(e.pos.x), Math.round(e.pos.z), E.list.includes(e), v, top.type, e.root.scale.x]; }), frame: o.renderer.info.render.frame, p: [o.player.pos.x, o.player.pos.z] };
  }).then((r) => console.log(JSON.stringify(r)));
  await p.waitForTimeout(1500);
  fs.mkdirSync('notes/shots/296', { recursive: true });
  await p.screenshot({ path: 'notes/shots/296/foes.jpg', type: 'jpeg', quality: 80 });
  console.log('notes/shots/296/foes.jpg');
  await b.close();
})();
