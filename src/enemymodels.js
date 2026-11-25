// 적 모양 (#48): 모델을 갈아 끼우는 곳은 여기 한 곳. 들개·외계인은 Tripo 모델(#71)
// 모든 모양은 { root, legs[4], head, tail, h, fx? } 를 돌려준다
//   legs: 앞왼·앞오·뒤왼·뒤오 (life.js legs4 가 rotation.x 로 흔듦), head: rotation.x 가 +면 숙임, tail: rotation.x 로 흔듦
//   h: 판정 높이(m), fx(dt, time, e): 모양마다 따로 움직이는 것 (침 · 비행접시 흔들림 등). 코는 +z
import * as THREE from 'three';
import { buildBoarModel, BOAR_MODEL_H } from './boar.js';
import { BOAR, ENEMIES } from './balance.js';
import { LOW } from './gfx2.js';
import { unpackProp, propGeometry, propMaterial, glowSprite } from './propmodel.js';
import { reportCrash } from './crash.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { whenAsset, placeholderGeo, placeholderMat } from './assets.js'; // #85: 들개·외계인 모델은 따로 받음
import { caseModel } from './casemodels.js';

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
  const g = new THREE.BufferGeometry(); // 다 만든 뒤에 dogGeo 에 넣음 (#108: 도중에 오류가 나면 반쯤 만든 모양을 쓰지 않게)
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere(); g.boundingSphere.radius *= 1.2;
  dogGeo = g;
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

// 들판 떼 (#173) 전용 임시 모양: 로우폴리 한 메시씩 (그리기 횟수를 적게)
const lamb = (c) => { const k = 'l' + c; let m = matCache.get(k); if (!m) { m = new THREE.MeshLambertMaterial({ color: c, flatShading: true }); matCache.set(k, m); } return m; };
const bx = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
// 까마귀: 몸·머리·부리·꼬리 한 메시 + 날개 둘. 멀리선 def.fly m 높이로 날고, 조짐·돌진 때 내려와 쪼고 다시 올라감 (fx)
function buildCrowFoe() {
  const root = new THREE.Group(), fly = new THREE.Group(); root.add(fly);
  const s = BOAR.scale * ENEMIES.crow.size * 0.55;
  const body = new THREE.Mesh(geo('crowBody', () => mergeGeometries([bx(0.34, 0.3, 0.7, 0, 0, 0), bx(0.26, 0.26, 0.3, 0, 0.1, 0.46), bx(0.08, 0.07, 0.24, 0, 0.06, 0.7), bx(0.3, 0.06, 0.34, 0, 0.04, -0.48)])), lamb('#1d1d24'));
  body.scale.setScalar(s); body.castShadow = !LOW; fly.add(body);
  const wGeo = geo('crowWing', () => new THREE.BoxGeometry(0.8, 0.05, 0.42).translate(0.4, 0, 0));
  const wl = new THREE.Mesh(wGeo, lamb('#26262e')), wr = new THREE.Mesh(wGeo, lamb('#26262e'));
  wl.scale.set(-s, s, s); wr.scale.setScalar(s); wl.position.set(-0.12 * s, 0.08 * s, 0); wr.position.set(0.12 * s, 0.08 * s, 0); fly.add(wl, wr);
  const head = new THREE.Object3D(); fly.add(head);
  const legs = [0, 1, 2, 3].map(() => { const o = new THREE.Object3D(); root.add(o); return o; });
  const tail = new THREE.Object3D(); root.add(tail);
  const hi = ENEMIES.crow.fly || 2.8;
  return {
    root, legs, head, tail, h: hi + 0.4,
    fx: (dt, time, e) => {
      const low = e.state === 'wind' || e.state === 'dash' || e.state === 'stagger';
      e.alt = (e.alt ?? hi) + ((low ? 0.55 : hi) - (e.alt ?? hi)) * Math.min(1, dt * (low ? 6 : 2.5));
      fly.position.y = e.alt + Math.sin(time * 3 + e.phase) * 0.12;
      const f = Math.sin(time * (low ? 9 : 14) + e.phase) * (low ? 0.25 : 0.7); wl.rotation.z = f; wr.rotation.z = -f;
      fly.rotation.x = low ? 0.35 : -0.08;
    },
  };
}
// 외계인 드론: 작은 비행 접시 한 메시 + 아래 빛. 약한 광선
function buildDrone() {
  const root = new THREE.Group(), hover = new THREE.Group(); hover.position.y = 1.5; root.add(hover);
  const s = BOAR.scale * ENEMIES.drone.size * 0.5;
  const disc = new THREE.Mesh(geo('droneDisc', () => mergeGeometries([new THREE.CylinderGeometry(0.62, 0.36, 0.16, 10).toNonIndexed(), new THREE.SphereGeometry(0.3, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.07, 0).toNonIndexed()])), lamb('#9aa6b4'));
  disc.scale.setScalar(s); disc.castShadow = !LOW; hover.add(disc);
  const port = new THREE.Mesh(geo('dronePort', () => new THREE.CircleGeometry(0.22, 10).rotateX(Math.PI / 2)), glow('#7dff5a', { transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }).clone());
  port.scale.setScalar(s); port.position.y = -0.09 * s; hover.add(port);
  const head = new THREE.Object3D(); hover.add(head);
  const legs = [0, 1, 2, 3].map(() => { const o = new THREE.Object3D(); root.add(o); return o; });
  const tail = new THREE.Object3D(); root.add(tail);
  let shot = 0;
  return {
    root, legs, head, tail, h: 1.9, muzzle: new THREE.Vector3(0, 1.4, 0.1),
    onShot: () => { shot = 1; },
    fx: (dt, time, e) => {
      hover.position.y = 1.5 + Math.sin(time * 2.6 + e.phase) * 0.18; hover.rotation.y += dt * 3; hover.rotation.z = Math.sin(time * 1.9 + e.phase) * 0.12;
      shot = Math.max(0, shot - dt * 2.5); port.material.opacity = 0.45 + shot * 0.55;
    },
  };
}

