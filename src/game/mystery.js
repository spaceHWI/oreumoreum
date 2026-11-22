// 미스터리 장치 1 (#212): 되풀이되는 숫자 4:04 와 굼부리 관리 초소 금고. 흔적(발자국·크롭서클·뒤돌아보면)은 game/traces.js
// - 4:04 가 나오는 곳(설명 없이): 오름 방송(관리 안내, punkworld pickLine), 쪽지(영수증·동굴 수거 일정표·금고 인수인계서), 가게 거리 멈춘 시계,
//   가로등 번호판 '404', 마차 정류장 시간표 한 줄, 그리고 실제 시각 04:04 (그 1분 동안 가까운 더미에서 먼지가 일고, 단계 humStage 부터 먼 웅웅)
//   본 곳을 save.myst.seen 에 모음. MYST.num.say 곳 이상 보면 혼잣말 '또 4시 4분이네.' 한 번(감독 #176 을 거침). 답을 알려 주는 UI·퀘스트 표시는 없음
// - 금고: 굼부리 관리 초소(표지석 곁 작은 초소) 안 4자리 다이얼. 답 MYST.safe.code. 틀리면 '딸깍… 아니다.' 만(벌·힌트 없음)
//   열면 귤 MYST.safe.gyul(서버 earn.js 가 save.myst.safe 로 계정마다 한 번 인정, #188) + 전리품 하나(dropLoot 'treasure') + 쪽지 n404 + 칭호 '눈썰미'
// - 내 화면에만 (멀티로 보내지 않음). 저장 save.myst = { seen: [곳], said, safe, rad: [들은 관리 안내 번호(punkworld)], tr: {흔적, traces.js}, crop }
// 파일 순서는 summit 뒤 (src/modules.js: 표지석 자리·쪽지·칭호가 다 있음). dev: __oreum.myst
import * as THREE from 'three';
import { MYST, CART } from '../balance.js';
import { MYST_TEXT as T, NOTES } from '../punktext.js';
import { height } from '../world.js';
import { nsAlong } from '../namsongi.js';
import { STREET } from '../streetlayout.js';
import { gradHard } from '../toon.js';
import { revealStage } from '../ufoveil.js';
import { state, late } from './state.js';
import { $, save, persist, MAP_ID } from './save.js';
import { scene, spots } from './scene.js';
import { P as PH, summitOut, summitTan, player, trash, col, street } from './place.js';
import { ach, addCoins, PANELS, panelOpen, openDex } from './hud.js';
import { interactables } from './stores.js';
import { dropLoot } from './loot.js';
import { sound } from './hooks.js';

const N = MYST.num, SF = MYST.safe;
const NS = MAP_ID === 'namsongi';
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
export function mystSave() {
  if (!isObj(save.myst)) save.myst = {};
  const m = save.myst;
  m.seen = Array.isArray(m.seen) ? m.seen.filter((x) => typeof x === 'string').slice(0, 24) : [];
  m.said = m.said ? 1 : 0; m.safe = m.safe ? 1 : 0;
  if (!isObj(m.tr)) m.tr = {};
  return m;
}
mystSave();
const has404 = (t) => typeof t === 'string' && (t.includes('04:04') || t.includes('4시 4분'));
const NOTE404 = NOTES.filter((n) => has404(n.b) || has404(n.t)).map((n) => n.id);

// 본 곳 하나 더함. say 곳 이상이면 혼잣말 한 번 (혼잣말을 껐으면 그냥 지나감)
function seen(id) {
  const m = mystSave(); if (m.seen.includes(id)) return false;
  m.seen.push(id); persist();
  late.mystDex?.();
  return true;
}
function trySay() {
  const m = mystSave(); if (m.said || m.seen.length < N.say) return;
  m.said = 1; persist(); late.mutterEv?.('num404');
}

