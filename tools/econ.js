// 귤 경제 계산 (#49, #53). 지금 src/balance.js 수치로 "하루 1시간씩" 플레이를 흉내 내 칸 10개(도구·배낭·신발·무기 + 옷 6칸) 도달 시각을 낸다
//   node tools/econ.js              깨끗한 오름 + 전투 오름, 효율·여유 25% 각각 하루 끝 표와 마지막 칸 시각
//   node tools/econ.js --table      칸·단계별 도달 시각 표까지
//   node tools/econ.js --log        구매 기록까지
//   node tools/econ.js --slack 0.4  여유 비율 하나만 (기본은 0 과 0.25 둘 다)
//   node tools/econ.js --chase 0.3  투기꾼을 쫓아내는 비율 (기본 0.5)
//   node tools/econ.js --live       dist/test.html 을 띄워 더미 자리를 다시 뽑아 tools/econ-map.json 에 저장 (먼저 node build.mjs)
// 가정 (모두 어림):
// - 하루 시작엔 오름 전체가 가득 (접속 안 한 시간 ≥ DUMP.offlineMaxH)
// - 한 번 나가기 = 클린하우스 → 구역 → 배낭이 찰 때까지 더미 돌며 줍기 → 클린하우스. 거리는 직선 × 1.15 (trash.estimate 와 같음)
// - 더미 사이 걷기 = 구역 더미를 가까운 것부터 한 바퀴 도는 거리 ÷ 쓰레기 수 × 주운 수
// - 구역 1 부터 차례로 다 치우고 다음 구역으로. 다 치우면 남은 쓰레기(투기꾼이 버린 것) 중 가장 낮은 구역
//   (--greedy: 구역 귤 ÷ 다 치우는 시간이 가장 큰 구역부터. 정상이 가깝고 더미가 몰려 있어 3일차부터 정상으로 감)
// - 클린하우스에 버릴 때마다 살 수 있는 것 중 (오름 전체를 한 번 치우는 귤/초가 늘어나는 양 ÷ 값) 이 가장 큰 것부터 삼
// - 옷 6칸 (#52): 모자(드문 것 확률)·바지(주머니 = 배낭 용량에 더함)·베스트(클린하우스 귤 더함)는 벌이에 넣어 위 규칙으로 삼
//   티셔츠·잠바·양말(HP 쪽)은 벌이에 안 들어 장비를 따라 삼: 다음 단계가 도구·배낭·신발 가장 낮은 단계 이하일 때 (장비가 다 5단계면 언제든)
//   옷은 순서 없이 살 수 있지만 계산은 한 단계씩 모두 산다고 봄 (값을 넉넉히 셈. 건너뛰면 더 빠름)
// - 여유 (--slack): 구경·식사·낚시·헤매기처럼 벌지 않는 시간을 모든 행동에 이 비율만큼 더함. 목표 (#53): 효율 4시간, 여유 25% 5시간 안
// - 투기꾼: DUMP.every 마다 한 번. chase 비율만큼 쫓아내 보상, 나머지는 더미에 쌓임 (깨끗한 구역일수록 자주)
// - 몹(전투 오름): ENEMY_SPAWN.every 마다 일하는 구역 몹 무리. 모두 쫓아냄 (다가가기 3초 + 맞히는 시간). 쓰러짐은 셈하지 않음
// - 낚시는 따로 시간당 귤만 보여 줌 (자유 기능)
const fs = require('fs'), path = require('path');
const MAP = path.join(__dirname, 'econ-map.json');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };
const has = (k) => process.argv.includes(k);

async function live() {
  const { chromium } = require('playwright');
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 480, height: 300 } });
  await p.goto('file://' + path.join(__dirname, '../dist/test.html') + '#namsongi'); await p.waitForTimeout(6000);
  await p.click('#intro-srv button').catch(() => {}); await p.click('#enter-quiet').catch(() => {}); await p.waitForTimeout(5000);
  const r = await p.evaluate(() => { const o = window.__oreum, f = o.cleanhouse.api.front; return { front: { x: f.x, z: f.z }, heaps: o.trash.heaps().map((h) => [h.zone, h.k, h.x, h.z]) }; });
  await b.close();
  const o = { note: 'tools/econ.js 가 쓰는 남송이 더미 자리·클린하우스 앞 (node tools/econ.js --live 로 다시 뽑음)', front: { x: +r.front.x.toFixed(1), z: +r.front.z.toFixed(1) }, heaps: r.heaps.map((h) => [h[0], h[1], +h[2].toFixed(1), +h[3].toFixed(1)]) };
  fs.writeFileSync(MAP, JSON.stringify(o).replace(/\],\[/g, '],\n['));
  console.log('더미', o.heaps.length, '곳 저장');
}

