// 남송이오름: 실제 고도 자료로 세운 지형 + '늦은 오후' 그림체 (툰 재질, 붓질 땅, 플레이어 주변 풀, 따라다니는 그림자)
// 좌표: x 동쪽, z 남쪽. 실제 1m = 게임 K 단위 (캐릭터 키 2.45에 맞춘 축척)
import * as THREE from 'three';
import { NEAR, REL, FAR, FW, FH } from './namsongidata.js';
import { setMapImpl } from './world.js';
import { gradHard, gradSoft } from './toon.js';
import { LOW } from './gfx2.js';
import { TIER } from './quality.js';
import { COLLIDE, BOUND, HALLA, PATHCLEAR } from './balance.js';
import { createPathIndex, keepOffPath, keepOffArena, inArena } from './pathclear.js';
import { buildHalla } from './halla.js';
import { STREAM_GLSL } from './streamshape.js';
import { buildTrails } from './trailshape.js';

const T = THREE, PI = Math.PI;
export const K = 1.4;
const E = 1700 * K; // 가까운 땅 반폭
let seed = 20261115;
function rnd() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
const rr = (a, b) => a + rnd() * (b - a);
function sstep(a, b, x) { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); }
function hash(x, y) { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function fbm(x, y, o) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }

/* ---------- 고도 자료 ---------- */
const b64 = (s) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
const nearH = new Uint16Array(b64(NEAR).buffer), relH = b64(REL), farH = new Uint16Array(b64(FAR).buffer), NW = 171;
function bil(arr, w, hh, fx, fy, sc) { fx = Math.max(0, Math.min(w - 1.001, fx)); fy = Math.max(0, Math.min(hh - 1.001, fy)); const x0 = fx | 0, y0 = fy | 0, u = fx - x0, v = fy - y0, i = y0 * w + x0;
  return ((arr[i] * (1 - u) + arr[i + 1] * u) * (1 - v) + (arr[i + w] * (1 - u) + arr[i + w + 1] * u) * v) * sc; }
// 솟은 높이(실제 m). 인자는 게임 좌표
export const relAt = (x, z) => bil(relH, NW, NW, (x / K + 1700) / 20, (z / K + 1700) / 20, 1);
function cub(a, b, c, d, t) { return b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a))); }
function rawSmooth(mx, mz) { // 실제 m 좌표 → 실제 m 높이 (20m 격자를 곡선으로 이음)
  const fx = Math.max(1, Math.min(NW - 2.001, (mx + 1700) / 20)), fy = Math.max(1, Math.min(NW - 2.001, (mz + 1700) / 20)), x0 = fx | 0, y0 = fy | 0, u = fx - x0, v = fy - y0, r = [];
  for (let j = -1; j < 3; j++) { const i = (y0 + j) * NW + x0; r.push(cub(nearH[i - 1], nearH[i], nearH[i + 1], nearH[i + 2], u)); }
  return cub(r[0], r[1], r[2], r[3], v) * 0.1;
}
// 땅·풀·걷기가 같이 쓰는 높이 격자 (게임 단위)
const GN = LOW ? 171 : 341, CELL = 2 * E / (GN - 1);
const HG = new Float32Array(GN * GN), MK = new Uint8Array(GN * GN * 4);
for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) {
  const mx = -1700 + i * 3400 / (GN - 1), mz = -1700 + j * 3400 / (GN - 1), k = j * GN + i, r = bil(relH, NW, NW, (mx + 1700) / 20, (mz + 1700) / 20, 1);
  HG[k] = (rawSmooth(mx, mz) + (fbm(mx * 0.02, mz * 0.02, 3) - 0.5) * 3) * K;
  const m = fbm(mx * 0.004 + 5, mz * 0.004, 3);
  const forest = r < 10 ? Math.min(1, Math.max(0, (m - 0.5) * 6)) * (1 - sstep(6, 10, r)) + sstep(6, 10, r) : 1 - 0.7 * sstep(95, 120, r);
  const cx = Math.floor((mx + fbm(mx * 0.01, mz * 0.01, 2) * 30) / 70), cz = Math.floor((mz + fbm(mz * 0.008, mx * 0.008, 2) * 90) / 50);
  MK[k * 4] = Math.min(255, r / 160 * 255); MK[k * 4 + 1] = forest * 255; MK[k * 4 + 2] = hash(cx, cz) * 255; MK[k * 4 + 3] = 255;
}
export function nsHeight(x, z) { return bil(HG, GN, GN, (x + E) / CELL, (z + E) / CELL, 1); }
const H = nsHeight;

/* ---------- 길 ---------- */
// 게임 단위 선들 (#67 trailshape.js: 꺾인 곳 둥글게·굼부리 둘레 Y 자 갈림길). approach: 서남쪽 들머리 → 능선 남쪽 끝, rim: 말굽 능선(북쪽 끝 → 남쪽 끝)
// toCrater·toCraterB: 굼부리 가는 길과 둘레 앞 두 갈래, crater: 굼부리 둘레, north·northB: 둘레 북쪽 두 갈래 → 소로기촐리 쪽
export const nsPaths = buildTrails(K);
const SEGS = Object.values(nsPaths);
const PATH_W = 2.1; // 길 반폭
// 길 격자(2단위): 발소리·풀·나무 배치가 같이 씀
const SR = 2, SN = Math.ceil(2 * E / SR), surf = new Uint8Array(SN * SN);
// 점 사이도 1단위마다 찍어 곡선 길 전체가 빈틈없이 들어가게 (#67)
const fillSeg = (s) => { const o = []; for (let i = 0; i < s.length - 1; i++) { const a = s[i], b = s[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]))); for (let k = 0; k < n; k++) o.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); } o.push(s[s.length - 1]); return o; };
SEGS.forEach((s) => fillSeg(s).forEach(([x, z]) => { const r = Math.ceil((PATH_W + 1) / SR), ci = Math.floor((x + E) / SR), cj = Math.floor((z + E) / SR);
  for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) { if (i < 0 || j < 0 || i >= SN || j >= SN) continue; const px = -E + (i + 0.5) * SR, pz = -E + (j + 0.5) * SR; if (Math.hypot(px - x, pz - z) < PATH_W + 0.6) surf[j * SN + i] = 1; } }));
function nsSurface(x, z) { const i = Math.floor((x + E) / SR), j = Math.floor((z + E) / SR); if (i < 0 || j < 0 || i >= SN || j >= SN) return 0; return surf[j * SN + i]; }
// 길에서 d 안쪽인지 (거친 격자)
const TC = 24, trailCells = new Map();
SEGS.forEach((s) => s.forEach((p) => { const k = Math.floor(p[0] / TC) * 4099 + Math.floor(p[1] / TC); if (!trailCells.has(k)) trailCells.set(k, []); trailCells.get(k).push(p); }));
function nearTrail(x, z, d) { const ci = Math.floor(x / TC), cj = Math.floor(z / TC);
  for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) { const l = trailCells.get(i * 4099 + j); if (l) for (const p of l) if (Math.abs(p[0] - x) < d && Math.abs(p[1] - z) < d) return true; } return false; }
