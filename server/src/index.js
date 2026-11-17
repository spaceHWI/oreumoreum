// 오름오름 멀티 서버 (#7) 입구: 로그인·계정 저장·방 연결·날마다 정리
import { NET } from '../../src/balance.js';
import { verifyGoogle, signSession, readSession } from './auth.js';
export { Room } from './room.js';
export { Accounts } from './accounts.js';

const ROOM_RE = /^[a-z0-9-]{1,40}$/;
function allowOrigin(env, o) {
  if (!o) return null;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) return o; // 로컬 확인
  return (env.ALLOW_ORIGINS || '').split(',').map((s) => s.trim()).includes(o) ? o : null;
}
const secret = (env) => env.SESSION_SECRET || (env.FAKE_AUTH === '1' ? 'local-dev-secret' : null);
const accounts = (env) => env.ACCOUNTS.get(env.ACCOUNTS.idFromName('all'));

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = allowOrigin(env, req.headers.get('Origin'));
    const cors = origin ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'content-type, authorization', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } : {};
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', ...cors } });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const who = async () => { const s = secret(env); const a = req.headers.get('authorization') || ''; return s ? readSession(s, a.replace(/^Bearer /, '') || url.searchParams.get('token')) : null; };
    try {
      if (url.pathname === '/' || url.pathname === '/health') return json({ ok: true, game: 'oreumoreum', cap: NET.roomCap });

      if (url.pathname === '/ws') {
        if (req.headers.get('Upgrade') !== 'websocket') return json({ error: 'ws only' }, 426);
        const room = url.searchParams.get('room') || 'oreum', ch = Math.max(0, Math.min(NET.maxCh - 1, parseInt(url.searchParams.get('ch'), 10) || 0));
        if (!ROOM_RE.test(room)) return json({ error: 'room' }, 400);
        const sub = await who();
        const stub = env.ROOM.get(env.ROOM.idFromName(room + '#' + ch));
        const h = new Headers(req.headers); h.delete('x-acct'); h.delete('x-cap'); if (sub) h.set('x-acct', sub);
        if (env.STATS_OPEN === '1' && room.startsWith('loadtest-')) h.set('x-cap', '500'); // 부하 재기: 정원 없이
        return stub.fetch(new Request(req.url, { headers: h }));
      }

      if (url.pathname === '/auth/google' && req.method === 'POST') {
        const s = secret(env); if (!s) return json({ error: 'no SESSION_SECRET' }, 500);
        const { credential } = await req.json();
        let sub;
        if (env.FAKE_AUTH === '1' && typeof credential === 'string' && credential.startsWith('fake:')) sub = 'fake-' + credential.slice(5, 60);
        else sub = await verifyGoogle(credential, env.GOOGLE_CLIENT_ID);
        const acc = await accounts(env).touch(sub);
        const { token, exp } = await signSession(s, sub);
        return json({ token, exp, isNew: acc.isNew, hasSave: !!acc.save, nick: acc.nick, keepUntil: acc.keepUntil });
      }

      if (url.pathname === '/me') {
        const sub = await who(); if (!sub) return json({ error: 'login' }, 401);
        const A = accounts(env);
        if (req.method === 'GET') return json(await A.touch(sub));
        if (req.method === 'DELETE') return json(await A.del(sub));
      }
      if (url.pathname === '/save' && req.method === 'PUT') {
        const sub = await who(); if (!sub) return json({ error: 'login' }, 401);
        const body = await req.json();
        return json(await accounts(env).put(sub, body.save, { migrate: !!body.migrate }));
      }
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 400);
    }
  },
  async scheduled(ev, env) {
    await accounts(env).purge(Date.now() - NET.keepDays * 864e5);
  },
};
