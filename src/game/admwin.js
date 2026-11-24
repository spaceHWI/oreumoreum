// 어드민 창 (#220): 메뉴의 '어드민 설정' 을 누르면 뜨는 창 하나. 탭(상태·귤·계정·해 보기·의견·기타)으로 나눠 한 화면에 들어오게 하고,
// 탭 안은 2~3열 칸 격자 (page.html #admwin). 마지막에 본 탭은 이 기기에 기억. 어드민에게만 (menu.js enableDev 가 initAdmWin 을 부름)
// 버튼 대부분은 주인 파일이 id 로 붙임 (menu.js 시간·날씨·리셋, season.js, cavecam.js, shopgate.js, inbox.js, gyuladmin.js …). 여기는 탭·정보·바로 띄우기·모바일 화면으로 보기만
import { VERSION } from '../version.js';
import { serverHost } from '../online.js';
import { crashLog } from '../crash.js';
import { IN_FRAME, mviewOn, setMview } from '../mview.js';
import { state, late } from './state.js';
import { $, MAP_ID, isTouch } from './save.js';
import { toast, closePanels } from './hud.js';

const TK = 'oreumoreum.hwi.tab', TABS = ['state', 'gyul', 'try', 'fb', 'etc'];
const win = $('admwin');
let on = false, cur = 'state', shown = false;
try { const t = localStorage.getItem(TK); if (TABS.includes(t)) cur = t; } catch (e) { /* 무시 */ }
export const admOpen = () => !win.hidden;
export const admTab = () => cur;

const row = (k, v) => { const d = document.createElement('div'); d.className = 'r'; const a = document.createElement('span'); a.textContent = k; const b = document.createElement('b'); b.textContent = v; d.append(a, b); return d; };
const hm = (t) => new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
/* 모바일 UI 토글 둘(어드민 창 첫 탭 맨 위·일반 설정 창 맨 위)이 같은 상태를 보임 (#297) */
export function paintMview() {
  const mvOn = IN_FRAME || mviewOn(), off = !IN_FRAME && isTouch; /* 진짜 터치 기기는 이미 모바일 화면 */
  for (const id of ['adm-mview', 'menu-mview']) { const b = $(id); if (!b) continue; b.setAttribute('aria-pressed', String(mvOn)); b.textContent = mvOn ? '모바일 UI 로 하기: 켬' : '모바일 UI 로 하기: 끔'; b.disabled = off; }
  $('adm-mview').closest('.adm-sec').hidden = off; $('menu-mview').hidden = off;
}
function paint() {
  const kind = IN_FRAME ? '폰 틀 (모바일 화면으로 보기)' : isTouch ? '터치 기기' : '데스크톱';
  $('adm-info').replaceChildren(row('버전', VERSION), row('서버', serverHost() || '혼자 하기'), row('맵·방', MAP_ID + (late.mpRoom ? ` · ${late.mpRoom.ch + 1}번 방` : '')), row('화면', `${innerWidth}×${innerHeight} · ${kind}`));
  const errs = crashLog();
  $('adm-errs').replaceChildren(...(errs.length ? errs.slice().reverse().map((e) => row(hm(e.at), e.text)) : [row('이번 실행에 난 오류', '없음')]));
  $('adm-go-inbox').hidden = $('adm-inbox-row').hidden;
  const sub = state.account?.sub, sb = $('adm-sub');
  sb.closest('.adm-sec').hidden = !sub;
  if (sub) sb.textContent = sb.getAttribute('aria-pressed') === 'true' ? sub : '●●●●●● (누르면 보임)';
  paintMview();
  const sel = $('adm-story'), ids = late.storyApi?.ids || [];
  if (sel.options.length !== ids.length + 1) { sel.replaceChildren(new Option('이야기…', '')); for (const id of ids) sel.append(new Option(id, id)); }
}
function tab(t) {
  if (!TABS.includes(t)) t = 'state';
  cur = t; try { localStorage.setItem(TK, t); } catch (e) { /* 무시 */ }
  win.querySelectorAll('[data-tab]').forEach((b) => { const o = b.dataset.tab === t; b.setAttribute('aria-selected', String(o)); b.tabIndex = o ? 0 : -1; });
  win.querySelectorAll('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== t; });
  $('adm-body').scrollTop = 0;
}
export function openAdm(t) { closePanels(); win.hidden = false; tab(t || cur); paint(); shown = true; }
export function closeAdm() { win.hidden = true; }
// 창을 띄워 둔 채 다른 창(의견함 등)을 열면 closePanels 로 닫힘. 그 창을 닫으면 다시 뜨지는 않음 (메뉴에서 다시 엶)
const go = (fn) => () => { closePanels(); fn(); };

export function initAdmWin() {
  if (on) return; on = true;
  $('adm-toggle').addEventListener('click', () => openAdm());
  $('admwin-close').addEventListener('click', closeAdm);
  win.addEventListener('pointerdown', (e) => { if (e.target === win) closeAdm(); });
  const tabs = win.querySelector('.adm-tabs');
  tabs.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { tab(b.dataset.tab); paint(); } });
  tabs.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const i = (TABS.indexOf(cur) + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
    tab(TABS[i]); win.querySelector(`[data-tab="${TABS[i]}"]`).focus(); e.preventDefault();
  });
  $('adm-go-inbox').addEventListener('click', () => $('dev-inbox').click());
  $('adm-sub').addEventListener('click', () => { const b = $('adm-sub'); b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); paint(); });
  for (const id of ['adm-mview', 'menu-mview']) $(id).addEventListener('click', () => { if (!$(id).disabled) setMview(!(IN_FRAME || mviewOn())); });
  paintMview();
  $('adm-lv').addEventListener('click', () => {
    const L = late.level; if (!L) return; const s = L.state();
    if (!s.need) { toast('이미 가장 높은 레벨'); return; }
    L.setXp(s.xp - s.into + s.need); toast(`레벨 ${s.lv + 1}`);
  });
  $('adm-ufo').addEventListener('click', go(() => { if (late.ufoNow) { late.ufoNow(); toast('UFO 지금'); } }));
  $('adm-safe').addEventListener('click', go(() => late.mystApi?.open?.()));
  $('adm-quake').addEventListener('click', go(() => late.mystApi?.quake?.()));
  $('adm-story').addEventListener('change', (e) => { const id = e.target.value; e.target.value = ''; if (!id) return; closePanels(); if (late.storyApi?.play(id) === false) toast('지금은 띄울 수 없어요: ' + id); });
  $('adm-labels').addEventListener('click', () => $('menu-dev').click());
  { const a = $('inbox-dot3'), b = $('inbox-dot4'); const sync = () => { b.hidden = a.hidden; }; sync(); new MutationObserver(sync).observe(a, { attributes: true, attributeFilter: ['hidden'] }); }
  setInterval(() => { if (!win.hidden && cur === 'state') paint(); }, 2000);
  late.admWin = { open: openAdm, close: closeAdm, tab: () => cur, shown: () => shown };
}
