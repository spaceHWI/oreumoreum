// 메뉴 설정을 버튼·스위치·칸 묶음으로 (#201). 글씨 줄만 있던 설정 항목을 모양으로 구분한다
// - 켜고 끄는 것(aria-pressed 가 있는 버튼)은 스위치: 앞에 아이콘, 이름, 오른쪽 스위치(켜짐 = 귤색)
// - 여럿 중 고르는 것(그래픽·성능·비 효과·영상 모양)은 칸 묶음: 주인 파일이 optSeg 로 그림 (debug.js·rec.js)
// - 창을 여는 것(이름 바꾸기·조작법·릴리스 노트 …)은 버튼 + › , 배경 음악 크기는 슬라이더
// 묶음(소리·화면·조작·함께·촬영·계정)으로 나눠 '설정' 아래에 둔다. 다른 파일이 나중에 .m-more 에 붙이는 버튼(혼잣말·오름 방송 등)도
// 지켜보다가 제 묶음으로 옮기고 같은 모양으로 그린다. 주인 파일은 예전처럼 textContent('이름: 켬')·aria-pressed 만 바꾸면 됨
import { $ } from './save.js';
import { icon } from '../icons.js';

const GROUPS = [
  ['sound', '소리', ['menu-sound', 'menu-music', 'music-vol', 'menu-radio']],
  ['screen', '화면', ['menu-gfx', 'menu-perf', 'menu-simple', 'menu-fs', 'menu-rainfx', 'menu-calmfx', 'menu-boxview', 'menu-fightcam']],
  ['ctl', '조작', ['menu-tips', 'menu-vib', 'menu-stick', 'menu-help']],
  ['with', '함께', ['menu-mates', 'menu-gift', 'menu-mutter']],
  ['rec', '촬영', ['menu-rec', 'rec-shape', 'rec-snd', 'rec-wm', 'rec-buf']],
  ['acct', '계정·정보', ['menu-nick', 'm-guest', 'm-acct', 'menu-fshow', 'menu-notes', 'menu-dev']],
];
const OTHER = 'ctl'; // 표에 없는 새 버튼이 들어갈 묶음
const ICON = {
  'menu-sound': 'sound', 'menu-music': 'music', 'menu-radio': 'radio',
  'menu-gfx': 'sunrise', 'menu-perf': 'speed', 'menu-simple': 'minimize', 'menu-fs': 'maximize', 'menu-rainfx': 'rain', 'menu-calmfx': 'wind', 'menu-boxview': 'eye', 'menu-fightcam': 'maximize',
  'menu-tips': 'tips', 'menu-vib': 'hand', 'menu-stick': 'walk', 'menu-help': 'walk',
  'menu-mates': 'together', 'menu-gift': 'gift', 'menu-mutter': 'chat',
  'menu-rec': 'photo', 'rec-shape': 'maximize', 'rec-snd': 'sound', 'rec-wm': 'star', 'rec-buf': 'reel',
  'menu-nick': 'emote', 'menu-fshow': 'maximize', 'menu-notes': 'notes', 'menu-dev': 'tools',
};
// 글자에서 이름을 따오지 않는 것 (켬·끔이 이름에 없거나 뜻이 뒤집힌 것)
const LABEL = { 'menu-sound': '소리', 'menu-music': '배경 음악', 'menu-tips': '팁 보기', 'menu-fs': '전체 화면', 'menu-calmfx': '화면 효과 줄이기', 'menu-gift': '귤 선물 받기', 'menu-rec': '촬영 모드', 'menu-simple': '화면 단순하게', 'menu-fshow': '전체 화면으로 하는 법', 'menu-fightcam': '전투 때 멀어지기' };
const GO = new Set(['menu-nick', 'menu-help', 'menu-fshow', 'menu-notes', 'menu-dev']);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const CSS = `
#menu .m-more { --opt-h: 44px; }
#menu.more .m-more, #menu .m-more.opt-on { display: none; }
#menu.more .m-more.opt-on { display: grid !important; grid-template-columns: 1fr; align-items: start; gap: 10px; width: 100%; max-height: min(56vh, 520px); overflow-y: auto; overscroll-behavior: contain; padding: 2px; }
#menu .opt-g { display: grid; gap: 4px; padding: 8px; border-radius: 16px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); align-content: start; }
#menu .opt-g[hidden] { display: none !important; }
#menu .opt-g h4 { margin: 0 4px 2px; font: 800 11px/1.2 var(--body); letter-spacing: .04em; color: var(--ink-soft); }
#menu .opt-g .opt { display: flex !important; align-items: center; gap: 10px; width: 100%; min-height: var(--opt-h); padding: 6px 10px !important; border: 1px solid var(--hair) !important; border-radius: 12px !important; background: rgba(255,255,255,.08) !important; color: #fff !important; font: 600 14px/1.2 var(--body) !important; text-align: left; justify-content: flex-start !important; white-space: normal; cursor: pointer; transition: transform .08s, background .15s; box-sizing: border-box; }
#menu .opt-g button.opt:hover { background: rgba(255,255,255,.14) !important; }
#menu .opt-g button.opt:active { transform: scale(.98); background: rgba(255,255,255,.2) !important; }
#menu .opt-g .opt[hidden] { display: none !important; }
#menu .opt-g .opt > svg, #menu .opt-g .opt > img { flex: none; display: block !important; width: 20px !important; height: 20px !important; opacity: .85; }
#menu .opt-g .opt .ol { flex: 1 1 auto; min-width: 0; }
#menu .opt-g .opt .ol small { display: block; font-size: 11px; font-weight: 500; color: var(--ink-soft); margin-top: 1px; }
#menu .opt .sw { flex: none; position: relative; width: 40px; height: 24px; border-radius: 12px; background: rgba(255,255,255,.22); transition: background .15s; }
#menu .opt .sw::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.35); transition: transform .15s; }
#menu .opt[aria-pressed="true"] .sw { background: var(--acc); }
#menu .opt[aria-pressed="true"] .sw::after { transform: translateX(16px); }
#menu .opt[aria-pressed="true"] > svg { color: var(--acc); opacity: 1; }
#menu .opt .go { flex: none; font-style: normal; font-size: 20px; line-height: 1; opacity: .6; }
#menu .opt.seg { flex-wrap: wrap; cursor: default; }
#menu .opt.seg .seg-b { flex: 1 1 100%; display: flex; gap: 0; padding: 2px; border-radius: 10px; background: rgba(0,0,0,.25); }
#menu .opt.seg .seg-b button { flex: 1 1 0; min-width: 0; min-height: 36px; padding: 4px 6px !important; border: 0 !important; border-radius: 8px !important; background: transparent !important; color: var(--ink-soft); font: 700 13px/1.1 var(--body) !important; justify-content: center !important; white-space: nowrap; transition: background .15s, color .15s; }
#menu .opt.seg .seg-b button:hover { color: #fff; }
#menu .opt.seg .seg-b button[aria-pressed="true"] { background: var(--acc) !important; color: var(--acc-fg); }
#menu .opt-range { display: flex; align-items: center; gap: 10px; min-height: 36px; padding: 0 10px 0 40px; }
#menu .opt-range input { flex: 1 1 auto; }
#menu .opt-g .m-acct { padding: 4px 2px; }
#menu .opt-g .m-acct button { min-height: var(--opt-h); border: 1px solid var(--hair) !important; border-radius: 12px !important; background: rgba(255,255,255,.08) !important; font-weight: 700 !important; }
#menu .opt-g .m-acct button:active { transform: scale(.98); }
#menu .opt-g #acct-del { border-color: rgba(255,110,96,.55) !important; background: rgba(214,58,46,.22) !important; color: #ffd6d1; }
#menu-more[aria-expanded="true"] { background: var(--acc) !important; color: var(--acc-fg) !important; }
@media (min-width: 601px) {
  #menu.opt-menu { width: min(820px, calc(100vw - 32px)); max-width: none; }
  #menu.opt-menu .tiles { display: grid !important; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: 6px; width: 100%; }
  #menu.opt-menu .tiles button { display: grid; justify-items: center; align-content: center; gap: 5px; min-height: 64px; padding: 10px 4px 8px !important; border: 1px solid var(--hair); border-radius: 14px; background: rgba(255,255,255,.08); font: 600 13px/1.1 var(--body); position: relative; white-space: nowrap; transition: transform .08s, background .15s; }
  #menu.opt-menu .tiles button:hover { background: rgba(255,255,255,.15); }
  #menu.opt-menu .tiles button:active { transform: scale(.97); }
  #menu.opt-menu .tiles button[hidden] { display: none !important; }
  #menu.opt-menu .tiles svg { display: block !important; width: 22px; height: 22px; }
  #menu.opt-menu .tiles .dot { position: absolute; top: 8px; right: calc(50% - 20px); width: 8px; height: 8px; border-radius: 50%; background: var(--acc); }
  #menu.opt-menu #menu-more { display: grid !important; }
  #menu.more .m-more.opt-on { grid-template-columns: repeat(3, 1fr); max-height: min(52vh, 480px); }
}
@media (max-width: 600px) { #menu.more .m-more.opt-on { max-height: none; overflow: visible; } #menu.opt-menu { max-height: calc(100dvh - var(--safe-t, 0px) - 12px); overflow-y: auto; overscroll-behavior: contain; } }
`;

