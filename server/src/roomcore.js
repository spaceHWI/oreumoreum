// 방 하나의 규칙 (#7). Cloudflare 와 상관없는 순수 JS 라 Node 에서 그대로 재 볼 수 있음 (bench.mjs, tools/loadtest.js)
// 받는 것 (JSON 문자열):
//   {t:'p', d:{x,z,h,…}}  내 상태 (위치·방향·동작·옷·탈것·말·이모티콘…, net.js 의 presence 그대로). o·nick 은 바뀔 때만 와도 됨 (#115)
//   {t:'take', h}         더미 h 에서 하나 주움 → 남은 수를 다음 틱에 방 전체에 {t:'hs'}
//   {t:'put', h, n}       다시 쌓기 (투기꾼·트럭). 방장(host)만
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
// 보내는 것: {t:'hi', id, host, heaps, sig, seen, now, cap, rides} / {t:'u', p:[[id, presence]…]} (presence 의 o·nick 은 바뀐 때만, 받는 쪽이 앞 값에 덮어씀) / {t:'l', id} / {t:'host', id} / {t:'hs', hs:[[h, n]…]} (틱마다 모아서) / {t:'h', h, n} (보낸 사람에게만 바로잡기) / {t:'full'}
import { NET } from '../../src/balance.js';
import { HEAP_FULL, HEAP_SIG } from './heaps.js';
import { cleanText } from '../../src/safetext.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isDeerId = (v) => typeof v === 'string' && /^[a-z0-9-]{1,12}$/.test(v); // 노루 이름 (#92)

export function createRoomCore({ cap = NET.roomCap, now = () => Date.now(), heaps = null, seen = 0, stats = false } = {}) {
  const peers = new Map(); // id → peer
  let H = Array.isArray(heaps) && heaps.length === HEAP_FULL.length ? heaps.map((v, i) => Math.max(0, Math.min(HEAP_FULL[i], v | 0))) : HEAP_FULL.slice();
  const heapOut = new Map(); // 이번 틱에 바뀐 더미 → 틱마다 한 번에 알림
  let heapsDirty = false, roomSeen = seen || 0, host = null, nextId = 1, tick = 0;
  const st = { bytesOut: 0, msgsOut: 0, msgsIn: 0, dropped: 0, ticks: 0, moveBack: 0, kicks: 0, takeNo: 0 };
  const bans = new Map(); // 계정·주소 키 → 풀리는 시각 (ms)
  const rides = new Map(); // 노루 이름 → 탄 사람 id (#92). 한 마리에 한 사람
  const ridesMsg = () => JSON.stringify({ t: 'rides', r: [...rides] });
  function unride(p) { let ch = false; for (const [i, id] of rides) if (id === p.id) { rides.delete(i); ch = true; } return ch; }

  const out = (p, s) => { st.bytesOut += s.length; st.msgsOut++; try { p.send(s); } catch (e) { /* 끊긴 소켓 */ } };
  const all = (s, except) => { for (const p of peers.values()) if (p !== except) out(p, s); };
  const refill = (p, t) => { const dt = (t - p.tT) / 1000; p.tT = t; p.tok = Math.min(NET.msgPerSec, p.tok + dt * NET.msgPerSec); p.putTok = Math.min(NET.putBurst, p.putTok + dt * NET.putPerMin / 60); p.hitTok = Math.min(NET.hitPerSec, p.hitTok + dt * NET.hitPerSec); p.takeTok = Math.min(NET.takePerSec, p.takeTok + dt * NET.takePerSec); p.deerTok = Math.min(NET.deerPerSec, p.deerTok + dt * NET.deerPerSec); };
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
      key: info.key || null, close: info.close || null, has: false, mx: 0, mz: 0, mT: t, warpT: -1e12, strikes: [], drops: [], takeTok: NET.takePerSec, deerTok: NET.deerPerSec };
    peers.set(p.id, p);
    if (!host) host = p.id;
    out(p, JSON.stringify({ t: 'hi', id: p.id, host, heaps: H, sig: HEAP_SIG, seen: roomSeen, now: t, cap, rides: [...rides] }));
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
    if ('nick' in d) d.nick = cleanText(d.nick, NET.nickMax);
    // 옷·닉네임은 바뀔 때만 옴 (#115): 없으면 앞에 받은 값 그대로. 한 번도 안 받았으면 없는 채로(받는 쪽 기본값). 옛 클라이언트는 늘 실어 보냄
    if (p.d) { if (!('o' in d) && 'o' in p.d) d.o = p.d.o; if (!('nick' in d) && 'nick' in p.d) d.nick = p.d.nick; }
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
    if (/^\{"t":"(deer|dv|mount|unmount)"/.test(raw)) { if (p.deerTok < 1) { drop(p); return; } p.deerTok--; } else { if (p.tok < 1) { drop(p); return; } p.tok--; }
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
      case 'p': presence(p, m.d); break;
      case 'take': {
        const h = m.h | 0; if (!(h >= 0 && h < H.length)) return;
        if (H[h] > 0 && p.takeTok >= 1) { p.takeTok--; H[h]--; heapsDirty = true; heapOut.set(h, H[h]); }
        else { st.takeNo++; out(p, JSON.stringify({ t: 'h', h, n: H[h], no: 1 })); } // 늦게 온 마지막 하나·너무 빠른 줍기: 주운 사람이 되돌림
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
      case 'ping': out(p, JSON.stringify({ t: 'pong', c: m.c, s: t })); break;
      case 'stats': if (stats) out(p, JSON.stringify({ t: 'stats', n: peers.size, ...st, host })); break;
      default: break;
    }
  }

  // 한 틱: 받는 사람마다 바뀐 사람만 모아 한 번에. 가까운 사람(farR 안)은 매 틱, 먼 사람은 farEvery 틱마다
  function step() {
    tick++; st.ticks++;
    if (peers.size) roomSeen = now();
    if (heapOut.size) { all(JSON.stringify({ t: 'hs', hs: [...heapOut] })); heapOut.clear(); }
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
    heaps: () => H, takeDirty() { const d = heapsDirty; heapsDirty = false; return d; },
    get seen() { return roomSeen; }, stats: () => ({ n: peers.size, ...st }),
  };
}
