// 장비점 창(도구·배낭·무기)·가게 안내(무엇을 어디서 사는지·길 안내)·살 수 있는 새 물건 점·사는 연출, 옷 (#128. #86 에서 main.js 를 나눔. 파일 순서는 src/modules.js, 규칙은 notes/prototype-v1.md 코드 구조)
// 사는 것은 모두 가게 거리의 가게에서 (#128): 도구·배낭·무기 = 장비점, 옷·신발 = LEAP, 머리 = 루이네미장원, 탈것 = 탈것 가게, 식사 = 스톤
// 어디서나 열리던 상점(메뉴·귤 칸)은 가게 안내 → 고르면 그 가게까지 자동 걷기(dump.js startAutoGo(dest)) → 도착하면 그 가게 창
import { TOOLS, BAGS, POCKET, SHOES, BOOTS, WEAPONS, WEAR, CLOTHES, wearPrice, HAIR, RIDES, LEAP, CLEANHOUSE } from '../balance.js';
import { onShelf } from '../weekly.js'; // 주간 옷장 (#126): 지난주·다음 주 한정 옷은 점·잠긴 칸에서 뺌
import { LOW } from '../gfx2.js';
import { clothSvg, WEAR_STAT_ICON, wearStatText } from '../clothicons.js';
import { SHOP_ICON } from '../shops.js';
import { ic } from '../icons.js';
import { state, late } from './state.js';
import { $, save, CLOTH, CL, wearV, syncEquipGear, persist } from './save.js';
import { LEAPB, street, shopsBuilt, roofSigns, CH, runner, player } from './place.js';
import { cam } from './camera.js';
import { toast, tipMark, updateStats, closePanels, ach } from './hud.js';
import { net } from './room.js';
import { updateTrashUI } from './pickup.js';
import { SHOP_POP, openShopPop, refreshShopPop, shopPopNow } from './stores.js';
import { startAutoGo } from './dump.js';
import { itemScore, scoreDiff, gyulPickR, abilityCloth } from '../gearscore.js';
import { LOOK_COLORS } from '../balance.js';
import { colorDots, lcIndex } from '../lookcolors.js'; // 기본 옷 색 (#155)

Object.assign(late, { openShop, spendFx, buyGear, wearCloth, buyCloth, wearBoots, buyBoots, gdBadge, scoreChip, goShop, shopGuide, gearTabs, fillGearShop, fillShopDir, shopOpened }); // 앞 파일에서 부르는 함수

