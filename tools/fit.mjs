// 옷 맞음 검사 (#177): 기본 자세(T포즈)에서 몸·옷마다 바깥면까지 거리를 광선으로 재어, 안쪽 겹이 바깥 겹을 뚫고 나오는 곳을 셈
// 겹 순서(안 → 밖): 몸 < 양말 < 바지 < 티셔츠 < 잠바 < 베스트. 남·여 체형 둘 다, CLOTHES 의 모든 옷 짝을 맞대 봄
// node tools/fit.mjs  → 짝마다 뚫린 광선 수(0 이어야 함)와 가장 많이 뚫린 깊이
import * as THREE from 'three';
import { CLOTHES } from '../src/balance.js';
import * as CL from '../src/clothes.js';
import '../src/clothes2.js'; // 겉모습 옷 모양 (#179)
const { CLOTH_BUILD, TORSO, HIPS, ARM, LEG, prof } = CL, BODY = CL.BODY || { crotch: 0.12 }, bY = CL.bodyY || ((y) => y), HIP_TOP = HIPS[HIPS.length - 1][0];
import { baseBodyGeo, bodyWarp, REGION } from '../src/basebody.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const SLOT_ORDER = ['socks', 'bottom', 'top', 'jacket', 'vest'];
const TOL = 0.002;
const mat = () => new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
// 옷 하나 → 한 메시 (체형 맞춤까지)
function clothMesh(c, sex) {
  const L = c.look || {}, f = CLOTH_BUILD[L.kind];
  const g0 = f((n, d) => mat(), { kind: L.kind, main: '#bbb', acc: '#888', ...L }); g0.updateMatrixWorld(true);
  const list = []; g0.traverse((o) => { if (o.isMesh) { const g = o.geometry.clone().applyMatrix4(o.matrixWorld); for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k); list.push(g.index ? g.toNonIndexed() : g); } });
  const g = mergeGeometries(list); bodyWarp(g.attributes.position.array, sex); g.computeBoundingSphere();
  return new THREE.Mesh(g, mat());
}
// 몸: covers 로 감춘 부위를 빼고 남은 것도 같이 보기 위해 부위 번호를 들고 있음
function bodyMesh(sex) { const g = baseBodyGeo(sex).clone(); return new THREE.Mesh(g.index ? g.toNonIndexed() : g, mat()); }
// 광선: 몸통(가운데 축에서 수평, 팔 높이에선 앞뒤만), 다리(다리 축에서 수평, 반대쪽 다리 쪽은 뺌), 팔(팔 축에서 수직 단면)
const rays = [];
for (let y = BODY.crotch + 0.01; y <= 0.6; y += 0.01) { const p = prof(y < HIP_TOP - 0.03 ? HIPS : TORSO, y), zc = (p[2] + p[3]) / 2; for (let a = 0; a < 24; a++) { const th = (a / 24) * Math.PI * 2; if (y > 0.43 && Math.abs(Math.cos(th)) > 0.45) continue; rays.push({ part: 'trunk', y, o: new THREE.Vector3(0, bY(y), zc), d: new THREE.Vector3(Math.cos(th), 0, Math.sin(th)) }); } }
for (const s of [1, -1]) for (let y = 0.03; y <= 0.33; y += 0.01) for (let a = 0; a < 16; a++) { const th = (a / 16) * Math.PI * 2; if (s * Math.cos(th) < -0.4) continue; rays.push({ part: 'leg', y, o: new THREE.Vector3(s * LEG.x, bY(y), LEG.z), d: new THREE.Vector3(Math.cos(th), 0, Math.sin(th)) }); }
for (const s of [1, -1]) for (let x = 0.2; x <= 0.39; x += 0.01) for (let a = 0; a < 16; a++) { const th = (a / 16) * Math.PI * 2; rays.push({ part: 'arm', y: x, o: new THREE.Vector3(s * x, ARM.y, ARM.z), d: new THREE.Vector3(0, Math.cos(th), Math.sin(th)) }); }
const rc = new THREE.Raycaster(); rc.far = 0.5;
// 메시마다 광선별 가장 먼 맞은 거리(바깥면). 다리 광선은 반대쪽 다리를 맞히지 않게 0.09 안쪽만
function outer(mesh) { return rays.map((r) => { rc.set(r.o, r.d); rc.far = r.part === 'leg' ? 0.12 : r.part === 'trunk' ? 0.3 : 0.2; const h = rc.intersectObject(mesh, false); return h.length ? h[h.length - 1].distance : null; }); }
const bySlot = {}; CLOTHES.forEach((c) => { if (SLOT_ORDER.includes(c.slot)) (bySlot[c.slot] ||= []).push(c); });
const covered = (c) => c.slot === 'top' ? ['chest', 'waist', 'upperarm', ...(c.look?.long ? ['forearm'] : [])] : c.slot === 'bottom' ? ['pelvis', 'waist', 'thigh', ...(c.look?.kind === 'long' ? ['shin'] : [])] : c.slot === 'jacket' ? ['chest', 'waist', 'upperarm', 'forearm'] : [];
let bad = 0; const report = [];
for (const sex of ['m', 'f']) {
  const body = bodyMesh(sex), bodyO = outer(body), O = {};
  for (const s of SLOT_ORDER) for (const c of bySlot[s] || []) O[c.id] = outer(clothMesh(c, sex));
  // 몸 → 옷 (발은 신발이 덮으므로 뺌. 옷이 덮는 곳에서 몸이 옷 밖으로 나오면 안 됨. 덮지 않는 맨살 부위도 겹이 있으면 옷이 바깥)
  for (const s of SLOT_ORDER) for (const c of bySlot[s] || []) { let n = 0, worst = 0, where = ''; rays.forEach((r, i) => { if (r.part === 'leg' && r.y < 0.09) return; const a = bodyO[i], b = O[c.id][i]; if (a != null && b != null && a > b + TOL) { n++; if (a - b > worst) { worst = a - b; where = `${r.part} ${r.y.toFixed(2)}`; } } }); if (n) { bad += n; report.push(`${sex} 몸 > ${c.id}: ${n} (${worst.toFixed(3)} @ ${where})`); } }
  // 옷끼리
  for (let i = 0; i < SLOT_ORDER.length; i++) for (let j = i + 1; j < SLOT_ORDER.length; j++) for (const A of bySlot[SLOT_ORDER[i]] || []) for (const B of bySlot[SLOT_ORDER[j]] || []) {
    let n = 0, worst = 0, where = ''; rays.forEach((r, k) => { const a = O[A.id][k], b = O[B.id][k]; if (a != null && b != null && a > b + TOL) { n++; if (a - b > worst) { worst = a - b; where = `${r.part} ${r.y.toFixed(2)}`; } } });
    if (n) { bad += n; report.push(`${sex} ${A.id} > ${B.id}: ${n} (${worst.toFixed(3)} @ ${where})`); }
  }
}
console.log(report.join('\n') || '뚫린 곳 없음'); console.log('광선', rays.length, '뚫림 합', bad);
