// 사건 파일 Tripo 모델 (#262): 설인·검은 양복·흰 작업복·터지기·호스·오름지기(#305) (사진사는 #268 에서 예전 차림으로 되돌림). model/bake-case.py 로 줄이고 구워 model/extract-prop.js 로 src/model-case-*.js
// - 자료는 가까이 갔을 때만 받는다(assets.js meta.lazy). 처음엔 멀리용(-lo, 1,500 삼각형·텍스처 128), CASE_MODELS.near 안이면 큰 모델(캐릭터 7,500·호스 1,500)
// - 뼈대: 사람 꼴·설인은 지금 캐릭터처럼 뼈 7개(hips·chest·head·armL·armR·legL·legR), 호스는 8마디. 가중치는 정점과 뼈 선분 사이 거리로 계산(+손에 든 것은 손 뼈로)
// - 듀얼 쿼터니언 스키닝(dqskin.js). 큰 모델과 멀리용이 같은 뼈를 씀 → 캐릭터마다 그리는 것 1개(+그림자)
// 쓰는 법: const m = caseModel('mib'); scene.add(m.root); m.play('walk'); 움직일 땐 매 프레임 m.update(dt); m.lookAt(플레이어 위치 | null). 받기·LOD 는 저절로(그려질 때)
//   m.play('rise', { once: true }) 는 끝나면 m.done 이 true. '+' 로 둘을 겹칠 수 있음('sit+tie'). 모델 좌표: 키 0.98, 앞 +z (root.scale 은 CASE_MODELS.scale)
import * as THREE from 'three';
import { LOW } from './gfx2.js';
import { CASE_MODELS as CM, NPC_LIGHT } from './balance.js';
import { unpackProp, propMaterial } from './propmodel.js';
import { whenAsset, want, placeholderGeo, placeholderMat } from './assets.js';
import { patchDQS } from './dqskin.js';

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const BONES = ['hips', 'chest', 'head', 'armL', 'armR', 'legL', 'legR'];
const CHAIN = ['h0', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7'];

/* ---------- 뼈 자리 (모델 좌표). seg: 뼈마다 가중치를 재는 선분들, hold: 손에 든 것(상자 안 정점은 그 뼈만), headY: 이보다 위는 머리 ---------- */
const mirror = (p) => [-p[0], p[1], p[2]];
function human({ hips, chest, neck, top, shL, handL, shR, handR, hipL, footL, hipR, footR, headY, band = 0.04, hold = [], extra = {}, gate = null }) {
  const J = { hips, chest, head: neck, armL: shL, armR: shR, legL: hipL, legR: hipR };
  const seg = { hips: [[hips, chest]], chest: [[chest, neck]], head: [[neck, top]], armL: [[shL, handL]], armR: [[shR, handR]], legL: [[hipL, footL]], legR: [[hipR, footR]] };
  for (const [b, list] of Object.entries(extra)) seg[b].push(...list);
  return { kind: 'human', J, seg, headY, band, hold, gate, cx: hips[0], parent: { hips: null, chest: 'hips', head: 'chest', armL: 'chest', armR: 'chest', legL: 'hips', legR: 'hips' } };
}
const RIG = {
  mib: human({ hips: [0, 0.27, 0], chest: [0, 0.4, 0], neck: [0, 0.6, 0], top: [0, 0.95, 0], shL: [0.16, 0.53, 0], handL: [0.23, 0.22, 0], shR: mirror([0.16, 0.53, 0]), handR: mirror([0.23, 0.22, 0]),
    hipL: [0.07, 0.26, 0], footL: [0.08, 0.03, 0.03], hipR: [-0.07, 0.26, 0], footR: [-0.08, 0.03, 0.03], headY: 0.6, gate: [0.16, 0.16] }),
  'ghost-keeper': human({ hips: [0.1, 0.18, 0], chest: [0.1, 0.35, 0], neck: [0.1, 0.5, 0], top: [0.1, 0.95, -0.03], shL: [0.24, 0.46, -0.02], handL: [0.37, 0.31, 0.02], shR: [-0.04, 0.46, -0.02], handR: [-0.18, 0.31, 0.02],
    hipL: [0.2, 0.15, 0], footL: [0.2, 0.02, 0], hipR: [0, 0.15, 0], footR: [0, 0.02, 0], headY: 0.5, gate: [0.12, 0.12],
    hold: [['armL', [0.27, -1, -1], [1, 0.31, 1]], ['armR', [-1, 0.25, -1], [-0.2, 0.5, 1]]] }), /* 흰 자루(왼손) · 집게(오른손) */
  yeti: human({ hips: [0, 0.2, 0], chest: [0, 0.4, 0], neck: [0, 0.6, 0], top: [0, 0.95, 0], shL: [0.28, 0.52, 0], handL: [0.4, 0.25, 0.03], shR: [-0.28, 0.52, 0], handR: [-0.35, 0.33, 0.1],
    hipL: [0.15, 0.18, 0], footL: [0.15, 0.02, 0.05], hipR: [-0.15, 0.18, 0], footR: [-0.15, 0.02, 0.05], headY: 0.62, band: 0.07, gate: [0.25, 0.2],
    extra: { armR: [[[-0.35, 0.33, 0.12], [-0.33, 0.1, 0.18]]] } }), /* 오른손에 든 초록 봉지 */
  'arena-keeper': human({ hips: [-0.05, 0.15, 0], chest: [-0.05, 0.35, 0], neck: [-0.05, 0.56, 0], top: [-0.05, 0.95, 0], shL: [0.12, 0.49, 0], handL: [0.24, 0.44, 0.15], shR: [-0.22, 0.49, 0], handR: [-0.34, 0.26, 0],
    hipL: [0.03, 0.12, 0], footL: [0.03, 0.02, 0.02], hipR: [-0.15, 0.12, 0], footR: [-0.15, 0.02, 0.02], headY: 0.56, gate: [0.15, 0.19],
    hold: [['armL', [0.15, 0.36, 0.06], [1, 0.64, 1]]], extra: { armL: [[[0.24, 0.44, 0.15], [0.27, 0.55, 0.14]]] } }), /* 왼손 망고 */
  /* #305 오름지기(안 C): 벙거지·큰 콧수염, 오른손 집게(바깥으로 뻗음), 왼쪽 허리에 어깨 가방(초록빛) → 가방은 엉덩이 뼈만 따라감 */
  jigi: human({ hips: [0, 0.2, 0], chest: [0, 0.33, 0], neck: [0, 0.52, 0.03], top: [0, 0.97, 0], shL: [0.15, 0.46, 0], handL: [0.21, 0.25, 0.04], shR: [-0.15, 0.46, 0], handR: [-0.23, 0.22, 0.03],
    hipL: [0.07, 0.17, 0], footL: [0.08, 0.02, 0.02], hipR: [-0.07, 0.17, 0], footR: [-0.08, 0.02, 0.02], headY: 0.52, gate: [0.15, 0.15],
    hold: [['armR', [-1, 0.08, -1], [-0.25, 0.3, 1]], ['hips', [0.235, -1, -1], [1, 0.39, 0.03]]] }), /* 집게 · 어깨 가방 */
  hose: (() => { /* 뒤 끝(땅, -z)에서 아치를 넘어 앞의 주황 나팔 입(+z)까지 9점 → 8마디 */
    const P = [[0, 0, -0.44], [0, 0.3, -0.42], [0, 0.6, -0.33], [0, 0.8, -0.15], [0, 0.83, 0.05], [0, 0.7, 0.24], [0, 0.45, 0.33], [0, 0.2, 0.37], [0, 0.12, 0.47]];
    const J = {}, seg = {}, parent = {};
    CHAIN.forEach((b, i) => { J[b] = P[i]; seg[b] = [[P[i], P[i + 1]]]; parent[b] = i ? CHAIN[i - 1] : null; });
    return { kind: 'chain', J, seg, parent, hold: [] };
  })(),
};
export const caseModelNames = Object.keys(RIG);

/* ---------- 가중치 ---------- */
function segDist(p, a, b) {
  const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2], L = abx * abx + aby * aby + abz * abz;
  const t = L ? Math.min(1, Math.max(0, ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby + (p[2] - a[2]) * abz) / L)) : 0;
  return Math.hypot(p[0] - a[0] - abx * t, p[1] - a[1] - aby * t, p[2] - a[2] - abz * t);
}
function weights(R, pos) {
  const names = R.kind === 'chain' ? CHAIN : BONES, n = pos.length / 3, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), p = [0, 0, 0];
  for (let v = 0; v < n; v++) {
    p[0] = pos[v * 3]; p[1] = pos[v * 3 + 1]; p[2] = pos[v * 3 + 2];
    let w = names.map((b) => { let d = 9; for (const [a, c] of R.seg[b]) d = Math.min(d, segDist(p, a, c)); return 1 / Math.pow(d + 0.012, 6); });
    let sum = w.reduce((a, b) => a + b, 0); w = w.map((x) => x / sum);
    const one = (k, f) => { w = w.map((x, i) => x * (1 - f) + (i === k ? f : 0)); };
    if (R.kind === 'human') {
      if (R.gate) { /* 몸통 옆면 안쪽은 팔을 따라가지 않게 (팔을 크게 들 때 몸이 끌려가지 않게) */
        const kL = sstep(R.gate[0] - 0.02, R.gate[0] + 0.015, p[0] - R.cx), kR = sstep(R.gate[1] - 0.02, R.gate[1] + 0.015, R.cx - p[0]);
        const lost = w[3] * (1 - kL) + w[4] * (1 - kR); w[3] *= kL; w[4] *= kR; const rest = w[0] + w[1] || 1; w[0] += lost * w[0] / rest; w[1] += lost * (w[1] / rest || 1);
      }
      one(2, sstep(R.headY - R.band * 0.5, R.headY + R.band * 0.5, p[1])); /* 큰 머리는 통째로 */
      for (const [b, mn, mx] of R.hold) if (p[0] >= mn[0] && p[0] <= mx[0] && p[1] >= mn[1] && p[1] <= mx[1] && p[2] >= mn[2] && p[2] <= mx[2]) one(names.indexOf(b), 1);
    }
    const order = w.map((x, i) => i).sort((a, b) => w[b] - w[a]).slice(0, 4); sum = 0; order.forEach((k) => { sum += w[k]; });
    order.forEach((k, j) => { si[v * 4 + j] = k; sw[v * 4 + j] = w[k] / (sum || 1); });
  }
  return { si, sw };
}
const geoCache = new Map();
function skinGeo(asset, name, D) {
  let g = geoCache.get(asset); if (g) return g;
  const { pos, nor, uv, idx } = unpackProp(D), { si, sw } = weights(RIG[name], pos);
  g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere(); g.boundingSphere.radius *= 1.5; /* 팔을 들거나 앉아도 잘리지 않게 */
  geoCache.set(asset, g); return g;
}
/* 맨발 (#264): 모델 좌표 y 가 이보다 낮은 곳(구두)을 살색으로 칠함. 모양은 그대로, 발가락은 쓰는 쪽에서 붙임(casesuit.js) */
const BARE = { mib: { y: 0.072, color: '#f1dcc2' } };
const matCache = new Map();
function skinMat(asset, glow, name) {
  const key = asset + '|' + glow; let m = matCache.get(key); if (m) return m;
  m = propMaterial(asset, { ...(glow != null ? { glow } : {}), minLight: NPC_LIGHT.floor }); /* 밤에도 얼굴·옷 색이 읽히게 (#269) */
  const bare = BARE[name], prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r); patchDQS(sh);
    if (!bare) return;
    const c = new THREE.Color(bare.color).convertSRGBToLinear();
    sh.vertexShader = 'varying float vBareY;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBareY = position.y;');
    sh.fragmentShader = 'varying float vBareY;\n' + sh.fragmentShader.replace('#include <map_fragment>',
      `#include <map_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)}) * diffuse, 1.0 - smoothstep(${(bare.y - 0.006).toFixed(3)}, ${bare.y.toFixed(3)}, vBareY));`);
  };
  m.customProgramCacheKey = () => (bare ? 'casedq-bare' : 'casedq'); matCache.set(key, m); return m;
}
export const caseBare = (name) => BARE[name] || null;
let depthMat = null;
const dqDepth = () => depthMat || (depthMat = Object.assign(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), { onBeforeCompile: patchDQS }));

