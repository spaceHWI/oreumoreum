// 귤 주기 (#175): 다른 플레이어 GIVE.r 안에 서면 상호작용(F) 버튼이 '귤 주기'. 한 번 누르면 1개, 누르고 있으면 GIVE.holdDelay 뒤부터 점점 빠르게(GIVE.rate)
// - 서버가 옮김: 클라이언트는 '누구에게 몇 개' 만 GIVE.sendSec 마다 묶어 보내고({t:'give', to, n}), 귤은 서버가 알려 준 누적(gave.out·got.in)으로만 맞춤 (save.gift = {in, out})
//   받은 귤은 번 귤이 아님: 업적 '귤 벌기'·경험치·순위에 안 들어감. 저장 확인(server/src/validate.js giftBase)도 따로 셈
// - 로그인한 사람끼리만(서버가 presence 에 ac 를 붙임), 받지 않기(메뉴 '귤 선물', save.giftOff → presence ng). 혼자·서버 없음은 버튼이 안 나옴
// - 동료(#172)에게는 말 걸기 창의 '귤 주기': 하나씩, 하루 GIVE.mate.dayMax 개, 고맙다는 말만
// - 업적 '귤 인심' (ev 'gift-give'). 파일 순서는 buddies 뒤 (src/modules.js)
// dev: __oreum.give.state()·target()·press()·release()·fake({in|out})
import * as THREE from 'three';
import { GIVE, TANGERINE as TG } from '../balance.js';
import { kstDay } from '../rankday.js';
import { state, late } from './state.js';
import { $, save, persist } from './save.js';
import { scene } from './scene.js';
import { player, hp, runner } from './place.js';
import { ui, toast, updateStats, gyulExpect, ach, busy } from './hud.js';
import { coinFx } from './hooks.js';
import { net, social } from './room.js';
import { interactables } from './stores.js';
import { keys } from './input.js';

// save.gift 는 서버 바로잡기(start.js onFix)가 맞출 수 있어 늘 save 에서 다시 읽음
const gf = () => { let g = save.gift; if (!g || typeof g !== 'object' || Array.isArray(g)) g = save.gift = {}; g.in = Math.max(0, Math.floor(+g.in || 0)); g.out = Math.max(0, Math.floor(+g.out || 0)); return g; };
gf();
if (save.giftOff) save.giftOff = 1; else delete save.giftOff;
const nowS = () => performance.now() / 1000;
let room = null, live = false;
const loggedIn = () => !!state.account?.loggedIn;

// ---------- 날아가는 귤 (모양만) ----------
const TR = 0.16 * TG.scale * 0.8;
const flyGeo = new THREE.SphereGeometry(TR, 8, 6), flyMat = new THREE.MeshLambertMaterial({ color: TG.color, emissive: TG.emissive, emissiveIntensity: TG.emissiveI });
const flies = [];
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
function fly(from, to, delay = 0) {
  if (flies.length >= GIVE.flyMax) return;
  const m = new THREE.Mesh(flyGeo, flyMat); m.visible = false; scene.add(m);
  flies.push({ m, a: from.clone(), b: to, t: -delay, dur: 0.45 });
}
function tickFlies(dt) {
  for (let i = flies.length - 1; i >= 0; i--) {
    const f = flies[i]; f.t += dt; if (f.t < 0) continue;
    const k = Math.min(1, f.t / f.dur), b = f.b.isVector3 ? f.b : f.b();
    if (!b) { scene.remove(f.m); flies.splice(i, 1); continue; }
    _a.copy(f.a).lerp(_b.copy(b), k); _a.y += Math.sin(Math.PI * k) * 1.1; f.m.position.copy(_a); f.m.visible = true;
    if (k >= 1) { scene.remove(f.m); flies.splice(i, 1); }
  }
}
const handPos = (root) => (root ? root.position.clone().setY(root.position.y + 1.25) : null);

// ---------- 받는 사람 고르기 ----------
let tgt = null; // net.peersById 의 사람
function canTake(e) { const d = e.data || {}; return d.ac === 1 && !d.ng && e.runner.root.visible; }
function findTarget() {
  if (!live || !loggedIn() || net.solo || hp.isDown) return null;
  let best = null, bd = GIVE.r;
  for (const e of net.peersById.values()) { if (!canTake(e)) continue; const d = e.pos.distanceTo(player.pos); if (d < bd) { bd = d; best = e; } }
  return best;
}
const short = (n) => (n.length > 6 ? n.slice(0, 6) + '…' : n);
export const giveAct = {
  ic: 'give', r: GIVE.r,
  get pos() { return tgt ? tgt.pos : player.pos; },
  get label() { return tgt ? `귤 주기 · ${short(tgt.nick || '러너')}` : '귤 주기'; },
  when() { tgt = findTarget(); return !!tgt; },
  act() { press(); },
};
interactables.push(giveAct);

