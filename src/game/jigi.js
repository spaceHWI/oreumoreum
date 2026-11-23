// 오름지기 차림·동작 (#282): 들머리 안내판 옆 퀘스트 주는 사람(game/quest.js person('jigi'))을 한눈에 오름지기로 보이게 다시 입히고 움직임을 붙인다. 파일 순서는 quest 뒤
// - 새 모델 없이 지금 캐릭터 그리기 그대로(사진사 #268 처럼 옷·소품만). 안 세 가지(QUESTS.givers.jigi.style): A 밀짚모자·주황 조끼, B 정당벌립·갈옷, C 농모(목 가리개)·토시·반사띠 조끼
// - 모든 안이 같이 가진 것: 희끗한 짙은 눈썹·콧수염·옆머리, 목에 건 수건, 가슴 '오름지기' 이름표, 낡은 배낭, 허리 봉지 뭉치, 장화, 은색 긴 집게(오른손), 살짝 굽은 등
//   → 사건 2 흰 옷(casemodels.js 'ghost-keeper': 짙은 회색 눈썹·은색 긴 집게·봉지)과 같은 사람으로 보이게. 사건 2 를 종결하면 허리 봉지 뭉치가 흰 자루로 바뀜(그 전엔 티 안 남)
// - 동작: 기다릴 땐 둘러보기 ↔ 허리 두드리기 ↔ 집게 딸깍, 다가오면 모자를 살짝 들어 인사(quest.js wave → g.pose 'wave'), 말할 땐(퀘스트 창) 수첩에 적음(집게는 허리 고리), 밤엔 손전등
// - 모자·집게·수첩·손전등은 뼈에 직접 붙인 한 덩어리씩(움직여야 해서 장비 칸 아님). 나머지는 NPC 전용 장비(npc: true, 옷장·가게에 안 나옴)
// 바꾸는 법: src/balance.js QUESTS.givers.jigi.style 를 'A'·'B'·'C' 중 하나로. dev: __oreum.jigi (set('B')·style·state()·test('night'|'note'|'hat'|'back'|'click'|null))
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { QUESTS } from '../balance.js';
import { ACCESSORIES } from '../gear.js';
import { CLOTH_BUILD, COVER, frontZ } from '../clothes.js';
import { gradHard } from '../toon.js';
import { TEXCS } from '../boot.js';
import { LOW } from '../gfx2.js';
import { DEFAULT_OUTFIT } from '../runner.js';
import { late } from './state.js';
import { sunState } from './scene.js';

const D = QUESTS.givers.jigi || {};
const M = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
const G = (...ms) => { const g = new THREE.Group(); ms.flat(3).forEach((m) => m && g.add(m)); return g; };

/* ---------- 안 ---------- */
const STYLE = {
  A: { name: '밀짚모자', hat: 'straw', main: '#e6cc8a', band: '#a8553a', shirt: '#8b8a6c', pants: '#5c4c38', vest: '#e2894c', vestAcc: '#c56f36', towel: '#f4f1e6', stripe: '#5a86b8', boots: '#2f3a33', pack: '#9a8a62' },
  B: { name: '정당벌립', hat: 'beollip', main: '#5e4a33', band: '#3d3022', shirt: '#b8733e', pants: '#8e5a30', vest: '#e8935a', vestAcc: '#c9773f', towel: '#f2e6b8', stripe: '#b8733e', boots: '#33302c', pack: '#7d6a4c' },
  C: { name: '농모', hat: 'farm', main: '#cdbf92', band: '#8e8466', shirt: '#7c8189', pants: '#4b5242', vest: '#ee8f45', vestAcc: '#d9dde2', towel: '#e8f0e0', stripe: '#4e9a5e', boots: '#24282c', pack: '#6f7a5a', cuffs: '#d96a7a', bands: true },
};
let style = STYLE[D.style] ? D.style : 'A';
const S = () => STYLE[style];

