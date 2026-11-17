import * as THREE from 'three';
import { NSMODE, TEXCS } from './boot.js';
import { gradHard } from './toon.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getAsset, bytesAs as b64 } from './assets.js'; // #85: 캐릭터 모델(runnermodel.js)은 따로 받는 파일 'runner'. main.js 가 게임 모듈보다 먼저 받아 둠
const RM = getAsset('runner');
import { patchDQS } from './dqskin.js';
import { ACCESSORIES, DEFAULT_GEAR } from './gear.js';
import { BOW, BLINK } from './balance.js';

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
const EMO_POSES = new Set(['insa', 'five', 'come', 'point', 'trash', 'follow', 'wait', 'help', 'thumb', 'no', 'thanks', 'sorry', 'clap', 'hop', 'laugh', 'wow', 'sad', 'heart', 'sitg', 'lie']); // 동작 (#76), wave·dance 는 아래 따로
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
// 피부색 3가지 (#51): 첫째가 텍스처에 구운 피부색(그대로). 나머지는 텍스처 피부를 이 색 비율로 곱함 (outfit.skin.color)
export const SKIN_TONES = ['#e8bf99', '#c98a5e', '#8a5636'];
const skinRatio = (c, out) => { const i = SKIN_TONES.indexOf(String(c || '').toLowerCase()); if (i <= 0) return out.set(1, 1, 1); const a = new THREE.Color(SKIN_TONES[0]), b = new THREE.Color(SKIN_TONES[i]); return out.set(b.r / a.r, b.g / a.g, b.b / a.b); };
// 텍스처 피부(색상 0.074·채도 0.34·명도 0.91 근처)만 골라 cSkin 을 곱함. 재킷(색상 0.11)·머리카락·눈·양말은 빠짐. region: 몸에서 피부가 있는 곳
const HSV_GLSL = 'vec3 rgb2hsv(vec3 c){ vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0); vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g)); vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r)); float d = q.x - min(q.w, q.y); return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x); }';
const skinGLSL = (hsv, region) => `{ float sk = smoothstep(0.035, 0.05, ${hsv}.x) * (1.0 - smoothstep(0.088, 0.098, ${hsv}.x)) * smoothstep(0.14, 0.2, ${hsv}.y) * (1.0 - smoothstep(0.5, 0.58, ${hsv}.y)) * smoothstep(0.62, 0.72, ${hsv}.z) * (${region});
  diffuseColor.rgb *= mix(vec3(1.0), cSkin, sk); }`;
// ---------- 눈 깜빡임 (#74): 눈꺼풀은 셰이더로 그림 (후처리 없음) ----------
// 기본 캐릭터 눈 자리(기본 자세 좌표, model/fixeyes.py 와 같은 정면 투영으로 잰 타원 + 여유): 가운데 x·y, 반폭, 반높이. 머리 3종(#54)도 같은 자리
// face.x = 눈 감김 0..1 (위에서 피부색 눈꺼풀이 내려옴), face.y = 눈 크게 0..1 (눈 둘레 정점을 바깥으로 밂)
const LID_PARS = `uniform vec2 face; uniform vec3 cLid;
  const vec4 EYE_L = vec4(0.0773, 0.7188, 0.0488, 0.0777); const vec4 EYE_R = vec4(-0.0825, 0.7186, 0.0472, 0.0775);`;
const LID_VERT = `${LID_PARS}
  vec2 eyeGrow(vec2 p, vec4 e) { vec2 d = (p - e.xy) / e.zw; return (p - e.xy) * face.y * ${BLINK.wide.toFixed(3)} * (1.0 - smoothstep(0.8, 1.6, length(d))); }`;
const LID_FRAG = `${LID_PARS}
  float lidEye(vec2 p, vec4 e, float k, inout float line) {
    vec2 d = (p - e.xy) / e.zw; if (dot(d, d) > 1.0) return 0.0;
    float yl = 1.0 - 2.25 * k + 0.25 * k * d.x * d.x; // 눈꺼풀 끝 (가운데가 조금 더 내려온 곡선). k=1 이면 눈 전체를 덮음
    float yline = max(yl, -0.3 + 0.35 * d.x * d.x); // 속눈썹 선: 눈꺼풀을 따라 내려오다 아래쪽 곡선(감은 눈)에서 멈춤
    line = max(line, (1.0 - smoothstep(0.045, 0.09, abs(d.y - yline))) * (1.0 - smoothstep(0.78, 0.92, abs(d.x))));
    return smoothstep(yl - 0.04, yl + 0.04, d.y); }`;
