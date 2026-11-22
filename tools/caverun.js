// 동굴 확인 (#195): node tools/caverun.js [--days 7] [--live]
// 1) (늘) 오늘부터 며칠치 '오늘의 동굴' 을 만들어 층마다 방·갈림길·칸·삼각형, 줄 → 구멍(주인 방) 걷는 길이를 적는다
//    방 수(곁방 빼고) CAVE 범위 · 모든 방이 이어짐 · 줄에서 구멍까지 걸어서 닿음 · 층 삼각형 30만 아래
// 2) --live: dist/test.html 을 열어 오름 → 동굴 → (아래층) → 오름 왕복 3번. 동굴 안 draw call·삼각형, 장면 바꾸는 시간(ms),
//    왕복 전·후 JS 힙(가비지 정리 뒤)·지오메트리·텍스처 수. 힙이 처음보다 10% 넘게 늘거나 오류가 나면 실패
// 3) (늘, 3번 조각) 한 판 어림: 걷기(줄 → 구멍·주인, 더미·곁방 들르기 ×1.5, 나올 때 맨 아래 층 되돌아감) + 줍기(가장 큰 배낭·큰 갈퀴) + 싸움(방 적·지킴이·주인)
//    무기 머신건(4단계, 동굴 들어갈 때쯤)·레이저(5단계)로 각각, 여유 ×1.25. 머신건 판이 15~25분 안이 목표. 번 귤(쓰레기 온전한 판·절반 판·상자·주인)
// --live 에서 4번 조각: 층마다 벽 쪽지(읽으면 주운 쪽지에)·동굴 옷(상자·주인 뒤, 가게 목록엔 없음)·퀘스트 셈 caveOut·감독 문 cave·혼잣말 줄
// 카메라 두 안 (#214): (늘) a 내려다보기(벽 자름·천장 없음)·b 넓은 굴(같은 씨앗을 k 배) 층마다 걸어서 닿음·삼각형. --live 에서 a·b·지금 세 안으로
//   통로 걷기 / 적 무리와 싸움 / 주인 방 3장면 그림(notes/shots/214/, --shots 다른 곳)·draw call·삼각형·프레임 시간, 더미·적·지킴이·주인·같이 보기 칸 이름
// --live 에서 3번 조각: 판 수(셋째 판은 절반)·화살표·무너지는 바닥·낙석·물길(테왁 없으면 못 건넘)·상자(하루 한 번)·주인(드론 부름·쫓아내면 큰 보상 하루 한 번)
const path = require('path');
const args = process.argv.slice(2);
const live = args.includes('--live');
const di = args.indexOf('--days'); const DAYS = di >= 0 ? +args[di + 1] : 7;
let fail = 0;
const bad = (m) => { fail++; console.log('  실패:', m); };

