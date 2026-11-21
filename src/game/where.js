// 지금 있는 곳 이름 (#153): 위쪽 한 줄 칸에 숫자 좌표 대신. 들머리·가게 거리·클린하우스 앞·정상 전망대·돌탑·개울가·구역 문턱, 없으면 구역 이름
// 자리는 spots·가게 터·클린하우스에서 가져옴 (반경은 balance.js PLACE). 0.3초마다 다시 셈
import { PLACE } from '../balance.js';
import { STREET } from '../streetlayout.js';
import { zoneShort } from '../zonelook.js';
import { spots } from './scene.js';
import { trash, CH, CH_MINI, NS_TUT, shopsBuilt } from './place.js';

const xz = (p) => p && { x: p.x, z: p.z };
const SPOTS = (() => {
  const L = [], add = (name, p, r) => { if (p && name) L.push({ name, x: p.x, z: p.z, r }); };
  if (NS_TUT) {
    for (const sh of shopsBuilt) { const lot = STREET.lot(sh.lot); if (lot) add(`${sh.name} 앞`, lot.front, PLACE.shop); }
    add('가게 거리', STREET.center, STREET.radius + PLACE.street);
    add('개울가', NS_TUT.stream, PLACE.stream);
  }
  if (CH) add('클린하우스 앞', CH.front, PLACE.ch);
  for (const c of CH_MINI || []) add(c.name, c.center || c.front, PLACE.mini);
  add('정상 전망대', xz(spots.photo?.stone), PLACE.summit);
  for (const c of spots.cairns || []) add(c.name, c.pos, PLACE.cairn);
  if (spots.gateHint) add('정낭 앞', spots.gateHint, PLACE.gate);
  add('탐방 안내판', xz(spots.sign?.pos), PLACE.sign);
  return L;
})();

// 구역 문턱: 둘레 edge m 안에 아래 구역(번호가 작은 곳)이 있으면 막 들어선 것
function edgeOf(x, z, zn) {
  if (!trash || zn <= 1) return false; const e = PLACE.edge;
  for (const [dx, dz] of [[e, 0], [-e, 0], [0, e], [0, -e]]) { const o = trash.zoneAt(x + dx, z + dz); if (o && o < zn) return true; }
  return false;
}
export function placeAt(x, z) {
  let best = null, bk = 1;
  for (const s of SPOTS) { const k = Math.hypot(s.x - x, s.z - z) / s.r; if (k < bk) { bk = k; best = s; } }
  if (best) return best.name;
  const zn = trash ? trash.zoneAt(x, z) : 0;
  if (!zn) return '들머리';
  const n = zoneShort(zn);
  return edgeOf(x, z, zn) ? `${n} 들머리` : n;
}
export const placeSpots = () => SPOTS.map((s) => ({ ...s, x: Math.round(s.x), z: Math.round(s.z) })); // 확인용 (__oreum.where)
