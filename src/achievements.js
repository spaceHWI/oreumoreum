// 업적: 매일 바뀌는 오늘의 할 일 3개(#125, src/daily.js) + 이어 오기 + 평생 업적(뱃지). 보상은 귤과 한정 아이템
// 이벤트 이름 → 진행도. emit(event, n)
import { kstDate, kstDayN, todaysTasks, TASK_BY, taskGyul, allGyul, runGyul, runStep, RUN_DAYS } from './daily.js';
export { kstDate };

// 오늘의 할 일 (#125): 목록·고르기·보상은 src/daily.js (예전 '오늘의 업적 5개' DAILY_POOL 을 바꿈)

// 평생 업적 → 뱃지. glyph: 뱃지 위 글자, color: 뱃지 색, item: 보상 아이템 키
export const BADGES = [
  { id: 'b-first', ev: 'steps', goal: 1, name: '첫 발', desc: '처음으로 걸음을 뗐어요', glyph: '발', color: '#9c4a33', reward: 5 },
  { id: 'b-10k', ev: 'steps', goal: 10000, name: '만 보 러너', desc: '누적 10,000걸음', glyph: '만', color: '#4f7a36', reward: 30 },
  { id: 'b-50k', ev: 'steps', goal: 50000, name: '오름 지기', desc: '누적 50,000걸음', glyph: '지', color: '#2f6db5', reward: 80, item: 'shoes:c:#ffd23f' },
  { id: 'b-sunrise', ev: 'sunrise', goal: 1, name: '해돋이 러너', desc: '정상에서 실제 해돋이를 봤어요', glyph: '해', color: '#ff8a3d', reward: 40, item: 'hat:c:#ff8a3d' },
  { id: 'b-sunset', ev: 'sunset', goal: 1, name: '노을 러너', desc: '정상에서 실제 해넘이를 봤어요', glyph: '노', color: '#d0603a', reward: 40, item: 'shirt:c:#f2a46b' },
  { id: 'b-deer-friend', ev: 'follower', goal: 5, name: '노루 친구', desc: '동물이 다섯 번 따라왔어요', glyph: '친', color: '#b8865a', reward: 30, item: 'vest:c:#c9a27a' },
  { id: 'b-stones', ev: 'stone', goal: 10, name: '돌탑 쌓는 사람', desc: '소원 돌 10개', glyph: '탑', color: '#4a4744', reward: 30 },
  { id: 'b-nosmoke', ev: 'smoker-repel', goal: 10, name: '금연 구역 지킴이', desc: '들머리 흡연자를 열 번 쫓았어요', glyph: '금', color: '#c4513f', reward: 30 }, // #156
  { id: 'b-boar', ev: 'boar-repel', goal: 5, name: '멧돼지 조련사', desc: '멧돼지를 다섯 번 쫓았어요', glyph: '멧', color: '#4a3a30', reward: 30 },
  // 무기 첫 구매 (#123): 상점이 weapon-buy-<id> 를 알림
  { id: 'b-arm-bow', ev: 'weapon-buy-bow', goal: 1, name: '첫 귤 활', desc: '귤 활을 샀어요', glyph: '활', color: '#9a6b3a', reward: 20 },
  { id: 'b-arm-gun', ev: 'weapon-buy-gun', goal: 1, name: '귤 총잡이', desc: '귤 총을 샀어요', glyph: '총', color: '#e2683c', reward: 40 },
  { id: 'b-arm-mg', ev: 'weapon-buy-mg', goal: 1, name: '귤 소나기', desc: '귤 머신건을 샀어요', glyph: '연', color: '#c9473d', reward: 80 },
  { id: 'b-arm-laser', ev: 'weapon-buy-laser', goal: 1, name: '귤즙 광선', desc: '귤즙 레이저를 샀어요', glyph: '빛', color: '#ff9a1f', reward: 150 },
  { id: 'b-arm-bomb', ev: 'weapon-buy-bomb', goal: 1, name: '귤 폭탄 장인', desc: '귤 폭탄을 샀어요', glyph: '폭', color: '#3f9a5a', reward: 250 },
  { id: 'b-give', ev: 'gift-give', goal: 100, name: '귤 인심', desc: '귤 100개 나눠 주기', glyph: '심', color: '#f0902a', reward: 20 }, // 귤 주기 (#175, GIVE.achGoal)
  { id: 'b-photo', ev: 'photo', goal: 5, name: '인증샷 장인', desc: '표지석 인증샷 5장', glyph: '찰', color: '#33402a', reward: 20 },
  { id: 'b-streak-3', ev: 'daily-all', goal: 3, name: '사흘 개근', desc: '오늘의 할 일을 모두 마친 날 3일', glyph: '3', color: '#8f7bd6', reward: 40 },
  { id: 'b-streak-7', ev: 'daily-all', goal: 7, name: '일주일 개근', desc: '오늘의 할 일을 모두 마친 날 7일', glyph: '7', color: '#7fb8e8', reward: 100, item: 'glasses:t:round' },
  { id: 'b-run-3', ev: 'run-3', goal: 1, name: '사흘 연속', desc: '사흘 이어서 왔어요', glyph: '3', color: '#5aa06a', reward: 0 }, // 이어 오기 (#125): 귤은 daily.js runGyul
  { id: 'b-run-7', ev: 'run-7', goal: 1, name: '일주일 연속', desc: '이레 이어서 왔어요', glyph: '7', color: '#3f8fb0', reward: 0 },
  { id: 'b-run-14', ev: 'run-14', goal: 1, name: '두 주 연속', desc: '열나흘 이어서 왔어요', glyph: '14', color: '#c98a2a', reward: 0 },
  { id: 'b-streak-30', ev: 'daily-all', goal: 30, name: '한 달 개근', desc: '오늘의 할 일을 모두 마친 날 30일', glyph: '30', color: '#d6a13b', reward: 300 },
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
  { id: 'b-rare-gyul', ev: 'gyul-kind', goal: 4, name: '귀한 귤 감별사', desc: '한라봉·천혜향·레드향·황금향을 다 모았어요', color: '#ff9a1a', reward: 60 }, // #130 game/raregyul.js 가 처음 주운 종류마다 사건을 냄
  // 낚시 전용 (#124). 사건은 game/debug.js 낚시 reward 가 냄: fish(낚아 올린 것 하나)·fish-jackpot·fish-all·fish-rain·fish-night. 예전 저장의 life.fish 에서 이어 센다
  { id: 'b-fish-1', ev: 'fish', goal: 1, name: '첫 낚시', desc: '개울에서 처음 낚아 올렸어요', color: '#3c7fc9', reward: 5 },
  { id: 'b-fish-10', ev: 'fish', goal: 10, name: '낚시 입문', desc: '개울에서 열 번 낚아 올렸어요', color: '#3c7fc9', reward: 10 },
  { id: 'b-fish-50', ev: 'fish', goal: 50, name: '개울 낚시꾼', desc: '개울에서 쉰 번 낚아 올렸어요', color: '#2f6db5', reward: 30 },
  { id: 'b-fish-jack', ev: 'fish-jackpot', goal: 1, name: '대어를 낚다', desc: '큰 물고기를 낚아 귤이 와르르 터졌어요', color: '#e8b94a', reward: 30 },
  { id: 'b-fish-all', ev: 'fish-all', goal: 1, name: '개울 물고기 박사', desc: '개울에 사는 물고기를 모두 낚았어요', color: '#8f7bd6', reward: 40 },
  { id: 'b-fish-rain', ev: 'fish-rain', goal: 1, name: '비 오는 날의 낚시', desc: '비 오는 날 낚시를 했어요', color: '#5bb0d6', reward: 10 },
  { id: 'b-fish-night', ev: 'fish-night', goal: 1, name: '밤낚시', desc: '밤에 낚시를 했어요', color: '#3d4a7a', reward: 10 },
  { id: 'b-ending', ev: 'story-end', goal: 1, name: '은하 환경미화원', desc: '외계인의 사과를 받아 냈어요', color: '#3d4a7a', reward: 20 }, // #168 엔딩
);

