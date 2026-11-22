// 노루·돌하르방 모양 (#2): Tripo 모델(model-deer.js 3천 삼각형, model-hareubang.js 1.8천)을 툰 재질로.
// 모델 자료는 따로 받는다(assets.js). 받기 전에는 같은 크기의 회색 임시 모양 → 오면 갈아 끼움
// 노루는 멧돼지·들개(enemymodels.js)처럼 한 덩어리 모델에 위치로 뼈 가중치(몸·머리·꼬리·다리 4)를 붙여 움직임
import * as THREE from 'three';
import { LOW } from './gfx2.js';
import { LIFE_MODELS as LM, HB_HAT } from './balance.js';
import { unpackProp, propGeometry, propMaterial } from './propmodel.js';
import { whenAsset, want, placeholderGeo, placeholderMat } from './assets.js';

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- 노루 ----------
// 모델 좌표(키 0.98, 코 +z): 짧은 다리 넷, 큰 머리, 엉덩이에 흰 꼬리
const DEER = {
  legs: [[0.108, 0.13], [-0.104, 0.134], [0.105, -0.235], [-0.105, -0.235]], // 앞왼 · 앞오 · 뒤왼 · 뒤오 (x, z)
  legY: 0.15, body: [0, 0.32, -0.05], head: [0, 0.56, 0.05], tail: [0, 0.46, -0.39],
};
let deerGeo = null, deerTmp = null, deerMat = null;
function deerShared(D) {
  if (deerGeo) return;
  const { pos, nor, uv, idx } = unpackProp(D), n = pos.length / 3, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const w = [0, 0, 0, 0, 0, 0, 0]; // 0 몸, 1 머리, 2 꼬리, 3~6 다리
    const low = 1 - sstep(0.1, 0.16, y);
    DEER.legs.forEach(([lx, lz], i) => { w[3 + i] = low * (1 - sstep(0.055, 0.085, Math.hypot(x - lx, z - lz))); });
    const wLeg = Math.min(1, w[3] + w[4] + w[5] + w[6]);
    w[1] = sstep(-0.08, 0.05, z) * sstep(0.5, 0.6, y) * (1 - wLeg);
    w[2] = sstep(-0.34, -0.39, z) * sstep(0.36, 0.42, y) * (1 - w[1]);
    w[0] = Math.max(0, 1 - wLeg - w[1] - w[2]);
    const order = [0, 1, 2, 3, 4, 5, 6].sort((a, b) => w[b] - w[a]).slice(0, 4); let sum = 0; order.forEach((k) => { sum += w[k]; });
    order.forEach((k, j) => { si[v * 4 + j] = k; sw[v * 4 + j] = w[k] / (sum || 1); });
  }
  deerGeo = new THREE.BufferGeometry();
  deerGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); deerGeo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); deerGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  deerGeo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); deerGeo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4)); deerGeo.setIndex(new THREE.BufferAttribute(idx, 1));
  deerGeo.computeBoundingSphere(); deerGeo.boundingSphere.radius *= 1.3;
  deerMat = propMaterial('deer');
}
// 받기 전 임시 모양: 모델 크기의 타원체를 몸 뼈에 붙임
function deerTemp() {
  if (deerTmp) return deerTmp;
  const g = placeholderGeo('deer', 'ball'), n = g.attributes.position.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) sw[v * 4] = 1;
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  return (deerTmp = g);
}
// 노루 가까이 왔는지 보고 모델을 받기 시작 (life.js 가 부름)
let deerWanted = false;
export function wantDeer(dist) { if (!deerWanted && dist < LM.deer.near) { deerWanted = true; want('deer'); } }

