// 계정 저장 (#7): Durable Object 하나(이름 'all') 안의 SQLite. 칸은 sub·닉네임·게임 저장·치운 양·접속 시각뿐
import { DurableObject } from 'cloudflare:workers';
import { NET, FEEDBACK, RANK, HAIR, NICK, METRICS, GIVE } from '../../src/balance.js';
import { isMaxKey } from './metrics.js';
import { xmasDay, treeGoal, treeStage } from '../../src/seasoncal.js';
import { cleanText, nickOk, nickBad, nickPrice } from '../../src/safetext.js';
import { checkSave } from './validate.js';
import { fgInit, fgRun, fgList } from './filegrants.js';
import GRANTS from '../grants.json';
import { kstDay, weekStart, lookOf } from '../../src/rankday.js';
import { wishInit, wishList, wishPut, wishPray, wishNews, wishReport, wishReported, wishAdmin, wishPurge } from './wishes.js';

const hairOk = (k) => !!HAIR.byKey[k] || k === 'hat:cap';

export class Accounts extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS acc (
      sub TEXT PRIMARY KEY, nick TEXT, save TEXT, rev INTEGER DEFAULT 0, cleaned INTEGER DEFAULT 0,
      credit REAL, pick_credit REAL, saved_at INTEGER, last_seen INTEGER, created INTEGER)`);
    // 의견 (#77): 글과 같이 온 값만. ip 는 보내기 막기용 해시
    // 버린 세션 토큰 (#84): 로그아웃한 토큰 번호와 그 토큰이 끝나는 시각 (끝나면 Cron 이 지움)
    this.sql.exec('CREATE TABLE IF NOT EXISTS rv (j TEXT PRIMARY KEY, exp INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS fb (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, ip TEXT, item TEXT, mailed INTEGER DEFAULT 0)');
    // 랭킹 (#11): rkd = 날마다 치운 수(한국 날 번호 d), rka = 전체. srv 는 battle 하나 (#98: 예전 clean 은 아래에서 battle 에 더해 합침). acc.look = 머리 아이콘 값
    const hadRank = this.sql.exec("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'rka'").one().n > 0;
    this.sql.exec('CREATE TABLE IF NOT EXISTS rkd (sub TEXT, srv TEXT, d INTEGER, n INTEGER, PRIMARY KEY (sub, srv, d))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS rka (sub TEXT, srv TEXT, n INTEGER, PRIMARY KEY (sub, srv))');
    this.sql.exec('CREATE INDEX IF NOT EXISTS rkd_sd ON rkd (srv, d)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS rka_sn ON rka (srv, n)');
    const cols = this.sql.exec('PRAGMA table_info(acc)').toArray().map((c) => c.name);
    if (!cols.includes('look')) this.sql.exec('ALTER TABLE acc ADD COLUMN look TEXT');
    for (const c of ['nick_n', 'nick_day', 'nick_free']) if (!cols.includes(c)) this.sql.exec(`ALTER TABLE acc ADD COLUMN ${c} INTEGER DEFAULT 0`); // 이름 바꾸기 (#162): 바꾼 횟수·마지막 바꾼 날(한국 날)·다음 한 번 무료
    if (!cols.includes('bank')) this.sql.exec('ALTER TABLE acc ADD COLUMN bank REAL DEFAULT 0'); // 번 몫 (#144): 방이 받아 준 줍기 × 더미 값. 버린 귤은 이 안에서
    // 귤 주기 (#175): 받은·준 귤 누적(gin·gout, 저장의 save.gift 와 맞춰 봄), 그날(한국 날 g_day) 준·받은 수
    for (const c of ['gin', 'gout', 'g_day', 'g_out', 'g_in']) if (!cols.includes(c)) this.sql.exec(`ALTER TABLE acc ADD COLUMN ${c} INTEGER DEFAULT 0`);
    if (!cols.includes('cred')) this.sql.exec('ALTER TABLE acc ADD COLUMN cred TEXT'); // 서버가 인정한 기록 (#188 earn.js): 받은 퀘스트·우두머리·소굴·보물·볼거리, 새 전리품 통
    // 귤 맞춤 기록 (#188): 서버가 귤을 깎은 때마다 한 줄 (clampKeepDays 일 보관). 운영자 귤 보내기 (got: 받는 사람이 받았나)
    this.sql.exec('CREATE TABLE IF NOT EXISTS clamp (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, sub TEXT, nick TEXT, amt INTEGER, before INTEGER, ask INTEGER, after INTEGER, why TEXT, ver TEXT, info TEXT)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS clamp_at ON clamp (at)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS gift (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, sub TEXT, n INTEGER, why TEXT, by TEXT, got INTEGER DEFAULT 0, got_at INTEGER)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS gift_sub ON gift (sub, got)');
    fgInit(this.sql); this.fgAt = 0; /* 귤 보내기 목록 (#215, filegrants.js) */

    if (!hadRank) this.sql.exec("INSERT OR IGNORE INTO rka (sub, srv, n) SELECT sub, 'battle', cleaned FROM acc WHERE cleaned > 0"); // 랭킹 전 치운 양은 전체로
    // #98: 깨끗한 오름 기록을 전투 오름 기록에 더하고 지움 (한 번 옮기면 clean 줄이 없어 다음엔 아무 일 없음)
    if (this.sql.exec("SELECT COUNT(*) AS n FROM rka WHERE srv = 'clean'").one().n || this.sql.exec("SELECT COUNT(*) AS n FROM rkd WHERE srv = 'clean'").one().n) {
      this.sql.exec("INSERT INTO rka (sub, srv, n) SELECT sub, 'battle', n FROM rka WHERE srv = 'clean' ON CONFLICT (sub, srv) DO UPDATE SET n = n + excluded.n");
      this.sql.exec("INSERT INTO rkd (sub, srv, d, n) SELECT sub, 'battle', d, n FROM rkd WHERE srv = 'clean' ON CONFLICT (sub, srv, d) DO UPDATE SET n = n + excluded.n");
      this.sql.exec("DELETE FROM rka WHERE srv = 'clean'"); this.sql.exec("DELETE FROM rkd WHERE srv = 'clean'");
    }
    // 철 이벤트 트리 (#180): 기간 동안 모두가 주운 수를 날마다 하나로 더함 (d = 한국 날 번호). 서버가 확인한 줍기만
    this.sql.exec('CREATE TABLE IF NOT EXISTS ssn (d INTEGER PRIMARY KEY, n INTEGER)');
    // 지금 접속 (#186): 방마다 사람 수만(onl), 오늘 최고 동시 접속은 한국 날마다 값 하나(onlpk). 이름·계정 번호는 적지 않음
    this.sql.exec('CREATE TABLE IF NOT EXISTS onl (room TEXT PRIMARY KEY, n INTEGER, login INTEGER, at INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS onlpk (d INTEGER PRIMARY KEY, n INTEGER, at INTEGER)');
    // 이용 통계 (#121): 날(한국 날 번호)·출처(live·dev·adm)·키마다 합과 횟수 한 줄. 계정·IP 는 넣지 않음
    this.sql.exec('CREATE TABLE IF NOT EXISTS mt (d INTEGER, src TEXT, k TEXT, sum REAL, n INTEGER, PRIMARY KEY (d, src, k))');
    wishInit(this.sql); // 돌탑 소원 (#127, wishes.js)
    this.sql.exec('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v INTEGER)'); /* 값 하나짜리 기록: rkLast = 마지막으로 순위가 늘어난 시각 (#250) */
    this.rkCache = new Map();
  }
  /* ---------- 돌탑 소원 (#127): server/src/wishes.js ---------- */
  wishList(cid, me) { return wishList(this.sql, cid, me); }
  wishPut(sub, cid, text, t) { return wishPut(this.sql, sub, cid, text, t); }
  wishPray(who, id, login, t) { return wishPray(this.sql, who, id, { login }, t); }
  wishNews(sub) { return wishNews(this.sql, sub); }
  wishReport(who, id) { return wishReport(this.sql, who, id); }
  wishReported() { return wishReported(this.sql); }
  wishAdmin(id, act) { return wishAdmin(this.sql, id, act); }
  /* 한 계정 한 접속 (#303): 계정마다 마지막으로 들어간 방·시각 (메모리만. 꺼졌다 켜지면 비어도 같은 방 안은 방이 막음).
     앞 접속이 다른 방이면 그 방 이름(prev), 내가 더 늦게 도착한 옛 접속이면 stale */
  claim(sub, room, at = Date.now()) {
    if (typeof sub !== 'string' || typeof room !== 'string' || !/^[a-z0-9-]{1,48}#\d{1,2}$/.test(room)) return {};
    const m = (this.live ||= new Map()), o = m.get(sub), t = Number.isFinite(at) ? at : Date.now();
    if (o && o.at > t) return { stale: true };
    m.set(sub, { room, at: t });
    if (m.size > NET.liveMax) { const old = Date.now() - NET.liveKeepMs; for (const [k, v] of m) if (v.at < old) m.delete(k); }
    return { prev: o && o.room !== room ? o.room : null };
  }
  // 방이 알려 준 사람 수 (#186, room.js report). 0명이면 지움. 오래 소식이 없는 방(꺼진 방)은 빼고 셈
  roomCount(room, n, login, t = Date.now()) {
    if (typeof room !== 'string' || !/^[a-z0-9-]{1,48}#\d{1,2}$/.test(room)) return;
    n = Math.max(0, Math.min(999, n | 0)); login = Math.max(0, Math.min(n, login | 0));
    if (n) this.sql.exec('INSERT OR REPLACE INTO onl (room, n, login, at) VALUES (?, ?, ?, ?)', room, n, login, t);
    else this.sql.exec('DELETE FROM onl WHERE room = ?', room);
    const tot = this.onlineRows(t).reduce((a, r) => a + r.n, 0), d = kstDay(t);
    const pk = this.sql.exec('SELECT n FROM onlpk WHERE d = ?', d).toArray()[0];
    if (!pk) this.sql.exec('DELETE FROM onlpk WHERE d < ?', d - NET.onlinePeakDays);
    if (!pk || tot > pk.n) this.sql.exec('INSERT OR REPLACE INTO onlpk (d, n, at) VALUES (?, ?, ?)', d, tot, t);
  }
  onlineRows(t = Date.now()) {
    this.sql.exec('DELETE FROM onl WHERE at < ?', t - NET.onlineStaleMs);
    return this.sql.exec('SELECT room, n, login FROM onl ORDER BY room').toArray();
  }
  // 어드민 창 (#186): 숫자만. rooms = [{ map, ch, n, login }]
  // 랭킹 상태 (#250, 어드민 '지금 접속' 아래 한 줄): 오늘·이번 주·전체 순위표 사람 수와 마지막으로 순위가 늘어난 시각. 닉네임·계정 번호는 넣지 않음
  rankStat(srv = 'battle', t = Date.now()) {
    const cnt = (range) => { const [q, a] = this.rankFrom(range, srv, t); return this.sql.exec(`SELECT COUNT(*) AS n FROM (${q})`, ...a).one().n; };
    return { day: cnt('day'), week: cnt('week'), all: cnt('all'), last: this.sql.exec("SELECT v FROM kv WHERE k = 'rkLast'").toArray()[0]?.v || 0 };
  }
  online(t = Date.now()) {
    const rooms = this.onlineRows(t).map((r) => { const m = /^oreum-([a-z0-9]+)(?:-battle)?#(\d+)$/.exec(r.room); return { map: m ? m[1] : r.room.split('#')[0], ch: m ? Number(m[2]) : 0, n: r.n, login: r.login }; });
    const n = rooms.reduce((a, r) => a + r.n, 0), login = rooms.reduce((a, r) => a + r.login, 0);
    const pk = this.sql.exec('SELECT n, at FROM onlpk WHERE d = ?', kstDay(t)).toArray()[0];
    return { now: t, n, login, guest: n - login, rooms, rank: this.rankStat('battle', t), peak: pk ? { n: Math.max(pk.n, n), at: pk.n >= n ? pk.at : t } : { n, at: t } };
  }
  // 이번 철 트리 합계: 기간 첫날부터 오늘까지
  seasonTotal(t = Date.now()) {
    const xd = xmasDay(t); if (!xd) return 0;
    const d = kstDay(t);
    return this.sql.exec('SELECT COALESCE(SUM(n), 0) AS n FROM ssn WHERE d >= ? AND d <= ?', d - (xd - 1), d).one().n;
  }
  seasonInfo(t = Date.now()) { const total = this.seasonTotal(t); return { now: t, day: xmasDay(t), total, stage: treeStage(total), goal: treeGoal() }; }
  row(sub) { return this.sql.exec('SELECT * FROM acc WHERE sub = ?', sub).toArray()[0] || null; }
  // 로그인·접속: 없으면 만들고 마지막 접속 시각을 갱신
  touch(sub) {
    const t = Date.now();
    let r = this.row(sub);
    if (!r) { this.sql.exec('INSERT INTO acc (sub, nick, rev, cleaned, last_seen, created) VALUES (?, ?, 0, 0, ?, ?)', sub, '', t, t); r = this.row(sub); r.isNew = true; }
    else this.sql.exec('UPDATE acc SET last_seen = ? WHERE sub = ?', t, sub);
    return this.view(r, t);
  }
  view(r, t = Date.now()) {
    return { nick: r.nick || '', rev: r.rev, save: r.save ? JSON.parse(r.save) : null, cleaned: r.cleaned, lastSeen: t, keepUntil: t + NET.keepDays * 864e5, isNew: !!r.isNew, nickRen: this.nickRen(r), gifts: this.giftsOf(r.sub) };
  }
  nickRen(r) { return { n: r.nick_n || 0, day: r.nick_day || 0, free: r.nick_free ? 1 : 0 }; }
  // 이름 바꾸기 (#162): 서버가 거르기·하루 한 번·값(바꾼 횟수로 셈)을 확인하고 귤을 빼고 바꿈. price = 클라이언트가 본 값 (다르면 거절하고 지금 값을 알려 줌)
  rename(sub, name, price, t = Date.now()) {
    const r = this.row(sub); if (!r || !r.save) return { error: 'no save' };
    const nick = cleanText(name, NET.nickMax), save = JSON.parse(r.save), R = this.nickRen(r), day = kstDay(t);
    if (!nickOk(nick) || nick !== String(name).trim().replace(/\s+/g, ' ')) return { error: 'bad' };
    if (nick === save.nick) return { error: 'same' };
    if (NICK.perDay && R.day === day) return { error: 'day', nickRen: R };
    const cost = nickPrice(R.n, R.free);
    if (price !== cost) return { error: 'price', price: cost, nickRen: R };
    const coins = Math.max(0, Math.floor(Number(save.coins) || 0));
    if (coins < cost) return { error: 'coins', price: cost, nickRen: R };
    const nr = { n: R.free ? R.n : R.n + 1, day, free: 0 };
    Object.assign(save, { coins: coins - cost, nick, nickSet: 1, nickRen: nr });
    const rev = (r.rev || 0) + 1;
    this.sql.exec('UPDATE acc SET save = ?, nick = ?, rev = ?, nick_n = ?, nick_day = ?, nick_free = 0, last_seen = ? WHERE sub = ?', JSON.stringify(save), nick, rev, nr.n, day, t, sub);
    this.rkCache.clear();
    return { ok: true, nick, paid: cost, coins: save.coins, rev, nickRen: nr };
  }
  // 세션 확인 (#84): 계정이 있고, 토큰이 계정을 만든 뒤에 나왔고(지웠다 다시 만든 계정의 옛 토큰 거절), 버린 토큰이 아니어야 함
  auth(sub, iat, jti) {
    const r = this.sql.exec('SELECT created FROM acc WHERE sub = ?', sub).toArray()[0];
    if (!r || !(iat >= (r.created || 0))) return false;
    return !this.sql.exec('SELECT 1 AS x FROM rv WHERE j = ?', jti).toArray().length;
  }
  revoke(jti, exp) { this.sql.exec('INSERT OR REPLACE INTO rv (j, exp) VALUES (?, ?)', jti, exp); return { ok: true }; }
  get(sub) { this.fileGrants(); const r = this.row(sub); return r ? this.view(r, r.last_seen) : null; }
  put(sub, save, { migrate = false, free = false, ver = '', at = 0 } = {}) {
    const raw = JSON.stringify(save);
    if (raw.length > NET.saveMax) return { error: 'too big' };
    this.fileGrants();
    const t = at || Date.now(); /* at: 로컬 검사(FAKE_AUTH, tools/rankrun.js)만 시각을 넣어 봄 (#250) */
    let r = this.row(sub); if (!r) { this.touch(sub); r = this.row(sub); }
    const prev = r.save ? JSON.parse(r.save) : null;
    const xday = xmasDay(t);
    // 운영자가 보낸 귤 (#188): 받는 사람이 받았다고 한 것(save.giftGot)만 이번 몫에 더하고 받은 것으로
    const got = new Set(Array.isArray(save.giftGot) ? save.giftGot.slice(-100).map(Number) : []);
    const take = this.giftsOf(sub).filter((g) => got.has(g.id)), grant = take.reduce((a, g) => a + g.n, 0);
    let cred = null; try { cred = r.cred ? JSON.parse(r.cred) : null; } catch (e) { cred = null; }
    const { save: S, fixed, acc, clamp, nickBad: nb, lvCut, rkDay = 0 } = checkSave(prev, save, { credit: r.credit, pickCredit: r.pick_credit, bank: r.bank, savedAt: r.saved_at, cred, gin: r.gin || 0, gout: r.gout || 0 }, t, { migrate: migrate && !prev, free, xday, treeDone: xday > 0 && this.seasonTotal(t) >= treeGoal(), grant });
    for (const g of take) this.sql.exec('UPDATE gift SET got = 1, got_at = ? WHERE id = ? AND sub = ?', t, g.id, sub);
    const rev = (r.rev || 0) + 1;
    // 확인한 칸만 바꿔 넣고 나머지(설정·튜토리얼 등)는 받은 그대로
    const out = { ...save, ...S }; delete out.sold; // 판 것 목록(#188)은 셈에만
    if (nb) this.sql.exec('UPDATE acc SET nick_free = 1 WHERE sub = ?', sub); // 걸린 이름을 서버가 바꿨으면 다음 한 번 무료 (#162)
    out.nickRen = this.nickRen(this.row(sub)); // 바꾼 횟수 등은 서버 값 (클라이언트가 보낸 것은 버림)
    this.sql.exec('UPDATE acc SET save = ?, nick = ?, rev = ?, cleaned = ?, credit = ?, pick_credit = ?, bank = ?, cred = ?, saved_at = ?, last_seen = ?, look = ? WHERE sub = ?',
      JSON.stringify(out), S.nick, rev, S.trash.total, acc.credit, acc.pickCredit, acc.bank, JSON.stringify(acc.cred || {}), t, t, lookOf(out, hairOk), sub);
    if (clamp && clamp.amt > 0) this.clampAdd(sub, S.nick, clamp, ver, t);
    // 랭킹 (#11): 서버가 확인한 치운 양이 늘어난 만큼만 더함 (서버는 전투 오름 하나, #98). 줄어든 것(처음부터 다시 등)은 빼지 않음
    const gain = S.trash.total - (prev ? (r.cleaned || 0) : 0);
    if (gain > 0) this.rankAdd(sub, 'battle', gain, t, migrate && !prev);
    if (rkDay > 0 && gain > 0) this.rankDay(sub, 'battle', Math.min(rkDay, gain), t); /* #261: 손님 때 오늘 치운 몫 (전체는 위에서 다 넣음) */
    const fix = {};
    if (fixed.length) { if (fixed.includes('coins') || fixed.includes('items')) fix.coins = S.coins; if (fixed.includes('items')) fix.reload = 1; if (fixed.includes('picked')) fix.total = S.trash.total; if (fixed.includes('mealFree')) fix.mealFree = 1; if (fixed.includes('season')) fix.season = S.season || null; if (fixed.includes('nick')) { fix.nick = S.nick; fix.nickRen = out.nickRen; } if (fixed.includes('gift')) { fix.coins = S.coins; fix.gift = S.gift; } if (fix.coins != null) fix.gift = S.gift; /* #312: 귤을 맞출 때는 늘 이 저장이 셈한 받은·준 누적도 (응답이 오는 사이 클라이언트가 넣은 주기는 빼고 덮도록) */ if (fixed.includes('lvxp')) fix.lv = { cut: lvCut || 0 }; if (fixed.includes('tok') || fixed.includes('tokItems')) fix.tok = S.tok; if (fixed.includes('tokItems')) fix.reload = 1; }
    if (clamp && clamp.amt > 0) fix.cut = { n: clamp.amt, why: clamp.why }; // 클라이언트가 '귤 ○개를 맞췄어요' 와 의견 보내기에 붙임
    return { rev, fixed, fix, keepUntil: t + NET.keepDays * 864e5, gifts: this.giftsOf(sub).filter((g) => !got.has(g.id)) };
  }
  /* ---------- 귤 맞춤 기록·운영자 귤 보내기 (#188) ---------- */
  // 깎인 때: 기록 한 줄 + 오류 모으기(fb, kind 'crash')에 한 줄 (2시간 점검이 /crashes 로 알아챔. 닉네임·계정 번호는 넣지 않음)
  clampAdd(sub, nick, c, ver, t = Date.now()) {
    const v = String(ver || '').slice(0, 20);
    this.sql.exec('INSERT INTO clamp (at, sub, nick, amt, before, ask, after, why, ver, info) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', t, sub, nick || '', c.amt, c.before, c.ask, c.after, c.why, v, JSON.stringify({ room: c.room, rec: c.rec, bad: c.bad }));
    this.sql.exec('INSERT INTO fb (at, ip, item, mailed) VALUES (?, ?, ?, 1)', t, 'clamp', JSON.stringify({ at: t, kind: 'crash', ver: v, dev: '', text: `[귤 맞춤 server] coins -${c.amt} (${c.why}) 몫 ${c.room} 인정 ${c.rec} 거절한 판 것 ${c.bad}` }));
  }
  clampList(days = 30, k = 300) {
    return this.sql.exec('SELECT clamp.id AS id, clamp.at AS at, clamp.sub AS sub, clamp.nick AS nick, amt, before, ask, after, why, ver, info FROM clamp WHERE at > ? ORDER BY id DESC LIMIT ?', Date.now() - days * 864e5, k).toArray()
      .map((r) => ({ ...r, info: (() => { try { return JSON.parse(r.info || '{}'); } catch (e) { return {}; } })() }));
  }
  // 아직 받지 않은 귤 선물: [{ id, n, why, at }]
  giftsOf(sub) { return this.sql.exec('SELECT id, n, why, at FROM gift WHERE sub = ? AND got = 0 ORDER BY id LIMIT 20', sub).toArray(); }
  grant(sub, n, why, by) {
    if (!this.row(sub)) return { error: 'no account' };
    this.sql.exec('INSERT INTO gift (at, sub, n, why, by) VALUES (?, ?, ?, ?, ?)', Date.now(), sub, n, why, by);
    return { ok: true, id: this.sql.exec('SELECT MAX(id) AS id FROM gift').one().id };
  }
  // 귤 보내기 목록 (#215): 배포 뒤 처음 접속·저장 때, 그 뒤로는 grantFileRetryMs 마다 못 보낸 줄을 다시 봄. 로컬 검사(FAKE_AUTH)는 GRANTS_TEST(base64 JSON)로 목록을 바꿈
  grantFileList() {
    if (this.env?.FAKE_AUTH === '1' && this.env.GRANTS_TEST) { try { return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(this.env.GRANTS_TEST), (c) => c.charCodeAt(0)))); } catch (e) { return []; } }
    return GRANTS;
  }
  fileGrants(t = Date.now()) {
    const gap = this.env?.FAKE_AUTH === '1' ? 0 : NET.grantFileRetryMs;
    if (this.fgAt && t - this.fgAt < gap) return;
    this.fgAt = t;
    try { fgRun(this.sql, this.grantFileList(), (sub, n, why, by) => this.grant(sub, n, why, by), t); } catch (e) { /* 목록이 깨져도 저장·접속은 그대로 */ }
  }
  fileGrantList() { this.fileGrants(); return fgList(this.sql); }
  grantList(k = 100) { return this.sql.exec('SELECT gift.id AS id, gift.at AS at, gift.sub AS sub, acc.nick AS nick, n, why, got, got_at FROM gift LEFT JOIN acc ON acc.sub = gift.sub ORDER BY gift.id DESC LIMIT ?', k).toArray(); }
  // 귤 주기 (#175, roomcore 'give'): from 이 to 에게 n 개. 서버 저장의 귤 + 아직 저장에 안 들어간 받은·준 귤로 가진 것을 셈 (클라이언트가 보낸 값은 안 믿음)
  // → { got, why?, out: from 의 준 누적, in: to 의 받은 누적, nick }. why: self|none|new|off|coins|day|full (got 이 n 보다 적을 때)
  gift(from, to, n, t = Date.now(), newSec = GIVE.newSec) {
    n = Math.floor(Number(n)); if (!(n > 0) || from === to) return { got: 0, why: 'self' };
    const a = this.row(from), b = this.row(to);
    if (!a || !b || !a.save || !b.save) return { got: 0, why: 'none' };
    if (t - (a.created || 0) < newSec * 1000) return { got: 0, why: 'new', out: a.gout || 0 };
    const sb = JSON.parse(b.save); if (sb.giftOff) return { got: 0, why: 'off', out: a.gout || 0 };
    const sa = JSON.parse(a.save), day = kstDay(t);
    const gf = (s) => (s.gift && typeof s.gift === 'object' ? s.gift : {}), num = (v) => Math.max(0, Math.floor(Number(v) || 0));
    const have = Math.max(0, num(sa.coins) + ((a.gin || 0) - num(gf(sa).in)) - ((a.gout || 0) - num(gf(sa).out)));
    const aOut = a.g_day === day ? a.g_out || 0 : 0, bIn = b.g_day === day ? b.g_in || 0 : 0;
    const dayCap = Math.min(GIVE.dayGiveMax, Math.floor((have + aOut) * GIVE.dayGivePart));
    const got = Math.max(0, Math.min(n, have, dayCap - aOut, GIVE.dayGetMax - bIn));
    if (have < n) return { got: 0, why: 'coins', out: a.gout || 0, in: b.gin || 0 }; // 가진 것보다 많이는 통째로 거절
    const why = got >= n ? undefined : dayCap - aOut < n ? 'day' : 'full';
    if (got) {
      const aIn = a.g_day === day ? a.g_in || 0 : 0, bOut = b.g_day === day ? b.g_out || 0 : 0;
      this.sql.exec('UPDATE acc SET gout = COALESCE(gout, 0) + ?, g_day = ?, g_out = ?, g_in = ? WHERE sub = ?', got, day, aOut + got, aIn, from);
      this.sql.exec('UPDATE acc SET gin = COALESCE(gin, 0) + ?, g_day = ?, g_in = ?, g_out = ? WHERE sub = ?', got, day, bIn + got, bOut, to);
    }
    return { got, why, out: (a.gout || 0) + got, in: (b.gin || 0) + got };
  }
  // 방이 받아 준 줍기로 번 몫 (#144, room.js flushEarn): [[sub, 귤]…]. 없는 계정은 지나감, earnBankMax 에서 멈춤
  earn(list) {
    if (!Array.isArray(list)) return 0;
    for (const [sub, v] of list.slice(0, 200)) if (typeof sub === 'string' && Number.isFinite(v) && v > 0) this.sql.exec('UPDATE acc SET bank = MIN(?, COALESCE(bank, 0) + ?) WHERE sub = ?', NET.earnBankMax, v, sub);
    return list.length;
  }
  // 의견 저장: 한 주소에서 1시간에 FEEDBACK.ipPerHour 개까지. → 저장한 글 수 (넘으면 -1)
  feedbackAdd(ip, items) {
    const t = Date.now();
    const n = this.sql.exec('SELECT COUNT(*) AS n FROM fb WHERE ip = ? AND at > ?', ip, t - 3600e3).one().n;
    if (n + items.length > FEEDBACK.ipPerHour) return -1;
    for (const it of items) this.sql.exec('INSERT INTO fb (at, ip, item) VALUES (?, ?, ?)', t, ip, JSON.stringify(it));
    this.sql.exec('DELETE FROM fb WHERE id <= (SELECT MAX(id) FROM fb) - ?', FEEDBACK.dbKeep);
    return items.length;
  }
  feedbackMailed(k) { this.sql.exec('UPDATE fb SET mailed = 1 WHERE id > (SELECT MAX(id) FROM fb) - ?', k); }
  // 오류 알림 (#122): since 뒤에 받은 kind 'crash' 만, 내보낼 칸(시각·글·버전·기기 종류)만 꺼냄. 닉네임·좌표·IP 는 꺼내지 않음
  crashRows(since, k = 2000) {
    return this.sql.exec("SELECT at, json_extract(item, '$.text') AS text, json_extract(item, '$.ver') AS ver, json_extract(item, '$.dev') AS dev FROM fb WHERE at > ? AND json_extract(item, '$.kind') = 'crash' ORDER BY id DESC LIMIT ?", since, k).toArray()
      .map((r) => ({ at: r.at, text: String(r.text || ''), ver: String(r.ver || ''), dev: String(r.dev || '') }));
  }
  feedbackList(k = 50, before = 0) { return this.sql.exec('SELECT id, at, item, mailed FROM fb WHERE (? = 0 OR id < ?) ORDER BY id DESC LIMIT ?', before, before, k).toArray().map((r) => ({ id: r.id, at: r.at, mailed: !!r.mailed, ...JSON.parse(r.item) })); }
  /* ---------- 랭킹 (#11) ---------- */
  // onlyAll: 기기 기록을 옮긴 몫은 오늘·이번 주에 넣지 않음
  rankAdd(sub, srv, n, t = Date.now(), onlyAll = false) {
    const had = this.sql.exec('SELECT 1 AS x FROM rka WHERE sub = ? AND srv = ? AND n > 0', sub, srv).toArray().length && (onlyAll || this.sql.exec('SELECT 1 AS x FROM rkd WHERE sub = ? AND srv = ? AND d = ? AND n > 0', sub, srv, kstDay(t)).toArray().length);
    if (!had) this.rkCache.clear(); /* #261: 표에 처음 오르는 사람은 캐시(RANK.cacheMs)를 기다리지 않고 바로 보이게 */
    this.sql.exec('INSERT INTO rka (sub, srv, n) VALUES (?, ?, ?) ON CONFLICT (sub, srv) DO UPDATE SET n = n + excluded.n', sub, srv, n);
    if (!onlyAll) this.sql.exec('INSERT INTO rkd (sub, srv, d, n) VALUES (?, ?, ?, ?) ON CONFLICT (sub, srv, d) DO UPDATE SET n = n + excluded.n', sub, srv, kstDay(t), n);
    this.sql.exec("INSERT INTO kv (k, v) VALUES ('rkLast', ?) ON CONFLICT (k) DO UPDATE SET v = MAX(v, excluded.v)", t);
    if (!onlyAll && xmasDay(t)) this.sql.exec('INSERT INTO ssn (d, n) VALUES (?, ?) ON CONFLICT (d) DO UPDATE SET n = n + excluded.n', kstDay(t), n); // 트리 (#180)
  }
  // 오늘 표(이번 주 표는 날 합)에만 더함 (#261 기기 기록 옮기기). 철 트리(ssn)도 같은 날 몫
  rankDay(sub, srv, n, t = Date.now()) {
    this.sql.exec('INSERT INTO rkd (sub, srv, d, n) VALUES (?, ?, ?, ?) ON CONFLICT (sub, srv, d) DO UPDATE SET n = n + excluded.n', sub, srv, kstDay(t), n);
    if (xmasDay(t)) this.sql.exec('INSERT INTO ssn (d, n) VALUES (?, ?) ON CONFLICT (d) DO UPDATE SET n = n + excluded.n', kstDay(t), n);
    this.rkCache.clear();
  }
  // range 의 (sub, s) 묶음을 만드는 SQL 과 값
  rankFrom(range, srv, t) {
    if (range === 'all') return ['SELECT sub, n AS s FROM rka WHERE srv = ? AND n > 0', [srv]];
    const d = kstDay(t), d0 = range === 'week' ? weekStart(d) : d;
    return ['SELECT sub, SUM(n) AS s FROM rkd WHERE srv = ? AND d >= ? GROUP BY sub HAVING s > 0', [srv, d0]];
  }
  // 위 RANK.top 명(닉네임·머리·치운 수)과 내 순위. 같은 수는 같은 순위
  rank(sub, range, srv, t = Date.now()) {
    const key = range + '|' + srv + '|' + kstDay(t);
    let c = this.rkCache.get(key);
    if (!c || Math.abs(t - c.at) > RANK.cacheMs) {
      const [q, a] = this.rankFrom(range, srv, t);
      const rows = this.sql.exec(`SELECT t.sub AS sub, t.s AS s, acc.nick AS nick, acc.look AS look FROM (${q}) t JOIN acc ON acc.sub = t.sub ORDER BY t.s DESC, acc.created ASC LIMIT ?`, ...a, RANK.top).toArray();
      const total = this.sql.exec(`SELECT COUNT(*) AS n FROM (${q})`, ...a).one().n;
      let rk = 0, last = -1; c = { at: t, total, rows: rows.map((r, i) => { if (r.s !== last) { rk = i + 1; last = r.s; } return { sub: r.sub, rank: rk, n: r.s, nick: r.nick && !nickBad(r.nick) ? r.nick : '', look: r.look || '' }; }) };
      this.rkCache.set(key, c);
      if (this.rkCache.size > 24) this.rkCache.delete(this.rkCache.keys().next().value);
    }
    const me = this.rankOf(sub, range, srv, t);
    return { range, srv, total: c.total, top: c.rows.map(({ sub: s, ...r }) => (s === sub ? { ...r, ...(me.n ? { n: me.n, rank: me.rank } : {}), me: true } : r)), me }; /* 내 줄은 캐시(RANK.cacheMs) 말고 바로 센 값 (#250: 버린 직후 내 수가 옛 값으로 보이던 것) */
  }
  // 내 순위만 (캐시 없이 바로): { rank (없으면 0), n }
  rankOf(sub, range, srv, t = Date.now()) {
    const [q, a] = this.rankFrom(range, srv, t);
    const mine = this.sql.exec(`SELECT s FROM (${q}) WHERE sub = ?`, ...a, sub).toArray()[0]?.s || 0;
    if (!mine) return { rank: 0, n: 0 };
    return { rank: 1 + this.sql.exec(`SELECT COUNT(*) AS n FROM (${q}) WHERE s > ?`, ...a, mine).one().n, n: mine };
  }
  // 이용 통계 묶음 더하기 (#121, server/src/metrics.js cleanMetrics 를 거친 줄). 하루·출처마다 새 키는 METRICS.dayKeys 까지 (넘으면 있던 키만 더함)
  metricsAdd(src, rows, t = Date.now()) {
    const d = kstDay(t), full = this.sql.exec('SELECT COUNT(*) AS n FROM mt WHERE d = ? AND src = ?', d, src).one().n >= METRICS.dayKeys;
    for (const [k, s, n] of rows) {
      const mx = isMaxKey(k);
      if (full) this.sql.exec(`UPDATE mt SET sum = ${mx ? 'MAX(sum, ?)' : 'sum + ?'}, n = n + ? WHERE d = ? AND src = ? AND k = ?`, s, n, d, src, k);
      else this.sql.exec(`INSERT INTO mt (d, src, k, sum, n) VALUES (?, ?, ?, ?, ?) ON CONFLICT (d, src, k) DO UPDATE SET sum = ${mx ? 'MAX(sum, excluded.sum)' : 'sum + excluded.sum'}, n = n + excluded.n`, d, src, k, s, n);
    }
    return { ok: true };
  }
  // 최근 days 날 (오늘 포함): [{ d, src, k, sum, n }]
  metricsList(days, t = Date.now()) { return this.sql.exec('SELECT d, src, k, sum, n FROM mt WHERE d > ? ORDER BY d DESC, src, k', kstDay(t) - days).toArray(); }
  rankMe(sub, srv, t = Date.now()) { return { srv, day: this.rankOf(sub, 'day', srv, t), week: this.rankOf(sub, 'week', srv, t), all: this.rankOf(sub, 'all', srv, t) }; }
  del(sub) { this.sql.exec('DELETE FROM acc WHERE sub = ?', sub); this.sql.exec('DELETE FROM rkd WHERE sub = ?', sub); this.sql.exec('DELETE FROM rka WHERE sub = ?', sub); this.sql.exec('DELETE FROM wish WHERE sub = ?', sub); this.rkCache.clear(); return { ok: true }; }
  purge(cutoff) {
    this.sql.exec('DELETE FROM rv WHERE exp < ?', Date.now());
    const n = this.sql.exec('SELECT COUNT(*) AS n FROM acc WHERE last_seen < ?', cutoff).one().n; this.sql.exec('DELETE FROM acc WHERE last_seen < ?', cutoff);
    this.sql.exec('DELETE FROM clamp WHERE at < ?', Date.now() - NET.clampKeepDays * 864e5); this.sql.exec('DELETE FROM gift WHERE at < ? AND got = 1', Date.now() - NET.clampKeepDays * 864e5); // #188
    this.sql.exec('DELETE FROM mt WHERE d < ?', kstDay() - METRICS.keepDays); // 이용 통계 90일 (#121)
    this.sql.exec('DELETE FROM rkd WHERE d < ? OR sub NOT IN (SELECT sub FROM acc)', kstDay() - RANK.dayKeep); this.sql.exec('DELETE FROM rka WHERE sub NOT IN (SELECT sub FROM acc)'); this.rkCache.clear();
    wishPurge(this.sql); // #127
    return n;
  }
  count() { return this.sql.exec('SELECT COUNT(*) AS n FROM acc').one().n; }
}
