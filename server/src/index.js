// 오름오름 멀티 서버 (#7) 입구: 로그인·계정 저장·방 연결·날마다 정리
// 보안 (#84): 클라이언트 코드는 누구나 볼 수 있다는 전제. 지킬 것은 모두 여기서
// - SESSION_SECRET 이 없으면(또는 짧으면) /health 말고는 아무것도 하지 않음 (로컬 FAKE_AUTH 만 예외)
// - 주소 제한: Origin 이 ALLOW_ORIGINS(게임 주소)일 때만. 로컬 주소는 로컬 개발(FAKE_AUTH·STATS_OPEN)에서만
// - 요청 수 제한: 주소(IP 해시)별 1분 상한 (Cloudflare Rate Limiting 바인딩이 있으면 그것도)
// - 세션: 서명·만료 + 계정 DO 확인(지운 계정·버린 토큰 거절). WebSocket 은 주소창 대신 하위 프로토콜로 토큰을 받음 (로그에 안 남게)
// - 어드민: 로그인 계정의 sub 가 시크릿 ADMIN_SUBS(쉼표로 여럿)에 있을 때만
// - 로그: 아무것도 console 에 찍지 않음. IP 원문·토큰은 저장하지 않음
import { NET, CRASHES } from '../../src/balance.js';
import { RANGES, SRVS } from '../../src/rankday.js';
import { verifyGoogle, signSession, readSession, ipKey } from './auth.js';
import { cleanItems, sendMail } from './feedback.js';
import { groupCrashes } from './crashes.js';
import { cleanText } from '../../src/safetext.js';
export { Room } from './room.js';
export { Accounts } from './accounts.js';

// 방 이름 (#98): 'oreum-<맵>-battle' 하나. 예전 깨끗한 오름 방 'oreum-<맵>' 으로 오는 접속은 battle 방으로 보냄
const ROOM_RE = new RegExp(`^oreum-(${NET.rooms.join('|')})(-battle)?$`);
const roomOf = (r) => (r.endsWith('-battle') ? r : r + '-battle');
const LOCAL_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const isDev = (env) => env.FAKE_AUTH === '1' || env.STATS_OPEN === '1';
function allowOrigin(env, o) {
  if (!o) return null;
  if (isDev(env) && LOCAL_RE.test(o)) return o; // 로컬 확인 (공개 서버에서는 거절)
  return (env.ALLOW_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean).includes(o) ? o : null;
}
const secret = (env) => (env.SESSION_SECRET && env.SESSION_SECRET.length >= 32 ? env.SESSION_SECRET : env.FAKE_AUTH === '1' ? 'local-dev-secret-local-dev-secret' : null);
const accounts = (env) => env.ACCOUNTS.get(env.ACCOUNTS.idFromName('all'));
const adminSubs = (env) => new Set(String(env.ADMIN_SUBS || '').split(',').map((s) => s.trim()).filter(Boolean));
const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'", 'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000', 'Cross-Origin-Resource-Policy': 'cross-origin',
};

