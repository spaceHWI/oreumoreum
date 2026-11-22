// 사건 파일 (#232, 기획 notes/case-files.md): 미스터리 줄기의 틀. 사건 데이터는 src/cases/c*.js (모양 이름은 game/caseprops.js), 수치는 balance.js CASE
// 1. 목격: 레벨이 사건 lv 이상이면 see 자리에 모양(prop)이 보이고, see.r m 안에 들면 혼잣말 한 줄 → 사건이 열림(사건 파일 '미해결'), 메뉴·쪽지 창에 [사건 파일]
// 2. 의뢰·진행: 퀘스트 엔진 그대로 (balance.js QUESTS.side 뒤에 붙은 사건 퀘스트, need 'case:<id>'). 셈은 late.caseVal: 'case:<id>:ev' 찾은 증거 수 · 'case:<id>:face' 대면을 끝냄
//    추적 줄의 갈 곳: late.casePos('case:<id>') 아직 못 찾은 가장 가까운 증거 · 'case:<id>:face' 대면 자리
// 3. 증거: 사건이 열리면 자리에 모양. 다가가 상호작용하면 그 쪽지(punktext.js NOTES, z 'case')를 얻음(쪽지 창이 열림). act 증거는 퀘스트 셈이 사건을 연 뒤 n 번 오르면
// 4. 대면 hide(숨어 보기): 증거를 다 찾으면 수풀에서 상호작용 → 짧은 장면(해 질 녘 빛·까마귀가 날아와 빈자리에 귤·종이) → 서류 쪽지. 장면은 엔딩의 'cine' 자리를 빌려 씀(조작 잠금)
//    arena·boss 는 사건을 연 뒤 그 구역 서바이벌 한 판(save.swarm.won[구역].at)·우두머리(save.boss.done[구역])가 늘면 끝
//    face.actor·lines 가 있으면(#234 사건 3) 늘어난 뒤 face.at 에 모양이 서고(save h 1), 다가가 상호작용하면 장면(같은 cine 틀, 배우는 late.caseActors[actor]) → 끝나면 대면 끝
//    see.gone: 사건이 열린 뒤 목격 모양이 화면 밖으로 나가면 사라짐(뒤돌아보면 없다) · c.mat: 종결 때 장비 재료
// 5. 종결: 사건의 마지막 퀘스트 보상을 받으면(game/quest.js late.questGave) '종결' 도장 + 칭호(late.titles.give) + 업적
// 창 #case-file: 맨 위 서류 CASE_DOCS 칸, 사건마다 목격·증거·서류 칸과 미해결/종결 도장. 칸을 누르면 그 쪽지를 읽음
// 저장 save.cases = { <id>: { w 연 때(ms, 0 = 아직), ev [찾은 증거 id], f 대면을 끝냄 1, h 대면 장면을 볼 수 있음 1, base { 셈: 연 때 값 }, b 연 때 우두머리 수, s 연 때 서바이벌 시각 } }
// 멀티: 모두 내 화면에서만 (쪽지는 사람마다). 파일 순서는 traces 뒤 (src/modules.js: 퀘스트·쪽지·혼잣말·칭호가 다 있음). dev: __oreum.cases
import * as THREE from 'three';
import { CASE, LOOT } from '../balance.js';
import { CASES, CASE_BY, CASE_DOCS, caseLastQuest } from '../cases/index.js';
import { NOTES } from '../punktext.js';
import { levelOf } from '../augments.js';
import { zoneName } from '../zonelook.js';
import { height } from '../world.js';
import { buildCrow } from '../punkmodels.js';
import { icon } from '../icons.js';
import { state, late } from './state.js';
import { $, save, persist, MAP_ID } from './save.js';
import { scene, camera } from './scene.js';
import { player, col, life } from './place.js';
import { cam, camTarget, ease, followCam } from './camera.js';
import { toast, panelOpen, closePanels, PANELS } from './hud.js';
import { director, say } from './director.js';
import { interactables } from './stores.js';
import { quests } from './quest.js';
import { buildProp } from './caseprops.js';

