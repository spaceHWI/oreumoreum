// 오름펑크 세계 (#165): 오름 방송·읽을 수 있는 쪽지·이름 장난 칭호. 글은 src/punktext.js, 수치는 balance.js PUNK. 파일 순서는 story 뒤 (src/modules.js). #164 아이템은 game/punk.js
// 1. 오름 방송: 들머리·가게 거리 스피커 기둥(코드 모델). 감독 문 'radio' 가 열리면 PUNK.radio.every 초마다 '딩동댕' 뒤 이장님 방송이 위쪽 자막 띠로
//    스피커 PUNK.radio.r m 안에서만. 감독(kind 'radio', 우선순위 맨 뒤·싸움 중엔 안 나옴)을 거침. 상황(구역 완료·우두머리·비·자정)은 다음 방송에 먼저, 멀티는 이름(safeNick 거친 것)
//    메뉴 설정 '오름 방송' 켜기·끄기 (save.punk.radio)
// 2. 쪽지: 쓰레기를 주울 때 PUNK.note.p 로 그 구역 쪽지 한 장(쓰레기 수·귤은 그대로). 쪽지 창을 띄움, 싸우는 중·창이 열려 있으면 왼쪽 위 쪽지 표시만(누르면 열림). 창(종이·넘기기)은 game/noteview.js (#199)
//    도감 '주운 쪽지' 칸(late.dexExtra 를 감쌈, 누르면 다시 읽기). 다 모으면 업적 b-notes
// 3. 칭호: 업적(achievements.js BADGES)을 따면 열림(TITLES.badge). 업적 창 [칭호] 에서 하나 골라 이름표 위에 (save.punk.title, -1 은 안 닮)
//    멀티: net.js 가 옷 묶음(#115)과 같이 tt 로 바뀔 때만 보냄, 서버 roomcore 는 범위만 봄. 감독 문 'title'(구역 3) 이 열리면 소개 한 줄
//    새 사건: boar-stare(멧돼지 앞 10초)·trash-day-500(하루 500개)·quest-boss1(퀘스트 '구역의 주인')·note-all. 까마귀·하르방(#163)은 그 기능이 ach.emit 으로 냄
// 저장 save.punk = { title, notes {id: 주운 때}, unread [id], radio 1|0, day {d, n}, ev {한 번만 낸 사건} }
// dev: __oreum.punkWorld (__oreum.punk 은 #164 아이템)
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gradHard } from '../toon.js';
import { height } from '../world.js';
import { nsAlong } from '../namsongi.js';
import { STREET } from '../streetlayout.js';
import { PUNK, TUT, SHOP_ST, NET, OUTFIT_SETS } from '../balance.js';
import { RADIO, RADIO_SITU, NOTES, TITLES } from '../punktext.js';
import { BADGES, kstDate } from '../achievements.js';
import { BADGE_ICONS, iconSvg } from '../badgeicons.js';
import { cleanText } from '../safetext.js';
import { zoneName, josaIGa, josaEulReul } from '../zonelook.js';
import { state, late } from './state.js';
import { $, save, persist } from './save.js';
import { scene, wx } from './scene.js';
import { player, trash, life, col, NS_TUT, street } from './place.js';
import { toast, ach, panelOpen, closePanels, PANELS, openAch, openDex } from './hud.js';
import { director, holdWin } from './director.js';
import { icon } from '../icons.js';
import { createNoteView } from './noteview.js';

const R = PUNK.radio;

/* ---------- 저장 ---------- */
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
if (!isObj(save.punk)) save.punk = {};
const P = save.punk;
P.title = Number.isInteger(P.title) && P.title >= 0 && P.title < TITLES.length ? P.title : -1;
if (!isObj(P.notes)) P.notes = {};
for (const k of Object.keys(P.notes)) if (!NOTES.some((n) => n.id === k)) delete P.notes[k];
P.unread = Array.isArray(P.unread) ? P.unread.filter((id, i, a) => P.notes[id] && a.indexOf(id) === i) : [];
P.radio = P.radio === 0 ? 0 : 1;
if (!isObj(P.day)) P.day = { d: '', n: 0 };
if (!isObj(P.ev)) P.ev = {};
const once = (ev) => { if (P.ev[ev]) return false; P.ev[ev] = 1; persist(); ach.emit(ev); return true; };

