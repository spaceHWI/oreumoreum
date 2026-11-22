// 사건 파일 (#232, 기획 notes/case-files.md): 미스터리 줄기의 틀. 사건 데이터는 src/cases/c*.js (모양 이름은 game/caseprops.js), 수치는 balance.js CASE
// 1. 목격: 레벨이 사건 lv 이상이면 see 자리에 모양(prop)이 보이고, see.r m 안에 들면 혼잣말 한 줄 → 사건이 열림(사건 파일 '미해결'), 메뉴·쪽지 창에 [사건 파일]
// 2. 의뢰·진행: 퀘스트 엔진 그대로 (balance.js QUESTS.side 뒤에 붙은 사건 퀘스트, need 'case:<id>'). 셈은 late.caseVal: 'case:<id>:ev' 찾은 증거 수 · 'case:<id>:face' 대면을 끝냄
//    추적 줄의 갈 곳: late.casePos('case:<id>') 아직 못 찾은 가장 가까운 증거 · 'case:<id>:face' 대면 자리
// 3. 증거: 사건이 열리면 자리에 모양. 다가가 상호작용하면 그 쪽지(punktext.js NOTES, z 'case')를 얻음(쪽지 창이 열림). act 증거는 퀘스트 셈이 사건을 연 뒤 n 번 오르면
//    view 증거(#246)는 찍을 때 목격 자리를 위에서 내려다보는 짧은 장면(찰칵) 뒤에 쪽지
// 4. 대면 watch(#236): 대면 조건 뒤 face 자리에서 다가가 보기 장면(모양의 userData.anim)
//    대면 hide(숨어 보기): 증거를 다 찾으면 수풀에서 상호작용 → 짧은 장면(dawn 새벽빛, drop 모양이 목격 자리 가운데로 '툭') → 증거 사진 쪽지. 장면은 엔딩의 'cine' 자리를 빌려 씀(조작 잠금)
//    arena·boss 는 사건을 연 뒤 그 구역 서바이벌 한 판(save.swarm.won[구역].at)·우두머리(save.boss.done[구역])가 늘면 끝
//    face.follow 가 있으면 그 뒤 흰 옷을 끝까지 따라가 장면을 봐야 끝 (#233 사건 2, game/casechase.js. 터를 버티면 a 1)
//    face.scene 이 있으면(#235) arena·boss 를 끝낸 뒤 face.at 에서 상호작용 → 그 장면(caseprops.js SCENES, 숨어 보기 틀을 빌려 씀)을 봐야 끝. face.tint 장면 빛('dusk' 기본·'mist')
//    see.gone 이 있으면 대면을 끝낸 뒤 목격 모양을 치움
//    face.wait(#234): 대면 조건을 채운 뒤에만 face 모양이 서고 대면을 끝내면 치움 · boss 장면은 조건 전 추적 줄이 우두머리 빈터로
// 5. 종결: 사건의 마지막 퀘스트 보상을 받으면(game/quest.js late.questGave) '종결' 도장 + 칭호(late.titles.give) + 업적
// 창 #case-file (#246 수사 보드): 코르크판에 사건마다 증거 사진 자리(CASE_SLOTS), 종결된 사건의 사진은 핀으로 꽂히고 빨간 실로 이어짐(끝은 다음 빈 자리로)
//    사진(자리)을 누르면 아래에 그 사건의 목격·증거 3칸·사진 칸. 칸을 누르면 그 쪽지를 읽음
// 저장 save.cases = { <id>: { v 내용 판, w 연 때(ms, 0 = 아직), ev [찾은 증거 id], f 대면을 끝냄 1, a 터·우두머리를 끝내고 따라가는 중 1 (follow), base { 셈: 연 때 값 }, b 연 때 우두머리 수, s 연 때 서바이벌 시각 } }
//    v 가 사건 데이터의 v 와 다르면(옛 내용으로 진행한 저장, #246) 그 사건 진행을 처음으로 하고 옛 쪽지(drop)를 뺌. 받은 귤·옷은 그대로
// 멀티: 모두 내 화면에서만 (쪽지는 사람마다). 파일 순서는 traces 뒤 (src/modules.js: 퀘스트·쪽지·혼잣말·칭호가 다 있음). dev: __oreum.cases
import * as THREE from 'three';
import { CASE, SWARM } from '../balance.js';
import { CASES, CASE_BY, CASE_SLOTS, caseLastQuest, casePhoto, caseHello } from '../cases/index.js';
import { NOTES } from '../punktext.js';
import { levelOf } from '../augments.js';
import { zoneName } from '../zonelook.js';
import { height } from '../world.js';
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
import { buildProp, SCENES } from './caseprops.js';
import { makeChase } from './casechase.js';
import { caseCss } from './casecss.js';

