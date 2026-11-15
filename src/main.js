import { NSMODE, TEXCS } from './boot.js'; // 반드시 맨 먼저
import { useNamsongi, buildNamsongi, nsPaths } from './namsongi.js';
import { createFootprints } from './footprints.js';
import { createTrash, createLocalTrashStore, DEX_LIST } from './trash.js';
import { dexIcon } from './dexicons.js';
import { TOOLS, BAGS, POCKET, SHOES, TRASH, TRASH_TYPES, CLEANHOUSE, DEX, CAIRN, COLLIDE, TUT } from './balance.js';
import { createStream } from './stream.js';
import { createCollide } from './collide.js';
import { equipGear } from './gear.js';
import { createCleanhouse } from './cleanhouse.js';
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
import { buildRunner, THROW, OUTFIT_OPTIONS, DEFAULT_OUTFIT, itemKey, itemPrice } from './runner.js';
import { Sound } from './audio.js';
import { createNet } from './net.js';
import { createLife } from './life.js';
import { createSocial } from './social.js';
import { buildSign } from './props.js';
import { MAPS, pickMapId, buildSpots } from './maps.js';
import * as NSB from './nsbound.js';
import { createStoneWall, createCrossWall } from './stonewall.js';
import { createWeather, WX, wxIcon } from './weather.js';
import { sunPosition, sunTimes, sunDir, fmtKST, buildSkyBodies } from './sun.js';
import { createAchievements, BADGES, kstDate } from './achievements.js';

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
const freshSave = !save.nick; // 처음 온 사람
save.nick ||= `${pick(ADJ)} ${pick(NOUN)}`;
save.outfit = { ...structuredClone(DEFAULT_OUTFIT), ...(save.outfit || {}) };
if (!save.hatBackV) { save.outfit.hat.back = true; save.hatBackV = 1; }
if (!save.nsV3) { save.tut = { step: 0, done: false }; if (save.trash) save.trash.tp = []; save.nsV1 = save.nsV2 = save.nsV3 = 1; save.jeong = 0; } // 새 튜토리얼(#31): 기존 유저도 한 번 다시 봄
if (!save.styleV5) { save.outfit.hat.color = '#5c9a3c'; save.outfit.shirt.color = '#e8d9b5'; save.outfit.pants.color = '#8a6a3c'; save.outfit.shoes.color = '#26262b'; save.styleV5 = 1; } // 모델 캐릭터 기본 색으로 한 번만 초기화
if (!save.styleV2) { save.outfit.hat.type = 'none'; save.outfit.glasses.type = 'none'; save.styleV2 = 1; } // 똥머리가 보이게 한 번만 초기화 save.outfit.shirt.type ||= 'tee'; save.outfit.shoes.type ||= 'road';
save.totalSteps ||= 0;
if (typeof save.coins !== 'number') save.coins = 5;
save.owned ||= {};
save.wishes ||= {};
if (!save.equip || typeof save.equip !== 'object') save.equip = {};
// 배낭(#31): 0 = 호주머니(처음), 1~5 = 배낭. 예전 저장의 1단계(용량 20)는 첫 배낭(BAGS[0], 20)을 가진 것으로 그대로 둠
if (!save.bagV) { if (freshSave || typeof save.equip.bag !== 'number') save.equip.bag = freshSave ? 0 : 1; save.bagV = 1; }
for (const k of ['tool', 'bag', 'shoes']) { const lo = k === 'bag' ? 0 : 1, v = Math.floor(Number(save.equip[k])); save.equip[k] = Math.max(lo, Math.min(5, Number.isFinite(v) ? v : 1)); } // 장비 단계 (상점에서 다음 단계만 삼)
// 장비 단계 → 캐릭터 겉모습(outfit.gear 의 손·등·신발). 네트워크에도 그대로 실려 감
const syncEquipGear = () => { save.outfit.gear = { ...(save.outfit.gear && typeof save.outfit.gear === 'object' ? save.outfit.gear : {}), ...equipGear(save.equip) }; };
syncEquipGear();
if (!save.recycle || typeof save.recycle !== 'object') save.recycle = {};
save.recycle.visits = Math.max(0, Math.floor(Number(save.recycle.visits) || 0)); // 클린하우스에 버린 횟수
save.recycle.gyul = Math.max(0, Math.floor(Number(save.recycle.gyul) || 0)); // 클린하우스에서 번 귤 누적
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* 저장 불가 환경 */ } };

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
const NSW = NSMODE ? buildNamsongi({ scene, renderer, bound: NSB }) : null;
if (NSW) { scene.fog.near = NSW.fogNear; scene.fog.far = NSW.fogFar; }
const camera = new THREE.PerspectiveCamera(50, 1, 0.5, NSW ? NSW.camFar : 14000);
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
  updateSunChip();
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
function updateWxChip() { const k = wx.kind, el = $('wx-pill'); if (!el) return; el.hidden = false; el.innerHTML = wxIcon(k); el.title = '지금 날씨: ' + WX[k].name + (wx.forced ? ' (테스트)' : ''); }
wx.onChange(() => { updateWxChip(); wxT = 0; });
let wxT = 0;
function sunEvent() {
  const t = nowDate().getTime();
  const r = todayTimes.rise?.getTime(), s = todayTimes.set?.getTime();
  if (r && t > r - 25 * 60000 && t < r + 30 * 60000) return 'sunrise';
  if (s && t > s - 30 * 60000 && t < s + 25 * 60000) return 'sunset';
  return null;
}
function updateSunChip() {
  const ev = sunEvent(); const chip = $('sun-chip');
  if (!ev) { chip.hidden = true; return; }
  chip.hidden = false;
  const tt = ev === 'sunrise' ? todayTimes.rise : todayTimes.set;
  chip.textContent = ev === 'sunrise' ? `해돋이 ${fmtKST(tt)} · 정상에서 동쪽을 보세요` : `해넘이 ${fmtKST(tt)} · 정상에서 서쪽을 보세요`;
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
const wall = NSW ? createStoneWall({ scene, height, line: NSB.boundLine, gate: NSB.gate, low: LOW, col, uPl: wallPl }) : null;
// ---------- 들머리(#31): 개울·징검다리·낚시 NPC, 들머리와 오름 사이 돌담·정낭 ----------
const NS_TUT = NSW && spots.tut?.stream ? spots.tut : null;
const stream = NS_TUT ? createStream({ scene, height, groundAt, addWalkable, line: NSB.crossLine(TUT.streamD), buildRunner, outfit: DEFAULT_OUTFIT, low: LOW, sound: { splash: () => sound.splash(), reel: (d) => sound.reel(d) } }) : null;
if (stream) { const L = NSB.crossLine(TUT.streamD); NSW.grass.noStream?.(L.c.x, L.c.z, L.fx, L.fz, TUT.streamW); }
const jeongReady = () => save.equip.tool >= 2 && save.equip.bag >= 1;
if (stream && col) col.add(stream.npcPos[0], stream.npcPos[1], 0.6); // 낚시 NPC·앉은 바위
const jeong = NS_TUT ? createCrossWall({ scene, height, line: NSB.crossLine(TUT.gateD), low: LOW, col, open: !!save.jeong || !!save.tut?.done || jeongReady() }) : null;
if (jeong && jeong.isOpen && !save.jeong) { save.jeong = 1; persist(); }
// 정낭이 열리는 때: 집게·배낭을 둘 다 가졌을 때, 튜토리얼을 마치거나 건너뛰었을 때. 한 번 열리면 계속 열림
function openJeong(anim = true) { if (!jeong || !jeong.open(anim)) return; save.jeong = 1; persist(); if (anim) sound.gate?.(); }
// ---------- 쓰레기 (남송이): 오름 위(사면·능선·굼부리)에만 (#25) ----------
const trash = NSW ? createTrash({ scene, store: createLocalTrashStore({ save, persist }), height, paths: NSB.oreumPaths, inBounds: NSB.onOreum, low: LOW, fixed: spots.tut?.trash || [], blocked: col ? (x, z) => col.blocked(x, z, COLLIDE.trashPad) : null }) : null;
const CH = trash && spots.cleanhouse ? createCleanhouse({ scene, height, ...spots.cleanhouse, low: LOW, trashGeos: trash.geos }) : null;
const chAct = CH && { ch: true, label: '버리기', pos: CH.front, r: CLEANHOUSE.r, act: () => dumpBag() };
const shopAct = CH && { label: '상점', pos: CH.shopFront, r: CLEANHOUSE.shopR, act: () => openShop('gear') };

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

// ---------- 카메라 ----------
const cam = { yaw: player.heading + Math.PI, pitch: 0.32, dist: 13, mode: 'follow', look: new THREE.Vector3(), pos: new THREE.Vector3() };
const camTarget = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
function followCam(dt, snap) {
  const look = player.pos.clone(); look.y = player.visY + 1.6 + (player.riding ? 0.9 : 0);
  const cp = Math.cos(cam.pitch);
  const off = new THREE.Vector3(Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), Math.cos(cam.yaw) * cp).multiplyScalar(cam.dist);
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
const ui = { steps: $('steps'), laps: $('laps'), nick: $('nick'), ctx: $('btn-ctx'), toast: $('toast'), hint: $('hint') };
ui.nick.textContent = save.nick;
$('place-name').textContent = spots.name;
$('laps-row').hidden = !spots.laps;
ui.hint.textContent = isTouch ? '왼쪽 아래 조이스틱으로 이동 · 화면을 끌어 둘러보기' : 'W/S 앞뒤 · A/D 방향 · 땅 클릭 이동 · 끌어서 둘러보기 · E 상호작용 · F 줍기(누르고 있기)';
let hintHidden = false;
function hideHint() { if (hintHidden) return; hintHidden = true; ui.hint.classList.add('fade'); }
let toastT = 0;
function toast(msg) { ui.toast.textContent = msg; ui.toast.hidden = false; toastT = 2.8; }
let lastCoins = -1;
function updateStats() {
  ui.steps.textContent = player.steps.toLocaleString('ko-KR');
  ui.laps.textContent = player.laps;
  if (save.coins !== lastCoins) { lastCoins = save.coins; const c = String(save.coins); $('coins').textContent = c; $('coins2').textContent = c; $('m-coins').textContent = c; $('shop-coins').textContent = c; $('ach-coins').textContent = c; }
}
function addCoins(n, why) { save.coins = Math.max(0, save.coins + n); persist(); updateStats(); if (why) toast(`${why} · 귤 ${n > 0 ? '+' : ''}${n}`); if (n > 0) { sound.coin?.(); const g = document.querySelector('.gyul'); g.classList.remove('bump'); void g.offsetWidth; g.classList.add('bump'); } }
const PANELS = ['shop', 'sign', 'wishes', 'chat', 'actions', 'menu', 'ach', 'dex', 'maps', 'feedback', 'notes'];
const panelOpen = () => PANELS.some((id) => !$(id).hidden);
const busy = () => ['sit', 'photo', 'photo-wait', 'breath', 'crouch'].includes(player.pose) || cam.mode === 'wardrobe' || panelOpen() || !!player.rescue;
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
[['shop-close', 'shop'], ['sign-close', 'sign'], ['wish-close', 'wishes'], ['ach-close', 'ach'], ['dex-close', 'dex'], ['maps-close', 'maps'], ['feedback-close', 'feedback'], ['notes-close', 'notes'], ['chat-close', 'chat']].forEach(([b, p]) => $(b).addEventListener('click', () => { $(p).hidden = true; }));
['shop', 'sign', 'wishes', 'ach', 'dex', 'maps', 'feedback', 'notes'].forEach((id) => $(id).addEventListener('pointerdown', (e) => { if (e.target === $(id)) $(id).hidden = true; }));

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
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').hidden = true; return; }
  const b = bannerQueue.shift(); if (!b) return;
  $('banner-bdg').innerHTML = iconSvg(b.icon); $('banner-bdg').style.background = b.color;
  $('banner-title').textContent = b.title; $('banner-sub').textContent = b.sub;
  $('banner').hidden = false; bannerT = 4.5;
}
$('banner-go').addEventListener('click', () => { $('banner').hidden = true; bannerT = 0; openAch(); });
function refreshAchUI() {
  const d = ach.ensureDaily();
  const done = d.items.filter((x) => x.done).length;
  $('ach-count').textContent = `${done}/${d.items.length}`; $('ach-ring').setAttribute('stroke-dasharray', `${(done / Math.max(1, d.items.length) * 56.5).toFixed(1)} 56.5`);
  const un = ach.unclaimed();
  $('ach-dot').hidden = !un; $('ach-dot2').hidden = !un;
  if (!$('ach').hidden) buildAch();
}
function openAch() { closePanels(); buildAch(); $('ach').hidden = false; }
$('ach-chip').addEventListener('click', (e) => { if (e.target.closest('#chip-gyul')) openShop('gear'); else openAch(); });
{ const g = document.querySelector('.hud-left .gyul') || document.querySelector('.gyul'); g.addEventListener('click', () => openShop('gear')); g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openShop('gear'); } }); }
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
  const g = $('dex-grid'); g.innerHTML = '';
  DEX_LIST.forEach((d) => {
    const n = dx[d.id] || 0, el = document.createElement('div'); el.className = 'dex-cell' + (n ? '' : ' locked') + (d.rare ? ' rare' : '');
    el.dataset.id = d.id;
    const ic = document.createElement('span'); ic.className = 'dex-ic'; ic.innerHTML = iconSvg(dexIcon(d));
    const nm = document.createElement('b'); nm.textContent = n ? d.name : '???';
    const sm = document.createElement('small'); sm.textContent = n ? `${n.toLocaleString('ko-KR')}개` : (d.rare ? '드문 것' : '');
    el.append(ic, nm, sm); g.append(el);
  });
}
$('menu-dex')?.addEventListener('click', openDex);
$('ach-dex')?.addEventListener('click', openDex);
function onDexGet(dex, isNew) {
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
  if (p && !dragMoved && ptrs.size === 0 && e.type === 'pointerup') tapGround(e.clientX, e.clientY);
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
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); const r = el.getBoundingClientRect(); joy.cx = r.left + r.width / 2; joy.cy = r.top + r.height / 2; joy.active = true; joy.id = e.pointerId; move(e); closePanelsSoft(); hideHint(); });
  const move = (e) => { if (!joy.active || e.pointerId !== joy.id) return; let dx = (e.clientX - joy.cx) / R, dy = (e.clientY - joy.cy) / R; const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; } joy.x = dx; joy.y = dy; setKnob(); };
  el.addEventListener('pointermove', move);
  const end = (e) => { if (e.pointerId !== joy.id) return; joy.active = false; joy.x = joy.y = 0; setKnob(); };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
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
  player.target = p.clone(); player.onArrive = onArrive; hideHint();
  marker.position.set(p.x, height(p.x, p.z) + 0.15, p.z); marker.visible = !onArrive;
}
const CODE2KEY = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', ArrowUp: 'arrowup', ArrowDown: 'arrowdown', ArrowLeft: 'arrowleft', ArrowRight: 'arrowright', Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', KeyT: 't', KeyF: 'f', Enter: 'enter', KeyR: 'r', ShiftLeft: 'shift', ShiftRight: 'shift', KeyE: 'e', Space: ' ', Escape: 'escape', KeyQ: 'q' };
const keyOf = (e) => CODE2KEY[e.code] || e.key.toLowerCase();
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const k = keyOf(e);
  keys.add(k);
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { hideHint(); if (k.startsWith('arrow')) e.preventDefault(); }
  if (e.repeat) return;
  if (k === '1') doWave();
  if (k === '2') startBreath();
  if (k === '3') doDance();
  if (k === 't') throwTangerine();
  if (k === 'enter') { e.preventDefault(); openChat(); }
  if (k === 'r' || k === 'shift') cycleSpeed();
  if (k === 'e') doInteract();
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
$('btn-speed').addEventListener('click', cycleSpeed);

