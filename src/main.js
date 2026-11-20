// 오름오름 진입점 (#85): 첫 화면에 꼭 필요한 모델(내 캐릭터, assets.js CORE)을 먼저 받은 뒤 게임 모듈(modules.js)을 순서대로 읽는다.
// 가게·적·머리 종류·발소리 모델은 첫 화면이 그려진 뒤 따로 받는다 (assets.js)
// 원스토어 앱 안이면 (#97) 단계마다 로딩 진행률을 알린다. 첫 화면 준비 끝(startGameAsync)은 update.js 가 알림
import { onestore } from './onestore.js';
import { loadCore } from './assets.js';
import { listenCrashes, reportCrash } from './crash.js';
listenCrashes(); // #108: 처리 못 한 오류를 의견함으로 (보낼 곳은 panels.js 가 붙임)
onestore.progress(10);
loadCore().then(() => { onestore.progress(60); return import('./modules.js'); }).then(() => onestore.progress(85)).catch((e) => reportCrash(e, 'load'));
