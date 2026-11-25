// 화면 단순하게 (#189) · 전체 화면 안내. 파일 순서는 rec 뒤 (src/modules.js)
// - body.simple (save.simple, 없으면 터치 기기 켬·PC 끔. 메뉴 '화면 단순하게'): 늘 보이는 것은 조이스틱·줍기·던지기·상황 버튼 하나(탈것이 있으면 탈것, 아니면 점프)·귤+HP·메뉴
//   나머지는 CSS(page.html '화면 단순하게')로 숨기고, 필요할 때만 .flash(2초)·.half(배낭 60% 넘음) 로 꺼냄. 튜토리얼(body.tut) 동안은 그대로
//   레벨은 늘 보임(#251, 장비 점수 칸은 없앰), 구역 이름은 바뀔 때 2초, 미니맵은 접힌 점(누르면 펼침, 한 번 더 누르면 큰 지도), 퀘스트 줄은 3초 뒤 화살표만(누르면 펼침)
//   싸우는 중(body.fight): 퀘스트 줄·미니맵 숨김. 창이 열리면(body.win): 패드·조이스틱·퀘스트 줄·미니맵 숨김. 들판 떼 줄과 퀘스트 줄은 번갈아(body.qalt)
//   달리기 버튼 대신 조이스틱을 끝까지 밀면 달림. 무기 바꾸기(▾ 없음)는 던지기 버튼을 위로 밀기. 탈것 바꾸기는 탈것 버튼 길게 (예전 그대로)
// - 전체 화면 안내 (#fs-tip): 안드로이드 등 Fullscreen API 가 되는 곳은 '전체 화면으로 하기' 버튼, 아이폰 사파리는 '홈 화면에 추가' 3단계 그림,
//   아이폰 크롬·인앱은 사파리로 열라는 안내. 홈 화면 앱·전체 화면 중·원스토어 앱·PC 는 안 띄움.
//   튜토리얼 뒤 한 번(감독 문 fsTip), 메뉴 '전체 화면으로 하는 법' 에서 언제든, '다시 보지 않기'. 첫 화면 시작 버튼 아래 큰 버튼(api 일 때 처음 한 번)
// 저장 save.simple 0/1(없으면 기기 기본), save.fsTip = { off 다시 보지 않기, intro 첫 화면 버튼을 봄 }
// dev: __oreum.simple.state()·set(on)  __oreum.fsTip.kind()·offer()·open()·reset()
import { onestore } from '../onestore.js';
import { state, late } from './state.js';
import { $, save, persist, isTouch } from './save.js';
import { player, life } from './place.js';
import { cam } from './camera.js';
import { panelOpen, topFit } from './hud.js';
import { joy, setGait } from './input.js';
import { STICK } from '../balance.js';
import { toggleFullscreen, screenInfo } from './screen.js';
import { director } from './director.js';

const B = document.body;
const onNow = () => (save.simple == null ? isTouch : !!save.simple);
const item = $('menu-simple');
function apply() {
  const on = onNow();
  B.classList.toggle('simple', on);
  if (item) { item.setAttribute('aria-pressed', String(on)); item.textContent = `화면 단순하게: ${on ? '켬' : '끔'}`; }
  topFit.dirty();
}
item?.addEventListener('click', () => { save.simple = onNow() ? 0 : 1; persist(); apply(); });
$('menu-act')?.addEventListener('click', () => { $('btn-actions').click(); }); // 단순 화면: 동작 버튼 대신 메뉴 타일 (btn-actions 가 메뉴를 닫고 동작 바퀴를 엶)
apply();

// 필요할 때만: 값이 바뀌면 2초 (처음 본 값은 안 띄움)
const FLASH = [['zone-pill', () => $('zone-pill')?.textContent]];
const seen = new Map(), flashT = new Map();
function flash(id) { const el = $(id); if (!el) return; el.classList.add('flash'); flashT.set(id, 2); topFit.dirty(); }

