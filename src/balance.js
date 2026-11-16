// 게임 수치 모음 (notes/spec.md 표 그대로). 다른 파일은 여기 값만 읽는다

// 쓰레기 종류: 비율·부피·귤(클린하우스에서 받는 값)
export const TRASH_TYPES = [
  { id: 'can', name: '캔', ratio: 0.30, vol: 1, gyul: 1 },
  { id: 'pet', name: '페트병', ratio: 0.30, vol: 1, gyul: 1 },
  { id: 'vinyl', name: '비닐', ratio: 0.20, vol: 1, gyul: 1 },
  { id: 'foam', name: '스티로폼', ratio: 0.12, vol: 2, gyul: 3 },
  { id: 'gear', name: '폐어구', ratio: 0.08, vol: 3, gyul: 5 },
];

// 쓰레기 더미 (#45): 구역마다 더미가 놓임. 흩어진 쓰레기·자정 리셋은 없음 (튜토리얼 6개만 낱개)
// n 쓰레기 수, r 가장 가득할 때 반경(도구 반경은 이 가장자리에서 잼), h 높이(캐릭터 키 2.45 ≈ 1.75m)
// stages: 남은 양 비율이 이 값 이하가 되면 다음(작은) 모양. 마지막 칸은 거의 다 치운 모양
export const HEAP = {
  sizes: {
    s: { n: 10, r: 0.95, h: 0.8, name: '작은 더미' }, // 무릎
    l: { n: 50, r: 1.8, h: 1.6, name: '큰 더미' }, // 허리
    xl: { n: 200, r: 3.1, h: 3.7, name: '대형 더미' }, // 사람 키 넘게
  },
  stages: [1, 0.66, 0.33, 0.12], // 4단계
  colPad: 0.15, // 충돌 반경 = 지금 모양 반경 × 0.85 + 이만큼
  gap: 7, // 더미 가장자리끼리 최소 거리
  trailMin: 3.2, trailMax: 14, // 길 옆 더미: 길 가운데에서 가장자리까지 거리 범위 (길을 막지 않게)
  nearFrac: 0.6, // 구역 더미 중 길 옆 비율 (나머지는 구역 안 빈터)
  freeMax: 60, // 빈터 더미는 길에서 이만큼 안
  seed: 45,
};
// 구역 (#45): src/zones.js zoneAt 이 위치로 번호를 구함. heaps 더미 크기별 수, min 목표 시간(권장 장비로 혼자, 클린하우스 왕복 포함)
// rec 권장 장비 단계(도구·배낭·신발, 시간 계산용), mix 나오는 쓰레기 종류 비율(TRASH_TYPES 순서: 캔·페트병·비닐·스티로폼·폐어구)
// maxD 더미를 클린하우스에서 이 거리(직선) 안에만 둠, amt 이 구역만 더미 하나의 쓰레기 수를 바꿈
// 시간 어림은 __oreum.trash.estimate() (클린하우스 왕복 = 직선 거리 × 1.15, 달리기 10 × 신발)
// 조정: 1구역은 캔·페트병·비닐만(부피 1) + 클린하우스 215 안, 5구역 대형 더미는 200 → 140개 (그대로면 약 29분)
export const ZONES = [
  { id: 1, name: '오름 자락 숲길', heaps: { s: 12 }, min: 5, rec: { tool: 2, bag: 1, shoes: 1 }, mix: [0.36, 0.36, 0.28, 0, 0], maxD: 215 },
  { id: 2, name: '남쪽 사면', heaps: { s: 10, l: 4 }, min: 8, rec: { tool: 3, bag: 3, shoes: 2 }, mix: [0.3, 0.3, 0.2, 0.13, 0.07] },
  { id: 3, name: '능선', heaps: { l: 10 }, min: 12, rec: { tool: 3, bag: 5, shoes: 3 }, mix: [0.26, 0.26, 0.2, 0.17, 0.11] },
  { id: 4, name: '굼부리', heaps: { l: 8, xl: 3 }, min: 15, rec: { tool: 4, bag: 5, shoes: 5 }, mix: [0.22, 0.22, 0.18, 0.22, 0.16] },
  { id: 5, name: '정상', heaps: { xl: 8 }, min: 20, rec: { tool: 5, bag: 5, shoes: 5 }, mix: [0.2, 0.2, 0.16, 0.24, 0.2], amt: { xl: 140 } },
];
// 구역 경계 모양 (src/zones.js)
export const ZONE_SHAPE = {
  summitR: 60, // 가장 높은 곳에서 이 안은 정상
  rimW: 30, // 말굽 능선 길에서 이 안은 능선
  craterPad: -8, // 북쪽 원형 굼부리 둘레 길에서 이만큼 (- 안쪽)
  slopeRel: 28, southZ: -90, // 솟은 높이(m) 이 위이고 정상보다 남쪽(z 가 정상 z + southZ 보다 큼)이면 남쪽 사면
};
export const TRASH = {
  cell: 32, // 튜토리얼 낱개 그리기 범위 칸
  drawR: 110, drawRLow: 70,
  heapDrawR: 420, heapDrawRLow: 260, // 더미를 그리는 거리
};

