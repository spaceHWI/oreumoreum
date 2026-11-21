// 보안 검사 (#84): node tools/sec.js [--keep]
// 로컬 서버(wrangler dev)를 설정 넷으로 띄워 공격을 흉내 내고 모두 막히는지 본다. 끝나면 서버를 끔 (--keep 이면 둠)
//   dev   : FAKE_AUTH·STATS_OPEN (가짜 로그인, 로컬 주소 허용) — 귤·물건 부풀리기, 닉네임·말 넣기, 순간 이동, 폭주, 줍기, 토큰
//   plain : FAKE_AUTH 만, ADMIN_SUBS=fake-boss — 손님·다른 계정의 어드민 시도
//   prod  : SESSION_SECRET 만 (공개 서버와 같은 설정) — 다른 Origin·로컬 Origin 거절, 요청 수 제한
//   nokey : 아무 시크릿 없음 — 서버가 뜨지 않음(503)
// 마지막에 dist/index.html(node build.mjs 결과)의 CSP·비밀 값도 훑는다
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const KEEP = process.argv.includes('--keep');
const SERVER_DIR = path.join(__dirname, '..', 'server');
const CFG = {
  dev: { port: 8797, vars: ['FAKE_AUTH:1', 'STATS_OPEN:1'] },
  plain: { port: 8798, vars: ['FAKE_AUTH:1', 'ADMIN_SUBS:fake-boss'] },
  prod: { port: 8799, vars: ['SESSION_SECRET:prod-like-secret-0123456789abcdef0123'] },
  nokey: { port: 8800, vars: [] },
};
const DEV_SECRET = 'local-dev-secret-local-dev-secret';
const GAME = 'https://spacehwi.github.io', LOCAL = 'http://127.0.0.1:5173', EVIL = 'https://evil.example';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = [];
const ok = (c, m) => { rows.push([c, m]); console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
const url = (k, p) => `http://127.0.0.1:${CFG[k].port}${p}`;

async function req(k, p, { method = 'GET', body, origin = LOCAL, token } = {}) {
  const h = { 'content-type': 'application/json' };
  if (origin) h.Origin = origin;
  if (token) h.authorization = 'Bearer ' + token;
  const r = await fetch(url(k, p), { method, headers: h, body: body == null ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  let j = null; try { j = await r.json(); } catch (e) { j = null; }
  return { status: r.status, j, h: r.headers };
}
const login = async (k, name, origin = LOCAL) => (await req(k, '/auth/google', { method: 'POST', body: { credential: 'fake:' + name }, origin })).j;

// WebSocket 하나: 받은 메시지를 모아 둠
function sock(k, room, { origin = LOCAL, token, ch = 0 } = {}) {
  return new Promise((done) => {
    const o = { msgs: [], closed: null, ws: null, proto: null };
    const opt = { headers: origin ? { Origin: origin } : {} };
    if (token) opt.protocols = ['oreum', 't.' + token];
    let ws;
    try { ws = new WebSocket(url(k, `/ws?room=${room}&ch=${ch}`).replace(/^http/, 'ws'), opt); } catch (e) { o.closed = 'throw'; done(o); return; }
    o.ws = ws;
    const t = setTimeout(() => done(o), 4000);
    ws.onopen = () => { o.proto = ws.protocol; };
    ws.onmessage = (e) => { const m = JSON.parse(e.data); o.msgs.push(m); if (m.t === 'hi' || m.t === 'ban' || m.t === 'full') { clearTimeout(t); done(o); } };
    ws.onerror = () => { o.closed ||= 'error'; };
    ws.onclose = (e) => { o.closed = e.code || 'closed'; clearTimeout(t); done(o); };
    o.send = (m) => { try { ws.send(typeof m === 'string' ? m : JSON.stringify(m)); } catch (e) { /* 끊김 */ } };
    o.close = () => { try { ws.close(); } catch (e) { /* 무시 */ } };
    o.last = (tt) => [...o.msgs].reverse().find((m) => m.t === tt);
  });
}
const presence = (x, z, extra = {}) => ({ t: 'p', d: { nick: '검사', x, z, h: 0, ...extra } });

// 같은 서명 방식으로 토큰 만들기 (만료·꾸민 토큰 검사용)
const b64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function forge(secret, o) { const pl = b64u(JSON.stringify(o)); return 'v2.' + pl + '.' + b64u(crypto.createHmac('sha256', secret).update(pl).digest()); }

async function startServers() {
  const procs = [];
  for (const [k, c] of Object.entries(CFG)) {
    const args = ['wrangler', 'dev', '--local', '--port', String(c.port), '--inspector-port', String(c.port + 1000), '--persist-to', path.join(require('os').tmpdir(), 'oreum-sec-' + k + '-' + Date.now())];
    for (const v of c.vars) args.push('--var', v);
    const p = spawn('npx', args, { cwd: SERVER_DIR, stdio: 'ignore', detached: true });
    procs.push(p);
  }
  for (const k of Object.keys(CFG)) {
    let up = false;
    for (let i = 0; i < 90 && !up; i++) { try { up = (await fetch(url(k, '/health'))).ok; } catch (e) { await sleep(1000); } }
    if (!up) throw new Error('서버가 안 뜸: ' + k);
  }
  return procs;
}

(async () => {
  const procs = process.argv.includes('--no-spawn') ? [] : await startServers();
  try {
    /* ---------- 시크릿·주소 ---------- */
    const nk = await req('nokey', '/auth/google', { method: 'POST', body: { credential: 'fake:a' }, origin: GAME });
    ok(nk.status === 503, `SESSION_SECRET 이 없으면 로그인 안 됨 (${nk.status})`);
    ok((await req('nokey', '/health')).j?.ready === false, '/health 가 준비 안 됨을 알림');
    const ev = await req('prod', '/me', { origin: EVIL });
    ok(ev.status === 403 && !ev.h.get('access-control-allow-origin'), `다른 Origin 거절 (${ev.status})`);
    ok((await req('prod', '/me', { origin: null })).status === 403, 'Origin 없는 요청 거절');
    ok((await req('prod', '/me', { origin: 'http://localhost:8080' })).status === 403, '공개 서버에서 로컬 주소 Origin 거절');
    const gm = await req('prod', '/me', { origin: GAME });
    ok(gm.status === 401 && gm.h.get('access-control-allow-origin') === GAME, `게임 주소는 통과 (로그인 없으면 401: ${gm.status})`);
    ok(gm.h.get('x-content-type-options') === 'nosniff' && /frame-ancestors 'none'/.test(gm.h.get('content-security-policy') || '') && gm.h.get('referrer-policy') === 'no-referrer', '서버 응답 보안 헤더');
    const wsEvil = await sock('prod', 'oreum-namsongi-battle', { origin: EVIL });
    ok(!wsEvil.msgs.some((m) => m.t === 'hi'), `WebSocket 다른 Origin 거절 (${wsEvil.closed})`);
    const wsNone = await sock('dev', 'oreum-namsongi-battle', { origin: null });
    ok(!wsNone.msgs.some((m) => m.t === 'hi'), 'WebSocket Origin 없으면 거절');
    const wsRoom = await sock('dev', 'zzz-flood-1');
    ok(!wsRoom.msgs.some((m) => m.t === 'hi'), '정해진 방 이름이 아니면 거절 (방 만들기 폭주)');

    /* ---------- 로그인·세션 ---------- */
    const A = await login('dev', 'alice');
    ok(A?.token?.startsWith('v2.'), '가짜 로그인 → 세션 토큰');
    ok((await req('dev', '/auth/google', { method: 'POST', body: { credential: 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.' } })).status === 401, '서명 없는(alg none) 구글 토큰 거절');
    ok((await req('dev', '/auth/google', { method: 'POST', body: { credential: 'x'.repeat(9000) } })).status >= 400, '아주 긴 로그인 값 거절');
    const sub = JSON.parse(Buffer.from(A.token.split('.')[1], 'base64')).s;
    ok((await req('dev', '/me', { token: forge(DEV_SECRET, { s: sub, i: Date.now(), e: Date.now() - 1000, j: 'x1' }) })).status === 401, '만료 토큰 거절');
    ok((await req('dev', '/me', { token: forge('wrong-secret-wrong-secret-wrong-secret', { s: sub, i: Date.now(), e: Date.now() + 9e6, j: 'x2' }) })).status === 401, '다른 키로 서명한 토큰 거절');
    const tp = A.token.split('.'); const other = b64u(JSON.stringify({ s: 'fake-bob', i: Date.now(), e: Date.now() + 9e6, j: 'x3' }));
    ok((await req('dev', '/me', { token: `v2.${other}.${tp[2]}` })).status === 401, '남의 sub 로 바꾼 토큰 거절');
    ok((await req('dev', '/me', { token: forge(DEV_SECRET, { s: 'fake-nobody', i: Date.now(), e: Date.now() + 9e6, j: 'x4' }) })).status === 401, '없는 계정 토큰 거절');
    const L = await login('dev', 'logout-me');
    ok((await req('dev', '/me', { token: L.token })).status === 200, '로그아웃 전 토큰 통함');
    await req('dev', '/logout', { method: 'POST', token: L.token });
    ok((await req('dev', '/me', { token: L.token })).status === 401, '로그아웃한 토큰 거절');
    const D = await login('dev', 'delete-me');
    await req('dev', '/me', { method: 'DELETE', token: D.token });
    const D2 = await login('dev', 'delete-me');
    ok((await req('dev', '/me', { token: D.token })).status === 401 && (await req('dev', '/me', { token: D2.token })).status === 200, '지운 계정의 옛 토큰 거절 (새로 만든 계정)');
    const old = forge(DEV_SECRET, { s: sub, i: Date.now(), e: Date.now() + 864e5, j: 'renew1' });
    const rn = await req('dev', '/me', { token: old });
    ok(rn.status === 200 && rn.j.token && rn.j.token !== old && (await req('dev', '/me', { token: old })).status === 401, '수명이 얼마 안 남은 토큰은 새로 주고 옛 것은 버림');

    /* ---------- 저장 (서버가 판정) ---------- */
    const { NET } = await import('../src/balance.js'); // 몫·줍기 한도는 balance.js 값으로 (#137 에서 커짐)
    const S0 = { coins: 5, equip: { tool: 1, bag: 0, shoes: 1, weapon: 1 }, clothes: { own: {}, wear: {} }, rides: { own: [], cur: null }, hairs: {}, trash: { total: 0 }, nick: 'a' };
    await req('dev', '/save', { method: 'PUT', token: A.token, body: { save: S0 } });
    const inflate = await req('dev', '/save', { method: 'PUT', token: A.token, body: { save: { ...S0, coins: 999999 } } });
    const me1 = (await req('dev', '/me', { token: A.token })).j;
    ok(inflate.j.fixed.includes('coins') && me1.save.coins <= 5 + NET.earnBurst + NET.earnPerSec * 5, `귤 부풀리기 바로잡힘 (${me1.save.coins})`);
    await req('dev', '/save', { method: 'PUT', token: A.token, body: { save: { ...S0, coins: 0 } } }); // 위에서 받아 준 몫을 비움 (귤이 줄어드는 건 늘 받아 줌)
    const buyAll = await req('dev', '/save', { method: 'PUT', token: A.token, body: { save: { ...S0, coins: 0, rides: { own: ['skate', 'scoot', 'horse'], cur: 'horse' }, equip: { tool: 5, bag: 5, shoes: 5, weapon: 3 } } } });
    const me2 = (await req('dev', '/me', { token: A.token })).j;
    ok(buyAll.j.fixed.includes('items') && me2.save.rides.own.length === 0 && me2.save.equip.tool === 1, '돈 없이 탈것·장비 사기 되돌림');
    const fakeItem = await req('dev', '/save', { method: 'PUT', token: A.token, body: { save: { ...S0, rides: { own: ['ufo'], cur: 'ufo' }, clothes: { own: { 'gold-crown': 1 }, wear: { hat: 'gold-crown' } } } } });
    const me3 = (await req('dev', '/me', { token: A.token })).j;
    ok(fakeItem.status === 200 && !me3.save.rides.own.length && !me3.save.clothes.own['gold-crown'], '목록에 없는 물건 지움');
    const tr = await req('dev', '/save', { method: 'PUT', token: A.token, body: { save: { ...S0, coins: me3.save.coins, trash: { total: 100000 } } } });
    ok(tr.j.fixed.includes('picked'), '치운 양(랭킹) 부풀리기 바로잡힘');
    // 여러 탭·기기: 같은 계정 토큰 둘로 번갈아 부풀려도 몫은 계정 하나
    const A2 = await login('dev', 'alice');
    let c = (await req('dev', '/me', { token: A.token })).j.save.coins;
    const step = Math.ceil(NET.earnBurst * 0.4), t0 = Date.now(); // 6번이면 몫(earnBurst)의 2.4배
    for (let i = 0; i < 6; i++) { const tk = i % 2 ? A.token : A2.token; c += step; await req('dev', '/save', { method: 'PUT', token: tk, body: { save: { ...S0, coins: c, trash: { total: 0 } } } }); c = (await req('dev', '/me', { token: tk })).j.save.coins; }
    ok(c <= me3.save.coins + NET.earnBurst + NET.earnPerSec * ((Date.now() - t0) / 1000 + 5), `여러 탭으로 몫 늘리기 막힘 (6번 +${step} → ${c})`);
    // 저장 되돌리기: 산 뒤 옛 저장(귤 많은 때)을 다시 보내면 늘어난 귤로 셈
    const big = await req('dev', '/save', { method: 'PUT', token: A.token, body: { save: { ...S0, coins: c + NET.earnBurst * 2 } } });
    ok(big.j.fixed.includes('coins'), '옛 저장 되돌리기도 몫 안에서만');
    ok((await req('dev', '/save', { method: 'PUT', token: A.token, body: '{"save":' + '"' + 'x'.repeat(260000) + '"}' })).status >= 400, '아주 큰 저장 거절');
    // 닉네임·말 넣기
    const bad = '<img src=x onerror=alert(1)>‮관리자\u0000'.repeat(3);
    await req('dev', '/save', { method: 'PUT', token: A.token, body: { save: { ...S0, coins: 0, nick: bad } } });
    const nk2 = (await req('dev', '/me', { token: A.token })).j.save.nick;
    ok(!/[<>‮\u0000]/.test(nk2) && [...nk2].length <= 16, `저장 닉네임 다듬음 (${JSON.stringify(nk2)})`);
    // 기본 옷 색 번호 (#155): 범위 밖·이상한 값은 버림
    await req('dev', '/save', { method: 'PUT', token: A.token, body: { save: { ...S0, coins: 0, look: { sex: 'm', skin: 0, colors: { hat: 99, top: -1, bottom: '3', shoes: 7, x: 5 } } } } });
    const lc = (await req('dev', '/me', { token: A.token })).j.save.look?.colors;
    ok(JSON.stringify(lc) === JSON.stringify({ shoes: 7 }), `범위 밖 옷 색 번호 버림 (${JSON.stringify(lc)})`);

    /* ---------- 방 (이동·줍기·폭주·맞힘) ---------- */
    const P = await sock('dev', 'oreum-namsongi-battle', { ch: 3, token: A.token });
    const Q = await sock('dev', 'oreum-namsongi', { ch: 3 }); // 예전 깨끗한 오름 방 이름 → battle 방으로 (#98): P 와 같은 방이어야 함
    ok(P.msgs[0]?.t === 'hi' && P.proto === 'oreum', `하위 프로토콜로 토큰 보내고 연결 (${P.proto})`);
    P.send(presence(-860, 0, { nick: bad, say: { t: '<script>alert(1)</script>' + 'ㅋ'.repeat(200), at: Date.now() } }));
    Q.send(presence(-860, 5));
    await sleep(400);
    const seen = Q.msgs.filter((m) => m.t === 'u').flatMap((m) => m.p).find(([id]) => id === P.msgs[0].id)?.[1];
    ok(seen && !/[<>‮]/.test(seen.nick) && [...seen.nick].length <= 16 && !/[<>]/.test(seen.say.t) && [...seen.say.t].length <= 60, '다른 사람에게 가는 닉네임·말풍선 다듬음');
    // 맞힘: 사거리 밖은 지움
    P.send(presence(-860.5, 0, { ht: { p: Q.msgs[0].id, at: 1 } }));
    Q.send(presence(-700, 5)); await sleep(200);
    Q.send(presence(-680, 5)); await sleep(400);
    P.send(presence(-860.2, 0, { ht: { p: Q.msgs[0].id, at: 2 } })); await sleep(1000); // 150m 밖은 0.5초마다 받음
    const lastP = Q.msgs.filter((m) => m.t === 'u').flatMap((m) => m.p).filter(([id]) => id === P.msgs[0].id).pop()?.[1];
    ok(lastP && !lastP.ht, '사거리 밖 맞힘 알림 지움');
    // 순간 이동: 한 번은 받아 주고(들것 귀환), 바로 또 하면 되돌림
    P.send(presence(-300, 0)); await sleep(150);
    P.send(presence(300, 0)); await sleep(300);
    const back = P.last('pos');
    ok(back && Math.abs(back.x - -300) < 1, `잦은 순간 이동 되돌림 (pos ${back && back.x})`);
    // 속도 조작: 0.1초마다 20m (200m/s) 를 계속 → 되돌리다 끊음
    let x = -300; for (let i = 0; i < 20; i++) { x += 20; P.send(presence(x, 0)); await sleep(100); }
    await sleep(300);
    ok(P.msgs.some((m) => m.t === 'kick') && P.closed, `속도 조작을 되풀이하면 끊음 (${P.closed})`);
    const P2 = await sock('dev', 'oreum-namsongi-battle', { ch: 3, token: A.token, origin: LOCAL });
    ok(P2.msgs.some((m) => m.t === 'ban') && !P2.msgs.some((m) => m.t === 'hi'), '끊긴 계정은 잠시 다시 못 들어옴');
    // 보통 걷기·달리기·말은 되돌리지 않음
    const W = await sock('dev', 'oreum-namsongi-battle', { ch: 4 });
    let wx = -860; for (let i = 0; i < 30; i++) { wx += 1.9; W.send(presence(wx, 0)); await sleep(100); }
    await sleep(200);
    ok(!W.last('pos'), '말 속도(19m/s)는 그대로 둠');
    // 줍기: 같은 더미 마지막 하나 동시 줍기·빠른 줍기
    const hi = W.msgs[0], h = hi.heaps.indexOf(Math.min(...hi.heaps.filter((n) => n > 0))), full = hi.heaps[h];
    const X = await sock('dev', 'oreum-namsongi-battle', { ch: 4 });
    let sent = 0;
    for (let r = 0; r < Math.ceil(full / 4) + 2; r++) { for (const s of [W, X]) { for (let j = 0; j < 3; j++) { s.send({ t: 'take', h }); sent++; } } await sleep(1100); }
    await sleep(300);
    const no = [W, X].reduce((n, s) => n + s.msgs.filter((m) => m.t === 'h' && m.h === h && m.no).length, 0);
    ok(sent - no === full, `동시 줍기: 더미 ${full}개에 ${sent}번 → 받아 준 줍기 ${sent - no} (나머지는 되돌리라고 알림)`);
    const fast = await sock('dev', 'oreum-namsongi-battle', { ch: 5 });
    // #137: 줍기는 더미마다 묶어 {t:'take', h, n} 으로 옴. 한 번에 takeMax 개씩 4번 = takePerSec 넘게
    const h2 = fast.msgs[0].heaps.findIndex((n) => n >= NET.takeMax * 4), want = NET.takeMax * 4;
    for (let j = 0; j < 4; j++) fast.send({ t: 'take', h: h2, n: NET.takeMax }); await sleep(400);
    const noN = fast.msgs.filter((m) => m.t === 'h' && m.no).reduce((a, m) => a + (m.no | 0), 0);
    ok(noN >= want - NET.takePerSec - 1, `빠른 줍기(초당 ${NET.takePerSec}개 넘게) 되돌림 (${want}개 중 ${noN}개)`);
    fast.send({ t: 'take', h: h2, n: 9999 }); await sleep(300);
    ok(fast.msgs.filter((m) => m.t === 'h' && m.no).length >= 2, '한 번에 아주 많이 줍기도 한도 안에서만');
    { // #172 동료 줍기(btake): 더미는 줄지만 번 몫엔 안 셈 → 동료가 주운 몫이 내 귤로 잡히지 않음. 방에서도 마지막 BUDDIES.keep 은 남김
      const { createRoomCore } = await import('../server/src/roomcore.js'); const { HEAP_FULL } = await import('../server/src/heaps.js'); const { BUDDIES } = await import('../src/balance.js');
      let T0 = 1e12; const core = createRoomCore({ now: () => T0 }); const bp = core.join(() => {}, { acct: 'buddy-test' });
      const bh = HEAP_FULL.findIndex((n) => n >= 10); for (let j = 0; j < HEAP_FULL[bh] + 3; j++) { T0 += 200; core.message(bp, JSON.stringify({ t: 'btake', h: bh })); }
      ok(core.takeEarned() === null && core.heaps()[bh] === Math.ceil(HEAP_FULL[bh] * BUDDIES.keep), `동료 줍기(btake)는 번 몫에 안 셈·마지막 ${Math.ceil(HEAP_FULL[bh] * BUDDIES.keep)}개 남김 (#172)`);
    }
    // 폭주
    const F = await sock('dev', 'oreum-namsongi-battle', { ch: 6 });
    for (let j = 0; j < 300; j++) F.send({ t: 'ping', c: j });
    await sleep(500);
    ok(F.msgs.some((m) => m.t === 'kick' && m.why === 'flood') && F.closed, '메시지 폭주는 끊음');
    for (const s of [Q, W, X, fast]) s.close();

    /* ---------- 어드민 ---------- */
    ok((await req('plain', '/feedback')).status === 403, '손님은 받은 의견 못 봄');
    const U = await login('plain', 'user1'); const Bs = await login('plain', 'boss');
    ok(!U.admin && (await req('plain', '/me', { token: U.token })).j.admin === false && (await req('plain', '/feedback', { token: U.token })).status === 403, '다른 계정은 어드민 아님');
    ok(Bs.admin && (await req('plain', '/me', { token: Bs.token })).j.admin === true && (await req('plain', '/feedback', { token: Bs.token })).status === 200, 'ADMIN_SUBS 계정만 어드민');
    const ug = await req('plain', '/save', { method: 'PUT', token: U.token, body: { save: { ...S0, coins: NET.earnBurst * 3 } } });
    const bg = await req('plain', '/save', { method: 'PUT', token: Bs.token, body: { save: { ...S0, coins: NET.earnBurst * 3 } } });
    ok(ug.j.fixed.includes('coins') && !bg.j.fixed.length, '귤 채우기는 어드민 계정만 서버가 받아 줌');

    /* ---------- 의견 도배·요청 수 ---------- */
    { // 오류 알림 묶어 보기 (#122): 로그인·Origin 없이 읽지만 의견 글·닉네임·좌표·IP 는 새지 않음
      const SECRET = '비밀의견글-' + Date.now();
      await req('dev', '/feedback', { method: 'POST', body: { items: [
        { kind: 'crash', text: "[오류 frame] TypeError: x is null @ main-0123abcd45.js:1:2345 · 마지막: 3s 시작 · Android 14 Chrome 120", ver: '9.9.9', dev: 'phone', nick: '닉네임새면안됨', x: 123, z: 456 },
        { text: SECRET, ver: '9.9.9', dev: 'phone', nick: '닉네임새면안됨', x: 1, z: 2 },
      ] } });
      const cr = await req('dev', '/crashes?days=3', { origin: null });
      const raw = JSON.stringify(cr.j || {});
      const g = cr.j?.groups?.find((o) => o.ver === '9.9.9');
      ok(cr.status === 200 && g && g.n === 1 && g.dev.phone === 1 && g.ua[0] === 'Android 14 Chrome 120', `/crashes 는 Origin·로그인 없이 묶음을 줌 (${cr.status})`);
      ok(!raw.includes(SECRET) && !raw.includes('닉네임새면안됨') && !/"(nick|x|z|ip|srv|map|w|h)"/.test(raw), '/crashes 로 의견 글·닉네임·좌표·IP 가 새지 않음');
    }
    let fbNo = 0; for (let j = 0; j < 4; j++) { const r = await req('dev', '/feedback', { method: 'POST', body: { items: Array.from({ length: 10 }, (_, i) => ({ text: '<b>도배</b> ' + j + i })) } }); if (r.status === 429) fbNo++; }
    ok(fbNo >= 1, `의견 도배 막음 (429 ${fbNo}번)`);
    const list = (await req('dev', '/feedback')).j;
    ok(Array.isArray(list) && list.every((it) => !/[<>]/.test(it.text)) && list.every((it) => !('ip' in it)), '의견 글 다듬음·주소 원문 없음');
    let lim = 0; for (let j = 0; j < 140; j++) { const r = await fetch(url('prod', '/me'), { headers: { Origin: GAME } }); if (r.status === 429) lim++; }
    ok(lim > 0, `주소별 요청 수 제한 (140번 중 429 ${lim}번)`);
    let lw = 0; for (let j = 0; j < 40; j++) { const s = await sock('prod', 'oreum-namsongi-battle', { origin: GAME, ch: 7 }); if (!s.msgs.some((m) => m.t === 'hi')) lw++; s.close(); }
    ok(lw > 0, `방 연결 폭주 제한 (40번 중 거절 ${lw}번)`);

    /* ---------- 빌드 결과 ---------- */
    const html = fs.existsSync('dist/index.html') ? fs.readFileSync('dist/index.html', 'utf8') : '';
    ok(/http-equiv="Content-Security-Policy"[^>]*script-src 'self' /.test(html) && !/<script>/.test(html) && /object-src 'none'/.test(html), '페이지 CSP (같은 곳 스크립트만, 인라인 없음 #85)');
    { // 인라인 스크립트 (#97·#118): 원스토어 SDK 로더 한 줄과 인앱 브라우저 안내(src/inapp.js) 둘뿐이고, 둘 다 CSP 해시가 있어야 함
      const inl = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
      const hashOk = inl.every((c) => html.includes(`'sha256-${crypto.createHash('sha256').update(c, 'utf8').digest('base64')}'`));
      const inapp = fs.readFileSync(path.join(__dirname, '..', 'src', 'inapp.js'), 'utf8').trim();
      const sdk = inl.filter((c) => /^import\{createSDK\}from"https:\/\/h5sdk\.onestore\.net\//.test(c)).length, app = inl.filter((c) => c === inapp).length;
      ok(inl.length === 2 && sdk === 1 && app === 1 && hashOk, `인라인 스크립트는 원스토어 SDK 로더·인앱 안내 둘뿐, 둘 다 CSP 해시로만 허용 (#97·#118) (${inl.length}개, 해시 ${hashOk})`);
    }
    ok(!/ghp_[A-Za-z0-9]{20}|github_pat_|sk-[A-Za-z0-9]{20}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE|@gmail\.com|SESSION_SECRET\s*[:=]\s*['"]/.test(html), '빌드 결과에 비밀 값 없음');
  } finally {
    if (!KEEP) for (const p of procs) { try { process.kill(-p.pid); } catch (e) { /* 이미 끝남 */ } }
  }
  console.log(`\n${rows.filter((r) => r[0]).length}/${rows.length} 통과`);
  process.exit(process.exitCode || 0);
})().catch((e) => { console.error(e); process.exit(1); });
