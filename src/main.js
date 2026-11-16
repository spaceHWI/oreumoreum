import { NSMODE, TEXCS } from './boot.js'; // 반드시 맨 먼저
import { useNamsongi, buildNamsongi, nsPaths } from './namsongi.js';
import { createFootprints } from './footprints.js';
import { createTrash, createLocalTrashStore, DEX_LIST } from './trash.js';
import { dexIcon } from './dexicons.js';
import { TOOLS, BAGS, POCKET, SHOES, TRASH_TYPES, CLEANHOUSE, DEX, CAIRN, COLLIDE, TUT, BOAR, SCATTER, THROW_AIM, HP, ENEMY_SPAWN, ENEMIES, WEAPONS, BOW, FISH, BLOOM, BLOOM_FX, DUMP, STONE, SHOP_ST, SHOPS, HAIR, SALON, LEAP, WEAR, CLOTHES, WEAR_START, wearPrice, MUSIC } from './balance.js';
import { STREET } from './streetlayout.js';
import { createShopStreet, SHOP_BUILD, SHOP_ICON, SCISSORS, SHIRT } from './shops.js';
import { leapLogo } from './leap.js';
import { salonLogo } from './salon.js';
import { createBuff } from './buff.js';
import { FOOD_SVG, BUFF_ICON, FORK_KNIFE, buffText } from './stoneicons.js';
import { STONE_LOGO } from './stonelogo.js';
import { ZONE_IDS } from './zones.js';
import { createHp } from './hp.js';
import { createStream } from './stream.js';
import { createFishing } from './fishing.js';
import { streamCross } from './streamshape.js';
import { createCollide } from './collide.js';
import { equipGear, TOOL_GEAR, ACCESSORIES, SHOE_GEAR } from './gear.js';
import { createCleanhouse } from './cleanhouse.js';
import { buildTrailGraph, trailRoute } from './autowalk.js';
import { gradHard } from './toon.js';
import { createRetro } from './retro.js';
import { createDevLabels } from './devlabels.js';
import { VERSION, RELEASE_NOTES } from './version.js';
import { BADGE_ICONS, DAILY_ICON, ALLDAY_ICON, iconSvg } from './badgeicons.js';
import * as THREE from 'three';
import { buildTerrain, buildDecor, buildSky, height, groundAt, addWalkable, surfaceAt, groundColor, R_RIM, trail } from './world.js';
import { G, M as MOOD, blendMood, createGrass, createMotes, createPost, createFlowers, PW, LOW } from './gfx2.js';
import { useDonnaeko, buildDonnaekoDecor } from './donnaeko.js';
import { useGate, buildGateDecor } from './gate.js';
import { createTutorial } from './tutorial.js';
import { createLamps } from './lamps.js';
import { buildRunner, THROW, OUTFIT_OPTIONS, DEFAULT_OUTFIT, itemPrice, SKIN_TONES, setBlinkCamera } from './runner.js';
import { clothSvg, WEAR_STAT_ICON, wearStatText } from './clothicons.js';
import { Sound } from './audio.js';
import { createNet } from './net.js';
import { createLife } from './life.js';
import { createDumpers } from './dumpers.js';
import { createBloom } from './bloom.js';
import { createBloomFx } from './bloomfx.js';
import { createSocial } from './social.js';
import { buildSign } from './props.js';
import { MAPS, pickMapId, buildSpots } from './maps.js';
import * as NSB from './nsbound.js';
import { createStoneWall, createCrossWall } from './stonewall.js';
import { createWeather, WX, wxIcon } from './weather.js';
import { sunPosition, sunTimes, sunDir, fmtKST, buildSkyBodies } from './sun.js';
import { createAchievements, BADGES, kstDate } from './achievements.js';
import { isBattle, serverId, setServerId, validServer, roomFor, createAbStats, SERVERS, SERVER_ART, SERVER_LABEL } from './server.js';
import { initUiTips } from './uitips.js';
import { createTips, TIP, TIP_ICON } from './tips.js';

const $ = (id) => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---------- 저장 ----------
const KEY = __DEV__ ? 'oreumoreum.dev' : 'oreumoreum.v1'; // 개발 서버는 기록을 따로
const ADJ = ['작은', '느긋한', '고요한', '따스한', '부지런한', '수줍은', '씩씩한', '조용한'];
const NOUN = ['억새', '까마귀', '송이', '바람', '노루', '들꽃', '조랑말', '돌담'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
let save = {};
try { save = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { save = {}; }
const freshSave = !save.nick || !!save.reset; delete save.reset; // 처음 온 사람
save.nick ||= `${pick(ADJ)} ${pick(NOUN)}`;
save.outfit = { ...structuredClone(DEFAULT_OUTFIT), ...(save.outfit || {}) };
if (!save.hatBackV) { save.outfit.hat.back = true; save.hatBackV = 1; }
if (!save.nsV3) { save.tut = { step: 0, done: false, v: 3 }; if (save.trash) save.trash.tp = []; save.nsV1 = save.nsV2 = save.nsV3 = 1; save.jeong = 0; } // 새 튜토리얼(#31): 기존 유저도 한 번 다시 봄
if (!save.styleV5) { save.outfit.hat.color = '#5c9a3c'; save.outfit.shirt.color = '#e8d9b5'; save.outfit.pants.color = '#8a6a3c'; save.outfit.shoes.color = '#26262b'; save.styleV5 = 1; } // 모델 캐릭터 기본 색으로 한 번만 초기화
if (!save.styleV2) { save.outfit.hat.type = 'none'; save.outfit.glasses.type = 'none'; save.styleV2 = 1; } // 똥머리가 보이게 한 번만 초기화 save.outfit.shirt.type ||= 'tee'; save.outfit.shoes.type ||= 'road';
save.totalSteps ||= 0;
if (typeof save.coins !== 'number') save.coins = 5;
save.owned ||= {};
save.wishes ||= {};
if (!save.equip || typeof save.equip !== 'object') save.equip = {};
// 배낭(#31): 0 = 호주머니(처음), 1~5 = 배낭. 예전 저장의 1단계(용량 20)는 첫 배낭(BAGS[0], 20)을 가진 것으로 그대로 둠
if (!save.bagV) { if (freshSave || typeof save.equip.bag !== 'number') save.equip.bag = freshSave ? 0 : 1; save.bagV = 1; }
{ const v = Math.floor(Number(save.equip.weapon)), top = WEAPONS.filter((w) => !w.soon).length; save.equip.weapon = Math.max(1, Math.min(top, Number.isFinite(v) ? v : 1)); } // 무기 단계 (#38, 1 = 손)
save.bowAmmo = Math.max(0, Math.min(WEAPONS[1].perGyul, Math.floor(Number(save.bowAmmo)) || 0)); // 귤 하나로 남은 화살 수
for (const k of ['tool', 'bag', 'shoes']) { const lo = k === 'bag' ? 0 : 1, v = Math.floor(Number(save.equip[k])); save.equip[k] = Math.max(lo, Math.min(5, Number.isFinite(v) ? v : 1)); } // 장비 단계 (상점에서 다음 단계만 삼)
// 장비 단계 → 캐릭터 겉모습(outfit.gear 의 손·등·신발). 네트워크에도 그대로 실려 감
let holdBow = false; // 귤 활을 손에 들고 있음 (#38): 쏘면 활, 줍기 누르면 다시 도구
let holdRod = false; // 낚시하는 동안 손 도구를 숨김 (#44, 낚싯대는 fishing.js 가 따로 그림)
// 옷 (#52): save.clothes = { own: {id: 1}, wear: {칸: id} }. 머리는 모자와 다른 칸(hair)
const CLOTH = Object.fromEntries(CLOTHES.map((c) => [c.id, c])), WSLOT = Object.fromEntries(WEAR.slots.map((w) => [w.k, w]));
if (!save.clothes || typeof save.clothes !== 'object') save.clothes = {};
const CL = save.clothes; if (!CL.own || typeof CL.own !== 'object') CL.own = {}; if (!CL.wear || typeof CL.wear !== 'object') CL.wear = {};
Object.keys(CL.own).forEach((id) => { if (!CLOTH[id]) delete CL.own[id]; }); Object.values(WEAR_START).forEach((id) => { CL.own[id] = 1; });
WEAR.slots.forEach(({ k }) => { const id = CL.wear[k]; if (id && !(CLOTH[id]?.slot === k && CL.own[id])) delete CL.wear[k]; if (!CL.wear[k] && WEAR_START[k] && !(k in CL.wear)) CL.wear[k] = WEAR_START[k]; });
if (!save.outfit.gear || typeof save.outfit.gear !== 'object') save.outfit.gear = {};
{ const g = save.outfit.gear; if (ACCESSORIES[g.hat]?.slot === 'hair' || g.hat === 'hat:cap') { if (g.hat !== 'hat:cap') g.hair = g.hat; delete g.hat; } } // 예전 저장: 머리가 hat 칸에 있었음
let wearRefund = 0; // 예전 옷 색 구매·초록 모자 머리를 귤로 돌려줌 (한 번만)
if (!save.wearV) {
  Object.keys(save.owned || {}).forEach((k) => { const [part, kind, ...v] = k.split(':'); if (!OUTFIT_OPTIONS[part]) return; const pr = itemPrice(part, kind, v.join(':')); if (pr > 0) wearRefund += pr; });
  if (save.hairs?.['hat:cap']) { wearRefund += HAIR.capRefund; delete save.hairs['hat:cap']; }
  save.owned = {}; ['hat', 'shirt', 'pants', 'shoes'].forEach((k) => { save.outfit[k] = structuredClone(DEFAULT_OUTFIT[k]); });
  if (wearRefund) save.coins += wearRefund; save.wearV = 1;
}
const wearTier = (k) => { const id = CL.wear[k]; return id && CLOTH[id] ? CLOTH[id].tier : 0; };
const wearV = (k) => WSLOT[k].v[wearTier(k)]; // 지금 입은 옷의 능력치
const clothGear = () => { const hasHair = ACCESSORIES[save.outfit.gear.hair]?.slot === 'hair' && !ACCESSORIES[save.outfit.gear.hair].builtin, out = {};
  WEAR.slots.forEach(({ k }) => { out[k] = CL.wear[k] || `${k}:none`; });
  if (!hasHair) out.hat = 'hat:cap'; // 머리를 고르기 전(구운 머리·모자)엔 모자를 겹쳐 쓰지 않음
  return out; };
const syncEquipGear = () => { save.outfit.gear = { ...(save.outfit.gear && typeof save.outfit.gear === 'object' ? save.outfit.gear : {}), ...equipGear(save.equip), ...clothGear() }; if (holdBow) save.outfit.gear.hand = 'hand:bow'; if (holdRod) save.outfit.gear.hand = 'hand:none'; };
syncEquipGear();
// 캐릭터 고르기 (#51): save.look = { sex: 'm'|'f', skin: 0~2 }. 없으면 입장 뒤 튜토리얼보다 먼저 고르기 화면. save.hairs = 가진 머리(hat 칸 장비)
const lookS = { open: false, t: 0, sex: 'm', skin: 0, oldPlayer: !freshSave && !save.look }; // 예전부터 하던 사람은 쓰던 초록 모자도 가짐
if (!save.hairs || typeof save.hairs !== 'object') save.hairs = {};
if (save.look && typeof save.look === 'object') {
  save.look.sex = save.look.sex === 'f' ? 'f' : 'm'; save.look.skin = Math.max(0, Math.min(SKIN_TONES.length - 1, Math.floor(Number(save.look.skin)) || 0));
  save.hairs[HAIR.start[save.look.sex]] = 1;
  if (!save.hairs[save.outfit.gear.hair]) save.outfit.gear.hair = HAIR.start[save.look.sex]; // 안 가진 머리를 쓰고 있으면 기본 머리로
  syncEquipGear();
  save.outfit.skin = { color: SKIN_TONES[save.look.skin] };
} else delete save.look;
if (!save.recycle || typeof save.recycle !== 'object') save.recycle = {};
save.recycle.visits = Math.max(0, Math.floor(Number(save.recycle.visits) || 0)); // 클린하우스에 버린 횟수
save.recycle.gyul = Math.max(0, Math.floor(Number(save.recycle.gyul) || 0)); // 클린하우스에서 번 귤 누적
let resetting = false;
// 서버 (#35): save.server = clean | battle. 처음 온 사람은 시작 화면에서 고름 (그 전엔 깨끗한 오름으로 둠)
if (!validServer(save.server)) delete save.server;
setServerId(save.server || 'clean');
const srvSwitched = !!save.srvSwitch && !!save.server; delete save.srvSwitch; // 메뉴에서 서버를 바꿔 새로고침한 직후
const ab = createAbStats(KEY + '.ab'); // 서버별 접속 횟수·플레이 시간·주운 수 (기기 기록, 처음부터 다시 해도 남음)
const persist = () => { if (resetting) return; try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* 저장 불가 환경 */ } };

const MAP_ID = pickMapId(save.map);
const prevMap = save.prevMap || null; save.prevMap = null;
save.map = MAP_ID; persist();
if (MAP_ID === 'donnaeko') useDonnaeko();
if (MAP_ID === 'gate') useGate();
if (NSMODE) useNamsongi();

let seedN = 7;
const rnd = () => { seedN = (seedN * 16807) % 2147483647; return seedN / 2147483647; };

// ---------- 렌더러 ----------
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'default' });
renderer.outputColorSpace = NSMODE ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const quality = { pr: 1, level: 2 };
const retro = createRetro(renderer);
const post = createPost(renderer, LOW);
if (!save.gfxV3) { save.gfx = 'smooth'; save.gfxV3 = 1; } retro.on = save.gfx === 'toon' || save.gfx === 'retro'; retro.setMode(save.gfx === 'retro' ? 'retro' : 'toon');
const scene = new THREE.Scene();
const FOG = new THREE.Color('#cfe0dc');
scene.background = FOG;
scene.fog = new THREE.Fog(FOG, MAP_ID === 'gate' ? 90 : 220, MAP_ID === 'donnaeko' ? 3200 : MAP_ID === 'gate' ? 900 : 2600);
const leapLane = (() => { const sh = SHOPS.find((r) => r.id === 'leap'), l = sh && STREET.lot(sh.lot); if (!l) return []; const at = (k) => [l.front.x + l.back.x * k, l.front.z + l.back.z * k]; return [{ pts: [at(LEAP.fore - 0.2), at(LEAP.fore + LEAP.D + 0.2)], w: LEAP.W / 2 + 0.2 }]; })(); // LEAP 바닥 밑 풀 없앰 (#59)
const NSW = NSMODE ? buildNamsongi({ scene, renderer, bound: NSB, clear: STREET.clear, lanes: [{ pts: STREET.alley, w: SHOP_ST.half + 0.3 }, ...leapLane] }) : null; // 가게 거리(#57) 자리는 나무·바위를 비우고 판석 골목

if (NSW) { scene.fog.near = NSW.fogNear; scene.fog.far = NSW.fogFar; }
const camera = new THREE.PerspectiveCamera(50, 1, 0.5, NSW ? NSW.camFar : 14000);
setBlinkCamera(camera); // 먼 캐릭터는 깜빡임 생략 (#74)
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  const cap = quality.level === 2 ? (w < 700 ? 1.6 : 1.75) : quality.level === 1 ? 1.25 : 1;
  quality.pr = Math.min(window.devicePixelRatio || 1, cap);
  renderer.setPixelRatio(quality.pr);
  renderer.setSize(w, h, false);
  retro.setSize(w * quality.pr, h * quality.pr); post.setSize(w * quality.pr, h * quality.pr);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

const hemi = new THREE.HemisphereLight('#dcecff', '#a8b07a', 2.4); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1d6', 1.0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 50; sun.shadow.camera.far = 1400;
sun.shadow.camera.left = -58; sun.shadow.camera.right = 58; sun.shadow.camera.top = 58; sun.shadow.camera.bottom = -58;
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.9; sun.shadow.radius = 4;
if (NSW) NSW.setupShadow(sun);
scene.add(sun); scene.add(sun.target);
const fill = new THREE.DirectionalLight('#fff1d6', 1.0); scene.add(fill); scene.add(fill.target);
// 역광(림라이트): 해 반대편에서 차갑게 살짝, 캐릭터·나무 윤곽을 땅에서 띄워 줌
const rim = new THREE.DirectionalLight('#bcd4ff', 0.55); scene.add(rim); scene.add(rim.target);
const SUN_DIR = new THREE.Vector3(-0.5, 0.7, 0.4).normalize();

const terrain = NSW ? NSW.terrain : buildTerrain();
terrain.receiveShadow = true;
scene.add(terrain);
if (NSW) { /* 남송이오름은 자기 풍경을 직접 만든다 */ } else if (MAP_ID === 'donnaeko') buildDonnaekoDecor(scene, height); else if (MAP_ID === 'gate') buildGateDecor(scene, height); else buildDecor(scene);
const sky = NSW ? NSW.sky : buildSky(scene);
const clouds = sky.clouds;
const bodies = buildSkyBodies(scene);
const wx = createWeather({ scene, low: LOW });
if (NSW) bodies.stars.scale.setScalar(14); // 먼 산 뒤로
const eoksaeMat = scene.getObjectByName('eoksae')?.material || null;
scene.fog.color = FOG; G.fogC.value = FOG; const FOG_N = scene.fog.near, FOG_F = scene.fog.far;
const TERR_EXT = terrain.geometry.parameters.width / 2 - 2;
const grass = NSW ? NSW.grass : createGrass({ scene, height, colorAt: groundColor, low: LOW, canGrow: (x, z) => (Math.abs(x) > TERR_EXT || Math.abs(z) > TERR_EXT || surfaceAt(x, z) !== 0 || groundAt(x, z) - height(x, z) > 0.05) ? 0 : (MAP_ID === 'donnaeko' ? 0.55 : 1) });
const motes = createMotes({ scene, height, low: LOW });
const prints = createFootprints({ scene, height, surfaceAt, low: LOW }); // 발자국 (#21)
if (PW && !NSW) createFlowers({ scene, height, extent: TERR_EXT, count: LOW ? 3200 : 6500, canGrow: (x, z) => (Math.abs(x) > TERR_EXT || Math.abs(z) > TERR_EXT || surfaceAt(x, z) !== 0 || groundAt(x, z) - height(x, z) > 0.05) ? 0 : 1 });
const spots = buildSpots(MAP_ID);
if (NSW && spots.tut?.stream) spots.lamps = [...(spots.lamps || []), ...STREET.lamps]; // 가게 거리 가로등 (#57)
const lamps = createLamps({ scene, positions: spots.lamps || [], height });

// ---------- 시간·해 (실제 제주 시각) ----------
let todOverride = null; // 테스트용: 오늘 몇 시로 볼지
const nowDate = () => { if (todOverride == null) return new Date(); const d = new Date(); const kstMid = Math.floor((d.getTime() + 9 * 3600000) / 86400000) * 86400000 - 9 * 3600000; return new Date(kstMid + todOverride * 3600000); };
let todayTimes = sunTimes(new Date()), todayKey = kstDate();
let sunState = { el: 30, az: 180, k: 1, golden: 0 };
let lampNight = 0;
function applySky() {
  const d = nowDate();
  if (kstDate(d.getTime()) !== todayKey) { todayKey = kstDate(d.getTime()); todayTimes = sunTimes(d); }
  const { el, az } = sunPosition(d);
  const k = THREE.MathUtils.smoothstep(el, -7, 7);
  const golden = el > -6 && el < 12 ? 1 - Math.abs(el - 2) / 10 : 0;
  const g = clamp(golden, 0, 1);
  const mix = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);
  // 시안의 시간대 분위기: 낮·노을은 자연스럽게, 새벽(해가 동쪽)·밤은 청록빛
  const m = blendMood(k, g, az < 180);
  sky.setColors(m.zenith, m.horizon);
  scene.fog.near = FOG_N * (0.55 + 0.45 * m.fogK); scene.fog.far = FOG_F * m.fogK; G.fogN.value = scene.fog.near; G.fogF.value = scene.fog.far;
  const ex = renderer.toneMapping === THREE.NoToneMapping ? 1 : 1.5; // 카툰·레트로(ACES)는 조금 밝게
  sun.color.copy(m.sun); sun.intensity = m.sunI * 0.8 * ex; fill.color.copy(m.sun); fill.intensity = m.sunI * 0.12 * ex;
  rim.color.copy(m.amb); rim.intensity = 0.3 * ex;
  hemi.color.copy(m.amb); hemi.groundColor.copy(m.ground); hemi.intensity = m.hemiI * 1.05 * ex;
  post.u.sat.value = m.sat; post.u.warm.value.copy(m.warm); post.u.glow.value = m.glow;
  lampNight = 1 - k;
  const nsAfter = () => { if (!NSW) return; NSW.applyLight({ el, az, dir: SUN_DIR, sun, hemi, fill, rim, fog: scene.fog, fogColor: FOG }); bodies.sunSprite.visible = false; };
  // 빛 방향: 해가 떠 있으면 해 쪽, 밤에는 높은 달빛
  const sd = sunDir(el, az);
  if (el > 2) SUN_DIR.copy(sd); else SUN_DIR.set(0.3, 0.85, 0.35).normalize().lerp(sd.clone().setY(Math.max(0.08, sd.y)), clamp((el + 6) / 8, 0, 1)).normalize();
  G.sunD.value.copy(SUN_DIR);
  sky.u.sunD.value.copy(sd); sky.u.sunC.value.copy(m.sun); sky.u.glow.value = THREE.MathUtils.smoothstep(el, -8, -2);
  bodies.sunSprite.visible = el > -4;
  bodies.sunSprite.position.copy(sd).multiplyScalar(6200);
  bodies.sunSprite.material.color.copy(mix('#ff8a50', '#fff8e8', clamp(el / 20, 0, 1)));
  const sc = 700 + g * 500; bodies.sunSprite.scale.set(sc, sc, 1);
  bodies.stars.material.opacity = THREE.MathUtils.smoothstep(-el, 6, 14) * 0.85; // 해가 지평선 아래 6° 지나면서 서서히, 14°쯤 다 보임
  nsAfter(); applyWx(el);
  sunState = { el, az, k, golden: g };
  sound.setDaylight?.(k);
}
// 날씨 반영 (#18): 빛·안개·구름·하늘 회색기·풀 흔들림. 밤낮 계산이 끝난 값 위에 얹는다
const wxGray = new THREE.Color();
function applyWx(el) {
  const c = wx.cur, day = THREE.MathUtils.smoothstep(el, -6, 8);
  sun.intensity *= c.light; hemi.intensity *= 0.55 + 0.45 * c.light; fill.intensity *= c.light;
  scene.fog.near *= 0.25 + 0.75 * Math.min(1, c.fog * 1.3); scene.fog.far *= c.fog; G.fogN.value = scene.fog.near; G.fogF.value = scene.fog.far;
  const gr = (col, a) => { const l = (col.r + col.g + col.b) / 3; col.lerp(wxGray.setRGB(l * 0.97, l, l * 1.04), a); };
  gr(FOG, c.gray * 0.8); G.fogC.value.copy(FOG);
  if (NSW) {
    const u = NSW.skyU; gr(u.uTop.value, c.gray); gr(u.uHor.value, c.gray * 0.9); gr(u.uCl.value, c.gray * 0.8); gr(u.uCs.value, c.gray);
    u.uSunCol.value.multiplyScalar(1 - 0.9 * c.gray); NSW.wind.value = c.wind;
    const ch = NSW.sky.clouds.children, n = Math.round(ch.length * c.cover); ch.forEach((m, i) => { m.visible = i < n; });
  }
  void day;
}
wx.onChange(() => { wxT = 0; });
let wxT = 0;
function sunEvent() {
  const t = nowDate().getTime();
  const r = todayTimes.rise?.getTime(), s = todayTimes.set?.getTime();
  if (r && t > r - 25 * 60000 && t < r + 30 * 60000) return 'sunrise';
  if (s && t > s - 30 * 60000 && t < s + 25 * 60000) return 'sunset';
  return null;
}

// ---------- 소품 ----------
const basalt = ['#4a4744', '#5a5550', '#3f3c3a', '#625c55'];
const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...o });
function stoneTexture(lines) {
  const c = document.createElement('canvas'); c.width = 96; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#3b3936'; g.fillRect(0, 0, 96, 256);
  g.fillStyle = '#f3efe2'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 30px sans-serif';
  [...lines[0]].forEach((ch, i) => g.fillText(ch, 48, 28 + i * 36));
  g.font = 'bold 20px sans-serif'; g.fillText(lines[1], 48, 232);
  const t = new THREE.CanvasTexture(c); t.colorSpace = TEXCS;
  return t;
}
// 표지석
const P = spots.photo;
const summitOut = P.out.clone();
const summitTan = new THREE.Vector3(-summitOut.z, 0, summitOut.x);
if (!spots.tutorial) {
  const g = new THREE.Group(); const stoneMat = lam('#3b3936');
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.6, 0.9), [stoneMat, stoneMat, stoneMat, stoneMat, new THREE.MeshLambertMaterial({ map: stoneTexture(P.text) }), stoneMat]);
  body.position.y = 1.8; g.add(body);
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 1.6), lam('#5a5550')); base.position.y = 0.2; g.add(base);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.position.copy(P.stone); g.rotation.y = Math.atan2(summitOut.x, summitOut.z); scene.add(g);
}
const photoSpot = P.stone.clone().addScaledVector(summitTan, 2.2).addScaledVector(summitOut, 0.6); photoSpot.y = height(photoSpot.x, photoSpot.z);
// 벤치
const benchPos = spots.bench.pos, benchOut = spots.bench.out;
{
  const wood = lam('#8a6040'); const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.2, 0.9), wood); seat.position.y = 0.55; g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.7, 0.15), wood); back.position.set(0, 1.0, -0.42); g.add(back);
  [-1.3, 1.3].forEach((x) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.55, 0.8), wood); l.position.set(x, 0.27, 0); g.add(l); });
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.position.copy(benchPos); g.rotation.y = Math.atan2(benchOut.x, benchOut.z); scene.add(g);
}
// 뛰어넘기 연습용 징검돌 (길을 가로질러 낮게)
if (spots.jumpStones) { const J = spots.jumpStones, c = Math.cos(J.dir), s = Math.sin(J.dir), mat = new THREE.MeshToonMaterial({ color: '#56524e', gradientMap: gradHard }), geo = new THREE.DodecahedronGeometry(0.5, 0);
  for (let i = -3; i <= 3; i++) { const x = J.pos.x + c * i * 0.85 + s * Math.sin(i * 2.1) * 0.25, z = J.pos.z - s * i * 0.85 + c * Math.sin(i * 2.1) * 0.25; const st = new THREE.Mesh(geo, mat); st.position.set(x, height(x, z) + 0.12, z); st.rotation.set(i * 1.3, i * 2.2, i * 0.7); st.scale.set(1.1, 0.62 + 0.12 * Math.sin(i * 3), 0.9); st.castShadow = true; st.receiveShadow = true; scene.add(st); } }
// 생태계 · 하르방 · 표지판
const life = createLife({ scene, onToast: (m) => toast(m), rnd, hooks: {}, spots });
life.hooks.dmgMul = () => buff.mul('dmg'); // 식사 버프(#50) 귤 던지기 피해
spots.hareubangs.forEach((h) => life.addHareubang(h.pos, h.heading));
if (!spots.sign.silent) { const sg = buildSign(spots.sign.board); sg.position.copy(spots.sign.pos); sg.rotation.y = spots.sign.rot; scene.add(sg); }

