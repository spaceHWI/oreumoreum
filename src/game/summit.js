// 정상 첫 실마리 (#208): 표지석에 처음 닿으면 짧은 장면 → 표지석 뒤 첫 쪽지 → 퀘스트 '굼부리를 내려다보기' → 감독이 다음 구역 문을 흘림. 표지석 옆 망원경
// - 장면(CLUE.len 초, 건너뛰기): 카메라가 표지석에서 굼부리 쪽으로 천천히 돌고, 굼부리 안쪽 깊은 곳에서 빛이 한 번 깜빡임. 끝나면 혼잣말 '방금… 저 아래에서 뭔가 빛났는데?'
//   싸우는 중·창이 열린 중·다른 안내 중이면 미뤘다가, 표지석 가까이(CLUE.near)에서 조용해지면 보여 줌. 카메라는 엔딩(#168)의 'cine' 자리를 빌려 씀(조작 잠금·적 멈춤)
// - 쪽지: 장면 뒤 표지석 뒤 풀숲에 놓임(punktext.js NOTES 'n0', 쪽지 창은 punkworld·noteview). 읽으면 퀘스트 x-rim 을 받음(주는 사람 없음, game/quest.js auto)
//   전망 자리(굼부리 둘레 길에서 표지석에 가장 가까운 곳)에 닿으면 바로 끝·귤 조금 → 감독 say 로 아직 안 끝낸 가장 앞 구역 쪽 한 줄
// - 망원경: 표지석 옆. 누르면 CLUE.scope.len 초 동안 좁은 시야로 굼부리 → 먼 능선을 훑음. 밤이고 UFO 드러남 단계(#207)가 scope.light.stage 이상이면 먼 불빛 하나 (낮엔 아무것도 없음)
// - 옛 저장(이미 정상·능선에 가 본 저장): 장면 없이 쪽지만 놓여 있고, 읽으면 퀘스트는 지난 것으로(보상 없이). 멀티: 모두 내 화면에서만, 쪽지는 사람마다 한 번
// 저장 save.clue = { s 장면을 봄(옛 저장은 처음부터 1), old 옛 저장, q 쪽지를 읽고 퀘스트를 받음(또는 지난 것으로 함) }
// 파일 순서는 wish 뒤 (src/modules.js: 퀘스트·엔딩·쪽지·혼잣말이 다 있음). dev: __oreum.summit
import * as THREE from 'three';
import { CLUE } from '../balance.js';
import { CLUE_TEXT as T } from '../punktext.js';
import { height } from '../world.js';
import { nsPaths } from '../namsongi.js';
import { gradHard } from '../toon.js';
import { LOW } from '../gfx2.js';
import { revealStage } from '../ufoveil.js';
import { state, late } from './state.js';
import { $, save, persist, MAP_ID } from './save.js';
import { scene, camera, sunState } from './scene.js';
import { P, summitOut, summitTan, player, life, col } from './place.js';
import { cam, camTarget, ease, followCam } from './camera.js';
import { toast, panelOpen, tipMark } from './hud.js';
import { director, say } from './director.js';
import { interactables } from './stores.js';
import { quests } from './quest.js';

const NOTE_ID = 'n0', QID = 'x-rim';
const crater = nsPaths?.crater || [];
const ON = MAP_ID === 'namsongi' && !!P?.stone && crater.length > 2;
const S0 = ON ? P.stone.clone() : new THREE.Vector3();
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const v3 = (x, z, y = 0) => new THREE.Vector3(x, height(x, z) + y, z);
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

/* ---------- 저장 (로그인 뒤 저장이 바뀌어도 맞게 매번 봄) ---------- */
function C() {
  if (!isObj(save.clue)) {
    const L = save.ach?.life || {}, been = !!save.mutter?.summit || (L['view-' + MAP_ID] | 0) > 0 || (L.photo | 0) > 0;
    save.clue = been ? { s: 1, old: 1, q: 0 } : { s: 0, old: 0, q: 0 };
  }
  const c = save.clue; c.s = c.s ? 1 : 0; c.old = c.old ? 1 : 0; c.q = c.q ? 1 : 0;
  return c;
}

