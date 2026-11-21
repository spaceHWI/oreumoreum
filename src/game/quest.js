// 퀘스트 (#158): src/quest.js(차례·진행)를 게임에 붙인다. 파일 순서는 boss 뒤 (src/modules.js, 규칙은 notes/prototype-v1.md)
// - 주는 사람: 오름지기(들머리 안내판 옆, 밀짚모자), 구역 클린하우스 옆 표지판(구역 2~5), 가게 앞 주인(가게 퀘스트). 머리 위 노란 !(줄기 받기)·노란 ?(돌려주기)·흰 !(곁가지)·회색 ?(하는 중)
//   다가가 상호작용(F) → 받기·끝내기 창(#quest, 폰은 아래에서 올라오는 한 장). 미니맵·큰 지도에도 같은 표시(late.questIcons)
// - 추적 줄(#quest-track): 화면 위 한 줄 '할 일 (1/3)' + 방향 화살표·거리. 누르면 그쪽으로 자동으로 걸어감(dump.js startAutoGo), 조건을 채우면 노랗게 '○○에게 돌아가기'
//   #142 '다음 할 일' 은 퀘스트가 끝난 사람에게 이 줄을 이어 쓴다
// - 퀘스트 창(#qlog, 메뉴·L·추적 줄 목록 단추): 하는 중·끝낸 것
// - 셈: 업적 사건(ach.emit)·더미 치움(trash.on, 남이 치운 것은 QUESTS.coopR 안이면)·소굴 닫음(field.js late.questEv)을 save.quest.c 에. 장비·우두머리·구역은 저장에서 바로 읽음
// - 감독(#176): 문 quest(정낭을 나서면 오름지기 첫 퀘스트)·shopQuest(첫 버리기 뒤 장비점 주인)·shopQuests(2일째나 구역 2: 다른 가게 주인)를 등록. 조건을 채움·주운 실마리는 say('quest')
// - 할인권: late.questOff(가게, 값) → 깎을 귤, late.questUse(가게) 한 장 씀 (shop.js 장비·옷, stores.js 머리·에이드)
// dev: __oreum.quest (state·give(id)·done(id)·count(k, n)·go()·open(giver)·where())
import * as THREE from 'three';
import { QUESTS, CLOTHES } from '../balance.js';
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
    has: (need) => (need.startsWith('shop:') ? !!shopOf(need.slice(5)) : need === 'loot' ? !!late.loot : need.startsWith('story:') ? !!save.story?.done?.includes?.(need.slice(6)) : false), // #168 이야기 곁가지는 그 이벤트를 끝낸 뒤
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
const givers = new Map(); // id → { id, name, pos, root, runner?, mark: Sprite, h, kind }
function addGiver(id, pos, root, h, runner = null, face = 0) {
  const d = Q.givers[id]; const sp = new THREE.Sprite(MARK['!']); sp.scale.set(0.9, 0.9, 1); sp.position.y = h; sp.visible = false; root.add(sp);
  const g = { id, name: d.name, def: d, pos, root, mark: sp, h, runner, face, heading: face, t: Math.random() * 6, greet: 0, cur: null };
  givers.set(id, g);
  interactables.push({ label: '이야기', ic: 'quest', pos, r: Q.r, when: () => !late.tut?.active && !!g.cur, act: () => openGiver(id) });
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
  const s = spots.sign, r = s.rot, d = Q.givers.jigi, X = [Math.cos(r), -Math.sin(r)], N = [Math.sin(r), Math.cos(r)];
  const x = s.pos.x + X[0] * d.side + N[0] * d.fwd, z = s.pos.z + X[1] * d.side + N[1] * d.fwd, gate = spots.tut?.gate || null;
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
// 가게 주인: 가게 문 옆
for (const [id, d] of Object.entries(Q.givers)) {
  if (!d.shop) continue; const sh = shopOf(d.shop), lot = sh && STREET.lot(sh.lot); if (!sh || !lot) continue;
  const bl = Math.hypot(lot.back.x, lot.back.z) || 1, ox = -lot.back.x / bl, oz = -lot.back.z / bl; // 골목 쪽
  const x = sh.door.x + ox * 1.1 + oz * 2.1, z = sh.door.z + oz * 1.1 - ox * 2.1;
  person(id, v3(x, z), Math.atan2(ox, oz));
}
const giverPos = (id) => givers.get(id)?.pos || null;

/* ---------- 받기·끝내기 창 ---------- */
const win = { el: $('quest'), giver: null, item: null };
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CLOTH_NAME = Object.fromEntries(CLOTHES.map((c) => [c.id, c.name]));
const CP_NAME = { gear: '장비점 할인권', leap: 'LEAP 할인권', salon: '머리 반값권', ade: '에이드 한 잔', satis: '고등어구이 한 번' };
function rewardHtml(r) {
  const a = [];
  if (r?.gyul) a.push(`<span><i class="gy"></i>귤 ${r.gyul}</span>`);
  if (r?.coupon) a.push(`<span>${CP_NAME[r.coupon[0]] || '할인권'}${r.coupon[1] > 1 ? ' ×' + r.coupon[1] : ''}</span>`);
  if (r?.item) a.push(`<span>${esc(CLOTH_NAME[r.item] || '선물')}</span>`);
  return a.length ? '<small>보상</small> ' + a.join('') : '';
}
const whoOf = (id) => Q.givers[id]?.name || '';
function show(g, it) {
  win.giver = g; win.item = it; const q = it.q;
  $('quest-who').textContent = g.name;
  const nm = $('quest-name'); nm.textContent = q.name; nm.classList.toggle('side', !it.main);
  const lines = it.st === 'ready' ? q.fin : q.say;
  $('quest-say').innerHTML = lines.map((l) => `<p>${esc(l)}</p>`).join('');
  const p = quests.prog(q.id);
  $('quest-task').innerHTML = it.st === 'ready' ? '' : `${esc(q.task)}${it.st === 'on' && q.ask.n > 1 && q.ask.k !== 'zone' ? ` <b>(${p}/${q.ask.n})</b>` : ''}${it.st === 'offer' && q.to && q.to !== q.giver ? `<br><small>끝나면 ${esc(whoOf(q.to))}</small>` : ''}`;
  $('quest-rew').innerHTML = it.st === 'on' ? '' : rewardHtml(q.reward);
  const go = $('quest-go'); go.textContent = it.st === 'ready' ? '보상 받기' : it.st === 'offer' ? '받기' : '좋아요'; go.classList.toggle('claim', it.st === 'ready');
  win.el.hidden = false;
}
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
  if (it.st === 'offer') { if (quests.accept(it.q.id)) { late.sound?.beep?.(true); toast(`퀘스트 받음 · ${it.q.task}`, 2.6); trackDirty(true); } closeWin(); return; }
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
  const to = whoOf(q.to || q.giver);
  if (q.got) say('quest', 'qgot:' + q.id, `${q.got} · ${to}에게 가져가요`, 3.4, { ttl: 60 });
  else say('quest', 'qready:' + q.id, `${q.name} 완료! ${to}에게 돌아가요`, 3, { ttl: 60 });
  trackDirty(true);
}

