// 물건 그림 (#184): 옷·도구·배낭·신발·무기·탈것을 선 그림 대신 실제 3D 모델을 찍은 작은 그림으로
// - 처음 필요할 때 작은 렌더러(96px, 게임 화면과 따로)로 한 번 찍어 data URL 로 캐시. 물건이 늘어도 아이콘을 따로 그리지 않아도 됨 (#179 대비)
// - 게임 시작 뒤 한가할 때 조금씩 미리 찍어 두고, 렌더러는 한동안 안 쓰면 버림(GPU 메모리)
// - 못 찍으면(WebGL 없음·모델 없음) 아이콘 세트 그림으로
// 부르기: late.itemArt(kind, i, cls) — kind: tool·bag·shoes·weapon (단계 i, 0부터), 'ride:<id>', 옷은 clothSvg(c) 가 알아서 씀
import * as THREE from 'three';
import { ACCESSORIES, TOOL_GEAR, BAG_GEAR, SHOE_GEAR } from '../gear.js';
import { rideDisplay } from '../rides.js';
import { gradHard } from '../toon.js';
import { CLOTHES } from '../balance.js';
import { ART as CLOTH_ART } from '../clothicons.js';
import { SVG_ATTR } from '../icons.js';
import { late } from './state.js';
import { renderer } from './scene.js';

const SZ = 96, IDLE_DROP = 15000;
const WEAPON_GEAR = [null, 'hand:bow', 'hand:gun', 'hand:mg', 'hand:laser', 'hand:bomb'];
const KEYS = { tool: TOOL_GEAR, bag: BAG_GEAR, shoes: SHOE_GEAR, weapon: WEAPON_GEAR, boots: ['shoes:boots'] }; // boots: 고진의 파란장화 (#167)
// 보는 방향 (물건 가운데에서 카메라 쪽). 캐릭터 앞은 +z
const VIEW = { hat: [0.55, 0.5, 1], back: [-0.7, 0.35, -1], shoes: [0.7, 0.75, 1], hand: [0.35, 0.3, 1], ride: [1, 0.45, 0.55], cloth: [0.45, 0.2, 1] };
const cache = new Map();
let R = null, S = null, C = null, dead = false, dropT = 0;

function rig() {
  if (R || dead) return !!R;
  try {
    R = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    R.setPixelRatio(1); R.setSize(SZ, SZ, false); R.setClearColor(0x000000, 0);
    R.outputColorSpace = renderer.outputColorSpace; R.toneMapping = renderer.toneMapping; R.toneMappingExposure = renderer.toneMappingExposure;
    S = new THREE.Scene();
    S.add(new THREE.HemisphereLight(0xfff6e4, 0x6a6458, 2.2));
    const d = new THREE.DirectionalLight(0xffffff, 2.4); d.position.set(2, 4, 3); S.add(d);
    C = new THREE.PerspectiveCamera(26, 1, 0.01, 60);
  } catch (e) { dead = true; R = null; }
  return !!R;
}
function drop() { if (!R) return; R.dispose(); R.forceContextLoss?.(); R = S = C = null; }
const mat = (list) => (n, d) => { const m = new THREE.MeshToonMaterial({ color: d, gradientMap: gradHard }); m.emissive.set(d).multiplyScalar(0.12); list.push(m); return m; };

