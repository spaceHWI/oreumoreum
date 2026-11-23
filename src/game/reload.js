// 탄창·재장전 (#274): 총 종류(WEAPONS mag·reload 가 있는 무기: 귤 총·머신건·징표 연발 귤총)
// - 탄창을 다 쏘면 저절로 재장전(그동안 못 쏨, 걷기·구르기는 됨). PC 는 R, 폰은 던지기 버튼 구석 단추로 손 재장전(탄창이 가득이 아닐 때)
// - 무기를 바꾸면 재장전은 끊기고 그 무기의 탄창은 그대로 남음(무기마다 따로, 저장하지 않음: 다시 들어오면 가득)
// - 화면: 던지기 버튼 둘레 고리(#heat 과 같은 문법, 레이저가 아닐 때만), 위 탄 표시는 arms.js armsAmmo 가 이 탄창을 보여 줌. 다 채우면 딸깍
// 셈은 src/reload.js, 수치 balance.js WEAPONS·RELOAD. arms.js 가 쏘기 전에 reloadCan, 쏜 뒤 reloadUse, 매 프레임 tickReload 를 부름
import { $, save } from './save.js';
import { state, late } from './state.js';
import { player } from './place.js';
import { weaponNow, bowReady } from './throw.js';
import { augV } from '../augments.js';
import { hasMag, magNew, canFire, magStep, magReload, magUse, magCancel, magK } from '../reload.js';

const MAGS = new Map(); // 무기 열쇠 → 탄창 상태
const keyOf = (w) => (w.tok ? `tok:${w.tok}` : w.id);
const q = () => augV(save, 'quick'); // 빠른 손 (#159): 모아 쏘기·재장전 시간
export function magOf(w) {
  if (!hasMag(w)) return null;
  const k = keyOf(w); let M = MAGS.get(k);
  if (!M) { M = magNew(w); MAGS.set(k, M); }
  if (M.n > w.mag) M.n = w.mag; /* 단계가 바뀌어 탄창이 작아졌으면 */
  return M;
}
// 쏠 수 있나 (탄창 없는 무기는 늘 true)
export const reloadCan = (w = weaponNow()) => { const M = magOf(w); return !M || canFire(M); };
export const reloading = (w = weaponNow()) => { const M = magOf(w); return !!M && M.t > 0; };
// 한 발 씀 (탄창 없는 무기는 아무것도 안 함)
export function reloadUse(w = weaponNow()) {
  const M = magOf(w); if (!M) return;
  if (magUse(M, w, q()) === 'empty') begin();
}
// 손 재장전 (R·폰 단추). 했으면 true
export function reloadNow(manual = true) {
  const w = weaponNow(), M = magOf(w);
  if (!M || !bowReady() || !magReload(M, w, q())) return false;
  begin(); if (manual) late.chargeCancel?.(); return true;
}
function begin() {
  late.sound?.reloadOut?.();
  if (player.pose === 'move' || player.pose === 'aim') { if (player.pose !== 'aim') { player.pose = 'aim'; player.poseT = 0; } } /* 손 모션: 겨눈 자세에서 총을 내려 탄창을 갈아 끼움 (arms.js 가 재장전 동안 자세를 붙들어 둠) */
}
let lastK = '', ringKey = '';
const ring = $('reload'), btn = $('btn-reload');
// 매 프레임 (arms.js tickArms). 시간은 초 기준이라 프레임 상한(#271)과 상관없음
export function tickReload(dt) {
  const w = weaponNow(), M = magOf(w), k = M ? keyOf(w) : '';
  if (k !== lastK) { const P = MAGS.get(lastK); if (P) magCancel(P); lastK = k; } /* 무기를 바꾸면 재장전은 끊김 (탄창은 그대로) */
  state.reloadK = 0;
  if (M) {
    if (!bowReady()) { if (M.t > 0) magCancel(M); }
    else {
      if (magStep(M, dt, w) === 'done') late.sound?.reloadIn?.();
      if (M.n <= 0 && M.t <= 0) { magReload(M, w, q()); begin(); } /* 빈 탄창으로 들었으면 바로 */
      if (M.t > 0) state.reloadK = magK(M) || 0.001;
    }
  }
  paint(w, M);
}
function paint(w, M) {
  const on = !!M && bowReady(), rl = on && M.t > 0, k = rl ? Math.round(magK(M) * 40) / 40 : 0;
  const key = `${on}|${rl}|${k}|${on && M.n < w.mag}`;
  if (key === ringKey) return; ringKey = key;
  if (ring) { ring.hidden = !rl; if (rl) ring.style.setProperty('--k', String(k)); }
  if (btn) { const show = on && (rl || M.n < w.mag); if (btn.hidden === show) btn.hidden = !show; btn.classList.toggle('on', rl); }
}
btn?.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); reloadNow(true); });
btn?.addEventListener('click', (e) => e.stopPropagation());
// 들고 있는 무기의 탄창 (화면 탄 표시·tools)
export const magNow = () => { const w = weaponNow(), M = magOf(w); return M && { n: M.n, mag: w.mag, t: +M.t.toFixed(3), T: M.T, k: magK(M), key: keyOf(w) }; };
const magHeld = () => bowReady() && !!magOf(weaponNow());
Object.assign(late, { magHeld, reloadNow, reloadCan, reloading, magNow, reloadReset: () => MAGS.clear() });
