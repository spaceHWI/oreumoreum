// 들판 떼 (#173, notes/growth-loop.md '들판 떼' 절): 길 = 안전하고 느긋한 청소, 들판 = 떼가 몰려오는 사냥터 (뱀서류). 수치는 balance.js SWARM
// - 탐방로에서 SWARM.offD m 넘게 벗어나면 '들판'. 그 구역 떼(보통 적의 작고 약한 판)가 플레이어 둘레 화면 밖(ring)에서 끝없이 나오고, 머문 시간에 따라 물결이 세짐
//   (정예·5분에 떼 대장 → 보물 상자). 길로 돌아오면(backD 안) backT 초 뒤 떼가 흩어지고 한 줄 요약·구역 최고 기록
// - 들판에서는 자동 던지기: 가장 가까운 적에게 지금 무기의 간격·피해·귤 소모로 (탄은 여기서 그림: 귤 공, 폭탄은 큰 공). 던지기 버튼을 누르고 있으면 손으로(모아 쏘기 #129 먼저)
//   메뉴 '설정' 의 '자동 던지기' 로 끔 (save.swarm.auto = 0)
// - 쫓겨난 떼 적은 귤(보통 보상 × mob.gyul, 땅에 흩어짐) + 귤 조각(구역별 shard 개). 조각은 magnet 안이면 빨려 오고 shardN 개가 귤 1, 하나에 경험치 1(late.lvGain('swarm', 1), #159)
// - 들판 증강: 조각을 augAt 만큼 모을 때마다 카드 3장 중 하나 (그 판에서만, 3단계까지). 혼자면 화면이 pickSlow 배로 느려지고, 멀티면 느려지지 않고 multiIframe 초 무적
// - 숨 돌릴 틈: 더미를 다 치우면 그 자리 quiet.r m 가 quiet.t 초 동안 떼가 안 나옴(가까운 떼는 떠남). 소굴 den.r 안이면 떼 × more, 닫힌 소굴이면 × closed
// - 초보 보호: 장비 점수 < 구역 권장이면 물결 시간이 slowNew 배로. 기운 lowHp 아래면 enemies.hesitate (#148). 우두머리(#139)·이야기 이벤트(#168, late.story.busy)·엔딩(state.cine)이면 멈춤
// - 문(#176): JOURNEY 'field' (퀘스트 '들판 탐사' 뒤 = FACTS.fieldQuest). 열리기 전엔 물결 1단계까지
// - 멀티: 떼는 사람마다 따로(지금 보통 적과 같은 길: 적은 방으로 보내지 않음). 남의 떼는 보이지 않고, 그 사람이 던지는 귤만 보임 — 적 수가 많아 보내는 양이 늘지 않게
// 저장 save.swarm = { auto: 1|0, best: { 구역: { k 쫓아낸 수, t 버틴 초, w 최고 물결 } }, earn: 떼로 번 귤 누적(서버 validate.js ③ 이 늘어난 몫을 시간당 상한까지 받아 줌), seen }
// (파일 순서는 src/modules.js: boss 뒤. update.js 가 late.tickSwarm 을 부름)
import * as THREE from 'three';
import { SWARM, ENEMIES, BOAR, WEAPONS, ZONES } from '../balance.js';
import { SWARM_TEXT } from '../punktext.js';
import { steer } from '../homing.js';
import { gearScore, zoneRec, gyulPickR } from '../gearscore.js';
import { height } from '../world.js';
import { LOW } from '../gfx2.js';
import { THROW } from '../runner.js';
import { state, late } from './state.js';
import { $, save, persist, isTouch } from './save.js';
import { scene, spots, camera } from './scene.js';
import { trash, life, player, hp, bloom, buff } from './place.js';
import { toast, updateStats, busy } from './hud.js';
import { director } from './director.js';
import { weaponNow, bowReady } from './throw.js';
import { holding } from './arms.js';
import { icon } from '../icons.js';

const S = SWARM, E = life.enemies;
/* ---------- 저장 ---------- */
const SV = (() => { const o = save.swarm = (save.swarm && typeof save.swarm === 'object' && !Array.isArray(save.swarm)) ? save.swarm : {}; if (o.auto !== 0) o.auto = 1; if (!o.best || typeof o.best !== 'object') o.best = {}; return o; })();
let CAP = LOW ? S.cap.low : isTouch ? S.cap.phone : S.cap.pc;
const AUG = Object.fromEntries(S.augs.map((a) => [a.id, a]));
const live = (e) => e.state !== 'flee' && e.state !== 'leave';

/* ---------- 판 상태 ---------- */
// run: 들판에 있는 동안 하나. null 이면 길
const r0 = { scT: 0, newbie: false }; // 장비 점수는 1초에 한 번
let run = null, offT = 0, backT = 0, chkT = 0, onField = false;
const quiet = []; // { x, z, until(초, 게임 시간) }
let clock = 0;
const lv = (id) => run?.aug[id] || 0;
const av = (id, d = 0) => { const n = lv(id); return n ? AUG[id].v[n - 1] : d; };
const multi = () => !!late.net && !late.net.solo && (late.net.peersById?.size || 0) > 0;
const doorOpen = () => director.isOpen('field');
const zoneOf = (x, z) => (trash ? trash.zoneAt(x, z) || 0 : 0);
const distTrail = (x, z) => trash.trail.dist(x, z, S.offD + 4);

