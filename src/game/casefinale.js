// 사건 파일 끝 '버리는 자' (#237, 기획 notes/case-files.md 3절 '끝'): 사건을 다 종결하면 수사 보드의 빨간 실이 저절로 이어지고, 다섯 줄이 모두 위(하늘)를 가리킨 뒤 지금의 엔딩으로
// - 조건: 사건 데이터(src/cases/index.js CASES)를 모두 종결. 사건이 아직 다섯이 아니면(예: 사건 3 을 만드는 중) 있는 것을 다 끝내면 됨
// - 연출: 싸움·창·장면·튜토리얼이 없을 때 CASE.fin.safe 초 뒤 수사 보드가 열리고 실이 핀을 차례로 이음(CASE.fin.thread 초) → 핀마다 실 한 줄이 위로(up 초) → 혼잣말 한 줄 → 칭호 '수석 조사관' → 이야기 'end'(엔딩) 줄에 섬
//   다 본 뒤 보드는 늘 '위를 가리키는' 모양 (cases.js board·thread 가 late.caseFin.up() 을 봄)
// - 엔딩(story.js 'end')은 이 연출을 본 뒤에만. 이미 엔딩을 본 저장(save.story.seen·done 'end')은 막지 않음. 정상 우두머리를 쫓았는데 사건이 덜 끝났으면 혼잣말 한 줄
// 저장 save.caseFin = { t 연출을 본 때(ms, 0 아직) }. 멀티: 내 화면에서만 (엔딩만 방 전체, ending.js). 파일 순서는 cases 뒤 (src/modules.js). dev: __oreum.caseFin
import { CASE } from '../balance.js';
import { CASES } from '../cases/index.js';
import { MUTTER_TEXT } from '../punktext.js';
import { state, late } from './state.js';
import { save, persist, MAP_ID } from './save.js';
import { toast, panelOpen } from './hud.js';

const F0 = CASE.fin, ON = MAP_ID === 'namsongi';
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
function S() {
  if (!isObj(save.caseFin)) save.caseFin = { t: 0 };
  const s = save.caseFin; s.t = Number.isFinite(+s.t) && +s.t > 0 ? +s.t : 0;
  return s;
}
const closedN = () => CASES.filter((c) => late.cases?.isClosed?.(c.id)).length;
const allClosed = () => CASES.length > 0 && closedN() === CASES.length;
const sawEnd = () => !!save.story?.seen || (Array.isArray(save.story?.done) && save.story.done.includes('end'));
let run = null, safeT = 0; // run { t0 시작(ms, 화면 시각: 창이 열린 동안 게임 dt 가 작아도 같은 길이), u 초, said }

function busy() {
  return !state.sessionOn || late.tut?.active || state.cave || state.cine || panelOpen() || !!late.cases?.still?.() || !!late.story?.busy;
}
function play() {
  const s = S(); s.t = Date.now(); persist();
  run = { t0: performance.now(), u: 0, said: false };
  late.mutterApi?.hush?.();
  late.cases?.file?.(); /* 보드가 열림 → thread() 가 run 을 보고 실을 그려 나감 */
}
function finish() {
  if (!run) return; run = null;
  late.titles?.give?.('수석 조사관');
  late.story?.endReady?.(); /* 엔딩 줄에 섬 (창을 닫고 조용해지면 시작) */
  late.cases?.build?.();
}
function tick(dt) {
  if (!ON) return;
  if (run) {
    run.u = (performance.now() - run.t0) / 1000;
    if (!run.said && run.u >= F0.thread + F0.up) { run.said = true; if (!late.mutterApi?.line?.('caseFin', MUTTER_TEXT.caseFin)) toast(MUTTER_TEXT.caseFin, 3); }
    if (run.u >= F0.thread + F0.up + F0.hold || !late.cases?.fileOpen?.()) finish();
    return;
  }
  if (S().t || !allClosed()) { safeT = 0; return; }
  safeT = busy() ? 0 : safeT + dt;
  if (safeT >= F0.safe) { safeT = 0; play(); }
}
late.caseFin = {
  tick,
  up: () => !!S().t, /* 보드가 위를 가리키는 모양인가 */
  anim: () => (run ? { thread: Math.min(1, run.u / F0.thread), up: Math.max(0, Math.min(1, (run.u - F0.thread) / F0.up)) } : null),
  ready: () => !ON || sawEnd() || !!S().t, /* 엔딩으로 가도 되는가 (story.js) */
  short() { /* 정상 우두머리를 쫓았는데 사건이 덜 끝남 */
    if (late.mutterApi?.line?.('caseShort', MUTTER_TEXT.caseShort)) return;
    toast(MUTTER_TEXT.caseShort, 3);
  },
};
late.caseFinApi = {
  state: () => ({ t: S().t, all: allClosed(), n: closedN(), of: CASES.length, run: run && { u: +run.u.toFixed(1), said: run.said }, ready: late.caseFin.ready(), saw: sawEnd() }),
  play, finish, reset: () => { save.caseFin = { t: 0 }; run = null; persist(); },
};
