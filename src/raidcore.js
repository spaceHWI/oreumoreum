// 오름 레이드 규칙 (#181): 시각·시작·끝·기운·더미·기여·보상. 수치는 balance.js RAID
// 서버 방(server/src/roomcore.js)이 쓰고, 서버가 없으면(혼자·손님·서버 꺼짐) 내 화면(game/raid.js)이 같은 코드를 씀 → 셈이 한곳
// 받는 것: join(id) 레이드 자리에 왔음 · hit(id, d) 피해 · pick(id, i) 더미 i 에서 하나 · start(force) 확인용 바로 열기
// 보내는 것(send 가 받음): rv 상태 [번호, 단계, 시작 ms, 끝 ms, 기운, 최대, 참가 수, 부서짐 끝 ms] + h(부서진 동안 더미 남은 수) · rw 보상(참가자마다)
// 단계: 0 없음 · 1 곧(lead 초 전부터) · 2 싸움 · 3 부서짐(더미 줍기) · 4 성공 · 5 실패
import { RAID as R } from './balance.js';

export const RAID_PH = { idle: 0, soon: 1, on: 2, broke: 3, won: 4, lost: 5 };
const P = RAID_PH;
export const kstDay = (t) => new Date(t + 9 * 3600e3).toISOString().slice(0, 10);
// t 뒤(지금 열려 있는 것 포함)로 가장 가까운 시작 시각 (ms)
export function nextRaidAt(t, after = 0) {
  const k = new Date(t + 9 * 3600e3), y = k.getUTCFullYear(), m = k.getUTCMonth(), d = k.getUTCDate();
  let best = Infinity;
  for (let dd = 0; dd < 2; dd++) for (const [h, mi] of R.times) {
    const at = Date.UTC(y, m, d + dd, h, mi) - 9 * 3600e3;
    if (at + R.limit * 1000 > t && at > after && at < best) best = at;
  }
  return best;
}
// 부서진 더미 자리: 번호로 정해져 모두 같음 (가운데 둘레 고리)
export function raidHeapSpots(id, cx, cz) {
  const out = []; let s = (id * 9301 + 49297) % 233280;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < R.heaps; i++) { const a = (i / R.heaps) * Math.PI * 2 + rnd() * 0.5, r = R.spread * (0.55 + rnd() * 0.45); out.push([cx + Math.sin(a) * r, cz + Math.cos(a) * r]); }
  return out;
}

