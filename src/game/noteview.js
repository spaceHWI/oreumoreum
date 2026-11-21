// 쪽지 창 (#199): 주운 쪽지를 종이 모양으로 띄우고 이전·다음으로 넘겨 읽는다. punkworld.js(#165) 가 createNoteView 로 만들어 씀 (이 파일은 읽기만 해서는 아무것도 하지 않음)
// 순서: 주운 순서(save.punk.notes 의 주운 때, 같으면 NOTES 순서). 새로 주운 창은 맨 뒤에서 시작해 ◀ 로 앞 것을, 도감에서 열면 그 쪽지부터
// 넘기기: ◀ ▶ 버튼·←→(A·D) 키·좌우로 밀기. 끝에서 멈춤(처음으로 돌지 않음). 넘겨서 본 것도 읽음 처리(onRead)
// 종이: NOTES 의 paper 칸(memo·notebook·receipt·letter·postcard·alien·form·flyer·crumple·photo·rubbing·diary, 없으면 memo)
// 그림: NOTES 의 img 칸(true 면 assets/notes/<id>.webp, 글이면 그 주소)이 있으면 종이 위쪽에 테이프로 붙인 듯. 창을 열 때만 불러옴, 못 불러오면 종이만
// 저사양(LOW)·움직임 줄이기면 넘김 움직임 없이 바로 바뀜
import { LOW } from '../gfx2.js';

const HAND_FONT = 'https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&display=swap'; // 손글씨 (처음 열 때만 받음)
const PAPERS = ['memo', 'notebook', 'receipt', 'letter', 'postcard', 'alien', 'form', 'flyer', 'crumple', 'photo', 'rubbing', 'diary'];
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const imgSrc = (n) => (!n.img ? '' : typeof n.img === 'string' ? n.img : `assets/notes/${n.id}.webp`);