/* ---------- 자리 ---------- */
const CR = (() => { let x = 0, z = 0; for (const p of crater) { x += p[0]; z += p[1]; } const n = crater.length || 1; x /= n; z /= n; return { x, z, y: height(x, z) }; })();
const toC = new THREE.Vector3(CR.x - S0.x, 0, CR.z - S0.z); if (toC.lengthSq() > 0) toC.normalize();
const floorPt = new THREE.Vector3(CR.x, CR.y + 2, CR.z);
const rimPos = (() => {
  if (!ON) return null;
  let b = null, bd = Infinity; for (const p of crater) { const d = (p[0] - S0.x) ** 2 + (p[1] - S0.z) ** 2; if (d < bd) { bd = d; b = p; } }
  const dx = CR.x - b[0], dz = CR.z - b[1], L = Math.hypot(dx, dz) || 1, k = CLUE.rim.in / L;
  return v3(b[0] + dx * k, b[1] + dz * k);
})();
const at = (o, t) => S0.clone().addScaledVector(summitOut, o).addScaledVector(summitTan, t);
const notePos = ON ? at(CLUE.note.out, CLUE.note.tan) : new THREE.Vector3(1e9, 0, 1e9); notePos.y = height(notePos.x, notePos.z);
const scopePos = ON ? at(CLUE.scope.out, CLUE.scope.tan) : new THREE.Vector3(1e9, 0, 1e9); scopePos.y = height(scopePos.x, scopePos.z);

/* ---------- 모양 (로우폴리, 지금 그림체) ---------- */
const tm = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: gradHard });
const noteG = new THREE.Group(), scopeG = new THREE.Group();
if (ON) {
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.56), tm('#efe6cf')); paper.rotation.set(-Math.PI / 2 + 0.22, 0, 0.5); paper.position.set(0, 0.06, 0); noteG.add(paper);
  const ink = tm('#7a7262'); for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.28 - i * 0.05, 0.025), ink); l.rotation.copy(paper.rotation); l.position.set(-0.02 + i * 0.03, 0.075 + i * 0.012, -0.05 + i * 0.07); noteG.add(l); }
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.11, 0), tm('#4a4744')); rock.position.set(0.12, 0.08, -0.14); rock.scale.y = 0.7; noteG.add(rock);
  const grass = tm('#6f8f3c'), gg = new THREE.ConeGeometry(0.07, 0.5, 4);
  for (let i = 0; i < 6; i++) { const a = i * 1.05 + 0.3, r = 0.24 + (i % 2) * 0.1, g = new THREE.Mesh(gg, grass); g.position.set(Math.cos(a) * r, 0.22, Math.sin(a) * r); g.rotation.set(Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3); noteG.add(g); }
  noteG.position.copy(notePos); noteG.rotation.y = Math.atan2(summitOut.x, summitOut.z); noteG.visible = false; scene.add(noteG);
  // 망원경: 세발 받침 + 통. 굼부리 쪽을 봄
  const metal = tm('#5c6670'), dark = tm('#2b2f35'), leg = new THREE.CylinderGeometry(0.03, 0.03, 1.35, 5);
  for (let i = 0; i < 3; i++) { const a = i * 2.094, m = new THREE.Mesh(leg, dark); m.position.set(Math.cos(a) * 0.22, 0.62, Math.sin(a) * 0.22); m.rotation.set(Math.sin(a) * 0.32, 0, -Math.cos(a) * 0.32); scopeG.add(m); }
  const head = new THREE.Group(); head.position.y = 1.3; scopeG.add(head);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, 0.9, 8), metal); tube.rotation.x = Math.PI / 2 - 0.12; head.add(tube);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 8), dark); lens.rotation.x = Math.PI / 2 - 0.12; lens.position.set(0, 0.05, 0.45); head.add(lens);
  const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 6), dark); eye.rotation.x = Math.PI / 2 - 0.12; eye.position.set(0, -0.05, -0.48); head.add(eye);
  scopeG.position.copy(scopePos); scopeG.rotation.y = Math.atan2(toC.x, toC.z); scene.add(scopeG);
  scopeG.traverse((m) => { if (m.isMesh) { m.castShadow = !LOW; m.receiveShadow = true; } });
  if (col) col.add(scopePos.x, scopePos.z, 0.35);
}
// 빛 (굼부리 안 깜빡임·먼 불빛): 가운데가 진한 둥근 빛
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,240,1)'); r.addColorStop(0.25, 'rgba(210,255,200,.75)'); r.addColorStop(1, 'rgba(160,255,170,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const glow = (size) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false })); s.scale.set(size, size, 1); s.renderOrder = 30; s.visible = false; scene.add(s); return s; };
const flash = glow(CLUE.flash.size), farLight = glow(28);

