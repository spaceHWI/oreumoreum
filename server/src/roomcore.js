// 방 하나의 규칙 (#7). Cloudflare 와 상관없는 순수 JS 라 Node 에서 그대로 재 볼 수 있음 (bench.mjs, tools/loadtest.js)
// 받는 것 (JSON 문자열):
//   {t:'p', d:{x,z,h,…}}  내 상태 (위치·방향·동작·옷·탈것·말·이모티콘…, net.js 의 presence 그대로). o·nick 은 바뀔 때만 와도 됨 (#115)
//   {t:'take', h, n?}     더미 h 에서 n(없으면 1)개 주움 → 남은 수를 다음 틱에 방 전체에 {t:'hs'}. 로그인한 사람이면 주운 수 × 더미 값(HEAP_GYUL)을 번 몫으로 셈 (#144)
//   {t:'put', h, n}       다시 쌓기 (투기꾼·트럭). 방장(host)만
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
// 오래 멈춤 (#157): presence 의 a:1 = '지난 NET.idleBeatMs 안에 조작 있음' (받으면 지우고 그 시각만 기억, 남에게 안 보냄).
//   마지막 a:1 뒤 NET.idleKickSec 가 지나면 {t:'idle'} 후 연결을 닫음(4004, 클라이언트는 자동 재접속 안 함). 어드민(x-adm)은 빼고,
//   a 를 한 번도 안 보낸 연결(옛 클라이언트)도 닫지 않음. {t:'idle', s} 는 STATS_OPEN(로컬 확인)일 때만: 그 사람의 기준 초를 s 로 (tools/online.js)
// 보내는 것: {t:'hi', id, host, heaps, sig, seen, now, cap, rides, minVer, zg} / {t:'u', p:[[id, presence]…]} (presence 의 o·nick 은 바뀐 때만, 받는 쪽이 앞 값에 덮어씀) / {t:'l', id} / {t:'host', id} / {t:'hs', hs:[[h, n]…]} (틱마다 모아서) / {t:'h', h, n} (보낸 사람에게만 바로잡기) / {t:'full'}
import { NET, ZONE_GUARD, BUDDIES, LEVEL, STORY } from '../../src/balance.js';
import { HEAP_FULL, HEAP_SIG, HEAP_GYUL, HEAP_DEFS } from './heaps.js';
import { cleanText, nickBad } from '../../src/safetext.js';

const MIN_VER = ''; // 이보다 낮은 버전의 게임엔 닫을 수 없는 새로고침 알림 (#134). 지금은 비워 둠 → 예: '0.24.0'
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isDeerId = (v) => typeof v === 'string' && /^[a-z0-9-]{1,12}$/.test(v); // 노루 이름 (#92)

