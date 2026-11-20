// 받은 의견 보기 (#96): 어드민(개발자 메뉴)만. 서버 GET /feedback (최근 50개, ?before=<id> 로 이어 받기)
// 마지막으로 본 id 를 기기에 남겨 새 글 수를 점으로 보임. 확인은 게임을 열 때 한 번, 메뉴를 열 때 한 번 (MIN_GAP 안에서는 건너뜀)
import { getFeedback } from '../online.js';
import { cleanText } from '../safetext.js';
import { $ } from './save.js';
import { toast, closePanels } from './hud.js';

const SEEN_KEY = 'oreumoreum.inbox.seen';
const MIN_GAP = 30000;
const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 저장 불가 */ } } };
let on = false, seen = Number(ls.get(SEEN_KEY)) || 0, latest = 0, lastCheck = 0, oldest = 0, busy = false, items = [];

const kst = (t) => new Date(t).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });
function dots(n) { for (const id of ['inbox-dot', 'inbox-dot2', 'inbox-dot3']) { const e = $(id); if (e) { e.hidden = !n; e.title = n ? `새 의견 ${n}` : ''; } } }
const newCount = () => items.filter((it) => it.id > seen).length;

async function load(before = 0) {
  if (busy) return null; busy = true;
  try { return await getFeedback(before); } catch (e) { return null; } finally { busy = false; }
}
// 새 글이 있는지만 확인 (점 표시)
export async function inboxCheck(force = false) {
  if (!on || (!force && Date.now() - lastCheck < MIN_GAP)) return;
  lastCheck = Date.now();
  const r = await load();
  if (!Array.isArray(r)) return;
  items = r; latest = r[0]?.id || 0; dots(newCount());
}
const meta = (it) => [it.nick, it.ver && `v${it.ver}`, it.srv, it.map, it.dev && `${it.dev} ${it.w || '?'}x${it.h || '?'}`].filter(Boolean).join(' · ');
function row(it, isNew) {
  const li = document.createElement('li'); if (isNew) li.className = 'new';
  if (it.kind === 'crash') li.classList.add('crash'); // #108 게임이 보낸 오류 알림
  const h = document.createElement('small'); h.textContent = (it.kind === 'crash' ? '⚠ 오류 알림 · ' : '') + kst(it.at) + (isNew ? ' · 새 글' : '');
  const t = document.createElement('div'); t.className = 't'; t.textContent = cleanText(it.text, 600, { lines: true }); // 글자로만 (HTML 로 넣지 않음)
  const m = document.createElement('small'); m.textContent = cleanText(meta(it), 160);
  li.append(h, t, m);
  const copy = async () => { try { await navigator.clipboard.writeText(it.text); toast('글을 복사했어요'); } catch (e) { toast('복사하지 못했어요'); } };
  let timer = 0;
  li.addEventListener('click', copy);
  li.addEventListener('contextmenu', (e) => { e.preventDefault(); copy(); }); // 길게 누르기(모바일)·오른쪽 클릭
  li.addEventListener('pointerdown', () => { timer = setTimeout(() => { timer = 0; copy(); }, 600); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) li.addEventListener(ev, () => clearTimeout(timer));
  return li;
}
function render(markSeen) {
  const ul = $('inbox-list'); ul.textContent = '';
  if (!items.length) { const li = document.createElement('li'); li.textContent = '아직 받은 의견이 없어요'; ul.append(li); }
  const was = seen;
  for (const it of items) ul.append(row(it, it.id > was));
  oldest = items.length ? items[items.length - 1].id : 0;
  $('inbox-more').hidden = items.length < 50 || oldest <= 1;
  if (markSeen && latest > seen) { seen = latest; ls.set(SEEN_KEY, String(seen)); dots(0); }
}
async function open() {
  closePanels(); $('inbox').hidden = false; $('inbox-more').hidden = true;
  const r = await load();
  if (Array.isArray(r)) { items = r; latest = r[0]?.id || 0; lastCheck = Date.now(); } else toast('의견을 불러오지 못했어요');
  render(true);
}
export function initInbox() {
  if (on) return; on = true;
  $('adm-inbox-row').hidden = false;
  $('dev-inbox').addEventListener('click', open);
  $('inbox-refresh').addEventListener('click', open);
  $('inbox-more').addEventListener('click', async () => {
    const r = await load(oldest);
    if (!Array.isArray(r)) return toast('더 불러오지 못했어요');
    items = items.concat(r); render(false); if (!r.length) $('inbox-more').hidden = true;
  });
  $('inbox').addEventListener('pointerdown', (e) => { if (e.target === $('inbox')) $('inbox').hidden = true; });
  inboxCheck(true); // 게임을 열 때 한 번
}
