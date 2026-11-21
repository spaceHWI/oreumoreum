// 이용 통계 연결 (#121): 게임 사건을 src/metrics.js 숫자로 센다. 보내기는 METRICS.flushS 마다·나갈 때 한 번
// - 프레임 밖(setInterval sampleS)에서 상태를 훑어 셈: 입장·플레이 시간·귤 늘고 줆·튜토리얼 칸·구역·정상·함께 있는 사람·fps
// - 사건은 업적 이벤트(ach.emit)·쓰레기 이벤트(trash.on)·적 무리(life.hooks.enemyWave)를 감싸서 셈 (그 파일들은 안 고침)
// - 기기 기록(처음 온 날·튜토리얼 어디까지 셌나)은 '<저장 키>.mt' 에 따로 (처음부터 다시 해도 남음)
import { METRICS } from '../balance.js';
import { TIER } from '../quality.js';
import { mt, mtMax, mtKey, mtFrames, mtFlush, mtPeek, mtSent } from '../metrics.js';
import { ONLINE, metricsUrl } from '../online.js';
import { state, late } from './state.js';
import { $, save, isTouch } from './save.js';
import { P, trash, player, life } from './place.js';
import { ach } from './hud.js';
import { net } from './room.js';

const LK = (__DEV__ ? 'oreumoreum.dev' : 'oreumoreum.v1') + '.mt';
let L = {}; try { L = JSON.parse(localStorage.getItem(LK) || '{}') || {}; } catch (e) { L = {}; }
const keepL = () => { try { localStorage.setItem(LK, JSON.stringify(L)); } catch (e) { /* 저장 불가 */ } };
const wasEntered = !!save.entered; // 이 모듈을 읽을 때(입장 전) 이미 들어온 적이 있었나 (start.js 가 입장하며 바꿈)
const src = () => (state.account?.admin ? 'adm' : __DEV__ ? 'dev' : 'live');

