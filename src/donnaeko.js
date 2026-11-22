import * as THREE from 'three';
import { G, softMat, fluffyGeo, cedarGeo, seaMat, roundNormals, cloudShadow, LOW } from './gfx2.js';
import { vnoise, hash, smooth, PAL, EXTENT, setMapImpl, addWalkable, contactShadows } from './world.js';
import { PATHCLEAR } from './balance.js';

// 한라산 돈내코 탐방로 (게임용으로 짧게) — 남쪽 탐방안내소에서 숲길을 지나 평궤대피소, 남벽분기점까지
// 좌표: 남쪽 +z(바다), 북쪽 -z(백록담 남벽). 1 unit ≈ 2m 느낌, 고도는 연출용
export const DN = {
  startZ: 560, viewZ: -398, limitZ: -412,
  crater: { x: 0, z: -840, rim: 320, outer: 438 },
};
const clamp01 = (t) => Math.max(0, Math.min(1, t));

// 탐방로 제어점 → Catmull-Rom
const CTRL = [[0, 572], [26, 500], [-18, 430], [34, 360], [-26, 290], [18, 220], [-34, 150], [12, 80], [-28, 10], [22, -60], [-12, -130], [26, -190], [-6, -250], [16, -310], [-4, -360], [0, -396]];
export const dnTrail = [];
{
  const P = CTRL.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(P, false, 'catmullrom', 0.5);
  const pts = curve.getSpacedPoints(520);
  pts.forEach((p) => dnTrail.push(new THREE.Vector2(p.x, p.z)));
}
export const DN_SHELTER_I = Math.floor(dnTrail.length * 0.72); // 평궤대피소

function distTrail(x, z) {
  let best = 1e9, bi = 0;
  for (let i = 0; i < dnTrail.length - 1; i += 1) {
    const p = dnTrail[i], q = dnTrail[i + 1];
    const vx = q.x - p.x, vz = q.y - p.y, wx = x - p.x, wz = z - p.y;
    const tt = Math.max(0, Math.min(1, (wx * vx + wz * vz) / (vx * vx + vz * vz)));
    const d = Math.hypot(wx - vx * tt, wz - vz * tt);
    if (d < best) { best = d; bi = i; }
  }
  return [best, bi];
}

function dnHeight(x, z) {
  const t = clamp01((DN.startZ + 20 - z) / 980);
  let h = 300 * Math.pow(t, 1.25);
  // 능선·골짜기 기복
  h += (vnoise(x * 0.008 + 4, z * 0.008) - 0.5) * 40 * (0.4 + t);
  h += (vnoise(x * 0.03, z * 0.03) - 0.5) * 6;
  // 계곡 (탐방로 동쪽)
  const vx = 90 + 25 * Math.sin(z * 0.008);
  h -= 16 * Math.exp(-Math.pow((x - vx) / 18, 2)) * clamp01((z + 100) / 300);
  // 탐방로 주변은 살짝 평평하게
  const near = Math.exp(-Math.pow(x / 70, 2));
  h = h * (1 - near * 0.15) + (300 * Math.pow(t, 1.25)) * near * 0.15;
  // 남쪽은 바다 쪽으로 내려감
  if (z > DN.startZ) h -= (z - DN.startZ) * 0.35;
  // 남벽: 백록담 외륜이 급하게 솟음
  const C = DN.crater; const r = Math.hypot(x - C.x, z - C.z);
  if (r < C.outer) {
    const w = clamp01((C.outer - r) / (C.outer - C.rim));
    const ws = w * w * (3 - 2 * w);
    // 수직에 가까운 바위 벽: 계단식 층 + 울퉁불퉁한 바위
    const rock = (vnoise(x * 0.05, z * 0.05) - 0.5) * 40 + (vnoise(x * 0.18, z * 0.14) - 0.5) * 14;
    const ledges = Math.floor(ws * 6) / 6 * 0.35 + ws * 0.65;
    h += (270 + rock) * Math.pow(ledges, 1.35);
    if (r < C.rim - 30) h -= 140 * smooth(clamp01((C.rim - 30 - r) / 120)); // 백록담 안쪽
  }
  return h;
}

