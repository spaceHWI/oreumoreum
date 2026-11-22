// 멀티 노루 (#92). 서버 방이 있을 때만 움직이고, 혼자 하기(서버 주소 없음)에서는 아무것도 하지 않는다
// - 노루 무리는 방이 주인: 방장(먼저 온 사람)이 노루를 움직여 DEER.netMs 마다 {t:'deer'} 로 알리고, 다른 사람은 받은 자리로 부드럽게 잇는다 (life.remote)
//   방장이 나가면 다음 방장이 지금 자리에서 이어 움직인다. 다 핀 구역 노루·'노루가 지나감'(#89)도 방장 화면에서만 생기고 똑같이 알린다
// - 노루 타기: 누가 어느 노루를 탔는지 방이 관리 ({t:'mount'}·{t:'rides'}, 한 마리에 한 사람, 끊기면 풀림). 탄 사람 화면에서 몰고,
//   다른 사람은 presence dr(탄 노루)로 걸터앉은 자세(ride.js peerRide)와 노루가 그 사람 자리로 같이 움직이는 것을 본다
// - 귤 먹이: 방장이 아닌 사람이 던진 귤은 방장에게 부탁({t:'dv', k:'feed'}) → 방장 화면의 노루가 먹으러 가서 그 사람을 따라감
import { DEER, PACE } from '../balance.js';
import { height } from '../world.js';
import { late } from './state.js';
import { spots } from './scene.js';
import { life, player } from './place.js';
import { toast } from './hud.js';
import { net } from './room.js';
import { mountDeer, dismountDeer } from './moves.js';
import { syncBloomDeer, bloomDeer } from './pickup.js';

const ST = ['graze', 'walk', 'alert', 'flee', 'eat', 'follow', 'food', 'ridden']; // 상태는 번호로 보냄
const BUSY = new Set(['flee', 'ridden', 'follow', 'food', 'eat']);
const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
let room = null, live = false, sendT = 0, pending = null, pendT = 0, alertT = 0;
const rides = new Map(); // 노루 id → 탄 사람 id (방이 알려 준 대로)
const visits = []; // 방장이 띄운 '노루가 지나감' [{ list, t }]
const myId = () => room?.id || null;
const isHost = () => live && !!room?.isHost;

function link(r) {
  if (!r.on) return;
  room = r;
  r.on('hi', (m) => { late.newver?.checkMinVer(m.minVer); live = true; setRides(m.rides); setMode(); });
  r.on('host', () => setMode());
  r.on('close', () => { live = false; pending = null; if (player.riding && !player.riding.pal) dismountDeer(); setRides([]); freePeers(); setMode(); }); // 끊기면 내림 → 방에서도 풀림
  r.on('rides', (m) => setRides(m.r));
  r.on('mount', (m) => { if (m.no && pending && pending.id === m.i) { pending = null; toast('다른 사람이 타고 있어요'); } });
  r.on('deer', (m) => { if (life.remote) applyHerd(m.d); });
  r.on('dv', (m) => { if (isHost()) onAsk(m); });
}

function setRides(list) {
  rides.clear();
  if (Array.isArray(list)) for (const a of list) if (Array.isArray(a) && typeof a[0] === 'string' && typeof a[1] === 'string') rides.set(a[0], a[1]);
  // 방이 허락함 → 이제 탐. 그 사이 못 타게 됐으면(가게·동작 중) 바로 풂
  if (pending && rides.get(pending.id) === myId()) {
    const d = pending; pending = null;
    if (d.state === 'flee') d.state = 'walk';
    mountDeer(d, true);
    if (player.riding !== d) room.send({ t: 'unmount' });
  }
}

