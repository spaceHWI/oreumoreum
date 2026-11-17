// 연출 감독 확인 (#89): 20분짜리 자동 플레이 기록에서 힐링·긴장 구간의 시간표를 뽑는다 (깨끗한 오름·전투 오름 각각)
// src/pacing.js 를 그대로 돌리고, 플레이어는 흉내 낸다: 더미를 70~150초마다 하나 치움(꽃), 가끔 낚시(바쁨), 적은 5~30초 안에 쫓아내거나(85%) 놓침
// (더미를 70~270초마다 하나 치움)
// 확인: 물결 수, 긴장 비율(힐링 50% 이상), 겹침 0 (공격끼리·꽃 핀 뒤 10초·공격 뒤 쉼 90초·긴장 중 팁/잭팟/마차 표시), 첫 공격(꽃 한 번 뒤 투기꾼 하나)
// node tools/pace.js            표 + notes/shots/pace-89.svg (시간표 그림)
// node tools/pace.js --png      그림을 png 로도 (playwright)
// node tools/pace.js --seeds 50 여러 번 돌려 평균·최악값
// node tools/pace.js --live     dist/test.html 에서 실제 게임으로 한 번씩(깨끗한·전투): 조짐 → 공격 → 다 쫓아냄 → 보상·쉼, 긴장 화면을 notes/shots/pace-89-<서버>.png
const path = require('path'), fs = require('fs');
(async () => {
  const { createPacing } = await import(path.join(__dirname, '../src/pacing.js'));
  const { PACE, DUMP } = await import(path.join(__dirname, '../src/balance.js'));
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1] ?? true; };
  const seeds = +arg('--seeds', 1), MIN = +arg('--min', 20), DT = 0.25;
  const mul32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  function run(server, seed, firstRun) {
    const rnd = mul32(seed * 7919 + (server === 'battle' ? 1 : 0) + (firstRun ? 99 : 0)), prnd = mul32(seed * 31 + 5);
    let threats = [], now = 0, busyUntil = 0, nextBloom = 40 + prnd() * 80, nextFish = 200 + prnd() * 300, cur = null;
    const blooms = [], tipsShown = [], violations = [];
    const first = firstRun ? { done: false, bloomed: false } : { done: true, bloomed: true };
    const P = createPacing({
      isBattle: () => server === 'battle', rnd, first, perHour: 1000 * DUMP.hourFrac * 3,
      hooks: {
        busy: () => now < busyUntil,
        threats: () => threats.filter((x) => !x.done).length,
        omen: (plan) => { cur = plan; return true; },
        attack: (plan) => {
          const n = (plan.mob ? (server === 'battle' ? 2 + Math.floor(prnd() * 2) : 0) : 0) + plan.dumpers.length;
          const eta = 20 + prnd() * 40;
          threats = Array.from({ length: n }, (_, i) => { const dumper = i >= n - plan.dumpers.length, give = dumper ? eta + DUMP.dumpT : 180; const rep = 5 + prnd() * 25; const ok = prnd() < 0.85 && rep < give; return { at: now + (ok ? rep : give), ok, done: false }; });
          return { n, eta: Math.max(...threats.map(() => eta)) };
        },
        forceEnd: () => { threats.forEach((x) => { x.done = true; }); },
        end: () => { cur = null; },
        delight: () => true,
      },
    });
    for (now = 0; now < MIN * 60; now += DT) {
      // 플레이어 흉내
      if (now >= nextBloom && P.phase !== 'tense') { P.note('bloom'); blooms.push(now); nextBloom = now + 70 + prnd() * 200; }
      if (now >= nextFish) { busyUntil = now + 40 + prnd() * 50; nextFish = now + 300 + prnd() * 300; }
      for (const x of threats) if (!x.done && now >= x.at) { x.done = true; if (x.ok) P.note('repel'); }
      // 팁·잭팟·마차: 긴장 중이면 막혀야 함
      if (Math.floor(now / 30) !== Math.floor((now - DT) / 30) && P.canTip()) tipsShown.push(now);
      if ((P.phase === 'tense' || P.phase === 'omen') && (P.canTip() || P.canJack() || P.canMark())) violations.push({ t: now, what: 'ui' });
      P.update(DT);
    }
    // 구간
    const segs = []; P.log.forEach((l, i) => segs.push({ phase: l.phase, a: l.t, b: i + 1 < P.log.length ? P.log[i + 1].t : MIN * 60 }));
    const tenseSegs = segs.filter((s) => s.phase === 'omen' || s.phase === 'tense');
    const attacks = []; segs.forEach((s) => { if (s.phase === 'omen') attacks.push({ a: s.a, b: s.b }); else if (s.phase === 'tense' && attacks.length && Math.abs(attacks[attacks.length - 1].b - s.a) < 1e-6) attacks[attacks.length - 1].b = s.b; else if (s.phase === 'tense') attacks.push({ a: s.a, b: s.b, adhoc: true }); });
    const tenseT = tenseSegs.reduce((s, x) => s + x.b - x.a, 0);
    // 겹침
    for (let i = 1; i < attacks.length; i++) { if (attacks[i].a < attacks[i - 1].b) violations.push({ t: attacks[i].a, what: 'attack-overlap' }); if (attacks[i].a < attacks[i - 1].b + PACE.rest - 1e-6) violations.push({ t: attacks[i].a, what: 'rest' }); }
    for (const b of blooms) for (const at of attacks) if (at.a > b + 1e-6 && at.a < b + PACE.bloomQuiet - 1e-6) violations.push({ t: at.a, what: 'bloom-quiet' });
    for (const at of attacks) { const len = at.b - at.a; if (len > PACE.omen + PACE.attack[1] + 0.5) violations.push({ t: at.a, what: 'too-long' }); }
    const ends = P.events.filter((e) => e.kind === 'end'), firstAtk = P.events.find((e) => e.kind === 'omen');
    return { server, seed, firstRun, segs, attacks, blooms, delights: P.events.filter((e) => e.kind === 'delight'), ends, violations, tenseT, ratio: tenseT / (MIN * 60), firstAtk, firstBloom: blooms[0], gaps: attacks.slice(1).map((a, i) => a.a - attacks[i].a) };
  }


  if (process.argv.includes('--live')) {
    const { chromium } = require('playwright');
    const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    let fail = 0;
    for (const srv of ['clean', 'battle']) {
      const p = await b.newPage({ viewport: { width: 640, height: 400 } }); p.on('pageerror', (e) => { fail++; console.log('ERR', e.message.slice(0, 300)); });
      await p.goto('file://' + path.join(__dirname, '../dist/test.html') + '#namsongi'); await p.waitForTimeout(6000);
      await p.click('#enter').catch(() => {});
      await p.evaluate((s) => { const bs = document.querySelectorAll('#intro-srv button'); (bs[s === 'battle' ? 1 : 0] || bs[0])?.click(); }, srv).catch(() => {});
      await p.click('#srv-go').catch(() => {}); await p.waitForTimeout(4000);
      const L = await p.evaluate(() => {
        const O = window.__oreum, P = O.pace.pacing, L = [];
        try { O.look.close(); } catch { /* 없음 */ } O.cam.mode = 'follow'; O.save.jeong = 1; O.save.tut = { ...(O.save.tut || {}), done: 1 }; O.setTod(15);
        document.body.classList.remove('tut'); const h = document.getElementById('tut-hint'); if (h) h.hidden = true;
        for (let i = 0; i < O.trash.api.heaps.length; i += 3) O.trash.setHeap(i, Math.floor(O.trash.api.heaps[i].n / 2)); // 빈 자리가 있어야 투기꾼이 옴
        if (O.server.isBattle()) { const x = -60, z = 40; O.player.pos.set(x, O.groundAt(x, z), z); O.snap(); } // 1구역 (몹이 나오는 곳)
        P.test.first.done = true; P.test.first.bloomed = true; P.test.soon(0);
        const snap = (tag) => L.push({ tag, phase: P.phase, ten: +P.tension.toFixed(2), dump: O.dumpers.state().map((d) => d.kind + ':' + d.state).join(' '), en: O.enemies.test.state().map((e) => e.kind + ':' + e.state).join(' '), ev: P.events.slice(-1)[0]?.kind });
        for (let i = 0; i < 4; i++) { P.update(1); snap('+' + (i + 1) + '초'); }
        return L;
      });
      await p.waitForTimeout(2500);
      const vis = await p.evaluate(() => { const O = window.__oreum; return { edge: document.getElementById('pace-edge').style.opacity, expo: +O.renderer.toneMappingExposure.toFixed(3), hpBar: !document.getElementById('hp-bar').hidden, music: O.pace.threat() }; });
      await p.screenshot({ path: path.join(__dirname, `../notes/shots/pace-89-${srv}.png`) });
      const L2 = await p.evaluate(() => {
        const O = window.__oreum, P = O.pace.pacing, c0 = O.save.coins;
        O.dumpers.state().forEach((d, i) => O.dumpers.hit(i));
        O.enemies.list.slice().forEach((e) => { if (e.state === 'flee' || e.state === 'leave') return; e.state = 'flee'; O.life.hooks.enemyRepel(e.kind, e.pos, e.def); });
        P.update(1.5); const end = P.events.filter((e) => e.kind === 'end').pop();
        return { phase: P.phase, end, coins: O.save.coins - c0, toast: document.getElementById('toast').textContent, nextIn: Math.round(P.nextIn), tip: P.canTip(), jack: P.canJack() };
      });
      console.log(srv, L.map((x) => `${x.tag} ${x.phase} 긴장${x.ten} ${x.dump}${x.en}`).join(' | '));
      console.log(srv, '긴장 화면', vis); console.log(srv, '끝', L2);
      if (!(L.some((x) => x.phase === 'omen') && L.some((x) => x.phase === 'tense') && L2.phase === 'rest' && L2.end?.full && vis.edge > 0)) { fail++; console.log(srv, '실패'); }
      await p.close();
    }
    await b.close();
    if (fail) process.exitCode = 1; else console.log('live 통과');
    return;
  }
  const rows = [];
  for (const server of ['clean', 'battle']) for (const firstRun of [false, true]) {
    const rs = []; for (let s = 1; s <= seeds; s++) rs.push(run(server, s, firstRun));
    const avg = (f) => rs.reduce((a, r) => a + f(r), 0) / rs.length, max = (f) => Math.max(...rs.map(f)), minf = (f) => Math.min(...rs.map(f));
    const gaps = rs.flatMap((r) => r.gaps), lens = rs.flatMap((r) => r.attacks.filter((a) => a.b < MIN * 60 - 1e-6).map((a) => a.b - a.a)); // 20분 끝에 잘린 것은 뺌
    rows.push({
      서버: server === 'clean' ? '깨끗한' : '전투', 처음: firstRun ? '예' : '',
      물결: seeds > 1 ? `${avg((r) => r.attacks.length).toFixed(1)} (${minf((r) => r.attacks.length)}~${max((r) => r.attacks.length)})` : rs[0].attacks.length,
      '긴장 %': seeds > 1 ? `${(avg((r) => r.ratio) * 100).toFixed(1)} (최대 ${(max((r) => r.ratio) * 100).toFixed(1)})` : (rs[0].ratio * 100).toFixed(1),
      '간격 초': gaps.length ? `${Math.round(Math.min(...gaps))}~${Math.round(Math.max(...gaps))}` : '-',
      '공격 길이 초': lens.length ? `${Math.round(Math.min(...lens))}~${Math.round(Math.max(...lens))}` : '-',
      '다 쫓아냄': `${rs.reduce((a, r) => a + r.ends.filter((e) => e.full).length, 0)}/${rs.reduce((a, r) => a + r.ends.length, 0)}`,
      즐거움: (avg((r) => r.delights.length)).toFixed(1),
      첫공격: firstRun ? (rs[0].firstAtk ? `꽃 ${Math.round(rs[0].firstBloom)}초 → ${Math.round(rs[0].firstAtk.t)}초 ${rs[0].firstAtk.dumpers}` : '없음') : '',
      겹침: rs.reduce((a, r) => a + r.violations.length, 0),
    });
    if (seeds === 1 && !firstRun) rows[rows.length - 1]._r = rs[0];
    if (seeds === 1 && firstRun) rows[rows.length - 1]._r = rs[0];
  }
  console.table(rows.map(({ _r, ...r }) => r));
  const bad = rows.reduce((a, r) => a + r.겹침, 0);
  for (const r of rows) if (r._r) for (const v of r._r.violations.slice(0, 5)) console.log('겹침', r.서버, v);

  // 시간표 그림 (seed 1, 처음 아님 + 처음)
  if (seeds === 1) {
    const W = 1000, rowH = 34, pad = 110, top = 30, X = (t) => pad + (t / (MIN * 60)) * (W - pad - 20);
    const C = { calm: '#bfe3b4', rest: '#e8f3d8', omen: '#f6c76a', tense: '#e46b4f' };
    let y = top, svg = '';
    for (const r of rows) {
      const R = r._r; const label = `${r.서버}${r.처음 ? ' (처음)' : ''}`;
      svg += `<text x="8" y="${y + 21}" font-size="14" font-family="sans-serif" fill="#333">${label}</text>`;
      for (const s of R.segs) svg += `<rect x="${X(s.a).toFixed(1)}" y="${y}" width="${Math.max(0.5, X(s.b) - X(s.a)).toFixed(1)}" height="${rowH - 6}" fill="${C[s.phase]}"/>`;
      for (const b of R.blooms) svg += `<circle cx="${X(b).toFixed(1)}" cy="${y + rowH - 4}" r="3" fill="#ee7fae"/>`;
      for (const d of R.delights) svg += `<path d="M${X(d.t).toFixed(1)} ${y - 4} l4 6 h-8z" fill="#7c9fe6"/>`;
      y += rowH + 8;
    }
    for (let m = 0; m <= MIN; m += 5) svg += `<text x="${X(m * 60)}" y="${y + 12}" font-size="12" text-anchor="middle" font-family="sans-serif" fill="#555">${m}분</text><line x1="${X(m * 60)}" x2="${X(m * 60)}" y1="${top - 6}" y2="${y}" stroke="#0002"/>`;
    const lg = [['calm', '힐링'], ['rest', '쉼(공격 뒤)'], ['omen', '조짐 3초'], ['tense', '공격']];
    lg.forEach(([k, n], i) => { svg += `<rect x="${pad + i * 130}" y="${y + 24}" width="14" height="14" fill="${C[k]}"/><text x="${pad + i * 130 + 20}" y="${y + 36}" font-size="13" font-family="sans-serif">${n}</text>`; });
    svg += `<circle cx="${pad + 4 * 130 + 7}" cy="${y + 31}" r="4" fill="#ee7fae"/><text x="${pad + 4 * 130 + 16}" y="${y + 36}" font-size="13" font-family="sans-serif">꽃 핌</text>`;
    svg += `<path d="M${pad + 5 * 130 + 3} ${y + 26} l4 8 h-8z" fill="#7c9fe6"/><text x="${pad + 5 * 130 + 14}" y="${y + 36}" font-size="13" font-family="sans-serif">작은 즐거움</text>`;
    const H = y + 50;
    const out = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#fff"/>${svg}</svg>`;
    const dir = path.join(__dirname, '../notes/shots'); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'pace-89.svg'), out); console.log('그림 notes/shots/pace-89.svg');
    if (process.argv.includes('--png')) {
      const { chromium } = require('playwright'); const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: H } });
      await p.setContent(out); await p.screenshot({ path: path.join(dir, 'pace-89.png') }); await b.close(); console.log('그림 notes/shots/pace-89.png');
    }
  }
  if (bad) { console.log('겹침', bad); process.exitCode = 1; }
})();
