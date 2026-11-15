import * as THREE from 'three';
function gradTex(vals, filter) {
  const d = new Uint8Array(vals.length * 4); vals.forEach((v, i) => { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; });
  const t = new THREE.DataTexture(d, vals.length, 1, THREE.RGBAFormat); t.magFilter = t.minFilter = filter; t.needsUpdate = true; return t;
}
export const gradHard = gradTex([105, 105, 205, 255], THREE.NearestFilter); // 나무·바위·캐릭터: 또렷한 3단
export const gradSoft = gradTex([120, 150, 215, 255], THREE.LinearFilter); // 땅·풀: 부드러운 경계