let whyNot = '', testOff = false; // testOff: 확인 도구(tools/fight.js 등)가 떼 없이 잴 때
function canField() {
  whyNot = !trash || !state.sessionOn || testOff ? 'off' : late.tut?.active ? 'tut' : hp.isDown || hp.pending ? 'down' : player.cart ? 'cart' : late.bossFight?.() || late.raidFight?.() ? 'boss' : late.story?.busy || state.cine ? 'story' : '';
  if (whyNot) return false;
  const z = zoneOf(player.pos.x, player.pos.z);
  whyNot = !z ? 'zone0' : bloom?.isBloomed(z) ? 'bloomed' : '';
  return !whyNot;
}
function startRun(zone) {
  run = { zone, t: 0, wall: 0, kills: 0, gyul: 0, shards: 0, nextAug: S.augAt[0], augN: 0, aug: {}, stage: 0, maxStage: 0, eliteT: 0, leader: null, leaderDone: false, spawnT: S.firstT, pk: -Math.floor(Math.random() * 1e6) - 10, rainT: 0, shotT: 0, slow: 0, best0: SV.best[zone] ? { ...SV.best[zone] } : null };
  hud(true);
  if (!SV.seen) { SV.seen = 1; persist(); toast(SWARM_TEXT.first, 4); } // 처음 한 번 (문이 열리기 전에도)
  else if (zone !== lastZone || clock - lastEnd > 120) toast(SWARM_TEXT.zone[zone]?.come || '떼가 몰려와요', 2.6);
  lastZone = zone;
}
let lastZone = 0, lastEnd = -1e9;
function endRun(why) {
  const r = run; if (!r) return; run = null; lastEnd = clock; hud(false); closePick(true); if (late.swarm) late.swarm.last = { why, wall: Math.round(r.wall), kills: r.kills };
  for (const e of E.list) if (e.def.swarm && live(e)) { e.state = 'leave'; e.st = 0; e.bar.g.visible = false; }
  orbitHide(); state.swarmSlow = 0;
  if (r.t < 4 && !r.kills) return;
  const b = SV.best[r.zone] || {}, nb = { k: Math.max(b.k || 0, r.kills), t: Math.max(b.t || 0, Math.round(r.wall)), w: Math.max(b.w || 0, r.maxStage + 1) };
  const rec = r.kills > (b.k || 0) && (b.k || 0) > 0;
  SV.best[r.zone] = nb; persist();
  const line = `${r.kills}마리, 귤 +${Math.round(r.gyul)}, 최고 물결 ${r.maxStage + 1}` + (rec ? ' · 새 기록!' : ` · 이 구역 최고 ${nb.k}마리`);
  toast(why === 'down' ? `쓰러졌어요. ${line}` : line, 4.2);
  late.swarmEnd?.(r);
}

/* ---------- 물결 ---------- */
function stageAt(t) { let i = 0; S.stages.forEach((s, k) => { if (t >= s.t) i = k; }); return doorOpen() ? i : 0; }
function denMod() {
  const F = late.field; if (!F) return 1;
  let k = 1; for (const d of F.api.dens) { if (Math.hypot(d.x - player.pos.x, d.z - player.pos.z) > S.den.r) continue; k *= F.api.state.denClosed?.(d) ? S.den.closed : S.den.more; }
  return k;
}
const inQuiet = (x, z) => quiet.some((q) => q.until > clock && Math.hypot(q.x - x, q.z - z) < S.quiet.r);
function pickKind(zone) {
  const L = S.kinds[zone] || [['boar', 1]]; let x = Math.random() * L.reduce((s, k) => s + k[1], 0);
  for (const [k, w] of L) { x -= w; if (x <= 0) return k; } return L[0][0];
}
const _f = new THREE.Vector3();
function spawnSpot(zone) {
  camera.getWorldDirection(_f); const back = Math.atan2(-_f.x, -_f.z); // 카메라 뒤쪽(화면 밖) 중심
  for (let k = 0; k < 20; k++) { // 앞 8번은 카메라 뒤쪽 ring 안, 그다음은 사방, 마지막 6번은 ring 을 넓혀 (좁은 들판)
    const wide = k >= 14, r0 = wide ? S.ring[0] * 0.7 : S.ring[0], r1 = wide ? S.ring[1] * 1.3 : S.ring[1];
    const a = back + (Math.random() - 0.5) * (k < 8 ? 3.6 : 6.28), r = r0 + Math.random() * (r1 - r0);
    const x = player.pos.x + Math.sin(a) * r, z = player.pos.z + Math.cos(a) * r;
    if (spots.enemyOk && !spots.enemyOk(x, z)) continue;
    if (life.hooks.spawnBlock?.(x, z) || zoneOf(x, z) !== zone || inQuiet(x, z)) continue;
    if (life.hooks.enemyPass && !life.hooks.enemyPass(x, z, 0.7)) continue;
    if (distTrail(x, z) < S.backD) continue; // 떼는 들판에서 나옴
    return [x, z];
  }
  return null;
}
// type: 'mob' | 'elite' | 'leader'
function spawn(type) {
  const r = run, kind = pickKind(r.zone), B = ENEMIES[kind], at = spawnSpot(r.zone); if (!at || !B) return null;
  const M = S.mob, T = SWARM_TEXT;
  const gk = M.gyul[r.zone] ?? 0.25, rg = (g) => Math.floor(g) + (Math.random() < g % 1 ? 1 : 0); // 귤 보상 (소수 몫은 확률로)
  let over, k;
  if (type === 'leader') { k = S.leader.k; over = { name: `${T.leader} ${B.name}`, hp: B.hp * S.leader.hp, dmg: B.dmg, size: B.size * k, reward: { gyul: 0, rare: 0 }, life: Infinity }; }
  else if (type === 'elite') { k = 1; over = { name: `${T.elite} ${B.name}`, hp: B.hp * S.elite.hp, dmg: B.dmg * M.dmg * 1.5, size: B.size, reward: { gyul: 0, rare: 0 }, sg: rg(B.reward.gyul * gk * 2), life: M.life * 1.5 }; }
  else { k = M.size; over = { hp: B.hp * M.hp, dmg: B.dmg * M.dmg, size: B.size * k, reward: { gyul: 0, rare: 0 }, sg: rg(B.reward.gyul * gk), life: M.life }; }
  Object.assign(over, { swarm: type, zone: r.zone, sight: 80, lose: 90, rootEvery: [1e9, 1e9] });
  if (B.ranged) over.ranged = { ...B.ranged, every: B.ranged.every * (type === 'mob' ? 1.4 : 1) };
  const straight = S.straight.includes(r.zone) && type === 'mob';
  const e = E.spawnSwarm(kind, at[0], at[1], over, straight ? null : r.pk, k);
  if (type === 'leader') { r.leader = e; toast(T.leaderCome, 3); late.sound?.boar?.(); }
  return e;
}
const swarmN = () => { let n = 0; for (const e of E.list) if (e.def.swarm && live(e)) n++; return n; };

