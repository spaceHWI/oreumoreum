// 계정 저장 (#7): Durable Object 하나(이름 'all') 안의 SQLite. 칸은 sub·닉네임·게임 저장·치운 양·접속 시각뿐
import { DurableObject } from 'cloudflare:workers';
import { NET, FEEDBACK, RANK, HAIR } from '../../src/balance.js';
import { xmasDay, treeGoal, treeStage } from '../../src/seasoncal.js';
import { checkSave } from './validate.js';
import { kstDay, weekStart, lookOf } from '../../src/rankday.js';

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
    if (!cols.includes('bank')) this.sql.exec('ALTER TABLE acc ADD COLUMN bank REAL DEFAULT 0'); // 번 몫 (#144): 방이 받아 준 줍기 × 더미 값. 버린 귤은 이 안에서

    if (!hadRank) this.sql.exec("INSERT OR IGNORE INTO rka (sub, srv, n) SELECT sub, 'battle', cleaned FROM acc WHERE cleaned > 0"); // 랭킹 전 치운 양은 전체로
    // #98: 깨끗한 오름 기록을 전투 오름 기록에 더하고 지움 (한 번 옮기면 clean 줄이 없어 다음엔 아무 일 없음)
    if (this.sql.exec("SELECT COUNT(*) AS n FROM rka WHERE srv = 'clean'").one().n || this.sql.exec("SELECT COUNT(*) AS n FROM rkd WHERE srv = 'clean'").one().n) {
      this.sql.exec("INSERT INTO rka (sub, srv, n) SELECT sub, 'battle', n FROM rka WHERE srv = 'clean' ON CONFLICT (sub, srv) DO UPDATE SET n = n + excluded.n");
      this.sql.exec("INSERT INTO rkd (sub, srv, d, n) SELECT sub, 'battle', d, n FROM rkd WHERE srv = 'clean' ON CONFLICT (sub, srv, d) DO UPDATE SET n = n + excluded.n");
      this.sql.exec("DELETE FROM rka WHERE srv = 'clean'"); this.sql.exec("DELETE FROM rkd WHERE srv = 'clean'");
    }
    // 철 이벤트 트리 (#180): 기간 동안 모두가 주운 수를 날마다 하나로 더함 (d = 한국 날 번호). 서버가 확인한 줍기만
    this.sql.exec('CREATE TABLE IF NOT EXISTS ssn (d INTEGER PRIMARY KEY, n INTEGER)');
    this.rkCache = new Map();
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
    return { nick: r.nick || '', rev: r.rev, save: r.save ? JSON.parse(r.save) : null, cleaned: r.cleaned, lastSeen: t, keepUntil: t + NET.keepDays * 864e5, isNew: !!r.isNew };
  }
  // 세션 확인 (#84): 계정이 있고, 토큰이 계정을 만든 뒤에 나왔고(지웠다 다시 만든 계정의 옛 토큰 거절), 버린 토큰이 아니어야 함
  auth(sub, iat, jti) {
    const r = this.sql.exec('SELECT created FROM acc WHERE sub = ?', sub).toArray()[0];
    if (!r || !(iat >= (r.created || 0))) return false;
    return !this.sql.exec('SELECT 1 AS x FROM rv WHERE j = ?', jti).toArray().length;
  }
  revoke(jti, exp) { this.sql.exec('INSERT OR REPLACE INTO rv (j, exp) VALUES (?, ?)', jti, exp); return { ok: true }; }
  get(sub) { const r = this.row(sub); return r ? this.view(r, r.last_seen) : null; }
  put(sub, save, { migrate = false, free = false } = {}) {
    const raw = JSON.stringify(save);
    if (raw.length > NET.saveMax) return { error: 'too big' };
    const t = Date.now();
    let r = this.row(sub); if (!r) { this.touch(sub); r = this.row(sub); }
    const prev = r.save ? JSON.parse(r.save) : null;
    const xday = xmasDay(t);
    const { save: S, fixed, acc } = checkSave(prev, save, { credit: r.credit, pickCredit: r.pick_credit, bank: r.bank, savedAt: r.saved_at }, t, { migrate: migrate && !prev, free, xday, treeDone: xday > 0 && this.seasonTotal(t) >= treeGoal() });
    const rev = (r.rev || 0) + 1;
    // 확인한 칸만 바꿔 넣고 나머지(설정·튜토리얼 등)는 받은 그대로
    const out = { ...save, ...S };
    this.sql.exec('UPDATE acc SET save = ?, nick = ?, rev = ?, cleaned = ?, credit = ?, pick_credit = ?, bank = ?, saved_at = ?, last_seen = ?, look = ? WHERE sub = ?',
      JSON.stringify(out), S.nick, rev, S.trash.total, acc.credit, acc.pickCredit, acc.bank, t, t, lookOf(out, hairOk), sub);
    // 랭킹 (#11): 서버가 확인한 치운 양이 늘어난 만큼만 더함 (서버는 전투 오름 하나, #98). 줄어든 것(처음부터 다시 등)은 빼지 않음
    const gain = S.trash.total - (prev ? (r.cleaned || 0) : 0);
    if (gain > 0) this.rankAdd(sub, 'battle', gain, t, migrate && !prev);
    const fix = {};
    if (fixed.length) { if (fixed.includes('coins') || fixed.includes('items')) fix.coins = S.coins; if (fixed.includes('items')) fix.reload = 1; if (fixed.includes('picked')) fix.total = S.trash.total; if (fixed.includes('mealFree')) fix.mealFree = 1; if (fixed.includes('season')) fix.season = S.season || null; }
    return { rev, fixed, fix, keepUntil: t + NET.keepDays * 864e5 };
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
    this.sql.exec('INSERT INTO rka (sub, srv, n) VALUES (?, ?, ?) ON CONFLICT (sub, srv) DO UPDATE SET n = n + excluded.n', sub, srv, n);
    if (!onlyAll) this.sql.exec('INSERT INTO rkd (sub, srv, d, n) VALUES (?, ?, ?, ?) ON CONFLICT (sub, srv, d) DO UPDATE SET n = n + excluded.n', sub, srv, kstDay(t), n);
    if (!onlyAll && xmasDay(t)) this.sql.exec('INSERT INTO ssn (d, n) VALUES (?, ?) ON CONFLICT (d) DO UPDATE SET n = n + excluded.n', kstDay(t), n); // 트리 (#180)
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
    if (!c || t - c.at > RANK.cacheMs) {
      const [q, a] = this.rankFrom(range, srv, t);
      const rows = this.sql.exec(`SELECT t.sub AS sub, t.s AS s, acc.nick AS nick, acc.look AS look FROM (${q}) t JOIN acc ON acc.sub = t.sub ORDER BY t.s DESC, acc.created ASC LIMIT ?`, ...a, RANK.top).toArray();
      const total = this.sql.exec(`SELECT COUNT(*) AS n FROM (${q})`, ...a).one().n;
      let rk = 0, last = -1; c = { at: t, total, rows: rows.map((r, i) => { if (r.s !== last) { rk = i + 1; last = r.s; } return { sub: r.sub, rank: rk, n: r.s, nick: r.nick || '', look: r.look || '' }; }) };
      this.rkCache.set(key, c);
      if (this.rkCache.size > 24) this.rkCache.delete(this.rkCache.keys().next().value);
    }
    const me = this.rankOf(sub, range, srv, t);
    return { range, srv, total: c.total, top: c.rows.map(({ sub: s, ...r }) => (s === sub ? { ...r, me: true } : r)), me };
  }
  // 내 순위만 (캐시 없이 바로): { rank (없으면 0), n }
  rankOf(sub, range, srv, t = Date.now()) {
    const [q, a] = this.rankFrom(range, srv, t);
    const mine = this.sql.exec(`SELECT s FROM (${q}) WHERE sub = ?`, ...a, sub).toArray()[0]?.s || 0;
    if (!mine) return { rank: 0, n: 0 };
    return { rank: 1 + this.sql.exec(`SELECT COUNT(*) AS n FROM (${q}) WHERE s > ?`, ...a, mine).one().n, n: mine };
  }
  rankMe(sub, srv, t = Date.now()) { return { srv, day: this.rankOf(sub, 'day', srv, t), week: this.rankOf(sub, 'week', srv, t), all: this.rankOf(sub, 'all', srv, t) }; }
  del(sub) { this.sql.exec('DELETE FROM acc WHERE sub = ?', sub); this.sql.exec('DELETE FROM rkd WHERE sub = ?', sub); this.sql.exec('DELETE FROM rka WHERE sub = ?', sub); this.rkCache.clear(); return { ok: true }; }
  purge(cutoff) {
    this.sql.exec('DELETE FROM rv WHERE exp < ?', Date.now());
    const n = this.sql.exec('SELECT COUNT(*) AS n FROM acc WHERE last_seen < ?', cutoff).one().n; this.sql.exec('DELETE FROM acc WHERE last_seen < ?', cutoff);
    this.sql.exec('DELETE FROM rkd WHERE d < ? OR sub NOT IN (SELECT sub FROM acc)', kstDay() - RANK.dayKeep); this.sql.exec('DELETE FROM rka WHERE sub NOT IN (SELECT sub FROM acc)'); this.rkCache.clear();
    return n;
  }
  count() { return this.sql.exec('SELECT COUNT(*) AS n FROM acc').one().n; }
}
