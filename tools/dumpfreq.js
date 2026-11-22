// 투기꾼 평소 빈도 (#260): src/pacing.js 를 node 에서 돌려 10분에 투기꾼이 몇 번 오는지 3번(시드) 잰다. node tools/dumpfreq.js [dumpEvery 덮어쓰기]
// 플레이어는 흉내: 공격이 시작되면 15초 뒤 모두 쫓아냄. 시간당 쓰레기 양(perHour)은 DUMP_PER_HOUR 그대로라 한 번의 양은 자동으로 줄거나 늚
(async () => {
  const path = require('path');
  const { createPacing } = await import(path.join(__dirname, '../src/pacing.js'));
  const { PACE } = await import(path.join(__dirname, '../src/balance.js'));
  globalThis.__DEV__ = false; const { DUMP_PER_HOUR } = await import(path.join(__dirname, '../src/dumpers.js'));
  if (process.argv[2]) PACE.battle.dumpEvery = +process.argv[2];
  const mul32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = [];
  for (const seed of [1, 2, 3]) {
    const rnd = mul32(seed * 7919); let n = 0, amt = 0, th = 0, atkAt = -1, now = 0, dumps = 0, trash = 0;
    const P = createPacing({ rnd, first: { done: true, bloomed: true }, perHour: DUMP_PER_HOUR, hooks: {
      busy: () => false, threats: () => th,
      omen: (plan) => { dumps += plan.dumpers.length; for (const d of plan.dumpers) trash += d.amt; return true; },
      attack: () => { th = 1; atkAt = now; return { n: 1, eta: 10 }; },
      forceEnd: () => { th = 0; }, end: () => {}, firstDone: () => {}, delight: () => false } });
    const DT = 0.25;
    for (now = 0; now < 600; now += DT) { P.update(DT); if (th && now - atkAt > 15) { th = 0; P.note('repel'); } }
    out.push({ seed, dumpers10min: dumps, trashPerHour: Math.round(trash * 6) });
  }
  console.log(`dumpEvery=${PACE.battle.dumpEvery} 평균 ${(out.reduce((a, o) => a + o.dumpers10min, 0) / 3).toFixed(1)}회/10분`, JSON.stringify(out));
})();
