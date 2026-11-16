// 깨끗해진 구역에 꽃과 어린 나무 (#46)
// 구역 깨끗한 정도(trash.zoneClean)에 따라: 풀 색(땅·풀 셰이더의 uDry), 들꽃 무리, 어린 나무, 치운 더미 자리의 꽃, 나비·새
// 상태는 저장하지 않고 쓰레기 상태에서 늘 다시 구한다 (다시 쌓이면 그대로 시듦)
// 이벤트: 'zone-bloom' { zone } (100% 가 된 순간), 'zone-wilt' { zone } (100% 에서 떨어짐)
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gradHard } from './toon.js';
import { BLOOM as B } from './balance.js';
import { ZONE_IDS, ZONE_BOX } from './zones.js';

function mulberry(seed) { let s = seed >>> 0; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function paint(g, color) { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); g.computeVertexNormals(); const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }

/* ---------- 모양 (로우폴리 임시) ---------- */
// 꽃 무리 하나 = 줄기들(stem) + 꽃송이들(head, 구역 색으로 물듦). 같은 자리에서 둘을 같은 행렬로 그림
function clumpGeo(kind, seed) {
  const r = mulberry(seed), stems = [], heads = [];
  const n = kind === 'plume' ? 5 : kind === 'ball' ? 3 : 5;
  for (let i = 0; i < n; i++) {
    const a = r() * 6.28, d = i ? 0.15 + r() * 0.35 : 0, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (kind === 'plume') { // 억새: 길고 가는 줄기 + 기운 이삭
      const h = 0.9 + r() * 0.5, lean = (r() - 0.5) * 0.5;
      stems.push(paint(new THREE.CylinderGeometry(0.012, 0.022, h, 3, 1, true).translate(0, h / 2, 0).rotateZ(lean).translate(x, 0, z), '#ffffff'));
      heads.push(paint(new THREE.ConeGeometry(0.06, 0.42, 4).rotateZ(Math.PI + lean * 1.6).translate(x - Math.sin(lean) * h + 0.08 * Math.sign(lean || 1), h - 0.08, z), '#ffffff'));
    } else if (kind === 'ball') { // 수국: 잎 덤불 + 동그란 꽃송이
      if (!i) stems.push(paint(new THREE.IcosahedronGeometry(0.38, 0).scale(1.2, 0.7, 1.2).translate(0, 0.26, 0), '#ffffff'));
      const s = 0.16 + r() * 0.06; heads.push(paint(new THREE.IcosahedronGeometry(s, 0).translate(x * 0.9, 0.5 + r() * 0.12, z * 0.9), '#ffffff'));
    } else { // 들꽃: 줄기 + 다섯 잎 꽃
      const h = 0.34 + r() * 0.3;
      stems.push(paint(new THREE.CylinderGeometry(0.014, 0.022, h, 3, 1, true).translate(x, h / 2, z), '#ffffff'));
      heads.push(paint(new THREE.CylinderGeometry(0.11 + r() * 0.04, 0.035, 0.05, 5).rotateX((r() - 0.5) * 0.5).translate(x, h + 0.02, z), '#ffffff'));
    }
  }
  return { stem: mergeGeometries(stems), head: mergeGeometries(heads) };
}
function tuftGeo(seed) { // 살아나는 풀 포기 (#65): 가는 잎 여러 장
  const r = mulberry(seed), g = [];
  for (let i = 0; i < 7; i++) { const a = r() * 6.28, d = r() * 0.16, h = 0.28 + r() * 0.26, lean = 0.15 + r() * 0.35;
    g.push(paint(new THREE.ConeGeometry(0.035, h, 3).translate(0, h / 2, 0).rotateX(lean).rotateY(a).translate(Math.cos(a) * d, 0, Math.sin(a) * d), i % 2 ? '#79b850' : '#8fca5c')); }
  return mergeGeometries(g);
}
function treeGeo() {
  return mergeGeometries([
    paint(new THREE.CylinderGeometry(0.06, 0.1, 1.25, 5).translate(0, 0.62, 0), '#7a5a40'),
    paint(new THREE.IcosahedronGeometry(0.62, 0).scale(1, 0.85, 1).translate(0, 1.45, 0), '#5f9e4a'),
    paint(new THREE.IcosahedronGeometry(0.42, 0).translate(0.22, 1.95, -0.1), '#6fae52'),
    paint(new THREE.IcosahedronGeometry(0.36, 0).translate(-0.3, 1.25, 0.18), '#558f43'),
  ]);
}
const wingGeo = (w, h) => { const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -h * 0.3, w, 0, -h * 0.6, w * 0.8, 0, h * 0.5, 0, 0, -h * 0.3, w * 0.8, 0, h * 0.5, 0, 0, h * 0.2], 3)); g.computeVertexNormals(); return g; };

