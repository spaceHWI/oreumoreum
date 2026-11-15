# 오름오름 프로토타입 (2026-11-15, v0.20 · 아티팩트 버전 33)

Artifact(개발·테스트, 멀티 됨): https://claude.ai/artifact/7cea3use57e2Ag7tnrpeb7
GitHub Pages(공개, 혼자 모드): https://spacehwi.github.io/oreumoreum/ — 저장소 spaceHWI/oreumoreum, index.html 하나를 업로드하는 방식. 마지막 배포는 v0.16 (0.17~0.19는 아티팩트에만)
capabilities: room, user, db(stones/{self}, feedback/{self} — 개발자에게 보내기, notes는 미사용)
소스: /home/claude/oreum (로컬 git). dist/oreumoreum.html = 아티팩트용, dist/test.html = 로컬 playwright용
Cloudflare: Workers 배포용 API 토큰 oreumoreum-deploy(90일, 2027-02-05 만료) 발급됨. 멀티 서버(Durable Objects, 오름당 채널 분할)와 저장(SQLite)은 미구현
피드백 리포트(모의 사용자 30명): https://claude.ai/artifact/D7gyt4HATXAJdLBbk5Q636 — 우선순위 10개 표를 사용자와 하나씩 검토 예정 (1번 귤 경제부터)

