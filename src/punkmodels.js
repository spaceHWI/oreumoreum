// 오름펑크 상호작용 모양 (#163): 관광객(투기꾼 모양에 색만 다르게 + 목에 카메라)·까마귀(들판 더미 까마귀와 같은 모양)·머리 위 카메라 아이콘·반짝임·그림자
// 모두 로우폴리 임시 모양. 게임 연결은 src/game/punk.js
import * as THREE from 'three';
import { gradHard } from './toon.js';
import { TEXCS } from './boot.js';
import { buildWalker } from './dumpers.js';
import { PUNK } from './balance.js';

const tm = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: gradHard });

// 관광객: 밝은 셔츠·흰 모자·청바지, 목에 카메라 (끈 + 몸체 + 렌즈). 봉투 자리에 작은 쓰레기(버리고 갈 때만 보임)
export function buildTourist() {
  const w = buildWalker({ ...PUNK.tourist.colors, mask: false });
  const cam = new THREE.Group(); cam.position.set(0, 1.42, 0.25); w.body.add(cam);
  const bodyM = tm('#2a2b30');
  const cb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.12), bodyM); cam.add(cb);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.12, 8), tm('#4a4f5c')); lens.rotation.x = Math.PI / 2; lens.position.z = 0.11; cam.add(lens);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.018, 4, 12, Math.PI), tm('#c0392b')); strap.position.set(0, 0.04, -0.12); strap.rotation.x = -0.35; cam.add(strap);
  cam.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  // 봉투 대신 손에 든 작은 쓰레기 (컵·봉지)
  w.bag.clear();
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.22, 7), tm('#f4f1e8')); cup.position.y = -0.1; w.bag.add(cup);
  w.bag.visible = false;
  return { ...w, cam };
}

// 바닥에 버린 쓰레기 두 개 (컵·과자 봉지). 버린 자리에 잠깐 보임
export function buildLitter() {
  const g = new THREE.Group();
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.22, 7), tm('#f4f1e8')); cup.rotation.z = Math.PI / 2; cup.position.set(-0.25, 0.08, 0.1); g.add(cup);
  const snack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.2), tm('#e05a47')); snack.position.set(0.22, 0.03, -0.05); snack.rotation.y = 0.6; g.add(snack);
  return g;
}

// 까마귀: 들판 더미 위 까마귀(src/field.js crowGeo)와 같은 색·모양. 날개를 따로 두어 퍼덕임. 부리 밑에 물고 가는 쓰레기
export function buildCrow() {
  const root = new THREE.Group();
  const wingM = new THREE.MeshBasicMaterial({ color: '#1d1c22', side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0).scale(1.3, 1.05, 2.3), new THREE.MeshBasicMaterial({ color: '#25242a' })); root.add(body);
  const wing = (s) => { const p = new THREE.Group(); const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.45, s * 1.15, 0.15, -0.13, 0, 0, -0.32], 3)); p.add(new THREE.Mesh(g, wingM)); root.add(p); return p; };
  const wings = [wing(-1), wing(1)];
  const loot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.16), tm('#e05a47')); loot.position.set(0, -0.16, 0.42); root.add(loot);
  return { root, wings, loot };
}

// 머리 위 카메라 아이콘 (사진 부탁 중)
let camTex = null;
export function cameraIcon() {
  if (!camTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    g.fillStyle = 'rgba(28,30,34,.78)'; g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#fbf6e6'; g.lineWidth = 4; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(14, 24); g.lineTo(22, 24); g.lineTo(26, 18); g.lineTo(38, 18); g.lineTo(42, 24); g.lineTo(50, 24); g.lineTo(50, 46); g.lineTo(14, 46); g.closePath(); g.stroke();
    g.beginPath(); g.arc(32, 35, 7, 0, Math.PI * 2); g.stroke();
    camTex = new THREE.CanvasTexture(c); camTex.colorSpace = TEXCS;
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: camTex, transparent: true, depthWrite: false })); s.scale.set(0.8, 0.8, 1); s.renderOrder = 5; return s;
}

// 반짝임 (하르방 눈·까마귀가 떨어뜨린 것): 네 갈래 별, 더해 그리기
let sparkTex = null;
export function sparkle(color = '#fff6c8', size = 0.5) {
  if (!sparkTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(32, 0); g.lineTo(35, 29); g.lineTo(64, 32); g.lineTo(35, 35); g.lineTo(32, 64); g.lineTo(29, 35); g.lineTo(0, 32); g.lineTo(29, 29); g.closePath(); g.fill();
    sparkTex = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); s.scale.set(size, size, 1); s.renderOrder = 6; return s;
}

// 땅 그림자 (까마귀가 오기 전 알림)
export function shadowDisc() {
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.9, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0, depthWrite: false }));
  m.renderOrder = 2; return m;
}
