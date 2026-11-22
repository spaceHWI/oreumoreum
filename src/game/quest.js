// 퀘스트 (#158): src/quest.js(차례·진행)를 게임에 붙인다. 파일 순서는 boss 뒤 (src/modules.js, 규칙은 notes/prototype-v1.md)
// - 주는 사람: 오름지기(들머리 안내판 옆, 밀짚모자), 구역 클린하우스 옆 표지판(구역 2~5), 가게 앞 주인(가게 퀘스트). 머리 위 노란 !(줄기 받기)·노란 ?(돌려주기)·흰 !(곁가지)·회색 ?(하는 중)
//   다가가 상호작용(F) → 받기·끝내기 창(#quest, 폰은 아래에서 올라오는 한 장). 미니맵·큰 지도에도 같은 표시(late.questIcons)
// - 추적 줄(#quest-track): 화면 위 한 줄 '할 일 (1/3)' + 방향 화살표·거리. 누르면 그쪽으로 자동으로 걸어감(dump.js startAutoGo), 조건을 채우면 노랗게 '○○에게 돌아가기'
//   #142 '다음 할 일'(game/nexthint.js late.nextHint): 배낭 참·귤 닿음·HP 낮음이면 잠깐 바뀌고, 줄기 퀘스트가 끝난 사람에게 이어 줄 것을 이 줄에 씀
// - 퀘스트 창(#qlog, 메뉴·L·추적 줄 목록 단추): 하는 중·끝낸 것
// - 셈: 업적 사건(ach.emit)·더미 치움(trash.on, 남이 치운 것은 QUESTS.coopR 안이면)·소굴 닫음(field.js late.questEv)을 save.quest.c 에. 장비·우두머리·구역은 저장에서 바로 읽음
// - 감독(#176): 문 quest(정낭을 나서면 오름지기 첫 퀘스트)·shopQuest(첫 버리기 뒤 장비점 주인)·shopQuests(2일째나 구역 2: 다른 가게 주인)를 등록. 조건을 채움·주운 실마리는 say('quest')
// - 할인권: late.questOff(가게, 값) → 깎을 귤, late.questUse(가게) 한 장 씀 (shop.js 장비·옷, stores.js 머리·에이드)
// dev: __oreum.quest (state·give(id)·done(id)·count(k, n)·go()·open(giver)·where())
import * as THREE from 'three';
import { QUESTS, CLOTHES, TALK } from '../balance.js';
import { createQuests } from '../quest.js';
import { STREET } from '../streetlayout.js';
import { buildRunner, DEFAULT_OUTFIT } from '../runner.js';
import { gradHard } from '../toon.js';
import { TEXCS } from '../boot.js';
import { height } from '../world.js';
import { LOW } from '../gfx2.js';
import { state, late } from './state.js';
import { $, save, persist, isTouch, CL } from './save.js';
import { scene, camera, spots } from './scene.js';
import { player, trash, CHS, shopsBuilt, col, buff, cairns } from './place.js';
import { toast, panelOpen, closePanels, ach, tipMark } from './hud.js';
import { director, say } from './director.js';
import { social } from './room.js';
import { interactables } from './stores.js';
import { startAutoGo, stopAutoGo, autoGo } from './dump.js';
import { cam } from './camera.js';
import { gyulShower } from './hooks.js';
import { icon } from '../icons.js';

const Q = QUESTS;
const v3 = (x, z, y = 0) => new THREE.Vector3(x, height(x, z) + y, z);
const zoneAt = (x, z) => (trash ? trash.zoneAt(x, z) || 0 : 0);
const shopOf = (id) => shopsBuilt.find((sh) => sh.id === id) || null;

/* ---------- 셈 ---------- */
const EV = { trash: 'trash', recycle: 'recycle', 'enemy-repel': 'repel', 'dumper-repel': 'dumper', fish: 'fish', stone: 'stone', meal: 'meal', haircut: 'haircut', 'clothes-buy': 'clothes', photo: 'photo', emote: 'emote', 'satis-meal': 'satisMeal' };
const VAL = {
  gearTB: () => (save.equip.tool | 0) + (save.equip.bag | 0),
  gearAll: () => (save.equip.tool | 0) + (save.equip.bag | 0) + (save.equip.weapon | 0),
  tool: () => save.equip.tool | 0, bag: () => save.equip.bag | 0, weapon: () => Math.max(0, (save.equip.weapon | 0) - 1),
  zone: () => save.journey?.maxZ || 0,
};
const val = (k) => { if (VAL[k]) return VAL[k](); if (k.startsWith('story:')) return save.story?.done?.includes?.(k.slice(6)) ? 1 : 0; /* #168 이야기 이벤트를 끝냄 */ if (k.startsWith('boss@')) return (save.boss?.done?.[k.slice(5)] > 0) ? 1 : 0; return quests.state().c[k] || 0; };
const life = () => save.ach?.life || {};
// 옛 저장에서 이미 한 것 (catchUp): 그 구역을 끝냈으면 그 구역 퀘스트는 모두, 아니면 평생 기록으로 어림
function oldDone(q) {
  if (q.z && save.boss?.done?.[q.z] > 0) return true;
  const { k, n, ever } = q.ask, L = life();
  if (ever) return val(k) >= n;
  const by = { trash: L.trash, heapRoad: L['heap-clear'], recycle: L.recycle, dumper: L['dumper-repel'], 'repel:piglet': L['enemy-repel-piglet'], 'repel:dog': L['enemy-repel-dog'],
    gearTB: VAL.gearTB() - 3, gearAll: VAL.gearAll() - 4 }; // 튜토리얼을 마치면 집게(2)·첫 배낭(1)·손(1)
  if (k.startsWith('den@')) return Object.keys(save.field?.den || {}).some((id) => id.startsWith('d' + k.slice(4) + '-'));
  return k in by ? (+by[k] || 0) >= n : false;
}

