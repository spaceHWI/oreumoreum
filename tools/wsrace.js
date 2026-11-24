// 방 연결 갈아 끼우기 확인 (#307): node tools/wsrace.js
// 브라우저 없이 src/online.js 의 createWsLobby 에 가짜 WebSocket 을 끼워, '붙었음(open)' 이 옛 연결 것으로 남은 채 새 연결에 보내는 일이 없는지 본다
// 1. 서버가 오래 멈춤(idle)으로 내보낸 직후(옛 연결의 닫힘 알림이 오기 전) 다시 들어오기
// 2. 끊겨서 다시 붙기를 기다리는 사이 쉬러 갔다가 다시 들어오기
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const socks = [];
class FakeWS {
  constructor(url) { this.url = url; this.readyState = 0; this.sent = []; this.onmessage = null; this.onclose = null; socks.push(this); }
  send(s) { if (this.readyState === 0) { const e = new Error('The object is in an invalid state.'); e.name = 'InvalidStateError'; throw e; } if (this.readyState === 1) this.sent.push(s); }
  close() { if (this.readyState < 2) this.readyState = 2; }
  /* 서버 쪽 흉내 */
  hi(id) { this.readyState = 1; this.onmessage?.({ data: JSON.stringify({ t: 'hi', id, host: id }) }); }
  msg(m) { this.onmessage?.({ data: JSON.stringify(m) }); }
  drop(code) { this.readyState = 3; this.onclose?.({ code }); }
}
const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
Object.assign(globalThis, { __DEV__: true, WebSocket: FakeWS, location: { search: '?server=http://ws.test' }, sessionStorage: store(), localStorage: store() });

(async () => {
  const { createWsLobby } = await import('../src/online.js');
  const join = async () => { const room = await createWsLobby().join('race'); room.on('idle', () => room.sleep()); /* game/idle.js rest → net.rest 와 같음 */ return room; };
  const safe = (room) => { try { room.presence({ x: 1 }); room.send({ t: 'x' }); return ''; } catch (e) { return e.name; } };

  { // 1. 서버가 내보낸 직후 다시 들어오기
    socks.length = 0;
    const room = await join(); let idles = 0, closes = 0; room.on('idle', () => idles++); room.on('close', () => closes++);
    const s1 = socks[0]; s1.hi(1);
    ok(room.open && safe(room) === '' && s1.sent.length === 2, '붙은 뒤 보내기');
    s1.msg({ t: 'idle' });
    ok(room.asleep && !room.open && idles === 1 && closes === 1, `서버가 내보내면 바로 쉬는 상태 (붙었음 ${room.open}, 쉬는 화면 ${idles}번, 닫힘 ${closes}번)`);
    room.wake();
    const err = safe(room);
    ok(err === '', `다시 들어오는 중(새 연결이 붙기 전)에 보내도 오류 없음${err ? ' → ' + err : ''}`);
    s1.drop(4004); await wait(1200); // 옛 연결의 닫힘 알림이 늦게 옴
    ok(socks.length === 2 && !room.asleep && idles === 1, `옛 연결의 늦은 닫힘이 새 연결을 건드리지 않음 (연결 ${socks.length}개, 쉬는 화면 ${idles}번)`);
    socks[1].hi(2);
    ok(room.open && room.id === 2 && safe(room) === '' && socks[1].sent.length === 2, '새 연결이 붙으면 그쪽으로 보냄');
    room.close();
  }
  { // 2. 끊겨서 다시 붙기를 기다리는 사이 쉬러 갔다가 다시 들어오기
    socks.length = 0;
    const room = await join(); socks[0].hi(1);
    socks[0].drop(1006); // 끊김 → 1초 뒤 다시 붙기 예약
    room.sleep(); await wait(1200);
    ok(socks.length === 1, `쉬는 동안에는 다시 붙지 않음 (연결 ${socks.length}개)`);
    room.wake(); ok(socks.length === 2, '깨우면 하나 붙음');
    socks[1].hi(2); socks[1].drop(1006); // 다시 끊김 → 예약
    room.sleep(); room.wake(); // 예약이 남은 채 쉬었다 바로 깨움
    socks[2].hi(3); await wait(1200);
    const err = safe(room);
    ok(socks.length === 3 && room.open && err === '', `남은 예약이 붙은 연결을 갈아 치우지 않음 (연결 ${socks.length}개${err ? ', ' + err : ''})`);
    room.close(); await wait(50);
    ok(socks.every((s) => s.readyState >= 2), '닫으면 남는 연결 없음');
  }
  process.exit(process.exitCode || 0);
})().catch((e) => { console.log('FAIL', e); process.exit(1); });
