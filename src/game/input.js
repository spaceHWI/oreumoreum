// 키보드·조이스틱·멀티터치·시점·핀치, 속도 (#86 에서 main.js 를 나눔. 파일 순서는 src/main.js, 규칙은 notes/prototype-v1.md 코드 구조)
import * as THREE from 'three';
import { height } from '../world.js';
import { drape } from '../drape.js';
import { state, late } from './state.js';
import { $, clamp, save, persist, isTouch } from './save.js';
import { canvas, scene, camera, terrain } from './scene.js';
import { player } from './place.js';
import { cam, camPitchMax, camPitchMin } from './camera.js';
import { STICK } from '../balance.js';
import { IN_FRAME } from '../mview.js';
import { optSeg } from './optui.js';
import { busy, cancelAll } from './hud.js';

// ---------- 입력 ----------
export const keys = new Set();
export const ptrs = new Map();
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
    if (dragMoved && cam.mode !== 'photo') { cam.yaw -= dx * 0.006; cam.pitch = clamp(cam.pitch + dy * 0.004, camPitchMin(), camPitchMax()); state.camHold = 1.5; } // 탈 때만 위아래 끝이 조금 더 (#170 #213)
  } else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchD > 0) userZoom(cam.dist * (pinchD / d));
    pinchD = d;
  }
});
const endPtr = (e) => {
  const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId);
  if (p && !dragMoved && ptrs.size === 0 && e.type === 'pointerup' && !joy.active) tapGround(e.clientX, e.clientY); // 조이스틱을 잡은 채 화면을 톡 친 건 목적지 아님
};
canvas.addEventListener('pointerup', endPtr);
canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); userZoom(cam.dist * (1 + Math.sign(e.deltaY) * 0.1)); }, { passive: false });
state.camHold = 0;

