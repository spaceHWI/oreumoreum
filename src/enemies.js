// 적 (#37, 구역별 #48): 전투 오름에서만. 쓰러뜨리지 않고 귤을 맞혀 쫓아낸다
// 종류별 수치는 balance.js ENEMIES 표, 출현 규칙은 ENEMY_SPAWN (구역 → 종류 byZone). 새 종류는 표에 한 줄 + src/enemymodels.js 에 모양 하나
// 상태: wander(돌아다님) · root(땅 헤집기, 쓰레기 흘림) · charge(플레이어를 쫓음, ranged 는 거리를 두고 광선) · flee(놀라 도망) · leave(시간이 다 돼 스스로 떠남)
// #148 받기: charge 로 다가와 windD 안이면 wind(멈춰 몸을 낮추고 발밑 붉은 표시) → dash(곧게 돌진, 닿으면 받음) → back(한 걸음 물러남)
//   비껴가면 stagger(비틀거림, 이때 맞으면 급소). 한 번에 덤비는 적은 COMBAT.attackers, 나머지는 ringR 둘레를 돎. 맞으면 멈칫하며 뒤로 밀림(fl)
//   #149 back·stagger 가 끝나면 rest(ENEMIES.*.rest 초) 동안 쉬며 ringR 둘레를 돎 (덤비는 자리는 지킴)
// 구역 번호는 hooks.zoneAt(x, z) 로 받음 (없으면 구역 없는 맵: ENEMY_SPAWN.kinds)
// #146 무리: 같이 나온 적은 e.pack 이 같고, 적끼리 겹치지 않게 밀어내며 플레이어 둘레 자기 자리(e.slotA)로 벌려 에워쌈 → src/enemypack.js
import * as THREE from 'three';
import { height } from './world.js';
import { drape } from './drape.js';
import { buildEnemyModel, buildBolt } from './enemymodels.js';
import { BOAR, COLLIDE, ENEMIES, ENEMY_SPAWN, ENEMY_PACK, COMBAT, CHARGE, ZONE_BOSS } from './balance.js';
import { createPack, slotGoal, bodyR } from './enemypack.js';
import { reportCrash, crashNote } from './crash.js';

const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const iga = (w) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return w + (c >= 0 && c < 11172 && c % 28 ? '이' : '가'); };
const range = (rnd, [a, b]) => a + rnd() * (b - a);
const irange = (rnd, [a, b]) => a + Math.floor(rnd() * (b - a + 1));


// 정예 적이 쉬며 기운을 채움 (#183, 수치 ZONE_BOSS.rest): 싸움이 풀린 뒤 delay 초 동안은 그대로, 그 뒤 초당 최대 기운의 rate 씩
// 싸우는 동안은 부르지 않는다(부르는 쪽이 싸움이 붙을 때 e.calmT = 0). 맞으면 hurt 가 e.calmT = 0 으로 되돌림. dt 가 커도(건너뛰기) 쉬는 시간만큼은 빼고 셈
// 우두머리(game/boss.js)가 씀. 소굴·들판 떼 정예·대장·이야기 적·레이드 보스도 같은 함수로. 차오르는 중이면 true
export function restRegen(e, dt, max = e.def?.hp, o = ZONE_BOSS.rest) {
  e.calmT = (e.calmT || 0) + dt;
  const run = Math.min(dt, e.calmT - o.delay);
  if (!(max > 0) || run <= 0 || e.hp >= max) return false;
  e.hp = Math.min(max, e.hp + max * o.rate * run); return e.hp < max;
}

// 머리 위 기운 막대 (스프라이트 둘, 왼쪽 기준으로 줄어듦)
const barBgMat = new THREE.SpriteMaterial({ color: '#1d1a17', transparent: true, opacity: 0.75, depthTest: false });
function makeBar() {
  const g = new THREE.Group();
  const bg = new THREE.Sprite(barBgMat); bg.center.set(0, 0.5); bg.scale.set(1.24, 0.2, 1); bg.position.x = -0.62; bg.renderOrder = 10;
  const fill = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#ff8a3c', depthTest: false })); fill.center.set(0, 0.5); fill.scale.set(1.12, 0.12, 1); fill.position.set(-0.56, 0, 0.001); fill.renderOrder = 11;
  const inner = new THREE.Group(); inner.add(bg, fill); inner.visible = false; g.add(inner); // inner: 보일 때만 (#201). g 를 끄면 아주 안 보임(쫓겨남·떠남)
  return { g, fill, inner, t: 0 };
}