// cond(kind): 지금 'rain'(비)·'night'(해 진 뒤)인가 · zone(): 가 본 가장 깊은 구역(보상) · active(): 오늘의 할 일을 셀 때인가(튜토리얼 중엔 아님)
export function createAchievements({ save, persist, onDone, mapId, cond = () => false, zone = () => 1, active = () => true }) {
  if (!save.ach || typeof save.ach !== 'object') save.ach = { daily: null, life: {}, badges: {}, allDays: 0, lastAll: null };
  const A = save.ach;
  for (const k of ['life', 'badges']) if (!A[k] || typeof A[k] !== 'object') A[k] = {}; // 예전·깨진 저장 (#16)
  if (A.daily && (typeof A.daily !== 'object' || !Array.isArray(A.daily.items))) A.daily = null;
  delete A.visited; for (const id of Object.keys(A.badges)) if (!BADGES.some((b) => b.id === id)) delete A.badges[id]; // 지운 뱃지는 받은 기록도 지움 (#88)
  A.allDays = Math.max(0, Math.floor(Number(A.allDays)) || 0);
  { const R = A.run && typeof A.run === 'object' ? A.run : {}; A.run = { n: Math.max(0, Math.floor(Number(R.n)) || 0), last: Math.floor(Number(R.last)) || 0, got: Array.isArray(R.got) ? R.got.filter((x) => RUN_DAYS.includes(x)) : [] }; } // 이어 오기 (#125)
  // 오늘 것이 아니면(날이 바뀜·예전 '오늘의 업적' 저장) 새로. 같은 날이면 같은 할 일의 진행은 남김
  function ensureDaily() {
    const d = kstDate(), want = todaysTasks(d).map((x) => x.id), D = A.daily;
    if (!D || D.date !== d || D.items.length !== want.length || D.items.some((x, i) => !x || x.id !== want[i])) {
      const old = D && D.date === d ? D.items : [];
      A.daily = { date: d, items: want.map((id) => { const o = old.find((x) => x && x.id === id); return o ? { id, prog: +o.prog || 0, done: !!o.done, claimed: !!o.claimed } : { id, prog: 0, done: false, claimed: false }; }), all: 0, seen: D && D.date === d ? D.seen || 0 : 0 };
      persist();
    }
    return A.daily;
  }
  ensureDaily();
  const defD = (id) => (TASK_BY[id] ? { ...TASK_BY[id], reward: taskGyul(zone()) } : null);
  function emit(ev, n = 1) {
    const daily = ensureDaily();
    let changed = false;
    if (active()) for (const it of daily.items) {
      const def = TASK_BY[it.id]; if (!def || it.done || def.ev !== ev) continue;
      const k = def.x2 && cond(def.x2) ? 2 : 1; // 그날 날씨·시간에 맞으면 두 배로 셈
      it.prog = Math.min(def.goal, it.prog + n * k); changed = true;
      if (it.prog >= def.goal) { it.done = true; onDone({ kind: 'daily', def: defD(it.id) }); }
    }
    // 평생
    A.life[ev] = (A.life[ev] || 0) + n;
    for (const b of BADGES) {
      if (b.ev !== ev || A.badges[b.id]) continue;
      if (A.life[ev] >= b.goal) { A.badges[b.id] = { at: Date.now(), claimed: !b.reward }; changed = true; onDone({ kind: 'badge', def: b }); }
    }
    if (daily.items.every((x) => x.done) && A.lastAll !== daily.date) { A.lastAll = daily.date; A.allDays++; onDone({ kind: 'allday' }); emitLife('daily-all', 1); }
    if (changed) persist();
  }
  function emitLife(ev, n) { // daily 없이 평생만
    A.life[ev] = (A.life[ev] || 0) + n;
    for (const b of BADGES) { if (b.ev !== ev || A.badges[b.id]) continue; if (A.life[ev] >= b.goal) { A.badges[b.id] = { at: Date.now(), claimed: !b.reward }; onDone({ kind: 'badge', def: b }); } }
    persist();
  }
  // kind 'daily' (id: 할 일) · 'all' (셋 다) · 'badge'. → { name, reward } | null
  function claim(kind, id) {
    if (kind === 'daily') { const it = ensureDaily().items.find((x) => x.id === id); if (!it || !it.done || it.claimed) return null; it.claimed = true; persist(); return defD(id); }
    if (kind === 'all') { const d = ensureDaily(); if (d.all || !d.items.every((x) => x.claimed)) return null; d.all = 1; persist(); return { name: '오늘의 할 일 모두', reward: allGyul(zone()) }; }
    const b = A.badges[id]; if (!b || b.claimed) return null; b.claimed = true; persist(); return BADGES.find((x) => x.id === id);
  }
  const allReady = () => { const d = ensureDaily(); return !d.all && d.items.every((x) => x.claimed); };
  // 이어 오기: 튜토리얼을 마친 뒤 들어와 있을 때 부름 (날이 바뀌면 다시). 3·7·14일째면 { n, reward } (귤은 부른 쪽이 줌, 뱃지는 여기서)
  function visit() {
    const r = runStep(A.run, kstDayN()); if (!r.step) return null;
    A.run = r.run; let out = null;
    const n = A.run.n;
    if (RUN_DAYS.includes(n) && !A.run.got.includes(n)) { A.run.got.push(n); out = { n, reward: runGyul(n, zone()) }; emitLife('run-' + n, 1); }
    persist(); return out;
  }
  const unclaimed = () => ensureDaily().items.filter((x) => x.done && !x.claimed).length + (allReady() ? 1 : 0) + Object.values(A.badges).filter((b) => !b.claimed).length;
  return { emit, claim, ensureDaily, defD, unclaimed, allReady, visit, state: A, allGyul: () => allGyul(zone()), taskGyul: () => taskGyul(zone()) };
}