const ON = MAP_ID === 'namsongi';
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const NOTE_BY = Object.fromEntries(NOTES.map((n) => [n.id, n]));
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- 저장 (로그인 뒤 저장이 바뀌어도 맞게 매번 봄) ---------- */
function S(id) {
  if (!isObj(save.cases)) save.cases = {};
  const c = CASE_BY[id];
  let s = save.cases[id];
  if (isObj(s) && c?.v && +s.v !== c.v) { s = null; dropOld(c); } /* 옛 내용으로 진행한 저장 (#246): 처음으로 */
  if (!isObj(s)) s = save.cases[id] = { w: 0, ev: [], f: 0, ...(c?.v ? { v: c.v } : {}) };
  s.w = Number.isFinite(+s.w) && +s.w > 0 ? +s.w : 0;
  const ids = new Set((c?.ev || []).map((e) => e.id));
  s.ev = Array.isArray(s.ev) ? s.ev.filter((e, i, a) => ids.has(e) && a.indexOf(e) === i) : [];
  s.f = s.f ? 1 : 0; s.a = s.a ? 1 : 0; s.r = s.r || s.f ? 1 : 0; /* r: 대면 조건을 채움 (watch 사건은 그 뒤 다가가 보기 장면, #236) */
  if (!isObj(s.base)) s.base = {};
  return s;
}
function dropOld(c) { /* 옛 판 쪽지를 주운 쪽지·안 읽음에서 뺌 */
  const P = save.punk, d = c.drop || []; if (!isObj(P) || !d.length) return;
  if (isObj(P.notes)) for (const id of d) delete P.notes[id];
  if (Array.isArray(P.unread)) P.unread = P.unread.filter((x) => !d.includes(x));
  persist();
}
const lv = () => { try { return levelOf(save.lv?.xp || 0).lv; } catch { return 1; } };
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
  if (hit && evAll(c)) {
    if (c.face.watch) { if (!s.r) { s.r = 1; persist(); late.questTrackDirty?.(true); } return false; } /* 다가가 보기 장면이 끝나면 (#236) */
    if (c.face.follow) { if (!s.a) { s.a = 1; persist(); chase?.start(c); } return false; } /* 따라가기 장면이 끝나면 chaseDone */
    if (c.face.scene) { if (!s.r) { s.r = 1; persist(); late.questTrackDirty?.(true); say('quest', 'case-scene:' + c.id, `${c.name} · ${c.face.label || '살펴보기'} 자리로`, 3, { ttl: 40 }); } return false; } /* #235 장면 자리에서 상호작용 */
    s.f = 1; persist(); gotDoc(c); return true;
  }
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
const objs = []; // { c, kind 'see'|'ev'|'face'|'drop', e?, root, pos, show() }
function place(c, kind, at, prop, e = null, show) {
  const pos = free(at), root = buildProp(prop); if (!root) return null;
  if (root.userData.place) root.userData.place(pos.x, pos.z); /* 땅을 따라 휘는 모양 (crop) */
  else { root.position.copy(pos); root.rotation.y = kind === 'see' || kind === 'drop' ? 0 : Math.atan2(-pos.x + c.see.at[0], -pos.z + c.see.at[1]) || 0; }
  root.visible = false; scene.add(root);
  const o = { c, kind, e, root, pos, show }; objs.push(o); return o;
}
const spots = {}; // id → { see, ev: { id: pos }, face, drop: obj }
if (ON) for (const c of CASES) {
  const sp = spots[c.id] = { ev: {} };
  const see = place(c, 'see', c.see.at, c.see.prop, null, () => (lv() >= c.lv || isOpen(c.id)) && !(c.see.gone && S(c.id).f)); sp.seeRoot = see?.root || null; sp.see = see?.pos || v3(...c.see.at);
  if (c.trail?.pts && late.caseFoot) { const im = late.caseFoot(c.trail.pts, c.trail.size, c.trail.step); objs.push({ c, kind: 'trail', root: im, pos: v3(...c.trail.pts[Math.floor(c.trail.pts.length / 2)]), show: () => lv() >= c.lv || isOpen(c.id) }); } /* 발자국 한 줄 (#236) */
  for (const e of c.ev) {
    if (e.kind === 'act' || !e.at) continue;
    const o = place(c, 'ev', e.at, e.prop, e, () => isOpen(c.id) && (!!e.view || !evGot(c, e))); /* 찍는 바위(view)는 남음 */ sp.ev[e.id] = o?.pos || v3(...e.at);
    interactables.push({ label: e.label || '살펴보기', ic: e.kind === 'photo' ? 'photo' : e.kind === 'note' ? 'notes' : 'eye', pos: sp.ev[e.id], r: CASE.r,
      when: () => isOpen(c.id) && !evGot(c, e) && !run && !state.cine && !late.tut?.active, act: () => takeEv(c, e) });
  }
  if (c.face?.at) {
    const o = place(c, 'face', c.face.at, c.face.prop || 'bush', null, () => isOpen(c.id) && (!(c.face.watch || c.face.wait) || (!!S(c.id).r && !(c.face.wait && S(c.id).f)))); sp.face = o?.pos || v3(...c.face.at); sp.faceObj = o;
    if (c.face.watch) interactables.push({ label: c.face.label || '다가가 보기', ic: 'eye', pos: sp.face, r: CASE.r + 3, /* 대면 조건 뒤 장면 (#236) */
      when: () => isOpen(c.id) && S(c.id).r && !S(c.id).f && !run && !state.cine && !late.tut?.active, act: () => beginWatch(c) });
    if (c.face.scene) interactables.push({ label: c.face.label || '살펴보기', ic: 'eye', pos: sp.face, r: CASE.r + 0.6, /* 싸움 뒤 장면 (#235) */
      when: () => isOpen(c.id) && evAll(c) && S(c.id).r && !S(c.id).f && !run && !state.cine && !late.tut?.active, act: () => beginHide(c) });
    if (c.face.kind === 'hide') interactables.push({ label: c.face.label || '숨어 보기', ic: 'eye', pos: sp.face, r: CASE.r + 0.6,
      when: () => isOpen(c.id) && evAll(c) && !S(c.id).f && !run && !state.cine && !late.tut?.active, act: () => beginHide(c) });
    /* 장면에서 목격 자리 가운데로 떨어지는 모양: 대면 뒤 종결 전까지 그 자리에 */
    if (c.face.drop) sp.drop = place(c, 'drop', c.see.at, c.face.drop, null, () => (S(c.id).f || (run?.c === c && run.u >= run.fall0)) && !closed(c));
  }
}
// 추적 줄 갈 곳 (game/quest.js goPos)
late.casePos = (go) => {
  const [, id, what] = go.split(':'), c = CASE_BY[id], sp = spots[id]; if (!c || !sp) return null;
  if (what === 'face') { /* 따라가기 (#233): 흰 옷 → 없으면 그 구역 서바이벌 터 */
    if (c.face?.follow) { const g = chase?.pos(c); if (g) return g; const a = c.face.kind === 'arena' && SWARM.arena?.at?.[c.zone]; if (a) return v3(a[0], a[1]); }
    if (c.face?.kind === 'boss' && (c.face.watch || c.face.scene) && !S(id).r) { const b = late.field?.api?.bosses?.find((q) => q.zone === c.zone); if (b) return v3(b.x, b.z); } /* 다가가 보기 (#236): 우두머리 전엔 빈터로 */
    const s = S(id), ar = SWARM.arena?.at?.[c.zone];
    if (c.face.kind === 'arena' && c.face.scene && !s.r && !s.f && ar) return v3(ar[0], ar[1]); /* #235 터를 먼저 버팀 */
    return sp.face ? sp.face.clone() : sp.see.clone();
  }
  let b = null, bd = Infinity;
  for (const e of c.ev) { const p = sp.ev[e.id]; if (!p || evGot(c, e)) continue; const d = (p.x - player.pos.x) ** 2 + (p.z - player.pos.z) ** 2; if (d < bd) { bd = d; b = p; } }
  return b ? b.clone() : sp.see.clone();
};

