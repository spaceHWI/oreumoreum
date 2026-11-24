// 수거 관 (#248): 클린하우스 옆 투입구로 들어가 다른 클린하우스 배출구로 나옴 (같은 투입구가 배출구). 투입구 모양은 #305 Tripo 모델(초록 뚜껑, 입이 위쪽)
// - 열림: 그 클린하우스에 쓰레기를 한 번이라도 버린 곳만 목록에 (save.tube = 가 본 곳 id 목록. 들머리 것은 'gate').
//   옛 저장(save.tube 없음)은 버린 적이 있으면 이미 지난 구역(save.journey.maxZ) 안의 클린하우스로 미루어 채움
// - 값: 탈 때마다 귤 TUBE.drop × 구역 거리(한 칸 이상) × 높은 쪽 구역 gv 를 관 속에 떨굼. 모자라면 가진 만큼(0개여도 탐). 쿨타임 없음
//   귤이 줄기만 하므로 서버(validate.js)는 '번 귤' 이 그만큼 적은 것으로 봄 (가게에서 쓴 귤과 같은 쪽, 따로 인정할 몫 없음)
// - 못 탐: 싸움 중(적이 TUBE.fightR 안·우두머리)·서바이벌 터 판 중·튜토리얼·탈것·마차·노루
// - 연출 2.4초 (건너뛰지 않음): 덮개가 열리며 작아져 빨려 들어감 → 어두운 관 속(줄무늬·위로 올라가는 쓰레기 그림자·뒤로 굴러가는 귤·줄어드는 귤 숫자)
//   → 도착 배출구에서 '퐁'. 자리는 관 속 가운데에서 옮김(도착지가 어두운 화면 뒤에서 미리 그려짐). 나오면 머리에 귤 껍질 TUBE.peel 초
// - 멀티: presence tb = 'i'(빨려 들어감)·'p'(관 속, 옮긴 자리)·'o'(튀어나옴). 서버는 'p'·'o' 가 붙은 순간 이동을 NET.tubeGap 에 한 번 받아 줌 (roomcore.js)
//   남의 화면: room.js rideHook 이 late.tubePeer 를 먼저 불러 작아짐·숨김·튀어나옴
// (파일 순서는 src/modules.js: cases 뒤. 루프는 update.js late.tickTube)
import * as THREE from 'three';
import { TUBE, ZONES } from '../balance.js';
import { buildIntake, INTAKE } from '../tubemodel.js';
import { height } from '../world.js';
import { LOW } from '../gfx2.js';
import { zoneShort, tierColor } from '../zonelook.js';
import { icon } from '../icons.js';
import { state, late } from './state.js';
import { save, persist } from './save.js';
import { scene } from './scene.js';
import { trash, CHS, chNear, player, runner, life, hp, col } from './place.js';
import { toast, closePanels, addCoins, PANELS } from './hud.js';
import { interactables } from './stores.js';
import { cam } from './camera.js';

export const ON = !!(trash && CHS.length > 1);
const T = TUBE.t, TOTAL = T.in + T.pipe + T.out;
const idOf = (c) => c.id || 'gate';
const gvOf = (z) => ZONES.find((Z) => Z.id === z)?.gv || 1;

