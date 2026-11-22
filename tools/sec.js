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
// 귤 보내기 목록 (#215): plain 서버는 server/grants.json 대신 이 목록 (GRANTS_TEST, FAKE_AUTH 일 때만 읽음)
const FG = [
  { id: 'fg-1', to: { nick: '외동이' }, n: 10000, why: '선물' }, { id: 'fg-1', to: { nick: '외동이' }, n: 99999, why: '같은 id 두 번' },
  { id: 'fg-sub', to: { sub: 'fake-fgsub' }, n: 30, why: 'x' }, { id: 'fg-max', to: { nick: '외동이' }, n: 100001, why: 'x' },
  { id: 'fg-zero', to: { nick: '외동이' }, n: 0, why: 'x' }, { id: 'fg-neg', to: { nick: '외동이' }, n: -5, why: 'x' },
  { id: 'fg-guest', to: { nick: '손님뿐' }, n: 40, why: 'x' },
  ...[1, 2, 3, 4, 5].map((i) => ({ id: 'fg-day' + i, to: { nick: '외동이' }, n: 100000, why: 'x' })),
];
const CFG = {
  dev: { port: 8797, vars: ['FAKE_AUTH:1', 'STATS_OPEN:1', 'GIFT_NEW_SEC:0'] }, // GIFT_NEW_SEC: 귤 주기(#175) 새 계정 기다림을 끔 (plain 은 기본값으로 막히는지 봄)
  plain: { port: 8798, vars: ['FAKE_AUTH:1', 'ADMIN_SUBS:fake-boss', 'GRANTS_TEST:' + Buffer.from(JSON.stringify(FG)).toString('base64')] },
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
    const S0 = { coins: 5, equip: { tool: 1, bag: 0, shoes: 1, weapon: 1 }, clothes: { own: {}, wear: {} }, rides: { own: [], cur: null }, hairs: {}, trash: { total: 0 }, nick: '검사 러너' };
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
    // #140 전리품: 강화 +6·없는 등급·재료 음수·없는 재료·없는 칸은 바로잡음
    const lt = await req('dev', '/save', { method: 'PUT', token: A.token, body: { save: { ...S0, coins: me3.save.coins, gearUp: { tool: { g: 7, e: 6 }, crown: { g: 1, e: 1 } }, mats: { m1: -5, m2: 3, gold: 9 }, loot: [{ s: 'tool', t: 9, g: 1, e: 0 }, { s: 'hat', t: 2, g: 4, e: 0 }, { s: 'bag', t: 2, g: 1, e: 2 }], clothes: { own: {}, wear: {}, up: { 'hat:w-cap': { g: 2, e: 9 }, nope: { g: 1 } } } } } });
    const me4 = (await req('dev', '/me', { token: A.token })).j.save;
    ok(lt.status === 200 && ['gearUp', 'mats', 'loot', 'clothesUp'].every((k) => lt.j.fixed.includes(k)) && me4.gearUp.tool.e === 5 && me4.gearUp.tool.g === 3 && !me4.gearUp.crown && !('m1' in me4.mats) && !me4.mats.gold && me4.mats.m2 === 3 && me4.loot.length === 1 && me4.clothes.up['hat:w-cap'].e === 5 && !me4.clothes.up.nope, `전리품 값 바로잡음 (${lt.j.fixed.join(',')})`);
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
    /* ---------- 철 이벤트 (#180): 달력 날짜 속이기·트리 합계 부풀리기 ---------- */
    {
      const { xmasDay, calReward, treeGoal } = await import('../src/seasoncal.js');
      const { checkSave } = await import('../server/src/validate.js');
      const xd = xmasDay();
      const ss = (await req('dev', '/season')).j;
      ok(ss && Number.isFinite(ss.now) && ss.day === xd && ss.total >= 0, `/season 서버 날짜·트리 합계 (12월 ${ss?.day}일, 합계 ${ss?.total})`);
      // 실서버 날짜: 기간 밖이면 어떤 칸도, 기간 안이면 내일 칸은 거절
      const C = await login('dev', 'carol'); const base = { ...S0, coins: 0 };
      await req('dev', '/save', { method: 'PUT', token: C.token, body: { save: base } });
      const future = xd ? Math.min(25, xd + 1) : 10;
      const cal = await req('dev', '/save', { method: 'PUT', token: C.token, body: { save: { ...base, season: { xmas: { days: [future], gift: ['hat:x-santa'], tree: 1 } } } } });
      const me = (await req('dev', '/me', { token: C.token })).j.save;
      ok(cal.j.fixed.includes('season') && !(me.season?.xmas?.days || []).includes(future) && !me.season?.xmas?.tree && 'season' in (cal.j.fix || {}), `달력 앞날·기간 밖 칸·트리 선물 거절 (${xd ? '기간 안' : '기간 밖'}, 칸 ${future})`);
      ok(!(me.season?.xmas?.gift || []).length || xd > 0, '기간 밖 선물 옷 거절');
      // 트리 부풀리기: 줍기는 줍기 몫(pickCredit) 안에서만 더해지고, 꾸민 합계는 받지 않음
      const big = await req('dev', '/save', { method: 'PUT', token: C.token, body: { save: { ...base, trash: { total: treeGoal() * 5 } } } });
      const ss2 = (await req('dev', '/season')).j;
      ok(big.j.fixed.includes('picked') && ss2.total < treeGoal(), `트리 합계 부풀리기 막힘 (합계 ${ss2.total} < ${treeGoal()})`);
      // 기간 안 판정 (순수 함수, 날짜를 넣어 봄): 오늘 무료·지난 날 귤 50·앞날 거절·지웠다 다시 열어도 귤 두 번 안 받음
      const P = { ...S0, coins: 0, season: { xmas: { days: [] } } }, acc = { credit: 0, pickCredit: 0, bank: 0, savedAt: Date.now() };
      const day10 = calReward(10), t = Date.now();
      let r = checkSave(P, { ...P, coins: 0 + (calReward(12).coins || 0), season: { xmas: { days: [12] } } }, acc, t, { xday: 12 });
      ok(!r.fixed.length && r.save.season.xmas.days.includes(12) && r.save.coins === (calReward(12).coins || 0), `기간 안 오늘(12일) 칸 받아 줌 (귤 +${calReward(12).coins || 0})`);
      r = checkSave(P, { ...P, season: { xmas: { days: [13] } } }, acc, t, { xday: 12 });
      ok(r.fixed.includes('season') && !r.save.season.xmas.days.includes(13), '기간 안 내일(13일) 칸 거절');
      r = checkSave({ ...P, coins: 100 }, { ...P, coins: 100 - 50 + (day10.coins || 0), season: { xmas: { days: [10] } }, clothes: day10.cloth ? { own: { [day10.cloth]: 1 }, wear: {} } : P.clothes }, acc, t, { xday: 12 });
      ok(!r.fixed.length && r.save.season.xmas.days.includes(10) && (!day10.cloth || r.save.clothes.own[day10.cloth]), `지난 날(10일) 귤 50 으로 열기·달력 옷은 값 안 셈 (${day10.cloth || day10.coins})`);
      r = checkSave({ ...P, coins: 10 }, { ...P, coins: 10, season: { xmas: { days: [5] } }, clothes: { own: { 'hat:x-santa': 1 }, wear: {} } }, acc, t, { xday: 12 });
      ok(r.fixed.includes('season') && !r.save.season.xmas.days.includes(5) && !r.save.clothes.own['hat:x-santa'], '귤이 모자라면 지난 날 칸(옷) 거절');
      const P2 = { ...P, coins: 40, season: { xmas: { days: [12] } } };
      r = checkSave(P2, { ...P2, coins: 40 + 99, season: undefined }, acc, t, { xday: 12 });
      ok(r.save.season?.xmas?.days.includes(12) && r.fixed.includes('coins'), '달력 기록을 빼고 보내도 지우지 않고 귤도 안 늘어남');
      r = checkSave(P, { ...P, coins: 300, season: { xmas: { days: [], tree: 1 } } }, acc, t, { xday: 12, treeDone: false });
      ok(r.fixed.includes('season') && !r.save.season.xmas.tree && r.save.coins === 0, '트리가 안 찼는데 트리 선물 거절');
      r = checkSave(P, { ...P, coins: 300, season: { xmas: { days: [], tree: 1 } } }, acc, t, { xday: 12, treeDone: true });
      ok(!r.fixed.length && r.save.season.xmas.tree === 1 && r.save.coins === 300, '트리가 찼으면 선물 귤 300 받아 줌');
      r = checkSave(P, { ...P, season: { xmas: { days: [], gift: ['hat:x-santa', 'vest:x-scarf', 'top:x-ugly'] } }, clothes: { own: { 'hat:x-santa': 1, 'vest:x-scarf': 1, 'top:x-ugly': 1 }, wear: {} } }, acc, t, { xday: 12 });
      ok(Object.keys(r.save.clothes.own).length <= 2, `선물 옷은 ${2}벌까지만 값 없이 (${Object.keys(r.save.clothes.own).join(',')})`);
    }
    /* ---------- 주간 옷장 (#126): 이번 주 한정 옷만 살 수 있고 값을 셈, 지난주·다음 주 옷은 되돌림 ---------- */
    {
      const { checkSave } = await import('../server/src/validate.js');
      const { weeklyNow } = await import('../src/weekly.js');
      const { WEEKLY_CLOTHES, wearPrice } = await import('../src/balance.js');
      const t = Date.now(), acc = { credit: 0, pickCredit: 0, bank: 0, savedAt: t }, now = weeklyNow(t)[0], off = WEEKLY_CLOTHES.find((c) => !weeklyNow(t).includes(c) && !weeklyNow(t - 864e5).includes(c) && !weeklyNow(t + 864e5).includes(c)), pr = wearPrice(now);
      const P = { ...S0, coins: pr + 10 };
      let r = checkSave(P, { ...P, coins: 10, clothes: { own: { [now.id]: 1 }, wear: { [now.slot]: now.id } } }, acc, t);
      ok(!r.fixed.length && r.save.clothes.own[now.id] && r.save.coins === 10, `이번 주 한정 옷 사기 받아 줌 (${now.name} 귤 ${pr})`);
      r = checkSave(P, { ...P, clothes: { own: { [now.id]: 1 }, wear: {} } }, acc, t);
      ok(r.fixed.includes('coins') && r.save.coins === 10, '한정 옷 값을 안 내면 귤을 바로잡음');
      r = checkSave(P, { ...P, clothes: { own: { [off.id]: 1 }, wear: { [off.slot]: off.id } } }, acc, t);
      ok(r.fixed.includes('items') && !r.save.clothes.own[off.id] && !r.save.clothes.wear[off.slot], `이번 주가 아닌 한정 옷은 되돌림 (${off.name})`);
      const P2 = { ...P, clothes: { own: { [off.id]: 1 }, wear: { [off.slot]: off.id } } };
      r = checkSave(P2, { ...P2 }, acc, t);
      ok(!r.fixed.length && r.save.clothes.own[off.id], '지난주에 산 한정 옷은 계속 가짐');
    }
    /* ---------- 서버가 아는 귤 (#188): 판 전리품·퀘스트 보상은 몫으로 인정, 꾸민 것은 거절 ---------- */
    {
      const { checkSave } = await import('../server/src/validate.js');
      const { sellValue } = await import('../src/loot.js');
      const { QUESTS } = await import('../src/balance.js');
      const t = Date.now(), acc = { credit: 0, pickCredit: 0, bank: 0, savedAt: t };
      const P = { ...S0, coins: 100, equip: { tool: 5, bag: 5, shoes: 5, weapon: 5 } };
      const leg = { s: 'weapon', t: 5, g: 3, e: 2 }, lv = sellValue(leg);
      let r = checkSave({ ...P, loot: [leg] }, { ...P, coins: 100 + lv, loot: [], sold: [leg] }, acc, t);
      ok(!r.fixed.length && r.save.coins === 100 + lv && !('sold' in r.save), `가진 전설 장비를 팔면 안 깎임 (귤 +${lv}, 몫 0 에서)`);
      r = checkSave({ ...P, loot: [] }, { ...P, coins: 100 + lv, loot: [], sold: [leg] }, acc, t);
      ok(r.fixed.includes('coins') && r.save.coins === 100 && r.clamp?.amt === lv, '없는 장비(강화된 것)를 팔았다고 하면 거절·깎인 양 기록');
      const fresh = { s: 'weapon', t: 5, g: 3, e: 0 }, fv = sellValue(fresh);
      r = checkSave(P, { ...P, coins: 100 + fv * 5, sold: Array(5).fill(fresh) }, acc, t);
      ok(r.fixed.includes('coins') && r.save.coins === 100 + fv * NET.earnRec.legendBurst, `새로 떨어진 전설은 ${NET.earnRec.legendBurst}개까지만 (5개 중)`);
      const q = [...QUESTS.main, ...(QUESTS.side || [])].filter((x) => x.reward?.gyul).sort((a, b) => b.reward.gyul - a.reward.gyul)[0], qg = q.reward.gyul;
      r = checkSave(P, { ...P, coins: 100 + qg, quest: { done: [q.id] } }, acc, t);
      ok(!r.fixed.length && r.save.coins === 100 + qg, `퀘스트 보상(${q.id} ${qg})은 몫으로 인정`);
      let r2 = checkSave(P, { ...P, coins: 100 + qg, quest: { done: [q.id] } }, { ...r.acc, credit: 0, bank: 0, savedAt: t }, t + 1000);
      ok(r2.fixed.includes('coins') && r2.save.coins <= 100 + NET.earnPerSec * 1, '같은 퀘스트 보상 두 번 받기 거절 (처음부터 다시 해도)');
      r = checkSave(P, { ...P, coins: 100, boss: { done: { 5: 1 } } }, acc, t);
      const r3 = checkSave(r.save, { ...r.save, coins: 100 + 2500 }, { ...r.acc, credit: 0, savedAt: t }, t + 5000);
      ok(!r3.fixed.length, '우두머리 귤은 기록 뒤 저장에서 주워도 받아 줌 (bank)');
      r = checkSave(r3.save, { ...r3.save, coins: 100 + 5000, boss: { done: { 5: 2 } } }, { ...r3.acc, credit: 0, savedAt: t }, t + 6000);
      ok(r.fixed.includes('coins'), `같은 우두머리는 ${NET.earnRec.bossGap}초에 한 번만 인정`);
      // 귀한 귤 (#130): 기록 없는 적 귤이라 credit(earnBurst) 에서. 외계인 한 마리 + 가장 큰 황금향이 한 번에 들어와도 받아 주고, 몫이 빈 채 또 받으면 거절
      const { rareMax } = await import('../src/raregyul.js'); const { ENEMIES, ENEMY_DROP } = await import('../src/balance.js');
      const rg = ENEMIES.alien.reward.gyul + rareMax('alien', ENEMIES.alien.reward.gyul, ENEMY_DROP.max);
      r = checkSave(P, { ...P, coins: 100 + rg }, { ...acc, credit: NET.earnBurst }, t);
      ok(rg <= NET.earnBurst && !r.fixed.length && r.save.coins === 100 + rg, `외계인 + 황금향 한 번(귤 +${rg})은 받아 줌 (earnBurst ${NET.earnBurst} 안)`);
      r2 = checkSave(r.save, { ...r.save, coins: r.save.coins + rg }, { ...r.acc, credit: 0, bank: 0, savedAt: t }, t + 1000);
      ok(r2.fixed.includes('coins') && r2.save.coins <= r.save.coins + NET.earnPerSec * 1, '귀한 귤 몫을 곧바로 또 받으면 거절');
      { // 동굴 (#195): 들고 나온 동굴 쓰레기 귤(save.cave.out 누적)은 통(caveBurst) 안에서 인정. 통이 빈 채 또는 누적을 줄였다 올려 두 번 받기는 거절
        const { CAVE } = await import('../src/balance.js'), E = NET.earnRec, run = 540 * CAVE.junk.perVol; // 가장 큰 배낭 한 판
        let c1 = checkSave(P, { ...P, coins: 100, cave: { out: run } }, acc, t);
        const c2 = checkSave(c1.save, { ...c1.save, coins: 100 + run }, { ...c1.acc, credit: 0, savedAt: t }, t + 5000);
        ok(c1.rec.why.cave >= run && !c2.fixed.length && c2.save.coins === 100 + run, `동굴에서 들고 나온 한 판(귤 ${run})은 버린 뒤 저장에서 받아 줌`);
        const c3 = checkSave(c2.save, { ...c2.save, coins: 100 + run * 3, cave: { out: run * 3 } }, { ...c2.acc, credit: 0, savedAt: t + 5000 }, t + 6000);
        ok(c3.fixed.includes('coins') && c3.save.coins < 100 + run * 2 + E.cavePerSec * 2, `통이 빈 채 동굴 귤 부풀리기 거절 (${c3.save.coins})`);
        const c4 = checkSave(c2.save, { ...c2.save, cave: { out: 0 } }, { ...c2.acc, credit: 0, savedAt: t + 5000 }, t + 6000);
        ok(c4.save.cave.out === run, '동굴 누적을 줄이면 서버가 되돌림 (줄였다 올려 두 번 받기 막음)');
        c1 = checkSave(P, { ...P, coins: 100 + 999999, cave: { out: 999999 } }, acc, t);
        ok(c1.fixed.includes('coins') && c1.save.coins <= 100 + E.caveBurst + 1, `동굴 귤 한 번에 크게 부풀리기 거절 (${c1.save.coins}, 통 ${E.caveBurst})`);
        // 3번 조각: 하루 몫(caveDayFull)을 넘은 판은 절반 · 상자·주인은 하루 한 번
        const DL = await import('../src/daily.js'), dayN = DL.kstDayN(t), date = DL.kstDate(t);
        const used = { ...acc, cred: { cd: { d: dayN, g: E.caveDayFull } } }; /* 오늘 온전한 몫을 다 씀 */
        c1 = checkSave(P, { ...P, coins: 100 + run, cave: { out: run, runs: { d: date, n: 0 } } }, used, t);
        ok(Math.abs(c1.rec.why.cave - run * E.caveK * CAVE.runs.halfK) < 2 && c1.fixed.includes('coins'), `하루 몫을 넘긴 판은 판 수를 0 으로 속여도 절반만 인정 (${c1.rec.why.cave})`);
        c1 = checkSave(P, { ...P, coins: 100, cave: { out: 0, chest: { d: date, got: ['c0', 'c1', 'c7', 'x'] }, boss: date } }, acc, t);
        ok(c1.rec.why.cave === CAVE.chest.gyul[0] + CAVE.chest.gyul[1] + CAVE.owner.gyul, `동굴 상자 둘·주인 큰 보상은 인정, 없는 층 상자는 거절 (${c1.rec.why.cave})`);
        let c5 = checkSave(c1.save, { ...c1.save, cave: { out: 0, chest: { d: date, got: [] }, boss: '' } }, { ...c1.acc, savedAt: t + 1000 }, t + 2000);
        c5 = checkSave(c5.save, { ...c5.save, coins: 100 + CAVE.owner.gyul, cave: { out: 0, chest: { d: date, got: ['c0'] }, boss: date } }, { ...c5.acc, credit: 0, bank: 0, savedAt: t + 2000 }, t + 3000);
        ok(c5.rec.why.cave === 0 && c5.fixed.includes('coins'), '같은 날 상자·주인을 지웠다 다시 받기 거절');
        c1 = checkSave(P, { ...P, coins: 100, cave: { out: 0, boss: DL.dateOfDay(dayN - 5) } }, acc, t);
        ok(c1.rec.why.cave === 0, '지난 날짜 주인 보상은 거절');
      }
      { // 들판 떼 한 판 (#202): 버틴 덤은 save.swarm.won 으로 인정, 쉬는 시간 안 두 번째는 거절, bonusMax 까지
        const { SWARM: SW } = await import('../src/balance.js'), R = SW.run, mx = R.bonusMax[2];
        const P0 = { ...P, swarm: { earn: 0, won: {} } };
        let w = checkSave(P0, { ...P0, coins: 100 + 40, swarm: { earn: 0, won: { 2: { at: t, b: 40 } } } }, acc, t);
        ok(!w.fixed.length && w.save.coins === 140 && w.rec?.why?.swarm === 40, `떼 한 판 버틴 덤(구역 2, 40)은 몫으로 인정`);
        let w2 = checkSave(w.save, { ...w.save, coins: 140 + 40, swarm: { earn: 0, won: { 2: { at: t + 60000, b: 40 } } } }, { ...w.acc, credit: 0, bank: 0, savedAt: t + 60000 }, t + 60000);
        ok(w2.fixed.includes('coins') && w2.save.coins === 140, `쉬는 시간(${R.rest}초) 안에 같은 구역 덤 두 번 받기 거절`);
        w2 = checkSave(w.save, { ...w.save, coins: 140 + mx + 500, swarm: { earn: 0, won: { 2: { at: t + R.rest * 1000, b: mx + 500 } } } }, { ...w.acc, credit: 0, bank: 0, savedAt: t + R.rest * 1000 - 10 }, t + R.rest * 1000);
        ok(w2.fixed.includes('coins') && w2.save.coins === 140 + mx, `쉬는 시간 뒤 덤은 다시 인정·구역 상한 ${mx} 까지`);
        // 레벨 (#202): 경험치(번 귤)는 받아 준 귤 가운데 판 귤을 뺀 만큼만
        const { xpAt: XA } = await import('../src/augments.js'), x0 = XA(6), L0 = { xp: x0, aug: {}, draw: null, rr: 0, v: 2 };
        const PL = { ...P, lv: L0 };
        let l = checkSave(PL, { ...PL, coins: 100 + qg, quest: { done: [q.id] }, lv: { ...L0, xp: x0 + qg } }, acc, t);
        ok(!l.fixed.length && l.save.lv.xp === x0 + qg, `번 귤(퀘스트 ${qg})만큼 경험치는 그대로`);
        l = checkSave(PL, { ...PL, coins: 100, lv: { ...L0, xp: x0 + 5000 } }, acc, t);
        ok(l.fixed.includes('lvxp') && l.save.lv.xp === x0 && l.lvCut === 5000, '귤이 안 늘었는데 경험치만 늘면 깎음 (깎은 양을 알려 줌)');
        l = checkSave({ ...PL, loot: [leg] }, { ...PL, coins: 100 + lv, loot: [], sold: [leg], lv: { ...L0, xp: x0 + lv } }, acc, t);
        ok(l.fixed.includes('lvxp') && l.save.lv.xp === x0 && l.save.coins === 100 + lv, `장비 판 귤(${lv})은 경험치로 안 셈 (귤은 받아 줌)`);
        l = checkSave({ ...P, lv: { xp: 5000, aug: { recycle: 3, twin: 3 }, old: 1 } }, { ...P, coins: 100, lv: { xp: 5000, aug: { recycle: 3, twin: 3 }, old: 1 } }, acc, t);
        ok(l.save.lv.v === 2 && l.save.lv.aug.recycle === 3 && l.save.lv.aug.twin === 3 && !l.fixed.includes('lvxp'), `옛 경험치 저장은 서버도 번 귤 경험치로 바꾸고(레벨이 내려가지 않음) 한 번은 몫을 안 봄 (xp ${l.save.lv.xp})`);
      }
      { // 오늘의 할 일 (#125)
        // 오늘의 할 일 (#125): 오늘 목록의 받은 할 일·셋 다는 몫으로 인정, 두 번·다른 날·없는 할 일은 거절, 이어 오기는 서버가 센 날까지만
        const DL = await import('../src/daily.js'), day = DL.kstDayN(t), date = DL.kstDate(t), ids = DL.todaysTasks(date).map((x) => x.id);
        const PZ = { ...P, journey: { maxZ: 3 } }, dg = DL.taskGyul(3) * 3 + DL.allGyul(3);
        const dsave = (c, dd = date, list = ids, all = 1) => ({ ...PZ, coins: c, ach: { daily: { date: dd, items: list.map((id) => ({ id, prog: 1, done: true, claimed: true })), all } } });
        r = checkSave(PZ, dsave(100 + dg), acc, t);
        ok(!r.fixed.length && r.save.coins === 100 + dg && r.rec.why.daily === dg, `오늘의 할 일 셋 + 셋 다 보상(${dg})은 몫으로 인정`);
        const r4 = checkSave(r.save, dsave(100 + dg * 2), { ...r.acc, credit: 0, bank: 0, savedAt: t }, t + 1000);
        ok(r4.fixed.includes('coins') && r4.save.coins <= 100 + dg + NET.earnPerSec, '같은 날 할 일 보상 두 번 받기 거절');
        r = checkSave(PZ, dsave(100 + dg, DL.dateOfDay(day - 3)), acc, t);
        ok(r.fixed.includes('coins') && r.save.coins === 100, '사흘 전 할 일을 받았다고 하면 거절');
        r = checkSave(PZ, dsave(100 + DL.taskGyul(3) * 3, date, ['t-nope', 't-x', 't-y'], 0), acc, t);
        ok(r.fixed.includes('coins') && r.save.coins === 100, '오늘 목록에 없는 할 일은 거절');
        const rg = DL.runGyul(3, 3);
        let ra = checkSave(PZ, { ...PZ, coins: 100 + rg, ach: { run: { n: 3, last: day, got: [3] } } }, acc, t);
        ok(ra.fixed.includes('coins') && ra.save.coins === 100, '서버가 하루만 본 계정의 이어 오기 3일째 보상은 거절');
        let ac = { ...acc }, sv = PZ; for (let k = 2; k >= 0; k--) { const x = checkSave(sv, { ...sv }, { ...ac, credit: 0, bank: 0, savedAt: t - k * 864e5 }, t - k * 864e5); ac = x.acc; sv = x.save; }
        ra = checkSave(sv, { ...sv, coins: sv.coins + rg, ach: { run: { n: 3, last: day, got: [3] } } }, { ...ac, credit: 0, bank: 0, savedAt: t }, t + 1000);
        ok(!ra.fixed.length && ra.rec.why.run === rg, `사흘 이어서 저장한 계정의 이어 오기 3일째 보상(${rg})은 인정`);
        const rb = checkSave(ra.save, { ...ra.save, coins: ra.save.coins + rg }, { ...ra.acc, credit: 0, bank: 0, savedAt: t + 1000 }, t + 2000);
        ok(rb.fixed.includes('coins'), '이어 오기 보상 두 번 받기 거절');
      }
    }
    /* ---------- 배낭 겉모습 (#164): 값 내고 사기·없는 것 지움 ---------- */
    {
      const { checkSave } = await import('../server/src/validate.js');
      const P = { ...S0, coins: 0 }, acc = { credit: 0, pickCredit: 0, bank: 0, savedAt: Date.now() }, t = Date.now();
      let r = checkSave(P, { ...P, backs: { own: { tewak: 1 }, cur: 'tewak' } }, acc, t);
      ok(r.fixed.includes('items') && !r.save.backs.own.tewak && r.save.backs.cur === null, '귤 없이 테왁 배낭 사기 되돌림');
      r = checkSave({ ...P, coins: 800 }, { ...P, coins: 0, backs: { own: { tewak: 1, rocket: 1 }, cur: 'rocket' } }, acc, t);
      ok(!r.fixed.length && r.save.backs.own.tewak && !r.save.backs.own.rocket && r.save.backs.cur === null, '귤 800 으로 테왁 사기·목록에 없는 겉모습 지움');
      const { WEAR } = await import('../src/balance.js'), bp = WEAR.price[3];
      r = checkSave({ ...P, coins: 0 }, { ...P, coins: 0, clothes: { own: { 'hat:p-box': 1 }, wear: { hat: 'hat:p-box' } } }, acc, t);
      let r2 = checkSave({ ...P, coins: bp }, { ...P, coins: 0, clothes: { own: { 'hat:p-box': 1 }, wear: { hat: 'hat:p-box' } } }, acc, t);
      ok(r.fixed.includes('items') && !r.save.clothes.own['hat:p-box'] && !r2.fixed.length && r2.save.clothes.own['hat:p-box'], `감귤 박스 헬멧은 모자 3단계 값(${bp})으로 삼·귤 없으면 되돌림`);
      // 겉모습 옷 (#179): 값은 price, 색 번호는 색 바꿀 수 있는 가진 옷·범위 안만
      const { CLOTHES: CL2 } = await import('../src/balance.js'), gat = CL2.find((c) => c.id === 'hat:s-gat').price;
      r = checkSave({ ...P, coins: gat - 1 }, { ...P, coins: 0, clothes: { own: { 'hat:s-gat': 1 }, wear: { hat: 'hat:s-gat' } } }, acc, t);
      r2 = checkSave({ ...P, coins: gat }, { ...P, coins: 0, clothes: { own: { 'hat:s-gat': 1 }, wear: { hat: 'hat:s-gat' }, tint: { 'hat:s-gat': 2, 'hat:s-beanie': 99, x: 1 } } }, acc, t);
      ok(r.fixed.includes('items') && !r.save.clothes.own['hat:s-gat'] && !r.save.clothes.wear.hat && !r2.fixed.length && r2.save.clothes.own['hat:s-gat'] && !Object.keys(r2.save.clothes.tint).length, `겉모습 옷은 제 값(${gat})·귤 모자라면 되돌림·이상한 색 번호 지움`);
    }
    // 닉네임·말 넣기
    const bad = '<img src=x onerror=alert(1)>‮관리자\u0000'.repeat(3);
    await req('dev', '/save', { method: 'PUT', token: A.token, body: { save: { ...S0, coins: 0, nick: bad } } });
    const nk2 = (await req('dev', '/me', { token: A.token })).j.save.nick;
    ok(!/[<>‮\u0000]/.test(nk2) && [...nk2].length <= 16, `저장 닉네임 다듬음 (${JSON.stringify(nk2)})`);
    // 기본 옷 색 번호 (#155): 범위 밖·이상한 값은 버림
    await req('dev', '/save', { method: 'PUT', token: A.token, body: { save: { ...S0, coins: 0, look: { sex: 'm', skin: 0, colors: { hat: 99, top: -1, bottom: '3', shoes: 7, x: 5 } } } } });
    const lc = (await req('dev', '/me', { token: A.token })).j.save.look?.colors;
    ok(JSON.stringify(lc) === JSON.stringify({ shoes: 7 }), `범위 밖 옷 색 번호 버림 (${JSON.stringify(lc)})`);
    // 레벨·증강 (#159): 경험치는 최고 레벨까지, 증강은 아는 것만·종류마다 3 이하·합이 (레벨 - 1) 이하
    { const { xpAt, levelOf } = await import('../src/augments.js');
      const lvPut = async (lv) => { const r = await req('dev', '/save', { method: 'PUT', token: A.token, body: { save: { ...S0, coins: 0, lv } } }); return { r, lv: (await req('dev', '/me', { token: A.token })).j.save.lv }; };
      const a = await lvPut({ xp: 1e12, aug: {}, v: 2 }); // 지난 저장에 번 귤 경험치(v 2)가 없으면 이번 한 번은 몫을 안 봄 (#202)
      ok(a.r.j.fixed.includes('lv') && levelOf(a.lv.xp).lv === 30, `범위 밖 경험치는 최고 레벨 30 까지 (${a.lv.xp})`);
      const b2 = await lvPut({ xp: xpAt(3), aug: { recycle: 3, bighand: 3, fly: 9 }, v: 2 }); // 레벨 3 → 증강 2개까지
      const n2 = Object.values(b2.lv.aug).reduce((s, n) => s + n, 0);
      ok(b2.r.j.fixed.includes('lv') && n2 <= 2 && !('fly' in b2.lv.aug), `레벨보다 많은 증강·없는 증강 거절 (레벨 3 → ${JSON.stringify(b2.lv.aug)})`);
      const c2 = await lvPut({ xp: xpAt(20), aug: { recycle: 7, twin: -1 }, v: 2 });
      ok(c2.r.j.fixed.includes('lv') && !(c2.lv.aug.recycle > 3) && !('twin' in c2.lv.aug), `증강은 종류마다 3 이하 (${JSON.stringify(c2.lv.aug)})`);
      ok(c2.r.j.fixed.includes('lvxp') && c2.lv.xp === xpAt(3) && c2.r.j.fix?.lv?.cut === xpAt(20) - xpAt(3), `귤을 안 벌었는데 레벨 20 경험치는 깎음 (#202, fix.lv.cut ${c2.r.j.fix?.lv?.cut})`);
      const d2 = await lvPut({ xp: xpAt(3), aug: { recycle: 1, twin: 1 }, v: 2 });
      ok(!d2.r.j.fixed.includes('lv') && !d2.r.j.fixed.includes('lvxp') && d2.lv.aug.recycle === 1 && d2.lv.aug.twin === 1, '맞는 레벨·증강은 그대로'); }

    /* ---------- 방 (이동·줍기·폭주·맞힘) ---------- */
    const P = await sock('dev', 'oreum-namsongi-battle', { ch: 3, token: A.token });
    const Q = await sock('dev', 'oreum-namsongi', { ch: 3 }); // 예전 깨끗한 오름 방 이름 → battle 방으로 (#98): P 와 같은 방이어야 함
    ok(P.msgs[0]?.t === 'hi' && P.proto === 'oreum', `하위 프로토콜로 토큰 보내고 연결 (${P.proto})`);
    P.send(presence(-860, 0, { nick: bad, say: { t: '<script>alert(1)</script>' + 'ㅋ'.repeat(200), at: Date.now() } }));
    Q.send(presence(-860, 5));
    await sleep(400);
    const seen = Q.msgs.filter((m) => m.t === 'u').flatMap((m) => m.p).find(([id]) => id === P.msgs[0].id)?.[1];
    ok(seen && !/[<>‮]/.test(seen.nick) && [...seen.nick].length <= 16 && !/[<>]/.test(seen.say.t) && [...seen.say.t].length <= 60, '다른 사람에게 가는 닉네임·말풍선 다듬음');
    // 이름표 레벨 (#159): 0~30 밖은 0
    P.send(presence(-860.1, 0, { lv: 99 })); await sleep(400);
    const lvSeen = Q.msgs.filter((m) => m.t === 'u').flatMap((m) => m.p).filter(([id]) => id === P.msgs[0].id).pop()?.[1];
    ok(lvSeen && !lvSeen.lv, `범위 밖 레벨(99)은 이름표에 안 감 (${lvSeen?.lv})`);
    P.send(presence(-860, 0, { nick: '시1발 운영자' })); Q.send(presence(-860, 5)); await sleep(400);
    const seenBad = Q.msgs.filter((m) => m.t === 'u').flatMap((m) => m.p).filter(([id, d]) => id === P.msgs[0].id && 'nick' in d).pop()?.[1];
    ok(seenBad && seenBad.nick === '', `걸리는 이름은 방에서 빈 이름으로 (#162, ${JSON.stringify(seenBad?.nick)})`);
    { // 칭호 (#165): 번호만 오가고 범위 밖·글은 -1 로
      const { TITLES } = await import('../src/punktext.js'), ttOf = async (tt, dx) => { P.send(presence(-860 + dx, 0, { tt })); await sleep(400); return Q.msgs.filter((m) => m.t === 'u').flatMap((m) => m.p).filter(([id]) => id === P.msgs[0].id).pop()?.[1]?.tt; };
      const a = await ttOf(TITLES.length - 1, 0.1), b = await ttOf(TITLES.length + 5, 0.2), c = await ttOf('<b>왕</b>', 0.3);
      ok(a === TITLES.length - 1 && b === -1 && c === -1, `칭호 번호는 범위만 (${a}, ${b}, ${c})`);
    }
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
    { // #181 오름 레이드: 방이 기운·기여·보상을 셈. 피해 부풀리기·없는 더미 줍기·보상 두 번·남의 레이드 몸·바로 열기 거절
      const { createRoomCore } = await import('../server/src/roomcore.js'); const { RAID, NET: N2 } = await import('../src/balance.js');
      let T0 = Date.UTC(2026, 10, 21, 3, 0); const core = createRoomCore({ now: () => T0 }); const ms = { a: [], b: [] };
      const a = core.join((x) => ms.a.push(JSON.parse(x)), { acct: 'raid-a' }), bq = core.join((x) => ms.b.push(JSON.parse(x)), { acct: 'raid-b' });
      core.message(a, JSON.stringify({ t: 'rgo' })); core.step(); ok(core.raid.ph === 0, '레이드 바로 열기는 STATS_OPEN 방·어드민만');
      core.message(bq, JSON.stringify({ t: 'rs', s: [1, 2, 3] })); ok(!ms.a.some((m) => m.t === 'rs'), '방장 아닌 사람의 레이드 몸 알림은 버림');
      T0 += 30 * 60e3; core.step(); ok(core.raid.ph === 2, `정해진 시각(12:30 KST)에 레이드 시작 (단계 ${core.raid.ph})`);
      const h0 = core.raid.hp; core.message(a, JSON.stringify({ t: 'rh', d: 1e9 })); ok(h0 - core.raid.hp <= N2.bossHitMax + 1e-6, `피해 부풀리기는 잘림 (${h0 - core.raid.hp})`);
      const h1 = core.raid.hp; for (let i = 0; i < 10; i++) { T0 += 100; core.message(a, JSON.stringify({ t: 'rh', d: 300 })); } ok(h1 - core.raid.hp <= RAID.dpsBurst + RAID.dps + 1, `한 사람이 1초에 줄 수 있는 피해 상한 (${Math.round(h1 - core.raid.hp)} ≤ ${RAID.dpsBurst + RAID.dps})`);
      core.message(a, JSON.stringify({ t: 'rp', i: 0 })); ok(core.raid.contrib(a.id).p === 0, '싸우는 동안(부서지기 전) 더미 줍기는 안 셈');
      for (let i = 0; i < 400 && core.raid.ph === 2; i++) { T0 += 1000; core.message(a, JSON.stringify({ t: 'rh', d: 300 })); core.message(bq, JSON.stringify({ t: 'rh', d: 300 })); core.step(); }
      core.message(a, JSON.stringify({ t: 'rp', i: 99 })); core.message(a, JSON.stringify({ t: 'rp', i: -1 })); ok(core.raid.contrib(a.id).p === 0, '없는 더미 줍기는 거절');
      for (let i = 0; i < RAID.heaps; i++) for (let k = 0; k < RAID.heapN + 2; k++) { T0 += 260; core.message(k % 2 ? a : bq, JSON.stringify({ t: 'rp', i })); }
      core.step(); const e1 = core.takeEarned() || [];
      ok(core.raid.ph === 4 && e1.length === 2 && e1.every(([, g]) => g === RAID.gyul + RAID.box), `성공 보상은 방이 번 몫에 (${JSON.stringify(e1)})`);
      ok(ms.a.filter((m) => m.t === 'rw').length === 1 && ms.b.filter((m) => m.t === 'rw').length === 1, '보상 알림은 한 번씩');
      for (let i = 0; i < 6; i++) core.message(a, JSON.stringify({ t: 'rp', i: 0 })); core.step(); ok(!core.takeEarned(), '끝난 뒤 줍기로 보상 두 번 받기 거절');
    }
    { // #205 동굴 적 같이 보기: 먼저 들어온 사람이 칸 주인, 칸 주인만 적 상태를 알림·다른 칸엔 안 감·피해는 잘려 칸 주인에게만·칸 주인이 나가면 다음 사람
      const { createRoomCore } = await import('../server/src/roomcore.js'); const { NET: N3, CAVE: CV } = await import('../src/balance.js');
      let T0 = 1e12; const core = createRoomCore({ now: () => T0 }); const ms = { a: [], b: [], c: [] };
      const a = core.join((x) => ms.a.push(JSON.parse(x))), bq = core.join((x) => ms.b.push(JSON.parse(x))), cq = core.join((x) => ms.c.push(JSON.parse(x)));
      const day = '2026-11-21', k1 = '1:' + day, pres = (p, f) => core.message(p, JSON.stringify({ t: 'p', d: { x: 0, z: 0, cv: f, cd: day, cx: CV.x0 + (f - 1) * CV.floorGap, cz: CV.z0 } }));
      pres(a, 1); T0 += 100; pres(bq, 1); T0 += 100; pres(cq, 2); T0 += 100;
      ok(ms.b.some((m) => m.t === 'ch' && m.id === a.id && m.k === k1) && ms.c.some((m) => m.t === 'ch' && m.id === cq.id), '동굴 칸 주인: 먼저 들어온 사람 (칸마다 따로)');
      const row = [1, 0, CV.x0, CV.z0, 0, 1, 30, 30, 0], cs = (p, k) => core.message(p, JSON.stringify({ t: 'cs', k, e: [row] })), n = (k) => ms[k].filter((m) => m.t === 'cs').length;
      cs(bq, k1); ok(n('a') === 0 && n('c') === 0, '칸 주인 아닌 사람의 동굴 적 상태는 버림');
      T0 += 200; cs(a, k1); ok(n('b') === 1 && n('c') === 0, '동굴 적 상태는 같은 칸 사람에게만');
      T0 += 200; cs(a, '2:' + day); ok(n('b') === 1, '지금 칸과 다른 칸 이름의 적 상태는 버림');
      T0 += 200; core.message(bq, JSON.stringify({ t: 'cx', h: [[1, 1e9]] })); const hx = ms.a.filter((m) => m.t === 'cx');
      ok(hx.length === 1 && hx[0].h[0][1] <= N3.bossHitMax && hx[0].from === bq.id && !ms.c.some((m) => m.t === 'cx'), `동굴 적 피해는 칸 주인에게만, 잘려서 (${hx[0]?.h[0][1]})`);
      T0 += 200; core.message(cq, JSON.stringify({ t: 'cx', h: [[1, 5]] })); ok(ms.a.filter((m) => m.t === 'cx').length === 1, '다른 칸 사람의 피해는 안 감');
      core.leave(a); ok(ms.b.some((m) => m.t === 'ch' && m.id === bq.id), '칸 주인이 나가면 다음 사람이 칸 주인');
      { /* #214 넓은 굴(b): cd 끝 'b' 는 넓은 층 자리만 받고, 보통 칸과 따로 */
        const W = CV.view.b, md = [], me = [], dq = core.join((x) => md.push(JSON.parse(x))), eq = core.join((x) => me.push(JSON.parse(x)));
        const at = (p, cd, cx) => core.message(p, JSON.stringify({ t: 'p', d: { x: 0, z: 0, cv: 2, cd, cx, cz: CV.z0 } })), wx = W.x0 + W.floorGap + CV.grid * CV.cell * W.k * 0.45;
        T0 += 200; at(dq, day + 'b', wx); T0 += 200; at(eq, day, wx);
        ok(md.some((m) => m.t === 'ch' && m.id === dq.id && m.k === '2:' + day + 'b'), '넓은 굴(b) 자리는 넓은 굴 칸으로');
        ok(!me.some((m) => m.t === 'ch' && m.k === '2:' + day) && !md.some((m) => m.t === 'ch' && m.id === eq.id), '보통 칸 이름에 넓은 굴 자리는 거절·넓은 굴 칸과 섞이지 않음');
      }
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
    // 지금 접속 (#186): 어드민만, 숫자만
    ok((await req('plain', '/admin/online')).status === 403 && (await req('plain', '/admin/online', { token: U.token })).status === 403, '손님·보통 계정은 지금 접속 못 봄 (403)');
    const onA = await sock('plain', 'oreum-namsongi-battle', { token: U.token, ch: 3 }), onB = await sock('plain', 'oreum-namsongi-battle', { ch: 3 });
    await sleep(400);
    const onl = await req('plain', '/admin/online', { token: Bs.token }), onTxt = JSON.stringify(onl.j || {});
    const r3 = (onl.j?.rooms || []).find((r) => r.map === 'namsongi' && r.ch === 3);
    ok(onl.status === 200 && r3 && r3.n === 2 && r3.login === 1 && onl.j.n >= 2 && onl.j.guest >= 1 && onl.j.peak?.n >= 2, `어드민은 지금 접속을 봄 (3번 방 ${r3?.n}명, 로그인 ${r3?.login})`);
    ok(!/fake-|user1|boss|검사|"x"|"z"|ip|sub|nick|acct/i.test(onTxt), '지금 접속 응답에 이름·계정 번호·IP·좌표가 없음');
    onA.close(); onB.close(); await sleep(400);
    const onl2 = (await req('plain', '/admin/online', { token: Bs.token })).j;
    ok(!(onl2?.rooms || []).some((r) => r.map === 'namsongi' && r.ch === 3) && onl2.peak.n >= 2, '나가면 방에서 빠지고 오늘 최고는 남음');
    const ug = await req('plain', '/save', { method: 'PUT', token: U.token, body: { save: { ...S0, coins: NET.earnBurst * 3 } } });
    const bg = await req('plain', '/save', { method: 'PUT', token: Bs.token, body: { save: { ...S0, coins: NET.earnBurst * 3 } } });
    ok(ug.j.fixed.includes('coins') && !bg.j.fixed.length, '귤 채우기는 어드민 계정만 서버가 받아 줌');
    { // 귤 맞춤 기록·운영자 귤 보내기 (#188): 어드민만
      ok((await req('plain', '/admin/clamps', { token: U.token })).status === 403 && (await req('plain', '/admin/grant', { method: 'POST', token: U.token, body: { sub: U.sub || 'fake-user1', n: 9, why: 'x' } })).status === 403 && (await req('plain', '/admin/clamps')).status === 403, '어드민 아닌 계정·손님은 /admin/clamps·/admin/grant 403');
      const cl = await req('plain', '/admin/clamps', { token: Bs.token });
      const row = (cl.j || []).find((x) => x.sub === 'fake-user1');
      ok(cl.status === 200 && row && row.amt > 0 && row.why.includes('coins'), `깎이면 기록에 남음 (${row ? '-' + row.amt : '없음'})`);
      const cr = (await req('plain', '/crashes?days=1', { origin: null })).j;
      ok((cr?.groups || []).some((g) => g.text.includes('귤 맞춤')) && !JSON.stringify(cr).includes('fake-user1'), '깎임은 오류 모으기(/crashes)에도 한 줄 (계정 번호 없이)');
      ok((await req('plain', '/admin/grant', { method: 'POST', token: Bs.token, body: { sub: 'fake-nobody', n: 9, why: 'x' } })).status === 404, '없는 계정에 귤 보내기 거절');
      const g = await req('plain', '/admin/grant', { method: 'POST', token: Bs.token, body: { sub: 'fake-user1', n: 777, why: '잘못 깎인 귤' } });
      const me = (await req('plain', '/me', { token: U.token })).j, gift = (me.gifts || []).find((x) => x.id === g.j?.id);
      ok(g.status === 200 && gift && gift.n === 777 && gift.why === '잘못 깎인 귤', '받는 사람은 다음 접속 때 보낸 귤·사유를 받음');
      const c0 = me.save.coins;
      const take = await req('plain', '/save', { method: 'PUT', token: U.token, body: { save: { ...me.save, coins: c0 + 777, giftGot: [gift.id] } } });
      const again = await req('plain', '/save', { method: 'PUT', token: U.token, body: { save: { ...me.save, coins: c0 + 777 * 2 + NET.earnBurst, giftGot: [gift.id] } } });
      const gl = (await req('plain', '/admin/grants', { token: Bs.token })).j || [];
      ok(!take.j.fixed.includes('coins') && !(take.j.gifts || []).length && again.j.fixed.includes('coins') && gl.some((x) => x.id === gift.id && x.got), '보낸 귤은 한 번만 받아 주고 받은 기록이 남음');
    }
    await sleep(61000); /* 위 검사들이 쓴 주소별 요청 수(1분 NET.reqPerMin)를 비움 (#215 목록 검사 앞) */
    { // 귤 보내기 목록 (#215, server/grants.json → 위 FG): id 마다 한 번·한 줄/하루 상한·같은 닉네임 둘이면 보류·손님 제외
      const { LEVEL } = await import('../src/balance.js'), { xpAt } = await import('../src/augments.js');
      const mk = async (name, nick, extra = {}) => { const L = await login('plain', name); const r = await req('plain', '/save', { method: 'PUT', token: L.token, body: { save: { ...S0, nick, ...extra } } }); return { ...L, r }; };
      const one = await mk('fgone', '외동이');
      const sb = await mk('fgsub', '번호로');
      const meOne = (await req('plain', '/me', { token: one.token })).j, gOne = (meOne.gifts || []).filter((g) => g.why === '선물' || g.n === 100000);
      const sum = gOne.reduce((a, g) => a + g.n, 0);
      ok(gOne.filter((g) => g.n === 10000).length === 1 && !gOne.some((g) => g.n === 99999), '목록 줄은 id 마다 한 번 (같은 id 두 줄이면 앞 줄만)');
      ok(sum <= NET.grantFileDay && sum === 10000 + 100000 * 4, `목록 전체 하루 상한 (${sum} ≤ ${NET.grantFileDay}, 넘는 줄은 기다림)`);
      const fl = (await req('plain', '/admin/filegrants', { token: Bs.token })).j || [], st = (id) => fl.find((x) => x.id === id) || {};
      ok(((await req('plain', '/me', { token: sb.token })).j.gifts || []).some((g) => g.n === 30) && st('fg-sub').st === 'sent', '계정 번호(sub)로 보낸 줄');
      ok(st('fg-max').st === 'wait' && st('fg-max').note === 'bad:max' && st('fg-zero').note === 'bad:n' && st('fg-neg').note === 'bad:n', '한 줄 상한 넘음·0·음수 거절');
      ok(st('fg-guest').st === 'wait' && st('fg-guest').note === 'none' && st('fg-day5').st === 'wait' && st('fg-day5').note === 'day', '계정 없는 이름(손님)은 기다림, 하루 상한 넘은 줄도 기다림');
      for (let i = 0; i < 3; i++) await req('plain', '/me', { token: one.token });
      const gl2 = (await req('plain', '/admin/grants', { token: Bs.token })).j || [];
      ok(gl2.filter((x) => x.nick === '외동이').length === 5, '여러 번 돌아도 다시 보내지 않음 (보낸 기록 5줄)');
      ok((await req('plain', '/admin/filegrants', { token: U.token })).status === 403 && (await req('plain', '/admin/filegrants')).status === 403, '목록 파일 상태는 어드민만');
      const take2 = await req('plain', '/save', { method: 'PUT', token: one.token, body: { save: { ...meOne.save, coins: meOne.save.coins + sum, giftGot: gOne.map((g) => g.id) } } });
      ok(!take2.j.fixed.includes('coins'), '목록으로 보낸 귤은 서버가 받아 줌 (#188 과 같은 길)');
      /* 같은 닉네임 여럿: 서버에서는 계정이 하나씩 생겨 앞사람이 먼저 받으므로, 같은 셈(filegrants.js)을 node:sqlite 위에서 */
      const { DatabaseSync } = require('node:sqlite'), db = new DatabaseSync(':memory:');
      const sql = { exec: (q, ...a) => { const p = db.prepare(q); const rows = /^\s*(SELECT|PRAGMA)/i.test(q) ? p.all(...a) : (p.run(...a), []); return { toArray: () => rows, one: () => rows[0] }; } };
      sql.exec('CREATE TABLE acc (sub TEXT PRIMARY KEY, nick TEXT, save TEXT)'); sql.exec('CREATE TABLE gift (id INTEGER PRIMARY KEY AUTOINCREMENT, sub TEXT, n INTEGER, why TEXT, by TEXT, got INTEGER DEFAULT 0)');
      const { fgInit, fgRun, fgList } = await import('../server/src/filegrants.js'); fgInit(sql);
      const sv = (lv) => JSON.stringify({ lv: { xp: xpAt(lv), v: LEVEL.v } });
      for (const [sub, nick, save] of [['t1', '쌍둥이', sv(1)], ['t2', '쌍둥이', sv(1)], ['l1', '셋째', sv(7)], ['l2', '셋째', sv(3)], ['h1', '넷째', sv(9)], ['h2', '넷째', sv(3)], ['g1', '손님', null]]) sql.exec('INSERT INTO acc (sub, nick, save) VALUES (?, ?, ?)', sub, nick, save);
      const gr = (sub, n, why, by) => { sql.exec('INSERT INTO gift (sub, n, why, by) VALUES (?, ?, ?, ?)', sub, n, why, by); return { ok: true, id: sql.exec('SELECT MAX(id) AS id FROM gift').one().id }; };
      const L2 = [{ id: 'a', to: { nick: '쌍둥이' }, n: 5 }, { id: 'b', to: { nick: '쌍둥이', lv: 1 }, n: 5 }, { id: 'c', to: { nick: '셋째', lv: 7 }, n: 7 }, { id: 'd', to: { nick: '넷째', lv: 7 }, n: 9 }, { id: 'e', to: { nick: '손님' }, n: 4 }];
      fgRun(sql, L2, gr); fgRun(sql, L2, gr);
      const s2 = (id) => fgList(sql).find((x) => x.id === id) || {}, gifts2 = sql.exec('SELECT sub, n FROM gift').toArray();
      ok(s2('a').st === 'hold' && s2('a').note === 'many' && s2('b').st === 'hold' && !gifts2.some((g) => g.sub[0] === 't'), '같은 닉네임이 둘이면(레벨도 같으면) 보내지 않고 보류');
      ok(s2('c').st === 'sent' && s2('c').sub === 'l1' && s2('d').st === 'sent' && s2('d').sub === 'h1', '같은 닉네임이 여럿이면 lv 가 같은(없으면 그 이상인) 사람 하나에게만');
      ok(s2('e').st === 'wait' && !gifts2.some((g) => g.sub === 'g1') && gifts2.length === 2, '저장 없는 계정은 대상 아님, 두 번 돌아도 2줄');
    }
    await sleep(61000); /* #215 목록 검사가 쓴 요청 수를 비움 (뒤 검사 몫) */

    { // 이용 통계 (#121): 로그인 없이 POST /m (text/plain 묶음), 날짜별 합계만. 보기는 어드민만
      const mpost = (body, origin = LOCAL) => fetch(url('plain', '/m'), { method: 'POST', headers: { 'content-type': 'text/plain', ...(origin ? { Origin: origin } : {}) }, body: typeof body === 'string' ? body : JSON.stringify(body) }).then((r) => r.status);
      const a1 = await mpost({ v: 1, s: 'dev', c: { in: 1, 'tut:3': 1, play: [65.5, 0], peermx: 4, 'zone:2': 1 } });
      const a2 = await mpost({ v: 1, s: 'dev', c: { in: 2, peermx: 2, pick: -5, hack: 99, 'nope:x': 1, 'ref:evil site/<b>': 1, 'em:boar': [1e9, 1] } });
      ok(a1 === 200 && a2 === 200, '이용 통계 묶음을 받음 (로그인 없이, text/plain)');
      ok((await mpost({ v: 1, s: 'prod', c: { in: 1 } })) === 400 && (await mpost({ v: 1, s: 'dev', c: { hack: 1 } })) === 400 && (await mpost('x'.repeat(6000))) === 413 && (await mpost({ v: 1, s: 'dev', c: { in: 1 } }, EVIL)) === 403, '정해지지 않은 출처·키, 너무 큰 묶음, 다른 Origin 은 거절');
      ok((await req('plain', '/admin/metrics', { token: U.token })).status === 403 && (await req('plain', '/admin/metrics')).status === 403, '수치 보기는 어드민만');
      const mr = await req('plain', '/admin/metrics?days=14', { token: Bs.token }), row = (k) => (mr.j?.rows || []).find((x) => x.src === 'dev' && x.k === k);
      ok(mr.status === 200 && row('in')?.sum === 3 && row('in')?.n === 2 && row('play')?.sum === 65.5 && row('peermx')?.sum === 4 && row('tut:3')?.sum === 1, `날짜별로 더함 (들어온 수 ${row('in')?.sum}, 최대 ${row('peermx')?.sum})`);
      ok(!row('pick') && !row('hack') && !row('em:boar') && !row('ref:evil site/<b>') && !(mr.j?.rows || []).some((x) => 'sub' in x || 'ip' in x), '음수·큰 값·모르는 키는 버리고, 계정·IP 칸은 없음');
    }

    /* ---------- 돌탑 소원 글·함께 기도 (#127) ---------- */
    {
      const { WISH } = await import('../src/balance.js');
      const D = 864e5, at = (d) => '&at=' + (Date.now() + d * D); // 로컬(FAKE_AUTH)만 날을 바꿔 봄
      const Ws = []; for (const n of ['wish1', 'wish2', 'wish3', 'wish4']) { const w = await login('plain', n); await req('plain', '/save', { method: 'PUT', token: w.token, body: { save: { ...S0, coins: 0, nick: '소원 ' + n.slice(-1) } } }); Ws.push(w); }
      const [W1, W2, W3, W4] = Ws;
      const put = (W, c, text, d = 0) => req('plain', '/wish?x=1' + (d ? at(d) : ''), { method: 'POST', token: W?.token, body: { c, text } });
      const list = (c, W) => req('plain', '/wish?c=' + c, { token: W?.token });
      const pray = (W, id, d = 0) => req('plain', '/wish/pray?x=1' + (d ? at(d) : ''), { method: 'POST', token: W?.token, body: { id } });
      const rep = (W, id) => req('plain', '/wish/report', { method: 'POST', token: W?.token, body: { id } });
      ok((await put(null, 'ns-head', '손님 소원')).status === 401, '손님은 소원 글을 못 씀 (401)');
      const bads = ['시1발 합격', 'ㅅ ㅂ 진짜', 'f.u.c.k you', '섹 스', 'www.ad.com 오세요', 'abc 닷컴', '연락 010-1234-5678', '메일 me@x.kr', '번호 1234 5678 90', 'http://x.y'];
      let blocked = 0; for (const b of bads) { const r = await put(W4, 'ns-head', b); if (r.status === 409 && ['bad', 'link'].includes(r.j?.error)) blocked++; }
      ok(blocked === bads.length, `금칙어·주소·전화·이메일·긴 숫자 거름 (${blocked}/${bads.length}, 걸린 것은 하루 고치기 수에 안 셈)`);
      const h = await put(W1, 'ns-head', '<img src=x onerror=alert(1)>합격');
      const l0 = (await list('ns-head')).j?.list || [], hw = l0.find((w) => w.text.includes('합격'));
      ok(h.status === 200 && hw && !/[<>]/.test(hw.text) && hw.nick === '소원 1', `HTML 넣기는 꺾쇠를 빼고 글자로만 (${hw?.text})`);
      ok(!/"sub"|fake-|"ip"|"who"/.test(JSON.stringify(l0)), '소원 목록에 계정 번호·주소가 없음');
      await put(W1, 'ns-head', '우리 가족 건강하게'); // 2번째
      const e3 = await put(W1, 'ns-head', '올해는 꼭 합격'), e4 = await put(W1, 'ns-head', '하나 더 고치기'), e5 = await put(W1, 'ns-head', '내일 고치기', 1);
      ok(e3.status === 200 && e4.status === 409 && e4.j?.error === 'day' && e5.status === 200, `돌탑마다 하루 ${WISH.editPerDay}번까지 고치기, 다음 날 다시 (${e3.status}/${e4.status}/${e5.status})`);
      const mine = (await list('ns-head', W1)).j.list.filter((w) => w.mine);
      ok(mine.length === 1 && mine[0].text === '내일 고치기', '한 사람이 돌탑마다 소원 하나 (다시 쓰면 바뀜)');
      // 기도: W3 이 돌탑 6곳에 소원 → W2 가 모두 기도: 귤은 하루 prayPerDay 번까지
      const CIDS = ['trailhead', 'rim', 'east', 'ns-ridge', 'ns-rim', 'gate-cairn'];
      for (const c of CIDS) await put(W3, c, '소원 ' + c);
      const ids = []; for (const c of CIDS) ids.push((await list(c)).j.list.find((w) => w.nick === '소원 3').id);
      const g = []; for (const id of ids) g.push((await pray(W2, id)).j?.gyul || 0);
      ok(g.slice(0, WISH.prayPerDay).every((x) => x === WISH.prayGyul) && g.slice(WISH.prayPerDay).every((x) => x === 0), `기도한 사람 귤은 하루 ${WISH.prayPerDay}번 (${g.join(',')})`);
      const p2 = await pray(W2, ids[0]), pm = await pray(W3, ids[0]), pn = await pray(W2, ids[0], 1);
      ok(p2.status === 409 && p2.j?.error === 'today' && pm.j?.error === 'mine' && pn.status === 200 && pn.j.n === 2, '같은 소원은 하루 한 번, 내 소원은 기도 안 됨, 다음 날 다시');
      const pg = await pray(null, ids[1]);
      ok(pg.status === 200 && pg.j.n === 2 && pg.j.gyul === WISH.prayGyul, '손님도 함께 기도 (기도 수 오름)');
      const lp = (await list('ns-ridge', W2)).j.list.find((w) => w.id === ids[3]);
      ok(lp?.prayed === true && lp.n === 1, '목록에 내가 오늘 기도했는지·기도 수');
      // 내 돌탑 소식: 받은 기도 수와 귤 (한 번만)
      const n1 = (await req('plain', '/wish/news', { token: W3.token })).j, n2 = (await req('plain', '/wish/news', { token: W3.token })).j;
      ok(n1.n === CIDS.length + 2 && n1.gyul === Math.min(n1.n, WISH.gotPerDay) * WISH.gotGyul && n2.n === 0 && n2.gyul === 0, `'○명이 함께 빌어 줬어요' 한 번만 (${n1.n}명 · 귤 ${n1.gyul}, 다시 ${n2.n})`);
      ok((await req('plain', '/wish/news')).status === 401, '손님은 내 소식 없음 (401)');
      // 받은 귤은 서버가 안다 (#188): 계정 번 몫(bank)에 들어가 저장에서 받아 줌. 하루 최대도 earnBurst 한참 아래
      const m1 = (await req('plain', '/me', { token: W3.token })).j.save, sv = await req('plain', '/save', { method: 'PUT', token: W3.token, body: { save: { ...m1, coins: (m1.coins || 0) + n1.gyul } } });
      ok(!sv.j.fixed.includes('coins'), `소원 소식 귤(+${n1.gyul})을 저장이 받아 줌`);
      ok(WISH.prayGyul * WISH.prayPerDay + WISH.gotGyul * WISH.gotPerDay < NET.earnBurst / 10, `하루 소원 귤 최대 ${WISH.prayGyul * WISH.prayPerDay + WISH.gotGyul * WISH.gotPerDay} (earnBurst ${NET.earnBurst} 의 1/10 아래)`);
      // 신고: 서로 다른 reportHide 명이면 숨김 (같은 사람 두 번은 한 번)
      const rid = ids[2];
      await rep(W2, rid); await rep(W2, rid); const r2 = await rep(W1, rid);
      const seen2 = (await list('east')).j.list.some((w) => w.id === rid);
      const rm = await rep(W3, rid), r3 = await rep(W4, rid);
      const seen3 = (await list('east')).j.list.some((w) => w.id === rid), own = (await list('east', W3)).j.list.find((w) => w.id === rid);
      ok(r2.j?.hid === false && seen2 && rm.j?.error === 'mine' && r3.j?.hid === true && !seen3 && own?.hid === true, `서로 다른 ${WISH.reportHide}명이 신고하면 숨김 (2명: 보임, 3명: 숨김, 쓴 사람에겐 '숨겨짐')`);
      ok((await pray(W1, rid)).j?.error === 'gone', '숨긴 소원에는 기도 안 됨');
      // 어드민: 신고된 소원 목록·되살리기·지우기
      ok((await req('plain', '/admin/wishes', { token: U.token })).status === 403 && (await req('plain', '/admin/wishes')).status === 403 && (await req('plain', '/admin/wish', { method: 'POST', token: W3.token, body: { id: rid, act: 'del' } })).status === 403, '신고된 소원은 어드민만 (403)');
      const al = (await req('plain', '/admin/wishes', { token: Bs.token })).j || [], ar = al.find((w) => w.id === rid);
      ok(ar && ar.hid === 1 && ar.rep === 3, `어드민 목록에 숨긴 소원 (신고 ${ar?.rep})`);
      await req('plain', '/admin/wish', { method: 'POST', token: Bs.token, body: { id: rid, act: 'show' } });
      const back = (await list('east')).j.list.some((w) => w.id === rid);
      await req('plain', '/admin/wish', { method: 'POST', token: Bs.token, body: { id: rid, act: 'del' } });
      const gone = !(await list('east', W3)).j.list.some((w) => w.id === rid);
      ok(back && gone, '어드민 되살리기 → 다시 보임, 지우기 → 사라짐');
      ok((await list('../x')).status === 400 && (await put(W2, 'a'.repeat(60), '소원')).status === 409, '이상한 돌탑 이름 거절');
      ok((await put(W3, 'ns-ridge', 'ㄱ'.repeat(3) + '가'.repeat(40))).status === 200 && [...(await list('ns-ridge')).j.list.find((w) => w.nick === '소원 3').text].length <= WISH.max, `소원은 ${WISH.max}자까지만`);
    }

    await sleep(61000); // 위 소원 검사가 쓴 주소별 요청 수(1분 NET.reqPerMin)를 비움
    /* ---------- 이름 (#162): 거르기·처음 짓기·바꾸기 ---------- */
    {
      const { nickOk } = await import('../src/safetext.js');
      const BADN = ['시1발', '씨 발 러너', 'ㅅㅂ', 'ㅂ ㅅ', 'f.u.c.k', 'Sh1t', '@sshole', '섹 스', '운영자', 'GM 하르방', '관리 자', 'p0rn', 'ㅋ'.repeat(12)];
      const GOODN = ['작은 억새', '귤 줍는 하니', '시발점', '시바견', '새끼손가락', 'jeju_runner', 'Mina.K', 'hello-world', '오름🍊', '고양이', '바다', 'dogma', 'bigman', '젖소목장', 'essex', '고진', '달려라하니', '제주123', 'tangerine', '노루 친구'];
      // 어드민(저장으로 이름 바꾸기가 열려 있음)으로 하나씩 보내 봄: 걸리는 것은 받지 않고, 평범한 것은 그대로
      let last = (await req('plain', '/me', { token: Bs.token })).j.save.nick, okBad = 0, okGood = 0;
      for (const n of BADN) { const r = await req('plain', '/save', { method: 'PUT', token: Bs.token, body: { save: { ...S0, coins: NET.earnBurst * 3, nick: n } } }); if (r.j.fix?.nick && r.j.fix.nick !== n && nickOk(r.j.fix.nick)) { okBad++; last = r.j.fix.nick; } }
      ok(okBad === BADN.length, `욕설·사칭·변형 이름 ${okBad}/${BADN.length} 서버가 받지 않음 (${last})`);
      for (const n of GOODN) { const r = await req('plain', '/save', { method: 'PUT', token: Bs.token, body: { save: { ...S0, coins: NET.earnBurst * 3, nick: n } } }); if (!r.j.fix?.nick) okGood++; else console.log('     걸린 이름', n); }
      ok(okGood === GOODN.length, `평범한 이름 ${okGood}/${GOODN.length} 통과`);
      // 새 계정이 처음부터 걸리는 이름 → 무작위 이름 + 다음 한 번 무료
      const N1 = await login('plain', 'nick-new');
      const n1 = await req('plain', '/save', { method: 'PUT', token: N1.token, body: { save: { ...S0, nick: '씨8발' } } });
      const m1 = (await req('plain', '/me', { token: N1.token })).j;
      ok(n1.j.fix?.nick && m1.save.nick === n1.j.fix.nick && nickOk(m1.save.nick) && m1.nickRen?.free === 1, `처음 지은 이름이 걸리면 무작위 이름으로 (${m1.save.nick}, 다음 무료 ${m1.nickRen?.free})`);
      // 정한 뒤에는 저장으로 못 바꿈 (POST /nick 만)
      const N2 = await login('plain', 'nick-pay');
      const look = { sex: 'f', skin: 1 };
      await req('plain', '/save', { method: 'PUT', token: N2.token, body: { save: { ...S0, coins: 0, nick: '처음 이름', nickSet: 1, look } } });
      const sneak = await req('plain', '/save', { method: 'PUT', token: N2.token, body: { save: { ...S0, coins: 0, nick: '몰래 바꿈', look } } });
      ok(sneak.j.fix?.nick === '처음 이름', `정한 이름은 저장으로 바꿀 수 없음 (${sneak.j.fix?.nick})`);
      const nk = (body) => req('plain', '/nick', { method: 'POST', token: N2.token, body });
      const D1 = Date.now() + 864e5, D2 = D1 + 864e5;
      ok((await nk({ nick: '두번째 이름', price: 0, at: D1 })).j.ok, '첫 바꾸기는 귤 없이 됨');
      const twice = await nk({ nick: '세번째 이름', price: 0, at: D1 });
      ok(twice.status === 409 && twice.j.error === 'day', `하루 두 번 거절 (${twice.j.error})`);
      const cheat = await nk({ nick: '세번째 이름', price: 0, at: D2 });
      ok(cheat.j.error === 'price' && cheat.j.price === 2000, `값 속이기 거절 (서버 값 ${cheat.j.price})`);
      const broke = await nk({ nick: '세번째 이름', price: 2000, at: D2 });
      ok(broke.j.error === 'coins', `귤 없이 바꾸기 거절 (${broke.j.error})`);
      const badRn = await nk({ nick: '개새끼', price: 2000, at: D2 });
      ok(badRn.j.error === 'bad', '바꾸기도 걸리는 이름 거절');
      ok(!(await req('plain', '/nick', { method: 'POST', body: { nick: '손님 이름', price: 0 } })).j?.ok, '손님(로그인 없음)은 /nick 못 씀');
      const m2 = (await req('plain', '/me', { token: N2.token })).j;
      ok(m2.save.nick === '두번째 이름' && m2.nick === '두번째 이름' && m2.save.coins === 0 && m2.nickRen.n === 1, `바꾼 이름·귤·횟수는 서버 값 (${m2.save.nick}, 귤 ${m2.save.coins}, ${JSON.stringify(m2.nickRen)})`);
      // 귤이 있으면 빠지고 바뀜 (값 2,000)
      await req('plain', '/save', { method: 'PUT', token: N2.token, body: { save: { ...m2.save, coins: 2500 } } });
      const paid = await nk({ nick: '세번째 이름', price: 2000, at: D2 });
      const m3 = (await req('plain', '/me', { token: N2.token })).j;
      ok(paid.j.ok && paid.j.paid === 2000 && m3.save.coins === 500 && m3.save.nick === '세번째 이름', `귤 2,000 빠지고 바뀜 (남은 귤 ${m3.save.coins})`);
      const keepNew = await req('plain', '/save', { method: 'PUT', token: N2.token, body: { save: { ...m2.save, coins: 500 } } }); // 옛 이름이 든 저장이 늦게 와도
      ok(keepNew.j.fix?.nick === '세번째 이름', '늦게 온 옛 저장이 바꾼 이름을 되돌리지 못함');
    }

    /* ---------- 귤 주기 (#175): 서버가 옮김 ---------- */
    {
      const { GIVE } = await import('../src/balance.js');
      const S1 = { coins: 5, equip: { tool: 1, bag: 0, shoes: 1, weapon: 1 }, clothes: { own: {}, wear: {} }, rides: { own: [], cur: null }, hairs: {}, trash: { total: 0 } };
      const put = (k, tk, sv) => req(k, '/save', { method: 'PUT', token: tk, body: { save: sv } });
      const meOf = async (k, tk) => (await req(k, '/me', { token: tk })).j.save;
      const lg = async (k, n) => { for (let i = 0; i < 20; i++) { const r = await login(k, n); if (r?.token) return r; await sleep(5000); } return {}; }; // 앞 검사들로 로그인 수 제한(분당)에 걸릴 수 있음
      const GA = await lg('dev', 'gift-a'), GB = await lg('dev', 'gift-b'), GP = await lg('dev', 'gift-poor'), C2 = await lg('dev', 'gift-c');
      // 처음 몫(earnBurst)을 다 써 둠: 부풀린 귤이 '번 귤' 로 받아들여지지 않게
      for (const [tk, c] of [[GA.token, 1000], [GB.token, 100], [GP.token, 3]]) { await put('dev', tk, { ...S1, coins: 5 + NET.earnBurst }); await put('dev', tk, { ...S1, coins: c }); }
      const RM = 'oreum-namsongi-battle', CH = 11;
      const a = await sock('dev', RM, { token: GA.token, ch: CH }), bq = await sock('dev', RM, { token: GB.token, ch: CH }), pq = await sock('dev', RM, { token: GP.token, ch: CH }), gq = await sock('dev', RM, { ch: CH });
      const idOf = (o) => o.last('hi')?.id;
      for (const [o, x] of [[a, 0], [bq, 1], [pq, 0.5], [gq, 1.5]]) o.send(presence(x, 0));
      await sleep(400);
      const after = (o, tt, n0) => o.msgs.filter((m) => m.t === tt).slice(n0);
      const give = async (from, to, n, wait = 500) => { const k0 = from.msgs.filter((m) => m.t === 'gave').length; from.send({ t: 'give', to, n }); await sleep(wait); return after(from, 'gave', k0)[0] || null; };
      const g1 = await give(a, idOf(bq), 5);
      const got1 = bq.last('got');
      ok(g1?.n === 5 && g1.out === 5 && got1?.n === 5 && got1.in === 5 && got1.from === idOf(a), `A 가 B 에게 귤 5개 → 서버가 옮기고 둘에게 알림 (${JSON.stringify(g1)}, ${JSON.stringify(got1)})`);
      ok(bq.msgs.filter((m) => m.t === 'u').some((u) => u.p.some(([id, d]) => id === idOf(a) && d.ac === 1)) && !bq.msgs.filter((m) => m.t === 'u').some((u) => u.p.some(([id, d]) => id === idOf(gq) && d.ac)), '로그인한 사람만 ac 표시 (손님은 없음)');
      const n0 = bq.msgs.filter((m) => m.t === 'got').length;
      ok((await give(a, idOf(a), 1))?.no === 'none', '자기에게 주기 거절');
      a.send({ t: 'give', to: idOf(bq), n: -3 }); a.send({ t: 'give', to: idOf(bq), n: GIVE.burst + 1 }); a.send({ t: 'give', to: idOf(bq), n: 1.5 }); await sleep(300);
      ok(bq.msgs.filter((m) => m.t === 'got').length === n0, '음수·너무 많음·소수 n 은 옮기지 않음');
      ok((await give(gq, idOf(bq), 1))?.no === 'login', '손님은 줄 수 없음');
      ok((await give(a, idOf(gq), 1))?.no === 'none', '손님에게는 줄 수 없음');
      const pp = await give(pq, idOf(bq), 5);
      ok(pp?.n === 0 && pp.no === 'coins', `가진 것(3)보다 많이 주기 거절 (${JSON.stringify(pp)})`);
      bq.send(presence(GIVE.serverR + 4, 0)); await sleep(300);
      ok((await give(a, idOf(bq), 1))?.no === 'far', '멀리서 주기 거절');
      bq.send(presence(1, 0)); await sleep(300);
      // 초당 상한: 한꺼번에 많이 보내면 perSec 까지만
      const k1 = a.msgs.filter((m) => m.t === 'gave').length;
      for (let i = 0; i < 6; i++) a.send({ t: 'give', to: idOf(bq), n: GIVE.burst });
      await sleep(700);
      const burst = after(a, 'gave', k1), moved = burst.reduce((s0, m) => s0 + m.n, 0);
      ok(moved <= GIVE.perSec + 2 && burst.some((m) => m.no === 'fast'), `초당 상한 (한꺼번에 ${GIVE.burst * 6}개 → ${moved}개)`);
      // 하루 상한: 가진 귤의 dayGivePart
      await sleep(1100);
      let outA = burst.reduce((m0, m) => Math.max(m0, m.out || 0), 5), dayNo = null;
      for (let i = 0; i < 60 && !dayNo; i++) { const r = await give(a, idOf(bq), GIVE.burst, 420); if (r?.out) outA = Math.max(outA, r.out); if (r?.no === 'day') dayNo = r; }
      ok(dayNo && outA <= Math.floor(1000 * GIVE.dayGivePart) && outA >= Math.floor(1000 * GIVE.dayGivePart) - GIVE.burst, `하루 상한 (가진 1000 → ${outA}개에서 '오늘은 더 줄 수 없어요')`);
      // 저장: 준 사람이 귤을 안 뺀 저장을 보내면 서버가 뺌, 받은 사람이 스스로 더한 몫은 바로잡힘
      const sA = await put('dev', GA.token, { ...S1, coins: 1000 });
      const mA = await meOf('dev', GA.token);
      ok(sA.j.fixed.includes('gift') && mA.coins === 1000 - outA && mA.gift.out === outA && sA.j.fix.gift?.out === outA, `준 만큼 정확히 빠짐 (1000 → ${mA.coins}, 준 ${outA})`);
      const inB = outA;
      const sB = await put('dev', GB.token, { ...S1, coins: 100 + inB + 3000, gift: { in: inB + 3000, out: 0 } });
      const mB = await meOf('dev', GB.token);
      ok(sB.j.fixed.includes('coins') && sB.j.fixed.includes('gift') && mB.gift.in === inB && mB.coins <= 100 + inB + NET.earnPerSec * 90, `받은 귤 스스로 더하기·받은 누적 부풀리기 거절 (${mB.coins}, 받은 ${mB.gift.in})`);
      const sB2 = await put('dev', GB.token, { ...mB, coins: mB.coins });
      ok(!sB2.j.fixed.includes('gift') && !sB2.j.fixed.includes('coins'), '맞게 넣은 받은 귤은 그대로');
      // 못 받은 알림(끊김): 받은 사람이 귤을 안 넣은 저장을 보내면 서버가 넣어 줌
      const before = (await meOf('dev', GB.token)).coins;
      const g2 = await give(a, idOf(bq), 1); // 하루 상한 뒤라 'day' 일 수 있음 → 그때는 P(poor 아님) 대신 새 계정으로
      await put('dev', C2.token, { ...S1, coins: 5 + NET.earnBurst }); await put('dev', C2.token, { ...S1, coins: 200 });
      const cq = await sock('dev', RM, { token: C2.token, ch: CH }); cq.send(presence(0.8, 0)); await sleep(400);
      const g3 = await give(cq, idOf(bq), 7);
      const lost = await put('dev', GB.token, { ...(await meOf('dev', GB.token)), coins: before + (g2?.n || 0) });
      const mB3 = await meOf('dev', GB.token);
      ok(g3?.n === 7 && lost.j.fixed.includes('gift') && lost.j.fix.coins === mB3.coins && mB3.coins === before + (g2?.n || 0) + 7, `못 받은 알림의 귤은 서버가 넣어 줌 (${before} → ${mB3.coins})`);
      // 받지 않기
      await put('dev', GB.token, { ...mB3, giftOff: 1 });
      ok((await give(cq, idOf(bq), 1))?.no === 'off', "'귤 선물 받지 않기' 면 거절");
      for (const o of [a, bq, pq, gq, cq]) o.close();
      // 새 계정 (plain: 기본 GIVE.newSec): 받기만 됨
      const NA = await lg('plain', 'gift-new-a'), NB = await lg('plain', 'gift-new-b');
      await put('plain', NA.token, { ...S1, coins: 500 }); await put('plain', NB.token, { ...S1, coins: 5 });
      const na = await sock('plain', RM, { token: NA.token, ch: CH }), nb = await sock('plain', RM, { token: NB.token, ch: CH });
      na.send(presence(0, 0)); nb.send(presence(1, 0)); await sleep(400);
      ok((await give(na, idOf(nb), 1))?.no === 'new', '만든 지 하루 안 된 계정은 줄 수 없음');
      na.close(); nb.close();
    }

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
