// 가게를 퀘스트 순서대로 열기 (#206) 확인. 먼저 node build.mjs. node tools/shopgate.js
// 1) 튜토리얼을 막 마친 저장: 장비점만 열림, 나머지는 셔터·꺼진 간판·준비 중·주인 없음 (마차는 탐, #244)
// 2) 첫 배낭 가득 → 버림 → 만족한상회 알림·셔터 올라감 / 구역 1 우두머리 → 스톤 / 레벨·구역 2 → 미장원·LEAP / 구역 2 우두머리 → 탈것 가게
// 3) 옛 저장(구역 2 끝·식사한 적 있음): 처음부터 모두 열림(알림 없이) · 4) 어드민 '가게 모두 열기'
const { chromium } = require('playwright');
const URL = 'file://' + process.cwd() + '/dist/test.html#namsongi';
let fails = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
const FRESH = { entered: 1, look: { sex: 'm', skin: 0 }, nickSet: 1, tut: { step: 99, done: true, v: 4 }, jeong: 1, soundOff: 1, coins: 40, equip: { tool: 2, bag: 1, shoes: 0, weapon: 1 }, recycle: { visits: 1 } };
const VET = { ...FRESH, coins: 900, boss: { done: { 1: 1, 2: 1 } }, journey: { step: 9, seen: { quest: '2026-11-20' }, day: '2026-11-20', n: 0, days: 3, maxZ: 3 }, recycle: { visits: 30 }, ach: { life: { meal: 2 } } };
async function page(b, data) {
  const ctx = await b.newContext({ viewport: { width: 960, height: 600 } }); const p = await ctx.newPage(); let errs = 0;
  p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
  await p.goto(URL);
  const E = (f, a) => p.evaluate(f, a), W = (ms) => p.waitForTimeout(ms);
  const until = async (fn, ms, arg) => { const t1 = Date.now(); while (Date.now() - t1 < ms) { if (await E(fn, arg).catch(() => false)) return true; await W(150); } return false; };
  await until(() => !!window.__oreum?.ticks, 30000);
  await E((d) => { const o = window.__oreum; delete o.save.shopGate; delete o.save.journey; Object.assign(o.save, d); const k = ['oreumoreum.v1', 'oreumoreum.dev'].find((k) => localStorage.getItem(k)) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); }, data); /* smoke.js 처럼: 읽힌 뒤 저장을 바꾸고 다시 읽음 */
  await p.reload(); await until(() => !!window.__oreum?.ticks, 30000); await p.click('#enter').catch(() => {}); await W(2500);
  if (await E(() => !document.getElementById('look').hidden).catch(() => false)) { await p.click('#look-ok').catch(() => {}); await W(800); }
  if (await E(() => { const f = document.getElementById('fs-tip'); return f && !f.hidden; })) { await p.click('#fs-tip-x').catch(() => {}); }
  await E(() => window.__oreum.setTod(14));
  return { ctx, p, E, W, until, errs: () => errs };
}
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  // ----- 1) 막 마친 저장 -----
  {
    const { ctx, E, W, until, errs } = await page(b, FRESH);
    const st = await E(() => { const g = window.__oreum.shopGate; return Object.fromEntries(['gear', 'manjok', 'stone', 'salon', 'leap', 'ride'].map((id) => [id, g.isOpen(id)])); });
    ok(st.gear && !st.manjok && !st.stone && !st.salon && !st.leap && !st.ride, `처음엔 장비점만 열림 ${JSON.stringify(st)}`);
    ok(await E(() => window.__oreum.shopGate.shutter('stone')?.visible && !window.__oreum.shopGate.shutter('gear')?.visible), '스톤 문 앞 셔터, 장비점은 셔터 없음');
    ok(await E(() => window.__oreum.street.roof.signs.stone.off === true && !window.__oreum.street.roof.signs.gear.off), '스톤 지붕 간판 꺼짐');
    ok(await E(() => window.__oreum.quest.givers.get('shop:stone')?.root.visible === false), '스톤 주인 NPC 없음');
    // 가까이 가면 준비 중
    await E(() => window.__oreum.stone.go());
    await until(() => /준비 중/.test(document.getElementById('msg-log').textContent), 4000);
    const t = await E(() => document.getElementById('msg-log').textContent);
    ok(/준비 중 — 숲길 우두머리를 쫓아내면 열려요/.test(t), `닫힌 가게 앞 한 줄: ${t}`);
    ok(await E(() => window.__oreum.aim.ctx() !== '식사'), '닫힌 스톤 상호작용 없음');
    await E(() => window.__oreum.street.open('stone')); await W(300);
    ok(await E(() => document.getElementById('shoppop').hidden), '닫힌 가게 창은 안 열림');
    ok(await E(() => window.__oreum.street.open('gear') || true) && await E(() => !document.getElementById('shoppop').hidden), '장비점 창은 열림');
    await E(() => document.getElementById('shoppop-close').click());
    // 가게 안내: 닫힌 가게는 회색·조건
    await E(() => window.__oreum.street.open('dir')); await W(300);
    ok(await E(() => { const c = document.querySelector('.dir-card[data-shop="stone"]'); return c && c.classList.contains('poor') && /준비 중/.test(c.textContent); }), '가게 안내: 스톤 준비 중');
    await E(() => document.getElementById('shoppop-close').click());
    // 2) 만족한상회: 첫 배낭 가득 → 버림
    await E(() => { const o = window.__oreum; o.trash.fillBag(999, 'can'); });
    ok(await until(() => window.__oreum.save.shopGate.full === 1, 6000) && await E(() => !window.__oreum.shopGate.isOpen('manjok')), '배낭 가득 (아직 닫힘)');
    await E(() => { window.__oreum.save.recycle.visits++; }); await W(300);
    const opened = await until(() => window.__oreum.shopGate.isOpen('manjok'), 60000);
    ok(opened, '버린 뒤 만족한상회가 열림');
    if (!opened) for (let i = 0; i < 6; i++) { console.log(await E(() => { const o = window.__oreum; return JSON.stringify({ cur: o.director.state().cur, can: o.director.can('intro'), mut: o.director.can('mutter'), ten: o.state?.tension, toast: !document.getElementById('msg-log').hidden && document.getElementById('msg-log').textContent, banner: !document.getElementById('banner').hidden, en: o.enemies?.near?.(o.player.pos, 25) ? 1 : 0, pace: o.pace?.threat?.() }); })); await W(1000); }
    if (!opened) console.log(await E(() => JSON.stringify({ can: window.__oreum.director.can('intro'), st: window.__oreum.director.state(), chk: window.__oreum.shopGate.check(), sg: window.__oreum.save.shopGate, panels: [...document.querySelectorAll('.panel,[id]')].filter((e) => !e.hidden && e.offsetParent && /^(quest|shoppop|menu|zdone|banner|toast)$/.test(e.id)).map((e) => e.id) })));
    const msg = await E(() => document.getElementById('msg-log').textContent);
    ok(/만족한상회가 문을 열었어요/.test(msg), `열림 알림: ${msg}`);
    ok(await E(() => window.__oreum.save.shopGate.fd === 1), '첫 배낭 가득 → 버림 기록');
    ok(await until(() => window.__oreum.shopGate.shutter('manjok')?.visible === false, 25000), '셔터가 올라감');
    // 스톤: 구역 1 우두머리
    await E(() => { const s = window.__oreum.save; s.boss = s.boss || {}; s.boss.done = { ...(s.boss.done || {}), 1: 1 }; });
    ok(await until(() => window.__oreum.shopGate.isOpen('stone'), 60000), '구역 1 우두머리 뒤 스톤이 열림');
    ok(await until(() => window.__oreum.quest.givers.get('shop:stone')?.root.visible === true, 3000), '스톤 주인 NPC 나옴');
    // 미장원·LEAP: 구역 2
    await E(() => { window.__oreum.save.journey.maxZ = 2; });
    ok(await until(() => window.__oreum.shopGate.isOpen('salon') && window.__oreum.shopGate.isOpen('leap'), 90000), '구역 2 에서 미장원·LEAP 이 열림');
    // 탈것 가게: 구역 2 우두머리 전엔 닫힘 (마차는 탐, #244)
    ok(await E(() => !window.__oreum.shopGate.isOpen('ride')), '탈것 가게 아직 닫힘');
    await E(() => { window.__oreum.save.boss.done[2] = 1; });
    ok(await until(() => window.__oreum.shopGate.isOpen('ride'), 60000), '구역 2 우두머리 뒤 탈것 가게가 열림');
    // 다시 읽어도 열린 채
    ok(errs() === 0, `페이지 오류 ${errs()}`);
    await ctx.close();
  }
  // ----- 3) 옛 저장 -----
  {
    const { ctx, E, errs } = await page(b, VET);
    const st = await E(() => { const g = window.__oreum.shopGate; return Object.fromEntries(['gear', 'manjok', 'stone', 'salon', 'leap', 'ride'].map((id) => [id, g.isOpen(id)])); });
    ok(Object.values(st).every(Boolean), `옛 저장은 처음부터 모두 열림 ${JSON.stringify(st)}`);
    ok(await E(() => !/문을 열었어요/.test(document.getElementById('msg-log').textContent)), '옛 저장은 알림 없음');
    ok(errs() === 0, `페이지 오류 ${errs()}`);
    await ctx.close();
  }
  // ----- 4) 어드민 '가게 모두 열기' -----
  {
    const { ctx, E, W, errs } = await page(b, FRESH);
    ok(await E(() => !window.__oreum.shopGate.isOpen('stone')), '스위치 전: 스톤 닫힘');
    await E(() => window.__oreum.shopGate.force(true)); await W(300);
    ok(await E(() => window.__oreum.shopGate.isOpen('stone') && window.__oreum.shopGate.shutter('stone')?.visible === false && !window.__oreum.save.shopGate.open.stone), '스위치 켬: 모두 열린 모습 (저장은 그대로)');
    await E(() => window.__oreum.shopGate.force(false)); await W(300);
    ok(await E(() => !window.__oreum.shopGate.isOpen('stone') && window.__oreum.shopGate.shutter('stone')?.visible), '스위치 끔: 다시 닫힘');
    ok(errs() === 0, `페이지 오류 ${errs()}`);
    await ctx.close();
  }
  await b.close();
  console.log(fails ? `FAIL ${fails}` : 'ALL OK');
  process.exit(fails ? 1 : 0);
})();
