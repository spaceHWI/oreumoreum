// 오류 알림 묶어 보기 (#122): GET /crashes?days=3 → 같은 오류끼리 묶은 목록 (로그인 없이, 예약 작업이 읽음)
// - 받은 의견 표(fb) 중 kind 'crash' 인 것만. crash.js 가 보내는 칸(버전·기기 종류·오류 글·마지막 한 일·브라우저/OS 이름)만 내보냄
// - 닉네임·좌표·IP 해시·사용자가 쓴 의견 글은 절대 내보내지 않음 (DO 에서 이 칸만 꺼내고, 여기서 cleanText 로 한 번 더 거름)
// - 묶는 기준: 버전 + 오류 글(숫자·해시는 # 로 뭉갬). 많은 순 CRASHES.groups 묶음까지
import { CRASHES } from '../../src/balance.js';
import { cleanText } from '../../src/safetext.js';

const UA_RE = /^(iOS|Android|Mac|Windows|Linux|\?)( [^ ]+)? (Chrome|Safari|Samsung|Firefox|\?)/;
// crash.js 의 글: '[오류 where] 오류 글 @ 자리 · 마지막: a / b / c · iOS 17 Safari 17'
export function splitCrash(text) {
  let s = String(text || ''), ua = '?', acts = [];
  const u = s.lastIndexOf(' · ');
  if (u >= 0 && UA_RE.test(s.slice(u + 3))) { ua = s.slice(u + 3); s = s.slice(0, u); }
  const m = s.indexOf(' · 마지막: ');
  if (m >= 0) { acts = s.slice(m + 8).split(' / ').filter(Boolean); s = s.slice(0, m); }
  return { err: s, acts, ua };
}
// 숫자·해시를 뭉갠 오류 글 (같은 오류의 줄·칸·해시가 달라도 한 묶음)
export const squash = (s) => String(s).replace(/\b[0-9a-f]{6,}\b/gi, '#').replace(/\d+/g, '#');
const devOf = (d) => (d === 'phone' ? 'phone' : d === 'tablet' ? 'tablet' : 'pc');
const keyOf = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); };

// rows: [{ at, text, ver, dev }] (최근 것부터) → 묶음 목록 (많은 순)
export function groupCrashes(rows) {
  const g = new Map();
  for (const r of rows) {
    const ver = cleanText(r.ver, 20) || '?';
    const { err, acts, ua } = splitCrash(cleanText(r.text, 600));
    const k = ver + '|' + squash(err);
    let o = g.get(k);
    if (!o) { o = { key: keyOf(k), text: cleanText(err, CRASHES.textMax), ver, n: 0, first: r.at, last: r.at, dev: { phone: 0, tablet: 0, pc: 0 }, uaN: new Map(), acts: acts.map((a) => cleanText(a, 70)).slice(-CRASHES.acts) }; g.set(k, o); }
    o.n++;
    if (r.at < o.first) o.first = r.at;
    if (r.at > o.last) { o.last = r.at; o.text = cleanText(err, CRASHES.textMax); o.acts = acts.map((a) => cleanText(a, 70)).slice(-CRASHES.acts); }
    o.dev[devOf(r.dev)]++;
    const u = cleanText(ua, 40) || '?'; o.uaN.set(u, (o.uaN.get(u) || 0) + 1);
  }
  return [...g.values()].sort((a, b) => b.n - a.n || b.last - a.last).slice(0, CRASHES.groups).map(({ uaN, ...o }) => ({
    ...o, ua: [...uaN].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([u]) => u),
  }));
}
