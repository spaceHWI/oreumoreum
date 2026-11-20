// 쓰레기 더미 목록 (src/trash.js HEAP_DEFS 와 같은 순서·같은 서명). three 를 끌어오지 않으려고 계산만 따로 둠
import { HEAP, ZONES, TRASH_TYPES, WEAR, DEX, NET } from '../../src/balance.js';
export const HEAP_DEFS = [];
ZONES.forEach((Z) => ['xl', 'l', 's'].forEach((k) => { for (let i = 0; i < (Z.heaps[k] || 0); i++) HEAP_DEFS.push({ zone: Z.id, k, n: Z.amt?.[k] ?? HEAP.sizes[k].n }); }));
export const HEAP_FULL = HEAP_DEFS.map((d) => d.n);
export const HEAP_SIG = 'h1:' + HEAP_DEFS.map((d) => d.zone + d.k + d.n).join(',');
// 더미에서 하나 주울 때 벌 수 있는 귤의 위 끝 (#144): 구역 섞임(mix)의 평균 귤 × NET.earnPickSlack(종류 운 여유) × 구역 배수 gv × 가장 좋은 베스트
//   + 드문 것 몫(가장 좋은 모자, 2배 여유). 방이 받아 준 줍기마다 이만큼을 계정의 '번 몫'(earn_bank)에 더함 → 버린 귤은 이 몫 + 작은 몫(earnBurst) 안에서만 받아 줌
const wearTop = (k) => Math.max(...WEAR.slots.find((s) => s.k === k).v);
const RARE = DEX.rareGyul * Math.min(1, DEX.rareChance * wearTop('hat') * 2);
export const ZONE_GYUL = ZONES.map((Z) => TRASH_TYPES.reduce((s, t, j) => s + (Z.mix[j] || 0) * t.gyul, 0) * NET.earnPickSlack * (Z.gv || 1) * (1 + wearTop('vest')) + RARE);
export const HEAP_GYUL = HEAP_DEFS.map((d) => ZONE_GYUL[d.zone - 1]);