/* ---------- 꽃 세상 ---------- */
// ns: buildNamsongi 결과(setZoneGrid, zoneDry), trash: createTrash 결과, onPath(x,z): 길 위인가, col: 사물 충돌
export function createBloom({ scene, ns, trash, height, onPath, col, low }) {
  const listeners = [], emit = (ev, d) => listeners.forEach((f) => f(ev, d));
  const zoneAt = trash.zoneAt;
  // 1) 땅·풀 셰이더에 구역 격자
  const ZN = 256; ns.setZoneGrid(zoneAt, ZONE_BOX.x0, ZONE_BOX.z0, ZONE_BOX.size / ZN);

  // 2) 자리: 구역마다 고르게 흩은 꽃 무리 · 어린 나무, 더미 자리 둘레 꽃
  const rnd = mulberry(4601);
  const items = []; // { x, z, y, rot, s, zone, kind 0 꽃 1 나무, tOn, tOff, heap, cur, tgt, delay, wd }
  const free = (x, z, r) => !onPath(x, z) && !(col && col.blocked(x, z, r)) && !trash.heaps.some((h) => Math.hypot(h.x - x, h.z - z) < h.r + 0.6);
  function scatter(per, fn) {
    const st = Math.sqrt(per), { x0, z0, size } = ZONE_BOX;
    for (let z = z0; z < z0 + size; z += st) for (let x = x0; x < x0 + size; x += st) { const px = x + rnd() * st, pz = z + rnd() * st, k = zoneAt(px, pz); if (k) fn(px, pz, k); }
  }
  scatter(low ? B.perLow : B.per, (x, z, k) => { if (!free(x, z, 0.3)) return; const early = rnd() < B.early, tOn = early ? B.flowerFrom + rnd() * (0.98 - B.flowerFrom) : 1;
    items.push({ x, z, y: height(x, z) - 0.03, rot: rnd() * 6.28, s: 1 + rnd() * 0.6, zone: k, kind: 0, g: Math.floor(rnd() * 3), tOn, tOff: tOn - 0.015, heap: -1 }); });
  scatter(low ? B.treePerLow : B.treePer, (x, z, k) => { if (rnd() > B.zones[k].tree || !free(x, z, 1.1)) return;
    items.push({ x, z, y: height(x, z) - 0.05, rot: rnd() * 6.28, s: 0.8 + rnd() * 0.55, zone: k, kind: 1, g: 0, tOn: 1, tOff: B.treeOff[0] + rnd() * (B.treeOff[1] - B.treeOff[0]), heap: -1 }); });
  trash.heaps.forEach((h, hi) => { const n = B.heapRing[h.k] || 4; for (let i = 0; i < n; i++) { const a = i / n * 6.28 + rnd() * 0.6, d = h.r * (0.2 + rnd() * 0.85), x = h.x + Math.cos(a) * d, z = h.z + Math.sin(a) * d;
    items.push({ x, z, y: height(x, z) - 0.03, rot: rnd() * 6.28, s: 0.9 + rnd() * 0.5, zone: h.zone, kind: 0, g: i % 3, tOn: 0, tOff: 0, heap: hi, hd: d / h.r }); }
    const nt = B.heapTuft[h.k] || 6; for (let i = 0; i < nt; i++) { const a = rnd() * 6.28, d = h.r * Math.sqrt(rnd()) * 1.05, x = h.x + Math.cos(a) * d, z = h.z + Math.sin(a) * d; // 더미 자리 풀 (#65)
    items.push({ x, z, y: height(x, z) - 0.02, rot: rnd() * 6.28, s: 0.8 + rnd() * 0.6, zone: h.zone, kind: 2, g: 0, tOn: 0, tOff: 0, heap: hi, hd: d / h.r }); } });
  items.forEach((it) => { it.cur = 0; it.tgt = 0; it.delay = 0; it.wd = false; it.on = false; });
  // 칸(32)별 목록: 그릴 것만 빨리 고름
  const CELL = 32, cells = new Map(); items.forEach((it, i) => { const key = Math.floor(it.x / CELL) * 8191 + Math.floor(it.z / CELL); let a = cells.get(key); if (!a) cells.set(key, a = []); a.push(i); });

  // 3) 그리기: 구역마다 꽃 무리 3가지 모양(줄기·꽃송이), 나무 하나
  const stemMat = new THREE.MeshToonMaterial({ color: '#5f9a45', vertexColors: true, gradientMap: gradHard });
  const headMat = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradHard });
  const treeMat = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradHard });
  const IM = {}; // IM[zone][g] = { stem, head, cap }
  ZONE_IDS.forEach((z) => { IM[z] = [0, 1, 2].map((g) => { const geo = clumpGeo(B.zones[z].kind, z * 10 + g), cap = Math.max(1, items.filter((it) => it.kind === 0 && it.zone === z && it.g === g).length);
    const mk = (gg, m) => { const im = new THREE.InstancedMesh(gg, m, cap); im.count = 0; im.frustumCulled = false; im.receiveShadow = !low; scene.add(im); return im; };
    const head = mk(geo.head, headMat); head.setColorAt(0, new THREE.Color()); return { stem: mk(geo.stem, stemMat), head }; }); });
  const tuftCap = Math.max(1, items.filter((it) => it.kind === 2).length);
  const tufts = new THREE.InstancedMesh(tuftGeo(77), stemMat, tuftCap); tufts.count = 0; tufts.frustumCulled = false; tufts.receiveShadow = !low; scene.add(tufts);
  const treeCap = Math.max(1, items.filter((it) => it.kind === 1).length);
  const trees = new THREE.InstancedMesh(treeGeo(), treeMat, treeCap); trees.count = 0; trees.frustumCulled = false; trees.castShadow = !low; trees.receiveShadow = !low; trees.setColorAt(0, new THREE.Color()); scene.add(trees);
  const ZC = {}; ZONE_IDS.forEach((z) => { ZC[z] = new THREE.Color(B.zones[z].color); });
  const BROWN = new THREE.Color('#8a6a3c'), TREE_C = [new THREE.Color('#ffffff'), new THREE.Color('#e6f2d6'), new THREE.Color('#f2f6dc')];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), colr = new THREE.Color();
  const backOut = (t) => { const c = 1.9; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
  const shown = (it) => (it.wd ? it.cur : backOut(it.cur));
  let lastX = 1e9, lastZ = 1e9, dirty = true;
  function rebuild(px, pz) {
    lastX = px; lastZ = pz; dirty = false;
    const FR = low ? B.drawRLow : B.drawR, TR = low ? B.treeDrawRLow : B.treeDrawR, R = Math.max(FR, TR), cr = Math.ceil(R / CELL), ci = Math.floor(px / CELL), cj = Math.floor(pz / CELL);
    const cnt = {}; ZONE_IDS.forEach((z) => { cnt[z] = [0, 0, 0]; }); let tc = 0, gc = 0;
    for (let i = ci - cr; i <= ci + cr; i++) for (let j = cj - cr; j <= cj + cr; j++) {
      const a = cells.get(i * 8191 + j); if (!a) continue;
      for (const k of a) {
        const it = items[k]; if (it.cur <= 0.01) continue;
        const d2 = (it.x - px) ** 2 + (it.z - pz) ** 2; if (d2 > (it.kind === 1 ? TR * TR : FR * FR)) continue;
        const k1 = shown(it) * it.s, wilt = it.wd ? 1 - it.cur : 0;
        if (it.kind === 2) { e.set(wilt * 0.6, it.rot, 0); q.setFromEuler(e); m4.compose(v.set(it.x, it.y, it.z), q, sc.set(k1, k1 * (1 - wilt * 0.6), k1)); tufts.setMatrixAt(gc++, m4); continue; }
        if (it.kind === 1) { e.set(wilt * 0.25, it.rot, 0); q.setFromEuler(e); m4.compose(v.set(it.x, it.y, it.z), q, sc.set(k1 * (0.6 + 0.4 * it.cur), k1, k1 * (0.6 + 0.4 * it.cur)));
          trees.setMatrixAt(tc, m4); trees.setColorAt(tc, colr.copy(TREE_C[k % 3]).lerp(BROWN, wilt * 0.8)); tc++; continue; }
        const im = IM[it.zone][it.g], c = cnt[it.zone][it.g]++;
        e.set(wilt * 0.5, it.rot, 0); q.setFromEuler(e); m4.compose(v.set(it.x, it.y, it.z), q, sc.set(k1, k1 * (1 - wilt * 0.4), k1));
        im.stem.setMatrixAt(c, m4); im.head.setMatrixAt(c, m4); im.head.setColorAt(c, colr.copy(ZC[it.zone]).lerp(BROWN, wilt * 0.85));
      }
    }
    ZONE_IDS.forEach((z) => IM[z].forEach((im, g) => { im.stem.count = im.head.count = cnt[z][g]; im.stem.instanceMatrix.needsUpdate = im.head.instanceMatrix.needsUpdate = true; if (im.head.instanceColor) im.head.instanceColor.needsUpdate = true; }));
    tufts.count = gc; tufts.instanceMatrix.needsUpdate = true;
    trees.count = tc; trees.instanceMatrix.needsUpdate = true; if (trees.instanceColor) trees.instanceColor.needsUpdate = true;
  }

  // 4) 상태: 쓰레기가 바뀔 때마다 구역 깨끗한 정도로 다시 구함
  const clean = {}, bloomed = {}, dryT = [0, 0, 0, 0, 0, 0];
  const anim = new Set();
  const heapsOf = {}; ZONE_IDS.forEach((z) => { heapsOf[z] = trash.heaps.filter((h) => h.zone === z); });
  function setT(i, on, delay, now) { const it = items[i]; if (it.on === on) return; it.on = on; it.tgt = on ? 1 : 0; it.wd = !on; it.delay = delay; if (now) { it.cur = it.tgt; anim.delete(i); } else anim.add(i); }
  const heapDelay = (it) => Math.min(1.1, it.hd) * B.heapWave * (it.kind === 2 ? 0.8 : 1) + (it.kind === 2 ? 0 : 0.06) + Math.random() * 0.05;
  function refresh(initial = false) {
    const wave = {};
    ZONE_IDS.forEach((z) => {
      const c = clean[z] = trash.zoneClean(z), was = bloomed[z], b = bloomed[z] = c >= 1 - 1e-9;
      dryT[z] = b ? -B.lush : c <= B.dryTo ? 1 : c >= B.liveAt ? 0 : 1 - (c - B.dryTo) / (B.liveAt - B.dryTo);
      if (!initial && b && !was) wave[z] = true;
      if (!initial && b !== !!was) emit(b ? 'zone-bloom' : 'zone-wilt', { zone: z });
    });
    items.forEach((it, i) => {
      let on;
      if (it.heap >= 0) on = trash.store.left(it.heap) <= 0;
      else if (it.kind === 1) on = bloomed[it.zone] || (it.on && clean[it.zone] >= it.tOff);
      else on = it.tOn >= 1 ? bloomed[it.zone] : (it.on ? clean[it.zone] >= it.tOff : clean[it.zone] >= it.tOn);
      let delay = 0;
      if (on && !it.on && it.heap >= 0 && !initial) delay = heapDelay(it); // 더미 자리: 가운데부터 물결처럼 (#65)
      else if (on && !it.on && wave[it.zone]) { let d = 1e9; heapsOf[it.zone].forEach((h) => { d = Math.min(d, Math.hypot(h.x - it.x, h.z - it.z)); }); delay = Math.min(B.waveMax, d / B.wave) + (it.kind === 1 ? 0.6 : 0); }
      else if (!on && it.on) delay = Math.random() * 2; // 시들 때는 하나씩
      setT(i, on, delay, initial);
    });
    if (initial) ZONE_IDS.forEach((z) => { ns.zoneDry[z] = dryT[z]; });
    dirty = true;
  }
  let mute = false;
  trash.on((ev) => { if (!mute && (ev === 'trash' || ev === 'heap-clear' || ev === 'zone-clear' || ev === 'changed' || ev === 'heap-stage')) refresh(false); });
  refresh(true);

  /* ---------- 나비·새 ---------- */
  const NB = low ? B.butterfliesLow : B.butterflies, NBIRD = B.birds;
  const bfMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const bf = new THREE.InstancedMesh(wingGeo(0.17, 0.2), bfMat, NB * 2); bf.frustumCulled = false; bf.count = 0; bf.setColorAt(0, new THREE.Color()); scene.add(bf);
  const birdMat = new THREE.MeshToonMaterial({ color: '#3a3a44', side: THREE.DoubleSide, gradientMap: gradHard });
  const bd = new THREE.InstancedMesh(wingGeo(0.55, 0.32), birdMat, NBIRD * 2); bd.frustumCulled = false; bd.count = 0; scene.add(bd);
  const BF_C = ['#ffffff', '#ffe27a', '#ffb8d0', '#cfe0ff', '#f6c46a'].map((h) => new THREE.Color(h));
  const flies = []; for (let i = 0; i < NB; i++) flies.push({ p: new THREE.Vector3(), to: new THREE.Vector3(), h: 0, ph: Math.random() * 6, k: 0, t: 0, c: BF_C[i % BF_C.length] });
  let birds = []; // { p, v, ph, st: 'in'|'circle'|'out', t, cx, cz, cy, a }
  function flock(px, pz) {
    const a0 = Math.random() * 6.28, cy = height(px, pz) + 13;
    birds = []; for (let i = 0; i < NBIRD; i++) { const a = a0 + (i - NBIRD / 2) * 0.12, d = 110 + i * 4; birds.push({ p: new THREE.Vector3(px + Math.cos(a) * d, cy + 18 + i, pz + Math.sin(a) * d), v: new THREE.Vector3(), ph: Math.random() * 6, st: 'in', t: B.birdT + i, cx: px, cz: pz, cy: cy + (i % 3), a: a + Math.PI, r: 8 + i * 1.6 }); }
  }
  const wingM = (im, idx, p, yaw, flap, s, side) => { e.set(0, yaw, side * flap, 'YXZ'); q.setFromEuler(e); m4.compose(p, q, sc.set(side * s, s, s)); im.setMatrixAt(idx, m4); };
  function tickFx(dt, pos, time) {
    // 나비: 다 핀 구역 안에 있으면 둘레 꽃 사이를 팔랑팔랑
    const here = zoneAt(pos.x, pos.z), on = here && bloomed[here];
    let n = 0;
    for (const f of flies) {
      f.k = Math.max(0, Math.min(1, f.k + (on ? dt : -dt) * 0.8));
      if (f.k <= 0) { f.p.set(pos.x, -1e3, pos.z); continue; }
      if (f.p.y < -100 || f.p.distanceTo(pos) > 26) { const a = Math.random() * 6.28, d = 6 + Math.random() * 12, x = pos.x + Math.cos(a) * d, z = pos.z + Math.sin(a) * d; f.p.set(x, height(x, z) + 0.6 + Math.random(), z); f.t = 0; }
      if ((f.t -= dt) <= 0 || f.p.distanceTo(f.to) < 0.4) { const a = Math.random() * 6.28, d = 3 + Math.random() * 9, x = pos.x + Math.cos(a) * d, z = pos.z + Math.sin(a) * d; f.to.set(x, height(x, z) + 0.5 + Math.random() * 1.3, z); f.t = 3 + Math.random() * 3; }
      const dx = f.to.x - f.p.x, dz = f.to.z - f.p.z, l = Math.hypot(dx, dz) || 1; f.h = Math.atan2(dx, dz);
      f.p.x += dx / l * 1.6 * dt; f.p.z += dz / l * 1.6 * dt; f.p.y += ((f.to.y - f.p.y) * 0.8 + Math.sin(time * 5 + f.ph) * 0.9) * dt;
      const flap = 0.2 + 1.1 * Math.abs(Math.sin(time * 16 + f.ph)), s = f.k;
      wingM(bf, n, f.p, f.h, flap, s, 1); bf.setColorAt(n++, f.c); wingM(bf, n, f.p, f.h, flap, s, -1); bf.setColorAt(n++, f.c);
    }
    bf.count = n; bf.instanceMatrix.needsUpdate = true; if (bf.instanceColor) bf.instanceColor.needsUpdate = true;
    // 새: 피는 순간 멀리서 날아와 몇 바퀴 돌고 떠남
    let m = 0;
    for (const b of birds) {
      b.t -= dt; let tx, ty, tz;
      if (b.st === 'in' || b.st === 'circle') { b.a += dt * 0.55; tx = b.cx + Math.cos(b.a) * b.r; tz = b.cz + Math.sin(b.a) * b.r; ty = b.cy + Math.sin(time * 0.7 + b.ph); if (b.st === 'in' && b.p.distanceTo(v.set(tx, ty, tz)) < 4) b.st = 'circle'; if (b.t < 0) b.st = 'out'; }
      else { tx = b.p.x + Math.cos(b.a) * 50; tz = b.p.z + Math.sin(b.a) * 50; ty = b.p.y + 12; }
      v.set(tx - b.p.x, ty - b.p.y, tz - b.p.z); const want = b.st === 'in' ? 16 : 9; if (v.length() > 0.01) v.setLength(want); b.v.lerp(v, Math.min(1, dt * 1.6)); b.p.addScaledVector(b.v, dt);
      const yaw = Math.atan2(b.v.x, b.v.z), flap = 0.15 + 0.7 * Math.abs(Math.sin(time * 7 + b.ph));
      wingM(bd, m++, b.p, yaw, flap, 1, 1); wingM(bd, m++, b.p, yaw, flap, 1, -1);
    }
    if (birds.length && birds.every((b) => b.st === 'out' && b.t < -12)) birds = [];
    bd.count = m; bd.instanceMatrix.needsUpdate = true;
  }

  function update(dt, pos, time) {
    // 풀 색
    for (const z of ZONE_IDS) { const d = dryT[z] - ns.zoneDry[z]; if (d) ns.zoneDry[z] += Math.sign(d) * Math.min(Math.abs(d), B.dryRate * dt); }
    // 피고 시드는 중
    let moving = false;
    for (const i of anim) {
      const it = items[i]; if (it.delay > 0) { it.delay -= dt; continue; }
      const rate = it.on ? 1 / (it.kind === 1 ? B.treeGrow : it.heap >= 0 ? B.heapGrow : B.grow) : 1 / B.wither;
      it.cur += Math.sign(it.tgt - it.cur) * Math.min(Math.abs(it.tgt - it.cur), rate * dt); moving = true;
      if (it.cur === it.tgt) anim.delete(i);
    }
    if (dirty || moving || Math.abs(pos.x - lastX) > 5 || Math.abs(pos.z - lastZ) > 5) rebuild(pos.x, pos.z);
    tickFx(dt, pos, time);
  }

  // 구역에서 노루가 지낼 만한 자리 (다 핀 꽃 무리 중 길에서 떨어진 곳)
  function spotIn(z, ok) { const c = items.filter((it) => it.zone === z && it.kind === 0 && it.heap < 0 && (!ok || ok(it.x, it.z))); const it = c[Math.floor(c.length * 0.37)]; return it ? { x: it.x, z: it.z } : null; }
  const test = {
    state: () => ZONE_IDS.map((z) => ({ zone: z, clean: +clean[z].toFixed(3), bloomed: !!bloomed[z], dry: +ns.zoneDry[z].toFixed(2), flowers: items.filter((it) => it.zone === z && it.kind === 0 && it.on).length, trees: items.filter((it) => it.zone === z && it.kind === 1 && it.on).length })),
    counts: () => ({ flowers: items.filter((it) => it.kind === 0).length, tufts: items.filter((it) => it.kind === 2).length, trees: items.filter((it) => it.kind === 1).length, drawn: ZONE_IDS.reduce((s, z) => s + IM[z].reduce((t, im) => t + im.head.count, 0), 0) + trees.count, anim: anim.size, butterflies: bf.count / 2, birds: bd.count / 2 }),
    flock: (x, z) => flock(x, z),
    finish() { anim.forEach((i) => { items[i].cur = items[i].tgt; items[i].delay = 0; }); anim.clear(); ZONE_IDS.forEach((z) => { ns.zoneDry[z] = dryT[z]; }); dirty = true; },
  };
  // 다시 보기 (#65 확인용): 더미 자리 hi 또는 구역 z 의 꽃을 처음부터 다시 피움. 아직 안 핀 것도 잠깐 피움(다음 쓰레기 변화 때 원래대로)
  function replay({ heap: hi = -1, zone: z = 0 }) {
    items.forEach((it, i) => {
      if (hi >= 0 ? it.heap !== hi : (it.zone !== z || it.heap >= 0)) return;
      let delay; if (hi >= 0) delay = heapDelay(it); else { let d = 1e9; heapsOf[z].forEach((h) => { d = Math.min(d, Math.hypot(h.x - it.x, h.z - it.z)); }); delay = Math.min(B.waveMax, d / B.wave) + (it.kind === 1 ? 0.6 : 0); }
      it.on = true; it.tgt = 1; it.wd = false; it.cur = 0; it.delay = delay; anim.add(i);
    });
    dirty = true;
  }
  // 서버를 바꿀 때 (#35): 그 사이 쓰레기 변화는 연출 없이 바로 맞춤. run 안에서 쓰레기를 바꿈
  function resync(run) { mute = true; try { run?.(); } finally { mute = false; } items.forEach((it) => { it.on = false; it.cur = 0; it.wd = false; }); anim.clear(); ZONE_IDS.forEach((z) => { bloomed[z] = false; }); refresh(true); }
  return { update, resync, replay, on: (f) => listeners.push(f), isBloomed: (z) => !!bloomed[z], bloomed: () => ZONE_IDS.filter((z) => bloomed[z]), clean: (z) => clean[z], flock, spotIn, test };
}