/* ---------- 장비 칸 것 (모델 기본 자세 좌표, 키 0.98) ---------- */
const GRAY = '#a9a49a', BROW = '#8f8b84';
Object.assign(ACCESSORIES, {
  // 모자 칸: 모자는 머리 뼈에 따로 붙임 → 이 칸은 구운 초록 모자를 감추고 머리카락만 자름
  'hat:jigi-none': { slot: 'hat', label: '오름지기 모자 자리', bone: 'head', clip: 0.97, hide: ['hat'], npc: true, build: () => new THREE.Group() },
  // 얼굴: 희끗한 옆·뒷머리(모자 밑으로 보임) + 짙은 눈썹 + 콧수염
  'face:jigi': { slot: 'face', label: '오름지기 얼굴', bone: 'head', npc: true,
    build: (mat) => { const H = mat('hair', GRAY), B = mat('brow', BROW);
      const ring = M(new THREE.SphereGeometry(0.258, 22, 6, Math.PI / 2 + 1.05, Math.PI * 2 - 2.1, 1.25, 0.4), H, 0, 0.775, 0.035); ring.material.side = THREE.DoubleSide;
      const brow = (s) => { const b = M(new RoundedBoxGeometry(0.078, 0.03, 0.035, 2, 0.012), B, s * 0.092, 0.808, 0.25); b.rotation.z = s * -0.22; b.rotation.y = s * 0.32; return b; };
      const mus = (s) => { const m = M(new THREE.SphereGeometry(0.045, 10, 8), B, s * 0.036, 0.66, 0.27); m.scale.set(1.3, 0.6, 0.7); m.rotation.z = s * 0.35; return m; };
      return G(ring, brow(1), brow(-1), mus(1), mus(-1)); } },
});
// 안마다 옷 (조끼·윗옷·바지·장화·배낭은 색만 다름 → 안을 바꿀 때 다시 만듦)
function defineStyle(st) {
  const k = 'jigi' + style;
  ACCESSORIES['top:' + k] = { slot: 'top', label: '긴팔', skin: true, covers: COVER.teeLong, npc: true, build: (mat) => CLOTH_BUILD.tee(mat, { long: true, main: st.shirt, acc: st.shirt }) };
  ACCESSORIES['bottom:' + k] = { slot: 'bottom', label: '작업 바지', skin: true, covers: COVER.long, npc: true, build: (mat) => CLOTH_BUILD.long(mat, { kind: 'long', main: st.pants, acc: st.pants, knee: true, pockets: true }) };
  ACCESSORIES['vest:' + k] = { slot: 'vest', label: '오름지기 조끼', skin: true, npc: true, build: (mat) => CLOTH_BUILD.vest(mat, { main: st.vest, acc: st.vestAcc, pockets: 2, bands: !!st.bands }) };
  ACCESSORIES['shoes:' + k] = { slot: 'shoes', label: '장화', skin: true, covers: COVER.boots, npc: true, build: (mat) => CLOTH_BUILD.boots(mat, { kind: 'boots', main: st.boots, acc: '#1c1f1c' }) };
  ACCESSORIES['back:' + k] = { slot: 'back', label: '오름지기 배낭', bone: 'chest', npc: true, build: (mat) => backPack(mat, st) };
  return { hair: 'hair:base', hat: 'hat:jigi-none', face: 'face:jigi', back: 'back:' + k, top: 'top:' + k, bottom: 'bottom:' + k, vest: 'vest:' + k, jacket: 'jacket:none', socks: 'socks:none', shoes: 'shoes:' + k, hand: 'hand:none' };
}
// 가슴 이름표 글씨 (하나만 만들어 같이 씀)
let tagTex = null;
function tagMat() {
  if (!tagTex) { const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d');
    g.fillStyle = '#f6f1e2'; g.fillRect(0, 0, 256, 96); g.strokeStyle = '#4a3a28'; g.lineWidth = 6; g.strokeRect(5, 5, 246, 86);
    g.fillStyle = '#3a2e20'; g.font = '900 52px "Gothic A1", "Noto Sans KR", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('오름지기', 128, 52);
    tagTex = new THREE.CanvasTexture(c); tagTex.colorSpace = TEXCS; }
  const m = new THREE.MeshToonMaterial({ map: tagTex, gradientMap: gradHard, emissive: '#ffffff', emissiveIntensity: 0.25 }); m.emissiveMap = tagTex; return m;
}
// 가슴 뼈: 낡은 배낭 + 목에 건 수건 + 가슴 이름표 + 허리 봉지 뭉치(사건 2 뒤엔 흰 자루는 따로) + 허리 집게 고리
function backPack(mat, st) {
  const P = mat('pack', st.pack), PD = mat('packD', new THREE.Color(st.pack).multiplyScalar(0.75).getStyle()), T = mat('towel', st.towel), TS = mat('stripe', st.stripe), R = mat('roll', '#5f8f63'), RW = mat('rollw', '#d9d4c4'), L = mat('loop', '#3a3a36');
  const pack = M(new RoundedBoxGeometry(0.3, 0.3, 0.14, 3, 0.06), P, 0, 0.42, -0.19); pack.rotation.x = -0.08;
  const flap = M(new RoundedBoxGeometry(0.31, 0.09, 0.15, 2, 0.035), PD, 0, 0.55, -0.19);
  const pocket = M(new RoundedBoxGeometry(0.18, 0.11, 0.05, 2, 0.02), PD, 0, 0.37, -0.275);
  const patch = M(new RoundedBoxGeometry(0.06, 0.05, 0.012, 1, 0.006), mat('patch', '#c9b98a'), 0.07, 0.47, -0.268); // 덧댄 천
  // 수건: 목 뒤로 걸쳐 앞으로 늘어진 두 자락 (끝에 줄무늬)
  const ring = M(new THREE.TorusGeometry(0.115, 0.032, 6, 18), T, 0, 0.605, 0.01); ring.rotation.x = Math.PI / 2 - 0.15; ring.scale.set(1.08, 1.12, 1);
  const tails = [1, -1].map((s) => { const y = 0.555, z = frontZ(y, 0.06); const t = M(new RoundedBoxGeometry(0.062, 0.11, 0.022, 2, 0.01), T, s * 0.08, y, z); t.rotation.x = -0.12; t.rotation.z = s * 0.08; const b = M(new THREE.BoxGeometry(0.064, 0.016, 0.024), TS, s * 0.08 + s * 0.003, y - 0.038, z + 0.005); return [t, b]; });
  // 허리 오른쪽: 돌돌 만 봉지 뭉치(초록·흰 봉지), 왼쪽: 집게 고리
  const rolls = [[0.205, 0.255, 0.03, R], [0.22, 0.225, -0.01, RW], [0.2, 0.235, -0.045, R]].map(([x, y, z, m]) => { const c = M(new THREE.CylinderGeometry(0.03, 0.03, 0.09, 10), m, -x, y, z); c.rotation.z = Math.PI / 2 - 0.2; return c; });
  const loop = M(new THREE.TorusGeometry(0.03, 0.009, 5, 10), L, 0.21, 0.25, 0.06); loop.rotation.y = Math.PI / 2;
  const tag = M(new THREE.PlaneGeometry(0.11, 0.042), tagMat(), 0.105, 0.47, frontZ(0.47, 0.04) + 0.01); tag.rotation.x = -0.12; tag.userData.keep = true; // 왼쪽 가슴 (조끼 판 위)
  return G(pack, flap, pocket, patch, ring, tails, rolls, loop, tag);
}