// 퀘스트 줄: 3초 뒤 화살표만, 누르면 펼침
const TR = $('quest-track'); let trT = 3, trKey = '';
TR?.addEventListener('click', (e) => { if (B.classList.contains('simple') && TR.classList.contains('mini')) { e.stopImmediatePropagation(); TR.classList.remove('mini'); trT = 3; } }, true);
// 미니맵: 접힌 점 → 펼침 6초 → (펼친 동안 누르면) 큰 지도
const MM = $('minimap'); let mmT = 0;
MM?.addEventListener('click', (e) => { if (B.classList.contains('simple') && !MM.classList.contains('open')) { e.stopImmediatePropagation(); MM.classList.add('open'); mmT = 6; } }, true);

// 무기 바꾸기: 던지기 버튼을 위로 밀기 (단순 화면은 ▾ 가 없음)
{
  const ctx = $('btn-ctx'); let y0 = null;
  ctx.addEventListener('pointerdown', (e) => { y0 = e.clientY; });
  ctx.addEventListener('pointermove', (e) => {
    if (y0 == null || !B.classList.contains('simple') || save.equip.weapon <= 1) return;
    if (y0 - e.clientY > 40) { y0 = null; late.chargeCancel?.(); late.openArmWin?.(); }
  });
  for (const ev of ['pointerup', 'pointercancel']) ctx.addEventListener(ev, () => { y0 = null; });
}

let tickT = 0, altT = 0, ran = false;
let tLast = 0;
function tick() {
  const now = performance.now(), dt = Math.min(0.25, tLast ? (now - tLast) / 1000 : 0); tLast = now; // 게임 시간(멈춤·느리게)과 상관없이 실제 시간
  const on = B.classList.contains('simple') && !B.classList.contains('tut');
  for (const [id, t] of flashT) { const n = t - dt; if (n <= 0) { flashT.delete(id); $(id)?.classList.remove('flash'); topFit.dirty(); } else flashT.set(id, n); }
  // 조이스틱 끝까지 = 달리기 (단순 화면에는 달리기 버튼이 없음)
  if (on && isTouch) { const m = joy.active ? Math.hypot(joy.x, joy.y) : 0, run = m > (ran ? STICK.runOff : STICK.runOn) ? 1 : 0; /* 여유 (#313) */ if (run !== ran) { ran = run; setGait(run); } }
  else if (ran) { ran = 0; setGait(0); }
  if ((tickT -= dt) > 0) return; tickT = 0.25;
  for (const [id, f] of FLASH) { const v = f() || ''; if (seen.has(id) && seen.get(id) !== v && v && on && !$(id).hidden) flash(id); seen.set(id, v); }
  B.classList.toggle('has-ride', $('btn-ride')?.hidden === false); // 탈것 버튼이 보이면(가진 탈것이 있으면) 점프 대신
  const bag = $('bag-pill'); if (bag) { const n = +$('bag-n')?.textContent || 0, c = +$('bag-cap')?.textContent || 0; bag.classList.toggle('half', c > 0 && n / c >= 0.6); }
  const fight = !!player.down || !!late.bossFight?.() || (state.tension || 0) > 0.3 || !!life?.enemies?.near?.(player.pos, 22) || !!late.swarm?.state?.();
  B.classList.toggle('fight', fight);
  B.classList.toggle('win', panelOpen() || cam.mode === 'wardrobe' || $('wardrobe')?.hidden === false);
  if (TR) {
    const k = TR.querySelector('.qt')?.textContent + '|' + TR.classList.contains('ready');
    if (k !== trKey) { trKey = k; TR.classList.remove('mini'); trT = 3; }
    if (on && !TR.hidden && !TR.classList.contains('mini') && (trT -= 0.25) <= 0) TR.classList.add('mini');
    if (!on) TR.classList.remove('mini');
  }
  if (MM && MM.classList.contains('open') && (mmT -= 0.25) <= 0) MM.classList.remove('open');
  // 들판 떼 줄과 퀘스트 줄이 같이 있으면 4초씩 번갈아
  const both = on && TR && !TR.hidden && !$('swarm-bar')?.hidden && !!$('swarm-bar');
  if (both) { if ((altT -= 0.25) <= 0) { altT = 4; B.classList.toggle('qalt'); } } else if (B.classList.contains('qalt')) B.classList.remove('qalt');
}
late.tickSimple = tick;
late.simple = { state: () => ({ on: onNow(), cls: [...B.classList].filter((c) => ['simple', 'fight', 'win', 'has-ride', 'qalt'].includes(c)), run: ran }), set: (v) => { save.simple = v ? 1 : 0; persist(); apply(); }, apply };

