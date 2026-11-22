// 다음 할 일 (#142): 추적 줄이 잠깐 바뀌는 안내(배낭 참·귤 닿음·HP 낮음)와 줄기 퀘스트가 끝난 뒤 이어 줄 것을 차례로 본다
// node tools/nexthint.js [d|m] [shots]   (먼저 node build.mjs). shots 면 dist/next-<d|m>-<n>.jpg 로 작게 찍음
const { chromium, devices } = require('playwright');
const mode = process.argv[2] || 'd', SHOTS = !!process.argv[3];
let fails = 0; const ok = (c, msg) => { console.log(c ? 'ok  ' : 'FAIL', msg); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext(mode === 'm' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage(); let errs = 0;
  p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
  const W = (ms) => p.waitForTimeout(ms);
  let shotN = 0; const shot = async (n) => { if (SHOTS) await p.screenshot({ path: `dist/next-${mode}-${shotN++}-${n}.jpg`, type: 'jpeg', quality: 55, scale: 'css', timeout: 150000 }); };
  const ev = (fn, arg) => p.evaluate(fn, arg);
  const until = async (fn, ms = 6000, arg) => { const t1 = Date.now(); while (Date.now() - t1 < ms) { if (await ev(fn, arg)) return true; await W(250); } return false; };
  const T = () => ev(() => { const q = window.__oreum.quest; return { ...q.track(), why: q.next.why() }; });
  const seq = []; const note = async () => { const t = await T(); const s = `${t.k || 'quest'} · ${t.text}${t.prog ? ' (' + t.prog + ')' : ''}`; if (seq[seq.length - 1] !== s) seq.push(s); return t; };
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await W(6000);
  await p.click('#enter').catch(() => {}); await W(4000);
  await ev(() => window.__oreum.setTod(14));
  if (await ev(() => !document.getElementById('look').hidden)) { await p.click('#look-ok').catch(() => {}); await W(1500); }
  await ev(() => window.__oreum.tut.skipAll());
  ok(await until(() => window.__oreum.director.state().open.includes('quest'), 8000), '정낭을 나섬 (감독 문 quest)');
  await ev(() => { const o = window.__oreum, g = o.spots.tut?.beyond; if (g) { o.player.pos.set(g.x, o.groundAt(g.x, g.z), g.z); o.snap(); } o.save.coins = 0; o.quest.next.reset(); });
  ok(await until(() => window.__oreum.quest.track()?.shown, 6000), '추적 줄 보임');
  let t = await note(); ok(!t.k && t.why === 'quest', `퀘스트 줄 그대로: ${t.text}`);

  // ----- 배낭이 참 → 클린하우스로 -----
  await ev(() => { const o = window.__oreum, cap = o.trash.state().cap; for (let i = 0; i < 200; i++) if (!o.trash.api.addToBag('vinyl', cap) && !o.trash.api.addToBag('paper', cap) && !o.trash.api.addToBag('can', cap)) break; });
  ok(await until(() => window.__oreum.quest.track()?.k === 'bag', 12000), '배낭이 차면 클린하우스로');
  t = await note(); ok(!!t.target, `클린하우스 화살표 ${JSON.stringify(t.target)}`); await shot('bag');
  await ev(() => window.__oreum.quest.go()); await W(600);
  ok(await ev(() => !!window.__oreum.cleanhouse.autoState() || window.__oreum.player.target != null), '누르면 걸어감');
  await ev(() => { const o = window.__oreum; o.cleanhouse.autoStop(); const s = o.trash.api.store; for (const k of Object.keys(s.bag)) s.bag[k] = 0; s.commit(); });
  ok(await until(() => window.__oreum.quest.track()?.k !== 'bag', 12000), '비우면 퀘스트 줄로 돌아감');

  // ----- 귤이 다음 장비 값에 닿음 → 장비점으로 (한 번, 창을 열면 끝, 같은 장비로 다시 안 권함) -----
  ok(await ev(() => window.__oreum.quest.track()?.k !== 'shop'), '귤이 모자랄 땐 장비점을 권하지 않음');
  await ev(() => { window.__oreum.save.coins = 5000; });
  ok(await until(() => window.__oreum.quest.track()?.k === 'shop', 12000), '귤이 닿으면 장비점으로');
  await note(); await shot('shop');
  await ev(() => window.__oreum.street.open('gear')); await W(800);
  await ev(() => document.getElementById('shoppop').hidden = true);
  ok(await until(() => window.__oreum.quest.track()?.k !== 'shop', 12000), '장비점 창을 열면 끝');
  await W(4000); ok(await ev(() => window.__oreum.quest.track()?.k !== 'shop'), '같은 장비로는 다시 안 권함');
  await ev(() => { window.__oreum.save.coins = 0; });

  // ----- HP 낮음 → 스톤에서 식사 -----
  await ev(() => window.__oreum.shopGate?.open('stone')); await W(300); /* 스톤은 숲길 우두머리 뒤에 엶 (#206): 여기서는 열어 둠 */
  const hasStone = await ev(() => !!window.__oreum.stone);
  if (hasStone) {
    await ev(() => { const h = window.__oreum.hp; h.set(h.max * 0.2); });
    ok(await until(() => window.__oreum.quest.track()?.k === 'hp', 12000), 'HP 가 낮으면 스톤에서 식사');
    await note(); await shot('hp');
    await ev(() => { const h = window.__oreum.hp; h.set(h.max); });
    ok(await until(() => window.__oreum.quest.track()?.k !== 'hp', 12000), 'HP 가 차면 끝');
  }

  // ----- 줄기 퀘스트를 다 끝냄 → 이어 줄 것 -----
  await ev(() => { const o = window.__oreum, s = o.quest.api.state(); for (const q of o.quest.api.defs.main) if (!s.done.includes(q.id)) s.done.push(q.id); s.cur = null; for (const k of Object.keys(s.side)) delete s.side[k]; o.quest.next.reset(); });
  ok(await until(() => (window.__oreum.quest.track()?.k || '').startsWith('after:'), 12000), '퀘스트가 끝나면 이어 줄 것');
  t = await note(); ok(t.mark === 'next', '흰 › 표시');
  // 그 구역의 사건 → 터 → 우두머리가 먼저 (#256): 확인하고 빼서(제보는 레벨에 따라 끼어서 같이 뺌) 그 뒤 차례를 봄
  ok(['after:case', 'after:arena', 'after:boss'].includes(t.k), `그 구역 할 일이 먼저: ${t.text}`);
  await ev(() => window.__oreum.quest.next.skip(['case', 'arena', 'boss', 'report']));
  await until(() => !['after:case', 'after:arena', 'after:boss', 'after:report'].includes(window.__oreum.quest.track()?.k), 12000); t = await note();
  // 오늘의 업적을 다 받음 → 더미 → 소굴 → 돌탑 (강화·전설은 새 저장이라 없음)
  if (t.k === 'after:daily') {
    await ev(() => window.__oreum.quest.go()); await W(400);
    ok(await ev(() => !document.getElementById('ach').hidden), '오늘의 업적: 누르면 업적 창');
    await ev(() => { document.getElementById('ach').hidden = true; const d = window.__oreum.ach.ensureDaily(); for (const x of d.items) { x.done = true; x.claimed = true; } });
    await until(() => window.__oreum.quest.track()?.k !== 'after:daily', 12000); t = await note();
  }
  ok(t.k === 'after:heap', `더미: ${t.text} ${t.prog || ''}`); await shot('heap');
  await ev(() => window.__oreum.quest.go()); await W(600);
  ok(await ev(() => !!window.__oreum.cleanhouse.autoState()), '더미 쪽으로 걸어감'); await ev(() => window.__oreum.cleanhouse.autoStop());
  await ev(() => { const o = window.__oreum; o.trash.api.heaps.forEach((h, i) => o.trash.setHeap(i, 0)); });
  await until(() => window.__oreum.quest.track()?.k !== 'after:heap', 12000); t = await note();
  if (t.k === 'after:den') { await ev(() => { const F = window.__oreum.field; for (const d of F.dens()) F.closeDen(d.id); }); await until(() => window.__oreum.quest.track()?.k !== 'after:den', 12000); t = await note(); }
  ok(t.k === 'after:cairn' || t.k === 'after:den', `그 뒤에도 할 일: ${t.text}`);
  ok(!!t.text && t.shown, '할 일이 없다는 줄은 없음');
  console.log('\n다음 문구가 바뀐 순서:\n- ' + seq.join('\n- '));
  ok(errs === 0, `페이지 오류 ${errs}`);
  await b.close(); console.log(fails ? `FAIL ${fails}` : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
