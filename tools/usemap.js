// 맵 쓰임 지도 (#294): 남송이 맵을 40m 칸으로 나눠 칸마다 '할 것' 이 있는지 칠하고, 길에서의 거리별 수·구역별 빈 땅 비율을 낸다
// - 할 것: 퀘스트 주는 사람·가게 문, 사건 목격·증거·대면, 서바이벌 터·좌판, 소굴, 더미(길가·들판), 우두머리 빈터, 보물·볼거리, 정상 금고·쪽지·망원경,
//   돌탑, 낚시(개울), 미확인 제보 흔적 자리 후보(그 구역 들판 더미 곁), 노루 무리, 클린하우스·수거 관, 크롭서클, 길 밖 곳(game/offpath.js)
// - 걸을 수 있는 칸: 칸 안 25점 가운데 40% 넘게 (구역 안·물 아님·부딪힘 없음·45° 넘는 비탈 아님)
// - 빈 땅: 걸을 수 있는 칸인데 칸 가운데에서 60m 안에 할 것이 하나도 없는 칸. 구역별 비율이 USE.empty(25%) 를 넘으면 FAIL
// node build.mjs && node tools/usemap.js [out 폴더]   (기본 notes/shots/294, 그림 use-zone1~5.png · 표 use.md)
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2] && !process.argv[2].startsWith('-') ? process.argv[2] : 'notes/shots/294';
const CELL = 40, NEAR = 60, EMPTY_MAX = 0.25, BANDS = [20, 60, 120];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 480, height: 300 } });
  const errs = []; p.on('pageerror', (e) => { errs.push(e.message); console.log('ERR', e.message.slice(0, 300)); });
  const ready = () => p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await ready();
  await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1 }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await ready(); await p.waitForTimeout(2500);
  const R = await p.evaluate(({ CELL, PLAN }) => {
    const o = window.__oreum, T = o.trash.api, Z = (x, z) => T.zoneAt(x, z) || 0, pts = [];
    const P = (k, name, x, z) => { if (Number.isFinite(x) && Number.isFinite(z)) pts.push({ k, name, x: +x.toFixed(1), z: +z.toFixed(1), zone: Z(x, z) }); };
    const V = (k, name, v) => v && P(k, name, v.x ?? v[0], v.z ?? v[1]);
    for (const id of (o.cases?.list || []).map((c) => c.id || c)) {
      const sp = o.cases.spots(id); if (!sp) continue;
      if (sp.see) P('case', `사건 ${id} 목격`, sp.see[0], sp.see[1]);
      for (const [k, q] of Object.entries(sp.ev || {})) if (q) P('case', `사건 ${id} 증거 ${k}`, q[0], q[1]);
      if (sp.face) P('case', `사건 ${id} 대면`, sp.face[0], sp.face[1]);
    }
    try { o.arena.list().forEach((a) => P('arena', `터 ${a.zone}`, a.x, a.z)); } catch { /* 없음 */ }
    (o.tok?.stalls?.() || []).forEach((s) => P('arena', `좌판 ${s.zone}`, s.x, s.z));
    const F = o.field?.api || {};
    (F.bosses || []).forEach((q) => P('boss', `우두머리 ${q.zone}`, q.x, q.z));
    (F.dens || []).forEach((q, i) => P('den', `소굴 ${q.zone}-${i}`, q.x, q.z));
    (F.treasures || []).forEach((q) => P('find', `보물 ${q.id}`, q.x, q.z));
    (F.sights || []).forEach((q) => P('find', `볼거리 ${q.name}`, q.x, q.z));
    T.heaps.forEach((h, i) => P(h.field ? 'heapF' : 'heapR', `${h.field ? '들판' : '길가'} 더미 ${i}`, h.x, h.z));
    (o.cleanhouse?.all || []).forEach((c, i) => V('ch', `클린하우스 ${c.id || i}`, c.center || c.front));
    try { (o.tube?.list?.() || o.tube?.ends?.() || []).forEach((t, i) => V('ch', `수거 관 ${i}`, t.pos || t)); } catch { /* 없음 */ }
    for (const [id, g] of o.quest?.givers || []) P('npc', `NPC ${id}`, g.pos.x, g.pos.z);
    (o.street?.shops || []).forEach((sh) => V('npc', `가게 ${sh.id}`, sh.door));
    (o.cairns || []).forEach((c, i) => V('cairn', `돌탑 ${i}`, c.pos || c));
    try { const s = o.summit?.spots?.(); if (s) { V('find', '정상 금고', s.stone && [s.stone[0], s.stone[2]]); V('find', '정상 쪽지', s.note && [s.note[0], s.note[2]]); V('find', '망원경', s.scope && [s.scope[0], s.scope[2]]); V('find', '굼부리 전망', s.rim && [s.rim[0], s.rim[2]]); } } catch { /* 없음 */ }
    try { const st = o.stream; if (st?.at) for (let lat = -60; lat <= 60; lat += 30) { const q = st.at(st.centerOff(lat), lat); P('find', `낚시 ${lat}`, q[0], q[1]); } } catch { /* 없음 */ }
    (o.spots?.deerHerds || []).forEach(([x, z], i) => P('deer', `노루 무리 ${i}`, x, z));
    try { for (const d of ['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06', '2026-12-07']) { o.reports.date(d); const w = o.reports.where(); if (w) P('report', `제보 ${d.slice(5)}`, w[0], w[1]); } o.reports.date(null); } catch { /* 없음 */ }
    try { const cr = o.traces?.cropAt; if (cr) { const seen = new Set(); for (let id = 0; id < 60; id++) { const q = cr(id); if (!q) continue; const key = Math.round(q.x / 10) + ':' + Math.round(q.z / 10); if (seen.has(key)) continue; seen.add(key); P('case', '크롭서클', q.x, q.z); } } } catch { /* 없음 */ }
    (o.offpath?.spots?.() || []).forEach((s) => P('off', `길 밖 ${s.name}`, s.x, s.z));
    /* 길 거리 (journeymap.js 와 같은 셈) */
    const PI = o.pathClear.idx, trail = [], G = new Map(), GC = 20;
    for (let z = -860; z <= 460; z += 3) for (let x = -960; x <= 460; x += 3) if (PI.onPath(x, z, 0)) { trail.push([x, z]); const k = Math.floor(x / GC) * 9973 + Math.floor(z / GC); let a = G.get(k); if (!a) G.set(k, a = []); a.push([x, z]); }
    const pd = (x, z, lim = 400) => { let bb = lim; const r = Math.ceil(lim / GC), ci = Math.floor(x / GC), cj = Math.floor(z / GC);
      for (let rr = 0; rr <= r; rr++) { if ((rr - 1) * GC > bb) break; for (let i = ci - rr; i <= ci + rr; i++) for (let j = cj - rr; j <= cj + rr; j++) { if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== rr) continue; const a = G.get(i * 9973 + j); if (a) for (const q of a) { const d = Math.hypot(q[0] - x, q[1] - z); if (d < bb) bb = d; } } }
      return bb; };
    for (const q of pts) q.trail = +pd(q.x, q.z).toFixed(1);
    /* 40m 칸 */
    const walk = (x, z) => { const zn = Z(x, z); if (!zn) return 0; if (o.bound && !o.bound.inBound(x, z, 1)) return 0; if (o.stream?.inWater?.(x, z)) return 0; if (o.col?.blocked?.(x, z, 0.6)) return 0; if (o.spots?.clamp?.(x, z)) return 0;
      const gx = o.height(x + 1, z) - o.height(x - 1, z), gz = o.height(x, z + 1) - o.height(x, z - 1); return Math.hypot(gx, gz) / 2 < 1.1 ? zn : 0; };
    const cells = [], cand = [];
    const flat = (x, z) => { let lo = 1e9, hi = -1e9; for (let a = 0; a < 6.3; a += 1.05) { const h = o.height(x + Math.cos(a) * 4, z + Math.sin(a) * 4); lo = Math.min(lo, h); hi = Math.max(hi, h); } return hi - lo < 4.2 && !o.col?.blocked?.(x, z, 2.2); };
    for (let z0 = -880; z0 < 480; z0 += CELL) for (let x0 = -960; x0 < 480; x0 += CELL) {
      let n = 0; const zc = {}; for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) { const sx = x0 + 4 + i * 8, sz = z0 + 4 + j * 8, zn = walk(sx, sz); if (zn) { n++; zc[zn] = (zc[zn] || 0) + 1; if (PLAN && o.bound?.inBound?.(sx, sz, 8) && flat(sx, sz)) cand.push([sx, sz, zn]); } }
      if (!n) continue; const zone = +Object.entries(zc).sort((a, c) => c[1] - a[1])[0][0], cx = x0 + CELL / 2, cz = z0 + CELL / 2;
      cells.push({ x: cx, z: cz, zone, walk: n / 25 > 0.4, trail: +pd(cx, cz).toFixed(0) });
    }
    for (const c of cand) c.push(+pd(c[0], c[1]).toFixed(0));
    return { pts, cells, cand, trail: trail.filter((_, i) => i % 2 === 0) };
  }, { CELL, PLAN: process.argv.includes('--plan') });
  /* ---------- 셈 ---------- */
  const band = (d) => (d < BANDS[0] ? 0 : d < BANDS[1] ? 1 : d < BANDS[2] ? 2 : 3);
  const BN = ['0~20', '20~60', '60~120', '120~'];
  for (const c of R.cells) { let bd = 1e9; for (const q of R.pts) { const d = Math.hypot(q.x - c.x, q.z - c.z); if (d < bd) bd = d; } c.near = Math.round(bd); c.empty = c.walk && bd > NEAR; }
  const Zs = [1, 2, 3, 4, 5], rows = [], fails = [];
  for (const z of Zs) {
    const cs = R.cells.filter((c) => c.zone === z && c.walk), em = cs.filter((c) => c.empty), ps = R.pts.filter((q) => q.zone === z), bn = [0, 0, 0, 0];
    for (const q of ps) bn[band(q.trail)]++;
    const off = cs.filter((c) => c.trail >= 60), offEm = off.filter((c) => c.empty), k = cs.length ? em.length / cs.length : 0;
    rows.push({ z, cells: cs.length, empty: em.length, k, bn, off: off.length, offEm: offEm.length, pts: ps.length });
    if (k > EMPTY_MAX) fails.push(`구역 ${z} 빈 땅 ${Math.round(k * 100)}% (${em.length}/${cs.length}칸, ${Math.round(EMPTY_MAX * 100)}% 까지)`);
  }
  const all = rows.reduce((s, r) => ({ cells: s.cells + r.cells, empty: s.empty + r.empty, bn: s.bn.map((v, i) => v + r.bn[i]) }), { cells: 0, empty: 0, bn: [0, 0, 0, 0] });
  /* --spots: 구역마다 빈 땅 가운데(가장 외딴 칸)를 뽑아 줌 */
  if (process.argv.includes('--spots')) for (const z of Zs) {
    const em = R.cells.filter((c) => c.zone === z && c.empty).sort((a, c) => c.near - a.near);
    console.log(`빈 땅 구역 ${z}: ` + em.slice(0, 10).map((c) => `(${c.x},${c.z}) 길${c.trail} 가까운것${c.near}`).join(' · '));
  }
  /* --plan: 빈 땅을 가장 많이 덮는 자리부터 골라 줌 (구역 빈 땅이 PLAN_TO 아래가 될 때까지, 할 것과 30m 넘게·길에서 40m 넘게) */
  if (process.argv.includes('--plan')) for (const z of Zs) {
    const cs = R.cells.filter((c) => c.zone === z && c.walk), em = new Set(cs.filter((c) => c.empty)), took = [], PLAN_TO = 0.18;
    const cand = R.cand.filter((c) => c[2] === z && c[3] >= 40 && !R.pts.some((q) => Math.hypot(q.x - c[0], q.z - c[1]) < 30));
    while (em.size / cs.length > PLAN_TO) {
      let best = null, bs = 0; for (const c of cand) { if (took.some((t) => Math.hypot(t[0] - c[0], t[1] - c[1]) < 70)) continue; let s = 0; for (const e of em) if (Math.hypot(e.x - c[0], e.z - c[1]) <= NEAR) s++; if (s > bs) { bs = s; best = c; } }
      if (!best) break; took.push(best); for (const e of [...em]) if (Math.hypot(e.x - best[0], e.z - best[1]) <= NEAR) em.delete(e);
    }
    console.log(`자리 구역 ${z} (${took.length}곳, 빈 땅 → ${Math.round(em.size / cs.length * 100)}%): ` + took.map((c) => `[${c[0]}, ${c[1]}]/${c[3]}`).join(', '));
  }
  /* ---------- 그림 ---------- */
  fs.mkdirSync(OUT, { recursive: true });
  const COL = { case: '#e0533d', arena: '#2f6fd6', boss: '#111', den: '#8a2b2b', find: '#d9a400', heapR: '#9a9a9a', heapF: '#5a5a5a', ch: '#2c9b57', npc: '#c04b8f', cairn: '#8b6d4a', deer: '#b5651d', report: '#7a3fd1', off: '#00a3a3' };
  const LBL = { case: '사건', arena: '터·좌판', boss: '우두머리', den: '소굴', find: '보물·볼거리·정상·낚시', heapR: '길가 더미', heapF: '들판 더미', ch: '클린하우스·관', npc: 'NPC·가게', cairn: '돌탑', deer: '노루', report: '제보 흔적', off: '길 밖 곳(#294)' };
  const page2 = await b.newPage({ viewport: { width: 760, height: 820 } });
  for (const zone of Zs) {
    const zc = R.cells.filter((c) => c.zone === zone); if (!zc.length) continue;
    const x0 = Math.min(...zc.map((c) => c.x)) - 40, x1 = Math.max(...zc.map((c) => c.x)) + 40, z0 = Math.min(...zc.map((c) => c.z)) - 40, z1 = Math.max(...zc.map((c) => c.z)) + 40;
    const s = Math.min(720 / (x1 - x0), 700 / (z1 - z0)), X = (x) => ((x - x0) * s).toFixed(1), Y = (z) => ((z - z0) * s).toFixed(1), w = (CELL * s).toFixed(1);
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${((x1 - x0) * s).toFixed(0)}" height="${((z1 - z0) * s).toFixed(0)}" style="background:#f4f1e8;font:11px sans-serif">`;
    for (const c of R.cells) { if (c.x < x0 || c.x > x1 || c.z < z0 || c.z > z1) continue; const mine = c.zone === zone; const f = !c.walk ? '#d8d4c8' : !mine ? '#ebe7dc' : c.empty ? '#f3b9a8' : '#cfe3bf';
      svg += `<rect x="${X(c.x - CELL / 2)}" y="${Y(c.z - CELL / 2)}" width="${w}" height="${w}" fill="${f}" stroke="#fff" stroke-width="0.6"/>`; }
    for (const t of R.trail) { if (t[0] < x0 || t[0] > x1 || t[1] < z0 || t[1] > z1) continue; svg += `<rect x="${X(t[0] - 1.5)}" y="${Y(t[1] - 1.5)}" width="${(3 * s + 0.6).toFixed(1)}" height="${(3 * s + 0.6).toFixed(1)}" fill="#a08868"/>`; }
    for (const q of R.pts) { if (q.x < x0 || q.x > x1 || q.z < z0 || q.z > z1) continue; svg += `<circle cx="${X(q.x)}" cy="${Y(q.z)}" r="${q.k === 'off' ? 6 : 3.6}" fill="${COL[q.k] || '#000'}" stroke="#fff" stroke-width="1"/>`;
      if (q.k === 'off') svg += `<text x="${+X(q.x) + 8}" y="${+Y(q.z) + 4}" fill="#055">${q.name.replace('길 밖 ', '')}</text>`; }
    const r = rows.find((q) => q.z === zone);
    let ly = 14; svg += `<rect x="4" y="2" width="190" height="${Object.keys(LBL).length * 14 + 50}" fill="#fff" opacity="0.88"/><text x="8" y="${ly}" font-weight="bold">구역 ${zone} · 빈 땅 ${Math.round(r.k * 100)}% (${r.empty}/${r.cells}칸)</text>`;
    for (const [k, t] of Object.entries(LBL)) { ly += 14; svg += `<circle cx="13" cy="${ly - 4}" r="4" fill="${COL[k]}"/><text x="22" y="${ly}">${t}</text>`; }
    svg += `<rect x="8" y="${ly + 6}" width="10" height="10" fill="#f3b9a8"/><text x="22" y="${ly + 15}">빈 땅 (60m 안에 할 것 없음)</text><rect x="8" y="${ly + 20}" width="10" height="10" fill="#cfe3bf"/><text x="22" y="${ly + 29}">쓰는 땅 · 회색 = 못 걷는 칸</text></svg>`;
    await page2.setContent(`<html><body style="margin:0">${svg}</body></html>`);
    const el = await page2.$('svg'); await el.screenshot({ path: `${OUT}/use-zone${zone}.png` });
  }
  /* ---------- 표 ---------- */
  const pc = (v) => `${Math.round(v * 100)}%`;
  const md = [`| 구역 | 걸을 수 있는 칸 | 빈 땅 | 비율 | 길에서 60m 넘는 칸 중 빈 땅 | 할 것 수 | 길에서 ${BN.join(' / ')} m |`, '|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.z} | ${r.cells} | ${r.empty} | ${pc(r.k)} | ${r.offEm}/${r.off} | ${r.pts} | ${r.bn.join(' / ')} |`),
    `| 모두 | ${all.cells} | ${all.empty} | ${pc(all.empty / all.cells)} | | ${R.pts.length} | ${all.bn.join(' / ')} |`];
  fs.writeFileSync(`${OUT}/use.md`, md.join('\n') + '\n');
  console.log(md.join('\n'));
  for (const f of fails) console.log('FAIL ' + f);
  console.log(`할 것 ${R.pts.length}개 · 칸 ${R.cells.length} · 그림 ${OUT}/use-zone1~5.png · 표 ${OUT}/use.md`);
  if (errs.length) console.log('페이지 오류', errs.length);
  await b.close(); process.exit(fails.length || errs.length ? 1 : 0);
})();
