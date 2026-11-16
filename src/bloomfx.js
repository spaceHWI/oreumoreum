// 더미를 다 치웠을 때 · 구역이 꽃밭이 될 때 효과 (#65)
// 후처리 없이 입자·메시·색만: 땅을 따라 퍼지는 빛 고리, 위로 솟았다 흩날리는 꽃잎, 반짝이 가루, 귤, 꽃잎 기둥
// 입자는 InstancedMesh 3개(꽃잎·반짝이·귤)를 풀로 돌려 씀. 수는 기기 단계(tier 0 LOW · 1 중간 · 2 높음)로 줄임
// 저장 없음. 소리·진동·카메라·배너는 main 이 맡고, 여기선 3D 만
import * as THREE from 'three';
import { gradHard } from './toon.js';
import { BLOOM_FX as F } from './balance.js';

const SEG = 56; // 고리 둘레 칸 수

export function createBloomFx({ scene, height, tier = () => 2 }) {
  const mul = () => F.tierMul[Math.max(0, Math.min(2, tier()))];
  const capP = F.maxPetals, capS = F.maxSparks, capG = F.maxGyul;

  /* ---------- 입자 ---------- */
  // 꽃잎: 납작한 마름모(양면), 반짝이: 작은 팔면체(더해 그리기), 귤: 동그란 툰
  const petalGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.2, 0.12, 0, 0, 0, 0.02, 0.18, 0, 0, -0.2, 0, 0.02, 0.18, -0.12, 0, 0], 3)); petalGeo.computeVertexNormals();
  const mk = (geo, mat, cap) => { const im = new THREE.InstancedMesh(geo, mat, cap); im.count = 0; im.frustumCulled = false; im.setColorAt(0, new THREE.Color()); scene.add(im); return im; };
  const petals = mk(petalGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), capP);
  const sparks = mk(new THREE.OctahedronGeometry(0.1, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), capS);
  const gyuls = mk(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradHard }), capG);
  sparks.renderOrder = 3;
  const pool = { p: [], s: [], g: [] }; // { x,y,z, vx,vy,vz, t, life, rx, ry, sp, sz, c, drag, grav, sway, ph }
  const caps = { p: capP, s: capS, g: capG };
  function add(kind, o) { const a = pool[kind]; if (a.length >= Math.round(caps[kind] * mul())) a.shift(); a.push(o); }
  const rand = (a, b) => a + Math.random() * (b - a);
  const PETAL_EXTRA = ['#ffffff', '#ffe3ef', '#fff4c2'].map((h) => new THREE.Color(h));
  const SPARK_C = ['#fff6c8', '#ffd47a', '#ffffff'].map((h) => new THREE.Color(h));
  const GYUL_C = new THREE.Color('#ff9a1f'), LEAF_C = new THREE.Color('#7fc35a');
  function petalColor(base) { const r = Math.random(); return r < 0.55 ? base : r < 0.9 ? PETAL_EXTRA[Math.floor(Math.random() * 3)] : LEAF_C; }

  // 솟았다가 흩날리는 꽃잎 · 반짝이 가루 (한 점에서 터짐)
  function burst(x, y, z, { petals: np = 40, sparks: ns = 20, gyul = 0, up = 5, spread = 1, color = '#ffffff', delay = 0 }) {
    const m = mul(), base = new THREE.Color(color);
    for (let i = 0; i < Math.round(np * m); i++) { const a = Math.random() * 6.28, h = rand(0.25, 1) * up, o = rand(0, spread);
      add('p', { x: x + Math.cos(a) * o, y, z: z + Math.sin(a) * o, vx: Math.cos(a) * rand(0.6, 2.4) * (0.6 + spread * 0.4), vy: h, vz: Math.sin(a) * rand(0.6, 2.4) * (0.6 + spread * 0.4), t: -delay - Math.random() * 0.25, life: rand(2.2, 3.6), rx: rand(0, 6), ry: rand(0, 6), sp: rand(4, 10), sz: rand(0.8, 1.5), c: petalColor(base), drag: 1.6, grav: 3.2, sway: rand(0.6, 1.4), ph: rand(0, 6) }); }
    for (let i = 0; i < Math.round(ns * m); i++) { const a = Math.random() * 6.28, o = rand(0, spread * 0.8);
      add('s', { x: x + Math.cos(a) * o, y: y + rand(0, 0.6), z: z + Math.sin(a) * o, vx: Math.cos(a) * rand(0.2, 1.4), vy: rand(0.4, 1) * up * 0.9, vz: Math.sin(a) * rand(0.2, 1.4), t: -delay - Math.random() * 0.35, life: rand(1.2, 2.2), rx: 0, ry: 0, sp: 0, sz: rand(0.7, 1.4), c: SPARK_C[i % 3], drag: 2.2, grav: 0.6, sway: 0.3, ph: rand(0, 6) }); }
    for (let i = 0; i < Math.min(gyul, Math.round(capG * m)); i++) { const a = Math.random() * 6.28;
      add('g', { x, y: y + 0.4, z, vx: Math.cos(a) * rand(1, 3), vy: rand(4, 7), vz: Math.sin(a) * rand(1, 3), t: -delay - i * 0.03, life: 1.6, rx: rand(0, 6), ry: rand(0, 6), sp: rand(3, 7), sz: 1, c: GYUL_C, drag: 0.4, grav: 12, sway: 0, ph: 0, bounce: true }); }
  }
  // 하늘로 오르는 꽃잎 기둥 (구역이 꽃밭이 될 때): colT 초 동안 나선으로 뿜음
  const columns = []; // { x, z, y0, t, n, done, color }
  function column(x, z, color) { columns.push({ x, z, y0: height(x, z), t: 0, done: 0, n: Math.round(F.zone.column * mul()), color: new THREE.Color(color) }); }
  function tickColumns(dt) {
    for (let i = columns.length - 1; i >= 0; i--) {
      const c = columns[i]; c.t += dt; const want = Math.min(c.n, Math.round(c.n * c.t / F.zone.colT));
      for (; c.done < want; c.done++) { const a = c.done * 2.4 + c.t * 3, r = rand(0.3, 1.6), up = rand(0.75, 1.1) * F.zone.colH / 2.2;
        add('p', { x: c.x + Math.cos(a) * r, y: c.y0 + 0.3, z: c.z + Math.sin(a) * r, vx: -Math.sin(a) * 2.2 + Math.cos(a) * 0.6, vy: up, vz: Math.cos(a) * 2.2 + Math.sin(a) * 0.6, t: 0, life: rand(4.5, 6.5), rx: rand(0, 6), ry: rand(0, 6), sp: rand(4, 10), sz: rand(1, 1.8), c: petalColor(c.color), drag: 0.55, grav: 1.1, sway: rand(1, 2), ph: rand(0, 6) });
        if (c.done % 3 === 0) add('s', { x: c.x + Math.cos(a) * r * 0.6, y: c.y0 + 0.5, z: c.z + Math.sin(a) * r * 0.6, vx: 0, vy: up * 1.1, vz: 0, t: 0, life: rand(1.8, 2.6), rx: 0, ry: 0, sp: 0, sz: rand(1, 1.6), c: SPARK_C[c.done % 3], drag: 0.6, grav: 0.4, sway: 0.4, ph: rand(0, 6) }); }
      if (c.done >= c.n) columns.splice(i, 1);
    }
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  function tickPool(kind, im, dt, time) {
    const a = pool[kind]; let n = 0;
    for (let i = a.length - 1; i >= 0; i--) {
      const o = a[i]; o.t += dt; if (o.t < 0) continue; if (o.t >= o.life) { a.splice(i, 1); continue; }
      const k = Math.exp(-o.drag * dt); o.vx *= k; o.vz *= k; o.vy = o.vy * k - o.grav * dt;
      if (kind === 'p' && o.vy < -1.1) o.vy = -1.1; // 꽃잎은 천천히 내려앉음
      o.x += (o.vx + Math.sin(time * 2.2 + o.ph) * o.sway * (kind === 'p' && o.vy < 0 ? 1 : 0.3)) * dt; o.y += o.vy * dt; o.z += (o.vz + Math.cos(time * 1.7 + o.ph) * o.sway * 0.6) * dt;
      if (o.bounce) { const g = height(o.x, o.z) + 0.16; if (o.y < g) { o.y = g; o.vy = Math.abs(o.vy) * 0.35; o.vx *= 0.6; o.vz *= 0.6; } }
      else if (kind === 'p') { const g = height(o.x, o.z) + 0.04; if (o.y < g) { o.y = g; o.vx = o.vz = 0; o.vy = 0; o.sp = 0; } }
      o.rx += o.sp * dt; o.ry += o.sp * 0.6 * dt;
      const life = o.t / o.life, fade = life > 0.75 ? 1 - (life - 0.75) / 0.25 : 1, grow = Math.min(1, o.t * 8);
      let s = o.sz * grow * (kind === 'p' ? fade : 1);
      if (kind === 's') s *= (0.6 + 0.4 * Math.sin(time * 18 + o.ph)) * fade;
      e.set(o.rx, o.ry, kind === 'p' ? Math.sin(time * 4 + o.ph) * 0.8 : 0); q.setFromEuler(e); m4.compose(v.set(o.x, o.y, o.z), q, sc.set(s, s, s));
      im.setMatrixAt(n, m4); im.setColorAt(n, kind === 's' ? col.copy(o.c).multiplyScalar(fade) : o.c); n++;
    }
    im.count = n; if (n) { im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; }
  }

  /* ---------- 땅을 따라 퍼지는 빛 고리 ---------- */
  // 띠 하나 = 안쪽(검정 = 더해 그리면 투명) · 바깥(밝은 색) 두 줄. 매 프레임 땅 높이에 맞춤
  const ringMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const rings = []; // { mesh, x, z, r0, r1, w, t, dur, c, delay }
  function ringMesh() {
    const g = new THREE.BufferGeometry(), pos = new Float32Array((SEG + 1) * 3 * 3), clr = new Float32Array((SEG + 1) * 3 * 3), idx = [];
    for (let i = 0; i < SEG; i++) { const a = i * 3, b = (i + 1) * 3; idx.push(a, b, a + 1, b, b + 1, a + 1, a + 1, b + 1, a + 2, b + 1, b + 2, a + 2); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(clr, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, ringMat); m.frustumCulled = false; m.renderOrder = 2; m.visible = false; scene.add(m); return m;
  }
  const ringPool = [];
  function ring(x, z, r1, dur, color = '#fff0a8', delay = 0, w = 0.9) {
    let r = ringPool.find((o) => !o.on); if (!r) { if (ringPool.length >= 6) r = ringPool[0]; else ringPool.push(r = { mesh: ringMesh() }); }
    Object.assign(r, { on: true, x, z, r1, dur, t: -delay, w, c: new THREE.Color(color) }); r.mesh.visible = false;
  }
  function tickRings(dt) {
    for (const r of ringPool) {
      if (!r.on) continue; r.t += dt; if (r.t < 0) { r.mesh.visible = false; continue; }
      const k = Math.min(1, r.t / r.dur); if (k >= 1) { r.on = false; r.mesh.visible = false; continue; }
      const ek = 1 - (1 - k) ** 2.2, R = 0.2 + (r.r1 - 0.2) * ek, w = Math.max(0.15, r.w * (1 - k * 0.6)), br = (k < 0.12 ? k / 0.12 : 1) * (1 - k) ** 0.7;
      const pos = r.mesh.geometry.attributes.position.array, clr = r.mesh.geometry.attributes.color.array;
      for (let i = 0; i <= SEG; i++) {
        const a = i / SEG * 6.2832, ca = Math.cos(a), sa = Math.sin(a);
        [[R - w, 0], [R, 1], [R + w * 0.35, 0.35]].forEach(([rr, b], j) => { const px = r.x + ca * Math.max(0, rr), pz = r.z + sa * Math.max(0, rr), o = (i * 3 + j) * 3;
          pos[o] = px; pos[o + 1] = height(px, pz) + 0.08 + b * 0.04; pos[o + 2] = pz; const bb = b * br; clr[o] = r.c.r * bb; clr[o + 1] = r.c.g * bb; clr[o + 2] = r.c.b * bb; });
      }
      r.mesh.geometry.attributes.position.needsUpdate = true; r.mesh.geometry.attributes.color.needsUpdate = true; r.mesh.visible = true;
    }
  }

  /* ---------- 한 번에 부르는 것 ---------- */
  // 더미 하나를 다 치움: size 's'|'l'|'xl', r 더미 반경, color 그 구역 꽃 색, gyul 귤 보상 수
  function heap({ x, z, r = 1, size = 's', color = '#ffffff', gyul = 0 }) {
    const H = F.heap[size] || F.heap.s, y = height(x, z) + 0.2, R = r + H.ring;
    for (let i = 0; i < H.rings; i++) ring(x, z, R * (1 - i * 0.18), H.ringT + i * 0.15, i ? '#ffd27a' : '#fff3b0', i * 0.12, 0.6 + r * 0.25);
    burst(x, y, z, { petals: H.petals, sparks: H.sparks, up: H.up, spread: r * 0.7, color, gyul, delay: 0.05 });
    if (size !== 's') burst(x, y, z, { petals: H.petals * 0.4, sparks: H.sparks * 0.5, up: H.up * 0.7, spread: r, color, delay: 0.45 }); // 고리가 지나갈 때 한 번 더
  }
  // 구역이 꽃밭이 됨: 플레이어 자리에서 큰 고리 + 꽃잎 기둥
  function zone({ x, z, color = '#ffffff' }) {
    ring(x, z, F.zone.ring, F.zone.ringT, '#ffe08a', 0, 2.4); ring(x, z, F.zone.ring * 0.7, F.zone.ringT * 0.9, '#fff6cc', 0.35, 1.6);
    column(x, z, color); burst(x, height(x, z) + 0.3, z, { petals: 80, sparks: 40, up: 6, spread: 1.5, color });
  }
  function update(dt, time) { tickColumns(dt); tickRings(dt); tickPool('p', petals, dt, time); tickPool('s', sparks, dt, time); tickPool('g', gyuls, dt, time); }
  const counts = () => ({ petals: pool.p.length, sparks: pool.s.length, gyul: pool.g.length, rings: ringPool.filter((r) => r.on).length, columns: columns.length, mul: mul() });
  return { heap, zone, burst, ring, update, counts };
}
