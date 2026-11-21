// 동굴 확인 (#195): node tools/caverun.js [--days 7] [--live]
// 1) (늘) 오늘부터 며칠치 '오늘의 동굴' 을 만들어 층마다 방·갈림길·칸·삼각형, 줄 → 구멍(주인 방) 걷는 길이를 적는다
//    방 수(곁방 빼고) CAVE 범위 · 모든 방이 이어짐 · 줄에서 구멍까지 걸어서 닿음 · 층 삼각형 30만 아래
// 2) --live: dist/test.html 을 열어 오름 → 동굴 → (아래층) → 오름 왕복 3번. 동굴 안 draw call·삼각형, 장면 바꾸는 시간(ms),
//    왕복 전·후 JS 힙(가비지 정리 뒤)·지오메트리·텍스처 수. 힙이 처음보다 10% 넘게 늘거나 오류가 나면 실패
// 1번 조각(맵 띄우기·내리기·걷기)용. 줍기·적·보물이 들어오면(2·3번) 한 판 돌린 시간·번 귤·잃은 기운을 더한다
const path = require('path');
const args = process.argv.slice(2);
const live = args.includes('--live');
const di = args.indexOf('--days'); const DAYS = di >= 0 ? +args[di + 1] : 7;
let fail = 0;
const bad = (m) => { fail++; console.log('  실패:', m); };

(async () => {
  const { CAVE } = await import(path.join(process.cwd(), 'src/balance.js'));
  const { genFloor, caveMesh, caveSeed } = await import(path.join(process.cwd(), 'src/cavegen.js'));
  const day0 = Date.now();
  console.log(`# 오늘의 동굴 ${DAYS}일치 (층 ${CAVE.floors}, 방 층마다 ${CAVE.rooms.join('~')})`);
  for (let d = 0; d < DAYS; d++) {
    const k = new Date(day0 + d * 86400000 + 9 * 3600000), day = `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, '0')}-${String(k.getUTCDate()).padStart(2, '0')}`;
    let rooms = 0, branch = 0, walkM = 0; const lines = [];
    for (let f = 0; f < CAVE.floors; f++) {
      const F = genFloor(CAVE, f, caveSeed(day, f)), M = caveMesh(F, CAVE);
      const main = F.rooms.filter((r) => r.kind !== 'pocket').length; rooms += main; branch += F.branch;
      // 걷는 길: 걸을 수 있는 칸 가운데끼리 너비 우선 (대각선 포함)
      const N = F.N, C = F.C, idx = (x, z) => Math.floor((z - F.oz) / C) * N + Math.floor((x - F.ox) / C);
      const ok = (i) => { const x = F.ox + (i % N + 0.5) * C, z = F.oz + (Math.floor(i / N) + 0.5) * C; return F.walk(x, z); };
      const dist = new Float32Array(N * N).fill(-1), q = []; const s0 = idx(F.start.x, F.start.z); dist[s0] = 0; q.push(s0);
      for (let h = 0; h < q.length; h++) { const c = q[h], i = c % N, j = (c - i) / N; for (const [a, b, w] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.41], [-1, 1, 1.41], [1, -1, 1.41], [-1, -1, 1.41]]) { const x = i + a, z = j + b; if (x < 0 || z < 0 || x >= N || z >= N) continue; const n = z * N + x; if (dist[n] >= 0 || !ok(n)) continue; dist[n] = dist[c] + w * C; q.push(n); } }
      const reach = F.rooms.filter((r) => { const w = F.world(r); return dist[idx(w.x, w.z)] >= 0; }).length;
      const farD = F.far ? dist[idx(F.far.x, F.far.z)] : -1;
      if (reach < F.rooms.length) bad(`${day} ${f + 1}층: 방 ${F.rooms.length - reach}개에 걸어서 못 감`);
      if (F.far && farD < 0) bad(`${day} ${f + 1}층: 줄에서 ${F.far.kind === 'boss' ? '주인 방' : '구멍'}까지 못 감`);
      if (M.tris > 300000) bad(`${day} ${f + 1}층: 삼각형 ${M.tris}`);
      walkM += Math.max(0, farD);
      lines.push(`${f + 1}층 방 ${main}+곁방 ${F.rooms.length - main} 갈림 ${F.branch} 칸 ${F.floorCells} 삼각형 ${M.tris} 줄→${F.far?.kind === 'boss' ? '주인' : '구멍'} ${Math.round(farD)}m`);
    }
    const [lo, hi] = [CAVE.rooms[0] * CAVE.floors, CAVE.rooms[1] * CAVE.floors];
    if (rooms < lo || rooms > hi) bad(`${day}: 방 ${rooms} (${lo}~${hi})`);
    console.log(`${day}: 방 ${rooms} 갈림길 ${branch} 곧장 걸으면 ${Math.round(walkM)}m (~${Math.round(walkM / 5 / 60 * 10) / 10}분)\n  ` + lines.join('\n  '));
  }
  if (live) await liveRun();
  console.log(fail ? `실패 ${fail}` : '통과');
  process.exit(fail ? 1 : 0);
})();

