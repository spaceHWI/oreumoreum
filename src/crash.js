// 오류 알림 (#108): 처리 못 한 오류(error·unhandledrejection)와 매 프레임 갱신에서 난 오류를 서버 의견함(POST /feedback, kind 'crash')으로 보낸다
// - 보내는 것: 버전·기기 종류·화면 크기·브라우저/OS 이름·오류 글(첫 줄 + 자리)·마지막 한 일. 좌표·닉네임·계정 같은 개인 정보는 보내지 않음
// - 한 번에 하나씩 차례로, 같은 오류는 기기당 하루 CRASH.perDay 번까지, 한 번 켤 때 CRASH.perRun 개까지
// - 보낼 곳(post)은 게임 모듈이 다 읽힌 뒤 setCrashSink 로 받음. 그 전 오류는 모아 뒀다 보냄 (main.js 가 맨 먼저 listen)
import { CRASH } from './balance.js';
import { mt } from './metrics.js';

const KEY = 'oreumoreum.crash';
const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 저장 불가 */ } } };
const acts = []; // 마지막 한 일 (최근 CRASH.acts 개)
const q = []; let sink = null, meta = () => ({}), busy = false, sent = 0, ctx = () => '';
export function setCrashCtx(fn) { ctx = fn || (() => ''); } /* 글 끝에 붙일 짧은 상태: 켠 지 몇 초·품질 단계·WebGL 잃음 (#304, scene.js) */
const ctxText = () => { try { const c = String(ctx() || ''); return c ? ' · ' + c.slice(0, 60) : ''; } catch (e) { return ''; } };
const seenRun = new Set(); // 이번에 이미 받은 오류 (매 프레임 같은 오류가 나도 한 번만)

// 마지막 한 일 기록: '적 등장 dog×2' 같은 짧은 글
export function crashNote(s) { acts.push(`${Math.round(performance.now() / 1000)}s ${String(s).slice(0, 60)}`); if (acts.length > CRASH.acts) acts.shift(); }

// 브라우저·OS 이름만 (전체 UA 는 보내지 않음)
export function uaShort(ua = navigator.userAgent || '') {
  const os = /iPhone|iPad|iPod/.test(ua) ? 'iOS ' + ((ua.match(/OS (\d+)_/) || [])[1] || '?') : /Android/.test(ua) ? 'Android ' + ((ua.match(/Android (\d+)/) || [])[1] || '?') : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '?';
  const br = /SamsungBrowser\/(\d+)/.test(ua) ? 'Samsung ' + RegExp.$1 : /CriOS\/(\d+)/.test(ua) ? 'Chrome ' + RegExp.$1 : /Firefox\/(\d+)|FxiOS\/(\d+)/.test(ua) ? 'Firefox' : /Chrome\/(\d+)/.test(ua) ? 'Chrome ' + RegExp.$1 : /Version\/(\d+).*Safari/.test(ua) ? 'Safari ' + RegExp.$1 : '?';
  return `${os} ${br}`;
}
// 오류 → 한 줄 글 (메시지 + 첫 자리). 파일 주소는 이름만
export function crashText(err, where = '') {
  const msg = String(err?.message || err || '?').replace(/\s+/g, ' ').slice(0, 160);
  const at = String(err?.stack || '').split('\n').map((l) => l.trim()).find((l) => /:\d+:\d+/.test(l) && !l.startsWith(msg.slice(0, 20))) || '';
  const spot = at.replace(/^at /, '').replace(/https?:\/\/[^\s)]*\//g, '').slice(0, 120); // 함수 이름·파일 이름·줄·칸이 다 들어가게 (#122)
  return { key: (where + '|' + (err?.name || '') + msg).slice(0, 120), text: `[오류${where ? ' ' + where : ''}] ${err?.name && err.name !== 'Error' ? err.name + ': ' : ''}${msg}${spot ? ' @ ' + spot : ''}` };
}
// 기기당 하루 perDay 번
function allow(key) {
  const day = new Date().toISOString().slice(0, 10);
  let st; try { st = JSON.parse(ls.get(KEY) || '{}'); } catch (e) { st = {}; }
  if (!st || st.day !== day) st = { day, n: {} };
  const n = st.n[key] || 0; if (n >= CRASH.perDay) return false;
  st.n[key] = n + 1; const ks = Object.keys(st.n); if (ks.length > 40) delete st.n[ks[0]];
  ls.set(KEY, JSON.stringify(st)); return true;
}
async function pump() {
  if (busy || !sink || !q.length) return;
  busy = true;
  while (q.length) { const it = q.shift(); try { await sink([it]); } catch (e) { /* 못 보내면 버림 */ } }
  busy = false;
}
// 오류 하나를 알림. where: 'frame'·'enemy'·'gl' 등 어디서 났는지
const recent = [];
export const crashLog = () => recent.slice(); /* 이번 실행에서 난 오류 (어드민 창 '상태' 탭, #220) */
export function reportCrash(err, where = '') {
  try {
    const { key, text } = crashText(err, where);
    if (seenRun.has(key)) return; seenRun.add(key);
    if (/^\[오류[^\]]*\] (Script error\.?|ResizeObserver loop)/.test(text)) return; // 다른 곳 스크립트(정보 없음)·무해한 경고
    mt('crash'); // 이용 통계 (#121): 이번에 처음 난 오류 수
    recent.push({ at: Date.now(), text: text.slice(0, 200) }); if (recent.length > 8) recent.shift();
    console.error('[오름오름 오류]', where, err);
    if (sent >= CRASH.perRun || !allow(key)) return;
    sent++;
    const last = acts.length ? ' · 마지막: ' + acts.slice(-3).join(' / ') : '';
    const ua = ctxText() + ' · ' + uaShort(); // 글이 길어도 브라우저/OS 이름은 끝에 남게 (#122: 서버가 끝 칸으로 나눔)
    q.push({ at: Date.now(), kind: 'crash', text: (text + last).slice(0, 500 - ua.length) + ua, ...meta() });
    pump();
  } catch (e) { /* 알림이 또 오류를 내지 않게 */ }
}
// 오류는 아니지만 알릴 한 줄 (#287 'reload: 까닭×수'): 하루 묶음은 부르는 쪽이 정함. 이용 통계 crash 수에는 안 셈
export function reportNote(text) { try { q.push({ at: Date.now(), kind: 'crash', text: String(text).slice(0, 400) + ' · ' + uaShort(), ...meta() }); pump(); } catch (e) { /* 무시 */ } }
// post(items) → Promise, metaFn() → { ver, srv, map, dev, w, h } (좌표·닉네임은 넣지 않음)
export function setCrashSink(post, metaFn) { sink = post || null; if (metaFn) meta = metaFn; if (!sink) q.length = 0; pump(); }

let listening = false;
export function listenCrashes() {
  if (listening || typeof window === 'undefined') return; listening = true;
  addEventListener('error', (e) => { if (e.error || e.message) reportCrash(e.error || { message: e.message, stack: e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : '' }, ''); });
  addEventListener('unhandledrejection', (e) => reportCrash(e.reason || { message: 'rejection' }, 'promise'));
}
// fn 을 부르고 오류가 나면 알리고 넘어감 (게임이 멈추지 않게)
export function guard(fn, where) { try { return fn(); } catch (e) { reportCrash(e, where); return undefined; } }
