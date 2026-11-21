// 귤 경제 계산 (#49, #53, #137 성장 루프). 지금 src/balance.js 수치로 "하루 1시간씩" 플레이를 흉내 내 칸 10개(도구·배낭·신발·무기 + 옷 6칸) 도달 시각을 낸다
//   node tools/econ.js              전투 오름(#98: 서버는 하나), 효율·여유 25% 각각 하루 끝 표와 마지막 칸 시각
//   node tools/econ.js --table      칸·단계별 도달 시각 표까지
//   node tools/econ.js --log        구매 기록까지
//   node tools/econ.js --slack 0.4  여유 비율 하나만 (기본은 0 과 0.25 둘 다)
//   node tools/econ.js --chase 0.3  투기꾼을 쫓아내는 비율 (기본 0.5)
//   node tools/econ.js --norides   탈것(#69) 없이 (비교용)
//   node tools/econ.js --skip      장비(도구·배낭·신발·무기)를 순서 없이 (#111): 튜토리얼 뒤에는 최고 단계 하나만 귤을 모아 바로 삼
//   node tools/econ.js --flow       하루 끝 흐름 확인만 (#137)
//   node tools/econ.js --live       dist/test.html 을 띄워 더미 자리를 다시 뽑아 tools/econ-map.json 에 저장 (먼저 node build.mjs)
// 가정 (모두 어림):
// - 하루 시작엔 오름 전체가 가득 (접속 안 한 시간 ≥ DUMP.offlineMaxH)
// - 한 번 나가기 = 클린하우스 → 구역 → 배낭이 찰 때까지 더미 돌며 줍기 → 클린하우스. 거리는 직선 × 1.15 (trash.estimate 와 같음)
//   클린하우스는 들머리 + 오름 안 4곳 (#78): 더미마다 가장 가까운 곳까지 거리 (--one: 들머리 하나만, 비교용)
// - 더미 사이 걷기 = 구역 더미를 가까운 것부터 한 바퀴 도는 거리 ÷ 쓰레기 수 × 주운 수
// - 구역은 장비 점수로 고름 (#137): 권장 점수(ZONES rec) × GROWTH.red 이상(빨강이 아닌) 구역 중 쓰레기가 남은 가장 높은 구역.
//   그런 구역에 쓰레기가 없으면 열린 가장 높은 구역에서 30초씩 몹·투기꾼만 상대함(빨간 구역엔 안 감). 쓰레기 귤은 구역 배수 gv 를 곱함
//   (--greedy: 점수와 상관없이 구역 귤 ÷ 다 치우는 시간이 가장 큰 구역부터, 비교용)
// - 클린하우스에 버릴 때마다 살 수 있는 것 중 (오름 전체를 한 번 치우는 귤/초가 늘어나는 양 ÷ 값) 이 가장 큰 것부터 삼
// - 옷 6칸 (#52): 모자(드문 것 확률)·바지(주머니 = 배낭 용량에 더함)·베스트(클린하우스 귤 더함)는 벌이에 넣어 위 규칙으로 삼
//   티셔츠·잠바·양말(HP 쪽)은 벌이에 안 들어 장비를 따라 삼: 다음 단계가 도구·배낭·신발 가장 낮은 단계 이하일 때 (장비가 다 5단계면 언제든)
//   옷은 순서 없이 살 수 있지만 계산은 한 단계씩 모두 산다고 봄 (값을 넉넉히 셈. 건너뛰면 더 빠름)
// - 여유 (--slack): 구경·식사·낚시·헤매기처럼 벌지 않는 시간을 모든 행동에 이 비율만큼 더함. 목표: 둘 다 5시간 안 (#53 은 효율 4시간)
// - 투기꾼: DUMP.every 마다 한 번. chase 비율만큼 쫓아내 보상, 나머지는 더미에 쌓임 (깨끗한 구역일수록 자주)
// - 몹(전투 오름): ENEMY_SPAWN.every 마다 일하는 구역 몹 무리. 모두 쫓아냄 (다가가기 3초 + 맞히는 시간). 쓰러짐은 셈하지 않음
// - 탈것 (#69): RIDES.list 를 싼 것부터 차례로 (장비처럼 귤/초 이득 ÷ 값). 클린하우스 ↔ 구역 왕복만 탐 (더미 사이는 줍느라 걸음)
//   갈 때 오르막·올 때 내리막, 왕복 거리의 RIDE_FLAT 만큼은 평지. RIDE_OFF 만큼은 길 밖(×RIDES.off). 타고 내리기 한 번에 2초. 신발보다 느리면 걸음
// - 낚시는 따로 시간당 귤만 보여 줌 (자유 기능)
// - 들판 (#138): 들판 더미·쓰레기 산은 구역 쓰레기에 더함(쓰레기 산 귤 × HEAP.sizes.mt.gv, 길 밖이라 걷는 거리를 FIELD.off 로 늘림). 소굴은 일하는 구역에서
//   열린 것 하나를 나가기마다 닫음(다가가기 20초 + 무리 쫓아내기, FIELD.den.reopen 마다 다시), 숨은 보물은 일하는 구역 것을 하루 한 번(25초씩), 볼거리는 처음 한 번(20초)
//   (--nofield: 들판 없이, --nospots: 들판 더미만 두고 소굴·보물·볼거리 없이, 비교용)
// - 우두머리 (#139): 일하는 구역이 ZONE_BOSS.appear 만큼 깨끗하고 장비 점수가 빨강이 아니면 쫓아냄 (돌하르방이 서 있는 holdSec 동안은 다시 안 나옴). --noboss 는 비교용
// - 흐름 (#137, notes/growth-loop.md 4절): 하루 끝 장비 단계(도구·배낭·신발 가장 낮은 것)와 그때까지 다 치운 구역이
//   1일 구역 1·2단계, 2일 구역 3까지·3단계, 3일 4단계, 4일 구역 4, 5일 5단계·구역 5 인지 봄 (단계는 빠르지도 늦지도 않게)
const fs = require('fs'), path = require('path');
const MAP = path.join(__dirname, 'econ-map.json');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };
const has = (k) => process.argv.includes(k);