// 소원 돌탑: 바닥 돌 3개 위로 모두의 돌이 쌓임 (한 사람당 돌탑마다 하나, 다시 올리면 맨 위로)
const STACK_MAX = CAIRN.max;
const cairns = [];
const stoneGeo = new THREE.DodecahedronGeometry(0.3, 0);
const stoneMat = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: gradHard });
spots.cairns.forEach((cd, ci) => {
  const g = new THREE.Group(); g.position.copy(cd.pos); scene.add(g);
  let y = 0;
  [1.0, 0.82, 0.66].forEach((s, i) => { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), lam(basalt[i])); m.scale.y = 0.55; m.rotation.y = i * 1.3; m.position.y = y + s * 0.5; y += s * 0.8; m.castShadow = true; m.receiveShadow = true; g.add(m); });
  const im = new THREE.InstancedMesh(stoneGeo, stoneMat, STACK_MAX);
  im.count = 0; im.castShadow = false; im.frustumCulled = false; g.add(im);
  cairns.push({ ...cd, group: g, base: y, im, count: 0, drop: 0, lean: ci * 2.1 + 0.7, n: 0, P: new Float32Array(STACK_MAX * 3), Q: new Float32Array(STACK_MAX * 4), S: new Float32Array(STACK_MAX), C: new Uint8Array(STACK_MAX), stride: 0 });
});
const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), eul = new THREE.Euler(), colr = new THREE.Color(), tv = new THREE.Vector3(), ts = new THREE.Vector3();
function layoutCairn(c) {
  const list = social.stones.get(c.id) || [];
  const n = Math.min(STACK_MAX, list.length);
  let y = c.base;
  const cx = Math.cos(c.lean), cz = Math.sin(c.lean);
  for (let i = 0; i < n; i++) {
    const e = list[list.length - n + i];
    const s = (0.85 + ((i * 37) % 10) / 30) * CAIRN.stoneSize;
    const h = y - c.base;
    // 위로 갈수록 한쪽으로 휘고 살짝 흔들림
    const bend = Math.pow(h / CAIRN.bendH, 1.5) * CAIRN.bend, sway = Math.sin(h * 0.9 + c.lean) * 0.07 * Math.min(1, h / 2);
    const jx = Math.sin(i * 2.4) * 0.07, jz = Math.cos(i * 2.4) * 0.07;
    eul.set(0.2 * Math.sin(i * 1.7), i * 2.1, 0.2 * Math.cos(i * 1.3)); q.setFromEuler(eul);
    c.P[i * 3] = cx * bend - cz * sway + jx; c.P[i * 3 + 1] = y + 0.13 * s; c.P[i * 3 + 2] = cz * bend + cx * sway + jz;
    c.Q[i * 4] = q.x; c.Q[i * 4 + 1] = q.y; c.Q[i * 4 + 2] = q.z; c.Q[i * 4 + 3] = q.w;
    c.S[i] = s; c.C[i] = e.mine ? 255 : i % 4;
    y += CAIRN.step * s / CAIRN.stoneSize;
  }
  c.n = n; c.stride = 0; c.top = y; c.count = list.length;
  fillCairn(c, 1);
}
const mineCol = new THREE.Color('#c9b48a');
const basaltCols = basalt.map((b) => new THREE.Color(b));
// 먼 돌탑은 돌을 건너뛰어 크게 그려 단순하게 (stride 1 = 전부)
function fillCairn(c, stride) {
  if (c.stride === stride) return;
  c.stride = stride;
  let k = 0;
  const big = stride > 1 ? 1 + (stride - 1) * 0.45 : 1;
  for (let i = 0; i < c.n; i += stride) {
    q.set(c.Q[i * 4], c.Q[i * 4 + 1], c.Q[i * 4 + 2], c.Q[i * 4 + 3]);
    const s = c.S[i] * big;
    mtx.compose(tv.set(c.P[i * 3], c.P[i * 3 + 1], c.P[i * 3 + 2]), q, ts.set(s, s * 0.6 * (stride > 1 ? stride * 0.7 : 1), s));
    c.im.setMatrixAt(k, mtx);
    c.im.setColorAt(k, c.C[i] === 255 ? mineCol : basaltCols[c.C[i]]); k++;
  }
  c.im.count = k; c.im.instanceMatrix.needsUpdate = true; if (c.im.instanceColor) c.im.instanceColor.needsUpdate = true;
}
let cairnLodT = 0;
function tickCairnLod(dt) {
  cairnLodT -= dt; if (cairnLodT > 0) return; cairnLodT = 0.5;
  cairns.forEach((c) => { if (!c.n) return; const d = Math.hypot(camera.position.x - c.pos.x, camera.position.z - c.pos.z); fillCairn(c, d > CAIRN.farD ? (LOW ? 5 : 3) : 1); });
}

// ---------- 사물 충돌 (#15, 남송이만) ----------
const col = NSW ? createCollide() : null;
if (col) {
  NSW.solids.forEach(([x, z, r]) => col.add(x, z, r));
  spots.hareubangs.forEach((h) => col.add(h.pos.x, h.pos.z, 0.75));
  spots.cairns.forEach((c) => col.add(c.pos.x, c.pos.z, 1.0));
  (spots.lamps || []).forEach(([x, z]) => col.add(x, z, 0.2));
  { const a = Math.atan2(P.out.x, P.out.z); col.addBox(P.stone.x, P.stone.z, a, 1.3, 0.8); }
  col.addBox(spots.bench.pos.x, spots.bench.pos.z, Math.atan2(spots.bench.out.x, spots.bench.out.z), 1.6, 0.4, 0, -0.2);
  if (!spots.sign.silent) { const r = spots.sign.rot; [-1.3, 1.3].forEach((u) => col.add(spots.sign.pos.x + Math.cos(r) * u - Math.sin(r) * 0.1, spots.sign.pos.z - Math.sin(r) * u - Math.cos(r) * 0.1, 0.25)); }
  if (spots.cleanhouse) { const c = spots.cleanhouse; col.addBox(c.x, c.z, c.rot, 3.6, 1.4); col.addBox(c.x, c.z, c.rot, 0.95, 0.55, 3.6 + 2.6 + 0, 0.6); }
}
// ---------- 현무암 돌담 경계 (#25, 남송이만) ----------
const wallPl = { value: new THREE.Vector3() };
const STREAM_LINE = NSW && spots.tut?.stream ? NSB.crossLine(TUT.streamD) : null, STREAM_X = STREAM_LINE ? streamCross(STREAM_LINE, NSB.insideBy) : null; // 개울이 돌담 밑을 지나는 곳 (#41)
const wall = NSW ? createStoneWall({ scene, height, line: NSB.boundLine, gate: NSB.gate, low: LOW, col, uPl: wallPl, arches: STREAM_X ? STREAM_X.pts : [] }) : null;
// ---------- 들머리(#31): 개울·징검다리·낚시 NPC, 들머리와 오름 사이 돌담·정낭 ----------
const NS_TUT = NSW && spots.tut?.stream ? spots.tut : null;
const stream = NS_TUT ? createStream({ scene, height, groundAt, addWalkable, line: STREAM_LINE, walls: STREAM_X.lats, buildRunner, outfit: DEFAULT_OUTFIT, low: LOW, sound: { splash: () => sound.splash(), reel: (d) => sound.reel(d) } }) : null;
if (stream) { const L = STREAM_LINE; NSW.grass.noStream?.(L.c.x, L.c.z, L.fx, L.fz, TUT.streamW, STREAM_X.lats); }
const jeongReady = () => save.equip.tool >= 2 && save.equip.bag >= 1;
if (stream && col) col.add(stream.npcPos[0], stream.npcPos[1], 0.6); // 낚시 NPC·앉은 바위
const jeong = NS_TUT ? createCrossWall({ scene, height, line: NSB.crossLine(TUT.gateD), low: LOW, col, open: !!save.jeong || !!save.tut?.done || jeongReady() }) : null;
if (jeong && jeong.isOpen && !save.jeong) { save.jeong = 1; persist(); }
// 정낭이 열리는 때: 집게·배낭을 둘 다 가졌을 때, 튜토리얼을 마치거나 건너뛰었을 때. 한 번 열리면 계속 열림
function openJeong(anim = true) { if (!jeong || !jeong.open(anim)) return; save.jeong = 1; persist(); if (anim) sound.gate?.(); }
// ---------- 가게 거리 (#57): 길 왼쪽 골목, 터 6개. 가게는 balance.js SHOPS 한 줄 + shops.js SHOP_BUILD. 충돌을 쓰레기 더미보다 먼저 등록 ----------
const street = NS_TUT ? createShopStreet({ scene, height, street: STREET, low: LOW, col }) : null;
const shopsBuilt = street ? SHOPS.filter((sh) => STREET.lot(sh.lot) && SHOP_BUILD[sh.id]).map((sh) => ({ ...sh, ...SHOP_BUILD[sh.id]({ scene, height, lot: STREET.lot(sh.lot), low: LOW, col, addWalkable }) })) : [];
const STN = shopsBuilt.find((sh) => sh.id === 'stone')?.api || null; // 레스토랑 스톤 (#50)
const SAL = shopsBuilt.find((sh) => sh.id === 'salon')?.api || null; // 루이네 미장원 (#58)
const LEAPB = shopsBuilt.find((sh) => sh.id === 'leap')?.api || null; // LEAP (#59): 있으면 옷·신발은 여기서만 삼
const buff = createBuff({ save, persist, onEnd: (m) => { if (m) { toast('식사 버프가 끝났어요'); tips.event('buffEnd'); } } });
// ---------- 쓰레기 (남송이): 오름 위(사면·능선·굼부리)에만 (#25) ----------
const trash = NSW ? createTrash({ scene, store: createLocalTrashStore({ save, persist, server: serverId() }), height, paths: NSB.oreumPaths, inBounds: NSB.onOreum, low: LOW, fixed: spots.tut?.trash || [], col, origin: spots.cleanhouse, rareMul: () => wearV('hat') }) : null; // 구역마다 쓰레기 더미 (#45)
// 깨끗해진 구역에 꽃과 어린 나무 (#46): 풀 색·꽃·나무·나비·새, 다 핀 구역엔 노루가 돌아오고 몹이 나오지 않음
const bloom = trash ? createBloom({ scene, ns: NSW, trash, height, onPath: (x, z) => surfaceAt(x, z) !== 0, col, low: LOW }) : null;
const bfx = bloom ? createBloomFx({ scene, height, tier: () => (LOW ? 0 : quality.level) }) : null; // 치웠을 때·꽃밭 효과 (#65)
const CH = trash && spots.cleanhouse ? createCleanhouse({ scene, height, ...spots.cleanhouse, low: LOW, trashGeos: trash.geos }) : null;
const chAct = CH && { ch: true, ic: 'dump', label: '버리기', pos: CH.front, r: CLEANHOUSE.r, act: () => dumpBag() };
const shopAct = CH && { ic: 'shop', label: '상점', pos: CH.shopFront, r: CLEANHOUSE.shopR, act: () => openShop('gear') };

// ---------- 러너 ----------
const runner = buildRunner();
runner.apply(save.outfit);
scene.add(runner.root);
const player = {
  pos: spots.start.clone(), heading: spots.startHeading, gait: 0, running: false, speed: 0,
  target: null, onArrive: null, pose: 'move', poseT: 0, strideAcc: 0, steps: 0,
  jumpY: 0, jumpV: 0, air: false, driving: false, handSide: 1, kb: new THREE.Vector3(), yellowUntil: 0, riding: null,
  visY: 0, lapAcc: 0, lapPrevA: null, laps: 0, viewSeen: false,
};
player.pos.y = height(player.pos.x, player.pos.z); player.visY = player.pos.y;
// ---------- HP·쓰러짐·들것 귀환 (#36, 전투 오름만) ----------
const hp = createHp({ scene, height, buildRunner, outfit: DEFAULT_OUTFIT, save, persist, start: spots.start, startHeading: spots.startHeading, enabled: () => isBattle() && sessionOn, regenMul: () => buff.mul('regen') * wearV('socks'), maxMul: () => wearV('top'),
  el: { bar: $('hp-bar'), fill: $('hp-fill'), dim: $('hp-dim'), wait: $('hp-wait'), ring: $('hp-ring'), num: $('hp-num') },
  onDown: () => { closePanels(); if (player.riding) dismountDeer(); if (player.pose === 'sit') standUp(); if (player.pose === 'breath') stopBreath(); ach.emit('down'); },
  onUp: () => tips.event('carried'), // 들것으로 돌아옴 (#66)
});

// ---------- 카메라 ----------
const cam = { yaw: player.heading + Math.PI, pitch: 0.32, dist: 13, mode: 'follow', look: new THREE.Vector3(), pos: new THREE.Vector3() };
const camTarget = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
let camPullT = -1; // 꽃밭 카메라 (#65): 0 부터 camT 초 동안. 조작은 막지 않음
function camPullK() { const T = BLOOM_FX.zone.camT; if (camPullT < 0 || camPullT >= T) return 0; const u = camPullT / T, sm = (x) => x * x * (3 - 2 * x); return u < 0.35 ? sm(u / 0.35) : u > 0.6 ? sm((1 - u) / 0.4) : 1; }
function followCam(dt, snap) {
  const look = player.pos.clone(); look.y = player.visY + 1.6 + (player.riding ? 0.9 : 0);
  const pk = camPullK(), pitch = Math.min(1.25, cam.pitch + pk * BLOOM_FX.zone.camPitch), cp = Math.cos(pitch); // 꽃밭이 될 때 잠깐 물러남 (#65)
  const off = new THREE.Vector3(Math.sin(cam.yaw) * cp, Math.sin(pitch), Math.cos(cam.yaw) * cp).multiplyScalar(cam.dist * (1 + pk * BLOOM_FX.zone.camDist));
  const p = look.clone().add(off);
  const gh = height(p.x, p.z) + 1.2;
  if (p.y < gh) { look.y += (gh - p.y) * 0.8; p.y = gh; }
  let lift = 0;
  for (let i = 1; i <= 8; i++) { const t = i / 9; const sx = p.x + (look.x - p.x) * t, sz = p.z + (look.z - p.z) * t; const need = height(sx, sz) + 1.0 - (p.y + (look.y - p.y) * t); if (need > 0) lift = Math.max(lift, need); }
  if (lift > 0) { p.y += lift; look.y += lift * 0.9; }
  const fx = player.pos.x + Math.sin(player.heading) * 6, fz = player.pos.z + Math.cos(player.heading) * 6;
  const rise = height(fx, fz) - player.pos.y;
  if (rise > 0) look.y += Math.min(6, rise * 0.9);
  camTarget.pos.copy(p); camTarget.look.copy(look);
  ease(dt, snap, 8);
}
function ease(dt, snap, k) {
  const a = snap ? 1 : 1 - Math.exp(-dt * k);
  cam.pos.lerp(camTarget.pos, a); cam.look.lerp(camTarget.look, a);
  camera.position.copy(cam.pos); camera.lookAt(cam.look);
}

