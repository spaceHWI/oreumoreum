// NPC 대사 고르기 (#278). 글은 src/npclines.js (인물마다 말버릇·말의 종류·조건 줄)
// - 지나갈 때 인사: game/quest.js greet 가 late.npcGreet(주는 사람 id) 로 받음. 처음 만나면 first 한 번(save.npcMet)
// - 가게 창: 열면 위 칸 아래 한 줄(#shoppop-say)에 주인 말(open), 귤·망고가 줄면 buy, '모자라요' 알림이 뜨면 poor, 닫으면 주인 머리 위 말풍선(close, 샀으면 buy)
// - 사진사: PHOTOG.line / PHOTOG.beckonLine (photographer.js 가 부름). 흡연자·투기꾼: late.npcBark(종류, 그 사람, ev)
// - 같은 인물이 같은 말을 잇달아 하지 않게 종류마다 최근 3줄은 뺌. 조건 붙은 줄이 맞으면 세 배로 잘 뽑힘
// 확인: window.__oreum.npcTalk (tags·line·say·met)
import { NPC_TALK } from '../npclines.js';
import { PHOTOG } from '../balance.js';
import { state, late } from './state.js';
import { $, save, CL, persist } from './save.js';
import { wx, sunState } from './scene.js';
import { player, trash, hp } from './place.js';
import { social } from './room.js';
import { msgLog } from './msglog.js';
import { shopPopNow } from './stores.js';

const POP = { gear: 'gear', stone: 'stone', manjok: 'satis', salon: 'salon', inn: 'inn', ride: 'ride', leap: 'leap', tok: 'tok' }; /* 가게 창 key → 말하는 사람 */
const nowS = () => performance.now() / 1000;
let downAt = -1e9, wasDown = false;

function tags() {
  const t = new Set(['']), k = wx?.kind || '', h = new Date().getHours(), z = trash?.zoneAt?.(player.pos.x, player.pos.z) || 0, life = save.ach?.life?.trash || 0;
  if (k === 'rain' || k === 'snow') t.add(k);
  t.add((sunState?.el ?? 30) < -4 ? 'night' : 'day');
  if (h >= 23 || h < 4) t.add('late');
  if (z) t.add('z' + z);
  for (const [i, n] of Object.entries(save.boss?.done || {})) if (n > 0) t.add('done' + i);
  if (save.coins < 30) t.add('broke'); else if (save.coins >= 1000) t.add('rich');
  if ((late.bagRoom?.() ?? 1) <= 0) t.add('full');
  if (life < 50) t.add('new'); else if (life >= 1000) t.add('vet');
  if (nowS() - downAt < 180) t.add('down');
  if (player.ride || player.cart || player.riding) t.add('ride');
  if (CL?.wear?.hat === 'hat:p-box') t.add('box');
  return t;
}
const recent = {}; /* `${id}.${kind}` → 최근 뽑은 줄 번호 */
function line(id, kind, T = tags()) {
  const L = NPC_TALK[id]?.[kind]; if (!L?.length) return '';
  const key = id + '.' + kind, R = recent[key] || (recent[key] = []), pool = [];
  L.forEach(([w, s], i) => { const need = w.split(' ').filter(Boolean); if (need.every((x) => T.has(x)) && !R.includes(i)) for (let n = need.length ? 3 : 1; n > 0; n--) pool.push(i); });
  if (!pool.length) { if (!R.length) return ''; R.length = 0; return line(id, kind, T); }
  const i = pool[Math.floor(Math.random() * pool.length)];
  R.push(i); while (R.length > Math.min(3, L.length - 1)) R.shift();
  return L[i][1];
}
const met = () => (save.npcMet && typeof save.npcMet === 'object' ? save.npcMet : (save.npcMet = {}));
function meet(id) { if (met()[id]) return ''; met()[id] = 1; persist(); return line(id, 'first'); }
const who = (gid) => (gid === 'jigi' ? 'jigi' : String(gid).startsWith('shop:') ? gid.slice(5) : null);