// 장비 5단계. 상점에서 다음 단계만 살 수 있고 사면 바로 착용 (#10). 저장은 save.equip.{tool,bag,shoes} = 1~5
// rate 가 있으면 누르고 있는 동안 초당 rate 개
export const TOOLS = [
  { tier: 1, name: '맨손', per: 1, time: 0.9, r: 1.6, price: 0 },
  { tier: 2, name: '집게', per: 1, time: 0.5, r: 2.4, price: 100 },
  { tier: 3, name: '갈퀴', per: 3, time: 0.6, r: 3.2, price: 400 },
  { tier: 4, name: '큰 갈퀴', per: 5, time: 0.5, r: 4.0, price: 1200 },
  { tier: 5, name: '흡입기', per: 1, rate: 4, time: 0.25, r: 5.0, price: 4000 },
];
// 배낭: 처음엔 배낭 없이 호주머니(POCKET)만. save.equip.bag 0 = 호주머니, 1~5 = BAGS[bag-1] (#31)
export const POCKET = { tier: 0, name: '호주머니', cap: 6, price: 0 };
export const BAGS = [
  { tier: 1, name: '배낭', cap: 20, price: 80 },
  { tier: 2, name: '큰 배낭', cap: 40, price: 300 },
  { tier: 3, name: '등산 배낭', cap: 80, price: 1000 },
  { tier: 4, name: '대형 배낭', cap: 150, price: 3000 },
  { tier: 5, name: '원정 배낭', cap: 300, price: 7000 },
];
export const SHOES = [
  { tier: 1, name: '운동화', speed: 1.0, price: 0 },
  { tier: 2, name: '러닝화', speed: 1.1, price: 120 },
  { tier: 3, name: '트레일화', speed: 1.2, price: 450 },
  { tier: 4, name: '등산화', speed: 1.3, price: 1400 },
  { tier: 5, name: '바람 신발', speed: 1.45, price: 3600 },
];

// 클린하우스(재활용장): 들머리 한 곳. 귤은 TRASH_TYPES 의 gyul (캔·페트병·비닐 1, 스티로폼 3, 폐어구 5)
export const CLEANHOUSE = {
  r: 7, // 이 거리 안이면 상호작용 버튼이 '버리기'
  shopR: 3.2, // 옆 귤 가판대 앞 이 거리 안이면 '상점'
  dumpTime: 1.9, // 버리기 연출 전체 길이(초). 2초 안
  flyMax: 40, flyMaxLow: 20, // 날아가는 쓰레기 모양 최대 개수 (많으면 묶어서 보여 줌)
  binColors: ['#c9473d', '#3c7fc9', '#e8c13a', '#eeeee6', '#3f9a5a'], // 캔·페트병·비닐·스티로폼·폐어구 통
  arrowNear: 14, // 배낭이 찼을 때 이보다 멀면 방향 화살표
  stallMark: 0.055, // 가판대 위 귤 표시 크기(화면 높이 비율, 멀어도 같은 크기)
  shopHint: 8, // 버린 직후 살 수 있는 장비가 있으면 가판대 쪽 표시를 띄우는 시간(초)
};

