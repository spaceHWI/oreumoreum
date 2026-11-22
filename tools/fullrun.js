// 사건 파일 통 플레이 (#243): node tools/fullrun.js [d|m|dm] [--chain] [--parts] [--shots]   (먼저 node build.mjs)
// 두 갈래를 차례로 돌리고 마지막에 표를 낸다 (기본은 둘 다, 폰·데스크톱 둘 다 = dm)
//  parts: 따로 도는 검사를 순서대로 — tutrun(튜토리얼 실제 놀이) → questrun(구역 1 줄기) → caserun c1~c5(사건 하나씩 새 저장) → casefin(끝 연출·엔딩)
//  chain: 한 저장으로 처음부터 엔딩까지 — 새로 시작·튜토리얼 건너뛰기 → 구역마다 [줄기 퀘스트를 셈으로 채워 끝냄 → 그 구역 사건을 실제로(caserun.runCase)]
//         → 다섯 종결 → 끝 연출(빨간 실·칭호) → 창을 닫으면 엔딩. 중간에 사건 도중 새로 고침(증거 하나 뒤)·쓰러짐(들것)·구역 이동에도 진행이 그대로인지 봄
//         구역 이동은 다음 사건 자리로 순간 이동(구역이 바뀜). 멀티 합류는 node tools/online.js 가 봄 (여기선 혼자)
// 표: 갈래 · 모드 · 통과 · 걸린 시간 · 실패 줄(처음 셋)
const { spawnSync } = require('child_process');
const { chromium, devices } = require('playwright');
const { enterGame, runCase } = require('./caserun.js');
const args = process.argv.slice(2), has = (k) => args.includes(k);
const modes = (args.find((a) => /^(d|m|dm|md)$/.test(a)) || 'dm').split('');
const doChain = has('--chain') || !has('--parts'), doParts = has('--parts') || !has('--chain'), SHOTS = has('--shots');
const table = [], perfOut = {};
const fmt = (s) => `${Math.floor(s / 60)}분 ${Math.round(s % 60)}초`;

function part(script, a, mode) {
  const t0 = Date.now(), r = spawnSync('node', [script, ...a], { encoding: 'utf8', timeout: 40 * 60e3, maxBuffer: 64e6 });
  const out = (r.stdout || '') + (r.stderr || ''), bad = out.split('\n').filter((l) => /^(FAIL|ERR)/.test(l));
  const okk = r.status === 0;
  table.push({ 갈래: script.replace('tools/', '') + ' ' + a.filter((x) => x !== mode).join(' '), 모드: mode, 통과: okk ? 'ok' : '✗', 시간: fmt((Date.now() - t0) / 1000), 실패: bad.slice(0, 3).join(' | ').slice(0, 300) || (okk ? '' : `코드 ${r.status} ${r.signal || ''}`) });
  console.log(okk ? 'ok  ' : 'FAIL', script, a.join(' '), fmt((Date.now() - t0) / 1000)); if (!okk) console.log(bad.slice(0, 8).join('\n'));
}

