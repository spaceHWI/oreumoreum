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
// 깨끗해진 구역에 꽃과 어린 나무 (#46, src/bloom.js). 깨끗한 정도 c (0~1) 기준
// 풀 색: c ≤ dryTo 메마름, liveAt 부터 다시 살아남 (dryTo~liveAt 사이 서서히), 1 이면 lush 만큼 더 푸름
// 꽃: 70% 부터 피기 시작(early 비율의 꽃이 70~98% 사이에 하나씩), 나머지는 100% 에 한꺼번에(물결). 어린 나무는 100% 에 솟음
export const BLOOM = {
  dryTo: 0.4, liveAt: 0.7, lush: 0.35, dryRate: 0.35, // 풀 색 바뀌는 빠르기 (1초에)
  flowerFrom: 0.7, early: 0.55,
  per: 60, perLow: 110, // 꽃 무리 하나에 땅 넓이 (작을수록 빽빽)
  treePer: 1400, treePerLow: 3200, treeOff: [0.85, 0.97], // 어린 나무 하나에 땅 넓이 · 이 아래로 떨어지면 시듦 (나무마다 다름)
  heapRing: { s: 4, l: 7, xl: 11 }, // 치운 더미 자리에 바로 피는 꽃 무리 수
  drawR: 120, drawRLow: 70, treeDrawR: 180, treeDrawRLow: 110,
  grow: 0.9, treeGrow: 2.6, wither: 6, // 피는·자라는·시드는 시간 (초)
  wave: 26, waveMax: 7, // 100% 순간 더미 자리부터 퍼지는 빠르기 (1초에) · 가장 늦게 피는 시간
  butterflies: 7, butterfliesLow: 3, birds: 5, birdT: 22, deer: 2,
  // 구역별 꽃: 1 자락 유채 노랑, 2 남쪽 사면 메밀 흰색, 3 능선 억새 금빛, 4 굼부리 수국 파랑, 5 정상 철쭉 분홍
  zones: {
    1: { name: '유채', color: '#f4d23c', kind: 'flower', tree: 1 },
    2: { name: '메밀', color: '#f6f3ea', kind: 'flower', tree: 1 },
    3: { name: '억새', color: '#e2bf6a', kind: 'plume', tree: 0.4 },
    4: { name: '수국', color: '#7c9fe6', kind: 'ball', tree: 1 },
    5: { name: '철쭉', color: '#ee7fae', kind: 'flower', tree: 0.6 },
  },
};
// 쓰레기 투기꾼·투기 트럭 (#47, src/dumpers.js): 자정 리셋 대신 이들이 와서 더미를 다시 쌓음. 깨끗한 오름·전투 오름 둘 다
// 주기 = every ÷ players (최소 minEvery). players 는 접속 인원 (지금은 1, 멀티가 붙으면 서버 값)
// 한 명 기준 한 시간에 오름 전체 쓰레기 × hourFrac 만큼 쌓임 (3분마다 한 번 → 한 번에 평균 약 38개).
// 투기꾼은 작은 더미 하나(amt), 트럭 양은 이 평균이 맞게 자동 계산 (src/dumpers.js DUMP_AMT, 약 80)
// 구역 고르는 무게 = zoneBase + 그 구역 깨끗한 정도 (깨끗한 구역일수록 자주)
// 쫓아내기: 버리기 전에 귤을 hp 만큼 맞히면(손 1, 활 2) 도망가고 귤 reward 개를 떨어뜨림. 플레이어를 공격하지 않음
export const DUMP = {
  players: 1,
  every: 180, minEvery: 20,
  hourFrac: 0.25,
  truckP: 0.4, // 한 번 올 때 트럭일 확률
  zoneBase: 0.3,
  dumpT: 5, // 버리는 데 걸리는 시간(초)
  max: 4, // 동시에 오는 최대 수
  outside: 14, // 돌담 바깥 이만큼에서 나타남
  entryIn: 60, // 트럭은 돌담에서 이 거리 안 탐방로 점으로 길에 오름
  offRoad: 3, // 트럭: 돌담에서 탐방로까지 들판을 지나는 거리는 이만큼 곱해 셈 (클수록 길로만)
  maxTrip: 300, // 한 상태가 이보다 오래 걸리면 조용히 사라짐
  warnT: 3, // 나타날 때 화면 가장자리 방향 표시 시간(초)
  offlineMaxH: 8, // 접속하지 않은 시간은 한 명 기준 속도로 쌓고, 이 시간 이상이면 오름 전체가 가득
  offlineMin: 60, // 이보다 짧게 비운 건 세지 않음(초)
  walker: { name: '무단투기꾼', hp: 1, amt: 10, speed: 2.6, flee: 7, reward: 5, hitR: 1.1 },
  truck: { name: '투기 트럭', hp: 6, speed: 7, flee: 10, reward: 30, hitR: 2.4 },
};
export const TRASH = {
  cell: 32, // 튜토리얼 낱개 그리기 범위 칸
  drawR: 110, drawRLow: 70,
  heapDrawR: 420, heapDrawRLow: 260, // 더미를 그리는 거리
};