/* ---------- 투입구 자리 ---------- */
const v3 = new THREE.Vector3();
export const tubes = ON ? CHS.map((c) => {
  const [lx, lz] = c.small ? TUBE.at.mini : TUBE.at.big, rot = c.root.rotation.y, fx = Math.sin(rot), fz = Math.cos(rot);
  c.root.updateMatrixWorld(true); v3.set(lx, 0, lz).applyMatrix4(c.root.matrixWorld); const x = v3.x, z = v3.z;
  let y = 1e9; for (const [a, b] of [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) y = Math.min(y, height(x + a, z + b));
  const m = buildIntake(LOW); m.position.set(x, y - 0.04, z); m.rotation.y = rot; scene.add(m);
  if (col) col.add(x, z, 0.6);
  const front = new THREE.Vector3(x + fx * 1.35, 0, z + fz * 1.35); front.y = height(front.x, front.z);
  const mouth = new THREE.Vector3(x + fx * (INTAKE.front + 0.1), y + INTAKE.holeY, z + fz * (INTAKE.front + 0.1));
  const zone = TUBE.zone[idOf(c)] ?? (trash.zoneAt(c.center.x, c.center.z) || 0);
  return { c, id: idOf(c), zone, m, x, z, front, mouth, rot, lid: 0, lidTo: 0 };
}) : [];
// 이름 = 구역 이름 (들머리는 '들머리'). 한 구역에 둘이면 뒤에 자리 이름
for (const t of tubes) { t.name = t.base = t.zone ? zoneShort(t.zone) : '들머리'; }
for (const t of tubes) if (tubes.some((o) => o !== t && o.base === t.base)) t.name = `${t.base} · ${t.c.name || '들머리'}`;
const byId = (id) => tubes.find((t) => t.id === id) || null;

/* ---------- 저장: 가 본 곳 ---------- */
if (ON) {
  if (!Array.isArray(save.tube)) {
    const mz = save.journey?.maxZ || 0;
    save.tube = (save.recycle?.visits || 0) > 0 ? tubes.filter((t) => t.zone <= mz).map((t) => t.id) : [];
    persist();
  } else save.tube = save.tube.filter((id, i, a) => typeof id === 'string' && a.indexOf(id) === i && !!byId(id));
}
const linked = () => (ON ? save.tube.map(byId).filter(Boolean) : []);
let visits = save.recycle?.visits || 0;
function link(t) {
  if (!t || save.tube.includes(t.id)) return false;
  save.tube.push(t.id); persist();
  const n = save.tube.length;
  if (!late.tut?.active) setTimeout(() => toast(n >= 2 ? `수거 관 연결됨 · 오갈 수 있는 곳 ${n}곳` : '수거 관 연결됨'), 2400); // 버린 토스트(1.9초) 뒤
  return true;
}
const tubeOfCh = (c) => tubes.find((t) => t.c === c) || null;

/* ---------- 값 ---------- */
export const dropOf = (from, to) => TUBE.drop * Math.max(1, Math.abs(to.zone - from.zone)) * gvOf(Math.max(1, from.zone, to.zone));
function whyNot() {
  if (player.ride || player.rideAuto || player.cart || player.riding) return '탈것에서 내려서 타요';
  if (late.swarmOn?.()) return '판이 끝나면 탈 수 있어요';
  if (late.bossFight?.() || life.enemies.near(player.pos, TUBE.fightR)) return '싸우는 중엔 못 타요';
  if (hp.isDown || hp.pending) return '지금은 못 타요';
  return null;
}

/* ---------- 고르는 창 ---------- */
const CSS = `
#tube-pick .pop { width: min(380px, 100%); }
#tube-pick .tp-rows { display: grid; gap: 8px; }
#tube-pick .tp-row { display: grid; grid-template-columns: 10px 1fr auto; align-items: center; gap: 10px; min-height: 52px; padding: 8px 12px; border: 1px solid var(--hair); border-radius: 14px; background: rgba(255,255,255,.06); color: var(--ink); font: 700 15px var(--body); text-align: left; cursor: pointer; }
#tube-pick .tp-row:hover, #tube-pick .tp-row:focus-visible { background: rgba(255,255,255,.12); }
#tube-pick .tp-row i { width: 10px; height: 34px; border-radius: 5px; }
#tube-pick .tp-row small { display: flex; align-items: center; gap: 4px; color: var(--ink-soft); font: 600 12px var(--body); }
#tube-pick .tp-row small svg { width: 14px; height: 14px; }
#tube-pick .tp-row em { font-style: normal; color: var(--ink-soft); font: 700 13px var(--body); }
#tube-ride { position: fixed; inset: 0; z-index: 9; pointer-events: none; opacity: 0; transition: opacity .2s ease; overflow: hidden; background: radial-gradient(circle at 50% 50%, #26221a 0, #0b0c0a 62%); }
#tube-ride.on { opacity: 1; } #tube-ride[hidden] { display: none; }
#tube-ride .tr-st { position: absolute; inset: -40% 0; background: repeating-linear-gradient(180deg, rgba(255,255,255,0) 0 46px, rgba(255,214,150,.09) 46px 62px); animation: tr-st .32s linear infinite; }
#tube-ride .tr-up { position: absolute; bottom: -12%; width: 46px; height: 46px; color: #7a6d55; opacity: .7; filter: blur(.6px); animation: tr-up 1.2s ease-in forwards; }
#tube-ride .tr-up svg { width: 100%; height: 100%; stroke-width: 2.6; }
#tube-ride .tr-gy { position: absolute; left: 50%; top: 58%; width: 30px; height: 30px; color: #ff9a1f; animation: tr-gy .9s ease-in forwards; }
#tube-ride .tr-gy svg, #tube-ride .tr-gy img { width: 100%; height: 100%; }
#tube-ride .tr-n { position: absolute; left: 50%; top: 30%; transform: translateX(-50%); display: flex; align-items: center; gap: 6px; color: #fff; font: 800 22px var(--display); }
#tube-ride .tr-n svg, #tube-ride .tr-n img { width: 26px; height: 26px; color: #ff9a1f; }
@keyframes tr-st { to { transform: translateY(62px); } }
@keyframes tr-up { to { transform: translateY(-130vh) rotate(160deg); } }
@keyframes tr-gy { to { transform: translate(var(--gx), 40vh) rotate(-540deg) scale(.6); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { #tube-ride .tr-st, #tube-ride .tr-up, #tube-ride .tr-gy { animation-duration: 0s; } }
`;
const win = document.createElement('div'); win.className = 'overlay dim'; win.id = 'tube-pick'; win.hidden = true; win.setAttribute('role', 'dialog'); win.setAttribute('aria-modal', 'true');
win.innerHTML = `<style>${CSS}</style><div class="panel pop"><div class="pop-head"><h2>어디로 보낼까요?</h2><button type="button" class="btn small tp-x">닫기</button></div><div class="pop-body tp-rows"></div></div>`;
document.body.append(win); PANELS.push('tube-pick');
win.querySelector('.tp-x').addEventListener('click', () => { win.hidden = true; });
win.addEventListener('click', (e) => { if (e.target === win) win.hidden = true; });
const ride = document.createElement('div'); ride.id = 'tube-ride'; ride.hidden = true; ride.setAttribute('aria-hidden', 'true');
ride.innerHTML = '<div class="tr-st"></div><div class="tr-n"></div>';
document.body.append(ride);

let pickFrom = null;
const rowsOf = (from) => linked().filter((t) => t !== from).map((t) => ({ t, d: Math.round(Math.hypot(t.x - from.x, t.z - from.z) / 10) * 10, n: Math.min(Math.max(0, Math.floor(save.coins)), dropOf(from, t)) })).sort((a, b) => a.t.zone - b.t.zone || a.d - b.d);
function openPick(from) {
  const why = whyNot(); if (why) { toast(why); return; }
  const rows = rowsOf(from);
  if (!rows.length) { toast('아직 갈 곳이 없어요 · 다른 클린하우스에도 버려 봐요'); return; }
  closePanels(); pickFrom = from;
  const box = win.querySelector('.tp-rows'); box.textContent = '';
  for (const r of rows) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tp-row'; b.dataset.id = r.t.id;
    const sw = document.createElement('i'); sw.style.background = r.t.zone ? tierColor(r.t.zone) : '#d9d4c4';
    const mid = document.createElement('span'); const nm = document.createElement('b'); nm.textContent = r.t.name;
    const sm = document.createElement('small'); sm.innerHTML = icon('gyul'); sm.append(r.n > 0 ? `귤 ${r.n}개쯤 떨어져요` : '떨어질 귤이 없어요');
    mid.append(nm, document.createElement('br'), sm);
    const em = document.createElement('em'); em.textContent = `${r.d}m`;
    b.append(sw, mid, em); b.addEventListener('click', () => go(pickFrom, r.t));
    box.append(b);
  }
  win.hidden = false;
}
if (ON) for (const t of tubes) interactables.push({ label: '수거 관', ic: 'tube', pos: t.front, r: TUBE.r, when: () => !run && !state.cine && !late.tut?.active && !state.cave, act: () => openPick(t) });