export const quests = createQuests({
  save, persist, defs: Q,
  hooks: {
    val, oldDone,
    has: (need) => (need.startsWith('shop:') ? !!shopOf(need.slice(5)) && late.shopOpen?.(need.slice(5)) !== false : need === 'loot' ? !!late.loot : need.startsWith('story:') ? !!save.story?.done?.includes?.(need.slice(6)) : false), // #168 이야기 곁가지는 그 이벤트를 끝낸 뒤
    door: (id) => director.isOpen(id),
    open: () => director.isOpen('quest'),
    ready: (q) => onReady(q),
  },
});
// 옛 저장: 튜토리얼을 마친 저장에 퀘스트가 처음 생김 → 이미 한 것은 건너뜀 (감독 문이 열린 뒤)
let needCatch = quests.wasFresh && !!(save.tut?.done || save.jeong);
const count = (k, n = 1) => { quests.count(k, n); };
{ const emit = ach.emit; ach.emit = (ev, n = 1) => { emit(ev, n); try { onEv(ev, n); } catch (e) { /* 셈은 게임을 멈추지 않음 */ } }; }
function onEv(ev, n) {
  const k = EV[ev]; if (k) count(k, n);
  if (ev.startsWith('enemy-repel-')) count('repel:' + ev.slice(12), n);
  if (ev === 'enemy-repel' && buff.now()) count('repelBuff', n);
  if (ev === 'dumper-repel') count('dumper@' + zoneAt(player.pos.x, player.pos.z), n);
}
if (trash) trash.on((ev, d) => {
  if (ev !== 'heap-clear') return; const h = trash.heaps[d.h]; if (!h) return;
  if (d.by && Math.hypot(h.x - player.pos.x, h.z - player.pos.z) > Q.coopR) return; // 같이 치운 더미만
  count(h.field ? 'heapField' : 'heapRoad'); count('heap@' + h.zone);
});
late.questEv = (k, n = 1) => count(k, n);
late.questTrackDirty = (bump) => trackDirty(bump);