/* ---------- 모양 (로우폴리, 지금 그림체) ---------- */
const tm = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: gradHard });
const G = new THREE.Group(); G.name = 'myst'; scene.add(G);
// 글자 판: 캔버스에 줄들을 그린 판 (앞뒤 두 장)
function plate(lines, { w = 0.5, h = 0.3, bg = '#f3ecd6', fg = '#2a2722', px = 64 } = {}) {
  const c = document.createElement('canvas'); c.width = 256; c.height = Math.round(256 * h / w);
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const lh = c.height / (lines.length + 0.6);
  lines.forEach((l, i) => { g.font = `${i === 0 && lines.length > 1 ? 800 : 700} ${lines.length > 1 ? Math.min(px, lh * 0.62) : px}px "Noto Sans KR", sans-serif`; g.fillText(l, c.width / 2, lh * (i + 0.8)); });
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 2;
  const m = new THREE.MeshBasicMaterial({ map: tex }), geo = new THREE.PlaneGeometry(w, h), o = new THREE.Group();
  const a = new THREE.Mesh(geo, m), b = new THREE.Mesh(geo, m); b.rotation.y = Math.PI; a.position.z = 0.012; b.position.z = -0.012; o.add(a, b);
  return o;
}
const spotsSeen = []; // { id, x, z }

// 1) 가게 거리 멈춘 시계: 기둥 + 둥근 판(바늘이 4:04)
if (NS && street) {
  const [s0, side] = N.clock, p = STREET.P(s0, side * 3.55), y = height(p.x, p.z), g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.1, 7), tm('#3b3f3c')); pole.position.y = 1.55; g.add(pole);
  const face = new THREE.Group(); face.position.y = 3.15; g.add(face);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 18), tm('#3b3f3c')); rim.rotation.x = Math.PI / 2; face.add(rim);
  const dial = tm('#f4eedc'), hand = tm('#232220');
  for (const k of [1, -1]) {
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.36, 18), dial); d.position.z = 0.065 * k; if (k < 0) d.rotation.y = Math.PI; face.add(d);
    const hh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.012), hand), mh = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.012), hand);
    const ah = -(4 + 4 / 60) / 12 * Math.PI * 2 * k, am = -4 / 60 * Math.PI * 2 * k; /* 시침 4시 4분 자리, 분침 4분 */
    hh.geometry.translate(0, 0.1, 0); mh.geometry.translate(0, 0.15, 0); hh.rotation.z = ah; mh.rotation.z = am; hh.position.z = mh.position.z = 0.075 * k; face.add(hh, mh);
  }
  g.position.set(p.x, y, p.z); g.rotation.y = Math.atan2(STREET.ax, STREET.az); G.add(g);
  col?.add(p.x, p.z, 0.25);
  spotsSeen.push({ id: 'clock', x: p.x, z: p.z });
}
// 2) 가로등 번호판 '404'
if (NS && spots.lamps?.length) {
  const L = spots.lamps[Math.min(N.lamp, spots.lamps.length - 1)], x = L[0], z = L[1], pl = plate([T.lamp], { w: 0.34, h: 0.18, bg: '#e9e4d2', px: 110 });
  pl.position.set(x, height(x, z) + 1.75, z); pl.rotation.y = Math.atan2(player.pos.x - x, player.pos.z - z); /* 처음 선 자리(들머리) 쪽을 봄 */
  pl.translateZ(0.13); G.add(pl);
  spotsSeen.push({ id: 'lamp', x, z });
}
// 3) 마차 정류장 시간표 (맨 아래 한 줄이 04:04)
if (NS && CART?.stops?.[N.stop]) {
  const S = CART.stops[N.stop], sd = S.path === 'approach' ? 1 : -1, q = nsAlong(S.path, S.d + 2.4, sd, CART.side + 0.4), y = height(q.x, q.z), g = new THREE.Group();
  const leg = tm('#5a4a3a'); for (const k of [-0.3, 0.3]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.5, 0.07), leg); l.position.set(k, 0.75, 0); g.add(l); }
  const pl = plate([T.stopT, ...T.stop], { w: 0.72, h: 0.9, bg: '#f6f1e2', px: 46 }); pl.position.y = 1.45; g.add(pl);
  g.position.set(q.x, y, q.z); g.rotation.y = q.dir + Math.PI / 2; /* 판이 길을 봄 (앞뒤 두 장) */ G.add(g);
  spotsSeen.push({ id: 'stop', x: q.x, z: q.z });
}

