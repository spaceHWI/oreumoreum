// 발자국 (#21): 내 캐릭터가 걸을 때 왼발·오른발 자국을 땅 기울기에 맞춰 찍는다. InstancedMesh 하나, 최대 개수를 넘으면 오래된 것부터 덮어씀
// 탐방로·흙(surface != 0)은 또렷하게, 풀밭은 흐리게. 점프 중·탈것 위에서는 호출하지 않음 (main.js 쪽에서 막음)
import * as THREE from 'three';
import { FOOTPRINT as F } from './balance.js';

export function createFootprints({ scene, height, surfaceAt, low }) {
  const N = low ? F.maxLow : F.max;
  const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2); // 위를 보는 판 (앞 = +z)
  const aA = new THREE.InstancedBufferAttribute(new Float32Array(N), 1); aA.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aA', aA);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: { uCol: { value: new THREE.Color('#3a2d24') } },
    vertexShader: 'attribute float aA; varying float vA; varying vec2 vU; void main(){ vA = aA; vU = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 uCol; varying float vA; varying vec2 vU; void main(){ vec2 p = (vU - 0.5) * 2.0; float d = dot(p, p); float a = vA * (1.0 - smoothstep(0.55, 1.0, d)); if (a < 0.01) discard; gl_FragColor = vec4(uCol, a); }',
  });
  const im = new THREE.InstancedMesh(geo, mat, N); im.frustumCulled = false; im.renderOrder = 2; im.count = N;
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < N; i++) im.setMatrixAt(i, zero);
  scene.add(im);
  const age = new Float32Array(N).fill(1e9), base = new Float32Array(N);
  let head = 0, side = 1, dirty = false;
  const m = new THREE.Matrix4(), nrm = new THREE.Vector3(), fwd = new THREE.Vector3(), rgt = new THREE.Vector3(), pos = new THREE.Vector3();

  // 한 걸음 찍기: x,z 는 캐릭터 위치, heading 은 바라보는 각, gait 0 걷기·1 달리기·2 질주
  function stamp(x, z, heading, gait) {
    side = -side;
    const sx = Math.sin(heading), cz = Math.cos(heading);
    const px = x + cz * F.side * side, pz = z - sx * F.side * side; // 앞(sx,cz)의 오른쪽 = (cz,-sx)
    const e = 0.4, hy = height(px, pz);
    nrm.set(height(px - e, pz) - height(px + e, pz), 2 * e, height(px, pz - e) - height(px, pz + e)).normalize();
    fwd.set(sx, 0, cz); fwd.addScaledVector(nrm, -fwd.dot(nrm)).normalize(); rgt.crossVectors(nrm, fwd);
    pos.set(px, hy + 0.05, pz);
    const k = gait === 2 ? 1.12 : gait === 1 ? 1.05 : 1;
    m.makeBasis(rgt.multiplyScalar(F.size[0] * k), nrm, fwd.multiplyScalar(F.size[1] * k)).setPosition(pos);
    im.setMatrixAt(head, m); im.instanceMatrix.needsUpdate = true;
    const onPath = surfaceAt(px, pz) !== 0;
    base[head] = (onPath ? F.alpha.path : F.alpha.grass) * (gait === 2 ? F.boost.sprint : gait === 1 ? F.boost.run : F.boost.walk);
    age[head] = 0; aA.array[head] = base[head]; dirty = true;
    head = (head + 1) % N;
  }

  function update(dt) {
    if (!dirty) return;
    let any = false;
    for (let i = 0; i < N; i++) {
      if (age[i] >= F.life) continue;
      age[i] += dt;
      if (age[i] >= F.life) { aA.array[i] = 0; im.setMatrixAt(i, zero); im.instanceMatrix.needsUpdate = true; continue; }
      any = true;
      const t = age[i] / F.life; // 앞 40% 는 그대로, 뒤 60% 동안 서서히
      aA.array[i] = base[i] * (t < 0.4 ? 1 : 1 - (t - 0.4) / 0.6);
    }
    aA.needsUpdate = true; if (!any) dirty = false;
  }
  function clear() { age.fill(1e9); aA.array.fill(0); for (let i = 0; i < N; i++) im.setMatrixAt(i, zero); im.instanceMatrix.needsUpdate = true; aA.needsUpdate = true; dirty = false; }
  return { im, stamp, update, clear, max: N, live: () => age.reduce((c, a) => c + (a < F.life ? 1 : 0), 0) };
}
