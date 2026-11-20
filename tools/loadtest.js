// 부하 재기 (#7): node tools/loadtest.js [서버주소=http://127.0.0.1:8787] [인원들=10,20,30,50,80,100] [--sec 20] [--core]
// 가짜 접속자 N 명이 한 방에 붙어 걷고(초당 10번 위치), 쓰레기를 줍고(2초에 한 번쯤), 귤을 던진다(가끔 맞힘 알림).
// 재는 것
//  - 메시지 지연: 따로 붙은 재기용 접속자 하나가 0.25초마다 ping → pong 왕복 시간 (평균·95%)
//  - 보내는 양: 서버가 한 사람에게 보내는 바이트/초 (받은 쪽에서 셈)·방 전체 나가는 양
//  - 서버 한 틱 시간 (--core 또는 늘): Workers 안에서는 시계가 멈춰 있어 잴 수 없으므로 같은 방 코드(server/src/roomcore.js)를
//    Node(같은 V8)에서 그 인원·그 속도로 돌려 한 틱(모아 보내기)과 1초 동안 받는 메시지 처리 시간을 잼
//  - --old: 옛 클라이언트처럼 옷·닉네임을 매번 실어 보냄. 없으면 처음과 identMs 마다만 (#115)
// 로컬: cd server && npm run dev  → node tools/loadtest.js
// 배포된 서버: node tools/loadtest.js https://oreumoreum.<계정>.workers.dev 10,30
const args = process.argv.slice(2);
const flag = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const SEC = +flag('--sec', 20);
const OUT = flag('--out', null);
const coreOnly = args.includes('--core'); if (coreOnly) args.splice(args.indexOf('--core'), 1);
const OLD = args.includes('--old'); if (OLD) args.splice(args.indexOf('--old'), 1);
const ID_EVERY = 100; // 10초 (NET.identMs) 마다 옷·닉네임 한 번 더
const SRV = (args[0] || 'http://127.0.0.1:8787').replace(/\/+$/, '');
const COUNTS = (args[1] || '10,20,30,50,80,100').split(',').map(Number);
const WS = SRV.replace(/^http/, 'ws');
// 서버는 게임 주소 Origin 만 받음 (#84). 로컬 서버는 로컬 주소, 배포된 서버는 ORIGIN=https://spacehwi.github.io 처럼 넘김 (요청 수 제한 RL_WS 에 걸릴 수 있음)
const WSO = { headers: { Origin: process.env.ORIGIN || 'http://127.0.0.1:5173' } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (a, p) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const avg = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);

// 남송이 들머리 근처 300m 안을 돌아다님. 20% 는 멀리(150m 밖) 떨어진 곳
function walker(i) {
  const far = i % 5 === 4;
  let x = -860 + (far ? 220 : 0) + (Math.random() - 0.5) * 60, z = (Math.random() - 0.5) * 60, h = Math.random() * 6.28;
  return () => { h += (Math.random() - 0.5) * 0.3; x += Math.sin(h) * 0.6; z += Math.cos(h) * 0.6; return { x: +x.toFixed(2), z: +z.toFixed(2), h: +h.toFixed(3) }; };
}
const OUTFIT = { hr: 'bun', hrc: '#2a221c', sk: '#ffdcbf', h: 'cap', hc: '#5c9a3c', hb: 1, g: 'none', v: 'on', vc: '#e2683c', s: '#e8d9b5', st: 'tee', p: 'shorts', pc: '#8a6a3c', sh: '#26262b', sht: 'road', gr: { hand: 'hand:tongs', back: 'back:pack1', shoes: 'shoes:road', hat: 'hat:w-cap', top: 'top:w-tee', bottom: 'bottom:w-shorts' } };
const presence = (i, pos, extra, k = 0) => ({ ...(OLD || k % ID_EVERY === 0 ? { nick: '부하' + i, o: OUTFIT } : {}), ...pos, run: false, pose: 'move', jy: 0, spd: 3.2, ht: null, yl: 0, say: null, pq: null, rd: 0, ...extra });

