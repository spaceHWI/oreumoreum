// 방 하나의 규칙 (#7). Cloudflare 와 상관없는 순수 JS 라 Node 에서 그대로 재 볼 수 있음 (bench.mjs, tools/loadtest.js)
// 받는 것 (JSON 문자열):
//   {t:'p', d:{x,z,h,…}}  내 상태 (위치·방향·동작·옷·탈것·말·이모티콘…, net.js 의 presence 그대로). o·nick 은 바뀔 때만 와도 됨 (#115)
//   {t:'take', h, n?}     더미 h 에서 n(없으면 1)개 주움 → 남은 수를 다음 틱에 방 전체에 {t:'hs'}. 로그인한 사람이면 주운 수 × 더미 값(HEAP_GYUL)을 번 몫으로 셈 (#144)
//   {t:'put', h, n}       다시 쌓기 (투기꾼·트럭·몹). 방장과 움직이는 사람만 (#131), 한 사람 putPerMin·방 전체 putPerMin × crowd^DUMP.crowdExp
//   {t:'btake', h}        동료(#172)가 더미 h 에서 하나 줄임. 번 몫엔 안 셈, 더미의 마지막 BUDDIES.keep 은 남김
//   {t:'ping', c}         → {t:'pong', c}
//   {t:'stats'}           → {t:'stats', …} (STATS_OPEN 일 때만)
// 노루 (#92):
//   {t:'deer', d:[…]}     노루 무리 자리. 방장만, 다른 사람 모두에게 그대로 {t:'deer', d}
//   {t:'dv', k, i, x, z}  방장에게 부탁 (k 'feed': i 노루에게 x,z 귤 먹이, 'visit': x,z 에 노루가 지나감) → 방장에게만 {…, from}
//   {t:'mount', i}        노루 i 타기. 비었으면 방 전체에 {t:'rides', r:[[노루, 사람]…]}, 누가 타고 있으면 보낸 사람에게 {t:'mount', i, no:1}
//   {t:'unmount'}         내리기 → {t:'rides'}. 나가면(끊기면) 저절로 풀림
// 보안 (#84): 이동은 NET.maxSpeed 로 판정해 넘으면 {t:'pos', x, z} 로 되돌림(순간 이동은 warpGap 초에 한 번만 받아 줌),
//   줍기는 takePerSec, 못 주우면 {t:'h', h, n, no:1} (주운 사람이 배낭에서 하나 되돌림), 닉네임·말풍선 글은 다듬어서만 돌림,
//   되돌리기·버린 메시지가 쌓이면 {t:'kick'} 후 끊고 그 계정·주소는 banSec 초 동안 못 들어옴 ({t:'ban'})
// 구역 지킴이 돌하르방 (#119): 줍기로 한 구역 더미가 모두 0 이 된 순간(지킴이가 없거나 ZONE_GUARD.holdSec 이 지났으면) 그 시각을 기억하고 방 전체에 {t:'zg', z, at}.
//   hi 의 zg = [[구역, 세운 시각 ms]…] (아직 서 있는 것만). 다시 쌓여도 지우지 않음(시간으로만). 옛 클라이언트는 모르는 메시지·칸이라 그냥 넘김
// 구역 우두머리 (#139): 방장이 굴림. 따로 셈(NET.bossPerSec·bossMax)
//   {t:'bs', z, s?, a?, gone?, done?, f?}  방장만 → 다른 사람 모두에게 (자리·기운·패턴, 사라짐, 쫓아냄과 낀 사람 id)
//   {t:'bh', z, d}  우두머리를 맞힌 피해 → 방장에게만 {t:'bh', z, d(≤ bossHitMax), from}
//   {t:'bd', z}     방장만: 쫓아냄 → 그 구역 돌하르방을 세움 (서 있지 않을 때만, zg 로 알림)
// 엔딩 (#168): {t:'end'} 내가 오름의 비밀을 밝힘(구역 5 우두머리 뒤) → 그날(한국 날짜) 이 방 첫 번째면 방 전체에 {t:'end', at, by, names}, 아니면 보낸 사람에게만 {…, solo:1}
//   그날 두 번째부터는 나머지 사람에게 {t:'endr', by} (오름 방송 한 줄). at = 지금 + STORY.end.lead 초 (모두 같은 시각에 시네마틱을 시작). 도중에 들어온 사람은 hi 의 end = [at, by, names] 로 남은 부분부터
// 귤 주기 (#175): {t:'give', to, n}  로그인한 두 사람이 GIVE.serverR 안일 때 n(≤ GIVE.burst)개. 초당 GIVE.perSec (토큰 통). 계정(Accounts.gift)이 가진 귤·하루 상한을 보고 옮김
//   → 준 사람에게 {t:'gave', to, n: 옮긴 수, out: 준 누적, no?: 못 옮긴 까닭}, 받는 사람에게 {t:'got', from, nick, n, in: 받은 누적}. 클라이언트는 누적으로만 귤을 맞춤(두 번 세지 않게)
//   presence 의 ac = 1 은 서버가 붙이는 '로그인한 사람' 표시 (손님에게는 귤 주기 버튼이 안 나옴). 옛 클라이언트는 모르는 메시지·칸이라 그냥 넘김
// 같이 있는 사람 수 (#131): crowd = 최근 DUMP.crowdActive 초 안에 crowdMove m 넘게 움직였고 튜토리얼 중(presence tu)이 아닌 사람 수, crowdFollow 초에 걸쳐 따라감.
//   hi 의 np, 바뀌면 방 전체에 {t:'np', n} (0.1 단위). 빈 방 (#131): 마지막 사람이 나간 시각(seen)에서 다음 사람이 들어올 때까지 빈 시간만큼 방이 직접 채움 (src/refill.js), 채운 수는 hi 의 fill
// 오래 멈춤 (#157): presence 의 a:1 = '지난 NET.idleBeatMs 안에 조작 있음' (받으면 지우고 그 시각만 기억, 남에게 안 보냄).
//   마지막 a:1 뒤 NET.idleKickSec 가 지나면 {t:'idle'} 후 연결을 닫음(4004, 클라이언트는 자동 재접속 안 함). 어드민(x-adm)은 빼고,
//   a 를 한 번도 안 보낸 연결(옛 클라이언트)도 닫지 않음. {t:'idle', s} 는 STATS_OPEN(로컬 확인)일 때만: 그 사람의 기준 초를 s 로 (tools/online.js)
// 오름 레이드 (#181, src/raidcore.js): 방이 시각·시작·끝·기운·더미·기여·보상을 셈. 따로 셈(NET.raidPerSec·raidMax)
//   {t:'rj'} 레이드 자리에 옴(참가 수) · {t:'rh', d} 피해(사람마다 초당 RAID.dps 까지만) · {t:'rp', i} 부서진 더미 i 에서 하나 · {t:'rs', s, a?} 방장만: 몸 자리·패턴 → 다른 사람 모두에게
//   {t:'rgo', f?} 바로 열기 (STATS_OPEN 방·어드민만, f:1 은 STATS_OPEN 방만 남은 레이드를 지우고) → 방 전체에 {t:'rv', s, h?} (hi 의 raid 에도), 성공하면 보탠 사람마다 {t:'rw', g, box, xp, top} 이고 로그인한 사람은 g 를 번 몫(#144)에 넣음
// 동굴 적 같이 보기 (#205): 같은 동굴 칸(ck)에서 먼저 들어온 사람이 칸 주인. 바뀌면(들어옴·나감·칸 옮김) 그 칸 사람 모두에게 {t:'ch', id, k}, 새로 온 사람에게도 한 번
//   {t:'cs', k, e, w?, g?} 칸 주인만(k 는 지금 칸과 같아야 함) → 같은 칸 다른 사람에게 (적 [번호, 종류, x, z, 방향, 상태, 기운, 최대, 역할]…, 깬 방 w, 지킴이·주인 g). 칸이 다른 사람에게는 안 감
//   {t:'cx', h:[[번호, 피해]…]} 칸 주인 아닌 사람 → 칸 주인에게만 {t:'cx', h(피해 ≤ bossHitMax), from}. 따로 셈(NET.cavePerSec·caveMax)
// 보내는 것: {t:'hi', id, host, heaps, sig, seen, now, cap, rides, minVer, zg, np, fill} / {t:'u', p:[[id, presence]…]} (presence 의 o·nick 은 바뀐 때만, 받는 쪽이 앞 값에 덮어씀) / {t:'l', id} / {t:'host', id} / {t:'hs', hs:[[h, n]…]} (틱마다 모아서) / {t:'h', h, n} (보낸 사람에게만 바로잡기) / {t:'full'}
import { NET, ZONE_GUARD, BUDDIES, LEVEL, STORY, DUMP, GIVE, CAVE } from '../../src/balance.js';
import { offlineAdds, crowdMul, floorAdds } from '../../src/refill.js';
import { HEAP_FULL, HEAP_SIG, HEAP_GYUL, HEAP_DEFS } from './heaps.js';
import { cleanText, nickBad } from '../../src/safetext.js';
import { TITLES } from '../../src/punktext.js';
import { createRaid } from '../../src/raidcore.js';