// 동굴 박쥐 (#195): 작은 몸 + 넓은 막 날개 둘 + 빛나는 눈. 까마귀처럼 def.fly 높이로 날다 조짐·돌진 때 내려옴
function buildBat() {
  const root = new THREE.Group(), fly = new THREE.Group(); root.add(fly);
  const s = BOAR.scale * ENEMIES.bat.size * 0.55;
  const body = new THREE.Mesh(geo('batBody', () => mergeGeometries([bx(0.3, 0.3, 0.42, 0, 0, 0), bx(0.24, 0.22, 0.2, 0, 0.06, 0.28), bx(0.06, 0.12, 0.04, -0.08, 0.22, 0.32), bx(0.06, 0.12, 0.04, 0.08, 0.22, 0.32)])), lamb('#3a2f45'));
  body.scale.setScalar(s); fly.add(body);
  const eyes = new THREE.Mesh(geo('batEyes', () => mergeGeometries([bx(0.05, 0.04, 0.02, -0.06, 0.09, 0.385), bx(0.05, 0.04, 0.02, 0.06, 0.09, 0.385)])), glow('#ff5a4a'));
  eyes.scale.setScalar(s); fly.add(eyes);
  const wGeo = geo('batWing', () => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.18, 0.95, 0, 0.1, 0.7, 0, -0.32, 0, 0, 0.18, 0.7, 0, -0.32, 0.25, 0, -0.18], 3)); g.computeVertexNormals(); return g; });
  const wm = new THREE.MeshLambertMaterial({ color: '#4c3d5c', side: THREE.DoubleSide, flatShading: true });
  const wl = new THREE.Mesh(wGeo, wm), wr = new THREE.Mesh(wGeo, wm);
  wl.scale.set(-s, s, s); wr.scale.setScalar(s); wl.position.set(-0.1 * s, 0.08 * s, 0); wr.position.set(0.1 * s, 0.08 * s, 0); fly.add(wl, wr);
  const head = new THREE.Object3D(); fly.add(head);
  const legs = [0, 1, 2, 3].map(() => { const o = new THREE.Object3D(); root.add(o); return o; });
  const tail = new THREE.Object3D(); root.add(tail);
  const hi = ENEMIES.bat.fly || 2.2;
  return {
    root, legs, head, tail, h: hi + 0.3,
    fx: (dt, time, e) => {
      const low = e.state === 'wind' || e.state === 'dash' || e.state === 'stagger';
      e.alt = (e.alt ?? hi) + ((low ? 0.7 : hi) - (e.alt ?? hi)) * Math.min(1, dt * (low ? 7 : 3));
      fly.position.y = e.alt + Math.sin(time * 5 + e.phase) * 0.16;
      const f = Math.sin(time * 20 + e.phase) * 0.8; wl.rotation.z = f; wr.rotation.z = -f;
      fly.rotation.x = low ? 0.4 : 0;
    },
  };
}
// 눈먼 동굴 게 (#195): 납작한 등딱지 + 집게 둘 + 다리(한 메시) + 하얀 눈. 걸을 때 옆으로 흔들림, 조짐 때 집게를 듦
function buildCrab() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const s = BOAR.scale * ENEMIES.crab.size * 0.62;
  const shell = new THREE.Mesh(geo('crabShell', () => mergeGeometries([new THREE.SphereGeometry(0.6, 8, 4).scale(1.25, 0.42, 0.9).translate(0, 0.55, 0).toNonIndexed(), ...[-1, 1].flatMap((sd) => [0, 1, 2].map((k) => bx(0.7, 0.07, 0.08, sd * 0.85, 0.35, -0.25 + k * 0.25).rotateZ(sd * 0.35).toNonIndexed()))])), lamb('#7d5a4c'));
  shell.scale.setScalar(s); body.add(shell);
  const eye = new THREE.Mesh(geo('crabEye', () => mergeGeometries([bx(0.08, 0.16, 0.08, -0.18, 0.86, 0.5), bx(0.08, 0.16, 0.08, 0.18, 0.86, 0.5)])), glow('#e9eef2'));
  eye.scale.setScalar(s); body.add(eye);
  const cGeo = geo('crabClaw', () => mergeGeometries([bx(0.16, 0.14, 0.45, 0, 0, 0.2), bx(0.3, 0.2, 0.3, 0, 0.02, 0.5), bx(0.08, 0.08, 0.22, 0.06, 0.12, 0.7)]));
  const cm = lamb('#a0644e'), cl = new THREE.Mesh(cGeo, cm), cr = new THREE.Mesh(cGeo, cm);
  cl.scale.setScalar(s); cr.scale.setScalar(s); cl.position.set(-0.5 * s, 0.55 * s, 0.45 * s); cr.position.set(0.5 * s, 0.55 * s, 0.45 * s); body.add(cl, cr);
  const head = new THREE.Object3D(); head.position.set(0, 0.6 * s, 0.6 * s); body.add(head);
  const legs = [0, 1, 2, 3].map(() => { const o = new THREE.Object3D(); root.add(o); return o; });
  const tail = new THREE.Object3D(); root.add(tail);
  return {
    root, legs, head, tail, h: 0.9 * s,
    fx: (dt, time, e) => {
      body.rotation.z = Math.sin(e.phase * 2.2) * 0.08 * Math.min(1, e.speed);
      const up = e.state === 'wind' || e.state === 'dash' ? 0.9 : 0.15 + Math.sin(time * 2 + e.phase) * 0.1;
      cl.rotation.x = cr.rotation.x = -up; cl.rotation.y = 0.3; cr.rotation.y = -0.3;
    },
  };
}