// 조이스틱 (터치). 떠다님(#211, 기본): 왼쪽 아래 구역 어디든 누른 자리에 바탕이 생기고, 반지름 밖으로 끌면 바탕이 따라옴. 고정: 예전처럼 제자리 스틱
// 이동은 처음 구역에 닿은 손가락(joy.id) 하나에만 묶음. 떼기 전까지는 구역 밖으로 나가도 이동. 버튼 위에서 시작한 터치는 버튼이 받으므로 이동이 안 됨
export const joy = { active: false, id: null, x: 0, y: 0, cx: 0, cy: 0, float: false, on: false, mag: 0 };
/* #313: on = 걷기 켬(dead 를 넘으면 켜고 deadOff 아래로 내려가야 끔), mag = 속도 비율 0~1 (곡선). 손가락이 경계에서 떨려도 섰다 걸었다 하지 않음 */
export function joyShape(m) {
  joy.on = joy.active && (joy.on ? m > STICK.deadOff : m > STICK.dead);
  const t = clamp((m - STICK.deadOff) / (STICK.full - STICK.deadOff), 0, 1);
  joy.mag = joy.on ? STICK.minK + (1 - STICK.minK) * Math.pow(t, STICK.curve) : 0;
}
export const stickFloat = () => isTouch && save.stick !== 'fixed';
{
  const el = $('joy'), knob = $('joy-knob');
  let R = 46, t0 = 0, sx = 0, sy = 0, far = false, from = null;
  const probe = document.createElement('i'); probe.style.cssText = 'position:fixed;left:0;bottom:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-left:var(--safe-l);padding-bottom:var(--safe-b)'; document.body.append(probe);
  const inZone = (x, y) => {
    const cs = getComputedStyle(probe), sl = parseFloat(cs.paddingLeft) || 0, sb = parseFloat(cs.paddingBottom) || 0;
    return x >= sl + STICK.edge && x <= innerWidth * STICK.zoneW && y >= innerHeight * (1 - STICK.zoneH) && y <= innerHeight - sb;
  };
  const setKnob = () => { const k = joy.float ? Math.min(R, el.offsetWidth * 0.4) : R; knob.style.transform = `translate(${joy.x * k}px, ${joy.y * k}px)`; };
  const place = () => { if (joy.float) { el.style.left = joy.cx + 'px'; el.style.top = joy.cy + 'px'; } };
  const guide = () => {
    const f = stickFloat(); document.body.classList.toggle('stick-float', f);
    el.classList.toggle('faint', f && (save.joyN || 0) >= STICK.faintAfter);
  };
  const start = (e, src) => {
    joy.float = stickFloat(); joy.active = true; joy.id = e.pointerId; t0 = performance.now(); sx = e.clientX; sy = e.clientY; far = false; from = src;
    if (joy.float) { R = clamp(Math.min(innerWidth, innerHeight) * STICK.rK, STICK.rMin, STICK.rMax); joy.cx = e.clientX; joy.cy = e.clientY; el.classList.add('float', 'on'); place(); }
    else { R = 46; const r = el.getBoundingClientRect(); joy.cx = r.left + r.width / 2; joy.cy = r.top + r.height / 2; el.classList.add('on'); }
    move(e); closePanelsSoft();
  };
  const move = (e) => {
    if (!joy.active || e.pointerId !== joy.id) return;
    if (Math.hypot(e.clientX - sx, e.clientY - sy) > STICK.tapPx) far = true;
    let dx = (e.clientX - joy.cx) / R, dy = (e.clientY - joy.cy) / R; const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; if (joy.float) { joy.cx = e.clientX - dx * R; joy.cy = e.clientY - dy * R; place(); } } /* 끌려오는 바탕 */
    joy.x = dx; joy.y = dy; joyShape(Math.min(1, m)); setKnob();
  };
  const end = (e) => {
    if (!joy.active || e.pointerId !== joy.id) return;
    const tap = joy.float && from === 'view' && !far && performance.now() - t0 < STICK.tapT * 1000 && e.type === 'pointerup';
    if (joy.float && far) { save.joyN = Math.min(99, (save.joyN || 0) + 1); if (save.joyN === STICK.faintAfter) persist(); }
    joy.active = false; joy.id = null; joy.x = joy.y = 0; joy.float = false; joyShape(0); setKnob();
    el.classList.remove('float', 'on'); el.style.left = el.style.top = ''; guide();
    if (tap) tapGround(e.clientX, e.clientY); /* 구역 안을 톡 친 건 예전처럼 그 땅으로 걸어가기 */
  };
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); if (joy.active) return; el.setPointerCapture(e.pointerId); start(e, 'joy'); });
  addEventListener('pointerdown', (e) => {
    if (e.target !== canvas || joy.active || (e.pointerType === 'mouse' && !IN_FRAME) || !stickFloat() || !inZone(e.clientX, e.clientY)) return;
    e.stopImmediatePropagation(); canvas.setPointerCapture(e.pointerId); if (document.activeElement && document.activeElement !== document.body && document.activeElement !== canvas) document.activeElement.blur(); start(e, 'view');
  }, true);
  addEventListener('pointermove', move, true);
  for (const ev of ['pointerup', 'pointercancel']) addEventListener(ev, end, true);
  el.addEventListener('lostpointercapture', end); canvas.addEventListener('lostpointercapture', end);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('blur', () => { if (joy.active) end({ pointerId: joy.id, type: 'pointercancel' }); });
  guide();
  // 설정 '이동 스틱: 떠다님 / 고정' (조작 묶음, #201 칸 묶음)
  const seg = $('menu-stick');
  const drawSeg = () => { if (!seg) return; seg.hidden = !isTouch; optSeg(seg, [['float', '떠다님'], ['fixed', '고정']], save.stick === 'fixed' ? 'fixed' : 'float', (v) => { save.stick = v === 'fixed' ? 'fixed' : undefined; persist(); drawSeg(); guide(); }); };
  drawSeg();
  late.stickApi = { STICK, guide, drawSeg, joyShape };
}

