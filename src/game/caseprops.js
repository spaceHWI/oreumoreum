// 사건 파일 모양 (#232, #246): 사건 데이터(src/cases/c*.js)의 prop 이름 → 로우폴리 임시 모양. 지금 그림체(toon 재질), 재질마다 한 덩어리로 합쳐 draw call 을 줄임
// 이 파일은 읽기만 해서는 아무것도 하지 않음 (game/cases.js 가 buildProp 으로 씀). 새 사건에 새 모양이 필요하면 여기 B 에 하나 더한다
// - crop: 풀이 둥글게 누운 무늬(#212 크롭서클 그림, 땅을 따라 휨. userData.place(x, z) 로 놓음) · dent: 무늬 가운데 눌린 자국 · rock: 올라서서 찍는 바위
// - paper: 돌에 눌린 쪽지 · bush: 숨을 수풀 · heap: 떨어지는 더미(자루·캔)
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gradHard } from '../toon.js';
import { LOW } from '../gfx2.js';
import { CASE } from '../balance.js';
import { height } from '../world.js';
import { drape } from '../drape.js';
import { cropTex } from '../croptex.js';

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
  crop() { // 무늬: 지름 2 판을 CASE.crop.r 로 키워 땅을 따라 휨 (흐린 풀빛, 그림자 없음)
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, LOW ? 10 : 16, LOW ? 10 : 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: cropTex(), transparent: true, opacity: CASE.crop.op, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    m.renderOrder = 1; m.name = 'case-crop';
    const put = drape(m, height, 0.07); m.userData.place = (x, z) => put(x, z, CASE.crop.r, CASE.crop.rot);
    return m;
  },
  dent() { // 가운데 눌린 자국: 납작하게 누운 풀 덩이 다섯 (자루를 내려놓은 모양)
    return lump([[0, 0, 0.5], [0.55, 0.2, 0.36], [-0.45, 0.3, 0.38], [0.15, -0.5, 0.34], [-0.3, -0.4, 0.3]].map(([x, z, r]) => [new THREE.CylinderGeometry(r, r * 1.1, 0.05, 8), x, 0.03, z]), '#a7ac5c');
  },
  rock() { // 올라서서 내려다보는 현무암 바위 둘
    return lump([[new THREE.DodecahedronGeometry(0.7, 0), 0, 0.35, 0, 0, 0.4, 0, 1.3, 0.6, 1], [new THREE.DodecahedronGeometry(0.4, 0), 0.8, 0.22, 0.3, 0, 1, 0, 1, 0.6, 1]], '#4a4744');
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
  heap() { // 더미: 흰 자루 셋·푸른 자루 하나·빨간 캔 둘
    const g = new THREE.Group();
    g.add(lump([[0, 0, 0.42], [0.5, 0.2, 0.34], [-0.4, 0.3, 0.32]].map(([x, z, r]) => [new THREE.IcosahedronGeometry(r, 0), x, r * 0.8, z, 0, x, 0, 1, 0.85, 1]), '#eceff1'));
    g.add(lump([[new THREE.IcosahedronGeometry(0.33, 0), 0.05, 0.55, -0.4, 0, 0, 0, 1, 0.9, 1]], '#8fa9bd'));
    g.add(lump([[new THREE.CylinderGeometry(0.07, 0.07, 0.2, 7), -0.7, 0.07, -0.1, Math.PI / 2, 0, 0.4], [new THREE.CylinderGeometry(0.07, 0.07, 0.2, 7), 0.75, 0.1, -0.2, 0, 0, 0]], '#c0453a'));
    return g;
  },
};
export const propKinds = Object.keys(B);
export function buildProp(kind) { const f = B[kind]; return f ? f() : null; }
