// 레이저 과열 (#200): 저장을 쓰지 않는 순수 함수. game/arms.js·tools/heat.js 가 같이 씀. 값은 balance.js WEAPONS 레이저 heat
// 상태 H = { k 열 0~1, lock 과열로 못 쏘는 남은 초, idle 쏘기를 멈춘 지 초 }
export const heatNew = () => ({ k: 0, lock: 0, idle: 9 });
// 가득 차는 초: 장비 등급 g(0~3) 하나마다 조금 길어짐
export const heatFull = (P, g = 0) => P.full * (1 + P.grade * Math.max(0, g | 0));
// 한 걸음. firing: 이 프레임에 쏘려 함. 돌려주는 값: 'over' 이 걸음에 과열됨, 'ready' 다 식어 다시 쏠 수 있게 됨, null
export function heatStep(H, dt, firing, P, g = 0) {
  if (H.lock > 0) {
    H.lock = Math.max(0, H.lock - dt); H.k = H.lock / P.lock; H.idle = 9;
    return H.lock <= 0 ? 'ready' : null;
  }
  if (firing) {
    H.idle = 0; H.k = Math.min(1, H.k + dt / heatFull(P, g));
    if (H.k >= 1) { H.lock = P.lock; return 'over'; }
    return null;
  }
  H.idle += dt;
  if (H.idle > P.wait) H.k = Math.max(0, H.k - P.cool * Math.min(dt, H.idle - P.wait));
  return null;
}
export const heatCanFire = (H) => H.lock <= 0;
// 지금 열에서 피해 배수 (뜨거울수록 셈)
export const heatMul = (H, P) => (H.lock <= 0 && H.k >= P.hot ? P.hotMul : 1);
