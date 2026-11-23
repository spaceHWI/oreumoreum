// 레스토랑 스톤, 가게 팝업 틀, 루이네 미장원, LEAP, 버프 표시, 가장자리 가게 표시, 상호작용(F)·줍기(E) 키 (#86 에서 main.js 를 나눔. 파일 순서는 src/main.js, 규칙은 notes/prototype-v1.md 코드 구조)
import { itemScore, scoreDiff, buyGain, slotTier, bootsOn } from '../gearscore.js';
import { shoeSpeed } from '../loot.js';
import { SHOES, BOOTS, STONE, MANJOK, INN, SHOP_ST, HAIR, SALON, LEAP, WEAR, CLOTHES, wearPrice, PHOTOG, GEAR_SHOP, OUTFIT_SETS } from '../balance.js';
import { SHOP_ICON } from '../shops.js';
// 장비점·가게 안내 로고 (#128): 둥근 현무암 판에 흰 아이콘 (가게 창 위 칸)
const iconLogo = (path) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96"><circle cx="12" cy="12" r="11.5" fill="#2f3336"/><g transform="translate(4.2 4.2) scale(.65)" fill="none" stroke="#f3ecdc" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${path}</g></svg>`);
const GEAR_LOGO = iconLogo(SHOP_ICON.gear), MANJOK_LOGO = iconLogo(SHOP_ICON.manjok), INN_LOGO = iconLogo(SHOP_ICON.inn), DIR_LOGO = iconLogo(ic('map'));
import { leapLogo } from '../leap.js';
import { weeklyNow, weekLeftDays, onShelf } from '../weekly.js';
import { salonLogo } from '../salon.js';
import { FOOD_SVG, BUFF_ICON, buffText } from '../stoneicons.js';
import { mealSec } from '../buff.js';
import { STONE_LOGO } from '../stonelogo.js';
import { SHOE_GEAR } from '../gear.js';
import * as THREE from 'three';
import { groundAt } from '../world.js';
import { SKIN_TONES } from '../runner.js';
import { clothSvg, WEAR_STAT_ICON, wearStatText } from '../clothicons.js';
import { TIP_ICON } from '../tips.js';
import { state, late } from './state.js';
import { $, save, CLOTH, WSLOT, CL, wearV, persist } from './save.js';
import { spots } from './scene.js';
import { benchPos, cairns, NS_TUT, street, shopsBuilt, STN, MANJ, SAL, LEAPB, buff, chActs, shopAct, CH, runner, player, hp } from './place.js';
import { cam } from './camera.js';
import { ui, toast, tipMarkT, tipMarkPos, updateStats, panelOpen, closePanels, ach } from './hud.js';
import { keys, joy, pressBtn, marker, setTarget } from './input.js';
import { bowArmed, bowReady, armedFor, setHoldBow, fireWeapon, weaponNow, lockFar } from './throw.js';
import { RIDE_LOGO, buildRideMenu } from './ride.js';
import { dismountDeer, sitDown, standUp, openWishes, startPhoto } from './moves.js';
import { photog } from './room.js';
import { ic } from '../icons.js';

Object.assign(late, { refreshShopPop, finishMeal, finishCut, doInteract }); // 앞 파일에서 부르는 함수

