// 메시지 줄 (#252): 화면에 띄우는 글은 모두 여기 한 길 msg(kind, text, opt) 로. 옛 토스트(hud.js toast)·줍기 한 줄·상황 팁·업적 배너·구역 이름·감독 한 줄이 이것을 부른다
// - 로그: 위쪽 줄(과 퀘스트 추적 줄·고정 한 줄·방송 띠·떼/우두머리 띠) 바로 아래, 같은 모양 한 줄 칸이 아래로 쌓임. 새 것이 아래, 오래된 것부터 흐려지며 사라짐. 최대 MSG.max 줄
// - 고정 한 줄(#msg-pin): '지금 꼭 봐야 하는 것' (서바이벌 터 밖 카운트다운 등). opt.pin. 튜토리얼 안내(#tut-toast)가 떠 있으면 그것이 이 자리를 쓰고 고정 줄은 쉼(튜토리얼 우선)
// - 대사 창·증강 고르기·사건 장면 중에는 로그를 감추고, 끝나면 밀린 것 중 최근 MSG.max 개만 다시 보여 줌
// kind: 'get' 얻음·'info' 알림·'warn' 경고·'multi' 멀티. opt: { sec, key(같은 key 면 합침), n(합칠 때 더하는 수), fmt(n → 글), icon(왼쪽 아이콘 html), click, fx('big' 짧은 강조), own(감독 글), long(sec 상한 없이) }
// 돌려주는 것: 줄 element 의 글 칸(span). 타자 효과(talkfx.js)가 여기에 씀
// dev: __oreum.msg(kind, text, opt)·__oreum.msglog.state()
import { MSG } from '../balance.js';
import { state, late } from './state.js';

const KIND_ICON = {
  get: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="7.5" fill="#ff9a1f"/><path d="M12 5.5c.6-1.8 2.2-2.6 3.8-2.4-.4 1.6-1.8 2.6-3.8 2.4z" fill="#6fae3c"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.2"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="#ffcf3f" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2v.2"/></svg>',
  multi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" aria-hidden="true"><circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.6-3.4 2.8-5 5.5-5s4.9 1.6 5.5 5"/><circle cx="16.8" cy="9.5" r="2.6"/><path d="M15.5 14.2c2.6-.2 4.5 1.3 5 4.3"/></svg>',
};

const st = document.createElement('style');
st.textContent = `
#msg-log, #msg-pin { position: fixed; z-index: 8; left: var(--tb-l, 12px); top: calc(var(--tb-top, 12px) + var(--tb-h, 36px) + 10px); width: min(380px, calc(100vw - var(--tb-l, 12px) * 2)); pointer-events: none; }
#msg-log { display: flex; flex-direction: column; align-items: flex-start; gap: ${MSG.gap}px; }
#msg-log[hidden], #msg-pin[hidden] { display: none; }
.msg-l { box-sizing: border-box; display: flex; align-items: center; gap: 7px; max-width: 100%; height: ${MSG.h}px; padding: 0 12px 0 7px; border-radius: ${MSG.h / 2}px; border: 1px solid var(--hair); background: var(--glass); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); color: var(--ink); font: 700 13.5px/1 var(--body); white-space: nowrap; transition: opacity .4s, transform .4s; animation: msgIn .25s ease-out; }
.msg-l > i { flex: none; width: 20px; height: 20px; display: grid; place-items: center; font-style: normal; }
.msg-l > i svg { width: 18px; height: 18px; display: block; }
.msg-l > i .pf { width: 22px !important; height: 22px !important; margin: 0 !important; }
.msg-l > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.msg-l > b { flex: none; font: 800 12px/1 var(--body); color: var(--gyul, #ff9a1f); }
.msg-l.warn { border-color: rgba(255,207,63,.55); }
.msg-l.go { pointer-events: auto; cursor: pointer; }
.msg-l.go::after { content: '›'; flex: none; margin-left: 2px; font-weight: 900; opacity: .7; }
.msg-l.out { opacity: 0; transform: translateY(-6px); }
.msg-l.big { animation: msgBig .6s cubic-bezier(.2,1.6,.4,1); border-color: rgba(255,170,60,.8); }
@keyframes msgIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes msgBig { 0% { transform: scale(.7); opacity: 0; } 60% { transform: scale(1.12); opacity: 1; } 100% { transform: none; } }
#tut-toast { left: var(--tb-l, 12px) !important; transform: none !important; max-width: min(380px, calc(100vw - var(--tb-l, 12px) * 2)); }
body:has(#intro:not([hidden])) :is(#msg-log, #msg-pin) { visibility: hidden !important; }
@media (max-width: 600px) { .msg-l { font-size: 13px; } }
@media (prefers-reduced-motion: reduce) { .msg-l, .msg-l.big { animation: none; } }
`;
document.head.appendChild(st);
const logEl = document.createElement('div'); logEl.id = 'msg-log'; logEl.setAttribute('role', 'status'); logEl.setAttribute('aria-live', 'polite');
const pinEl = document.createElement('div'); pinEl.id = 'msg-pin'; pinEl.hidden = true; pinEl.setAttribute('role', 'alert');
document.body.append(logEl, pinEl);