/* ---------- 타기 ---------- */
let run = null, peel = null, peelT = 0, tb = '', tbT = 0, lastT = 0;
const setTb = (k) => { tb = k; tbT = k === 'o' ? T.out + 0.6 : 0; late.net?.send?.(true); };
late.tubeExtra = () => (tb ? { tb } : {});
function go(from, to) {
  if (!from || !to || run || state.cine) return false;
  const why = whyNot(); if (why) { toast(why); return false; }
  win.hidden = true; closePanels();
  const n = Math.min(Math.max(0, Math.floor(save.coins)), dropOf(from, to));
  run = { from, to, t: 0, n, paid: 0, warped: false, out: false, p0: player.pos.clone(), rolls: [], ups: 0 };
  state.cine = run; player.target = null; player.onArrive = null; player.speed = 0; late.stopAutoGo?.();
  player.heading = Math.atan2(from.mouth.x - player.pos.x, from.mouth.z - player.pos.z);
  from.lidTo = 1; setTb('i');
  if (late.sound?.ctx) late.sound.squelch?.();
  return true;
}
function warpTo(t) {
  const h = t.rot; // 배출구 앞을 봄
  player.pos.set(t.mouth.x, height(t.mouth.x, t.mouth.z), t.mouth.z); player.visY = player.pos.y; player.prevX = player.pos.x; player.prevY = player.pos.y; player.prevZ = player.pos.z;
  player.heading = h; cam.yaw = h + Math.PI; player.target = null; player.speed = 0; player.kb?.set(0, 0, 0);
  late.placeRunner?.(); setTb('p');
}
const rideN = ride.querySelector('.tr-n');
const showCoins = () => { rideN.innerHTML = icon('gyul'); rideN.append(String(Math.floor(save.coins))); };
function pipeFx(r) {
  ride.querySelectorAll('.tr-up, .tr-gy').forEach((e) => e.remove());
  const kinds = ['can', 'bottle', 'vinyl', 'foam'];
  for (let i = 0; i < 4; i++) { const u = document.createElement('div'); u.className = 'tr-up'; u.innerHTML = icon(kinds[i]); u.style.left = (14 + i * 22 + Math.random() * 8) + '%'; u.style.animationDelay = (i * 0.16) + 's'; ride.append(u); } /* 위로 올라가는 쓰레기 그림자 (외계인은 안 보임) */
  const k = Math.min(TUBE.rolls, r.n);
  r.rolls = Array.from({ length: k }, (_, i) => ({ at: 0.15 + (T.pipe - 0.55) * (k > 1 ? i / (k - 1) : 0), done: false, share: i === k - 1 ? r.n - Math.floor(r.n / k) * (k - 1) : Math.floor(r.n / k) }));
  showCoins(); ride.hidden = false; void ride.offsetWidth; ride.classList.add('on');
}
function rollOne(f) {
  const g = document.createElement('div'); g.className = 'tr-gy'; g.innerHTML = icon('gyul'); g.style.setProperty('--gx', ((Math.random() - 0.5) * 60) + 'vw'); ride.append(g);
  const s = Math.min(f.share, run.n - run.paid); if (s > 0) { addCoins(-s); run.paid += s; } showCoins();
}
function finishPay() { const left = run.n - run.paid; if (left > 0) { addCoins(-left); run.paid += left; } }
function putPeel() {
  if (!peel) {
    peel = new THREE.Mesh(new THREE.SphereGeometry(0.2, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.42), new THREE.MeshToonMaterial({ color: '#ff9a1f', side: THREE.DoubleSide }));
    peel.scale.set(1.1, 0.55, 1);
  }
  runner.root.updateMatrixWorld(true);
  const s = runner.root.scale.x; runner.root.scale.setScalar(1); const bb = new THREE.Box3().setFromObject(runner.root); runner.root.scale.setScalar(s);
  peel.position.set(0.05, Math.max(1.4, Math.min(2.6, bb.max.y - runner.root.position.y)) - 0.04, 0); peel.rotation.set(0.15, 0, -0.35);
  runner.root.add(peel); peelT = TUBE.peel;
}
function end() {
  const r = run; if (!r) return; finishPay(); run = null; lastT = r.t; if (state.cine === r) state.cine = null;
  runner.root.scale.setScalar(1); r.to.lidTo = 0; r.from.lidTo = 0;
  ride.classList.remove('on'); setTimeout(() => { if (!run) ride.hidden = true; }, 250);
  toast(r.paid > 0 ? `${r.to.name} 클린하우스에 왔어요 · 귤 ${r.paid}개를 관에 떨궜어요` : `${r.to.name} 클린하우스에 왔어요`);
}
// 남의 화면 (room.js rideHook): 작아지며 들어감 · 관 속은 숨김 · 튀어나옴
const popK = (k) => (k < 0.6 ? 0.2 + 1.0 * (k / 0.6) : 1.2 - 0.2 * ((k - 0.6) / 0.4));
late.tubePeer = (e, dt) => {
  const k0 = typeof e.data.tb === 'string' ? e.data.tb : '';
  if (!k0) { if (e.tbS != null) { e.runner.root.scale.setScalar(1); e.tbS = null; e.tbK = ''; } return null; }
  if (k0 !== e.tbK) { e.tbK = k0; e.tbT = 0; if (k0 !== 'i') e.pos.copy(e.tpos); }
  e.tbT += dt;
  let s = 1, lift = 0;
  if (k0 === 'i') { const k = Math.min(1, e.tbT / T.in); s = Math.max(0.02, 1 - k); lift = k * 0.6; }
  else if (k0 === 'p') s = 0.001;
  else { const k = Math.min(1, e.tbT / T.out); s = popK(k); lift = Math.sin(k * Math.PI) * 0.7; }
  e.runner.root.scale.setScalar(s); e.tbS = s;
  return { pose: 'move', lift, still: true };
};

