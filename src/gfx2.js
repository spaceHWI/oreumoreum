import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const LOW = typeof navigator !== 'undefined' && !/[?&]hi/.test(location.search) && ((navigator.hardwareConcurrency || 8) <= 4 || /Android|iPhone|iPad/.test(navigator.userAgent));
const C = (h) => new THREE.Color(h);
const U = (v) => ({ value: v });

// ---------- 시간대별 분위기 (시안 값 그대로): 낮·노을은 자연스럽게, 새벽·밤은 청록빛 ----------
const MOODS = {
  day: { zenith: '#5aa6e6', horizon: '#d8ecf2', sun: '#fff3d0', fogK: 1, amb: '#bcd9ff', ground: '#cfe6a8', sunI: 2.1, hemiI: 1.05,
    grassA: '#3f8f3c', grassB: '#9ccf58', leafA: '#256e44', leafB: '#8fcf5a', eok: '#fff6dc', cloud: '#ffffff', cloudSh: '#c9dcf2', sat: 1.12, warm: [1.02, 1.0, 0.97], glow: 0.25, terr: [1, 1, 1], dim: 1, mote: '#fff6dc' },
  sunset: { zenith: '#4a5fa8', horizon: '#ffc48a', sun: '#ff9a4a', fogK: 0.85, amb: '#b7a4d8', ground: '#e8a46a', sunI: 2.2, hemiI: 1.1,
    grassA: '#55793c', grassB: '#c9b25a', leafA: '#3c5f44', leafB: '#c9a455', eok: '#ffe2a8', cloud: '#ffd9b8', cloudSh: '#c48aa8', sat: 1.18, warm: [1.08, 0.98, 0.9], glow: 0.55, terr: [1.05, 0.92, 0.8], dim: 0.95, mote: '#ffe2a8' },
  dawn: { zenith: '#3a4a9a', horizon: '#ffb9c4', sun: '#ffd0b0', fogK: 0.7, amb: '#b0a6e6', ground: '#3a5a66', sunI: 1.5, hemiI: 1.25,
    grassA: '#2a6a70', grassB: '#7fd0b4', leafA: '#24506a', leafB: '#7fc0c0', eok: '#ffe6ee', cloud: '#ffc9d6', cloudSh: '#8a7ac8', sat: 1.15, warm: [1.02, 0.98, 1.06], glow: 1.3, terr: [0.55, 0.8, 1.15], dim: 0.85, mote: '#ffe0ea' },
  night: { zenith: '#070b26', horizon: '#27407a', sun: '#bcd0ff', fogK: 0.8, amb: '#5f74c0', ground: '#182838', sunI: 1.1, hemiI: 0.85,
    grassA: '#1c4a52', grassB: '#3f9a8a', leafA: '#14303c', leafB: '#3a7f88', eok: '#e6fbff', cloud: '#6a7ab0', cloudSh: '#2a3560', sat: 1.15, warm: [0.94, 1.0, 1.12], glow: 1.5, terr: [0.5, 0.78, 1.0], dim: 0.55, mote: '#f4ff9a' },
};
const COLS = ['zenith', 'horizon', 'sun', 'amb', 'ground', 'grassA', 'grassB', 'leafA', 'leafB', 'eok', 'cloud', 'cloudSh', 'mote'];
const NUMS = ['fogK', 'sunI', 'hemiI', 'sat', 'glow', 'dim'];
Object.values(MOODS).forEach((m) => { COLS.forEach((k) => { m[k] = C(m[k]); }); m.warm = new THREE.Vector3(...m.warm); m.terr = new THREE.Vector3(...m.terr); });
export const M = { warm: new THREE.Vector3(), terr: new THREE.Vector3() }; COLS.forEach((k) => { M[k] = C('#fff'); });
// k: 낮 정도(0 밤~1 낮), g: 해가 지평선 근처인 정도, dawn: 아침이면 1
export function blendMood(k, g, dawn) {
  const a = MOODS.night, b = MOODS.day, c = dawn ? MOODS.dawn : MOODS.sunset;
  COLS.forEach((key) => { M[key].copy(a[key]).lerp(b[key], k).lerp(c[key], g); });
  NUMS.forEach((key) => { M[key] = (a[key] + (b[key] - a[key]) * k) * (1 - g) + c[key] * g; });
  M.warm.copy(a.warm).lerp(b.warm, k).lerp(c.warm, g); M.terr.copy(a.terr).lerp(b.terr, k).lerp(c.terr, g);
  G.sunC.value.copy(M.sun); G.fogC.value.copy(M.horizon); G.leafA.value.copy(M.leafA); G.leafB.value.copy(M.leafB);
  G.cedarA.value.copy(M.leafA).multiplyScalar(0.6); G.cedarB.value.copy(M.leafB).lerp(M.leafA, 0.6);
  G.leaf2A.value.copy(M.leafA).lerp(tmpA.set('#2a6a5a'), 0.3 * k); G.leaf2B.value.copy(M.leafB).lerp(tmpA.set('#e8e07a'), 0.25 * k);
  G.cloudA.value.copy(M.cloudSh); G.cloudB.value.copy(M.cloud); G.grassA.value.copy(M.grassA); G.grassB.value.copy(M.grassB); G.tipC.value.copy(M.eok);
  G.eokA.value.copy(M.grassA).lerp(tmpA.set('#c9b070'), 0.5); G.eokB.value.copy(M.grassB).lerp(tmpA.set('#e8d090'), 0.5);
  G.seaA.value.copy(M.zenith).lerp(M.horizon, 0.35); G.terr.value.copy(M.terr); G.dim.value = M.dim; G.night.value = 1 - k;
  return M;
}
const tmpA = new THREE.Color();
export const PW = typeof location !== 'undefined' && !/[?&]blades/.test(location.search); // 시안: 붓질한 듯한 풀밭 + 드문드문 꽃 (풀잎 거의 없음)
export const G = {
  paint: U(PW ? 1 : 0),
  uT: U(0), sunD: U(new THREE.Vector3(0.4, 0.7, 0.4)), sunC: U(C('#fff3d0')), fogC: U(C('#d8ecf2')), fogN: U(220), fogF: U(2600),
  grassA: U(C('#3f8f3c')), grassB: U(C('#9ccf58')), tipC: U(C('#fff6dc')), eokA: U(C('#849f56')), eokB: U(C('#c2cf74')),
  leafA: U(C('#256e44')), leafB: U(C('#8fcf5a')), leaf2A: U(C('#256e44')), leaf2B: U(C('#8fcf5a')), cedarA: U(C('#164228')), cedarB: U(C('#4f9450')),
  cloudA: U(C('#c9dcf2')), cloudB: U(C('#ffffff')), seaA: U(C('#86bfe8')), terr: U(new THREE.Vector3(1, 1, 1)), dim: U(1), one: U(1),
  uP: U(new THREE.Vector3(0, 0, 1e6)), night: U(0),
};
const END = '\n#include <tonemapping_fragment>\n#include <colorspace_fragment>';
const FOGF = 'float fogF = clamp((length(vW - cameraPosition) - fogN) / (fogF - fogN), 0.0, 1.0); fogF = fogF * (2.0 - fogF);';