async function liveRun() {
  const { chromium } = require('playwright');
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
  const p = await b.newPage({ viewport: { width: 640, height: 400 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await p.waitForTimeout(6000);
  await p.click('#enter').catch(() => {}); await p.waitForTimeout(4000);
  await p.evaluate(() => { const o = window.__oreum; o.tut.skipAll?.(); o.look.close?.(); document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; }); o.setTod?.(13); o.cave.goEnt(); });
  const S = (f, a) => p.evaluate(f, a);
  const mem = async () => { await S(() => { window.gc?.(); }); await p.waitForTimeout(400); await S(() => { window.gc?.(); }); return S(() => ({ heap: performance.memory.usedJSHeapSize / 1048576, geo: window.__oreum.renderer.info.memory.geometries, tex: window.__oreum.renderer.info.memory.textures })); };
  // 오름 쪽을 한 번 다 그려 둔 뒤 처음 값
  await p.waitForTimeout(2000);
  const oreum = await S(() => ({ calls: window.__oreum.renderer.info.render.calls, tris: window.__oreum.renderer.info.render.triangles }));
  // 처음 한 번 들어갔다 나와서(셰이더·모양 처음 만들기) 그 뒤를 기준으로
  await S(() => window.__oreum.cave.enter()); await p.waitForTimeout(800); await S(() => window.__oreum.cave.exit()); await p.waitForTimeout(800);
  const m0 = await mem(); let inside = null;
  for (let k = 0; k < 3; k++) {
    await S(() => window.__oreum.cave.enter()); await p.waitForTimeout(900);
    const st = await S(() => ({ calls: window.__oreum.renderer.info.render.calls, tris: window.__oreum.renderer.info.render.triangles, s: window.__oreum.cave.state() }));
    if (!inside || st.calls > inside.calls) inside = st;
    await S(() => window.__oreum.cave.down()); await p.waitForTimeout(700);
    await S(() => window.__oreum.cave.down()); await p.waitForTimeout(700);
    const st2 = await S(() => ({ calls: window.__oreum.renderer.info.render.calls, tris: window.__oreum.renderer.info.render.triangles }));
    if (st2.calls > inside.calls) inside = { ...inside, ...st2 };
    await S(() => window.__oreum.cave.exit()); await p.waitForTimeout(900);
  }
  const m1 = await mem(), ms = (await S(() => window.__oreum.cave.stats())).ms;
  const back = await S(() => ({ x: window.__oreum.player.pos.x, z: window.__oreum.player.pos.z, e: window.__oreum.cave.ent(), cave: !!window.__oreum.cave.state() }));
  console.log(`# 실제로 열어 봄 (swiftshader)\n  오름: draw call ${oreum.calls} 삼각형 ${oreum.tris}\n  동굴: draw call ${inside.calls} 삼각형 ${inside.tris} (방 ${inside.s.rooms} 칸 ${inside.s.cells})`);
  console.log(`  장면 바꾸기 ms: ${ms.join(' ')}\n  왕복 3번 전 → 뒤: 힙 ${m0.heap.toFixed(1)} → ${m1.heap.toFixed(1)}MB · 지오메트리 ${m0.geo} → ${m1.geo} · 텍스처 ${m0.tex} → ${m1.tex}`);
  if (inside.calls >= 120) bad(`동굴 draw call ${inside.calls}`);
  if (inside.tris >= 300000) bad(`동굴 삼각형 ${inside.tris}`);
  if (Math.max(...ms) > 3000) bad(`장면 바꾸기 ${Math.max(...ms)}ms`);
  if (m1.heap > m0.heap * 1.1) bad(`힙이 10% 넘게 늘어남`);
  if (m1.geo > m0.geo + 2 || m1.tex > m0.tex) bad(`지오메트리·텍스처가 남음`);
  if (back.cave || Math.hypot(back.x - back.e.fx, back.z - back.e.fz) > 3) bad(`나온 자리가 입구가 아님 ${JSON.stringify(back)}`);
  if (errs.length) bad('페이지 오류 ' + errs.join(' | '));
  await b.close();
}
