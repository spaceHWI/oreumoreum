// 남송이 구역 (#45): 오름을 5개로 나눔. 들머리(돌담 안 평지·튜토리얼)는 0
// 1 오름 자락 숲길 / 2 남쪽 사면 / 3 능선 / 4 굼부리 / 5 정상
// 경계는 지형으로: 정상 둘레 → 말굽 능선 둘레 → 굼부리(말굽 안쪽 + 북쪽 원형 굼부리) → 남·동쪽 높은 사면 → 나머지 자락
// 위치로 구역 번호를 구하는 곳은 zoneAt 하나뿐
import { relAt, nsPaths, nsSummit, nsDistToRim } from './namsongi.js';
import { onOreum } from './nsbound.js';
import { ZONE_SHAPE as ZS } from './balance.js';

// 말굽 굼부리: 능선 선을 북쪽 끝과 남쪽 끝을 이어 닫은 다각형
const RIM = nsPaths.rim, HORSE = [...RIM, RIM[0]];
function inPoly(poly, x, z) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
// 북쪽 원형 굼부리: 둘레 길(crater) 의 가운데·반지름
const CRR = nsPaths.crater, CRC = CRR.slice(0, -1).reduce((s, p) => [s[0] + p[0] / (CRR.length - 1), s[1] + p[1] / (CRR.length - 1)], [0, 0]);
const CRAD = Math.hypot(CRR[0][0] - CRC[0], CRR[0][1] - CRC[1]);

export const ZONE_IDS = [1, 2, 3, 4, 5];
export function zoneAt(x, z) {
  if (!onOreum(x, z)) return 0;
  if (Math.hypot(x - nsSummit.x, z - nsSummit.z) < ZS.summitR) return 5;
  const dr = nsDistToRim(x, z);
  if (dr < ZS.rimW) return 3;
  if (inPoly(HORSE, x, z) || Math.hypot(x - CRC[0], z - CRC[1]) < CRAD + ZS.craterPad) return 4;
  if (relAt(x, z) > ZS.slopeRel && z > nsSummit.z + ZS.southZ) return 2;
  return 1;
}
export const CRATER = { x: CRC[0], z: CRC[1], r: CRAD };