// 부드러운 툰 재질 (나무·구름·바위). a/b는 색 문자열이거나 G의 공용 색(시간대에 따라 바뀜)
export function softMat({ a, b, wind = 0, rim = 0.35, fog = 1 }) {
  const shared = !!a.value;
  return new THREE.ShaderMaterial({ fog: false,
    uniforms: { cA: shared ? a : U(C(a)), cB: shared ? b : U(C(b)), sunD: G.sunD, sunC: G.sunC, fogC: G.fogC, fogN: G.fogN, fogF: G.fogF, uT: G.uT, wind: U(wind), rim: U(rim), fogK: U(fog), dim: shared ? G.one : G.dim },
    vertexShader: `varying vec3 vN; varying vec3 vW; varying vec3 vC; uniform float uT, wind;
      void main(){ vec4 p = vec4(position, 1.0); vec3 n = normal; vC = vec3(1.0);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
        #endif
        #ifdef USE_INSTANCING_COLOR
          vC = instanceColor;
        #endif
        vec4 w = modelMatrix * p; w.x += sin(uT * 1.3 + w.x * 0.2 + w.y) * wind * max(position.y - 2.0, 0.0) * 0.03;
        vN = normalize(mat3(modelMatrix) * n); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vW; varying vec3 vC; uniform vec3 cA, cB, sunD, sunC, fogC; uniform float fogN, fogF, rim, fogK, dim;
      void main(){ vec3 n = normalize(vN); float l = smoothstep(0.25, 0.85, dot(n, sunD) * 0.5 + 0.5); float up = n.y * 0.5 + 0.5;
        vec3 c = mix(cA, cB, clamp(l * 0.75 + up * 0.35, 0.0, 1.0)) * vC * dim;
        c += sunC * pow(l, 3.0) * rim * 0.35 * dim; c *= 0.8 + 0.2 * max(dot(n, normalize(cameraPosition - vW)), 0.0);
        ${FOGF} gl_FragColor = vec4(mix(c, fogC, fogF * fogK), 1.0);
        ${END} }` });
}
export function roundNormals(g) { const p = g.attributes.position, n = p.clone(); for (let j = 0; j < n.count; j++) { const l = Math.hypot(n.getX(j), n.getY(j), n.getZ(j)) || 1; n.setXYZ(j, n.getX(j) / l, n.getY(j) / l, n.getZ(j) / l); } g.setAttribute('normal', n); return g; }
// 뭉게 수관: 작은 공 여러 개
export function fluffyGeo(n, spread, r0, y0 = 4.2, seed = 1, detail = 1) {
  let s = seed * 7919; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const parts = []; for (let i = 0; i < n; i++) { const g = roundNormals(new THREE.IcosahedronGeometry(r0 * (0.7 + rnd() * 0.5), detail)); const a = rnd() * 6.28, rr = rnd() * spread; g.translate(Math.cos(a) * rr, y0 + rnd() * 2.0 - rr * 0.35, Math.sin(a) * rr); parts.push(g); }
  return mergeGeometries(parts);
}
// 삼나무: 원뿔 여러 층
export function cedarGeo(layers = 4, r = 1.7, h = 3.6, step = 2.0, y0 = 2.6) {
  return mergeGeometries(Array.from({ length: layers }, (_, i) => { const g = new THREE.ConeGeometry(r - i * (r * 0.21), h, 8, 1, true); g.translate(0, y0 + i * step, 0); return g; }));
}