// ---------- UI 기본 ----------
const ui = { ctx: $('btn-ctx'), toast: $('toast') }; // 위쪽 줄 (#75): 장소·닉네임·걸음·날씨·나침반·조작 안내 문구는 뺌 (걸음은 메뉴에)
// 위쪽 한 줄이 넘치면 단계적으로 줄임 (#75): 1 구역+좌표 하나로, 2 업적 고리는 메뉴로, 3 단위·여백 줄이기. 두 줄이 되지 않게
const topFit = (() => {
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
let toastT = 0;
function toast(msg, sec = 2.8) { ui.toast.textContent = msg; ui.toast.hidden = false; toastT = sec; }
initUiTips({ $, toast, get: { hp: () => hp.hp, hpMax: () => hp.max, bagName: () => (save.equip.bag === 0 ? '호주머니' : '배낭') } }); // #60 UI 누르면 토스트

// ---------- 상황에 맞는 팁 (#66): 표는 tips.js ----------
const tipEl = $('tip'); let tipT = 0, tipNow = null, tipMarkT = 0, tipMarkPos = null;
function showTip(tip) {
  tipNow = tip; tipEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TIP_ICON[tip.ic] || ''}</svg><span>${tip.text}</span>`;
  tipEl.classList.toggle('go', !!tip.go); tipEl.hidden = false; tipT = TIP.sec; sound.beep?.(false);
}
const tips = createTips({ save, persist, show: showTip });
function tipMark(pos) { tipMarkPos = pos; tipMarkT = 6; }
function nearestHeapPos() { if (!trash) return null; let b = null, bd = 1e9; trash.heaps.forEach((h, i) => { if (!(trash.store.left(i) > 0)) return; const d = Math.hypot(h.x - player.pos.x, h.z - player.pos.z); if (d < bd) { bd = d; b = { x: h.x, z: h.z }; } }); return b; }
const TIP_GO = {
  shop: () => openShop(), cleanhouse: () => { if (CH) startAutoGo(); }, dex: () => openDex(),
  heap: () => { const p = nearestHeapPos(); if (p) tipMark(new THREE.Vector3(p.x, groundAt(p.x, p.z), p.z)); },
  stream: () => { const p = tipStreamPos(); if (p) tipMark(new THREE.Vector3(p.x, groundAt(p.x, p.z), p.z)); },
  stone: () => { if (STN?.terrace) tipMark(STN.terrace.clone()); },
};
tipEl.addEventListener('click', () => { const g = tipNow?.go; tipEl.hidden = true; tipT = 0; if (g && TIP_GO[g]) TIP_GO[g](); });
{ const b = $('menu-tips'); const sync = () => b.setAttribute('aria-pressed', String(!tips.isOff())); sync(); b.addEventListener('click', () => { tips.off(!tips.isOff()); sync(); if (tips.isOff()) { tipEl.hidden = true; tipT = 0; } }); } // 메뉴에서 팁 끄기
function tipStreamPos() { if (!stream) return null; const [al, lat] = stream.local(player.pos.x, player.pos.z); const [x, z] = stream.at(stream.centerOff(lat) + 0, Math.max(-20, Math.min(20, lat))); return { x, z, d: Math.hypot(x - player.pos.x, z - player.pos.z) }; }
let tipIdle = 0, tipBagN = -1;
function tipState() {
  const full = !!trash && bagRoom() < 1, sp = tipStreamPos();
  return {
    busy: !!(tut.active) || !$('toast').hidden || !tipEl.hidden || mealS.on || cutS.on || panelOpen() || cam.mode === 'wardrobe' || !sessionOn || document.hidden || player.down || (isTouch && false),
    bagFull: full, bagTier: save.equip.bag, canBuy: !!trash && canBuyGear().length > 0,
    hpLow: isBattle() && hp.hp / hp.max < 0.4, enemyNear: life.enemies.near(player.pos, 25) || (!!dumpers && dumpers.list.some((d) => Math.hypot(d.pos.x - player.pos.x, d.pos.z - player.pos.z) < 25)),
    battle: isBattle(), hasBow: weaponNow().id === 'bow', idle: tipIdle,
    nearStream: !!sp && sp.d < 8 && !fishing?.busy && !stream.onBridge(player.pos.x, player.pos.z),
  };
}
function tickTips(dt) {
  const n = trash ? trash.store.pickedCount() : 0;
  if (n !== tipBagN) { tipBagN = n; tipIdle = 0; } else if (!panelOpen() && !tut.active) tipIdle += dt;
  if (tipT > 0) { tipT -= dt; if (tipT <= 0) tipEl.hidden = true; }
  if (tipMarkT > 0) { tipMarkT -= dt; if (tipMarkT <= 0 || (tipMarkPos && player.pos.distanceTo(tipMarkPos) < 6)) { tipMarkT = 0; tipMarkPos = null; } }
  tips.update(dt, tipState);
}let lastCoins = -1;
function updateStats() {
  if (save.coins !== lastCoins) { const grow = lastCoins >= 0 && String(save.coins).length !== String(lastCoins).length; lastCoins = save.coins; const c = String(save.coins); $('coins').textContent = c; if (grow) topFit.dirty(); $('m-coins').textContent = c; $('shop-coins').textContent = c; $('ach-coins').textContent = c; }
}
function addCoins(n, why) { save.coins = Math.max(0, save.coins + n); persist(); updateStats(); if (why) toast(`${why} · 귤 ${n > 0 ? '+' : ''}${n}`); if (n > 0) { sound.coin?.(); const g = document.querySelector('.gyul'); g.classList.remove('bump'); void g.offsetWidth; g.classList.add('bump'); } }
const PANELS = ['shop', 'sign', 'wishes', 'chat', 'actions', 'menu', 'ach', 'dex', 'maps', 'feedback', 'notes', 'server', 'shoppop'];
const panelOpen = () => PANELS.some((id) => !$(id).hidden);
const busy = () => ['sit', 'photo', 'photo-wait', 'breath', 'crouch'].includes(player.pose) || cam.mode === 'wardrobe' || lookS.open || panelOpen() || !!player.rescue || hp.isDown || hp.pending;
function closePanels() { PANELS.forEach((id) => { $(id).hidden = true; }); }
function cancelAll() {
  closePanels();
  if (player.pose === 'dance') player.pose = 'move';
  if (player.pose === 'breath') stopBreath();
  if (player.pose === 'sit') standUp();
  if (cam.mode === 'wardrobe') closeWardrobe();
  player.target = null; player.onArrive = null; marker.visible = false;
}
// 닫기 버튼과 바깥 누르면 닫기
[['shoppop-close', 'shoppop'], ['shop-close', 'shop'], ['sign-close', 'sign'], ['wish-close', 'wishes'], ['ach-close', 'ach'], ['dex-close', 'dex'], ['maps-close', 'maps'], ['feedback-close', 'feedback'], ['notes-close', 'notes'], ['server-close', 'server'], ['chat-close', 'chat']].forEach(([b, p]) => $(b).addEventListener('click', () => { $(p).hidden = true; }));
['shop', 'sign', 'wishes', 'ach', 'dex', 'maps', 'feedback', 'notes', 'shoppop'].forEach((id) => $(id).addEventListener('pointerdown', (e) => { if (e.target === $(id)) $(id).hidden = true; }));

// ---------- 업적 ----------
const ach = createAchievements({ save, persist, mapId: MAP_ID, onDone: (r) => onAchievement(r) });
let bannerQueue = [], bannerT = 0;
const bIcon = (b) => BADGE_ICONS[b.id] || BADGE_ICONS[b.fam] || '';
function onAchievement(r) {
  sound.fanfare?.();
  if (r.kind === 'daily') bannerQueue.push({ icon: DAILY_ICON, color: '#4f7a36', title: `오늘의 업적 · ${r.def.name}`, sub: `보상 귤 ${r.def.reward}` });
  else if (r.kind === 'badge') bannerQueue.push({ icon: bIcon(r.def), color: r.def.color, title: `뱃지 · ${r.def.name}${r.def.fam ? ` ${r.def.tier}단계` : ''}`, sub: r.def.desc });
  else if (r.kind === 'allday') bannerQueue.push({ icon: ALLDAY_ICON, color: '#8f7bd6', title: '오늘의 업적을 모두 마쳤어요', sub: `모두 마친 날 ${ach.state.allDays}일` });
  refreshAchUI();
}
function tickBanner(dt) {
  if (document.body.classList.contains('tut')) return; // 튜토리얼 중엔 조용히. 보상은 업적 창에 남아 있음
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) { $('banner').hidden = true; document.body.classList.remove('banner-on'); } return; }
  const b = bannerQueue.shift(); if (!b) return;
  $('banner-bdg').innerHTML = iconSvg(b.icon); $('banner-bdg').style.background = b.color;
  $('banner-title').textContent = b.title; $('banner-sub').textContent = b.sub;
  $('banner').hidden = false; document.body.classList.add('banner-on'); bannerT = 4.5;
}
$('banner-go').addEventListener('click', () => { $('banner').hidden = true; document.body.classList.remove('banner-on'); bannerT = 0; openAch(); });
function refreshAchUI() {
  const d = ach.ensureDaily();
  const done = d.items.filter((x) => x.done).length;
  $('ach-count').textContent = `${done}/${d.items.length}`; $('ach-ring').setAttribute('stroke-dasharray', `${(done / Math.max(1, d.items.length) * 56.5).toFixed(1)} 56.5`);
  const un = ach.unclaimed();
  $('ach-dot').hidden = !un; $('ach-dot2').hidden = !un;
  if (!$('ach').hidden) buildAch();
}
function openAch() { closePanels(); buildAch(); $('ach').hidden = false; }
$('ach-chip').addEventListener('click', openAch);
{ const g = $('gyul-pill'); g.addEventListener('click', () => openShop('gear')); g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openShop('gear'); } }); }
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
    if (st && !st.claimed) { const c = document.createElement('button'); c.type = 'button'; c.className = 'chip claim'; c.textContent = `귤 ${b.reward}${b.item ? ' + 아이템' : ''} 받기`; c.addEventListener('click', () => { const got = ach.claim('badge', b.id); if (got) { addCoins(got.reward, `뱃지 ${got.name}`); if (got.item) { save.owned[got.item] = 1; persist(); toast(`뱃지 보상 아이템이 옷장에 들어왔어요`); } } refreshAchUI(); buildAch(); }); el.append(c); }
    bl.append(el);
  });
}

// ---------- 쓰레기 도감 (#13) ----------
function openDex() { closePanels(); buildDex(); $('dex').hidden = false; }
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
function onDexGet(dex, isNew) {
  if (dex.rare) tips.event('rare');
  if (isNew) { ach.emit('dex'); if (dex.rare) addCoins(DEX.rareGyul, `드문 것! ${dex.name} · 도감 등록`); else toast(`도감 · ${dex.name}`); }
  else if (dex.rare) addCoins(DEX.rareGyul, `드문 것! ${dex.name}`);
  if (!$('dex').hidden) buildDex();
}

// ---------- 입력 ----------
const keys = new Set();
const ptrs = new Map();
let dragMoved = false, pinchD = 0;
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  if (document.activeElement && document.activeElement !== document.body && document.activeElement !== canvas) document.activeElement.blur();
  canvas.focus({ preventScroll: true });
  closePanelsSoft();
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
  if (ptrs.size === 1) dragMoved = false;
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinchD = Math.hypot(a.x - b.x, a.y - b.y); dragMoved = true; }
});
function closePanelsSoft() { ['actions', 'menu'].forEach((id) => { $(id).hidden = true; }); }
canvas.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 1) {
    if (Math.hypot(p.x - p.sx, p.y - p.sy) > 8) dragMoved = true;
    if (dragMoved && cam.mode !== 'photo') { cam.yaw -= dx * 0.006; cam.pitch = clamp(cam.pitch + dy * 0.004, -0.6, 1.25); camHold = 1.5; }
  } else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchD > 0) cam.dist = clamp(cam.dist * (pinchD / d), 4, 40);
    pinchD = d;
  }
});
const endPtr = (e) => {
  const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId);
  if (p && !dragMoved && ptrs.size === 0 && e.type === 'pointerup' && !joy.active) tapGround(e.clientX, e.clientY); // 조이스틱을 잡은 채 화면을 톡 친 건 목적지 아님
};
canvas.addEventListener('pointerup', endPtr);
canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.dist = clamp(cam.dist * (1 + Math.sign(e.deltaY) * 0.1), 4, 40); }, { passive: false });
let camHold = 0;

// 조이스틱 (터치)
const joy = { active: false, id: null, x: 0, y: 0, cx: 0, cy: 0 };
{
  const el = $('joy'), knob = $('joy-knob');
  const R = 46;
  const setKnob = () => { knob.style.transform = `translate(${joy.x * R}px, ${joy.y * R}px)`; };
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); const r = el.getBoundingClientRect(); joy.cx = r.left + r.width / 2; joy.cy = r.top + r.height / 2; joy.active = true; joy.id = e.pointerId; move(e); closePanelsSoft(); });
  const move = (e) => { if (!joy.active || e.pointerId !== joy.id) return; let dx = (e.clientX - joy.cx) / R, dy = (e.clientY - joy.cy) / R; const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; } joy.x = dx; joy.y = dy; setKnob(); };
  el.addEventListener('pointermove', move);
  const end = (e) => { if (e.pointerId !== joy.id) return; joy.active = false; joy.id = null; joy.x = joy.y = 0; setKnob(); };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

// 멀티터치 (#42): 화면의 손가락은 pointerId 로 따로 추적한다 — 조이스틱(joy.id), 시점·핀치(ptrs: 캔버스에 닿은 손가락만), 버튼(각 버튼이 자기 손가락만 캡처).
// 패드 버튼은 손가락이 닿는 순간(pointerdown) 반응. click 은 한 손가락 탭에서만 생겨서(iOS 사파리 등) 조이스틱을 잡은 채로는 버튼이 안 눌렸음
function pressBtn(el, fn) {
  el.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button) return; e.preventDefault(); fn(e); });
  el.addEventListener('click', (e) => { if (e.detail === 0) fn(e); }); // 키보드(Enter·Space)·.click()
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
// 게임 화면(캔버스·조이스틱·패드)에서는 브라우저 기본 터치 동작(스크롤·두 번 탭 확대·길게 눌러 메뉴·핀치 확대)을 막는다. 패널 안 스크롤은 그대로
{
  const GAME = '#view, #joy, .pad';
  const block = (e) => { if (e.target instanceof Element && e.target.closest(GAME)) e.preventDefault(); };
  document.addEventListener('touchstart', block, { passive: false });
  document.addEventListener('touchmove', block, { passive: false });
  for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, (e) => e.preventDefault()); // iOS 사파리 페이지 핀치 확대
}

const ray = new THREE.Raycaster();
const marker = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.8, 12), new THREE.MeshBasicMaterial({ color: '#fff6c8', transparent: true, opacity: 0.9, depthWrite: false }));
marker.rotation.x = -Math.PI / 2; marker.visible = false; scene.add(marker);
function tapGround(x, y) {
  if (busy()) return;
  ray.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
  const hit = ray.intersectObject(terrain, false)[0];
  if (!hit) return;
  setTarget(hit.point, null);
}
function setTarget(p, onArrive) {
  player.target = p.clone(); player.onArrive = onArrive;
  marker.position.set(p.x, height(p.x, p.z) + 0.15, p.z); marker.visible = !onArrive;
}
const CODE2KEY = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', ArrowUp: 'arrowup', ArrowDown: 'arrowdown', ArrowLeft: 'arrowleft', ArrowRight: 'arrowright', Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', KeyT: 't', KeyF: 'f', Enter: 'enter', KeyR: 'r', ShiftLeft: 'shift', ShiftRight: 'shift', KeyE: 'e', Space: ' ', Escape: 'escape', KeyQ: 'q' };
const keyOf = (e) => CODE2KEY[e.code] || e.key.toLowerCase();
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const k = keyOf(e);
  keys.add(k);
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { if (k.startsWith('arrow')) e.preventDefault(); }
  if (e.repeat) return;
  if (k === '1') doWave();
  if (k === '2') startBreath();
  if (k === '3') doDance();
  if (k === 'enter') { e.preventDefault(); openChat(); }
  if (k === 'r' || k === 'shift') cycleSpeed();
  if (k === 'f') doInteract(); // 상호작용 (#34). 줍기(E)는 tickPick 이 누르고 있는 동안 처리
  if (k === 'e') startPick();
  if (k === ' ') { e.preventDefault(); doJump(); }
  if (k === 'escape') cancelAll();
});
addEventListener('keyup', (e) => { keys.delete(keyOf(e)); keys.delete(e.key.toLowerCase()); });
addEventListener('blur', () => keys.clear());

// ---------- 속도·체력 ----------
const GAIT = ['걷기', '달리기'];
function setGait(g) {
  player.gait = g; player.running = g >= 1;
  $('btn-speed').dataset.g = String(g); $('speed-label').textContent = GAIT[g];
}
function cycleSpeed() { tut.notify('gait'); setGait((player.gait + 1) % 2); }
pressBtn($('btn-speed'), cycleSpeed);

// ---------- 동작 ----------
$('btn-actions').addEventListener('click', () => { const a = $('actions'); const open = a.hidden; closePanels(); a.hidden = !open; });
$('btn-menu').addEventListener('click', () => { const a = $('menu'); const open = a.hidden; closePanels(); a.classList.remove('more'); $('m-steps').textContent = player.steps.toLocaleString('ko-KR'); $('ach-dot3').hidden = $('ach-dot').hidden; a.hidden = !open; });
$('menu-more').addEventListener('click', () => $('menu').classList.toggle('more'));
// 처음부터 다시(#33): 2초 꾹 누르면 이 기기의 저장을 지움. 닉네임·그래픽·소리 설정은 남김 (돌탑의 돌은 서버에 있어 그대로)
{
  const b = $('menu-reset'), HOLD = 2000; let t0 = 0, raf = 0;
  const stop = () => { t0 = 0; cancelAnimationFrame(raf); b.style.setProperty('--p', 0); };
  const doReset = () => {
    resetting = true; // 이후 persist 가 옛 저장을 되쓰지 않게
    const keep = { nick: save.nick, gfx: save.gfx, gfxV3: save.gfxV3, introSound: save.introSound, music: save.music, reset: 1 }; // reset: 처음 온 사람처럼 시작
    for (const k of Object.keys(keep)) if (keep[k] === undefined) delete keep[k];
    try { localStorage.setItem(KEY, JSON.stringify(keep)); } catch (e) { /* 저장 불가 환경 */ }
    location.reload();
  };
  const tick = () => { if (!t0) return; const p = Math.min(1, (performance.now() - t0) / HOLD); b.style.setProperty('--p', p); if (p >= 1) { t0 = 0; doReset(); } else raf = requestAnimationFrame(tick); };
  b.addEventListener('pointerdown', (e) => { if (e.button) return; e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (_) { /* 무시 */ } t0 = performance.now(); raf = requestAnimationFrame(tick); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, stop);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  b.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !t0) { e.preventDefault(); t0 = performance.now(); raf = requestAnimationFrame(tick); } });
  b.addEventListener('keyup', stop); b.addEventListener('blur', stop);
}
// 개발자 버튼 (#43): ?hwi=1 로 한 번 들어오면 이 기기에 기억, ?hwi=0 으로 끔. 저장 키를 따로 써서 리셋해도 남음
{
  const HK = 'oreumoreum.hwi'; let on = false;
  try { const q = new URLSearchParams(location.search).get('hwi'); if (q === '1') localStorage.setItem(HK, '1'); else if (q === '0') localStorage.removeItem(HK); on = localStorage.getItem(HK) === '1'; } catch (e) { /* 저장 불가 환경 */ }
  $('m-dev').hidden = !on;
  if (on) {
    const TK = 'oreumoreum.hwi.tod'; // 시간대 (이 화면에만, 새로 고쳐도 유지)
    const tv = $('adm-tv'), sl = $('adm-tod');
    const setTod = (h) => {
      todOverride = h == null ? null : Math.min(24, Math.max(0, h));
      try { if (todOverride == null) localStorage.removeItem(TK); else localStorage.setItem(TK, String(todOverride)); } catch (e) { /* 무시 */ }
      tv.textContent = todOverride == null ? '실제' : `${String(Math.floor(todOverride)).padStart(2, '0')}:${String(Math.round((todOverride % 1) * 60)).padStart(2, '0')}`;
      if (todOverride != null) sl.value = todOverride;
      applySky();
    };
    try { const v = parseFloat(localStorage.getItem(TK)); if (Number.isFinite(v)) setTod(v); } catch (e) { /* 무시 */ }
    sl.addEventListener('input', () => setTod(parseFloat(sl.value)));
    $('adm-body').querySelectorAll('[data-h]').forEach((b) => b.addEventListener('click', () => setTod(parseFloat(b.dataset.h))));
    $('adm-real').addEventListener('click', () => setTod(null));
    $('adm-body').querySelectorAll('[data-wx]').forEach((b) => b.addEventListener('click', () => { wx.set(b.dataset.wx || null); toast('날씨: ' + WX[wx.kind].name); }));
    $('adm-toggle').addEventListener('click', () => { const h = !$('adm-body').hidden; $('adm-body').hidden = h; $('adm-toggle').setAttribute('aria-expanded', String(!h)); });
    let rc = 0;
    $('dev-reset').addEventListener('click', () => {
      if (!rc) { rc = 1; $('dev-reset').textContent = '정말 지울까요? 한 번 더'; setTimeout(() => { rc = 0; $('dev-reset').textContent = '모두 리셋'; }, 4000); return; }
      resetting = true;
      try { localStorage.setItem(KEY, JSON.stringify({ reset: 1 })); localStorage.removeItem(TK); } catch (e) { /* 무시 */ }
      location.reload();
    });
    $('dev-tut').addEventListener('click', () => { tut.skipAll(); toast('튜토리얼 건너뛰기'); }); // #62 건너뛰기는 개발자 버튼에만
    $('dev-gyul').addEventListener('click', () => { save.coins += 10000; persist(); updateStats(); sound.coin?.(); toast('귤 +10,000'); }); // 업적·귤 벌기 기록에는 안 셈
  }
}
$('menu-ach').addEventListener('click', () => openAch());
$('menu-sound').addEventListener('click', () => { if (sound.on) sound.stop(); else sound.start(); setSoundUI(); }); // 소리는 메뉴 안에서만 (#75)
// 배경 음악 켜기/끄기·크기 (#64). save.music = { on, vol }
$('menu-music').addEventListener('click', () => { save.music.on = save.music.on ? 0 : 1; sound.setMusic(save.music.on); if (save.music.on && !sound.on) sound.start(); setSoundUI(); persist(); });
$('music-vol').addEventListener('input', (e) => { save.music.vol = Math.round(+e.target.value) / 100; sound.setMusicVol(save.music.vol); if (save.music.vol > 0 && !save.music.on) { save.music.on = 1; sound.setMusic(1); } setSoundUI(); });
$('music-vol').addEventListener('change', () => persist());
$('act-chat').addEventListener('click', () => openChat());
function doWave() {
  if (busy()) return;
  player.target = null; marker.visible = false;
  player.pose = 'wave'; player.poseT = 0;
  player.heading = Math.atan2(camera.position.x - player.pos.x, camera.position.z - player.pos.z);
}
function doDance() {
  if (busy()) return;
  player.target = null; marker.visible = false;
  player.pose = player.pose === 'dance' ? 'move' : 'dance'; player.poseT = 0;
  if (player.pose === 'dance' && spots.isViewpoint(player.pos)) ach.emit('dance-top');
}
$('act-wave').addEventListener('click', () => { closePanels(); doWave(); });
$('act-dance').addEventListener('click', () => { closePanels(); doDance(); });
$('act-breath').addEventListener('click', () => { closePanels(); startBreath(); });

// 귤 던지기 (#34): 상호작용 버튼(F)으로, 할 일이 없을 때. 손으로 던지기는 무료라 가진 귤이 줄지 않음
// 자동 조준: 사거리 안 가장 가까운 대상(적·하르방)을 겨눠 몸을 돌려 던지고, 대상 발밑에 표시. 없으면 보는 방향으로
let throwPending = false, throwAim = null;
// 무기 (#38): 전투 오름에서 귤 활을 샀으면 F 로 활을 쏨. 깨끗한 오름·말 탄 동안은 손 던지기
const weaponNow = () => WEAPONS[(isBattle() ? save.equip.weapon : 1) - 1] || WEAPONS[0];
const bowReady = () => weaponNow().id === 'bow' && !player.riding;
const bowArmed = () => bowReady() && (save.bowAmmo > 0 || save.coins > 0); // 귤이 0이고 남은 화살도 없으면 손 던지기
function setHoldBow(v) {
  if (holdBow === v) return; holdBow = v;
  syncEquipGear(); runner.apply(save.outfit); net.send(true);
}
const aimFwd = new THREE.Vector3();
function aimTarget() {
  let best = null, bd = bowArmed() ? weaponNow().range : THROW_AIM.range;
  // 화면 가운데에 가까운 쪽을 우선: 카메라 앞쪽과 이루는 각이 클수록 거리를 더 먼 것으로 침
  camera.getWorldDirection(aimFwd); const fl = Math.hypot(aimFwd.x, aimFwd.z) || 1;
  let bs = Infinity;
  for (const t of life.aimTargets()) {
    const dx = t.pos.x - player.pos.x, dz = t.pos.z - player.pos.z, d = Math.hypot(dx, dz); if (d >= bd) continue;
    const cos = (dx * aimFwd.x + dz * aimFwd.z) / (Math.max(d, 0.01) * fl), sc = d * (1.6 - 0.6 * cos);
    if (sc < bs) { bs = sc; best = t; }
  }
  return best;
}
const aimHeading = (t) => Math.atan2(t.pos.x - player.pos.x, t.pos.z - player.pos.z);
function throwTangerine() {
  if (busy() || player.pose === 'wave' || player.pose === 'throw' || player.pose === 'bow') return;
  throwAim = player.riding ? null : aimTarget();
  if (player.riding) { releaseTangerine(); return; }
  player.target = null; player.onArrive = null; marker.visible = false;
  player.pose = 'throw'; player.poseT = 0; throwPending = true; sound.beep(false);
}
// 손이 앞으로 뻗는 순간 손 위치에서 귤이 떠난다
function releaseTangerine() {
  throwPending = false;
  const t = throwAim; throwAim = null;
  let dir = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
  let from = player.pos.clone().addScaledVector(dir, 0.6); from.y += 1.4 + player.jumpY + (player.riding ? 0.95 : 0);
  if (!player.riding) { const arm = runner.root.userData.parts?.armR; if (arm) { runner.root.updateMatrixWorld(true); const h = arm.localToWorld(new THREE.Vector3(0, -0.5, 0)); if (isFinite(h.x + h.y + h.z)) from = h; } }
  const peers = () => [...[...net.peersById.values()].map((e) => ({ id: e.peer, pos: e.pos }))];
  const shot = t && aimShot(from, t);
  if (shot) life.throwTangerine(from, shot.dir, shot.vh, peers, shot.vy);
  else life.throwTangerine(from, dir, THROW_AIM.power + (player.running ? THROW_AIM.runBonus : 0), peers);
}
// 손 위치에서 대상의 겨눌 점까지 포물선(중력 22)으로 닿는 속도. 움직이는 대상은 날아가는 동안 갈 곳을 미리 겨눔
function aimShot(from, t) {
  const aim = new THREE.Vector3(t.pos.x, t.pos.y + t.h, t.pos.z);
  let vh = THROW_AIM.power, k = THROW_AIM.k;
  for (let i = 0; i < 2; i++) {
    const p = aim.clone();
    if (t.vel && i) p.addScaledVector(t.vel, THROW_AIM.lead * Math.hypot(aim.x - from.x, aim.z - from.z) / vh);
    const dx = p.x - from.x, dz = p.z - from.z, D = Math.hypot(dx, dz), dy = p.y - from.y;
    if (D < 0.5) return null;
    k = Math.min(THROW_AIM.kMax, Math.max(THROW_AIM.k, (dy + 0.25 * D) / D));
    const den = k * D - dy; if (den <= 0.05) return null;
    vh = Math.min(THROW_AIM.vMax, Math.max(THROW_AIM.vMin, Math.sqrt(11 * D * D / den)));
    if (i === 1 || !t.vel) return { dir: new THREE.Vector3(dx / D, 0, dz / D), vh, vy: k * vh };
  }
  return null;
}
// 귤 활 쏘기 (#38): 5발에 귤 1개. 남은 화살이 없으면 귤 하나를 써서 채움
let bowPending = false;
function fireWeapon() { if (bowArmed()) shootBow(); else throwTangerine(); }
function shootBow() {
  if (busy() || player.pose === 'wave' || player.pose === 'throw' || player.pose === 'bow') return;
  const w = weaponNow();
  if (save.bowAmmo <= 0) { if (save.coins < 1) { throwTangerine(); return; } save.coins -= 1; save.bowAmmo = w.perGyul; updateStats(); ammoFlash = 1; }
  save.bowAmmo -= 1; persist(); updateAmmo();
  setHoldBow(true);
  throwAim = aimTarget();
  player.target = null; player.onArrive = null; marker.visible = false;
  player.pose = 'bow'; player.poseT = 0; bowPending = true;
}
function releaseArrow() {
  bowPending = false;
  const t = throwAim; throwAim = null;
  const w = weaponNow(), fwd = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
  let from = player.pos.clone().addScaledVector(fwd, 0.7); from.y += 1.45 + player.jumpY;
  { const arm = runner.root.userData.parts?.armL; if (arm) { runner.root.updateMatrixWorld(true); const h = arm.localToWorld(new THREE.Vector3(0, -0.5, 0)); if (isFinite(h.x + h.y + h.z)) from = h.addScaledVector(fwd, 0.25); } }
  const peers = () => [...net.peersById.values()].map((e) => ({ id: e.peer, pos: e.pos }));
  const vel = (t && arrowShot(from, t, w)) || fwd.clone().multiplyScalar(w.speed).setY(w.grav * 0.12);
  life.shootArrow(from, vel, { dmg: w.dmg * buff.mul('dmg'), grav: w.grav, peersFn: peers });
  sound.bow?.();
}
// 거의 곧게 날아가는 화살: 날아갈 시간만큼 중력과 대상의 움직임을 미리 셈
function arrowShot(from, t, w) {
  const aim = new THREE.Vector3(t.pos.x, t.pos.y + t.h, t.pos.z), p = aim.clone();
  let T = 0;
  for (let i = 0; i < 2; i++) {
    p.copy(aim); if (t.vel) p.addScaledVector(t.vel, T);
    const D = Math.hypot(p.x - from.x, p.z - from.z); if (D < 0.3) return null;
    T = D / w.speed;
  }
  return new THREE.Vector3((p.x - from.x) / T, (p.y - from.y) / T + 0.5 * w.grav * T, (p.z - from.z) / T);
}
// 남은 화살 표시: 상호작용 버튼 위 작은 점 5개 (활을 쓸 때만)
let ammoFlash = 0, ammoKey = '';
function updateAmmo() {
  const el = $('ammo'); if (!el) return;
  const on = bowReady(), n = save.bowAmmo, key = `${on}|${n}|${save.coins > 0}`;
  if (key === ammoKey) return; ammoKey = key;
  el.hidden = !on; if (!on) return;
  el.classList.toggle('empty', n <= 0 && save.coins <= 0);
  el.innerHTML = Array.from({ length: weaponNow().perGyul }, (_, i) => `<b class="${i < n ? 'on' : ''}"></b>`).join('');
  if (ammoFlash) { ammoFlash = 0; el.classList.remove('use'); void el.offsetWidth; el.classList.add('use'); }
}
// 겨눈 대상 발밑 표시
const aimMark = new THREE.Mesh(new THREE.RingGeometry(0.78, 1, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff8a1f', transparent: true, opacity: 0.85, depthWrite: false }));
aimMark.visible = false; aimMark.renderOrder = 3; scene.add(aimMark);
const aimTri = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 3).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: '#ff8a1f', depthTest: false, transparent: true }));
aimTri.visible = false; aimTri.renderOrder = 9; scene.add(aimTri);
function tickAimMark(time) {
  const t = throwAim || (!player.riding && isBattle() ? aimTarget() : null) || (ctxTarget === throwAct ? aimTarget() : null);
  aimMark.visible = aimTri.visible = !!t;
  if (!t) return;
  const s = t.size * THROW_AIM.mark * (1 + Math.sin(time * 6) * 0.08);
  aimMark.scale.set(s, 1, s); aimMark.position.set(t.pos.x, height(t.pos.x, t.pos.z) + 0.08, t.pos.z); aimMark.rotation.y = time * 1.5;
  aimTri.position.set(t.pos.x, t.pos.y + (t.h || 0.8) * 2 + 0.9 + Math.sin(time * 6) * 0.1, t.pos.z); aimTri.rotation.y = time * 2;
}
// 화면 밖 가까운 적 방향 표시 (#56): 가장자리에 귤색 세모 + 종류 아이콘, 가까울수록 크고 진하게, 최대 3개
const EDGE_IC = () => ({ boar: '<b>멧</b>', truck: DUMP_IC, target: '<b>◎</b>' }); // target: 튜토리얼 과녁 (#62)
const edgeEls = Array.from({ length: 3 }, (_, i) => { const el = document.createElement('div'); el.className = 'edge-aim'; el.hidden = true; el.setAttribute('aria-hidden', 'true'); document.body.appendChild(el); return el; });
const edgeV = new THREE.Vector3();
function tickEdgeAim() {
  const list = [];
  for (const t of life.aimTargets()) {
    const d = Math.hypot(t.pos.x - player.pos.x, t.pos.z - player.pos.z); if (d > THROW_AIM.edgeRange) continue;
    edgeV.set(t.pos.x, t.pos.y + 1, t.pos.z).project(camera);
    if (edgeV.z < 1 && Math.abs(edgeV.x) < 0.95 && Math.abs(edgeV.y) < 0.95) continue; // 화면 안
    let x = edgeV.x, y = edgeV.y; if (edgeV.z > 1) { x = -x; y = -y; }
    list.push({ t, d, x, y });
  }
  list.sort((a, b) => a.d - b.d);
  const W = innerWidth, H = innerHeight, m = 30;
  edgeEls.forEach((el, i) => {
    const e = list[i]; el.hidden = !e; if (!e) return;
    const k = 1 / Math.max(Math.abs(e.x), Math.abs(e.y), 1e-3), x = e.x * k, y = e.y * k;
    const px = Math.min(W - m, Math.max(m, (x * 0.5 + 0.5) * W)), py = Math.min(H - m, Math.max(topFit.bottom + 72, (-y * 0.5 + 0.5) * H));
    const near = 1 - e.d / THROW_AIM.edgeRange, sc = 0.7 + 0.5 * near, ang = Math.atan2(-e.y, e.x) * 180 / Math.PI + 90;
    el.style.transform = `translate(${px - 22}px, ${py - 22}px) scale(${sc})`; el.style.opacity = String(0.45 + 0.55 * near);
    el.style.setProperty('--a', ang + 'deg');
    const kind = e.t.kind || 'boar'; if (el.dataset.k !== kind) { el.dataset.k = kind; el.innerHTML = '<i></i><span>' + (EDGE_IC()[kind] || '!') + '</span>'; }
  });
}

function openChat() { if (cam.mode === 'wardrobe') return; closePanels(); $('chat').hidden = false; $('chat-input').focus(); }
$('btn-chat').addEventListener('click', openChat);
$('chat-form').addEventListener('submit', (e) => { e.preventDefault(); const v = $('chat-input').value; $('chat-input').value = ''; $('chat').hidden = true; canvas.focus(); if (v.trim()) { social.say(v, runner.root); ach.emit('chat'); } });
$('chat-input').addEventListener('keydown', (e) => { if (e.key === 'Escape') $('chat').hidden = true; });

$('menu-wardrobe').addEventListener('click', () => { closePanels(); openWardrobe(); });
$('menu-shop').addEventListener('click', () => { closePanels(); openShop('gear'); });
$('menu-sign').addEventListener('click', () => { closePanels(); openSign(); });
if (Object.values(MAPS).filter((x) => !x.hidden).length < 2 && MAP_ID === 'namsongi') $('menu-map').hidden = true;
$('menu-map').addEventListener('click', () => { closePanels(); if (MAP_ID === 'gate') toast('갈림길 표지판으로 가서 길을 고르면 돼요'); else leaveTo('gate'); });
$('ver-text').textContent = `v${VERSION}`;
function openNotes() {
  const box = $('notes-body'); box.innerHTML = '';
  RELEASE_NOTES.forEach((n) => {
    const h = document.createElement('h3'); h.textContent = `v${n.v} `; const sm = document.createElement('small'); sm.textContent = n.date; h.append(sm);
    const ul = document.createElement('ul'); n.items.forEach((t) => { const li = document.createElement('li'); li.textContent = t; ul.append(li); });
    box.append(h, ul);
  });
  $('notes').hidden = false;
}
$('intro-notes').addEventListener('click', openNotes);
$('menu-notes').addEventListener('click', () => { closePanels(); openNotes(); });
$('menu-feedback').addEventListener('click', () => { closePanels(); $('feedback').hidden = false; setTimeout(() => $('feedback-input').focus(), 50); });
$('feedback-input').addEventListener('input', () => { $('feedback-len').textContent = `${$('feedback-input').value.length} / 1000`; });
$('feedback-input').addEventListener('keydown', (e) => e.stopPropagation());
$('feedback-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = $('feedback-input').value.trim(); if (!text) return;
  const meta = { map: MAP_ID, ua: navigator.userAgent.slice(0, 160), w: innerWidth, h: innerHeight };
  $('feedback-send').disabled = true;
  const r = await social.sendFeedback(text, meta);
  $('feedback-send').disabled = false;
  if (r === 'ok') { $('feedback-input').value = ''; $('feedback-len').textContent = '0 / 1000'; $('feedback').hidden = true; toast('보냈어요. 고마워요!'); }
  else if (r === 'none') { open(`https://github.com/spaceHWI/oreumoreum/issues/new?title=${encodeURIComponent('[의견] ' + text.slice(0, 40))}&body=${encodeURIComponent(text + '\n\n---\n' + MAP_ID + ' · ' + meta.w + 'x' + meta.h)}`, '_blank'); $('feedback').hidden = true; }
  else toast('보내지 못했어요. 잠시 후 다시 보내 주세요');
});
$('menu-help').addEventListener('click', () => { closePanels(); $('intro').hidden = false; $('intro-help').hidden = false; });

// 노루 타기
function mountDeer(d) {
  if (busy() || player.riding) return;
  life.mount(d); player.riding = d; player.target = null; marker.visible = false;
  d.heading = player.heading; d.pos.y = height(d.pos.x, d.pos.z);
  toast('노루 등에 올라탔어요. 점프 버튼으로 내려요');
  ach.emit('ride');
}
function dismountDeer() {
  const d = player.riding; if (!d) return;
  life.dismount(d); player.riding = null;
  player.pos.copy(d.pos).add(new THREE.Vector3(Math.cos(d.heading), 0, -Math.sin(d.heading)).multiplyScalar(1.2)); player.pos.y = height(player.pos.x, player.pos.z);
  player.speed = 0;
}

// 점프
const GRAV = 26;
function doJump() {
  const p = player;
  if (p.riding) { dismountDeer(); return; }
  if (busy() || p.pose === 'wave' || p.air) return;
  p.air = true; p.jumpV = 8.5; p.jumpY = 0;
  sound.step(surfaceAt(p.pos.x, p.pos.z), true);
  ach.emit('jump'); tut.notify('jump');
}
pressBtn($('btn-jump'), () => doJump());
function tickJump(dt) {
  const p = player; if (!p.air) { p.airOff = null; return; }
  // 공중에서 발밑 디딤판(징검돌·계단) 높이가 바뀌어도 몸 높이는 그대로 (#41: 돌에서 물 위로 뛸 때 툭 내려가던 것)
  const off = groundAt(p.pos.x, p.pos.z) - height(p.pos.x, p.pos.z);
  if (p.airOff != null) p.jumpY += p.airOff - off;
  p.airOff = off;
  p.jumpV -= GRAV * dt; p.jumpY += p.jumpV * dt;
  if (p.jumpY <= 0) { p.jumpY = 0; p.jumpV = 0; p.air = false; p.airOff = null; sound.step(surfaceAt(p.pos.x, p.pos.z), true); }
}

// 호흡
let breathState = null;
function startBreath() {
  if (busy()) return;
  player.target = null; marker.visible = false;
  player.pose = 'breath'; player.poseT = 0;
  breathState = { t: 0, cycle: 0, phase: -1 };
  $('breath').hidden = false;
}
function stopBreath() { breathState = null; $('breath').hidden = true; if (player.pose === 'breath') player.pose = 'move'; }
$('breath-stop').addEventListener('click', stopBreath);
const IN = 4, OUT = 6, CYCLES = 3;
function tickBreath(dt) {
  if (!breathState) return 0;
  const b = breathState; b.t += dt;
  const ct = b.t % (IN + OUT); const cycle = Math.floor(b.t / (IN + OUT));
  if (cycle >= CYCLES) { stopBreath(); toast('숨이 고르게 돌아왔어요'); ach.emit('breath'); return 0; }
  const phase = ct < IN ? 0 : 1;
  if (phase !== b.phase || cycle !== b.cycle) { b.phase = phase; b.cycle = cycle; sound.breath(phase === 0, phase === 0 ? IN : OUT); $('breath-label').textContent = phase === 0 ? '들이쉬고' : '내쉬고'; $('breath-count').textContent = `${cycle + 1} / ${CYCLES}`; }
  const k = phase === 0 ? ct / IN : 1 - (ct - IN) / OUT;
  const e = 0.5 - 0.5 * Math.cos(k * Math.PI);
  $('breath-ring').style.transform = `scale(${0.55 + e * 0.45})`;
  return e;
}

// 앉아 쉬기
function sitDown() {
  setTarget(benchPos.clone().addScaledVector(benchOut, 0.9), () => {
    player.pos.copy(benchPos).addScaledVector(benchOut, 0.05);
    player.heading = Math.atan2(benchOut.x, benchOut.z);
    player.pose = 'sit'; player.poseT = 0; cam.mode = 'sit';
    $('sit-line').textContent = spots.bench.line;
    $('sitbar').hidden = false; document.body.classList.add('sitting');
    ach.emit('sit');
  });
}
function standUp() {
  if (mealS.on) { finishMeal(); return; } // 식사 중이면 건너뛰기 (#50)
  if (cutS.on) { finishCut(); return; } // 머리 깎는 중이면 건너뛰기 (#58)
  player.pose = 'move'; cam.mode = 'follow';
  player.pos.addScaledVector(benchOut, 0.9); player.pos.y = height(player.pos.x, player.pos.z);
  $('sitbar').hidden = true; document.body.classList.remove('sitting');
}
$('btn-stand').addEventListener('click', standUp);

// 소원 돌탑
let wishCairn = null;
function openWishes(c) {
  wishCairn = c; closePanels();
  const list = social.stones.get(c.id) || [];
  const mine = list.find((e) => e.mine);
  $('wish-title').textContent = c.name;
  $('wish-count').textContent = list.length ? `돌 ${list.length}개가 쌓여 있어요. 한 사람당 돌 하나, 다시 올리면 맨 위로 옮겨져요.` : '아직 아무도 돌을 올리지 않았어요. 첫 돌을 올려 보세요.';
  $('wish-submit').textContent = mine ? '맨 위로 다시 올리기' : '돌 올리기';
  $('wish-input').value = mine?.wish || '';
  $('wish-solo').hidden = social.canWrite;
  const box = $('wish-list'); box.innerHTML = '';
  list.slice().reverse().filter((e) => e.wish).slice(0, 40).forEach((e) => {
    const row = document.createElement('div'); row.className = 'wish' + (e.mine ? ' mine' : '');
    const b = document.createElement('b'); b.textContent = e.mine ? '나' : e.nick; const s = document.createElement('span'); s.textContent = e.wish;
    row.append(b, s); box.append(row);
  });
  $('wishes').hidden = false;
}
$('wish-form').addEventListener('submit', (e) => {
  e.preventDefault(); if (!wishCairn) return;
  const c = wishCairn; const wish = $('wish-input').value;
  $('wishes').hidden = true;
  const toMe = player.pos.clone().sub(c.pos).setY(0).normalize();
  setTarget(c.pos.clone().addScaledVector(toMe, 1.8), async () => {
    player.heading = Math.atan2(c.pos.x - player.pos.x, c.pos.z - player.pos.z);
    player.pose = 'crouch'; player.poseT = 0;
    await new Promise((r) => setTimeout(r, 500));
    const had = await social.placeStone(c.id, wish);
    c.drop = 1.2; sound.stone(); setTimeout(() => { if (player.pose === 'crouch') player.pose = 'move'; }, 400);
    toast(had ? '소원을 바꿔 적었어요' : `${c.name}에 돌을 올렸어요`);
    if (!had) ach.emit('stone'); tut.notify('stone');
  });
});

