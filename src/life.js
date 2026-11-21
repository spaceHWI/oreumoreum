import * as THREE from 'three';
import { height, surfaceAt } from './world.js';
import { createEnemies } from './enemies.js';
import { SCATTER, THROW_DMG, BOW, TANGERINE as TG, COMBAT, GYUL_PICK } from './balance.js';
import { steer } from './homing.js';
import { LOW } from './gfx2.js';
import { buildDeer, buildHareubang, shakeHareubang, wantDeer } from './lifemodels.js';

const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...o });
const box = (w, h, d, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = true; return m; };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// 노루·돌하르방 모양은 lifemodels.js (#2 Tripo 모델)

// ---------- 조랑말 ----------
function buildHorse(color) {
  const g = new THREE.Group();
  const fur = lam(color), mane = lam('#2a2222'), hoof = lam('#2b2525');
  const body = box(0.7, 0.75, 1.6, fur); body.position.y = 1.15; g.add(body);
  const neck = box(0.32, 0.75, 0.4, fur); neck.position.set(0, 1.75, 0.75); neck.rotation.x = -0.55; g.add(neck);
  const mn = box(0.1, 0.7, 0.3, mane); mn.position.set(0, 1.95, 0.62); mn.rotation.x = -0.55; g.add(mn);
  const head = new THREE.Group(); head.position.set(0, 2.1, 1.05); g.add(head);
  const skull = box(0.34, 0.38, 0.7, fur); skull.position.z = 0.1; head.add(skull);
  const muzzle = box(0.26, 0.26, 0.25, lam('#d7c7b0')); muzzle.position.set(0, -0.08, 0.5); head.add(muzzle);
  [-0.14, 0.14].forEach((x) => { const ear = box(0.08, 0.2, 0.06, fur); ear.position.set(x, 0.27, -0.1); head.add(ear); });
  [-0.15, 0.15].forEach((x) => { const eye = box(0.05, 0.07, 0.03, hoof); eye.position.set(x, 0.08, 0.3); head.add(eye); });
  const legs = [];
  [[0.25, 0.6], [-0.25, 0.6], [0.25, -0.6], [-0.25, -0.6]].forEach(([x, z]) => {
    const l = new THREE.Group(); l.position.set(x, 0.85, z); g.add(l);
    const up = box(0.2, 0.5, 0.22, fur); up.position.y = -0.2; l.add(up);
    const lo = box(0.15, 0.5, 0.16, fur); lo.position.y = -0.65; l.add(lo);
    const hf = box(0.17, 0.1, 0.18, hoof); hf.position.y = -0.9; l.add(hf);
    legs.push(l);
  });
  const tail = box(0.12, 0.8, 0.12, mane); tail.position.set(0, 1.1, -0.85); tail.rotation.x = 0.3; g.add(tail);
  g.scale.setScalar(0.8);
  return { root: g, legs, head, body, tail };
}

// ---------- 까마귀 ----------
function buildCrow() {
  const g = new THREE.Group();
  const mat = lam('#1a1a1e');
  const body = box(0.25, 0.22, 0.6, mat); g.add(body);
  const head = box(0.2, 0.2, 0.25, mat); head.position.set(0, 0.08, 0.38); g.add(head);
  const beak = box(0.06, 0.05, 0.18, lam('#3a3a3f')); beak.position.set(0, 0.04, 0.58); g.add(beak);
  const wl = box(0.9, 0.04, 0.35, mat); wl.position.set(-0.5, 0.05, 0); const wr = wl.clone(); wr.position.x = 0.5;
  const pl = new THREE.Group(); pl.add(wl); const pr = new THREE.Group(); pr.add(wr); g.add(pl, pr);
  return { root: g, wings: [pl, pr] };
}

// ---------- 나비 ----------
function buildButterfly(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
  const wing = new THREE.PlaneGeometry(0.28, 0.22);
  const l = new THREE.Mesh(wing, mat); l.position.x = -0.14; const pl = new THREE.Group(); pl.add(l);
  const r = new THREE.Mesh(wing, mat); r.position.x = 0.14; const pr = new THREE.Group(); pr.add(r);
  pl.rotation.x = -Math.PI / 2; pr.rotation.x = -Math.PI / 2;
  g.add(pl, pr);
  return { root: g, wings: [pl, pr] };
}

