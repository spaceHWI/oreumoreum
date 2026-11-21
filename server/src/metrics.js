// 이용 통계 받기 (#121): 클라이언트 묶음(src/metrics.js mtBody)을 확인해 [키, 합, 횟수] 줄로. 저장·합치기는 accounts.js metricsAdd
// - 정해진 키(METRICS.keys)와 '이름:갈래'(METRICS.sub)만. 값은 0 ~ maxV, 횟수 0 ~ maxN 정수. 키 수 maxKeys 까지
import { METRICS } from '../../src/balance.js';

const KEYS = new Set(METRICS.keys), SUB = new Set(METRICS.sub);
const KEY_RE = /^([a-z0-9]{1,12})(?::([a-z0-9._-]{1,40}))?$/;
export const isMaxKey = (k) => METRICS.maxOf.includes(k);

export function cleanMetrics(b) {
  if (!b || typeof b !== 'object' || b.v !== 1 || !METRICS.srcs.includes(b.s) || !b.c || typeof b.c !== 'object' || Array.isArray(b.c)) return null;
  const rows = [];
  for (const [k, val] of Object.entries(b.c)) {
    if (rows.length >= METRICS.maxKeys) break;
    const m = KEY_RE.exec(k); if (!m) continue;
    if (m[2] == null ? !KEYS.has(m[1]) : !SUB.has(m[1])) continue;
    const [s, n] = Array.isArray(val) ? val : [val, 1];
    if (typeof s !== 'number' || !Number.isFinite(s) || s < 0 || s > METRICS.maxV) continue;
    if (!Number.isInteger(n) || n < 0 || n > METRICS.maxN) continue;
    rows.push([k, s, n]);
  }
  return rows.length ? { src: b.s, rows } : null;
}