// 쓰레기 도감 (#13): 종류마다 흔한 것 4개(20종) + 드문 것 2개(10종) = 30종. kind 는 TRASH_TYPES 의 id
export const DEX = {
  rareChance: 1 / 400, // 주울 때마다 이 확률로 그 종류의 드문 것
  rareGyul: 20, // 드문 것을 주우면 더 주는 귤
  common: {
    can: ['음료 캔', '맥주 캔', '참치 캔', '찌그러진 캔'],
    pet: ['생수 페트병', '탄산 페트병', '주스 페트병', '커피 페트병'],
    vinyl: ['비닐봉지', '과자 봉지', '컵라면 포장', '찢어진 비닐'],
    foam: ['스티로폼 조각', '컵라면 용기', '포장 완충재', '도시락 용기'],
    gear: ['낚싯줄 뭉치', '폐어망 조각', '낚시 추', '끊어진 밧줄'],
  },
  rare: [
    { kind: 'can', name: '녹슨 양철 도시락' }, { kind: 'can', name: '옛날 우유 깡통' },
    { kind: 'pet', name: '유리병 편지' }, { kind: 'pet', name: '옛날 소주병' },
    { kind: 'vinyl', name: '고무신 한 짝' }, { kind: 'vinyl', name: '오래된 라면 봉지' },
    { kind: 'foam', name: '아이스박스 조각' }, { kind: 'foam', name: '오래된 어시장 상자' },
    { kind: 'gear', name: '낡은 부표' }, { kind: 'gear', name: '찢어진 그물 뭉치' },
  ],
};

// 업적 수치 (#13)
export const ACH = {
  topPick: { goal: 20 }, // 정상 근처에서 줍기
  sunPick: { goal: 10 }, // 해돋이·해넘이 때 줍기
};

// 소원 돌탑: 한 사람당 돌 하나. 돌탑 하나에 최대 이만큼만 쌓임 (#28)
// 가득 차면 새 돌이 맨 위에 올라가고 가장 오래된 돌이 빠짐. 100개일 때 밑돌 포함 높이 약 6m(사람 키의 3~4배)
export const CAIRN = {
  max: 100, step: 0.042, // 돌 하나가 올리는 높이
  stoneSize: 0.55, // 돌 크기 배율 (100개가 겹쳐 쌓여도 보기 좋게 작게)
  bend: 2.5, bendH: 5, // 맨 위로 갈수록 휘는 정도(m)와 기준 높이
  farD: 90, // 이 거리보다 멀면 돌을 건너뛰어 단순하게 그림
};

// 사물 충돌 (#15)
export const COLLIDE = {
  cell: 8, // 격자 칸 크기(m)
  player: 0.45, // 캐릭터 반지름
  sub: 0.35, // 한 번에 이만큼씩만 나눠 움직여 빠르게 달려도 뚫지 않음
  stuckT: 0.5, // 탭 이동 중 이 시간 동안 못 나아가면 멈춤
  trashPad: 0.6, // 쓰레기는 충돌 범위에서 이만큼 더 떨어지게 둠
  pine: 0.42, oak: 0.3, rock: 0.9, // 나무·바위 충돌 반지름 = 크기 × 이 값
};

// 실제 날씨 연동 (#18)
export const WEATHER = {
  lat: 33.3, lon: 126.3, // 남송이오름(서귀포시 안덕면 서광리) 근처
  pollMin: 30, blendSec: 6, windKmh: 30, // 이 속도(km/h) 이상이면 강풍
  particles: 1400, particlesLow: 500, box: 40, rainFall: 26, snowFall: 3.2,
  cloudCount: 11, // namsongi 구름 덩어리 수
};

