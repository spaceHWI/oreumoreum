// 사건 파일 (#232): 새 저장으로 사건 하나를 처음부터 끝까지 따라가 본다. node tools/caserun.js [c1] [d|m] [shots]   (먼저 node build.mjs)
// d = 데스크톱, m = 폰 세로(창 모양은 가로도 봄). shots 를 주면 dist/case-<mode>-<n>.jpg 로 작게 찍음
// 확인: 레벨이 모자라면 목격 자리에 가도 열리지 않음 → 레벨 lv 에 목격 자리에 들면 열림(혼잣말·메뉴 [사건 파일]) → 의뢰 NPC 에게 증거 퀘스트
//       증거마다 그 자리에서 상호작용(F) → 쪽지 창에 그 쪽지 → 다 모으면 돌려주기·보상 → 대면 퀘스트 → (hide) 수풀에서 F → 장면 → 서류 쪽지
//       → 돌려주기·보상(귤·옷) → 종결 도장·칭호 열림 → 사건 파일 창(서류 칸·증거 칸·도장, 칸을 누르면 쪽지) → 다시 읽어도 그대로 · 증거·숨는 곳이 막힌 곳이 아님
const { chromium, devices } = require('playwright');
const CID = process.argv[2] && /^c\d$/.test(process.argv[2]) ? process.argv[2] : 'c1';
const rest = process.argv.slice(2).filter((a) => a !== CID), mode = rest[0] || 'd', SHOTS = !!rest[1];
let fails = 0; const ok = (c, msg) => { console.log(c ? 'ok  ' : 'FAIL', msg); if (!c) fails++; };
(async () => {
  const { CASE_BY, caseLastQuest } = await import('../src/cases/index.js');
  const C = CASE_BY[CID]; if (!C) { console.log('없는 사건', CID); process.exit(1); }
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext(mode === 'm' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage(); let errs = 0;
  p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
  const W = (ms) => p.waitForTimeout(ms);
  let shotN = 0; const shot = async (n) => { if (SHOTS) await p.screenshot({ path: `dist/case-${mode}-${shotN++}-${n}.jpg`, type: 'jpeg', quality: 55, scale: 'css', timeout: 150000 }); };
  const ev = (fn, arg) => p.evaluate(fn, arg);
  const until = async (fn, ms = 8000, arg) => { const t1 = Date.now(); while (Date.now() - t1 < ms) { if (await ev(fn, arg)) return true; await W(250); } return false; };
  const go = (x, z) => ev(([x, z]) => { const o = window.__oreum; o.player.pos.set(x, o.groundAt(x, z), z); o.player.visY = o.player.pos.y; o.player.target = null; o.snap(); }, [x, z]);
  const CS = () => ev((id) => window.__oreum.cases.state(id), CID);
  const closeNote = () => ev(() => window.__oreum.punkWorld.note.close());
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await W(6000);
  await p.click('#enter').catch(() => {}); await W(4000);
  await ev(() => window.__oreum.setTod(14));
  if (await ev(() => !document.getElementById('look').hidden)) { await p.click('#look-ok').catch(() => {}); await W(1500); }
  await ev(() => { const o = window.__oreum; o.swarm?.disable?.(true); /* 들판 떼 한 판(#202)은 따로 (tools/swarmrun.js). 싸우는 중엔 숨을 수 없음 */ o.tut.skipAll(); o.quest.next?.off(true); o.save.mutter = { ...(o.save.mutter || {}) }; });
  ok(await until(() => window.__oreum.director.state().open.includes('quest'), 20000), '감독 문 quest 열림');
  await until(() => { const t = document.getElementById('fs-tip'); if (t && !t.hidden) document.getElementById('fs-tip-x')?.click(); return true; }, 1000);
  const sp = await ev((id) => window.__oreum.cases.spots(id), CID);
  ok(!!sp?.see, `자리 ${JSON.stringify(sp)}`);
  // 자리가 막힌 곳이 아닌가 (충돌)·구역 안인가
  const blk = await ev(([sp, z]) => { const o = window.__oreum, c = o.col, t = o.trash.api; const all = [['see', sp.see], ['face', sp.face], ...Object.entries(sp.ev)].filter(([, v]) => v);
    return all.map(([k, [x, zz]]) => ({ k, blocked: !!c?.blocked(x, zz, 0.3), zone: t.zoneAt(x, zz) || 0, want: z[k] || z.all })); }, [sp, { all: C.zone, ...Object.fromEntries(C.ev.filter((e) => e.z).map((e) => [e.id, e.z])) }]); /* 증거 z: 일부러 다른 구역에 둔 것 (c4 초소 일지) */
  for (const r of blk) ok(!r.blocked && r.zone === r.want, `${r.k} 자리: 막힘 ${r.blocked} · 구역 ${r.zone}`);
  // ----- 레벨이 모자라면 열리지 않음 -----
  let s = await CS(); ok(!s.open && s.lv < C.lv, `처음엔 사건이 닫혀 있음 (레벨 ${s.lv} < ${C.lv})`);
  await go(sp.see[0] + 2, sp.see[1] + 2); await W(1500);
  s = await CS(); ok(!s.open, '레벨이 모자라면 목격 자리에 가도 안 열림');
  ok(await ev((id) => !window.__oreum.cases.objs().find((o) => o.kind === 'see' && o.id === id).vis, CID), '레벨이 모자라면 목격 모양도 안 보임');
  // ----- 레벨 lv → 목격 -----
  await go(sp.see[0] + 40, sp.see[1] + 40); await W(300);
  await ev((L) => { const o = window.__oreum; for (let x = 0; o.level.state().lv < L; x += 50) o.level.setXp(x); }, C.lv);
  s = await CS(); ok(s.lv >= C.lv, `레벨 ${s.lv}`);
  await until(() => { const L = window.__oreum.level.state(); if (L.open) window.__oreum.level.close(); return !L.open && !document.querySelector('.overlay:not([hidden])'); }, 4000); /* 레벨업 증강 고르기 창은 닫음 (창이 열린 동안은 목격하지 않음) */
  await go(sp.see[0] + 3, sp.see[1] + 3); await W(400);
  ok(await until((id) => window.__oreum.cases.state(id).open, 10000, CID), '목격 자리에 들면 사건이 열림');
  if (!(await CS()).open) console.log('  까닭', JSON.stringify(await ev(() => ({ panels: [...document.querySelectorAll('.overlay')].filter((e) => !e.hidden).map((e) => e.id), cave: window.__oreum.cave?.state?.()?.in, sess: true, tut: window.__oreum.tut?.active, pos: [window.__oreum.player.pos.x, window.__oreum.player.pos.z], lv: window.__oreum.level.state().lv }))));
  ok(await until((t) => window.__oreum.mutter?.bubble?.()?.text === t || document.getElementById('toast')?.textContent.includes(t), 3000, C.see.say), `혼잣말 '${C.see.say}'`);
  ok(await ev(() => !document.getElementById('menu-case').hidden), '메뉴에 [사건 파일]');
  if (C.see.ghost) { const g = await ev(() => window.__oreum.cases.chase()); ok(g && g.glim && g.night, `목격 때 흰 옷이 스침·밤빛 ${JSON.stringify(g)}`); }
  await shot('see');
  // ----- 의뢰 -----
  const [q1, q2] = C.quests;
  ok(await ev(([g, id]) => window.__oreum.quest.api.at(g).some((x) => x.q.id === id && x.st === 'offer'), [C.giver, q1.id]), `${C.giver} 가 '${q1.name}' 을 줌`);
  ok(await ev((id) => window.__oreum.quest.give(id), q1.id), `${q1.id} 받음`);
  const tg = await ev((id) => window.__oreum.quest.goPos('case:' + id), CID);
  ok(!!tg, `증거로 가는 화살표 자리 ${tg && [tg.x.toFixed(0), tg.z.toFixed(0)]}`);
  // ----- 증거 셋 (그 자리에서 F) -----
  for (const e of C.ev) {
    if (e.kind === 'act') { await ev(([k, n]) => window.__oreum.quest.count(k, n), [e.k, e.n || 1]); continue; }
    const at = sp.ev[e.id]; await go(at[0] + 0.9, at[1] + 0.6); await W(700);
    ok(await until((id) => window.__oreum.cases.objs().find((o) => o.ev === id)?.vis, 6000, e.id), `${e.id} 모양 보임`);
    await p.keyboard.press('f'); await W(700);
    const shown = await ev(() => window.__oreum.punkWorld.note.shown());
    ok(await ev((id) => window.__oreum.punkWorld.note.got().includes(id), e.note), `${e.id} (${e.kind}) 찾음 · 쪽지 창 '${shown}'`);
    if (e === C.ev[0]) await shot('note');
    await closeNote(); await W(300);
  }
  s = await CS(); ok(s.ev === C.ev.length && s.all, `증거 ${s.ev}/${C.ev.length}`);
  ok(await until((id) => window.__oreum.quest.api.ready(id), 3000, q1.id), `${q1.id} 조건 채움`);
  let coins = await ev(() => window.__oreum.save.coins);
  await ev((g) => window.__oreum.quest.open(g), C.giver); await W(400);
  let w = await ev(() => window.__oreum.quest.win()); ok(w?.id === q1.id && w.st === 'ready', `${q1.id} 돌려주기 창`);
  await ev(() => window.__oreum.quest.press()); await W(500);
  ok(await ev(() => window.__oreum.save.coins) - coins === (q1.reward.gyul || 0), `${q1.id} 보상 귤 ${q1.reward.gyul}`);
  w = await ev(() => window.__oreum.quest.win());
  if (w?.id === q2.id && w.st === 'offer') { ok(true, `같은 창에서 다음 '${q2.name}'`); await ev(() => window.__oreum.quest.press()); await W(300); }
  else { /* 줄기 받기가 먼저 뜨면(엔진 차례) 그 뒤에 곁가지 */ ok(await ev(([g, id]) => window.__oreum.quest.api.at(g).some((x) => x.q.id === id && x.st === 'offer'), [C.giver, q2.id]), `${C.giver} 가 다음 '${q2.name}' 을 줌 (창 맨 앞은 ${w?.id})`); ok(await ev((id) => window.__oreum.quest.give(id), q2.id), `${q2.id} 받음`); }
  await ev(() => window.__oreum.quest.close());
  // ----- 대면 -----
  if (C.face.kind === 'hide') {
    await ev(() => window.__oreum.swarm?.disable?.(false)); await ev(() => window.__oreum.swarm?.start?.(1)); await W(400);
    if (await ev(() => !!window.__oreum.swarm?.state?.())) { await ev((t) => window.__oreum.cases.hide(t), CID); ok(!(await CS()).run, '들판 떼 한 판 동안엔 숨어 보기가 안 열림'); }
    await ev(() => window.__oreum.swarm?.disable?.(true)); await W(300);
    await ev(() => window.__oreum.enemies.test.clear()); /* 남은 떼는 치움 */
    ok(await until(() => !window.__oreum.cases.busy(), 15000), '싸움이 가라앉음 (떼를 멈춘 뒤)');
    await go(sp.face[0] + 0.8, sp.face[1] + 0.8); await W(700);
    await p.keyboard.press('f'); await W(800);
    s = await CS(); ok(!!s.run, '수풀에서 F → 숨어 보기 장면');
    if (!s.run) console.log('  까닭', JSON.stringify(await ev(() => { const o = window.__oreum; return { toast: document.getElementById('toast').textContent, ctx: o.aim.ctx(), cine: !!o.cam && o.cam.mode, swarm: !!o.swarm.state(), tension: o.pace?.threat?.() }; })));
    ok(await ev(() => window.__oreum.cam.mode === 'cine' && document.body.classList.contains('case-cine')), '장면 동안 카메라·화면');
    await ev((t) => window.__oreum.cases.jump(t), C.face.len * 0.5); await W(600); await shot('hide');
    ok(await ev(() => window.__oreum.scene.children.filter((o) => o.visible && o.children?.length === 3 && o.children.some((c) => c.material?.side === 2)).length >= 1), '까마귀가 날아옴');
    await ev((t) => window.__oreum.cases.jump(t), C.face.len - 0.1); await W(1200);
    s = await CS(); ok(!s.run && s.f === 1 && s.face, '장면 끝 · 대면 끝냄');
    ok(await ev(() => window.__oreum.cam.mode === 'follow'), '카메라 돌아옴');
  } else if (C.face.follow) { // 흰 옷 따라가기 (#233): 터를 버팀(arena)·우두머리(boss) → 흰 옷이 path 를 앞서 감 → 끝자리에서 장면
    ok(!(await ev(() => window.__oreum.cases.chase()))?.chase, '터를 버티기 전엔 흰 옷이 안 나옴');
    if (C.face.kind === 'arena') await ev((z) => { const o = window.__oreum; o.save.swarm.won[z] = { at: Date.now() + 5, b: 0 }; }, C.zone);
    else await ev((z) => { const o = window.__oreum; o.save.boss.done[z] = (o.save.boss.done[z] || 0) + 1; }, C.zone);
    await ev(() => window.__oreum.enemies.test.clear());
    ok(await until((id) => window.__oreum.cases.state(id).a === 1 && window.__oreum.cases.chase()?.chase?.id === id, 6000, CID), '터를 버틴 뒤 흰 옷이 나옴 (a 1)');
    const tgF = await ev((id) => window.__oreum.quest.goPos('case:' + id + ':face'), CID); let ch = await ev(() => window.__oreum.cases.chase());
    ok(!!tgF && Math.hypot(tgF.x - ch.at[0], tgF.z - ch.at[1]) < 1, `화살표가 흰 옷을 가리킴 ${ch.at}`);
    let guard = 0, moved = false, p0 = null;
    while (guard++ < 80) { /* 흰 옷 곁(near 안)으로 가면 다음 자리로 앞서 감. 첫 걸음이 움직이는 것만 보고 나머지는 바로 다음 자리로 (느린 화면) */
      ch = await ev(() => window.__oreum.cases.chase()); if (!ch?.chase || ch.chase.mode === 'pick' || ch.cine) break;
      if (ch.chase.mode === 'go') { if (!p0) p0 = ch.at; else if (Math.hypot(ch.at[0] - p0[0], ch.at[1] - p0[1]) > 1) moved = true; if (moved) await ev(() => window.__oreum.cases.chaseNext()); }
      await go(ch.at[0] + 3, ch.at[1] + 3); await W(400);
    }
    ok(moved, '곁에 가면 흰 옷이 다음 자리로 앞서 감');
    ok(ch?.chase?.mode === 'pick' && ch.ghost && ch.night, `끝자리까지 따라감 · 흰 옷 보임 · 밤빛 ${JSON.stringify(ch)}`);
    await shot('ghost');
    await ev(() => window.__oreum.enemies.test.clear());
    await go(ch.at[0] + 1.8, ch.at[1] + 1.8); await W(900);
    ch = await ev(() => window.__oreum.cases.chase()); ok(!!ch?.cine, '가까이 가면 장면 (돌아봄)');
    ok(await ev(() => window.__oreum.cam.mode === 'cine' && document.body.classList.contains('case-chase')), '장면 동안 카메라·화면');
    await ev(() => window.__oreum.cases.chaseJump(5)); await W(700); await shot('turn');
    await ev((t) => window.__oreum.cases.chaseJump(t), C.face.follow.len - 0.1); await W(1200);
    s = await CS(); ok(s.f === 1 && s.face && !(await ev(() => window.__oreum.cases.chase()))?.cine, '장면 끝 · 대면 끝냄');
    ok(await ev(() => window.__oreum.cam.mode === 'follow'), '카메라 돌아옴');
  } else {
    if (C.face.kind === 'arena') { /* 서바이벌 터 한 판을 버틴 것으로 (판 자체는 tools/swarmrun.js) */
      const ar = await ev((z) => window.__oreum.cases.arena(z), C.zone);
      const tg0 = await ev((id) => window.__oreum.quest.goPos('case:' + id + ':face'), CID);
      if (C.face.scene && ar) ok(Math.hypot(tg0.x - ar[0], tg0.z - ar[1]) < 2, `대면 화살표는 먼저 서바이벌 터로 (${tg0.x.toFixed(0)}, ${tg0.z.toFixed(0)})`);
      await ev((z) => { const o = window.__oreum; o.save.swarm ||= {}; o.save.swarm.won ||= {}; o.save.swarm.won[z] = { at: Date.now() + 1000, b: 0 }; }, C.zone);
    } else await ev((z) => { const o = window.__oreum; o.save.boss.done[z] = (o.save.boss.done[z] || 0) + 1; }, C.zone);
    if (C.face.scene) { /* 싸움 뒤 장면 (#235): face.at 에서 F → 장면 → 끝 */
      ok(await until((id) => window.__oreum.cases.state(id).r === 1, 4000, CID), '싸움을 끝내면 장면 자리가 열림');
      s = await CS(); ok(!s.f && !s.face, '장면을 보기 전엔 대면이 끝나지 않음');
      const tg1 = await ev((id) => window.__oreum.quest.goPos('case:' + id + ':face'), CID);
      ok(Math.hypot(tg1.x - sp.face[0], tg1.z - sp.face[1]) < 2, '이제 화살표는 장면 자리로');
      await go(sp.face[0] + 0.8, sp.face[1] + 0.8); await W(800);
      ok(await until(() => { window.__oreum.enemies.test.clear(); return !window.__oreum.cases.busy(); }, 15000), '싸움이 가라앉음 (둘레의 적을 치운 뒤)');
      await p.keyboard.press('f'); await W(800);
      s = await CS(); ok(!!s.run, `${C.face.label} 자리에서 F → 장면`);
      if (!s.run) console.log('  까닭', JSON.stringify(await ev(() => { const o = window.__oreum; return { toast: document.getElementById('toast').textContent, ctx: o.aim.ctx(), busy: o.cases.busy() }; })));
      ok(await ev(() => window.__oreum.cam.mode === 'cine' && document.body.classList.contains('case-cine')), '장면 동안 카메라·화면');
      await ev((t) => window.__oreum.cases.jump(t), C.face.len * 0.45); await W(700); await shot('scene-up');
      ok(await ev(() => window.__oreum.cases.scene()?.shown), '장면 모양이 보임');
      await ev((t) => window.__oreum.cases.jump(t), C.face.len * 0.85); await W(700); await shot('scene-pour');
      await ev((t) => window.__oreum.cases.jump(t), C.face.len - 0.1); await W(1200);
      s = await CS(); ok(!s.run && s.f === 1 && s.face, '장면 끝 · 대면 끝냄');
      ok(await ev(() => window.__oreum.cam.mode === 'follow'), '카메라 돌아옴');
      if (C.see.gone) { const g = await until((id) => !window.__oreum.cases.objs().find((o) => o.id === id && o.kind === 'see').vis, 6000, CID); ok(g, '대면 뒤 목격 모양은 치움'); if (!g) console.log('  까닭', JSON.stringify(await ev((id) => ({ o: window.__oreum.cases.objs().filter((o) => o.id === id), s: window.__oreum.cases.state(id) }), CID))); }
    }
  }
  ok(await until((d) => window.__oreum.punkWorld.note.got().includes(d), 3000, C.doc), `서류 '${C.doc}' 받음 · 쪽지 창 '${await ev(() => window.__oreum.punkWorld.note.shown())}'`);
  await shot('doc'); await closeNote();
  ok(await until((id) => window.__oreum.quest.api.ready(id), 3000, q2.id), `${q2.id} 조건 채움`);
  await ev(() => window.__oreum.enemies.test.clear()); /* 둘레 적에게 맞아 귤이 줄면 셈이 어긋남 */
  coins = await ev(() => window.__oreum.save.coins);
  await ev((g) => window.__oreum.quest.open(g), C.giver); await W(400);
  w = await ev(() => window.__oreum.quest.win()); ok(w?.id === q2.id && w.st === 'ready', `${q2.id} 돌려주기 창`);
  await ev(() => window.__oreum.quest.press()); await W(800); await ev(() => window.__oreum.quest.close());
  { const dq = await ev(() => window.__oreum.save.coins) - coins; ok(dq === (q2.reward.gyul || 0), `${q2.id} 보상 귤 ${q2.reward.gyul} (받은 귤 ${dq})`); }
  if (C.cloth) ok(await ev((id) => !!window.__oreum.save.clothes?.own?.[id], C.cloth.id), `옷 '${C.cloth.name}' 받음`);
  s = await CS(); ok(s.closed, '사건 종결');
  for (const [gid, L] of Object.entries(C.hello || {})) ok(await ev(([g, L]) => { const h = window.__oreum.cases.hello(g); return L.every((t) => h.includes(t)); }, [gid, L]), `종결 뒤 ${gid} 인사에 사건 말 ${L.length}줄`);
  if (C.title) ok(await ev((t) => { const w = window.__oreum.punkWorld.title; return w.list.some((x, i) => x.t === t && w.unlocked()[i]); }, C.title), `칭호 '${C.title}' 열림`);
  ok(await ev(([g, id]) => !window.__oreum.quest.api.at(g).some((x) => x.q.id === id), [C.giver, caseLastQuest(C)]), '다시 받을 수 없음');
  // ----- 사건 파일 창 -----
  await ev(() => document.getElementById('menu-case').click()); await W(500);
  ok(await ev(() => window.__oreum.cases.fileOpen()), '메뉴 → 사건 파일 창');
  const html = await ev(() => window.__oreum.cases.html());
  ok(/종결/.test(html) && html.includes(C.name), '사건 칸에 제목·종결 도장');
  const cells = await ev(() => ({ docs: document.querySelectorAll('#case-file .cf-docs .cf-slot').length, row: document.querySelectorAll('#case-file .cf-case:not(.lock) .cf-row .cf-slot').length, got: document.querySelectorAll('#case-file .cf-case:not(.lock) .cf-slot.got').length }));
  ok(cells.docs === 5 && cells.row === C.ev.length + 2 && cells.got === C.ev.length + 2, `서류 칸 ${cells.docs} · 사건 칸 ${cells.row} (다 채움 ${cells.got})`);
  const fit = await ev(() => { const r = document.querySelector('#case-file .pop').getBoundingClientRect(); return { l: r.left >= -1, r: r.right <= innerWidth + 1, t: r.top >= -1, b: r.bottom <= innerHeight + 1, w: Math.round(r.width) }; });
  ok(fit.l && fit.r && fit.t && fit.b, `창이 화면 안 (${fit.w}px)`);
  await shot('file');
  await p.click(`#case-file [data-note="${C.doc}"]`); await W(500);
  ok(await ev(() => !!window.__oreum.punkWorld.note.shown()), '서류 칸을 누르면 쪽지 창');
  ok(await ev(() => { const b = document.querySelector('#punk-note .pn-case'); return !!b && !b.hidden; }), '쪽지 창에 [사건 파일] 단추');
  await p.click('#punk-note .pn-case'); await W(400);
  ok(await ev(() => window.__oreum.cases.fileOpen() && !window.__oreum.punkWorld.note.shown()), '쪽지 창 → 사건 파일 창');
  if (mode === 'm') { // 폰 가로
    await p.setViewportSize({ width: 844, height: 390 }); await W(600);
    const f2 = await ev(() => { const r = document.querySelector('#case-file .pop').getBoundingClientRect(), b = document.getElementById('case-file-body'); return { in: r.top >= -1 && r.bottom <= innerHeight + 1, scroll: b.scrollHeight >= b.clientHeight }; });
    ok(f2.in, '폰 가로: 창이 화면 안 (안은 밀어서 봄)'); await shot('land');
    await p.setViewportSize({ width: 390, height: 844 }); await W(300);
  }
  await ev(() => document.getElementById('case-file-close').click());
  // ----- 다시 읽기 -----
  await p.reload(); await W(6000); await p.click('#enter').catch(() => {}); await W(4000);
  s = await CS(); ok(s.open && s.closed && s.f === 1 && s.ev === C.ev.length, `다시 읽어도 그대로 ${JSON.stringify({ open: s.open, closed: s.closed, ev: s.ev })}`);
  ok(await ev(() => !document.getElementById('menu-case').hidden), '다시 읽어도 메뉴 [사건 파일]');
  ok(errs === 0, `페이지 오류 ${errs}`);
  await b.close();
  console.log(fails ? `실패 ${fails}` : '통과'); process.exitCode = fails ? 1 : 0;
})();
