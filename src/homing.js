// 유도 탄 (#148): 날아가는 탄의 속도 v 를 대상 t(aimTargets 의 한 항목: pos·h·ok?) 쪽으로 초당 rate(rad)까지 돌린다. 빠르기는 그대로
// 손 귤·활·총·머신건이 씀 (life.js·weaponfx.js). 대상이 사라졌으면(t.ok() 가 false) 그만둠 → false
import * as THREE from 'three';
const _d = new THREE.Vector3(), _a = new THREE.Vector3();
export function steer(v, p, t, dt, rate) {
  if (!t || (t.ok && !t.ok())) return false;
  _d.set(t.pos.x - p.x, t.pos.y + (t.h || 0.8) - p.y, t.pos.z - p.z);
  const L = _d.length(), s = v.length(); if (L < 0.05 || s < 0.01) return true;
  _d.divideScalar(L); _a.copy(v).divideScalar(s);
  const cos = Math.max(-1, Math.min(1, _a.dot(_d))), ang = Math.acos(cos); if (ang < 1e-4) return true;
  const k = Math.min(1, rate * dt / ang);
  if (cos < -0.999) _a.addScaledVector(_d.set(-_a.z, 0, _a.x), k); // 바로 뒤: 옆으로 먼저 돌림
  else _a.multiplyScalar(Math.sin((1 - k) * ang)).addScaledVector(_d, Math.sin(k * ang)); // 구면 보간
  v.copy(_a.normalize()).multiplyScalar(s);
  return true;
}