// 하늘: 지평선→천정 그라데이션 + 해 주변 빛
export function skyDome(scene) {
  const u = { zen: U(C('#5aa6e6')), hor: U(C('#d8ecf2')), sunD: U(new THREE.Vector3(0, 1, 0)), sunC: U(C('#fff3d0')), glow: U(1) };
  const m = new THREE.Mesh(new THREE.SphereGeometry(7800, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: u,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vD; uniform vec3 zen, hor, sunD, sunC; uniform float glow;
      void main(){ vec3 d = normalize(vD); float t = clamp(d.y, 0.0, 1.0);
        vec3 c = mix(hor, zen, pow(t, 0.55));
        float s = max(dot(d, sunD), 0.0); c += sunC * (pow(s, 6.0) * 0.28 + pow(s, 40.0) * 0.5) * glow;
        c = mix(c, hor, smoothstep(0.0, -0.08, d.y));
        gl_FragColor = vec4(c, 1.0); ${END} }` }));
  m.renderOrder = -10; scene.add(m);
  return u;
}

// 지형: 시간대 색조 + 흐르는 구름 그림자
export function cloudShadow(mat) {
  mat.onBeforeCompile = (sh) => { sh.uniforms.uT = G.uT; sh.uniforms.gNight = G.night; sh.uniforms.gTerr = G.terr; sh.uniforms.gPaint = G.paint;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWp; uniform float uT, gNight, gPaint; uniform vec3 gTerr;
      float ch(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float cn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(ch(i), ch(i + vec2(1, 0)), f.x), mix(ch(i + vec2(0, 1)), ch(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      float cs = smoothstep(0.48, 0.72, cn(vWp.xz * 0.006 + vec2(uT * 0.016, uT * 0.006)) * 0.65 + cn(vWp.xz * 0.017 - uT * 0.008) * 0.35);
      diffuseColor.rgb *= gTerr * mix(1.0, 0.74, cs * (1.0 - gNight * 0.6));
      if (gPaint > 0.5) { vec2 q = vWp.xz + vec2(cn(vWp.xz * 0.21), cn(vWp.zx * 0.19 + 3.0)) * 2.4;
        float m = cn(q * 0.3) * 0.34 + cn(q * 0.95 + 7.0) * 0.3 + cn(vec2(q.x * 2.2 + q.y * 0.9, q.y * 6.5)) * 0.22 + cn(q * 5.5) * 0.14;
        float st = smoothstep(0.34, 0.46, m) * 0.4 + smoothstep(0.5, 0.58, m) * 0.35 + smoothstep(0.62, 0.7, m) * 0.25;
        float dk = 1.0 - smoothstep(60.0, 260.0, length(vWp - cameraPosition)) * 0.6;
        dk *= 0.35 + 0.65 * smoothstep(0.0, 0.06, diffuseColor.g - max(diffuseColor.r, diffuseColor.b));
        diffuseColor.rgb *= 1.0 + (st - 0.45) * 0.42 * dk; diffuseColor.rgb += vec3(0.045, 0.055, -0.015) * (st - 0.45) * dk; }`); };
  mat.needsUpdate = true; return mat;
}

