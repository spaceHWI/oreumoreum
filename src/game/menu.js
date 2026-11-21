// 처음부터 다시, 개발자 버튼, 배경 음악, 동작(이모트) 버튼 (#86 에서 main.js 를 나눔. 파일 순서는 src/main.js, 규칙은 notes/prototype-v1.md 코드 구조)
import { WX, wxIcon } from '../weather.js';
import { ONLINE } from '../online.js';
import { state, late } from './state.js';
import { $, KEY, save, persist } from './save.js';
import { wx, spots, applySky } from './scene.js';
import { player } from './place.js';
import { toast, topFit, updateStats, busy, closePanels, ach, openAch } from './hud.js';
import { marker } from './input.js';
import { initInbox, inboxCheck } from './inbox.js';

// ---------- 동작 ----------
$('btn-actions').addEventListener('click', () => { const a = $('actions'); const open = a.hidden; closePanels(); a.hidden = !open; if (open) state.emo.opened(); });
$('btn-menu').addEventListener('click', () => { inboxCheck(); const a = $('menu'); const open = a.hidden; closePanels(); a.classList.remove('more'); $('m-steps').textContent = player.steps.toLocaleString('ko-KR'); $('m-wx').innerHTML = wxIcon(wx.kind) + WX[wx.kind].name; $('ach-dot3').hidden = $('ach-dot').hidden; a.hidden = !open; });
$('menu-more').addEventListener('click', () => $('menu').classList.toggle('more'));
// 처음부터 다시(#33): 2초 꾹 누르면 이 기기의 저장을 지움. 닉네임·그래픽·소리 설정은 남김 (돌탑의 돌은 서버에 있어 그대로)
{
  const b = $('menu-reset'), HOLD = 2000; let t0 = 0, raf = 0;
  const stop = () => { t0 = 0; cancelAnimationFrame(raf); b.style.setProperty('--p', 0); };
  const doReset = () => {
    state.resetting = true; // 이후 persist 가 옛 저장을 되쓰지 않게
    const keep = { nick: save.nick, gfx: save.gfx, gfxV3: save.gfxV3, perf: save.perf, rainFx: save.rainFx, introSound: save.introSound, music: save.music, reset: 1, _rev: save._rev, _acct: save._acct }; // reset: 처음 온 사람처럼 시작. _rev·_acct: 계정 사본이면 서버 기록으로 되돌아가지 않게 (#7)
    for (const k of Object.keys(keep)) if (keep[k] === undefined) delete keep[k];
    try { localStorage.setItem(KEY, JSON.stringify(keep)); } catch (e) { /* 저장 불가 환경 */ }
    location.reload();
  };
  const tick = () => { if (!t0) return; const p = Math.min(1, (performance.now() - t0) / HOLD); b.style.setProperty('--p', p); if (p >= 1) { t0 = 0; doReset(); } else raf = requestAnimationFrame(tick); };
  b.addEventListener('pointerdown', (e) => { if (e.button) return; e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (_) { /* 무시 */ } t0 = performance.now(); raf = requestAnimationFrame(tick); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, stop);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  b.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !t0) { e.preventDefault(); t0 = performance.now(); raf = requestAnimationFrame(tick); } });
  b.addEventListener('keyup', stop); b.addEventListener('blur', stop);
}
// 개발자 버튼 (#43): ?hwi=1 로 한 번 들어오면 이 기기에 기억, ?hwi=0 으로 끔. 저장 키를 따로 써서 리셋해도 남음
// 보안 (#84): 서버가 있으면 ?hwi 는 보지 않고, 로그인 계정이 서버 어드민(시크릿 ADMIN_SUBS)일 때만 켬. 손님·다른 계정은 메뉴도 없음
export let devOn = false;
const hwiFlag = (() => { const HK = 'oreumoreum.hwi'; try { const q = new URLSearchParams(location.search).get('hwi'); if (q === '1') localStorage.setItem(HK, '1'); else if (q === '0') localStorage.removeItem(HK); return localStorage.getItem(HK) === '1'; } catch (e) { return false; } })();
$('m-dev').hidden = true;
export function enableDev() {
  if (devOn) return; devOn = true;
  $('m-dev').hidden = false;
  if (state.debugReady) late.exposeDebug();
  if (ONLINE) initInbox(); // 받은 의견 (#96): 서버 어드민에게만
  {
    const TK = 'oreumoreum.hwi.tod'; // 시간대 (이 화면에만, 새로 고쳐도 유지)
    const tv = $('adm-tv'), sl = $('adm-tod');
    const setTod = (h) => {
      state.todOverride = h == null ? null : Math.min(24, Math.max(0, h));
      try { if (state.todOverride == null) localStorage.removeItem(TK); else localStorage.setItem(TK, String(state.todOverride)); } catch (e) { /* 무시 */ }
      tv.textContent = state.todOverride == null ? '실제' : `${String(Math.floor(state.todOverride)).padStart(2, '0')}:${String(Math.round((state.todOverride % 1) * 60)).padStart(2, '0')}`;
      if (state.todOverride != null) sl.value = state.todOverride;
      $('adm-body').querySelectorAll('[data-h]').forEach((b) => b.setAttribute('aria-pressed', String(state.todOverride != null && Math.abs(parseFloat(b.dataset.h) - state.todOverride) < 0.01))); $('adm-real').setAttribute('aria-pressed', String(state.todOverride == null)); // #153 고른 것은 눌린 모양
      applySky();
    };
    try { const v = parseFloat(localStorage.getItem(TK)); if (Number.isFinite(v)) setTod(v); } catch (e) { /* 무시 */ }
    sl.addEventListener('input', () => setTod(parseFloat(sl.value)));
    $('adm-body').querySelectorAll('[data-h]').forEach((b) => b.addEventListener('click', () => setTod(parseFloat(b.dataset.h))));
    $('adm-real').addEventListener('click', () => setTod(null));
    $('adm-body').querySelectorAll('[data-wx]').forEach((b) => b.addEventListener('click', () => { wx.set(b.dataset.wx || null); toast('날씨: ' + WX[wx.kind].name); $('adm-body').querySelectorAll('[data-wx]').forEach((o) => o.setAttribute('aria-pressed', String((o.dataset.wx || null) === wx.forced))); }));
    { // 좌표 보기 (#153): 위쪽 곳 이름 칸 옆에 숫자 좌표 (이 기기만)
      const XK = 'oreumoreum.hwi.xy', xb = $('adm-xy');
      const setXY = (on) => { $('xy').hidden = !on; xb.setAttribute('aria-pressed', String(on)); try { if (on) localStorage.setItem(XK, '1'); else localStorage.removeItem(XK); } catch (e) { /* 무시 */ } topFit.dirty(); };
      let on0 = false; try { on0 = localStorage.getItem(XK) === '1'; } catch (e) { /* 무시 */ } setXY(on0);
      xb.addEventListener('click', () => setXY($('xy').hidden));
    }
    $('adm-toggle').addEventListener('click', () => { const h = !$('adm-body').hidden; $('adm-body').hidden = h; $('adm-toggle').setAttribute('aria-expanded', String(!h)); });
    let rc = 0;
    $('dev-reset').addEventListener('click', () => {
      if (!rc) { rc = 1; $('dev-reset').textContent = '정말 지울까요? 한 번 더'; setTimeout(() => { rc = 0; $('dev-reset').textContent = '모두 리셋'; }, 4000); return; }
      state.resetting = true;
      try { localStorage.setItem(KEY, JSON.stringify({ reset: 1 })); localStorage.removeItem(TK); } catch (e) { /* 무시 */ }
      location.reload();
    });
    // 들어오기 다시 (#99): 들어오기를 본 표시·캐릭터 고른 표시만 지우고 새로 고침. 장비·귤·치운 양·튜토리얼·로그인은 그대로 (_rev·_acct 도 남겨 서버 기록으로 되돌아가지 않게)
    $('dev-intro').addEventListener('click', () => {
      state.resetting = true;
      const keep = { ...save }; delete keep.entered; delete keep.look; delete keep.server;
      if (keep.pace) keep.pace = { ...keep.pace, hint: 0 }; // #135 투기꾼 안내도 다시
      delete keep.journey; // #176 감독의 문·소개도 처음부터
      try { localStorage.setItem(KEY, JSON.stringify(keep)); } catch (e) { /* 저장 불가 환경 */ }
      location.reload();
    });
    $('dev-tut').addEventListener('click', () => { late.tut.skipAll(); toast('튜토리얼 건너뛰기'); }); // #62 건너뛰기는 개발자 버튼에만
    $('dev-gyul').addEventListener('click', () => { save.coins += 10000; persist(); updateStats(); late.sound.coin?.(); toast('귤 +10,000'); }); // 업적·귤 벌기 기록에는 안 셈
  }
}
if (!ONLINE && hwiFlag) enableDev(); // 혼자 하기(서버 주소 없음)는 예전처럼
$('menu-ride').addEventListener('click', () => late.openRideWin()); // 탈것 창 (#109)
$('menu-ach').addEventListener('click', () => openAch());
$('menu-sound').addEventListener('click', () => { if (late.sound.on) late.sound.stop(); else late.sound.start(); save.soundOff = late.sound.on ? 0 : 1; persist(); late.setSoundUI(); }); // 소리는 메뉴 안에서만 (#75)
// 배경 음악 켜기/끄기·크기 (#64). save.music = { on, vol }
$('menu-music').addEventListener('click', () => { save.music.on = save.music.on ? 0 : 1; late.sound.setMusic(save.music.on); if (save.music.on && !late.sound.on) late.sound.start(); late.setSoundUI(); persist(); });
$('music-vol').addEventListener('input', (e) => { save.music.vol = Math.round(+e.target.value) / 100; late.sound.setMusicVol(save.music.vol); if (save.music.vol > 0 && !save.music.on) { save.music.on = 1; late.sound.setMusic(1); } late.setSoundUI(); });
$('music-vol').addEventListener('change', () => persist());
$('act-chat').addEventListener('click', () => late.openChat());
// 동작(이모트) (#76): 동작 버튼 → 바퀴 메뉴. 목록·말풍선·방향 표시는 emotes.js
export const emoRiding = () => !!(player.riding || player.ride || player.cart);
export const emoCan = () => !busy() && !player.air && !player.knock && !player.flail && !(player.pose === 'throw' || player.pose === 'bow' || player.pose === 'aim') && !state.fishing?.active;
state.emo = null; // net 다음에 만듦 (아래 '함께' 쪽)
export function doEmote(id) {
  if (!state.emo) return;
  closePanels();
  if (!state.emo.perform(id)) return;
  marker.visible = false;
  if (id === 'dance' && player.pose === 'dance' && spots.isViewpoint(player.pos)) ach.emit('dance-top');
}
