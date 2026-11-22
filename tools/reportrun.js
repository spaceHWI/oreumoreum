// 매일 미확인 제보 (#238): node tools/reportrun.js [d|m] [shots]   (먼저 node build.mjs)
// 확인: 날짜만으로 고른 제보 60일치(헛소문 비율·구역·사건 실마리는 그 사건이 열린 사람에게만) → 게임에서 레벨이 모자라면 없음
//       → 날짜 셋을 바꿔 가며: 제보가 서로 다름 · 오늘의 할 일 창에 한 줄 · 쪽지 창 · '가 보기' · 흔적·바닥 표시 · 그 자리에서 상호작용(F) → 한 줄·귤 · 다시는 안 받음
//       → 다시 읽어도 그대로 · 옛 저장(report 없음·이상한 값)으로도 오류 없음 · 사건 파일 창 '제보' 칸
// shots 를 주면 dist/report-<mode>-<n>.jpg 로 작게 찍음
const { chromium, devices } = require('playwright');
const mode = process.argv[2] === 'm' ? 'm' : 'd', SHOTS = !!process.argv[3];
let fails = 0; const ok = (c, msg) => { console.log(c ? 'ok  ' : 'FAIL', msg); if (!c) fails++; };
(async () => {
  const { REPORTS, REPORT_BY, reportOf } = await import('../src/cases/reports.js');
  const { REPORT } = await import('../src/balance.js');
  { // 날짜만으로 (게임 없이)
    const days = [...Array(60)].map((_, i) => new Date(Date.UTC(2026, 10, 1) + i * 864e5).toISOString().slice(0, 10));
    const all = days.map((d) => reportOf(d, (r) => !r.case)), hoax = all.filter((r) => r.hoax).length;
    ok(REPORTS.length >= 30 && new Set(REPORTS.map((r) => r.id)).size === REPORTS.length, `제보 글 ${REPORTS.length}개 (30 이상·id 겹침 없음)`);
    ok(hoax / days.length > REPORT.hoax - 0.15 && hoax / days.length < REPORT.hoax + 0.15, `60일 중 헛소문 ${hoax}일 (${Math.round(hoax / days.length * 100)}%, 목표 ${REPORT.hoax * 100}%)`);
    ok(new Set(all.map((r) => r.id)).size >= 15, `60일 동안 ${new Set(all.map((r) => r.id)).size}가지`);
    ok(days.every((d) => reportOf(d, (r) => !r.case)?.id === reportOf(d, (r) => !r.case)?.id), '같은 날은 늘 같은 제보');
    const z1 = days.map((d) => reportOf(d, (r) => r.z <= 1 && !r.case)); ok(z1.every((r) => r && r.z === 1), '구역 1 만 가 본 사람에겐 구역 1 제보만');
    const c1 = days.map((d) => reportOf(d, (r) => r.z <= 1 && (!r.case || r.case === 'c1'))); ok(c1.some((r) => r.case === 'c1') && all.every((r) => !r.case), `사건 실마리는 그 사건이 열린 사람에게만 (c1 열림: ${c1.filter((r) => r.case).length}일)`);
    ok(REPORTS.every((r) => r.hoax || r.prop), '진짜 제보는 흔적 모양이 있음');
  }
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext(mode === 'm' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage(); let errs = 0;
  p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
  const W = (ms) => p.waitForTimeout(ms);
  let shotN = 0; const shot = async (n) => { if (SHOTS) await p.screenshot({ path: `dist/report-${mode}-${shotN++}-${n}.jpg`, type: 'jpeg', quality: 55, scale: 'css', timeout: 150000 }); };
  const ev = (fn, arg) => p.evaluate(fn, arg);
  const until = async (fn, ms = 8000, arg) => { const t1 = Date.now(); while (Date.now() - t1 < ms) { if (await ev(fn, arg).catch(() => false)) return true; await W(250); } return false; };
  const go = (x, z) => ev(([x, z]) => { const o = window.__oreum; o.player.pos.set(x, o.groundAt(x, z), z); o.player.visY = o.player.pos.y; o.player.target = null; o.snap(); }, [x, z]);
  const RS = () => ev(() => window.__oreum.reports.state());
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await W(6000);
  await p.click('#enter').catch(() => {}); await W(4000);
  await ev(() => window.__oreum.setTod(14));
  if (await ev(() => !document.getElementById('look').hidden)) { await p.click('#look-ok').catch(() => {}); await W(1500); }
  await ev(() => { const o = window.__oreum; o.swarm?.disable?.(true); o.tut.skipAll(); o.quest.next?.off(true); });
  await until(() => { const t = document.getElementById('fs-tip'); if (t && !t.hidden) document.getElementById('fs-tip-x')?.click(); return true; }, 1000);
  ok(await ev(() => !!window.__oreum.reports?.on), '__oreum.reports 있음 (남송이)');
  let s = await RS(); ok(!s.on, `레벨 ${REPORT.lv} 전엔 제보 없음`);
  ok(await ev(() => { window.__oreum.openAch?.() ?? document.getElementById('btn-ach').click(); const r = !document.querySelector('#ach-list .ach-item.report'); document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; }); return r; }), '레벨 전엔 오늘의 할 일에 제보 줄 없음');
  await ev((L) => { const o = window.__oreum; for (let x = 0; o.level.state().lv < L; x += 50) o.level.setXp(x); o.save.journey = { ...(o.save.journey || {}), maxZ: 2 }; }, REPORT.lv);
  const dates = ['2026-12-03', '2026-12-04', '2026-12-05'], seen = [];
  // 서로 다른 셋이 되게 (같은 날 같은 제보가 나오면 다음 날로)
  for (let d = 0, k = 0; seen.length < 3 && k < 40; k++) {
    const date = new Date(Date.UTC(2026, 11, 3) + k * 864e5).toISOString().slice(0, 10);
    const id = await ev((dt) => window.__oreum.reports.pick(dt), date); if (!id || seen.some((x) => x.id === id)) continue;
    seen.push({ date, id }); d++;
  }
  ok(seen.length === 3 && new Set(seen.map((x) => x.id)).size === 3, `날짜 셋에 제보 셋이 다름 (${seen.map((x) => x.date + ':' + x.id).join(' ')})`);
  if (!seen.some((x) => REPORT_BY[x.id].hoax)) { for (let k = 40; k < 200; k++) { const date = new Date(Date.UTC(2026, 11, 3) + k * 864e5).toISOString().slice(0, 10); const id = await ev((dt) => window.__oreum.reports.pick(dt), date); if (id && REPORT_BY[id].hoax && !seen.some((x) => x.id === id)) { seen[2] = { date, id }; break; } } }
  void dates;
  for (const [i, one] of seen.entries()) {
    const R = REPORT_BY[one.id];
    await ev((d) => window.__oreum.reports.date(d), one.date);
    s = await RS(); ok(s.on && s.id === one.id && s.d === one.date && !s.got, `${one.date}: 오늘의 제보 ${one.id} '${R.t}'${R.hoax ? ' (헛소문)' : ''} · 구역 ${R.z}`);
    // 오늘의 할 일 줄
    const row = await ev(() => { document.getElementById('btn-ach').click(); const r = document.querySelector('#ach-list .ach-item.report'); return r ? { t: r.querySelector('b').textContent, btn: r.querySelector('button')?.textContent || '' } : null; });
    ok(!!row && row.t.includes(R.t) && /가 보기/.test(row.btn), `오늘의 할 일에 한 줄 (${row?.t} · ${row?.btn})`);
    if (i === 0) await shot('ach');
    await ev(() => document.querySelector('#ach-list .ach-item.report b').click());
    ok(await ev((t) => !document.getElementById('report-note').hidden && document.querySelector('#report-note h2').textContent === t && document.getElementById('ach').hidden, R.t), '줄을 누르면 쪽지 창');
    if (i === 0) await shot('note');
    // '가 보기' 는 걸어감 (자리를 받아 둠) — 확인은 바로 옮겨서
    const sp = await ev(() => window.__oreum.reports.where());
    const blk = await ev(([x, z, zz]) => { const o = window.__oreum; return { blocked: !!o.col?.blocked(x, z, 0.3), zone: o.trash.api.zoneAt(x, z) || 0, want: zz }; }, [sp[0], sp[1], R.z]);
    ok(!blk.blocked && (blk.zone === R.z || R.case), `자리 [${sp}] 막힘 ${blk.blocked} · 구역 ${blk.zone}/${R.z}`);
    await ev(() => document.getElementById('report-go').click()); await W(600);
    ok(await ev(() => document.getElementById('report-note').hidden && !!window.__oreum.player.target), "'가 보기' 를 누르면 창이 닫히고 걸어감");
    await go(sp[0] + 20, sp[1]); await until((h) => { const s = window.__oreum.reports.state(); return s.ring && s.prop === !h; }, 6000, !!R.hoax);
    s = await RS(); ok(s.ring && s.prop === !R.hoax && !s.near, `20m 앞: 바닥 표시 ${s.ring} · 흔적 ${s.prop}${R.hoax ? ' (헛소문은 흔적 없음)' : ''} · 아직 멀어 곁이 아님`);
    await go(sp[0] + 0.8, sp[1]); await W(1200);
    const c0 = await ev(() => window.__oreum.save.coins);
    const ctx = await ev(() => document.querySelector('#btn-ctx')?.textContent || document.getElementById('btn-ctx')?.getAttribute('aria-label') || '');
    s = await RS(); ok(s.near && s.act, `곁에 오면 상호작용 (${ctx.trim()})`);
    if (i === 0) await shot('spot');
    await ev(() => { window.__toasts = []; const t = document.getElementById('toast'); window.__tob?.disconnect(); window.__tob = new MutationObserver(() => window.__toasts.push(t.textContent)); window.__tob.observe(t, { childList: true, characterData: true, subtree: true }); });
    await p.keyboard.press('f'); await W(900);
    s = await RS(); const c1 = await ev(() => window.__oreum.save.coins), toastT = await ev(() => window.__toasts.join(' / '));
    ok(s.got && c1 - c0 === REPORT.gyul && toastT.includes(R.find), `F → 한 줄·귤 +${c1 - c0} ('${toastT}')`);
    ok(!s.ring && !s.prop, '끝내면 흔적·표시가 사라짐');
    await p.keyboard.press('f'); await W(500);
    ok((await ev(() => window.__oreum.save.coins)) - c1 <= 0 && (await ev(() => window.__oreum.reports.finish())) === false, '같은 날 두 번은 안 받음');
    const row2 = await ev(() => { document.getElementById('btn-ach').click(); const r = document.querySelector('#ach-list .ach-item.report'); const v = r && { done: r.classList.contains('done'), t: r.textContent }; document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; }); return v; });
    ok(row2?.done && /받음/.test(row2.t), `오늘의 할 일 줄이 '받음' (${row2?.t})`);
  }
  // 다시 읽어도 그대로 (저장)
  const last = seen[seen.length - 1];
  await p.goto('file://' + process.cwd() + '/dist/test.html?rdate=' + last.date + '#namsongi'); await W(6000); await p.click('#enter').catch(() => {}); await W(3000);
  s = await RS(); ok(s.id === last.id && s.got, `다시 읽어도 끝낸 제보 그대로 (${s.id} got ${s.got})`);
  // 사건 파일 '제보' 칸
  await ev(() => { const o = window.__oreum; o.cases?.open?.('c1'); o.cases?.file?.(); });
  ok(await ev((t) => { const b = document.getElementById('cf-report'); return !!b && b.textContent.includes(t); }, REPORT_BY[last.id].t), "사건 파일 창에 '제보' 칸");
  await ev(() => document.getElementById('cf-report')?.click());
  ok(await ev(() => !document.getElementById('report-note').hidden && !document.querySelector('#report-note .rn-got').hidden), '제보 칸을 누르면 쪽지 (끝낸 것은 본 한 줄도)');
  await shot('casefile');
  await ev(() => document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; }));
  // 사건이 열리면 실마리 제보가 나올 수 있음
  const cDay = await ev(() => { const o = window.__oreum.reports; for (let k = 0; k < 200; k++) { const d = new Date(Date.UTC(2027, 0, 1) + k * 864e5).toISOString().slice(0, 10); const id = o.pick(d); if (id === 'u29') return d; } return null; });
  ok(!!cDay, `사건 1 이 열린 뒤엔 사건 실마리 제보(u29)가 나오는 날이 있음 (${cDay})`);
  // 옛 저장: report 없음·이상한 값
  await ev(() => { const o = window.__oreum; o.save.report = { d: 7, id: 'nope', got: 'x' }; o.reports.date('2027-03-01'); });
  s = await RS(); ok(s.on && s.d === '2027-03-01' && !s.got && !!REPORT_BY_ID(s.id), `이상한 저장값도 오늘 제보로 바로잡힘 (${s.id})`);
  await ev(() => { delete window.__oreum.save.report; });
  s = await RS(); ok(s.on && !s.got, 'report 가 없는 예전 저장도 그대로');
  ok(errs === 0, `페이지 오류 ${errs}`);
  await b.close();
  console.log(fails ? `FAIL ${fails}` : 'ALL OK');
  process.exit(fails ? 1 : 0);
  function REPORT_BY_ID(id) { return REPORT_BY[id]; }
})().catch((e) => { console.error(e); process.exit(1); });
