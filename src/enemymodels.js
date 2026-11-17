// 적 모양 (#48): 모델을 갈아 끼우는 곳은 여기 한 곳. 들개·외계인은 Tripo 모델(#71)
// 모든 모양은 { root, legs[4], head, tail, h, fx? } 를 돌려준다
//   legs: 앞왼·앞오·뒤왼·뒤오 (life.js legs4 가 rotation.x 로 흔듦), head: rotation.x 가 +면 숙임, tail: rotation.x 로 흔듦
//   h: 판정 높이(m), fx(dt, time, e): 모양마다 따로 움직이는 것 (침 · 비행접시 흔들림 등). 코는 +z
import * as THREE from 'three';
import { buildBoarModel, BOAR_MODEL_H } from './boar.js';
import { BOAR, ENEMIES } from './balance.js';
import { LOW } from './gfx2.js';
import { unpackProp, propGeometry, propMaterial, glowSprite } from './propmodel.js';
import { whenAsset, placeholderGeo, placeholderMat } from './assets.js'; // #85: 들개·외계인 모델은 따로 받음

const matCache = new Map();
const glow = (c, o = {}) => { const k = 'g' + c + JSON.stringify(o); let m = matCache.get(k); if (!m) { m = new THREE.MeshBasicMaterial({ color: c, ...o }); matCache.set(k, m); } return m; };
const G = {}; // 도형은 한 번만 만듦
const geo = (k, f) => G[k] || (G[k] = f());
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// 아기 멧돼지: 멧돼지 모델을 작게 + 줄무늬
function buildPiglet() {
  const s = BOAR.scale * ENEMIES.piglet.size;
  return { ...buildBoarModel({ scale: s, stripes: true }), h: BOAR_MODEL_H * s };
}
function buildBoar() { return { ...buildBoarModel(), h: BOAR_MODEL_H * BOAR.scale }; }