function tickWaves(dt) {
  if ((r0.scT -= dt) <= 0) { r0.scT = 1; r0.newbie = gearScore(save).total < zoneRec(run.zone); }
  const r = run, slow = r0.newbie ? S.slowNew : 1;
  r.t += dt * slow; r.wall += dt;
  const si = stageAt(r.t), st = S.stages[si]; r.stage = si; r.maxStage = Math.max(r.maxStage, si);
  if (inQuiet(player.pos.x, player.pos.z)) return;
  // 떼 대장: leaderT 에 한 번. 쫓아내면 after 로 되돌아감
  if (doorOpen() && !r.leader && r.t >= S.leaderT) spawn('leader');
  if (r.leader && !live(r.leader)) {
    if (r.leader.state === 'flee') { chest(r.leader.pos.clone()); r.t = S.after; }
    r.leader = null;
  }
  // 정예
  if (st.elite) { r.eliteT += dt * slow; if (r.eliteT >= st.elite[0]) { r.eliteT = 0; for (let i = 0; i < st.elite[1]; i++) spawn('elite'); } } else r.eliteT = 0;
  // 빈자리를 바로 채움
  if ((r.spawnT -= dt) > 0) return;
  const want = Math.min(CAP, Math.max(1, Math.round(st.n * denMod())));
  if (swarmN() < want) { spawn('mob'); r.spawnT = S.gap; } else r.spawnT = 0.2;
}
function chest(p) {
  const g = S.leader.chest[run.zone] || 0;
  if (g) { life.scatterTangerines(p.setY(p.y + 0.8), g, 12); earn(g); }
  run.gyul += g; toast(SWARM_TEXT.chest, 3); late.sound?.coin?.();
  late.denLoot?.({ zone: run.zone, x: p.x, y: p.y - 0.8, z: p.z }); // 전리품·재료 (#140, 소굴 몫으로)
  late.swarmLoot?.(run.zone, p);
}

/* ---------- 쫓아냄 → 귤 조각 ---------- */
{
  const prev = life.hooks.enemyRepel;
  life.hooks.enemyRepel = (kind, pos, def, e) => {
    prev?.(kind, pos, def, e); // 업적·연출 감독 (떼 적의 reward.gyul 은 0: 귤은 아래에서 알갱이 2개까지로 — 떼는 잦아 그리기 수를 늘리지 않게)
    if (!def.swarm) return;
    if (def.sg) { life.scatterTangerines(pos, def.sg, 2); earn(def.sg); }
    if (!run) return;
    run.kills++; run.gyul += def.sg || 0;
    const n = (S.shard[def.zone] || 1) * (def.swarm === 'mob' ? 1 : 3);
    for (let i = 0; i < n; i++) dropShard(pos);
    if (kind === 'rabid' && def.swarm === 'mob' && Math.random() < S.sack.p) dropSack(pos);
  };
}
const SH_N = LOW ? 60 : 120;
const shardGeo = new THREE.OctahedronGeometry(0.16, 0), shardMat = new THREE.MeshBasicMaterial({ color: '#ffb23a' });
const shardMesh = new THREE.InstancedMesh(shardGeo, shardMat, SH_N); shardMesh.count = 0; shardMesh.frustumCulled = false; scene.add(shardMesh);
const shards = []; // { p, v, t }
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _y = new THREE.Vector3(0, 1, 0);
function dropShard(pos) {
  if (shards.length >= SH_N) shards.shift();
  const a = Math.random() * 6.28, v = 2 + Math.random() * 2.5;
  shards.push({ p: new THREE.Vector3(pos.x, pos.y + 0.6, pos.z), v: new THREE.Vector3(Math.sin(a) * v, 5 + Math.random() * 2, Math.cos(a) * v), t: 0, ground: false, pull: false });
}
function tickShards(dt) {
  const R = Math.max(S.magnet, gyulPickR(save)) + av('magnet'), pp = player.pos; // 귤 모으는 범위(#151)와 큰 쪽
  for (let i = shards.length - 1; i >= 0; i--) {
    const s = shards[i]; s.t += dt;
    const dx = pp.x - s.p.x, dz = pp.z - s.p.z, d = Math.hypot(dx, dz);
    if (!s.pull && d < R && s.t > 0.35) s.pull = true;
    if (s.pull) { const sp = 10 + s.t * 6; s.p.x += dx / (d || 1) * Math.min(d, sp * dt); s.p.z += dz / (d || 1) * Math.min(d, sp * dt); s.p.y += (pp.y + 1 - s.p.y) * Math.min(1, dt * 8); }
    else if (!s.ground) { s.v.y -= 18 * dt; s.p.addScaledVector(s.v, dt); const gy = height(s.p.x, s.p.z) + 0.2; if (s.p.y < gy) { s.p.y = gy; s.ground = true; } }
    if (d < 0.9 && s.pull) { shards.splice(i, 1); gotShard(); continue; }
    if (s.t > S.shardLife) shards.splice(i, 1);
  }
  const n = shards.length; shardMesh.count = n;
  for (let i = 0; i < n; i++) { const s = shards[i]; _q.setFromAxisAngle(_y, clock * 3 + i); _m.compose(_t.set(s.p.x, s.p.y + (s.ground && !s.pull ? Math.sin(clock * 4 + i) * 0.08 : 0), s.p.z), _q, _s); shardMesh.setMatrixAt(i, _m); }
  if (n) shardMesh.instanceMatrix.needsUpdate = true;
}
const _t = new THREE.Vector3();
let shardAcc = 0;
const earn = (n) => { SV.earn = (Number(SV.earn) || 0) + n; }; // 서버 ③ 몫 (validate.js): 떼로 번 귤 누적
function gotShard() {
  late.lvGain?.('swarm', 1); // 경험치 (#159): 조각 하나에 1 (떼 적 자체는 경험치 없음, level.js)
  if (++shardAcc >= S.shardN) { shardAcc -= S.shardN; save.coins += 1; earn(1); if (run) run.gyul += 1; updateStats(); saveT = saveT > 0 ? saveT : 2; } // 판이 끝난 뒤 주운 조각도 귤로
  if (!run) return;
  run.shards++;
  if (run.shards % 3 === 0) late.sound?.coin?.();
  if (run.shards >= run.nextAug) { run.augN++; run.nextAug += S.augAt[run.augN] ? S.augAt[run.augN] - S.augAt[run.augN - 1] : S.augStep + 5 * (run.augN - S.augAt.length); queuePick(); }
  hudN = -1;
}

