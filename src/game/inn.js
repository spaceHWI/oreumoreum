// 숙소 오피스제주 O-Peace (#270): 가게 거리 7번 터의 2층 워케이션 호텔 (건물 src/inn.js, 수치 balance.js INN). 파일 순서는 shopgate 앞 (src/modules.js)
// - 창(가게 팝업 #shoppop 'inn'): [숙박하기 · 귤 값] (값 = base + 레벨 × perLv, 첫 숙박은 반값), 하루(한국 날짜)에 한 번. 버프 설명, [수사 보드] (사건 파일이 열렸으면)
// - 묵기: 앞마당에서 몸을 감추고(남에게도, room.js innExtra·innPeer) 5초쯤 연출(어두워짐 → zzz → 아침 햇살) → 기운 가득 + '개운함' INN.buffSec 초 + 기지개(동작 hop)
// - 개운함: 이동·줍기·피해(buff.js more → buff.mul)·최대 기운(place.js hp maxMul)·경험치(level.js watchCoins) × (1 + INN.buff[k]). 놀이 시간(접속 중)만 줄어듦, 쓰러져도 남음
//   위쪽 줄 레벨 곁에 작은 칸(#inn-pill: 침대 아이콘 + 남은 시간), 끝나기 INN.warnSec 초 전에 한 줄
// - 한 번 묵은 뒤로 다시 들어오면 '어디서 시작'(game/zonedone.js wake-pick)에 '오피스제주' (late.innWake)
// - 곁가지 퀘스트(QUESTS side i-stay·i-run): innStay 묵기, innRun 개운함 중 서바이벌 터 버팀(swarm.js late.onRunWin). 업적 b-inn-5 '단골 투숙객'(칭호)
// - 다음 할 일(game/nexthint.js): 기운이 낮고 오늘 안 묵었으면 '스톤에서 식사' 다음 차례로 '오피스제주에서 하룻밤' (late.innHint)
// - 저장 save.inn = { d: 마지막 묵은 날(KST 'YYYY-MM-DD'), n: 묵은 수, left: 개운함 남은 놀이 초 }. 옛 저장은 없음(묵은 적 없음)으로 시작. 서버 확인은 server/src/validate.js (값·하루 한 번·경험치)
// dev: __oreum.inn (state()·price()·open()·stay(free)·skip()·go()·left(s)·busy()·pill())
import { INN } from '../balance.js';
import { kstDate } from '../daily.js';
import { levelOf } from '../augments.js';
import { icon } from '../icons.js';
import { height } from '../world.js';
import { state, late } from './state.js';
import { $, save, persist } from './save.js';
import { shopsBuilt, player, hp, runner } from './place.js';
import { toast, updateStats, closePanels, ach, topFit } from './hud.js';
import { interactables, refreshShopPop } from './stores.js';
import { marker } from './input.js';
import { dismountRide, leaveCart } from './ride.js';

const SH = shopsBuilt.find((s) => s.id === 'inn') || null, A = SH?.api || null;
const isO = (v) => v && typeof v === 'object' && !Array.isArray(v);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
// 옛·깨진 기록 바로잡기 (없으면 그대로 없음)
function norm() {
  if (save.inn === undefined) return;
  const o = isO(save.inn) ? save.inn : {};
  save.inn = { d: typeof o.d === 'string' && DAY_RE.test(o.d) ? o.d : '', n: Number.isFinite(+o.n) ? Math.max(0, Math.min(1e6, Math.floor(+o.n))) : 0, left: Number.isFinite(+o.left) ? Math.max(0, Math.min(INN.buffSec, +o.left)) : 0 };
}
norm();
const I = () => save.inn || { d: '', n: 0, left: 0 };
const lvNow = () => { try { return levelOf(save.lv?.xp || 0).lv; } catch { return 1; } };
export const innPrice = () => Math.max(1, Math.round((INN.price.base + lvNow() * INN.price.perLv) * (I().n ? 1 : INN.price.first)));
const today = () => kstDate();
const stayedToday = () => I().d === today();
const on = () => I().left > 0;
const isOpen = () => !!A && late.shopOpen?.('inn') !== false;

/* ---------- 개운함: 배수 ---------- */
late.innMul = (k) => (on() && INN.buff[k] ? 1 + INN.buff[k] : 1);