// ---------- 상호작용 ----------
// ---------- 식당 (#50 레스토랑 스톤, #167 만족한상회): 메뉴판 팝업 → 귤 내고 → 자리에 앉아 먹음(건너뛰기) → 버프 ----------
// 식당 공통 틀 (#167): 가게마다 건물 api(자리 seat·seatGo·serve·setLeft, stone.js·manjok.js 같은 꼴)와 메뉴 표(cfg.menu·eatT·walkMax)만 다름
const MEAL_SHOPS = { stone: { api: STN, cfg: STONE }, manjok: { api: MANJ, cfg: MANJOK } };
export const mealS = { on: false, item: null, phase: '', t: 0, target: null, api: null, cfg: null }; late.mealS = mealS;
const stoneOpen = () => !NS_TUT || !!save.jeong; // 튜토리얼(정낭 열기 전)엔 아직 안 열림
export const skipAct = { label: '건너뛰기', ic: 'skip', act: () => finishMeal() };
const buffIc = (k, cls = '') => `<svg ${cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${BUFF_ICON[k]}</svg>`;
// 가게 팝업 (#57): 가게마다 같은 틀 #shoppop (위 로고·이름·표어, 아래 카드). head = 위 칸, fill(grid) = 카드 채우기, when = 열 수 있는 때
const SHOP_POP = {
  stone: { head: { logo: STONE_LOGO, name: 'Stone', tag: 'Maximize all the Pleasure', serif: true }, fill: (grid) => buildMealMenu(grid, 'stone'), when: stoneOpen, can: () => !!STN && !mealS.on },
  manjok: { head: { logo: MANJOK_LOGO, name: MANJOK.name, tag: MANJOK.tag }, fill: (grid) => buildMealMenu(grid, 'manjok'), when: stoneOpen, can: () => !!MANJ && !mealS.on && !cutS.on }, // #167
  salon: { head: { logo: salonLogo(), name: '루이네 미장원', wide: true }, fill: (grid) => buildSalonMenu(grid), when: stoneOpen, can: () => !!SAL && !!save.look && !cutS.on && !mealS.on },
  inn: { head: { logo: INN_LOGO, name: INN.name, tag: INN.tag, cls: 'inn' }, fill: (grid) => late.fillInn?.(grid), when: stoneOpen, can: () => !mealS.on && !cutS.on && !late.innBusy?.() }, // #270 숙소 (game/inn.js 가 채움)
  ride: { head: { logo: RIDE_LOGO, name: '탈것 가게' }, fill: (grid) => buildRideMenu(grid), when: stoneOpen, can: () => !mealS.on && !cutS.on }, // #69
  leap: { head: { logo: leapLogo(), name: 'LEAP', wide: true, cls: 'leap' }, tabs: (el) => buildLeapTabs(el), fill: (grid) => buildLeapCards(grid), onOpen: () => startLeap(), when: stoneOpen, can: () => !!LEAPB && !cutS.on && !mealS.on },
  // 장비점 (#128): 도구·배낭·무기 (game/shop.js 가 채움). #221 튜토리얼 집게·배낭 단계부터 가게 거리 장비점이 먼저 열림 (shopgate 가 셔터를 올림)
  gear: { head: { logo: GEAR_LOGO, name: GEAR_SHOP.name, tag: '집게 · 배낭 · 무기', cls: 'gearshop' }, tabs: (el) => late.gearTabs(el), fill: (grid) => late.fillGearShop(grid), when: () => stoneOpen() || !!late.tut?.active, can: () => !mealS.on && !cutS.on },
  // 가게 안내 (#128): 무엇을 어디서 사는지 (메뉴의 상점·귤 칸·가게 거리 안내도)
  dir: { head: { logo: DIR_LOGO, name: '가게 안내', tag: '무엇을 어디서 사나요', cls: 'dir' }, fill: (grid) => late.fillShopDir(grid), can: () => !mealS.on && !cutS.on },
};
// 가게를 퀘스트 순서대로 열기 (#206, game/shopgate.js): 닫힌 가게는 상호작용·가장자리 표시·가게 안내에서 빠짐
for (const [k, P] of Object.entries(SHOP_POP)) if (P.when) { const w = P.when; P.when = () => w() && late.shopOpen?.(k) !== false; }
export { SHOP_POP };
export let shopPopNow = null;
export function openShopPop(key) {
  const P = SHOP_POP[key]; if (!P || (P.can && !P.can())) return;
  if (late.shopOpen?.(key) === false) { toast(late.tut?.active ? '준비 중 — 튜토리얼을 마치면 열려요' : `준비 중 — ${late.shopWhy(key)} 열려요`); return; } /* 닫힌 가게 (#206). #221 튜토리얼 좌판 없음 */
  closePanels(); shopPopNow = key;
  const h = P.head, root = $('shoppop');
  $('shoppop-logo').src = h.logo || ''; $('shoppop-logo').alt = h.name; $('shoppop-logo').parentElement.hidden = !h.logo;
  $('shoppop-name').textContent = h.name; $('shoppop-tag').textContent = h.tag || ''; root.classList.toggle('serif', !!h.serif); root.classList.toggle('wide', !!h.wide); root.querySelector('.pop').setAttribute('aria-label', h.name);
  for (const c of ['leap', 'gearshop', 'dir', 'tok', 'inn']) root.classList.toggle(c, h.cls === c); /* tok: 징표 좌판 (#255) */
  P.onOpen?.(); refreshShopPop(); root.hidden = false; late.shopOpened?.(key); // 살 수 있는 새 물건 점 지우기 (#128)
}
export function refreshShopPop() { const P = SHOP_POP[shopPopNow]; if (!P) return; $('shoppop-coins').textContent = String(save.coins); const tabs = $('shoppop-tabs'); tabs.hidden = !P.tabs; tabs.innerHTML = ''; if (P.tabs) P.tabs(tabs); const grid = $('shoppop-cards'); grid.innerHTML = ''; grid.className = 'menu-grid'; grid.style.removeProperty('--n'); P.fill(grid); }
const shopActs = shopsBuilt.map((sh) => ({ shop: sh.id, ic: sh.ic, label: sh.act, pos: sh.door, r: sh.r, when: SHOP_POP[sh.pop]?.when, act: () => openShopPop(sh.pop) }));
const dirAct = street?.boardFront && { ic: 'dir', label: '가게 안내', pos: street.boardFront, r: SHOP_ST.dirR, act: () => openShopPop('dir') }; // 가게 거리 들머리 안내도 (#128)
late.openShopPop = openShopPop;
export function openStone() { openShopPop('stone'); }
function buildMealMenu(grid, shop) {
  const cur = buff.now(), { cfg } = MEAL_SHOPS[shop];
  for (const m of cfg.menu) {
    if (m.season && !late.season?.isOn(m.season)) continue; // 철 한정 메뉴 (#180)
    const b = document.createElement('button'); b.type = 'button'; b.className = 'menu-card'; b.dataset.id = m.id;
    const min = Math.round((m.sec || cfg.buffSec) / 60);
    b.classList.toggle('poor', !!save.mealFree && save.coins < m.price); b.classList.toggle('on', !!cur && cur.item.id === m.id);
    b.title = `${m.ko} · ${m.en}`;
    b.innerHTML = `<svg class="food" viewBox="0 0 64 64" aria-hidden="true">${FOOD_SVG[m.id]}</svg><span class="mn"><b>${m.ko}</b><small>${m.en}</small></span>`
      + `<span class="mv">${save.mealFree ? `<span class="price"><i></i>${m.price}</span>` : '<span class="price free">첫 식사 무료</span>'}<span class="bf">${buffIc(m.buff)}${buffText(m)}<em>${min}′</em></span></span>`;
    b.addEventListener('click', () => orderMeal(m, shop));
    grid.appendChild(b);
  }
}
export function orderMeal(m, shop = 'stone') {
  const S = MEAL_SHOPS[shop]; if (!m || !S?.api || mealS.on) return;
  if (!save.mealFree) { save.mealFree = 1; persist(); toast('첫 식사는 무료예요'); } // #93: 첫 한 번은 귤을 받지 않음 (서버 확인은 validate.js)
  else if (m.drink && late.questUse?.('ade')) toast(`${m.ko} · 셰프가 한 잔 샀어요`); // 퀘스트 에이드 한 잔 (#158)
  else if (shop === 'manjok' && m.id === 'godeungeo' && late.questUse?.('satis')) toast(`${m.ko} · 사장님이 한 번 샀어요`); /* 퀘스트 고등어구이 한 번 (#279, m-eat 보상) */
  else { if (save.coins < m.price) { toast(`귤이 ${m.price - save.coins}개 모자라요`); return; } save.coins -= m.price; persist(); updateStats(); late.sound.coin?.(); }
  closePanels(); late.stopAutoGo(); setHoldBow(false); if (state.fishing?.active) state.fishing.stop();
  Object.assign(mealS, { on: true, item: m, phase: 'walk', t: 0, api: S.api, cfg: S.cfg, shop });
  setTarget(S.api.seatGo, () => sitMeal()); mealS.target = player.target;
}
function sitMeal() {
  mealS.phase = 'eat'; mealS.t = 0;
  player.target = null; player.onArrive = null; marker.visible = false;
  const A = mealS.api; player.pos.copy(A.seat); player.heading = A.seatHeading; player.speed = 0;
  player.pose = 'sit'; player.poseT = 0; A.serve(mealS.item);
}
export function finishMeal() {
  if (!mealS.on) return;
  const m = mealS.item, A = mealS.api; mealS.on = false; mealS.item = null; A.serve(null);
  if (player.pose === 'sit') { player.pose = 'move'; player.pos.copy(A.seatGo); player.pos.y = groundAt(player.pos.x, player.pos.z); }
  if (player.target === mealS.target && player.onArrive) { player.target = null; player.onArrive = null; }
  buff.give(m); updateBuffUI(true);
  ach.emit('meal'); ach.emit('meal-' + m.id); if (mealS.shop !== 'stone') ach.emit('meal-' + mealS.shop); // 식사는 두 식당 모두 셈 (#167)
  late.npcAte?.(mealS.shop); /* 식사 뒤 주인 말 (#279) */
  toast(`${m.ko} · ${bIconText(m)}`);
}
const BUFF_WORD = { speed: '이동 속도', bag: '배낭 용량', dmg: '귤 피해', pick: '줍는 속도', regen: 'HP 회복', guard: '받는 피해', gyulR: '귤 모으는 범위' };
const bIconText = (m) => `${BUFF_WORD[m.buff]} ${buffText(m)} ${Math.round(mealSec(m) / 60)}분`;
export function tickMeal(dt) {
  if (!mealS.on) return;
  mealS.t += dt;
  if (mealS.phase === 'walk') {
    if (player.target !== mealS.target) { finishMeal(); return; } // 움직여서 그만두면 바로 버프
    if (mealS.t > mealS.cfg.walkMax) sitMeal();
    return;
  }
  mealS.api.setLeft(1 - mealS.t / mealS.cfg.eatT);
  const moveKey = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].some((k) => keys.has(k));
  if (mealS.t >= mealS.cfg.eatT || (mealS.t > 0.4 && (moveKey || joy.active))) finishMeal();
}
// ---------- 루이네 미장원 (#58): 머리 카드 → 귤 내고 → 문 앞까지 걸어가 의자에 앉음 → 가위질 3초(건너뛰기) → 머리가 바뀜 ----------
// 머리 종류는 balance.js HAIR.list. 가진 머리로 바꾸는 것은 무료. 머리는 능력치 없음, 모자와 같이 씀(#52 다른 칸)
export const cutS = { on: false, hair: null, phase: '', t: 0, target: null }; late.cutS = cutS;
export const cutSkipAct = { label: '건너뛰기', ic: 'skip', act: () => finishCut() };
function buildSalonMenu(grid) {
  const skin = SKIN_TONES[save.look?.skin] || SKIN_TONES[0], cur = save.outfit.gear?.hair;
  for (const h of HAIR.list) {
    const has = !!save.hairs[h.key], on = cur === h.key, price = has ? 0 : h.price;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'menu-card hair-card'; b.dataset.id = h.id;
    b.classList.toggle('poor', save.coins < price); b.classList.toggle('on', on); b.title = h.name;
    b.setAttribute('aria-label', `${h.name} · ${on ? '지금 머리' : has ? '가진 머리 무료' : `귤 ${price}`}`);
    b.innerHTML = `<span class="food">${late.HEAD_SVG(h.key, skin)}</span><span class="mn"><b>${h.name}</b></span>`
      + `<span class="mv">${on ? `<span class="have">${late.SVG_A} stroke-width="3"><path d="M5 12l5 5 9-10"/></svg></span>` : `<span class="price"><i></i>${price}</span>`}</span>`;
    b.addEventListener('click', () => orderCut(h.key));
    grid.appendChild(b);
  }
}
export function orderCut(key) {
  const h = HAIR.byKey[key]; if (!SAL || !h || !save.look || cutS.on || mealS.on) return false;
  if (save.outfit.gear?.hair === key) { toast(`지금 ${h.name}예요`); return false; }
  const has = !!save.hairs[key], off = has ? 0 : late.questOff?.('salon', h.price) || 0, pay = h.price - off; // 퀘스트 할인권 (#158): 반값
  if (!has && save.coins < pay) { toast(`귤이 ${pay - save.coins}개 모자라요`); return false; }
  if (!has) {
    save.coins -= pay; if (off) { late.questUse('salon'); toast(`할인권으로 ${off}귤 아꼈어요`); } save.hairs[key] = 1; persist(); updateStats(); late.sound.coin?.();
  }
  closePanels(); late.stopAutoGo(); setHoldBow(false); if (state.fishing?.active) state.fishing.stop();
  Object.assign(cutS, { on: true, hair: key, phase: 'walk', t: 0 });
  setTarget(SAL.door, () => sitCut()); cutS.target = player.target;
  return true;
}
export function sitCut() {
  if (!cutS.on) return;
  cutS.phase = 'cut'; cutS.t = 0;
  player.target = null; player.onArrive = null; marker.visible = false;
  player.pos.copy(SAL.seat); player.heading = SAL.seatHeading; player.speed = 0;
  player.pose = 'sit'; player.poseT = 0; cam.yaw = player.heading + Math.PI; SAL.inside(true);
  SAL.cut.start(new THREE.Vector3(SAL.seat.x, SAL.seat.y + 1.32, SAL.seat.z));
}
export function finishCut() {
  if (!cutS.on) return;
  const key = cutS.hair, h = HAIR.byKey[key]; cutS.on = false; cutS.hair = null;
  SAL.cut.stop(); SAL.inside(false);
  if (player.pose === 'sit') { player.pose = 'move'; player.pos.copy(SAL.door); player.pos.y = groundAt(SAL.door.x, SAL.door.z); player.heading = SAL.seatHeading + Math.PI; }
  if (player.target === cutS.target && player.onArrive) { player.target = null; player.onArrive = null; }
  late.wearHair(key); late.sound.coin?.();
  ach.emit('haircut'); ach.emit('haircut-' + h.id);
  toast(`${h.name} · 잘 어울려요`);
}
export function tickCut(dt) {
  if (!cutS.on) return;
  cutS.t += dt;
  if (cutS.phase === 'walk') {
    if (player.target !== cutS.target) { finishCut(); return; } // 움직여서 그만두면 바로 바뀜
    if (cutS.t > SALON.walkMax) sitCut();
    return;
  }
  if (SAL.cut.update(dt)) late.sound.snip?.();
  const moveKey = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].some((k) => keys.has(k));
  if (cutS.t >= SALON.cutT || (cutS.t > 0.4 && (moveKey || joy.active))) finishCut();
}
// ---------- LEAP (#59): 위 칸 고르기(신발·모자·티셔츠·바지·베스트·잠바·양말) → 옷 카드(그림·단계 색·능력치 지금→바뀔 값·값) ----------
// 안 가진 카드를 누르면 내 캐릭터가 입어 본 모습(cam 'leap' 이 앞에서 비춤) + 아래 사기 버튼. 가진 옷은 눌러서 바로 갈아입음
// 옷은 #52 WEAR·CLOTHES 표, 신발은 SHOES 표(순서 없이 사고 #111, 산 것 중 가장 좋은 것을 신음). 업적 이벤트 clothes-buy, clothes-buy-<칸>
export const leapS = { on: false, slot: LEAP.slots[0], pick: null, cam: null, tried: false };
const LEAP_CHECK = `<span class="have">${'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"'} stroke-width="3"><path d="M5 12l5 5 9-10"/></svg></span>`;
const leapSlotName = (k) => k === 'shoes' ? '신발' : k === 'new' ? '새 옷' : k === 'week' ? '이번 주' : WSLOT[k].name;
const SET_NAME = Object.fromEntries(OUTFIT_SETS.map((t) => [t.id, t.name]));
// 옷 카드 한 장 (#179): 능력 옷은 사면 오를 때만 바뀔 값, 겉모습 옷(style)은 '겉모습' 과 한 벌 맞춤 이름
const clothItem = (c, k) => { const w = WSLOT[k], now = wearV(k), up = c.tier > slotTier(save, k);
  return { id: c.id, cloth: c, slot: k, tier: c.tier, name: c.name, price: wearPrice(c), own: !!CL.own[c.id], on: CL.wear[k] === c.id, art: clothSvg(c), now, v: c.style ? now : up ? w.v[c.tier] : now, stat: c.style ? 'style' : w.stat, set: c.set }; };