// 들개 (#71): Tripo 모델(model-dog.js, 3천 삼각형)에 위치로 뼈 가중치를 계산 — 멧돼지(boar.js)와 같은 방식
// 몸·머리·꼬리·다리 4. 짧은 다리라 다리는 발목 위에서 흔들고, 걸음에 맞춰 몸이 통통 튐. 광견병 들개는 같은 모델에 회색빛 + 붉게 빛나는 눈 + 침
const DOG = {
  s: 1.3, // 모델 키 0.83 → 약 1.07m
  legs: [[0.145, 0.19], [-0.145, 0.19], [0.145, -0.145], [-0.145, -0.145]], // 앞왼 · 앞오 · 뒤왼 · 뒤오 (x, z)
  legY: 0.13, body: [0, 0.32, 0], head: [0, 0.42, 0.16], tail: [0, 0.5, -0.33],
  eyes: [[0.07, 0.645, 0.335], [-0.07, 0.645, 0.335]], mouth: [0, 0.47, 0.45],
};
let dogGeo = null, dogTmp = null;
function dogShared(DOG_M) {
  if (dogGeo) return;
  const { pos, nor, uv, idx } = unpackProp(DOG_M), n = pos.length / 3, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const w = [0, 0, 0, 0, 0, 0, 0]; // 0 몸, 1 머리, 2 꼬리, 3~6 다리
    const low = 1 - sstep(0.07, 0.13, y);
    DOG.legs.forEach(([lx, lz], i) => { w[3 + i] = low * (1 - sstep(0.06, 0.09, Math.hypot(x - lx, z - lz))); });
    const wLeg = Math.min(1, w[3] + w[4] + w[5] + w[6]);
    w[1] = sstep(0.1, 0.24, z) * sstep(0.26, 0.4, y) * (1 - wLeg);
    w[2] = sstep(-0.29, -0.35, z) * sstep(0.38, 0.45, y) * (1 - w[1]);
    w[0] = Math.max(0, 1 - wLeg - w[1] - w[2]);
    const order = [0, 1, 2, 3, 4, 5, 6].sort((a, b) => w[b] - w[a]).slice(0, 4); let sum = 0; order.forEach((k) => { sum += w[k]; });
    order.forEach((k, j) => { si[v * 4 + j] = k; sw[v * 4 + j] = w[k] / (sum || 1); });
  }
  dogGeo = new THREE.BufferGeometry();
  dogGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); dogGeo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); dogGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  dogGeo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); dogGeo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4)); dogGeo.setIndex(new THREE.BufferAttribute(idx, 1));
  dogGeo.computeBoundingSphere(); dogGeo.boundingSphere.radius *= 1.2;
}
const dogMat = {};
// 받기 전 임시 모양: 모델 크기의 타원체를 몸 뼈에 붙임
function dogTemp() {
  if (dogTmp) return dogTmp;
  const g = placeholderGeo('dog', 'ball'), n = g.attributes.position.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) sw[v * 4] = 1;
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  return (dogTmp = g);
}
function buildDog({ rabid }) {
  const k = rabid ? 1.05 : 1, S = DOG.s * k;
  const mat = dogMat[rabid ? 'r' : 'd'] || (dogMat[rabid ? 'r' : 'd'] = propMaterial('dog', rabid ? { color: '#b4b2ae', glow: 0.12 } : {}));
  const bones = ['body', 'head', 'tail', 'legFL', 'legFR', 'legBL', 'legBR'].map((nm) => { const b = new THREE.Bone(); b.name = nm; return b; });
  const [body, head, tail, ...legs] = bones;
  body.position.set(...DOG.body);
  const rel = (b, p) => { b.position.set(p[0] - DOG.body[0], p[1] - DOG.body[1], p[2] - DOG.body[2]); body.add(b); };
  rel(head, DOG.head); rel(tail, DOG.tail); DOG.legs.forEach(([x, z], i) => rel(legs[i], [x, DOG.legY, z]));
  const mesh = new THREE.SkinnedMesh(dogGeo || dogTemp(), dogGeo ? mat : placeholderMat(rabid ? '#8d8a86' : '#9b8a72')); mesh.add(body); mesh.bind(new THREE.Skeleton(bones));
  if (!dogGeo) whenAsset('dog', (D) => { dogShared(D); mesh.geometry = dogGeo; mesh.material = mat; });
  mesh.castShadow = !LOW; mesh.scale.setScalar(S);
  const root = new THREE.Group(); root.add(mesh);
  const hp = (p) => new THREE.Vector3(p[0] - DOG.head[0], p[1] - DOG.head[1], p[2] - DOG.head[2]); // 머리 뼈 기준 자리 (모델 좌표)
  const out = { root, legs, head, tail, h: 0.83 * S };
  const drops = [];
  if (rabid) {
    // 붉게 빛나는 눈: 눈 자리에 작은 빛 공 + 번짐
    const eg = geo('rabidEye', () => new THREE.SphereGeometry(0.03, 8, 6)), em = glow('#ff2a1a');
    for (const e of DOG.eyes) { const m = new THREE.Mesh(eg, em); m.position.copy(hp(e)).add(new THREE.Vector3(0, 0, 0.004)); head.add(m); const sp = glowSprite('#ff3a20', 0.16); sp.material.opacity = 0.9; sp.position.copy(m.position); head.add(sp); }
    // 침: 입 아래로 떨어지는 방울 (머리에 붙임)
    const dg = geo('drool', () => new THREE.SphereGeometry(0.018, 5, 4)), dm = glow('#e9f2f0', { transparent: true, opacity: 0.85 });
    for (let i = 0, n = LOW ? 2 : 4; i < n; i++) { const d = new THREE.Mesh(dg, dm); d.userData.t = i / n; d.userData.x = (i % 2 ? 0.03 : -0.025); head.add(d); drops.push(d); }
  }
  const mouth = hp(DOG.mouth);
  out.fx = (dt, time, e) => {
    // 걸음마다 몸이 통통 튀고, 빨리 달릴수록 앞으로 숙임. 받으러 달려들 때(chg) 더 숙이고 머리를 내림
    const run = Math.min(1, e.speed / 8), bob = Math.abs(Math.sin(e.phase)) * (0.012 + run * 0.03);
    body.position.y = DOG.body[1] + bob; body.rotation.x = run * 0.1 + e.chg * 0.12 + Math.sin(e.phase * 2) * 0.03 * run;
    head.rotation.x *= 0.45; head.rotation.x += e.chg * 0.15; // 짧은 목: 멧돼지보다 덜 숙임
    tail.rotation.x = -0.4 + Math.sin(time * (rabid ? 14 : 10) + e.phase) * 0.35; tail.rotation.z = Math.sin(time * 7 + e.phase) * 0.25;
    for (const d of drops) { d.userData.t = (d.userData.t + dt * 1.3) % 1; const t = d.userData.t; d.position.set(mouth.x + d.userData.x, mouth.y - t * t * 0.4, mouth.z); d.scale.setScalar(1 - t * 0.6); }
  };
  return out;
}

