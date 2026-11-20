// 렌더러·장면·빛·성능 단계 적용, 실제 제주 시각의 해·하늘, 날씨 반영 (#86 에서 main.js 를 나눔. 파일 순서는 src/main.js, 규칙은 notes/prototype-v1.md 코드 구조)
import { NSMODE } from '../boot.js';
import { buildNamsongi, nsAlong } from '../namsongi.js';
import { createFootprints } from '../footprints.js';
import { PERF, CLEANHOUSE, SHOP_ST, SHOPS, LEAP, SCREEN, CRASH } from '../balance.js';
import { crashNote, reportCrash } from '../crash.js';
import { TIER, PERF_AUTO, PERF_PREF } from '../quality.js';
import { STREET } from '../streetlayout.js';
import { createRetro } from '../retro.js';
import * as THREE from 'three';
import { buildTerrain, buildDecor, buildSky, height, groundAt, surfaceAt, groundColor } from '../world.js';
import { G, blendMood, createGrass, createMotes, createPost, createFlowers, PW, LOW } from '../gfx2.js';
import { buildDonnaekoDecor } from '../donnaeko.js';
import { buildGateDecor } from '../gate.js';
import { createLamps } from '../lamps.js';
import { setBlinkCamera } from '../runner.js';
import { buildSpots } from '../maps.js';
import * as NSB from '../nsbound.js';
import { createWeather } from '../weather.js';
import { sunPosition, sunTimes, sunDir, buildSkyBodies } from '../sun.js';
import { kstDate } from '../achievements.js';
import { state, late } from './state.js';
import { $, clamp, save, MAP_ID } from './save.js';

// ---------- 렌더러 ----------
export const canvas = $('view');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'default' });
renderer.outputColorSpace = NSMODE ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// WebGL 화면을 잃었을 때 (#108): 휴대폰이 메모리가 모자라면 GPU 문맥을 빼앗기도 함. three 가 되살아난 문맥에 모든 걸 다시 올림.
// 그동안 안내를 보이고, CRASH.glWait 안에 돌아오지 않으면 '다시 불러오기'. 되살아나면 셰이더를 다시 준비
state.glLost = false;
{
  let lostT = 0;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); state.glLost = true; crashNote('WebGL 잃음'); reportCrash({ name: 'ContextLost', message: 'webglcontextlost' }, 'gl');
    $('gl-lost-t').textContent = '화면을 다시 준비하고 있어요'; $('gl-reload').hidden = true; $('gl-lost').hidden = false;
    clearTimeout(lostT); lostT = setTimeout(() => { if (!state.glLost) return; $('gl-lost-t').textContent = '화면을 되살리지 못했어요'; $('gl-reload').hidden = false; }, CRASH.glWait);
  });
  canvas.addEventListener('webglcontextrestored', () => {
    state.glLost = false; clearTimeout(lostT); $('gl-lost').hidden = true; crashNote('WebGL 되살아남');
    setTimeout(() => { try { renderer.compileAsync(scene, camera).catch(() => {}); } catch (e) { /* 다음 그릴 때 준비됨 */ } }, 50);
  });
  $('gl-reload').addEventListener('click', () => location.reload());
}
state.farCull = null; // 멀리 있는 작은 물체 감추기 (#79), 맨 끝에서 만듦
export const quality = { pr: 1, level: TIER, tier: TIER, auto: PERF_AUTO, pref: PERF_PREF }; // 성능 단계 (#79): level 은 지금 쓰는 단계(자동이면 느릴 때 내려감)
export const retro = createRetro(renderer);
export const post = createPost(renderer, LOW);
if (!save.gfxV3) { save.gfx = 'smooth'; save.gfxV3 = 1; } retro.on = save.gfx === 'toon' || save.gfx === 'retro'; retro.setMode(save.gfx === 'retro' ? 'retro' : 'toon');
export const scene = new THREE.Scene();
const FOG = new THREE.Color('#cfe0dc');
scene.background = FOG;
scene.fog = new THREE.Fog(FOG, MAP_ID === 'gate' ? 90 : 220, MAP_ID === 'donnaeko' ? 3200 : MAP_ID === 'gate' ? 900 : 2600);
const leapLane = (() => { const sh = SHOPS.find((r) => r.id === 'leap'), l = sh && STREET.lot(sh.lot); if (!l) return []; const at = (k) => [l.front.x + l.back.x * k, l.front.z + l.back.z * k]; return [{ pts: [at(LEAP.fore - 0.2), at(LEAP.fore + LEAP.D + 0.2)], w: LEAP.W / 2 + 0.2 }]; })(); // LEAP 바닥 밑 풀 없앰 (#59)
export const NSW = NSMODE ? buildNamsongi({ scene, renderer, bound: NSB, clear: [...STREET.clear, ...CLEANHOUSE.mini.map((m) => ({ ...nsAlong(m.path, m.d, m.side, CLEANHOUSE.miniOff), clearR: 5.5 }))], lanes: [{ pts: STREET.alley, w: SHOP_ST.half + 0.3 }, ...leapLane] }) : null; // 가게 거리(#57) 자리는 나무·바위를 비우고 판석 골목