/* ---------- 화면 (위아래 띠·건너뛰기·망원경 둥근 시야) ---------- */
const css = document.createElement('style');
css.textContent = `
body.clue-cine>*:not(#view):not(#clue-cine){visibility:hidden!important}
#clue-cine { position: fixed; inset: 0; z-index: 12; pointer-events: auto; }
#clue-cine::before, #clue-cine::after { content: ''; position: absolute; left: 0; right: 0; height: 9vh; background: #000; transition: transform .5s; }
#clue-cine::before { top: 0; transform: translateY(-100%); } #clue-cine::after { bottom: 0; transform: translateY(100%); }
#clue-cine.on::before, #clue-cine.on::after { transform: none; }
#clue-cine.scope::before, #clue-cine.scope::after { display: none; }
#clue-cine .cc-ring { position: absolute; inset: 0; display: none; background: radial-gradient(circle at 50% 50%, transparent 0 calc(min(40vw, 40vh) - 2px), #000 min(40vw, 40vh)); }
#clue-cine.scope .cc-ring { display: block; }
#clue-cine .cc-sk { position: absolute; right: max(16px, env(safe-area-inset-right)); bottom: calc(9vh + 12px); min-width: 44px; height: 40px; padding: 0 16px; border-radius: 999px; border: 1px solid var(--hair); background: var(--glass-2, rgba(20,20,24,.6)); color: var(--ink); font: 700 14px var(--body); cursor: pointer; }
#clue-cine.scope .cc-sk { bottom: max(20px, env(safe-area-inset-bottom)); }
#clue-cine .cc-line { position: absolute; left: 50%; bottom: max(24px, env(safe-area-inset-bottom)); transform: translateX(-50%); max-width: calc(100vw - 140px); color: #fff; font: 600 15px var(--body); text-align: center; text-shadow: 0 1px 3px #000; opacity: 0; transition: opacity .6s; word-break: keep-all; }
#clue-cine .cc-line.on { opacity: 1; }
`;
document.head.append(css);
const el = document.createElement('div'); el.id = 'clue-cine'; el.hidden = true;
el.innerHTML = '<div class="cc-ring"></div><div class="cc-line"></div><button type="button" class="cc-sk"></button>';
document.body.append(el);
const sk = el.querySelector('.cc-sk'), lineEl = el.querySelector('.cc-line');
sk.addEventListener('click', (e) => { e.stopPropagation(); stop(); });
for (const ev of ['pointerdown', 'pointermove', 'wheel', 'touchstart']) el.addEventListener(ev, (e) => { if (e.target !== sk) e.preventDefault(); }, { passive: false });
/* #309 F 로 시작한 같은 keydown 이 뒤에 등록된 이 처리에도 와서 바로 꺼졌음: 시작보다 먼저 만들어진 입력은 무시 */
addEventListener('keydown', (e) => { if (run && !e.repeat && e.timeStamp > run.t0 && (e.key === 'Escape' || (run.kind === 'scope' && (e.code === 'KeyF' || e.code === 'KeyE')))) { e.preventDefault(); stop(); } });

/* ---------- 차례 ---------- */
let run = null; // { kind 'scene'|'scope', u, len, prev, fov, a0, a1, light }
let pend = false; // 닿았는데 지금은 못 보여 줌
const fightNow = () => !!player.down || !!late.pace?.threat?.() || (state.tension || 0) > 0.3 || !!late.bossFight?.() || !!life?.enemies?.near?.(player.pos, 25);
const calm = () => state.sessionOn && !document.hidden && !late.tut?.active && !state.cave && !panelOpen() && cam.mode === 'follow' && !state.cine && !state.photoState && !player.cart && !player.ride && !player.riding && !fightNow();
const night = () => (sunState?.el ?? 30) < CLUE.scope.light.night;
const stage = () => { try { return revealStage(); } catch { return 0; } }; // UFO 드러남 단계 (#207)
const dStone = () => Math.hypot(player.pos.x - S0.x, player.pos.z - S0.z);