/* ---------- 모션: (B 뼈, t 초, s 상태) → 뼈 회전(쉼 자세 0 기준)·hips 위치 더하기. 되풀이 ---------- */
const S = Math.sin;
const armUp = (B, k, x, z) => { B[k].rotation.x += x; B[k].rotation.z += z; };
const CLIPS = {
  /* 공통 */
  idle: (B, t) => { B.chest.rotation.x += S(t * 1.9) * 0.015; B.head.rotation.x += S(t * 1.9 + 0.6) * 0.01; },
  /* 설인 */
  breathe: (B, t) => { const b = S(t * 1.6); B.chest.scale.set(1 + b * 0.025, 1 + b * 0.02, 1 + b * 0.03); B.head.rotation.x += b * 0.025; armUp(B, 'armL', 0, 0.04 + b * 0.02); armUp(B, 'armR', 0, -0.04 - b * 0.02); },
  tie: (B, t) => { const w = S(t * 10) * 0.2, n = S(t * 7.3) * 0.1; armUp(B, 'armL', -1.05 + w, -0.55 + n); armUp(B, 'armR', -1.05 - w, 0.55 - n); B.chest.rotation.x += 0.2; B.head.rotation.x += 0.3; },
  sit: (B) => { B.hips.position.y -= 0.12; B.legL.rotation.x -= 1.35; B.legR.rotation.x -= 1.35; B.legL.rotation.z += 0.25; B.legR.rotation.z -= 0.25; B.chest.rotation.x += 0.12; },
  lookback: (B, t) => { const k = sstep(0, 1.6, t % 5) * (1 - sstep(3.4, 5, t % 5)); B.chest.rotation.y += 0.55 * k; B.head.rotation.y += 1.15 * k; },
  wave: (B, t) => { armUp(B, 'armR', -0.5, -1.45 + S(t * 6) * 0.3); B.head.rotation.z += S(t * 3) * 0.05; },
  heavy: (B, t) => { const w = t * 3.4, a = S(w); B.legL.rotation.x += a * 0.38; B.legR.rotation.x -= a * 0.38; B.hips.position.y += Math.abs(S(w)) * 0.025 - 0.02; B.hips.rotation.z += a * 0.07; B.chest.rotation.z -= a * 0.05; armUp(B, 'armL', -a * 0.25, 0.06); armUp(B, 'armR', a * 0.25, -0.06); B.chest.rotation.x += 0.06; },
  /* 검은 양복 */
  stand: (B, t) => { B.chest.rotation.x += S(t * 1.2) * 0.004; },
  talk: (B, t) => { B.head.rotation.x += (S(t * 4.2) * 0.5 + 0.5) * 0.06 * (S(t * 0.9) > -0.3 ? 1 : 0); },
  bow: (B, t) => { const k = sstep(0, 0.9, t); B.chest.rotation.x += 0.62 * k; B.head.rotation.x += 0.3 * k; armUp(B, 'armL', 0.12 * k, -0.04 * k); armUp(B, 'armR', 0.12 * k, 0.04 * k); }, /* 깊이 숙인 인사: 허리(가슴 뼈)에서 숙이고 그대로 멈춤 (#264) */
  shuffle: (B, t) => { const a = S(t * 11); B.legL.rotation.x += a * 0.14; B.legR.rotation.x -= a * 0.14; B.hips.rotation.y += a * 0.02; },
  /* 흰 작업복 */
  glide: (B, t) => { B.chest.rotation.x += 0.08; armUp(B, 'armL', S(t * 1.4) * 0.08, 0.05); armUp(B, 'armR', -S(t * 1.4) * 0.08 - 0.05, -0.05); B.head.rotation.y += S(t * 0.7) * 0.15; },
  pinch: (B, t) => { const c = S(t * 3.2) * 0.5 + 0.5; B.hips.position.y -= 0.05; B.legL.rotation.x -= 0.35; B.legR.rotation.x -= 0.35; B.chest.rotation.x += 0.45; armUp(B, 'armR', -0.5 - c * 0.35, 0.1); B.head.rotation.x += 0.2; },
  turnback: (B, t) => { const k = sstep(0, 1.2, t); B.chest.rotation.y += 0.7 * k; B.head.rotation.y += 1.0 * k; },
  /* 터지기 */
  wave1: (B, t) => { armUp(B, 'armL', -0.35 + S(t * 7) * 0.12, 0.25 + S(t * 7) * 0.3); B.head.rotation.z += 0.06; }, /* 망고 든 손을 흔듦 (늘어진 오른팔은 몸에 붙어 있어 크게 들면 앞치마가 늘어남) */
  gong: (B, t) => { const h = Math.pow(S(t * 3.6) * 0.5 + 0.5, 3); armUp(B, 'armR', -0.95 + h * 0.75, -0.2); B.chest.rotation.x += h * 0.1; B.chest.rotation.y -= 0.15; },
  offer: (B, t) => { const k = sstep(0, 0.5, t % 3) * (1 - sstep(2.2, 3, t % 3)); armUp(B, 'armL', -0.55 * k, -0.15 * k); B.chest.rotation.x += 0.12 * k; B.hips.position.y += S(t * 5) * 0.004; B.head.rotation.z -= 0.08 * k; },
  /* 오름지기 (#305): 수첩 꺼내기는 왼손을 가슴 앞으로(수첩은 jigi.js 가 손 뼈에 붙임), 곁눈질은 가끔 고개만 휙 */
  jnote: (B, t) => { armUp(B, 'armL', -0.95, -0.3); armUp(B, 'armR', -0.35 + S(t * 9) * 0.05, 0.12 + S(t * 13) * 0.04); B.head.rotation.x += 0.22 + S(t * 0.8) * 0.06; B.chest.rotation.x += 0.05; },
  jwave: (B, t) => { armUp(B, 'armL', -0.45, 0.55 + S(t * 7) * 0.25); B.head.rotation.z -= 0.06; },
  glance: (B, t) => { const u = t % 5.5, k = sstep(0, 0.18, u) * (1 - sstep(1.1, 1.35, u)); B.head.rotation.y += 0.55 * k; B.head.rotation.x -= 0.05 * k; B.chest.rotation.x += S(t * 1.9) * 0.012; },
  /* 사진사: 쉼 자세(모델 그대로)가 카메라를 눈에 댄 모습. 몸과 붙은 한 덩어리 모델이라 팔은 조금만 움직임(크게 내리면 카메라·턱이 늘어남) */
  /* 호스: 뼈 8마디 (h0 땅 → h7 나팔) */
  wriggle: (B, t) => { CHAIN.forEach((b, i) => { B[b].rotation.x += S(t * 2.6 - i * 0.8) * 0.12; B[b].rotation.z += S(t * 1.7 - i * 0.6) * 0.1; }); },
  spew: (B, t) => { CHAIN.forEach((b, i) => { B[b].rotation.x += S(t * 31 + i) * 0.03 + (i > 4 ? 0.08 : 0); B[b].rotation.z += S(t * 27 - i) * 0.03; }); B.h0.position.y += S(t * 40) * 0.006; },
  rise: (B, t, s) => { const k = sstep(0, 1.4, t); B.h0.position.y -= (1 - k) * 0.95; CHAIN.forEach((b, i) => { B[b].rotation.x += (1 - k) * 0.3 + S(t * 5 - i) * 0.1 * (1 - k); }); s.done = t > 1.5; },
  sink: (B, t, s) => { const k = sstep(0, 1.2, t); B.h0.position.y -= k * 0.95; CHAIN.forEach((b, i) => { B[b].rotation.x -= k * 0.25 + S(t * 6 - i) * 0.08 * k; }); s.done = t > 1.3; },
};
/* 모델마다 이름 → 모션 (이름이 같아도 모델마다 뜻이 다를 수 있음) */
const MOVES = {
  yeti: { idle: 'breathe', breathe: 'breathe', tie: 'tie', sit: 'sit', lookback: 'lookback', walk: 'heavy', wave: 'wave' },
  mib: { idle: 'stand', stand: 'stand', talk: 'talk', walk: 'shuffle', bow: 'bow' },
  'ghost-keeper': { idle: 'idle', walk: 'glide', glide: 'glide', pinch: 'pinch', lookback: 'turnback' },
  'arena-keeper': { idle: 'idle', wave: 'wave1', gong: 'gong', offer: 'offer' },
  jigi: { idle: 'idle', stand: 'idle', talk: 'talk', note: 'jnote', wave: 'jwave', glance: 'glance' },
  hose: { idle: 'wriggle', wriggle: 'wriggle', spew: 'spew', rise: 'rise', sink: 'sink' },
};
export const caseMoves = (name) => Object.keys(MOVES[name] || {});

