# 지난 변경 기록

notes/prototype-v1.md 에서 옮긴 이슈별 메모 (#86). 지금 코드 구조는 prototype-v1.md 를 본다. 여기 적힌 `main.js` 의 각 부분은 지금 `src/game/` 의 같은 이름 파일로 나뉘어 있다.

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
- trash.js: createLocalTrashStore 가 쓰레기 상태를 읽고 쓰는 유일한 곳(save.trash = srv[서버]{sig, heaps 더미마다 남은 수}, bag 종류별 개수, total, tp 튜토리얼 낱개, dex). 멀티 때 같은 모양의 서버 저장소로 바꿔 끼움 (#45 부터 더미 방식)
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
- `src/enemies.js` `createEnemies` (life.js 안에서 만듦, `life.enemies`). 종류 표는 `balance.js ENEMIES`(name·hp·walk·chase·flee·dmg·reward{gyul,rare}·sight·lose·life·rootEvery·rootT·rootTrash·rootR·size), 출현은 `ENEMY_SPAWN`, 귤 피해는 `THROW_DMG.hand`(1). 새 종류는 표 한 줄 + `src/enemymodels.js` 에 모양 (#48)
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

## 개울: 돌다리·튜토리얼 점프 빼기·낚시 (#44)
- 돌다리(`stream.js`): 징검돌 대신 난간 없는 현무암 판 `BRIDGE.slabs`(5)장을 길 방향으로 이음. 반폭 `halfW` 1.5(둘이 지날 폭), 물 가장자리 밖 `over` 1.4 까지, 윗면 양끝 0.16 → 가운데 0.34. 판마다 네모 `addWalkable`, 이음매 밑 물속 받침돌. 옆으로 벗어나면 예전처럼 빠져서 떠내려가다 낚시꾼에게 건져짐. `stream.onBridge(x,z)`, `stream.slabs`, `stream.bridge`
- 튜토리얼: 점프 단계를 뺌(걷기 → 달리기 → 줍기 …). 점프 버튼은 달리기 단계에 같이 나옴. `save.tut.v = 2`, v 없는 예전 저장은 단계 번호 3 이상을 하나 당김. 점프 힌트 그림(jumpKey·jumpBtn) 삭제
- 낚시 `src/fishing.js` `createFishing`: 물가(물 가장자리에서 `FISH.bankR` 2 안)나 다리 위에서 할 일이 없으면 상호작용(F)이 '낚시하기'(`fishAct`, 아이콘 fish). cast(던지기 `castT`) → wait(2~6초, 찌가 떠 있고 물결) → bite(`biteT` 1초, 찌가 쑥 + '!' + 버튼 `.bite` 두근거림 + `audio.bite`) → F = pull(당겨 올림) → 물고기면 show(들어 보임) → release(놓아줌), 쓰레기면 stow(배낭으로). 늦으면 miss(토스트 '놓쳤어요'), 기다리는 중 F 는 그냥 거둠. 움직이기·점프·줍기·빠짐이면 그만둠
- 보상은 당기는 순간 확정(main.js `reward`): 물고기(은어·붕어·참게) 귤 `fishGyul`(5) + 도감, 쓰레기(장화·깡통·비닐 → vinyl/can) `trash.addToBag(kind, cap)` 로 호주머니·배낭, 드문 것(DEX.rare 중 자리에 맞는 것) 배낭 + 도감(드문 것 귤). 비율 `FISH.odds`(60/35/5), 자리가 없으면 물고기만. 업적 이벤트 `fish`, `fish-<ayu|carp|crab|boot|tin|bag|rare>`
- 도감: `DEX_LIST` 끝에 `fish:0~2`(kind 'fish', sec 'stream') → 도감 화면에 '개울' 구분 줄(`.dex-sec`), 33종. 아이콘 `dexicons.js FISHI`
- 낚싯대는 사지 않음: 낚시 중에만 오른손 위치(armR 끝)에서 그리는 로우폴리 막대 + 줄 + 찌(fishing.js), 그동안 손 도구는 숨김(`holdRod` → `syncEquipGear`). runner pose `'fish'`(rod = 낚싯대 들린 각). 소리 `audio.cast`·`plop`(+ 기존 splash·bite·reel). `stream.splash(x,y,z,big,snd)`·`stream.ring` 재사용
- 확인용 `__oreum.fish`(go(side, lat) 물가로 옮기기, can(), press(), state(), force({type:'fish',i}|{type:'trash',t}|{type:'rare',kind,name}), wait(초), parts)
- 임시: 물고기·쓰레기·병·낚싯대는 로우폴리. 멀티에 낚시 모습은 안 보임(손 도구만 숨겨짐). 탐방객 NPC·노루는 여전히 개울을 그냥 지나감

## 구역과 쓰레기 더미 (#45)
- 흩뿌린 27,000개·자정 리셋 없앰. 남송이를 구역 5개로 나눔: `src/zones.js zoneAt(x,z)` 하나(0 들머리, 1 자락 숲길, 2 남쪽 사면, 3 능선, 4 굼부리, 5 정상). 경계: 정상 반경 → 말굽 능선 길 둘레 → 말굽 안쪽(능선을 닫은 다각형)·북쪽 원형 굼부리 → 솟은 높이·정상보다 남쪽 → 나머지. 수치 `balance.js ZONE_SHAPE`
- 더미: `balance.js HEAP`(작은 10·큰 50·대형 200, 반경·높이·4단계) + `ZONES`(구역별 더미 수·목표 분·권장 장비·쓰레기 종류 비율 mix·maxD·amt). 더미 순서는 `HEAP_DEFS`(구역 순, 큰 것부터) = 저장 heaps 순서. 구성이 바뀌면 sig 가 달라져 가득 찬 상태로 다시 시작
- 자리: 고정 난수(`HEAP.seed`)로 길 옆(길을 막지 않게 trailMin 밖)·구역 안 빈터. 나무·바위·구조물(col)과 안 겹치게, 가파른 곳 피함. 1구역은 클린하우스 215 안
- 모양: 크기·단계별 InstancedMesh(봉투·상자·타이어·스티로폼·그물·캔). 남은 비율로 4단계. 충돌도 단계마다 원을 등록해 지금 단계만 켬, 다 치우면 끔
- 줍기: `trash.candidates(x,z,도구 r,남은 부피)` → `{h|k, x, z, d}` (d 는 더미 가장자리까지), `trash.take(c, room)` 한 개씩. 한 번(per)에 한 더미에서 per 개. 종류는 구역 mix 대로 배낭에 들어가는 것만, 도감·드문 것 규칙은 그대로
- 이벤트: trash / heap-clear {h, zone} / zone-clear {zone} / heap-stage. main 에서 ach.emit('zone-clear'), 'zone-clear-N'
- HUD: `#zone-pill` 구역 번호 + 구역 %(들머리에서는 숨김), `#clean-pill` 오름 전체 %
- 멧돼지 헤집기(`trash.drop`)는 둘레 덜 찬 더미에 되돌림
- 시간 어림 `__oreum.trash.estimate()`: 1구역 5.8 / 2구역 9.1 / 3구역 11.2 / 4구역 16.8 / 5구역 20.4분 (더미 사이 한 바퀴 포함이라 조금 넉넉). 조정: 1구역은 부피 1 쓰레기만·클린하우스 가까이, 5구역 대형 더미 140개, 권장 배낭·신발은 시간에 맞춰 정함
- 확인용 `__oreum.trash`: clearZone(z)/fillZone(z)(0 = 전부), setHeap(i,n), heaps(), nearestHeap(x,z), goHeap(i), zoneAt, zoneClean(z), estimate(), state()

## 깨끗해진 구역에 꽃과 어린 나무 (#46)
- `src/bloom.js createBloom`: 저장 없음. 쓰레기 이벤트마다 `trash.zoneClean(z)` 로 다시 구함(다시 쌓이면 그대로 시듦). 수치 `balance.js BLOOM`
- 풀 색: `namsongi.js` 땅·풀 셰이더 `groundColor` 에 `zoneDry(p)` — 구역 번호 격자 256×256(`setZoneGrid`, 범위 `zones.js ZONE_BOX`, 가장 가까운 칸 4개를 섞어 경계 부드럽게) × 구역별 `uDry[6]`(`NSW.zoneDry`). 40% 이하 1(탁한 누런 풀) → 70% 0 → 100% −`lush`(더 푸름). 길은 그대로. `dryRate` 로 서서히
- 꽃 무리: 구역마다 고르게(`per`, LOW `perLow`) 흩음. `early` 비율은 70~98% 사이 문턱마다 하나씩 피고, 나머지는 100% 에. 어린 나무(`treePer`)도 100% 에 솟고, 나무마다 `treeOff`(85~97%) 아래로 떨어지면 시듦. 치운 더미 자리 둘레(`heapRing`)엔 그 더미가 0 이 되자마자 핌
- 100% 순간: 더미 자리에서 가까운 것부터 `wave`(26/초, 최대 `waveMax` 7초) 차례로 핌, `sound.bloom()` + 새 소리, 새 떼(`birds`, 멀리서 날아와 `birdT` 동안 돌고 떠남, 그 구역에 있을 때만), 나비(다 핀 구역 안에 있으면 둘레에서 팔랑, `butterflies`/LOW 3)
- 모양: 구역별 꽃 모양·색 `BLOOM.zones` (1 유채 노랑·2 메밀 흰·3 억새 금빛(plume)·4 수국 파랑(ball)·5 철쭉 분홍), 무리 모양 3가지 × 줄기·꽃송이 InstancedMesh, 어린 나무 하나. 32 칸 목록으로 `drawR`(120/LOW 70)·`treeDrawR`(180/110) 안만 그림. 시들 때는 기울며 갈색으로 줄어듦(`wither` 6초)
- 이벤트 `zone-bloom` / `zone-wilt` {zone} (main: ach.emit('zone-bloom')). 노루: 다 핀 구역마다 `life.addDeer` 로 `BLOOM.deer` 마리, 시들면 `life.removeDeer`(타고 있으면 남김). 몹: `life.hooks.spawnBlock` → 다 핀 구역에는 나오지 않음(enemies okAt)
- HUD: `#zone-pill.bloom` 이면 산 아이콘 대신 구역 색 꽃, `#clean-pill` 안 `#bloom-row` 에 다 핀 구역마다 작은 꽃 점
- 서버 바꿀 때 `bloom.resync(fn)` 로 연출 없이 맞춤
- 확인용 `__oreum.bloom`: state() 구역별 깨끗함·마름·핀 꽃·나무, counts(), finish() 애니메이션 바로 끝, flock(x,z), deer(), api
- 임시: 꽃·나무·나비·새는 로우폴리. 다른 노루 무리(지도 고정)는 구역과 상관없이 그대로

## 쓰레기 투기꾼·투기 트럭 (#47)
- `src/dumpers.js createDumpers`: 자정 리셋 대신 주기적으로 와서 더미를 다시 쌓음. 깨끗한 오름·전투 오름 둘 다. 수치 `balance.js DUMP`
- 주기 = `every`(180초) ÷ `players`(지금 1, `dumpers.setPlayers(n)`), 최소 `minEvery` 20초. 한 번에 트럭(`truckP` 0.4) 또는 투기꾼. 한 명 기준 한 시간에 오름 전체(3040개)의 `hourFrac` 25% = 760개 → 투기꾼 10개, 트럭은 평균이 맞게 자동 계산(`DUMP_AMT.truck` 80)
- 노릴 더미: 구역 무게 `zoneBase` + 깨끗한 정도(깨끗할수록 자주), 구역 안에선 비어 있을수록. 투기꾼은 작은 더미, 트럭은 큰·대형 더미 먼저. 다른 투기꾼이 노린 더미는 뺌
- 오는 길: 투기꾼은 돌담에서 더미와 가장 가까운 곳 바깥(`outside` 14)에서 곧장. 트럭은 탐방로 그래프(`autowalk.js buildTrailGraph`)로 더미에서 거꾸로 다익스트라 → 돌담 `entryIn` 60 안 길 점으로 들어옴(비용 = 길 거리 + 돌담 거리 × `offRoad`). 길이 너무 돌면 돌담에서 곧장. 들머리 튜토리얼 쪽(정낭 안쪽)은 `avoid` 로 안 지남
- 도착하면 `dumpT` 5초 버림(트럭 짐칸 기울임·투기꾼 봉투 내려놓음) → `trash.refill(i, n)` (넘치면 같은 구역 가까운 덜 찬 더미로) → 왔던 길 거꾸로 돌아가 사라짐. 오래 걸리면(`maxTrip`) 조용히 사라짐
- 쫓아내기: 버리기 전에 귤(손 1·활 2 피해)로 hp(투기꾼 1·트럭 6)를 깎으면 도망, 귤 `reward`(5·30) 흩뿌림, `ach.emit('dumper-repel')` + `'dumper-repel-'+kind`. 공격하지 않음. `life.addTargets(dumpers)` 로 귤·화살 판정과 자동 조준에 들어감(귤은 지난 0.1초 선분으로 판정)
- 나타날 때 화면 가장자리 `#dump-warn`(봉투 아이콘, `makeEdgeWarn` 공용) + 토스트. 튜토리얼 중(정낭 열기 전)엔 안 옴
- 접속하지 않은 동안: 서버별 `save.trash.srv[id].seen`(ms, 5초마다 갱신). 다시 들어오거나 탭이 오래 숨어 있다 돌아오면(`offlineMin` 60초 넘게) 한 명 기준 속도로 한꺼번에 쌓고(`offlineMaxH` 8시간 이상이면 전부 가득) 토스트. 예전 저장(seen 없음)은 지금부터 셈
- 멀티: 쓰레기 상태를 바꾸는 곳은 `trash.refill` 과 저장소 `putBack`·`seen` 뿐 (서버로 바꿀 자리)
- 확인용 `__oreum.dumpers`: spawn(kind, heap), near(kind, dist) 플레이어 앞에 데려옴, visit(), clear(), state(), amt, perHour, api(catchUp(sec), setPlayers(n), period(), test.timer), warn
- 임시: 투기꾼·트럭은 로우폴리 상자 모양. 길 위 충돌은 안 봄(돌담·나무를 지나침)

## 구역별 몹 (#48)
- 전투 오름에서 플레이어가 있는 구역(`hooks.zoneAt` = `trash.zoneAt`)의 몹이 2분마다 한 무리(2~3, 동시 최대 4) 나옴. 구역→종류는 `ENEMY_SPAWN.byZone` (1 아기 멧돼지 · 2 들개 · 3 멧돼지 · 4 광견병 들개 · 5 외계인). 들머리(0)·다 핀 구역(`spawnBlock`)·깨끗한 오름은 없음. 구역 없는 맵은 `ENEMY_SPAWN.kinds`
- 수치는 `balance.js ENEMIES` (멧돼지는 기운 12·보상 20 으로 바뀜). `ranged` 칸이 있으면 거리를 지키며 광선을 쏨 (외계인): `enemies.js shoot/updateBolts`, 광선 맞으면 `enemyHit` 과 같은 넉백·피해
- 모양은 `src/enemymodels.js` 한 곳 (`ENEMY_MODELS[kind]` → `{root, legs, head, tail, h, fx?}`). Tripo 모델로 바꿀 땐 여기 build 함수만. 아기 멧돼지는 `buildBoarModel({scale, stripes})` 줄무늬 재질
- 확인: `__oreum.enemies.test.wave(kind?)`, `.kindHere()`, `.spawn(kind, dx, dz)`, `.bolts`

## 값 다시 잡기 (#49)
- `tools/econ.js`: `balance.js` 수치로 하루 1시간씩 5일 플레이를 흉내 내 장비 단계별 도달 시각을 냄 (깨끗한 오름·전투 오름). `--log` 구매 기록, `--chase 0.3` 투기꾼 쫓아내는 비율, `--greedy` 구역을 귤/초 순으로, `--live` 더미 자리를 `dist/test.html` 에서 다시 뽑아 `tools/econ-map.json` 저장 (더미 배치가 바뀌면 다시 뽑기)
- #53 값 다시 잡기 2: `tools/econ.js` 가 옷 6칸까지 셈 (모자 드문 것·바지 주머니·베스트 귤은 벌이에, 티셔츠·잠바·양말은 장비 단계를 따라 삼). 효율·여유 25%(`--slack`) 둘 다 돌려 마지막 칸 시각과 목표(4시간·5시간) 통과 여부를 냄, `--table` 칸별 도달 표. 쓰레기 귤·더미 수는 그대로 두고 값만 내림: 장비 4·5단계(700~800 / 1,500), 귤 활 600, 옷 `WEAR.price` 50 / 150 / 300 / 650·`priceNone1` 40. 결과 표는 `notes/spec.md` 장비 절
- 모델: 클린하우스 ↔ 구역 왕복(직선 × 1.15, 달리기 10 × 신발) + 더미 사이 걷기 + 줍기(time ÷ per) + 버리기. 구역 1 부터 차례로, 버릴 때마다 살 수 있는 장비 중 (오름 한 번 치우는 귤/초 증가 ÷ 값) 이 큰 것부터. 투기꾼 3분마다(절반 쫓아냄), 몹 2분마다(전투 오름, 모두 쫓아냄·쓰러짐 안 셈). 옷 제외
- 장비·귤 활 값은 `balance.js` 와 `notes/spec.md` 장비 표. 흡입기 한 번 3개(초당 12), 낚시 귤 5 → 1·드문 것 5% → 1%
- 정상 구역이 가깝고 더미가 몰려 있어 귤/초로만 고르면(`--greedy`) 3일차부터 정상으로 감. 구역 순서대로 가게 하려면 지도나 몹으로 막아야 함 (지금은 안 막음)

## 레스토랑 스톤 (#50)
- 자리 `src/stone.js stoneSite(crossLine(TUT.streamD), insideBy)`: 개울 좌표 lat `STONE.site.lat`(-17, 상류 = 시작에서 오름을 볼 때 왼쪽), 물 건너 가장자리 + `bank` 에 테라스 앞끝, 그 뒤 건물. 앞(+Z)이 개울·서쪽 바다를 봄. `buildNamsongi({ clear })` 로 반경 `clearR` 안 나무·바위를 안 심음. 충돌을 쓰레기 더미보다 먼저 등록, 둘레 `keepR` 은 `life.hooks.spawnBlock` 로 몹 막음
- 모양 `createStone`: 현무암 블록 쌓은 벽(앞 큰 창 둘 + 문), 평지붕·밝은 처마, 문 위 간판(캔버스: 로고 `src/stonelogo.js` = logo.png 200px 알파 PNG + 'Stone'), 나무 테라스(addWalkable)·탁자 셋·의자·파라솔, 전구 줄, 양옆 야자수. 밤엔 창·전구·빛웅덩이(+ LOW 아니면 PointLight). 로우폴리 임시
- 메뉴·값·버프 `balance.js STONE.menu` (귤 = 메뉴판 × 10). 팝업 `#stone`(page.html, 폰은 아래 시트): 로고·표어 + 메뉴 카드(음식 그림 `src/stoneicons.js FOOD_SVG`, 한글·영문 이름, 귤, 버프 아이콘·수치·분). 깨끗한 오름에선 battle 메뉴(스테이크·샐러드) 흐리게·잠금
- 주문: 귤 빠짐 → 가운데 탁자 의자로 걸어감(`walkMax` 넘으면 바로 앉힘) → pose 'sit' 으로 앉아 접시 음식이 줄어듦(`eatT`) → 버프. 상호작용(건너뛰기)·이동 키·조이스틱으로 바로 끝냄, 걷다가 움직여도 바로 버프. 정낭이 열린 뒤에만 '식사'(튜토리얼 귤 보호)
- 버프 `src/buff.js`: `save.buff = { id, left }`, 실제 시간으로 줄어듦(1초 넘게 끊긴 동안은 안 셈, 게임을 끈 동안 그대로). `buff.mul(kind)` → speed 이동(want 에 곱함)·bag `bagCap()`·pick `toolNow().time ÷`·dmg 화살 `w.dmg`·손 귤 `life.hooks.dmgMul`·regen `createHp({ regenMul })`. 끝나서 배낭이 넘치면 그냥 가득 찬 상태
- HUD `#buff-pill`(아이콘 + 남은 시간 고리·m:ss, 깨끗한 오름에서 전투 버프면 흐림), 가장자리 `#stone-mark` 포크·나이프(`markNear`~`markFar`). 업적 이벤트 `meal`, `meal-<id>`
- 확인용 `__oreum.stone`: go(), open(), order(id), finish(), meal(), mul(k), cap(), tool(), buff

## 캐릭터 고르기·머리 (2026-11-16, #51)
- 머리 3종은 목 위 머리 전체(얼굴·머리카락)를 바꾸는 hat 칸 장비 `hat:short`·`hat:bob`·`hat:bun`(gear.js, `hide: ['head']`, `skinTint`). 초록 모자는 `hat:cap`(몸에 구운 그대로). 몸 셰이더는 `hideHead` 면 rest y 0.595 위를 감춤
- 만들기: `assets` 의 `char-<이름>.glb` → `python3 model/bake-head.py 원본.glb 3000 512 out.glb`(팔 끝 폭으로 크기, 턱 앞으로 앞뒤를 지금 몸에 맞추고 y 0.565 위·|x|<0.3 만 남겨 줄이고 굽기) → `node model/extract-gear.js out.glb head-<이름>` → `src/gear/head-<이름>.js`(각 약 130KB)
- 피부색 `runner.js SKIN_TONES` 3가지(첫째 = 텍스처 그대로). 셰이더가 텍스처 피부(색상 0.074 근처)만 골라 목표색/기본색 비율을 곱함. 몸은 머리·손·다리 영역만, 머리 장비는 전체. 값은 `outfit.skin.color` 로 다른 사람에게도 감
- 저장: `save.look = { sex: 'm'|'f', skin }`, `save.hairs` 가진 머리, 쓰는 머리는 `outfit.gear.hat`. look 이 없으면 입장 직후(튜토리얼보다 먼저) 고르기 화면 `#look`(cam.mode 'look' 이 캐릭터 둘레를 돎, 그동안 busy·튜토리얼 멈춤). 예전부터 하던 사람은 초록 모자도 가짐
- 머리는 루이네 미장원(#58)에서만 바꿈 (상점 옷 탭·옷장 머리 줄은 #58 에서 없앰). 값 `balance.js HAIR.list`(임시: 똥머리 300, 나머지 150)
- 확인: `__oreum.look.open()/set(sex, skin)/close()/state()`, `dist/char-motion.html?gear=hat:bun&skin=2`

## #61 오름 입구 정렬
- `nsbound.gate` 에 길 직각 방향 `ux,uz` 를 더함. 정낭 자리·방향·돌담 시작점이 모두 `gate`(길 가운데 점 + 방향) 한 묶음에서 나온다.
- `createStoneWall` 은 경계선을 따라 양쪽으로 가다가 길 직각 거리가 기둥 바깥(`gateW+0.38`)에 닿는 곳에서 돌담을 시작·끝낸다. 정낭은 경계선 접선이 아니라 길과 직각으로 선다.

## 옷 10칸·능력치 (#52)
- 수치·옷 목록 `balance.js WEAR`(칸 6개: hat·top·bottom·vest·jacket·socks, 단계별 능력치 `v[0~5]`, 값·단계 색)와 `CLOTHES`(한 줄 = 옷 한 벌, `look` 모양 값). 단계에 옷을 더하려면 `CLOTHES` 에 줄만 더함. 도구·배낭·신발·무기는 예전 장비 표 그대로(신발 1단계 = 쓰레빠 `shoes:slip`)
- 모양 `src/clothes.js`: 몸통 단면 표(TORSO·HIPS)를 따라 감싸는 껍질 `shell` + 팔·다리 관 `tube` 로 코드에서 만듦(로우폴리, 몸과 같은 뼈대로 휨 `skin: true`, 모자만 머리 뼈). 겹침 안→밖: 피부 < 양말 < 바지 < 티셔츠 < 잠바 < 베스트. 재질 이름 `skin`(피부색)·`foot`(양말 색 또는 피부색)은 runner 가 칠함. `addClothes(ACCESSORIES)` 로 gear.js 에 등록
- 옷(top·bottom)을 입으면 `hide: ['body']` → 몸 셰이더가 손(|x|≥0.37) 빼고 y<0.6 을 버림(구운 재킷·반바지·운동화·배낭 감춤). 그래서 팔뚝·종아리 맨살도 옷이 만듦. 배낭 1단계는 새 모양 `back:bag1`, 호주머니는 `back:empty`. NPC(DEFAULT_GEAR)는 예전처럼 구운 몸
- skin 장비는 runner 가 같은 재질끼리 합쳐 SkinnedMesh 하나로 그림(옷 조각이 많아서)
- 머리는 모자와 다른 칸 `hair`(키 이름은 예전 그대로 `hat:short` 등). 머리를 고르기 전(구운 머리)엔 옷 모자를 겹쳐 쓰지 않음
- 저장 `save.clothes = { own, wear }`. 예전 저장: `outfit.gear.hat` 의 머리를 `hair` 로 옮김, 예전 옷 색 구매(`save.owned`)·초록 모자 머리는 귤로 돌려줌(`save.wearV`). 다른 사람에게는 `outfit.gear` 로 보임(net `cleanGear`, SLOTS 에 칸 추가)
- 능력치 적용(`main.js wearV(칸)`): 모자 → `createTrash rareMul`, 티셔츠 → `createHp maxMul`, 바지 → `bagCap()`, 베스트 → `dumpBag` 귤, 잠바 → `hp.hit` 피해, 양말 → `regenMul`
- 상점 옷 탭: 머리 줄 + 칸마다 한 줄(그림 `src/clothicons.js`, 단계 색 띠, 입은 것 체크, 가진 것은 눌러 갈아입기, 안 가진 것은 눌러 능력치 지금→바뀔 값과 사기). 옷장도 같은 줄(가진 것만)
- 확인: `__oreum.clothes.state()/stats()/buy(id)/wear(칸, id)/give(id)/bagCap()/hpMax()`, `dist/char-motion.html?row`(1~5단계 다섯 명, `&wear=hat,top,bottom` 입을 칸만, `&slots=hat` 그 칸만 단계대로, `&nobag`, `view=front3|back3`), `?tier=3&one`

## 가게 거리 (#57)
- 자리 `src/streetlayout.js STREET` (계산만): 들머리 길 `SHOP_ST.d`(84) 에서 왼쪽(개울 상류 쪽)으로 갈라지는 골목. 골목 좌표 `P(s, t)` (s 골목 안쪽, t 오름 쪽 +). 클린하우스(94, 길 오른쪽)와 길을 사이에 두고 마주 봐서 가게들은 클린하우스를 등짐. 시작→골목 어귀 약 84m, 클린하우스→스톤 약 42m
- 터 6개 `balance.js SHOP_ST.lots` (s, side 1 오름 쪽 줄·-1 시작 쪽 줄·0 골목 끝, w, d). 1 루이네미장원(#58)·2 LEAP(#59) 자리, 5 스톤, 3·4·6 빈 터. 터마다 front·rot(앞이 골목)·back
- `nsbound` 가 터 둘레(`SHOP_ST.bound`)를 must 로 넣어 바깥 돌담이 거리를 두름. `buildNamsongi({ clear: STREET.clear, lanes })` 로 나무·바위 비우고 골목을 길 그림(pathTex)에 더해 풀 없앰
- 그림 `src/shops.js createShopStreet`: 현무암 판석·연석, 빈 터(낮은 돌담 + 앞 트임 + '준비 중' 고깔 팻말), 벤치·화분, 어귀 간판(가게 아이콘 세로). 가로등은 `STREET.lamps` 를 들머리 가로등 목록에 더함
- 가게 표 `balance.js SHOPS` (id, name, lot, act, ic, pop): 줄을 더하면 그 터에 `SHOP_BUILD[id]` 건물 + 상호작용(act/ic) + 팝업(main `SHOP_POP[pop]`) + 가장자리 아이콘 `SHOP_ICON[id]`. 줄 없는 터는 빈 터
- 스톤은 개울가에서 5번 터로 옮김 (`stoneSite` 없앰). 앞(테라스)이 골목 너머 개울·서쪽 바다. 정낭이 열린 뒤에만 식사는 그대로
- 팝업은 공용 `#shoppop` (위 로고·이름·표어 `head`, 아래 `.menu-grid` 카드 `fill(grid)`, `serif` 이면 Georgia). 가장자리 표시 `#shop-mark`: 열 수 있는 가게 중 가장 가까운 하나의 아이콘만 (`SHOP_ST.markNear`~`markFar`)
- 몹: 거리 가운데에서 `STREET.radius + keepPad` 안엔 안 나옴. 쓰레기 더미는 오름에만이라 원래 없음, 투기꾼은 더미로만 감
- 확인용 `__oreum.street`: layout, shops, go(lot) / go(0, s), open(pop), popNow(), mark()

## 루이네 미장원 (#58)
- 가게 거리 1번 터 (`balance.js SHOPS` 줄 salon, `SALON` 수치). 모양 `src/salon.js createSalon`: 밝은 회색 돌 타일 단층·현무암 밑단·평지붕, 어두운 틀 넓은 창(비치는 유리)·유리문, 흰 간판에 빨강·파랑 사선 줄무늬 테두리 '루이네 미장원'(`drawSalonSign`, 팝업 로고 `salonLogo()` 도 같은 그림), 창과 문 사이 삼색 회전 기둥(텍스처 offset), 문 앞 빨강·흰·파랑 드럼통 둘. 안: 나무 바닥·뒷벽 나무 판·선반·거울·빨간 미용 의자(창 안쪽, 거울을 봄). 로우폴리 임시, 나중에 Tripo 모델·실제 로고로
- 머리 표 `balance.js HAIR.list` ({ id, key(gear.js hair 칸 장비), name, price }). 줄을 더하면 미장원 카드가 늘어남 (`HAIR.price`·`HAIR.byKey` 는 거기서 만듦). 머리 그림은 main `HEAD_SVG`
- 흐름(main `orderCut`): 카드(가진 것 0, 지금 머리 체크) → 귤 빠짐 → 문 앞까지 걸어감(`walkMax` 넘으면 바로) → 의자에 앉음(pose 'sit', 지붕 감춤 `inside(true)`, 카메라는 창 밖에서) → 가위 연출 `cutT` 3초(머리 둘레 도는 가위 + 떨어지는 머리카락, `sound.snip`) → `wearHair`. 상호작용(건너뛰기)·이동 키·조이스틱으로 바로 끝냄. 업적 이벤트 `haircut`, `haircut-<id>`. 정낭이 열린 뒤에만 열림(스톤과 같음)
- 공용 팝업 `#shoppop.wide`: 로고 자리가 넓은 간판 그림, 이름 글자는 숨김
- 확인용 `__oreum.salon`: go(), open(), order(id), sit(), finish(), cut()

## LEAP (#59)
- 가게 거리 2번 터 (`balance.js SHOPS` 줄 leap, `LEAP` 수치·칸 순서 `slots`). 모양 `src/leap.js createLeap`: 노출 콘크리트 판 벽(판마다 색 조금씩), 바닥부터 띠 아래까지 유리 진열창(검은 창살·유리문), 위 콘크리트 띠에 굵은 검정 기울임 'LEAP'(`drawLeapSign`, 팝업 로고 `leapLogo()` 같은 그림), 안은 뒷벽 러닝화 선반 네 단·옷걸이·마네킹·계산대, 밖에 검은 A자 입간판·화분. 로우폴리 임시, 나중에 Tripo 모델·실제 로고로. 바닥 밑 풀은 `buildNamsongi lanes` 에 건물 자리를 더해 없앰
- 팝업은 공용 `#shoppop` + `.leap`(어둡게 안 하고 오른쪽, 폰은 아래 시트 52%) + 칸 줄 `#shoppop-tabs`(SHOP_POP 의 `tabs`). 열면 `onOpen` → 캐릭터가 골목 쪽을 보고 서고 `cam.mode 'leap'` 이 앞에서 비춤(맞은편 가게에 안 묻히게 가까이). 닫히면 `tickLeap` 이 알아채 차림·카메라를 되돌림
- 칸: 신발(SHOES, 차례대로 사고 가장 좋은 것을 신음, 앞 단계 전엔 잠금)·모자·티셔츠·바지·베스트·잠바·양말(#52 WEAR·CLOTHES 그대로, '없음' 카드로 벗기). 안 가진 카드를 누르면 입어 보기(`leapTryOn`, 저장 안 함) + 아래 사기 바. 가진 옷은 눌러서 바로 갈아입음
- 가판대에는 도구·배낭·무기만 (LEAP 이 있는 맵에서 신발·옷 탭 숨김, `gearKeys` 에서 신발 뺌 → 버린 뒤 가판대 화살표도 신발로는 안 뜸). 옷장의 '상점' 버튼도 숨김. LEAP 이 없는 맵은 예전 그대로
- 업적 이벤트 `clothes-buy`, `clothes-buy-<칸>` (신발은 예전 `gear-buy`·`gear-buy-shoes` 도 그대로 나감). 옷 살 때 나가던 `gear-buy` 는 뺌
- 확인용 `__oreum.leap`: go(), open(), slot(k), items(), pick(id), buy(id?), state()

## 새 머리 3종 눈 맞추기 (2026-11-16, #54)
- `model/fixeyes.py` (도구 `model/meshjs.py`: 데이터 js 의 base64 메시·텍스처 읽기/쓰기, uv·정면 래스터): `src/gear/head-*.js` 를 바로 고침. 다시 만들 땐 `bake-head.py` → `extract-gear.js` → `python3 model/fixeyes.py`
- 기본 캐릭터 얼굴을 정면(+z) 직교 투영해 흰 테두리 안(눈)만 뽑고, 머리 텍셀마다 3D 위치를 구해 같은 (x, y) 의 기본 눈 색을 옮김 → 눈 크기·간격·높이가 기본 캐릭터와 같음. 눈동자는 몸 셰이더처럼 무채색 검정으로 미리 바꿔 둠
- 기본 눈 윗끝(y 0.80)이 보이게 가운데 앞머리를 y 0.815 로 올림(|x| 0.10~0.165 에서 둥글게 옆머리로). 튀어나온 앞머리 면은 기본 얼굴 면(+높이 차)으로 눌러 넣고, 얼굴 앞 법선은 기본 캐릭터 법선 → 툰 명암 경계가 같음
- 얼룩: 피부색 범위 밖 밝은 텍셀·머리카락↔피부 중간 밝기 텍셀(피부색 바꾸기를 안 받음)을 피부 또는 머리카락으로 가름. uv 섬 둘레 6텍셀도 가장 가까운 삼각형의 3D 위치로 칠해 밉맵 줄 없앰
- 확인: `dist/char-motion.html?faces` (기본·짧은 머리·단발·똥머리 정면, `&skin=2`, `&fx=` `&up=`)

## 눈 깜빡임 (#74)
- 수치 `balance.js BLINK` (간격 3~6초, 닫기 0.05·멈춤 0.02·뜨기 0.05초, 10번에 1번 두 번 연달아, 눈 크게 0.22, 거리 30m)
- 눈꺼풀은 셰이더(`runner.js` `LID_FRAG`·`lidFragment`): 기본 자세 좌표의 눈 타원(`EYE_L`·`EYE_R`, fixeyes 와 같은 정면 투영으로 잰 값) 안에서 눈꺼풀 끝 위를 텍스처 피부색(`cLid`, 머리 장비는 `gear.js` 의 `lid`)으로 덮고 속눈썹 선을 그림. 피부색 바꾸기 전에 칠해 피부색 3가지를 그대로 받음. 머리 3종은 눈 자리가 같아 `patchHead` 에 같은 코드
- 눈 크게: 정점 셰이더에서 눈 둘레 정점을 눈 가운데에서 바깥으로 밂(`eyeGrow`, DQ 스키닝 전)
- 박자: `buildRunner` 의 `eye` 상태, `animate(..., { face, lid })`. face 'shut' 쓰러짐(감은 채), 'wide' 받힘(`player.knock`)·허우적댐(pose flail). 사람마다 처음 간격이 무작위라 박자가 다름. `setBlinkCamera(camera)` 로 카메라에서 `BLINK.far` 넘는 캐릭터는 계산·깜빡임 생략. 모델 캐릭터(나·다른 사람·들것 일꾼)만, 예전 도형 NPC 는 없음. 다른 사람의 쓰러짐은 서버로 안 와서 감은 눈은 나만
- 확인: `dist/char-motion.html?faces&fov=12&lid=0..1`, `&face=wide|shut`, `&skin=2`. 게임에선 `__oreum.runner.eye`

## 낚시 잭팟 (#55)
- `balance.js FISH.jackpot` (`p` 1/500, `gyul` 60, `bigT` 1.6초, `first` 3). 처음 임의값 1/150·300 은 `tools/econ.js` 로 재 보니 시간당 벌이가 오름 1일차(1,414)의 절반(707)을 넘어, 평균이 700 이 되게 낮춤. econ.js 끝에 잭팟 줄이 나오고 넘으면 '넘음'
- 잭팟은 찌가 들어가는 순간(`bite` 시작)에 굴림(`S.jack`). 걸리면 찌가 크게 흔들리고 물보라·고리가 계속, 느낌표가 금색·크게, `audio.jackBite`. 놓치기까지 `bigT`. 낚으면 species 3~5(다금바리·황금 옥돔·귤색 잉어, `fishMesh` 큰 모양) `c.jack`, 귤 `gyul` + `gyulShower` + `audio.jackpot`
- 도감 '개울' 칸에 fish:3~5 (`dexicons.js FISHI`). 업적 이벤트 `fish`, `fish-jackpot`, `fish-<id>` (`fish-dageum`·`fish-okdom`·`fish-gcarp`). 업적 정의는 아직 없음
- 확인용 `__oreum.fish.jack(true)` 다음 입질을 잭팟으로

## #56 타겟 표시·화면 밖 방향 표시
- `aimTarget()`(main.js): 사거리 안에서 카메라 앞쪽에 가까운 적 우선(거리×각도 가중). 전투 오름이면 F 를 누르기 전에도 발밑 고리(`aimMark`) + 머리 위 귤색 세모(`aimTri`)를 항상 표시
- `tickEdgeAim()`: 화면 밖 `THROW_AIM.edgeRange`(40m) 안 적을 가까운 순 최대 3개, 가장자리에 `.edge-aim`(세모+종류 아이콘, 가까울수록 크고 진함). 아이콘은 `EDGE_IC` (임시: 멧돼지 '멧', 트럭 봉투)

## UI 누르면 토스트 (2026-11-16, #60)
- uitips.js: 표 TABLE 한 곳에 [선택자, 문구 함수]. document click 위임이라 데스크톱 클릭·폰 탭 모두 동작, 이동·카메라는 안 막음. toast(msg, sec) 에 시간 인자 추가(1.8초), 다른 UI 를 누르면 바로 바뀜
- 대상(누르면 창이 안 열리는 것): 배낭·호주머니, 깨끗한 정도, 구역, 버프, HP, 날씨, 해돋이·해넘이 칩, 장소·접속자, 걸음, 굼부리 바퀴, 나침반. 상점·업적·메뉴·소리·클린하우스 화살표는 원래 동작

## 어드민 설정 (#83)
- `?hwi=1` 로 기억된 기기에서만 메뉴 맨 아래 '어드민 설정' 줄이 보인다(`#m-dev`, main.js 개발자 블록). 시간대는 `todOverride` + 저장 키 `oreumoreum.hwi.tod`(내 화면에만, 새로 고쳐도 유지, '실제 시간으로' 로 해제). 날씨는 `wx.set`.
- 모두 리셋 = 확인 한 번(4초 안에 다시 누르기) 뒤 `{reset:1}` 로 지우고 시간대 키도 지움. 어드민 키는 유지. 귤 +10,000 유지.
- 안 한 것: 서버 종류 바로 바꾸기, 더미 치우기/채우기, 투기꾼·몹 부르기(이슈의 '임의' 항목).

## 위쪽 한 줄 (2026-11-16, #75)
- page.html `#topbar`: 왼쪽 `.tb-l`(귤 `#gyul-pill`·배낭 `#bag-pill`·깨끗한 정도 `#clean-pill` 고리+%) | 가운데 `.tb-c`(HP `#hp-bar`·버프 `#buff-pill`, 있을 때만) | 오른쪽 `.tb-r`(구역 `#zone-pill`·좌표 `#xy-pill`+북쪽 화살표 `#xy-north`·오늘의 업적 `#ach-chip`). 모든 칸 `.tpill` 같은 알약, 높이 `--tb-h`(36/폰 32), 숫자 tabular-nums, 색은 흰색·귤색만
- 뺀 것: 장소·닉네임·접속자, 해돋이 칩, 날씨, 걸음·둘레, 나침반, 조작 안내 `#hint`, 위쪽 소리 버튼(`#menu-sound` 만, 데스크톱 메뉴에도 보임)
- 넘침: main.js `topFit` 이 0.2초 간격(바뀔 때만)으로 필요한 폭을 재서 `#topbar[data-fit]` 0→3 단계: 1 구역+좌표 합치기(구역 안이면 좌표 칸에 구역 아이콘), 2 업적 고리 숨김(메뉴 업적 타일), 3 배낭 용량·꽃 점·여백 줄이기. 폰은 오른쪽에 메뉴 버튼 자리(`--tb-end`)
- 토스트·배너는 `calc(var(--tb-top) + var(--tb-h) + 10px)`, 배너가 떠 있으면(`body.banner-on`) 토스트는 그 아래. 가장자리 방향 표시(placeArrow·edge-aim·경고)는 `topFit.bottom + 72` 아래로만
- 튜토리얼: 귤(bonus)·배낭+깨끗한 정도(pick) 차례에 나오고, 구역·좌표·업적(`data-tut="hud"`)은 끝나면. 개발용 라벨 UI-01~09 새 구성

## 튜토리얼 다시 짜기 (#62) — 귤 줍기·과녁 던지기, 단계마다 꼭 해야 넘어감
- 단계(`src/tutorial.js`, save.tut.v 3): walk → run → gyul(바닥 귤 3개, 줍기 E) → throw(과녁 3번 맞히기, F) → pick(쓰레기 6개) → dump → bonus → tongs → bag → gate. 예전 v2 저장은 step ≥ 2 면 +2(귤·과녁 건너뜀), 이미 끝낸 사람은 그대로 끝
- 들머리 배치(`balance.js TUT`): 시작 5 → 걷기 원 14 → 달리기 원 30 → 귤 35.5·37.5·39.5(`gyulD`) → 과녁 49.5 길 오른쪽 2.2(`targetD/Lat`, 판 높이 `targetH`) → 개울 58 → 쓰레기 67.5~77.5(가게 골목 84 앞) → 클린하우스 94 → 정낭 112
- 보이지 않는 벽(`TUT.walls` [자리, 단계]): `nsbound.crossLine(d)` 를 따라 `col.addBox`, 그 단계를 마치면 `col.setOff`. 다가가면(`wallNear`) 땅 따라 귤빛 띠가 보이고, 목표가 뒤에 있으면 #tut-arrow 가 목표를 가리킴
- 귤 3개: 튜토리얼이 만든 메시(평소 줍기 귤과 별개). main.js `startPick` 이 `tut.gyulNear` 를 쓰레기보다 먼저 보고 웅크려 `takeNow` 에서 `tut.takeGyul` + 귤 1. 주운 번호 save.tut.gyul
- 과녁: `life.addTargets` 로 등록 → throw 단계에만 `aimTargets` 에 들어가 자동 조준(#56 발밑 고리·세모, 가장자리 표시 ◎). 맞으면 즙·`audio.splat`·판 흔들림, save.tut.hits. 끝나면 과녁·귤 숨김
- 눌러야 할 곳(`focusTarget`): 걷기(폰 조이스틱)·달리기 버튼·줍기 버튼(귤·쓰레기 가까이)·상호작용(던지기·버리기·상점)·상점 탭/사기 버튼. `#tut-focus`(귤색 고리 둘 맥박 + 손가락)를 그 요소 위에 놓고 `.tut-focus`, 나머지 `[data-tut]`·상점 칸은 `body.tut-dim` 으로 흐리게. 땅 목표엔 원 + 위아래로 움직이는 화살표(`bob`)
- 남은 수 `#tut-count`(귤 n/3, 과녁 n/3), 힌트 카드 그림 `gyulKey/gyulBtn`, `throwKey/throwBtn`. UI: 줍기·귤 칸은 gyul, 상호작용은 throw, 배낭·깨끗한 정도는 pick
- 건너뛰기 버튼(#tut-skip) 없앰 → 개발자 버튼(`?hwi=1`) `#dev-tut`. 확인 스크립트 `tools/tutrun.js [d|m]`(단계마다 dist/tut-*.jpg), `__oreum.tut`(step, hits, gyuls, walls, board, focus())

## #63 귤을 더 크고 환하게
- 수치는 `balance.js` 의 `TANGERINE`(scale 1.5·color·emissive·hover/bob/spin·glow·trail). 던지는 귤·흩어지는 귤(`life.js`), 바닥에 떨어진 줍기 귤(InstancedMesh + 잎·빛 원 인스턴스), 튜토리얼 귤(`tutorial.js`)이 같이 씀. UI 귤 아이콘은 그대로
- 색은 더 밝은 귤색 + emissive(후처리 없음). 바닥 귤은 살짝 떠서 천천히 돌고 아래에 옅은 빛 원. 줍기 귤은 가까운 것(60m)만 매 프레임 갱신
- 던진·흩어진 귤은 날아가는 동안 꼬리(작아지며 옅어지는 점 `trailN`개), 땅에 닿으면 꼬리를 지우고 `restTangerine` 으로 떠서 돌기 + 빛 원(귤의 자식 메시라 귤과 함께 사라짐)
- 스크린샷: `notes/shots/63-day|dusk|night.png`

## 배경 음악·발소리 (#64)
- `src/music.js` `Music`: Web Audio 로 만드는 배경 음악(음원 없음). `audio.js` 가 `start()` 때 음악 버스(`sound.mus`)와 함께 만든다. 200ms 간격 스케줄러가 1.2초 앞까지 음을 넣음, 꺼져 있거나 ctx 가 멈춰 있으면 아무것도 안 넣음
- 평소(calm): 패드 화음(낮 Fmaj7·C/E·Am7·G6sus, 밤 Am9·Fmaj7·Dm9·Em7, 밤은 더 낮고 어두운 필터·긴 메아리) + 드문드문 종소리 음(5음 음계). 낮·밤은 `setDaylight` 값 < `MUSIC.nightK` 로 화음마다 고름
- 적 근처(tense): 8분 베이스 반복·1·3박 북·뒷박 셰이커·두 마디마다 떨리는 감화음. `sound.setThreat(bool)` 이 켜지면 `MUSIC.fadeIn`(2초) 크로스페이드, 꺼지고 `MUSIC.holdOut`(5초) 뒤 `fadeOut` 으로 돌아옴
- main.js `threatNear()`: `life.enemies.near(player.pos, MUSIC.near)` 또는 도망·떠나는 중이 아닌 투기꾼·트럭이 `MUSIC.near` 안. 매 프레임 `sound.setThreat`, 식사·머리 손질 중 `sound.setDuck(true)`(`MUSIC.duck` 배)
- 메뉴 `.m-music`: `#menu-music`(켜기/끄기) + `#music-vol`(0~100). 저장 `save.music = { on, vol }`(예전 저장엔 없으면 기본값), 리셋해도 유지. 버스 크기 = `MUSIC.gain × vol²`. 소리(전체)를 끄면 음악도 꺼짐. 폰은 입장 버튼(첫 터치)에서 `sound.start()` 할 때 같이 시작
- 확인용 `__oreum.sound.music.state()` → { mode, threat, night, active, calm, tense }
- 발소리 거친 성분 빼기: 샘플(일부 클리핑·고역 많음)을 하이패스 60 + 2단 로우패스(풀 1700·송이 2300·계단 1500·흙 2000)로 걸러 고역을 줄이고, 자르는 끝에 실제 재생 시간 기준 80ms 페이드(딸깍 없앰). 풀잎 스침 잡음은 5200Hz → 1600Hz 로 낮고 작게. 샘플이 아직 없을 때 쓰는 합성 발소리도 높은 대역 대신 1~1.3kHz 대역

## 치웠을 때·꽃밭 효과 (#65)
- `src/bloomfx.js createBloomFx({ scene, height, tier })`: 후처리 없이 3D 만. 땅 높이를 따라가는 빛 고리(띠 3줄, 더해 그리기, 풀 6개), 꽃잎(납작 마름모)·반짝이(팔면체, 더해 그리기)·귤(툰 공) InstancedMesh 3개를 풀로 돌려 씀, 꽃잎 기둥(나선으로 뿜음). 입자 최대 수 × `BLOOM_FX.tierMul[tier]` (tier = LOW 0, 아니면 `quality.level`)
- `heap({x,z,r,size,color,gyul})`: 크기 s/l/xl 마다 고리 수·꽃잎·반짝이·솟는 높이 3단계(`BLOOM_FX.heap`). gyul > 0 이면 귤도 튐(지금 더미 보상 없음, 자리만). `zone({x,z,color})`: 큰 고리 2개 + 꽃잎 기둥 + 터짐
- bloom.js: 더미 자리에 풀 포기(kind 2, `heapTuft`)를 더하고 꽃 수를 늘림(`heapRing` 6/12/20). 더미가 0 이 되면 가운데부터 `heapWave`(0.8초)에 걸쳐 풀 → 꽃 순으로 톡톡(`heapGrow` 0.45초). `bloom.replay({heap}|{zone})` 다시 피우기(확인용)
- main.js `heapFx(i, {by, gyul})`: heap-clear 이벤트에서. 소리 `sound.heapClear(0|1|2, vol)`(올라가는 종소리), 폰 진동(`pointer: coarse`), 줍기 동작이 끝나면 `cheer` 동작(runner.js, 두 팔 번쩍·통통, 움직이면 끊김). `by` 가 있으면(다른 사람) `otherR` 안에서만 보이고 소리는 거리만큼 작게, 동작·진동 없음 — 멀티 때 서버 이벤트에 by 를 넣으면 됨
- `zoneFx(z)`: zone-bloom 이벤트에서. `sound.bloomFanfare()`, 그 구역 안이면 꽃잎 기둥 + 카메라가 `camT` 1.5초 동안 물러남(`camPullT`, followCam 에서 거리·각만 더함, 조작 안 막음), `#bloom-glow` 가장자리 귤색 빛, `#bloom-banner` 구역 아이콘(번호)·화살표·구역 색 꽃 3개(글자 없음). zone-clear 글 토스트는 뺌
- 확인용 `__oreum.bloom.test`: heap(10|50|200, {clear}) 가장 가까운 그 크기 더미 옆으로 가서 효과(clear 면 실제로 비움), zone(z) 꽃밭 효과(지금 구역), fx() 입자 수. 수치 `balance.js BLOOM_FX`

## #68 투기꾼 도망 (src/dumpers.js)
- 맞으면 상태 `startle`(DUMP.startleT 0.7초: 투기꾼 펄쩍·팔 듦, 트럭 덜컹) → `flee`. 봉투는 땅에 떨어진 모양으로 DUMP.bagStay 초 남고, 주울 쓰레기 DUMP.bagDrop(3)개가 근처 더미에 쌓임(`trash.drop`)
- 도망 중 먼지·땀방울(작은 공 풀)·다급한 소리. DUMP.fleeT 6초 / fleeDist 40m / 길 끝(돌담 밖)이면 fadeT 1초 동안 서서히 사라짐. 도망·놀람 중엔 맞히기·버리기 없음
- 여러 번 맞아야 하면(트럭) 맞을 때마다 움찔(flinch)
- 확인: `__oreum.dumpers.near('walker'|'truck')` 후 `__oreum.dumpers.hit()`, `.state()`, `.dropped()`

- #73 풀 눕는 효과: 풀 셰이더(`namsongi.js` grass)의 `pres`(길·마당·가게 거리·찻밭·개울 안이면 0)를 눕는 힘에 곱함. 개울 가장자리는 `smoothstep(0.9,2.6)` 으로 부드럽게 줄어든다. 길 가장자리는 `pathMask` 가 이미 부드럽다.

## #67 길 곡선
- `src/trailshape.js` `buildTrails(K)` 가 `nsPaths` 를 만든다(예전 `namsongi.js` 의 dense/ring 꺾은선 대신). 조절점 `TRAIL_CTRL`(실제 m) → 1m 간격으로 다시 찍고 가우스(`TRAIL.sigma` 9m)로 고름. 끝은 점대칭으로 늘여 끝점·끝 방향 그대로(들머리 시작~첫 꺾임 165m 는 곧은 채라 정낭·튜토리얼 자리·#61 입구 그대로)
- 들머리 → 능선(남→북) → 굼부리 가는 길을 한 줄로 이어 고른 뒤 세 토막으로 나눔(이음 점 공유). 능선 북쪽 끝 머리핀은 반지름 `TRAIL.uR` 9m U 자 머리
- Y 갈림길: 굼부리 가는 길은 둘레 `yStem` 24m 앞에서, 북쪽 길은 첫 조절점에서 두 갈래(3차 베지어)로 갈라져 둘레에 접선으로 붙음(갈림점 쪽 둘레 점 ± `yAng` 26°). 새 선 `toCraterB`·`northB` 가 `nsPaths` 에 더해짐(`for k in nsPaths` 로 도는 곳은 자동 포함)
- 점 간격 `TRAIL.step` 4m(5.6단위, 예전 ≤8m). 길 그림(pathTex)은 점 사이 가운데를 잇는 2차 곡선으로 그림(선과 어긋남 0.2단위 안). 길 격자(surf)는 점 사이도 1단위마다 찍음
- 그래프 노드 약 530개(예전 약 250), 한 덩어리로 다 이어짐. 화면: notes/shots/67-before-top.png, 67-after-top.png

## 상황에 맞는 팁 (2026-11-16, #66)
- tips.js: 표 TABLE(id·when(S)·ic·text·go) 한 곳 + createTips. 줄만 더하면 늘어남. 처음 1번, 그 뒤 하루 1번·최대 3번 드물게(TIP.rare), 팁 사이 30초(TIP.gap), 한 번에 하나. 본 횟수는 save.tips.seen(예전 저장엔 없음), 메뉴 '팁' 버튼으로 끄기(save.tips.off)
- main.js: tipState() 가 상태(배낭 가득·살 수 있는 장비·HP 낮음·적 가까움·개울 가까움·가만히 있던 시간)를 줌. 일이 한 번 일어난 팁은 tips.event(carried·heapClear·dumper·rare·buffEnd). 튜토리얼·토스트·패널·식사·미용·쓰러짐 중엔 미룸
- 위쪽 #tip(아이콘+한 줄, 4초). 갈 곳이 있으면 눌러서: 상점 열기·클린하우스 자동 걷기·도감·더미/개울/스톤 쪽 방향 표시(shopMark 재사용 6초)
- 임시: 아이콘·문구 임시, 멀티 없음. 테스트: __oreum.save.tips, 배낭 가득(trash.fillBag)

## 첫 화면과 로고 (2026-11-16, #72)
- logo.js: '오름오름' 로고를 글꼴 없이 둥근 선(path)으로 그림. 시안 3개(logoSvg(n, {dark})), 지금 쓰는 것은 LOGO_PICK=1(겹친 능선 위 글자, 첫 '오'의 ㅇ 이 귤). logoMark() 는 글자 없는 파비콘. 시안 비교는 빌드 때 dist/logo-sian.html (dev 게시: /dev/logo-sian.html)
- 첫 화면 #intro: 로고 + 카드 하나(BETA·버전, 베타 안내 한 줄, 최근 릴리스 노트 TITLE.notes 줄 + 더 보기, 시작). 탐방로·서버·소리 고르기는 뺌. 서버를 아직 안 골랐으면 시작 다음 단계(#intro-step)에서 고름. 이미 골랐으면 바로 입장(서버는 메뉴에서 바꿈)
- 소리는 기본 켬. 메뉴에서 끄면 save.soundOff=1 로 기억 (예전 저장엔 없음 → 켬)
- 첫 화면이 떠 있는 동안 cam.mode='title': 정상 표지석 둘레를 천천히 돎(TITLE r·up·lookUp·spin). 시작하면 캐릭터 뒤로 바로 옮김. 첫 화면 위로 뜨는 화살표·표시는 CSS 로 감춤. 메뉴 '도움말'로 열면 어둡게 깔고 시작 버튼이 '닫기'
- 파비콘(data URI)·og:image(src/og.png, tools/og.mjs 로 다시 만듦)·description 은 build.mjs 가 dist/index.html 머리에 넣음. publish.yml 이 og.png·logo-sian.html 도 함께 올림. 사진 틀 오른쪽 아래 글자 대신 로고
- 도구 스크립트의 입장 클릭은 #enter → #intro-srv button → #srv-go

## 임시 모양을 Tripo 모델로: 들개·외계인·가게 3곳 (#71)
- 원본 `assets` 브랜치 `dog.glb`·`alien.glb`·`shop-stone.glb`·`shop-salon.glb`·`shop-leap.glb` → `python3 model/bake-prop.py 원본.glb <삼각형> <텍스처> <매끈 각도> 출력.glb`(bpy, bake-boar 방식 + 금속성 끔 + 건물은 35° 넘는 모서리를 각지게) → `node model/extract-prop.js 출력.glb src/model-<이름>.js <이름_M> "<설명>" <JPEG 품질>`(위치·UV 16비트). 적 3천·512(품질 70), 건물 6천·1024(품질 62). 결과 glb 는 `model/` 에 둠
- `src/propmodel.js`: `unpackProp`·`propGeometry`·`propMaterial`(멧돼지와 같은 툰+자체 빛, `clip` 이면 `material.userData.cut.value`(모델 y) 위를 잘라냄)·`propMesh(M, s, {floor})`(바닥이 로컬 y=0)·`glowSprite`(밤 빛 점)·`svgTexture`(간판 글자)
- 들개(`enemymodels.js buildDog`): 모델에 위치로 뼈 가중치(몸·머리·꼬리·짧은 다리 4, 멧돼지 방식), 크기 1.3(키 약 1.07). `fx` 가 걸음마다 몸 튀기·달릴 때 숙임·받으러 달려들 때(chg) 더 숙임·꼬리 흔들기, 머리 숙임은 0.45배. 광견병 들개는 같은 모델 ×1.05·회색빛 재질 + 머리 뼈에 붉은 눈 빛(공+스프라이트) + 침 방울
- 외계인(`buildAlien`): 모델 ×2.4, 0.95 떠서 출렁·기우뚱. 쏠 때 `enemies.js shoot` 이 `e.onShot()` → 아래 발사구 원판·번짐·빛 기둥이 밝아졌다 사그라듦, 광선은 발사구에서 나감
- 가게 건물: 자리·크기는 각 파일의 `M`(모델 좌표로 잰 벽·탁자·의자·문·창·간판 자리)와 `balance.js` 의 `s`(배율: 스톤 8, 미장원 4.8, LEAP 6.2), `W`·`D`(모델 전체 폭·깊이)
  - 스톤: 모델 테라스·탁자 둘·파라솔·전구 줄. 앉는 자리 = 왼쪽 탁자 건물 쪽 의자(탁자를 봄). 둥근 간판에 `stonelogo.js` 로고(크림 원판). 밤: 창 자리 더하기 판 + 전구 자리 `glowSprite` 8개. 야자수·받침은 그대로 로우폴리
  - 미장원: 안이 비어 있는 모델 — 창 안쪽 의자에 앉음, `inside(true)` 면 모델 y 0.6 위(간판·지붕)를 잘라냄. 간판 흰 칸 위에 SVG '루이네 미장원'. 예전 삼색 기둥 돌림·안 소품은 없앰(모델에 있음)
  - LEAP: 검은 간판 띠 위에 흰 굵은 기울임 SVG 'LEAP'(띠가 검정이라 글자를 흰색으로). 디딤판은 `addWalkable`. 밤엔 진열창 유리가 따뜻하게
- 번들이 약 1.4MB 늘어남(2.8 → 4.2MB, 대부분 건물 셋)

## 사진사 NPC (#70)
- `src/photographer.js`: 정상 표지석 근처 삼각대(바깥쪽 `PHOTOG.dist`, 내리막이면 다리가 길어짐) + 그 옆 사진사 '즈랭'(임시 이름). 우리 캐릭터 모델에 사진사 전용 장비(npc)만 입힘: 짧은 머리 + 흰 선바이저·뒤로 묶은 꼬리, 파란 바람막이, 검은 러닝 조끼(등 작은 배낭·목 카메라), 검은 레깅스, 러닝화, 오른손 짐벌. 비(wx.kind 'rain')면 노란 우비(조끼 벗음). 가까이 가면 가끔 손 흔들며 한마디, 이름표. 충돌 원 2개
- `clothes.js` 의 옷 만드는 함수 묶음을 `CLOTH_BUILD` 로 내보냄 (사진사 옷이 씀)
- main.js: 표지석 '인증샷 찍기' → 사진사 상호작용 '사진'(r `PHOTOG.r`). 누르면 손짓 → 사진 자리로 걸어감(막히거나 `walkMax` 넘으면 바로 자리에) → 포즈 3종(`photo` 만세·`photo-v` 브이·`photo-point` 가리키기, 지난번과 다른 것) → 찍기 전 다시 누르면 '포즈 바꾸기' → 3·2·1(`PHOTOG.count`) → 찰칵. 카메라는 삼각대 렌즈 앞(`camPos`)에서 `camLook`(표지석·사진 자리 가운데 가슴 높이)을 봄. 폴라로이드 틀은 그대로, 팝업에 저장(png 내려받기)·공유(navigator.share 파일, 안 되면 숨김)·닫기. 줄서기(presence.pq)는 그대로 둠. 업적 이벤트 `photo` 그대로, 무료
- 다른 사람은 원래 화면에 그려지므로 가까이 있으면 함께 찍힘. 다만 남에게 보이는 포즈는 'photo'(만세) 하나 (net 은 포즈 이름만 보냄)
- 확인용: `__oreum.photo` (photog, start, begin, state, pose, rePose, open, blob, canShare, close)

## 탈것·마차 (#69)
- `src/rides.js`: 모양(로우폴리 임시 `buildSkate`·`buildScoot`·`buildPony`, 배율 `RIDES.size` — 캐릭터 키 약 2.45), 속도 `rideSpeed(id, 기울기, 길 위)`, 러너에 붙는 탈것 `rideRig(runner)`(set: skate·skate-c(옆구리에 듦)·scoot·horse → lift·pose·still), 마차 `createCart`, 탈것 가게 `createRideShop`. 수치 `balance.js RIDES`·`CART`
- 개인 탈것: `save.rides = { own, cur }`(예전 저장엔 없음). 가게 거리 3번 터 '탈것 가게'(SHOPS 줄 ride, 팝업 SHOP_POP.ride, 카드 눌러 사기·가진 건 고르기). `#btn-ride`(가진 뒤에만, Q)는 짧게 타기·내리기, 길게(`RIDES.holdT`) `#ride-pick` 고르기
- 속도: 달리기 10 × 평지/오르막/내리막 배율(기울기 `RIDES.grade` 까지 섞음) × 길 밖 0.7. 신발·식사 버프는 안 곱함. 길 = surface + 가게 골목. 스케이트보드는 기울기 carryIn 넘으면 들고 걷기(5), 관성(손 떼도 미끄러짐, 내리막은 계속 붙음)
- 자동으로 내림(`noRideZone`): 개울(돌다리 포함)·밟는 구조물(groundAt−height>0.06: 징검돌·디딤판·테라스)·가게 터 안. 벗어나 `clearT` 지나면 다시 탐(`player.rideAuto`). 받히면 떨어짐, 식사·미용·사진·낚시·LEAP 입어 보기면 내림. 타는 동안 줍기·던지기·활·낚시 없음, 상호작용 기본은 '내리기'. 걸음·발자국 안 셈(말은 발굽 소리)
- 다른 사람: presence `rd`(skate|skate-c|scoot|horse|cart) → `net.js rideHook` 이 `rideRig` 로 모양·자세·높이. runner.js 자세 board·scoot·ride 추가
- 마차: 들머리(approach 160) → 능선 입구(approach 600) → 능선(rim 745) → 정상 아래(rim 585)를 갔다 옴. 한 바퀴 240초, 정류장마다 10초, 구간 앞뒤 서서히. 위치는 `Date.now()` 에서 계산(`cartState`) → 모두 같은 자리. 정류장 = 팻말(마차 그림)+벤치+남은 시간 고리(가까울 때만 그림). 서 있는 마차 근처면 '마차 타기'(무료) → 벤치에 앉음, 서 있을 때 '내리기', 점프로 옆으로 뛰어내림. 마차 위에선 안 받힘. 화면 가장자리 `#cart-mark`(정낭 연 뒤, 18~260)
- 확인용 `__oreum.rides`: give, mount, off, state, speed, zone, buy, open, cart(board, leave, state, at(정류장) — 시각을 당겨 그 정류장에 서 있게, shift, goStop, goCart)
- `tools/econ.js`: 탈것을 싼 것부터 (왕복만 탐, 평지 35%·길 밖 30% 가정). `--norides` 로 비교
- 임시: 모양 전부 로우폴리, 마차 충돌 없음(사람을 통과), 여러 사람이 같은 자리에 앉을 수 있음, 스쿠터 손잡이 모양 단순

## 동작(이모트) (#76)
- `src/emotes.js`: 동작 목록 `EMOTES`(id = runner 포즈 이름, name, hand 손동작, dur 초(0 = 걸을 때까지), mark 방향 표시, icon 24×24 선 path 하나 — 바퀴 칸 SVG 와 말풍선 캔버스 Path2D 가 같이 씀). 22개라 바퀴는 8칸 × 3쪽(`PAGES`). 수치 `balance.js EMOTE`
- 숨쉬기 동작·숨 고르기 화면(`#breath`, `#act-breath`) 뺌. 오늘의 업적 `d-breath` → `d-emote`(이벤트 `emote`). runner 의 'breath' 포즈는 NPC 쉬는 자세로 남김. `audio.breath` → `clap`(하이파이브)
- 동작 버튼 → `#actions` 안 둥근 바퀴(`#emo-wheel`): 바깥 8칸(가운데 점 눌러·휠로 쪽 넘김) + 안쪽 고정 4칸(`save.emoFav`, 바깥 칸을 길게(`EMOTE.hold`) 또는 오른쪽 클릭 → 안쪽 칸 눌러 바꿈). 누르면 이름 토스트. 폰은 말하기 버튼이 바퀴 오른쪽 아래(`#act-chat`). 키: 바퀴가 열려 있으면 1~8 = 그 쪽, 닫혀 있으면 1~4 = 고정 칸
- 머리 위 아이콘 말풍선 2초(나·다른 사람). 가리키기(바라보는 쪽 12m)·쓰레기 많아(60m 안 가장 가까운 더미, 없으면 바라보는 쪽)·도와줘(내 자리)는 땅 위 귤색 아이콘 표시 5초, 도와줘는 다른 사람 화면 가장자리 `.emo-edge`(8m 넘을 때). 표시 동작은 3초에 한 번
- 하이파이브: 2.6m 안 사람 쪽으로 돌아섬. 둘이 1.6초 안에 같이 하면 짝 소리·반짝·토스트
- 걷기(키·조이스틱·땅 누르기·자동 걷기)·점프·던지기를 하면 동작이 끊김(앉기·눕기 포함). 타고 있으면 손동작만(`over` 로 팔·머리만 겹침, 몸을 돌리지 않음), 몸 동작 칸은 흐리게
- net: presence `em = { id, at, mx?, mz? }`(6초 뒤 null) + 원래 `pose`. 받는 쪽은 at 이 바뀔 때 한 번 보여 줌(처음 들어왔을 때 4초 넘은 건 무시). 탈것 위 손동작은 `net.js overHook`. 포즈가 바뀌면 다른 사람 poseT 를 0 으로. #7 서버 방식도 presence 를 그대로 옮기면 됨
- runner.js `emotePose(id, t, upper, dur)`: 포즈 20종 + wave 겹치기. 골반 회전을 매 프레임 0 으로 되돌림(눕기). 놀람은 눈 크게. 동작 이름 'bow'(귤 활)와 겹치지 않게 꾸벅 인사는 'insa'
- 확인: `dist/char-motion.html?pose=insa` 등(포즈 목록에 동작 추가), `node tools/emoposes.js front "" 0.4`(동작마다 그림), `node tools/emoshot.js`(바퀴·쪽 넘김·고정 칸 바꾸기·키·걷기로 끊기·표시·연타 막기·가짜 다른 사람 말풍선·가장자리·하이파이브·탈것). `__oreum.emo`, `__oreum.doEmote(id)`, `__oreum.net`

- #80 받혀 구르는 중(player.knock)에는 점프·귤 던지기·활쏘기를 막는다. 착지 뒤 구르는 동안 점프하면 기울어진 채 뜨던 문제였다 (이동 입력은 원래 막혀 있음).

## 먼 풍경 한라산 (#81, src/halla.js)
- 남송이 전용. `buildHalla(scene)` 을 namsongi.js 하늘·바다 다음에 부름. 후처리 없이 납작한 실루엣 메시 3겹(뒤 구름띠 → 본 산 → 앞 능선), 모양은 `PROFILE`(u -1..1 → 높이 비율). 셰이더는 높이 비율 `hn` 으로 아래쪽을 지평선 색(`cur.hor`)에 녹임
- 수치 `balance.js HALLA`: 방향 `bearing`(북에서 시계, 40°), 층마다 거리 `d`·반폭 `w`·높이 `h`·`follow`(카메라를 따라가는 정도, 작을수록 움직일 때 더 어긋남). 고도 자료의 실제 정상 쪽은 약 75° 지만 들머리에서 남송이오름 몸체에 가려 북동쪽으로 당김
- 시간대 색은 namsongi.js `PRE.<때>.hal`(새벽 분홍·낮 옅은 파랑·노을 주황·밤 짙은 남색), 앞 능선은 조금 어둡게, 구름띠는 `cl` 과 지평선 사이. `applyLight` 에서 `halla.set(cur)`, `update` 에서 `halla.update(camera)`
- 먼 땅(150m 고도 격자)의 `HALLA.demCap`(420m) 위는 `demKeep` 만큼만 남겨 실제 한라산 덩어리가 원경과 겹치지 않게
- 확인 `node tools/halla.js [mobile] [곳-때,...]` → `dist/halla-<곳>-<때>.png` (곳 top·ridge·trail, 때 day·dusk·night·dawn)

## 돌탑 크기 순서 (#82)
- `main.js` `cairnSizes`: 맨 아래 돌이 가장 크고 층마다 3~6%(`CAIRN.shrink`) 작아짐. 맨 위 돌은 `topSize`(0.5) 고정, 밑동은 돌 수에 맞춰 굵어짐(상한 `maxBottom` 2.2, 위/아래 비 하한 `minTaper`). 3개: 0.55→0.50, 10개: 0.76→0.50, 50·100개: 2.2→0.48, 100개 높이 약 7.9m
- 돌을 납작하게(`CAIRN.flat`), 층마다 살짝 어긋남. 새 돌이 올라오면 이전 모양에서 새 모양으로 0.3초(`CAIRN.resize`) 보간(`stepCairn`). 저장된 돌탑도 같은 규칙. 충돌 원은 바닥 돌(반지름 1.0) 그대로, 먼 돌탑 stride 묶기 유지

## 오름 안 클린하우스 (#78)
- 자리 `balance.js CLEANHOUSE.mini`: 탐방로 `nsAlong(path, d, side, CLEANHOUSE.miniOff 6)` — 자락 숲길 갈림길(toCrater 125)·남쪽 사면 중턱(approach 456)·능선 쉼터(rim 618, 벤치 맞은편)·굼부리 들머리(crater 354). `maps.js spots.cleanMinis` 가 좌표·방향(앞면이 길)으로 바꿈. 어느 더미에서든 길 거리 300(걸어서 1분) 안에 하나: 지금 가장 먼 더미 약 282. 위에서 본 배치 `notes/shots/78-map.jpg`
- 모양 `cleanhouse.js createMiniCleanhouse`: 지붕 있는 통 넷(스티로폼·폐어구는 한 통, `CLEANHOUSE.miniBins`), 비탈이면 현무암 단을 높은 귀퉁이에 맞춰 쌓음. 표지 그림은 본체에 합치고 뚜껑 넷은 재질 하나(그리기 6번). 밤엔 등·빛웅덩이만, 실제 광원 없음. 가판대 없음(상점은 들머리·메뉴)
- `main.js`: `CHS`(들머리 + 작은 것), `chNear()`. 버리기 상호작용은 클린하우스마다, `dumpBag(ch)` 연출은 그 클린하우스 통으로(`dumpS.ch`). 화살표는 가장 가까운 곳(가는 중이면 그곳), 자동 걷기(#40)는 길 거리로 가장 가까운 곳(`chRoute`)
- 충돌은 더미 자리를 정한 뒤 등록(더미 자리·저장이 안 바뀌게), 꽃·나무(#46)보다 먼저라 나무가 안 겹침. 둘레 `CLEANHOUSE.keep`(14) 안엔 몹이 안 나옴. 투기 트럭은 길 위로만 다니고 클린하우스는 길 가장자리에서 1.5 밖
- 경제: `tools/econ.js` 는 더미마다 가장 가까운 클린하우스까지 거리(`econ-map.json fronts`, `--one` 은 들머리만). 3~5단계 값 약 1.4배 → 깨끗한 오름 효율 3시간 12분·여유 25% 4시간 3분 (spec.md 장비 절)
- 확인용: `__oreum.cleanhouse.minis()`·`goMini(i)`·`near()`·`route()`·`all`

## 성능 재기·단계 (#79)
- 재기 `node tools/perf.js [phone|desk|all] [day,night,rain,clean,battle,crowd] [--out x.json]`: dist 를 gzip 서버로 열고(폰은 4G 9Mbps·RTT 170ms, CPU 4배 느리게, 390×844 / 데스크톱 1440×900) 들머리 → 가게 거리 → 정낭 → 자락 → 능선 → 굼부리 → 정상 길목마다 다음 길목 쪽으로 걸으며 잼. 프레임 시간·JS ms/프레임(rAF 콜백 합)·draw call·삼각형·텍스처/지오메트리 수·JS 힙·첫 화면·파일 크기를 표로. 주소 `?tier=N&perf`(단계 고정·자동 내림 끔). 컨테이너는 swiftshader(코어 2개)라 fps 는 전·후 비교용, draw call·삼각형·JS ms 를 기준으로 봄
- `src/quality.js`: 단계 `TIER` 0 낮음·1 보통·2 높음. `save.perf`('auto' 기본 | 0 | 1 | 2)를 맨 처음 저장소에서 직접 읽음. 자동: 코어 2개 이하·메모리 2GB 이하·약한 GPU(`PERF.weakGpu`, swiftshader 포함) → 낮음, 폰·코어 4개 이하 → 보통, 그 밖 높음. `LOW = TIER < 2`(gfx2.js). `?tier=`·`?hi` 로 강제
- 단계별 값 `balance.js PERF`: 픽셀 배율 상한, 그림자 지도(낮음은 그림자 끔), 풀 수(9000/17000/52000), 먼 물체 감추는 거리, 다른 사람 동작·그림자 거리. 자동일 때만 느리면 한 단계씩 내림(`applyQuality`)
- 메뉴 `#menu-perf` '성능: 자동(보통)' → 낮음 → 보통 → 높음. 높음 ↔ 낮음·보통(LOW 가 바뀜)은 새로고침, 그 밖은 바로(픽셀 배율·그림자). 처음부터 다시 하기에도 남김
- `createFarCull(camera, tier)`: 여러 메시로 된 작은 무리(하르방·NPC·가게 소품·노루·까마귀·다른 사람)를 거리(`PERF.cull.r` + 반지름×`perRadius`, 단계 곱)보다 멀면 레이어 0 을 꺼서 그리기·그림자에서 뺌(제 코드의 visible 은 그대로, 빛은 건드리지 않음). `shadowR` 밖이면 그림자만 끔. 등록은 main.js 끝에서 scene 의 무리(그리기 3개 이상, 조각 반지름 40 이하)를 훑어서
- 다른 사람(net.js): `animR` 밖은 동작 갱신 생략, `shadowR` 밖은 그림자 끔, farCull 등록. 확인용 `__oreum.net.test.fake(pr)`·`drop(id)`
- 캐릭터(runner.js) 몸·옷 SkinnedMesh 가 `frustumCulled = false` 라 화면 밖·그림자 영역 밖에서도 그려지던 것을, 기본 자세 구 ×1.7 을 고정해 걸러지게
- 가로등(lamps.js): 빛 수가 바뀌면 모든 재질 셰이더를 다시 만들어 끊기던 것 → 밤엔 3개를 늘 켜 두고 세기만 0
- 하르방 움직이지 않는 조각을 재질별로 합침(10 → 4), 정낭 돌기둥 구멍 12개를 한 메시로
- 남은 것: 첫 화면(폰 4G·CPU 4배 약 17초)은 대부분 스크립트 실행(약 1.2초, 실제 속도)과 첫 프레임 셰이더 컴파일·그리기. 가게 모델(스톤·미장원·LEAP 약 1.1MB)을 늦게 풀기, 셰이더 병렬 컴파일(compileAsync)이 다음 후보. 실기기 측정 못 함

## 멀티플레이 서버 (#7)
- 켜는 법: `src/balance.js NET.server` 에 Worker 주소. 비어 있으면 예전과 똑같이 혼자 하기(아티팩트에서는 room 캐퍼빌리티). 주소창 `?server=주소` 로 탭 세션 동안 바꿔 끼움(`?server=0` 지움)
- 서버 `server/` (Cloudflare Workers + Durable Objects, SQLite). `index.js` 입구: `POST /auth/google`(구글 ID 토큰 RS256 검증 → HMAC 세션 토큰 30일), `GET/DELETE /me`, `PUT /save`, `GET /ws?room=&ch=`(WebSocket → 방 DO `방이름#채널`), 날마다 Cron 으로 7일 지난 계정 지움. 로컬 `cd server && npm run dev`(가짜 로그인 `fake:이름`·통계 켬)
- `accounts.js` 계정 DO 하나('all')의 표 `acc`: sub·닉네임·저장 JSON·rev·치운 양(#11 랭킹용)·credit·접속 시각만. 이메일·이름·사진 없음
- `validate.js` 저장 확인: 옷·탈것·머리·장비 단계는 목록에 있는 것만, 새로 산 것 값 + 늘어난 귤이 계정 credit(초당 `NET.earnPerSec`, 상한 `earnBurst`) 안이어야 함. 넘으면 귤을 깎고, 못 산 물건이면 물건을 되돌림(클라이언트는 서버 기록으로 새로고침). 치운 양도 같은 방식. 기기 기록 옮기기는 목록 확인·귤 상한(`migrateCoinsMax`)만
- `roomcore.js` 방 규칙(순수 JS, Node 에서 재기 가능): 위치 등 presence 를 0.1초 틱마다 받는 사람별로 바뀐 것만 묶어 보냄. 150m 밖은 5틱마다. 옷·닉네임은 바뀔 때만, 빈 값은 뺌. 메시지 초당 15개·맞힘 알림 초당 3번·거리 45m 확인. 쓰레기 더미 남은 수는 방이 주인(`take`/`put`, 바뀐 더미는 틱마다 `hs` 로 모아 알림, 5초마다 저장). 다시 쌓기(투기꾼)는 방장(먼저 온 사람)만. 정원 `NET.roomCap`(30), 차면 `full` → 다음 채널
- 클라이언트 `src/online.js`: `saveKey`·`loadSave`(로그인하면 `<키>.acct` 사본), `createAccount`(바뀌면 15초 모아 PUT, 탭 숨김·닫기 때 바로, 다른 기기 기록이 더 새것이면 입장 전에 받아 새로고침, 서버가 바로잡은 귤 반영), `mountLogin`(첫 화면 베타 안내·구글 버튼, 시작 버튼이 '손님으로 하기'. 처음 로그인한 계정이면 기기 기록 옮길지 한 번 물음), `createWsLobby`(net.js 의 room 자리, 끊기면 다시 붙음), `linkTrash`(trash 저장소 takeOne·putBack·seen 을 방으로). 메뉴 `#m-acct` 남은 날짜·로그아웃·내 기록 지우기
- 확인: `node tools/online.js`(로컬 서버에 브라우저 둘: 서로 보이기·더미 함께 쓰기·방장만 쌓기·가짜 로그인·옮기기·귤 바로잡기), 부하 `node tools/loadtest.js [주소] [인원들]`, 프레임 `PERF_CROWD=N node tools/perf.js desk crowd`
- 남은 것: 몹(전투 오름)·투기꾼 모습은 아직 사람마다 따로(더미 수만 방이 주인), 귤 줍기·업적 보상은 credit 으로만 막음(하나하나 서버 판정은 아님), 손님도 방에는 들어옴

## 의견 보내기 (#77)
- 클라이언트 `src/feedback.js` `createFeedback({ key, post, meta })`: 글 하나(`FEEDBACK.max` 500자)를 기기 저장 `<키>.fb`(처음부터 다시에도 남음)의 `q` 에 넣고, 서버가 있으면(`online.js postFeedback` → `POST /feedback`, 로그인 없이) 바로 보냄. 실패하거나 서버가 없으면 모아 두고(`keep` 30) 다음 시작 때 `flush()` 로 한꺼번에(`batch` 10). 연달아 보내기 `gapMs`(1분)
- 같이 가는 값: `ver`·`srv`(clean/battle)·`map`·`dev`(phone/tablet/desktop)·화면 크기·좌표 `x,z`·`nick`. 이메일 등은 받지 않음(창 안내: 답장을 원하면 글에 직접)
- 버튼: 메뉴 `#menu-feedback`('의견 보내기'), 첫 화면 베타 안내 옆 `#intro-feedback`(창은 `z-index 12` 로 첫 화면 위). 예전 social.js 의 db 저장·GitHub 이슈로 열기는 뺌
- 서버 `server/src/feedback.js`: `cleanItems` 칸 확인·길이 자름, 계정 DO 표 `fb`(id·at·ip 해시·item·mailed) 에 저장, 주소마다 1시간 `ipPerHour`(20), 최근 `dbKeep`(2000)만. 메일은 Email Routing `send_email` 바인딩 `FEEDBACK_MAIL` + 시크릿 `FEEDBACK_TO`·`FEEDBACK_FROM`, UTF-8 MIME 직접 만듦. 바인딩은 wrangler.toml 에 주석(Email Routing 켠 뒤 풂), 없으면 저장만. 로컬 `GET /feedback`(STATS_OPEN) 로 목록
- 확인 `node tools/feedback.js [서버주소]`

## 보안 점검 (#84)
- 전제: 클라이언트 코드는 누구나 본다. 귤·장비·옷·탈것·머리·치운 양은 서버(`server/src/validate.js` 몫 방식)가 기준, 이동·줍기·맞힘은 방(`roomcore.js`)이 판정
- 수치는 `balance.js` `NET` 아래쪽(rooms·maxSpeed·moveSlack·warpGap·takePerSec·strike*·dropKick·banSec·reqPerMin·loginPerMin·wsPerMin·sessionDays·nickMax·sayMax)
- 글 다듬기 `src/safetext.js` `cleanText(v, max, {lines})`: 제어·방향(RLO)·폭 없는 글자·꺾쇠 빼고 코드 포인트 단위로 자름. 서버(저장 닉네임·presence nick/say·의견)와 게임(net 닉네임·말풍선)이 같이 씀. 남이 보낸 글은 늘 캔버스·textContent 로만
- 방: 받아 준 자리에서 `(지난 시간 × maxSpeed 32 + 여유 8m)` 넘게 움직이면 `{t:'pos'}` 로 되돌림(main.js 가 자리 옮김), 순간 이동은 `warpGap` 10초에 한 번만 받아 줌(들것 귀환·앉기). 줍기는 초당 `takePerSec`, 못 주우면 `{t:'h', no:1}` → `linkTrash` 가 `trash.undoTake(h)` 로 배낭·누적 수에서 하나 뺌. 되돌리기·버린 메시지가 쌓이면 `{t:'kick'}` 후 끊고 그 계정·주소 해시는 `banSec` 동안 `{t:'ban'}` (방 DO 메모리라 채널마다 따로)
- 입구 `index.js`: SESSION_SECRET 32자 미만이면 `/health` 말고 503. Origin 은 `ALLOW_ORIGINS` 만(로컬 주소는 FAKE_AUTH·STATS_OPEN 일 때만), Origin 없으면 거절. 방 이름은 `oreum-<NET.rooms>(-battle)` 만. 주소 해시별 요청 수(메모리 + `[[ratelimits]]` RL_API·RL_LOGIN·RL_WS). 응답 보안 헤더. 오류 내용은 내보내지 않음. console 로그 없음
- 세션 토큰 `v2.{s,i,e,j}.HMAC` (14일, `/me` 에서 7일 아래로 남으면 새 토큰 + 옛 것 버림). 계정 DO `auth()` 가 계정 있음·만든 뒤의 토큰·버린 토큰(표 `rv`, Cron 이 만료분 지움)을 봄. `POST /logout` 은 그 토큰만 버림. WebSocket 토큰은 주소창 대신 하위 프로토콜 `['oreum', 't.<토큰>']`
- 주소(IP)는 `ipKey`(SESSION_SECRET 으로 HMAC, 8바이트)로만. 의견 표 `fb.ip` 도 이것
- 어드민: 시크릿 `ADMIN_SUBS`(sub 쉼표). `/me`·로그인 응답 `admin`, 어드민 저장은 몫 확인 생략(귤 채우기), `GET /feedback` 은 어드민만. 게임: 서버가 있으면 `?hwi` 무시, `account.admin` 일 때만 `enableDev()`. 서버가 없으면 예전대로 `?hwi=1`
- 빌드: `PUBLIC=1`(publish.yml 의 release) 이면 `window.__oreum` 은 어드민에게만(`exposeDebug`). dist/index.html 에 meta CSP(게임 스크립트는 sha256 해시, GIS·글꼴·https/wss·로컬 주소만)
- 확인 `node tools/sec.js` (wrangler dev 넷을 띄워 49가지 공격 흉내), `node tools/online.js` 에 보안 확인 4개 더함. loadtest 는 Origin 헤더를 붙임(`ORIGIN=` 로 바꿈)
- 남은 위험: 구글 계정 여러 개(계정마다 몫·기기 기록 옮기기 3만 귤), 손님(기기 저장)은 마음대로, 더미 거리 판정 없음(줍기 속도·치운 양 몫으로만), 방 안 맞힘은 거리·빈도만, 끊긴 사람은 다른 채널로 갈 수 있음, 요청 수 제한은 Worker 여러 개에 퍼지면 느슨함

## 전체 검수 (#16)
- `node tools/audit.js [d|m] [clean|battle]`: 첫 화면 → 서버 → 캐릭터 → (튜토리얼 건너뜀) 더미·클린하우스·가게 5곳·탈것·마차·낚시·사진사·돌탑·동작·투기꾼·(전투) 몹·활·HP·들것 → 꽃밭·정상·한라산 → 메뉴 창 모두·어드민 → 새로 고침·예전 저장. `dist/audit/` 에 화면과 `<d|m>-<srv>.json`(오류·HUD 겹침·화면 밖·글자 넘침). 튜토리얼은 `tools/tutrun.js d|m`
- `node tools/oldsave.js`: 빈 저장·아주 예전 저장·깨진 값·중간 버전 저장 넷으로 들어가 오류·멈춤을 봄
- 위 가운데 줄: 배너(`#banner`)·팁(`#tip`)·토스트(`#toast`)는 위에서부터 이 순서로 쌓임. `topStack()` 이 보이는 것의 높이를 `--ban-h`·`--tip-h` 로 넘기고 `body.banner-on`·`body.tip-on` 으로 민다. 셋 다 `width: max-content` (폰에서 left 50% 상자가 절반 폭으로 줄던 것)
- 화면 가장자리 표시(`placeArrow`)는 같은 프레임에 46px 안에 겹치면 테두리를 따라 비켜 놓음
- 첫 화면이 떠 있는 동안 HUD 는 감추고, 그사이 온 '자리를 비운 사이' 알림은 들어간 뒤 보여 줌(`introToast`)
- 작은 클린하우스 둘레 5.5 는 나무를 심지 않음(`buildNamsongi clear`). 더미 자리는 그대로
- 도감: `trash.js rollDex` 가 #52 때 줄 가운데 주석으로 잘려 `undefined` 로 쌓이던 것을 고침. 불러올 때 목록에 없는 도감 id 는 지움
- 뱃지 보상 `item`(예전 옷 색)은 #52 옷장과 이어지지 않아 귤만 줌

## main.js 를 기능별 파일로 (#86)
- src/main.js(237KB) → src/game/ 22개 파일(가장 큰 것 25KB). main.js 는 바깥 모듈을 예전 순서로 읽은 뒤 game/ 파일을 순서대로 import 만 한다. 구조·규칙은 prototype-v1.md 코드 구조
- 나누기는 문장 단위로 기계적으로 했다(acorn·eslint-scope 로 이름 추적). 동작 코드는 그대로이고, 파일 사이 이름만 import·`state.이름`·`late.이름` 으로 바뀜
- 지운 예전 코드: 손잡기(신청·수락·손 놓기 UI, 손 잡은 사람 따라 걷기, 손 잇는 선, net.js 핸드셰이크·presence hr/hw/hd/drv, 뱃지 b-hand), 숨 고르기 포즈(runner 'breath', animate 의 breath 값), 쓰지 않던 npc.js, 귤 먹기 즙 효과(juiceBurst·tickJuice, 부르는 곳 없음), 쓰지 않던 import·값(HP·TOOL_GEAR·MOOD·wxIcon·fmtKST·colr·HAIR_LABEL)
- 소원 돌탑은 지금 기능(돌탑 #12·#28·#82, spec "소원 글은 유지")이라 남김. 노루 타기·벤치 앉기도 업적·식사에 쓰여 남김

## 내려받기 줄이기 (#85)
- 모델 떼어 내기: 캐릭터·가게 3곳·들개·외계인·멧돼지·머리 3종·발소리를 JS 에서 빼서 `dist/a/*.bin` 으로. 캐릭터는 첫 화면에 필요해 `<link rel=preload>` 로 게임 코드와 나란히 받고, 나머지는 첫 프레임 뒤 둘씩 받음(내가 쓴 머리는 바로). 받기 전엔 회색 상자·타원체 임시 모양
- 압축: 메시는 meshopt(정점 순서 다시 늘어놓기 + 정점·인덱스 압축, 손실 없음, `tools/assetcheck.mjs` 로 확인). 텍스처는 jpg 그대로: KTX2 는 three 의 Basis 변환기(wasm 527KB + js 57KB)가 텍스처 전체(약 1.2MB jpg)의 절반만큼이라 처음 받는 양이 오히려 늘어서 뺐다. GPU 메모리를 줄여야 할 때 다시 봄
- 풀기: three.js meshopt 디코더(wasm). CSP 에 `'wasm-unsafe-eval'`(wasm 만, JS eval 은 그대로 막음). wasm 이 막히면 meshoptimizer 의 JS 디코더로
- 첫 화면: 첫 프레임 뒤 `renderer.compileAsync` 로 셰이더 미리 준비, 모델이 올 때마다 다시
- 배포: index.html 은 인라인 스크립트 대신 `main-<해시>.js`. 파일 이름에 내용 해시라 바뀐 것만 다시 받음. publish.yml 이 main-*.js·a/ 도 올리고 예전 것은 지움. test.html·oreumoreum.html 은 예전처럼 한 파일(모델도 안에)
- `tools/modelshots.js`: 가게·머리·적 화면을 찍어 전·후 비교(모델 늦추기를 주면 임시 모양)
- tools/perf.js: 기본으로 index.html 을 Pages 처럼(html·js 만 gzip) 열고, 처음 받는 양·전체 양·다 받은 시간·JS 힙을 같이 적음
- main.js 의 import 목록은 `src/modules.js` 로 옮김(main.js 는 캐릭터 모델을 받은 뒤 modules.js 를 읽기만)


## 랭킹 (#11)
- 치운 쓰레기 수(줍는 순간 +1 되는 `trash.total`) 순위. 오늘(한국 자정)·이번 주(한국 월요일 0시)·전체 × 깨끗한 오름·전투 오름. 길드 없음. 수치는 `balance.js RANK`, 날 번호는 `src/rankday.js`(서버·게임 같이 씀)
- 서버: 계정 DO 표 `rkd`(sub·srv·한국 날 번호·수, `RANK.dayKeep` 9일만)·`rka`(전체)·`acc.look`(머리 키|피부색 번호, 목록 확인). `PUT /save` 에서 서버가 확인한(`validate.js` 치운 양 몫) 누적 수가 늘어난 만큼만 저장의 `server` 쪽에 더함. 줄어든 것(처음부터 다시)은 빼지 않고, 기기 기록 옮기기 몫은 전체에만. 랭킹 전 계정의 치운 양은 처음 뜰 때 전체(깨끗한 오름)로 옮김
- `GET /rank?range=day|week|all&srv=clean|battle` → 위 `RANK.top`(50)명 {rank·n·nick·look, 내 줄 me} + `me`{rank,n} + total(치운 사람 수). 같은 수는 같은 순위, 같으면 먼저 만든 계정이 위. 위 50명은 `RANK.cacheMs`(10초) 메모리 캐시. `GET /rank/me?srv=` → 오늘·이번 주·전체 내 순위. 둘 다 로그인한 사람만(sub 는 내보내지 않음)
- 게임 `src/rank.js createRank`: 메뉴 '랭킹' 타일, 들머리 클린하우스 왼쪽 게시판(상호작용 '랭킹', `cleanhouse.js` boardFront). 1~3위 귤색 메달, 내 줄은 귤색 테두리·`position: sticky`(화면 밖이면 위·아래에 붙음), 50위 밖이면 맨 아래 따로. 닉네임은 textContent, 머리 그림은 look.js `HEAD_SVG`
- 손님·서버 없음: `trash.store.localRank(srv)` (저장 `trash.rk`: 날·주가 바뀌면 0, 처음엔 누적 수를 전체로) 세 칸 + '로그인하면 랭킹에 올라가요'
- 버린 뒤(연출 끝 1.6초 뒤, `RANK.checkGapMs` 간격): 저장을 바로 보내고 `/rank/me` 로 오늘 순위가 오르면 토스트 '오늘 12위 → 9위'(처음이면 '오늘 9위'). 오늘 10위·1위 안이면 업적 이벤트 `rank-top10`·`rank-top1`(하루 한 번, `save.rankAch`) → 뱃지 '오늘의 열 명'·'오늘의 일등'
- 확인: `node tools/online.js` 끝에 랭킹 7가지(토스트·업적·내 줄·메달·전체 탭·전투 탭·손님), 화면 `dist/rank-online.png`

## #88 예전 뱃지·옛 UI 지우기
- 지운 뱃지: 굼부리 열 바퀴(b-lap-10)·남벽 앞에서(b-wall)·노루 기수(b-rider)·두 길의 러너(b-both) + 아이콘. 오늘의 업적에서 다랑쉬·돈내코 전용(굼부리 바퀴·남벽·다랑쉬 정상·다른 탐방로 가 보기) 지움. 예전 저장의 받은 기록(`ach.badges` 중 없는 id, `ach.visited`)은 불러올 때 지움
- 지운 UI·코드: 메뉴 '다른 탐방로' 버튼, `#maps` 창, `buildMapPick`, 굼부리 바퀴 세기(`update.js`·`laps`), 체력 시절 `.fx-stamina` CSS
- 남긴 것: 다랑쉬·돈내코·입구 맵 코드(`maps.js`·`donnaeko.js`·`gate.js`)와 서버 `rooms` 목록은 주소 해시로만 열리는 상태로 그대로 둠 (튜토리얼·방 이름과 얽혀 있어 따로 안전하게 지울 것). `.stamina-track` 은 이미 없음, 손잡기 흔적은 더 없음

## 로고 다시 (#87)
- `src/logo.js`: 획 굵기가 고른 고딕 '오름오름'(선 path, 끝은 자른 모양, 글자 사이 촘촘히). 두 '오'의 ㅇ 모두 귤(#ff8a1f 원 + 초록 잎). 능선·둥근 붓 글자·시안 1~3 은 지움. `logoSvg({ dark, weight, halo })` 하나(가로형). 글자색은 밝은 배경 먹색 #211f1c, 어두운 배경(dark) 흰색
- 굵기 `LOGO_WEIGHTS` 굵게(13)·아주 굵게(16.5), 쓰는 것은 `LOGO_WEIGHT = 'bold'`(굵게)
- 파비콘 `logoMark()`: 귤 하나(잎 포함), 배경 없음, 잎을 크게 해 16px 에서도 보임. 앱 아이콘 `logoIcon()`: 둥근 타일 + 귤 하나 (시안 3 대신)
- 바꾼 곳: 첫 화면 타이틀(낮·밤 장면 위라 흰 글자 + 그림자), 사진 틀(먹색), 공유 이미지 `src/og.png`(tools/og.mjs 다시 돌림), 파비콘. 랭킹 창엔 로고가 없음
- `dist/logo-sian.html`: 굵게·아주 굵게를 밝은·어두운 배경에 나란히 + 파비콘 16~64px + 앱 아이콘

## 폴리싱: 힐링 시간과 공격 시간의 조화 (#89)
- 연출 감독 `src/pacing.js`(박자만, DOM 없음) + `src/game/pace.js`(연결). calm → omen(조짐 3초) → tense(공격, 다 쫓아내거나 30~90초) → rest(쉼 90초) → calm. 수치는 `balance.js PACE`
- 남송이에선 투기꾼·트럭(dumpers `hooks.paced`)과 몹(enemies `hooks.paced`)이 스스로 오지 않고 감독이 부름. 쓰레기 없는 맵은 예전대로 `ENEMY_SPAWN.every`
- 박자: 깨끗한 오름 5~8분에 한 번(트럭+투기꾼 60% / 투기꾼 둘), 전투 오름 3~4분에 몹 한 무리(구역별 마릿수 `PACE.battle.group`, 두 번에 한 번 투기꾼 하나 더). 몹이 못 나오는 곳(들머리·다 핀 구역)이면 투기꾼으로. 낚시·가게·마차·튜토리얼 중엔 20초씩 미룸
- 투기꾼 양: 한 시간 양(DUMP_PER_HOUR)이 평균으로 맞게 한 번 양을 나눔(깨끗한 트럭 약 114). 트럭 최대 `PACE.truckMax` 140 → 전투 오름은 시간당 쌓이는 양이 예전보다 적음(몹이 헤집는 쓰레기는 그대로). 방금(10분) 다 치운 더미는 노리지 않고, 플레이어 140m 안 더미를 4배로 먼저. 시간이 다 되면 오는 중인 투기꾼은 그 자리 가까운 더미에 서둘러 버리고 떠남
- 꽃: 내가 더미를 다 치우면(heap-clear)·구역이 꽃밭이 되면 10초 동안 조짐도 시작 안 함. 음악에 높은 종소리 한 겹(`Music.swell`, 더미 14초·구역 32초)
- 첫 공격: 튜토리얼 뒤 더미를 한 번 치운 다음 35초 뒤 투기꾼 하나. 저장 `save.pace { first, bloomed }` (예전 저장은 더미를 치운 적이 있으면 둘 다 1)
- 조짐: 화면 가장자리 방향 표시(몹 '!', 투기꾼 봉투), 그 쪽에서 새들이 날아오름(`bloom.flushUp`), 까마귀 소리, 긴장 음악 시작. 투기꾼은 조짐 동안 돌담 밖에 숨어 있다가(hold) 나타남
- 끝: 다 쫓아내면 귤 보너스(깨끗한 6·전투 9, 일부만 쫓아내면 1/3) + 귤 쏟아짐 + '오름을 지켜 냈어요', 새 떼가 돌아옴
- 전환(state.tension 0~1, 3초에 오르고 5초에 내림): 화면 가장자리 붉은 기운(#pace-edge), 하늘 노출 12% 낮춤, 카메라 10% 가까이, HP 막대는 긴장 때·다쳤을 때만, 긴장 음악 fadeIn 2.5초·fadeOut 4초. 긴장 중엔 팁·잭팟·마차 표시 없음
- 손맛: 귤을 맞히면 0.06초 멈춤(시간 8%) + 둔한 '퍽'(`sound.thud`), 몹도 움찔(튀어 오르고 뒤로). 줍기 콤보: 1.6초 안에 이어 주우면 5음계로 한 칸씩 올라가는 음(최대 10칸). 클린하우스에 버리면 귤이 쏟아짐(gyulShower)
- 지루함: 3분 넘게 일이 없으면 하나씩 돌아가며 — 드문 쓰레기 반짝임(가까운 더미 위 반짝이 + 60초 동안 드문 것 8배), 노루 두 마리가 지나감(45초), 반딧불이 떼(밤만, 40초), 잭팟 조짐(개울 40m 안이면 다음 입질이 잭팟)
- 지금 규칙 확인(바꾸지 않음): 받히면 가진 귤 10%가 흩어져 다시 주울 수 있음(쓰레기는 쏟지 않음), 쓰러져도 잃는 것 없이 대기 시간만
- 확인: `node tools/pace.js` (20분 흉내 플레이 표 + notes/shots/pace-89.svg/png), `--seeds 50`, `--live`(실제 게임 깨끗한·전투 한 번씩, notes/shots/pace-89-<서버>.png)

## 노루·하르방·가로등을 Tripo 모델로 (#2)
- 원본 `assets` 브랜치 `deer.glb`·`hareubang.glb`·`lamp.glb` → `python3 model/bake-prop.py 원본.glb <삼각형> 512 <매끈 각도> model/<이름>.glb`(노루 3000·180°, 하르방 1800·50°, 가로등 1500·50°) → `node model/extract-prop.js model/<이름>.glb src/model-<이름>.js <이름_M> "<설명>" 70`. 결과 glb 는 `model/` 에 둠
- 따로 받기(#85): `tools/packassets.mjs` 에 hareubang·lamp·deer, `assets.js ORDER` 끝. 노루는 `whenAsset(..., { lazy: true })` 로 기다리다가 노루가 `LIFE_MODELS.deer.near`(140m) 안에 오면 받음(`lifemodels.js wantDeer`). 받기 전엔 회색 타원체·상자·막대 임시 모양
- `src/lifemodels.js`: 노루(멧돼지·들개 방식, 위치로 뼈 가중치: 몸·머리·꼬리·짧은 다리 4)와 하르방. 예전 상자 노루·하르방 코드는 life.js 에서 지움. 노루 `fx`: 걸음마다 출렁·달릴 때 숙임·풀 뜯을 때 오물오물·경계할 때 고개 돌림·도망칠 때 꼬리를 세우고 시작할 때 움츠렸다 튐. 큰 머리라 숙임은 0.62배
- 노루 타기: 러너 자세 'ride'(조랑말과 같이 걸터앉기), 높이·뒤쪽 자리 `LIFE_MODELS.deer.seatY/seatZ`(`update.js`)
- 하르방: 배율 3.2(키 약 3.1m, 예전과 같음), 충돌·귤 맞히기 그대로. 맞으면 받침을 축으로 흔들리고 들썩임(`shakeHareubang`)
- 가로등 `lamps.js`: 한 InstancedMesh(모델을 돌려 귤 등이 +z, 기둥이 원점). 귤 부분 정점에 `glow` 표시 → 밤에 그 부분만 따뜻하게 빛남(`lampNight` × `LIFE_MODELS.lamp.glow`), 낮엔 텍스처 귤색 그대로. 둘레 가산 공(밤만)·바닥 빛웅덩이·가까운 3개 PointLight 는 예전처럼, 자리만 귤 등 아래로. 기둥 충돌 반지름 0.3
- 확인: `node tools/lifeshots.js dist index.html <이름> [늦추기 ms]` (하르방·가로등·노루 낮·밤·노루 타기), `__oreum.lifeModels`(mount(i)·dismount()·lamps())

## 두 번째 전체 검수 (#90)
- 돌린 것: `tools/audit.js d|m clean|battle`, `tutrun.js d|m`(둘 다 오류 0 끝까지), `oldsave.js`(4가지 통과), `econ.js`, `pace.js --seeds 50`, `sec.js`(49/49), `online.js`(전부 OK), 새 `tools/slownet.js 3g|fail|dead`
- 가장자리·위 표시 겹침(`dump.js placeArrow`): 지난 프레임 자리와 비교하던 것을 이번 프레임에 이미 놓인 표시와만 비교(순간 이동·카메라 돌 때 클린하우스·마차·가게 표시가 한 자리에 겹침). 크기(클린하우스 거리 글자 포함)로 겹침을 재고, 테두리를 따라 가운데 쪽·바깥쪽을 번갈아 24px씩 빈자리를 찾음. 위쪽 한계는 위쪽 줄 + 보이는 토스트·팁·배너 아래(긴 토스트가 표시를 가림). 화면 안 표시도 그 아래로만, 위가 막히면 아래로 쌓음. 폰 아래 여백 190 → 240(왼쪽 아래 동작 버튼과 겹침)
- 폰 동작 바퀴가 떠 있는 동안 탈것 버튼·탈것 고르기 감춤(바퀴와 겹침, `page.html`)
- 옷장 카메라(`look.js clearYaw`): 캐릭터 앞 카메라 자리까지 사물(클린하우스·나무 충돌 원)이 있으면 30°씩 돌려 빈 쪽으로 몸을 돌림 (폰에서 들머리 클린하우스 앞에서 열면 지붕에 가려짐)
- 탈것 가게 값에 쉼표(`ride.js`, 2,000·5,000)
- 느린 연결(#85 뒤): 첫 화면 '시작' 버튼이 게임 모듈을 다 읽기 전에도 보여 눌러도 반응이 없었음 → 처음엔 `disabled`·깜빡임, `start.js` 가 연결한 뒤 켬. 모델 받기 실패 뒤 다시 받기를 4초 고정 → 4초부터 두 배씩 최대 1분(`assets.js`). 3G 흉내에서 첫 화면 약 14초(누를 수 있게 16초), 들어갈 때쯤 모델 14개 모두 옴. 모델을 끝까지 못 받아도 임시 모양으로 걷기·프레임 정상
- `tools/audit.js`: 헤드리스가 초당 1~2프레임이라 버리기·낚시 확인이 거짓 실패하던 것 → 상호작용 대상이 잡힐 때까지·귤이 늘 때까지 기다림
- `notes/spec.md` 장비 도달 시각·5일 곡선·하루 끝 표를 `econ.js --table` 결과로 맞춤(값은 그대로)
- 홈 화면 추가 (#91): `tools/icons.mjs`(playwright, `og.mjs` 방식)가 `logoIcon()` 을 `src/icons/` 에 PNG 4장으로 굽는다 — apple-touch-icon 180(네모 꽉 참)·icon-192·icon-512·icon-maskable-512(`safe`: 귤을 0.8배로 줄여 가운데에). CI 에 playwright 가 없어 PNG 는 커밋하고 `build.mjs` 가 dist 로 복사 + `manifest.webmanifest`(이름·짧은 이름 '오름오름', standalone, orientation any, 바탕·테마 #24251f, 상대 주소 `./` 라 dev/실서버 모두 맞음) 를 씀. `<head>` 에 apple-touch-icon·manifest·theme-color·apple-mobile-web-app-* 메타, CSP 에 `manifest-src 'self'`, `publish.yml` 이 manifest·PNG 를 함께 올림. 아이콘 4장은 `logo-sian.html` 에도 나란히. 로고를 바꾸면 `node tools/icons.mjs` 다시

## 멀티에서 노루와 노루 타기 (#92)
- 서버 방이 있을 때만(`src/game/deernet.js`, 혼자 하기는 그대로). 노루마다 이름 `id`: 무리 `h<n>`(만든 순서), 다 핀 구역 `b<구역>-<n>`, 지나감 `d<무작위>`. `life.addDeer(x, z, n, ids)` 는 이미 있는 이름이면 그 노루를 씀
- 노루 무리는 방장(먼저 온 사람) 화면이 움직이고 `DEER.netMs`(0.33초)마다 `{t:'deer', d:[[id,x,z,방향,상태,빠르기,따라가는 사람]…]}` → 다른 사람은 `life.remote` 로 시뮬레이션을 멈추고 받은 자리로 부드럽게 이음(25m 넘게 벌어지면 바로 옮김). 방장은 다른 사람도 피함(`life.others`, 가장 가까운 사람). 방장이 나가면 다음 방장이 지금 자리에서 이어감(`takeOver`: 먹이·따라가기 풀고, 다 핀 구역 노루는 이름으로 이어 받고, 앞 방장의 지나감 노루는 `deerT` 뒤 떠남)
- 다 핀 구역 노루·'노루가 지나감'(#89)은 방장 화면에서만 생김. 받는 쪽의 지나감은 방장에게 `{t:'dv', k:'visit'}` 부탁(방장은 동시에 3무리까지)
- 귤 먹이: 받는 쪽이 던진 귤이 노루 `DEER.feedR` 안에 떨어지면 `{t:'dv', k:'feed', i}` → 방장 화면 노루가 보이지 않는 귤(`life.feedAt`)을 먹고 그 사람을 따라감(`followWho`). 받는 쪽은 따라오기 시작하면 귤을 지우고 토스트·소리·`fed` 업적 그대로. `DEER.feedRetry` 초 안에 안 오면 다시 부탁
- 노루 타기: `mountDeer` 가 방에 `{t:'mount', i}` 를 묻고 `{t:'rides'}` 에 내 이름이 오면 탐. 누가 타고 있으면 화면에서 바로, 방도 `{t:'mount', no:1}` 로 거절 → '다른 사람이 타고 있어요'. 내리면 `{t:'unmount'}`, 끊기면 방이 풀고 내 화면도 내림. presence `dr`(탄 노루) → 다른 사람 화면은 그 노루를 탄 사람 자리로 옮기고 `ride.js peerRide` 가 걸터앉은 자세·노루 등 높이(`seatY`)·앞뒤(`seatZ`, `net.js` rideHook `fwd`)
- 서버 `roomcore.js`: `deer`(방장만, `NET.deerMax` 4000바이트·80마리)·`dv`(보낸 사람 60m 안, 방장에게만 `from` 붙여)·`mount`·`unmount`, `hi` 에 `rides`. 노루 메시지는 따로 초당 `NET.deerPerSec`(5)
- 노루 타기 빠르기 `DEER.rideWalk`·`rideRun`(9·15)을 `balance.js` 로, `NET.maxSpeed` 는 `max(32, rideRun × 2)`
- 확인: `node tools/online.js [주소] [deer]` 에 노루 9가지(방장·위치 같음·타기·A 화면 걸터앉음·둘이 못 탐 화면/방·내리면 풀림·지나감 같이·귤 먹이·끊기면 풀림(deer 만 돌릴 때)), 화면 `dist/deer-ride-a.png`·`deer-ride-b.png`. `__oreum.deerNet()`

- #95 메뉴 계정 칸에 "계정 번호 복사" 버튼. `account.sub` 만 노출(토큰 아님). 클립보드가 막히면 읽기 전용 글 상자(`acct-box-id`)로 보여 줌. 손님은 계정 칸 자체가 없음.

## 스톤 첫 식사 무료 (#93)
- `save.mealFree`(1 = 썼음). `orderMeal` 이 첫 주문엔 귤을 받지 않고 플래그를 세움(어떤 메뉴든, 버프는 같음). 안 썼으면 메뉴 값 자리에 "첫 식사 무료"(`.price.free`), 다 쓰면 값. 가게 근처(22m)에 처음 가면 팁 `stoneFree`(#66)
- 서버 `validate.js`: `mealFree` 는 한 번 1이 되면 되돌릴 수 없음(`fixed: 'mealFree'`, `accounts.js` 가 `fix.mealFree` 로 알려 `onFix` 가 로컬에 반영). 어드민(`free`)은 확인 안 거쳐 '모두 리셋' 뒤 다시 받음. 모두 리셋·처음 시작은 로컬 저장이 지워져 다시 받음
- 확인: `econ.js`·`sec.js` 49/49·`err.js` 오류 없음, `checkSave` 직접 호출, `__oreum.stone.order` 로 첫 주문 귤 그대로·두 번째는 값 받음

## 손님 기록도 7일 안 오면 지우기 (#94)
- `online.js` `loadSave`: 손님(세션 없음)은 `save.lastSeen`(마지막 접속)이 `NET.keepDays` 일보다 오래됐으면 소리·그래픽 설정(`gfx·gfxV3·perf·introSound·music`)만 남기고 지움. 값이 없던 예전 저장은 지금으로 채워 바로 지우지 않음. `writeLocal` 이 저장마다 `lastSeen` 갱신(`stampGuest`). 서버로 보내는 `strip` 에선 `lastSeen` 뺌
- 지웠으면 `guestExpired` → 첫 화면 `#intro-expired` "7일 동안 오지 않아 기록이 지워졌어요". 메뉴에 손님용 `#m-guest` "기록 보관 N일 남음"(`start.js`). `privacy.html` 손님 문장에 7일 안내
- 확인: `build.mjs`, `tools/oldsave.js`(8일 지난 `old8` 추가: 귤 777 → 5 로 초기화, 설정 유지) 통과

## 어드민 메뉴에서 받은 의견 보기 (#96)
- `src/game/inbox.js`: 서버 어드민(`enableDev`)일 때만 개발자 메뉴에 "받은 의견" 항목. 패널에 최신순 목록(한국 시각·글·닉네임/버전/기기), 글은 `cleanText` 후 `textContent` 로만 그림. 누르거나 길게 누르면 글 복사, "새로 고침"·"더 보기"(`?before=<id>`)
- 마지막으로 본 id 는 기기 `oreumoreum.inbox.seen`. 새 글 수는 개발자 메뉴 항목·"어드민 설정"·메뉴 버튼의 점으로. 확인은 게임 열 때 1번 + 메뉴 열 때(30초 안 다시 열면 건너뜀)
- 서버 `GET /feedback?before=<id>` 이어 받기(어드민만). `online.js` `getFeedback`
- 확인: `build.mjs`, `tools/err.js`, `tools/sec.js` 49/49 통과. 화면 확인은 어드민 로그인이 필요해 하지 못함

## 원스토어 웹게임 SDK 붙이기 (#97)
- `build.mjs`: Pages 용 index.html 머리에 SDK v1.2.0 을 `<script type="module" async>` 한 줄로 게임 코드보다 먼저 로드(받으면 `window.__onestoreSDK` + `onestore-sdk` 이벤트). CSP `script-src` 에 그 한 줄의 해시와 `https://h5sdk.onestore.net`, `connect-src` 에도 같은 출처. async 라 SDK 를 못 받거나 늦어도 첫 화면을 막지 않음
- `src/onestore.js`: createSDK → pause/resume/exit → initializeAsync(5초 넘게 답 없으면 일반 브라우저로) → 진행률 → startGameAsync. `{ err }` 면 아무 것도 안 함. 진행률은 main.js 10(시작)→60(내 캐릭터 모델)→85(게임 모듈)→100(셰이더 준비 또는 첫 프레임 3초 뒤, update.js)
- 앱 안: pause → `state.osPaused`(frame 이 그리지 않음)·AudioContext suspend, resume → 되돌림(ringerSilent 면 소리 끔), exit → writeLocal·ab.flush·서버 keepalive push, 뒤로 → 패널·메뉴·탈것 고르기·옷장·앉기·사진·첫 화면 서버 고르기를 닫고 true(캐릭터 고르기·아무 것도 없으면 false). safeArea → page.html `--safe-t/b/l/r`(왼·오른쪽 env 를 변수로 모음). 기기 무음이면 소리 끈 채 시작
- 임의 결정: 앱 안(`html.onestore`)에서는 구글 로그인 버튼을 숨기고 손님으로. playerId 로 계정 만들기는 안 함
- `?onestore=mock`(+`&silent=1`): 가짜 SDK, 콘솔 `__onestoreMock.pause()/resume()/exit()/back()`. 확인 `node tools/onestore.js` 15/15, `tools/sec.js` 50/50(인라인은 SDK 로더 하나·해시 허용 검사 추가), `tools/err.js`, `tools/perf.js phone day`
- 공식 가이드(gitbook) 페이지는 이 실행에서 읽지 못해 이슈에 적힌 SDK 요약대로 만듦

## #107 적에게 맞으면 누워 버림
- 원인: placeRunner 가 `root.rotation.y` 만 바꾸고 넉백·누움 기울기를 quaternion 에 곱했다. 곱한 결과가 Euler x·z 로 남아 다음 프레임에 또 곱해지고, 넉백이 끝나도 지워지지 않아 누운 채로 남았다(노루 타기·되살아남 뒤도 같음)
- `src/bodytilt.js`: `orientBody` 가 heading 에서 다시 시작해 움찔(player.knock)·누움(hp.lie)을 축×각 벡터로 합쳐 한 번만 기울임(최대 1.6rad). 노루 위·멀티의 남도 같은 함수
- 맞음 모양: 날아가 구르고 일어나던 것(#32) 대신 짧게 뒤로 밀리고(`BOAR.knockSpeed 10·knockV 4·knockDrag 7`, 약 1.3m) 움찔(`flinchAng 0.38` 을 `flinchPeak 0.08` 초에 젖히고 `flinchT 0.45` 초 안에 바로 섬). 그동안 조작 잠금. 연달아 맞으면 처음부터. 맞는 동안 비탈 숙임(뼈)은 줄임
- 체력 0: 밀림이 땅에 닿으면 바로 쓰러짐 시작(`hp.tryBegin(P)`, rollT 인자 없앰)
- 멀티: presence 에 `kn: [번호, 축x, 축z]`(맞는 동안만). 받는 쪽은 새 번호면 받은 때부터 같은 움찔·놀란 눈, 처음 보는 사람의 지난 번호는 무시
- 확인 `node tools/hittilt.js` (전투 오름): 평지·비탈·연달아·달리기·#80 움직임·던지기·줍기·동작·탈것·노루·쓰러졌다 되살아남, 게임 시간 2초 뒤 몸 기울기 5° 안
- `tools/audit.js` 71줄 낚시 단계 주석이 뒤 코드를 삼켜 문법 오류였던 것을 `/* */` 로 고침

## #99 어드민: 들어오기 다시
- 개발자 메뉴에 "들어오기 다시" 버튼(`#dev-intro`, `src/game/menu.js`): save 에서 `entered`·`look`·`server` 만 지우고 새로 고침. 장비·귤·치운 양·튜토리얼·로그인(`_rev`·`_acct` 포함)은 그대로. 첫 화면(로그인 포함)→서버 고르기→캐릭터 고르기를 다시 지남
- 두 버튼 설명 한 줄을 어드민 패널에 붙임. 어드민이 아니면 `m-dev` 가 숨겨져 보이지 않음

## #101 탈것 값 올리기
- `balance.js RIDES.list` 값: 스케이트보드 600→1500, 스쿠터 2000→4000, 조랑말 5000→8000. 이미 산 탈것은 그대로
- `tools/econ.js` 로 장비 10칸 맞추는 시간은 여유 25% 기준 놀이 4시간 13분(5시간 안 통과), 효율 4시간 6~7분(탈것 안 사는 기준과 같음) — 비율 조정 필요 없었음
- 마차는 그대로. 첫 탑승 토스트(`src/game/ride.js`)를 "마차는 정해진 길만 다녀요. 점프하면 뛰어내려요" 로

## #98 서버는 전투 오름 하나 (깨끗한 오름 삭제)
- 들어오기: 첫 화면 → (로그인/손님) → 캐릭터 고르기 → 튜토리얼. 서버 고르기 단계(`#intro-step`)·메뉴의 서버 바꾸기(`#menu-server`, `#server` 창)·그림 카드(`SERVER_ART`) 지움
- `src/server.js`: 서버는 `battle` 하나. `isBattle()` 갈래를 걷어 냄(적·HP·귤 활 무기 탭·스톤 스테이크·샐러드·버프 흐림·타겟 표시·팁). `isBattle` 은 도구 호환용으로만 남김
- 예전 저장: `save.server` 가 clean 이면 battle 로(장비·귤·치운 양 그대로). 쓰레기 칸 `trash.srv.clean` 은 battle 칸이 없을 때만 옮기고 지움. 기기 랭킹 `trash.rk` 의 clean 수는 battle 에 더해 한 줄로. `tools/oldsave.js` 에 `clean` 경우 더함
- 연출 박자 `PACE.clean` 지움, `createPacing` 의 `isBattle` 인자 없앰 (battle 값 그대로)
- 멀티 방: `oreum-<맵>-battle` 하나. 서버 `index.js` 는 예전 `oreum-<맵>` 접속을 battle 방으로 보냄 (`tools/sec.js` 가 두 이름이 같은 방인지 봄)
- 랭킹: `SRVS = ['battle']`. 서버 DB(`rka`·`rkd`)의 clean 줄은 계정 DO 가 뜰 때 battle 에 더하고 지움(한 번만). `/rank?srv=clean` 도 battle. 랭킹 화면 서버 탭 지움
- 도구: `econ.js`·`pace.js`·`audit.js` 는 battle 만. `pace.js --live` 는 로그인 상자 때문에 작은 창에서 시작 버튼이 화면 밖이라 evaluate 로 누름

## #100 튜토리얼: 토스트 안내·단계마다 격리된 칸·쉽게
- 그림 힌트 카드(#tut-hint)·남은 수(#tut-count)를 위쪽 토스트 `#tut-toast` 하나로 (상황 팁 #66 자리·모양, 아이콘 + 한 줄 + 남은 수). 문구는 `tutorial.js SAY` 한곳(PC 키 / 폰 버튼, 보통 / 쉬운 말). 단계가 끝나면 '잘했어요'(TUT.okT) 뒤 다음 단계. 다른 토스트는 그 아래로(`hud.js topStack` export)
- 칸: `TUT.cells` 4칸(걷기·달리기 / 귤·과녁 / 개울·쓰레기 / 클린하우스·가게). `stonewall.js createPens` 가 낮은 돌담(#39 조각, 높이 TUT.penH 배)과 칸 사이 정낭을 세움. 정낭은 `createCrossWall` 에서 `jeongGate` 로 떼어 같이 씀. 개울 위엔 담 없음(빠지면 낚시꾼이 칸 안으로 건져 줌). 4칸 왼쪽 담이 가게 골목 입구를 막음. 칸을 마치면 정낭이 열리고 정낭 앞뒤로 빛나는 길(TUT.lane*). 끝나면 담·정낭·충돌 모두 지움(예전 보이지 않는 벽 TUT.walls 는 없앰)
- 쓰레기 6 → 3(TUT.trashD), 과녁은 귤 바로 앞(targetD 44)·크게(targetR 1.1). 손 던지기는 원래 귤이 줄지 않아 빗나가도 그대로. 집게·배낭 단계에서 값이 모자라면 귤을 채움(topUp)
- 진행이 없으면 TUT.fingerT(10초) 뒤 손가락·목표 화살표, TUT.easyT(30초) 뒤 토스트를 흔들고 쉬운 말로. 진행 = 목표에 1.5m 더 다가감, 줍기·맞히기·누를 곳 바뀜. 손가락은 `#tut-focus.idle` 일 때만
- 튜토리얼 동안: 몹(pace)·투기꾼은 마지막 정낭 단계까지 안 나옴(`save.jeong` 조건 뺌), 날씨는 맑음(`weather.js calm`, 어드민이 정한 날씨는 그대로), 가게 가장자리 아이콘 없음, 멀티에서도 혼자(`net.js solo`: 남을 감추고 내 위치를 안 보냄, 귤 맞히기 대상에서도 뺌)
- `tools/tutrun.js d|m [shots]`: 칸 안 배치·닫힌 정낭/담 막힘·정낭 열림·10초/30초·귤 안 줄음·끝나면 담 사라짐까지 확인. m 은 화면 버튼 탭만으로

- #102 구글 로그인 버튼: 직접 그린 버튼(시작 버튼과 같은 크기·글자, 구글 G 로고) 위에 투명한 GSI 버튼을 같은 너비로 덮어 누름만 받음(너비 바뀌면 다시 그림, 높이는 scaleY 로 맞춤). 로그인 중·실패 글은 같은 버튼 안. 로그인 흐름·CSP 그대로.

- #103 의견 보내기 앞쪽으로: 위쪽 한 줄 오른쪽 끝에 말풍선 아이콘(#fb-chip)이 바로 의견 창을 열고, 메뉴 맨 위에 주황색 큰 "의견 보내기" 버튼(#menu-feedback). 설정 목록의 항목은 뺌. 첫 화면 것은 그대로. 좁은 폭(320)에서 위쪽 줄이 넘치지 않음(fit 단계 f5 에서 아이콘 패딩 줄임).

- #104 줍기 버튼 걷기: 누를 때(E·버튼) 범위 안이면 바로 줍고, 없으면 `PICK_SEEK.range`(25m) 안 가장 가까운 쓰레기(낱개·더미, 튜토리얼 귤 단계면 귤)로 걸어가 닿으면 바로 주움(`pickup.js` pressPick·startSeek·tickSeek). 길 찾기는 #40 과 같은 `trailRoute`(dump.js 의 `late.trailRoute`), 충돌·막힘은 탭 이동과 같음. 누르고 있으면 다 주운 뒤 다음 가까운 것으로 이어 감. 다시 누르기·조이스틱·방향키·땅 탭·패널·쓰러짐·탈것이면 멈춤. 고른 쓰레기에 #56 겨눔 표시와 같은 고리+세모(민트색 `PICK_SEEK.color`). 배낭이 가득이면 걷지 않고 가득 토스트, 없으면 "근처에 쓰레기가 없어요". 줍기 버튼은 찾는 거리 안에도 없을 때만 흐림. 가득 토스트 조사 고침(배낭이/호주머니가). 콘솔: `__oreum.trash.press()`, `.state().seek`, `.stopSeek()`.

- #105 모바일 전체 화면·가로세로: 새 파일 `src/game/screen.js`. 터치 기기면 위쪽 줄 오른쪽(의견 버튼 앞)에 전체 화면 버튼(#fs-chip), 메뉴 설정(m-more)에 "전체 화면" 항목(#menu-fs). Fullscreen API(webkit 접두 포함)로 들어가고 나옴. 페이지 전체 화면이 안 되는 곳(iPhone Safari)은 버튼을 숨기고 게임에 처음 들어갈 때 "홈 화면에 추가하면 전체 화면으로 할 수 있어요" 토스트 한 번(`save.fsHint`), 메뉴 항목을 누르면 같은 안내. 홈 화면 앱(standalone)·원스토어 앱(`.onestore`)에서는 둘 다 숨김. manifest 는 이미 display standalone·orientation any. 돌리면 다시 불러오지 않고 `resize()` 가 화각까지 맞춤: 낮은 가로 화면(가로가 길고 높이 ≤ 500)은 세로 화각 62°, 나머지 50° (`balance.js SCREEN`). iOS 용으로 orientationchange 뒤 한 번 더 맞춤. page.html 끝에 낮은 가로 화면 media query: 첫 화면은 로고 왼쪽·카드 오른쪽(릴리스 노트 목록은 "더 보기"로), 창(.pop·가게 창·LEAP)은 화면 높이 안에서 안쪽 스크롤, 메뉴는 위쪽 줄 아래까지만·스크롤, 사진은 사진 왼쪽·버튼 오른쪽. 폰 세로에서 첫 화면 카드·가게 창이 옆으로 몇 px 넘치던 것 border-box 로 고침. 확인: `node tools/uishot.js both` (세로 390x844·가로 844x390, 화면마다 넘친 요소를 출력, 끝에 돌려서 화각 확인)

- #106 캐릭터 몸·옷 구조 다시: 새 파일 `src/basebody.js` — 옷 없는 매끈한 기본 몸 한 메시(몸통+목·팔·벙어리장갑 손·다리·발, 부위 번호 10개). Tripo 모델(runnermodel.js)은 목 위 삼각형만 남겨 머리로만 씀(머리 장비를 쓰면 안 그림). 옷·장비는 모두 몸 위에 따로 얹고 `covers` 로 덮는 몸 부위를 감춤(정점을 접어 삼각형째 없앰). 예전에 몸에 구워져 있던 재킷·반바지·운동화·배낭(`top:base`·`bottom:shorts`·`shoes:s1`·`back:pack`)도 따로 만든 것으로 바꿈(키 이름·저장 그대로). 옷의 맨살 관(팔뚝·종아리)·쓰레빠 발은 뺌(몸이 그림). 장비 하나는 정점 색으로 구워 한 메시: 캐릭터 하나 그리기 1단계 17→8, 5단계 49→15, 삼각형 1단계 16.8k→10k. 남·여 체형은 허리·골반 폭(`bodyWarp`), 머리 모양으로 정함(단발·똥머리 = 여). 모자를 쓰면 모자 윗면 위로 나온 머리카락(똥머리)을 감춤(`clip`). 확인 `node tools/chars.js <이름>`(표), 디버그 `__oreum.charKit`. 팔꿈치·무릎 뼈는 아직 없음(팔·다리 뼈 하나씩)

- #108 실서버에서 적이 나타나면 게임이 죽음: 휴대폰 흉내(iPhone·Android UA·터치·CPU 4~6배 느리게, 소리 켬)로 dist 를 Pages 처럼 올려(.bin 따로 받기·meshopt wasm) 감독 경로로 들개·외계인·광견병 들개 무리를 불러도 오류·크래시·context lost 없음(힙 20MB 안팎), 실서버 1분 서 있기도 오류 없음 → 그대로 다시 만들지는 못함. 가장 그럴듯한 원인: `update.js frame()` 이 맨 끝에서 다음 프레임을 불러, 프레임 안 어디서든 오류 하나가 나면 루프가 영영 멈춤(화면이 굳어 '죽은' 것처럼 보임). 이제 다음 프레임을 먼저 부르고 `step()` 을 try 로 돌림
- 안전장치: 적 한 마리 갱신 오류 → 그 적만 지움, 적 모양 만들기 오류 → 대신할 모양(`buildFallback`), 들개 공유 모양은 다 만든 뒤에 씀, 적이 사라질 때 뼈 텍스처도 내림. WebGL 화면 잃음 → `#gl-lost` 안내, 되살아나면 셰이더 다시 준비, `CRASH.glWait`(6초) 안에 안 되면 "다시 불러오기"
- 오류 알림 `src/crash.js`: error·unhandledrejection·프레임/적/모양/gl 오류를 한 번에 하나씩 POST /feedback(kind 'crash', 메일은 안 보냄). 보내는 것: 버전·기기 종류·화면 크기·OS/브라우저 이름·오류 첫 줄과 자리·마지막 한 일(적 등장·모델 받음 등). 좌표·닉네임 없음. 같은 오류는 이번 실행에 한 번, 기기당 하루 `CRASH.perDay`(3)번, 한 번 켤 때 `CRASH.perRun`(5)개까지. 어드민 '받은 의견'에 점선 칸 '⚠ 오류 알림'. 서버 `cleanItems` 가 kind 를 남기고 `sendMail` 은 crash 를 뺌(서버 배포 뒤부터 kind 표시; 그 전에도 글이 "[오류 …]" 로 시작)
- 확인 `node tools/enemyrun.js all` (무리 3번 36초 + 안전장치: 적 오류·프레임 오류·WebGL 잃고 되살림·promise 오류·하루 횟수·개인 정보), `--dead` 모델을 끝까지 못 받을 때, `--live` 실서버

## #109 내가 산 탈것을 고르는 창
- 탈것 창(`#ridewin`, `ride.js` 의 `openRideWin`): 걸어 다니기·스케이트보드·스쿠터·조랑말 카드. 산 것은 눌러 바로 고름(타고 있으면 내렸다가 새 것으로 탐, 못 타는 곳이면 고르기만), 안 산 것은 흐리게 값과 함께 보이고 누르면 탈것 가게 방향 표시(6초) + 토스트
- 메뉴에 "탈것" 칸, 탈것 버튼 옆 작은 ▾ 버튼, 길게 누르기도 같은 창. 예전 `#ride-pick` 줄은 없앰
- `save.rides.walk`: 1 이면 걸어 다니기를 골라 둔 것 → 탈것 버튼을 누르면 타지 않고 창이 열림
- 걸어 다니기 아이콘은 임시

## #110 더미 마지막 쓰레기 뒤 꽃 피는 동안 잠깐 멈추기
- `pickup.js`: 내가 더미(`heap-clear`)·구역(`zone-clear`)의 마지막 쓰레기를 주우면 `bloomHold` 타이머가 켜져 그동안 줍기 버튼을 누르고 있어도 다음 쓰레기로 자동 이어가지 않음(줍기·걸어가기 모두). 시간은 `balance.js` `BLOOM_HOLD`(더미 2.5초·구역 4초, 임의값)
- 멈춘 동안 캐릭터가 꽃(더미 자리) 쪽을 보고, 카메라는 기존 꽃밭 카메라(`camPullT`)로 물러남
- 조이스틱·방향키·땅 탭, 25m 안 적·투기꾼, 맞는 중이면 바로 풀림. 낱개 쓰레기는 그대로 바로 이어감

## #112 의견 보내기 버튼 글자·강조색
- 위쪽 줄 `#fb-chip` 을 말풍선+"의견 보내기" 귤색 알약으로. 좁으면 topFit f3 에서 "의견", f5 에서 아이콘만(색 유지). 메뉴 큰 버튼·첫 화면 글자도 귤색(`--acc`)
- 처음 들어온 뒤 1.5초 후 한 번(기기 저장키 `.fbhint`) 버튼이 통통 튀고 "불편한 점을 알려 주세요" 말풍선 3초 (panels.js)

## #116 줍기 메시지
- 주울 때마다 `#pickmsg` 작은 줄(화면 아래 가운데, 버튼 위)에 "캔을 주웠어요" 표시. 새로 주우면 바꿔 쓰고 같은 것을 이어 주우면 "캔 ×3", 2초 뒤 사라짐. 기존 toast 와 따로라 다른 안내를 가리지 않음. 내 줍기만 띄움(`pickup.js` takeNow → `hud.js` pickMsg).

## #111 장비를 순서 없이 사기, 귤이 모자란 것은 흑백
- `shop.js buyGear(k, i)`: 귤만 있으면 어느 단계든 바로 삼, 값은 그 단계 값만. 산 단계 아래는 '가짐'. 자물쇠·'앞 단계를 먼저 사요' 없앰 ('곧 나와요' 무기는 그대로 잠금)
- 튜토리얼 집게·배낭 단계에서는 그 물건(바로 다음 단계)만 (`tutOnly`)
- 귤이 모자란 것은 `.poor` 흑백: 장비 단계 칸·사기 버튼, 옷 탭, LEAP(신발도 순서 없이 `buyGear('shoes', i)`), 미장원·스톤·탈것 카드. 귤 수가 바뀌면(`updateStats` → `late.shopCoinsChanged`) 열린 상점·가게 팝업을 다시 그림
- 서버 `validate.js spentOf`: 장비는 올라간 단계 값만 셈 (여러 단계 건너뛴 저장도 통과)
- `tools/econ.js --skip`(튜토리얼 뒤 최고 단계만 사는 길), `tools/anyorder.js`(브라우저 확인)

## #118 카카오톡 안 브라우저 안내
- `src/inapp.js`: 페이지 맨 앞 인라인 스크립트(빌드가 `page.html` 의 `__INAPP__` 자리에 넣고 CSP 해시에 더함). userAgent 에 KAKAOTALK(자동 `kakaotalk://web/openExternal?url=` + 안드로이드는 1.2초 뒤 크롬 `intent://`) 또는 Instagram·FBAN|FBAV·NAVER(inapp·Line/ (안내 화면만)이면 `#inapp` 안내 화면(바깥 브라우저로 열기·주소 복사·아이폰은 ⋯ 안내·작은 '그냥 여기서 하기')
- Pages 빌드(`index.html`)는 게임 코드(`main-*.js`)를 이 스크립트가 불러옴(`data-main`). 인앱이면 '그냥 여기서 하기' 를 누를 때까지 안 받음. 한 파일 빌드(test.html)는 코드가 인라인이라 안내가 위에 덮기만 함
- 실제 기기 확인은 사용자가

## #113 첫 화면 베타 안내
- 첫 화면 문구를 "베타 테스트 중이라 부족한 점이 있어요. / 의견 보내기로 많이 알려 주세요!" 두 줄로 바꿈(폰 390·PC 모두 두 줄).
- "기록이 초기화될 수 있어요"는 의견 보내기 창 안내 끝으로 옮김. #intro-feedback 그대로.
- #114 전망 안내판(spots.sign, maps.js): 정낭 안쪽 하르방 뒤(approach G0+9, 왼쪽)에서 맞은편(G0+12, 오른쪽 5m)으로 옮겨 길에서 올라오면 바로 보임. 앞면은 길 쪽, 충돌은 spots.sign 을 따라가 함께 이동. 하르방은 그대로

## #115 멀티: 옷·닉네임은 바뀔 때만 보내기
- net.js send(): 옷·닉네임(`o`·`nick`)은 처음 붙음·바뀜·다시 붙음(내 peer id 가 바뀌거나 끊김) 때만 싣고, 그 밖엔 자리·동작만. 서버가 버린 메시지(속도 제한·이동 되돌림)에 실렸을 때를 대비해 `NET.identMs`(10초)마다 한 번 더. room 캐퍼빌리티(서버 없음)는 presence 를 통째로 바꾸므로 늘 실음
- roomcore presence(): `o`·`nick` 이 없으면 앞에 받은 값을 그대로 씀(한 번도 안 받았으면 없는 채로 = 받는 쪽 기본값). 검사·크기 상한·속도 제한은 그대로. 옛 클라이언트(매번 다 보냄)도 그대로 됨
- 30명 방(loadtest --core·로컬 서버): 서버가 받는 양 139KB/s → 41KB/s, 받은 메시지 처리 0.83 → 0.67ms/틱, 나가는 양은 그대로(~590KB/s). `tools/loadtest.js --old` 로 옛 방식 재기, online.js 에 옷 바뀜·새로 온 사람 확인 더함

## #122 오류 알림 자동 점검용 주소·자리 찾기 도구
- 서버 `GET /crashes?days=3`(1~7일): 의견 표 fb 의 kind 'crash' 만 버전+오류 글(숫자·16진 해시는 #)로 묶어 `{ key, text, ver, n, first, last, dev:{phone,tablet,pc}, ua:[많은 순 3], acts:[가장 최근 것 마지막 한 일] }` 를 많은 순 50묶음까지. 로그인·Origin 없이 읽음(예약 작업이 curl 로), 요청 수 RL_API, 60초 캐시. DO 는 글·버전·기기 종류만 꺼내고(닉네임·좌표·IP·의견 글은 꺼내지 않음) cleanText 로 한 번 더 거름. 값은 balance.js CRASHES
- crash.js: 자리 글 80→120자(함수·파일·줄·칸이 다 들어가게), 글이 길어도 끝의 브라우저/OS 이름은 남게(서버가 끝 칸으로 나눔)
- `node tools/crashmap.js <버전> <main-해시.js:줄:칸>`: `git log -S"VERSION = '<버전>'"` 로 버전을 넣은 커밋을 찾고, 그 버전이던 커밋들(빌드 입력이 다른 것만)을 임시 worktree 에서 esbuild 만 감싸 소스맵을 켜고 dev(DEV=1)·release(PUBLIC=1)·local 로 빌드 → main 해시가 같은 빌드의 소스맵으로 원래 파일·줄·칸·함수 이름·앞뒤 줄. 소스맵은 임시 폴더에만(게시물에 안 들어감). 얕은 저장소면 먼저 전체 기록을 받음
- tools/sec.js: /crashes 가 Origin 없이 되고 의견 글·닉네임·좌표가 새지 않는지 확인 더함
- notes/auto.md 에 '오류 알림 이슈' 절

## #117 마차를 뚫고 지나가지 못하게
- collide.js 에 움직이는 부딪힘(칸에 넣지 않는 원 목록 `setDyn`): 마차가 place() 때마다 수레 셋·끌채·조랑말 셋 원의 월드 자리를 갱신. 모양은 balance.js `CART.block`
- 플레이어 이동(걷기·개인 탈것·넉백·노루 타기)만 `col.move(…, dyn=true)` 로 막힘. 마차가 서 있는 플레이어에게 오면 `col.nudge()` 로 옆으로 밀림(높이는 땅에 붙임). 나무와 마차 사이에 끼면 마차 쪽을 마지막에 밀어 마차 속에는 남지 않게
- 마차에 앉아 있는 동안은 updatePlayer 가 일찍 끝나 부딪힘 없음. 타기 거리(CART.cartR 6m)·내리는 자리(길가 3m)·뛰어내림(옆 3m)은 그대로
- 다른 플레이어·노루·적은 안 막힘(이번 범위 밖). 확인 `node tools/cartblock.js` (느린 헤드리스라 4~5분 걸림)

## #134 새 버전 새로고침 알림
- build.mjs 가 `dist/version.json`(`{v, main}`)을 만들고 publish.yml 이 dev·release 둘 다 게시. 게임(src/game/newver.js)은 5분마다·탭 복귀 때 `version.json?t=` 를 캐시 없이 받아 지금 `script[data-main]` 과 다르면 위쪽 알림(새로고침·닫기). 한 파일(test.html)은 data-main 이 없어 확인 안 함
- 튜토리얼·창·전투·쓰러짐·입장 전엔 미뤘다가 끝나면 띄움. 닫으면 15~30분 뒤 다시. 새로고침은 persist·서버 저장(최대 3초 기다림) 뒤 reload
- 모델 받다 404(assets.js `assetHooks.stale`) 도 같은 알림. 서버 hi 에 `minVer`(roomcore.js `MIN_VER`, 지금 비움)를 실을 수 있고, 클라 버전이 낮으면 닫기 없는 알림(deernet.js 가 late.newver 로 넘김)
- 수치는 newver.js 맨 위 NEWVER. 버전 0.23.6