function build(key) {
  if (key.startsWith('ride:')) { const f = rideDisplay[key.slice(5)]; return f ? { obj: f(), view: VIEW.ride } : null; }
  const a = ACCESSORIES[key]; if (!a || a.builtin || !a.build) return null;
  const mats = [], obj = a.build(mat(mats));
  const view = a.cloth ? (a.slot === 'hat' ? VIEW.hat : VIEW.cloth) : VIEW[a.slot] || VIEW.cloth;
  return { obj, view, mats };
}
// 화면에 꽉 차게: 정점들을 화면에 비춰 본 크기로 거리·가운데를 맞춤. 가늘고 긴 것(집게·활)은 대각선으로 눕힘
const _v = new THREE.Vector3(), _c = new THREE.Vector3();
function extent(pts) { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const p of pts) { _v.copy(p).project(C); x0 = Math.min(x0, _v.x); x1 = Math.max(x1, _v.x); y0 = Math.min(y0, _v.y); y1 = Math.max(y1, _v.y); } return { x0, x1, y0, y1 }; }
function frame(obj, dir) {
  const pts = []; obj.traverse((o) => { const P = o.isMesh && o.geometry?.attributes?.position; if (!P) return; const step = Math.max(1, Math.floor(P.count / 400)); for (let i = 0; i < P.count; i += step) pts.push(new THREE.Vector3().fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld)); });
  const box = new THREE.Box3().setFromPoints(pts), ctr = box.getCenter(new THREE.Vector3()), r = Math.max(0.02, box.getSize(_c).length() / 2);
  let dist = r / Math.sin(THREE.MathUtils.degToRad(C.fov / 2));
  const place = () => { C.position.copy(ctr).addScaledVector(dir, dist); C.near = Math.max(0.002, dist - r * 2.2); C.far = dist + r * 2.2; C.updateProjectionMatrix(); C.lookAt(ctr); C.updateMatrixWorld(true); };
  C.up.set(0, 1, 0); place();
  let e = extent(pts); const asp = (e.x1 - e.x0) / Math.max(1e-4, e.y1 - e.y0);
  if (asp > 2.4 || asp < 0.42) { C.up.set(0, 1, 0).applyAxisAngle(dir, (asp > 1 ? -1 : 1) * Math.PI / 4.5); place(); }
  for (let k = 0; k < 3; k++) { // 가운데 맞추고 크기 맞추기
    e = extent(pts);
    const mx = (e.x0 + e.x1) / 2, my = (e.y0 + e.y1) / 2, half = Math.max(e.x1 - e.x0, e.y1 - e.y0) / 2;
    _v.set(mx, my, 0.5).unproject(C).sub(C.position).normalize(); const ahead = ctr.clone().sub(C.position).length();
    ctr.copy(C.position).addScaledVector(_v, ahead); dist *= half / 0.86; place();
  }
}
function shoot(key) {
  if (cache.has(key)) return cache.get(key);
  let url = null;
  try {
    const b = build(key);
    if (b && rig()) {
      const { obj, view } = b; S.add(obj); obj.updateMatrixWorld(true);
      frame(obj, new THREE.Vector3(...view).normalize());
      R.render(S, C); url = R.domElement.toDataURL('image/png');
      S.remove(obj); obj.traverse((o) => { if (o.isMesh) { if (!o.userData.keep) o.geometry?.dispose(); [].concat(o.material).forEach((m) => m?.dispose?.()); } });
    }
  } catch (e) { url = null; }
  cache.set(key, url);
  clearTimeout(dropT); dropT = setTimeout(drop, IDLE_DROP);
  return url;
}
const img = (url, cls) => `<img class="${cls ? cls + ' ' : ''}thumb" src="${url}" alt="" aria-hidden="true" draggable="false">`;
// 단계 물건: 찍은 그림, 없으면 아이콘 세트(late.TIER_ART)
export function itemArt(kind, i, cls = 'art') {
  const key = KEYS[kind]?.[i], url = key && shoot(key);
  if (url) return img(url, cls);
  const inner = late.TIER_ART?.[kind]?.[i] || '';
  return `<svg ${cls ? `class="${cls}" ` : ''}${SVG_ATTR}>${inner}</svg>`;
}
export const rideArt = (id, cls = '') => { const url = shoot('ride:' + id); return url ? img(url, cls) : ''; };
// 옷 그림: clothicons.js clothSvg 가 먼저 부름
CLOTH_ART.thumb = (c, cls) => { const url = c && shoot(c.id); return url ? img(url, cls) : ''; };
late.itemArt = itemArt; late.rideArt = rideArt;

// 한가할 때 미리 찍기: 게임 시작 조금 뒤부터 한 번에 하나씩
const ALL = () => [...TOOL_GEAR, ...BAG_GEAR, ...SHOE_GEAR, 'shoes:boots', ...WEAPON_GEAR, ...Object.keys(rideDisplay).map((k) => 'ride:' + k), ...CLOTHES.map((c) => c.id)].filter((k) => k && !cache.has(k));
export function warmThumbs(delay = 8000) {
  const idle = window.requestIdleCallback || ((f) => setTimeout(() => f({ timeRemaining: () => 8 }), 200));
  setTimeout(() => { const list = ALL(); const step = (d) => { while (list.length && d.timeRemaining() > 4) shoot(list.shift()); if (list.length) idle(step, { timeout: 3000 }); }; idle(step, { timeout: 3000 }); }, delay);
}
