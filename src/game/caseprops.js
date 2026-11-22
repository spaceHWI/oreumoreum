// 사건 파일 모양 (#232): 사건 데이터(src/cases/c*.js)의 prop 이름 → 로우폴리 임시 모양. 지금 그림체(toon 재질), 재질마다 한 덩어리로 합쳐 draw call 을 줄임
// 이 파일은 읽기만 해서는 아무것도 하지 않음 (game/cases.js 가 buildProp 으로 씀). 새 사건에 새 모양이 필요하면 여기 B 에 하나 더한다
// 사건 2 (#233): wall 돌담 조각 · rag 흰 천이 걸린 낮은 돌담 · gone 더미가 있던 반듯한 빈자리 · line 빨랫줄의 흰 작업복과 메모
// 사건 3 (#234): suits 능선에 선 검은 양복 둘(MYST.back 실루엣) · suit 하나(대면 자리) · prints 맨발 자국 두 쌍(발가락 넷) · notebook 떨어진 검은 수첩 · gyulbox 두고 간 귤 상자와 쪽지
// - row: 캔은 캔끼리·병은 병끼리 줄 선 더미 (맨 끝 한 칸은 빈자리) · peel: 귤 껍질 세 조각 · nest: 나무 위 둥지와 병뚜껑 · paper: 돌에 눌린 쪽지 · bush: 숨을 수풀 · gyul: 귤 세 개
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gradHard } from '../toon.js';
import { LOW } from '../gfx2.js';
import { MYST } from '../balance.js';

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
// 검은 양복 실루엣 (뒤돌아보면 figure 와 같은 모양·색, 칼라만 흰 V)
function silh(x) {
  const H = MYST.back.h, g = new THREE.Group(), mat = (SIL ||= new THREE.MeshBasicMaterial({ color: '#1a1d20' }));
  const gs = [[new THREE.CylinderGeometry(0.16, 0.3, H * 0.62, 7), 0, H * 0.31, 0], [new THREE.SphereGeometry(0.34, 10, 8), 0, H * 0.62 + 0.36, 0, 0, 0, 0, 1, 1.25, 0.9],
    [new THREE.CylinderGeometry(0.05, 0.04, H * 0.5, 5), -0.26, H * 0.38, 0, 0, 0, -0.12], [new THREE.CylinderGeometry(0.05, 0.04, H * 0.5, 5), 0.26, H * 0.38, 0, 0, 0, 0.12]];
  const body = lump(gs, '#1a1d20'); body.material = mat; body.castShadow = false; g.add(body);
  g.add(lump([[new THREE.ConeGeometry(0.07, 0.2, 3), 0, H * 0.56, 0.2, Math.PI, 0, 0]], '#f2efe6'));
  g.position.x = x; return g;
}
let SIL = null;
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
  wall() { // 사건 2 목격: 사람 허리 높이 돌담 조각 (가로 3.2m, 현무암 덩이 두 단). 흰 옷이 그 너머로 지나감
    const st = [];
    for (let i = 0; i < 8; i++) st.push([new THREE.DodecahedronGeometry(0.26, 0), -1.4 + i * 0.4, 0.22, (i % 2) * 0.06, i, i * 0.7, 0, 1.05, 0.85, 0.9]);
    for (let i = 0; i < 7; i++) st.push([new THREE.DodecahedronGeometry(0.23, 0), -1.2 + i * 0.4, 0.6, 0.02, i * 0.4, i, 0.3, 1, 0.8, 0.85]);
    return lump(st, '#3d3b3a');
  },
  rag() { // 사건 2 증거: 낮은 돌담에 걸린 흰 천 조각 (천은 두 장, 바람에 젖혀진 각)
    const g = new THREE.Group(), st = [];
    for (let i = 0; i < 4; i++) st.push([new THREE.DodecahedronGeometry(0.25, 0), -0.6 + i * 0.4, 0.2, 0, i, i * 0.9, 0, 1, 0.8, 0.9]);
    for (let i = 0; i < 3; i++) st.push([new THREE.DodecahedronGeometry(0.22, 0), -0.4 + i * 0.4, 0.56, 0, i * 0.5, i, 0.2, 1, 0.8, 0.85]);
    g.add(lump(st, '#3d3b3a'));
    const cloth = lump([[new THREE.PlaneGeometry(0.34, 0.42), 0.18, 0.62, 0.2, 0.1, 0.3, 0.25], [new THREE.PlaneGeometry(0.2, 0.26), 0.36, 0.5, 0.22, 0.25, 0.5, -0.4]], '#f4f3ee');
    cloth.material = cloth.material.clone(); cloth.material.side = THREE.DoubleSide; g.add(cloth);
    return g;
  },
  gone() { // 사건 2 증거: 더미가 있던 자리 (눌린 흙 동그라미 + 테두리에 남은 봉지 끈 하나·캔 하나)
    const g = new THREE.Group();
    g.add(lump([[new THREE.CircleGeometry(1.3, 12), 0, 0.03, 0, -Math.PI / 2, 0, 0]], '#7a6a50'));
    g.add(lump([[new THREE.TorusGeometry(1.3, 0.06, 4, 16), 0, 0.04, 0, Math.PI / 2, 0, 0, 1, 1, 0.4]], '#5a4e3a'));
    g.add(lump([[new THREE.CylinderGeometry(0.07, 0.07, 0.2, 7), 1.15, 0.07, 0.4, Math.PI / 2, 0, 0.6]], '#b9c0c6'));
    return g;
  },
  line() { // 사건 2 증거: 말뚝 둘 사이 빨랫줄 + 흰 작업복(윗옷·바지) + 집게 하나 기대 놓음 + 줄에 꽂힌 메모
    const g = new THREE.Group();
    g.add(lump([[new THREE.CylinderGeometry(0.05, 0.06, 1.9, 5), -1.2, 0.95, 0], [new THREE.CylinderGeometry(0.05, 0.06, 1.9, 5), 1.2, 0.95, 0]], '#6b5237'));
    g.add(lump([[new THREE.CylinderGeometry(0.008, 0.008, 2.4, 3), 0, 1.78, 0, 0, 0, Math.PI / 2]], '#d8d2c0'));
    g.add(lump([[new THREE.BoxGeometry(0.62, 0.66, 0.05), -0.45, 1.42, 0], [new THREE.BoxGeometry(0.2, 0.42, 0.05), -0.86, 1.52, 0, 0, 0, -0.5], [new THREE.BoxGeometry(0.2, 0.42, 0.05), -0.04, 1.52, 0, 0, 0, 0.5],
      [new THREE.BoxGeometry(0.22, 0.86, 0.05), 0.38, 1.33, 0], [new THREE.BoxGeometry(0.22, 0.86, 0.05), 0.66, 1.33, 0]], '#f4f3ee'));
    g.add(lump([[new THREE.BoxGeometry(0.12, 0.14, 0.012), 0.95, 1.7, 0.03]], '#efe6cf'));
    g.add(lump([[new THREE.CylinderGeometry(0.015, 0.015, 0.9, 4), 1.05, 0.45, 0.15, 0, 0, 0.25], [new THREE.CylinderGeometry(0.015, 0.015, 0.9, 4), 1.11, 0.45, 0.15, 0, 0, 0.18]], '#8a8f96'));
    return g;
  },
  suits() { // 검은 양복 둘 (뒤돌아보면의 실루엣 모양 그대로, game/traces.js figure). 1.4m 떨어져 나란히
    const g = new THREE.Group(); g.add(silh(-0.7), silh(0.7)); return g;
  },
  suit() { return silh(0); },
  prints() { // 두 사람이 꼭 같은 자리에 선 맨발 자국 두 쌍 (구두 자국이 아님, 발가락 넷)
    const parts = [];
    for (const px of [-0.7, 0.7]) for (const k of [-1, 1]) {
      const x = px + k * 0.13;
      parts.push([new THREE.CircleGeometry(0.1, 9), x, 0.03, 0, -Math.PI / 2, 0, 0, 0.8, 1.45, 1]);
      for (let t = 0; t < 4; t++) parts.push([new THREE.CircleGeometry(0.03, 6), x + (t - 1.5) * 0.045, 0.031, -0.19 - Math.abs(t - 1.5) * -0.012, -Math.PI / 2, 0, 0]);
    }
    return lump(parts, '#3b3328');
  },
  notebook() { // 떨어진 검은 수첩 (펼쳐짐)
    const g = new THREE.Group();
    g.add(lump([[new THREE.BoxGeometry(0.34, 0.025, 0.22), 0, 0.02, 0, 0, 0.5, 0]], '#1c1e22'));
    g.add(lump([[new THREE.PlaneGeometry(0.15, 0.2), -0.07 * Math.cos(0.5), 0.035, 0.07 * Math.sin(0.5), -Math.PI / 2, 0, 0.5], [new THREE.PlaneGeometry(0.15, 0.2), 0.07 * Math.cos(0.5), 0.035, -0.07 * Math.sin(0.5), -Math.PI / 2, 0, 0.5]], '#efe6cf'));
    return g;
  },
  gyulbox() { // 바위 곁에 두고 간 귤 상자 (위에 귤, 앞에 쪽지)
    const g = new THREE.Group();
    g.add(lump([[new THREE.BoxGeometry(0.6, 0.32, 0.42), 0, 0.16, 0]], '#c89a5e'));
    g.add(lump([0, 1, 2, 3, 4, 5].map((i) => [new THREE.IcosahedronGeometry(0.075, 1), -0.2 + (i % 3) * 0.2, 0.36, (i < 3 ? -0.09 : 0.09)]), '#f29a2e'));
    g.add(lump([[new THREE.PlaneGeometry(0.2, 0.13), 0, 0.17, 0.215, 0, 0, 0.06]], '#f4ecd8'));
    g.add(lump([[new THREE.DodecahedronGeometry(0.42, 0), -0.62, 0.25, -0.1, 0, 0, 0, 1, 0.8, 1]], '#4a4744'));
    return g;
  },
  gyul() { // 귤 세 개 (대면 뒤 빈자리)
    return lump([0, 1, 2].map((i) => [new THREE.IcosahedronGeometry(0.08, 1), (i - 1) * 0.12, 0.08, (i % 2) * 0.05]), '#f29a2e');
  },
};
export const propKinds = Object.keys(B);
export function buildProp(kind) { const f = B[kind]; return f ? f() : null; }
