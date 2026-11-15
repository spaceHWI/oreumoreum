import * as THREE from 'three';
import { NSMODE, TEXCS } from './boot.js';
import { gradHard } from './toon.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RM } from './runnermodel.js';
import { patchDQS } from './dqskin.js';
import { ACCESSORIES, DEFAULT_GEAR } from './gear.js';

// 가격 0 = 기본 제공. 상점에서 귤로 구매
// 기본 캐릭터는 모델(모자 뒤로 쓴 아이)이라 지금은 색만 바꿀 수 있음. 가격 0 = 기본 제공
export const OUTFIT_OPTIONS = {
  hat: { label: '모자', types: null, colors: [['#5c9a3c', 0], ['#2b2b33', 0], ['#e9e4d6', 0], ['#e2683c', 15], ['#2f6db5', 15], ['#3e8f5a', 15], ['#f2c94c', 20], ['#e9719a', 25], ['#8f7bd6', 25], ['#ff8a3d', -1], ['#5e5a54', -1]] },
  shirt: { label: '재킷', types: null, colors: [['#e8d9b5', 0], ['#e9e4d6', 0], ['#2f6db5', 10], ['#e2683c', 10], ['#3e8f5a', 10], ['#f2c94c', 10], ['#2b2b33', 10], ['#e9719a', 20], ['#8f7bd6', 20], ['#7fb8e8', 20], ['#f2a46b', -1]] },
  pants: { label: '바지', types: null, colors: [['#8a6a3c', 0], ['#2b2b33', 0], ['#4a5a78', 10], ['#7a6a55', 10], ['#3e6b4a', 10], ['#e2683c', 20], ['#e9719a', 20]] },
  shoes: { label: '신발', types: null, colors: [['#26262b', 0], ['#f2f2f2', 0], ['#e2683c', 0], ['#2f6db5', 10], ['#2b2b33', 10], ['#c4e04a', 20], ['#e9719a', 25], ['#ffd23f', -1]] },
};
export const itemKey = (part, kind, v) => `${part}:${kind}:${v}`;
export function itemPrice(part, kind, v) {
  const opt = OUTFIT_OPTIONS[part];
  const list = kind === 't' ? opt.types : opt.colors;
  const hit = (list || []).find((e) => e[0] === v);
  return hit ? hit[kind === 't' ? 2 : 1] : 0;
}

export const DEFAULT_OUTFIT = {
  hair: { type: 'bun', color: '#2a221c' },
  skin: { color: '#ffdcbf' },
  hat: { type: 'none', color: '#5c9a3c', back: true },
  glasses: { type: 'none' },
  vest: { type: 'none', color: '#e2683c' },
  shirt: { type: 'tee', color: '#e8d9b5' },
  pants: { type: 'shorts', color: '#8a6a3c' },
  shoes: { type: 'road', color: '#26262b' },
};

const SKIN = '#ffdcbf';
// 부드러운 3단 툰 음영 + 둥근 모서리: 말랑한 인형 느낌
const GRAD = (() => { const d = new Uint8Array([172, 172, 172, 255, 218, 218, 218, 255, 242, 242, 242, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t; })();
const lam = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: GRAD });
const geoCache = new Map();
const cap = (r, len, mat) => { const k = `c${r},${len}`; let g = geoCache.get(k); if (!g) { g = new THREE.CapsuleGeometry(r, len, 6, 14); geoCache.set(k, g); } return new THREE.Mesh(g, mat); };
const ball = (r, mat, sx = 1, sy = 1, sz = 1) => { const k = `s${r}`; let g = geoCache.get(k); if (!g) { g = new THREE.SphereGeometry(r, 18, 14); geoCache.set(k, g); } const m = new THREE.Mesh(g, mat); m.scale.set(sx, sy, sz); return m; };
const box = (w, h, d, mat) => { const k = `${w},${h},${d}`; let g = geoCache.get(k); if (!g) { g = new RoundedBoxGeometry(w, h, d, 3, Math.min(w, h, d) * 0.46); geoCache.set(k, g); } return new THREE.Mesh(g, mat); };

