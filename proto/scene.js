import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ---------- 분위기(시안) ----------
const MOODS = {
  day: { zenith: '#5aa6e6', horizon: '#d8ecf2', sun: '#fff3d0', sunDir: [0.45, 0.72, 0.35], fogD: 0.0026, amb: '#bcd9ff', ground: '#cfe6a8', sunI: 2.1, hemiI: 1.05,
    grassA: '#3f8f3c', grassB: '#9ccf58', leafA: '#256e44', leafB: '#8fcf5a', eok: '#fff6dc', cloud: '#ffffff', cloudSh: '#c9dcf2', sat: 1.12, warm: [1.02, 1.0, 0.97], glow: 0.25 },
  sunset: { zenith: '#4a5fa8', horizon: '#ffc48a', sun: '#ff9a4a', sunDir: [-0.72, 0.16, -0.55], fogD: 0.0034, amb: '#b7a4d8', ground: '#e8a46a', sunI: 2.2, hemiI: 1.1,
    grassA: '#55793c', grassB: '#c9b25a', leafA: '#3c5f44', leafB: '#c9a455', eok: '#ffe2a8', cloud: '#ffd9b8', cloudSh: '#c48aa8', sat: 1.18, warm: [1.08, 0.98, 0.9], glow: 0.55 },
  dawn: { zenith: '#7a8fd0', horizon: '#f6d3dc', sun: '#ffd2c0', sunDir: [0.75, 0.2, -0.45], fogD: 0.0062, amb: '#c9c4ec', ground: '#b8c8c0', sunI: 1.5, hemiI: 1.2,
    grassA: '#4f8a68', grassB: '#a8d6b0', leafA: '#3a6f66', leafB: '#9cd0b8', eok: '#fdeef2', cloud: '#fff0f2', cloudSh: '#b9b6e0', sat: 1.0, warm: [0.98, 0.99, 1.04], glow: 0.4 },
  night: { zenith: '#070b26', horizon: '#27407a', sun: '#bcd0ff', sunDir: [0.35, 0.5, -0.7], fogD: 0.0038, amb: '#5f74c0', ground: '#182838', sunI: 1.1, hemiI: 0.85,
    grassA: '#1c4a52', grassB: '#3f9a8a', leafA: '#14303c', leafB: '#3a7f88', eok: '#e6fbff', cloud: '#6a7ab0', cloudSh: '#2a3560', sat: 1.15, warm: [0.94, 1.0, 1.12], glow: 1.5 },
  n_dawn: { zenith: '#3a4a9a', horizon: '#ffb9c4', sun: '#ffd0b0', sunDir: [0.3, 0.14, -0.94], fogD: 0.0046, amb: '#b0a6e6', ground: '#3a5a66', sunI: 1.5, hemiI: 1.25,
    grassA: '#2a6a70', grassB: '#7fd0b4', leafA: '#24506a', leafB: '#7fc0c0', eok: '#ffe6ee', cloud: '#ffc9d6', cloudSh: '#8a7ac8', sat: 1.15, warm: [1.02, 0.98, 1.06], glow: 1.3 },
  n_day: { zenith: '#2f8fe6', horizon: '#bfeef2', sun: '#fff8e0', sunDir: [0.45, 0.78, 0.3], fogD: 0.0024, amb: '#bfe6ff', ground: '#8fd6b0', sunI: 2.2, hemiI: 1.2,
    grassA: '#1f9a7a', grassB: '#8fe0a0', leafA: '#178a7a', leafB: '#8fe0b0', eok: '#fffbe6', cloud: '#ffffff', cloudSh: '#a8dcf0', sat: 1.2, warm: [1.0, 1.0, 1.0], glow: 0.7 },
  n_sunset: { zenith: '#3a2f7a', horizon: '#ff9a6a', sun: '#ffb060', sunDir: [-0.25, 0.12, -0.96], fogD: 0.0036, amb: '#a88ad8', ground: '#4a3a5a', sunI: 2.0, hemiI: 1.05,
    grassA: '#2a5a66', grassB: '#e0b070', leafA: '#2a3f5a', leafB: '#d08a6a', eok: '#ffe0b0', cloud: '#ffb08a', cloudSh: '#8a5aa8', sat: 1.2, warm: [1.06, 0.98, 1.0], glow: 1.3 },
  paper: { zenith: '#f3a86a', horizon: '#fde6b8', sun: '#fff3cf', sunDir: [-0.22, 0.2, -0.95], fogD: 0.003, amb: '#f2c9a0', ground: '#7a9a80', sunI: 2.0, hemiI: 1.2,
    grassA: '#2c6a5c', grassB: '#63a57a', leafA: '#1d4a4c', leafB: '#3f8a74', eok: '#ffe7ad', cloud: '#fff2d6', cloudSh: '#f0b48a', sat: 1.1, warm: [1.03, 1.0, 0.95], glow: 0.5 },
  vivid: { zenith: '#3f9cf0', horizon: '#cfeeff', sun: '#fff6da', sunDir: [0.5, 0.75, 0.3], fogD: 0.0007, amb: '#cfe2ff', ground: '#bfe08a', sunI: 2.3, hemiI: 1.2,
    grassA: '#3f9a4a', grassB: '#93cc58', leafA: '#1f8a52', leafB: '#9fd85a', eok: '#fff3c9', cloud: '#ffffff', cloudSh: '#bcd6f5', sat: 1.12, warm: [1.02, 1.0, 0.98], glow: 0.2 },
};
const params = new URLSearchParams(location.search);
const STYLE = params.get('style') || 'pastel';
const ST = { pastel: { mood: 'day', post: 0, blades: 150000 }, paper: { mood: 'paper', post: 1, blades: 0 }, ink: { mood: 'dawn', post: 2, blades: 60000 }, diorama: { mood: 'vivid', post: 3, blades: 26000, flat: true }, night: { mood: 'night', post: 4, blades: 110000 } }[STYLE];
const MOODKEY = params.get('mood') || ST.mood; const M = MOODS[MOODKEY];
const SHOT = params.get('shot') || 'wide';
const LOW = params.get('q') === 'low'; const QK = LOW ? 0.45 : 1;
const C = (h) => new THREE.Color(h);
const sunDir = new THREE.Vector3(...M.sunDir).normalize();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
document.body.style.margin = '0'; document.body.append(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(C(M.horizon), M.fogD);
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.3, 4000);