// ---------- 장비점 (#128) ----------
// 세 묶음 도구·배낭·무기 (LEAP 이 없는 맵이면 신발도). 데스크톱은 한 화면에 나란히, 폰은 위쪽 큰 탭. 카드 = 그림·이름·능력 '지금 → 사면'·값 + 큰 [사기]
const GEAR_ROWS = { tool: { k: 'tool', name: '도구', list: TOOLS }, bag: { k: 'bag', name: '배낭', list: BAGS }, weapon: { k: 'weapon', name: '무기', list: WEAPONS }, shoes: { k: 'shoes', name: '신발', list: SHOES } };
const gearKeys = () => Object.keys(GEAR_ROWS).filter((k) => !(k === 'shoes' && LEAPB)); // 신발은 LEAP 이 있으면 거기서 (#59)
const SVG_A = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"'; late.SVG_A = SVG_A;
// 단계마다 그림: 아이콘 세트(#184). 가게 카드·내 가방은 실제 모델을 찍은 그림(thumbs.js itemArt)이 먼저, 없으면 이것
const TIER_ART = {
  tool: ['hand', 'tongs', 'rake', 'bigrake', 'vacuum'].map(ic), // 맨손·집게·갈퀴·큰 갈퀴·흡입기
  bag: [0, 1, 2, 3, 4].map(() => ic('bag')),
  shoes: [0, 1, 2, 3, 4].map(() => ic('shoe')),
  weapon: ['gyul-throw', 'bow', 'gun', 'mg', 'laser', 'bomb'].map(ic), // 손(귤 던지기)·귤 활·귤 총·머신건·레이저·폭탄
  boots: ['<path d="M8 2h7v11l3 1.5a2 2 0 0 1 1 1.8V19H6V2z"/><path d="M8 5h7M6 19v2h13v-2"/>'], // 고진의 파란장화 (#167)
}; late.TIER_ART = TIER_ART;
const STAT_ICON = {
  per: ic('per'), // 한 번에 몇 개
  rate: ic('rate'), // 초당
  r: ic('reach'), // 닿는 거리
  cap: ic('bag'), // 배낭 칸
  speed: ic('speed'), // 빠르기
  dmg: ic('dmg'), // 피해
  gyul: ic('magnet'), // 귤 모으는 범위 (#151)
};
const STAT_TITLE = { per: '한 번에 줍는 수', rate: '초당 줍는 수', r: '닿는 거리', cap: '배낭 용량', speed: '빠르기', dmg: '피해', gyul: '귤 모으는 범위' }; late.STAT_ICON = STAT_ICON;
// 장비 점수 (#137): 칸마다 지금 것 대비 ▲/▼ 점수 차, 고른 것의 점수
const SCORE_IC = ic('score');
export function gdBadge(d) { return d ? `<i class="gd ${d > 0 ? 'up' : 'down'}" aria-label="장비 힘 ${d > 0 ? '+' : ''}${d}">${d > 0 ? '▲' : '▼'}${Math.abs(d)}</i>` : ''; }
export function scoreChip(sc, d) { return `<span class="gs" title="장비 힘">${SVG_A}>${SCORE_IC}</svg>${sc}${d ? ` ${gdBadge(d)}` : ''}</span>`; }
const tierStats = (k, t) => t.soon ? [] : k === 'weapon' ? [['dmg', t.dps ? `${t.dmg}/s` : t.r ? `${t.dmg}·${t.r}m` : String(t.dmg)], ['r', `${t.range}m`]] : k === 'tool' ? [t.rate ? ['rate', `${t.rate}/s`] : ['per', `×${t.per}`], ['r', `${t.r}m`]]
  : k === 'bag' ? [['cap', String(t.cap)], ['gyul', `${gyulPickR({ equip: { bag: t.tier } })}m`]] : [['speed', `×${String(t.speed.toFixed(2)).replace(/0$/, '')}`]];