/* ---------- 화면 (현무암 UI 토큰) ---------- */
const css = document.createElement('style');
css.textContent = `
#radio-strip { position: fixed; z-index: 7; left: 50%; top: calc(var(--tb-top, 12px) + var(--tb-h, 36px) + 10px); transform: translateX(-50%); width: min(560px, calc(100vw - 32px)); height: 34px; display: flex; align-items: center; gap: 8px; padding: 0 12px 0 8px; border-radius: 999px; background: var(--glass-2, rgba(20,20,24,.6)); border: 1px solid var(--hair); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); color: var(--ink); pointer-events: none; font-family: var(--body); font-weight: 700; font-size: 14px; overflow: hidden; }
#radio-strip svg { flex: none; width: 20px; height: 20px; color: var(--gyul); }
#radio-strip .rs-w { position: relative; flex: 1; height: 100%; overflow: hidden; -webkit-mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent); mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent); }
#radio-strip .rs-t { position: absolute; top: 50%; left: 0; white-space: nowrap; transform: translate(var(--rs-from), -50%); animation: rs-run var(--rs-sec, 6s) linear forwards; }
@keyframes rs-run { to { transform: translate(var(--rs-to), -50%); } }
body.banner-on #radio-strip, body.tip-on #radio-strip { top: calc(var(--tb-top, 12px) + var(--tb-h, 36px) + 64px); }
#punk-chip { position: fixed; z-index: 6; left: var(--tb-l, var(--gut-l)); top: calc(var(--tb-top, 12px) + var(--tb-h, 36px) + 62px); width: 40px; height: 40px; border-radius: 12px; border: 1px solid var(--hair); background: var(--glass-2, rgba(20,20,24,.6)); color: var(--ink); display: grid; place-items: center; padding: 0; cursor: pointer; animation: pn-bob 1.6s ease-in-out infinite; }
#punk-chip svg { width: 26px; height: 26px; }
#punk-chip i { position: absolute; right: -3px; top: -3px; min-width: 16px; height: 16px; border-radius: 8px; background: var(--gyul); color: var(--acc-fg); font: 800 11px/16px var(--body); font-style: normal; }
@keyframes pn-bob { 50% { transform: translateY(-3px); } }
#punk-title .pt-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
#punk-title .pt-it { display: flex; align-items: center; gap: 8px; text-align: left; padding: 8px 10px; border-radius: 12px; border: 1px solid var(--hair); background: rgba(255,255,255,.06); color: var(--ink); font: 700 13px var(--body); cursor: pointer; }
#punk-title .pt-it .bdg { flex: none; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; }
#punk-title .pt-it small { display: block; font-weight: 500; font-size: 11px; color: var(--ink-soft); }
#punk-title .pt-it.on { border-color: var(--gyul); box-shadow: inset 0 0 0 1px var(--gyul); }
#punk-title .pt-it.locked { opacity: .5; cursor: default; }
#punk-title .pt-now { margin: 0 0 10px; font-size: 13px; color: var(--ink-soft); }
#punk-title .pt-now b { color: var(--gyul); }
.dex-cell.note { cursor: pointer; }
@media (max-width: 600px) { #radio-strip { font-size: 13px; height: 30px; } #punk-title .pt-list { grid-template-columns: 1fr 1fr; } }
`;
document.head.append(css);
const SPK = icon('radio'); // 오름 방송 (#184 아이콘 세트)
const PAPER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z" fill="#f4ecd8" stroke="#33302a"/><path d="M15 3v4h4M9 11h7M9 14.5h7M9 18h4" stroke="#33302a"/></svg>';
const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); Object.assign(e, attrs); if (html) e.innerHTML = html; document.body.append(e); return e; };
const strip = el('div', { id: 'radio-strip', hidden: true }, `${SPK}<span class="rs-w"><span class="rs-t"></span></span>`); strip.setAttribute('aria-live', 'polite');
const chip = el('button', { id: 'punk-chip', type: 'button', hidden: true, title: '주운 쪽지' }, `${PAPER}<i></i>`); chip.setAttribute('aria-label', '주운 쪽지 읽기');
const titleEl = el('div', { id: 'punk-title', className: 'overlay dim', hidden: true }, '<div class="panel pop"><div class="pop-head"><h2>칭호</h2><button type="button" class="btn small" id="punk-title-close">닫기</button></div><div class="pop-body"><p class="pt-now"></p><div class="pt-list"></div></div></div>');
PANELS.push('punk-title'); // 열려 있으면 panelOpen (감독·조작이 기다림), closePanels 가 닫음. punk-note 는 쪽지 창을 만든 뒤(2절)

