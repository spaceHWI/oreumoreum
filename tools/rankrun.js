// 랭킹만 빠르게 (#250): node tools/rankrun.js [--no-spawn 서버주소]
// 로컬 서버(wrangler dev, FAKE_AUTH·STATS_OPEN)를 하나 띄워 브라우저 없이 HTTP 로만 본다. 3분 안
//   계정 둘이 치움 → 저장 → 오늘·이번 주·전체 순위와 내 순위가 늘어남 / 일요일 밤 → 월요일 0시(날·주 경계, 시각을 넣어 줌)
//   이름 바꾼 뒤 순위표 이름 / 손님으로 치우고 로그인한 새 계정이 오늘 표에 (#261) / 서버가 깎은 저장(치운 수가 한 번에 너무 많음) 뒤에도 순위가 멈추지 않음 / 버린 직후 내 줄 / 손님 401 / 어드민 랭킹 상태
const { spawn } = require('child_process');
const { clearPorts, killOnExit } = require('./localsrv.js');
const path = require('path'), os = require('os');
const SERVER_DIR = path.join(__dirname, '..', 'server');
const NOSPAWN = process.argv.includes('--no-spawn');
const PORT = 8811;
const BASE = NOSPAWN ? (process.argv.find((a) => /^https?:/.test(a)) || 'http://127.0.0.1:8787') : `http://127.0.0.1:${PORT}`;
const LOCAL = 'http://127.0.0.1:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
async function req(p, { method = 'GET', body, token } = {}) {
  const h = { 'content-type': 'application/json', Origin: LOCAL };
  if (token) h.authorization = 'Bearer ' + token;
  const r = await fetch(BASE + p, { method, headers: h, body: body == null ? undefined : JSON.stringify(body) });
  let j = null; try { j = await r.json(); } catch (e) { j = null; }
  return { status: r.status, j };
}
// 한국 시각 → ms (2026-11-29 는 일요일, 11-30 월요일)
const kst = (s) => Date.parse(s + '+09:00');
const T = { sun: kst('2026-11-29T12:00:00'), sunLate: kst('2026-11-29T23:59:00'), mon: kst('2026-11-30T00:01:00'), mon2: kst('2026-11-30T00:03:00'), mon3: kst('2026-11-30T00:05:00') };