/* ---------- 금고: 굼부리 관리 초소 ---------- */
const SAFE_ON = NS && !!PH?.stone;
const hutPos = SAFE_ON ? PH.stone.clone().addScaledVector(summitOut, SF.out).addScaledVector(summitTan, SF.tan) : new THREE.Vector3(1e9, 0, 1e9);
hutPos.y = height(hutPos.x, hutPos.z);
let door = null;
if (SAFE_ON) {
  const g = new THREE.Group(), wall = tm('#b9b2a0'), roof = tm('#56605a'), dark = tm('#2d302e'), steel = tm('#6d7370');
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.1, 1.8), wall); body.position.y = 1.05; g.add(body);
  const rf = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 2.2), roof); rf.position.y = 2.18; rf.rotation.x = 0.06; g.add(rf);
  const open = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.5, 0.05), dark); open.position.set(0, 0.95, 0.91); g.add(open); /* 문 없는 앞(안이 어둑) */
  const safe = new THREE.Group(); safe.position.set(0.25, 0, 0.55); g.add(safe);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.75, 0.6), steel); box.position.y = 0.38; safe.add(box);
  door = new THREE.Group(); door.position.set(-0.35, 0.38, 0.31); safe.add(door);
  const dp = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.7, 0.05), tm('#7d8380')); dp.position.x = 0.35; door.add(dp);
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 12), dark); dial.rotation.x = Math.PI / 2; dial.position.set(0.35, 0.05, 0.04); door.add(dial);
  const sign = plate([T.hut], { w: 1.4, h: 0.26, bg: '#eae3cc', px: 40 }); sign.position.set(0, 1.85, 0.92); g.add(sign);
  g.position.copy(hutPos); g.rotation.y = Math.atan2(PH.stone.x - hutPos.x, PH.stone.z - hutPos.z); G.add(g);
  col?.add(hutPos.x, hutPos.z, 1.3);
  if (mystSave().safe) door.rotation.y = -1.9;
}
const safeAt = SAFE_ON ? hutPos.clone().add(new THREE.Vector3(PH.stone.x - hutPos.x, 0, PH.stone.z - hutPos.z).setLength(1.7)) : hutPos;