## 남송이오름 (2026-11-15, v0.20)
지금 열린 맵은 남송이오름 하나. 사용자 계획: 남송이에서 모든 시스템을 다진다 → 실제 유저 테스트 → 다음 오름으로 확장
- 예전 맵(입구 마당·다랑쉬·돈내코)은 코드 그대로 두고 숨김. 주소 해시(#gate, #darangswi, #donnaeko)로만 열림. 저장된 맵 값은 더 이상 안 씀
- boot.js(맨 먼저 import): 맵 결정 + 남송이면 ColorManagement 끔(색을 화면 값 그대로, 시안과 같은 색), 텍스처 색 공간 TEXCS, 출력 Linear, 빛 세기 ×π
- namsongi.js: 시안(claude/namsongi-draft.md)을 게임에 옮김. 실제 1m = 1.4 단위(K). 높이 격자 하나를 땅·풀·걷기가 공유, 길 격자(surface), 나무 칸 LOD, 하늘·바다·구름, 해 고도별 빛(밤·새벽/노을·늦은 오후·낮), 그림자 따라가기. 후처리 없이 직접 렌더, 그래픽 메뉴는 기본/가볍게만
- namsongidata.js 고도 자료, toon.js 툰 명암 단계
- maps.js namsongiSpots: 들머리 시작, 정상 표지석, 돌탑 4, 하르방 3, 안내판, 가로등, 튜토리얼 지점(spots.tut), 징검돌
- tutorial.js: 지점 좌표를 맵에서 받음. 들머리 첫 140단위 안에 귤→하르방→징검돌→돌탑→속도, 끝나면 UI 전부 노출. 길을 벗어나 320 넘게 가면 그만둠. 기존 유저도 한 번 다시 봄(save.nsV1)
- 캐릭터: 남송이에서는 MeshToonMaterial(3단)
- 오늘의 업적은 남송이에서 가능한 것만 뽑음, '남송이 능선 오르기' 추가
- 미확인·남은 것: 실기기 성능, 나무·바위 충돌 없음, NPC·동물은 예전 재질 그대로, 조랑말 없음, 멀티 방 이름 oreum-namsongi

## 쓰레기 줍기 (2026-11-15, #8)
- balance.js: 수치 한곳(쓰레기 종류 비율·부피·귤, 배치 규칙, 장비 5단계 표 TOOLS·BAGS·SHOES). save.equip(tool·bag·shoes) 1~5, 상점은 #10
- trash.js: createLocalTrashStore 가 쓰레기 상태를 읽고 쓰는 유일한 곳(save.trash = date, picked 비트셋 base64, bag 종류별 개수, today, total). 멀티 때 같은 모양의 서버 저장소로 바꿔 끼움
- 배치: 한국 날짜 시드. 0~23999 흩어진 것(길 25 안 70%·그 밖 420 안, 뭉치는 자리 700+320), 24000~ 더미 60곳×50(40곳 길 옆). 바다·맵 밖 제외. 종류마다 InstancedMesh, 32단위 칸, 반경 110(LOW 70) 안만 그림. 5단위 움직이거나 주우면 다시 채움(0.5ms), 하루 배치 생성 약 60ms
- 줍기(main.js '줍기·배낭'): 도구 반경 안에 쓰레기가 있으면 상호작용 버튼이 '줍기'(다른 할 일 바로 앞이면 그쪽). 버튼·F·E 누르고 있으면 계속. 숙이기(crouch)·종류별 소리(audio.pick)·배낭으로 날아가는 연출. 배낭이 차면 #bag-pill.full(귤색)
- 자정(KST): 1초마다 날짜 확인 → 주운 기록만 지우고 새 배치. 배낭·누적은 유지
- 업적 이벤트: trash, trash-<종류>, heap-clear (정의는 #13). 테스트: window.__oreum.trash (fillClean(%), fillBag(부피, 종류), emptyBag, nearest, heaps, state)
- 임시: 쓰레기·더미 모양은 로우폴리 임시. 폰에서 해돋이 알약·힌트 위치를 배낭 알약 아래로 내림

## 클린하우스·귤 지급 (2026-11-15, #9)
- cleanhouse.js: 지붕 있는 정류장 꼴 + 통 5개(TRASH_TYPES 순서, 색은 balance.js CLEANHOUSE.binColors). 본체 한 메시로 합침, 뚜껑 5개만 따로(넣을 때 들썩). 밤 조명은 지붕 밑 등·바닥 빛웅덩이·PointLight 하나(LOW 는 없음, 늘 켜 두고 세기만 바꿈)
- 위치: maps.js namsongiSpots.cleanhouse = 들머리 approach 13 지점 오른쪽 7.5, 앞면이 길을 봄
- 버리기(main.js '클린하우스'): CLEANHOUSE.r(7) 안이면 상호작용 버튼 '버리기'(배낭에 뭔가 있으면 줍기보다 우선). 누르는 순간 배낭 비움·addCoins·save.recycle(visits, gyul) 저장·업적 이벤트 recycle, earn(귤 수). 그 뒤 1.9초 연출(쓰레기 최대 40개·LOW 20개가 종류별 통으로 날아감, 귤 숫자 올라감, audio.recycle)
- 배낭이 차고 14 넘게 떨어져 있으면 #ch-arrow: 화면 밖이면 가장자리에서 방향, 보이면 클린하우스 위에서 가리킴 + 거리
- 테스트: window.__oreum.cleanhouse (go, dump, recycle, api)
- 임시: 모양 로우폴리, 충돌 없음(#15), 쓰레기가 클린하우스 자리에도 깔림

## 상점·장비 강화 (2026-11-15, #10)
- 상점 패널(#shop)에 탭: 장비(기본)·옷(예전 색 구매 그대로). 장비 탭은 도구·배낭·신발 줄마다 단계 막대 5칸·지금 수치→다음 수치·다음 단계 구매 버튼(귤 모자라면 흐리게, 5단계면 MAX). 사면 save.equip 올리고 바로 착용·저장·net.send, 업적 이벤트 gear-buy, gear-buy-<tool|bag|shoes>
- 진입: 메뉴 '상점'(장비 탭) + 클린하우스 오른쪽 귤 가판대(cleanhouse.js 의 stall, 앞 CH.shopFront, 반경 CLEANHOUSE.shopR 3.2 안이면 상호작용 '상점'). 옷장의 '상점'은 옷 탭
- 효과: 도구 = TOOLS(per·time·r, 흡입기는 time 0.25 로 누르는 동안 초당 4개), 배낭 = BAGS.cap, 신발 = 이동 속도 × SHOES.speed (main.js want)
- 겉모습: gear.js 에 칸 hand 추가. TOOL_GEAR(hand:none·tongs·rake·bigrake·vacuum, armR 뼈에 쥠), BAG_GEAR(back:pack 기본·bag2~5, 몸 배낭 감춤), SHOE_GEAR(shoes:s1 기본·s2~5, 몸과 같이 휘는 한 켤레, 윗부분은 옷장 신발 색을 따라감). equipGear(save.equip) 를 main.syncEquipGear 가 outfit.gear 에 넣어 다른 사람에게도 보임
- 줍는 동작: runner.animate({tool, dur}) — 맨손 쪼그려 두 손, 집게 허리 숙여 한 손, 갈퀴·큰 갈퀴 앞에서 당겨 긁기, 흡입기 선 채로 좌우로 훑기(누르는 동안 유지)
- 확인 페이지: dist/char-motion.html?gear=hand:rake,back:bag3,shoes:s3&pose=crouch&tool=3&dur=1.3
- 임시: 도구·배낭·신발·가판대 모양 로우폴리 임시, 이름(balance.js name)도 임시

## UI (2026-11-15) — 현무암 시안 적용 (background-sian.md)
page.html: 토큰을 검은 유리(rgba(20,20,24,.5)+blur 12, 1px 흰 테두리 16%)·귤색 #ff8a1f 하나·Gothic A1 800/500 으로 바꾸고, 스타일 끝의 '현무암 UI 덮어쓰기' 블록에서 패널·버튼·팝업(흐린 유리 배경)·업적·옷장·상점·튜토리얼 카드를 다시 입힘
폰(폭 600 이하) 쉬는 화면 7개: 장소 알약, 귤+업적 링 알약(#ach-chip), 메뉴 버튼, 동작 버튼(말하기는 동작 안으로), 점선 조이스틱, 상호작용, 점프, 달리기(체력 링 #sta-ring). 걸음·업적·옷장·상점·탐방 안내·소리·설정은 아래 유리 시트(#menu). 귤 던지기는 노루·하르방·멧돼지가 가까울 때만(body.throw-near). 데스크톱 배치는 그대로

## 개발 프로세스
아티팩트에서 개발·테스트 → "배포해줘" 때만 버전 올리고 릴리스 노트 정리해 Pages에 업로드

## 모듈
world.js 지형(맵별 extent/seg 지원, groundColor)·탐방로·억새(바람+밟힘 밀림)·꽃·나무·접지 그림자(contactShadows)·밟는 구조물(addWalkable/groundAt)·원경(한라산 라테 산체)
gfx2.js 새 그래픽(아래)
gate.js 입구 마당(튜토리얼 맵: 본길+서·동 갈래, 쉼터·개울·표지판·출구 아치) / donnaeko.js 돈내코 / maps.js 맵별 spots(gate·darangswi·donnaeko, lamps, exits, pickupCount, npcCount)
tutorial.js 걸으며 배우는 튜토리얼(그림 힌트 카드, data-tut로 UI 순차 노출) / lamps.js 가로등(가까운 3개만 PointLight) / retro.js 후처리(카툰·레트로 모드, 깊이 윤곽선) / devlabels.js 개발용 라벨(UI-xx, W-xx, F2)
runner.js 러너(둥근 툰, 머리 1.3배, 똥머리 기본형 5종)·의상·포즈 / life.js 동물·귤·멧돼지(boarSpawn null이면 없음) / npc.js / net.js / social.js(stones, feedback) / achievements.js(일일 5개+뱃지 16) / badgeicons.js / audio.js(발소리 CC0 샘플 stepsamples.js) / sun.js / version.js(릴리스 노트) / main.js / page.html

## 그래픽 v2 (2026-11-11, gfx2.js) — 시안(proto/scene.js) 방식 그대로
MOODS(day·sunset·dawn·night, 시안 값)를 해 고도로 섞어 blendMood → 공용 색 G(잎·삼나무·구름·풀·억새·바다·안개·지형 색조)에 반영. main.applySky가 호출
렌더: 기본은 톤매핑 없이 HalfFloat 렌더타깃 → createPost(빛 번짐·채도·색온도·비네트·감마). '가볍게'는 후처리·풀·씨앗 없이 직접 렌더. 카툰·레트로만 ACES
softMat(조명 없는 2색 툰, 공용 색 또는 고정 색), fluffyGeo(뭉게 수관), cedarGeo(층층 삼나무), skyDome, cloudShadow(지형 색조+구름 그림자), seaMat, createGrass(플레이어 주변 칸 단위 풀 2겹), createEoksae(억새를 긴 날로, 다랑쉬 3.8만/저 1.6만), createMotes
저사양(LOW: 코어 4개 이하 또는 모바일)은 풀 밀도 45%·수관 덩어리 수 감소. 테스트는 ?hi 로 고사양 강제
삼각형 수: 다랑쉬 저사양 약 64만(이전 180만)
캐릭터: 캡슐·구 기반(시안 mochi), 눈·입 작게, 머리는 매끈한 캡+앞머리 2개+묶음
테스트 스크립트: view.js(맵·시간·위치별 스크린샷), chars.js, tris.js, dbgtree.js

## 캐릭터 모델 (2026-11-13)
기본 캐릭터 = 사용자가 직접 그린 캐릭터(인스타그램 insighthwi 2025-02-06, 담배 제거)를 아늑한 생활 게임풍 토이 스타일로 옮긴 모델 (2026-11-15 확정, model/src4.glb): 초록 스냅백 뒤로, 검은 머리, 얼굴에 인쇄한 듯 평평한 큰 세로 타원 눈, 분홍 볼, 코·입 없음, 머리는 키의 약 40%, 크림 재킷, 황갈색 배낭, 올리브 반바지, 흰 양말, 검정 운동화. 이전 생성본 src.glb(파란 모자)·src2.glb(보라 스냅백)·src3.glb(2등신 큰 눈)는 미사용. 시안은 Tripo 이미지 생성(무료)으로 그리고, 고른 그림을 이미지 편집으로 T포즈로 바꾼 뒤 '3D 생성'(55크레딧)으로 넘김. 모델별 관절 치수는 model/params.json, 옷 색 마스크 범위는 runner.js 셰이더. Tripo CLI는 API 크레딧이 스튜디오와 별도(잔액 0)라 미사용. Higgsfield 커넥터 연결됨(무료 요금제, 10크레딧).
runner.js: 옵션 없는 러너(나·다른 탐방객)는 SkinnedMesh. 뼈대 7개(hips·chest·head·armL/R·legL/R) 가중치를 정점 위치로 계산, 예전 도형 몸은 숨긴 채 동작 계산용으로 쓰고 syncModel이 뼈에 복사. 옷 색은 셰이더에서 텍스처 색+부위로 모자·상의·바지·신발만 바꿈
옷장은 지금 색 4종만(머리 모양·피부·안경·베스트·종류 옵션은 빠짐). NPC는 예전 도형 캐릭터 그대로
동작 (2026-11-15): 팔 가중치는 소매 중심선(armY·armZ·armR)에서 가까운 정점만, 관절은 몸통 옆면보다 조금 안쪽(pivotX). 스키닝은 듀얼 쿼터니언(dqskin.js, 그림자도 같이)이라 어깨·골반이 꺾여도 구겨지지 않음. 달릴 때 가슴이 다리와 엇갈려 돌고 머리는 앞을 봄. animate({slope}) 로 비탈 방향 기울기를 받아 몸을 숙이고 다리 흔들림 중심을 맞춘 뒤, 발이 비탈 아래로 들어가면 골반을 올림. main.js placeRunner: 걸음에 비례한 높이 변화는 바로 따라가고 계단처럼 끊기는 것만 부드럽게
장비 (gear.js): 칸(hat·face·back·top·bottom·shoes)마다 하나, outfit.gear 에 저장·네트워크로 전달. bone 에 붙는 단단한 것과 skin(몸과 같은 가중치로 휘는 옷) 두 가지. hide 로 몸 메시에 구워진 모자·배낭(끈 제외)·재킷·반바지·신발을 셰이더에서 감춤(새 장비가 덮어야 함). glb 장비는 model/extract-gear.js → src/gear/<이름>.js → fromData. 예시: 비니·버킷햇·선글라스·둥근 배낭·긴바지
캐릭터 확인 페이지: node sian/char-motion/build.mjs → dist/char-motion.html (기울기·속도·포즈·장비·시점 조절), sian/char-motion/shot.cjs 로 위상별 스크린샷
Tripo: 사업자 카드로 잘못 결제한 계정(spacehwi, Pro 연간)은 환불 요청 중(support@tripo3d.ai, 2026-11-12). 작업은 개인 카드로 1개월 결제한 다른 계정으로 진행

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

## 업적·도감 개편 (2026-11-15, #13)
- 오늘의 업적: DAILY_POOL 에 `ns: true` 인 것만 남송이 풀(`usable`). 쓰레기 10종(줍기 50/150·클린하우스 2/5·스티로폼·폐어구·더미·귤 100·정상 근처 20·해돋이/해넘이 때 10) + 유지 6(돌탑·인증샷·능선·걸음 2·쉼터). 정상 근처·해돋이 줍기 개수는 balance.js ACH(기획에 숫자가 없어 20·10으로 둠). 이벤트 trash-top / trash-sun 은 main.js trash.on 에서 냄
- 뱃지: 단계형은 BADGES 에 fam·tier 로 단계마다 한 항목(`b-trash-1`…), buildAch 가 fam 별 한 칸으로 묶음(받을 단계 → 다음 목표 → 마지막 단계 순). 줍기 4단계·클린하우스 3·더미 2·도감 3, 종류별 500개 5개, 개근 30일, 장비 하나/전부 최고(main.checkGearBadges). 기존 id·저장 그대로. 보상 귤 수치는 achievements.js 에 임시값
- 도감: balance.js DEX(흔한 4×5종 + 드문 2×5종 = 30종, 드문 확률 1/400, 귤 +20). 주울 때 trash.take 가 무작위로 정함(드문 것은 그 종류 안에서). 저장은 save.trash.dex(id→수, 예전 저장엔 없으면 {}) — trash 저장소에만 있음. 처음 얻으면 토스트·ach 'dex' 이벤트, 드문 것은 줍을 때마다 귤 +20
- 패널 #dex(메뉴 '도감'·업적 창 머리 버튼): 격자, 못 얻은 것은 실루엣·???, 드문 것은 귤빛 칸. 아이콘 dexicons.js(종류별 기본 모양 + 칸마다 색·장식, 드문 것 10개 개별)
- 테스트: window.__oreum.trash.dexForce(id)·dex()·dexList·openDex·checkGearBadges

## 돌탑 개편 (#12)
- 남송이 돌탑 3개(`ns-head` 들머리·`ns-ridge` 능선·`ns-rim` 정상). 한 사람당 돌탑마다 돌 하나, 다시 올리면 `at` 이 갱신돼 맨 위로 옮겨짐(social.placeStone)
- 수치는 `balance.js` 의 `CAIRN`(max 2000, step, bend, farD). main.js 의 InstancedMesh(툰 재질) 하나에 돌을 쌓고, 위로 갈수록 휘고 흔들림. 멀면(farD) 돌을 건너뛰어 크게 그림(`fillCairn` stride, LOW 는 5)
- 이전 id(`ns-crater`)로 올린 돌은 더 이상 표시되지 않음

## 튜토리얼 개편 (#17)
- `src/tutorial.js`: 단계 `move → pick(쓰레기 3개) → dump(클린하우스) → shop(집게) → stone(돌탑) → run(달리기 전환)`. 앞 단계가 끝나는 대로 다음 단계가 시작되고 그림 힌트 카드만 보임. 끝나면 `skipAll` 로 나머지 UI 전부 노출·`body.tut` 제거
- 알약은 `data-tut`: 배낭 `bag`(pick 시작), 귤 `gyul`(dump 끝), 깨끗한 정도 `clean`(마지막에 나머지와 함께). `notify(k, n)` 으로 trash(주운 수)·dump·stone·gait 를 받음
- shop 단계 시작 때 보상 귤 `spots.tut.reward`(100)를 한 번만 줌(`save.tut.paid`). 이미 집게 이상이면 안 줌
- 튜토리얼 쓰레기: `spots.tut.trash`(남송이 `maps.js`)의 3개를 `createTrash({ fixed })` 로 넘김. 번호는 N 이후(`N+k`), 날짜 배치·오늘/누적 수와 무관하게 늘 그 자리. 주운 기록은 `save.trash.tp`
- 저장 키 `save.nsV2`: 기존 유저도 튜토리얼 한 번 다시(`save.tut`·`save.trash.tp` 초기화). 예전 단계(귤 던지기·하르방·징검돌)는 튜토리얼에서만 빠짐

## 사물 충돌 (#15)
- `src/collide.js` `createCollide()`: 원 목록 + 8m 칸 격자. `add(x,z,r)`·`addBox(x,z,rot,hw,hd,ox,oz)`(폭 방향 원을 이어 근사)·`blocked(x,z,pad)`·`move(ox,oz,nx,nz,pr)`. 겹치면 법선 방향으로만 밀어내 옆으로 미끄러짐. 0.35m 단위로 나눠 움직여 빨리 달려도 안 뚫림. 수치는 `balance.js` `COLLIDE`
- 나무·길가 바위: `namsongi.js` 가 `buildNamsongi().solids`([x,z,r])로 내놓음(소나무 s×0.42, 참나무 s×0.3, 바위 s×0.9). 구조물(하르방·돌탑·가로등·표지석·벤치·안내판 기둥·클린하우스·가판대)은 `main.js` 의 "사물 충돌" 블록에서 `spots` 로 등록. 남송이에서만 켜짐(`col`, 테스트는 `__oreum.col`)
- 이동 적용: 걷기·넉백·노루 타기(반지름 0.9). 탭 이동은 0.5초 못 나아가면 멈춤(도착 콜백이 있고 3m 안이면 도착으로 침). 상호작용 거리(r 6~9)는 충돌 반경보다 넉넉함. 징검돌은 뛰어넘는 용이라 충돌 없음
- 쓰레기 배치: `createTrash({ blocked })` 로 충돌 반경+0.6 안은 피함(날짜별 배치가 이전과 달라질 수 있음)

## 실제 날씨 (#18)
- `src/weather.js`: Open-Meteo 현재 날씨를 30분마다 받아 7종(맑음·구름 많음·흐림·안개·비·눈·강풍)으로 분류, 실패하면 맑음. 값은 `balance.js` 의 `WEATHER`
- `main.js` 의 `applyWx()` 가 밤낮 계산 뒤에 빛·안개·하늘 회색기·구름 수·풀 흔들림(`NSW.wind`)을 덧씌움. 바뀔 때 약 6초 동안 천천히 섞임
- 비·눈 입자는 캐릭터 둘레 Points, 빗소리는 `audio.js` `setRain()`(합성 잡음). HUD 날씨 아이콘 `#wx-pill`
- 테스트: `__oreum.setWeather('rain')` (`null` 이면 실제 날씨로). 업적 `d-rainpick`(이벤트 `trash-rain`)
