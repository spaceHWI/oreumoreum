// 방 (#7): 오름·서버 종류·채널마다 Durable Object 하나. WebSocket 으로 붙고 NET.tickMs 마다 모아 보냄
import { DurableObject } from 'cloudflare:workers';
import { NET } from '../../src/balance.js';
import { createRoomCore } from './roomcore.js';

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.core = null; this.timer = null; this.saveT = 0;
    ctx.blockConcurrencyWhile(async () => {
      const [heaps, seen] = await Promise.all([ctx.storage.get('heaps'), ctx.storage.get('seen')]);
      this.core = createRoomCore({ heaps, seen: seen || 0, stats: env.STATS_OPEN === '1' });
    });
  }
  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('ws only', { status: 426 });
    const pair = new WebSocketPair(); const [client, ws] = Object.values(pair);
    ws.accept();
    const acct = req.headers.get('x-acct') || null;
    const xc = parseInt(req.headers.get('x-cap'), 10); if (xc > 0) this.core.setCap(xc); // 부하 재기 방만 (index.js)
    const p = this.core.join((s) => ws.send(s), { acct });
    if (!p) { ws.close(4001, 'full'); return new Response(null, { status: 101, webSocket: client }); }
    ws.addEventListener('message', (e) => this.core.message(p, typeof e.data === 'string' ? e.data : ''));
    const bye = () => { this.core.leave(p); if (!this.core.size) this.stop(); };
    ws.addEventListener('close', bye); ws.addEventListener('error', bye);
    if (!this.timer) this.timer = setInterval(() => this.tick(), NET.tickMs);
    return new Response(null, { status: 101, webSocket: client });
  }
  tick() {
    this.core.step();
    if (++this.saveT >= 50) { this.saveT = 0; this.persist(); } // 5초마다 더미 상태 저장
  }
  stop() { clearInterval(this.timer); this.timer = null; this.persist(); }
  persist() {
    const p = [this.ctx.storage.put('seen', this.core.seen)];
    if (this.core.takeDirty()) p.push(this.ctx.storage.put('heaps', this.core.heaps().slice()));
    return Promise.all(p).catch(() => {});
  }
}
