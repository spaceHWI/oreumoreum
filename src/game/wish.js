// 돌탑 소원 글·함께 기도 (#127). 서버는 server/src/wishes.js, 값은 balance.js WISH
// - 창: 돌 올리기(내 기기 save.wishes, 예전 그대로) + 소원 한 줄(로그인만, 서버가 거름) + 남의 소원 목록(함께 기도·신고)
// - 돌탑 가까이(WISH.near) 가면 최근 소원이 말풍선으로 하나씩 떠오름 (WISH.floatEvery 초마다)
// - 들어올 때 한 번: '○명이 함께 빌어 줬어요' (/wish/news, 귤은 서버가 계정 번 몫에 먼저 넣어 둠)
// - 어드민: 개발자 메뉴 '신고된 소원' (지우기·되살리기)
// 글은 모두 textContent·캔버스로만 넣음 (#84)
import { WISH } from '../balance.js';
import { wishApi, loggedIn } from '../online.js';
import { cleanText, wishBad } from '../safetext.js';
import { state, late } from './state.js';
import { $, save } from './save.js';
import { player, cairns } from './place.js';
import { toast, closePanels, ach, addCoins, gyulExpect } from './hud.js';
import { setTarget } from './input.js';
import { social } from './room.js';

const cache = new Map(); // cid -> { at, list }
let cur = null; // 창이 열린 돌탑
const ERR = { bad: '다른 말로 써 주세요', link: '주소·연락처·긴 숫자는 쓸 수 없어요', day: `오늘은 이 돌탑 소원을 더 고칠 수 없어요 (하루 ${WISH.editPerDay}번)`, slow: '조금 있다가 다시 써 주세요', login: '소원 글은 로그인하면 남길 수 있어요' };

async function load(cid, force = false) {
  if (!wishApi) return null;
  const c = cache.get(cid);
  if (!force && c && Date.now() - c.at < WISH.cacheMs) return c.list;
  try {
    const r = await wishApi.list(cid);
    const list = Array.isArray(r?.list) ? r.list.map((w) => ({ id: w.id | 0, nick: cleanText(w.nick, 16), text: cleanText(w.text, WISH.max), at: +w.at || 0, n: w.n | 0, mine: !!w.mine, hid: !!w.hid, prayed: !!w.prayed })).filter((w) => w.id && w.text) : [];
    cache.set(cid, { at: Date.now(), list });
    social.setServer(cid, list);
    const m = list.find((w) => w.mine); // 서버에 있는 내 글을 기기 기록에도 (다른 기기에서 쓴 것)
    if (m && save.wishes?.[cid] && save.wishes[cid].wish !== m.text) save.wishes[cid].wish = m.text;
    return list;
  } catch (e) { return c ? c.list : null; }
}

function row(w) {
  const d = document.createElement('div'); d.className = 'wish' + (w.mine ? ' mine' : '') + (w.hid ? ' hid' : '');
  const b = document.createElement('b'); b.textContent = w.mine ? '나' : w.nick || '누군가';
  const s = document.createElement('span'); s.textContent = w.text;
  d.append(b, s);
  if (w.id && !w.mine) {
    const p = document.createElement('button'); p.type = 'button'; p.className = 'wish-pray';
    p.textContent = `함께 기도 ${w.n || ''}`.trim(); p.setAttribute('aria-pressed', String(!!w.prayed)); p.title = w.prayed ? '오늘 함께 빌었어요' : '함께 기도';
    p.addEventListener('click', () => pray(w));
    const r = document.createElement('button'); r.type = 'button'; r.className = 'wish-rep'; r.textContent = '신고'; r.title = '신고';
    r.addEventListener('click', () => report(w, r, d));
    d.append(p, r);
  } else if (w.id) {
    const n = document.createElement('small'); n.className = 'muted'; n.textContent = w.hid ? '숨겨짐' : w.n ? `기도 ${w.n}` : ''; d.append(n, document.createElement('i'));
  }
  return d;
}
function draw(c, list) {
  const box = $('wish-list'); box.replaceChildren();
  const local = (social.stones.get(c.id) || []).filter((e) => e.wish && !e.wid); // 혼자 모드·서버에 없는 내 글
  const rows = list ? list.slice(0, WISH.list) : local.slice().reverse().slice(0, WISH.list).map((e) => ({ nick: e.nick, text: e.wish, mine: e.mine }));
  if (list) { const m = local.find((e) => e.mine); if (m && !list.some((w) => w.mine)) rows.unshift({ nick: '나', text: m.wish, mine: true }); }
  rows.forEach((w) => box.append(row(w)));
}
function openWishes(c) {
  cur = c; closePanels();
  const list = social.stones.get(c.id) || [], mine = list.find((e) => e.mine);
  $('wish-title').textContent = c.name;
  $('wish-count').textContent = list.length ? `돌 ${list.length}개가 쌓여 있어요. 한 사람당 돌 하나, 다시 올리면 맨 위로 옮겨져요.` : '아직 아무도 돌을 올리지 않았어요. 첫 돌을 올려 보세요.';
  $('wish-submit').textContent = mine ? '맨 위로 다시 올리기' : '돌 올리기';
  const inp = $('wish-input'); inp.maxLength = WISH.max; inp.value = mine?.wish || '';
  const canWrite = !wishApi || loggedIn(); // 서버가 없으면(혼자 하기) 예전처럼 내 화면에만
  inp.disabled = !canWrite; inp.placeholder = canWrite ? '소원 한 줄 (비워도 돼요)' : '소원 글은 로그인하면 남길 수 있어요';
  $('wish-solo').hidden = !!wishApi || social.canWrite;
  const note = $('wish-note'); note.hidden = !wishApi; note.textContent = wishApi ? `소원은 ${WISH.keepDays}일 동안 다른 사람에게 보여요. 남의 소원에 함께 기도하면 귤을 받아요 (하루 ${WISH.prayPerDay}번).` : '';
  draw(c, cache.get(c.id)?.list || null);
  $('wishes').hidden = false;
  if (wishApi) load(c.id, true).then((l) => { if (l && cur === c && !$('wishes').hidden) { draw(c, l); $('wish-count').textContent = `돌 ${(social.stones.get(c.id) || []).length}개가 쌓여 있어요. 한 사람당 돌 하나, 다시 올리면 맨 위로 옮겨져요.`; } });
}
late.openWishes = openWishes;