/* ---------- 썩은 귤 자루 (구역 4) ---------- */
const sackGeo = new THREE.IcosahedronGeometry(0.42, 0), sackMat = new THREE.MeshLambertMaterial({ color: '#6b7a2c', flatShading: true });
const ringGeo = new THREE.RingGeometry(0.85, 1, 28).rotateX(-Math.PI / 2), ringMat = new THREE.MeshBasicMaterial({ color: '#a9c43a', transparent: true, opacity: 0.6, depthWrite: false });
const sacks = [];
function dropSack(pos) {
  if (sacks.length >= 4) return;
  const m = new THREE.Mesh(sackGeo, sackMat); m.position.set(pos.x, height(pos.x, pos.z) + 0.35, pos.z); scene.add(m);
  const ring = new THREE.Mesh(ringGeo, ringMat.clone()); ring.position.set(pos.x, height(pos.x, pos.z) + 0.08, pos.z); ring.scale.setScalar(S.sack.r); scene.add(ring);
  sacks.push({ m, ring, t: 0 });
}
function tickSacks(dt) {
  for (let i = sacks.length - 1; i >= 0; i--) {
    const k = sacks[i]; k.t += dt;
    k.m.scale.setScalar(1 + Math.sin(k.t * 14) * 0.08 * k.t);
    k.ring.material.opacity = 0.3 + 0.5 * Math.abs(Math.sin(k.t * 6));
    if (k.t >= S.sack.fuse) {
      if (Math.hypot(player.pos.x - k.m.position.x, player.pos.z - k.m.position.z) < S.sack.r) { state.swarmSlow = S.sack.t; toast('썩은 귤즙! 잠깐 느려져요', 1.6); }
      late.sound?.splash?.(); scene.remove(k.m, k.ring); k.ring.material.dispose(); sacks.splice(i, 1);
    }
  }
  if (state.swarmSlow > 0) state.swarmSlow -= dt;
}

