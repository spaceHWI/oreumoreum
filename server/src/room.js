// 방 (#7): 오름·서버 종류·채널마다 Durable Object 하나. WebSocket 으로 붙고 NET.tickMs 마다 모아 보냄
import { DurableObject } from 'cloudflare:workers';
import { NET } from '../../src/balance.js';
import { createRoomCore } from './roomcore.js';

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.core = null; this.timer = null; this.saveT = 0; this.earnT = 0;
    ctx.blockConcurrencyWhile(async () => {
      const [heaps, seen, guards] = await Promise.all([ctx.storage.get('heaps'), ctx.storage.get('seen'), ctx.storage.get('zg')]);
      this.core = createRoomCore({ heaps, seen: seen || 0, stats: env.STATS_OPEN === '1', guards });
    });
  }
  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('ws only', { status: 426 });
    const pair = new WebSocketPair(); const [client, ws] = Object.values(pair);
    ws.accept();
    const acct = req.headers.get('x-acct') || null, key = req.headers.get('x-ipk') || null;
    // 브라우저가 하위 프로토콜(토큰 실어 보내기, #84)을 냈으면 'oreum' 으로 답해야 연결됨
    const headers = req.headers.get('x-proto') ? { 'Sec-WebSocket-Protocol': 'oreum' } : {};
    const xc = parseInt(req.headers.get('x-cap'), 10); if (xc > 0) this.core.setCap(xc); // 부하 재기 방만 (index.js)
    let why = 'full';
    const p = this.core.join((s) => { if (s.startsWith('{"t":"ban"')) why = 'ban'; ws.send(s); }, { acct, key, admin: req.headers.get('x-admin') === '1', close: (c, r) => ws.close(c, r) });
    if (!p) { ws.close(why === 'ban' ? 4003 : 4001, why); return new Response(null, { status: 101, webSocket: client, headers }); }
    ws.addEventListener('message', (e) => this.core.message(p, typeof e.data === 'string' ? e.data : ''));
    const bye = () => { this.core.leave(p); if (!this.core.size) this.stop(); };
    ws.addEventListener('close', bye); ws.addEventListener('error', bye);
    if (!this.timer) this.timer = setInterval(() => this.tick(), NET.tickMs);
    return new Response(null, { status: 101, webSocket: client, headers });
  }
  tick() {
    this.core.step();
    if (++this.saveT >= 50) { this.saveT = 0; this.persist(); } // 5초마다 더미 상태 저장
    if (++this.earnT >= NET.earnFlushMs / NET.tickMs) { this.earnT = 0; this.flushEarn(); }
  }
  stop() { clearInterval(this.timer); this.timer = null; this.persist(); this.flushEarn(); }
  // 받아 준 줍기로 번 몫을 계정에 넘김 (#144): 저장 확인(validate.js)이 버린 귤을 이 몫 안에서만 받아 줌
  flushEarn() {
    const list = this.core.takeEarned(); if (!list || !this.env?.ACCOUNTS) return;
    this.env.ACCOUNTS.get(this.env.ACCOUNTS.idFromName('all')).earn(list).catch(() => {});
  }
  persist() {
    const p = [this.ctx.storage.put('seen', this.core.seen)];
    if (this.core.takeDirty()) p.push(this.ctx.storage.put('heaps', this.core.heaps().slice()));
    if (this.core.guardsDirty()) p.push(this.ctx.storage.put('zg', this.core.guards())); // 구역 지킴이 세운 시각 (#119)
    return Promise.all(p).catch(() => {});
  }
}