// 발자국 (#21): 걸음마다 왼발·오른발 자국. 달리기·질주는 간격이 넓고 조금 진함
export const FOOTPRINT = {
  max: 60, maxLow: 30, // 동시에 남는 최대 개수 (넘으면 오래된 것부터 지움)
  life: 8, // 사라지는 데 걸리는 초 (뒤쪽 절반 동안 서서히)
  stride: { walk: 1.1, run: 1.7, sprint: 2.1 }, // 걸음 간격 (countSteps 와 같게)
  side: 0.28, // 왼발·오른발이 중심에서 벌어진 정도
  alpha: { path: 0.55, grass: 0.16 }, // 탐방로·흙은 또렷하게, 풀밭은 흐리게
  boost: { walk: 1, run: 1.15, sprint: 1.3 }, // 달릴수록 조금 진하게
  size: [0.36, 0.62], // 발자국 가로·세로
};

// 멧돼지 (src/boar.js 모델)
export const BOAR = {
  scale: 2.0, // 모델 키 0.77 → 게임 키 약 1.54 (예전 상자 멧돼지와 비슷)
  hitR: 1.3, hitPad: 0.06, // 귤 맞는 판정: 수평 반경, 몸 높이 위 여유
  bodyR: 1.0, // 몸 충돌 반경 (플레이어 반경 COLLIDE.player 와 합쳐 겹치지 않게). 뛰어올라 몸 위(jumpClear)를 넘으면 통과
  jumpClear: 0.9,
  hitGap: 0.2, // 몸이 닿은 뒤 이만큼 안이면 받힘
  hitCd: 3, // 받힌 뒤 이 초 동안은 다시 안 받힘
  knockSpeed: 28, knockV: 11, // 튕겨 나가는 속도·떠오르는 속도 (예전 14·9, 거리 약 2배)
  rollT: 0.55, getUpT: 0.5, // 착지 뒤 구르는 시간·일어나는 시간 (이 동안 조작 못 함)
};
// 적 (#37): 쓰러뜨리지 않고 귤을 맞혀 쫓아냄. 전투 오름에서만. 새 종류는 여기에 한 줄 + src/enemies.js MODELS 에 모양
// hp 기운, walk·chase·flee 속도, dmg 받힐 때 플레이어 HP 피해(#36), reward 쫓아냈을 때 귤 개수·드문 쓰레기 확률
// sight 이 거리 안에 플레이어가 보이면 돌진, lose 이보다 멀어지면 그만둠, life 안 쫓아내면 스스로 떠나는 시간(초)
// rootEvery 땅 헤집는 간격(초), rootT 헤집는 시간, rootTrash 흘리는 쓰레기 수, size 판정·충돌 크기 배율
// 다음 후보: 들개, 아기 멧돼지, 쓰레기 투기 트럭, 외계인
export const ENEMIES = {
  boar: { name: '멧돼지', hp: 6, walk: 2.4, chase: 7.2, flee: 9, dmg: 25, reward: { gyul: 10, rare: 0.05 }, sight: 18, lose: 30, life: 180, rootEvery: [14, 28], rootT: 1.8, rootTrash: [2, 3], rootR: 14, size: 1 },
};
export const ENEMY_SPAWN = {
  every: 240, first: 240, // 4분마다 한 무리 (들어온 뒤 첫 무리도 4분 뒤)
  group: [2, 3], // 한 무리 마릿수
  r: [40, 70], // 플레이어에서 이 거리 사이 (오름 안)
  max: 4, // 동시에 최대
  kinds: ['boar'], // 나올 수 있는 종류
  warnT: 3, // 나타날 때 화면 가장자리 경고 표시 시간(초)
  goneD: 90, // 도망·떠나는 적이 이만큼 멀어지면 사라짐
};
// 무기 (#38): 전투 오름에서만. 상점 무기 탭에서 다음 단계만 삼. 저장은 save.equip.weapon = 1(손)~
// dmg 적에게 주는 피해, range 자동 조준 사거리(수평 m), speed 화살 속도(m/s), grav 화살에 걸리는 중력, perGyul 귤 하나로 쏘는 발 수
// soon: 아직 없는 단계 (상점에 잠긴 그림만)
export const WEAPONS = [
  { tier: 1, id: 'hand', name: '손', dmg: 1, range: 16, price: 0 },
  { tier: 2, id: 'bow', name: '귤 활', dmg: 2, range: 32, speed: 40, grav: 5, perGyul: 5, price: 300 },
  { tier: 3, id: 'gun', name: '귤 총', soon: true },
  { tier: 4, id: 'mg', name: '귤 머신건', soon: true },
  { tier: 5, id: 'laser', name: '귤즙 레이저', soon: true },
  { tier: 6, id: 'bomb', name: '귤 폭탄', soon: true },
];
// 귤 활 연출 (#38)
export const BOW = {
  release: 0.3, total: 0.62, // 당겨서 놓는 순간·동작 전체 (초)
  splash: 14, splashLow: 7, // 맞으면 튀는 즙 방울 수
  life: 1.6, // 화살이 아무것도 안 맞고 날아가는 최대 시간(초)
};
// 귤 피해 (#37): 손으로 던지기. 무기 표의 손과 같음
export const THROW_DMG = { hand: WEAPONS[0].dmg };