// ---------- 생태계 ----------
// spots: maps.js의 맵별 배치(노루 무리, 말, 까마귀, 꽃, 귤 위치, 멧돼지 등장 위치, 경계)
export function createLife({ scene, onToast, rnd, hooks, spots }) {
  let player = null, sound = null;
  function bind(p, s) { player = p; sound = s; enemies.bind(p, s); }
  const deer = [], horses = [], crows = [], flies = [];
  let L = null; // 돌려줄 객체. remote·others·leader 는 멀티 노루(#92, game/deernet.js)가 채움
  const tangerines = [];
  const group = new THREE.Group(); scene.add(group);
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const turnTo = (o, h, k) => { o.heading += wrapA(h - o.heading) * k; };

  // 하트 (먹이 먹은 뒤)
  const heartTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#e9719a'; g.font = 'bold 54px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♥', 32, 36); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const makeHeart = () => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthWrite: false })); sp.scale.set(0.7, 0.7, 1); sp.visible = false; return sp; };

  // 노루 무리
  spots.deerHerds.forEach(([hx, hz], hi) => {
    for (let i = 0; i < 3 + (hi === 0 ? 1 : 0); i++) {
      const d = buildDeer();
      const home = new THREE.Vector3(hx + (rnd() - 0.5) * 20, 0, hz + (rnd() - 0.5) * 20);
      home.y = height(home.x, home.z);
      d.root.position.copy(home);
      const heart = makeHeart(); heart.position.y = 2.25; d.root.add(heart);
      group.add(d.root);
      deer.push({ ...d, id: 'h' + deer.length, kind: 'deer', heart, home, pos: home.clone(), heading: rnd() * 6.28, state: 'graze', t: rnd() * 4, speed: 0, phase: rnd() * 6, alert: 0, followUntil: 0, target: null }); // id: 멀티에서 노루를 가리키는 이름 (#92)
    }
  });
  // 조랑말
  if (spots.horses) {
    const horseColors = ['#8a5a3a', '#c9a27a', '#4a3a30', '#e8dcc6'];
    for (let i = 0; i < spots.horses.count; i++) {
      const a = (i / spots.horses.count) * Math.PI * 2 + 0.4, r = spots.horses.ring[0] + rnd() * (spots.horses.ring[1] - spots.horses.ring[0]);
      const h = buildHorse(horseColors[i % 4]);
      const home = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r); home.y = height(home.x, home.z);
      h.root.position.copy(home);
      const heart = makeHeart(); heart.position.y = 2.8; h.root.add(heart);
      group.add(h.root);
      horses.push({ ...h, kind: 'horse', heart, home, pos: home.clone(), heading: rnd() * 6.28, state: 'graze', t: rnd() * 5, speed: 0, phase: rnd() * 6, target: null, followUntil: 0 });
    }
  }
  // 까마귀
  for (let i = 0; i < 6; i++) {
    const c = buildCrow(); group.add(c.root);
    crows.push({ ...c, a: rnd() * 6.28, r: 40 + rnd() * 60, h: 20 + rnd() * 25, w: 0.25 + rnd() * 0.2, cx: spots.crows.cx + (rnd() - 0.5) * 80, cz: spots.crows.cz + (rnd() - 0.5) * 80, flap: rnd() * 6 });
  }
  // 나비: 정해진 꽃밭 몇 곳에서만 천천히 (플레이어를 따라다니지 않음)
  const flyColors = ['#f2c94c', '#f3f0e4', '#e9719a', '#7fb8e8'];
  spots.flowers.forEach(([fx, fz], i) => {
    for (let k = 0; k < 2; k++) {
      const b = buildButterfly(flyColors[(i + k) % 4]); group.add(b.root);
      flies.push({ ...b, t: rnd() * 10, seed: rnd() * 100, anchor: new THREE.Vector3(fx + (rnd() - 0.5) * 6, 0, fz + (rnd() - 0.5) * 6) });
    }
  });

  // 귤 던지기
  const TR = 0.16 * TG.scale; // 귤 반지름 (#63)
  const tanGeo = new THREE.SphereGeometry(TR, 8, 6);
  const tanMat = new THREE.MeshLambertMaterial({ color: TG.color, emissive: TG.emissive, emissiveIntensity: TG.emissiveI });
  const glowGeo = new THREE.CircleGeometry(TG.glowR, 14).rotateX(-Math.PI / 2);
  const glowMat = new THREE.MeshBasicMaterial({ color: TG.glowColor, transparent: true, opacity: TG.glowOpacity, depthWrite: false });
  const trailGeo = new THREE.SphereGeometry(TR * 0.7, 6, 4);
  const trailMat = new THREE.MeshBasicMaterial({ color: TG.glowColor, transparent: true, opacity: TG.trailOpacity, depthWrite: false });
  const leafGeo = new THREE.PlaneGeometry(0.14 * TG.scale, 0.08 * TG.scale);
  const leafMat = new THREE.MeshLambertMaterial({ color: '#4f8a3a', side: THREE.DoubleSide });
  // vy: 위로 던지는 속도(없으면 power*0.55). 자동 조준(#34)이 대상까지 닿게 정해 넘김
  // 던진 귤 꼬리 (#63): 지나온 자리에 작아지며 옅어지는 점 몇 개. 귤마다 재질을 따로 둬 투명도를 낮춤
  function makeTrail() {
    const out = [];
    for (let i = 0; i < TG.trailN; i++) { const mt = trailMat.clone(); const t = new THREE.Mesh(trailGeo, mt); t.visible = false; group.add(t); out.push(t); }
    return out;
  }
  function dropTrail(tg) { if (!tg.trail) return; for (const t of tg.trail) { group.remove(t); t.material.dispose(); } tg.trail = null; }
  // 땅에 놓인 귤: 살짝 떠서 천천히 돌고 아래에 옅은 빛 원 (#63)
  function restTangerine(tg, time, dt) {
    const m = tg.mesh;
    if (!tg.glow) { tg.glow = new THREE.Mesh(glowGeo, glowMat); tg.glow.renderOrder = 1; m.add(tg.glow); m.rotation.set(0, rnd() * 6.28, 0); tg.baseY = m.position.y; tg.ph = rnd() * 6.28; }
    m.rotation.y += TG.spin * dt;
    m.position.y = tg.baseY + TG.hover + Math.sin(time * TG.bobSpeed + tg.ph) * TG.bob;
    tg.glow.position.y = tg.baseY - m.position.y + 0.03; // 위로 뜬 만큼 내려 땅에 붙임
  }
  function throwTangerine(from, dir, power, peersFn, vy, home = null, ch = null) { // home: 유도 대상 (#148), ch: 모아 쏘기 { k, mul, size } (#129)
    const m = new THREE.Mesh(tanGeo, tanMat); m.castShadow = true; if (ch) m.scale.setScalar(ch.size);
    const leaf = new THREE.Mesh(leafGeo, leafMat); leaf.position.y = TR + 0.01; leaf.rotation.x = -1; m.add(leaf);
    m.position.copy(from); group.add(m);
    const v = dir.clone().multiplyScalar(power); v.y += vy ?? power * 0.55;
    const tg = { mesh: m, vel: v, t: 0, landed: false, rest: 0, peersFn, hitDone: false, claimedBy: null, trail: makeTrail(), trailT: 0, hist: [], home, ch: ch?.k || 0, mul: ch?.mul || 1 };
    tangerines.push(tg); return tg;
  }
  // 받혀서 귤이 흩어짐 (#32): 중심 둘레 반경 SCATTER.rMin~rMax 안 무작위 자리로 포물선을 그리며 떨어지고, SCATTER.life 초 동안 다시 주울 수 있음
  // n 귤을 흩뿌림. maxN 개보다 많으면 알갱이는 maxN 개로 두고 하나에 귤 여러 개를 나눠 담음 (#137 적 귤이 커짐)
  function scatterTangerines(center, n, maxN = Infinity) {
    const T = SCATTER.air, cnt = Math.min(n, maxN), each = Math.floor(n / cnt), rest = n - each * cnt;
    for (let i = 0; i < cnt; i++) {
      let x = center.x, z = center.z;
      for (let k = 0; k < 6; k++) {
        const a = rnd() * Math.PI * 2, r = SCATTER.rMin + rnd() * (SCATTER.rMax - SCATTER.rMin);
        const tx = center.x + Math.sin(a) * r, tz = center.z + Math.cos(a) * r;
        if (spots.inBounds(tx, tz)) { x = tx; z = tz; break; }
      }
      const m = new THREE.Mesh(tanGeo, tanMat); m.castShadow = true;
      const leaf = new THREE.Mesh(leafGeo, leafMat); leaf.position.y = TR + 0.01; leaf.rotation.x = -1; m.add(leaf);
      const y0 = center.y + 1; m.position.set(center.x, y0, center.z); group.add(m);
      const gy = height(x, z) + TR, tt = T * (0.8 + rnd() * 0.4);
      const v = new THREE.Vector3((x - center.x) / tt, (gy - y0) / tt + 11 * tt, (z - center.z) / tt);
      tangerines.push({ mesh: m, vel: v, t: 0, landed: false, rest: 0, peersFn: null, hitDone: true, hbHit: true, claimedBy: null, drop: true, v: each + (i < rest ? 1 : 0), trail: makeTrail(), trailT: 0, hist: [] });
    }
  }
  // ---------- 귤 활 화살 (#38) ----------
  // 막대 + 앞에 작은 귤 + 뒤에 잎 깃. 직선에 가깝게 빠르게 날아가고, 맞거나 땅에 닿으면 즙이 튀고 사라짐 (다시 줍지 못함)
  const shaftGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.9, 5).rotateX(Math.PI / 2);
  const shaftMat = new THREE.MeshLambertMaterial({ color: '#b08350' });
  const headGeo = new THREE.SphereGeometry(0.1, 7, 5);
  const fletchGeo = new THREE.PlaneGeometry(0.12, 0.16);
  const arrows = [];
  const zAxis = new THREE.Vector3(0, 0, 1), aTmp = new THREE.Vector3(), aStep = new THREE.Vector3();
  function makeArrow() {
    const g = new THREE.Group();
    const sh = new THREE.Mesh(shaftGeo, shaftMat); g.add(sh);
    const hd = new THREE.Mesh(headGeo, tanMat); hd.position.z = 0.48; hd.scale.set(1, 1, 1.15); g.add(hd);
    const f1 = new THREE.Mesh(fletchGeo, leafMat); f1.position.z = -0.38; f1.rotation.y = Math.PI / 2;
    const f2 = new THREE.Mesh(fletchGeo, leafMat); f2.position.z = -0.38; f2.rotation.x = Math.PI / 2; g.add(f1, f2);
    g.traverse((o) => { if (o.isMesh) o.castShadow = !LOW; });
    return g;
  }
  // vel: 처음 속도(Vector3), opt: { dmg, grav, peersFn }
  function shootArrow(from, vel, opt = {}) {
    const m = makeArrow(); m.position.copy(from); m.quaternion.setFromUnitVectors(zAxis, aTmp.copy(vel).normalize()); group.add(m); if (opt.size) m.scale.setScalar(opt.size);
    const a = { mesh: m, vel: vel.clone(), t: 0, dmg: opt.dmg ?? 2, grav: opt.grav ?? 5, peersFn: opt.peersFn || null, home: opt.home || null, ch: opt.ch || 0 }; arrows.push(a); return a;
  }
  function endArrow(i, hit) {
    const a = arrows[i]; group.remove(a.mesh); arrows.splice(i, 1);
    if (hit) { juiceSplash(a.mesh.position, aTmp.copy(a.vel).normalize()); sound?.splat?.(); }
  }
  function updateArrows(dt) {
    for (let i = arrows.length - 1; i >= 0; i--) {
      const a = arrows[i]; a.t += dt;
      if (a.t > BOW.life) { endArrow(i, false); continue; }
      const p = a.mesh.position, n = Math.max(1, Math.ceil(a.vel.length() * dt / 0.45)), h = dt / n; // 빨라서 나눠 움직이며 맞았는지 봄
      let done = false;
      for (let k = 0; k < n && !done; k++) {
        a.vel.y -= a.grav * h; if (a.home && a.t < COMBAT.homeT && !steer(a.vel, p, a.home, h, COMBAT.homeRateBow)) a.home = null; p.addScaledVector(a.vel, h); // 유도 (#148)
        const dummy = { vel: aStep.set(0, 0, 0), ch: a.ch };
        if (enemies.hitTest(p, dummy, a.dmg) || extraHit(p, dummy, a.dmg)) { done = true; break; }
        for (const hb of hareubangs) {
          if (Math.hypot(p.x - hb.pos.x, p.z - hb.pos.z) < 0.8 && p.y > hb.pos.y + 0.3 && p.y < hb.pos.y + 3.3) { hb.hitT = 1; sound.stone(); onToast('하르방 코를 맞혔어요. 복이 온대요'); hooks.hareubang?.(); done = true; break; }
        }
        if (done) break;
        if (a.peersFn && a.t > 0.05) for (const pe of a.peersFn()) { if (Math.hypot(p.x - pe.pos.x, p.z - pe.pos.z) < 0.6 && p.y > pe.pos.y + 0.2 && p.y < pe.pos.y + 2.2) { hooks.hitRunner?.(pe.id); done = true; break; } }
        if (done) break;
        if (p.y <= height(p.x, p.z) + 0.05) { p.y = height(p.x, p.z) + 0.05; done = true; }
      }
      if (done) { endArrow(i, true); continue; }
      a.mesh.quaternion.setFromUnitVectors(zAxis, aTmp.copy(a.vel).normalize());
    }
  }
  // 즙 튀기: 작은 방울들이 맞은 곳에서 뒤쪽·위로 튀고 떨어지며 작아짐 (방울은 미리 만들어 돌려 씀)
  const JUICE_N = LOW ? 24 : 48;
  const juiceMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 5, 4), new THREE.MeshBasicMaterial({ color: '#ffb02e' }), JUICE_N);
  juiceMesh.frustumCulled = false; juiceMesh.count = 0; scene.add(juiceMesh);
  const drops = []; for (let i = 0; i < JUICE_N; i++) drops.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), t: 0, life: 0, s: 1 });
  let dropNext = 0, juiceLive = 0;
  function juiceSplash(pos, dir) {
    const n = LOW ? BOW.splashLow : BOW.splash;
    for (let i = 0; i < n; i++) {
      const d = drops[dropNext]; dropNext = (dropNext + 1) % JUICE_N;
      const a = rnd() * Math.PI * 2, sp = 2 + rnd() * 3.5;
      d.p.copy(pos); d.v.set(Math.cos(a) * sp, 2.5 + rnd() * 3.5, Math.sin(a) * sp);
      if (dir) d.v.addScaledVector(dir, -2.5); // 날아온 쪽으로 조금 더 튐
      d.t = 0; d.life = 0.35 + rnd() * 0.3; d.s = 0.6 + rnd() * 0.9;
    }
    juiceLive = 1;
  }
  const jm = new THREE.Matrix4(), jq = new THREE.Quaternion(), js = new THREE.Vector3();
  function updateJuice(dt) {
    if (!juiceLive) return;
    let c = 0;
    for (const d of drops) {
      if (d.t >= d.life) continue;
      d.t += dt; d.v.y -= 16 * dt; d.p.addScaledVector(d.v, dt);
      const k = Math.max(0, 1 - d.t / d.life) * d.s; if (k <= 0) continue;
      js.set(k, k, k); jm.compose(d.p, jq, js); juiceMesh.setMatrixAt(c++, jm);
    }
    juiceMesh.count = c; juiceMesh.instanceMatrix.needsUpdate = true;
    if (!c) juiceLive = 0;
  }
  const hareubangs = [];
  function addHareubang(pos, heading) {
    const h = buildHareubang(); h.root.position.copy(pos); h.root.rotation.y = heading; scene.add(h.root);
    const e = { ...h, pos: pos.clone(), hitT: 0 }; hareubangs.push(e); return e;
  }

  // 떨어진 귤을 먹으러 오기 · 먹고 나면 한동안 따라오기 (노루·말 공통)
  function seekFood(a, range) {
    if (a.target || a.state === 'ridden' || a.state === 'flee') return;
    let best = null, bd = range;
    for (const tg of tangerines) { if (!tg.landed || tg.eaten || tg.claimedBy || tg.drop) continue; const d = tg.mesh.position.distanceTo(a.pos); if (d < bd) { bd = d; best = tg; } }
    if (best) { best.claimedBy = a; a.target = best; a.state = 'food'; }
  }
  function feedStep(a, dt, time) { // returns desired speed or null if not handled
    if (a.target) {
      const tg = a.target;
      if (tg.eaten || !tg.mesh.parent) { a.target = null; a.state = 'graze'; a.t = 2; return 0; }
      const to = tg.mesh.position.clone().sub(a.pos).setY(0); const dist = to.length();
      if (dist < 1.5) {
        a.state = 'eat'; tg.eatT = (tg.eatT ?? 2.2) - dt;
        if (tg.eatT < 0) {
          tg.eaten = true; group.remove(tg.mesh); a.target = null;
          a.followUntil = time + 60; a.state = 'follow'; a.heart.visible = true; a.heartT = 2.5; a.followWho = tg.feeder || null; // 다른 사람이 준 귤이면 그 사람을 따라감 (#92)
          if (!tg.feeder) { sound.crunch?.(); hooks.fed?.(a.kind); onToast(a.kind === 'deer' ? '노루가 귤을 먹고 졸졸 따라와요' : '조랑말이 귤을 먹고 따라와요'); }
        }
        return 0;
      }
      turnTo(a, Math.atan2(to.x, to.z), Math.min(1, dt * 6));
      return a.kind === 'deer' ? 3.2 : 2.6;
    }
    const ld = a.followWho ? L.leader?.(a.followWho) : player; // 따라갈 사람: 나 또는 멀티의 다른 사람 (#92)
    if (a.followUntil > time && ld) {
      a.state = 'follow';
      const behind = ld.pos.clone().add(new THREE.Vector3(Math.sin(ld.heading + Math.PI + (a.kind === 'deer' ? 0.6 : -0.6)), 0, Math.cos(ld.heading + Math.PI + (a.kind === 'deer' ? 0.6 : -0.6))).multiplyScalar(3.4));
      const to = behind.sub(a.pos).setY(0); const dist = to.length();
      if (dist > 60) { a.followUntil = 0; return 0; }
      if (dist < 0.8) { turnTo(a, ld.heading, Math.min(1, dt * 3)); return 0; }
      turnTo(a, Math.atan2(to.x, to.z), Math.min(1, dt * 6));
      return Math.min(ld.speed + dist * 0.8, a.kind === 'deer' ? 13 : 11);
    }
    if (a.state === 'follow') { a.state = 'graze'; a.t = 3; if (!a.followWho) onToast(a.kind === 'deer' ? '노루가 제자리로 돌아가요' : '조랑말이 풀 뜯으러 가요'); a.followWho = null; }
    return null;
  }
  const legs4 = (a, amp) => { a.legs[0].rotation.x = Math.sin(a.phase) * amp; a.legs[3].rotation.x = Math.sin(a.phase) * amp; a.legs[1].rotation.x = -Math.sin(a.phase) * amp; a.legs[2].rotation.x = -Math.sin(a.phase) * amp; };
  const tickHeart = (a, dt) => { if (a.heartT > 0) { a.heartT -= dt; a.heart.position.y = (a.kind === 'deer' ? 2.3 : 2.8) + (2.5 - a.heartT) * 0.4; a.heart.material.opacity = Math.min(1, a.heartT); if (a.heartT <= 0) a.heart.visible = false; } };

  let nearDeerToast = 0;
  // 가장 가까운 사람: 나, 그리고 L.others()(멀티 방장일 때 다른 사람 [{ pos, fast }]) (#92)
  const nrOut = { d: 0, pos: null, fast: false, me: true };
  function nearRunner(at) {
    nrOut.d = player.pos.distanceTo(at); nrOut.pos = player.pos; nrOut.fast = player.running || player.speed > 6; nrOut.me = true;
    const os = L.others?.(); if (os) for (const o of os) { const dd = o.pos.distanceTo(at); if (dd < nrOut.d) { nrOut.d = dd; nrOut.pos = o.pos; nrOut.fast = o.fast; nrOut.me = false; } }
    return nrOut;
  }
  // 방장이 알려 준 자리(d.net = { x, z, h, s, v })로 부드럽게 잇고 상태대로 움직임 (#92)
  function remoteDeer(d, dt, time) {
    const n = d.net;
    if (n) {
      const k = Math.min(1, dt * 5), nx = d.pos.x + (n.x - d.pos.x) * k, nz = d.pos.z + (n.z - d.pos.z) * k;
      if (Math.hypot(n.x - d.pos.x, n.z - d.pos.z) > 25) d.pos.set(n.x, 0, n.z); else d.pos.set(nx, 0, nz);
      d.pos.y = height(d.pos.x, d.pos.z); d.heading += wrapA(n.h - d.heading) * Math.min(1, dt * 6); d.speed += (n.v - d.speed) * k;
      if (n.s !== d.state && n.s !== 'ridden') d.state = n.s;
    }
    d.root.position.copy(d.pos); d.root.rotation.y = d.heading;
    d.root.position.y += d.state === 'flee' ? Math.abs(Math.sin(d.phase * 0.9)) * 0.5 : 0;
    legs4(d, d.speed > 0.1 ? 0.6 : 0);
    d.head.rotation.x = d.state === 'graze' || d.state === 'eat' ? 0.9 + Math.sin(time * (d.state === 'eat' ? 8 : 1.5) + d.phase) * 0.1 : (d.state === 'alert' ? -0.2 : 0.2);
    d.fx?.(dt, time, d); wantDeer(Math.hypot(d.pos.x - player.pos.x, d.pos.z - player.pos.z));
  }
  function update(dt, time) {
    if (!player || !sound) return;
    // 노루
    for (const d of deer) {
      d.t -= dt; d.phase += dt * (d.speed > 0.1 ? d.speed * 2.2 : 0);
      tickHeart(d, dt);
      if (d.state === 'ridden') {
        d.root.position.copy(d.pos); d.root.rotation.y = d.heading;
        legs4(d, d.speed > 0.1 ? 0.7 : 0);
        d.root.position.y += d.speed > 4 ? Math.abs(Math.sin(d.phase * 0.5)) * 0.25 : 0;
        d.head.rotation.x = 0.1; d.fx?.(dt, time, d); wantDeer(Math.hypot(d.pos.x - player.pos.x, d.pos.z - player.pos.z));
        continue;
      }
      if (L.remote) { remoteDeer(d, dt, time); continue; } // 멀티에서 방장이 아니면 방장이 알려 준 대로만 (#92)
      seekFood(d, 30);
      let want = feedStep(d, dt, time);
      const friendly = d.target || d.followUntil > time;
      if (want === null) {
        const nr = nearRunner(d.pos), dp = nr.d; // 가장 가까운 사람 (멀티의 방장이면 다른 사람도, #92)
        const fast = nr.fast;
        const fleeD = fast ? 4.5 : 1.6; // 살금살금 걸으면 가까이 갈 수 있음
        if (dp < fleeD && d.state !== 'flee') { d.state = 'flee'; d.t = 2.5 + rnd(); const away = d.pos.clone().sub(nr.pos).setY(0).normalize(); d.heading = Math.atan2(away.x, away.z); if (nr.me) sound.deerHop?.(); }
        else if (dp < 10 && d.state === 'graze' && fast) { d.state = 'alert'; d.t = 1.5; const to = nr.pos.clone().sub(d.pos).setY(0).normalize(); d.heading = Math.atan2(to.x, to.z); if (nr.me && nearDeerToast < time) { nearDeerToast = time + 25; onToast('노루가 이쪽을 보고 있어요. 천천히 다가가거나 귤을 던져 보세요'); } }
        want = 0;
        if (d.state === 'flee') { want = 7; if (d.t < 0) { d.state = 'walk'; d.t = 3; d.heading = Math.atan2(d.home.x - d.pos.x, d.home.z - d.pos.z) + (rnd() - 0.5); } }
        else if (d.state === 'alert') { if (d.t < 0) { d.state = 'graze'; d.t = 2 + rnd() * 3; } }
        else if (d.state === 'walk') { want = 1.6; if (d.t < 0) { d.state = 'graze'; d.t = 3 + rnd() * 4; } }
        else { if (d.t < 0) { d.state = 'walk'; d.t = 2 + rnd() * 3; const far = d.pos.distanceTo(d.home) > 30; d.heading = far ? Math.atan2(d.home.x - d.pos.x, d.home.z - d.pos.z) : rnd() * 6.28; } }
      }
      d.speed += (want - d.speed) * Math.min(1, dt * 5);
      if (d.speed > 0.05) {
        const nx = d.pos.x + Math.sin(d.heading) * d.speed * dt, nz = d.pos.z + Math.cos(d.heading) * d.speed * dt;
        // 길(송이·흙)은 건너도 되고 계단만 피함. 막히면 집 쪽으로 방향을 새로 잡고 잠깐 멈춤 (제자리 회전 방지)
        const ok = spots.deerZone(nx, nz) && (friendly || surfaceAt(nx, nz) !== 2 || d.state === 'flee');
        if (ok || friendly) d.pos.set(nx, height(nx, nz), nz);
        else { d.heading = Math.atan2(d.home.x - d.pos.x, d.home.z - d.pos.z) + (rnd() - 0.5) * 1.2; d.speed = 0; if (d.state !== 'flee') { d.state = 'walk'; d.t = 2 + rnd() * 2; } }
      }
      d.root.position.copy(d.pos); d.root.rotation.y = d.heading;
      d.root.position.y += d.state === 'flee' ? Math.abs(Math.sin(d.phase * 0.9)) * 0.5 : 0;
      legs4(d, d.speed > 0.1 ? 0.6 : 0);
      d.head.rotation.x = d.state === 'graze' || d.state === 'eat' ? 0.9 + Math.sin(time * (d.state === 'eat' ? 8 : 1.5) + d.phase) * 0.1 : (d.state === 'alert' ? -0.2 : 0.2);
      d.fx?.(dt, time, d); wantDeer(Math.hypot(d.pos.x - player.pos.x, d.pos.z - player.pos.z)); // 가까이 오면 모델을 받음 (#2)
    }
    // 조랑말
    for (const h of horses) {
      h.t -= dt; tickHeart(h, dt);
      seekFood(h, 30);
      let want = feedStep(h, dt, time);
      const friendly = h.target || h.followUntil > time;
      if (want === null) {
        want = 0;
        if (h.state === 'walk') { want = 1.2; if (h.t < 0) { h.state = 'graze'; h.t = 4 + rnd() * 5; } }
        else { if (h.t < 0) { h.state = 'walk'; h.t = 2 + rnd() * 3; const far = h.pos.distanceTo(h.home) > 40; h.heading = far ? Math.atan2(h.home.x - h.pos.x, h.home.z - h.pos.z) : rnd() * 6.28; } }
      }
      h.speed += (want - h.speed) * Math.min(1, dt * 4);
      h.phase += dt * h.speed * 2;
      if (h.speed > 0.05) {
        const nx = h.pos.x + Math.sin(h.heading) * h.speed * dt, nz = h.pos.z + Math.cos(h.heading) * h.speed * dt;
        if (friendly ? spots.inBounds(nx, nz) : spots.horses.zone(nx, nz)) h.pos.set(nx, height(nx, nz), nz);
        else { h.heading = Math.atan2(h.home.x - h.pos.x, h.home.z - h.pos.z) + (rnd() - 0.5) * 1.2; h.speed = 0; if (h.state !== 'flee') { h.state = 'walk'; h.t = 2 + rnd() * 2; } }
      }
      h.root.position.copy(h.pos); h.root.rotation.y = h.heading;
      legs4(h, h.speed > 0.1 ? 0.5 : 0);
      h.head.rotation.x = h.state === 'graze' || h.state === 'eat' ? 0.8 + Math.sin(time * (h.state === 'eat' ? 7 : 2) + h.phase) * 0.12 : 0.1;
      h.tail.rotation.z = Math.sin(time * 1.7 + h.phase) * 0.3;
    }
    // 까마귀
    for (const c of crows) {
      c.a += dt * c.w; c.flap += dt * 9;
      const x = c.cx + Math.cos(c.a) * c.r, z = c.cz + Math.sin(c.a) * c.r;
      const y = height(x, z) + c.h + Math.sin(c.a * 3) * 4;
      c.root.position.set(x, Math.max(y, spots.crows.minY), z);
      c.root.rotation.y = -c.a + Math.PI / 2 - 0.3;
      c.root.rotation.z = 0.25;
      const f = Math.sin(c.flap) * (Math.sin(c.a * 2) > 0.3 ? 0.6 : 0.08);
      c.wings[0].rotation.z = f; c.wings[1].rotation.z = -f;
    }
    // 나비: 꽃밭 주변을 천천히, 가까울 때만 그림
    for (const b of flies) {
      const near = b.anchor.distanceTo(player.pos) < 60;
      b.root.visible = near; if (!near) continue;
      b.t += dt;
      const x = b.anchor.x + Math.sin(b.t * 0.22 + b.seed) * 2.2, z = b.anchor.z + Math.cos(b.t * 0.17 + b.seed * 2) * 2.2;
      const y = height(x, z) + 0.7 + Math.sin(b.t * 0.8 + b.seed) * 0.25;
      b.root.position.set(x, y, z);
      b.root.rotation.y = b.t * 0.22 + b.seed + Math.PI / 2;
      const f = 0.25 + Math.sin(b.t * 6) * 0.45;
      b.wings[0].rotation.y = f; b.wings[1].rotation.y = -f;
    }
    // 귤
    for (let i = tangerines.length - 1; i >= 0; i--) {
      const tg = tangerines[i];
      if (tg.landed) { tg.rest += dt; restTangerine(tg, time, dt); if (tg.rest > (tg.drop ? SCATTER.life : 45) || tg.eaten) { if (!tg.eaten) group.remove(tg.mesh); if (tg.claimedBy && tg.claimedBy.target === tg) tg.claimedBy.target = null; tangerines.splice(i, 1); } continue; }
      tg.vel.y -= 22 * dt; tg.t += dt;
      const p = tg.mesh.position;
      if (tg.home && (tg.enemyHit || tg.t > COMBAT.homeT || !steer(tg.vel, p, tg.home, dt, COMBAT.homeRate))) tg.home = null; // 유도 (#148)
      p.addScaledVector(tg.vel, dt);
      tg.mesh.rotation.x += dt * 8; tg.mesh.rotation.z += dt * 5;
      if (tg.trail) { // 꼬리 (#63): 일정 간격으로 지난 자리를 기록, 오래될수록 작고 옅게
        tg.trailT -= dt; if (tg.trailT <= 0) { tg.trailT = TG.trailEvery; tg.hist.unshift(p.x, p.y, p.z); if (tg.hist.length > TG.trailN * 3) tg.hist.length = TG.trailN * 3; }
        for (let k = 0; k < tg.trail.length; k++) { const t = tg.trail[k], h = k * 3; if (h >= tg.hist.length) { t.visible = false; continue; } const f = 1 - (k + 1) / (tg.trail.length + 1); t.visible = true; t.position.set(tg.hist[h], tg.hist[h + 1], tg.hist[h + 2]); t.scale.setScalar(f); t.material.opacity = TG.trailOpacity * f; }
      }
      if (!tg.hitDone && tg.t > 0.15 && tg.peersFn) {
        for (const pe of tg.peersFn()) {
          if (Math.hypot(p.x - pe.pos.x, p.z - pe.pos.z) < 0.7 && p.y > pe.pos.y + 0.2 && p.y < pe.pos.y + 2.2) { tg.hitDone = true; hooks.hitRunner?.(pe.id); tg.vel.set(-tg.vel.x * 0.2, 2, -tg.vel.z * 0.2); sound.beep(false); break; }
        }
      }
      if (!tg.drop && !tg.enemyHit && (enemies.hitTest(p, tg, THROW_DMG.hand * (hooks.dmgMul?.() ?? 1) * (tg.mul || 1)) || extraHit(p, tg, THROW_DMG.hand * (hooks.dmgMul?.() ?? 1) * (tg.mul || 1)))) tg.enemyHit = true; // 적 (#37) · 투기꾼 (#47)
      for (const hb of hareubangs) {
        const hd = Math.hypot(p.x - hb.pos.x, p.z - hb.pos.z);
        if (hd < 0.8 && p.y > hb.pos.y + 0.3 && p.y < hb.pos.y + 3.3 && !tg.hbHit) {
          tg.hbHit = true;
          tg.vel.set(-tg.vel.x * 0.3, Math.abs(tg.vel.y) * 0.3 + 2, -tg.vel.z * 0.3);
          hb.hitT = 1; sound.stone(); onToast('하르방 코를 맞혔어요. 복이 온대요'); hooks.hareubang?.();
        }
      }
      const gy = height(p.x, p.z) + TR;
      if (p.y <= gy) {
        p.y = gy;
        if (!tg.drop && Math.abs(tg.vel.y) > 2.5) { tg.vel.y = -tg.vel.y * 0.35; tg.vel.x *= 0.6; tg.vel.z *= 0.6; sound.step(surfaceAt(p.x, p.z), false); }
        else { tg.landed = true; tg.vel.set(0, 0, 0); dropTrail(tg); }
      }
    }
    // 던진 귤 다시 줍기 (동물이 먹으러 오는 중이 아니면)
    for (let i = tangerines.length - 1; i >= 0; i--) {
      const tg = tangerines[i];
      if (!tg.landed || tg.eaten || tg.claimedBy || tg.rest < 0.6 || player.riding) continue;
      const p = tg.mesh.position;
      if ((p.x - player.pos.x) ** 2 + (p.z - player.pos.z) ** 2 < (tg.drop ? hooks.pickR2?.() || 1.6 : hooks.throwR2?.() || 1.6)) { tangerines.splice(i, 1); const v = tg.v || 1; suck(tg.mesh, (at) => hooks.reclaim?.(at, v)); } // 범위 안이면 빨려 옴 (#151), 싸우는 중엔 더 넓게 (#148)
    }
    for (const hb of hareubangs) {
      if (hb.hitT > 0) { hb.hitT = Math.max(0, hb.hitT - dt); shakeHareubang(hb); }
    }
  }

  // ---------- 떨어진 귤 (줍기) ----------
  const PICK_N = spots.pickupCount || 80;
  const PR = 0.2 * TG.scale; // 바닥 귤 반지름 (#63)
  const pickGeo = new THREE.SphereGeometry(PR, 8, 6);
  const pickMesh = new THREE.InstancedMesh(pickGeo, tanMat, PICK_N);
  pickMesh.castShadow = true; scene.add(pickMesh);
  // 잎(같이 돌며 도는 걸 보이게)과 아래 빛 원: 같은 개수의 인스턴스
  const pickLeaf = new THREE.InstancedMesh(leafGeo, leafMat, PICK_N); scene.add(pickLeaf);
  const pickGlow = new THREE.InstancedMesh(glowGeo, glowMat, PICK_N); pickGlow.renderOrder = 1; scene.add(pickGlow);
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), vp = new THREE.Vector3(), vs = new THREE.Vector3(1, 1, 1), yAx = new THREE.Vector3(0, 1, 0), xAx = new THREE.Vector3(1, 0, 0);
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const picks = [];
  const mm = new THREE.Matrix4();
  function placePick(i) {
    const [x, z] = spots.pickSpot(rnd);
    const pk = { x, z, y: height(x, z) + PR, t: 0, gone: false, ph: rnd() * 6.28 };
    picks[i] = pk;
    mm.makeTranslation(x, pk.y + TG.hover, z); pickMesh.setMatrixAt(i, mm); pickLeaf.setMatrixAt(i, mm);
    mm.makeTranslation(x, pk.y - PR + 0.03, z); pickGlow.setMatrixAt(i, mm);
    pickMesh.instanceMatrix.needsUpdate = true; pickLeaf.instanceMatrix.needsUpdate = true; pickGlow.instanceMatrix.needsUpdate = true;
  }
  for (let i = 0; i < PICK_N; i++) placePick(i);
  // 귤 빨려 오기 (#151): 범위 안에 든 귤은 GYUL_PICK.suckT 초 동안 캐릭터 가슴께로 날아와 들어가고, 닿으면 fn(자리)
  const sucks = [];
  function suck(m, fn) { sucks.push({ m, from: m.position.clone(), t: 0, fn }); }
  function tickSucks(dt) {
    for (let i = sucks.length - 1; i >= 0; i--) {
      const s = sucks[i]; s.t += dt; const k = Math.min(1, s.t / GYUL_PICK.suckT), e = k * k;
      s.m.position.set(s.from.x + (player.pos.x - s.from.x) * e, s.from.y + (player.pos.y + 1 - s.from.y) * e + Math.sin(k * Math.PI) * 0.6, s.from.z + (player.pos.z - s.from.z) * e);
      if (k >= 1) { group.remove(s.m); sucks.splice(i, 1); s.fn(s.m.position.clone()); }
    }
  }
  function updatePicks(dt, time) {
    let got = 0; tickSucks(dt);
    for (let i = 0; i < PICK_N; i++) {
      const pk = picks[i];
      if (pk.gone) { pk.t -= dt; if (pk.t <= 0) placePick(i); continue; }
      const dx = pk.x - player.pos.x, dz = pk.z - player.pos.z;
      if (dx * dx + dz * dz < (hooks.pickR2?.() || 1.8) && !player.riding) { pk.gone = true; pk.t = 90 + rnd() * 60; pickMesh.setMatrixAt(i, ZERO); pickLeaf.setMatrixAt(i, ZERO); pickGlow.setMatrixAt(i, ZERO); pickMesh.instanceMatrix.needsUpdate = pickLeaf.instanceMatrix.needsUpdate = pickGlow.instanceMatrix.needsUpdate = true; const m = new THREE.Mesh(tanGeo, tanMat); m.scale.setScalar(PR / TR); m.position.set(pk.x, pk.y + TG.hover, pk.z); group.add(m); suck(m, (at) => { hooks.pickupAt?.(at); hooks.pickup?.(1); }); continue; } // 빨려 옴 (#151)
      // 살짝 떠서 천천히 돎. 가까운 것(60m)만 매 프레임 갱신해 저사양에서도 가볍게
      const near = dx * dx + dz * dz < 3600;
      if (near || i % 6 === Math.floor(time * 6) % 6) {
        const y = pk.y + TG.hover + Math.sin(time * TG.bobSpeed + pk.ph) * TG.bob;
        vp.set(pk.x, y, pk.z); qa.setFromAxisAngle(yAx, time * TG.spin + pk.ph);
        mm.compose(vp, qa, vs); pickMesh.setMatrixAt(i, mm);
        qb.setFromAxisAngle(xAx, -1); qb.premultiply(qa); vp.y = y + PR + 0.01; mm.compose(vp, qb, vs); pickLeaf.setMatrixAt(i, mm);
        pickMesh.instanceMatrix.needsUpdate = pickLeaf.instanceMatrix.needsUpdate = true;
      }
    }
    if (got) hooks.pickup?.(got);
  }

  // ---------- 적 (#37, src/enemies.js) ----------
  const enemies = createEnemies({ group, spots, rnd, hooks, onToast, legs4 });
  // 귤로 맞힐 수 있는 다른 것 (#47 투기꾼·트럭): { hitTest(p, tg, dmg), aimTargets(out) }
  const extra = [];
  const extraHit = (p, tg, dmg) => { for (const t of extra) if (t.hitTest(p, tg, dmg)) return true; return false; };
  const addTargets = (t) => { extra.push(t); };
  // 무기 3~6단계 (#123, src/weaponfx.js): 한 점 맞힘(적·투기꾼·하르방)과 둘레 맞힘(폭탄). 맞힌 것(적은 그 적)을 돌려줌
  const hDummy = { vel: new THREE.Vector3() };
  function hitAt(p, dmg, vel = null, { quiet = false, hb = true, ch = 0 } = {}) {
    if (vel) hDummy.vel.copy(vel); else hDummy.vel.set(0, 0, 0); hDummy.ch = ch;
    const e = enemies.hitTest(p, hDummy, dmg, quiet); if (e) return e;
    for (const t of extra) if (t.hitTest(p, hDummy, dmg, quiet)) return true;
    if (hb) for (const h of hareubangs) if (Math.hypot(p.x - h.pos.x, p.z - h.pos.z) < 0.8 && p.y > h.pos.y + 0.3 && p.y < h.pos.y + 3.3) { h.hitT = 1; sound.stone(); onToast('하르방 코를 맞혔어요. 복이 온대요'); hooks.hareubang?.(); return true; }
    return null;
  }
  const areaOut = [];
  function hitArea(p, r, dmg, ch = 0) {
    const n = enemies.hitArea(p, r, dmg, ch).length; hDummy.ch = 0;
    let m = 0; for (const t of extra) { areaOut.length = 0; t.aimTargets(areaOut); for (const a of areaOut) if (Math.hypot(a.pos.x - p.x, a.pos.z - p.z) < r + a.size * 0.5) { hDummy.vel.set(0, 0, 0); if (t.hitTest(aTmp.set(a.pos.x, a.pos.y + a.h, a.pos.z), hDummy, dmg, n + m > 0)) m++; } }
    return n + m;
  }
  function nearestDeer(pos, maxD) { let best = null, bd = maxD; for (const d of deer) { if (d.state === 'flee' || d.state === 'ridden') continue; const dd = d.pos.distanceTo(pos); if (dd < bd) { bd = dd; best = d; } } return best; }
  function mount(d) { d.state = 'ridden'; d.speed = 0; d.t = 0; d.target = null; d.followUntil = 0; return d; }
  function dismount(d) { d.state = 'walk'; d.t = 2; d.heading += 1.2; }
  const followers = () => [...deer, ...horses].filter((a) => a.followUntil > performance.now() / 1000 && !a.followWho).length;
  const deerById = (id) => deer.find((d) => d.id === id) || null;
  // 다른 사람이 던진 귤을 먹으러 감 (#92, 멀티 방장): 그 자리에 보이지 않는 귤을 두고, 먹으면 그 사람(from)을 따라감
  function feedAt(d, x, z, from) {
    if (!d || d.target || d.state === 'ridden' || d.state === 'flee' || d.followUntil > performance.now() / 1000) return false;
    const mesh = { position: new THREE.Vector3(x, height(x, z), z), parent: group };
    d.target = { mesh, landed: true, eaten: false, claimedBy: d, feeder: from }; d.state = 'food'; return true;
  }
  // 내가 던져 다른 화면의 노루가 먹은 귤을 지움 (#92)
  function eatTangerine(tg) { if (tg.eaten) return; tg.eaten = true; group.remove(tg.mesh); }
  // 귤로 맞힐 대상 (#34 자동 조준). 새 적은 여기에 더한다. pos: 발 위치(살아 있는 Vector3), h: 겨눌 높이, size: 발밑 표시 크기, vel: 움직임
  const aimHbs = new Map();
  function aimTargets() {
    const out = [];
    enemies.aimTargets(out);
    for (const t of extra) t.aimTargets(out);
    for (const hb of hareubangs) { let a = aimHbs.get(hb); if (!a) { a = { kind: 'hareubang', pos: hb.pos, h: 1.9, size: 1.0, vel: null }; aimHbs.set(hb, a); } out.push(a); }
    return out;
  }
  // 다 핀 구역에 다시 나타나는 노루 (#46): (x, z) 둘레에 n 마리. 돌려받은 목록으로 removeDeer
  // ids: 멀티에서 가리킬 이름 (#92). 이미 있는 이름이면 새로 만들지 않고 그 노루를 씀 (방장이 바뀌었을 때)
  function addDeer(x, z, n, ids) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const id = ids?.[i] || 'd' + Math.random().toString(36).slice(2, 9), had = deerById(id);
      if (had) { out.push(had); continue; }
      const d = buildDeer(), home = new THREE.Vector3(x + (rnd() - 0.5) * 8, 0, z + (rnd() - 0.5) * 8); home.y = height(home.x, home.z);
      d.root.position.copy(home); const heart = makeHeart(); heart.position.y = 2.25; d.root.add(heart); group.add(d.root);
      const a = { ...d, id, kind: 'deer', heart, home, pos: home.clone(), heading: rnd() * 6.28, state: 'graze', t: rnd() * 4, speed: 0, phase: rnd() * 6, alert: 0, followUntil: 0, target: null, bloom: true };
      deer.push(a); out.push(a);
    }
    return out;
  }
  // 타고 있는 노루는 남김. 남은(못 지운) 목록을 돌려줌
  function removeDeer(list) { return list.filter((a) => { if (a.state === 'ridden') return true; const i = deer.indexOf(a); if (i >= 0) deer.splice(i, 1); group.remove(a.root); return false; }); }
  L = { remote: false, others: null, leader: null, deerById, feedAt, eatTangerine, bind, hooks, addTargets, nearestDeer, addDeer, removeDeer, aimTargets, mount, dismount, followers, update: (dt, time) => { update(dt, time); if (player) { enemies.update(dt, time); updatePicks(dt, time); } updateArrows(dt); updateJuice(dt); }, throwTangerine, shootArrow, juiceSplash, hitAt, hitArea, arrows, scatterTangerines, addHareubang, hareubangs, deer, horses, tangerines, enemies };
  return L;
}