// 동굴의 주인 (#195 3번 조각): 거대한 외계 분리수거 로봇. 네모난 몸통 앞에 분리수거 통 셋(색 뚜껑), 둥근 머리 + 빛나는 눈띠, 집게 팔 둘, 무한궤도 둘
//   걸을 때 몸이 덜컹이고, 조짐(wind) 때 팔을 들고 눈이 밝아짐. 크기는 CAVE.owner.k 로 키움
function buildRobot() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const s = BOAR.scale * ENEMIES.robot.size * 0.5;
  const hull = new THREE.Mesh(geo('robotHull', () => mergeGeometries([bx(1.5, 1.2, 1.0, 0, 1.25, 0), bx(1.6, 0.14, 1.1, 0, 1.9, 0), bx(0.5, 0.25, 0.5, 0, 2.05, 0)])), lamb('#5d6670'));
  hull.scale.setScalar(s); body.add(hull);
  const binGeo = geo('robotBin', () => bx(0.4, 0.62, 0.12, 0, 0, 0));
  ['#3f8f4a', '#3f6fb0', '#c9a23a'].forEach((c, i) => { const m = new THREE.Mesh(binGeo, lamb(c)); m.scale.setScalar(s); m.position.set((i - 1) * 0.47 * s, 1.18 * s, 0.53 * s); body.add(m); });
  const tread = new THREE.Mesh(geo('robotTread', () => mergeGeometries([bx(0.42, 0.5, 1.4, -0.62, 0.25, 0), bx(0.42, 0.5, 1.4, 0.62, 0.25, 0)])), lamb('#2b2e33'));
  tread.scale.setScalar(s); root.add(tread);
  const headG = new THREE.Group(); headG.position.set(0, 2.35 * s, 0.05 * s); body.add(headG);
  const dome = new THREE.Mesh(geo('robotDome', () => new THREE.SphereGeometry(0.42, 8, 5).scale(1.15, 0.8, 1).toNonIndexed()), lamb('#7c8792')); dome.scale.setScalar(s); headG.add(dome);
  const visor = new THREE.Mesh(geo('robotVisor', () => bx(0.62, 0.12, 0.1, 0, 0.02, 0.38)), glow('#7dffb0')); visor.scale.setScalar(s); headG.add(visor);
  const antenna = new THREE.Mesh(geo('robotAnt', () => mergeGeometries([bx(0.04, 0.4, 0.04, 0, 0.5, 0), bx(0.12, 0.12, 0.12, 0, 0.74, 0)])), glow('#ff6a4a')); antenna.scale.setScalar(s); headG.add(antenna);
  const armGeo = geo('robotArm', () => mergeGeometries([bx(0.22, 0.22, 0.9, 0, 0, 0.35), bx(0.08, 0.3, 0.26, -0.08, 0, 0.88), bx(0.08, 0.3, 0.26, 0.08, 0, 0.88)]));
  const am = lamb('#8a939c'), al = new THREE.Mesh(armGeo, am), ar = new THREE.Mesh(armGeo, am);
  al.scale.setScalar(s); ar.scale.setScalar(s); al.position.set(-0.92 * s, 1.55 * s, 0.1 * s); ar.position.set(0.92 * s, 1.55 * s, 0.1 * s); body.add(al, ar);
  const head = new THREE.Object3D(); head.position.set(0, 2.35 * s, 0.5 * s); body.add(head);
  const legs = [0, 1, 2, 3].map(() => { const o = new THREE.Object3D(); root.add(o); return o; });
  const tail = new THREE.Object3D(); root.add(tail);
  return {
    root, legs, head, tail, h: 2.8 * s,
    fx: (dt, time, e) => {
      body.position.y = Math.abs(Math.sin(time * 6 + e.phase)) * 0.05 * s * Math.min(1, e.speed);
      const up = e.state === 'wind' || e.state === 'dash' ? 1.0 : 0.1 + Math.sin(time * 1.6 + e.phase) * 0.08;
      al.rotation.x = ar.rotation.x = -up; headG.rotation.y = Math.sin(time * 0.9 + e.phase) * 0.35;
      visor.scale.y = s * (up > 0.5 ? 1.8 : 1 + 0.25 * Math.sin(time * 4));
    },
  };
}

