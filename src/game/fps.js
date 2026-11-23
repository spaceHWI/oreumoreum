// 폰 발열 줄이기 (#271): 프레임 상한·쉴 때 낮게·그림자 지도 띄엄띄엄·발열 지킴(미리 내리기)·처음부터 낮게·?heat=1 재기 창
// - update.js frame 이 rAF 마다 due(now) 를 물어 그릴 차례가 아니면 건너뜀. 게임 셈(dt)은 실제 흐른 시간 (maxDt 까지)이라 빠르기·판정이 그대로
//   입력은 이벤트로 쌓이니(keys·조이스틱) 건너뛴 rAF 동안 들어온 입력도 다음 그리는 프레임에 그대로 읽힘
// - 상한: 설정 save.fps ('eco' 30 · 'smooth' 60, 고른 적 없으면 폰 eco·PC smooth) → 싸움이면 PERF.fps.fight → 창이 덮으면 cover(15) → 6초 입력 없으면 idle(20)
//   튜토리얼·장면(state.cine, 사건 대면·엔딩)·사진 찍기·카메라가 따라가기가 아닐 때·움직이는 중에는 쉬는 상태로 치지 않음
// - 발열 지킴: 자동 단계일 때만 quality.heat 0~3 (scene.js applyQuality 가 픽셀 배율·그림자·풀 밀도에 씀)
import { PERF } from '../balance.js';
import { PERF_AUTO, PERF_LOCK } from '../quality.js';
import { isMobile } from '../mview.js';
import { state, late } from './state.js';
import { save, persist, $ } from './save.js';
import { renderer, quality, applyQuality } from './scene.js';
import { player } from './place.js';
import { cam } from './camera.js';
import { panelOpen } from './hud.js';
import { threatNear } from './hooks.js';
import { pace } from './pace.js';
import { autoGo } from './dump.js';
import { optSeg } from './optui.js';

const F = PERF.fps, H = PERF.heat, PHONE = isMobile();
const Q = typeof location !== 'undefined' ? location.search : '';
const HEATLOG = /[?&]heat=1\b/.test(Q);

// ---------- 입력 (쉬는지 보기) ----------
let lastIn = performance.now();
const downs = new Set();
const poke = () => { lastIn = performance.now(); };
for (const ev of ['keydown', 'pointermove', 'wheel', 'touchmove']) addEventListener(ev, poke, { capture: true, passive: true });
addEventListener('pointerdown', (e) => { poke(); downs.add('p' + e.pointerId); }, { capture: true, passive: true });
for (const ev of ['pointerup', 'pointercancel']) addEventListener(ev, (e) => { poke(); downs.delete('p' + e.pointerId); }, { capture: true, passive: true });
addEventListener('keydown', (e) => { downs.add('k' + e.code); }, { capture: true, passive: true });
addEventListener('keyup', (e) => { poke(); downs.delete('k' + e.code); }, { capture: true, passive: true });
addEventListener('blur', () => downs.clear());

// ---------- 지금 상한 ----------
export const fpsPref = () => (save.fps === 'eco' || save.fps === 'smooth' ? save.fps : PHONE ? 'eco' : 'smooth');
const fight = () => !!(late.swarmArena?.zone?.() || late.bossFight?.() || threatNear() || pace.threat?.());
const busyScene = () => !!(late.tut?.active || state.cine || state.photoState || (cam.mode !== 'follow' && cam.mode !== 'wardrobe') || state.cave);
let mode = 'play'; // play · fight · cover · idle (재기 창·확인용)
function capNow(now) {
  const base = F[fpsPref()];
  if (!state.sessionOn) { mode = 'play'; return base; }
  if (fight()) { mode = 'fight'; return Math.max(base, F.fight); }
  if (busyScene()) { mode = 'play'; return base; }
  if (panelOpen() || cam.mode === 'wardrobe') { mode = 'cover'; return Math.min(base, F.cover); }
  const moving = (player.speed || 0) > F.still || !!player.cart || !!autoGo || !!player.target;
  if (!moving && !downs.size && now - lastIn > F.idleT * 1000) { mode = 'idle'; return Math.min(base, F.idle); }
  mode = 'play'; return base;
}

// ---------- 그릴 차례 ----------
let cap = F[fpsPref()], lastDraw = -1e9, capT = 0, drawW = 0, drawH = 0, forced = 0, skipped = 0;
export function due(now) {
  const cv = renderer.domElement;
  if (cv.width !== drawW || cv.height !== drawH) { drawW = cv.width; drawH = cv.height; lastDraw = now; forced++; return true; } /* #280: 크기·배율을 바꾸면(resize·발열 지킴·배터리) 캔버스가 비워지니 이 rAF 는 꼭 그림. 건너뛰면 빈 캔버스가 한 프레임 보여 깜박임 */
  if (!dueCap(now)) { skipped++; return false; }
  return true;
}
function dueCap(now) {
  if ((capT -= 1) <= 0) { capT = 6; cap = capNow(now); } // 상한 판단은 rAF 6번에 한 번이면 충분 (입력이 오면 아래에서 바로)
  if (mode === 'idle' && now - lastIn < 200) cap = capNow(now);
  const iv = 1000 / cap; if (now < lastDraw) lastDraw = -1e9; /* 시계가 뒤로 감(재기 도구의 가짜 시계 등) */
  const gap = now - lastDraw;
  if (gap < iv - F.tol) return false;
  lastDraw = gap < iv * 2 ? lastDraw + iv : now; // 상한 간격에 맞춰 이어 감 (120Hz 에서도 상한 넘게 그리지 않음)
  if (lastDraw > now) lastDraw = now;
  return true;
}
export const interval = () => 1 / cap; // 초
export const maxDt = () => Math.max(0.05, 1.3 / cap); // 게임 셈 한 번의 dt 상한 (15fps 에서도 느려지지 않게)

