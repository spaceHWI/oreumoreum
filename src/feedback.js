// 의견 보내기 (#77): 글 칸 하나(FEEDBACK.max 자) → 서버 POST /feedback → 서버가 저장하고 개발자 메일로 보냄
// - 서버 주소가 없거나 보내기에 실패하면 이 기기에 모아 두고(FEEDBACK.keep 개), 서버가 붙으면 한꺼번에 보냄
// - 같이 보내는 것: 게임 버전·서버 종류·기기 종류·좌표·닉네임. 이메일 등 개인 정보는 받지 않음
// - 연달아 보내기 막기: FEEDBACK.gapMs 에 한 번
import { FEEDBACK } from './balance.js';

const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 저장 불가 */ } } };

// key: 기기 저장 키, post(items) → Promise (없으면 서버 없음), meta() → 같이 보낼 값
export function createFeedback({ key, post, meta, now = () => Date.now() }) {
  let st = {};
  try { st = JSON.parse(ls.get(key) || '{}') || {}; } catch (e) { st = {}; }
  if (!Array.isArray(st.q)) st.q = [];
  st.q = st.q.filter((it) => it && typeof it.text === 'string' && it.text).slice(-FEEDBACK.keep);
  st.last = Number(st.last) || 0;
  const write = () => ls.set(key, JSON.stringify(st));
  let busy = false;

  const wait = () => Math.max(0, st.last + FEEDBACK.gapMs - now()); // 다음 글까지 남은 ms
  // 모아 둔 글을 서버로 (성공한 만큼 지움)
  async function flush() {
    if (!post || busy || !st.q.length) return 0;
    busy = true;
    let sent = 0;
    try {
      while (st.q.length) {
        const part = st.q.slice(0, FEEDBACK.batch);
        await post(part);
        st.q.splice(0, part.length); sent += part.length; write();
      }
    } catch (e) { /* 다음에 다시 */ }
    busy = false;
    return sent;
  }
  // → 'ok'(보냄) | 'kept'(기기에 모아 둠) | 'wait'(너무 잦음) | 'empty'
  async function send(text) {
    const t = String(text || '').replace(/\s+$/g, '').trim().slice(0, FEEDBACK.max);
    if (!t) return 'empty';
    if (wait() > 0) return 'wait';
    st.last = now();
    st.q.push({ at: st.last, text: t, ...meta() });
    if (st.q.length > FEEDBACK.keep) st.q.splice(0, st.q.length - FEEDBACK.keep);
    write();
    if (!post) return 'kept';
    const before = st.q.length;
    const n = await flush();
    return n >= before ? 'ok' : 'kept';
  }
  return { send, flush, wait, get pending() { return st.q.length; }, get online() { return !!post; } };
}
