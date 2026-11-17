// HP·쓰러짐·들것 귀환 (#36). 전투 오름에서만 (enabled() 가 false 면 아무 일도 안 함)
// 순서: 받힘(hit) → HP 0 이면 pending → 넉백이 끝나면 begin → 뒤로 쓰러짐 → 화면이 어두워짐 → 들것 든 두 사람이 와서 싣고 감
// → 시작 지점에서 대기(원형 게이지·숫자) → 일어남, HP 가득. 귤·장비·배낭 속 쓰레기는 건드리지 않는다
// 대기 시간 기록은 save.hpDown = { n: 대기 칸 번호, at: 마지막으로 쓰러지거나 일어난 시각(ms) }
import * as THREE from 'three';
import { gradHard } from './toon.js';
import { HP } from './balance.js';

const toon = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: gradHard });
const ss = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const LIE = 1.5; // 누운 각도
const HALF = 1.6; // 들것 가운데에서 든 사람까지
const FOOT = 0.85; // 들것 가운데에서 누운 사람 발까지
const RING = 2 * Math.PI * 40;
// 들것 든 사람: 지금 그림체 캐릭터, 흰 옷(조끼 대신 흰 재킷)·흰 모자
const CREW_OUTFIT = (base) => ({ ...base, hat: { type: 'cap', color: '#ecebe4', back: false }, shirt: { type: 'tee', color: '#f4f3ee' }, pants: { ...base.pants, color: '#3d4352' }, shoes: { ...base.shoes, color: '#2a2a30' }, gear: { back: 'back:none', hand: 'hand:none' } });