/* ---------- 주는 사람 ---------- */
const tm = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: gradHard });
const MARK = {}; // 머리 위 표시 재질 ('!' '?' 'w' 'g')
function markTex(ch, fill, ink) {
  const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d');
  g.beginPath(); g.arc(48, 48, 40, 0, 7); g.fillStyle = fill; g.fill(); g.lineWidth = 6; g.strokeStyle = 'rgba(40,28,0,.85)'; g.stroke();
  g.font = '900 60px "Gothic A1", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = ink; g.fillText(ch, 48, 52);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = TEXCS; return new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false });
}
MARK['!'] = markTex('!', '#ffd23f', '#3a2a00'); MARK['?'] = markTex('?', '#ffd23f', '#3a2a00'); MARK.w = markTex('!', '#ffffff', '#33332e'); MARK.g = markTex('?', '#a9a9a2', '#33332e');
const MARK_SIDE_NEAR = 30; // 곁가지 받기 표시(흰 !)는 이 거리(m) 안에서만 (#201)
const givers = new Map(); // id → { id, name, pos, root, runner?, mark: Sprite, h, kind }
function addGiver(id, pos, root, h, runner = null, face = 0) {
  const d = Q.givers[id]; const sp = new THREE.Sprite(MARK['!']); sp.scale.set(0.9, 0.9, 1); sp.position.y = h; sp.visible = false; root.add(sp);
  const g = { id, name: d.name, def: d, pos, root, mark: sp, h, runner, face, heading: face, t: Math.random() * 6, greet: 0, cur: null };
  givers.set(id, g);
  interactables.push({ label: '이야기', ic: 'quest', pos, r: Q.r, when: () => !late.tut?.active && !!g.cur && (!d.shop || late.shopOpen?.(d.shop) !== false), act: () => openGiver(id) });
  return g;
}
function person(id, pos, face) {
  const d = Q.givers[id], L = d.look || {}, run = buildRunner(), o = DEFAULT_OUTFIT;
  run.apply({ ...o, shirt: { ...o.shirt, color: L.shirt || o.shirt.color }, pants: { ...o.pants, color: L.pants || o.pants.color }, shoes: { ...o.shoes, color: L.shoes || o.shoes.color }, gear: { hat: L.hat || 'hat:straw', back: 'back:none', hand: 'hand:none' } });
  run.root.position.copy(pos); run.root.rotation.y = face; scene.add(run.root);
  if (col) col.add(pos.x, pos.z, 0.5);
  return addGiver(id, pos, run.root, 2.95, run, face);
}
// 오름지기: 들머리 안내판 옆 (정낭을 나서면 바로 보임)
if (spots.sign && !spots.sign.silent && trash) {
  const s = spots.sign, r = s.rot, d = Q.givers.jigi, X = [Math.cos(r), -Math.sin(r)], N = [Math.sin(r), Math.cos(r)], gate = spots.tut?.gate || null;
  const at = ([sd, fw]) => [s.pos.x + X[0] * sd + N[0] * fw, s.pos.z + X[1] * sd + N[1] * fw];
  const ok = ([x, z]) => (spots.hareubangs || []).every((h) => Math.hypot(h.pos.x - x, h.pos.z - z) >= (d.hbGap || 0)) && (!col || !col.blocked(x, z, 0.45));
  const [x, z] = [[d.side, d.fwd], ...(d.alt || [])].map(at).find(ok) || at([d.side, d.fwd]); /* 입구 하르방과 떨어진 자리 (#213) */
  s.npc = { x, z };
  person('jigi', v3(x, z), gate ? Math.atan2(gate.x - x, gate.z - z) : Math.atan2(N[0], N[1]));
}
// 표지판: 구역 클린하우스 옆 (구역 2~5 줄기)
function buildBoard() {
  const g = new THREE.Group(), wood = tm('#8a6a44'), face = tm('#efe4c6'), ink = tm('#4a3a28');
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.6, 0.16), wood); post.position.y = 0.8; g.add(post);
  const bd = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 0.08), wood); bd.position.y = 1.55; g.add(bd);
  const fc = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.66, 0.02), face); fc.position.set(0, 1.55, 0.05); g.add(fc);
  for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.8 - i * 0.18, 0.05, 0.01), ink); l.position.set(-0.08 + i * 0.05, 1.72 - i * 0.15, 0.065); g.add(l); }
  g.traverse((m) => { if (m.isMesh) { m.castShadow = !LOW; m.receiveShadow = true; } });
  return g;
}
for (const [id, d] of Object.entries(Q.givers)) {
  if (!d.board) continue; const ch = CHS.find((c) => c.id === d.board); if (!ch) continue;
  const ox = ch.front.x - ch.center.x, oz = ch.front.z - ch.center.z, L = Math.hypot(ox, oz) || 1, fx = ox / L, fz = oz / L; // 클린하우스 앞쪽
  const x = ch.front.x + fz * 2.6 + fx * 0.4, z = ch.front.z - fx * 2.6 + fz * 0.4, pos = v3(x, z);
  const b = buildBoard(); b.position.copy(pos); b.rotation.y = Math.atan2(fx, fz); scene.add(b);
  if (col) col.add(x, z, 0.35);
  addGiver(id, pos, b, 2.55);
}
// 가게 주인: 가게 문 옆 정해진 자리 (#190). 길에서 가게를 볼 때 문 오른쪽 Q.shopNpc.side m, 터 앞 선에서 안쪽으로 Q.shopNpc.in m(문 자리는 길 쪽에 있음), 길을 보고 섬
// 막혀 있으면(건물·간판·벤치 충돌) 왼쪽 → 조금 더 바깥 순으로. 다른 NPC·다른 가게 문과 Q.shopNpc.gap m 안이면 다음 자리
const placedNpc = [];
for (const [id, d] of Object.entries(Q.givers)) {
  if (!d.shop) continue; const sh = shopOf(d.shop), lot = sh && STREET.lot(sh.lot); if (!sh || !lot) continue;
  const bl = Math.hypot(lot.back.x, lot.back.z) || 1, bx = lot.back.x / bl, bz = lot.back.z / bl; // 터 안쪽
  const rx = -bz, rz = bx, S = Q.shopNpc; // 길에서 가게를 볼 때 오른쪽
  const doorsElse = shopsBuilt.filter((o) => o !== sh && o.door).map((o) => o.door);
  const free = (x, z) => (!col || !col.blocked(x, z, 0.45)) && placedNpc.every((q) => Math.hypot(q.x - x, q.z - z) >= S.gap) && doorsElse.every((q) => Math.hypot(q.x - x, q.z - z) >= S.gap)
    && (!sh.signPos || Math.hypot(sh.signPos.x - x, sh.signPos.z - z) >= 0.9);
  const ds = (sh.door.x - lot.front.x) * rx + (sh.door.z - lot.front.z) * rz; // 문이 터 앞 가운데에서 옆으로 얼마
  const at = (sd, dep) => [lot.front.x + rx * (ds + sd) + bx * dep, lot.front.z + rz * (ds + sd) + bz * dep];
  let x = 0, z = 0, found = false;
  for (const dep of [S.in, S.in + 0.5, S.in - 0.5]) for (const sd of [S.side, -S.side, S.side * 1.4, -S.side * 1.4]) {
    if (found) break;
    [x, z] = at(sd, dep); found = free(x, z);
  }
  if (!found) [x, z] = at(S.side, S.in);
  placedNpc.push({ x, z });
  person(id, v3(x, z), Math.atan2(-bx, -bz));
}
const giverPos = (id) => givers.get(id)?.pos || null;