// ---------- 기본 캐릭터 모델: 한 덩어리 메시에 위치 기준으로 뼈대 가중치를 직접 계산 ----------
const b64 = (str, T) => { const bin = atob(str); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new T(u8.buffer); };
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const MODEL_S = 2.5; // 모델 키 0.98 → 게임 키 약 2.45
const P = RM.P; // 모델별 치수 (model/params.json)
// 팔 관절은 소매 중심선(armY·armZ) 위, 몸통 옆면보다 조금 안쪽(pivotX)에 둬서 팔을 내려도 어깨 위가 덜 늘어나게
const AZ = P.armZ ?? 0, LZ = P.legZ ?? 0, PX = P.pivotX ?? P.shoulderX;
const JOINT = { hips: [0, P.hipY, 0], chest: [0, P.hipY + 0.01, 0], head: [0, P.neckY, 0], armL: [PX, P.armY, AZ], armR: [-PX, P.armY, AZ], legL: [P.legX, P.hipY - 0.01, LZ], legR: [-P.legX, P.hipY - 0.01, LZ] };
const BONE_ORDER = ['hips', 'chest', 'head', 'armL', 'armR', 'legL', 'legR'];
// 기본 자세 좌표 → 뼈 가중치 (몸 메시와 '휘는 옷' 장비가 같이 씀)
export function skinWeights(pos) {
  const n = pos.length / 3, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], ax = Math.abs(x);
    const w = [0, 0, 0, 0, 0, 0, 0];
    // 팔: 소매 중심선에서 가까운 정점만 (몸통 옆면 아래·위는 팔을 따라가지 않게). 몸통 옆면(shoulderX) 바로 안쪽에서 바깥까지 짧게 넘어감
    const rr = Math.hypot((y - P.armY) / (P.armR ?? 0.075), (z - AZ) / (P.armR ?? 0.075));
    const gate = ax > P.handX ? (y > P.armLo && y < P.armHi ? 1 : 0) : 1 - sstep(1.05, 1.6, rr);
    const wArm = gate * sstep(PX - 0.01, P.shoulderX + 0.012, ax);
    const wHead = sstep(P.neckY - 0.02, P.neckY + 0.01, y) * (1 - wArm);
    const wLeg = (1 - sstep(P.hipY - 0.05, P.hipY + 0.02, y));
    const side = sstep(-0.015, 0.015, x);
    w[x > 0 ? 3 : 4] = wArm; w[2] = wHead; w[5] = wLeg * side; w[6] = wLeg * (1 - side);
    const rest = Math.max(0, 1 - wArm - wHead - wLeg); const c = sstep(P.hipY - 0.02, P.hipY + 0.06, y); w[1] = rest * c; w[0] = rest * (1 - c);
    const order = [0, 1, 2, 3, 4, 5, 6].sort((a, b) => w[b] - w[a]).slice(0, 4); let sum = 0; order.forEach((k) => { sum += w[k]; });
    order.forEach((k, j) => { si[v * 4 + j] = k; sw[v * 4 + j] = w[k] / (sum || 1); });
  }
  return { si, sw };
}
let modelGeo = null, modelTex = null;
function getModelGeo() {
  if (modelGeo) return modelGeo;
  const pos = b64(RM.pos, Float32Array), nq = b64(RM.nor, Int8Array), uv = b64(RM.uv, Float32Array), idx = b64(RM.idx, RM.idx16 ? Uint16Array : Uint32Array);
  const nor = new Float32Array(nq.length); for (let i = 0; i < nq.length; i++) nor[i] = nq[i] / 127;
  const { si, sw } = skinWeights(pos);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  modelTex = new THREE.TextureLoader().load(RM.tex); modelTex.colorSpace = TEXCS; modelTex.flipY = false;
  return (modelGeo = g);
}
const MODEL_DEFAULT = { hat: '#5c9a3c', shirt: '#e8d9b5', pants: '#8a6a3c', shoes: '#26262b' };
function buildModel() {
  const geo = getModelGeo();
  const U = { cHat: { value: new THREE.Color() }, cShirt: { value: new THREE.Color() }, cPants: { value: new THREE.Color() }, cShoes: { value: new THREE.Color() }, on: { value: new THREE.Vector4(0, 0, 0, 0) }, hide: { value: new THREE.Vector4(0, 0, 0, 0) }, hidePack: { value: 0 } };
  // 남송이오름(새 그림체)에서는 3단 툰 명암
  const mat = NSMODE ? new THREE.MeshToonMaterial({ map: modelTex, gradientMap: gradHard, emissive: '#ffffff', emissiveIntensity: 0.16 }) : new THREE.MeshLambertMaterial({ map: modelTex, color: '#e4e4e4', emissive: '#ffffff', emissiveIntensity: 0.32 });
  // 텍스처 색과 부위(기본 자세 위치)로 모자·상의·바지·신발을 가려 옷 색을 바꿈
  mat.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, U); patchDQS(sh);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest; uniform vec3 cHat, cShirt, cPants, cShoes; uniform vec4 on, hide; uniform float hidePack;\nvec3 rgb2hsv(vec3 c){ vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0); vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g)); vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r)); float d = q.x - min(q.w, q.y); return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x); }')
      .replace('#include <map_fragment>', `#include <map_fragment>
      { vec3 h = rgb2hsv(${NSMODE ? 'diffuseColor.rgb' : 'pow(diffuseColor.rgb, vec3(1.0 / 2.2))'}); float y = vRest.y; float ax = abs(vRest.x);
        float green = smoothstep(0.2, 0.24, h.x) * (1.0 - smoothstep(0.42, 0.46, h.x)) * smoothstep(0.25, 0.4, h.y);
        float cream = smoothstep(0.07, 0.1, h.x) * (1.0 - smoothstep(0.17, 0.2, h.x)) * (1.0 - smoothstep(0.38, 0.46, h.y)) * smoothstep(0.55, 0.68, h.z);
        float olive = smoothstep(0.05, 0.08, h.x) * (1.0 - smoothstep(0.16, 0.2, h.x)) * smoothstep(0.35, 0.45, h.y) * (1.0 - smoothstep(0.6, 0.7, h.z));
        { float dark = (1.0 - smoothstep(0.22, 0.34, h.z)) * smoothstep(0.57, 0.6, y); float l = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(l) * 0.75, dark); } // 머리카락·눈은 무채색 검정으로
        float rHat = green * smoothstep(0.56, 0.6, y);
        float rShirt = cream * smoothstep(0.23, 0.26, y) * (1.0 - smoothstep(0.585, 0.605, y));
        float rPants = olive * smoothstep(0.15, 0.17, y) * (1.0 - smoothstep(0.27, 0.29, y)) * (1.0 - smoothstep(0.21, 0.24, ax)) * step(-0.2, vRest.z);
        float rShoes = (1.0 - smoothstep(0.25, 0.4, h.z)) * (1.0 - smoothstep(0.09, 0.105, y));
        float rPack = smoothstep(0.04, 0.06, h.x) * (1.0 - smoothstep(0.12, 0.14, h.x)) * smoothstep(0.34, 0.4, h.y) * smoothstep(0.4, 0.46, h.z) * step(0.26, y) * step(y, 0.62) * step(ax, 0.28) * step(vRest.z, -0.09);
        // 장비로 바꾼 부분은 감춤 (새 장비가 덮음)
        if (max(max(rHat * hide.x, rShirt * hide.y), max(max(rPants * hide.z, rShoes * hide.w), rPack * hidePack)) > 0.5) discard;
        float mHat = rHat * on.x, mShirt = rShirt * on.y, mPants = rPants * on.z, mShoes = rShoes * on.w;
        diffuseColor.rgb = mix(diffuseColor.rgb, cHat * min(h.z / 0.66, 1.3), mHat);
        diffuseColor.rgb = mix(diffuseColor.rgb, cShirt * min(h.z / 0.92, 1.1), mShirt);
        diffuseColor.rgb = mix(diffuseColor.rgb, cPants * min(h.z / 0.52, 1.4), mPants);
        diffuseColor.rgb = mix(diffuseColor.rgb, cShoes * min(0.6 + h.z / 0.3, 1.5), mShoes); }`)
      .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance *= diffuseColor.rgb / max(diffuse, vec3(0.001));'); };
  const bones = {}; BONE_ORDER.forEach((k) => { bones[k] = new THREE.Bone(); bones[k].name = k; });
  const rel = (k, parent) => { const a = JOINT[k], b = parent ? JOINT[parent] : [0, 0, 0]; bones[k].position.set(a[0] - b[0], a[1] - b[1], a[2] - b[2]); if (parent) bones[parent].add(bones[k]); };
  rel('hips'); rel('chest', 'hips'); rel('head', 'chest'); rel('armL', 'chest'); rel('armR', 'chest'); rel('legL', 'hips'); rel('legR', 'hips');
  const mesh = new THREE.SkinnedMesh(geo, mat); mesh.add(bones.hips); mesh.bind(new THREE.Skeleton(BONE_ORDER.map((k) => bones[k])));
  mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = false;
  mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }); mesh.customDepthMaterial.onBeforeCompile = patchDQS; // 그림자도 같은 방식으로 굽힘
  const holder = new THREE.Group(); holder.scale.setScalar(MODEL_S); holder.add(mesh);
  // 장비: 칸마다 하나. 뼈에 붙이거나(단단한 것) 같은 뼈대로 휘게(옷) 붙임
  const worn = {}; // slot → { key, obj, mats }
  const gearMat = (tintCol) => (name, def) => { const m = NSMODE ? new THREE.MeshToonMaterial({ color: def, gradientMap: gradHard }) : new THREE.MeshLambertMaterial({ color: def });
    m.userData.def = def; m.userData.name = name; return m; };
  function wear(slot, key) {
    const cur = worn[slot]; if (cur?.key === key) return; if (cur?.obj) { cur.obj.removeFromParent(); cur.obj.traverse((o) => { if (o.isMesh) { o.material.dispose?.(); } }); }
    const a = ACCESSORIES[key]; worn[slot] = { key, obj: null, mats: [] };
    if (a && !a.builtin && a.build) {
      const mats = []; const mk = gearMat(); const src = a.build((n, d) => { const m = mk(n, d); mats.push(m); return m; });
      src.updateMatrixWorld(true);
      let obj;
      if (a.skin) { // 기본 자세 좌표로 합쳐 정점마다 가중치를 붙임
        obj = new THREE.Group();
        src.traverse((o) => { if (!o.isMesh) return; const g = o.geometry.clone().applyMatrix4(o.matrixWorld); const { si, sw } = skinWeights(g.attributes.position.array);
          g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
          o.material.onBeforeCompile = patchDQS; const sm = new THREE.SkinnedMesh(g, o.material); sm.bind(mesh.skeleton, mesh.bindMatrix); sm.frustumCulled = false; obj.add(sm); });
        holder.add(obj);
      } else { obj = src; const j = JOINT[a.bone || 'chest']; obj.position.sub(new THREE.Vector3(...j)); bones[a.bone || 'chest'].add(obj); }
      obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
      worn[slot].obj = obj; worn[slot].mats = mats;
    }
    // 감출 부분 다시 계산
    const hid = new Set(); Object.values(worn).forEach((w) => (ACCESSORIES[w.key]?.hide || []).forEach((h) => hid.add(h)));
    U.hide.value.set(+hid.has('hat'), +hid.has('top'), +hid.has('bottom'), +hid.has('shoes')); U.hidePack.value = +hid.has('pack');
  }
  const TINT = { hat: 'hat', pants: 'pants', shirt: 'shirt', shoes: 'shoes' };
  const set = (of) => { const pick = (k, u, i) => { const c = of[k]?.color || MODEL_DEFAULT[k]; U[u].value.set(c); U.on.value.setComponent(i, c.toLowerCase() === MODEL_DEFAULT[k] ? 0 : 1); }; pick('hat', 'cHat', 0); pick('shirt', 'cShirt', 1); pick('pants', 'cPants', 2); pick('shoes', 'cShoes', 3);
    const g = { ...DEFAULT_GEAR, ...(of.gear || {}) }; Object.entries(g).forEach(([slot, key]) => wear(slot, key));
    // 장비 색: tint 로 묶인 재질은 옷장 색을 따름 (기본색이면 장비 자체 색)
    Object.values(worn).forEach((w) => { const t = ACCESSORIES[w.key]?.tint || {}; w.mats.forEach((m) => { const part = TINT[t[m.userData.name]]; const c = part && of[part]?.color; m.color.set(c && c.toLowerCase() !== MODEL_DEFAULT[part] ? c : m.userData.def); m.emissive.copy(m.color).multiplyScalar(NSMODE ? 0.16 : 0.32); }); }); };
  return { holder, mesh, mat, bones, set, wear };
}
const qTmp = new THREE.Quaternion(), eTmp = new THREE.Euler();
const LEG_M = (P.hipY - 0.01) * MODEL_S; // 모델 다리 길이(골반 관절 → 발바닥)
const ARM_OUT = 0.42; // 팔을 완전히 내리지 않고 살짝 벌려 두면 어깨가 덜 구겨짐
const Q_ARM_L = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2 + ARM_OUT)), Q_ARM_R = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2 - ARM_OUT));

