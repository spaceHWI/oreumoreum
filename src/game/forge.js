// 강화 (#140, notes/growth-loop.md 5절): 장비점 창의 '강화' 쪽. 한 화면: 칸 고르기 → 지금 → 다음 능력·필요한 것·[강화] 한 번 누르기
// 모자라면 '어디서 얻는지' 와 [가는 길](그 구역 소굴까지 자동 걷기). 아래에 재료 주머니·안 쓰는 장비([입기]·[귤로 바꾸기])·자동 정리 설정
// 셈은 src/loot.js (enhCost·enhance), 장비점 틀은 shop.js(gearTabs·fillGearShop 를 감쌈)
import { TOOLS, BAGS, POCKET, WEAPONS, WEAR, GROWTH, LOOT, ENEMY_SPAWN, ENEMIES } from '../balance.js';
import { wearStatText } from '../clothicons.js';
import { enhCost, canPay, enhance, enhOk, curItem, itemName, itemPts, gradeColor, gradeName, MAT, MATS, upMul, shoeSpeed, wearUp, diffPts, canEquip, sellValue, fxOf, tidySpare, GEAR_SLOTS, WEAR_K } from '../loot.js';
import { late } from './state.js';
import { $, save, persist, WSLOT } from './save.js';
import { toast, updateStats, closePanels } from './hud.js';
import { refreshShopPop, shopPopNow } from './stores.js';
import { scoreChip, gdBadge } from './shop.js';
import { startAutoGo } from './dump.js';
import { field } from './field.js';
import { matSvg, itemSvg, wearSpare, sellAt } from './loot.js';
import { player } from './place.js';
import { updateTrashUI } from './pickup.js';
import { net } from './room.js';
import * as THREE from 'three';
import { height } from '../world.js';

const SLOT_NAME = { tool: '도구', bag: '배낭', shoes: '신발', weapon: '무기', ...Object.fromEntries(WEAR.slots.map((w) => [w.k, w.name])) };
let on = false, pick = 'tool';
setInterval(() => { if ($('shoppop').hidden) on = false; }, 500); // 창을 닫으면 다음엔 사기 쪽부터

// 칸 k 장비 { t, g, e } 의 능력 한 줄 (등급·강화를 얹은 값)
function abil(k, u) {
  const s2 = { ...save, gearUp: { ...save.gearUp }, clothes: { ...save.clothes, up: { ...(save.clothes.up || {}) } } };
  if (WEAR_K.includes(k)) { const id = save.clothes.wear[k]; if (id) s2.clothes.up[id] = { g: u.g, e: u.e }; } else s2.gearUp[k] = { g: u.g, e: u.e };
  if (k === 'weapon') s2.weaponUse = save.equip.weapon;
  const m = upMul(s2, k), t = curItem(save, k).t;
  if (k === 'tool') { const T = TOOLS[t - 1]; return `${(T.per / T.time * m).toFixed(1).replace(/\.0$/, '')}/초`; }
  if (k === 'bag') return String(Math.floor((t ? BAGS[t - 1] : POCKET).cap * m));
  if (k === 'shoes') return `×${shoeSpeed(s2).toFixed(2).replace(/0$/, '')}`;
  if (k === 'weapon') { const W = WEAPONS[t - 1]; return W.dps ? `${+(W.dmg * m).toFixed(1)}/초` : String(+(W.dmg * m).toFixed(1)); }
  const w = WSLOT[k]; return wearStatText(w.stat, wearUp(s2, k, w.v[t]));
}
const ready = () => GEAR_SLOTS.filter((k) => enhOk(save, k) && canPay(save, enhCost(curItem(save, k).t, curItem(save, k).e)));
// 재료 k 를 얻는 곳: 그 구역 적 이름 · 가장 가까운 소굴 자리
function whereOf(mid) {
  const M = MAT[mid], kind = ENEMY_SPAWN.byZone[M.z], den = (field?.dens || []).filter((d) => d.zone === M.z).sort((a, b) => Math.hypot(a.x - player.pos.x, a.z - player.pos.z) - Math.hypot(b.x - player.pos.x, b.z - player.pos.z))[0];
  return { text: M.kind === 'rare' ? `구역 ${M.z} 우두머리` : `구역 ${M.z} ${ENEMIES[kind]?.name || '적'} · 소굴`, den };
}
function goGet(mid) {
  const w = whereOf(mid); if (!w.den) { toast(`${w.text}에서 얻어요`); return; }
  closePanels();
  const pos = new THREE.Vector3(w.den.x, height(w.den.x, w.den.z), w.den.z);
  if (!startAutoGo({ pos, near: 8, arrive: () => toast(`${MAT[mid].name}: ${w.text}`) })) toast(`${w.text}에서 얻어요`);
}