// 멀티터치 (#42): 화면의 손가락은 pointerId 로 따로 추적한다 — 조이스틱(joy.id), 시점·핀치(ptrs: 캔버스에 닿은 손가락만), 버튼(각 버튼이 자기 손가락만 캡처).
// 패드 버튼은 손가락이 닿는 순간(pointerdown) 반응. click 은 한 손가락 탭에서만 생겨서(iOS 사파리 등) 조이스틱을 잡은 채로는 버튼이 안 눌렸음
export function pressBtn(el, fn) {
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

// 손으로 한 확대·축소 (#151): cam.zoomed 는 사람이 바꾼 배율의 누적 (첫 화면 카메라 연출 등 저절로 바뀐 것은 안 셈, 튜토리얼 확대 단계가 봄)
cam.zoomed = 1;
function userZoom(d) { const n = clamp(d, 4, 40); if (cam.dist > 0) cam.zoomed *= n / cam.dist; cam.dist = n; }
const ray = new THREE.Raycaster();
export const marker = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.8, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fff6c8', transparent: true, opacity: 0.9, depthWrite: false })); late.marker = marker;
marker.visible = false; marker.renderOrder = 3; scene.add(marker);
const placeMarker = drape(marker, height); // 비탈에서도 고리가 땅에 묻히지 않게 (#151)
function tapGround(x, y) {
  if (busy()) return;
  if (late.pickLock?.(x, y)) return; // 적을 누르면 그 적을 타겟으로 (#148)
  ray.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
  const hit = state.cave ? late.caveRay?.(ray) : ray.intersectObject(terrain, false)[0]; /* 동굴 (#195): 동굴 바닥 */
  if (!hit) return;
  setTarget(hit.point, null);
}
export function setTarget(p, onArrive) {
  player.target = p.clone(); player.onArrive = onArrive;
  placeMarker(p.x, p.z, 1, 0, 0.06); marker.visible = !onArrive;
}
const CODE2KEY = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', ArrowUp: 'arrowup', ArrowDown: 'arrowdown', ArrowLeft: 'arrowleft', ArrowRight: 'arrowright', Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', Digit5: '5', Digit6: '6', Digit7: '7', Digit8: '8', KeyT: 't', KeyG: 'g', KeyF: 'f', Enter: 'enter', KeyR: 'r', ShiftLeft: 'shift', ShiftRight: 'shift', KeyE: 'e', Space: ' ', Escape: 'escape', KeyQ: 'q' };
const keyOf = (e) => CODE2KEY[e.code] || e.key.toLowerCase();
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const k = keyOf(e);
  keys.add(k);
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { if (k.startsWith('arrow')) e.preventDefault(); }
  if (e.repeat) return;
  if (/^[1-8]$/.test(k)) state.emo.key(+k); // 동작 (#242): 1~8 = 부채꼴 8칸 (열려 있든 닫혀 있든)
  if (k === 'g') $('btn-actions').click(); // G: 동작 부채꼴 열고 닫기 (임의, #242)
  if (k === 'enter') { e.preventDefault(); late.openChat(); }
  if (k === 'r' && late.magHeld?.()) late.reloadNow(true); /* 총을 들었으면 R 은 재장전 (#274, 달리기는 Shift) */
  else if (k === 'r' || k === 'shift') cycleSpeed();
  if (k === 'f') late.doInteract(); // 상호작용 (#34). 줍기(E)는 tickPick 이 누르고 있는 동안 처리
  if (k === 'e') late.pressPick(); // 범위 밖이면 가까운 쓰레기로 걸어감 (#104)
  if (k === 'q') late.toggleRide(); // 탈것 (#69)
  if (k === ' ') { e.preventDefault(); late.doJump(); }
  if (k === 'escape') cancelAll();
  if (k === 'tab' && !e.altKey && !e.ctrlKey && !e.metaKey && (document.activeElement === canvas || document.activeElement === document.body) && late.cycleLock?.()) e.preventDefault(); // 다음 타겟 (#148)
});
addEventListener('keyup', (e) => { keys.delete(keyOf(e)); keys.delete(e.key.toLowerCase()); });
addEventListener('blur', () => keys.clear());

// ---------- 속도·체력 ----------
const GAIT = ['걷기', '달리기'];
export function setGait(g) {
  player.gait = g; player.running = g >= 1;
  $('btn-speed').dataset.g = String(g); $('speed-label').textContent = GAIT[g];
}
function cycleSpeed() { late.tut.notify('gait'); setGait((player.gait + 1) % 2); }
pressBtn($('btn-speed'), cycleSpeed);
