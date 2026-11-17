// 쓰레기 더미 목록 (src/trash.js HEAP_DEFS 와 같은 순서·같은 서명). three 를 끌어오지 않으려고 계산만 따로 둠
import { HEAP, ZONES } from '../../src/balance.js';
export const HEAP_DEFS = [];
ZONES.forEach((Z) => ['xl', 'l', 's'].forEach((k) => { for (let i = 0; i < (Z.heaps[k] || 0); i++) HEAP_DEFS.push({ zone: Z.id, k, n: Z.amt?.[k] ?? HEAP.sizes[k].n }); }));
export const HEAP_FULL = HEAP_DEFS.map((d) => d.n);
export const HEAP_SIG = 'h1:' + HEAP_DEFS.map((d) => d.zone + d.k + d.n).join(',');
