// 귀한 귤 셈 (#130): 쫓아낸 적·투기꾼의 귤 알갱이 하나가 가끔 한라봉·천혜향·레드향·황금향으로 바뀜. 값은 balance.js RARE_GYUL
// 게임(src/game/raregyul.js)과 tools/econ.js·tools/raregyul.js 가 같이 씀 (THREE 없음)
import { RARE_GYUL } from './balance.js';

export const RG_KINDS = RARE_GYUL.kinds;
export const RG_BY = Object.fromEntries(RG_KINDS.map((k, i) => [k.id, { ...k, i }]));
export const rgDexId = (id) => `gyul:${id}`;

// 보통 알갱이 하나의 귤: reward 를 maxN 알갱이로 나눔 (life.scatterTangerines 와 같게)
const unitOf = (reward, maxN) => reward / Math.max(1, Math.min(reward, maxN));

// who: 적 종류(ENEMIES 키) 또는 'walker'·'truck'. → 귀한 귤 종류 하나(나오면) 또는 null
export function rollRare(who, rnd = Math.random) {
  const p = RARE_GYUL.chance[who]; if (!p) return null;
  let x = rnd();
  for (let i = p.length - 1; i >= 0; i--) { if (x < p[i]) return RG_KINDS[i]; x -= p[i]; } // 귀한 것부터
  return null;
}
// 쫓아낸 귤 reward 를 나눔: { kind, v: 귀한 귤 값, rest: 보통으로 흩뿌릴 귤 }. 안 나오면 kind null, rest = reward
export function splitRare(who, reward, maxN = Infinity, rnd = Math.random) {
  if (!(reward > 0)) return { kind: null, v: 0, rest: reward || 0 };
  const kind = rollRare(who, rnd); if (!kind) return { kind: null, v: 0, rest: reward };
  const u = unitOf(reward, maxN), cut = Math.min(reward, Math.max(1, Math.round(u)));
  return { kind, v: Math.max(kind.m, Math.round(kind.m * u)), rest: reward - cut };
}
// 한 번 쫓아낼 때 귀한 귤로 더 생기는 귤의 기댓값
export function rareEV(who, reward, maxN = Infinity) {
  const p = RARE_GYUL.chance[who]; if (!p || !(reward > 0)) return 0;
  const u = unitOf(reward, maxN), cut = Math.min(reward, Math.max(1, Math.round(u)));
  return p.reduce((s, pi, i) => s + pi * (Math.max(RG_KINDS[i].m, Math.round(RG_KINDS[i].m * u)) - cut), 0);
}
// 한 번에 생길 수 있는 가장 큰 귀한 귤 (서버 몫 earnBurst 확인용)
export function rareMax(who, reward, maxN = Infinity) {
  const p = RARE_GYUL.chance[who]; if (!p || !(reward > 0)) return 0;
  const u = unitOf(reward, maxN); let best = 0;
  p.forEach((pi, i) => { if (pi > 0) best = Math.max(best, Math.max(RG_KINDS[i].m, Math.round(RG_KINDS[i].m * u))); });
  return best;
}