/* 지나갈 때 인사 (game/quest.js greet). 종결한 사건의 말(#233)이 있으면 셋 중 하나는 그것 */
late.npcGreet = (gid, caseLines = []) => {
  const id = who(gid); if (!id || !NPC_TALK[id]) return caseLines.length ? caseLines[Math.floor(Math.random() * caseLines.length)] : '';
  if (caseLines.length && Math.random() < 0.34) return caseLines[Math.floor(Math.random() * caseLines.length)];
  return meet(id) || line(id, 'hello');
};

/* 사진사 (photographer.js) */
PHOTOG.line = () => line('photog', 'hello');
PHOTOG.beckonLine = () => line('photog', 'beckon');

/* 흡연자·투기꾼 짧은 반응: who 'smoker'|'dumper', d = 그 사람({ root, kind }), ev 'come'|'repel' */
late.npcBark = (kind, d, ev = 'repel') => {
  if (!social || !d?.root) return;
  const s = line(kind, kind === 'dumper' && d.kind === 'truck' ? 'truck' : ev); if (s) social.showBubble('npc-' + kind + ':' + (d.id ?? ''), d.root, s, 2.8);
};

/* ---------- 가게 창 ---------- */
const sayEl = $('shoppop-say');
function windowSay(id, kind) {
  if (!sayEl) return;
  const s = (kind === 'open' && meet(id)) || line(id, kind); sayEl.hidden = !s;
  if (s) { sayEl.innerHTML = `<b></b> <span></span>`; sayEl.firstChild.textContent = NPC_TALK[id].name; sayEl.lastChild.textContent = s; sayEl.classList.remove('say-in'); void sayEl.offsetWidth; sayEl.classList.add('say-in'); }
}
function ownerRoot(id) {
  if (id === 'tok') return late.tokKeeper?.()?.root || null;
  const g = late.questDebug?.givers?.get?.('shop:' + id); return g?.root?.visible ? g.root : null;
}
function bubble(id, kind) { const r = ownerRoot(id); if (!r || !r.visible || !social) return; const s = line(id, kind); if (s) social.showBubble('npc-q-shop:' + id, r, s, 3.4); }
const tokN = () => save.tok?.n | 0;
let cur = null, c0 = 0, t0 = 0, bought = false;
function tickShopTalk() {
  const pop = $('shoppop'), open = pop && !pop.hidden, id = open ? POP[shopPopNow] : null;
  if (cur && id !== cur) { bubble(cur, bought ? 'buy' : 'close'); cur = null; }
  if (!id) { if (sayEl && !sayEl.hidden) sayEl.hidden = true; return; }
  if (id !== cur) { cur = id; c0 = save.coins; t0 = tokN(); bought = false; windowSay(id, 'open'); return; }
  if (save.coins < c0 || tokN() < t0) { bought = true; windowSay(id, 'buy'); }
  c0 = save.coins; t0 = tokN();
}
/* 귤이 모자랄 때: 가게 창 안을 누른 뒤 '모자라요' 알림이 새로 떴으면 (가게마다 알림 글은 그대로 두고 주인 말만 더함) */
$('shoppop')?.addEventListener('click', (e) => {
  const id = POP[shopPopNow]; if (!id) return;
  const before = msgLog.last(), short = !!e.target.closest?.('.poor, .short');
  setTimeout(() => { const after = msgLog.last(); if (/모자라/.test(after) && (after !== before || short)) windowSay(id, 'poor'); }, 0);
}, true);

function tickTalk() {
  if (window.__oreum && !window.__oreum.npcTalk) window.__oreum.npcTalk = late.npcTalkApi;
  const d = !!hp?.isDown; if (d && !wasDown) downAt = nowS(); wasDown = d;
  tickShopTalk();
}
{ const q0 = late.tickQuest; late.tickQuest = (dt) => { q0?.(dt); tickTalk(); }; } /* 퀘스트 칸 뒤에 붙임 (루프 셈은 quest 그대로) */

/* ---------- 확인용 (window.__oreum.npcTalk) ---------- */
late.npcTalkApi = {
  tags: () => [...tags()].filter(Boolean),
  line: (id, kind) => line(id, kind), met: () => ({ ...met() }), meet,
  window: () => (sayEl && !sayEl.hidden ? sayEl.textContent : ''),
  down: () => { downAt = nowS(); }, /* 확인용: 방금 쓰러진 것으로 */
  ids: () => Object.keys(NPC_TALK),
};
state.npcTalk = true;
