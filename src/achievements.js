// 업적: 매일 바뀌는 오늘의 업적 5개 + 평생 업적(뱃지). 보상은 귤과 한정 아이템
// 이벤트 이름 → 진행도. emit(event, n)
import { ACH } from './balance.js';

// 오늘의 업적 풀. map: 그 맵에서만 가능한 것
export const DAILY_POOL = [
  // 남송이 풀 (ns): 쓰레기 줍기 기준 (#13)
  { id: 'd-trash-50', ev: 'trash', goal: 50, name: '쓰레기 50개 줍기', reward: 10, ns: true },
  { id: 'd-trash-150', ev: 'trash', goal: 150, name: '쓰레기 150개 줍기', reward: 25, ns: true },
  { id: 'd-recycle-2', ev: 'recycle', goal: 2, name: '클린하우스 2번 다녀오기', reward: 8, ns: true },
  { id: 'd-recycle-5', ev: 'recycle', goal: 5, name: '클린하우스 5번 다녀오기', reward: 20, ns: true },
  { id: 'd-foam-10', ev: 'trash-foam', goal: 10, name: '스티로폼 10개 줍기', reward: 10, ns: true },
  { id: 'd-gear-5', ev: 'trash-gear', goal: 5, name: '폐어구 5개 줍기', reward: 12, ns: true },
  { id: 'd-heap-1', ev: 'heap-clear', goal: 1, name: '쓰레기 더미 1곳 치우기', reward: 15, ns: true },
  { id: 'd-earn-100', ev: 'earn', goal: 100, name: '귤 100 벌기', reward: 10, ns: true },
  { id: 'd-top-20', ev: 'trash-top', goal: ACH.topPick.goal, name: `정상 근처에서 ${ACH.topPick.goal}개 줍기`, reward: 15, ns: true },
  { id: 'd-sunpick', ev: 'trash-sun', goal: ACH.sunPick.goal, name: `해돋이·해넘이 때 ${ACH.sunPick.goal}개 줍기`, reward: 20, ns: true },
  { id: 'd-rainpick', ev: 'trash-rain', goal: 5, name: '비 올 때 5개 줍기', reward: 15, ns: true },
  { id: 'd-steps-1500', ev: 'steps', goal: 1500, name: '천천히 1,500걸음', reward: 8, ns: true },
  { id: 'd-steps-4000', ev: 'steps', goal: 4000, name: '오늘은 4,000걸음', reward: 15, ns: true },
  { id: 'd-ns-ridge', ev: 'view-namsongi', goal: 1, name: '남송이 능선 오르기', reward: 12, map: 'namsongi', ns: true },
  { id: 'd-stone', ev: 'stone', goal: 1, name: '돌탑에 소원 하나', reward: 6, ns: true },
  { id: 'd-stone-2', ev: 'stone', goal: 2, name: '돌탑 두 곳에 돌 올리기', reward: 12 },
  { id: 'd-photo', ev: 'photo', goal: 1, name: '표지석 인증샷', reward: 10, ns: true },
  { id: 'd-feed', ev: 'feed', goal: 1, name: '동물에게 귤 주기', reward: 8 },
  { id: 'd-feed-3', ev: 'feed', goal: 3, name: '귤 세 번 나눠 주기', reward: 15 },
  { id: 'd-follow', ev: 'follower', goal: 1, name: '동물 친구와 함께 걷기', reward: 10 },
  { id: 'd-ride', ev: 'ride', goal: 1, name: '노루 타 보기', reward: 10 },
  { id: 'd-ride-dist', ev: 'ride-dist', goal: 300, name: '노루 타고 300m', reward: 15 },
  { id: 'd-hareubang', ev: 'hareubang', goal: 1, name: '하르방 코에 귤 맞히기', reward: 8 },
  { id: 'd-boar', ev: 'boar-repel', goal: 1, name: '멧돼지 귤로 쫓기', reward: 15 },
  { id: 'd-pickup', ev: 'pickup', goal: 8, name: '떨어진 귤 8개 줍기', reward: 6 },
  { id: 'd-sit', ev: 'sit', goal: 1, name: '쉼터에서 쉬어 가기', reward: 5, ns: true },
  { id: 'd-emote', ev: 'emote', goal: 5, name: '동작으로 다섯 번 말하기', reward: 5 }, // 호흡 대신 (#76)
  { id: 'd-dance-top', ev: 'dance-top', goal: 1, name: '전망 좋은 곳에서 춤추기', reward: 8 },
  { id: 'd-jump', ev: 'jump', goal: 20, name: '점프 20번', reward: 4 },
  { id: 'd-chat', ev: 'chat', goal: 1, name: '말풍선으로 인사', reward: 4 },
  { id: 'd-sign', ev: 'sign', goal: 1, name: '탐방 안내 읽기', reward: 3 },
  { id: 'd-sun', ev: 'sun-watch', goal: 1, name: '정상에서 해돋이나 해넘이 보기', reward: 25 },
];