// 어디서 왔나: 앞 페이지 도메인(없으면 none), 인앱 브라우저 종류
function refHost() { try { const h = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : ''; return !h ? 'none' : h === location.hostname ? 'self' : h; } catch (e) { return 'none'; } }
function inApp(ua = navigator.userAgent || '') { return /KAKAOTALK/i.test(ua) ? 'kakao' : /Instagram/i.test(ua) ? 'insta' : /FBAN|FBAV/i.test(ua) ? 'facebook' : /NAVER\(inapp/i.test(ua) ? 'naver' : /Line\//i.test(ua) ? 'line' : /DaumApps/i.test(ua) ? 'daum' : ''; }
const devKind = () => (isTouch ? (Math.min(innerWidth, innerHeight) <= 600 ? 'phone' : 'tablet') : 'desktop');

// ---------- 한 번 들어온 동안 ----------
const S = { on: false, t0: 0, play: 0, pt: 0, fpsDone: false, frames0: 0, fpsT: 0, glog: false, zones: new Set(), top: false, coins: null, tut: -1, tutDone: false, isNew: false };
function begin() {
  S.on = true; S.t0 = performance.now(); S.coins = null;
  S.isNew = !L.first && !wasEntered; // 기기 저장 기준 처음 온 사람
  if (!L.first) { L.first = Date.now(); if (!S.isNew) { L.fp = 1; L.tmax = save.tut?.done ? 99 : (save.tut?.step | 0); } else { L.fp = 0; L.tmax = -1; } } // 통계 전부터 하던 사람: 이미 지난 칸은 세지 않음
  mt('in'); mt(S.isNew ? 'new' : 'ret');
  mt(mtKey('dev', devKind())); mt(mtKey('ref', refHost())); const app = inApp(); if (app) mt(mtKey('app', app));
  mt(mtKey('tier', TIER));
  S.tut = save.tut?.step | 0; S.tutDone = !!save.tut?.done;
  keepL();
}
function tickTut() {
  const t = save.tut; if (!t) return;
  const step = t.done ? 99 : t.step | 0;
  if (!t.done) for (let k = (L.tmax ?? -1) + 1; k <= step; k++) mt(mtKey('tut', k)); // 칸마다 도착 (기기당 한 번)
  if (step > (L.tmax ?? -1)) { L.tmax = step; keepL(); }
  if (t.done && !S.tutDone && !L.tdone) { mt(mtKey('tut', S.tut >= 10 ? 'end' : 'skip')); L.tdone = 1; keepL(); } // 마지막 칸(정낭)에서 끝나면 end, 그 전에 끝나면 skip
  S.tutDone = !!t.done; if (!t.done) S.tut = step;
}
let lastT = performance.now();
function sample() {
  const now = performance.now(), dt = Math.min(10, (now - lastT) / 1000); lastT = now;
  if (!state.sessionOn || document.hidden) return;
  if (!S.on) { begin(); S.frames0 = mtFrames(); return; }
  S.play += dt; mt('play', dt, 0);
  const m = S.play / 60; while (S.pt < METRICS.ptCut.length && m >= METRICS.ptCut[S.pt]) mt('pt' + METRICS.ptCut[S.pt++]);
  // 평균 fps: 보이는 동안의 프레임 수 / 시간. 1분 넘게 했을 때 한 번 구간으로
  S.fpsT += dt;
  if (!S.fpsDone && S.play >= 60) { const fps = (mtFrames() - S.frames0) / Math.max(1, S.fpsT); let b = 0; while (b < METRICS.fpsCut.length && fps >= METRICS.fpsCut[b]) b++; mt(mtKey('fps', b)); S.fpsDone = true; }
  // 귤: 늘면 번 것, 줄면 쓴 것 (서버가 바로잡은 값도 들어감)
  const c = Number(save.coins) || 0; if (S.coins != null) { const d = c - S.coins; if (d > 0) mt('earn', d); else if (d < 0) mt('spend', -d); } S.coins = c;
  if (!S.glog && state.account?.loggedIn) { S.glog = true; mt('glog'); }
  tickTut();
  const z = trash?.zoneAt?.(player.pos.x, player.pos.z); if (z && !S.zones.has(z)) { S.zones.add(z); mt(mtKey('zone', z)); }
  if (!S.top && P?.stone && Math.hypot(player.pos.x - P.stone.x, player.pos.z - P.stone.z) <= METRICS.topR) { S.top = true; mt('top'); }
  if (ONLINE && net.peersById) { const n = net.peersById.size; mt('peer', n); mtMax('peermx', n); }
}

// ---------- 사건 ----------
{ const emit = ach.emit; ach.emit = (ev, n = 1) => { emit(ev, n); try { onEv(ev); } catch (e) { /* 셈은 게임을 멈추지 않음 */ } }; }
const PRE = [['gear-buy-', 'buy', 'gear.'], ['weapon-buy-', 'buy', 'weapon.'], ['clothes-buy-', 'buy', 'cloth.'], ['ride-buy-', 'buy', 'ride.'], ['enemy-repel-', 'er', '']];
function onEv(ev) {
  if (ev === 'trash') { mt('pick'); if (!L.fp) { L.fp = 1; keepL(); if (S.on && S.isNew) mt('fpick', (performance.now() - S.t0) / 1000); } return; } // 첫 줍기까지 (처음 온 사람만)
  if (ev === 'dex') return mt('dex');
  if (ev === 'cart' || ev === 'down' || ev === 'emote' || ev === 'chat') return mt(ev);
  if (ev === 'ride') return mt(mtKey('ride', 'deer')); // 노루 타기
  if (ev === 'dumper-repel') return mt(mtKey('er', 'dumper'));
  for (const [p, base, pre] of PRE) if (ev.startsWith(p)) return mt(mtKey(base, pre + ev.slice(p.length)));
  if (ev.startsWith('ride-') && ev !== 'ride-dist') return mt(mtKey('ride', ev.slice(5))); // 탈것 탐 (ride.js)
}
trash?.on((ev, d) => { if (ev === 'heap-clear' && !d.by) mt('heap'); }); // 내가 치운 더미만
{ const prev = life.hooks.enemyWave; life.hooks.enemyWave = (w) => { try { mt(mtKey('em', w.kind), w.n || 1); } catch (e) { /* */ } return prev?.(w); }; }
for (const id of ['menu-feedback', 'fb-chip', 'intro-feedback']) $(id)?.addEventListener('click', () => mt('fbopen'));
document.addEventListener('submit', (e) => { if (e.target?.id === 'feedback-form' && $('feedback-input')?.value.trim()) mt('fbsend'); }, true); // panels.js 가 글을 비우기 전에

// ---------- 보내기 ----------
function flush() { if (!ONLINE) return; sample(); mtFlush(metricsUrl, src()); }
setInterval(sample, METRICS.sampleS * 1000);
setInterval(flush, METRICS.flushS * 1000);
addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); else lastT = performance.now(); });

late.metrics = { peek: mtPeek, sent: mtSent, sample, flush, local: () => ({ ...L }), session: () => ({ ...S, zones: [...S.zones] }), src };
