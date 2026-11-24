// 스톤 셰프 차림 (#299): 실제 셰프를 닮게. 민머리·짧은 수염·짙은 눈썹·흰 조리복·짙은 앞치마·러닝 반바지·트레일화·러닝 시계
// - NPC 전용 장비(npc: true, 가게 목록에 안 나옴). gear.js 가 ACCESSORIES 에 붙이고 game/quest.js 가 주는 사람 look.gear 로 입힘
// - 머리는 짧은 머리 Tripo 머리(hat:short)를 쓰고, 모자 칸 'hat:npc-bald' 가 머리카락을 잘라(clip) 살색 정수리·수염·눈썹을 얹음
// - 코드로 그린 로우폴리 조각. 조각 하나하나는 runner bake 가 한 메시로 합침 (장비 하나 = 그리기 한 번)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { HC, ARM, COVER, frontZ, tee, pants, clothAcc } from './clothes.js';

export const CHEF = { skin: '#c98a5e', scalp: '#e6c19d', beard: '#2a211c', clip: 0.835 }; /* scalp: 짧은 머리 텍스처 피부색(lid). skinTint 셰이더가 몸 피부색 비율을 곱함. clip: 이보다 위 머리카락은 안 그림 */
const at = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); return o; };
const G = (...ms) => { const g = new THREE.Group(); ms.flat(3).forEach((m) => m && g.add(m)); return g; };
const both = (f) => [f(1), f(-1)];

function baldHead(mat) { /* 민머리: 정수리 캡(앞 이마선까지) + 옆·뒤 띠(얼굴 앞은 비움). 얼굴과 같은 피부색 셰이더(skinTint)를 받게 텍스처 피부색으로 칠함 */
  const S = mat('scalp', CHEF.scalp), c = [0, 0.79, 0.025], r = 0.272, F = 0.6; /* F: 얼굴 앞 비우는 반각 (눈 바깥까지) */
  const cap = at(new THREE.SphereGeometry(r, 22, 8, 0, Math.PI * 2, 0, 1.56), S, ...c); cap.scale.set(1.02, 1, 1.04);
  const ring = at(new THREE.SphereGeometry(r, 18, 4, Math.PI / 2 + F, Math.PI * 2 - 2 * F, 1.56, 0.6), S, ...c); ring.scale.set(1.02, 1, 1.04);
  return G(cap, ring);
}
function beard(mat) { /* 입 둘레로 이어진 짧은 수염(콧수염·양쪽·턱) + 짙은 눈썹 */
  const B = mat('beard', CHEF.beard), out = [];
  const jaw = at(new THREE.SphereGeometry(0.258, 16, 5, Math.PI * 0.2, Math.PI * 0.6, Math.PI * 0.64, Math.PI * 0.19), B, 0, 0.745, 0.03); jaw.scale.set(1.02, 1, 1.04); out.push(jaw);
  const mus = at(new RoundedBoxGeometry(0.13, 0.028, 0.03, 2, 0.012), B, 0, 0.672, 0.262); mus.rotation.x = -0.2; out.push(mus);
  both((s) => { const k = at(new RoundedBoxGeometry(0.03, 0.06, 0.03, 2, 0.012), B, s * 0.062, 0.648, 0.256); k.rotation.z = s * 0.25; out.push(k); });
  both((s) => { const e = at(new RoundedBoxGeometry(0.085, 0.026, 0.026, 2, 0.011), B, s * 0.085, 0.804, 0.296); e.rotation.z = s * -0.1; e.rotation.y = s * 0.3; out.push(e); });
  return G(out);
}
function chefCoat(mat, L) { /* 흰 조리복: 반팔 틀 + 서 있는 깃 + 앞 단추 한 쌍(앞치마 위) + 소매 끝 접단 */
  const g = tee(mat, { kind: 'tee', main: L.main, acc: L.acc, collar: L.main }), K = mat('btn', L.btn);
  for (const x of [-0.05, 0.05]) for (const y of [0.582]) g.add(at(new THREE.SphereGeometry(0.011, 6, 4), K, x, y, frontZ(y, 0.002)));
  const neck = at(new THREE.CylinderGeometry(0.098, 0.105, 0.04, 14, 1, true), mat('collar2', L.main), 0, 0.615, 0.025); neck.material.side = THREE.DoubleSide; g.add(neck);
  return g;
}
function runShorts(mat, L) { /* 러닝 반바지: 기본 반바지 + 옆 줄 */
  const g = pants(mat, { kind: 'shorts', main: L.main, acc: L.acc }), A = mat('stripe', L.stripe);
  both((s) => g.add(at(new THREE.BoxGeometry(0.008, 0.07, 0.03), A, s * 0.255, 0.235, 0.04)));
  return g;
}
function watch(mat) { /* 러닝 시계: 왼 손목(armL, 기본 자세에서 +x 로 뻗은 팔) 둘레 띠 + 손등 쪽(+y) 화면 */
  const B = mat('band', '#2b2b33'), F = mat('face', '#3fd0c0'), x = 0.372;
  const band = at(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 10, 1), B, x, ARM.y, ARM.z); band.rotation.z = Math.PI / 2;
  return G(band, at(new RoundedBoxGeometry(0.045, 0.016, 0.045, 2, 0.006), B, x, ARM.y + 0.05, ARM.z), at(new THREE.BoxGeometry(0.032, 0.006, 0.032), F, x, ARM.y + 0.059, ARM.z));
}
export function addChef(ACC) {
  ACC['hat:npc-bald'] = { slot: 'hat', label: '민머리', bone: 'head', clip: CHEF.clip, skinTint: true, lid: [230, 193, 157], npc: true, build: baldHead };
  ACC['face:npc-beard'] = { slot: 'face', label: '수염', bone: 'head', npc: true, build: beard };
  ACC['top:npc-chef'] = { slot: 'top', label: '조리복', skin: true, covers: COVER.tee, npc: true, build: (mat) => chefCoat(mat, { main: '#f7f5ef', acc: '#e4e0d4', btn: '#3a3a40' }) };
  ACC['vest:npc-apron-dark'] = { ...clothAcc({ slot: 'vest', name: '짙은 앞치마' }, { kind: 'apron', main: '#3b3d44', acc: '#c8a46a' }), npc: true };
  ACC['bottom:npc-run'] = { slot: 'bottom', label: '러닝 반바지', skin: true, covers: COVER.shorts, npc: true, build: (mat) => runShorts(mat, { main: '#26324a', acc: '#1d2638', stripe: '#f29a2e' }) };
  ACC['hand:npc-watch'] = { slot: 'hand', label: '러닝 시계', bone: 'armL', npc: true, build: watch };
}