export function createHp({ scene, height, buildRunner, outfit, save, persist, start, startHeading, el, enabled, onDown, onUp, regenMul, maxMul }) {
  const MAX = () => HP.max * (maxMul ? maxMul() : 1); // 티셔츠(#52) 최대 HP
  let hp = MAX(), sinceHit = 99, pending = false, down = null, flashT = 0;
  if (!save.hpDown || typeof save.hpDown !== 'object') save.hpDown = {};
  const D = save.hpDown;
  D.n = Number.isFinite(D.n) ? Math.max(-1, Math.min(HP.waits.length - 1, Math.floor(D.n))) : -1;
  D.at = Number(D.at) || 0;
  const lie = { ang: 0, y: 0 }; // 플레이어 몸 눕힘 (main placeRunner 가 씀)

  // ---- 들것과 두 사람 (처음 쓰러질 때 만듦) ----
  let crew = null;
  function build() {
    const mk = () => { const r = buildRunner(); r.apply(CREW_OUTFIT(outfit)); r.root.visible = false; scene.add(r.root); return r; };
    const st = new THREE.Group();
    const wood = toon('#8a6038'), cloth = toon('#e3dac4'), red = toon('#d2453a');
    const pole = new THREE.BoxGeometry(0.06, 0.06, 2.9);
    for (const x of [-0.31, 0.31]) { const m = new THREE.Mesh(pole, wood); m.position.x = x; m.castShadow = true; st.add(m); }
    const bed = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.025, 2.0), cloth); bed.castShadow = bed.receiveShadow = true; st.add(bed);
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.08), red), c2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.26), red);
    c1.position.set(0, 0.003, -0.72); c2.position.copy(c1.position); st.add(c1, c2); // 발 쪽 십자 표시
    st.visible = false; scene.add(st);
    crew = { a: mk(), b: mk(), st, t: 0, leave: 0, ux: 0, uz: 1 };
  }
  // 들것 가운데 s, 방향 u(+면 a 쪽), 높이 y. a 는 s+u·HALF, b 는 s−u·HALF. dirSign +1 이면 u 쪽으로 걸음
  const _s = new THREE.Vector3();
  function placeCrew(dt, sx, sz, ux, uz, y, speed, dirSign, holding) {
    const { a, b, st } = crew;
    crew.t += dt;
    const gy = height(sx, sz);
    st.visible = a.root.visible = b.root.visible = true;
    st.position.set(sx, gy + y, sz); st.rotation.set(0, Math.atan2(ux, uz), 0);
    const hA = dirSign > 0 ? Math.atan2(ux, uz) : Math.atan2(-ux, -uz);
    for (const [r, k] of [[a, 1], [b, -1]]) {
      const x = sx + ux * HALF * k, z = sz + uz * HALF * k;
      r.root.position.set(x, height(x, z), z);
      r.root.rotation.y = holding ? hA : Math.atan2(-ux * k, -uz * k); // 놓았을 땐 들것 쪽을 봄
      const front = k === dirSign; // 걷는 쪽 앞사람은 손이 뒤로
      r.animate(dt, { speed, running: false, pose: holding ? 'carry' : 'move', t: crew.t, air: false, jumpV: 0, carry: front ? 1 : -1 });
    }
  }
  function hideCrew() { if (!crew) return; crew.a.root.visible = crew.b.root.visible = crew.st.visible = false; crew.leave = 0; }

  // ---- 화면 ----
  let lastPct = -1, lastShow = null, lastNum = -1, lastDown = false;
  function setDim(v) { el.dim.style.opacity = v.toFixed(3); el.dim.hidden = v <= 0.002; }
  function ui(dt) {
    const show = enabled();
    if (show !== lastShow) { lastShow = show; el.bar.hidden = !show; document.body.classList.toggle('hp-on', show); }
    if (!show) return;
    const pct = Math.round((hp / MAX()) * 1000) / 10;
    if (pct !== lastPct) { lastPct = pct; el.fill.style.width = pct + '%'; el.bar.classList.toggle('low', hp > 0 && hp <= HP.low); el.bar.setAttribute('aria-valuenow', String(Math.round(hp))); el.bar.setAttribute('aria-valuemax', String(Math.round(MAX()))); }
    if (flashT > 0) { flashT -= dt; if (flashT <= 0) el.bar.classList.remove('hit'); }
    const isDown = !!down;
    if (isDown !== lastDown) { lastDown = isDown; document.body.classList.toggle('hp-down', isDown); }
    const waiting = down && down.ph === 'wait';
    el.wait.hidden = !waiting;
    if (waiting) {
      const left = Math.max(0, down.wait - down.t), num = Math.ceil(left);
      el.ring.setAttribute('stroke-dashoffset', (RING * (left / down.wait)).toFixed(1));
      if (num !== lastNum) { lastNum = num; el.num.textContent = String(num); }
    } else lastNum = -1;
  }

  function hit(dmg) {
    if (!enabled() || down || pending) return false;
    hp = Math.max(0, hp - dmg); sinceHit = 0;
    el.bar.classList.remove('hit'); void el.bar.offsetWidth; el.bar.classList.add('hit'); flashT = 0.6;
    if (hp <= 0) pending = true;
    return pending;
  }

  // 쓰러짐 시작. h0: 지금 몸이 눕는 방향에 맞춘 heading (넉백 중이면 그 방향), ang0: 이미 누운 정도
  function begin(P, h0 = P.heading, ang0 = 0) {
    pending = false;
    const now = Date.now(), fresh = D.n < 0 || !D.at || now - D.at > HP.resetSec * 1000;
    D.n = fresh ? 0 : Math.min(HP.waits.length - 1, D.n + 1); D.at = now; persist();
    let ux = start.x - P.pos.x, uz = start.z - P.pos.z; const L = Math.hypot(ux, uz);
    if (L < 1) { ux = -Math.sin(h0); uz = -Math.cos(h0); } else { ux /= L; uz /= L; }
    // 머리가 u(시작 지점) 쪽으로 가게 뒤로 눕는다: 앞 = −u
    const h1 = Math.atan2(-ux, -uz);
    down = { ph: 'fall', t: 0, wait: HP.waits[D.n], ux, uz, h0, h1, ang0: Math.min(LIE, ang0), fx: P.pos.x, fz: P.pos.z, cx: P.pos.x + ux * FOOT, cz: P.pos.z + uz * FOOT, dim: 0 };
    P.knock = null; P.air = false; P.jumpY = 0; P.jumpV = 0; P.kb.set(0, 0, 0); P.target = null; P.onArrive = null; P.speed = 0; P.running = false; P.pose = 'move'; P.heading = h0;
    lie.ang = down.ang0;
    if (!crew) build();
    hideCrew();
    onDown?.(down.wait);
  }
  // 넉백(#32)이 끝나고 땅에 누운 뒤에 쓰러짐을 시작. 넉백이 없으면 바로
  function tryBegin(P, rollT) {
    if (!pending || down) return;
    if (!enabled()) { pending = false; hp = MAX(); return; }
    const k = P.knock;
    if (P.air) return;
    if (k) { if (k.land < 0 || k.t - k.land < rollT) return; begin(P, Math.atan2(k.az, -k.ax), k.ang); return; }
    begin(P);
  }

  function setFeet(P, x, z) { P.pos.set(x, height(x, z), z); }
  function step(dt, P) {
    const d = down; d.t += dt;
    const { ux, uz } = d;
    if (d.ph === 'fall') {
      const u = d.t / HP.fallT;
      lie.ang = d.ang0 + (LIE - d.ang0) * ss(u); lie.y = 0.18 * ss(u);
      P.heading = d.h0 + wrapA(d.h1 - d.h0) * ss(u / 0.7);
      d.dim = HP.dim * ss(u);
      setFeet(P, d.fx, d.fz);
      if (u >= 1) { P.heading = d.h1; d.ph = 'come'; d.t = 0; d.comeT = Math.min(HP.comeMax, HP.comeFrom / HP.comeSpeed); }
    } else if (d.ph === 'come') { // 빈 들것을 들고 시작 지점 쪽에서 걸어옴 (b 가 앞)
      const u = Math.min(1, d.t / d.comeT), dist = HP.comeFrom * (1 - u);
      placeCrew(dt, d.cx + ux * dist, d.cz + uz * dist, ux, uz, HP.poleY, u < 1 ? HP.comeFrom / d.comeT : 0, -1, true);
      if (u >= 1) { d.ph = 'load'; d.t = 0; }
    } else if (d.ph === 'load') { // 들것을 내려 싣고 다시 듦
      const u = d.t / HP.loadT, sy = u < 0.5 ? HP.poleY + (0.14 - HP.poleY) * ss(u * 2) : 0.14 + (HP.poleY - 0.14) * ss(u * 2 - 1);
      lie.y = u < 0.5 ? 0.18 : Math.max(0.18, sy + 0.12); // 내려온 들것에 실린 뒤 같이 올라감
      placeCrew(dt, d.cx, d.cz, ux, uz, sy, 0, u < 0.5 ? -1 : 1, true);
      if (u >= 1) { d.ph = 'carry'; d.t = 0; }
    } else if (d.ph === 'carry') { // a 가 앞장서 시작 지점 쪽으로 싣고 감
      const u = Math.min(1, d.t / HP.carryT), go = HP.carrySpeed * d.t;
      const sx = d.cx + ux * go, sz = d.cz + uz * go;
      placeCrew(dt, sx, sz, ux, uz, HP.poleY + Math.sin(d.t * 9) * 0.015, HP.carrySpeed, 1, true);
      setFeet(P, sx - ux * FOOT, sz - uz * FOOT); lie.y = HP.poleY + 0.12;
      d.dim = HP.dim + (1 - HP.dim) * ss(u);
      if (u >= 1) { d.ph = 'black'; d.t = 0; arrive(P); }
    } else if (d.ph === 'black') {
      d.dim = 1; placeIdle(dt);
      if (d.t >= HP.blackT) { d.ph = 'wait'; d.t = 0; }
    } else if (d.ph === 'wait') { // 시작 지점에서 들것에 누워 기다림
      d.dim = 1 + (HP.waitDim - 1) * ss(d.t / HP.fadeInT); placeIdle(dt);
      if (d.t >= d.wait) { d.ph = 'rise'; d.t = 0; hp = MAX(); }
    } else if (d.ph === 'rise') {
      const u = d.t / HP.riseT;
      lie.ang = LIE * (1 - ss(u)); lie.y = 0.26 * (1 - ss(u));
      d.dim = HP.waitDim * (1 - ss(u)); placeIdle(dt);
      if (u >= 1) finish(P);
    }
    setDim(d.dim);
  }
  // 시작 지점으로 옮김: 발이 시작 지점, 시작 방향을 보고 누움. 들것은 땅에, 두 사람은 양옆(머리·발 쪽)에 섬
  function arrive(P) {
    const d = down;
    d.ux = -Math.sin(startHeading); d.uz = -Math.cos(startHeading);
    d.fx = start.x; d.fz = start.z; d.cx = start.x + d.ux * FOOT; d.cz = start.z + d.uz * FOOT;
    P.heading = startHeading; setFeet(P, d.fx, d.fz); lie.ang = LIE; lie.y = 0.26;
    P.visY = P.pos.y; P.prevX = P.pos.x; P.prevY = P.pos.y; P.prevZ = P.pos.z;
  }
  function placeIdle(dt) { placeCrew(dt, down.cx, down.cz, down.ux, down.uz, 0.14, 0, 1, false); }
  function finish(P) {
    const d = down; down = null; lie.ang = 0; lie.y = 0; setDim(0);
    D.at = Date.now(); persist();
    P.pose = 'move'; P.poseT = 0;
    if (crew) { crew.leave = HP.leaveT; crew.ux = -d.ux; crew.uz = -d.uz; crew.sx = d.cx; crew.sz = d.cz; } // 빈 들것을 들고 떠남
    onUp?.();
  }
  function tickLeave(dt) {
    if (!crew || crew.leave <= 0) return;
    crew.leave -= dt;
    const go = (HP.leaveT - crew.leave) * HP.carrySpeed * 1.2;
    placeCrew(dt, crew.sx + crew.ux * (go + HALF), crew.sz + crew.uz * (go + HALF), crew.ux, crew.uz, HP.poleY, HP.carrySpeed * 1.2, 1, true);
    if (crew.leave <= 0) hideCrew();
  }

  function update(dt, P) {
    if (!enabled()) { if (down) { finish(P); hideCrew(); } pending = false; hp = MAX(); ui(dt); return false; }
    sinceHit += dt;
    if (hp > MAX()) hp = MAX(); // 티셔츠를 갈아입어 최대 HP 가 줄었을 때
    if (!down && !pending && hp < MAX() && sinceHit >= HP.regenDelay) hp = Math.min(MAX(), hp + HP.regen * (regenMul ? regenMul() : 1) * dt); // 식사 버프(#50)
    if (down) step(dt, P);
    tickLeave(dt);
    ui(dt);
    return !!down;
  }

  return {
    hit, tryBegin, update, lie,
    get hp() { return hp; }, get max() { return MAX(); }, get isDown() { return !!down; }, get pending() { return pending; },
    get phase() { return down ? down.ph : pending ? 'pending' : null; },
    get waitSec() { return down ? down.wait : null; },
    get streak() { return D.n; },
    // 확인용
    set(v) { hp = Math.max(0, Math.min(MAX(), Number(v) || 0)); if (hp <= 0 && enabled() && !down) pending = true; },
    kill() { if (!enabled() || down) return false; hp = 0; pending = true; return true; },
    resetStreak() { D.n = -1; D.at = 0; persist(); },
  };
}