/* ---------- 뼈에 따로 붙이는 것: 한 덩어리 = 한 번 그리기 (조각 색은 정점 색) ---------- */
const EMI = 0.16;
function vcMat() { const m = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: gradHard, vertexColors: true }); m.emissive.setScalar(EMI);
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vColor.rgb;'); }; return m; }
// parts: [geo, '#색', x, y, z, rx, ry, rz, sx, sy, sz] → Mesh 하나
function one(parts, mat = vcMat()) {
  const gs = parts.map(([geo, c, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1]) => {
    const g = (geo.index ? geo.toNonIndexed() : geo); for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));
    const col = new THREE.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; });
  const m = new THREE.Mesh(mergeGeometries(gs), mat); gs.forEach((g) => g.dispose()); m.castShadow = !LOW; return m;
}
const CY = (r1, r2, h, s = 12, open = false) => new THREE.CylinderGeometry(r1, r2, h, s, 1, open);
const SP = (r, w = 12, h = 8) => new THREE.SphereGeometry(r, w, h);
const RB = (x, y, z, r = 0.01) => new RoundedBoxGeometry(x, y, z, 2, r);
// 모자 (머리 위 가운데 HC=(0, 0.8, 0.042) 기준, 원점 = 모자 밑 가운데)
function hatMesh(st) {
  const H = st.main, B = st.band;
  if (st.hat === 'beollip') return one([ // 정당벌립: 낮고 둥근 정수리 + 넓고 살짝 처진 챙, 엮은 줄
    [CY(0.2, 0.25, 0.12, 20), H, 0, 0.09, 0], [SP(0.2, 20, 6), H, 0, 0.15, 0, 0, 0, 0, 1, 0.35, 1],
    [CY(0.26, 0.5, 0.06, 28, true), H, 0, 0.015, 0], [CY(0.5, 0.52, 0.018, 28), H, 0, -0.016, 0],
    [CY(0.255, 0.255, 0.03, 20, true), B, 0, 0.05, 0], [CY(0.38, 0.38, 0.012, 24, true), B, 0, 0.0, 0]]);
  if (st.hat === 'farm') return one([ // 농모: 둥근 통 + 앞챙 + 목 뒤를 덮는 천
    [CY(0.215, 0.258, 0.16, 20), H, 0, 0.1, 0], [SP(0.215, 20, 6), H, 0, 0.18, 0, 0, 0, 0, 1, 0.28, 1],
    [CY(0.257, 0.4, 0.05, 26, true), H, 0, 0.005, 0.03, 0.12, 0, 0, 1, 1, 1.1], [CY(0.262, 0.262, 0.035, 20, true), B, 0, 0.05, 0],
    [new THREE.CylinderGeometry(0.28, 0.33, 0.2, 18, 1, true, Math.PI * 0.62, Math.PI * 0.76), H, 0, -0.07, -0.01]]);
  return one([ // 밀짚모자(넓은 챙, 낡아 끝이 들쭉날쭉) + 빛바랜 띠
    [CY(0.205, 0.255, 0.17, 20), H, 0, 0.1, 0], [SP(0.205, 20, 6), H, 0, 0.185, 0, 0, 0, 0, 1, 0.28, 1],
    [CY(0.256, 0.5, 0.03, 30, true), H, 0, 0.012, 0], [CY(0.5, 0.51, 0.016, 30), H, 0, -0.004, 0],
    [CY(0.258, 0.258, 0.045, 20, true), B, 0, 0.05, 0],
    ...[0.3, 1.9, 3.6, 5.1].map((a) => [RB(0.07, 0.012, 0.03, 0.004), '#d3b874', Math.sin(a) * 0.49, -0.006, Math.cos(a) * 0.49, 0, a, 0])]);
}
// 은색 긴 집게 (손 자리 기준: 손잡이가 원점, 자루가 -y, 앞이 +z). 턱 두 개는 따로 돌려 딸깍
function tongs() {
  const g = new THREE.Group(), grip = one([[CY(0.024, 0.024, 0.08, 10), '#5a5e66', 0, 0, 0], [CY(0.012, 0.012, 0.05, 8), '#c9ccd2', 0, -0.06, 0]]); g.add(grip);
  const jaw = (s) => { const p = new THREE.Group(); p.position.set(0, -0.07, 0); const m = one([[RB(0.012, 0.26, 0.012, 0.004), '#d4d7dc', 0, -0.13, s * 0.012], [RB(0.02, 0.03, 0.04, 0.006), '#c9ccd2', 0, -0.265, s * 0.022]]); p.add(m); g.add(p); return p; };
  g.userData.jaws = [jaw(1), jaw(-1)]; return g;
}
function notebook() { return one([[RB(0.13, 0.17, 0.018, 0.006), '#3d6a8c', 0, 0, 0], [RB(0.12, 0.16, 0.012, 0.004), '#f4efe0', 0, 0, 0.012], [CY(0.006, 0.006, 0.13, 6), '#c9ccd2', 0, 0.085, 0.004, 0, 0, Math.PI / 2],
  [CY(0.006, 0.006, 0.1, 6), '#e8b440', 0.08, -0.02, 0.02, 0.3, 0, 0.6]]); } // 수첩 + 볼펜
