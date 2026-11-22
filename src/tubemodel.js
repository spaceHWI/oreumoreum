// 수거 관 투입구 (#248): 클린하우스 옆 둥근 기둥 + 앞면 둥근 구멍 + 덮개. 로우폴리 임시 모양, draw call 1
// 덮개 여닫기는 모프 타깃 하나(0 닫힘 → 1 열림)라 메시를 나누지 않음. 앞이 +z, 바닥이 y 0
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gradHard } from './toon.js';

export const INTAKE = { holeY: 0.92, holeR: 0.34, front: 0.5, h: 1.45 }; // 구멍 가운데 높이·반지름, 앞면 z, 기둥 높이
function piece(g, color) { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); g.computeVertexNormals(); const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
function parts(open) {
  const { holeY: Y, holeR: R, front: F, h: H } = INTAKE, out = [];
  out.push(piece(new THREE.CylinderGeometry(0.62, 0.66, 0.16, 10).translate(0, 0.08, 0), '#5a5f63')); // 현무암 받침
  out.push(piece(new THREE.CylinderGeometry(0.5, 0.52, H, 12).translate(0, H / 2 + 0.12, 0), '#3f7a5e')); // 기둥
  out.push(piece(new THREE.CylinderGeometry(0.54, 0.5, 0.14, 12).translate(0, H + 0.19, 0), '#f2efe4')); // 머리 테
  out.push(piece(new THREE.CylinderGeometry(0.53, 0.53, 0.12, 12).translate(0, 0.42, 0), '#ff9a1f')); // 귤빛 띠
  out.push(piece(new THREE.TorusGeometry(R + 0.03, 0.055, 6, 14).translate(0, Y, F), '#d9d4c4')); // 구멍 테
  out.push(piece(new THREE.CircleGeometry(R, 14).translate(0, Y, F + 0.005), '#101211')); // 어두운 구멍
  // 덮개: 위쪽 경첩. 열리면 앞으로 들려 올라감
  const lid = new THREE.CylinderGeometry(R + 0.02, R + 0.02, 0.05, 14).rotateX(Math.PI / 2).translate(0, -(R + 0.02), 0);
  if (open) lid.rotateX(-1.75);
  out.push(piece(lid.translate(0, Y + R + 0.02, F + 0.05), '#c9473d'));
  return out;
}
let geo = null, mat = null;
function intakeGeo() {
  if (geo) return geo;
  geo = mergeGeometries(parts(false)); const o = mergeGeometries(parts(true));
  geo.morphAttributes.position = [o.attributes.position]; geo.morphAttributes.normal = [o.attributes.normal];
  return geo;
}
export function buildIntake(low) {
  if (!mat) mat = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradHard });
  const m = new THREE.Mesh(intakeGeo(), mat); m.morphTargetInfluences = [0]; m.castShadow = !low; m.receiveShadow = !low;
  return m;
}
