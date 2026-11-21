// 방 (#7): 오름·서버 종류·채널마다 Durable Object 하나. WebSocket 으로 붙고 NET.tickMs 마다 모아 보냄
import { DurableObject } from 'cloudflare:workers';
import { NET } from '../../src/balance.js';
import { createRoomCore } from './roomcore.js';

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.core = null; this.timer = null; this.saveT = 0; this.earnT = 0; this.onlT = 0; this.name = null;
    ctx.blockConcurrencyWhile(async () => {
      const [heaps, seen, guards] = await Promise.all([ctx.storage.get('heaps'), ctx.storage.get('seen'), ctx.storage.get('zg')]);
      const newSec = env.FAKE_AUTH === '1' && env.GIFT_NEW_SEC != null && env.GIFT_NEW_SEC !== '' && Number.isFinite(+env.GIFT_NEW_SEC) ? +env.GIFT_NEW_SEC : undefined; // 로컬 검사만 새 계정 기다림을 바꿈 (tools/sec.js)
      const gift = env.ACCOUNTS ? (a, b, n) => env.ACCOUNTS.get(env.ACCOUNTS.idFromName('all')).gift(a, b, n, Date.now(), newSec) : null; // 귤 주기 (#175)
      this.core = createRoomCore({ heaps, seen: seen || 0, stats: env.STATS_OPEN === '1', guards, gift });
    });
  }
  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('ws only', { status: 426 });
    const pair = new WebSocketPair(); const [client, ws] = Object.values(pair);
    ws.accept();
    const acct = req.headers.get('x-acct') || null, key = req.headers.get('x-ipk') || null, adm = req.headers.get('x-adm') === '1';
    // 브라우저가 하위 프로토콜(토큰 실어 보내기, #84)을 냈으면 'oreum' 으로 답해야 연결됨
    const headers = req.headers.get('x-proto') ? { 'Sec-WebSocket-Protocol': 'oreum' } : {};
    const xc = parseInt(req.headers.get('x-cap'), 10); if (xc > 0) this.core.setCap(xc); // 부하 재기 방만 (index.js)
    if (!this.name && !(xc > 0)) this.name = req.headers.get('x-room') || null; // 지금 접속 (#186): 방 이름 'oreum-<맵>-battle#<채널>' (index.js 가 붙임. 부하 재기 방은 세지 않음)
    let why = 'full';
    const p = this.core.join((s) => { if (s.startsWith('{"t":"ban"')) why = 'ban'; ws.send(s); }, { acct, key, adm, close: (c, r) => ws.close(c, r) });
    if (!p) { ws.close(why === 'ban' ? 4003 : 4001, why); return new Response(null, { status: 101, webSocket: client, headers }); }
    ws.addEventListener('message', (e) => this.core.message(p, typeof e.data === 'string' ? e.data : ''));
    this.report();
    let gone = false;
    const bye = () => { if (gone) return; gone = true; this.core.leave(p); this.report(); if (!this.core.size) this.stop(); };
    ws.addEventListener('close', bye); ws.addEventListener('error', bye);
    if (!this.timer) this.timer = setInterval(() => this.tick(), NET.tickMs);
    return new Response(null, { status: 101, webSocket: client, headers });
  }
  tick() {
    this.core.step();
    if (++this.saveT >= 50) { this.saveT = 0; this.persist(); } // 5초마다 더미 상태 저장
    if (++this.earnT >= NET.earnFlushMs / NET.tickMs) { this.earnT = 0; this.flushEarn(); }
    if (++this.onlT >= NET.onlineEveryMs / NET.tickMs) { this.onlT = 0; this.report(); } // 살아 있다는 소식 (오래 소식 없는 방은 계정 객체가 뺌)
  }
  stop() { clearInterval(this.timer); this.timer = null; this.persist(); this.flushEarn(); }
  // 받아 준 줍기로 번 몫을 계정에 넘김 (#144): 저장 확인(validate.js)이 버린 귤을 이 몫 안에서만 받아 줌
  flushEarn() {
    const list = this.core.takeEarned(); if (!list || !this.env?.ACCOUNTS) return;
    this.env.ACCOUNTS.get(this.env.ACCOUNTS.idFromName('all')).earn(list).catch(() => {});
  }
  // 지금 접속 (#186): 사람 수·로그인 수만 계정 객체에 (이름·번호는 보내지 않음)
  report() {
    if (!this.name || !this.env?.ACCOUNTS) return;
    const c = this.core.counts();
    this.env.ACCOUNTS.get(this.env.ACCOUNTS.idFromName('all')).roomCount(this.name, c.n, c.login).catch(() => {});
  }
  persist() {
    const p = [this.ctx.storage.put('seen', this.core.seen)];
    if (this.core.takeDirty()) p.push(this.ctx.storage.put('heaps', this.core.heaps().slice()));
    if (this.core.guardsDirty()) p.push(this.ctx.storage.put('zg', this.core.guards())); // 구역 지킴이 세운 시각 (#119)
    return Promise.all(p).catch(() => {});
  }
}
