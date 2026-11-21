// 돌탑 소원 글·함께 기도 (#127): 계정 DO(accounts.js) 안의 SQLite 를 같이 씀. 값은 src/balance.js WISH
// - 쓰기: 로그인한 사람만. 돌탑마다 한 사람 하나(다시 쓰면 바뀜), 하루 WISH.editPerDay 번. 걸러서(cleanText + wishBad) 걸리면 저장하지 않음
// - 읽기·기도·신고: 손님도 (손님은 'ip:<주소 해시>' 로 셈). 숨긴 글(신고 WISH.reportHide 명)은 쓴 사람 말고는 안 보임
// - 기도한 사람 귤: 로그인이면 계정 bank(#144 번 몫)에 더함 → 다음 저장에서 그 귤을 받아 줌 (#188 '서버가 그 몫을 앎'). 손님은 기기에만
// - 쓴 사람 귤: 기도 받은 수를 모아 두었다가(unseen) 다음에 들어올 때 /wish/news 로 한 번에 (하루 상한), 역시 bank 에
// - 지우기: 쓴 뒤 WISH.keepDays 일 (Cron purge), 돌탑마다 최근 WISH.perCairn 개
import { NET, WISH } from '../../src/balance.js';
import { cleanText, nickBad, wishBad } from '../../src/safetext.js';
import { kstDay } from '../../src/rankday.js';

export const CID_RE = /^[a-z0-9-]{1,40}$/;

export function wishInit(sql) {
  sql.exec(`CREATE TABLE IF NOT EXISTS wish (id INTEGER PRIMARY KEY AUTOINCREMENT, cid TEXT, sub TEXT, nick TEXT, text TEXT, at INTEGER,
    n INTEGER DEFAULT 0, unseen INTEGER DEFAULT 0, rep INTEGER DEFAULT 0, hid INTEGER DEFAULT 0, UNIQUE (cid, sub))`);
  sql.exec('CREATE INDEX IF NOT EXISTS wish_ca ON wish (cid, at)');
  sql.exec('CREATE INDEX IF NOT EXISTS wish_sub ON wish (sub)');
  sql.exec('CREATE TABLE IF NOT EXISTS wedit (sub TEXT, cid TEXT, d INTEGER, n INTEGER, PRIMARY KEY (sub, cid))'); // 하루 쓰기 수
  sql.exec('CREATE TABLE IF NOT EXISTS wrl (sub TEXT PRIMARY KEY, t INTEGER, n INTEGER)'); // 1분 쓰기 요청 수
  sql.exec('CREATE TABLE IF NOT EXISTS wpray (wid INTEGER, who TEXT, d INTEGER, PRIMARY KEY (wid, who))'); // 같은 소원에 하루 한 번
  sql.exec('CREATE TABLE IF NOT EXISTS wday (who TEXT, k TEXT, d INTEGER, n INTEGER, PRIMARY KEY (who, k))'); // 하루 귤 상한: k = 'pray'(기도한 사람)·'got'(쓴 사람)
  sql.exec('CREATE TABLE IF NOT EXISTS wrep (wid INTEGER, who TEXT, PRIMARY KEY (wid, who))');
}

const dayCount = (sql, who, k, d) => { const r = sql.exec('SELECT d, n FROM wday WHERE who = ? AND k = ?', who, k).toArray()[0]; return r && r.d === d ? r.n : 0; };
const dayAdd = (sql, who, k, d, n) => sql.exec('INSERT INTO wday (who, k, d, n) VALUES (?, ?, ?, ?) ON CONFLICT (who, k) DO UPDATE SET n = CASE WHEN d = excluded.d THEN n + excluded.n ELSE excluded.n END, d = excluded.d', who, k, d, n);
const toBank = (sql, sub, v) => { if (v > 0) sql.exec('UPDATE acc SET bank = MIN(?, COALESCE(bank, 0) + ?) WHERE sub = ?', NET.earnBankMax, v, sub); };
const view = (r, me, prayed) => ({ id: r.id, nick: r.nick || '', text: r.text, at: r.at, n: r.n, ...(r.sub === me ? { mine: true, ...(r.hid ? { hid: true } : {}) } : {}), ...(prayed.has(r.id) ? { prayed: true } : {}) });