/* ---------- 흰 옷 따라가기 (#233, game/casechase.js) ---------- */
const chase = ON ? makeChase({
  S, closed, lv, fightNow: () => fightNow(),
  spot: (id) => ({ see: spots[id].see, free: (at) => free(at) }),
  done: (c) => { const s = S(c.id); if (s.f) return; s.f = 1; persist(); if (!haveNote(c.doc)) setTimeout(() => gotDoc(c), 400); late.questTrackDirty?.(true); syncBtns(); },
}) : null;
// 종결한 사건의 NPC 인사 (game/quest.js greet)
late.caseHello = (gid) => CASES.filter((c) => closed(c)).flatMap((c) => caseHello(c, gid));

/* ---------- 목격 ---------- */
function openCase(c, quiet = false) {
  const s = S(c.id); if (s.w) return false;
  s.w = Date.now(); s.base = {}; for (const e of c.ev) if (e.kind === 'act' && e.k) s.base[e.k] = qc(e.k);
  s.b = +save.boss?.done?.[c.zone] || 0; s.s = +save.swarm?.won?.[c.zone]?.at || 0; persist();
  syncBtns(); late.questTrackDirty?.(true);
  if (quiet) return true;
  chase?.glimpse(c); /* #233 흰 옷이 스침 */
  if (!late.mutterApi?.line?.('case:' + c.id, c.see.say)) toast(c.see.say, 3);
  setTimeout(() => say('quest', 'case-open:' + c.id, `사건 파일에 한 줄 · '${c.name}' 미해결`, 3.6, { ttl: 60 }), 3200);
  return true;
}
function takeEv(c, e) {
  const s = S(c.id); if (!s.w || s.ev.includes(e.id)) return;
  s.ev.push(e.id); persist(); late.sound?.snip?.();
  if (e.view && beginView(c, e)) return; /* 위에서 찍는 장면 뒤에 쪽지·알림 (stopRun) */
  evSaid(c, e);
}
function evSaid(c, e) {
  if (e.note) late.punkWorld?.note?.give(e.note); // 쪽지 창이 열림 (싸우는 중이면 표시만)
  const n = evN(c);
  say('quest', 'case-ev:' + e.id, n >= c.ev.length ? `증거 ${n}/${c.ev.length} · 다 모았어요. ${CASE_GIVER(c)} 가 봐요` : `증거 ${n}/${c.ev.length} · 사건 파일에 붙였어요`, 3, { ttl: 40 });
  late.questTrackDirty?.(true); syncBtns();
}
const fightNow = () => !!player.down || !!late.bossFight?.() || !!late.swarm?.state?.() || !!life?.enemies?.near?.(player.pos, 18); /* 숨어 보기는 가까이 적이 없을 때만 */
const CASE_GIVER = (c) => (late.questDebug?.givers?.get?.(c.giver)?.name || '의뢰한 사람') + (String(c.giver).startsWith('b:') ? '으로' : '에게'); /* 표지판으로 · 오름지기에게 */
function gotDoc(c) { if (c.doc) late.punkWorld?.note?.give(c.doc); late.questTrackDirty?.(true); }

