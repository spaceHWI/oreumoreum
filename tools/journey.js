// 감독 확인 (#176): 새로 시작해 30분을 자동으로 돌리고 '몇 분에 무엇이 떴는지' 시간표를 뽑는다
// src/director.js·src/pacing.js·src/tips.js 를 그대로 돌리고, 플레이어와 아직 없는 시스템(퀘스트·레벨·동료·혼잣말·방송 등)은 흉내 낸다
//   플레이어: 0~1분 첫 화면·이름, 1~7분 튜토리얼(감독은 기다림), 그 뒤 더미 줍기(20~50초) → 가득 차면 버리러(30초) → 가끔(35%) 할 일을 잃음
//             할 일을 잃으면 감독이 말을 걸 때까지(또는 스스로 20~150초 뒤) 서 있음. 공격(pacing)이 오면 싸움
// 확인: ① 두 안내가 겹쳐 뜬 적 0 ② 낮은 것은 높은 것 뒤 JOURNEY.gap 초 ③ 싸우는 중엔 앞 3개만 ④ 60초 넘게 아무 안내 없이 할 일이 없던 구간 0 ⑤ 하루 소개 JOURNEY.perDay 개 이하
// node tools/journey.js              시간표 + 확인 (흉내 시스템 포함)
// node tools/journey.js --now        지금 게임에 있는 것만 (팁·첫 투기꾼·우두머리·구역 완료·실마리)
// node tools/journey.js --seeds 30   여러 번 돌려 최악값
// node tools/journey.js --old        옛 저장(튜토리얼 끝, journey 없음)으로 시작: 문이 조용히 한꺼번에 열리는지
const path = require('path');
(async () => {
  const { createDirector, PRIO } = await import(path.join(__dirname, '../src/director.js'));
  const { createPacing } = await import(path.join(__dirname, '../src/pacing.js'));
  const { createTips } = await import(path.join(__dirname, '../src/tips.js'));
  const { JOURNEY, PACE, DUMP, BUDDIES } = await import(path.join(__dirname, '../src/balance.js'));
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1] ?? true; };
  const seeds = +arg('--seeds', 1), MIN = +arg('--min', 30), DT = 0.25, NOW = process.argv.includes('--now'), OLD = process.argv.includes('--old');
  const mul32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const mm = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  function run(seed) {
    const rnd = mul32(seed * 7919 + 3), prnd = mul32(seed * 31 + 5);
    let now = 0;
    const save = OLD ? { tut: { done: true }, jeong: 1, trash: { total: 420 }, recycle: { visits: 12 }, pace: { first: 1, bloomed: 1 }, boss: { done: { 1: 1 } } } : { tut: { done: false }, trash: { total: 0 }, recycle: { visits: 0 }, pace: {} };
    const F = { babies: 0, fieldQuest: 0, zone: OLD ? 2 : 1, night: 0 };
    const tutEnd = OLD ? 0 : 60 + 300 + prnd() * 60;
    const P = { task: OLD ? 'pick' : 'title', taskEnd: OLD ? 30 : 60, lostSince: -1, bag: 0, heapPick: 0, nextBloom: 0 };
    const shows = []; // { t, end, kind, id }
    const lost = []; // { a, b } 할 일이 없던 구간
    let fightNow = false;
    const D = createDirector({
      save, persist: () => {}, today: () => '2026-11-21',
      hooks: {
        facts: () => ({ tut: save.tut.done ? 1 : 0, jeong: save.jeong ? 1 : 0, picked: save.trash.total, dumps: save.recycle.visits, bloomed: save.pace.bloomed ? 1 : 0, attacked: save.pace.first ? 1 : 0, zonesDone: Object.keys(save.boss?.done || {}).length, ...F }),
        busy: () => P.task === 'tut' || P.win > now, // 첫 화면에서는 이름·옷 색 창이 나감
        fight: () => fightNow,
        log: (e) => {
          if (e.ev === 'show') shows.push({ t: e.t, end: Infinity, kind: e.kind, id: e.id });
          if (e.ev === 'end' || e.ev === 'cut') { const s = shows.findLast((x) => x.id === e.id && x.end === Infinity); if (s) { s.end = e.t; s.cut = e.ev === 'cut'; } }
        },
      },
    });
    // 지금 있는 것
    D.register({ id: 'tips' }); D.register({ id: 'dumper' }); D.register({ id: 'boss' }); D.register({ id: 'zoneDone' });
    D.register({ id: 'heapHint', kind: 'mutter', clue: () => D.isOpen('tips') && D.can('mutter') && D.ask('mutter', 'heapHint', () => { P.hinted = now; }, { sec: 3.2, queue: false }) });
    // 아직 없는 것 (흉내): 등록하면 문이 열리고 intro 가 감독을 거침
    if (!NOW) {
      const win = (s) => () => { P.win = now + s; }; // 창: 닫힐 때까지 바쁨
      D.register({ id: 'name', kind: 'quest', intro: win(8), sec: 8 }); D.register({ id: 'color', kind: 'quest', intro: win(6), sec: 6 });
      if (BUDDIES.on !== false) D.register({ id: 'mateSunja', kind: 'mate', intro: () => {} }); // #190 동료가 꺼져 있으면 문 없음
      D.register({ id: 'quest', kind: 'quest', intro: () => { P.hinted = now; }, sec: 5 });
      D.register({ id: 'heapNear' });
      D.register({ id: 'shopQuest', kind: 'quest', intro: () => { P.hinted = now; }, sec: 5 });
      D.register({ id: 'level', kind: 'level', intro: win(5), sec: 5 });
      D.register({ id: 'storyMom', kind: 'story', intro: () => {}, sec: 4 });
      D.register({ id: 'field', kind: 'intro', intro: () => {} });
      if (BUDDIES.on !== false) D.register({ id: 'mateMinsu', kind: 'mate', intro: () => {} });
      D.register({ id: 'nightLight', kind: 'story', intro: () => {} });
      D.register({ id: 'radio', kind: 'radio', intro: () => {} });
      // 혼잣말 실마리: 한가하면 퀘스트 화살표보다 먼저 한 줄 (#169 자리)
      D.register({ id: 'mutterClue', kind: 'mutter', clue: () => D.isOpen('quest') && D.can('mutter') && D.ask('mutter', 'mutter:' + Math.floor(now), () => { P.hinted = now; }, { sec: 3, queue: false }) });
    }
    const tips = createTips({ save, persist: () => {}, show: (tip) => D.begin('tip', 'tip:' + tip.id, 4), today: () => '2026-11-21', rnd });
    // 공격 (src/pacing.js 그대로)
    let threats = [];
    const pacing = createPacing({
      rnd, first: { done: !!save.pace.first, bloomed: !!save.pace.bloomed }, perHour: 1000 * DUMP.hourFrac * 3,
      hooks: {
        busy: () => P.task === 'tut' || P.task === 'title',
        threats: () => threats.filter((x) => !x.done).length,
        omen: (plan) => { if (plan.first && D.isOpen('dumper')) D.ask('danger', 'guide:come', () => {}, { sec: 3, ttl: 6 }); else D.ask('danger', 'wave', () => {}, { sec: 2.8, ttl: 4 }); return true; },
        attack: (plan) => { const n = plan.mob ? 2 + Math.floor(prnd() * 2) : plan.dumpers.length; const eta = 20 + prnd() * 30; threats = Array.from({ length: n }, () => ({ at: now + 5 + prnd() * 25, ok: prnd() < 0.85, done: false })); return { n, eta }; },
        forceEnd: () => threats.forEach((x) => { x.done = true; }),
        end: (info) => { if (info.first && D.isOpen('dumper')) D.ask('danger', 'guide:good', () => {}, { sec: 3, ttl: 6 }); },
        firstDone: () => { save.pace.first = 1; },
        delight: () => true,
      },
    });
    let bossAt = OLD ? 9e9 : 22 * 60 + prnd() * 120, beatAt = Infinity, radioAt = 8 * 60, mateAt = 0;
    for (now = 0; now < MIN * 60; now += DT) {
      fightNow = pacing.phase === 'omen' || pacing.phase === 'tense' || (bossAt === 9e9 && beatAt < Infinity); // 우두머리와 싸우는 중도
      // ----- 플레이어 흉내 -----
      if (P.task === 'title' && now >= P.taskEnd) { P.task = 'tut'; P.taskEnd = tutEnd; }
      if (P.task === 'tut' && now >= P.taskEnd) { save.tut.done = true; save.jeong = 1; P.task = 'pick'; P.taskEnd = now + 20 + prnd() * 30; D.note('act'); }
      if (P.task === 'pick') {
        D.note('act'); P.bag += DT * 0.4; P.heapPick += DT;
        if (P.heapPick > 70 + prnd() * 60) { P.heapPick = 0; save.pace.bloomed = 1; pacing.note('bloom'); tips.event('heapClear'); }
        if (now >= P.taskEnd) { save.trash.total += Math.round(P.bag); if (P.bag > 14) { P.task = 'dump'; P.taskEnd = now + 30; } else if (prnd() < 0.35) { P.task = 'lost'; P.lostSince = now; P.selfAt = now + 20 + prnd() * 130; P.hinted = -1; } else P.taskEnd = now + 20 + prnd() * 30; }
      } else if (P.task === 'dump') {
        D.note('act');
        if (now >= P.taskEnd) { P.bag = 0; save.recycle.visits++; if (prnd() < 0.35) { P.task = 'lost'; P.lostSince = now; P.selfAt = now + 20 + prnd() * 130; P.hinted = -1; } else { P.task = 'pick'; P.taskEnd = now + 20 + prnd() * 30; } }
      } else if (P.task === 'lost') {
        if (fightNow) D.note('act'); // 싸우면 할 일이 생긴 것
        const told = P.hinted >= P.lostSince || shows.some((s) => s.t >= P.lostSince && s.end > now - 3 && s.t <= now);
        if (fightNow || told || now >= P.selfAt) { lost.push({ a: P.lostSince, b: now }); P.task = 'pick'; P.taskEnd = now + 3 + prnd() * 5 + 20 + prnd() * 30; P.lostSince = -1; }
      }
      for (const x of threats) if (!x.done && now >= x.at) { x.done = true; if (x.ok) { pacing.note('repel'); F.babies++; } }
      if (!NOW && now >= 25 * 60 && !F.fieldQuest) F.fieldQuest = 1; // 퀘스트 '들판 탐사'
      // 우두머리 (구역 80%) → 쫓아냄 → 하르방·구역 완료 창
      if (now >= bossAt) { bossAt = 9e9; D.ask('danger', 'bossCome', () => {}, { sec: 3.2, ttl: 8 }); beatAt = now + 90 + prnd() * 60; }
      if (now >= beatAt) { beatAt = Infinity; save.boss = { done: { 1: 1 } }; D.ask('quest', 'bossBeat', () => {}, { sec: 3.4, ttl: 8 }); P.summaryAt = now + 8; }
      if (P.summaryAt && now >= P.summaryAt && D.can('quest')) { P.summaryAt = 0; D.begin('quest', 'zoneSummary', 6); }
      // 흉내: 동료 대사·방송은 가끔 스스로 말을 걸려 함 (낮은 차례)
      if (!NOW && D.isOpen('mateSunja') && now >= mateAt) { mateAt = now + 90 + prnd() * 90; D.ask('mate', 'sunja:' + Math.floor(now), () => {}, { sec: 3, ttl: 20 }); }
      if (!NOW && D.isOpen('radio') && now >= radioAt) { radioAt = now + 240; D.ask('radio', 'radio:' + Math.floor(now), () => {}, { sec: 4, ttl: 60 }); }
      // ----- 시스템 -----
      tips.update(DT, () => ({ busy: P.task === 'tut' || P.task === 'title' || !D.isOpen('tips') || !D.can('tip') || !pacing.canTip(), bagFull: P.task === 'dump', bagTier: 1, canBuy: save.recycle.visits === 2, enemyNear: fightNow, hasBow: false, hpLow: false, stoneFree: false, nearStream: false, idle: 0 }));
      pacing.update(DT);
      D.tick(DT);
    }
    if (P.task === 'lost') lost.push({ a: P.lostSince, b: now });
    shows.forEach((s) => { if (s.end === Infinity) s.end = now; });
    // ----- 확인 -----
    const bad = [];
    for (let i = 1; i < shows.length; i++) {
      const a = shows[i - 1], b = shows[i];
      if (b.t < a.end - 1e-6 && !a.cut) bad.push(`${mm(b.t)} 겹침 ${a.id} / ${b.id}`);
      if (!a.cut && PRIO[b.kind] > PRIO[a.kind] && b.t - a.end < JOURNEY.gap - 1e-6) bad.push(`${mm(b.t)} 간격 ${(b.t - a.end).toFixed(1)}초 ${a.id} → ${b.id}`);
      if (a.cut && !(PRIO[b.kind] < JOURNEY.preempt && PRIO[b.kind] < PRIO[a.kind])) bad.push(`${mm(b.t)} 끊음 ${a.id} ← ${b.id}`);
    }
    // 싸우는 중 낮은 것: 시작 시각의 싸움 여부는 기록이 없으니 다시 계산하지 않고 감독 규칙(can)이 막는지만 본다 (단위 확인은 아래)
    const idleBad = lost.filter((l) => { // 그 구간 안에서 60초 넘게 아무 안내도 없던 때
      const marks = [l.a, ...shows.filter((s) => s.t > l.a && s.t < l.b).map((s) => s.t), l.b];
      return marks.some((m, i) => i > 0 && m - marks[i - 1] > 60);
    });
    idleBad.forEach((l) => bad.push(`${mm(l.a)}~${mm(l.b)} 할 일 없이 ${Math.round(l.b - l.a)}초`));
    const j = save.journey; if ((j.n | 0) > JOURNEY.perDay) bad.push(`하루 소개 ${j.n}개`);
    return { shows, lost, bad, j, log: D.log, opened: D.log.filter((e) => e.ev === 'open' || e.ev === 'open-quiet') };
  }

  // 단위 확인: 싸우는 중·우선순위·끊기·하루 개수
  function unit() {
    const out = [], save = { tut: { done: true }, jeong: 1 };
    let fight = false, busy = false;
    const D = createDirector({ save, hooks: { fight: () => fight, busy: () => busy, facts: () => ({ tut: 1, jeong: 1, dumps: 5, attacked: 1, bloomed: 1, days: 3, zonesDone: 1, picked: 99, night: 1, zone: 4, babies: 9, fieldQuest: 1 }) } });
    const ok = (c, m) => { out.push((c ? 'ok   ' : 'FAIL ') + m); return c; };
    fight = true;
    ok(!D.ask('tip', 't1', null, { ttl: 30 }), '싸우는 중 팁은 미룸');
    ok(!D.ask('mutter', 'm1', null, { ttl: 5 }), '싸우는 중 혼잣말은 미룸');
    ok(D.ask('quest', 'q1', null, { sec: 2 }), '싸우는 중에도 퀘스트 창은 나감');
    ok(D.ask('danger', 'd1', null, { sec: 1 }), '위험 알림은 퀘스트를 끊고 바로');
    ok(D.cur.id === 'd1', '지금은 위험 알림');
    D.tick(1.1); ok(!D.cur, '위험 알림 끝');
    fight = false; D.tick(0.5); ok(!D.cur, `같은/높은 것도 ${JOURNEY.quick}초 뒤`);
    D.tick(1); ok(!D.cur || D.cur.kind === 'tip', '팁은 높은 것 뒤 4초 동안 안 나감 (1.5초)');
    D.tick(3); ok(D.cur?.id === 't1', '4초 뒤 미룬 팁이 나감');
    D.tick(4); D.tick(5); ok(!D.state().waiting.some((w) => w.id === 'm1'), '오래 기다린 혼잣말은 버림(ttl)');
    busy = true; ok(!D.ask('tip', 't2', null, { ttl: 1 }), '바깥 창이 열려 있으면 팁 미룸'); ok(D.ask('danger', 'd2', null, { sec: 1 }), '바깥 창이 있어도 위험 알림'); busy = false; D.tick(5);
    // 하루 개수: 소개(count) 문을 많이 등록
    const ids = JOURNEY.doors.filter((d) => d.count).map((d) => d.id);
    ids.forEach((id) => D.register({ id, intro: () => {} }));
    for (let i = 0; i < 200; i++) D.tick(1);
    ok((save.journey.n | 0) === JOURNEY.perDay, `하루 소개 ${save.journey.n}개 (${JOURNEY.perDay}개까지, 나머지는 내일)`);
    ok(D.state().next.length === ids.length - JOURNEY.perDay, `남은 문 ${D.state().next.length}개`);
    return out;
  }

  const u = unit(); u.forEach((l) => console.log(l));
  let fails = u.filter((l) => l.startsWith('FAIL')).length;
  let worst = null;
  for (let s = 1; s <= seeds; s++) { const r = run(s); if (!worst || r.bad.length > worst.bad.length) worst = { ...r, seed: s }; fails += r.bad.length; if (s === 1) {
    console.log(`\n시간표 (씨앗 1, ${MIN}분${NOW ? ', 지금 있는 것만' : ''}${OLD ? ', 옛 저장' : ''})`);
    const opened = r.opened.map((e) => `${mm(e.t)} 문 ${e.id}${e.ev === 'open-quiet' ? '(조용히)' : ''}`);
    const lines = [...opened.map((l) => [parseInt(l) * 60 + +l.slice(3, 5), l]), ...r.shows.map((x) => [x.t, `${mm(x.t)} ${x.kind.padEnd(6)} ${x.id}${x.cut ? ' (끊김)' : ''} ${(x.end - x.t).toFixed(1)}초`])].sort((a, b) => a[0] - b[0]);
    lines.forEach(([, l]) => console.log('  ' + l));
    const lostLong = r.lost.map((l) => l.b - l.a);
    console.log(`할 일을 잃은 때 ${r.lost.length}번, 가장 긴 ${Math.round(Math.max(0, ...lostLong))}초 · 오늘 소개 ${r.j.n}개 · 열린 문 ${Object.keys(r.j.seen).length}개`);
  } }
  if (worst?.bad.length) { console.log(`\n문제 (씨앗 ${worst.seed})`); worst.bad.forEach((b) => console.log('  ' + b)); }
  console.log(`\n겹침·간격·할 일 없음 위반 ${fails}건 (${seeds}번)`);
  if (fails) process.exitCode = 1;
})();