// 돌탑 하나의 소원: 최근 순 WISH.perCairn 개. me = 로그인 sub 또는 'ip:…'
export function wishList(sql, cid, me, t = Date.now()) {
  if (!CID_RE.test(cid)) return { error: 'cairn' };
  const rows = sql.exec('SELECT id, sub, nick, text, at, n, hid FROM wish WHERE cid = ? AND at > ? AND (hid = 0 OR sub = ?) ORDER BY at DESC LIMIT ?', cid, t - WISH.keepDays * 864e5, me, WISH.perCairn).toArray();
  const d = kstDay(t), prayed = new Set(sql.exec('SELECT wid FROM wpray WHERE who = ? AND d = ? AND wid IN (SELECT id FROM wish WHERE cid = ?)', me, d, cid).toArray().map((r) => r.wid));
  return { cid, list: rows.map((r) => view(r, me, prayed)) };
}

// 쓰기·고치기·지우기(빈 글). → { ok, wish } 또는 { error: bad|link|day|slow|cairn|no account }
export function wishPut(sql, sub, cid, raw, t = Date.now()) {
  if (!CID_RE.test(cid)) return { error: 'cairn' };
  const acc = sql.exec('SELECT nick FROM acc WHERE sub = ?', sub).toArray()[0]; if (!acc) return { error: 'no account' };
  const rl = sql.exec('SELECT t, n FROM wrl WHERE sub = ?', sub).toArray()[0];
  if (rl && t - rl.t < 60e3 && rl.n >= WISH.writePerMin) return { error: 'slow' };
  sql.exec('INSERT OR REPLACE INTO wrl (sub, t, n) VALUES (?, ?, ?)', sub, rl && t - rl.t < 60e3 ? rl.t : t, rl && t - rl.t < 60e3 ? rl.n + 1 : 1);
  const text = cleanText(typeof raw === 'string' ? raw : '', WISH.max);
  if (text) { const b = wishBad(text); if (b) return { error: b }; }
  const d = kstDay(t), ed = sql.exec('SELECT d, n FROM wedit WHERE sub = ? AND cid = ?', sub, cid).toArray()[0], used = ed && ed.d === d ? ed.n : 0;
  const old = sql.exec('SELECT id, text FROM wish WHERE cid = ? AND sub = ?', cid, sub).toArray()[0];
  if (!text && !old) return { ok: true, wish: null };
  if (old && old.text === text) return { ok: true, wish: wishList(sql, cid, sub, t).list.find((w) => w.mine) || null }; // 같은 글: 셈하지 않음
  if (used >= WISH.editPerDay) return { error: 'day', left: 0 };
  sql.exec('INSERT INTO wedit (sub, cid, d, n) VALUES (?, ?, ?, 1) ON CONFLICT (sub, cid) DO UPDATE SET n = CASE WHEN d = excluded.d THEN n + 1 ELSE 1 END, d = excluded.d', sub, cid, d);
  if (old) { sql.exec('DELETE FROM wrep WHERE wid = ?', old.id); sql.exec('DELETE FROM wpray WHERE wid = ?', old.id); }
  if (!text) { sql.exec('DELETE FROM wish WHERE id = ?', old.id); return { ok: true, wish: null, left: WISH.editPerDay - used - 1 }; }
  const nick = cleanText(acc.nick || '', NET.nickMax), nk = nickBad(nick) ? '' : nick;
  // 새 글은 기도·신고를 0 부터 (unseen 은 쓴 사람이 아직 못 받은 몫이라 그대로 둠)
  if (old) sql.exec('UPDATE wish SET text = ?, nick = ?, at = ?, n = 0, rep = 0, hid = 0 WHERE id = ?', text, nk, t, old.id);
  else sql.exec('INSERT INTO wish (cid, sub, nick, text, at) VALUES (?, ?, ?, ?, ?)', cid, sub, nk, text, t);
  sql.exec('DELETE FROM wish WHERE cid = ? AND id NOT IN (SELECT id FROM wish WHERE cid = ? ORDER BY at DESC LIMIT ?)', cid, cid, WISH.perCairn);
  return { ok: true, wish: wishList(sql, cid, sub, t).list.find((w) => w.mine) || null, left: WISH.editPerDay - used - 1 };
}