/* ---------- 하나 만들기 ---------- */
const tmpV = new THREE.Vector3();
/* #272: 큰 모델 GPU 자료 놓아 주기. 큰 모델(hi)이 있는 것이 모두 카메라에서 CM.release m 밖에 CM.releaseT 초 넘게 있으면 그 모델의 geometry·텍스처를 GPU 에서 내림.
   자료(정점·이미지)는 JS 에 남아 있어 다시 가까이 가면 three 가 저절로 다시 올림. 카메라는 마지막으로 그려 준 것(seen) */
const HI = new Map(), relS = { cam: null, timer: 0, freed: {} };
function relTick() {
  const cam = relS.cam; if (!cam) return;
  for (const [A, set] of HI) {
    let use = false;
    for (const inst of set) { if (inst.forced() || !inst.inScene()) { if (inst.forced()) use = true; continue; } inst.rig.getWorldPosition(tmpV); if (tmpV.distanceTo(cam.position) < CM.release) use = true; }
    const e = relS.freed[A] || (relS.freed[A] = { away: 0, n: 0, on: true });
    if (use) { e.away = 0; e.on = true; continue; }
    e.away += CM.relEvery; if (!e.on || e.away < CM.releaseT) continue;
    for (const inst of set) inst.toLo();
    geoCache.get(A)?.dispose(); for (const [k, m] of matCache) if (k.startsWith(A + '|')) m.map?.dispose();
    e.on = false; e.n++;
  }
}
const hiAdd = (A, inst) => { if (!HI.has(A)) HI.set(A, new Set()); HI.get(A).add(inst); if (!relS.timer && typeof setInterval !== 'undefined') relS.timer = setInterval(relTick, CM.relEvery * 1000); };
export const caseGpu = { tick: relTick, state: () => Object.fromEntries([...HI].map(([A, set]) => [A, { n: set.size, ...(relS.freed[A] || { away: 0, n: 0, on: true }) }])) };
export function caseModel(name, { glow = null, shadow = true } = {}) {
  const R = RIG[name]; if (!R) throw new Error('없는 사건 모델 ' + name);
  const names = R.kind === 'chain' ? CHAIN : BONES, A = 'case-' + name, ALO = A + '-lo';
  const B = {}; names.forEach((b) => { const o = new THREE.Bone(); o.name = b; B[b] = o; });
  for (const b of names) { const pa = R.parent[b], j = R.J[b], q = pa ? R.J[pa] : [0, 0, 0]; B[b].position.set(j[0] - q[0], j[1] - q[1], j[2] - q[2]); if (pa) B[pa].add(B[b]); }
  const rootBone = B[names[0]], base = names.map((b) => B[b].position.clone());
  const root = new THREE.Group(); root.name = 'case:' + name; root.scale.setScalar(CM.scale[name] || 2.5);
  const rig = new THREE.Group(); root.add(rig); rig.add(rootBone); rig.updateMatrixWorld(true);
  const skel = new THREE.Skeleton(names.map((b) => B[b]));
  /* 받기·LOD 는 그려질 때 정함(onBeforeRender): 임시 모양이 화면에 처음 그려지면 멀리용을 받고, 카메라가 near 안이면 큰 모델을 받고, far 밖이면 멀리용을 그림 */
  const tmp = new THREE.Mesh(placeholderGeo(ALO, 'ball'), placeholderMat('#9a9a92')); rig.add(tmp);
  /* #269: 큰 모델은 텍스처 그림까지 올라간 뒤에 멀리용과 바꿈 (그 전에 바꾸면 회색·예전엔 검게 보였음). 멀리용도 그림 전엔 재질이 회색으로 그림(propmodel.js) */
  let hi = null, lo = null, wantLo = false, wantHi = false, far = true, forceNear = false, hiTex = false;
  const pick = () => { const useHi = hi && (!far || forceNear) && (hiTex || !lo); if (hi) hi.visible = !!useHi; if (lo) lo.visible = !useHi; tmp.visible = !hi && !lo; };
  const getLo = () => { if (wantLo) return; wantLo = true; whenAsset(ALO, (D) => { lo = mk(ALO, D); pick(); }, { lazy: true }); want(ALO); };
  const getHi = () => { if (wantHi) return; wantHi = true; whenAsset(A, (D) => { hi = mk(A, D); pick(); hiAdd(A, relInst); }, { lazy: true }); want(A); };
  const relInst = { rig, forced: () => forceNear, inScene: () => { let q = root; while (q.parent) q = q.parent; return !!q.isScene; }, toLo: () => { far = true; pick(); } };
  const seen = (r, s, cam) => {
    if (!cam?.isPerspectiveCamera) return; /* 그림자 카메라는 빼고 */
    relS.cam = cam;
    getLo(); rig.getWorldPosition(tmpV); const d = tmpV.distanceTo(cam.position);
    if (hi && !hiTex && hi.material.map?.userData.ready) { hiTex = true; pick(); }
    if (d < CM.near) getHi();
    const f = d > CM.far; if (f !== far) { far = f; pick(); }
  };
  tmp.onBeforeRender = seen;
  const mk = (asset, D) => {
    const m = new THREE.SkinnedMesh(skinGeo(asset, name, D), skinMat(asset, glow, name)); m.customDepthMaterial = dqDepth(); m.onBeforeRender = seen; m.boundingSphere = m.geometry.boundingSphere.clone(); /* 뼈로 움직여도 잘리지 않게 넉넉한 구 (three 는 처음 자세로 한 번만 잼) */
    m.castShadow = shadow && !LOW; m.receiveShadow = true; rig.add(m); m.bind(skel, new THREE.Matrix4()); return m;
  };

  /* 모션 섞기: 바꿀 때 지금 자세를 찍어 두고 fade 초 동안 새 자세로 */
  const st = { clip: 'idle', t: 0, once: false, done: false, flash: 0, fade: 1, look: null, yaw: 0 };
  const snap = names.map(() => ({ r: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1) }));
  function play(clip, { once = false, restart = false } = {}) {
    if (clip === st.clip && !restart) return api;
    names.forEach((b, i) => { snap[i].r.copy(B[b].rotation); snap[i].p.copy(B[b].position); snap[i].s.copy(B[b].scale); });
    st.clip = clip; st.t = 0; st.once = once; st.done = false; st.fade = 0; return api;
  }
  function pose(dt) {
    names.forEach((b, i) => { B[b].rotation.set(0, 0, 0); B[b].position.copy(base[i]); B[b].scale.set(1, 1, 1); });
    for (const c of st.clip.split('+')) { const f = CLIPS[MOVES[name][c] || c]; if (f) f(B, st.t, st); }
    if (R.kind === 'human') { /* 고개 돌려 보기(lookAt): 뒤까지는 안 돌고, 넘치면 가슴이 조금 같이 */
      let want = 0;
      if (st.look) { root.updateMatrixWorld(); tmpV.copy(st.look); root.worldToLocal(tmpV); want = Math.atan2(tmpV.x, tmpV.z); want = Math.max(-1.6, Math.min(1.6, want)); }
      st.yaw += (want - st.yaw) * Math.min(1, dt * 3.5);
      B.head.rotation.y += Math.max(-1.05, Math.min(1.05, st.yaw)); B.chest.rotation.y += st.yaw - Math.max(-1.05, Math.min(1.05, st.yaw));
    }
    if (st.fade < 1) {
      st.fade = Math.min(1, st.fade + dt / CM.fade); const k = sstep(0, 1, st.fade);
      names.forEach((b, i) => { const o = B[b], s0 = snap[i];
        o.rotation.set(s0.r.x + (o.rotation.x - s0.r.x) * k, s0.r.y + (o.rotation.y - s0.r.y) * k, s0.r.z + (o.rotation.z - s0.r.z) * k);
        o.position.lerpVectors(s0.p, o.position, k); o.scale.lerpVectors(s0.s, o.scale, k); });
    }
  }
  function update(dt) { if (!root.visible) return; st.t += dt; pose(dt); }
  /* 손 뼈를 따라가는 것을 붙일 때 (사진사 번쩍 등): 그 뼈의 자식으로, 모델 좌표 p 자리에 */
  function attach(bone, obj, p) { const j = R.J[bone]; obj.position.set(p[0] - j[0], p[1] - j[1], p[2] - j[2]); B[bone].add(obj); return obj; }
  function dispose() { root.removeFromParent(); HI.get(A)?.delete(relInst); }
  const api = { name, root, bones: B, play, update, attach, dispose, warm: () => getLo(), /* 보이기 전에 멀리용만 받아 둠 (#305 오름지기) */ near: (on = true) => { forceNear = on; if (on) { getLo(); getHi(); } pick(); }, /* 장면처럼 곧 가까이 볼 때: 큰 모델을 미리 받아 둠 */
    lookAt: (p) => { st.look = p ? (st.look || new THREE.Vector3()).copy(p) : null; },
    get clip() { return st.clip; }, get done() { return st.done; }, get flash() { return st.flash; }, get loaded() { return { lo: !!lo, hi: !!hi }; }, get far() { return far; } };
  pose(0);
  return api;
}
