// 적 (#37): 전투 오름에서만. 쓰러뜨리지 않고 귤을 맞혀 쫓아낸다
// 종류별 수치는 balance.js ENEMIES 표, 출현 규칙은 ENEMY_SPAWN. 새 종류는 표에 한 줄 + 아래 MODELS 에 모양 하나
// 상태: wander(돌아다님) · root(땅 헤집기, 쓰레기 흘림) · charge(플레이어를 보고 돌진) · flee(놀라 도망) · leave(시간이 다 돼 스스로 떠남)
import * as THREE from 'three';
import { isBattle } from './server.js';
import { height } from './world.js';
import { buildBoarModel, BOAR_MODEL_H } from './boar.js';
import { BOAR, COLLIDE, ENEMIES, ENEMY_SPAWN } from './balance.js';

const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const iga = (w) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return w + (c >= 0 && c < 11172 && c % 28 ? '이' : '가'); };
const range = (rnd, [a, b]) => a + rnd() * (b - a);
const irange = (rnd, [a, b]) => a + Math.floor(rnd() * (b - a + 1));

// 모양: { root, legs[4], head, tail }, 키(판정 높이)
const MODELS = {
  boar: () => ({ ...buildBoarModel(), h: BOAR_MODEL_H * BOAR.scale }),
};

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
    const def = ENEMIES[kind], m = MODELS[kind]();
    const pos = new THREE.Vector3(x, height(x, z), z);
    m.root.position.copy(pos); group.add(m.root);
    const bar = makeBar(); bar.g.position.set(0, m.h + 0.45, 0); m.root.add(bar.g);
    const e = { ...m, kind, def, pos, heading: rnd() * Math.PI * 2, speed: 0, phase: rnd() * 6, hp: def.hp, state: 'wander', st: 0, life: def.life, rootT: range(rnd, def.rootEvery), hitCd: 0, flash: 0, bar, chg: 0, pitch: 0, roll: 0 };
    list.push(e);
    return e;
  }
  // 한 무리: 플레이어 둘레 r 안 한 점을 정하고, 그 둘레에 2~3마리
  function spawnWave(force = false) {
    if (!okAt || !player) return null;
    if (!force && (!isBattle() || !okAt(player.pos.x, player.pos.z))) return null;
    const room = ENEMY_SPAWN.max - list.length; if (room <= 0) return null;
    const n = Math.min(room, irange(rnd, ENEMY_SPAWN.group));
    let c = null;
    for (let k = 0; k < 16 && !c; k++) { const a = rnd() * Math.PI * 2, r = range(rnd, ENEMY_SPAWN.r), x = player.pos.x + Math.sin(a) * r, z = player.pos.z + Math.cos(a) * r; if (okAt(x, z)) c = [x, z]; }
    if (!c) return null;
    const kind = ENEMY_SPAWN.kinds[Math.floor(rnd() * ENEMY_SPAWN.kinds.length)];
    let made = 0;
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 8; k++) { const a = rnd() * Math.PI * 2, r = 2 + rnd() * 4, x = c[0] + Math.sin(a) * r, z = c[1] + Math.cos(a) * r; if (okAt(x, z)) { const e = spawnOne(kind, x, z); e.heading = Math.atan2(player.pos.x - x, player.pos.z - z) + (rnd() - 0.5); made++; break; } }
    }
    if (!made) return null;
    const info = { kind, n: made, x: c[0], z: c[1] };
    sound?.boar?.(); hooks.enemyWave?.(info);
    return info;
  }
  function remove(e) { const i = list.indexOf(e); if (i >= 0) list.splice(i, 1); group.remove(e.root); e.bar.fill.material.dispose(); }

  // 귤 맞음 (life.js 귤 날아가는 중에 부름). 맞혔으면 true
  function hitTest(p, tg, dmg) {
    for (const e of list) {
      if (e.state === 'flee' || e.state === 'leave') continue;
      if (Math.hypot(p.x - e.pos.x, p.z - e.pos.z) >= BOAR.hitR * e.def.size || p.y > e.pos.y + e.h + BOAR.hitPad) continue;
      e.hp = Math.max(0, e.hp - dmg); e.flash = 0.25;
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
    if (e.state === 'charge' && d < minD + BOAR.hitGap && e.hitCd <= 0 && player.jumpY < 0.6) { e.hitCd = BOAR.hitCd; hooks.enemyHit?.(to.clone().normalize(), e.def, e.kind); }
    // 그리기
    e.root.position.copy(e.pos); e.root.rotation.order = 'YXZ'; e.root.rotation.y = e.heading;
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
    // 막대: 맞으면 잠깐 흰색
    if (e.bar.g.visible) {
      e.flash = Math.max(0, e.flash - dt);
      const f = e.hp / d0.hp; e.bar.fill.scale.x = 1.12 * Math.max(0.001, f);
      e.bar.fill.material.color.set(e.flash > 0 ? '#ffffff' : f <= 0.34 ? '#ff4a3a' : '#ff8a3c');
    }
  }

  function update(dt, time) {
    if (!player || !okAt) return;
    if (isBattle()) {
      waveT -= dt;
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
    update, hitTest, aimTargets, list,
    active: () => list.some((e) => e.state !== 'flee' && e.state !== 'leave'),
    near: (p, r) => list.some((e) => e.state !== 'flee' && e.state !== 'leave' && e.pos.distanceTo(p) < r),
    // 확인용
    test: {
      wave: () => spawnWave(true),
      spawn: (kind = 'boar', dx = 8, dz = 8) => (player ? spawnOne(kind, player.pos.x + dx, player.pos.z + dz) : null),
      clear: () => { for (const e of list.slice()) remove(e); },
      get timer() { return waveT; }, set timer(v) { waveT = v; },
      state: () => list.map((e) => ({ kind: e.kind, hp: e.hp, state: e.state, life: Math.round(e.life), x: Math.round(e.pos.x), z: Math.round(e.pos.z) })),
    },
  };
}