// { root, legs[4], head, body, tail, seatY, seatZ, fx(dt, time, d) }. head.rotation.x 가 +면 숙임 (life.js 가 상태별로 정함)
export function buildDeer() {
  const S = LM.deer.scale;
  const bones = ['body', 'head', 'tail', 'legFL', 'legFR', 'legBL', 'legBR'].map((nm) => { const b = new THREE.Bone(); b.name = nm; return b; });
  const [body, head, tail, ...legs] = bones;
  body.position.set(...DEER.body);
  const rel = (b, p) => { b.position.set(p[0] - DEER.body[0], p[1] - DEER.body[1], p[2] - DEER.body[2]); body.add(b); };
  rel(head, DEER.head); rel(tail, DEER.tail); DEER.legs.forEach(([x, z], i) => rel(legs[i], [x, DEER.legY, z]));
  const mesh = new THREE.SkinnedMesh(deerGeo || deerTemp(), deerGeo ? deerMat : placeholderMat('#a88a6a')); mesh.add(body); mesh.bind(new THREE.Skeleton(bones));
  if (!deerGeo) whenAsset('deer', (D) => { deerShared(D); mesh.geometry = deerGeo; mesh.material = deerMat; }, { lazy: true });
  mesh.castShadow = !LOW; mesh.scale.setScalar(S);
  const root = new THREE.Group(); root.add(mesh);
  let last = 'graze', startle = 0, chew = 0;
  // 걷기: 걸음마다 몸이 살짝 출렁 · 달리기·도망: 앞으로 숙이고 꼬리를 세워 흰 엉덩이를 보임
  // 풀 뜯기: 머리를 숙이고 오물오물 · 놀라면(도망 시작) 몸을 움츠렸다 튀어 오름
  const fx = (dt, time, d) => {
    if (d.state === 'flee' && last !== 'flee') startle = 1;
    last = d.state; startle = Math.max(0, startle - dt * 3);
    const run = Math.min(1, d.speed / 7), walk = Math.min(1, d.speed / 1.6) * (1 - run);
    const step = Math.sin(d.phase * 2);
    body.position.y = DEER.body[1] + Math.abs(step) * (0.008 * walk + 0.02 * run) - Math.sin(startle * Math.PI) * 0.03;
    body.rotation.x = run * 0.12 + step * 0.03 * run - startle * 0.15;
    body.rotation.z = step * 0.025 * walk;
    const eat = d.state === 'graze' || d.state === 'eat';
    chew = eat ? chew + dt : 0;
    head.rotation.x = head.rotation.x * 0.62 + (eat ? Math.max(0, Math.sin(chew * 9)) * 0.05 : 0) - startle * 0.25; // 큰 머리라 덜 숙임
    head.rotation.y = d.state === 'alert' ? Math.sin(time * 1.3 + d.phase) * 0.25 : 0;
    const up = d.state === 'flee' || d.state === 'alert' ? 1 : 0;
    tail.rotation.x = -0.2 - up * 0.9 + Math.sin(time * (up ? 16 : 4) + d.phase) * (up ? 0.15 : 0.12);
  };
  return { root, legs, head, body, tail, seatY: LM.deer.seatY, seatZ: LM.deer.seatZ, fx };
}

// ---------- 돌하르방 ----------
// 한 덩어리 모델. 맞으면 받침을 축으로 흔들리고 들썩임 (head: 흔드는 부분, hat 은 예전 코드 호환용 빈 자리)
let hbMat = null;
export function buildHareubang() {
  const S = LM.hareubang.scale;
  const root = new THREE.Group(), sway = new THREE.Group(); root.add(sway);
  const mesh = new THREE.Mesh(placeholderGeo('hareubang', 'box'), placeholderMat('#5e5a55'));
  mesh.scale.setScalar(S); mesh.castShadow = true; mesh.receiveShadow = true; sway.add(mesh);
  whenAsset('hareubang', (M) => { mesh.geometry = propGeometry(M); mesh.material = hbMat || (hbMat = propMaterial('hareubang', { glow: 0.12 })); });
  return { root, head: sway, hat: new THREE.Object3D() };
}
// 맞은 뒤 흔들림 (hitT 1 → 0)
export function shakeHareubang(hb) {
  const k = hb.hitT;
  hb.head.rotation.z = Math.sin(k * 20) * 0.05 * k;
  hb.head.position.y = Math.abs(Math.sin(k * 14)) * 0.08 * k;
  const hat = hb.head.userData.hat; /* 쓴 모자 (#216): 몸통 자식이라 같이 흔들리고, 제 몸에서 한 박자 늦게 조금 더 기욺 */
  if (hat) { hat.rotation.z = Math.sin(k * 20 - HB_HAT.lag) * 0.05 * k * HB_HAT.amp; hat.position.y = hat.userData.y0 + Math.abs(Math.sin(k * 14 - HB_HAT.lag)) * 0.04 * k; }
}
