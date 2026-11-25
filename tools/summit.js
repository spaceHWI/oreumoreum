// 정상 첫 실마리 (#208): 새 사용자·옛 저장으로 표지석 장면·쪽지·퀘스트·망원경을 따라가 본다. node tools/summit.js [d|m] [shots]  (먼저 node build.mjs)
// 확인: 표지석에 닿으면 장면(카메라 굼부리 쪽·빛 깜빡임·건너뛰기) → 끝나면 쪽지가 표지석 뒤에 → 읽으면 퀘스트 x-rim → 전망 자리에 닿으면 끝·귤 → 감독 한 줄
//       싸우는 중엔 미룸 · 망원경(밤·구역 3 이상이면 먼 불빛) · 옛 저장은 장면 없이 쪽지만, 읽으면 퀘스트는 지난 것으로 · 다시 읽어도 그대로
const { chromium, devices } = require('playwright');
const mode = process.argv[2] || 'd', SHOTS = !!process.argv[3];
let fails = 0; const ok = (c, msg) => { console.log(c ? 'ok  ' : 'FAIL', msg); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const run = async (old) => {
    const ctx = await b.newContext(mode === 'm' ? { ...devices['iPhone 13'] } : { viewport: { width: 960, height: 540 } });
    const p = await ctx.newPage(); let errs = 0;
    p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
    const W = (ms) => p.waitForTimeout(ms), ev = (fn, arg) => p.evaluate(fn, arg);
    const until = async (fn, ms = 8000, arg) => { const t1 = Date.now(); while (Date.now() - t1 < ms) { if (await ev(fn, arg)) return true; await W(250); } return false; };
    let n = 0; const shot = async (k) => { if (SHOTS) await p.screenshot({ path: `dist/summit-${mode}-${old ? 'old' : 'new'}-${n++}-${k}.jpg`, type: 'jpeg', quality: 50, scale: 'css', timeout: 150000 }); };
    await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await W(6000);
    await p.click('#enter').catch(() => {}); await W(4000);
    if (await ev(() => !document.getElementById('look')?.hidden)) { await p.click('#look-ok').catch(() => {}); await W(1200); }
    await ev(() => { const o = window.__oreum; o.tut.skipAll(); o.setTod(14); });
    /* 정상(구역 5)은 권장 Lv 14: 레벨 1로 순간이동하면 '권장 레벨' 경고(감독 msg, 10초)가 이야기를 막음 → 정상에 오를 만한 레벨로 (#308 에서 낡은 검사 고침) */
    await ev(() => { const o = window.__oreum; for (let x = o.level.state().xp, g = 0; o.level.state().lv < 14 && g < 300; g++) { x += Math.max(50, Math.ceil(o.level.state().need / 4)); o.level.setXp(x); } });
    await W(1500);
    const S = () => ev(() => window.__oreum.summit.state());
    const go = (v) => ev((v) => { const o = window.__oreum; o.player.pos.set(v[0], o.groundAt(v[0], v[2]), v[2]); o.player.target = null; o.snap(); }, v);
    const sp = await ev(() => window.__oreum.summit.spots());
    ok(await ev(() => window.__oreum.summit.on), '남송이에서 켜짐');
    if (old) { // 옛 저장: 이미 정상에 가 봄
      await ev(() => { const o = window.__oreum; o.save.mutter = { ...(o.save.mutter || {}), summit: 1 }; o.summit.reset(); });
      const s = await S(); ok(s.s === 1 && s.old === 1, '옛 저장: 장면은 본 것으로');
    }
    await go([sp.stone[0] + 2, 0, sp.stone[2] + 1]);
    await W(800);
    let s = await S();
    if (!old) {
      const fov0 = s.fov; ok(await until(() => !!window.__oreum.summit.state().run, 90000), '표지석에 닿으면 장면 시작'); /* 레벨을 올리면 가게 열림 안내가 먼저 지나감(감독 시계 ~10초, 소프트웨어 GL 에선 실제 시간이 더 걸림) */
      await W(2500); s = await S(); ok(s.cam === 'cine' && s.run?.kind === 'scene', `장면 중 카메라 cine (u ${s.run?.u})`); await shot('turn');
      await ev(() => window.__oreum.summit.jump(6.9)); await W(150); s = await S(); ok(s.flash, '굼부리 안 빛 깜빡임'); await shot('flash');
      ok(await ev(() => !document.querySelector('#clue-cine .cc-sk').hidden), '건너뛰기 단추');
      await p.click('#clue-cine .cc-sk'); await W(600); s = await S();
      ok(!s.run && s.cam === 'follow' && s.s === 1, '건너뛰면 끝·카메라 돌아옴');
      ok(Math.abs(s.fov - fov0) < 0.5, `시야각 되돌림 (${s.fov})`);
      ok(await ev(() => !!window.__oreum.mutter.bubble()?.text?.includes('빛났')), '혼잣말 \'빛났는데?\'');
    } else { ok(!s.run, '옛 저장: 장면 없음'); }
    ok(s.note && !s.got, '표지석 뒤 쪽지가 보임');
    await go(sp.note); await W(600);
    ok(await ev(() => document.getElementById('btn-ctx')?.textContent?.includes('쪽지') || [...document.querySelectorAll('button')].some((e) => !e.hidden && e.offsetParent && /쪽지 읽기/.test(e.textContent))), '가까이 가면 쪽지 읽기');
    await ev(() => window.__oreum.interactables.find((i) => i.label === '쪽지 읽기' && i.when?.())?.act());
    await W(800);
    ok(await ev(() => !document.getElementById('punk-note').hidden && /굼부리 쪽에서 소리/.test(document.getElementById('punk-note').textContent)), '쪽지 창 (종이·글)'); await shot('note');
    ok(await ev(() => !/클린하우스|외계인|UFO/.test(document.getElementById('punk-note').textContent)), '반전 낱말 없음');
    await ev(() => window.__oreum.punkWorld.note.close());
    await W(900); s = await S();
    if (old) { ok(s.quest === 'done', '옛 저장: 퀘스트는 지난 것으로'); }
    else {
      ok(s.quest === 'on', '쪽지를 읽으면 퀘스트 받음');
      const tr = await ev(() => document.querySelector('#quest-track .qt')?.textContent || '');
      ok(/굼부리 가장자리/.test(tr), `추적 줄: ${tr}`);
      const c0 = await ev(() => window.__oreum.save.coins);
      await go(sp.rim); await until(() => window.__oreum.summit.state().quest === 'done', 10000); s = await S();
      ok(s.quest === 'done', '전망 자리에 닿으면 퀘스트 끝'); if (s.quest !== 'done') console.log(JSON.stringify(await ev(() => ({ q: window.__oreum.quest.state(), s: window.__oreum.summit.state(), pos: window.__oreum.player.pos.toArray().map(Math.round), tut: !!window.__oreum.tut?.active }))));
      const c1 = await ev(() => window.__oreum.save.coins); ok(c1 - c0 === 15, `귤 +${c1 - c0}`);
      ok(await until(() => window.__oreum.director.log.some((e) => e.ev === 'show' && e.id === 'rimDoor'), 45000), '감독이 다음 구역 문 한 줄 (다른 토스트가 끝난 뒤)');
    }
    // 망원경: 낮 → 불빛 없음, 밤 → 먼 불빛 (#207 단계 0 부터)
    await go(sp.scope); await W(500);
    await ev(() => window.__oreum.summit.scope()); await W(2600); s = await S();
    ok(s.run?.kind === 'scope' && !s.run.light && s.fov < 20, `망원경 (불빛 없음, fov ${s.fov})`); await shot('scope');
    await ev(() => window.__oreum.summit.stop()); await W(300);
    await ev(() => { const o = window.__oreum; o.setTod(23); o.save.journey = { ...(o.save.journey || {}), maxZ: 3 }; }); await W(600);
    await ev(() => window.__oreum.summit.scope()); await W(3200); s = await S();
    ok(s.run?.light, '밤: 먼 불빛'); await shot('scope-night');
    await ev(() => window.__oreum.summit.stop()); await W(300); s = await S();
    ok(s.cam === 'follow' && !s.run, '망원경 닫으면 돌아옴');
    // 다시 읽어도 그대로
    await p.reload(); await W(6000); await p.click('#enter').catch(() => {}); await W(4000);
    s = await S(); ok(s.s === 1 && s.q === 1 && s.got && !s.note && s.quest === 'done', '다시 읽어도 그대로');
    ok(!errs, `페이지 오류 ${errs}`);
    await ctx.close();
  };
  console.log('--- 새 사용자'); await run(false);
  console.log('--- 옛 저장'); await run(true);
  await b.close();
  console.log(fails ? `FAIL ${fails}` : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