const ON = MAP_ID === 'namsongi';
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const matName = (id) => LOOT.mats.find((m) => m.id === id)?.name || '재료';
const NOTE_BY = Object.fromEntries(NOTES.map((n) => [n.id, n]));
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- 저장 (로그인 뒤 저장이 바뀌어도 맞게 매번 봄) ---------- */
function S(id) {
  if (!isObj(save.cases)) save.cases = {};
  let s = save.cases[id];
  if (!isObj(s)) s = save.cases[id] = { w: 0, ev: [], f: 0 };
  s.w = Number.isFinite(+s.w) && +s.w > 0 ? +s.w : 0;
  const c = CASE_BY[id], ids = new Set((c?.ev || []).map((e) => e.id));
  s.ev = Array.isArray(s.ev) ? s.ev.filter((e, i, a) => ids.has(e) && a.indexOf(e) === i) : [];
  s.f = s.f ? 1 : 0; s.h = s.h || s.f ? 1 : 0;
  if (!isObj(s.base)) s.base = {};
  return s;
}
const lv = () => { try { return levelOf(save.lv?.xp || 0).lv; } catch { return 1; } };
const sceneFace = (c) => c.face?.kind !== 'hide' && !!c.face?.actor && !!c.face?.at; /* 싸움 뒤 장면 (#234) */
const isOpen = (id) => !!CASE_BY[id] && !!S(id).w;
const anyOpen = () => CASES.some((c) => isOpen(c.id));
const closed = (c) => !!caseLastQuest(c) && quests.isDone(caseLastQuest(c));
const qc = (k) => +quests.state().c?.[k] || 0;
function evGot(c, e) {
  const s = S(c.id); if (s.ev.includes(e.id)) return true;
  if (e.kind === 'act' && s.w && qc(e.k) - (+s.base[e.k] || 0) >= (e.n || 1)) { s.ev.push(e.id); persist(); if (e.note) late.punkWorld?.note?.give(e.note, true); return true; }
  return false;
}
const evN = (c) => (isOpen(c.id) ? c.ev.filter((e) => evGot(c, e)).length : 0);
const evAll = (c) => evN(c) >= c.ev.length;
function faceDone(c) {
  const s = S(c.id); if (s.f) return true; if (!s.w) return false;
  const k = c.face?.kind, z = c.zone;
  const hit = k === 'none' ? evAll(c) : k === 'boss' ? (+save.boss?.done?.[z] || 0) > (+s.b || 0) : k === 'arena' ? (+save.swarm?.won?.[z]?.at || 0) > (+s.s || 0) : false;
  if (hit && evAll(c)) { if (sceneFace(c)) { if (!s.h) { s.h = 1; persist(); late.questTrackDirty?.(true); } return false; } s.f = 1; persist(); gotDoc(c); return true; }
  return false;
}
// 셈 (game/quest.js val): 'case:<id>:ev' · 'case:<id>:face'
late.caseVal = (k) => { const [, id, what] = k.split(':'), c = CASE_BY[id]; if (!c) return 0; return what === 'ev' ? evN(c) : what === 'face' ? (faceDone(c) ? 1 : 0) : 0; };
late.caseOpen = (id) => isOpen(id);

