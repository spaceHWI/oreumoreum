import * as THREE from 'three';
import { isBattle } from './server.js';
import { height, surfaceAt } from './world.js';
import { buildBoarModel, BOAR_MODEL_H } from './boar.js';
import { BOAR, SCATTER, COLLIDE } from './balance.js';

const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...o });
const box = (w, h, d, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = true; return m; };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---------- 노루 ----------
function buildDeer() {
  const g = new THREE.Group();
  const fur = lam('#b8865a'), dark = lam('#6b4a2e'), light = lam('#efe3d0');
  const body = box(0.5, 0.55, 1.1, fur); body.position.y = 0.95; g.add(body);
  const rump = box(0.45, 0.4, 0.35, light); rump.position.set(0, 0.95, -0.6); g.add(rump);
  const neck = box(0.22, 0.5, 0.25, fur); neck.position.set(0, 1.35, 0.5); neck.rotation.x = -0.5; g.add(neck);
  const head = new THREE.Group(); head.position.set(0, 1.62, 0.72); g.add(head);
  const skull = box(0.26, 0.3, 0.45, fur); head.add(skull);
  const nose = box(0.12, 0.1, 0.1, dark); nose.position.set(0, -0.06, 0.26); head.add(nose);
  [-0.16, 0.16].forEach((x) => { const ear = box(0.08, 0.26, 0.04, fur); ear.position.set(x, 0.24, -0.05); ear.rotation.z = -x * 2; head.add(ear); });
  [-0.09, 0.09].forEach((x) => { const eye = box(0.05, 0.06, 0.03, dark); eye.position.set(x, 0.04, 0.23); head.add(eye); });
  const legs = [];
  [[0.18, 0.4], [-0.18, 0.4], [0.18, -0.4], [-0.18, -0.4]].forEach(([x, z]) => {
    const l = new THREE.Group(); l.position.set(x, 0.75, z); g.add(l);
    const up = box(0.13, 0.45, 0.14, fur); up.position.y = -0.2; l.add(up);
    const lo = box(0.09, 0.4, 0.1, dark); lo.position.y = -0.6; l.add(lo);
    legs.push(l);
  });
  const tail = box(0.1, 0.2, 0.08, light); tail.position.set(0, 1.1, -0.78); g.add(tail);
  return { root: g, legs, head, body };
}

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

// ---------- 하르방 ----------
export function buildHareubang() {
  const g = new THREE.Group();
  const stone = lam('#5e5a55'), dark = lam('#4a4642');
  const base = box(1.2, 0.5, 1.0, dark); base.position.y = 0.25; g.add(base);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 1.6, 9), stone); body.position.y = 1.3; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.58, 10, 8), stone); head.position.y = 2.45; head.scale.y = 1.15; head.castShadow = true; g.add(head);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.35, 9), dark); hat.position.y = 2.98; hat.castShadow = true; g.add(hat);
  [-0.22, 0.22].forEach((x) => { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), dark); eye.position.set(x, 2.5, 0.48); g.add(eye); });
  const nose = box(0.2, 0.42, 0.22, stone); nose.position.set(0, 2.3, 0.56); g.add(nose);
  const mouth = box(0.42, 0.08, 0.1, dark); mouth.position.set(0, 2.08, 0.5); g.add(mouth);
  const hl = box(0.3, 0.26, 0.5, stone); hl.position.set(-0.45, 1.45, 0.4); hl.rotation.z = 0.3; g.add(hl);
  const hr = box(0.3, 0.26, 0.5, stone); hr.position.set(0.45, 1.05, 0.4); hr.rotation.z = -0.3; g.add(hr);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { root: g, head, hat };
}