if (NSW) { scene.fog.near = NSW.fogNear; scene.fog.far = NSW.fogFar; }
export const camera = new THREE.PerspectiveCamera(SCREEN.fov, 1, 0.5, NSW ? NSW.camFar : 14000);
setBlinkCamera(camera); // 먼 캐릭터는 깜빡임 생략 (#74)
export function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  const cap = quality.level === 2 ? (w < 700 ? PERF.prNarrow : PERF.pr[2]) : PERF.pr[quality.level];
  quality.pr = Math.min(window.devicePixelRatio || 1, cap);
  renderer.setPixelRatio(quality.pr);
  renderer.setSize(w, h, false);
  retro.setSize(w * quality.pr, h * quality.pr); post.setSize(w * quality.pr, h * quality.pr);
  camera.aspect = w / h;
  camera.fov = w > h && h <= SCREEN.lowH ? SCREEN.fovLow : SCREEN.fov; // 돌리면 바로 화각을 맞춤 (#105)
  camera.updateProjectionMatrix();
}

const hemi = new THREE.HemisphereLight('#dcecff', '#a8b07a', 2.4); scene.add(hemi);
export const sun = new THREE.DirectionalLight('#fff1d6', 1.0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 50; sun.shadow.camera.far = 1400;
sun.shadow.camera.left = -58; sun.shadow.camera.right = 58; sun.shadow.camera.top = 58; sun.shadow.camera.bottom = -58;
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.9; sun.shadow.radius = 4;
if (NSW) NSW.setupShadow(sun);
const SHADOW_DEF = sun.shadow.mapSize.x;
// 성능 단계 적용 (#79): 그림자 지도 크기·그림자 켜고 끄기(낮음은 끔)·픽셀 배율
export function applyQuality() {
  const L = quality.level, ms = PERF.shadow[L] || SHADOW_DEF, sh = L > 0;
  if (sun.shadow.mapSize.x !== ms) { sun.shadow.mapSize.set(ms, ms); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  if (renderer.shadowMap.enabled !== sh) { renderer.shadowMap.enabled = sh; sun.castShadow = sh; }
  if (typeof resize === 'function' && camera) resize();
}
scene.add(sun); scene.add(sun.target);
export const fill = new THREE.DirectionalLight('#fff1d6', 1.0); scene.add(fill); scene.add(fill.target);
// 역광(림라이트): 해 반대편에서 차갑게 살짝, 캐릭터·나무 윤곽을 땅에서 띄워 줌
export const rim = new THREE.DirectionalLight('#bcd4ff', 0.55); scene.add(rim); scene.add(rim.target);
export const SUN_DIR = new THREE.Vector3(-0.5, 0.7, 0.4).normalize();

export const terrain = NSW ? NSW.terrain : buildTerrain();
terrain.receiveShadow = true;
scene.add(terrain);
if (NSW) { /* 남송이오름은 자기 풍경을 직접 만든다 */ } else if (MAP_ID === 'donnaeko') buildDonnaekoDecor(scene, height); else if (MAP_ID === 'gate') buildGateDecor(scene, height); else buildDecor(scene);
const sky = NSW ? NSW.sky : buildSky(scene);
export const clouds = sky.clouds;
const bodies = buildSkyBodies(scene);
export const wx = createWeather({ scene, low: LOW });
if (NSW) bodies.stars.scale.setScalar(14); // 먼 산 뒤로
export const eoksaeMat = scene.getObjectByName('eoksae')?.material || null;
scene.fog.color = FOG; G.fogC.value = FOG; const FOG_N = scene.fog.near, FOG_F = scene.fog.far;
const TERR_EXT = terrain.geometry.parameters.width / 2 - 2;
export const grass = NSW ? NSW.grass : createGrass({ scene, height, colorAt: groundColor, low: LOW, canGrow: (x, z) => (Math.abs(x) > TERR_EXT || Math.abs(z) > TERR_EXT || surfaceAt(x, z) !== 0 || groundAt(x, z) - height(x, z) > 0.05) ? 0 : (MAP_ID === 'donnaeko' ? 0.55 : 1) });
export const motes = createMotes({ scene, height, low: LOW });
export const prints = createFootprints({ scene, height, surfaceAt, low: LOW }); // 발자국 (#21)
if (PW && !NSW) createFlowers({ scene, height, extent: TERR_EXT, count: LOW ? 3200 : 6500, canGrow: (x, z) => (Math.abs(x) > TERR_EXT || Math.abs(z) > TERR_EXT || surfaceAt(x, z) !== 0 || groundAt(x, z) - height(x, z) > 0.05) ? 0 : 1 });
export const spots = buildSpots(MAP_ID);
if (NSW && spots.tut?.stream) spots.lamps = [...(spots.lamps || []), ...STREET.lamps]; // 가게 거리 가로등 (#57)
export const lamps = createLamps({ scene, positions: spots.lamps || [], height });

// ---------- 시간·해 (실제 제주 시각) ----------
state.todOverride = null; // 테스트용: 오늘 몇 시로 볼지
const nowDate = () => { if (state.todOverride == null) return new Date(); const d = new Date(); const kstMid = Math.floor((d.getTime() + 9 * 3600000) / 86400000) * 86400000 - 9 * 3600000; return new Date(kstMid + state.todOverride * 3600000); };
let todayTimes = sunTimes(new Date()), todayKey = kstDate();
export let sunState = { el: 30, az: 180, k: 1, golden: 0 };
export let lampNight = 0;
export function applySky() {
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
  late.sound.setDaylight?.(k);
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
wx.onChange(() => { state.wxT = 0; });
state.wxT = 0;
export function sunEvent() {
  const t = nowDate().getTime();
  const r = todayTimes.rise?.getTime(), s = todayTimes.set?.getTime();
  if (r && t > r - 25 * 60000 && t < r + 30 * 60000) return 'sunrise';
  if (s && t > s - 30 * 60000 && t < s + 25 * 60000) return 'sunset';
  return null;
}
