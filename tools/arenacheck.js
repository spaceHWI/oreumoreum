// 서바이벌 터 겹침 검사 (#253): node build.mjs && node tools/arenacheck.js [find [구역]]
// 구역마다 터 원(반지름 r + 돌 고리 RING)과 떼가 나오는 테두리 밖 띠(r + SWARM.arena.spawn[1])에 겹치는 것을 모두 센다.
// - 안(터 + 돌 고리): 부딪히는 사물(돌담·나무·바위·가게 등)·탐방로·마차 노선·더미·소굴·보물·볼거리·우두머리 빈터·NPC·상호작용(징 빼고)·
//   돌탑·하르방(구역 지킴이 자리 포함)·클린하우스·가로등·벤치·표지·사건 파일 자리·방송 스피커·정상 볼거리·크롭서클(400일 치)·보이는 장식(바위·나무·꽃 인스턴스)
// - 띠(떼가 나오는 곳): 경계 돌담 밖으로 나가는 곳·돌담 부딪힘 = 0, 그 밖의 사물은 수만 적음
// - 땅: 터 안 높이 차(m), 길에서 터 가운데까지 거리(m, 30~80 이 좋음), 문(길 쪽) 방향
// find [z]: 그 구역(없으면 1~5)에서 조건을 모두 채우는 새 자리 후보를 찾아 좋은 순으로 찍음 (소굴·보물·볼거리·빈터는 터를 피해 다시 놓이므로 뺌)
// 끝 코드: 구역 1~5 안 겹침이 모두 0 이면 0
const { chromium } = require('playwright');
const MODE = process.argv[2] || 'check', ONLY = +process.argv[3] || 0, HMAX = +(process.env.HMAX || 5), TMIN = +(process.env.TMIN || 27), TMAX = +(process.env.TMAX || 80);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 480, height: 300 } });
  const errs = []; p.on('pageerror', (e) => { errs.push(e.message); console.log('ERR', e.message.slice(0, 300)); });
  const ready = () => p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await ready();
  await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1 }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await ready(); await p.waitForTimeout(2500);
  const res = await p.evaluate(({ MODE, ONLY, HMAX, TMIN, TMAX }) => {
    const o = window.__oreum, T = o.trash.api, F = o.field.api, S = o.spots, PC = o.pathClear, col = o.col, B = o.bound, H = o.height;
    const L0 = o.arena.list(), R = L0[0].r, RING = 0.8, BAND = 9, gongs = new Set(L0.map((a) => o.arena.act(a.zone)));
    const arenaMeshes = new Set(o.arena.meshes ? o.arena.meshes() : []);
    /* 점 사물 [이름, x, z, 반지름] (터를 옮기면 다시 놓이는 것은 re: 1) */
    const pts = [];
    const P = (k, x, z, r = 1, re = 0) => { if (Number.isFinite(x) && Number.isFinite(z)) pts.push([k, x, z, r, re]); };
    T.heaps.forEach((h) => P('더미', h.x, h.z, h.r || 1));
    F.dens.forEach((d) => P('소굴', d.x, d.z, 4, 1)); F.treasures.forEach((t) => P('보물', t.x, t.z, 1.5, 1)); F.sights.forEach((s) => P('볼거리:' + s.kind, s.x, s.z, 4.6, 1)); F.bosses.forEach((q) => P('우두머리 빈터', q.x, q.z, q.r, 1));
    const reNear = (x, z) => [...F.treasures, ...F.sights, ...F.dens].some((t) => Math.hypot(t.x - x, t.z - z) < 4); /* 보물·볼거리 상호작용도 터를 피해 다시 놓임 */
    o.interactables.forEach((i) => { if (!gongs.has(i) && i.pos) P('상호작용:' + String(i.label || i.ic || '?').slice(0, 12), i.pos.x, i.pos.z, 1, reNear(i.pos.x, i.pos.z) ? 1 : 0); });
    (o.cairns || []).forEach((c) => P('돌탑', c.pos?.x ?? c.x, c.pos?.z ?? c.z, 1.5));
    (o.cleanhouse?.all || []).forEach((c) => { const q = c.center || c.front || c; P('클린하우스', q.x, q.z, 4); });
    (S.hareubangs || []).forEach((q) => P('하르방', q.pos?.x ?? q.x, q.pos?.z ?? q.z, 1.3));
    (o.guard?.spots?.() || []).forEach((q) => P('구역 지킴이 하르방', q.x, q.z, 1.3));
    for (const [id, g] of o.quest?.givers || []) P('NPC:' + id, g.pos.x, g.pos.z, 1);
    (o.lamps?.points || []).forEach((q) => P('가로등', q.x, q.z, 0.6));
    if (S.bench?.pos) P('벤치', S.bench.pos.x, S.bench.pos.z, 1.5);
    if (S.sign?.pos) P('표지', S.sign.pos.x, S.sign.pos.z, 1.5);
    if (S.photo?.stone) P('정상 표지석', S.photo.stone.x, S.photo.stone.z, 1.5);
    try { const sp = o.summit?.spots?.(); if (sp) for (const k of ['stone', 'note', 'scope']) if (sp[k]) P('정상:' + k, sp[k][0], sp[k][2], 1); } catch (e) { /* 없음 */ }
    try { (o.punkWorld?.radio?.spots?.() || []).forEach((q) => P('방송 스피커', q.x, q.z, 1)); } catch (e) { /* 없음 */ }
    try { for (const id of (o.cases?.list || []).map((c) => c.id || c)) { const sp = o.cases.spots(id); if (!sp) continue; if (sp.see) P('사건 ' + id + ' 목격', sp.see[0], sp.see[1], 1.5); if (sp.face) P('사건 ' + id + ' 대면', sp.face[0], sp.face[1], 1.5); for (const [k, q] of Object.entries(sp.ev || {})) if (q) P('사건 ' + id + ' 증거 ' + k, q[0], q[1], 1.5); } } catch (e) { /* 없음 */ }
    try { const cr = o.traces?.cropAt; if (cr) for (let id = 0; id < 400; id++) { const q = cr(id); if (q) P('크롭서클', q.x, q.z, q.r, 1); } } catch (e) { /* 없음 */ }
    /* 보이는 장식: 씬의 인스턴스(바위·나무·꽃 등) 가운데 점. 움직이는 것(사람·적·귤)은 뺌 */
    const deco = [];
    { const M = new o.camObj.matrix.constructor(), V = new o.camObj.position.constructor(); o.scene.updateMatrixWorld(true);
      const skip = (m) => { for (let q = m; q; q = q.parent) if (q.userData?.dyn || /enemy|player|peer|gyul|tangerine|swarm|grass|tree|lamp|fly|bloom|tea|wall/i.test(q.name || '')) return true; return false; };
      o.scene.traverse((m) => {
        if (!m.isInstancedMesh || skip(m) || arenaMeshes.has(m) || /^(ffa530|ffbe5a|4f8a3a)$/.test(m.material?.color?.getHexString?.() || '')) return; /* 바닥 귤·잎·빛(life.js, 움직임) */
        const g = m.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
        const nm = m.name || (g.type.replace('Geometry', '') + ':' + (m.material?.color?.getHexString?.() || '?'));
        for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, M); M.premultiply(m.matrixWorld); V.setFromMatrixPosition(M); const s = M.getMaxScaleOnAxis(); if (s < 1e-4) continue; deco.push([nm, V.x, V.z, Math.min(1.5, g.boundingSphere.radius * s * 0.5)]); }
      });
    }
    try { const BK = ['꽃', '어린 나무', '풀']; (o.bloom?.api?.decor?.() || []).forEach(([k, x, z]) => deco.push(['핀 ' + (BK[k] || k), x, z, k === 1 ? 1.1 : 0.3])); } catch (e) { /* 없음 */ }
    const R2 = o.rides?.cart?.api?.route, cart = []; if (R2) for (let s = 0; s <= R2.len; s += 1) { const q = R2.at(s); cart.push([q.x, q.z]); }
    const natN = PC.natN;
    /* 한 자리 (cx, cz) 를 잼. full=false 면 띠 사물·장식은 세지 않고 빨리 */
    function measure(zone, cx, cz, full, skipRe) {
      const inside = {}, band = {}, add = (o2, k) => { o2[k] = (o2[k] || 0) + 1; };
      const seen = new Set(), st = full ? 0.5 : 1;
      let hMin = 1e9, hMax = -1e9, outB = 0, zoneMiss = 0, zoneN = 0;
      for (let dz = -(R + BAND); dz <= R + BAND; dz += st) for (let dx = -(R + BAND); dx <= R + BAND; dx += st) {
        const d = Math.hypot(dx, dz); if (d > R + BAND) continue; const x = cx + dx, z = cz + dz, ring = d <= R + RING;
        if (ring && d <= R) { const h = H(x, z); if (h < hMin) hMin = h; if (h > hMax) hMax = h; }
        if (!ring && B.insideBy(x, z) < 1.5) outB++;
        if (ring && full) { zoneN++; if (T.zoneAt(x, z) !== zone) zoneMiss++; }
        const w = col.which(x, z, 0);
        if (w && !seen.has(w[3])) { seen.add(w[3]); const k = B.insideBy(w[0], w[1]) < 4 ? '돌담' : w[3] < natN ? '나무·바위' : '구조물'; if (ring) add(inside, k); else if (full || k === '돌담') add(band, k); }
        if (ring && PC.idx.onPath(x, z, 0) && !seen.has('path')) { seen.add('path'); add(inside, '탐방로'); }
      }
      for (const [x, z] of cart) { const d = Math.hypot(x - cx, z - cz); if (d < R + RING + 1.2) { add(inside, '마차 노선'); break; } }
      for (const [k, x, z, r, re] of pts) { if (re && skipRe) continue; const d = Math.hypot(x - cx, z - cz) - r; if (d < R + RING) add(inside, k); else if (full && d < R + BAND) add(band, k); }
      if (full && !skipRe) for (const [k, x, z, r] of deco) { const d = Math.hypot(x - cx, z - cz) - r; if (d < R + RING) add(inside, '장식:' + k); }
      const trail = T.trail.dist(cx, cz, 200);
      return { zone, x: +cx.toFixed(1), z: +cz.toFixed(1), inside, band, outB, hRange: +(hMax - hMin).toFixed(2), trail: +trail.toFixed(1), zoneMiss: zoneN ? +(zoneMiss / zoneN).toFixed(2) : 0 };
    }
    if (MODE !== 'find') return { mode: 'check', rows: L0.map((a) => ({ ...measure(a.zone, a.x, a.z, true, false), face: a.face, gongY: a.gong.y })), deco: deco.length, pts: pts.length };
    /* 후보 찾기: 구역 안 4m 격자, 길에서 30~80m, 빠른 검사 통과 → 자세히 */
    const out = {};
    for (let zone = 1; zone <= 5; zone++) {
      if (ONLY && zone !== ONLY) continue;
      const c = [], zMax = zone === 3 || zone === 5 ? 0.45 : 0.1; /* 능선·정상은 좁아 터가 옆 구역에 걸침 (떼는 옆 구역에서도 나옴) */
      const x0 = -900, x1 = 400, z0 = -800, z1 = 400;
      const why = {}, no = (k) => { why[k] = (why[k] || 0) + 1; };
      for (let z = z0; z <= z1; z += 4) for (let x = x0; x <= x1; x += 4) {
        if (T.zoneAt(x, z) !== zone) continue;
        if (B.insideBy(x, z) < R + BAND + 2) { no('경계'); continue; }
        const td = T.trail.dist(x, z, TMAX + 10); if (td < TMIN || td > TMAX) { no('길 거리'); continue; }
        const m = measure(zone, x, z, false, true);
        if (m.hRange > HMAX) { no('기울기'); continue; } if (m.outB || m.band['돌담']) { no('띠 돌담'); continue; }
        if (Object.keys(m.inside).length) { for (const k of Object.keys(m.inside)) no('안:' + k); continue; }
        c.push(m);
      }
      c.sort((a, b) => a.hRange - b.hRange);
      const top = []; for (const m of c.slice(0, 120)) { const f = measure(zone, m.x, m.z, true, true); if (Object.keys(f.inside).length || f.zoneMiss > zMax) { for (const k of Object.keys(f.inside)) no('자세히:' + k); if (f.zoneMiss > zMax) no('자세히:다른 구역'); continue; } f.score = +(f.hRange + Math.max(0, f.trail - 50, 35 - f.trail) / 4 + Object.values(f.band).reduce((s, v) => s + v, 0) * 0.15 + f.zoneMiss * 10).toFixed(2); top.push(f); }
      top.sort((a, b) => a.score - b.score); out[zone] = { n: c.length, top: top.slice(0, 8), why };
    }
    return { mode: 'find', out };
  }, { MODE, ONLY, HMAX, TMIN, TMAX });
  let fails = 0;
  if (res.mode === 'check') {
    console.log(`사물 점 ${res.pts} · 보이는 장식 인스턴스 ${res.deco}`);
    for (const r of res.rows) {
      const nIn = Object.values(r.inside).reduce((s, v) => s + v, 0), bad = nIn + r.outB + (r.band['돌담'] || 0);
      if (bad) fails++;
      console.log(`${bad ? 'FAIL' : 'ok  '} 구역 ${r.zone} 터 (${r.x}, ${r.z}) 문 ${r.face} · 안 겹침 ${nIn} ${JSON.stringify(r.inside)} · 띠 돌담 밖 ${r.outB}칸 · 띠 ${JSON.stringify(r.band)} · 높이 차 ${r.hRange}m · 길까지 ${r.trail}m · 다른 구역 ${r.zoneMiss}`);
    }
  } else {
    for (const [z, v] of Object.entries(res.out)) { console.log(`구역 ${z}: 빠른 검사 통과 ${v.n}곳 · 걸린 까닭 ${JSON.stringify(v.why)}`); v.top.forEach((f) => console.log(`  (${f.x}, ${f.z}) 점수 ${f.score} 높이 차 ${f.hRange} 길 ${f.trail} 띠 ${JSON.stringify(f.band)} 다른 구역 ${f.zoneMiss}`)); }
  }
  if (errs.length) { console.log('페이지 오류', errs.length); fails++; }
  await b.close(); process.exit(fails ? 1 : 0);
})();
