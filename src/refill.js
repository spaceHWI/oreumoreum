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

// 바닥 보장 (#300): 여러 명이 한 구역에 몰리면 방이 직접 채움 (투기꾼을 기다리지 않음). 수치 balance.js DUMP.floor
// H 남은 수, full 가득 찬 수, zones 더미 구역, act { 구역: 활동 인원 }, near 사람 가까이 있는 더미 번호 Set(채우지 않음),
// up { 구역: true } 지킴이가 서 있는 구역(빈 더미는 되살리지 않음), dt 지난 초. 반환 [더미 번호, 더할 수] 목록
// 구역 인원 n 이 minN 아래면 아무것도 안 함(혼자 할 때 그대로). 목표 = min(n × perHead, 구역 가득 × maxFrac), 한 번에 n × rate × dt 까지
// 받을 수 있는 더미에 고르게 나눔 (차례는 아래)
export function floorAdds(H, full, zones, act, near, up, dt) {
  const F = DUMP.floor, out = [];
  for (const [zs, n] of Object.entries(act)) {
    const z = +zs; if (!(n >= F.minN)) continue;
    let cur = 0, zf = 0; const idx = [];
    for (let i = 0; i < full.length; i++) if (zones[i] === z) { cur += H[i] | 0; zf += full[i]; idx.push(i); }
    const target = Math.min(n * F.perHead, Math.round(zf * F.maxFrac));
    let budget = Math.min(target - cur, Math.ceil(n * F.rate * dt)); if (budget <= 0) continue;
    const room = (i) => full[i] - (H[i] | 0) > 0, byRoom = (a, b) => (full[b] - H[b]) - (full[a] - H[a]);
    // 차례: 멀리 있고 남은 게 있는 더미 → 멀리 있는 빈 더미(지킴이가 서 있지 않을 때만) → 그래도 남으면 가까이 있지만 남은 게 있는 더미(이미 보이는 더미가 조금 커짐)
    let cand = idx.filter((i) => room(i) && !near.has(i) && H[i] > 0).sort(byRoom);
    if (!up[z]) cand = cand.concat(idx.filter((i) => room(i) && !near.has(i) && !(H[i] > 0)).sort(byRoom));
    cand = cand.concat(idx.filter((i) => room(i) && near.has(i) && H[i] > 0).sort(byRoom));
    while (budget > 0 && cand.length) {
      const each = Math.max(1, Math.ceil(budget / cand.length)), next = [];
      for (const i of cand) {
        if (budget <= 0) break;
        const have = out.find((o) => o[0] === i), room = full[i] - (H[i] | 0) - (have ? have[1] : 0), k = Math.min(each, room, budget);
        if (k <= 0) continue;
        if (have) have[1] += k; else out.push([i, k]);
        budget -= k; if (room - k > 0) next.push(i);
      }
      cand = next;
    }
  }
  return out;
}