// 표지석 인증샷 (줄서기)
let photoState = null, photoWaiting = false, captureNext = false;
function startPhoto() {
  social.joinQueue();
  const spot = photoSpot.clone().addScaledVector(summitOut, 2.5).addScaledVector(summitTan, -2);
  setTarget(social.queueAhead() > 0 ? spot : photoSpot, () => {
    if (social.queueAhead() > 0) { photoWaiting = true; player.pose = 'photo-wait'; player.poseT = 0; $('queue').hidden = false; return; }
    beginPhoto();
  });
}
function beginPhoto() {
  photoWaiting = false; $('queue').hidden = true;
  player.pos.copy(photoSpot);
  player.heading = Math.atan2(summitOut.x, summitOut.z);
  player.pose = 'photo-wait'; player.poseT = 0;
  cam.mode = 'photo';
  const mid = P.stone.clone().lerp(photoSpot, 0.5);
  camTarget.look.copy(mid).setY(mid.y + 1.7);
  camTarget.pos.copy(mid).addScaledVector(summitOut, 8.5).addScaledVector(summitTan, 0.5);
  camTarget.pos.y = Math.max(mid.y + 2.6, height(camTarget.pos.x, camTarget.pos.z) + 1.5);
  photoState = { t: 0, n: 3 };
  $('countdown').hidden = false; $('countdown').textContent = '3';
  sound.beep(false);
}
$('queue-cancel').addEventListener('click', () => { photoWaiting = false; social.leaveQueue(); $('queue').hidden = true; player.pose = 'move'; });
function tickQueue() {
  if (!photoWaiting) return;
  const n = social.queueAhead();
  $('queue-n').textContent = n > 0 ? `앞에 ${n}명이 있어요 · 차례가 되면 다가가요` : '차례예요';
  if (n === 0) beginPhoto();
}
function tickPhoto(dt) {
  if (!photoState) return;
  photoState.t += dt;
  const n = 3 - Math.floor(photoState.t / 0.9);
  if (n !== photoState.n && n > 0) { photoState.n = n; $('countdown').textContent = String(n); sound.beep(false); }
  if (photoState.t > 2.0 && player.pose !== 'photo') player.pose = 'photo';
  if (photoState.t >= 2.7 && !photoState.shot) { photoState.shot = true; $('countdown').hidden = true; captureNext = true; }
}
function capture() {
  sound.shutter();
  const flash = $('flash'); flash.hidden = false; flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
  const W = 960, src = renderer.domElement;
  const ph = Math.round(W * Math.min(1.25, src.height / src.width));
  const pad = 28, band = 150;
  const out = document.createElement('canvas'); out.width = W + pad * 2; out.height = ph + pad + band;
  const g = out.getContext('2d');
  g.fillStyle = '#fbf6e6'; g.fillRect(0, 0, out.width, out.height);
  const sw = src.width, sh = src.height, targetR = W / ph;
  let cw = sw, ch = sw / targetR; if (ch > sh) { ch = sh; cw = sh * targetR; }
  g.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, pad, pad, W, ph);
  g.strokeStyle = '#33402a'; g.lineWidth = 4; g.strokeRect(pad, pad, W, ph);
  g.fillStyle = '#33402a'; g.font = '700 46px "Noto Sans KR", sans-serif'; g.textBaseline = 'alphabetic';
  g.fillText(P.title, pad, ph + pad + 70);
  g.font = '500 26px "Noto Sans KR", sans-serif';
  const ds = kstDate().replace(/-/g, '.');
  const badges = Object.keys(ach.state.badges).length;
  g.fillText(`${save.nick} · ${ds} · ${player.steps.toLocaleString('ko-KR')}걸음 · 뱃지 ${badges}개`, pad, ph + pad + 116);
  g.textAlign = 'right'; g.fillStyle = '#9c4a33'; g.font = '700 30px "Noto Sans KR", sans-serif';
  g.fillText('오름오름', W + pad, ph + pad + 70);
  out.toBlob((blob) => { $('photo-img').src = URL.createObjectURL(blob); setTimeout(() => { $('photo').hidden = false; }, 350); }, 'image/png');
  ach.emit('photo');
}
$('photo-close').addEventListener('click', () => {
  $('photo').hidden = true; photoState = null; social.leaveQueue();
  player.pose = 'move'; cam.mode = 'follow';
  cam.yaw = Math.atan2(summitOut.x, summitOut.z);
});

// ---------- 함께 (room) ----------
const net = createNet({
  scene, player, save, roomName: () => roomFor('oreum-' + MAP_ID), // 서버별 방 (#35)
  extra: () => social.presenceExtra(),
  onToast: (m) => toast(m),
  onPeersChanged: (n, hand) => {
    $('handreq').hidden = !hand.pendingFrom;
    if (hand.pendingFrom) { const e = net.peersById.get(hand.pendingFrom); $('handreq-who').textContent = e ? e.nick : '러너'; }
    $('btn-release').hidden = !hand.with;
    $('btn-cancelreq').hidden = !hand.req;
    if (hand.with && !player.handDone) { player.handDone = true; ach.emit('hand'); }
  },
});
const social = createSocial({ scene, net, save, onToast: (m) => toast(m), mapId: MAP_ID });
social.listeners.stones.push(() => cairns.forEach(layoutCairn));
social.start();
// 입장할 때 한 번: 방 접속(서버가 정해진 뒤)·서버별 접속 기록
let sessionOn = false;
function startSession() { if (sessionOn) return; sessionOn = true; net.start(); ab.visit(); }
addEventListener('pagehide', () => ab.flush());
document.addEventListener('visibilitychange', () => { if (document.hidden) ab.flush(); });
$('handreq-ok').addEventListener('click', () => { net.accept(); $('handreq').hidden = true; linkSetup(); });
$('handreq-no').addEventListener('click', () => { net.decline(); $('handreq').hidden = true; });
$('btn-release').addEventListener('click', () => { net.release(); $('btn-release').hidden = true; });
$('btn-cancelreq').addEventListener('click', () => { net.cancelRequest(); $('btn-cancelreq').hidden = true; });
const tmp = new THREE.Vector3();
function linkSetup() {
  const e = net.peersById.get(net.hand.with); if (!e) return;
  const right = new THREE.Vector3(Math.cos(e.heading), 0, -Math.sin(e.heading));
  player.handSide = tmp.copy(player.pos).sub(e.pos).dot(right) >= 0 ? 1 : -1;
  player.target = null; marker.visible = false;
}
const alertMark = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 96; const g = c.getContext('2d'); g.fillStyle = '#e2342a'; g.font = 'bold 86px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 32, 50); const t = new THREE.CanvasTexture(c); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(0.8, 1.2, 1); sp.position.y = 3.0; sp.visible = false; sp.renderOrder = 11; runner.root.add(sp); return sp; })();
const handLine = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 5), new THREE.MeshLambertMaterial({ color: '#f0c9a0' }));
handLine.visible = false; scene.add(handLine);
function updateHandLine() {
  const e = net.hand.with && net.peersById.get(net.hand.with);
  if (!e) { handLine.visible = false; return; }
  const a = player.pos.clone(); a.y += 0.95 + player.jumpY; const b = e.pos.clone(); b.y += 0.95 + (e.data.jy || 0);
  const len = a.distanceTo(b);
  handLine.visible = len < 6;
  handLine.position.copy(a.clone().lerp(b, 0.5)); handLine.scale.set(1, Math.max(0.01, len - 0.5), 1);
  handLine.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
}

