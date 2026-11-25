// 쓰레기 더미 목록 (#45, #138): 자리와 상관없이 정해지는 순서. 저장·방의 heaps[i] 가 이 순서
// 게임(src/trash.js)과 서버(server/src/heaps.js)가 같이 씀 (three 없이 계산만)
// 앞쪽: 구역 순서대로 길가 더미(ZONES heaps, 큰 것부터) · 뒤쪽: 들판 더미(FIELD_HEAPS, #138, field: true)
// gv: 이 더미 쓰레기 귤 배수 (구역 ZONES gv × 쓰레기 산 HEAP.sizes.mt.gv)
import { HEAP, ZONES, FIELD_HEAPS } from './balance.js';

export const HEAP_DEFS = [];
ZONES.forEach((Z) => ['xl', 'l', 's'].forEach((k) => { for (let i = 0; i < (Z.heaps[k] || 0); i++) HEAP_DEFS.push({ zone: Z.id, k, n: Z.amt?.[k] ?? HEAP.sizes[k].n, gv: Z.gv || 1 }); }));
ZONES.forEach((Z) => ['mt', 'xl', 'l', 's'].forEach((k) => { for (let i = 0; i < (FIELD_HEAPS[Z.id]?.[k] || 0); i++) HEAP_DEFS.push({ zone: Z.id, k, n: HEAP.sizes[k].n, gv: (Z.gv || 1) * (HEAP.sizes[k].gv || 1), field: true }); }));
HEAP_DEFS.forEach((d) => { d.own = (HEAP.own || []).includes(d.k); }); // #300 사람마다 따로인 더미 (방이 남은 수를 모름)
export const HEAP_FULL = HEAP_DEFS.map((d) => d.n);
export const HEAP_OWN = HEAP_DEFS.map((d) => !!d.own);
// 서명: 구성이 바뀌면 저장·방의 더미가 가득 찬 상태로 새로 맞춰짐. 옛 클라이언트(h1)는 서명이 달라 혼자 하기처럼 됨 (online.js linkTrash)
export const HEAP_SIG = 'h2:' + HEAP_DEFS.map((d) => d.zone + d.k + d.n + (d.field ? 'f' : '')).join(',');
export const HEAP_TOTAL = HEAP_FULL.reduce((a, b) => a + b, 0);