export function createRoomCore({ cap = NET.roomCap, now = () => Date.now(), heaps = null, seen = 0, stats = false, guards = null } = {}) {
  const peers = new Map(); // id → peer
  let H = Array.isArray(heaps) && heaps.length === HEAP_FULL.length ? heaps.map((v, i) => Math.max(0, Math.min(HEAP_FULL[i], v | 0))) : HEAP_FULL.slice();
  const heapOut = new Map(); // 이번 틱에 바뀐 더미 → 틱마다 한 번에 알림
  const earned = new Map(); // 계정 → 받아 준 줍기로 번 몫 (#144). room.js 가 earnFlushMs 마다 꺼내 계정(Accounts.earn)에 넘김
  let heapsDirty = false, roomSeen = seen || 0, host = null, nextId = 1, tick = 0;
  // 구역 지킴이 (#119): 구역 → 세운 시각(ms). room.js 가 저장·불러옴
  const ZH = {}; HEAP_DEFS.forEach((d, i) => { (ZH[d.zone] ||= []).push(i); });
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
    G.set(z, t); guardsDirty = true; guardOut.push([z, t]);
  }
  let endDay = '', endMsg = null; // 엔딩 (#168): 오늘 모두에게 튼 날짜, 그 메시지 {at, by, names}
  const kstDay = (t) => new Date(t + 9 * 3600e3).toISOString().slice(0, 10);
  const endLive = (t) => (endMsg && t < endMsg.at + STORY.end.len * 1000 ? [endMsg.at, endMsg.by, endMsg.names] : undefined);
  const isZone = (z) => Number.isInteger(z) && !!ZH[z];
  const numArr = (a, n) => Array.isArray(a) && a.length <= n && a.every(isNum);
  const st = { bytesOut: 0, msgsOut: 0, msgsIn: 0, dropped: 0, ticks: 0, moveBack: 0, kicks: 0, takeNo: 0 };
  const bans = new Map(); // 계정·주소 키 → 풀리는 시각 (ms)
  const rides = new Map(); // 노루 이름 → 탄 사람 id (#92). 한 마리에 한 사람
  const ridesMsg = () => JSON.stringify({ t: 'rides', r: [...rides] });
  function unride(p) { let ch = false; for (const [i, id] of rides) if (id === p.id) { rides.delete(i); ch = true; } return ch; }

  const out = (p, s) => { st.bytesOut += s.length; st.msgsOut++; try { p.send(s); } catch (e) { /* 끊긴 소켓 */ } };
  const all = (s, except) => { for (const p of peers.values()) if (p !== except) out(p, s); };
  const refill = (p, t) => { const dt = (t - p.tT) / 1000; p.tT = t; p.tok = Math.min(NET.msgPerSec, p.tok + dt * NET.msgPerSec); p.putTok = Math.min(NET.putBurst, p.putTok + dt * NET.putPerMin / 60); p.hitTok = Math.min(NET.hitPerSec, p.hitTok + dt * NET.hitPerSec); p.takeTok = Math.min(NET.takePerSec, p.takeTok + dt * NET.takePerSec); p.deerTok = Math.min(NET.deerPerSec, p.deerTok + dt * NET.deerPerSec); p.bossTok = Math.min(NET.bossPerSec, p.bossTok + dt * NET.bossPerSec); };
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
    const p = { id: 'p' + (nextId++), send, acct: info.acct || null, joinAt: t + nextId * 1e-6, d: null, pj: null, x: 0, z: 0, ver: 0, sent: new Map(), sj: null, fj: null, sver: 0, sentSlow: new Map(), tok: NET.msgPerSec, tT: t, putTok: NET.putBurst, hitTok: NET.hitPerSec, lastHt: 0,
      key: info.key || null, close: info.close || null, adm: !!info.adm, actT: 0, idleSec: 0, has: false, mx: 0, mz: 0, mT: t, warpT: -1e12, strikes: [], drops: [], takeTok: NET.takePerSec, deerTok: NET.deerPerSec, bossTok: NET.bossPerSec };
    peers.set(p.id, p);
    if (!host) host = p.id;
    out(p, JSON.stringify({ t: 'hi', id: p.id, host, heaps: H, sig: HEAP_SIG, seen: roomSeen, now: t, cap, rides: [...rides], minVer: MIN_VER, zg: guardList(t), end: endLive(t) }));
    return p;
  }
  function leave(p) {
    if (!peers.delete(p.id)) return;
    for (const q of peers.values()) { q.sent.delete(p.id); q.sentSlow.delete(p.id); }
    all(JSON.stringify({ t: 'l', id: p.id }));
    if (unride(p)) all(ridesMsg()); // 타는 중 끊기면 노루가 풀림 (#92)
    if (host === p.id) pickHost();
    if (!peers.size) roomSeen = now();
  }

  function presence(p, d) {
    if (!d || typeof d !== 'object' || Array.isArray(d) || !isNum(d.x) || !isNum(d.z)) return;
    if ('a' in d) { if (d.a === 1) p.actT = now(); delete d.a; } // 조작 있음 (#157): 기억만 하고 남에게는 안 보냄
    d.x = Math.max(-4000, Math.min(4000, d.x)); d.z = Math.max(-4000, Math.min(4000, d.z));
    // 이동 판정 (#84): 마지막으로 받아 준 자리에서 (지난 시간 × maxSpeed + 여유) 안이어야 함
    const t = now();
    if (p.has) {
      const dist = Math.hypot(d.x - p.mx, d.z - p.mz), allow = ((t - p.mT) / 1000) * NET.maxSpeed + NET.moveSlack;
      if (dist > allow) {
        if ((t - p.warpT) / 1000 >= NET.warpGap) p.warpT = t; // 들것 귀환·자리 앉기 같은 순간 이동은 가끔 받아 줌
        else { st.moveBack++; out(p, JSON.stringify({ t: 'pos', x: p.mx, z: p.mz })); strike(p, 'move'); return; }
      }
    }
    p.has = true; p.mx = d.x; p.mz = d.z; p.mT = t;
    // 남이 볼 글은 다듬어서만 (#84). 그리는 쪽도 늘 캔버스·textContent
    if ('nick' in d) { d.nick = cleanText(d.nick, NET.nickMax); if (nickBad(d.nick)) d.nick = ''; } // 걸리는 이름은 빈 이름으로 (받는 쪽이 '러너' 로 그림, #162)
    // 옷·닉네임은 바뀔 때만 옴 (#115): 없으면 앞에 받은 값 그대로. 한 번도 안 받았으면 없는 채로(받는 쪽 기본값). 옛 클라이언트는 늘 실어 보냄
    if ('gs' in d) d.gs = Number.isFinite(d.gs) ? Math.max(0, Math.min(9999, Math.floor(d.gs))) : 0; // 장비 점수 (#137, 이름표 옆 숫자. 보여 주기만)
    if ('gg' in d) d.gg = Number.isFinite(d.gg) ? Math.max(0, Math.min(3, Math.floor(d.gg))) : 0; // 입은 것 중 가장 높은 등급 (#140, 이름표 색)
    if ('lv' in d) d.lv = Number.isInteger(d.lv) && d.lv >= 0 && d.lv <= LEVEL.max ? d.lv : 0; // 레벨 (#159, 이름표 옆. 0~30 만, 밖이면 0)
    if (p.d) { if (!('o' in d) && 'o' in p.d) d.o = p.d.o; if (!('nick' in d) && 'nick' in p.d) d.nick = p.d.nick; if (!('gs' in d) && 'gs' in p.d) d.gs = p.d.gs; if (!('gg' in d) && 'gg' in p.d) d.gg = p.d.gg; if (!('lv' in d) && 'lv' in p.d) d.lv = p.d.lv; }
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
    if (raw.length > (herd ? NET.deerMax : NET.presenceMax) + 64) { drop(p); return; }
    // 노루 메시지는 따로 셈 (#92): 방장이 자리·노루를 함께 보내도 초당 msgPerSec 안
    if (/^\{"t":"(deer|dv|mount|unmount)"/.test(raw)) { if (p.deerTok < 1) { drop(p); return; } p.deerTok--; }
    else if (/^\{"t":"b[shd]"/.test(raw)) { if (raw.length > NET.bossMax || p.bossTok < 1) { drop(p); return; } p.bossTok--; } // 구역 우두머리 (#139): 따로 셈
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
      case 'p': presence(p, m.d); break;
      case 'take': { // n: 한 번에 주운 수 (#137 묶어 보냄, 없으면 1)
        const h = m.h | 0; if (!(h >= 0 && h < H.length)) return;
        // 보낸 수(ask)는 그대로 세고 받는 수만 takeMax·남은 수·초당 몫으로 자름 (#144: 예전엔 takeMax 로 먼저 잘라 넘친 몫을 되돌리라고 알리지 않았음)
        const ask = Math.max(1, Math.min(NET.takeAsk, m.n | 0 || 1)), got = Math.max(0, Math.min(ask, NET.takeMax, H[h], Math.floor(p.takeTok)));
        if (got) { p.takeTok -= got; H[h] -= got; heapsDirty = true; heapOut.set(h, H[h]); if (p.acct) earned.set(p.acct, (earned.get(p.acct) || 0) + got * HEAP_GYUL[h]); if (!H[h]) zoneEmptied(HEAP_DEFS[h].zone, t); }
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
        if (p.id !== host) { out(p, JSON.stringify({ t: 'h', h, n: H[h] })); return; } // 방장만 쌓음
        const want = Math.max(0, Math.min(m.n | 0, Math.floor(p.putTok), HEAP_FULL[h] - H[h]));
        if (want) { H[h] += want; p.putTok -= want; heapsDirty = true; heapOut.set(h, H[h]); }
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
      if (!p.actT || p.adm || t - p.actT < (p.idleSec || NET.idleKickSec) * 1000) continue;
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
    if (heapOut.size) { all(JSON.stringify({ t: 'hs', hs: [...heapOut] })); heapOut.clear(); }
    for (const [z, at] of guardOut) all(JSON.stringify({ t: 'zg', z, at })); guardOut.length = 0;
    const farTick = tick % NET.farEvery === 0, R2 = NET.farR * NET.farR;
    for (const r of peers.values()) {
      let parts = null;
      for (const o of peers.values()) {
        if (o === r || !o.pj || r.sent.get(o.id) === o.ver) continue;
        if (!farTick && r.d && (o.x - r.x) ** 2 + (o.z - r.z) ** 2 > R2) continue;
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
    get seen() { return roomSeen; }, stats: () => ({ n: peers.size, ...st }),
  };
}