async function runServer(n, room) {
  const clients = []; let bytesIn = 0, msgsIn = 0, full = 0, sentB = 0;
  const open = (url) => new Promise((ok) => { const ws = new WebSocket(url, WSO); const c = { ws, id: null }; ws.onmessage = (e) => { bytesIn += e.data.length; msgsIn++; const m = JSON.parse(e.data); if (m.t === 'hi') { c.id = m.id; ok(c); } else if (m.t === 'full') { full++; ok(null); } }; ws.onerror = () => ok(null); });
  for (let i = 0; i < n; i++) { const c = await open(`${WS}/ws?room=${room}&ch=0`); if (c) clients.push(c); if (i % 10 === 9) await sleep(50); }
  const ids = clients.map((c) => c.id);
  // 재기용
  const rtts = []; const probe = await new Promise((ok) => { const ws = new WebSocket(`${WS}/ws?room=${room}&ch=0`, WSO); ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.t === 'hi' || m.t === 'full') ok(m.t === 'hi' ? ws : null); if (m.t === 'pong') rtts.push(performance.now() - m.c); }; });
  if (!probe) console.error('  재기용 접속자가 방에 못 들어감 (정원)');
  await sleep(500);
  bytesIn = 0; msgsIn = 0;
  const walks = clients.map((_, i) => walker(i));
  const t0 = performance.now(); let k = 0;
  const timer = setInterval(() => {
    k++;
    clients.forEach((c, i) => {
      if (c.ws.readyState !== 1) return;
      const ex = {};
      if (k % 30 === i % 30) ex.ht = { p: ids[(i + 1) % ids.length], at: Date.now() }; // 3초에 한 번쯤 맞힘 알림
      const s = JSON.stringify({ t: 'p', d: presence(i, walks[i](), ex, k - 1) }); sentB += s.length; c.ws.send(s);
      if (k % 20 === i % 20) c.ws.send(JSON.stringify({ t: 'take', h: (i * 7 + k) % 60 })); // 2초에 한 번쯤 줍기
    });
    if (probe && k % 2 === 0) probe.send(JSON.stringify({ t: 'ping', c: performance.now() }));
  }, 100);
  await sleep(SEC * 1000);
  clearInterval(timer);
  const sec = (performance.now() - t0) / 1000;
  let stats = null;
  if (probe) { stats = await new Promise((ok) => { probe.onmessage = (e) => { const m = JSON.parse(e.data); if (m.t === 'stats') ok(m); }; probe.send(JSON.stringify({ t: 'stats' })); setTimeout(() => ok(null), 2000); }); }
  clients.forEach((c) => c.ws.close()); probe?.close();
  await sleep(800);
  return { n, joined: clients.length, full, rttAvg: avg(rtts), rtt95: pct(rtts, 0.95), rttMax: Math.max(0, ...rtts), perClientKBs: bytesIn / Math.max(1, clients.length) / sec / 1024, perClientMsgs: msgsIn / Math.max(1, clients.length) / sec, inKBs: sentB / sec / 1024, roomOutKBs: stats ? null : null, stats };
}

// 같은 방 코드를 Node 에서: n 명이 초당 10번 보내고, 0.1초마다 한 틱
async function runCore(n) {
  const { createRoomCore } = await import('../server/src/roomcore.js');
  let bytes = 0, inB = 0;
  const core = createRoomCore({ cap: 1000 });
  const ps = []; for (let i = 0; i < n; i++) ps.push(core.join((s) => { bytes += s.length; }));
  const walks = ps.map((_, i) => walker(i));
  const tick = [], msg = [];
  for (let k = 0; k < 100; k++) { // 10초어치
    const a = performance.now();
    ps.forEach((p, i) => { const s = JSON.stringify({ t: 'p', d: presence(i, walks[i](), k % 30 === i % 30 ? { ht: { p: ps[(i + 1) % n].id, at: Date.now() + k } } : {}, k) }); inB += s.length; core.message(p, s); if (k % 20 === i % 20) core.message(p, JSON.stringify({ t: 'take', h: (i + k) % 60 })); });
    // 토큰이 다시 차도록 시계를 0.1초 앞으로 (message 안에서 Date.now 로 셈) → 실제 시간으로 흉내 내기 위해 아주 잠깐 쉼
    const b = performance.now();
    core.step();
    const c = performance.now();
    msg.push(b - a); tick.push(c - b);
    await sleep(100);
  }
  return { n, tickAvg: avg(tick), tickMax: Math.max(...tick), tick95: pct(tick, 0.95), msgsPerTickMs: avg(msg), cpuPerSecMs: (avg(tick) + avg(msg)) * 10, outKBs: bytes / 10 / 1024, inKBs: inB / 10 / 1024 };
}

(async () => {
  const res = { server: SRV, sec: SEC, core: [], net: [] };
  for (const n of COUNTS) {
    const r = await runCore(n); res.core.push(r);
    console.error(`[core] ${n}명: 틱 평균 ${r.tickAvg.toFixed(2)}ms (95% ${r.tick95.toFixed(2)} 최대 ${r.tickMax.toFixed(2)}) · 받은 메시지 처리 ${r.msgsPerTickMs.toFixed(2)}ms/틱 · 1초 CPU ${r.cpuPerSecMs.toFixed(1)}ms · 방이 받는 양 ${r.inKBs.toFixed(1)}KB/s · 방에서 나가는 양 ${r.outKBs.toFixed(0)}KB/s`);
  }
  if (!coreOnly) {
    let ok = false; try { ok = (await fetch(SRV + '/health')).ok; } catch (e) { ok = false; }
    if (!ok) console.error(`서버(${SRV})에 붙지 못함 — 틱 시간만 잼`);
    else for (const n of COUNTS) {
      const r = await runServer(n, 'loadtest-' + n + '-' + Date.now().toString(36)); res.net.push(r);
      console.error(`[net] ${n}명 (들어감 ${r.joined}, 정원 초과 ${r.full}): 지연 평균 ${r.rttAvg.toFixed(1)}ms 95% ${r.rtt95.toFixed(1)}ms 최대 ${r.rttMax.toFixed(0)}ms · 서버가 받는 양 ${r.inKBs.toFixed(1)}KB/s · 한 사람이 받는 양 ${r.perClientKBs.toFixed(1)}KB/s (${r.perClientMsgs.toFixed(1)}개/s)${r.stats ? ` · 방 전체 나간 양 ${(r.stats.bytesOut / 1024 / SEC).toFixed(0)}KB/s 버린 메시지 ${r.stats.dropped}` : ''}`);
    }
  }
  console.log(JSON.stringify(res, null, 1));
  if (OUT) require('fs').writeFileSync(OUT, JSON.stringify(res, null, 1));
  process.exit(0);
})();