// 외계인 (#71): Tripo 비행접시(model-alien.js, 초록 생명체가 탄 접시). 땅에서 떠서 출렁이며 기우뚱, 쏠 때 아래 발사구가 빛남
// 다리는 보이지 않는 빈 자리 (legs4 가 흔들어도 그대로)
let alienMat = null;
const ALIEN = { s: 2.4, hover: 0.95, port: 0.03 }; // 크기(지름 약 2.35m), 뜬 높이, 발사구 높이(모델 좌표)
function buildAlien() {
  const root = new THREE.Group(), hover = new THREE.Group(); hover.position.y = ALIEN.hover; root.add(hover);
  const m = new THREE.Mesh(placeholderGeo('alien', 'ball'), placeholderMat('#8fa39a')); m.scale.setScalar(ALIEN.s); m.castShadow = !LOW; hover.add(m);
  const am = alienMat || (alienMat = propMaterial('alien', { glow: 0.2 }));
  whenAsset('alien', (A) => { m.geometry = propGeometry(A); m.material = am; }); // #85: 받으면 진짜 모양으로
  // 발사구 빛: 아래 가운데 청록 원판 + 번짐 (쏠 때 확 밝아졌다 사그라듦)
  const portY = ALIEN.port * ALIEN.s;
  const port = new THREE.Mesh(geo('ufoPort', () => new THREE.CircleGeometry(0.2, 14).rotateX(Math.PI / 2)), glow('#8ffff0', { transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }).clone());
  port.position.y = portY - 0.03; hover.add(port);
  const halo = glowSprite('#7dffe0', 1.6); halo.position.y = portY - 0.12; hover.add(halo);
  // 아래 빛 기둥 (옅게, 쏠 때 밝게)
  const beamMat = glow('#c9ffb8', { transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(geo('ufoBeam', () => new THREE.ConeGeometry(0.6, 1, 10, 1, true)), beamMat.clone());
  root.add(beam);
  const head = new THREE.Object3D(); hover.add(head); // enemies.js 가 고개를 숙이는 자리 (여기선 접시 기울기로 씀)
  const legs = [0, 1, 2, 3].map(() => { const o = new THREE.Object3D(); root.add(o); return o; });
  const tail = new THREE.Object3D(); root.add(tail);
  let shot = 0;
  return {
    root, legs, head, tail, h: ALIEN.hover + 0.77 * ALIEN.s - 0.3, muzzle: new THREE.Vector3(0, ALIEN.hover + portY - 0.1, 0.1),
    onShot: () => { shot = 1; },
    fx: (dt, time, e) => {
      const y = ALIEN.hover + Math.sin(time * 2.2 + e.phase) * 0.14;
      hover.position.y = y;
      hover.rotation.x = Math.sin(time * 1.3 + e.phase) * 0.08 + Math.min(0.15, e.speed * 0.02); // 앞으로 갈수록 살짝 숙임
      hover.rotation.z = Math.sin(time * 1.7 + e.phase * 1.3) * 0.1;
      shot = Math.max(0, shot - dt * 2.2);
      const k = 0.25 + shot * 0.75 + Math.sin(time * 6 + e.phase) * 0.05;
      port.material.opacity = Math.min(1, k + 0.15); halo.material.opacity = k * 0.9; halo.scale.setScalar(1.2 + shot * 1.4);
      beam.scale.set(1 + shot, y, 1 + shot); beam.position.y = y / 2; beam.material.opacity = 0.08 + shot * 0.3;
    },
  };
}

// 종류 → 모양. 바꾸려면 여기만
export const ENEMY_MODELS = {
  piglet: buildPiglet,
  dog: () => buildDog({}),
  boar: buildBoar,
  rabid: () => buildDog({ rabid: true }),
  alien: buildAlien,
};
export function buildEnemyModel(kind) { return (ENEMY_MODELS[kind] || buildBoar)(); }

// 외계인 광선 (멀리서 쏨). 길쭉하게 빛나는 막대
export function buildBolt() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(geo('boltCore', () => { const c = new THREE.CylinderGeometry(0.07, 0.07, 1.1, 6); c.rotateX(Math.PI / 2); return c; }), glow('#eaffd8'));
  const halo = new THREE.Mesh(geo('boltHalo', () => { const c = new THREE.CylinderGeometry(0.17, 0.17, 1.3, 6); c.rotateX(Math.PI / 2); return c; }), glow('#7dff5a', { transparent: true, opacity: 0.45, depthWrite: false }));
  g.add(core, halo);
  return g;
}