/* ---------- 자리·모양 ---------- */
const v3 = (x, z) => new THREE.Vector3(x, height(x, z), z);
function free([x, z], r = 0.5) { // 막혀 있으면 둘레에서 빈 자리 (CASE.free m 안)
  if (!col || !col.blocked(x, z, r)) return v3(x, z);
  for (let d = 0.8; d <= CASE.free; d += 0.8) for (let a = 0; a < 6.28; a += 0.7) { const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; if (!col.blocked(px, pz, r)) return v3(px, pz); }
  return v3(x, z);
}
const objs = []; // { c, kind 'see'|'ev'|'face'|'gyul'|'doc', e?, root, pos, show() }
function place(c, kind, at, prop, e = null, show) {
  const pos = free(at), root = buildProp(prop); if (!root) return null;
  root.position.copy(pos); root.rotation.y = Math.atan2(-pos.x + c.see.at[0], -pos.z + c.see.at[1]) || 0; root.visible = false; scene.add(root);
  const o = { c, kind, e, root, pos, show }; objs.push(o); return o;
}
const spots = {}; // id → { see, ev: { id: pos }, face }
if (ON) for (const c of CASES) {
  const sp = spots[c.id] = { ev: {} };
  const see = place(c, 'see', c.see.at, c.see.prop, null, () => (lv() >= c.lv || isOpen(c.id)) && !(c.see.gone && see?.left)); sp.see = see?.pos || v3(...c.see.at);
  if (see) see.root.rotation.y = 0;
  for (const e of c.ev) {
    if (e.kind === 'act' || !e.at) continue;
    const o = place(c, 'ev', e.at, e.prop, e, () => isOpen(c.id) && !evGot(c, e)); sp.ev[e.id] = o?.pos || v3(...e.at);
    if (o && e.prop === 'peel') o.root.rotation.y = 0;
    interactables.push({ label: e.label || '살펴보기', ic: e.kind === 'photo' ? 'photo' : e.kind === 'note' ? 'notes' : 'eye', pos: sp.ev[e.id], r: CASE.r,
      when: () => isOpen(c.id) && !evGot(c, e) && !run && !state.cine && !late.tut?.active, act: () => takeEv(c, e) });
  }
  if (c.face?.at) {
    const o = place(c, 'face', c.face.at, c.face.prop || 'bush', null, sceneFace(c) ? () => isOpen(c.id) && !!S(c.id).h && !S(c.id).f && !run : () => isOpen(c.id)); sp.face = o?.pos || v3(...c.face.at);
    if (sceneFace(c)) interactables.push({ label: c.face.label || '다가가기', ic: 'eye', pos: sp.face, r: CASE.r + 0.6,
      when: () => isOpen(c.id) && !!S(c.id).h && !S(c.id).f && !run && !state.cine && !late.tut?.active, act: () => beginHide(c) });
    if (c.face.kind === 'hide') interactables.push({ label: c.face.label || '숨어 보기', ic: 'eye', pos: sp.face, r: CASE.r + 0.6,
      when: () => isOpen(c.id) && evAll(c) && !S(c.id).f && !run && !state.cine && !late.tut?.active, act: () => beginHide(c) });
    // 대면 뒤 빈자리에 귤·종이 (row 의 +x 끝)
    if (c.face.kind === 'hide') {
    const end = sp.see.clone().add(new THREE.Vector3(0.95, 0, 0.18)); end.y = height(end.x, end.z);
    for (const [k, prop, dx] of [['gyul', 'gyul', 0], ['doc', 'paper', 0.35]]) {
      const r = buildProp(prop); r.position.copy(end).add(new THREE.Vector3(dx, 0, 0)); r.visible = false; scene.add(r);
      objs.push({ c, kind: k, root: r, pos: r.position, show: () => (S(c.id).f || (run?.c === c && run.dropped)) && !closed(c) });
    }
    }
  }
}
// 추적 줄 갈 곳 (game/quest.js goPos)
late.casePos = (go) => {
  const [, id, what] = go.split(':'), c = CASE_BY[id], sp = spots[id]; if (!c || !sp) return null;
  if (what === 'face') return sp.face ? sp.face.clone() : sp.see.clone();
  let b = null, bd = Infinity;
  for (const e of c.ev) { const p = sp.ev[e.id]; if (!p || evGot(c, e)) continue; const d = (p.x - player.pos.x) ** 2 + (p.z - player.pos.z) ** 2; if (d < bd) { bd = d; b = p; } }
  return b ? b.clone() : sp.see.clone();
};

/* ---------- 목격 ---------- */
function openCase(c, quiet = false) {
  const s = S(c.id); if (s.w) return false;
  s.w = Date.now(); s.base = {}; for (const e of c.ev) if (e.kind === 'act' && e.k) s.base[e.k] = qc(e.k);
  s.b = +save.boss?.done?.[c.zone] || 0; s.s = +save.swarm?.won?.[c.zone]?.at || 0; persist();
  syncBtns(); late.questTrackDirty?.(true);
  if (quiet) return true;
  if (!late.mutterApi?.line?.('case:' + c.id, c.see.say)) toast(c.see.say, 3);
  setTimeout(() => say('quest', 'case-open:' + c.id, `사건 파일에 한 줄 · '${c.name}' 미해결`, 3.6, { ttl: 60 }), 3200);
  return true;
}
function takeEv(c, e) {
  const s = S(c.id); if (!s.w || s.ev.includes(e.id)) return;
  s.ev.push(e.id); persist(); late.sound?.snip?.();
  if (e.note) late.punkWorld?.note?.give(e.note); // 쪽지 창이 열림 (싸우는 중이면 표시만)
  const n = evN(c);
  say('quest', 'case-ev:' + e.id, n >= c.ev.length ? `증거 ${n}/${c.ev.length} · 다 모았어요. ${CASE_GIVER(c)}에게 가 봐요` : `증거 ${n}/${c.ev.length} · 사건 파일에 붙였어요`, 3, { ttl: 40 });
  late.questTrackDirty?.(true); syncBtns();
}
const fightNow = () => !!player.down || !!late.bossFight?.() || !!late.swarm?.state?.() || !!life?.enemies?.near?.(player.pos, 18); /* 숨어 보기는 가까이 적이 없을 때만 */
const CASE_GIVER = (c) => late.questDebug?.givers?.get?.(c.giver)?.name || '의뢰한 사람';
function gotDoc(c) { if (c.doc) late.punkWorld?.note?.give(c.doc); late.questTrackDirty?.(true); }

