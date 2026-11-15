// 게임 수치 모음 (notes/spec.md 표 그대로). 다른 파일은 여기 값만 읽는다

// 쓰레기 종류: 비율·부피·귤(클린하우스에서 받는 값)
export const TRASH_TYPES = [
  { id: 'can', name: '캔', ratio: 0.30, vol: 1, gyul: 1 },
  { id: 'pet', name: '페트병', ratio: 0.30, vol: 1, gyul: 1 },
  { id: 'vinyl', name: '비닐', ratio: 0.20, vol: 1, gyul: 1 },
  { id: 'foam', name: '스티로폼', ratio: 0.12, vol: 2, gyul: 3 },
  { id: 'gear', name: '폐어구', ratio: 0.08, vol: 3, gyul: 5 },
];

export const TRASH = {
  total: 27000, // 하루에 깔리는 쓰레기 (더미 포함)
  heaps: 60, heapN: 50, // 더미 60곳 × 50개
  nearTrail: 0.7, trailD: 25, // 70%는 탐방로에서 25 단위 안
  offMax: 420, // 나머지 30%는 탐방로에서 이만큼 안쪽의 걸을 수 있는 땅
  cell: 32, // 그리기·찾기용 칸 크기
  drawR: 110, drawRLow: 70, // 이 반경 안의 칸만 그림 (저사양은 더 가깝게)
  heapR: 1.8, // 더미 크기(반경). 도구 반경에 더해서 닿음
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
export const BAGS = [
  { tier: 1, name: '기본 배낭', cap: 20, price: 0 },
  { tier: 2, name: '작은 배낭', cap: 40, price: 80 },
  { tier: 3, name: '배낭', cap: 80, price: 300 },
  { tier: 4, name: '큰 배낭', cap: 150, price: 1000 },
  { tier: 5, name: '원정 배낭', cap: 300, price: 3000 },
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

// 소원 돌탑: 한 사람당 돌 하나, 최대 이만큼까지 그림
export const CAIRN = {
  max: 2000, step: 0.2, // 돌 하나가 올리는 높이
  bend: 40, bendH: 300, // 맨 위로 갈수록 휘는 정도(m)와 기준 높이
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
  seg: 4, // 돌담 한 마디 길이
  thick: 0.42, // 충돌 반두께
  nearR: 230, nearRLow: 150, // 이 안은 돌 하나하나, 밖은 단순한 띠
  chunk: 40, // 마디 몇 개를 한 덩어리로 그릴지
  gateW: 3.2, // 정낭 입구 반폭
};
