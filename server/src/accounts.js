// 계정 저장 (#7): Durable Object 하나(이름 'all') 안의 SQLite. 칸은 sub·닉네임·게임 저장·치운 양·접속 시각뿐
import { DurableObject } from 'cloudflare:workers';
import { NET } from '../../src/balance.js';
import { checkSave } from './validate.js';

export class Accounts extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS acc (
      sub TEXT PRIMARY KEY, nick TEXT, save TEXT, rev INTEGER DEFAULT 0, cleaned INTEGER DEFAULT 0,
      credit REAL, pick_credit REAL, saved_at INTEGER, last_seen INTEGER, created INTEGER)`);
  }
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
  get(sub) { const r = this.row(sub); return r ? this.view(r, r.last_seen) : null; }
  put(sub, save, { migrate = false } = {}) {
    const raw = JSON.stringify(save);
    if (raw.length > NET.saveMax) return { error: 'too big' };
    const t = Date.now();
    let r = this.row(sub); if (!r) { this.touch(sub); r = this.row(sub); }
    const prev = r.save ? JSON.parse(r.save) : null;
    const { save: S, fixed, acc } = checkSave(prev, save, { credit: r.credit, pickCredit: r.pick_credit, savedAt: r.saved_at }, t, { migrate: migrate && !prev });
    const rev = (r.rev || 0) + 1;
    // 확인한 칸만 바꿔 넣고 나머지(설정·튜토리얼 등)는 받은 그대로
    const out = { ...save, ...S };
    this.sql.exec('UPDATE acc SET save = ?, nick = ?, rev = ?, cleaned = ?, credit = ?, pick_credit = ?, saved_at = ?, last_seen = ? WHERE sub = ?',
      JSON.stringify(out), S.nick, rev, S.trash.total, acc.credit, acc.pickCredit, t, t, sub);
    const fix = {};
    if (fixed.length) { if (fixed.includes('coins') || fixed.includes('items')) fix.coins = S.coins; if (fixed.includes('items')) fix.reload = 1; if (fixed.includes('picked')) fix.total = S.trash.total; }
    return { rev, fixed, fix, keepUntil: t + NET.keepDays * 864e5 };
  }
  del(sub) { this.sql.exec('DELETE FROM acc WHERE sub = ?', sub); return { ok: true }; }
  purge(cutoff) { const n = this.sql.exec('SELECT COUNT(*) AS n FROM acc WHERE last_seen < ?', cutoff).one().n; this.sql.exec('DELETE FROM acc WHERE last_seen < ?', cutoff); return n; }
  count() { return this.sql.exec('SELECT COUNT(*) AS n FROM acc').one().n; }
}