/* ---------- 받기·끝내기 창 ---------- */
const win = { el: $('quest'), giver: null, item: null };
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CLOTH_NAME = Object.fromEntries(CLOTHES.map((c) => [c.id, c.name]));
const CP_NAME = { gear: '장비점 할인권', leap: 'LEAP 할인권', salon: '머리 반값권', ade: '에이드 한 잔', satis: '고등어구이 한 번' };
const quipOf = (id) => { const L = Q.quip || []; let h = 0; for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return L.length ? L[h % L.length] : ''; }; /* #223 보상 줄 한 마디 */
function rewardHtml(r, id) {
  const a = [];
  if (r?.gyul) a.push(`<span><i class="gy"></i>귤 ${r.gyul}</span>`);
  if (r?.coupon) a.push(`<span>${CP_NAME[r.coupon[0]] || '할인권'}${r.coupon[1] > 1 ? ' ×' + r.coupon[1] : ''}</span>`);
  if (r?.item) a.push(`<span>${esc(CLOTH_NAME[r.item] || '선물')}</span>`);
  const qp = id ? quipOf(id) : '';
  return a.length ? '<small>보상</small> ' + a.join('') + (qp ? ` <small class="q-quip">${esc(qp)}</small>` : '') : '';
}
const whoOf = (id) => Q.givers[id]?.name || '';
function show(g, it) {
  win.giver = g; win.item = it; const q = it.q;
  $('quest-who').textContent = g.name;
  const nm = $('quest-name'); nm.textContent = q.name; nm.classList.toggle('side', !it.main);
  const lines = it.st === 'ready' ? q.fin : q.say;
  talk.lines = splitSay(lines); talk.pages = null; talk.i = 0;
  const p = quests.prog(q.id);
  $('quest-task').innerHTML = it.st === 'ready' ? '' : `${esc(q.task)}${it.st === 'on' && q.ask.n > 1 && q.ask.k !== 'zone' ? ` <b>(${p}/${q.ask.n})</b>` : ''}${it.st === 'offer' && q.to && q.to !== q.giver ? `<br><small>끝나면 ${esc(whoOf(q.to))}</small>` : ''}`;
  $('quest-rew').innerHTML = it.st === 'on' ? '' : rewardHtml(q.reward, q.id);
  const go = $('quest-go'); go.textContent = it.st === 'ready' ? '보상 받기' : it.st === 'offer' ? '받기' : '좋아요'; go.classList.toggle('claim', it.st === 'ready');
  win.el.hidden = false;
  paginate(); // 창이 보인 뒤에 재야 함
}
// 대사 장 넘기기 (#190): 한 줄이 TALK.win.line 자를 넘으면 문장에서 나누고, 한 장이 TALK.win.lines 줄을 넘으면 ▶ 다음 장
const talk = { lines: [], pages: null, i: 0 };
function splitSay(lines) {
  const out = [];
  for (const l of lines || []) {
    if ([...l].length <= TALK.win.line) { out.push(l); continue; }
    const parts = String(l).split(/(?<=[.?!…~])\s+/).filter(Boolean);
    out.push(...parts);
  }
  return out;
}
function sayRows(el) { // 지금 글이 몇 줄인지 (p 마다 줄 높이로 나눔)
  let n = 0; for (const p of el.children) { const lh = parseFloat(getComputedStyle(p).lineHeight) || 24; n += Math.round(p.getBoundingClientRect().height / lh); } return n;
}
function paginate() {
  const el = $('quest-say'), max = innerHeight < 480 ? TALK.win.lines - 1 : TALK.win.lines, pages = []; let cur = []; // 낮은 화면(폰 가로)은 한 줄 덜
  for (const l of talk.lines) {
    el.innerHTML = [...cur, l].map((x) => `<p>${esc(x)}</p>`).join('');
    if (cur.length && sayRows(el) > max) { pages.push(cur); cur = [l]; } else cur.push(l);
  }
  if (cur.length) pages.push(cur);
  talk.pages = pages; talk.i = 0; showPage();
}
function showPage() {
  const P = talk.pages || [talk.lines]; $('quest-say').innerHTML = (P[talk.i] || []).map((x) => `<p>${esc(x)}</p>`).join('');
  $('quest-next').hidden = talk.i >= P.length - 1;
}
$('quest-next').addEventListener('click', () => { if (talk.pages && talk.i < talk.pages.length - 1) { talk.i++; showPage(); } });
function openGiver(id) {
  const g = givers.get(id); if (!g) return; const l = quests.at(id);
  if (!l.length) { greet(g, true); return; }
  closePanels(); stopAutoGo(); g.greet = 0; wave(g); show(g, l[0]);
}
function closeWin() { win.el.hidden = true; win.giver = null; win.item = null; }
$('quest-close').addEventListener('click', closeWin);
win.el.addEventListener('click', (e) => { if (e.target === win.el) closeWin(); });
$('quest-go').addEventListener('click', () => {
  const it = win.item, g = win.giver; if (!it || !g) return;
  if (it.st === 'offer') { if (quests.accept(it.q.id)) { late.sound?.beep?.(true); toast(`${Q.took || '퀘스트 받음'} · ${it.q.task}`, 2.6); trackDirty(true); } closeWin(); return; }
  if (it.st === 'ready') {
    const r = quests.complete(it.q.id); if (!r) { closeWin(); return; }
    give(r, it.q); trackDirty(true);
    const next = quests.at(g.id).find((x) => x.st !== 'on'); // 바로 다음 퀘스트 받기
    if (next) { show(g, next); return; }
  }
  closeWin();
});
function give(r, q) {
  if (r.gyul) { save.coins += r.gyul; persist(); gyulShower(r.gyul); }
  if (r.coupon) toast(`${CP_NAME[r.coupon[0]] || '할인권'}을 받았어요`, 2.6);
  if (r.item && CL && !CL.own[r.item]) { CL.own[r.item] = 1; persist(); toast(`${CLOTH_NAME[r.item] || '선물'}을 받았어요 · 내 가방에서 입어요`, 3); }
  late.sound?.swell?.(0.6);
  if (q.ending) ending(q.ending);
}
// 끝 장면: 하늘에 큰 글씨 한 줄
function ending(text) { const el = $('quest-end'); el.textContent = text; el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 7000); }

