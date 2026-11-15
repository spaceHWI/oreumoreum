// 멧돼지 모델 (B3 시안, Tripo 생성 → model/bake-boar.py, model/extract-boar.js 로 1,500 삼각형·텍스처 512)
// 한 덩어리 메시에 기본 자세 위치로 뼈 가중치를 직접 계산: 몸 · 머리 · 꼬리 · 다리 4개
import * as THREE from 'three';
import { NSMODE, TEXCS } from './boot.js';
import { gradHard } from './toon.js';
import { BM } from './boarmodel.js';
import { BOAR } from './balance.js';

const b64 = (str, T) => { const bin = atob(str); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new T(u8.buffer); };
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// 모델 좌표(키 0.77, 길이 0.98, 코가 +z) 기준 관절 위치
const LEGS = [[0.13, 0.07], [-0.13, 0.07], [0.13, -0.256], [-0.13, -0.256]]; // 앞왼 · 앞오 · 뒤왼 · 뒤오 (life.js legs4 순서)
const LEG_Y = 0.15;
const JOINT = { body: [0, 0.35, 0], head: [0, 0.36, 0.17], tail: [0, 0.55, -0.43] };
export const BOAR_MODEL_H = 0.77; // 모델 키 (판정 높이 = 이 값 × BOAR.scale)

function weights(pos) {
  const n = pos.length / 3, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    // 뼈 순서: 0 몸, 1 머리, 2 꼬리, 3~6 다리
    const w = [0, 0, 0, 0, 0, 0, 0];
    const low = 1 - sstep(0.1, 0.17, y);
    LEGS.forEach(([lx, lz], i) => { w[3 + i] = low * (1 - sstep(0.085, 0.13, Math.hypot(x - lx, z - lz))); });
    const wLeg = Math.min(1, w[3] + w[4] + w[5] + w[6]);
    w[1] = sstep(0.13, 0.27, z) * (1 - wLeg);
    w[2] = sstep(-0.4, -0.45, z) * sstep(0.42, 0.5, y) * (1 - w[1]);
    w[0] = Math.max(0, 1 - wLeg - w[1] - w[2]);
    const order = [0, 1, 2, 3, 4, 5, 6].sort((a, b) => w[b] - w[a]).slice(0, 4); let sum = 0; order.forEach((k) => { sum += w[k]; });
    order.forEach((k, j) => { si[v * 4 + j] = k; sw[v * 4 + j] = w[k] / (sum || 1); });
  }
  return { si, sw };
}

let geo = null, mat = null;
function shared() {
  if (geo) return;
  const pos = b64(BM.pos, Float32Array), nq = b64(BM.nor, Int8Array), uv = b64(BM.uv, Float32Array), idx = b64(BM.idx, Uint16Array);
  const nor = new Float32Array(nq.length); for (let i = 0; i < nq.length; i++) nor[i] = nq[i] / 127;
  const { si, sw } = weights(pos);
  geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere(); geo.boundingSphere.radius *= 1.2; // 다리·머리 움직임 여유
  const tex = new THREE.TextureLoader().load(BM.tex); tex.colorSpace = TEXCS; tex.flipY = false;
  // 남송이오름은 캐릭터와 같은 3단 툰 명암, 다른 곳은 램버트
  mat = NSMODE ? new THREE.MeshToonMaterial({ map: tex, gradientMap: gradHard, emissive: '#ffffff', emissiveIntensity: 0.16 }) : new THREE.MeshLambertMaterial({ map: tex, color: '#e4e4e4', emissive: '#ffffff', emissiveIntensity: 0.32 });
  mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance *= diffuseColor.rgb / max(diffuse, vec3(0.001));'); };
}

// { root, legs[4], head, tail } — life.js 의 legs4 · 머리 숙이기 · 꼬리 흔들기가 그대로 씀
export function buildBoarModel() {
  shared();
  const bones = ['body', 'head', 'tail', 'legFL', 'legFR', 'legBL', 'legBR'].map((k) => { const b = new THREE.Bone(); b.name = k; return b; });
  const [body, head, tail, ...legs] = bones;
  body.position.set(...JOINT.body);
  const rel = (b, p) => { b.position.set(p[0] - JOINT.body[0], p[1] - JOINT.body[1], p[2] - JOINT.body[2]); body.add(b); };
  rel(head, JOINT.head); rel(tail, JOINT.tail); LEGS.forEach(([x, z], i) => rel(legs[i], [x, LEG_Y, z]));
  const mesh = new THREE.SkinnedMesh(geo, mat); mesh.add(body); mesh.bind(new THREE.Skeleton(bones));
  mesh.castShadow = true;
  const root = new THREE.Group(); mesh.scale.setScalar(BOAR.scale); root.add(mesh);
  return { root, legs, head, tail };
}