// ---------- 노이즈·지형 ----------
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
const sm = (t) => t * t * (3 - 2 * t);
function vnoise(x, z) { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi; const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1); const u = sm(xf), v = sm(zf); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
const fbm = (x, z) => vnoise(x, z) * 0.55 + vnoise(x * 2.1, z * 2.1) * 0.28 + vnoise(x * 4.3, z * 4.3) * 0.17;
const ORE = { x: 10, z: -175, R: 130, H: 62, cr: 34 };
const pathX = (z) => Math.sin(z * 0.035) * 9 + Math.sin(z * 0.011 + 1) * 6;
function height(x, z) {
  let h = fbm(x * 0.012, z * 0.012) * 9 - 3 + fbm(x * 0.05, z * 0.05) * 1.2;
  const r = Math.hypot(x - ORE.x, z - ORE.z);
  const t = Math.max(0, 1 - r / ORE.R);
  let cone = ORE.H * sm(sm(t)) * 1.25; cone = Math.min(cone, ORE.H + (r < ORE.cr ? -Math.pow(1 - r / ORE.cr, 1.5) * 16 : 0) + fbm(x * 0.06, z * 0.06) * 3);
  const ang = Math.atan2(z - ORE.z, x - ORE.x); const mid = Math.sin(Math.min(1, t * 1.25) * Math.PI);
  cone -= (Math.abs(Math.sin(ang * 7 + fbm(x * 0.02, z * 0.02) * 3)) * 2.4 + fbm(x * 0.09, z * 0.09) * 1.6) * mid;
  h += cone;
  const d = Math.abs(x - pathX(z)); if (d < 3 && z > -60) h -= 0.25 * (1 - d / 3);
  return h;
}
const onPath = (x, z) => z > -64 && z < 120 ? Math.abs(x - pathX(z)) : 99;

const N = ST.flat ? 90 : 260, EXT = 340;
const tg = new THREE.PlaneGeometry(EXT * 2, EXT * 2, N, N); tg.rotateX(-Math.PI / 2);
{ const p = tg.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  const gA = C(M.grassA), gB = C(M.grassB), dirt = C('#a8604a').lerp(C(M.ground), 0.18), dirt2 = C('#8a4636').lerp(C(M.ground), 0.18), rock = C('#6f6a66').lerp(C(M.ground), 0.25), eokc = C(M.eok).multiplyScalar(0.82);
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), h = height(x, z); p.setY(i, h);
    const n = fbm(x * 0.03 + 5, z * 0.03), n2 = fbm(x * 0.13, z * 0.13);
    c.copy(gA).lerp(gB, sm(Math.min(1, n * 1.25)));
    const r = Math.hypot(x - ORE.x, z - ORE.z);
    if (r < ORE.R * 0.8) c.lerp(eokc, sm(Math.min(1, Math.max(0, (n2 - 0.35) * 2.2))) * 0.7);
    if (r < ORE.cr) c.lerp(gA, 0.5).multiplyScalar(0.8 + 0.2 * r / ORE.cr);
    const d = onPath(x, z); if (d < 2.6) c.copy(c.clone().lerp(dirt2.clone().lerp(dirt, sm(fbm(x * 0.5, z * 0.12))), sm(Math.min(1, (1 - d / 2.6) * 1.6))));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  tg.computeVertexNormals(); const nr = tg.attributes.normal;
  for (let i = 0; i < p.count; i++) { const ny = nr.getY(i); if (ny < 0.9) { const k = sm(Math.min(1, (0.9 - ny) / 0.22)) * (0.35 + 0.65 * fbm(p.getX(i) * 0.2, p.getZ(i) * 0.2)); c.setRGB(col[i * 3], col[i * 3 + 1], col[i * 3 + 2]).lerp(rock, k * 0.8); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; } }
  tg.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
const terrMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: !!ST.flat });
const cloudU = { value: 0 };
terrMat.onBeforeCompile = (sh) => { sh.uniforms.uT = cloudU;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
    varying vec3 vWp; uniform float uT;
    float ch(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float cn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(ch(i), ch(i + vec2(1, 0)), f.x), mix(ch(i + vec2(0, 1)), ch(i + vec2(1, 1)), f.x), f.y); }`)
    .replace('#include <color_fragment>', `#include <color_fragment>
    float cs = smoothstep(0.48, 0.72, cn(vWp.xz * 0.008 + vec2(uT * 0.02, uT * 0.008)) * 0.65 + cn(vWp.xz * 0.02 - uT * 0.01) * 0.35);
    diffuseColor.rgb *= mix(1.0, 0.74, cs);`); };
const terrain = new THREE.Mesh(tg, terrMat); terrain.receiveShadow = true; scene.add(terrain);

// ---------- 빛 ----------
const hemi = new THREE.HemisphereLight(C(M.amb), C(M.ground), M.hemiI); scene.add(hemi);
const sun = new THREE.DirectionalLight(C(M.sun), M.sunI); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera; sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 10; sc.far = 400; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.6; sun.shadow.radius = 5;
scene.add(sun, sun.target);

// ---------- 하늘 ----------
const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { zen: { value: C(M.zenith) }, hor: { value: C(M.horizon) }, sunC: { value: C(M.sun) }, sunD: { value: sunDir }, stars: { value: MOODKEY === 'night' ? 1 : MOODKEY === 'n_dawn' || MOODKEY === 'n_sunset' ? 0.35 : 0 }, disc: { value: STYLE === 'paper' ? 0.994 : STYLE === 'night' ? 0.9988 : 0.9993 } },
  vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `varying vec3 vD; uniform vec3 zen, hor, sunC, sunD; uniform float stars, disc;
    float h3(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
    void main(){ vec3 d = normalize(vD); float t = clamp(d.y, 0.0, 1.0);
      vec3 c = mix(hor, zen, pow(t, 0.55));
      float s = max(dot(d, sunD), 0.0);
      c += sunC * (pow(s, 6.0) * 0.28 + pow(s, 40.0) * 0.5);
      c = mix(c, vec3(1.0, 0.98, 0.9), smoothstep(disc, disc + 0.0004, s));
      vec3 g = floor(d * 220.0); float st = step(0.9965, h3(g)) * stars * smoothstep(0.05, 0.3, d.y); c += vec3(0.9, 0.95, 1.0) * st * (0.5 + 0.5 * h3(g + 1.0));
      c = mix(c, hor, smoothstep(0.0, -0.08, d.y));
      gl_FragColor = vec4(c, 1.0); }` }));
scene.add(sky);

// ---------- 부드러운 툰 셰이더 (나무·구름·바위) ----------
function softMat({ a, b, rim = 0.35, fogged = true, wind = 0 }) {
  return new THREE.ShaderMaterial({ fog: false,
    uniforms: { cA: { value: C(a) }, cB: { value: C(b) }, sunD: { value: sunDir }, sunC: { value: C(M.sun) }, fogC: { value: C(M.horizon) }, fogD: { value: fogged ? M.fogD : M.fogD * 0.25 }, rim: { value: rim }, uT: { value: 0 }, wind: { value: wind } },
    vertexShader: `varying vec3 vN; varying vec3 vW; varying float vY; uniform float uT, wind;
      void main(){ vec4 p = vec4(position, 1.0); vY = position.y;
        #ifdef USE_INSTANCING
          p = instanceMatrix * p; vN = normalize(mat3(instanceMatrix) * normal);
        #else
          vN = normal;
        #endif
        vec4 w = modelMatrix * p; w.x += sin(uT * 1.3 + w.x * 0.2 + w.y) * wind * max(position.y - 2.0, 0.0) * 0.03;
        vN = normalize(mat3(modelMatrix) * vN); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vW; varying float vY; uniform vec3 cA, cB, sunD, sunC, fogC; uniform float fogD, rim;
      void main(){ vec3 n = normalize(vN); float l = dot(n, sunD) * 0.5 + 0.5; l = smoothstep(0.25, 0.85, l);
        float up = n.y * 0.5 + 0.5;
        vec3 c = mix(cA, cB, clamp(l * 0.75 + up * 0.35, 0.0, 1.0));
        c += sunC * pow(l, 3.0) * rim * 0.35;
        float dist = length(vW - cameraPosition); float f = 1.0 - exp(-fogD * fogD * dist * dist);
        gl_FragColor = vec4(mix(c, fogC, f), 1.0); }` });
}
const mats = [];
const mk = (o) => { const m = softMat(o); mats.push(m); return m; };
let seed = 3; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3();
function instanced(geo, mat, list, shadow = true) { const im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach(([x, z, s, ry, sy], i) => { E.set(0, ry || 0, 0); Q.setFromEuler(E); M4.compose(V.set(x, height(x, z) - 0.15, z), Q, S.set(s, s * (sy || 1), s)); im.setMatrixAt(i, M4); }); im.castShadow = shadow; im.frustumCulled = false; scene.add(im); return im; }

// 뭉게나무: 공 여러 개를 뭉친 수관
function fluffy(n, spread, r0) { const parts = []; if (ST.flat) n = Math.ceil(n / 2.5); for (let i = 0; i < n; i++) { let g = new THREE.IcosahedronGeometry(r0 * (0.7 + rnd() * 0.5) * (ST.flat ? 1.25 : 1), ST.flat ? 0 : 1); if (ST.flat) { g = g.toNonIndexed(); g.computeVertexNormals(); } const a = rnd() * 6.28, rr = rnd() * spread; g.translate(Math.cos(a) * rr, 4.2 + rnd() * 2.0 - rr * 0.35, Math.sin(a) * rr); parts.push(g); } return mergeGeometries(parts); }
const canopy = fluffy(11, 2.6, 1.8), canopy2 = fluffy(8, 2.0, 1.6);
const trunk = new THREE.CylinderGeometry(0.22, 0.42, 4.2, 7); trunk.translate(0, 2.0, 0);
const cedarParts = [0, 1, 2, 3].map((i) => { const g = new THREE.ConeGeometry(1.7 - i * 0.36, 3.6, 8, 1); g.translate(0, 2.6 + i * 2.0, 0); return g; }); const cedar = mergeGeometries(cedarParts);
const trees = [], trees2 = [], cedars = [];
for (let i = 0; i < 700; i++) { const x = (rnd() - 0.5) * 560, z = (rnd() - 0.5) * 560; if (onPath(x, z) < 7) continue; const r = Math.hypot(x - ORE.x, z - ORE.z); if (r < ORE.R * 0.72) continue; if (Math.hypot(x, z - 40) < 16) continue;
  const n = fbm(x * 0.02 + 9, z * 0.02); if (n < 0.42) continue; const s = 0.8 + rnd() * 0.9; if (n > 0.6) { if (onPath(x, z) > 22) cedars.push([x, z, s * 0.8, rnd() * 6.28]); } else (rnd() < 0.5 ? trees : trees2).push([x, z, s, rnd() * 6.28]); }
{ const wide = fluffy(9, 3.4, 1.7); wide.scale(1.15, 0.72, 1.15); wide.translate(0, 1.2, 0); const pk = []; for (let i = 0; i < 14; i++) { const z = -40 + rnd() * 150, x = pathX(z) + (rnd() < 0.5 ? -1 : 1) * (14 + rnd() * 60); pk.push([x, z, 1.2 + rnd() * 0.6, rnd() * 6.28]); }
  instanced(wide, mk({ a: C(M.leafA).multiplyScalar(0.9), b: C(M.leafB).lerp(C(M.leafA), 0.2), wind: 0.8 }), pk); instanced(new THREE.CylinderGeometry(0.3, 0.6, 4.4, 7).translate(0, 2.0, 0), mk({ a: '#3e3028', b: '#8a6e54' }), pk);
  [[-70, 60, 0.25, 26], [95, 10, -0.35, 30], [-120, -30, 0.1, 22]].forEach(([sx, sz, an, n]) => { for (let i = 0; i < n; i++) { const t = i * 3.4 + rnd(); const x = sx + Math.cos(an) * t + (rnd() - 0.5) * 1.5, z = sz + Math.sin(an) * t + (rnd() - 0.5) * 1.5; if (onPath(x, z) > 8) cedars.push([x, z, 0.75 + rnd() * 0.35, rnd() * 6.28, 1.25]); } }); }
instanced(canopy, mk({ a: M.leafA, b: M.leafB, wind: 1 }), trees); instanced(canopy2, mk({ a: C(M.leafA).lerp(C('#2a6a5a'), 0.3), b: C(M.leafB).lerp(C('#e8e07a'), 0.25), wind: 1 }), trees2);
instanced(trunk, mk({ a: '#5a4030', b: '#a07a56' }), [...trees, ...trees2]);
instanced(cedar, mk({ a: C(M.leafA).multiplyScalar(0.6), b: C(M.leafB).lerp(C(M.leafA), 0.6), wind: 0.6 }), cedars);
instanced(new THREE.CylinderGeometry(0.2, 0.3, 2.6, 6).translate(0, 1.2, 0), mk({ a: '#4a3628', b: '#8a6a4c' }), cedars);
// 바위
const rockG = new THREE.IcosahedronGeometry(1, 1); { const p = rockG.attributes.position; for (let i = 0; i < p.count; i++) { const k = 0.8 + hash(p.getX(i) * 9.1, p.getZ(i) * 7.3 + p.getY(i)) * 0.4; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.7, p.getZ(i) * k); } rockG.computeVertexNormals(); }
const rocks = []; for (let i = 0; i < 90; i++) { const z = -50 + rnd() * 150, x = pathX(z) + (rnd() < 0.5 ? -1 : 1) * (3.2 + rnd() * 14); rocks.push([x, z, 0.3 + rnd() * 0.9, rnd() * 6.28]); }
instanced(rockG, mk({ a: '#5c5a60', b: '#b9b2a6', rim: 0.2 }), rocks);
// 돌탑
{ const cx = pathX(34) + 3.4, cz = 34, by = height(cx, cz); const m = mk({ a: '#55525a', b: '#c2bbb0', rim: 0.2 }); [1.0, 0.78, 0.6, 0.44, 0.3].reduce((y, r, i) => { const s = new THREE.Mesh(rockG, m); s.scale.set(r, r * 0.55, r); s.position.set(cx + (hash(i, 2) - 0.5) * 0.15, y + r * 0.3, cz); s.rotation.y = i * 1.3; s.castShadow = true; scene.add(s); return y + r * 0.62; }, by - 0.05); }

// ---------- 풀 (인스턴스 날, 셰이더 바람) ----------
const playerU = { value: new THREE.Vector3(0, 0, 1e6) };
function blades({ count, area, hMin, hMax, w, cA, cB, tipC, tipAt = 2, filter, cx = 0, cz = 30, focus = false, segs = 3 }) {
  count = Math.round(count * QK);
  const g = new THREE.PlaneGeometry(1, 1, 1, segs); g.translate(0, 0.5, 0);
  const ig = new THREE.InstancedBufferGeometry(); ig.index = g.index; ig.setAttribute('position', g.attributes.position); ig.setAttribute('uv', g.attributes.uv);
  const off = [], par = [], tint = []; let n = 0, tries = 0;
  while (n < count && tries++ < count * 6) { let x, z, lod = 1; if (focus) { const a = rnd() * 6.28, rr = Math.pow(rnd(), 1.7); x = cx + Math.cos(a) * rr * area / 2; z = cz + Math.sin(a) * rr * area / 2; lod = 1 + rr * 2.2; } else { x = cx + (rnd() - 0.5) * area; z = cz + (rnd() - 0.5) * area; } if (!filter(x, z)) continue; off.push(x, height(x, z), z); par.push(rnd() * 6.28, (hMin + rnd() * (hMax - hMin)) * (0.9 + lod * 0.1), w * (0.7 + rnd() * 0.6) * lod, rnd()); tint.push(fbm(x * 0.05, z * 0.05), fbm(x * 0.4 + 3, z * 0.4)); n++; }
  ig.setAttribute('aOff', new THREE.InstancedBufferAttribute(new Float32Array(off), 3)); ig.setAttribute('aPar', new THREE.InstancedBufferAttribute(new Float32Array(par), 4)); ig.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array(tint), 2)); ig.instanceCount = n;
  const m = new THREE.ShaderMaterial({ side: THREE.DoubleSide, fog: false,
    uniforms: { uT: { value: 0 }, uP: playerU, cA: { value: C(cA) }, cB: { value: C(cB) }, tipC: { value: C(tipC || cB) }, tipAt: { value: tipAt }, sunC: { value: C(M.sun) }, sunD: { value: sunDir }, fogC: { value: C(M.horizon) }, fogD: { value: M.fogD } },
    vertexShader: `attribute vec3 aOff; attribute vec4 aPar; attribute vec2 aTint; uniform float uT; uniform vec3 uP; varying float vG; varying float vY; varying vec2 vTint; varying vec3 vW; varying float vSide;
      void main(){ float y = position.y; vY = y; vTint = aTint;
        float wdt = aPar.z * (1.0 - y * y * 0.9);
        float c = cos(aPar.x), s = sin(aPar.x);
        vec3 p = vec3(position.x * wdt * c, y * aPar.y, position.x * wdt * s);
        float ph = aOff.x * 0.16 + aOff.z * 0.12 + aPar.w * 1.5;
        float sway = (sin(uT * 1.6 + ph) * 0.6 + sin(uT * 3.7 + ph * 2.3) * 0.25) * y * y * aPar.y * 0.28;
        float gust = sin(uT * 0.5 + aOff.x * 0.03 - aOff.z * 0.02) * 0.5 + 0.5;
        p.x += sway * (0.6 + gust); p.z += sway * 0.5; p.y -= abs(sway) * 0.25;
        float band = smoothstep(0.55, 0.95, sin(aOff.x * 0.045 + aOff.z * 0.03 - uT * 0.9) * 0.5 + 0.5); p.x += band * y * y * aPar.y * 0.22; vG = band * y;
        vec2 dp = aOff.xz - uP.xz; float dl = length(dp); float push = (1.0 - smoothstep(0.25, 1.5, dl)) * y; p.xz += (dl > 0.001 ? dp / dl : vec2(0.0)) * push * 0.55 * aPar.y; p.y -= push * 0.3 * aPar.y;
        vec3 w = aOff + p; vW = w; vSide = c;
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`,
    fragmentShader: `uniform vec3 cA, cB, tipC, sunC, sunD, fogC; uniform float fogD, tipAt; varying float vG; varying float vY; varying vec2 vTint; varying vec3 vW; varying float vSide;
      void main(){ vec3 base = mix(cA, cB, smoothstep(0.2, 0.9, vTint.x));
        vec3 c = mix(base * 0.5, base * 1.05, vY);
        c = mix(c, tipC, smoothstep(tipAt, 1.0, vY));
        c *= 0.9 + vTint.y * 0.25;
        c += sunC * 0.1 * vY * (0.5 + 0.5 * vSide); c += vec3(0.09) * vG;
        float dist = length(vW - cameraPosition); float f = 1.0 - exp(-fogD * fogD * dist * dist);
        gl_FragColor = vec4(mix(c, fogC, f), 1.0); }` });
  const mesh = new THREE.Mesh(ig, m); mesh.frustumCulled = false; scene.add(mesh); mats.push(m); return mesh;
}
const oreR = (x, z) => Math.hypot(x - ORE.x, z - ORE.z);
if (ST.blades) blades({ count: ST.flat ? ST.blades : 70000, focus: !ST.flat, cz: 46, area: ST.flat ? 150 : 210, hMin: ST.flat ? 0.3 : 0.3, hMax: ST.flat ? 0.6 : 0.75, w: ST.flat ? 0.32 : 0.05, cA: M.grassA, cB: M.grassB, filter: (x, z) => onPath(x, z) > 1.9 });
// 억새: 길고 끝이 크림색
if (STYLE !== 'paper' && !ST.flat) blades({ count: 9000, focus: true, area: 170, hMin: 0.9, hMax: 1.6, w: 0.04, cA: C(M.grassA).lerp(C('#c9b070'), 0.5), cB: C(M.grassB).lerp(C('#e8d090'), 0.5), tipC: M.eok, tipAt: 0.55, filter: (x, z) => onPath(x, z) > 4.5 && fbm(x * 0.045 + 20, z * 0.045) > 0.55, cz: 10 });
blades({ segs: 2, count: ST.flat ? 9000 : 40000, area: 250, hMin: 1.2, hMax: 2.2, w: ST.flat ? 0.4 : 0.085, cA: C(M.grassA).lerp(C('#c9b070'), 0.5), cB: C(M.grassB).lerp(C('#e8d090'), 0.5), tipC: M.eok, tipAt: 0.5, filter: (x, z) => oreR(x, z) < ORE.R * 0.82 && oreR(x, z) > ORE.cr * 0.6 && fbm(x * 0.05, z * 0.05) > 0.42, cx: ORE.x, cz: ORE.z });
// 들꽃
{ const fl = []; for (let i = 0; i < 1400; i++) { const z = -40 + rnd() * 130, x = pathX(z) + (rnd() < 0.5 ? -1 : 1) * (2.4 + rnd() * rnd() * 26); if (fbm(x * 0.09 + 40, z * 0.09) < 0.5) continue; fl.push([x, z]); }
  const cols = ['#ffd84a', '#ff9ec4', '#ffffff', '#c9a6ff'];
  cols.forEach((cc, k) => { const list = fl.filter((_, i) => i % cols.length === k); const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.065, 6, 5), new THREE.MeshBasicMaterial({ color: C(cc).lerp(C(M.sun), 0.12).multiplyScalar(MOODKEY === 'night' ? 0.45 : 1) }), list.length); list.forEach(([x, z], i) => { M4.makeTranslation(x, height(x, z) + 0.55 + rnd() * 0.3, z); im.setMatrixAt(i, M4); }); scene.add(im); }); }

// ---------- 구름·원경 ----------
{ const cm = softMat({ a: M.cloudSh, b: M.cloud, rim: 0.6, fogged: false }); cm.uniforms.fogD.value = 0.00035; mats.push(cm);
  for (let i = 0; i < 16; i++) { const parts = []; const n = 5 + Math.floor(rnd() * 5); for (let k = 0; k < n; k++) { const g = new THREE.IcosahedronGeometry(14 + rnd() * 16, 2); g.scale(1.5, 0.62, 1); g.translate((k - n / 2) * 17 + rnd() * 8, rnd() * 7, rnd() * 14); parts.push(g); }
    const c = new THREE.Mesh(mergeGeometries(parts), cm); const a = rnd() * 6.28, r = 900 + rnd() * 1100; c.position.set(Math.cos(a) * r, 260 + rnd() * 260, Math.sin(a) * r); c.rotation.y = rnd() * 3; c.scale.setScalar(1 + rnd() * 1.6); scene.add(c); } }
function ridge(dist, hgt, color, ang0, span, seedK) { const pts = [], n = 80; const shape = new THREE.Shape(); shape.moveTo(-span / 2, -40); for (let i = 0; i <= n; i++) { const u = i / n; const y = (fbm(u * 5 + seedK, seedK) * 0.7 + Math.sin(u * Math.PI) ** 1.5 * 0.9) * hgt; shape.lineTo(-span / 2 + u * span, y); } shape.lineTo(span / 2, -40);
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color, fog: false })); m.position.set(Math.sin(ang0) * dist, 0, -Math.cos(ang0) * dist); m.lookAt(0, 0, 0); scene.add(m); }
const hz = C(M.horizon), far1 = C(M.leafA).lerp(hz, 0.62), far2 = C(M.leafA).lerp(hz, 0.78), far3 = C(M.zenith).lerp(hz, 0.72);
ridge(1900, 520, far3, -0.55, 3400, 3.1); // 한라산
ridge(1300, 150, far2, 0.5, 2600, 7.7); ridge(900, 80, far1, -0.2, 2400, 12.4); ridge(1100, 110, far2, 2.6, 2600, 5.5); ridge(1200, 120, far2, -2.2, 2600, 9.9);
const seaMat = new THREE.ShaderMaterial({ fog: false, uniforms: { uT: { value: 0 }, cA: { value: C(M.zenith).lerp(hz, 0.35) }, cB: { value: hz.clone() }, sunC: { value: C(M.sun) }, sunD: { value: sunDir } },
  vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: `varying vec3 vW; uniform vec3 cA, cB, sunC, sunD; uniform float uT;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){ float d = length(vW.xz); vec3 c = mix(cA, cB, smoothstep(700.0, 2600.0, d));
      vec2 g = floor(vW.xz / vec2(14.0, 5.0) + vec2(uT * 0.3, 0.0)); float tw = step(0.93, h(g)) * (0.5 + 0.5 * sin(uT * 3.0 + h(g + 3.0) * 6.28));
      vec3 dir = normalize(vW - cameraPosition); float facing = pow(max(dot(normalize(vec3(dir.x, 0.0, dir.z)), normalize(vec3(sunD.x, 0.0, sunD.z))), 0.0), 3.0);
      c += sunC * tw * (0.12 + facing * 0.5) * (1.0 - smoothstep(600.0, 2200.0, d));
      gl_FragColor = vec4(c, 1.0); }` }); mats.push(seaMat);
{ const sea = new THREE.Mesh(new THREE.RingGeometry(335, 2900, 64, 1, -0.75, 2.0), seaMat); sea.rotation.x = -Math.PI / 2; sea.position.y = -4; scene.add(sea);
  const tuff = new THREE.Mesh(new THREE.CylinderGeometry(120, 190, 120, 14, 1), new THREE.MeshBasicMaterial({ color: far2, fog: false })); tuff.position.set(980, 50, -760); scene.add(tuff);
  const isl = new THREE.Mesh(new THREE.SphereGeometry(110, 12, 8, 0, 6.29, 0, 1.2), new THREE.MeshBasicMaterial({ color: far3, fog: false })); isl.scale.y = 0.35; isl.position.set(1500, -4, -300); scene.add(isl); }
// 흩날리는 억새 씨앗
const seedN = Math.round(160 * QK), seedPos = new Float32Array(seedN * 3), seedPh = []; for (let i = 0; i < seedN; i++) { seedPos[i * 3] = (rnd() - 0.5) * 70; seedPos[i * 3 + 1] = 0.5 + rnd() * 6; seedPos[i * 3 + 2] = 20 + rnd() * 60; seedPh.push(rnd() * 6.28); }
const seedG = new THREE.BufferGeometry(); seedG.setAttribute('position', new THREE.BufferAttribute(seedPos, 3));
if (MOODKEY !== 'night') scene.add(new THREE.Points(seedG, new THREE.PointsMaterial({ color: C(M.eok), size: 0.07, transparent: true, opacity: 0.85, depthWrite: false, fog: false })));
function tickSeeds(t, dt) { for (let i = 0; i < seedN; i++) { seedPos[i * 3] += (1.4 + Math.sin(t + seedPh[i]) * 0.5) * dt; seedPos[i * 3 + 1] += Math.sin(t * 0.8 + seedPh[i] * 2) * 0.25 * dt; if (seedPos[i * 3] > 36) seedPos[i * 3] = -36; } seedG.attributes.position.needsUpdate = true; }


if (STYLE === 'night') { const n = 420, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const z = 20 + rnd() * 60 - 20, x = pathX(z) + (rnd() - 0.5) * 44; pos[i * 3] = x; pos[i * 3 + 1] = height(x, z) + 0.5 + rnd() * 2.6; pos[i * 3 + 2] = z; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(pg, new THREE.PointsMaterial({ color: MOODKEY === 'n_day' ? '#ffffff' : MOODKEY === 'n_dawn' ? '#ffe0ea' : '#f4ff9a', size: MOODKEY === 'n_day' ? 0.08 : 0.16, opacity: MOODKEY === 'n_day' ? 0.8 : 1, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
  [[34, 3.4], [46, -3.6], [22, -3.4], [8, 3.6]].forEach(([z, o]) => { const x = pathX(z) + o, y = height(x, z); const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.6, 6), new THREE.MeshBasicMaterial({ color: '#20242c' })); post.position.set(x, y + 1.3, z); scene.add(post);
    const lit = MOODKEY !== 'n_day'; const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshBasicMaterial({ color: lit ? '#ffe2a0' : '#d8d2c0', fog: false })); bulb.position.set(x, y + 2.7, z); scene.add(bulb); if (lit) { const l = new THREE.PointLight('#ffc070', MOODKEY === 'night' ? 30 : 14, 22, 2); l.position.copy(bulb.position); scene.add(l); } }); }

// ---------- 캐릭터 ----------
const grad = (() => { const d = new Uint8Array([170, 170, 170, 255, 215, 215, 215, 255, 240, 240, 240, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t; })();
const toon = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: grad });
function capsule(r, len, mat) { return new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat); }
function buildChar(kind) {
  const g = new THREE.Group(); const skin = toon('#ffdcbf'), dark = toon('#3a2e2a'), white = toon('#fffaf0');
  const P = { runner: { top: '#ff7a4d', pants: '#3c4a6b', shoe: '#ffd23f', hair: '#4a3628' }, hood: { top: '#c98a5a', pants: '#5a4a3e', shoe: '#fffaf0', hair: '#4a3628' }, mochi: { top: '#8fd0c2', pants: '#fffaf0', shoe: '#ff8fa8', hair: '#2e2a33' } }[kind];
  const body = capsule(0.3, 0.3, toon(P.top)); body.position.y = 0.72; body.scale.set(1, 1, 0.88); g.add(body);
  const hip = capsule(0.27, 0.06, toon(P.pants)); hip.position.y = 0.46; hip.scale.set(1.02, 0.8, 0.9); g.add(hip);
  [-1, 1].forEach((s) => { const leg = capsule(0.1, 0.16, skin); leg.position.set(s * 0.14, 0.22, 0); g.add(leg); const sh = capsule(0.125, 0.08, toon(P.pants)); sh.position.set(s * 0.14, 0.36, 0); g.add(sh); const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), toon(P.shoe)); shoe.scale.set(0.95, 0.6, 1.35); shoe.position.set(s * 0.14, 0.07, 0.05); g.add(shoe);
    const arm = capsule(0.085, 0.2, toon(P.top)); arm.position.set(s * 0.36, 0.76, 0); arm.rotation.z = s * 0.35; g.add(arm); const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), skin); hand.position.set(s * 0.44, 0.58, 0.02); g.add(hand); });
  const head = new THREE.Group(); head.position.y = 1.42; g.add(head); g.userData = { head, eyes: [], kids: [] };
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.48, 28, 22), skin); skull.scale.set(1.06, 0.96, 1); head.add(skull);
  [-1, 1].forEach((s) => { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 10), dark); eye.scale.set(0.9, 1.25, 0.5); eye.position.set(s * 0.17, -0.03, 0.45); head.add(eye); g.userData.eyes.push(eye); const hl = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff' })); hl.position.set(s * 0.17 + 0.02, 0.0, 0.485); head.add(hl);
    const ck = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff9f9a', transparent: true, opacity: 0.7 })); ck.scale.set(1, 0.6, 0.3); ck.position.set(s * 0.3, -0.13, 0.39); head.add(ck);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), skin); ear.position.set(s * 0.5, -0.03, 0); head.add(ear); });
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.016, 6, 12, Math.PI), dark); mouth.rotation.z = Math.PI; mouth.position.set(0, -0.14, 0.455); head.add(mouth); g.userData.mouth = mouth;
  if (kind === 'runner') { const hair = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 18, 0, 6.29, 0, 1.75), toon(P.hair)); hair.scale.set(1.08, 1.0, 1.04); hair.position.set(0, 0.03, -0.04); head.add(hair);
    [[-0.22, 0.3, 0.36], [0, 0.33, 0.4], [0.22, 0.3, 0.36]].forEach(([x, y, z]) => { const f = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), toon(P.hair)); f.scale.set(1.1, 0.7, 0.8); f.position.set(x, y, z); head.add(f); });
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.52, 24, 16, 0, 6.29, 0, 1.25), toon('#fffaf0')); cap.position.set(0, 0.07, -0.03); cap.scale.set(1.08, 1, 1.05); head.add(cap); const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 16, 1, false, 0, Math.PI), toon('#ff7a4d')); brim.rotation.y = Math.PI / 2; brim.position.set(0, 0.12, -0.5); brim.rotation.x = -0.3; head.add(brim);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.16), toon('#3c4a6b')); pack.position.set(0, 0.8, -0.3); g.add(pack); }
  if (kind === 'hood') { const hood = new THREE.Mesh(new THREE.SphereGeometry(0.56, 24, 18, 0, 6.29, 0, 2.2), toon(P.top)); hood.rotation.x = -0.5; hood.position.set(0, 0.02, -0.05); head.add(hood);
    [-1, 1].forEach((s) => { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 10), toon(P.top)); ear.position.set(s * 0.28, 0.56, -0.08); ear.rotation.z = -s * 0.35; head.add(ear); const inn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 8), toon('#ffd9c9')); inn.position.set(s * 0.28, 0.54, -0.03); inn.rotation.z = -s * 0.35; head.add(inn); });
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), white); tail.position.set(0, 0.5, -0.3); g.add(tail); const fr = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), toon(P.hair)); fr.scale.set(1.8, 0.6, 0.6); fr.position.set(0, 0.3, 0.36); head.add(fr); }
  if (kind === 'mochi') { const hair = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 18, 0, 6.29, 0, 1.6), toon(P.hair)); hair.scale.set(1.09, 1.02, 1.05); hair.position.set(0, 0.03, -0.03); head.add(hair);
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), toon(P.hair)); bun.position.set(0, 0.52, -0.1); head.add(bun); [-1, 1].forEach((s) => { const f = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), toon(P.hair)); f.scale.set(1, 0.75, 0.7); f.position.set(s * 0.2, 0.3, 0.37); head.add(f); });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 8, 28), toon('#ffd23f')); band.rotation.x = Math.PI / 2 - 0.25; band.position.y = 0.2; head.add(band);
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.085, 10, 20), toon('#ff8fa8')); scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.02; g.add(scarf); }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), new THREE.MeshBasicMaterial({ color: '#1c2a1a', transparent: true, opacity: 0.22, depthWrite: false })); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.03; g.add(blob);
  return g;
}
// 똥머리 계열 다섯 방향
function variant(v) {
  const g = buildChar('mochi'); const U = g.userData; const inner = new THREE.Group(); while (g.children.length) inner.add(g.children[0]); g.add(inner);
  if (v === 'tall') { inner.scale.set(0.9, 1.16, 0.9); U.head.scale.setScalar(0.86); U.eyes.forEach((e) => e.scale.set(1.25, 1.9, 0.5)); }
  if (v === 'chibi') { inner.scale.set(0.86, 0.74, 0.86); U.head.scale.setScalar(1.5); U.head.position.y = 1.52; U.eyes.forEach((e) => { e.scale.set(1.5, 0.35, 0.5); e.position.y -= 0.02; }); }
  if (v === 'doll') { inner.traverse((o) => { if (o.isMesh && o.material.isMeshToonMaterial) { const c = o.material.color.clone(); const hsl = {}; c.getHSL(hsl); c.setHSL(hsl.h, hsl.s * 0.8, Math.min(0.92, hsl.l * 1.12)); o.material = new THREE.MeshLambertMaterial({ color: c }); } });
    U.eyes.forEach((e) => { e.visible = false; const b = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 14), new THREE.MeshLambertMaterial({ color: '#3a2e2a' })); b.rotation.x = Math.PI / 2; b.position.copy(e.position); b.position.z += 0.01; U.head.add(b); [-1, 1].forEach((k) => { const h = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 5), new THREE.MeshBasicMaterial({ color: '#f6e8d0' })); h.position.set(b.position.x + k * 0.025, b.position.y, b.position.z + 0.02); U.head.add(h); }); });
    U.mouth.visible = false; [-0.06, -0.02, 0.02, 0.06].forEach((x) => { const st = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.045, 0.01), new THREE.MeshBasicMaterial({ color: '#3a2e2a' })); st.position.set(x, -0.15, 0.465); U.head.add(st); }); const ln = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.01), new THREE.MeshBasicMaterial({ color: '#3a2e2a' })); ln.position.set(0, -0.15, 0.462); U.head.add(ln);
    const patch = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.02), new THREE.MeshLambertMaterial({ color: '#f2c94c' })); patch.position.set(0.1, 0.66, 0.27); patch.rotation.z = 0.2; inner.add(patch); }
  if (v === 'deer') { const tan = toon('#d9a56e'), cream = toon('#fff3de'); inner.traverse((o) => { if (o.isMesh && o.material.color && o.material.color.getHexString() === 'ffdcbf') o.material = tan; });
    [-1, 1].forEach((s2) => { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), tan); ear.scale.set(0.55, 1.2, 0.35); ear.position.set(s2 * 0.5, 0.26, -0.02); ear.rotation.z = -s2 * 0.9; U.head.add(ear); const nub = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.1, 4, 8), cream); nub.position.set(s2 * 0.2, 0.55, 0.05); nub.rotation.z = -s2 * 0.25; U.head.add(nub); });
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), cream); muzzle.scale.set(1.1, 0.75, 0.6); muzzle.position.set(0, -0.14, 0.4); U.head.add(muzzle); const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), toon('#3a2e2a')); nose.scale.set(1.2, 0.8, 0.8); nose.position.set(0, -0.09, 0.5); U.head.add(nose); U.mouth.position.set(0, -0.19, 0.485); U.mouth.scale.setScalar(0.7);
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), cream); tail.position.set(0, 0.5, -0.3); inner.add(tail); }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
// 말랑이: 머리와 몸이 한 덩어리인 둥근 몸, 짧은 팔다리 (귤 꼭지 잎)
function buildBean(bodyC, accC) {
  const g = new THREE.Group(); const dark = toon('#3a2e2a'), body = toon(bodyC), acc = toon(accC);
  const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.46, 0.5, 10, 24), body); b.position.y = 0.92; b.scale.set(1, 1, 0.9); g.add(b);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 16), toon('#fff6e2')); belly.scale.set(0.8, 0.62, 0.4); belly.position.set(0, 0.66, 0.3); g.add(belly);
  [-1, 1].forEach((s) => { const leg = capsule(0.13, 0.1, acc); leg.position.set(s * 0.2, 0.2, 0); g.add(leg); const foot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), acc); foot.scale.set(1, 0.55, 1.3); foot.position.set(s * 0.2, 0.07, 0.06); g.add(foot);
    const arm = capsule(0.1, 0.18, body); arm.position.set(s * 0.52, 0.86, 0.02); arm.rotation.z = s * 0.7; g.add(arm);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), dark); eye.scale.set(0.9, 1.3, 0.5); eye.position.set(s * 0.17, 1.22, 0.4); g.add(eye); const hl = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff' })); hl.position.set(s * 0.17 + 0.02, 1.25, 0.44); g.add(hl);
    const ck = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff8f8a', transparent: true, opacity: 0.65 })); ck.scale.set(1, 0.6, 0.3); ck.position.set(s * 0.3, 1.1, 0.36); g.add(ck); });
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.017, 6, 12, Math.PI), dark); mouth.rotation.z = Math.PI; mouth.position.set(0, 1.1, 0.415); g.add(mouth);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.12, 6), toon('#6b4e36')); stem.position.y = 1.67; g.add(stem);
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), toon('#6fbf5a')); leaf.scale.set(1.3, 0.18, 0.7); leaf.position.set(0.14, 1.7, 0); leaf.rotation.z = 0.5; g.add(leaf);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.455, 0.05, 8, 28), acc); band.rotation.x = Math.PI / 2; band.scale.set(1, 0.9, 1); band.position.y = 0.5; g.add(band);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshBasicMaterial({ color: '#1c2a1a', transparent: true, opacity: 0.22, depthWrite: false })); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.03; g.add(blob);
  return g;
}
const y0f = (x, z) => height(x, z);
const place = (ch, x, z, ry) => { ch.position.set(x, height(x, z) + 0.02, z); ch.rotation.y = ry; scene.add(ch); };

// ---------- 샷 ----------
if (SHOT === 'chars') { const z = 52, x0 = pathX(z); (params.get('set') === 'v' ? ['base', 'tall', 'chibi', 'doll', 'deer'].map(variant) : [buildChar('runner'), buildChar('hood'), buildChar('mochi'), buildBean('#ffa83a', '#3c4a6b'), buildBean('#8fd0c2', '#ff8fa8')]).forEach((ch, i) => place(ch, x0 + (i - 2) * 1.35, z, 0));
  const y = height(x0, z); camera.fov = 30; camera.updateProjectionMatrix(); camera.position.set(x0 + 0.3, y + 1.3, z + 8.6); camera.lookAt(x0, y + 0.95, z); sun.target.position.set(x0, y, z);
} else { const z = 58, x0 = pathX(z); place(buildChar('mochi'), x0, z, Math.PI + 0.25); playerU.value.set(x0, y0f(x0, z), z);
  const y = height(x0, z);
  if (STYLE === 'diorama') { camera.fov = 30; camera.updateProjectionMatrix(); camera.position.set(x0 + 55, y + 70, z + 75); camera.lookAt(ORE.x * 0.5, 6, -60); }
  else if (SHOT === 'top') { const tx = ORE.x + ORE.cr + 8, tz = ORE.z - 6, ty = height(tx, tz); const ch = buildChar('mochi'); place(ch, tx, tz, Math.PI / 2 + 0.5); playerU.value.set(tx, ty, tz); camera.fov = 48; camera.updateProjectionMatrix(); camera.position.set(tx - 6.5, ty + 3.2, tz + 3.5); camera.lookAt(tx + 60, ty - 6, tz - 34); sun.target.position.set(tx, ty, tz); }
  else if (SHOT === 'wide') { camera.position.set(x0 + 2.4, y + 2.5, z + 7.2); camera.lookAt(x0 + 1.5, y + 3.2, z - 30); }
  else { camera.position.set(x0 - 16, y + 7, z + 22); camera.lookAt(ORE.x, 26, ORE.z); camera.fov = 50; camera.updateProjectionMatrix(); }
  sun.target.position.set(x0, y, z - 14); }
sun.position.copy(sun.target.position).addScaledVector(sunDir, 180);

// ---------- 후처리: 은은한 빛 번짐 + 색 보정 + 비네트 ----------
const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { samples: 4 });
const post = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ depthTest: false, uniforms: { t: { value: rt.texture }, px: { value: new THREE.Vector2(1 / innerWidth, 1 / innerHeight) }, sat: { value: M.sat }, warm: { value: new THREE.Vector3(...M.warm) }, glow: { value: M.glow }, mode: { value: ST.post } },
  vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `varying vec2 vU; uniform sampler2D t; uniform vec2 px; uniform float sat, glow; uniform vec3 warm; uniform int mode;
    float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float nz(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
    float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
    void main(){ vec3 c = texture2D(t, vU).rgb; vec3 b = vec3(0.0);
      if (mode == 3) { float k = smoothstep(0.2, 0.5, abs(vU.y - 0.52)) * 4.0; vec3 a = c; for (int i = 0; i < 12; i++) { float an = float(i) * 0.5236; float r = (i < 6) ? 0.5 : 1.0; a += texture2D(t, vU + vec2(cos(an), sin(an)) * px * k * r).rgb; } c = a / 13.0; }
      for (int i = 0; i < 12; i++) { float a = float(i) * 0.5236; float r = (i < 6) ? 7.0 : 18.0; vec3 s = texture2D(t, vU + vec2(cos(a), sin(a)) * px * r).rgb; b += max(s - 0.72, 0.0); }
      c += b / 12.0 * glow * (mode == 4 ? 0.9 : 2.2);
      float l = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(l), c, sat); c *= warm;
      c = c * (1.0 + c * 0.12) / (1.0 + c * 0.12 * 0.9);
      vec2 d = vU - 0.5; c *= 1.0 - dot(d, d) * 0.35;
      c = pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
      if (mode == 1) { vec3 q = floor(c * 7.0 + 0.5) / 7.0; c = mix(c, q, 0.85); c *= 0.95 + nz(vU / px * 0.6) * 0.1; }
      if (mode == 2) { float e = abs(lum(texture2D(t, vU + vec2(px.x * 1.5, 0.0)).rgb) - lum(texture2D(t, vU - vec2(px.x * 1.5, 0.0)).rgb)) + abs(lum(texture2D(t, vU + vec2(0.0, px.y * 1.5)).rgb) - lum(texture2D(t, vU - vec2(0.0, px.y * 1.5)).rgb));
        vec3 paper = vec3(0.965, 0.94, 0.88); float l2 = lum(c); vec3 wash = mix(vec3(l2), c, 0.55); float blot = nz(vU * vec2(9.0, 6.0)) * 0.5 + nz(vU * vec2(31.0, 23.0)) * 0.25;
        c = paper * mix(vec3(1.0), wash * 1.15, 0.78 + blot * 0.2); c -= smoothstep(0.03, 0.16, e) * 0.55 * vec3(0.9, 0.85, 0.8);
        vec2 dd = abs(vU - 0.5) * 2.0; float edge = smoothstep(0.72, 1.0, max(dd.x, dd.y) + (blot - 0.4) * 0.25); c = mix(c, paper, edge); c *= 0.97 + nz(vU / px * 0.5) * 0.06; }
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0); }` }));
const pScene = new THREE.Scene(); pScene.add(post); const pCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
let lastT = 0;
function frame(t) { const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t; cloudU.value = t / 1000 + 40; tickSeeds(t / 1000, dt); mats.forEach((m) => { if (m.uniforms.uT) m.uniforms.uT.value = t / 1000; }); renderer.setRenderTarget(rt); renderer.render(scene, camera); window.__info = { tris: renderer.info.render.triangles, calls: renderer.info.render.calls }; renderer.setRenderTarget(null); renderer.render(pScene, pCam); window.__ready = (window.__ready || 0) + 1; requestAnimationFrame(frame); }
requestAnimationFrame(frame);
