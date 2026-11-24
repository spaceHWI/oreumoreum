// 움직이지 않는 Tripo 소품 (#305): 망고 좌판·서바이벌 징·수거 관 투입구·망고. model/bake-case.py 로 줄이고 구워 src/model-case-<이름>[-lo].js (assets.js meta.lazy)
// - 받기·LOD 는 사건 모델(casemodels.js)과 같음: 임시 모양이 화면에 처음 그려지면 멀리용(-lo)을 받고, 카메라가 CASE_MODELS.near 안이면 큰 모델을 받고,
//   far 밖이면 멀리용을 그림. 큰 모델은 텍스처 그림이 올라간 뒤에 바꿈(#269). 첫 화면에 받는 양은 그대로
// - 임시 모양(ph): 받기 전에 보일 메시 (예전에 코드로 그린 모양을 그대로 넘기면 회색 상자가 보이지 않음). 없으면 받을 때까지 안 보임
// - morph(pos, M): 정점 위치(모델 좌표, Float32Array) → 모프 타깃 하나의 위치. 기본 모양 대신 쓰려면 base(pos, M) 도. 무게는 api.morph[0] (임시 모양과 같이 씀)
// 쓰는 법: const p = tripoProp('stall', { scale: 2.4, ph: mesh }); scene.add(p.root); p.root.position… (그 뒤로는 저절로)
import * as THREE from 'three';
import { LOW } from './gfx2.js';
import { CASE_MODELS as CM, NPC_LIGHT } from './balance.js';
import { unpackProp, propMaterial } from './propmodel.js';
import { whenAsset, want } from './assets.js';

const geoCache = new Map(), matCache = new Map(), tmpV = new THREE.Vector3();
let probeMat = null;
/* 받기 시작 문 (#304·#305): 첫 화면·들어오기 전엔 받지 않음. 게임 쪽(game/jigi.js)이 '들어온 뒤 몇 초' 를 알려 줌. 안 알려 주면 늘 열림 */
let gate = () => true;
export function setPropGate(fn) { gate = fn; }
function geoOf(asset, D, base, morph) {
  let g = geoCache.get(asset); if (g) return g;
  const { pos, nor, uv, idx } = unpackProp(D), p0 = base ? base(pos, D) : pos;
  g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p0, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  if (morph) { g.morphAttributes.position = [new THREE.BufferAttribute(morph(pos, D), 3)]; g.morphAttributes.normal = [new THREE.BufferAttribute(nor, 3)]; }
  g.computeBoundingSphere(); if (morph) g.boundingSphere.radius *= 1.4;
  geoCache.set(asset, g); return g;
}
const matOf = (asset, o) => { const k = asset + '|' + (o.glow ?? '') + '|' + (o.minLight ?? ''); let m = matCache.get(k); if (!m) { m = propMaterial(asset, o); matCache.set(k, m); } return m; };

export function tripoProp(name, { scale = 1, ph = null, shadow = true, glow, minLight = NPC_LIGHT.floor, base = null, morph = null, near = CM.near, far = CM.far } = {}) {
  const A = 'case-' + name, ALO = A + '-lo', root = new THREE.Group(); root.name = 'prop:' + name;
  const inner = new THREE.Group(); inner.scale.setScalar(scale); root.add(inner);
  const infl = [0], mo = { ...(glow != null ? { glow } : {}), minLight };
  let hi = null, lo = null, wantLo = false, wantHi = false, isFar = true, hiTex = false;
  if (ph) { root.add(ph); if (ph.morphTargetInfluences) ph.morphTargetInfluences = infl; }
  const pick = () => { const useHi = hi && !isFar && (hiTex || !lo); if (hi) hi.visible = !!useHi; if (lo) lo.visible = !useHi; if (ph) ph.visible = !hi && !lo; };
  const seen = (r, s, cam) => {
    if (!cam?.isPerspectiveCamera || !wantLo && !gate()) return;
    getLo(); root.getWorldPosition(tmpV); const d = tmpV.distanceTo(cam.position);
    if (hi && !hiTex && hi.material.map?.userData.ready) { hiTex = true; pick(); }
    if (d < near) getHi();
    const f = d > far; if (f !== isFar) { isFar = f; pick(); }
  };
  const mk = (asset, D) => {
    const m = new THREE.Mesh(geoOf(asset, D, base, morph), matOf(asset, mo)); m.onBeforeRender = seen;
    if (morph) m.morphTargetInfluences = infl;
    m.castShadow = shadow && !LOW; m.receiveShadow = !LOW; inner.add(m); return m;
  };
  function getLo() { if (wantLo) return; wantLo = true; whenAsset(ALO, (D) => { lo = mk(ALO, D); pick(); }, { lazy: true }); want(ALO); }
  function getHi() { if (wantHi) return; wantHi = true; whenAsset(A, (D) => { hi = mk(A, D); pick(); }, { lazy: true }); want(A); }
  if (ph) ph.traverse((o) => { if (o.isMesh && !o.onBeforeRender.__tp) { const prev = o.onBeforeRender; o.onBeforeRender = (...a) => { prev.apply(o, a); seen(...a); }; o.onBeforeRender.__tp = true; } });
  else { /* 임시 모양이 없으면 작은 빈 메시로 '보이기 시작' 을 앎 (그리는 것 없음: 0 삼각형) */
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0.5, 0, 0, 0.5, 0, 0, 0.5, 0]), 3)); pg.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.5, 0), 0.7);
    const probe = new THREE.Mesh(pg, probeMat || (probeMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }))); probe.onBeforeRender = seen; inner.add(probe);
  }
  return {
    name, root, inner, morph: infl,
    near: () => { getLo(); getHi(); isFar = false; pick(); }, /* 확인·장면용: 바로 큰 모델 */
    get loaded() { return { lo: !!lo, hi: !!hi, hiShown: !!hi?.visible }; },
    get mesh() { return (hi?.visible && hi) || (lo?.visible && lo) || null; },
  };
}
