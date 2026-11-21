// 들머리 개울·돌다리·낚시하는 NPC (#31, #41, #44).
// 개울은 돌담 밖 멀리에서 흘러와 들머리 길을 가로지르고 반대쪽 돌담 밖으로 흘러간다(모양은 streamshape.js, 수문은 stonewall.js).
// 물은 lat + 쪽(시작 지점에서 오름을 볼 때 왼쪽 → 오른쪽)으로 흐른다: 잔물결·떠가는 나뭇잎.
// 돌다리로 걸어서 건넌다(#44). 옆으로 벗어나 물에 빠지면 허우적대며 하류로 떠내려가다 하류 쪽 물가 낚시꾼의 줄에 걸리고,
// 낚시꾼이 놀라 낚싯대를 당겨 다리 건너기 전 자리에 내려놓는다. 튜토리얼이 끝나도 늘 그 자리.
// 플레이어 낚시(#44)는 fishing.js 가 여기의 물길 좌표·물보라를 씀
// 좌표: 개울 가운데 c, 길 방향(오름 쪽) f, 개울 방향(하류) u. 점 = c + f*al + u*lat
import * as THREE from 'three';
import { gradHard } from './toon.js';
import { TUT, STREAM as S, BRIDGE } from './balance.js';
import { centerOff, halfW } from './streamshape.js';

