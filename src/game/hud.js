// 위 한 줄·토스트·배너 자리, 상황 팁, 패널 닫기, 업적, 도감 (#86 에서 main.js 를 나눔. 파일 순서는 src/main.js, 규칙은 notes/prototype-v1.md 코드 구조)
import { DEX_LIST } from '../trash.js';
import { dexIcon } from '../dexicons.js';
import { DEX } from '../balance.js';
import { BADGE_ICONS, DAILY_ICON, ALLDAY_ICON, iconSvg } from '../badgeicons.js';
import * as THREE from 'three';
import { groundAt } from '../world.js';
import { MAPS } from '../maps.js';
import { createAchievements, BADGES } from '../achievements.js';
import { isBattle } from '../server.js';
import { initUiTips } from '../uitips.js';
import { createTips, TIP, TIP_ICON } from '../tips.js';
import { state, late } from './state.js';
import { $, isTouch, save, lookS, persist, MAP_ID } from './save.js';
import { life, stream, STN, trash, CH, player, hp } from './place.js';
import { cam } from './camera.js';

Object.assign(late, { toast, closePanels }); // 앞 파일에서 부르는 함수

// ---------- UI 기본 ----------
export const ui = { ctx: $('btn-ctx'), toast: $('toast') }; // 위쪽 줄 (#75): 장소·닉네임·걸음·날씨·나침반·조작 안내 문구는 뺌 (걸음은 메뉴에)
// 위쪽 한 줄이 넘치면 단계적으로 줄임 (#75): 1 구역+좌표 하나로, 2 업적 고리는 메뉴로, 3 단위·여백 줄이기. 두 줄이 되지 않게
export const topFit = (() => {
  const bar = $('topbar'), L = bar.querySelector('.tb-l'), C = bar.querySelector('.tb-c'), R = bar.querySelector('.tb-r');
  let dirty = true, t = 0, bottom = 48, vis = '';
  const gap = (el) => parseFloat(getComputedStyle(el).columnGap) || 0;
  const need = () => { // HP 막대는 줄어들 수 있으니 가장 작은 폭으로 셈
    const cs = [...C.children].filter((e) => !e.hidden && e.offsetWidth > 0);
    const cw = cs.reduce((a, e) => a + (e.id === 'hp-bar' ? parseFloat(getComputedStyle(e).minWidth) || 56 : e.offsetWidth), 0) + Math.max(0, cs.length - 1) * gap(C);
    return L.offsetWidth + R.offsetWidth + cw + gap(bar) * (cw > 0 ? 2 : 1);
  };
  function fit() {
    dirty = false;
    for (let k = 0; k <= 6; k++) { bar.dataset.fit = String(k); for (let i = 1; i <= 6; i++) bar.classList.toggle('f' + i, i <= k); if (need() <= bar.clientWidth + 0.5) break; }
    bottom = bar.getBoundingClientRect().bottom || bottom;
  }
  addEventListener('resize', () => { dirty = true; t = 0; });
  return { dirty: () => { dirty = true; }, tick(dt) { const v = `${$('hp-bar').hidden}${$('buff-pill').hidden}${document.body.classList.contains('tut')}`; if (v !== vis) { vis = v; dirty = true; t = 0; } t -= dt; if (dirty && t <= 0) { t = 0.2; fit(); } }, fit, get bottom() { return bottom; } };
})();
state.toastT = 0;
export function toast(msg, sec = 2.8) { ui.toast.textContent = msg; ui.toast.hidden = false; state.toastT = sec; topStack(); }
// 위 가운데 배너·팁·토스트가 겹치지 않게 (#16): 보이는 것의 높이를 CSS 변수로 넘기고 body 클래스로 아래로 밀기
function topStack() {
  const b = document.body, tp = document.getElementById('tip'), bn = document.getElementById('banner'), on = !!tp && !tp.hidden;
  b.classList.toggle('tip-on', on); if (on) b.style.setProperty('--tip-h', tp.offsetHeight + 'px');
  if (bn && !bn.hidden) b.style.setProperty('--ban-h', bn.offsetHeight + 'px');
}
initUiTips({ $, toast, get: { hp: () => hp.hp, hpMax: () => hp.max, bagName: () => (save.equip.bag === 0 ? '호주머니' : '배낭') } }); // #60 UI 누르면 토스트