/* ---------- 감독 문 ---------- */
const introAt = (gid, text) => () => { toast(text, 4); const g = givers.get(gid); if (g) { tipMark(g.pos.clone().setY(g.pos.y + 2)); wave(g); social?.showBubble('npc-q-' + gid, g.root, '여기요!', 3.6); } };
director.register({ id: 'quest', kind: 'quest', intro: introAt('jigi', '오름지기가 손짓하고 있어요 · 다가가서 말을 걸어 봐요') });
director.register({ id: 'shopQuest', kind: 'quest', gate: () => !!givers.get('shop:gear'), intro: introAt('shop:gear', '장비점 철물 삼춘이 할 말이 있대요') });
director.register({ id: 'shopQuests', kind: 'quest', gate: (f) => (f.days >= 2 || f.zone >= 2) && [...givers.keys()].some((k) => k.startsWith('shop:') && k !== 'shop:gear'), intro: () => toast('가게 거리 주인들이 할 말이 있대요 · 흰 느낌표를 찾아봐요', 4) });

/* ---------- 추적 줄 ---------- */
const TR = $('quest-track'), trT = TR.querySelector('.qt'), trP = TR.querySelector('.qp'), trA = TR.querySelector('.qa'), trD = TR.querySelector('.qd'), trM = TR.querySelector('.qm');
let trDirty = true, trCur = null, trTarget = null, trTargetT = 0, trKey = '';
function trackDirty(bump = false) { trDirty = true; if (bump) { TR.classList.remove('bump'); void TR.offsetWidth; TR.classList.add('bump'); } }
const heapLeft = (i) => trash.store.left(i) > 0;
function nearest(list, f = () => true) { let b = null, bd = 1e12; for (const o of list) { if (!f(o)) continue; const d = (o.x - player.pos.x) ** 2 + (o.z - player.pos.z) ** 2; if (d < bd) { bd = d; b = o; } } return b; }
// go 키 → 갈 곳 (Vector3) 또는 null
function goPos(go) {
  if (!go) return null;
  if (givers.has(go)) return giverPos(go);
  if (go.startsWith('shop:')) { const sh = shopOf(go.slice(5)); return sh ? sh.door.clone() : null; }
  if (go === 'cairn') { const c = nearest(cairns.map((c) => c.pos)); return c ? c.clone() : null; }
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
function trackInfo() {
  const t = quests.tracked(); if (!t) return null;
  if (t.st === 'offer') return { t, text: `${whoOf(t.q.giver)}에게 가기`, prog: '', ready: false, go: t.q.giver, mark: '!' };
  if (t.ready) return { t, text: `${whoOf(t.to)}에게 돌아가기`, prog: '', ready: true, go: t.to, mark: '?' };
  return { t, text: t.q.task, prog: t.n > 1 && t.q.ask.k !== 'zone' ? `${t.p}/${t.n}` : '', ready: false, go: t.q.go || null, mark: t.main ? '!' : 'w' };
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
function tickTrack(dt) {
  const on = trackOn() && !!trCur;
  if ((trTargetT -= dt) <= 0 || trDirty) {
    trTargetT = 0.5; trCur = trackInfo();
    trTarget = trCur ? goPos(trCur.go) : null;
    if (trCur) {
      const key = trCur.text + trCur.prog + trCur.ready + trCur.mark;
      if (key !== trKey || trDirty) {
        trKey = key; trT.textContent = trCur.text; trP.textContent = trCur.prog; TR.classList.toggle('ready', trCur.ready);
        trM.textContent = trCur.mark === '?' ? '?' : '!'; trM.classList.toggle('side', trCur.mark === 'w');
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
  if (!trCur || !trTarget) { openLog(); return; }
  const gid = givers.has(trCur.go) ? trCur.go : null;
  const ok = startAutoGo({ pos: trTarget.clone(), near: gid ? Q.r * 0.7 : 3, quest: true, arrive: () => { if (gid) openGiver(gid); } });
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
  if (!l.on.length) { const n = quests.tracked(); h += `<p class="q-empty">${n ? esc(`${whoOf(n.q.giver)}에게 가 보세요`) : '지금은 받은 퀘스트가 없어요'}</p>`; }
  for (const [g, os] of by) for (const o of os) h += row(`${o.main ? 'main' : 'side'}${o.ready ? ' ready' : ''}`, `${esc(o.q.name)}<small>${esc(o.ready ? `${whoOf(g)}에게 돌아가기` : o.q.task)} · ${esc(whoOf(g))}</small>`, `<b>${o.ready ? '완료' : `${o.p}/${o.n}`}</b>`);
  const cps = Object.entries(quests.state().cp).filter(([, n]) => n > 0);
  if (cps.length) h += '<h3>할인권</h3>' + cps.map(([k, n]) => row('side', esc(CP_NAME[k] || k), `<b>×${n}</b>`)).join('');
  const done = l.done.filter((q) => !l.skip.includes(q.id)).reverse();
  if (done.length) { h += '<h3>끝낸 것</h3>'; const gs = new Map(); for (const q of done) { if (!gs.has(q.giver)) gs.set(q.giver, []); gs.get(q.giver).push(q); } for (const [g, qs] of gs) for (const q of qs) h += row('done', `${esc(q.name)}<small>${esc(whoOf(g))}</small>`); }
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
  b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h10l3 3v15H6z"/><path d="M9 9h7M9 13h7M9 17h4"/></svg>퀘스트';
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
    for (const g of givers.values()) { const m = late.tut?.active ? null : quests.mark(g.id); if (m !== g.cur) { g.cur = m; if (m) g.mark.material = MARK[m]; g.mark.visible = !!m; } }
    // 가게 구경 (곁가지 '마을 구경'): 미장원·LEAP 문 앞에 가 봄 (한 번 가면 멀어질 때까지 다시 안 셈)
    const near = ['salon', 'leap'].map(shopOf).find((sh) => sh && Math.hypot(sh.door.x - player.pos.x, sh.door.z - player.pos.z) < 5);
    if (near && browseAt !== near.id) { browseAt = near.id; count('browse'); } else if (!near) browseAt = null;
  }
  for (const g of givers.values()) {
    const d = Math.hypot(g.pos.x - player.pos.x, g.pos.z - player.pos.z), vis = d < 160;
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
  where: () => Object.fromEntries([...givers.values()].map((g) => [g.id, { x: +g.pos.x.toFixed(1), z: +g.pos.z.toFixed(1), mark: g.cur }])),
  track: () => trCur && { text: trCur.text, prog: trCur.prog, ready: trCur.ready, go: trCur.go, target: trTarget && [+trTarget.x.toFixed(1), +trTarget.z.toFixed(1)], shown: !TR.hidden },
  give: (id) => quests.accept(id), done: (id) => { const r = quests.complete(id); if (r) give(r, quests.BY.get(id)); trackDirty(); return r; },
  count: (k, n = 1) => { count(k, n); trackDirty(); }, open: (gid) => openGiver(gid), log: () => openLog(), go: () => trackGo(), win: () => !win.el.hidden && { who: win.giver?.id, id: win.item?.q.id, st: win.item?.st },
  press: () => $('quest-go').click(), close: closeWin, catchUp: () => quests.catchUp(), reset: () => { quests.reset(); trackDirty(); }, goPos, ending,
};