// 함께 기도: 같은 소원에 하루 한 번, 내 소원은 안 됨. → { ok, n, gyul } (gyul: 이번에 받는 귤. 로그인이면 bank 에도 더함)
export function wishPray(sql, who, id, { login = false } = {}, t = Date.now()) {
  const w = sql.exec('SELECT id, sub, n, hid FROM wish WHERE id = ? AND at > ?', id, t - WISH.keepDays * 864e5).toArray()[0];
  if (!w || w.hid) return { error: 'gone' };
  if (w.sub === who) return { error: 'mine' };
  const d = kstDay(t), p = sql.exec('SELECT d FROM wpray WHERE wid = ? AND who = ?', id, who).toArray()[0];
  if (p && p.d === d) return { error: 'today', n: w.n };
  sql.exec('INSERT OR REPLACE INTO wpray (wid, who, d) VALUES (?, ?, ?)', id, who, d);
  sql.exec('UPDATE wish SET n = n + 1, unseen = unseen + 1 WHERE id = ?', id);
  const got = dayCount(sql, who, 'pray', d), gyul = got < WISH.prayPerDay ? WISH.prayGyul : 0;
  if (gyul) { dayAdd(sql, who, 'pray', d, 1); if (login) toBank(sql, who, gyul); }
  return { ok: true, n: w.n + 1, gyul, left: Math.max(0, WISH.prayPerDay - got - (gyul ? 1 : 0)) };
}

// 내 돌탑 소식: 지난번 뒤 받은 기도 수와 귤 (하루 WISH.gotPerDay 기도까지 셈, 넘는 몫은 수만). 귤은 bank 에
export function wishNews(sql, sub, t = Date.now()) {
  const n = sql.exec('SELECT COALESCE(SUM(unseen), 0) AS n FROM wish WHERE sub = ?', sub).one().n;
  if (!n) return { n: 0, gyul: 0 };
  sql.exec('UPDATE wish SET unseen = 0 WHERE sub = ?', sub);
  const d = kstDay(t), k = Math.max(0, Math.min(n, WISH.gotPerDay - dayCount(sql, sub, 'got', d))), gyul = k * WISH.gotGyul;
  if (k) { dayAdd(sql, sub, 'got', d, k); toBank(sql, sub, gyul); }
  return { n, gyul };
}

// 신고: 서로 다른 WISH.reportHide 명이면 숨김. 내 소원은 안 됨. → { ok, hid }
export function wishReport(sql, who, id, t = Date.now()) {
  const w = sql.exec('SELECT id, sub, hid FROM wish WHERE id = ? AND at > ?', id, t - WISH.keepDays * 864e5).toArray()[0];
  if (!w) return { error: 'gone' };
  if (w.sub === who) return { error: 'mine' };
  sql.exec('INSERT OR IGNORE INTO wrep (wid, who) VALUES (?, ?)', id, who);
  const rep = sql.exec('SELECT COUNT(*) AS n FROM wrep WHERE wid = ?', id).one().n, hid = w.hid || rep >= WISH.reportHide ? 1 : 0;
  sql.exec('UPDATE wish SET rep = ?, hid = ? WHERE id = ?', rep, hid, id);
  return { ok: true, hid: !!hid };
}

// 어드민: 신고된 소원 (숨긴 것 먼저). act: del(지우기)·show(되살리기: 신고 기록도 지움)
export function wishReported(sql, k = 200) {
  return sql.exec('SELECT id, cid, sub, nick, text, at, n, rep, hid FROM wish WHERE rep > 0 OR hid = 1 ORDER BY hid DESC, rep DESC, at DESC LIMIT ?', k).toArray();
}
export function wishAdmin(sql, id, act) {
  const w = sql.exec('SELECT id FROM wish WHERE id = ?', id).toArray()[0]; if (!w) return { error: 'gone' };
  if (act === 'del') { sql.exec('DELETE FROM wish WHERE id = ?', id); sql.exec('DELETE FROM wrep WHERE wid = ?', id); sql.exec('DELETE FROM wpray WHERE wid = ?', id); return { ok: true }; }
  if (act === 'show') { sql.exec('UPDATE wish SET hid = 0, rep = 0 WHERE id = ?', id); sql.exec('DELETE FROM wrep WHERE wid = ?', id); return { ok: true }; }
  return { error: 'act' };
}

// 날마다 (Cron): 오래된 소원·기록, 지운 계정의 소원
export function wishPurge(sql, t = Date.now()) {
  const cut = t - WISH.keepDays * 864e5, d = kstDay(t);
  sql.exec('DELETE FROM wish WHERE at < ? OR sub NOT IN (SELECT sub FROM acc)', cut);
  sql.exec('DELETE FROM wrep WHERE wid NOT IN (SELECT id FROM wish)');
  sql.exec('DELETE FROM wpray WHERE d < ? OR wid NOT IN (SELECT id FROM wish)', d - 1);
  sql.exec('DELETE FROM wday WHERE d < ?', d - 1); sql.exec('DELETE FROM wedit WHERE d < ?', d - 1); sql.exec('DELETE FROM wrl WHERE t < ?', t - 120e3);
}