/* ---------- 위쪽 줄 칸 (레벨 곁) ---------- */
const css = document.createElement('style');
css.textContent = `
/* 위쪽 줄 칸은 식사 버프(#buff-pill)와 같은 꼴 (#283, page.html 의 .bpill). 개운함만 하늘색 */
#inn-pill .ring svg.r .fg { stroke: #8fd3ff; } #inn-pill.end b { color: var(--acc); }
#inn-sleep { position: fixed; inset: 0; z-index: 40; pointer-events: none; display: grid; place-items: center; background: #0b1020; opacity: 0; transition: opacity .9s ease, background 1.2s ease; }
#inn-sleep.on { opacity: 1; }
#inn-sleep.sun { background: radial-gradient(ellipse at 70% 20%, #fff3c4 0%, #ffd28a 35%, #f6a560 70%, #c97a4a 100%); }
#inn-sleep .z { font: 900 46px/1 var(--display, sans-serif); color: #cfd8ff; letter-spacing: .08em; opacity: 0; transition: opacity .5s; text-shadow: 0 2px 12px rgba(120,140,255,.5); }
#inn-sleep .z i { display: inline-block; font-style: normal; animation: innZ 1.4s ease-in-out infinite; }
#inn-sleep .z i:nth-child(2) { animation-delay: .25s; font-size: .8em; } #inn-sleep .z i:nth-child(3) { animation-delay: .5s; font-size: .62em; }
#inn-sleep .m { position: absolute; bottom: 22%; left: 0; right: 0; text-align: center; font: 800 18px/1.4 var(--display, sans-serif); color: #fff; opacity: 0; transition: opacity .5s; text-shadow: 0 1px 6px rgba(0,0,0,.35); }
#inn-sleep.zz .z, #inn-sleep.sun .m { opacity: 1; }
@keyframes innZ { 0%, 100% { transform: translateY(0); opacity: .4; } 50% { transform: translateY(-10px); opacity: 1; } }
.inn-card { display: grid; gap: 10px; grid-column: 1 / -1; } /* #283 창 규격: 카드 한 장(값·하루 한 번·버프) + 아래 버튼 줄 */
.inn-card .io { display: grid; gap: 8px; padding: 12px 14px; border-radius: var(--card-r); background: var(--card-bg); }
.inn-card .io-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.inn-card .io-top b { font: 800 var(--btn-fs)/1.3 var(--display); }
.inn-card .io-sub { margin: 0; font-size: 12.5px; opacity: .72; }
.inn-card .ib { display: flex; flex-wrap: wrap; gap: 6px; }
.inn-card .ib span { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px 3px 6px; border-radius: 999px; background: rgba(143,211,255,.14); font: 800 12px var(--display); }
.inn-card .ib svg { width: 14px; height: 14px; flex: none; color: #8fd3ff; }
.inn-card small.note { opacity: .72; text-align: center; font-size: 12.5px; }
`;
document.head.appendChild(css);
const pill = document.createElement('div'); pill.className = 'panel tpill bpill'; pill.id = 'inn-pill'; pill.hidden = true; pill.setAttribute('role', 'button'); pill.tabIndex = 0;
pill.innerHTML = `<span class="ring"><svg class="r" viewBox="0 0 28 28"><circle class="bg" cx="14" cy="14" r="12"/><circle class="fg" cx="14" cy="14" r="12" stroke-dasharray="75.4" stroke-dashoffset="0"/></svg>${icon('bed').replace('<svg', '<svg class="ic"')}</span><b></b>`;
{ const bf = $('buff-pill'); if (bf) bf.after(pill); else $('topbar')?.querySelector('.tb-c')?.append(pill); } /* #288 버프 곁 */
const WORD = { speed: '이동', pick: '줍기', dmg: '피해', hp: '최대 기운', xp: '경험치' };
const BIC = { speed: 'speed', pick: 'pick', dmg: 'dmg', hp: 'hp', xp: 'star' }; /* icons.js */
const buffLine = () => Object.entries(INN.buff).map(([k, v]) => `${WORD[k]} +${Math.round(v * 100)}%`).join(' · ');
pill.title = `개운함 · ${buffLine()}`;
pill.addEventListener('click', () => toast(`개운함 · ${buffLine()} · ${fmt(I().left)} 남음`, 4));
const fmt = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
let pillKey = '';
function paintPill() {
  const show = on() && !state.cave;
  if (!show) { if (!pill.hidden) { pill.hidden = true; topFit.dirty(); } pillKey = ''; return; }
  const t = fmt(I().left); if (t === pillKey && !pill.hidden) return; pillKey = t;
  if (pill.hidden) { pill.hidden = false; topFit.dirty(); }
  pill.querySelector('b').textContent = t; pill.classList.toggle('end', I().left <= INN.warnSec);
  pill.querySelector('.fg').style.strokeDashoffset = String(75.4 * (1 - I().left / INN.buffSec));
}

