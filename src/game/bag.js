// 내 가방 (#166): 배낭 칸(#bag-pill)·B 키·메뉴에서 여는 한 창. 탭 옷·무기·도구·배낭·탈것, 가진 것은 눌러 바로 장착
// 능력 탭 (#202, 레벨이 보일 때만): 레벨·번 귤 띠·고른 증강 목록 (level.js late.augTab). 위쪽 레벨 칸을 누르면 이 탭
// 예전 옷장(#wardrobe 패널·카메라 cam.mode 'wardrobe')을 그대로 키워 씀: 창 옆(폰은 위쪽)에 내 캐릭터가 보이고 고르면 바로 바뀜
// 예전 탈것 창(#ridewin)·무기 창(#armwin)은 없앰: ride.js openRideWin·arms.js openArmWin 이 이 창의 탭을 엶
// 도구·배낭·신발은 단계를 사면 그 단계를 쓰고(save.equip), 아래 단계는 '가짐' 으로만 보임 (더 좋은 것이 늘 장착)
// 아직 없는 것은 흐린 카드 + 파는 가게와 값 + [사러 가기](goShop 길 안내 #128). 여기서 사지는 않음
import { TOOLS, BAGS, POCKET, SHOES, BOOTS, WEAPONS, HAIR, RIDES, wearPrice } from '../balance.js';
import { RIDE_ICON } from '../rides.js';
import { late } from './state.js';
import { $, save } from './save.js';
import { LEAPB, player, col, buff } from './place.js';
import { cam } from './camera.js';
import { busy, closePanels, toast } from './hud.js';
import { marker } from './input.js';
import { buildWearRows, gdBadge, scoreChip } from './shop.js';
import { toolNow, bagCap } from './pickup.js';
import { chooseArm, armSub } from './arms.js';
import { chooseRide, rideStat, WALK_ICON, toggleRide } from './ride.js';
import { gearScore, itemScore, scoreDiff } from '../gearscore.js';
import { shoeSpeed, weaponMul } from '../loot.js';
import { ic } from '../icons.js';

const TABS = [
  { k: 'wear', name: '옷', ic: ic('wear') },
  { k: 'arm', name: '무기', ic: ic('bow') },
  { k: 'tool', name: '도구', ic: ic('tongs') },
  { k: 'bag', name: '배낭', ic: ic('bag') },
  { k: 'ride', name: '탈것', ic: ic('ride') },
  { k: 'stat', name: '능력', ic: ic('star'), on: () => !!late.lvShown?.() },
];
const SVG = (inner, cls = '') => `<svg ${cls ? `class="${cls}" ` : ''}viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const CARD_SVG = (inner) => `<svg class="food" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const CHECK = SVG('<path d="M5 12l5 5 9-10"/>');
const SHOP_NAME = { gear: '장비점', leap: 'LEAP', salon: '루이네미장원', ride: '탈것 가게' };
const panel = $('wardrobe'), body = $('wardrobe-body'), tabsEl = $('bag-tabs'), footEl = $('bag-foot');
export const bagS = { tab: 'wear', open: false };
const bagRect = () => (panel.hidden ? null : panel.getBoundingClientRect()); // 카메라가 창을 피해 캐릭터를 둘 때 (update.js)
let camBefore = null;