// 평생 업적 → 뱃지. glyph: 뱃지 위 글자, color: 뱃지 색, item: 보상 아이템 키
export const BADGES = [
  { id: 'b-first', ev: 'steps', goal: 1, name: '첫 발', desc: '처음으로 걸음을 뗐어요', glyph: '발', color: '#9c4a33', reward: 5 },
  { id: 'b-10k', ev: 'steps', goal: 10000, name: '만 보 러너', desc: '누적 10,000걸음', glyph: '만', color: '#4f7a36', reward: 30 },
  { id: 'b-50k', ev: 'steps', goal: 50000, name: '오름 지기', desc: '누적 50,000걸음', glyph: '지', color: '#2f6db5', reward: 80, item: 'shoes:c:#ffd23f' },
  { id: 'b-sunrise', ev: 'sunrise', goal: 1, name: '해돋이 러너', desc: '정상에서 실제 해돋이를 봤어요', glyph: '해', color: '#ff8a3d', reward: 40, item: 'hat:c:#ff8a3d' },
  { id: 'b-sunset', ev: 'sunset', goal: 1, name: '노을 러너', desc: '정상에서 실제 해넘이를 봤어요', glyph: '노', color: '#d0603a', reward: 40, item: 'shirt:c:#f2a46b' },
  { id: 'b-deer-friend', ev: 'follower', goal: 5, name: '노루 친구', desc: '동물이 다섯 번 따라왔어요', glyph: '친', color: '#b8865a', reward: 30, item: 'vest:c:#c9a27a' },
  { id: 'b-stones', ev: 'stone', goal: 10, name: '돌탑 쌓는 사람', desc: '소원 돌 10개', glyph: '탑', color: '#4a4744', reward: 30 },
  { id: 'b-boar', ev: 'boar-repel', goal: 5, name: '멧돼지 조련사', desc: '멧돼지를 다섯 번 쫓았어요', glyph: '멧', color: '#4a3a30', reward: 30 },
  // 무기 첫 구매 (#123): 상점이 weapon-buy-<id> 를 알림
  { id: 'b-arm-bow', ev: 'weapon-buy-bow', goal: 1, name: '첫 귤 활', desc: '귤 활을 샀어요', glyph: '활', color: '#9a6b3a', reward: 20 },
  { id: 'b-arm-gun', ev: 'weapon-buy-gun', goal: 1, name: '귤 총잡이', desc: '귤 총을 샀어요', glyph: '총', color: '#e2683c', reward: 40 },
  { id: 'b-arm-mg', ev: 'weapon-buy-mg', goal: 1, name: '귤 소나기', desc: '귤 머신건을 샀어요', glyph: '연', color: '#c9473d', reward: 80 },
  { id: 'b-arm-laser', ev: 'weapon-buy-laser', goal: 1, name: '귤즙 광선', desc: '귤즙 레이저를 샀어요', glyph: '빛', color: '#ff9a1f', reward: 150 },
  { id: 'b-arm-bomb', ev: 'weapon-buy-bomb', goal: 1, name: '귤 폭탄 장인', desc: '귤 폭탄을 샀어요', glyph: '폭', color: '#3f9a5a', reward: 250 },
  { id: 'b-photo', ev: 'photo', goal: 5, name: '인증샷 장인', desc: '표지석 인증샷 5장', glyph: '찰', color: '#33402a', reward: 20 },
  { id: 'b-streak-3', ev: 'daily-all', goal: 3, name: '사흘 개근', desc: '오늘의 업적을 모두 마친 날 3일', glyph: '3', color: '#8f7bd6', reward: 40 },
  { id: 'b-streak-7', ev: 'daily-all', goal: 7, name: '일주일 개근', desc: '오늘의 업적을 모두 마친 날 7일', glyph: '7', color: '#7fb8e8', reward: 100, item: 'glasses:t:round' },
  { id: 'b-streak-30', ev: 'daily-all', goal: 30, name: '한 달 개근', desc: '오늘의 업적을 모두 마친 날 30일', glyph: '30', color: '#d6a13b', reward: 300 },
];

