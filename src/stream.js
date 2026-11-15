// 들머리 개울·징검다리·낚시하는 NPC (#31).
// 들머리 길을 가로지르는 얕은 개울(돌담에서 돌담까지). 징검돌은 점프해야 닿는 간격이고, 물에 빠지면
// 개울 옆에서 낚시하던 NPC 가 낚싯대로 건져 올려 건너기 전 자리에 내려놓는다. 튜토리얼이 끝나도 늘 그 자리.
// 좌표: 개울 가운데 c, 길 방향(오름 쪽) f, 개울 방향 u. 점 = c + f*along + u*lat
import * as THREE from 'three';
import { gradHard } from './toon.js';
import { TUT } from './balance.js';

export function createStream({ scene, height, groundAt, addWalkable, line, buildRunner, outfit, low, sound }) {
  const { c, fx, fz, ux, uz } = line, W = TUT.streamW;
  const at = (al, lat) => [c.x + fx * al + ux * lat, c.z + fz * al + uz * lat];
  const local = (x, z) => { const dx = x - c.x, dz = z - c.z; return [dx * fx + dz * fz, dx * ux + dz * uz]; };
  const latA = -Math.hypot(line.a[0] - c.x, line.a[1] - c.z) - 2, latB = Math.hypot(line.b[0] - c.x, line.b[1] - c.z) + 2;

  /* 물: 땅을 따라가는 띠 (바닥 + 반투명 물 면 + 잔물결) */
  const strip = (half, lift, step) => {
    const pos = [], uv = [], idx = [], n = Math.ceil((latB - latA) / step), m = 6;
    for (let i = 0; i <= n; i++) { const lat = latA + (latB - latA) * i / n;
      for (let j = 0; j <= m; j++) { const al = -half + 2 * half * j / m, [x, z] = at(al, lat); pos.push(x, height(x, z) + lift, z); uv.push(al / half, lat); }
      if (i) for (let j = 0; j < m; j++) { const a = (i - 1) * (m + 1) + j, b = i * (m + 1) + j; idx.push(a, b, a + 1, a + 1, b, b + 1); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
  };
  const bed = new THREE.Mesh(strip(W + 0.35, 0.025, 3), new THREE.MeshToonMaterial({ color: '#8c8a6c', gradientMap: gradHard }));
  bed.receiveShadow = true; scene.add(bed);
  const uT = { value: 0 };
  const wMat = new THREE.MeshBasicMaterial({ color: '#7cc4d4', transparent: true, opacity: 0.62, depthWrite: false });
  wMat.onBeforeCompile = (s) => {
    s.uniforms.uT = uT;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vW; varying vec2 vS;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xz; vS = uv;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vW; varying vec2 vS; uniform float uT;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float r = sin(vS.y * 0.55 - uT * 1.4 + sin(vS.x * 4.0 + vS.y * 0.2) * 1.3) * sin(vS.x * 7.0 + sin(vS.y * 0.3 + uT * 0.7) * 2.0);
        float hi = smoothstep(0.7, 0.92, r);
        float edge = smoothstep(0.82, 1.0, abs(vS.x));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), hi * 0.35 + edge * 0.45);
        diffuseColor.a *= 1.0 - smoothstep(0.96, 1.0, abs(vS.x)) * 0.6;`);
  };
  const water = new THREE.Mesh(strip(W, 0.09, 2), wMat); water.renderOrder = 2; scene.add(water);

  /* 징검돌: 점프해야 닿는 간격. 위에 서면 걸을 수 있는 면(addWalkable) */
  const stoneGeo = new THREE.DodecahedronGeometry(1, 0), stoneMat = new THREE.MeshToonMaterial({ color: '#57534d', gradientMap: gradHard });
  const stones = [];
  for (let i = 0; i < TUT.stones; i++) {
    const al = (i - (TUT.stones - 1) / 2) * TUT.stoneGap, lat = Math.sin(i * 2.3) * 0.35, [x, z] = at(al, lat), y = height(x, z);
    const m = new THREE.Mesh(stoneGeo, stoneMat); m.position.set(x, y + TUT.stoneTop - 0.36, z); m.scale.set(TUT.stoneR * 1.15, 0.36, TUT.stoneR * 1.05); m.rotation.y = i * 1.7;
    m.castShadow = !low; m.receiveShadow = true; scene.add(m);
    addWalkable(x, z, 0, TUT.stoneR * 0.85, TUT.stoneR * 0.85, y + TUT.stoneTop); stones.push([x, z]);
  }

  /* 낚시 NPC: 들머리 쪽 둑, 길에서 조금 떨어진 바위에 앉아 개울을 봄 */
  const fLat = 7.5, [nx, nz] = at(-W - 1.0, fLat), ny = height(nx, nz);
  const npc = buildRunner();
  npc.apply({ ...outfit, hat: { ...outfit.hat, color: '#5c9a3c' }, shirt: { ...outfit.shirt, color: '#6f93b8' }, pants: { ...outfit.pants, color: '#55574e' }, shoes: { ...outfit.shoes, color: '#3a3a40' }, gear: { hat: 'hat:straw', back: 'back:none', hand: 'hand:none' } });
  const heading = Math.atan2(fx, fz);
  npc.root.position.set(nx, ny, nz); npc.root.rotation.y = heading; scene.add(npc.root);
  const seat = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), stoneMat); seat.scale.set(1.1, 0.75, 1); seat.position.set(nx - fx * 0.12, ny + 0.2, nz - fz * 0.12); seat.castShadow = !low; scene.add(seat);
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
  const bobRest = wp(-W + 3.6, fLat - 1.4, 0); bobRest.y = height(bobRest.x, bobRest.z) + 0.1;
  const up = new THREE.Vector3(0, 1, 0), tv = new THREE.Vector3(), tq = new THREE.Quaternion();
  const placeRod = (tip) => { rodTip.copy(tip); tv.subVectors(tip, rodBase); const L = tv.length(); rod.position.copy(rodBase); rod.scale.set(1, L, 1); tq.setFromUnitVectors(up, tv.normalize()); rod.quaternion.copy(tq); };
  const setLine = (to, sag) => { const a = lineGeo.attributes.position; for (let i = 0; i < 12; i++) { const k = i / 11; a.setXYZ(i, rodTip.x + (to.x - rodTip.x) * k, rodTip.y + (to.y - rodTip.y) * k - Math.sin(k * Math.PI) * sag, rodTip.z + (to.z - rodTip.z) * k); } a.needsUpdate = true; };

  /* 물보라 */
  const SP = low ? 10 : 18, sGeo = new THREE.SphereGeometry(0.08, 5, 4), sMat = new THREE.MeshBasicMaterial({ color: '#e9f6fb', transparent: true, opacity: 0.9 });
  const drops = []; for (let i = 0; i < SP; i++) { const m = new THREE.Mesh(sGeo, sMat); m.visible = false; scene.add(m); drops.push({ m, v: new THREE.Vector3(), t: 0 }); }
  const rings = []; for (let i = 0; i < 2; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.55, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })); scene.add(m); rings.push({ m, t: 9 }); }
  function splash(x, y, z) {
    drops.forEach((d, i) => { const a = i / SP * Math.PI * 2 + Math.random(); d.m.position.set(x, y, z); d.v.set(Math.cos(a) * (1 + Math.random() * 2), 3 + Math.random() * 3, Math.sin(a) * (1 + Math.random() * 2)); d.t = 0; d.m.visible = true; });
    rings.forEach((r, i) => { r.m.position.set(x, y + 0.02, z); r.t = -i * 0.2; });
    sound?.splash?.();
  }

  /* 빠짐 → 건져 올림 */
  let lastSide = -1, res = null, t = 0;
  const inWater = (x, z) => { const [al, lat] = local(x, z); return Math.abs(al) < W - 0.2 && lat > latA + 2 && lat < latB - 2 && groundAt(x, z) - height(x, z) < 0.05; };
  function update(dt, p) {
    t += dt; uT.value = t;
    // 찌가 까딱까딱
    if (!res) { placeRod(rodRest); bob.position.set(bobRest.x, bobRest.y + Math.sin(t * 2.2) * 0.04, bobRest.z); setLine(bob.position, 0.25); }
    if (!p || Math.hypot(p.pos.x - nx, p.pos.z - nz) < 140) npc.animate(dt, { speed: 0, running: false, pose: 'sit', t, breath: 0, air: false, jumpV: 0 }); // 멀면 멈춰 둠
    for (const d of drops) if (d.m.visible) { d.t += dt; d.v.y -= 14 * dt; d.m.position.addScaledVector(d.v, dt); if (d.t > 0.9) d.m.visible = false; }
    for (const r of rings) { r.t += dt; const k = Math.max(0, r.t) / 0.9; r.m.material.opacity = r.t < 0 || k > 1 ? 0 : 0.7 * (1 - k); r.m.scale.setScalar(1 + k * 3); }
    if (!p) return false;
    const [al] = local(p.pos.x, p.pos.z);
    if (!res && Math.abs(al) > W) lastSide = Math.sign(al);
    if (!res && !p.air && !p.riding && inWater(p.pos.x, p.pos.z)) {
      const [, lat] = local(p.pos.x, p.pos.z), y0 = height(p.pos.x, p.pos.z);
      const to = at(lastSide * (W + 1.6), Math.max(latA + 4, Math.min(latB - 4, lat)));
      res = { t: 0, from: new THREE.Vector3(p.pos.x, y0, p.pos.z), to: new THREE.Vector3(to[0], height(to[0], to[1]), to[1]), side: lastSide };
      p.rescue = true; p.target = null; p.onArrive = null; p.speed = 0; p.air = true; p.jumpV = 0; p.jumpY = 0;
      splash(p.pos.x, y0 + 0.09, p.pos.z);
    }
    if (!res) return false;
    // 0~0.35초: 물에 잠김(첨벙), 그 뒤 포물선으로 끌려와 둑에 내려짐
    res.t += dt; const T = TUT.rescueT, sink = 0.35;
    const chest = new THREE.Vector3();
    if (res.t < sink) {
      const k = res.t / sink; p.pos.copy(res.from); p.jumpY = -0.55 * Math.sin(k * Math.PI / 2);
      placeRod(rodRest.clone().lerp(rodUp, k)); chest.copy(p.pos); chest.y += 0.9 + p.jumpY; setLine(chest, 0.6 * (1 - k));
    } else {
      if (!res.reeled) { res.reeled = true; sound?.reel?.(T - sink); }
      const k = Math.min(1, (res.t - sink) / (T - sink)), e = k * (2 - k);
      p.pos.lerpVectors(res.from, res.to, e); p.pos.y = res.from.y + (res.to.y - res.from.y) * e;
      p.jumpY = -0.55 * (1 - k) + Math.sin(k * Math.PI) * 3.2;
      p.heading = Math.atan2(res.side * -fx, res.side * -fz); // 개울 쪽을 봄
      placeRod(rodUp); chest.copy(p.pos); chest.y += 1.0 + p.jumpY; setLine(chest, 0);
      if (k >= 1) { p.pos.y = groundAt(p.pos.x, p.pos.z); p.jumpY = 0; p.air = false; p.rescue = false; p.visY = p.pos.y; res = null; lastSide = Math.sign(local(p.pos.x, p.pos.z)[0]) || -1; }
    }
    return true;
  }
  return { update, local, splash, npcPos: [nx, nz], get busy() { return !!res; }, stones, npc, W, near: (side, lat = 0) => at(side * (W + 1.6), lat) };
}