// 빅풋 (#296): 갈색 털 큰 덩치(몸·머리·팔·다리는 따로 메시, 재질 셋). 돌을 던지려 할 때(e.ps.aim > 0) 두 팔로 돌을 머리 위로 들어 올림
function buildBigfoot() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const s = BOAR.scale * ENEMIES.bigfoot.size * 0.5, fur = lamb('#6e4a32'), dark = lamb('#4a3122'), face = lamb('#b88a6a');
  const trunk = new THREE.Mesh(geo('bfTrunk', () => mergeGeometries([bx(1.0, 1.1, 0.7, 0, 1.45, 0), bx(1.15, 0.5, 0.8, 0, 1.95, -0.05), bx(0.8, 0.35, 0.6, 0, 0.92, 0)])), fur);
  trunk.scale.setScalar(s); trunk.castShadow = !LOW; body.add(trunk);
  const headG = new THREE.Group(); headG.position.set(0, 2.25 * s, 0.12 * s); body.add(headG);
  const hm = new THREE.Mesh(geo('bfHead', () => bx(0.55, 0.5, 0.5, 0, 0.2, 0)), fur); hm.scale.setScalar(s); headG.add(hm);
  const fm = new THREE.Mesh(geo('bfFace', () => mergeGeometries([bx(0.38, 0.28, 0.06, 0, 0.16, 0.26), bx(0.36, 0.06, 0.08, 0, 0.36, 0.25)])), face); fm.scale.setScalar(s); headG.add(fm);
  const armGeo = geo('bfArm', () => bx(0.3, 1.15, 0.32, 0, -0.5, 0));
  const al = new THREE.Mesh(armGeo, dark), ar = new THREE.Mesh(armGeo, dark);
  al.scale.setScalar(s); ar.scale.setScalar(s); al.position.set(-0.68 * s, 1.95 * s, 0); ar.position.set(0.68 * s, 1.95 * s, 0); body.add(al, ar);
  const rock = new THREE.Mesh(geo('bfRock', () => new THREE.DodecahedronGeometry(0.55, 0)), lamb('#7a6f63')); rock.position.set(0, 3.1 * s, 0.1 * s); rock.scale.setScalar(s * 1.5); rock.visible = false; body.add(rock);
  const legGeo = geo('bfLeg', () => bx(0.36, 0.85, 0.4, 0, -0.42, 0));
  const ll = new THREE.Mesh(legGeo, dark), lr = new THREE.Mesh(legGeo, dark);
  ll.scale.setScalar(s); lr.scale.setScalar(s); ll.position.set(-0.28 * s, 0.85 * s, 0); lr.position.set(0.28 * s, 0.85 * s, 0); root.add(ll, lr);
  const head = new THREE.Object3D(); headG.add(head);
  const legs = [ll, lr, new THREE.Object3D(), new THREE.Object3D()]; legs[2].visible = legs[3].visible = false; root.add(legs[2], legs[3]);
  const tail = new THREE.Object3D(); root.add(tail);
  return {
    root, legs, head, tail, h: 2.6 * s,
    fx: (dt, time, e) => {
      const aim = e.ps?.aim > 0, sw = Math.sin(e.phase) * 0.5 * Math.min(1, e.speed / 2);
      rock.visible = aim; const up = aim ? Math.PI * 0.92 : e.state === 'wind' || e.state === 'dash' ? 1.4 : 0;
      al.rotation.x += ((aim || up ? -up : sw) - al.rotation.x) * Math.min(1, dt * 8); ar.rotation.x += ((aim || up ? -up : -sw) - ar.rotation.x) * Math.min(1, dt * 8);
      body.position.y = Math.abs(Math.sin(e.phase)) * 0.06 * s * Math.min(1, e.speed); headG.rotation.y = aim ? 0 : Math.sin(time * 0.7 + e.phase) * 0.25;
    },
  };
}
// 설인 (#296): 사건 5 의 그 설인 모델(caseModel 'yeti')을 그대로. 걸으면 walk, 던질 조짐(e.ps.aim)엔 wave, 맞으면(e.shyT) lookback
function buildYeti() {
  const root = new THREE.Group(), m = caseModel('yeti'); root.add(m.root);
  const head = new THREE.Object3D(); head.position.y = 2.4; root.add(head);
  const legs = [0, 1, 2, 3].map(() => { const o = new THREE.Object3D(); root.add(o); return o; });
  const tail = new THREE.Object3D(); root.add(tail);
  return {
    root, legs, head, tail, h: 2.8, cm: m,
    fx: (dt, time, e) => { m.play(e.shyT > 0 ? 'lookback' : e.ps?.aim > 0 ? 'wave' : e.speed > 0.4 ? 'walk' : 'idle'); m.update(dt); head.rotation.set(0, 0, 0); },
  };
}