(async () => {
  let proc = null;
  const t0 = Date.now();
  if (!NOSPAWN) {
    await clearPorts([PORT], 'oreum-rank-'); killOnExit(() => (proc ? [proc] : [])); /* #259 */
    proc = spawn('npx', ['wrangler', 'dev', '--local', '--port', String(PORT), '--inspector-port', String(PORT + 1000), '--persist-to', path.join(os.tmpdir(), 'oreum-rank-' + Date.now()), '--var', 'FAKE_AUTH:1', '--var', 'STATS_OPEN:1'], { cwd: SERVER_DIR, stdio: 'ignore', detached: true });
    let up = false;
    for (let i = 0; i < 90 && !up; i++) { try { up = (await fetch(BASE + '/health')).ok; } catch (e) { await sleep(1000); } }
    if (!up) { console.log('FAIL 서버가 안 뜸'); process.exit(1); }
  }
  const stop = () => { if (proc) try { process.kill(-proc.pid); } catch (e) { /* 이미 꺼짐 */ } };
  try {
    const tag = Date.now().toString(36);
    const login = async (n) => (await req('/auth/google', { method: 'POST', body: { credential: 'fake:rk' + n + tag } })).j;
    const A = await login('a'), B = await login('b');
    ok(A?.token && B?.token, '가짜 로그인 둘');
    const base = (nick, total, coins = 5) => ({ coins, equip: { tool: 1, bag: 0, shoes: 1, weapon: 1 }, clothes: { own: {}, wear: {} }, rides: { own: [], cur: null }, hairs: {}, trash: { total }, nick });
    const saved = {};
    const put = async (X, save, at) => { const r = await req('/save', { method: 'PUT', token: X.token, body: { save, at } }); saved[X.token] = r.j; return r; };
    const rank = async (X, range, at) => (await req(`/rank?range=${range}&at=${at}`, { token: X.token })).j;
    const me = async (X, at) => (await req(`/rank/me?at=${at}`, { token: X.token })).j;
    const nA = '순위가람', nB = '순위나래';
    // 1) 일요일 낮: A 30, B 10
    await put(A, base(nA, 0), T.sun - 60e3); await put(B, base(nB, 0, 5000), T.sun - 60e3);
    await put(A, base(nA, 30), T.sun); await put(B, base(nB, 10, 5000), T.sun);
    for (const g of ['day', 'week', 'all']) {
      const r = await rank(A, g, T.sun + 1000);
      const ra = r?.top?.find((x) => x.nick === nA), rb = r?.top?.find((x) => x.nick === nB);
      ok(ra?.rank === 1 && ra.n === 30 && ra.me && rb?.rank === 2 && rb.n === 10 && r.me.rank === 1 && r.me.n === 30, `${g}: A 30 1위, B 10 2위, 내 순위 (${JSON.stringify(r?.me)} · ${r?.total}명)`);
    }
    // 2) 일요일 밤: B 가 더 치움 (+50) → 오늘 1위. 표는 RANK.cacheMs 안이어도 내 줄은 바로 센 값
    const pre = await rank(B, 'day', T.sunLate - 2000);
    await put(B, base(nB, 60, 5000), T.sunLate);
    const after = await rank(B, 'day', T.sunLate + 1000), mb = after?.top?.find((x) => x.me);
    ok(pre?.me?.rank === 2 && after?.me?.rank === 1 && after.me.n === 60 && mb?.n === 60, `버린 직후 내 순위·내 줄이 바로 늘어남 (2위 → ${after?.me?.rank}위, 내 줄 ${mb?.n})`);
    const mB = await me(B, T.sunLate + 1500);
    ok(mB?.day?.n === 60 && mB?.week?.n === 60 && mB?.all?.n === 60 && mB.day.rank === 1, `/rank/me 셋 (${JSON.stringify(mB)})`);
    // 3) 월요일 0시 넘어: 날·주가 바뀜. A +5 만
    await put(A, base(nA, 35), T.mon);
    const dM = await rank(A, 'day', T.mon + 1000), wM = await rank(A, 'week', T.mon + 1000), aM = await rank(A, 'all', T.mon + 1000);
    ok(dM?.total === 1 && dM.top[0]?.nick === nA && dM.top[0].n === 5 && dM.me.rank === 1, `월요일 오늘: 새 표 (A 5 만, ${dM?.total}명)`);
    ok(wM?.total === 1 && wM.top[0]?.n === 5, `월요일 이번 주: 새 주 (${wM?.total}명, ${wM?.top?.[0]?.n})`);
    ok(aM?.top?.[0]?.nick === nB && aM.top[0].n === 60 && aM.me.n === 35 && aM.me.rank === 2, `전체는 이어짐 (B 60, A 35 2위)`);
    const bM = await me(B, T.mon + 1500);
    ok(bM?.day?.rank === 0 && bM.week.rank === 0 && bM.all.rank === 1, `B 는 월요일 오늘·이번 주 기록 없음, 전체 1위 (${JSON.stringify(bM)})`);
    const sunAgain = await rank(A, 'day', T.sunLate + 3000);
    ok(sunAgain?.total === 2, `어제(일요일) 표는 그날 키로 따로 (${sunAgain?.total}명)`);
    // 4) 이름 바꾸기 → 순위표 이름
    const p0 = await req('/nick', { method: 'POST', token: B.token, body: { nick: '새이름나래', price: -1, at: T.mon2 } });
    const rn = await req('/nick', { method: 'POST', token: B.token, body: { nick: '새이름나래', price: p0.j?.price, at: T.mon2 } });
    const aN = await rank(A, 'all', T.mon2 + 1000);
    ok(rn.j?.ok && aN?.top?.[0]?.nick === '새이름나래' && !aN.top.some((x) => x.nick === nB), `이름 바꾼 뒤 순위표 이름 (${rn.status} ${aN?.top?.[0]?.nick})`);
    // 5) 서버가 깎은 저장: 한 번에 너무 많이 → 깎여도 늘고, 그 뒤 저장도 계속 늚 (깎인 값을 받은 경우·안 받은 경우 둘 다)
    const big = await put(A, base(nA, 35 + 100000), T.mon2);
    const cut = big.j?.fix?.total;
    const all1 = await me(A, T.mon2 + 500);
    ok(big.j?.fixed?.includes('picked') && cut > 35 && all1?.all?.n === cut, `깎인 저장도 받아 준 만큼 늚 (서버 값 ${cut}, 전체 ${all1?.all?.n})`);
    await put(A, base(nA, cut + 7), T.mon3);
    const all2 = await me(A, T.mon3 + 500);
    ok(all2?.all?.n === cut + 7, `깎인 값을 받은 뒤 +7 (${all2?.all?.n})`);
    await put(A, base(nA, 35 + 100000 + 3), T.mon3 + 60e3);
    const all3 = await me(A, T.mon3 + 61e3);
    ok(all3?.all?.n > cut + 7, `깎인 값을 안 받은 클라이언트도 다음 저장에서 계속 늚 (${all3?.all?.n})`);
    // 처음부터 다시(치운 수가 줄어듦): 순위는 줄지 않고, 다시 치우면 다시 늚
    const before = all3.all.n;
    await put(A, base(nA, 0), T.mon3 + 70e3);
    const r0 = await me(A, T.mon3 + 71e3);
    await put(A, base(nA, 4), T.mon3 + 80e3);
    const r4 = await me(A, T.mon3 + 81e3);
    ok(r0?.all?.n === before && r4?.all?.n === before + 4, `줄어든 저장은 빼지 않고 다시 치우면 늚 (${before} → ${r0?.all?.n} → ${r4?.all?.n})`);
    // 5b) 손님으로 치우다 로그인한 새 계정 (#261): 기기 기록을 옮기면 오늘 치운 만큼 오늘·이번 주 표에도 오름. 표 캐시를 기다리지 않음
    {
      const { kstDay, weekStart } = await import('../src/rankday.js');
      const at = T.mon3 + 90e3, d = kstDay(at), nG = '손님에서온';
      const pre2 = await rank(A, 'day', at - 1000);
      const G = await login('g');
      const mig = await req('/save', { method: 'PUT', token: G.token, body: { migrate: true, at, save: { ...base(nG, 40), trash: { total: 40, rk: { d, w: weekStart(d), day: { battle: 12 }, week: { battle: 25 }, all: { battle: 40 } } } } } });
      const gd = await rank(G, 'day', at + 1000), gw = await rank(G, 'week', at + 1000), ga = await rank(G, 'all', at + 1000);
      const inD = gd?.top?.find((x) => x.nick === nG);
      ok(mig.status === 200 && inD?.n === 12 && gd.me.n === 12 && gd.total === (pre2?.total || 0) + 1, `손님으로 치우고 로그인한 새 계정이 오늘 표에 오름 (오늘 ${inD?.n}, ${pre2?.total} → ${gd?.total}명, 캐시 안 기다림)`);
      ok(gw?.me?.n === 12 && ga?.me?.n === 40, `이번 주는 오늘 몫 12, 전체는 40 (${gw?.me?.n} · ${ga?.me?.n})`);
    }
    // 6) 손님·어드민
    ok((await req('/rank')).status === 401 && (await req('/rank/me')).status === 401, '손님은 서버 순위 401 (게임은 이 기기 기록 + 로그인 안내)');
    const on = (await req('/admin/online')).j, rk = on?.rank;
    ok(rk && rk.all >= 2 && Number.isFinite(rk.day) && Number.isFinite(rk.week) && rk.last >= T.mon3, `어드민 랭킹 상태 (${JSON.stringify(rk)})`);
    ok(!/rk[ab]|순위|나래|가람|fake-/.test(JSON.stringify(rk)), '랭킹 상태에 이름·계정 번호 없음');
  } catch (e) {
    ok(false, '멈춤: ' + (e && e.stack || e));
  } finally {
    stop();
    console.log(`(${Math.round((Date.now() - t0) / 1000)}초)`);
    process.exit(process.exitCode || 0);
  }
})();
