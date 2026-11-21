// 튜토리얼·낚시 연결, 개발용 라벨, 성능 단계 메뉴, window.__oreum (#86 에서 main.js 를 나눔. 파일 순서는 src/main.js, 규칙은 notes/prototype-v1.md 코드 구조)
import { gearScore, gyulPickR, abilityCloth } from '../gearscore.js';
import { DEX_LIST } from '../trash.js';
import { assetInfo } from '../assets.js';
import * as crash from '../crash.js';
import { CART, PERF, TOOLS, BAGS, SHOES, FISH, STONE, MANJOK, HAIR, WEAR, WEATHER } from '../balance.js';
import { TIER, PERF_AUTO, autoTier } from '../quality.js';
import { RIDE_BY, rideSpeed, cartState as cartStateAt } from '../rides.js';
import { STREET } from '../streetlayout.js';
import { createFishing } from '../fishing.js';
import { createDevLabels } from '../devlabels.js';
import * as THREE from 'three';
import { height, groundAt, trail } from '../world.js';
import { LOW } from '../gfx2.js';
import { createTutorial } from '../tutorial.js';
import { buildRunner, SKIN_TONES } from '../runner.js';
import { TOOL_GEAR, BAG_GEAR, SHOE_GEAR, ACCESSORIES } from '../gear.js';
import { CLOTHES, OUTFIT_SETS } from '../balance.js';
import * as NSB from '../nsbound.js';
import { isBattle, serverId } from '../server.js';
import { ONLINE, mountLogin } from '../online.js';
import { state, late } from './state.js';
import { $, isTouch, save, CLOTH, CL, wearRefund, wearV, syncEquipGear, lookS, ab, persist, MAP_ID } from './save.js';
import { renderer, quality, retro, scene, NSW, camera, sun, applyQuality, wx, grass, motes, prints, spots, sunState, applySky, lamps, prepShaders, lampAim } from './scene.js';
import { P, photoSpot, benchPos, life, cairns, fillCairn, col, wall, NS_TUT, stream, jeong, openJeong, street, shopsBuilt, roofSigns, STN, MANJ, SAL, LEAPB, buff, trash, CH, CH_MINI, CHS, chNear, bloom, bfx, cart, runner, rig, player, hp } from './place.js';
import { cam, followCam } from './camera.js';
import { screenInfo, toggleFullscreen } from './screen.js';
import { toast, addCoins, closePanels, ach, openDex, onDexGet, topStack, updateStats, gyulExpect } from './hud.js';
import { keys, joy } from './input.js';
import { devOn, doEmote } from './menu.js';
import { weaponNow, bowArmed, aimTarget, throwTangerine, fireWeapon, aimMark, cycleLock, pickLock, setLock } from './throw.js';
import { feedback } from './panels.js';
import { bagS } from './bag.js';
import { rideCode, onRoad, noRideZone, mountRide, dismountRide, toggleRide, updateRideBtn, openRideWin, buyRide, boardCart, leaveCart, cartMark } from './ride.js';
import { photoBlob, photoPose, startPhoto, beginPhoto, rePoseAct, canSharePhoto, mountDeer, dismountDeer } from './moves.js';
import { net, social, photog } from './room.js';
import { mealS, shopPopNow, openShopPop, refreshShopPop, openStone, orderMeal, finishMeal, cutS, orderCut, sitCut, finishCut, leapS, leapItems, leapTryOn, pickLeap, buyLeap, shopMark, shopMarkId, interactables } from './stores.js';
import { pickS, toolNow, bagCap, bagRoom, startPick, zoneNow, updateTrashUI, bloomTest, bloomDeer, seekS, pressPick, stopSeek } from './pickup.js';
import { zoneLook } from './area.js';
import { dumpBag, placeArrow, autoGo, stopAutoGo, chRoute, startAutoGo } from './dump.js';
import { canBuyGear, gearTabNow, openShop, checkGearBadges, buyGear, wearCloth, buyCloth, goShop, shopGuide, refreshDots } from './shop.js';
import { lookPreview, openLook, closeLook } from './look.js';
import { sound, enemyWarn, dumpWarn, dumpers, gyulShower, coinFx } from './hooks.js';
import { rank } from './start.js';
import { placeRunner } from './update.js';
import { director } from './director.js'; // #176
import { recApi } from './rec.js'; // 촬영 모드 (#185)
import { placeAt, placeSpots } from './where.js'; // #153