const CSS = `
#punk-note.overlay { z-index: 13; }
#punk-note .pn-wrap { display: flex; flex-direction: column; align-items: center; gap: 14px; max-height: 100%; padding: 12px 0; min-height: 0; }
#punk-note .pn-paper { --pp-bg: #f4ecd8; --pp-ink: #33302a; --pp-sub: #7a7262; --pp-rot: -1.2deg; --pp-w: 340px; --pp-fs: 1.3; --pp-font: "Nanum Pen Script", "Apple SD Gothic Neo", "Malgun Gothic", cursive;
  position: relative; box-sizing: border-box; flex: 0 1 auto; min-height: 0; width: min(var(--pp-w), calc(100vw - 48px)); max-height: min(68vh, calc(100dvh - 120px)); overflow: auto; overscroll-behavior: contain; touch-action: pan-y;
  padding: 24px 22px 20px; background: var(--pp-bg); color: var(--pp-ink); border-radius: 4px; box-shadow: 0 18px 40px rgba(0,0,0,.4); transform: rotate(var(--pp-rot)); font-family: var(--pp-font); word-break: keep-all; overflow-wrap: anywhere; }
#punk-note .pn-paper::before { content: ''; position: absolute; inset: 0; pointer-events: none; border-radius: inherit; background: repeating-linear-gradient(transparent 0 25px, rgba(80,70,50,.12) 25px 26px); }
#punk-note .pn-paper > * { position: relative; }
#punk-note .pn-from { font: 500 12px var(--body); color: var(--pp-sub); margin: 0 0 4px; }
#punk-note h2 { margin: 0 0 12px; font: 400 calc(19px * var(--pp-fs)) / 1.25 var(--pp-font); color: var(--pp-ink); }
#punk-note .pn-b { white-space: pre-line; font-size: calc(15px * var(--pp-fs)); line-height: 26px; margin: 0; }
#punk-note .pn-pic { margin: 4px auto 16px; width: 82%; max-width: 260px; aspect-ratio: 1; background: #fff; padding: 6px; box-shadow: 0 3px 8px rgba(0,0,0,.25); transform: rotate(2.4deg); }
#punk-note .pn-pic img { pointer-events: none; -webkit-user-drag: none; display: block; width: 100%; height: 100%; object-fit: cover; }
#punk-note .pn-pic::before, #punk-note .pn-pic::after { content: ''; position: absolute; top: -9px; width: 64px; height: 20px; background: rgba(240,228,180,.75); box-shadow: 0 1px 2px rgba(0,0,0,.12); }
#punk-note .pn-pic::before { left: -14px; transform: rotate(-28deg); }
#punk-note .pn-pic::after { right: -14px; transform: rotate(24deg); }
#punk-note .pn-nav { flex: none; display: flex; align-items: center; gap: 8px; padding: 6px; border-radius: 999px; background: var(--glass-2, rgba(20,20,24,.6)); border: 1px solid var(--hair); color: var(--ink); font-family: var(--body); }
#punk-note .pn-nav button { position: relative; flex: none; height: 44px; min-width: 44px; border: 0; border-radius: 999px; padding: 0 14px; background: rgba(255,255,255,.1); color: var(--ink); font: 800 15px var(--body); cursor: pointer; display: grid; place-items: center; }
#punk-note .pn-nav button:disabled { opacity: .3; cursor: default; }
#punk-note .pn-nav button.dot::after { content: ''; position: absolute; top: 6px; right: 6px; width: 8px; height: 8px; border-radius: 50%; background: var(--gyul); }
#punk-note .pn-nav .pn-close { background: var(--gyul); color: var(--acc-fg, #2a2722); }
#punk-note .pn-n { min-width: 92px; text-align: center; line-height: 1.15; }
#punk-note .pn-n b { display: block; font: 800 15px var(--body); }
#punk-note .pn-n small { display: block; font-size: 11px; color: var(--ink-soft); }
#punk-note .pn-paper.turn-l { animation: pn-in-l .26s ease-out; }
#punk-note .pn-paper.turn-r { animation: pn-in-r .26s ease-out; }
@keyframes pn-in-r { from { transform: translateX(46px) rotate(4deg); opacity: 0; } }
@keyframes pn-in-l { from { transform: translateX(-46px) rotate(-5deg); opacity: 0; } }
/* 종이 종류 */
#punk-note .pp-notebook { --pp-bg: #fbf8ef; --pp-rot: .8deg; padding-left: 40px; }
#punk-note .pp-notebook::before { background: linear-gradient(90deg, transparent 28px, rgba(210,80,70,.45) 28px 29.5px, transparent 29.5px), repeating-linear-gradient(transparent 0 25px, rgba(60,90,160,.16) 25px 26px); }
#punk-note .pp-receipt { --pp-bg: #fdfdf9; --pp-ink: #3b3b38; --pp-w: 290px; --pp-rot: 1deg; --pp-fs: 1; --pp-font: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; border-radius: 0; box-shadow: none; padding: 26px 22px;
  -webkit-mask: radial-gradient(7px at 50% 0, #0000 97%, #000) 50% 0 / 14px 51% repeat-x, radial-gradient(7px at 50% 100%, #0000 97%, #000) 50% 100% / 14px 51% repeat-x; mask: radial-gradient(7px at 50% 0, #0000 97%, #000) 50% 0 / 14px 51% repeat-x, radial-gradient(7px at 50% 100%, #0000 97%, #000) 50% 100% / 14px 51% repeat-x; }
#punk-note .pp-receipt::before { background: linear-gradient(180deg, rgba(0,0,0,.035), transparent 30%, rgba(0,0,0,.03) 70%, transparent); }
#punk-note .pp-receipt h2 { text-align: center; font-weight: 800; letter-spacing: .12em; border-bottom: 1px dashed #999; padding-bottom: 8px; }
#punk-note .pp-receipt .pn-b { font-size: 14px; line-height: 22px; }
#punk-note .pp-letter { --pp-bg: #fff8ef; --pp-ink: #4a3a3a; --pp-rot: -2deg; padding-bottom: 30px;
  -webkit-mask: linear-gradient(#000 0 0) top / 100% calc(100% - 10px) no-repeat, conic-gradient(from 135deg at 50% 0, #000 90deg, #0000 0) bottom / 16px 10px repeat-x; mask: linear-gradient(#000 0 0) top / 100% calc(100% - 10px) no-repeat, conic-gradient(from 135deg at 50% 0, #000 90deg, #0000 0) bottom / 16px 10px repeat-x; }
#punk-note .pp-letter::before { background: repeating-linear-gradient(transparent 0 25px, rgba(200,90,110,.16) 25px 26px); }
#punk-note .pp-postcard { --pp-bg: #fbf3e2; --pp-rot: 1.6deg; --pp-w: 360px; border: 7px solid transparent; border-image: repeating-linear-gradient(45deg, #d8483b 0 8px, #fbf3e2 8px 14px, #2f6fb5 14px 22px, #fbf3e2 22px 28px) 7; border-radius: 0; }
#punk-note .pp-postcard::before { background: linear-gradient(90deg, transparent 62%, rgba(80,70,50,.25) 62% calc(62% + 1px), transparent 0), repeating-linear-gradient(transparent 0 25px, rgba(80,70,50,.1) 25px 26px); }
#punk-note .pp-alien { --pp-bg: #dcf1e6; --pp-ink: #1d4a40; --pp-sub: #3d7a6a; --pp-rot: -.6deg; --pp-fs: 1; --pp-font: var(--display); outline: 2px dashed rgba(29,74,64,.35); outline-offset: -8px; }
#punk-note .pp-alien::before { background: linear-gradient(rgba(30,110,90,.12) 1px, transparent 1px) 0 0 / 14px 14px, linear-gradient(90deg, rgba(30,110,90,.12) 1px, transparent 1px) 0 0 / 14px 14px; }
#punk-note .pp-alien::after { content: '⟟ ⏃ ⌇ ◬ ⟒'; position: absolute; top: 10px; right: 14px; font-size: 12px; letter-spacing: .2em; color: var(--pp-sub); opacity: .7; }
#punk-note .pp-alien h2 { font-weight: 800; letter-spacing: .06em; }
#punk-note .pp-alien .pn-b { line-height: 24px; }
#punk-note .pp-form { --pp-bg: #fbfbf7; --pp-ink: #26282b; --pp-sub: #6a6e74; --pp-rot: .4deg; --pp-fs: 1; --pp-font: var(--body); border-top: 8px solid #3c5a8a; }
#punk-note .pp-form::before { background: none; }
#punk-note .pp-form h2 { font-weight: 800; border-bottom: 2px solid currentColor; padding-bottom: 8px; }
#punk-note .pp-form::after { content: '확인'; position: absolute; right: 18px; bottom: 14px; width: 54px; height: 54px; border: 3px solid rgba(200,50,40,.6); border-radius: 50%; display: grid; place-items: center; color: rgba(200,50,40,.65); font: 800 15px var(--display); transform: rotate(-14deg); }
#punk-note .pp-form .pn-b { padding-bottom: 46px; }
#punk-note .pp-flyer { --pp-bg: #ffe25a; --pp-ink: #222; --pp-sub: #5a4d10; --pp-rot: -2.4deg; --pp-fs: 1; --pp-font: var(--display); }
#punk-note .pp-flyer h2 { font-weight: 800; font-size: 26px; text-align: center; }
#punk-note .pp-flyer .pn-b { font-weight: 700; text-align: center; }
#punk-note .pp-flyer::before, #punk-note .pp-crumple::before { background: linear-gradient(115deg, transparent 30%, rgba(0,0,0,.07) 31%, transparent 34%), linear-gradient(28deg, transparent 52%, rgba(255,255,255,.35) 53%, transparent 56%), linear-gradient(160deg, transparent 64%, rgba(0,0,0,.06) 65%, transparent 69%), radial-gradient(circle at 20% 80%, rgba(0,0,0,.08), transparent 40%), radial-gradient(circle at 85% 15%, rgba(0,0,0,.06), transparent 35%); }
#punk-note .pp-crumple { --pp-bg: #ece2cb; --pp-rot: 2deg; }
#punk-note .pp-photo { --pp-bg: #f3f1ea; --pp-ink: #55575a; --pp-rot: -3deg; border-radius: 2px; }
#punk-note .pp-photo::before { background: repeating-linear-gradient(-30deg, transparent 0 34px, rgba(0,0,0,.035) 34px 36px); }
#punk-note .pp-rubbing { --pp-bg: #2c2c2b; --pp-ink: #ece7da; --pp-sub: #a8a395; --pp-rot: .5deg; --pp-fs: 1; --pp-font: var(--display); text-align: center; }
#punk-note .pp-rubbing::before { background: radial-gradient(circle at 30% 40%, rgba(255,255,255,.07), transparent 45%), radial-gradient(circle at 70% 70%, rgba(0,0,0,.3), transparent 50%), repeating-linear-gradient(90deg, rgba(255,255,255,.025) 0 2px, transparent 2px 5px); }
#punk-note .pp-rubbing h2 { font-weight: 800; letter-spacing: .3em; }
#punk-note .pp-rubbing .pn-b { font-weight: 800; font-size: 22px; line-height: 34px; letter-spacing: .3em; }
#punk-note .pp-diary { --pp-bg: #fffdf6; --pp-ink: #3a4f9a; --pp-rot: 1.2deg; }
#punk-note .pp-diary::before { background: linear-gradient(rgba(220,120,80,.35) 1px, transparent 1px) 0 0 / 26px 26px, linear-gradient(90deg, rgba(220,120,80,.35) 1px, transparent 1px) 0 0 / 26px 26px; }
@media (max-width: 600px) { #punk-note .pn-wrap { gap: 10px; } #punk-note .pn-paper { padding: 20px 18px 16px; } #punk-note .pp-notebook { padding-left: 38px; } }
@media (prefers-reduced-motion: reduce) { #punk-note .pn-paper.turn-l, #punk-note .pn-paper.turn-r { animation: none; } }
`;

