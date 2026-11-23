// 들머리 흡연자 (#156): 오름 들머리(들머리 클린하우스 둘레)에 가끔 담배 피우는 사람이 나타남. 공격하지 않음. 수치는 balance.js SMOKER
// - 플레이어가 들머리 클린하우스 SMOKER.playerR m 안에 있을 때만 every 초마다 한 명(한 번에 한 명). 튜토리얼 중·엔딩 중엔 안 나옴
// - 모양: 투기꾼(dumpers.js buildWalker) 회색 점퍼, 봉투 없음. 서서 손을 입으로 올렸다 내리고 입 앞에 연기, 머리 위 금연 표시
// - 귤(손·무기)을 한 번 맞히면 깜짝 놀라 꽁초 1개를 떨구고 도망가 사라짐 (투기꾼 DUMP.startleT·fleeDist·fadeT) → 귤 SMOKER.reward, 업적 'smoker-repel'
// - 안 쫓으면 stay 초 뒤 꽁초 leaveButts 개를 버리고 걸어 나가 사라짐
// - 꽁초: 주울 수 있는 낱개 쓰레기(가까이 가면 주움, 배낭에 비닐 1개로 들어감, 도감 '담배꽁초'). 더미 수·구역 완료 집계에는 안 들어감. 저장하지 않음
// - 맞히기·자동 조준은 life.addTargets (투기꾼과 같은 길). 멀티: 투기꾼처럼 사람마다 따로 (방으로 보내지 않음)
// - 매 프레임은 dumpers.update 를 감싸 돎 (update.js 를 건드리지 않게)
import * as THREE from 'three';
import { SMOKER, DUMP } from '../balance.js';
import { buildWalker } from '../dumpers.js';
import { height, surfaceAt } from '../world.js';
import { LOW } from '../gfx2.js';
import { state, late } from './state.js';
import { save } from './save.js';
import { scene } from './scene.js';
import { life, trash, player, CH, col, stream, hp } from './place.js';
import { toast, ach, onDexGet, pickMsg } from './hud.js';
import { say } from './director.js';
import { dumpers, makeEdgeWarn, sound } from './hooks.js';
import { bagCap, updateTrashUI } from './pickup.js';

const SAY = '들머리에 담배 피우는 사람이 있어요';
const S = SMOKER, wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const group = new THREE.Group(); scene.add(group);
const list = [];
let timer = S.every[0] * 0.5;
const nextT = () => S.every[0] + Math.random() * (S.every[1] - S.every[0]);

/* ---------- 금연 표시 (머리 위) ---------- */
const signMat = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 32, 28, 0, 7); g.fill();
  g.fillStyle = '#f4f1e8'; g.fillRect(14, 30, 30, 8); g.fillStyle = '#e3a25a'; g.fillRect(36, 30, 8, 8); g.fillStyle = '#ff6a3a'; g.fillRect(12, 30, 3, 8);
  g.strokeStyle = '#d8423a'; g.lineWidth = 7; g.beginPath(); g.arc(32, 32, 25, 0, 7); g.stroke(); g.beginPath(); g.moveTo(14, 14); g.lineTo(50, 50); g.stroke();
  const t = new THREE.CanvasTexture(c); return new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true });
})();
const warnEl = makeEdgeWarn('smoke-warn', '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="#ff5a4a" stroke-width="2.6"/><path d="M6 6 L18 18" stroke="#ff5a4a" stroke-width="2.6"/></svg>', DUMP.warnT);
{ const st = document.createElement('style'); st.textContent = '#smoke-warn { position: fixed; left: 0; top: 0; z-index: 7; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle, #24251f 0 55%, rgba(255,90,74,.35) 56% 100%); box-shadow: 0 0 16px rgba(255,90,74,.5); pointer-events: none; } #smoke-warn[hidden] { display: none; }'; document.head.appendChild(st); }

