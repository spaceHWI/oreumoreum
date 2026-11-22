// 철 이벤트 날짜·달력·트리 (#180). DOM·three 없음: 게임(src/game/season.js)·서버(server/src/validate.js, accounts.js)·도구가 같이 씀
// 날짜는 모두 한국 시각(KST, UTC+9). 서버는 자기 시계로 셈(기기 시계를 바꿔도 달력이 안 열림)
import { SEASON, CLOTHES } from './balance.js';

const X = SEASON.xmas;
// t(ms) → 한국 날짜 { y, m, d }
export function kst(t = Date.now()) { const k = new Date(t + 9 * 3600e3); return { y: k.getUTCFullYear(), m: k.getUTCMonth() + 1, d: k.getUTCDate() }; }
// 크리스마스 기간 안이면 그날(12월 며칠), 아니면 0
export function xmasDay(t = Date.now()) {
  const { m, d } = kst(t), [fm, fd] = X.from, [tm, td] = X.to;
  const v = m * 100 + d; return v >= fm * 100 + fd && v <= tm * 100 + td ? d : 0;
}
// 달력 칸 d(1~25)의 선물: { coins } 또는 { cloth } 또는 { snow: 1 }
export function calReward(d) {
  if (d === X.cal.days) return { snow: 1 };
  if (X.calCloth[d]) return { cloth: X.calCloth[d] };
  const [a, b] = X.cal.coins, steps = Math.round((b - a) / 10);
  return { coins: a + ((d * 37 + 11) % (steps + 1)) * 10 }; // 날마다 다르지만 정해진 값 (서버와 같게)
}
// 오늘(today) 열 수 있는 칸인지와 값: 오늘 = 무료, 지난 날 = 귤 miss. 앞날·기간 밖은 못 엶
export function calCost(d, today) { return d === today ? 0 : X.cal.miss; }
export const calOpenable = (d, today) => Number.isInteger(d) && d >= 1 && d <= X.cal.days && today >= 1 && d <= today;
// 달력·선물로 받는 겨울 옷 (서버가 값을 안 셈)
export const calClothIds = (days) => (days || []).map((d) => X.calCloth[d]).filter(Boolean);
export const XMAS_CLOTHES = CLOTHES.filter((c) => c.season === 'xmas' && !c.cal).map((c) => c.id); // 선물 상자로 나올 수 있는 겨울 옷 (다 열기 옷 cal 은 빼고)
// 다 열면 (#222): 25칸을 모두 열었는지 · 받은 다 열기 옷 (xs.full 이면 X.full.cloth, 서버가 값을 안 셈)
export const calAllOpen = (days) => Array.isArray(days) && new Set(days.filter((d) => Number.isInteger(d) && d >= 1 && d <= X.cal.days)).size >= X.cal.days;
export const fullClothIds = (xs) => (xs?.full ? [...X.full.cloth] : []);
// 트리 단계: 모두가 주운 수 → 0 ~ stages
export const treeStage = (n) => Math.max(0, Math.min(X.tree.stages, Math.floor((Number(n) || 0) / X.tree.step)));
export const treeGoal = () => X.tree.step * X.tree.stages;
// 저장 save.season.xmas = { days: [열린 칸], gift: [선물로 받은 옷 id], tree: 다 채운 선물 받음 1, snow: 눈덩이 고름 1, full: 다 열기 선물 받음 1 (#222), gd: 선물 상자 받은 날, gn: 그날 받은 수, seen: 본 트리 단계, lp: 서버 없이 할 때 기간에 주운 수 }
export function cleanXmas(o) {
  const v = o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  const days = Array.isArray(v.days) ? [...new Set(v.days.filter((d) => Number.isInteger(d) && d >= 1 && d <= X.cal.days))].sort((a, b) => a - b) : [];
  const gift = Array.isArray(v.gift) ? [...new Set(v.gift.filter((id) => XMAS_CLOTHES.includes(id)))].slice(0, X.santa.giftMax) : [];
  const int = (n, hi) => (Number.isInteger(n) && n >= 0 && n <= hi ? n : 0);
  return { days, gift, tree: v.tree ? 1 : 0, snow: v.snow ? 1 : 0, full: v.full ? 1 : 0, gd: int(v.gd, 31), gn: int(v.gn, 99), seen: int(v.seen, X.tree.stages), lp: int(v.lp, 1e7) };
}
