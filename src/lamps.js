import * as THREE from 'three';
import { LIFE_MODELS } from './balance.js';
import { propGeometry, propMaterial } from './propmodel.js';
import { whenAsset } from './assets.js';
import { LOW } from './gfx2.js';

// 가로등 (#2 Tripo 모델 lamp.glb): 굵은 나무 기둥·현무암 받침, 굽은 팔에 귤 모양 등. 많이 놓이므로 한 번에 그림(InstancedMesh)
// 낮에는 꺼진 귤색, 밤에는 귤 등이 따뜻하게 빛남(텍스처 색 × 귤 부분 표시). 바닥 빛웅덩이는 가산 혼합 원판,
// 실제 광원(PointLight)은 가까운 3개에만 붙여 돌려 씀 (수십 개를 켜면 무거움). 모델을 받기 전엔 막대·공 임시 모양
// 모델 좌표(키 0.98): 기둥 가운데 (0.11, -0.026), 귤 등 가운데 (-0.215, 0.66, 0.0) 반지름 약 0.14 → 기둥을 원점에, 귤이 +z 쪽에 오게 돌림
const POST = [0.11, -0.026], BULB = [-0.215, 0.66, 0.0], BULB_R = 0.15;
export function createLamps({ scene, positions, height }) {
  const n = positions.length, S = LIFE_MODELS.lamp.scale;
  const off = (POST[0] - BULB[0]) * S, bulbY = BULB[1] * S, bulbR = BULB_R * S; // 기둥에서 귤 등까지(로컬 +z), 등 높이, 반지름
  // 받기 전 임시 모양: 기둥 · 팔 · 귤 공
  const post = new THREE.CylinderGeometry(0.12, 0.16, S * 0.9, 6); post.translate(0, S * 0.45, 0);
  const arm = new THREE.BoxGeometry(0.1, 0.1, off); arm.translate(0, S * 0.85, off / 2);
  const ball = new THREE.SphereGeometry(bulbR, 10, 8); ball.translate(0, bulbY, off);
  const dark = new THREE.MeshLambertMaterial({ color: '#5a4636', flatShading: true });
  const night = { value: 0 };
  const ballMat = new THREE.MeshLambertMaterial({ color: '#f0a050', emissive: '#ffb050', emissiveIntensity: 0 });
  const poolGeo = new THREE.PlaneGeometry(9, 9); poolGeo.rotateX(-Math.PI / 2);
  const poolTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(255,205,130,1)'); gr.addColorStop(0.45, 'rgba(255,185,105,0.45)'); gr.addColorStop(1, 'rgba(255,175,95,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  // 귤 등 둘레의 은은한 빛 (가산 혼합 공, 밤에만)
  const haloGeo = new THREE.SphereGeometry(bulbR * 1.7, 12, 8); haloGeo.translate(0, bulbY, off);
  const haloMat = new THREE.MeshBasicMaterial({ color: '#ff9a3c', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide });
  const mk = (geo, mat, shadow = false) => { const im = new THREE.InstancedMesh(geo, mat, n); im.name = 'lamp'; im.castShadow = shadow; scene.add(im); return im; };
  const tmp = [mk(post, dark, !LOW), mk(arm, dark), mk(ball, ballMat)];
  const pools = mk(poolGeo, poolMat), halos = mk(haloGeo, haloMat);
  pools.renderOrder = 2; halos.renderOrder = 3; halos.visible = false;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
  const pts = positions.map(([x, z]) => new THREE.Vector3(x, height(x, z), z));
  const mats = pts.map((p, i) => { e.set(0, positions[i][2] || 0, 0); q.setFromEuler(e); return new THREE.Matrix4().compose(p, q, one); });
  mats.forEach((mm, i) => {
    for (const im of [...tmp, halos]) im.setMatrixAt(i, mm);
    const ry = positions[i][2] || 0, pp = pts[i].clone(); pp.x += Math.sin(ry) * off; pp.z += Math.cos(ry) * off; pp.y = height(pp.x, pp.z) + 0.08;
    e.set(0, ry, 0); q.setFromEuler(e); m.compose(pp, q, one); pools.setMatrixAt(i, m);
  });
  // 진짜 모양: 모델을 돌려(귤이 +z) 기둥을 원점에 맞춤. 귤 부분 정점에 표시(glow 1)를 달아 밤에 그 부분만 빛나게
  whenAsset('lamp', (M) => {
    const g = propGeometry(M).clone();
    const fit = new THREE.Matrix4().makeRotationY(Math.PI / 2).multiply(new THREE.Matrix4().makeScale(S, S, S)).multiply(new THREE.Matrix4().makeTranslation(-POST[0], 0, -POST[1]));
    g.applyMatrix4(fit);
    const p = g.attributes.position, gl = new Float32Array(p.count), c = new THREE.Vector3((BULB[2] - POST[1]) * S, bulbY, off), v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { const d = v.fromBufferAttribute(p, i).distanceTo(c) / bulbR; gl[i] = d < 1.05 ? 1 : d < 1.2 ? (1.2 - d) / 0.15 : 0; }
    g.setAttribute('glow', new THREE.BufferAttribute(gl, 1)); g.computeBoundingSphere();
    const mat = propMaterial('lamp');
    const base = mat.onBeforeCompile;
    mat.onBeforeCompile = (sh) => {
      base(sh); sh.uniforms.lampNight = night;
      sh.vertexShader = 'attribute float glow;\nvarying float vGlow;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
      sh.fragmentShader = 'uniform float lampNight;\nvarying float vGlow;\n' + sh.fragmentShader.replace(/(totalEmissiveRadiance \*=[^\n]*|#include <emissivemap_fragment>)/, '$1\ntotalEmissiveRadiance += (diffuseColor.rgb * vec3(1.0, 0.62, 0.35) + vec3(0.16, 0.05, 0.0)) * vGlow * lampNight;');
    };
    mat.customProgramCacheKey = () => 'lampglow';
    const real = mk(g, mat, !LOW); real.receiveShadow = !LOW;
    mats.forEach((mm, i) => real.setMatrixAt(i, mm));
    real.computeBoundingSphere();
    for (const im of tmp) { scene.remove(im); im.dispose(); }
  });
  const lights = Array.from({ length: 3 }, () => { const l = new THREE.PointLight('#ffc27a', 0, 16, 2); l.visible = false; scene.add(l); return l; });
  function update(playerPos, nightK) {
    night.value = nightK * LIFE_MODELS.lamp.glow;
    ballMat.emissiveIntensity = nightK * 1.4; poolMat.opacity = nightK * 0.5;
    haloMat.opacity = nightK * 0.14; halos.visible = nightK > 0.02;
    // 빛 수가 바뀌면 모든 재질 셰이더를 다시 만들어 끊기므로(#79) 밤 동안은 3개를 늘 켜 두고 멀면 세기만 0
    const on = nightK >= 0.02 && pts.length > 0;
    if (!on) { lights.forEach((l) => { l.visible = false; }); return; }
    // 가까운 3개
    const near = pts.map((p, i) => [p.distanceToSquared(playerPos), i]).sort((a, b) => a[0] - b[0]).slice(0, 3);
    lights.forEach((l, k) => {
      l.visible = true;
      const hit = near[k]; if (!hit || hit[0] > 60 * 60) { l.intensity = 0; return; }
      const p = pts[hit[1]]; const ry = positions[hit[1]][2] || 0;
      l.position.set(p.x + Math.sin(ry) * off * 1.15, p.y + bulbY - bulbR - 0.35, p.z + Math.cos(ry) * off * 1.15); // 등 바로 아래 (등 안에 두면 등이 하얗게 타 버림)
      l.intensity = 26 * nightK; l.visible = true;
    });
  }
  return { update, points: pts };
}