// 표면: 0 숲바닥, 1 흙·돌길, 2 데크, 3 바위
const SR = 2, SN = Math.ceil((EXTENT * 2) / SR);
const surf = new Uint8Array(SN * SN);
let filled = false;
function fill() {
  if (filled) return; filled = true;
  for (let j = 0; j < SN; j++) {
    const z = -EXTENT + (j + 0.5) * SR;
    for (let i = 0; i < SN; i++) {
      const x = -EXTENT + (i + 0.5) * SR;
      if (Math.abs(x) > 80) continue;
      const [d] = distTrail(x, z);
      if (d < 2.8) surf[j * SN + i] = z < -150 ? 2 : 1;
    }
  }
}
function dnSurface(x, z) {
  fill();
  const i = Math.floor((x + EXTENT) / SR), j = Math.floor((z + EXTENT) / SR);
  if (i < 0 || j < 0 || i >= SN || j >= SN) return 0;
  const s = surf[j * SN + i];
  if (s) return s;
  return z < DN.limitZ ? 3 : 0;
}

const COL = {
  forest: new THREE.Color('#3f6a34'), forestDark: new THREE.Color('#2e5228'), sasa: new THREE.Color('#5d8a3e'),
  litter: new THREE.Color('#6b5a3a'), path: new THREE.Color('#7a6650'), deck: new THREE.Color('#8a6a48'),
  alpine: new THREE.Color('#7f8f55'), shrub: new THREE.Color('#8a7a4a'), rock: new THREE.Color('#7a746a'), rock2: new THREE.Color('#5e5a54'),
  field: new THREE.Color('#86a85a'),
};
function dnColor(x, z, h, c, n, n2) {
  const s = dnSurface(x, z);
  if (s === 1) { c.copy(COL.path).lerp(COL.litter, n2 * 0.5); return; }
  if (s === 2) { c.copy(COL.deck).lerp(COL.path, 0.3); return; }
  const C = DN.crater; const r = Math.hypot(x - C.x, z - C.z);
  if (r < C.outer + 6) { c.copy(COL.rock).lerp(COL.rock2, n2).lerp(new THREE.Color('#8e8578'), Math.max(0, n - 0.5)).lerp(COL.alpine, Math.max(0, n - 0.8) * 1.2); return; }
  if (z < -150) { const k = clamp01((-150 - z) / 200); c.copy(COL.alpine).lerp(COL.shrub, n * 0.6).lerp(COL.rock, k * 0.3 * n2); return; }
  if (z > DN.startZ + 10) { c.copy(COL.field).lerp(COL.forest, n * 0.4); return; }
  c.copy(COL.forest).lerp(COL.forestDark, n).lerp(COL.sasa, Math.max(0, n2 - 0.4)).lerp(COL.litter, Math.max(0, n2 - 0.8) * 2);
}

export function useDonnaeko() { setMapImpl({ height: dnHeight, surface: dnSurface, color: dnColor }); }

export function dnTrailDir(i) {
  const p = dnTrail[Math.max(0, i - 1)], q = dnTrail[Math.min(dnTrail.length - 1, i + 1)];
  return Math.atan2(q.x - p.x, q.y - p.y);
}