// 순서 없이 사기 (#111): 귤만 충분하면 어느 단계든 바로 산다. 산 단계 아래는 '가짐'
// 튜토리얼 집게·배낭 단계에서는 그 물건(바로 다음 단계)만
const tutOnly = (k) => { const s = late.tut?.active && late.tut.step; return (s === 'tongs' && k === 'tool') || (s === 'bag' && k === 'bag'); };
const buyable = (k, i) => { const t = GEAR_ROWS[k].list[i]; return !!t && !t.soon && i >= save.equip[k] && (!tutOnly(k) || i === save.equip[k]); };
export const canBuyGear = () => gearKeys().filter((k) => GEAR_ROWS[k].list.some((t, i) => buyable(k, i) && save.coins >= t.price)); late.canBuyGear = canBuyGear;
let gearTab = 'tool', justKey = '', justT = 0; // gearTab: 폰에서 보이는 묶음, justKey: 방금 산 카드('장착했어요')
export const gearTabNow = () => (!$('shoppop').hidden && shopPopNow === 'gear' ? gearTab : null); // 튜토리얼이 누를 곳을 고를 때
// 예전 상점 열기 (#128 뒤): 사는 창 대신 그 물건을 파는 가게로 길 안내
export function openShop(tab) {
  const to = { tool: 'gear', bag: 'gear', weapon: 'gear', shoes: LEAPB ? 'leap' : 'gear', wear: 'leap' }[tab];
  if (to) goShop(to); else shopGuide();
}
export function checkGearBadges() { // 장비 최고 단계 뱃지 (#13)
  const m = ['tool', 'bag', 'shoes'].map((k) => save.equip[k] >= 5);
  if (m.some(Boolean) && !ach.state.badges['b-gear-one']) ach.emit('gear-max-one');
  if (m.every(Boolean) && !ach.state.badges['b-gear-all']) ach.emit('gear-max-all');
}
// 사는 연출: 귤이 위 귤 칸에서 빠져나가 산 물건 쪽으로 날아가 사라지고, 숫자가 줄어든다
function spendFx(toEl, price, from, pill = document.querySelector('#shoppop .coins-pill'), num = $('shoppop-coins')) {
  pill.classList.remove('drain'); void pill.offsetWidth; pill.classList.add('drain');
  const a = pill.querySelector('i').getBoundingClientRect(), b = toEl.getBoundingClientRect();
  const sx = a.left + a.width / 2, sy = a.top + a.height / 2, tx = b.left + b.width / 2, ty = b.top + b.height / 2;
  const n = Math.min(LOW ? 5 : 9, Math.max(3, Math.round(Math.log2(price + 1))));
  for (let i = 0; i < n; i++) setTimeout(() => {
    const d = document.createElement('div'); d.className = 'fx-spend'; d.style.left = sx + 'px'; d.style.top = sy + 'px'; document.body.append(d);
    requestAnimationFrame(() => requestAnimationFrame(() => { d.style.transform = `translate(${tx - sx + (Math.random() - 0.5) * 24}px, ${ty - sy + (Math.random() - 0.5) * 12}px) scale(.4)`; d.style.opacity = '0'; }));
    setTimeout(() => d.remove(), 600);
  }, i * 45);
  const to = save.coins, t0 = performance.now(), dur = 500;
  const step = (t) => { const k = Math.min(1, (t - t0) / dur); num.textContent = String(Math.round(from + (to - from) * k)); if (k < 1 && save.coins === to) requestAnimationFrame(step); else num.textContent = String(save.coins); };
  requestAnimationFrame(step);
}
export function buyGear(k, i = save.equip[k]) { // i: 살 단계 (목록 칸 번호, 없으면 바로 다음 단계)
  const row = GEAR_ROWS[k]; if (!row) return; const next = row.list[i];
  if (!buyable(k, i)) { if (next && !next.soon && i > save.equip[k] && tutOnly(k)) toast(`지금은 ${row.list[save.equip[k]].name}부터 사요`); return; }
  const off = late.questOff?.('gear', next.price) || 0, pay = next.price - off; // 퀘스트 할인권 (#158)
  if (save.coins < pay) { toast(`귤이 ${pay - save.coins}개 모자라요`); return; }
  const from = save.coins;
  save.coins -= pay; if (off) late.questUse('gear'); late.tierUpLoot?.(k); save.equip[k] = i + 1; if (k === 'shoes' && save.equip.boots === 2) save.equip.boots = 1; /* 새 신발을 사면 장화를 벗음 (#167) */ late.lootTidy?.(); if (k === 'weapon') { save.weaponUse = i + 1; if (save.tok) save.tok.arm = null; } /* 새로 산 무기를 바로 씀 (#123), 징표 무기는 내려놓음 (#255) */
  syncEquipGear(); runner.apply(save.outfit); persist(); updateStats(); updateTrashUI(true); net.send(true);
  if (k === 'weapon') { late.sound.coin?.(); ach.emit('weapon-buy'); ach.emit('weapon-buy-' + next.id); late.armsChanged?.(); } // 무기 (#38, 고르는 창·탄 표시 #123)
  else { late.sound.coin?.(); ach.emit('gear-buy'); ach.emit('gear-buy-' + k); checkGearBadges(); }
  toast(off ? `${next.name} · 할인권으로 ${off}귤 아꼈어요` : `${next.name} · 장착했어요`);
  justKey = `${k}:${i}`; justT = performance.now();
  if (!$('shoppop').hidden && shopPopNow === 'gear') {
    refreshShopPop(); shopOpened('gear');
    const cell = document.querySelector(`#shoppop-cards .buy-card[data-k="${k}"][data-i="${i}"]`);
    if (cell) { cell.classList.add('tier-pop'); spendFx(cell, next.price, from); }
    setTimeout(() => { if (justKey === `${k}:${i}` && performance.now() - justT > 1500) { justKey = ''; if (!$('shoppop').hidden && shopPopNow === 'gear') refreshShopPop(); } }, 1700);
  }
  refreshDots();
}
const CHECK = () => `${SVG_A} stroke-width="3"><path d="M5 12l5 5 9-10"/></svg>`;
function gearTabs(el) {
  el.classList.add('shop-tabs', 'gear-tabs');
  if (!gearKeys().includes(gearTab)) gearTab = 'tool';
  for (const k of gearKeys()) {
    const row = GEAR_ROWS[k], cur = save.equip[k], art = TIER_ART[k][Math.max(0, Math.min(row.list.length - 1, cur - (k === 'bag' ? 0 : 1)))];
    const b = document.createElement('button'); b.type = 'button'; b.dataset.tab = k; b.title = row.name; b.setAttribute('aria-pressed', String(k === gearTab));
    const n = row.list.filter((t, i) => buyable(k, i) && save.coins >= t.price).length;
    b.innerHTML = `${SVG_A}>${art}</svg><span>${row.name}</span>${n ? `<i class="cnt">${n}</i>` : ''}`;
    b.addEventListener('click', () => { gearTab = k; refreshShopPop(); });
    el.append(b);
  }
}
// 한 묶음: 머리(이름·지금 것) + 단계 카드들
function gearGroup(k) {
  const row = GEAR_ROWS[k], cur = save.equip[k], now = cur ? row.list[cur - 1] : POCKET;
  const g = document.createElement('section'); g.className = 'buy-group' + (k === gearTab ? ' on' : ''); g.dataset.k = k;
  g.innerHTML = `<h3>${SVG_A}>${TIER_ART[k][Math.max(0, cur - 1)] || TIER_ART[k][0]}</svg>${row.name}<small>지금 ${now.name}</small></h3>`;
  row.list.forEach((t, i) => {
    const own = i < cur, on = k === 'weapon' ? (save.weaponUse || cur) === i + 1 : i === cur - 1, ok = buyable(k, i), poor = !own && !t.soon && (save.coins < t.price || !ok), just = justKey === `${k}:${i}`;
    const c = document.createElement('div'); c.dataset.k = k; c.dataset.i = i;
    c.className = 'buy-card' + (own ? ' own' : '') + (on ? ' on' : '') + (poor ? ' poor' : '') + (t.soon ? ' soon' : '') + (just ? ' just' : '') + (!own && i === cur && !t.soon ? ' next' : '');
    const stats = t.soon ? [] : tierStats(k, t), was = own ? null : tierStats(k, now);
    const st = stats.map(([ic, v], j) => `<span title="${STAT_TITLE[ic] || ''}">${SVG_A}>${STAT_ICON[ic]}</svg>${was && was[j] && was[j][1] !== v ? `<s>${was[j][1]}</s>→<em>${v}</em>` : v}</span>`).join('');
    c.innerHTML = `<span class="art">${late.itemArt ? late.itemArt(k, i, '') : `${SVG_A}>${TIER_ART[k][i]}</svg>`}${own || t.soon ? '' : gdBadge(scoreDiff(save, k, i + 1))}</span>`
      + `<span class="bn"><b>${t.soon ? '준비 중' : t.name}</b><small class="tier-stats">${st}${t.soon ? '' : scoreChip(itemScore(i + 1), 0)}</small></span>`;
    const act = document.createElement('span'); act.className = 'ba';
    if (just) act.innerHTML = `<span class="have">${CHECK()}장착했어요</span>`;
    else if (own) act.innerHTML = on ? `<span class="have">${CHECK()}${k === 'weapon' ? '쓰는 중' : '착용 중'}</span>` : '<span class="have dim">가짐</span>';
    else if (t.soon) act.innerHTML = '';
    else {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'tier-buy buy-btn' + (poor ? ' short' : '');
      b.innerHTML = !ok ? `지금은 ${row.list[cur]?.name || ''}부터` : save.coins < t.price ? `${(t.price - save.coins).toLocaleString()}귤 더 필요` : `<i class="g"></i>${t.price.toLocaleString()} 사기`;
      b.setAttribute('aria-label', `${t.name} 사기 · 귤 ${t.price}`); b.addEventListener('click', () => buyGear(k, i)); act.append(b);
    }
    c.append(act); g.append(c);
  });
  if (k === 'bag') late.backCards?.(g); // 배낭 겉모습 (#164 테왁)
  return g;
}
function fillGearShop(grid) {
  if (!gearKeys().includes(gearTab)) gearTab = 'tool';
  if (late.tut?.active) { const s = late.tut.step; if (s === 'tongs') gearTab = 'tool'; } // 튜토리얼: 집게부터
  grid.classList.add('gear-grid'); grid.style.setProperty('--n', String(gearKeys().length));
  for (const k of gearKeys()) grid.append(gearGroup(k));
  // 가진 것을 고르고 장착하는 창(내 가방 #166)으로 가는 문
  const foot = document.createElement('div'); foot.className = 'shop-foot';
  const bag = document.createElement('button'); bag.type = 'button'; bag.className = 'chip'; bag.id = 'gear-bag'; bag.textContent = '내 가방 열기';
  bag.addEventListener('click', () => { closePanels(); late.openBag?.(gearTab === 'weapon' ? 'arm' : gearTab === 'shoes' ? 'wear' : gearTab); }); // 보던 묶음의 탭으로
  foot.append(bag); grid.append(foot);
}
let drawnCoins = -1; // 그린 때의 귤: 귤 수가 바뀌면 다시 그려 흑백·색을 맞춤 (#111)
export function shopCoinsChanged() { if (save.coins === drawnCoins) return; drawnCoins = save.coins; if (!$('shoppop').hidden) late.refreshShopPop?.(); refreshDots(); }
late.shopCoinsChanged = shopCoinsChanged;