// ---------- 누르고 있기 ----------
const H = { on: null, queue: 0, acc: 0, sendT: 0, sent: [], reason: '' }; /* on = { e, t0 } */
let ptrHeld = false;
ui.ctx.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button) return; if (state.ctxTarget === giveAct) ptrHeld = true; });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) ui.ctx.addEventListener(ev, () => { ptrHeld = false; });
addEventListener('blur', () => { ptrHeld = false; });
const holding = () => ptrHeld || keys.has('f');
const inFlight = () => H.sent.reduce((a, b) => a + b, 0);
function press() {
  const e = tgt || findTarget(); if (!e) return;
  if (H.on && H.on.e === e) return; // 이미 주는 중
  if (save.coins - inFlight() < 1) { toast('귤이 없어요'); return; }
  H.on = { e, t0: nowS() }; H.queue += 1; H.acc = 0; H.sendT = GIVE.sendSec; H.reason = '';
  fly(handPos(runner.root), () => handPos(e.runner.root));
  if (H.sent.length === 0) state.account?.dirty?.(); // 저장을 서버에 맞춰 둠 (서버는 저장된 귤로 가진 것을 셈)
}
function release(why = 'up') { if (H.on) H.why = why; H.on = null; ptrHeld = false; }
const rateAt = (t) => { let r = 0; for (const [s, v] of GIVE.rate) if (t >= s) r = v; return r; };
function tickHold(dt) {
  const h = H.on;
  if (h) {
    const e = h.e;
    if (!net.peersById.has(e.peer) || !canTake(e) || e.pos.distanceTo(player.pos) > GIVE.r + 1 || hp.isDown || !live) release('lost');
    else if (!holding() && nowS() - h.t0 > 0.05) release('up');
    else {
      const el = nowS() - h.t0;
      if (el >= GIVE.holdDelay) {
        H.acc += rateAt(el) * dt; const k = Math.floor(H.acc); H.acc -= k;
        const room0 = Math.max(0, save.coins - inFlight() - H.queue);
        const add = Math.min(k, room0); H.queue += add;
        if (k > add && !room0) { toast('귤이 다 떨어졌어요'); release('empty'); }
        for (let i = 0; i < Math.min(add, 3); i++) fly(handPos(runner.root), () => handPos(e.runner.root), i * 0.06);
      }
    }
  }
  H.sendT += dt;
  if (H.queue > 0 && H.sendT >= GIVE.sendSec && (h || H.lastTo)) {
    const to = h ? h.e.peer : H.lastTo, n = Math.min(H.queue, GIVE.burst);
    H.queue -= n; H.sendT = 0; H.lastTo = to;
    if (room?.send({ t: 'give', to, n })) H.sent.push(n); else { H.queue = 0; }
  }
  if (!h && H.queue === 0) H.lastTo = null;
}

// ---------- 화면 한 줄 (같은 사람이면 개수만 갱신) ----------
const line = { key: '', n: 0, until: 0 };
function showLine(key, n, text) {
  const t = nowS();
  if (line.key !== key || t > line.until) { line.key = key; line.n = 0; }
  line.n += n; line.until = t + GIVE.lineSec;
  toast(text(line.n), GIVE.lineSec);
}
const WHY = { coins: '귤이 모자라요', day: '오늘은 더 줄 수 없어요', full: '그분은 오늘 더 받을 수 없어요', off: '귤 선물을 받지 않는 분이에요', new: '계정을 만든 지 하루가 지나야 줄 수 있어요', login: '로그인해야 줄 수 있어요', far: '조금 더 가까이 가 주세요' };