async function chain(mode) {
  const { CASES } = await import('../src/cases/index.js');
  const B = await import('../src/balance.js');
  let fails = 0; const bad = []; const ok = (c, msg) => { console.log(c ? 'ok  ' : 'FAIL', `[${mode}] ${msg}`); if (!c) { fails++; bad.push(msg); } };
  const t0 = Date.now();
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext(mode === 'm' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage(); let errs = 0;
  p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); bad.push('ERR ' + e.message.slice(0, 120)); });
  const W = (ms) => p.waitForTimeout(ms), ev = (fn, arg) => p.evaluate(fn, arg);
  const until = async (fn, ms = 8000, arg) => { const t1 = Date.now(); while (Date.now() - t1 < ms) { if (await ev(fn, arg).catch(() => false)) return true; await W(250); } return false; };
  const fsTip = () => until(() => { const t = document.getElementById('fs-tip'); if (t && !t.hidden) document.getElementById('fs-tip-x')?.click(); return true; }, 1000);
  const rows = [], perf = [];
  await enterGame(p, ok); await fsTip();
  // 줄기 퀘스트 (구역 z): 받고 → 셈을 채우고 → 끝냄. 막히면 (받을 수 없음·조건이 안 참) 그 퀘스트 id 를 적음
  const main = async (z) => {
    const qs = B.QUESTS.main.filter((q) => q.z === z), stuck = [];
    for (const q of qs) {
      const r = await ev(([q, z]) => { const o = window.__oreum, Q = o.quest; if (Q.state().done.includes(q.id)) return 'done';
        Q.close?.(); if (!Q.give(q.id) && Q.state().cur?.id !== q.id) return 'give:' + (Q.stuck?.(q.id) || Q.state().cur?.id || '?');
        const k = q.ask.k, n = q.ask.n;
        if (k === 'gearTB') o.save.equip.bag += 1;
        else if (k === 'gearAll') { for (const s of ['tool', 'bag', 'shoes']) o.save.equip[s] = Math.max(o.save.equip[s], n); }
        else if (/^boss@/.test(k)) { const bz = +k.split('@')[1]; o.save.boss.done[bz] = (o.save.boss.done[bz] || 0) + 1; }
        else if (k === 'zone') { o.save.journey.maxZ = Math.max(o.save.journey.maxZ || 1, n); }
        else { Q.count(k, n); if (k === 'recycle') o.save.recycle.visits += n; }
        return 'given'; }, [q, z]);
      if (r === 'done') continue;
      if (r !== 'given') { stuck.push(q.id + ' ' + r); continue; }
      if (!(await until((id) => window.__oreum.quest.api.ready(id), 4000, q.id))) { stuck.push(q.id + ' 조건'); continue; }
      const d = await ev((id) => { const Q = window.__oreum.quest; Q.done(id); Q.close?.(); return Q.state().done.includes(id); }, q.id);
      if (!d) stuck.push(q.id + ' 끝내기');
    }
    ok(!stuck.length, `구역 ${z} 줄기 ${qs.length}개 ${stuck.length ? '막힘 ' + stuck.join(', ') : '끝'}`);
    return stuck.length;
  };
  const cstate = () => ev(() => Object.fromEntries(window.__oreum.cases ? Object.keys(window.__oreum.save.cases || {}).map((id) => { const s = window.__oreum.cases.state(id); return [id, [s.open ? 1 : 0, s.ev, s.f ? 1 : 0, s.closed ? 1 : 0].join('')]; }) : []));
  for (const C of CASES) {
    const ts = Date.now();
    await main(C.zone);
    // 사건 (실제로: 목격 → 증거 셋 → 대면 → 종결 → 보드 → 다시 읽기). 둘째 사건은 증거 하나 뒤 새로 고침
    await runCase(p, C.id, mode, SHOTS, ok, { chain: true, midReload: C.n === 2, perf });
    const done = await ev((id) => window.__oreum.cases.state(id).closed, C.id);
    /* 놀이 시간 어림 (#243): 의뢰인 → 목격 → 의뢰인 → 증거 셋 → 의뢰인 → (터·우두머리) → 대면 → 의뢰인. 달리기 10m/s × 1.15, 증거 20초(위에서 찍기 +8),
       대면: 숨어 보기 60초 기다림 · 서바이벌 터 한 판 SWARM.run.t 끝 + 30초 · 우두머리 300초(빈터가 다시 80% 깨끗해질 때까지는 셈하지 않음) + 장면 len */
    const est = await ev(([C, arenaT]) => { const o = window.__oreum, w = o.quest.where(), g = w[C.giver] || w.jigi, sp = o.cases.spots(C.id), P = (a) => a && (Array.isArray(a) ? a : [a.x, a.z]);
      const ar = C.face.kind === 'arena' ? P(o.cases.arena(C.zone)) : null, bs = C.face.kind === 'boss' ? P(o.field?.api?.bosses?.find((b) => b.zone === C.zone)) : null;
      const pts = [[g.x, g.z], P(sp.see), [g.x, g.z], ...C.ev.filter((e) => sp.ev[e.id]).map((e) => P(sp.ev[e.id])), [g.x, g.z], ar || bs, P(sp.face) || ar || bs, [g.x, g.z]].filter(Boolean);
      let d = 0; for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const evT = C.ev.reduce((a, e) => a + (e.kind === 'act' ? 60 : 20 + (e.view ? 8 : 0)), 0), fight = C.face.kind === 'hide' ? 60 : C.face.kind === 'arena' ? arenaT + 30 : C.face.kind === 'boss' ? 300 : 0;
      const scene = (C.face.len || 0) + (C.face.follow ? C.face.follow.len + 60 : 0);
      return { m: d, walk: d * 1.15 / 10, task: evT + fight + scene }; }, [C, B.SWARM.run.t[B.SWARM.run.t.length - 1]]).catch(() => null);
    rows.push({ 사건: C.id, 구역: C.zone, 레벨: await ev(() => window.__oreum.level.state().lv), 종결: done ? 'ok' : '✗', '검사 분': +((Date.now() - ts) / 60e3).toFixed(1), '길(m)': est && Math.round(est.m), '놀이 어림(분)': est && +((est.walk + est.task) / 60).toFixed(1) });
    if (C.n === 3) { // 쓰러짐: 사건 셋을 닫은 뒤 HP 0 → 들것 → 일어남. 사건 진행·퀘스트는 그대로
      const before = JSON.stringify(await cstate()), q0 = await ev(() => JSON.stringify(window.__oreum.save.quest.done));
      const k = await ev(() => window.__oreum.hp.kill());
      ok(k && await until(() => window.__oreum.hp.isDown, 15000), '쓰러짐 (들것)');
      const t1 = Date.now(), up = await until(() => !window.__oreum.hp.isDown && !window.__oreum.hp.pending, 360000); /* 소프트웨어 GL 은 프레임이 느려 게임 시간이 늦게 감 */
      ok(up, `다시 일어남 (${Math.round((Date.now() - t1) / 1000)}초${up ? '' : ', ' + JSON.stringify(await ev(() => ({ ph: window.__oreum.hp.phase, wait: window.__oreum.hp.waitSec })))})`);
      ok(JSON.stringify(await cstate()) === before && await ev(() => JSON.stringify(window.__oreum.save.quest.done)) === q0, '쓰러진 뒤에도 사건·퀘스트 그대로');
    }
  }
  // 끝 연출 → 엔딩
  ok(await ev(() => window.__oreum.caseFin.state().all), `사건 ${CASES.length}개 모두 종결 ${JSON.stringify(await cstate())}`);
  await ev(() => { const o = window.__oreum; o.enemies.test.clear(); o.quest.close?.(); o.cases.fileClose?.(); document.getElementById('case-file-close')?.click(); });
  ok(await until(() => { const t = document.getElementById('fs-tip'); if (t && !t.hidden) document.getElementById('fs-tip-x')?.click(); return !!window.__oreum.caseFin.state().run || window.__oreum.caseFin.state().t > 0; }, 90000), '조용해지면 끝 연출 시작 (수사 보드·빨간 실)');
  if (!(await ev(() => window.__oreum.caseFin.state().t > 0 || !!window.__oreum.caseFin.state().run))) console.log('  까닭', JSON.stringify(await ev(() => ({ f: window.__oreum.caseFin.state(), panels: [...document.querySelectorAll('.overlay')].filter((e) => !e.hidden).map((e) => e.id), cam: window.__oreum.cam.mode, busy: window.__oreum.cases.busy() }))));
  ok(await until(() => !window.__oreum.caseFin.state().run, 15000), '끝 연출 끝');
  ok(await ev(() => !!window.__oreum.save.ach.badges['b-case-all']), "칭호 '수석 조사관'");
  ok(await ev(() => { const s = window.__oreum.story.state(); return s.wait.includes('end') || s.cur === 'end' || s.done.includes('end'); }), '엔딩이 줄에 섬');
  await ev(() => window.__oreum.director.open('aliens'));
  await p.click('#case-file-close').catch(() => {});
  ok(await until(() => { const o = window.__oreum, s = o.story.state(); if (s.cur && s.cur !== 'end') { window.__others = [...(window.__others || []), s.cur]; o.story.end(); } return s.cur === 'end' || s.done.includes('end'); }, 180000), /* 앞에 선 이야기(구역 줄기로 열린 것)는 끝낸 것으로 (소프트웨어 GL 은 느림) */ `창을 닫으면 엔딩 ${JSON.stringify(await ev(() => window.__oreum.story.state()))}`);
  console.log('  엔딩 앞에 끝낸 이야기', JSON.stringify(await ev(() => [...new Set(window.__others || [])])));
  ok(errs === 0, `페이지 오류 ${errs}`);
  console.table(rows);
  // 그리는 수 (#243): 사건마다 목격 전(그 자리에서 보통 화면)과 장면 가운데 가장 큰 draw call
  const pr = CASES.map((C) => { const L = perf.filter((x) => x.사건 === C.id), base = L.find((x) => x.자리 === 'before'), sc = L.filter((x) => !/before|note|doc|file|land/.test(x.자리)).sort((a, b) => b.calls - a.calls)[0];
    return { 사건: C.id, '보통 call': base?.calls, '장면 최대 call': sc?.calls, 자리: sc?.자리, '삼각형(k)': sc && Math.round(sc.tris / 1000), 'ms/프레임': sc?.ms }; });
  console.log(`그리는 수 [${mode}]`); console.table(pr); perfOut[mode] = pr;
  await b.close();
  table.push({ 갈래: 'chain (한 저장으로 엔딩까지)', 모드: mode, 통과: fails ? '✗' : 'ok', 시간: fmt((Date.now() - t0) / 1000), 실패: bad.slice(0, 3).join(' | ').slice(0, 300) });
  return fails;
}

if (require.main === module) (async () => {
  for (const mode of modes) {
    if (doChain) await chain(mode).catch((e) => { console.log('FAIL chain', e.message); table.push({ 갈래: 'chain', 모드: mode, 통과: '✗', 시간: '-', 실패: e.message.slice(0, 200) }); });
    if (doParts) {
      part('tools/tutrun.js', [mode], mode);
      part('tools/questrun.js', [mode], mode);
      const { CASES } = await import('../src/cases/index.js');
      for (const C of CASES) part('tools/caserun.js', [C.id, mode], mode);
      part('tools/casefin.js', [mode], mode);
    }
  }
  console.table(table);
  if (Object.keys(perfOut).length) require('fs').writeFileSync('dist/fullrun-perf.json', JSON.stringify(perfOut, null, 1));
  const n = table.filter((r) => r.통과 !== 'ok').length;
  console.log(n ? `실패 ${n}` : '모두 통과'); process.exit(n ? 1 : 0);
})();
