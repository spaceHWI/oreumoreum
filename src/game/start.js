// 서버 고르기, 첫 화면 시작, 로그인 (#86 에서 main.js 를 나눔. 파일 순서는 src/main.js, 규칙은 notes/prototype-v1.md 코드 구조)
import { serverId, setServerId, SERVERS, SERVER_ART, SERVER_LABEL } from '../server.js';
import { ONLINE, createAccount, mountLogin } from '../online.js';
import { state, late } from './state.js';
import { $, save, srvSwitched, ab, writeLocal, persist, MAP_ID, prevMap } from './save.js';
import { canvas } from './scene.js';
import { trash, bloom } from './place.js';
import { cam, endTitleCam } from './camera.js';
import { toast, updateStats, closePanels, ach } from './hud.js';
import { enableDev } from './menu.js';
import { startSession } from './room.js';
import { updateTrashUI, syncBloomDeer } from './pickup.js';
import { openLook, introMap, switchMap } from './look.js';
import { sound, setSoundUI } from './hooks.js';
import { createRank } from '../rank.js';
import { SKIN_TONES } from '../runner.js';

// ---------- 서버 고르기 (#35) ----------
let introSrv = save.server || null; // 처음 온 사람은 아직 안 고름
const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
function buildSrvPick(box, sel, onPick) {
  box.innerHTML = ''; box.classList.toggle('chosen', !!sel);
  SERVERS.forEach((id) => {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.srv = id;
    b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(sel === id)); b.setAttribute('aria-label', SERVER_LABEL[id]); b.title = SERVER_LABEL[id];
    b.innerHTML = SERVER_ART[id] + '<i>' + CHECK_SVG + '</i>';
    b.addEventListener('click', () => onPick(id));
    box.append(b);
  });
}
function syncIntroSrv() {
  buildSrvPick($('intro-srv'), introSrv, (id) => { introSrv = id; syncIntroSrv(); });
  $('srv-go').disabled = !introSrv;
}
// 시작 화면에서 고른 서버 적용 (아직 아무것도 시작하기 전이라 새로고침 없이 바꿔 끼움)
function applyIntroSrv() {
  if (!introSrv) return;
  if (introSrv !== serverId()) { setServerId(introSrv); if (trash) { const sw = () => { trash.store.setServer(introSrv); trash.relayout(); }; if (bloom) { bloom.resync(sw); syncBloomDeer(); state.lastZoneUI = ''; updateTrashUI(false); } else sw(); } }
  save.server = introSrv; persist();
}
// 메뉴: 서버 바꾸기 → 저장하고 새로고침 (새로고침 뒤 바로 입장)
export function openServer() {
  closePanels();
  buildSrvPick($('server-pick'), serverId(), (id) => {
    if (id === serverId()) { $('server').hidden = true; return; }
    save.server = id; save.srvSwitch = 1; save.introSound = sound.on ? 1 : 0; ab.flush(); persist(); location.reload();
  });
  $('server').hidden = false;
}
$('menu-server').addEventListener('click', openServer);
// 첫 화면 (#72): 시작 → (서버를 아직 안 골랐으면) 서버 고르기 → 입장. 소리는 기본 켬, 메뉴에서 끄면 기억함
function closeIntro() {
  $('intro').hidden = true; $('intro-help').hidden = true; $('intro').classList.remove('dim'); document.body.classList.remove('intro-help-on'); $('enter').textContent = '시작';
  if (state.introToast) { toast(state.introToast, 4); state.introToast = null; }
}
function enter() {
  if (state.sessionOn) { closeIntro(); return; } // 메뉴의 도움말에서 연 경우
  if (!introSrv) { $('intro-main').hidden = true; $('intro-step').hidden = false; syncIntroSrv(); return; }
  const withSound = !save.soundOff;
  applyIntroSrv(); startSession();
  if (introMap !== MAP_ID) { save.introSound = withSound ? 1 : 0; switchMap(introMap); return; }
  if (withSound) sound.start();
  setSoundUI();
  canvas.focus({ preventScroll: true });
  closeIntro(); endTitleCam();
  if (!save.entered) { save.entered = 1; persist(); state.awe = 5; cam.dist = 30; cam.pitch = 0.35; $('intro-help').hidden = false; }
  if (!save.look) openLook();
}
$('enter').addEventListener('click', enter);
$('enter').disabled = false; $('enter').removeAttribute('aria-busy'); // 게임을 다 받은 뒤에야 누를 수 있음 (#90, page.html)
// 멀티 서버 계정 (#7): 서버 주소가 있을 때만. 첫 화면에 베타 안내·구글 로그인, 메뉴에 남은 날짜·로그아웃·내 기록 지우기
if (ONLINE) {
  state.account = createAccount({ getSave: () => save, writeLocal, toast, entered: () => state.sessionOn,
    onFix: (f) => { if (f.coins != null && f.coins !== save.coins) { save.coins = f.coins; updateStats(); toast('귤을 서버 기록에 맞췄어요'); } if (f.total != null && save.trash) save.trash.total = f.total; writeLocal(); } });
  document.querySelector('.intro-beta')?.setAttribute('hidden', '');
  mountLogin({ box: $('acct-box'), enterBtn: $('enter'), account: state.account, localSave: save, hasProgress: save.coins > 5 || (save.trash?.total || 0) > 0 || !!save.tut?.done, toast });
  const syncAcct = () => { $('m-acct').hidden = !state.account.loggedIn; $('acct-days').textContent = `기록 보관 ${state.account.daysLeft()}일 남음`; if (state.account.admin) enableDev(); }; // 서버 어드민이면 개발자 메뉴 (#84)
  state.account.on(syncAcct); syncAcct();
  $('acct-out').addEventListener('click', () => state.account.logout());
  $('acct-del').addEventListener('click', (e) => { const b = e.currentTarget; if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = '한 번 더 누르면 지워요'; setTimeout(() => { delete b.dataset.sure; b.textContent = '내 기록 지우기'; }, 4000); return; } state.resetting = true; state.account.deleteMe().catch(() => { state.resetting = false; toast('지우지 못했어요. 잠시 후 다시 해 주세요'); }); });
  state.account.start();
}
$('srv-go').addEventListener('click', () => { if (introSrv) enter(); });
// ---------- 랭킹 (#11): 메뉴·클린하우스 옆 게시판에서 열기, 버린 뒤 순위 토스트 ----------
const rankFace = (look) => { const [k, sk] = String(look).split('|'); return k ? late.HEAD_SVG(k, SKIN_TONES[Math.max(0, Math.min(SKIN_TONES.length - 1, +sk || 0))]) : '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="22" r="11" fill="rgba(255,255,255,.35)"/></svg>'; };
export const rank = createRank({ account: state.account, store: trash?.store || null, srvNow: serverId, face: rankFace, toast, ach, save, persist, onOpen: closePanels,
  el: { box: $('rank'), list: $('rank-list'), note: $('rank-note'), srv: $('rank-srv'), range: $('rank-range') } });
if (state.account?.loggedIn) setTimeout(() => rank.prime(), 2500); // 오늘 순위 기준
late.openRank = (srv) => rank.open(srv); late.rankAfterDump = () => rank.afterDump();
$('menu-rank').addEventListener('click', () => rank.open());
document.addEventListener('visibilitychange', () => { if (!sound.ctx) return; if (document.hidden) sound.ctx.suspend(); else if (sound.on) sound.ctx.resume(); });
// 다른 탐방로로 막 옮겨 왔으면 바로 입장
if (((prevMap && prevMap !== MAP_ID) || srvSwitched) && save.entered && save.server) { $('intro').hidden = true; startSession(); if (!save.look) openLook(); if (srvSwitched) setTimeout(() => toast(SERVER_LABEL[serverId()]), 600); if (save.introSound) { const once = () => { sound.start(); setSoundUI(); removeEventListener('pointerdown', once); }; addEventListener('pointerdown', once); } }
if ($('intro').hidden) endTitleCam(); else cam.mode = 'title'; // 첫 화면이 떠 있는 동안은 오름을 도는 카메라 (#72)