// ---------- 서버 알림 ----------
function onGave(m) {
  H.sent.shift();
  const n = Math.max(0, m.n | 0);
  const G = gf();
  if (Number.isFinite(m.out) && m.out > G.out) { const d = Math.floor(m.out) - G.out; G.out = Math.floor(m.out); save.coins = Math.max(0, save.coins - d); persist(); updateStats(); }
  if (n) {
    const e = net.peersById.get(m.to), who = (e?.nick || '러너');
    showLine('to:' + m.to, n, (k) => `${who} 님에게 귤 ${k}개`);
    ach.emit('gift-give', n); late.sound?.coin?.();
  }
  if (m.no && m.no !== 'fast' && WHY[m.no] !== undefined && H.reason !== m.no) {
    H.reason = m.no; release(m.no); H.queue = 0;
    if (m.no === 'coins' && save.coins >= 1) { state.account?.push?.(); toast('잠깐 뒤에 다시 해 보세요'); } // 서버에 아직 안 들어간 귤
    else toast(WHY[m.no]);
  } else if (m.no && !WHY[m.no] && m.no !== 'fast') { release(m.no); H.queue = 0; toast('지금은 줄 수 없어요'); }
}
let bowAt = -1e9;
function onGot(m) {
  if (!Number.isFinite(m.in)) return;
  const G = gf(), d = Math.max(0, Math.floor(m.in) - G.in); G.in = Math.max(G.in, Math.floor(m.in));
  if (!d) { persist(); return; }
  gyulExpect(d); save.coins += d; persist(); updateStats();
  const e = net.peersById.get(m.from), who = (e?.nick || (typeof m.nick === 'string' && m.nick.trim() ? m.nick.slice(0, 16) : '러너'));
  const me = runner.root;
  if (e && me) for (let i = 0; i < Math.min(d, 2); i++) fly(handPos(e.runner.root), () => handPos(me), i * 0.08);
  setTimeout(() => coinFx(player.pos.clone().setY(player.pos.y + 1.4), d), 380);
  showLine('from:' + m.from, d, (k) => `${who} 님이 귤 ${k}개를 줬어요`);
  // 꾸벅 인사 (받기 시작할 때 한 번)
  const t = nowS();
  if (t - bowAt > GIVE.lineSec + 1 && !busy() && !player.riding && state.emo) {
    if (e) player.heading = Math.atan2(e.pos.x - player.pos.x, e.pos.z - player.pos.z);
    state.emo.perform('insa');
  }
  bowAt = t;
}
late.giveNet = {
  link(r) {
    if (!r.on) return; room = r;
    r.on('hi', () => { live = true; H.sent.length = 0; });
    r.on('close', () => { live = false; release(); H.queue = 0; H.sent.length = 0; });
    r.on('gave', onGave);
    r.on('got', onGot);
  },
};
late.giveExtra = () => (save.giftOff ? { ng: 1 } : {}); // 받지 않기 (room.js extra)

// ---------- 메뉴: 귤 선물 받기/받지 않기 ----------
{ const b = $('menu-gift'); if (b) { const sync = () => { b.setAttribute('aria-pressed', String(!save.giftOff)); b.textContent = save.giftOff ? '귤 선물: 안 받음' : '귤 선물: 받음'; }; sync(); b.hidden = true; setTimeout(() => { const f = () => { b.hidden = !state.account?.loggedIn; }; f(); state.account?.on?.(f); }, 0); /* 로그인한 사람만 받을 수 있음 (계정은 start.js 가 만듦) */
  b.addEventListener('click', () => { if (save.giftOff) delete save.giftOff; else save.giftOff = 1; persist(); state.account?.push?.(); sync(); }); } }

// ---------- 동료(#172)에게: 말 걸기 창의 '귤 주기' ----------
const MATE_THANKS = ['고마워요!', '와, 귤이다! 잘 먹을게요', '덕분에 힘이 나요', '귤 최고!', '이따 같이 나눠 먹어요'];
const MG = (save.mateGift && typeof save.mateGift === 'object') ? save.mateGift : (save.mateGift = {});
function giveMate() {
  const m = late.mateTalkNow?.(); if (!m) return;
  const day = kstDay(Date.now()); if (MG.day !== day) { MG.day = day; MG.n = 0; }
  if (MG.n >= GIVE.mate.dayMax) { toast('오늘은 동료에게 충분히 줬어요'); return; }
  if (save.coins < 1) { toast('귤이 없어요'); return; }
  MG.n++; save.coins -= 1; persist(); updateStats(); ach.emit('gift-give', 1);
  const me = runner.root;
  if (me) fly(handPos(me), () => handPos(m.r.root));
  const L = MATE_THANKS[Math.floor(Math.random() * MATE_THANKS.length)];
  late.mateSay?.(m, L);
  showLine('mate:' + m.def.id, 1, (k) => `${m.def.name}에게 귤 ${k}개`);
}
{ const acts = document.querySelector('#mate-talk .mt-acts'); if (acts) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small'; b.id = 'mt-gift'; b.textContent = '귤 주기'; acts.prepend(b); b.addEventListener('click', giveMate); } }

let lastT = nowS();
export function tickGive(dt) { const t = nowS(), rdt = Math.min(1, Math.max(0, t - lastT)); lastT = t; tickHold(rdt); tickFlies(dt); } // 주는 빠르기는 실제 시간으로 (느린 기기에서 프레임 dt 가 0.05 로 잘려도 초당 개수 그대로)
late.tickGive = tickGive;
late.give = {
  state: () => ({ live, target: tgt?.peer || null, on: !!H.on, why: H.why || '', queue: H.queue, sent: [...H.sent], gift: { ...gf() }, coins: save.coins, off: !!save.giftOff, mate: { ...MG }, line: { ...line } }),
  target: () => { const e = findTarget(); return e && { peer: e.peer, nick: e.nick, d: +e.pos.distanceTo(player.pos).toFixed(2) }; },
  press, release, mate: giveMate,
  fake: (m) => (m.in != null ? onGot({ from: 'x', nick: '검사', n: 1, ...m }) : onGave({ to: 'x', n: 1, ...m })),
};
