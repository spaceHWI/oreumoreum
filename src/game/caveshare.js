// 동굴 적 같이 보기 (#205, #195 후속): 같은 동굴 칸(같은 날·같은 층) 사람끼리 적(박쥐·게·지킴이·주인·드론)을 한 사람이 굴림
// - 칸 주인 = 그 칸에 먼저 들어온 사람 (server roomcore caveHostFix → {t:'ch', id, k}). 칸 주인이 나가거나 칸을 옮기면 다음 사람이 받던 적을 그대로 이어 굴림
// - 칸 주인: 방 깨우기(같은 칸 사람이 다가가도, cavelife.js)·주인 깨우기(cavedeep.js)·적 AI. 적은 가장 가까운 같은 칸 사람을 쫓음(enemies.js hooks.aimOf)
//   NET.caveSendMs 마다 {t:'cs', k, e, w, g}: e = [번호, 종류, x, z, 방향, 상태, 기운, 최대, 역할(0 보통·1 지킴이·2 주인·3 드론)] · w 깬 방(비트) · g 1 지킴이 물러남 + 2 주인 깨어남
// - 받는 쪽: 같은 번호의 적을 만들어 받은 자리로 옮겨 그림(e.net). 맞힌 피해는 {t:'cx', h:[[번호, 피해]…]} 로 칸 주인에게(서버가 NET.bossHitMax 로 자름)
//   돌진·광선 맞음은 각자 화면에서 제 캐릭터만 셈(boss.js 와 같음). 내가 맞힌 적이 쫓겨나면 내 보상(enemies.repelNet). 칸 주인은 제가 맞힌 적만 보상(enemies.hurtNet)
// - 주인 큰 보상·상자는 지금처럼 사람마다 하루 한 번(cavedeep.js save.cave.boss·chest, 서버 earn.js 8). 함정·낙석은 각자 화면
// - 칸 주인 알림·적 상태가 NET.caveWaitSec 안 오면(옛 서버·옛 클라이언트 칸 주인) 내 화면에서 굴림. 칸이 다른 사람에게는 보내지 않음(서버가 막음)
// (파일 순서는 src/modules.js: caveextra 뒤. late.caveTick·caveFloorOff·caveOut 을 감쌈)
// dev: __oreum.cave (share·netMobs·hitNet)
import * as THREE from 'three';
import { CAVE, NET } from '../balance.js';
import { netCave } from '../net.js';
import { height } from '../world.js';
import { state, late } from './state.js';
import { player, life } from './place.js';

const KINDS = ['bat', 'crab', 'robot', 'drone'], STATES = ['wander', 'charge', 'wind', 'dash', 'stagger', 'back', 'flee', 'leave', 'root', 'calm', 'boss'];
const KI = Object.fromEntries(KINDS.map((k, i) => [k, i])), SI = Object.fromEntries(STATES.map((k, i) => [k, i]));
const G = CAVE.mobs.guard, OW = CAVE.owner, W = NET.caveWaitSec;
const nowS = () => performance.now() / 1000;
const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
const key = () => (netCave.at ? netCave.fi + 1 + ':' + netCave.day : '');
const CL = () => late.caveFloorNow?.(), DD = () => late.caveDeep?.D;
const inList = (e) => life.enemies.list.includes(e);
const role = (e) => (e.guard ? 1 : e.owner ? 2 : e.kind === 'drone' ? 3 : 0);

let room = null, live = false;
// hostId·hostKey: 서버가 알려 준 칸 주인, keyT: 이 칸에 들어온 때, chT: 칸 주인 알림 받은 때, csT: 적 상태 받은 때
const S = { hostId: null, hostKey: '', lastKey: '', keyT: 0, chT: 0, csT: 0, sendT: 0, hitT: 0, nid: 0, was: true, P: new Map(), hit: new Map(), peers: [], sent: 0, got: 0, mode: 'local' };

function amHost() {
  if (!live || !state.cave || !room?.id) return true;
  const k = key(), t = nowS();
  if (S.hostKey === k) return S.hostId === room.id || t - Math.max(S.csT, S.chT, S.keyT) > W; // 칸 주인이 적을 안 보냄 (옛 클라이언트) → 내 화면에서
  return t - S.keyT > W; // 칸 주인 알림이 없음 (옛 서버)
}