const lines = []; // { el, sp, kind, text, key, n, t, sec, own, out }
let pin = null; // { el, sp, key, t }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const one = (s) => String(s ?? '').replace(/\s*\n\s*/g, ' ').trim(); // 두 줄 글은 한 줄로 (넘치면 CSS 가 … 로 자름)
const secOf = (text, opt) => { const s = opt.sec ?? (MSG.min + one(text).length * MSG.perChar); return opt.long ? Math.max(MSG.min, s) : Math.min(MSG.maxSec, Math.max(MSG.min, s)); };

function build(kind, text, opt, cls = '') {
  const el = document.createElement('div'); el.className = `msg-l ${kind} ${cls}`.trim();
  el.innerHTML = `<i>${opt.icon || KIND_ICON[kind] || KIND_ICON.info}</i><span>${esc(one(text))}</span><b hidden></b>`;
  if (opt.click) { el.classList.add('go'); el.addEventListener('click', () => { drop(lines.find((l) => l.el === el)); opt.click(); }); }
  if (opt.fx === 'big') el.classList.add('big');
  return el;
}
function drop(l) { if (!l || l.out) return; l.out = true; l.el.classList.add('out'); setTimeout(() => l.el.remove(), 420); const i = lines.indexOf(l); if (i >= 0) lines.splice(i, 1); l.done?.(); }
const live = () => lines.filter((l) => !l.out);

export function msg(kind = 'info', text = '', opt = {}) {
  if (!text && !opt.fmt) return null;
  if (opt.pin) return pinMsg(kind, text, opt);
  const key = opt.key || kind + ':' + one(text), last = lines[lines.length - 1];
  if (last && !last.out && last.key === key) { /* 같은 글이 잇달아: 줄을 늘리지 않고 합침 */
    last.n += opt.n ?? 1; last.sec = secOf(text, opt); last.t = last.sec;
    if (opt.fmt) last.sp.textContent = one(opt.fmt(last.n)); else { const b = last.el.querySelector('b'); b.hidden = false; b.textContent = '×' + last.n; }
    return last.sp;
  }
  const n = opt.n ?? 1, el = build(kind, opt.fmt ? opt.fmt(n) : text, opt);
  const l = { el, sp: el.querySelector('span'), kind, text: one(text), key, n, sec: secOf(text, opt), own: !!opt.own, out: false, done: opt.done };
  l.t = l.sec; lines.push(l); logEl.append(el);
  while (live().length > MSG.max) drop(live()[0]); /* 넘치면 가장 오래된 것부터 */
  layT = 0; /* 다음 프레임에 자리 다시 */
  return l.sp;
}
function pinMsg(kind, text, opt) {
  const key = opt.key || kind;
  if (!pin || pin.key !== key) { pinEl.innerHTML = ''; const el = build(kind, text, opt); pinEl.append(el); pin = { el, sp: el.querySelector('span'), key, t: 0 }; }
  else pin.sp.textContent = one(text);
  pin.t = opt.sec ?? MSG.min; return pin.sp;
}
export function unpin(key) { if (pin && (!key || pin.key === key)) { pin = null; pinEl.innerHTML = ''; } }

/* 대사 창·증강 고르기·사건 장면 중에는 감춤 */
const HOLD = ['aug-pick', 'quest', 'mate-talk', 'wake-pick', 'zdone'];
const held = () => !!state.cine || HOLD.some((id) => { const e = document.getElementById(id); return e && !e.hidden; }) || !!late.msgHold?.();
let wasHeld = false, layT = 0;