// P = save.punk, NOTES 목록, zoneName(z), persist, onRead(id) 읽음 처리 뒤(표시·도감), sound() 소리 객체(late.sound)
export function createNoteView({ P, NOTES, zoneName, persist, onRead, onOpen, onClose, sound }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
  const root = document.createElement('div'); root.id = 'punk-note'; root.className = 'overlay dim'; root.hidden = true;
  root.innerHTML = '<div class="pn-wrap"><div class="pn-paper" role="dialog" aria-modal="true" aria-live="polite"><figure class="pn-pic" hidden><img alt="" decoding="async" draggable="false"></figure><p class="pn-from"></p><h2></h2><p class="pn-b"></p></div>'
    + '<div class="pn-nav"><button type="button" class="pn-prev" aria-label="이전 쪽지">◀</button><span class="pn-n"><b></b><small></small></span><button type="button" class="pn-next" aria-label="다음 쪽지">▶</button><button type="button" class="pn-close" id="punk-note-close">닫기</button></div></div>';
  document.body.append(root);
  const q = (s) => root.querySelector(s), paper = q('.pn-paper'), pic = q('.pn-pic'), img = pic.querySelector('img'), prevB = q('.pn-prev'), nextB = q('.pn-next');
  const by = Object.fromEntries(NOTES.map((n, i) => [n.id, { n, i }]));
  const order = () => Object.keys(P.notes).filter((id) => by[id]).sort((a, b) => (P.notes[a] - P.notes[b]) || (by[a].i - by[b].i));
  let list = [], idx = -1, dex = false, fontAsked = false, turns = 0;
  const animate = () => !LOW && !reduced();
  function askFont() {
    if (fontAsked) return; fontAsked = true;
    try { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = HAND_FONT; document.head.append(l); } catch { /* 글꼴 없이도 읽힘 */ }
  }
  function pageSound() { // 종이 넘기는 소리: 짧게 쓸리는 잡음
    const s = sound?.(); if (!s?.on || !s.sfxOn || !s.ctx || !s.noise) return;
    try {
      const c = s.ctx, t = c.currentTime, src = c.createBufferSource(); src.buffer = s.noise;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.9; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(3200, t + 0.16);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      src.connect(f); f.connect(g); g.connect(s.sfx); src.start(t, Math.random()); src.stop(t + 0.22);
    } catch { /* 소리 없이 넘어감 */ }
  }
  function syncNav() {
    const unr = (a, b) => list.slice(a, b).some((id) => P.unread.includes(id));
    prevB.disabled = idx <= 0; nextB.disabled = idx >= list.length - 1;
    prevB.classList.toggle('dot', unr(0, idx)); nextB.classList.toggle('dot', unr(idx + 1, list.length));
  }
  function render(dir) {
    const id = list[idx], n = by[id].n;
    paper.className = 'pn-paper pp-' + (PAPERS.includes(n.paper) ? n.paper : 'memo');
    q('.pn-from').textContent = n.from; q('h2').textContent = n.t; q('.pn-b').textContent = n.b;
    q('.pn-n b').textContent = `${idx + 1} / ${list.length}`; q('.pn-n small').textContent = zoneName(n.z);
    q('.pn-n').title = `주운 쪽지 ${list.length}/${NOTES.length}`;
    const src = imgSrc(n);
    pic.hidden = true; img.onload = img.onerror = null; img.removeAttribute('src');
    if (src) { img.onload = () => { if (list[idx] === id) pic.hidden = false; }; img.onerror = () => { pic.hidden = true; }; img.src = src; }
    paper.scrollTop = 0;
    if (dir && animate()) { void paper.offsetWidth; paper.classList.add(dir > 0 ? 'turn-r' : 'turn-l'); }
    const u = P.unread.indexOf(id); if (u >= 0) { P.unread.splice(u, 1); persist(); onRead?.(id); }
    syncNav();
  }
  function go(d) { // d = -1 이전 · +1 다음. 끝이면 멈춤
    if (root.hidden) return false;
    const j = idx + d; if (j < 0 || j >= list.length) return false;
    idx = j; turns++; render(d); pageSound(); return true;
  }
  function open(id, opt = {}) {
    if (!by[id] || !P.notes[id]) return false;
    list = order(); idx = list.indexOf(id); if (idx < 0) return false;
    dex = !!opt.dex; askFont(); onOpen?.(dex);
    root.hidden = false; render(0);
    return true;
  }
  function close() { if (root.hidden) return; root.hidden = true; img.removeAttribute('src'); onClose?.(dex); }
  prevB.addEventListener('click', () => go(-1));
  nextB.addEventListener('click', () => go(1));
  q('.pn-close').addEventListener('click', close);
  root.addEventListener('pointerdown', (e) => { if (e.target === root || e.target === q('.pn-wrap')) close(); });
  paper.addEventListener('animationend', () => paper.classList.remove('turn-l', 'turn-r'));
  // 좌우로 밀기 (종이 위, 세로는 스크롤)
  let sw = null;
  paper.addEventListener('pointerdown', (e) => { sw = { id: e.pointerId, x: e.clientX, y: e.clientY }; });
  paper.addEventListener('pointerup', (e) => {
    if (!sw || sw.id !== e.pointerId) return; const dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null;
    if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.3) go(dx < 0 ? 1 : -1);
  });
  paper.addEventListener('pointercancel', () => { sw = null; });
  // 키: 창이 열려 있는 동안 ←→·A·D 는 넘기기(캐릭터는 움직이지 않음), Esc 는 닫기. input.js 보다 먼저 받음(capture)
  addEventListener('keydown', (e) => {
    if (root.hidden || e.altKey || e.ctrlKey || e.metaKey) return;
    const c = e.code, d = c === 'ArrowLeft' || c === 'KeyA' ? -1 : c === 'ArrowRight' || c === 'KeyD' ? 1 : 0;
    if (d) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) go(d); return; }
    if (c === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); }
  }, true);
  return {
    el: root, open, close, go, isOpen: () => !root.hidden,
    test: () => ({ open: !root.hidden, id: list[idx] ?? null, i: idx, n: list.length, title: !root.hidden ? q('h2').textContent : null, paper: paper.className.replace('pn-paper ', '').split(' ')[0], prev: !prevB.disabled, next: !nextB.disabled, dotPrev: prevB.classList.contains('dot'), dotNext: nextB.classList.contains('dot'), count: q('.pn-n b').textContent, turns, pic: !pic.hidden, img: img.getAttribute('src') || '', anim: animate(), overflow: paper.scrollHeight > paper.clientHeight + 1, fits: (() => { const r = paper.getBoundingClientRect(), nr = q('.pn-nav').getBoundingClientRect(); return r.top >= -8 && nr.bottom <= innerHeight + 1 && r.left >= -8 && r.right <= innerWidth + 8 && nr.right <= innerWidth + 1; })() }),
  };
}
