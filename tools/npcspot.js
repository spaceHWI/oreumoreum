// 가게 주인 자리 확인 (#190): 가게 문·간판·서로와의 거리, 터 안인지, 위에서 본 그림 dist/npcspot-<이름>.jpg
// node tools/npcspot.js [이름]   (먼저 node build.mjs)
const { chromium } = require('playwright');
const NAME = process.argv[2] || 'now';
let fails = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1040, height: 640 } })).newPage(); let errs = 0;
  p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
  const W = (ms) => p.waitForTimeout(ms), ev = (fn, a) => p.evaluate(fn, a);
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await W(6000);
  await p.click('#enter').catch(() => {}); await W(3000);
  if (await ev(() => !document.getElementById('look')?.hidden)) { await p.click('#look-ok').catch(() => {}); await W(1200); }
  await ev(() => { const o = window.__oreum; o.tut.skipAll(); o.setTod(14); }); await W(1500);
  const r = await ev(() => {
    const o = window.__oreum, st = o.street, w = o.quest.where(), G = o.quest.givers, out = [];
    const doors = st.shops.map((s) => ({ id: s.id, x: s.door.x, z: s.door.z, sign: s.signPos }));
    for (const [id, g] of G) {
      if (!id.startsWith('shop:')) continue;
      const sh = st.shops.find((s) => s.id === g.def.shop), L = st.layout.lot(sh.lot);
      const d = (a) => Math.hypot(a.x - g.pos.x, a.z - g.pos.z);
      // 터 안: 터 가운데 기준 좌표 (앞뒤 = back 방향, 옆 = 수직)
      const bx = L.back.x, bz = L.back.z, rx = g.pos.x - L.x, rz = g.pos.z - L.z, along = rx * bx + rz * bz, side = rx * bz - rz * bx;
      const others = [...G.values()].filter((h) => h !== g).map((h) => Math.hypot(h.pos.x - g.pos.x, h.pos.z - g.pos.z));
      const otherDoors = doors.filter((x) => x.id !== sh.id).map(d);
      out.push({ id, x: +g.pos.x.toFixed(1), z: +g.pos.z.toFixed(1), door: +d(sh.door).toFixed(2), sign: sh.signPos ? +d(sh.signPos).toFixed(2) : null, inLot: along >= -L.d / 2 - 0.05 && Math.abs(side) <= L.w / 2, along: +along.toFixed(2), side: +side.toFixed(2), near: +Math.min(...others).toFixed(1), otherDoor: +Math.min(...otherDoors).toFixed(1), markY: +g.mark.position.y.toFixed(2), face: +g.face.toFixed(2) });
    }
    return out;
  });
  for (const g of r) {
    console.log('    ', JSON.stringify(g));
    ok(g.inLot, `${g.id} 가게 터 안 (앞뒤 ${g.along}, 옆 ${g.side})`);
    ok(g.door >= 1.2 && g.door <= 2.6, `${g.id} 문에서 ${g.door}m`);
    ok(g.near >= 3, `${g.id} 다른 NPC 와 ${g.near}m`);
    ok(g.otherDoor >= 3, `${g.id} 다른 가게 문과 ${g.otherDoor}m`);
  }
  // 위에서 본 그림: 가게마다 한 장
  for (const g of r) {
    await ev(([x, z, f]) => { const o = window.__oreum; o.tp(x + Math.sin(f) * 5, z + Math.cos(f) * 5, f + Math.PI, 0.45, 7, 0); }, [g.x, g.z, g.face]); await W(2500); // 길 쪽 5m 에서 가게를 봄
    await p.screenshot({ path: `dist/npcspot-${NAME}-${g.id.slice(5)}.jpg`, type: 'jpeg', quality: 50, timeout: 120000 });
  }
  ok(errs === 0, `페이지 오류 ${errs}`);
  await b.close(); console.log(fails ? `실패 ${fails}` : '모두 통과'); process.exit(fails ? 1 : 0);
})();
