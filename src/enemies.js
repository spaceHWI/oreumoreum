// 적 (#37, 구역별 #48): 전투 오름에서만. 쓰러뜨리지 않고 귤을 맞혀 쫓아낸다
// 종류별 수치는 balance.js ENEMIES 표, 출현 규칙은 ENEMY_SPAWN (구역 → 종류 byZone). 새 종류는 표에 한 줄 + src/enemymodels.js 에 모양 하나
// 상태: wander(돌아다님) · root(땅 헤집기, 쓰레기 흘림) · charge(플레이어를 보고 돌진, ranged 는 거리를 두고 광선) · flee(놀라 도망) · leave(시간이 다 돼 스스로 떠남)
// 구역 번호는 hooks.zoneAt(x, z) 로 받음 (없으면 구역 없는 맵: ENEMY_SPAWN.kinds)
import * as THREE from 'three';
import { isBattle } from './server.js';
import { height } from './world.js';
import { buildEnemyModel, buildBolt } from './enemymodels.js';
import { BOAR, COLLIDE, ENEMIES, ENEMY_SPAWN } from './balance.js';

const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const iga = (w) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return w + (c >= 0 && c < 11172 && c % 28 ? '이' : '가'); };
const range = (rnd, [a, b]) => a + rnd() * (b - a);
const irange = (rnd, [a, b]) => a + Math.floor(rnd() * (b - a + 1));


// 머리 위 기운 막대 (스프라이트 둘, 왼쪽 기준으로 줄어듦)
const barBgMat = new THREE.SpriteMaterial({ color: '#1d1a17', transparent: true, opacity: 0.75, depthTest: false });
function makeBar() {
  const g = new THREE.Group();
  const bg = new THREE.Sprite(barBgMat); bg.center.set(0, 0.5); bg.scale.set(1.24, 0.2, 1); bg.position.x = -0.62; bg.renderOrder = 10;
  const fill = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#ff8a3c', depthTest: false })); fill.center.set(0, 0.5); fill.scale.set(1.12, 0.12, 1); fill.position.set(-0.56, 0, 0.001); fill.renderOrder = 11;
  g.add(bg, fill);
  return { g, fill };
}