/* ---------- 조건을 채움 ---------- */
function onReady(q) {
  if (q.auto) { const r = quests.complete(q.id); if (r) { give(r, q); if (q.fin?.[0]) say('quest', 'qauto:' + q.id, `${q.name} 완료 · ${q.fin[0]}`, 3.4, { ttl: 60 }); late.questAutoDone?.(q); } trackDirty(true); return; } // 주는 사람 없는 퀘스트 (#208): 채우면 바로 끝
  const to = whoOf(q.to || q.giver);
  if (q.got) say('quest', 'qgot:' + q.id, `${q.got} · ${to}에게 가져가요`, 3.4, { ttl: 60 });
  else say('quest', 'qready:' + q.id, `${q.name} 완료! ${to}에게 돌아가요`, 3, { ttl: 60 });
  trackDirty(true);
}

/* ---------- 감독 문 ---------- */
const introAt = (gid, text) => () => { toast(text, 4); const g = givers.get(gid); if (g) { tipMark(g.pos.clone().setY(g.pos.y + 2)); wave(g); social?.showBubble('npc-q-' + gid, g.root, '여기요!', 3.6); } };
director.register({ id: 'quest', kind: 'quest', intro: introAt('jigi', '오름지기가 손짓해요 · 다가가서 말을 걸어 봐요. 손짓은 대개 일이에요') });
director.register({ id: 'shopQuest', kind: 'quest', gate: () => !!givers.get('shop:gear'), intro: introAt('shop:gear', '장비점 철물 삼춘이 할 말이 있대요 · 대개 연장 얘기예요') });
director.register({ id: 'shopQuests', kind: 'quest', gate: (f) => (f.days >= 2 || f.zone >= 2) && [...givers.keys()].some((k) => k.startsWith('shop:') && k !== 'shop:gear'), intro: () => toast('가게 거리 주인들이 할 말이 있대요 · 흰 느낌표를 찾아봐요', 4) });

