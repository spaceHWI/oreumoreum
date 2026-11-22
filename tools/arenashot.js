// 서바이벌 터 사진 (#253): node build.mjs && node tools/arenashot.js [이름] [폴더]  → <폴더>/<이름>-z<구역>-<road|in|top>.jpg
// 구역마다 세 각도: 길 쪽에서 다가가며(문·깃발이 보이는지) · 터 안에서(징이 가운데 똑바로 섰는지) · 위에서(고리 돌 간격·끼인 것)
const { chromium } = require('playwright');
const fs = require('fs');
const TAG = process.argv[2] || 'now', OUT = (process.argv[3] || 'notes/shots/253') + '/'; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 400 } });
  p.on('pageerror', (e) => console.log('ERR', e.message.slice(0, 300)));
  const ready = () => p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await ready();
  await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1, recycle: { visits: 3 }, swarm: { seen: 1, best: {}, hint: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 } } }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await ready();
  await p.click('#enter', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1500);
  await p.waitForFunction(() => { const a = window.__oreum.assets; return !a || a.done >= a.total; }, null, { timeout: 120000 }).catch(() => {});
  const L = await p.evaluate(() => { const o = window.__oreum; o.setTod(14); o.setWeather('clear'); const st = document.createElement('style'); st.textContent = 'body > *:not(canvas){display:none!important}'; document.head.append(st); return o.arena.list(); });
  for (const a of L) {
    for (const v of ['road', 'in', 'top']) {
      await p.evaluate(([a, v]) => {
        const o = window.__oreum, k = o.camObj, s = Math.sin(a.face), c = Math.cos(a.face), H = o.height, g = a.gong;
        o.enemies.test.clear(); o.cam.mode = 'free'; k.fov = 50; k.updateProjectionMatrix();
        let cx, cz, cy, lx, ly, lz;
        if (v === 'road') { /* 문 쪽으로 곧게 나가 길에 닿는 곳에서, 비스듬히 */ let d = a.r; while (d < 120 && o.trash.api.trail.dist(a.x + s * d, a.z + c * d, 4) >= 3) d += 1; cx = a.x + s * d + c * 3; cz = a.z + c * d - s * 3; cy = H(cx, cz) + 2.6; lx = g.x; ly = g.y + 1.2; lz = g.z; }
        else if (v === 'in') { const d = a.r - 6, x = a.x - s * d, z = a.z - c * d; cx = x; cz = z; cy = H(x, z) + 2.2; lx = g.x; ly = g.y + 1.4; lz = g.z; }
        else { cx = a.x - s * 12; cz = a.z - c * 12; cy = g.y + 62; lx = a.x; ly = g.y; lz = a.z; }
        const bx = cx + (cx - lx) * 0.4, bz = cz + (cz - lz) * 0.4; o.tp(bx, bz, Math.atan2(lx - bx, lz - bz)); o.cam.mode = 'free'; /* 캐릭터는 카메라 뒤에 */
        k.position.set(cx, cy, cz); k.lookAt(lx, ly, lz);
      }, [a, v]);
      await p.waitForTimeout(1400);
      await p.screenshot({ path: `${OUT}${TAG}-z${a.zone}-${v}.jpg`, type: 'jpeg', quality: 62 });
    }
    console.log(`구역 ${a.zone} (${a.x}, ${a.z}) 문 ${a.face} 징 높이 ${a.gong.y}`);
  }
  await b.close();
})();