/* ---------- 자동 던지기 (탄은 여기서 그림) ---------- */
const SHOT_N = LOW ? 48 : 96;
const shotGeo = new THREE.SphereGeometry(0.17, 8, 6), shotMat = new THREE.MeshLambertMaterial({ color: '#ff9a1f', emissive: '#6a2a00' });
const shotMesh = new THREE.InstancedMesh(shotGeo, shotMat, SHOT_N); shotMesh.count = 0; shotMesh.frustumCulled = false; shotMesh.castShadow = false; scene.add(shotMesh);
const shots = []; // { p, v, life, dmg, pierce, hit: Set, r(터짐), big, home }
const curW = () => (bowReady() ? weaponNow() : WEAPONS[0]);
// 무기 귤 쓰기 (무기 원래 몫: 활 perGyul 발에 귤 1, 총·머신건 perGyul, 레이저 한 발 = gyulPerSec × 간격, 폭탄 cost). 모자라면 손
function pay(w) {
  if (w.id === 'hand') return true;
  if (w.id === 'bomb') { if (save.coins < w.cost) return false; save.coins -= w.cost; updateStats(); return true; }
  if (w.id === 'bow') { if (save.bowAmmo <= 0) { if (save.coins < 1) return false; save.coins -= 1; save.bowAmmo = w.perGyul; updateStats(); } save.bowAmmo -= 1; return true; }
  const per = w.id === 'laser' ? w.gyulPerSec * S.auto.laser : 1, top = w.perGyul || 1;
  let a = save.ammo[w.id] || 0; if (a < per - 1e-6) { if (save.coins < 1) return false; save.coins -= 1; a += top; updateStats(); }
  save.ammo[w.id] = Math.max(0, a - per); return true;
}
const shotDmg = (w) => (w.id === 'mg' ? w.dmg / w.rate : w.id === 'laser' ? w.dmg * S.auto.laser : w.dmg) * buff.mul('dmg') * av('power', 1);
function nearest(R) {
  let b = null, bd = R;
  for (const e of E.list) { if (!live(e)) continue; const d = Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z); if (d < bd) { bd = d; b = e; } }
  return b;
}
const aimOf = new Map(); // 적 → 유도 대상 (homing.js steer 가 읽는 꼴)
const aimT = (e) => { let a = aimOf.get(e); if (!a) { if (aimOf.size > 80) for (const k of aimOf.keys()) if (!E.list.includes(k)) aimOf.delete(k); a = { pos: e.pos, h: Math.min(e.h * 0.5, 1.2), ok: () => live(e) && E.list.includes(e) }; aimOf.set(e, a); } return a; };
function fire(dt) {
  if ((run.shotT -= dt) > 0) return;
  if (!SV.auto || holding() || (busy() && player.pose !== 'crouch') || player.knock || player.riding) return; // 줍는 동안(crouch)에도 지켜 줌
  let w = curW(); const t = nearest(w.range); if (!t) return;
  if (!pay(w)) { w = WEAPONS[0]; }
  run.shotT = (S.auto[w.id] || 0.8) / av('rate', 1);
  const from = new THREE.Vector3(player.pos.x, player.pos.y + 1.25 + player.jumpY, player.pos.z);
  const tp = new THREE.Vector3(t.pos.x, t.pos.y + Math.min(t.h * 0.5, 1.2), t.pos.z), D = from.distanceTo(tp), v = w.id === 'hand' ? S.shotV * 0.85 : S.shotV;
  tp.x += Math.sin(t.heading) * t.speed * D / v * 0.8; tp.z += Math.cos(t.heading) * t.speed * D / v * 0.8;
  const dir = tp.sub(from).normalize(), base = Math.atan2(dir.x, dir.z), dmg = shotDmg(w);
  const big = w.id === 'bomb', o = { dmg, r: big ? w.r : av('burst'), big, pierce: av('pierce'), life: w.range / v + 0.2 };
  const forks = av('fork'), backs = av('back'), sp = 0.2;
  shoot(from, dir, v, o, aimT(t));
  for (let i = 1; i <= forks; i++) shoot(from, rotY(dir, sp * Math.ceil(i / 2) * (i % 2 ? 1 : -1)), v, o, null);
  for (let i = 0; i < backs; i++) shoot(from, rotY(dir, Math.PI + (i - (backs - 1) / 2) * sp), v, o, null);
  if (player.pose === 'move' && !player.air && (w.id === 'hand' || w.id === 'bomb')) { player.pose = 'throw'; player.poseT = THROW.release + 0.02; state.throwPending = false; } // 던지는 동작만 (탄은 위에서)
  else if (w.id === 'bow' && player.pose === 'move' && !player.air) { player.pose = 'bow'; player.poseT = 0.3; state.bowPending = false; }
  late.sound?.[w.id === 'gun' ? 'gun' : w.id === 'mg' ? 'mg' : w.id === 'bow' ? 'bow' : 'beep']?.(false);
  if (w.id !== 'hand') saveT = saveT > 0 ? saveT : 2; // 탄·귤은 2초에 한 번 저장 (머신건 초당 6발마다 쓰지 않게)
}
const rotY = (d, a) => d.clone().applyAxisAngle(_y, a);
function shoot(from, dir, v, o, home) {
  if (shots.length >= SHOT_N) shots.shift();
  shots.push({ p: from.clone(), v: dir.clone().multiplyScalar(v), life: o.life, dmg: o.dmg, r: o.r, big: o.big, pierce: o.pierce, hit: new Set(), home, t: 0 });
}
function hitShot(s, e) {
  if (s.r) { life.hitArea(s.p, s.r, s.big ? s.dmg : s.dmg * 0.5); late.weaponFxBoom?.(s.p, s.r); if (!s.big) E.hurt(e, s.dmg * 0.5, true); }
  else E.hurt(e, s.dmg, true);
  s.hit.add(e);
}
function tickShots(dt) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i]; s.t += dt; s.life -= dt;
    if (s.home && s.t < 1.2) steer(s.v, s.p, s.home, dt, Math.PI * 1.5);
    s.p.addScaledVector(s.v, dt);
    let done = s.life <= 0 || s.p.y < height(s.p.x, s.p.z) - 0.1;
    if (done && s.big && s.life > 0) life.hitArea(s.p, s.r, s.dmg); // 폭탄은 땅에 닿아도 터짐
    if (!done) for (const e of E.list) {
      if (!live(e) || s.hit.has(e)) continue;
      const R = BOAR.hitR * e.def.size * 0.9 + 0.15;
      if (Math.abs(s.p.x - e.pos.x) > R || Math.abs(s.p.z - e.pos.z) > R || Math.hypot(s.p.x - e.pos.x, s.p.z - e.pos.z) > R) continue;
      hitShot(s, e); if (s.pierce-- <= 0 || s.big) { done = true; break; }
    }
    if (done) shots.splice(i, 1);
  }
  const n = shots.length; shotMesh.count = n;
  for (let i = 0; i < n; i++) { const s = shots[i]; _m.makeScale(s.big ? 2.2 : 1, s.big ? 2.2 : 1, s.big ? 2.2 : 1).setPosition(s.p); shotMesh.setMatrixAt(i, _m); }
  if (n) shotMesh.instanceMatrix.needsUpdate = true;
}

