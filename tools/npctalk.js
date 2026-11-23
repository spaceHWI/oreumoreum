// NPC 대사 (#278) 확인. node tools/npctalk.js   (먼저 node build.mjs)
// 1) 모든 인물·말의 종류에서 줄이 나오고, 말풍선 줄 나눔(src/bubble.js)으로 두 줄 안
// 2) 상황 받아치기: 쓰러짐·박스 헬멧·귤 바닥이면 그 조건 줄이 뽑힐 수 있음
// 3) 처음 만남(first)은 한 번만 (save.npcMet)
// 4) 장비점 창: 열면 주인 한마디(open/first), 귤이 모자라면 poor 줄, 사면 buy 줄, 닫아도 오류 없음
// 5) 같은 말을 잇달아 하지 않음 (20번 뽑아 바로 앞 줄과 같은 적 없음)
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } }); let errs = 0;
  p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
  const W = (ms) => p.waitForTimeout(ms), E = (fn, a) => p.evaluate(fn, a);
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await W(6000);
  await p.click('#enter').catch(() => {}); await W(4000);
  if (await E(() => !document.getElementById('look')?.hidden)) { await p.click('#look-ok').catch(() => {}); await W(1500); }
  await E(() => { const o = window.__oreum; o.tut.skipAll(); o.setTod(14); Object.assign(o.save, { jeong: 1 }); });
  await W(2500);
  ok(await E(() => !!window.__oreum.npcTalk), '__oreum.npcTalk 있음');
  const { NPC_TALK } = await import('../src/npclines.js');
  // 1) 줄·말풍선 두 줄
  const all = await E((T) => { const t = window.__oreum.npcTalk, out = []; for (const [id, P] of Object.entries(T)) for (const k of Object.keys(P)) if (Array.isArray(P[k])) out.push([id, k, t.line(id, k)]); return out; }, NPC_TALK);
  ok(all.every(([, , s]) => s), `인물·종류 ${all.length}칸 모두 줄이 나옴 ${all.filter(([, , s]) => !s).map(([i, k]) => i + '.' + k).join(' ')}`);
  const texts = Object.values(NPC_TALK).flatMap((P) => Object.values(P).filter(Array.isArray).flat().map(([, s]) => s));
  const wrap = await E((L) => L.map((s) => [s, window.__oreum.mutter.wrap(s).length]), texts);
  const over = wrap.filter(([, n]) => n > 2);
  ok(!over.length, `말풍선 두 줄 안 ${texts.length}줄 ${over.map(([s, n]) => `${s}(${n})`).join(' · ')}`);
  // 2) 상황 받아치기
  const sit = await E(() => {
    const o = window.__oreum, t = o.npcTalk; o.save.coins = 5; t.down(); o.save.clothes.wear.hat = 'hat:p-box';
    const tg = t.tags(), hits = { down: 0, box: 0, broke: 0 };
    for (let i = 0; i < 60; i++) { const s = t.line('jigi', 'hello'); if (/쓰러졌/.test(s)) hits.down++; if (/박스/.test(s)) hits.box++; if (/바닥/.test(s)) hits.broke++; }
    delete o.save.clothes.wear.hat; return { tg, hits };
  });
  ok(['down', 'box', 'broke'].every((k) => sit.tg.includes(k)), `조건 칸 ${sit.tg.join(',')}`);
  ok(sit.hits.down && sit.hits.box && sit.hits.broke, `오름지기 상황 줄이 뽑힘 ${JSON.stringify(sit.hits)}`);
  // 3) 처음 만남 한 번
  const fm = await E(() => { const t = window.__oreum.npcTalk; delete window.__oreum.save.npcMet?.gear; const a = t.meet('gear'), b2 = t.meet('gear'); return { a, b2, met: t.met() }; });
  ok(fm.a && !fm.b2 && fm.met.gear, `처음 만남 한 번 '${fm.a}'`);
  // 5) 잇달아 같은 말 없음
  const rep = await E(() => { const t = window.__oreum.npcTalk; let last = '', same = 0; for (let i = 0; i < 20; i++) { const s = t.line('stone', 'hello'); if (s === last) same++; last = s; } return same; });
  ok(rep === 0, `같은 말 잇달아 ${rep}번`);
  // 4) 장비점 창
  await E(() => { const o = window.__oreum; o.save.coins = 0; o.street.open('gear'); }); await W(600);
  const w0 = await E(() => window.__oreum.npcTalk.window());
  ok(/철물 삼춘/.test(w0), `창 열 때 주인 한마디 '${w0}'`);
  const short = await E(() => { const b2 = document.querySelector('#shoppop .tier-buy.short, #shoppop .buy-card.poor .tier-buy'); if (!b2) return false; b2.click(); return true; }); await W(500);
  const w1 = await E(() => window.__oreum.npcTalk.window());
  ok(!short || NPC_TALK.gear.poor.some(([, s]) => w1.includes(s)), `귤 모자랄 때 '${w1}'${short ? '' : ' (누를 칸 없음)'}`);
  await E(() => { const o = window.__oreum; o.save.coins = 99999; o.updateStats?.(); o.street.open('gear'); }); await W(500);
  const bought = await E(() => { const b2 = document.querySelector('#shoppop .tier-buy:not(.short)'); if (!b2) return false; b2.click(); return true; }); await W(600);
  const w2 = await E(() => window.__oreum.npcTalk.window());
  ok(!bought || NPC_TALK.gear.buy.some(([, s]) => w2.includes(s)), `샀을 때 '${w2}'${bought ? '' : ' (살 칸 없음)'}`);
  await p.click('#shoppop-close').catch(() => {}); await W(500);
  ok(await E(() => document.getElementById('shoppop').hidden && !window.__oreum.npcTalk.window()), '창 닫힘 · 한마디 지움');
  await E(() => window.__oreum.street.open('dir')); await W(400);
  ok(!(await E(() => window.__oreum.npcTalk.window())), '가게 안내 창엔 주인 말 없음');
  await p.click('#shoppop-close').catch(() => {});
  ok(errs === 0, `페이지 오류 ${errs}`);
  await b.close();
  console.log(fails ? `실패 ${fails}` : '모두 통과'); process.exit(fails ? 1 : 0);
})();