// 종류 → 모양. 바꾸려면 여기만
export const ENEMY_MODELS = {
  piglet: buildPiglet,
  dog: () => buildDog({}),
  boar: buildBoar,
  rabid: () => buildDog({ rabid: true }),
  alien: buildAlien,
  crow: buildCrowFoe, // #173 들판 떼
  drone: buildDrone,
  bat: buildBat, crab: buildCrab, robot: buildRobot, // #195 동굴
  bigfoot: buildBigfoot, yeti: buildYeti, // #296 던지는 놈
};
// #108: 모양을 만들다 오류가 나면(받은 자료가 깨짐 등) 대신할 모양으로 계속
export function buildEnemyModel(kind) {
  try { return (ENEMY_MODELS[kind] || buildBoar)(); } catch (e) { reportCrash(e, 'model ' + kind); return buildFallback(kind); }
}
function buildFallback(kind) {
  const root = new THREE.Group(), s = (ENEMIES[kind]?.size || 1);
  const m = new THREE.Mesh(geo('fallback', () => new THREE.SphereGeometry(0.5, 10, 7).scale(0.9, 0.8, 1.4).translate(0, 0.45, 0)), placeholderMat('#8d8478'));
  m.scale.setScalar(s); m.castShadow = !LOW; root.add(m);
  const head = new THREE.Object3D(); head.position.set(0, 0.5 * s, 0.6 * s); root.add(head);
  const legs = [0, 1, 2, 3].map(() => { const o = new THREE.Object3D(); root.add(o); return o; });
  const tail = new THREE.Object3D(); root.add(tail);
  return { root, legs, head, tail, h: 0.9 * s };
}

// 외계인 광선 (멀리서 쏨). 길쭉하게 빛나는 막대
export function buildBolt() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(geo('boltCore', () => { const c = new THREE.CylinderGeometry(0.07, 0.07, 1.1, 6); c.rotateX(Math.PI / 2); return c; }), glow('#eaffd8'));
  const halo = new THREE.Mesh(geo('boltHalo', () => { const c = new THREE.CylinderGeometry(0.17, 0.17, 1.3, 6); c.rotateX(Math.PI / 2); return c; }), glow('#7dff5a', { transparent: true, opacity: 0.45, depthWrite: false }));
  g.add(core, halo);
  return g;
}