const TEA = [-1250 * K, 760 * K];
const inTea = (x, z) => { const u = (x - TEA[0]) * 0.94 + (z - TEA[1]) * 0.34, v = -(x - TEA[0]) * 0.34 + (z - TEA[1]) * 0.94; return Math.abs(u) < 330 * K && Math.abs(v) < 260 * K; };
// 능선에서 가장 높은 곳
export const nsSummit = (() => { let b = null, by = -1; nsPaths.rim.forEach((p) => { const y = H(p[0], p[1]); if (y > by) { by = y; b = p; } }); return { x: b[0], z: b[1], y: by }; })();
const tmpC = new T.Color();
function nsColor(x, z, h, c) { // 다른 시스템(예전 풀 등)이 물을 때 쓰는 대략의 땅 색
  if (nsSurface(x, z)) { c.set('#dcbb8c'); return; }
  const r = relAt(x, z); c.set('#62a64a').lerp(tmpC.set('#86c257'), vnoise(x * 0.05, z * 0.05)); if (r > 88) c.lerp(tmpC.set('#d8b562'), sstep(88, 122, r) * 0.7);
}
export function useNamsongi() { setMapImpl({ height: nsHeight, surface: nsSurface, color: nsColor, extent: E, seg: GN - 1 }); }

/* ---------- 시간대 ---------- */
const C = (h) => new T.Color(h);
const PRE = {
  day: { sun: C('#fff3da'), si: 0.8, sk: C('#d4e4ff'), gr: C('#a9bda0'), hi: 0.62, top: C('#3f8fe2'), hor: C('#cfe8f6'), sea: C('#2f9bc4'), cl: C('#ffffff'), cs: C('#c6d6f0'), glow: C('#fff2d0'), hal: C('#9fbcd8') },
  aft: { sun: C('#ffd69a'), si: 0.84, sk: C('#b7c6ff'), gr: C('#8f86b4'), hi: 0.58, top: C('#4f8fda'), hor: C('#ffe3bd'), sea: C('#3f93b8'), cl: C('#fff1d8'), cs: C('#c3b6dc'), glow: C('#ffd9a0'), hal: C('#a9b2d6') },
  set: { sun: C('#ff9458'), si: 0.9, sk: C('#a79fe2'), gr: C('#70609a'), hi: 0.54, top: C('#4458a8'), hor: C('#ffb07a'), sea: C('#5a78a8'), cl: C('#ffc49a'), cs: C('#8f7fb8'), glow: C('#ff9a58'), hal: C('#d9825e') },
  dawn: { sun: C('#ffc9b0'), si: 0.78, sk: C('#a9b4ee'), gr: C('#5f7a9a'), hi: 0.56, top: C('#3a4a9a'), hor: C('#ffb9c4'), sea: C('#4a6a9a'), cl: C('#ffd0d8'), cs: C('#8f93c8'), glow: C('#ffc0b0'), hal: C('#d99bb6') },
  night: { sun: C('#8fa8f0'), si: 0.42, sk: C('#5068b8'), gr: C('#1f4a5a'), hi: 0.62, top: C('#070b26'), hor: C('#24407a'), sea: C('#14244e'), cl: C('#5a6aa8'), cs: C('#2c3870'), glow: C('#bcd0ff'), hal: C('#101c42') },
};
const KEYS = [[-8, 'night'], [4, 'low'], [23, 'aft'], [50, 'day']];
const cur = {}; for (const k in PRE.aft) cur[k] = PRE.aft[k].isColor ? PRE.aft[k].clone() : PRE.aft[k];
function blendPre(el, morning) {
  const pick = (n) => PRE[n === 'low' ? (morning ? 'dawn' : 'set') : n];
  let a = pick(KEYS[0][1]), b = a, t = 0;
  for (let i = 0; i < KEYS.length - 1; i++) if (el >= KEYS[i][0]) { a = pick(KEYS[i][1]); b = pick(KEYS[i + 1][1]); t = Math.min(1, (el - KEYS[i][0]) / (KEYS[i + 1][0] - KEYS[i][0])); }
  t = t * t * (3 - 2 * t);
  for (const k in a) { if (a[k].isColor) cur[k].copy(a[k]).lerp(b[k], t); else cur[k] = a[k] + (b[k] - a[k]) * t; }
}

