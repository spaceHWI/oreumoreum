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
- (#26에서 팝업으로 바뀜) 진입: 메뉴 '상점'(장비 탭) + 클린하우스 오른쪽 귤 가판대(cleanhouse.js 의 stall, 앞 CH.shopFront, 반경 CLEANHOUSE.shopR 3.2 안이면 상호작용 '상점'). 옷장의 '상점'은 옷 탭
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

- 반딧불이(`gfx2.js` createMotes): 입자 좌표는 월드 기준. 플레이어에서 ±30 넘으면 60 상자 안에서 반대편으로 되감고, 높이는 입자 자기 위치의 땅 높이 기준 (#19)

### #20 업적 뱃지 플랫화
- `.bdg`(패널 뱃지·달성 배너 공용)에서 테두리·inset 그림자·하이라이트를 제거하고 단색 원 + 글리프만 남김. 못 얻은 뱃지는 흐린 단색(`#d8d2bf`, 글리프 opacity .3). 코드(`badgeicons.js`, `buildAch`)는 그대로, 스타일만 `src/page.html`.

## 발자국 (2026-11-15, #21)
- footprints.js: InstancedMesh 하나(최대 FOOTPRINT.max 60, LOW 30), 칸마다 알파 속성. stamp(x,z,heading,gait) 가 왼발·오른발을 번갈아 땅 기울기(높이 격자 법선)에 맞춰 찍음. 8초(FOOTPRINT.life) 중 뒤 60% 동안 서서히 사라지고, 가득 차면 오래된 것부터 덮어씀
- main.js countSteps 에서 걸음마다 호출(간격은 걷기 1.1·달리기 1.7·질주 2.1 그대로라 달릴수록 넓음, 질주·달리기는 조금 진하게). 점프 중(p.air)·노루 탈 때(p.riding)는 안 찍음. 탐방로·흙(surfaceAt != 0)은 알파 0.55, 풀밭 0.16. 수치는 balance.js FOOTPRINT
- 테스트: window.__oreum.prints (stamp, update, clear, live, max)

## 귤 던지기 동작 (#23)
- `runner.js` 에 `throw` 포즈 + `THROW`({release:0.45,total:1.0}) 추가: 준비(뒤로 젖히고 가슴 틀기) → 던지기 → 뻗은 채 머묾 → 복귀. 걷기·뛰기 하반신은 그대로, 서 있을 땐 발을 살짝 딛음
- `main.js` `throwTangerine()` 은 포즈만 시작, `releaseTangerine()` 이 poseT≥release 에 오른손(armR 끝) 위치에서 귤을 띄우고 귤 1개를 차감. 말 탄 상태는 즉시 던짐

## 볼터치 제거 (#24)
- 기본 캐릭터 텍스처: `model/fixcheek.py` 가 `lo4.glb` 의 UV 로 볼 둘레(rest 공간 |x| 0.05~0.24, y 0.55~0.77, 앞면) 텍셀 중 피부↔분홍 색 선 위에 있는 것만 피부 중간값으로 덮음(눈·머리카락 제외). 결과 `model/tex4.jpg` → `node model/extract.js model/lo4.glb model/params.json model/tex4.jpg` 로 `runnermodel.js` 재생성 (`tex3.jpg` 는 예전 UV 라 안 맞음)
- 도형 캐릭터(`buildRunner` 의 cheek 메시·재질) 삭제 → 탐방객·다른 플레이어 모두 볼터치 없음

## 멧돼지 모델 B3 (#22)
- 원본 `assets` 브랜치 `boar-b3.glb`(197만 삼각형) → `python3 model/bake-boar.py boar-b3.glb 1500 512 model/boar.glb`(bpy, 줄이기+텍스처 굽기) → `node model/extract-boar.js model/boar.glb` 로 `src/boarmodel.js`(약 114KB) 생성
- `src/boar.js` buildBoarModel: 한 덩어리 메시에 위치 기준 뼈 가중치(몸·머리·꼬리·다리 4). 남송이는 MeshToonMaterial+gradHard(캐릭터와 같음). `life.js` buildBoar 가 이걸 씀(legs4·머리·꼬리 그대로)
- 돌진(속도>4)할 때 머리를 0.25 rad 더 숙임. 크기·귤 판정은 `balance.js` BOAR (scale 2.0 → 키 약 1.54)
- 확인용: `__oreum.life.boarTest.spawn()` (바로 나타나게), `.get()`

## 맵 줄이기·현무암 돌담·쓰레기는 오름에만 (#25)
- `src/nsbound.js`: 걸을 수 있는 범위. 오름 무게중심에서 각도 720개마다 반지름 R(θ) — 오름 자락(솟은 높이 `BOUND.rel` 4m 넘는 마지막 곳)+여유 30, 들머리 접근로 양옆 24·시작/클린하우스/가판대 둘레 30 은 꼭 포함, 이웃 평균으로 부드럽게. `insideBy`·`inBound`·`clampBound`·`onOreum`(솟은 5m 넘고 돌담에서 10 안쪽)·`boundLine`·`gate`(시작점 뒤 탐방로 연장선이 경계와 만나는 곳, 시작에서 약 34)·`oreumPaths`(오름 위 탐방로 구간만). 둘레 약 4,000단위, 수치는 `balance.js` `BOUND`
- `src/stonewall.js`: 경계선을 따라 4단위 마디(돌 3켜, 틈·구멍 무늬)를 InstancedMesh 로, 40마디씩 덩어리로 나눠 `WALL.nearR`(230, LOW 150) 안 덩어리만 켬. 그 밖은 단순한 띠 하나(가까운 곳은 셰이더에서 버림). 지형 높이·기울기 따라감. 충돌은 마디마다 `col.addBox`(반두께 0.42) — 막히고 옆으로 미끄러짐. 정낭 입구: 정주석 둘 + 가로 정낭 하나 + 내려 둔 정낭 둘, 트여 보이지만 보이지 않는 막이 있고 가까이 가면 '정낭 너머는 아직 갈 수 없어요'. 정낭 밖으로 길 그림만 70 이어짐
- `maps.js` 남송이: `clamp` 는 돌담 바로 뒤 안전망(문구 없음, 예전 사각 경계·'아직 길이 없어요' 삭제), `inBounds`=경계 6 안쪽, 노루 무리 3곳 돌담 안으로 옮김, 멧돼지 등장은 돌담 안 방향을 여러 번 시도, 귤 줍기 자리도 돌담 안 길만
- `namsongi.js` `buildNamsongi({ bound })`: 돌담 자리(±4~5) 나무 비움, 밖 나무는 45%만·돌담에서 900 넘으면 없음·충돌 없음, 밖 바위·꽃 없음. 시작 지점 삼각형 64만→45만
- 쓰레기: `createTrash({ paths: oreumPaths, inBounds: onOreum })`. 들머리 평지·클린하우스·가판대·접근로(오름 자락 전)엔 없음, 시작에서 200 안 0개. 총량·비율 그대로, 오름 위 약 41만 m² 에 100m² 당 6.6개. 못 찾으면 탐방로 위로(예전엔 아무 데나). 튜토리얼 3개는 그대로
- 테스트: `__oreum.bound`(nsbound 전부), `__oreum.wall`(length, chunks, modules, nearR, lodR, tris())

## 상점 팝업 (2026-11-15, #26)
- #shop 팝업 하나: 위 가진 귤(+닫기 X), 탭 도구·배낭·신발·옷. 장비 탭은 5단계 칸 한 줄(.tiers: own 체크 / next 위 화살표·값 / lock 자물쇠). 칸을 누르면 아래 .tier-detail 에 이름·수치 아이콘(지금→다음)과 큰 구매 버튼. 단계 그림은 main.js TIER_ART(임시 SVG)
- 옷 탭은 예전 옷 구매 그대로. 구매 연출 spendFx: 귤 칸에서 귤 알갱이가 산 칸으로 빠져나가고 숫자가 줄어듦, 장비는 바로 착용
- 여는 곳: 가판대(상호작용 '상점') · 데스크톱 왼쪽 위 귤 알약(.gyul) · 폰 위 알약의 귤 부분(#chip-gyul, 링 부분은 업적) · 메뉴 '상점'. openShop('gear')는 살 수 있는 첫 장비 탭으로 연다
- 가판대 위 귤 표시: cleanhouse.js 의 Sprite(sizeAttenuation false, 크기 CLEANHOUSE.stallMark), CH.stallTop
- 버리기 연출이 끝났을 때 살 수 있는 장비가 있으면 CLEANHOUSE.shopHint(8)초 동안 #shop-arrow 가 가판대를 가리킴(가판대 앞에 오거나 상점을 열면 끝). 화살표 위치 계산은 placeArrow 로 클린하우스 화살표와 같이 씀
- 폰(폭 600 이하): 아래에서 올라오는 시트, 구매 버튼은 폭 가득 54px
- 확인용: __oreum.cleanhouse.openShop / buyGear(k) / canBuyGear() / shopHint()

## 캐릭터 텍스처 이음매 정리 (#27)
- 원인: ① `lo4.glb` 굽기 여백이 8px 뿐이고 그 밖은 검정 → 멀리서(밉맵) 섬 가장자리가 어둡게 번짐 ② #24 볼터치 덮기에서 섬 가장자리를 따라 분홍 테두리가 남아 볼 근처 이음매에 선처럼 보임 ③ 이음매 양쪽 굽기 색이 조금씩 다름. 법선 불연속은 얼굴엔 없음(모자 챙·옷깃 몇 곳만)
- `model/fixseams.py`: 얼굴 앞(|x|<0.235, y 0.55~0.82, 앞면) 피부·분홍 텍셀은 밝기만 두고 색을 피부색으로 → 같은 3D 모서리를 가진 UV 모서리 쌍을 따라 안쪽 1.2px 색을 비교해 차이(RGB 합 50 미만은 전부, 100 넘으면 원래 색 경계로 보고 그대로)의 반씩을 양쪽 섬 안으로 가우스(σ3)로 번지게 → 섬 밖 모든 텍셀을 가장 가까운 섬 색으로 채움. 결과 `model/tex5.jpg`
- 다시 만들기: `python3 model/fixseams.py model/lo4.glb model/tex4.jpg model/tex5.jpg && node model/extract.js model/lo4.glb model/params.json model/tex5.jpg`
- 확인용 `tools/face.js <이름>` → `dist/face-<이름>-{close,far}.png` (정면·옆·3/4·뒤)
- `ca39651`(기획 커밋)에서 `runnermodel.js` 가 #24 이전 텍스처(볼터치 있음)로 되돌아가 있었음 → 이번에 tex5 로 다시 만들며 함께 바로잡음

## 돌탑 100개 제한 (#28)
- `balance.js` CAIRN: `max` 2000→100, `step` 0.042, `stoneSize` 0.55(돌 크기 배율), `bend`/`bendH` 2.5/5. 100개일 때 밑돌 약 2m + 쌓인 돌 약 4.2m = 약 6.2m
- 100개가 넘으면 `layoutCairn` 이 최신 100개만 그림(`list.slice(-n)`) → 가장 오래된 돌이 빠지고, 내 돌은 `at` 갱신으로 맨 위. 서버(db) 데이터는 지우지 않음. 흔들림 주기도 짧은 탑에 맞게 조정
- 멧돼지 비탈 기울기(#29): `life.js` updateBoar 가 앞뒤·좌우 땅 높이 차로 pitch/roll 을 구해 `root.rotation`(YXZ)에 부드럽게 적용(한계 0.6rad). 다리 묻힘은 그대로.

## #30 질주·체력 없애기
- 속도는 걷기(gait 0)·달리기(gait 1) 둘뿐. 체력(stamina)·질주(sprint)·귤 먹기(eatTangerine, act-eat, 키 4)·체력 링·'숨이 차요' 제거. `player.stamina` 없음
- 호흡(키 2)은 체력 회복 없이 동작만 남김. 업적 d-eat·d-sprint 삭제 (예전 저장 데이터는 오늘의 업적 재생성으로 처리)
- `juiceBurst`/`tickJuice` 는 남겨 둠 (버프 아이템 먹기 때 재사용). 안 쓰는 CSS(.stamina-*, #eat-glow)는 남아 있음

## 튜토리얼 전면 개편 (#31) — 징검다리·호주머니·정낭
- 들머리 배치(탐방로 approach 거리, `balance.js` `TUT`): 시작 5 → 걷기 원 16 → 달리기 원 40 → 개울 58(반폭 6.6) → 쓰레기 6개 70~82.5 → 클린하우스 94(가판대 포함) → 안쪽 돌담·정낭 112 → 오름. 하르방 둘·안내판·들머리 돌탑·귤 3개는 정낭 너머로 옮김. `nsbound.js` 의 plaza 도 새 클린하우스 자리로
- `src/tutorial.js` 새로 씀: 단계 walk → run(달리기 상태로 원 도착) → jump(개울 건너편) → pick(튜토리얼 쓰레기 6개 또는 호주머니 가득) → dump → bonus(약 3.6초) → tongs → bag → gate(정낭 지나 1.5). 집게·배낭이 이미 있으면 그 단계 건너뜀. 힌트 카드(#tut-hint, 화면 아래 가운데, SVG 그림만·글자는 숫자와 키 이름)·바닥 빛나는 원·멀거나 화면 밖이면 #tut-arrow·건너뛰기 #tut-skip(왼쪽 위). UI 는 move(1)·speed(2)·jump(3)·interact+bag(4)·gyul(6, 폰은 #ach-chip 도) 순서, 나머지는 끝날 때. 확인용 `TUT_ICONS`
- 저장: `save.nsV3`(기존 유저도 다시 봄: tut·trash.tp·jeong 초기화), `save.jeong`(정낭 열림), `save.firstBonus`, `save.bagV`(배낭 이행)
- 호주머니: `save.equip.bag` 0 = 호주머니(`POCKET` 6), 1~5 = `BAGS`(20/80귤, 40/300, 80/1000, 150/3000, 300/7000). 새 유저만 0 에서 시작, 예전 저장의 1단계(20)는 첫 배낭을 가진 것으로 그대로. 상점 배낭 탭의 5칸 = BAGS. #bag-pill 은 .pocket 이면 호주머니 아이콘
- 배낭 없음 겉모습: `gear.js` `back:none`(hide pack+straps, 등을 재킷 색 덩어리로 메움), `runner.js` 셰이더 `noStrap` 이 어깨끈을 재킷 색으로 덮음. `npc: true` 장비(back:none, hat:straw)는 옷장 목록에서 빠짐
- `src/stream.js`: 개울(돌담~돌담, `crossLine(TUT.streamD)`), 바닥 띠 + 반투명 물 면(잔물결 셰이더), 징검돌 5개(간격 2.6, `addWalkable`), 낚시 NPC(buildRunner + 밀짚모자, 앉은 자세, 낚싯대·줄·찌). 땅에 서 있고 물 띠 안이면 빠짐 → 첨벙(물보라·고리·`audio.splash`) → 0.35초 잠긴 뒤 포물선으로 마지막에 서 있던 둑에 내려놓음(`TUT.rescueT`, 낚싯대 들림·`audio.reel`). 그동안 `player.rescue`(busy). 개울 안엔 풀 없음(`NSW.grass.noStream`)
- 안쪽 돌담·정낭: `nsbound.crossLine(d)`(길에 수직으로 바깥 돌담까지), `stonewall.js` `createCrossWall` — 돌담 마디·정주석 둘(구멍)·막대 둘. 닫혀 있으면 길목 충돌 박스, `open()` 하면 `collide.setOff` 로 끄고 막대가 왼쪽 땅으로 내려짐(1.4초, `audio.gate`). 집게(tool≥2)·배낭(bag≥1)이 다 있거나 튜토리얼을 마쳤/건너뛰면 열림, 그 뒤 계속 열림
- 첫 보너스: 클린하우스에 처음 버릴 때 귤이 `TUT.firstBonus`(200)가 되도록 채움(`gyulShower` 연출). 건너뛰어도 나중에 처음 버릴 때 받음
- `collide.js`: add/addBox 가 번호를 돌려주고 `setOff(ids, off)` 로 잠시 끌 수 있음
- 테스트: `__oreum.tut.step`, `__oreum.stream`(local, near, busy), `__oreum.jeong`(isOpen, open), `__oreum.openJeong()`, `__oreum.gyulShower(n)`
- 임시: 개울·징검돌·낚시 NPC·정낭 막대 모양은 로우폴리, 힌트 그림 SVG 임시. 점프로 징검돌에서 물 위로 넘어갈 때 발 높이가 돌 높이(0.32)만큼 툭 내려감. NPC 탐방객·노루는 개울을 그냥 지나감

## 멧돼지 몸 충돌·넉백·귤 흩뿌리기 (#32)
- `life.js updateBoar`: 멧돼지 몸 원(`BOAR.bodyR`)과 플레이어 원이 겹치면 멧돼지를 뒤로 물림 (뛰어올라 `jumpClear` 이상이면 통과). 받힘은 몸이 닿은 뒤 `hitGap` 안, 받힌 뒤 `hitCd`(3초) 동안 다시 안 받힘
- 넉백은 `main.js boarHit` 훅: 속도·뜨는 힘을 2배(`BOAR.knockSpeed/knockV`), 돌담·사물 충돌은 기존 kb 이동(clamp·col.move) 그대로. `tickKnock` 이 날 때 뒤로 눕고 → 착지 뒤 구르고 → 일어나는 동안 조작을 잠금 (`player.knock`)
- 귤 흩뿌리기: `life.scatterTangerines(pos, n)` — 가진 귤의 10%(3~15, 가진 만큼만)를 반경 2~7 에 포물선으로 떨어뜨림. `tangerines` 에 `drop:true` 로 들어가 30초간 줍기(reclaim, +1) 가능, 동물은 안 먹음. 수치는 `balance.js BOAR`·`SCATTER`

## 처음부터 다시 하기 (#33)
- 메뉴 맨 아래 `#menu-reset` 아이콘 버튼(`main.js` 의 `menu-more` 아래 블록). 2초 꾹 누르면 테두리(`--p` conic)가 차오르고, 다 차면 `localStorage[KEY]` 를 `{nick, gfx, gfxV3, introSound, reset:1}` 만 남기고 덮어쓴 뒤 reload
- `resetting` 플래그로 이후 `persist()` 가 옛 저장을 되쓰지 않게 막음. `reset:1` 은 다음 시작 때 `freshSave` 로 읽혀 호주머니(배낭 0)부터 시작하고 곧 지워짐
- 키(`KEY`)가 개발/실서버 별도라 지금 열린 쪽만 지워짐. 돌탑의 돌은 서버 쪽이라 그대로

## 버튼 두 개: 줍기(E)·상호작용(F) (#34)
- `#btn-pick`(손 아이콘): E·버튼을 누르고 있는 동안 계속 줍기(`tickPick` 의 holding = pickS.held || keys e). 도구 반경 안 주울 쓰레기가 없으면 `.dim`. pointer capture 로 손가락이 버튼 밖으로 나가도 계속
- `#btn-ctx`: F·버튼. 가까운 할 일(버리기·상점·돌탑·인증샷·쉼터·안내판·노루·손잡기·일어나기·내리기)이 없으면 `throwAct`(귤 던지기, `.soft` = 깜빡이지 않음). 아이콘은 `CTX_ICON[act.ic]`(임시 SVG), 글자는 데스크톱만 작게. 예전 `pickAct`·`#btn-throw`·`body.throw-near`·T 키 삭제
- 귤 던지기는 무료(가진 귤이 줄지 않고 0이어도 됨). 자동 조준: `life.aimTargets()`(멧돼지·하르방, 새 적은 여기에 더함) 중 `THROW_AIM.range`(16) 안 가장 가까운 대상 → 몸을 그쪽으로 돌리고(던지는 동안 이동 방향 회전 막음) `aimShot` 이 포물선(중력 22)으로 겨눌 점(t.h)에 닿는 수평·수직 속도를 구함, 움직이는 대상은 `lead` 만큼 미리. 발밑 주황 고리 `aimMark`(상호작용이 던지기일 때·던지는 중). 수치 `balance.js THROW_AIM`
- 폰 오른쪽 아래: 큰 버튼 둘(줍기 왼쪽·상호작용 오른쪽) + 위에 달리기·점프. 작은 버튼은 `.round.sm`
- 튜토리얼: 줍기 버튼은 pick 단계, 상호작용 버튼은 dump 단계부터. 힌트 카드 키 E. 단계 UI 를 `UNLOCK` 표로 누적해 중간에 다시 들어와도 앞 단계 버튼이 보임
- 확인용 `__oreum.aim`(target, mark, throw, ctx, pick)

## 서버 고르기: 깨끗한 오름 / 전투 오름 (#35)
- `src/server.js`: `save.server` = clean | battle. 코드는 `isBattle()`·`serverId()` 로만 묻는다. `roomFor(base)` 가 멀티 방 이름을 나눔(깨끗한 오름은 예전 이름 `oreum-namsongi`, 전투는 `-battle`). net 은 roomName 을 함수로 받고, `net.start()` 는 입장할 때(`startSession`) 한 번
- 시작 화면 `#intro-srv`: 그림 카드 둘(`SERVER_ART`, 임시 SVG, 글자 없음). 처음 온 사람은 고르기 전까지 입장 버튼이 꺼져 있음, 다시 온 사람은 저장된 서버가 골라져 있음. 시작 화면에서 바꾸면 새로고침 없이 바꿔 끼움(`trash.store.setServer` + `trash.relayout`)
- 메뉴 '서버 바꾸기' → `#server` 팝업에서 고르면 `save.srvSwitch` 표시 후 새로고침, 새로고침 뒤 시작 화면 없이 바로 입장
- 쓰레기 주운 기록만 서버별: `save.trash.srv[서버] = { date, picked }`(예전 `trash.date/picked` 는 clean 으로 옮김). 배낭·누적·도감·튜토리얼 쓰레기와 귤·장비·옷·업적은 같이 씀
- 깨끗한 오름에서는 멧돼지가 안 나옴(`life.js spawnBoar`, 테스트 spawn 도 막힘)
- A/B 기록: 저장 키 `KEY + '.ab'`(처음부터 다시 해도 남음)에 서버별 visits·sec·picked, 고른 기록 50개. `window.__oreum.abStats()`, `__oreum.server`(id, isBattle, open)
- `tools/err.js` 는 첫 카드를 고르고 입장하도록 고침

## HP·쓰러짐·들것 귀환 (#36, 전투 오름만)
- `src/hp.js` `createHp`: `enabled()` = `isBattle() && sessionOn`. 깨끗한 오름에선 막대 숨김·피해 없음. 수치는 `balance.js HP`
- 멧돼지에 받히면 `enemyHit` 에서 `hp.hit(def.dmg)`(멧돼지 25, #37 이후 ENEMIES 표). 넉백·귤 흩뿌리기(#32)는 그대로. `regenDelay`(8초) 동안 안 맞으면 초당 5 회복. HP 는 저장하지 않음(새로고침하면 가득)
- HP 0 → `pending` → 넉백이 땅에 닿아 구르기까지 끝나면 `tryBegin` → 단계 fall(뒤로 눕기, 머리가 시작 지점 쪽) → come(흰 옷 두 사람이 빈 들것을 들고 시작 지점 쪽에서 걸어옴) → load → carry(화면 0.55→검정) → black(시작 지점으로 옮김) → wait(들것에 누워 원형 게이지 `#hp-wait`) → rise(HP 가득) → 두 사람은 빈 들것을 들고 떠남(`leaveT`)
- 누운 몸은 `hp.lie {ang, y}` 를 `placeRunner` 가 knock 과 같은 방식(축 = heading 의 오른쪽)으로 적용. 쓰러진 동안 `busy()`·`pickBlocked`·`doInteract` 막힘, `updatePlayer` 는 바로 돌아감. `player.down` 이면 멧돼지는 달아나고 몸 충돌 없음
- 대기: `save.hpDown = {n, at}` — 쓰러질 때 `at` 에서 `resetSec`(180초) 지났으면 n=0, 아니면 n+1 (`waits` 5·10·20·30). 일어날 때도 `at` 갱신
- `runner.js` 에 pose `'carry'`(carry +1 앞사람 손 뒤로, −1 뒷사람 손 앞으로)
- UI: `#hp-bar`(하트+막대, 위 가운데, `.low` 깜빡임, `.hit` 흔들림), `#hp-dim`, `#hp-wait`. `body.hp-on` 이면 해 칩·토스트·배너를 아래로, `body.hp-down` 이면 튜토리얼 힌트·화살표 숨김
- 업적 이벤트 `down`. 확인용 `__oreum.hp`(hp, phase, waitSec, streak, set(v), kill(), resetStreak())
- 임시: 들것·두 사람은 로우폴리·기존 캐릭터(흰 재킷·흰 모자). 실어 갈 때 충돌 없이 곧장 시작 지점 쪽으로 감(돌담을 지나칠 수 있음, 화면이 어두워지는 동안)

## 적: 멧돼지 쫓아내기 (#37, 전투 오름만)
- `src/enemies.js` `createEnemies` (life.js 안에서 만듦, `life.enemies`). 종류 표는 `balance.js ENEMIES`(name·hp·walk·chase·flee·dmg·reward{gyul,rare}·sight·lose·life·rootEvery·rootT·rootTrash·rootR·size), 출현은 `ENEMY_SPAWN`, 귤 피해는 `THROW_DMG.hand`(1). 새 종류는 표 한 줄 + `MODELS` 에 모양
- 출현: 전투 오름에서 `every`(240초)마다 한 무리 2~3마리, 플레이어에서 40~70 사이, 맵의 `spots.enemyOk(x,z)`(남송이는 돌담 안 `nsIn(x,z,12)`, 정낭 맵은 null = 없음). 동시에 최대 4. 깨끗한 오름에선 모두 지움. 예전 `spots.boarSpawn`·life.js 의 멧돼지 한 마리 코드는 없앰
- 상태: wander → (rootEvery 마다) root(머리 숙여 헤집기, 중간에 `enemyRoot` → `trash.drop(x,z,n,r)`) / sight 18 안에 보이면 charge(받히면 `enemyHit(dir, def)` → 넉백·귤 흩뿌리기·`hp.hit(def.dmg)`) / 귤 맞아 hp 0 → flee / life(180초) 다 되거나 플레이어가 쓰러지면 leave. 맞으면 바로 charge
- 머리 위 기운 막대는 스프라이트 둘(맞으면 잠깐 흰색, 1/3 이하 빨강). 나타날 때 `#enemy-warn`(빨간 느낌표)이 화면 가장자리 무리 쪽에 `warnT` 초. 가까우면 머리 위 `alertMark`
- 쫓아내면 `enemyRepel(kind,pos,def)`: 그 자리에 귤 10개 `scatterTangerines`(30초 동안 주울 수 있음), 5% 로 드문 쓰레기 하나 도감 등록(`onDexGet`). 업적 이벤트 `enemy-repel`, `enemy-repel-<종류>` (멧돼지는 예전 `boar-repel` 도)
- 쓰레기 흘리기: `trash.drop` 은 둘레 r 안의 이미 주운 흩어진 쓰레기를 가까운 순으로 다시 놓음(`store.unmarkPicked`, 오늘 수만 줄고 누적은 그대로). 이미 더러운 곳이면 0
- 확인용 `__oreum.enemies.test`(wave(), spawn(kind,dx,dz), clear(), timer, state()), `__oreum.enemyWarn`
- 임시: 다른 종류 모양 없음(표의 후보만). 드문 쓰레기는 10종 중 무작위

## 귤 활 (#38, 전투 오름만)
- `balance.js` `WEAPONS` 표(손 dmg1·사거리16 / 귤 활 dmg2·사거리32·speed40·grav5·perGyul5·300귤 / 귤 총·머신건·귤즙 레이저·귤 폭탄은 `soon`), 연출 `BOW`(release·total·즙 방울 수·화살 최대 시간). `THROW_DMG.hand` 는 표의 손 값
- 저장: `save.equip.weapon`(1 = 손, 2 = 귤 활), `save.bowAmmo`(지금 귤 하나로 남은 화살 0~5). 예전 저장은 1·0 으로 시작
- 상점 무기 탭(`GEAR_ROWS.weapon`, `battle: true`): 전투 오름에서만 탭이 보이고(`gearKeys()`), 6칸(`.tiers.t6`), `soon` 칸은 잠긴 그림만. 사면 업적 이벤트 `weapon-buy`, `weapon-buy-bow`
- F(상호작용, 할 일 없을 때) = `fireWeapon`: `bowArmed()`(전투 오름·활 가짐·말 안 탐·남은 화살이나 귤 있음)면 `shootBow`, 아니면 예전 귤 던지기. 남은 화살이 0이면 귤 1개를 써서 5발 채움. 자동 조준은 #34 와 같은 `aimTarget`, 사거리만 무기 값
- 화살: `life.shootArrow(from, vel, {dmg, grav, peersFn})` — 막대+귤 머리+잎 깃, 나눠 움직이며 적(`enemies.hitTest`)·하르방·다른 사람·땅에 맞으면 `juiceSplash`(InstancedMesh 방울, LOW 는 절반) + `audio.splat`. 겨누기 `arrowShot`(날아갈 시간만큼 중력·대상 움직임 미리 셈). 쏠 때 `audio.bow`
- 손에 들기: `holdBow` 면 `syncEquipGear` 가 손 칸을 `hand:bow`(gear.js, 왼손 armL 뼈)로 바꿈. 쏘면 활, 줍기(E·버튼) 누르면 도구로. 깨끗한 오름이 되면 내려놓음. runner pose `'bow'`(들기→당기기→놓고 튕김→내리기)
- UI: 상호작용 버튼 아이콘 `CTX_ICON.bow`·글자 '귤 활 쏘기', 버튼 위 `#ammo`(점 5개, 귤을 쓰면 살짝 튐)
- 확인용 `__oreum.weapon`(now, ammo, armed, hold, fire(), set(v), arrows())
- 임시: 활·화살·무기 그림은 로우폴리·SVG 임시. 화살은 다시 줍지 못함. 다른 사람에게는 활 든 모습만 보이고 화살은 안 보임(손 던지기처럼 멀티 동기화 없음)

## 현무암 돌담을 조각 모델로 (#39)
- 원본 `assets` 브랜치 `wall-basalt.glb`(Tripo, 17만 삼각형) → `python3 model/bake-wall.py wall-basalt.glb 400 512 256 model/wall-near.glb model/wall-far.glb`(bpy, `pip install bpy`) → `node model/extract-wall.js` 로 `src/wallmodel.js`(약 69KB, `WM_NEAR`·`WM_FAR`) 생성
- 원본을 Decimate 로 바로 줄이면 뒤집힌 면·검은 얼룩이 생겨서, 원본 크기 상자를 칸으로 나눠(바닥 없음) Shrinkwrap 으로 겉면에 붙인 뒤 텍스처를 구움. 가까이용 15×2×5칸 = 400 삼각형·512, 멀리용 4×1×2칸 = 48 삼각형·256
- `stonewall.js`: 마디 대신 조각 하나를 `WALL.seg`(6) 마다 이어 붙임. 길이 방향은 땅 기울기만큼 밀기(세로는 곧게), 끝을 `WALL.overlap`(0.5) 겹침, 반은 180° 돌림(앞뒤 바꿈, 음수 크기 대신이라 면 뒤집힘 없음), 높이·두께 ±7%, 밝기 차이. 바닥은 조각 밑 땅(길이 5곳×두께 3곳) 가장 낮은 곳보다 `WALL.bury`(0.25) 묻음 → 비탈·굽은 곳 틈 없음
- 덩어리 `WALL.chunk`(8조각)마다 가까이용·멀리용 InstancedMesh 두 벌(같은 행렬). `lodR`(70, LOW 50) 안은 가까이용, `nearR`(230/150) 안은 멀리용, 그 밖은 예전 띠. 안쪽 돌담(`createCrossWall`)도 같은 조각·같은 덩어리, `jeong.lod(pos)` 로 가까이/멀리(띠 없음, 늘 보임)
- 재질: 멧돼지처럼 MeshToon+gradHard + 텍스처 색에 비례한 자체 빛 `WALL.glow`(0.16) → 밤에 덜 뭉개짐. 정주석은 예전 구멍 무늬 그대로
- 충돌은 예전처럼 조각마다 `col.addBox`(반두께 0.42). 테스트: `__oreum.wall.tris()`, `__oreum.jeong.tris()` (지금 보이는 돌담 삼각형)

## 클린하우스 자동 걸어가기 (#40)
- `src/autowalk.js`: 탐방로 선(nsPaths)을 그래프로 만들어(노드 ≤8 간격, 다른 선과 6 안이면 이음) Dijkstra 로 가장 가까운 길을 따라가는 경유점을 만든다. 직선이 더 짧으면 직선
- 화면의 집 모양 표시(`#ch-arrow`)는 클린하우스에서 14m 이상 떨어져 있으면 늘 보임(배낭이 차면 귤색 `.full`, 가는 중엔 점선 `.going`). 누르면 `startAutoGo()`, 가는 중 다시 누르거나 조이스틱·방향키·패널·쓰러짐이면 `stopAutoGo()`
- 경유점은 `player.target` 으로 하나씩 넘김(2.4m 안이면 다음). 도착하면 멈추기만 하고 버리기는 직접. 사물에 막혀 못 나아가면 기존 탭 이동의 stuck 처리로 멈춤(정낭이 닫혀 있으면 거기서 멈춤)
- 확인용: `__oreum.cleanhouse.autoGo()/autoStop()/autoState()`

## 개울 다듬기 (#41) — 돌담 밖까지·떠내려가다 낚이기·징검돌 크게
- `src/streamshape.js`: 개울 모양 한곳. lat(하류 +, 시작에서 오름을 볼 때 왼→오른쪽)마다 `centerOff`(굽이: 징검다리 둘레 `STREAM.flatLat` 안은 0, 돌담 안 3, 밖 멀리 14) · `halfW`(가운데 6.6 → 그 밖 3.4±, 돌담 근처 `wallW` 2.4). 같은 식을 `STREAM_GLSL` 로 풀 셰이더(`noStream(…, walls)`)에서도 씀. `streamCross(line, insideBy)` = 물길이 바깥 돌담과 만나는 lat 둘·점
- `stream.js`: 물길 띠를 lat ±`STREAM.far`(300, 돌담 밖 원경)까지. 바닥은 정점 색(물 밑 어둡게 → 물가 자갈 띠 → 땅으로 흐려짐, 투명), 물 면 셰이더 잔물결·줄무늬가 `STREAM.flow` 로 하류로 밀림. 물가 자갈·풀포기 InstancedMesh(`near` 70 안), 떠가는 나뭇잎(`leaves`, 160 안에서만 갱신)
- 수문: `createStoneWall({ arches })` 가 물길에서 `w+1` 안의 돌담 조각을 비우고(충돌 박스는 남김) `buildArch` — 돌 판(ExtrudeGeometry, 구멍 `archOpen` 폭마다 하나, 사이 기둥) + 창살. 사람은 못 지나감
- 징검돌: 3개, 반지름 1.08(1.8배), 가운데 간격 3.9(물 간격 ≈1.7 = 걷다 뛴 거리 3.3 의 절반), 윗면 평평한 원기둥. 디딤 범위는 `addWalkable(…, round=true)`(타원) 반지름 `stoneWalk` 1.24
- 빠짐: sink(`sinkT`) → drift(허우적 `pose 'flail'`, 하류로 `flow`, 최대 `driftMax`) → catch(찌가 몸에, 물보라, `audio.bite`, 낚시꾼 들썩 + '!' 스프라이트, `catchT`) → reel(`TUT.rescueT` 포물선) → 징검다리 건너기 전 자리(`near(lastSide, 0)`). 낚시꾼 찌(lat 6.1)보다 2.5~14 위에서 빠지면 찌까지 떠내려오고, 아니면 낚시꾼이 빠진 곳 하류 3 에 찌를 옮겨 둠. 징검다리에서 빠지면 약 3.6초. 확인용 `__oreum.stream.phase`·`inWater`·`at(al, lat)`
- 점프 발 높이: `tickJump` 가 공중에서 발밑 디딤판 높이(groundAt − height)가 바뀐 만큼 `jumpY` 를 보정(`player.airOff`) → 돌에서 물 위로 뛸 때 툭 내려가지 않음(비탈은 그대로)
- 임시: 수문·징검돌·자갈·풀·나뭇잎은 로우폴리. 물길은 땅 높이를 따라가서 돌담 밖 먼 곳은 오르내림이 있음. 탐방객 NPC·노루는 여전히 개울을 그냥 지나감

## 모바일 멀티터치 (#42)
- 원인: 점프·달리기·상호작용 버튼이 `click` 에 의존 → iOS 사파리 등은 다른 손가락(조이스틱)이 닿아 있으면 click 을 만들지 않음. 조이스틱·캔버스·줍기는 이미 pointerId 별 추적이라 그대로 둠
- `pressBtn(el, fn)` (main.js 입력 부분): pointerdown 순간 반응 + `click` 은 `detail === 0`(키보드·`.click()`)일 때만. 패드 버튼(점프·달리기·상호작용)에 사용. 줍기는 기존 pointerdown + 캡처
- 손가락 역할: 조이스틱 `joy.id`(놓침·`lostpointercapture` 도 끝으로), 시점·핀치 `ptrs`(캔버스에 닿은 손가락만 → 핀치는 조이스틱·버튼이 아닌 두 손가락일 때만), 버튼은 각자 캡처. 조이스틱을 잡은 채 화면을 톡 친 건 목적지 이동 안 함
- 게임 화면(`#view, #joy, .pad`)에서 touchstart·touchmove 기본 동작을 막고(패널 스크롤은 그대로), iOS `gesturestart/change` 막음, viewport 에 `maximum-scale=1,user-scalable=no`. 패드 버튼 `touch-action: none`·`-webkit-touch-callout: none`
- 확인: CDP `Input.dispatchTouchEvent` 로 조이스틱 손가락을 유지한 채 점프·달리기·시점 끌기, 줍기 누른 채 조이스틱

## 개발자 버튼 (#43)
- `?hwi=1` 로 들어오면 localStorage `oreumoreum.hwi` 에 기억(`?hwi=0` 으로 끔). 저장 키가 따로라 리셋해도 남음
- 메뉴 맨 위 `#m-dev` 줄: 리셋(즉시, 모든 기록 삭제·튜토리얼 처음부터), 귤 +10,000 (업적·귤 벌기에 안 셈). 코드는 `main.js` 의 `menu-ach` 핸들러 바로 위