// 바다: 수평선으로 옅어지고 해 쪽으로 반짝임
export function seaMat() {
  return new THREE.ShaderMaterial({ fog: false, uniforms: { uT: G.uT, cA: G.seaA, fogC: G.fogC, sunC: G.sunC, sunD: G.sunD },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `varying vec3 vW; uniform vec3 cA, fogC, sunC, sunD; uniform float uT;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){ float d = length(vW.xz - cameraPosition.xz); vec3 c = mix(cA, fogC, smoothstep(1400.0, 5200.0, d));
        vec2 g = floor(vW.xz / vec2(26.0, 9.0) + vec2(uT * 0.25, 0.0)); float tw = step(0.93, h(g)) * (0.5 + 0.5 * sin(uT * 3.0 + h(g + 3.0) * 6.28));
        vec3 dir = normalize(vW - cameraPosition); float facing = pow(max(dot(normalize(vec3(dir.x, 0.0, dir.z)), normalize(vec3(sunD.x, 0.0001, sunD.z))), 0.0), 3.0);
        c += sunC * tw * (0.12 + facing * 0.5) * (1.0 - smoothstep(1200.0, 4400.0, d));
        gl_FragColor = vec4(c, 1.0); ${END} }` });
}

// ---------- 풀·억새 날 ----------
const bladeVS = `attribute vec3 aOff; attribute vec4 aPar; attribute vec4 aCol; uniform float uT, uR; uniform vec3 uP; uniform vec2 uC; varying float vY; varying vec4 vCol; varying vec3 vW; varying float vG; varying float vSide;
  void main(){ float y = position.y; vY = y; vCol = aCol;
    float dC = length(aOff.xz - uP.xz); float fade = 1.0 - smoothstep(uR * 0.72, uR, length(aOff.xz - uC));
    float wdt = aPar.z * (1.0 - y * y * 0.9); float c = cos(aPar.x), s = sin(aPar.x); float hh = aPar.y * fade;
    vec3 p = vec3(position.x * wdt * c, y * hh, position.x * wdt * s);
    float ph = aOff.x * 0.16 + aOff.z * 0.12 + aPar.w * 1.5;
    float sway = (sin(uT * 1.6 + ph) * 0.6 + sin(uT * 3.7 + ph * 2.3) * 0.25) * y * y * hh * 0.28;
    float gust = sin(uT * 0.5 + aOff.x * 0.03 - aOff.z * 0.02) * 0.5 + 0.5;
    float band = smoothstep(0.55, 0.95, sin(aOff.x * 0.045 + aOff.z * 0.03 - uT * 0.9) * 0.5 + 0.5);
    p.x += sway * (0.6 + gust) + band * y * y * hh * 0.22; p.z += sway * 0.5; p.y -= abs(sway) * 0.25; vG = band * y;
    vec2 dp = aOff.xz - uP.xz; float push = (1.0 - smoothstep(0.3, 1.7, dC)) * y * step(abs(aOff.y - uP.y), 3.0); p.xz += (dC > 0.001 ? dp / dC : vec2(0.0)) * push * 0.55 * hh; p.y -= push * 0.3 * hh;
    vec3 w = aOff + p; vW = w; vSide = c; gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`;