(async () => {
  const { CAVE } = await import(path.join(process.cwd(), 'src/balance.js'));
  const { genFloor, caveMesh, caveSeed, caveK } = await import(path.join(process.cwd(), 'src/cavegen.js'));
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
  modeCheck(CAVE, genFloor, caveMesh, caveSeed, caveK, day0);
  await estimate(CAVE, genFloor, caveSeed, day0);
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
  await S(() => { window.__oreum.cave.enter(); window.__oreum.cave.wakeAll(); }); await p.waitForTimeout(800); /* 층마다 적 모양도 처음 한 번 만들어 둠 */
  for (let k = 0; k < 2; k++) { await S(() => { window.__oreum.cave.down(); window.__oreum.cave.wakeAll(); }); await p.waitForTimeout(700); }
  await S(() => window.__oreum.cave.exit()); await p.waitForTimeout(800);
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
  await playRun(p, S);
  await playRun3(p, S);
  await playRun4(p, S);
  await modeRun(p, S);
  if (errs.length) bad('페이지 오류 ' + errs.join(' | '));
  await b.close();
}

// 2번 조각: 한 판 — 더미 줍기(버튼) · 배낭 채우기 · 방 적 · 지킴이(쉬며 기운 참·쫓아내야 구멍) · 그려지는 적 · 들고 나오기 · 쓰러지면 절반
async function playRun(p, S) {
  const t0 = Date.now(); const C = (f, a) => S(f, a);
  await C(() => { const o = window.__oreum; o.save.equip.bag = 5; o.trash.api.test.emptyBag?.(); o.cave.enter(); }); await p.waitForTimeout(700); /* 가장 큰 배낭 */
  const j = await C(() => window.__oreum.cave.junk());
  console.log(`# 한 판 (2번 조각)\n  더미 ${j.piles.length}곳 · 쓰레기 ${j.piles.reduce((s, x) => s + x.n, 0)}개 · 부피 1 귤 ${j.perVol} (${j.kinds.map((k) => `${k.id} 부피 ${k.vol} 귤 ${k.g}`).join(', ')})`);
  if (!j.piles.length) bad('1층에 더미가 없음');
  // 버튼으로 줍기: 더미 옆에서 누르면 조금 뒤 배낭에 들어감
  await C(() => { window.__oreum.cave.goPile(0); window.__oreum.cave.pick(); }); await p.waitForTimeout(2500);
  const h1 = await C(() => window.__oreum.cave.held());
  if (!(h1.n > 0 && h1.held.g > 0)) bad('줍기 버튼으로 동굴 쓰레기가 배낭에 안 들어감 ' + JSON.stringify(h1));
  // 배낭 채우기
  const got = await C(() => window.__oreum.cave.pickAll()), h2 = await C(() => window.__oreum.cave.held());
  console.log(`  줍기: 버튼 ${h1.n}개 → 모두 ${h1.n + got}개, 든 귤 ${Math.round(h2.held.g)} · 배낭 남은 칸 ${h2.room}`);
  // 적: 방을 다 깨우고 몇 초 뒤에도 모두 걸을 수 있는 칸에 있는지(벽을 뚫지 않음)·그려지는지
  const nm = await C(() => window.__oreum.cave.wakeAll()); await p.waitForTimeout(4000);
  const mobs = await C(() => window.__oreum.cave.mobs()), drawn = await C(() => { const o = window.__oreum, cs = o.cave.scene(); return o.life.enemies.list.filter((e) => e.cave && e.root.parent && e.root.parent.parent === cs).length; });
  const kinds = mobs.reduce((m, e) => { m[e.kind] = (m[e.kind] || 0) + 1; return m; }, {});
  console.log(`  적: ${nm}마리 (${Object.entries(kinds).map(([k, n]) => k + ' ' + n).join(', ')}) · 동굴 장면에 그려짐 ${drawn}`);
  if (!kinds.bat || !kinds.crab) bad('박쥐·게가 모두 나오지 않음');
  if (mobs.some((e) => e.walk === false)) bad('벽 속에 들어간 적 ' + JSON.stringify(mobs.filter((e) => e.walk === false)));
  if (drawn < mobs.length) bad(`동굴 장면에 안 그려지는 적 ${mobs.length - drawn}`);
  const calls = await C(() => window.__oreum.renderer.info.render.calls); console.log(`  적이 다 있을 때 draw call ${calls}`); if (calls >= 120) bad(`적이 있을 때 draw call ${calls}`);
  // 지킴이
  let g = await C(() => window.__oreum.cave.guard());
  if (!g.e || !g.blocks) bad('지킴이가 없거나 구멍을 막지 않음 ' + JSON.stringify(g));
  await C(() => { window.__oreum.player.pos.x += 400; window.__oreum.cave.hurtGuard(0.5); }); /* 멀리 두고 쉬게 */
  const hpA = (await C(() => window.__oreum.cave.guard())).e.hp;
  await C(() => { const g = window.__oreum.life.enemies.list.find((e) => e.guard); g.calmT = 40; }); await p.waitForTimeout(3000);
  const hpB = (await C(() => window.__oreum.cave.guard())).e.hp;
  console.log(`  지킴이: 기운 ${g.e && g.e.max} · 깎은 뒤 ${hpA} → 쉬고 3초 ${hpB}`); if (!(hpB > hpA)) bad('지킴이가 쉬어도 기운이 안 참 (#183)');
  await C(() => { window.__oreum.cave.goGuard(); window.__oreum.cave.repelGuard(); }); await p.waitForTimeout(600);
  g = await C(() => window.__oreum.cave.guard()); if (!g.done || g.blocks) bad('지킴이를 쫓아내도 구멍이 열리지 않음');
  // 들고 나오기
  const out0 = h2.out; await C(() => window.__oreum.cave.exit()); await p.waitForTimeout(900);
  const h3 = await C(() => window.__oreum.cave.held()), left = await C(() => window.__oreum.life.enemies.list.filter((e) => e.cave).length);
  const lg = await C(() => window.__oreum.life.group.parent === window.__oreum.scene);
  console.log(`  들고 나옴: 누적 ${out0} → ${h3.out} · 남은 동굴 적 ${left} · 묶음 되돌림 ${lg}`);
  if (h3.out - out0 < Math.round(h2.held.g) - 1 || h3.n) bad('들고 나온 몫이 누적되지 않음');
  if (left) bad('나온 뒤 동굴 적이 남음'); if (!lg) bad('life.group 이 오름 장면으로 안 돌아옴');
  // 쓰러지면 절반
  await C(() => { const o = window.__oreum; o.trash.api.test.emptyBag?.(); o.cave.enter(); }); await p.waitForTimeout(700);
  await C(() => { window.__oreum.cave.down(); }); await p.waitForTimeout(500); /* 1층 더미는 오늘 이미 다 주움: 2층에서 */
  await C(() => window.__oreum.cave.pickAll()); const h4 = await C(() => window.__oreum.cave.held());
  await C(() => window.__oreum.hp.hit(1e6)); await p.waitForTimeout(1500);
  const h5 = await C(() => ({ ...window.__oreum.cave.held(), inCave: !!window.__oreum.cave.state() }));
  const kept = h5.out - h4.out;
  console.log(`  쓰러짐: 든 귤 ${Math.round(h4.held.g)} → 들고 나온 몫 ${kept} · 동굴 밖 ${!h5.inCave}`);
  if (!(h4.held.g > 0) || h5.inCave || Math.abs(kept - h4.held.g / 2) > h4.held.g * 0.12) bad('쓰러지면 절반만 남아야 함');
  console.log(`  (확인 도구로 줄인 한 판 ${Math.round((Date.now() - t0) / 1000)}초)`);
}

// 3번 조각: 한 판 어림 (며칠치 평균)
async function estimate(CAVE, genFloor, caveSeed, day0) {
  const B = await import(path.join(process.cwd(), 'src/balance.js')), { ENEMIES, WEAPONS, TOOLS, BAGS } = B, J = CAVE.junk, MB = CAVE.mobs;
  const KV = J.kinds.map((k) => { const t = B.TRASH_TYPES.find((x) => x.id === k.as); return { p: k.p, vol: t.vol, g: t.vol * J.perVol }; });
  const avgVol = KV.reduce((s, k) => s + k.p * k.vol, 0), avgG = KV.reduce((s, k) => s + k.p * k.g, 0), mid = ([a, b]) => (a + b) / 2;
  const rows = [];
  for (let d = 0; d < DAYS; d++) {
    const k = new Date(day0 + d * 86400000 + 9 * 3600000), day = `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, '0')}-${String(k.getUTCDate()).padStart(2, '0')}`;
    let walk = 0, items = 0, mobHp = 0, chests = 0;
    for (let f = 0; f < CAVE.floors; f++) {
      const F = genFloor(CAVE, f, caveSeed(day, f)), st = F.start, far = F.far || st;
      const L = Math.hypot(far.x - st.x, far.z - st.z) * 1.35; walk += L * 1.5 + (f === CAVE.floors - 1 ? L : 0);
      for (const o of F.rooms) { if (o.kind === 'start') continue; const pocket = o.kind === 'pocket'; items += (pocket ? J.pocket : mid(J.perRoom)) * mid(J.n); if (pocket) chests++;
        mobHp += pocket ? ENEMIES.crab.hp : mid(MB.bats) * ENEMIES.bat.hp + mid(MB.crabs) * ENEMIES.crab.hp; }
      mobHp += MB.guard.hp;
    }
    rows.push({ walk, items, mobHp, chests });
  }
  const A = (k) => rows.reduce((s, r) => s + r[k], 0) / rows.length, items = A('items'), vol = items * avgVol, cap = BAGS[BAGS.length - 1].cap;
  const carry = Math.min(vol, cap), carried = carry / avgVol, tool = TOOLS[3], pickT = carried / tool.per * (tool.time + 0.6), walkT = A('walk') / 5;
  const W = (id) => WEAPONS.find((w) => w.id === id), fightT = (w) => (A('mobHp') + CAVE.owner.hp) / w.dmg;
  const tm = (w) => (walkT + pickT + fightT(w) + 60) * 1.25 / 60, junk = carried * avgG, chest = A('chests') * mid([CAVE.chest.gyul[0], CAVE.chest.gyul[1]]);
  const mg = tm(W('mg')), lz = tm(W('laser'));
  console.log(`# 한 판 어림 (${DAYS}일 평균, 여유 ×1.25)\n  걷기 ${Math.round(A('walk'))}m ${(walkT / 60).toFixed(1)}분 · 쓰레기 ${Math.round(items)}개 부피 ${Math.round(vol)} (가장 큰 배낭 ${cap}) 줍기 ${(pickT / 60).toFixed(1)}분 · 적 기운 ${Math.round(A('mobHp'))} + 주인 ${CAVE.owner.hp}`);
  console.log(`  머신건 ${mg.toFixed(1)}분 · 레이저 ${lz.toFixed(1)}분 (목표 15~25분, 머신건 기준)`);
  console.log(`  귤: 쓰레기 온전한 판 ${Math.round(junk)} · 절반 판 ${Math.round(junk * CAVE.runs.halfK)} · 상자 ${Math.round(chest)}(하루 한 번) · 주인 ${CAVE.owner.gyul}(하루 한 번) → 하루 온전한 ${CAVE.runs.full}판 ${Math.round(junk * CAVE.runs.full + chest + CAVE.owner.gyul)}`);
  if (mg < 15 || mg > 25) bad(`머신건 한 판 ${mg.toFixed(1)}분 (15~25분)`);
  if (junk * CAVE.runs.full * B.NET.earnRec.caveK > B.NET.earnRec.caveDayFull * 1.6) bad('하루 온전한 판 쓰레기 몫이 서버 caveDayFull 보다 훨씬 큼');
}

// 3번 조각: 판 수 · 함정 · 길 찾기 · 상자 · 주인
async function playRun3(p, S) {
  const C = S, W = (ms) => p.waitForTimeout(ms);
  console.log('# 3번 조각');
  await C(() => { const o = window.__oreum; if (o.cave.state()) o.cave.exit(); }); await W(900);
  for (let k = 0; k < 60 && await C(() => window.__oreum.hp.isDown || window.__oreum.hp.pending); k++) await W(1000); /* 2번 조각에서 쓰러진 뒤 일어날 때까지 */
  await C(() => { const o = window.__oreum; o.cave.setRuns(0); o.hp.set(o.hp.max); o.save.backs = { own: {}, cur: null }; o.cave.enter(); }); await W(800);
  let r = await C(() => window.__oreum.cave.runs());
  if (r.n !== 1 || r.k !== 1) bad('첫 판이 온전한 판이 아님 ' + JSON.stringify(r));
  // 층마다 화살표·바닥·물길·상자, 3층 주인
  const floors = [];
  for (let f = 0; f < 3; f++) { if (f) { await C(() => window.__oreum.cave.down()); await W(600); } floors.push(await C(() => window.__oreum.cave.deep())); }
  console.log('  층: ' + floors.map((d) => `${d.fi + 1}층 화살표 ${d.arrows} 바닥 ${d.crumble.length} 물길 ${d.water.length} 상자 ${d.chest ? d.chest.id : '-'} 주인 ${d.owner ? 'O' : '-'}`).join(' · '));
  if (floors.some((d) => !d.arrows)) bad('화살표가 없는 층');
  if (!floors[2].owner) bad('맨 아래 층에 주인 방이 없음');
  if (!floors.some((d) => d.crumble.length)) bad('무너지는 바닥이 없음');
  // 주인 (3층): 깨어남 · 기운이 줄면 드론 · 쫓아내면 큰 보상 하루 한 번
  await C(() => { const o = window.__oreum; o.cave.goOwner(); o.hp.set(o.hp.max); }); await W(1200);
  let ow = await C(() => window.__oreum.cave.owner());
  if (!ow.seen || !ow.e) bad('주인이 깨어나지 않음 ' + JSON.stringify(ow));
  const bar = await C(() => !document.getElementById('boss-bar').hidden);
  await C(() => window.__oreum.cave.hurtOwner(0.5)); await W(500); ow = await C(() => window.__oreum.cave.owner());
  console.log(`  주인: 기운 ${ow.e && ow.e.max} · 화면 위 줄 ${bar} · 절반 깎은 뒤 드론 ${ow.calls} · 벽 안 ${ow.e && ow.e.walk}`);
  if (!bar) bad('주인 기운 줄이 안 보임'); if (!(ow.calls > 0)) bad('주인이 드론을 안 부름');
  const c0 = await C(() => window.__oreum.save.coins);
  await C(() => { window.__oreum.hp.set(window.__oreum.hp.max); window.__oreum.cave.repelOwner(); }); await W(4500);
  ow = await C(() => window.__oreum.cave.owner()); const c1 = await C(() => window.__oreum.save.coins), bar2 = await C(() => !document.getElementById('boss-bar').hidden);
  console.log(`  주인을 쫓아냄: 오늘 받음 ${ow.got} · 귤 ${c0} → ${c1} · 줄 숨김 ${!bar2}`);
  if (!ow.got) bad('주인 큰 보상 기록(save.cave.boss)이 안 남음'); if (c1 - c0 < 1000) bad('주인 큰 보상 귤이 안 들어옴'); if (bar2) bad('주인이 떠난 뒤에도 기운 줄이 보임');
  // 무너지는 바닥 (있는 층)
  const fc = floors.findIndex((d) => d.crumble.length);
  await C(() => window.__oreum.cave.exit()); await W(900);
  await C(() => { window.__oreum.cave.setRuns(0); window.__oreum.cave.enter(); }); await W(800);
  for (let f = 0; f < fc; f++) { await C(() => window.__oreum.cave.down()); await W(600); }
  const hp0 = await C(() => { const o = window.__oreum; o.hp.set(o.hp.max); o.cave.crumbleHere(0); return o.hp.hp; }); await W(400);
  const cr1 = (await C(() => window.__oreum.cave.deep())).crumble[0].st; await W(2300);
  const cr2 = await C(() => ({ d: window.__oreum.cave.deep().crumble[0], hp: window.__oreum.hp.hp, x: window.__oreum.player.pos.x, z: window.__oreum.player.pos.z }));
  const away = Math.hypot(cr2.x - cr2.d.x, cr2.z - cr2.d.z);
  console.log(`  무너지는 바닥: 밟자 ${cr1} → ${cr2.d.st} · 기운 ${Math.round(hp0)} → ${Math.round(cr2.hp)} · 구멍에서 ${away.toFixed(1)}m`);
  if (cr1 !== 'warn' || cr2.d.st !== 'down' || !(cr2.hp < hp0) || away < 1.5) bad('무너지는 바닥이 금 → 무너짐 → 피해로 가지 않음');
  // 낙석
  const hp1 = await C(() => { const o = window.__oreum; o.hp.set(o.hp.max); o.player.iframe = 0; return o.hp.hp; });
  await C(() => window.__oreum.cave.rockHere()); await W(1800);
  const hp2 = await C(() => window.__oreum.hp.hp); console.log(`  낙석: 기운 ${Math.round(hp1)} → ${Math.round(hp2)}`); if (!(hp2 < hp1)) bad('낙석에 맞아도 기운이 안 줄어듦');
  await C(() => window.__oreum.cave.exit()); await W(900);
  // 상자·물길 (곁방 층)
  const fw = floors.findIndex((d) => d.water.length), fq = fw >= 0 ? fw : floors.findIndex((d) => d.chest);
  if (fq < 0) console.log('  (이날 동굴엔 상자가 없음)'); else {
    await C(() => { window.__oreum.cave.setRuns(0); window.__oreum.cave.enter(); }); await W(800);
    for (let f = 0; f < fq; f++) { await C(() => window.__oreum.cave.down()); await W(600); }
    const d = await C(() => window.__oreum.cave.deep());
    if (d.water.length) {
      const w0 = await C(() => { const o = window.__oreum; o.cave.goWater(0, -1); const w = o.cave.water(0), sp = o.spots, p = o.player.pos; const tx = w.x + w.dx * 0.2, tz = w.z + w.dz * 0.2; return { block: sp.clamp(tx, tz), x: p.x, z: p.z }; });
      const w1 = await C(() => { const o = window.__oreum; o.save.equip.bag = 5; o.save.backs = { own: { tewak: 1 }, cur: 'tewak' }; const w = o.cave.water(0), tx = w.x + w.dx * 0.2, tz = w.z + w.dz * 0.2; return o.spots.clamp(tx, tz); });
      console.log(`  물길: 테왁 없이 ${w0.block ? '막힘' : '건넘'} · 테왁 ${w1 ? '막힘' : '건넘'}`);
      if (!w0.block) bad('테왁 없이 물길을 건넘'); if (w1 && !(Math.abs(w1.x - w0.x) > 1e-6)) bad('테왁이 있어도 물길을 못 건넘');
      await C(() => { window.__oreum.save.backs = { own: {}, cur: null }; });
    }
    const k0 = await C(() => window.__oreum.save.coins);
    const got = await C(() => { window.__oreum.cave.goChest(); return window.__oreum.cave.openChest(); }); await W(3500);
    const k1 = await C(() => window.__oreum.save.coins), again = await C(() => window.__oreum.cave.runs().chest);
    console.log(`  상자 ${d.chest.id}: 열림 ${got} · 귤 ${k0} → ${k1} · 오늘 연 상자 ${again.got.join(',')}`);
    if (!got || k1 - k0 < 500 || !again.got.includes(d.chest.id)) bad('상자를 열어도 보상·기록이 없음');
    await C(() => window.__oreum.cave.exit()); await W(900);
    await C(() => window.__oreum.cave.enter()); await W(800);
    for (let f = 0; f < fq; f++) { await C(() => window.__oreum.cave.down()); await W(600); }
    const d2 = await C(() => window.__oreum.cave.deep()); if (!d2.chest.got) bad('같은 날 다음 판에 상자가 다시 닫혀 있음');
    await C(() => window.__oreum.cave.exit()); await W(900);
  }
  // 셋째 판은 절반: 하나 주운 귤이 반
  await C(() => { window.__oreum.cave.setRuns(2); window.__oreum.trash.api.test.emptyBag?.(); window.__oreum.cave.enter(); }); await W(800);
  r = await C(() => window.__oreum.cave.runs());
  await C(() => { window.__oreum.cave.goPile(0); }); const one = await C(() => { const o = window.__oreum, a = o.cave.held().held.g; o.cave.pickAll(); const h = o.cave.held(); return { g: h.held.g - a, n: h.n }; });
  const full = await C(() => window.__oreum.cave.junk().kinds.reduce((s, k) => s + k.g, 0) / 2);
  console.log(`  셋째 판: 판 ${r.n} 배수 ${r.k} · 주운 ${one.n}개 귤 ${Math.round(one.g)} (하나 평균 ${(one.g / Math.max(1, one.n)).toFixed(1)}, 온전한 판 종류 평균 ${full.toFixed(1)})`);
  if (r.n !== 3 || r.k !== 0.5 || !(one.g / one.n < full * 0.75)) bad('셋째 판 쓰레기 귤이 절반이 아님');
  await C(() => window.__oreum.cave.exit()); await W(900);
}

async function playRun4(p, S) {
  const C = S, W = (ms) => p.waitForTimeout(ms);
  console.log('# 4번 조각 (쪽지·옷·퀘스트·감독 문)');
  const cl = await C(() => window.__oreum.cave.extra.cloth()), r = await C(() => window.__oreum.cave.runs());
  console.log(`  동굴 옷: ${cl.map(([id, on]) => id + (on ? ' 있음' : ' 없음')).join(' · ')} (주인 ${r.boss || '-'} · 상자 ${r.chest.got.join(',') || '-'})`);
  if (r.boss && !cl.find(([id]) => id.startsWith('top:'))[1]) bad('주인을 쫓아냈는데 동굴 탐험복이 없음');
  if (r.chest.got.length && !cl.find(([id]) => id.startsWith('hat:'))[1]) bad('상자를 열었는데 헤드랜턴 헬멧이 없음');
  const shelf = await C(() => { const o = window.__oreum, st = o.street?.leap; if (!st) return null; const ids = []; for (const k of ['hat', 'top']) { st.slot(k); ids.push(...st.items(k).map((i) => i.id || i.key)); } return ids; });
  if (shelf && shelf.some((id) => /c-lamp|c-suit/.test(id))) bad('LEAP 목록에 동굴 옷이 보임'); else console.log(`  LEAP 목록에 동굴 옷 없음 (${shelf ? shelf.length + '개 중' : 'LEAP 없음'})`);
  await C(() => { const o = window.__oreum; o.punkWorld.note.reset(); o.cave.setRuns(0); o.cave.enter(); }); await W(900);
  const got = [];
  for (let f = 0; f < 3; f++) {
    if (f) { await C(() => window.__oreum.cave.down()); await W(700); }
    const n = await C(() => window.__oreum.cave.extra.note());
    if (!n || !n.shown) { bad(`${f + 1}층 벽 쪽지가 없음`); continue; }
    const ok = await C(() => { const o = window.__oreum; o.cave.extra.goNote(); const it = o.interactables.find((i) => i.label === '쪽지 읽기'); return !!it && it.when() && o.player.pos.distanceTo(it.pos) < it.r; });
    await C(() => window.__oreum.cave.extra.read()); await W(300);
    const g = await C((id) => ({ got: window.__oreum.punkWorld.note.got().includes(id), shown: window.__oreum.punkWorld.note.shown() }), n.id);
    await C(() => window.__oreum.punkWorld.note.close()); got.push(n.id);
    console.log(`  ${f + 1}층 쪽지 ${n.id}: 다가가면 '쪽지 읽기' ${ok} · 주움 ${g.got} · 창 '${g.shown || '(표시만)'}'`);
    if (!ok || !g.got) bad(`${f + 1}층 쪽지를 읽을 수 없음`);
  }
  await C(() => { const o = window.__oreum; o.cave.goPile(0); o.cave.pickAll(); }); await W(300);
  const q0 = await C(() => window.__oreum.save.quest?.c?.caveOut || 0);
  await C(() => window.__oreum.cave.exit()); await W(1000);
  const q1 = await C(() => window.__oreum.save.quest?.c?.caveOut || 0), ent = await C(() => { const p = window.__oreum.quest.goPos('cave'), e = window.__oreum.cave.ent(); return p && Math.hypot(p.x - e.fx, p.z - e.fz); });
  console.log(`  퀘스트: 들고 나오기 셈 ${q0} → ${q1} · 길 안내 'cave' 입구에서 ${ent?.toFixed(1)}m`);
  if (q1 !== q0 + 1) bad('들고 나와도 퀘스트 셈 caveOut 이 안 오름'); if (!(ent < 1)) bad("퀘스트 길 안내 'cave' 가 입구가 아님");
  const door = await C(() => { const o = window.__oreum; o.director.open('cave'); return o.director.state().seen?.cave || o.save.journey?.seen?.cave || null; });
  const mut = await C(() => window.__oreum.mutter.lines.includes('cave'));
  console.log(`  감독 문 cave 열림 ${!!door} · 혼잣말 줄 cave ${mut}`);
  if (!door) bad('감독 문 cave 가 없음'); if (!mut) bad('혼잣말 줄 cave 가 없음');
}

// #214 카메라 안마다 층 모양: 걸어서 닿는지·삼각형 (a 는 천장 대신 자른 윗면, b 는 같은 칸 수)
function modeCheck(CAVE, genFloor, caveMesh, caveSeed, caveK, day0) {
  const k = new Date(day0 + 9 * 3600000), day = k.toISOString().slice(0, 10), out = [];
  for (const m of ['c', 'a', 'b']) {
    const K = caveK(CAVE, m); let tris = 0, cap = 0, span = 0, xs = [];
    for (let f = 0; f < CAVE.floors; f++) {
      const F = genFloor(K, f, caveSeed(day, f)), M = caveMesh(F, K); tris += M.tris; cap += M.cap ? M.cap.length / 9 : 0; span = F.span; xs.push(F.ox, F.ox + F.span);
      if (!F.far) bad(`${m} ${f + 1}층: 구멍·주인 방 없음`);
      else { const s = F.start; let ok = false; const N = F.N, C = F.C, seen = new Uint8Array(N * N), q = [], id = (x, z) => Math.floor((z - F.oz) / C) * N + Math.floor((x - F.ox) / C);
        const s0 = id(s.x, s.z), g = id(F.far.x, F.far.z); seen[s0] = 1; q.push(s0);
        for (let h = 0; h < q.length && !ok; h++) { const c = q[h]; if (c === g) ok = true; const i = c % N, j = (c - i) / N; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = (j + b) * N + i + a; if (!seen[n] && F.walk(F.ox + (i + a + 0.5) * C, F.oz + (j + b + 0.5) * C)) { seen[n] = 1; q.push(n); } } }
        if (!ok) bad(`${m} ${f + 1}층: 줄에서 ${F.far.kind} 까지 못 감`); }
    }
    if (tris > 900000) bad(`${m}: 세 층 삼각형 ${tris}`);
    const lo = Math.min(...xs), hi = Math.max(...xs); if (lo < 2400 || hi > 4000) bad(`${m}: 층 자리 x ${Math.round(lo)}~${Math.round(hi)} (오름 밖·서버 한도 안이어야)`);
    for (let f = 1; f < CAVE.floors; f++) if (K.floorGap < span) bad(`${m}: 층이 겹침 (간격 ${K.floorGap} < 폭 ${span})`);
    out.push(`${m}: 세 층 삼각형 ${tris}${cap ? ` (자른 윗면 ${cap})` : ''} · 층 폭 ${Math.round(span)}m · x ${Math.round(lo)}~${Math.round(hi)}`);
  }
  console.log('# 카메라 안 (#214) ' + day + '\n  ' + out.join('\n  '));
}