/* ---------- 1. 스피커 기둥 ---------- */
const M4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
function piece(g, color, m) {
  g = g.index ? g.toNonIndexed() : g; if (g.attributes.uv) g.deleteAttribute('uv'); if (m) g.applyMatrix4(m); g.computeVertexNormals();
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
let poleGeo = null; const poleMat = new THREE.MeshToonMaterial({ color: '#ffffff', vertexColors: true, gradientMap: gradHard, side: THREE.DoubleSide }); // 나팔 안쪽이 보이게
function poleGeometry() { // 나무 전봇대 + 가로대 + 회색 나팔 스피커 둘(앞·뒤, 조금 아래로) + 전선 상자
  if (poleGeo) return poleGeo;
  const H = R.poleH, WD = '#7a5a3a', GR = '#9aa0a6', DK = '#4a4e52', y = H - 0.55, parts = [
    piece(new THREE.CylinderGeometry(0.1, 0.14, H, 7), WD, M4(0, H / 2, 0)),
    piece(new THREE.BoxGeometry(0.12, 0.12, 1.3), '#6a4c30', M4(0, H - 0.25, 0)),
    piece(new THREE.BoxGeometry(0.28, 0.36, 0.2), DK, M4(0.16, 1.9, 0)),
  ];
  for (const s of [1, -1]) {
    const m = M4(0, y, s * 0.5, s * (Math.PI / 2 + 0.22), 0, 0);
    parts.push(piece(new THREE.CylinderGeometry(0.34, 0.09, 0.62, 10, 1, true), GR, m));
    parts.push(piece(new THREE.BoxGeometry(0.08, 0.3, 0.08), DK, M4(0, y + 0.2, s * 0.32)));
  }
  poleGeo = mergeGeometries(parts); return poleGeo;
}
const spots = [];
function addPole(x, z, rot, id) {
  const m = new THREE.Mesh(poleGeometry(), poleMat); m.position.set(x, height(x, z) - 0.05, z); m.rotation.y = rot; m.castShadow = true; m.name = 'radio-pole';
  scene.add(m); if (col) col.add(x, z, 0.3);
  spots.push({ id, x, z, mesh: m });
}
if (NS_TUT) { const [d, side, off] = R.trail, q = nsAlong('approach', TUT.gateD + d, side, off); addPole(q.x, q.z, q.dir, 'trail'); }
if (street) { const [s, side] = R.street, p = STREET.P(s, side * (SHOP_ST.half + SHOP_ST.gap + 0.35)); addPole(p.x, p.z, Math.atan2(STREET.ax, STREET.az), 'street'); }
const nearSpeaker = () => spots.reduce((b, s) => Math.min(b, Math.hypot(s.x - player.pos.x, s.z - player.pos.z)), Infinity);

/* ---------- 1. 방송 ---------- */
const rnd = (a, b) => a + Math.random() * (b - a);
let nextT = rnd(...R.every), stripT = 0;
const situ = []; // { k, text, t } 기다리는 상황 방송
const recent = []; // 최근에 나간 늘 방송 번호 (되풀이 줄이기)
const maxZ = () => save.journey?.maxZ || 0;
const radioOn = () => !!P.radio && spots.length > 0 && director.isOpen('radio');
function pushSitu(k, text) {
  if (!radioOn()) return;
  const i = situ.findIndex((s) => s.k === k); if (i >= 0) situ.splice(i, 1);
  situ.push({ k, text, t: performance.now() / 1000 }); if (situ.length > 4) situ.shift();
  nextT = Math.min(nextT, R.situ);
}
function pickLine() {
  const now = performance.now() / 1000;
  for (let i = situ.length - 1; i >= 0; i--) if (now - situ[i].t > R.situTtl) situ.splice(i, 1);
  if (situ.length) return situ.shift().text;
  const ok = RADIO.map((l, i) => i).filter((i) => !(RADIO[i].z > maxZ()) && !recent.includes(i));
  const i = ok.length ? ok[Math.floor(Math.random() * ok.length)] : Math.floor(Math.random() * RADIO.length);
  recent.push(i); if (recent.length > 6) recent.shift();
  return RADIO[i].t;
}
function showStrip(text, sec = R.sec) {
  const t = strip.querySelector('.rs-t'); t.textContent = text;
  strip.hidden = false; stripT = sec;
  const w = strip.querySelector('.rs-w').clientWidth || 300, tw = t.scrollWidth || text.length * 14;
  strip.style.setProperty('--rs-sec', sec + 's'); t.style.setProperty('--rs-from', w + 'px'); t.style.setProperty('--rs-to', -tw + 'px');
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
}
let lastText = '';
function broadcast(force = false) { // 지금 방송 (force: 거리·켜짐 무시, 확인용)
  if (!force && (!radioOn() || nearSpeaker() > R.r)) return false;
  const text = pickLine(); lastText = text;
  return director.ask('radio', 'radio', () => { late.sound?.chime?.(Math.max(0.35, 1 - nearSpeaker() / R.r)); setTimeout(() => showStrip(text), 1300); }, { sec: R.sec + 1.3, ttl: 40 });
}
director.register({ id: 'radio', onOpen: () => { nextT = Math.min(nextT, R.first); } }); // 문이 열리면(구역 1 우두머리 뒤) 곧 첫 방송. 소개는 방송 자체
// 상황 살피기 (1초마다): 구역 완료(돌하르방이 섬)·우두머리 등장·비·자정
const zoneLabel = (z, josa) => { const n = zoneName(z) || `${z}구역`; return n + josa(n); };
const myNick = () => cleanText(save.nick, NET.nickMax) || '러너';
function nearestNick() { const n = late.net; if (!n?.count) return ''; let b = '', bd = Infinity; for (const e of n.peersById.values()) { const d = e.pos ? Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z) : 1e9; if (d < bd && e.nick) { bd = d; b = e.nick; } } return b; }
const watch = { stand: new Map(), done: {}, boss: null, rain: false, day: kstDate() };
const readStand = () => { const m = new Map(); for (const g of late.guard?.state?.() || []) m.set(g.zone, !!g.standing); return m; };
watch.stand = readStand(); watch.done = { ...(save.boss?.done || {}) }; watch.boss = late.boss?.state?.()?.zone ?? null; watch.rain = wx?.kind === 'rain';
let watchT = 1;
function watchSitu() {
  const stand = readStand(), done = save.boss?.done || {};
  for (const [z, on] of stand) if (on && watch.stand.get(z) === false) {
    const mine = (done[z] || 0) > (watch.done[z] || 0), multi = (late.net?.count || 0) > 0;
    const nick = multi ? (mine ? myNick() : nearestNick()) : '';
    pushSitu('zone' + z, (nick ? RADIO_SITU.zoneDoneBy : RADIO_SITU.zoneDone).replace('{nick}', nick).replace('{zone}', zoneLabel(z, nick ? josaEulReul : josaIGa)));
  }
  watch.stand = stand; watch.done = { ...done };
  const bz = late.boss?.state?.()?.zone ?? null;
  if (bz && bz !== watch.boss) pushSitu('boss', RADIO_SITU.boss.replace('{zone}', zoneName(bz) || `${bz}구역`));
  watch.boss = bz;
  const rain = wx?.kind === 'rain'; if (rain && !watch.rain) pushSitu('rain', RADIO_SITU.rain); watch.rain = rain;
  const d = kstDate(); if (d !== watch.day) { watch.day = d; pushSitu('midnight', RADIO_SITU.midnight); }
}
// 설정: 오름 방송 켜기·끄기
const radioBtn = document.createElement('button'); radioBtn.type = 'button'; radioBtn.id = 'menu-radio';
const syncRadioBtn = () => { radioBtn.textContent = `오름 방송: ${P.radio ? '켬' : '끔'}`; radioBtn.setAttribute('aria-pressed', String(!!P.radio)); };
syncRadioBtn(); document.querySelector('#menu .m-more')?.append(radioBtn);
radioBtn.addEventListener('click', () => { P.radio = P.radio ? 0 : 1; persist(); syncRadioBtn(); if (!P.radio) { strip.hidden = true; stripT = 0; situ.length = 0; } toast(P.radio ? '오름 방송을 켰어요' : '오름 방송을 껐어요'); });

