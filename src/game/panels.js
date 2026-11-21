// 채팅, 메뉴 항목, 릴리스 노트, 의견 보내기, 도움말 (#86 에서 main.js 를 나눔. 파일 순서는 src/main.js, 규칙은 notes/prototype-v1.md 코드 구조)
import { FEEDBACK, TITLE } from '../balance.js';
import { logoSvg } from '../logo.js';
import { VERSION, RELEASE_NOTES } from '../version.js';
import { MAPS } from '../maps.js';
import { serverId } from '../server.js';
import { postFeedback } from '../online.js';
import { createFeedback } from '../feedback.js';
import { setCrashSink } from '../crash.js';
import { late, state } from './state.js';
import { $, isTouch, save, MAP_ID } from './save.js';
import { canvas } from './scene.js';
import { runner, player } from './place.js';
import { cam } from './camera.js';
import { toast, closePanels, ach } from './hud.js';

Object.assign(late, { openChat }); // 앞 파일에서 부르는 함수

function openChat() { if (cam.mode === 'wardrobe') return; closePanels(); $('chat').hidden = false; $('chat-input').focus(); }
$('btn-chat').addEventListener('click', openChat);
$('chat-form').addEventListener('submit', (e) => { e.preventDefault(); const v = $('chat-input').value; $('chat-input').value = ''; $('chat').hidden = true; canvas.focus(); if (v.trim()) { late.social.say(v, runner.root); ach.emit('chat'); } });
$('chat-input').addEventListener('keydown', (e) => { if (e.key === 'Escape') $('chat').hidden = true; });

$('menu-wardrobe').addEventListener('click', () => { closePanels(); late.openWardrobe(); });
$('menu-shop').addEventListener('click', () => { closePanels(); late.shopGuide(); }); // #128 가게 안내
$('menu-sign').addEventListener('click', () => { closePanels(); late.openSign(); });
$('ver-text').textContent = `v${VERSION}` + (RELEASE_NOTES[0]?.date ? ` · ${RELEASE_NOTES[0].date.replace(/-/g, '.')}` : ''); // 첫 화면에 새 릴리스 노트 날짜도
function openNotes() {
  const box = $('notes-body'); box.innerHTML = '';
  RELEASE_NOTES.forEach((n) => {
    const h = document.createElement('h3'); h.textContent = `v${n.v} `; const sm = document.createElement('small'); sm.textContent = n.date; h.append(sm);
    const ul = document.createElement('ul'); n.items.forEach((t) => { const li = document.createElement('li'); li.textContent = t; ul.append(li); });
    box.append(h, ul);
  });
  $('notes').hidden = false;
}
$('intro-notes').addEventListener('click', openNotes);
// 첫 화면 (#72): 최근 릴리스 노트 몇 줄 + 로고
RELEASE_NOTES[0]?.items.slice(0, TITLE.notes).forEach((t) => { const li = document.createElement('li'); li.textContent = t; $('intro-rn').append(li); });
$('intro-logo').insertAdjacentHTML('beforeend', logoSvg({ dark: true }) /* 첫 화면: 낮·밤 장면 위라 흰 글자 + 그림자 (#87) */);
$('menu-notes').addEventListener('click', () => { closePanels(); openNotes(); });
// 의견 보내기 (#77): 서버가 있으면 /feedback 으로, 없으면 기기에 모아 뒀다가 서버가 붙으면 한꺼번에 (feedback.js)
export const feedback = createFeedback({
  key: (__DEV__ ? 'oreumoreum.dev' : 'oreumoreum.v1') + '.fb', // '처음부터 다시' 에도 남도록 저장 키를 따로
  post: postFeedback,
  meta: () => ({ ver: VERSION, srv: serverId(), map: MAP_ID, dev: isTouch ? (Math.min(innerWidth, innerHeight) <= 600 ? 'phone' : 'tablet') : 'desktop', w: innerWidth, h: innerHeight, x: Math.round(player.pos.x), z: Math.round(player.pos.z), nick: save.nick }),
});
feedback.flush();
// 오류 알림 (#108): 같은 의견함에 kind 'crash' 로 (좌표·닉네임 없이)
setCrashSink(postFeedback, () => ({ ver: VERSION, srv: serverId(), map: MAP_ID, dev: isTouch ? (Math.min(innerWidth, innerHeight) <= 600 ? 'phone' : 'tablet') : 'desktop', w: innerWidth, h: innerHeight }));
const fbLen = () => { $('feedback-len').textContent = `${$('feedback-input').value.length} / ${FEEDBACK.max}`; };
function openFeedback(close = true) { if (close) closePanels(); $('feedback-input').maxLength = FEEDBACK.max; fbLen(); $('feedback').hidden = false; setTimeout(() => $('feedback-input').focus(), 50); }
$('menu-feedback').addEventListener('click', () => openFeedback());
$('fb-chip').addEventListener('click', () => openFeedback()); // 위쪽 줄 말풍선 (#103)
// 처음 들어온 뒤 한 번: 버튼이 통통 튀고 말풍선 3초 (기기당 한 번, #112)
{ const K = (__DEV__ ? 'oreumoreum.dev' : 'oreumoreum.v1') + '.fbhint'; let seen = false; try { seen = !!localStorage.getItem(K); } catch (e) { /* 저장 불가 */ }
  if (!seen) { const iv = setInterval(() => { if (!state.sessionOn || !$('intro').hidden) return; clearInterval(iv); try { localStorage.setItem(K, '1'); } catch (e) { /* */ } setTimeout(() => { const c = $('fb-chip'), b = $('fb-bub'); c.classList.add('hop'); b.hidden = false; setTimeout(() => { c.classList.remove('hop'); b.hidden = true; }, 3000); }, 1500); }, 500); } }
$('intro-feedback').addEventListener('click', (e) => { e.stopPropagation(); openFeedback(false); }); // 첫 화면 베타 안내 옆
$('feedback-input').addEventListener('input', fbLen);
$('feedback-input').addEventListener('keydown', (e) => e.stopPropagation());
$('feedback-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!$('feedback-input').value.trim()) return;
  const w = feedback.wait();
  if (w > 0) { const m = `조금 뒤에 다시 보내 주세요 (${Math.ceil(w / 1000)}초)`; toast(m); $('feedback-len').textContent = m; return; }
  $('feedback-send').disabled = true;
  const r = await feedback.send($('feedback-input').value);
  $('feedback-send').disabled = false;
  if (r === 'ok' || r === 'kept') { $('feedback-input').value = ''; fbLen(); $('feedback').hidden = true; toast('고마워요! 잘 읽을게요'); if (!$('intro').hidden) { const ib = $('intro-feedback'); ib.textContent = '고마워요!'; setTimeout(() => { ib.textContent = '의견 보내기'; }, 3000); } }
});
$('menu-help').addEventListener('click', () => { closePanels(); $('intro').classList.add('dim'); document.body.classList.add('intro-help-on'); $('enter').textContent = '닫기'; $('intro-main').hidden = false; $('intro').hidden = false; $('intro-help').hidden = false; });
