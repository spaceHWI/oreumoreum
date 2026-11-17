// 랭킹 날짜 (#11): 서버와 게임이 같이 씀. 한국 시각(UTC+9) 기준 날 번호와 그 주 월요일 날 번호
export const kstDay = (t = Date.now()) => Math.floor((t + 9 * 3600e3) / 864e5);
// 1970-01-01 은 목요일. 월요일 = 0 이 되게
export const weekStart = (d) => d - ((d + 3) % 7);
export const RANGES = ['day', 'week', 'all'];
export const SRVS = ['clean', 'battle'];
// 머리 아이콘 값 'hat:short|1' (머리 키 | 피부색 번호)
export function lookOf(save, hairOk) {
  const h = save?.outfit?.gear?.hair, k = typeof h === 'string' && hairOk(h) ? h : '';
  const sk = Math.max(0, Math.min(4, Math.floor(Number(save?.look?.skin)) || 0));
  return k ? `${k}|${sk}` : '';
}
