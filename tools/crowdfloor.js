// 바닥 보장 확인 (#300): node tools/crowdfloor.js [--pick 0.83] [--min 5]
// 방(server/src/roomcore.js)을 Node 에서 가짜 시계로 돌려, 여러 명이 한 구역에 몰려 쉬지 않고 주울 때 남은 쓰레기가 바닥 아래로 오래 머무는지 본다
// 가정 (어림): 한 사람이 1초에 --pick 개(기본 0.83 = 1시간 3000개, tools/crowd.js 와 같음), 자기 더미가 비면 같은 구역 남은 더미로 옮김.
//   투기꾼·트럭이 쌓는 몫은 셈하지 않음(바닥 보장만으로 버티는지). 사람마다 지금 줍는 더미와 그다음 더미를 '가까이(nh)' 로 알림
// 기준: 누구든 20초 안에 주울 것을 찾음 = 구역 남은 수가 0 인 채 20초를 넘기지 않음, 바닥(목표)의 절반 아래로 20초 넘게 머물지 않음
const path = require('path');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : +process.argv[i + 1]; };
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
(async () => {
  const imp = (f) => import(path.join(__dirname, '..', f));
  const { DUMP } = await imp('src/balance.js');
  const { HEAP_DEFS, HEAP_FULL } = await imp('src/heapdefs.js');
  const { createRoomCore } = await imp('server/src/roomcore.js');
  const F = DUMP.floor, PICK = arg('--pick', 0.83), MIN = arg('--min', 5);
  const HZ = HEAP_DEFS.map((d) => d.zone), ZFULL = {}; HEAP_DEFS.forEach((d, i) => { ZFULL[d.zone] = (ZFULL[d.zone] || 0) + HEAP_FULL[i]; });
  console.log('DUMP.floor', JSON.stringify(F), '· 구역 가득', JSON.stringify(ZFULL));

  // 한 판: groups [[구역, 사람 수, 튜토리얼?]…], start 처음 남은 비율, sec 길이. 반환 구역별 기록
  function run(groups, { start = 0.15, sec = MIN * 60, nearOn = true } = {}) {
    let T = 1e12; const now = () => T;
    const heaps = HEAP_FULL.map((n, i) => Math.round(n * start));
    const core = createRoomCore({ now, heaps, seen: T - 1000 });
    const inbox = []; const msg = (p, o) => core.message(p, JSON.stringify(o));
    const ppl = [];
    groups.forEach(([z, n, tu]) => { for (let k = 0; k < n; k++) { const p = core.join((s) => { if (s.startsWith('{"t":"zg"')) inbox.push(JSON.parse(s)); }, { acct: 'u' + ppl.length }); ppl.push({ p, z, tu: !!tu, h: -1, acc: 0, a: Math.random() * 6 }); } });
    const H = () => core.heaps(), zoneLeft = (z) => H().reduce((s, v, i) => s + (HZ[i] === z ? v : 0), 0);
    const zs = [...new Set(groups.map((g) => g[0]))], rec = {};
    zs.forEach((z) => { rec[z] = { zero: 0, zeroMax: 0, low: 0, lowMax: 0, min: 1e9, n: groups.filter((g) => g[0] === z && !g[2]).reduce((s, g) => s + g[1], 0), picked: 0 }; });
    let revivedNear = 0;
    for (let s = 0; s < sec; s++) {
      T += 1000;
      for (const q of ppl) {
        const left = H();
        if (q.h < 0 || left[q.h] <= 0) { const c = HEAP_FULL.map((_, i) => i).filter((i) => HZ[i] === q.z && left[i] > 0); q.h = c.length ? c[Math.floor(Math.random() * c.length)] : -1; }
        q.a += 0.9; const x = 100 * q.z + Math.cos(q.a) * 4, z0 = Math.sin(q.a) * 4;
        const nh = nearOn && q.h >= 0 ? [q.h, ...HEAP_FULL.map((_, i) => i).filter((i) => HZ[i] === q.z && i !== q.h).slice(0, 1)] : [];
        msg(q.p, { t: 'p', d: { x, z: z0, h: 0, zn: q.z, nh, ...(q.tu ? { tu: 1 } : {}) } });
        if (q.tu || q.h < 0) continue;
        q.acc += PICK; const n = Math.floor(q.acc); if (n > 0) { const before = H()[q.h]; msg(q.p, { t: 'take', h: q.h, n }); const got = before - H()[q.h]; q.acc -= n; rec[q.z].picked += got; }
      }
      const pre = H().slice();
      for (let k = 0; k < 10; k++) core.step();
      const near = new Set(); ppl.forEach((q) => { if (q.h >= 0) near.add(q.h); });
      H().forEach((v, i) => { if (pre[i] === 0 && v > 0 && near.has(i)) revivedNear++; });
      for (const z of zs) {
        const L = zoneLeft(z), r = rec[z], target = Math.min(r.n * F.perHead, Math.round(ZFULL[z] * F.maxFrac));
        r.min = Math.min(r.min, L);
        r.zero = L === 0 ? r.zero + 1 : 0; r.zeroMax = Math.max(r.zeroMax, r.zero);
        r.low = L < target * 0.5 ? r.low + 1 : 0; r.lowMax = Math.max(r.lowMax, r.low);
      }
    }
    return { rec, core, zg: inbox, revivedNear, left: zoneLeft };
  }
  const show = (name, R) => { for (const [z, r] of Object.entries(R.rec)) console.log(`  ${name} 구역${z} ${r.n}명: 최저 ${r.min} · 0 인 채 최대 ${r.zeroMax}초 · 바닥 절반 아래 최대 ${r.lowMax}초 · 주운 수 ${r.picked} · 지금 ${R.left(+z)}`); };

  // 1) 10명·30명이 구역 1·2 에 몰림 (거의 빈 데서 시작)
  for (const [name, g] of [['10명 구역1', [[1, 10]]], ['10명 구역1·2', [[1, 5], [2, 5]]], ['30명 구역1', [[1, 30]]], ['30명 구역1·2', [[1, 20], [2, 10]]]]) {
    const R = run(g); show(name, R);
    for (const [z, r] of Object.entries(R.rec)) ok(r.zeroMax <= 20 && r.lowMax <= 20, `${name}: 구역${z} 남은 수가 0 인 채(${r.zeroMax}초)·바닥 절반 아래(${r.lowMax}초) 20초를 넘기지 않음`);
    const st = R.core.floor(); ok(st.adds > 0, `${name}: 방이 채움 (${st.adds}개, ${st.ticks}번)`);
    ok(R.revivedNear === 0, `${name}: 사람이 줍고 있는 빈 더미를 눈앞에서 되살리지 않음 (${R.revivedNear})`);
  }
  // 2) 혼자는 그대로: 한 구역 1명이면 방이 채우지 않음 (구역이 달라 각자 1명인 2명도)
  { const R = run([[1, 1]]); ok(R.core.floor().adds === 0, `혼자: 바닥 보장 안 돎 (${R.core.floor().adds})`); }
  { const R = run([[1, 1], [2, 1]]); ok(R.core.floor().adds === 0, `구역마다 1명씩: 바닥 보장 안 돎 (${R.core.floor().adds})`); }
  // 3) 튜토리얼 중인 사람은 인원에서 뺌: 1명 + 튜토리얼 5명 → 안 돎
  { const R = run([[1, 1], [1, 5, true]]); ok(R.core.floor().adds === 0, `튜토리얼 중 5명은 셈하지 않음 (${R.core.floor().adds})`); }
  // 4) 깨끗함: 10명이 구역 1 을 계속 주우면 더미가 다 비지 않아도 '구역 가득' 만큼 주운 뒤 지킴이가 섬, 그 뒤에도 주울 것은 남음
  { const R = run([[1, 10]], { start: 1, sec: Math.ceil(ZFULL[1] / (10 * PICK)) + 120 }); const g = R.zg.filter((m) => m.z === 1);
    ok(g.length >= 1, `10명이 구역1 을 '가득' 만큼 주우면 지킴이가 섬 (zg ${g.length}번, 주운 수 ${R.rec[1].picked} ≥ ${ZFULL[1]})`); ok(R.rec[1].zeroMax <= 20, `지킴이가 선 뒤에도 주울 것이 남음 (0 인 채 최대 ${R.rec[1].zeroMax}초)`); }
  // 5) 사람이 모두 가까이 붙어 있어도(빈 더미는 안 되살림) 남은 더미가 조금씩 커져 버팀
  { const R = run([[2, 10]], { start: 0.3 }); show('10명 구역2 30%', R); ok(R.rec[2].zeroMax <= 20, `구역2 30% 에서 10명 (0 인 채 최대 ${R.rec[2].zeroMax}초)`); }
})();