async function main() {
  if (has('--live')) await live();
  const B = await import('../src/balance.js');
  const { TRASH_TYPES, HEAP, ZONES, DUMP, TOOLS, BAGS, POCKET, SHOES, CLEANHOUSE, DEX, TUT, ENEMIES, ENEMY_SPAWN, WEAPONS, BOW, FISH, WEAR, CLOTHES, WEAR_START, wearPrice } = B;
  const map = JSON.parse(fs.readFileSync(MAP, 'utf8'));
  const RUN = 10, DETOUR = 1.15, HAND_T = 1.0; // 달리기 속도(main.js), 길 굽이, 손 던지기 동작 시간(runner.js THROW.total)
  const CHASE = +arg('--chase', 0.5), MOB_IN = 0.8; // 쫓아내는 투기꾼 비율, 구역 안에 있는 시간 비율(몹이 나오는)
  const TUT_MIN = 4; // 튜토리얼 걸리는 시간(분)
  const LOG = has('--log');
  const SLACKS = has('--slack') ? [+arg('--slack', 0.25)] : [0, 0.25]; // 여유: 벌지 않는 시간(구경·식사·낚시·헤매기)을 이 비율만큼 더 씀
  const GOAL = { 0: 4 * 3600, 0.25: 5 * 3600 }; // 마지막 칸 목표 (#53): 효율 4시간, 여유 25% 5시간
  const WS = Object.fromEntries(WEAR.slots.map((w) => [w.k, w]));
  const ECON_W = ['hat', 'bottom', 'vest']; // 벌이에 드는 옷: 모자(드문 것)·바지(주머니)·베스트(귤). 티셔츠·잠바·양말은 HP 쪽이라 벌이 계산엔 안 듦
  const wv = (e, k) => WS[k].v[e[k]];
  const START_W = Object.fromEntries(WEAR.slots.map((w) => [w.k, WEAR_START[w.k] ? CLOTHES.find((c) => c.id === WEAR_START[w.k]).tier : 0]));
  const clothOf = (k, t) => CLOTHES.find((c) => c.slot === k && c.tier === t);

  // 구역 표: 쓰레기 수, 거리, 쓰레기 하나 귤(드문 것 빼고)·부피
  const zones = ZONES.map((Z) => {
    const hs = map.heaps.filter((h) => h[0] === Z.id).map(([, k, x, z]) => ({ k, x, z, n: (Z.amt && Z.amt[k]) || HEAP.sizes[k].n }));
    const n = hs.reduce((s, h) => s + h.n, 0), d = (h) => Math.hypot(h.x - map.front.x, h.z - map.front.z);
    const avgD = hs.reduce((s, h) => s + h.n * d(h), 0) / n * DETOUR;
    let tour = 0; { const left = hs.slice(); let cur = left.shift(); while (cur && left.length) { let bi = 0, bd = 1e9; left.forEach((h, i) => { const dd = Math.hypot(h.x - cur.x, h.z - cur.z); if (dd < bd) { bd = dd; bi = i; } }); tour += bd * DETOUR; cur = left.splice(bi, 1)[0]; } }
    const g = Z.mix.reduce((s, m, j) => s + m * TRASH_TYPES[j].gyul, 0);
    const v = Z.mix.reduce((s, m, j) => s + m * TRASH_TYPES[j].vol, 0);
    return { id: Z.id, name: Z.name, n, avgD, step: tour / n, g, v };
  });
  const TOTAL = zones.reduce((s, z) => s + z.n, 0);
  // 쓰레기 하나 귤: 클린하우스 귤 × (1 + 베스트) + 드문 것(모자 배수)
  const gOf = (z, e) => z.g * (1 + wv(e, 'vest')) + DEX.rareChance * wv(e, 'hat') * DEX.rareGyul;
  const value = (e) => zones.reduce((s, z) => s + z.n * gOf(z, e), 0);

  const toolOf = (e) => TOOLS[e.tool - 1], capOf = (e) => (e.bag ? BAGS[e.bag - 1] : POCKET).cap + wv(e, 'bottom'), spdOf = (e) => RUN * SHOES[e.shoes - 1].speed;
  // 한 번 나가기 (구역 z, 남은 수 left): 걸리는 초·귤·주운 수
  function trip(z, left, e) {
    const tool = toolOf(e), m = Math.min(left, Math.max(1, Math.floor(capOf(e) / z.v))), sp = spdOf(e);
    const t = (2 * z.avgD + m * z.step) / sp + m * tool.time / tool.per + CLEANHOUSE.dumpTime;
    return { t, gy: m * gOf(z, e), m };
  }
  const clearT = (z, e) => { let t = 0, left = z.n; while (left >= 1) { const r = trip(z, left, e); t += r.t; left -= r.m; } return t; };
  // 구역 1 부터 차례로: 오늘 아직 안 치운 가장 낮은 구역 (--greedy: 구역 귤 ÷ 다 치우는 시간이 가장 큰 구역부터)
  const GREEDY = has('--greedy');
  const best = (st, e, done) => {
    let i = st.cur;
    if (i == null || done.has(zones[i].id) || st.left[i] < 1) {
      i = null; let br = 0;
      zones.forEach((z, j) => { if (done.has(z.id) || st.left[j] < 1 || (!GREEDY && i != null)) return; const r = GREEDY ? z.n * gOf(z, e) / clearT(z, e) : 1; if (r > br) { br = r; i = j; } });
      st.cur = i;
    }
    return i == null ? null : { i, r: trip(zones[i], st.left[i], e) };
  };
  // 장비 비교용 귤/초: 가득 찬 오름 전체를 한 번 치울 때
  const rateOf = (e) => value(e) / zones.reduce((s, z) => s + clearT(z, e), 0);
  // 몹 한 마리 쫓아내는 시간·귤
  const weaponOf = (st) => WEAPONS[st.weapon - 1];
  function mobFight(kind, st) {
    const E = ENEMIES[kind], w = weaponOf(st), shots = Math.ceil(E.hp / w.dmg), each = w.id === 'bow' ? BOW.total : HAND_T;
    return { t: 3 + shots * each, gy: E.reward.gyul + E.reward.rare * DEX.rareGyul - (w.perGyul ? Math.ceil(shots / w.perGyul) : 0) };
  }

  const fmt = (sec) => `${Math.floor(sec / 3600) + 1}일 ${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}분`;
  const hm = (sec) => `${Math.floor(sec / 3600)}시간 ${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}분`;
  const GEAR = ['tool', 'bag', 'shoes'], WK = WEAR.slots.map((w) => w.k);
  function run(mode, slack) {
    const battle = mode === 'battle', S = 1 + slack; // 모든 행동 시간에 여유를 곱함 (벌지 않는 시간이 고르게 섞임)
    const e = { tool: 1, bag: 0, shoes: 1, ...START_W }, st = { coins: 0, weapon: 1, left: zones.map((z) => z.n), tAll: 0 };
    const buys = [], days = [], LIST = { tool: TOOLS, bag: BAGS, shoes: SHOES };
    // 다음 단계: 도구·배낭·신발·무기는 순서대로. 옷은 순서 없이 살 수 있지만 계산은 한 단계씩 다 산다고 봄 (값을 넉넉히 셈)
    const next = (k) => {
      if (k === 'weapon') return battle && !WEAPONS[st.weapon]?.soon ? WEAPONS[st.weapon] : null;
      if (WS[k]) { const c = clothOf(k, e[k] + 1); return c && { tier: c.tier, name: c.name, price: wearPrice(c) }; }
      return LIST[k][k === 'bag' ? e.bag : e[k]];
    };
    const kinds = [...GEAR, ...WK, ...(battle ? ['weapon'] : [])];
    const buy = (k) => { const n = next(k); const at = Math.min(st.tAll, dayEnd); st.coins -= n.price; if (k === 'weapon') st.weapon++; else e[k]++; buys.push({ at, when: fmt(at), k, tier: n.tier, name: n.name, price: n.price }); };
    // 이득 = 귤/초 늘어나는 양 ÷ 값. 무기는 몹 쫓아내는 시간 차이로 어림
    const gain = (k) => {
      const n = next(k); if (!n) return -1;
      if (k === 'weapon') { const kind = ENEMY_SPAWN.byZone[3], a = mobFight(kind, st), b = (st.weapon++, mobFight(kind, st)); st.weapon--; return Math.max(1e-6, (a.t - b.t) / ENEMY_SPAWN.every * rateOf(e)) / n.price; }
      const e2 = { ...e }; e2[k]++;
      return Math.max(1e-6, rateOf(e2) - rateOf(e)) / n.price;
    };
    // 벌이에 안 드는 옷(티셔츠·잠바·양말)은 장비를 따라 삼: 다음 단계가 도구·배낭·신발 가장 낮은 단계 이하일 때 (장비가 다 5단계면 언제든)
    const econ = (k) => GEAR.includes(k) || ECON_W.includes(k) || k === 'weapon';
    const gearMin = () => Math.min(e.tool, e.bag, e.shoes), gearMax = () => GEAR.every((k) => !next(k));
    const ok = (k) => econ(k) || gearMax() || next(k).tier <= gearMin();
    const shop = () => { for (;;) { const ks = kinds.filter((k) => next(k) && st.coins >= next(k).price && ok(k)); if (!ks.length) return; buy(ks.sort((a, b) => gain(b) - gain(a))[0]); } };
    const cleared = new Set(); let dumpT = 0, mobT = 0, cleanSeen, dayEnd = 3600, earned = 0;
    const zoneClean = (i) => 1 - st.left[i] / zones[i].n;
    for (let d = 0; d < 7; d++) {
      st.left = zones.map((z) => z.n); cleanSeen = new Set(); st.cur = null;
      let t = 0; const t0 = st.tAll; dayEnd = t0 + 3599; // 하루 1시간을 넘긴 마지막 나가기에서 산 건 그날 끝으로 셈
      const add = (dt) => { t += dt * S; st.tAll += dt * S; };
      if (d === 0) { // 튜토리얼: 쓰레기 6개 → 첫 보너스 → 집게·배낭
        t = TUT_MIN * 60; st.tAll += t; st.coins = TUT.firstBonus; buy('tool'); buy('bag');
      }
      while (t < 3600) {
        const b = best(st, e, cleanSeen) || (st.cur = null, best(st, e, new Set())); if (!b) { add(30); continue; }
        const { r } = b; add(r.t); st.left[b.i] -= r.m; st.coins += r.gy; earned += r.gy;
        if (st.left[b.i] < 1) { cleanSeen.add(zones[b.i].id); cleared.add(zones[b.i].id); }
        // 투기꾼
        dumpT += r.t * S;
        while (dumpT >= DUMP.every) {
          dumpT -= DUMP.every; const truck = Math.random() < DUMP.truckP, def = truck ? DUMP.truck : DUMP.walker;
          if (Math.random() < CHASE) { const w = weaponOf(st), dmg = battle ? w.dmg : WEAPONS[0].dmg, each = battle && w.id === 'bow' ? BOW.total : HAND_T; add(6 + Math.ceil(def.hp / dmg) * each); st.coins += def.reward; earned += def.reward; }
          else { const wts = zones.map((z, i) => DUMP.zoneBase + zoneClean(i)), sum = wts.reduce((a, c) => a + c, 0); let x = Math.random() * sum, i = 0; while (i < 4 && x > wts[i]) { x -= wts[i]; i++; } st.left[i] = Math.min(zones[i].n, st.left[i] + (truck ? 80 : DUMP.walker.amt)); }
        }
        // 몹
        if (battle) {
          mobT += r.t * S * MOB_IN; const kind = ENEMY_SPAWN.byZone[zones[b.i].id];
          while (mobT >= ENEMY_SPAWN.every) { mobT -= ENEMY_SPAWN.every; const cnt = (ENEMY_SPAWN.group[0] + ENEMY_SPAWN.group[1]) / 2, f = mobFight(kind, st); add(f.t * cnt); st.coins += f.gy * cnt; earned += f.gy * cnt; }
        }
        shop();
      }
      st.tAll = t0 + 3600; // 하루 1시간에서 넘친 부분은 버림
      days.push({ day: d + 1, coins: Math.round(st.coins), e: { ...e }, weapon: st.weapon, zones: [...cleanSeen].sort().join(','), rate: Math.round(rateOf(e) * 3600), earned: Math.round(earned), n: buys.filter((b) => b.at >= t0 && b.at < t0 + 3600).length });
      if (kinds.every((k) => !next(k))) break;
    }
    const last = buys.length && kinds.every((k) => !next(k)) ? buys[buys.length - 1].at : Infinity;
    return { buys, days, e, st, last };
  }

  // 같은 무작위 순서로 여러 번 돌려 가운데 값
  const seedRun = (mode, slack, s) => { let x = s; const orig = Math.random; Math.random = () => ((x = (x * 16807) % 2147483647) / 2147483647); try { return run(mode, slack); } finally { Math.random = orig; } };
  const e0 = { tool: 1, bag: 0, shoes: 1, ...START_W };
  console.log(`오름 전체 쓰레기 ${TOTAL}개, 귤로 ${Math.round(value(e0))} (베스트·모자 없이)`);
  console.log('구역', zones.map((z) => `${z.id}:${z.n}개·${Math.round(z.avgD)}m·귤${z.g.toFixed(2)}`).join('  '));
  const sum = (L) => L.reduce((s, x) => s + (x.price || 0), 0);
  const wearSum = (k) => CLOTHES.filter((c) => c.slot === k && c.tier > START_W[k]).reduce((s, c) => s + wearPrice(c), 0);
  const WSUM = WK.reduce((s, k) => s + wearSum(k), 0);
  console.log(`값 합: 도구 ${sum(TOOLS)} · 배낭 ${sum(BAGS)} · 신발 ${sum(SHOES)} · 활 ${WEAPONS[1].price} · 옷 6칸 ${WSUM} (${WK.map((k) => `${WS[k].name} ${wearSum(k)}`).join(' · ')}) = ${sum(TOOLS) + sum(BAGS) + sum(SHOES) + WEAPONS[1].price + WSUM}`);
  const short = { tool: '도구', bag: '배낭', shoes: '신발', weapon: '무기', ...Object.fromEntries(WEAR.slots.map((w) => [w.k, w.name])) };
  const verdict = [];
  for (const mode of ['clean', 'battle']) for (const slack of SLACKS) {
    const runs = [1, 7, 42, 99, 123].map((s) => seedRun(mode, slack, s));
    const r = runs[2];
    const lasts = runs.map((x) => x.last).sort((a, b) => a - b), last = lasts[2];
    const title = `${mode === 'clean' ? '깨끗한 오름' : '전투 오름'} · ${slack ? `여유 ${slack * 100}%` : '효율'}`;
    console.log(`\n== ${title} (투기꾼 쫓아내기 ${CHASE * 100}%) ==`);
    console.log('하루 끝 (한 번 돌린 예). 칸은 단계 (배낭 0 = 호주머니, 옷 0 = 없음)');
    console.table(r.days.map((d) => ({ 일: d.day, 도구: d.e.tool, 배낭: d.e.bag, 신발: d.e.shoes, ...(mode === 'battle' ? { 무기: d.weapon } : {}), ...Object.fromEntries(WK.map((k) => [short[k], d.e[k]])), '산 것': d.n, '다 치운 구역': d.zones, '끝 귤/시간': d.rate, '남은 귤': d.coins })));
    // 단계별 도달 시각 (5번 돌린 가운데)
    const keys = [...new Set(r.buys.map((b) => b.k + b.tier))];
    const med = (k) => { const ts = runs.map((x) => (x.buys.find((b) => b.k + b.tier === k) || { at: Infinity }).at).sort((a, b) => a - b); return ts[2]; };
    if (LOG || has('--table')) {
      const rows = keys.map((k) => { const b = r.buys.find((x) => x.k + x.tier === k); const at = med(k); return { 칸: short[b.k], 단계: b.tier, 이름: b.name, 값: b.price, at, '도달(5번 중 가운데)': at === Infinity ? '못 삼' : fmt(at) }; }).sort((a, b) => a.at - b.at).map(({ at, ...x }) => x);
      console.table(rows);
    }
    const goal = GOAL[slack];
    const line = `${title}: 마지막 칸 ${last === Infinity ? '7일 안에 못 삼' : `${fmt(last)} (놀이 ${hm(last)})`}${goal ? ` → 목표 ${hm(goal)} 안 ${last <= goal ? '통과' : '넘음'}` : ''}`;
    console.log(line); verdict.push(line);
    if (LOG) r.buys.forEach((b) => console.log(b.when, short[b.k], b.tier, b.name, b.price));
  }
  console.log('\n' + verdict.join('\n'));
  // 낚시: 한 번 = 던지기 + 기다림 + 반응 0.4 + 당기기 + (보여 주기 | 넣기) + 놓아주기/거두기
  const F = FISH, wait = (F.waitMin + F.waitMax) / 2 + 0.4, cyc = F.castT + wait + F.pullT + F.odds.fish * (F.showT + F.releaseT) + (1 - F.odds.fish) * F.stowT;
  const fg = F.odds.fish * F.fishGyul + F.odds.trash * 1 + F.odds.rare * (DEX.rareGyul + 2);
  console.log(`\n낚시: 한 번 ${cyc.toFixed(1)}초, 귤 ${fg.toFixed(2)} → 시간당 약 ${Math.round(fg / cyc * 3600)} (쓰레기는 클린하우스에 버려야 귤)`);
}
main();
