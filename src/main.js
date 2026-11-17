// 오름오름 진입점 (#85): 첫 화면에 꼭 필요한 모델(내 캐릭터, assets.js CORE)을 먼저 받은 뒤 게임 모듈(modules.js)을 순서대로 읽는다.
// 가게·적·머리 종류·발소리 모델은 첫 화면이 그려진 뒤 따로 받는다 (assets.js)
import { loadCore } from './assets.js';
loadCore().then(() => import('./modules.js'));