const MIN_VER = '0.24.0'; // 이보다 낮은 버전의 게임엔 닫을 수 없는 새로고침 알림 (#134, #145)
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isDeerId = (v) => typeof v === 'string' && /^[a-z0-9-]{1,12}$/.test(v); // 노루 이름 (#92)

export function createRoomCore({ cap = NET.roomCap, now = () => Date.now(), heaps = null, seen = 0, stats = false, guards = null, gift = null } = {}) { // gift(주는 계정, 받는 계정, n) → Promise<{got, why, out, in}> (#175, room.js 가 Accounts.gift 로)
  const peers = new Map(); // id → peer
  let H = Array.isArray(heaps) && heaps.length === HEAP_FULL.length ? heaps.map((v, i) => Math.max(0, Math.min(HEAP_FULL[i], v | 0))) : HEAP_FULL.slice();
  const heapOut = new Map(); // 이번 틱에 바뀐 더미 → 틱마다 한 번에 알림
  const earned = new Map(); // 계정 → 받아 준 줍기로 번 몫 (#144). room.js 가 earnFlushMs 마다 꺼내 계정(Accounts.earn)에 넘김
  let heapsDirty = false, roomSeen = seen || 0, host = null, nextId = 1, tick = 0;
  // 같이 있는 사람 수 (#131)
  const HZ = HEAP_DEFS.map((d) => d.zone);
  let crowd = 1, crowdT = now(), npSent = 1, npT = 0, roomPut = NET.putBurst, roomPutT = now();
  const r1 = (v) => Math.round(v * 10) / 10;
  const activeN = (t) => { let n = 0; for (const p of peers.values()) if (!p.tu && t - p.actT < DUMP.crowdActive * 1000) n++; return n; };
  function followCrowd(t) {
    const dt = Math.max(0, (t - crowdT) / 1000); crowdT = t; if (!dt) return;
    const want = Math.max(1, activeN(t)); crowd += (want - crowd) * (1 - Math.exp(-dt * 3 / DUMP.crowdFollow)); // crowdFollow 초면 95%
    if (Math.abs(want - crowd) < 0.05) crowd = want;
  }
  // 빈 방이던 동안 몫을 채움: 채운 수
  function fillEmpty(t) {
    if (!(roomSeen > 0) || t <= roomSeen) return 0;
    let got = 0;
    for (const [i, n] of offlineAdds(H, HEAP_FULL, HZ, (t - roomSeen) / 1000)) { H[i] = Math.min(HEAP_FULL[i], H[i] + n); got += n; heapOut.set(i, H[i]); }
    if (got) heapsDirty = true;
    return got;
  }
  // 구역 지킴이 (#119): 구역 → 세운 시각(ms). room.js 가 저장·불러옴
  const ZH = {}; HEAP_DEFS.forEach((d, i) => { (ZH[d.zone] ||= []).push(i); });
  // 바닥 보장 (#300, src/refill.js floorAdds): 구역별 활동 인원(presence zn, 튜토리얼 빼고 최근 움직인 사람) → 모자라면 사람 가까이(nh) 아닌 더미부터 조용히 채움
  // 깨끗함과 나눔: 바닥 보장이 돈 구역(zoneFloor)은 지킴이 뒤 주운 수(zonePick)가 구역 가득을 넘으면 더미가 다 비지 않아도 지킴이가 섬
  const ZFULL = {}; HEAP_DEFS.forEach((d, i) => { ZFULL[d.zone] = (ZFULL[d.zone] || 0) + HEAP_FULL[i]; });
  const zonePick = {}, zoneFloor = {}; let floorT = 0;
  const floorStat = { adds: 0, ticks: 0 };
  function floorTick(t) {
    const dt = floorT ? Math.min(10, (t - floorT) / 1000) : DUMP.floor.every; floorT = t;
    const act = {}, near = new Set();
    for (const p of peers.values()) {
      if (Array.isArray(p.nh)) for (const i of p.nh) near.add(i);
      if (p.tu || !p.zn || t - p.actT >= DUMP.crowdActive * 1000) continue;
      act[p.zn] = (act[p.zn] || 0) + 1;
    }
    const up = {}; for (const z of Object.keys(ZH)) up[z] = !!(G.get(+z) && t - G.get(+z) < holdMs());
    let got = 0;
    for (const [i, n] of floorAdds(H, HEAP_FULL, HZ, act, near, up, dt)) { H[i] = Math.min(HEAP_FULL[i], H[i] + n); got += n; heapOut.set(i, H[i]); const z = HEAP_DEFS[i].zone; zoneFloor[z] = (zoneFloor[z] || 0) + n; }
    if (got) { heapsDirty = true; floorStat.adds += got; floorStat.ticks++; }
  }
  function zonePicked(z, n, t) {
    zonePick[z] = (zonePick[z] || 0) + n;
    if (zoneFloor[z] > 0 && zonePick[z] >= ZFULL[z]) raiseGuard(z, t);
  }
  const G = new Map(); let guardsDirty = false;
  if (Array.isArray(guards)) for (const a of guards) if (Array.isArray(a) && ZH[a[0]] && isNum(a[1]) && a[1] > 0) G.set(a[0], a[1]);
  const holdMs = () => ZONE_GUARD.holdSec * 1000;
  const guardList = (t) => { for (const [z, at] of G) if (t - at >= holdMs() || at > t + 60000) { G.delete(z); guardsDirty = true; } return [...G]; };
  const guardOut = []; // 이번 틱에 선 것 → hs 뒤에 알림 (꽃이 먼저 피게)
  function zoneEmptied(z, t) {
    if (!ZH[z] || ZH[z].some((i) => H[i] > 0)) return;
    raiseGuard(z, t);
  }
  function raiseGuard(z, t) {
    if (!ZH[z]) return;
    const at = G.get(z); if (at && t - at < holdMs()) return; // 서 있는 동안은 그대로
    G.set(z, t); guardsDirty = true; guardOut.push([z, t]); zonePick[z] = 0; zoneFloor[z] = 0; // #300: 지킴이가 서면 바닥 보장 셈도 새로
  }
  let endDay = '', endMsg = null; // 엔딩 (#168): 오늘 모두에게 튼 날짜, 그 메시지 {at, by, names}
  const kstDay = (t) => new Date(t + 9 * 3600e3).toISOString().slice(0, 10);
  const endLive = (t) => (endMsg && t < endMsg.at + STORY.end.len * 1000 ? [endMsg.at, endMsg.by, endMsg.names] : undefined);
  const isZone = (z) => Number.isInteger(z) && !!ZH[z];
  const numArr = (a, n) => Array.isArray(a) && a.length <= n && a.every(isNum);
  const raid = createRaid({ now, send: (id, o) => { const s = JSON.stringify(o); if (!id) { all(s); return; } const q = peers.get(id); if (q) out(q, s); }, who: (id) => { const q = peers.get(id); return q ? { acct: q.acct, nick: cleanText(q.d?.nick || '', NET.nickMax), here: true } : { here: false }; } });
  const st = { bytesOut: 0, msgsOut: 0, msgsIn: 0, dropped: 0, ticks: 0, moveBack: 0, kicks: 0, takeNo: 0 };
  const bans = new Map(); // 계정·주소 키 → 풀리는 시각 (ms)
  const rides = new Map(); // 노루 이름 → 탄 사람 id (#92). 한 마리에 한 사람
  const ridesMsg = () => JSON.stringify({ t: 'rides', r: [...rides] });
  function unride(p) { let ch = false; for (const [i, id] of rides) if (id === p.id) { rides.delete(i); ch = true; } return ch; }

  const out = (p, s) => { st.bytesOut += s.length; st.msgsOut++; try { p.send(s); } catch (e) { /* 끊긴 소켓 */ } };
  const all = (s, except) => { for (const p of peers.values()) if (p !== except) out(p, s); };
  const refill = (p, t) => { const dt = (t - p.tT) / 1000; p.tT = t; p.tok = Math.min(NET.msgPerSec, p.tok + dt * NET.msgPerSec); p.putTok = Math.min(NET.putBurst, p.putTok + dt * NET.putPerMin / 60); p.hitTok = Math.min(NET.hitPerSec, p.hitTok + dt * NET.hitPerSec); p.takeTok = Math.min(NET.takePerSec, p.takeTok + dt * NET.takePerSec); p.deerTok = Math.min(NET.deerPerSec, p.deerTok + dt * NET.deerPerSec); p.bossTok = Math.min(NET.bossPerSec, p.bossTok + dt * NET.bossPerSec); p.giveTok = Math.min(GIVE.perSec, p.giveTok + dt * GIVE.perSec); p.raidTok = Math.min(NET.raidPerSec, p.raidTok + dt * NET.raidPerSec); p.caveTok = Math.min(NET.cavePerSec, p.caveTok + dt * NET.cavePerSec); };
  // 최근 strikeWin 초 안의 횟수 세기
  const count = (arr, t) => { while (arr.length && t - arr[0] > NET.strikeWin * 1000) arr.shift(); return arr.length; };
  function kick(p, why) {
    const t = now(); st.kicks++;
    for (const k of [p.acct && 'a:' + p.acct, p.key && 'k:' + p.key]) if (k) bans.set(k, t + NET.banSec * 1000);
    out(p, JSON.stringify({ t: 'kick', why, sec: NET.banSec }));
    leave(p); try { p.close?.(4003, why); } catch (e) { /* 이미 끊김 */ }
  }
  function strike(p, why) { p.strikes.push(now()); if (count(p.strikes, now()) > NET.strikeMax) kick(p, why); }
  function drop(p) { st.dropped++; p.drops.push(now()); if (count(p.drops, now()) >= NET.dropKick) kick(p, 'flood'); }
  function banned(info, t) {
    for (const k of [info.acct && 'a:' + info.acct, info.key && 'k:' + info.key]) { if (!k) continue; const u = bans.get(k); if (u > t) return Math.ceil((u - t) / 1000); if (u) bans.delete(k); }
    return 0;
  }
  function pickHost() { let h = null; for (const p of peers.values()) if (!h || p.joinAt < h.joinAt) h = p; const id = h ? h.id : null; if (id !== host) { host = id; if (id) all(JSON.stringify({ t: 'host', id })); } }

  function join(send, info = {}) {
    const t = now();
    const bs = banned(info, t); if (bs) { try { send(JSON.stringify({ t: 'ban', sec: bs })); } catch (e) { /* 무시 */ } return null; }
    if (peers.size >= cap) { try { send(JSON.stringify({ t: 'full' })); } catch (e) { /* 무시 */ } return null; }
    const p = { id: 'p' + (nextId++), send, acct: info.acct || null, joinAt: t + nextId * 1e-6, d: null, pj: null, x: 0, z: 0, ver: 0, sent: new Map(), sentCk: new Map(), ck: '', ckAt: 0, sj: null, fj: null, sver: 0, sentSlow: new Map(), tok: NET.msgPerSec, tT: t, putTok: NET.putBurst, hitTok: NET.hitPerSec, lastHt: 0,
      key: info.key || null, close: info.close || null, adm: !!info.adm, raidTok: NET.raidPerSec, caveTok: NET.cavePerSec, opT: 0, idleSec: 0, has: false, mx: 0, mz: 0, mT: t, warpT: -1e12, tubeT: -1e12, actT: -1e12, ax: 0, az: 0, tu: false, strikes: [], drops: [], takeTok: NET.takePerSec, deerTok: NET.deerPerSec, bossTok: NET.bossPerSec, giveTok: GIVE.perSec };
    const fill = peers.size ? 0 : fillEmpty(t); // 첫 사람이면 빈 동안 몫부터 (#131)
    if (!peers.size) { crowd = 1; crowdT = t; npSent = 1; }
    peers.set(p.id, p); roomSeen = t;
    if (!host) host = p.id;
    out(p, JSON.stringify({ t: 'hi', id: p.id, host, heaps: H, sig: HEAP_SIG, seen: roomSeen, now: t, cap, rides: [...rides], minVer: MIN_VER, zg: guardList(t), end: endLive(t), np: r1(crowd), fill: fill || undefined, raid: raid.state() }));
    return p;
  }
  function leave(p) {
    if (!peers.delete(p.id)) return;
    for (const q of peers.values()) { q.sent.delete(p.id); q.sentSlow.delete(p.id); }
    all(JSON.stringify({ t: 'l', id: p.id }));
    raid.leave(p.id);
    if (unride(p)) all(ridesMsg()); // 타는 중 끊기면 노루가 풀림 (#92)
    if (host === p.id) pickHost();
    caveHostFix(p.ck); // 동굴 칸 주인 (#205)
    if (!peers.size) roomSeen = now();
  }

  // 동굴 칸 (#195 4번 조각): presence 의 cv 층(1~CAVE.floors)·cd 오늘의 동굴 날짜·cx·cz 동굴 안 자리(그 층 칸 안). 틀리면 동굴 칸을 지움
  //   x·z 는 동굴 안이어도 입구 자리(이동 판정 그대로). 칸(ck)이 다른 사람에게는 칸이 바뀔 때 한 번만 보냄 (step). 내 칸이 바뀌면 같은 칸 사람의 마지막 상태를 다시 받음
  // 넓은 굴 (#214 b, 어드민 카메라 시험): cd 끝에 'b'. 층 자리·크기가 CAVE.view.b 대로, 같은 'b' 끼리만 같은 칸
  const CAVE_SPAN = CAVE.grid * CAVE.cell / 2 + 2, CAVE_B = CAVE.view?.b, CAVE_SPAN_B = CAVE_B ? CAVE.grid * CAVE.cell * CAVE_B.k / 2 + 2 : 0;
  function caveCell(p, d) {
    let ck = '';
    if ('cv' in d) {
      const f = d.cv, okF = Number.isInteger(f) && f >= 1 && f <= CAVE.floors, okD = typeof d.cd === 'string' && /^\d{4}-\d{2}-\d{2}b?$/.test(d.cd), wide = okD && !!CAVE_B && d.cd.endsWith('b');
      const X0 = wide ? CAVE_B.x0 : CAVE.x0, G = wide ? CAVE_B.floorGap : CAVE.floorGap, SP = wide ? CAVE_SPAN_B : CAVE_SPAN;
      const okP = okF && isNum(d.cx) && isNum(d.cz) && Math.abs(d.cx - (X0 + (f - 1) * G)) <= SP && Math.abs(d.cz - CAVE.z0) <= SP;
      if (okF && okD && okP) ck = f + ':' + d.cd; else { delete d.cv; delete d.cd; delete d.cx; delete d.cz; ck = okF ? 'old' : ''; } // 옛 클라이언트(cv 만)는 아무와도 같은 칸이 아님
    } else { delete d.cd; delete d.cx; delete d.cz; }
    if (ck !== p.ck) { const was = p.ck; p.ck = ck; p.ckAt = now() + (+p.id.slice(1)) * 1e-6; p.sent.clear(); caveHostFix(was); caveHostFix(ck, p); }
  }
  // 동굴 칸 주인 (#205): 칸마다 먼저 들어온 사람. 옛 클라이언트 칸('old')·오름('')은 없음
  const caveHosts = new Map(); // 칸 → 칸 주인 id
  const realCk = (ck) => !!ck && ck !== 'old';
  function caveHostFix(ck, comer = null) {
    if (!realCk(ck)) return;
    let h = null; for (const q of peers.values()) if (q.ck === ck && (!h || q.ckAt < h.ckAt)) h = q;
    if (!h) { caveHosts.delete(ck); return; }
    const s = JSON.stringify({ t: 'ch', id: h.id, k: ck });
    if (caveHosts.get(ck) !== h.id) { caveHosts.set(ck, h.id); for (const q of peers.values()) if (q.ck === ck) out(q, s); }
    else if (comer && comer.ck === ck) out(comer, s);
  }
  const caveHostOf = (p) => (realCk(p.ck) ? caveHosts.get(p.ck) : null);
  const caveRow = (r) => Array.isArray(r) && r.length >= 9 && r.length <= 10 && r.every(isNum);

  function presence(p, d) {
    if (!d || typeof d !== 'object' || Array.isArray(d) || !isNum(d.x) || !isNum(d.z)) return;
    if ('a' in d) { if (d.a === 1) p.opT = now(); delete d.a; } // 조작 있음 (#157): 기억만 하고 남에게는 안 보냄
    d.x = Math.max(-4000, Math.min(4000, d.x)); d.z = Math.max(-4000, Math.min(4000, d.z));
    // 이동 판정 (#84): 마지막으로 받아 준 자리에서 (지난 시간 × maxSpeed + 여유) 안이어야 함
    const t = now();
    if (p.has) {
      const dist = Math.hypot(d.x - p.mx, d.z - p.mz), allow = ((t - p.mT) / 1000) * NET.maxSpeed + NET.moveSlack;
      if (dist > allow) {
        if ((d.tb === 'p' || d.tb === 'o') && (t - p.tubeT) / 1000 >= NET.tubeGap) p.tubeT = t; // 수거 관 (#248): 관 속·도착 표시가 붙은 순간 이동은 warpGap 과 따로 tubeGap 초에 한 번
        else if ((t - p.warpT) / 1000 >= NET.warpGap) p.warpT = t; // 들것 귀환·자리 앉기 같은 순간 이동은 가끔 받아 줌
        else { st.moveBack++; out(p, JSON.stringify({ t: 'pos', x: p.mx, z: p.mz })); strike(p, 'move'); return; }
      }
    }
    // 움직임 (#131 사람 수): 마지막으로 센 자리에서 crowdMove m 넘게 가면 움직인 것으로. 처음 자리는 세지 않음
    if (!p.has) { p.ax = d.x; p.az = d.z; } else if (Math.hypot(d.x - p.ax, d.z - p.az) > DUMP.crowdMove) { p.ax = d.x; p.az = d.z; p.actT = t; }
    p.tu = !!d.tu;
    // 바닥 보장 (#300): zn 지금 구역(0~5), nh 가까이 있는 더미 번호(DUMP.floor.nearMax 개까지). 방만 쓰고 남에게 안 보냄. 옛 클라이언트는 없음 → 구역 인원에 안 셈
    if ('zn' in d) { p.zn = Number.isInteger(d.zn) && ZH[d.zn] ? d.zn : 0; delete d.zn; }
    if ('nh' in d) { p.nh = Array.isArray(d.nh) ? d.nh.slice(0, DUMP.floor.nearMax).filter((i) => Number.isInteger(i) && i >= 0 && i < HEAP_FULL.length) : null; delete d.nh; }
    if ('tb' in d && d.tb !== 'i' && d.tb !== 'p' && d.tb !== 'o') delete d.tb; // 수거 관 단계 (#248): 이 셋만 남에게 보냄
    caveCell(p, d); // 동굴 칸 (#195)
    p.has = true; p.mx = d.x; p.mz = d.z; p.mT = t;
    if (p.acct) d.ac = 1; else delete d.ac; // 로그인한 사람 (#175 귤 주기). 클라이언트가 보낸 값은 버림
    // 남이 볼 글은 다듬어서만 (#84). 그리는 쪽도 늘 캔버스·textContent
    if ('nick' in d) { d.nick = cleanText(d.nick, NET.nickMax); if (nickBad(d.nick)) d.nick = ''; } // 걸리는 이름은 빈 이름으로 (받는 쪽이 '러너' 로 그림, #162)
    // 옷·닉네임은 바뀔 때만 옴 (#115): 없으면 앞에 받은 값 그대로. 한 번도 안 받았으면 없는 채로(받는 쪽 기본값). 옛 클라이언트는 늘 실어 보냄
    if ('gs' in d) d.gs = Number.isFinite(d.gs) ? Math.max(0, Math.min(9999, Math.floor(d.gs))) : 0; // 장비 점수 (#137, 이름표 옆 숫자. 보여 주기만)
    if ('gg' in d) d.gg = Number.isFinite(d.gg) ? Math.max(0, Math.min(3, Math.floor(d.gg))) : 0; // 입은 것 중 가장 높은 등급 (#140, 이름표 색)
    if ('tt' in d) d.tt = Number.isInteger(d.tt) && d.tt >= 0 && d.tt < TITLES.length ? d.tt : -1; // 칭호 번호 (#165): 범위만 봄 (글은 받는 쪽이 목록에서)
    if ('lv' in d) d.lv = Number.isInteger(d.lv) && d.lv >= 0 && d.lv <= LEVEL.max ? d.lv : 0; // 레벨 (#159, 이름표 옆. 0~30 만, 밖이면 0)
    if (p.d) { if (!('o' in d) && 'o' in p.d) d.o = p.d.o; if (!('nick' in d) && 'nick' in p.d) d.nick = p.d.nick; if (!('gs' in d) && 'gs' in p.d) d.gs = p.d.gs; if (!('gg' in d) && 'gg' in p.d) d.gg = p.d.gg; if (!('lv' in d) && 'lv' in p.d) d.lv = p.d.lv; if (!('tt' in d) && 'tt' in p.d) d.tt = p.d.tt; }
    if ('say' in d) d.say = d.say && typeof d.say === 'object' && isNum(d.say.at) ? { t: cleanText(d.say.t, NET.sayMax), at: d.say.at } : null;
    // 맞힘 알림: 쏜 사람 화면에서 판정한 결과. 서버는 거리·빈도만 봄
    const ht = d.ht;
    if (ht != null) {
      const tg = ht && typeof ht === 'object' ? peers.get(ht.p) : null;
      if (!tg || !isNum(ht.at) || !tg.d) d.ht = null;
      else if (ht.at !== p.lastHt) {
        if (p.hitTok < 1 || Math.hypot(tg.x - d.x, tg.z - d.z) > NET.hitRange) d.ht = null;
        else { p.hitTok--; p.lastHt = ht.at; }
      }
    }
    const pj = JSON.stringify(d);
    if (pj.length > NET.presenceMax) { st.dropped++; return; }
    if (pj === p.pj) return;
    p.d = d; p.pj = pj; p.x = d.x; p.z = d.z; p.ver++;
    // 옷·닉네임은 잘 안 바뀌므로 바뀐 때만 실어 보냄 (받는 쪽은 앞 값에 덮어씀)
    const sj = JSON.stringify([d.o, d.nick]); if (sj !== p.sj) { p.sj = sj; p.sver++; }
    const f = {}; for (const k in d) { const v = d[k]; if (k !== 'o' && k !== 'nick' && v !== null && v !== false && v !== '') f[k] = v; } p.fj = JSON.stringify(f); // 빈 값은 빼고 보냄
  }

  function message(p, raw) {
    st.msgsIn++;
    const t = now(); refill(p, t);
    if (typeof raw !== 'string') { drop(p); return; }
    const herd = p.id === host && raw.startsWith('{"t":"deer"'); // 방장의 노루 무리 (#92): 크기 상한이 따로
    const caveS = raw.startsWith('{"t":"cs"'); // 동굴 칸 주인의 적 상태 (#205): 크기 상한이 따로
    if (raw.length > (herd ? NET.deerMax : caveS ? NET.caveMax : NET.presenceMax) + 64) { drop(p); return; }
    // 노루 메시지는 따로 셈 (#92): 방장이 자리·노루를 함께 보내도 초당 msgPerSec 안
    if (/^\{"t":"(deer|dv|mount|unmount)"/.test(raw)) { if (p.deerTok < 1) { drop(p); return; } p.deerTok--; }
    else if (/^\{"t":"b[shd]"/.test(raw)) { if (raw.length > NET.bossMax || p.bossTok < 1) { drop(p); return; } p.bossTok--; } // 구역 우두머리 (#139): 따로 셈
    else if (/^\{"t":"r(h|p|j|s|go)"/.test(raw)) { if (raw.length > NET.raidMax || p.raidTok < 1) { drop(p); return; } p.raidTok--; } // 레이드 (#181): 따로 셈
    else if (/^\{"t":"c[sx]"/.test(raw)) { if (raw.length > NET.caveMax || p.caveTok < 1) { drop(p); return; } p.caveTok--; } // 동굴 적 (#205): 따로 셈
    else { if (p.tok < 1) { drop(p); return; } p.tok--; }
    let m; try { m = JSON.parse(raw); } catch (e) { drop(p); return; }
    if (!m || typeof m !== 'object') return;
    switch (m.t) {
      case 'deer': // 노루 무리 (#92): 방장만
        if (p.id !== host || !Array.isArray(m.d) || m.d.length > 80) return;
        all(JSON.stringify({ t: 'deer', d: m.d }), p);
        break;
      case 'dv': { // 방장에게 부탁 (#92): 먹이·지나감. 보낸 사람 가까운 곳만
        const hp = host && peers.get(host);
        if (!hp || hp === p || !['feed', 'visit'].includes(m.k) || !isNum(m.x) || !isNum(m.z) || (m.k === 'feed' && !isDeerId(m.i))) return;
        if (Math.hypot(m.x - p.x, m.z - p.z) > 60) return;
        out(hp, JSON.stringify({ t: 'dv', k: m.k, i: m.k === 'feed' ? m.i : undefined, x: m.x, z: m.z, from: p.id }));
        break;
      }
      case 'mount': { // 노루 타기 (#92): 한 마리에 한 사람
        if (!isDeerId(m.i)) return;
        const who = rides.get(m.i);
        if (who && who !== p.id) { out(p, JSON.stringify({ t: 'mount', i: m.i, no: 1 })); return; }
        unride(p); rides.set(m.i, p.id); all(ridesMsg());
        break;
      }
      case 'unmount': if (unride(p)) all(ridesMsg()); break;
      case 'bs': { // 구역 우두머리 (#139): 방장만. 자리·기운·패턴 [s]·[a], 사라짐 gone, 쫓아냄 done(낀 사람 f)
        if (p.id !== host || !isZone(m.z)) return;
        const o = { t: 'bs', z: m.z };
        if (numArr(m.s, 12)) o.s = m.s; if (numArr(m.a, 16)) o.a = m.a;
        if (m.gone) o.gone = 1; if (m.done) { o.done = 1; o.f = Array.isArray(m.f) ? m.f.filter((v) => typeof v === 'string' && /^p\d{1,9}$/.test(v)).slice(0, NET.roomCap) : []; }
        all(JSON.stringify(o), p);
        break;
      }
      case 'bh': { // 우두머리를 맞힌 피해 → 방장에게만 (#139)
        const hp = host && peers.get(host);
        if (!hp || hp === p || !isZone(m.z) || !isNum(m.d) || m.d <= 0) return;
        out(hp, JSON.stringify({ t: 'bh', z: m.z, d: Math.min(NET.bossHitMax, m.d), from: p.id }));
        break;
      }
      case 'bd': // 우두머리를 쫓아냄 (#139): 방장만 → 그 구역 돌하르방을 세움 (서 있지 않을 때만, 줍기로 다 치운 것과 같이 zg)
        if (p.id !== host || !isZone(m.z)) return;
        raiseGuard(m.z, t);
        break;
      case 'end': { // 엔딩 (#168): 방에서 하루 한 번만 모두에게
        const by = cleanText(p.d?.nick || '', NET.nickMax) || '누군가', at = t + STORY.end.lead * 1000;
        if (endMsg && t < endMsg.at + STORY.end.len * 1000) { out(p, JSON.stringify({ t: 'end', at: endMsg.at, by: endMsg.by, names: endMsg.names })); break; } // 지금 도는 중이면 그것을 같이 봄
        if (endDay === kstDay(t)) { out(p, JSON.stringify({ t: 'end', at, by, names: [by], solo: 1 })); all(JSON.stringify({ t: 'endr', by }), p); break; } // 그날 두 번째부터: 끝낸 사람만, 나머지는 방송 한 줄
        endDay = kstDay(t);
        const names = [...peers.values()].map((q) => cleanText(q.d?.nick || '', NET.nickMax)).filter(Boolean).slice(0, NET.roomCap);
        endMsg = { at, by, names }; all(JSON.stringify({ t: 'end', at, by, names }));
        break;
      }
      case 'rj': raid.join(p.id); break; // 레이드 (#181)
      case 'rh': if (isNum(m.d) && m.d > 0) raid.hit(p.id, Math.min(NET.bossHitMax, m.d)); break;
      case 'rp': if (Number.isInteger(m.i)) raid.pick(p.id, m.i); break;
      case 'rs': { // 방장만: 레이드 몸 자리·패턴
        if (p.id !== host || !numArr(m.s, 8)) return;
        const o = { t: 'rs', s: m.s }; if (numArr(m.a, 16)) o.a = m.a;
        all(JSON.stringify(o), p); break;
      }
      case 'rgo': if (stats || p.adm) raid.start(stats && m.f === 1); break; // f:1 = 남은 레이드도 지우고 새로 (#245): 로컬 확인 방만, 어드민도 실서버에선 못 함
      case 'cs': { // 동굴 적 상태 (#205): 칸 주인만 → 같은 칸 다른 사람에게
        if (caveHostOf(p) !== p.id || m.k !== p.ck || !Array.isArray(m.e) || m.e.length > NET.caveEnemyMax || !m.e.every(caveRow)) return;
        const o = { t: 'cs', k: p.ck, e: m.e }; if (Number.isInteger(m.w) && m.w >= 0) o.w = m.w; if (Number.isInteger(m.g) && m.g >= 0 && m.g < 4) o.g = m.g;
        const s = JSON.stringify(o); for (const q of peers.values()) if (q !== p && q.ck === p.ck) out(q, s);
        break;
      }
      case 'cx': { // 동굴 적을 맞힌 피해 → 칸 주인에게만 (#205)
        const hid = caveHostOf(p), hq = hid && peers.get(hid);
        if (!hq || hq === p || !Array.isArray(m.h) || !m.h.length || m.h.length > 8) return;
        const h = m.h.filter((r) => Array.isArray(r) && r.length === 2 && Number.isInteger(r[0]) && isNum(r[1]) && r[1] > 0).map(([i, d]) => [i, Math.min(NET.bossHitMax, d)]);
        if (h.length) out(hq, JSON.stringify({ t: 'cx', h, from: p.id }));
        break;
      }
      case 'p': presence(p, m.d); break;
      case 'give': { // 귤 주기 (#175)
        const q = typeof m.to === 'string' ? peers.get(m.to) : null, n = Number.isInteger(m.n) ? m.n : 0;
        const no = (why) => out(p, JSON.stringify({ t: 'gave', to: typeof m.to === 'string' ? m.to.slice(0, 12) : '', n: 0, no: why }));
        if (!(n >= 1 && n <= GIVE.burst)) { strike(p, 'give'); return; }
        if (!gift || !p.acct) { no('login'); return; }
        if (!q || q === p || !q.acct || !q.d) { no('none'); return; }
        if (Math.hypot(p.x - q.x, p.z - q.z) > GIVE.serverR) { no('far'); return; }
        const k = Math.min(n, Math.floor(p.giveTok)); if (k < 1) { no('fast'); return; }
        p.giveTok -= k;
        const by = cleanText(p.d?.nick || '', NET.nickMax);
        Promise.resolve().then(() => gift(p.acct, q.acct, k)).then((r) => {
          const got = Math.max(0, Math.min(k, r?.got | 0)); if (got < k) p.giveTok = Math.min(GIVE.perSec, p.giveTok + k - got);
          out(p, JSON.stringify({ t: 'gave', to: q.id, n: got, out: r?.out, ...(r?.why ? { no: r.why } : {}) }));
          if (got && peers.get(q.id) === q) out(q, JSON.stringify({ t: 'got', from: p.id, nick: by, n: got, in: r.in }));
        }).catch(() => { p.giveTok = Math.min(GIVE.perSec, p.giveTok + k); no('err'); });
        break;
      }
      case 'take': { // n: 한 번에 주운 수 (#137 묶어 보냄, 없으면 1)
        const h = m.h | 0; if (!(h >= 0 && h < H.length)) return;
        // 보낸 수(ask)는 그대로 세고 받는 수만 takeMax·남은 수·초당 몫으로 자름 (#144: 예전엔 takeMax 로 먼저 잘라 넘친 몫을 되돌리라고 알리지 않았음)
        const ask = Math.max(1, Math.min(NET.takeAsk, m.n | 0 || 1)), got = Math.max(0, Math.min(ask, NET.takeMax, H[h], Math.floor(p.takeTok)));
        if (got) { p.takeTok -= got; H[h] -= got; heapsDirty = true; heapOut.set(h, H[h]); if (p.acct) earned.set(p.acct, (earned.get(p.acct) || 0) + got * HEAP_GYUL[h]); zonePicked(HEAP_DEFS[h].zone, got, t); if (!H[h]) zoneEmptied(HEAP_DEFS[h].zone, t); }
        if (got < ask) { st.takeNo += ask - got; out(p, JSON.stringify({ t: 'h', h, n: H[h], no: ask - got })); } // 늦게 온 마지막 것·너무 빠른 줍기: 주운 사람이 그만큼 되돌림
        break;
      }
      case 'btake': { // 동료 줍기 (#172): 하나씩. 줍기 몫(takeTok)을 같이 쓰고 번 몫(earned)엔 안 셈, 더미의 마지막 BUDDIES.keep 은 남김. 못 하면 남은 수만 알림(되돌릴 것 없음)
        const h = m.h | 0; if (!(h >= 0 && h < H.length)) return;
        if (H[h] > Math.ceil(HEAP_FULL[h] * BUDDIES.keep) && p.takeTok >= 1) { p.takeTok -= 1; H[h] -= 1; heapsDirty = true; heapOut.set(h, H[h]); }
        else out(p, JSON.stringify({ t: 'h', h, n: H[h] }));
        break;
      }
      case 'put': {
        const h = m.h | 0; if (!(h >= 0 && h < H.length)) return;
        // 방장(옛 클라이언트는 방장만 보냄)과 움직이는 사람(튜토리얼 중 아님)만 (#131). 방 전체 몫은 사람 수로 (클라이언트가 보낸 인원은 믿지 않음)
        if (p.id !== host && (p.tu || t - p.actT >= DUMP.crowdActive * 1000)) { out(p, JSON.stringify({ t: 'h', h, n: H[h] })); return; }
        followCrowd(t); roomPut = Math.min(NET.putBurst, roomPut + (t - roomPutT) / 1000 * NET.putPerMin * crowdMul(crowd) / 60); roomPutT = t;
        const want = Math.max(0, Math.min(m.n | 0, Math.floor(p.putTok), Math.floor(roomPut), HEAP_FULL[h] - H[h]));
        if (want) { H[h] += want; p.putTok -= want; roomPut -= want; heapsDirty = true; heapOut.set(h, H[h]); }
        else out(p, JSON.stringify({ t: 'h', h, n: H[h] }));
        break;
      }
      case 'idle': if (stats && isNum(m.s) && m.s > 0) p.idleSec = Math.min(3600, m.s); break; // 로컬 확인용 (#157)
      case 'ping': out(p, JSON.stringify({ t: 'pong', c: m.c, s: t })); break;
      case 'stats': if (stats) out(p, JSON.stringify({ t: 'stats', n: peers.size, ...st, host })); break;
      default: break;
    }
  }

  // 오래 멈춘 사람 내보내기 (#157): 조작 표시를 한 번이라도 보낸 사람만 (옛 클라이언트 대비. 모두 새 버전이 된 뒤 MIN_VER 를 올리면 이 조건은 지워도 됨)
  function idleCheck(t) {
    for (const p of [...peers.values()]) {
      if (!p.opT || p.adm || t - p.opT < (p.idleSec || NET.idleKickSec) * 1000) continue;
      st.idleOut = (st.idleOut || 0) + 1;
      out(p, JSON.stringify({ t: 'idle' }));
      leave(p); try { p.close?.(4004, 'idle'); } catch (e) { /* 이미 끊김 */ }
    }
  }

  // 한 틱: 받는 사람마다 바뀐 사람만 모아 한 번에. 가까운 사람(farR 안)은 매 틱, 먼 사람은 farEvery 틱마다
  function step() {
    tick++; st.ticks++;
    if (peers.size) roomSeen = now();
    if (tick % 10 === 0) idleCheck(now());
    if (peers.size > 1 && tick % Math.max(1, Math.round(DUMP.floor.every * 1000 / NET.tickMs)) === 0) floorTick(now()); /* 바닥 보장 (#300) */
    if (peers.size && tick % 10 === 0) { const t = now(); followCrowd(t); const v = r1(crowd); if (v !== npSent && t - npT >= 2000) { npSent = v; npT = t; all(JSON.stringify({ t: 'np', n: v })); } } // 사람 수 (#131): 1초마다 따라가고 바뀌면 알림
    if (heapOut.size) { all(JSON.stringify({ t: 'hs', hs: [...heapOut] })); heapOut.clear(); }
    for (const [z, at] of guardOut) all(JSON.stringify({ t: 'zg', z, at })); guardOut.length = 0;
    raid.tick(); for (const r of raid.takePaid()) if (r.acct) earned.set(r.acct, (earned.get(r.acct) || 0) + r.g); // 레이드 보상은 방이 줌 (#181·#144)
    const farTick = tick % NET.farEvery === 0, R2 = NET.farR * NET.farR;
    for (const r of peers.values()) {
      let parts = null;
      for (const o of peers.values()) {
        if (o === r || !o.pj) continue;
        const other = o.ck !== r.ck; // 다른 칸 (#195): 칸이 바뀐 것만 한 번 (가까움 상관없이)
        if (other) { if (r.sentCk.get(o.id) === o.ck) continue; r.sentCk.set(o.id, o.ck); }
        else { if (r.sent.get(o.id) === o.ver) continue; r.sentCk.delete(o.id); if (!farTick && r.d && (o.x - r.x) ** 2 + (o.z - r.z) ** 2 > R2) continue; }
        r.sent.set(o.id, o.ver);
        const full = r.sentSlow.get(o.id) !== o.sver; if (full) r.sentSlow.set(o.id, o.sver);
        (parts ||= []).push('["' + o.id + '",' + (full ? o.pj : o.fj) + ']');
      }
      if (parts) out(r, '{"t":"u","p":[' + parts.join(',') + ']}');
    }
  }

  return {
    join, leave, message, step, setCap(n) { cap = n; },
    get size() { return peers.size; }, get host() { return host; },
    takeEarned() { if (!earned.size) return null; const a = [...earned]; earned.clear(); return a; },
    heaps: () => H, takeDirty() { const d = heapsDirty; heapsDirty = false; return d; },
    guards: () => guardList(now()), guardsDirty() { const d = guardsDirty; guardsDirty = false; return d; },
    get seen() { return roomSeen; }, raid, caveHost: (ck) => caveHosts.get(ck) || null, stats: () => ({ n: peers.size, ...st }),
    counts() { let login = 0; for (const p of peers.values()) if (p.acct) login++; return { n: peers.size, login }; }, // 지금 접속 (#186): 사람 수·로그인 수만
    get crowd() { return crowd; }, active: () => activeN(now()), floor: () => ({ ...floorStat, pick: { ...zonePick }, added: { ...zoneFloor } }), /* #300 */
  };
}