// 다이얼 창
const CSS = `
#myst-safe .ms-wrap { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 18px 20px 16px; border-radius: 22px; background: var(--glass-2, rgba(20,20,24,.7)); border: 1px solid var(--hair); color: var(--ink); min-width: min(320px, calc(100vw - 32px)); box-sizing: border-box; }
#myst-safe h2 { margin: 0; font: 800 16px var(--body); color: var(--ink-soft); }
#myst-safe .ms-dials { display: flex; gap: 10px; }
#myst-safe .ms-d { display: flex; flex-direction: column; align-items: center; gap: 4px; }
#myst-safe .ms-d button { width: 52px; height: 40px; border: 0; border-radius: 12px; background: rgba(255,255,255,.1); color: var(--ink); font: 800 18px var(--body); cursor: pointer; }
#myst-safe .ms-d b { width: 52px; height: 64px; display: grid; place-items: center; border-radius: 10px; background: #1d1f1e; color: #f1ead4; font: 800 38px/1 ui-monospace, "SFMono-Regular", Menlo, monospace; box-shadow: inset 0 3px 8px rgba(0,0,0,.6); }
#myst-safe .ms-d b.on { outline: 2px solid var(--gyul); }
#myst-safe .ms-row { display: flex; gap: 10px; }
#myst-safe .ms-row button { height: 44px; min-width: 44px; padding: 0 18px; border: 0; border-radius: 999px; font: 800 15px var(--body); cursor: pointer; background: rgba(255,255,255,.1); color: var(--ink); }
#myst-safe .ms-row .ms-go { background: var(--gyul); color: var(--acc-fg, #2a2722); }
#myst-safe .ms-msg { min-height: 20px; margin: 0; font: 600 14px var(--body); color: var(--ink-soft); }
#myst-safe .ms-wrap.shake { animation: ms-shake .3s; }
@keyframes ms-shake { 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
@media (prefers-reduced-motion: reduce) { #myst-safe .ms-wrap.shake { animation: none; } }
`;
const win = document.createElement('div'); win.className = 'overlay dim'; win.id = 'myst-safe'; win.hidden = true; win.setAttribute('role', 'dialog'); win.setAttribute('aria-modal', 'true');
win.innerHTML = `<style>${CSS}</style><div class="ms-wrap"><h2></h2><div class="ms-dials"></div><p class="ms-msg" aria-live="polite"></p><div class="ms-row"><button type="button" class="ms-x">닫기</button><button type="button" class="ms-go"></button></div></div>`;
document.body.append(win); PANELS.push('myst-safe');
win.querySelector('h2').textContent = T.safeT; win.querySelector('.ms-go').textContent = T.safeOpen;
const digits = [0, 0, 0, 0]; let cur = 0;
const dialsEl = win.querySelector('.ms-dials'), msg = win.querySelector('.ms-msg'), wrap = win.querySelector('.ms-wrap');
digits.forEach((_, i) => {
  const d = document.createElement('div'); d.className = 'ms-d';
  d.innerHTML = `<button type="button" data-k="1" aria-label="${i + 1}번째 칸 올리기">▲</button><b>0</b><button type="button" data-k="-1" aria-label="${i + 1}번째 칸 내리기">▼</button>`;
  d.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { cur = i; turn(i, +b.dataset.k); }));
  dialsEl.append(d);
});
function draw() { dialsEl.querySelectorAll('b').forEach((b, i) => { b.textContent = String(digits[i]); b.classList.toggle('on', i === cur); }); }
function turn(i, k) { digits[i] = (digits[i] + k + 10) % 10; msg.textContent = ''; sound.beep?.(false); draw(); }
function openSafe() {
  if (mystSave().safe || !SAFE_ON) return false;
  digits.fill(0); cur = 0; msg.textContent = ''; draw(); win.hidden = false; win.querySelector('.ms-go').focus?.(); return true;
}
function closeSafe() { win.hidden = true; }
function tryCode(code = digits.join('')) {
  if (mystSave().safe) return 'done';
  if (code !== SF.code) {
    msg.textContent = T.wrong; sound.stone?.();
    if (!matchMedia?.('(prefers-reduced-motion: reduce)').matches) { wrap.classList.remove('shake'); void wrap.offsetWidth; wrap.classList.add('shake'); }
    return 'wrong';
  }
  const m = mystSave(); m.safe = 1; persist(); closeSafe();
  if (door) door.rotation.y = -1.9;
  sound.gate?.();
  addCoins(SF.gyul, T.opened);
  try { dropLoot('treasure', SF.lootZ, safeAt.clone()); } catch (e) { /* 전리품이 없는 맵 */ }
  late.titles?.give('눈썰미'); ach.emit('myst-safe');
  setTimeout(() => late.punkWorld?.note?.give(SF.note, false), 900);
  return 'open';
}
win.querySelector('.ms-go').addEventListener('click', () => tryCode());
win.querySelector('.ms-x').addEventListener('click', closeSafe);
win.addEventListener('keydown', (e) => {
  const k = e.key;
  if (/^[0-9]$/.test(k)) { digits[cur] = +k; cur = (cur + 1) % 4; draw(); e.preventDefault(); }
  else if (k === 'ArrowUp') { turn(cur, 1); e.preventDefault(); } else if (k === 'ArrowDown') { turn(cur, -1); e.preventDefault(); }
  else if (k === 'ArrowLeft') { cur = (cur + 3) % 4; draw(); e.preventDefault(); } else if (k === 'ArrowRight') { cur = (cur + 1) % 4; draw(); e.preventDefault(); }
  else if (k === 'Enter') { tryCode(); e.preventDefault(); } else if (k === 'Escape') { closeSafe(); e.preventDefault(); }
  e.stopPropagation();
});
win.tabIndex = -1;
if (SAFE_ON) interactables.push({ label: T.safe, ic: 'chest', pos: safeAt, r: SF.r, when: () => !mystSave().safe && !state.cine && !panelOpen(), act: () => { openSafe(); win.focus(); return true; } });