// 방장 ↔ 받는 쪽 바꾸기
function setMode() {
  const remote = live && !room.isHost;
  if (life.remote && !remote) takeOver();
  life.remote = remote;
  life.others = isHost() ? others : null;
  life.leader = live ? (id) => net.peersById.get(id) || null : null; // 따라갈 사람: e.pos·heading·speed
}
// 방장이 되었거나 방이 끊김: 받은 자리에서 내 화면이 이어 움직임
function takeOver() {
  for (const d of life.deer) {
    d.net = null;
    if (d.state === 'ridden') continue;
    if (BUSY.has(d.state)) { d.state = 'walk'; d.t = 2; }
    d.target = null; d.followUntil = 0; d.followWho = null;
  }
  for (const k in bloomDeer) bloomDeer[k] = null; // 다 핀 구역 노루는 이름(b<구역>-<n>)으로 다시 이어 받음
  syncBloomDeer();
  const known = new Set(visits.flatMap((v) => v.list));
  for (const d of life.deer) if (d.id[0] === 'd' && !known.has(d)) visits.push({ list: [d], t: PACE.delight.deerT }); // 앞 방장이 띄운 '노루가 지나감'
}

// 방장: 노루를 피하게 할 다른 사람들 (매 프레임 한 번 모음)
const oth = [], othPool = [];
function others() { return oth; }
function gatherOthers() {
  oth.length = 0;
  let i = 0;
  for (const e of net.peersById.values()) {
    if (!e.runner.root.visible || e.data.dr) continue;
    const o = othPool[i] || (othPool[i] = { pos: null, fast: false }); i++;
    o.pos = e.pos; o.fast = !!e.data.run || e.speed > 6; oth.push(o);
  }
}

// 방장: 노루 무리 [id, x, z, 방향, 상태, 빠르기, 따라가는 사람]
function herd() {
  const now = performance.now() / 1000, out = [];
  for (const d of life.deer) {
    const s = ST.indexOf(d.state), h = Math.atan2(Math.sin(d.heading), Math.cos(d.heading));
    const a = [d.id, r1(d.pos.x), r1(d.pos.z), r2(h), s < 0 ? 1 : s, r1(Math.max(0, d.speed))];
    if (d.state === 'follow' && d.followUntil > now) a.push(d.followWho || myId());
    out.push(a);
  }
  return out;
}

// 받는 쪽: 방장이 알려 준 노루 무리
function applyHerd(list) {
  if (!Array.isArray(list)) return;
  const seen = new Set();
  for (const a of list) {
    if (!Array.isArray(a) || typeof a[0] !== 'string') continue;
    const [id, x, z, h, s, v, f] = a;
    if (![x, z, h, v].every(Number.isFinite)) continue;
    seen.add(id);
    let d = life.deerById(id);
    if (!d) {
      if (id[0] === 'h') continue; // 무리 노루는 모두 같은 수로 이미 있음
      d = life.addDeer(x, z, 1, [id])[0]; d.pos.set(x, height(x, z), z); d.heading = h;
    }
    if (d === player.riding || d.byPeer) continue; // 탄 노루는 탄 사람이 몲
    const st = ST[s] || 'graze', prev = d.net ? d.net.s : d.state;
    d.net ||= {}; d.net.x = x; d.net.z = z; d.net.h = h; d.net.s = st; d.net.v = v;
    react(d, prev, st, f);
  }
  for (const d of [...life.deer]) if (d.id[0] !== 'h' && !seen.has(d.id) && d !== player.riding) life.removeDeer([d]);
}
// 받는 쪽: 내 가까이에서 일어난 일은 소리·토스트·업적 그대로 (#92: 뱃지·팁은 그대로)
function react(d, prev, st, f) {
  if (st === prev) return;
  const dist = Math.hypot(d.pos.x - player.pos.x, d.pos.z - player.pos.z);
  if (st === 'flee' && dist < 12) late.sound?.deerHop?.();
  if (st === 'alert' && dist < 10 && performance.now() > alertT) { alertT = performance.now() + 25000; toast('노루가 이쪽을 보고 있어요. 천천히 다가가거나 귤을 던져 보세요'); }
  if (st === 'follow' && f && f === myId()) {
    const tg = life.tangerines.find((t) => t.sentFeed === d.id && !t.eaten); if (tg) life.eatTangerine(tg);
    d.mine = true; d.heart.visible = true; d.heartT = 2.5;
    late.sound?.crunch?.(); life.hooks.fed?.('deer'); toast('노루가 귤을 먹고 졸졸 따라와요');
  }
  if (prev === 'follow' && st !== 'follow' && d.mine) { d.mine = false; toast('노루가 제자리로 돌아가요'); }
}