/* ---------- 추적 줄 ---------- */
const TR = $('quest-track'), trT = TR.querySelector('.qt'), trP = TR.querySelector('.qp'), trA = TR.querySelector('.qa'), trD = TR.querySelector('.qd'), trM = TR.querySelector('.qm');
let trDirty = true, trCur = null, trTarget = null, trTargetT = 0, trKey = '', trK = null;
function trackDirty(bump = false) { trDirty = true; if (bump) { TR.classList.remove('bump'); void TR.offsetWidth; TR.classList.add('bump'); } }
const heapLeft = (i) => trash.store.left(i) > 0;
function nearest(list, f = () => true) { let b = null, bd = 1e12; for (const o of list) { if (!f(o)) continue; const d = (o.x - player.pos.x) ** 2 + (o.z - player.pos.z) ** 2; if (d < bd) { bd = d; b = o; } } return b; }
// go 키 → 갈 곳 (Vector3) 또는 null
function goPos(go) {
  if (!go) return null;
  if (givers.has(go)) return giverPos(go);
  if (go.startsWith('shop:')) { const sh = shopOf(go.slice(5)); return sh ? sh.door.clone() : null; }
  if (go === 'cairn') { const c = nearest(cairns.map((c) => c.pos)); return c ? c.clone() : null; }
  if (go === 'cave') return late.caveEnt?.() || null; // 용암 동굴 입구 (#195)
  if (go === 'rimLook') return late.summitClue?.rimPos?.() || null; // 굼부리 가장자리 전망 자리 (#208)
  if (go === 'ch') { const c = nearest(CHS.map((c) => c.front)); return c ? c.clone() : null; }
  if (!trash) return null;
  const hs = trash.heaps.map((h, i) => ({ x: h.x, z: h.z, h, i }));
  if (go === 'heapRoad') { const o = nearest(hs, (o) => !o.h.field && heapLeft(o.i)); return o && v3(o.x, o.z); }
  if (go === 'heapField') { const o = nearest(hs, (o) => o.h.field && heapLeft(o.i)); return o && v3(o.x, o.z); }
  const [kind, zs] = go.split('@'), z = +zs, F = late.field?.api;
  if (kind === 'heap') { const o = nearest(hs, (o) => o.h.zone === z && heapLeft(o.i)); return o && v3(o.x, o.z); }
  if (kind === 'den' && F) { const o = nearest(F.dens, (d) => d.zone === z); return o && v3(o.x, o.z); }
  if (kind === 'boss' && F) { const o = F.bosses.find((b) => b.zone === z); return o && v3(o.x, o.z); }
  return null;
}
function questInfo(t) {
  if (t.st === 'offer') return { t, text: `${whoOf(t.q.giver)}에게 가기`, prog: '', ready: false, go: t.q.giver, mark: '!' };
  if (t.ready) return { t, text: `${whoOf(t.to)}에게 보고하기`, prog: '', ready: true, go: t.to, mark: '?' };
  return { t, text: t.q.task, prog: t.n > 1 && t.q.ask.k !== 'zone' ? `${t.p}/${t.n}` : '', ready: false, go: t.q.go || null, mark: t.main ? '!' : 'w' };
}
// #142 다음 할 일 (game/nexthint.js): 잠깐 바뀌는 안내(배낭 참·귤 닿음·HP 낮음)가 먼저, 퀘스트가 없으면 이어 줄 것. 그 안내는 pos()·arrive·tap 을 직접 가짐
function trackInfo() {
  const t = quests.tracked(), base = t ? questInfo(t) : null;
  const h = late.nextHint?.(base, { open: director.isOpen('quest'), mainLeft: !!quests.mainNext() });
  return h || base;
}
const trackOn = () => state.sessionOn && !late.tut?.active && !panelOpen() && cam.mode !== 'wardrobe' && !document.body.classList.contains('tut') && !(isTouch && innerWidth <= 600 && !$('boss-bar').hidden);
const pv = new THREE.Vector3();
// 위 가운데 토스트·배너·팁과 겹치면 그 아래로 (폰·좁은 화면)
let trDodgeT = 0, trTop = '';
const TOPS = ['toast', 'banner', 'tip', 'newver'].map((id) => $(id)).filter(Boolean);
function dodge() {
  TR.style.top = ''; const r = TR.getBoundingClientRect(); let y = 0;
  for (const el of TOPS) { if (el.hidden) continue; const b = el.getBoundingClientRect(); if (b.width && b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top) y = Math.max(y, b.bottom + 8); }
  const t = y ? y + 'px' : ''; if (t !== trTop) trTop = t; TR.style.top = t;
}
late.questGuiding = () => !TR.hidden; // 추적 중인 퀘스트 줄이 떠 있는가 (#201: 그동안 마차·가게 가장자리 표시는 쉼)
function tickTrack(dt) {
  const on = trackOn() && !!trCur;
  if ((trTargetT -= dt) <= 0 || trDirty) {
    trTargetT = 0.5; trCur = trackInfo();
    trTarget = trCur ? (trCur.pos ? trCur.pos() : goPos(trCur.go)) : null;
    if (trCur) {
      const key = trCur.text + trCur.prog + trCur.ready + trCur.mark;
      if (key !== trKey || trDirty) {
        if ((trCur.k || '') !== trK) { if (trK !== null) trackDirty(true); trK = trCur.k || ''; } // 안내가 바뀌면 한 번 튐
        trKey = key; trT.textContent = trCur.text; trP.textContent = trCur.prog; TR.classList.toggle('ready', trCur.ready);
        trM.textContent = trCur.mark === '?' ? '?' : trCur.mark === 'next' ? '›' : '!'; trM.classList.toggle('side', trCur.mark === 'w'); trM.classList.toggle('tmp', trCur.mark === 'tmp'); trM.classList.toggle('next', trCur.mark === 'next');
      }
    }
    trDirty = false;
  }
  if (TR.hidden === on) TR.hidden = !on;
  if (!on) return;
  if ((trDodgeT -= dt) <= 0) { trDodgeT = 0.2; dodge(); }
  TR.classList.toggle('going', !!autoGo?.dest?.quest);
  if (!trTarget) { if (!trA.hidden) trA.hidden = true; if (trD.textContent) trD.textContent = ''; return; }
  trA.hidden = false;
  pv.copy(trTarget); pv.y += 1; pv.project(camera); let x = pv.x, y = pv.y; if (pv.z > 1) { x = -x; y = -y; }
  TR.style.setProperty('--a', Math.atan2(x, y).toFixed(3) + 'rad'); // 0 = 위(앞)
  const d = Math.round(Math.hypot(trTarget.x - player.pos.x, trTarget.z - player.pos.z)), ds = d < 4 ? '' : d + 'm';
  if (trD.textContent !== ds) trD.textContent = ds;
}
function trackGo() {
  if (autoGo?.dest?.quest) { stopAutoGo(); return; }
  if (trCur?.tap) { trCur.tap(); return; }
  if (!trCur || !trTarget) { openLog(); return; }
  const gid = givers.has(trCur.go) ? trCur.go : null, arr = trCur.arrive;
  const ok = startAutoGo({ pos: trTarget.clone(), near: trCur.near || (gid ? Q.r * 0.7 : 3), quest: true, arrive: () => { if (arr) arr(); else if (gid) openGiver(gid); } });
  if (!ok) toast('지금은 걸어갈 수 없어요');
}
TR.addEventListener('click', (e) => { if (e.target.closest('.ql')) { e.stopPropagation(); openLog(); return; } trackGo(); });
TR.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trackGo(); } });