// 받혀서 흩어지는 귤 (#32)
export const SCATTER = {
  frac: 0.1, min: 3, max: 15, // 가진 귤의 비율·최소·최대 개수 (가진 것보다 많이는 안 흩어짐)
  rMin: 2, rMax: 7, // 흩어지는 반경
  air: 0.7, // 날아가는 시간(초)
  life: 30, // 떨어진 뒤 주울 수 있는 시간(초)
};

// 남송이 걸을 수 있는 범위·현무암 돌담 (#25)
export const BOUND = {
  rel: 4, // 오름 자락: 주변보다 이만큼(실제 m) 솟은 땅을 오름으로 봄
  gapStop: 70, // 바깥으로 훑다가 이만큼 연달아 낮으면 오름 끝
  margin: 30, // 오름 자락 바깥으로 남기는 여유
  approach: 24, // 들머리~오름 자락 탐방로 양옆 여유
  plaza: 30, // 시작 지점·클린하우스·가판대 둘레 여유
  smooth: 9, // 경계선을 부드럽게 (각도 샘플 수, 720개 중)
  trashRel: 5, // 쓰레기는 이만큼 솟은 땅(오름)에만
  trashWall: 10, // 돌담에서 이만큼 안쪽에만
  outTrees: 0.45, // 범위 밖 나무는 이 비율만 남김 (가까운 것만)
  outTreeFar: 900, // 돌담에서 이보다 먼 범위 밖 나무는 그리지 않음
};
export const WALL = {
  seg: 6, // 돌담 조각 하나가 맡는 경계선 길이 (#39 조각 모델: 길이가 높이의 약 3.4배)
  overlap: 0.5, // 조각 끝을 이만큼 더 늘여 이웃과 겹침 (굽은 곳 틈 막기)
  height: 2.0, width: 1.0, // 조각 크기 (땅에 bury 만큼 묻혀 보이는 높이는 허리 높이 약 1.75)
  bury: 0.25, // 조각 밑 땅 가장 낮은 곳보다 이만큼 묻음
  glow: 0.16, // 밤에 까맣게 뭉개지지 않게 텍스처 색에 비례한 자체 빛
  thick: 0.42, // 충돌 반두께
  lodR: 70, lodRLow: 50, // 이 안은 가까이용 조각(400 삼각형), 밖은 멀리용(48)
  nearR: 230, nearRLow: 150, // 이 안은 조각, 밖은 단순한 띠
  chunk: 8, // 조각 몇 개를 한 덩어리로 그릴지 (덩어리마다 거리로 가까이용·멀리용·끔)
  gateW: 3.2, // 정낭 입구 반폭
};