/* ---------- 4:04 그 시각 ---------- */
function kstHM() {
  if (state.todOverride != null) { const h = state.todOverride; return [Math.floor(h) % 24, Math.floor((h % 1) * 60 + 1e-6)]; }
  const k = new Date(Date.now() + 9 * 3600000); return [k.getUTCHours(), k.getUTCMinutes()];
}
const isNow = () => { const [h, m] = kstHM(); return h === N.h && m === N.m; };
const puffs = [];
const puffMat = new THREE.SpriteMaterial({ color: '#b9ad92', transparent: true, opacity: 0, depthWrite: false });
function puff(x, z, k = 1) {
  const n = Math.max(2, Math.round(4 * k));
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(puffMat.clone()); const a = Math.random() * Math.PI * 2, r = Math.random() * 1.2;
    s.position.set(x + Math.cos(a) * r, height(x, z) + 0.4 + Math.random() * 0.4, z + Math.sin(a) * r); s.scale.setScalar(0.8 + Math.random() * 0.6); G.add(s);
    puffs.push({ s, t: 0, T: 1.6 + Math.random() * 0.8, vy: 0.4 + Math.random() * 0.4, vx: Math.cos(a) * 0.3, vz: Math.sin(a) * 0.3 });
  }
}
late.mystPuff = puff; /* traces.js 의 '오래 보면' 먼지도 같은 것을 씀 */
let quakeT = 0, quakeOn = false, humT = 0;
function tickQuake(dt) {
  const on = isNow() && state.sessionOn && !state.cave;
  if (on && !quakeOn) { quakeOn = true; quakeT = 0; humT = 0; if (seen('time')) trySay(); }
  if (!on) { quakeOn = false; return; }
  if ((quakeT -= dt) <= 0) {
    quakeT = N.dustEvery[0] + Math.random() * (N.dustEvery[1] - N.dustEvery[0]);
    const near = (trash?.heaps || []).filter((h) => h.st >= 0 && Math.hypot(h.x - player.pos.x, h.z - player.pos.z) < N.dustR);
    for (const h of near.slice(0, 6)) puff(h.x + (Math.random() - 0.5) * (h.r || 1), h.z + (Math.random() - 0.5) * (h.r || 1), 0.7);
  }
  if (revealStage() >= N.humStage && (humT -= dt) <= 0) { humT = 20; sound.ufo?.(); }
}

/* ---------- 본 곳 살피기 (1초마다) ---------- */
let chk = 0;
late.tickMyst = (dt) => {
  state.ticks.myst++;
  for (let i = puffs.length - 1; i >= 0; i--) {
    const p = puffs[i]; p.t += dt; const u = p.t / p.T;
    p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt; p.s.scale.multiplyScalar(1 + dt * 0.5);
    p.s.material.opacity = 0.5 * Math.sin(Math.PI * Math.min(1, u));
    if (u >= 1) { G.remove(p.s); p.s.material.dispose(); puffs.splice(i, 1); }
  }
  if (!state.sessionOn) return;
  tickQuake(dt);
  if ((chk -= dt) > 0) return; chk = 1;
  let add = false;
  for (const s of spotsSeen) if (Math.hypot(s.x - player.pos.x, s.z - player.pos.z) < N.near && seen(s.id)) add = true;
  if (has404(late.punkWorld?.radio?.strip?.()) && seen('radio')) add = true;
  const pk = save.punk?.notes || {}, un = save.punk?.unread || [];
  for (const id of NOTE404) if (pk[id] && !un.includes(id) && seen('note:' + id)) add = true;
  if (add || mystSave().seen.length >= N.say) trySay();
};

late.mystApi = {
  state: () => { const m = mystSave(); return { seen: [...m.seen], said: m.said, safe: m.safe, now404: isNow(), hut: SAFE_ON && { x: +hutPos.x.toFixed(1), z: +hutPos.z.toFixed(1) }, on: !!state.sessionOn, near: spotsSeen.map((x) => +Math.hypot(x.x - player.pos.x, x.z - player.pos.z).toFixed(1)), spots: spotsSeen.map((s) => s.id), notes: NOTE404 }; },
  seen: (id) => { const r = seen(id); trySay(); return r; },
  go: (id = 'safe') => { const s = id === 'safe' ? safeAt : spotsSeen.find((x) => x.id === id); if (!s) return null; const x = s.x + 1.2, z = s.z + 1.2; player.pos.set(x, height(x, z), z); player.visY = player.pos.y; return { x, z }; },
  open: openSafe, close: closeSafe, code: (c) => tryCode(String(c)), shown: () => !win.hidden,
  dex: () => openDex(),
  quake: () => { puff(player.pos.x + 3, player.pos.z, 1); return isNow(); },
  reset: () => { save.myst = {}; mystSave(); persist(); if (door) door.rotation.y = 0; },
};
