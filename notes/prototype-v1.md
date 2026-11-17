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
진입점 `src/main.js` 는 바깥 모듈을 예전 순서대로 읽어 둔 뒤(`boot.js` 맨 먼저) 기능별 파일 `src/game/*.js` 를 아래 순서대로 import 한다. 이 순서가 곧 초기화 순서다. 파일 하나는 40KB 를 넘기지 않는다.

| 파일 | 하는 일 |
|---|---|
| state.js | 파일 사이에 주고받는 값. `state` = 여러 파일이 읽고 바꾸는 값(예전 let), `late` = 앞 파일이 부르는 뒤 파일의 함수·객체 |
| save.js | 공용 도구($·isTouch·clamp·wrapA), 저장 불러오기·예전 저장 고치기·persist, 맵·서버 결정, 장비→겉모습 |
| scene.js | 렌더러·장면·빛·성능 단계 적용, 실제 제주 시각의 해·하늘, 날씨 반영 |
| place.js | 소품(표지석·벤치·징검돌·하르방·돌탑), 사물 충돌, 돌담, 들머리 개울, 가게 거리, 쓰레기·오름 안 클린하우스·꽃, 마차, 러너(player), HP |
| camera.js | 카메라, 첫 화면 궤도 |
| hud.js | 위 한 줄·토스트·배너 자리, 상황 팁, 패널 닫기, 업적, 도감 |
| input.js | 키보드·조이스틱·멀티터치·시점·핀치, 속도 |
| menu.js | 처음부터 다시, 개발자 버튼, 배경 음악, 동작(이모트) 버튼 |
| throw.js | 귤 던지기·귤 활·조준 표시·화면 밖 적 방향 |
| panels.js | 채팅, 메뉴 항목, 릴리스 노트, 의견 보내기, 도움말 |
| ride.js | 탈것(스케이트보드·스쿠터·조랑말), 마차 |
| moves.js | 노루 타기, 점프, 벤치에 앉기, 돌탑 소원, 사진사 사진 |
| room.js | 함께(net·social), 이모트 연결, 사진사 NPC, 입장 세션 |
| stores.js | 레스토랑 스톤, 가게 팝업 틀, 루이네 미장원, LEAP, 버프 표시, 가장자리 가게 표시, 상호작용(F)·줍기(E) 키 |
| pickup.js | 줍기·배낭, 구역 확인, 더미·꽃밭 효과 |
| dump.js | 클린하우스(버리기·화살표·자동 걷기), 상호작용 버튼이 고르는 할 일 |
| shop.js | 상점 팝업(장비 탭)·사는 연출, 옷 |
| look.js | 캐릭터 고르기·머리·옷장, 표지판, 탐방로 고르기 |
| hooks.js | 소리, 동물·적·투기꾼 후크, 받혀 구르기, 귤 효과, 긴장 음악 |
| start.js | 서버 고르기, 첫 화면 시작, 로그인 |
| update.js | 매 프레임 갱신(updatePlayer·frame), 해돋이 보기, 멀리 있는 작은 물체 감추기 |
| debug.js | 튜토리얼·낚시 연결, 개발용 라벨, 성능 단계 메뉴, `window.__oreum` |

규칙
- 뒤 파일은 앞 파일 값을 그냥 import 한다(export/import). 앞 파일이 뒤 파일 함수를 불러야 하면 뒤 파일이 `late` 에 넣고 앞 파일은 `late.이름` 으로 부른다(이벤트·매 프레임에서만, 읽는 중에는 못 씀)
- 여러 파일이 바꾸는 값은 `state.이름` (예: `state.emo`, `state.fishing`, `state.throwAim`)
- 수치는 `src/balance.js` 그대로
- 지난 변경 기록(이슈별 메모)은 `notes/history.md`

그 밖의 모듈 (src/)
- 맵·그림: boot.js(맵 결정, 맨 먼저) · namsongi.js/namsongidata.js(남송이 지형) · world.js · gfx2.js · toon.js · sun.js · weather.js · halla.js · maps.js · nsbound.js · zones.js · trailshape.js · stonewall.js/wallmodel.js · stream.js/streamshape.js · gate.js/donnaeko.js(숨긴 예전 맵) · lamps.js · retro.js · quality.js
- 캐릭터·장비: runner.js/runnermodel.js/dqskin.js · gear.js · clothes.js/clothicons.js · emotes.js · footprints.js
- 쓰레기·경제: balance.js · trash.js · cleanhouse.js · bloom.js/bloomfx.js · dumpers.js · achievements.js/badgeicons.js · dexicons.js · buff.js
- 가게·NPC: shops.js/streetlayout.js · stone.js/stoneicons.js/stonelogo.js · salon.js · leap.js · propmodel.js/model-*.js · photographer.js · fishing.js
- 적·전투: enemies.js/enemymodels.js · boar.js/boarmodel.js · hp.js · life.js(동물·귤)
- 탈것: rides.js · autowalk.js
- 멀티·저장: online.js · net.js · social.js · server.js · safetext.js · feedback.js
- UI: tutorial.js · tips.js · uitips.js · devlabels.js · logo.js · version.js · audio.js/stepsamples.js · music.js · page.html

## 결정 사항
- 풍경 바닥은 Pigs and Wolf 방식(2026-11-12 사용자 결정): 풀잎 없이 지형에 붓질 명암(G.paint, cloudShadow 안) + 꽃 무리(createFlowers). 억새는 오름 사면에만 포기 단위. 예전 풀잎은 ?blades 로만
- 게임 핵심: 조용한 탐험 + 매일 추가되는 상호작용·업적 + 귤로 아바타 꾸미기. 텍스트 최소화. 경쟁(경주·랭킹)은 넣지 않음
- 첫 실행은 입구 마당에서 시작, UI는 쓸 일이 생길 때 하나씩 노출, 갈림길 표지판으로 다랑쉬/돈내코 선택. 재방문은 마지막 맵에서 시작, 메뉴 '다른 탐방로'는 입구로
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
