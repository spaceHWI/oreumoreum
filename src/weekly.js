// 주간 옷장 (#126) 셈. DOM·three 없음: 게임(LEAP 가게 game/stores.js)·서버(server/src/validate.js)·도구가 같이 씀
// 한 주 = 월요일 00:00 ~ 다음 월요일 00:00 (KST). 주 번호는 WEEKLY.epoch 부터 센 수, 차례는 그 수를 weeks 로 돌린 값 → 모두 같은 옷
import { WEEKLY, WEEKLY_CLOTHES } from './balance.js';

const WEEK = 7 * 864e5, DAY = 864e5;
export const weekNo = (t = Date.now()) => Math.floor((t - WEEKLY.epoch) / WEEK);
export const weekTurn = (t = Date.now()) => ((weekNo(t) % WEEKLY.weeks) + WEEKLY.weeks) % WEEKLY.weeks;
// 이번 주 옷 (CLOTHES 줄)
export const weeklyNow = (t = Date.now()) => { const w = weekTurn(t); return WEEKLY_CLOTHES.filter((c) => c.week === w); };
// 다음 월요일 00:00 KST 까지 남은 날 (1~7, 남은 시간이 하루 안이면 1)
export const weekLeftMs = (t = Date.now()) => WEEKLY.epoch + (weekNo(t) + 1) * WEEK - t;
export const weekLeftDays = (t = Date.now()) => Math.max(1, Math.ceil(weekLeftMs(t) / DAY));
export const WEEKLY_IDS = new Set(WEEKLY_CLOTHES.map((c) => c.id));
// 지금 살 수 있는 한정 옷 id. grace: 주가 바뀌기 앞뒤 이 시간 안이면 이웃 주 것도 (서버가 기기 시계 어긋남을 받아 줄 때)
export function weeklyBuyable(t = Date.now(), grace = 0) {
  const s = new Set(weeklyNow(t).map((c) => c.id));
  if (grace > 0) for (const c of weeklyNow(t - grace)) s.add(c.id);
  if (grace > 0) for (const c of weeklyNow(t + grace)) s.add(c.id);
  return s;
}
// 가게에 지금 내놓는 옷인지: 한정 옷(week 가 있음)은 이번 주 것만, 나머지는 늘
export const onShelf = (c, t = Date.now()) => !c.cave && !c.prize && !c.case && !c.tok && (c.week == null || weeklyNow(t).some((x) => x.id === c.id)); // 동굴 옷(#195)·달력 다 연 옷(#222 prize)은 가게에 없음