/* ---------- 장면: 숨어 보기 (hide) · 위에서 찍기 (view) ---------- */
let run = null; // { mode 'hide'|'view', c, e?, u, len, prev, fov, li, snap, fall0, fell }
const css = document.createElement('style');
css.textContent = caseCss(CASE_SLOTS);
document.head.append(css);
const cine = document.createElement('div'); cine.id = 'case-cine'; cine.hidden = true;
cine.innerHTML = '<div class="cc-line"></div><button type="button" class="cc-sk">건너뛰기</button>';
document.body.append(cine);
const lineEl = cine.querySelector('.cc-line'), skBtn = cine.querySelector('.cc-sk');
skBtn.addEventListener('click', (e) => { e.stopPropagation(); stopRun(); });
for (const ev of ['pointerdown', 'pointermove', 'wheel', 'touchstart']) cine.addEventListener(ev, (e) => { if (e.target !== skBtn) e.preventDefault(); }, { passive: false });
addEventListener('keydown', (e) => { if (run && e.key === 'Escape') { e.preventDefault(); stopRun(); } });

function startRun(r) { // 공통: 조작 잠금·카메라 cine·화면 띠
  late.mutterApi?.hush?.();
  run = { u: 0, prev: cam.mode, fov: camera.fov, li: -1, snap: true, fall0: Infinity, ...r };
  state.cine = run; cam.mode = 'cine'; player.target = null; player.speed = 0;
  cine.hidden = false; skBtn.hidden = true; lineEl.classList.remove('on'); lineEl.textContent = '';
  cine.className = ''; document.body.classList.add('case-cine'); requestAnimationFrame(() => cine.classList.add('on'));
  director.begin('story', 'case:' + r.c.id, Infinity);
}
function beginView(c, e) { // 위에서 찍기: 목격 자리를 위에서 내려다봄 · 찰칵 (증거는 이미 셈)
  if (state.cine || run) return false;
  startRun({ mode: 'view', c, e, len: CASE.view.len });
  requestAnimationFrame(() => { cine.classList.add('flash'); setTimeout(() => { if (run?.mode === 'view') { cine.classList.remove('flash'); cine.classList.add('shot'); } }, 120); });
  return true;
}
function beginHide(c) {
  if (state.cine || run) return false;
  if (fightNow()) { toast('지금은 숨을 때가 아니에요 · 싸움부터', 2.4); return false; }
  const sp = spots[c.id], hide = sp.face, mid = sp.see, len = c.face.len || 9;
  startRun({ mode: 'hide', c, len, fall0: c.face.drop ? len * CASE.face.dropAt - 0.8 : Infinity, sc: SCENES[c.face.scene] || null, tint: c.face.tint || (c.face.dawn ? 'dawn' : c.face.scene ? 'dusk' : '') });
  if (run.sc) { run.ctx = { scene, see: mid, face: hide, seeRoot: sp.seeRoot, faceRoot: sp.faceObj?.root || null, blocked: (x, z, r) => !!col?.blocked(x, z, r), groundAt: (x, z) => height(x, z) }; run.st = run.sc.begin(run.ctx); } /* #235 장면 틀 */
  { const dx = hide.x - mid.x, dz = hide.z - mid.z, L = Math.hypot(dx, dz) || 1, px = hide.x - dz / L * 0.9 + dx / L * 0.5, pz = hide.z + dx / L * 0.9 + dz / L * 0.5; player.pos.set(px, height(px, pz), pz); player.visY = player.pos.y; } /* 수풀 옆 (카메라는 반대쪽 옆) */
  player.heading = Math.atan2(mid.x - player.pos.x, mid.z - player.pos.z); player.pose = 'crouch'; player.poseT = 0;
  const tint = run.tint; if (tint === 'mist') requestAnimationFrame(() => cine.classList.add('mist')); else if (tint) setTimeout(() => { if (run?.mode === 'hide') cine.classList.add(tint); }, 300);
  return true;
}
// 대면 watch (#236 사건 5): 대면 조건(우두머리 등)을 채운 뒤 face 자리에서 상호작용 → 뒤에서 조용히 다가가 봄. 모양(prop)의 userData.anim(u) 이 장면을 움직임
function beginWatch(c) {
  if (state.cine || run) return false;
  if (fightNow()) { toast('지금은 다가갈 때가 아니에요 · 싸움부터', 2.4); return false; }
  const sp = spots[c.id], f = sp.face, yaw = sp.faceObj?.root.rotation.y || 0, bx = Math.sin(yaw), bz = Math.cos(yaw); /* 모양의 등 쪽(+z) */
  const W = CASE.watch, clear = (k) => [1, 0.6, 0.3].every((t) => !col?.blocked(f.x + (bx * W.camBack + bz * W.camSide * k) * t, f.z + (bz * W.camBack - bx * W.camSide * k) * t, 1.4));
  startRun({ mode: 'watch', c, len: c.face.len || 10, bx, bz, side: [-1, 1, -0.3, 0.3].find(clear) ?? 0 }); /* 바위·나무가 가리지 않는 쪽 */
  { const px = f.x + bx * W.back + bz * 1.1, pz = f.z + bz * W.back - bx * 1.1; /* 등 뒤, 봉지 무더기 반대쪽으로 조금 */ player.pos.set(px, height(px, pz), pz); player.visY = player.pos.y; }
  player.heading = Math.atan2(f.x - player.pos.x, f.z - player.pos.z); player.pose = 'crouch'; player.poseT = 0;
  setTimeout(() => { if (run?.mode === 'watch') cine.classList.add('snow'); }, 300);
  return true;
}
function stopRun() {
  if (!run) return;
  const r = run; run = null; if (state.cine === r) state.cine = null;
  if (r.sc) r.sc.end(r.st, r.ctx);
  camera.fov = r.fov; camera.updateProjectionMatrix();
  cine.className = ''; cine.hidden = true; document.body.classList.remove('case-cine');
  if (player.pose === 'crouch') player.pose = 'move';
  cam.mode = r.prev && r.prev !== 'cine' && r.prev !== 'title' ? r.prev : 'follow'; if (cam.mode === 'follow') followCam(0, true);
  director.end('case:' + r.c.id);
  const d = spots[r.c.id]?.drop; if (d) d.root.position.copy(d.pos);
  if (r.mode === 'watch') spots[r.c.id].faceObj?.root.userData.anim?.(1);
  if (r.mode === 'view') { setTimeout(() => evSaid(r.c, r.e), 250); return; }
  const s = S(r.c.id); s.f = 1; persist(); if (!haveNote(r.c.doc)) setTimeout(() => gotDoc(r.c), 400); /* 건너뛰어도 끝난 것으로 */
  late.questTrackDirty?.(true); syncBtns();
}
{ const prev = late.cineCam; late.cineCam = (dt) => { if (run && state.cine === run) runCam(dt); else prev?.(dt); }; }
function runCam(dt) {
  if (run.sc?.cam) { const v = run.sc.cam(run.st, run.u, run.len, run.ctx); camTarget.pos.copy(v.pos); camTarget.look.copy(v.look); ease(dt, run.snap && !(run.snap = false), 2.4); return; } /* #235 */
  const sp = spots[run.c.id], mid = sp.see;
  if (run.mode === 'watch') { /* 쪼그린 나의 어깨 뒤에서 흰 등을 봄 (#236) */
    const f = sp.face, W = CASE.watch, sd = W.camSide * run.side, cx = f.x + run.bx * W.camBack + run.bz * sd, cz = f.z + run.bz * W.camBack - run.bx * sd;
    camTarget.pos.set(cx, Math.max(height(cx, cz), f.y) + W.camUp, cz); camTarget.look.set(f.x - run.bz * 0.8, f.y + 1.1, f.z + run.bx * 0.8); /* 흰 등과 옆 봉지 무더기 사이 */ ease(dt, run.snap && !(run.snap = false), 2.4); return;
  }
  if (run.mode === 'view') { // 찍는 자리 쪽 하늘에서 무늬 가운데를 내려다봄
    const at = sp.ev[run.e.id] || mid, dx = at.x - mid.x, dz = at.z - mid.z, L = Math.hypot(dx, dz) || 1, V = CASE.view;
    camTarget.pos.set(mid.x + dx / L * V.side, mid.y + V.up, mid.z + dz / L * V.side); camTarget.look.copy(mid);
    ease(dt, run.snap && !(run.snap = false), 3); return;
  }
  // 수풀 뒤 낮은 눈높이에서 무늬 가운데를 봄 (하늘은 화면 위 띠·새벽빛에 묻힘)
  const h = sp.face, dx = h.x - mid.x, dz = h.z - mid.z, L = Math.hypot(dx, dz) || 1, F = CASE.face;
  const cx = mid.x + dx / L * F.camBack + dz / L * F.camSide, cz = mid.z + dz / L * F.camBack - dx / L * F.camSide;
  camTarget.pos.set(cx, Math.max(height(cx, cz) + F.camUp, mid.y + F.camUp), cz);
  camTarget.look.set(mid.x, mid.y + 0.4, mid.z);
  ease(dt, run.snap && !(run.snap = false), 2.4);
}
function tickRun(dt) {
  const r = run; if (!r) return;
  if (state.cine !== r) { run = null; if (r.sc) r.sc.end(r.st, r.ctx); cine.className = ''; cine.hidden = true; document.body.classList.remove('case-cine'); director.end('case:' + r.c.id); return; }
  r.u += dt; const u = r.u, T = r.len;
  if (r.mode === 'view') { if (u >= T) stopRun(); return; }
  const L = r.c.face.lines || [];
  skBtn.hidden = u < CASE.face.skipAfter;
  const li = Math.min(L.length - 1, Math.floor(u / (T / Math.max(1, L.length))));
  if (li !== r.li && L[li]) { r.li = li; lineEl.classList.remove('on'); void lineEl.offsetWidth; lineEl.textContent = L[li]; lineEl.classList.add('on'); }
  if (r.sc) { r.sc.tick(r.st, u, T, r.ctx); if (r.tint === 'mist' && u > T * 0.18) cine.classList.add('clear'); if (u >= T) stopRun(); return; } /* #235 */
  if (r.mode === 'watch') spots[r.c.id].faceObj?.root.userData.anim?.(Math.min(1, u / T), u);
  // 떨어지는 모양: fall0 부터 0.8초 동안 위에서 가운데로 (떨어뜨린 것은 보이지 않음), 닿으면 '툭'
  const d = spots[r.c.id]?.drop;
  if (d && u >= r.fall0) {
    const k = Math.min(1, (u - r.fall0) / 0.8);
    d.root.visible = true; d.root.position.set(d.pos.x, d.pos.y + CASE.face.drop * (1 - k * k), d.pos.z); d.root.rotation.y = (1 - k) * 2.4;
    if (k >= 1 && !r.fell) { r.fell = true; try { late.sound?.thud?.(true); } catch { /* 소리 없음 */ } }
  }
  if (u >= T) stopRun();
}