/* 자리: 위쪽 줄 → 퀘스트 추적 줄 → (튜토리얼 안내 | 고정 한 줄) → 방송 띠·떼/우두머리 띠 → 로그. 겹치는 것만 아래로 밀기 */
const STACK = ['quest-track', 'radio-strip', 'swarm-bar', 'boss-bar', 'raid-bar', 'newver'];
function layout() {
  const tb = document.getElementById('topbar'), r0 = logEl.getBoundingClientRect(); let y = (tb?.getBoundingClientRect().bottom || 48) + 8;
  const L = r0.left || 12, R = L + (r0.width || 360);
  const below = (el) => { if (!el || el.hidden) return; const b = el.getBoundingClientRect(); if (!b.height || b.right < L || b.left > R || b.top > y + 120) return; y = Math.max(y, b.bottom + MSG.gap + 2); };
  below(document.getElementById('quest-track'));
  const tt = document.getElementById('tut-toast'), tutOn = !!tt && !tt.hidden;
  if (tutOn) { setTop(tt, y); y += tt.offsetHeight + MSG.gap + 2; }
  pinEl.hidden = !pin || tutOn; /* 둘이면 튜토리얼 우선 */
  if (!pinEl.hidden) { setTop(pinEl, y); y += MSG.h + MSG.gap + 2; }
  for (const id of STACK.slice(1)) below(document.getElementById(id));
  setTop(logEl, y);
}
function setTop(el, y) { const t = Math.round(y) + 'px'; if (el.style.top !== t) el.style.top = t; } /* 같은 값이면 안 씀 (지켜보기가 다시 부르지 않게) */

/* 위 칸이 나타나거나 바뀌면 바로 자리 다시 (느린 기기에서 프레임을 기다리지 않게) */
const mo = new MutationObserver(() => layout()); let moSeen = '';
function watch() { const ids = ['topbar', 'tut-toast', ...STACK].filter((id) => document.getElementById(id)); const k = ids.join(); if (k === moSeen) return; moSeen = k; mo.disconnect(); for (const id of ids) mo.observe(document.getElementById(id), { attributes: true, attributeFilter: ['hidden', 'style', 'class'] }); }
export function tickMsg(dt) {
  state.ticks.msg = (state.ticks.msg || 0) + 1;
  const h = held();
  if (h) { if (!wasHeld) { wasHeld = true; logEl.hidden = true; } }
  else {
    if (wasHeld) { wasHeld = false; logEl.hidden = false; live().forEach((l) => { l.t = l.sec; }); } /* 밀린 것 중 최근 MSG.max 개(넘친 것은 이미 빠짐), 시간은 처음부터 */
    let prev = 0;
    for (const l of live()) { l.t -= dt; if (l.t < prev) l.t = prev; prev = l.t + 0.01; } /* 오래된 것이 먼저 사라지게 */
    const first = live()[0]; if (first && first.t <= 0) drop(first);
  }
  if (pin && (pin.t -= dt) <= 0) unpin();
  if ((layT -= dt) <= 0) { layT = 0.1; watch(); layout(); }
}

/* 감독(director.js)이 '다른 글이 떠 있나' 볼 때: 줍기·얻음 줄은 셈하지 않음 */
export const msgBusy = () => live().some((l) => !l.own && l.kind !== 'get');
export const msgLog = {
  state: () => ({ held: held(), pin: pin ? { key: pin.key, text: pin.sp.textContent } : null, lines: live().map((l) => ({ kind: l.kind, text: l.sp.textContent + (l.n > 1 && !l.el.querySelector('b').hidden ? ' ×' + l.n : ''), t: +l.t.toFixed(2), own: l.own })) }),
  clear() { lines.slice().forEach(drop); unpin(); },
  unpin, /* 고정 한 줄 걷기 (swarm.js 터 밖 → 돌아옴, #266) */
  last: () => live().slice(-1)[0]?.sp.textContent || '',
  count: () => live().length,
  drop: (sp) => drop(lines.find((l) => l.sp === sp)), /* 줄 하나 지우기 (msg 가 돌려준 span) */
};
late.msg = msg; late.msgLog = msgLog;
