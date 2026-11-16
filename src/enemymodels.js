// 적 모양 (#48): 모델을 갈아 끼우는 곳은 여기 한 곳. 나중에 Tripo 모델로 바꿀 때 이 파일의 build 함수만 바꾼다
// 모든 모양은 { root, legs[4], head, tail, h, fx? } 를 돌려준다
//   legs: 앞왼·앞오·뒤왼·뒤오 (life.js legs4 가 rotation.x 로 흔듦), head: rotation.x 가 +면 숙임, tail: rotation.x 로 흔듦
//   h: 판정 높이(m), fx(dt, time, e): 모양마다 따로 움직이는 것 (침 · 비행접시 흔들림 등). 코는 +z
import * as THREE from 'three';
import { gradHard } from './toon.js';
import { buildBoarModel, BOAR_MODEL_H } from './boar.js';
import { BOAR, ENEMIES } from './balance.js';
import { LOW } from './gfx2.js';

const matCache = new Map();
const tm = (c, o) => { const k = c + (o ? JSON.stringify(o) : ''); let m = matCache.get(k); if (!m) { m = new THREE.MeshToonMaterial({ color: c, gradientMap: gradHard, ...o }); matCache.set(k, m); } return m; };
const glow = (c, o = {}) => { const k = 'g' + c + JSON.stringify(o); let m = matCache.get(k); if (!m) { m = new THREE.MeshBasicMaterial({ color: c, ...o }); matCache.set(k, m); } return m; };
const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = !LOW; return o; };
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const G = {}; // 도형은 한 번만 만듦
const geo = (k, f) => G[k] || (G[k] = f());

// 아기 멧돼지: 멧돼지 모델을 작게 + 줄무늬
function buildPiglet() {
  const s = BOAR.scale * ENEMIES.piglet.size;
  return { ...buildBoarModel({ scale: s, stripes: true }), h: BOAR_MODEL_H * s };
}
function buildBoar() { return { ...buildBoarModel(), h: BOAR_MODEL_H * BOAR.scale }; }

// 들개 (광견병 들개도 같은 뼈대, 색·눈·침만 다름). 키 약 1.1
function buildDog({ fur, belly, dark, eye, rabid }) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const k = rabid ? 1.05 : 1;
  body.scale.setScalar(k);
  body.add(mesh(geo('dogBody', () => box(0.46, 0.42, 1.0)), tm(fur), 0, 0.72, -0.02)); // 몸통
  body.add(mesh(geo('dogChest', () => box(0.4, 0.36, 0.34)), tm(belly), 0, 0.66, 0.3)); // 앞가슴
  const legs = [[0.15, 0.32], [-0.15, 0.32], [0.15, -0.38], [-0.15, -0.38]].map(([x, z]) => {
    const p = new THREE.Group(); p.position.set(x, 0.62, z);
    p.add(mesh(geo('dogLeg', () => box(0.13, 0.6, 0.14)), tm(fur), 0, -0.3, 0), mesh(geo('dogPaw', () => box(0.15, 0.08, 0.19)), tm(dark), 0, -0.58, 0.03));
    body.add(p); return p;
  });
  const head = new THREE.Group(); head.position.set(0, 0.92, 0.48); body.add(head);
  head.add(mesh(geo('dogHead', () => box(0.36, 0.34, 0.36)), tm(fur), 0, 0.06, 0.1));
  head.add(mesh(geo('dogSnout', () => box(0.22, 0.18, 0.26)), tm(belly), 0, -0.02, 0.38));
  head.add(mesh(geo('dogNose', () => box(0.1, 0.08, 0.06)), tm('#1d1a17'), 0, 0.04, 0.52));
  const earG = geo('dogEar', () => new THREE.ConeGeometry(0.08, 0.2, 4));
  [-0.12, 0.12].forEach((x) => { const e = mesh(earG, tm(dark), x, 0.3, 0.02); e.rotation.z = -x * 2; head.add(e); });
  const eyeM = rabid ? glow(eye) : tm(eye);
  [-0.1, 0.1].forEach((x) => head.add(mesh(geo('dogEye', () => box(0.06, 0.06, 0.03)), eyeM, x, 0.12, 0.28)));
  const tail = new THREE.Group(); tail.position.set(0, 0.86, -0.5); body.add(tail);
  const tm0 = mesh(geo('dogTail', () => box(0.08, 0.08, 0.42)), tm(fur), 0, 0.1, -0.18); tm0.rotation.x = rabid ? 0.5 : -0.5; tail.add(tm0);
  const out = { root, legs, head, tail, h: 1.15 * k };
  if (rabid) { // 침: 입 아래로 떨어지는 작은 방울 몇 개 (머리에 붙임)
    const drops = [], n = LOW ? 2 : 4, dg = geo('drool', () => new THREE.SphereGeometry(0.035, 5, 4)), dm = glow('#e9f2f0', { transparent: true, opacity: 0.85 });
    for (let i = 0; i < n; i++) { const d = new THREE.Mesh(dg, dm); d.userData.t = i / n; head.add(d); drops.push(d); }
    out.fx = (dt) => { for (const d of drops) { d.userData.t = (d.userData.t + dt * 1.3) % 1; const t = d.userData.t; d.position.set((d.id % 2 ? 0.05 : -0.04), -0.12 - t * t * 0.55, 0.42); d.scale.setScalar(1 - t * 0.6); } };
  }
  return out;
}

