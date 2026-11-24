# 받는 양 (용량) 표

`node build.mjs && node tools/sizereport.mjs --md` 로 아래 '지금' 표를 다시 찍는다 (#293). 기준 열은 gzip: GitHub Pages 는 brotli 없이 gzip 으로 보내고, 모든 파일에 `cache-control: max-age=600`(바꿀 수 없음). 파일 이름에 내용 해시가 있으니 10분 뒤엔 ETag 로 다시 묻고(304) 바뀐 것만 새로 받는다.

## #293 앞뒤 (gzip, Pages 가 실제로 보내는 양)

| 묶음 | 앞 (dev 0.55.x) | 뒤 | 줄어든 몫 |
|---|---|---|---|
| 첫 화면까지 (index + main + 내 캐릭터) | 1477KB | 1398KB | -5% |
| 게임 시작까지 (+ 한가할 때 받는 모델 13개) | 2887KB | 2745KB | -5% |
| 한 시간 전부 (+ 사건 모델·쪽지 그림) | 3990KB | 3799KB | -5% |

바꾼 것
- 모델 텍스처를 webp 로 (`tools/texwebp.mjs` 가 구워 `assets/tex/<jpg 해시>.webp` 에 둠, 빌드는 있는 것만 씀): webp 가 jpg 의 85% 이하이고 jpg 와 견준 PSNR 36dB 이상인 14장만. 텍스처 합 1390KB → 1207KB. 내 캐릭터(첫 화면) 190KB → 123KB, 머리 3종 절반. 가게 셋·하르방·오름지기처럼 webp 가 오히려 큰 것은 jpg 그대로
- index.html 의 `<style>` 을 esbuild css minify, HTML 주석 뺌: 264KB → 225KB (gzip 61KB → 49KB)

## 재 보고 넣지 않은 것 (다음 후보)

- **three 줄이기**: `three/build/three.module.js` 한 파일이 위쪽에서 `new Vector3()` 같은 값을 만들어 esbuild 가 문장 단위로 떨구지 못함(673KB 그대로). `three/src/Three.js` 로 바꿔 묶어 보면 오히려 750KB (src 에 개발용 검사가 더 있음). 줄이려면 쓰는 클래스만 다시 내보내는 얇은 파일을 만들어 그것만 import 해야 함 — 게임 코드 import 를 다 바꾸는 큰 일
- **나중에 쓰는 것 조각으로(dynamic import)**: 지금 묶음이 `format: 'iife'` 한 파일이라 조각을 나눌 수 없음. `format: 'esm'` + `splitting` 으로 바꾸고, `test.html`·`oreumoreum.html`(한 파일)·CSP(`'self'`)·로딩 창 진행 막대를 함께 고쳐야 함. 동굴(`game/cave*`)·사건(`game/case*`·`src/cases`)·어드민·엔딩·달력·쪽지 보기를 떼면 게임 코드 1.6MB 중 대략 300~400KB(원래 크기)
- **박아 넣은 자료**: 지형 `namsongidata.js`(이미 base64, gzip 117KB)·벽 모델 `wallmodel.js`(68KB)·글(`balance.js` 의 퀘스트·대사, `version.js` 릴리스 노트 42KB). 바이너리로 떼어도 gzip 뒤 이득이 작고 첫 화면에 바로 필요해서 그대로
- **정점 16비트 양자화**: 가게·들개·외계인·사건 모델은 이미 uint16(PROP), meshopt 압축도 이미 함. 남은 float(캐릭터·머리·멧돼지)를 16비트로 줄이면 모양이 조금 달라져 `assetcheck.mjs` '같음' 검사를 바꿔야 함 — 효과는 캐릭터 기준 수십 KB
- **글꼴**: Gothic A1 은 구글 글꼴이 unicode-range 조각(약 100개)으로 주어 쓴 글자 조각만 받음. 손글씨(Nanum Pen Script)는 쪽지를 처음 열 때만. 그대로
- **KTX2**: #272 에서 재 보니 늘어나서 안 넣음

## 지금
<!-- 지금 -->
| 묶음 | 파일 수 | 원래 | gzip (Pages) | brotli |
|---|---|---|---|---|
| 첫 화면까지 | 3 | 3459KB | 1408KB | 1194KB |
| 게임 시작까지 | 16 | 4850KB | 2754KB | 2523KB |
| 한 시간 전부 | 36 | 5947KB | 3808KB | 3560KB |

| 파일 | 언제 | 원래 | gzip | brotli |
|---|---|---|---|---|
| main.js | 첫 화면 | 2965KB | 1096KB | 895KB |
| a/stone.bin | 시작 뒤 한가할 때 | 282KB | 276KB | 274KB |
| a/runner.bin | 첫 화면 | 269KB | 262KB | 258KB |
| a/salon.bin | 시작 뒤 한가할 때 | 256KB | 251KB | 249KB |
| a/leap.bin | 시작 뒤 한가할 때 | 204KB | 198KB | 196KB |
| a/case-jigi.bin | 가까이 갈 때 | 148KB | 142KB | 140KB |
| a/case-yeti.bin | 가까이 갈 때 | 124KB | 119KB | 117KB |
| a/case-arena-keeper.bin | 가까이 갈 때 | 120KB | 115KB | 113KB |
| a/case-mib.bin | 가까이 갈 때 | 108KB | 103KB | 101KB |
| a/case-ghost-keeper.bin | 가까이 갈 때 | 98KB | 93KB | 92KB |
| a/hareubang.bin | 시작 뒤 한가할 때 | 83KB | 82KB | 81KB |
| a/case-stall.bin | 가까이 갈 때 | 79KB | 76KB | 75KB |
| a/case-gong.bin | 가까이 갈 때 | 71KB | 69KB | 68KB |
| a/alien.bin | 시작 뒤 한가할 때 | 72KB | 69KB | 68KB |
| a/hair-bun.bin | 시작 뒤 한가할 때 | 71KB | 69KB | 68KB |
| a/dog.bin | 시작 뒤 한가할 때 | 68KB | 66KB | 65KB |
| a/hair-short.bin | 시작 뒤 한가할 때 | 66KB | 64KB | 62KB |
| a/hair-bob.bin | 시작 뒤 한가할 때 | 65KB | 63KB | 62KB |
| a/boar.bin | 시작 뒤 한가할 때 | 63KB | 61KB | 61KB |
| a/deer.bin | 시작 뒤 한가할 때 | 63KB | 61KB | 60KB |
| a/case-hose.bin | 가까이 갈 때 | 61KB | 59KB | 59KB |
| index.html | 첫 화면 | 225KB | 50KB | 41KB |
| a/lamp.bin | 시작 뒤 한가할 때 | 46KB | 45KB | 44KB |
| a/case-chute.bin | 가까이 갈 때 | 46KB | 44KB | 43KB |
| a/steps.bin | 시작 뒤 한가할 때 | 52KB | 41KB | 40KB |
| a/case-jigi-lo.bin | 가까이 갈 때 | 35KB | 34KB | 33KB |
| a/case-yeti-lo.bin | 가까이 갈 때 | 34KB | 32KB | 31KB |
| a/case-arena-keeper-lo.bin | 가까이 갈 때 | 31KB | 30KB | 29KB |
| a/case-mib-lo.bin | 가까이 갈 때 | 29KB | 28KB | 27KB |
| a/case-ghost-keeper-lo.bin | 가까이 갈 때 | 27KB | 26KB | 26KB |
| a/case-stall-lo.bin | 가까이 갈 때 | 24KB | 23KB | 23KB |
| a/case-mango.bin | 가까이 갈 때 | 16KB | 15KB | 15KB |
| a/case-gong-lo.bin | 가까이 갈 때 | 15KB | 14KB | 14KB |
| a/case-hose-lo.bin | 가까이 갈 때 | 15KB | 14KB | 14KB |
| a/case-chute-lo.bin | 가까이 갈 때 | 12KB | 12KB | 12KB |
| a/case-mango-lo.bin | 가까이 갈 때 | 5KB | 4KB | 4KB |

**main 안의 몫** (minify 뒤): three 704KB · 박아 넣은 자료(지형·벽·글·그림) 599KB · 게임 코드 1658KB

| main 안 큰 것 20 | 크기 |
|---|---|
| node_modules/three/build/three.module.js | 673KB |
| src/namsongidata.js | 220KB |
| src/balance.js | 120KB |
| src/wallmodel.js | 68KB |
| src/version.js | 42KB |
| src/runner.js | 39KB |
| src/namsongi.js | 34KB |
| src/punktext.js | 33KB |
| src/audio.js | 29KB |
| src/icons.js | 26KB |
| src/stonelogo.js | 23KB |
| src/life.js | 23KB |
| node_modules/three/examples/jsm/libs/meshopt_decoder.module.js | 22KB |
| src/tutorial.js | 21KB |
| src/game/quest.js | 21KB |
| src/game/boss.js | 21KB |
| src/game/cases.js | 21KB |
| src/trash.js | 20KB |
| src/game/swarm.js | 20KB |
| src/npclines.js | 19KB |
<!-- /지금 -->
