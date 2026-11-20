// 쓰레기 더미 목록 (src/trash.js HEAP_DEFS 와 같은 순서·같은 서명). three 를 끌어오지 않으려고 계산만 따로 둠
import { ZONES, TRASH_TYPES, WEAR, DEX, NET } from '../../src/balance.js';
import { HEAP_DEFS, HEAP_FULL, HEAP_SIG } from '../../src/heapdefs.js'; // #138 게임과 같은 목록 (들판 더미·쓰레기 산까지)
export { HEAP_DEFS, HEAP_FULL, HEAP_SIG };
// 더미에서 하나 주울 때 벌 수 있는 귤의 위 끝 (#144): 구역 섞임(mix)의 평균 귤 × NET.earnPickSlack(종류 운 여유) × 구역 배수 gv × 가장 좋은 베스트
//   + 드문 것 몫(가장 좋은 모자, 2배 여유). 방이 받아 준 줍기마다 이만큼을 계정의 '번 몫'(earn_bank)에 더함 → 버린 귤은 이 몫 + 작은 몫(earnBurst) 안에서만 받아 줌
const wearTop = (k) => Math.max(...WEAR.slots.find((s) => s.k === k).v);
const RARE = DEX.rareGyul * Math.min(1, DEX.rareChance * wearTop('hat') * 2);
export const ZONE_GYUL = ZONES.map((Z) => TRASH_TYPES.reduce((s, t, j) => s + (Z.mix[j] || 0) * t.gyul, 0) * NET.earnPickSlack * (Z.gv || 1) * (1 + wearTop('vest')) + RARE);
// 쓰레기 산(#138)은 귤 값이 HEAP.sizes.mt.gv 배: 드문 것 몫은 그대로, 나머지에 (더미 gv ÷ 구역 gv) 를 곱함
export const HEAP_GYUL = HEAP_DEFS.map((d) => (ZONE_GYUL[d.zone - 1] - RARE) * d.gv / (ZONES[d.zone - 1].gv || 1) + RARE);