const groupOf = new Map(); for (const [g, , ids] of GROUPS) for (const id of ids) groupOf.set(id, g);
groupOf.set('opt-music-vol', 'sound');
const kindOf = (b) => (b.classList.contains('seg') ? 'seg' : GO.has(b.id) ? 'go' : b.hasAttribute('aria-pressed') ? 'sw' : 'go');

// 버튼 하나를 줄 모양으로: [아이콘] 이름 [스위치 | ›]. 주인이 textContent 를 바꾸면(.ol 이 없어짐) 다시 그림
function render(b) {
  if (b.tagName !== 'BUTTON' || b.querySelector(':scope > .ol')) return;
  const kind = kindOf(b), raw = (b.textContent || '').trim(); let sub = raw.includes(':') ? raw.split(':').slice(1).join(':').trim() : '';
  const label = LABEL[b.id] || raw.split(':')[0].trim() || b.getAttribute('aria-label') || '';
  b.classList.add('opt', kind);
  if (b.id === 'menu-fs' && /홈 화면/.test(raw)) sub = '홈 화면에 추가';
  const more = kind === 'go' || /켬|끔|받음|줄임|보통$/.test(sub) || (LABEL[b.id] && b.id !== 'menu-fs') ? '' : sub; // 켬·끔은 스위치가 보여 줌. 그 밖의 값만 작게
  b.innerHTML = (ICON[b.id] ? icon(ICON[b.id]) : '') + `<span class="ol">${esc(label)}${more ? `<small>${esc(more)}</small>` : ''}</span>` + (kind === 'sw' ? '<i class="sw" aria-hidden="true"></i>' : '<i class="go" aria-hidden="true">›</i>');
  if (kind === 'sw') { b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', b.getAttribute('aria-pressed') || 'false'); }
}

// 여럿 중 고르기 (주인 파일이 부름). el: <div class="opt seg" data-label> · items [[값, 이름]] · cur 지금 값 · pick(값)
export function optSeg(el, items, cur, pick, sub = '') {
  if (!el) return;
  el.classList.add('opt', 'seg');
  const key = items.map((x) => String(x[0]) + '=' + x[1]).join('|');
  let box = el.querySelector('.seg-b');
  if (!box || el._segKey !== key) {
    el._segKey = key; el._segPick = pick;
    const label = el.dataset.label || '';
    el.innerHTML = (ICON[el.id] ? icon(ICON[el.id]) : '') + `<span class="ol">${esc(label)}</span><span class="seg-b" role="radiogroup" aria-label="${esc(label)}"></span>`;
    box = el.querySelector('.seg-b');
    items.forEach(([v, name], i) => {
      const s = document.createElement('button'); s.type = 'button'; s.dataset.i = String(i); s.textContent = name; s.setAttribute('role', 'radio');
      s.addEventListener('click', (e) => { e.stopPropagation(); el._segPick?.(items[i][0]); });
      box.append(s);
    });
  }
  el._segPick = pick;
  { const ol = el.querySelector('.ol'), t = (el.dataset.label || '') + (sub ? '\u0000' + sub : ''); if (ol && ol.dataset.t !== t) { ol.dataset.t = t; ol.innerHTML = esc(el.dataset.label || '') + (sub ? `<small>${esc(sub)}</small>` : ''); } }
  box.querySelectorAll('button').forEach((s) => { const on = String(items[+s.dataset.i][0]) === String(cur); s.setAttribute('aria-pressed', String(on)); s.setAttribute('aria-checked', String(on)); });
}

// ---------- 묶음 만들기 ----------
const menu = $('menu'), more = menu?.querySelector('.m-more');
if (menu && more) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
  menu.classList.add('opt-menu'); more.classList.add('opt-on');
  const box = {};
  for (const [g, name] of GROUPS) { const s = document.createElement('section'); s.className = 'opt-g'; s.dataset.g = g; s.innerHTML = `<h4>${esc(name)}</h4>`; box[g] = s; }
  // 소리·팁은 바둑판에서 설정으로 (켜고 끄는 것은 스위치로, #201). 배경 음악 크기는 그 아래 슬라이더 줄
  const mv = $('music-vol'); let range = null;
  if (mv) { range = document.createElement('div'); range.className = 'opt-range'; range.id = 'opt-music-vol'; range.append(mv); }
  const place = (el) => {
    if (!el || el.parentElement?.classList.contains('opt-g')) return;
    const g = box[groupOf.get(el.id) || OTHER];
    // 표 순서대로 끼움 (표에 없는 것은 묶음 끝)
    const ids = GROUPS.find((x) => x[0] === g.dataset.g)[2], i = ids.indexOf(el.id);
    const after = i < 0 ? null : [...g.children].find((c) => { const j = ids.indexOf(c.id === 'opt-music-vol' ? 'music-vol' : c.id); return j > i; });
    g.insertBefore(el, after || null);
    if (el.tagName === 'BUTTON') render(el);
  };
  for (const id of ['menu-sound', 'menu-music', 'menu-tips', 'm-guest', 'm-acct']) place($(id));
  if (range) place(range);
  for (const el of [...more.children]) place(el);
  for (const [g] of GROUPS) more.append(box[g]);
  $('menu-more')?.classList.remove('ph'); // 데스크톱도 '설정' 버튼으로 엶
  menu.querySelector('.m-music')?.remove();
  // 묶음 안 버튼이 다 숨으면 묶음도 숨김
  const fitGroups = () => { for (const s of Object.values(box)) { const any = [...s.children].some((c) => c.tagName !== 'H4' && !c.hidden); if (s.hidden === any) s.hidden = !any; } };
  fitGroups();
  // 주인 파일이 글자를 바꾸거나(다시 그림), 새 버튼을 붙이거나(제 묶음으로), 켬·끔·숨김을 바꾸면(스위치·묶음) 따라감
  new MutationObserver((recs) => {
    for (const r of recs) {
      const t = r.target.nodeType === 3 ? r.target.parentElement : r.target;
      if (r.type === 'childList' && t === more) { for (const n of r.addedNodes) if (n.nodeType === 1 && !n.classList.contains('opt-g')) place(n); continue; }
      const b = t?.closest?.('button.opt, .m-more button'); if (!b || b.closest('.seg-b')) continue;
      if (r.type === 'attributes' && r.attributeName === 'aria-pressed') { if (b.getAttribute('role') === 'switch') b.setAttribute('aria-checked', b.getAttribute('aria-pressed') || 'false'); continue; }
      if (r.type === 'childList' || r.type === 'characterData') render(b);
    }
    fitGroups();
  }).observe(more, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-pressed', 'hidden'] });
  // 설정 버튼은 열림 상태를 보여 줌
  const mb = $('menu-more');
  if (mb) { const sync = () => mb.setAttribute('aria-expanded', String(menu.classList.contains('more'))); sync(); new MutationObserver(sync).observe(menu, { attributes: true, attributeFilter: ['class'] }); }
}