// 단계형 뱃지(#13): 같은 fam 은 한 칸에 단계가 올라감. 단계마다 따로 받음. 기존 id 는 그대로
const tiers = (fam, name, ev, desc, color, goals, rewards) => goals.map((goal, i) => ({ id: `b-${fam}-${i + 1}`, fam, tier: i + 1, tiers: goals.length, ev, goal, name, desc: desc(goal), color, reward: rewards[i] }));
const f = (n) => n.toLocaleString('ko-KR');
BADGES.push(
  ...tiers('trash', '줍는 사람', 'trash', (g) => `쓰레기 ${f(g)}개 줍기`, '#3f9a5a', [100, 1000, 10000, 100000], [20, 80, 300, 1200]),
  ...tiers('recycle', '재활용 단골', 'recycle', (g) => `클린하우스 ${f(g)}번 다녀오기`, '#3c7fc9', [10, 100, 1000], [20, 100, 500]),
  ...tiers('heap', '더미 해결사', 'heap-clear', (g) => `쓰레기 더미 ${f(g)}곳 치우기`, '#7a6a58', [10, 100], [40, 300]),
  ...tiers('dex', '도감 수집가', 'dex', (g) => `쓰레기 도감 ${g}종 채우기`, '#8f7bd6', [10, 20, 30], [30, 100, 300]),
  { id: 'b-kind-can', ev: 'trash-can', goal: 500, name: '캔 박사', desc: '캔 500개 줍기', color: '#d8423a', reward: 60 },
  { id: 'b-kind-pet', ev: 'trash-pet', goal: 500, name: '페트병 박사', desc: '페트병 500개 줍기', color: '#5bb0d6', reward: 60 },
  { id: 'b-kind-vinyl', ev: 'trash-vinyl', goal: 500, name: '비닐 박사', desc: '비닐 500개 줍기', color: '#9aa0aa', reward: 60 },
  { id: 'b-kind-foam', ev: 'trash-foam', goal: 500, name: '스티로폼 박사', desc: '스티로폼 500개 줍기', color: '#c9c3a8', reward: 80 },
  { id: 'b-kind-gear', ev: 'trash-gear', goal: 500, name: '폐어구 박사', desc: '폐어구 500개 줍기', color: '#e2683a', reward: 100 },
  { id: 'b-gear-one', ev: 'gear-max-one', goal: 1, name: '장비 단련', desc: '장비 하나를 최고 단계까지', color: '#c39a4c', reward: 100 },
  { id: 'b-rank-10', ev: 'rank-top10', goal: 1, name: '오늘의 열 명', desc: '오늘 랭킹 10위 안에 들었어요', color: '#ff9a1f', reward: 50 }, // 랭킹 (#11)
  { id: 'b-rank-1', ev: 'rank-top1', goal: 1, name: '오늘의 일등', desc: '오늘 랭킹 1위를 했어요', color: '#e8b94a', reward: 150 },
  { id: 'b-gear-all', ev: 'gear-max-all', goal: 1, name: '완전 무장', desc: '장비를 전부 최고 단계까지', color: '#e8b94a', reward: 400 },
  // 칭호가 열리는 업적 (#165, 칭호 글은 punktext.js TITLES). 사건은 game/punkworld.js 가 냄 (stare·trash-day-500·quest-boss1·note-all)
  { id: 'b-earn-10k', ev: 'earn', goal: 10000, name: '귤값 하는 사람', desc: '귤 10,000개 벌기', color: '#ff9a1f', reward: 50 },
  { id: 'b-stare', ev: 'boar-stare', goal: 1, name: '멧돼지와 눈싸움', desc: '멧돼지 앞에서 10초 동안 안 맞고 버티기', color: '#6b4a36', reward: 20 },
  { id: 'b-unpaid', ev: 'trash-day-500', goal: 1, name: '오늘도 무급', desc: '하루에 쓰레기 500개 줍기', color: '#5a7a4a', reward: 50 },
  { id: 'b-alien-cs', ev: 'enemy-repel-alien', goal: 20, name: '외계인 민원 담당', desc: '외계인을 스무 번 쫓아냈어요', color: '#5fae8a', reward: 60 },
  { id: 'b-crow', ev: 'crow-steal', goal: 1, name: '까마귀 밥', desc: '까마귀에게 뭔가를 털렸어요', color: '#3a3d48', reward: 10 }, // #163 까마귀 도둑이 사건을 냄
  { id: 'b-hare-five', ev: 'hareubang-five', goal: 10, name: '하르방 단짝', desc: '하르방과 하이파이브 열 번', color: '#6f6a62', reward: 30 }, // #163 하르방 하이파이브가 사건을 냄
  { id: 'b-dumper', ev: 'dumper-repel', goal: 30, name: '투기꾼의 악몽', desc: '무단 투기꾼을 서른 번 쫓아냈어요', color: '#8a4a3a', reward: 60 },
  { id: 'b-guard-1', ev: 'quest-boss1', goal: 1, name: '숲길 지킴이', desc: '오름지기 퀘스트 \'구역의 주인\' 을 끝냈어요', color: '#4f7a36', reward: 20 },
  { id: 'b-notes', ev: 'note-all', goal: 1, name: '쪽지 수집가', desc: '주운 쪽지 30장을 다 모았어요', color: '#c9a86a', reward: 80 },
  { id: 'b-ending', ev: 'story-end', goal: 1, name: '은하 환경미화원', desc: '외계인의 사과를 받아 냈어요', color: '#3d4a7a', reward: 20 }, // #168 엔딩
);