// ---------- 그림자 지도: 폰은 띄엄띄엄 (해는 천천히 움직이니) ----------
renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
let shN = 0;
function shadowTick() {
  const S = PERF.shadowUp, sp = player.speed || 0, cine = !!state.cine || cam.mode !== 'follow';
  let every = PHONE ? S.phone : S.pc;
  if (sp > S.fast || player.cart || cine) every = 1; else if (sp < F.still && every > 1) every = S.still;
  if (++shN >= every) { shN = 0; renderer.shadowMap.needsUpdate = true; }
}
export const shadowNow = () => { renderer.shadowMap.needsUpdate = true; shN = 0; };

// ---------- 발열 지킴 ----------
const heat = { playT: 0, restT: 0, wins: [], cur: { ms: 0, calls: 0, n: 0, t: 0 }, lastWall: Date.now(), log: [] };
const heatOn = () => quality.auto && !PERF_LOCK && PERF_AUTO;
function heatSet(k, why) {
  k = Math.max(0, Math.min(H.max, k)); if (k === quality.heat) return;
  quality.heat = k; heat.log.push({ t: Math.round(heat.playT), k, why }); applyQuality(); shadowNow();
}
function heatTick(dt, workMs) {
  const wall = Date.now(), gap = (wall - heat.lastWall) / 1000; heat.lastWall = wall;
  const resting = !state.sessionOn || state.idleRest || state.osPaused || mode === 'idle';
  if (gap > 2 || resting) { heat.restT += gap > 2 ? gap : dt; if (heat.restT >= H.rest) { heat.playT = 0; heat.tStep = 0; heat.wins.length = 0; if (quality.heat) heatSet(0, '쉼'); } return; }
  heat.restT = 0; heat.playT += dt;
  if (!heatOn()) return;
  const step = H.at.filter((s) => heat.playT >= s).length;
  if (step > (heat.tStep || 0)) { heat.tStep = step; heatSet(quality.heat + 1, '시간'); return; }
  const c = heat.cur; c.ms += workMs; c.calls += renderer.info.render.calls; c.n++; c.t += dt;
  if (c.t < H.win) return;
  heat.wins.push({ ms: c.ms / c.n, calls: c.calls / c.n }); heat.cur = { ms: 0, calls: 0, n: 0, t: 0 };
  const back = Math.round(H.trendGap / H.win), W = heat.wins;
  if (W.length > back + 4) W.shift();
  if (W.length <= back) return;
  const a = W[W.length - 1 - back], b = W[W.length - 1];
  if (Math.abs(b.calls - a.calls) > a.calls * H.callsSame) return; // 다른 곳(그리는 양이 다름)이면 견주지 않음
  if (b.ms > a.ms * (1 + H.trendUp) && b.ms - a.ms > H.trendMin) { heatSet(quality.heat + 1, '느려짐'); W.length = 0; }
}

// ---------- 처음부터 낮게: 배터리 (비동기라 단계를 시작한 뒤에 한 칸 내림) ----------
if (PERF_AUTO && !PERF_LOCK && typeof navigator !== 'undefined' && navigator.getBattery) {
  navigator.getBattery().then((b) => {
    if (b.charging || b.level >= PERF.start.battery || quality.level <= 0) return;
    quality.level--; quality.lowStart = 'battery'; applyQuality();
  }).catch(() => {});
}

// ---------- 매 그리는 프레임 (update.js step 안, 그리기 앞) ----------
let workMs = 0, drawn = 0;
export function tick(dt) { shadowTick(); heatTick(dt, workMs); drawn++; }
export function after(ms) { workMs = ms; late.heatLog?.(ms); } // frame 이 step 에 쓴 시간 (그리기 내보내기 포함)

// ---------- 설정 '화면 부드럽게' ----------
const NAME = { eco: `절약(${F.eco})`, smooth: `부드럽게(${F.smooth})` };
function fpsSeg() { const el = $('menu-fps'); if (el) optSeg(el, ['eco', 'smooth'].map((k) => [k, NAME[k]]), fpsPref(), pickFps); }
function pickFps(v) { if (fpsPref() === v && save.fps === v) return; save.fps = v; persist(); fpsSeg(); capT = 0; }
fpsSeg();

late.fps = {
  state: () => ({ cap, mode, pref: fpsPref(), idle: (performance.now() - lastIn) / 1000, downs: downs.size, heat: quality.heat, level: quality.level, lowStart: quality.lowStart || '', playT: Math.round(heat.playT), restT: Math.round(heat.restT), log: [...heat.log], drawn, skipped, forced, shadowAuto: renderer.shadowMap.autoUpdate }),
  set: (o) => Object.assign(F, o), heat: (k) => heatSet(k, '확인'), play: (s) => { heat.playT = s; }, pick: pickFps, poke,
};
if (HEATLOG) import('./heatlog.js').catch(() => {});
