// 장비(몸 말고 나머지) 교체 시스템
// - 캐릭터 = 몸 메시(runnermodel.js) + 뼈대 7개 + 칸(slot)마다 장비 하나
// - 장비 좌표는 모델 기본 자세(T포즈, 키 0.98) 기준. 머리 정수리 약 y 0.97, 얼굴 앞 z 약 0.26
// - 장비 종류
//   bone: 'head' 등 → 그 뼈에 붙는 단단한 물건 (모자·안경·배낭)
//   skin: true      → 몸과 같은 뼈대로 휘는 옷 (바지·소매처럼 관절을 지나는 것). 가중치는 몸과 같은 규칙으로 자동 계산
// - hide: 지금 몸 메시에 함께 구워진 부분 중 감출 곳 ('hat' 모자, 'pack' 배낭(어깨끈 빼고), 'top' 재킷, 'bottom' 반바지, 'shoes' 신발)
//   감춘 자리는 비어 보이므로 새 장비가 그 자리를 덮어야 한다. 몸만 있는 모델로 바꾸면 hide 없이 쓰면 된다
// - tint: 옷장 색(outfit[tint].color)을 따라갈 재질 이름
// - 새 디자인은 Tripo·블렌더에서 기본 자세에 맞춰 만든 glb 를 model/extract-gear.js 로 바꿔 data 로 넣는다
import * as THREE from 'three';
import { TEXCS } from './boot.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// 장비 데이터(model/extract-gear.js 로 만든 것) → build 함수. 텍스처가 있으면 그대로, 없으면 재질 기본색
const dec = (str, T) => { const bin = atob(str); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new T(u8.buffer); };
export const fromData = (D, def = '#ffffff') => (mat) => {
  const g = new THREE.BufferGeometry(); const nq = dec(D.nor, Int8Array), nor = new Float32Array(nq.length); for (let i = 0; i < nq.length; i++) nor[i] = nq[i] / 127;
  g.setAttribute('position', new THREE.BufferAttribute(dec(D.pos, Float32Array), 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (D.uv) g.setAttribute('uv', new THREE.BufferAttribute(dec(D.uv, Float32Array), 2)); g.setIndex(new THREE.BufferAttribute(dec(D.idx, D.idx16 ? Uint16Array : Uint32Array), 1));
  const m = mat('main', def); if (D.tex) { const t = new THREE.TextureLoader().load(D.tex); t.flipY = false; t.colorSpace = TEXCS; m.map = t; }
  return new THREE.Mesh(g, m);
};

export const SLOTS = { hat: '모자', face: '얼굴', back: '등', top: '상의', bottom: '하의', shoes: '신발', hand: '손' };

const M = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
const G = (...ms) => { const g = new THREE.Group(); ms.forEach((m) => g.add(m)); return g; };

// build(mat) → Object3D (기본 자세 좌표). mat(이름, 기본색) 으로 재질을 받는다
export const ACCESSORIES = {
  // ---- 모자 ----
  'hat:cap': { slot: 'hat', label: '스냅백', builtin: true },
  'hat:beanie': { slot: 'hat', label: '비니', bone: 'head', hide: ['hat'], tint: { main: 'hat' },
    build: (mat) => { const m = mat('main', '#c8553d');
      const top = M(new THREE.SphereGeometry(0.235, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 0.79, 0.02); top.scale.set(1.06, 0.9, 1.0);
      const band = M(new THREE.CylinderGeometry(0.255, 0.258, 0.075, 28, 1), m, 0, 0.785, 0.02); band.scale.z = 0.98;
      const pom = M(new THREE.SphereGeometry(0.055, 12, 10), mat('pom', '#f2efe6'), 0, 1.0, 0.02);
      return G(top, band, pom); } },
  'hat:bucket': { slot: 'hat', label: '버킷햇', bone: 'head', hide: ['hat'], tint: { main: 'hat' },
    build: (mat) => { const m = mat('main', '#d9c27a');
      const crown = M(new THREE.CylinderGeometry(0.2, 0.245, 0.2, 28, 1), m, 0, 0.88, 0.02);
      const lid = M(new THREE.SphereGeometry(0.2, 28, 8, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 0.975, 0.02); lid.scale.y = 0.25;
      const brim = M(new THREE.CylinderGeometry(0.255, 0.36, 0.05, 32, 1, true), m, 0, 0.77, 0.02); brim.material = m.clone(); brim.material.side = THREE.DoubleSide;
      return G(crown, lid, brim); } },

  // ---- 얼굴 ----
  'face:none': { slot: 'face', label: '없음', builtin: true },
  'face:sunglass': { slot: 'face', label: '선글라스', bone: 'head',
    build: (mat) => { const lens = mat('lens', '#22252b'), frame = mat('frame', '#22252b');
      const l = (sx) => { const g = M(new RoundedBoxGeometry(0.15, 0.1, 0.03, 3, 0.03), lens, sx * 0.095, 0.715, 0.27); g.rotation.y = sx * 0.28; return g; };
      return G(l(1), l(-1), M(new THREE.BoxGeometry(0.06, 0.018, 0.02), frame, 0, 0.73, 0.285)); } },

  // ---- 등 ----
  'back:pack': { slot: 'back', label: '배낭', builtin: true },
  'back:round': { slot: 'back', label: '둥근 배낭', bone: 'chest', hide: ['pack'], tint: { main: 'pack' },
    build: (mat) => { const m = mat('main', '#3e6b8a');
      const body = M(new THREE.SphereGeometry(0.22, 24, 18), m, 0, 0.43, -0.2); body.scale.set(1.05, 0.95, 0.62);
      const pocket = M(new THREE.SphereGeometry(0.12, 18, 12), mat('pocket', '#f2c94c'), 0, 0.38, -0.31); pocket.scale.set(1.1, 0.9, 0.5);
      return G(body, pocket); } },

  // ---- 하의 (몸과 같이 휘는 옷 예시) ----
  'bottom:shorts': { slot: 'bottom', label: '반바지', builtin: true },
  'bottom:long': { slot: 'bottom', label: '긴바지', skin: true, hide: ['bottom'], tint: { main: 'pants' },
    build: (mat) => { const m = mat('main', '#4a5a78');
      const hip = M(new THREE.SphereGeometry(0.2, 24, 14), m, 0, 0.215, 0.035); hip.scale.set(1.0, 0.42, 0.82);
      const leg = (sx) => M(new THREE.CylinderGeometry(0.068, 0.06, 0.2, 16, 6), m, sx * 0.1, 0.13, 0.035);
      return G(hip, leg(1), leg(-1)); } },
};

// ---- 장비 단계(상점 #10): 손 도구·배낭·신발. 단계 수치는 balance.js, 여기는 모양만 ----
// 손 도구: 오른손(armR 뼈, 기본 자세에서 -x 쪽으로 뻗은 팔 끝)에 쥠. 만들 때는 손잡이가 원점, 자루가 -Y(아래), 도구 앞이 +Z
const HAND = [-0.43, 0.505, 0.045];
const held = (tilt, ...ms) => { const inner = G(...ms); inner.rotation.x = -tilt; const outer = new THREE.Group(); outer.add(inner); outer.rotation.z = -Math.PI / 2; outer.position.set(...HAND); return outer; };
const CY = (r1, r2, h, mat, x, y, z, seg = 7) => M(new THREE.CylinderGeometry(r1, r2, h, seg), mat, x, y, z);
const tines = (mat, n, w, y, len) => { const out = []; for (let i = 0; i < n; i++) { const x = -w / 2 + (w * i) / (n - 1); const t = M(new THREE.BoxGeometry(0.008, len, 0.008), mat, x, y - len / 2 + 0.004, 0.012); t.rotation.x = 0.5; out.push(t); } return out; };
Object.assign(ACCESSORIES, {
  'hand:none': { slot: 'hand', label: '맨손', builtin: true },
  'hand:tongs': { slot: 'hand', label: '집게', bone: 'armR',
    build: (mat) => { const metal = mat('metal', '#c9ccd2'), grip = mat('grip', '#3f9a5a');
      const arm = (s) => { const a = M(new THREE.BoxGeometry(0.01, 0.19, 0.012), metal, 0, -0.095, s * 0.012); a.rotation.x = s * 0.06; return a; };
      return held(0.35, CY(0.022, 0.022, 0.07, grip, 0, 0, 0), arm(1), arm(-1), M(new THREE.BoxGeometry(0.018, 0.02, 0.05), grip, 0, -0.19, 0)); } },
  'hand:rake': { slot: 'hand', label: '갈퀴', bone: 'armR',
    build: (mat) => { const wood = mat('wood', '#b08350'), head = mat('head', '#e2683c');
      return held(0.45, CY(0.011, 0.011, 0.28, wood, 0, -0.1, 0), M(new THREE.BoxGeometry(0.13, 0.02, 0.022), head, 0, -0.24, 0.004), ...tines(head, 5, 0.12, -0.245, 0.05)); } },
  'hand:bigrake': { slot: 'hand', label: '큰 갈퀴', bone: 'armR',
    build: (mat) => { const wood = mat('wood', '#8a6a3c'), head = mat('head', '#3f9a5a');
      return held(0.5, CY(0.012, 0.012, 0.32, wood, 0, -0.12, 0), M(new THREE.BoxGeometry(0.2, 0.022, 0.024), head, 0, -0.27, 0.004), ...tines(head, 7, 0.22, -0.275, 0.06)); } },
  'hand:vacuum': { slot: 'hand', label: '흡입기', bone: 'armR',
    build: (mat) => { const body = mat('body', '#f2c94c'), tube = mat('tube', '#5a6068'), dark = mat('dark', '#2b2f33');
      const motor = M(new RoundedBoxGeometry(0.07, 0.09, 0.09, 2, 0.02), body, 0, 0.0, -0.045);
      const nozzle = M(new THREE.CylinderGeometry(0.045, 0.026, 0.05, 8), dark, 0, -0.27, 0); nozzle.scale.z = 0.5;
      return held(0.4, motor, CY(0.02, 0.02, 0.07, dark, 0, 0.01, 0.0), CY(0.017, 0.017, 0.22, tube, 0, -0.14, 0), nozzle); } },
  'back:bag2': { slot: 'back', label: '작은 배낭', bone: 'chest', hide: ['pack'],
    build: (mat) => { const m = mat('main', '#3e6b8a'), p = mat('pocket', '#f2c94c');
      return G(M(new RoundedBoxGeometry(0.3, 0.3, 0.14, 3, 0.05), m, 0, 0.43, -0.16), M(new RoundedBoxGeometry(0.18, 0.11, 0.05, 2, 0.02), p, 0, 0.36, -0.235)); } },
  'back:bag3': { slot: 'back', label: '배낭', bone: 'chest', hide: ['pack'],
    build: (mat) => { const m = mat('main', '#3f9a5a'), f = mat('flap', '#2f7d5b'), p = mat('pocket', '#e8d9b5');
      return G(M(new RoundedBoxGeometry(0.34, 0.37, 0.17, 3, 0.06), m, 0, 0.44, -0.175), M(new RoundedBoxGeometry(0.35, 0.1, 0.18, 2, 0.04), f, 0, 0.6, -0.18), M(new RoundedBoxGeometry(0.2, 0.13, 0.05, 2, 0.02), p, 0, 0.36, -0.265)); } },
  'back:bag4': { slot: 'back', label: '큰 배낭', bone: 'chest', hide: ['pack'],
    build: (mat) => { const m = mat('main', '#e2683c'), r = mat('roll', '#3e6b8a'), p = mat('pocket', '#2b2f33');
      const roll = M(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 10), r, 0, 0.72, -0.2); roll.rotation.z = Math.PI / 2;
      return G(M(new RoundedBoxGeometry(0.38, 0.46, 0.2, 3, 0.07), m, 0, 0.45, -0.19), roll, M(new RoundedBoxGeometry(0.22, 0.16, 0.05, 2, 0.02), p, 0, 0.34, -0.295)); } },
  'back:bag5': { slot: 'back', label: '원정 배낭', bone: 'chest', hide: ['pack'],
    build: (mat) => { const m = mat('main', '#c9473d'), fr = mat('frame', '#c9ccd2'), r = mat('roll', '#f2c94c'), net = mat('net', '#3f9a5a');
      const roll = M(new THREE.CylinderGeometry(0.075, 0.075, 0.48, 10), r, 0, 0.87, -0.22); roll.rotation.z = Math.PI / 2;
      const bar = (sx) => M(new THREE.BoxGeometry(0.02, 0.66, 0.02), fr, sx * 0.23, 0.5, -0.12);
      const bag = M(new THREE.SphereGeometry(0.15, 8, 6), net, 0, 0.27, -0.34); bag.scale.set(1.2, 0.8, 0.7);
      return G(M(new RoundedBoxGeometry(0.44, 0.58, 0.24, 3, 0.08), m, 0, 0.5, -0.21), bar(1), bar(-1), roll, bag); } },
  'shoes:s1': { slot: 'shoes', label: '운동화', builtin: true },
  // 배낭 없음(#31, 처음엔 호주머니만): 몸에 구운 배낭·어깨끈을 감추고, 비는 등 쪽을 재킷 색 덩어리로 메움
  'back:none': { slot: 'back', label: '배낭 없음', bone: 'chest', hide: ['pack', 'straps'], tint: { main: 'shirt' }, npc: true,
    build: (mat) => { const m = mat('main', '#dccfac'); const b = M(new THREE.SphereGeometry(0.2, 20, 14), m, 0, 0.44, -0.035); b.scale.set(1.0, 0.95, 0.5); return G(b); } },
  // 낚시 NPC 밀짚모자 (#31)
  'hat:straw': { slot: 'hat', label: '밀짚모자', bone: 'head', hide: ['hat'], npc: true,
    build: (mat) => { const m = mat('main', '#e3c77d'), band = mat('band', '#b5482f');
      const crown = M(new THREE.CylinderGeometry(0.19, 0.23, 0.17, 18, 1), m, 0, 0.88, 0.02);
      const brim = M(new THREE.CylinderGeometry(0.42, 0.44, 0.025, 24, 1), m, 0, 0.8, 0.02);
      return G(crown, brim, M(new THREE.CylinderGeometry(0.232, 0.232, 0.04, 18, 1, true), band, 0, 0.82, 0.02)); } },
});
// 신발 2~5단계: 발을 덮는 한 켤레 (몸과 같은 뼈대로 휨). 단계마다 모양·색이 다름. 윗부분은 옷장 신발 색을 따라감
const FOOT = { x: 0.106, z: 0.076, w: 0.14, d: 0.24 };
const shoePair = (mat, { up, sole, acc, h, soleH, boot = 0, toe = 0 }) => () => {
  const U = mat('main', up), S = mat('sole', sole), A = mat('acc', acc), out = [];
  for (const sx of [1, -1]) {
    const x = sx * FOOT.x;
    out.push(M(new RoundedBoxGeometry(FOOT.w, soleH, FOOT.d + 0.01, 2, soleH * 0.45), S, x, soleH / 2, FOOT.z + 0.004));
    out.push(M(new RoundedBoxGeometry(FOOT.w - 0.006, h, FOOT.d - 0.02, 3, Math.min(0.045, h * 0.45)), U, x, soleH + h / 2 - 0.01, FOOT.z));
    out.push(M(new THREE.BoxGeometry(FOOT.w + 0.004, 0.018, FOOT.d * 0.5), A, x, soleH + h * 0.45, FOOT.z + 0.02));
    if (boot) out.push(M(new RoundedBoxGeometry(FOOT.w - 0.01, boot, 0.13, 2, 0.04), U, x, soleH + h + boot / 2 - 0.03, FOOT.z - 0.045));
    if (toe) out.push(M(new RoundedBoxGeometry(FOOT.w - 0.004, 0.05, 0.05, 2, 0.02), A, x, soleH + 0.022, FOOT.z + FOOT.d / 2 - 0.022));
  }
  return G(...out);
};
const SHOE_LOOK = {
  's2': { label: '러닝화', up: '#f2f2f2', sole: '#2f6db5', acc: '#2f6db5', h: 0.075, soleH: 0.035 },
  's3': { label: '트레일화', up: '#e2683c', sole: '#2b2b33', acc: '#f2c94c', h: 0.075, soleH: 0.05, toe: 1 },
  's4': { label: '등산화', up: '#8a6a3c', sole: '#2b2b33', acc: '#c9473d', h: 0.08, soleH: 0.05, boot: 0.07, toe: 1 },
  's5': { label: '바람 신발', up: '#7fd3c8', sole: '#f2f2f2', acc: '#ffd23f', h: 0.08, soleH: 0.065, boot: 0.04 },
};
Object.entries(SHOE_LOOK).forEach(([k, L]) => { ACCESSORIES['shoes:' + k] = { slot: 'shoes', label: L.label, skin: true, hide: ['shoes'], tint: { main: 'shoes' }, build: (mat) => shoePair(mat, L)() }; });
// 장비 단계 → 캐릭터에 보이는 장비
export const TOOL_GEAR = ['hand:none', 'hand:tongs', 'hand:rake', 'hand:bigrake', 'hand:vacuum'];
export const BAG_GEAR = ['back:pack', 'back:bag2', 'back:bag3', 'back:bag4', 'back:bag5'];
export const SHOE_GEAR = ['shoes:s1', 'shoes:s2', 'shoes:s3', 'shoes:s4', 'shoes:s5'];
export const equipGear = (eq) => ({ hand: TOOL_GEAR[(eq?.tool || 1) - 1] || TOOL_GEAR[0], back: eq?.bag === 0 ? 'back:none' : BAG_GEAR[(eq?.bag || 1) - 1] || BAG_GEAR[0], shoes: SHOE_GEAR[(eq?.shoes || 1) - 1] || SHOE_GEAR[0] });

// 칸별 장비 목록 (옷장용)
export const gearList = (slot) => Object.entries(ACCESSORIES).filter(([, a]) => a.slot === slot && !a.npc).map(([k]) => k);
export const DEFAULT_GEAR = { hat: 'hat:cap', face: 'face:none', back: 'back:pack', bottom: 'bottom:shorts', shoes: 'shoes:s1', hand: 'hand:none' };
// 네트워크로 받은 값 검사
export const cleanGear = (g) => { const out = {}; if (g && typeof g === 'object') Object.entries(g).forEach(([slot, k]) => { if (SLOTS[slot] && ACCESSORIES[k]?.slot === slot) out[slot] = k; }); return out; };