/* ---------- 창 ---------- */
late.fillInn = (grid) => {
  const c = document.createElement('div'); c.className = 'inn-card';
  const p = innPrice(), done = stayedToday(), poor = save.coins < p, first = !I().n;
  c.innerHTML = `<div class="io"><div class="io-top"><b>하룻밤 묵으면 기운 가득</b><span class="price"><i></i>${p}</span></div>`
    + `<p class="io-sub">개운함 ${Math.round(INN.buffSec / 60)}분 · 하루에 한 번 · 놀이 시간으로 셈</p>`
    + `<div class="ib">${Object.entries(INN.buff).map(([k, v]) => `<span>${icon(BIC[k])}${WORD[k]} +${Math.round(v * 100)}%</span>`).join('')}</div></div>`
    + `<div class="win-acts"><button type="button" class="btn primary" id="inn-stay"${done || poor ? ' disabled' : ''}>${icon('bed')}${done ? '오늘은 묵었어요 · 내일 또 와요' : '숙박하기'}</button>`
    + (late.cases?.on ? `<button type="button" class="btn" id="inn-board">${icon('notes')}로비 책상 · 수사 보드</button>` : '') + '</div>'
    + (done || poor || first ? `<small class="note">${done ? '체크아웃은 내일 아침이에요. 마음만 먼저 두고 가요' : poor ? `귤이 ${p - save.coins}개 모자라요` : '첫 숙박은 반값이에요'}</small>` : '');
  grid.append(c);
  c.querySelector('#inn-stay')?.addEventListener('click', () => stay());
  c.querySelector('#inn-board')?.addEventListener('click', () => openBoard());
};
function openBoard() { closePanels(); late.cases?.file?.(); }

/* ---------- 묵기 ---------- */
const ov = document.createElement('div'); ov.id = 'inn-sleep'; ov.hidden = true; ov.innerHTML = '<div class="z"><i>z</i><i>z</i><i>z</i></div><div class="m"></div>';
document.body.append(ov);
let run = null; // { t, phase, paid }
late.innBusy = () => !!run;
const T = INN.sleep, TOTAL = T.dark + T.zzz + T.sun + T.out;
function stay(free = false) {
  if (!A || run) return false;
  if (!isOpen()) { toast(`준비 중 — ${late.shopWhy?.('inn') || ''} 열려요`); return false; }
  if (stayedToday() && !free) { toast('오늘은 이미 묵었어요 · 내일 또 와요'); return false; }
  if (state.cine || hp.isDown || late.tut?.active) return false;
  const p = free ? 0 : innPrice();
  if (save.coins < p) { toast(`귤이 ${p - save.coins}개 모자라요`); return false; }
  closePanels(); late.stopAutoGo?.(); if (player.riding) late.dismountDeer?.(); if (player.ride) dismountRide(); if (player.cart) leaveCart(false); if (player.pose === 'sit') late.standUp?.(); state.emo?.stop?.(); if (state.fishing?.active) state.fishing.stop();
  save.coins -= p; late.coinsSync?.(); updateStats(); late.sound?.coin?.();
  const o = save.inn = { ...I() }; o.d = today(); o.n = (o.n | 0) + 1; persist(); /* 값을 낸 것과 묵은 수는 같이 저장 (서버 validate.js 가 값을 셈) */
  run = { t: 0, t0: performance.now(), paid: p }; /* 연출 시간은 실제 시간 (느린 기기에서 프레임 dt 가 잘려도 5초는 5초) */ state.cine = run; player.target = null; player.onArrive = null; player.speed = 0; marker.visible = false;
  const d = A.door; player.pos.set(d.x, height(d.x, d.z), d.z); player.visY = player.pos.y; player.heading = A.rot + Math.PI; late.placeRunner?.();
  ov.querySelector('.m').textContent = INN.tag; ov.className = ''; ov.hidden = false; void ov.offsetWidth; ov.classList.add('on');
  late.net?.send?.(true);
  return true;
}
function wake() {
  const r = run; if (!r) return; run = null; if (state.cine === r) state.cine = null;
  runner.root.visible = true; ov.classList.remove('on', 'zz', 'sun'); setTimeout(() => { if (!run) ov.hidden = true; }, 950);
  const o = save.inn; o.left = INN.buffSec; persist();
  hp.set(hp.max); warned = false; paintPill();
  ach.emit('inn-stay'); late.questEv?.('innStay');
  toast(`개운해요! · ${buffLine()} · ${Math.round(INN.buffSec / 60)}분`, 5, 'get');
  setTimeout(() => state.emo?.perform?.('hop'), 300); /* 기지개 */
  late.net?.send?.(true);
}
function tickRun(dt) {
  const r = run; if (!r) return;
  if (state.cine !== r) { run = null; runner.root.visible = true; ov.classList.remove('on', 'zz', 'sun'); ov.hidden = true; return; } /* 다른 장면이 가로챔: 버프 없이 끝(값은 낸 채) — 드묾 */
  r.t = Math.max(r.t, (performance.now() - r.t0) / 1000); runner.root.visible = r.t < T.dark * 0.8;
  if (r.t > T.dark && !ov.classList.contains('zz')) ov.classList.add('zz');
  if (r.t > T.dark + T.zzz && !ov.classList.contains('sun')) { ov.classList.remove('zz'); ov.classList.add('sun'); }
  if (r.t > T.dark + T.zzz + T.sun && ov.classList.contains('on')) ov.classList.remove('on');
  if (r.t >= TOTAL) wake();
}