/* ---------- 루프 ---------- */
const lidMorph = (t, dt) => { if (t.lid === t.lidTo) return; t.lid = t.lidTo > t.lid ? Math.min(t.lidTo, t.lid + dt * 6) : Math.max(t.lidTo, t.lid - dt * 3); t.m.morphTargetInfluences[0] = t.lid; };
late.tickTube = (dt) => {
  state.ticks.tube = (state.ticks.tube || 0) + 1;
  if (!ON) return;
  for (const t of tubes) lidMorph(t, dt);
  // 버리면 그 클린하우스가 연결됨 (dump.js dumpBag 이 visits 를 늘림)
  const vn = save.recycle?.visits || 0; if (vn > visits) { visits = vn; link(tubeOfCh(chNear())); } else if (vn < visits) visits = vn;
  if (tb && tbT > 0 && (tbT -= dt) <= 0) setTb('');
  if (peelT > 0 && (peelT -= dt) <= 0 && peel) runner.root.remove(peel);
  const r = run; if (!r) return;
  if (state.cine !== r) { run = null; finishPay(); runner.root.scale.setScalar(1); ride.classList.remove('on'); ride.hidden = true; setTb(''); return; } // 다른 장면이 가로챔
  r.t += dt;
  const f = r.from, t = r.to;
  if (r.t < T.in) { // 빨려 들어감: 구멍 쪽으로 다가가며 작아짐
    const k = r.t / T.in, e = k * k;
    player.pos.x = r.p0.x + (f.mouth.x - r.p0.x) * e; player.pos.z = r.p0.z + (f.mouth.z - r.p0.z) * e;
    runner.root.position.set(player.pos.x, player.visY + (f.mouth.y - 0.5 - player.visY) * e, player.pos.z);
    runner.root.scale.setScalar(Math.max(0.03, 1 - k * 0.97));
    if (k > 0.55 && !r.fx) { r.fx = true; pipeFx(r); }
    return;
  }
  const u = r.t - T.in;
  if (u < T.pipe) { // 관 속
    runner.root.scale.setScalar(0.001);
    for (const q of r.rolls) if (!q.done && u >= q.at) { q.done = true; rollOne(q); }
    if (!r.warped && u >= T.pipe * 0.4) { r.warped = true; f.lidTo = 0; warpTo(t); t.lidTo = 1; }
    if (u > T.pipe - 0.2 && ride.classList.contains('on')) ride.classList.remove('on');
    return;
  }
  // 튀어나옴: 배출구에서 앞으로 작게 뜀
  if (!r.out) { r.out = true; setTb('o'); if (late.sound?.ctx) late.sound.plop?.(); putPeel(); setTimeout(() => { if (!run) ride.hidden = true; }, 250); }
  const k = Math.min(1, (u - T.pipe) / T.out);
  player.pos.x = t.mouth.x + (t.front.x - t.mouth.x) * k * 0.8; player.pos.z = t.mouth.z + (t.front.z - t.mouth.z) * k * 0.8; player.pos.y = height(player.pos.x, player.pos.z); player.visY = player.pos.y;
  runner.root.position.set(player.pos.x, player.visY + Math.sin(k * Math.PI) * 0.9 + (1 - k) * (t.mouth.y - 0.6 - player.visY) * 0.5, player.pos.z);
  runner.root.scale.setScalar(popK(k));
  if (k >= 1) { t.lidTo = 0; end(); }
};