// ---------- 살 수 있는 새 물건 점 (#128): 가게 지붕 간판·귤 칸. 그 가게 창을 열면 지금 살 수 있는 것을 '본 것' 으로 (기기에만 저장) ----------
const SEEN_KEY = 'oreumoreum.shopSeen';
const seen = (() => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') || {}; } catch (_) { return {}; } })();
const SHOP_ITEMS = { // 가게마다 아직 안 가진 살 것 [{ key, price }]. 스톤(식사)은 늘 살 수 있어 점이 없음
  gear: () => gearKeys().flatMap((k) => GEAR_ROWS[k].list.map((t, i) => buyable(k, i) && { key: `${k}:${i + 1}`, price: t.price }).filter(Boolean)),
  leap: () => [...CLOTHES.filter((c) => LEAP.slots.includes(c.slot) && !CL.own[c.id] && onShelf(c)).map((c) => ({ key: 'c:' + c.id, price: wearPrice(c) })),
    ...(LEAPB ? SHOES.map((t, i) => i >= (save.equip.shoes || 1) && { key: 'shoes:' + (i + 1), price: t.price }).filter(Boolean) : []),
    ...(LEAPB && !save.equip.boots ? [{ key: 'shoes:boots', price: BOOTS.price }] : [])],
  salon: () => (save.look ? HAIR.list.filter((h) => !save.hairs[h.key]).map((h) => ({ key: 'h:' + h.key, price: h.price })) : []),
  ride: () => RIDES.list.filter((r) => !(save.rides.own || []).includes(r.id)).map((r) => ({ key: 'r:' + r.id, price: r.price })),
};
const affordable = (id) => (SHOP_ITEMS[id] ? SHOP_ITEMS[id]().filter((x) => x.price <= save.coins) : []);
const newCount = (id) => affordable(id).filter((x) => !seen[x.key]).length;
const pillDot = $('gyul-dot');
// #201: 점은 '받을 것이 있을 때' 만. 살 수 있는 새 물건은 점을 띄우지 않음 (지붕·귤 칸 점 끔). newCount 는 확인용으로 남김
export function refreshDots() {
  for (const sh of shopsBuilt) roofSigns?.dot(sh.id, false);
  if (pillDot && !pillDot.hidden) pillDot.hidden = true;
}
export function shopOpened(key) {
  const id = shopsBuilt.find((sh) => sh.pop === key)?.id || (key === 'gear' ? 'gear' : null); if (!id) return;
  let ch = false; for (const x of affordable(id)) if (!seen[x.key]) { seen[x.key] = 1; ch = true; }
  if (ch) { try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch (_) { /* 무시 */ } }
  refreshDots();
}
setTimeout(refreshDots, 0);

// ---------- 가게 안내 (#128): 무엇을 어디서 사는지 · 고르면 그 가게까지 걸어감 ----------
const shopSvg = (id) => `${SVG_A}>${SHOP_ICON[id] || ''}</svg>`;
function fillShopDir(grid) {
  grid.classList.add('dir-grid');
  for (const sh of shopsBuilt) {
    const P = SHOP_POP[sh.pop], open = !P?.when || P.when(), n = open ? affordable(sh.id).length : 0, nw = open ? newCount(sh.id) : 0, d = Math.round(Math.hypot(player.pos.x - sh.door.x, player.pos.z - sh.door.z));
    const b = document.createElement('button'); b.type = 'button'; b.className = 'menu-card dir-card' + (open ? '' : ' poor'); b.dataset.shop = sh.id;
    b.setAttribute('aria-label', `${sh.name} · ${sh.sells}${n ? ` · 지금 살 수 있는 것 ${n}` : ''}`);
    b.innerHTML = `<span class="food dir-ic">${shopSvg(sh.id)}${nw ? '<i class="ndot"></i>' : ''}</span><span class="mn"><b>${sh.name}</b><small>${open ? sh.sells : late.shopWhy?.(sh.id) ? `준비 중 · ${late.shopWhy(sh.id)} 열려요` : sh.sells}</small></span>`
      + `<span class="mv">${n ? `<span class="bf">살 수 있는 것 ${n}</span>` : ''}<span class="dist">${d < 8 ? '바로 앞' : `${d}m`}</span></span>`;
    b.addEventListener('click', () => goShop(sh.id));
    grid.append(b);
  }
  if (!shopsBuilt.length) { const p = document.createElement('p'); p.className = 'dir-none'; p.textContent = '이 맵에는 가게 거리가 없어요'; grid.append(p); }
}
// 그 가게 앞이면 바로 창, 아니면 가게 앞까지 자동 걷기 → 도착하면 창. msg: 앞에 붙일 말
export function goShop(id, msg = '') {
  const tutGear = id === 'gear' && late.tut?.active && ['tongs', 'bag'].includes(late.tut.step); /* #221 튜토리얼도 가게 거리 장비점 */
  if (id === 'gear' && CH && !street) return goTo({ pos: CH.shopFront, near: CLEANHOUSE.shopR, arrive: () => openShopPop('gear') }, '장비점 좌판', msg);
  if (late.tut?.active && !tutGear) { toast('튜토리얼을 마치면 가게 거리에서 살 수 있어요'); return false; }
  const sh = shopsBuilt.find((q) => q.id === id); if (!sh) { toast('이 맵에는 그 가게가 없어요'); return false; }
  const P = SHOP_POP[sh.pop]; if (P?.when && !P.when()) { const w = late.shopWhy?.(sh.id); toast(w ? `준비 중 — ${w} 열려요` : '정낭을 열면 가게 거리가 열려요'); return false; }
  return goTo({ pos: sh.door, near: sh.r * 0.8, arrive: () => openShopPop(sh.pop) }, sh.name, msg);
}
function goTo(dest, name, msg) {
  if (player.pos.distanceTo(dest.pos) < dest.near) { dest.arrive(); return true; }
  closePanels();
  if (startAutoGo(dest)) { toast(`${msg ? msg + ' · ' : ''}${name}까지 걸어가요`); return true; }
  tipMark(dest.pos); toast(`${msg ? msg + ' · ' : ''}${name}은(는) 가게 거리에 있어요`); return false;
}
// 메뉴의 상점·귤 칸: 가게 안내 (튜토리얼 집게·배낭 단계면 장비점으로)
export function shopGuide() {
  if (cam.mode === 'wardrobe' || player.pose === 'sit') return;
  if (late.tut?.active && ['tongs', 'bag'].includes(late.tut.step)) { goShop('gear'); return; }
  openShopPop('dir');
}

// ---------- 미니맵·큰 지도의 가게 아이콘 (#128, field.js drawIcons 가 부름) ----------
const iconImg = {};
for (const sh of shopsBuilt) { const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#f3ecdc" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${SHOP_ICON[sh.id] || ''}</svg>`); iconImg[sh.id] = img; }
late.shopIcons = (x, uv, s, inC) => {
  for (const sh of shopsBuilt) {
    const p = roofSigns?.signs[sh.id]?.pos || sh.door, [u, v] = uv(p.x, p.z); if (!inC(u, v)) continue;
    const r = s * 0.55, shut = late.shopOpen?.(sh.id) === false; /* 닫힌 가게는 회색 점 (#206) */
    if (shut) { x.fillStyle = '#8c9093'; x.strokeStyle = '#55595c'; x.lineWidth = Math.max(1, s / 8); x.beginPath(); x.arc(u, v, r * 0.5, 0, 7); x.fill(); x.stroke(); continue; }
    x.fillStyle = '#2f3336'; x.strokeStyle = '#ff8a1f'; x.lineWidth = Math.max(1, s / 7); x.beginPath(); x.arc(u, v, r, 0, 7); x.fill(); x.stroke();
    const img = iconImg[sh.id]; if (img?.complete && img.naturalWidth) x.drawImage(img, u - r * 0.72, v - r * 0.72, r * 1.44, r * 1.44);
    if (roofSigns?.signs[sh.id]?.dot.visible) { x.fillStyle = '#ff8a1f'; x.beginPath(); x.arc(u + r * 0.8, v - r * 0.8, r * 0.36, 0, 7); x.fill(); }
  }
};
// ---------- 옷 (#52): 칸마다 한 줄. 옷 그림·단계 색·입은 것 체크·없는 것은 값. 가진 옷은 눌러서 바로 갈아입음 ----------
export function wearCloth(slot, id) { // 겉모습만 바꿈 (#179): 능력은 가진 옷 중 가장 좋은 것 그대로
  if (id) CL.wear[slot] = id; else delete CL.wear[slot];
  syncEquipGear(); runner.apply(save.outfit); persist(); updateStats(); updateTrashUI(true); net.send(true); late.outfitSet?.check(true);
}
// 고진의 파란장화 (#167): save.equip.boots 0 없음 · 1 가짐 · 2 신음. 벗으면 가진 단계 신발 중 가장 좋은 것
export function wearBoots(on) {
  if (!save.equip.boots) return;
  save.equip.boots = on ? 2 : 1;
  syncEquipGear(); runner.apply(save.outfit); persist(); updateStats(); updateTrashUI(true); net.send(true);
}
export function buyBoots() {
  if (save.equip.boots) return false;
  if (save.coins < BOOTS.price) { toast(`귤이 ${BOOTS.price - save.coins}개 모자라요`); return false; }
  save.coins -= BOOTS.price; save.equip.boots = 1; late.sound.coin?.(); ach.emit('clothes-buy'); ach.emit('clothes-buy-shoes'); ach.emit('boots-buy');
  wearBoots(true); refreshDots();
  toast(`${BOOTS.name} · 바로 신었어요`);
  return true;
}
// 겉모습 옷 색 (#179): tint 인 옷의 색 번호 (0 = 원래 색)
export function tintCloth(id, i) { if (!CLOTH[id]?.tint || !CL.own[id]) return; if (i > 0) CL.tint[id] = i; else delete CL.tint[id]; syncEquipGear(); runner.apply(save.outfit); persist(); net.send(true); }
export function buyCloth(id) {
  const c = CLOTH[id]; if (!c || CL.own[id]) return false; const off = late.questOff?.('leap', wearPrice(c)) || 0, price = wearPrice(c) - off; // 퀘스트 할인권 (#158)
  if (save.coins < price) { toast(`귤이 ${price - save.coins}개 모자라요`); return false; }
  const from = save.coins; save.coins -= price; if (off) late.questUse('leap'); CL.own[id] = 1; late.sound.coin?.(); ach.emit('clothes-buy'); ach.emit('clothes-buy-' + c.slot); // 업적 이벤트 (#59)
  void from; wearCloth(c.slot, id); refreshDots();
  toast(off ? `${c.name} · 할인권으로 ${off}귤 아꼈어요` : `${c.name} · 바로 입었어요`);
  return true;
}
export function buildWearRows(body, lock) { // 옷장(내 가방 옷 탭 #166): 가진 옷은 눌러서 바로 갈아입음. lock(옷, 줄) 을 주면 안 가진 옷도 흐리게 (사는 것은 LEAP #128)
  const CHECK = `${SVG_A} stroke-width="3"><path d="M5 12l5 5 9-10"/></svg>`;
  WEAR.slots.forEach((w) => {
    const list = CLOTHES.filter((c) => c.slot === w.k && CL.own[c.id]).sort((a, b) => (a.tier || 99) - (b.tier || 99)), abId = abilityCloth(save, w.k);
    const row = document.createElement('div'); row.className = 'w-row wear-row';
    const cur = wearV(w.k), head = document.createElement('div'); head.className = 'wear-head';
    head.innerHTML = `<span class="wear-name">${w.name}</span><span class="wear-stat" title="능력은 가진 옷 중 가장 좋은 것 · 고르면 모양만 바뀌어요">${SVG_A}>${WEAR_STAT_ICON[w.stat]}</svg>${wearStatText(w.stat, cur)}</span>`;
    const grid = document.createElement('div'); grid.className = 'wear-grid';
    const cell = (c) => {
      const id = c?.id || '', on = c ? CL.wear[w.k] === id : !CL.wear[w.k], tier = c ? c.tier : 0;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'wear-item has' + (on ? ' on' : '') + (c ? '' : ' none'); b.dataset.id = id;
      const tag = c ? (c.style ? '겉모습' : `${tier}단계${id === abId ? ' · 능력' : ''}`) : '';
      b.style.setProperty('--tc', c?.style ? WEAR.styleColor : WEAR.tierColor[tier]); b.title = c ? `${c.name} · ${tag}` : '없음 (능력은 그대로)';
      b.setAttribute('aria-label', c ? `${c.name} ${tag}` : `${w.name} 벗기`); b.setAttribute('aria-pressed', String(on));
      b.innerHTML = clothSvg(c) + (on ? `<i class="st">${CHECK}</i>` : '') + (c && id === abId ? '<i class="abm" aria-hidden="true"></i>' : ''); // 능력을 주는 옷 표시 (#179)
      b.addEventListener('click', () => { if (!on) wearCloth(w.k, id); late.buildWardrobe(); });
      grid.append(b);
    };
    if (w.none) cell(null);
    list.forEach(cell);
    if (lock) CLOTHES.filter((c) => c.slot === w.k && !CL.own[c.id] && LEAP.slots.includes(c.slot) && (!c.season || late.season?.isOn(c.season)) && onShelf(c)).sort((a, b) => (a.tier || 99) - (b.tier || 99)).forEach((c) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'wear-item lock'; b.dataset.id = c.id; b.style.setProperty('--tc', c.style ? WEAR.styleColor : WEAR.tierColor[c.tier]);
      b.title = `${c.name} · LEAP 에서 ${wearPrice(c).toLocaleString()}귤`; b.setAttribute('aria-label', `${c.name} 잠김 · LEAP 에서 살 수 있어요`);
      b.innerHTML = clothSvg(c) + `<span class="pr"><i class="g"></i>${wearPrice(c).toLocaleString()}</span>`;
      b.addEventListener('click', () => lock(c, row)); grid.append(b);
    });
    row.append(head, grid);
    if (LOOK_COLORS.ids[w.k] && CL.wear[w.k] === LOOK_COLORS.ids[w.k]) row.append(baseColorRow(w.k)); // 기본 옷을 입고 있으면 색 바꾸기 (무료)
    else if (CLOTH[CL.wear[w.k]]?.tint) row.append(styleColorRow(CLOTH[CL.wear[w.k]])); // 겉모습 옷 색 바꾸기 (#179, 무료)
    body.append(row);
  });
}
// 기본 옷 색 바꾸기 (#155): 처음 고른 색 동그라미와 같은 것. 내 가방 옷 줄·신발 줄 아래 (무료)
export function baseColorRow(k) {
  const wrap = document.createElement('div'); wrap.className = 'bag-lc';
  wrap.append(colorDots(k, lcIndex(save.look?.colors, k), (i) => {
    save.look = save.look && typeof save.look === 'object' ? save.look : { sex: 'm', skin: 0 };
    save.look.colors = { ...(save.look.colors || {}), [k]: i };
    syncEquipGear(); runner.apply(save.outfit); persist(); net.send(true); late.buildWardrobe();
  }));
  return wrap;
}
late.baseColorRow = baseColorRow;
// 겉모습 옷 색 동그라미 (#179): 0번 = 그 옷 원래 색, 나머지는 LOOK_COLORS.style
export function styleColorRow(c) {
  const wrap = document.createElement('div'); wrap.className = 'bag-lc'; const row = document.createElement('div'); row.className = 'lc-dots'; row.setAttribute('role', 'radiogroup'); row.setAttribute('aria-label', `${c.name} 색`);
  const cur = CL.tint[c.id] | 0;
  LOOK_COLORS.style.forEach(([col, name], i) => { const b = document.createElement('button'); b.type = 'button'; b.style.background = col || c.look.main; b.title = name; b.setAttribute('aria-label', `${c.name} ${name}`); b.setAttribute('aria-pressed', String(i === cur));
    b.addEventListener('click', () => { tintCloth(c.id, i); late.buildWardrobe(); }); row.append(b); });
  wrap.append(row); return wrap;
}