export const kstDate = (t = Date.now()) => { const k = new Date(t + 9 * 3600000); return `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, '0')}-${String(k.getUTCDate()).padStart(2, '0')}`; };

function seeded(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }

// 날짜로 정해지는 오늘의 업적 5개: 모두에게 같음. 맵 전용은 최대 2개, 보상 높은 것 1개 포함
// 지금 열려 있는 맵(남송이오름)에서 할 수 있는 것만 오늘의 업적으로 뽑음
const usable = (a) => !!a.ns;
export function todaysDaily(date) {
  const r = seeded('oreum-' + date);
  const pool = DAILY_POOL.filter(usable);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const out = []; let mapOnly = 0; const evs = new Set();
  for (const a of pool) {
    if (out.length >= 5) break;
    if (evs.has(a.ev)) continue;
    if (a.map && mapOnly >= 2) continue;
    out.push(a); evs.add(a.ev); if (a.map) mapOnly++;
  }
  return out;
}

export function createAchievements({ save, persist, onDone, mapId }) {
  if (!save.ach || typeof save.ach !== 'object') save.ach = { daily: null, life: {}, badges: {}, allDays: 0, lastAll: null };
  const A = save.ach;
  for (const k of ['life', 'badges']) if (!A[k] || typeof A[k] !== 'object') A[k] = {}; // 예전·깨진 저장 (#16)
  if (A.daily && (typeof A.daily !== 'object' || !Array.isArray(A.daily.items))) A.daily = null;
  delete A.visited; for (const id of Object.keys(A.badges)) if (!BADGES.some((b) => b.id === id)) delete A.badges[id]; // 지운 뱃지는 받은 기록도 지움 (#88)
  A.allDays = Math.max(0, Math.floor(Number(A.allDays)) || 0);
  function ensureDaily() {
    const d = kstDate();
    if (!A.daily || A.daily.date !== d || A.daily.items.some((x) => { const f = DAILY_POOL.find((y) => y.id === x.id); return !f || (!usable(f) && !x.done); })) {
      A.daily = { date: d, items: todaysDaily(d).map((x) => ({ id: x.id, prog: 0, done: false, claimed: false })) };
      persist();
    }
    return A.daily;
  }
  ensureDaily();
  const defD = (id) => DAILY_POOL.find((x) => x.id === id);
  function emit(ev, n = 1) {
    const daily = ensureDaily();
    let changed = false;
    for (const it of daily.items) {
      const def = defD(it.id); if (!def || it.done || def.ev !== ev) continue;
      it.prog = Math.min(def.goal, it.prog + n); changed = true;
      if (it.prog >= def.goal) { it.done = true; onDone({ kind: 'daily', def }); }
    }
    // 평생
    A.life[ev] = (A.life[ev] || 0) + n;
    for (const b of BADGES) {
      if (b.ev !== ev || A.badges[b.id]) continue;
      if (A.life[ev] >= b.goal) { A.badges[b.id] = { at: Date.now(), claimed: false }; changed = true; onDone({ kind: 'badge', def: b }); }
    }
    if (daily.items.every((x) => x.done) && A.lastAll !== daily.date) { A.lastAll = daily.date; A.allDays++; onDone({ kind: 'allday' }); emitLife('daily-all', 1); }
    if (changed) persist();
  }
  function emitLife(ev, n) { // daily 없이 평생만
    A.life[ev] = (A.life[ev] || 0) + n;
    for (const b of BADGES) { if (b.ev !== ev || A.badges[b.id]) continue; if (A.life[ev] >= b.goal) { A.badges[b.id] = { at: Date.now(), claimed: false }; onDone({ kind: 'badge', def: b }); } }
    persist();
  }
  function claim(kind, id) {
    if (kind === 'daily') { const it = ensureDaily().items.find((x) => x.id === id); if (!it || !it.done || it.claimed) return null; it.claimed = true; persist(); return defD(id); }
    const b = A.badges[id]; if (!b || b.claimed) return null; b.claimed = true; persist(); return BADGES.find((x) => x.id === id);
  }
  const unclaimed = () => ensureDaily().items.filter((x) => x.done && !x.claimed).length + Object.values(A.badges).filter((b) => !b.claimed).length;
  return { emit, claim, ensureDaily, defD, unclaimed, state: A };
}