async function live() {
  const { chromium } = require('playwright');
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 480, height: 300 } });
  await p.goto('file://' + path.join(__dirname, '../dist/test.html') + '#namsongi'); await p.waitForTimeout(6000);
  await p.click('#enter').catch(() => {}); await p.waitForTimeout(5000);
  const r = await p.evaluate(() => { const o = window.__oreum, f = o.cleanhouse.api.front; return { front: { x: f.x, z: f.z }, fronts: o.cleanhouse.all.map((c) => ({ x: c.front.x, z: c.front.z })), heaps: o.trash.heaps().map((h) => [h.zone, h.k, h.x, h.z, h.field ? 1 : 0]) }; });
  await b.close();
  const o = { note: 'tools/econ.js 가 쓰는 남송이 더미 자리·클린하우스 앞 (node tools/econ.js --live 로 다시 뽑음). front 는 들머리, fronts 는 오름 안 것까지 모두 (#78)', front: { x: +r.front.x.toFixed(1), z: +r.front.z.toFixed(1) }, fronts: r.fronts.map((f) => ({ x: +f.x.toFixed(1), z: +f.z.toFixed(1) })), heaps: r.heaps.map((h) => [h[0], h[1], +h[2].toFixed(1), +h[3].toFixed(1), h[4]]) };
  fs.writeFileSync(MAP, JSON.stringify(o).replace(/\],\[/g, '],\n['));
  console.log('더미', o.heaps.length, '곳 저장');
}

