// 무기 3~6단계 손에 든 모양 (#123): 귤 총·귤 머신건·귤즙 레이저는 왼손(armL, 활과 같은 자리), 귤 폭탄은 오른손(armR, 던지는 손)
// 좌표는 gear.js 와 같은 기본 자세(T포즈) 기준. 왼팔을 앞으로 들면 뼈의 +x 가 앞, +z 가 위 (gear.js 귤 활 주석)
// 지금 그림체(toon 재질·로우폴리)에 맞춘 임시 모양. 작게
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { ACCESSORIES } from './gear.js';

const HL = [0.43, 0.505, 0.045], HR = [-0.43, 0.505, 0.045];
const M = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
const G = (...ms) => { const g = new THREE.Group(); ms.forEach((m) => g.add(m)); return g; };
// 왼손 기준 자리: a = 앞(+x), s = 옆(y), u = 위(+z)
const L = (geo, mat, a, u, s = 0) => M(geo, mat, HL[0] + a, HL[1] + s, HL[2] + u);
const box = (a, s, u, r = 0.012) => new RoundedBoxGeometry(a, s, u, 2, r);
const barrel = (r, len, seg = 8) => new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2); // x 방향 원통
const ORANGE = '#f29a2e', DARK = '#2b2f33', LEAF = '#3f9a5a', CREAM = '#f2efe6';

// 앞 끝(총구) 자리: 탄이 나가는 곳. armL 뼈 안 좌표 (손 = (0, -0.5, 0), 팔을 앞으로 들면 -y 가 앞. throw.js 활과 같은 셈)
export const MUZZLE = { gun: [0, -0.5 - 0.27, 0], mg: [0, -0.5 - 0.37, 0], laser: [0, -0.5 - 0.33, 0] };

Object.assign(ACCESSORIES, {
  // 귤 총: 짧은 주황 몸통 + 검은 손잡이 + 끝에 귤 알
  'hand:gun': { slot: 'hand', label: '귤 총', bone: 'armL', npc: true,
    build: (mat) => { const body = mat('body', ORANGE), dark = mat('dark', DARK), leaf = mat('leaf', LEAF);
      return G(L(box(0.2, 0.055, 0.075), body, 0.07, 0.04), L(box(0.045, 0.045, 0.11, 0.01), dark, 0, -0.03),
        L(barrel(0.02, 0.09), dark, 0.2, 0.045), L(new THREE.SphereGeometry(0.03, 7, 5), body, 0.25, 0.045),
        L(box(0.05, 0.012, 0.02, 0.005), leaf, 0.07, 0.085)); } },
  // 귤 머신건: 긴 몸통 + 위에 귤 통(탄창) + 겹 총열
  'hand:mg': { slot: 'hand', label: '귤 머신건', bone: 'armL', npc: true,
    build: (mat) => { const body = mat('body', '#e2683c'), dark = mat('dark', DARK), tank = mat('tank', ORANGE), leaf = mat('leaf', LEAF);
      const hop = L(new THREE.SphereGeometry(0.065, 8, 6), tank, 0.08, 0.12); hop.scale.set(1, 0.9, 0.85);
      return G(L(box(0.3, 0.07, 0.09), body, 0.08, 0.035), L(box(0.05, 0.05, 0.12, 0.01), dark, -0.01, -0.035),
        L(barrel(0.017, 0.14), dark, 0.29, 0.05, 0.016), L(barrel(0.017, 0.14), dark, 0.29, 0.05, -0.016), L(barrel(0.017, 0.14), dark, 0.29, 0.022),
        hop, L(new THREE.ConeGeometry(0.02, 0.05, 5), leaf, 0.08, 0.19)); } },
  // 귤즙 레이저: 크림색 몸통 + 등에 귤즙 통(주황 원통) + 앞쪽 빛나는 고리
  'hand:laser': { slot: 'hand', label: '귤즙 레이저', bone: 'armL', npc: true,
    build: (mat) => { const body = mat('body', CREAM), dark = mat('dark', DARK), tank = mat('tank', ORANGE), glow = mat('glow', '#ffd27a');
      const ring = L(new THREE.TorusGeometry(0.035, 0.012, 5, 10).rotateY(Math.PI / 2), glow, 0.28, 0.045);
      return G(L(box(0.24, 0.07, 0.08), body, 0.06, 0.035), L(box(0.05, 0.05, 0.11, 0.01), dark, -0.02, -0.035),
        L(barrel(0.032, 0.14, 7), tank, 0.05, 0.1), L(new THREE.ConeGeometry(0.035, 0.08, 8).rotateZ(-Math.PI / 2), dark, 0.22, 0.045), ring); } },
  // 귤 폭탄: 오른손에 쥔 큰 귤 + 잎 + 심지
  'hand:bomb': { slot: 'hand', label: '귤 폭탄', bone: 'armR', npc: true,
    build: (mat) => { const peel = mat('peel', '#ff9a2e'), band = mat('band', DARK), leaf = mat('leaf', LEAF), spark = mat('spark', '#ffe27a');
      const x = HR[0] - 0.06, y = HR[1] - 0.02, z = HR[2] + 0.07;
      const ball = M(new THREE.SphereGeometry(0.085, 9, 7), peel, x, y, z);
      const bd = M(new THREE.TorusGeometry(0.085, 0.011, 4, 14), band, x, y, z); bd.rotation.y = Math.PI / 2;
      const lf = M(new THREE.ConeGeometry(0.035, 0.07, 4), leaf, x, y + 0.11, z + 0.02); lf.rotation.x = 0.6;
      const fuse = M(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 4), band, x, y + 0.12, z - 0.02);
      return G(ball, bd, lf, fuse, M(new THREE.SphereGeometry(0.018, 5, 4), spark, x, y + 0.155, z - 0.02)); } },
});
