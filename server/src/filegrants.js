// 귤 보내기 목록 (#215): server/grants.json 의 줄을 id 마다 한 번만 운영자 귤 보내기(#188 gift 표)로 넣음
// 기획 세션이 파일에 한 줄 더해 dev 에 올리면 서버 배포 때 번들에 실리고, 배포 뒤 계정 저장·접속 때 돈다
// 받는 이: to.sub(계정 번호)가 있으면 그것, 없으면 to.nick. 같은 닉네임이 여럿이면 to.lv 로 하나를 고르고, 못 고르면 보류(다시 보내지 않음)
// 상태(fgrant.st): sent 보냄 · hold 보류(여럿이라) · wait 기다림(받는 이 없음·하루 상한·줄이 잘못됨, 다음에 다시 봄)
import { NET } from '../../src/balance.js';
import { levelOf } from '../../src/augments.js';
import { cleanText } from '../../src/safetext.js';
import { kstDay } from '../../src/rankday.js';

export function fgInit(sql) {
  sql.exec('CREATE TABLE IF NOT EXISTS fgrant (id TEXT PRIMARY KEY, at INTEGER, st TEXT, why TEXT, sub TEXT, nick TEXT, n INTEGER, gift INTEGER, d INTEGER, note TEXT)');
  sql.exec('CREATE INDEX IF NOT EXISTS acc_nick ON acc (nick)');
}

// 파일 한 줄을 고른 값으로. 틀린 줄은 { id, bad }
export function fgClean(g) {
  const id = typeof g?.id === 'string' && /^[0-9A-Za-z_.-]{1,60}$/.test(g.id) ? g.id : '';
  const n = Number(g?.n), to = g?.to && typeof g.to === 'object' ? g.to : {};
  const sub = typeof to.sub === 'string' && /^[0-9A-Za-z_-]{1,80}$/.test(to.sub) ? to.sub : '';
  const nick = typeof to.nick === 'string' ? cleanText(to.nick, 24) : '';
  const lv = Number.isInteger(to.lv) && to.lv > 0 ? to.lv : 0;
  const why = cleanText(g?.why, 60) || '운영자 선물';
  if (!id) return null;
  if (!(Number.isInteger(n) && n >= 1)) return { id, bad: 'n' };
  if (n > NET.grantFileMax) return { id, bad: 'max' };
  if (!sub && !nick) return { id, bad: 'to' };
  return { id, n, sub, nick, lv, why };
}

const lvOf = (raw) => { try { const s = JSON.parse(raw || 'null'); return levelOf(Number(s?.lv?.xp) || 0).lv; } catch (e) { return 0; } };

// 받는 이 고르기 → { sub } | { why: 'none'|'many' }. 저장이 있는 계정만 (손님 저장은 서버 계정이 아님)
function pick(sql, g) {
  if (g.sub) return sql.exec('SELECT 1 AS x FROM acc WHERE sub = ? AND save IS NOT NULL', g.sub).toArray().length ? { sub: g.sub } : { why: 'none' };
  const rows = sql.exec('SELECT sub, save FROM acc WHERE nick = ? AND save IS NOT NULL LIMIT 50', g.nick).toArray();
  if (!rows.length) return { why: 'none' };
  if (rows.length === 1) return { sub: rows[0].sub }; /* 하나뿐이면 레벨은 보지 않음 (그새 올랐을 수 있음) */
  if (!g.lv) return { why: 'many' };
  const lvs = rows.map((r) => ({ sub: r.sub, lv: lvOf(r.save) }));
  const eq = lvs.filter((r) => r.lv === g.lv);
  if (eq.length === 1) return { sub: eq[0].sub };
  const ge = lvs.filter((r) => r.lv >= g.lv);
  if (!eq.length && ge.length === 1) return { sub: ge[0].sub };
  return { why: 'many' };
}

// 목록 한 바퀴. grant(sub, n, why, by) 는 Accounts.grant (#188 과 같은 길)
export function fgRun(sql, list, grant, t = Date.now()) {
  if (!Array.isArray(list) || !list.length) return 0;
  const done = new Map(sql.exec('SELECT id, st FROM fgrant').toArray().map((r) => [r.id, r.st]));
  const d = kstDay(t);
  let dayUsed = sql.exec("SELECT COALESCE(SUM(n), 0) AS s FROM fgrant WHERE st = 'sent' AND d = ?", d).one().s, sent = 0;
  const seen = new Set();
  const put = (g, st, note, sub = null, gift = null) => sql.exec('INSERT OR REPLACE INTO fgrant (id, at, st, why, sub, nick, n, gift, d, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    g.id, t, st, g.why || '', sub, g.nick || '', g.n || 0, gift, st === 'sent' ? d : null, note);
  for (const raw of list.slice(0, 500)) {
    const g = fgClean(raw);
    if (!g || seen.has(g.id)) continue;
    seen.add(g.id);
    const st = done.get(g.id);
    if (st === 'sent' || st === 'hold') continue;
    if (g.bad) { put(g, 'wait', 'bad:' + g.bad); continue; }
    const p = pick(sql, g);
    if (!p.sub) { put(g, p.why === 'many' ? 'hold' : 'wait', p.why); continue; }
    if (dayUsed + g.n > NET.grantFileDay) { put(g, 'wait', 'day', p.sub); continue; }
    const r = grant(p.sub, g.n, g.why, 'file:' + g.id);
    if (!r?.ok) { put(g, 'wait', 'none'); continue; }
    put(g, 'sent', '', p.sub, r.id); dayUsed += g.n; sent++;
  }
  return sent;
}

// 어드민 화면: 파일로 보낸 것 (id·받는 이·상태). 받았는지는 gift 표에서
export function fgList(sql, k = 100) {
  return sql.exec('SELECT fgrant.id AS id, fgrant.at AS at, st, fgrant.why AS why, fgrant.sub AS sub, COALESCE(acc.nick, fgrant.nick) AS nick, fgrant.n AS n, note, gift.got AS got FROM fgrant LEFT JOIN acc ON acc.sub = fgrant.sub LEFT JOIN gift ON gift.id = fgrant.gift ORDER BY fgrant.at DESC LIMIT ?', k).toArray();
}