function doEnhance(k) {
  const cur = curItem(save, k), c = enhCost(cur.t, cur.e); if (!c) return;
  if (!canPay(save, c)) { toast('재료가 모자라요'); return; }
  const from = save.coins;
  if (!enhance(save, k)) return;
  persist(); updateStats(); updateTrashUI(true); net.send(true); late.shopCoinsChanged?.(); late.bagRefresh?.();
  late.sound?.coin?.(); if (cur.e + 1 >= GROWTH.enhMax) late.sound?.fanfare?.();
  toast(`${itemName(curItem(save, k))} · 강화했어요`, 2);
  refreshShopPop();
  const el = document.querySelector('#shoppop-cards .forge-item'); if (el) { el.classList.remove('forge-pop'); void el.offsetWidth; el.classList.add('forge-pop'); }
  const btn = document.querySelector('#shoppop-cards .forge-go'); if (btn && c.gyul) late.spendFx?.(btn, c.gyul, from);
}

function fillForge(grid) {
  grid.classList.add('forge-grid');
  if (!enhOk(save, pick)) pick = GEAR_SLOTS.find((k) => enhOk(save, k)) || 'tool';
  // 칸 10개
  const slots = document.createElement('div'); slots.className = 'forge-slots';
  for (const k of GEAR_SLOTS) {
    const it = curItem(save, k), b = document.createElement('button'); b.type = 'button'; b.className = 'forge-slot' + (k === pick ? ' on' : '') + (enhOk(save, k) ? '' : ' none');
    b.style.setProperty('--gc', gradeColor(it.g)); b.title = SLOT_NAME[k];
    const can = enhOk(save, k) && canPay(save, enhCost(it.t, it.e));
    b.innerHTML = `<span class="fs-art">${it.t ? itemSvg(it) : ''}</span><small>${SLOT_NAME[k]}</small>${it.e ? `<i class="fs-e">+${it.e}</i>` : ''}${can ? '<i class="fs-dot"></i>' : ''}`;
    b.disabled = !enhOk(save, k);
    b.addEventListener('click', () => { pick = k; refreshShopPop(); });
    slots.append(b);
  }
  grid.append(slots);
  // 고른 칸
  const it = curItem(save, pick), c = enhCost(it.t, it.e), main = document.createElement('section'); main.className = 'forge-main';
  if (!enhOk(save, pick)) { main.innerHTML = '<p class="muted">입은 장비가 없어요</p>'; grid.append(main); return; }
  const nx = c ? { ...it, e: it.e + 1 } : null, fx = it.g === 3 ? LOOT.fx[fxOf(pick)] : null;
  main.innerHTML = `<div class="forge-item" style="--gc:${gradeColor(it.g)}"><span class="fi-art">${itemSvg(it)}</span><span class="fi-bn"><small>${SLOT_NAME[pick]} · ${gradeName(it.g)}</small><b>${itemName(it)}</b>${fx ? `<em class="lp-fx">${fx.name}</em>` : ''}</span></div>`
    + `<div class="forge-step"><span class="fv">${abil(pick, it)}<small>+${it.e}</small></span>${nx ? `<span class="fa">→</span><span class="fv nx">${abil(pick, nx)}<small>+${nx.e}</small></span>` : '<span class="fv nx max">최고 강화</span>'}</div>`
    + `<div class="forge-sc">${scoreChip(itemPts(it), 0)}${nx ? ` → ${scoreChip(itemPts(nx), itemPts(nx) - itemPts(it))}` : ''}</div>`;
  if (c) {
    const need = document.createElement('div'); need.className = 'forge-need';
    const row = (html, name, have, n, mid) => { const ok = have >= n, r = document.createElement('div'); r.className = 'fn' + (ok ? ' ok' : ' short'); r.innerHTML = `<span class="fn-ic">${html}</span><span class="fn-nm">${name}</span><b>${have.toLocaleString()} / ${n.toLocaleString()}</b>`;
      if (!ok && mid) { const w = whereOf(mid), g = document.createElement('button'); g.type = 'button'; g.className = 'chip fn-go'; g.textContent = w.den && MAT[mid].kind !== 'rare' ? '가는 길' : '어디서?'; g.title = w.text; g.addEventListener('click', () => (MAT[mid].kind === 'rare' ? toast(`${MAT[mid].name}: ${w.text}를 쫓아내면 반드시 줘요`, 3) : goGet(mid))); const s = document.createElement('small'); s.className = 'fn-where'; s.textContent = w.text; r.append(s, g); }
      need.append(r); };
    row(`<i style="color:${MAT[c.mat].color}">${matSvg(c.mat)}</i>`, MAT[c.mat].name, save.mats[c.mat] || 0, c.n, c.mat);
    if (c.rn) row(`<i style="color:#ffd27a">${matSvg(c.rare)}</i>`, MAT[c.rare].name, save.mats[c.rare] || 0, c.rn, c.rare);
    row('<i class="g"></i>', '귤', save.coins, c.gyul, null);
    main.append(need);
    const go = document.createElement('button'); go.type = 'button'; go.className = 'btn primary forge-go' + (canPay(save, c) ? '' : ' short');
    go.innerHTML = canPay(save, c) ? `강화 +${it.e + 1}` : '재료가 모자라요'; go.addEventListener('click', () => doEnhance(pick));
    main.append(go);
    const note = document.createElement('small'); note.className = 'forge-note'; note.textContent = `한 번에 능력 +${Math.round(GROWTH.enh * 100)}% · 실패 없음`; main.append(note);
  }
  grid.append(main);
  // 재료 주머니
  const pouch = document.createElement('section'); pouch.className = 'forge-pouch';
  pouch.innerHTML = '<h4>재료 주머니</h4>';
  const ml = document.createElement('div'); ml.className = 'fp-list';
  for (const M of MATS) for (const id of [M.id, M.rare]) { const n = save.mats[id] || 0; if (!n && MAT[id].kind === 'rare') continue; const s = document.createElement('span'); s.className = 'fp' + (n ? '' : ' zero'); s.title = MAT[id].name; s.innerHTML = `<i style="color:${MAT[id].kind === 'rare' ? '#ffd27a' : M.color}">${matSvg(id)}</i><b>${n}</b>`; ml.append(s); }
  pouch.append(ml); grid.append(pouch);
  // 안 쓰는 장비
  const sp = document.createElement('section'); sp.className = 'forge-spare';
  sp.innerHTML = `<h4>안 쓰는 장비 <small>${save.loot.length}</small></h4>`;
  const auto = document.createElement('label'); auto.className = 'fs-auto';
  auto.innerHTML = `<input type="checkbox" ${save.lootAuto ? 'checked' : ''}> 칸마다 가장 좋은 것만 남기고 귤로`;
  auto.querySelector('input').addEventListener('change', (ev) => { save.lootAuto = ev.target.checked ? 1 : 0; persist(); if (save.lootAuto) late.tidyLoot?.(); refreshShopPop(); });
  sp.append(auto);
  if (!save.loot.length) { const e = document.createElement('p'); e.className = 'muted'; e.textContent = '적·소굴·보물·우두머리가 가끔 장비를 떨궈요'; sp.append(e); }
  save.loot.forEach((x, i) => {
    const r = document.createElement('div'); r.className = 'fs-row'; r.style.setProperty('--gc', gradeColor(x.g));
    const ok = canEquip(save, x);
    r.innerHTML = `<span class="fs-art">${itemSvg(x)}</span><span class="fs-bn"><b>${itemName(x)}</b><small>${gradeName(x.g)} · ${SLOT_NAME[x.s]}</small></span>${gdBadge(diffPts(save, x))}`;
    const w = document.createElement('button'); w.type = 'button'; w.className = 'btn small'; w.textContent = ok ? '입기' : '못 입음'; w.disabled = !ok; w.addEventListener('click', () => { if (wearSpare(i)) toast(`${itemName(x)} · 입었어요`); refreshShopPop(); });
    const s = document.createElement('button'); s.type = 'button'; s.className = 'btn small'; s.innerHTML = `<i class="g"></i>${sellValue(x)}`; s.title = '귤로 바꾸기'; s.addEventListener('click', () => { sellAt(i); refreshShopPop(); });
    r.append(w, s); sp.append(r);
  });
  grid.append(sp);
}
late.tidyLoot = () => { const sold = tidySpare(save); if (!sold.length) return; persist(); updateStats(); late.shopCoinsChanged?.(); toast(`안 쓰는 장비 ${sold.length}개 → 귤 ${sold.reduce((s, [, v]) => s + v, 0)}`, 2.4); };