// now(): ms, send(id|null, obj): id 없으면 모두에게, who(id) → { acct, nick, here }
export function createRaid({ now = () => Date.now(), send, who = () => ({}) } = {}) {
  let id = 0, ph = P.idle, at = nextRaidAt(now()), end = 0, hp = 0, max = 0, n = 1, broke = 0, heaps = null, doneAt = 0, lastAt = 0, sentT = 0, dirty = false;
  const pay = [], joined = new Set(), C = new Map(), tok = new Map(), wins = new Map(); // wins: 계정(없으면 id) → { day, n }
  const state = () => ({ t: 'rv', s: [id, ph, at, end, Math.ceil(hp), Math.round(max), n, broke], ...(ph === P.broke && heaps ? { h: heaps.slice() } : {}) });
  const push = (force) => { const t = now(); if (!force && t - sentT < R.stateMs) { dirty = true; return; } sentT = t; dirty = false; send(null, state()); };
  const reset = () => { joined.clear(); C.clear(); tok.clear(); heaps = null; broke = 0; };
  function begin(t) {
    ph = P.on; end = t + R.limit * 1000; n = Math.max(1, joined.size); max = R.hp1 * Math.max(1, n * R.perK); hp = max; push(true);
  }
  function rescale(k) { const f = max > 0 ? hp / max : 1; n = k; max = R.hp1 * Math.max(1, n * R.perK); hp = f * max; }
  function finish(t, won) {
    ph = won ? P.won : P.lost; doneAt = t; lastAt = at;
    if (won) {
      const day = kstDay(t), list = [...C].filter(([pid, c]) => (c.d > 0 || c.p > 0) && who(pid).here !== false);
      const score = (c) => c.d + c.p * 60;
      const top = list.slice().sort((a, b) => score(b[1]) - score(a[1])).slice(0, R.top).map(([pid]) => who(pid).nick || '누군가');
      for (const [pid] of list) {
        const w = who(pid), key = w.acct || pid, rec = wins.get(key);
        const cnt = rec && rec.day === day ? rec.n : 0;
        if (cnt >= R.times.length) { send(pid, { t: 'rw', g: 0, box: 0, xp: 0, top, cap: 1 }); continue; } // 하루 상한 (확인용으로 여러 번 열어도 귤을 더 받지 않음)
        const box = cnt === 0 ? R.box : 0, g = R.gyul + box;
        wins.set(key, { day, n: cnt + 1 });
        pay.push({ pid, acct: w.acct || null, g });
        send(pid, { t: 'rw', g, box, xp: R.xp, top });
      }
    }
    push(true);
  }
  return {
    // 매 틱
    tick() {
      const t = now();
      if (ph === P.idle && t >= at - R.lead * 1000) { id++; ph = P.soon; reset(); push(true); }
      if (ph === P.soon && t >= at) begin(t);
      if (ph === P.on && t >= end) finish(t, false);
      if (ph === P.broke) { if (t >= end) finish(t, false); else if (t >= broke) { ph = P.on; hp = max * R.reform; heaps = null; broke = 0; push(true); } }
      if ((ph === P.won || ph === P.lost) && t - doneAt > 15000) { ph = P.idle; at = nextRaidAt(t, lastAt); push(true); }
      if (dirty) push(false);
    },
    join(pid) { if (ph < P.soon || ph > P.broke || joined.has(pid)) return; joined.add(pid); if (ph >= P.on && joined.size > n) { rescale(joined.size); push(false); } },
    leave(pid) { joined.delete(pid); tok.delete(pid); },
    hit(pid, d) {
      if (ph !== P.on || !(typeof d === 'number' && d > 0 && Number.isFinite(d))) return;
      const t = now(), b = tok.get(pid) || { v: R.dpsBurst, t }; b.v = Math.min(R.dpsBurst, b.v + (t - b.t) / 1000 * R.dps); b.t = t; tok.set(pid, b);
      const got = Math.min(d, b.v, hp); if (got <= 0) return; b.v -= got; hp -= got;
      const c = C.get(pid) || { d: 0, p: 0, pt: 0, pv: R.pickPerSec }; c.d += got; C.set(pid, c); joined.add(pid);
      if (hp <= 0.001) { hp = 0; ph = P.broke; heaps = new Array(R.heaps).fill(R.heapN); broke = Math.min(end, t + R.breakSec * 1000); push(true); } else push(false);
    },
    pick(pid, i) {
      if (ph !== P.broke || !heaps || !(i >= 0 && i < heaps.length) || heaps[i] <= 0) return false;
      const t = now(), c = C.get(pid) || { d: 0, p: 0, pt: t, pv: R.pickPerSec };
      c.pv = Math.min(R.pickPerSec, c.pv + (t - (c.pt || t)) / 1000 * R.pickPerSec); c.pt = t; if (c.pv < 1) { C.set(pid, c); return false; }
      c.pv--; c.p++; C.set(pid, c); joined.add(pid); heaps[i]--;
      if (heaps.every((v) => v <= 0)) finish(t, true); else push(false);
      return true;
    },
    start(force) { const t = now(); if (!force && ph >= P.soon && ph <= P.broke) return false; at = t + 5000; ph = P.idle; doneAt = 0; reset(); return true; }, // 확인용: 5초 뒤 시작 (다음 틱에 '곧'). force: 앞 확인이 남긴 레이드(싸움 중·부서짐)도 지우고 새로 (#245, STATS_OPEN 방만)
    takePaid() { return pay.splice(0); }, // 성공 보상 [{pid, acct, g}]: 방이 번 몫(#144 bank)에 넣음
    state, get ph() { return ph; }, get hp() { return hp; }, get max() { return max; }, get id() { return id; },
    contrib: (pid) => ({ ...(C.get(pid) || { d: 0, p: 0 }) }),
  };
}