/* ---------- 대면: 숨어 보기 ---------- */
let run = null; // { c, u, len, prev, fov, crows: [{ m, a }], line }
const css = document.createElement('style');
css.textContent = `
body.case-cine>*:not(#view):not(#case-cine){visibility:hidden!important}
#case-cine { position: fixed; inset: 0; z-index: 12; pointer-events: auto; background: linear-gradient(180deg, rgba(120,60,110,.0), rgba(230,120,60,.0)); transition: background 2.4s; }
#case-cine.dusk { background: linear-gradient(180deg, rgba(60,30,90,.55), rgba(240,120,50,.42) 70%, rgba(240,140,60,.3)); }
#case-cine::before, #case-cine::after { content: ''; position: absolute; left: 0; right: 0; height: 9vh; background: #000; transition: transform .5s; }
#case-cine::before { top: 0; transform: translateY(-100%); } #case-cine::after { bottom: 0; transform: translateY(100%); }
#case-cine.on::before, #case-cine.on::after { transform: none; }
#case-cine .cc-sk { position: absolute; right: max(16px, env(safe-area-inset-right)); bottom: calc(9vh + 12px); min-width: 44px; height: 40px; padding: 0 16px; border-radius: 999px; border: 1px solid var(--hair); background: var(--glass-2, rgba(20,20,24,.6)); color: var(--ink); font: 700 14px var(--body); cursor: pointer; }
#case-cine .cc-line { position: absolute; left: 50%; bottom: max(24px, env(safe-area-inset-bottom)); transform: translateX(-50%); max-width: calc(100vw - 140px); color: #fff; font: 600 15px var(--body); text-align: center; text-shadow: 0 1px 3px #000; opacity: 0; transition: opacity .5s; word-break: keep-all; }
#case-cine .cc-line.on { opacity: 1; }
#case-file .pop { width: min(540px, 100%); }
#case-file .cf-docs { display: grid; grid-template-columns: repeat(${CASE_DOCS}, minmax(0, 1fr)); gap: 6px; margin: 2px 0 14px; }
#case-file .cf-slot { position: relative; min-height: 64px; border-radius: 8px; border: 1px dashed var(--hair); background: rgba(255,255,255,.04); color: var(--ink-soft); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 6px 4px; font: 700 11px/1.2 var(--body); text-align: center; word-break: keep-all; }
#case-file .cf-slot svg { width: 18px; height: 18px; opacity: .55; }
#case-file .cf-slot small { font-weight: 500; font-size: 10px; opacity: .8; }
#case-file button.cf-slot { cursor: pointer; }
#case-file .cf-slot.got { border-style: solid; border-color: transparent; background: #efe6cf; color: #33302a; }
#case-file .cf-slot.got svg { opacity: .8; }
#case-file .cf-slot.doc.got { background: #f4ecd8; box-shadow: inset 0 0 0 2px #c9a86a; }
#case-file .cf-case { position: relative; padding: 10px 10px 10px 12px; border-radius: 12px; background: rgba(255,255,255,.07); margin-bottom: 8px; }
#case-file .cf-case.lock { opacity: .55; }
#case-file .cf-case h3 { margin: 0 86px 2px 0; font: 800 16px var(--display); }
#case-file .cf-case .cf-sub { margin: 0 86px 8px 0; color: var(--ink-soft); font-size: 12px; }
#case-file .cf-stamp { position: absolute; right: 10px; top: 10px; transform: rotate(-8deg); border: 2px solid currentColor; border-radius: 6px; padding: 1px 8px; font: 900 13px var(--display); letter-spacing: .08em; }
#case-file .cf-stamp.open { color: #e8846a; } #case-file .cf-stamp.done { color: #8fd09a; }
#case-file .cf-row { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
#case-file .cf-h { margin: 4px 0 6px; font: 800 13px var(--display); color: var(--ink-soft); }
#case-file .cf-empty { color: var(--ink-soft); margin: 4px 0 10px; }
@media (max-height: 480px) { #case-file .cf-slot { min-height: 46px; padding: 4px; } #case-file .cf-slot svg { display: none; } #case-file .cf-docs { margin-bottom: 8px; } }
@media (max-width: 380px) { #case-file .cf-slot { font-size: 10px; } }
#punk-note .pn-nav .pn-case { padding: 0 12px; }
#punk-note .pn-nav .pn-case svg { width: 18px; height: 18px; }
`;
document.head.append(css);
const cine = document.createElement('div'); cine.id = 'case-cine'; cine.hidden = true;
cine.innerHTML = '<div class="cc-line"></div><button type="button" class="cc-sk">건너뛰기</button>';
document.body.append(cine);
const lineEl = cine.querySelector('.cc-line'), skBtn = cine.querySelector('.cc-sk');
skBtn.addEventListener('click', (e) => { e.stopPropagation(); stopHide(); });
for (const ev of ['pointerdown', 'pointermove', 'wheel', 'touchstart']) cine.addEventListener(ev, (e) => { if (e.target !== skBtn) e.preventDefault(); }, { passive: false });
addEventListener('keydown', (e) => { if (run && e.key === 'Escape') { e.preventDefault(); stopHide(); } });