// 들머리 튜토리얼 (#31, #44): 시작 → 걷기 원 → 달리기 원 → 개울·돌다리 → 쓰레기 6개 → 클린하우스·가판대 → 정낭 → 오름
// 자리는 들머리 탐방로(approach)를 따라 시작에서 잰 거리(단위). maps.js 가 이 값으로 좌표를 만든다
export const TUT = {
  walkD: 16, runD: 40, // 걷기·달리기 원 자리
  ringR: 2.4, // 원에 이만큼 들어오면 도착
  streamD: 58, streamW: 6.6, // 개울 가운데 자리, 길 방향 반폭 (돌다리로 건넘)
  trashD: [70, 72.5, 75, 77.5, 80, 82.5], // 쓰레기 6개
  cleanD: 94, // 클린하우스(길 오른쪽 7.5)
  gateD: 112, // 안쪽 돌담·정낭
  firstBonus: 200, // 클린하우스에 처음 버릴 때 귤이 이만큼이 되도록 채워 줌 (집게 100 + 배낭 80)
  rescueT: 1.2, // 낚시 NPC 가 줄에 걸린 캐릭터를 끌어 올리는 시간(초)
  arrowFar: 22, // 목표가 이보다 멀거나 화면 밖이면 가장자리 화살표
};

// 들머리 개울 모양·물에 빠졌을 때 (#41). 좌표 lat = 개울 방향(하류 +), 시작 지점에서 오름을 볼 때 왼쪽 → 오른쪽으로 흐름
export const STREAM = {
  far: 300, // 가운데에서 양쪽으로 이만큼(돌담 밖 원경까지) 물길을 그림
  flatLat: 9, // 이 안(징검다리 둘레)은 곧고 넓게 (TUT.streamW)
  narrowW: 3.4, // 그 밖 물 반폭 (조금씩 달라짐)
  wallW: 2.4, // 돌담 수문 아래 물 반폭
  meanderIn: 3, meanderOut: 14, // 굽이 진폭: 돌담 안 / 돌담 밖 멀리
  bank: 1.1, // 물가 자갈 띠 폭
  flow: 3.6, // 물살 빠르기 (잔물결·나뭇잎·떠내려가는 캐릭터)
  leaves: 16, leavesLow: 8, // 떠가는 나뭇잎 수
  pebbles: 320, pebblesLow: 140, reeds: 70, reedsLow: 30, // 물가 자갈·풀 수 (징검다리 둘레 near 안)
  near: 70, // 자갈·풀·나뭇잎을 두는 범위(lat)
  sinkT: 0.35, // 첨벙 잠기는 시간
  driftMax: 1.8, // 떠내려가는 최대 시간 (멀면 물살보다 빨리)
  catchT: 0.35, // 줄에 걸려 낚시꾼이 놀라는 시간
  archOpen: 2.6, // 수문 구멍 하나 폭(대략)
};

// 들머리 개울의 돌다리 (#44): 난간 없는 넓적한 현무암 판 몇 장. 걷거나 달려서 건넘. 옆으로 벗어나면 물에 빠짐
export const BRIDGE = {
  halfW: 1.5, // 다리 반폭 (캐릭터 둘이 나란히 지날 정도)
  over: 1.4, // 물 가장자리 밖 둑까지 더 뻗는 길이
  slabs: 5, // 판 수
  top: 0.34, endTop: 0.16, // 가운데 판·양끝 판 윗면 높이(땅 위)
  thick: 0.5, // 판 두께 (물 밑으로 묻힘)
  gap: 0.07, // 판 사이 틈
};