const tierSort = (a, b) => (a.tier || 99) - (b.tier || 99);
export function leapItems(k) {
  if (k === 'shoes') {
    const n = Math.max(1, save.equip.shoes || 1), now = shoeSpeed(save), bt = save.equip.boots || 0, art = (p) => `${late.SVG_A.replace('<svg', '<svg class="art"')}>${p}</svg>`;
    return [...SHOES.map((t, i) => ({ id: 'shoes:' + (i + 1), shoes: i + 1, tier: i + 1, name: t.name, price: t.price, own: i < n, on: bt !== 2 && i === n - 1,
      art: late.itemArt ? late.itemArt('shoes', i, 'art') : art(late.TIER_ART.shoes[i]), now, v: t.speed, stat: 'speed' })),
    // 특별 신발 (#167): 단계 줄 밖. 가지면 눌러서 신고 벗음
    { id: 'shoes:boots', boots: true, tier: BOOTS.tier, name: BOOTS.name, desc: BOOTS.desc, price: BOOTS.price, own: bt > 0, on: bt === 2, art: late.itemArt ? late.itemArt('boots', 0, 'art') : art(late.TIER_ART.boots[0]), now, v: BOOTS.speed, stat: 'speed' }];
  }
  if (k === 'new') return CLOTHES.filter((c) => c.fresh && !CL.own[c.id]).map((c) => clothItem(c, c.slot)); // 새로 들어온 겉모습 옷 (#179): 아직 안 가진 것
  if (k === 'week') return weeklyNow().map((c) => clothItem(c, c.slot)); // 주간 옷장 (#126): 이번 주 한정 옷 (가진 것도 보여 눌러서 입음)
  const w = WSLOT[k], now = wearV(k), out = [];
  if (w.none) out.push({ id: '', slot: k, tier: 0, name: '없음', price: 0, own: true, on: !CL.wear[k], art: clothSvg(null), now, v: now, stat: 'style' });
  CLOTHES.filter((c) => c.slot === k && (CL.own[c.id] || ((!c.season || late.season?.isOn(c.season)) && onShelf(c)))).sort(tierSort).forEach((c) => out.push(clothItem(c, k)));
  return out;
}
const leapStatText = (stat, v) => stat === 'speed' ? `×${String(v.toFixed(2)).replace(/0$/, '')}` : wearStatText(stat, v);
const STYLE_IC = '<path d="M9 4l3 2 3-2 5 3-2 5-2-1v9H8v-9l-2 1-2-5z"/>'; // 겉모습 옷 (#179)
const WEEK_IC = '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/><path d="M12 13.2l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2-1.45-1.4 2-.3z"/>'; // 이번 주 (#126): 달력 + 별
const leapStat = (it) => it.stat === 'style' ? `${late.SVG_A}>${STYLE_IC}</svg>겉모습${it.set ? ` · ${SET_NAME[it.set]} 한 벌` : ''}` : `${late.SVG_A}>${it.stat === 'speed' ? late.STAT_ICON.speed : WEAR_STAT_ICON[it.stat]}</svg>` + (it.v !== it.now ? `<s>${leapStatText(it.stat, it.now)}</s>→<em>${leapStatText(it.stat, it.v)}</em>` : leapStatText(it.stat, it.v));
function buildLeapTabs(el) {
  el.classList.add('shop-tabs');
  for (const k of ['week', ...LEAP.slots, ...(CLOTHES.some((c) => c.fresh && !CL.own[c.id]) ? ['new'] : [])]) { // 맨 앞 '이번 주' 탭 (#126): 남은 날 수 동그라미 // 맨 끝 '새 옷' 탭 (#179): 새로 들어온 겉모습 옷
    const b = document.createElement('button'); b.type = 'button'; b.dataset.slot = k; b.title = leapSlotName(k); b.setAttribute('aria-pressed', String(k === leapS.slot));
    if (k === 'new') b.classList.add('new');
    if (k === 'week') { b.classList.add('week'); b.title = `이번 주 한정 · ${weekLeftDays()}일 남음`; }
    const ic = k === 'week' ? `${late.SVG_A}>${WEEK_IC}</svg><i class="wk-d" aria-hidden="true">${weekLeftDays()}</i>` : k === 'new' ? `${late.SVG_A}>${STYLE_IC}</svg>` : k === 'shoes' ? `${late.SVG_A}>${bootsOn(save) ? late.TIER_ART.boots[0] : late.TIER_ART.shoes[Math.max(1, save.equip.shoes || 1) - 1]}</svg>` : clothSvg(CLOTH[CL.wear[k]] || CLOTHES.find((c) => c.slot === k && c.tier === 1), 'tab-art');
    b.innerHTML = `${ic}<span>${leapSlotName(k)}</span>`;
    b.addEventListener('click', () => { leapS.slot = k; leapS.pick = null; leapTryOn(null); refreshShopPop(); });
    el.append(b);
  }
}
const leapGd = (it) => it.stat === 'speed' ? scoreDiff(save, 'shoes', it.tier) : it.own || !it.cloth ? 0 : buyGain(save, it.slot, it.cloth); // 옷은 사면 오르는 만큼만 (#179: 능력은 가진 것 중 최고)
function buildLeapCards(grid) {
  if (leapS.slot === 'new' && !CLOTHES.some((c) => c.fresh && !CL.own[c.id])) leapS.slot = LEAP.slots[1];
  const items = leapItems(leapS.slot);
  if (leapS.slot === 'week') { const h = document.createElement('div'); h.className = 'leap-week'; h.innerHTML = `${late.SVG_A}>${WEEK_IC}</svg><b>이번 주 한정</b><span>${weekLeftDays()}일 남음 · 월요일에 바뀌어요</span>`; grid.append(h); }
  for (const it of items) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'menu-card leap-card'; b.dataset.id = it.id;
    b.style.setProperty('--tc', it.cloth?.style ? WEAR.styleColor : WEAR.tierColor[it.tier]);
    b.classList.toggle('on', it.on); b.classList.toggle('sel', leapS.pick === it.id); b.classList.toggle('poor', !it.own && save.coins < it.price);
    b.title = it.desc ? `${it.name} · ${it.desc}` : it.name; b.setAttribute('aria-pressed', String(leapS.pick === it.id || it.on));
    b.setAttribute('aria-label', `${it.name}${it.tier ? ` ${it.tier}단계` : ''} · ${it.on ? '입고 있음' : it.own ? '가진 옷' : `귤 ${it.price}`}`);
    const gd = it.on || (it.stat === 'speed' && it.own && !it.boots) ? '' : late.gdBadge(leapGd(it)); // 장비 점수 ▲/▼ (#137). 신발은 산 것 중 가장 좋은 것을 신어 아래 단계는 없음
    b.innerHTML = `<span class="food">${it.art}${it.tier || it.cloth?.style ? '<i class="tc"></i>' : ''}${gd}</span><span class="mn"><b>${it.name}</b><small class="st">${leapStat(it)}</small></span>`
      + `<span class="mv">${it.on ? LEAP_CHECK : it.own ? '' : `<span class="price"><i></i>${it.price.toLocaleString()}</span>`}</span>`;
    b.addEventListener('click', () => pickLeap(it));
    grid.append(b);
  }
  const it = items.find((i) => i.id === leapS.pick && !i.own);
  if (!it) return;
  const bar = document.createElement('div'); bar.className = 'leap-buy';
  bar.innerHTML = `<div><b><i class="tdot" style="background:${it.cloth?.style ? WEAR.styleColor : WEAR.tierColor[it.tier]}"></i>${it.name}</b>${it.desc ? `<small class="desc">${it.desc}</small>` : ''}<span class="tier-stats"><span>${leapStat(it)}</span>${it.cloth?.style ? (it.cloth.desc ? `<small class="desc">${it.cloth.desc}</small>` : '') : late.scoreChip(itemScore(it.tier), leapGd(it))}</span></div>`;
  const bb = document.createElement('button'); bb.type = 'button'; bb.className = 'tier-buy' + (save.coins < it.price ? ' short' : '');
  { bb.innerHTML = save.coins < it.price ? `${(it.price - save.coins).toLocaleString()}귤 더 필요` : `<i class="g"></i>${it.price.toLocaleString()} 사기`; bb.setAttribute('aria-label', `${it.name} 사기`); bb.addEventListener('click', () => buyLeap(it)); } // #128 모자라면 버튼 자리에 '○○귤 더 필요'
  bar.append(bb); grid.append(bar);
}
// 입어 보기: 고른 옷(또는 신발)만 바꾼 차림을 캐릭터에 입힘 (저장은 안 함). null 이면 지금 차림으로 되돌림
export function leapTryOn(it) {
  if (!it) { if (leapS.tried) { runner.apply(save.outfit); leapS.tried = false; } return; }
  const sl = it.slot || leapS.slot, gear = { ...save.outfit.gear, [sl]: it.boots ? 'shoes:boots' : it.shoes ? SHOE_GEAR[it.shoes - 1] : it.id || `${sl}:none` };
  runner.apply({ ...save.outfit, gear }); leapS.tried = true;
}
export function pickLeap(it) {
  if (it.own) {
    leapS.pick = null; leapTryOn(null);
    if (it.boots) { if (!it.on) { late.wearBoots(true); late.sound.coin?.(); } }
    else if (it.shoes) { if (bootsOn(save)) { late.wearBoots(false); toast('장화를 벗었어요'); } else if (!it.on) toast('지금 더 좋은 신발을 신고 있어요'); }
    else if (!it.on) { late.wearCloth(it.slot || leapS.slot, it.id || null); late.sound.coin?.(); }
  } else {
    leapS.pick = leapS.pick === it.id ? null : it.id;
    leapTryOn(leapS.pick ? it : null);
  }
  refreshShopPop();
}
export function buyLeap(it) {
  if (!it || it.own) return false;
  if (save.coins < it.price) { toast(`귤이 ${it.price - save.coins}개 모자라요`); return false; }
  const from = save.coins;
  leapS.tried = false; // 사면 바로 그 차림이 됨
  if (it.boots) { if (!late.buyBoots()) return false; }
  else if (it.shoes) {
    const before = save.equip.shoes; late.buyGear('shoes', it.shoes - 1); if (save.equip.shoes === before) return false;
    ach.emit('clothes-buy'); ach.emit('clothes-buy-shoes');
  } else if (!late.buyCloth(it.id)) return false;
  leapS.pick = null; refreshShopPop();
  const cell = document.querySelector(`#shoppop-cards .leap-card[data-id="${it.id}"]`);
  if (cell) { cell.classList.add('tier-pop'); late.spendFx(cell, it.price, from, document.querySelector('#shoppop .coins-pill'), $('shoppop-coins')); }
  return true;
}
function startLeap() {
  leapS.pick = null; leapS.tried = false;
  if (!leapS.on) leapS.cam = { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist };
  leapS.on = true;
  late.stopAutoGo(); player.target = null; player.onArrive = null; marker.visible = false; player.speed = 0;
  player.heading = LEAPB.face; cam.mode = 'leap'; // 골목 쪽을 보고 서서, 카메라가 앞에서 비춤
}
function endLeap() {
  leapS.on = false; leapS.pick = null; leapTryOn(null);
  if (cam.mode === 'leap') { cam.mode = 'follow'; if (leapS.cam) Object.assign(cam, leapS.cam); }
  leapS.cam = null;
}
export function tickLeap() { if (leapS.on && ($('shoppop').hidden || shopPopNow !== 'leap')) endLeap(); }
// 버프 표시: 아이콘 + 남은 시간 고리
const buffPill = $('buff-pill'); let buffKey = '';
export function updateBuffUI(force) {
  const n = buff.now();
  if (!n) { if (!buffPill.hidden) buffPill.hidden = true; buffKey = ''; return; }
  const sec = Math.ceil(n.left), txt = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`, key = n.item.id + txt;
  if (key === buffKey && !force) return; buffKey = key;
  buffPill.hidden = false; buffPill.title = `${n.item.ko} · ${bIconText(n.item)}`;
  const ic = buffPill.querySelector('svg.ic'); if (ic.dataset.k !== n.item.buff) { ic.dataset.k = n.item.buff; ic.innerHTML = BUFF_ICON[n.item.buff]; }
  buffPill.querySelector('.fg').style.strokeDashoffset = String(75.4 * (1 - n.left / n.total));
  buffPill.querySelector('b').textContent = txt; buffPill.classList.toggle('end', n.left < 30);
}
// 가장자리 포크·나이프: 레스토랑이 화면 밖이거나 조금 멀 때
// 가장자리 가게 아이콘 (#57): 가게마다 아이콘 하나, 가장 가까운 (열 수 있는) 가게만. 화면 밖이거나 조금 멀 때
export const shopMark = $('shop-mark'); export let shopMarkId = '';
export function tickShopMark() {
  if (tipMarkT > 0 && tipMarkPos) { shopMarkId = '*tip'; shopMark.querySelector('svg').innerHTML = TIP_ICON.arrow; shopMark.hidden = false; late.placeArrow(shopMark, tipMarkPos, 0.6); return; }
  let best = null, bd = 1e9;
  for (const sh of shopsBuilt) { const w = SHOP_POP[sh.pop]?.when; if (w && !w()) continue; const d = Math.hypot(player.pos.x - sh.door.x, player.pos.z - sh.door.z); if (d < bd) { bd = d; best = sh; } }
  const on = !!best && bd > SHOP_ST.markNear && bd < SHOP_ST.markFar && !late.guideBusy?.() && (!late.pace || late.pace.canMark()) && !late.tut?.active && !panelOpen() && cam.mode !== 'wardrobe' && !mealS.on && !cutS.on;
  if (!on) { if (!shopMark.hidden) shopMark.hidden = true; return; }
  if (shopMarkId !== best.id) { shopMarkId = best.id; shopMark.querySelector('svg').innerHTML = SHOP_ICON[best.id] || ''; shopMark.title = best.name; }
  shopMark.hidden = false; late.placeArrow(shopMark, best.signPos, 0.6);
}
export const interactables = [
  ...(photog ? [{ label: '사진', ic: 'photo', pos: photog.pos, r: PHOTOG.r, act: startPhoto }] : []), // 사진사 (#70)
  { label: '앉아 쉬기', ic: 'sit', pos: benchPos, r: 8, act: sitDown },
  ...(spots.sign.silent ? [] : [{ label: '안내 읽기', ic: 'sign', pos: spots.sign.pos, r: 6, act: () => late.openSign() }]),
  ...cairns.map((c) => ({ cairn: c, pos: c.pos, r: 7, act: () => openWishes(c) })),
  ...chActs, ...(shopAct ? [shopAct] : []),
  ...(CH ? [{ label: '랭킹', ic: 'rank', pos: CH.boardFront, r: 2.6, act: () => late.openRank?.() }] : []), // 랭킹 게시판 (#11)
  ...shopActs, ...(dirAct ? [dirAct] : []),
];
state.ctxTarget = null, state.deerAct = null;
state.fishing = null; // 낚시 (#44) — 아래 튜토리얼 만든 뒤에 만듦
export const fishAct = { get label() { return state.fishing.label; }, get ic() { return state.fishing.ic; }, act: () => state.fishing.press() };
export const dismountAct = { label: '노루에서 내리기', ic: 'down', act: () => dismountDeer() };
export const standAct = { label: '일어나기', ic: 'stand', act: () => standUp() };
// 상호작용 (F·상호작용 버튼): 가까이 할 일이 있으면 그것, 없으면 귤 던지기 (#34)
const ARM_VERB = { bow: '귤 활 쏘기', gun: '귤 총 쏘기', mg: '머신건 쏘기', laser: '레이저 쏘기', bomb: '폭탄 던지기' }; // #123
export const throwAct = { get label() { return this.empty ? '귤이 없어요' : lockFar() ? '멀어요' : bowArmed() ? ARM_VERB[weaponNow().id] || '귤 던지기' : '귤 던지기'; }, get empty() { return bowReady() && !armedFor(weaponNow()); }, get ic() { return bowArmed() ? weaponNow().id : 'throw'; }, act: () => { late.approachPress?.(); late.pressFire ? late.pressFire() : fireWeapon(); } }; /* 다가가서 쏘기 (#132, game/approach.js): 멀거나 이어 갈 적이 있으면 그 상태를 켬 // 길게 누르면 모아 쏘기 (#129, game/charge.js) */
late.throwAct = throwAct; // #148 귤이 없으면 회색(누르면 손으로), 타겟이 사거리 밖이면 '멀어요'
function doInteract() { if (state.ctxTarget && !hp.isDown && !hp.pending) state.ctxTarget.act(); }
pressBtn(ui.ctx, () => doInteract());
// 줍기 (E·줍기 버튼): 누르고 있는 동안 계속
export const pickBtn = $('btn-pick');
pickBtn.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button) return; e.preventDefault(); late.pickS.held = true; try { pickBtn.setPointerCapture(e.pointerId); } catch (_) { /* 무시 */ } late.pressPick(); });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => pickBtn.addEventListener(ev, () => { late.pickS.held = false; }));
pickBtn.addEventListener('click', (e) => { if (e.detail === 0) late.pressPick(); }); // 키보드로 누른 경우
pickBtn.addEventListener('contextmenu', (e) => e.preventDefault());