// ---------- 생태계 ----------
// spots: maps.js의 맵별 배치(노루 무리, 말, 까마귀, 꽃, 귤 위치, 멧돼지 등장 위치, 경계)
export function createLife({ scene, onToast, rnd, hooks, spots }) {
  let player = null, sound = null;
  function bind(p, s) { player = p; sound = s; }
  const deer = [], horses = [], crows = [], flies = [];
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
      const heart = makeHeart(); heart.position.y = 2.3; d.root.add(heart);
      group.add(d.root);
      deer.push({ ...d, kind: 'deer', heart, home, pos: home.clone(), heading: rnd() * 6.28, state: 'graze', t: rnd() * 4, speed: 0, phase: rnd() * 6, alert: 0, followUntil: 0, target: null });
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
  const tanGeo = new THREE.SphereGeometry(0.16, 8, 6);
  const tanMat = new THREE.MeshLambertMaterial({ color: '#f29a2e' });
  const leafGeo = new THREE.PlaneGeometry(0.14, 0.08);
  const leafMat = new THREE.MeshLambertMaterial({ color: '#4f8a3a', side: THREE.DoubleSide });
  // vy: 위로 던지는 속도(없으면 power*0.55). 자동 조준(#34)이 대상까지 닿게 정해 넘김
  function throwTangerine(from, dir, power, peersFn, vy) {
    const m = new THREE.Mesh(tanGeo, tanMat); m.castShadow = true;
    const leaf = new THREE.Mesh(leafGeo, leafMat); leaf.position.y = 0.17; leaf.rotation.x = -1; m.add(leaf);
    m.position.copy(from); group.add(m);
    const v = dir.clone().multiplyScalar(power); v.y += vy ?? power * 0.55;
    tangerines.push({ mesh: m, vel: v, t: 0, landed: false, rest: 0, peersFn, hitDone: false, claimedBy: null });
  }
  // 받혀서 귤이 흩어짐 (#32): 중심 둘레 반경 SCATTER.rMin~rMax 안 무작위 자리로 포물선을 그리며 떨어지고, SCATTER.life 초 동안 다시 주울 수 있음
  function scatterTangerines(center, n) {
    const T = SCATTER.air;
    for (let i = 0; i < n; i++) {
      let x = center.x, z = center.z;
      for (let k = 0; k < 6; k++) {
        const a = rnd() * Math.PI * 2, r = SCATTER.rMin + rnd() * (SCATTER.rMax - SCATTER.rMin);
        const tx = center.x + Math.sin(a) * r, tz = center.z + Math.cos(a) * r;
        if (spots.inBounds(tx, tz)) { x = tx; z = tz; break; }
      }
      const m = new THREE.Mesh(tanGeo, tanMat); m.castShadow = true;
      const leaf = new THREE.Mesh(leafGeo, leafMat); leaf.position.y = 0.17; leaf.rotation.x = -1; m.add(leaf);
      const y0 = center.y + 1; m.position.set(center.x, y0, center.z); group.add(m);
      const gy = height(x, z) + 0.16, tt = T * (0.8 + rnd() * 0.4);
      const v = new THREE.Vector3((x - center.x) / tt, (gy - y0) / tt + 11 * tt, (z - center.z) / tt);
      tangerines.push({ mesh: m, vel: v, t: 0, landed: false, rest: 0, peersFn: null, hitDone: true, hbHit: true, claimedBy: null, drop: true });
    }
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
          a.followUntil = time + 60; a.state = 'follow'; a.heart.visible = true; a.heartT = 2.5;
          sound.crunch?.(); hooks.fed?.(a.kind);
          onToast(a.kind === 'deer' ? '노루가 귤을 먹고 졸졸 따라와요' : '조랑말이 귤을 먹고 따라와요');
        }
        return 0;
      }
      turnTo(a, Math.atan2(to.x, to.z), Math.min(1, dt * 6));
      return a.kind === 'deer' ? 3.2 : 2.6;
    }
    if (a.followUntil > time) {
      a.state = 'follow';
      const behind = player.pos.clone().add(new THREE.Vector3(Math.sin(player.heading + Math.PI + (a.kind === 'deer' ? 0.6 : -0.6)), 0, Math.cos(player.heading + Math.PI + (a.kind === 'deer' ? 0.6 : -0.6))).multiplyScalar(3.4));
      const to = behind.sub(a.pos).setY(0); const dist = to.length();
      if (dist > 60) { a.followUntil = 0; return 0; }
      if (dist < 0.8) { turnTo(a, player.heading, Math.min(1, dt * 3)); return 0; }
      turnTo(a, Math.atan2(to.x, to.z), Math.min(1, dt * 6));
      return Math.min(player.speed + dist * 0.8, a.kind === 'deer' ? 13 : 11);
    }
    if (a.state === 'follow') { a.state = 'graze'; a.t = 3; onToast(a.kind === 'deer' ? '노루가 제자리로 돌아가요' : '조랑말이 풀 뜯으러 가요'); }
    return null;
  }
  const legs4 = (a, amp) => { a.legs[0].rotation.x = Math.sin(a.phase) * amp; a.legs[3].rotation.x = Math.sin(a.phase) * amp; a.legs[1].rotation.x = -Math.sin(a.phase) * amp; a.legs[2].rotation.x = -Math.sin(a.phase) * amp; };
  const tickHeart = (a, dt) => { if (a.heartT > 0) { a.heartT -= dt; a.heart.position.y = (a.kind === 'deer' ? 2.3 : 2.8) + (2.5 - a.heartT) * 0.4; a.heart.material.opacity = Math.min(1, a.heartT); if (a.heartT <= 0) a.heart.visible = false; } };

  let nearDeerToast = 0;
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
        d.head.rotation.x = 0.1;
        continue;
      }
      seekFood(d, 30);
      let want = feedStep(d, dt, time);
      const friendly = d.target || d.followUntil > time;
      if (want === null) {
        const dp = player.pos.distanceTo(d.pos);
        const fast = player.running || player.speed > 6;
        const fleeD = fast ? 4.5 : 1.6; // 살금살금 걸으면 가까이 갈 수 있음
        if (dp < fleeD && d.state !== 'flee') { d.state = 'flee'; d.t = 2.5 + rnd(); const away = d.pos.clone().sub(player.pos).setY(0).normalize(); d.heading = Math.atan2(away.x, away.z); sound.deerHop?.(); }
        else if (dp < 10 && d.state === 'graze' && fast) { d.state = 'alert'; d.t = 1.5; const to = player.pos.clone().sub(d.pos).setY(0).normalize(); d.heading = Math.atan2(to.x, to.z); if (nearDeerToast < time) { nearDeerToast = time + 25; onToast('노루가 이쪽을 보고 있어요. 천천히 다가가거나 귤을 던져 보세요'); } }
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
      if (tg.landed) { tg.rest += dt; if (tg.rest > (tg.drop ? SCATTER.life : 45) || tg.eaten) { if (!tg.eaten) group.remove(tg.mesh); if (tg.claimedBy && tg.claimedBy.target === tg) tg.claimedBy.target = null; tangerines.splice(i, 1); } continue; }
      tg.vel.y -= 22 * dt; tg.t += dt;
      const p = tg.mesh.position;
      p.addScaledVector(tg.vel, dt);
      tg.mesh.rotation.x += dt * 8; tg.mesh.rotation.z += dt * 5;
      if (!tg.hitDone && tg.t > 0.15 && tg.peersFn) {
        for (const pe of tg.peersFn()) {
          if (Math.hypot(p.x - pe.pos.x, p.z - pe.pos.z) < 0.7 && p.y > pe.pos.y + 0.2 && p.y < pe.pos.y + 2.2) { tg.hitDone = true; hooks.hitRunner?.(pe.id); tg.vel.set(-tg.vel.x * 0.2, 2, -tg.vel.z * 0.2); sound.beep(false); break; }
        }
      }
      if (boar && !tg.drop && !boar.fleeing && Math.hypot(p.x - boar.pos.x, p.z - boar.pos.z) < BOAR.hitR && p.y < boar.pos.y + BOAR_MODEL_H * BOAR.scale + BOAR.hitPad) {
        boar.fleeing = true; boar.t = 12; sound.boar?.(); onToast('멧돼지가 놀라 도망가요'); hooks.boarRepel?.(); tg.vel.set(-tg.vel.x * 0.3, 2.5, -tg.vel.z * 0.3);
      }
      for (const hb of hareubangs) {
        const hd = Math.hypot(p.x - hb.pos.x, p.z - hb.pos.z);
        if (hd < 0.8 && p.y > hb.pos.y + 0.3 && p.y < hb.pos.y + 3.3 && !tg.hbHit) {
          tg.hbHit = true;
          tg.vel.set(-tg.vel.x * 0.3, Math.abs(tg.vel.y) * 0.3 + 2, -tg.vel.z * 0.3);
          hb.hitT = 1; sound.stone(); onToast('하르방 코를 맞혔어요. 복이 온대요'); hooks.hareubang?.();
        }
      }
      const gy = height(p.x, p.z) + 0.16;
      if (p.y <= gy) {
        p.y = gy;
        if (!tg.drop && Math.abs(tg.vel.y) > 2.5) { tg.vel.y = -tg.vel.y * 0.35; tg.vel.x *= 0.6; tg.vel.z *= 0.6; sound.step(surfaceAt(p.x, p.z), false); }
        else { tg.landed = true; tg.vel.set(0, 0, 0); }
      }
    }
    // 던진 귤 다시 줍기 (동물이 먹으러 오는 중이 아니면)
    for (let i = tangerines.length - 1; i >= 0; i--) {
      const tg = tangerines[i];
      if (!tg.landed || tg.eaten || tg.claimedBy || tg.rest < 0.6 || player.riding) continue;
      const p = tg.mesh.position;
      if ((p.x - player.pos.x) ** 2 + (p.z - player.pos.z) ** 2 < 1.6) { group.remove(tg.mesh); tangerines.splice(i, 1); hooks.reclaim?.(p.clone()); }
    }
    for (const hb of hareubangs) {
      if (hb.hitT > 0) { hb.hitT = Math.max(0, hb.hitT - dt); hb.head.rotation.z = Math.sin(hb.hitT * 20) * 0.12 * hb.hitT; hb.hat.position.y = 2.98 + Math.sin(hb.hitT * 14) * 0.15 * hb.hitT; }
    }
  }

  // ---------- 떨어진 귤 (줍기) ----------
  const PICK_N = spots.pickupCount || 80;
  const pickGeo = new THREE.SphereGeometry(0.2, 8, 6);
  const pickMesh = new THREE.InstancedMesh(pickGeo, new THREE.MeshLambertMaterial({ color: '#f29a2e', emissive: '#3a2000' }), PICK_N);
  pickMesh.castShadow = true; scene.add(pickMesh);
  const picks = [];
  const mm = new THREE.Matrix4();
  function placePick(i) {
    const [x, z] = spots.pickSpot(rnd);
    const pk = { x, z, y: height(x, z) + 0.2, t: 0, gone: false };
    picks[i] = pk;
    mm.makeTranslation(x, pk.y, z); pickMesh.setMatrixAt(i, mm);
    pickMesh.instanceMatrix.needsUpdate = true;
  }
  for (let i = 0; i < PICK_N; i++) placePick(i);
  function updatePicks(dt, time) {
    let got = 0;
    for (let i = 0; i < PICK_N; i++) {
      const pk = picks[i];
      if (pk.gone) { pk.t -= dt; if (pk.t <= 0) placePick(i); continue; }
      const dx = pk.x - player.pos.x, dz = pk.z - player.pos.z;
      if (dx * dx + dz * dz < 1.8) { pk.gone = true; pk.t = 90 + rnd() * 60; mm.makeScale(0, 0, 0); pickMesh.setMatrixAt(i, mm); pickMesh.instanceMatrix.needsUpdate = true; got++; hooks.pickupAt?.(new THREE.Vector3(pk.x, pk.y, pk.z)); continue; }
      if (i % 6 === Math.floor(time * 6) % 6) { mm.makeTranslation(pk.x, pk.y + Math.sin(time * 2 + i) * 0.08, pk.z); pickMesh.setMatrixAt(i, mm); pickMesh.instanceMatrix.needsUpdate = true; }
    }
    if (got) hooks.pickup?.(got);
  }

  // ---------- 멧돼지 ----------
  let boar = null, boarTimer = 90 + rnd() * 90;
  const buildBoar = buildBoarModel;
  function spawnBoar() {
    if (!spots.boarSpawn) { boarTimer = 1e9; return; }
    if (!isBattle()) { boarTimer = 30; return; } // 깨끗한 오름에는 멧돼지가 없음 (#35)
    const b = buildBoar();
    const [x, z] = spots.boarSpawn(rnd, player.pos);
    if (!spots.inBounds(x, z)) { boarTimer = 20; return; }
    const pos = new THREE.Vector3(x, height(x, z), z);
    b.root.position.copy(pos); group.add(b.root);
    boar = { ...b, pos, heading: 0, speed: 0, phase: 0, t: 45 + rnd() * 30, fleeing: false, hitCd: 0, warned: false };
  }
  function updateBoar(dt, time) {
    if (!boar) { boarTimer -= dt; if (boarTimer <= 0 && spots.inBounds(player.pos.x, player.pos.z)) spawnBoar(); return; }
    const b = boar; b.t -= dt; b.hitCd -= dt;
    const to = player.pos.clone().sub(b.pos).setY(0); const d = to.length();
    if (!b.warned && d < 40) { b.warned = true; hooks.boarAppear?.(); sound.boar?.(); }
    let want = 0;
    if (b.fleeing) { want = 9; b.heading = Math.atan2(-to.x, -to.z) + Math.sin(time * 2) * 0.3; }
    else if (d < 70) { want = d > 3 ? 7.2 : 2; turnTo(b, Math.atan2(to.x, to.z), Math.min(1, dt * 3)); }
    else { want = 3; if (Math.random() < dt * 0.3) b.heading += (rnd() - 0.5) * 1.5; }
    b.speed += (want - b.speed) * Math.min(1, dt * 3);
    b.phase += dt * b.speed * 1.6;
    const nx = b.pos.x + Math.sin(b.heading) * b.speed * dt, nz = b.pos.z + Math.cos(b.heading) * b.speed * dt;
    if (spots.inBounds(nx, nz)) b.pos.set(nx, height(nx, nz), nz); else b.heading += 2.5;
    b.root.position.copy(b.pos); b.root.rotation.order = 'YXZ'; b.root.rotation.y = b.heading;
    { // 비탈 기울기: 앞뒤·좌우 땅 높이 차로 몸 기울기를 구해 부드럽게 따라감
      const L = 0.9, W = 0.6, sh = Math.sin(b.heading), ch = Math.cos(b.heading), px = b.pos.x, pz = b.pos.z;
      const tp = Math.atan2(height(px - sh * L, pz - ch * L) - height(px + sh * L, pz + ch * L), 2 * L);
      const tr = Math.atan2(height(px + ch * W, pz - sh * W) - height(px - ch * W, pz + sh * W), 2 * W);
      const k = Math.min(1, dt * 6), lim = 0.6;
      b.pitch = (b.pitch || 0) + (Math.max(-lim, Math.min(lim, tp)) - (b.pitch || 0)) * k;
      b.roll = (b.roll || 0) + (Math.max(-lim, Math.min(lim, tr)) - (b.roll || 0)) * k;
      b.root.rotation.x = b.pitch; b.root.rotation.z = b.roll;
    }
    legs4(b, b.speed > 0.3 ? 0.7 : 0);
    const charge = !b.fleeing && b.speed > 4 ? 1 : 0; b.chg = (b.chg || 0) + (charge - (b.chg || 0)) * Math.min(1, dt * 4); b.head.rotation.x = 0.05 + b.chg * 0.25 + Math.sin(b.phase * 0.5) * 0.08; // 돌진할 때 머리를 숙임 b.tail.rotation.x = Math.sin(time * 9) * 0.4;
    { // 몸 충돌 (#32): 원 둘이 겹치지 않게 멧돼지를 뒤로 물림 (뛰어 넘으면 통과). 막혀 못 물러나면 플레이어를 밀어냄
      const minD = BOAR.bodyR + COLLIDE.player;
      if (d < minD && player.jumpY < BOAR.jumpClear && !player.air) {
        const ux = d > 1e-3 ? to.x / d : -Math.sin(b.heading), uz = d > 1e-3 ? to.z / d : -Math.cos(b.heading), push = minD - d;
        const bx = b.pos.x - ux * push, bz = b.pos.z - uz * push;
        if (spots.inBounds(bx, bz)) b.pos.set(bx, height(bx, bz), bz);
        else { const px = player.pos.x + ux * push, pz = player.pos.z + uz * push; const cl = spots.clamp?.(px, pz); player.pos.x = cl ? cl.x : px; player.pos.z = cl ? cl.z : pz; }
        b.root.position.copy(b.pos);
      }
    }
    if (!b.fleeing && d < BOAR.bodyR + COLLIDE.player + BOAR.hitGap && b.hitCd <= 0 && player.jumpY < 0.6) { b.hitCd = BOAR.hitCd; hooks.boarHit?.(to.normalize()); }
    if (b.t <= 0 || (b.fleeing && d > 90)) { group.remove(b.root); const wasNear = b.warned; boar = null; boarTimer = 120 + rnd() * 120; if (wasNear) hooks.boarGone?.(); }
  }
  function nearestDeer(pos, maxD) { let best = null, bd = maxD; for (const d of deer) { if (d.state === 'flee' || d.state === 'ridden') continue; const dd = d.pos.distanceTo(pos); if (dd < bd) { bd = dd; best = d; } } return best; }
  function mount(d) { d.state = 'ridden'; d.speed = 0; d.t = 0; d.target = null; d.followUntil = 0; return d; }
  function dismount(d) { d.state = 'walk'; d.t = 2; d.heading += 1.2; }
  const followers = () => [...deer, ...horses].filter((a) => a.followUntil > performance.now() / 1000).length;
  // 귤로 맞힐 대상 (#34 자동 조준). 새 적은 여기에 더한다. pos: 발 위치(살아 있는 Vector3), h: 겨눌 높이, size: 발밑 표시 크기, vel: 움직임
  const aimBoar = { kind: 'boar', pos: null, h: BOAR_MODEL_H * BOAR.scale * 0.5, size: 1.5, vel: new THREE.Vector3() };
  const aimHbs = new Map();
  function aimTargets() {
    const out = [];
    if (boar && !boar.fleeing) { aimBoar.pos = boar.pos; aimBoar.vel.set(Math.sin(boar.heading) * boar.speed, 0, Math.cos(boar.heading) * boar.speed); out.push(aimBoar); }
    for (const hb of hareubangs) { let a = aimHbs.get(hb); if (!a) { a = { kind: 'hareubang', pos: hb.pos, h: 1.9, size: 1.0, vel: null }; aimHbs.set(hb, a); } out.push(a); }
    return out;
  }
  return { bind, hooks, nearestDeer, aimTargets, mount, dismount, followers, update: (dt, time) => { update(dt, time); if (player) { updateBoar(dt, time); updatePicks(dt, time); } }, throwTangerine, scatterTangerines, addHareubang, hareubangs, deer, horses, tangerines, boarTest: { spawn: () => { if (boar) { group.remove(boar.root); boar = null; } boarTimer = 0; }, get: () => boar }, boarActive: () => !!boar && !boar.fleeing, boarNear: (p, d) => !!boar && boar.pos.distanceTo(p) < d };
}
