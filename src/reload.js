// 탄창·재장전 (#274): 저장을 쓰지 않는 순수 함수. game/reload.js·game/arms.js·tools 가 같이 씀. 값은 balance.js WEAPONS mag·reload, RELOAD
// 탄창 상태 M = { n 탄창에 남은 발, t 재장전 남은 초(0 이면 재장전 아님), T 이번 재장전 전체 초 }
import { RELOAD } from './balance.js';

export const hasMag = (w) => !!(w && w.mag > 0 && w.reload > 0);
export const magNew = (w) => ({ n: w.mag, t: 0, T: 0 });
// 다음 발까지 간격(초): 머신건류는 1 / rate, 총은 cd
export const gapOf = (w) => (w.rate ? 1 / w.rate : w.cd || 0.5);
// 재장전 초: 증강 '빠른 손' 겹친 값 q 만큼 짧게 (min 배까지)
export const reloadSec = (w, q = 0) => w.reload * Math.max(RELOAD.min, 1 - RELOAD.quick * Math.max(0, q || 0));
// 계속 쏠 때 시간당 피해 몫: 탄창을 다 쏘는 시간 / (그 시간 + 재장전). 마지막 발 뒤 간격 대신 재장전
export function magDuty(w, q = 0) {
  if (!hasMag(w)) return 1;
  const g = gapOf(w), n = w.mag;
  return (n * g) / ((n - 1) * g + reloadSec(w, q));
}
// 한 발 피해 배수: 계속 쏠 때 시간당 피해가 탄창 넣기 전의 keep 몫이 되게 (1 아래로는 안 내림). 증강은 빼고 셈(증강은 덤)
export const magMul = (w) => (hasMag(w) ? Math.max(1, RELOAD.keep / magDuty(w)) : 1);
export const canFire = (M) => M.t <= 0 && M.n > 0;
// 한 걸음: 돌려주는 값 'done' 이 걸음에 다 채움, null
export function magStep(M, dt, w) {
  if (M.t <= 0) return null;
  M.t = Math.max(0, M.t - dt);
  if (M.t > 0) return null;
  M.n = w.mag; M.T = 0; return 'done';
}
// 재장전 시작. 이미 하는 중이거나 가득이면 false
export function magReload(M, w, q = 0) {
  if (M.t > 0 || M.n >= w.mag) return false;
  M.T = M.t = reloadSec(w, q); return true;
}
// 한 발 씀. 다 쓰면 저절로 재장전 시작 → 'empty'
export function magUse(M, w, q = 0) {
  M.n = Math.max(0, M.n - 1);
  if (M.n > 0) return null;
  magReload(M, w, q); return 'empty';
}
export const magCancel = (M) => { M.t = 0; M.T = 0; };
// 재장전이 얼마나 됐나 0~1 (화면 고리)
export const magK = (M) => (M.t > 0 && M.T > 0 ? 1 - M.t / M.T : 0);
// 카드 한 줄: '탄창 8 · 재장전 1.2초'
export const magLine = (w) => (hasMag(w) ? `탄창 ${w.mag} · 재장전 ${+w.reload.toFixed(1)}초` : '');