function flashlight() {
  const g = new THREE.Group(); g.add(one([[CY(0.022, 0.022, 0.12, 10), '#2f3236', 0, 0, 0, Math.PI / 2, 0, 0], [CY(0.032, 0.024, 0.04, 10), '#2f3236', 0, 0, 0.075, Math.PI / 2, 0, 0], [CY(0.008, 0.008, 0.03, 6), '#e2683c', 0, 0.025, -0.02]]));
  const lens = M(new THREE.CircleGeometry(0.028, 12), new THREE.MeshBasicMaterial({ color: '#fff6c8' }), 0, 0, 0.096); g.add(lens);
  const beam = M(new THREE.ConeGeometry(0.32, 1.4, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), 0, 0, 0.8);
  beam.rotation.x = -Math.PI / 2; g.add(beam); g.userData.beam = beam; return g;
}
// 흰 자루 (사건 2 종결 뒤, 흰 옷이 들던 것과 같은 꼴)
function sack() { return one([[SP(0.075, 12, 10), '#eeece4', 0, -0.07, 0, 0, 0, 0, 1, 1.15, 0.9], [CY(0.02, 0.035, 0.04, 8), '#e2e0d8', 0, 0.0, 0], [SP(0.025, 8, 6), '#d8d6ce', 0, 0.03, 0]]); }