/* ---------- 전체 화면 안내 ---------- */
const UA = navigator.userAgent || '';
const iPhone = /iPhone|iPod/.test(UA);
const iOSOther = /CriOS|FxiOS|EdgiOS|OPiOS|KAKAOTALK|Instagram|FBAN|FBAV|NAVER|Line\//i.test(UA);
// 'api' 전체 화면 버튼 · 'ios' 홈 화면에 추가 · 'ios-other' 사파리로 열기 · 'none' 안 띄움
export function fsKind() {
  const s = screenInfo();
  if (!isTouch || onestore.on || s.standalone || s.on) return 'none';
  if (iPhone) return iOSOther ? 'ios-other' : 'ios';
  return s.can ? 'api' : 'none';
}
const tip = $('fs-tip'), F = () => (save.fsTip ||= {});
function openTip(kind = fsKind()) {
  if (!tip) return false;
  if (kind === 'none') kind = iPhone ? 'ios' : screenInfo().can ? 'api' : 'none';
  if (kind === 'none') return false;
  tip.dataset.kind = kind; $('fs-tip-never').checked = !!F().off; tip.hidden = false; return true;
}
function closeTip() {
  if (!tip || tip.hidden) return;
  tip.hidden = true; F().off = $('fs-tip-never').checked ? 1 : 0; persist();
  director.end('intro:fsTip');
}
$('fs-tip-x')?.addEventListener('click', closeTip);
tip?.addEventListener('click', (e) => { if (e.target === tip) closeTip(); });
$('fs-tip-go')?.addEventListener('click', () => { toggleFullscreen(); closeTip(); });
$('fs-tip-copy')?.addEventListener('click', () => { navigator.clipboard?.writeText(location.href.split('#')[0]).catch(() => {}); $('fs-tip-copy').textContent = '복사했어요'; });
// 자동으로 한 번: 처음 들어온 폰 사용자, 튜토리얼 끝난 직후 (감독 문)
const offer = () => fsKind() !== 'none' && !F().off && openTip();
director.register({ id: 'fsTip', sec: Infinity, gate: () => fsKind() !== 'none' && !F().off, intro: () => { if (!offer()) director.end('intro:fsTip'); } });
// 메뉴: 언제든
const mi = $('menu-fshow');
if (mi) { mi.hidden = !isTouch || onestore.on || screenInfo().standalone; mi.addEventListener('click', () => { $('menu').hidden = true; openTip(); }); }
// 첫 화면: 전체 화면이 되는 곳이면 시작 버튼 아래 큰 버튼 (처음 한 번)
{
  const b = $('intro-fs'), go = $('enter'), intro = $('intro');
  if (b && fsKind() === 'api' && !F().intro && !F().off) {
    b.hidden = false;
    b.addEventListener('click', () => { F().intro = 1; persist(); toggleFullscreen(); if (go && !go.disabled) go.click(); });
    if (intro) new MutationObserver(() => { if (intro.hidden && !F().intro) { F().intro = 1; persist(); } }).observe(intro, { attributes: true, attributeFilter: ['hidden'] });
  }
}
late.fsTip = { kind: fsKind, offer, open: openTip, close: closeTip, reset: () => { save.fsTip = {}; persist(); } };
