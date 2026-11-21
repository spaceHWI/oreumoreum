// 무기 3~6단계 효과 (#123): 귤 총·머신건 탄, 귤즙 레이저 줄기, 귤 폭탄과 터짐, 레이저에 젖은 적
// 맞힘은 life.hitAt(점)·life.hitArea(둘레). 다른 사람이 쏜 것(vis)은 보이기만 하고 맞히지 않음
// 수치는 balance.js WEAPONS·WEAPON_FX. 저사양(LOW)은 방울·탄 꼬리를 줄임
import * as THREE from 'three';
import { height } from './world.js';
import { WEAPON_FX as F, TANGERINE as TG, COMBAT } from './balance.js';
import { steer } from './homing.js';

export function createWeaponFx({ scene, life, LOW, sound }) {
  const group = new THREE.Group(); scene.add(group);
  const q = new THREE.Quaternion(), zAx = new THREE.Vector3(0, 0, 1), m4 = new THREE.Matrix4(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const splashN = LOW ? F.splashLow : F.splash;

  // ---------- 탄 (총·머신건): 귤 알 + 뒤로 늘어진 빛 꼬리. 인스턴스 둘 ----------
  const N = LOW ? 40 : 90;
  const tanMat = new THREE.MeshLambertMaterial({ color: TG.color, emissive: TG.emissive, emissiveIntensity: TG.emissiveI });
  const pellets = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 4), tanMat, N);
  const tails = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.008, 1, 5, 1, true).rotateX(Math.PI / 2).translate(0, 0, -0.5), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.75, depthWrite: false }), N);
  for (const im of [pellets, tails]) { im.count = 0; im.visible = false; im.frustumCulled = false; group.add(im); }
  const shots = [];
  // from·vel: Vector3. opt: { dmg, grav, life, peersFn, vis(보이기만), quiet }
  function shoot(from, vel, opt = {}) {
    if (shots.length >= N) shots.shift();
    const s = { p: from.clone(), v: vel.clone(), t: 0, life: opt.life ?? 0.6, dmg: opt.dmg ?? 1, grav: opt.grav ?? 0, peersFn: opt.peersFn || null, vis: !!opt.vis, quiet: !!opt.quiet, onHit: opt.onHit || null, home: opt.home || null, ch: opt.ch || 0, sc: opt.size ? new THREE.Vector3(opt.size, opt.size, opt.size) : null }; /* ch·size: 모아 쏘기 (#129) */
    shots.push(s); return s;
  }
  function updateShots(dt) {
    let c = 0;
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i]; s.t += dt;
      let done = s.t > s.life;
      const n = Math.max(1, Math.ceil(s.v.length() * dt / 0.45)), h = dt / n; // 빨라서 나눠 움직이며 맞았는지 봄
      for (let k = 0; k < n && !done; k++) {
        s.v.y -= s.grav * h; if (s.home && !steer(s.v, s.p, s.home, h, COMBAT.homeRateBow)) s.home = null; s.p.addScaledVector(s.v, h); // 유도 (#148)
        if (!s.vis) {
          const hit = life.hitAt(s.p, s.dmg, s.v, { quiet: s.quiet, ch: s.ch });
          if (hit) { done = true; s.onHit?.(hit, s.p); life.juiceSplash(s.p, v1.copy(s.v).normalize()); if (!s.quiet) sound?.splat?.(); break; }
          if (s.peersFn && s.t > 0.03) for (const pe of s.peersFn()) { if (Math.hypot(s.p.x - pe.pos.x, s.p.z - pe.pos.z) < 0.6 && s.p.y > pe.pos.y + 0.2 && s.p.y < pe.pos.y + 2.2) { life.hooks.hitRunner?.(pe.id); done = true; break; } }
          if (done) break;
        }
        if (s.p.y <= height(s.p.x, s.p.z) + 0.05) { s.p.y = height(s.p.x, s.p.z) + 0.05; done = true; if (!LOW) puff(s.p, 2); }
      }
      if (done) { shots.splice(i, 1); continue; }
      v1.copy(s.v).normalize(); q.setFromUnitVectors(zAx, v1);
      m4.compose(s.p, q, s.sc || one); pellets.setMatrixAt(c, m4);
      v2.set(s.sc ? s.sc.x : 1, s.sc ? s.sc.x : 1, Math.min(s.t * s.v.length(), LOW ? 1.2 : 2.4) * (s.sc ? 1.6 : 1)); m4.compose(s.p, q, v2); tails.setMatrixAt(c, m4); c++;
    }
    pellets.count = tails.count = c; pellets.visible = tails.visible = c > 0; // 없을 때는 그리지 않음
    if (c) { pellets.instanceMatrix.needsUpdate = true; tails.instanceMatrix.needsUpdate = true; }
  }

  // ---------- 작은 즙 방울 (땅에 맞은 탄·젖은 적에서 떨어지는 방울·폭탄 조각) ----------
  const DN = LOW ? 40 : 120;
  const dropMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 5, 3), new THREE.MeshBasicMaterial({ color: '#ffb02e' }), DN);
  dropMesh.count = 0; dropMesh.visible = false; dropMesh.frustumCulled = false; group.add(dropMesh);
  const drops = Array.from({ length: DN }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), t: 1, life: 0, s: 1 })); let dNext = 0, dLive = false;
  function drop(p, vx, vy, vz, life = 0.5, s = 1) { const d = drops[dNext]; dNext = (dNext + 1) % DN; d.p.copy(p); d.v.set(vx, vy, vz); d.t = 0; d.life = life; d.s = s; dLive = true; }
  function puff(p, n) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28; drop(p, Math.cos(a) * 1.5, 1.5 + Math.random() * 1.5, Math.sin(a) * 1.5, 0.3, 0.7); } }
  function updateDrops(dt) {
    if (!dLive) return;
    let c = 0;
    for (const d of drops) {
      if (d.t >= d.life) continue;
      d.t += dt; d.v.y -= 14 * dt; d.p.addScaledVector(d.v, dt);
      const k = Math.max(0, 1 - d.t / d.life) * d.s; if (k <= 0) continue;
      v2.set(k, k, k); m4.compose(d.p, q.identity(), v2); dropMesh.setMatrixAt(c++, m4);
    }
    dropMesh.count = c; dropMesh.visible = c > 0; dropMesh.instanceMatrix.needsUpdate = true; if (!c) dLive = false;
  }

  // ---------- 귤즙 레이저: 밝은 속줄기 + 바깥 빛 + 끝의 빛 덩이. 나·다른 사람 몫을 미리 만들어 돌려 씀 ----------
  const coreMat = new THREE.MeshBasicMaterial({ color: '#fff1c4', transparent: true, opacity: 0.95, depthWrite: false });
  const glowMat = new THREE.MeshBasicMaterial({ color: '#ff8a1f', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending });
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
  const endGeo = new THREE.SphereGeometry(1, 8, 6);
  const beams = [];
  function beam() {
    let b = beams.find((x) => !x.used); if (b) { b.used = true; return b; }
    const root = new THREE.Group(), core = new THREE.Mesh(beamGeo, coreMat), glow = new THREE.Mesh(beamGeo, glowMat), end = new THREE.Mesh(endGeo, glowMat);
    for (const o of [core, glow, end]) { o.renderOrder = 4; o.frustumCulled = false; }
    root.add(core, glow); group.add(root, end);
    b = { used: true, root, core, glow, end, on: false, t: 0, dropT: 0 }; beams.push(b); return b;
  }
  // 줄기 하나를 from → to 로 놓음 (매 프레임). hitPos: 맞은 곳이 있으면 거기서 즙이 튐
  function setBeam(b, from, to, dt, hit, wMul = 1) { // wMul: 모아 쏜 굵은 줄기 (#129)
    b.on = true; b.t += dt;
    const L = Math.max(0.1, from.distanceTo(to)), w = F.laser.w * wMul * (1 + Math.sin(b.t * 50) * 0.15);
    b.root.visible = b.end.visible = true; b.root.position.copy(from); b.root.lookAt(to);
    b.core.scale.set(w * 0.45, w * 0.45, L); b.glow.scale.set(w * 1.6, w * 1.6, L);
    b.end.position.copy(to); b.end.scale.setScalar((0.18 + Math.sin(b.t * 37) * 0.04 + (hit ? 0.12 : 0)) * Math.sqrt(wMul));
    if (hit) { b.dropT -= dt; if (b.dropT <= 0) { b.dropT = 1 / (F.laser.drip * (LOW ? F.low : 1)); const a = Math.random() * 6.28; v1.copy(from).sub(to).normalize(); drop(to, Math.cos(a) * 2 + v1.x * 2, 1.5 + Math.random() * 2, Math.sin(a) * 2 + v1.z * 2, 0.4, 1); } }
  }
  function offBeam(b) { if (!b) return; b.on = false; b.used = false; b.root.visible = b.end.visible = false; }

  // ---------- 레이저에 젖은 적: 주황빛 껍질이 감싸고 방울이 뚝뚝 ----------
  const wetMat = new THREE.MeshBasicMaterial({ color: '#ff9a2e', transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending });
  const wets = new Map(); // 대상(pos 를 가진 것) → { mesh, t, dropT }
  function wet(tg) {
    if (!tg || !tg.pos) return;
    let w = wets.get(tg);
    if (!w) { const mesh = new THREE.Mesh(endGeo, wetMat); mesh.renderOrder = 3; group.add(mesh); w = { mesh, t: 0, dropT: 0 }; wets.set(tg, w); }
    w.t = F.laser.wet;
  }
  function updateWets(dt) {
    for (const [tg, w] of wets) {
      w.t -= dt;
      if (w.t <= 0 || tg.state === 'flee' && w.t < F.laser.wet - 0.6) { group.remove(w.mesh); wets.delete(tg); continue; }
      const h = tg.h || 0.8, r = (tg.def?.size || 1) * 0.75;
      w.mesh.position.set(tg.pos.x, tg.pos.y + h * 0.55, tg.pos.z); w.mesh.scale.set(r, h * 0.6, r);
      w.mesh.material.opacity = 0.32 * Math.min(1, w.t / 0.5);
      w.dropT -= dt; if (w.dropT <= 0) { w.dropT = LOW ? 0.18 : 0.08; v1.set(tg.pos.x + (Math.random() - 0.5) * r, tg.pos.y + h * (0.3 + Math.random() * 0.5), tg.pos.z + (Math.random() - 0.5) * r); drop(v1, 0, -0.5, 0, 0.45, 0.8); }
    }
  }

  // ---------- 귤 폭탄: 포물선으로 날아가 땅이나 적에 닿으면 터짐 ----------
  const bombGeo = new THREE.SphereGeometry(0.16, 9, 7), leafMat = new THREE.MeshLambertMaterial({ color: '#3f9a5a' }), sparkMat = new THREE.MeshBasicMaterial({ color: '#ffe27a' });
  const bombs = [];
  function makeBomb() {
    const g = new THREE.Group(), b = new THREE.Mesh(bombGeo, tanMat), lf = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 4), leafMat), sp = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 4), sparkMat);
    lf.position.y = 0.17; sp.position.set(0, 0.22, -0.03); g.add(b, lf, sp); g.userData.sp = sp; return g;
  }
  // opt: { dmg, r, vis, onBoom(pos, n) }
  function lob(from, vel, opt = {}) {
    const g = makeBomb(); g.position.copy(from); group.add(g); if (opt.size) g.scale.setScalar(opt.size);
    bombs.push({ g, v: vel.clone(), t: 0, fuse: -1, dmg: opt.dmg ?? 0, r: opt.r ?? 5, vis: !!opt.vis, onBoom: opt.onBoom || null, ch: opt.ch || 0 });
  }
  const booms = [];
  const boomGeo = new THREE.SphereGeometry(1, 14, 10), ringGeo = new THREE.RingGeometry(0.86, 1, 32).rotateX(-Math.PI / 2);
  function boom(p, r) {
    const ball = new THREE.Mesh(boomGeo, new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ff8a1f', transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    ball.position.copy(p); ring.position.set(p.x, height(p.x, p.z) + 0.12, p.z); ball.renderOrder = ring.renderOrder = 5;
    group.add(ball, ring); booms.push({ ball, ring, t: 0, r });
    const n = Math.round(F.bomb.splashN * (LOW ? F.low : 1));
    for (let i = 0; i < n; i++) life.juiceSplash(v1.set(p.x + (Math.random() - 0.5) * r * 0.6, p.y + 0.3, p.z + (Math.random() - 0.5) * r * 0.6), null);
    for (let i = 0; i < (LOW ? 10 : 24); i++) { const a = Math.random() * 6.28, sp = 4 + Math.random() * 6; drop(p, Math.cos(a) * sp, 3 + Math.random() * 5, Math.sin(a) * sp, 0.6 + Math.random() * 0.3, 1.6); }
    sound?.boom?.();
  }
  function updateBombs(dt) {
    for (let i = bombs.length - 1; i >= 0; i--) {
      const b = bombs[i], p = b.g.position; b.t += dt;
      b.g.userData.sp.scale.setScalar(0.7 + Math.random() * 0.8);
      if (b.fuse < 0) {
        b.v.y -= F.bomb.grav * dt; p.addScaledVector(b.v, dt); b.g.rotation.x += dt * 6;
        const gy = height(p.x, p.z) + 0.16;
        if (p.y <= gy || b.t > 4) { p.y = Math.max(p.y, gy); b.fuse = F.bomb.fuse; }
        else if (!b.vis && life.enemies.near(p, 1.2)) b.fuse = 0; // 적에 닿으면 바로
      } else {
        b.fuse -= dt;
        if (b.fuse <= 0) {
          group.remove(b.g); bombs.splice(i, 1);
          boom(p, b.r);
          if (!b.vis) { const n = life.hitArea(p, b.r, b.dmg, b.ch); b.onBoom?.(p, n); }
        }
      }
    }
    for (let i = booms.length - 1; i >= 0; i--) {
      const B = booms[i]; B.t += dt; const k = B.t / F.bomb.boom;
      if (k >= 1) { group.remove(B.ball, B.ring); B.ball.material.dispose(); B.ring.material.dispose(); booms.splice(i, 1); continue; }
      const e = 1 - (1 - k) ** 3;
      B.ball.scale.setScalar(0.4 + B.r * 0.45 * e); B.ball.material.opacity = 0.85 * (1 - k);
      B.ring.scale.setScalar(0.5 + B.r * e); B.ring.material.opacity = 0.8 * (1 - k);
    }
  }

  return {
    shoot, lob, beam, setBeam, offBeam, wet, boom, puff,
    update(dt) { updateShots(dt); updateBombs(dt); updateWets(dt); updateDrops(dt); },
    clear() { shots.length = 0; for (const b of bombs) group.remove(b.g); bombs.length = 0; for (const b of beams) offBeam(b); },
    shots, bombs, beams, booms, group,
  };
}