function begin(kind) {
  if (state.cine) return false;
  const a0 = Math.atan2(summitOut.x, summitOut.z), a1 = Math.atan2(-toC.x, -toC.z);
  let da = a1 - a0; da = Math.atan2(Math.sin(da), Math.cos(da));
  run = { kind, u: 0, len: kind === 'scope' ? CLUE.scope.len : CLUE.len, prev: cam.mode, fov: camera.fov, a0, da, light: kind === 'scope' && night() && stage() >= CLUE.scope.light.stage, snap: true, t0: performance.now() };
  state.cine = run; cam.mode = 'cine'; player.target = null; player.speed = 0;
  el.hidden = false; el.classList.toggle('scope', kind === 'scope'); sk.textContent = kind === 'scope' ? T.scopeOff : T.skip; sk.hidden = kind !== 'scope';
  lineEl.classList.remove('on'); lineEl.textContent = kind === 'scope' ? (run.light ? T.scopeLight : T.scopeNone) : '';
  document.body.classList.add('clue-cine'); requestAnimationFrame(() => el.classList.add('on'));
  director.begin('story', 'summit:' + kind, Infinity);
  return true;
}
function stop() {
  if (!run) return;
  const r = run; run = null; if (state.cine === r) state.cine = null;
  flash.visible = false; farLight.visible = false;
  camera.fov = r.fov; camera.updateProjectionMatrix();
  el.classList.remove('on', 'scope'); el.hidden = true; document.body.classList.remove('clue-cine');
  cam.mode = r.prev && r.prev !== 'cine' && r.prev !== 'title' ? r.prev : 'follow'; if (cam.mode === 'follow') followCam(0, true);
  director.end('summit:' + r.kind);
  if (r.kind === 'scene') {
    const c = C(); c.s = 1; persist(); noteG.visible = !haveNote();
    if (save.mutter?.off || !late.mutterApi?.say?.('glint')) toast(T.glintOff, 3.4);
    setTimeout(() => { if (!haveNote()) { tipMark(notePos.clone().setY(notePos.y + 0.6)); } }, 2600);
    setTimeout(() => { if (!haveNote()) say('mutter', 'summitNote', T.noteHint, 3, { ttl: 40 }); }, 4200);
  }
}
// 카메라 (update.js 가 cam.mode 'cine' 일 때 late.cineCam 을 부름. 엔딩이 돌 때는 엔딩 것)
{ const prev = late.cineCam; late.cineCam = (dt) => { if (run && state.cine === run) cineCam(dt); else prev?.(dt); }; }
const _l = new THREE.Vector3();
function cineCam(dt) {
  const r = run, u = r.u;
  if (r.kind === 'scene') {
    const k = smooth(CLUE.turn[0], CLUE.turn[1], u), a = r.a0 + r.da * k, rad = 9 + k * 5;
    const px = S0.x + Math.sin(a) * rad, pz = S0.z + Math.cos(a) * rad;
    camTarget.pos.set(px, Math.max(height(px, pz) + 2.5, S0.y + 3 + k * (CLUE.up - 3)), pz);
    _l.set(S0.x, S0.y + 1.6, S0.z).lerp(floorPt, k); camTarget.look.copy(_l);
    const f = r.fov + (CLUE.fov - r.fov) * smooth(CLUE.turn[0] + 1, CLUE.turn[1] + 0.5, u);
    if (Math.abs(camera.fov - f) > 0.01) { camera.fov = f; camera.updateProjectionMatrix(); }
    ease(dt, r.snap && !(r.snap = false), 2.2);
    return;
  }
  // 망원경: 눈 높이에서 굼부리 바닥 → 먼 능선을 좌우로 훑음
  const eye = scopePos.clone(); eye.y += 1.45;
  const base = Math.atan2(toC.x, toC.z), yaw = base + CLUE.scope.sweep * Math.sin(Math.max(0, u - 2.5) * 0.55), far = CLUE.scope.far;
  const fp = new THREE.Vector3(eye.x + Math.sin(yaw) * far, S0.y - 30, eye.z + Math.cos(yaw) * far);
  _l.copy(floorPt).lerp(fp, smooth(1.5, 3.5, u));
  camTarget.pos.copy(eye); camTarget.look.copy(_l);
  if (Math.abs(camera.fov - CLUE.scope.fov) > 0.01) { camera.fov = CLUE.scope.fov; camera.updateProjectionMatrix(); }
  ease(dt, r.snap && !(r.snap = false), 3);
}
function tickRun(dt) {
  const r = run; if (!r) return;
  if (state.cine !== r) { run = null; el.hidden = true; document.body.classList.remove('clue-cine'); flash.visible = false; farLight.visible = false; camera.fov = r.fov; camera.updateProjectionMatrix(); director.end('summit:' + r.kind); return; } // 엔딩이 자리를 가져감
  r.u += dt; const u = r.u;
  if (r.kind === 'scene') {
    sk.hidden = u < CLUE.skipAfter;
    const F = CLUE.flash, x = (u - F.at) / F.dur;
    flash.visible = x > 0 && x < 1; if (flash.visible) { flash.position.copy(floorPt); flash.material.opacity = Math.sin(x * Math.PI); }
    if (x > 0 && !r.chimed) { r.chimed = true; try { if (late.sound?.on) late.sound.chime?.(0.35); } catch { /* 소리 없음 */ } }
  } else {
    lineEl.classList.toggle('on', u > 2.2);
    farLight.visible = r.light && u > 2.5;
    if (farLight.visible) { const base = Math.atan2(toC.x, toC.z) + CLUE.scope.sweep * 0.6, d = CLUE.scope.far * 0.9; farLight.position.set(scopePos.x + Math.sin(base) * d, S0.y + 10, scopePos.z + Math.cos(base) * d); farLight.material.opacity = 0.75 + 0.25 * Math.sin(u * 5); }
  }
  if (u >= r.len) stop();
}