// 사기 ↔ 강화 바꾸는 줄 (데스크톱·폰 둘 다, 창 맨 위)
function modeRow(grid) {
  const r = document.createElement('div'); r.className = 'forge-switch';
  const n = ready().length;
  r.innerHTML = `<button type="button" data-m="buy" aria-pressed="${!on}">사기</button><button type="button" data-m="forge" aria-pressed="${on}">강화${n ? `<i class="cnt">${n}</i>` : ''}</button>`;
  r.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { on = b.dataset.m === 'forge'; refreshShopPop(); }));
  grid.append(r);
}
const baseTabs = late.gearTabs, baseFill = late.fillGearShop;
late.gearTabs = (el) => { $('shoppop').classList.toggle('forge-on', on); if (!on) baseTabs(el); };
late.fillGearShop = (grid) => {
  if (!late.tut?.active) modeRow(grid); else on = false; // 튜토리얼(집게·배낭 사기) 동안은 사기만
  if (on) fillForge(grid); else baseFill(grid);
};
late.forgeRefresh = () => { if (!$('shoppop').hidden && shopPopNow === 'gear') refreshShopPop(); };
late.forgeApi = { open: () => { on = true; late.openShopPop?.('gear'); refreshShopPop(); }, pick: (k) => { pick = k; refreshShopPop(); }, enhance: (k) => doEnhance(k), ready, on: () => on && !$('shoppop').hidden, abil };