/* ---------- 종결 (game/quest.js 가 보상을 준 뒤) ---------- */
{ const prev = late.questGave; late.questGave = (q) => {
  prev?.(q);
  const c = CASES.find((x) => caseLastQuest(x) === q.id); if (!c) return;
  if (c.title) late.titles?.give(c.title);
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
let sel = null; // 아래에 펼친 사건 id
const TILT = ['-3deg', '2deg', '-1.5deg', '3deg', '-2.5deg'];
function pick() { // 처음 펼칠 사건: 진행 중인 것 중 가장 최근 → 없으면 가장 최근에 연 것
  const open = CASES.filter((c) => isOpen(c.id)).sort((x, y) => S(y.id).w - S(x.id).w);
  return (open.find((c) => !closed(c)) || open[0])?.id || null;
}
function board() { // 코르크판: 사건마다 사진 자리 하나. 종결 → 사진·핀, 진행 중 → 빈 사진·미해결, 아직 → 점선 자리
  const pics = [];
  for (let n = 1; n <= CASE_SLOTS; n++) {
    const c = CASES.find((x) => x.n === n), r = `--r:${TILT[(n - 1) % TILT.length]}`;
    if (!c || !isOpen(c.id)) { pics.push(`<div class="cf-pic empty${c ? ' lock' : ''}" style="${r}" data-n="${n}"><span class="cf-ph">${n}</span><span>${c ? `레벨 ${c.lv}` : '?'}</span></div>`); continue; }
    const done = closed(c), ph = done && haveNote(c.doc) ? casePhoto(c) : '';
    pics.push(`<button type="button" class="cf-pic${done ? ' done' : ''}${sel === c.id ? ' sel' : ''}" style="${r}" data-n="${n}" data-case="${c.id}" aria-label="${esc(c.name)}">${done ? '<i class="cf-pin"></i>' : ''}`
      + `${ph ? `<img src="${ph}" alt="" draggable="false">` : '<span class="cf-ph">?</span>'}<span>${esc(c.name)}</span><span class="cf-st ${done ? 'done' : 'open'}">${done ? '종결' : '미해결'}</span></button>`);
  }
  return `<div class="cf-board"><div class="cf-pics">${pics.join('')}</div><svg class="cf-thread" aria-hidden="true"></svg></div>`;
}
function detail(c) { // 펼친 사건: 목격·증거 셋·사진 칸 (칸을 누르면 쪽지)
  const done = closed(c);
  const cells = [slot('see', 'eye', '목격', '', null).replace('cf-slot see', 'cf-slot got see')];
  c.ev.forEach((e, i) => { const got = evGot(c, e), n = e.note && NOTE_BY[e.note]; cells.push(slot('ev', EV_IC[e.kind] || 'eye', got ? (n?.t || '증거') : `증거 ${i + 1}`, got ? '' : '?', got && n && haveNote(e.note) ? e.note : null)); });
  const dg = haveNote(c.doc); cells.push(slot('doc', 'photo', dg ? NOTE_BY[c.doc]?.t || '증거 사진' : '증거 사진', dg ? '' : '?', dg ? c.doc : null));
  return `<div class="cf-case"><span class="cf-st ${done ? 'done' : 'open'}">${done ? '종결' : '미해결'}</span><h3>${esc(c.name)}</h3><p class="cf-sub">사건 ${c.n} · ${esc(zoneName(c.zone))} · 증거 ${evN(c)}/${c.ev.length}</p><div class="cf-row">${cells.join('')}</div></div>`;
}
function build() {
  if (!sel || !isOpen(sel)) sel = pick();
  let h = board();
  if (!anyOpen()) h += '<p class="cf-empty">아직 열린 사건이 없어요. 오름은 평화로워 보여요(겉으로는)</p>';
  else if (CASE_BY[sel]) h += detail(CASE_BY[sel]);
  $('case-file-body').innerHTML = h;
  late.reportBoard?.($('case-file-body')); // 오늘의 미확인 제보 칸 (#238, game/reports.js)
  requestAnimationFrame(thread);
}
function thread() { // 빨간 실: 종결된 사진의 핀을 차례로 잇고, 끝은 다음 빈 자리 위로 늘어뜨림
  const bd = win.querySelector('.cf-board'), svg = bd?.querySelector('.cf-thread'); if (!svg || win.hidden) return;
  const B = bd.getBoundingClientRect(); svg.setAttribute('viewBox', `0 0 ${B.width} ${B.height}`);
  const at = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2 - B.left, r.top - B.top]; };
  const done = [...bd.querySelectorAll('.cf-pic.done')], pins = done.map((e) => { const r = e.querySelector('.cf-pin').getBoundingClientRect(); return [r.left + r.width / 2 - B.left, r.top + r.height / 2 - B.top]; });
  const sag = (p, q) => { const mx = (p[0] + q[0]) / 2, my = Math.max(p[1], q[1]) + Math.min(28, Math.hypot(q[0] - p[0], q[1] - p[1]) * 0.18); return `M${p[0].toFixed(1)} ${p[1].toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${q[0].toFixed(1)} ${q[1].toFixed(1)}`; };
  let d = ''; for (let i = 1; i < pins.length; i++) d += sag(pins[i - 1], pins[i]) + ' ';
  let loose = '';
  if (pins.length && pins.length < CASE_SLOTS) { /* 마지막 핀 → 그 뒤 첫 빈 자리 (없으면 앞쪽 첫 빈 자리) */
    const last = +done[done.length - 1].dataset.n, empty = [...bd.querySelectorAll('.cf-pic:not(.done)')], nx = empty.find((e) => +e.dataset.n > last) || empty[0];
    if (nx) loose = sag(pins[pins.length - 1], at(nx));
  }
  svg.innerHTML = (d ? `<path d="${d.trim()}"/>` : '') + (loose ? `<path class="loose" d="${loose}"/>` : '');
}
addEventListener('resize', () => { if (!win.hidden) requestAnimationFrame(thread); });
$('case-file-body').addEventListener('click', (e) => {
  const p = e.target.closest('[data-case]'); if (p) { sel = p.dataset.case; build(); return; }
  const b = e.target.closest('[data-note]'); if (!b) return; win.hidden = true; late.punkWorld?.note?.open(b.dataset.note);
});
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
let chkT = 0, animT = 0;
const animObjs = objs.filter((o) => o.root.userData.tick);
function tickCases(dt) {
  state.ticks.cases++;
  if (run) tickRun(dt);
  if (chase) chase.tick(dt, CASES);
  animT += dt; for (const o of animObjs) if (o.root.visible && !o.root.userData.hold) o.root.userData.tick(animT, dt); /* 움직이는 모양 (neck 등) */
  if (!ON || (chkT -= dt) > 0) return; chkT = CASE.seeT;
  const px = player.pos.x, pz = player.pos.z, far2 = CASE.far * CASE.far;
  for (const o of objs) { const vis = (o.pos.x - px) ** 2 + (o.pos.z - pz) ** 2 < far2 && !state.cave && !!o.show(); if (o.root.visible !== vis && !o.root.userData.hold) o.root.visible = vis; }
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
  state: (id = 'c1') => { const c = CASE_BY[id]; if (!c) return null; const s = S(id); return { ...JSON.parse(JSON.stringify(s)), open: !!s.w, ev: evN(c), all: evAll(c), face: faceDone(c), closed: closed(c), lv: lv(), need: c.lv, run: run && { mode: run.mode, u: +run.u.toFixed(1) }, btn: !menuBtn.hidden }; },
  board: () => ({ pics: win.querySelectorAll('.cf-pic').length, done: win.querySelectorAll('.cf-pic.done').length, img: win.querySelectorAll('.cf-pic.done img').length, pins: win.querySelectorAll('.cf-pin').length, thread: win.querySelectorAll('.cf-thread path').length, sel }),
  spots: (id = 'c1') => { const sp = spots[id]; if (!sp) return null; const r = (p) => p && [+p.x.toFixed(1), +p.z.toFixed(1)]; return { see: r(sp.see), face: r(sp.face), ev: Object.fromEntries(Object.entries(sp.ev).map(([k, p]) => [k, r(p)])) }; },
  objs: () => objs.map((o) => ({ id: o.c.id, kind: o.kind, ev: o.e?.id || null, vis: o.root.visible })),
  open: (id = 'c1') => openCase(CASE_BY[id]), take: (id, eid) => { const c = CASE_BY[id], e = c?.ev.find((x) => x.id === eid); if (e) takeEv(c, e); return evN(c); },
  arena: (z) => SWARM.arena?.at?.[z] || null, scene: () => run?.sc && { name: run.c.face.scene, shown: !!run.st?.h?.visible, u: +run.u.toFixed(1) },
  busy: () => fightNow(), chase: () => chase?.state() || null, hello: (g) => late.caseHello(g), chaseJump: (u) => chase?.jump(u), chaseNext: () => chase?.next(),
  hide: (id = 'c1') => beginHide(CASE_BY[id]), watch: (id = 'c5') => beginWatch(CASE_BY[id]), stop: stopRun, view: () => run?.mode || null, jump: (u) => { if (run) run.u = u; },
  file: openFile, fileOpen: () => !win.hidden, build, html: () => $('case-file-body').innerHTML,
  reset: (id = 'c1') => { if (isObj(save.cases)) delete save.cases[id]; persist(); syncBtns(); },
};
