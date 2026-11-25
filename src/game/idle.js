// 오래 멈춰 있으면 쉬러 가기 (#157): 조작이 없으면 NET.idleWarnSec 에 '계속 하시겠어요?' 창, NET.idleRestSec 에 저장하고 방에서 나가 쉬는 화면.
// 탭이 뒤로 가 있으면 NET.idleHiddenSec 에 바로 쉬러 감. 쉬는 동안 그리기·소리 멈춤(update.js state.idleRest), 누르면 새로고침 없이 같은 자리로 다시 들어옴.
// 조작 = 키·누르기·포인터 움직임·휠·터치. 자동 걷기·마차 타고 가기·엔딩 시네마틱 중엔 멈춤으로 치지 않음. 어드민은 내보내지 않음.
// 서버엔 presence a:1 (조작 있음) 만 NET.idleBeatMs 에 한 번 실어 보냄 → 서버(roomcore idleCheck)가 NET.idleKickSec 넘게 없으면 닫음(4004) → 여기 쉬는 화면
import { NET } from '../balance.js';
import { state, late } from './state.js';
import { persist } from './save.js';
import { player } from './place.js';
import { net } from './room.js';
import { autoGo } from './dump.js';
import { sound } from './hooks.js';

const T = { warn: NET.idleWarnSec, rest: NET.idleRestSec, hidden: NET.idleHiddenSec, beat: NET.idleBeatMs }; // __oreum.idle.set 로 짧게 (확인용)
let lastAct = Date.now(), beatAt = -1e12, beatWant = true, hiddenAt = 0, mode = ''; // '' | 'warn' | 'rest'
let soundHeld = false;

const css = document.createElement('style');
css.textContent = `#idle{position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;pointer-events:none;font-family:var(--body);color:var(--ink)}
#idle[hidden]{display:none}
#idle .card{background:var(--glass-2,rgba(20,20,24,.72));border:1px solid var(--hair);border-radius:18px;padding:18px 22px;max-width:min(88vw,360px);text-align:center;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 10px 30px rgba(0,0,0,.35)}
#idle .ic{font-size:34px;line-height:1;margin-bottom:8px}
#idle .tx{font-weight:700;font-size:16px;line-height:1.45}
#idle .n{display:inline-block;min-width:2ch;color:var(--acc);font-weight:800}
#idle.rest{pointer-events:auto;background:rgba(10,10,14,.62)}
#idle.rest .card{cursor:pointer}`;
document.head.appendChild(css);
const box = document.createElement('div'); box.id = 'idle'; box.hidden = true; box.setAttribute('role', 'dialog');
box.innerHTML = '<div class="card"><div class="ic" aria-hidden="true"></div><div class="tx"></div></div>';
document.body.appendChild(box);
const ic = box.querySelector('.ic'), tx = box.querySelector('.tx');

const exempt = () => !state.sessionOn || !!state.account?.admin || !!autoGo || !!player.cart || !!state.cine; // 시작 전·어드민·자동 이동·마차·시네마틱

function act() {
  lastAct = Date.now(); beatWant = true;
  if (mode === 'warn') hide();
}
function hide() { mode = ''; box.hidden = true; box.className = ''; }

function warn(left) {
  if (mode !== 'warn') { mode = 'warn'; box.className = ''; box.hidden = false; ic.textContent = '⏳'; tx.innerHTML = '계속 하시겠어요?<br><span class="n"></span>초 뒤 쉬러 갑니다'; }
  const n = tx.querySelector('.n'), s = String(Math.max(0, Math.ceil(left))); if (n.textContent !== s) n.textContent = s;
}

function rest() {
  if (mode === 'rest') return;
  mode = 'rest';
  try { persist(); state.account?.push?.(); } catch (e) { /* 저장 실패해도 이 기기 기록은 남음 */ }
  net.rest();
  state.idleRest = true;
  if (sound.ctx && sound.ctx.state !== 'suspended') { soundHeld = true; sound.ctx.suspend(); }
  box.className = 'rest'; box.hidden = false; ic.textContent = '🌙'; tx.textContent = '쉬는 중이에요. 화면을 누르면 다시 들어가요';
}

function wake() {
  if (mode !== 'rest') return;
  mode = ''; setTimeout(() => { if (!mode) hide(); }, 300); // 깨운 누름이 아래 버튼까지 가지 않게 잠깐 남김
  state.idleRest = false; lastAct = Date.now(); beatWant = true; beatAt = -1e12; // 새 연결엔 바로 조작 표시 hiddenAt = document.hidden ? Date.now() : 0;
  net.wake();
  if (soundHeld && sound.ctx && sound.on && !document.hidden) sound.wake();
  soundHeld = false;
}

// 서버가 닫음 (4004): 다시 붙지 않고 쉬는 화면 (방이 붙을 때마다 걸어 둠)
let hooked = null;
function hookRoom() { const r = net.room; if (!r?.on || r === hooked) return; hooked = r; r.on('idle', () => rest()); }

for (const ev of ['keydown', 'pointerdown', 'pointermove', 'wheel', 'touchstart', 'touchmove']) {
  addEventListener(ev, (e) => {
    if (state.bumped) return; /* 다른 곳에서 접속해 밀려난 동안은 bump.js 창이 맡음 (#303) */
    if (mode === 'rest') { if (ev === 'pointerdown' || ev === 'keydown' || ev === 'touchstart') { e.preventDefault?.(); e.stopPropagation?.(); wake(); } return; }
    act();
  }, { capture: true, passive: ev !== 'keydown' && ev !== 'pointerdown' && ev !== 'touchstart' });
}
document.addEventListener('visibilitychange', () => { hiddenAt = document.hidden ? Date.now() : 0; if (!document.hidden) check(); });

function check() {
  hookRoom();
  if (state.bumped) return; /* #303 */
  if (mode === 'rest') return;
  const t = Date.now();
  if (exempt() || state.osPaused) { lastAct = t; if (mode === 'warn') hide(); return; }
  if (document.hidden && hiddenAt && t - hiddenAt >= T.hidden * 1000) { rest(); return; }
  const idle = (t - lastAct) / 1000;
  if (idle >= T.rest) rest();
  else if (idle >= T.warn) warn(T.rest - idle);
}
setInterval(check, 500);

// net.js presence 에 실림 (game/room.js extra): 조작이 있었으면 T.beat 에 한 번 a:1
late.idleBeat = () => {
  const t = Date.now();
  if (exempt()) beatWant = true;
  if (!beatWant || t - beatAt < T.beat) return false;
  beatWant = false; beatAt = t; return true;
};

// 확인용 (__oreum.idle): set({warn, rest, hidden, beat}) 초·ms 를 짧게, now() 지금 상태
late.idleApi = {
  set(o) { Object.assign(T, o); lastAct = Date.now(); beatAt = -1e12; },
  state: () => ({ mode, idle: (Date.now() - lastAct) / 1000, asleep: !!net.room?.asleep, T: { ...T } }),
  rest, wake, act,
};