function beginHide(c) {
  if (state.cine || run) return false;
  if (fightNow()) { toast('지금은 숨을 때가 아니에요 · 싸움부터', 2.4); return false; }
  late.mutterApi?.hush?.();
  const sp = spots[c.id], hide = sp.face, row = sp.see, A = actorOf(c);
  run = { c, u: 0, len: c.face.len || 9, prev: cam.mode, fov: camera.fov, li: -1, snap: true, crows: [] };
  if (A) { state.cine = run; cam.mode = 'cine'; player.target = null; player.speed = 0; A.begin(run, sp, c); beginCine(c, false); return true; }
  for (let i = 0; i < CASE.face.crows; i++) {
    const m = buildCrow(); m.loot.visible = false; m.root.visible = false; scene.add(m.root);
    const a = (i / CASE.face.crows) * Math.PI * 2 + 0.6;
    run.crows.push({ m, a, from: new THREE.Vector3(row.x + Math.cos(a) * 26, row.y + 14 + i * 2, row.z + Math.sin(a) * 26), to: new THREE.Vector3(row.x - 0.6 + i * 0.6, row.y + 0.25, row.z + 0.55) });
  }
  state.cine = run; cam.mode = 'cine'; player.target = null; player.speed = 0;
  { const dx = hide.x - row.x, dz = hide.z - row.z, L = Math.hypot(dx, dz) || 1, px = hide.x - dz / L * 0.9 + dx / L * 0.5, pz = hide.z + dx / L * 0.9 + dz / L * 0.5; player.pos.set(px, height(px, pz), pz); player.visY = player.pos.y; } /* 수풀 옆 (카메라는 반대쪽 옆) */
  player.heading = Math.atan2(row.x - player.pos.x, row.z - player.pos.z); player.pose = 'crouch'; player.poseT = 0;
  beginCine(c, true);
  return true;
}
function beginCine(c, dusk) {
  cine.hidden = false; skBtn.hidden = true; lineEl.classList.remove('on'); lineEl.textContent = '';
  document.body.classList.add('case-cine'); requestAnimationFrame(() => cine.classList.add('on'));
  if (dusk) setTimeout(() => { if (run) cine.classList.add('dusk'); }, 300);
  director.begin('story', 'case:' + c.id, Infinity);
}
/* 대면 장면의 배우 (#234): late.caseActors[c.face.actor] = { begin(run, sp, c), tick(run, dt), cam(run, dt, { camTarget, ease, height }), end(run) } */
const actorOf = (c) => (c.face?.actor && late.caseActors?.[c.face.actor]) || null;
function stopHide() {
  if (!run) return;
  const r = run; run = null; if (state.cine === r) state.cine = null;
  for (const k of r.crows) { scene.remove(k.m.root); k.m.root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); }
  try { actorOf(r.c)?.end?.(r); } catch { /* 배우 정리 실패는 넘어감 */ }
  camera.fov = r.fov; camera.updateProjectionMatrix();
  cine.classList.remove('on', 'dusk'); cine.hidden = true; document.body.classList.remove('case-cine');
  if (player.pose === 'crouch') player.pose = 'move';
  cam.mode = r.prev && r.prev !== 'cine' && r.prev !== 'title' ? r.prev : 'follow'; if (cam.mode === 'follow') followCam(0, true);
  director.end('case:' + r.c.id);
  const s = S(r.c.id); s.f = 1; persist(); if (!haveNote(r.c.doc)) setTimeout(() => gotDoc(r.c), 400); /* 건너뛰어도 끝난 것으로 */
  late.questTrackDirty?.(true); syncBtns();
}
{ const prev = late.cineCam; late.cineCam = (dt) => { if (run && state.cine === run) hideCam(dt); else prev?.(dt); }; }
function hideCam(dt) { // 수풀 뒤 낮은 눈높이에서 줄 선 더미를 봄 (배우가 있으면 배우 카메라)
  { const A = actorOf(run.c); if (A?.cam) { A.cam(run, dt, { camTarget, ease, height }); return; } }
  const sp = spots[run.c.id], row = sp.see, h = sp.face, dx = h.x - row.x, dz = h.z - row.z, L = Math.hypot(dx, dz) || 1, F = CASE.face;
  const cx = row.x + dx / L * F.camBack + dz / L * F.camSide, cz = row.z + dz / L * F.camBack - dx / L * F.camSide;
  camTarget.pos.set(cx, Math.max(height(cx, cz) + F.camUp, row.y + F.camUp), cz);
  camTarget.look.set(row.x, row.y + 0.3, row.z);
  ease(dt, run.snap && !(run.snap = false), 2.4);
}
function tickHide(dt) {
  const r = run; if (!r) return;
  if (state.cine !== r) { const keep = r; run = null; for (const k of keep.crows) scene.remove(k.m.root); try { actorOf(keep.c)?.end?.(keep); } catch { /* 넘어감 */ } cine.hidden = true; document.body.classList.remove('case-cine'); director.end('case:' + keep.c.id); return; }
  r.u += dt; const u = r.u, T = r.len, L = r.c.face.lines || [];
  skBtn.hidden = u < CASE.face.skipAfter;
  const li = Math.min(L.length - 1, Math.floor(u / (T / Math.max(1, L.length))));
  if (li !== r.li && L[li]) { r.li = li; lineEl.classList.remove('on'); void lineEl.offsetWidth; lineEl.textContent = L[li]; lineEl.classList.add('on'); }
  actorOf(r.c)?.tick?.(r, dt);
  // 까마귀: T 의 30% 에 하늘에서 내려와 줄 옆에 앉고, 75% 에 빈자리에 귤·종이를 두고 날아감
  r.crows.forEach((k, i) => {
    const a = Math.max(0, Math.min(1, (u - T * (0.28 + i * 0.05)) / (T * 0.22))), b = Math.max(0, Math.min(1, (u - T * (0.72 + i * 0.04)) / (T * 0.2)));
    k.m.root.visible = a > 0 && b < 1;
    if (!k.m.root.visible) return;
    const p = k.m.root.position; p.lerpVectors(k.from, k.to, a * a * (3 - 2 * a));
    if (b > 0) { p.lerpVectors(k.to, k.from, b * b); p.y += b * 6; }
    if (a >= 1 && b <= 0) p.y = k.to.y + Math.abs(Math.sin(u * 7 + i)) * 0.12;
    const tgt = b > 0 ? k.from : k.to; k.m.root.lookAt(tgt.x, p.y, tgt.z);
    const flap = a < 1 || b > 0 ? Math.sin(u * 22 + i) * 0.8 : Math.sin(u * 3 + i) * 0.1; k.m.wings[0].rotation.z = flap; k.m.wings[1].rotation.z = -flap;
  });
  if (u > T * 0.74 && !r.dropped) { r.dropped = true; chkT = 0; try { late.sound?.chime?.(0.25); } catch { /* 소리 없음 */ } }
  if (u >= T) stopHide();
}