// ---------- 열기·닫기 (예전 옷장 카메라) ----------
// 카메라는 캐릭터 앞쪽에 섬. 그 사이에 클린하우스·나무 같은 사물이 있으면 가리지 않는 쪽으로 몸을 돌림 (#90)
function clearYaw(yaw, d) {
  if (!col) return yaw;
  const free = (a) => { for (let t = 1; t <= d + 1; t += 0.5) if (col.blocked(player.pos.x + Math.sin(a) * t, player.pos.z + Math.cos(a) * t, 0.9)) return false; return true; };
  for (let k = 0; k <= 12; k++) { const a = yaw + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI / 6; if (free(a)) return a; }
  return yaw;
}
const tabOk = (k) => TABS.some((t) => t.k === k && (!t.on || t.on()));
export function openBag(tab) {
  if (tabOk(tab)) bagS.tab = tab;
  if (bagS.open) { buildBag(); return true; }
  closePanels(); // 다른 창(가게·메뉴 등)은 닫고 엶
  if (busy()) return false; // 앉기·사진·쓰러짐·캐릭터 고르기 중에는 안 열림
  player.target = null; player.onArrive = null; marker.visible = false;
  camBefore = { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist };
  player.heading = clearYaw(player.heading, innerWidth <= 600 ? 10 : 4.6);
  cam.mode = 'wardrobe'; bagS.open = true;
  $('nick-mirror').textContent = save.nick;
  buildBag(); panel.hidden = false;
  return true;
}
export function closeBag() {
  if (!bagS.open && panel.hidden) return;
  panel.hidden = true; bagS.open = false;
  if (cam.mode === 'wardrobe') { cam.mode = 'follow'; if (camBefore) Object.assign(cam, camBefore); }
}
$('wardrobe-done').addEventListener('click', closeBag);
$('wardrobe-shop').addEventListener('click', () => goBuy(tabShop(bagS.tab))); // 지금 탭의 물건을 파는 가게로
$('bag-pill').addEventListener('click', () => (bagS.open ? closeBag() : openBag()));
$('bag-pill').setAttribute('role', 'button'); $('bag-pill').tabIndex = 0;
$('bag-pill').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBag(); } });
addEventListener('keydown', (e) => { // B: 내 가방 열고 닫기 (임의)
  if (e.code !== 'KeyB' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (bagS.open) closeBag(); else openBag();
});

// ---------- 그리기 ----------
const tabShop = (k) => ({ wear: 'leap', arm: 'gear', tool: 'gear', bag: 'gear', ride: 'ride' }[k] || 'gear');
function goBuy(id, msg) { closeBag(); if (id === 'leap' && !LEAPB) id = 'gear'; late.goShop?.(id, msg); }
function buildTabs() {
  tabsEl.innerHTML = '';
  for (const t of TABS) {
    if (t.on && !t.on()) continue;
    const b = document.createElement('button'); b.type = 'button'; b.dataset.tab = t.k; b.title = t.name; b.setAttribute('aria-pressed', String(t.k === bagS.tab));
    b.innerHTML = `${SVG(t.ic)}<span>${t.name}</span>`;
    b.addEventListener('click', () => { bagS.tab = t.k; buildBag(); body.scrollTop = 0; });
    tabsEl.append(b);
  }
}
export function buildBag() {
  if (!tabOk(bagS.tab)) bagS.tab = 'wear';
  buildTabs();
  panel.dataset.tab = bagS.tab; $('bag-nick').hidden = bagS.tab !== 'wear';
  body.innerHTML = '';
  ({ wear: fillWear, arm: fillArm, tool: () => fillTier('tool'), bag: () => fillTier('bag'), ride: fillRide, stat: () => late.augTab?.(body) })[bagS.tab]();
  fillFoot();
}
// 탭이 그 내용일 때만 다시 그림 (무기·탈것이 다른 곳에서 바뀌었을 때)
export function bagRefresh(tab) { if (bagS.open && (!tab || tab === bagS.tab)) buildBag(); }

// 카드 한 장: 그림·이름·한 줄·오른쪽(장착 중/값/버튼). lock 이면 흐리게 + 파는 가게·[사러 가기]
function card({ icon, name, sub, on, own, lock, click, extra }) {
  const c = document.createElement(own && !on && click ? 'button' : 'div');
  if (c.tagName === 'BUTTON') c.type = 'button';
  c.className = 'menu-card bag-card' + (on ? ' on' : '') + (lock ? ' lock' : '') + (own && !on && !click ? ' have' : '');
  c.innerHTML = `${/^<(img|svg)\b/.test(icon) ? icon : CARD_SVG(icon)}<span class="mn"><b>${name}</b><small>${sub || ''}</small></span><span class="mv"></span>`;
  const mv = c.querySelector('.mv');
  if (on) mv.insertAdjacentHTML('beforeend', `<span class="bf">${CHECK}장착 중</span>`);
  else if (own && !click) mv.insertAdjacentHTML('beforeend', '<span class="bf dim">가짐</span>');
  if (lock) {
    mv.insertAdjacentHTML('beforeend', `<span class="where">${SHOP_NAME[lock.shop] || '가게'}에서 살 수 있어요 <span class="price"><i></i>${lock.price.toLocaleString()}</span></span>`);
    const go = document.createElement('button'); go.type = 'button'; go.className = 'chip go'; go.textContent = '사러 가기';
    go.addEventListener('click', (e) => { e.stopPropagation(); goBuy(lock.shop, `${name}은(는) ${SHOP_NAME[lock.shop] || '가게'}에서 사요`); });
    mv.append(go);
  }
  if (extra) mv.append(extra);
  if (c.tagName === 'BUTTON') c.addEventListener('click', click);
  return c;
}
const list = () => { const g = document.createElement('div'); g.className = 'menu-grid bag-grid'; g.id = 'bag-cards'; body.append(g); return g; };
const diffLine = (a, b) => (a === b ? b : `<s>${a}</s>→<em>${b}</em>`);

// 옷: 칸마다 한 줄 (모자·티·바지·베스트·잠바·양말은 shop.js buildWearRows), 그 뒤 신발·머리
function fillWear() {
  buildWearRows(body, (c, row) => lockHint(row, c.name, 'leap', wearPrice(c)));
  tierRow('shoes', '신발', SHOES, LEAPB ? 'leap' : 'gear');
  hairRow();
}
function lockHint(row, name, shop, price) { // 잠긴 옷을 누르면 그 줄 아래에 어디서 사는지
  row.querySelector('.bag-hint')?.remove();
  const h = document.createElement('div'); h.className = 'bag-hint';
  h.innerHTML = `<span><b>${name}</b> · ${SHOP_NAME[shop]}에서 살 수 있어요 <span class="price"><i></i>${price.toLocaleString()}</span></span>`;
  const go = document.createElement('button'); go.type = 'button'; go.className = 'chip go'; go.textContent = '사러 가기';
  go.addEventListener('click', () => goBuy(shop, `${name}은(는) ${SHOP_NAME[shop]}에서 사요`));
  h.append(go); row.append(h);
}
function wearRow(name, stat) {
  const row = document.createElement('div'); row.className = 'w-row wear-row';
  row.innerHTML = `<div class="wear-head"><span class="wear-name">${name}</span><span class="wear-stat">${stat}</span></div><div class="wear-grid"></div>`;
  body.append(row); return [row, row.querySelector('.wear-grid')];
}
function tierRow(k, name, L, shop) { // 신발: 산 단계까지 가짐, 가장 높은 것을 신음
  const cur = Math.max(1, save.equip[k] || 1), T = late.TIER_ART?.[k] || [], bt = save.equip.boots || 0;
  const [row, grid] = wearRow(name, `${SVG(late.STAT_ICON?.speed || '')}×${shoeSpeed(save)}`);
  L.forEach((t, i) => {
    const own = i < cur, on = bt !== 2 && i === cur - 1;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'wear-item' + (own ? ' has' : ' lock') + (on ? ' on' : '');
    b.style.setProperty('--tc', '#7b7b80'); b.title = own ? `${t.name}${on ? ' · 신는 중' : ' · 가짐'}` : `${t.name} · ${SHOP_NAME[shop]} ${t.price}귤`;
    b.innerHTML = (late.itemArt ? late.itemArt(k, i, 'art') : SVG(T[i] || '', 'art')) + (on ? `<i class="st">${CHECK}</i>` : '') + (own ? '' : `<span class="pr"><i class="g"></i>${t.price.toLocaleString()}</span>${gdBadge(scoreDiff(save, k, i + 1))}`);
    b.addEventListener('click', () => { if (!own) { lockHint(row, t.name, shop, t.price); return; } if (bt === 2) { late.wearBoots(false); buildBag(); return; } toast(on ? `${t.name} · 신는 중` : `${L[cur - 1].name}을(를) 신고 있어요 (더 좋은 신발)`); });
    grid.append(b);
  });
  { // 고진의 파란장화 (#167): 가지면 눌러서 신고 벗음
    const own = bt > 0, on = bt === 2, b = document.createElement('button'); b.type = 'button'; b.className = 'wear-item' + (own ? ' has' : ' lock') + (on ? ' on' : ''); b.dataset.boots = '1';
    b.style.setProperty('--tc', '#2f6fe0'); b.title = `${BOOTS.name} · ${BOOTS.desc}`;
    b.innerHTML = (late.itemArt ? late.itemArt('boots', 0, 'art') : SVG(late.TIER_ART?.boots?.[0] || '', 'art')) + (on ? `<i class="st">${CHECK}</i>` : '') + (own ? '' : `<span class="pr"><i class="g"></i>${BOOTS.price.toLocaleString()}</span>`);
    b.addEventListener('click', () => { if (!own) { lockHint(row, BOOTS.name, shop, BOOTS.price); return; } late.wearBoots(!on); buildBag(); });
    grid.append(b);
  }
  if (k === 'shoes' && cur === 1 && bt !== 2) row.append(late.baseColorRow('shoes')); // 쓰레빠를 신고 있으면 색 바꾸기 (#155)
}
function hairRow() { // 머리: 가진 머리는 눌러서 바꿈, 없는 것은 루이네미장원
  if (!save.look || !late.HEAD_SVG) return;
  const now = save.outfit.gear?.hair, skin = save.outfit.skin?.color;
  const [row, grid] = wearRow('머리', '');
  for (const h of HAIR.list) {
    const own = !!save.hairs?.[h.key], on = now === h.key;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'wear-item' + (own ? ' has' : ' lock') + (on ? ' on' : ''); b.dataset.hair = h.key;
    b.style.setProperty('--tc', '#7b7b80'); b.title = h.name;
    b.innerHTML = late.HEAD_SVG(h.key, skin).replace('<svg ', '<svg class="art" ') + (on ? `<i class="st">${CHECK}</i>` : '') + (own ? '' : `<span class="pr"><i class="g"></i>${h.price}</span>`);
    b.addEventListener('click', () => { if (!own) { lockHint(row, h.name, 'salon', h.price); return; } if (!on) { late.wearHair(h.key); buildBag(); } });
    grid.append(b);
  }
}
// 무기: 손 포함 가진 무기, 남은 탄·한 발 값
const ammoText = (w) => {
  if (w.id === 'hand') return '한 번에 귤 1개';
  if (w.id === 'bomb') return `한 발 귤 ${w.cost}개`;
  const left = w.id === 'bow' ? save.bowAmmo || 0 : save.ammo?.[w.id] || 0, per = w.id === 'laser' ? `귤 1개 = ${Math.round(1 / w.gyulPerSec)}초` : w.perGyul === 1 ? '한 발에 귤 1' : `귤 1개 = ${w.perGyul}발`;
  return `${per}${left > 0 ? ` · 남은 ${w.id === 'laser' ? Math.round(left / w.gyulPerSec) + '초' : Math.floor(left) + '발'}` : ''}`;
};
function fillArm() {
  const g = list(), own = save.equip.weapon || 1, use = save.weaponUse || own, nowW = WEAPONS[use - 1];
  WEAPONS.forEach((w, i) => {
    const has = i < own, on = use === i + 1;
    const sub = has ? `${armSub(w)}<br>${ammoText(w)}${on ? '' : ` · 피해 ${diffLine(nowW.dmg, w.dmg)}`}` : armSub(w);
    g.append(card({ icon: late.itemArt?.('weapon', i, 'food') || late.TIER_ART?.weapon?.[i] || '', name: w.name, sub, on, own: has, lock: has ? null : { shop: 'gear', price: w.price }, click: has ? () => { chooseArm(i + 1); buildBag(); } : null }));
  });
}
// 도구·배낭: 산 단계까지 가짐. 가장 높은 단계가 장착 (#111 순서 없이 사도 산 단계 아래는 가짐)
const TIER_K = { tool: { L: TOOLS, lo: 1, sub: (t) => `${t.rate ? `초당 ${t.rate}개` : `한 번에 ${t.per}개`} · ${t.r}m` }, bag: { L: BAGS, lo: 0, sub: (t) => `담는 양 ${t.cap}` } };
function fillTier(k) {
  const g = list(), K = TIER_K[k], cur = save.equip[k] ?? K.lo, now = k === 'bag' && !cur ? POCKET : K.L[cur - 1];
  if (k === 'bag') g.append(card({ icon: ic('pocket'), name: POCKET.name, sub: K.sub(POCKET), on: cur === 0, own: true }));
  K.L.forEach((t, i) => {
    const own = i < cur, on = i === cur - 1, art = late.itemArt?.(k, i, 'food') || late.TIER_ART?.[k]?.[i] || '';
    const sub = `${K.sub(t)}${own ? '' : ` · <span class="sc">${scoreChip(itemScore(i + 1), scoreDiff(save, k, i + 1))}</span>`}`;
    g.append(card({ icon: art, name: t.name, sub: own || on ? sub : `${K.sub(now)} → ${K.sub(t)}`, on, own, lock: own || !t.price ? null : { shop: 'gear', price: t.price } }));
  });
  if (k === 'bag') late.backLookRow?.(g, card); // 배낭 모양 (#164)
}
// 탈것: 걸어 다니기 + 가진 탈것. 고르면 그 탈것이 '부르기'(Q) 대상. [부르기]는 창을 닫고 바로 탐
function fillRide() {
  const g = list(), sel = player.ride || (save.rides.walk ? '' : save.rides.cur);
  g.append(card({ icon: WALK_ICON, name: '걸어 다니기', sub: '탈것 없이', on: !sel, own: true, click: () => { chooseRide(''); buildBag(); } }));
  for (const R of RIDES.list) {
    const own = save.rides.own.includes(R.id), on = own && sel === R.id;
    let extra = null;
    if (own && on) {
      extra = document.createElement('button'); extra.type = 'button'; extra.className = 'chip go call'; extra.textContent = player.ride ? '내리기' : '부르기';
      extra.addEventListener('click', (e) => { e.stopPropagation(); closeBag(); toggleRide(); });
    }
    g.append(card({ icon: late.rideArt?.(R.id, 'food') || RIDE_ICON[R.id], name: R.name, sub: rideStat(R), on, own, lock: own ? null : { shop: 'ride', price: R.price }, click: own ? () => { chooseRide(R.id); buildBag(); } : null, extra }));
  }
  late.deerPal?.bagCard(g, card, () => { closeBag(); }); /* 내 노루 (#247, deerpal.js) */
}
// 아래: 장비 점수와 주요 능력 4줄 (줍는 속도·배낭 용량·이동·무기 피해), 레벨·증강 한 줄 (#159, level.js late.augFoot)
function fillFoot() {
  const g = gearScore(save), t = toolNow(), w = WEAPONS[(save.weaponUse || save.equip.weapon || 1) - 1];
  const pick = `${(t.per / t.time).toFixed(1).replace(/\.0$/, '')}/초`, wd = +(w.dmg * weaponMul(save)).toFixed(1); // #140 등급·강화가 얹힌 값
  const spd = (shoeSpeed(save) * (buff.mul('speed') + (late.augSpeed?.() ?? 0))).toFixed(2).replace(/0$/, '');
  const S = late.STAT_ICON || {};
  const row = (ic, name, v) => `<span class="bs">${SVG(S[ic] || '')}<em>${name}</em><b>${v}</b></span>`;
  footEl.innerHTML = `<div class="bag-score">${scoreChip(g.total, 0)}<small>줍는 힘 ${g.pick} · 싸우는 힘 ${g.fight}</small></div>`
    + `<div class="bag-stats">${row('rate', '줍기', pick)}${row('cap', '배낭', bagCap())}${row('speed', '이동', '×' + spd)}${row('dmg', '피해', w.dps ? `${wd}/초` : wd)}</div>`
    + (late.lvShown?.() && bagS.tab !== 'stat' ? late.augFoot?.() || '' : ''); // 레벨·증강 (#159): 장비 점수와 따로 (능력 탭에선 위에 크게)
}

Object.assign(late, { openBag, closeBag, bagRefresh, bagRect, buildWardrobe: buildBag, openWardrobe: () => openBag('wear'), closeWardrobe: closeBag }); // 앞 파일에서 부르는 함수 (예전 옷장 이름도 그대로)