/* ---------- 칸 주인이 바뀜 ---------- */
// 받던 적을 내가 굴림: 번호는 그대로
function promote() {
  for (const e of S.P.values()) {
    if (!inList(e)) continue;
    e.net = null; e.remoteHurt = null; e.tgt = null;
    if (e.owner) e.calls = OW.call.at.filter((a) => e.hp / e.def.hp < a).length; // 지난 드론 부르기는 다시 안 함
    if (e.state === 'boss' || e.state === 'calm') e.state = 'charge';
    e.st = 0;
  }
  S.P.clear(); S.mode = 'host';
}
// 내가 굴리던 적을 지움 (칸 주인이 알려 줄 것으로 다시 만듦). 지킴이·주인이 '사라짐' 으로 보이지 않게 먼저 끊음
function demote() {
  const c = CL(), d = DD();
  if (c) { c.mobs = []; c.guard = null; }
  if (d) { d.owner = null; d.calls = []; }
  for (const e of life.enemies.list.slice()) if (e.cave && !e.net) life.enemies.remove(e);
  S.P.clear(); S.mode = 'puppet';
}

/* ---------- 받는 쪽 ---------- */
function netCtl(e, dt) {
  const n = e.tgt; if (!n) return 0;
  const k = Math.min(1, dt * 9), ox = e.pos.x, oz = e.pos.z, x = ox + (n.x - ox) * k, z = oz + (n.z - oz) * k;
  e.pos.set(x, height(x, z), z);
  e.heading += Math.atan2(Math.sin(n.h - e.heading), Math.cos(n.h - e.heading)) * k;
  return Math.hypot(x - ox, z - oz) / Math.max(dt, 1e-3);
}
function sendHit(e, d) { if (e.nid == null) return; e.hitByMe = true; S.hit.set(e.nid, (S.hit.get(e.nid) || 0) + d); if (S.hitT <= 0) S.hitT = 0.25; }
function makePuppet(kind, rl, x, z) {
  const c = CL(); if (!c?.F) return null;
  let e = null;
  if (rl === 2) e = late.caveDeep?.owner(x, z) || null;
  else if (rl === 1) { e = life.enemies.spawnStory(G.kind, x, z, { id: 'cave', k: G.k, over: { name: G.name, hp: G.hp, dmg: G.dmg, walk: G.walk, reward: { gyul: G.gyul, rare: 0.25 }, life: 1e9 } }); e.guard = true; e.home = new THREE.Vector3(x, 0, z); c.guard = e; c.mobs.push(e); }
  else if (rl === 3) { e = life.enemies.spawnStory('drone', x, z, { id: 'cave' }); late.caveDeep?.call(e); }
  else { e = life.enemies.spawnStory(kind, x, z, { id: 'cave' }); c.mobs.push(e); }
  if (!e) return null;
  e.cave = true; e.net = netCtl; e.remoteHurt = (d) => sendHit(e, d);
  return e;
}
function drop(e) { // 칸 주인 목록에서 빠짐 (쫓겨나 멀리 감·층이 바뀜): 보상 없이 지움
  const c = CL(), d = DD();
  if (c?.guard === e && e.state !== 'flee') c.guard = null;
  if (d?.owner === e && e.state !== 'flee') d.owner = null;
  if (inList(e)) life.enemies.remove(e);
}
function onCs(m) {
  if (!state.cave || amHost() || m.k !== key() || !Array.isArray(m.e)) return;
  S.csT = nowS(); S.got++;
  const c = CL(); if (!c?.F) return;
  if (Number.isInteger(m.w)) for (const r of c.rooms) if (r.i < 31 && (m.w >> r.i) & 1) r.woke = true;
  if (m.g & 1 && !c.guard) c.guardDone = true; // 지킴이는 이미 물러남 (내가 오기 전)
  if (m.g & 2) late.caveDeep?.setSeen();
  const seen = new Set();
  for (const row of m.e) {
    if (!Array.isArray(row) || row.length < 9) continue;
    const [i, k, x, z, h, s, hpv, max, rl] = row, kind = KINDS[k], st = STATES[s] || 'charge';
    if (!kind) continue;
    seen.add(i);
    let e = S.P.get(i);
    if (e && !inList(e)) { S.P.delete(i); e = null; }
    if (!e) {
      if (st === 'flee' || st === 'leave') continue;
      e = makePuppet(kind, rl | 0, x, z); if (!e) continue;
      e.nid = i; S.P.set(i, e); e.heading = h;
    }
    e.tgt = { x, z, h };
    if (st !== e.state) {
      const was = e.state; e.state = st; e.st = 0;
      if (st === 'flee' || st === 'leave') e.bar.g.visible = false;
      if (st === 'flee' && was !== 'flee' && e.hitByMe && !e.owner) life.enemies.repelNet(e); // 주인 큰 보상은 cavedeep.js ownerGone
    }
    e.def.hp = Math.max(1, max); e.hp = Math.max(0, Math.min(e.def.hp, hpv));
  }
  for (const [i, e] of S.P) if (!seen.has(i)) { S.P.delete(i); drop(e); }
}