/* ---------- 증강 효과: 도는 귤·귤비·밀쳐 내기·회복 ---------- */
const ORB_N = 5, orbMesh = new THREE.InstancedMesh(shotGeo, shotMat, ORB_N); orbMesh.count = 0; orbMesh.frustumCulled = false; scene.add(orbMesh);
const orbCd = new Map();
function orbitHide() { orbMesh.count = 0; }
function tickOrbit(dt) {
  const n = av('orbit'); orbMesh.count = n; if (!n) return;
  const w = curW(), dmg = Math.max(1, shotDmg(w)) * 0.8, R = 2.3;
  for (let i = 0; i < n; i++) {
    const a = clock * 3.2 + i * Math.PI * 2 / n, x = player.pos.x + Math.sin(a) * R, z = player.pos.z + Math.cos(a) * R, y = player.pos.y + 1.0;
    _m.makeScale(1.3, 1.3, 1.3).setPosition(x, y, z); orbMesh.setMatrixAt(i, _m);
    for (const e of E.list) { if (!live(e) || (orbCd.get(e) || 0) > clock) continue; if (Math.hypot(e.pos.x - x, e.pos.z - z) < BOAR.hitR * e.def.size * 0.8 + 0.3) { E.hurt(e, dmg, true); orbCd.set(e, clock + 0.5); } }
  }
  orbMesh.instanceMatrix.needsUpdate = true;
  if (orbCd.size > 64) for (const [k, t] of orbCd) if (t < clock) orbCd.delete(k);
}
function tickRain(dt) {
  const every = av('rain'); if (!every) return;
  if ((run.rainT += dt) < every) return; run.rainT = 0;
  const dmg = Math.max(1, shotDmg(curW())) * 3;
  for (const e of E.list) { if (!live(e) || Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z) > S.ring[1]) continue; shoot(new THREE.Vector3(e.pos.x + (Math.random() - 0.5), e.pos.y + 9, e.pos.z + (Math.random() - 0.5)), new THREE.Vector3(0, -1, 0), 22, { dmg, r: 0, big: false, pierce: 0, life: 1 }, aimT(e)); }
  toast('귤비!', 1);
}
{
  const prev = life.hooks.enemyHit; // 맞으면 둘레 적을 밀어냄 (밀쳐 내기)
  life.hooks.enemyHit = (dir, def, kind) => {
    const was = player.iframe; prev?.(dir, def, kind);
    if (!run || !lv('shove') || was > 0) return;
    const R = av('shove');
    for (const e of E.list) { if (!live(e)) continue; const ux = e.pos.x - player.pos.x, uz = e.pos.z - player.pos.z, L = Math.hypot(ux, uz); if (L > R || L < 0.01) continue; e.fl = 0.45; e.flV = 14 / e.def.size; e.flX = ux / L; e.flZ = uz / L; if (e.state === 'wind' || e.state === 'dash') { e.state = 'charge'; e.st = 0; } }
  };
}
late.swarmSpeed = () => (run ? av('move', 1) : 1) * (state.swarmSlow > 0 ? S.sack.slow : 1);

/* ---------- 증강 고르기 (카드 3장) ---------- */
const pickEl = document.createElement('div'); pickEl.id = 'swarm-pick'; pickEl.hidden = true; pickEl.setAttribute('role', 'dialog'); pickEl.setAttribute('aria-label', '들판 증강 고르기'); document.body.appendChild(pickEl);
let picking = null, pickQ = 0, pickWall = 0, slowWas = null;
function queuePick() { pickQ++; if (!picking) openPick(); }
function openPick() {
  if (!run || pickQ <= 0) return; pickQ--;
  const pool = S.augs.filter((a) => (run.aug[a.id] || 0) < a.v.length && !(a.id === 'heal' && hp.hp >= hp.max));
  if (!pool.length) { save.coins += 5; updateStats(); persist(); toast('증강이 다 찼어요 · 귤 +5', 1.5); return; }
  const cards = []; while (cards.length < 3 && pool.length) cards.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  picking = cards; pickWall = performance.now();
  pickEl.innerHTML = `<div class="sp-h">증강 고르기</div><div class="sp-row">${cards.map((a, i) => { const n = run.aug[a.id] || 0; return `<button type="button" class="sp-card" data-i="${i}"><b>${a.name}</b><small>${a.d}</small><i>${'●'.repeat(n + 1)}${'○'.repeat(a.v.length - n - 1)}</i><kbd>${i + 1}</kbd></button>`; }).join('')}</div>`;
  pickEl.hidden = false;
  if (multi()) player.iframe = Math.max(player.iframe || 0, S.multiIframe); else { slowWas = [state.slowMo, state.slowK]; state.slowMo = 99; state.slowK = (state.slowK || 1) * S.pickSlow; }
}
function choose(i) {
  const a = picking?.[i]; if (!a || !run) return;
  run.aug[a.id] = (run.aug[a.id] || 0) + 1;
  if (a.id === 'heal') hp.set(hp.hp + av('heal'));
  late.sound?.coin?.(); toast(`${a.name} ${run.aug[a.id]}단계`, 1.4);
  closePick(); if (pickQ > 0) setTimeout(openPick, 250);
}
function closePick(all = false) { if (!picking && pickEl.hidden) return; picking = null; pickEl.hidden = true; if (slowWas) { [state.slowMo, state.slowK] = slowWas; slowWas = null; } if (all) pickQ = 0; }
pickEl.addEventListener('pointerdown', (ev) => { const b = ev.target.closest('.sp-card'); if (b) { ev.preventDefault(); ev.stopPropagation(); choose(+b.dataset.i); } });
addEventListener('keydown', (ev) => { if (!picking || ev.repeat) return; const n = +ev.key; if (n >= 1 && n <= 3) { ev.preventDefault(); choose(n - 1); } }, true);

