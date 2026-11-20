// 원스토어 웹게임 SDK (#97): 원스토어 앱이 게임을 iframe 으로 띄울 때의 수명 주기(Lifecycle)만. 결제·광고 없음
// SDK 스크립트는 build.mjs 가 Pages 용 index.html 머리에 게임 코드보다 먼저 넣는다 (async 모듈: 받는 동안 게임을 막지 않음).
//   받으면 window.__onestoreSDK = createSDK 를 두고 'onestore-sdk' 이벤트를 쏜다. 못 받으면(오프라인·차단) 아무 일도 없고 게임은 그대로
// 순서: createSDK() → on('pause'|'resume'|'exit') → initializeAsync() → setLoadingProgress(0~100) … → startGameAsync()
// 일반 브라우저: initializeAsync() 가 { err } 를 돌려줌 → 아무 것도 하지 않음
// ?onestore=mock : 가짜 SDK (같은 모양). 콘솔에서 __onestoreMock.pause() / .resume({ ringerSilent }) / .exit() / .back() 로 확인 (tools/onestore.js)
// 이 파일은 게임 모듈보다 먼저 읽히므로 게임 쪽 파일을 import 하지 않는다. 게임은 connect() 로 할 일을 넘긴다 (src/game/start.js)
const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const MOCK = Q.get('onestore') === 'mock';
const INIT_WAIT = 5000; // 앱이 답이 없으면 일반 브라우저로 침

let sdk = null, inApp = false, info = null, pct = 0, wantStart = false, started = false, game = null;
const hold = { pause: null }; // connect 전에 온 pause (아직 게임 루프가 없음)

function mockSDK() {
  const h = {}, log = [];
  let back = null;
  const say = (...a) => { log.push(a.join(' ')); console.info('[onestore mock]', ...a); };
  const m = {
    on: (ev, fn) => { (h[ev] ||= []).push(fn); },
    onBackPressed: (fn) => { back = fn; },
    initializeAsync: async () => ({ playerId: 'mock-player', locale: 'ko-KR', ringerSilent: Q.get('silent') === '1', safeArea: { top: 28, bottom: 20, left: 0, right: 0 } }),
    setLoadingProgress: (p) => { m.progress = p; say('progress', p); },
    startGameAsync: async () => { m.started = true; say('startGame'); },
    progress: 0, started: false,
  };
  const fire = (ev, d) => (h[ev] || []).forEach((f) => f(d));
  window.__onestoreMock = {
    pause: (reason = 'mock') => fire('pause', { reason }), resume: (d = {}) => fire('resume', d), exit: () => fire('exit', {}),
    back: () => { const r = back ? back() : undefined; say('back →', r === true ? '게임이 처리' : '앱 종료 확인'); return r; },
    get progress() { return m.progress; }, get started() { return m.started; }, log,
  };
  return m;
}

const call = (fn) => { try { return fn(); } catch (e) { console.warn('[onestore]', e); return undefined; } };

async function init(createSDK) {
  if (sdk) return;
  try { sdk = createSDK(); } catch (e) { console.warn('[onestore] createSDK', e); return; }
  sdk.on('pause', (d) => { if (!inApp) return; if (game) call(() => game.pause(d?.reason)); else hold.pause = true; });
  sdk.on('resume', (d) => { if (!inApp) return; hold.pause = false; if (d && 'ringerSilent' in d && info) info.ringerSilent = !!d.ringerSilent; if (game) call(() => game.resume(d || {})); });
  sdk.on('exit', () => { if (inApp && game) call(() => game.exit()); }); // 0.5초 안에 동기로
  let res;
  try { res = await Promise.race([sdk.initializeAsync(), new Promise((r) => setTimeout(() => r({ err: 'timeout' }), INIT_WAIT))]); }
  catch (e) { console.info('[onestore] 앱 응답 없음', e?.reason || e); return; }
  if (!res || res.err) return; // 일반 브라우저 (Platform Not Supported) — 지금 그대로
  inApp = true; info = res;
  document.documentElement.classList.add('onestore');
  sdk.onBackPressed?.(() => (game ? call(() => game.back()) === true : false));
  call(() => sdk.setLoadingProgress(pct));
  if (game) apply();
  if (wantStart) start();
}
function start() {
  if (started || !inApp) return; started = true;
  call(() => sdk.setLoadingProgress(100));
  Promise.resolve(call(() => sdk.startGameAsync())).catch((e) => console.warn('[onestore] startGame', e));
}
// 앱이 알려 준 안전 영역을 page.html 의 --safe-t·--safe-b·--safe-l·--safe-r 에 (iframe 안에서는 env() 가 0 일 수 있음)
function applySafe(sa) {
  if (!sa) return;
  const r = document.documentElement.style;
  for (const [k, v] of [['t', sa.top], ['b', sa.bottom], ['l', sa.left], ['r', sa.right]]) {
    const n = Number(v); if (!(n > 0)) continue;
    const side = { t: 'top', b: 'bottom', l: 'left', r: 'right' }[k];
    r.setProperty('--safe-' + k, `max(env(safe-area-inset-${side}, 0px), ${Math.round(n)}px)`);
  }
}
function apply() {
  applySafe(info.safeArea);
  call(() => game.inApp(info));
  if (hold.pause) { hold.pause = false; call(() => game.pause('early')); }
}

export const onestore = {
  get on() { return inApp; },
  get info() { return info; },
  get silent() { return inApp && !!info?.ringerSilent; },
  // 로딩 진행률 0~100 (main.js: 모델 받기 → 게임 모듈 → 첫 화면)
  progress(p) { pct = Math.max(pct, Math.min(99, Math.round(p))); if (inApp && !started) call(() => sdk.setLoadingProgress(pct)); },
  // 첫 화면 준비 끝 → startGameAsync (SDK 가 늦게 와도 오면 그때)
  ready() { wantStart = true; start(); },
  // 게임 쪽 할 일: { pause(reason), resume({ ringerSilent }), exit(), back() → true|false, inApp(info) }
  connect(g) { game = g; if (inApp) apply(); },
};

if (typeof window !== 'undefined') {
  if (MOCK) init(() => mockSDK());
  else if (window.__onestoreSDK) init(window.__onestoreSDK);
  else addEventListener('onestore-sdk', () => init(window.__onestoreSDK), { once: true });
}