// 확인용 (__oreum.tube, tools/tuberun.js)
late.tubeApi = {
  on: ON, total: TOTAL,
  list: () => tubes.map((t) => ({ id: t.id, name: t.name, zone: t.zone, x: +t.x.toFixed(1), z: +t.z.toFixed(1), fx: +t.front.x.toFixed(1), fz: +t.front.z.toFixed(1), linked: save.tube.includes(t.id) })),
  linked: () => [...save.tube],
  link: (id) => link(byId(id)),
  reset: (ids = []) => { save.tube = ids.filter((id) => !!byId(id)); persist(); },
  stand: (id) => { const t = byId(id); if (!t) return false; player.pos.copy(t.front); player.pos.y = height(t.front.x, t.front.z); player.heading = t.rot + Math.PI; player.target = null; return true; },
  act: (id) => interactables.find((i) => i.pos === byId(id)?.front),
  open: (id) => openPick(byId(id)),
  rows: () => (!win.hidden ? [...win.querySelectorAll('.tp-row')].map((b) => ({ id: b.dataset.id, text: b.textContent })) : null),
  choose: (id) => { const b = [...win.querySelectorAll('.tp-row')].find((x) => x.dataset.id === id); if (b) b.click(); return !!b; },
  drop: (a, b) => dropOf(byId(a), byId(b)),
  state: () => ({ run: run && { from: run.from.id, to: run.to.id, t: +run.t.toFixed(2), n: run.n, paid: run.paid, warped: run.warped }, tb, peel: peelT > 0, lastT: +lastT.toFixed(2), pick: !win.hidden, ride: !ride.hidden, cine: !!state.cine, lid: tubes.map((t) => +t.lid.toFixed(2)), coins: save.coins }),
  whyNot,
  show: (v) => tubes.forEach((t) => { t.m.visible = v; }), // draw call 재기
  props: () => tubes.map((t) => ({ id: t.id, lid: +t.m.morphTargetInfluences[0].toFixed(2), ...t.m.userData.prop.loaded })), /* #305 Tripo 투입구 */
  lid: (id, v) => { const t = byId(id); if (t) t.lidTo = v; return !!t; },
};