/* ---------- 화면 위 한 줄 ---------- */
const st = document.createElement('style');
st.textContent = `
#swarm-bar { position: fixed; z-index: 5; left: 50%; top: calc(var(--tb-top, 12px) + var(--tb-h, 36px) + 12px); transform: translateX(-50%); padding: 5px 14px; border-radius: 14px; pointer-events: none; font-family: var(--display); font-weight: 800; font-size: 15px; white-space: nowrap; display: flex; gap: 10px; align-items: center; }
#swarm-bar[hidden] { display: none; }
#swarm-bar svg { width: 16px; height: 16px; flex: none; color: var(--gyul, #ff9a1f); }
#swarm-bar .sb-n { color: var(--gyul, #ff9a1f); }
#swarm-bar .sb-bar { width: 52px; height: 6px; border-radius: 4px; background: rgba(255,255,255,.18); overflow: hidden; display: inline-block; }
#swarm-bar .sb-bar i { display: block; height: 100%; width: 0; background: var(--gyul, #ff9a1f); border-radius: 4px; }
#swarm-pick { position: fixed; z-index: 30; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(560px, calc(100vw - 32px)); text-align: center; font-family: var(--display); pointer-events: auto; }
#swarm-pick[hidden] { display: none; }
#swarm-pick .sp-h { color: #fff; font-weight: 800; font-size: 18px; margin-bottom: 10px; text-shadow: 0 2px 6px rgba(0,0,0,.6); }
#swarm-pick .sp-row { display: flex; gap: 10px; }
#swarm-pick .sp-card { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; align-items: center; padding: 14px 8px 10px; border-radius: 16px; border: 2px solid var(--gyul, #ff9a1f); background: var(--panel, rgba(36,33,30,.94)); color: var(--ink, #fff); font: inherit; cursor: pointer; position: relative; }
#swarm-pick .sp-card b { font-size: 16px; } #swarm-pick .sp-card small { font-size: 12px; color: var(--ink-soft, #cfc7bb); font-weight: 600; line-height: 1.3; } #swarm-pick .sp-card i { font-style: normal; color: var(--gyul, #ff9a1f); letter-spacing: 2px; }
#swarm-pick kbd { position: absolute; top: 6px; right: 8px; font-size: 11px; opacity: .55; font-family: inherit; }
@media (pointer: coarse) { #swarm-pick kbd { display: none; } }
@media (max-width: 600px) { #swarm-bar { left: calc(var(--safe-l, 0px) + 12px); top: calc(var(--tb-top, 12px) + var(--tb-h, 36px) + 54px); transform: none; font-size: 13px; gap: 7px; } #swarm-pick .sp-row { flex-direction: column; } #swarm-pick .sp-card { flex-direction: row; justify-content: space-between; padding: 12px; text-align: left; } }
`;
document.head.appendChild(st);
const bar = document.createElement('div'); bar.id = 'swarm-bar'; bar.className = 'panel'; bar.hidden = true; bar.setAttribute('role', 'status');
bar.innerHTML = icon('field') + '<span id="sb-t">0:00</span><span>·</span><span class="sb-n" id="sb-k">0</span><span>마리 ·</span><span>물결 <b id="sb-w">1</b></span><span class="sb-bar" title="다음 증강"><i id="sb-a"></i></span>';
document.body.appendChild(bar);
let hudN = -1, hudS = -1;
function hud(on) { bar.hidden = !on; document.body.classList.toggle('swarm-on', on); hudN = -1; }
function tickHud() {
  if (!run) return;
  const s = Math.floor(run.wall); if (s !== hudS) { hudS = s; $('sb-t').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
  const key = run.kills * 100 + run.stage * 7 + run.shards; if (key === hudN) return; hudN = key;
  $('sb-k').textContent = run.kills; $('sb-w').textContent = run.stage + 1;
  const prev = run.augN ? (S.augAt[run.augN - 1] ?? run.nextAug - S.augStep) : 0;
  $('sb-a').style.width = `${Math.round(100 * Math.min(1, (run.shards - prev) / Math.max(1, run.nextAug - prev)))}%`;
  bar.hidden = !!late.bossFight?.() || !!late.raidFight?.();
}

/* ---------- 설정: 자동 던지기 ---------- */
{
  const more = document.querySelector('#menu .m-more') || document.querySelector('.m-more');
  if (more) {
    const b = document.createElement('button'); b.type = 'button'; b.id = 'menu-auto';
    const sync = () => { b.textContent = `자동 던지기: ${SV.auto ? '켬' : '끔'}`; b.setAttribute('aria-pressed', String(!!SV.auto)); };
    sync(); b.addEventListener('click', () => { SV.auto = SV.auto ? 0 : 1; persist(); sync(); });
    more.insertBefore(b, more.children[1] || null);
  }
}

/* ---------- 숨 돌릴 틈: 더미를 다 치우면 ---------- */
if (late.pace) {
  const prev = late.pace.cleared;
  late.pace.cleared = (h) => {
    prev?.(h);
    const hh = trash?.heaps[h]; if (!hh) return;
    quiet.push({ x: hh.x, z: hh.z, until: clock + S.quiet.t }); while (quiet.length > 6) quiet.shift();
    if (!run) return;
    let n = 0; for (const e of E.list) if (e.def.swarm && live(e) && e.def.swarm !== 'leader' && Math.hypot(e.pos.x - hh.x, e.pos.z - hh.z) < S.quiet.r) { e.state = 'leave'; e.st = 0; e.bar.g.visible = false; n++; }
    if (n || Math.hypot(player.pos.x - hh.x, player.pos.z - hh.z) < S.quiet.r) toast(SWARM_TEXT.quiet, 2.4);
  };
}

/* ---------- 문 (#176) ---------- */
director.register({ id: 'field', intro: () => toast(SWARM_TEXT.open, 4) });

/* ---------- 매 프레임 (update.js) ---------- */
let hesT = 0, saveT = 0;
late.tickSwarm = (dt) => {
  if (!trash) return;
  clock += dt;
  if ((chkT -= dt) <= 0) { chkT = 0.2; const d = distTrail(player.pos.x, player.pos.z); onField = run ? d >= S.backD : d > S.offD; }
  const ok = canField();
  if (!run) {
    offT = onField && ok ? offT + dt : 0;
    if (offT > 0.3) { offT = 0; backT = 0; startRun(zoneOf(player.pos.x, player.pos.z)); }
  } else {
    if (hp.isDown || hp.pending) endRun('down');
    else if (!ok) endRun('stop:' + whyNot);
    else {
      const z = zoneOf(player.pos.x, player.pos.z);
      if (z !== run.zone && z > 0) { const r = run; endRun('zone'); if (onField) startRun(z); else void r; }
    }
    if (run) {
      if (!onField) { backT += dt; if (backT >= S.backT) { toast(SWARM_TEXT.back, 2); endRun('back'); } }
      else backT = 0;
    }
    if (run && onField) tickWaves(dt);
    if (run) {
      fire(dt); tickOrbit(dt); tickRain(dt); tickHud();
      if ((hesT -= dt) <= 0) { hesT = 0.5; if (hp.hp < hp.max * S.lowHp) E.hesitate(); }
      if (picking && performance.now() - pickWall > 12000) choose(0); // 오래 안 고르면 첫 카드
    }
  }
  if (saveT > 0 && (saveT -= dt) <= 0) persist();
  tickShots(dt); tickShards(dt); tickSacks(dt);
  for (const e of E.list) if (e.def.swarm && ((e.state === 'flee' && e.st > 1.2) || (e.state === 'leave' && e.st > 3.5))) { E.remove(e); break; } // 쫓겨난·떠나는 떼 적은 곧 사라짐 (그리기 수)
  if (!run && !shots.length && orbMesh.count) orbitHide();
};

/* ---------- 확인용 (window.__oreum.swarm) ---------- */
// start(zone): 그 구역 들판 빈 곳으로 옮겨 바로 판을 시작, stop(): 길로 돌아온 것처럼 끝, t(초): 물결 시간 바꾸기, aug(id): 증강 하나 더하기, state(): 지금 판
late.swarm = {
  start(zone = 1) {
    const T = trash; if (!T) return null;
    const hs = T.heaps.filter((h) => h.zone === zone && h.field); let spot = null;
    for (const h of hs) { for (let k = 0; k < 20 && !spot; k++) { const a = Math.random() * 6.28, r = h.r + 4 + Math.random() * 8, x = h.x + Math.sin(a) * r, z = h.z + Math.cos(a) * r; if (zoneOf(x, z) === zone && distTrail(x, z) > S.offD + 2 && (!life.hooks.enemyPass || life.hooks.enemyPass(x, z, 0.7)) && (!spots.clamp || !spots.clamp(x, z))) spot = [x, z]; } if (spot) break; }
    if (!spot) return null;
    player.pos.set(spot[0], height(spot[0], spot[1]), spot[1]); player.target = null;
    if (run) endRun('stop'); onField = true; chkT = 0.2; startRun(zone); return { x: +spot[0].toFixed(1), z: +spot[1].toFixed(1) };
  },
  stop() { if (run) endRun('back'); },
  disable(v = true) { testOff = !!v; if (v && run) endRun('stop:test'); },
  t(v) { if (run) run.t = v; },
  aug(id) { if (run && AUG[id]) { run.aug[id] = Math.min(AUG[id].v.length, (run.aug[id] || 0) + 1); return run.aug[id]; } return 0; },
  pick: (i) => choose(i), offer: () => queuePick(), picking: () => picking && picking.map((a) => a.id), shards: () => shards.length, shardsAt: () => shards.map((q) => [q.p.x, q.p.z]),
  auto: (v) => { if (v != null) { SV.auto = v ? 1 : 0; persist(); } return SV.auto; },
  state: () => run && { zone: run.zone, t: +run.t.toFixed(1), wall: +run.wall.toFixed(1), stage: run.stage + 1, n: swarmN(), cap: CAP, kills: run.kills, gyul: Math.round(run.gyul), shards: run.shards, nextAug: run.nextAug, aug: { ...run.aug }, leader: !!run.leader, onField },
  best: () => ({ ...SV.best }), get cap() { return CAP; }, setCap(n) { CAP = n; }, // tools/swarm.js: 헤드리스는 저사양이라 PC 상한으로 바꿔 잼
  // fill(n, kind): 판 없이 플레이어 둘레 8~12m 에 떼 적 n 마리 (tools/perf.js 'swarm')
  fill(n = CAP, kind = 'piglet') { const B = ENEMIES[kind], M = S.mob, got = []; for (let i = 0; i < n; i++) { const a = i / n * 6.283, r = 8 + (i % 3) * 2, x = player.pos.x + Math.sin(a) * r, z = player.pos.z + Math.cos(a) * r; got.push(E.spawnSwarm(kind, x, z, { swarm: 'mob', zone: 0, hp: B.hp * M.hp * 50, dmg: 0, size: B.size * M.size, reward: { gyul: 0, rare: 0 }, life: 999, sight: 80, lose: 90, rootEvery: [1e9, 1e9] }, null, M.size)); } return got.length; },
  speed(k = 1) { state.slowK = k; state.slowMo = k !== 1 ? 1e9 : 0; }, // tools/swarm.js: 게임 시간을 k 배로 (dt 0.05 상한 × k)
};