const bladeFS = `uniform vec3 cA, cB, tipC, sunC, fogC, gTerr; uniform float fogN, fogF, tipAt, groundK, dim; varying float vY; varying vec4 vCol; varying vec3 vW; varying float vG; varying float vSide;
  void main(){ vec3 base = mix(cA, cB, smoothstep(0.2, 0.9, vCol.a)); base = mix(base, vCol.rgb * gTerr * 1.5, groundK);
    vec3 c = mix(base * 0.5, base * 1.05, vY); c = mix(c, tipC, smoothstep(tipAt, 1.0, vY) * 0.85); c *= 0.9 + fract(vCol.a * 7.0) * 0.25;
    c += sunC * 0.1 * vY * (0.5 + 0.5 * vSide) * dim; c += vec3(0.09) * vG * dim;
    ${FOGF} gl_FragColor = vec4(mix(c, fogC, fogF), 1.0);
    ${END} }`;
const hash2 = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
const vn = (x, z) => { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi; const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf); const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
const bladeMat = ({ radius, cA, cB, tipC = G.tipC, tipAt = 0.5, groundK = 0, dim = G.one }) => new THREE.ShaderMaterial({ side: THREE.DoubleSide, fog: false, uniforms: { uT: G.uT, uP: G.uP, uC: U(new THREE.Vector2()), uR: U(radius), cA, cB, tipC, tipAt: U(tipAt), groundK: U(groundK), gTerr: G.terr, dim, sunC: G.sunC, fogC: G.fogC, fogN: G.fogN, fogF: G.fogF }, vertexShader: bladeVS, fragmentShader: bladeFS });
function bladeMesh(base, mat, off, par, col, n) {
  const ig = new THREE.InstancedBufferGeometry(); ig.index = base.index; ig.setAttribute('position', base.attributes.position);
  ig.setAttribute('aOff', new THREE.InstancedBufferAttribute(new Float32Array(off), 3)); ig.setAttribute('aPar', new THREE.InstancedBufferAttribute(new Float32Array(par), 4)); ig.setAttribute('aCol', new THREE.InstancedBufferAttribute(new Float32Array(col), 4)); ig.instanceCount = n;
  const m = new THREE.Mesh(ig, mat); m.frustumCulled = false; return m;
}
// 플레이어 주변에만 칸 단위로 심고 따라다니는 풀
function layer({ scene, height, canGrow, colorAt, cell, radius, per, w, hMin, hMax, segs }) {
  const base = new THREE.PlaneGeometry(1, 1, 1, segs); base.translate(0, 0.5, 0);
  const mat = bladeMat({ radius, cA: G.grassA, cB: G.grassB, tipC: G.grassB, tipAt: 0.55, groundK: 0.3 });
  const cells = new Map(); const queue = []; const col = new THREE.Color();
  function build(cx, cz) {
    let s = (cx * 73856093) ^ (cz * 19349663); s = (s >>> 0) % 2147483646 + 1; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const off = [], par = [], cols = []; let n = 0;
    for (let i = 0; i < per; i++) { const x = (cx + rnd()) * cell, z = (cz + rnd()) * cell; const r1 = rnd(), r2 = rnd(), r3 = rnd(), r4 = rnd(); const g = canGrow(x, z); if (g <= 0 || r4 > g) continue;
      off.push(x, height(x, z), z); par.push(r1 * 6.28, hMin + r2 * (hMax - hMin), w * (0.7 + r3 * 0.6), r4); colorAt(x, z, col); cols.push(col.r, col.g, col.b, vn(x * 0.11, z * 0.11) * 0.75 + r1 * 0.25); n++; }
    if (!n) return null;
    const m = bladeMesh(base, mat, off, par, cols, n); scene.add(m); return m;
  }
  function update(px, pz, budget) {
    mat.uniforms.uC.value.set(px, pz);
    const pcx = Math.floor(px / cell), pcz = Math.floor(pz / cell), R = Math.ceil(radius / cell);
    for (const [k, m] of cells) { const [cx, cz] = k.split(',').map(Number); if (Math.hypot((cx + 0.5) * cell - px, (cz + 0.5) * cell - pz) > radius + cell * 1.5) { if (m) { scene.remove(m); m.geometry.dispose(); } cells.delete(k); } }
    queue.length = 0;
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) { const cx = pcx + dx, cz = pcz + dz; const d = Math.hypot((cx + 0.5) * cell - px, (cz + 0.5) * cell - pz); if (d > radius + cell * 0.5) continue; const k = cx + ',' + cz; if (!cells.has(k)) queue.push([d, cx, cz, k]); }
    queue.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < Math.min(budget, queue.length); i++) { const [, cx, cz, k] = queue[i]; cells.set(k, build(cx, cz)); }
  }
  const setVisible = (v) => { for (const m of cells.values()) if (m) m.visible = v; };
  return { update, setVisible };
}
export function createGrass({ scene, height, canGrow, colorAt, low }) {
  const q = (low ? 0.45 : 1) * (PW ? 0 : 1);
  const near = layer({ scene, height, canGrow, colorAt, cell: 10, radius: low ? 24 : 32, per: Math.round(1500 * q), w: 0.065, hMin: 0.32, hMax: 0.82, segs: 3 });
  const far = layer({ scene, height, canGrow, colorAt, cell: 24, radius: low ? 60 : 96, per: Math.round(900 * q), w: 0.16, hMin: 0.36, hMax: 0.88, segs: 2 });
  let on = true, first = true;
  return {
    // 카메라 쪽으로 중심을 조금 당겨서 화면에 보이는 곳 위주로 심음
    update(pos, cam) { if (!on) return; const fx = pos.x + (pos.x - cam.x) * 0.6, fz = pos.z + (pos.z - cam.z) * 0.6; near.update(pos.x + (pos.x - cam.x) * 0.35, pos.z + (pos.z - cam.z) * 0.35, first ? 99 : 2); far.update(fx, fz, first ? 99 : 1); first = false; },
    set(v) { on = v; near.setVisible(v); far.setVisible(v); },
  };
}
// 억새: 길고 끝이 크림색인 날을 정해진 자리에 한 번에 심음
export function createEoksae({ scene, list, height }) {
  const base = new THREE.PlaneGeometry(1, 1, 1, 2); base.translate(0, 0.5, 0);
  const mat = bladeMat({ radius: 1e6, cA: G.eokA, cB: G.eokB, tipAt: 0.5 });
  const off = [], par = [], cols = []; let s = 11; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  list.forEach(([x, z, hgt]) => { off.push(x, height(x, z), z); const r = rnd(); par.push(r * 6.28, hgt, 0.085 + rnd() * 0.05, rnd()); cols.push(1, 1, 1, vn(x * 0.09, z * 0.09) * 0.7 + r * 0.3); });
  const m = bladeMesh(base, mat, off, par, cols, list.length); scene.add(m); return m;
}

