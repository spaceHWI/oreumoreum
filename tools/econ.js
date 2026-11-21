// 귤 경제 계산 (#49, #53, #137 성장 루프). 지금 src/balance.js 수치로 "하루 1시간씩" 플레이를 흉내 내 칸 10개(도구·배낭·신발·무기 + 옷 6칸) 도달 시각을 낸다
//   node tools/econ.js              전투 오름(#98: 서버는 하나), 효율·여유 25% 각각 하루 끝 표와 마지막 칸 시각
//   node tools/econ.js --table      칸·단계별 도달 시각 표까지
//   node tools/econ.js --log        구매 기록까지
//   node tools/econ.js --slack 0.4  여유 비율 하나만 (기본은 0 과 0.25 둘 다)
//   node tools/econ.js --chase 0.3  투기꾼을 쫓아내는 비율 (기본 0.5)
//   node tools/econ.js --norides   탈것(#69) 없이 (비교용)
//   node tools/econ.js --skip      장비(도구·배낭·신발·무기)를 순서 없이 (#111): 튜토리얼 뒤에는 최고 단계 하나만 귤을 모아 바로 삼
//   node tools/econ.js --nosmoker  들머리 흡연자(#156) 없이 (비교용)
//   node tools/econ.js --flow       하루 끝 흐름 확인만 (#137)
//   node tools/econ.js --noaug      레벨은 세되 증강(#159)을 고르지 않음 (비교용. 기본은 벌이 증강을 먼저 고름: 큰손·분리수거 달인·가벼운 발·노루 친구)
//   node tools/econ.js --norare     귀한 귤(#130) 없이 (비교용)
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
// - 들판 떼 (#173): 놀이 시간의 SWARM.econ.share 만큼은 들판에서 떼를 쫓는다고 봄 (나가기마다 그 몫의 시간·귤을 더함, 일하는 구역·지금 무기).
//   떼 한 마리 = 보통 기운 × SWARM.mob.hp, 귤 = 보통 귤 × mob.gyul + 조각(shard ÷ shardN), 자동 던지기 간격 SWARM.auto, 맞힘 SW_HIT. 5분마다 대장 상자 반 개
//   목표: 들판 10분 귤 ≤ 길가 10분(그 구역 권장 장비로 치우기) × SWARM.econ.max, 마지막 칸이 --noswarm 보다 하루 넘게 당겨지지 않음
// - 우두머리 (#139): 일하는 구역이 ZONE_BOSS.appear 만큼 깨끗하고 장비 점수가 빨강이 아니면 쫓아냄 (돌하르방이 서 있는 holdSec 동안은 다시 안 나옴). --noboss 는 비교용
// - 레벨·증강 (#159): 경험치는 LEVEL.xp 그대로 (쓰레기·더미·적·투기꾼·우두머리) + 퀘스트(#158)는 하루 QUEST_N 개 × quest 평균으로 어림.
//   레벨업마다 src/augments.js rollDraw 3개 중 벌이에 드는 것을 먼저 고름(가장 빨라지는 쪽, 증강이 5일 목표를 얼마나 당기는지 보려고)
// - 흐름 (#137, notes/growth-loop.md 4절): 하루 끝 장비 단계(도구·배낭·신발 가장 낮은 것)와 그때까지 다 치운 구역이
//   1일 구역 1·2단계, 2일 구역 3까지·3단계, 3일 4단계, 4일 구역 4, 5일 5단계·구역 5 인지 봄 (단계는 빠르지도 늦지도 않게)
// - 재료·강화 (#140, src/loot.js): 적 쫓아내기 LOOT.enemy.mat · 소굴 LOOT.den.mats · 보물 LOOT.treasure.mats · 우두머리 귀한 재료 1 + LOOT.boss.mats (그 구역 재료, 기댓값으로 셈)
//   강화는 그 칸이 마지막 단계(도구·배낭·신발·옷 5, 무기 6)일 때만 (낮은 단계를 강화하면 새 단계를 살 때 귤로 바뀌어 헛됨: 넉넉히 셈). 칸 10개가 모두 +5 인 날 → 목표 6~14일 (--noenh 강화 없이)
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
  const AG = await import('../src/augments.js');
  const { LEVEL } = B, NOAUG = has('--noaug');
  const QUEST_N = [8, 4, 4, 4, 4, 3, 3], QUEST_XP = (LEVEL.xp.quest[0] + LEVEL.xp.quest[1]) / 2; // 하루 퀘스트 수(어림, #158)
  const AUG_PRI = ['bighand', 'recycle', 'light', 'deer', 'magnet', 'flower', 'bite', 'jacket', 'twin', 'burst', 'sour', 'quick']; // 벌이에 드는 것부터
  const { RIDES } = B;
  const { TRASH_TYPES, HEAP, ZONES, DUMP, TOOLS, BAGS, POCKET, SHOES, CLEANHOUSE, DEX, TUT, ENEMIES, ENEMY_SPAWN, WEAPONS, BOW, FISH, WEAR, CLOTHES, WEAR_START, wearPrice, GROWTH, FIELD, ZONE_BOSS, ZONE_GUARD, LOOT, STORY, SWARM, SMOKER } = B;
  const SMOKE_H = has('--nosmoker') ? 0 : 3600 * SMOKER.econNear / ((SMOKER.every[0] + SMOKER.every[1]) / 2) * SMOKER.reward; // 들머리 흡연자 (#156): 하루 1시간에 받는 귤 (들머리 둘레에 있는 시간 econNear)
  let SW_ON = !has('--noswarm'); const SW_HIT = 0.7, SW_MAXK = 0.6; // 들판 떼 (#173): 맞힘 비율, 초당 쫓아내는 수 상한(떼가 다가오는 빠르기. tools/swarm.js 권장 장비 200초에 0.44~0.58)
  const LT = await import('../src/loot.js'), NOENH = has('--noenh'), DAYS = NOENH ? 7 : 20;
  const NOFIELD = has('--nofield');
  const RG = await import('../src/raregyul.js'), NORARE = has('--norare'); // 귀한 귤 (#130): 쫓아낼 때 기댓값만큼 더함. --norare 로 빼고 견줌
  const rgEV = (who, g, mx) => (NORARE ? 0 : RG.rareEV(who, g, mx));
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
    const hx = hs.reduce((s, h) => s + (h.k === 'mt' ? LEVEL.xp.mt : LEVEL.xp.heap), 0) / n; // 쓰레기 하나에 얹히는 더미 경험치 (#159)
    return { id: Z.id, name: Z.name, n, avgD, step: tour / n, g, v, rec: Z.rec, hx };
  });
  const TOTAL = zones.reduce((s, z) => s + z.n, 0);
  // 쓰레기 하나 귤: 클린하우스 귤 × (1 + 베스트) + 드문 것(모자 배수)
  const ag = (e, id) => (e.aug ? (e.aug[id] || 0) * AG.AUG_BY[id].v : 0); // 증강 값 (#159, 장비 값에 더함)
  const gOf = (z, e) => z.g * (1 + wv(e, 'vest') + ag(e, 'recycle')) + DEX.rareChance * wv(e, 'hat') * DEX.rareGyul;
  const value = (e) => zones.reduce((s, z) => s + z.n * gOf(z, e), 0);

  const NORIDE = has('--norides'), SKIP = has('--skip'), RIDE_FLAT = 0.35, RIDE_OFF = 0.3, RIDE_T = 2;
  // 클린하우스 ↔ 구역 왕복 시간 (편도 d)
  function travel(e, d) {
    const walk = 2 * d / spdOf(e), R = e.ride ? RIDES.list[e.ride - 1] : null; if (!R) return walk;
    const m = (1 - RIDE_OFF) + RIDE_OFF * RIDES.off, b = RIDES.base * m;
    const rk = 1 + ag(e, 'deer'), fl = b * R.flat * rk, up = R.up ? b * R.up * rk : RIDES.carry * SHOES[e.shoes - 1].speed, dn = b * R.down * rk;
    const t = d * (RIDE_FLAT / fl + (1 - RIDE_FLAT) / up) + d * (RIDE_FLAT / fl + (1 - RIDE_FLAT) / dn) + RIDE_T;
    return Math.min(walk, t);
  }
  const toolOf = (e) => TOOLS[e.tool - 1], capOf = (e) => (e.bag ? BAGS[e.bag - 1] : POCKET).cap + wv(e, 'bottom'), spdOf = (e) => RUN * SHOES[e.shoes - 1].speed * (1 + ag(e, 'light'));
  // 한 번 나가기 (구역 z, 남은 수 left): 걸리는 초·귤·주운 수
  function trip(z, left, e) {
    const tool = toolOf(e), m = Math.min(left, Math.max(1, Math.floor(capOf(e) / z.v))), sp = spdOf(e);
    const t = travel(e, z.avgD) + m * z.step / sp + m * tool.time / tool.per / (1 + ag(e, 'bighand')) + CLEANHOUSE.dumpTime; // 큰손: 한 번에 더 주움
    return { t, gy: m * gOf(z, e), m, xp: m * (LEVEL.xp.trash + z.hx) };
  }
  const clearT = (z, e) => { let t = 0, left = z.n; while (left >= 1) { const r = trip(z, left, e); t += r.t; left -= r.m; } return t; };
  // 장비 점수 (#137, src/gearscore.js 와 같은 셈. 등급·강화는 아직 없음)
  const SC = GROWTH.score, EN = (e, k) => (e.enh && e.enh[k]) || 0, isc = (t, e, k) => LT.itemPts({ t, g: 0, e: EN(e, k) });
  const scoreOf = (e, w) => isc(e.tool, e, 'tool') + isc(e.bag, e, 'bag') + isc(e.shoes, e, 'shoes') + isc(w, e, 'weapon') + WEAR.slots.reduce((s, x) => s + isc(e[x.k], e, x.k), 0); void SC;
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
    return { t: 3 + k.t, gy: E.reward.gyul + rgEV(kind, E.reward.gyul, B.ENEMY_DROP.max) + E.reward.rare * DEX.rareGyul - Math.ceil(k.gy) };
  }

  // 들판 떼 (#173): 구역 z(번호)·무기 단계 wt 로 들판에 있는 1초의 귤 (조각 포함, 탄 값 뺌)
  function swarmRate(z, wt) {
    const w = WEAPONS[wt - 1], kinds = SWARM.kinds[z] || [['boar', 1]], ws = kinds.reduce((s, k) => s + k[1], 0), iv = SWARM.auto[w.id] || HAND_T;
    const per = w.id === 'mg' ? w.dmg / w.rate : w.id === 'laser' ? w.dmg * SWARM.auto.laser : w.dmg, area = w.id === 'bomb' ? 2 : 1;
    const cost = w.id === 'hand' ? 0 : w.id === 'bomb' ? w.cost : w.id === 'laser' ? w.gyulPerSec * iv : 1 / w.perGyul; // 한 발 귤
    let hp = 0, gy = 0; for (const [k, f] of kinds) { const E = ENEMIES[k]; hp += f / ws * E.hp * SWARM.mob.hp; gy += f / ws * E.reward.gyul * (SWARM.mob.gyul[z] ?? 0.25); }
    gy += (SWARM.shard[z] || 1) / SWARM.shardN;
    const kps = Math.min(SW_MAXK, per * area * SW_HIT / iv / hp), shotsPer = Math.max(1, Math.ceil(hp / per) / SW_HIT / area);
    return kps * (gy - shotsPer * cost) + (SWARM.leader.chest[z] || 0) * 0.5 / SWARM.leaderT;
  }
  const fmt = (sec) => `${Math.floor(sec / 3600) + 1}일 ${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}분`;
  const hm = (sec) => `${Math.floor(sec / 3600)}시간 ${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}분`;
  const GEAR = ['tool', 'bag', 'shoes'], WK = WEAR.slots.map((w) => w.k);
  function run(mode, slack) {
    const battle = mode === 'battle', S = 1 + slack; // 모든 행동 시간에 여유를 곱함 (벌지 않는 시간이 고르게 섞임)
    const e = { tool: 1, bag: 0, shoes: 1, ride: 0, ...START_W, enh: {}, aug: {} }, st = { xp: 0, lv: 1, lvSave: { lv: { aug: null } }, mats: {}, enhDay: 0, enhN: 0, coins: 0, weapon: 1, left: zones.map((z) => z.n), tAll: 0, denAt: {}, trDay: -1, trGot: new Set(), sights: new Set(), bossAt: {} };
    st.lvSave.lv.aug = e.aug; // 증강 뽑기(#159)가 지금 겹친 수를 봄
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
    const gotMat = (z, n, rare = 0) => { const M = LT.matOfZone(z); st.mats[M.id] = (st.mats[M.id] || 0) + n; if (rare) st.mats[M.rare] = (st.mats[M.rare] || 0) + rare; };
    // 강화 (#140): 마지막 단계 칸만, 강화가 낮은 칸부터
    const FINAL = Object.fromEntries([...GEAR, ...WK].map((k) => [k, 5])); FINAL.weapon = topOf('weapon') + 1;
    const enhAll = () => [...GEAR, ...WK, 'weapon'].every((k) => EN(e, k) >= GROWTH.enhMax);
    const enhShop = () => { if (NOENH || !battle) return; for (;;) {
      const ks = [...GEAR, ...WK, 'weapon'].filter((k) => cur(k) === FINAL[k] && EN(e, k) < GROWTH.enhMax).sort((a, b) => EN(e, a) - EN(e, b));
      const k = ks.find((k) => { const c = LT.enhCost(cur(k), EN(e, k)); return st.coins >= c.gyul && (st.mats[c.mat] || 0) >= c.n && (!c.rn || (st.mats[c.rare] || 0) >= c.rn); }); if (!k) return;
      const c = LT.enhCost(cur(k), EN(e, k)); st.coins -= c.gyul; st.mats[c.mat] -= c.n; if (c.rn) st.mats[c.rare] -= c.rn; e.enh[k] = EN(e, k) + 1; st.enhN++;
      if (enhAll() && !st.enhDay) st.enhDay = Math.min(st.tAll, dayEnd); } };
    const shop = () => { for (;;) { const ks = kinds.filter((k) => next(k) && st.coins >= next(k).price && ok(k)); if (!ks.length) break; buy(ks.sort((a, b) => gain(b) - gain(a))[0]); } enhShop(); };
    // 경험치 (#159): 레벨업마다 3개 중 벌이에 드는 것을 고름
    const gainXp = (x) => {
      if (!(x > 0)) return; st.xp += x;
      for (let lv = AG.levelOf(st.xp).lv; st.lv < lv; st.lv++) {
        if (NOAUG) continue;
        const d = AG.rollDraw(st.lvSave); if (!d) continue;
        const id = d.slice().sort((a, b) => AUG_PRI.indexOf(a) - AUG_PRI.indexOf(b))[0]; e.aug[id] = (e.aug[id] || 0) + 1;
      }
    };
    const cleared = new Set(); let idleT = 0, dumpT = 0, mobT = 0, cleanSeen, dayEnd = 3600, earned = 0;
    const zoneClean = (i) => 1 - st.left[i] / zones[i].n;
    for (let d = 0; d < DAYS; d++) {
      st.left = zones.map((z) => z.n); cleanSeen = new Set(); st.cur = null;
      let t = 0; const t0 = st.tAll, earned0 = earned; idleT = 0; dayEnd = t0 + 3599; // 하루 1시간을 넘긴 마지막 나가기에서 산 건 그날 끝으로 셈
      const add = (dt) => { t += dt * S; st.tAll += dt * S; };
      gainXp(QUEST_N[Math.min(d, QUEST_N.length - 1)] * QUEST_XP); // 퀘스트 (#158, 어림): 하루 처음에 한꺼번에
      if (d === 0) { // 튜토리얼: 쓰레기 6개 → 첫 보너스 → 집게·배낭
        t = TUT_MIN * 60; st.tAll += t; st.coins = TUT.firstBonus; buy('tool'); buy('bag'); st.tutDone = true;
      }
      while (t < 3600) {
        let b = best(st, e, cleanSeen) || (st.cur = null, best(st, e, new Set()));
        if (!b) { const sc = scoreOf(e, st.weapon); let j = 0; zones.forEach((z, k) => { if (sc >= z.rec * GROWTH.red) j = k; }); b = { i: j, r: { t: 30, gy: 0, m: 0 }, idle: true }; idleT += 30 * S; }
        const { r } = b; add(r.t); st.left[b.i] -= r.m; st.coins += r.gy; earned += r.gy; gainXp(r.xp);
        if (!b.idle && st.left[b.i] < 1) { cleanSeen.add(zones[b.i].id); cleared.add(zones[b.i].id); }
        // 투기꾼
        dumpT += r.t * S;
        while (dumpT >= DUMP.every) {
          dumpT -= DUMP.every; const truck = Math.random() < DUMP.truckP, def = truck ? DUMP.truck : DUMP.walker;
          if (Math.random() < CHASE) { const k = killOf(def.hp, battle ? weaponOf(st) : WEAPONS[0]); add(6 + k.t); gainXp(LEVEL.xp.dumper); const g = def.reward + rgEV(truck ? 'truck' : 'walker', def.reward) - Math.ceil(k.gy); st.coins += g; earned += g; }
          else { const wts = zones.map((z, i) => DUMP.zoneBase + zoneClean(i)), sum = wts.reduce((a, c) => a + c, 0); let x = Math.random() * sum, i = 0; while (i < 4 && x > wts[i]) { x -= wts[i]; i++; } st.left[i] = Math.min(zones[i].n, st.left[i] + (truck ? 80 : DUMP.walker.amt)); }
        }
        // 몹
        if (battle) {
          mobT += r.t * S * MOB_IN; const kind = ENEMY_SPAWN.byZone[zones[b.i].id];
          while (mobT >= ENEMY_SPAWN.every) { mobT -= ENEMY_SPAWN.every; const cnt = (ENEMY_SPAWN.group[0] + ENEMY_SPAWN.group[1]) / 2, f = mobFight(kind, st); add(f.t * cnt); gainXp(cnt * AG.enemyXp(ENEMIES[kind])); st.coins += f.gy * cnt; earned += f.gy * cnt; gotMat(zones[b.i].id, cnt * LOOT.enemy.mat); }
        }
        // 들판 떼 (#173): 이 나가기 시간에 견준 share 몫만큼 들판에서
        if (battle && SW_ON && !b.idle) { const sh = SWARM.econ.share, ft = r.t * sh / (1 - sh), g = ft * swarmRate(zones[b.i].id, st.weapon); add(ft); st.coins += g; earned += g; }
        // 들판 (#138): 일하는 구역의 열린 소굴 하나 · 오늘 안 연 보물 · 처음 보는 볼거리
        if (!NOFIELD && !has('--nospots') && battle) {
          const z = zones[b.i].id, DN = FIELD.den.n[z] || 0;
          for (let k = 0; k < DN; k++) { const id = z + '-' + k; if (st.tAll - (st.denAt[id] ?? -1e9) < FIELD.den.reopen) continue; st.denAt[id] = st.tAll;
            const cnt = (FIELD.den.group[0] + FIELD.den.group[1]) / 2, f = mobFight(ENEMY_SPAWN.byZone[z], st); add(20 + f.t * cnt); gainXp(cnt * AG.enemyXp(ENEMIES[ENEMY_SPAWN.byZone[z]])); const g = f.gy * cnt + FIELD.den.gyul[z]; st.coins += g; earned += g; gotMat(z, LOOT.den.mats[z] + cnt * LOOT.enemy.mat); break; }
          if (st.trDay !== d) { st.trDay = d; st.trGot = new Set(); }
          for (let k = 0; k < (FIELD.treasure.n[z] || 0); k++) { const id = z + '-' + k; if (st.trGot.has(id)) continue; st.trGot.add(id); add(25); const g = FIELD.treasure.gyul[z] + FIELD.treasure.rare * DEX.rareGyul; st.coins += g; earned += g; gotMat(z, LOOT.treasure.mats[z]); }
          FIELD.sight.list.forEach((x, k) => { if (x[0] !== z || st.sights.has(k)) return; st.sights.add(k); add(20); st.coins += FIELD.sight.gyul[z]; earned += FIELD.sight.gyul[z]; });
        }
        // 우두머리 (#139): 일하는 구역이 ZONE_BOSS.appear 만큼 깨끗하고 열린(빨강 아닌) 구역이면, 하르방이 서 있는 동안(holdSec) 빼고 한 번 (다가가기 20초 + 쫓아내기 × BOSS_OVER)
        if (battle && !b.idle && !has('--noboss')) {
          const z = zones[b.i].id, D = ZONE_BOSS.list[z];
          if (D && zoneClean(b.i) >= ZONE_BOSS.appear && scoreOf(e, st.weapon) >= zones[b.i].rec * GROWTH.red && st.tAll - (st.bossAt[z] ?? -1e9) >= ZONE_GUARD.holdSec) {
            st.bossAt[z] = st.tAll; const k = killOf(D.hp, weaponOf(st)); add(20 + k.t * BOSS_OVER); const g = D.gyul - Math.ceil(k.gy * BOSS_OVER); st.coins += g; earned += g; st.bosses = (st.bosses || 0) + 1; gotMat(z, LOOT.boss.mats[z], 1); gainXp(LEVEL.xp.boss);
          }
        }
        shop();
      }
      if (battle) { st.coins += SMOKE_H; earned += SMOKE_H; } // 흡연자 (#156)
      st.tAll = t0 + 3600; // 하루 1시간에서 넘친 부분은 버림
      days.push({ day: d + 1, coins: Math.round(st.coins), e: { ...e }, weapon: st.weapon, zones: [...cleanSeen].sort().join(','), cleared: new Set(cleared), idle: Math.round(idleT / 60), score: scoreOf(e, st.weapon), rate: Math.round(rateOf(e) * 3600), earned: Math.round(earned - earned0), n: buys.filter((b) => b.at >= t0 && b.at < t0 + 3600).length, boss: st.bosses || 0, enh: [...GEAR, ...WK, 'weapon'].reduce((s, k) => s + EN(e, k), 0), m5: Math.floor(st.mats.m5 || 0), r5: Math.floor(st.mats.r5 || 0), lv: st.lv, aug: { ...e.aug } });
      if (kinds.every((k) => !next(k)) && d >= 4 && (NOENH || !battle || enhAll())) break;
    }
    const last = buys.length && kinds.every((k) => !next(k)) ? buys[buys.length - 1].at : Infinity;
    return { buys, days, e, st, last };
  }

  // 같은 무작위 순서로 여러 번 돌려 가운데 값
  const seedRun = (mode, slack, s) => { let x = s; const orig = Math.random; Math.random = () => ((x = (x * 16807) % 2147483647) / 2147483647); try { return run(mode, slack); } finally { Math.random = orig; } };
  const e0 = { tool: 1, bag: 0, shoes: 1, ride: 0, ...START_W };
  console.log(`오름 전체 쓰레기 ${TOTAL}개, 귤로 ${Math.round(value(e0))} (베스트·모자 없이)`);
  console.log('구역', zones.map((z) => `${z.id}:${z.n}개·${Math.round(z.avgD)}m·귤${z.g.toFixed(2)}`).join('  '));
  { const e1 = { ...e0, tool: 2, bag: 1 }, z1 = zones[0], hs = map.heaps.filter((h) => h[0] === 1 && !h[4]), near = hs.map(([, , x, z]) => Math.hypot(x - map.front.x, z - map.front.z)).sort((a, b) => a - b); // #160 첫 구역: 집게·배낭 1단계로 다 치우는 시간, 들머리 클린하우스에서 길가 더미까지
    console.log(`구역 1 다 치움(집게·배낭1·신발1): ${(clearT(z1, e1) / 60).toFixed(1)}분 · 들머리 클린하우스에서 길가 더미 ${near.map(Math.round).join('/')}m`); }
  const sum = (L) => L.reduce((s, x) => s + (x.price || 0), 0);
  const wearSum = (k) => CLOTHES.filter((c) => c.slot === k && c.tier > START_W[k]).reduce((s, c) => s + wearPrice(c), 0);
  const WSUM = WK.reduce((s, k) => s + wearSum(k), 0);
  console.log(`권장 점수 ${ZONES.map((Z) => `${Z.id}:${Z.rec}`).join(' ')} · 단계 점수 ${GROWTH.score.join('/')} · 귤 배수 ${ZONES.map((Z) => Z.gv).join('/')}`);
  console.log(`값 합: 도구 ${sum(TOOLS)} · 배낭 ${sum(BAGS)} · 신발 ${sum(SHOES)} · 무기 ${sum(WEAPONS)} · 옷 6칸 ${WSUM} (${WK.map((k) => `${WS[k].name} ${wearSum(k)}`).join(' · ')}) = ${sum(TOOLS) + sum(BAGS) + sum(SHOES) + sum(WEAPONS) + WSUM}`);
  const short = { tool: '도구', bag: '배낭', shoes: '신발', weapon: '무기', ride: '탈것', ...Object.fromEntries(WEAR.slots.map((w) => [w.k, w.name])) };
  const verdict = []; let day1Rate = 0, storyEarn = 0;
  const FLOW_ONLY = has('--flow');
  // 하루 끝 목표 (#137): tier = 도구·배낭·신발 가장 낮은 단계, zone = 그날까지 다 치운 적 있는 가장 높은 구역 (이 구역까지는 다 치움)
  // tier = 도구·배낭·신발 가장 낮은 단계 [최소, 최대], zone = 그날까지 다 치운 가장 높은 구역(1부터 이어서) 최소, open = 하루 끝 장비 점수로 열린(빨강이 아닌) 구역 최소
  // 다 치운 구역은 목표 + 1 까지만 (너무 빠르지 않게, 5일은 상한 없음)
  // #173 들판 떼로 2일 끝 벌이가 몇 % 늘어 효율 플레이가 2일에 4단계에 닿을 때가 있음 → 2일 상한만 4 (기준은 '5일 목표가 하루 넘게 당겨지지 않음', 아래 들판 떼 줄)
  // #160 들머리 더미로 첫날 벌이가 조금 빨라져 효율 플레이는 1일에 신발 3단계까지 닿을 때가 있음 → 1일 상한만 3 (5일 목표가 하루 넘게 당겨지지 않는지는 아래 '마지막 칸' 이 봄)
  const FLOW = [{ tier: [2, 3], zone: 1 }, { tier: [3, 4], zone: 2, open: 3 }, { tier: [4, 4], zone: 3 }, { tier: [4, 5], zone: 4 }, { tier: [5, 5], zone: 5 }];
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
    // 레벨 (#159): 하루 끝 레벨 (5번 중 가운데). 목표 1일 5~6, 5일 14~16
    const LV_GOAL = { 0: [5, 6], 4: [14, 16] };
    const lvs = FLOW.map((f, d) => med(runs.map((r) => r.days[d]?.lv || 0)));
    const lvOk = Object.entries(LV_GOAL).every(([d, [a, b]]) => lvs[d] >= a && lvs[d] <= b);
    lines.push(`  레벨(하루 끝): ${lvs.map((v, d) => `${d + 1}일 ${v}`).join(' · ')} → 목표 1일 5~6 · 5일 14~16 ${lvOk ? '통과' : '✗'}`);
    { const r = runs[2], last = r.days[Math.min(4, r.days.length - 1)]; if (last?.aug) lines.push(`  증강(한 번 돌린 예, 5일 끝): ${Object.entries(last.aug).map(([k, n]) => `${AG.AUG_BY[k].name}×${n}`).join(' ') || '없음'}`); }
    return { ok: ok && lvOk, lines, short: sh.join(' / ') + ` / 레벨 ${lvs[0]}·${lvs[4]}${lvOk ? '' : '✗'}` };
  }
  for (const mode of ['battle']) for (const slack of SLACKS) {
    const runs = [1, 7, 42, 99, 123].map((s) => seedRun(mode, slack, s));
    const r = runs[2]; if (!day1Rate && slack === 0) day1Rate = r.days[0].earned; // 1일차에 실제로 번 귤 (1시간)
    if (slack === 0) storyEarn = r.days.slice(0, 5).reduce((a, d) => a + d.earned, 0); // #168
    const lasts = runs.map((x) => x.last).sort((a, b) => a - b), last = lasts[2];
    const title = `전투 오름 · ${slack ? `여유 ${slack * 100}%` : '효율'}`;
    console.log(`\n== ${title} (투기꾼 쫓아내기 ${CHASE * 100}%) ==`);
    console.log('하루 끝 (한 번 돌린 예). 칸은 단계 (배낭 0 = 호주머니, 옷 0 = 없음)');
    if (!FLOW_ONLY) console.table(r.days.map((d) => ({ 일: d.day, 도구: d.e.tool, 배낭: d.e.bag, 신발: d.e.shoes, 탈것: d.e.ride, ...(mode === 'battle' ? { 무기: d.weapon } : {}), ...Object.fromEntries(WK.map((k) => [short[k], d.e[k]])), 점수: d.score, '산 것': d.n, '오늘 다 치운 구역': d.zones, '번 귤': d.earned, '우두머리(누적)': d.boss, '할 일 없음(분)': d.idle, '남은 귤': d.coins, ...(NOENH ? {} : { '강화 합(50)': d.enh, '남은 외계 부품·핵': `${d.m5}·${d.r5}` }) })));
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
    if (!NOENH) { const ed = runs.map((x) => x.st.enhDay || Infinity).sort((a, b) => a - b)[2], day = ed === Infinity ? null : Math.floor(ed / 3600) + 1;
      const el = `${title}: 강화 칸 10개 +5 ${day ? `${day}일 (놀이 ${hm(ed)})` : `${DAYS}일 안에 못 채움`} → 목표 6~14일 ${day && day >= 6 && day <= 14 ? '통과' : '✗'}`; console.log(el); verdict.push(el); }
    if (LOG) r.buys.forEach((b) => console.log(b.when, short[b.k], b.tier, b.name, b.price));
  }
  // 이야기 이벤트 보상 (#168): 끝 보상 합이 5일(효율) 전체 벌이의 5% 아래
  if (storyEarn > 0) { const sum = STORY.list.reduce((a, d) => a + (d.gyul || 0), 0), pct = sum / storyEarn * 100; verdict.push(`이야기 이벤트 보상 합 ${sum} = 5일 벌이 ${storyEarn.toLocaleString()} 의 ${pct.toFixed(2)}% → 5% 아래 ${pct < 5 ? '통과' : '넘음'}`); }
  // 들판 떼 (#173): 구역 권장 장비(도구·배낭·신발·무기 = 구역 번호 단계)로 들판 10분 귤 vs 길가 10분 귤
  if (has('--swarm') || !FLOW_ONLY) {
    const rows = ZONES.map((Z, i) => { const t = Z.id, e = { ...e0, tool: Math.min(t, TOOLS.length), bag: Math.min(t, BAGS.length), shoes: Math.min(t, SHOES.length) }, road = zones[i].n * gOf(zones[i], e) / clearT(zones[i], e) * 600, fld = swarmRate(t, Math.min(t, WEAPONS.length)) * 600; return { 구역: t, '길가 10분': Math.round(road), '들판 10분': Math.round(fld), 배: +(fld / road).toFixed(2), '들판 초당': +(fld / 600).toFixed(1), ok: fld <= road * SWARM.econ.max && fld / 600 <= B.NET.swarmPerSec }; });
    console.log('\n들판 떼 (#173): 권장 장비로 10분 귤 (들판 ≤ 길가 × ' + SWARM.econ.max + ', 초당 ≤ 서버 ③ NET.swarmPerSec ' + B.NET.swarmPerSec + ')'); console.table(rows);
    verdict.push(`들판 떼 10분 귤: ${rows.every((r) => r.ok) ? '통과' : '넘음'} (${rows.map((r) => r.구역 + ':' + r.배).join(' ')})`);
    const lastOf = (on) => { SW_ON = on; const rs = [1, 7, 42, 99, 123].map((s) => seedRun('battle', 0.25, s)).map((x) => x.last).sort((a, b) => a - b); SW_ON = !has('--noswarm'); return rs[2]; };
    const a1 = lastOf(true), a0 = lastOf(false), pull = a0 - a1;
    verdict.push(`들판 떼로 마지막 칸(여유 25%) ${a0 === Infinity ? '-' : hm(a0)} → ${a1 === Infinity ? '-' : hm(a1)}: ${pull <= 3600 ? '하루 안 (통과)' : '하루 넘게 당겨짐'}`);
  }
  // 흡연자 (#156): 하루 1시간 벌이에서 흡연자 몫이 3% 아래 (가장 적게 버는 1일 기준)
  if (day1Rate) { const pct = SMOKE_H / day1Rate * 100; verdict.push(`흡연자 하루 귤 ${Math.round(SMOKE_H)} = 1일 벌이 ${day1Rate.toLocaleString()} 의 ${pct.toFixed(1)}% → 3% 아래 ${pct < 3 ? '통과' : '넘음'}`); }
  console.log('\n' + verdict.join('\n'));
  // 낚시: 한 번 = 던지기 + 기다림 + 반응 0.4 + 당기기 + (보여 주기 | 넣기) + 놓아주기/거두기
  const F = FISH, wait = (F.waitMin + F.waitMax) / 2 + 0.4, cyc = F.castT + wait + F.pullT + F.odds.fish * (F.showT + F.releaseT) + (1 - F.odds.fish) * F.stowT;
  const fg = F.odds.fish * F.fishGyul + F.odds.trash * 1 + F.odds.rare * (DEX.rareGyul + 2);
  console.log(`\n낚시: 한 번 ${cyc.toFixed(1)}초, 귤 ${fg.toFixed(2)} → 시간당 약 ${Math.round(fg / cyc * 3600)} (쓰레기는 클린하우스에 버려야 귤)`);
  // 잭팟 (#55): 확률 p 로 귤 gyul. 잭팟이 걸리면 평소 대신 잭팟 한 번 (당기기 + 들어 보이기). 평균 벌이가 오름 1일차 시간당 귤의 절반 아래여야 함
  const J = F.jackpot, jcyc = F.castT + wait + F.pullT + F.showT + F.releaseT, base = fg / cyc * 3600;
  const avgC = (1 - J.p) * cyc + J.p * jcyc, avgG = (1 - J.p) * fg + J.p * J.gyul, tot = avgG / avgC * 3600;
  const day1 = day1Rate, lim = day1 * 0.5;
  // 철 이벤트 (#180): 이벤트로 얻는 귤(달력 + 산타 선물 상자 하루 상한 + 트리 선물 ÷ 기간 날 수)의 하루 평균이 하루 벌이(1일차 1시간)의 10% 안
  { const { SEASON } = require('../src/balance.js'), cal = require('../src/seasoncal.js'), X = SEASON.xmas;
    const days = (X.to[1] - X.from[1]) + 1, calG = Array.from({ length: X.cal.days }, (_, i) => cal.calReward(i + 1).coins || 0).reduce((a, b) => a + b, 0);
    const santa = X.santa.dayMax * (1 - X.santa.gift) * (X.santa.coins[0] + X.santa.coins[1]) / 2, per = (calG + X.tree.gift) / days + santa, lim2 = day1 * 0.1;
    console.log(`크리스마스: 달력 귤 ${calG} + 트리 ${X.tree.gift} (${days}일) + 산타 상자 하루 최대 ${Math.round(santa)} → 하루 평균 ${Math.round(per)} · 하루 벌이(1일차 1시간) ${day1} 의 10% ${Math.round(lim2)} → ${per <= lim2 ? '통과' : '넘음'}`); }
  console.log(`잭팟: 확률 1/${Math.round(1 / J.p)}, 귤 ${J.gyul} → 평균 시간당 약 ${Math.round(tot)} (잭팟만 +${Math.round(tot - base)}) · 시간당 잭팟 ${(3600 / avgC * J.p).toFixed(1)}번 · 오름 1일차 시간당 ${day1} 의 절반 ${Math.round(lim)} → ${tot <= lim ? '통과' : '넘음'}`);
  // 퀘스트 (#158): 첫날(구역 1) 줄기 보상 합이 첫날 귤 벌이의 QUESTS.dayCap 을 넘지 않게. 둘째 날 이후 구역 줄도 그날 벌이(가운데 값)와 견줌
  { const Q = B.QUESTS, sum = (z) => Q.main.filter((q) => q.z === z).reduce((a, q) => a + (q.reward?.gyul || 0), 0), q1 = sum(1), cap = Math.round(day1 * Q.dayCap);
    console.log(`퀘스트: 첫날(구역 1) 보상 귤 ${q1} · 첫날 벌이 ${day1} 의 ${Math.round(Q.dayCap * 100)}% = ${cap} → ${q1 <= cap ? '통과' : '넘침 (보상을 줄일 것)'}`);
    console.log('  구역별 줄기 보상 합: ' + [1, 2, 3, 4, 5].map((z) => `구역 ${z} ${sum(z)}`).join(' · ')); }
  { // 오름펑크 (#165): 쪽지는 귤이 없음(쓰레기 수·귤은 보통 쓰레기와 같음). 칭호가 열리는 업적의 보상 합은 첫날 벌이의 10% 안
    const { NOTES, TITLES } = require('../src/punktext.js'), { BADGES } = require('../src/achievements.js'), src = fs.readFileSync(path.join(__dirname, '../src/game/punkworld.js'), 'utf8');
    const noGyul = NOTES.every((n) => !('gyul' in n) && !('reward' in n)) && !/addCoins|coins\s*[+-]?=|scatterTangerines/.test(src);
    const ids = new Set(TITLES.map((t) => t.badge)), add = BADGES.filter((b) => ids.has(b.id) && /^b-(earn-10k|stare|unpaid|alien-cs|crow|hare-five|dumper|guard-1|notes|ending)$/.test(b.id)), tot = add.reduce((s, b) => s + b.reward, 0), cap = Math.round(day1 * 0.1);
    console.log(`쪽지: ${NOTES.length}장, 귤 ${noGyul ? '0 (벌이 그대로)' : '있음'} · 칭호 ${TITLES.length}개, 새 업적 ${add.length}개 보상 합 귤 ${tot} · 첫날 벌이 ${day1} 의 10% ${cap} → ${noGyul && tot <= cap && TITLES.every((t) => BADGES.some((b) => b.id === t.badge)) ? '통과' : '넘음·없는 업적'}`);
  }
}
main();
