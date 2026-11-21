// 키보드·조이스틱·멀티터치·시점·핀치, 속도 (#86 에서 main.js 를 나눔. 파일 순서는 src/main.js, 규칙은 notes/prototype-v1.md 코드 구조)
import * as THREE from 'three';
import { height } from '../world.js';
import { state, late } from './state.js';
import { $, clamp } from './save.js';
import { canvas, scene, camera, terrain } from './scene.js';
import { player } from './place.js';
import { cam } from './camera.js';
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
    if (dragMoved && cam.mode !== 'photo') { cam.yaw -= dx * 0.006; cam.pitch = clamp(cam.pitch + dy * 0.004, -0.6, 1.25); state.camHold = 1.5; }
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
state.camHold = 0;

// 조이스틱 (터치)
export const joy = { active: false, id: null, x: 0, y: 0, cx: 0, cy: 0 };
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

const ray = new THREE.Raycaster();
export const marker = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.8, 12), new THREE.MeshBasicMaterial({ color: '#fff6c8', transparent: true, opacity: 0.9, depthWrite: false })); late.marker = marker;
marker.rotation.x = -Math.PI / 2; marker.visible = false; scene.add(marker);
function tapGround(x, y) {
  if (busy()) return;
  if (late.pickLock?.(x, y)) return; // 적을 누르면 그 적을 타겟으로 (#148)
  ray.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
  const hit = ray.intersectObject(terrain, false)[0];
  if (!hit) return;
  setTarget(hit.point, null);
}
export function setTarget(p, onArrive) {
  player.target = p.clone(); player.onArrive = onArrive;
  marker.position.set(p.x, height(p.x, p.z) + 0.15, p.z); marker.visible = !onArrive;
}
const CODE2KEY = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', ArrowUp: 'arrowup', ArrowDown: 'arrowdown', ArrowLeft: 'arrowleft', ArrowRight: 'arrowright', Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', Digit5: '5', Digit6: '6', Digit7: '7', Digit8: '8', KeyT: 't', KeyF: 'f', Enter: 'enter', KeyR: 'r', ShiftLeft: 'shift', ShiftRight: 'shift', KeyE: 'e', Space: ' ', Escape: 'escape', KeyQ: 'q' };
const keyOf = (e) => CODE2KEY[e.code] || e.key.toLowerCase();
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const k = keyOf(e);
  keys.add(k);
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { if (k.startsWith('arrow')) e.preventDefault(); }
  if (e.repeat) return;
  if (/^[1-8]$/.test(k)) state.emo.key(+k, !$('actions').hidden); // 동작 (#76): 바퀴가 열려 있으면 그 쪽 1~8, 닫혀 있으면 1~4 고정 칸
  if (k === 'enter') { e.preventDefault(); late.openChat(); }
  if (k === 'r' || k === 'shift') cycleSpeed();
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
