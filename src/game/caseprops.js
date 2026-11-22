// 사건 파일 모양 (#232): 사건 데이터(src/cases/c*.js)의 prop 이름 → 로우폴리 임시 모양. 지금 그림체(toon 재질), 재질마다 한 덩어리로 합쳐 draw call 을 줄임
// 이 파일은 읽기만 해서는 아무것도 하지 않음 (game/cases.js 가 buildProp 으로 씀). 새 사건에 새 모양이 필요하면 여기 B 에 하나 더한다
// - row: 캔은 캔끼리·병은 병끼리 줄 선 더미 (맨 끝 한 칸은 빈자리) · peel: 귤 껍질 세 조각 · nest: 나무 위 둥지와 병뚜껑 · paper: 돌에 눌린 쪽지 · bush: 숨을 수풀 · gyul: 귤 세 개
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gradHard } from '../toon.js';
import { LOW } from '../gfx2.js';

const MATS = {};
const tm = (c) => (MATS[c] ||= new THREE.MeshToonMaterial({ color: c, gradientMap: gradHard }));
// 조각 [geometry, x, y, z, rx, ry, rz, sx?, sy?, sz?] 을 한 덩어리로
function lump(parts, color) {
  const gs = parts.map(([g, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1]) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
    const n = g.index ? g.toNonIndexed() : g.clone(); n.applyMatrix4(m); g.dispose(); return n;
  });
  const mesh = new THREE.Mesh(mergeGeometries(gs), tm(color)); gs.forEach((g) => g.dispose());
  mesh.castShadow = !LOW; mesh.receiveShadow = true; return mesh;
}
const B = {
  row() { // 2줄: 앞줄 캔 7, 뒷줄 병 5. 가로 2.2m, 앞줄 맨 끝(+x) 한 칸은 빈자리(대면 뒤 귤·종이가 놓임)
    const cans = [], bottles = [], caps = [];
    for (let i = 0; i < 7; i++) cans.push([new THREE.CylinderGeometry(0.07, 0.07, 0.2, 7), -1 + i * 0.28, 0.1, 0.18]);
    for (let i = 0; i < 5; i++) { bottles.push([new THREE.CylinderGeometry(0.075, 0.085, 0.3, 7), -0.95 + i * 0.36, 0.15, -0.2]); caps.push([new THREE.CylinderGeometry(0.035, 0.035, 0.12, 6), -0.95 + i * 0.36, 0.36, -0.2]); }
    const g = new THREE.Group(); g.add(lump(cans, '#b9c0c6'), lump(bottles, '#4f9a6a'), lump(caps, '#3f7f56'));
    return g;
  },
  peel() { // 줄 맨 끝(row 의 빈자리 옆) 땅에 귤 껍질 세 조각
    return lump([0, 1, 2].map((i) => [new THREE.SphereGeometry(0.09, 6, 3, 0, Math.PI * 1.2, 0, Math.PI / 2), i * 0.2, 0.02, 0, Math.PI, i * 0.9, 0, 1, 0.35, 1]), '#f29a2e');
  },
  nest() { // 마른 나무 (줄기·가지) + 가지 위 둥지 + 둥지 위 병뚜껑 (색 둘)
    const g = new THREE.Group();
    g.add(lump([[new THREE.CylinderGeometry(0.16, 0.24, 3.2, 6), 0, 1.6, 0], [new THREE.CylinderGeometry(0.06, 0.1, 1.4, 5), 0.45, 2.5, 0, 0, 0, -0.9], [new THREE.CylinderGeometry(0.05, 0.08, 1.1, 5), -0.38, 2.9, 0.1, 0.2, 0, 0.8]], '#6b5237'));
    g.add(lump([[new THREE.TorusGeometry(0.28, 0.12, 5, 9), 0.85, 2.92, 0, Math.PI / 2, 0, 0], [new THREE.CircleGeometry(0.26, 9), 0.85, 2.88, 0, -Math.PI / 2, 0, 0]], '#8a6a44'));
    const caps = (c, k) => lump([0, 1, 2, 3].map((i) => [new THREE.CylinderGeometry(0.05, 0.05, 0.03, 7), 0.78 + (i % 2) * 0.12 + k * 0.05, 2.98 + Math.floor(i / 2) * 0.035, -0.06 + k * 0.1, 0, 0, 0]), c);
    g.add(caps('#d0453a', 0), caps('#3a78c0', 1));
    return g;
  },
  paper() { // 돌에 눌린 종이 한 장
    const g = new THREE.Group();
    g.add(lump([[new THREE.PlaneGeometry(0.42, 0.56), 0, 0.05, 0, -Math.PI / 2 + 0.15, 0, 0.4]], '#efe6cf'));
    g.add(lump([[new THREE.DodecahedronGeometry(0.12, 0), 0.1, 0.08, -0.12, 0, 0, 0, 1, 0.7, 1]], '#4a4744'));
    return g;
  },
  bush() { // 사람이 쪼그려 숨을 만한 낮은 수풀
    return lump([[0, 0, 0, 0.55], [0.5, 0.1, 0.4, 0.45], [-0.5, 0.25, -0.1, 0.45], [0.1, -0.45, 0.2, 0.4]].map(([x, z, dy, r]) => [new THREE.DodecahedronGeometry(r, 0), x, r * 0.8 + dy * 0.2, z, 0, x * 3, 0, 1.2, 0.85, 1.1]), '#5f8a3a');
  },
  gyul() { // 귤 세 개 (대면 뒤 빈자리)
    return lump([0, 1, 2].map((i) => [new THREE.IcosahedronGeometry(0.08, 1), (i - 1) * 0.12, 0.08, (i % 2) * 0.05]), '#f29a2e');
  },
};
export const propKinds = Object.keys(B);
export function buildProp(kind) { const f = B[kind]; return f ? f() : null; }