// bound: nsbound.js (#25). 있으면 돌담 밖 나무는 줄이고 돌담 자리는 비움
export function buildNamsongi({ scene, renderer, bound = null, clear = [], lanes = [] }) { // lanes: [{ pts, w 반폭 }] 길 그림에 더할 골목 (#57 가게 거리)
  const ib = bound ? bound.insideBy : () => 1e9;
  const cleared = (x, z) => clear.some((c) => Math.hypot(x - c.x, z - c.z) < c.clearR); // 건물 자리(가게 거리 #57): 나무·바위를 심지 않음
  const heightTex = new T.DataTexture(HG, GN, GN, T.RedFormat, T.FloatType); heightTex.magFilter = heightTex.minFilter = T.NearestFilter; heightTex.needsUpdate = true;
  const maskTex = new T.DataTexture(MK, GN, GN, T.RGBAFormat); maskTex.magFilter = maskTex.minFilter = T.LinearFilter; maskTex.needsUpdate = true;
  const pathTex = (() => {
    const PN = LOW ? 2048 : 4096, c = document.createElement('canvas'); c.width = c.height = PN; const x = c.getContext('2d'), k = PN / (2 * E);
    x.fillStyle = '#000'; x.fillRect(0, 0, PN, PN); x.strokeStyle = '#fff'; x.lineCap = x.lineJoin = 'round'; x.lineWidth = Math.max(2 * PATH_W * k, LOW ? 2.2 : 0);
    // 점 사이 가운데를 잇는 2차 곡선으로 그려 꺾임 없이 매끈하게 (#67, 선과 어긋남 0.2단위 안)
    const P = (p) => [(p[0] + E) * k, (p[1] + E) * k];
    (bound ? SEGS.concat([bound.gate.path]) : SEGS).forEach((s) => { x.beginPath(); const q = s.map(P); x.moveTo(q[0][0], q[0][1]);
      for (let i = 1; i < q.length - 1; i++) x.quadraticCurveTo(q[i][0], q[i][1], (q[i][0] + q[i + 1][0]) / 2, (q[i][1] + q[i + 1][1]) / 2);
      x.lineTo(q[q.length - 1][0], q[q.length - 1][1]); x.stroke(); });
    lanes.forEach((l) => { x.lineWidth = 2 * l.w * k; x.lineCap = 'butt'; x.beginPath(); l.pts.forEach((p, i) => { const px = (p[0] + E) * k, py = (p[1] + E) * k; i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke(); });
    const t = new T.CanvasTexture(c); t.format = T.RedFormat; t.flipY = false; t.minFilter = T.LinearMipmapLinearFilter; t.magFilter = T.LinearFilter; t.anisotropy = 4; return t;
  })();
  const GS = (LOW ? 34 : 46) * K;
  // 구역 번호 격자 (#46): ZN×ZN, 한 칸 = 구역 번호. setZoneGrid 로 채움
  const ZN = 256, zoneData = new Uint8Array(ZN * ZN), zoneTex = new T.DataTexture(zoneData, ZN, ZN, T.RedFormat, T.UnsignedByteType);
  zoneTex.magFilter = zoneTex.minFilter = T.NearestFilter; zoneTex.needsUpdate = true;
  const f = (v, d = 1) => v.toFixed(d);
  const TERR = `
#define GS ${f(GS)}
#define GN ${f(GN)}
#define CELL ${f(CELL, 5)}
#define EXT ${f(E)}
#define KS ${f(K, 3)}
#define ZN ${ZN}
uniform highp sampler2D uHt;
uniform sampler2D uMask; uniform sampler2D uPathT; uniform sampler2D uStroke;
uniform vec3 uG1; uniform vec3 uG2; uniform vec3 uG3; uniform vec3 uGold; uniform vec3 uForest; uniform vec3 uTea; uniform vec3 uPath;
uniform vec3 uPl; uniform float uTime; uniform float uWind;
uniform sampler2D uZoneT; uniform vec4 uZoneB; uniform float uDry[6]; uniform vec3 uMood[6]; uniform vec2 uWet; uniform float uSnow[6];
float zsnow(ivec2 i){ int k=clamp(int(texelFetch(uZoneT,clamp(i,ivec2(0),ivec2(ZN-1)),0).r*255.0+0.5),0,5); return uSnow[k]; }
// 쌓인 눈 (#180 철 이벤트): 구역마다 0~1, 경계는 네 칸 섞음
float zoneSnow(vec2 p){ if(uZoneB.z<=0.0) return 0.0; vec2 f=(p-uZoneB.xy)/uZoneB.z-0.5; vec2 fl=floor(f); ivec2 i=ivec2(fl); vec2 u=f-fl;
  return mix(mix(zsnow(i),zsnow(i+ivec2(1,0)),u.x),mix(zsnow(i+ivec2(0,1)),zsnow(i+ivec2(1,1)),u.x),u.y); }
vec4 zmood(ivec2 i){ int k=clamp(int(texelFetch(uZoneT,clamp(i,ivec2(0),ivec2(ZN-1)),0).r*255.0+0.5),0,5); return vec4(uDry[k],uMood[k]); }
// 구역 마른 정도 (#46): x 1 메마름 ~ 0 보통 ~ - 무성함. yzw 구역 분위기 (#136: 밝음·억새빛·어두움). 구역 번호 격자(가장 가까운 칸)를 네 칸 섞어 경계를 부드럽게
vec4 zoneMood(vec2 p){ if(uZoneB.z<=0.0) return vec4(0.0); vec2 f=(p-uZoneB.xy)/uZoneB.z-0.5; vec2 fl=floor(f); ivec2 i=ivec2(fl); vec2 u=f-fl;
  return mix(mix(zmood(i),zmood(i+ivec2(1,0)),u.x),mix(zmood(i+ivec2(0,1)),zmood(i+ivec2(1,1)),u.x),u.y); }
float zoneDry(vec2 p){ return zoneMood(p).x; }
float terrainH(vec2 p){
  vec2 f=clamp((p+EXT)/CELL,0.0,GN-1.001); ivec2 i=ivec2(f); vec2 u=f-vec2(i);
  float a=texelFetch(uHt,i,0).r, b=texelFetch(uHt,i+ivec2(1,0),0).r, c=texelFetch(uHt,i+ivec2(0,1),0).r, d=texelFetch(uHt,i+ivec2(1,1),0).r;
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
vec2 muv(vec2 p){ return (p+EXT)/(2.0*EXT); }
float pathMask(vec2 p){ return smoothstep(0.25,0.6,texture2D(uPathT,muv(p)).r); }
float goldMask(vec2 p){ return smoothstep(88.0,122.0,texture2D(uMask,muv(p)).r*160.0); }
float forestMask(vec2 p){ return texture2D(uMask,muv(p)).g; }
float teaMask(vec2 p){ vec2 q=p/KS-vec2(-1250.0,760.0); float tu=q.x*0.94+q.y*0.34, tv=-q.x*0.34+q.y*0.94; return step(abs(tu),330.0)*step(abs(tv),260.0); }
vec3 groundColor(vec2 p){
  vec4 mk=texture2D(uMask,muv(p)); vec2 s=p/KS;
  float n=texture2D(uStroke,s*0.021).r;
  float n2=texture2D(uStroke,s*0.083+0.37).g;
  vec3 g=mix(uG1,uG2,smoothstep(0.3,0.7,n));
  g=mix(g,uG3,smoothstep(0.52,0.78,n2)*0.55);
  g*=0.9+0.22*mk.b;
  g=mix(g,uForest*(0.82+0.36*n),mk.g*0.78);
  g=mix(g,uGold,smoothstep(88.0,122.0,mk.r*160.0)*(0.55+0.4*n));
  g=mix(g,uTea*(0.8+0.3*n2),teaMask(p));
  vec3 g0=g; // 구역 분위기 앞의 색 (#147 날씨 아래 한도)
  vec4 zm=zoneMood(p); float pm=pathMask(p), zd=zm.x*(1.0-pm);
  float lum=dot(g,vec3(0.3,0.59,0.11));
  g=mix(g,mix(vec3(lum),g,0.35)*vec3(1.04,0.95,0.7)*(0.84+0.1*n2),max(zd,0.0)*mix(1.0,0.55,zm.y)); // 메마른 땅: 탁한 누런 빛 (초보 구역은 덜)
  g=mix(g,g*vec3(0.9,1.1,0.86),max(-zd,0.0)); // 다 핀 구역: 더 푸름
  // 구역 분위기 (#136): 초보 밝은 풀빛 · 중수 억새빛 · 고수 어두운 풀빛과 붉은 흙 (다 핀 구역은 어두움이 걷힘)
  float calm=1.0-clamp(-zm.x/0.3,0.0,1.0), dk=zm.w*calm, lum2=dot(g,vec3(0.3,0.59,0.11)), off=1.0-pm;
  g=mix(g,g*vec3(1.08,1.17,0.88),zm.y*off);
  g=mix(g,vec3(lum2)*vec3(1.25,1.1,0.68)*(0.94+0.14*n),zm.z*0.5*off);
  g=mix(g,g*vec3(0.66,0.78,0.66),dk*off);
  g=mix(g,vec3(0.5,0.27,0.19)*(0.8+0.3*n),dk*smoothstep(0.48,0.74,n2)*0.7*off);
  g=mix(g,mix(uPath,vec3(0.72,0.45,0.34),dk*0.5)*(0.88+0.24*n2),pm);
  // 비·흐림 (#147): 젖은 땅은 채도·밝기를 낮춤. 구역 어두움과 겹쳐도 uWet.y(원래 밝기 비율) 아래로는 안 내려감
  float wl=dot(g,vec3(0.3,0.59,0.11)); vec3 wg=mix(g,vec3(wl)*vec3(0.95,1.0,1.03),uWet.x*0.62)*(1.0-0.3*uWet.x);
  vec3 o=max(wg,min(g,g0*uWet.y));
  float sn=zoneSnow(p); // 쌓인 눈 (#180): 붓질 결을 따라 얼룩지게, 길은 조금 덜
  if(sn>0.001){ float cov=sn*smoothstep(0.18,0.62,n*0.7+n2*0.5+sn*0.35)*(1.0-0.35*pm); o=mix(o,vec3(0.9,0.93,0.98)*(0.93+0.09*n2),cov); }
  return o;
}`;

  /* 붓질 텍스처 */
  function strokes(n, minR, maxR, el) {
    const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
    x.fillStyle = '#808080'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < n; i++) {
      const px = rnd() * 512, py = rnd() * 512, r = rr(minR, maxR), a = rnd() * PI, v = rnd() < 0.5 ? 255 : 0;
      x.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + rr(0.07, 0.17) + ')';
      for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) { x.beginPath(); x.ellipse(px + ox, py + oy, r * el, r, a, 0, 7); x.fill(); }
    }
    return x.getImageData(0, 0, 512, 512).data;
  }
  const sR = strokes(240, 20, 64, 1.6), sG = strokes(520, 6, 20, 2.6), sB = strokes(900, 2, 7, 4);
  const sd = new Uint8Array(512 * 512 * 4);
  for (let i = 0; i < 512 * 512; i++) { sd[i * 4] = sR[i * 4]; sd[i * 4 + 1] = sG[i * 4]; sd[i * 4 + 2] = sB[i * 4]; sd[i * 4 + 3] = 255; }
  const strokeTex = new T.DataTexture(sd, 512, 512, T.RGBAFormat);
  strokeTex.wrapS = strokeTex.wrapT = T.RepeatWrapping; strokeTex.magFilter = T.LinearFilter; strokeTex.minFilter = T.LinearMipmapLinearFilter; strokeTex.generateMipmaps = true; strokeTex.needsUpdate = true;

  const U = {
    uStroke: { value: strokeTex }, uHt: { value: heightTex }, uMask: { value: maskTex }, uPathT: { value: pathTex },
    uStream: { value: new T.Vector4(0, 0, 1, 0) }, uStreamW: { value: -1 }, uStreamM: { value: new T.Vector2(-1e4, 1e4) }, // 들머리 개울(#31, #41): 가운데 xz, 길 방향 fx fz, 반폭 (음수면 없음), 돌담과 만나는 lat 둘
    uTime: { value: 0 }, uWind: { value: 1 }, uPl: { value: new T.Vector3() }, uPlV: { value: new T.Vector3(0, 0, -8) },
    uG1: { value: C('#62a64a') }, uG2: { value: C('#86c257') }, uG3: { value: C('#b9d264') },
    uZoneT: { value: zoneTex }, uZoneB: { value: new T.Vector4(0, 0, 0, 0) }, uDry: { value: [0, 0, 0, 0, 0, 0] }, // 구역 마른 정도 (#46, bloom.js 가 채움)
    uMood: { value: [0, 1, 2, 3, 4, 5].map(() => new T.Vector3()) }, // 구역 분위기 (#136, zonelook.js 가 채움): 밝음·억새빛·어두움
    uSnow: { value: [0, 0, 0, 0, 0, 0] }, // 쌓인 눈 (#180, game/season.js 가 채움): [구역] 0~1
    uWet: { value: new T.Vector2(0, 0.42) }, // 날씨 젖음 (#147): x 젖은 정도, y 가장 어두울 때 원래 밝기 비율
    uGold: { value: C('#d8b562') }, uForest: { value: C('#4c8442') }, uTea: { value: C('#3f8a48') }, uPath: { value: C('#dcbb8c') },
  };

  /* 가까운 땅 */
  const terrain = (() => {
    const g = new T.PlaneGeometry(2 * E, 2 * E, GN - 1, GN - 1); g.rotateX(-PI / 2);
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, HG[i]);
    g.computeVertexNormals();
    const m = new T.MeshToonMaterial({ color: 0xffffff, gradientMap: gradSoft });
    m.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, U);
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp=(modelMatrix*vec4(transformed,1.0)).xyz;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;\n' + TERR)
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb*=groundColor(vWp.xz)*(0.9+0.2*texture2D(uStroke,vWp.xz/KS*0.31).b);');
    };
    const mesh = new T.Mesh(g, m); mesh.name = 'terrain'; mesh.receiveShadow = true; return mesh;
  })();

  /* 먼 땅: 서쪽 바다부터 한라산까지 (150m 격자) */
  {
    const g = new T.PlaneGeometry((41100 - 150) * K, (22050 - 150) * K, FW - 1, FH - 1); g.rotateX(-PI / 2); g.translate(5475 * K, 0, 975 * K);
    const p = g.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) / K, z = p.getZ(i) / K; let y = farH[i] * 0.1; if (y < 1.5) y = -8; if (y > HALLA.demCap) y = HALLA.demCap + (y - HALLA.demCap) * HALLA.demKeep; /* 한라산 원경(#81)과 겹치지 않게 */ if (Math.abs(x) < 1560 && Math.abs(z) < 1560) y -= 45; p.setY(i, y * K); }
    g.computeVertexNormals();
    const c = new T.Color(), g1 = C('#62a64a'), g2 = C('#86c257'), fo = C('#4c8442'), rock = C('#9a9c90'), sand = C('#c9c088');
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) / K, y = p.getY(i) / K, z = p.getZ(i) / K, m = fbm(x * 0.0012, z * 0.0012, 3);
      c.copy(fo).lerp(g1, sstep(0.36, 0.5, m)).lerp(g2, sstep(0.5, 0.68, m));
      if (y > 900) c.lerp(rock, Math.min(1, (y - 900) / 800) * 0.7); if (y < 14) c.lerp(sand, 0.35);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    scene.add(new T.Mesh(g, new T.MeshToonMaterial({ vertexColors: true, gradientMap: gradSoft })));
  }

  /* 풀: 플레이어 주변에만, 밟으면 눕는다. 능선 위는 억새처럼 길고 누렇다 */
  const grass = (() => {
    const N = [9000, 17000, 52000][TIER], w = 0.055 * K; // 성능 단계 낮음은 더 적게 (#79)
    const pos = [], idx = [];
    function blade(ox, oz, ax, az, h) { const b = pos.length / 3; [[-w, 0], [w, 0], [-w * 0.62, 0.5], [w * 0.62, 0.5], [0, 1]].forEach((v) => pos.push(ox + ax * v[0], v[1] * h, oz + az * v[0])); idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2, b + 2, b + 3, b + 4); }
    blade(0, 0, 1, 0, 1); blade(0.07 * K, 0.05 * K, 0.2, 1, 0.72);
    const g = new T.InstancedBufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const a = new Float32Array(N * 4); for (let i = 0; i < N; i++) { a[i * 4] = rnd() * GS; a[i * 4 + 1] = rnd() * GS; a[i * 4 + 2] = rnd(); a[i * 4 + 3] = rnd(); }
    g.setAttribute('aOff', new T.InstancedBufferAttribute(a, 4)); g.instanceCount = N;
    const m = new T.MeshToonMaterial({ color: 0xffffff, gradientMap: gradSoft, side: T.DoubleSide });
    m.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, U);
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aOff;\nvarying vec3 vCol;\nuniform vec4 uStream; uniform float uStreamW; uniform vec2 uStreamM;\n' + STREAM_GLSL + TERR)
        .replace('#include <beginnormal_vertex>', `
      vec2 gc=uPl.xz+mod(aOff.xy-uPl.xz+GS*0.5,GS)-GS*0.5;
      float gh=terrainH(gc);
      float ge=1.4;
      vec3 objectNormal=normalize(vec3(terrainH(gc-vec2(ge,0.0))-terrainH(gc+vec2(ge,0.0)),2.0*ge,terrainH(gc-vec2(0.0,ge))-terrainH(gc+vec2(0.0,ge))));`)
        .replace('#include <begin_vertex>', `
      float gold=goldMask(gc);
      float sc=mix(0.26,0.56,aOff.z)*mix(1.0,2.4,gold)*KS;
      float ptc=texture2D(uStroke,gc/KS*0.017+0.5).r;
      sc*=0.3+0.7*smoothstep(0.34,0.6,ptc);
      float pres=1.0-pathMask(gc); // 풀이 있는 정도: 길·마당·가게 거리·찻밭·개울 안은 0 (눕는 효과도 여기에 곱함 #73)
      pres*=1.0-teaMask(gc);
      float so=stOut(gc,uStream,uStreamW,uStreamM); // 개울 안엔 풀 없음 (굽이·폭은 streamshape.js)
      sc*=pres*step(0.9,so);
      pres*=smoothstep(0.9,2.6,so);
      sc*=1.0-0.45*forestMask(gc)*(1.0-gold);
      vec2 dv=gc-uPl.xz; float dd=length(dv);
      sc*=1.0-smoothstep(GS*0.36,GS*0.5,dd);
      float ang=aOff.w*6.2831853; float ca=cos(ang), sa=sin(ang);
      float y=position.y;
      vec3 transformed=vec3(gc.x+ca*position.x-sa*position.z, gh+y*sc, gc.y+sa*position.x+ca*position.z);
      float wv=sin(uTime*1.5+gc.x*0.16+gc.y*0.12)+0.5*sin(uTime*2.6+gc.x*0.5-gc.y*0.29);
      transformed.xz+=vec2(0.85,0.45)*wv*0.11*uWind*y*y*sc;
      float push=(1.0-smoothstep(0.35,2.1,dd))*y*pres;
      transformed.xz+=normalize(dv+vec2(0.0001))*push*0.7;
      transformed.y-=push*sc*0.6;
      vec3 gcol=groundColor(gc);
      vec3 tip=mix(gcol*vec3(1.06,1.06,0.86),vec3(0.96,0.9,0.74),gold*0.8);
      vCol=mix(gcol*0.84,tip*1.08,y);`);
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vCol;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb*=vCol;')
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal=normalize(vNormal);');
    };
    const mesh = new T.Mesh(g, m); mesh.frustumCulled = false; mesh.receiveShadow = true; scene.add(mesh);
    return { mesh, set(v) { mesh.visible = v; }, update() {}, noStream(x, z, fx, fz, w, walls = [-1e4, 1e4]) { U.uStream.value.set(x, z, fx, fz); U.uStreamW.value = w; U.uStreamM.value.set(walls[0], walls[1]); } };
  })();

  /* 나무·바위용 재질: 흔들림 + 캐릭터를 가리면 점무늬로 비침 */
  function enhance(m, sway, tint) {
    m.onBeforeCompile = (s) => {
      s.uniforms.uTime = U.uTime; s.uniforms.uPlV = U.uPlV; s.uniforms.uWet = U.uWet;
      if (sway) s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;' + (tint ? '\nattribute vec3 aTint;\nattribute float aTrunk;' : ''))
        .replace('#include <color_vertex>', '#include <color_vertex>' + (tint ? '\nvColor.rgb*=mix(aTint,vec3(1.0),aTrunk);' : ''))
        .replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float ph=instanceMatrix[3].x*0.31+instanceMatrix[3].z*0.23;
      #else
        float ph=0.0;
      #endif
      float swy=max(position.y-1.5,0.0);
      transformed.x+=sin(uTime*1.2+ph+position.y*0.5)*0.035*swy;
      transformed.z+=sin(uTime*0.9+ph*1.7+position.x)*0.025*swy;`);
      s.fragmentShader = s.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n{ float wl=dot(diffuseColor.rgb,vec3(0.3,0.59,0.11)); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(wl),uWet.x*0.55)*(1.0-0.22*uWet.x); }') // 비 (#147)
        .replace('#include <common>', `#include <common>
      uniform vec3 uPlV; uniform vec2 uWet;
      float bayer4(vec2 p){ ivec2 i=ivec2(mod(p,4.0)); int k=i.x+i.y*4;
        float m[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.); return (m[k]+0.5)/16.0; }`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      { float fz=vViewPosition.z; float pz=-uPlV.z;
        if(fz<pz-1.7){ float d=length(-vViewPosition.xy/fz-uPlV.xy/pz);
          float al=max(smoothstep(0.07,0.2,d),0.14);
          if(al<bayer4(gl_FragCoord.xy)) discard; } }`);
    };
    return m;
  }
  function merge(list) {
    let n = 0; list.forEach((g) => { n += g.attributes.position.count; });
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), UV = new Float32Array(n * 2), CC = new Float32Array(n * 3), KK = new Float32Array(n); let o = 0;
    for (const g of list) {
      const c = g.attributes.position.count;
      P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); UV.set(g.attributes.uv.array, o * 2);
      if (g.attributes.color) CC.set(g.attributes.color.array, o * 3); else CC.fill(1, o * 3, (o + c) * 3);
      if (g.userData.trunk) KK.fill(1, o, o + c);
      o += c;
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(N, 3));
    g.setAttribute('uv', new T.BufferAttribute(UV, 2)); g.setAttribute('color', new T.BufferAttribute(CC, 3)); g.setAttribute('aTrunk', new T.BufferAttribute(KK, 1));
    return g;
  }
  const leafTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#e6ecdc'; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 90; i++) { const px = rnd() * 128, py = rnd() * 128, r = rr(5, 13);
      x.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,.5)' : 'rgba(120,150,105,.3)';
      for (const ox of [-128, 0, 128]) for (const oy of [-128, 0, 128]) { x.beginPath(); x.ellipse(px + ox, py + oy, r * 1.7, r, rnd() * 3, 0, 7); x.fill(); } }
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(2, 2); return t;
  })();
  // 뭉게 수관. flat이 작을수록 납작(소나무), baseY는 가지가 시작하는 높이
  function blobs(det, k, baseY, spread, flat, r0, r1) {
    const list = [], cc = new T.Vector3(0, baseY + 0.9, 0);
    for (let i = 0; i < k; i++) {
      const r = i === 0 ? rr(r0 * 1.05, r1 * 1.2) : rr(r0 * 0.7, r1);
      const g = new T.IcosahedronGeometry(r, det);
      const c = i === 0 ? new T.Vector3(0, baseY + 0.8, 0) : new T.Vector3(rr(-spread, spread), baseY + rr(0.1, 1.9), rr(-spread, spread));
      const p = g.attributes.position, n = g.attributes.normal, col = new Float32Array(p.count * 3), v = new T.Vector3(), b = new T.Vector3();
      for (let j = 0; j < p.count; j++) {
        v.fromBufferAttribute(p, j); b.copy(v).normalize();
        v.multiplyScalar(1 + 0.1 * Math.sin(v.x * 3.1 + v.y * 2.3 + v.z * 4.7)); v.y *= flat; v.add(c);
        p.setXYZ(j, v.x, v.y, v.z);
        const ff = v.clone().sub(cc).normalize(); b.lerp(ff, 0.72).normalize(); n.setXYZ(j, b.x, b.y, b.z);
        const s = 0.74 + 0.26 * sstep(baseY - 0.6, baseY + 2.4, v.y); col[j * 3] = col[j * 3 + 1] = col[j * 3 + 2] = s;
      }
      g.setAttribute('color', new T.BufferAttribute(col, 3)); list.push(g);
    }
    return list;
  }
  function trunk(h, r0, r1, seg, rgb) {
    const g = new T.CylinderGeometry(r0, r1, h, seg, 1, true).toNonIndexed(); g.translate(0, h / 2 - 0.3, 0);
    const n = g.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { col[i * 3] = rgb[0]; col[i * 3 + 1] = rgb[1]; col[i * 3 + 2] = rgb[2]; }
    g.setAttribute('color', new T.BufferAttribute(col, 3)); g.userData.trunk = true; return g;
  }
  const PINE_BARK = [0.5, 0.36, 0.3], OAK_BARK = [0.48, 0.36, 0.3];
  const pineGeo = (hi) => merge(blobs(hi ? 1 : 0, hi ? 6 : 4, 4.6, 1.7, 0.62, 1.9, 2.6).concat(blobs(hi ? 1 : 0, 1, 7.6, 0, 0.7, 1.3, 1.5), [trunk(6.4, 0.3, 0.5, hi ? 7 : 5, PINE_BARK)]));
  const oakGeo = (hi) => merge(blobs(hi ? 1 : 0, hi ? 5 : 3, 2.3, 1.5, 0.86, 1.5, 1.9).concat([trunk(3.6, 0.17, 0.3, hi ? 7 : 5, OAK_BARK)]));
  const treeMat = enhance(new T.MeshToonMaterial({ color: 0xffffff, vertexColors: true, map: leafTex, gradientMap: gradHard }), true, true);

  /* 나무는 칸으로 나눠 둔다. 가까운 칸만 자세한 모양으로 그리고 그림자를 떨어뜨린다 */
  const solids = []; // 충돌 목록 [x, z, 반지름] (#15)
  const CH = 12, CSZ = 2 * E / CH, chunks = [], dummy = new T.Object3D();
  function share(geo, tint) { const g = new T.BufferGeometry(); for (const k in geo.attributes) g.setAttribute(k, geo.attributes[k]); g.setAttribute('aTint', tint); if (!geo.boundingSphere) geo.computeBoundingSphere(); g.boundingSphere = geo.boundingSphere; g.boundingBox = geo.boundingBox; return g; }
  function plant(geoHi, geoLo, spots) {
    const bk = new Map();
    spots.forEach((s) => { const k = Math.floor((s.x + E) / CSZ) + CH * Math.floor((s.z + E) / CSZ); if (!bk.has(k)) bk.set(k, []); bk.get(k).push(s); });
    bk.forEach((list, k) => {
      const cx = -E + (k % CH + 0.5) * CSZ, cz = -E + (Math.floor(k / CH) + 0.5) * CSZ; let y0 = 1e9, y1 = -1e9;
      list.forEach((s) => { s.y = H(s.x, s.z) - 0.4; y0 = Math.min(y0, s.y); y1 = Math.max(y1, s.y); });
      const cy = (y0 + y1) / 2;
      const tint = new T.InstancedBufferAttribute(new Float32Array(list.length * 3), 3);
      list.forEach((s, i) => tint.setXYZ(i, s.c.r, s.c.g, s.c.b));
      const mk = (geo, hi) => { const im = new T.InstancedMesh(share(geo, tint), treeMat, list.length); im.position.set(cx, cy, cz);
        list.forEach((s, i) => { dummy.position.set(s.x - cx, s.y - cy, s.z - cz); dummy.rotation.set(0, s.r, 0); dummy.scale.set(s.s, s.s * s.t, s.s); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
        im.name = 'tree'; im.castShadow = hi; im.receiveShadow = hi; im.visible = !hi; scene.add(im); return im; };
      chunks.push({ cx, cz, hi: mk(geoHi, true), lo: mk(geoLo, false) });
    });
  }
  {
    const CN = LOW ? 3200 : 6200, BN = LOW ? 1300 : 2600, pines = [], oaks = [];
    const pineCols = ['#3f7a4a', '#38704a', '#4a8650', '#2f6645', '#447f44'], oakCols = ['#5d9a45', '#6aa84a', '#78b24e', '#4f8c44', '#8ab84f', '#c9b04e', '#d68f45'];
    for (let k = 0; k < 90000 && (pines.length < CN || oaks.length < BN); k++) {
      const x = (rnd() - 0.5) * 3300 * K, z = (rnd() - 0.5) * 3300 * K, r = relAt(x, z);
      if (nearTrail(x, z, (r > 100 ? 13 : 7) * K) || inTea(x, z) || Math.hypot(x - nsSummit.x, z - nsSummit.z) < 45 * K) continue;
      if (r > 10) { if (pines.length < CN && rnd() < (r > 100 ? 0.12 : 0.8)) pines.push({ x, z, r: rnd() * 6.28, s: rr(1.05, 1.6) * K, t: rr(0.95, 1.4), c: C(pineCols[Math.floor(rnd() * pineCols.length)]) }); }
      else if (oaks.length < BN && fbm(x / K * 0.004 + 5, z / K * 0.004, 3) > 0.5 && rnd() < 0.55) oaks.push({ x, z, r: rnd() * 6.28, s: rr(1.3, 2.1) * K, t: rr(0.9, 1.15), c: C(oakCols[Math.floor(rnd() * rnd() * oakCols.length)]) });
    }
    // 돌담 안은 그대로, 돌담 자리는 비우고, 밖은 일부만 남기고 아주 먼 것은 뺌 (#25). 충돌은 안쪽 나무만
    const keep = (s) => { if (cleared(s.x, s.z)) return false; const d = ib(s.x, s.z); s.inside = d > 4; return s.inside || (d < -5 && d > -BOUND.outTreeFar && hash(s.x * 3.1, s.z * 2.7) < BOUND.outTrees); };
    const P2 = pines.filter(keep), O2 = oaks.filter(keep);
    plant(pineGeo(true), pineGeo(false), P2); plant(oakGeo(true), oakGeo(false), O2);
    P2.forEach((s) => { if (s.inside) solids.push([s.x, s.z, s.s * COLLIDE.pine]); }); O2.forEach((s) => { if (s.inside) solids.push([s.x, s.z, s.s * COLLIDE.oak]); });
  }
  const HI_R = (LOW ? 260 : 380) * K;

  /* 녹차밭 (서남쪽) */
  {
    const g = new T.BoxGeometry(34 * K, 1.7 * K, 2.8 * K, 6, 1, 1); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setZ(i, p.getZ(i) * 0.55);
    g.computeVertexNormals();
    const items = []; for (let v = -250; v <= 250; v += 7) for (let u = -310; u <= 310; u += 35) items.push([(-1250 + u * 0.94 - v * 0.34) * K, (760 + u * 0.34 + v * 0.94) * K]);
    const im = new T.InstancedMesh(g, new T.MeshToonMaterial({ color: 0x4a9a52, gradientMap: gradHard }), items.length);
    items.forEach((s, i) => { dummy.position.set(s[0], H(s[0], s[1]) + 0.75 * K, s[1]); dummy.rotation.set(0, -0.347, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
    scene.add(im);
  }

  /* 현무암: 길가 바위 */
  const allPts = []; SEGS.forEach((s) => s.forEach((p) => allPts.push(p)));
  const pathIdx = createPathIndex([...SEGS.map((pts) => ({ pts, w: PATH_W })), ...lanes]); let rockStat = null; /* #227 */
  {
    const g = new T.IcosahedronGeometry(1, 1); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + 0.2 * Math.sin(x * 5.3 + y * 3.7 + z * 4.1); p.setXYZ(i, x * k, y * k * 0.8, z * k); }
    g.computeVertexNormals();
    const mat = enhance(new T.MeshToonMaterial({ color: 0xffffff, gradientMap: gradHard }), false);
    const items = [];
    allPts.forEach((q) => { if (rnd() < 0.22) { const a = rnd() * 6.28, d = rr(4.6, 11) * K; items.push({ x: q[0] + Math.cos(a) * d, z: q[1] + Math.sin(a) * d, s: rr(0.3, 1.1) * K }); } });
    for (let i = items.length - 1; i >= 0; i--) if (ib(items[i].x, items[i].z) < 3 || cleared(items[i].x, items[i].z)) items.splice(i, 1); // 돌담 밖·돌담 자리 바위는 뺌 (#25)
    items.forEach((s) => { s.r = s.s * PATHCLEAR.rockR; });
    const kept = keepOffPath(items, pathIdx, (x, z) => ib(x, z) >= 3 && !cleared(x, z)); items.length = 0; items.push(...kept.items); rockStat = { ...kept.stat, kept: items.length, bad: items.filter((q) => pathIdx.onPath(q.x, q.z, q.r)).length }; /* 길 둘레 비우기 (#227) */
    const off = keepOffArena(items, (x, z) => ib(x, z) >= 3 && !cleared(x, z) && !pathIdx.onPath(x, z, 0)); items.length = 0; items.push(...off.items); rockStat.arena = off.stat; rockStat.inArena = items.filter((q) => inArena(q.x, q.z, q.r)).length; /* 서바이벌 터 비우기 (#253) */
    const im = new T.InstancedMesh(g, mat, items.length), c = new T.Color();
    items.forEach((s, i) => {
      dummy.position.set(s.x, H(s.x, s.z), s.z); dummy.rotation.set(rnd() * 3, rnd() * 6, rnd() * 3);
      dummy.scale.set(s.s * rr(0.9, 1.25), s.s * rr(0.75, 1), s.s * rr(0.9, 1.25)); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
      const v = rr(0.27, 0.4); im.setColorAt(i, c.setRGB(v, v, v * 1.1));
    });
    im.name = 'path-rock'; im.castShadow = true; im.receiveShadow = true; scene.add(im);
    items.forEach((s) => { if (s.s * COLLIDE.rock >= 0.45) solids.push([s.x, s.z, s.s * COLLIDE.rock]); });
  }

  /* 길가 꽃 무리 */
  {
    const g = new T.SphereGeometry(0.075 * K, 6, 4); g.scale(1, 0.55, 1);
    const cols = ['#ffffff', '#ffe27a', '#ff9fc0', '#c9a2ff', '#ff8a1f'], items = [];
    allPts.forEach((q) => {
      if (rnd() > 0.3) return;
      const a = rnd() * 6.28, d = rr(3.5, 16) * K, cx = q[0] + Math.cos(a) * d, cz = q[1] + Math.sin(a) * d, c = C(cols[Math.floor(rnd() * cols.length)]);
      const n = 5 + Math.floor(rnd() * 9);
      for (let i = 0; i < n; i++) { const x = cx + rr(-1.6, 1.6) * K, z = cz + rr(-1.6, 1.6) * K; if (nearTrail(x, z, 2.8 * K) || ib(x, z) < 1 || inArena(x, z, 0.3)) continue; items.push({ x, z, c }); } /* 서바이벌 터 안엔 두지 않음 (#253) */
    });
    const im = new T.InstancedMesh(g, new T.MeshToonMaterial({ color: 0xffffff, gradientMap: gradSoft }), items.length);
    items.forEach((s, i) => { dummy.position.set(s.x, H(s.x, s.z) + rr(0.3, 0.5) * K, s.z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(rr(0.8, 1.4)); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, s.c); });
    im.name = 'path-flower'; im.receiveShadow = true; scene.add(im);
  }

  /* 하늘, 바다, 구름 */
  const skyU = { uTop: { value: new T.Color() }, uHor: { value: new T.Color() }, uSun: { value: new T.Vector3(0, 1, 0) }, uSunCol: { value: new T.Color() },
    uSea: { value: new T.Color() }, uCl: { value: new T.Color() }, uCs: { value: new T.Color() }, uTime: U.uTime };
  const sea = new T.Mesh(new T.PlaneGeometry(240000, 240000).rotateX(-PI / 2), new T.ShaderMaterial({ uniforms: skyU,
    vertexShader: 'varying vec3 vWp;void main(){vWp=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWp,1.0);}',
    fragmentShader: `varying vec3 vWp;uniform vec3 uSea;uniform vec3 uHor;uniform vec3 uSun;uniform vec3 uSunCol;uniform float uTime;
  void main(){ float d=length(vWp.xz-cameraPosition.xz); vec3 c=mix(uSea,uHor,pow(smoothstep(4000.0,84000.0,d),0.6));
    vec3 v=normalize(cameraPosition-vWp); vec3 r=reflect(-uSun,vec3(0.0,1.0,0.0)); float sp=pow(max(dot(v,r),0.0),40.0);
    float n=sin(vWp.x*0.022+uTime*1.4)*sin(vWp.z*0.031-uTime*1.1)+0.6*sin(vWp.x*0.006-vWp.z*0.008+uTime*0.7);
    c+=uSunCol*sp*smoothstep(0.15,0.8,n)*0.85; gl_FragColor=vec4(c,1.0); }` }));
  sea.position.y = 0.7; scene.add(sea);
  const halla = buildHalla(scene); // 먼 풍경 한라산 (#81)
  const skyMesh = new T.Mesh(new T.SphereGeometry(118000, 32, 16), new T.ShaderMaterial({ uniforms: skyU, side: T.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `varying vec3 vD;uniform vec3 uTop;uniform vec3 uHor;uniform vec3 uSun;uniform vec3 uSunCol;
  void main(){ vec3 d=normalize(vD); float h=max(d.y,0.0); vec3 c=mix(uHor,uTop,smoothstep(0.0,0.5,h));
    float s=max(dot(d,uSun),0.0); c+=uSunCol*(smoothstep(0.9993,0.9996,s)*0.9+pow(s,24.0)*0.28+pow(s,4.0)*0.08);
    gl_FragColor=vec4(c,1.0); }` }));
  skyMesh.renderOrder = -10; skyMesh.frustumCulled = false; scene.add(skyMesh);
  const cloudMat = new T.ShaderMaterial({ uniforms: skyU,
    vertexShader: 'varying vec3 vN;void main(){vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `varying vec3 vN;uniform vec3 uSun;uniform vec3 uCl;uniform vec3 uCs;
  void main(){ vec3 n=normalize(vN); float l=dot(n,uSun)*0.6+n.y*0.5; gl_FragColor=vec4(mix(uCs,uCl,smoothstep(0.02,0.16,l)),1.0); }` });
  const clouds = new T.Group(); scene.add(clouds);
  for (let i = 0; i < 11; i++) {
    const list = [], k = 5 + Math.floor(rnd() * 4);
    for (let j = 0; j < k; j++) { const g = new T.IcosahedronGeometry(rr(22, 46), 2); g.scale(1.25, 0.7, 1); g.translate((j - k / 2) * rr(26, 38), rr(-6, 14), rr(-14, 14)); list.push(g); }
    const m = new T.Mesh(merge(list), cloudMat), a = rr(0, 6.28), d = rr(4500, 14000) * K;
    m.position.set(Math.cos(a) * d, rr(900, 1700) * K, Math.sin(a) * d); m.rotation.y = -a + 1.57; m.scale.setScalar(rr(5, 11) * K); m.userData.base = { y: m.position.y, s: m.scale.x }; clouds.add(m);
  }
  // main.js 의 공용 하늘 코드가 기대하는 모양
  const sky = { clouds, setColors() {}, u: { sunD: { value: new T.Vector3() }, sunC: { value: new T.Color() }, glow: { value: 0 } } };

  /* 빛: 해 고도에 따라 밤 → 새벽/노을 → 늦은 오후 → 낮 */
  const SM = LOW ? 2048 : Math.min(4096, renderer.capabilities.maxTextureSize), EXT = (LOW ? 52 : 82) * K;
  function setupShadow(sun) {
    sun.shadow.mapSize.set(SM, SM);
    Object.assign(sun.shadow.camera, { left: -EXT, right: EXT, top: EXT, bottom: -EXT, near: 1, far: 620 * K });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.09 * K; sun.shadow.radius = LOW ? 2.2 : 3;
  }
  function applyLight({ el, az, dir, sun, hemi, fill, rim, fog, fogColor }) {
    blendPre(el, az < 180);
    sun.color.copy(cur.sun); sun.intensity = cur.si * PI; hemi.color.copy(cur.sk); hemi.groundColor.copy(cur.gr); hemi.intensity = cur.hi * PI;
    fill.intensity = 0; rim.intensity = 0;
    fogColor.copy(cur.hor); fog.near = 260 * K; fog.far = 30000 * K;
    skyU.uTop.value.copy(cur.top); skyU.uHor.value.copy(cur.hor); skyU.uSun.value.copy(dir); skyU.uSunCol.value.copy(cur.glow);
    skyU.uSea.value.copy(cur.sea); skyU.uCl.value.copy(cur.cl); skyU.uCs.value.copy(cur.cs);
    halla.set(cur);
  }
  // 그림자 영역이 플레이어를 따라가되 텍셀 단위로 맞춰 가장자리가 떨리지 않게 한다
  const rightV = new T.Vector3(), upV = new T.Vector3(), tmp = new T.Vector3();
  function followLight(sun, pos, dir) {
    rightV.set(0, 1, 0).cross(dir).normalize(); upV.copy(dir).cross(rightV);
    const tex = 2 * EXT / sun.shadow.mapSize.x, p = tmp.copy(pos);
    const a = Math.round(p.dot(rightV) / tex) * tex, b = Math.round(p.dot(upV) / tex) * tex, c = p.dot(dir);
    sun.target.position.set(0, 0, 0).addScaledVector(rightV, a).addScaledVector(upV, b).addScaledVector(dir, c);
    sun.position.copy(sun.target.position).addScaledVector(dir, 300 * K); sun.target.updateMatrixWorld();
  }
  function update(dt, pos, camera) {
    U.uTime.value += dt; U.uPl.value.copy(pos);
    U.uPlV.value.set(pos.x, pos.y + 1.25, pos.z).applyMatrix4(camera.matrixWorldInverse);
    skyMesh.position.copy(camera.position); halla.update(camera);
    for (const c of chunks) { const hi = Math.hypot(c.cx - pos.x, c.cz - pos.z) < HI_R; c.hi.visible = hi; c.lo.visible = !hi; }
  }
  // 구역 격자 채우기 (#46): fn(x, z) → 구역 번호, (x0, z0) 왼쪽 위, cell 한 칸 크기
  function setZoneGrid(fn, x0, z0, cell) { for (let j = 0; j < ZN; j++) for (let i = 0; i < ZN; i++) zoneData[j * ZN + i] = fn(x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell); zoneTex.needsUpdate = true; U.uZoneB.value.set(x0, z0, cell, 0); return ZN; }
  const zoneDry = U.uDry.value; // [0..5] 구역별 마른 정도. 바꾸면 바로 반영
  const zoneMood = U.uMood.value; // [구역] = Vector3 (#136)
  return { pathIdx, rockStat, halla, setZoneGrid, zoneDry, zoneMood, zoneSnow: U.uSnow.value, solids, terrain, grass, sky, skyU, wind: U.uWind, wet: U.uWet.value, look: cur, setupShadow, applyLight, followLight, update, fogNear: 260 * K, fogFar: 30000 * K, camFar: 130000 };
}

/* ---------- 길 위의 점 구하기 (배치용) ---------- */
function arc(pts) { const d = [0]; for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return d; }
const arcs = {}; for (const k in nsPaths) arcs[k] = arc(nsPaths[k]);
// 길 name 을 따라 dist 만큼 간 곳에서 옆으로 off (side: 진행 방향 오른쪽 +1). 반환 { x, z, dir(진행 방향 heading) }
export function nsAlong(name, dist, side = 0, off = 0) {
  const pts = nsPaths[name], d = arcs[name]; let i = 1; while (i < pts.length - 1 && d[i] < dist) i++;
  const a = pts[i - 1], b = pts[i], t = Math.min(1, Math.max(0, (dist - d[i - 1]) / ((d[i] - d[i - 1]) || 1)));
  const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
  return { x: a[0] + dx * t + (-dz / l) * side * off, z: a[1] + dz * t + (dx / l) * side * off, dir: Math.atan2(dx, dz) };
}
export const nsLen = (name) => arcs[name][arcs[name].length - 1];
export function nsDistToRim(x, z) { let b = 1e9; for (const p of nsPaths.rim) { const d = Math.hypot(p[0] - x, p[1] - z); if (d < b) b = d; } return b; }
export const NS_E = E;

export const NS_SIGN_TEXT = `
<p class="sign-eyebrow">제주특별자치도 서귀포시 안덕면 서광리</p>
<h2>남송이오름 <small>Namsongi Oreum</small></h2>
<p>표고 339m</p>
<p>북서쪽으로 터진 말굽형 굼부리를 가진 오름이에요. 사면은 소나무 숲, 서남쪽엔 녹차밭. 경치는 그대로인데, 요즘은 쓰레기가 먼저 올라와 있어요.</p>
<p>능선에 오르면 서쪽으로 바다, 동쪽으로 한라산이 보여요. 보이는 건 다 치워도 됩니다.</p>
<ul class="sign-tips">
  <li>쓰레기는 주워서 클린하우스로. 귤로 바꿔 드려요</li>
  <li>귤은 먹는 것보다 던지는 게 쓸모 있어요</li>
  <li>멧돼지·들개에게 먹이를 주지 마세요. 귤은 던져서만 주세요</li>
  <li>무단 투기꾼을 보면 신고 대신 귤</li>
  <li>새벽 4시 4분 무렵 능선 위 불빛은 신고하지 않으셔도 됩니다 (매일 그럽니다)</li>
  <li>구역을 다 치우면 돌하르방이 섭니다. 금방 또 더러워지니 서운해하지 마세요</li>
  <li>돌탑에는 1인당 돌 하나를 얹을 수 있어요</li>
</ul>
<p class="sign-foot">서귀포시 안덕면 서광리 · 오름오름 탐방로 관리소 (직원 모집 중: 당신)</p>`;