// ---------- 떠다니는 것: 낮엔 억새 씨앗, 밤엔 반딧불 ----------
export function createMotes({ scene, height, low }) {
  const n = low ? 80 : 180, pos = new Float32Array(n * 3), ph = []; let ready = false;
  for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 60; pos[i * 3 + 2] = (Math.random() - 0.5) * 60; ph.push(Math.random() * 6.28); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const cv = document.createElement('canvas'); cv.width = cv.height = 32; const cx = cv.getContext('2d'); const gr = cx.createRadialGradient(16, 16, 1, 16, 16, 15); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 32, 32);
  const m = new THREE.PointsMaterial({ color: '#fff6dc', size: 0.12, map: new THREE.CanvasTexture(cv), transparent: true, opacity: 0.9, depthWrite: false, fog: false });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts);
  return { pts, update(p, t, dt, night) {
    if (!ready) { for (let i = 0; i < n; i++) { pos[i * 3] += p.x; pos[i * 3 + 2] += p.z; } ready = true; }  // 입자 좌표는 월드 기준. 처음 한 번만 플레이어 주변에 깔기
    m.color.copy(M.mote); m.size = 0.12 + night * 0.2; m.blending = night > 0.4 ? THREE.AdditiveBlending : THREE.NormalBlending;
    for (let i = 0; i < n; i++) { const sp = 1.4 * (1 - night * 0.8); pos[i * 3] += (sp + Math.sin(t + ph[i]) * 0.5) * dt; pos[i * 3 + 2] += Math.cos(t * 0.7 + ph[i]) * 0.3 * dt;
      // 플레이어에서 30 넘게 멀어지면 60 상자 안에서 반대편으로 되감기
      let dx = pos[i * 3] - p.x, dz = pos[i * 3 + 2] - p.z; 
      if (dx > 30) { pos[i * 3] -= 60; } else if (dx < -30) { pos[i * 3] += 60; }
      if (dz > 30) { pos[i * 3 + 2] -= 60; } else if (dz < -30) { pos[i * 3 + 2] += 60; }
      pos[i * 3 + 1] = height(pos[i * 3], pos[i * 3 + 2]) + 0.6 + (Math.sin(ph[i] * 3.1) * 0.5 + 0.5) * 4.5 + Math.sin(t * 0.8 + ph[i] * 2) * 0.4; }
    g.attributes.position.needsUpdate = true; } };
}