// 기본 자세 위치(position) 기준. begin_vertex 바로 뒤에 넣음 (DQ 스키닝 전)
const lidVertex = (pos) => `if (face.y > 0.001 && ${pos}.z > 0.1) transformed.xy += eyeGrow(${pos}.xy, EYE_L) + eyeGrow(${pos}.xy, EYE_R);`;
// map_fragment 바로 뒤, 피부색 바꾸기 전에 넣음 → 눈꺼풀도 피부색(3가지)을 그대로 받음
const lidFragment = (rest) => `if (face.x > 0.001 && ${rest}.z > 0.1) { float ln = 0.0; float c = max(lidEye(${rest}.xy, EYE_L, face.x, ln), lidEye(${rest}.xy, EYE_R, face.x, ln));
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuse * cLid, c); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.1), ln * step(0.03, face.x)); }`;
// 텍스처에 구운 피부색(눈 둘레 중간값, 0~255) → 셰이더의 텍스처 색 공간 값
export const lidColor = (rgb, out = new THREE.Vector3()) => { if (NSMODE) return out.set(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255); const c = new THREE.Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace); return out.set(c.r, c.g, c.b); };
const LID_BASE = [232, 189, 154];
// 머리 장비(#51)용 재질 패치: 피부색 + 몸과 같은 발광(텍스처 색 비율) + 눈꺼풀(#74). 장비 위치 = 기본 자세 좌표 (머리 뼈에 관절 위치만큼 옮겨 붙임)
const patchHead = (U, lid) => (sh) => { sh.uniforms.cSkin = U.cSkin; sh.uniforms.face = U.face; sh.uniforms.cLid = { value: lidColor(lid || LID_BASE) };
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest;\n' + LID_VERT).replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;\n' + lidVertex('position'));
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest; uniform vec3 cSkin;\n' + HSV_GLSL + LID_FRAG)
    .replace('#include <map_fragment>', `#include <map_fragment>
    ${lidFragment('vRest')}
    { vec3 h = rgb2hsv(${NSMODE ? 'diffuseColor.rgb' : 'pow(diffuseColor.rgb, vec3(1.0 / 2.2))'}); ${skinGLSL('h', '1.0')} }`)
    .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance *= diffuseColor.rgb / max(diffuse, vec3(0.001));'); };