// 돌 올리기 (+ 소원 한 줄)
$('wish-input').addEventListener('keydown', (e) => e.stopPropagation());
$('wish-form').addEventListener('submit', (e) => {
  e.preventDefault(); if (!cur) return;
  const c = cur, text = cleanText($('wish-input').value, WISH.max);
  const prev = save.wishes?.[c.id]?.wish || '';
  if (wishApi && text && text !== prev) {
    if (!loggedIn()) { toast(ERR.login); return; }
    const b = wishBad(text); if (b) { toast(ERR[b]); return; } // 서버도 똑같이 거름 (먼저 알려 주기만)
  }
  $('wishes').hidden = true;
  const toMe = player.pos.clone().sub(c.pos).setY(0).normalize();
  setTarget(c.pos.clone().addScaledVector(toMe, 1.8), async () => {
    player.heading = Math.atan2(c.pos.x - player.pos.x, c.pos.z - player.pos.z);
    player.pose = 'crouch'; player.poseT = 0;
    await new Promise((r) => setTimeout(r, 500));
    let keep = text, msg = '';
    if (wishApi && loggedIn() && text !== prev) {
      try { await wishApi.put(c.id, text); cache.delete(c.id); } catch (err) { keep = prev; msg = ERR[err.data?.error] || '소원을 남기지 못했어요. 잠시 후 다시 해 주세요'; }
    }
    const had = await social.placeStone(c.id, keep);
    c.drop = 1.2; late.sound.stone(); setTimeout(() => { if (player.pose === 'crouch') player.pose = 'move'; }, 400);
    toast(msg || (had ? (keep !== prev ? '소원을 바꿔 적었어요' : '돌을 맨 위로 다시 올렸어요') : `${c.name}에 돌을 올렸어요`));
    if (!had) ach.emit('stone'); late.tut.notify('stone');
    if (wishApi) load(c.id, true);
  });
});

// 함께 기도: 꾸벅 인사(#76 동작)를 하고 기도 수 +1, 귤 조금 (하루 WISH.prayPerDay 번)
async function pray(w) {
  if (!wishApi || w.prayed) { if (w.prayed) toast('오늘은 이 소원에 함께 빌었어요'); return; }
  const c = cur; w.prayed = true;
  $('wishes').hidden = true;
  if (c) player.heading = Math.atan2(c.pos.x - player.pos.x, c.pos.z - player.pos.z);
  state.emo?.perform('insa');
  try {
    const r = await wishApi.pray(w.id);
    w.n = r.n | 0;
    const g = Math.max(0, Math.min(WISH.prayGyul, r.gyul | 0));
    if (g) { gyulExpect?.(g); addCoins(g); }
    toast(g ? `${w.nick || '누군가'}의 소원에 함께 빌었어요 · 귤 +${g}` : `${w.nick || '누군가'}의 소원에 함께 빌었어요`);
    ach.emit('pray');
  } catch (e) {
    const k = e.data?.error;
    if (k !== 'today') w.prayed = false;
    toast(k === 'today' ? '오늘은 이 소원에 함께 빌었어요' : k === 'gone' ? '지금은 없는 소원이에요' : '함께 빌지 못했어요. 잠시 후 다시 해 주세요');
  }
}
// 신고: 한 번 더 눌러야 보냄. 서로 다른 WISH.reportHide 명이면 서버가 숨김
async function report(w, btn, rowEl) {
  if (!btn.dataset.sure) { btn.dataset.sure = '1'; btn.textContent = '한 번 더 누르면 신고'; setTimeout(() => { delete btn.dataset.sure; btn.textContent = '신고'; }, 4000); return; }
  btn.disabled = true;
  try { await wishApi.report(w.id); rowEl.remove(); const c = cache.get(cur?.id); if (c) c.list = c.list.filter((x) => x.id !== w.id); toast('신고했어요. 여러 명이 신고하면 숨겨져요'); } catch (e) { btn.disabled = false; toast('신고하지 못했어요'); }
}