// 돌진 조짐 표시 (#148): 발밑 붉은 고리
const warnGeo = new THREE.RingGeometry(0.7, 1.05, 24).rotateX(-Math.PI / 2);
const warnMat = new THREE.MeshBasicMaterial({ color: '#ff3b2f', transparent: true, opacity: 0.8, depthWrite: false });
const BAR_SHOW = 3; // 맞힌 뒤 기운 막대가 보이는 초 (#201)
const ATK = new Set(['wind', 'dash', 'back']), AGGRO = new Set(['charge', 'wind', 'dash', 'back', 'stagger']);
const _to = new THREE.Vector3(); // tick 안에서 새로 만들지 않음 (#146)

export function createEnemies({ group, spots, rnd, hooks, onToast, legs4 }) {
  let player = null, sound = null;
  const list = [];
  let waveT = ENEMY_SPAWN.first;
  const okMap = spots.enemyOk || null; // 맵이 적을 허락하지 않으면 없음 (null)
  const okAt = okMap && ((x, z) => okMap(x, z) && !hooks.spawnBlock?.(x, z)); // 다 핀 구역(#46)에는 나오지 않음
  const pack = createPack({ list, spots, hooks });
  let packN = 0; // 무리 묶음 id (#146): spawnPlan 한 번 = 무리 하나. 확인용 test.spawn 은 -1 로 한 무리

  function spawnOne(kind, x, z, over = null, pk = null) {
    const def = over ? { ...ENEMIES[kind], ...over } : ENEMIES[kind], m = buildEnemyModel(kind);
    const pos = new THREE.Vector3(x, height(x, z), z);
    m.root.position.copy(pos); group.add(m.root);
    const bar = makeBar(); bar.g.position.set(0, m.h + 0.45, 0); m.root.add(bar.g);
    const e = { ...m, kind, def, pos, heading: rnd() * Math.PI * 2, speed: 0, phase: rnd() * 6, seed: rnd() * 6.283, pack: pk, hp: def.hp, state: 'wander', st: 0, life: def.life, rootT: range(rnd, def.rootEvery), shotT: def.ranged ? def.ranged.every * 0.6 : 0, hitCd: 0, flash: 0, bar, chg: 0, pitch: 0, roll: 0 };
    list.push(e);
    return e;
  }
  // 구역 우두머리 (#139, game/boss.js): 바탕 적 모양을 o.k 배로 키움. 기운 막대는 머리 위 대신 화면 위(boss.js). 시간이 다 돼 떠나지 않음
  // o.ctl(e, dt, time, d, to) → 원하는 빠르기 (돌진·다가감·멈춤, 방향은 ctl 이 정함). e.puppet 이면 자리도 ctl 이 정함(멀티 받는 쪽)
  // o.remoteHurt(dmg): 맞힌 피해를 방장에게 보냄(받는 쪽, 기운은 방장 값). 쫓아내면 hooks.bossRepel(e)
  function spawnBoss(kind, x, z, o) {
    const base = ENEMIES[kind];
    const e = spawnOne(kind, x, z, { name: o.name, hp: o.hp, dmg: o.dmg, size: base.size * o.k, reward: { gyul: o.gyul, rare: 0 }, life: Infinity, ranged: null, rootEvery: [1e9, 1e9] });
    e.root.scale.setScalar(o.k); e.h *= o.k; e.bar.g.visible = false;
    e.state = 'boss'; e.boss = o; e.ctl = o.ctl; e.remoteHurt = o.remoteHurt || null; e.puppet = !!o.puppet;
    return e;
  }
  // 이야기 이벤트 (#168, game/story.js): 보통 적처럼 굴지만 모양을 o.k 배로 키우고 이름·기운·피해·보상을 바꿈. ENEMY_SPAWN.max 를 넘어도 부름
  // o.calm: 싸우지 않고 모여 있음(멧돼지 가족회의). 플레이어가 o.calmR 안에 오거나 맞히면 흩어짐(hooks.calmScatter)
  function spawnStory(kind, x, z, o = {}) {
    const base = ENEMIES[kind], k = o.k || 1;
    const e = spawnOne(kind, x, z, { ...(o.over || {}), size: base.size * k }, o.pack ?? -2);
    if (k !== 1) { e.root.scale.setScalar(k); e.h *= k; }
    e.story = o.id || 'story';
    if (o.calm) { e.state = 'calm'; e.calmR = o.calmR || 7; e.life = Infinity; e.bar.g.visible = false; }
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
    if (!force && !okAt(player.pos.x, player.pos.z)) return null;
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
    const n = Math.min(P.n, ENEMY_SPAWN.max - list.length), pk = ++packN;
    const r0 = BOAR.bodyR * ENEMIES[P.kind].size, free = (x, z) => list.every((o) => o.state === 'flee' || o.state === 'leave' || Math.hypot(o.pos.x - x, o.pos.z - z) >= r0 + bodyR(o) + ENEMY_PACK.spawnGap); // 처음 자리도 겹치지 않게 (#146)
    let made = 0;
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 16; k++) { const a = rnd() * Math.PI * 2, r = 2 + rnd() * (4 + k * 0.3), x = P.x + Math.sin(a) * r, z = P.z + Math.cos(a) * r; if ((k < 12 ? sameZone(x, z) : okAt(x, z)) && (k < 14 ? free(x, z) : true)) { const e = spawnOne(P.kind, x, z, null, pk); e.heading = Math.atan2(player.pos.x - x, player.pos.z - z) + (rnd() - 0.5); made++; break; } }
    }
    if (!made) return null;
    const info = { kind: P.kind, n: made, x: P.x, z: P.z, zone: P.zone, pack: pk };
    crashNote(`적 등장 ${P.kind}×${made}`);
    sound?.boar?.(); if (!quiet) hooks.enemyWave?.(info);
    return info;
  }
  // 들판 떼 (#173, game/swarm.js): 한 마리를 바로 쫓게. over 는 표 값을 덮음(swarm·기운·크기…), k 는 모양 크기 배(대장). ENEMY_SPAWN.max 와 따로 셈
  function spawnSwarm(kind, x, z, over, pk = null, k = 1) {
    const e = spawnOne(kind, x, z, over, pk);
    if (k !== 1) { e.root.scale.setScalar(k); e.h *= k; }
    e.state = 'charge'; e.st = 0; e.heading = player ? Math.atan2(player.pos.x - x, player.pos.z - z) : e.heading;
    return e;
  }
  function spawnWave(force = false, forceKind = null) { return spawnPlan(planWave(force, forceKind)); }
  function remove(e) { const i = list.indexOf(e); if (i >= 0) list.splice(i, 1); group.remove(e.root); if (e.warn) { group.remove(e.warn); e.warn.geometry.dispose(); } e.bar.fill.material.dispose(); e.root.traverse((o) => { if (o.isSkinnedMesh) o.skeleton?.dispose(); }); } // 뼈 텍스처도 GPU 에서 내림 (#108: 무리가 거듭 와도 쌓이지 않게)

  // 귤 맞음 (life.js 귤 날아가는 중에 부름). 맞혔으면 true
  // quiet (#123 머신건·레이저처럼 잦은 맞힘): 맞힌 소리·멈칫(hooks.hit)은 쫓아낼 때만
  // ch: 모아 쏜 정도 0~1 (#129) → 더 멀리 밀림, hooks.chargeHit 이 터지는 효과
  function hurt(e, dmg, quiet, ch = 0) {
    if (e.state === 'calm') { scatter(e); return; } // #168 모여 있던 적은 맞으면 흩어짐
    if (ch > 0) hooks.chargeHit?.(e.pos, ch, e);
    if (e.remoteHurt) { e.flash = 0.25; e.bar.t = BAR_SHOW; e.flinch = 0.28; hooks.dmgNum?.(e, dmg, false, ch); if (!quiet) { hooks.hit?.(e.pos, false); sound?.beep?.(false); } e.remoteHurt(dmg); return; } // 멀티 받는 쪽 우두머리 (#139): 기운은 방장이 셈
    e.calmT = 0; // 쉬며 차던 기운이 멈춤 (#183)
    const stag = e.state === 'stagger'; if (stag) dmg *= COMBAT.crit; // 비틀거릴 때 급소 (#148)
    hooks.dmgNum?.(e, dmg, stag, ch); // 머리 위 피해 숫자 (#141, game/feel.js)
    e.hp = Math.max(0, e.hp - dmg); e.flash = 0.25; e.bar.t = BAR_SHOW; e.flinch = 0.28; if (!quiet || e.hp <= 0) hooks.hit?.(e.pos, e.hp <= 0); // 움찔 (#89)
    if (!e.boss && player) { // 멈칫하며 뒤로 밀림 (#148): 큰 적일수록 덜, 잦은 맞힘(머신건·레이저)은 조금씩
      const ux = e.pos.x - player.pos.x, uz = e.pos.z - player.pos.z, L = Math.hypot(ux, uz) || 1;
      e.fl = COMBAT.flinchT; e.flV = COMBAT.flinchDist / e.def.size / COMBAT.flinchT * (quiet ? 0.3 : 1) * (1 + (CHARGE.push - 1) * ch); e.flX = ux / L; e.flZ = uz / L;
      if (e.state === 'wind' || e.state === 'dash') { e.state = 'charge'; e.st = 0; }
    }
    hooks.afterHurt?.(e, dmg, quiet); // #140 전설 무기: 가까운 다른 적에게 갈라짐 · #159 증강 (터지는 귤·신 귤, game/level.js)
    if (e.hp <= 0) { if (live(e)) repel(e); }
    else { if (!quiet) sound?.beep?.(false); if (!AGGRO.has(e.state) && !e.boss) { e.state = 'charge'; e.st = 0; } } // 맞으면 바로 쫓음 (우두머리는 제 패턴대로)
  }
  const live = (e) => e.state !== 'flee' && e.state !== 'leave';
  function hitTest(p, tg, dmg, quiet = false) {
    for (const e of list) {
      if (!live(e)) continue;
      if (Math.hypot(p.x - e.pos.x, p.z - e.pos.z) >= BOAR.hitR * e.def.size || p.y > e.pos.y + e.h + BOAR.hitPad) continue;
      tg.vel.set(-tg.vel.x * 0.3, 2.5, -tg.vel.z * 0.3);
      hurt(e, dmg, quiet, tg.ch || 0);
      return e;
    }
    return null;
  }
  // 둘레 r 안 모두 (#123 귤 폭탄). 맞은 적 목록
  function hitArea(p, r, dmg, ch = 0) {
    const out = [];
    for (const e of list.slice()) { if (!live(e) || Math.hypot(p.x - e.pos.x, p.z - e.pos.z) > r + BOAR.hitR * e.def.size * 0.5) continue; hurt(e, dmg, out.length > 0, ch); out.push(e); }
    return out;
  }
  function repel(e) {
    if (e.boss) { e.state = 'flee'; e.st = 0; e.ctl = null; sound?.boar?.(); hooks.bossRepel?.(e); return; } // #139 우두머리: 느린 화면·큰 전리품은 boss.js
    e.state = 'flee'; e.st = 0; e.bar.g.visible = false;
    sound?.boar?.(); if (!e.def.swarm) onToast(`${iga(e.def.name)} 놀라 도망가요`); // 들판 떼(#173)는 너무 잦아 글 없이
    hooks.enemyRepel?.(e.kind, e.pos.clone(), e.def, e);
  }

  function scatter(e) { e.state = 'flee'; e.st = 0; e.bar.g.visible = false; sound?.boar?.(); hooks.calmScatter?.(e); }
  const turnTo = (o, h, k) => { o.heading += wrapA(h - o.heading) * k; };
  let blocked = false, stuckT = 0, held = false;
  const atkN = () => { let n = 0; for (const e of list) if (ATK.has(e.state) || (e.rest > 0 && e.state === 'charge')) n++; return n; }; // 쉬는 적도 자리를 지킴 (#149: 기다리던 적이 바로 끼어들지 않게)
  // 기운이 낮을 때 (#148, hooks 가 부름): 한 싸움에 한 번, 덤비던 적이 모두 잠깐 머뭇거림. 했으면 true
  function hesitate() { if (held) return false; let n = 0; for (const e of list) if (!e.boss && AGGRO.has(e.state)) { e.hold = COMBAT.holdT; n++; } if (n) held = true; return n > 0; }
  function tick(e, dt, time) {
    const d0 = e.def; e.st += dt; e.hitCd -= dt; e.life -= dt; if (e.rest > 0) e.rest -= dt;
    const to = _to.set(player.pos.x - e.pos.x, 0, player.pos.z - e.pos.z), d = to.length();
    if ((e.state === 'wander' || e.state === 'root' || AGGRO.has(e.state)) && (player.down || e.life <= 0)) { e.state = 'leave'; e.st = 0; e.bar.g.visible = false; } // 쓰러뜨렸거나 시간이 다 됨
    let want = 0;
    if (e.state === 'boss' && e.ctl) { // 구역 우두머리 (#139): 패턴은 boss.js
      want = e.ctl(e, dt, time, d, to);
    } else if (e.state === 'flee' || e.state === 'leave') {
      want = e.state === 'flee' ? d0.flee : d0.walk * 1.6;
      turnTo(e, Math.atan2(-to.x, -to.z) + Math.sin(time * 2 + e.phase) * 0.3, Math.min(1, dt * 3));
      if (d > ENEMY_SPAWN.goneD || e.st > 14) { remove(e); if (e.state === 'leave') hooks.enemyGone?.(e.kind); return; }
    } else if (e.state === 'charge' && d0.ranged) { // 멀리서 쏘는 적 (#48 외계인): 거리를 지키며 옆으로 돌고, 때마다 광선
      const R = d0.ranged, face = Math.atan2(to.x, to.z), ta = e.slotA; // #146 무리 안에서 방향을 나눠 같은 쪽으로 몰리지 않게
      if (d > R.keep + 3) { want = d0.chase; turnTo(e, ta != null ? slotGoal(e, player, R.keep, ta)[0] : face, Math.min(1, dt * 3)); }
      else if (d < R.keep - 3) { want = d0.walk; turnTo(e, face + Math.PI, Math.min(1, dt * 3)); }
      else if (ta != null) { const g = slotGoal(e, player, R.keep, ta); if (g[1] > 1.5) { want = d0.walk; turnTo(e, g[0], Math.min(1, dt * 3)); } else { want = d0.walk * ENEMY_PACK.orbit; turnTo(e, face - Math.PI / 2, Math.min(1, dt * 2)); } } // 제 자리로 옮겨 가고, 자리에선 무리가 함께 한쪽으로 천천히 돎
      else { want = d0.walk * 0.6; turnTo(e, face + Math.PI / 2 * (e.phase % 2 < 1 ? 1 : -1), Math.min(1, dt * 2)); }
      if (!(e.fl > 0)) e.shotT -= dt; // 맞아 멈칫하는 동안은 못 쏨 (#148)
      if (e.shotT <= 0 && d < R.range && !player.down) { e.shotT = R.every * (0.85 + rnd() * 0.3); shoot(e); }
      if (d > d0.lose && e.st > 2) { e.state = 'wander'; e.st = 0; }
    } else if (e.hold > 0 && AGGRO.has(e.state)) { // 기운이 낮을 때 머뭇거림 (#148)
      e.hold -= dt; want = d < COMBAT.ringR ? d0.walk : 0; turnTo(e, Math.atan2(-to.x, -to.z), Math.min(1, dt * 3)); if (e.state !== 'charge') { e.state = 'charge'; e.st = 0; }
    } else if (e.state === 'charge') { // 쫓음 (#148): 자리가 있으면 windD 안에서 조짐, 없으면 ringR 둘레를 돎
      const face = Math.atan2(to.x, to.z), resting = e.rest > 0, slot = !resting && (e.slotA == null || e.close) && atkN() < COMBAT.attackers; // 공격 뒤 쉬는 동안은 둘레를 돎 (#149). 무리에선 붙는 적(e.close)만 덤빔 (#146)
      if (slot && d < COMBAT.windD && e.hitCd <= 0 && !player.down) { e.state = 'wind'; e.st = 0; want = 0; }
      else if (e.slotA != null) { // #146 무리: 플레이어 둘레 제 자리로 돌아 다가감. 붙는 적은 windD 안, 나머지는 한 걸음 뒤에서 맴돎
        const Rg = slot ? ENEMY_PACK.closeR : e.close && !resting ? COMBAT.ringR : COMBAT.ringR + ENEMY_PACK.backR;
        const g = slotGoal(e, player, Rg, e.slotA + (Rg > COMBAT.ringR ? Math.sin(time * ENEMY_PACK.driftW + e.seed) * ENEMY_PACK.drift : 0));
        if (e.detour > 0) { e.detour -= dt; want = d0.walk; turnTo(e, g[0] + e.detourS * 1.1, Math.min(1, dt * 4)); } // 막혔으면 옆으로 돌아감
        else if (g[1] > 0.9) { want = resting || g[1] < 3 ? d0.walk : d0.chase; turnTo(e, g[0], Math.min(1, dt * 3)); }
        else { want = 0; turnTo(e, face, Math.min(1, dt * 3)); }
      }
      else if (!slot && d < COMBAT.ringR + 2) { const off = Math.max(-1, Math.min(1, (COMBAT.ringR - d) / 3)), side = e.phase % 2 < 1 ? 1 : -1; want = d0.walk; turnTo(e, face + side * Math.PI / 2 * (1 + off), Math.min(1, dt * 3)); }
      else { want = resting ? d0.walk : d > 3 ? d0.chase : e.hitCd > 0 ? 0 : 2; turnTo(e, face, Math.min(1, dt * 3)); }
      if (d > d0.lose && e.st > 2) { e.state = 'wander'; e.st = 0; }
    } else if (e.state === 'wind') { // 멈춰 몸을 낮춤
      want = 0; e.speed *= Math.max(0, 1 - dt * 12); turnTo(e, Math.atan2(to.x, to.z), Math.min(1, dt * 8));
      if (e.st >= COMBAT.windT) { e.state = 'dash'; e.st = 0; e.speed = Math.max(COMBAT.dashMin, (d0.rush ?? d0.chase) * COMBAT.dashK); }
    } else if (e.state === 'dash') { // 곧게 돌진: 방향은 그대로
      want = Math.max(COMBAT.dashMin, (d0.rush ?? d0.chase) * COMBAT.dashK); e.speed = want; // 돌진은 예전 빠르기 (#149)
      const ahead = to.x * Math.sin(e.heading) + to.z * Math.cos(e.heading);
      if (e.st > COMBAT.dashT || ahead < -1.2) { e.state = 'stagger'; e.st = 0; e.speed = 0; want = 0; }
    } else if (e.state === 'stagger') { // 비껴가 비틀거림
      want = 0; e.speed = 0; if (e.st >= COMBAT.staggerT) { e.state = 'charge'; e.st = 0; e.rest = d0.rest || 0; }
    } else if (e.state === 'back') { // 받은 뒤 한 걸음 물러남
      want = d0.walk * 1.6; turnTo(e, Math.atan2(-to.x, -to.z), Math.min(1, dt * 6));
      if (e.st >= COMBAT.backT) { e.state = 'charge'; e.st = 0; e.rest = d0.rest || 0; } // 받기·비껴감 뒤 쉼 (#149)
    } else if (e.state === 'root') { // 머리를 숙여 땅을 헤집음. 중간에 쓰레기를 흘림
      want = 0;
      if (!e.dropped && e.st > d0.rootT * 0.5) { e.dropped = true; hooks.enemyRoot?.(e.kind, e.pos.clone(), irange(rnd, d0.rootTrash)); }
      if (e.st >= d0.rootT) { e.state = 'wander'; e.st = 0; e.rootT = range(rnd, d0.rootEvery); }
      if (d < d0.sight && !player.down) { e.state = 'charge'; e.st = 0; }
    } else if (e.state === 'calm') { // #168 모여 있음: 제자리에서 두리번, 가까이 오면 흩어짐
      want = 0; turnTo(e, e.heading + Math.sin(time * 0.7 + e.seed) * 0.6, Math.min(1, dt));
      if (d < e.calmR) scatter(e);
    } else { // wander
      want = d0.walk; if (rnd() < dt * 0.3) e.heading += (rnd() - 0.5) * 1.5;
      e.rootT -= dt; if (e.rootT <= 0) { e.state = 'root'; e.st = 0; e.dropped = false; }
      if (d < d0.sight && !player.down) { e.state = 'charge'; e.st = 0; }
    }
    if (e.state === 'charge' || e.state === 'wander') { // #146 저마다 빠르기를 조금씩 다르게, 앞에 붙은 적이 있으면 뒤에서 기다림
      want *= 1 + ENEMY_PACK.vary * Math.sin(e.phase * 0.23 + e.seed);
      if (e.yieldT > 0) want = Math.min(want, d0.walk * 0.5);
    }
    if (e.fl > 0) { e.fl -= dt; want = 0; e.speed = 0; const nx = e.pos.x + e.flX * e.flV * dt, nz = e.pos.z + e.flZ * e.flV * dt; if (spots.inBounds(nx, nz)) e.pos.set(nx, height(nx, nz), nz); } // 맞아 멈칫 (#148)
    if (e.slowT > 0) { e.slowT -= dt; want *= 1 - (e.slowK || 0); } // 눈덩이에 맞아 느려짐 (#180)
    if (e.sour > 0) { e.sour -= dt; want *= e.sourK ?? 1; if (e.speed > want) e.speed = want; } // 신 귤 (#159): 맞은 뒤 잠깐 느려짐
    if (e.snap) e.speed = want; else e.speed += (want - e.speed) * Math.min(1, dt * 3); // 우두머리 돌진은 바로 (snap)
    e.phase += dt * e.speed * 1.6;
    if (!e.puppet || e.state !== 'boss') {
      const nx = e.pos.x + Math.sin(e.heading) * e.speed * dt, nz = e.pos.z + Math.cos(e.heading) * e.speed * dt;
      if (spots.inBounds(nx, nz)) e.pos.set(nx, height(nx, nz), nz); else e.heading += 2.5;
    }
    // 몸 충돌 (#32): 원 둘이 겹치지 않게 적을 뒤로 물림 (뛰어 넘으면 통과)
    // #148 플레이어는 밀리지 않음: 적이 물러날 자리가 없으면 멈추고 옆으로 돎. 플레이어가 그쪽으로 걸으면 막히지만, stuckT 넘게 막히면 지나감
    const minD = BOAR.bodyR * d0.size + COLLIDE.player;
    if (d < minD && player.jumpY < BOAR.jumpClear && !player.air && !player.down) {
      const ux = d > 1e-3 ? to.x / d : -Math.sin(e.heading), uz = d > 1e-3 ? to.z / d : -Math.cos(e.heading), push = minD - d;
      const bx = e.pos.x - ux * push, bz = e.pos.z - uz * push;
      if (spots.inBounds(bx, bz)) e.pos.set(bx, height(bx, bz), bz);
      else {
        e.speed = 0; e.heading += dt * 3 * (e.phase % 2 < 1 ? 1 : -1); blocked = true;
        if (player.driving && stuckT < COMBAT.stuckT) { const px = player.pos.x + ux * push, pz = player.pos.z + uz * push; const cl = spots.clamp?.(px, pz); player.pos.x = cl ? cl.x : px; player.pos.z = cl ? cl.z : pz; }
      }
    }
    if (e.state === 'dash' && d < minD + BOAR.hitGap && e.hitCd <= 0 && player.jumpY < 0.6) { // 돌진이 닿으면 받음 → 한 걸음 물러남 (#148)
      e.hitCd = BOAR.hitCd; hooks.enemyHit?.(to.clone().normalize(), e.def, e.kind); e.state = 'back'; e.st = 0; e.speed = d0.walk;
    }
    // 그리기
    e.flinch = Math.max(0, (e.flinch || 0) - dt);
    e.root.position.copy(e.pos); if (e.state === 'wind') e.root.position.y -= 0.18 * e.def.size * Math.min(1, e.st / 0.15); if (e.flinch > 0) { const u = e.flinch / 0.28; e.root.position.y += Math.sin(u * Math.PI) * 0.22 * e.def.size; e.root.position.x -= Math.sin(e.heading) * 0.25 * u; e.root.position.z -= Math.cos(e.heading) * 0.25 * u; } e.root.rotation.order = 'YXZ'; e.root.rotation.y = e.heading;
    { // 비탈 기울기 (#29)
      const L = 0.9, W = 0.6, sh = Math.sin(e.heading), ch = Math.cos(e.heading), px = e.pos.x, pz = e.pos.z;
      const tp = Math.atan2(height(px - sh * L, pz - ch * L) - height(px + sh * L, pz + ch * L), 2 * L);
      const tr = Math.atan2(height(px + ch * W, pz - sh * W) - height(px - ch * W, pz + sh * W), 2 * W);
      const k = Math.min(1, dt * 6), lim = 0.6;
      e.pitch += (Math.max(-lim, Math.min(lim, tp)) - e.pitch) * k; e.roll += (Math.max(-lim, Math.min(lim, tr)) - e.roll) * k;
      e.root.rotation.x = e.pitch; e.root.rotation.z = e.roll + (e.state === 'stagger' ? Math.sin(e.st * 14) * 0.18 * (1 - e.st / COMBAT.staggerT) : 0);
      if (e.rollT > 0 && e.state === 'flee') { const u = 1 - e.rollT / e.rollD, w = u * u * (3 - 2 * u); e.root.rotation.z += w * Math.PI * 2 * e.rollS; e.root.position.y += e.h * 0.5 * (1 - Math.cos(w * Math.PI * 2)) + Math.sin(u * Math.PI) * e.rollH * e.def.size; e.rollT -= dt; } // 쫓아낸 적이 옆으로 한 바퀴 구름 (#141, hooks.enemyRepel 이 rollT 를 넣음)
    }
    if (e.state === 'wind' || e.warn?.visible) { // 돌진 조짐: 발밑 붉은 고리가 조여듦 (#148)
      if (!e.warn) { e.warn = new THREE.Mesh(warnGeo.clone(), warnMat); e.warn.renderOrder = 3; group.add(e.warn); e.warnAt = drape(e.warn, height); } // 땅을 따라 휨 (#151)
      e.warn.visible = e.state === 'wind';
      if (e.warn.visible) { const k = d0.size * BOAR.bodyR * (1.6 - 0.5 * Math.min(1, e.st / COMBAT.windT)); e.warnAt(e.pos.x, e.pos.z, Math.round(k * 25) / 25, 0, 0.02); }
    }
    legs4(e, e.speed > 0.3 ? 0.7 : 0);
    const charge = (e.state === 'charge' && e.speed > 4) || e.state === 'wind' || e.state === 'dash' ? 1 : 0; e.chg += (charge - e.chg) * Math.min(1, dt * 4);
    const rooting = e.state === 'root' ? 0.75 + Math.sin(time * 14 + e.phase) * 0.12 : 0;
    e.head.rotation.x = 0.05 + e.chg * 0.25 + rooting + Math.sin(e.phase * 0.5) * 0.08;
    e.tail.rotation.x = Math.sin(time * 9 + e.phase) * 0.4;
    e.fx?.(dt, time, e);
    // 막대: 맞으면 잠깐 흰색
    // 막대는 맞혔거나(BAR_SHOW 초) 나를 노리는 적만 (#201)
    if (e.bar.t > 0) e.bar.t -= dt;
    { const show = e.bar.g.visible && (e.bar.t > 0 || AGGRO.has(e.state)); if (e.bar.inner.visible !== show) e.bar.inner.visible = show; }
    if (e.bar.inner.visible) {
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
    if (!hooks.paced) waveT -= dt; // 연출 감독(#89)이 있으면 감독이 부름
    if (waveT <= 0) { spawnWave(); waveT = ENEMY_SPAWN.every; } // 못 나오면(오름 밖·가득 참) 다음 차례까지 기다림
    blocked = false;
    if (list.length > 1) pack.assign(dt, player, AGGRO); // #146 무리 자리 나누기
    for (let i = list.length - 1; i >= 0; i--) { const e = list[i]; if (!e) continue; try { tick(e, dt, time); } catch (err) { reportCrash(err, 'enemy ' + e.kind); remove(e); } } // #108 한 마리가 오류를 내면 그 적만 없애고 게임은 계속
    if (list.length > 1) { try { pack.separate(dt); } catch (err) { reportCrash(err, 'enemy pack'); } } // #146 적끼리 겹치지 않게
    stuckT = blocked && player.driving ? stuckT + dt : Math.max(0, stuckT - dt * 2);
    if (!list.some((e) => AGGRO.has(e.state))) held = false; // 싸움이 끝나면 머뭇거림을 다시 쓸 수 있음
  }

  // 귤로 맞힐 대상 (#34 자동 조준)
  const aims = new Map();
  function aimTargets(out) {
    for (const e of list) {
      if (e.state === 'flee' || e.state === 'leave') continue;
      let a = aims.get(e); if (!a) { a = { kind: e.kind, pos: e.pos, h: e.h * 0.5, size: 1.5 * e.def.size, vel: new THREE.Vector3(), ok: () => live(e) && list.includes(e), enemy: e }; aims.set(e, a); }
      a.vel.set(Math.sin(e.heading) * e.speed, 0, Math.cos(e.heading) * e.speed); a.chase = AGGRO.has(e.state) || e.state === 'boss'; out.push(a);
    }
    if (aims.size > list.length * 2 + 8) for (const k of aims.keys()) if (!list.includes(k)) aims.delete(k);
  }

  return {
    bind(p, s) { player = p; sound = s; },
    update, hitTest, hitArea, aimTargets, list, bolts,
    active: () => list.some((e) => e.state !== 'flee' && e.state !== 'leave'),
    activeN: () => list.filter((e) => e.state !== 'flee' && e.state !== 'leave').length,
    planWave, spawnPlan, spawnBoss, spawnStory, spawnSwarm, remove, hurt, hesitate, get stuck() { return stuckT; },
    leaveAll() { for (const e of list) if (e.state !== 'flee' && e.state !== 'leave' && !e.boss) { e.state = 'leave'; e.st = 0; e.bar.g.visible = false; } }, // 감독: 공격 시간이 다 됨
    near: (p, r) => list.some((e) => e.state !== 'flee' && e.state !== 'leave' && e.pos.distanceTo(p) < r),
    // 확인용
    test: {
      wave: (kind = null) => spawnWave(true, kind),
      kindHere: () => (player ? kindAt(player.pos.x, player.pos.z) : null),
      spawn: (kind = 'boar', dx = 8, dz = 8, pk = -1) => (player ? spawnOne(kind, player.pos.x + dx, player.pos.z + dz, null, pk) : null),
      // #146 한 자리에 n 마리 한 무리 (ENEMY_SPAWN.max 를 넘어도 부름). 바로 쫓음
      pack: (kind = 'boar', n = 6, dx = 12, dz = 0) => { if (!player) return []; const pk = ++packN, got = []; for (let i = 0; i < n; i++) { const e = spawnOne(kind, player.pos.x + dx + (rnd() - 0.5) * 0.4, player.pos.z + dz + (rnd() - 0.5) * 0.4, null, pk); e.state = 'charge'; e.st = 0; got.push(e); } return got; },
      // 가장 가까운 두 적 사이 거리 - 몸 반지름 합(최솟값), 플레이어 둘레로 벌어진 각(도)
      spread: () => { const L = list.filter((e) => e.state !== 'flee' && e.state !== 'leave'); let gap = Infinity, near = Infinity; for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const dd = Math.hypot(L[i].pos.x - L[j].pos.x, L[i].pos.z - L[j].pos.z); gap = Math.min(gap, dd - bodyR(L[i]) - bodyR(L[j])); near = Math.min(near, dd); } const bs = L.map((e) => Math.atan2(e.pos.x - player.pos.x, e.pos.z - player.pos.z)).sort((a, b) => a - b); let big = 0; for (let i = 0; i < bs.length; i++) big = Math.max(big, ((bs[(i + 1) % bs.length] - bs[i]) + Math.PI * 4) % (Math.PI * 2) || (bs.length === 1 ? Math.PI * 2 : 0)); return { n: L.length, gap, near, arc: (Math.PI * 2 - big) * 180 / Math.PI, d: L.map((e) => Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z)) }; },
      clear: () => { for (const e of list.slice()) remove(e); for (const b of bolts) group.remove(b.g); bolts.length = 0; },
      get timer() { return waveT; }, set timer(v) { waveT = v; },
      state: () => list.map((e) => ({ kind: e.kind, hp: e.hp, state: e.state, life: Math.round(e.life), x: Math.round(e.pos.x), z: Math.round(e.pos.z) })),
    },
  };
}