// ---------- 상호작용 ----------
// ---------- 레스토랑 스톤 (#50): 메뉴판 팝업 → 귤 내고 → 테라스 자리에 앉아 먹음(건너뛰기) → 버프 ----------
const mealS = { on: false, item: null, phase: '', t: 0, target: null };
const stoneOpen = () => !NS_TUT || !!save.jeong; // 튜토리얼(정낭 열기 전)엔 아직 안 열림
const skipAct = { label: '건너뛰기', ic: 'skip', act: () => finishMeal() };
const LOCK_SVG = '<svg class="lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const buffIc = (k, cls = '') => `<svg ${cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${BUFF_ICON[k]}</svg>`;
// 가게 팝업 (#57): 가게마다 같은 틀 #shoppop (위 로고·이름·표어, 아래 카드). head = 위 칸, fill(grid) = 카드 채우기, when = 열 수 있는 때
const SHOP_POP = {
  stone: { head: { logo: STONE_LOGO, name: 'Stone', tag: 'Maximize all the Pleasure', serif: true }, fill: (grid) => buildStoneMenu(grid), when: stoneOpen, can: () => !!STN && !mealS.on },
  salon: { head: { logo: salonLogo(), name: '루이네 미장원', wide: true }, fill: (grid) => buildSalonMenu(grid), when: stoneOpen, can: () => !!SAL && !!save.look && !cutS.on && !mealS.on },
  leap: { head: { logo: leapLogo(), name: 'LEAP', wide: true, cls: 'leap' }, tabs: (el) => buildLeapTabs(el), fill: (grid) => buildLeapCards(grid), onOpen: () => startLeap(), when: stoneOpen, can: () => !!LEAPB && !cutS.on && !mealS.on },
};
let shopPopNow = null;
function openShopPop(key) {
  const P = SHOP_POP[key]; if (!P || (P.can && !P.can())) return;
  closePanels(); shopPopNow = key;
  const h = P.head, root = $('shoppop');
  $('shoppop-logo').src = h.logo || ''; $('shoppop-logo').alt = h.name; $('shoppop-logo').parentElement.hidden = !h.logo;
  $('shoppop-name').textContent = h.name; $('shoppop-tag').textContent = h.tag || ''; root.classList.toggle('serif', !!h.serif); root.classList.toggle('wide', !!h.wide); root.querySelector('.pop').setAttribute('aria-label', h.name);
  root.classList.toggle('leap', h.cls === 'leap');
  P.onOpen?.(); refreshShopPop(); root.hidden = false;
}
function refreshShopPop() { const P = SHOP_POP[shopPopNow]; if (!P) return; $('shoppop-coins').textContent = String(save.coins); const tabs = $('shoppop-tabs'); tabs.hidden = !P.tabs; tabs.innerHTML = ''; if (P.tabs) P.tabs(tabs); const grid = $('shoppop-cards'); grid.innerHTML = ''; P.fill(grid); }
const shopActs = shopsBuilt.map((sh) => ({ shop: sh.id, ic: sh.ic, label: sh.act, pos: sh.door, r: sh.r, when: SHOP_POP[sh.pop]?.when, act: () => openShopPop(sh.pop) }));
function openStone() { openShopPop('stone'); }
function buildStoneMenu(grid) {
  const cur = buff.now();
  for (const m of STONE.menu) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'menu-card'; b.dataset.id = m.id;
    const lockd = m.battle && !isBattle(), min = Math.round((m.sec || STONE.buffSec) / 60);
    b.disabled = lockd; b.classList.toggle('poor', save.coins < m.price); b.classList.toggle('on', !!cur && cur.item.id === m.id);
    b.title = `${m.ko} · ${m.en}`;
    b.innerHTML = `<svg class="food" viewBox="0 0 64 64" aria-hidden="true">${FOOD_SVG[m.id]}</svg><span class="mn"><b>${m.ko}</b><small>${m.en}</small></span>`
      + `<span class="mv"><span class="price"><i></i>${m.price}</span><span class="bf">${buffIc(m.buff)}${buffText(m)}<em>${min}′</em></span></span>${lockd ? LOCK_SVG : ''}`;
    b.addEventListener('click', () => orderMeal(m));
    grid.appendChild(b);
  }
}
function orderMeal(m) {
  if (!STN || mealS.on || (m.battle && !isBattle())) return;
  if (save.coins < m.price) { toast(`귤이 ${m.price - save.coins}개 모자라요`); return; }
  save.coins -= m.price; persist(); updateStats(); sound.coin?.();
  closePanels(); stopAutoGo(); setHoldBow(false); if (fishing?.active) fishing.stop();
  Object.assign(mealS, { on: true, item: m, phase: 'walk', t: 0 });
  setTarget(STN.seatGo, () => sitMeal()); mealS.target = player.target;
}
function sitMeal() {
  mealS.phase = 'eat'; mealS.t = 0;
  player.target = null; player.onArrive = null; marker.visible = false;
  player.pos.copy(STN.seat); player.heading = STN.seatHeading; player.speed = 0;
  player.pose = 'sit'; player.poseT = 0; STN.serve(mealS.item);
}
function finishMeal() {
  if (!mealS.on) return;
  const m = mealS.item; mealS.on = false; mealS.item = null; STN.serve(null);
  if (player.pose === 'sit') { player.pose = 'move'; player.pos.copy(STN.seatGo); player.pos.y = groundAt(player.pos.x, player.pos.z); }
  if (player.target === mealS.target && player.onArrive) { player.target = null; player.onArrive = null; }
  buff.give(m); updateBuffUI(true);
  ach.emit('meal'); ach.emit('meal-' + m.id);
  toast(`${m.ko} · ${bIconText(m)}`);
}
const BUFF_WORD = { speed: '이동 속도', bag: '배낭 용량', dmg: '귤 피해', pick: '줍는 속도', regen: 'HP 회복' };
const bIconText = (m) => `${BUFF_WORD[m.buff]} ${buffText(m)} ${Math.round((m.sec || STONE.buffSec) / 60)}분`;
function tickMeal(dt) {
  if (!mealS.on) return;
  mealS.t += dt;
  if (mealS.phase === 'walk') {
    if (player.target !== mealS.target) { finishMeal(); return; } // 움직여서 그만두면 바로 버프
    if (mealS.t > STONE.walkMax) sitMeal();
    return;
  }
  STN.setLeft(1 - mealS.t / STONE.eatT);
  const moveKey = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].some((k) => keys.has(k));
  if (mealS.t >= STONE.eatT || (mealS.t > 0.4 && (moveKey || joy.active))) finishMeal();
}
// ---------- 루이네 미장원 (#58): 머리 카드 → 귤 내고 → 문 앞까지 걸어가 의자에 앉음 → 가위질 3초(건너뛰기) → 머리가 바뀜 ----------
// 머리 종류는 balance.js HAIR.list. 가진 머리로 바꾸는 것은 무료. 머리는 능력치 없음, 모자와 같이 씀(#52 다른 칸)
const cutS = { on: false, hair: null, phase: '', t: 0, target: null };
const cutSkipAct = { label: '건너뛰기', ic: 'skip', act: () => finishCut() };
function buildSalonMenu(grid) {
  const skin = SKIN_TONES[save.look?.skin] || SKIN_TONES[0], cur = save.outfit.gear?.hair;
  for (const h of HAIR.list) {
    const has = !!save.hairs[h.key], on = cur === h.key, price = has ? 0 : h.price;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'menu-card hair-card'; b.dataset.id = h.id;
    b.classList.toggle('poor', save.coins < price); b.classList.toggle('on', on); b.title = h.name;
    b.setAttribute('aria-label', `${h.name} · ${on ? '지금 머리' : has ? '가진 머리 무료' : `귤 ${price}`}`);
    b.innerHTML = `<span class="food">${HEAD_SVG(h.key, skin)}</span><span class="mn"><b>${h.name}</b></span>`
      + `<span class="mv">${on ? `<span class="have">${SVG_A} stroke-width="3"><path d="M5 12l5 5 9-10"/></svg></span>` : `<span class="price"><i></i>${price}</span>`}</span>`;
    b.addEventListener('click', () => orderCut(h.key));
    grid.appendChild(b);
  }
}
function orderCut(key) {
  const h = HAIR.byKey[key]; if (!SAL || !h || !save.look || cutS.on || mealS.on) return false;
  if (save.outfit.gear?.hair === key) { toast(`지금 ${h.name}예요`); return false; }
  const has = !!save.hairs[key];
  if (!has && save.coins < h.price) { toast(`귤이 ${h.price - save.coins}개 모자라요`); return false; }
  if (!has) {
    save.coins -= h.price; save.hairs[key] = 1; persist(); updateStats(); sound.coin?.();
  }
  closePanels(); stopAutoGo(); setHoldBow(false); if (fishing?.active) fishing.stop();
  Object.assign(cutS, { on: true, hair: key, phase: 'walk', t: 0 });
  setTarget(SAL.door, () => sitCut()); cutS.target = player.target;
  return true;
}
function sitCut() {
  if (!cutS.on) return;
  cutS.phase = 'cut'; cutS.t = 0;
  player.target = null; player.onArrive = null; marker.visible = false;
  player.pos.copy(SAL.seat); player.heading = SAL.seatHeading; player.speed = 0;
  player.pose = 'sit'; player.poseT = 0; cam.yaw = player.heading + Math.PI; SAL.inside(true);
  SAL.cut.start(new THREE.Vector3(SAL.seat.x, SAL.seat.y + 1.32, SAL.seat.z));
}
function finishCut() {
  if (!cutS.on) return;
  const key = cutS.hair, h = HAIR.byKey[key]; cutS.on = false; cutS.hair = null;
  SAL.cut.stop(); SAL.inside(false);
  if (player.pose === 'sit') { player.pose = 'move'; player.pos.copy(SAL.door); player.pos.y = groundAt(SAL.door.x, SAL.door.z); player.heading = SAL.seatHeading + Math.PI; }
  if (player.target === cutS.target && player.onArrive) { player.target = null; player.onArrive = null; }
  wearHair(key); sound.coin?.();
  ach.emit('haircut'); ach.emit('haircut-' + h.id);
  toast(`${h.name} · 잘 어울려요`);
}
function tickCut(dt) {
  if (!cutS.on) return;
  cutS.t += dt;
  if (cutS.phase === 'walk') {
    if (player.target !== cutS.target) { finishCut(); return; } // 움직여서 그만두면 바로 바뀜
    if (cutS.t > SALON.walkMax) sitCut();
    return;
  }
  if (SAL.cut.update(dt)) sound.snip?.();
  const moveKey = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].some((k) => keys.has(k));
  if (cutS.t >= SALON.cutT || (cutS.t > 0.4 && (moveKey || joy.active))) finishCut();
}
// ---------- LEAP (#59): 위 칸 고르기(신발·모자·티셔츠·바지·베스트·잠바·양말) → 옷 카드(그림·단계 색·능력치 지금→바뀔 값·값) ----------
// 안 가진 카드를 누르면 내 캐릭터가 입어 본 모습(cam 'leap' 이 앞에서 비춤) + 아래 사기 버튼. 가진 옷은 눌러서 바로 갈아입음
// 옷은 #52 WEAR·CLOTHES 표, 신발은 SHOES 표(차례대로 사고, 산 것 중 가장 좋은 것을 신음). 업적 이벤트 clothes-buy, clothes-buy-<칸>
const leapS = { on: false, slot: LEAP.slots[0], pick: null, cam: null, tried: false };
const LEAP_CHECK = `<span class="have">${'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"'} stroke-width="3"><path d="M5 12l5 5 9-10"/></svg></span>`;
const leapSlotName = (k) => k === 'shoes' ? '신발' : WSLOT[k].name;
function leapItems(k) {
  if (k === 'shoes') {
    const n = Math.max(1, save.equip.shoes || 1), now = SHOES[n - 1].speed;
    return SHOES.map((t, i) => ({ id: 'shoes:' + (i + 1), shoes: i + 1, tier: i + 1, name: t.name, price: t.price, own: i < n, on: i === n - 1, lock: i > n,
      art: `${SVG_A.replace('<svg', '<svg class="art"')}>${TIER_ART.shoes[i]}</svg>`, now, v: t.speed, stat: 'speed' }));
  }
  const w = WSLOT[k], now = wearV(k), out = [];
  if (w.none) out.push({ id: '', tier: 0, name: '없음', price: 0, own: true, on: !CL.wear[k], art: clothSvg(null), now, v: w.v[0], stat: w.stat });
  CLOTHES.filter((c) => c.slot === k).sort((a, b) => a.tier - b.tier).forEach((c) => out.push({ id: c.id, cloth: c, tier: c.tier, name: c.name, price: wearPrice(c), own: !!CL.own[c.id], on: CL.wear[k] === c.id, art: clothSvg(c), now, v: w.v[c.tier], stat: w.stat }));
  return out;
}
const leapStatText = (stat, v) => stat === 'speed' ? `×${String(v.toFixed(2)).replace(/0$/, '')}` : wearStatText(stat, v);
const leapStat = (it) => `${SVG_A}>${it.stat === 'speed' ? STAT_ICON.speed : WEAR_STAT_ICON[it.stat]}</svg>` + (it.v !== it.now ? `<s>${leapStatText(it.stat, it.now)}</s>→<em>${leapStatText(it.stat, it.v)}</em>` : leapStatText(it.stat, it.v));
function buildLeapTabs(el) {
  el.classList.add('shop-tabs');
  for (const k of LEAP.slots) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.slot = k; b.title = leapSlotName(k); b.setAttribute('aria-pressed', String(k === leapS.slot));
    const ic = k === 'shoes' ? `${SVG_A}>${TIER_ART.shoes[Math.max(1, save.equip.shoes || 1) - 1]}</svg>` : clothSvg(CLOTH[CL.wear[k]] || CLOTHES.find((c) => c.slot === k && c.tier === 1), 'tab-art');
    b.innerHTML = `${ic}<span>${leapSlotName(k)}</span>`;
    b.addEventListener('click', () => { leapS.slot = k; leapS.pick = null; leapTryOn(null); refreshShopPop(); });
    el.append(b);
  }
}
function buildLeapCards(grid) {
  const items = leapItems(leapS.slot);
  const LOCK = `${SVG_A.replace('<svg', '<svg class="lock"')} stroke-width="2.5"><path d="M7 11h10v9H7zM9 11V8a3 3 0 0 1 6 0v3"/></svg>`;
  for (const it of items) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'menu-card leap-card'; b.dataset.id = it.id;
    b.style.setProperty('--tc', WEAR.tierColor[it.tier]);
    b.classList.toggle('on', it.on); b.classList.toggle('sel', leapS.pick === it.id); b.classList.toggle('poor', !it.own && save.coins < it.price); b.classList.toggle('locked', !!it.lock);
    b.title = it.name; b.setAttribute('aria-pressed', String(leapS.pick === it.id || it.on));
    b.setAttribute('aria-label', `${it.name}${it.tier ? ` ${it.tier}단계` : ''} · ${it.on ? '입고 있음' : it.own ? '가진 옷' : `귤 ${it.price}`}`);
    b.innerHTML = `<span class="food">${it.art}${it.tier ? '<i class="tc"></i>' : ''}</span><span class="mn"><b>${it.name}</b><small class="st">${leapStat(it)}</small></span>`
      + `<span class="mv">${it.on ? LEAP_CHECK : it.own ? '' : `<span class="price"><i></i>${it.price.toLocaleString()}</span>`}</span>${it.lock ? LOCK : ''}`;
    b.addEventListener('click', () => pickLeap(it));
    grid.append(b);
  }
  const it = items.find((i) => i.id === leapS.pick && !i.own);
  if (!it) return;
  const bar = document.createElement('div'); bar.className = 'leap-buy';
  bar.innerHTML = `<div><b><i class="tdot" style="background:${WEAR.tierColor[it.tier]}"></i>${it.name}</b><span class="tier-stats"><span>${leapStat(it)}</span></span></div>`;
  const bb = document.createElement('button'); bb.type = 'button'; bb.className = 'tier-buy' + (save.coins < it.price ? ' short' : '');
  if (it.lock) { bb.disabled = true; bb.innerHTML = `${SVG_A} stroke-width="2.5"><path d="M7 11h10v9H7zM9 11V8a3 3 0 0 1 6 0v3"/></svg><span>${it.price.toLocaleString()}</span>`; bb.setAttribute('aria-label', '앞 단계 신발을 먼저 사요'); }
  else { bb.innerHTML = `<i class="g"></i>${it.price.toLocaleString()}`; bb.setAttribute('aria-label', `${it.name} 사기`); bb.addEventListener('click', () => buyLeap(it)); }
  bar.append(bb); grid.append(bar);
}
// 입어 보기: 고른 옷(또는 신발)만 바꾼 차림을 캐릭터에 입힘 (저장은 안 함). null 이면 지금 차림으로 되돌림
function leapTryOn(it) {
  if (!it) { if (leapS.tried) { runner.apply(save.outfit); leapS.tried = false; } return; }
  const gear = { ...save.outfit.gear, [leapS.slot]: it.shoes ? SHOE_GEAR[it.shoes - 1] : it.id || `${leapS.slot}:none` };
  runner.apply({ ...save.outfit, gear }); leapS.tried = true;
}
function pickLeap(it) {
  if (it.own) {
    leapS.pick = null; leapTryOn(null);
    if (it.shoes) { if (!it.on) toast('지금 더 좋은 신발을 신고 있어요'); }
    else if (!it.on) { wearCloth(leapS.slot, it.id || null); sound.coin?.(); }
  } else {
    leapS.pick = leapS.pick === it.id ? null : it.id;
    leapTryOn(leapS.pick ? it : null);
  }
  refreshShopPop();
}
function buyLeap(it) {
  if (!it || it.own) return false;
  if (it.lock) { toast('앞 단계 신발을 먼저 사요'); return false; }
  if (save.coins < it.price) { toast(`귤이 ${it.price - save.coins}개 모자라요`); return false; }
  const from = save.coins;
  leapS.tried = false; // 사면 바로 그 차림이 됨
  if (it.shoes) {
    const before = save.equip.shoes; buyGear('shoes'); if (save.equip.shoes === before) return false;
    ach.emit('clothes-buy'); ach.emit('clothes-buy-shoes');
  } else if (!buyCloth(it.id)) return false;
  leapS.pick = null; refreshShopPop();
  const cell = document.querySelector(`#shoppop-cards .leap-card[data-id="${it.id}"]`);
  if (cell) { cell.classList.add('tier-pop'); spendFx(cell, it.price, from, document.querySelector('#shoppop .coins-pill'), $('shoppop-coins')); }
  return true;
}
function startLeap() {
  leapS.pick = null; leapS.tried = false;
  if (!leapS.on) leapS.cam = { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist };
  leapS.on = true;
  stopAutoGo(); player.target = null; player.onArrive = null; marker.visible = false; player.speed = 0;
  player.heading = LEAPB.face; cam.mode = 'leap'; // 골목 쪽을 보고 서서, 카메라가 앞에서 비춤
}
function endLeap() {
  leapS.on = false; leapS.pick = null; leapTryOn(null);
  if (cam.mode === 'leap') { cam.mode = 'follow'; if (leapS.cam) Object.assign(cam, leapS.cam); }
  leapS.cam = null;
}
function tickLeap() { if (leapS.on && ($('shoppop').hidden || shopPopNow !== 'leap')) endLeap(); }
// 버프 표시: 아이콘 + 남은 시간 고리
const buffPill = $('buff-pill'); let buffKey = '';
function updateBuffUI(force) {
  const n = buff.now();
  if (!n) { if (!buffPill.hidden) buffPill.hidden = true; buffKey = ''; return; }
  const sec = Math.ceil(n.left), txt = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`, key = n.item.id + txt;
  if (key === buffKey && !force) return; buffKey = key;
  buffPill.hidden = false; buffPill.title = `${n.item.ko} · ${bIconText(n.item)}`;
  const ic = buffPill.querySelector('svg.ic'); if (ic.dataset.k !== n.item.buff) { ic.dataset.k = n.item.buff; ic.innerHTML = BUFF_ICON[n.item.buff]; }
  buffPill.querySelector('.fg').style.strokeDashoffset = String(75.4 * (1 - n.left / n.total));
  buffPill.querySelector('b').textContent = txt; buffPill.classList.toggle('end', n.left < 30);
  const off = (n.item.buff === 'dmg' || n.item.buff === 'regen') && !isBattle(); buffPill.style.opacity = off ? '.5' : '';
}
// 가장자리 포크·나이프: 레스토랑이 화면 밖이거나 조금 멀 때
// 가장자리 가게 아이콘 (#57): 가게마다 아이콘 하나, 가장 가까운 (열 수 있는) 가게만. 화면 밖이거나 조금 멀 때
const shopMark = $('shop-mark'); let shopMarkId = '';
function tickShopMark() {
  if (tipMarkT > 0 && tipMarkPos) { shopMarkId = '*tip'; shopMark.querySelector('svg').innerHTML = TIP_ICON.arrow; shopMark.hidden = false; placeArrow(shopMark, tipMarkPos, 0.6); return; }
  let best = null, bd = 1e9;
  for (const sh of shopsBuilt) { const w = SHOP_POP[sh.pop]?.when; if (w && !w()) continue; const d = Math.hypot(player.pos.x - sh.door.x, player.pos.z - sh.door.z); if (d < bd) { bd = d; best = sh; } }
  const on = !!best && bd > SHOP_ST.markNear && bd < SHOP_ST.markFar && !panelOpen() && cam.mode !== 'wardrobe' && !mealS.on && !cutS.on;
  if (!on) { if (!shopMark.hidden) shopMark.hidden = true; return; }
  if (shopMarkId !== best.id) { shopMarkId = best.id; shopMark.querySelector('svg').innerHTML = SHOP_ICON[best.id] || ''; shopMark.title = best.name; }
  shopMark.hidden = false; placeArrow(shopMark, best.signPos, 0.6);
}
const interactables = [
  ...(spots.tutorial ? [] : [{ label: '인증샷 찍기', ic: 'photo', pos: P.stone, r: 9, act: startPhoto }]),
  { label: '앉아 쉬기', ic: 'sit', pos: benchPos, r: 8, act: sitDown },
  ...(spots.sign.silent ? [] : [{ label: '안내 읽기', ic: 'sign', pos: spots.sign.pos, r: 6, act: () => openSign() }]),
  ...cairns.map((c) => ({ cairn: c, pos: c.pos, r: 7, act: () => openWishes(c) })),
  ...(chAct ? [chAct, shopAct] : []),
  ...shopActs,
];
let ctxTarget = null, handAct = null, deerAct = null;
let fishing = null; // 낚시 (#44) — 아래 튜토리얼 만든 뒤에 만듦
const fishAct = { get label() { return fishing.label; }, get ic() { return fishing.ic; }, act: () => fishing.press() };
const dismountAct = { label: '노루에서 내리기', ic: 'down', act: () => dismountDeer() };
const standAct = { label: '일어나기', ic: 'stand', act: () => standUp() };
// 상호작용 (F·상호작용 버튼): 가까이 할 일이 있으면 그것, 없으면 귤 던지기 (#34)
const throwAct = { get label() { return bowArmed() ? '귤 활 쏘기' : '귤 던지기'; }, get ic() { return bowArmed() ? 'bow' : 'throw'; }, act: () => fireWeapon() };
function doInteract() { if (ctxTarget && !hp.isDown && !hp.pending) ctxTarget.act(); }
pressBtn(ui.ctx, () => doInteract());
// 줍기 (E·줍기 버튼): 누르고 있는 동안 계속
const pickBtn = $('btn-pick');
pickBtn.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button) return; e.preventDefault(); pickS.held = true; try { pickBtn.setPointerCapture(e.pointerId); } catch (_) { /* 무시 */ } startPick(); });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => pickBtn.addEventListener(ev, () => { pickS.held = false; }));
pickBtn.addEventListener('click', (e) => { if (e.detail === 0) startPick(); }); // 키보드로 누른 경우
pickBtn.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- 줍기·배낭 ----------
const pickS = { held: false, cyc: -1, got: false, fullT: 0, gyul: -1 };
const toolNow = () => { const t = TOOLS[save.equip.tool - 1], k = buff.mul('pick'); return k === 1 ? t : { ...t, time: t.time / k }; }; // 식사 버프(#50) 줍는 속도
const bagCap = () => Math.floor((save.equip.bag ? BAGS[save.equip.bag - 1] : POCKET).cap * buff.mul('bag')) + wearV('bottom'); // 식사 버프(#50) 배낭 용량, 바지 주머니(#52)
const bagRoom = () => (trash ? bagCap() - trash.bagVol() : 0);
const canPick = () => !!trash && !player.riding && !player.air && (tut.gyulNear(player.pos) >= 0 || trash.any(player.pos.x, player.pos.z, toolNow().r, bagRoom())); // 튜토리얼 귤(#62)도 줍기로
const trashFull = () => !!trash && bagRoom() < 1 && trash.any(player.pos.x, player.pos.z, toolNow().r, 99);
function fullToast() { if (performance.now() - pickS.fullT < 4000) return; pickS.fullT = performance.now(); const w = save.equip.bag ? '배낭' : '호주머니'; toast(CH ? `${w}가 가득 찼어요 · 들머리 클린하우스에 버려요` : `${w}가 가득 찼어요`); }
const pickBlocked = () => panelOpen() || cam.mode === 'wardrobe' || lookS.open || ['sit', 'photo', 'photo-wait', 'breath'].includes(player.pose) || player.riding || player.air || !!player.rescue || hp.isDown || hp.pending;
function startPick() {
  if (!trash || pickS.cyc >= 0 || pickBlocked()) return;
  const gi = player.riding || player.air ? -1 : tut.gyulNear(player.pos); // 튜토리얼 귤 3개 (#62): 쓰레기보다 먼저
  if (gi >= 0) { const g = tut.gyuls[gi]; player.target = null; player.onArrive = null; marker.visible = false; player.heading = Math.atan2(g.x - player.pos.x, g.z - player.pos.z) || player.heading; player.pose = 'crouch'; player.poseT = 0; player.speed = 0; setHoldBow(false); pickS.cyc = 0; pickS.got = false; pickS.gyul = gi; return; }
  const list = trash.candidates(player.pos.x, player.pos.z, toolNow().r, bagRoom());
  if (!list.length) { if (trashFull()) fullToast(); return; }
  const c = list[0];
  player.target = null; player.onArrive = null; marker.visible = false;
  player.heading = Math.atan2(c.x - player.pos.x, c.z - player.pos.z) || player.heading;
  player.pose = 'crouch'; player.poseT = 0; player.speed = 0; setHoldBow(false); // 줍기는 도구로 (#38)
  pickS.cyc = 0; pickS.got = false;
}
function takeNow() {
  if (pickS.gyul >= 0) { const at = tut.takeGyul(pickS.gyul); pickS.gyul = -1; if (at) { save.coins += 1; persist(); updateStats(); sound.coin?.(); coinFx(at, 1); } return; } // 튜토리얼 귤 (#62) +1
  const tool = toolNow(); let room = bagRoom(), n = 0;
  // 더미는 한 곳에서 도구의 한 번 양(per)만큼 꺼냄 (#45). 튜토리얼 낱개는 하나씩
  for (const c of trash.candidates(player.pos.x, player.pos.z, tool.r, room)) {
    while (n < tool.per && room >= 1) {
      const it = trash.take(c, room); if (!it) break;
      room -= it.type.vol; n++; flyToBag(it); sound.pick?.(it.type.id);
      if (c.h == null) break;
    }
    if (n >= tool.per || room < 1) break;
  }
  if (n) { trash.store.commit(); updateTrashUI(true); tut.notify('trash', n); }
  if (bagRoom() < 1) { sound.full?.(); fullToast(); }
}
function tickPick(dt) {
  if (!trash) return;
  const holding = pickS.held || keys.has('e');
  if (pickS.cyc < 0) {
    if (holding && holdBow && !pickBlocked()) setHoldBow(false); // 줍기를 누르면 활을 내리고 도구를 듦 (#38)
    if (holding && !pickBlocked() && player.pose !== 'crouch') { if (canPick()) startPick(); else if (trashFull()) fullToast(); }
    return;
  }
  const tool = toolNow(); pickS.cyc += dt;
  if (!pickS.got && pickS.cyc >= tool.time * 0.5) { pickS.got = true; takeNow(); }
  if (pickS.cyc >= tool.time) {
    pickS.cyc = -1;
    if (player.pose === 'crouch') player.pose = 'move';
    if (holding && canPick()) startPick();
  }
}
// 주운 쓰레기가 배낭으로 빨려 들어가는 연출
const flyPool = [];
function flyToBag(it) {
  const m = new THREE.Mesh(trash.geos[it.t], trash.fxMats[it.t].clone()); m.material.color.set(it.color);
  m.position.copy(it.pos); scene.add(m); flyPool.push({ m, from: it.pos.clone(), t: 0 });
}
function tickFly(dt) {
  for (let i = flyPool.length - 1; i >= 0; i--) {
    const f = flyPool[i]; f.t += dt; const k = Math.min(1, f.t / 0.42), e = k * k;
    const back = player.pos.clone(); back.y = player.visY + player.jumpY + 1.45; back.addScaledVector(new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading)), -0.35);
    f.m.position.lerpVectors(f.from, back, e); f.m.position.y += Math.sin(k * Math.PI) * 0.9;
    f.m.rotation.y += dt * 9; f.m.rotation.x += dt * 5; f.m.scale.setScalar(1 - 0.75 * e);
    if (k >= 1) { scene.remove(f.m); f.m.material.dispose(); flyPool.splice(i, 1); }
  }
}
const nearTop = () => spots.isViewpoint(player.pos) || player.pos.distanceTo(spots.sunWatch.pos) <= spots.sunWatch.r;
let lastTrashUI = '', lastZoneUI = '', zoneNow = 0, zoneT = 0;
// 구역 확인 (0.3초마다): 바뀌면 HUD 갱신
function tickZone(dt) { if (!trash || (zoneT -= dt) > 0) return; zoneT = 0.3; const z = trash.zoneAt(player.pos.x, player.pos.z); if (z !== zoneNow) { zoneNow = z; updateTrashUI(false); } }
function updateTrashUI(bump) {
  if (!trash) return;
  const vol = trash.bagVol(), cap = bagCap(), c = trash.clean() * 100;
  const cs = c > 0 && c < 10 ? c.toFixed(1) : String(Math.floor(c));
  const key = `${vol}/${cap}/${cs}`;
  const pk = save.equip.bag === 0; if ($('bag-pill').classList.contains('pocket') !== pk) { $('bag-pill').classList.toggle('pocket', pk); $('bag-pill').title = pk ? '호주머니: 담은 양 / 용량' : '배낭: 담은 양 / 용량 (부피)'; } // 배낭이 없으면 호주머니 아이콘 (#31)
  if (key !== lastTrashUI) { lastTrashUI = key; $('bag-n').textContent = vol; $('bag-cap').textContent = cap; $('clean-n').textContent = cs; $('clean-ring').setAttribute('stroke-dasharray', `${(Math.min(100, c) / 100 * 37.7).toFixed(1)} 37.7`); $('bag-pill').classList.toggle('full', vol >= cap); topFit.dirty(); }
  // 지금 구역 번호·깨끗한 정도 (#45). 들머리(0)에서는 숨김
  const zc = zoneNow ? Math.floor(trash.zoneClean(zoneNow) * 100) : 0;
  const zb = bloom ? bloom.bloomed().join('') : '', zk = `${zoneNow}/${zc}/${zb}`;
  if (zk !== lastZoneUI) { lastZoneUI = zk; $('zone-pill').hidden = !zoneNow; $('zone-n').textContent = zoneNow; $('zone-pill').dataset.c = zc; $('zone-pill').classList.toggle('done', zc >= 100); $('xy-pill').classList.toggle('inzone', !!zoneNow);
    // 꽃 아이콘 (#46): 지금 구역이 다 피었으면 꽃 모양(귤색), 깨끗한 정도 옆엔 다 핀 구역마다 작은 점. 색은 흰색·귤색만 (#75)
    const bl = !!(bloom && zoneNow && bloom.isBloomed(zoneNow)); $('zone-pill').classList.toggle('bloom', bl);
    const row = $('bloom-row'); row.hidden = !zb; row.innerHTML = [...zb].map((z) => `<i title="${z}구역 ${BLOOM.zones[z].name}"></i>`).join(''); topFit.dirty(); }
  if (bump) { const b = $('bag-pill'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
}
if (trash) {
  $('bag-pill').hidden = $('clean-pill').hidden = false; topFit.dirty();
  trash.on((ev, d) => {
    if (ev === 'trash') { ab.picked(); ach.emit('trash'); ach.emit('trash-' + d.kind); if (nearTop()) ach.emit('trash-top'); if (sunEvent()) ach.emit('trash-sun'); if (wx.kind === 'rain') ach.emit('trash-rain'); onDexGet(d.dex, d.dexNew); }
    else if (ev === 'dex-test') onDexGet(d.dex, d.dexNew);
    else if (ev === 'heap-clear') { tips.event('heapClear'); ach.emit('heap-clear'); toast('쓰레기 더미 하나를 다 치웠어요'); heapFx(d.h, { by: d.by, gyul: d.gyul }); }
    else if (ev === 'zone-clear') { ach.emit('zone-clear'); ach.emit('zone-clear-' + d.zone); } // 글 대신 꽃밭 배너 (#65, zone-bloom)
    updateTrashUI(false);
  });
  updateTrashUI(false);
}
// 더미를 다 치웠을 때·구역이 꽃밭이 될 때 효과 (#65). 3D 는 bloomfx.js, 여기선 소리·진동·기뻐하는 동작·카메라·배너
// by: 치운 사람(없으면 나). 다른 사람이 치운 건 가까이(otherR) 있을 때만 보이고 소리는 작게, 진동·동작 없음 (멀티 대비, 지금은 구조만)
let cheerQ = 0;
const HEAP_LVL = { s: 0, l: 1, xl: 2 };
const canVib = () => 'vibrate' in navigator && matchMedia('(pointer: coarse)').matches;
function heapFx(hi, { by = null, gyul = 0 } = {}) {
  const h = trash?.heaps[hi]; if (!h || !bfx) return;
  const mine = !by, far = Math.hypot(h.x - player.pos.x, h.z - player.pos.z);
  if (!mine && far > BLOOM_FX.otherR) return;
  const H = BLOOM_FX.heap[h.k] || BLOOM_FX.heap.s;
  bfx.heap({ x: h.x, z: h.z, r: h.r, size: h.k, color: BLOOM.zones[h.zone]?.color || '#ffffff', gyul });
  sound.heapClear?.(HEAP_LVL[h.k] ?? 0, mine ? 1 : Math.max(0.15, 1 - far / BLOOM_FX.otherR));
  if (!mine) return;
  cheerQ = 1.5;
  if (canVib()) try { navigator.vibrate(H.vib); } catch { /* 진동 막힘 */ }
}
function zoneFx(z) {
  if (!bfx) return;
  const C = BLOOM_FX.zone, color = BLOOM.zones[z]?.color || '#ffffff', here = trash.zoneAt(player.pos.x, player.pos.z) === z;
  sound.bloomFanfare?.();
  if (here) { bfx.zone({ x: player.pos.x, z: player.pos.z, color }); if (cam.mode === 'follow') camPullT = 0; }
  const gl = $('bloom-glow'); gl.style.setProperty('--bg-t', C.glowT + 's'); gl.classList.remove('go'); void gl.offsetWidth; gl.classList.add('go');
  const bn = $('bloom-banner'), fl = (s) => `<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="${color}" stroke="rgba(0,0,0,.28)" stroke-width=".6">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="12" cy="6.4" rx="3.6" ry="5" transform="rotate(${a + s} 12 12)"/>`).join('')}</g><circle cx="12" cy="12" r="2.6" fill="#ffb01f"/></svg>`;
  bn.innerHTML = `<span class="bz"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20l6.5-11 4 6 2.5-3.5L21 20z"/></svg><b>${z}</b></span><svg class="ba" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"/></svg><span class="bf">${fl(0)}${fl(36)}${fl(12)}</span>`;
  bn.title = `${z}구역 ${BLOOM.zones[z]?.name || ''}`; bn.style.setProperty('--bb-t', C.bannerT + 's');
  bn.hidden = false; bn.classList.remove('go'); void bn.offsetWidth; bn.classList.add('go');
  clearTimeout(zoneFx.t); zoneFx.t = setTimeout(() => { bn.hidden = true; bn.classList.remove('go'); }, C.bannerT * 1000 + 100);
  if (canVib()) try { navigator.vibrate(C.vib); } catch { /* 진동 막힘 */ }
}
// 콘솔 확인 (#65): __oreum.bloom.test.heap(10|50|200) 가장 가까운 그 크기 더미 옆으로 가서 효과, .zone(z) 지금(또는 z) 구역 꽃밭 효과. 저장은 바꾸지 않음
const bloomTest = {
  heap(size = 10, { other = false, clear = false } = {}) { // clear: 더미를 실제로 비움(저장됨, 되돌리기 __oreum.trash.setHeap(i, 원래 수))
    const k = size >= 200 ? 'xl' : size >= 50 ? 'l' : 's'; let bi = -1, bd = 1e9;
    trash.heaps.forEach((h, i) => { if (h.k !== k) return; const d = Math.hypot(h.x - player.pos.x, h.z - player.pos.z); if (d < bd) { bd = d; bi = i; } });
    if (bi < 0) return null; const h = trash.heaps[bi];
    if (!other) { const a = Math.atan2(player.pos.x - h.x, player.pos.z - h.z), d = h.r + 1.6, x = h.x + Math.sin(a) * d, z = h.z + Math.cos(a) * d; player.pos.set(x, groundAt(x, z), z); player.visY = player.pos.y; player.heading = a + Math.PI; cam.yaw = a; followCam(0, true); }
    if (clear) trash.test.setHeap(bi, 0); else bloom.replay({ heap: bi });
    heapFx(bi, { by: other ? 'test' : null }); return { heap: bi, size: k, zone: h.zone, n: h.n };
  },
  zone(z) { z = z || trash.zoneAt(player.pos.x, player.pos.z) || 1; bloom.replay({ zone: z }); zoneFx(z); if (trash.zoneAt(player.pos.x, player.pos.z) === z) bloom.flock(player.pos.x, player.pos.z); return z; },
  fx: () => bfx.counts(),
};
// 다 핀 구역 (#46): 소리·새 떼·노루. 노루는 구역마다 한 무리, 시들면 떠남
const bloomDeer = {};
function syncBloomDeer() {
  if (!bloom) return;
  for (const z of ZONE_IDS) {
    const on = bloom.isBloomed(z);
    if (on && !bloomDeer[z]) { const p = bloom.spotIn(z, spots.deerZone); if (p) bloomDeer[z] = life.addDeer(p.x, p.z, BLOOM.deer); }
    else if (!on && bloomDeer[z]) { const left = life.removeDeer(bloomDeer[z]); bloomDeer[z] = left.length ? left : null; }
  }
}
if (bloom) {
  bloom.on((ev, d) => {
    if (ev === 'zone-bloom') { ach.emit('zone-bloom'); zoneFx(d.zone); if (trash.zoneAt(player.pos.x, player.pos.z) === d.zone) bloom.flock(player.pos.x, player.pos.z); [1.6, 2.5, 3.6].forEach((t) => setTimeout(() => sound.on && sound.bird?.(), t * 1000)); }
    syncBloomDeer(); lastZoneUI = ''; updateTrashUI(false);
  });
  syncBloomDeer();
  life.hooks.spawnBlock = (x, z) => bloom.isBloomed(trash.zoneAt(x, z));
}
if (street) { const bl = life.hooks.spawnBlock, R = STREET.radius + SHOP_ST.keepPad; life.hooks.spawnBlock = (x, z) => Math.hypot(x - STREET.center.x, z - STREET.center.z) < R || !!bl?.(x, z); } // 가게 거리 둘레엔 몹 없음 (#57)
if (trash) life.hooks.zoneAt = (x, z) => trash.zoneAt(x, z); // 구역별 몹 (#48): 플레이어가 있는 구역의 종류가 나옴
// ---------- 클린하우스: 배낭 비우고 귤 받기 ----------
// 귤·저장은 누르는 순간 한 번에 처리하고, 날아가는 쓰레기와 올라가는 숫자는 연출만 한다
const dumpS = { list: [], t: 0, dur: 0, total: 0, shown: 0, el: null, sndT: 0 };
function dumpBag() {
  if (!CH || dumpS.el) return;
  const bag = trash.store.bag, per = []; let n = 0, g = 0;
  const vk = 1 + wearV('vest'); // 베스트(#52): 받는 귤 더함
  TRASH_TYPES.forEach((t, k) => { const c = bag[t.id] || 0; if (c > 0) { const pg = Math.round(c * t.gyul * vk); per.push({ k, c, g: pg }); n += c; g += pg; } });
  if (!n) { toast('배낭이 비었어요. 쓰레기를 주워 와요'); return; }
  TRASH_TYPES.forEach((t) => { bag[t.id] = 0; });
  save.recycle.visits++; save.recycle.gyul += g;
  trash.store.commit();
  addCoins(g); tut.notify('dump');
  // 첫 보너스(#31): 처음 버릴 때 한 번만 귤이 TUT.firstBonus(200)가 되도록 채움. 연출은 버리기가 끝난 뒤 귤이 쏟아짐
  if (!save.firstBonus) { save.firstBonus = 1; const b = Math.max(0, TUT.firstBonus - save.coins); save.coins += b; persist(); tut.notify('bonus');
    if (b > 0) setTimeout(() => gyulShower(b), CLEANHOUSE.dumpTime * 1000 + 150); }
  ach.emit('recycle'); ach.emit('earn', g);
  updateTrashUI(true);
  // 날아갈 모양: 종류마다 개수 비례로 나누되 종류마다 하나는
  const cap = LOW ? CLEANHOUSE.flyMaxLow : CLEANHOUSE.flyMax, m = Math.min(n, cap);
  const vis = per.map((p) => Math.max(1, Math.round(m * p.c / n)));
  const seq = []; per.forEach((p, j) => { let left = p.g; for (let i = 0; i < vis[j]; i++) { const share = i === vis[j] - 1 ? left : Math.floor(p.g / vis[j]); left -= share; seq.push({ k: p.k, share }); } });
  for (let i = seq.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [seq[i], seq[j]] = [seq[j], seq[i]]; } // 종류를 섞어서 차례로
  const flyT = 0.5, spread = Math.max(0, CLEANHOUSE.dumpTime - flyT - 0.1), cols = trash.fxMats;
  const back = player.pos.clone(); back.y = player.visY + 1.45;
  dumpS.list = seq.map((q, i) => {
    const mesh = new THREE.Mesh(trash.geos[q.k], cols[q.k]); mesh.visible = false; scene.add(mesh);
    return { ...q, mesh, t0: seq.length > 1 ? spread * i / (seq.length - 1) : 0, dur: flyT, from: back.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, Math.random() * 0.3, (Math.random() - 0.5) * 0.6)), done: false };
  });
  dumpS.t = 0; dumpS.dur = CLEANHOUSE.dumpTime; dumpS.total = g; dumpS.shown = 0; dumpS.sndT = 0;
  const el = document.createElement('div'); el.className = 'fx-recycle'; el.innerHTML = '<i></i><b>+0</b>'; document.body.append(el); dumpS.el = el;
  player.target = null; player.onArrive = null; marker.visible = false; player.speed = 0;
  player.heading = Math.atan2(CH.center.x - player.pos.x, CH.center.z - player.pos.z) || player.heading;
}
const chV = new THREE.Vector3();
function tickDump(dt) {
  if (!dumpS.el) return;
  dumpS.t += dt; dumpS.sndT -= dt;
  for (const f of dumpS.list) {
    if (f.done) continue;
    const k = (dumpS.t - f.t0) / f.dur; if (k < 0) continue;
    const to = CH.binTop[f.k];
    if (k >= 1) {
      f.done = true; scene.remove(f.mesh); CH.pop(f.k); dumpS.shown += f.share;
      if (dumpS.sndT <= 0) { sound.pick?.(TRASH_TYPES[f.k].id); dumpS.sndT = 0.07; }
      continue;
    }
    f.mesh.visible = true; const e = k * k * (3 - 2 * k);
    f.mesh.position.lerpVectors(f.from, to, e); f.mesh.position.y += Math.sin(k * Math.PI) * 2.2;
    f.mesh.rotation.set(k * 7, k * 9, 0); f.mesh.scale.setScalar(1 - 0.35 * k);
  }
  const allDone = dumpS.list.every((f) => f.done);
  const n = allDone ? dumpS.total : dumpS.shown;
  const b = dumpS.el.querySelector('b'), txt = `+${n}`; if (b.textContent !== txt) { b.textContent = txt; dumpS.el.classList.remove('tick'); void dumpS.el.offsetWidth; dumpS.el.classList.add('tick'); }
  chV.copy(CH.center); chV.y += 4.6; chV.project(camera);
  dumpS.el.style.left = ((chV.x * 0.5 + 0.5) * innerWidth) + 'px'; dumpS.el.style.top = ((-chV.y * 0.5 + 0.5) * innerHeight - Math.min(1, dumpS.t / dumpS.dur) * 26) + 'px';
  dumpS.el.style.visibility = chV.z > 1 ? 'hidden' : '';
  if (allDone && !dumpS.end) { dumpS.end = true; sound.recycle?.(); toast(`클린하우스에 버렸어요 · 귤 +${dumpS.total}`); }
  if (dumpS.t > dumpS.dur + 0.9) { if (canBuyGear().length) shopHintUntil = performance.now() + CLEANHOUSE.shopHint * 1000; dumpS.el.remove(); dumpS.el = null; dumpS.end = false; dumpS.list.forEach((f) => scene.remove(f.mesh)); dumpS.list = []; }
}
// 배낭이 찼을 때 클린하우스 방향: 화면 밖이면 가장자리 화살표, 보이면 위에서 가리킴
const chArrow = $('ch-arrow'), shopArrow = $('shop-arrow');
let shopHintUntil = 0; // 버린 직후 살 수 있는 장비가 있으면 이때까지 가판대 쪽 표시
// 목표가 화면 안이면 위에서 가리키고, 밖이면 가장자리에서 그 방향 화살표
function placeArrow(el, wp, lift) {
  chV.copy(wp); chV.y += lift; chV.project(camera);
  const W = innerWidth, H = innerHeight, behind = chV.z > 1;
  let x = chV.x, y = chV.y; if (behind) { x = -x; y = -y; }
  const vis = !behind && Math.abs(x) < 0.85 && Math.abs(y) < 0.8;
  let sx, sy, ang;
  if (vis) { sx = (x * 0.5 + 0.5) * W; sy = (-y * 0.5 + 0.5) * H - 30; ang = Math.PI / 2; }
  else {
    // 가운데에서 그 방향으로 뻗어 화면 안쪽 테두리에 닿는 곳
    const phone = W <= 600, mL = 40, mR = 40, mT = topFit.bottom + 72, mB = phone ? 190 : 120; // 위쪽 줄·토스트 아래 (#75)
    let dx = x * W / 2, dy = -y * H / 2; if (Math.hypot(dx, dy) < 1e-3) dy = 1;
    const cx = W / 2, cy = H / 2;
    const tx = dx > 0 ? (W - mR - cx) / dx : dx < 0 ? (mL - cx) / dx : 1e9, ty = dy > 0 ? (H - mB - cy) / dy : dy < 0 ? (mT - cy) / dy : 1e9;
    const t = Math.min(tx, ty); sx = cx + dx * t; sy = cy + dy * t; ang = Math.atan2(dy, dx);
  }
  el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
  el.style.setProperty('--a', ang.toFixed(3) + 'rad');
}
// 클린하우스 표시를 누르면 탐방로를 따라 자동으로 걸어감 (#40). 조이스틱·방향키·다시 누르기·패널 열림·쓰러짐이면 멈춤
let autoGo = null, trailG = null;
function stopAutoGo() { if (!autoGo) return; player.running = autoGo.run; player.gait = autoGo.gait; autoGo = null; if (player.target) { player.target = null; player.onArrive = null; marker.visible = false; } }
function startAutoGo() {
  if (!CH || autoGo || busy() || player.riding || hp.isDown) return;
  if (!trailG) trailG = buildTrailGraph(nsPaths, 6);
  const route = trailRoute(trailG, player.pos, CH.front).map((q) => new THREE.Vector3(q.x, height(q.x, q.z), q.z));
  if (player.pos.distanceTo(CH.front) < CLEANHOUSE.arrowNear * 0.4) return;
  autoGo = { route, i: 0, cur: null, run: player.running, gait: player.gait }; player.running = true;
  const nextWp = () => { const last = autoGo.i === autoGo.route.length - 1; setTarget(autoGo.route[autoGo.i], last ? () => { stopAutoGo(); } : null); if (!last) marker.visible = false; autoGo.cur = player.target; };
  autoGo.next = nextWp; nextWp();
}
function tickAutoGo() {
  if (!autoGo) return;
  if (busy() || hp.isDown || player.riding || player.target !== autoGo.cur || !CH) { stopAutoGo(); return; }
  const last = autoGo.i === autoGo.route.length - 1;
  const dc = Math.hypot(autoGo.cur.x - player.pos.x, autoGo.cur.z - player.pos.z);
  if (!last && dc < 2.4) { autoGo.i++; autoGo.next(); } else if (last && dc < 0.9) stopAutoGo(); // 도착하면 멈추기만 함(버리기는 직접)
}
chArrow.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); });
chArrow.addEventListener('click', (e) => { e.stopPropagation(); if (autoGo) stopAutoGo(); else startAutoGo(); });
function tickChArrow() {
  const full = !!CH && bagRoom() < 1;
  const on = !!CH && !dumpS.el && cam.mode !== 'wardrobe' && !panelOpen() && (player.pos.distanceTo(CH.front) > CLEANHOUSE.arrowNear || !!autoGo);
  if (!on) { if (!chArrow.hidden) chArrow.hidden = true; }
  else {
    chArrow.hidden = false; placeArrow(chArrow, CH.center, 4.2);
    chArrow.classList.toggle('full', full); chArrow.classList.toggle('going', !!autoGo);
    const d = Math.round(player.pos.distanceTo(CH.front)) + 'm', dn = chArrow.querySelector('small'); if (dn.textContent !== d) dn.textContent = d;
  }
  // 가판대 쪽 짧은 표시: 앞에 오면 끝
  if (shopHintUntil && (performance.now() > shopHintUntil || player.pos.distanceTo(CH.shopFront) < CLEANHOUSE.shopR || !canBuyGear().length)) shopHintUntil = 0;
  const so = !!shopHintUntil && !dumpS.el && cam.mode !== 'wardrobe' && !panelOpen();
  if (!so) { if (!shopArrow.hidden) shopArrow.hidden = true; return; }
  shopArrow.hidden = false; placeArrow(shopArrow, CH.stallTop, 0.9);
}
function updateContext() {
  let best = null, bd = 1e9;
  if (player.pose === 'sit') best = mealS.on ? skipAct : cutS.on ? cutSkipAct : standAct;
  else if (player.riding && !busy()) best = dismountAct;
  else if (!busy() && !player.onArrive) {
    for (const it of interactables) { if (it.when && !it.when()) continue; const d = it.pos.distanceTo(player.pos); if (d < it.r && d < bd) { bd = d; best = it; } }
    const d = life.nearestDeer(player.pos, 2.6);
    if (d) { if (!deerAct || deerAct.deer !== d) deerAct = { deer: d, label: '노루 타기', act: () => mountDeer(d) }; best = deerAct; }
    if (!net.hand.with && !net.hand.req && !net.hand.pendingFrom) {
      const e = net.nearestPeer(4.5);
      if (e && !e.data.hw && e.peer !== net.hand.declinedBy) {
        if (!handAct || handAct.peer !== e.peer) handAct = { peer: e.peer, label: `${e.nick}와 손잡기`, act: () => net.request(e.peer) };
        best = handAct;
      }
    }
    if (fishing && (fishing.active || (!best && fishing.canFish()))) best = fishAct; // 개울 물가면 낚시 (#44)
    if (!best) best = throwAct; // 할 일이 없으면 귤 던지기
  }
  if (best !== ctxTarget) { ctxTarget = best; ui.ctx.classList.toggle('idle', !best); ui.ctx.classList.toggle('soft', best === throwAct); }
  { const bite = best === fishAct && fishing.phase === 'bite'; if (ui.ctx.classList.contains('bite') !== bite) ui.ctx.classList.toggle('bite', bite); }
  let label = '상호작용';
  if (best) label = best.cairn ? ((social.stones.get(best.cairn.id) || []).some((e) => e.mine) ? '소원 보기' : '돌 올리기') : best.label;
  const span = ui.ctx.querySelector('span');
  if (span.textContent !== label) { span.textContent = label; ui.ctx.title = `${label} (F)`; }
  const ic = best ? (best.ic || (best.cairn ? 'cairn' : best.deer ? 'deer' : best.peer ? 'hand' : 'do')) : 'do';
  if (ui.ctx.dataset.ic !== ic) { ui.ctx.dataset.ic = ic; ui.ctx.querySelector('svg').innerHTML = CTX_ICON[ic] || CTX_ICON.do; }
  updateAmmo();
  // 줍기 버튼: 도구 반경 안에 주울 쓰레기가 없으면 흐리게
  const can = pickS.cyc >= 0 || canPick();
  if (pickBtn.classList.contains('dim') === can) pickBtn.classList.toggle('dim', !can);
}
// 상호작용 버튼 아이콘 (지금 될 동작)
const CTX_ICON = {
  do: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',
  bow: '<path d="M6 3c7 2 11 8 9 18M6 3l9 18M10 12l10-6M20 6l-3-.5M20 6l-.5 3"/><circle cx="19" cy="6" r="1.6"/>',
  throw: '<circle cx="11" cy="14" r="6"/><path d="M11 8c0-2 1-3 3-4M8 5c1 1 2 2 3 3M19 5l2-2M20 9h2"/>',
  dump: '<path d="M4 10l8-6 8 6M6 9v11h12V9M10 20v-5h4v5"/><path d="M12 4v-2" />',
  shop: '<path d="M3 9l2-5h14l2 5M3 9h18M3 9c0 2 2 3 3 3s3-1 3-3c0 2 2 3 3 3s3-1 3-3c0 2 2 3 3 3s3-1 3-3M5 12v8h14v-8"/><circle cx="12" cy="16" r="2"/>',
  cairn: '<ellipse cx="12" cy="19" rx="7" ry="2.5"/><ellipse cx="12" cy="13.5" rx="5" ry="2.2"/><ellipse cx="12" cy="8.5" rx="3.5" ry="2"/><ellipse cx="12" cy="4.5" rx="2" ry="1.4"/>',
  photo: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  sit: '<path d="M4 11h16M5 11V8h14v3M6 11v8M18 11v8M4 15h16"/>',
  sign: '<rect x="4" y="4" width="16" height="11" rx="1"/><path d="M12 15v6M8 8h8M8 11h5"/>',
  deer: '<path d="M8 3l1 3-2 1M16 3l-1 3 2 1M9 7h6l1 4-2 2v7M10 13v7M8 11l1-4"/>',
  hand: '<circle cx="7" cy="5" r="2"/><circle cx="17" cy="5" r="2"/><path d="M7 8v6l-2 7M17 8v6l2 7M7 10h10"/>',
  stand: '<circle cx="12" cy="4.5" r="1.8"/><path d="M12 7v7M12 14l-2.5 7M12 14l2.5 7M9 10l3-2 3 2M19 12V5M16.5 7.5L19 5l2.5 2.5"/>',
  down: '<path d="M12 4v13M6 11l6 6 6-6M5 21h14"/>',
  fish: '<path d="M3 21L18 3M18 3v11a3 3 0 0 1-6 0"/><circle cx="12" cy="11" r="1.2"/><path d="M4 17c2 1 4 1 6 0"/>',
  reel: '<circle cx="9" cy="15" r="5.5"/><circle cx="9" cy="15" r="1.3"/><path d="M14.5 15H18v3M18 2v8M15 5l3-3 3 3"/>',
  eat: FORK_KNIFE, // 식사 (#50)
  cut: SCISSORS, // 머리 (#58)
  wear: SHIRT, // 옷 (#59)
  skip: '<path d="M5 5l7 7-7 7M13 5l7 7-7 7"/>',
};

