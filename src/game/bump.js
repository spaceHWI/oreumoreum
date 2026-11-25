// 한 계정 한 접속 (#303): 같은 계정이 다른 브라우저·기기·탭에서 들어오면 서버가 이쪽에 'bump' 를 보내고 닫음(4005, roomcore bump).
// 여기서는 스스로 다시 붙지 않고(online.js), 마지막 저장을 바로 보낸 뒤 그리기를 멈추고 창 하나: [여기서 다시 하기] → 이쪽이 다시 주인(저쪽이 밀려남).
// 그사이 저쪽이 서버 기록을 앞서게 했으면 그 기록으로 다시 엶(account.retake). 손님은 서버가 보내지 않으므로 해당 없음
import { state, late } from './state.js';
import { persist } from './save.js';
import { net } from './room.js';
import { sound } from './hooks.js';

let on = false, soundHeld = false, busy = false;

const css = document.createElement('style');
css.textContent = `#bump{position:fixed;inset:0;z-index:72;display:flex;align-items:center;justify-content:center;background:rgba(10,10,14,.66);font-family:var(--body);color:var(--ink)}
#bump[hidden]{display:none}
#bump .card{display:grid;gap:12px;justify-items:center;background:var(--glass-2,rgba(20,20,24,.78));border:1px solid var(--hair);border-radius:18px;padding:20px 22px;max-width:min(88vw,360px);text-align:center;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 10px 30px rgba(0,0,0,.35)}
#bump .ic{font-size:34px;line-height:1}
#bump .tx{font-weight:700;font-size:16px;line-height:1.45;margin:0}
#bump .sub{font-size:12.5px;opacity:.72;margin:0}
#bump .btn{min-width:180px}`;
document.head.appendChild(css);
const box = document.createElement('div'); box.id = 'bump'; box.hidden = true; box.setAttribute('role', 'alertdialog'); box.setAttribute('aria-labelledby', 'bump-t');
box.innerHTML = '<div class="card"><div class="ic" aria-hidden="true">🔁</div><p class="tx" id="bump-t">다른 브라우저에서 접속해서<br>여기는 로그아웃됐어요</p><p class="sub" id="bump-sub"></p><button type="button" class="btn primary" id="bump-go">여기서 다시 하기</button></div>';
document.body.appendChild(box);
const go = box.querySelector('#bump-go'), sub = box.querySelector('#bump-sub');
for (const ev of ['pointerdown', 'keydown', 'touchstart', 'wheel']) box.addEventListener(ev, (e) => e.stopPropagation()); /* 아래 게임·쉬는 화면(idle.js)에 누름이 가지 않게 */

function show() {
  if (on) return;
  on = true;
  try { persist(); state.account?.push?.(true); } catch (e) { /* 저장 실패해도 이 기기 기록은 남음 */ }
  net.rest(); /* 남은 사람 모습을 지움 (연결은 이미 닫힘) */
  state.idleRest = true; state.bumped = true;
  if (sound.ctx && sound.ctx.state !== 'suspended') { soundHeld = true; sound.ctx.suspend(); }
  const m = state.account?.mail; sub.textContent = m ? '구글 계정 ' + m : '';
  box.hidden = false; go.disabled = false; go.textContent = '여기서 다시 하기';
  try { go.focus({ preventScroll: true }); } catch (e) { /* 무시 */ }
}

async function retake() {
  if (!on || busy) return;
  busy = true; go.disabled = true; go.textContent = '다시 들어가는 중…';
  let reload = false;
  try { reload = !!(await state.account?.retake?.()); } catch (e) { reload = false; }
  busy = false;
  if (reload) return; /* 저쪽 기록으로 다시 엶 */
  on = false; state.bumped = false; state.idleRest = false;
  box.hidden = true;
  net.wake();
  if (soundHeld && sound.ctx && sound.on && !document.hidden) sound.wake();
  soundHeld = false;
}
go.addEventListener('click', retake);

let hooked = null;
function hookRoom() { const r = net.room; if (!r?.on || r === hooked) return; hooked = r; r.on('bump', show); }
setInterval(hookRoom, 500); hookRoom();

late.bumpApi = { show, retake, state: () => ({ on, asleep: !!net.room?.asleep }) }; /* 확인용 (__oreum.bump) */