// opts: { skin, hair: 'short'|'bob'|'perm'|'bald', hairColor, beard, kind, tattoo, turtle, book, scaleW, scaleH }
export function buildRunner(opts = {}) {
  const root = new THREE.Group();
  const SKIN_C = opts.skin || SKIN;
  const body = new THREE.Group(); // 앉기·숙이기용
  root.add(body);
  const mats = {
    skin: lam(SKIN_C), hairMat: lam(opts.hairColor || '#2a221c'), shirt: lam('#fff'), pants: lam('#000'), shoes: lam('#000'), vest: lam('#000'), hat: lam('#000'),
    sole: lam('#f2efe6'), black: lam('#1c1c22'), mirror: new THREE.MeshStandardMaterial({ color: '#4fb3e8', emissive: '#1d5f88', roughness: 0.2, metalness: 0.6 }),
    cheek: new THREE.MeshBasicMaterial({ color: '#ff9f9a', transparent: true, opacity: 0.7 }), bottle: lam('#bfe3f2'), lug: lam('#2a2a2e'),
  };
  const HIP = 0.78;
  const hips = new THREE.Group(); hips.position.y = HIP; body.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  const chest = new THREE.Group(); chest.position.y = 0.3; torso.add(chest); { const c = cap(0.3, 0.16, mats.shirt); c.scale.set(1.08, 1, 0.84); chest.add(c); }
  const vest = new THREE.Group(); torso.add(vest);
  const vb = cap(0.31, 0.06, mats.vest); vb.scale.set(1.12, 0.78, 0.94); vb.position.y = 0.36; vest.add(vb);
  [-0.17, 0.17].forEach((x) => { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.12, 4, 10), mats.bottle); b.position.set(x, 0.42, 0.27); vest.add(b); });

  const head = new THREE.Group(); head.position.y = 0.6 + 0.49; head.scale.setScalar(opts.headScale || 1.3); torso.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.5, 28, 22), mats.skin); skull.scale.set(1.06, 0.96, 1); head.add(skull);
  [-1, 1].forEach((sx) => { const ear = ball(0.09, mats.skin); ear.position.set(sx * 0.52, -0.03, 0); head.add(ear); });
  const hairStyle = opts.hair || 'base';
  const bases = {};
  const hair = new THREE.Group(); head.add(hair);
  if (hairStyle === 'base') { // 똥머리 계열 기본형: 둥근 머리 캡 + 앞머리, 묶음 모양만 바뀜
    const hm = mats.hairMat; const sph = (r, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), hm); m.position.set(x, y, z); m.scale.set(sx, sy, sz); return m; };
    const hc = new THREE.Mesh(new THREE.SphereGeometry(0.52, 28, 20, 0, Math.PI * 2, 0, 1.6), hm); hc.scale.set(1.09, 1.02, 1.05); hc.position.set(0, 0.03, -0.03); hair.add(hc);
    [-1, 1].forEach((sx) => hair.add(sph(0.155, sx * 0.2, 0.31, 0.38, 1, 0.75, 0.7)));
    const G = (k, ...ms) => { const g = new THREE.Group(); ms.forEach((m) => g.add(m)); bases[k] = g; hair.add(g); };
    G('bun', sph(0.18, 0, 0.56, -0.1));
    G('twin', sph(0.16, -0.36, 0.46, -0.08), sph(0.16, 0.36, 0.46, -0.08));
    G('low', sph(0.18, 0, -0.08, -0.56));
    G('half', sph(0.13, 0, 0.56, -0.1), sph(0.5, 0, -0.16, -0.15, 1.08, 1.1, 0.9));
    G('top', sph(0.09, 0, 0.6, -0.06, 0.9, 1.7, 0.9), sph(0.05, 0, 0.53, -0.06, 2.0, 0.7, 2.0));
  }
  else if (hairStyle === 'short') { // 자연스러운 짧은 머리: 둥근 캡 + 앞머리 가닥 + 귀 옆 구레나룻
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.545, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.56), mats.hairMat); cap.position.set(0, 0.02, -0.03); hair.add(cap);
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.53, 20, 14, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.22), mats.hairMat); back.position.set(0, 0.0, -0.1); hair.add(back);
    [[-0.3, 0.3, 0.37, 0.13], [-0.12, 0.34, 0.41, 0.14], [0.08, 0.35, 0.41, 0.145], [0.27, 0.31, 0.37, 0.13], [0.4, 0.24, 0.3, 0.11], [-0.4, 0.25, 0.3, 0.11]].forEach(([x, y, z, r]) => { const f = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mats.hairMat); f.position.set(x, y, z); f.scale.set(1, 0.85, 0.8); hair.add(f); });
    [-1, 1].forEach((sx) => { const sb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), mats.hairMat); sb.position.set(sx * 0.46, 0.02, 0.1); sb.scale.set(0.6, 1.3, 0.9); hair.add(sb); });
  }
  else if (hairStyle === 'bob') { // 단발: 귀 아래까지 내려오는 둥근 머리
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.56, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), mats.hairMat); h.position.set(0, 0.08, -0.03); hair.add(h);
    const fringe = box(0.72, 0.16, 0.2, mats.hairMat); fringe.position.set(0, 0.3, 0.42); hair.add(fringe); }
  else if (hairStyle === 'perm') { // 파마: 작은 곱슬 덩어리들
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; const r = 0.42 + (i % 2) * 0.08; const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17 + (i % 3) * 0.03, 0), mats.hairMat); c.position.set(Math.cos(a) * r, 0.25 + Math.sin(i * 1.7) * 0.12, Math.sin(a) * r * 0.85 - 0.05); hair.add(c); }
    for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.19, 0), mats.hairMat); c.position.set((i - 2.5) * 0.17, 0.48, (i % 2) * 0.12 - 0.1); hair.add(c); } }
  // bald: 머리카락 없음
  if (opts.turtle) { // 거북이: 초록 피부·등딱지·둥근 안경·책
    mats.skin.color.set('#7fae5a');
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.46, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), lam('#4e6b3a')); shell.rotation.x = -Math.PI / 2; shell.position.set(0, 0.32, -0.2); torso.add(shell);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.05, 6, 14), lam('#d9c98a')); rim.position.set(0, 0.32, -0.26); torso.add(rim);
    const beak = box(0.14, 0.08, 0.1, lam('#d9c98a')); beak.position.set(0, -0.08, 0.5); head.add(beak);
  }
  const eyeMat = opts.kind ? lam('#2b2b33') : mats.black;
  const eyes = [];
  [-0.17, 0.17].forEach((x) => { const eye = opts.kind ? new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), eyeMat) : ball(0.064, mats.black, 0.9, 1.25, 0.5); eye.position.set(x, opts.kind ? 0.02 : -0.02, 0.47); head.add(eye); eyes.push(eye); if (opts.kind) { const br = box(0.14, 0.03, 0.03, mats.black); br.position.set(x, 0.14, 0.47); br.rotation.z = x > 0 ? 0.25 : -0.25; head.add(br); } });
  [-0.17, 0.17].forEach((x) => { const hl = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' })); hl.position.set(x + 0.022, opts.kind ? 0.06 : 0.012, 0.505); head.add(hl); });
  [-0.29, 0.29].forEach((x) => { const ck = new THREE.Mesh(new THREE.SphereGeometry(opts.kind ? 0.095 : 0.085, 10, 8), mats.cheek); ck.scale.set(1, 0.6, 0.3); ck.position.set(x * 1.04, -0.13, 0.41); ck.castShadow = false; head.add(ck); });
  const smile = new THREE.Mesh(new THREE.TorusGeometry(opts.kind ? 0.15 : 0.055, opts.kind ? 0.022 : 0.017, 6, 14, Math.PI), mats.black); smile.rotation.z = Math.PI; smile.position.set(0, opts.kind ? -0.14 : -0.13, 0.475); head.add(smile);
  if (opts.beard) { const bd = new THREE.Mesh(new THREE.SphereGeometry(0.54, 12, 8, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), mats.hairMat); bd.position.set(0, 0.02, 0.04); bd.scale.set(1, 0.9, 1); head.add(bd); const mus = box(0.3, 0.06, 0.08, mats.hairMat); mus.position.set(0, -0.09, 0.48); head.add(mus); }
  if (opts.book) { const bk = box(0.3, 0.36, 0.06, lam('#9c4a33')); const pg = box(0.27, 0.33, 0.04, lam('#fbf6e6')); pg.position.z = 0.03; bk.add(pg); bk.name = 'book'; root.userData.book = bk; }

  // 모자
  const hats = {};
  hats.cap = new THREE.Group();
  { const c = new THREE.Mesh(new THREE.SphereGeometry(0.56, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), mats.hat); c.position.y = 0.1; hats.cap.add(c);
    const brim = box(0.6, 0.05, 0.4, mats.hat); brim.position.set(0, 0.12, 0.55); hats.cap.add(brim); }
  hats.visor = new THREE.Group();
  { const band = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.12, 24, 1, true), mats.hat); band.position.y = 0.17; hats.visor.add(band);
    const brim = box(0.62, 0.05, 0.42, mats.hat); brim.position.set(0, 0.13, 0.56); hats.visor.add(brim); }
  hats.bucket = new THREE.Group();
  { const top = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.57, 0.34, 20), mats.hat); top.position.y = 0.3; hats.bucket.add(top);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.04, 24), mats.hat); brim.position.y = 0.14; hats.bucket.add(brim); }
  hats.beanie = new THREE.Group();
  { const top = new THREE.Mesh(new THREE.SphereGeometry(0.59, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), mats.hat); top.position.y = 0.08; hats.beanie.add(top);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.16, 24, 1, true), mats.hat); band.position.y = 0.1; hats.beanie.add(band);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), mats.sole); pom.position.y = 0.66; hats.beanie.add(pom); }
  hats.straw = new THREE.Group();
  { const strawMat = lam('#e3c784'); const top = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 0.3, 20), strawMat); top.position.y = 0.32; hats.straw.add(top);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.04, 24), strawMat); brim.position.y = 0.17; hats.straw.add(brim);
    const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 20, 1, true), mats.hat); ribbon.position.y = 0.22; hats.straw.add(ribbon); }
  hats.headband = new THREE.Group();
  { const band = new THREE.Mesh(new THREE.CylinderGeometry(0.57, 0.57, 0.1, 24, 1, true), mats.hat); band.position.y = 0.14; hats.headband.add(band); }
  const hatPivot = new THREE.Group(); head.add(hatPivot);
  Object.values(hats).forEach((h) => hatPivot.add(h));

  // 선글라스
  const glasses = new THREE.Group(); head.add(glasses);
  const lensL = box(0.26, 0.13, 0.04, mats.black); lensL.position.set(-0.17, 0.04, 0.5);
  const lensR = lensL.clone(); lensR.position.x = 0.17;
  const bridge = box(0.12, 0.03, 0.03, mats.black); bridge.position.set(0, 0.07, 0.5);
  glasses.add(lensL, lensR, bridge);
  const sportLens = box(0.62, 0.15, 0.05, lam('#f29a2e')); sportLens.position.set(0, 0.05, 0.5); sportLens.visible = false; glasses.add(sportLens);
  mats.sport = sportLens.material; mats.sport.emissive = new THREE.Color('#7a3a00');
  const roundL = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 10), mats.black); roundL.rotation.x = Math.PI / 2; roundL.position.set(-0.17, 0.04, 0.5);
  const roundR = roundL.clone(); roundR.position.x = 0.17; roundL.visible = roundR.visible = false; glasses.add(roundL, roundR);
  if (opts.turtle) { roundL.material = lam('#cfe3f2'); roundR.material = roundL.material; const gb = box(0.12, 0.025, 0.03, mats.black); gb.position.set(0, 0.06, 0.5); glasses.add(gb); }

  // 팔
  const mkArm = (sx) => {
    const g = new THREE.Group(); g.position.set(sx * 0.42, 0.56, 0); torso.add(g);
    const sleeve = cap(0.105, 0.08, mats.shirt); sleeve.position.y = -0.08; g.add(sleeve);
    const arm = cap(0.075, 0.26, mats.skin); arm.position.y = -0.3; g.add(arm);
    const hand = ball(0.092, mats.skin); hand.position.y = -0.5; g.add(hand);
    if (opts.tattoo && sx === 1) { for (let i = 0; i < 4; i++) { const t = box(0.17, 0.03, 0.17, lam('#2d3a4a')); t.position.y = -0.22 - i * 0.07; t.rotation.y = i * 0.4; g.add(t); } const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), lam('#2d3a4a')); star.position.set(0.085, -0.3, 0); g.add(star); }
    if (opts.book && sx === -1) { const bk = root.userData.book; bk.position.set(0, -0.5, 0.2); bk.rotation.x = -0.6; g.add(bk); }
    sleeves.push(sleeve); arms.push(arm);
    return g;
  };
  const sleeves = [], arms = [];
  const armL = mkArm(1), armR = mkArm(-1);

  // 다리
  const legParts = [], shoeParts = [];
  const mkLeg = (sx) => {
    const g = new THREE.Group(); g.position.set(sx * 0.17, 0, 0); hips.add(g);
    const upper = cap(0.13, 0.12, mats.pants); upper.position.y = -0.17; g.add(upper);
    const lower = cap(0.1, 0.22, mats.skin); lower.position.y = -0.46; g.add(lower);
    const shoe = ball(0.15, mats.shoes, 0.95, 0.62, 1.4); shoe.position.set(0, -0.69, 0.06); g.add(shoe);
    const sole = ball(0.15, mats.sole, 0.97, 0.22, 1.42); sole.position.set(0, -0.755, 0.06); g.add(sole);
    const lug = ball(0.15, mats.lug, 1.0, 0.2, 1.46); lug.position.set(0, -0.775, 0.06); lug.visible = false; g.add(lug);
    legParts.push(lower); shoeParts.push({ shoe, sole, lug, upper });
    return g;
  };
  const legL = mkLeg(1), legR = mkLeg(-1);
  const shorts = cap(0.28, 0.06, mats.pants); shorts.scale.set(1.08, 0.5, 0.86); shorts.position.y = 0.0; hips.add(shorts);

  // 그림자 원
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.6, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.28, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.05; root.add(shadow);

  body.scale.set(opts.scaleW || 1, opts.scaleH || 1, opts.scaleW || 1);
  root.userData.parts = { body, hips, torso, chest, head, skull, hair, armL, armR, legL, legR, eyes, smile, shadow, mats };
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  shadow.castShadow = false; shadow.material.opacity = 0.12;

  // 옵션이 없는 러너(나·다른 탐방객)는 모델을 쓰고, 예전 도형 몸은 동작 계산용으로만 남겨 숨김
  const model = Object.keys(opts).length === 0 ? buildModel() : null;
  if (model) { body.traverse((o) => { if (o.isMesh) o.visible = false; }); body.add(model.holder); shadow.material.opacity = 0.16; shadow.scale.setScalar(0.85); }
  const syncModel = () => { const B = model.bones;
    B.hips.position.set(body.position.x / MODEL_S, JOINT.hips[1] + (hips.position.y - HIP) / MODEL_S, body.position.z / MODEL_S); B.hips.rotation.copy(hips.rotation);
    B.chest.rotation.copy(torso.rotation); B.chest.scale.copy(chest.scale); B.head.rotation.copy(head.rotation);
    B.legL.quaternion.copy(legL.quaternion); B.legR.quaternion.copy(legR.quaternion);
    // 팔을 내렸을 때만 살짝 벌리고, 들어 올리는 동작에서는 벌림을 빼서 머리에 파묻히지 않게
    const oL = ARM_OUT * (1 - sstep(0.3, 1.2, Math.abs(armL.rotation.z))), oR = ARM_OUT * (1 - sstep(0.3, 1.2, Math.abs(armR.rotation.z)));
    B.armL.quaternion.copy(armL.quaternion).multiply(qTmp.setFromEuler(eTmp.set(0, 0, -Math.PI / 2 + oL))); B.armR.quaternion.copy(armR.quaternion).multiply(qTmp.setFromEuler(eTmp.set(0, 0, Math.PI / 2 - oR))); };

  function apply(of) {
    if (model) { model.set(of); return; }
    Object.entries(hats).forEach(([k, g]) => (g.visible = of.hat.type === k));
    mats.hat.color.set(of.hat.color);
    const back = !!of.hat.back && (of.hat.type === 'cap' || of.hat.type === 'visor');
    hatPivot.rotation.y = back ? Math.PI : 0; hatPivot.rotation.x = back ? -0.18 : 0; hatPivot.position.z = back ? -0.06 : 0;
    const under = ['bucket', 'cap', 'beanie', 'straw'].includes(of.hat.type);
    hair.visible = hairStyle === 'perm' || hairStyle === 'bob' || hairStyle === 'base' || !under;
    if (hairStyle === 'base') { const ht = of.hair?.type || 'bun'; Object.entries(bases).forEach(([k, g]) => { g.visible = k === ht && !(under && (k === 'bun' || k === 'twin' || k === 'top' || k === 'half')); }); hair.scale.setScalar(under ? 0.97 : 1); if (of.hair?.color) mats.hairMat.color.set(of.hair.color); if (of.skin?.color && !opts.skin && !opts.turtle) mats.skin.color.set(of.skin.color); }
    glasses.visible = of.glasses.type !== 'none';
    const gt = of.glasses.type;
    const lensMat = gt === 'mirror' ? mats.mirror : mats.black;
    lensL.material = lensMat; lensR.material = lensMat;
    lensL.visible = lensR.visible = bridge.visible = gt === 'black' || gt === 'mirror';
    sportLens.visible = gt === 'sport';
    roundL.visible = roundR.visible = gt === 'round';
    const st = of.shirt.type || 'tee';
    sleeves.forEach((sl) => { sl.visible = st !== 'singlet'; sl.scale.y = st === 'long' ? 1.75 : 1; sl.position.y = st === 'long' ? -0.2 : -0.08; });
    arms.forEach((a) => (a.visible = st !== 'long'));
    const pt = of.pants.type;
    shorts.scale.y = pt === 'half' ? 0.8 : 0.5; shorts.position.y = pt === 'half' ? -0.08 : 0.0;
    const sh = of.shoes.type || 'road';
    shoeParts.forEach((sp) => { sp.lug.visible = sh === 'trail'; sp.sole.material = sh === 'trail' ? mats.lug : mats.sole; sp.shoe.scale.y = sh === 'sandal' ? 0.3 : 0.62; sp.shoe.position.y = sh === 'sandal' ? -0.73 : -0.69; });
    vest.visible = of.vest.type === 'on';
    mats.vest.color.set(of.vest.color);
    mats.shirt.color.set(of.shirt.color);
    mats.pants.color.set(of.pants.color);
    legParts.forEach((p) => (p.material = of.pants.type === 'tights' ? mats.pants : mats.skin));
    shoeParts.forEach((sp) => { sp.upper.material = of.pants.type === 'half' ? mats.pants : mats.pants; });
    mats.shoes.color.set(of.shoes.color);
  }

  const st = { phase: 0, blend: 0, slope: 0 };
  // pose: 'move' | 'wave' | 'sit' | 'photo' | 'crouch' | 'breath'
  // slope: 진행 방향 비탈 (높이/거리, 오르막 +)
  function animate(dt, { speed, running, pose, t, breath, air, jumpV, slope = 0 }) {
    const moving = speed > 0.1 && pose === 'move';
    st.blend += ((moving ? 1 : 0) - st.blend) * Math.min(1, dt * 10);
    st.phase += dt * speed * (running ? 1.05 : 1.6);
    const amp = (running ? 0.95 : 0.55) * st.blend;
    const s = Math.sin(st.phase);
    legL.rotation.set(s * amp, 0, 0);
    legR.rotation.set(-s * amp, 0, 0);
    armL.rotation.set(-s * amp * 0.9, 0, 0.12);
    armR.rotation.set(s * amp * 0.9, 0, -0.12);
    if (running) { armL.rotation.x -= 0.5 * st.blend; armR.rotation.x -= 0.5 * st.blend; }
    torso.rotation.set((running ? 0.22 : 0.06) * st.blend, 0, 0);
    hips.position.y = HIP + Math.abs(Math.cos(st.phase)) * (running ? 0.14 : 0.06) * st.blend;
    body.position.set(0, 0, 0);
    chest.scale.set(1, 1, 1);
    head.rotation.set(0, 0, 0); hips.rotation.y = 0; torso.rotation.z = 0;
    // 어깨: 팔과 같은 박자로 가슴이 반대쪽 다리와 엇갈려 돌고(골반은 반대로 조금), 머리는 앞을 보게 되돌림
    { const tw = s * amp; hips.rotation.y = tw * 0.12; torso.rotation.y = -tw * 0.3; head.rotation.y = tw * 0.18;
      torso.rotation.z = Math.cos(st.phase) * amp * 0.035; } // 걸음마다 어깨가 살짝 기우뚱
    // 비탈: 몸을 비탈 쪽으로 숙이고 다리 흔들림 중심을 비탈에 맞춤
    st.slope += (slope - st.slope) * Math.min(1, dt * 8);
    const sa = Math.atan(st.slope) * st.blend;
    torso.rotation.x += sa * 0.45; legL.rotation.x += sa * 0.55; legR.rotation.x += sa * 0.55;

    if (pose === 'wave') {
      armR.rotation.set(0, 0, -2.25 + Math.sin(t * 12) * 0.35);
      head.rotation.z = Math.sin(t * 3) * 0.08;
    } else if (pose === 'sit') {
      hips.position.y = 0.5;
      legL.rotation.set(-1.45, 0, 0.08); legR.rotation.set(-1.45, 0, -0.08);
      armL.rotation.set(-0.3, 0, 0.25); armR.rotation.set(-0.3, 0, -0.25);
      torso.rotation.x = -0.08;
      chest.scale.setScalar(1 + Math.sin(t * 1.2) * 0.02);
    } else if (pose === 'photo') {
      armL.rotation.set(0, 0, 2.5); armR.rotation.set(0, 0, -2.5);
      legL.rotation.set(0, 0, 0.18); legR.rotation.set(0, 0, -0.18);
      head.rotation.z = 0.12;
    } else if (pose === 'crouch') {
      const k = Math.sin(Math.min(1, t / 0.9) * Math.PI);
      torso.rotation.x = 0.9 * k;
      hips.position.y = HIP - 0.25 * k;
      legL.rotation.x = -0.6 * k; legR.rotation.x = -0.6 * k;
      armL.rotation.set(-1.4 * k, 0, 0.1); armR.rotation.set(-1.4 * k, 0, -0.1);
    } else if (pose === 'eat') {
      const k = Math.min(1, t / 0.4);
      armR.rotation.set(-2.0 * k, 0, -0.5 * k); armL.rotation.set(-0.3, 0, 0.12);
      head.rotation.x = 0.1 + Math.sin(t * 14) * 0.05;
      chest.scale.setScalar(1 + Math.sin(t * 14) * 0.01);
    } else if (pose === 'dance') {
      const b = t * 7.5;
      hips.position.y = HIP + Math.abs(Math.sin(b)) * 0.12;
      hips.rotation.y = Math.sin(b * 0.5) * 0.25; torso.rotation.z = Math.sin(b) * 0.12;
      armL.rotation.set(-2.4 + Math.sin(b) * 0.6, 0, 0.9 + Math.sin(b * 0.5) * 0.3); armR.rotation.set(-2.4 - Math.sin(b) * 0.6, 0, -0.9 - Math.sin(b * 0.5) * 0.3);
      legL.rotation.set(Math.sin(b) * 0.35, 0, 0.15); legR.rotation.set(-Math.sin(b) * 0.35, 0, -0.15);
      head.rotation.z = Math.sin(b * 0.5) * 0.2; head.rotation.y = Math.sin(b * 0.25) * 0.3;
    } else if (air) {
      const up = Math.max(-1, Math.min(1, (jumpV ?? 0) / 8.5));
      legL.rotation.set(-0.9 - up * 0.3, 0, 0.1); legR.rotation.set(0.5, 0, -0.1);
      armL.rotation.set(-0.6 - up * 0.8, 0, 0.5); armR.rotation.set(-0.6 - up * 0.8, 0, -0.5);
      torso.rotation.x = 0.1 + up * 0.1;
      hips.position.y = HIP;
    } else if (pose === 'breath') {
      const b = breath ?? 0;
      chest.scale.set(1 + b * 0.08, 1 + b * 0.05, 1 + b * 0.12);
      armL.rotation.set(0, 0, 0.12 + b * 0.35); armR.rotation.set(0, 0, -0.12 - b * 0.35);
      head.rotation.x = -b * 0.15;
    }
    // 발이 비탈 아래로 들어가면 그만큼 골반을 올림 (앞발은 오르막에, 뒷발은 내리막에 걸림)
    if (!air && Math.abs(st.slope) > 0.01 && (pose === 'move' || pose === 'breath')) {
      const L = model ? LEG_M : 0.775, base = model ? LEG_M : HIP;
      const pen = (lg) => { const th = lg.rotation.x, hy = base + hips.position.y - HIP, f = -L * Math.sin(th); return st.slope * f - (hy - L * Math.cos(th)); };
      hips.position.y += Math.max(0, pen(legL), pen(legR));
    }
    if (model) syncModel();
  }

  const tintable = model ? [model.mat] : [mats.skin, mats.shirt, mats.pants, mats.shoes, mats.vest, mats.hat];
  let tinted = false;
  function setTint(on) {
    if (on === tinted) return; tinted = on;
    tintable.forEach((m) => { if (model) { m.emissive.set(on ? '#ffd84a' : '#ffffff'); m.emissiveIntensity = on ? 0.75 : 0.32; } else { m.emissive.set(on ? '#c9a200' : '#000000'); m.emissiveIntensity = on ? 0.9 : 1; } });
    if (model) model.holder.traverse((o) => { if (o.isMesh && o !== model.mesh) { if (on) o.material.emissive.set('#ffd84a'); else o.material.emissive.copy(o.material.color).multiplyScalar(NSMODE ? 0.16 : 0.32); } }); // 장비도 같이
  }
  const setPhase = (ph) => { st.phase = ph; st.blend = 1; };
  // 장비 하나만 바꾸기 (확인용). 저장되는 값은 outfit.gear
  const setGear = (slot, key) => { if (model && ACCESSORIES[key]) model.wear(slot, key); };
  return { root, apply, animate, setTint, setPhase, setGear };
}