// ---------- 상점·옷장 ----------
// 상점 팝업 (#26): 탭 도구·배낭·신발·옷. 장비 탭은 5단계 한 줄(가진 것 체크·다음 것 값·그 뒤 잠금)
const GEAR_ROWS = { tool: { k: 'tool', list: TOOLS }, bag: { k: 'bag', list: BAGS }, shoes: { k: 'shoes', list: SHOES }, weapon: { k: 'weapon', list: WEAPONS, battle: true } };
const gearKeys = () => Object.keys(GEAR_ROWS).filter((k) => (!GEAR_ROWS[k].battle || isBattle()) && !(k === 'shoes' && LEAPB)); // 무기 탭은 전투 오름에서만 (#38), 신발은 LEAP 이 있으면 거기서 (#59)
const SVG_A = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
// 단계마다 그림 (로우폴리 임시 아이콘)
const TIER_ART = {
  tool: ['<path d="M8 21v-7l-2-3V6a1 1 0 0 1 2 0v4M10 10V4a1 1 0 0 1 2 0v6M12 10V5a1 1 0 0 1 2 0v5M14 10V6a1 1 0 0 1 2 0v6l-2 9"/>', // 맨손
    '<path d="M10 3l1 18M14 3l-1 18M9 8h6"/>', // 집게
    '<path d="M12 3v11M6 21l2-7h8l2 7M10 14v7M14 14v7"/>', // 갈퀴
    '<path d="M12 2v11M4 21l2-8h12l2 8M8 13v8M12 13v8M16 13v8"/>', // 큰 갈퀴
    '<path d="M9 3h6v6H9zM12 9v6M7 15h10l-2 6H9zM17 5h3M17 7h2"/>'], // 흡입기
  bag: ['<path d="M8 10h8v10H8zM10 10V8a2 2 0 0 1 4 0v2"/>',
    '<path d="M7 9h10v11H7zM9.5 9V7a2.5 2.5 0 0 1 5 0v2M9 14h6"/>',
    '<path d="M6 8h12v13H6zM9 8V6a3 3 0 0 1 6 0v2M9 13h6v4H9z"/>',
    '<path d="M5 7h14v14H5zM8.5 7V5a3.5 3.5 0 0 1 7 0v2M8 12h8v5H8zM5 10H3v6h2M19 10h2v6h-2"/>',
    '<path d="M5 6h14v15H5zM8.5 6V4.5a3.5 3.5 0 0 1 7 0V6M8 11h8v6H8zM5 9H3v8h2M19 9h2v8h-2M7 3h10"/>'],
  shoes: ['<path d="M4 16h14a2 2 0 0 0-2-3h-3l-2-3H6l-2 3zM4 16v2h14v-2"/>',
    '<path d="M3 16h16a2 2 0 0 0-2-3h-3l-3-4H5l-2 4zM3 16v2h16v-2M8 9l1 2"/>',
    '<path d="M3 16h17a2 2 0 0 0-2-3h-3l-3-4H5l-2 4zM3 16v2h17v-2M6 18v1M10 18v1M14 18v1M18 18v1"/>',
    '<path d="M4 16h16a2 2 0 0 0-2-3h-3l-2-6H6v6l-2 0zM4 16v3h16v-3M7 9h5M7 11h5"/>',
    '<path d="M3 15h17a2 2 0 0 0-2-3h-3l-3-4H5l-2 4zM3 15v2h17v-2M1 9h4M2 12h3M20 7l2-2M21 10h2"/>'],
  weapon: ['<circle cx="9" cy="15" r="5"/><path d="M9 10c0-2 1-3 3-4M15 8l4-4M17 11h4"/>', // 손 (귤 던지기)
    '<path d="M6 3c7 2 11 8 9 18M6 3l9 18M10 12l10-6M20 6l-3-.5M20 6l-.5 3"/><circle cx="19" cy="6" r="1.6"/>', // 귤 활
    '<path d="M3 9h13l2 2v3H9l-1 5H5l1-5H3zM18 11h3M12 14v2"/><circle cx="20" cy="9" r="1.5"/>', // 귤 총
    '<path d="M2 9h15l2 2v3H9l-1 5H5l1-5H2zM19 10h3M19 12h3M19 14h3M8 9V6h5v3"/>', // 귤 머신건
    '<path d="M3 10h9v4H3zM12 11h2v2h-2M14 12h8M5 14l-1 5h3l1-5M7 7c1-2 3-2 4 0"/>', // 귤즙 레이저
    '<circle cx="11" cy="14" r="7"/><path d="M14 7l2-3M16 4l3 1M18 2v2M9 12c0-1 1-2 2-2"/>'], // 귤 폭탄
};
const STAT_ICON = {
  per: '<circle cx="6" cy="16" r="2.5"/><circle cx="12" cy="8" r="2.5"/><circle cx="18" cy="16" r="2.5"/>', // 한 번에 몇 개
  rate: '<path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/>', // 초당
  r: '<path d="M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3"/>', // 닿는 거리
  cap: '<path d="M7 8h10v12H7zM9.5 8V6a2.5 2.5 0 0 1 5 0v2"/>', // 배낭 칸
  speed: '<path d="M4 17l6-6 4 4 6-8M14 7h6v6"/>', // 빠르기
  dmg: '<path d="M12 3l2.5 6 6.5.5-5 4 1.5 6.5L12 16l-5.5 4L8 13.5l-5-4 6.5-.5z"/>', // 피해
};
const tierStats = (k, t) => t.soon ? [] : k === 'weapon' ? [['dmg', String(t.dmg)], ['r', `${t.range}m`]] : k === 'tool' ? [t.rate ? ['rate', `${t.rate}/s`] : ['per', `×${t.per}`], ['r', `${t.r}m`]]
  : k === 'bag' ? [['cap', String(t.cap)]] : [['speed', `×${String(t.speed.toFixed(2)).replace(/0$/, '')}`]];
const nextGear = (k) => { const n = GEAR_ROWS[k].list[save.equip[k]]; return n && !n.soon ? n : null; };
const canBuyGear = () => gearKeys().filter((k) => { const n = nextGear(k); return n && save.coins >= n.price; });
let shopTab = 'tool', shopPick = null; // shopPick: 장비 탭에서 고른 단계(없으면 다음 단계)
function openShop(tab) {
  if (cam.mode === 'wardrobe' || player.pose === 'sit') return; closePanels();
  if (LEAPB && (tab === 'wear' || tab === 'shoes')) tab = 'gear'; // 옷·신발 탭은 LEAP 으로 옮김 (#59)
  if (tab === 'gear' || !tab) { const ok = canBuyGear(); shopTab = ok[0] || (shopTab === 'wear' || !gearKeys().includes(shopTab) ? 'tool' : shopTab); } else shopTab = tab;
  if (GEAR_ROWS[shopTab] && !gearKeys().includes(shopTab)) shopTab = 'tool';
  shopPick = null; wearPick = null; shopHintUntil = 0; buildShop(); $('shop').hidden = false;
}
document.querySelectorAll('#shop-tabs [data-tab]').forEach((b) => b.addEventListener('click', () => { shopTab = b.dataset.tab; shopPick = null; wearPick = null; buildShop(); }));
function checkGearBadges() { // 장비 최고 단계 뱃지 (#13)
  const m = ['tool', 'bag', 'shoes'].map((k) => save.equip[k] >= 5);
  if (m.some(Boolean) && !ach.state.badges['b-gear-one']) ach.emit('gear-max-one');
  if (m.every(Boolean) && !ach.state.badges['b-gear-all']) ach.emit('gear-max-all');
}
// 사는 연출: 귤이 위 귤 칸에서 빠져나가 산 물건 쪽으로 날아가 사라지고, 숫자가 줄어든다
function spendFx(toEl, price, from, pill = document.querySelector('#shop .shop-coins'), num = $('shop-coins')) {
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
function buyGear(k) {
  const row = GEAR_ROWS[k], cur = save.equip[k], next = nextGear(k); if (!next) return;
  if (save.coins < next.price) { toast(`귤이 ${next.price - save.coins}개 모자라요`); return; }
  const from = save.coins;
  save.coins -= next.price; save.equip[k] = cur + 1;
  syncEquipGear(); runner.apply(save.outfit); persist(); updateStats(); updateTrashUI(true); net.send(true);
  if (k === 'weapon') { sound.coin?.(); ach.emit('weapon-buy'); ach.emit('weapon-buy-' + next.id); } // 무기 (#38)
  else { sound.coin?.(); ach.emit('gear-buy'); ach.emit('gear-buy-' + k); checkGearBadges(); }
  toast(`${next.name} · 바로 착용했어요`);
  shopPick = null; buildShop();
  const cell = document.querySelector(`#shop-body .tier[data-i="${cur}"]`);
  if (cell) { cell.classList.add('tier-pop'); spendFx(cell, next.price, from); }
}
function buildGearShop(body, k) {
  const row = GEAR_ROWS[k], cur = save.equip[k], pick = shopPick ?? (row.list[cur]?.soon ? cur - 1 : Math.min(cur, row.list.length - 1));
  const tiers = document.createElement('div'); tiers.className = 'tiers' + (row.list.length > 5 ? ' t6' : '');
  const CHECK = `${SVG_A} stroke-width="3"><path d="M5 12l5 5 9-10"/></svg>`, LOCK = `${SVG_A} stroke-width="2.5"><path d="M7 11h10v9H7zM9 11V8a3 3 0 0 1 6 0v3"/></svg>`;
  row.list.forEach((t, i) => {
    const own = i < cur, isNext = i === cur && !t.soon, lock = i > cur || !!t.soon;
    const c = document.createElement('button'); c.type = 'button'; c.dataset.i = i;
    c.className = 'tier' + (own ? ' own' : '') + (i === cur - 1 ? ' cur' : '') + (isNext ? ' next' : '') + (lock ? ' lock' : '') + (t.soon ? ' soon' : '');
    c.setAttribute('aria-pressed', String(i === pick)); c.setAttribute('aria-label', t.soon ? '준비 중' : `${t.name} ${i + 1}단계`);
    c.innerHTML = `<i class="st">${own ? CHECK : lock ? LOCK : `${SVG_A} stroke-width="3"><path d="M12 19V6M6 11l6-6 6 6"/></svg>`}</i>`
      + `${SVG_A.replace('<svg', '<svg class="art"')}>${TIER_ART[k][i]}</svg>`
      + (t.soon ? '' : `<span class="n">${tierStats(k, t)[0][1]}</span>`)
      + (own || t.soon ? '' : `<span class="pr"><i class="g"></i>${t.price.toLocaleString()}</span>`);
    c.addEventListener('click', () => { shopPick = i; buildShop(); });
    tiers.append(c);
  });
  const t = row.list[pick], now = cur ? row.list[cur - 1] : POCKET;
  if (t.soon) { // 아직 없는 무기: 잠긴 그림만
    const det = document.createElement('div'); det.className = 'tier-detail';
    const info = document.createElement('div'); info.innerHTML = `${SVG_A.replace('<svg', '<svg class="soon-art"')}>${TIER_ART[k][pick]}</svg>`;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tier-buy'; b.disabled = true; b.innerHTML = LOCK; b.setAttribute('aria-label', '준비 중');
    det.append(info, b); body.append(tiers, det); return;
  }
  const det = document.createElement('div'); det.className = 'tier-detail';
  const info = document.createElement('div');
  const stats = tierStats(k, t), was = pick === cur ? tierStats(k, now) : null;
  info.innerHTML = `<h3>${t.name}</h3><div class="tier-stats">${stats.map(([ic, v], j) => `<span>${SVG_A}>${STAT_ICON[ic]}</svg>${was && was[j] && was[j][1] !== v ? `<s>${was[j][1]}</s>→<em>${v}</em>` : v}</span>`).join('')}</div>`;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'tier-buy';
  if (pick < cur) { b.disabled = true; b.innerHTML = CHECK; b.setAttribute('aria-label', '가짐'); }
  else if (pick > cur) { b.disabled = true; b.innerHTML = `${LOCK}<span>${t.price.toLocaleString()}</span>`; b.setAttribute('aria-label', '앞 단계를 먼저 사요'); }
  else { b.innerHTML = `<i class="g"></i>${t.price.toLocaleString()}`; b.classList.toggle('short', save.coins < t.price); b.setAttribute('aria-label', `${t.name} 사기`); b.addEventListener('click', () => buyGear(k)); }
  det.append(info, b);
  body.append(tiers, det);
}
function buildShop() {
  const body = $('shop-body'); body.innerHTML = '';
  $('shop-coins').textContent = String(save.coins);
  document.querySelectorAll('#shop-tabs [data-tab]').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.tab === shopTab)); if (GEAR_ROWS[b.dataset.tab]?.battle) b.hidden = !isBattle(); if (b.dataset.tab === 'shoes' || b.dataset.tab === 'wear') b.hidden = !!LEAPB; }); // 옷·신발은 LEAP (#59)
  if (GEAR_ROWS[shopTab]) { buildGearShop(body, shopTab); return; }
  buildWearRows(body, true);
}
// ---------- 옷 (#52): 칸마다 한 줄. 옷 그림·단계 색·입은 것 체크·없는 것은 값. 가진 옷은 눌러서 바로 갈아입음 ----------
let wearPick = null; // 상점에서 고른 안 가진 옷 (아래에 능력치 지금 → 바뀔 값과 사기)
function wearCloth(slot, id) {
  if (id) CL.wear[slot] = id; else delete CL.wear[slot];
  syncEquipGear(); runner.apply(save.outfit); persist(); updateStats(); updateTrashUI(true); net.send(true);
}
function buyCloth(id) {
  const c = CLOTH[id]; if (!c || CL.own[id]) return false; const price = wearPrice(c);
  if (save.coins < price) { toast(`귤이 ${price - save.coins}개 모자라요`); return false; }
  const from = save.coins; save.coins -= price; CL.own[id] = 1; sound.coin?.(); ach.emit('clothes-buy'); ach.emit('clothes-buy-' + c.slot); // 업적 이벤트 (#59)
  wearPick = null; wearCloth(c.slot, id);
  if (!$('shop').hidden) { buildShop(); const cell = document.querySelector(`#shop-body .wear-item[data-id="${id}"]`); if (cell) { cell.classList.add('tier-pop'); spendFx(cell, price, from); } }
  toast(`${c.name} · 바로 입었어요`);
  return true;
}
function buildWearRows(body, shop) {
  const CHECK = `${SVG_A} stroke-width="3"><path d="M5 12l5 5 9-10"/></svg>`;
  WEAR.slots.forEach((w) => {
    const list = CLOTHES.filter((c) => c.slot === w.k && (shop || CL.own[c.id])).sort((a, b) => a.tier - b.tier);
    const row = document.createElement('div'); row.className = 'w-row wear-row';
    const cur = wearV(w.k), head = document.createElement('div'); head.className = 'wear-head';
    head.innerHTML = `<span class="wear-name">${w.name}</span><span class="wear-stat">${SVG_A}>${WEAR_STAT_ICON[w.stat]}</svg>${wearStatText(w.stat, cur)}</span>`;
    const grid = document.createElement('div'); grid.className = 'wear-grid';
    const cell = (c) => {
      const id = c?.id || '', has = !c || !!CL.own[id], on = c ? CL.wear[w.k] === id : !CL.wear[w.k], tier = c ? c.tier : 0, price = c ? wearPrice(c) : 0;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'wear-item' + (on ? ' on' : '') + (has ? ' has' : '') + (c ? '' : ' none'); b.dataset.id = id;
      b.style.setProperty('--tc', WEAR.tierColor[tier]); b.title = c ? `${c.name} · ${tier}단계` : '없음';
      b.setAttribute('aria-label', c ? `${c.name} ${tier}단계${has ? '' : ` 귤 ${price}`}` : `${w.name} 벗기`); b.setAttribute('aria-pressed', String(on));
      if (shop && !has) b.setAttribute('aria-expanded', String(wearPick === id));
      b.innerHTML = clothSvg(c) + (on ? `<i class="st">${CHECK}</i>` : '') + (has ? '' : `<span class="pr${save.coins < price ? ' short' : ''}"><i class="g"></i>${price.toLocaleString()}</span>`);
      b.addEventListener('click', () => { if (has) { wearPick = null; if (!on) wearCloth(w.k, id); if (shop) buildShop(); else buildWardrobe(); } else { wearPick = wearPick === id ? null : id; buildShop(); } });
      grid.append(b);
    };
    if (w.none) cell(null);
    list.forEach(cell);
    row.append(head, grid);
    const pc = shop && wearPick && CLOTH[wearPick]?.slot === w.k ? CLOTH[wearPick] : null;
    if (pc) { // 고른 옷: 능력치 지금 → 바뀔 값, 값
      const det = document.createElement('div'); det.className = 'tier-detail wear-detail';
      const nv = w.v[pc.tier], price = wearPrice(pc);
      det.innerHTML = `<div><h3><i class="tdot" style="background:${WEAR.tierColor[pc.tier]}"></i>${pc.name}</h3><div class="tier-stats"><span>${SVG_A}>${WEAR_STAT_ICON[w.stat]}</svg>${nv !== cur ? `<s>${wearStatText(w.stat, cur)}</s>→<em>${wearStatText(w.stat, nv)}</em>` : wearStatText(w.stat, nv)}</span></div></div>`;
      const bb = document.createElement('button'); bb.type = 'button'; bb.className = 'tier-buy' + (save.coins < price ? ' short' : ''); bb.innerHTML = `<i class="g"></i>${price.toLocaleString()}`; bb.setAttribute('aria-label', `${pc.name} 사기`);
      bb.addEventListener('click', () => buyCloth(pc.id)); det.append(bb); row.append(det);
    }
    body.append(row);
  });
}
// ---------- 캐릭터 고르기·머리 (#51) ----------
const HEAD_SVG = (key, skin = SKIN_TONES[0]) => { // 머리 그림 (상점·고르기 화면)
  const hair = '#2b2724', face = `<circle cx="20" cy="22" r="11" fill="${skin}"/><circle cx="16" cy="23" r="1.6" fill="#2b2724"/><circle cx="24" cy="23" r="1.6" fill="#2b2724"/>`;
  const H = {
    'hat:short': `${face}<path d="M8.5 21c0-8 5-12 11.5-12S31.5 13 31.5 21c-2-3-5-5-9-5-3 0-5 1-7 3-2-1-4 0-7 2z" fill="${hair}"/>`,
    'hat:bob': `<path d="M7.5 30V20c0-8 5.5-12 12.5-12s12.5 4 12.5 12v10h-5V21H12.5v9z" fill="${hair}"/>${face}<path d="M8.5 20c0-7 5-11 11.5-11s11.5 4 11.5 11c-4-1-7-2-11.5-2s-7.5 1-11.5 2z" fill="${hair}"/>`,
    'hat:bun': `<circle cx="20" cy="6.5" r="4.5" fill="${hair}"/>${face}<path d="M8.5 21c0-8 5-11.5 11.5-11.5S31.5 13 31.5 21c-3-2-6-3-11.5-3s-8.5 1-11.5 3z" fill="${hair}"/>`,
    'hat:cap': `${face}<path d="M8.5 19c0-7 5-10.5 11.5-10.5S31.5 12 31.5 19z" fill="#5c9a3c"/><path d="M27 18.5h8c0 1.5-1 2.5-3 2.5h-5z" fill="#4a8030"/>`,
  };
  return `<svg viewBox="0 0 40 40" aria-hidden="true">${H[key] || ''}</svg>`;
};
const HAIR_LABEL = { ...Object.fromEntries(HAIR.list.map((h) => [h.key, h.name])), 'hat:cap': '초록 모자' };
const wearHair = (key) => { save.outfit.gear = { ...(save.outfit.gear || {}), hair: key }; syncEquipGear(); runner.apply(save.outfit); persist(); net.send(true); };
// 머리는 루이네 미장원(#58)에서만 바꿈 (상점 옷 탭·옷장의 머리 줄은 없앰)
// 고르기 화면: 성별(기본 머리) 둘 + 피부색 셋 + 확인. 고르면 바로 캐릭터에 입혀 보임
function lookPreview() {
  const of = { ...save.outfit, skin: { color: SKIN_TONES[lookS.skin] }, gear: { ...(save.outfit.gear || {}), ...clothGear(), hair: HAIR.start[lookS.sex], hat: CL.wear.hat || 'hat:none' } };
  runner.apply(of);
  document.querySelectorAll('#look [data-sex]').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.sex === lookS.sex)); b.innerHTML = HEAD_SVG(HAIR.start[b.dataset.sex], SKIN_TONES[lookS.skin]); });
  document.querySelectorAll('#look [data-skin]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.skin === lookS.skin)));
}
function openLook() {
  if (lookS.open) return;
  cancelAll(); player.target = null; marker.visible = false;
  lookS.open = true; lookS.t = 0; lookS.sex = save.look?.sex || 'm'; lookS.skin = save.look?.skin || 0;
  cam.mode = 'look'; $('look').hidden = false; document.body.classList.add('looking'); lookPreview();
}
function closeLook() {
  save.look = { sex: lookS.sex, skin: lookS.skin };
  const start = HAIR.start[lookS.sex]; save.hairs[start] = 1;
  save.outfit.skin = { color: SKIN_TONES[lookS.skin] }; save.outfit.gear = { ...(save.outfit.gear || {}), hair: start }; syncEquipGear();
  lookS.open = false; $('look').hidden = true; document.body.classList.remove('looking'); cam.mode = 'follow';
  runner.apply(save.outfit); persist(); net.send(true); followCam(0, true);
}
{
  const sx = $('look-sex'), sk = $('look-skin');
  ['m', 'f'].forEach((v) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.sex = v; b.setAttribute('aria-label', v === 'm' ? '기본 남성 · 짧은 머리' : '기본 여성 · 단발'); b.addEventListener('click', () => { lookS.sex = v; lookPreview(); }); sx.append(b); });
  SKIN_TONES.forEach((c, i) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.skin = i; b.style.background = c; b.setAttribute('aria-label', ['밝은 피부', '중간 피부', '어두운 피부'][i]); b.addEventListener('click', () => { lookS.skin = i; lookPreview(); }); sk.append(b); });
  $('look-ok').addEventListener('click', closeLook);
}
let camBefore = null;
function buildWardrobe() { // 옷장 (#52): 가진 머리·옷만, 눌러서 갈아입기
  const body = $('wardrobe-body'); body.innerHTML = '';
  buildWearRows(body, false);
}
function openWardrobe() {
  if (busy()) return;
  player.target = null; marker.visible = false;
  camBefore = { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist };
  cam.mode = 'wardrobe'; buildWardrobe();
  $('nick-mirror').textContent = save.nick;
  $('wardrobe').hidden = false;
}
function closeWardrobe() { $('wardrobe').hidden = true; cam.mode = 'follow'; if (camBefore) Object.assign(cam, camBefore); }
$('wardrobe-shop').addEventListener('click', () => { closeWardrobe(); openShop('wear'); });
$('wardrobe-shop').hidden = !!LEAPB; // 옷은 LEAP 에서 삼 (#59)
$('wardrobe-done').addEventListener('click', closeWardrobe);
$('nick-reroll').addEventListener('click', () => { save.nick = `${pick(ADJ)} ${pick(NOUN)}`; $('nick-mirror').textContent = save.nick; persist(); });

function openSign() { closePanels(); $('sign').hidden = false; ach.emit('sign'); }
$('sign-body').innerHTML = spots.sign.html;