Object.assign(late, { exposeDebug }); // 앞 파일에서 부르는 함수

// ---------- 튜토리얼 (입구 마당) ----------
// 튜토리얼용 낱개 쓰레기 (번호 k, #100: 3개)
const tutTrashLeftList = () => (trash ? (spots.tut?.trash || []).filter((_, k) => !trash.store.isTutPicked(k)) : []);
const tutTrashNext = () => { let b = null, bd = 1e9; for (const t of tutTrashLeftList()) { const d = Math.hypot(t.x - player.pos.x, t.z - player.pos.z); if (d < bd) { bd = d; b = t; } } return b; };
const tut = createTutorial({ save, persist, player, isTouch, camDist: () => cam.zoomed, gyulR: () => gyulPickR(save), toast, // #151 확대 단계·귤 모으는 범위·정낭 안내
  onGyul: (at) => { save.coins += 1; persist(); updateStats(); sound.coin?.(); coinFx(at, 1); }, pts: NS_TUT, scene, height, camera, placeArrow, stream, jeong, openJeong, bagVol: () => (trash ? trash.bagVol() : 0), bagCap, tutTrashLeft: () => tutTrashLeftList().length, tutTrashNext, ch: CH,
  col, low: LOW, addTargets: life.addTargets, sound, juice: (p, d) => life.juiceSplash(p, d), ctxIc: () => state.ctxTarget?.ic, shopTab: gearTabNow, // #62 과녁·눌러야 할 곳, #100 칸 돌담
  onTop: topStack, onCoins: updateStats, // #100 위쪽 토스트 자리 맞추기, 모자란 귤 채움
  onDone: () => { updateTrashUI(false); wx.calm(false); if ($('dev-tut')) $('dev-tut').hidden = true; } }); late.tut = tut;
wx.calm(!!NS_TUT && tut.active); // #100 튜토리얼 동안은 맑음 (날씨 이벤트 없음)
if (NS_TUT && tut.active) document.body.classList.add('tut');
if ($('dev-tut')) $('dev-tut').hidden = !tut.active; // 개발자 버튼 '튜토리얼 건너뛰기' (#62)
else if (!NS_TUT && save.tut && !save.tut.done) { save.tut.done = true; persist(); }
// ---------- 낚시 (#44) ----------
// 보상은 F 로 당기는 순간: 물고기 = 귤 5 + 도감 '개울' 칸, 쓰레기 = 호주머니·배낭(클린하우스에서 귤), 드문 것 = 배낭 + 도감(드문 것 귤)
state.fishing = createFishing({ scene, stream, player, runner, groundAt, height, sound, toast, canJack: () => !late.pace || late.pace.canJack(), onJack: () => late.pace?.note('jackpot'),
  room: () => bagRoom(),
  setHoldRod: (v) => { if (state.holdRod === v) return; state.holdRod = v; if (v) state.holdBow = false; syncEquipGear(); runner.apply(save.outfit); net.send(true); },
  reward: (c, at) => {
    if (c.type === 'fish') {
      const sp = FISH.species[c.i], dx = DEX_LIST.find((d) => d.id === `fish:${c.i}`);
      if (trash && dx) { const isNew = trash.store.dexAdd(dx.id); trash.store.commit(); onDexGet(dx, isNew); }
      if (c.jack) { // 잭팟 (#55): 귤이 터지듯 흩뿌려짐
        const G = FISH.jackpot.gyul; gyulExpect(G); addCoins(G); ach.emit('earn', G);
        setTimeout(() => { sound.jackpot?.(); gyulShower(G); coinFx(at.clone().setY(at.y + 1.2), G); }, FISH.pullT * 1000);
        ach.emit('fish'); ach.emit('fish-jackpot'); ach.emit('fish-' + sp.id);
      } else {
      gyulExpect(FISH.fishGyul); addCoins(FISH.fishGyul); ach.emit('earn', FISH.fishGyul); setTimeout(() => coinFx(at.clone().setY(at.y + 1.2), FISH.fishGyul), FISH.pullT * 1000);
      ach.emit('fish'); ach.emit('fish-' + sp.id);
      }
    } else if (trash) {
      const kind = c.type === 'trash' ? c.t.kind : c.kind;
      if (trash.addToBag(kind, bagCap())) setTimeout(() => updateTrashUI(true), (FISH.pullT + FISH.stowT) * 1000);
      if (c.type === 'rare') { const dx = DEX_LIST.find((d) => d.rare && d.name === c.name); if (dx) { const isNew = trash.store.dexAdd(dx.id); trash.store.commit(); onDexGet(dx, isNew); } }
      ach.emit('fish'); ach.emit('fish-' + (c.type === 'trash' ? c.t.id : 'rare'));
    }
  } });