/* ---------- 퀘스트 창 (L) ---------- */
const LOG = $('qlog');
function openLog() {
  closePanels(); const l = quests.list(), body = $('qlog-body'), row = (cls, a, b = '') => `<div class="q-row ${cls}"><span>${a}</span>${b}</div>`;
  const by = new Map(); for (const o of l.on) { const g = o.q.to && o.ready ? o.q.to : o.q.giver; if (!by.has(g)) by.set(g, []); by.get(g).push(o); }
  let h = '<h3>하는 중</h3>';
  if (!l.on.length) { const n = quests.tracked(); h += `<p class="q-empty">${n ? esc(`${whoOf(n.q.giver)}에게 가 보세요`) : '지금은 받은 퀘스트가 없어요. 드문 평화예요'}</p>`; }
  for (const [g, os] of by) for (const o of os) h += row(`${o.main ? 'main' : 'side'}${o.ready ? ' ready' : ''}`, `${esc(o.q.name)}<small>${esc(o.ready ? `${whoOf(g)}에게 보고하기` : o.q.task)} · ${esc(whoOf(g))}</small>`, `<b>${o.ready ? '완료' : `${o.p}/${o.n}`}</b>`);
  const cps = Object.entries(quests.state().cp).filter(([, n]) => n > 0);
  if (cps.length) h += '<h3>할인권</h3>' + cps.map(([k, n]) => row('side', esc(CP_NAME[k] || k), `<b>×${n}</b>`)).join('');
  const done = l.done.filter((q) => !l.skip.includes(q.id)).reverse();
  if (done.length) { h += '<h3>끝낸 것 · 처리 완료</h3>'; const gs = new Map(); for (const q of done) { if (!gs.has(q.giver)) gs.set(q.giver, []); gs.get(q.giver).push(q); } for (const [g, qs] of gs) for (const q of qs) h += row('done', `${esc(q.name)}<small>${esc(whoOf(g))}</small>`); }
  body.innerHTML = h; LOG.hidden = false;
}
$('qlog-close').addEventListener('click', () => { LOG.hidden = true; });
LOG.addEventListener('click', (e) => { if (e.target === LOG) LOG.hidden = true; });
addEventListener('keydown', (e) => { // L: 퀘스트 창 (임의)
  if (e.code !== 'KeyL' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (!state.sessionOn || late.tut?.active) return;
  if (!LOG.hidden) LOG.hidden = true; else openLog();
});
// 메뉴 칸 '퀘스트' (도감 앞)
{ const dex = $('menu-dex'); if (dex) { const b = document.createElement('button'); b.type = 'button'; b.id = 'menu-quest';
  b.innerHTML = icon('quests2') + '퀘스트';
  b.addEventListener('click', () => { closePanels(); openLog(); }); dex.before(b); } }

/* ---------- 지도 표시 ---------- */
late.questIcons = (x, uv, s, inC) => {
  for (const g of givers.values()) {
    const m = g.cur; if (!m || m === 'g') continue; const [u, v] = uv(g.pos.x, g.pos.z); if (!inC(u, v)) continue;
    x.fillStyle = m === 'w' ? '#ffffff' : '#ffd23f'; x.strokeStyle = 'rgba(40,28,0,.9)'; x.lineWidth = Math.max(1, s / 7);
    x.beginPath(); x.arc(u, v, s * 0.55, 0, 7); x.fill(); x.stroke();
    x.fillStyle = '#3a2a00'; x.font = `900 ${Math.round(s * 0.8)}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(m === '?' ? '?' : '!', u, v + s * 0.04);
  }
};

/* ---------- 할인권 ---------- */
late.questOff = (shop, price) => { if (!quests.coupons(shop)) return 0; const k = Q.coupon[shop]; return k ? Math.max(1, Math.floor(price * k)) : 0; };
late.questUse = (shop) => quests.useCoupon(shop);

/* ---------- 말 걸기·손 흔들기 ---------- */
function wave(g) { if (g.runner) { g.pose = 'wave'; g.poseT = 0; } }
late.questWave = (shop) => { for (const g of givers.values()) if (g.def.shop === shop) { g.root.visible = true; greet(g, true); } }; // 가게가 문을 열면 주인이 나와 손 흔듦 (#206)
function greet(g, force = false) {
  const h = g.def.hello; if (!h?.length || !social) return;
  if (!force && g.greet > 0) return; g.greet = 14 + Math.random() * 10;
  social.showBubble('npc-q-' + g.id, g.root, h[Math.floor(Math.random() * h.length)], 3.6); wave(g);
}

/* ---------- 매 프레임 ---------- */
let markT = 0, browseAt = null;
late.tickQuest = (dt) => {
  if (needCatch && director.isOpen('quest')) { needCatch = false; const sk = quests.catchUp(); if (sk.length) trackDirty(); }
  if ((markT -= dt) <= 0) {
    markT = 0.4; quests.tick();
    for (const g of givers.values()) {
      const m = late.tut?.active ? null : quests.mark(g.id); g.cur = m;
      // 머리 위에 띄우는 것 (#201): 하는 중(g)은 안 띄움, 곁가지(w)는 가까울 때만. 줄기 받기(!)·돌려주기(?)는 늘
      const show = m === 'g' ? null : m === 'w' && Math.hypot(g.pos.x - player.pos.x, g.pos.z - player.pos.z) > MARK_SIDE_NEAR ? null : m;
      if (show !== g.shown) { g.shown = show; if (show) g.mark.material = MARK[show]; g.mark.visible = !!show; }
    }
    // 가게 구경 (곁가지 '마을 구경'): 미장원·LEAP 문 앞에 가 봄 (한 번 가면 멀어질 때까지 다시 안 셈)
    const near = ['salon', 'leap'].map(shopOf).find((sh) => sh && Math.hypot(sh.door.x - player.pos.x, sh.door.z - player.pos.z) < 5);
    if (near && browseAt !== near.id) { browseAt = near.id; count('browse'); } else if (!near) browseAt = null;
  }
  for (const g of givers.values()) {
    const d = Math.hypot(g.pos.x - player.pos.x, g.pos.z - player.pos.z), vis = d < 160 && (!g.def.shop || late.shopOpen?.(g.def.shop) !== false); /* 닫힌 가게엔 주인이 아직 없음 (#206) */
    if (g.root.visible !== vis) g.root.visible = vis;
    if (!vis) continue;
    g.t += dt; if (g.mark.visible) g.mark.position.y = g.h + Math.sin(g.t * 2.4) * 0.08;
    if (!g.runner || d > Q.near) continue;
    g.greet -= dt; if (d < 7 && !g.cur) greet(g);
    const want = d < 9 ? Math.atan2(player.pos.x - g.pos.x, player.pos.z - g.pos.z) : g.face;
    let dh = want - g.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); g.heading += dh * Math.min(1, dt * 4); g.root.rotation.y = g.heading;
    if (g.pose === 'wave' && (g.poseT += dt) > 2.2) g.pose = 'move';
    g.runner.animate(dt, { speed: 0, running: false, pose: g.pose || 'move', t: g.poseT || g.t, air: false, jumpV: 0 });
  }
  tickTrack(dt);
};

/* ---------- 확인용 (window.__oreum.quest) ---------- */
late.questDebug = {
  api: quests, givers, state: () => JSON.parse(JSON.stringify(quests.state())),
  get next() { return late.nextDebug; }, // #142 다음 할 일 (game/nexthint.js)
  where: () => Object.fromEntries([...givers.values()].map((g) => [g.id, { x: +g.pos.x.toFixed(1), z: +g.pos.z.toFixed(1), mark: g.cur }])),
  track: () => trCur && { text: trCur.text, prog: trCur.prog, ready: trCur.ready, go: trCur.go, k: trCur.k || null, mark: trCur.mark, target: trTarget && [+trTarget.x.toFixed(1), +trTarget.z.toFixed(1)], shown: !TR.hidden },
  give: (id) => quests.accept(id), done: (id) => { const r = quests.complete(id); if (r) give(r, quests.BY.get(id)); trackDirty(); return r; },
  count: (k, n = 1) => { count(k, n); trackDirty(); }, open: (gid) => openGiver(gid), log: () => openLog(), go: () => trackGo(), win: () => !win.el.hidden && { who: win.giver?.id, id: win.item?.q.id, st: win.item?.st, page: talk.i, pages: talk.pages?.length || 1 },
  nextPage: () => $('quest-next').click(),
  showQ: (id, st = 'offer') => { const q = quests.BY.get(id), g = q && givers.get(q.giver); if (!g) return false; closePanels(); show(g, { q, st, main: QUESTS.main.includes(q) }); return true; }, // 창 그림 확인용 (#190)
  press: () => $('quest-go').click(), close: closeWin, catchUp: () => quests.catchUp(), reset: () => { quests.reset(); trackDirty(); }, goPos, ending,
};