/* ---------- 연기 (작은 공 풀) ---------- */
const puffG = new THREE.SphereGeometry(0.07, 6, 4), puffs = [];
function puff(x, y, z) {
  let p = puffs.find((q) => q.t <= 0);
  if (!p) { if (puffs.length >= (LOW ? 4 : 12)) return; const m = new THREE.Mesh(puffG, new THREE.MeshBasicMaterial({ color: '#d9dcdf', transparent: true, depthWrite: false })); group.add(m); p = { m, t: 0, life: 1 }; puffs.push(p); }
  p.m.position.set(x, y, z); p.t = p.life = 1.4 + Math.random() * 0.6; p.vx = (Math.random() - 0.5) * 0.25; p.vz = (Math.random() - 0.5) * 0.25; p.m.visible = true;
}
function tickPuffs(dt) {
  for (const p of puffs) { if (p.t <= 0) continue; p.t -= dt; if (p.t <= 0) { p.m.visible = false; continue; } const k = p.t / p.life; p.m.position.x += p.vx * dt; p.m.position.z += p.vz * dt; p.m.position.y += 0.45 * dt; p.m.material.opacity = 0.55 * k; p.m.scale.setScalar(1 + (1 - k) * 2.5); }
}

/* ---------- 꽁초 (낱개 쓰레기) ---------- */
const buttGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6).rotateZ(Math.PI / 2), buttMat = new THREE.MeshLambertMaterial({ color: '#e8dcc0' });
const butts = []; // { m, t }
function dropButts(x, z, n) {
  for (let i = 0; i < n; i++) {
    if (butts.length >= S.buttMax) { const o = butts.shift(); group.remove(o.m); }
    const a = Math.random() * 6.28, r = 0.3 + Math.random() * 0.9, bx = x + Math.sin(a) * r, bz = z + Math.cos(a) * r;
    const m = new THREE.Mesh(buttGeo, buttMat); m.position.set(bx, height(bx, bz) + 0.04, bz); m.rotation.y = Math.random() * 6.28; group.add(m);
    butts.push({ m, t: S.buttLife });
  }
}
function tickButts(dt) {
  for (let i = butts.length - 1; i >= 0; i--) {
    const b = butts[i]; b.t -= dt;
    if (b.t <= 0) { group.remove(b.m); butts.splice(i, 1); continue; }
    if (Math.hypot(b.m.position.x - player.pos.x, b.m.position.z - player.pos.z) > S.pickR || hp.isDown || player.riding) continue;
    if (!trash.addToBag('vinyl', bagCap())) { if (!b.full) { b.full = true; toast('배낭이 가득해서 꽁초를 못 주워요', 1.6); } continue; }
    group.remove(b.m); butts.splice(i, 1);
    const isNew = trash.store.dexAdd('butt:0'); trash.store.commit();
    if (isNew) { const dx = { id: 'butt:0', kind: 'butt', name: '담배꽁초', rare: false }; onDexGet(dx, isNew); } else pickMsg('담배꽁초');
    ach.emit('trash-butt'); sound.pick?.();
    updateTrashUI(true);
  }
}

/* ---------- 자리 ---------- */
// 들머리 클린하우스 둘레 near m 안, 길(surfaceAt ≠ 0)에서 off[0]~off[1] m 비켜난 곳
function onPath(x, z) { return surfaceAt(x, z) !== 0; }
function pathDist(x, z) { for (let r = 0.5; r <= S.off[1] + 0.01; r += 0.5) for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; if (onPath(x + Math.sin(a) * r, z + Math.cos(a) * r)) return r; } return Infinity; }
function spot() {
  const c = CH.center;
  for (let k = 0; k < 40; k++) {
    const a = Math.random() * 6.283, r = 4 + Math.random() * (S.near - 4), x = c.x + Math.sin(a) * r, z = c.z + Math.cos(a) * r;
    if (onPath(x, z) || (col && col.blocked(x, z, 0.6)) || (stream && stream.inWater(x, z))) continue;
    const d = pathDist(x, z); if (d < S.off[0] || d > S.off[1]) continue;
    return [x, z];
  }
  return null;
}

