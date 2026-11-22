// 이름 바꾸기 (#162): 메뉴 '이름 바꾸기'·내 가방 이름 옆 버튼 → 창 하나. 처음 한 번 무료, 그다음 귤(NICK.price 부터 grow 배), 하루 한 번
// 로그인했으면 서버(POST /nick)가 거르기·하루 제한·값을 확인하고 귤을 뺌. 손님은 이 기기 기록(save.nickRen)으로 같은 규칙
// save.nickRen = { n: 바꾼 횟수, day: 마지막 바꾼 한국 날, free: 다음 한 번 무료(서버가 걸린 이름을 바꿔 줬을 때) }
import { NICK } from '../balance.js';
import { cleanText, nickOk, randomNick, nickPrice } from '../safetext.js';
import { kstDay } from '../rankday.js';
import { state, late } from './state.js';
import { $, save, persist, isTouch } from './save.js';
import { toast, updateStats, closePanels } from './hud.js';
import { net } from './room.js';

const ren = () => { const r = save.nickRen; return r && typeof r === 'object' ? { n: r.n | 0, day: r.day | 0, free: r.free ? 1 : 0 } : { n: 0, day: 0, free: 0 }; };
export const nickCost = () => { const r = ren(); return nickPrice(r.n, r.free); };
export const nickToday = () => NICK.perDay && ren().day === kstDay(); // 오늘 이미 바꿈
const online = () => !!state.account?.loggedIn;
const val = () => cleanText($('nick-new').value, NICK.max + 4);
let busyNow = false;

function showNick() { $('nick-mirror').textContent = save.nick; late.bagRefresh?.(); }
// 서버가 되돌리거나 바꾼 이름 (start.js onFix) — 걸린 이름이면 알려 줌
late.nickChanged = (was) => { showNick(); net.send(true); if (was && save.nickRen?.free) toast('쓸 수 없는 이름이라 새 이름을 붙였어요. 다음 한 번은 무료로 바꿀 수 있어요', 4); };

function refresh(err = '') {
  const v = val(), cost = nickCost(), today = nickToday(), ok = nickOk(v), same = v === save.nick;
  const bad = !!v && !ok && !same;
  $('nick-new').setAttribute('aria-invalid', String(bad));
  $('nick-new-err').hidden = !(bad || err); $('nick-new-err').textContent = err || '이 이름은 쓸 수 없어요';
  $('nick-new-note').textContent = today ? '이름은 하루에 한 번 바꿀 수 있어요. 내일 다시 와요' : cost ? `${NICK.min}~${NICK.max}자 · 하루에 한 번` : `${NICK.min}~${NICK.max}자 · 이번 한 번은 무료 · 하루에 한 번`;
  const b = $('nick-new-go'), short = cost - save.coins;
  b.disabled = busyNow || today || !ok || same || short > 0;
  b.innerHTML = short > 0 ? `${short.toLocaleString()}귤 더 필요` : cost ? `<i class="g"></i>${cost.toLocaleString()} 바꾸기` : '무료로 바꾸기';
}
export function openNick() {
  closePanels();
  $('nick-new').value = save.nick; busyNow = false; refresh();
  $('nickwin').hidden = false;
  if (!isTouch) setTimeout(() => { $('nick-new').focus(); $('nick-new').select(); }, 30);
}
export const closeNick = () => { $('nickwin').hidden = true; };

const ERR = { bad: '이 이름은 쓸 수 없어요', same: '지금 이름과 같아요', day: '이름은 하루에 한 번 바꿀 수 있어요', coins: '귤이 모자라요', price: '값이 바뀌었어요. 다시 눌러 주세요' };
export async function doRename(name = val()) {
  const cost = nickCost();
  if (busyNow || !nickOk(name) || name === save.nick || nickToday() || save.coins < cost) { refresh(); return false; }
  const was = save.nick;
  if (online()) {
    busyNow = true; refresh();
    try {
      const r = await state.account.rename(name, cost);
      save.coins = Math.max(0, save.coins - r.paid); save.nick = r.nick; save.nickSet = 1; save.nickRen = r.nickRen;
    } catch (e) {
      busyNow = false;
      if (e.data?.nickRen) { save.nickRen = e.data.nickRen; persist(); } // 서버 값으로 맞춤 (다른 기기에서 바꿨을 때 등)
      refresh(ERR[e.message] || '지금은 바꿀 수 없어요. 잠시 뒤 다시 해 봐요');
      return false;
    }
    busyNow = false;
  } else {
    const r = ren();
    save.coins = Math.max(0, save.coins - cost); save.nick = name; save.nickSet = 1;
    save.nickRen = { n: r.free ? r.n : r.n + 1, day: kstDay(), free: 0 };
  }
  persist(); updateStats(); showNick(); net.send(true); // 같은 방 이름표도 바로 (#115 묶음)
  closeNick(); toast(cost ? `이름을 바꿨어요 · 귤 -${cost.toLocaleString()}` : '이름을 바꿨어요');
  return was !== save.nick;
}

$('nick-new').addEventListener('input', () => refresh());
$('nick-new').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doRename(); } else if (e.key === 'Escape') closeNick(); });
$('nick-new-dice').addEventListener('click', () => { $('nick-new').value = randomNick(); refresh(); });
$('nick-new-go').addEventListener('click', () => doRename());
$('nickwin-close').addEventListener('click', closeNick);
$('nickwin').addEventListener('click', (e) => { if (e.target === $('nickwin')) closeNick(); });
$('nick-reroll').addEventListener('click', openNick);
$('menu-nick').addEventListener('click', openNick);
Object.assign(late, { openNick, closeNick });