/* ---------- 2. 쪽지 ---------- */
const noteBy = Object.fromEntries(NOTES.map((n) => [n.id, n]));
const gotN = () => Object.keys(P.notes).length;
const fightNow = () => !!player.down || !!late.pace?.threat?.() || (state.tension || 0) > 0.3 || !!late.bossFight?.() || !!life?.enemies?.near?.(player.pos, 25);
function syncChip() { chip.hidden = !P.unread.length; chip.querySelector('i').textContent = P.unread.length > 1 ? String(P.unread.length) : ''; }
// 쪽지 창 (#199): 종이 모양·이전/다음 넘기기·그림은 game/noteview.js
const view = createNoteView({
  P, NOTES, zoneName, persist, sound: () => late.sound,
  onRead: () => syncChip(),
  // 감독은 창이 닫힐 때까지 기다림 (도감에서 연 것은 도감 위에 뜸)
  onOpen: (dex) => { if (!dex) { closePanels(); holdWin('story', 'note', 'punk-note'); } late.sound?.snip?.(); },
  onClose: (dex) => { if (dex && !$('dex').hidden) late.dexRebuild?.(); },
});
const noteEl = view.el;
PANELS.push('punk-note');
const openNote = (id, { dex = false } = {}) => view.open(id, { dex });
const closeNote = () => view.close();
chip.addEventListener('click', () => { const id = P.unread[P.unread.length - 1]; if (id) openNote(id); });
function giveNote(id, { quiet = false } = {}) { // 쪽지 한 장을 얻음. 싸우는 중·창이 열려 있으면 표시만
  if (!noteBy[id] || P.notes[id]) return false;
  P.notes[id] = Date.now(); P.unread.push(id); persist();
  if (gotN() >= NOTES.length) once('note-all');
  if (quiet || fightNow() || panelOpen() || state.photoState || !state.sessionOn) { syncChip(); late.sound?.snip?.(); return true; }
  openNote(id); return true;
}
function dropNote(z) { // 그 구역에서 아직 안 주운 쪽지 하나 (구역 밖·다 모은 구역은 없음)
  const left = NOTES.filter((n) => n.z === z && !P.notes[n.id]); if (!left.length) return null;
  const n = left[Math.floor(Math.random() * left.length)]; giveNote(n.id); return n.id;
}
if (trash) trash.on((ev) => {
  if (ev !== 'trash' || !state.sessionOn || late.tut?.active) return;
  // 하루 쓰레기 수 (칭호 '오늘도 무급')
  const d = kstDate(); if (P.day.d !== d) { P.day.d = d; P.day.n = 0; } P.day.n++; if (P.day.n >= PUNK.unpaid) once('trash-day-500'); else if (P.day.n % 25 === 0) persist();
  if (Math.random() < PUNK.note.p) { const z = trash.zoneAt(player.pos.x, player.pos.z) || 0; if (z >= 1) dropNote(z); }
});
syncChip();
// 도감 '주운 쪽지' 칸 (#140 의 재료·전설 칸 뒤)
{ const prev = late.dexExtra;
  late.dexExtra = (g) => {
    prev?.(g);
    const h = document.createElement('div'); h.className = 'dex-sec'; h.textContent = `주운 쪽지 ${gotN()}/${NOTES.length}`; g.append(h);
    for (const n of NOTES) {
      const got = !!P.notes[n.id], c = document.createElement('div'); c.className = 'dex-cell note' + (got ? '' : ' locked');
      c.innerHTML = `<span class="dex-ic">${iconSvg(BADGE_ICONS['b-notes'])}</span><b></b><small></small>`;
      c.querySelector('b').textContent = got ? n.t : '???'; c.querySelector('small').textContent = got ? (P.unread.includes(n.id) ? '안 읽음' : n.from) : `구역 ${n.z}`;
      if (got) c.addEventListener('click', () => openNote(n.id, { dex: true }));
      g.append(c);
    }
  };
  late.dexRebuild = () => { if (!$('dex').hidden) openDex(); }; // 다시 그림 (안 읽음 표시)
}