/* ---------- 남의 화면 (room.js) ---------- */
late.innExtra = () => (run ? { inn: 1 } : {});
late.innPeer = (e) => {
  if (e.data?.inn === 1) { e.runner.root.scale.setScalar(0.001); e.innS = 1; return { pose: 'move', still: true }; }
  if (e.innS) { e.runner.root.scale.setScalar(1); e.innS = 0; }
  return null;
};

/* ---------- 시간 ---------- */
let last = 0, saveT = 0, warned = false;
late.tickInn = (dt) => {
  tickRun(dt);
  const t = performance.now(), rdt = last ? Math.min(1, (t - last) / 1000) : 0; last = t; /* 실제 흐른 시간 (탭이 숨었던 동안은 빼고) */
  const o = save.inn;
  if (o && o.left > 0 && state.sessionOn && !run) {
    o.left = Math.max(0, o.left - rdt); saveT += rdt;
    if (!warned && o.left <= INN.warnSec && o.left > 0) { warned = true; toast(`개운함이 ${Math.round(INN.warnSec / 60)}분 남았어요`); }
    if (o.left <= 0) { o.left = 0; persist(); hp.set(Math.min(hp.hp, hp.max)); toast('개운함이 끝났어요 · 오늘 밤도 오피스제주'); }
    else if (saveT > 5) { saveT = 0; persist(); }
  }
  if (o && o.left > INN.warnSec) warned = false;
  paintPill();
};

/* ---------- 상호작용: 야외 업무 책상 '수사 보드' ---------- */
if (A) interactables.push({ label: '수사 보드', ic: 'notes', pos: A.desk, r: 2.2, when: () => isOpen() && !!late.cases?.on && !run && !late.tut?.active, act: openBoard });

/* ---------- 어디서 시작 (zonedone.js) ---------- */
late.innWake = () => (A && (I().n | 0) > 0 && isOpen() ? { x: A.door.x, z: A.door.z, h: A.rot + Math.PI } : null);

/* ---------- 다음 할 일 (nexthint.js): 기운이 낮고 오늘 안 묵었으면 ---------- */
late.innHint = (low) => {
  if (!low || !isOpen() || stayedToday() || on() || save.coins < innPrice()) return null;
  return { k: 'inn', text: '오피스제주에서 하룻밤', prog: '', mark: 'tmp', pos: () => A.door.clone(), near: Math.max(1.5, INN.r * 0.6), arrive: () => late.openShopPop?.('inn') };
};

/* ---------- 곁가지 퀘스트: 개운함 중 서바이벌 터 버팀 ---------- */
{ const prev = late.onRunWin; late.onRunWin = (z) => { prev?.(z); if (on()) late.questEv?.('innRun'); }; }

/* ---------- 확인용 (window.__oreum.inn) ---------- */
late.innApi = {
  state: () => ({ inn: save.inn ? { ...save.inn } : null, on: on(), today: stayedToday(), price: innPrice(), open: isOpen(), busy: !!run, phase: run ? (ov.classList.contains('sun') ? 'sun' : ov.classList.contains('zz') ? 'zzz' : 'dark') : '', pill: !pill.hidden && pill.querySelector('b').textContent, mul: Object.fromEntries(Object.keys(INN.buff).map((k) => [k, late.innMul(k)])), hidden: !runner.root.visible, net: late.innExtra() }),
  price: innPrice, open: () => late.openShopPop?.('inn'), stay, skip: () => { if (run) { run.t0 = -1e9; tickRun(0); } }, busy: () => !!run,
  go: () => { if (!A) return null; const d = A.door; player.pos.set(d.x, height(d.x, d.z), d.z); player.visY = player.pos.y; player.heading = A.rot + Math.PI; late.placeRunner?.(); return { x: +d.x.toFixed(1), z: +d.z.toFixed(1) }; },
  left: (s) => { if (!save.inn) save.inn = { d: '', n: 0, left: 0 }; save.inn.left = Math.max(0, Math.min(INN.buffSec, +s || 0)); if (save.inn.left > INN.warnSec) warned = false; persist(); paintPill(); },
  peer: (e) => late.innPeer(e), day: (d) => { if (save.inn) { save.inn.d = d; persist(); } }, api: A, shop: SH, refresh: () => refreshShopPop(),
};