/* ---------- 쪽지·퀘스트 ---------- */
const NW = () => late.punkWorld?.note;
const haveNote = () => !!NW()?.got().includes(NOTE_ID);
function readNote() { const w = NW(); if (!w) return false; if (!haveNote()) { w.give(NOTE_ID, false); noteG.visible = false; } else w.open(NOTE_ID); return true; }
if (ON) interactables.push({ label: '쪽지 읽기', ic: 'notes', pos: notePos, r: CLUE.note.r, when: () => !!C().s && !haveNote() && !run, act: readNote });
if (ON) interactables.push({ label: T.scopeOn, ic: 'eye', pos: scopePos, r: CLUE.scope.r, when: () => !run && !state.cine, act: () => { if (!fightNow()) begin('scope'); } });
// 쪽지를 읽었으면(창에서·왼쪽 위 표시·도감 어디서든) 퀘스트를 받음. 옛 저장은 지난 것으로
function afterRead() {
  const c = C(); if (c.q || !haveNote() || NW()?.unread().includes(NOTE_ID)) return;
  c.q = 1; persist();
  const s = quests.state();
  if (quests.isDone(QID) || s.side?.[QID]) return;
  if (c.old) { s.done.push(QID); (s.skip ||= []).push(QID); persist(); late.questTrackDirty?.(); return; }
  if (quests.accept(QID)) { toast(T.quest, 2.8); late.sound?.beep?.(true); late.questTrackDirty?.(true); }
}
// 퀘스트를 끝냄 (game/quest.js onReady 의 auto): 감독이 아직 안 끝낸 가장 앞 구역 쪽을 한 줄 흘림
{ const prev = late.questAutoDone; late.questAutoDone = (q) => {
  prev?.(q); if (q.id !== QID) return;
  let z = 0; for (let k = 1; k <= 5; k++) if (!(save.boss?.done?.[k] > 0)) { z = k; break; }
  state.glance = { x: CR.x, z: CR.z, t: 0, T: 1.6 };
  setTimeout(() => say('story', 'rimDoor', T.door[z] || T.door[0], 4, { ttl: 120 }), 3800);
}; }

/* ---------- 매 프레임 ---------- */
let chkT = 0, rimIn = false;
function tickSummit(dt) {
  state.ticks.summit++;
  if (!ON) return;
  if (run) tickRun(dt);
  if ((chkT -= dt) > 0) return; chkT = 0.25;
  const c = C();
  noteG.visible = !!c.s && !haveNote();
  if (!state.sessionOn || late.tut?.active || state.cave) return;
  afterRead();
  const d = dStone();
  if (!c.s && !run) {
    if (d < CLUE.touch) pend = true;
    if (pend && d < CLUE.near && calm() && director.can('story')) { pend = false; begin('scene'); }
  }
  // 전망 자리에 닿음 (퀘스트 하는 중일 때만 셈)
  if (rimPos && quests.state().side?.[QID]) {
    const inR = Math.hypot(player.pos.x - rimPos.x, player.pos.z - rimPos.z) < CLUE.rim.r;
    if (inR && !rimIn) late.questEv?.('rimLook');
    rimIn = inR;
  }
}
late.tickSummit = tickSummit;

/* ---------- 확인용 (window.__oreum.summit) ---------- */
late.summitClue = {
  on: ON, rimPos: () => rimPos?.clone() || null,
  state: () => ({ ...C(), pend, run: run && { kind: run.kind, u: +run.u.toFixed(1), light: !!run.light }, note: noteG.visible, got: haveNote(), quest: quests.isDone(QID) ? 'done' : quests.state().side?.[QID] ? 'on' : null, cam: cam.mode, fov: +camera.fov.toFixed(1), flash: flash.visible }),
  spots: () => ({ stone: S0.toArray().map(Math.round), note: notePos.toArray().map((v) => +v.toFixed(1)), scope: scopePos.toArray().map((v) => +v.toFixed(1)), rim: rimPos?.toArray().map(Math.round), crater: [CR.x, CR.y, CR.z].map(Math.round) }),
  play: () => begin('scene'), scope: () => begin('scope'), stop, jump: (u) => { if (run) run.u = u; },
  reset: () => { save.clue = null; pend = false; persist(); C(); },
  touch: () => { pend = true; },
};