/* ---------- 3. 칭호 ---------- */
const BADGE = Object.fromEntries(BADGES.map((b) => [b.id, b]));
const SET_BY = Object.fromEntries(OUTFIT_SETS.map((t) => [t.id, t]));
const setOwned = (id) => !!SET_BY[id] && SET_BY[id].items.every((c) => save.clothes?.own?.[c]); // 한 벌 맞춤 칭호 (#179): 세 벌을 다 가짐
const unlocked = (i) => (TITLES[i]?.set ? setOwned(TITLES[i].set) : !!ach.state.badges[TITLES[i]?.badge]);
const titleShown = () => director.isOpen('title') || P.title >= 0; // 문(구역 3)이 열리기 전엔 칭호가 열려도 단추를 숨김
function setTitle(i) {
  i = Number.isInteger(i) && i >= 0 && i < TITLES.length && unlocked(i) ? i : -1;
  if (P.title === i) return P.title;
  P.title = i; persist(); late.net?.send?.(true); return P.title;
}
function buildTitles() {
  titleEl.querySelector('.pt-now').innerHTML = P.title >= 0 ? '이름표 위: <b></b>' : '이름표 위에 단 칭호가 없어요';
  if (P.title >= 0) titleEl.querySelector('.pt-now b').textContent = TITLES[P.title].t;
  const L = titleEl.querySelector('.pt-list'); L.innerHTML = '';
  const off = document.createElement('button'); off.type = 'button'; off.className = 'pt-it' + (P.title < 0 ? ' on' : ''); off.innerHTML = '<span><b>달지 않기</b></span>';
  off.addEventListener('click', () => { setTitle(-1); buildTitles(); }); L.append(off);
  TITLES.forEach((t, i) => {
    const b = BADGE[t.badge], open = unlocked(i), it = document.createElement('button'); it.type = 'button';
    it.className = 'pt-it' + (open ? '' : ' locked') + (P.title === i ? ' on' : ''); it.disabled = !open;
    const st = SET_BY[t.set];
    it.innerHTML = `<span class="bdg" style="background:${b?.color || st?.fx || '#555'}">${iconSvg(BADGE_ICONS[b?.id] || BADGE_ICONS[b?.fam] || '')}</span><span><b></b><small></small></span>`;
    it.querySelector('b').textContent = open ? t.t : '???'; it.querySelector('small').textContent = b ? b.desc : st ? `${st.name} 한 벌 세 벌을 모으면` : '';
    if (open) it.addEventListener('click', () => { setTitle(i); buildTitles(); toast(`칭호 '${t.t}' 를 달았어요`); });
    L.append(it);
  });
}
function openTitles() { closePanels(); buildTitles(); titleEl.hidden = false; }
$('punk-title-close').addEventListener('click', () => { titleEl.hidden = true; openAch(); });
titleEl.addEventListener('pointerdown', (e) => { if (e.target === titleEl) titleEl.hidden = true; });
const titleBtn = document.createElement('button'); titleBtn.type = 'button'; titleBtn.className = 'btn small'; titleBtn.id = 'ach-title'; titleBtn.textContent = '칭호'; titleBtn.hidden = true;
{ const head = $('ach')?.querySelector('.pop-head'); head?.insertBefore(titleBtn, $('ach-dex')); }
titleBtn.addEventListener('click', openTitles);
const syncTitleBtn = () => { titleBtn.hidden = !titleShown(); };
// 다른 기능이 칭호를 줌 (#168 엔딩 story.js: late.titles.give('은하 환경미화원')): 그 칭호의 업적 사건을 한 번 냄
late.titles = { give(text) { const t = TITLES.find((x) => x.t === text), b = t && BADGE[t.badge]; if (!b || ach.state.badges[b.id]) return false; for (let k = 0; k < b.goal; k++) ach.emit(b.ev); return true; } };
director.register({ id: 'title', sec: 4.5, intro: () => toast('업적을 따면 칭호가 열려요. 업적 창 [칭호] 에서 골라 이름표 위에 달아요', 4.5) });
syncTitleBtn();

