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
| hud.js | 위 한 줄·토스트·배너 자리, 상황 팁, 패널 닫기, 업적, 도감, 귤 숫자 늦게 올리기(gyulFx·gyulLand·gyulExpect) |
| director.js | 감독(#176): `src/director.js` 를 게임에 붙임. 말을 거는 것은 `director.ask(kind, id, show)`·`say(kind, id, text, sec)` 로 한 번에 하나씩(우선순위·간격·싸움 중 제한), 문 열기(`register({ id, gate, intro, kind, clue })`, 순서·조건은 balance.js JOURNEY, 사실 값 FACTS), 한가할 때 실마리, 끝을 모르는 창은 `holdWin`. `late.director`, `__oreum.director`, 확인 `node tools/journey.js` |
| input.js | 키보드·조이스틱·멀티터치·시점·핀치, 속도 |
| menu.js | 처음부터 다시, 개발자 버튼, 배경 음악, 동작(이모트) 버튼 |
| inbox.js | 받은 의견 보기 (#96): 어드민 개발자 메뉴 "받은 의견" 패널·새 글 점 (`getFeedback`, 마지막 본 id 는 기기 `oreumoreum.inbox.seen`) |
| throw.js | 귤 던지기·귤 활·조준 표시·화면 밖 적 방향. 골라 쓰는 무기(`save.weaponUse`), 3~6단계면 `late.fireArm` |
| arms.js | 무기 3~6단계(#123): 귤 총·머신건(누르고 있으면 연사)·귤즙 레이저(누르는 동안 줄기)·귤 폭탄(던지기 동작으로 포물선), 탄 표시, 무기 고르기(`chooseArm`, 던지기 버튼 옆 ▾ → 내 가방 무기 탭), 멀티 presence `wf`. 효과 `src/weaponfx.js`, 손에 든 모양 `src/weaponmodels.js`, 소리 `src/weaponsound.js` |
| charge.js | 모아 쏘기(#129): 던지기 버튼(F)을 길게 눌렀다 놓기. `pressFire`(stores.js throwAct.act) → 누르는 동안 모음(`tickCharge`, update.js 에서 tickArms 앞) → 놓으면 `fireCharged`. 손·활은 `state.chargeShot` 을 throw.js release 가 씀, 총·머신건·레이저·폭탄은 arms.js `chargedArm`. 이동 느려짐 `late.chargeSlow`, 사거리 `late.chargeRange`, 맞음 `life.hooks.chargeHit`(enemies.js hurt 의 ch), 멀티 presence `cg`·wf 7번째 칸. 효과 `src/chargefx.js`, 수치 balance.js CHARGE. 확인 `node tools/charge.js` |
| panels.js | 채팅, 메뉴 항목, 릴리스 노트, 의견 보내기, 도움말 |
| screen.js | 전체 화면 버튼·메뉴 항목(안 되는 곳은 홈 화면 추가 안내), 돌릴 때 바로 맞추기 (#105) |
| ride.js | 탈것(스케이트보드·스쿠터·조랑말), 마차. 고르기 `chooseRide` (창은 내 가방 탈것 탭) |
| moves.js | 노루 타기, 점프, 벤치에 앉기, 돌탑 소원, 사진사 사진 |
| room.js | 함께(net·social), 이모트 연결, 사진사 NPC, 입장 세션 |
| stores.js | 레스토랑 스톤, 가게 팝업 틀(`SHOP_POP`: 가게마다 head·fill·tabs, 장비점 gear·가게 안내 dir 는 shop.js 가 채움), 루이네 미장원, LEAP, 버프 표시, 가장자리 가게 표시, 가게 안내도 상호작용, 상호작용(F)·줍기(E) 키 |
| pickup.js | 줍기·배낭(줍기 버튼으로 가까운 쓰레기까지 걷기 #104), 구역 확인, 더미·꽃밭 효과 |
| area.js | 구역 구분(#136): 문턱·구역 소품(`src/zonelook.js`) 만들기, 구역이 바뀌면(`late.zoneEnter`) 이름 배너·권장 점수 경고·첫 정낭 팁·구역 소리·안개, 오름 지도(위 구역 칸을 누르면) |
| deernet.js | 멀티 노루 (#92): 노루 무리는 방장이 알림, 노루 타기는 방이 관리, 다른 사람 귤 먹이 부탁 |
| dump.js | 클린하우스(버리기·화살표·자동 걷기), 상호작용 버튼이 고르는 할 일 |
| field.js | 맵 전체 쓰기(#138): 적 소굴(가까이 가면 적 → 다 쫓아내면 닫힘·귤 묶음, `late.denLoot` 자리)·숨은 보물(하루 한 번 상호작용, `late.treasureLoot` 자리)·볼거리(처음 가까이 가면 도감·귤), 길 밖 걷기 느림(`late.fieldSlow`), 가 본 곳(save.field.fog)·큰 지도 아이콘(`late.fieldMap`)·미니맵(#minimap), 자동 걷기 길 밖 우회(autowalk.js `setRoutePass`), `__oreum.field` |
| guard.js | 구역 지킴이 돌하르방(#119): 구역 더미를 모두 치우면 구역 자리(길 옆, `late.guard.spots`)에 솟아오름(꽃 연출 뒤·흙먼지·빛 기둥·꽃잎·카메라 한 번 보기)·메시지, ZONE_GUARD.holdSec 뒤 가라앉음. 세운 시각은 방(roomcore `zg`)이 주인, 옛 서버·혼자 하기는 save.zg. `__oreum.guard`, 확인 `node tools/guard.js` |
| shop.js | 장비점 창(#128: 도구·배낭·무기 세 묶음, 폰은 탭)·사는 연출, 가게 안내(무엇을 어디서·`goShop(id)` 길 안내 → 도착하면 창·`shopGuide()` 메뉴/귤 칸), 살 수 있는 새 물건 점(지붕 간판·귤 칸, 본 것은 기기 localStorage), 미니맵 가게 아이콘, 내 가방 옷 줄(`buildWearRows`) |
| look.js | 캐릭터 고르기·머리, 표지판, 탐방로 고르기 |
| bag.js | 내 가방(#166): 배낭 칸·B·메뉴로 여는 한 창(`#wardrobe` 패널, 카메라 `cam.mode 'wardrobe'`), 탭 옷·무기·도구·배낭·탈것, 장비 점수·능력 4줄, 없는 것 [사러 가기]. `late.openBag(tab)`·`closeBag`·`bagRefresh`(예전 `openWardrobe`·`closeWardrobe`·`buildWardrobe` 이름도). 탈것·무기 고르기는 ride.js `chooseRide`·arms.js `chooseArm`. 확인 `node tools/bag.js` |
| hooks.js | 소리, 동물·적·투기꾼 후크, 받혀 구르기, 귤 효과, 긴장 음악 |
| pace.js | 연출 감독 연결(#89): `src/pacing.js` 차례대로 투기꾼·트럭·몹 부르기(조짐·보상), 긴장(state.tension)을 화면 가장자리·하늘·카메라·HP 막대·음악에, 지루할 때 작은 즐거움, 맞힌 순간 멈춤 |
| guide.js | 첫 투기꾼 안내(#135): 보이는 자리·카메라 슬쩍 보기·머리 표시·버튼 빛남·칭찬/아쉬움 토스트, 저장 save.pace.hint (pace.js 가 부름, 파일 순서는 pace 앞) |
| zonedone.js | 구역 완료(#139): 구역 완료 요약 한 장(`#zdone`), 깨어나는 곳(마지막으로 지난 구역 클린하우스, hp.js `startAt` → `late.wakeAt`), 다시 들어올 때 고르기(`#wake-pick`, start.js → `late.afterEnter`), 구역을 끝낸 사람의 빠른 마차(구역 클린하우스 옆 → 가게 거리)·지름길(구역 들어오는 곳 → 위쪽 끝), 구역 기록(줍기·쫓아내기). 저장 `save.boss`. 파일 순서는 pace 뒤(적 후크를 감쌈) |
| boss.js | 구역 우두머리(#139): 구역 80% 에 빈터(field.bosses)에 나옴, 그 구역 적을 키운 모양(enemies.js `spawnBoss`)·왕관·발밑 고리, 패턴(돌진·무리 부르기·광선, 바닥 경고)·단계(50%·20%)·화면 위 기운 줄(`#boss-bar`), 쫓아내면 느린 화면(`state.slowMo`)·귤·귀한 재료·돌하르방(`late.guard.raise`)·요약. 멀티는 방장이 굴림(`bs`·`bh`·`bd`). `__oreum.boss`, 확인 `node tools/boss.js` |
| loot.js | 전리품(#140): 적(`life.hooks.enemyRepel` 감쌈)·소굴(`late.denLoot`)·보물(`late.treasureLoot`)·우두머리(`late.bossLoot`)가 재료·장비를 떨굼 → 분수·등급 색 빛기둥·빨려 듦(`tickLoot`), 장비 견주는 창 `#loot-pop`(바로 입기·귤로 바꾸기), 단계를 사면 예전 것 정리(`late.tierUpLoot`·`lootTidy`), 전설 효과 갈라짐(`hooks.afterHurt`), 도감 재료·전설 칸(`late.dexExtra`). 셈은 `src/loot.js`, `__oreum.loot`, 확인 `node tools/lootlive.js` |
| forge.js | 강화(#140): 장비점 창 [사기 | 강화] (shop.js `gearTabs`·`fillGearShop` 를 감쌈), 칸 10개·지금 → 다음·필요한 것·[강화]·[가는 길], 재료 주머니·안 쓰는 장비·자동 정리 설정. `__oreum.forge` |
| quest.js | 퀘스트(#158): `src/quest.js`(차례·진행, DOM 없음)를 게임에 붙임. 주는 사람(오름지기·구역 표지판·가게 주인)과 머리 위 !·?, 상호작용 → 받기·끝내기 창(`#quest`), 추적 줄(`#quest-track`, 누르면 dump.js `startAutoGo`), 퀘스트 창(`#qlog`, L·메뉴), 지도 표시 `late.questIcons`, 셈(ach.emit 감쌈·trash.on·`late.questEv`), 할인권 `late.questOff`·`questUse`, 감독 문 quest·shopQuest·shopQuests. 표는 balance.js QUESTS. `__oreum.quest`, 확인 `node tools/questrun.js` |
| season.js | 철 이벤트(#180 크리스마스): 켜짐(서버 날짜·어드민 미리 보기), 꾸밈 만들기·숨기기, 쌓인 눈(`NSW.zoneSnow`), 트리(`GET /season` 합계)·접속 달력(`#xmas`)·산타 투기꾼 선물 상자·눈덩이·루돌프·성탄 인사·뱅쇼 빛. `late.season`(isOn·dress·repel·snowThrow·tick·fixed), `__oreum.season`, 확인 `node tools/xmas.js` |
| level.js | 레벨과 증강(#159): 경험치 받기(`late.lvGain(why, n)`: 쓰레기·더미 trash 사건, 적 enemyRepel 감쌈, 투기꾼 hooks.js, 우두머리 boss.js, 퀘스트 #158), 레벨업 빛·소리·'레벨 N!', 위 줄 레벨 칸(`#lv-pill`, 고를 증강 배지), 고르기 창(`#aug-pick`, 혼자면 `state.augPause` 로 멈춤·멀티는 잠깐 무적), 감독 문 'level', 싸움 증강(enemies.js `hooks.afterHurt`: 터지는 귤·신 귤 `e.sour`), 귤 한 입, 꽃길·가벼운 발 `late.augSpeed`, 내 가방 줄 `late.augFoot`. 셈·저장은 `src/augments.js`. 파일 순서는 boss 뒤. `__oreum.level` |
| punk.js | 오름펑크 아이템(#164): 감귤 박스 헬멧 박스 시야(`#box-view`)·'퉁' 소리(`late.boxThud`), 해녀 테왁 배낭(배낭 겉모습 save.backs, 장비점 카드 `late.backCards`·내 가방 줄 `late.backLookRow`, 망사리 불룩 state.backFill, 개울에 뜸 `stream.hooks.float`·`late.tickSwim`·state.swim). `__oreum.punk`, 확인 `node tools/punk.js` |
| buddies.js | 동료 캐릭터 3명(#172): 감독 문(mateSunja·mateMinsu·mateJenny)이 열리면 나옴, 길 따라 돌아다니기·줍기(`trash.buddyTake` → 방 btake, 내 줍기의 BUDDIES.share 까지·마지막 keep 남김)·민수 귤 던지기·인사·말 걸기 창(#mate-talk)·같이 가요·감정 표현 따라 하기·박수/환호/걱정·밤 평상. 내 화면에만(서버로 안 보냄), 대사 `src/buddylines.js`, 수치 balance.js BUDDIES. `late.buddies`, 확인 `node tools/buddies.js` |
| rec.js | 게임 안 촬영 모드(#185): 메뉴 설정 '촬영' → 빨간 점(`#rec-ui`, V)으로 녹화. 게임 캔버스만 숨은 2D 캔버스에 가운데 9:16 로 잘라 그림(update.js 가 그린 뒤 `late.recFrame`) → `captureStream`+`MediaRecorder`(mp4 → webm), 게임 소리 `sound.master` → MediaStreamDestination, 로고 글자, 3분 한도·30/60초 알림, 프레임이 떨어지면 화질 한 단계↓, '방금 30초'(PC, 녹화기 둘 엇갈림), 저장/공유 창 `#rec-ready`. 저장 save.rec, 수치 balance.js REC, `__oreum.rec`, 확인 `node tools/rec.js` |
| start.js | 첫 화면 시작, 로그인, 랭킹 (서버 고르기는 #98 에서 없앰: 전투 오름 하나) |
| update.js | 매 프레임 갱신(updatePlayer·frame), 해돋이 보기, 멀리 있는 작은 물체 감추기 |
| debug.js | 튜토리얼·낚시 연결, 개발용 라벨, 성능 단계 메뉴, `window.__oreum` |

규칙
- 뒤 파일은 앞 파일 값을 그냥 import 한다(export/import). 앞 파일이 뒤 파일 함수를 불러야 하면 뒤 파일이 `late` 에 넣고 앞 파일은 `late.이름` 으로 부른다(이벤트·매 프레임에서만, 읽는 중에는 못 씀)
- 여러 파일이 바꾸는 값은 `state.이름` (예: `state.emo`, `state.fishing`, `state.throwAim`)
- 수치는 `src/balance.js` 그대로
- 지난 변경 기록(이슈별 메모)은 `notes/history.md`

그 밖의 모듈 (src/)
- 맵·그림: boot.js(맵 결정, 맨 먼저) · inapp.js(인앱 브라우저 안내, 페이지 맨 앞 인라인, #118) · namsongi.js/namsongidata.js(남송이 지형) · world.js · gfx2.js · toon.js · sun.js · weather.js · halla.js · maps.js · nsbound.js · zones.js · trailshape.js · stonewall.js/wallmodel.js · stream.js/streamshape.js · gate.js/donnaeko.js(숨긴 예전 맵) · lamps.js(가로등, model-lamp.js) · lampaim.js(가로등 팔이 길 쪽을 보게 돌림각·자리 다시 잡기, #174, scene.js 가 부름) · retro.js · quality.js
- 캐릭터·장비: runner.js · basebody.js · runnermodel.js/dqskin.js · gear.js · clothes.js/clothicons.js · emotes.js · footprints.js · lookcolors.js(처음 고르는 기본 옷 색 #155: `tintGear` 가 기본 옷 4종을 `id~번호` 장비로, 색 동그라미 `colorDots`)
- 캐릭터 구조 (#106): 뼈대 7개(hips·chest·head·armL·armR·legL·legR, 듀얼 쿼터니언 dqskin.js) 하나에 세 겹을 얹는다
  - 기본 몸 `basebody.js`: 옷 없는 매끈한 몸 한 메시(몸통+목·팔·벙어리장갑 손·다리·발). 몸통 단면은 옷과 같은 표(clothes.js TORSO·HIPS)에서 조금 안쪽. 정점마다 부위 번호(REGION: neck chest waist pelvis upperarm forearm hand thigh shin foot). 남·여는 `bodyWarp`(허리·골반 폭)만 다르고 머리 모양으로 정함(runner.js `bodySex`: 단발·똥머리 = 여, `outfit.body` 가 있으면 그것). 피부색은 재질 색, 발은 양말 색(cFoot)
  - 머리: 머리 장비(gear.js 'hat:short|bob|bun', Tripo 머리, 머리 뼈에 붙음)를 쓰면 그것만. 아니면 runnermodel.js(Tripo)의 목 위 삼각형만 남긴 메시(구운 초록 모자). 눈 깜빡임(#74)·피부색은 머리 재질 셰이더
  - 옷·장비: 칸마다 따로 만든 껍데기. `skin: true` 면 몸과 같은 `skinWeights` 규칙(체형 맞춤 뒤)으로 휨, 아니면 `bone` 에 붙음. 장비 하나는 정점 색으로 구워 한 메시(그리기 1번, 양면 재질만 따로). `covers` 로 덮는 몸 부위를 감춤(옷 사이로 몸이 안 뚫림), 모자는 `clip` 위로 나온 머리카락을 감춤. 상의·하의·신발은 늘 하나(없으면 'top:base'·'bottom:shorts'·'shoes:s1')
  - 새 옷: clothes.js 에 모양 함수 + balance.js CLOTHES 한 줄. 몸 부위 덮기는 COVER 표. 확인 `node tools/chars.js <이름>` (남·여 x 피부 3 x 단계 1·3·5 x 자세 5 표)
  - 체형 치수 (#177): clothes.js 의 TORSO·HIPS(몸통 단면)·ARM·LEG·LEG_R(다리 단면)·BODY(가랑이·골반 관절 hipY·무릎 경계) 표 하나. runner.js 뼈대 골반 관절도 BODY.hipY. 옷이 몸을 뚫는지 `node tools/fit.mjs`
- 철 이벤트 (#180): seasoncal.js(날짜·달력·트리 셈, 서버 validate.js·accounts.js 도 씀) · season.js(꾸밈 모양). 수치 balance.js SEASON. 서버 `GET /season`, 저장 save.season.xmas
- 박자: pacing.js(연출 감독 #89, DOM 없음 — tools/pace.js 가 node 에서 그대로 돌림)
- 감독: director.js(#176, DOM 없음 — tools/journey.js 가 node 에서 30분 시간표를 뽑음). 설계는 notes/journey.md
- 전리품·강화 셈 (#140): loot.js (순수 함수: 드롭 굴리기·강화 값·입기·귤로 바꾸기·저장 바로잡기 normLoot, 서버 validate.js 도 씀)
- 퀘스트: quest.js(#158, DOM 없음: 줄기 하나씩·곁가지·진행·옛 저장 건너뛰기·할인권). 게임 연결은 game/quest.js, 표는 balance.js QUESTS
- 쓰레기·경제: balance.js · trash.js · cleanhouse.js · bloom.js/bloomfx.js · dumpers.js · achievements.js/badgeicons.js · dexicons.js · buff.js
- 레벨·증강 (#159): augments.js — 저장만 읽는 순수 함수(레벨 곡선 `levelOf`·`xpAt`, 저장 고치기 `lvSave`, 증강 값 `augV(save, id)` = 겹친 수 × v, 뽑기 `rollDraw`, 옛 저장 경험치 `oldXp`, 서버 확인 `checkLv`). 능력치 자리마다 장비 값에 더함: 큰손 pickup.js·자석 귤 hooks.js pickR2·분리수거 달인 dump.js·쌍귤 throw.js/arms.js(덤 귤 `tg.twin` 은 못 주움)·빠른 손 charge.js·두꺼운 잠바 hooks.js·노루 친구 ride.js/update.js. 수치 balance.js LEVEL·AUGMENTS. 서버 validate.js·roomcore(`lv` 이름표)·heaps.js(분리수거 몫)
- 장비 점수 (#137): gearscore.js — 저장(save)만 읽는 순수 함수 `gearScore(save)`(합·줍는 힘·싸우는 힘)·`scoreDiff`(상점·옷장 ▲/▼)·`zoneTone`(구역 빨강/노랑/초록). 수치는 balance.js GROWTH·ZONES rec. 게임(hud·pickup·shop·stores)·멀티 이름표(net.js)·`tools/econ.js` 가 같이 씀. 등급·강화는 save.gearUp / save.clothes.up 자리만
- 가게·NPC: shops.js(가게 건물 표·지붕 아이콘 간판 `createRoofSigns`·들머리 안내도)/streetlayout.js · hardware.js(장비점 임시 모양, #128) · stone.js/stoneicons.js/stonelogo.js · salon.js · leap.js · propmodel.js/model-*.js · photographer.js · fishing.js
- 적·전투: enemies.js/enemymodels.js · enemypack.js(#146 적끼리 밀어내기·무리 자리 나누기, `e.pack`·`e.slotA`·`e.close`, 막힘 판정 `life.hooks.enemyPass` 는 game/field.js, 수치 ENEMY_PACK) · boar.js/boarmodel.js · hp.js · life.js(동물·귤) · lifemodels.js(노루·돌하르방 모양, model-deer.js·model-hareubang.js)
- 전투 손맛 (#148): 타겟 고정은 game/throw.js(`state.lock`·`refreshLock`·`aimTarget`(사거리 안일 때만)·`lockFar`·Tab `cycleLock`·화면 누르기 `pickLock`), 유도는 homing.js `steer(v, p, t, dt, rate)` (life.js 손 귤·화살, weaponfx.js 총·머신건). aimTargets 항목의 `ok()`(아직 맞힐 수 있음)·`chase`(나를 쫓음). 적 받기 상태는 enemies.js(charge → wind → dash → back / stagger, `hesitate()`), 받힌 뒤 무적·깜빡임 `player.iframe`(hooks.js enemyHit·update.js). 공격 뒤 쉼 `e.rest`(ENEMIES.rest, #149), 돌진 빠르기 ENEMIES.rush. 수치 balance.js COMBAT. 확인 `node tools/fight.js [구역…] [--move]`
- 마차 부딪힘 (#117): collide.js 의 움직이는 부딪힘 `setDyn([x,z,r,...])` — 마차(rides.js createCart)가 매 프레임 자리를 넣음(모양은 balance.js CART.block). `col.move(..., dyn=true)` 와 서 있을 때 `col.nudge()` 는 플레이어(걷기·탈것·노루 타기)만 씀. 적·노루 AI 는 안 막힘. 확인 `node tools/cartblock.js`
- 몸 방향 (#107): bodytilt.js — `orientBody(root, heading, 기울기들)` 이 캐릭터 root 방향을 매번 처음부터 만들고 맞음 움찔·쓰러져 누움을 한 번에 합침, `flinchK(t)` 움찔 곡선. 내 캐릭터(update.js placeRunner·노루 타기)·멀티의 남(net.js)이 같이 씀. root 에 `rotation.y` 만 쓰지 말 것(지난 기울기가 남음). 확인 `node tools/hittilt.js`
- 구역 구분 (#136): zonelook.js — `findGates`(탐방로가 초보·중수·고수 경계를 넘는 곳), 문턱(초보→중수 열린 정낭+낮은 돌담 `stonewall.js createPens`, 중수→고수 바위 문+방사탑)·안내판(구역·적 그림·권장 점수, 한 메시), 구역 소품(들꽃·억새·돌무더기·쓰러진 나무·그을린 자국·까마귀: 플레이어 둘레만 한 메시에 다시 씀, 부딪힘 없음), 땅·풀 색 `namsongi.js uMood`. 수치는 balance.js ZONE_LOOK. 게임 연결은 game/area.js
- 맵 전체 쓰기 (#138): heapdefs.js(더미 목록·HEAP_SIG, 서버 server/src/heaps.js 와 같이 씀. 길가 더미 뒤에 들판 더미 `field: true`) · fieldplan.js(8자 고리: 구역 길을 오르막 쪽으로 돌려 클린하우스 높이로 아래·위 반, `placeSide` 왼쪽/오른쪽 들판에 놓기, 굼부리처럼 길이 안 들어가는 구역은 옆 길의 25~65m 옆) · field.js(소굴·보물·볼거리·우두머리 빈터 자리와 모양, 들판 더미 위 까마귀·연기, 종류마다 InstancedMesh). 수치 balance.js FIELD·FIELD_HEAPS·HEAP.sizes.mt·ZONES chMax. 확인 `node tools/field.js [--shot]`
- 구역 우두머리·구역 완료 (#139): 우두머리는 적 하나(enemies.js `spawnBoss`: 모양 k 배·`e.boss`·`e.ctl` 이 패턴, `e.puppet` 이면 자리를 받은 대로, `e.remoteHurt` 면 피해를 방장에게). 수치 balance.js ZONE_BOSS. 방 메시지 roomcore `bs`(방장 → 모두)·`bh`(→ 방장)·`bd`(방장 → 돌하르방 zg), 따로 셈 NET.bossPerSec. 깨어나는 곳은 hp.js `startAt`. 느린 화면은 update.js `state.slowMo`·`slowK`
- 탈것: rides.js · autowalk.js
  - 마차 모양 (#174): rides.js buildCartMesh(조랑말·콘테나 짐칸·줄무늬 천막·팻말·초롱, `fast` 면 말 둘 + 깃발 = `parkedFastCart`, zonedone.js 가 빠른 마차 팻말 뒤에 세움). 마부는 place.js `cartDriver`(buildRunner, 'ride' 자세, CART.driverR 안에서만 그림). 타는 자리 CART.seatPos·마부 자리 driverPos. 소리 audio.js `hoof`·`cartBell`. 확인 `node tools/cartshot.js [이름]` (HI=1 이면 높은 단계)
- 멀티·저장: online.js · net.js · social.js · server.js(서버는 battle 하나·방 이름 roomFor·기기 통계, #98) · safetext.js · feedback.js · rank.js/rankday.js(랭킹 #11)
- 원스토어 앱 (#97): onestore.js — 웹게임 SDK 수명 주기. `main.js` 가 맨 먼저 읽고(진행률), 게임 쪽 할 일은 `start.js` 가 `onestore.connect()` 로 넘김. SDK 스크립트 태그는 `build.mjs` 가 index.html 머리에 넣음. 확인 `node tools/onestore.js`
- 오류 안전장치 (#108): crash.js — `main.js` 가 맨 먼저 `listenCrashes()`(error·unhandledrejection), `panels.js` 가 보낼 곳(POST /feedback, kind 'crash')을 붙임. `update.js frame()` 은 다음 프레임을 먼저 부르고 `step()` 을 try 로 돌림(오류 하나에 게임이 멈추지 않게). 적 한 마리 오류는 그 적만 지움(enemies.js), 적 모양 오류는 대신할 모양(enemymodels.js buildFallback). WebGL 화면 잃음은 scene.js(#gl-lost 안내 → 되살아남, 안 되면 다시 불러오기). 확인 `node tools/enemyrun.js [iphone|android|all] [--dead|--live]`
- 오류 알림 읽기 (#122): 서버 `GET /crashes?days=3`(로그인·Origin 없이, server/src/crashes.js 가 버전+오류 글로 묶음, 내보내는 칸은 오류 글·버전·기기 종류·브라우저/OS·마지막 한 일만, 60초 캐시, 값은 balance.js CRASHES). 자리 찾기 `node tools/crashmap.js <버전> <main-해시.js:줄:칸>`(그 버전 커밋을 임시 worktree 에서 소스맵 켜고 dev·release 빌드해 해시가 같은 것으로 원래 파일·줄·함수)
- 바닥 표시 (#151): drape.js — 평평한 고리·원을 점마다 땅 높이에 맞춰 휨(튜토리얼 원·가는 곳 marker·타겟 aimMark·줍기 pickMark·돌진 조짐). 귤 모으는 범위는 gearscore.js `gyulPickR(save)` 하나(life.js 떨어진 귤·흩어진 귤, tutorial.js 귤, 가게 배낭 설명)
- UI: tutorial.js · tips.js · uitips.js · game/newver.js(새 버전 알림, #134) · devlabels.js · logo.js · version.js · audio.js/stepsamples.js · music.js · page.html

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