// #214 세 안으로 같은 3장면 그림·수치
async function modeRun(p, S) {
  const { CAVE } = await import(path.join(process.cwd(), 'src/balance.js'));
  const fs = require('fs'), si = args.indexOf('--shots'), dir = si >= 0 ? args[si + 1] : path.join(process.cwd(), 'notes/shots/214');
  fs.mkdirSync(dir, { recursive: true });
  const frameMs = () => p.evaluate(() => new Promise((res) => { const ts = []; const f = (t) => { ts.push(t); if (ts.length < 31) requestAnimationFrame(f); else res((ts[30] - ts[0]) / 30); }; requestAnimationFrame(f); }));
  const rows = [], clean = () => S(() => { document.querySelectorAll('.lp-x').forEach((b) => b.click()); window.__oreum.hp.set(1e6); });
  for (const m of ['a', 'b', 'c']) {
    await S((m) => { const o = window.__oreum; if (o.cave.state()) o.cave.exit(); o.cave.cam(m); o.hp.set(1e6); }, m); await p.waitForTimeout(500);
    await S(() => window.__oreum.cave.enter()); await p.waitForTimeout(1200);
    const info = await S(() => window.__oreum.cave.camInfo());
    if (info.K !== (m === 'c' ? 'c' : m)) bad(`${m}: 층 모양 안이 ${info.K}`);
    const key = await S(() => window.__oreum.cave.share?.()?.key ?? null);
    const r = { m, shots: [] };
    // 1) 통로 걷기
    if (!(await S(() => window.__oreum.cave.pose('corr')))) bad(`${m}: 통로 자리 못 찾음`);
    await p.waitForTimeout(1400); r.corr = { ...(await S(() => window.__oreum.cave.draw())), ms: await frameMs() };
    await clean(); await p.waitForTimeout(150); await p.screenshot({ path: path.join(dir, `${m}-1-corr.png`) });
    const piles = (await S(() => window.__oreum.cave.junk())).piles.length; if (!piles) bad(`${m}: 1층 더미 없음`);
    // 2) 적 무리와 싸움 (다치지 않게 기운을 채우며)
    await S(() => window.__oreum.cave.wakeAll()); await p.waitForTimeout(600);
    if (!(await S(() => window.__oreum.cave.pose('mob')))) bad(`${m}: 적 곁 자리 못 찾음`);
    await p.waitForTimeout(1500); await S(() => window.__oreum.hp.set(1e6));
    const mobs = await S(() => window.__oreum.cave.mobs()); if (mobs.some((e) => e.walk === false)) bad(`${m}: 벽 속 적`);
    r.mob = { ...(await S(() => window.__oreum.cave.draw())), ms: await frameMs(), n: mobs.length };
    await clean(); await p.waitForTimeout(150); await p.screenshot({ path: path.join(dir, `${m}-2-fight.png`) });
    const g = await S(() => window.__oreum.cave.guard()); if (!g.e || !g.blocks) bad(`${m}: 지킴이가 구멍을 막지 않음`);
    // 3) 주인 방
    await S(() => { window.__oreum.cave.down(); }); await p.waitForTimeout(700); await S(() => { window.__oreum.cave.down(); }); await p.waitForTimeout(900);
    await S(() => { window.__oreum.cave.goOwner(); window.__oreum.hp.set(1e6); }); await p.waitForTimeout(2200);
    const ow = await S(() => window.__oreum.cave.owner()); if (!ow.room || !ow.e) bad(`${m}: 주인 방·주인 없음 ${JSON.stringify(ow)}`);
    await S(() => window.__oreum.hp.set(1e6));
    r.boss = { ...(await S(() => window.__oreum.cave.draw())), ms: await frameMs() };
    if (m === 'c') { /* #218 일부러 귤 크게 흩뿌리기·낙석 비 겹치기 */
      const st = await S(() => { const o = window.__oreum, L = o.life, n0 = L.tangerines.filter((t) => t.drop).length; for (let k = 0; k < 4; k++) L.scatterTangerines(o.player.pos, 200, 60); for (let k = 0; k < 8; k++) o.cave.rockHere(); const ds = L.tangerines.filter((t) => t.drop); return { n0, n: ds.length, v: ds.reduce((a, t) => a + t.v, 0), trail: ds.some((t) => t.trail), rocks: o.cave.deep().rocks }; });
      await p.waitForTimeout(400); const dc = await S(() => window.__oreum.cave.draw());
      console.log(`  흩뿌림·낙석 겹침 (#218): 알갱이 ${st.n0} → ${st.n} · 꼬리 ${st.trail} · 낙석 ${st.rocks} · draw call ${dc.calls}`);
      if (st.n > CAVE.drop.live || st.trail) bad(`동굴 흩어진 귤 알갱이 ${st.n} (상한 ${CAVE.drop.live}) 꼬리 ${st.trail}`);
      if (dc.calls >= 120) bad(`흩뿌림·낙석 겹침 draw call ${dc.calls}`);
      await S(() => window.__oreum.hp.set(1e6));
    }
    await clean(); await p.waitForTimeout(150); await p.screenshot({ path: path.join(dir, `${m}-3-owner.png`) });
    r.key = key; r.dist = info.dist; rows.push(r);
    await S(() => window.__oreum.cave.exit()); await p.waitForTimeout(800);
  }
  await S(() => window.__oreum.cave.cam('a'));
  console.log('# 카메라 세 안 (#214, swiftshader 640×400, 그림 ' + path.relative(process.cwd(), dir) + ')');
  for (const r of rows) console.log(`  ${r.m}: 카메라 거리 ${r.dist}m · 통로 calls ${r.corr.calls} 삼각형 ${r.corr.tris} ${r.corr.ms.toFixed(0)}ms · 싸움(적 ${r.mob.n}) ${r.mob.calls} / ${r.mob.tris} ${r.mob.ms.toFixed(0)}ms · 주인 방 ${r.boss.calls} / ${r.boss.tris} ${r.boss.ms.toFixed(0)}ms`);
  /* 맞으며 싸우는 장면도 120 아래 (#218: 동굴 안 흩어진 귤 알갱이 수 상한·꼬리 없음 CAVE.drop, 낙석은 묶어 그림) */
  for (const r of rows) for (const k of ['corr', 'mob', 'boss']) if (r[k].calls >= 120) bad(`${r.m} ${k} draw call ${r[k].calls} (120 넘음)`);
}