/* ---------- 칸 주인 ---------- */
function onCx(m) {
  if (!state.cave || !amHost() || !Array.isArray(m.h)) return;
  for (const r of m.h) {
    if (!Array.isArray(r)) continue;
    const e = life.enemies.list.find((o) => o.cave && !o.net && o.nid === r[0]);
    if (e && r[1] > 0) life.enemies.hurtNet(e, Math.min(NET.bossHitMax, r[1]));
  }
}
function sendState() {
  const c = CL(), d = DD(); if (!c?.F) return;
  const rows = [];
  for (const e of life.enemies.list) {
    if (!e.cave || e.net || KI[e.kind] == null) continue;
    if (e.nid == null) e.nid = ++S.nid;
    rows.push([e.nid, KI[e.kind], r1(e.pos.x), r1(e.pos.z), r2(e.heading), SI[e.state] ?? 1, Math.ceil(e.hp), Math.round(e.def.hp), role(e)]);
    if (rows.length >= NET.caveEnemyMax) break;
  }
  let w = 0; for (const r of c.rooms) if (r.woke && r.i < 31) w |= 1 << r.i;
  room.send({ t: 'cs', k: key(), e: rows, w, g: (c.guardDone ? 1 : 0) | (d?.ownerSeen ? 2 : 0) }); S.sent++;
}
// 적이 쫓을 사람: 나보다 가까운 같은 칸 사람 (쓰러진 나는 빼고)
life.hooks.aimOf = (e) => {
  if (!S.peers.length || !state.cave) return null;
  let best = null, bd = player.down ? Infinity : Math.hypot(player.pos.x - e.pos.x, player.pos.z - e.pos.z);
  for (const p of S.peers) { const dd = Math.hypot(p.x - e.pos.x, p.z - e.pos.z); if (dd < bd) { bd = dd; best = p; } }
  return best;
};

/* ---------- 매 프레임 (동굴 안에서만) ---------- */
function pre() {
  const k = key(), t = nowS();
  if (k !== S.lastKey) { S.lastKey = k; S.keyT = t; S.csT = 0; S.P.clear(); S.hit.clear(); }
  S.peers.length = 0;
  if (live && late.net?.peersById) for (const e of late.net.peersById.values()) if (e.ck === k && e.runner.root.visible) S.peers.push(e.pos);
  const h = amHost();
  if (h !== S.was) { S.was = h; if (h) promote(); else demote(); }
  if (!live) S.mode = 'local';
}
function post(dt) {
  if (!live || !room?.open) return;
  if (S.was) { if (S.peers.length && (S.sendT -= dt * 1000) <= 0) { S.sendT = NET.caveSendMs; sendState(); } return; }
  if (S.hitT > 0 && (S.hitT -= dt) <= 0 && S.hit.size) { room.send({ t: 'cx', h: [...S.hit].slice(0, 8).map(([i, d]) => [i, r1(d)]) }); S.hit.clear(); }
}
{
  const tk = late.caveTick, off = late.caveFloorOff, out = late.caveOut;
  late.caveTick = (dt, F) => { pre(); tk(dt, F); post(dt); };
  late.caveFloorOff = () => { S.P.clear(); S.hit.clear(); off(); };
  late.caveOut = (downed) => { S.P.clear(); S.hit.clear(); S.lastKey = ''; S.was = true; out(downed); };
}
late.caveHost = () => S.was;
late.cavePeers = () => S.peers;
late.caveNet = {
  link(r) {
    if (!r.on) return; room = r;
    r.on('hi', () => { live = true; });
    r.on('close', () => { live = false; S.hostId = null; S.hostKey = ''; });
    r.on('ch', (m) => { if (typeof m.id !== 'string' || typeof m.k !== 'string') return; S.hostId = m.id; S.hostKey = m.k; S.chT = nowS(); });
    r.on('cs', onCs); r.on('cx', onCx);
  },
};

// ---------- 확인용 (__oreum.cave 에 더함) ----------
Object.assign(late.caveApi || (late.caveApi = {}), {
  share: () => ({ live, host: amHost(), mode: S.mode, key: key(), hostId: S.hostId, hostKey: S.hostKey, me: room?.id || null, puppets: S.P.size, peers: S.peers.length, sent: S.sent, got: S.got }),
  netMobs: () => life.enemies.list.filter((e) => e.cave).map((e) => ({ nid: e.nid ?? null, kind: e.kind, hp: Math.round(e.hp), max: Math.round(e.def.hp), state: e.state, net: !!e.net, role: role(e) })),
  hitNet: (nid, d = 20) => { const e = life.enemies.list.find((o) => o.cave && o.nid === nid); if (!e) return false; life.enemies.hurt(e, d, true); return true; },
});
