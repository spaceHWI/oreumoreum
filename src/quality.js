// 기기 성능 단계 (#79): 0 낮음 · 1 보통 · 2 높음. 저장 save.perf = 'auto'(기본) | 0 | 1 | 2
// 맨 처음(다른 모듈보다 먼저) 정해져야 해서 저장소를 직접 읽는다. 주소 ?tier=0|1|2 는 확인용 강제, ?hi 는 높음
import { PERF } from './balance.js';
import { isMobile } from './mview.js';
import { GL_START } from './glguard.js';

const KEY = __DEV__ ? 'oreumoreum.dev' : 'oreumoreum.v1';
function storedPref() { try { const v = JSON.parse(localStorage.getItem(KEY) || '{}').perf; return v === 0 || v === 1 || v === 2 ? v : 'auto'; } catch { return 'auto'; } }
function gpuName() {
  try {
    const c = document.createElement('canvas'), gl = c.getContext('webgl'); if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info'), n = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    gl.getExtension('WEBGL_lose_context')?.loseContext(); return String(n || '');
  } catch { return ''; }
}
export function autoTier() {
  if (typeof navigator === 'undefined') return 2;
  const ua = navigator.userAgent, mobile = isMobile() || /Android|iPhone|iPad/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua)); /* 모바일 화면으로 보기 틀 안도 폰 단계 (#220) */
  const cores = navigator.hardwareConcurrency || 8, mem = navigator.deviceMemory || 8;
  if (cores <= 2 || mem <= 2 || PERF.weakGpu.test(gpuName())) return 0;
  const t = mobile || cores <= 4 ? 1 : 2;
  return Math.max(0, t - (lowHint() ? 1 : 0)); // 처음부터 한 칸 낮게 (#271). 배터리는 비동기라 game/fps.js 가 시작 뒤에 내림
}
// 메모리 PERF.start.mem 이하·움직임 줄이기·데이터 절약이면 한 칸 낮게 (#271)
export function lowHint() {
  try {
    const m = navigator.deviceMemory, rm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    return (m != null && m <= PERF.start.mem) || !!rm || !!navigator.connection?.saveData;
  } catch { return false; }
}
const q = typeof location !== 'undefined' ? location.search : '';
const forced = /[?&]tier=([012])/.exec(q)?.[1];
export const PERF_PREF = forced != null ? +forced : /[?&]hi\b/.test(q) ? 2 : (typeof localStorage !== 'undefined' ? storedPref() : 'auto');
export const PERF_AUTO = PERF_PREF === 'auto';
const BASE = PERF_AUTO ? autoTier() : PERF_PREF;
const GL_DROP = forced != null ? 0 : GL_START.drop; /* WebGL 을 잃은 기기는 한 칸씩 낮춤 (#304, glguard.js). 주소 ?tier= 는 그대로 */
export const TIER = Math.max(0, BASE - GL_DROP); // 시작할 때 정한 단계 (LOW 는 여기서 나옴 → 바꾸면 새로고침)
export const GL_PRLOW = BASE - GL_DROP < 0; // 단계 0 아래로 낮춤: 픽셀 배율도 줄임 (scene.js resize)
export const PERF_LOCK = /[?&]perf\b/.test(q); // 재기용: 느려도 자동으로 내리지 않음

// 멀리 있는 작은 물체 감추기: 레이어를 끄면 그리기·그림자에서 빠짐(제 코드가 쓰는 visible 은 건드리지 않음)
export function createFarCull(camera, tier = TIER) {
  const C = PERF.cull, list = []; let t = 0;
  const setOn = (o, on) => o.traverse((c) => { if (c.isLight) return; /* 빛 수가 바뀌면 셰이더를 다시 만드니 빛은 그대로 */ if (on) c.layers.enable(0); else c.layers.disable(0); });
  function add(obj, { r = null, dynamic = false, maxPiece = 40, shadow = true } = {}) { // 반지름 maxPiece 넘는 조각이 있으면(큰 것) 넣지 않음
    if (!obj || list.some((e) => e.obj === obj)) return false;
    let ox = 0, oz = 0, rad = 1;
    obj.updateWorldMatrix(true, true);
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, y0 = 1e9, y1 = -1e9, any = false, big = false;
    obj.traverse((c) => { if (!c.geometry || c.isInstancedMesh) return; const g = c.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); const s = g.boundingSphere; if (!s) return; const p = s.center.clone().applyMatrix4(c.matrixWorld), rr = s.radius * c.matrixWorld.getMaxScaleOnAxis(); if (rr > maxPiece) big = true; x0 = Math.min(x0, p.x - rr); x1 = Math.max(x1, p.x + rr); z0 = Math.min(z0, p.z - rr); z1 = Math.max(z1, p.z + rr); y0 = Math.min(y0, p.y - rr); y1 = Math.max(y1, p.y + rr); any = true; });
    if (any) { ox = (x0 + x1) / 2 - obj.position.x; oz = (z0 + z1) / 2 - obj.position.z; rad = Math.max(x1 - x0, z1 - z0, y1 - y0) / 2; }
    if (big || !any) return false;
    if (dynamic) { ox = oz = 0; }
    const R = (r ?? (C.r + rad * C.perRadius)) * C.mul[tier];
    const casters = []; if (shadow) obj.traverse((c) => { if (c.isMesh && c.castShadow) casters.push(c); });
    list.push({ obj, ox, oz, R, on: true, rad, casters, sh: true, SR: C.shadowR[tier] + rad }); return true;
  }
  function remove(obj) { const i = list.findIndex((e) => e.obj === obj); if (i >= 0) { if (!list[i].on) setOn(obj, true); list.splice(i, 1); } }
  function update(dt, force = false) {
    t -= dt; if (t > 0 && !force) return; t = C.every;
    const cx = camera.position.x, cz = camera.position.z;
    for (const e of list) {
      const p = e.obj.position, d = Math.hypot(p.x + e.ox - cx, p.z + e.oz - cz);
      const on = e.on ? d < e.R + C.hyst : d < e.R;
      if (on !== e.on) { e.on = on; setOn(e.obj, on); } else if (!on) setOn(e.obj, false); // 숨긴 동안 새로 붙은 자식(이름표 등)도 숨김
      const sh = e.sh ? d < e.SR + C.hyst : d < e.SR;
      if (sh !== e.sh && e.casters.length) { e.sh = sh; for (const c of e.casters) c.castShadow = sh; }
    }
  }
  return { add, remove, update, list, hidden: () => list.filter((e) => !e.on).length };
}