// 받는 쪽: 내가 던진 귤이 노루 가까이 떨어지면 방장에게 먹이 부탁
function askFeed() {
  const now = performance.now();
  for (const tg of life.tangerines) {
    if (!tg.landed || tg.eaten || tg.drop || tg.rest < 0.3) continue;
    if (tg.sentFeed) {
      const d = life.deerById(tg.sentFeed);
      if (d && (d.state === 'food' || d.state === 'eat')) tg.sentAt = now; // 먹으러 오는 중
      else if (now - tg.sentAt > DEER.feedRetry * 1000) { tg.sentFeed = null; tg.claimedBy = null; }
      continue;
    }
    if (tg.claimedBy) continue;
    const p = tg.mesh.position;
    let best = null, bd = DEER.feedR;
    for (const d of life.deer) { if (d.byPeer || d === player.riding || BUSY.has(d.state)) continue; const dd = d.pos.distanceTo(p); if (dd < bd) { bd = dd; best = d; } }
    if (best && room.send({ t: 'dv', k: 'feed', i: best.id, x: r2(p.x), z: r2(p.z) })) { tg.sentFeed = best.id; tg.sentAt = now; tg.claimedBy = best; }
  }
}
// 방장: 다른 사람의 부탁
function onAsk(m) {
  if (!Number.isFinite(m.x) || !Number.isFinite(m.z)) return;
  if (m.k === 'feed') { const d = life.deerById(m.i); if (d && net.peersById.has(m.from)) life.feedAt(d, m.x, m.z, m.from); }
  else if (m.k === 'visit') { if (visits.length >= 3 || (spots.inBounds && !spots.inBounds(m.x, m.z))) return; visits.push({ list: life.addDeer(m.x, m.z, 2), t: PACE.delight.deerT }); }
}

// 다른 사람이 탄 노루: 그 사람 자리로. 방이 풀었으면 놓아 줌
function freePeers() { for (const d of life.deer) if (d.byPeer && (!live || rides.get(d.id) !== d.byPeer)) { d.byPeer = null; d.net = null; if (player.riding !== d) { d.state = 'walk'; d.t = 2; } } }
function ridePeers() {
  const me = myId();
  for (const [id, who] of rides) {
    if (who === me) continue;
    const d = life.deerById(id); if (!d) continue;
    if (d.state !== 'ridden') life.mount(d);
    d.byPeer = who;
    const e = net.peersById.get(who);
    if (e && e.runner.root.visible) { d.pos.set(e.pos.x, height(e.pos.x, e.pos.z), e.pos.z); d.heading = e.heading; d.speed = e.speed; }
  }
  freePeers();
}

// 매 프레임 (update.js, life.update 앞)
function tick(dt) {
  for (let i = visits.length - 1; i >= 0; i--) { const v = visits[i]; v.t -= dt; if (v.t <= 0) { v.list = life.removeDeer(v.list); if (!v.list.length) visits.splice(i, 1); else v.t = 5; } }
  if (!live) return;
  ridePeers();
  if (life.remote) { askFeed(); return; }
  gatherOthers();
  sendT -= dt;
  if (sendT <= 0 && net.count > 0) { sendT = DEER.netMs / 1000; room.send({ t: 'deer', d: herd() }); }
}

export const deerNet = {
  link, tick,
  // 노루 타기: 서버 방이 있으면 방에 물음(true: 기다림). 없으면 false → 바로 탐
  claim(d) {
    if (!live || !room?.open) return false;
    const who = rides.get(d.id);
    if (who && who !== myId()) { toast('다른 사람이 타고 있어요'); return true; }
    if (pending && performance.now() - pendT < 3000) return true;
    pending = d; pendT = performance.now(); room.send({ t: 'mount', i: d.id });
    return true;
  },
  release(d) { d.net = null; if (live && room?.open) room.send({ t: 'unmount' }); },
  askVisit(x, z) { return !!(live && room?.send({ t: 'dv', k: 'visit', x: r1(x), z: r1(z) })); },
  peerDeer(e) { const id = e.data.dr; return live && rides.get(id) === e.peer ? life.deerById(id) : null; },
  get live() { return live; }, get host() { return isHost(); }, rides,
};
late.deerNet = deerNet;
