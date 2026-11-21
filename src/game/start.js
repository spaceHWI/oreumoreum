// 첫 화면 시작, 로그인 (#86 에서 main.js 를 나눔. 파일 순서는 src/main.js, 규칙은 notes/prototype-v1.md 코드 구조)
import { ONLINE, createAccount, mountLogin, guestExpired, loggedIn } from '../online.js';
import { NET } from '../balance.js';
import { state, late } from './state.js';
import { $, save, ab, writeLocal, persist, MAP_ID, prevMap, lookS } from './save.js';
import { onestore } from '../onestore.js';
import { canvas } from './scene.js';
import { trash, player } from './place.js';
import { cam, endTitleCam } from './camera.js';
import { toast, updateStats, closePanels, ach, panelOpen, cancelAll } from './hud.js';
import { enableDev } from './menu.js';
import { startSession } from './room.js';
import { openLook, introMap, switchMap } from './look.js';
import { sound, setSoundUI } from './hooks.js';
import { createRank } from '../rank.js';
import { SKIN_TONES } from '../runner.js';
import { VERSION } from '../version.js';

// 첫 화면 (#72): 시작 → 입장 (#98: 서버 고르기 없음, 전투 오름 하나). 소리는 기본 켬, 메뉴에서 끄면 기억함
function closeIntro() {
  $('intro').hidden = true; $('intro-help').hidden = true; $('intro').classList.remove('dim'); document.body.classList.remove('intro-help-on'); $('enter').textContent = '시작';
  if (state.introToast) { toast(state.introToast, 4); state.introToast = null; }
}
function enter() {
  if (state.sessionOn) { closeIntro(); return; } // 메뉴의 도움말에서 연 경우
  const withSound = !save.soundOff && !onestore.silent; // 원스토어: 기기가 무음이면 소리 끈 채 (#97)
  if (save.server !== 'battle') { save.server = 'battle'; persist(); }
  startSession();
  if (introMap !== MAP_ID) { save.introSound = withSound ? 1 : 0; switchMap(introMap); return; }
  if (withSound) sound.start();
  setSoundUI();
  canvas.focus({ preventScroll: true });
  closeIntro(); endTitleCam();
  if (!save.entered) { save.entered = 1; persist(); state.awe = 5; cam.dist = 30; cam.pitch = 0.35; $('intro-help').hidden = false; }
  if (!save.look) openLook();
  else late.afterEnter?.(); // 다시 들어온 사람: 마지막 구역 클린하우스·들머리 고르기 (#139, boss.js)
}
$('enter').addEventListener('click', enter);
$('enter').disabled = false; $('enter').removeAttribute('aria-busy'); // 게임을 다 받은 뒤에야 누를 수 있음 (#90, page.html)
// 손님 기록 7일 (#94): 지워졌으면 첫 화면에 한 줄, 메뉴에 남은 날짜 (열 때마다 마지막 접속이 갱신돼 NET.keepDays 로 돌아감)
if (guestExpired) $('intro-expired').hidden = false;
if (!loggedIn()) { const left = Math.max(0, Math.ceil(((Number(save.lastSeen) || Date.now()) + NET.keepDays * 864e5 - Date.now()) / 864e5)); $('guest-days').textContent = `기록 보관 ${left}일 남음`; $('m-guest').hidden = false; }
// 귤 맞춤 알림 (#188): 서버가 귤을 깎으면 조용히 덮어쓰지 않고 알림. 의견 보내기에 이 정보가 붙음 (panels.js cutNote, 하루 동안)
function cutNotice(c, before, after) {
  save.lastCut = { n: c.n, why: String(c.why || ''), before, after, at: Date.now(), ver: VERSION }; persist();
  toast(`귤 ${c.n.toLocaleString()}개가 서버 기록과 달라 맞췄어요. 잘못 깎였다면 의견 보내기로 알려 주세요`, 7);
  const ch = $('fb-chip'); if (ch) { ch.classList.remove('hop'); void ch.offsetWidth; ch.classList.add('hop'); setTimeout(() => ch.classList.remove('hop'), 3000); }
}
// 멀티 서버 계정 (#7): 서버 주소가 있을 때만. 첫 화면에 베타 안내·구글 로그인, 메뉴에 남은 날짜·로그아웃·내 기록 지우기
if (ONLINE) {
  state.account = createAccount({ getSave: () => save, writeLocal, toast, entered: () => state.sessionOn, ver: VERSION,
    onGift: (g) => { save.coins += g.n; persist(); updateStats(); late.sound?.coin?.(); late.gyulShower?.(g.n); toast(`운영자가 귤 ${g.n.toLocaleString()}개를 보냈어요${g.why ? ': ' + g.why : ''}`, 5); }, // #188
    onFix: (f) => { if (f.coins != null && f.coins !== save.coins) { const before = save.coins; save.coins = f.coins; updateStats(); if (f.cut?.n > 0) cutNotice(f.cut, before, f.coins); else toast('귤을 서버 기록에 맞췄어요'); } if (f.total != null && save.trash) save.trash.total = f.total; if (f.mealFree) save.mealFree = 1; if ('season' in f) { if (f.season) save.season = f.season; else delete save.season; late.season?.fixed(); } writeLocal(); } });
  document.querySelector('.intro-beta')?.setAttribute('hidden', '');
  mountLogin({ box: $('acct-box'), enterBtn: $('enter'), account: state.account, localSave: save, hasProgress: save.coins > 5 || (save.trash?.total || 0) > 0 || !!save.tut?.done, toast });
  const syncAcct = () => { $('m-acct').hidden = !state.account.loggedIn; $('acct-days').textContent = `기록 보관 ${state.account.daysLeft()}일 남음`; if (state.account.admin) enableDev(); }; // 서버 어드민이면 개발자 메뉴 (#84)
  state.account.on(syncAcct); syncAcct();
  $('acct-out').addEventListener('click', () => state.account.logout());
  $('acct-id').addEventListener('click', async () => { // 계정 번호(sub)만. 세션 토큰은 다루지 않음 (#95)
    const id = state.account.sub; if (!id) return;
    try { await navigator.clipboard.writeText(id); toast('계정 번호를 복사했어요'); return; } catch (e) { /* 클립보드가 막힌 곳 */ }
    let t = $('acct-box-id'); if (!t) { t = document.createElement('textarea'); t.id = 'acct-box-id'; t.readOnly = true; t.rows = 2; $('m-acct').appendChild(t); }
    t.value = id; t.focus(); t.select();
  });
  $('acct-del').addEventListener('click', (e) => { const b = e.currentTarget; if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = '한 번 더 누르면 지워요'; setTimeout(() => { delete b.dataset.sure; b.textContent = '내 기록 지우기'; }, 4000); return; } state.resetting = true; state.account.deleteMe().catch(() => { state.resetting = false; toast('지우지 못했어요. 잠시 후 다시 해 주세요'); }); });
  state.account.start();
}
// ---------- 랭킹 (#11): 메뉴·클린하우스 옆 게시판에서 열기, 버린 뒤 순위 토스트 ----------
const rankFace = (look) => { const [k, sk] = String(look).split('|'); return k ? late.HEAD_SVG(k, SKIN_TONES[Math.max(0, Math.min(SKIN_TONES.length - 1, +sk || 0))]) : '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="22" r="11" fill="rgba(255,255,255,.35)"/></svg>'; };
export const rank = createRank({ account: state.account, store: trash?.store || null, face: rankFace, toast, ach, save, persist, onOpen: closePanels,
  el: { box: $('rank'), list: $('rank-list'), note: $('rank-note'), range: $('rank-range') } });