/* ---------- 입히기 ---------- */
const HAND_R = [-0.43, 0.505, 0.045], HAND_L = [0.43, 0.505, 0.045], HC = [0, 0.8, 0.042];
function jointOf(bone) { const j = new THREE.Vector3(); for (let b = bone; b && b.isBone; b = b.parent) j.add(b.position); return j; }
function attach(bone, at, rz) { const p = new THREE.Group(); if (!bone) return p; const j = jointOf(bone); p.position.set(at[0] - j.x, at[1] - j.y, at[2] - j.z); p.rotation.z = rz; bone.add(p); return p; }
let J = null; // { g, run, hat, hatP, tongs, hip, book, light, sack, st }
function dress(g) {
  const run = g.runner, root = g.root, st = S(), o = DEFAULT_OUTFIT;
  run.apply({ ...o, shirt: { ...o.shirt, color: st.shirt }, pants: { ...o.pants, color: st.pants }, shoes: { ...o.shoes, color: st.boots }, gear: defineStyle(st) });
  if (J) [J.hatP, J.handR, J.handL, J.hip].forEach((x) => x.removeFromParent());
  const B = (n) => root.getObjectByName(n);
  const head = B('head'), chest = B('chest');
  const hatP = new THREE.Group(); if (head) { const j = jointOf(head); hatP.position.set(HC[0] - j.x, HC[1] - j.y, HC[2] - j.z); head.add(hatP); }
  const hatPiv = new THREE.Group(); hatPiv.position.set(0, 0, -0.2); hatP.add(hatPiv); const hat = hatMesh(st); hat.position.set(0, 0, 0.2); hatPiv.add(hat); hatPiv.rotation.x = -0.1; // 뒤로 살짝 젖혀 눈썹이 보이게
  const handR = attach(B('armR'), HAND_R, -Math.PI / 2), handL = attach(B('armL'), HAND_L, Math.PI / 2);
  const tg = tongs(); tg.rotation.x = -0.35; handR.add(tg);
  const book = notebook(); book.position.set(0, -0.04, 0.06); book.rotation.set(-1.2, 0, 0); handL.add(book);
  const light = flashlight(); light.position.set(0, -0.03, 0.03); handL.add(light);
  const hip = new THREE.Group(); if (chest) { const j = jointOf(chest); hip.position.set(-j.x, -j.y, -j.z); chest.add(hip); }
  const hipTongs = tongs(); hipTongs.position.set(0.21, 0.27, 0.06); hipTongs.rotation.set(0.1, 0, 0.08); hip.add(hipTongs); // 허리 고리에 건 집게 (적을 때)
  const sk = sack(); sk.position.set(-0.23, 0.22, -0.06); hip.add(sk);
  root.traverse((x) => { if (x.isMesh && !x.material.blending) x.castShadow = !LOW; });
  light.userData.beam.castShadow = false;
  g.h = D.markH || 3.3; g.mark.position.y = g.h; /* 넓은 모자 위로 표시를 올림 */
  J = { g, run, hat: hatPiv, hatP, handR, handL, hip, tongs: tg, hipTongs, book, light, sack: sk, st };
  vis(); return J;
}
function vis() { if (!J) return; J.book.visible = false; J.light.visible = false; J.hipTongs.visible = false; J.sack.visible = caseDone; }