// ---------- 상황에 맞는 팁 (#66): 표는 tips.js ----------
const tipEl = $('tip'); let tipT = 0, tipNow = null, tipMarkT = 0, tipMarkPos = null; export { tipMarkT }; export { tipMarkPos };
function showTip(tip) {
  tipNow = tip; tipEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TIP_ICON[tip.ic] || ''}</svg><span>${tip.text}</span>`;
  tipEl.classList.toggle('go', !!tip.go); tipEl.hidden = false; tipT = TIP.sec; late.sound.beep?.(false); topStack();
}
export const tips = createTips({ save, persist, show: showTip }); late.tips = tips;
function tipMark(pos) { tipMarkPos = pos; tipMarkT = 6; }
export function nearestHeapPos() { if (!trash) return null; let b = null, bd = 1e9; trash.heaps.forEach((h, i) => { if (!(trash.store.left(i) > 0)) return; const d = Math.hypot(h.x - player.pos.x, h.z - player.pos.z); if (d < bd) { bd = d; b = { x: h.x, z: h.z }; } }); return b; }
const TIP_GO = {
  shop: () => late.openShop(), cleanhouse: () => { if (CH) late.startAutoGo(); }, dex: () => openDex(),
  heap: () => { const p = nearestHeapPos(); if (p) tipMark(new THREE.Vector3(p.x, groundAt(p.x, p.z), p.z)); },
  stream: () => { const p = tipStreamPos(); if (p) tipMark(new THREE.Vector3(p.x, groundAt(p.x, p.z), p.z)); },
  stone: () => { if (STN?.terrace) tipMark(STN.terrace.clone()); },
};
tipEl.addEventListener('click', () => { const g = tipNow?.go; tipEl.hidden = true; tipT = 0; topStack(); if (g && TIP_GO[g]) TIP_GO[g](); });
{ const b = $('menu-tips'); const sync = () => b.setAttribute('aria-pressed', String(!tips.isOff())); sync(); b.addEventListener('click', () => { tips.off(!tips.isOff()); sync(); if (tips.isOff()) { tipEl.hidden = true; tipT = 0; } }); } // 메뉴에서 팁 끄기
function tipStreamPos() { if (!stream) return null; const [al, lat] = stream.local(player.pos.x, player.pos.z); const [x, z] = stream.at(stream.centerOff(lat) + 0, Math.max(-20, Math.min(20, lat))); return { x, z, d: Math.hypot(x - player.pos.x, z - player.pos.z) }; }
let tipIdle = 0, tipBagN = -1;
function tipState() {
  const full = !!trash && late.bagRoom() < 1, sp = tipStreamPos();
  return {
    busy: !!(late.tut.active) || !$('toast').hidden || !tipEl.hidden || late.mealS.on || late.cutS.on || panelOpen() || cam.mode === 'wardrobe' || !state.sessionOn || document.hidden || player.down || (isTouch && false),
    bagFull: full, bagTier: save.equip.bag, canBuy: !!trash && late.canBuyGear().length > 0,
    hpLow: isBattle() && hp.hp / hp.max < 0.4, enemyNear: life.enemies.near(player.pos, 25) || (!!late.dumpers && late.dumpers.list.some((d) => Math.hypot(d.pos.x - player.pos.x, d.pos.z - player.pos.z) < 25)),
    battle: isBattle(), hasBow: late.weaponNow().id === 'bow', idle: tipIdle,
    nearStream: !!sp && sp.d < 8 && !state.fishing?.busy && !stream.onBridge(player.pos.x, player.pos.z),
  };
}
export function tickTips(dt) {
  const n = trash ? trash.store.pickedCount() : 0;
  if (n !== tipBagN) { tipBagN = n; tipIdle = 0; } else if (!panelOpen() && !late.tut.active) tipIdle += dt;
  if (tipT > 0) { tipT -= dt; if (tipT <= 0) { tipEl.hidden = true; topStack(); } }
  if (tipMarkT > 0) { tipMarkT -= dt; if (tipMarkT <= 0 || (tipMarkPos && player.pos.distanceTo(tipMarkPos) < 6)) { tipMarkT = 0; tipMarkPos = null; } }
  tips.update(dt, tipState);
}let lastCoins = -1;
export function updateStats() {
  if (save.coins !== lastCoins) { const grow = lastCoins >= 0 && String(save.coins).length !== String(lastCoins).length; lastCoins = save.coins; const c = String(save.coins); $('coins').textContent = c; if (grow) topFit.dirty(); $('m-coins').textContent = c; $('shop-coins').textContent = c; $('ach-coins').textContent = c; }
}
export function addCoins(n, why) { save.coins = Math.max(0, save.coins + n); persist(); updateStats(); if (why) toast(`${why} · 귤 ${n > 0 ? '+' : ''}${n}`); if (n > 0) { late.sound.coin?.(); const g = document.querySelector('.gyul'); g.classList.remove('bump'); void g.offsetWidth; g.classList.add('bump'); } }
const PANELS = ['shop', 'sign', 'wishes', 'chat', 'actions', 'menu', 'ach', 'dex', 'maps', 'feedback', 'notes', 'server', 'shoppop', 'rank'];
export const panelOpen = () => PANELS.some((id) => !$(id).hidden);
export const busy = () => ['sit', 'photo', 'photo-wait', 'crouch'].includes(player.pose) || cam.mode === 'wardrobe' || lookS.open || panelOpen() || !!player.rescue || hp.isDown || hp.pending;
export function closePanels() { PANELS.forEach((id) => { $(id).hidden = true; }); }
export function cancelAll() {
  closePanels();
  state.emo.stop(); // 동작 그만 (#76)
  if (player.pose === 'sit') late.standUp();
  if (cam.mode === 'wardrobe') late.closeWardrobe();
  player.target = null; player.onArrive = null; late.marker.visible = false;
}
// 닫기 버튼과 바깥 누르면 닫기
[['shoppop-close', 'shoppop'], ['shop-close', 'shop'], ['sign-close', 'sign'], ['wish-close', 'wishes'], ['ach-close', 'ach'], ['dex-close', 'dex'], ['maps-close', 'maps'], ['feedback-close', 'feedback'], ['notes-close', 'notes'], ['server-close', 'server'], ['chat-close', 'chat'], ['rank-close', 'rank']].forEach(([b, p]) => $(b).addEventListener('click', () => { $(p).hidden = true; }));
['shop', 'sign', 'wishes', 'ach', 'dex', 'maps', 'feedback', 'notes', 'shoppop', 'rank'].forEach((id) => $(id).addEventListener('pointerdown', (e) => { if (e.target === $(id)) $(id).hidden = true; }));

// ---------- 업적 ----------
export const ach = createAchievements({ save, persist, mapId: MAP_ID, onDone: (r) => onAchievement(r) }); late.ach = ach;
let bannerQueue = [], bannerT = 0;
const bIcon = (b) => BADGE_ICONS[b.id] || BADGE_ICONS[b.fam] || '';
function onAchievement(r) {
  late.sound.fanfare?.();
  if (r.kind === 'daily') bannerQueue.push({ icon: DAILY_ICON, color: '#4f7a36', title: `오늘의 업적 · ${r.def.name}`, sub: `보상 귤 ${r.def.reward}` });
  else if (r.kind === 'badge') bannerQueue.push({ icon: bIcon(r.def), color: r.def.color, title: `뱃지 · ${r.def.name}${r.def.fam ? ` ${r.def.tier}단계` : ''}`, sub: r.def.desc });
  else if (r.kind === 'allday') bannerQueue.push({ icon: ALLDAY_ICON, color: '#8f7bd6', title: '오늘의 업적을 모두 마쳤어요', sub: `모두 마친 날 ${ach.state.allDays}일` });
  refreshAchUI();
}
export function tickBanner(dt) {
  if (document.body.classList.contains('tut')) return; // 튜토리얼 중엔 조용히. 보상은 업적 창에 남아 있음
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) { $('banner').hidden = true; document.body.classList.remove('banner-on'); } return; }
  const b = bannerQueue.shift(); if (!b) return;
  $('banner-bdg').innerHTML = iconSvg(b.icon); $('banner-bdg').style.background = b.color;
  $('banner-title').textContent = b.title; $('banner-sub').textContent = b.sub;
  $('banner').hidden = false; document.body.classList.add('banner-on'); bannerT = 4.5; topStack();
}
$('banner-go').addEventListener('click', () => { $('banner').hidden = true; document.body.classList.remove('banner-on'); bannerT = 0; openAch(); });
export function refreshAchUI() {
  const d = ach.ensureDaily();
  const done = d.items.filter((x) => x.done).length;
  $('ach-count').textContent = `${done}/${d.items.length}`; $('ach-ring').setAttribute('stroke-dasharray', `${(done / Math.max(1, d.items.length) * 56.5).toFixed(1)} 56.5`);
  const un = ach.unclaimed();
  $('ach-dot').hidden = !un; $('ach-dot2').hidden = !un;
  if (!$('ach').hidden) buildAch();
}
export function openAch() { closePanels(); buildAch(); $('ach').hidden = false; }
$('ach-chip').addEventListener('click', openAch);
{ const g = $('gyul-pill'); g.addEventListener('click', () => late.openShop('gear')); g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); late.openShop('gear'); } }); }
$('btn-ach').addEventListener('click', openAch);
function buildAch() {
  const d = ach.ensureDaily();
  const [yy, mm, dd] = d.date.split('-');
  $('ach-date').textContent = `${Number(mm)}월 ${Number(dd)}일 · 매일 자정에 바뀌어요`;
  const list = $('ach-list'); list.innerHTML = '';
  d.items.forEach((it) => {
    const def = ach.defD(it.id); if (!def) return;
    const row = document.createElement('div'); row.className = 'ach-item' + (it.done ? ' done' : '');
    const t = document.createElement('div');
    const nm = document.createElement('b'); nm.textContent = def.name;
    const sm = document.createElement('small'); sm.textContent = ` ${it.prog.toLocaleString('ko-KR')} / ${def.goal.toLocaleString('ko-KR')}${def.map ? ` · ${MAPS[def.map].short}` : ''}`;
    t.append(nm, sm);
    const right = document.createElement('div');
    if (it.claimed) { right.className = 'muted'; right.style.fontSize = '12px'; right.textContent = '받음'; }
    else if (it.done) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small primary'; b.textContent = `귤 ${def.reward} 받기`; b.addEventListener('click', () => { const got = ach.claim('daily', it.id); if (got) addCoins(got.reward, got.name); refreshAchUI(); buildAch(); }); right.append(b); }
    else { right.className = 'muted'; right.style.fontSize = '12px'; right.textContent = `귤 ${def.reward}`; }
    const bar = document.createElement('div'); bar.className = 'bar'; const fillEl = document.createElement('i'); fillEl.style.width = `${Math.round((it.prog / def.goal) * 100)}%`; bar.append(fillEl);
    row.append(t, right, bar); list.append(row);
  });
  $('ach-streak').textContent = `모두 마친 날 ${ach.state.allDays}일`;
  const bl = $('badge-list'); bl.innerHTML = '';
  // 단계형(fam)은 한 칸: 받을 수 있는 단계가 있으면 그 단계, 아니면 다음 목표(다 했으면 마지막 단계)
  const groups = []; const byFam = {};
  BADGES.forEach((b) => { if (!b.fam) { groups.push([b]); return; } if (!byFam[b.fam]) { byFam[b.fam] = []; groups.push(byFam[b.fam]); } byFam[b.fam].push(b); });
  groups.forEach((g) => {
    const earned = g.filter((b) => ach.state.badges[b.id]);
    const unclaimed = earned.find((b) => !ach.state.badges[b.id].claimed);
    const next = g.find((b) => !ach.state.badges[b.id]);
    const b = unclaimed || next || g[g.length - 1], st = ach.state.badges[b.id];
    const tierN = earned.length;
    const el = document.createElement('div'); el.className = 'badge' + (earned.length ? '' : ' locked');
    const circ = document.createElement('span'); circ.className = 'bdg'; circ.style.background = b.color; circ.innerHTML = iconSvg(bIcon(b));
    const nm = document.createElement('b'); nm.style.fontWeight = '600'; nm.textContent = b.fam ? `${b.name}${tierN ? ` ${tierN}단계` : ''}` : b.name;
    const ds = document.createElement('small'); ds.textContent = st ? b.desc : `${b.desc}${b.goal > 1 ? ` (${Math.min(b.goal, ach.state.life[b.ev] || 0).toLocaleString('ko-KR')}/${b.goal.toLocaleString('ko-KR')})` : ''}`;
    el.append(circ, nm, ds);
    // #16: 예전 옷 색 보상(item)은 #52 옷장과 이어지지 않아 귤만 줌
    if (st && !st.claimed) { const c = document.createElement('button'); c.type = 'button'; c.className = 'chip claim'; c.textContent = `귤 ${b.reward} 받기`; c.addEventListener('click', () => { const got = ach.claim('badge', b.id); if (got) addCoins(got.reward, `뱃지 ${got.name}`); refreshAchUI(); buildAch(); }); el.append(c); }
    bl.append(el);
  });
}

// ---------- 쓰레기 도감 (#13) ----------
export function openDex() { closePanels(); buildDex(); $('dex').hidden = false; }
function buildDex() {
  if (!trash) return;
  const dx = trash.store.dex, got = DEX_LIST.filter((d) => dx[d.id] > 0).length;
  $('dex-count').textContent = `${got} / ${DEX_LIST.length}`;
  const g = $('dex-grid'); g.innerHTML = ''; let sec = '';
  DEX_LIST.forEach((d) => {
    if ((d.sec || '') !== sec) { sec = d.sec || ''; const h = document.createElement('div'); h.className = 'dex-sec'; h.textContent = sec === 'stream' ? '개울' : ''; g.append(h); } // 개울 칸 (#44)
    const n = dx[d.id] || 0, el = document.createElement('div'); el.className = 'dex-cell' + (n ? '' : ' locked') + (d.rare ? ' rare' : '');
    el.dataset.id = d.id;
    const ic = document.createElement('span'); ic.className = 'dex-ic'; ic.innerHTML = iconSvg(dexIcon(d));
    const nm = document.createElement('b'); nm.textContent = n ? d.name : '???';
    const sm = document.createElement('small'); sm.textContent = n ? `${n.toLocaleString('ko-KR')}${d.kind === 'fish' ? '마리' : '개'}` : (d.rare ? '드문 것' : '');
    el.append(ic, nm, sm); g.append(el);
  });
}
$('menu-dex')?.addEventListener('click', openDex);
$('ach-dex')?.addEventListener('click', openDex);
export function onDexGet(dex, isNew) {
  if (dex.rare) tips.event('rare');
  if (isNew) { ach.emit('dex'); if (dex.rare) addCoins(DEX.rareGyul, `드문 것! ${dex.name} · 도감 등록`); else toast(`도감 · ${dex.name}`); }
  else if (dex.rare) addCoins(DEX.rareGyul, `드문 것! ${dex.name}`);
  if (!$('dex').hidden) buildDex();
}