// 탐방로 고르기
let introMap = MAP_ID;
function buildMapPick(box, go) {
  box.innerHTML = '';
  Object.values(MAPS).filter((m) => !m.hidden || m.id === MAP_ID).forEach((m) => {
    const b = document.createElement('button'); b.type = 'button';
    b.setAttribute('aria-pressed', String((go ? MAP_ID : introMap) === m.id));
    const t = document.createElement('b'); t.textContent = m.name; const s = document.createElement('small'); s.textContent = m.id === 'donnaeko' ? '숲길 따라 백록담 남벽까지' : '억새 오름과 굼부리 둘레';
    b.append(t, s);
    b.addEventListener('click', () => {
      if (go) { if (m.id !== MAP_ID) switchMap(m.id); else $('maps').hidden = true; }
      else { introMap = m.id; buildMapPick(box, false); }
    });
    box.append(b);
  });
}
function switchMap(id) { save.prevMap = MAP_ID; save.map = id; persist(); location.hash = id; location.reload(); }
let leaving = false;
function leaveTo(id) {
  leaving = true; player.target = null; player.onArrive = null;
  if (save.tut && !save.tut.done) { save.tut.done = true; }
  save.entered = 1; save.introSound = sound.on ? 1 : 0; persist();
  $('flash').hidden = false; $('flash').classList.remove('go'); $('flash').style.transition = 'opacity .5s'; $('flash').style.opacity = '0'; requestAnimationFrame(() => { $('flash').style.opacity = '1'; });
  setTimeout(() => switchMap(id), 520);
}
buildMapPick($('intro-pick'), false); $('intro-pick').hidden = true;

// ---------- 소리·후크 ----------
const sound = new Sound();
sound.forest = MAP_ID === 'donnaeko';
if (!save.music || typeof save.music !== 'object') save.music = { on: 1, vol: MUSIC.vol }; // 예전 저장엔 없음 (#64)
save.music.vol = Math.max(0, Math.min(1, Number.isFinite(+save.music.vol) ? +save.music.vol : MUSIC.vol));
sound.setMusic(save.music.on); sound.setMusicVol(save.music.vol); setSoundUI();
life.bind(player, sound);
life.hooks.enemyHit = (dir, def) => {
  if (player.air && player.jumpV > 0) return;
  if (hp.isDown || hp.pending) return;
  if (player.riding) dismountDeer();
  player.kb.copy(dir).multiplyScalar(BOAR.knockSpeed); player.air = true; player.jumpV = BOAR.knockV; player.jumpY = 0.01;
  player.target = null; marker.visible = false; player.pose = 'move';
  player.knock = { t: 0, land: -1, ang: 0, spin: 0, ax: -dir.z, az: dir.x };
  // 가진 귤의 일부가 주변에 흩어짐 (#32): 가진 귤의 10%(3~15개), 가진 것보다 많이는 안 흩어짐
  const n = Math.min(save.coins, Math.max(SCATTER.min, Math.min(SCATTER.max, Math.round(save.coins * SCATTER.frac))));
  if (n > 0) { save.coins -= n; persist(); updateStats(); life.scatterTangerines(player.pos, n); }
  const downed = hp.hit(def.dmg * (1 - wearV('jacket'))); // 잠바(#52): 받는 피해 줄임
  // 전투 오름만 (#36), 피해는 적 표(ENEMIES). 0 이 되면 넉백이 끝난 뒤 쓰러짐
  sound.stone(); if (downed) return; toast(n > 0 ? `${def.name}에 받혔어요! 귤 ${n}개가 흩어졌어요` : `${def.name}에 받혔어요! 귤을 던지면 도망가요`);
};
// 받혀 날아가 구르고 일어나는 동안(#32) 조작 잠금. 날 때 뒤로 눕고 → 착지 뒤 구르고 → 일어남
function tickKnock(dt) {
  const k = player.knock; if (!k) return;
  k.t += dt;
  if (player.air) { k.ang = Math.min(1.45, k.ang + dt * 5); }
  else {
    if (k.land < 0) k.land = k.t;
    const g = k.t - k.land;
    if (g < BOAR.rollT) { k.ang = 1.45; k.spin = (g / BOAR.rollT) * Math.PI * 2; }
    else if (g < BOAR.rollT + BOAR.getUpT) { const u = (g - BOAR.rollT) / BOAR.getUpT; k.ang = 1.45 * (1 - u * u * (3 - 2 * u)); k.spin = 0; }
    else player.knock = null;
  }
}
const _kq = new THREE.Quaternion(), _ka = new THREE.Vector3();
// 적 (#37): 나타남(경고) · 스스로 떠남 · 쫓아냄(귤 흩뿌림·드문 쓰레기) · 땅 헤집기(쓰레기 흘림)
const ENEMY_NAME = (k) => ENEMIES[k]?.name || '적';
const iga = (w) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return w + (c >= 0 && c < 11172 && c % 28 ? '이' : '가'); };
life.hooks.enemyWave = (w) => { toast(`${ENEMY_NAME(w.kind)} ${w.n}마리가 나타났어요! 귤을 맞히면 도망가요`); enemyWarn.start(w); };
life.hooks.enemyGone = (kind) => { if (!life.enemies.list.length) toast(`${iga(ENEMY_NAME(kind))} 숲으로 돌아갔어요`); };
life.hooks.enemyRepel = (kind, pos, def) => {
  life.scatterTangerines(pos, def.reward.gyul);
  if (trash && Math.random() < def.reward.rare) { const rares = DEX_LIST.filter((d) => d.rare), dx = rares[Math.floor(Math.random() * rares.length)]; const isNew = trash.store.dexAdd(dx.id); trash.store.commit(); onDexGet(dx, isNew); }
  ach.emit('enemy-repel'); ach.emit('enemy-repel-' + kind);
  if (kind === 'boar') ach.emit('boar-repel');
};
life.hooks.enemyRoot = (kind, pos, n) => { if (trash) trash.drop(pos.x, pos.z, n, ENEMIES[kind]?.rootR || 14); };
// 나타날 때 화면 가장자리 방향 표시 (적: 빨간 느낌표, 투기꾼 #47: 봉투 아이콘)
function makeEdgeWarn(id, html, dur) {
  const el = document.createElement('div'); el.id = id; el.hidden = true; el.setAttribute('aria-hidden', 'true'); el.innerHTML = html; document.body.appendChild(el);
  let t = 0; const at = new THREE.Vector3(), v = new THREE.Vector3();
  return {
    start(w) { at.set(w.x, height(w.x, w.z) + 1, w.z); t = dur; el.hidden = false; },
    update(dt) {
      if (t <= 0) return; t -= dt; if (t <= 0) { el.hidden = true; return; }
      v.copy(at).project(camera); let x = v.x, y = v.y;
      if (v.z > 1) { x = -x; y = -y; } // 뒤쪽이면 뒤집음
      const W = innerWidth, H = innerHeight, m = 34;
      { const k = 1 / Math.max(Math.abs(x), Math.abs(y), 1e-3); x *= k; y *= k; } // 늘 가장자리, 무리 쪽 방향
      const px = Math.min(W - m, Math.max(m, (x * 0.5 + 0.5) * W)), py = Math.min(H - m, Math.max(topFit.bottom + 72, (-y * 0.5 + 0.5) * H));
      el.style.transform = `translate(${px - 22}px, ${py - 22}px)`; el.style.opacity = String(Math.min(1, t * 2) * (0.75 + 0.25 * Math.abs(Math.sin(t * 9))));
    },
    get t() { return t; },
  };
}
const enemyWarn = makeEdgeWarn('enemy-warn', '!', ENEMY_SPAWN.warnT);
// 쓰레기 투기꾼·투기 트럭 (#47): 주기적으로 와서 더미를 다시 쌓음. 버리기 전에 귤을 맞히면 도망. 깨끗한 오름·전투 오름 둘 다
const DUMP_IC = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M9 3h6l-1.2 3.2c3 1.2 5.2 4.3 5.2 7.8 0 4-3.1 7-7 7s-7-3-7-7c0-3.5 2.2-6.6 5.2-7.8z"/></svg>';
const dumpWarn = makeEdgeWarn('dump-warn', DUMP_IC, DUMP.warnT);
const dumpers = trash ? createDumpers({
  scene, trash, height, paths: nsPaths,
  bound: { line: NSB.boundLine, insideBy: NSB.insideBy, center: NSB.BOUND_CENTER },
  avoid: NS_TUT ? (() => { const L = NSB.crossLine(TUT.gateD); return (x, z) => (x - L.c.x) * L.fx + (z - L.c.z) * L.fz < 6 && Math.hypot(x - L.c.x, z - L.c.z) < 260; })() : null, // 들머리 튜토리얼 쪽 길은 트럭이 안 지남
  hooks: {
    canSpawn: () => !NS_TUT || !!save.jeong || !!save.tut?.done, // 튜토리얼 중엔 안 옴
    appear: (d) => { tips.event('dumper'); dumpWarn.start({ x: d.pos.x, z: d.pos.z }); toast(d.kind === 'truck' ? '투기 트럭이 와요! 귤을 맞혀 쫓아내요' : '무단투기꾼이 와요! 귤을 맞혀 쫓아내요'); },
    dumped: (d, n) => { if (n && d.pos.distanceTo(player.pos) < 120) toast(`${iga(d.def.name)} 쓰레기 ${n}개를 버리고 갔어요`); },
    repel: (kind, pos, def) => {
      life.scatterTangerines(pos, def.reward);
      sound.beep?.(true); toast(`${iga(def.name)} 놀라 도망가요`);
      ach.emit('dumper-repel'); ach.emit('dumper-repel-' + kind);
    },
    offline: (n) => toast(`자리를 비운 사이 쓰레기 ${n}개가 다시 쌓였어요`),
  },
}) : null;
if (dumpers) { dumpers.bind(player, sound); life.addTargets(dumpers); dumpers.start(); }
life.hooks.hareubang = () => { ach.emit('hareubang'); tut.notify('hareubang'); };
life.hooks.pickup = (n) => { tut.notify('pickup'); save.coins += n; persist(); updateStats(); sound.coin?.(); ach.emit('pickup', n); };
// 귤 줍는 효과: 그 자리에서 +1이 떠오르고 귤이 왼쪽 위 귤 칸으로 날아감
life.hooks.pickupAt = (wp) => coinFx(wp, 1);
life.hooks.reclaim = (wp) => { save.coins += 1; persist(); updateStats(); sound.coin?.(); coinFx(wp, 1); };
// 귤 먹기 이펙트: 즙 방울·껍질 조각이 튀고, 화면 가장자리가 귤빛으로 번쩍, 체력바가 반짝
const juicePool = [];
const juiceGeo = new THREE.SphereGeometry(0.06, 6, 4);
const peelGeo = new THREE.BoxGeometry(0.1, 0.02, 0.07);
const juiceMats = ['#ffb340', '#ff9a1f', '#ffd36b'].map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true }));
const peelMat = new THREE.MeshLambertMaterial({ color: '#f29a2e', transparent: true });
function juiceBurst() {
  const head = player.pos.clone(); head.y += 1.55 + player.jumpY;
  const fwd = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
  head.addScaledVector(fwd, 0.25);
  for (let i = 0; i < 26; i++) {
    const peel = i >= 20;
    const m = new THREE.Mesh(peel ? peelGeo : juiceGeo, peel ? peelMat.clone() : juiceMats[i % 3].clone());
    m.position.copy(head);
    const a = Math.random() * Math.PI * 2, up = 1.5 + Math.random() * 2.5, sp = 1 + Math.random() * 2.2;
    const v = new THREE.Vector3(Math.cos(a) * sp, up, Math.sin(a) * sp).addScaledVector(fwd, 1.2);
    const sc = peel ? 1 : 0.6 + Math.random() * 0.9; m.scale.setScalar(sc);
    scene.add(m); juicePool.push({ m, v, t: 0, life: 0.7 + Math.random() * 0.4, spin: peel ? (Math.random() - 0.5) * 20 : 0 });
  }
}
function tickJuice(dt) {
  for (let i = juicePool.length - 1; i >= 0; i--) {
    const j = juicePool[i]; j.t += dt;
    j.v.y -= 9.8 * dt; j.m.position.addScaledVector(j.v, dt);
    if (j.spin) { j.m.rotation.x += j.spin * dt; j.m.rotation.z += j.spin * 0.7 * dt; }
    const k = j.t / j.life; j.m.material.opacity = 1 - k * k;
    const gy = height(j.m.position.x, j.m.position.z) + 0.03;
    if (j.m.position.y < gy) { j.m.position.y = gy; j.v.set(0, 0, 0); }
    if (k >= 1) { scene.remove(j.m); j.m.material.dispose(); juicePool.splice(i, 1); }
  }
}
// 귤이 화면 위에서 쏟아져 귤 알약으로 들어감 (첫 보너스 #31)
function gyulShower(n) {
  updateStats(); const pill = $('gyul-pill'), r0 = pill.querySelector('i').getBoundingClientRect(), tgt = r0.width > 0 ? r0 : { left: 24, top: 24 }, k = LOW ? 14 : 28;
  for (let i = 0; i < k; i++) setTimeout(() => {
    const dot = document.createElement('div'); dot.className = 'fx-gyul'; const sx = innerWidth * (0.3 + Math.random() * 0.4), sy = -20 - Math.random() * 30;
    dot.style.left = sx + 'px'; dot.style.top = sy + 'px'; document.body.append(dot);
    const mx = sx + (Math.random() - 0.5) * 160, my = innerHeight * (0.35 + Math.random() * 0.2);
    dot.style.transition = 'transform .45s cubic-bezier(.4,0,.9,.6)'; requestAnimationFrame(() => requestAnimationFrame(() => { dot.style.transform = `translate(${mx - sx}px, ${my - sy}px)`; }));
    setTimeout(() => { dot.style.transition = 'transform .5s cubic-bezier(.5,-0.2,.6,1), opacity .5s'; dot.style.transform = `translate(${tgt.left + 8 - sx}px, ${tgt.top + 8 - sy}px) scale(.6)`; }, 470);
    setTimeout(() => { dot.remove(); pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump'); if (i % 4 === 0) sound.coin?.(); }, 1000);
  }, i * 45);
  const plus = document.createElement('div'); plus.className = 'fx-plus'; plus.textContent = `+${n}`; plus.style.left = (tgt.left + 40) + 'px'; plus.style.top = (tgt.top + 34) + 'px';
  setTimeout(() => { document.body.append(plus); setTimeout(() => plus.remove(), 1000); }, k * 45 + 900);
}
function coinFx(wp, n) {
  const v = wp.clone(); v.y += 0.6; v.project(camera);
  if (v.z > 1) return;
  const sx = (v.x * 0.5 + 0.5) * innerWidth, sy = (-v.y * 0.5 + 0.5) * innerHeight;
  const plus = document.createElement('div'); plus.className = 'fx-plus'; plus.textContent = `+${n}`;
  plus.style.left = sx + 'px'; plus.style.top = sy + 'px'; document.body.append(plus);
  const dot = document.createElement('div'); dot.className = 'fx-gyul';
  dot.style.left = sx + 'px'; dot.style.top = sy + 'px'; document.body.append(dot);
  const tgt = document.querySelector('.gyul i').getBoundingClientRect();
  requestAnimationFrame(() => { dot.style.transform = `translate(${tgt.left + 8 - sx}px, ${tgt.top + 8 - sy}px) scale(.6)`; dot.style.opacity = '0.9'; });
  setTimeout(() => { dot.remove(); const g = document.querySelector('.gyul'); g.classList.remove('bump'); void g.offsetWidth; g.classList.add('bump'); }, 620);
  setTimeout(() => plus.remove(), 900);
}
life.hooks.fed = () => { ach.emit('feed'); ach.emit('follower'); };
life.hooks.hitRunner = (who) => {
  if (who === 'me') { player.yellowUntil = Date.now() + 6000; net.send(true); }
  else net.hitPeer(who);
};
runner.setTint(false);
function setSoundUI() {
  $('menu-sound').setAttribute('aria-pressed', String(sound.on));
  $('menu-music').setAttribute('aria-pressed', String(!!(sound.on && save.music.on)));
  $('music-vol').value = String(Math.round(save.music.vol * 100));
}
// 적 근처면 긴장 음악 (#64): 몹·멧돼지(enemies) + 투기꾼·투기 트럭(dumpers)
function threatNear() {
  if (life.enemies.near(player.pos, MUSIC.near)) return true;
  return !!dumpers && dumpers.list.some((d) => d.state !== 'flee' && d.state !== 'startle' && d.state !== 'leave' && Math.hypot(d.pos.x - player.pos.x, d.pos.z - player.pos.z) < MUSIC.near);
}
// ---------- 서버 고르기 (#35) ----------
let introSrv = save.server || null; // 처음 온 사람은 아직 안 고름
const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
function buildSrvPick(box, sel, onPick) {
  box.innerHTML = ''; box.classList.toggle('chosen', !!sel);
  SERVERS.forEach((id) => {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.srv = id;
    b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(sel === id)); b.setAttribute('aria-label', SERVER_LABEL[id]); b.title = SERVER_LABEL[id];
    b.innerHTML = SERVER_ART[id] + '<i>' + CHECK_SVG + '</i>';
    b.addEventListener('click', () => onPick(id));
    box.append(b);
  });
}
function syncIntroSrv() {
  buildSrvPick($('intro-srv'), introSrv, (id) => { introSrv = id; syncIntroSrv(); });
  $('enter-sound').disabled = $('enter-quiet').disabled = !introSrv;
}
syncIntroSrv();
// 시작 화면에서 고른 서버 적용 (아직 아무것도 시작하기 전이라 새로고침 없이 바꿔 끼움)
function applyIntroSrv() {
  if (!introSrv) return;
  if (introSrv !== serverId()) { setServerId(introSrv); if (trash) { const sw = () => { trash.store.setServer(introSrv); trash.relayout(); }; if (bloom) { bloom.resync(sw); syncBloomDeer(); lastZoneUI = ''; updateTrashUI(false); } else sw(); } }
  save.server = introSrv; persist();
}
// 메뉴: 서버 바꾸기 → 저장하고 새로고침 (새로고침 뒤 바로 입장)
function openServer() {
  closePanels();
  buildSrvPick($('server-pick'), serverId(), (id) => {
    if (id === serverId()) { $('server').hidden = true; return; }
    save.server = id; save.srvSwitch = 1; save.introSound = sound.on ? 1 : 0; ab.flush(); persist(); location.reload();
  });
  $('server').hidden = false;
}
$('menu-server').addEventListener('click', openServer);
function enter(withSound) {
  if (!introSrv) return;
  applyIntroSrv(); startSession();
  if (introMap !== MAP_ID) { save.introSound = withSound ? 1 : 0; switchMap(introMap); return; }
  if (withSound) sound.start();
  setSoundUI();
  canvas.focus({ preventScroll: true });
  $('intro').hidden = true; $('intro-help').hidden = true;
  if (!save.entered) { save.entered = 1; persist(); awe = 5; cam.dist = 30; cam.pitch = 0.35; $('intro-help').hidden = false; }
  if (!save.look) openLook();
}
$('enter-sound').addEventListener('click', () => enter(true));
$('enter-quiet').addEventListener('click', () => enter(false));
document.addEventListener('visibilitychange', () => { if (!sound.ctx) return; if (document.hidden) sound.ctx.suspend(); else if (sound.on) sound.ctx.resume(); });
// 다른 탐방로로 막 옮겨 왔으면 바로 입장
if (((prevMap && prevMap !== MAP_ID) || srvSwitched) && save.entered && save.server) { $('intro').hidden = true; startSession(); if (!save.look) openLook(); if (srvSwitched) setTimeout(() => toast(SERVER_LABEL[serverId()]), 600); if (save.introSound) { const once = () => { sound.start(); setSoundUI(); removeEventListener('pointerdown', once); }; addEventListener('pointerdown', once); } }
if (prevMap && prevMap !== MAP_ID && prevMap !== 'gate' && MAP_ID !== 'gate') ach.emit('visit-other');
if (Object.keys(ach.state.visited).length >= 2 && !ach.state.badges['b-both']) ach.emit('visit-both');

// ---------- 갱신 ----------
function updatePlayer(dt) {
  const p = player;
  p.poseT += dt;
  if (hp.isDown) { marker.visible = false; placeRunner(dt); return; } // 쓰러져 들것에 실려 가는 중 (#36)
  if (stream && stream.update(dt, p)) { marker.visible = false; placeRunner(dt); return; } // 개울에 빠져 건져 올려지는 중 (#31)
  if (p.pose === 'wave' && p.poseT > 2.2) p.pose = 'move';
  const aiming = (p.pose === 'throw' || p.pose === 'bow') && !!throwAim;
  if (aiming) p.heading += wrapA(aimHeading(throwAim) - p.heading) * Math.min(1, dt * 18); // 겨눈 대상 쪽으로 몸을 돌림
  if (p.pose === 'throw') { if (throwPending && p.poseT >= THROW.release) releaseTangerine(); if (p.poseT >= THROW.total) p.pose = 'move'; }
  else if (throwPending) { throwPending = false; throwAim = null; }
  if (p.pose === 'bow') { if (bowPending && p.poseT >= BOW.release) releaseArrow(); if (p.poseT >= BOW.total) p.pose = 'move'; } // 귤 활 (#38)
  else if (bowPending) { bowPending = false; throwAim = null; }
  if (holdBow && !bowReady()) setHoldBow(false); // 깨끗한 오름으로 바꾸면 활을 내려놓음
  if (p.pose === 'dance' && p.poseT > 6) p.pose = 'move';
  if (cheerQ > 0) { cheerQ -= dt; if (p.pose === 'move' && !p.air && !busy()) { cheerQ = 0; p.pose = 'cheer'; p.poseT = 0; } } // 더미를 다 치우면 기뻐함 (#65), 줍던 동작이 끝난 뒤
  if (p.pose === 'cheer' && p.poseT > BLOOM_FX.cheerT) p.pose = 'move';
  if (p.pose === 'crouch' && p.poseT > 1.0) p.pose = 'move';

  let dir = null;
  if (!busy() && !p.knock && p.pose !== 'wave' && p.pose !== 'photo-wait') {
    let fx = 0, fz = 0;
    if (keys.has('w') || keys.has('arrowup')) fz -= 1;
    if (keys.has('s') || keys.has('arrowdown')) fz += 1;
    if (keys.has('a') || keys.has('arrowleft')) fx -= 1;
    if (keys.has('d') || keys.has('arrowright')) fx += 1;
    if ((fx || fz || joy.active) && (p.pose === 'dance' || p.pose === 'cheer')) p.pose = 'move';
    const jm = Math.hypot(joy.x, joy.y);
    if (joy.active && jm > 0.15) {
      // 조이스틱: 화면 기준 방향 (카메라가 보는 쪽이 위)
      p.target = null; p.onArrive = null; marker.visible = false;
      const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
      dir = new THREE.Vector3(joy.x * c + joy.y * s, 0, -joy.x * s + joy.y * c).normalize();
      p.joyMag = jm;
      if (!p.riding && !aiming) { let dh = wrapA(Math.atan2(dir.x, dir.z) - p.heading); p.heading += dh * Math.min(1, dt * 10); }
      if (ptrs.size === 0 && camHold <= 0) { const dy = wrapA((p.heading + Math.PI) - cam.yaw); cam.yaw += dy * Math.min(1, dt * 0.8); }
    } else if (fx || fz) {
      p.target = null; p.onArrive = null; marker.visible = false; p.joyMag = 1;
      if (fx) { if (p.riding) p.riding.heading -= fx * dt * 2.6; else if (!aiming) p.heading -= fx * dt * 2.6; }
      const hh = p.riding ? p.riding.heading : p.heading;
      if (fz) dir = new THREE.Vector3(Math.sin(hh), 0, Math.cos(hh)).multiplyScalar(-fz);
      const dy = wrapA((hh + Math.PI) - cam.yaw);
      if (ptrs.size === 0 && camHold <= 0) cam.yaw += dy * Math.min(1, dt * (fz ? 3 : 1.5));
    } else if (p.target) {
      p.joyMag = 1;
      tmp.copy(p.target).sub(p.pos).setY(0);
      const d = tmp.length();
      if (d < (p.onArrive ? 0.35 : 0.8)) { p.target = null; marker.visible = false; const cb = p.onArrive; p.onArrive = null; if (cb) cb(); }
      else dir = tmp.normalize();
    }
  }
  p.driving = !!dir;
  if (dir && fishing?.active) fishing.stop(); // 움직이면 낚시를 그만둠 (#44)
  // 손잡고 있을 때: 움직이는 쪽이 끌고, 가만히 있는 쪽은 옆에 붙어 따라감
  const partner = net.hand.with && net.peersById.get(net.hand.with);
  if (partner && !busy() && !p.riding) {
    const pd = typeof partner.data.drv === 'number' && Date.now() - partner.data.drv < 600;
    if (pd && (!dir || partner.peer < net.myPeer)) {
      dir = null; p.driving = false; p.target = null; marker.visible = false;
      const right = new THREE.Vector3(Math.cos(partner.heading), 0, -Math.sin(partner.heading));
      const goal = partner.pos.clone().addScaledVector(right, 1.3 * p.handSide);
      const prev = p.pos.clone();
      p.pos.lerp(goal, Math.min(1, dt * 10)); p.pos.y = height(p.pos.x, p.pos.z);
      p.heading += wrapA(partner.heading - p.heading) * Math.min(1, dt * 8);
      p.running = !!partner.data.run;
      const moved = prev.distanceTo(p.pos);
      p.speed += (moved / Math.max(dt, 1e-3) - p.speed) * Math.min(1, dt * 8);
      countSteps(moved);
      if (ptrs.size === 0) cam.yaw += wrapA((p.heading + Math.PI) - cam.yaw) * Math.min(1, dt * 2);
      tickJump(dt); placeRunner(dt); return;
    }
  }
  if (p.riding) {
    const d = p.riding;
    const want = dir ? (p.running ? 15 : 9) * (p.joyMag > 0.75 || !joy.active ? 1 : 0.6) : 0;
    d.speed += (want - d.speed) * Math.min(1, dt * 5);
    if (dir && (joy.active || p.target)) d.heading += wrapA(Math.atan2(dir.x, dir.z) - d.heading) * Math.min(1, dt * 6);
    if (d.speed > 0.05) {
      let nx = d.pos.x + Math.sin(d.heading) * d.speed * dt, nz = d.pos.z + Math.cos(d.heading) * d.speed * dt;
      const cl = spots.clamp(nx, nz); if (cl) { nx = cl.x; nz = cl.z; }
      if (col) { const r = col.move(d.pos.x, d.pos.z, nx, nz, 0.9); nx = r.x; nz = r.z; }
      const moved = Math.hypot(nx - d.pos.x, nz - d.pos.z);
      d.pos.set(nx, height(nx, nz), nz);
      d.phase += dt * d.speed * 1.4;
      p.hoofAcc = (p.hoofAcc || 0) + d.speed * dt; if (p.hoofAcc > 1.6) { p.hoofAcc = 0; sound.step(surfaceAt(nx, nz), true); }
      p.rideAcc = (p.rideAcc || 0) + moved * 1.9; if (p.rideAcc >= 10) { ach.emit('ride-dist', Math.floor(p.rideAcc)); p.rideAcc %= 1; p.rideAcc = 0; }
    }
    p.heading = d.heading; p.speed = d.speed;
    p.pos.copy(d.pos);
    checkViewpoint();
    runner.root.position.copy(p.pos); runner.root.position.y += 0.95 + (d.speed > 4 ? Math.abs(Math.sin(d.phase * 0.5)) * 0.25 : 0);
    runner.root.rotation.y = p.heading;
    followLight(); return;
  }
  const slow = joy.active && p.joyMag < 0.6;
  const want = dir ? (slow ? 4 : p.running ? 10 : 5) * SHOES[save.equip.shoes - 1].speed * buff.mul('speed') : 0; // 신발 단계만큼 빨라짐
  p.speed += (want - p.speed) * Math.min(1, dt * 8);
  if (dir) {
    if (p.target) p.heading += wrapA(Math.atan2(dir.x, dir.z) - p.heading) * Math.min(1, dt * 12);
    let x = p.pos.x + dir.x * p.speed * dt, z = p.pos.z + dir.z * p.speed * dt;
    const cl = spots.clamp(x, z);
    if (cl) { x = cl.x; z = cl.z; if (cl.hit && (!p.wallToast || performance.now() - p.wallToast > 8000)) { p.wallToast = performance.now(); toast(cl.hit); } }
    { const g = spots.gateHint; if (g && Math.hypot(x - g.x, z - g.z) < g.r && (!p.wallToast || performance.now() - p.wallToast > 8000)) { p.wallToast = performance.now(); toast(g.line); } }
    if (col && p.pose !== 'sit') { const want = p.speed * dt, r = col.move(p.pos.x, p.pos.z, x, z); x = r.x; z = r.z;
      // 탭 이동 중 사물에 막혀 못 나아가면 멈춤 (도착 콜백이 있고 거의 다 왔으면 도착으로 침)
      if (p.target && want > 0.01 && Math.hypot(x - p.pos.x, z - p.pos.z) < want * 0.3) { p.stuckT = (p.stuckT || 0) + dt;
        if (p.stuckT > COLLIDE.stuckT) { p.stuckT = 0; const cb = p.onArrive, near = Math.hypot(p.target.x - p.pos.x, p.target.z - p.pos.z) < 3; p.target = null; p.onArrive = null; marker.visible = false; if (cb && near) cb(); }
      } else p.stuckT = 0; }
    const moved = Math.hypot(x - p.pos.x, z - p.pos.z);
    if (spots.exits && !leaving) for (const ex of spots.exits) if (Math.hypot(x - ex.pos.x, z - ex.pos.z) < ex.r) { leaveTo(ex.id); break; }
    const gy = groundAt(x, z);
    // 계단 단 차이는 살짝 부드럽게 오르내림
    p.pos.set(x, gy, z);
    countSteps(moved);
    checkViewpoint();
    if (spots.laps) {
      const r = Math.hypot(x, z);
      if (Math.abs(r - R_RIM) < 9) {
        const a = Math.atan2(z, x);
        if (p.lapPrevA !== null) p.lapAcc += wrapA(a - p.lapPrevA);
        p.lapPrevA = a;
        if (Math.abs(p.lapAcc) >= Math.PI * 2) { p.laps++; p.lapAcc = 0; persist(); toast(`굼부리 둘레 ${p.laps}바퀴째예요`); ach.emit('lap'); }
      } else { p.lapPrevA = null; p.lapAcc = 0; }
    }
  } else if (p.pose !== 'sit') p.pos.y = groundAt(p.pos.x, p.pos.z);
  if (p.pose === 'sit') p.pos.y = mealS.on ? STN.seat.y : cutS.on ? SAL.seat.y : benchPos.y;
  if (p.kb.lengthSq() > 0.01) {
    let nx = p.pos.x + p.kb.x * dt, nz = p.pos.z + p.kb.z * dt;
    const cl = spots.clamp(nx, nz); if (cl) { nx = cl.x; nz = cl.z; }
    if (col) { const r = col.move(p.pos.x, p.pos.z, nx, nz); nx = r.x; nz = r.z; }
    p.pos.set(nx, height(nx, nz), nz);
    p.kb.multiplyScalar(Math.max(0, 1 - dt * 2.2));
  }
  tickJump(dt); placeRunner(dt);
}
function countSteps(moved) {
  const p = player;
  p.strideAcc += moved;
  const stride = p.running ? 1.7 : 1.1;
  let n = 0;
  while (p.strideAcc >= stride) { p.strideAcc -= stride; p.steps++; save.totalSteps++; n++; sound.step(surfaceAt(p.pos.x, p.pos.z), p.running); if (!p.air && !p.riding) prints.stamp(p.pos.x, p.pos.z, p.heading, p.running ? 1 : 0); }
  if (n) ach.emit('steps', n);
}
function checkViewpoint() {
  if (player.viewSeen || !spots.isViewpoint(player.pos)) return;
  player.viewSeen = true; awe = 4; toast(spots.viewpointLine);
  ach.emit('view-' + MAP_ID);
}
function placeRunner(dt = 1) {
  // 계단·턱: 논리 위치는 땅에 딱 붙이고, 보이는 높이만 부드럽게 따라가 덜그럭거림을 없앰 (큰 낙차는 바로 반영)
  // 비탈처럼 걸음에 비례해 이어지는 높이 변화는 바로 따라가고(늦게 따라가면 오르막에서 하반신이 땅에 묻힘), 계단처럼 툭 끊기는 변화만 부드럽게.
  // 남은 차이는 땅보다 낮을 때 더 빨리 메움
  { const p = player, run = Math.hypot(p.pos.x - (p.prevX ?? p.pos.x), p.pos.z - (p.prevZ ?? p.pos.z)), dyG = p.pos.y - (p.prevY ?? p.pos.y);
    p.prevX = p.pos.x; p.prevY = p.pos.y; p.prevZ = p.pos.z;
    if (Math.abs(dyG) <= run * 1.4 + 0.004) p.visY += dyG;
    const dy = p.pos.y - p.visY; p.visY = Math.abs(dy) > 1.6 || p.riding || p.air ? p.pos.y : p.visY + dy * Math.min(1, dt * (dy > 0 ? 18 : 9)); }
  runner.root.position.copy(player.pos); runner.root.position.y = player.visY + player.jumpY;
  runner.root.rotation.y = player.heading;
  { const k = player.knock; if (k && k.ang > 0.001) { runner.root.rotation.y = player.heading + k.spin; _ka.set(k.ax, 0, k.az).normalize(); _kq.setFromAxisAngle(_ka, k.ang); runner.root.quaternion.premultiply(_kq); } }
  { const L = hp.lie; if (L.ang > 0.001) { const h = player.heading; _ka.set(-Math.cos(h), 0, Math.sin(h)); _kq.setFromAxisAngle(_ka, L.ang); runner.root.quaternion.premultiply(_kq); runner.root.position.y += L.y; } } // 뒤로 누움 (#36)
  followLight();
}
const shadowFocus = new THREE.Vector3(), camFwd = new THREE.Vector3();
function followLight() {
  // 그림자 영역을 카메라가 보는 쪽으로 밀어 해상도를 아낌 (뒤쪽은 어차피 안 보임)
  if (NSW) { NSW.followLight(sun, player.pos, SUN_DIR); return; }
  camera.getWorldDirection(camFwd); camFwd.y = 0; if (camFwd.lengthSq() > 0.01) camFwd.normalize();
  shadowFocus.copy(player.pos).addScaledVector(camFwd, 22);
  sun.target.position.copy(shadowFocus); sun.position.copy(shadowFocus).addScaledVector(SUN_DIR, 600);
  fill.target.position.copy(player.pos); fill.position.copy(sun.position);
  rim.target.position.copy(player.pos); rim.position.copy(player.pos).addScaledVector(new THREE.Vector3(-SUN_DIR.x, 0.35, -SUN_DIR.z).normalize(), 300);
}

// 해돋이·해넘이 보기: 정상 근처에서 해 쪽을 8초 바라보면 인정
let sunWatchT = 0;
function tickSunWatch(dt) {
  const ev = sunEvent(); if (!ev) { sunWatchT = 0; return; }
  if (player.pos.distanceTo(spots.sunWatch.pos) > spots.sunWatch.r && !spots.isViewpoint(player.pos)) { sunWatchT = 0; return; }
  const look = new THREE.Vector3(); camera.getWorldDirection(look); look.y = 0; look.normalize();
  const sd = sunDir(Math.max(0, sunState.el), sunState.az).setY(0).normalize();
  if (look.dot(sd) > 0.75) sunWatchT += dt; else sunWatchT = Math.max(0, sunWatchT - dt * 0.5);
  const key = ev + '-' + kstDate();
  if (sunWatchT > 8 && save.sunSeen !== key) {
    save.sunSeen = key; persist();
    toast(ev === 'sunrise' ? '오늘의 해돋이를 봤어요' : '오늘의 해넘이를 봤어요');
    ach.emit(ev); ach.emit('sun-watch');
  }
}

let last = performance.now(), saveT = 0, awe = 0, aweBack = 0, skyT = 0;
let slowT = 0, fastT = 0;
function adaptQuality(dt) {
  if (dt >= 0.045) { slowT += dt; fastT = 0; } else if (dt < 0.02) { fastT += dt; slowT = 0; }
  if (slowT > 2.5 && quality.level > 0) { quality.level--; slowT = 0; resize(); if (quality.level === 0) { renderer.shadowMap.enabled = false; sun.castShadow = false; } else sun.shadow.mapSize.set(1024, 1024); }
  if (fastT > 20 && quality.level < 2) { quality.level++; fastT = 0; resize(); }
}
if ((navigator.hardwareConcurrency || 8) <= 4 || /Android|iPhone|iPad/.test(navigator.userAgent)) { quality.level = 1; sun.shadow.mapSize.set(1024, 1024); }

const tmpDir = new THREE.Vector3(); const compassDial = $('xy-north'), xyX = $('xy-x'), xyZ = $('xy-z'); let compassRot = null, xyTxt = '', xyDk = '';
function frame(now) {
  const rawDt = (now - last) / 1000; const dt = Math.min(0.05, rawDt); last = now;
  camHold = Math.max(0, camHold - dt);
  hp.tryBegin(player, BOAR.rollT); hp.update(dt, player); player.down = hp.isDown || hp.pending;
  tickAutoGo(); updatePlayer(dt); tickKnock(dt); tickJuice(dt); if (trash) { trash.update(dt, player.pos); tickPick(dt); tickFly(dt); tickZone(dt); } if (bloom) bloom.update(dt, player.pos, now / 1000); if (bfx) { bfx.update(dt, now / 1000); if (camPullT >= 0) { camPullT += dt; if (camPullT > BLOOM_FX.zone.camT) camPullT = -1; } } if (CH) { CH.update(dt, lampNight); tickDump(dt); tickChArrow(); } shopsBuilt.forEach((sh) => sh.update?.(dt, lampNight)); if (STN) tickMeal(dt); if (SAL) tickCut(dt); if (LEAPB) tickLeap(); if (shopsBuilt.length) tickShopMark(); buff.tick(); updateBuffUI(); devLabels.update(dt); if (!lookS.open) tut.update(dt); if (jeong) { jeong.update(dt); if (!jeong.isOpen && jeongReady()) openJeong(); } lamps.update(player.pos, lampNight);
  net.update(dt); net.send(false); updateHandLine();
  if (sessionOn && !document.hidden) ab.tick(rawDt); // 서버별 플레이 시간 (#35)
  life.update(dt, now / 1000); dumpers?.update(dt, now / 1000);
  social.tickBubbles(); tickQueue(); tickSunWatch(dt); tickBanner(dt);
  if (awe > 0) { awe -= dt; cam.dist += (24 - cam.dist) * Math.min(1, dt * 1.5); cam.pitch += (0.12 - cam.pitch) * Math.min(1, dt * 1.5); cam.yaw += dt * 0.35; if (awe <= 0) aweBack = 2; }
  if (aweBack > 0 && !ptrs.size) { aweBack -= dt; cam.dist += (13 - cam.dist) * Math.min(1, dt * 2); cam.pitch += (0.32 - cam.pitch) * Math.min(1, dt * 2); }
  adaptQuality(rawDt);
  const breath = tickBreath(dt);
  tickPhoto(dt);
  runner.setTint(Date.now() < player.yellowUntil);
  if (net.hand.hitBy && net.hand.hitBy.at > (player.lastHitAt || 0)) { player.lastHitAt = net.hand.hitBy.at; player.yellowUntil = Date.now() + 6000; toast(`${net.hand.hitBy.nick}이(가) 던진 귤에 맞았어요`); net.send(true); }
  const pose = player.flail ? 'flail' : player.riding ? 'sit' : player.knock && !player.air ? 'crouch' : player.pose === 'photo-wait' ? 'move' : player.pose;
  const fx = Math.sin(player.heading) * 0.6, fz = Math.cos(player.heading) * 0.6; // 진행 방향 비탈 (오르막 +)
  const slope = (groundAt(player.pos.x + fx, player.pos.z + fz) - groundAt(player.pos.x - fx, player.pos.z - fz)) / 1.2;
  runner.animate(dt, { speed: player.speed, running: player.running, pose, t: player.poseT, breath, air: player.air, jumpV: player.jumpV, slope: player.riding ? 0 : Math.max(-1, Math.min(1, slope)), tool: save.equip.tool, dur: toolNow().time, rod: fishing ? fishing.elev : 0.4, face: hp.isDown ? 'shut' : player.knock ? 'wide' : null });
  fishing?.update(dt); // 낚싯대·찌는 손 위치를 따라감 (#44)
  marker.rotation.z += dt;
  tickCairnLod(dt);
  cairns.forEach((c) => { if (c.drop > 0) { c.drop = Math.max(0, c.drop - dt * 4); c.im.position.y = c.drop * c.drop; } });
  clouds.rotation.y += dt * 0.012;
  { // 좌표 (#75, 나침반 대신): X·Z 정수 + 화면이 보는 방향 기준 북쪽(-z) 화살표
    camera.getWorldDirection(tmpDir); const ang = Math.atan2(tmpDir.x, -tmpDir.z) * 180 / Math.PI;
    const r = Math.round(-ang); if (r !== compassRot) { compassRot = r; compassDial.setAttribute('transform', `rotate(${r})`); }
    const X = Math.round(player.pos.x), Z = Math.round(player.pos.z), xs = X + ',' + Z;
    if (xs !== xyTxt) { const dk = `${String(X).length},${String(Z).length}`; if (dk !== xyDk) { xyDk = dk; topFit.dirty(); } xyTxt = xs; xyX.textContent = X; xyZ.textContent = Z; } // 자릿수가 바뀔 때만 폭 다시 잼
  }
  topFit.tick(dt);
  G.uT.value = now / 1000; G.uP.value.copy(player.pos); if (player.air) G.uP.value.y = 1e6;
  wx.update(dt, player.pos, wx.cur.wind); sound.setRain?.(wx.cur.snd); wxT -= dt; if (wxT <= 0 && !wx.settled) { wxT = 0.25; applySky(); }
  prints.update(dt); grass.update(player.pos, camera.position); if (save.gfx !== 'lite') motes.update(player.pos, now / 1000, dt, lampNight);
  if (eoksaeMat) eoksaeMat.userData.wind.value = now / 1000;
  if (eoksaeMat?.userData.push) {
    const arr = eoksaeMat.userData.push.value; let n = 0;
    const add = (pos, w) => { if (n < 8 && Math.abs(pos.x - player.pos.x) < 45 && Math.abs(pos.z - player.pos.z) < 45) arr[n++].set(pos.x, pos.z, w, 0); };
    add(player.pos, player.air ? 0.3 : 1);
    for (const e of net.peersById.values()) add(e.pos, 1);
    for (const d of life.deer) if (d.speed > 0.3) add(d.pos, 0.8);
    for (const h of life.horses || []) if (h.speed > 0.3) add(h.pos, 1);
    for (; n < 8; n++) arr[n].z = 0;
  }
  skyT -= dt; if (skyT <= 0) { skyT = 20; applySky(); }

  if (cam.mode === 'free') { /* 디버그 */ }
  else if (cam.mode === 'follow') followCam(dt, false);
  else if (cam.mode === 'leap') { // LEAP 입어 보기 (#59): 골목 쪽 가까이에서(맞은편 가게에 안 묻히게). 폰은 아래 시트 위로 캐릭터가 오게 내려다봄
    const narrow = innerWidth <= 600, yaw = player.heading, look = player.pos.clone();
    if (narrow) look.y -= 0.35; else { look.y += 1.1; look.add(new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(1.5)); }
    const d = narrow ? 7 : 5.5;
    camTarget.look.copy(look); camTarget.pos.set(look.x + Math.sin(yaw) * d, player.pos.y + (narrow ? 1.5 : 1.6), look.z + Math.cos(yaw) * d);
    ease(dt, false, 6);
  } else if (cam.mode === 'wardrobe') {
    const narrow = innerWidth <= 600;
    const look = player.pos.clone(); look.y += narrow ? -1.6 : 1.25;
    const yaw = player.heading;
    if (!narrow) look.add(new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(-1.4));
    camTarget.look.copy(look);
    const d = narrow ? 10 : 4.6;
    camTarget.pos.set(look.x + Math.sin(yaw) * d, look.y + (narrow ? 2.2 : 0.5), look.z + Math.cos(yaw) * d);
    ease(dt, false, 6);
  } else if (cam.mode === 'look') { // 캐릭터 고르기 (#51): 캐릭터 둘레를 천천히 돎. 아래 카드에 가리지 않게 캐릭터를 화면 가운데 조금 위에
    lookS.t += dt;
    const narrow = innerWidth <= 600, look = player.pos.clone(); look.y += narrow ? 0.75 : 1.0;
    const yaw = player.heading + lookS.t * HAIR.spin, d = narrow ? 7.2 : 6.2;
    camTarget.look.copy(look); camTarget.pos.set(look.x + Math.sin(yaw) * d, look.y + 0.9, look.z + Math.cos(yaw) * d);
    ease(dt, false, 6);
  } else if (cam.mode === 'sit') {
    const tan = new THREE.Vector3(-benchOut.z, 0, benchOut.x);
    const look = player.pos.clone().addScaledVector(benchOut, 22).addScaledVector(tan, -16); look.y -= 7;
    camTarget.look.copy(look);
    camTarget.pos.copy(player.pos).addScaledVector(tan, 6.5).addScaledVector(benchOut, -1.5);
    camTarget.pos.y = Math.max(player.pos.y + 3.4, height(camTarget.pos.x, camTarget.pos.z) + 2);
    ease(dt, false, 1.5);
  } else if (cam.mode === 'photo') ease(dt, false, 4);

  updateContext(); tickAimMark(now / 1000); tickEdgeAim();
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) ui.toast.hidden = true; }
  tickTips(dt);
  if (sound.music) { sound.setThreat(threatNear()); sound.setDuck(mealS.on || cutS.on); } // 배경 음악 (#64)
  enemyWarn.update(dt); dumpWarn.update(dt); alertMark.visible = life.enemies.near(player.pos, 40); if (alertMark.visible) alertMark.position.y = 3.0 + Math.abs(Math.sin(now / 150)) * 0.3;
  updateStats();
  saveT += dt; if (saveT > 5) { saveT = 0; persist(); }
  if (NSW) { NSW.update(dt, player.pos, camera); wallPl.value.copy(player.pos); wall.update(player.pos); jeong?.lod(player.pos); renderer.render(scene, camera); }
  else if (save.gfx === 'smooth' && post.ok) post.render(scene, camera); else retro.render(scene, camera);
  if (captureNext) { captureNext = false; capture(); }
  requestAnimationFrame(frame);
}

