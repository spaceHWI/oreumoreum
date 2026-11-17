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
  { id: 'd-lap-1', ev: 'lap', goal: 1, name: '굼부리 한 바퀴', reward: 12, map: 'darangswi' },
  { id: 'd-lap-2', ev: 'lap', goal: 2, name: '굼부리 두 바퀴', reward: 20, map: 'darangswi' },
  { id: 'd-wall', ev: 'view-donnaeko', goal: 1, name: '남벽분기점 닿기', reward: 20, map: 'donnaeko' },
  { id: 'd-ns-ridge', ev: 'view-namsongi', goal: 1, name: '남송이 능선 오르기', reward: 12, map: 'namsongi', ns: true },
  { id: 'd-summit', ev: 'view-darangswi', goal: 1, name: '다랑쉬 굼부리 오르기', reward: 10, map: 'darangswi' },
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
  { id: 'd-visit-other', ev: 'visit-other', goal: 1, name: '다른 탐방로 가 보기', reward: 10 },
];

// 평생 업적 → 뱃지. glyph: 뱃지 위 글자, color: 뱃지 색, item: 보상 아이템 키
export const BADGES = [
  { id: 'b-first', ev: 'steps', goal: 1, name: '첫 발', desc: '처음으로 걸음을 뗐어요', glyph: '발', color: '#9c4a33', reward: 5 },
  { id: 'b-10k', ev: 'steps', goal: 10000, name: '만 보 러너', desc: '누적 10,000걸음', glyph: '만', color: '#4f7a36', reward: 30 },
  { id: 'b-50k', ev: 'steps', goal: 50000, name: '오름 지기', desc: '누적 50,000걸음', glyph: '지', color: '#2f6db5', reward: 80, item: 'shoes:c:#ffd23f' },
  { id: 'b-lap-10', ev: 'lap', goal: 10, name: '굼부리 열 바퀴', desc: '다랑쉬 굼부리를 10바퀴', glyph: '굼', color: '#c39a4c', reward: 40 },
  { id: 'b-wall', ev: 'view-donnaeko', goal: 1, name: '남벽 앞에서', desc: '돈내코 탐방로 끝 남벽분기점 도착', glyph: '벽', color: '#5e5a54', reward: 30, item: 'hat:c:#5e5a54' },
  { id: 'b-sunrise', ev: 'sunrise', goal: 1, name: '해돋이 러너', desc: '정상에서 실제 해돋이를 봤어요', glyph: '해', color: '#ff8a3d', reward: 40, item: 'hat:c:#ff8a3d' },
  { id: 'b-sunset', ev: 'sunset', goal: 1, name: '노을 러너', desc: '정상에서 실제 해넘이를 봤어요', glyph: '노', color: '#d0603a', reward: 40, item: 'shirt:c:#f2a46b' },
  { id: 'b-deer-friend', ev: 'follower', goal: 5, name: '노루 친구', desc: '동물이 다섯 번 따라왔어요', glyph: '친', color: '#b8865a', reward: 30, item: 'vest:c:#c9a27a' },
  { id: 'b-rider', ev: 'ride-dist', goal: 2000, name: '노루 기수', desc: '노루 타고 2km', glyph: '기', color: '#8a5a3a', reward: 30 },
  { id: 'b-stones', ev: 'stone', goal: 10, name: '돌탑 쌓는 사람', desc: '소원 돌 10개', glyph: '탑', color: '#4a4744', reward: 30 },
  { id: 'b-boar', ev: 'boar-repel', goal: 5, name: '멧돼지 조련사', desc: '멧돼지를 다섯 번 쫓았어요', glyph: '멧', color: '#4a3a30', reward: 30 },
  { id: 'b-photo', ev: 'photo', goal: 5, name: '인증샷 장인', desc: '표지석 인증샷 5장', glyph: '찰', color: '#33402a', reward: 20 },
  { id: 'b-hand', ev: 'hand', goal: 1, name: '함께 걷는 길', desc: '다른 사람과 손잡고 걸었어요', glyph: '손', color: '#e9719a', reward: 20 },
  { id: 'b-streak-3', ev: 'daily-all', goal: 3, name: '사흘 개근', desc: '오늘의 업적을 모두 마친 날 3일', glyph: '3', color: '#8f7bd6', reward: 40 },
  { id: 'b-streak-7', ev: 'daily-all', goal: 7, name: '일주일 개근', desc: '오늘의 업적을 모두 마친 날 7일', glyph: '7', color: '#7fb8e8', reward: 100, item: 'glasses:t:round' },
  { id: 'b-streak-30', ev: 'daily-all', goal: 30, name: '한 달 개근', desc: '오늘의 업적을 모두 마친 날 30일', glyph: '30', color: '#d6a13b', reward: 300 },
  { id: 'b-both', ev: 'visit-both', goal: 1, name: '두 길의 러너', desc: '다랑쉬와 돈내코 모두 걸었어요', glyph: '길', color: '#3e8f5a', reward: 20 },
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
  { id: 'b-gear-all', ev: 'gear-max-all', goal: 1, name: '완전 무장', desc: '장비를 전부 최고 단계까지', color: '#e8b94a', reward: 400 },
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
  if (!save.ach || typeof save.ach !== 'object') save.ach = {};
  const A = save.ach; // 예전 저장에 칸이 빠져 있어도 채움 (#16)
  for (const k of ['life', 'badges', 'visited']) if (!A[k] || typeof A[k] !== 'object') A[k] = {};
  A.daily ??= null; A.allDays ??= 0; A.lastAll ??= null;
  if (A.daily && !Array.isArray(A.daily.items)) A.daily = null;
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
  // 방문 기록
  if (mapId !== 'gate') A.visited[mapId] = 1;
  const otherVisited = Object.keys(A.visited).length;
  function claim(kind, id) {
    if (kind === 'daily') { const it = ensureDaily().items.find((x) => x.id === id); if (!it || !it.done || it.claimed) return null; it.claimed = true; persist(); return defD(id); }
    const b = A.badges[id]; if (!b || b.claimed) return null; b.claimed = true; persist(); return BADGES.find((x) => x.id === id);
  }
  const unclaimed = () => ensureDaily().items.filter((x) => x.done && !x.claimed).length + Object.values(A.badges).filter((b) => !b.claimed).length;
  return { emit, claim, ensureDaily, defD, unclaimed, state: A, firstVisitOther: () => otherVisited >= 2 };
}
