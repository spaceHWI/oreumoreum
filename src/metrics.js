// 이용 통계 (#121): 누구인지 모르는 합계만. 메모리에 숫자만 세다가 묶음 하나로 보낸다 (다시 보내지 않음)
// - mt(키, 값, 횟수): 더하기만. 프레임 안에서도 부를 수 있음 (mtFrame 은 프레임 수 하나 더하기)
// - 보내기(mtFlush)는 game/metrics.js 가 METRICS.flushS 마다·나갈 때 부름. 서버 POST /m (server/src/metrics.js)
// - 계정 번호·닉네임·좌표는 넣지 않음. 출처(src)만: live · dev · adm
import { METRICS } from './balance.js';

const C = new Map(); // 키 → [합, 횟수]
const SUB_RE = /[^a-z0-9._-]+/g;
let frames = 0;
export const mtKey = (base, sub) => (sub == null ? base : base + ':' + (String(sub).toLowerCase().replace(SUB_RE, '-').slice(0, 40) || 'x'));
export function mt(k, v = 1, n = 1) {
  if (!(v >= 0) || !Number.isFinite(v)) return;
  const e = C.get(k); if (e) { e[0] += v; e[1] += n; } else C.set(k, [v, n]);
}
export function mtMax(k, v) { const e = C.get(k); if (!e) C.set(k, [v, 1]); else if (v > e[0]) e[0] = v; }
export const mtFrame = () => { frames++; };
export const mtFrames = () => frames;
export const mtPeek = () => Object.fromEntries([...C].map(([k, [s, n]]) => [k, [Math.round(s * 100) / 100, n]]));

// 묶음 글: { v: 1, s: 출처, c: { 키: 합 | [합, 횟수] } }. maxBytes 를 넘는 키는 버림
export function mtBody(src) {
  if (!C.size) return null;
  const c = {}; let len = 30, k = 0;
  for (const [key, [s, n]] of C) {
    const v = Math.round(s * 100) / 100, val = n === 1 ? v : [v, n];
    const add = JSON.stringify(key).length + JSON.stringify(val).length + 2;
    if (len + add > METRICS.maxBytes || ++k > METRICS.maxKeys) break;
    c[key] = val; len += add;
  }
  C.clear();
  return JSON.stringify({ v: 1, s: src, c });
}
// 보내기: sendBeacon(안 되면 keepalive fetch). text/plain 이라 미리 묻기(preflight) 없음. 실패해도 다시 안 보냄
let sent = { n: 0, bytes: 0 };
export const mtSent = () => ({ ...sent });
export function mtFlush(url, src) {
  const body = mtBody(src); if (!body || !url) return false;
  sent.n++; sent.bytes += body.length;
  try { if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }))) return true; } catch (e) { /* 아래로 */ }
  try { fetch(url, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'text/plain' } }).catch(() => {}); } catch (e) { /* 버림 */ }
  return true;
}