if (state.account?.loggedIn) setTimeout(() => rank.prime(), 2500); // 오늘 순위 기준
late.openRank = () => rank.open(); late.rankAfterDump = () => rank.afterDump();
$('menu-rank').addEventListener('click', () => rank.open());
document.addEventListener('visibilitychange', () => { if (!sound.ctx) return; if (document.hidden) sound.ctx.suspend(); else if (sound.on) sound.wake(); });
// 다른 탐방로로 막 옮겨 왔으면 바로 입장
if (prevMap && prevMap !== MAP_ID && save.entered) { $('intro').hidden = true; startSession(); if (!save.look) openLook(); if (save.introSound && !onestore.silent) { const once = () => { sound.start(); setSoundUI(); removeEventListener('pointerdown', once); }; addEventListener('pointerdown', once); } }
if ($('intro').hidden) endTitleCam(); else cam.mode = 'title'; // 첫 화면이 떠 있는 동안은 오름을 도는 카메라 (#72)
// ---------- 원스토어 앱 안 (#97, src/onestore.js) ----------
// pause: 게임 루프·소리 멈춤 / resume: 되돌림 (기기 무음이면 소리 끔) / exit: 0.5초 안에 동기 저장 / 뒤로: 열린 것 닫기
let osHeld = false; // pause 때 소리가 켜져 있었는지
onestore.connect({
  inApp() {}, // 구글 로그인 버튼은 page.html 의 .onestore .acct-gis 로 숨김 (앱 웹뷰에서 막힐 수 있어 손님으로 시작, 임의 결정)
  pause() { state.osPaused = true; persist(); if (sound.ctx && sound.ctx.state !== 'suspended') { osHeld = true; sound.ctx.suspend(); } },
  resume({ ringerSilent } = {}) {
    state.osPaused = false;
    if (ringerSilent && sound.on) { sound.stop(); setSoundUI(); }
    if (osHeld && sound.ctx && sound.on) sound.wake();
    osHeld = false;
  },
  exit() { try { writeLocal(); ab.flush(); state.account?.push?.(true); } catch (e) { /* 앱이 닫히는 중 */ } }, // 기기 저장 + 서버는 keepalive
  back() {
    if (!$('intro').hidden) {
      if (state.sessionOn) { $('enter').click(); return true; } // 메뉴에서 연 도움말
      return false;
    }
    if (lookS.open) return false; // 캐릭터 고르기는 꼭 거치는 화면이라 닫지 않음 → 앱의 종료 확인
    if (panelOpen() || cam.mode === 'wardrobe' || ['sit', 'photo'].includes(player.pose) || !$('photo').hidden) { cancelAll(); return true; }
    return false;
  },
});