async function main() {
  if (has('--live')) await live();
  const B = await import('../src/balance.js');
  const { RIDES } = B;
  const { TRASH_TYPES, HEAP, ZONES, DUMP, TOOLS, BAGS, POCKET, SHOES, CLEANHOUSE, DEX, TUT, ENEMIES, ENEMY_SPAWN, WEAPONS, BOW, FISH, WEAR, CLOTHES, WEAR_START, wearPrice, GROWTH, FIELD, ZONE_BOSS, ZONE_GUARD } = B;
  const NOFIELD = has('--nofield');
  const map = JSON.parse(fs.readFileSync(MAP, 'utf8'));
  const FRONTS = has('--one') || !map.fronts ? [map.front] : map.fronts; // 가장 가까운 클린하우스 기준 (#78)
  const RUN = 10, DETOUR = 1.15, HAND_T = 1.0, BOSS_OVER = 1.5; // … , 우두머리: 맞히기만 한 시간 × 이만큼 (피하기·부하, tools/boss.js 로 잰 비율) // 달리기 속도(main.js), 길 굽이, 손 던지기 동작 시간(runner.js THROW.total)
  const CHASE = +arg('--chase', 0.5), MOB_IN = 0.8; // 쫓아내는 투기꾼 비율, 구역 안에 있는 시간 비율(몹이 나오는)
  const TUT_MIN = 4; // 튜토리얼 걸리는 시간(분)
  const LOG = has('--log');
  const SLACKS = has('--slack') ? [+arg('--slack', 0.25)] : [0, 0.25]; // 여유: 벌지 않는 시간(구경·식사·낚시·헤매기)을 이 비율만큼 더 씀
  const GOAL = { 0: 5 * 3600, 0.25: 5 * 3600 }; // 마지막 칸 목표: 5일(하루 1시간) 안. #137 부터는 구역 점수가 흐름을 정해 효율도 5시간 (#53 은 효율 4시간)
  const WS = Object.fromEntries(WEAR.slots.map((w) => [w.k, w]));
  const ECON_W = ['hat', 'bottom', 'vest']; // 벌이에 드는 옷: 모자(드문 것)·바지(주머니)·베스트(귤). 티셔츠·잠바·양말은 HP 쪽이라 벌이 계산엔 안 듦
  const wv = (e, k) => WS[k].v[e[k]];
  const START_W = Object.fromEntries(WEAR.slots.map((w) => [w.k, WEAR_START[w.k] ? CLOTHES.find((c) => c.id === WEAR_START[w.k]).tier : 0]));
  const clothOf = (k, t) => CLOTHES.find((c) => c.slot === k && c.tier === t);

  // 구역 표: 쓰레기 수, 거리, 쓰레기 하나 귤(드문 것 빼고)·부피
  const zones = ZONES.map((Z) => {
    const hs = map.heaps.filter((h) => h[0] === Z.id && !(NOFIELD && h[4])).map(([, k, x, z, fd]) => ({ k, x, z, fd, n: (!fd && Z.amt && Z.amt[k]) || HEAP.sizes[k].n, gv: HEAP.sizes[k].gv || 1 }));
    const n = hs.reduce((s, h) => s + h.n, 0), d = (h) => Math.min(...FRONTS.map((f) => Math.hypot(h.x - f.x, h.z - f.z))) * (h.fd ? 1 + 0.4 * (1 / FIELD.off[Z.gear.shoes - 1] - 1) : 1); // 들판은 걷는 길 일부가 풀밭
    const avgD = hs.reduce((s, h) => s + h.n * d(h), 0) / n * DETOUR;
    let tour = 0; { const left = hs.slice(); let cur = left.shift(); while (cur && left.length) { let bi = 0, bd = 1e9; left.forEach((h, i) => { const dd = Math.hypot(h.x - cur.x, h.z - cur.z); if (dd < bd) { bd = dd; bi = i; } }); tour += bd * DETOUR; cur = left.splice(bi, 1)[0]; } }
    const g = Z.mix.reduce((s, m, j) => s + m * TRASH_TYPES[j].gyul, 0) * (Z.gv || 1) * hs.reduce((s, h) => s + h.n * h.gv, 0) / n; // 쓰레기 산은 귤 × gv
    const v = Z.mix.reduce((s, m, j) => s + m * TRASH_TYPES[j].vol, 0);
    return { id: Z.id, name: Z.name, n, avgD, step: tour / n, g, v, rec: Z.rec };
  });
  const TOTAL = zones.reduce((s, z) => s + z.n, 0);
  // 쓰레기 하나 귤: 클린하우스 귤 × (1 + 베스트) + 드문 것(모자 배수)
  const gOf = (z, e) => z.g * (1 + wv(e, 'vest')) + DEX.rareChance * wv(e, 'hat') * DEX.rareGyul;
  const value = (e) => zones.reduce((s, z) => s + z.n * gOf(z, e), 0);

  const NORIDE = has('--norides'), SKIP = has('--skip'), RIDE_FLAT = 0.35, RIDE_OFF = 0.3, RIDE_T = 2;
  // 클린하우스 ↔ 구역 왕복 시간 (편도 d)
  function travel(e, d) {
    const walk = 2 * d / spdOf(e), R = e.ride ? RIDES.list[e.ride - 1] : null; if (!R) return walk;
    const m = (1 - RIDE_OFF) + RIDE_OFF * RIDES.off, b = RIDES.base * m;
    const fl = b * R.flat, up = R.up ? b * R.up : RIDES.carry * SHOES[e.shoes - 1].speed, dn = b * R.down;
    const t = d * (RIDE_FLAT / fl + (1 - RIDE_FLAT) / up) + d * (RIDE_FLAT / fl + (1 - RIDE_FLAT) / dn) + RIDE_T;
    return Math.min(walk, t);
  }
  const toolOf = (e) => TOOLS[e.tool - 1], capOf = (e) => (e.bag ? BAGS[e.bag - 1] : POCKET).cap + wv(e, 'bottom'), spdOf = (e) => RUN * SHOES[e.shoes - 1].speed;
  // 한 번 나가기 (구역 z, 남은 수 left): 걸리는 초·귤·주운 수
  function trip(z, left, e) {
    const tool = toolOf(e), m = Math.min(left, Math.max(1, Math.floor(capOf(e) / z.v))), sp = spdOf(e);
    const t = travel(e, z.avgD) + m * z.step / sp + m * tool.time / tool.per + CLEANHOUSE.dumpTime;
    return { t, gy: m * gOf(z, e), m };
  }
  const clearT = (z, e) => { let t = 0, left = z.n; while (left >= 1) { const r = trip(z, left, e); t += r.t; left -= r.m; } return t; };
  // 장비 점수 (#137, src/gearscore.js 와 같은 셈. 등급·강화는 아직 없음)
  const SC = GROWTH.score, scoreOf = (e, w) => SC[e.tool] + SC[e.bag] + SC[e.shoes] + SC[w] + WEAR.slots.reduce((s, x) => s + SC[e[x.k]], 0);
  // 구역 고르기: 빨강이 아닌 구역 중 쓰레기가 남은 가장 높은 구역, 없으면 남은 가장 낮은 구역 (--greedy: 구역 귤 ÷ 다 치우는 시간이 가장 큰 구역부터)
  const GREEDY = has('--greedy');
  const best = (st, e, done) => {
    let i = st.cur;
    const sc = scoreOf(e, st.weapon), open = (j) => sc >= zones[j].rec * GROWTH.red, has = (j) => !done.has(zones[j].id) && st.left[j] >= 1;
    if (i == null || !has(i) || (!GREEDY && zones.some((z, j) => j > i && has(j) && open(j)))) {
      i = null;
      if (GREEDY) { let br = 0; zones.forEach((z, j) => { if (!has(j)) return; const r = z.n * gOf(z, e) / clearT(z, e); if (r > br) { br = r; i = j; } }); }
      else for (let j = zones.length - 1; j >= 0; j--) if (has(j) && open(j)) { i = j; break; }
      st.cur = i;
    }
    return i == null ? null : { i, r: trip(zones[i], st.left[i], e) };
  };
  // 장비 비교용 귤/초: 가득 찬 오름 전체를 한 번 치울 때
  const rateOf = (e) => value(e) / zones.reduce((s, z) => s + clearT(z, e), 0);
  // 몹 한 마리 쫓아내는 시간·귤
  const weaponOf = (st) => WEAPONS[st.weapon - 1];
  // 한 마리 쫓아내는 시간(초)·쓴 귤 (#123: 무기마다 쏘는 간격. 머신건·레이저는 초당 피해, 폭탄은 무리(평균 2.5마리)에 나눠 셈)
  const killOf = (hp, w) => {
    if (w.dps) { const t = hp / w.dmg; return { t, gy: w.gyulPerSec ? t * w.gyulPerSec : t * w.rate / w.perGyul }; }
    if (w.id === 'bomb') { const n = Math.ceil(hp / w.dmg), share = 1 / Math.min(2.5, ENEMY_SPAWN.group[1]); return { t: n * Math.max(w.cd, HAND_T) * share, gy: n * w.cost * share }; }
    const n = Math.ceil(hp / w.dmg), each = w.id === 'bow' ? BOW.total : w.cd || HAND_T;
    return { t: n * each, gy: w.perGyul ? n / w.perGyul : 0 };
  };
  function mobFight(kind, st) {
    const E = ENEMIES[kind], w = weaponOf(st), k = killOf(E.hp, w);
    return { t: 3 + k.t, gy: E.reward.gyul + E.reward.rare * DEX.rareGyul - Math.ceil(k.gy) };
  }

  const fmt = (sec) => `${Math.floor(sec / 3600) + 1}일 ${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}분`;
  const hm = (sec) => `${Math.floor(sec / 3600)}시간 ${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}분`;
  const GEAR = ['tool', 'bag', 'shoes'], WK = WEAR.slots.map((w) => w.k);
  function run(mode, slack) {
    const battle = mode === 'battle', S = 1 + slack; // 모든 행동 시간에 여유를 곱함 (벌지 않는 시간이 고르게 섞임)
    const e = { tool: 1, bag: 0, shoes: 1, ride: 0, ...START_W }, st = { coins: 0, weapon: 1, left: zones.map((z) => z.n), tAll: 0, denAt: {}, trDay: -1, trGot: new Set(), sights: new Set(), bossAt: {} };
    const buys = [], days = [], LIST = { tool: TOOLS, bag: BAGS, shoes: SHOES };
    // 다음 단계: 도구·배낭·신발·무기는 순서대로. 옷은 순서 없이 살 수 있지만 계산은 한 단계씩 다 산다고 봄 (값을 넉넉히 셈)
    // --skip (#111): 튜토리얼 뒤 장비는 최고 단계만 (건너뛴 단계 값은 안 냄)
    const topOf = (k) => k === 'weapon' ? WEAPONS.filter((w) => !w.soon).length - 1 : LIST[k].length - 1;
    const skipK = (k) => SKIP && st.tutDone && (k === 'weapon' || GEAR.includes(k));
    const cur = (k) => (k === 'weapon' ? st.weapon : e[k]);
    const next = (k) => {
      if (skipK(k)) { const L = k === 'weapon' ? (battle ? WEAPONS : []) : LIST[k], i = topOf(k); return cur(k) <= i && L[i] ? { ...L[i], tier: L[i].tier ?? i + 1 } : null; }
      if (k === 'weapon') return battle && !WEAPONS[st.weapon]?.soon ? WEAPONS[st.weapon] : null;
      if (WS[k]) { const c = clothOf(k, e[k] + 1); return c && { tier: c.tier, name: c.name, price: wearPrice(c) }; }
      if (k === 'ride') return NORIDE ? null : RIDES.list[e.ride] && { tier: e.ride + 1, ...RIDES.list[e.ride] };
      return LIST[k][k === 'bag' ? e.bag : e[k]];
    };
    const kinds = [...GEAR, ...WK, ...(battle ? ['weapon'] : []), ...(NORIDE ? [] : ['ride'])];
    const buy = (k) => { const n = next(k); const at = Math.min(st.tAll, dayEnd); st.coins -= n.price; if (skipK(k)) { if (k === 'weapon') st.weapon = topOf(k) + 1; else e[k] = topOf(k) + 1; } else if (k === 'weapon') st.weapon++; else e[k]++; buys.push({ at, when: fmt(at), k, tier: n.tier, name: n.name, price: n.price }); };
    // 이득 = 귤/초 늘어나는 양 ÷ 값. 무기는 몹 쫓아내는 시간 차이로 어림
    const gain = (k) => {
      const n = next(k); if (!n) return -1;
      if (k === 'weapon') { const kind = ENEMY_SPAWN.byZone[3], w0 = st.weapon, a = mobFight(kind, st), b = (st.weapon = skipK(k) ? topOf(k) + 1 : w0 + 1, mobFight(kind, st)); st.weapon = w0; return Math.max(1e-6, (a.t - b.t) / ENEMY_SPAWN.every * rateOf(e)) / n.price; }
      const e2 = { ...e }; if (skipK(k)) e2[k] = topOf(k) + 1; else e2[k]++;
      return Math.max(1e-6, rateOf(e2) - rateOf(e)) / n.price;
    };
    // 벌이에 안 드는 옷(티셔츠·잠바·양말)은 장비를 따라 삼: 다음 단계가 도구·배낭·신발 가장 낮은 단계 이하일 때 (장비가 다 5단계면 언제든)
    const econ = (k) => GEAR.includes(k) || ECON_W.includes(k) || k === 'weapon' || k === 'ride';
    const gearMin = () => Math.min(e.tool, e.bag, e.shoes), gearMax = () => GEAR.every((k) => !next(k));
    const ok = (k) => econ(k) || gearMax() || next(k).tier <= gearMin();
    const shop = () => { for (;;) { const ks = kinds.filter((k) => next(k) && st.coins >= next(k).price && ok(k)); if (!ks.length) return; buy(ks.sort((a, b) => gain(b) - gain(a))[0]); } };
    const cleared = new Set(); let idleT = 0, dumpT = 0, mobT = 0, cleanSeen, dayEnd = 3600, earned = 0;
    const zoneClean = (i) => 1 - st.left[i] / zones[i].n;
    for (let d = 0; d < 7; d++) {
      st.left = zones.map((z) => z.n); cleanSeen = new Set(); st.cur = null;
      let t = 0; const t0 = st.tAll, earned0 = earned; idleT = 0; dayEnd = t0 + 3599; // 하루 1시간을 넘긴 마지막 나가기에서 산 건 그날 끝으로 셈
      const add = (dt) => { t += dt * S; st.tAll += dt * S; };
      if (d === 0) { // 튜토리얼: 쓰레기 6개 → 첫 보너스 → 집게·배낭
        t = TUT_MIN * 60; st.tAll += t; st.coins = TUT.firstBonus; buy('tool'); buy('bag'); st.tutDone = true;
      }
      while (t < 3600) {
        let b = best(st, e, cleanSeen) || (st.cur = null, best(st, e, new Set()));
        if (!b) { const sc = scoreOf(e, st.weapon); let j = 0; zones.forEach((z, k) => { if (sc >= z.rec * GROWTH.red) j = k; }); b = { i: j, r: { t: 30, gy: 0, m: 0 }, idle: true }; idleT += 30 * S; }
        const { r } = b; add(r.t); st.left[b.i] -= r.m; st.coins += r.gy; earned += r.gy;
        if (!b.idle && st.left[b.i] < 1) { cleanSeen.add(zones[b.i].id); cleared.add(zones[b.i].id); }
        // 투기꾼
        dumpT += r.t * S;
        while (dumpT >= DUMP.every) {
          dumpT -= DUMP.every; const truck = Math.random() < DUMP.truckP, def = truck ? DUMP.truck : DUMP.walker;
          if (Math.random() < CHASE) { const k = killOf(def.hp, battle ? weaponOf(st) : WEAPONS[0]); add(6 + k.t); st.coins += def.reward - Math.ceil(k.gy); earned += def.reward - Math.ceil(k.gy); }
          else { const wts = zones.map((z, i) => DUMP.zoneBase + zoneClean(i)), sum = wts.reduce((a, c) => a + c, 0); let x = Math.random() * sum, i = 0; while (i < 4 && x > wts[i]) { x -= wts[i]; i++; } st.left[i] = Math.min(zones[i].n, st.left[i] + (truck ? 80 : DUMP.walker.amt)); }
        }
        // 몹
        if (battle) {
          mobT += r.t * S * MOB_IN; const kind = ENEMY_SPAWN.byZone[zones[b.i].id];
          while (mobT >= ENEMY_SPAWN.every) { mobT -= ENEMY_SPAWN.every; const cnt = (ENEMY_SPAWN.group[0] + ENEMY_SPAWN.group[1]) / 2, f = mobFight(kind, st); add(f.t * cnt); st.coins += f.gy * cnt; earned += f.gy * cnt; }
        }
        // 들판 (#138): 일하는 구역의 열린 소굴 하나 · 오늘 안 연 보물 · 처음 보는 볼거리
        if (!NOFIELD && !has('--nospots') && battle) {
          const z = zones[b.i].id, DN = FIELD.den.n[z] || 0;
          for (let k = 0; k < DN; k++) { const id = z + '-' + k; if (st.tAll - (st.denAt[id] ?? -1e9) < FIELD.den.reopen) continue; st.denAt[id] = st.tAll;
            const cnt = (FIELD.den.group[0] + FIELD.den.group[1]) / 2, f = mobFight(ENEMY_SPAWN.byZone[z], st); add(20 + f.t * cnt); const g = f.gy * cnt + FIELD.den.gyul[z]; st.coins += g; earned += g; break; }
          if (st.trDay !== d) { st.trDay = d; st.trGot = new Set(); }
          for (let k = 0; k < (FIELD.treasure.n[z] || 0); k++) { const id = z + '-' + k; if (st.trGot.has(id)) continue; st.trGot.add(id); add(25); const g = FIELD.treasure.gyul[z] + FIELD.treasure.rare * DEX.rareGyul; st.coins += g; earned += g; }
          FIELD.sight.list.forEach((x, k) => { if (x[0] !== z || st.sights.has(k)) return; st.sights.add(k); add(20); st.coins += FIELD.sight.gyul[z]; earned += FIELD.sight.gyul[z]; });
        }
        // 우두머리 (#139): 일하는 구역이 ZONE_BOSS.appear 만큼 깨끗하고 열린(빨강 아닌) 구역이면, 하르방이 서 있는 동안(holdSec) 빼고 한 번 (다가가기 20초 + 쫓아내기 × BOSS_OVER)
        if (battle && !b.idle && !has('--noboss')) {
          const z = zones[b.i].id, D = ZONE_BOSS.list[z];
          if (D && zoneClean(b.i) >= ZONE_BOSS.appear && scoreOf(e, st.weapon) >= zones[b.i].rec * GROWTH.red && st.tAll - (st.bossAt[z] ?? -1e9) >= ZONE_GUARD.holdSec) {
            st.bossAt[z] = st.tAll; const k = killOf(D.hp, weaponOf(st)); add(20 + k.t * BOSS_OVER); const g = D.gyul - Math.ceil(k.gy * BOSS_OVER); st.coins += g; earned += g; st.bosses = (st.bosses || 0) + 1;
          }
        }
        shop();
      }
      st.tAll = t0 + 3600; // 하루 1시간에서 넘친 부분은 버림
      days.push({ day: d + 1, coins: Math.round(st.coins), e: { ...e }, weapon: st.weapon, zones: [...cleanSeen].sort().join(','), cleared: new Set(cleared), idle: Math.round(idleT / 60), score: scoreOf(e, st.weapon), rate: Math.round(rateOf(e) * 3600), earned: Math.round(earned - earned0), n: buys.filter((b) => b.at >= t0 && b.at < t0 + 3600).length, boss: st.bosses || 0 });
      if (kinds.every((k) => !next(k)) && d >= 4) break;
    }
    const last = buys.length && kinds.every((k) => !next(k)) ? buys[buys.length - 1].at : Infinity;
    return { buys, days, e, st, last };
  }

  // 같은 무작위 순서로 여러 번 돌려 가운데 값
  const seedRun = (mode, slack, s) => { let x = s; const orig = Math.random; Math.random = () => ((x = (x * 16807) % 2147483647) / 2147483647); try { return run(mode, slack); } finally { Math.random = orig; } };
  const e0 = { tool: 1, bag: 0, shoes: 1, ride: 0, ...START_W };
  console.log(`오름 전체 쓰레기 ${TOTAL}개, 귤로 ${Math.round(value(e0))} (베스트·모자 없이)`);
  console.log('구역', zones.map((z) => `${z.id}:${z.n}개·${Math.round(z.avgD)}m·귤${z.g.toFixed(2)}`).join('  '));
  const sum = (L) => L.reduce((s, x) => s + (x.price || 0), 0);
  const wearSum = (k) => CLOTHES.filter((c) => c.slot === k && c.tier > START_W[k]).reduce((s, c) => s + wearPrice(c), 0);
  const WSUM = WK.reduce((s, k) => s + wearSum(k), 0);
  console.log(`권장 점수 ${ZONES.map((Z) => `${Z.id}:${Z.rec}`).join(' ')} · 단계 점수 ${GROWTH.score.join('/')} · 귤 배수 ${ZONES.map((Z) => Z.gv).join('/')}`);
  console.log(`값 합: 도구 ${sum(TOOLS)} · 배낭 ${sum(BAGS)} · 신발 ${sum(SHOES)} · 무기 ${sum(WEAPONS)} · 옷 6칸 ${WSUM} (${WK.map((k) => `${WS[k].name} ${wearSum(k)}`).join(' · ')}) = ${sum(TOOLS) + sum(BAGS) + sum(SHOES) + sum(WEAPONS) + WSUM}`);
  const short = { tool: '도구', bag: '배낭', shoes: '신발', weapon: '무기', ride: '탈것', ...Object.fromEntries(WEAR.slots.map((w) => [w.k, w.name])) };
  const verdict = []; let day1Rate = 0;
  const FLOW_ONLY = has('--flow');
  // 하루 끝 목표 (#137): tier = 도구·배낭·신발 가장 낮은 단계, zone = 그날까지 다 치운 적 있는 가장 높은 구역 (이 구역까지는 다 치움)
  // tier = 도구·배낭·신발 가장 낮은 단계 [최소, 최대], zone = 그날까지 다 치운 가장 높은 구역(1부터 이어서) 최소, open = 하루 끝 장비 점수로 열린(빨강이 아닌) 구역 최소
  // 다 치운 구역은 목표 + 1 까지만 (너무 빠르지 않게, 5일은 상한 없음)
  const FLOW = [{ tier: [2, 2], zone: 1 }, { tier: [3, 3], zone: 2, open: 3 }, { tier: [4, 4], zone: 3 }, { tier: [4, 5], zone: 4 }, { tier: [5, 5], zone: 5 }];
  function flowCheck(runs) {
    const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
    const lines = ['흐름 (5번 중 가운데): 일 · 장비 단계(목표) · 다 치운 구역(목표) · 열린 구역 · 장비 점수 · 번 귤 · 할 일 없던 분'];
    let ok = true; const sh = [];
    FLOW.forEach((f, d) => {
      const ds = runs.map((r) => r.days[d]).filter(Boolean); if (!ds.length) { ok = false; return; }
      const tier = med(ds.map((x) => Math.min(x.e.tool, x.e.bag, x.e.shoes))), zone = med(ds.map((x) => { let z = 0; while (x.cleared.has(z + 1)) z++; return z; }));
      const sc = med(ds.map((x) => x.score)), er = med(ds.map((x) => x.earned)), idle = med(ds.map((x) => x.idle));
      const open = ZONES.filter((Z) => sc >= Z.rec * GROWTH.red).length;
      const good = tier >= f.tier[0] && tier <= f.tier[1] && zone >= f.zone && (d >= 4 || zone <= f.zone + 1) && (!f.open || open >= f.open); ok = ok && good;
      sh.push(`${d + 1}일 ${tier}단계·구역${zone}${good ? '' : '✗'}`);
      lines.push(`  ${d + 1}일 · ${tier}단계(${f.tier[0] === f.tier[1] ? f.tier[0] : f.tier.join('~')}) · 구역 ${zone}까지(${f.zone}) · 열림 ${open}${f.open ? `(${f.open})` : ''} · 점수 ${sc} · 귤 ${er.toLocaleString()} · ${idle}분 ${good ? '통과' : '✗'}`);
    });
    return { ok, lines, short: sh.join(' / ') };
  }
  for (const mode of ['battle']) for (const slack of SLACKS) {
    const runs = [1, 7, 42, 99, 123].map((s) => seedRun(mode, slack, s));
    const r = runs[2]; if (!day1Rate && slack === 0) day1Rate = r.days[0].earned; // 1일차에 실제로 번 귤 (1시간)
    const lasts = runs.map((x) => x.last).sort((a, b) => a - b), last = lasts[2];
    const title = `전투 오름 · ${slack ? `여유 ${slack * 100}%` : '효율'}`;
    console.log(`\n== ${title} (투기꾼 쫓아내기 ${CHASE * 100}%) ==`);
    console.log('하루 끝 (한 번 돌린 예). 칸은 단계 (배낭 0 = 호주머니, 옷 0 = 없음)');
    if (!FLOW_ONLY) console.table(r.days.map((d) => ({ 일: d.day, 도구: d.e.tool, 배낭: d.e.bag, 신발: d.e.shoes, 탈것: d.e.ride, ...(mode === 'battle' ? { 무기: d.weapon } : {}), ...Object.fromEntries(WK.map((k) => [short[k], d.e[k]])), 점수: d.score, '산 것': d.n, '오늘 다 치운 구역': d.zones, '번 귤': d.earned, '우두머리(누적)': d.boss, '할 일 없음(분)': d.idle, '남은 귤': d.coins })));
    // 흐름 (#137): 5번 돌린 것 모두 하루 끝을 보고, 가운데 값으로 판정
    const fl = flowCheck(runs);
    console.log(fl.lines.join('\n'));
    verdict.push(`${title}: 흐름 ${fl.ok ? '통과' : '실패'} (${fl.short})`);
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
  // 잭팟 (#55): 확률 p 로 귤 gyul. 잭팟이 걸리면 평소 대신 잭팟 한 번 (당기기 + 들어 보이기). 평균 벌이가 오름 1일차 시간당 귤의 절반 아래여야 함
  const J = F.jackpot, jcyc = F.castT + wait + F.pullT + F.showT + F.releaseT, base = fg / cyc * 3600;
  const avgC = (1 - J.p) * cyc + J.p * jcyc, avgG = (1 - J.p) * fg + J.p * J.gyul, tot = avgG / avgC * 3600;
  const day1 = day1Rate, lim = day1 * 0.5;
  console.log(`잭팟: 확률 1/${Math.round(1 / J.p)}, 귤 ${J.gyul} → 평균 시간당 약 ${Math.round(tot)} (잭팟만 +${Math.round(tot - base)}) · 시간당 잭팟 ${(3600 / avgC * J.p).toFixed(1)}번 · 오름 1일차 시간당 ${day1} 의 절반 ${Math.round(lim)} → ${tot <= lim ? '통과' : '넘음'}`);
}
main();