// 돌탑 가까이: 최근 소원이 하나씩 떠오름
const float = { cid: null, i: 0, t: 0 };
setInterval(() => {
  if (!wishApi || !state.sessionOn || document.hidden) return;
  let best = null, bd = WISH.near;
  for (const c of cairns) { const d = Math.hypot(c.pos.x - player.pos.x, c.pos.z - player.pos.z); if (d < bd) { bd = d; best = c; } }
  if (!best) { float.cid = null; return; }
  if (float.cid !== best.id) { float.cid = best.id; float.i = 0; float.t = 0; load(best.id); }
  if (Date.now() - float.t < WISH.floatEvery * 1000) return;
  const l = (cache.get(best.id)?.list || []).filter((w) => !w.hid).slice(0, WISH.floatN);
  if (!l.length) return;
  const w = l[float.i++ % l.length]; float.t = Date.now();
  social.showBubble('wish:' + best.id, best.group, `${w.text} · ${w.mine ? '나' : w.nick || '누군가'}`, best.base + 0.8 + Math.min(100, best.n || 0) * 0.08);
}, 500);

// 들어올 때 한 번: 내 돌탑 소식
let newsDone = false;
const newsTimer = setInterval(async () => {
  if (newsDone || !wishApi) { clearInterval(newsTimer); return; }
  if (!state.sessionOn || !loggedIn()) return;
  newsDone = true; clearInterval(newsTimer);
  try {
    const r = await wishApi.news();
    const n = r?.n | 0, g = Math.max(0, r?.gyul | 0);
    if (!n) return;
    setTimeout(() => { if (g) { gyulExpect?.(g); addCoins(g); } toast(`${n}명이 내 소원에 함께 빌어 줬어요${g ? ` · 귤 +${g}` : ''}`, 5); }, 3000);
  } catch (e) { /* 다음에 */ }
}, 2000);

// 어드민: 신고된 소원 (개발자 메뉴)
const kst = (t) => new Date(t).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });
async function admLoad() {
  const ul = $('wishadm-list'); ul.textContent = '';
  let l = null; try { l = await wishApi.adminList(); } catch (e) { l = null; }
  if (!Array.isArray(l)) { toast('불러오지 못했어요'); return; }
  if (!l.length) { const li = document.createElement('li'); li.textContent = '신고된 소원이 없어요'; ul.append(li); return; }
  for (const w of l) {
    const li = document.createElement('li');
    const h = document.createElement('small'); h.textContent = `${kst(w.at)} · ${cleanText(w.cid, 40)} · ${cleanText(w.nick, 24) || '이름 없음'} · 신고 ${w.rep} · ${w.hid ? '숨김' : '보임'}`;
    const t = document.createElement('div'); t.className = 't'; t.textContent = cleanText(w.text, WISH.max);
    const m = document.createElement('small'); m.textContent = `계정 ${cleanText(w.sub, 80)} · 기도 ${w.n}`;
    const bx = document.createElement('div'); bx.className = 'wa-btns';
    for (const [act, label] of [['del', '지우기'], ['show', '되살리기']]) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small'; b.textContent = label;
      b.addEventListener('click', async () => { b.disabled = true; try { await wishApi.admin(w.id, act); toast(act === 'del' ? '지웠어요' : '되살렸어요'); admLoad(); } catch (e) { b.disabled = false; toast('하지 못했어요'); } });
      bx.append(b);
    }
    li.append(h, t, m, bx); ul.append(li);
  }
}
if (wishApi) {
  $('dev-wishadm').addEventListener('click', () => { closePanels(); $('wishadm').hidden = false; admLoad(); });
  $('wishadm-refresh').addEventListener('click', admLoad);
  $('wishadm-close').addEventListener('click', () => { $('wishadm').hidden = true; });
  $('wishadm').addEventListener('pointerdown', (e) => { if (e.target === $('wishadm')) $('wishadm').hidden = true; });
} else $('dev-wishadm').hidden = true;

export const wishDebug = { load, cache, open: openWishes, pray, float, news: () => newsDone };
late.wish = wishDebug;
