// 전리품·강화 게임 안 확인 (#140): node tools/lootlive.js [shot]
// dist/test.html 남송이(전투 오름)에서: 우두머리 전리품이 떨어져 빨려 듦 → 재료 주머니, 장비를 얻으면 견주는 창·[바로 입기] → 능력이 오름,
// 장비점 강화(재료 + 귤, 실패 없음) → +1, 모자라면 '가는 길', 다음 단계를 사면 예전 것은 귀로, 전설 효과(줍는 거리·갈라짐·귤 더), 적을 쫓아내면 재료
// shot 을 주면 견주는 창·강화 창을 PC(1280×720)·폰(390×844) 으로 /tmp/claude-0/shots/loot-*.png 에
const { chromium } = require('playwright');
const SHOT = process.argv[2] === 'shot', OUT = process.env.SHOTS || '/tmp/claude-0/shots/';
if (SHOT) require('fs').mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
async function run(b, vp, tag) {
  const p = await b.newPage({ viewport: vp, hasTouch: tag === 'm', isMobile: tag === 'm' });
  const errs = []; p.on('pageerror', (e) => { errs.push(e.message); console.log('ERR', e.message.slice(0, 300)); });
  const E = (f, a) => p.evaluate(f, a), W = (t) => p.waitForTimeout(t), settle = () => p.waitForFunction(() => window.__oreum.loot.drops() === 0, null, { timeout: 60000 }).catch(() => {}); // 느린 소프트웨어 렌더는 게임 시간이 느림
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await E(() => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1, coins: 50000, equip: { tool: 3, bag: 3, shoes: 3, weapon: 3 }, weaponUse: 3, mats: {}, loot: [], gearUp: {}, lootAuto: 1 });
    const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.click('#enter', { timeout: 20000 }).catch(() => {}); await W(2500);
  await E(() => { const o = window.__oreum; try { o.pace.pacing.test.first.done = true; o.pace.pacing.test.first.bloomed = true; } catch (_) { /* 없음 */ } o.setTod?.(13); o.setWeather?.('clear'); document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; }); });
  const L = () => E(() => { const o = window.__oreum; return { mats: o.loot.mats(), drops: o.loot.drops(), spare: o.loot.spare(), up: o.loot.up(), pop: o.loot.pop(), coins: o.save.coins }; });
  // 1. 우두머리 전리품: 분수처럼 떨어져 빨려 듦
  await E(() => window.__oreum.loot.drop('boss', 3, { roll: { mats: { r3: 1, m3: 5 }, gear: null } }));
  let s = await L(); ok(s.drops >= 3 && s.mats.r3 === 1 && s.mats.m3 === 5, `${tag} 우두머리 전리품: 조각 ${s.drops}개, 주머니 ${JSON.stringify(s.mats)}`);
  if (SHOT) { await W(700); await p.screenshot({ path: `${OUT}loot-${tag}-fountain.png` }); }
  await settle(); s = await L(); ok(s.drops === 0, `${tag} 가까이 있으면 빨려 들어옴 (남은 조각 ${s.drops})`);
  // 2. 장비를 얻으면 견주는 창 → [바로 입기]
  const t0 = await E(() => window.__oreum.stone ? window.__oreum.stone.tool() : null);
  await E(() => window.__oreum.loot.give({ s: 'tool', t: 3, g: 2 })); await settle();
  s = await L(); ok(!!s.pop && s.pop.g === 2 && s.spare.length === 1 && s.spare[0].d > 0, `${tag} 귀한 갈퀴: 견주는 창 ${JSON.stringify(s.pop)} ▲${s.spare[0]?.d}`);
  if (SHOT) await p.screenshot({ path: `${OUT}loot-${tag}-pop.png` });
  await E(() => document.querySelector('#loot-pop .lp-wear').click()); await W(300);
  s = await L(); const t1 = await E(() => window.__oreum.stone ? window.__oreum.stone.tool() : null);
  ok(s.up.gear.tool?.g === 2 && s.spare.length === 0 && (!t0 || t1.time < t0.time), `${tag} 바로 입기: 등급 ${JSON.stringify(s.up.gear)} 줍기 ${t0?.time} → ${t1?.time?.toFixed(3)}초`);
  // 못한 것은 자동으로 귤로
  const c0 = (await L()).coins; await E(() => window.__oreum.loot.give({ s: 'tool', t: 3, g: 1 })); await settle(); s = await L();
  ok(s.spare.length === 0 && s.coins > c0 && !s.pop, `${tag} 지금보다 못한 장비는 자동으로 귤로 (+${s.coins - c0})`);
  // 3. 강화
  await E(() => { const o = window.__oreum; o.loot.addMats({ m3: 40 }); o.street?.open('gear'); }); await W(400);
  await E(() => document.querySelector('.forge-switch [data-m="forge"]').click()); await W(300);
  await E(() => window.__oreum.forge.pick('tool')); await W(200);
  const f0 = await E(() => ({ step: document.querySelector('.forge-step')?.textContent, need: document.querySelectorAll('.forge-need .fn').length, go: document.querySelector('.forge-go')?.textContent }));
  ok(f0.need >= 2 && /강화 \+1/.test(f0.go), `${tag} 강화 창: ${f0.step} · 필요 ${f0.need}줄 · [${f0.go}]`);
  if (SHOT) { await W(300); await p.screenshot({ path: `${OUT}loot-${tag}-forge.png` }); }
  await E(() => document.querySelector('.forge-go').click()); await W(300);
  s = await L(); ok(s.up.gear.tool?.e === 1 && s.mats.m3 === 43, `${tag} 강화 +1: ${JSON.stringify(s.up.gear.tool)} 남은 엄니 ${s.mats.m3}`);
  // 모자라면 가는 길
  await E(() => window.__oreum.forge.pick('top')); await W(200);
  const f1 = await E(() => ({ go: document.querySelector('.forge-go')?.textContent, way: document.querySelector('.fn-go')?.textContent, where: document.querySelector('.fn-where')?.textContent }));
  ok(/모자라/.test(f1.go) && !!f1.way, `${tag} 모자라면: [${f1.go}] ${f1.where} [${f1.way}]`);
  // 4. 다음 단계를 사면 예전 것의 등급·강화는 귤로
  await E(() => { document.querySelector('.forge-switch [data-m="buy"]').click(); }); await W(200);
  const c1 = (await L()).coins; await E(() => window.__oreum.cleanhouse.buyGear('tool', 3)); await W(200); s = await L();
  ok(!s.up.gear.tool && s.spare.length === 0 && c1 - s.coins === 3200 - 300, `${tag} 큰 갈퀴를 사면 귀한 갈퀴 +1 은 귤로 (쓴 귤 ${c1 - s.coins})`);
  await E(() => { document.getElementById('shoppop').hidden = true; });
  // 5. 전설 효과
  const r0 = await E(() => window.__oreum.stone.tool().r);
  await E(() => window.__oreum.loot.give({ s: 'tool', t: 4, g: 3 })); await settle(); await E(() => document.querySelector('#loot-pop .lp-wear')?.click()); await W(200);
  const r1 = await E(() => window.__oreum.stone.tool().r); ok(r1 > r0 * 1.3, `${tag} 전설 큰 갈퀴: 줍는 거리 ${r0} → ${r1}`);
  await E(() => window.__oreum.loot.give({ s: 'weapon', t: 3, g: 3 })); await settle(); await E(() => document.querySelector('#loot-pop .lp-wear')?.click()); await W(200);
  const sp = await E(() => { const o = window.__oreum, en = o.enemies; en.test.clear(); const a = en.test.spawn('boar', 10, 0), b2 = en.test.spawn('boar', 12, 1); a.state = b2.state = 'idle'; const h = b2.hp; en.hurt(a, 2); return { on: o.loot.legendOn('split'), before: h, after: b2.hp }; });
  ok(sp.on && sp.after < sp.before, `${tag} 전설 귤 총: 갈라져 옆 적 기운 ${sp.before} → ${sp.after}`);
  // 6. 적을 쫓아내면 재료 (60%)
  const m0 = (await L()).mats.m1 || 0;
  await E(() => { const en = window.__oreum.enemies; en.test.clear(); for (let i = 0; i < 12; i++) { const e = en.test.spawn('piglet', 6 + i * 0.3, 4); en.hurt(e, 999); } }); await W(300);
  s = await L(); ok((s.mats.m1 || 0) - m0 >= 3, `${tag} 아기 멧돼지 12마리 → 멧돼지 털 +${(s.mats.m1 || 0) - m0}`);
  // 7. 도감
  await E(() => window.__oreum.trash.openDex()); await W(300);
  const dx = await E(() => ({ sec: [...document.querySelectorAll('#dex-grid .dex-sec')].map((e) => e.textContent).filter(Boolean), leg: document.querySelectorAll('#dex-grid .dex-cell.legend').length, got: document.querySelectorAll('#dex-grid .dex-cell.legend:not(.locked)').length }));
  ok(dx.sec.includes('재료') && dx.sec.includes('전설 장비') && dx.leg === 10 && dx.got >= 2, `${tag} 도감: ${dx.sec.join('·')} · 전설 ${dx.got}/${dx.leg}`);
  await E(() => { document.getElementById('dex').hidden = true; });
  // 8. 저장이 남음
  const sv = await E(() => { const k = ['oreumoreum.dev', 'oreumoreum.v1'].find((k) => localStorage.getItem(k)); const j = JSON.parse(localStorage.getItem(k)); return { mats: j.mats, up: j.gearUp, lv: j.lootV }; });
  ok(sv.mats && sv.up?.tool?.g === 3 && sv.lv === 1, `${tag} 저장: ${JSON.stringify(sv)}`);
  ok(!errs.length, `${tag} 페이지 오류 ${errs.length}`);
  await p.close();
}
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  await run(b, { width: 1280, height: 720 }, 'pc');
  await run(b, { width: 390, height: 844 }, 'm');
  await b.close(); console.log(fails ? `문제 ${fails}` : '모두 통과'); process.exit(fails ? 1 : 0);
})();