const sm = (k) => k * k * (3 - 2 * k);
function mulberry(seed) { let s = seed >>> 0; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function createStream({ scene, height, groundAt, addWalkable, line, walls = [], buildRunner, outfit, low, sound }) {
  const { c, fx, fz, ux, uz } = line, W = TUT.streamW;
  const at = (al, lat) => [c.x + fx * al + ux * lat, c.z + fz * al + uz * lat];
  const local = (x, z) => { const dx = x - c.x, dz = z - c.z; return [dx * fx + dz * fz, dx * ux + dz * uz]; };
  const hw = (lat) => halfW(lat, walls);
  // 물가 둑 너머(돌담 안쪽 끝)
  const latA = walls[0] ?? -Math.hypot(line.a[0] - c.x, line.a[1] - c.z), latB = walls[1] ?? Math.hypot(line.b[0] - c.x, line.b[1] - c.z);
  const rnd = mulberry(4141);

  /* 물길 띠: 줄(lat)마다 가로 칸. cols(w) = 가운데에서 잰 길 방향 거리들. 다리 둘레는 촘촘하게 */
  const lats = []; for (let l = -S.far; l <= S.far + 0.01;) { lats.push(l); l += Math.abs(l) < S.near + 10 ? 1.5 : 5; }
  function strip(cols, lift, color) {
    const pos = [], uv = [], col = [], idx = [], m = cols(1).length;
    lats.forEach((lat, i) => {
      const w = hw(lat), o = centerOff(lat);
      cols(w).forEach((d) => { const [x, z] = at(o + d, lat); pos.push(x, height(x, z) + lift, z); uv.push(d / w, lat); if (color) col.push(...color(Math.abs(d) / w, w)); });
      if (i) for (let j = 0; j < m - 1; j++) { const a = (i - 1) * m + j, b = i * m + j; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    if (color) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  // 바닥: 물 밑은 어둡고, 물가는 자갈 색 띠가 땅으로 스며들 듯 흐려짐
  const cBed = new THREE.Color('#77745c'), cEdge = new THREE.Color('#9d977e'), cGrav = new THREE.Color('#b9b096'), tc = new THREE.Color();
  const bedCols = (w) => { const b = S.bank; return [-(w + b), -(w + b * 0.55), -w, -w * 0.8, -w * 0.4, 0, w * 0.4, w * 0.8, w, w + b * 0.55, w + b]; };
  const bedColor = (k, w) => { const e = (k - 1) * w / S.bank; // 물 가장자리 밖으로 0..1
    if (k <= 0.8) return [cBed.r, cBed.g, cBed.b, 1];
    if (k <= 1) { tc.copy(cBed).lerp(cEdge, (k - 0.8) / 0.2); return [tc.r, tc.g, tc.b, 1]; }
    tc.copy(cEdge).lerp(cGrav, Math.min(1, e * 2)); return [tc.r, tc.g, tc.b, e > 0.9 ? 0 : 1 - Math.max(0, e - 0.5) * 1.6]; };
  const bedMat = new THREE.MeshToonMaterial({ vertexColors: true, transparent: true, gradientMap: gradHard });
  const bed = new THREE.Mesh(strip(bedCols, 0.03, bedColor), bedMat); bed.receiveShadow = true; bed.renderOrder = 1; scene.add(bed);

  // 물 면: 반투명 + 흐르는 잔물결(하류로 밀려감) + 물가 흰 거품
  const uT = { value: 0 };
  const wMat = new THREE.MeshBasicMaterial({ color: '#7cc4d4', transparent: true, opacity: 0.62, depthWrite: false });
  wMat.onBeforeCompile = (s) => {
    s.uniforms.uT = uT;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vS;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvS = uv;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vS; uniform float uT;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float fl = vS.y - uT * ${S.flow.toFixed(2)};
        float r = sin(fl * 0.55 + sin(vS.x * 4.0 + vS.y * 0.2) * 1.3) * sin(vS.x * 7.0 + sin(vS.y * 0.3 - uT * 0.7) * 2.0);
        float st = sin(fl * 1.7 + sin(vS.x * 3.1 + vS.y * 0.09) * 2.2 + vS.x * 1.3);
        float hi = smoothstep(0.7, 0.92, r) + smoothstep(0.86, 0.98, st) * 0.6 * (1.0 - abs(vS.x));
        float edge = smoothstep(0.82, 1.0, abs(vS.x)) * (0.75 + 0.25 * sin(fl * 2.3 + vS.x * 9.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), clamp(hi * 0.35 + edge * 0.45, 0.0, 1.0));
        diffuseColor.a *= 1.0 - smoothstep(0.96, 1.0, abs(vS.x)) * 0.6;`);
  };
  const water = new THREE.Mesh(strip((w) => [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1].map((s) => s * w), 0.09), wMat); water.renderOrder = 2; scene.add(water);
  const waterY = (x, z) => height(x, z) + 0.09;

  /* 물가: 자갈·풀 (다리 둘레 S.near 안). 길이 지나는 곳과 낚시꾼 자리는 비움 */
  const fLat = 7.5;
  {
    const nP = low ? S.pebblesLow : S.pebbles, nR = low ? S.reedsLow : S.reeds;
    const pg = new THREE.DodecahedronGeometry(1, 0), pm = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: gradHard });
    const peb = new THREE.InstancedMesh(pg, pm, nP), M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
    for (let i = 0; i < nP; i++) {
      let lat, side, d; do { lat = (rnd() * 2 - 1) * S.near; side = rnd() < 0.5 ? -1 : 1; } while (Math.abs(lat) < 2.2);
      const w = hw(lat); d = w - 0.25 + Math.pow(rnd(), 1.6) * (S.bank * 1.05);
      const [x, z] = at(centerOff(lat) + side * d, lat), s = 0.07 + Math.pow(rnd(), 2) * 0.2;
      sc.set(s * (1 + rnd() * 0.5), s * 0.6, s); e.set(rnd() * 0.4, rnd() * 6.3, rnd() * 0.4); q.setFromEuler(e); v.set(x, height(x, z) + s * 0.25, z);
      peb.setMatrixAt(i, M.compose(v, q, sc)); const g = 0.42 + rnd() * 0.3; peb.setColorAt(i, col.setRGB(g, g * 0.97, g * 0.9));
    }
    peb.receiveShadow = true; scene.add(peb);
    // 풀포기: 가는 잎 다섯 장
    const blades = []; for (let k = 0; k < 5; k++) { const b = new THREE.ConeGeometry(0.05, 1, 3); b.translate(0, 0.5, 0); b.rotateZ((k - 2) * 0.22); b.rotateY(k * 1.3); blades.push(b); }
    const rg = (() => { const g = new THREE.BufferGeometry(), parts = blades.map((b) => b.toNonIndexed()); let n = 0; parts.forEach((p) => (n += p.attributes.position.count));
      const pos = new Float32Array(n * 3); let o = 0; parts.forEach((p) => { pos.set(p.attributes.position.array, o); o += p.attributes.position.array.length; }); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.computeVertexNormals(); return g; })();
    const reed = new THREE.InstancedMesh(rg, new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: gradHard }), nR);
    for (let i = 0; i < nR; i++) {
      let lat, side; do { lat = (rnd() * 2 - 1) * S.near; side = rnd() < 0.5 ? -1 : 1; } while (Math.abs(lat) < 3.2 || (side < 0 && Math.abs(lat - fLat) < 2.6));
      const d = hw(lat) + 0.25 + rnd() * S.bank * 0.8, [x, z] = at(centerOff(lat) + side * d, lat), s = 0.45 + rnd() * 0.5;
      sc.set(s, s * (0.9 + rnd() * 0.6), s); e.set(0, rnd() * 6.3, 0); q.setFromEuler(e); v.set(x, height(x, z) - 0.05, z);
      reed.setMatrixAt(i, M.compose(v, q, sc)); reed.setColorAt(i, col.set('#6f9a45').offsetHSL((rnd() - 0.5) * 0.04, 0, (rnd() - 0.5) * 0.12));
    }
    scene.add(reed);
  }

  /* 떠가는 나뭇잎: 물살을 따라 하류로, 끝까지 가면 상류에서 다시 */
  const NL = low ? S.leavesLow : S.leaves;
  const leafG = new THREE.PlaneGeometry(0.32, 0.18).rotateX(-Math.PI / 2);
  const leafM = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: gradHard, side: THREE.DoubleSide });
  const leafIM = new THREE.InstancedMesh(leafG, leafM, NL); leafIM.frustumCulled = false; scene.add(leafIM);
  const leaves = [];
  for (let i = 0; i < NL; i++) { leaves.push({ lat: (rnd() * 2 - 1) * S.near, s: (rnd() * 2 - 1) * 0.7, v: 0.75 + rnd() * 0.5, rot: rnd() * 6.3, spin: (rnd() - 0.5) * 1.2, ph: rnd() * 6.3 });
    leafIM.setColorAt(i, new THREE.Color(['#8fae4c', '#c58b3c', '#a7b54a', '#d3a043'][i % 4])); }
  const lM = new THREE.Matrix4(), lQ = new THREE.Quaternion(), lE = new THREE.Euler(), lV = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const flowYaw = Math.atan2(ux, uz);
  function tickLeaves(dt, t) {
    leaves.forEach((L, i) => {
      L.lat += S.flow * L.v * dt; L.rot += L.spin * dt; if (L.lat > S.near) { L.lat = -S.near; L.s = (rnd() * 2 - 1) * 0.7; }
      const s = L.s + Math.sin(t * 0.6 + L.ph) * 0.08, [x, z] = at(centerOff(L.lat) + s * hw(L.lat), L.lat);
      lE.set(Math.sin(t * 2 + L.ph) * 0.12, flowYaw + L.rot, 0); lQ.setFromEuler(lE); lV.set(x, waterY(x, z) + 0.02 + Math.sin(t * 2.4 + L.ph) * 0.015, z);
      leafIM.setMatrixAt(i, lM.compose(lV, lQ, one));
    });
    leafIM.instanceMatrix.needsUpdate = true;
  }

  /* 돌다리 (#44): 난간 없는 넓적한 현무암 판 몇 장을 길 방향으로 이어 놓음. 판마다 디딜 수 있는 네모(addWalkable)
     양끝 판은 낮고 가운데로 갈수록 조금 높음. 옆으로 벗어나면 물(inWater)이라 빠짐 */
  const B = BRIDGE, span = W + B.over, nS = B.slabs, slabL = (2 * span - (nS - 1) * B.gap) / nS;
  const slabGeo = new THREE.BoxGeometry(1, 1, 1, 2, 1, 2).translate(0, -0.5, 0);
  { const p = slabGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + 0.05 * Math.sin(x * 9 + z * 5) + 0.04 * Math.cos(z * 11 - x * 3); p.setXYZ(i, x * k, y + (y > -0.01 ? 0.02 * Math.sin(x * 13 + z * 7) : 0), z * (1 + 0.04 * Math.sin(x * 7))); } slabGeo.computeVertexNormals(); }
  const stoneMat = new THREE.MeshToonMaterial({ color: '#5d5952', gradientMap: gradHard });
  const slabMats = [stoneMat, new THREE.MeshToonMaterial({ color: '#56534c', gradientMap: gradHard }), new THREE.MeshToonMaterial({ color: '#64605a', gradientMap: gradHard })];
  const bridgeRot = Math.atan2(-fz, fx); // 판의 긴 쪽(로컬 x)을 길 방향(f)으로
  const slabs = [];
  for (let i = 0; i < nS; i++) {
    const al = -span + slabL / 2 + i * (slabL + B.gap), mid = 1 - Math.abs(al) / span, lat = Math.sin(i * 2.3) * 0.06;
    const [x, z] = at(al, lat), top = height(x, z) + B.endTop + (B.top - B.endTop) * Math.min(1, mid * 1.6), hz = B.halfW * (0.97 + 0.05 * Math.sin(i * 1.7));
    const rot = bridgeRot + Math.sin(i * 3.1) * 0.025;
    const m = new THREE.Mesh(slabGeo, slabMats[i % 3]); m.position.set(x, top, z); m.rotation.y = rot; m.scale.set(slabL, B.thick + (top - height(x, z)), hz * 2);
    m.castShadow = !low; m.receiveShadow = true; scene.add(m);
    addWalkable(x, z, rot, slabL / 2 + B.gap, hz, top); slabs.push({ x, z, top });
  }
  // 판 이음매 밑 받침돌 (물속, 양옆)
  for (let i = 1; i < nS; i++) for (const sd of [-1, 1]) {
    const al = -span + i * (slabL + B.gap) - B.gap / 2; if (Math.abs(al) > W) continue;
    const [x, z] = at(al, sd * (B.halfW - 0.25)), r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 0), stoneMat);
    r.scale.set(1.1, 0.7, 0.9); r.rotation.y = i * 1.3 + sd; r.position.set(x, height(x, z) + 0.05, z); r.receiveShadow = true; scene.add(r);
  }
  const onBridge = (x, z) => { const [al, lat] = local(x, z); return Math.abs(al) < span && Math.abs(lat) < B.halfW + 0.1 && groundAt(x, z) - height(x, z) > 0.05; };

  /* 낚시 NPC: 다리 하류 쪽, 들머리 둑의 바위에 앉아 개울을 봄 */
  const [nx, nz] = at(-W - 1.0, fLat), ny = height(nx, nz);
  const npc = buildRunner();
  npc.apply({ ...outfit, hat: { ...outfit.hat, color: '#5c9a3c' }, shirt: { ...outfit.shirt, color: '#6f93b8' }, pants: { ...outfit.pants, color: '#55574e' }, shoes: { ...outfit.shoes, color: '#3a3a40' }, gear: { hat: 'hat:straw', back: 'back:none', hand: 'hand:none' } });
  const heading = Math.atan2(fx, fz);
  npc.root.position.set(nx, ny, nz); npc.root.rotation.y = heading; scene.add(npc.root);
  const seat = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), stoneMat); seat.scale.set(1.1, 0.75, 1); seat.position.set(nx - fx * 0.12, ny + 0.2, nz - fz * 0.12); seat.castShadow = !low; scene.add(seat);
  // 놀람 표시 (!)
  const bang = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
    x.fillStyle = '#fffaf0'; x.beginPath(); x.arc(32, 30, 26, 0, 7); x.fill(); x.beginPath(); x.moveTo(24, 52); x.lineTo(32, 63); x.lineTo(38, 50); x.fill();
    x.fillStyle = '#e2453a'; x.fillRect(28, 12, 8, 24); x.fillRect(28, 41, 8, 8);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true })); sp.visible = false; sp.renderOrder = 5; scene.add(sp); return sp; })();
  // 낚싯대: 손 근처에서 개울 위로 뻗음. 끝에서 찌까지 줄
  const rodBase = new THREE.Vector3(), rodTip = new THREE.Vector3(), rodRest = new THREE.Vector3(), rodUp = new THREE.Vector3();
  const wp = (al, lat, y) => { const [x, z] = at(al, lat); return new THREE.Vector3(x, y, z); };
  rodBase.copy(wp(-W - 0.55, fLat - 0.18, ny + 0.62));
  rodRest.copy(wp(-W + 3.0, fLat - 0.9, ny + 2.3));
  rodUp.copy(wp(-W - 0.2, fLat - 0.5, ny + 3.6));
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.035, 1, 5).translate(0, 0.5, 0), new THREE.MeshToonMaterial({ color: '#7a5a34', gradientMap: gradHard }));
  rod.castShadow = !low; scene.add(rod);
  const lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3 * 12), 3));
  const fline = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: '#f4f1e8', transparent: true, opacity: 0.8 })); fline.frustumCulled = false; scene.add(fline);
  const bob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: '#e2453a' })); scene.add(bob);
  const bobLat = fLat - 1.4, bobRest = wp(-W + 3.6, bobLat, 0); bobRest.y = waterY(bobRest.x, bobRest.z) + 0.01;
  const up = new THREE.Vector3(0, 1, 0), tv = new THREE.Vector3(), tq = new THREE.Quaternion();
  const placeRod = (tip) => { rodTip.copy(tip); tv.subVectors(tip, rodBase); const L = tv.length(); rod.position.copy(rodBase); rod.scale.set(1, L, 1); tq.setFromUnitVectors(up, tv.normalize()); rod.quaternion.copy(tq); };
  const setLine = (to, sag) => { const a = lineGeo.attributes.position; for (let i = 0; i < 12; i++) { const k = i / 11; a.setXYZ(i, rodTip.x + (to.x - rodTip.x) * k, rodTip.y + (to.y - rodTip.y) * k - Math.sin(k * Math.PI) * sag, rodTip.z + (to.z - rodTip.z) * k); } a.needsUpdate = true; };

  /* 물보라·물결 고리 */
  const SP = low ? 10 : 18, sGeo = new THREE.SphereGeometry(0.08, 5, 4), sMat = new THREE.MeshBasicMaterial({ color: '#e9f6fb', transparent: true, opacity: 0.9 });
  const drops = []; for (let i = 0; i < SP; i++) { const m = new THREE.Mesh(sGeo, sMat); m.visible = false; scene.add(m); drops.push({ m, v: new THREE.Vector3(), t: 0 }); }
  const rings = []; for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.55, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })); scene.add(m); rings.push({ m, t: 9 }); }
  let ringI = 0;
  const ring = (x, y, z, delay = 0) => { const r = rings[ringI++ % rings.length]; r.m.position.set(x, y + 0.02, z); r.t = -delay; };
  function splash(x, y, z, big = 1, snd = true) {
    drops.forEach((d, i) => { const a = i / SP * Math.PI * 2 + Math.random(); d.m.position.set(x, y, z); d.v.set(Math.cos(a) * (1 + Math.random() * 2) * big, (3 + Math.random() * 3) * Math.sqrt(big), Math.sin(a) * (1 + Math.random() * 2) * big); d.t = 0; d.m.visible = true; d.m.scale.setScalar(Math.min(1, 0.4 + big)); });
    ring(x, y, z); ring(x, y, z, 0.2);
    if (snd) sound?.splash?.();
  }

  /* 빠짐 → 떠내려감 → 줄에 걸림 → 건져 올림 */
  let lastSide = -1, res = null, t = 0; const hooks = {};
  const inWater = (x, z) => { const [al, lat] = local(x, z); return Math.abs(lat) < S.far && Math.abs(al - centerOff(lat)) < hw(lat) - 0.2 && groundAt(x, z) - height(x, z) < 0.05; };
  const flowHead = Math.atan2(ux, uz), chest = new THREE.Vector3(), bobTo = new THREE.Vector3();
  function begin(p) {
    const [al0, lat0] = local(p.pos.x, p.pos.z), y0 = height(p.pos.x, p.pos.z);
    // 낚시꾼 찌보다 조금 위에서 빠지면 찌까지 떠내려옴. 아니면 낚시꾼이 바로 하류 쪽으로 찌를 던져 둠
    let catchLat = lat0 <= bobLat - 2.5 && lat0 >= bobLat - 14 ? bobLat : Math.min(latB - 3, lat0 + 3);
    if (catchLat < lat0) catchLat = lat0;
    const dist = catchLat - lat0, v = Math.max(S.flow, dist / S.driftMax), driftT = dist / v;
    const k0 = (al0 - centerOff(lat0)) / hw(lat0), catchAl = centerOff(catchLat) + k0 * 0.35 * hw(catchLat);
    const [bx, bz] = at(catchAl, catchLat); bobTo.set(bx, waterY(bx, bz) + 0.01, bz);
    const T1 = S.sinkT, T2 = T1 + driftT, T3 = T2 + S.catchT, T4 = T3 + TUT.rescueT;
    res = { t: 0, al0, lat0, k0, catchLat, v, driftT, T1, T2, T3, T4, side: lastSide, bob0: bob.position.clone(), caught: false, reeled: false, ringT: 0, from: new THREE.Vector3(), to: null };
    const to = at(lastSide * (W + 1.6), 0); res.to = new THREE.Vector3(to[0], groundAt(to[0], to[1]), to[1]);
    p.rescue = true; p.flail = true; p.target = null; p.onArrive = null; p.speed = 0; p.air = true; p.jumpV = 0; p.jumpY = 0; p.airOff = null;
    splash(p.pos.x, y0 + 0.09, p.pos.z);
  }
  function update(dt, p) {
    t += dt; uT.value = t;
    const near = !p || Math.hypot(p.pos.x - c.x, p.pos.z - c.z) < 160;
    if (near) tickLeaves(dt, t);
    if (!res) { placeRod(rodRest); bob.position.set(bobRest.x, bobRest.y + Math.sin(t * 2.2) * 0.04, bobRest.z); setLine(bob.position, 0.25); }
    if (!p || Math.hypot(p.pos.x - nx, p.pos.z - nz) < 140) npc.animate(dt, { speed: 0, running: false, pose: 'sit', t, air: false, jumpV: 0 }); // 멀면 멈춰 둠
    for (const d of drops) if (d.m.visible) { d.t += dt; d.v.y -= 14 * dt; d.m.position.addScaledVector(d.v, dt); if (d.t > 0.9) d.m.visible = false; }
    for (const r of rings) { r.t += dt; const k = Math.max(0, r.t) / 0.9; r.m.material.opacity = r.t < 0 || k > 1 ? 0 : 0.7 * (1 - k); r.m.scale.setScalar(1 + k * 3); }
    if (!p) return false;
    if (!res) { const [al, lat] = local(p.pos.x, p.pos.z), d = al - centerOff(lat); if (Math.abs(d) > hw(lat)) lastSide = Math.sign(d); }
    if (!res && !p.air && !p.riding && inWater(p.pos.x, p.pos.z) && !hooks.float?.(p)) begin(p); // 테왁 배낭이면 빠지지 않고 뜸 (#164, game/punk.js)
    if (!res) return false;
    const R = res; R.t += dt;
    const flail = (k) => { p.heading = flowHead + Math.sin(R.t * 2.6) * 0.8 * k; };
    if (R.t < R.T1) { // 첨벙 잠김. 낚시꾼이 줄을 걸 자리로 찌를 옮기기 시작
      const k = R.t / R.T1; p.jumpY = -0.55 * Math.sin(k * Math.PI / 2); flail(k);
      bob.position.lerpVectors(R.bob0, bobTo, sm(Math.min(1, R.t / (R.T1 + R.driftT * 0.7)))); placeRod(rodRest); setLine(bob.position, 0.25);
    } else if (R.t < R.T2) { // 허우적대며 하류로 떠내려감
      const k = (R.t - R.T1) / Math.max(1e-3, R.driftT), lat = R.lat0 + R.v * (R.t - R.T1);
      const kk = R.k0 + (R.k0 * 0.35 - R.k0) * sm(k), al = centerOff(lat) + kk * hw(lat), [x, z] = at(al, lat);
      p.pos.set(x, height(x, z), z); p.jumpY = -0.45 + Math.sin(R.t * 9) * 0.06; flail(1);
      bob.position.lerpVectors(R.bob0, bobTo, sm(Math.min(1, R.t / (R.T1 + R.driftT * 0.7)))); bob.position.y += Math.sin(t * 5) * 0.03;
      placeRod(rodRest); setLine(bob.position, 0.25);
      if ((R.ringT -= dt) <= 0) { R.ringT = 0.45; ring(x, waterY(x, z), z); }
    } else if (R.t < R.T3) { // 줄에 걸림: 찌가 쑥 들어가고 물이 튐, 낚시꾼이 놀라 낚싯대를 당김
      const k = (R.t - R.T2) / S.catchT;
      if (!R.caught) { R.caught = true; R.from.copy(p.pos); splash(p.pos.x, waterY(p.pos.x, p.pos.z), p.pos.z, 0.8); sound?.bite?.(); bang.visible = true; }
      p.jumpY = -0.45 + 0.25 * k; flail(1);
      chest.copy(p.pos); chest.y += 0.9 + p.jumpY; bob.position.copy(chest);
      placeRod(rodRest.clone().lerp(rodUp, sm(k))); setLine(chest, 0.4 * (1 - k));
      npc.root.position.y = ny + Math.sin(k * Math.PI) * 0.3; npc.root.rotation.x = -0.25 * Math.sin(k * Math.PI);
      bang.position.set(nx, ny + 2.9 + k * 0.2, nz); bang.scale.setScalar(0.4 + 0.5 * Math.min(1, k * 3));
    } else { // 포물선으로 끌어 올려 다리 건너기 전 자리에 내려놓음
      if (!R.reeled) { R.reeled = true; sound?.reel?.(TUT.rescueT); npc.root.position.y = ny; npc.root.rotation.x = 0; }
      const k = Math.min(1, (R.t - R.T3) / TUT.rescueT), e = k * (2 - k);
      p.pos.lerpVectors(R.from, R.to, e); p.pos.y = R.from.y + (R.to.y - R.from.y) * e;
      p.jumpY = -0.2 * (1 - k) + Math.sin(k * Math.PI) * 3.2; flail(1 - k);
      if (k > 0.5) p.heading = Math.atan2(R.side * -fx, R.side * -fz); // 개울 쪽을 봄
      placeRod(rodUp); chest.copy(p.pos); chest.y += 1.0 + p.jumpY; bob.position.copy(chest); setLine(chest, 0);
      bang.position.set(nx, ny + 3.1, nz); bang.visible = k < 0.6;
      if (k >= 1) { p.pos.y = groundAt(p.pos.x, p.pos.z); p.jumpY = 0; p.air = false; p.rescue = false; p.flail = false; p.visY = p.pos.y; res = null; bang.visible = false;
        const [al, lat] = local(p.pos.x, p.pos.z); lastSide = Math.sign(al - centerOff(lat)) || -1; }
    }
    return true;
  }
  return { hooks, update, local, splash, ring, waterY, inWater, onBridge, centerOff, halfW: hw, walls, npcPos: [nx, nz], get busy() { return !!res; }, get phase() { return res && (res.t < res.T1 ? 'sink' : res.t < res.T2 ? 'drift' : res.t < res.T3 ? 'catch' : 'reel'); }, slabs, bridge: { span, halfW: B.halfW }, npc, W, near: (side, lat = 0) => at(side * (W + 1.6), lat), at };
}
