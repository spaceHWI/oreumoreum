// 쓰레기 줍기 때문에 방이 보내는 메시지 수·바이트 (#300 앞·뒤 비교): node tools/ownmsgs.js [저장소 뿌리]
// 방(server/src/roomcore.js)을 Node 에서 가짜 시계로. n 명이 5분 동안 1초에 한 번씩 더미를 줍고(더미 크기 비율대로 고름), 틱(1초 10번)마다 step
// 줍기 말고 다른 메시지(위치 등)는 보내지 않아서, 나가는 것은 거의 hs(더미 남은 수 알림)·h(되돌림)·hi 뿐
// 앞(#300 전)과 비교하려면 dev 의 옛 커밋을 다른 폴더에 받아 그 뿌리를 넘김 (예: git worktree add /tmp/old <커밋>)
const path = require('path');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
(async () => {
  const { createRoomCore } = await import(path.join(root, 'server/src/roomcore.js'));
  const { HEAP_FULL } = await import(path.join(root, 'server/src/heaps.js'));
  const mul32 = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const tot = HEAP_FULL.reduce((a, b) => a + b, 0);
  const rows = [];
  for (const n of [10, 30]) {
    let T = 1e12; const core = createRoomCore({ now: () => T }), rnd = mul32(n);
    const ps = Array.from({ length: n }, (_, i) => core.join(() => {}, { acct: 'm' + i }));
    const s0 = core.stats();
    for (let s = 0; s < 300; s++) {
      for (let k = 0; k < 10; k++) { T += 100; core.step(); }
      for (const p of ps) { let x = rnd() * tot, h = 0; for (; h < HEAP_FULL.length - 1; h++) { x -= HEAP_FULL[h]; if (x <= 0) break; } core.message(p, JSON.stringify({ t: 'take', h, n: 2 })); }
    }
    const s1 = core.stats();
    rows.push({ 사람: n, '보낸 메시지(5분)': s1.msgsOut - s0.msgsOut, 'KB(5분)': +((s1.bytesOut - s0.bytesOut) / 1024).toFixed(1), '한 사람 1초 메시지': +((s1.msgsOut - s0.msgsOut) / n / 300).toFixed(2), '방 더미 저장(바이트)': JSON.stringify(core.heaps()).length });
  }
  console.log('뿌리', root);
  console.table(rows);
})();