/* ---------- 한 명 ---------- */
function spawn() {
  if (list.length || !CH) return null;
  const at = spot(); if (!at) return null;
  const m = buildWalker({ jacket: S.jacket, withBag: false });
  // 걸어 들어올 곳: 플레이어 반대쪽 walkIn m (나타나는 게 덜 갑작스럽게)
  const away = Math.atan2(at[0] - player.pos.x, at[1] - player.pos.z), sx = at[0] + Math.sin(away) * S.walkIn, sz = at[1] + Math.cos(away) * S.walkIn;
  const sign = new THREE.Sprite(signMat); sign.scale.set(0.7, 0.7, 1); sign.position.set(0, m.h + 0.55, 0); sign.renderOrder = 12; m.root.add(sign);
  const d = { ...m, def: S, kind: 'smoker', sign, pos: new THREE.Vector3(sx, height(sx, sz), sz), at, from: [sx, sz], heading: away + Math.PI, speed: 0, state: 'come', st: 0, hp: S.hp, phase: 0, puffT: 0, fleeD: 0 };
  d.root.position.copy(d.pos); group.add(d.root); list.push(d);
  warnEl.start({ x: at[0], z: at[1] });
  if (!say('tip', 'smoker', SAY, 2.8, { queue: false })) toast(SAY, 2.8); // 감독이 바쁘면 바로 (그 자리 반응)
  late.npcBark?.('smoker', d, 'come'); /* #278 핑계 한마디 */
  return d;
}
function remove(d) { const i = list.indexOf(d); if (i >= 0) list.splice(i, 1); group.remove(d.root); }
function repel(d) {
  d.state = 'startle'; d.st = 0; d.sign.visible = false;
  dropButts(d.pos.x, d.pos.z, 1);
  life.scatterTangerines(d.pos.clone(), S.reward);
  sound.beep?.(true); toast('흡연자가 놀라 도망가요. 꽁초는 주워요', 2.4); late.npcBark?.('smoker', d, 'repel');
  ach.emit('smoker-repel'); late.pace?.note('repel');
}
function beginFade(d) { if (d.fade != null) return; d.fade = 1; d.root.traverse((o) => { if (o.isMesh && o.material) { o.material = o.material.clone(); o.material.transparent = true; } }); }
function goTo(d, x, z, want, dt) {
  const dx = x - d.pos.x, dz = z - d.pos.z, L = Math.hypot(dx, dz);
  d.heading += wrapA(Math.atan2(dx, dz) - d.heading) * Math.min(1, dt * 6);
  return { L, want: L < 0.4 ? 0 : want };
}
function tick(d, dt, time) {
  d.st += dt; let want = 0;
  if (d.state === 'come') { const g = goTo(d, d.at[0], d.at[1], S.speed, dt); want = g.want; if (g.L < 0.5) { d.state = 'smoke'; d.st = 0; } }
  else if (d.state === 'smoke') {
    want = 0; // 제자리
    const u = (time * 0.45 + d.phase) % 1, up = u < 0.35 ? Math.sin(u / 0.35 * Math.PI) : 0; // 손을 입으로 올렸다 내림
    d.arms[1].rotation.x = -2.1 * up; d.arms[1].rotation.z = 0.35 * up;
    if (u < 0.35) d.puffed = false;
    else if (!d.puffed) { d.puffed = true; // 손을 내린 뒤 한 모금 내뿜음
      const n = LOW ? S.puffLow : S.puff, fx = d.pos.x + Math.sin(d.heading) * 0.35, fz = d.pos.z + Math.cos(d.heading) * 0.35; for (let i = 0; i < n; i++) setTimeout(() => puff(fx, d.pos.y + 1.85, fz), i * 90); }
    if (d.st >= S.stay) { dropButts(d.pos.x, d.pos.z, S.leaveButts); d.state = 'leave'; d.st = 0; d.sign.visible = false; d.arms[1].rotation.set(0, 0, 0); }
  } else if (d.state === 'leave') { const g = goTo(d, d.from[0], d.from[1], S.speed, dt); want = S.speed; if (g.L < 1.5 || d.st > 20) beginFade(d); }
  else if (d.state === 'startle') {
    const u = Math.min(1, d.st / DUMP.startleT); d.hop = Math.sin(u * Math.PI) * 0.9; d.arms[0].rotation.x = d.arms[1].rotation.x = -2.4 * Math.sin(u * Math.PI);
    if (d.st >= DUMP.startleT) { d.state = 'flee'; d.st = 0; d.hop = 0; d.heading = Math.atan2(d.pos.x - player.pos.x, d.pos.z - player.pos.z); }
  } else if (d.state === 'flee') { want = S.flee; d.fleeD += d.speed * dt; if (d.st > DUMP.fleeT || d.fleeD > DUMP.fleeDist) beginFade(d); }
  d.speed += (want - d.speed) * Math.min(1, dt * 4);
  if (d.speed > 0.01) { const nx = d.pos.x + Math.sin(d.heading) * d.speed * dt, nz = d.pos.z + Math.cos(d.heading) * d.speed * dt; d.pos.set(nx, height(nx, nz), nz); }
  d.phase += dt * d.speed * 3.2;
  if (d.fade != null) { d.fade -= dt / DUMP.fadeT; if (d.fade <= 0) { remove(d); return; } d.root.traverse((o) => { if (o.isMesh && o.material?.transparent) o.material.opacity = d.fade; }); }
  d.root.position.copy(d.pos); d.root.position.y += d.hop || 0; d.root.rotation.y = d.heading;
  const a = Math.min(0.8, d.speed * 0.25), s = Math.sin(d.phase);
  d.legs[0].rotation.x = s * a; d.legs[1].rotation.x = -s * a;
  if (d.state === 'come' || d.state === 'leave' || d.state === 'flee') { d.arms[0].rotation.x = -s * a * 0.8; d.arms[1].rotation.x = s * a * 0.8; }
  d.sign.position.y = d.h + 0.55 + Math.sin(time * 3) * 0.06;
}

