# 오름오름 프로토타입 (2026-11-15, v0.20 · 아티팩트 버전 33)

Artifact(개발·테스트, 멀티 됨): https://claude.ai/artifact/7cea3use57e2Ag7tnrpeb7
GitHub Pages(공개, 혼자 모드): https://spacehwi.github.io/oreumoreum/ — 저장소 spaceHWI/oreumoreum, index.html 하나를 업로드하는 방식. 마지막 배포는 v0.16 (0.17~0.19는 아티팩트에만)
capabilities: room, user, db(stones/{self}, feedback/{self} — 개발자에게 보내기, notes는 미사용)
소스: /home/claude/oreum (로컬 git). dist/oreumoreum.html = 아티팩트용, dist/test.html = 로컬 playwright용
Cloudflare: Workers 배포용 API 토큰 oreumoreum-deploy(90일, 2027-02-05 만료) 발급됨. 멀티 서버(Durable Objects, 오름당 채널 분할)와 저장(SQLite)은 미구현
피드백 리포트(모의 사용자 30명): https://claude.ai/artifact/D7gyt4HATXAJdLBbk5Q636 — 우선순위 10개 표를 사용자와 하나씩 검토 예정 (1번 귤 경제부터)

지난 변경 기록(이슈별 메모)은 notes/history.md 로 옮겼다 (#86).

## 개발 프로세스
아티팩트에서 개발·테스트 → "배포해줘" 때만 버전 올리고 릴리스 노트 정리해 Pages에 업로드

## 코드 구조 (#86)
진입점 `src/main.js` 는 내 캐릭터 모델(`assets.js` CORE)을 먼저 받은 뒤 `src/modules.js` 를 읽는다(#85). `modules.js` 는 바깥 모듈을 예전 순서대로 읽어 둔 뒤(`boot.js` 맨 먼저) 기능별 파일 `src/game/*.js` 를 아래 순서대로 import 한다. 이 순서가 곧 초기화 순서다. 파일 하나는 40KB 를 넘기지 않는다.

따로 받는 모델 (#85): 캐릭터·가게 3곳·들개·외계인·멧돼지·머리 3종·발소리 샘플은 JS 에 넣지 않고 `build.mjs` 가 `tools/packassets.mjs` 로 `dist/a/<이름>-<해시>.bin` (meshopt 압축 정점·인덱스 + jpg·mp3) 으로 묶는다. 원본 자료는 그대로 `src/model-*.js`·`runnermodel.js`·`boarmodel.js`·`gear/head-*.js`·`stepsamples.js` 에 두고 고치면 된다(게임 코드는 import 하지 않음). 게임 코드는 `assets.js` 의 `whenAsset(이름, 콜백)` 으로 받고, 받기 전에는 `placeholderGeo`(모델 크기 상자·타원체) 임시 모양을 보인다. 첫 프레임 뒤 `update.js warm()` 이 셰이더를 미리 준비하고(compileAsync) 나머지 모델을 받기 시작한다. 새 모델을 더하면 `packassets.mjs ASSET_SRC` 에 한 줄 더하고 `node tools/assetcheck.mjs` 로 원본과 같은지 본다. 받다가 실패하면 4초부터 두 배씩(최대 1분) 다시 받는다. 첫 화면 '시작' 버튼은 게임 모듈이 다 읽힐 때까지 눌리지 않는다(`start.js`). 느린 연결·실패 확인은 `node tools/slownet.js 3g|fail|dead` (#90).

빌드 결과: `dist/index.html` + `main-<해시>.js` + `a/*.bin` (Pages), `dist/test.html`·`oreumoreum.html` 은 모델까지 한 파일 (tools/ 가 file:// 로 엶). 홈 화면 추가용 `manifest.webmanifest`·아이콘 PNG 4장(`src/icons/`, `tools/icons.mjs` 로 구움, #91)도 dist 에 함께 나간다.

| 파일 | 하는 일 |
|---|---|
| state.js | 파일 사이에 주고받는 값. `state` = 여러 파일이 읽고 바꾸는 값(예전 let), `late` = 앞 파일이 부르는 뒤 파일의 함수·객체 |
| save.js | 공용 도구($·isTouch·clamp·wrapA), 저장 불러오기·예전 저장 고치기(예전 server clean → battle, #98)·persist, 맵 결정, 장비→겉모습 |
| scene.js | 렌더러·장면·빛·성능 단계 적용, 실제 제주 시각의 해·하늘, 날씨 반영 |
| place.js | 소품(표지석·벤치·징검돌·하르방·돌탑), 사물 충돌, 돌담, 들머리 개울, 가게 거리, 쓰레기·오름 안 클린하우스·꽃, 마차, 러너(player), HP |
| camera.js | 카메라, 첫 화면 궤도 |
| hud.js | 위 한 줄·토스트·배너 자리, 상황 팁, 패널 닫기, 업적, 도감 |
| input.js | 키보드·조이스틱·멀티터치·시점·핀치, 속도 |
| menu.js | 처음부터 다시, 개발자 버튼, 배경 음악, 동작(이모트) 버튼 |
| inbox.js | 받은 의견 보기 (#96): 어드민 개발자 메뉴 "받은 의견" 패널·새 글 점 (`getFeedback`, 마지막 본 id 는 기기 `oreumoreum.inbox.seen`) |
| throw.js | 귤 던지기·귤 활·조준 표시·화면 밖 적 방향 |
| panels.js | 채팅, 메뉴 항목, 릴리스 노트, 의견 보내기, 도움말 |
| screen.js | 전체 화면 버튼·메뉴 항목(안 되는 곳은 홈 화면 추가 안내), 돌릴 때 바로 맞추기 (#105) |
| ride.js | 탈것(스케이트보드·스쿠터·조랑말), 마차 |
| moves.js | 노루 타기, 점프, 벤치에 앉기, 돌탑 소원, 사진사 사진 |
| room.js | 함께(net·social), 이모트 연결, 사진사 NPC, 입장 세션 |
| stores.js | 레스토랑 스톤, 가게 팝업 틀, 루이네 미장원, LEAP, 버프 표시, 가장자리 가게 표시, 상호작용(F)·줍기(E) 키 |
| pickup.js | 줍기·배낭(줍기 버튼으로 가까운 쓰레기까지 걷기 #104), 구역 확인, 더미·꽃밭 효과 |
| deernet.js | 멀티 노루 (#92): 노루 무리는 방장이 알림, 노루 타기는 방이 관리, 다른 사람 귤 먹이 부탁 |
| dump.js | 클린하우스(버리기·화살표·자동 걷기), 상호작용 버튼이 고르는 할 일 |
| shop.js | 상점 팝업(장비 탭)·사는 연출, 옷 |
| look.js | 캐릭터 고르기·머리·옷장, 표지판, 탐방로 고르기 |
| hooks.js | 소리, 동물·적·투기꾼 후크, 받혀 구르기, 귤 효과, 긴장 음악 |
| pace.js | 연출 감독 연결(#89): `src/pacing.js` 차례대로 투기꾼·트럭·몹 부르기(조짐·보상), 긴장(state.tension)을 화면 가장자리·하늘·카메라·HP 막대·음악에, 지루할 때 작은 즐거움, 맞힌 순간 멈춤 |
| start.js | 첫 화면 시작, 로그인, 랭킹 (서버 고르기는 #98 에서 없앰: 전투 오름 하나) |
| update.js | 매 프레임 갱신(updatePlayer·frame), 해돋이 보기, 멀리 있는 작은 물체 감추기 |
| debug.js | 튜토리얼·낚시 연결, 개발용 라벨, 성능 단계 메뉴, `window.__oreum` |

규칙
- 뒤 파일은 앞 파일 값을 그냥 import 한다(export/import). 앞 파일이 뒤 파일 함수를 불러야 하면 뒤 파일이 `late` 에 넣고 앞 파일은 `late.이름` 으로 부른다(이벤트·매 프레임에서만, 읽는 중에는 못 씀)
- 여러 파일이 바꾸는 값은 `state.이름` (예: `state.emo`, `state.fishing`, `state.throwAim`)
- 수치는 `src/balance.js` 그대로
- 지난 변경 기록(이슈별 메모)은 `notes/history.md`

그 밖의 모듈 (src/)
- 맵·그림: boot.js(맵 결정, 맨 먼저) · inapp.js(인앱 브라우저 안내, 페이지 맨 앞 인라인, #118) · namsongi.js/namsongidata.js(남송이 지형) · world.js · gfx2.js · toon.js · sun.js · weather.js · halla.js · maps.js · nsbound.js · zones.js · trailshape.js · stonewall.js/wallmodel.js · stream.js/streamshape.js · gate.js/donnaeko.js(숨긴 예전 맵) · lamps.js(가로등, model-lamp.js) · retro.js · quality.js
- 캐릭터·장비: runner.js · basebody.js · runnermodel.js/dqskin.js · gear.js · clothes.js/clothicons.js · emotes.js · footprints.js
- 캐릭터 구조 (#106): 뼈대 7개(hips·chest·head·armL·armR·legL·legR, 듀얼 쿼터니언 dqskin.js) 하나에 세 겹을 얹는다
  - 기본 몸 `basebody.js`: 옷 없는 매끈한 몸 한 메시(몸통+목·팔·벙어리장갑 손·다리·발). 몸통 단면은 옷과 같은 표(clothes.js TORSO·HIPS)에서 조금 안쪽. 정점마다 부위 번호(REGION: neck chest waist pelvis upperarm forearm hand thigh shin foot). 남·여는 `bodyWarp`(허리·골반 폭)만 다르고 머리 모양으로 정함(runner.js `bodySex`: 단발·똥머리 = 여, `outfit.body` 가 있으면 그것). 피부색은 재질 색, 발은 양말 색(cFoot)
  - 머리: 머리 장비(gear.js 'hat:short|bob|bun', Tripo 머리, 머리 뼈에 붙음)를 쓰면 그것만. 아니면 runnermodel.js(Tripo)의 목 위 삼각형만 남긴 메시(구운 초록 모자). 눈 깜빡임(#74)·피부색은 머리 재질 셰이더
  - 옷·장비: 칸마다 따로 만든 껍데기. `skin: true` 면 몸과 같은 `skinWeights` 규칙(체형 맞춤 뒤)으로 휨, 아니면 `bone` 에 붙음. 장비 하나는 정점 색으로 구워 한 메시(그리기 1번, 양면 재질만 따로). `covers` 로 덮는 몸 부위를 감춤(옷 사이로 몸이 안 뚫림), 모자는 `clip` 위로 나온 머리카락을 감춤. 상의·하의·신발은 늘 하나(없으면 'top:base'·'bottom:shorts'·'shoes:s1')
  - 새 옷: clothes.js 에 모양 함수 + balance.js CLOTHES 한 줄. 몸 부위 덮기는 COVER 표. 확인 `node tools/chars.js <이름>` (남·여 x 피부 3 x 단계 1·3·5 x 자세 5 표)
- 박자: pacing.js(연출 감독 #89, DOM 없음 — tools/pace.js 가 node 에서 그대로 돌림)
- 쓰레기·경제: balance.js · trash.js · cleanhouse.js · bloom.js/bloomfx.js · dumpers.js · achievements.js/badgeicons.js · dexicons.js · buff.js
- 가게·NPC: shops.js/streetlayout.js · stone.js/stoneicons.js/stonelogo.js · salon.js · leap.js · propmodel.js/model-*.js · photographer.js · fishing.js
- 적·전투: enemies.js/enemymodels.js · boar.js/boarmodel.js · hp.js · life.js(동물·귤) · lifemodels.js(노루·돌하르방 모양, model-deer.js·model-hareubang.js)
- 마차 부딪힘 (#117): collide.js 의 움직이는 부딪힘 `setDyn([x,z,r,...])` — 마차(rides.js createCart)가 매 프레임 자리를 넣음(모양은 balance.js CART.block). `col.move(..., dyn=true)` 와 서 있을 때 `col.nudge()` 는 플레이어(걷기·탈것·노루 타기)만 씀. 적·노루 AI 는 안 막힘. 확인 `node tools/cartblock.js`
- 몸 방향 (#107): bodytilt.js — `orientBody(root, heading, 기울기들)` 이 캐릭터 root 방향을 매번 처음부터 만들고 맞음 움찔·쓰러져 누움을 한 번에 합침, `flinchK(t)` 움찔 곡선. 내 캐릭터(update.js placeRunner·노루 타기)·멀티의 남(net.js)이 같이 씀. root 에 `rotation.y` 만 쓰지 말 것(지난 기울기가 남음). 확인 `node tools/hittilt.js`
- 탈것: rides.js · autowalk.js
- 멀티·저장: online.js · net.js · social.js · server.js(서버는 battle 하나·방 이름 roomFor·기기 통계, #98) · safetext.js · feedback.js · rank.js/rankday.js(랭킹 #11)
- 원스토어 앱 (#97): onestore.js — 웹게임 SDK 수명 주기. `main.js` 가 맨 먼저 읽고(진행률), 게임 쪽 할 일은 `start.js` 가 `onestore.connect()` 로 넘김. SDK 스크립트 태그는 `build.mjs` 가 index.html 머리에 넣음. 확인 `node tools/onestore.js`
- 오류 안전장치 (#108): crash.js — `main.js` 가 맨 먼저 `listenCrashes()`(error·unhandledrejection), `panels.js` 가 보낼 곳(POST /feedback, kind 'crash')을 붙임. `update.js frame()` 은 다음 프레임을 먼저 부르고 `step()` 을 try 로 돌림(오류 하나에 게임이 멈추지 않게). 적 한 마리 오류는 그 적만 지움(enemies.js), 적 모양 오류는 대신할 모양(enemymodels.js buildFallback). WebGL 화면 잃음은 scene.js(#gl-lost 안내 → 되살아남, 안 되면 다시 불러오기). 확인 `node tools/enemyrun.js [iphone|android|all] [--dead|--live]`
- 오류 알림 읽기 (#122): 서버 `GET /crashes?days=3`(로그인·Origin 없이, server/src/crashes.js 가 버전+오류 글로 묶음, 내보내는 칸은 오류 글·버전·기기 종류·브라우저/OS·마지막 한 일만, 60초 캐시, 값은 balance.js CRASHES). 자리 찾기 `node tools/crashmap.js <버전> <main-해시.js:줄:칸>`(그 버전 커밋을 임시 worktree 에서 소스맵 켜고 dev·release 빌드해 해시가 같은 것으로 원래 파일·줄·함수)
- UI: tutorial.js · tips.js · uitips.js · devlabels.js · logo.js · version.js · audio.js/stepsamples.js · music.js · page.html

## 결정 사항
- 풍경 바닥은 Pigs and Wolf 방식(2026-11-12 사용자 결정): 풀잎 없이 지형에 붓질 명암(G.paint, cloudShadow 안) + 꽃 무리(createFlowers). 억새는 오름 사면에만 포기 단위. 예전 풀잎은 ?blades 로만
- 게임 핵심: 조용한 탐험 + 매일 추가되는 상호작용·업적 + 귤로 아바타 꾸미기. 텍스트 최소화. 경쟁(경주·랭킹)은 넣지 않음
- 첫 실행은 입구 마당에서 시작, UI는 쓸 일이 생길 때 하나씩 노출, 갈림길 표지판으로 다랑쉬/돈내코 선택. 재방문은 마지막 맵에서 시작, (메뉴 다른 탐방로 버튼은 #88 에서 지움)
- 그래픽은 시안 씬5 방향(후처리 없음). 새벽·밤은 청록빛 몽환, 낮·노을은 자연스럽게 (2026-11-11 사용자 결정). 카툰·레트로 후처리는 메뉴 선택으로만
- 캐릭터는 똥머리 기본형. 옷장에 머리 모양 5종(똥머리·양갈래·낮은 똥머리·반묶음·꽁지머리)·머리색 6·피부색 5 무료 옵션, 모자·안경 기본 없음
- 기록은 브라우저 로컬 저장. 로그인 없음(경쟁 요소 생길 때 재검토). 도메인은 출시 때
- 폰트 Jua(제목)+Noto Sans KR. UI는 아이콘 중심, 파스텔 토큰
- Shift로 걷기·달리기·질주 전환, 체력 200, 귤 먹기 +80
- 별은 해가 -6°~-14° 사이에서 서서히 보임. 밤 밝기 상향, 가로등
- 업적 기획 고도화 예정: 단계형(귤 주기→친밀도→노루 타기) 업적

## 알려진 제한
- 공개 링크는 혼자 모드. 맵 전환은 새로고침
- 멧돼지·NPC·동물은 로컬 시뮬
- Messenger(abeto) 로딩 연출은 사용자가 어떤 점이 좋았는지 확인 필요(브라우저에서 못 봄)
- 억새가 삼각형 수의 절반 이상. 더 줄이려면 포기 수나 원거리 생략 필요
- 돈내코 조릿대(납작한 덩어리)가 새 풀과 어울리지 않음