function buildModel() {
  const geo = getModelGeo();
  const U = { cHat: { value: new THREE.Color() }, cShirt: { value: new THREE.Color() }, cPants: { value: new THREE.Color() }, cShoes: { value: new THREE.Color() }, on: { value: new THREE.Vector4(0, 0, 0, 0) }, hide: { value: new THREE.Vector4(0, 0, 0, 0) }, hidePack: { value: 0 }, noStrap: { value: 0 }, hideHead: { value: 0 }, hideBody: { value: 0 }, cSkin: { value: new THREE.Vector3(1, 1, 1) }, face: { value: new THREE.Vector2(0, 0) }, cLid: { value: lidColor(LID_BASE) } };
  // 남송이오름(새 그림체)에서는 3단 툰 명암
  const mat = NSMODE ? new THREE.MeshToonMaterial({ map: modelTex, gradientMap: gradHard, emissive: '#ffffff', emissiveIntensity: 0.16 }) : new THREE.MeshLambertMaterial({ map: modelTex, color: '#e4e4e4', emissive: '#ffffff', emissiveIntensity: 0.32 });
  // 텍스처 색과 부위(기본 자세 위치)로 모자·상의·바지·신발을 가려 옷 색을 바꿈
  mat.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, U); patchDQS(sh);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest;\n' + LID_VERT).replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;\n' + lidVertex('position'));
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest; uniform vec3 cHat, cShirt, cPants, cShoes; uniform vec4 on, hide; uniform float hidePack, noStrap, hideHead, hideBody; uniform vec3 cSkin;\n' + HSV_GLSL + LID_FRAG)
      .replace('#include <map_fragment>', `#include <map_fragment>
      ${lidFragment('vRest')}
      { vec3 h = rgb2hsv(${NSMODE ? 'diffuseColor.rgb' : 'pow(diffuseColor.rgb, vec3(1.0 / 2.2))'}); float y = vRest.y; float ax = abs(vRest.x);
        if (hideHead > 0.5 && y > 0.595) discard; // 머리 장비(#51)가 목 위를 덮음
        if (hideBody > 0.5 && ax < 0.37 && y < 0.6) discard; // 옷(#52)이 손 빼고 몸 전체를 덮음 (재킷·반바지·운동화·배낭 감춤)
        ${skinGLSL('h', 'max(max(step(0.57, y), step(0.37, ax)), step(0.095, y) * step(y, 0.15))')}
        float green = smoothstep(0.2, 0.24, h.x) * (1.0 - smoothstep(0.42, 0.46, h.x)) * smoothstep(0.25, 0.4, h.y);
        float cream = smoothstep(0.07, 0.1, h.x) * (1.0 - smoothstep(0.17, 0.2, h.x)) * (1.0 - smoothstep(0.38, 0.46, h.y)) * smoothstep(0.55, 0.68, h.z);
        float olive = smoothstep(0.05, 0.08, h.x) * (1.0 - smoothstep(0.16, 0.2, h.x)) * smoothstep(0.35, 0.45, h.y) * (1.0 - smoothstep(0.6, 0.7, h.z));
        { float dark = (1.0 - smoothstep(0.22, 0.34, h.z)) * smoothstep(0.57, 0.6, y); float l = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(l) * 0.75, dark); } // 머리카락·눈은 무채색 검정으로
        float rHat = green * smoothstep(0.56, 0.6, y);
        float rShirt = cream * smoothstep(0.23, 0.26, y) * (1.0 - smoothstep(0.585, 0.605, y));
        float rPants = olive * smoothstep(0.15, 0.17, y) * (1.0 - smoothstep(0.27, 0.29, y)) * (1.0 - smoothstep(0.21, 0.24, ax)) * step(-0.2, vRest.z);
        float rShoes = (1.0 - smoothstep(0.25, 0.4, h.z)) * (1.0 - smoothstep(0.09, 0.105, y));
        float packCol = smoothstep(0.04, 0.06, h.x) * (1.0 - smoothstep(0.12, 0.14, h.x)) * smoothstep(0.34, 0.4, h.y) * smoothstep(0.4, 0.46, h.z);
        float rPack = packCol * step(0.26, y) * step(y, 0.62) * step(ax, 0.28) * step(vRest.z, -0.09);
        // 배낭 없음(#31): 어깨끈도 재킷 색으로 덮음
        float rStrap = noStrap * smoothstep(0.03, 0.06, h.x) * (1.0 - smoothstep(0.13, 0.15, h.x)) * smoothstep(0.3, 0.38, h.y) * smoothstep(0.3, 0.4, h.z) * step(0.27, y) * step(y, 0.61) * step(ax, 0.3);
        diffuseColor.rgb = mix(diffuseColor.rgb, cShirt, rStrap);
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
  mesh.castShadow = true; mesh.receiveShadow = false;
  // 화면 밖·그림자 영역 밖이면 그리지 않게 (#79): 뼈가 움직여도 들어가도록 기본 자세 구를 넉넉히 키워 고정 (전엔 frustumCulled = false 로 늘 그림)
  const padSphere = (g) => { g.computeBoundingSphere(); const sp = g.boundingSphere.clone(); sp.radius *= 1.7; return sp; };
  mesh.boundingSphere = padSphere(geo);
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
        // 같은 재질끼리 한 덩어리로 합쳐 그리기 횟수를 줄임 (옷은 조각이 많음)
        const byMat = new Map(); src.traverse((o) => { if (!o.isMesh) return; const g = o.geometry.clone().applyMatrix4(o.matrixWorld); for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
          const gi = g.index ? g : (() => { const n = g.attributes.position.count, ix = []; for (let i = 0; i < n; i++) ix.push(i); g.setIndex(ix); return g; })();
          if (!byMat.has(o.material)) byMat.set(o.material, []); byMat.get(o.material).push(gi); });
        byMat.forEach((gs, m) => { const g = gs.length > 1 ? mergeGeometries(gs) : gs[0]; const { si, sw } = skinWeights(g.attributes.position.array);
          g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
          m.onBeforeCompile = patchDQS; const sm = new THREE.SkinnedMesh(g, m); sm.bind(mesh.skeleton, mesh.bindMatrix); sm.boundingSphere = padSphere(g); obj.add(sm); });
        holder.add(obj);
      } else { obj = src; const j = JOINT[a.bone || 'chest']; obj.position.sub(new THREE.Vector3(...j)); bones[a.bone || 'chest'].add(obj); }
      obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
      if (a.skinTint) mats.forEach((m) => { m.onBeforeCompile = patchHead(U, a.lid); });
      worn[slot].obj = obj; worn[slot].mats = mats;
    }
    // 감출 부분 다시 계산
    const hid = new Set(); Object.values(worn).forEach((w) => (ACCESSORIES[w.key]?.hide || []).forEach((h) => hid.add(h)));
    U.hide.value.set(+hid.has('hat'), +hid.has('top'), +hid.has('bottom'), +hid.has('shoes')); U.hidePack.value = +hid.has('pack'); U.noStrap.value = +hid.has('straps'); U.hideHead.value = +hid.has('head'); U.hideBody.value = +hid.has('body');
  }
  const TINT = { hat: 'hat', pants: 'pants', shirt: 'shirt', shoes: 'shoes' };
  const set = (of) => { const pick = (k, u, i) => { const c = of[k]?.color || MODEL_DEFAULT[k]; U[u].value.set(c); U.on.value.setComponent(i, c.toLowerCase() === MODEL_DEFAULT[k] ? 0 : 1); }; pick('hat', 'cHat', 0); pick('shirt', 'cShirt', 1); pick('pants', 'cPants', 2); pick('shoes', 'cShoes', 3); skinRatio(of.skin?.color, U.cSkin.value);
    const g = { ...DEFAULT_GEAR, ...(of.gear || {}) }; Object.entries(g).forEach(([slot, key]) => wear(slot, key));
    const skinCol = SKIN_TONES.includes(String(of.skin?.color || '').toLowerCase()) ? of.skin.color : SKIN_TONES[0], footCol = ACCESSORIES[g.socks]?.foot || skinCol;
    // 장비 색: tint 로 묶인 재질은 옷장 색을 따름 (기본색이면 장비 자체 색)
    Object.values(worn).forEach((w) => { const t = ACCESSORIES[w.key]?.tint || {}; w.mats.forEach((m) => { const part = TINT[t[m.userData.name]]; const c = part && of[part]?.color; m.color.set(c && c.toLowerCase() !== MODEL_DEFAULT[part] ? c : m.userData.def);
      if (m.userData.name === 'skin') m.color.set(skinCol); else if (m.userData.name === 'foot') m.color.set(footCol); // 옷(#52)의 맨살·발
      m.emissive.copy(m.color).multiplyScalar(NSMODE ? 0.16 : 0.32); }); }); };
  return { holder, mesh, mat, bones, set, wear, U };
}
const qTmp = new THREE.Quaternion(), eTmp = new THREE.Euler();
const LEG_M = (P.hipY - 0.01) * MODEL_S; // 모델 다리 길이(골반 관절 → 발바닥)
const ARM_OUT = 0.42; // 팔을 완전히 내리지 않고 살짝 벌려 두면 어깨가 덜 구겨짐
const Q_ARM_L = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2 + ARM_OUT)), Q_ARM_R = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2 - ARM_OUT));

// opts: { skin, hair: 'short'|'bob'|'perm'|'bald', hairColor, beard, kind, tattoo, turtle, book, scaleW, scaleH }
// 귤 던지기: 준비(뒤로 젖히며 몸 틀기) → 던지기(가슴이 먼저 돌고 팔이 따라 나감) → 마무리(뻗은 채 머묾) → 복귀
export const THROW = { release: 0.45, total: 1.0 };
// [시간, 오른팔 x, z, 왼팔 x, z, 가슴 y, 가슴 x]
const THROW_KEYS = [[0, 0, -0.12, 0, 0.12, 0, 0], [0.3, 1.1, -0.55, -1.0, 0.3, -0.55, -0.05], [0.4, -1.5, -0.25, 0.2, 0.5, 0.35, 0.18], [0.45, -2.3, -0.2, 0.5, 0.6, 0.45, 0.3], [0.72, -2.2, -0.2, 0.5, 0.6, 0.42, 0.28], [1.0, 0, -0.12, 0, 0.12, 0, 0]];
function throwKey(t) {
  const K = THROW_KEYS; if (t <= 0) return K[0]; if (t >= 1) return K[K.length - 1];
  let i = 0; while (K[i + 1][0] < t) i++;
  const a = K[i], b = K[i + 1]; let f = (t - a[0]) / (b[0] - a[0]); f = f * f * (3 - 2 * f);
  return a.map((v, j) => v + (b[j] - v) * f);
}
// 깜빡임 거리 생략 (#74): 이 카메라에서 BLINK.far 보다 먼 캐릭터는 눈을 뜬 채로 둠
let blinkCam = null;
export const setBlinkCamera = (cam) => { blinkCam = cam; };
const _bp = new THREE.Vector3();
export function buildRunner(opts = {}) {
  const root = new THREE.Group();
  const SKIN_C = opts.skin || SKIN;
  const body = new THREE.Group(); // 앉기·숙이기용
  root.add(body);
  const mats = {
    skin: lam(SKIN_C), hairMat: lam(opts.hairColor || '#2a221c'), shirt: lam('#fff'), pants: lam('#000'), shoes: lam('#000'), vest: lam('#000'), hat: lam('#000'),
    sole: lam('#f2efe6'), black: lam('#1c1c22'), mirror: new THREE.MeshStandardMaterial({ color: '#4fb3e8', emissive: '#1d5f88', roughness: 0.2, metalness: 0.6 }),
    bottle: lam('#bfe3f2'), lug: lam('#2a2a2e'),
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

  const st = { phase: 0, blend: 0, slope: 0, clock: 0, pick: 0 };
  // pose: 'move' | 'wave' | 'cheer' | 'sit' | 'photo' | 'crouch' | 'carry' | 'flail' | 'fish'
  // slope: 진행 방향 비탈 (높이/거리, 오르막 +)
  // 눈 (#74): 사람마다 박자가 다름(처음 간격 무작위). face: 'shut' 감은 채(쓰러짐), 'wide' 크게(받힘·놀람). lid(0..1) 를 주면 그대로 (확인용)
  const eye = { next: BLINK.gapMin + Math.random() * (BLINK.gapMax - BLINK.gapMin), t: -1, again: false, lid: 0, wide: 0, far: false };
  function tickEyes(dt, face, lid, pose) {
    const F = model.U.face.value;
    if (blinkCam && lid == null) { root.getWorldPosition(_bp); const far = _bp.distanceToSquared(blinkCam.position) > BLINK.far * BLINK.far;
      if (far) { if (!eye.far) { eye.far = true; F.set(0, 0); } return; } eye.far = false; }
    if ((pose === 'flail' || pose === 'wow') && !face) face = 'wide';
    eye.wide += ((face === 'wide' ? 1 : 0) - eye.wide) * Math.min(1, dt * (face === 'wide' ? 18 : 5));
    if (lid != null) eye.lid = lid;
    else if (face === 'shut') eye.lid = Math.min(1, eye.lid + dt / BLINK.close);
    else if (face === 'wide') { eye.lid = 0; eye.t = -1; }
    else {
      if (eye.t < 0) { eye.next -= dt; if (eye.next <= 0) { eye.t = 0; eye.again = Math.random() < BLINK.twice; eye.next = BLINK.gapMin + Math.random() * (BLINK.gapMax - BLINK.gapMin); } }
      if (eye.t >= 0) { eye.t += dt; const { close: c, hold: h, open: o } = BLINK, u = eye.t;
        eye.lid = u < c ? u / c : u < c + h ? 1 : Math.max(0, 1 - (u - c - h) / o);
        if (u >= c + h + o) { eye.lid = 0; if (eye.again) { eye.again = false; eye.t = -1; eye.next = BLINK.twiceGap; } else eye.t = -1; } }
      else if (eye.lid > 0) eye.lid = Math.max(0, eye.lid - dt / BLINK.open); // 감았다가(쓰러짐) 다시 뜸
    }
    F.set(eye.lid, eye.wide);
  }
  // 동작(이모트) (#76). upper: 탈것 위에서는 팔·머리만 (다리·골반은 탈것 포즈 그대로)
  // in = 처음 0.18초 동안 들어오는 정도, bell = 들어왔다가 끝에 돌아가는 정도
  function emotePose(id, t, upper, dur = 2) {
    const k = sstep(0, 0.18, t), bell = k * (1 - sstep(dur - 0.3, dur, t));
    const A = (a, x, z) => { a.rotation.set(a.rotation.x * (1 - bell) + x * bell, 0, a.rotation.z * (1 - bell) + z * bell); };
    const lo = (f) => { if (!upper) f(); };
    switch (id) {
      case 'wave': armR.rotation.set(0, 0, -2.25 + Math.sin(t * 12) * 0.35); head.rotation.z = Math.sin(t * 3) * 0.08; break; // 탈것 위에서 겹칠 때
      case 'insa': { const b = sstep(0.1, 0.5, t) * (1 - sstep(1.1, 1.6, t));
        lo(() => { torso.rotation.x = 0.8 * b; hips.position.y = HIP - 0.03 * b; legL.rotation.set(-0.12 * b, 0, 0.03); legR.rotation.set(-0.12 * b, 0, -0.03); });
        armL.rotation.set(0.1 * b, 0, 0.04); armR.rotation.set(0.1 * b, 0, -0.04); head.rotation.x = 0.25 * b; break; }
      case 'five': { const hit = Math.max(0, 1 - Math.abs(t - 0.55) / 0.15);
        A(armR, -2.35 - 0.25 * hit, -0.28); A(armL, 0.1, 0.12); torso.rotation.y -= 0.12 * bell; lo(() => { torso.rotation.x = -0.04 - 0.06 * hit; legR.rotation.set(-0.2 * bell, 0, -0.04); }); head.rotation.x = -0.1 * bell; break; }
      case 'come': { const w = Math.sin(t * 9) * 0.35;
        A(armR, -0.95 + w * 0.55, -0.75); A(armL, 0.05, 0.12); torso.rotation.y += 0.12 * bell; head.rotation.z = 0.1 * bell; head.rotation.y = Math.sin(t * 4.5) * 0.05; break; }
      case 'point': case 'trash': { const down = id === 'trash' ? 0.45 : 0, push = Math.sin(Math.min(1, t / 0.35) * Math.PI) * 0.12;
        A(armR, -1.6 + down - push, -0.06); A(armL, id === 'trash' ? 0.25 : 0.05, id === 'trash' ? 0.7 : 0.12);
        torso.rotation.y -= 0.18 * bell; head.rotation.y = 0.18 * bell; head.rotation.x = (id === 'trash' ? 0.18 : -0.05) * bell;
        lo(() => { legR.rotation.set(-0.25 * bell, 0, -0.04); torso.rotation.x = 0.08 * bell; }); break; }
      case 'follow': { const w = Math.sin(t * 5.5);
        A(armR, -1.35 - w * 0.8, -0.2); A(armL, 0.15, 0.12); head.rotation.y = 0.3 * bell; torso.rotation.y += 0.2 * bell;
        lo(() => { torso.rotation.x = 0.1 * bell; legL.rotation.set(-0.3 * bell, 0, 0.04); }); break; }
      case 'wait': { const pu = Math.sin(t * 7) * 0.06;
        A(armR, -1.7 + pu, -0.22); A(armL, -1.7 + pu, 0.22); lo(() => { torso.rotation.x = -0.06 * bell; }); head.rotation.x = -0.04 * bell; break; }
      case 'help': { const w = Math.sin(t * 9);
        A(armL, -2.75 + w * 0.15, 0.55 + w * 0.5); A(armR, -2.75 - w * 0.15, -0.55 + w * 0.5); head.rotation.x = -0.15 * bell; torso.rotation.z = w * 0.06 * bell;
        lo(() => { hips.position.y = HIP + Math.abs(Math.sin(t * 9)) * 0.05 * bell; }); break; }
      case 'thumb': { const pu = Math.sin(Math.min(t, 1.2) * 10) * 0.08;
        A(armR, -2.05 + pu, -0.45); A(armL, 0.25, 0.7); head.rotation.x = Math.sin(Math.min(t, 0.9) * 7) * 0.1 * bell; break; }
      case 'no': {
        A(armL, -1.25, -0.72); A(armR, -1.3, 0.72); head.rotation.y = Math.sin(t * 10) * 0.42 * bell * (1 - sstep(1.2, 1.5, t)); lo(() => { torso.rotation.x = -0.04 * bell; }); break; }
      case 'thanks': { const b = sstep(0.3, 0.6, t) * (1 - sstep(1.2, 1.6, t));
        A(armL, -1.15, -0.42); A(armR, -1.15, 0.42); head.rotation.x = 0.1 * bell + 0.18 * b; lo(() => { torso.rotation.x = 0.3 * b; }); break; }
      case 'sorry': { const sc = Math.sin(t * 16) * 0.08;
        A(armR, -2.4 + sc, 0.15); A(armL, 0.1, 0.12); head.rotation.z = 0.18 * bell; head.rotation.x = 0.1 * bell; lo(() => { torso.rotation.x = 0.08 * bell; torso.rotation.z = 0.05 * bell; }); break; }
      case 'clap': { const c = 0.5 + 0.5 * Math.sin(t * 15);
        A(armL, -1.3, 0.4 - 0.62 * c); A(armR, -1.3, -0.4 + 0.62 * c); head.rotation.x = -0.06 * bell; lo(() => { hips.position.y = HIP + Math.abs(Math.sin(t * 7.5)) * 0.03 * bell; }); break; }
      case 'hop': { const hop = Math.abs(Math.sin(t * Math.PI * 2.2)) * (1 - sstep(dur - 0.35, dur, t));
        A(armL, -2.6 + Math.sin(t * 14) * 0.15, 0.5); A(armR, -2.6 - Math.sin(t * 14) * 0.15, -0.5); head.rotation.x = -0.2 * bell;
        lo(() => { hips.position.y = HIP + hop * 0.24; legL.rotation.set(-hop * 0.55, 0, 0.06); legR.rotation.set(-hop * 0.55, 0, -0.06); torso.rotation.x = -0.05 * bell; }); break; }
      case 'laugh': { const sh = Math.sin(t * 18);
        A(armL, -0.55, -0.3); A(armR, -0.55, 0.3); head.rotation.x = (-0.3 + sh * 0.05) * bell;
        lo(() => { torso.rotation.x = (-0.18 + sh * 0.05) * bell; chest.scale.setScalar(1 + sh * 0.02 * bell); }); break; }
      case 'wow': { const j = Math.max(0, 1 - t / 0.35);
        A(armL, -0.5, 1.45); A(armR, -0.5, -1.45); head.rotation.x = -0.18 * bell;
        lo(() => { torso.rotation.x = -0.14 * bell; hips.position.y = HIP + Math.sin(j * Math.PI) * 0.12; }); break; }
      case 'sad': { const sw = Math.sin(t * 1.6) * 0.05;
        A(armL, 0.12, 0.04); A(armR, 0.12, -0.04); head.rotation.x = 0.5 * bell; head.rotation.z = sw * bell;
        lo(() => { torso.rotation.x = 0.32 * bell; hips.position.y = HIP - 0.04 * bell; }); break; }
      case 'heart': { const p = Math.sin(t * 5) * 0.04;
        A(armL, -2.45, -0.25 + p); A(armR, -2.45, 0.25 - p); head.rotation.z = Math.sin(t * 2.5) * 0.12 * bell; lo(() => { torso.rotation.z = Math.sin(t * 2.5) * 0.04 * bell; }); break; }
      case 'sitg': { // 땅에 앉기: 다리를 앞으로 뻗고 두 손은 뒤를 짚음
        if (upper) break; const s = sstep(0, 0.4, t);
        hips.position.y = HIP + (0.2 - HIP) * s; legL.rotation.set(-1.5 * s, 0, 0.1); legR.rotation.set(-1.45 * s, 0, -0.1);
        torso.rotation.x = -0.22 * s; armL.rotation.set(0.55 * s, 0, 0.32); armR.rotation.set(0.55 * s, 0, -0.32);
        chest.scale.setScalar(1 + Math.sin(t * 1.2) * 0.02); head.rotation.x = 0.1 * s; break; }
      case 'lie': { // 등을 대고 눕기: 골반째 뒤로 눕히고 팔은 머리 뒤로
        if (upper) break; const s = sstep(0, 0.5, t);
        hips.rotation.x = -Math.PI / 2 * s; hips.position.y = HIP + (0.24 - HIP) * s;
        legL.rotation.set(0, 0, 0.05); legR.rotation.set(-0.35 * s, 0, -0.05);
        armL.rotation.set(-2.9 * s, 0, 0.35 * s); armR.rotation.set(-2.9 * s, 0, -0.35 * s); head.rotation.x = 0.15 * s;
        chest.scale.setScalar(1 + Math.sin(t * 1.1) * 0.025); break; }
    }
  }
  function animate(dt, { speed, running, pose, t, air, jumpV, slope = 0, tool = 1, dur = 0.9, carry = 1, rod = 0.4, face = null, lid = null, over = null, edur = 2 }) {
    if (model) tickEyes(dt, face, lid, pose);
    st.clock += dt; st.pick += ((pose === 'crouch' ? 1 : 0) - st.pick) * Math.min(1, dt * 14);
    const moving = speed > 0.1 && (pose === 'move' || pose === 'throw' || pose === 'bow' || pose === 'carry');
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
    head.rotation.set(0, 0, 0); hips.rotation.set(0, 0, 0); torso.rotation.z = 0;
    // 어깨: 팔과 같은 박자로 가슴이 반대쪽 다리와 엇갈려 돌고(골반은 반대로 조금), 머리는 앞을 보게 되돌림
    { const tw = s * amp; hips.rotation.y = tw * 0.12; torso.rotation.y = -tw * 0.3; head.rotation.y = tw * 0.18;
      torso.rotation.z = Math.cos(st.phase) * amp * 0.035; } // 걸음마다 어깨가 살짝 기우뚱
    // 비탈: 몸을 비탈 쪽으로 숙이고 다리 흔들림 중심을 비탈에 맞춤
    st.slope += (slope - st.slope) * Math.min(1, dt * 8);
    const sa = Math.atan(st.slope) * st.blend;
    torso.rotation.x += sa * 0.45; legL.rotation.x += sa * 0.55; legR.rotation.x += sa * 0.55;

    if (pose === 'throw') {
      const k = throwKey(t), f = Math.abs(k[5]) / 0.5, still = 1 - st.blend;
      armR.rotation.set(k[1], 0, k[2]); armL.rotation.set(k[3], 0, k[4]);
      torso.rotation.y += k[5]; torso.rotation.x += k[6]; hips.rotation.y -= k[5] * 0.25; head.rotation.y -= k[5] * 0.6;
      legL.rotation.x += -0.3 * f * still * Math.sign(k[5] || 1) * -1; legR.rotation.x += 0.25 * f * still * Math.sign(k[5] || 1) * -1; // 서 있을 땐 발도 딛고 무게를 옮김
    } else if (pose === 'bow') { // 귤 활 (#38): 왼팔로 활을 앞으로 들고 → 오른손으로 가슴까지 당김 → 놓으면 오른손이 튕겨 나감 → 내림
      const rel = BOW.release, tot = BOW.total;
      const up = t < tot - 0.16 ? sstep(0, 0.13, t) : 1 - sstep(tot - 0.16, tot, t);
      const draw = t < rel ? sstep(0.05, rel - 0.02, t) : Math.max(0, 1 - (t - rel) / 0.05);
      const snap = t >= rel ? Math.max(0, 1 - (t - rel) / 0.22) : 0;
      armL.rotation.set(-1.55 * up + armL.rotation.x * (1 - up), 0, 0.12 + 0.08 * up);
      armR.rotation.set((-1.45 + 0.5 * draw - 0.25 * snap) * up + armR.rotation.x * (1 - up), 0, (0.5 + 0.4 * draw - 0.3 * snap) * up - 0.12 * (1 - up));
      torso.rotation.y += -0.22 * up; torso.rotation.x += 0.04 * up; head.rotation.y += 0.2 * up;
    } else if (pose === 'fish') { // 낚시 (#44): 두 손으로 낚싯대를 쥠. rod = 낚싯대가 앞으로 들린 각(0 수평, 1.6 머리 위, 더 크면 뒤로 젖힘)
      const a = -0.75 - rod * 0.95;
      armR.rotation.set(a, 0, 0.32); armL.rotation.set(a * 0.82 + 0.1, 0, -0.38);
      torso.rotation.x += 0.08 - Math.max(0, rod - 1.2) * 0.12; head.rotation.x = -0.12;
    } else if (pose === 'carry') { // 들것 들기 (#36): carry +1 = 앞사람(손이 뒤로), -1 = 뒷사람(손이 앞으로)
      const a = carry > 0 ? 0.32 : -0.62;
      armL.rotation.set(a, 0, 0.2); armR.rotation.set(a, 0, -0.2);
      torso.rotation.x += carry > 0 ? 0.02 : 0.1;
    } else if (pose === 'wave') {
      armR.rotation.set(0, 0, -2.25 + Math.sin(t * 12) * 0.35);
      head.rotation.z = Math.sin(t * 3) * 0.08;
    } else if (pose === 'cheer') { // 더미를 다 치우고 기뻐함 (#65): 두 팔을 번쩍, 통통 두 번
      const k = Math.min(1, t * 7), hop = Math.abs(Math.sin(Math.min(t, 0.9) * Math.PI * 2.2)) * (1 - Math.min(1, t / 1.1));
      hips.position.y = HIP + hop * 0.16;
      armL.rotation.set(-2.7 * k + Math.sin(t * 14) * 0.18, 0, 0.45 * k); armR.rotation.set(-2.7 * k - Math.sin(t * 14) * 0.18, 0, -0.45 * k);
      legL.rotation.set(-hop * 0.4, 0, 0.06); legR.rotation.set(-hop * 0.4, 0, -0.06);
      head.rotation.x = -0.18 * k; torso.rotation.x = -0.06 * k;
    } else if (pose === 'sit') {
      hips.position.y = 0.5;
      legL.rotation.set(-1.45, 0, 0.08); legR.rotation.set(-1.45, 0, -0.08);
      armL.rotation.set(-0.3, 0, 0.25); armR.rotation.set(-0.3, 0, -0.25);
      torso.rotation.x = -0.08;
      chest.scale.setScalar(1 + Math.sin(t * 1.2) * 0.02);
    } else if (pose === 'board') { // 스케이트보드 (#69): 무릎을 살짝 굽히고 두 팔을 벌려 균형
      const w = Math.sin(st.clock * 2.2) * 0.06;
      hips.position.y = HIP - 0.06; legL.rotation.set(-0.22, 0, 0.12); legR.rotation.set(0.12, 0, -0.12);
      armL.rotation.set(-0.1, 0, 0.75 + w); armR.rotation.set(-0.1, 0, -0.75 + w);
      torso.rotation.x = 0.12; torso.rotation.z = w * 0.6;
    } else if (pose === 'scoot') { // 스쿠터 (#69): 두 손으로 손잡이, 한 발 앞
      hips.position.y = HIP - 0.03; legL.rotation.set(-0.12, 0, 0.04); legR.rotation.set(0.1, 0, -0.04);
      armL.rotation.set(-1.05, 0, 0.32); armR.rotation.set(-1.05, 0, -0.32);
      torso.rotation.x = 0.16;
    } else if (pose === 'ride') { // 조랑말 (#69): 다리를 벌려 걸터앉고 두 손은 고삐
      hips.position.y = 0.5;
      legL.rotation.set(-0.55, 0, 0.42); legR.rotation.set(-0.55, 0, -0.42);
      armL.rotation.set(-0.85, 0, 0.18); armR.rotation.set(-0.85, 0, -0.18);
      torso.rotation.x = 0.06 + Math.abs(Math.sin(st.clock * 6)) * 0.02 * Math.min(1, speed / 6);
    } else if (pose === 'photo') {
      armL.rotation.set(0, 0, 2.5); armR.rotation.set(0, 0, -2.5);
      legL.rotation.set(0, 0, 0.18); legR.rotation.set(0, 0, -0.18);
      head.rotation.z = 0.12;
    } else if (pose === 'photo-v') { // 사진 포즈 (#70): 오른손 브이를 얼굴 옆에, 왼손은 허리
      armR.rotation.set(-2.5, 0, -0.55); armL.rotation.set(0.1, 0, 0.75);
      legL.rotation.set(0, 0, 0.06); legR.rotation.set(-0.12, 0, -0.1);
      torso.rotation.z = -0.06; head.rotation.z = -0.16;
    } else if (pose === 'photo-point') { // 사진 포즈 (#70): 한 팔을 옆으로 쭉 뻗어 가리키고, 한 발 앞으로
      armL.rotation.set(-0.35, 0, 1.45); armR.rotation.set(0.15, 0, -0.35);
      legL.rotation.set(-0.3, 0, 0.12); legR.rotation.set(0.12, 0, -0.08);
      torso.rotation.y = 0.18; head.rotation.y = 0.25; head.rotation.x = -0.06;
    } else if (pose === 'crouch') {
      // 줍기: 도구 단계(tool 1~5)마다 동작이 다름. dur = 한 번 줍는 시간
      const u = Math.min(1, t / Math.max(0.1, dur)), k = Math.sin(u * Math.PI);
      if (tool <= 1) { // 맨손: 깊이 쪼그려 두 손으로
        torso.rotation.x = 0.9 * k; hips.position.y = HIP - 0.25 * k;
        legL.rotation.x = -0.6 * k; legR.rotation.x = -0.6 * k;
        armL.rotation.set(-1.4 * k, 0, 0.1); armR.rotation.set(-1.4 * k, 0, -0.1);
      } else if (tool === 2) { // 집게: 허리만 숙이고 오른손으로 집어 올림
        torso.rotation.x = 0.45 * k; hips.position.y = HIP - 0.08 * k;
        legL.rotation.x = -0.2 * k; legR.rotation.x = 0.1 * k;
        armR.rotation.set(-1.1 * k, 0, -0.1); armL.rotation.set(-0.2, 0, 0.15);
      } else if (tool <= 4) { // 갈퀴: 앞에서 몸 쪽으로 긁어 당김 (큰 갈퀴는 더 크게)
        const big = tool === 4 ? 1.25 : 1, sw = Math.sin(u * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5; // 0→1→0
        torso.rotation.x = (0.25 + 0.2 * k) * big; hips.position.y = HIP - 0.06 * k;
        legL.rotation.x = -0.35 * big; legR.rotation.x = 0.2;
        armR.rotation.set(-1.2 * big + sw * 0.8, 0, -0.12); armL.rotation.set(-1.0 * big + sw * 0.7, 0, 0.25);
        torso.rotation.y = -0.15 * k;
      } else { // 흡입기: 선 채로 앞을 겨누고 좌우로 훑음 (계속 누르는 동안 유지)
        const a = st.pick, w = Math.sin(st.clock * 9) * 0.25;
        torso.rotation.x = 0.2 * a; torso.rotation.y = w * 0.4 * a;
        armR.rotation.set(-0.9 * a, w * a, -0.1); armL.rotation.set(-0.8 * a, 0, 0.3 * a);
        legL.rotation.x = -0.15 * a; legR.rotation.x = 0.1 * a;
        chest.scale.setScalar(1 + Math.sin(st.clock * 40) * 0.006 * a);
      }
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
    } else if (pose === 'flail') { // 물에 빠져 허우적댐 (#41): 두 팔을 번갈아 휘젓고 다리를 버둥댐
      const b = st.clock * 11;
      armL.rotation.set(-2.3 + Math.sin(b) * 0.9, 0, 0.6 + Math.cos(b) * 0.35); armR.rotation.set(-2.3 - Math.sin(b) * 0.9, 0, -0.6 - Math.cos(b) * 0.35);
      legL.rotation.set(-0.5 + Math.sin(b * 0.8) * 0.5, 0, 0.12); legR.rotation.set(-0.5 - Math.sin(b * 0.8) * 0.5, 0, -0.12);
      torso.rotation.x = -0.15; torso.rotation.z = Math.sin(b * 0.5) * 0.12; hips.position.y = HIP;
      head.rotation.x = -0.25; head.rotation.z = Math.sin(b * 0.5 + 1) * 0.15;
    } else if (EMO_POSES.has(pose)) { emotePose(pose, t, false, edur);
    } else if (air) {
      const up = Math.max(-1, Math.min(1, (jumpV ?? 0) / 8.5));
      legL.rotation.set(-0.9 - up * 0.3, 0, 0.1); legR.rotation.set(0.5, 0, -0.1);
      armL.rotation.set(-0.6 - up * 0.8, 0, 0.5); armR.rotation.set(-0.6 - up * 0.8, 0, -0.5);
      torso.rotation.x = 0.1 + up * 0.1;
      hips.position.y = HIP;
    }
    if (over) emotePose(over.id, over.t, true, over.dur || 2);
    // 발이 비탈 아래로 들어가면 그만큼 골반을 올림 (앞발은 오르막에, 뒷발은 내리막에 걸림)
    if (!air && Math.abs(st.slope) > 0.01 && (pose === 'move' || pose === 'throw' || pose === 'bow' || pose === 'carry' || pose === 'fish')) {
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
  return { root, apply, animate, setTint, setPhase, setGear, eye: model ? eye : null };
}
