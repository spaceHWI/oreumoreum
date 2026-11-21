// 오늘의 할 일 (#125): 날마다 바뀌는 할 일 3개 + 이어 오기. 그림·DOM 없음 (게임 achievements.js·서버 earn.js·tools 가 같이 씀)
// - 하루는 한국 시간 자정. 날짜(kstDate)로 정해져 모든 사람이 같은 3개를 받음: 싸움(fight)·치우기(heal)·만남(meet) 하나씩, 이 차례로
// - x2: 그 조건(비 rain · 해 진 뒤 night)일 때는 두 배로 셈 (그날 날씨·시간에 맞는 할 일. 조건이 안 맞아도 할 수는 있음)
// - 보상: 가 본 가장 깊은 구역에 맞춤 (balance.js DAILY). 한 개 gyul, 셋 다 all 배 더, 이어 오기 3·7·14일째 run 배
// - 이어 오기: 튜토리얼을 마친 뒤 들어온 날마다 하나. 어제 왔으면 +1, 하루라도 빠지면 다시 1
// 저장 save.ach.daily = { date, items: [{ id, prog, done, claimed }], all: 받았으면 1, seen: 토스트를 보였으면 1 }
//      save.ach.run = { n: 연속 날 수, last: 마지막으로 센 날(kstDay), got: [이번 연속에서 받은 날 수] }
import { DAILY } from './balance.js';

export const kstDate = (t = Date.now()) => { const k = new Date(t + 9 * 3600000); return `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, '0')}-${String(k.getUTCDate()).padStart(2, '0')}`; };
export const kstDayN = (t = Date.now()) => Math.floor((t + 9 * 3600e3) / 864e5);
export const dateOfDay = (d) => kstDate(d * 864e5 - 9 * 3600e3 + 1);

// ev: 업적 사건 이름(achievements emit). goal: 해야 할 수
export const TASKS = [
  // 싸움
  { id: 't-repel-5', cat: 'fight', ev: 'enemy-repel', goal: 5, name: '적 5마리 쫓아내기' },
  { id: 't-repel-12', cat: 'fight', ev: 'enemy-repel', goal: 12, name: '적 12마리 쫓아내기 · 해 진 뒤엔 두 배', x2: 'night' },
  { id: 't-dumper-2', cat: 'fight', ev: 'dumper-repel', goal: 2, name: '투기꾼 2명 쫓아내기' },
  { id: 't-smoker', cat: 'fight', ev: 'smoker-repel', goal: 1, name: '들머리 흡연자 쫓기' },
  { id: 't-hareubang', cat: 'fight', ev: 'hareubang', goal: 1, name: '하르방 코에 귤 맞히기' },
  // 치우기·쉬기
  { id: 't-trash-150', cat: 'heal', ev: 'trash', goal: 150, name: '쓰레기 150개 줍기' },
  { id: 't-trash-rain', cat: 'heal', ev: 'trash', goal: 80, name: '쓰레기 80개 줍기 · 비 오면 두 배', x2: 'rain' },
  { id: 't-heap-3', cat: 'heal', ev: 'heap-clear', goal: 3, name: '쓰레기 더미 3곳 다 치우기' },
  { id: 't-recycle-3', cat: 'heal', ev: 'recycle', goal: 3, name: '클린하우스 3번 다녀오기' },
  { id: 't-fish-3', cat: 'heal', ev: 'fish', goal: 3, name: '낚시 3번 · 비 오면 두 배', x2: 'rain' },
  { id: 't-top-15', cat: 'heal', ev: 'trash-top', goal: 15, name: '정상 근처에서 15개 줍기 · 해 진 뒤엔 두 배', x2: 'night' },
  { id: 't-steps-4000', cat: 'heal', ev: 'steps', goal: 4000, name: '오늘은 4,000걸음' },
  // 만남·나눔
  { id: 't-hello-3', cat: 'meet', ev: 'emote-meet', goal: 3, name: '다른 사람에게 인사 3번 (동작)' },
  { id: 't-photo', cat: 'meet', ev: 'photo', goal: 1, name: '정상 표지석 인증샷' },
  { id: 't-meal', cat: 'meet', ev: 'meal', goal: 1, name: '식당에서 한 끼' },
  { id: 't-feed', cat: 'meet', ev: 'feed', goal: 1, name: '노루에게 귤 주기' },
  { id: 't-stone', cat: 'meet', ev: 'stone', goal: 1, name: '돌탑에 돌 올리기' },
  { id: 't-cart', cat: 'meet', ev: 'cart', goal: 1, name: '마차 타기' },
  { id: 't-chat', cat: 'meet', ev: 'chat', goal: 1, name: '말풍선으로 인사' },
];
export const TASK_BY = Object.fromEntries(TASKS.map((t) => [t.id, t]));
export const CATS = ['fight', 'heal', 'meet'];
export const CAT_NAME = { fight: '싸움', heal: '치우기', meet: '만남' };

function seeded(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }

// 날짜(YYYY-MM-DD)의 할 일 3개. 어제와 같은 것은 되도록 피함
const pickRaw = (date) => { const r = seeded('oreum-todo-' + date); return CATS.map((c) => { const l = TASKS.filter((t) => t.cat === c); return l[Math.floor(r() * l.length)]; }); };
export function todaysTasks(date) {
  const r = seeded('oreum-todo-' + date), prev = new Set(pickRaw(dateOfDay(dayOf(date) - 1)).map((t) => t.id));
  return CATS.map((c) => { const l = TASKS.filter((t) => t.cat === c); let t = l[Math.floor(r() * l.length)]; if (prev.has(t.id)) t = l[(l.indexOf(t) + 1 + Math.floor(r() * (l.length - 1))) % l.length]; return t; });
}
export function dayOf(date) { const [y, m, d] = String(date).split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 864e5); } // kstDayN 과 같은 날 번호

// 보상 (귤). z: 가 본 가장 깊은 구역 (1~5, 없으면 1)
const zi = (z) => Math.max(1, Math.min(DAILY.gyul.length, Math.floor(Number(z)) || 1)) - 1;
export const taskGyul = (z) => DAILY.gyul[zi(z)];
export const allGyul = (z) => Math.round(DAILY.gyul[zi(z)] * DAILY.all);
export const runGyul = (n, z) => Math.round(DAILY.gyul[zi(z)] * (DAILY.run[n] || 0));
export const RUN_DAYS = Object.keys(DAILY.run).map(Number).sort((a, b) => a - b);
// 하루 최대 (할 일 셋 + 셋 다 + 그날 이어 오기)
export const dayMax = (z, runN = 0) => taskGyul(z) * 3 + allGyul(z) + runGyul(runN, z);

// 이어 오기: 오늘(day) 들어옴 → 새 run (같은 날이면 그대로). 반환 { run, step: 새로 센 날이면 true }
export function runStep(run, day) {
  const o = run && typeof run === 'object' ? run : {};
  let n = Math.max(0, Math.floor(Number(o.n)) || 0), last = Math.floor(Number(o.last)) || 0, got = Array.isArray(o.got) ? o.got.filter((x) => RUN_DAYS.includes(x)) : [];
  if (last === day && n > 0) return { run: { n, last, got }, step: false };
  if (last === day - 1 && n > 0) n++; else { n = 1; got = []; }
  return { run: { n, last: day, got }, step: true };
}
