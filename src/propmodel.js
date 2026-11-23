// Tripo 모델 풀기 (#71): model/extract-prop.js 가 만든 { n, min, max, pos, nor, uv, idx, tex } → BufferGeometry · 툰 재질
// 들개·외계인(enemymodels.js)과 가게 건물 셋(stone.js · salon.js · leap.js)이 씀. 모델 좌표: 바닥 y=0, 앞 = +z, 크기 약 1
// #85: 모델 자료는 따로 받는다(assets.js). 이름('stone' 등)으로 부르고, 받기 전에는 임시 상자를 보였다가 오면 갈아 끼움
import * as THREE from 'three';
import { NSMODE, TEXCS } from './boot.js';
import { gradHard } from './toon.js';
import { NPC_LIGHT } from './balance.js';
import { bytesAs as b64, whenAsset, lazyTexture, placeholderGeo, placeholderMat } from './assets.js';

// 정점 자료(위치 Float32Array, 법선, uv, 인덱스)를 풀어 줌. 뼈 가중치를 붙일 때 위치가 필요해서 따로
export function unpackProp(M) {
  const pq = b64(M.pos, Uint16Array), nq = b64(M.nor, Int8Array), uq = b64(M.uv, Uint16Array), idx = b64(M.idx, Uint16Array);
  const pos = new Float32Array(pq.length); for (let i = 0; i < pq.length; i++) { const c = i % 3; pos[i] = M.min[c] + (pq[i] / 65535) * (M.max[c] - M.min[c]); }
  const nor = new Float32Array(nq.length); for (let i = 0; i < nq.length; i++) nor[i] = nq[i] / 127;
  const uv = new Float32Array(uq.length); for (let i = 0; i < uq.length; i++) uv[i] = uq[i] / 65535;
  return { pos, nor, uv, idx };
}
const geoCache = new Map();
export function propGeometry(M) { // M: 받은 자료 (whenAsset 콜백에서)
  let g = geoCache.get(M); if (g) return g;
  const { pos, nor, uv, idx } = unpackProp(M);
  g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere(); geoCache.set(M, g); return g;
}
const texCache = new Map();
export function propTexture(name) {
  let t = texCache.get(name); if (t) return t;
  t = lazyTexture(name, (t) => { t.colorSpace = TEXCS; t.flipY = false; t.anisotropy = 4; });
  texCache.set(name, t); return t;
}
// 멧돼지(boar.js)와 같은 재질: 남송이는 3단 툰 + 텍스처 색에 비례한 자체 빛(밤에 덜 뭉개짐), 다른 곳은 램버트
// opts: glow(자체 빛 세기), color(곱할 색), clip(true 면 uniforms.cutY 위를 잘라냄: 미장원 안을 위에서 볼 때), minLight(가장 어두운 비율, #269 NPC_LIGHT.floor)
export function propMaterial(name, opts = {}) {
  const map = propTexture(name), glow = opts.glow ?? 0.16;
  const mat = NSMODE ? new THREE.MeshToonMaterial({ map, gradientMap: gradHard, color: opts.color || '#ffffff', emissive: '#ffffff', emissiveIntensity: glow })
    : new THREE.MeshLambertMaterial({ map, color: opts.color || '#e4e4e4', emissive: '#ffffff', emissiveIntensity: glow * 2 });
  const cut = { value: 1e9 }, minL = { value: opts.minLight ?? 0 }, on = map.userData.texOn, wait = new THREE.Color(NPC_LIGHT.wait).convertSRGBToLinear(), v3 = (c) => `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
  mat.onBeforeCompile = (sh) => {
    /* #269: 텍스처 그림이 오기 전(texOn 0)엔 회색 (안 올라간 텍스처는 검게 읽힘). opts.minLight 를 주면(NPC·생물) 밤·그림자에서도 텍스처 색 × floor 보다 어둡지 않게 (건물은 0) */
    sh.uniforms.texOn = on; sh.uniforms.npcFloor = minL;
    sh.fragmentShader = 'uniform float texOn, npcFloor;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>\ndiffuseColor.rgb = mix(${v3(wait)} * diffuse, diffuseColor.rgb, texOn);`)
      .replace('#include <opaque_fragment>', `outgoingLight = max(outgoingLight, diffuseColor.rgb * npcFloor);\n#include <opaque_fragment>`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance *= diffuseColor.rgb / max(diffuse, vec3(0.001));');
    if (opts.clip) {
      sh.uniforms.cutY = cut;
      sh.vertexShader = 'varying float vMY;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvMY = position.y;');
      sh.fragmentShader = 'uniform float cutY;\nvarying float vMY;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\nif (vMY > cutY) discard;');
    }
  };
  if (opts.clip) { mat.side = THREE.DoubleSide; mat.customProgramCacheKey = () => 'propclip'; }
  mat.userData.cut = cut; mat.userData.texOn = on;
  return mat;
}
// 건물 하나: 모델을 s 배로 키우고 바닥(floor, 모델 좌표 y)이 로컬 y=0 에 오게 내림
// 받기 전에는 같은 크기의 임시 상자 + 회색 재질. mesh.userData.real 이 진짜 재질 (salon.js 가 cut 을 씀)
export function propMesh(name, s, { floor = 0, low = false, ...opts } = {}) {
  const real = propMaterial(name, opts);
  const mesh = new THREE.Mesh(placeholderGeo(name, 'box'), placeholderMat('#8f918c'));
  mesh.userData.real = real;
  whenAsset(name, (M) => { mesh.geometry.dispose(); mesh.geometry = propGeometry(M); mesh.material = real; });
  mesh.scale.setScalar(s); mesh.position.y = -floor * s; mesh.castShadow = !low; mesh.receiveShadow = !low;
  return mesh;
}

// 밤에 켜지는 빛 점 (전구·발사구): 더하기 섞기 스프라이트 하나 재질을 같이 씀
let glowTex = null;
export function glowSprite(color, size) {
  if (!glowTex) { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); glowTex = new THREE.CanvasTexture(c); }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(size); return s;
}

// SVG 문자열 → 캔버스 텍스처 (간판 글자). 그려지기 전엔 투명
export function svgTexture(svg, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const img = new Image(); img.onload = () => { c.getContext('2d').drawImage(img, 0, 0, w, h); t.needsUpdate = true; };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  return t;
}
