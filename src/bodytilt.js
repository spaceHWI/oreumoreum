// 몸 방향 한 곳에서 (#107): 바라보는 방향(heading) + 맞음 움찔·쓰러져 누움 기울기를 매 프레임 처음부터 다시 합친다.
// rotation.y 만 고치면 지난 프레임에 얹은 기울기가 Euler x·z 에 남아 몸이 누운 채로 남던 문제를 막는다.
// 내 캐릭터(game/update.js placeRunner·노루 타기)와 멀티의 남(net.js)이 같이 씀. 비탈 숙임은 runner.animate 뼈에서만, 맞는 동안은 줄임
import * as THREE from 'three';
import { BOAR } from './balance.js';

const UP = new THREE.Vector3(0, 1, 0), _a = new THREE.Vector3(), _q = new THREE.Quaternion();
const ss = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };

// 맞은 뒤 t 초의 움찔 정도 0..1: 짧게 확 젖혔다가 BOAR.flinchT 안에 바로 섬
export function flinchK(t) {
  const T = BOAR.flinchT, pk = BOAR.flinchPeak;
  if (!(t >= 0) || t >= T) return 0;
  return t < pk ? ss(t / pk) : 1 - ss((t - pk) / (T - pk));
}

// root 방향을 처음부터: heading 으로 돌리고, 기울기 (ax, az 축 · ang 각) 를 하나로 합쳐 얹음. 축은 수평
// tilts: [[ax, az, ang], ...] 를 축×각 벡터로 더해 한 번만 기울임 → 두 기울기가 겹쳐도 maxAng 을 넘지 않음
export function orientBody(root, heading, tilts = null, maxAng = 1.6) {
  root.quaternion.setFromAxisAngle(UP, heading);
  if (!tilts) return;
  let tx = 0, tz = 0;
  for (const t of tilts) { if (!t || !(t[2] > 0)) continue; const L = Math.hypot(t[0], t[1]); if (L < 1e-6) continue; tx += (t[0] / L) * t[2]; tz += (t[1] / L) * t[2]; }
  const ang = Math.hypot(tx, tz); if (ang < 1e-4) return;
  _a.set(tx / ang, 0, tz / ang); _q.setFromAxisAngle(_a, Math.min(maxAng, ang));
  root.quaternion.premultiply(_q);
}
