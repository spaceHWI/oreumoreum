// 서바이벌 터 확인 (#231): node tools/arena.js   (먼저 node build.mjs)
// 1) 구역마다 터 원 안의 더미·소굴·보물·볼거리·우두머리 빈터·NPC·상호작용(징 빼고)·돌탑·클린하우스·하르방 수 = 0, 소굴·보물·볼거리·빈터 수는 balance.js 그대로
// 2) 들판(터 밖, 길에서 먼 곳)을 걸어 다녀도 판이 시작되지 않음
// 3) 구역 1~5: 징 앞에서 상호작용(F) → 판 시작 · 시간을 끝으로 당겨 버팀 → 덤·쉬는 시간 · 쉬는 시간엔 징이 '쉬는 중'(시작 안 됨)
// 4) 판 중 터 밖으로 나가 arena.leave 초 → 끝, 덤 없음, 쉬는 시간 절반 · 5) 처음 들어간 구역 안내 한 줄 · 터 메시 그리기 수
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 560 } });
  const errs = []; p.on('pageerror', (e) => { errs.push(e.message); console.log('ERR', e.message.slice(0, 300)); });
  const W = (ms) => p.waitForTimeout(ms), ev = (fn, a) => p.evaluate(fn, a);
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await ev(() => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1, recycle: { visits: 3 }, swarm: { seen: 1, best: {} } }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.click('#enter', { timeout: 20000 }).catch(() => {}); await W(1500);
  await ev(() => { const o = window.__oreum; o.pace.pacing.test.first.done = true; o.pace.pacing.test.first.bloomed = true; o.setTod(13); o.setWeather('clear'); o.director.open('field'); document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; }); });

  // 1) 터 안에 아무것도 없음
  const r1 = await ev(() => {
    const o = window.__oreum, T = o.trash.api, F = o.field.api, S = o.spots, L = o.arena.list(), out = [];
    const gongs = new Set(L.map((a) => a.zone).map((z) => o.arena.act(z)));
    for (const a of L) {
      const n = {}, add = (k, x, z, r = 0) => { if (Math.hypot(x - a.x, z - a.z) < a.r + r) n[k] = (n[k] || 0) + 1; };
      T.heaps.forEach((h) => add('더미', h.x, h.z, h.r || 0)); F.dens.forEach((d) => add('소굴', d.x, d.z, 4)); F.treasures.forEach((t) => add('보물', t.x, t.z, 1)); F.sights.forEach((s) => add('볼거리', s.x, s.z, 3)); F.bosses.forEach((q) => add('빈터', q.x, q.z, q.r));
      o.interactables.forEach((i) => { if (!gongs.has(i) && i.pos) add('상호작용:' + (i.label || '?'), i.pos.x, i.pos.z); });
      (o.cairns || []).forEach((c) => add('돌탑', c.x, c.z, 1));
      [S.cleanhouse, ...(S.cleanMinis || [])].filter(Boolean).forEach((c) => { const q = c.front || c; if (Number.isFinite(q.x)) add('클린하우스', q.x, q.z, 3); });
      (S.hareubangs || []).forEach((q) => { const x = q.x ?? q[0], z = q.z ?? q[1]; if (Number.isFinite(x)) add('하르방', x, z); });
      for (const [, g] of o.quest.givers || []) add('NPC:' + g.id, g.pos.x, g.pos.z);
      out.push({ zone: a.zone, x: a.x, z: a.z, n, inZone: T.zoneAt(a.x, a.z) });
    }
    const cnt = (L2) => { const c = {}; L2.forEach((q) => { c[q.zone] = (c[q.zone] || 0) + 1; }); return c; };
    return { out, dens: cnt(F.dens), tr: cnt(F.treasures), sights: F.sights.length, bosses: F.bosses.length };
  });
  for (const a of r1.out) ok(!Object.keys(a.n).length && a.inZone === a.zone, `구역 ${a.zone} 터 (${a.x}, ${a.z}) 안 퀘스트 목표 0 ${JSON.stringify(a.n)}`);
  const B = require('fs').readFileSync('src/balance.js', 'utf8'), arr = (re) => JSON.parse(B.match(re)[1]);
  const denN = arr(/den: \{ n: (\[[^\]]+\])/), trN = arr(/treasure: \{ n: (\[[^\]]+\])/);
  ok([1, 2, 3, 4, 5].every((z) => (r1.dens[z] || 0) === denN[z] && (r1.tr[z] || 0) === trN[z]) && r1.bosses === 5, `소굴·보물·빈터 수 그대로 ${JSON.stringify({ dens: r1.dens, tr: r1.tr, bosses: r1.bosses, sights: r1.sights })}`);

  // 2) 들판을 걸어도 시작 안 함
  const r2 = await ev(async () => {
    const o = window.__oreum, T = o.trash.api, A = o.arena.list(), seen = [];
    o.swarm.clearRest();
    for (const h of T.heaps.filter((q) => q.field)) {
      const x = h.x + h.r + 5, z = h.z; if (A.some((a) => Math.hypot(a.x - x, a.z - z) < a.r + 5)) continue;
      o.player.pos.set(x, o.height(x, z), z); await new Promise((r) => setTimeout(r, 700)); seen.push(!!o.swarm.state());
      if (seen.length >= 6) break;
    }
    return { n: seen.length, any: seen.some(Boolean) };
  });
  ok(r2.n >= 4 && !r2.any, `들판 ${r2.n}곳에 서 봐도 판이 시작되지 않음`);

  // 5) 처음 들어간 구역 안내
  const r5 = await ev(async () => { const o = window.__oreum; o.enemies.test.clear(); o.hp.set(o.hp.max); o.player.target = null; await new Promise((r) => setTimeout(r, 400)); /* 앞 단계 들판에서 맞아 쓰러지면 들것이 자리를 옮김 (#253) */ o.arena.clearHint(); const a = o.arena.list()[1]; o.tp(a.gong.x + Math.sin(a.face) * 6, a.gong.z + Math.cos(a.face) * 6, a.face + Math.PI); const seen = [], mo = new MutationObserver(() => { const t = document.getElementById('toast')?.textContent || ''; if (t && seen[seen.length - 1] !== t) seen.push(t); }); mo.observe(document.body, { subtree: true, childList: true, characterData: true }); o.arena.clearHint(); /* 같은 때 뜨는 다른 알림(구역 안내 등)이 덮어써도 뜬 적이 있는지 봄 (#253) */
    for (let t = 0; t < 30 && !seen.some((q) => /남쪽 사면 서바이벌 터/.test(q)); t++) await new Promise((r) => setTimeout(r, 100)); mo.disconnect(); const at = [Math.round(o.player.pos.x), Math.round(o.player.pos.z)]; const toast = seen.find((q) => /남쪽 사면 서바이벌 터/.test(q)) || seen.join(' / '); return { hint: o.arena.hint(), toast, at }; });
  ok(r5.hint[2] === 1 && /남쪽 사면 서바이벌 터/.test(r5.toast), `구역 2 에 처음 들어가면 안내 한 줄: ${r5.toast.slice(0, 60)}${r5.hint[2] ? '' : ' (자리 ' + r5.at + ')'}`);

  // 3) 구역마다 징 → 판 → 버팀
  for (let z = 1; z <= 5; z++) {
    const r3 = await ev(async (z) => {
      const o = window.__oreum, a = o.arena.list().find((q) => q.zone === z), P = o.player, sl = (ms) => new Promise((r) => setTimeout(r, ms));
      o.enemies.test.clear(); o.hp.set(o.hp.max); o.swarm.clearRest(z);
      const f = a.face, until = async (fn, ms = 20000) => { for (let t = 0; t < ms && !fn(); t += 200) await sl(200); return fn(); };
      o.tp(a.gong.x + Math.sin(f) * 1.8, a.gong.z + Math.cos(f) * 1.8, f + Math.PI, 0.25, 11); P.target = null;
      await sl(1500); await until(() => o.arena.ui().tag, 5000); /* 징 위 글: 화면이 자리 잡을 때까지 (#253) */
      const tagOn = o.arena.ui().tag, before = !!o.swarm.state();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', code: 'KeyF' })); window.dispatchEvent(new KeyboardEvent('keyup', { key: 'f', code: 'KeyF' }));
      await sl(400);
      const st = o.swarm.state(); if (!st) return { tagOn, before, started: false, why: o.swarm.why(z), ctx: document.querySelector('#ctx span, .ctx span')?.textContent };
      o.swarm.speed(3); const n = (await until(() => (o.swarm.state()?.n || 0) > 0 && o.swarm.state().n)) || 0; o.hp.set(o.hp.max);
      o.swarm.t(st.T - 0.5); await until(() => !o.swarm.state()); o.swarm.speed(1);
      const last = o.swarm.last, rest = o.swarm.rest(z), why = o.swarm.why(z);
      await sl(700); const tag = o.arena.ui().tag;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', code: 'KeyF' })); window.dispatchEvent(new KeyboardEvent('keyup', { key: 'f', code: 'KeyF' })); await sl(300);
      return { tagOn, before, started: st.zone === z, n, last: last && { why: last.why, bonus: last.bonus }, rest: Math.round(rest), why, tag, again: !!o.swarm.state(), won: o.swarm.won()[z] };
    }, z);
    ok(!r3.before && r3.started && /서바이벌 시작/.test(r3.tagOn || ''), `구역 ${z}: 징 위 글 '${(r3.tagOn || '').slice(0, 40)}' · F 로 판 시작${r3.started ? '' : ' (안 됨: ' + r3.why + ' / ' + r3.ctx + ')'}`);
    if (!r3.started) continue;
    ok(r3.n > 0, `구역 ${z}: 터 둘레에서 떼가 나옴 (${r3.n}마리)`);
    ok(r3.last?.why === 'win' && r3.rest > 400 && r3.why === 'rest' && !!r3.won, `구역 ${z}: 버팀 → 덤 ${r3.last?.bonus} · 쉬는 시간 ${r3.rest}초 · 서버 몫 won ${JSON.stringify(r3.won)}`);
    ok(/쉬는 중/.test(r3.tag || '') && !r3.again, `구역 ${z}: 쉬는 동안 징 '${(r3.tag || '').slice(0, 30)}' · 눌러도 시작 안 함`);
  }

  // 4) 터를 벗어나면 끝
  const r4 = await ev(async () => {
    const o = window.__oreum, a = o.arena.list()[0], P = o.player, sl = (ms) => new Promise((r) => setTimeout(r, ms));
    o.enemies.test.clear(); o.hp.set(o.hp.max); o.swarm.clearRest(); o.swarm.start(1); await sl(500);
    const x = a.x + a.r + 6, z = a.z; P.pos.set(x, o.height(x, z), z); await sl(1200);
    const warn = document.getElementById('toast')?.textContent || '', mid = !!o.swarm.state();
    o.swarm.speed(3); for (let i = 0; i < 40 && o.swarm.state(); i++) { o.hp.set(o.hp.max); P.pos.set(x, o.height(x, z), z); await sl(250); } o.swarm.speed(1);
    return { warn, mid, why: o.swarm.last?.why, bonus: o.swarm.last?.bonus, rest: Math.round(o.swarm.rest(1)) };
  });
  ok(r4.mid && /터 밖/.test(r4.warn), `터 밖 경고 '${r4.warn.slice(0, 40)}'`);
  ok(r4.why === 'leave' && r4.bonus === 0 && r4.rest > 200 && r4.rest <= 241, `터 밖 8초 → 끝 (${r4.why}, 덤 ${r4.bonus}, 쉬는 시간 ${r4.rest}초 = 절반)`);

  // 그리기 수: 터 메시 하나
  const r6 = await ev(async () => { const o = window.__oreum, a = o.arena.list()[0], P = o.player, sl = (ms) => new Promise((r) => setTimeout(r, ms)); o.enemies.test.clear(); o.swarm.clearRest();
    o.tp(a.x, a.z + a.r + 10, Math.PI, 0.3, 16); await sl(900); const on = o.renderer.info.render.calls; const L = o.arena.list();
    return { calls: on, drawn: L.filter((q) => q.drawn).map((q) => q.zone), arrow: o.arena.ui().arrow }; });
  ok(r6.drawn.length <= 2, `그려지는 터 ${JSON.stringify(r6.drawn)} (화면 그리기 ${r6.calls})`);

  ok(!errs.length, `페이지 오류 ${errs.length}`);
  await b.close(); process.exit(fails ? 1 : 0);
})();