/* ---------- 동작 ---------- */
// 서 있는 자세(runner 'move', 속도 0) 위에 무게만큼 섞음. 팔 x 음수 = 앞으로 듦, 오른팔 z 양수 = 안쪽, 왼팔은 z 음수가 안쪽
function jigiPose({ armL, armR, head, torso }, t, w) {
  const mix = (o, k, x, y, z) => { o.rotation.x += (x - o.rotation.x) * k; o.rotation.y += (y - o.rotation.y) * k; o.rotation.z += (z - o.rotation.z) * k; };
  const Sn = Math.sin;
  torso.rotation.x += 0.12; head.rotation.x -= 0.1; // 살짝 굽은 등 (흰 옷과 같은 실루엣)
  mix(armR, 0.6, -0.35, 0, 0.12); // 집게 든 오른손은 조금 앞으로
  if (w.look > 0.01) { head.rotation.y += Sn(t * 0.6) * 0.55 * w.look; torso.rotation.y += Sn(t * 0.6) * 0.08 * w.look; }
  if (w.back > 0.01) { mix(armL, w.back, 0.85 + Sn(t * 7) * 0.12, 0, -0.45); torso.rotation.x -= 0.22 * w.back; head.rotation.x -= 0.12 * w.back; head.rotation.z += Sn(t * 1.4) * 0.05 * w.back; }
  if (w.click > 0.01) { mix(armR, w.click, -0.95, 0, 0.3); head.rotation.x += 0.25 * w.click; head.rotation.y -= 0.25 * w.click; }
  if (w.hat > 0.01) { mix(armL, w.hat, -2.6, 0, -0.55); head.rotation.x += (0.02 + Math.max(0, Sn(t * 4)) * 0.08) * w.hat; torso.rotation.x += 0.08 * w.hat; }
  if (w.note > 0.01) { mix(armL, w.note, -1.05, 0, -0.5); mix(armR, w.note, -1.0 + Sn(t * 9) * 0.05, 0, 0.62 + Sn(t * 13) * 0.05); head.rotation.x += (0.32 + Sn(t * 0.8) * 0.18) * w.note; }
  if (w.light > 0.01 && w.note < 0.5 && w.hat < 0.5) mix(armL, w.light * 0.9, -0.75, 0, -0.15);
}
const A = D.acts || { gap: [3.5, 6.5], list: ['look', 'back', 'look', 'click'] };
const st = { t: 0, act: 'look', actT: 3, i: 0, w: { look: 0, back: 0, click: 0, hat: 0, note: 0, light: 0 }, force: null, night: null };
let caseDone = false, caseT = 0;
function anim(dt, d) {
  const g = J?.g; if (!g) return;
  st.t += dt; const W = st.w, f = st.force;
  if ((caseT -= dt) <= 0) { caseT = 3; const c = !!late.cases?.state?.('c2')?.closed; if (c !== caseDone) { caseDone = c; J.sack.visible = c; } }
  const talking = f === 'note' || (!f && late.questDebug?.win?.()?.who === 'jigi'), greet = f === 'hat' || (!f && g.pose === 'wave');
  const night = st.night ?? (f === 'night' || (sunState?.el ?? 30) < -4);
  if ((st.actT -= dt) <= 0) { st.i = (st.i + 1) % A.list.length; st.act = A.list[st.i]; st.actT = A.gap[0] + Math.random() * (A.gap[1] - A.gap[0]); }
  const act = f && f in W ? f : st.act, busy = talking || greet;
  const go = (k, on) => { W[k] += ((on ? 1 : 0) - W[k]) * Math.min(1, dt * 5); };
  go('note', talking); go('hat', greet && !talking); go('light', night);
  ['look', 'back', 'click'].forEach((k) => go(k, !busy && act === k));
  g.runner.animate(dt, { speed: 0, running: false, pose: 'move', t: st.t, air: false, jumpV: 0, post: (p) => jigiPose(p, st.t, W) });
  // 소품: 모자 들기, 집게 딸깍, 적을 땐 집게를 허리 고리에, 밤엔 손전등(적는 중엔 수첩)
  J.hat.position.y = W.hat * 0.01; J.hat.rotation.x = -0.1 + W.hat * 0.16; /* 챙 앞을 살짝 눌러 까딱 (들어 올리면 모자 밑 머리가 드러남) */
  const open = W.click * (Sn2(st.t * 5) > 0.3 ? 0.16 : 0.02) + 0.03; J.tongs.userData.jaws[0].rotation.x = open; J.tongs.userData.jaws[1].rotation.x = -open;
  const writing = W.note > 0.5; J.tongs.visible = !writing; J.hipTongs.visible = writing; J.book.visible = writing;
  J.light.visible = !writing && W.light > 0.5; J.light.userData.beam.visible = J.light.visible && !LOW;
}
const Sn2 = Math.sin;

/* ---------- 붙이기 ---------- */
const giver = () => late.questDebug?.givers?.get?.('jigi');
{ const g = giver(); if (g?.runner) { dress(g); g.anim = anim; } }
late.jigiApi = {
  get style() { return style; }, styles: Object.keys(STYLE),
  set: (k) => { if (!STYLE[k]) return false; style = k; const g = giver(); if (g?.runner) dress(g); return true; },
  test: (m = null) => { st.force = m === 'idle' ? null : m; st.night = m === 'night' ? true : m === 'idle' ? false : null; return m; },
  state: () => ({ style, act: st.act, w: Object.fromEntries(Object.entries(st.w).map(([k, v]) => [k, +v.toFixed(2)])), book: !!J?.book.visible, light: !!J?.light.visible, sack: !!J?.sack.visible, tongs: !!J?.tongs.visible }),
};