// ---------- 동작 ----------
$('btn-actions').addEventListener('click', () => { const a = $('actions'); const open = a.hidden; closePanels(); a.hidden = !open; });
$('btn-menu').addEventListener('click', () => { const a = $('menu'); const open = a.hidden; closePanels(); a.classList.remove('more'); $('m-steps').textContent = player.steps.toLocaleString('ko-KR'); $('ach-dot3').hidden = $('ach-dot').hidden; a.hidden = !open; });
$('menu-more').addEventListener('click', () => $('menu').classList.toggle('more'));
$('menu-ach').addEventListener('click', () => openAch());
$('menu-sound').addEventListener('click', () => $('btn-sound').click());
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

let throwPending = false;
function throwTangerine() {
  if (busy() || player.pose === 'wave' || player.pose === 'throw') return;
  if (save.coins < 1) { toast('귤이 없어요. 길에 떨어진 귤을 주워 보세요'); return; }
  if (player.riding) { releaseTangerine(); return; }
  player.pose = 'throw'; player.poseT = 0; throwPending = true; sound.beep(false);
}
// 손이 앞으로 뻗는 순간 손 위치에서 귤이 떠난다
function releaseTangerine() {
  throwPending = false;
  if (save.coins < 1) return;
  save.coins -= 1; persist(); updateStats();
  const dir = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
  let from = player.pos.clone().addScaledVector(dir, 0.6); from.y += 1.4 + player.jumpY + (player.riding ? 0.95 : 0);
  if (!player.riding) { const arm = runner.root.userData.parts?.armR; if (arm) { runner.root.updateMatrixWorld(true); const h = arm.localToWorld(new THREE.Vector3(0, -0.5, 0)); if (isFinite(h.x + h.y + h.z)) from = h; } }
  life.throwTangerine(from, dir, 11 + (player.running ? 3 : 0), () => [...[...net.peersById.values()].map((e) => ({ id: e.peer, pos: e.pos }))]);
}
$('btn-throw').addEventListener('click', throwTangerine);

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
$('btn-jump').addEventListener('click', doJump);
function tickJump(dt) {
  const p = player; if (!p.air) return;
  p.jumpV -= GRAV * dt; p.jumpY += p.jumpV * dt;
  if (p.jumpY <= 0) { p.jumpY = 0; p.jumpV = 0; p.air = false; sound.step(surfaceAt(p.pos.x, p.pos.z), true); }
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
  scene, player, save, roomName: 'oreum-' + MAP_ID,
  extra: () => social.presenceExtra(),
  onToast: (m) => toast(m),
  onPeersChanged: (n, hand) => {
    $('peers').textContent = n > 0 ? `함께 ${n + 1}명` : '혼자';
    $('handreq').hidden = !hand.pendingFrom;
    if (hand.pendingFrom) { const e = net.peersById.get(hand.pendingFrom); $('handreq-who').textContent = e ? e.nick : '러너'; }
    $('btn-release').hidden = !hand.with;
    $('btn-cancelreq').hidden = !hand.req;
    if (hand.with && !player.handDone) { player.handDone = true; ach.emit('hand'); }
  },
});
const social = createSocial({ scene, net, save, onToast: (m) => toast(m), mapId: MAP_ID });
social.listeners.stones.push(() => cairns.forEach(layoutCairn));
net.start(); social.start();
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
const interactables = [
  ...(spots.tutorial ? [] : [{ label: '인증샷 찍기', pos: P.stone, r: 9, act: startPhoto }]),
  { label: '앉아 쉬기', pos: benchPos, r: 8, act: sitDown },
  ...(spots.sign.silent ? [] : [{ label: '안내 읽기', pos: spots.sign.pos, r: 6, act: () => openSign() }]),
  ...cairns.map((c) => ({ cairn: c, pos: c.pos, r: 7, act: () => openWishes(c) })),
  ...(chAct ? [chAct, shopAct] : []),
];
let ctxTarget = null, handAct = null, deerAct = null;
const dismountAct = { label: '노루에서 내리기', act: () => dismountDeer() };
const standAct = { label: '일어나기', act: () => standUp() };
function doInteract() { if (ctxTarget) ctxTarget.act(); else if (trashFull()) fullToast(); else toast('돌탑·표지석·쉼터·안내판·노루·다른 러너 가까이 가면 이 버튼으로 바로 해요'); }
ui.ctx.addEventListener('click', doInteract);
// 줍기는 누르고 있는 동안 계속
ui.ctx.addEventListener('pointerdown', () => { pickS.held = true; if (ctxTarget === pickAct) startPick(); });
['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => ui.ctx.addEventListener(ev, () => { pickS.held = false; }));
ui.ctx.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- 줍기·배낭 ----------
const pickS = { held: false, cyc: -1, got: false, fullT: 0 };
const pickAct = { label: '줍기', act: () => startPick() };
const toolNow = () => TOOLS[save.equip.tool - 1];
const bagCap = () => (save.equip.bag ? BAGS[save.equip.bag - 1] : POCKET).cap;
const bagRoom = () => (trash ? bagCap() - trash.bagVol() : 0);
const canPick = () => !!trash && !player.riding && !player.air && trash.any(player.pos.x, player.pos.z, toolNow().r, bagRoom());
const trashFull = () => !!trash && bagRoom() < 1 && trash.any(player.pos.x, player.pos.z, toolNow().r, 99);
function fullToast() { if (performance.now() - pickS.fullT < 4000) return; pickS.fullT = performance.now(); const w = save.equip.bag ? '배낭' : '호주머니'; toast(CH ? `${w}가 가득 찼어요 · 들머리 클린하우스에 버려요` : `${w}가 가득 찼어요`); }
const pickBlocked = () => panelOpen() || cam.mode === 'wardrobe' || ['sit', 'photo', 'photo-wait', 'breath'].includes(player.pose) || player.riding || player.air || !!player.rescue;
function startPick() {
  if (!trash || pickS.cyc >= 0 || pickBlocked()) return;
  const list = trash.candidates(player.pos.x, player.pos.z, toolNow().r, bagRoom());
  if (!list.length) { if (trashFull()) fullToast(); return; }
  const L = trash.layout(), id = list[0];
  player.target = null; player.onArrive = null; marker.visible = false;
  player.heading = Math.atan2(L.X[id] - player.pos.x, L.Z[id] - player.pos.z) || player.heading;
  player.pose = 'crouch'; player.poseT = 0; player.speed = 0;
  pickS.cyc = 0; pickS.got = false;
}
function takeNow() {
  const tool = toolNow(); let room = bagRoom(), n = 0;
  for (const id of trash.candidates(player.pos.x, player.pos.z, tool.r, room)) {
    if (n >= tool.per) break;
    const it = trash.take(id); if (!it) continue;
    room -= it.type.vol; n++; flyToBag(it); sound.pick?.(it.type.id);
    if (room < 1) break;
  }
  if (n) { trash.store.commit(); updateTrashUI(true); tut.notify('trash', n); }
  if (bagRoom() < 1) { sound.full?.(); fullToast(); }
}
function tickPick(dt) {
  if (!trash) return;
  const holding = pickS.held || keys.has('f') || (keys.has('e') && ctxTarget === pickAct);
  if (pickS.cyc < 0) {
    if (holding && !pickBlocked() && player.pose !== 'crouch') { if (canPick()) startPick(); else if (keys.has('f') && trashFull()) fullToast(); }
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
let lastTrashUI = '';
function updateTrashUI(bump) {
  if (!trash) return;
  const vol = trash.bagVol(), cap = bagCap(), c = trash.clean() * 100;
  const cs = c > 0 && c < 10 ? c.toFixed(1) : String(Math.floor(c));
  const key = `${vol}/${cap}/${cs}`;
  const pk = save.equip.bag === 0; if ($('bag-pill').classList.contains('pocket') !== pk) { $('bag-pill').classList.toggle('pocket', pk); $('bag-pill').title = pk ? '호주머니: 담은 양 / 용량' : '배낭: 담은 양 / 용량 (부피)'; } // 배낭이 없으면 호주머니 아이콘 (#31)
  if (key !== lastTrashUI) { lastTrashUI = key; $('bag-n').textContent = vol; $('bag-cap').textContent = cap; $('clean-n').textContent = cs; $('bag-pill').classList.toggle('full', vol >= cap); }
  if (bump) { const b = $('bag-pill'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
}
if (trash) {
  $('trash-hud').hidden = false;
  trash.on((ev, d) => {
    if (ev === 'trash') { ach.emit('trash'); ach.emit('trash-' + d.kind); if (nearTop()) ach.emit('trash-top'); if (sunEvent()) ach.emit('trash-sun'); if (wx.kind === 'rain') ach.emit('trash-rain'); onDexGet(d.dex, d.dexNew); }
    else if (ev === 'dex-test') onDexGet(d.dex, d.dexNew);
    else if (ev === 'heap-clear') { ach.emit('heap-clear'); toast('쓰레기 더미 하나를 다 치웠어요'); }
    else if (ev === 'reset') { pickS.cyc = -1; if (!d.first) toast('자정이 지나 오름에 쓰레기가 새로 쌓였어요'); }
    updateTrashUI(false);
  });
  updateTrashUI(false);
}
// ---------- 클린하우스: 배낭 비우고 귤 받기 ----------
// 귤·저장은 누르는 순간 한 번에 처리하고, 날아가는 쓰레기와 올라가는 숫자는 연출만 한다
const dumpS = { list: [], t: 0, dur: 0, total: 0, shown: 0, el: null, sndT: 0 };
function dumpBag() {
  if (!CH || dumpS.el) return;
  const bag = trash.store.bag, per = []; let n = 0, g = 0;
  TRASH_TYPES.forEach((t, k) => { const c = bag[t.id] || 0; if (c > 0) { per.push({ k, c, g: c * t.gyul }); n += c; g += c * t.gyul; } });
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
    const phone = W <= 600, mL = 40, mR = 40, mT = phone ? 110 : 90, mB = phone ? 190 : 120;
    let dx = x * W / 2, dy = -y * H / 2; if (Math.hypot(dx, dy) < 1e-3) dy = 1;
    const cx = W / 2, cy = H / 2;
    const tx = dx > 0 ? (W - mR - cx) / dx : dx < 0 ? (mL - cx) / dx : 1e9, ty = dy > 0 ? (H - mB - cy) / dy : dy < 0 ? (mT - cy) / dy : 1e9;
    const t = Math.min(tx, ty); sx = cx + dx * t; sy = cy + dy * t; ang = Math.atan2(dy, dx);
  }
  el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
  el.style.setProperty('--a', ang.toFixed(3) + 'rad');
}
function tickChArrow() {
  const on = !!CH && bagRoom() < 1 && !dumpS.el && cam.mode !== 'wardrobe' && !panelOpen() && player.pos.distanceTo(CH.front) > CLEANHOUSE.arrowNear;
  if (!on) { if (!chArrow.hidden) chArrow.hidden = true; }
  else {
    chArrow.hidden = false; placeArrow(chArrow, CH.center, 4.2);
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
  if (player.pose === 'sit') best = standAct;
  else if (player.riding && !busy()) best = dismountAct;
  else if (pickS.cyc >= 0) best = pickAct;
  else if (!busy() && !player.onArrive) {
    for (const it of interactables) { const d = it.pos.distanceTo(player.pos); if (d < it.r && d < bd) { bd = d; best = it; } }
    // 도구 반경 안에 쓰레기가 있으면 줍기 (다른 할 일 바로 앞이면 그쪽)
    if (canPick() && (!best || bd > best.r * 0.45) && !(best && best.ch && trash.bagVol() > 0)) best = pickAct;
    const d = life.nearestDeer(player.pos, 2.6);
    if (d) { if (!deerAct || deerAct.deer !== d) deerAct = { deer: d, label: '노루 타기', act: () => mountDeer(d) }; best = deerAct; }
    if (!net.hand.with && !net.hand.req && !net.hand.pendingFrom) {
      const e = net.nearestPeer(4.5);
      if (e && !e.data.hw && e.peer !== net.hand.declinedBy) {
        if (!handAct || handAct.peer !== e.peer) handAct = { peer: e.peer, label: `${e.nick}와 손잡기`, act: () => net.request(e.peer) };
        best = handAct;
      }
    }
  }
  if (best !== ctxTarget) { ctxTarget = best; ui.ctx.classList.toggle('idle', !best); }
  let label = '상호작용';
  if (best) label = best.cairn ? ((social.stones.get(best.cairn.id) || []).some((e) => e.mine) ? '소원 보기' : '돌 올리기') : best.label;
  const span = ui.ctx.querySelector('span');
  if (span.textContent !== label) span.textContent = label;
}

// ---------- 상점·옷장 ----------
function owned(part, kind, v) { const pr = itemPrice(part, kind, v); return pr === 0 || !!save.owned[itemKey(part, kind, v)]; }
// 상점 팝업 (#26): 탭 도구·배낭·신발·옷. 장비 탭은 5단계 한 줄(가진 것 체크·다음 것 값·그 뒤 잠금)
const GEAR_ROWS = { tool: { k: 'tool', list: TOOLS }, bag: { k: 'bag', list: BAGS }, shoes: { k: 'shoes', list: SHOES } };
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
};
const STAT_ICON = {
  per: '<circle cx="6" cy="16" r="2.5"/><circle cx="12" cy="8" r="2.5"/><circle cx="18" cy="16" r="2.5"/>', // 한 번에 몇 개
  rate: '<path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/>', // 초당
  r: '<path d="M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3"/>', // 닿는 거리
  cap: '<path d="M7 8h10v12H7zM9.5 8V6a2.5 2.5 0 0 1 5 0v2"/>', // 배낭 칸
  speed: '<path d="M4 17l6-6 4 4 6-8M14 7h6v6"/>', // 빠르기
};
const tierStats = (k, t) => k === 'tool' ? [t.rate ? ['rate', `${t.rate}/s`] : ['per', `×${t.per}`], ['r', `${t.r}m`]]
  : k === 'bag' ? [['cap', String(t.cap)]] : [['speed', `×${String(t.speed.toFixed(2)).replace(/0$/, '')}`]];
const nextGear = (k) => GEAR_ROWS[k].list[save.equip[k]];
const canBuyGear = () => Object.keys(GEAR_ROWS).filter((k) => { const n = nextGear(k); return n && save.coins >= n.price; });
let shopTab = 'tool', shopPick = null; // shopPick: 장비 탭에서 고른 단계(없으면 다음 단계)
function openShop(tab) {
  if (cam.mode === 'wardrobe' || player.pose === 'sit') return; closePanels();
  if (tab === 'gear' || !tab) { const ok = canBuyGear(); shopTab = ok[0] || (shopTab === 'wear' || !GEAR_ROWS[shopTab] ? 'tool' : shopTab); } else shopTab = tab;
  shopPick = null; shopHintUntil = 0; buildShop(); $('shop').hidden = false;
}
document.querySelectorAll('#shop-tabs [data-tab]').forEach((b) => b.addEventListener('click', () => { shopTab = b.dataset.tab; shopPick = null; buildShop(); }));
function checkGearBadges() { // 장비 최고 단계 뱃지 (#13)
  const m = ['tool', 'bag', 'shoes'].map((k) => save.equip[k] >= 5);
  if (m.some(Boolean) && !ach.state.badges['b-gear-one']) ach.emit('gear-max-one');
  if (m.every(Boolean) && !ach.state.badges['b-gear-all']) ach.emit('gear-max-all');
}
// 사는 연출: 귤이 위 귤 칸에서 빠져나가 산 물건 쪽으로 날아가 사라지고, 숫자가 줄어든다
function spendFx(toEl, price, from) {
  const pill = document.querySelector('#shop .shop-coins'), num = $('shop-coins');
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
  const row = GEAR_ROWS[k], cur = save.equip[k], next = row.list[cur]; if (!next) return;
  if (save.coins < next.price) { toast(`귤이 ${next.price - save.coins}개 모자라요`); return; }
  const from = save.coins;
  save.coins -= next.price; save.equip[k] = cur + 1;
  syncEquipGear(); runner.apply(save.outfit); persist(); updateStats(); updateTrashUI(true); net.send(true);
  sound.coin?.(); ach.emit('gear-buy'); ach.emit('gear-buy-' + k); checkGearBadges();
  toast(`${next.name} · 바로 착용했어요`);
  shopPick = null; buildShop();
  const cell = document.querySelector(`#shop-body .tier[data-i="${cur}"]`);
  if (cell) { cell.classList.add('tier-pop'); spendFx(cell, next.price, from); }
}
function buildGearShop(body, k) {
  const row = GEAR_ROWS[k], cur = save.equip[k], pick = shopPick ?? Math.min(cur, row.list.length - 1);
  const tiers = document.createElement('div'); tiers.className = 'tiers';
  const CHECK = `${SVG_A} stroke-width="3"><path d="M5 12l5 5 9-10"/></svg>`, LOCK = `${SVG_A} stroke-width="2.5"><path d="M7 11h10v9H7zM9 11V8a3 3 0 0 1 6 0v3"/></svg>`;
  row.list.forEach((t, i) => {
    const own = i < cur, isNext = i === cur, lock = i > cur;
    const c = document.createElement('button'); c.type = 'button'; c.dataset.i = i;
    c.className = 'tier' + (own ? ' own' : '') + (i === cur - 1 ? ' cur' : '') + (isNext ? ' next' : '') + (lock ? ' lock' : '');
    c.setAttribute('aria-pressed', String(i === pick)); c.setAttribute('aria-label', `${t.name} ${i + 1}단계`);
    c.innerHTML = `<i class="st">${own ? CHECK : lock ? LOCK : `${SVG_A} stroke-width="3"><path d="M12 19V6M6 11l6-6 6 6"/></svg>`}</i>`
      + `${SVG_A.replace('<svg', '<svg class="art"')}>${TIER_ART[k][i]}</svg>`
      + `<span class="n">${tierStats(k, t)[0][1]}</span>`
      + (own ? '' : `<span class="pr"><i class="g"></i>${t.price.toLocaleString()}</span>`);
    c.addEventListener('click', () => { shopPick = i; buildShop(); });
    tiers.append(c);
  });
  const t = row.list[pick], now = cur ? row.list[cur - 1] : POCKET;
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
  document.querySelectorAll('#shop-tabs [data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === shopTab)));
  if (GEAR_ROWS[shopTab]) { buildGearShop(body, shopTab); return; }
  for (const [part, opt] of Object.entries(OUTFIT_OPTIONS)) {
    const row = document.createElement('div'); row.className = 'w-row';
    const h = document.createElement('div'); h.className = 'w-label'; h.textContent = opt.label; row.append(h);
    const grid = document.createElement('div'); grid.className = 'shop-grid';
    const add = (kind, v, label, price, swatch) => {
      if (price <= 0) return; // 기본 제공·뱃지 전용은 상점에 없음
      const b = document.createElement('button'); b.type = 'button'; b.className = 'shop-item';
      const has = owned(part, kind, v);
      const sw = document.createElement('i'); sw.className = 'sw'; sw.style.background = v;
      const nm = document.createElement('span'); nm.textContent = label; const pr = document.createElement('b'); pr.textContent = has ? '보유' : `귤 ${price}`;
      if (swatch) b.append(sw); b.append(nm, pr);
      b.disabled = has;
      b.addEventListener('click', () => {
        if (save.coins < price) { toast(`귤이 ${price - save.coins}개 모자라요`); return; }
        const from = save.coins; save.coins -= price; save.owned[itemKey(part, kind, v)] = 1;
        if (kind === 't') save.outfit[part].type = v; else save.outfit[part].color = v;
        runner.apply(save.outfit); persist(); updateStats(); sound.coin?.();
        const bb = b.getBoundingClientRect(); buildShop(); const ghost = document.createElement('i'); ghost.style.cssText = `position:fixed;left:${bb.left}px;top:${bb.top}px;width:${bb.width}px;height:${bb.height}px;pointer-events:none`; document.body.append(ghost); spendFx(ghost, price, from); setTimeout(() => ghost.remove(), 700);
        toast(`${opt.label} ${label}을(를) 샀어요. 바로 입었어요`);
      });
      grid.append(b);
    };
    (opt.types || []).forEach(([v, l, pr]) => add('t', v, l, pr, false));
    (opt.colors || []).forEach(([c, pr]) => add('c', c, '색상', pr, true));
    if (grid.children.length) { row.append(grid); body.append(row); }
  }
}
let camBefore = null;
function buildWardrobe() {
  const body = $('wardrobe-body'); body.innerHTML = '';
  for (const [part, opt] of Object.entries(OUTFIT_OPTIONS)) {
    const row = document.createElement('div'); row.className = 'w-row';
    const h = document.createElement('div'); h.className = 'w-label'; h.textContent = opt.label; row.append(h);
    const ctl = document.createElement('div'); ctl.className = 'w-ctl';
    if (opt.types) {
      const types = document.createElement('div'); types.className = 'chips';
      opt.types.filter(([v]) => owned(part, 't', v)).forEach(([v, l]) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = l;
        b.setAttribute('aria-pressed', String(save.outfit[part].type === v));
        b.addEventListener('click', () => { save.outfit[part].type = v; changed(); });
        types.append(b);
      });
      if (part === 'hat') {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = '뒤로 돌려 쓰기';
        b.setAttribute('aria-pressed', String(!!save.outfit.hat.back));
        b.disabled = !['cap', 'visor'].includes(save.outfit.hat.type);
        b.addEventListener('click', () => { save.outfit.hat.back = !save.outfit.hat.back; changed(); });
        types.append(b);
      }
      ctl.append(types);
    }
    if (opt.colors) {
      const sw = document.createElement('div'); sw.className = 'swatches';
      opt.colors.filter(([c]) => owned(part, 'c', c)).forEach(([c]) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'swatch'; b.style.background = c;
        b.setAttribute('aria-label', `${opt.label} 색 ${c}`);
        b.setAttribute('aria-pressed', String(save.outfit[part].color === c));
        b.addEventListener('click', () => { save.outfit[part].color = c; changed(); });
        sw.append(b);
      });
      ctl.append(sw);
    }
    row.append(ctl); body.append(row);
  }
  function changed() { runner.apply(save.outfit); persist(); buildWardrobe(); net.send(true); }
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
$('wardrobe-done').addEventListener('click', closeWardrobe);
$('nick-reroll').addEventListener('click', () => { save.nick = `${pick(ADJ)} ${pick(NOUN)}`; ui.nick.textContent = save.nick; $('nick-mirror').textContent = save.nick; persist(); });

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
let leaving = false, throwT = 0;
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
life.bind(player, sound);
life.hooks.boarHit = (dir) => {
  if (player.air && player.jumpV > 0) return;
  if (player.riding) dismountDeer();
  player.kb.copy(dir).multiplyScalar(14); player.air = true; player.jumpV = 9; player.jumpY = 0.01;
  player.target = null; marker.visible = false; player.pose = 'move';
  sound.stone(); toast('멧돼지에 받혔어요! 귤을 던지면 도망가요');
};
life.hooks.boarAppear = () => { toast('멧돼지가 나타났어요! 귤을 던지면 도망가요'); };
life.hooks.boarGone = () => toast('멧돼지가 숲으로 돌아갔어요');
life.hooks.boarRepel = () => ach.emit('boar-repel');
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
  updateStats(); const pill = document.querySelector('.gyul'), cands = [pill.querySelector('i'), $('chip-gyul')].map((e) => e && e.getBoundingClientRect()).filter((r) => r && r.width > 0), tgt = cands[0] || { left: 24, top: 24 }, k = LOW ? 14 : 28;
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
function setSoundUI() { const b = $('btn-sound'); b.setAttribute('aria-pressed', String(sound.on)); $('menu-sound').setAttribute('aria-pressed', String(sound.on)); b.querySelector('span').textContent = sound.on ? '소리 켜짐' : '소리 꺼짐'; }
$('btn-sound').addEventListener('click', () => { if (sound.on) sound.stop(); else sound.start(); setSoundUI(); });
function enter(withSound) {
  if (introMap !== MAP_ID) { save.introSound = withSound ? 1 : 0; switchMap(introMap); return; }
  if (withSound) sound.start();
  setSoundUI();
  canvas.focus({ preventScroll: true });
  $('intro').hidden = true; $('intro-help').hidden = true;
  if (!save.entered) { save.entered = 1; persist(); awe = 5; cam.dist = 30; cam.pitch = 0.35; $('intro-help').hidden = false; }
}
$('enter-sound').addEventListener('click', () => enter(true));
$('enter-quiet').addEventListener('click', () => enter(false));
document.addEventListener('visibilitychange', () => { if (!sound.ctx) return; if (document.hidden) sound.ctx.suspend(); else if (sound.on) sound.ctx.resume(); });
// 다른 탐방로로 막 옮겨 왔으면 바로 입장
if (prevMap && prevMap !== MAP_ID && save.entered) { $('intro').hidden = true; if (save.introSound) { const once = () => { sound.start(); setSoundUI(); removeEventListener('pointerdown', once); }; addEventListener('pointerdown', once); } }
if (prevMap && prevMap !== MAP_ID && prevMap !== 'gate' && MAP_ID !== 'gate') ach.emit('visit-other');
if (Object.keys(ach.state.visited).length >= 2 && !ach.state.badges['b-both']) ach.emit('visit-both');

// ---------- 갱신 ----------
function updatePlayer(dt) {
  const p = player;
  p.poseT += dt;
  if (stream && stream.update(dt, p)) { marker.visible = false; placeRunner(dt); return; } // 개울에 빠져 건져 올려지는 중 (#31)
  if (p.pose === 'wave' && p.poseT > 2.2) p.pose = 'move';
  if (p.pose === 'throw') { if (throwPending && p.poseT >= THROW.release) releaseTangerine(); if (p.poseT >= THROW.total) p.pose = 'move'; }
  else if (throwPending) throwPending = false;
  if (p.pose === 'dance' && p.poseT > 6) p.pose = 'move';
  if (p.pose === 'crouch' && p.poseT > 1.0) p.pose = 'move';

  let dir = null;
  if (!busy() && p.pose !== 'wave' && p.pose !== 'photo-wait') {
    let fx = 0, fz = 0;
    if (keys.has('w') || keys.has('arrowup')) fz -= 1;
    if (keys.has('s') || keys.has('arrowdown')) fz += 1;
    if (keys.has('a') || keys.has('arrowleft')) fx -= 1;
    if (keys.has('d') || keys.has('arrowright')) fx += 1;
    if ((fx || fz || joy.active) && p.pose === 'dance') p.pose = 'move';
    const jm = Math.hypot(joy.x, joy.y);
    if (joy.active && jm > 0.15) {
      // 조이스틱: 화면 기준 방향 (카메라가 보는 쪽이 위)
      p.target = null; p.onArrive = null; marker.visible = false;
      const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
      dir = new THREE.Vector3(joy.x * c + joy.y * s, 0, -joy.x * s + joy.y * c).normalize();
      p.joyMag = jm;
      if (!p.riding) { let dh = wrapA(Math.atan2(dir.x, dir.z) - p.heading); p.heading += dh * Math.min(1, dt * 10); }
      if (ptrs.size === 0 && camHold <= 0) { const dy = wrapA((p.heading + Math.PI) - cam.yaw); cam.yaw += dy * Math.min(1, dt * 0.8); }
    } else if (fx || fz) {
      p.target = null; p.onArrive = null; marker.visible = false; p.joyMag = 1;
      if (fx) { if (p.riding) p.riding.heading -= fx * dt * 2.6; else p.heading -= fx * dt * 2.6; }
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
  const want = dir ? (slow ? 4 : p.running ? 10 : 5) * SHOES[save.equip.shoes - 1].speed : 0; // 신발 단계만큼 빨라짐
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
  if (p.pose === 'sit') p.pos.y = benchPos.y;
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

const tmpDir = new THREE.Vector3(); const compassDial = document.getElementById('compass-dial'); let compassRot = null;
function frame(now) {
  const rawDt = (now - last) / 1000; const dt = Math.min(0.05, rawDt); last = now;
  camHold = Math.max(0, camHold - dt);
  updatePlayer(dt); tickJuice(dt); if (trash) { trash.update(dt, player.pos); tickPick(dt); tickFly(dt); } if (CH) { CH.update(dt, lampNight); tickDump(dt); tickChArrow(); } devLabels.update(dt); tut.update(dt); if (jeong) { jeong.update(dt); if (!jeong.isOpen && jeongReady()) openJeong(); } lamps.update(player.pos, lampNight);
  net.update(dt); net.send(false); updateHandLine();
  life.update(dt, now / 1000);
  social.tickBubbles(); tickQueue(); tickSunWatch(dt); tickBanner(dt);
  if (awe > 0) { awe -= dt; cam.dist += (24 - cam.dist) * Math.min(1, dt * 1.5); cam.pitch += (0.12 - cam.pitch) * Math.min(1, dt * 1.5); cam.yaw += dt * 0.35; if (awe <= 0) aweBack = 2; }
  if (aweBack > 0 && !ptrs.size) { aweBack -= dt; cam.dist += (13 - cam.dist) * Math.min(1, dt * 2); cam.pitch += (0.32 - cam.pitch) * Math.min(1, dt * 2); }
  adaptQuality(rawDt);
  const breath = tickBreath(dt);
  tickPhoto(dt);
  runner.setTint(Date.now() < player.yellowUntil);
  if (net.hand.hitBy && net.hand.hitBy.at > (player.lastHitAt || 0)) { player.lastHitAt = net.hand.hitBy.at; player.yellowUntil = Date.now() + 6000; toast(`${net.hand.hitBy.nick}이(가) 던진 귤에 맞았어요`); net.send(true); }
  const pose = player.riding ? 'sit' : player.pose === 'photo-wait' ? 'move' : player.pose;
  const fx = Math.sin(player.heading) * 0.6, fz = Math.cos(player.heading) * 0.6; // 진행 방향 비탈 (오르막 +)
  const slope = (groundAt(player.pos.x + fx, player.pos.z + fz) - groundAt(player.pos.x - fx, player.pos.z - fz)) / 1.2;
  runner.animate(dt, { speed: player.speed, running: player.running, pose, t: player.poseT, breath, air: player.air, jumpV: player.jumpV, slope: player.riding ? 0 : Math.max(-1, Math.min(1, slope)), tool: save.equip.tool, dur: toolNow().time });
  marker.rotation.z += dt;
  tickCairnLod(dt);
  cairns.forEach((c) => { if (c.drop > 0) { c.drop = Math.max(0, c.drop - dt * 4); c.im.position.y = c.drop * c.drop; } });
  clouds.rotation.y += dt * 0.012;
  { // 나침반: 화면이 보는 방향 기준으로 다이얼 회전 (북쪽 = -z)
    camera.getWorldDirection(tmpDir); const ang = Math.atan2(tmpDir.x, -tmpDir.z) * 180 / Math.PI;
    const r = Math.round(-ang * 2) / 2; if (r !== compassRot) { compassRot = r; compassDial.setAttribute('transform', `rotate(${r})`); }
  }
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
  else if (cam.mode === 'wardrobe') {
    const narrow = innerWidth <= 600;
    const look = player.pos.clone(); look.y += narrow ? -1.6 : 1.25;
    const yaw = player.heading;
    if (!narrow) look.add(new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(-1.4));
    camTarget.look.copy(look);
    const d = narrow ? 10 : 4.6;
    camTarget.pos.set(look.x + Math.sin(yaw) * d, look.y + (narrow ? 2.2 : 0.5), look.z + Math.cos(yaw) * d);
    ease(dt, false, 6);
  } else if (cam.mode === 'sit') {
    const tan = new THREE.Vector3(-benchOut.z, 0, benchOut.x);
    const look = player.pos.clone().addScaledVector(benchOut, 22).addScaledVector(tan, -16); look.y -= 7;
    camTarget.look.copy(look);
    camTarget.pos.copy(player.pos).addScaledVector(tan, 6.5).addScaledVector(benchOut, -1.5);
    camTarget.pos.y = Math.max(player.pos.y + 3.4, height(camTarget.pos.x, camTarget.pos.z) + 2);
    ease(dt, false, 1.5);
  } else if (cam.mode === 'photo') ease(dt, false, 4);

  updateContext();
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) ui.toast.hidden = true; }
  alertMark.visible = life.boarActive() && life.boarNear(player.pos, 40); if (alertMark.visible) alertMark.position.y = 3.0 + Math.abs(Math.sin(now / 150)) * 0.3;
  updateStats();
  // 폰: 귤 던지기 버튼은 던질 상대(노루·하르방·멧돼지)가 가까울 때만
  throwT -= dt; if (throwT <= 0) { throwT = 0.4; const near = (q) => Math.abs(q.x - player.pos.x) < 34 && Math.abs(q.z - player.pos.z) < 34;
    document.body.classList.toggle('throw-near', life.deer.some((d) => near(d.pos)) || life.hareubangs.some((h) => near(h.pos)) || (life.boarActive() && life.boarNear(player.pos, 40))); }
  saveT += dt; if (saveT > 5) { saveT = 0; persist(); }
  if (NSW) { NSW.update(dt, player.pos, camera); wallPl.value.copy(player.pos); wall.update(player.pos); renderer.render(scene, camera); }
  else if (save.gfx === 'smooth' && post.ok) post.render(scene, camera); else retro.render(scene, camera);
  if (captureNext) { captureNext = false; capture(); }
  requestAnimationFrame(frame);
}

addEventListener('resize', resize);
resize();
cairns.forEach(layoutCairn);
applySky(); updateWxChip();
refreshAchUI();
setGait(0);
followCam(0, true);
requestAnimationFrame(frame);
// ---------- 튜토리얼 (입구 마당) ----------
// 튜토리얼용 쓰레기 6개 (번호 TRASH.total + k)
const tutTrashLeftList = () => (trash ? (spots.tut?.trash || []).filter((_, k) => !trash.store.isPicked(TRASH.total + k)) : []);
const tutTrashNext = () => { let b = null, bd = 1e9; for (const t of tutTrashLeftList()) { const d = Math.hypot(t.x - player.pos.x, t.z - player.pos.z); if (d < bd) { bd = d; b = t; } } return b; };
const tut = createTutorial({ save, persist, player, isTouch, pts: NS_TUT, scene, height, camera, placeArrow, stream, jeong, openJeong, bagVol: () => (trash ? trash.bagVol() : 0), bagCap, tutTrashLeft: () => tutTrashLeftList().length, tutTrashNext, ch: CH, onDone: () => updateTrashUI(false) });
if (NS_TUT && tut.active) { document.body.classList.add('tut'); hideHint(); }
else if (!NS_TUT && save.tut && !save.tut.done) { save.tut.done = true; persist(); }
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
window.__oreum = { stream, jeong, tut, openJeong, gyulShower, prints, bound: NSW ? NSB : null, wall, setWeather: (k) => wx.set(k), wx, col, cairns, fillCairn, cleanhouse: CH && { api: CH, dump: () => dumpBag(), go: () => { player.pos.copy(CH.front); player.pos.y = height(CH.front.x, CH.front.z); player.heading = Math.atan2(CH.center.x - CH.front.x, CH.center.z - CH.front.z); }, recycle: () => ({ ...save.recycle, coins: save.coins }), shopHint: () => shopHintUntil, openShop, buyGear, canBuyGear }, trash: trash && { ...trash.test, dexList: DEX_LIST, openDex, checkGearBadges, api: trash, state: () => ({ date: trash.store.date(), bag: { ...trash.store.bag }, vol: trash.bagVol(), cap: bagCap(), clean: trash.clean(), today: trash.store.pickedCount(), total: trash.store.totalCount(), picking: pickS.cyc >= 0 }) }, keys, player, sound, devLabels, buildRunner, runner, retro, trail, groundAt, height, cam, interactables, save, life, social, ach, quality, renderer, scene, spots, joy, camObj: camera, setTod: (h) => { todOverride = h; applySky(); }, sunState: () => sunState, snap: () => followCam(0, true),
  tp: (x, z, h, pitch = 0.2, dist = 13, yawOff = 0) => { player.pos.set(x, height(x, z), z); player.visY = player.pos.y; player.heading = h; player.viewSeen = true; awe = 0; aweBack = 0; cam.yaw = h + Math.PI + yawOff; cam.pitch = pitch; cam.dist = dist; placeRunner(); followCam(0, true); } };