export function buildDonnaekoDecor(scene, height) {
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const m = new THREE.Matrix4(), qn = new THREE.Quaternion(), e = new THREE.Euler();
  const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...o });
  const nearTrail = (x, z, d) => Math.abs(x) < 80 + d && distTrail(x, z)[0] < d;

  // 데크 (고지대 구간)
  const wood = lam('#9a7449');
  const decks = [];
  for (let i = 1; i < dnTrail.length; i++) { const p = dnTrail[i]; if (p.y < -150 && i % 2 === 0) decks.push(i); }
  const deckMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(3.6, 0.2, 2.1), wood, decks.length);
  decks.forEach((i, k) => { const p = dnTrail[i]; e.set(0, dnTrailDir(i), 0); qn.setFromEuler(e); const dy = height(p.x, p.y) + 0.05; m.compose(new THREE.Vector3(p.x, dy, p.y), qn, new THREE.Vector3(1, 1, 1)); deckMesh.setMatrixAt(k, m); addWalkable(p.x, p.y, dnTrailDir(i), 1.8, 1.05, dy + 0.1); });
  deckMesh.receiveShadow = true; scene.add(deckMesh);
  // 로프 기둥
  const posts = [];
  for (let i = 3; i < dnTrail.length; i += 7) posts.push(i);
  const postMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 1.1, 0.22), wood, posts.length * 2);
  posts.forEach((i, k) => { const p = dnTrail[i]; const d = dnTrailDir(i); const nx = Math.cos(d) * 2.8, nz = -Math.sin(d) * 2.8; [1, -1].forEach((sg, s2) => { const x = p.x + nx * sg, z = p.y + nz * sg; m.makeTranslation(x, height(x, z) + 0.45, z); postMesh.setMatrixAt(k * 2 + s2, m); }); });
  postMesh.castShadow = true; scene.add(postMesh);

  // 숲: 활엽수(졸참·서어나무) 수관 + 줄기, 조릿대
  const canopyGeo = fluffyGeo(LOW ? 2 : 3, 2.2, 2.6, 7.4, 5, 1);
  const canopyGeo2 = new THREE.IcosahedronGeometry(2.4, 0); canopyGeo2.translate(1.2, 9.5, 0.6);
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 7, 5); trunkGeo.translate(0, 3.5, 0);
  const firGeo = cedarGeo(3, 1.7, 3.0, 1.7, 2.2);
  const snagGeo = new THREE.CylinderGeometry(0.08, 0.22, 5, 4); snagGeo.translate(0, 2.5, 0);
  const sasaGeo = roundNormals(new THREE.IcosahedronGeometry(0.9, 1)); sasaGeo.scale(1, 0.8, 1);
  const shrubGeo = roundNormals(new THREE.IcosahedronGeometry(0.8, 1)); shrubGeo.scale(1.2, 0.6, 1);
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const trees = [], firs = [], snags = [], sasa = [], shrubs = [], rocks = [];
  let tries = 0;
  while (trees.length < 3200 && tries++ < 40000) {
    const x = (rnd() - 0.5) * 1180, z = -160 + rnd() * 780;
    if (z > DN.startZ + 30) continue;
    if (nearTrail(x, z, 4.2)) continue;
    const dens = 0.55 + 0.45 * vnoise(x * 0.02, z * 0.02);
    if (rnd() > dens) continue;
    trees.push([x, z, 0.75 + rnd() * 0.7, rnd() * 6.28, (z + 160) / 780]);
  }
  tries = 0;
  while (sasa.length < 6500 && tries++ < 30000) {
    const x = (rnd() - 0.5) * 500, z = -260 + rnd() * 820;
    if (nearTrail(x, z, 2.6)) continue;
    sasa.push([x, z, 0.7 + rnd() * 0.8, rnd() * 6.28]);
  }
  tries = 0;
  while (firs.length < 900 && tries++ < 20000) {
    const x = (rnd() - 0.5) * 900, z = DN.limitZ + 10 + rnd() * 330;
    if (nearTrail(x, z, 4)) continue;
    if (vnoise(x * 0.03, z * 0.03) < 0.42) continue;
    (rnd() < 0.18 ? snags : firs).push([x, z, 0.6 + rnd() * 0.7, rnd() * 6.28]);
  }
  tries = 0;
  while (shrubs.length < 2600 && tries++ < 20000) {
    const x = (rnd() - 0.5) * 700, z = DN.limitZ + 4 + rnd() * 280;
    if (nearTrail(x, z, 2.4)) continue;
    shrubs.push([x, z, 0.6 + rnd() * 0.9, rnd() * 6.28]);
  }
  // 남벽 바위 덩어리: 벽면에 박힌 큰 바위들
  for (let i = 0; i < 700; i++) {
    const a = Math.PI / 2 + (rnd() - 0.5) * 1.8, rr = DN.crater.rim + 4 + rnd() * (DN.crater.outer - DN.crater.rim - 4);
    const x = DN.crater.x + Math.cos(a) * rr, z = DN.crater.z + Math.sin(a) * rr;
    if (z > DN.limitZ - 6) continue;
    rocks.push([x, z, 3 + rnd() * 7, rnd() * 6.28]);
  }
  for (let i = 0; i < 160; i++) { const x = (rnd() - 0.5) * 600, z = DN.limitZ + 6 + rnd() * 220, r = 0.8 + rnd() * 2; if (nearTrail(x, z, 3 + PATHCLEAR.pad + r)) continue; rocks.push([x, z, r, rnd() * 6.28]); } /* 길 둘레 비우기 (#227) */
  const put = (list, geo, mat, opts = {}) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    const col = new THREE.Color();
    list.forEach(([x, z, sc, ry, k], i) => {
      e.set(opts.tilt ? (rnd() - 0.5) * opts.tilt : 0, ry, opts.tilt ? (rnd() - 0.5) * opts.tilt : 0); qn.setFromEuler(e);
      m.compose(new THREE.Vector3(x, height(x, z) - (opts.sink || 0.15), z), qn, new THREE.Vector3(sc, sc * (opts.sy || 1), sc));
      im.setMatrixAt(i, m);
      if (opts.tint) { opts.tint(col, k, x, z); im.setColorAt(i, col); }
    });
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = !!opts.shadow; im.receiveShadow = true; scene.add(im); return im;
  };
  const leafTint = (col, k, x, z) => { const n = vnoise(x * 0.05, z * 0.05); col.set('#ffffff').lerp(new THREE.Color('#fff0a0'), n * 0.7).lerp(new THREE.Color('#ffb060'), Math.max(0, n - 0.7) * 1.6); };
  put(trees, canopyGeo, softMat({ a: G.leafA, b: G.leafB, wind: 1 }), { tint: leafTint, shadow: true });
  put(trees, trunkGeo, softMat({ a: '#5a4030', b: '#a07a56' }), { shadow: true });
  put(sasa, sasaGeo, softMat({ a: G.leafA, b: G.grassA }), { sink: 0.2 });
  put(firs, firGeo, softMat({ a: G.cedarA, b: G.cedarB, wind: 0.6 }), { shadow: true });
  put(snags, snagGeo, lam('#cfc8bc'), { tilt: 0.3 });
  put(shrubs, shrubGeo, softMat({ a: G.leaf2A, b: G.leaf2B }), { sink: 0.25, tint: (c, k, x, z) => { const n = vnoise(x * 0.04, z * 0.04); c.set('#ffffff').lerp(new THREE.Color('#ffc080'), n * 0.8); } });
  put(rocks, rockGeo, lam('#6e6860'), { sy: 0.6, sink: 0.6 });
  contactShadows(scene, trees, 2.6); contactShadows(scene, firs, 1.7); contactShadows(scene, rocks.filter((r) => r[2] < 3), 1.1);

  // 평궤대피소: 돌로 지은 작은 대피소
  const sp = dnTrail[DN_SHELTER_I]; const sd = dnTrailDir(DN_SHELTER_I);
  const shelter = new THREE.Group();
  const stoneMat = lam('#7a746a'), roofMat = lam('#4a5a6a');
  const wall = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 4), stoneMat); wall.position.y = 1.3; shelter.add(wall);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 4.6, 1.6, 4, 1), roofMat); roof.rotation.y = Math.PI / 4; roof.scale.set(1.0, 1, 0.75); roof.position.y = 3.3; shelter.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.8, 0.1), lam('#3a2e24')); door.position.set(0, 0.9, 2.02); shelter.add(door);
  shelter.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const sx = sp.x + Math.cos(sd) * 9, sz = sp.y - Math.sin(sd) * 9;
  shelter.position.set(sx, height(sx, sz) - 0.2, sz); shelter.rotation.y = Math.atan2(sp.x - sx, sp.y - sz);
  scene.add(shelter);

  // 남벽분기점 전망 데크
  const vp = dnTrail[dnTrail.length - 1];
  const deck = new THREE.Mesh(new THREE.BoxGeometry(14, 0.35, 9), wood); deck.position.set(vp.x, height(vp.x, vp.y) + 0.2, vp.y - 1); deck.receiveShadow = true; scene.add(deck); addWalkable(vp.x, vp.y - 1, 0, 7, 4.5, deck.position.y + 0.175);
  for (let i = -6; i <= 6; i += 2) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.1, 0.2), wood); p.position.set(vp.x + i, deck.position.y + 0.7, vp.y - 5.4); scene.add(p); }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(13, 0.12, 0.12), wood); rail.position.set(vp.x, deck.position.y + 1.2, vp.y - 5.4); scene.add(rail);

  // 남쪽 아래 풍경: 서귀포 들판·마을, 바다, 섶섬·문섬·범섬
  {
    const g = new THREE.PlaneGeometry(9000, 4200, 90, 42); g.rotateX(-Math.PI / 2);
    const ps = g.attributes.position; const cols = new Float32Array(ps.count * 3); const c = new THREE.Color();
    for (let i = 0; i < ps.count; i++) {
      const x = ps.getX(i), z = ps.getZ(i) + 2700; // z: 600 ~ 4800
      const t = clamp01((z - 600) / 1900);
      let h = -10 - 160 * t + (vnoise(x * 0.004, z * 0.004) - 0.5) * 40 * (1 - t);
      ps.setY(i, h); ps.setZ(i, z);
      const cell = hash(Math.floor(x / 80) + 50, Math.floor(z / 60) + 50);
      c.copy(COL.field).lerp(new THREE.Color('#a8b765'), cell).lerp(new THREE.Color('#3f6a34'), (1 - t) * 0.6);
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, cloudShadow(new THREE.MeshLambertMaterial({ vertexColors: true }))));
    // 동서로 이어지는 산자락
    const g2 = new THREE.PlaneGeometry(9000, 1300, 60, 14); g2.rotateX(-Math.PI / 2);
    const p2 = g2.attributes.position;
    for (let i = 0; i < p2.count; i++) { const x = p2.getX(i), z = p2.getZ(i); const ax = Math.abs(x); const t = clamp01((z + 650) / 1300); p2.setY(i, ax < 640 ? -200 : (320 * (1 - t) - 40) * clamp01((ax - 640) / 300) + (vnoise(x * 0.01, z * 0.01) - 0.5) * 30); p2.setZ(i, z); }
    g2.computeVertexNormals();
    const side = new THREE.Mesh(g2, new THREE.MeshLambertMaterial({ color: '#3f6a34', flatShading: true })); side.position.y = -6; scene.add(side);
  }
  // 마을 (서귀포)
  const houseGeo = new THREE.BoxGeometry(6, 4, 6);
  const houses = [];
  for (let i = 0; i < 600; i++) { const x = (rnd() - 0.5) * 3000, z = 2100 + rnd() * 500; houses.push([x, z]); }
  const houseMesh = new THREE.InstancedMesh(houseGeo, lam('#efe9dc'), houses.length);
  houses.forEach(([x, z], k) => { const t = clamp01((z - 600) / 1900); m.makeTranslation(x, -10 - 160 * t + 1, z); houseMesh.setMatrixAt(k, m); });
  scene.add(houseMesh);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(20000, 10000), seaMat());
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, -168, 7600); scene.add(sea);
  const island = (x, z, r, h, col) => { const g = new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); const o = new THREE.Mesh(g, lam(col)); o.scale.y = h / r; o.position.set(x, -168, z); scene.add(o); };
  island(900, 3300, 90, 70, '#4a7a46');   // 섶섬
  island(-200, 3200, 70, 45, '#557f4a');  // 문섬
  island(-1300, 3400, 110, 60, '#4f7a46'); // 범섬
  // 남쪽 아래 작은 오름들
  [[-800, 1300, 120, 60], [600, 1500, 150, 70], [1500, 1100, 130, 55], [-1700, 1600, 160, 70]].forEach(([x, z, r, hh]) => { const g = new THREE.SphereGeometry(r, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2); const o = new THREE.Mesh(g, lam('#4f7a40')); o.scale.y = hh / r; const t = clamp01((z - 600) / 1900); o.position.set(x, -10 - 160 * t - 4, z); scene.add(o); });
}

export const DN_SIGN_TEXT = `
<p class="sign-eyebrow">한라산국립공원 · 서귀포시 상효동</p>
<h2>돈내코 탐방로 <small>Donnaeko Trail</small></h2>
<p>돈내코 탐방안내소에서 출발해 숲길을 오르면 평궤대피소를 지나 백록담 남벽 아래 남벽분기점에 닿아요. 실제 길은 편도 7km 남짓이고, 여기서는 짧게 줄였어요.</p>
<p>아래쪽은 졸참나무·서어나무가 우거진 숲이고 바닥에는 조릿대가 덮여 있어요. 고도가 높아지면 나무가 낮아지고, 구상나무와 하얗게 마른 고사목이 보이기 시작해요.</p>
<p>남벽분기점 전망대에 서면 눈앞에 백록담 남벽이 솟아 있고, 뒤로 돌아서면 서귀포 바다와 섶섬·문섬·범섬이 내려다보여요.</p>
<ul class="sign-tips">
  <li>노루가 자주 나와요. 천천히 다가가 보세요</li>
  <li>평궤대피소에서 잠시 쉬어 갈 수 있어요</li>
  <li>남벽 쪽 출입금지 구역 너머로는 갈 수 없어요</li>
</ul>`;