const crashCache = new Map(); // /crashes 결과 (#122): days → { t, o }
// 주소별 요청 수 (Worker 한 개 안의 메모리. 여러 곳에 퍼지면 느슨해지므로 바인딩 RL_* 이 있으면 그것도 봄)
const hits = new Map();
function overLocal(key, perMin) {
  const t = Date.now(); let h = hits.get(key);
  if (!h || t - h.t > 60e3) { h = { t, n: 0 }; hits.set(key, h); }
  if (hits.size > 5000) for (const [k, v] of hits) if (t - v.t > 60e3) hits.delete(k);
  return ++h.n > perMin;
}
async function limited(env, binding, key, perMin) {
  if (overLocal(binding + ':' + key, perMin)) return true;
  const b = env[binding];
  if (b && typeof b.limit === 'function') { try { return !(await b.limit({ key })).success; } catch (e) { return false; } }
  return false;
}
async function readJson(req, max) {
  const n = Number(req.headers.get('content-length') || 0);
  if (n > max) throw Object.assign(new Error('too big'), { status: 413 });
  const txt = await req.text();
  if (txt.length > max) throw Object.assign(new Error('too big'), { status: 413 });
  try { return JSON.parse(txt); } catch (e) { throw Object.assign(new Error('bad json'), { status: 400 }); }
}
// 토큰: Authorization: Bearer … 또는 (WebSocket) Sec-WebSocket-Protocol: oreum, t.<토큰>
function tokenOf(req) {
  const a = req.headers.get('authorization') || '';
  if (a.startsWith('Bearer ')) return a.slice(7);
  const pr = (req.headers.get('Sec-WebSocket-Protocol') || '').split(',').map((s) => s.trim()).find((s) => s.startsWith('t.'));
  return pr ? pr.slice(2) : null;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const rawOrigin = req.headers.get('Origin');
    const origin = allowOrigin(env, rawOrigin);
    const cors = origin ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'content-type, authorization', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } : { Vary: 'Origin' };
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...SEC_HEADERS, ...cors } });
    if (url.pathname === '/' || url.pathname === '/health') return json({ ok: true, game: 'oreumoreum', cap: NET.roomCap, ready: !!secret(env) });
    const S = secret(env);
    if (!S) return json({ error: 'server not configured' }, 503); // SESSION_SECRET 없이는 뜨지 않음
    // 오류 알림 묶어 보기 (#122): 로그인·Origin 없이 읽기 (예약 작업이 주기적으로 읽음). 내보내는 칸은 server/src/crashes.js
    if (url.pathname === '/crashes' && (req.method === 'GET' || req.method === 'OPTIONS')) {
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...SEC_HEADERS, ...cors } });
      if (await limited(env, 'RL_API', await ipKey(S, req.headers.get('CF-Connecting-IP') || 'local'), NET.reqPerMin)) return json({ error: 'too many' }, 429);
      const days = Math.max(1, Math.min(CRASHES.maxDays, Math.floor(Number(url.searchParams.get('days'))) || CRASHES.days));
      const c = crashCache.get(days);
      if (c && Date.now() - c.t < CRASHES.cacheMs) return json(c.o);
      try {
        const o = { days, at: Date.now(), groups: groupCrashes(await accounts(env).crashRows(Date.now() - days * 864e5, CRASHES.rows)) };
        crashCache.set(days, { t: Date.now(), o });
        return json(o);
      } catch (e) { return json({ error: 'crashes' }, 500); }
    }
    // 게임 주소가 아닌 곳에서 온 요청은 모두 거절 (브라우저가 아닌 도구는 Origin 을 꾸밀 수 있으므로 이것만 믿지는 않음)
    if (!origin) return json({ error: 'origin' }, 403);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...SEC_HEADERS, ...cors } });
    const ipk = await ipKey(S, req.headers.get('CF-Connecting-IP') || 'local');
    let sess; // 한 요청 안에서 한 번만 확인
    const who = async () => {
      if (sess !== undefined) return sess;
      const r = await readSession(S, tokenOf(req));
      sess = r && (await accounts(env).auth(r.sub, r.iat, r.jti)) ? r : null;
      return sess;
    };
    try {
      if (url.pathname === '/ws') {
        if (req.headers.get('Upgrade') !== 'websocket') return json({ error: 'ws only' }, 426);
        const room0 = url.searchParams.get('room') || '', ch = Math.max(0, Math.min(NET.maxCh - 1, parseInt(url.searchParams.get('ch'), 10) || 0));
        const loadtest = env.STATS_OPEN === '1' && /^loadtest-[a-z0-9-]{1,40}$/.test(room0); // 로컬 부하 재기 방은 연결 수 제한 없이
        if (!ROOM_RE.test(room0) && !loadtest) return json({ error: 'room' }, 400); // 정해진 방만 (방 만들기 폭주 막기)
        const room = loadtest ? room0 : roomOf(room0);
        if (!loadtest && (await limited(env, 'RL_WS', ipk, NET.wsPerMin))) return json({ error: 'too many' }, 429);
        const s = await who();
        const stub = env.ROOM.get(env.ROOM.idFromName(room + '#' + ch));
        const h = new Headers(req.headers); for (const k of ['x-acct', 'x-cap', 'x-ipk', 'x-proto', 'authorization']) h.delete(k); h.set('x-ipk', ipk); // 꾸민 x-* 헤더는 지움
        if (s) h.set('x-acct', s.sub);
        if (req.headers.get('Sec-WebSocket-Protocol')) h.set('x-proto', '1');
        if (loadtest) h.set('x-cap', '500'); // 부하 재기: 정원 없이
        return stub.fetch(new Request(url.origin + '/ws?room=' + room, { headers: h })); // 토큰은 주소에 싣지 않음
      }
      if (await limited(env, 'RL_API', ipk, NET.reqPerMin)) return json({ error: 'too many' }, 429);

      if (url.pathname === '/auth/google' && req.method === 'POST') {
        if (await limited(env, 'RL_LOGIN', ipk, NET.loginPerMin)) return json({ error: 'too many' }, 429);
        const { credential } = await readJson(req, 8192);
        let sub;
        if (env.FAKE_AUTH === '1' && typeof credential === 'string' && credential.startsWith('fake:')) sub = 'fake-' + credential.slice(5, 60).replace(/[^0-9A-Za-z_-]/g, '');
        else { try { sub = await verifyGoogle(credential, env.GOOGLE_CLIENT_ID); } catch (e) { return json({ error: 'login' }, 401); } }
        const acc = await accounts(env).touch(sub);
        const { token, exp } = await signSession(S, sub, NET.sessionDays);
        return json({ token, exp, isNew: acc.isNew, hasSave: !!acc.save, nick: acc.nick, keepUntil: acc.keepUntil, admin: adminSubs(env).has(sub) });
      }

      if (url.pathname === '/me') {
        const s = await who(); if (!s) return json({ error: 'login' }, 401);
        const A = accounts(env);
        if (req.method === 'GET') {
          const me = await A.touch(s.sub);
          me.admin = adminSubs(env).has(s.sub);
          if (s.exp - Date.now() < NET.sessionRenew * 864e5) { const n = await signSession(S, s.sub, NET.sessionDays); me.token = n.token; me.exp = n.exp; await A.revoke(s.jti, s.exp); } // 새 토큰으로 바꾸고 옛 것은 버림
          return json(me);
        }
        if (req.method === 'DELETE') { await A.revoke(s.jti, s.exp); return json(await A.del(s.sub)); }
      }
      // 로그아웃: 이 토큰을 버림 (다른 기기의 토큰은 그대로)
      if (url.pathname === '/logout' && req.method === 'POST') {
        const s = await who(); if (s) await accounts(env).revoke(s.jti, s.exp);
        return json({ ok: true });
      }
      if (url.pathname === '/save' && req.method === 'PUT') {
        const s = await who(); if (!s) return json({ error: 'login' }, 401);
        const body = await readJson(req, NET.saveMax + 4096);
        if (!body || typeof body.save !== 'object') return json({ error: 'bad save' }, 400);
        return json(await accounts(env).put(s.sub, body.save, { migrate: !!body.migrate, free: adminSubs(env).has(s.sub), ver: cleanText(body.ver, 20) }));
      }
      // 이름 바꾸기 (#162): POST /nick {nick, price} → { ok, nick, paid, coins, rev, nickRen } 또는 { error: bad|same|day|price|coins (, price) }
      if (url.pathname === '/nick' && req.method === 'POST') {
        const s = await who(); if (!s) return json({ error: 'login' }, 401);
        const b = await readJson(req, 1024);
        if (!b || typeof b.nick !== 'string' || typeof b.price !== 'number') return json({ error: 'bad' }, 400);
        const at = env.FAKE_AUTH === '1' && Number.isFinite(b.at) ? b.at : Date.now(); // 로컬 검사(tools/sec.js)만 날을 바꿔 볼 수 있음
        const r = await accounts(env).rename(s.sub, b.nick, b.price, at);
        return json(r, r.error ? 409 : 200);
      }
      // 랭킹 (#11): 로그인한 사람만. GET /rank?range=day|week|all → 위 RANK.top 명 + 내 순위, GET /rank/me?srv= → 내 순위 셋
      if ((url.pathname === '/rank' || url.pathname === '/rank/me') && req.method === 'GET') {
        const s = await who(); if (!s) return json({ error: 'login' }, 401);
        const srv = SRVS[0]; // 서버는 전투 오름 하나 (#98). 예전 클라이언트의 srv=clean 도 battle 로
        if (url.pathname === '/rank/me') return json(await accounts(env).rankMe(s.sub, srv));
        const range = RANGES.includes(url.searchParams.get('range')) ? url.searchParams.get('range') : 'day';
        return json(await accounts(env).rank(s.sub, range, srv));
      }
      // 철 이벤트 (#180): 서버 날짜(달력)·모두의 트리 합계. 로그인 안 해도 됨 (손님도 트리를 봄)
      if (url.pathname === '/season' && req.method === 'GET') return json(await accounts(env).seasonInfo());
      // 의견 보내기 (#77): 로그인 안 해도 됨. 저장하고 개발자 메일로 (FEEDBACK_TO 시크릿)
      if (url.pathname === '/feedback' && req.method === 'POST') {
        const items = cleanItems((await readJson(req, 64e3)).items);
        if (!items.length) return json({ error: 'empty' }, 400);
        const A = accounts(env);
        const n = await A.feedbackAdd(await ipKey(S, req.headers.get('CF-Connecting-IP') || 'local', 'fb'), items);
        if (n < 0) return json({ error: 'too many' }, 429);
        let mailed = false;
        try { mailed = await sendMail(env, items, !!(await who())); if (mailed) await A.feedbackMailed(n); } catch (e) { mailed = false; }
        return json({ ok: true, n, mailed });
      }
      if (url.pathname === '/feedback' && req.method === 'GET') { // 받은 의견 보기: 어드민(또는 로컬 확인)만
        const s = await who();
        if (!(env.STATS_OPEN === '1' || (s && adminSubs(env).has(s.sub)))) return json({ error: 'admin' }, 403);
        const before = Math.max(0, Math.floor(Number(url.searchParams.get('before'))) || 0); // 이어 받기: 이 id 보다 오래된 50개 (#96)
        return json(await accounts(env).feedbackList(50, before));
      }
      // 귤 맞춤 기록·운영자 귤 보내기 (#188): 어드민(ADMIN_SUBS)만. 로컬 확인(STATS_OPEN)도 어드민 계정이어야 함 (남에게 귤을 보내는 길이라)
      if (url.pathname.startsWith('/admin/')) {
        const s = await who();
        if (!(s && adminSubs(env).has(s.sub))) return json({ error: 'admin' }, 403);
        const A = accounts(env);
        if (url.pathname === '/admin/clamps' && req.method === 'GET') return json(await A.clampList(Math.max(1, Math.min(NET.clampKeepDays, Math.floor(Number(url.searchParams.get('days'))) || NET.clampKeepDays))));
        if (url.pathname === '/admin/grants' && req.method === 'GET') return json(await A.grantList());
        if (url.pathname === '/admin/grant' && req.method === 'POST') {
          const b = await readJson(req, 4096);
          const sub = typeof b?.sub === 'string' ? b.sub.trim() : '', n = Math.floor(Number(b?.n)), why = cleanText(b?.why, 60);
          if (!/^[0-9A-Za-z_-]{1,80}$/.test(sub) || !(n >= 1 && n <= NET.grantMax) || !why) return json({ error: 'bad grant' }, 400);
          const r = await A.grant(sub, n, why, s.sub);
          return json(r, r.error ? 404 : 200);
        }
        return json({ error: 'not found' }, 404);
      }
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: e && e.status ? e.message : 'bad request' }, (e && e.status) || 400); // 안쪽 오류 내용은 내보내지 않음
    }
  },
  async scheduled(ev, env) {
    await accounts(env).purge(Date.now() - NET.keepDays * 864e5);
  },
};