// ---------- 후처리: 은은한 빛 번짐 + 색 보정 + 비네트 ----------
export function createPost(renderer, low) {
  const ok = renderer.extensions.has('EXT_color_buffer_half_float') || renderer.extensions.has('EXT_color_buffer_float');
  const rt = new THREE.WebGLRenderTarget(4, 4, { samples: low ? 2 : 4, type: THREE.HalfFloatType });
  const u = { t: U(rt.texture), px: U(new THREE.Vector2(1, 1)), sat: U(1.1), warm: U(new THREE.Vector3(1, 1, 1)), glow: U(0.25) };
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, toneMapped: false, uniforms: u, defines: { TAPS: low ? 8 : 12 },
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `varying vec2 vU; uniform sampler2D t; uniform vec2 px; uniform float sat, glow; uniform vec3 warm;
      void main(){ vec3 c = texture2D(t, vU).rgb; vec3 b = vec3(0.0);
        for (int i = 0; i < TAPS; i++) { float a = float(i) * 6.2832 / float(TAPS) * 2.0; float r = (i < TAPS / 2) ? 7.0 : 18.0; vec3 s = texture2D(t, vU + vec2(cos(a), sin(a)) * px * r).rgb; b += max(s - 0.72, 0.0); }
        c += b / float(TAPS) * glow * 0.9;
        float l = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(l), c, sat); c *= warm;
        c = c * (1.0 + c * 0.12) / (1.0 + c * 0.12 * 0.9);
        vec2 d = vU - 0.5; c *= 1.0 - dot(d, d) * 0.35;
        gl_FragColor = vec4(pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0); }` }));
  const qScene = new THREE.Scene(); qScene.add(quad); const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return { u, ok,
    setSize(w, h) { rt.setSize(Math.round(w), Math.round(h)); u.px.value.set(1 / w, 1 / h).multiplyScalar(Math.max(1, h / 720)); },
    render(scene, camera) { renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null); renderer.render(qScene, qCam); } };
}

// 시안용: 민들레 홀씨 같은 흰 꽃 무리를 드문드문
export function createFlowers({ scene, height, canGrow, extent, count }) {
  let s = 77; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const stem = new THREE.CylinderGeometry(0.016, 0.024, 0.62, 3, 1, true); stem.translate(0, 0.31, 0);
  const puff = roundNormals(new THREE.IcosahedronGeometry(0.15, 1)); puff.translate(0, 0.7, 0);
  const list = [];
  for (let c = 0; c < count; c++) { const cx = (rnd() - 0.5) * extent * 2, cz = (rnd() - 0.5) * extent * 2; if (vn(cx * 0.02 + 9, cz * 0.02) < 0.45) continue; const n = 5 + Math.floor(rnd() * 9);
    for (let i = 0; i < n; i++) { const a = rnd() * 6.28, r = rnd() * 2.2, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; if (canGrow(x, z) <= 0) continue; list.push([x, z, 0.8 + rnd() * 0.9, rnd() * 0.3 - 0.15, c]); } }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const mk = (geo, mat) => { const im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach(([x, z, k, tilt], i) => { e.set(tilt, 0, tilt * 0.7); q.setFromEuler(e); m4.compose(v.set(x, height(x, z), z), q, sc.set(k, k, k)); im.setMatrixAt(i, m4); }); im.frustumCulled = false; scene.add(im); return im; };
  mk(stem, softMat({ a: G.grassA, b: G.grassB })); const pm = mk(puff, softMat({ a: '#d9dccf', b: '#ffffff', rim: 0.2 }));
  const cols = ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffe27a', '#ffffff', '#ffb8d0', '#ffffff', '#cfe0ff'].map((h) => C(h)); list.forEach((l, i) => pm.setColorAt(i, cols[l[4] % cols.length])); pm.instanceColor.needsUpdate = true;
  return list.length;
}