// ---------- 개발용 라벨 ----------
const up = (y) => (p) => p && p.clone().setY((p.y || 0) + y);
const devLabels = createDevLabels({ camera, world: () => {
  const L = []; let n = 1; const code = () => `W-${String(n++).padStart(2, '0')}`;
  L.push([code(), '나(플레이어)', () => up(2.9)(player.pos)]);
  L.push([code(), '표지석', () => up(4.2)(P.stone)]);
  L.push([code(), '인증샷 자리', () => up(0.6)(photoSpot)]);
  L.push([code(), '쉼터 벤치', () => up(1.6)(benchPos)]);
  L.push([code(), '탐방 안내판', () => up(3.2)(spots.sign.pos)]);
  L.push([code(), '탐방로 시작', () => up(1.2)(spots.start)]);
  L.push([code(), '해돋이·해넘이 지점', () => up(1.5)(spots.sunWatch.pos)]);
  cairns.forEach((c) => L.push([code(), `돌탑 · ${c.name}`, () => up(3)(c.pos)]));
  life.hareubangs.forEach((h, i) => L.push([code(), `돌하르방 ${i + 1}`, () => up(3.6)(h.pos)]));
  const deerCode = code(); life.deer.forEach((d) => L.push([deerCode, '노루', () => up(2.4)(d.pos)]));
  if (life.horses) { const hc = code(); life.horses.forEach((h) => L.push([hc, '조랑말', () => up(2.9)(h.pos)])); }
  const pc = code(); L.push([pc, '다른 러너', () => null]);
  for (const e of net.peersById.values()) L.push([pc, `다른 러너 · ${e.nick}`, () => up(3.2)(e.pos)]);
  if (MAP_ID === 'darangswi') {
    L.push([code(), '굼부리(분화구)', () => new THREE.Vector3(0, height(0, 0) + 4, 0)]);
    L.push([code(), '한라산', () => new THREE.Vector3(-6600, 1150, 2700)]);
    L.push([code(), '성산일출봉', () => new THREE.Vector3(2600, 140, -1700)]);
  }
  return L;
} }); late.devLabels = devLabels;
const GFX = NSW ? ['smooth', 'lite'] : ['smooth', 'lite', 'toon', 'retro']; if (NSW && !GFX.includes(save.gfx)) save.gfx = 'smooth'; const GFX_NAME = { smooth: '기본', lite: '가볍게', toon: '카툰', retro: '레트로' };
function applyGfx() { renderer.toneMapping = !NSW && (save.gfx === 'toon' || save.gfx === 'retro') ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping; applySky(); grass.set(save.gfx !== 'lite'); motes.pts.visible = save.gfx !== 'lite'; retro.on = save.gfx === 'toon' || save.gfx === 'retro'; retro.setMode(save.gfx === 'retro' ? 'retro' : 'toon'); $('menu-gfx').textContent = `그래픽: ${GFX_NAME[save.gfx]}`; sun.shadow.radius = save.gfx === 'retro' ? 1.5 : 3; }
$('menu-gfx').addEventListener('click', () => { save.gfx = GFX[(GFX.indexOf(save.gfx) + 1) % GFX.length]; persist(); applyGfx(); toast(`${GFX_NAME[save.gfx]} 그래픽`); });
// 성능 단계 (#79): 자동 → 낮음 → 보통 → 높음. 높음 ↔ 낮음·보통은 그려 둔 양(LOW)이 달라 새로고침
const PERF_ORDER = ['auto', 0, 1, 2];
const perfTierOf = (v) => (v === 'auto' ? (PERF_AUTO ? TIER : autoTier()) : v);
function perfLabel() { const v = save.perf ?? 'auto'; return v === 'auto' ? `성능: 자동(${PERF.names[perfTierOf('auto')]})` : `성능: ${PERF.names[v]}`; }
// #187 비 효과: 보통·약하게·끔 (빗줄기·눈송이만. 회색 하늘·젖은 땅은 그대로). 고른 적 없고 움직임 줄이기 설정이면 '약하게'
const RAIN_FX = ['full', 'soft', 'off'];
function rainFxNow() { if (RAIN_FX.includes(save.rainFx)) return save.rainFx; try { return matchMedia('(prefers-reduced-motion: reduce)').matches ? 'soft' : 'full'; } catch { return 'full'; } }
function applyRainFx() { const k = rainFxNow(); wx.setFx(k); const b = $('menu-rainfx'); if (b) b.textContent = `비 효과: ${WEATHER.fx[k].name}`; }
applyRainFx();
$('menu-rainfx')?.addEventListener('click', () => { save.rainFx = RAIN_FX[(RAIN_FX.indexOf(rainFxNow()) + 1) % RAIN_FX.length]; persist(); applyRainFx(); toast(`비 효과 ${WEATHER.fx[save.rainFx].name}`); });
$('menu-perf').textContent = perfLabel();
$('menu-perf').addEventListener('click', () => {
  const cur = save.perf ?? 'auto', next = PERF_ORDER[(PERF_ORDER.indexOf(cur) + 1) % PERF_ORDER.length], t = perfTierOf(next);
  save.perf = next; persist(); $('menu-perf').textContent = perfLabel();
  if ((t < 2) !== LOW) { toast(`${perfLabel()} · 다시 불러와요`); setTimeout(() => location.reload(), 700); return; }
  quality.auto = next === 'auto'; quality.tier = quality.level = t; applyQuality(); toast(perfLabel());
});
applyGfx();
$('menu-dev').addEventListener('click', () => { closePanels(); devLabels.toggle(); toast(devLabels.on ? '개발용 라벨을 켰어요 (F2로 끄기)' : '개발용 라벨을 껐어요'); });
addEventListener('keydown', (e) => { if (e.code === 'F2') { e.preventDefault(); devLabels.toggle(); } });
if (/(^|[#&])dev($|&)/.test(location.hash)) devLabels.set(true);
if (wearRefund) { persist(); setTimeout(() => toast(`예전 옷 색은 없어졌어요 · 귤 ${wearRefund}개를 돌려드렸어요`), 3500); } // #52
// 콘솔 확인 함수 (#84): 개발 빌드는 늘, 공개 빌드(release, PUBLIC=1)는 어드민에게만 (enableDev). 보안은 서버가 지키고, 이건 함부로 만지지 않게 하는 정도
state.debugReady = false;
function exposeDebug() { window.__oreum = debugApi(); window.__oreum.where = { at: placeAt, spots: placeSpots, now: () => $('where').textContent }; window.__oreum.story = late.storyApi && { ...late.storyApi, ending: late.endingApi }; window.__oreum.director = { api: director, state: () => director.state(), open: (id) => director.open(id), log: director.log, can: (k) => director.can(k) }; window.__oreum.quest = late.questDebug; window.__oreum.season = late.season?.test; window.__oreum.punk = late.punk; window.__oreum.punkWorld = late.punkWorld; window.__oreum.rec = recApi; window.__oreum.ufo = () => late.ufoNow?.(); window.__oreum.ufoInfo = () => late.ufoInfo?.(); window.__oreum.mutter = late.mutterApi; window.__oreum.rare = late.rareDev; } // 감독 (#176), 퀘스트 (#158)
function debugApi() { return { bag: { open: (t) => late.openBag(t), close: () => late.closeBag(), s: () => ({ ...bagS, mode: cam.mode, cards: document.querySelectorAll('#bag-cards .bag-card').length }) }, zoneLook: zoneLook && { api: zoneLook, gates: () => zoneLook.gates.map((G) => ({ kind: G.kind, from: G.from, to: G.to, x: +G.x.toFixed(1), z: +G.z.toFixed(1), fx: +G.fx.toFixed(2), fz: +G.fz.toFixed(2), sign: G.sign })), counts: () => zoneLook.counts(), stats: () => zoneLook.stats(), openMap: () => late.openMap?.() }, gearScore: () => gearScore(save), charKit: { THREE, buildRunner, SKIN_TONES, TOOL_GEAR, BAG_GEAR, SHOE_GEAR, CLOTHES, HAIR, ACCESSORIES, OUTFIT_SETS }, outfitSet: late.outfitSet, gearKit: { gearScore, abilityCloth }, screen: () => ({ ...screenInfo(), fov: camera.fov, w: innerWidth, h: innerHeight }), toggleFullscreen, assets: assetInfo, lifeModels: { mount: (i = 0) => mountDeer(life.deer[i]), dismount: () => dismountDeer(), lamps: () => lamps.points.length }, deerNet: () => late.deerNet, feedback, rank, emo: state.emo, doEmote, net, online: ONLINE && { account: () => state.account, fake: (n) => mountLogin.fake?.(n), live: () => !!trash?.store && net.ready }, rides: { // 탈것·마차 (#69)
  give: (id) => { if (RIDE_BY[id] && !save.rides.own.includes(id)) { save.rides.own.push(id); save.rides.cur = id; persist(); updateRideBtn(); } }, mount: (id) => mountRide(id), off: () => dismountRide(), toggle: () => toggleRide(), pick: () => openRideWin(),
  state: () => ({ ride: player.ride, carry: player.rideC, auto: player.rideAuto, cur: save.rides.cur, own: [...save.rides.own], speed: player.speed, grade: player.rideG, road: onRoad(player.pos.x, player.pos.z), zone: noRideZone(player.pos.x, player.pos.z), code: rideCode(), cart: player.cart && { ...player.cart } }),
  speed: rideSpeed, rig, zone: noRideZone, onRoad, buy: (id) => buyRide(RIDE_BY[id]), open: () => openShopPop('ride'), shop: shopsBuilt.find((sh) => sh.id === 'ride') || null,
  cart: cart && { api: cart, board: () => boardCart(), leave: (j) => leaveCart(!!j), state: () => ({ ...cart.state }), mark: () => !cartMark.hidden, wait: (i) => cart.stops[i] && cart.stops[i].ring.visible, goStop: (i) => { const S = cart.stops[i]; player.pos.set(S.pos.x, groundAt(S.pos.x, S.pos.z), S.pos.z); }, shift: (v) => { state.cartShift = v; }, at: (stop) => { const now = Date.now() / 1000; for (let t = 0; t < CART.lap; t += 0.5) { const st = cartStateAt(now + t); if (!st.moving && st.stop === stop && st.left > 6) { state.cartShift = t; return t; } } return null; }, block: () => cart.block, ground: (x, z) => groundAt(x, z), goCart: () => { player.pos.set(cart.pos.x + 3, 0, cart.pos.z); player.pos.y = groundAt(player.pos.x, player.pos.z); } },
}, street: street && { layout: STREET, built: street, shops: shopsBuilt, open: openShopPop, popNow: () => !$('shoppop').hidden && shopPopNow, mark: () => !shopMark.hidden && shopMarkId, goShop, guide: shopGuide, dots: () => { refreshDots(); return Object.fromEntries(Object.entries(roofSigns?.signs || {}).map(([k, v]) => [k, v.dot.visible])); }, pillDot: () => !$('gyul-dot').hidden, roof: roofSigns, go: (i = 0, s = 0) => { const p = i ? STREET.lot(i).front : STREET.P(s, 0); player.pos.set(p.x, groundAt(p.x, p.z), p.z); player.heading = i ? STREET.lot(i).rot + Math.PI : Math.atan2(STREET.ax, STREET.az); } }, clothes: { state: () => structuredClone(CL), stats: () => Object.fromEntries(WEAR.slots.map((w) => [w.stat, wearV(w.k)])), wear: (slot, id) => wearCloth(slot, id), buy: buyCloth, give: (id) => { if (CLOTH[id]) { CL.own[id] = 1; persist(); } }, bagCap: () => bagCap(), hpMax: () => hp.max, refund: () => wearRefund }, look: { open: openLook, close: closeLook, set: (sex, skin) => { if (sex) lookS.sex = sex; if (skin != null) lookS.skin = skin; lookPreview(); }, state: () => ({ open: lookS.open, sex: lookS.sex, skin: lookS.skin, look: save.look, hairs: { ...save.hairs }, hat: save.outfit.gear?.hat, hair: save.outfit.gear?.hair }) }, leap: LEAPB && { api: LEAPB, open: () => openShopPop('leap'), slot: (k) => { leapS.slot = k; leapS.pick = null; leapTryOn(null); refreshShopPop(); }, items: (k = leapS.slot) => leapItems(k).map(({ art, cloth, ...r }) => r), pick: (id) => { const it = leapItems(leapS.slot).find((i) => i.id === id); if (it) pickLeap(it); return !!it; }, buy: (id = leapS.pick) => buyLeap(leapItems(leapS.slot).find((i) => i.id === id)), state: () => ({ on: leapS.on, slot: leapS.slot, pick: leapS.pick, tried: leapS.tried, cam: cam.mode, coins: save.coins, shoes: save.equip.shoes, wear: { ...CL.wear } }), go: () => { player.pos.copy(LEAPB.door); player.pos.y = groundAt(LEAPB.door.x, LEAPB.door.z); player.heading = LEAPB.face + Math.PI; } }, salon: SAL && { api: SAL, open: () => openShopPop('salon'), order: (id) => orderCut(HAIR.list.find((h) => h.id === id)?.key), finish: () => finishCut(), sit: () => sitCut(), cut: () => ({ on: cutS.on, phase: cutS.phase, t: cutS.t, hair: cutS.hair }), go: () => { player.pos.copy(SAL.door); player.pos.y = groundAt(SAL.door.x, SAL.door.z); player.heading = SAL.seatHeading; } }, manjok: MANJ && { api: MANJ, open: () => openShopPop('manjok'), order: (id) => orderMeal(MANJOK.menu.find((m) => m.id === id), 'manjok'), go: () => { player.pos.copy(MANJ.terrace); player.pos.y = groundAt(MANJ.terrace.x, MANJ.terrace.z); } }, stone: STN && { api: STN, buff, open: openStone, order: (id) => orderMeal(STONE.menu.find((m) => m.id === id)), finish: () => finishMeal(), meal: () => ({ on: mealS.on, phase: mealS.phase, t: mealS.t, item: mealS.item?.id }), go: () => { player.pos.copy(STN.terrace); player.pos.y = groundAt(STN.terrace.x, STN.terrace.z); player.heading = STN.seatHeading + Math.PI; }, mul: (k) => buff.mul(k), cap: () => bagCap(), tool: () => toolNow() }, bloom: bloom && { api: bloom, ...bloom.test, test: bloomTest, fx: bfx, deer: () => Object.fromEntries(Object.entries(bloomDeer).map(([z, l]) => [z, l ? l.length : 0])) }, fish: state.fishing && { api: state.fishing, ...state.fishing.test, go: (side = -1, lat = 3) => { const [x, z] = stream.at(stream.centerOff(lat) + side * (stream.halfW(lat) + 0.7), lat); player.pos.set(x, groundAt(x, z), z); player.heading = Math.atan2(-side * stream.at(1, 0)[0] + side * stream.at(0, 0)[0], -side * stream.at(1, 0)[1] + side * stream.at(0, 0)[1]); }, press: () => state.fishing.press(), can: () => state.fishing.canFish() }, weapon: { now: () => weaponNow().id, ammo: () => (weaponNow().id === 'bow' ? save.bowAmmo : save.ammo[weaponNow().id]), armed: () => bowArmed(), hold: () => state.holdBow, fire: () => fireWeapon(), set: (v) => { save.equip.weapon = v; save.weaponUse = v; persist(); late.armsChanged?.(); }, use: (v) => { save.weaponUse = Math.max(1, Math.min(save.equip.weapon, v)); persist(); late.armsChanged?.(); }, arrows: () => life.arrows.length, fx: late.armFx, open: () => late.openArmWin(), t: () => late.armsTime() }, enemies: life.enemies, charge: late.charge, enemyWarn, pace: late.pace, crowd: { get: () => state.crowd || 1, set: (n) => { state.crowd = n; dumpers?.setPlayers(n); } }, dumpers: dumpers && { api: dumpers, ...dumpers.test, warn: dumpWarn }, abStats: () => ab.get(), hp, server: { id: serverId, isBattle }, aim: { target: () => aimTarget(), lock: () => state.lock, setLock: (t) => setLock(t), cycle: () => cycleLock(), pickAt: (x, y) => pickLock(x, y), mark: aimMark, throw: () => throwTangerine(), ctx: () => state.ctxTarget && (state.ctxTarget.ic || state.ctxTarget.label), pick: () => startPick() }, stream, jeong, tut, openJeong, gyulShower, prints, bound: NSW ? NSB : null, wall, setWeather: (k) => wx.set(k), wx, col, cairns, fillCairn, cleanhouse: CH && { api: CH, all: CHS, near: () => chNear(), route: () => { const b = chRoute(); return b && { id: b.ch.id || 'main', L: Math.round(b.L) }; }, goMini: (i = 0) => { const c = CH_MINI[i]; if (!c) return null; player.pos.copy(c.front); player.pos.y = height(c.front.x, c.front.z); player.heading = Math.atan2(c.center.x - c.front.x, c.center.z - c.front.z); return c.id; }, minis: () => CH_MINI.map((c) => ({ id: c.id, name: c.name, x: +c.center.x.toFixed(1), z: +c.center.z.toFixed(1), fx: +c.front.x.toFixed(1), fz: +c.front.z.toFixed(1) })), autoGo: () => startAutoGo(), autoStop: () => stopAutoGo(), autoState: () => autoGo && { i: autoGo.i, n: autoGo.route.length, route: autoGo.route }, dump: () => dumpBag(), go: () => { player.pos.copy(CH.front); player.pos.y = height(CH.front.x, CH.front.z); player.heading = Math.atan2(CH.center.x - CH.front.x, CH.center.z - CH.front.z); }, recycle: () => ({ ...save.recycle, coins: save.coins }), shopHint: () => state.shopHintUntil, openShop, buyGear, canBuyGear }, trash: trash && { ...trash.test, dexList: DEX_LIST, openDex, checkGearBadges, api: trash, state: () => ({ bag: { ...trash.store.bag }, vol: trash.bagVol(), cap: bagCap(), clean: trash.clean(), zone: zoneNow, zoneClean: zoneNow ? trash.zoneClean(zoneNow) : null, picked: trash.store.pickedCount(), total: trash.store.totalCount(), picking: pickS.cyc >= 0, seek: seekS.on && { ...seekS.on.t, wp: seekS.on.i, n: seekS.on.route.length } }), press: () => pressPick(), stopSeek: () => stopSeek(), goHeap: (i) => { const h = trash.heaps[i]; if (!h) return null; const a = Math.atan2(player.pos.x - h.x, player.pos.z - h.z), d = h.r + 1.2, x = h.x + Math.sin(a) * d, z = h.z + Math.cos(a) * d; player.pos.set(x, groundAt(x, z), z); player.heading = a + Math.PI; return { x, z }; }, estimate: () => CH && trash.test.estimate(CHS.map((c) => c.front), { TOOLS, BAGS, SHOES }) }, field: late.field, guard: late.guard, boss: late.boss, level: late.level, buddies: late.buddies, loot: late.lootApi, forge: late.forgeApi, swarm: late.swarm, smoker: late.smoker, keys, player, sound, devLabels, buildRunner, runner, retro, trail, groundAt, height, cam, interactables, save, life, social, ach, quality, farCull: () => state.farCull, crash, renderer, prepShaders, scene, spots, lampAim, lamps, joy, camObj: camera, setTod: (h) => { state.todOverride = h; applySky(); }, sunState: () => sunState, snap: () => followCam(0, true), photo: { photog, start: () => startPhoto(), begin: () => beginPhoto(), state: () => state.photoState && { ...state.photoState }, pose: () => photoPose, rePose: () => rePoseAct.act(), open: () => !$('photo').hidden, blob: () => photoBlob, canShare: () => canSharePhoto(), close: () => $('photo-close').click() },
  tp: (x, z, h, pitch = 0.2, dist = 13, yawOff = 0) => { player.pos.set(x, height(x, z), z); player.visY = player.pos.y; player.heading = h; player.viewSeen = true; state.awe = 0; state.aweBack = 0; cam.yaw = h + Math.PI + yawOff; cam.pitch = pitch; cam.dist = dist; placeRunner(); followCam(0, true); } }; }
state.debugReady = true;
if (!__PUBLIC__ || devOn) exposeDebug();