// 외계인: 작은 비행접시를 탄 초록 생명체. 땅에서 떠서 다님. 다리는 보이지 않는 빈 자리 (legs4 가 흔들어도 그대로)
function buildAlien() {
  const root = new THREE.Group(), hover = new THREE.Group(); hover.position.y = 1.35; root.add(hover);
  const disc = geo('ufoDisc', () => { const g = new THREE.CylinderGeometry(1.15, 0.55, 0.32, 12); return g; });
  hover.add(mesh(disc, tm('#a9b2bc'), 0, 0, 0));
  hover.add(mesh(geo('ufoRim', () => new THREE.CylinderGeometry(1.22, 1.22, 0.08, 12)), tm('#6e7782'), 0, 0.12, 0));
  const lights = [];
  const lg = geo('ufoLight', () => new THREE.SphereGeometry(0.09, 6, 4));
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, l = mesh(lg, glow('#ffd84a'), Math.sin(a) * 1.0, -0.06, Math.cos(a) * 1.0); l.castShadow = false; hover.add(l); lights.push(l); }
  // 생명체 (head 로 씀: 고개를 끄덕임)
  const head = new THREE.Group(); head.position.y = 0.18; hover.add(head);
  head.add(mesh(geo('alBody', () => new THREE.CylinderGeometry(0.2, 0.28, 0.4, 8)), tm('#6fc25a'), 0, 0.2, 0));
  const hg = geo('alHead', () => { const g = new THREE.SphereGeometry(0.34, 10, 8); g.scale(1, 1.15, 1); return g; });
  head.add(mesh(hg, tm('#7fd468'), 0, 0.68, 0));
  const eg = geo('alEye', () => { const g = new THREE.SphereGeometry(0.1, 8, 6); g.scale(1.3, 0.7, 0.6); return g; });
  [-0.13, 0.13].forEach((x) => { const e = mesh(eg, tm('#141414'), x, 0.72, 0.27); e.rotation.z = x > 0 ? -0.35 : 0.35; head.add(e); });
  [-0.12, 0.12].forEach((x) => { const a = mesh(geo('alAnt', () => box(0.03, 0.26, 0.03)), tm('#5aa648'), x, 1.08, 0); a.rotation.z = -x * 2; head.add(a); });
  // 광선총 손: 앞쪽으로 내민 막대
  head.add(mesh(geo('alGun', () => box(0.08, 0.08, 0.36)), tm('#3d4650'), 0.22, 0.28, 0.24));
  // 유리 덮개
  hover.add(mesh(geo('ufoDome', () => new THREE.SphereGeometry(0.62, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)), new THREE.MeshToonMaterial({ color: '#bfe6ff', gradientMap: gradHard, transparent: true, opacity: 0.32, depthWrite: false }), 0, 0.14, 0));
  // 땅 그림자 대신 아래 빛 기둥 (옅게)
  const beam = new THREE.Mesh(geo('ufoBeam', () => new THREE.ConeGeometry(0.7, 1.3, 10, 1, true)), glow('#c9ffb8', { transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 0.65; root.add(beam);
  const legs = [0, 1, 2, 3].map(() => { const o = new THREE.Object3D(); root.add(o); return o; });
  const tail = new THREE.Object3D(); root.add(tail);
  return {
    root, legs, head, tail, h: 2.5, muzzle: new THREE.Vector3(0.22, 1.35 + 0.18 + 0.28, 0.45),
    fx: (dt, time, e) => {
      hover.position.y = 1.35 + Math.sin(time * 2.2 + e.phase) * 0.12;
      hover.rotation.y += dt * 0.6; head.rotation.y = -hover.rotation.y; head.rotation.x *= 0.3; // 접시만 돌고 생명체는 앞을 봄, 고개는 조금만
      lights.forEach((l, i) => { l.visible = ((time * 6 + i) | 0) % 3 !== 0; });
    },
  };
}

// 종류 → 모양. 바꾸려면 여기만
export const ENEMY_MODELS = {
  piglet: buildPiglet,
  dog: () => buildDog({ fur: '#b88a5a', belly: '#e2c9a0', dark: '#6b4b30', eye: '#1d1a17' }),
  boar: buildBoar,
  rabid: () => buildDog({ fur: '#77736a', belly: '#a39d90', dark: '#45423c', eye: '#ff2a1a', rabid: true }),
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