export function createEnemies({ group, spots, rnd, hooks, onToast, legs4 }) {
  let player = null, sound = null;
  const list = [];
  let waveT = ENEMY_SPAWN.first;
  const okMap = spots.enemyOk || null; // 맵이 적을 허락하지 않으면 없음 (null)
  const okAt = okMap && ((x, z) => okMap(x, z) && !hooks.spawnBlock?.(x, z)); // 다 핀 구역(#46)에는 나오지 않음

  function spawnOne(kind, x, z) {
    const def = ENEMIES[kind], m = buildEnemyModel(kind);
    const pos = new THREE.Vector3(x, height(x, z), z);
    m.root.position.copy(pos); group.add(m.root);
    const bar = makeBar(); bar.g.position.set(0, m.h + 0.45, 0); m.root.add(bar.g);
    const e = { ...m, kind, def, pos, heading: rnd() * Math.PI * 2, speed: 0, phase: rnd() * 6, hp: def.hp, state: 'wander', st: 0, life: def.life, rootT: range(rnd, def.rootEvery), shotT: def.ranged ? def.ranged.every * 0.6 : 0, hitCd: 0, flash: 0, bar, chg: 0, pitch: 0, roll: 0 };
    list.push(e);
    return e;
  }
  // 플레이어가 있는 곳의 몹 종류 (#48). 구역 없는 맵이면 kinds 에서 하나, 들머리(0)면 없음
  function kindAt(x, z) {
    if (!hooks.zoneAt) return ENEMY_SPAWN.kinds[Math.floor(rnd() * ENEMY_SPAWN.kinds.length)];
    const zn = hooks.zoneAt(x, z); return { kind: ENEMY_SPAWN.byZone[zn] || null, zone: zn };
  }
  // 한 무리: 플레이어 둘레 r 안(같은 구역) 한 점을 정하고, 그 둘레에 2~3마리
  // 연출 감독(#89)은 planWave 로 자리를 먼저 정하고(조짐 동안 방향 표시) PACE 조짐 뒤 spawnPlan 으로 부름. group: 구역별 마릿수 {구역: [최소, 최대]}
  function planWave(force = false, forceKind = null, group = null) {
    if (!okAt || !player) return null;
    if (!force && (!isBattle() || !okAt(player.pos.x, player.pos.z))) return null;
    const room = ENEMY_SPAWN.max - list.length; if (room <= 0) return null;
    const k0 = kindAt(player.pos.x, player.pos.z), zone = typeof k0 === 'object' ? k0.zone : null;
    const kind = forceKind || (typeof k0 === 'object' ? k0.kind : k0);
    if (!kind || !ENEMIES[kind]) return null;
    const sameZone = (x, z) => okAt(x, z) && (zone == null || forceKind || hooks.zoneAt(x, z) === zone);
    const n = Math.min(room, irange(rnd, (group && group[zone]) || ENEMY_SPAWN.group));
    let c = null;
    for (const rr of [ENEMY_SPAWN.r, ENEMY_SPAWN.near]) for (let k = 0; k < 16 && !c; k++) { const a = rnd() * Math.PI * 2, r = range(rnd, rr), x = player.pos.x + Math.sin(a) * r, z = player.pos.z + Math.cos(a) * r; if (sameZone(x, z)) c = [x, z]; }
    if (!c) return null;
    return { kind, n, x: c[0], z: c[1], zone, forceKind: !!forceKind };
  }
  function spawnPlan(P, quiet = false) {
    if (!P || !player) return null;
    const sameZone = (x, z) => okAt(x, z) && (P.zone == null || P.forceKind || hooks.zoneAt(x, z) === P.zone);
    const n = Math.min(P.n, ENEMY_SPAWN.max - list.length);
    let made = 0;
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 8; k++) { const a = rnd() * Math.PI * 2, r = 2 + rnd() * 4, x = P.x + Math.sin(a) * r, z = P.z + Math.cos(a) * r; if (k < 6 ? sameZone(x, z) : okAt(x, z)) { const e = spawnOne(P.kind, x, z); e.heading = Math.atan2(player.pos.x - x, player.pos.z - z) + (rnd() - 0.5); made++; break; } }
    }
    if (!made) return null;
    const info = { kind: P.kind, n: made, x: P.x, z: P.z, zone: P.zone };
    sound?.boar?.(); if (!quiet) hooks.enemyWave?.(info);
    return info;
  }
  function spawnWave(force = false, forceKind = null) { return spawnPlan(planWave(force, forceKind)); }
  function remove(e) { const i = list.indexOf(e); if (i >= 0) list.splice(i, 1); group.remove(e.root); e.bar.fill.material.dispose(); }

  // 귤 맞음 (life.js 귤 날아가는 중에 부름). 맞혔으면 true
  function hitTest(p, tg, dmg) {
    for (const e of list) {
      if (e.state === 'flee' || e.state === 'leave') continue;
      if (Math.hypot(p.x - e.pos.x, p.z - e.pos.z) >= BOAR.hitR * e.def.size || p.y > e.pos.y + e.h + BOAR.hitPad) continue;
      e.hp = Math.max(0, e.hp - dmg); e.flash = 0.25; e.flinch = 0.28; hooks.hit?.(e.pos, e.hp <= 0); // 움찔 (#89)
      tg.vel.set(-tg.vel.x * 0.3, 2.5, -tg.vel.z * 0.3);
      if (e.hp <= 0) repel(e);
      else { sound?.beep?.(false); if (e.state !== 'charge') { e.state = 'charge'; e.st = 0; } } // 맞으면 바로 돌진
      return true;
    }
    return false;
  }
  function repel(e) {
    e.state = 'flee'; e.st = 0; e.bar.g.visible = false;
    sound?.boar?.(); onToast(`${iga(e.def.name)} 놀라 도망가요`);
    hooks.enemyRepel?.(e.kind, e.pos.clone(), e.def);
  }

  const turnTo = (o, h, k) => { o.heading += wrapA(h - o.heading) * k; };
  function tick(e, dt, time) {
    const d0 = e.def; e.st += dt; e.hitCd -= dt; e.life -= dt;
    const to = new THREE.Vector3(player.pos.x - e.pos.x, 0, player.pos.z - e.pos.z), d = to.length();
    if ((e.state === 'wander' || e.state === 'root' || e.state === 'charge') && (player.down || e.life <= 0)) { e.state = 'leave'; e.st = 0; e.bar.g.visible = false; } // 쓰러뜨렸거나 시간이 다 됨
    let want = 0;
    if (e.state === 'flee' || e.state === 'leave') {
      want = e.state === 'flee' ? d0.flee : d0.walk * 1.6;
      turnTo(e, Math.atan2(-to.x, -to.z) + Math.sin(time * 2 + e.phase) * 0.3, Math.min(1, dt * 3));
      if (d > ENEMY_SPAWN.goneD || e.st > 14) { remove(e); if (e.state === 'leave') hooks.enemyGone?.(e.kind); return; }
    } else if (e.state === 'charge' && d0.ranged) { // 멀리서 쏘는 적 (#48 외계인): 거리를 지키며 옆으로 돌고, 때마다 광선
      const R = d0.ranged, face = Math.atan2(to.x, to.z);
      if (d > R.keep + 3) { want = d0.chase; turnTo(e, face, Math.min(1, dt * 3)); }
      else if (d < R.keep - 3) { want = d0.walk; turnTo(e, face + Math.PI, Math.min(1, dt * 3)); }
      else { want = d0.walk * 0.6; turnTo(e, face + Math.PI / 2 * (e.phase % 2 < 1 ? 1 : -1), Math.min(1, dt * 2)); }
      e.shotT -= dt;
      if (e.shotT <= 0 && d < R.range && !player.down) { e.shotT = R.every * (0.85 + rnd() * 0.3); shoot(e); }
      if (d > d0.lose && e.st > 2) { e.state = 'wander'; e.st = 0; }
    } else if (e.state === 'charge') {
      want = d > 3 ? d0.chase : 2; turnTo(e, Math.atan2(to.x, to.z), Math.min(1, dt * 3));
      if (d > d0.lose && e.st > 2) { e.state = 'wander'; e.st = 0; }
    } else if (e.state === 'root') { // 머리를 숙여 땅을 헤집음. 중간에 쓰레기를 흘림
      want = 0;
      if (!e.dropped && e.st > d0.rootT * 0.5) { e.dropped = true; hooks.enemyRoot?.(e.kind, e.pos.clone(), irange(rnd, d0.rootTrash)); }
      if (e.st >= d0.rootT) { e.state = 'wander'; e.st = 0; e.rootT = range(rnd, d0.rootEvery); }
      if (d < d0.sight && !player.down) { e.state = 'charge'; e.st = 0; }
    } else { // wander
      want = d0.walk; if (rnd() < dt * 0.3) e.heading += (rnd() - 0.5) * 1.5;
      e.rootT -= dt; if (e.rootT <= 0) { e.state = 'root'; e.st = 0; e.dropped = false; }
      if (d < d0.sight && !player.down) { e.state = 'charge'; e.st = 0; }
    }
    e.speed += (want - e.speed) * Math.min(1, dt * 3);
    e.phase += dt * e.speed * 1.6;
    const nx = e.pos.x + Math.sin(e.heading) * e.speed * dt, nz = e.pos.z + Math.cos(e.heading) * e.speed * dt;
    if (spots.inBounds(nx, nz)) e.pos.set(nx, height(nx, nz), nz); else e.heading += 2.5;
    // 몸 충돌 (#32): 원 둘이 겹치지 않게 적을 뒤로 물림 (뛰어 넘으면 통과). 막혀 못 물러나면 플레이어를 밀어냄
    const minD = BOAR.bodyR * d0.size + COLLIDE.player;
    if (d < minD && player.jumpY < BOAR.jumpClear && !player.air && !player.down) {
      const ux = d > 1e-3 ? to.x / d : -Math.sin(e.heading), uz = d > 1e-3 ? to.z / d : -Math.cos(e.heading), push = minD - d;
      const bx = e.pos.x - ux * push, bz = e.pos.z - uz * push;
      if (spots.inBounds(bx, bz)) e.pos.set(bx, height(bx, bz), bz);
      else { const px = player.pos.x + ux * push, pz = player.pos.z + uz * push; const cl = spots.clamp?.(px, pz); player.pos.x = cl ? cl.x : px; player.pos.z = cl ? cl.z : pz; }
    }
    if (e.state === 'charge' && !d0.ranged && d < minD + BOAR.hitGap && e.hitCd <= 0 && player.jumpY < 0.6) { e.hitCd = BOAR.hitCd; hooks.enemyHit?.(to.clone().normalize(), e.def, e.kind); }
    // 그리기
    e.flinch = Math.max(0, (e.flinch || 0) - dt);
    e.root.position.copy(e.pos); if (e.flinch > 0) { const u = e.flinch / 0.28; e.root.position.y += Math.sin(u * Math.PI) * 0.22 * e.def.size; e.root.position.x -= Math.sin(e.heading) * 0.25 * u; e.root.position.z -= Math.cos(e.heading) * 0.25 * u; } e.root.rotation.order = 'YXZ'; e.root.rotation.y = e.heading;
    { // 비탈 기울기 (#29)
      const L = 0.9, W = 0.6, sh = Math.sin(e.heading), ch = Math.cos(e.heading), px = e.pos.x, pz = e.pos.z;
      const tp = Math.atan2(height(px - sh * L, pz - ch * L) - height(px + sh * L, pz + ch * L), 2 * L);
      const tr = Math.atan2(height(px + ch * W, pz - sh * W) - height(px - ch * W, pz + sh * W), 2 * W);
      const k = Math.min(1, dt * 6), lim = 0.6;
      e.pitch += (Math.max(-lim, Math.min(lim, tp)) - e.pitch) * k; e.roll += (Math.max(-lim, Math.min(lim, tr)) - e.roll) * k;
      e.root.rotation.x = e.pitch; e.root.rotation.z = e.roll;
    }
    legs4(e, e.speed > 0.3 ? 0.7 : 0);
    const charge = e.state === 'charge' && e.speed > 4 ? 1 : 0; e.chg += (charge - e.chg) * Math.min(1, dt * 4);
    const rooting = e.state === 'root' ? 0.75 + Math.sin(time * 14 + e.phase) * 0.12 : 0;
    e.head.rotation.x = 0.05 + e.chg * 0.25 + rooting + Math.sin(e.phase * 0.5) * 0.08;
    e.tail.rotation.x = Math.sin(time * 9 + e.phase) * 0.4;
    e.fx?.(dt, time, e);
    // 막대: 맞으면 잠깐 흰색
    if (e.bar.g.visible) {
      e.flash = Math.max(0, e.flash - dt);
      const f = e.hp / d0.hp; e.bar.fill.scale.x = 1.12 * Math.max(0.001, f);
      e.bar.fill.material.color.set(e.flash > 0 ? '#ffffff' : f <= 0.34 ? '#ff4a3a' : '#ff8a3c');
    }
  }

  // 광선 (#48): 쏜 순간 플레이어 쪽(살짝 앞)으로 곧게 날아감. 뛰면 피할 수 있음
  const bolts = [];
  const _m = new THREE.Vector3();
  function shoot(e) {
    const R = e.def.ranged;
    _m.copy(e.muzzle || new THREE.Vector3(0, e.h * 0.6, 0.4)).applyAxisAngle(new THREE.Vector3(0, 1, 0), e.heading).add(e.pos);
    const aim = new THREE.Vector3(player.pos.x, player.pos.y + 0.9, player.pos.z);
    const dir = aim.sub(_m).normalize();
    const g = buildBolt(); g.position.copy(_m); g.lookAt(_m.clone().add(dir)); group.add(g);
    bolts.push({ g, dir, v: R.speed, life: R.range / R.speed + 0.6, e, def: e.def, kind: e.kind });
    e.onShot?.(); // 모양마다 쏠 때 연출 (#71 외계인 발사구 빛)
    sound?.beep?.(false);
  }
  function updateBolts(dt) {
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i]; b.life -= dt; b.g.position.addScaledVector(b.dir, b.v * dt);
      const p = b.g.position, R = b.def.ranged.r;
      const hit = player && !player.down && Math.hypot(p.x - player.pos.x, p.z - player.pos.z) < R && p.y > player.pos.y + player.jumpY - 0.2 && p.y < player.pos.y + player.jumpY + 2.0;
      if (hit) hooks.enemyHit?.(new THREE.Vector3(b.dir.x, 0, b.dir.z).normalize(), b.def, b.kind);
      if (hit || b.life <= 0 || p.y < height(p.x, p.z) - 0.2) { group.remove(b.g); bolts.splice(i, 1); }
    }
  }

  function update(dt, time) {
    updateBolts(dt);
    if (!player || !okAt) return;
    if (isBattle()) {
      if (!hooks.paced) waveT -= dt; // 연출 감독(#89)이 있으면 감독이 부름
      if (waveT <= 0) { spawnWave(); waveT = ENEMY_SPAWN.every; } // 못 나오면(오름 밖·가득 참) 다음 차례까지 기다림
    } else if (list.length) { for (const e of list.slice()) remove(e); waveT = ENEMY_SPAWN.first; } // 깨끗한 오름에는 없음
    for (let i = list.length - 1; i >= 0; i--) { const e = list[i]; if (e) tick(e, dt, time); }
  }

  // 귤로 맞힐 대상 (#34 자동 조준)
  const aims = new Map();
  function aimTargets(out) {
    for (const e of list) {
      if (e.state === 'flee' || e.state === 'leave') continue;
      let a = aims.get(e); if (!a) { a = { kind: e.kind, pos: e.pos, h: e.h * 0.5, size: 1.5 * e.def.size, vel: new THREE.Vector3() }; aims.set(e, a); }
      a.vel.set(Math.sin(e.heading) * e.speed, 0, Math.cos(e.heading) * e.speed); out.push(a);
    }
    if (aims.size > list.length * 2 + 8) for (const k of aims.keys()) if (!list.includes(k)) aims.delete(k);
  }

  return {
    bind(p, s) { player = p; sound = s; },
    update, hitTest, aimTargets, list, bolts,
    active: () => list.some((e) => e.state !== 'flee' && e.state !== 'leave'),
    activeN: () => list.filter((e) => e.state !== 'flee' && e.state !== 'leave').length,
    planWave, spawnPlan,
    leaveAll() { for (const e of list) if (e.state !== 'flee' && e.state !== 'leave') { e.state = 'leave'; e.st = 0; e.bar.g.visible = false; } }, // 감독: 공격 시간이 다 됨
    near: (p, r) => list.some((e) => e.state !== 'flee' && e.state !== 'leave' && e.pos.distanceTo(p) < r),
    // 확인용
    test: {
      wave: (kind = null) => spawnWave(true, kind),
      kindHere: () => (player ? kindAt(player.pos.x, player.pos.z) : null),
      spawn: (kind = 'boar', dx = 8, dz = 8) => (player ? spawnOne(kind, player.pos.x + dx, player.pos.z + dz) : null),
      clear: () => { for (const e of list.slice()) remove(e); for (const b of bolts) group.remove(b.g); bolts.length = 0; },
      get timer() { return waveT; }, set timer(v) { waveT = v; },
      state: () => list.map((e) => ({ kind: e.kind, hp: e.hp, state: e.state, life: Math.round(e.life), x: Math.round(e.pos.x), z: Math.round(e.pos.z) })),
    },
  };
}