addEventListener('resize', resize);
resize();
cairns.forEach(layoutCairn);
applySky();
refreshAchUI();
setGait(0);
followCam(0, true);
requestAnimationFrame(frame);
// ---------- 튜토리얼 (입구 마당) ----------
// 튜토리얼용 낱개 쓰레기 6개 (번호 k)
const tutTrashLeftList = () => (trash ? (spots.tut?.trash || []).filter((_, k) => !trash.store.isTutPicked(k)) : []);
const tutTrashNext = () => { let b = null, bd = 1e9; for (const t of tutTrashLeftList()) { const d = Math.hypot(t.x - player.pos.x, t.z - player.pos.z); if (d < bd) { bd = d; b = t; } } return b; };
const tut = createTutorial({ save, persist, player, isTouch, pts: NS_TUT, scene, height, camera, placeArrow, stream, jeong, openJeong, bagVol: () => (trash ? trash.bagVol() : 0), bagCap, tutTrashLeft: () => tutTrashLeftList().length, tutTrashNext, ch: CH,
  col, crossLine: NSW ? NSB.crossLine : null, addTargets: life.addTargets, sound, juice: (p, d) => life.juiceSplash(p, d), ctxIc: () => ctxTarget?.ic, shopTab: () => ($('shop').hidden ? null : shopTab), // #62 과녁·벽·눌러야 할 곳
  onDone: () => { updateTrashUI(false); if ($('dev-tut')) $('dev-tut').hidden = true; } });
if (NS_TUT && tut.active) document.body.classList.add('tut');
if ($('dev-tut')) $('dev-tut').hidden = !tut.active; // 개발자 버튼 '튜토리얼 건너뛰기' (#62)
else if (!NS_TUT && save.tut && !save.tut.done) { save.tut.done = true; persist(); }
// ---------- 낚시 (#44) ----------
// 보상은 F 로 당기는 순간: 물고기 = 귤 5 + 도감 '개울' 칸, 쓰레기 = 호주머니·배낭(클린하우스에서 귤), 드문 것 = 배낭 + 도감(드문 것 귤)
fishing = createFishing({ scene, stream, player, runner, groundAt, height, sound, toast,
  room: () => bagRoom(),
  setHoldRod: (v) => { if (holdRod === v) return; holdRod = v; if (v) holdBow = false; syncEquipGear(); runner.apply(save.outfit); net.send(true); },
  reward: (c, at) => {
    if (c.type === 'fish') {
      const sp = FISH.species[c.i], dx = DEX_LIST.find((d) => d.id === `fish:${c.i}`);
      if (trash && dx) { const isNew = trash.store.dexAdd(dx.id); trash.store.commit(); onDexGet(dx, isNew); }
      if (c.jack) { // 잭팟 (#55): 귤이 터지듯 흩뿌려짐
        const G = FISH.jackpot.gyul; addCoins(G); ach.emit('earn', G);
        setTimeout(() => { sound.jackpot?.(); gyulShower(G); coinFx(at.clone().setY(at.y + 1.2), G); }, FISH.pullT * 1000);
        ach.emit('fish'); ach.emit('fish-jackpot'); ach.emit('fish-' + sp.id);
      } else {
      addCoins(FISH.fishGyul); ach.emit('earn', FISH.fishGyul); setTimeout(() => coinFx(at.clone().setY(at.y + 1.2), FISH.fishGyul), FISH.pullT * 1000);
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
} });
const GFX = NSW ? ['smooth', 'lite'] : ['smooth', 'lite', 'toon', 'retro']; if (NSW && !GFX.includes(save.gfx)) save.gfx = 'smooth'; const GFX_NAME = { smooth: '기본', lite: '가볍게', toon: '카툰', retro: '레트로' };
function applyGfx() { renderer.toneMapping = !NSW && (save.gfx === 'toon' || save.gfx === 'retro') ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping; applySky(); grass.set(save.gfx !== 'lite'); motes.pts.visible = save.gfx !== 'lite'; retro.on = save.gfx === 'toon' || save.gfx === 'retro'; retro.setMode(save.gfx === 'retro' ? 'retro' : 'toon'); $('menu-gfx').textContent = `그래픽: ${GFX_NAME[save.gfx]}`; sun.shadow.radius = save.gfx === 'retro' ? 1.5 : 3; }
$('menu-gfx').addEventListener('click', () => { save.gfx = GFX[(GFX.indexOf(save.gfx) + 1) % GFX.length]; persist(); applyGfx(); toast(`${GFX_NAME[save.gfx]} 그래픽`); });
applyGfx();
$('menu-dev').addEventListener('click', () => { closePanels(); devLabels.toggle(); toast(devLabels.on ? '개발용 라벨을 켰어요 (F2로 끄기)' : '개발용 라벨을 껐어요'); });
addEventListener('keydown', (e) => { if (e.code === 'F2') { e.preventDefault(); devLabels.toggle(); } });
if (/(^|[#&])dev($|&)/.test(location.hash)) devLabels.set(true);
if (wearRefund) { persist(); setTimeout(() => toast(`예전 옷 색은 없어졌어요 · 귤 ${wearRefund}개를 돌려드렸어요`), 3500); } // #52
window.__oreum = { street: street && { layout: STREET, built: street, shops: shopsBuilt, open: openShopPop, popNow: () => !$('shoppop').hidden && shopPopNow, mark: () => !shopMark.hidden && shopMarkId, go: (i = 0, s = 0) => { const p = i ? STREET.lot(i).front : STREET.P(s, 0); player.pos.set(p.x, groundAt(p.x, p.z), p.z); player.heading = i ? STREET.lot(i).rot + Math.PI : Math.atan2(STREET.ax, STREET.az); } }, clothes: { state: () => structuredClone(CL), stats: () => Object.fromEntries(WEAR.slots.map((w) => [w.stat, wearV(w.k)])), wear: (slot, id) => wearCloth(slot, id), buy: buyCloth, give: (id) => { if (CLOTH[id]) { CL.own[id] = 1; persist(); } }, bagCap: () => bagCap(), hpMax: () => hp.max, refund: () => wearRefund }, look: { open: openLook, close: closeLook, set: (sex, skin) => { if (sex) lookS.sex = sex; if (skin != null) lookS.skin = skin; lookPreview(); }, state: () => ({ open: lookS.open, sex: lookS.sex, skin: lookS.skin, look: save.look, hairs: { ...save.hairs }, hat: save.outfit.gear?.hat, hair: save.outfit.gear?.hair }) }, leap: LEAPB && { api: LEAPB, open: () => openShopPop('leap'), slot: (k) => { leapS.slot = k; leapS.pick = null; leapTryOn(null); refreshShopPop(); }, items: (k = leapS.slot) => leapItems(k).map(({ art, cloth, ...r }) => r), pick: (id) => { const it = leapItems(leapS.slot).find((i) => i.id === id); if (it) pickLeap(it); return !!it; }, buy: (id = leapS.pick) => buyLeap(leapItems(leapS.slot).find((i) => i.id === id)), state: () => ({ on: leapS.on, slot: leapS.slot, pick: leapS.pick, tried: leapS.tried, cam: cam.mode, coins: save.coins, shoes: save.equip.shoes, wear: { ...CL.wear } }), go: () => { player.pos.copy(LEAPB.door); player.pos.y = groundAt(LEAPB.door.x, LEAPB.door.z); player.heading = LEAPB.face + Math.PI; } }, salon: SAL && { api: SAL, open: () => openShopPop('salon'), order: (id) => orderCut(HAIR.list.find((h) => h.id === id)?.key), finish: () => finishCut(), sit: () => sitCut(), cut: () => ({ on: cutS.on, phase: cutS.phase, t: cutS.t, hair: cutS.hair }), go: () => { player.pos.copy(SAL.door); player.pos.y = groundAt(SAL.door.x, SAL.door.z); player.heading = SAL.seatHeading; } }, stone: STN && { api: STN, buff, open: openStone, order: (id) => orderMeal(STONE.menu.find((m) => m.id === id)), finish: () => finishMeal(), meal: () => ({ on: mealS.on, phase: mealS.phase, t: mealS.t, item: mealS.item?.id }), go: () => { player.pos.copy(STN.terrace); player.pos.y = groundAt(STN.terrace.x, STN.terrace.z); player.heading = STN.seatHeading + Math.PI; }, mul: (k) => buff.mul(k), cap: () => bagCap(), tool: () => toolNow() }, bloom: bloom && { api: bloom, ...bloom.test, test: bloomTest, fx: bfx, deer: () => Object.fromEntries(Object.entries(bloomDeer).map(([z, l]) => [z, l ? l.length : 0])) }, fish: fishing && { api: fishing, ...fishing.test, go: (side = -1, lat = 3) => { const [x, z] = stream.at(stream.centerOff(lat) + side * (stream.halfW(lat) + 0.7), lat); player.pos.set(x, groundAt(x, z), z); player.heading = Math.atan2(-side * stream.at(1, 0)[0] + side * stream.at(0, 0)[0], -side * stream.at(1, 0)[1] + side * stream.at(0, 0)[1]); }, press: () => fishing.press(), can: () => fishing.canFish() }, weapon: { now: () => weaponNow().id, ammo: () => save.bowAmmo, armed: () => bowArmed(), hold: () => holdBow, fire: () => fireWeapon(), set: (v) => { save.equip.weapon = v; persist(); }, arrows: () => life.arrows.length }, enemies: life.enemies, enemyWarn, dumpers: dumpers && { api: dumpers, ...dumpers.test, warn: dumpWarn }, abStats: () => ab.get(), hp, server: { id: serverId, isBattle, open: openServer }, aim: { target: () => aimTarget(), mark: aimMark, throw: () => throwTangerine(), ctx: () => ctxTarget && (ctxTarget.ic || ctxTarget.label), pick: () => startPick() }, stream, jeong, tut, openJeong, gyulShower, prints, bound: NSW ? NSB : null, wall, setWeather: (k) => wx.set(k), wx, col, cairns, fillCairn, cleanhouse: CH && { api: CH, autoGo: () => startAutoGo(), autoStop: () => stopAutoGo(), autoState: () => autoGo && { i: autoGo.i, n: autoGo.route.length, route: autoGo.route }, dump: () => dumpBag(), go: () => { player.pos.copy(CH.front); player.pos.y = height(CH.front.x, CH.front.z); player.heading = Math.atan2(CH.center.x - CH.front.x, CH.center.z - CH.front.z); }, recycle: () => ({ ...save.recycle, coins: save.coins }), shopHint: () => shopHintUntil, openShop, buyGear, canBuyGear }, trash: trash && { ...trash.test, dexList: DEX_LIST, openDex, checkGearBadges, api: trash, state: () => ({ bag: { ...trash.store.bag }, vol: trash.bagVol(), cap: bagCap(), clean: trash.clean(), zone: zoneNow, zoneClean: zoneNow ? trash.zoneClean(zoneNow) : null, picked: trash.store.pickedCount(), total: trash.store.totalCount(), picking: pickS.cyc >= 0 }), goHeap: (i) => { const h = trash.heaps[i]; if (!h) return null; const a = Math.atan2(player.pos.x - h.x, player.pos.z - h.z), d = h.r + 1.2, x = h.x + Math.sin(a) * d, z = h.z + Math.cos(a) * d; player.pos.set(x, groundAt(x, z), z); player.heading = a + Math.PI; return { x, z }; }, estimate: () => CH && trash.test.estimate(CH.front, { TOOLS, BAGS, SHOES }) }, keys, player, sound, devLabels, buildRunner, runner, retro, trail, groundAt, height, cam, interactables, save, life, social, ach, quality, renderer, scene, spots, joy, camObj: camera, setTod: (h) => { todOverride = h; applySky(); }, sunState: () => sunState, snap: () => followCam(0, true),
  tp: (x, z, h, pitch = 0.2, dist = 13, yawOff = 0) => { player.pos.set(x, height(x, z), z); player.visY = player.pos.y; player.heading = h; player.viewSeen = true; awe = 0; aweBack = 0; cam.yaw = h + Math.PI + yawOff; cam.pitch = pitch; cam.dist = dist; placeRunner(); followCam(0, true); } };
