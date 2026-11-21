// 전체 화면·화면 방향 (#105)
// - 터치 기기면 위쪽 줄(#75) 오른쪽에 전체 화면 버튼, 메뉴 설정에도 같은 항목. Fullscreen API 로 들어가고 나옴
// - 페이지 전체 화면이 안 되는 곳(iPhone Safari)은 버튼 대신 "홈 화면에 추가" 안내 창 (#189 game/simple.js, manifest display: standalone, build.mjs)
// - 홈 화면 앱(standalone)·원스토어 앱 안(#97)은 이미 전체 화면이라 숨김
// - 돌리면 다시 불러오지 않고 바로 맞춤: 렌더러 크기·화각(scene.js resize, balance.js SCREEN)·위쪽 줄 줄이기(topFit)
import { onestore } from '../onestore.js';
import { $, isTouch } from './save.js';
import { late } from './state.js';
import { resize } from './scene.js';
import { toast, topFit } from './hud.js';

const D = document, root = D.documentElement;
const can = !!(D.fullscreenEnabled || D.webkitFullscreenEnabled) && !!(root.requestFullscreen || root.webkitRequestFullscreen);
const fsEl = () => D.fullscreenElement || D.webkitFullscreenElement || null;
// 홈 화면 앱: standalone, 또는 (페이지 전체 화면이 아닌데) display-mode fullscreen. 페이지 전체 화면 중에도 fullscreen 이 맞으므로 구분
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true || (matchMedia('(display-mode: fullscreen)').matches && !fsEl());
export const HOME_HINT = '홈 화면에 추가하면 전체 화면으로 할 수 있어요';

function enter() {
  const r = root.requestFullscreen ? root.requestFullscreen({ navigationUI: 'hide' }) : root.webkitRequestFullscreen();
  return Promise.resolve(r).catch(() => toast('전체 화면을 열 수 없어요'));
}
function exit() { const r = D.exitFullscreen ? D.exitFullscreen() : D.webkitExitFullscreen?.(); return Promise.resolve(r).catch(() => {}); }
export function toggleFullscreen() {
  if (!can) { if (!late.fsTip?.open('ios')) toast(HOME_HINT, 4); return; } // 안 되는 곳: 홈 화면에 추가 안내 창 (#189, game/simple.js)
  return fsEl() ? exit() : enter();
}

const chip = $('fs-chip'), item = $('menu-fs');
// 보일지: 터치 기기 + 원스토어 앱·홈 화면 앱이 아님. 버튼은 전체 화면이 되는 곳만, 메뉴 항목은 안 되는 곳에선 안내를 띄움
function refresh() {
  const show = isTouch && !onestore.on && !standalone();
  const on = !!fsEl();
  chip.hidden = !(show && can); item.hidden = !show;
  chip.setAttribute('aria-pressed', String(on)); item.setAttribute('aria-pressed', String(on));
  chip.title = on ? '전체 화면 끝내기' : '전체 화면'; chip.setAttribute('aria-label', chip.title);
  item.textContent = can ? (on ? '전체 화면 끝내기' : '전체 화면') : '전체 화면 (홈 화면에 추가)';
  topFit.dirty();
}
chip.addEventListener('click', toggleFullscreen);
item.addEventListener('click', () => { toggleFullscreen(); });
for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) D.addEventListener(ev, () => { refresh(); resize(); });
matchMedia('(display-mode: standalone)').addEventListener?.('change', refresh);
refresh(); // 원스토어 SDK 가 늦게 알려 와도 page.html 의 .onestore 로 숨김

// 안 되는 곳(아이폰)의 안내는 튜토리얼 뒤 한 번 (#189, game/simple.js 전체 화면 안내 창). 예전 save.fsHint 토스트는 뺌

// 돌리기: 다시 불러오지 않고 바로 맞춤. iOS 는 돌린 직후 innerHeight 가 늦게 바뀌어 한 번 더
function relayout() { resize(); topFit.dirty(); }
addEventListener('orientationchange', () => { relayout(); setTimeout(relayout, 250); });
window.visualViewport?.addEventListener('resize', () => topFit.dirty());

export const screenInfo = () => ({ can, on: !!fsEl(), standalone: standalone(), chip: !chip.hidden, item: !item.hidden });
