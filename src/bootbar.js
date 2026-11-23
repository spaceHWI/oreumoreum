// 로딩 창 (#281) 게임 쪽 손잡이: page.html 의 인라인 스크립트(src/bootscreen.js)가 만든 window.__boot 을 부른다. 없으면(옛 페이지·검사용 틀) 아무것도 안 함
const B = () => (typeof window !== 'undefined' ? window.__boot : null);
const call = (k, ...a) => { try { B()?.[k]?.(...a); } catch (e) { /* 로딩 창은 없어도 게임은 돈다 */ } };
export const bootP = (v, cap) => call('p', v, cap); // 단계 floor, 기다리는 동안 다가갈 끝
export const bootReady = () => call('ready'); // 첫 그림이 온전히 그려짐 → 0.4초에 걸쳐 걷힘
export const bootFail = () => call('fail'); // 받기 실패 → 다시 시도 단추
export const bootShow = (text) => call('show', text); // 다시 받기 직전(새 버전·로그인·로그아웃) 같은 창을 다시 덮음
export const bootDone = () => { const b = B(); return !b || !!b.state?.().done; };
