// 여정 자리 지도 (#256, notes/journey.md 2-1절 자리 놓기 규칙): 구역마다 사건 목격·증거·대면·터·좌판·우두머리 빈터·클린하우스(수거 관)·NPC·돌탑·크롭서클 자리를 뽑아
// 위에서 본 그림(notes/shots/256/zone<N>.png)으로 그리고 규칙을 잰다
// - 사건 목격: 길에서 20m 안 · 증거: 길에서 30~120m, 셋이 서로 다른 쪽(가운데에서 본 방향이 서로 60도 넘게) · 터: 길에서 30~80m
// - 몰림: 서로 다른 '할 일 자리' 둘이 40m 안 (한 묶음은 빼고 셈: 터와 그 좌판·징, 클린하우스와 수거 관, 터에서 하는 대면)
// node build.mjs && node tools/journeymap.js [out 폴더]   끝 코드: 규칙에 어긋난 것이 있으면 1 (목록은 표로)
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2] || 'notes/shots/256';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 480, height: 300 } });
  const errs = []; p.on('pageerror', (e) => { errs.push(e.message); console.log('ERR', e.message.slice(0, 300)); });
  const ready = () => p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await ready();
  await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1 }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await ready(); await p.waitForTimeout(2500);
  const R = await p.evaluate(() => {
    const o = window.__oreum, T = o.trash.api, F = o.field.api, Z = (x, z) => T.zoneAt(x, z) || 0;
    const pts = []; /* { k 종류, name, x, z, zone, unit 묶음 } */
    const P = (k, name, x, z, unit = '') => { if (Number.isFinite(x) && Number.isFinite(z)) pts.push({ k, name, x: +x.toFixed(1), z: +z.toFixed(1), zone: Z(x, z), unit }); };
    const cases = (o.cases?.list || []).map((c) => c.id || c);
    for (const id of cases) {
      const sp = o.cases.spots(id); if (!sp) continue; const cd = o.cases.def?.(id) || {}, cz = cd.zone || 0;
      if (sp.see) P('see', `사건 ${id} 목격`, sp.see[0], sp.see[1]);
      for (const [k, q] of Object.entries(sp.ev || {})) if (q) P('ev', `사건 ${id} 증거 ${k}`, q[0], q[1], 'ev:' + id);
      if (sp.face) P('face', `사건 ${id} 대면`, sp.face[0], sp.face[1], cd.face === 'arena' ? 'arena:' + cz : '');
    }
    o.arena.list().forEach((a) => { P('arena', `터 ${a.zone}`, a.x, a.z, 'arena:' + a.zone); });
    (o.tok?.stalls?.() || []).forEach((s) => P('stall', `좌판 ${s.zone}`, s.x, s.z, 'arena:' + s.zone));
    (F.bosses || []).forEach((q) => P('boss', `우두머리 ${q.zone}`, q.x, q.z));
    (o.cleanhouse?.all || []).forEach((c, i) => { const q = c.center || c.front || c; P('ch', `클린하우스 ${c.id || i}`, q.x, q.z, 'ch:' + (c.id || i)); });
    for (const [id, g] of o.quest?.givers || []) P('npc', `NPC ${id}`, g.pos.x, g.pos.z);
    { const rb = o.rankBoard?.state?.(); if (rb?.big) P('board', '순위판', rb.big.x, rb.big.z); if (rb?.small) P('board', '순위판 작은', rb.small.x, rb.small.z); } /* #289 */
    (o.cairns || []).forEach((c, i) => P('cairn', `돌탑 ${i}`, c.pos?.x ?? c.x, c.pos?.z ?? c.z));
    try { const cr = o.traces?.cropAt; if (cr) { const seen = new Set(); for (let id = 0; id < 60; id++) { const q = cr(id); if (!q) continue; const key = Math.round(q.x / 10) + ':' + Math.round(q.z / 10); if (seen.has(key)) continue; seen.add(key); pts.push({ k: 'crop', name: '크롭서클', x: +q.x.toFixed(1), z: +q.z.toFixed(1), zone: Z(q.x, q.z), unit: 'crop', soft: 1 }); } } } catch (e) { /* 없음 */ }
    /* 길: 탐방로·들머리 길 모두 (namsongi pathIdx). 3m 격자로 길 칸을 모아 거리 셈 */
    const PI = o.pathClear.idx, trail = [], G = new Map(), GC = 20;
    for (let z = -860; z <= 460; z += 3) for (let x = -960; x <= 460; x += 3) if (PI.onPath(x, z, 0)) { trail.push([x, z]); const k = Math.floor(x / GC) * 9973 + Math.floor(z / GC); let a = G.get(k); if (!a) G.set(k, a = []); a.push([x, z]); }
    const pd = (x, z, lim = 400) => { let b = lim; const r = Math.ceil(lim / GC), ci = Math.floor(x / GC), cj = Math.floor(z / GC);
      for (let rr = 0; rr <= r; rr++) { if ((rr - 1) * GC > b) break; for (let i = ci - rr; i <= ci + rr; i++) for (let j = cj - rr; j <= cj + rr; j++) { if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== rr) continue; const a = G.get(i * 9973 + j); if (a) for (const q of a) { const d = Math.hypot(q[0] - x, q[1] - z); if (d < b) b = d; } } }
      return b; };
    window.__jmDist = pd;
    for (const q of pts) q.trail = +pd(q.x, q.z).toFixed(1);
    const heaps = T.heaps.map((h) => [+h.x.toFixed(1), +h.z.toFixed(1), h.zone || Z(h.x, h.z)]);
    /* 구역 칸 (8m 격자) */
    const cells = []; for (let z = -800; z <= 400; z += 8) for (let x = -900; x <= 400; x += 8) { const k = Z(x, z); if (k) cells.push([x, z, k]); }
    const lamp = o.cleanhouse?.all?.length || 0;
    return { pts, trail, heaps, cells, lamp, cases };
  });
  /* ---------- 규칙 ---------- */
  const { CASES } = await import(require('path').join(__dirname, '../src/cases/index.js'));
  const CB = Object.fromEntries(CASES.map((c) => [c.id, c]));
  const cid = (q) => (/^사건 (c\d)/.exec(q.name) || [])[1];
  const FIELD_CASE = new Set(['c1']); /* 사건 1 크롭서클은 들판 가운데(싸움 없음, #232): 길에서 멀어 추적 줄이 이끎 (#256) */
  const PLACE_EV = { k4c: ' — 관리 초소(금고 0404) 곁이라 길가' }; /* 이야기상 자리가 정해진 증거 */
  const MIN = (zone) => (zone === 5 ? 25 : 40); /* 정상(구역 5)은 지름 130m 남짓이라 25m */
  for (const q of R.pts) { /* 같은 사건의 목격·대면(·목격 자리 그 자체인 흔적)은 한 묶음 */
    const id = cid(q); if (!id) continue; const c = CB[id], sp = R.pts.find((w) => w.name === `사건 ${id} 목격`);
    const e = q.k === 'ev' ? c?.ev?.find((w) => q.name.endsWith(' ' + w.id)) : null;
    const onTrail = e && c.trail?.pts?.some(([x, z]) => Math.hypot(q.x - x, q.z - z) < 4); /* 발자국 줄 위의 증거 (#236) */
    if (q.k === 'see' || (q.k === 'face' && !q.unit) || (e && (e.view || onTrail || (sp && Math.hypot(q.x - sp.x, q.z - sp.z) < 3)))) q.unit = 'case:' + id; /* 목격 자리를 보는 증거(view)도 묶음 */
    if (q.k === 'see') q.r = c?.see?.r || 0;
    if (q.k === 'face' && q.unit.startsWith('arena:')) q.unit2 = 'case:' + id;
    q.giver = c?.giver || '';
  }
  const bad = [], soft = []; const flag = (q, why, sf) => { q.bad = (q.bad ? q.bad + ' · ' : '') + why; (sf ? soft : bad).push([q.zone, q.name, why]); if (!sf) q.move = 1; };
  for (const q of R.pts) {
    const c = CB[cid(q)];
    if (q.k === 'see' && q.trail - (c?.see?.r || 0) > 21) flag(q, `목격이 길에서 ${q.trail}m (보이는 거리 ${c?.see?.r || 0}m 빼고 20 안)${FIELD_CASE.has(cid(q)) ? ' — 길 없는 들판 사건: 추적 줄(다음 할 일 case)이 목격 자리로 이끎' : ''}`, FIELD_CASE.has(cid(q)));
    if (q.k === 'ev' && !q.unit.startsWith('case:') && (q.trail < 25 || q.trail > 120)) flag(q, `증거가 길에서 ${q.trail}m (30~120, 25 까지 봐줌)${PLACE_EV[q.name.split(' ').pop()] || ''}`, !!PLACE_EV[q.name.split(' ').pop()]);
    if (q.k === 'arena' && (q.trail < 27 || q.trail > 80)) flag(q, `터가 길에서 ${q.trail}m (30~80, #253 자리라 참고)`, 1);
  }
  /* 증거 셋이 서로 다른 쪽: 세 증거 무게중심에서 본 방향 */
  for (const id of R.cases) {
    const ev = R.pts.filter((q) => q.k === 'ev' && cid(q) === id); if (ev.length < 3) continue;
    const cx = ev.reduce((s, q) => s + q.x, 0) / ev.length, cz = ev.reduce((s, q) => s + q.z, 0) / ev.length;
    const ang = ev.map((q) => Math.atan2(q.z - cz, q.x - cx)).sort((a, c) => a - c);
    let minGap = 9; for (let i = 0; i < ang.length; i++) { const g = ((ang[(i + 1) % ang.length] - ang[i]) + Math.PI * 4) % (Math.PI * 2) || Math.PI * 2; minGap = Math.min(minGap, g); }
    if (minGap < Math.PI / 6) flag(ev[0], `사건 ${id} 증거 셋이 한 줄로 몰림 (사이 각 ${Math.round(minGap * 57.3)}도)`, 1);
  }
  /* 순위판 (#289): 오름지기·NPC·돌탑·클린하우스와 6m 안이면 어긋남, 큰 판은 정낭에서 40m 안 */
  for (const q of R.pts.filter((w) => w.k === 'board')) {
    for (const c of R.pts) if (['npc', 'cairn', 'ch'].includes(c.k) && Math.hypot(q.x - c.x, q.z - c.z) < 6) flag(q, `${q.name} ↔ ${c.name} ${Math.hypot(q.x - c.x, q.z - c.z).toFixed(1)}m (6 안)`);
  }
  /* 몰림 */
  const KEY = new Set(['see', 'ev', 'face', 'arena', 'stall', 'boss', 'ch', 'npc', 'cairn']);
  const keys = R.pts.filter((q) => KEY.has(q.k));
  const same = (a, c) => (a.unit && (a.unit === c.unit || a.unit === c.unit2)) || (a.unit2 && a.unit2 === c.unit);
  const own = (a, c) => a.giver && (c.name === `NPC ${a.giver}` || c.name === `클린하우스 ${a.giver.replace(/^b:/, '')}`); /* 의뢰인 곁 증거(이야기상 그 자리) */
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
    const a = keys[i], c = keys[j]; if (same(a, c) || own(a, c) || own(c, a)) continue;
    if ((a.k === 'npc' && c.k === 'npc') || (a.k === 'cairn' && c.k === 'cairn')) continue;
    if ((a.k === 'npc' || c.k === 'npc') && (a.k === 'ch' || c.k === 'ch' || a.k === 'cairn' || c.k === 'cairn')) continue; /* 들머리 마을 */
    const d = Math.hypot(a.x - c.x, a.z - c.z), lim = MIN(a.zone || c.zone);
    if (d >= lim || !['see', 'ev', 'face', 'arena', 'stall', 'boss'].some((k) => k === a.k || k === c.k)) continue;
    const fixed = (q) => cid(q) && (!!PLACE_EV[q.name.split(' ').pop()] || (q.k === 'ev' && q.unit.startsWith('case:'))); /* 발자국 줄 위·목격 자리 증거는 묶음째 */
    const mv = cid(a) && !fixed(a) ? a : cid(c) && !fixed(c) ? c : null; /* 사건 자리만 옮김 (터는 #253, 자리가 정해진 증거·나머지는 참고) */
    const one = mv || a, other = one === a ? c : a;
    flag(one, `${one.name} ↔ ${other.name} ${d.toFixed(1)}m (${lim} 안)`, !mv);
  }
  /* --find: 어긋난 사건 자리마다 가장 가까운 새 자리 후보 */
  if (process.argv.includes('--find')) {
    const mv = R.pts.filter((q) => q.move);
    const sug = await p.evaluate(({ mv, keys }) => {
      const o = window.__oreum, T = o.trash.api, col = o.col, A = o.arena.list();
      return mv.map((q) => {
        const search = (loose) => {
        const lim = (q.zone === 5 ? 25 : 40) * (loose ? 0.75 : 1), tr = q.k === 'see' ? [6, 20 + (q.r || 0)] : q.k === 'ev' ? (loose ? [25, 150] : [32, 115]) : [0, 200];
        const grp = q.k === 'see' && q.unit ? keys.filter((w) => w.unit === q.unit) : [q]; /* 목격은 묶음째 옮김 */
        let best = null, bd = 1e9; const W = loose ? 420 : 250, ST = loose ? 4 : 3;
        const okAt = (w, x, z) => T.zoneAt(x, z) === q.zone && !col.blocked(x, z, 1.5) && !(T.ok && !T.ok(x, z)) && !A.some((a) => Math.hypot(a.x - x, a.z - z) < a.r + 6)
          && !keys.some((v) => !grp.some((g) => g.name === v.name) && !(q.unit && v.unit === q.unit) && Math.hypot(v.x - x, v.z - z) < lim);
        for (let dz = -W; dz <= W; dz += ST) for (let dx = -W; dx <= W; dx += ST) {
          const d0 = Math.hypot(dx, dz); if (d0 >= bd) continue;
          const x = q.x + dx, z = q.z + dz;
          const t = window.__jmDist(x, z, 200); if (t < tr[0] || t > tr[1]) continue;
          if (!grp.every((w) => okAt(w, w.x + dx, w.z + dz))) continue;
          if (q.k === 'see') { let h0 = 1e9, h1 = -1e9; for (let a = 0; a < 6.3; a += 0.8) { const h = o.height(x + Math.cos(a) * 7, z + Math.sin(a) * 7); h0 = Math.min(h0, h); h1 = Math.max(h1, h); } if (h1 - h0 > (loose ? 3.5 : 2)) continue; }
          best = [x, z, +t.toFixed(1), dx, dz, loose ? 1 : 0]; bd = d0;
        }
        return { best, bd, grp };
        };
        let { best, bd, grp } = search(false); if (!best) ({ best, bd, grp } = search(true));
        return { name: q.name, from: [q.x, q.z], to: best, d: best ? +bd.toFixed(1) : null, grp: grp.map((w) => w.name) };
      });
    }, { mv, keys: keys.map(({ name, x, z, unit }) => ({ name, x, z, unit })) });
    for (const s of sug) console.log(`옮길 곳 ${s.name}: (${s.from}) → ${s.to ? `(${s.to[0]}, ${s.to[1]}) 길 ${s.to[2]}m · ${s.d}m 옮김 (${s.to[3]}, ${s.to[4]})${s.to[5] ? ' (느슨히)' : ''}${s.grp.length > 1 ? ' 묶음 ' + s.grp.join('·') : ''}` : '없음'}`);
  }
  /* ---------- 그림 ---------- */
  fs.mkdirSync(OUT, { recursive: true });
  const COL = { board: '#6b4a2a', see: '#e0533d', ev: '#f2a23a', face: '#9b3fd1', arena: '#2f6fd6', stall: '#59a5ff', boss: '#111', ch: '#2c9b57', npc: '#c04b8f', cairn: '#8b6d4a', crop: '#d9c84a' };
  const LBL = { board: '순위판', see: '목격', ev: '증거', face: '대면', arena: '터', stall: '좌판', boss: '우두머리', ch: '클린하우스·관', npc: 'NPC', cairn: '돌탑', crop: '크롭서클' };
  const page2 = await b.newPage({ viewport: { width: 760, height: 820 } });
  for (let zone = 1; zone <= 5; zone++) {
    const cells = R.cells.filter((c) => c[2] === zone); if (!cells.length) continue;
    let x0 = Math.min(...cells.map((c) => c[0])) - 30, x1 = Math.max(...cells.map((c) => c[0])) + 38, z0 = Math.min(...cells.map((c) => c[1])) - 30, z1 = Math.max(...cells.map((c) => c[1])) + 38;
    const W = 720, s = Math.min(W / (x1 - x0), 700 / (z1 - z0)), X = (x) => ((x - x0) * s).toFixed(1), Y = (z) => ((z - z0) * s).toFixed(1);
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${((x1 - x0) * s).toFixed(0)}" height="${((z1 - z0) * s).toFixed(0)}" style="background:#f4f1e8;font:11px sans-serif">`;
    for (const c of R.cells) { if (c[0] < x0 || c[0] > x1 || c[1] < z0 || c[1] > z1) continue; svg += `<rect x="${X(c[0])}" y="${Y(c[1])}" width="${(8 * s + 0.5).toFixed(1)}" height="${(8 * s + 0.5).toFixed(1)}" fill="${c[2] === zone ? '#dfe8cf' : '#ebe7dc'}"/>`; }
    for (const t of R.trail) { if (t[0] < x0 || t[0] > x1 || t[1] < z0 || t[1] > z1) continue; svg += `<rect x="${X(t[0] - 1.5)}" y="${Y(t[1] - 1.5)}" width="${(3 * s + 0.6).toFixed(1)}" height="${(3 * s + 0.6).toFixed(1)}" fill="#a08868"/>`; }
    for (const h of R.heaps) if (h[2] === zone) svg += `<circle cx="${X(h[0])}" cy="${Y(h[1])}" r="2.2" fill="#999"/>`;
    const here = R.pts.filter((q) => q.x >= x0 && q.x <= x1 && q.z >= z0 && q.z <= z1);
    for (const q of here) {
      const c = COL[q.k] || '#000';
      if (q.k === 'arena') svg += `<circle cx="${X(q.x)}" cy="${Y(q.z)}" r="${(16 * s).toFixed(1)}" fill="none" stroke="${c}" stroke-width="2"/>`;
      if (q.bad) svg += `<circle cx="${X(q.x)}" cy="${Y(q.z)}" r="9" fill="none" stroke="#e00" stroke-width="2" stroke-dasharray="3 2"/>`;
      svg += `<circle cx="${X(q.x)}" cy="${Y(q.z)}" r="${q.k === 'crop' ? 3 : 5}" fill="${c}" stroke="#fff" stroke-width="1"/>`;
      if (q.k !== 'crop' && q.k !== 'cairn') svg += `<text x="${+X(q.x) + 7}" y="${+Y(q.z) + 4}" fill="#222">${q.name.replace(/^사건 /, '').replace('클린하우스 ', 'CH ')}</text>`;
    }
    let ly = 14; svg += `<rect x="4" y="2" width="118" height="${Object.keys(LBL).length * 14 + 22}" fill="#fff" opacity="0.85"/><text x="8" y="${ly}" font-weight="bold">구역 ${zone}</text>`;
    for (const [k, t] of Object.entries(LBL)) { ly += 14; svg += `<circle cx="13" cy="${ly - 4}" r="4" fill="${COL[k]}"/><text x="22" y="${ly}">${t}</text>`; }
    svg += `<text x="8" y="${ly + 14}" fill="#e00">빨간 점선 = 규칙 어긋남</text></svg>`;
    await page2.setContent(`<html><body style="margin:0">${svg}</body></html>`);
    const el = await page2.$('svg'); await el.screenshot({ path: `${OUT}/zone${zone}.png` });
  }
  /* ---------- 표 ---------- */
  const rows = R.pts.filter((q) => q.k !== 'crop').sort((a, c) => a.zone - c.zone || a.k.localeCompare(c.k));
  const md = ['| 구역 | 자리 | x | z | 길까지(m) | 어긋남 |', '|---|---|---|---|---|---|', ...rows.filter((q) => KEY.has(q.k) && q.k !== 'npc' && q.k !== 'cairn' || q.bad).map((q) => `| ${q.zone} | ${q.name} | ${q.x} | ${q.z} | ${q.trail} | ${q.bad || ''} |`)];
  fs.writeFileSync(`${OUT}/spots.md`, md.join('\n') + '\n');
  for (const [z, n, w] of soft) console.log(`참고 구역 ${z} ${n}: ${w}`);
  for (const [z, n, w] of bad) console.log(`FAIL 구역 ${z} ${n}: ${w}`);
  console.log(`자리 ${R.pts.length}개 · 어긋남 ${bad.length} · 참고 ${soft.length} · 그림 ${OUT}/zone1~5.png · 표 ${OUT}/spots.md`);
  if (errs.length) console.log('페이지 오류', errs.length);
  await b.close(); process.exit(bad.length || errs.length ? 1 : 0);
})();
