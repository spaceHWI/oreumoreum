// 모아 쏘기 효과 (#129): 손·무기에 모이는 빛, 가득 찼을 때 반짝임, 센 탄을 따라가는 빛과 꼬리, 맞을 때 터지는 빛
// 다른 사람 것(vis)도 같은 모양으로 그린다. 저사양(LOW)은 빛 조각·꼬리를 줄인다. 수치는 balance.js CHARGE
import * as THREE from 'three';

export function createChargeFx({ scene, LOW }) {
  const group = new THREE.Group(); scene.add(group);
  const add = (color, op) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending });
  const ballGeo = new THREE.SphereGeometry(1, 12, 8), sparkGeo = new THREE.SphereGeometry(1, 4, 3), ringGeo = new THREE.RingGeometry(0.8, 1, 24);

  // ---------- 모이는 빛: 사람마다 하나 (key 0 = 나) ----------
  const glows = new Map();
  const SP = LOW ? 4 : 10;
  function makeGlow() {
    const core = new THREE.Mesh(ballGeo, add('#fff2b0', 0.9)), halo = new THREE.Mesh(ballGeo, add('#ff9a2e', 0.35));
    const sparks = Array.from({ length: SP }, () => { const m = new THREE.Mesh(sparkGeo, add('#ffd27a', 0.9)); m.scale.setScalar(0.035); group.add(m); return { m, a: Math.random() * 6.28, b: Math.random() * 6.28, t: Math.random() }; });
    const ring = new THREE.Mesh(ringGeo, add('#fff6c8', 0)); ring.visible = false;
    for (const o of [core, halo, ring]) { o.renderOrder = 6; group.add(o); }
    return { core, halo, sparks, ring, t: 0, pop: -1, full: false, seen: 0 };
  }
  // pos: 손 자리, k: 모은 정도 0~1, full: 가득 참 (처음 가득 찬 순간 반짝 고리)
  function glow(key, pos, k, dt, full = k >= 1) {
    let g = glows.get(key); if (!g) { g = makeGlow(); glows.set(key, g); }
    g.t += dt; g.seen = 1;
    const pulse = 1 + Math.sin(g.t * (full ? 18 : 9)) * (full ? 0.18 : 0.08), r = (0.06 + 0.16 * k) * pulse;
    g.core.visible = g.halo.visible = true;
    g.core.position.copy(pos); g.core.scale.setScalar(r); g.halo.position.copy(pos); g.halo.scale.setScalar(r * 2.6);
    g.halo.material.opacity = 0.18 + 0.3 * k;
    for (const s of g.sparks) { // 둘레에서 손으로 빨려 들어오는 빛 조각
      s.t += dt * (1.4 + k * 1.6); if (s.t > 1) { s.t -= 1; s.a = Math.random() * 6.28; s.b = Math.random() * 3 - 1.5; }
      const d = (1 - s.t) * (0.7 + 0.5 * k);
      s.m.visible = k > 0.02; s.m.position.set(pos.x + Math.cos(s.a) * Math.cos(s.b) * d, pos.y + Math.sin(s.b) * d, pos.z + Math.sin(s.a) * Math.cos(s.b) * d);
      s.m.material.opacity = 0.9 * s.t;
    }
    if (full && !g.full) g.pop = 0; g.full = full;
    if (g.pop >= 0) { g.pop += dt; const u = g.pop / 0.35; g.ring.visible = u < 1; g.ring.position.copy(pos); g.ring.scale.setScalar(0.2 + u * 1.1); g.ring.material.opacity = 0.9 * (1 - u); g.ring.quaternion.copy(cam.quaternion); if (u >= 1) g.pop = -1; }
  }
  function hideGlow(g) { g.core.visible = g.halo.visible = g.ring.visible = false; for (const s of g.sparks) s.m.visible = false; g.full = false; g.pop = -1; }
  function endGlow(key) { const g = glows.get(key); if (g) hideGlow(g); }

  // ---------- 센 탄을 따라가는 빛·꼬리: alive() 가 false 가 되면 그 자리에서 사라짐 ----------
  const follows = [];
  const TN = LOW ? 0 : 6;
  function follow(pos, k, alive, life = 2.5) {
    const ball = new THREE.Mesh(ballGeo, add('#ffcf5a', 0.55)); ball.renderOrder = 6; group.add(ball);
    const tail = Array.from({ length: TN }, () => { const m = new THREE.Mesh(ballGeo, add('#ff9a2e', 0.4)); m.renderOrder = 5; m.visible = false; group.add(m); return m; });
    follows.push({ pos, k, alive, ball, tail, hist: [], t: 0, life, ht: 0 });
  }
  // 다른 사람이 쏜 센 탄 (보이기만): from → to 로 곧게 날아가 터짐
  function orb(from, to, k, speed = 30, onEnd = null) {
    const p = from.clone(), v = to.clone().sub(from), D = v.length(); if (D < 0.3) return;
    const T = D / speed; v.divideScalar(T); let t = 0;
    const st = { p, step: (dt) => { t += dt; p.addScaledVector(v, dt); if (t >= T) { burst(to, k); onEnd?.(); return false; } return true; } };
    follow(p, k, st.step, T + 0.1);
  }
  function dropFollow(i) { const f = follows[i]; group.remove(f.ball); f.ball.material.dispose(); for (const m of f.tail) { group.remove(m); m.material.dispose(); } follows.splice(i, 1); }
  function updateFollows(dt) {
    for (let i = follows.length - 1; i >= 0; i--) {
      const f = follows[i]; f.t += dt;
      if (f.t > f.life || !f.alive(dt)) { dropFollow(i); continue; }
      const r = 0.16 + 0.22 * f.k;
      f.ball.position.copy(f.pos); f.ball.scale.setScalar(r * (1 + Math.sin(f.t * 30) * 0.1));
      if (!TN) continue;
      f.ht -= dt; if (f.ht <= 0) { f.ht = 0.03; f.hist.unshift(f.pos.x, f.pos.y, f.pos.z); if (f.hist.length > TN * 3) f.hist.length = TN * 3; }
      f.tail.forEach((m, j) => { const h = j * 3; if (h >= f.hist.length) { m.visible = false; return; } const u = 1 - (j + 1) / (TN + 1); m.visible = true; m.position.set(f.hist[h], f.hist[h + 1], f.hist[h + 2]); m.scale.setScalar(r * 0.8 * u); m.material.opacity = 0.45 * u; });
    }
  }

  // ---------- 맞을 때 터지는 빛: 커지며 옅어지는 공 + 땅 고리 ----------
  const booms = [];
  function burst(p, k) {
    const ball = new THREE.Mesh(ballGeo, add('#fff0a8', 0.9)), ring = new THREE.Mesh(ringGeo, add('#ffb347', 0.8));
    ball.position.copy(p); ring.position.copy(p); ring.quaternion.copy(cam.quaternion); ball.renderOrder = ring.renderOrder = 7;
    group.add(ball, ring); booms.push({ ball, ring, t: 0, k });
  }
  function updateBooms(dt) {
    for (let i = booms.length - 1; i >= 0; i--) {
      const B = booms[i]; B.t += dt; const u = B.t / 0.4;
      if (u >= 1) { group.remove(B.ball, B.ring); B.ball.material.dispose(); B.ring.material.dispose(); booms.splice(i, 1); continue; }
      const e = 1 - (1 - u) ** 3, s = 0.6 + 1.4 * B.k;
      B.ball.scale.setScalar(0.2 + s * 0.8 * e); B.ball.material.opacity = 0.9 * (1 - u);
      B.ring.scale.setScalar(0.3 + s * 1.6 * e); B.ring.material.opacity = 0.8 * (1 - u); B.ring.quaternion.copy(cam.quaternion);
    }
  }

  let cam = new THREE.Object3D();
  return {
    glow, endGlow, follow, orb, burst,
    setCamera(c) { cam = c; },
    update(dt) { updateFollows(dt); updateBooms(dt); for (const [key, g] of glows) { if (!g.seen) { hideGlow(g); if (key !== 0) { glows.delete(key); for (const o of [g.core, g.halo, g.ring, ...g.sparks.map((s) => s.m)]) { group.remove(o); o.material.dispose(); } } } g.seen = 0; } },
    glows, follows, booms, group,
  };
}
