// #227 길 위 걸림돌 검사: 탐방로·가게 거리 길을 처음부터 끝까지 걸음(0.45)·노루(0.9)·마차 노선으로 가 보며 걸리는 곳이 0 인지 본다.
// 1) 길 둘레(반폭 + PATHCLEAR.pad) 안에 있는 충돌 사물 수(나무·바위 등 자연물은 0 이어야 함)
// 2) 중심선을 따라 col.move 로 걸어 옆으로 밀린 곳
// 3) 보이는 바위(충돌 없는 장식 포함)가 길 둘레에 남은 수 (namsongi rockStat.bad)
// 쓰는 법: node build.mjs && node tools/pathclear.js   (V=1 이면 걸린 곳 좌표를 다 찍음)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 480, height: 300 } });
  p.on('pageerror', (e) => console.log('ERR', e.message.slice(0, 300)));
  /* 튜토리얼을 마친 저장으로 (튜토리얼 칸 돌담은 마치면 없어지는 것이라 뺌) */
  const ready = () => p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await ready();
  await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1 }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await ready(); await p.waitForTimeout(3000);
  const r = await p.evaluate(() => {
    const O = window.__oreum, PC = O.pathClear, col = O.col, idx = PC.idx, zoneAt = O.trash?.api?.zoneAt || (() => '-');
    /* 길 둘레에 있어도 되는 것: 하르방·돌탑·가로등·표지석·벤치·안내판·클린하우스·정낭·돌담·구역 문턱(바위 문)·더미·가게(설계상 놓인 것)
       자연물(나무·길가 바위)은 NSW.solids 에서 와서 충돌 번호 0..natN-1 (place.js 가 맨 먼저 등록). 이것은 0 이어야 함 */
    const inB = O.bound ? (x, z) => O.bound.insideBy(x, z) > 1.5 : () => true;
    const res = { rocks: PC.rocks, zone: {}, walk: {}, cart: 0, list: [] };
    const seen = new Map();
    const pad = 1.2;
    const segs = idx.segs.filter((s) => s.walk);
    segs.forEach((s) => {
      const dx = s.bx - s.ax, dz = s.bz - s.az, L = Math.hypot(dx, dz); if (L < 1e-3) return; const ux = dx / L, uz = dz / L, nx = -uz, nz = ux;
      for (let t = 0; t <= L; t += 0.5) for (let o = -(s.w + pad); o <= s.w + pad + 1e-6; o += 0.4) {
        const x = s.ax + ux * t + nx * o, z = s.az + uz * t + nz * o, h = col.which(x, z, 0); if (!h || seen.has(h[3])) continue;
        seen.set(h[3], 1); const zn = zoneAt(x, z) || '-'; res.list.push({ nat: h[3] < PC.natN, i: h[3], x: +h[0].toFixed(1), z: +h[1].toFixed(1), r: +h[2].toFixed(2), off: +Math.abs(o).toFixed(1), w: s.w, zone: zn });
      }
    });
    /* 걸어 보기: 각 선분 중심선을 끝까지. 반지름별로 밀린 거리 0.25 넘는 곳 */
    for (const pr of [0.45, 0.9]) {
      let n = 0, hits = [];
      segs.forEach((s) => {
        const dx = s.bx - s.ax, dz = s.bz - s.az, L = Math.hypot(dx, dz); if (L < 1e-3) return;
        let x = s.ax, z = s.az; const st = Math.max(1, Math.ceil(L / 0.5));
        for (let k = 1; k <= st; k++) { const tx = s.ax + dx * k / st, tz = s.az + dz * k / st, m = col.move(x, z, tx, tz, pr); x = m.x; z = m.z; const off = Math.hypot(x - tx, z - tz); if (off > 0.25 && inB(tx, tz)) { n++; if (hits.length < 40) hits.push([+tx.toFixed(1), +tz.toFixed(1), +off.toFixed(2)]); x = tx; z = tz; } }
      });
      res.walk[pr] = { n, hits };
    }
    /* 마차 노선 */
    const R = O.rides?.cart?.api?.route; if (R) { const hits = []; for (let s = 0; s <= R.len; s += 0.5) { const q = R.at(s), h = col.which(q.x, q.z, 1.0); if (h) hits.push([+q.x.toFixed(1), +q.z.toFixed(1), h[3]]); } res.cart = hits.length; res.cartHits = hits.slice(0, 20); }
    return res;
  });
  const byZone = {}; r.list.forEach((h) => { byZone[h.zone] = (byZone[h.zone] || 0) + 1; });
  const nat = r.list.filter((h) => h.nat), natZone = {}; nat.forEach((h) => { natZone[h.zone] = (natZone[h.zone] || 0) + 1; });
  console.log('길가 바위(보이는 것):', JSON.stringify(r.rocks));
  console.log('길 둘레 충돌 사물 수(구역별):', JSON.stringify(byZone), '합', r.list.length);
  if (process.env.V) r.list.forEach((h) => console.log('  ', JSON.stringify(h)));
  for (const k in r.walk) console.log(`걸어 보기 반지름 ${k}: 밀린 곳 ${r.walk[k].n}`, process.env.V ? JSON.stringify(r.walk[k].hits) : '');
  console.log('마차 노선 걸림:', r.cart, process.env.V ? JSON.stringify(r.cartHits || []) : '');
  console.log('길 둘레 자연물(나무·바위) 충돌:', nat.length, JSON.stringify(natZone));
  const bad = nat.length + (r.rocks?.bad || 0) + r.walk[0.45].n + r.walk[0.9].n + r.cart;
  console.log(bad ? `실패: 걸리는 곳 ${bad}` : '통과: 길 위 걸리는 곳 0');
  await b.close(); process.exit(bad ? 1 : 0);
})();