/* ---------- 맞히기·조준 (life.addTargets) ---------- */
const targets = {
  hitTest(p, tg, dmg) {
    for (const d of list) {
      if (d.state !== 'come' && d.state !== 'smoke') continue;
      const vx = tg.vel.x * 0.1, vz = tg.vel.z * 0.1, vl = vx * vx + vz * vz;
      let u = vl > 1e-6 ? ((d.pos.x - (p.x - vx)) * vx + (d.pos.z - (p.z - vz)) * vz) / vl : 1; u = u < 0 ? 0 : u > 1 ? 1 : u;
      if (Math.hypot(p.x - vx * (1 - u) - d.pos.x, p.z - vz * (1 - u) - d.pos.z) >= S.hitR || p.y > d.pos.y + d.h + 0.1 || p.y < d.pos.y - 0.3) continue;
      d.hp = Math.max(0, d.hp - dmg); tg.vel.set(-tg.vel.x * 0.3, 2.5, -tg.vel.z * 0.3);
      if (d.hp <= 0) repel(d);
      return true;
    }
    return false;
  },
  aimTargets(out) {
    for (const d of list) {
      if (d.state !== 'come' && d.state !== 'smoke') continue;
      if (!d.aim) d.aim = { kind: 'smoker', pos: d.pos, h: d.h * 0.55, size: S.hitR, vel: new THREE.Vector3(), ok: () => list.includes(d) && (d.state === 'come' || d.state === 'smoke') };
      d.aim.vel.set(Math.sin(d.heading) * d.speed, 0, Math.cos(d.heading) * d.speed); out.push(d.aim);
    }
  },
};
if (CH && trash) life.addTargets(targets);

/* ---------- 매 프레임 (dumpers.update 를 감쌈) ---------- */
function tickSmoker(dt, time) {
  if (!CH || !trash || state.cine) return;
  const near = Math.hypot(player.pos.x - CH.center.x, player.pos.z - CH.center.z) < S.playerR;
  const ok = state.sessionOn && !late.tut?.active && !!save.tut?.done && near;
  if (ok && !list.length && (timer -= dt) <= 0) { timer = nextT(); spawn(); }
  for (let i = list.length - 1; i >= 0; i--) tick(list[i], dt, time);
  tickPuffs(dt); tickButts(dt); warnEl.update(dt);
}
if (dumpers) { const u0 = dumpers.update; dumpers.update = (dt, time) => { u0(dt, time); tickSmoker(dt, time); }; }

/* ---------- 확인용 (window.__oreum.smoker) ---------- */
// spawn(): 바로 한 명(플레이어 위치와 상관없이), hit(): 맞힌 것처럼, state(), butts(), timer
late.smoker = {
  spawn: () => { const d = spawn(); return d ? { x: +d.at[0].toFixed(1), z: +d.at[1].toFixed(1) } : null; },
  hit: () => { const d = list.find((q) => q.state === 'come' || q.state === 'smoke'); if (!d) return false; d.hp = 0; repel(d); return true; },
  leave: () => { const d = list[0]; if (d && (d.state === 'come' || d.state === 'smoke')) { d.state = 'smoke'; d.pos.set(d.at[0], d.pos.y, d.at[1]); d.st = S.stay; } },
  state: () => list.map((d) => ({ state: d.state, st: +d.st.toFixed(1), x: Math.round(d.pos.x), z: Math.round(d.pos.z) })),
  butts: () => butts.map((b) => [+b.m.position.x.toFixed(1), +b.m.position.z.toFixed(1)]),
  go: () => { if (!CH) return; player.pos.set(CH.front.x, height(CH.front.x, CH.front.z), CH.front.z); },
  get timer() { return timer; }, set timer(v) { timer = v; },
};