// 장비 5단계. 상점에서 다음 단계만 살 수 있고 사면 바로 착용 (#10). 저장은 save.equip.{tool,bag,shoes} = 1~5
// rate 는 상점에 보이는 초당 개수 (= per ÷ time)
// 값 (#49 → #53): tools/econ.js 로 맞춤. 칸 10개(도구·배낭·신발·무기 + 옷 6칸) 모두 5단계까지 — 효율적으로 4시간, 여유 25% 더 써도 5시간 안 (하루 1시간씩)
// 흡입기는 예전(한 번 1개, 초당 4)이면 큰 갈퀴(초당 10)보다 느려 한 번 3개(초당 12)로
export const TOOLS = [
  { tier: 1, name: '맨손', per: 1, time: 0.9, r: 1.6, price: 0 },
  { tier: 2, name: '집게', per: 1, time: 0.5, r: 2.4, price: 100 },
  { tier: 3, name: '갈퀴', per: 3, time: 0.6, r: 3.2, price: 300 },
  { tier: 4, name: '큰 갈퀴', per: 5, time: 0.5, r: 4.0, price: 700 },
  { tier: 5, name: '흡입기', per: 3, rate: 12, time: 0.25, r: 5.0, price: 1500 },
];
// 배낭: 처음엔 배낭 없이 호주머니(POCKET)만. save.equip.bag 0 = 호주머니, 1~5 = BAGS[bag-1] (#31)
export const POCKET = { tier: 0, name: '호주머니', cap: 6, price: 0 };
export const BAGS = [
  { tier: 1, name: '배낭', cap: 20, price: 80 },
  { tier: 2, name: '큰 배낭', cap: 40, price: 200 },
  { tier: 3, name: '등산 배낭', cap: 80, price: 450 },
  { tier: 4, name: '대형 배낭', cap: 150, price: 800 },
  { tier: 5, name: '원정 배낭', cap: 300, price: 1500 },
];
export const SHOES = [
  { tier: 1, name: '쓰레빠', speed: 1.0, price: 0 }, // #52 처음엔 쓰레빠
  { tier: 2, name: '러닝화', speed: 1.1, price: 150 },
  { tier: 3, name: '트레일화', speed: 1.2, price: 400 },
  { tier: 4, name: '등산화', speed: 1.3, price: 800 },
  { tier: 5, name: '바람 신발', speed: 1.45, price: 1500 },
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
// 적 (#37, 구역별 #48): 쓰러뜨리지 않고 귤을 맞혀 쫓아냄. 전투 오름에서만. 새 종류는 여기에 한 줄 + src/enemymodels.js 에 모양
// hp 기운, walk·chase·flee 속도, dmg 받힐 때 플레이어 HP 피해(#36), reward 쫓아냈을 때 귤 개수·드문 쓰레기 확률
// sight 이 거리 안에 플레이어가 보이면 돌진, lose 이보다 멀어지면 그만둠, life 안 쫓아내면 스스로 떠나는 시간(초)
// rootEvery 땅 헤집는 간격(초), rootT 헤집는 시간, rootTrash 흘리는 쓰레기 수(가까운 더미에 더함), size 판정·충돌 크기 배율
// ranged: 멀리서 쏘는 적. keep 이 거리를 지키며 every 초마다 광선, range 쏘는 거리, speed 광선 속도, r 맞는 반경
export const ENEMIES = {
  piglet: { name: '아기 멧돼지', hp: 3, walk: 1.8, chase: 4.6, flee: 7, dmg: 10, reward: { gyul: 5, rare: 0.03 }, sight: 14, lose: 24, life: 180, rootEvery: [16, 30], rootT: 1.6, rootTrash: [1, 2], rootR: 14, size: 0.62 },
  dog: { name: '들개', hp: 6, walk: 3.0, chase: 9.5, flee: 11, dmg: 15, reward: { gyul: 10, rare: 0.04 }, sight: 20, lose: 32, life: 180, rootEvery: [18, 32], rootT: 1.4, rootTrash: [1, 2], rootR: 14, size: 0.85 },
  boar: { name: '멧돼지', hp: 12, walk: 2.4, chase: 7.2, flee: 9, dmg: 25, reward: { gyul: 20, rare: 0.05 }, sight: 18, lose: 30, life: 180, rootEvery: [14, 28], rootT: 1.8, rootTrash: [2, 3], rootR: 14, size: 1 },
  rabid: { name: '광견병 걸린 들개', hp: 20, walk: 3.6, chase: 12, flee: 12, dmg: 30, reward: { gyul: 35, rare: 0.07 }, sight: 24, lose: 36, life: 200, rootEvery: [16, 30], rootT: 1.4, rootTrash: [2, 3], rootR: 14, size: 0.92 },
  alien: { name: '외계인', hp: 40, walk: 2.6, chase: 4.4, flee: 10, dmg: 35, reward: { gyul: 60, rare: 0.1 }, sight: 26, lose: 40, life: 220, rootEvery: [20, 34], rootT: 2.2, rootTrash: [2, 4], rootR: 16, size: 1.15, ranged: { keep: 14, range: 24, every: 2.6, speed: 15, r: 1.0 } },
};
export const ENEMY_SPAWN = {
  every: 120, first: 120, // 2분마다 한 무리 (들어온 뒤 첫 무리도 2분 뒤)
  group: [2, 3], // 한 무리 마릿수
  r: [26, 60], // 플레이어에서 이 거리 사이, 플레이어가 있는 구역 안 (없으면 가까운 곳 near)
  near: [12, 26],
  max: 4, // 동시에 최대
  byZone: { 1: 'piglet', 2: 'dog', 3: 'boar', 4: 'rabid', 5: 'alien' }, // 구역별 몹 (#48). 들머리(0)·다 핀 구역에는 안 나옴
  kinds: ['boar'], // 구역이 없는 맵에서 나올 수 있는 종류
  warnT: 3, // 나타날 때 화면 가장자리 경고 표시 시간(초)
  goneD: 90, // 도망·떠나는 적이 이만큼 멀어지면 사라짐
};
// 무기 (#38): 전투 오름에서만. 상점 무기 탭에서 다음 단계만 삼. 저장은 save.equip.weapon = 1(손)~
// dmg 적에게 주는 피해, range 자동 조준 사거리(수평 m), speed 화살 속도(m/s), grav 화살에 걸리는 중력, perGyul 귤 하나로 쏘는 발 수
// soon: 아직 없는 단계 (상점에 잠긴 그림만)
export const WEAPONS = [
  { tier: 1, id: 'hand', name: '손', dmg: 1, range: 16, price: 0 },
  { tier: 2, id: 'bow', name: '귤 활', dmg: 2, range: 32, speed: 40, grav: 5, perGyul: 5, price: 600 },
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
  odds: { trash: 0.64, fish: 0.35, rare: 0.01 },
  fishGyul: 1, // 물고기를 놓아주면 받는 귤 (#49: 5 면 시간당 약 1,800 으로 오름보다 벌이가 좋아 1)
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

// 레스토랑 스톤 (#50): 들머리 개울 건너 물가. 귤을 내고 식사하면 버프 (한 번에 하나, 새로 먹으면 바뀜)
// 귤 = 메뉴판 가격 × 10. buff: speed 이동 속도·bag 배낭 용량·dmg 귤 무기 피해·pick 줍는 속도(배)·regen HP 회복 속도(배). v 는 더하는 비율(regen 은 곱하는 배수)
// battle: 전투 오름에서만 살 수 있음 (깨끗한 오름에선 흐리게). sec: 버프 시간(없으면 buffSec)
export const STONE = {
  buffSec: 600,
  menu: [
    { id: 'pasta', ko: '시그니처 매콤 크림 파스타', en: 'Signature Spicy Cream Sauce Pasta', price: 190, buff: 'speed', v: 0.2, food: '#f2a65a' },
    { id: 'gnocchi', ko: '시그니처 새우 비스큐 뇨끼', en: 'Signature King Prawn Bisque Gnocchi', price: 200, buff: 'bag', v: 0.3, food: '#e0703c' },
    { id: 'steak', ko: '시그니처 포크 스테이크', en: 'Signature Pork Steak', price: 290, buff: 'dmg', v: 0.5, battle: true, food: '#7a4a2c' },
    { id: 'pizza', ko: '마르게리따', en: 'Pizza Margherita', price: 180, buff: 'pick', v: 0.25, food: '#e8b04a' },
    { id: 'salad', ko: '하우스 리코타 샐러드', en: 'House Ricotta Salad', price: 100, buff: 'regen', v: 2, battle: true, food: '#7fb65a' },
    { id: 'ade', ko: '플럼 에이드', en: 'Plum Ade', price: 50, buff: 'speed', v: 0.1, sec: 300, food: '#c2416b', drink: true },
  ],
  // 자리: 가게 거리(#57) 터 SHOPS 의 lot. 앞(테라스)이 골목 너머 개울·바다(서쪽)를 봄
  W: 9, D: 6, H: 3.2, T: 4, // 건물 폭·깊이·벽 높이, 테라스 깊이
  r: 7, // 테라스 가운데에서 이 거리 안이면 상호작용이 '식사'
  eatT: 4.5, // 먹는 연출 (건너뛸 수 있음)
  walkMax: 3, // 자리까지 걸어가다 이 초가 넘으면 바로 앉힘
};

// 가게 거리 (#57): 들머리 길(시작~정낭)에서 왼쪽(개울 상류 쪽)으로 갈라지는 짧은 골목. 클린하우스는 길 건너 오른쪽이라 가게들이 등짐
// 골목 좌표: s = 길 가운데에서 골목 안쪽으로 거리, t = 오름 쪽(+) / 시작 쪽(-). 골목 가운데 선은 t = 0
// 터 side: 1 = 골목 오름 쪽 줄(앞이 시작·개울 쪽), -1 = 시작 쪽 줄(앞이 오름 쪽), 0 = 골목 끝(앞이 길 쪽). w = 골목 따라 폭, d = 깊이
export const SHOP_ST = {
  d: 84, // 들머리 길에서 갈라지는 자리 (시작에서 길 따라 m. 클린하우스 TUT.cleanD 94 바로 앞, 길 건너편)
  half: 2.6, // 골목 반폭 (현무암 판석)
  gap: 0.6, // 골목 가장자리와 터 앞 사이
  end: 46, // 골목 끝 s
  lots: [
    { s: 11, side: 1, w: 10, d: 9 }, // 1 루이네미장원 (#58)
    { s: 11, side: -1, w: 10, d: 9 }, // 2 LEAP (#59)
    { s: 23, side: 1, w: 10, d: 9 }, // 3 빈 터
    { s: 23, side: -1, w: 10, d: 9 }, // 4 빈 터
    { s: 37, side: 1, w: 17, d: 11 }, // 5 스톤 (앞에 아무것도 없어 개울이 보임)
    { s: 51.1, side: 0, w: 10, d: 9 }, // 6 빈 터 (골목 끝)
  ],
  clearPad: 3, // 터·골목 둘레 이만큼 더 나무·바위를 비움
  bound: 12, // 바깥 돌담이 터 둘레 이만큼 바깥으로 돌아감
  keepPad: 22, // 거리 둘레 이만큼 몹이 나오지 않음 (쓰레기 더미는 오름에만이라 원래 없음)
  // 골목 가장자리 꾸밈 [s, 쪽(1 오름 쪽 / -1 시작 쪽)]: 터 앞을 막지 않는 틈에만
  lamps: [[3, 1], [30, -1], [44, -1]],
  benches: [[33.5, -1], [39.5, -1]],
  planters: [[4.5, -1], [17, 1], [17, -1], [28.2, -1]],
  markFar: 160, markNear: 16, // 화면 가장자리 가게 아이콘: 이 거리 사이, 가장 가까운 가게 하나만
};
// 가게 목록: 한 줄 = 가게 하나. lot = 위 SHOP_ST.lots 번호(1부터). act = 상호작용 이름, ic = 상호작용 아이콘, pop = 여는 팝업
// 건물 모양은 src/shops.js SHOP_BUILD[id], 가장자리 아이콘은 SHOP_ICON[id]. 줄이 없는 터는 빈 터('준비 중' 팻말)
export const SHOPS = [
  { id: 'stone', name: 'Stone', lot: 5, act: '식사', ic: 'eat', pop: 'stone' },
  { id: 'salon', name: '루이네 미장원', lot: 1, act: '머리', ic: 'cut', pop: 'salon' },
  { id: 'leap', name: 'LEAP', lot: 2, act: '옷', ic: 'wear', pop: 'leap' },
];

// 머리 (#51·#58): 처음엔 고른 기본 머리만, 나머지는 루이네 미장원에서 귤로 바꿈 (값은 임시)
// 머리 종류를 늘리려면 list 에 한 줄 (key = gear.js 의 hair 칸 장비, id = 업적 이벤트 haircut-<id>). 순서 = 미장원 카드 순서
export const HAIR = {
  start: { m: 'hat:short', f: 'hat:bob' }, // 기본 남성 짧은 머리 · 기본 여성 단발
  list: [
    { id: 'short', key: 'hat:short', name: '짧은 머리', price: 150 },
    { id: 'bob', key: 'hat:bob', name: '단발', price: 150 },
    { id: 'bun', key: 'hat:bun', name: '똥머리', price: 300 },
  ],
  capRefund: 150, // 예전 초록 모자(hat:cap)는 #52 에서 모자 칸 기본 모자로 바뀌어 귤로 돌려줌
  spin: 0.7, // 고르기 화면에서 카메라가 도는 빠르기 (rad/s)
};
HAIR.price = Object.fromEntries(HAIR.list.map((h) => [h.key, h.price]));
HAIR.byKey = Object.fromEntries(HAIR.list.map((h) => [h.key, h]));

// 루이네 미장원 (#58): 가게 거리 1번 터. 건물 폭·깊이·벽 높이, 터 앞에서 건물 앞벽까지(드럼통 자리)
export const SALON = {
  W: 7, D: 5.6, H: 3.6, fore: 1.8,
  r: 6, // 문 앞에서 이 거리 안이면 상호작용이 '머리'
  walkMax: 4, // 문 앞까지 걸어가다 이 초가 넘으면 바로 앉힘
  cutT: 3, // 가위질 연출 (건너뛸 수 있음)
  snipHz: 3.2, // 초당 가위질
};

// LEAP (#59): 가게 거리 2번 터의 러닝 편집숍. 옷(WEAR·CLOTHES)과 신발(SHOES)을 귤로 삼. 가판대에는 도구·배낭·무기만
export const LEAP = {
  W: 8, D: 6, H: 3.8, fore: 1.6, // 건물 폭·깊이·높이, 터 앞에서 건물 앞벽까지
  r: 6, // 문 앞에서 이 거리 안이면 상호작용이 '옷'
  slots: ['shoes', 'hat', 'top', 'bottom', 'vest', 'jacket', 'socks'], // 팝업 칸 순서 (신발이 맨 앞)
};

// 옷 (#52): 입는 것마다 능력치. 겉모습과 능력치가 묶여 있음 (입은 것이 곧 능력). 도구·배낭·신발·무기는 위 표 그대로
// 칸마다 0(없음)~5단계. 같은 단계 옷은 능력이 같고 모양만 다름. 가진 옷은 언제든 갈아입고, 능력은 지금 입은 것만
// stat: rare 드문 쓰레기 확률 배수 · hp 최대 HP 배수 · pocket 주머니(배낭 용량에 더함) · gyul 클린하우스 귤 더하는 비율 · guard 받는 피해 줄이는 비율 · regen HP 회복 배수
// v: [없음(0단계), 1~5단계]. none: 처음엔 없음(베스트·잠바·양말). 저장은 save.clothes = { own: {id: 1}, wear: {칸: id} }
export const WEAR = {
  slots: [
    { k: 'hat', name: '모자', stat: 'rare', v: [1, 1, 1.5, 2, 2.5, 3] },
    { k: 'top', name: '티셔츠', stat: 'hp', v: [1, 1, 1.25, 1.5, 1.75, 2] },
    { k: 'bottom', name: '바지', stat: 'pocket', v: [0, 0, 5, 10, 20, 40] },
    { k: 'vest', name: '베스트', stat: 'gyul', none: true, v: [0, 0.04, 0.08, 0.12, 0.16, 0.2] },
    { k: 'jacket', name: '잠바', stat: 'guard', none: true, v: [0, 0.08, 0.16, 0.24, 0.32, 0.4] },
    { k: 'socks', name: '양말', stat: 'regen', none: true, v: [1, 1.2, 1.4, 1.6, 1.8, 2] },
  ],
  price: [0, 0, 50, 150, 300, 650], // 단계별 값 (#53 tools/econ.js 로 맞춤, 6칸 같은 값). 모자·티셔츠·바지 1단계는 처음부터 가짐
  priceNone1: 40, // 없음에서 시작하는 칸(베스트·잠바·양말)의 1단계
  tierColor: ['#7b7b80', '#9a9a94', '#5aa55a', '#4a86c8', '#9a6ad0', '#f29a2e'], // 단계 색: 없음·회색·초록·파랑·보라·귤색
};
// 옷 목록: 한 줄이 옷 한 벌. 단계마다 옷을 늘리려면 여기에 줄만 더하면 됨 (같은 단계 = 같은 능력, 모양은 look)
// look 은 src/clothes.js 가 읽는 모양 값: kind 모양 종류, main 바탕색, acc 포인트색, 그 밖은 종류마다 (stripe 줄무늬색 등)
export const CLOTHES = [
  // 모자: 머리 위에 같이 씀
  { id: 'hat:w-cap', slot: 'hat', tier: 1, name: '기본 모자', look: { kind: 'cap', main: '#5c9a3c', acc: '#4a8030' } },
  { id: 'hat:w-straw', slot: 'hat', tier: 2, name: '밀짚모자', look: { kind: 'straw', main: '#e3c77d', acc: '#b5482f' } },
  { id: 'hat:w-bucket', slot: 'hat', tier: 3, name: '버킷햇', look: { kind: 'bucket', main: '#3f78c0', acc: '#f2efe6' } },
  { id: 'hat:w-hike', slot: 'hat', tier: 4, name: '챙 넓은 등산 모자', look: { kind: 'boonie', main: '#6f7f4a', acc: '#9a6ad0', cord: '#2b2b33' } },
  { id: 'hat:w-gyul', slot: 'hat', tier: 5, name: '귤꽃 모자', look: { kind: 'flower', main: '#f6efe0', acc: '#f29a2e', leaf: '#3f9a5a', petal: '#ffffff' } },
  // 티셔츠
  { id: 'top:w-tee', slot: 'top', tier: 1, name: '기본 반팔', look: { kind: 'tee', main: '#e8dfc8', acc: '#d6ccb2' } },
  { id: 'top:w-stripe', slot: 'top', tier: 2, name: '줄무늬 반팔', look: { kind: 'tee', main: '#f4f1ea', acc: '#3f78c0', stripes: 4 } },
  { id: 'top:w-long', slot: 'top', tier: 3, name: '긴팔 티', look: { kind: 'tee', long: true, main: '#3f9a6a', acc: '#2c7550' } },
  { id: 'top:w-tech', slot: 'top', tier: 4, name: '기능성 등산 티', look: { kind: 'tee', long: true, main: '#3d4a78', acc: '#7fd3c8', panel: true } },
  { id: 'top:w-jersey', slot: 'top', tier: 5, name: '귤색 저지', look: { kind: 'tee', main: '#f29a2e', acc: '#ffffff', stripes: 2, collar: '#3f9a5a', panel: true } },
  // 바지
  { id: 'bottom:w-shorts', slot: 'bottom', tier: 1, name: '기본 반바지', look: { kind: 'shorts', main: '#8a6a3c', acc: '#74592f' } },
  { id: 'bottom:w-cargo', slot: 'bottom', tier: 2, name: '카고 반바지', look: { kind: 'shorts', main: '#7a7a52', acc: '#5e5e3c', pockets: true } },
  { id: 'bottom:w-long', slot: 'bottom', tier: 3, name: '긴바지', look: { kind: 'long', main: '#4a5a78', acc: '#3a4762' } },
  { id: 'bottom:w-hike', slot: 'bottom', tier: 4, name: '등산 바지', look: { kind: 'long', main: '#4b4f57', acc: '#9a6ad0', knee: true, pockets: true } },
  { id: 'bottom:w-gal', slot: 'bottom', tier: 5, name: '갈옷 바지', look: { kind: 'long', main: '#a5562c', acc: '#f29a2e', belt: true, knee: true } },
  // 베스트: 티셔츠·잠바 위에 앞이 트인 조끼
  { id: 'vest:w-old', slot: 'vest', tier: 1, name: '낡은 조끼', look: { kind: 'vest', main: '#8f8a7a', acc: '#76715f' } },
  { id: 'vest:w-clean', slot: 'vest', tier: 2, name: '환경미화 조끼', look: { kind: 'vest', main: '#c4e04a', acc: '#e8ecef', bands: true } },
  { id: 'vest:w-fish', slot: 'vest', tier: 3, name: '낚시 조끼', look: { kind: 'vest', main: '#a99a6a', acc: '#7d7048', pockets: 3 } },
  { id: 'vest:w-hike', slot: 'vest', tier: 4, name: '등산 조끼', look: { kind: 'vest', main: '#2f5fa8', acc: '#f29a2e', puff: true, pockets: 1 } },
  { id: 'vest:w-gyul', slot: 'vest', tier: 5, name: '귤 농장 조끼', look: { kind: 'vest', main: '#f29a2e', acc: '#3f9a5a', pockets: 2, bands: true, leaf: true } },
  // 잠바: 티셔츠 위, 긴소매
  { id: 'jacket:w-wind', slot: 'jacket', tier: 1, name: '얇은 바람막이', look: { kind: 'jacket', main: '#9fb4c4', acc: '#7f95a6' } },
  { id: 'jacket:w-hood', slot: 'jacket', tier: 2, name: '후드 집업', look: { kind: 'jacket', main: '#8e9096', acc: '#6c6e74', hood: true } },
  { id: 'jacket:w-fleece', slot: 'jacket', tier: 3, name: '플리스', look: { kind: 'jacket', main: '#efe6d2', acc: '#4a86c8', puff: true } },
  { id: 'jacket:w-rain', slot: 'jacket', tier: 4, name: '방수 자켓', look: { kind: 'jacket', main: '#3a6fc0', acc: '#f2c94c', hood: true, cuffs: true } },
  { id: 'jacket:w-gyul', slot: 'jacket', tier: 5, name: '귤색 원정 자켓', look: { kind: 'jacket', main: '#f29a2e', acc: '#2b2f3a', hood: true, cuffs: true, puff: true, bands: true } },
  // 양말
  { id: 'socks:w-white', slot: 'socks', tier: 1, name: '흰 양말', look: { kind: 'socks', main: '#f4f2ec', acc: '#dcd8cc', h: 0.11 } },
  { id: 'socks:w-stripe', slot: 'socks', tier: 2, name: '줄무늬 양말', look: { kind: 'socks', main: '#f4f2ec', acc: '#3f9a5a', h: 0.13, stripes: 2 } },
  { id: 'socks:w-hike', slot: 'socks', tier: 3, name: '등산 양말', look: { kind: 'socks', main: '#8b8d92', acc: '#c9473d', h: 0.14, thick: true } },
  { id: 'socks:w-knee', slot: 'socks', tier: 4, name: '무릎 양말', look: { kind: 'socks', main: '#2f3f6a', acc: '#9a6ad0', h: 0.19 } },
  { id: 'socks:w-gyul', slot: 'socks', tier: 5, name: '귤 무늬 양말', look: { kind: 'socks', main: '#f29a2e', acc: '#3f9a5a', h: 0.17, dots: '#fff4e0' } },
];
export const WEAR_START = { hat: 'hat:w-cap', top: 'top:w-tee', bottom: 'bottom:w-shorts' }; // 처음 차림 (신발 1단계 쓰레빠는 SHOES)
export const wearPrice = (c) => c.tier === 1 && WEAR.slots.find((s) => s.k === c.slot)?.none ? WEAR.priceNone1 : WEAR.price[c.tier];
