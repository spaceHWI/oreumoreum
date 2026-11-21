// 쓰레기 다시 쌓이는 속도 (#131): 같이 있는 사람 수 · 아무도 없는 동안. 그림 없이 셈만 (게임·서버 roomcore·tools 가 같이 씀)
// 수치는 balance.js DUMP (crowd*, offline*)
import { DUMP } from './balance.js';

// 사람 수 n(소수 가능, 1 미만은 1) → 오름 전체 쌓는 속도 배율 n^crowdExp
export const crowdMul = (n) => Math.pow(Math.max(1, Number(n) || 1), DUMP.crowdExp);
// 한 사람 몫 = 전체 배율 ÷ n (각자 자기 둘레 투기꾼이 이만큼씩 쌓음). 1명이면 1, 30명이면 약 0.5
export const crowdShare = (n) => { const k = Math.max(1, Number(n) || 1); return crowdMul(k) / k; };
// 간격 먼저 (#131): 몫이 줄면 공격·투기꾼 간격을 먼저 늘리고(최대 crowdGapMax 배), 모자란 만큼은 한 번에 쌓는 양을 줄임
export const crowdGap = (n) => Math.min(DUMP.crowdGapMax, 1 / crowdShare(n));

// 아무도 없던 sec 초 뒤 그 구역 빈자리가 채워지는 비율 0~1. 30분 절반·90분 가득 (offlineHalfMin·offlineMaxH, 처음에 더 빨리 차는 곡선)
// 가까운 구역은 offlineZone 배율만큼 빨리 참 (돌아온 초보가 바로 주울 수 있게)
const K = Math.log(0.5) / Math.log(1 - DUMP.offlineHalfMin / (DUMP.offlineMaxH * 60));
export function emptyFill(sec, zone) {
  if (!(sec > DUMP.offlineMin)) return 0;
  const T = DUMP.offlineMaxH * 3600 * (DUMP.offlineZone[zone] ?? 1), x = Math.min(1, sec / T);
  return 1 - Math.pow(1 - x, K);
}
// 더미마다 채울 수: left 남은 수, full 가득 찬 수, zones 더미의 구역 (같은 순서 배열). 반환 [더미 번호, 더할 수] 목록
export function offlineAdds(left, full, zones, sec) {
  const out = [];
  for (let i = 0; i < full.length; i++) {
    const room = full[i] - (left[i] | 0); if (room <= 0) continue;
    const f = emptyFill(sec, zones[i]), n = f >= 1 ? room : Math.round(room * f);
    if (n > 0) out.push([i, n]);
  }
  return out;
}