// 낚시 (#44): 개울 물가(또는 돌다리 위)에서 상호작용(F). 튜토리얼과 상관없는 자유 기능
export const FISH = {
  bankR: 2.0, // 물 가장자리에서 이만큼 안이면 낚시 가능
  castIn: 1.5, // 찌가 떨어지는 곳: 물 가장자리에서 물 안쪽으로
  castD: 3.2, // 돌다리 위에서는 옆으로 이만큼
  castT: 0.75, // 던지기 동작 (찌가 날아가는 시간 포함)
  waitMin: 2, waitMax: 6, // 찌가 떠 있다가 쑥 들어가기까지(초)
  biteT: 1, // 이 안에 F 를 누르면 낚음
  pullT: 0.7, // 당겨 올리기
  showT: 1.4, // 물고기를 들어 보이는 시간
  releaseT: 0.55, // 놓아주기 (물로 날아감)
  stowT: 0.45, // 쓰레기가 배낭으로 들어감
  missT: 0.6, // 놓쳐서 줄을 거둠
  rodL: 2.2, // 낚싯대 길이
  // 낚이는 것 비율. 호주머니·배낭에 자리가 없으면 쓰레기(드문 것 포함)는 안 낚이고 물고기만
  odds: { trash: 0.6, fish: 0.35, rare: 0.05 },
  fishGyul: 5, // 물고기를 놓아주면 받는 귤
  // 떠내려온 쓰레기: kind 는 TRASH_TYPES id (호주머니·배낭에 들어가고 클린하우스에서 귤이 됨)
  trash: [{ id: 'boot', name: '장화', kind: 'vinyl' }, { id: 'tin', name: '깡통', kind: 'can' }, { id: 'bag', name: '비닐', kind: 'vinyl' }],
  // 물고기 3종 (도감 '개울' 칸, id 'fish:번호')
  species: [{ id: 'ayu', name: '은어' }, { id: 'carp', name: '붕어' }, { id: 'crab', name: '참게' }],
};

// 귤 던지기 자동 조준 (#34): 사거리 안 가장 가까운 대상(적·하르방)을 겨눔. 손으로 던지기는 무료
export const THROW_AIM = {
  range: 16, // 이 거리(수평) 안 대상을 겨눔
  power: 11, runBonus: 3, // 대상이 없을 때 보는 방향으로 던지는 힘 (달리면 더)
  k: 0.55, kMax: 1.4, // 위로 던지는 비율(수직/수평 속도). 높은 곳을 겨눌 땐 kMax 까지 올림
  vMin: 4, vMax: 24, // 겨눌 때 수평 속도 범위
  lead: 0.8, // 움직이는 대상은 날아가는 동안 갈 곳을 이만큼 미리 겨눔
  mark: 0.9, // 대상 발밑 표시 반지름(대상 크기 배율)
};

// HP·쓰러짐·들것 귀환 (#36). 전투 오름에서만
export const HP = {
  max: 100,
  regenDelay: 8, regen: 5, // 이 초 동안 안 맞으면 초당 regen 씩 회복
  waits: [5, 10, 20, 30], // 시작 지점 대기 시간: 처음, 연달아 쓰러질 때마다 다음 칸 (마지막이 최대)
  resetSec: 180, // 일어난 뒤 이만큼 안 쓰러지면 대기 시간이 처음 칸으로
  low: 30, // 이 아래면 막대가 빨갛게 깜빡임
  // 연출 (초·m)
  fallT: 0.9, // 뒤로 쓰러짐
  dim: 0.55, // 쓰러진 뒤 화면 어두움 정도
  comeFrom: 9, comeSpeed: 4.2, comeMax: 2.4, // 들것 든 두 사람이 이만큼 떨어진 곳(시작 지점 쪽)에서 걸어옴 (최대 시간)
  loadT: 0.7, // 들것에 싣기
  carryT: 2.4, carrySpeed: 2.6, // 싣고 가는 시간·속도 (끝날 때 화면이 다 어두워짐)
  blackT: 0.35, fadeInT: 0.9, waitDim: 0.18, // 검은 화면 유지·시작 지점에서 밝아지는 시간·대기 중 어두움
  riseT: 0.9, leaveT: 3, // 일어나는 시간, 들것 든 사람이 떠나는 시간
  poleY: 0.74, // 들고 갈 때 들것 높이
};