/* ---------- 종결 (game/quest.js 가 보상을 준 뒤) ---------- */
{ const prev = late.questGave; late.questGave = (q) => {
  prev?.(q);
  const c = CASES.find((x) => caseLastQuest(x) === q.id); if (!c) return;
  if (c.title) late.titles?.give(c.title);
  if (Array.isArray(c.mat) && c.mat[0] && +c.mat[1] > 0) { if (!isObj(save.mats)) save.mats = {}; save.mats[c.mat[0]] = (+save.mats[c.mat[0]] || 0) + +c.mat[1]; persist(); setTimeout(() => toast(`${matName(c.mat[0])} +${c.mat[1]}`, 2.4), 2600); }
  setTimeout(() => say('quest', 'case-done:' + c.id, `사건 '${c.name}' 종결 · 사건 파일에 도장${c.title ? ` · 칭호 '${c.title}'` : ''}`, 4, { ttl: 60 }), 1200);
  syncBtns(); if (!win.hidden) build();
}; }

/* ---------- 사건 파일 창 ---------- */
const win = document.createElement('div'); win.className = 'overlay dim'; win.id = 'case-file'; win.hidden = true;
win.innerHTML = '<div class="panel pop" role="dialog" aria-modal="true" aria-labelledby="case-file-h"><div class="pop-head"><h2 id="case-file-h">사건 파일</h2><button type="button" class="btn small" id="case-file-close">닫기</button></div><div class="pop-body" id="case-file-body"></div></div>';
document.body.append(win);
PANELS.push('case-file');
$('case-file-close').addEventListener('click', () => { win.hidden = true; });
win.addEventListener('pointerdown', (e) => { if (e.target === win) win.hidden = true; });
const haveNote = (id) => !!id && !!late.punkWorld?.note?.got?.().includes(id);
const slot = (cls, ic, label, sub, note) => note ? `<button type="button" class="cf-slot got ${cls}" data-note="${esc(note)}">${icon(ic)}<span>${esc(label)}</span>${sub ? `<small>${esc(sub)}</small>` : ''}</button>`
  : `<div class="cf-slot ${cls}">${icon(ic)}<span>${esc(label)}</span>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
const EV_IC = { photo: 'photo', trace: 'eye', note: 'notes', act: 'check' };
function build() {
  const docs = []; for (let n = 1; n <= CASE_DOCS; n++) { const c = CASES.find((x) => x.n === n), got = c && haveNote(c.doc); docs.push(slot('doc', 'notes', got ? NOTE_BY[c.doc]?.t || '서류' : '?', `서류 ${n}`, got ? c.doc : null)); }
  let h = `<p class="cf-h">서류</p><div class="cf-docs">${docs.join('')}</div><p class="cf-h">사건</p>`;
  if (!anyOpen()) h += '<p class="cf-empty">아직 열린 사건이 없어요. 오름은 평화로워 보여요(겉으로는)</p>';
  for (const c of CASES) {
    const open = isOpen(c.id), done = closed(c);
    if (!open) { h += `<div class="cf-case lock"><h3>???</h3><p class="cf-sub">레벨 ${c.lv} · ${esc(zoneName(c.zone))} 어딘가</p></div>`; continue; }
    const cells = [slot('see', 'eye', '목격', '', null).replace('cf-slot see', 'cf-slot got see')];
    c.ev.forEach((e, i) => { const got = evGot(c, e), n = e.note && NOTE_BY[e.note]; cells.push(slot('ev', EV_IC[e.kind] || 'eye', got ? (n?.t || '증거') : `증거 ${i + 1}`, got ? '' : '?', got && n && haveNote(e.note) ? e.note : null)); });
    const dg = haveNote(c.doc); cells.push(slot('doc', 'notes', dg ? NOTE_BY[c.doc]?.t || '서류' : '서류', dg ? '' : '?', dg ? c.doc : null));
    h += `<div class="cf-case"><span class="cf-stamp ${done ? 'done' : 'open'}">${done ? '종결' : '미해결'}</span><h3>${esc(c.name)}</h3><p class="cf-sub">사건 ${c.n} · ${esc(zoneName(c.zone))} · 증거 ${evN(c)}/${c.ev.length}</p><div class="cf-row">${cells.join('')}</div></div>`;
  }
  $('case-file-body').innerHTML = h;
}
$('case-file-body').addEventListener('click', (e) => { const b = e.target.closest('[data-note]'); if (!b) return; win.hidden = true; late.punkWorld?.note?.open(b.dataset.note); });
function openFile() { closePanels(); build(); win.hidden = false; }
// 메뉴 칸 [사건 파일] (퀘스트 뒤) · 쪽지 창 아래 [사건] (사건이 하나라도 열리면)
const menuBtn = document.createElement('button'); menuBtn.type = 'button'; menuBtn.id = 'menu-case'; menuBtn.hidden = true; menuBtn.innerHTML = icon('notes') + '사건 파일';
menuBtn.addEventListener('click', () => openFile());
{ const q = $('menu-quest'), d = $('menu-dex'); if (q) q.after(menuBtn); else d?.before(menuBtn); }
const noteBtn = document.createElement('button'); noteBtn.type = 'button'; noteBtn.className = 'pn-case'; noteBtn.hidden = true; noteBtn.setAttribute('aria-label', '사건 파일'); noteBtn.innerHTML = icon('notes');
noteBtn.addEventListener('click', () => { late.punkWorld?.note?.close?.(); openFile(); });
document.querySelector('#punk-note .pn-close')?.before(noteBtn);
function syncBtns() { const on = anyOpen(); menuBtn.hidden = !on; noteBtn.hidden = !on; }
syncBtns();

/* ---------- 매 프레임 ---------- */
let chkT = 0;
const fwd = new THREE.Vector3();
function seeGone(o, px, pz) { // 목격 모양이 나를 봄 · 사건이 열린 뒤 화면 밖(시야 반각 55도 밖)이면 사라짐
  o.root.rotation.y = Math.atan2(px - o.pos.x, pz - o.pos.z);
  if (!isOpen(o.c.id) || state.cine || Date.now() - S(o.c.id).w < CASE.goneAfter * 1000) return; /* 혼잣말을 할 동안은 서 있음 */
  camera.getWorldDirection(fwd); const dx = o.pos.x - camera.position.x, dz = o.pos.z - camera.position.z, L = Math.hypot(dx, dz) || 1;
  if ((fwd.x * dx + fwd.z * dz) / (L * (Math.hypot(fwd.x, fwd.z) || 1)) < Math.cos(55 * Math.PI / 180)) { o.left = true; o.root.visible = false; }
}
function tickCases(dt) {
  state.ticks.cases++;
  if (run) tickHide(dt);
  if (!ON || (chkT -= dt) > 0) return; chkT = CASE.seeT;
  const px = player.pos.x, pz = player.pos.z, far2 = CASE.far * CASE.far;
  for (const o of objs) { const vis = (o.pos.x - px) ** 2 + (o.pos.z - pz) ** 2 < far2 && !state.cave && !!o.show(); if (o.root.visible !== vis) o.root.visible = vis; if (vis && o.kind === 'see' && o.c.see.gone) seeGone(o, px, pz); }
  if (!state.sessionOn || late.tut?.active || state.cave || state.cine || panelOpen()) return;
  for (const c of CASES) {
    const s = S(c.id);
    if (!s.w) { if (lv() >= c.lv && Math.hypot(spots[c.id].see.x - px, spots[c.id].see.z - pz) < c.see.r) openCase(c); continue; }
    if (!s.f && c.face?.kind !== 'hide') faceDone(c);
  }
}
late.tickCases = tickCases;

/* ---------- 확인용 (window.__oreum.cases) ---------- */
late.cases = {
  list: CASES.map((c) => c.id), on: ON,
  state: (id = 'c1') => { const c = CASE_BY[id]; if (!c) return null; const s = S(id); return { ...JSON.parse(JSON.stringify(s)), open: !!s.w, ev: evN(c), all: evAll(c), face: faceDone(c), closed: closed(c), lv: lv(), need: c.lv, run: run && { u: +run.u.toFixed(1) }, btn: !menuBtn.hidden }; },
  spots: (id = 'c1') => { const sp = spots[id]; if (!sp) return null; const r = (p) => p && [+p.x.toFixed(1), +p.z.toFixed(1)]; return { see: r(sp.see), face: r(sp.face), ev: Object.fromEntries(Object.entries(sp.ev).map(([k, p]) => [k, r(p)])) }; },
  objs: () => objs.map((o) => ({ id: o.c.id, kind: o.kind, ev: o.e?.id || null, vis: o.root.visible })),
  open: (id = 'c1') => openCase(CASE_BY[id]), take: (id, eid) => { const c = CASE_BY[id], e = c?.ev.find((x) => x.id === eid); if (e) takeEv(c, e); return evN(c); },
  busy: () => fightNow(),
  hide: (id = 'c1') => beginHide(CASE_BY[id]), stop: stopHide, jump: (u) => { if (run) run.u = u; },
  file: openFile, fileOpen: () => !win.hidden, build, html: () => $('case-file-body').innerHTML,
  reset: (id = 'c1') => { if (isObj(save.cases)) delete save.cases[id]; persist(); syncBtns(); },
};