// 멧돼지와 눈싸움: 멧돼지(아기 포함)가 가까이 있는 채로 PUNK.stare.sec 초 동안 안 맞음
let stareT = 0;
function tickStare(dt) {
  if (P.ev['boar-stare']) return;
  const S = PUNK.stare, near = life?.enemies?.list?.some((e) => S.kinds.includes(e.kind) && e.state !== 'flee' && e.state !== 'leave' && Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z) < S.r);
  if (!near || player.iframe > 0 || player.down || late.tut?.active) { stareT = 0; return; }
  stareT += dt; if (stareT >= S.sec) { stareT = 0; once('boar-stare'); }
}

/* ---------- 매 프레임 ---------- */
late.tickPunk = (dt) => {
  if (stripT > 0 && (stripT -= dt) <= 0) strip.hidden = true;
  if (!state.sessionOn) return;
  tickStare(dt);
  if ((watchT -= dt) <= 0) {
    watchT = 1; watchSitu(); syncTitleBtn();
    if (save.quest?.done?.includes?.('boss1')) once('quest-boss1');
  }
  if (late.tut?.active || !radioOn()) return;
  if ((nextT -= dt) <= 0) { broadcast(); nextT = rnd(...R.every); }
};

/* ---------- 확인용 (__oreum.punkWorld) ---------- */
late.punkWorld = {
  radio: {
    spots: () => spots.map((s) => ({ id: s.id, x: +s.x.toFixed(1), z: +s.z.toFixed(1) })),
    near: () => +nearSpeaker().toFixed(1), on: () => radioOn(), next: (v) => { if (v != null) nextT = v; return +nextT.toFixed(1); },
    fire: (force = true) => broadcast(force), situ: (k, text) => pushSitu(k, text || RADIO_SITU[k] || k), pending: () => situ.map((s) => s.text),
    strip: () => (!strip.hidden ? strip.querySelector('.rs-t').textContent : null), last: () => lastText, watch: () => watchSitu(),
    go: (id = 'trail') => { const s = spots.find((x) => x.id === id); if (!s) return null; player.pos.set(s.x + 3, height(s.x + 3, s.z), s.z); player.visY = player.pos.y; return { x: s.x, z: s.z }; },
    lines: () => ({ radio: RADIO.length, situ: Object.keys(RADIO_SITU).length }),
  },
  note: { give: (id, quiet) => giveNote(id, { quiet }), drop: (z) => dropNote(z), open: (id) => openNote(id), got: () => Object.keys(P.notes), unread: () => [...P.unread], shown: () => (!noteEl.hidden ? noteEl.querySelector('h2').textContent : null), chip: () => !chip.hidden, close: closeNote, view: () => view.test(), go: (d) => view.go(d), list: NOTES, reset: () => { P.notes = {}; P.unread = []; delete P.ev['note-all']; persist(); syncChip(); } },
  title: { set: (i) => setTitle(i), now: () => P.title, unlocked: () => TITLES.map((t, i) => unlocked(i)), open: openTitles, list: TITLES, btn: () => !titleBtn.hidden },
  stare: () => +stareT.toFixed(1), day: () => ({ ...P.day }), ev: () => ({ ...P.ev }),
  state: () => JSON.parse(JSON.stringify(P)),
};
