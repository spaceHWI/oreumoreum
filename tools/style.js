// 겉모습 옷·한 벌 맞춤·색 바꾸기 확인 (#179): node tools/style.js [shot]
// 겉모습을 바꿔도 능력·장비 점수가 그대로인지, 가진 옷 중 가장 좋은 것이 능력인지, 세 벌을 입으면 효과·칭호, 색 바꾸기, LEAP '새 옷' 탭, 내 가방 옷 탭, 옛 저장
// shot 을 주면 LEAP 새 옷 탭·내 가방 옷 탭을 /tmp/claude-0/shots/style-*.png 에
const { chromium } = require('playwright');
const SHOT = process.argv[2] === 'shot', OUT = process.env.SHOTS || '/tmp/claude-0/shots/';
if (SHOT) require('fs').mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); let errs = 0;
  p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
  const E = (f, a) => p.evaluate(f, a), W = (t) => p.waitForTimeout(t);
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  // 옛 저장: 낮은 단계 옷을 입고 있고 높은 단계를 가짐, 베스트는 벗음
  await E(() => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1, coins: 20000 });
    o.save.clothes = { own: { 'hat:w-straw': 1, 'hat:w-bucket': 1, 'vest:w-old': 1 }, wear: { hat: 'hat:w-straw', top: 'top:w-tee', bottom: 'bottom:w-shorts' }, up: { 'hat:w-straw': { g: 3, e: 5 } } };
    const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.click('#enter', { timeout: 20000 }).catch(() => {}); await W(1500);
  let s = await E(() => { const o = window.__oreum, sv = o.save; return { wear: { ...sv.clothes.wear }, abHat: o.gearKit.abilityCloth(sv, 'hat'), abVest: o.gearKit.abilityCloth(sv, 'vest'), score: o.gearKit.gearScore(sv).total, stats: o.clothes.stats(), gear: { ...sv.outfit.gear } }; });
  ok(s.wear.hat === 'hat:w-straw' && s.gear.hat === 'hat:w-straw', `옛 저장: 입은 것이 그대로 겉모습 (${s.wear.hat})`);
  ok(s.abHat === 'hat:w-straw', `능력은 점수가 가장 높은 옷 (전설+5 밀짚 > 3단계 버킷: ${s.abHat})`);
  ok(s.abVest === 'vest:w-old' && s.stats.gyul > 0, `벗은 베스트도 가진 것이면 능력 (${s.abVest}, 귤 +${s.stats.gyul})`);
  const sc0 = s.score;
  // 겉모습 옷 사고 입기: 점수·능력 그대로
  s = await E(() => { const o = window.__oreum, sv = o.save; const before = JSON.stringify(o.clothes.stats()); const okb = o.clothes.buy('hat:s-gat'); return { okb, wear: sv.clothes.wear.hat, gear: sv.outfit.gear.hat, score: o.gearKit.gearScore(sv).total, same: before === JSON.stringify(o.clothes.stats()) }; });
  ok(s.okb && s.wear === 'hat:s-gat' && s.gear === 'hat:s-gat', '말총 갓 사서 바로 겉모습');
  ok(s.score === sc0 && s.same, `겉모습을 바꿔도 장비 점수·능력 그대로 (${sc0} → ${s.score})`);
  s = await E(() => { const o = window.__oreum, sv = o.save; o.clothes.wear('vest', null); return { score: o.gearKit.gearScore(sv).total, gear: sv.outfit.gear.vest }; });
  ok(s.score === sc0 && s.gear === 'vest:none', '베스트를 벗어도(겉모습 없음) 점수 그대로');
  // 한 벌 맞춤
  s = await E(() => { const o = window.__oreum; ['hat:s-goggle', 'top:s-haenyeo', 'bottom:s-rubber'].forEach((id) => o.clothes.give(id)); o.clothes.wear('hat', 'hat:s-goggle'); o.clothes.wear('top', 'top:s-haenyeo'); const mid = o.outfitSet.worn(); o.clothes.wear('bottom', 'bottom:s-rubber');
    return { mid, worn: o.outfitSet.worn(), titles: o.outfitSet.titles().map((t) => t.title), toast: document.getElementById('toast')?.textContent || '' }; });
  ok(!s.mid && s.worn === 'haenyeo', `해녀 세 벌 → 한 벌 맞춤 (${s.worn})`);
  ok(s.titles.includes('물질 장인') && /물질 장인/.test(s.toast), `칭호 '물질 장인' (토스트: ${s.toast.slice(0, 40)})`);
  await W(400); s = await E(() => window.__oreum.outfitSet.visible()); ok(s, '둘레 효과 보임');
  s = await E(() => { const o = window.__oreum; o.clothes.wear('hat', 'hat:s-gat'); return o.outfitSet.worn(); }); ok(!s, '하나 벗으면 효과 꺼짐');
  // 색 바꾸기 (tint)
  s = await E(() => { const o = window.__oreum, sv = o.save; o.clothes.give('hat:s-beanie'); o.clothes.wear('hat', 'hat:s-beanie'); o.bag.open('wear'); const dots = document.querySelectorAll('#wardrobe-body .bag-lc .lc-dots button').length;
    const row = document.querySelector('#wardrobe-body .wear-row .bag-lc'); /* 첫 줄 = 모자 */ row?.querySelectorAll('button')[3]?.click(); return { dots, tint: sv.clothes.tint['hat:s-beanie'], gear: sv.outfit.gear.hat }; });
  ok(s.dots >= 8 && s.tint === 3 && s.gear === 'hat:s-beanie~3', `감귤 비니 색 바꾸기 (${s.gear})`);
  s = await E(() => ({ ab: document.querySelectorAll('#wardrobe-body .wear-item .abm').length, items: document.querySelectorAll('#wardrobe-body .wear-item.has').length }));
  ok(s.ab === 4, `내 가방 옷 탭: 능력 옷이 있는 칸(모자·티·바지·베스트)마다 능력 표시 하나 (${s.ab}), 가진 옷 ${s.items}`);
  if (SHOT) await p.screenshot({ path: OUT + 'style-bag.png' });
  await E(() => window.__oreum.bag.close());
  // LEAP 새 옷 탭
  s = await E(() => { const o = window.__oreum; if (!o.street?.open) return null; o.street.open('leap'); o.street.leap?.slot?.('new'); return 0; }).catch(() => null);
  s = await E(() => { const o = window.__oreum; o.leap?.open?.(); o.leap?.slot?.('new'); return { tab: !!document.querySelector('#shoppop .shop-tabs button.new'), cards: document.querySelectorAll('#shoppop-cards .leap-card').length, style: [...document.querySelectorAll('#shoppop-cards .leap-card small.st')].filter((e) => /겉모습/.test(e.textContent)).length }; });
  ok(s.tab && s.cards >= 30 && s.style === s.cards, `LEAP 새 옷 탭: 카드 ${s.cards} (모두 겉모습 ${s.style})`);
  if (SHOT) await p.screenshot({ path: OUT + 'style-leap.png' });
  s = await E(() => { const o = window.__oreum; const card = document.querySelector('#shoppop-cards .leap-card'); card?.click(); const bar = document.querySelector('#shoppop-cards .leap-buy'); return { bar: !!bar, desc: bar?.querySelector('.desc')?.textContent || '' }; });
  ok(s.bar && s.desc, `새 옷 고르면 입어 보기·사기 줄 (${s.desc})`);
  ok(!errs, `페이지 오류 ${errs}`);
  await b.close(); console.log(fails ? `실패 ${fails}` : '모두 통과'); process.exit(fails ? 1 : 0);
})();
