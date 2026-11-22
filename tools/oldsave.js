// 예전·깨진 저장으로 들어와도 오류가 없는지 (#16). node tools/oldsave.js
const { chromium } = require('playwright');
const OLD_XP = (L) => { let x = 0; for (let i = 1; i < L; i++) x += Math.round(70 * i ** 1.6); return x; }; // #159 곡선으로 레벨 L 에 닿는 경험치
const SAVES = {
  empty: {},
  // #255 징표: 깨진 tok·없는 무기·넘는 단계·이상한 차림 묶음, 징표 옷을 입은 저장
  tokBad: { nick: '징표 사람', coins: 40, entered: 1, tut: { step: 99, done: true, v: 3 }, tok: { n: -5, got: 'x', own: { rapid: 9, zzz: 1 }, arm: 'zzz', rec: 'q', kit: { fight: { wear: 5, arm: 'blast' }, pick: 3 }, rv: 'z' } },
  tokWear: { nick: '징표 옷', coins: 40, entered: 1, tut: { step: 99, done: true, v: 3 }, tok: { n: 12, got: 30, own: { pierce: 2 }, arm: 'pierce', rec: { 2: { at: 5, n: 99, win: 1 } } }, clothes: { own: { 'top:t-gong': 1, 'vest:t-gong': 1 }, wear: { top: 'top:t-gong', vest: 'vest:t-gong' } } },
  tokStr: { nick: '징표 글', coins: 40, tok: 'abc' },
  v0: { nick: '예전 사람', coins: 321, equip: { tool: 3 }, outfit: { hat: { type: 'cap', color: '#222222' } }, owned: { 'shirt:tee:#ff0000': 1 }, totalSteps: 999, nsV1: 1, ach: { done: {} } },
  broken: { nick: '깨진 사람', coins: 'abc', equip: 5, clothes: 3, rides: 'x', trash: { srv: 1, bag: null, dex: 7 }, ach: { daily: 3, life: null, badges: [] }, tut: 'x', look: { sex: 'q', skin: 99 }, hairs: 2, buff: { id: 'nope', left: 5 }, recycle: [], server: 'nope', wishes: null, story: { done: 'x', wait: [1, 'nope', 'mom'], cans: [[1, 'a'], null], box: 3 } },
  old8: { nick: '8일 전 사람', coins: 777, music: 0, gfx: 'low', lastSeen: Date.now() - 8 * 864e5 },
  midV: { nick: '중간 사람', coins: 1500, equip: { tool: 2, bag: 1, shoes: 2, weapon: 9 }, nsV1: 1, nsV2: 1, nsV3: 1, tut: { step: 4, done: false, v: 2 }, bagV: 1, server: 'battle', trash: { srv: { battle: { sig: 'old', heaps: [1, 2] } }, bag: { can: 3 } } },
  // #138: 들판 기록이 깨진 저장 · 예전 더미 서명(h1)
  field: { nick: '들판 사람', coins: 50, entered: 1, tut: { step: 99, done: true, v: 3 }, field: { den: 'x', tr: { d: 'q', got: 5 }, sight: 'a', fog: '!!!' }, trash: { srv: { battle: { sig: 'h1:1s10', heaps: [3, 4] } } } },
  field2: { nick: '들판 사람2', coins: 50, entered: 1, tut: { step: 99, done: true, v: 3 }, field: { den: { 'd2-0': -5, x: 'y' }, tr: { d: 1, got: ['t1-0'] }, sight: ['sight:0', 7], fog: 'AAAA' } },
  swarm: { nick: '떼 사람', coins: 50, entered: 1, tut: { step: 99, done: true, v: 3 }, swarm: { seen: 1, auto: 1, earn: 120, best: { 1: { k: 30, t: 180, w: 6 } }, rest: { 1: Date.now() + 300000, 2: 'x', 9: 5 }, won: { 1: { at: Date.now() - 1000, b: 4 }, 3: 7 } } }, // #202 한 판 쉬는 시간·덤 기록이 있는 저장 (#231 터 방식에서도)
  swarm2: { nick: '떼 사람2', coins: 50, entered: 1, tut: { step: 99, done: true, v: 3 }, swarm: { rest: [1, 2], won: 'q', best: 3, hint: 'x' } }, // #231 깨진 떼 저장·hint
  // #176: 감독 기록이 깨진 저장
  journey: { nick: '감독 사람', coins: 50, entered: 1, tut: { step: 99, done: true, v: 3 }, jeong: 1, journey: { step: 'x', seen: 7, day: 3, n: 'q' }, pace: { first: 1, bloomed: 1, hint: { w: 3, t: 1 } } },
  // #155: 기본 옷 색 번호가 깨진 저장
  lookc: { nick: '색 사람', coins: 50, entered: 1, tut: { step: 99, done: true, v: 3 }, jeong: 1, look: { sex: 'f', skin: 2, colors: { hat: 99, top: 'x', bottom: -3, shoes: 2.5 } } },
  // #232: 사건 파일 기록이 깨진 저장 · 사건을 연 저장(증거 하나)
  caseBad: { nick: '사건 사람', coins: 50, entered: 1, tut: { step: 99, done: true, v: 3 }, jeong: 1, cases: { c1: { w: 'x', ev: 5, f: 'q', base: 3 }, zz: 7 } },
  reportBad: { nick: '제보 사람', coins: 50, entered: 1, tut: { step: 99, done: true, v: 3 }, jeong: 1, lv: { xp: 99999 }, report: { d: 404, id: 'zz', got: 'yes', said: [] } }, // 미확인 제보 (#238): 이상한 값
  reportOld: { nick: '어제 제보', coins: 50, entered: 1, tut: { step: 99, done: true, v: 3 }, jeong: 1, lv: { xp: 99999 }, report: { d: '2026-01-01', id: 'u01', got: 1, said: 1 } },
  caseMid: { nick: '조사 중', coins: 50, entered: 1, tut: { step: 99, done: true, v: 3 }, jeong: 1, cases: { c1: { w: 1763800000000, ev: ['k1a', 'nope', 'k1a'], f: 0 } }, punk: { notes: { k1a: 1763800000000 }, unread: [] } },
  caseChase: { nick: '흰 옷 쫓기', coins: 50, entered: 1, tut: { step: 99, done: true, v: 3 }, jeong: 1, cases: { c2: { w: 1763800000000, ev: ['k2a', 'k2b', 'k2c'], f: 0, a: 'x', s: 'bad' } } }, /* #233 터를 버티고 따라가는 중 (a 깨짐) */
  caseC3: { nick: '맨발 조사', coins: 50, entered: 1, tut: { step: 99, done: true, v: 3 }, jeong: 1, cases: { c3: { w: 1763800000000, ev: ['k3a', 'k3a', 'zz'], f: 0, h: 'yes', b: 'q' } }, mats: { m4: 'x' } }, // #234 사건 3: 대면 장면 준비(h) 깨짐
  // #158: 퀘스트 기록이 깨진 저장 · 구역 1·2 를 끝낸 옛 저장(퀘스트 없음 → 구역 3 줄부터)
  questBad: { nick: '퀘스트 사람', coins: 50, entered: 1, tut: { step: 99, done: true, v: 3 }, jeong: 1, quest: { cur: 'nope', done: 5, side: [1], cp: 'x', c: null } },
  questVet: { nick: '고참', coins: 900, entered: 1, tut: { step: 99, done: true, v: 3 }, jeong: 1, equip: { tool: 4, bag: 4, shoes: 3, weapon: 3 }, boss: { done: { 1: 1, 2: 2 } }, journey: { step: 9, seen: { quest: '2026-11-20' }, day: '2026-11-20', n: 0, days: 3, maxZ: 3 }, ach: { life: { trash: 900, 'heap-clear': 30, recycle: 20 } } },
  // #180: 철 이벤트 기록이 깨진 저장
  season: { nick: '산타 사람', coins: 50, entered: 1, tut: { step: 99, done: true, v: 3 }, jeong: 1, season: { xmas: { days: [3, 'x', 99, 3], gift: ['hat:nope', 7], tree: 'q', snow: 1, gd: -1, seen: 77 } }, buff: { id: 'vin', left: 30 }, clothes: { own: { 'hat:x-santa': 1 }, wear: { hat: 'hat:x-santa' } } },
  season2: { nick: '산타 사람2', coins: 50, entered: 1, tut: { step: 99, done: true, v: 3 }, season: 'abc' },
  ufo: { nick: '불빛 사람', coins: 50, entered: 1, tut: { step: 99, done: true, v: 3 }, jeong: 1, boss: { done: { 1: 1, 2: 1, 3: 1 } }, story: { done: ['night'] }, ufo: { close: 'x', clear: 7, trace: { d: 3, x: 'a' } } }, // #207 UFO 드러남 단계
  ufo2: { nick: '불빛 사람2', coins: 50, entered: 1, tut: { step: 99, done: true, v: 3 }, ufo: 'abc' },
  myst: { nick: '숫자 사람', coins: 50, entered: 1, tut: { step: 99, done: true, v: 3 }, myst: { seen: 'clock', said: 'x', safe: 'yes', rad: 7, tr: [1], crop: 'z' } }, // #212 깨진 미스터리 기록
  myst2: { nick: '숫자 사람2', coins: 50, entered: 1, tut: { step: 99, done: true, v: 3 }, boss: { done: { 1: 1, 2: 1, 3: 1, 4: 1 } }, story: { seen: 1 }, myst: 9 }, // #212 엔딩 본 저장 + 이상한 값
  // #164: 배낭 겉모습·박스 헬멧이 깨진 저장
  punk: { nick: '펑크 사람', coins: 50, entered: 1, tut: { step: 99, done: true, v: 3 }, jeong: 1, equip: { tool: 2, bag: 1, shoes: 1, weapon: 1 }, backs: { own: { tewak: 1, nope: 1 }, cur: 'tewak' }, boxView: 'x', clothes: { own: { 'hat:p-box': 1 }, wear: { hat: 'hat:p-box' } } },
  punk2: { nick: '펑크 사람2', coins: 50, entered: 1, tut: { step: 99, done: true, v: 3 }, backs: 'abc' },
  style: { nick: '겉모습 사람', coins: 50, entered: 1, tut: { step: 99, done: true, v: 3 }, jeong: 1, clothes: { own: { 'hat:s-beanie': 1, 'hat:w-straw': 1, 'top:s-aloha': 1 }, wear: { hat: 'hat:s-beanie', top: 'top:s-aloha', vest: 'vest:s-nope' }, tint: { 'hat:s-beanie': 4, 'top:s-aloha': 2, 'hat:w-straw': 1, zz: 'x' } } }, // #179 겉모습 옷·이상한 색 번호
  // #98: 깨끗한 오름 기록 → 전투 오름으로 (장비·귤·치운 양 그대로, 랭킹 기록은 battle 에 더함)
  clean: { nick: '깨끗한 사람', coins: 4321, equip: { tool: 3, bag: 2, shoes: 1, weapon: 2 }, nsV1: 1, nsV2: 1, nsV3: 1, entered: 1, look: { sex: 'f', skin: 1 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, server: 'clean', srvSwitch: 1,
    trash: { total: 900, srv: { clean: { sig: 'old', heaps: [0, 0] } }, bag: { can: 2 }, rk: { d: 0, w: 0, day: { clean: 5, battle: 1 }, week: { clean: 50, battle: 10 }, all: { clean: 800, battle: 100 } } } },
  // #206: 가게 열림 기록이 깨진 저장 · 가게를 쓴 적 있는 옛 저장(구역 1 끝·미장원·LEAP 써 봄 → 그 가게들은 처음부터 열림)
  shopBad: { nick: '가게 사람', coins: 50, entered: 1, tut: { step: 99, done: true, v: 3 }, jeong: 1, shopGate: { open: { stone: 'x', nope: 1, gear: 1 }, init: 'q', full: 'z' } },
  shopVet: { nick: '단골', coins: 500, entered: 1, tut: { step: 99, done: true, v: 3 }, jeong: 1, equip: { tool: 3, bag: 2, shoes: 1, weapon: 1 }, boss: { done: { 1: 1 } }, ach: { life: { haircut: 1, 'clothes-buy': 2, meal: 1 } } },
  // #140: 깨진 재료·등급·강화·안 쓰는 장비 · 예전 우두머리 귀한 재료(이름)는 재료 주머니로
  loot: { nick: '전리품 사람', coins: 90, entered: 1, tut: { step: 99, done: true, v: 3 }, equip: { tool: 2, bag: 1, shoes: 1, weapon: 2 }, mats: { m1: -3, zz: 5, m2: 'x', m3: 4 }, gearUp: { tool: { g: 9, e: 7 }, foo: 1, bag: 'x' }, clothes: { own: {}, wear: {}, up: 'x' }, loot: [{ s: 'tool', t: 99 }, 5, { s: 'hat', t: 2, g: 1, e: 2 }, { s: 'weapon', t: 2, g: 2, e: 0 }], lootAuto: 'q', boss: { mats: { '대장 들개 이빨': 2 }, done: {}, beat: {}, log: {} } },
  // #219: 장비를 다 강화한 뒤 '강화 한 번' 이 걸린 저장 · 도구·배낭이 끝 단계인데 '집게나 배낭 한 칸 올리기' 가 걸린 저장 → 불러오면 끝나고 보상 한 번
  upMax: { nick: '강화 끝', coins: 100, entered: 1, tut: { step: 99, done: true, v: 3 }, jeong: 1, equip: { tool: 2, bag: 1, shoes: 1, weapon: 2 }, gearUp: { tool: { g: 0, e: 5 }, bag: { g: 0, e: 5 }, shoes: { g: 0, e: 5 }, weapon: { g: 0, e: 5 } },
    clothes: { own: {}, wear: {}, up: { 'hat:w-cap': { g: 0, e: 5 }, 'top:w-tee': { g: 0, e: 5 }, 'bottom:w-shorts': { g: 0, e: 5 } } },
    boss: { done: { 1: 1, 2: 1, 3: 1 } }, quest: { v: 1, cur: null, done: ['g-tool', 'g-bag', 'g-arm'], side: { 'g-up': { base: { upgrade: 35 }, r: 0 } }, cp: {}, c: { upgrade: 35 } } },
  upOld: { nick: '강화 셈 없음', coins: 100, entered: 1, tut: { step: 99, done: true, v: 3 }, jeong: 1, equip: { tool: 2, bag: 1, shoes: 1, weapon: 2 }, gearUp: { tool: { g: 0, e: 5 }, weapon: { g: 0, e: 2 } },
    quest: { v: 1, cur: null, done: ['g-tool', 'g-bag', 'g-arm'], side: { 'g-up': { base: {}, r: 0 } }, cp: {}, c: {} } },
  gearMax: { nick: '장비 끝', coins: 100, entered: 1, tut: { step: 99, done: true, v: 3 }, jeong: 1, equip: { tool: 99, bag: 99, shoes: 1, weapon: 1 }, quest: { v: 1, cur: { id: 'gear1', base: { gearTB: 99 }, r: 0 }, done: ['can', 'heap1', 'dump2', 'piglet3'], side: {}, cp: {}, c: {} } },
  // #125: 예전 '오늘의 업적 5개' 기록 · 깨진 이어 오기
  dailyOld: { nick: '예전 업적', coins: 10, entered: 1, tut: { step: 99, done: true, v: 3 }, jeong: 1, ach: { daily: { date: '2026-11-21', items: [{ id: 'd-trash-50', prog: 9, done: false, claimed: false }, { id: 'd-sit', prog: 1, done: true, claimed: false }] }, life: { trash: 5 }, badges: {}, allDays: 2, lastAll: '2026-11-19' } },
  dailyBad: { nick: '깨진 할 일', coins: 10, entered: 1, tut: { step: 99, done: true, v: 3 }, jeong: 1, ach: { daily: { date: 7, items: [null, 3, { id: 't-photo', prog: 'x' }] }, run: { n: 'q', last: [], got: 'x' }, life: {}, badges: {} } },
  // #202: 옛 경험치(#159 곡선) 레벨 13·증강 12개 → 번 귤 경험치로 바꿔도 레벨 13 이상·증강 그대로 · 기록이 많은 옛 저장은 기록으로 어림
  lvOld13: { nick: '옛 레벨', coins: 10, tut: { step: 99, done: true, v: 3 }, jeong: 1, lv: { xp: OLD_XP(13) + 5, aug: { recycle: 3, bighand: 3, twin: 3, burst: 3 }, draw: null, rr: 0, old: 1 }, journey: { step: 3, seen: { level: '2026-01-01' } }, ach: { life: { earn: 100 }, badges: {} } },
  lvOldRich: { nick: '옛 부자', coins: 10, tut: { step: 99, done: true, v: 3 }, jeong: 1, lv: { xp: OLD_XP(5), aug: { recycle: 1 }, draw: null, rr: 0, old: 1 }, journey: { step: 3, seen: { level: '2026-01-01' } }, ach: { life: { earn: 120000, pickup: 30000 }, badges: {} } },
  tutStall: { nick: '좌판 사람', coins: 30, nsV1: 1, nsV2: 1, nsV3: 1, bagV: 1, entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 9, done: false, v: 4, gyul: [0, 1, 2], hits: 3 }, equip: { tool: 1, bag: 0, shoes: 0, weapon: 1 } }, // #221 들머리 좌판 배낭 단계에 멈춘 저장 → 장비점 가기 처음, 가게 쪽 정낭·장비점 열림
  tubeBad: { nick: '깨진 관', coins: 10, entered: 1, tut: { step: 99, done: true, v: 3 }, jeong: 1, recycle: { visits: 2 }, tube: [3, 'nope', 'gate', 'gate', null] }, // #248 깨진 수거 관 목록
  tubeOld: { nick: '옛 관', coins: 10, entered: 1, tut: { step: 99, done: true, v: 3 }, jeong: 1, recycle: { visits: 5 }, journey: { step: 3, maxZ: 3, seen: {} } }, // #248 save.tube 없는 옛 저장
  lvBad: { nick: '깨진 레벨', coins: 10, tut: { step: 99, done: true, v: 3 }, jeong: 1, lv: { xp: 'x', aug: { nope: 9, twin: 99, burst: -1 }, draw: [1, 2], rr: 'y' }, journey: { step: 3, seen: { level: '2026-01-01' } } }, // #159 깨진 레벨·증강
  // #247: 깨진 노루 친구 기록 · 이름만 있는 내 노루 (사귄 무리 노루 이름이 없는 맵)
  deerBad: { nick: '노루 깨짐', coins: 10, tut: { step: 99, done: true, v: 3 }, jeong: 1, deerPal: { n: 5, id: 7, fed: 'x', hg: 'q', sd: 'y', f: [1, 2] } },
  deerName: { nick: '노루 이름', coins: 10, tut: { step: 99, done: true, v: 3 }, jeong: 1, deerPal: { n: '보리', id: 'h999', fed: 40, hg: 2, sd: 1, open: 1, f: { h1: 2 } } },
};
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  let bad = 0;
  for (const [name, data] of Object.entries(SAVES)) { if (process.argv[2] && !process.argv[2].split(',').includes(name)) continue; // node tools/oldsave.js 이름,이름
    const ctx = await b.newContext({ viewport: { width: 480, height: 300 } }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
    await p.addInitScript((d) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', 1); localStorage.setItem('oreumoreum.dev', d); localStorage.setItem('oreumoreum.v1', d); } }, JSON.stringify(data));
    await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await p.waitForTimeout(8000);
    await p.click('#enter', { timeout: 30000 }).catch(() => {}); await p.waitForTimeout(800);
    await p.waitForTimeout(5000);
    if (await p.evaluate(() => !document.getElementById('look').hidden).catch(() => false)) { await p.click('#look-ok').catch(() => {}); await p.waitForTimeout(1500); }
    const st = await p.evaluate(() => { const o = window.__oreum; return { frames: o.renderer.info.render.frame, coins: o.save.coins, equip: o.save.equip, tut: o.save.tut?.step, ls: !!o.save.lastSeen, expMsg: !document.getElementById('intro-expired').hidden, g: document.getElementById('guest-days').textContent, srv: o.save.server, slots: Object.keys(o.save.trash?.srv || {}), total: o.save.trash?.total, rkAll: o.save.trash?.rk?.all, mats: o.save.mats, up: o.save.gearUp, nloot: o.save.loot?.length, step: !document.querySelector('#intro-step, #intro-srv, #srv-go, #menu-server'), qnext: o.quest?.api.mainNext()?.id, qdone: o.save.quest?.done?.length }; }).catch((e) => ({ fail: e.message.slice(0, 120) }));
    await p.waitForTimeout(2000);
    const f2 = await p.evaluate(() => window.__oreum.renderer.info.render.frame).catch(() => -1);
    console.log(name, JSON.stringify(st), 'frames+', f2 - (st.frames || 0), errs.length ? 'ERR ' + errs.join(' | ') : 'ok');
    if (errs.length || st.fail || !(f2 > (st.frames || 0))) bad++;
    if (!st.step || (st.srv && st.srv !== 'battle')) { bad++; console.log(name, '서버 고르기 흔적·clean 이 남음'); }
    if (name === 'style') { const c = await p.evaluate(() => ({ g: window.__oreum.save.outfit.gear.hat, t: window.__oreum.save.clothes.tint, w: window.__oreum.save.clothes.wear })).catch(() => ({})); if (!(c.g === 'hat:s-beanie~4' && Object.keys(c.t || {}).join() === 'hat:s-beanie' && !c.w?.vest)) { bad++; console.log(name, '겉모습 옷 저장 바로잡기 실패', JSON.stringify(c)); } } // #179
    if (name.startsWith('tube')) { const L = await p.evaluate(() => window.__oreum.tube.linked()).catch(() => null); /* #248 깨진 목록은 아는 id 하나씩만, 옛 저장은 지난 구역(3)까지 */
      const want = name === 'tubeBad' ? JSON.stringify(L) === '["gate"]' : !!(L && L.includes('gate') && L.includes('rest') && !L.includes('crater'));
      if (!want) { bad++; console.log(name, '수거 관 목록 실패', JSON.stringify(L)); } else console.log(name, '수거 관', JSON.stringify(L)); }
    if (name.startsWith('lvOld')) { const L = await p.evaluate(() => { const o = window.__oreum; return { ...o.level.state(), v: o.save.lv.v }; }).catch(() => ({}));
      const want = name === 'lvOld13' ? (L.lv >= 13 && L.aug.recycle === 3 && L.aug.burst === 3 && Object.keys(L.aug).length === 4) : (L.lv >= 12 && L.aug.recycle === 1); /* 부자: 번 귤 15만 → 레벨 12 이상 (#202 곡선) */
      if (!(want && L.v === 2)) { bad++; console.log(name, '옛 레벨 바꾸기 실패', JSON.stringify({ lv: L.lv, xp: L.xp, aug: L.aug, v: L.v })); } else console.log(name, `레벨 ${L.lv} · 경험치(번 귤) ${L.xp} · 증강 ${JSON.stringify(L.aug)}`); }
    if (name === 'shopVet' || name === 'shopBad') { const g = await p.evaluate(() => { const o = window.__oreum.shopGate; return Object.fromEntries(['gear', 'manjok', 'stone', 'salon', 'leap', 'ride'].map((id) => [id, o.isOpen(id)])); }).catch(() => ({}));
      const want = name === 'shopVet' ? g.gear && g.stone && g.salon && g.leap && !g.ride : g.gear && !g.ride; /* #206 */
      if (!want) { bad++; console.log(name, '옛 저장 가게 열기 실패', JSON.stringify(g)); } else console.log(name, '가게', JSON.stringify(g)); }
    if (name === 'upOld') { const q = await p.evaluate(() => { const o = window.__oreum; return { ready: o.quest.api.ready('g-up'), c: o.save.quest.c.upgrade }; }).catch(() => ({}));
      if (!(q.ready && q.c === 7)) { bad++; console.log(name, '옛 강화 셈 채우기 실패', JSON.stringify(q)); } else console.log(name, '옛 강화 셈', JSON.stringify(q)); }
    if (name === 'upMax' || name === 'gearMax') { await p.waitForTimeout(1500); const q = await p.evaluate(() => { const o = window.__oreum, s = o.save.quest; return { done: s.done, side: Object.keys(s.side), cur: s.cur?.id || null, cp: s.cp, coins: o.save.coins, cap: o.quest.cap('upgrade'), tb: o.quest.cap('gearTB'), eq: o.save.equip }; }).catch((e) => ({ e: String(e) }));
      const want = name === 'upMax' ? q.done?.includes('g-up') && !q.side?.includes('g-up') && q.cp?.gear === 1 : q.done?.includes('gear1') && q.cur !== 'gear1'; /* #219 받은 퀘스트가 끝나고 다음 줄이 열림 */
      if (!want) { bad++; console.log(name, '더 채울 수 없는 퀘스트 풀기 실패', JSON.stringify(q)); } else console.log(name, '퀘스트 풀림', JSON.stringify({ done: q.done.slice(-2), cur: q.cur, cp: q.cp, coins: q.coins })); }
    if (name === 'tutStall') { const t = await p.evaluate(() => { const o = window.__oreum; return { s: o.save.tut.step, v: o.save.tut.v, step: o.tut.step, sg: o.tut.shopGate()?.open, gear: o.shopGate.isOpen('gear'), stall: o.cleanhouse.api.mark.visible }; }).catch(() => ({}));
      if (!(t.s === 8 && t.v === 5 && t.step === 'tongs' && t.sg && t.gear && !t.stall)) { bad++; console.log(name, '좌판 단계 옮기기 실패', JSON.stringify(t)); } else console.log(name, '장비점 단계', JSON.stringify(t)); }
    if (name === 'questVet' && st.qnext !== 'heap3') { bad++; console.log(name, '옛 저장 퀘스트 건너뛰기 실패', st.qnext); } // #158
    if (name === 'clean' && !(st.coins === 4321 && st.equip.tool === 3 && st.equip.weapon === 2 && st.total === 900 && st.slots.join() === 'battle' && st.rkAll?.battle === 900 && !('clean' in st.rkAll))) { bad++; console.log(name, '옮기기 실패'); }
    if (name === 'loot' && !(st.mats?.r2 === 2 && st.mats?.m3 === 4 && !('m1' in st.mats) && !('zz' in st.mats) && st.up?.tool?.g === 3 && st.up.tool.e === 5 && st.nloot <= 2)) { bad++; console.log(name, '전리품 저장 바로잡기 실패'); }
    await ctx.close();
  }
  console.log(bad ? `문제 ${bad}` : '모두 통과'); await b.close();
})();
