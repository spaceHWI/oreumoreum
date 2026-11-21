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
    mt: { n: 500, r: 5.2, h: 5.6, name: '쓰레기 산', gv: 1.5 }, // #138 들판 쓰레기 산: 귤 값 × gv (구역 gv 에 곱함)
  },
  stages: [1, 0.66, 0.33, 0.12], // 4단계
  colPad: 0.15, // 충돌 반경 = 지금 모양 반경 × 0.85 + 이만큼
  gap: 7, // 더미 가장자리끼리 최소 거리
  trailMin: 3.2, trailMax: 14, // 길 옆 더미: 길 가운데에서 가장자리까지 거리 범위 (길을 막지 않게)
  nearFrac: 0.6, // 구역 더미 중 길 옆 비율 (나머지는 구역 안 빈터)
  freeMax: 60, // 빈터 더미는 길에서 이만큼 안
  seed: 45,
  // #160 들머리 더미: 구역 1 길가 더미 앞쪽 몇 개를 정낭 밖 들머리 길가(돌담 안 평지)에 둠. 더미 수·HEAP_SIG 는 그대로(자리만 바뀜)
  // bands [가까운 m, 먼 m, 개수]: 들머리 클린하우스 가운데에서 거리. off 들머리 길 가운데에서 더미 가장자리까지 m. from 정낭(TUT.gateD)에서 오름 쪽으로 이만큼 지나서부터
  // gap 더미 가장자리끼리 최소 m. view 가까운 띠 더미는 정낭에서 보이게(사이에 나무·돌 충돌이 없게)
  entry: { bands: [[15, 40, 3], [40, 80, 3]], off: [3, 8], from: 6, gap: 7, view: true, seed: 160 },
};
// 들판 더미 (#138, notes/growth-loop.md 6절): 구역마다 길에서 FIELD.heapD m 떨어진 곳에 큰 더미·쓰레기 산. 길가 더미 뒤에 붙는 순서(저장 heaps 뒤쪽)
// 자리는 FIELD.seed 고정 난수, 8자 고리의 '왼쪽 들판'(src/fieldplan.js). 바꾸면 HEAP_SIG 가 바뀌어 서버 더미가 새로 가득 참
export const FIELD_HEAPS = { 1: { mt: 1 }, 2: { mt: 1 }, 3: { l: 2, mt: 1 }, 4: { xl: 1, mt: 1 }, 5: { xl: 1, mt: 1 } };
// 구역 (#45): src/zones.js zoneAt 이 위치로 번호를 구함. heaps 더미 크기별 수, min 목표 시간(권장 장비로 혼자, 클린하우스 왕복 포함)
// rec 권장 장비 점수 (#137, GROWTH.score 로 셈. 칸 10개가 모두 n단계면 구역 n 쯤). gear 권장 장비 단계(도구·배낭·신발, 시간 계산용)
// gv 이 구역 쓰레기 귤 배수 (#137: 구역마다 벌이가 약 2.5배. 클린하우스에서 받는 귤 = TRASH_TYPES gyul × gv)
//   #138 들판 더미·쓰레기 산이 더해져 하루 1시간을 다 쓰게 되어 1·1·2·8·14 로 낮춤 (전 4·4.5·8·18·30, tools/econ.js 흐름 통과)
// mix 나오는 쓰레기 종류 비율(TRASH_TYPES 순서: 캔·페트병·비닐·스티로폼·폐어구)
// maxD 더미를 클린하우스에서 이 거리(직선) 안에만 둠, amt 이 구역만 더미 하나의 쓰레기 수를 바꿈
// chMax (#138) 길가 더미를 가장 가까운 클린하우스(들머리·오름 안)에서 이 거리 안에 둠: 권장 배낭이 반쯤 찰 때 클린하우스가 80m 안 (growth-loop 7-1절, tools/field.js)
// 시간 어림은 __oreum.trash.estimate() (클린하우스 왕복 = 직선 거리 × 1.15, 달리기 10 × 신발)
// 조정: 1구역은 캔·페트병·비닐만(부피 1) + 클린하우스 215 안, 5구역 대형 더미는 200 → 140개 (그대로면 약 29분)
export const ZONES = [
  { id: 1, name: '오름 자락 숲길', heaps: { s: 12 }, min: 5, rec: 10, gv: 1, gear: { tool: 2, bag: 1, shoes: 1 }, mix: [0.36, 0.36, 0.28, 0, 0], maxD: 215 },
  { id: 2, name: '남쪽 사면', heaps: { s: 10, l: 4 }, min: 8, rec: 25, gv: 1, gear: { tool: 3, bag: 3, shoes: 2 }, mix: [0.3, 0.3, 0.2, 0.13, 0.07], chMax: 90 },
  { id: 3, name: '능선', heaps: { l: 10 }, min: 12, rec: 60, gv: 2, gear: { tool: 3, bag: 5, shoes: 3 }, mix: [0.26, 0.26, 0.2, 0.17, 0.11], chMax: 80 },
  { id: 4, name: '굼부리', heaps: { l: 8, xl: 3 }, min: 15, rec: 140, gv: 8, gear: { tool: 4, bag: 5, shoes: 5 }, mix: [0.22, 0.22, 0.18, 0.22, 0.16], chMax: 90 },
  { id: 5, name: '정상', heaps: { xl: 8 }, min: 20, rec: 320, gv: 14, gear: { tool: 5, bag: 5, shoes: 5 }, mix: [0.2, 0.2, 0.16, 0.24, 0.2], amt: { xl: 140 }, chMax: 80 },
];
// 성장 수치 (#137, notes/growth-loop.md 3절): 장비 점수. src/gearscore.js 가 읽음
// score[단계] = 칸 하나 점수 (0 = 없음·호주머니). 칸 10개(도구·배낭·신발·무기 + 옷 6칸)의 합이 장비 점수
// grade 등급(보통·좋은·귀한·전설) 더하는 비율, enh 강화 한 번에 더하는 비율 (등급·강화는 다음 이슈에서 채움. 지금은 모두 0)
// pick·fight: 줍는 힘·싸우는 힘에 드는 칸. red·green: 내 점수 ÷ 구역 권장 점수가 red 아래면 빨강, green 이상이면 초록, 사이는 노랑
export const GROWTH = {
  score: [0, 1, 3, 6, 14, 32, 75],
  grade: [0, 0.15, 0.35, 0.7], enh: 0.12, enhMax: 5,
  pick: ['tool', 'bag', 'shoes', 'hat', 'bottom', 'vest'],
  fight: ['weapon', 'top', 'jacket', 'socks'],
  red: 0.85, green: 1.2,
  // 단계별 값 (도구·배낭·신발·무기 같은 곡선, 단계마다 약 4배). 1단계는 배낭(호주머니 → 배낭)만 값이 있음
  price: [0, 50, 200, 800, 3200, 13000, 30000],
  wearK: 1, // 옷 6칸 값 = price × wearK (같은 곡선)
};
// 구역 경계 모양 (src/zones.js)
export const ZONE_SHAPE = {
  summitR: 60, // 가장 높은 곳에서 이 안은 정상
  rimW: 30, // 말굽 능선 길에서 이 안은 능선
  craterPad: -8, // 북쪽 원형 굼부리 둘레 길에서 이만큼 (- 안쪽)
  slopeRel: 28, southZ: -90, // 솟은 높이(m) 이 위이고 정상보다 남쪽(z 가 정상 z + southZ 보다 큼)이면 남쪽 사면
};
// 구역 구분 (#136, src/zonelook.js·src/game/area.js): 초보(1~2)·중수(3)·고수(4~5)
// tier[구역] 묶음 번호(0 들머리). tiers[묶음] 이름·지도 색. 문턱은 탐방로가 묶음 경계를 넘는 곳(같은 묶음끼리 merge m 안이면 하나)
// 초보→중수: 정낭(열린 채) + 양옆 낮은 돌담 wallLen m. 중수→고수: 큰 바위 문 + 방사탑. 안내판은 문턱 옆 signOff m
// mood[구역] = [밝음, 억새빛, 어두움·붉은 흙] 땅·풀 색 (다 핀 구역은 어두움이 걷힘). fog[구역] 안개 가까이·멀리 배율 (다 피면 1)
// wind·reed·music[구역]: 바람·억새 소리·평소 음악 크기 배율, lp 평소 음악 밝기(패드 필터) 배율
// banner: 구역 이름이 뜨는 시간·다시 뜨기까지 쉬는 시간·방금 나온 구역으로 돌아갈 땐 이 초 동안 안 띄움
// decor: 구역 소품. per = 한 개에 땅 넓이(m², 작을수록 빽빽), drawR 이 거리 안만 그림(한 번에 하나로 그림), heap = 더미마다 둘레에 더하는 수
export const ZONE_LOOK = {
  tier: [0, 1, 1, 2, 3, 3],
  tiers: [null, { name: '초보', color: '#8fd16a' }, { name: '중수', color: '#f2b544' }, { name: '고수', color: '#b07ce0' }],
  merge: 25, wallLen: 7, signOff: 2.4, towerOff: 5.2,
  mood: [[0, 0, 0], [1, 0, 0], [0.75, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, 0.85]],
  fog: [[1, 1], [1, 1], [1, 1], [1, 1], [0.35, 0.06], [0.5, 0.12]],
  wind: [1, 0.85, 0.9, 1.35, 1.15, 1.3], reed: [1, 0.7, 0.8, 2.2, 1, 1.2],
  music: [1, 1, 1, 0.92, 0.82, 0.85], lp: [1, 1.1, 1.05, 0.9, 0.7, 0.75],
  banner: { sec: 2.8, cool: 4, back: 20 },
  decor: {
    drawR: 95, drawRLow: 60, moveStep: 6, crowFlee: 7,
    flower: { tier: 1, per: 110, perLow: 220 }, // 들꽃 무리 (초보)
    reed: { tier: 2, per: 55, perLow: 110, heap: 6 }, // 억새 포기 (중수, 더미 둘레에도)
    cairn: { tier: 2, per: 900, perLow: 1600 }, // 돌무더기 (중수)
    log: { tier: 3, per: 1100, perLow: 2000 }, // 쓰러진 나무 (고수)
    scorch: { tier: 3, per: 1300, perLow: 2400, heap: 1 }, // 그을린 자국: 외계인 흔적 (고수, 다 피면 사라짐)
    crow: { tier: 3, per: 2600, perLow: 5000, heap: 2 }, // 까마귀 (고수, 다 피면 날아감)
  },
  butterflies: [0, 3, 2, 0, 0, 0], // 다 피지 않아도 구역에 늘 있는 나비 수 (초보)
};
// 맵 전체 쓰기 (#138, notes/growth-loop.md 6절·7-1절): 길가는 쉬운 곳, 길 밖은 값진 곳. 자리는 src/fieldplan.js, 모양 src/field.js, 게임 연결 src/game/field.js
// 구역 안 8자 고리: 길로 들어와 길가 더미 → 왼쪽 들판(들판 더미·쓰레기 산·소굴) → 구역 클린하우스 → 오른쪽 들판(보물·볼거리) → 우두머리 빈터 → 문턱
//   '왼쪽·오른쪽'은 길을 오르막 쪽으로 걸을 때. 구역 클린하우스보다 낮은 길(아래 반)의 왼쪽, 높은 길(위 반)의 오른쪽
// seed 고정 난수. heapD 들판 더미·쓰레기 산 길에서 거리(m), spotD 소굴·보물·볼거리 길에서 거리, gap 서로 가장자리 최소 거리
// den 적 소굴: n[구역] 수, near 이 거리 안에 오면 그 구역 적이 나옴, group 마릿수, gyul[구역] 다 쫓아내면 귤 묶음, reopen 다시 열리는 초, leave 이만큼 멀어지면 소굴 적이 돌아감(닫히지 않음)
// treasure 숨은 보물: n[구역] 수, 하루(한국 시간) 한 번씩. gyul[구역] 귤, rare 드문 쓰레기(도감) 확률, r 열 수 있는 거리
// sight 볼거리: list = [구역, 종류, 이름]. 종류 view 전망 바위·spring 샘·sandam 산담(무덤 돌담)·tower 방사탑. r 이 안에 오면 찾음(도감 + gyul[구역])
// boss 우두머리 빈터(#139 가 씀): 구역마다 위쪽 길에서 d m, 반경 r 이 비고 평평한 곳
// off 길 밖(오름 위 풀밭) 걷기 빠르기 배율[신발 단계]. 탈것은 RIDES.off (길에서만 빠름)
// mark 멀리서 보이는 표시: 들판 더미·쓰레기 산 위 까마귀 crows 마리·연기, drawR 이 거리 안만. mini 미니맵 반경(m)·크기(px 폰·데스크톱)
// fog 가 본 곳: 지도 격자 n×n, 플레이어 둘레 r m 가 밝아짐
export const FIELD = {
  seed: 138,
  heapD: [18, 70], spotD: [16, 75], gap: 9,
  den: { n: [0, 2, 2, 3, 3, 2], near: 16, group: [3, 4], gyul: [0, 5, 15, 300, 800, 2200], reopen: 1800, leave: 55, r: 4.2 },
  treasure: { n: [0, 3, 4, 4, 5, 5], gyul: [0, 15, 25, 400, 1000, 2600], rare: 0.35, r: 2.6 },
  sight: {
    r: 7, gyul: [0, 30, 60, 150, 400, 900],
    list: [[1, 'spring', '숲속 샘'], [1, 'sandam', '자락 산담'], [2, 'sandam', '남쪽 산담'], [2, 'view', '남쪽 전망 바위'], [3, 'tower', '능선 방사탑'], [3, 'view', '능선 전망 바위'], [4, 'spring', '굼부리 샘'], [4, 'tower', '굼부리 방사탑'], [5, 'view', '정상 전망 바위']],
  },
  boss: { d: [22, 55], r: 13 },
  off: [0.8, 0.84, 0.88, 0.92, 0.96],
  mark: { crows: 3, drawR: 300, drawRLow: 200 },
  mini: { r: 110, px: [104, 148] },
  fog: { n: 128, r: 42 },
  chD: 80, // 권장 배낭으로 길가 더미를 반쯤 치우면 가득 차는 곳에서 구역 클린하우스까지 (7-1절, tools/field.js 가 잼)
};
// 들판 떼 (#173, src/game/swarm.js, notes/growth-loop.md '들판 떼' 절): 길에서 offD m 넘게 벗어나면 그 구역 떼가 몰려옴(뱀서류). 모두 임의값
// offD 들판으로 치는 길에서 거리(m), backD 이보다 가까우면 길로 돌아온 것, backT 길로 돌아온 뒤 떼가 흩어지기까지(초), firstT 들판에 들어선 뒤 첫 적이 보이기까지
// ring 플레이어 둘레 이 거리(화면 밖 쪽)에서 나옴, gap 한 마리씩 나오는 간격(초), stages 들판에 머문 시간 t초부터 동시에 n마리, elite [간격초, 마리]
// leaderT 이 초에 떼 대장 1마리, after 대장을 쫓아내면 이 시각(초)으로 되돌아감. cap 동시에 화면에 있는 떼 적 상한(PC·폰·저사양, 성능)
// mob 떼 적 = 그 구역 보통 적 × (기운·피해·귤 보상(구역별)·크기), life 스스로 떠나기까지. elite 정예 = 보통 적 크기에 기운 × hp. leader 떼 대장 = 크기 × k, 기운 × hp, chest 쫓아내면 보물 상자 귤(구역별)
// kinds 구역별 떼 (여러 개면 [종류, 비율]), straight 곧게 달려드는 구역(무리 자리 나누기 없이), shard 쫓아낸 한 마리가 떨구는 귤 조각 수, shardN 조각 이만큼이 귤 1
// magnet 조각이 빨려 오는 거리(m), shardLife 조각이 땅에 남는 초, augAt 조각을 이만큼 모을 때마다 증강 고르기(그 뒤는 augStep 씩 늘림)
// auto 들판 자동 던지기 간격(초, 무기마다. 무기 원래 간격), shotV 탄 속도, mgN·laserN 연사 무기 한 발 몫, quiet 더미를 다 치우면 그 자리 r m 가 t 초 동안 조용
// den 소굴 r m 안이면 떼 × more, 그 소굴이 닫혔으면 × closed. slowNew 장비 점수가 구역 권장보다 낮으면 물결 시간이 이 배로 느리게 흐름. lowHp 기운이 이 비율 아래면 떼 전체가 머뭇거림(#148)
// sack 구역 4 '썩은 귤 자루': 쫓아낸 광견병 들개가 p 확률로 떨굼 → fuse 초 뒤 터져 r m 안 플레이어를 t 초 동안 slow 배로 느리게
// pickSlow 증강 고르는 창이 떠 있는 동안 화면 빠르기(혼자), multiIframe 멀티에서는 느려지지 않고 이 초 동안 무적
// econ tools/econ.js: 들판 10분 귤이 길가 10분의 max 배를 넘지 않게, 하루 놀이 중 share 만큼 들판에 있다고 셈
export const SWARM = {
  offD: 12, backD: 9, backT: 6, firstT: 1.2,
  ring: [18, 26], gap: 0.25,
  stages: [{ t: 0, n: 4 }, { t: 30, n: 8 }, { t: 90, n: 14, elite: [30, 1] }, { t: 180, n: 20, elite: [60, 2] }],
  leaderT: 300, after: 180,
  cap: { pc: 24, phone: 16, low: 10 },
  mob: { hp: 0.3, dmg: 0.4, gyul: [0, 0.08, 0.22, 0.32, 0.4, 0.15], size: 0.7, life: 80 }, // gyul 구역별: 25% 로 두면 구역 1·2 는 길가의 2.5배라 1~3 은 길가와 비슷하게, 4·5 는 서버 ③(NET.swarmPerSec) 안으로 (tools/econ.js, 소수 몫은 확률로 1)
  elite: { hp: 2 },
  leader: { k: 1.5, hp: 5, chest: [0, 15, 45, 450, 1200, 3300] },
  kinds: { 1: [['piglet', 1]], 2: [['dog', 1]], 3: [['boar', 0.65], ['crow', 0.35]], 4: [['rabid', 1]], 5: [['drone', 1]] },
  straight: [1],
  shard: [0, 1, 1, 2, 2, 3], shardN: 3, magnet: 3.5, shardLife: 40,
  augAt: [10, 25, 45, 70, 100], augStep: 35,
  auto: { hand: 0.8, bow: 0.62, gun: 0.7, mg: 1 / 6, laser: 0.2, bomb: 2 }, shotV: 26, mgN: 30, laserN: 5,
  quiet: { r: 25, t: 30 },
  den: { r: 30, more: 1.3, closed: 0.5 },
  slowNew: 0.6, lowHp: 0.3,
  sack: { p: 0.2, fuse: 1.2, r: 3, slow: 0.6, t: 3 },
  pickSlow: 0.3, multiIframe: 2,
  econ: { max: 1.5, share: 0.1 },
  // 들판 증강 (그 판에서만, 3단계까지). v 단계마다 값
  augs: [
    { id: 'fork', name: '귤 두 갈래', d: '한 번에 귤이 한 줄 더', v: [1, 2, 3] },
    { id: 'rate', name: '빠른 손', d: '던지는 속도 +30%', v: [1.3, 1.6, 1.9] },
    { id: 'pierce', name: '관통 귤', d: '귤이 적을 뚫고 지나감', v: [1, 2, 4] },
    { id: 'burst', name: '터지는 귤', d: '맞으면 둘레 2.5m 에 터짐', v: [2.5, 3.2, 4] },
    { id: 'orbit', name: '도는 귤', d: '몸 둘레를 귤이 돎', v: [3, 4, 5] },
    { id: 'back', name: '뒤로도 던지기', d: '등 뒤로도 한 줄', v: [1, 2, 3] },
    { id: 'magnet', name: '조각 자석', d: '귤 조각을 +3m 멀리서', v: [3, 6, 9] },
    { id: 'move', name: '가벼운 발', d: '이동 +15%', v: [1.15, 1.3, 1.45] },
    { id: 'shove', name: '밀쳐 내기', d: '맞으면 둘레 적을 밀어냄', v: [4, 5, 6] },
    { id: 'rain', name: '귤비', d: '10초마다 둘레 적 모두에 피해', v: [10, 8, 6] },
    { id: 'heal', name: '귤즙 한 모금', d: '기운 +20 회복', v: [20, 30, 40] },
    { id: 'power', name: '단단한 귤', d: '귤 피해 +30%', v: [1.3, 1.6, 2] },
  ],
};

// 구역 지킴이 돌하르방 (#119, src/game/guard.js · 서버 server/src/roomcore.js): 구역 더미를 모두 치운 순간 그 구역 자리에 서고 holdSec 뒤 가라앉음
// 자리: 구역 길 위 반(upper, 길이 안 들어가는 구역은 옆 길)에서 길 옆 d m · 반경 r · 이미 있는 하르방에서 keep m 밖 (seed 고정 → 모두 같은 자리)
// 연출: 꽃 피는 연출(BLOOM_FX.zone)이 먼저, 치운 뒤 afterBloom 초부터 riseT 초 동안 솟음. fresh 초 안에 들은 것만 연출·메시지(그 뒤 들어온 사람은 서 있는 모습만)
// lookR m 안이면 카메라가 lookT 초 동안 그쪽을 봄. sinkT 초 동안 가라앉음. 저사양(단계 0)은 빛 기둥 없이 꽃잎만 조금
export const ZONE_GUARD = {
  holdSec: 1800, seed: 119, d: [3.2, 6.5], r: 1.3, keep: 12, depth: 3.5,
  afterBloom: 2.4, riseT: 2.6, sinkT: 3, fresh: 10, lookR: 75, lookT: 2.6,
  pillar: { h: 22, r: 1.1, t: 3.2 }, petals: 120, sparks: 50, dust: 70,
};
// 구역 우두머리·구역 완료 (#139, notes/growth-loop.md 2절·7-1절, src/game/boss.js · 확인 node tools/boss.js)
// 구역이 appear 만큼 깨끗해지고 그 구역 돌하르방(ZONE_GUARD)이 서 있지 않으면 우두머리 빈터(FIELD.boss)에 나옴. 쫓아내면 돌하르방이 서고 구역 완료
// list[구역]: kind 바탕 적(ENEMIES, 모양을 k 배로 키우고 tint 색을 곱함·머리 위 왕관), hp 기운, dmg 받힐 때 피해, gyul 떨구는 귤, mat 귀한 재료 이름(#140 강화가 씀)
//   hp 는 그 구역 권장 장비(칸 10개가 모두 구역 번호 단계)의 무기로 맞히기만 하면 약 40초 (손 1·활 4.5·총 10·머신건 16·레이저 40 초당 피해). 피하기·부하까지 40~90초 (tools/boss.js)
// perPlayer: 싸움에 낀 사람이 하나 늘 때마다 기운 × (1 + 이 값). phase: 기운 비율이 이 값 아래로 내려가면 다음 단계(패턴이 늘어남)
// near 빈터에서 이 거리 안에 오면 나타남(멀어지면 despawn 밖에서 조용히 사라짐), fight 빈터 반경 + 이만큼 안에 들어오면 싸움 시작(이름·기운 줄)
// leash 싸우는 사람이 모두 빈터에서 이만큼 멀어지면 빈터로 돌아가 기운을 다 채움 (쓰러져도)
// 패턴 (미리 보이는 경고 표시 → 피할 수 있게): gap 다음 패턴까지 쉬는 시간[최소, 최대](단계마다 짧아짐)
//   charge 돌진: warn 초 동안 바닥에 띠(길이 len·폭 w) → 바탕 적 chase × speed 로 그 띠를 달림, rest 초 숨 고르기
//   call 무리 부르기(기운 50% 아래): 그 구역 적 n 마리, every 초에 한 번까지, 부하가 이미 max 마리면 안 부름
//   beam 광선(기운 20% 아래): 내 자리와 둘레에 n 개 원(반경 r) → warn 초 뒤 하늘에서 빛 기둥, 원 안이면 dmg × dmgK
// slow: 쫓아낸 순간 느린 화면(t 초 동안 시간 × k). loot: 귤 알갱이 수. summaryAt: 하르방이 솟기 시작하고 이 초 뒤에 구역 요약
// netMs 방장이 우두머리 자리를 알리는 간격 (멀티: 방장이 굴리고 다른 사람은 받은 대로 보임)
// fast 빠른 마차·shortcut 지름길(구역을 한 번 끝낸 사람만): r 이 안이면 상호작용, fade 화면이 어두워졌다 밝아지는 시간
export const ZONE_BOSS = {
  appear: 0.8, perPlayer: 0.7, phase: [0.5, 0.2],
  near: 70, despawn: 120, fight: 10, leash: 38,
  list: {
    1: { kind: 'piglet', name: '아기 멧돼지 무리 대장', hp: 32, k: 2.3, tint: '#f2c27a', dmg: 14, gyul: 40, mat: '대장 멧돼지 털' },
    2: { kind: 'dog', name: '들개 대장', hp: 190, k: 1.8, tint: '#9fb7d6', dmg: 22, gyul: 80, mat: '대장 들개 이빨' },
    3: { kind: 'boar', name: '큰 멧돼지', hp: 400, k: 1.75, tint: '#c98a6a', dmg: 36, gyul: 500, mat: '큰 엄니' },
    4: { kind: 'rabid', name: '붉은 눈 들개', hp: 640, k: 1.7, tint: '#e07a6e', dmg: 44, gyul: 1200, mat: '붉은 발톱' },
    5: { kind: 'alien', name: '외계인 대장', hp: 1600, k: 1.55, tint: '#c7a0ff', dmg: 52, gyul: 2500, mat: '외계 핵' },
  },
  gap: [[1.6, 2.6], [1.2, 2.1], [0.9, 1.6]],
  charge: { warn: 0.95, len: 18, w: 2.6, speed: 1.7, rest: 1.1 },
  call: { n: [2, 3], every: 16, max: 3 },
  beam: { warn: 1.15, r: 2.6, n: 3, spread: 5, dmgK: 0.8, every: 7 },
  walk: 1.15, // 다가갈 때 바탕 적 walk × 이만큼
  slow: { t: 1.4, k: 0.3 }, loot: 24, summaryAt: 3.2,
  netMs: 200,
  // 싸움이 풀린 뒤 (#183, enemies.js restRegen): 기운은 남고 delay 초 동안 그대로, 그 뒤 초당 최대 기운의 rate 씩 참 (다시 맞거나 싸움이 붙으면 멈춤)
  //   delay 는 가장 먼 구역(굼부리) 클린하우스에서 처음 쓰러졌다 돌아오는 약 46초(직선·달리기, tools/boss.js 표)를 보고 20 → 30
  // parting: 풀린 뒤 이 초 안에 마지막으로 때린 사람 쪽으로 돌진 한 번 (partR 안에 있을 때, 띠 끝은 빈터에서 leash + partOver 까지)
  // awayToast: 이 초 넘게 아무도 싸움 거리에 없으면 '빈터로 돌아갔어요'. 사라졌다 다시 나와도 남은 기운은 이어짐 (그동안 찬 만큼 더해)
  rest: { delay: 30, rate: 0.02, parting: 3, partR: 50, partOver: 12, awayToast: 30 },
  fast: { r: 6, fade: 0.9, hold: 1.1, park: 5 }, // park: 세워 둔 빠른 마차가 팻말 뒤(길 방향) 이만큼 (#174)
  shortcut: { r: 4, off: 4.5, fade: 0.8, hold: 0.8 },
};
// 깨끗해진 구역에 꽃과 어린 나무 (#46, src/bloom.js). 깨끗한 정도 c (0~1) 기준
// 풀 색: c ≤ dryTo 메마름, liveAt 부터 다시 살아남 (dryTo~liveAt 사이 서서히), 1 이면 lush 만큼 더 푸름
// 꽃: 70% 부터 피기 시작(early 비율의 꽃이 70~98% 사이에 하나씩), 나머지는 100% 에 한꺼번에(물결). 어린 나무는 100% 에 솟음
export const BLOOM = {
  dryTo: 0.4, liveAt: 0.7, lush: 0.35, dryRate: 0.35, // 풀 색 바뀌는 빠르기 (1초에)
  flowerFrom: 0.7, early: 0.55,
  per: 60, perLow: 110, // 꽃 무리 하나에 땅 넓이 (작을수록 빽빽)
  treePer: 1400, treePerLow: 3200, treeOff: [0.85, 0.97], // 어린 나무 하나에 땅 넓이 · 이 아래로 떨어지면 시듦 (나무마다 다름)
  heapRing: { s: 6, l: 12, xl: 20 }, // 치운 더미 자리에 바로 피는 꽃 무리 수
  heapTuft: { s: 8, l: 16, xl: 30 }, // 치운 더미 자리에 살아나는 풀 포기 수 (#65)
  heapWave: 0.8, heapGrow: 0.45, // 더미 자리: 가운데부터 바깥까지 피는 데 걸리는 시간 · 하나가 톡 피는 시간 (#65)
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
// 더미를 다 치웠을 때·구역이 꽃밭이 될 때 효과 (#65, src/bloomfx.js). 후처리 없이 입자·메시·색만
// 입자 수는 기기 단계로 줄임: tierMul[LOW, 중간, 높음]
export const BLOOM_FX = {
  tierMul: [0.35, 0.6, 1],
  maxPetals: 520, maxSparks: 200, maxGyul: 40, // 한 번에 살아 있는 최대 수 (높음 기준)
  heap: { // 더미 크기 3단계: 작은 10 · 큰 50 · 대형 200
    s: { ring: 1.6, ringT: 0.8, petals: 40, sparks: 22, up: 4.2, rings: 1, shake: 0, vib: [18] },
    l: { ring: 2.2, ringT: 0.8, petals: 95, sparks: 45, up: 5.6, rings: 2, shake: 0, vib: [20, 40, 24] },
    xl: { ring: 3.0, ringT: 0.8, petals: 190, sparks: 90, up: 7.2, rings: 3, shake: 1, vib: [24, 40, 24, 40, 50] },
  },
  otherR: 60, // 다른 사람이 치운 더미는 이 거리 안이면 보임 (멀티 대비)
  cheerT: 1.1, // 캐릭터가 기뻐하는 시간
  zone: { camT: 1.5, camDist: 0.6, camPitch: 0.2, column: 260, colT: 2.2, colH: 26, ring: 42, ringT: 2.4, glowT: 2.4, bannerT: 3.2, vib: [30, 50, 30, 50, 90] },
};
// 쓰레기 투기꾼·투기 트럭 (#47, src/dumpers.js): 자정 리셋 대신 이들이 와서 더미를 다시 쌓음
// 주기 = every ÷ players (최소 minEvery). players 는 접속 인원 (지금은 1, 멀티가 붙으면 서버 값)
// 한 명 기준 한 시간에 오름 전체 쓰레기 × hourFrac 만큼 쌓임 (3분마다 한 번 → 한 번에 평균 약 38개).
// 투기꾼은 작은 더미 하나(amt), 트럭 양은 이 평균이 맞게 자동 계산 (src/dumpers.js DUMP_AMT, 약 80)
// 구역 고르는 무게 = zoneBase + 그 구역 깨끗한 정도 (깨끗한 구역일수록 자주)
// 쫓아내기: 버리기 전에 귤을 hp 만큼 맞히면(손 1, 활 2) 도망가고 귤 reward 개를 떨어뜨림. 플레이어를 공격하지 않음
export const DUMP = {
  players: 1,
  every: 180, // 남송이는 연출 감독(#89 PACE)이 부름. every 는 접속 안 한 동안 쌓는 양(DUMP_AMT)의 기준으로만 minEvery: 20,
  hourFrac: 0.25,
  truckP: 0.4, // 한 번 올 때 트럭일 확률
  zoneBase: 0.3,
  dumpT: 5, // 버리는 데 걸리는 시간(초)
  max: 4, // 동시에 오는 최대 수
  outside: 14, // 돌담 바깥 이만큼에서 나타남
  entryIn: 60, // 트럭은 돌담에서 이 거리 안 탐방로 점으로 길에 오름
  offRoad: 3, // 트럭: 돌담에서 탐방로까지 들판을 지나는 거리는 이만큼 곱해 셈 (클수록 길로만)
  startleT: 0.7, // 맞고 깜짝 놀라는 시간(초) (#68)
  fleeT: 6, // 도망가기 시작해서 이 시간(초) 또는
  fleeDist: 40, // 이만큼(m) 달아나면(또는 돌담을 넘으면) 서서히 사라짐
  fadeT: 1, // 사라지는 데 걸리는 시간(초)
  bagDrop: 3, // 떨어뜨린 봉투에서 주울 수 있는 쓰레기 수
  bagStay: 20, // 땅에 떨어진 봉투가 보이는 시간(초)
  maxTrip: 300, // 한 상태가 이보다 오래 걸리면 조용히 사라짐
  warnT: 3, // 나타날 때 화면 가장자리 방향 표시 시간(초)
  offlineMaxH: 8, // 접속하지 않은 시간은 한 명 기준 속도로 쌓고, 이 시간 이상이면 오름 전체가 가득
  offlineMin: 60, // 이보다 짧게 비운 건 세지 않음(초)
  walker: { name: '무단투기꾼', hp: 1, amt: 10, speed: 2.6, flee: 7, reward: 5, hitR: 1.1 },
  truck: { name: '투기 트럭', hp: 6, speed: 7, flee: 10, reward: 30, hitR: 2.4 },
};
// 흡연자 (#156, src/game/smoker.js): 오름 들머리에 가끔 나와 담배를 피움. 플레이어를 공격하지 않음. 귤을 한 번 맞히면 놀라 꽁초 1개를 떨구고 도망 (투기꾼 DUMP.startleT·fleeDist·fadeT 그대로)
// near 들머리 클린하우스에서 이 거리(m) 안, 탐방로에서 off[0]~off[1] m 비켜난 자리. playerR 플레이어가 들머리 클린하우스 이 거리 안에 있을 때만 every[0]~[1] 초마다 한 명(한 번에 한 명)
// stay 안 쫓으면 이 초 뒤 꽁초 leaveButts 개를 버리고 걸어 나감. walkIn 나타날 때 이만큼 떨어진 곳에서 걸어옴. reward 쫓으면 귤, buttLife 꽁초가 땅에 남는 초(주울 수 있는 낱개 쓰레기, 비닐 1개로 셈), buttMax 한꺼번에 남는 꽁초 수
// puff 입 앞 연기 조각 수(저사양 puffLow), jacket 점퍼 색. 귤 벌이: tools/econ.js 가 하루 1시간에서 흡연자 몫이 전체의 3% 아래인지 봄 (들머리 둘레에 있는 시간 econNear)
export const SMOKER = {
  name: '흡연자', hp: 1, speed: 1.6, flee: 7, hitR: 1.1,
  near: 25, off: [2, 5], playerR: 60, every: [240, 420],
  stay: 90, leaveButts: 3, walkIn: 12, reward: 8,
  buttLife: 600, buttMax: 12, pickR: 1.1,
  puff: 5, puffLow: 2, jacket: '#8a8f96',
  econNear: 0.25,
};
export const TRASH = {
  cell: 32, // 튜토리얼 낱개 그리기 범위 칸
  drawR: 110, drawRLow: 70,
  heapDrawR: 420, heapDrawRLow: 260, // 더미를 그리는 거리
};

// 장비 5단계. 장비점(#128)에서 순서 없이 사고(#111) 사면 바로 착용 (#10). 저장은 save.equip.{tool,bag,shoes} = 1~5
// rate 는 상점에 보이는 초당 개수 (= per ÷ time)
// #137 성장 루프 (notes/growth-loop.md 4절): 단계마다 능력이 2배 넘게, 값은 단계마다 약 4배. tools/econ.js 로 맞춤
//   흐름: 1일(1시간) 구역 1·2단계, 2일 구역 2~3·3단계, 3일 4단계, 4일 구역 4, 5일 5단계·정상
//   집게(2단계)는 튜토리얼 첫 보너스(TUT.firstBonus)로 삼
export const TOOLS = [
  { tier: 1, name: '맨손', per: 1, time: 0.9, r: 1.6, price: 0 },
  { tier: 2, name: '집게', per: 1, time: 0.4, r: 2.4, price: GROWTH.price[2] },
  { tier: 3, name: '갈퀴', per: 3, time: 0.5, r: 3.2, price: GROWTH.price[3] },
  { tier: 4, name: '큰 갈퀴', per: 7, time: 0.5, r: 4.0, price: GROWTH.price[4] },
  { tier: 5, name: '흡입기', per: 8, rate: 32, time: 0.25, r: 5.0, price: GROWTH.price[5] },
];
// 배낭: 처음엔 배낭 없이 호주머니(POCKET)만. save.equip.bag 0 = 호주머니, 1~5 = BAGS[bag-1] (#31)
export const POCKET = { tier: 0, name: '호주머니', cap: 6, price: 0 };
export const BAGS = [
  { tier: 1, name: '배낭', cap: 20, price: GROWTH.price[1] },
  { tier: 2, name: '큰 배낭', cap: 45, price: GROWTH.price[2] },
  { tier: 3, name: '등산 배낭', cap: 100, price: GROWTH.price[3] },
  { tier: 4, name: '대형 배낭', cap: 220, price: GROWTH.price[4] },
  { tier: 5, name: '원정 배낭', cap: 500, price: GROWTH.price[5] },
];
// 신발: 빠르기는 그대로, 값만 같은 곡선 (#137)
export const SHOES = [
  { tier: 1, name: '쓰레빠', speed: 1.0, price: 0 }, // #52 처음엔 쓰레빠
  { tier: 2, name: '러닝화', speed: 1.1, price: GROWTH.price[2] },
  { tier: 3, name: '트레일화', speed: 1.2, price: GROWTH.price[3] },
  { tier: 4, name: '등산화', speed: 1.3, price: GROWTH.price[4] },
  { tier: 5, name: '바람 신발', speed: 1.45, price: GROWTH.price[5] },
];
// 특별 신발 '고진의 파란장화' (#167): 단계 줄에 끼우지 않음. 저장 save.equip.boots = 0 없음 · 1 가짐(안 신음) · 2 신음
// 신으면 이동 speed 배, 장비 점수·길 밖 풀밭 느림은 tier 단계 신발과 같게. 값은 tier 단계 값. 파는 곳 LEAP 신발 칸
export const BOOTS = { id: 'boots', name: '고진의 파란장화', speed: 1.35, tier: 4, price: GROWTH.price[4], desc: '고진 씨가 신던 그 장화. 왜 빠른지는 아무도 모른다.', print: 1.25 }; // print: 발자국 크기 배

// 클린하우스(재활용장): 들머리 한 곳 + 오름 안 작은 것 4곳(#78). 귤은 TRASH_TYPES 의 gyul (캔·페트병·비닐 1, 스티로폼 3, 폐어구 5)
export const CLEANHOUSE = {
  r: 7, // 이 거리 안이면 상호작용 버튼이 '버리기'
  shopR: 3.2, // 옆 귤 가판대(튜토리얼 동안만 장비점 좌판, #128) 앞 이 거리 안이면 '장비점'
  dumpTime: 1.9, // 버리기 연출 전체 길이(초). 2초 안
  flyMax: 40, flyMaxLow: 20, // 날아가는 쓰레기 모양 최대 개수 (많으면 묶어서 보여 줌)
  binColors: ['#c9473d', '#3c7fc9', '#e8c13a', '#eeeee6', '#3f9a5a'], // 캔·페트병·비닐·스티로폼·폐어구 통
  arrowNear: 14, // 배낭이 찼을 때 이보다 멀면 방향 화살표
  stallMark: 0.055, // 가판대 위 귤 표시 크기(화면 높이 비율, 멀어도 같은 크기)
  shopHint: 8, // 버린 직후 살 수 있는 장비가 있으면 장비점 쪽 표시를 띄우는 시간(초, #128 가판대 → 가게 거리 장비점)
  // 오름 안 작은 클린하우스 (#78): 탐방로 nsAlong(path, d, side, off) 자리. 지붕 있는 통 넷(캔·페트병·비닐·스티로폼+폐어구), 기능은 들머리 것과 같음(가판대는 없음)
  // 자리는 어느 더미에서든 걸어서(5m/s) 1분 안(길 거리 300 안)에 하나는 닿게 고름. 지금 가장 먼 더미 약 280
  mini: [
    { id: 'skirt', name: '자락 숲길 갈림길', path: 'toCrater', d: 125, side: -1 },
    { id: 'slope', name: '남쪽 사면 중턱', path: 'approach', d: 456, side: 1 },
    { id: 'rest', name: '능선 쉼터', path: 'rim', d: 618, side: -1 },
    { id: 'crater', name: '굼부리 들머리', path: 'crater', d: 354, side: 1 },
  ],
  miniOff: 6, // 길 가운데에서 작은 클린하우스 가운데까지
  miniBins: [0, 1, 2, 3, 3], // 쓰레기 종류 → 작은 클린하우스 통 번호 (스티로폼·폐어구는 한 통)
  keep: 14, // 클린하우스 둘레 이 거리 안엔 몹이 나오지 않음
};

// 쓰레기 도감 (#13): 종류마다 흔한 것 4개(20종) + 드문 것 2개(10종) = 30종. kind 는 TRASH_TYPES 의 id
export const DEX = {
  rareChance: 1 / 400, // 주울 때마다 이 확률로 그 종류의 드문 것
  rareGyul: 20, // 드문 것을 주우면 더 주는 귤
  common: {
    can: ['음료 캔', '탄산 캔', '참치 캔', '찌그러진 캔'],
    pet: ['생수 페트병', '탄산 페트병', '주스 페트병', '커피 페트병'],
    vinyl: ['비닐봉지', '과자 봉지', '컵라면 포장', '찢어진 비닐'],
    foam: ['스티로폼 조각', '컵라면 용기', '포장 완충재', '도시락 용기'],
    gear: ['낚싯줄 뭉치', '폐어망 조각', '낚시 추', '끊어진 밧줄'],
  },
  rare: [
    { kind: 'can', name: '녹슨 양철 도시락' }, { kind: 'can', name: '옛날 우유 깡통' },
    { kind: 'pet', name: '유리병 편지' }, { kind: 'pet', name: '옛날 사이다병' },
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
  max: 100, step: 0.07, // 돌 하나가 올리는 높이(돌 크기에 비례). 100개일 때 밑돌 포함 높이 약 8m
  flat: 0.25, // 돌을 납작하게 (세로 배율)
  topSize: 0.5, // 맨 위 돌 크기 배율. 밑동은 돌 수에 맞춰 굵어짐 (#82)
  shrink: [0.03, 0.06], // 한 층 올라갈 때마다 작아지는 비율(층마다 이 사이에서 다르게)
  minTaper: 0.22, // 맨 위 돌 / 맨 아래 돌 크기 하한 (돌이 아주 많아도 밑동이 이 이상 굵어지지 않게 줄이는 정도를 눌러 줌)
  maxBottom: 2.2, // 밑동 돌 크기 배율 상한
  resize: 0.3, // 새 돌이 올라올 때 아래 돌 크기가 다시 맞춰지는 시간(초)
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
  particles: 700, particlesLow: 250, box: 40, rainFall: 20, snowFall: 3.2, // #187: 1400·500·26 → 어지러워서 줄임
  // #147 비·눈 모양: 빗줄기는 바람 쪽으로 기운 짧은 선 (len 길이 범위 m, w 굵기 m, thick 비율만큼은 thickK 배 굵게)
  // #187 어지러움 줄이기: 옅게(rainAlpha 0.8→0.35)·하늘빛에 가까운 색·짧고 느리게·카메라 near m 안은 안 그림(nearFade m 동안 서서히)·멀수록 옅게(far 거리에서 farA 배)
  rainDrift: 3, rainWindK: 0.6, // 옆 흐름 = rainDrift × max(1, 바람 배율 − rainWindK): 보통 비는 3, 바람 센 날만 크게
  rainAlpha: 0.35, rainCol: '#c3cad0', streak: { len: [0.6, 1.1], w: 0.03, thick: 0.08, thickK: 1.4, minPx: 1.1, near: 4, nearFade: 2, far: [12, 26], farA: 0.5 },
  snowN: 900, snowLow: 400, snowSize: [4, 5], snowAlpha: 0.8, // 눈송이 수·화면 크기(px)·불투명도 (#187: 0.95 → 0.8)
  // #187 설정 '비 효과': 보통·약하게·끔. 빗줄기·눈송이 수와 진하기에 곱함 (끔이어도 회색 하늘·젖은 땅은 남음). prefers-reduced-motion 이면 기본 '약하게'
  fx: { full: { n: 1, a: 1, name: '보통' }, soft: { n: 0.45, a: 0.6, name: '약하게' }, off: { n: 0, a: 0, name: '끔' } },
  keepMin: 120, // 날씨를 못 받으면 앞에 받은 날씨를 이만큼(분) 그대로 둔다
  nightDim: 0.16, // 밤 흐림·비 하늘 = 낮 회색 × 이 값
  cloudLow: 0.45, cloudBig: 0.9, // 비·흐림엔 구름 덩어리를 이만큼 낮게(높이 비율)·크게(배율 더함)
  floor: 0.42, // 날씨 × 구역 분위기로 땅이 어두워져도 원래 밝기의 이 비율 아래로는 안 내려감
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
  knockSpeed: 8.4, knockV: 4, knockDrag: 7, // 맞으면 짧게 뒤로 밀림 (#107: 예전엔 28·11 로 날아가 구르고 일어남). 속도·뜨는 속도·밀림이 줄어드는 빠르기(초당)
  flinchT: 0.45, flinchPeak: 0.08, flinchAng: 0.38, // 움찔: 이 초 안에 바로 섬(이 동안 조작 못 함), 가장 젖히는 때, 그때 몸 기울기(rad, 약 22°)
};
// 적 (#37, 구역별 #48): 쓰러뜨리지 않고 귤을 맞혀 쫓아냄. 전투 오름에서만. 새 종류는 여기에 한 줄 + src/enemymodels.js 에 모양
// hp 기운, walk·chase·flee 속도, dmg 받힐 때 플레이어 HP 피해(#36), reward 쫓아냈을 때 귤 개수·드문 쓰레기 확률
// sight 이 거리 안에 플레이어가 보이면 돌진, lose 이보다 멀어지면 그만둠, life 안 쫓아내면 스스로 떠나는 시간(초)
// rootEvery 땅 헤집는 간격(초), rootT 헤집는 시간, rootTrash 흘리는 쓰레기 수(가까운 더미에 더함), size 판정·충돌 크기 배율
// rush 조짐 뒤 돌진·우두머리 돌진의 바탕 빠르기(#149: chase 를 낮추며 예전 값을 지킴), rest 한 번 공격(받기·비껴감)한 뒤 다음 조짐까지 쉬는 초(그동안 COMBAT.ringR 둘레를 돎)
// ranged: 멀리서 쏘는 적. keep 이 거리를 지키며 every 초마다 광선, range 쏘는 거리, speed 광선 속도, r 맞는 반경
// #137: 기운(hp)·귤이 구역마다 약 2.4~2.5배 (notes/growth-loop.md 3절). 귤은 dropMax 개까지 알갱이로 흩뿌리고 나눠 담음 (ENEMY_DROP)
export const ENEMIES = {
  piglet: { name: '아기 멧돼지', hp: 3, walk: 1.8, chase: 4.6, rush: 4.6, rest: 2.5, flee: 7, dmg: 10, reward: { gyul: 5, rare: 0.03 }, sight: 14, lose: 24, life: 180, rootEvery: [16, 30], rootT: 1.6, rootTrash: [1, 2], rootR: 14, size: 0.62 },
  dog: { name: '들개', hp: 8, walk: 3.0, chase: 6.5, rush: 9.5, rest: 2.0, flee: 11, dmg: 15, reward: { gyul: 15, rare: 0.04 }, sight: 20, lose: 32, life: 180, rootEvery: [18, 32], rootT: 1.4, rootTrash: [1, 2], rootR: 14, size: 0.85 },
  boar: { name: '멧돼지', hp: 20, walk: 2.4, chase: 6, rush: 7.2, rest: 2.5, flee: 9, dmg: 25, reward: { gyul: 45, rare: 0.05 }, sight: 18, lose: 30, life: 180, rootEvery: [14, 28], rootT: 1.8, rootTrash: [2, 3], rootR: 14, size: 1 },
  rabid: { name: '광견병 걸린 들개', hp: 50, walk: 3.6, chase: 7.5, rush: 12, rest: 1.6, flee: 12, dmg: 30, reward: { gyul: 130, rare: 0.07 }, sight: 24, lose: 36, life: 200, rootEvery: [16, 30], rootT: 1.4, rootTrash: [2, 3], rootR: 14, size: 0.92 },
  alien: { name: '외계인', hp: 120, walk: 2.6, chase: 4.4, flee: 10, dmg: 35, reward: { gyul: 400, rare: 0.1 }, sight: 26, lose: 40, life: 220, rootEvery: [20, 34], rootT: 2.2, rootTrash: [2, 4], rootR: 16, size: 1.15, ranged: { keep: 14, range: 24, every: 3, speed: 15, r: 1.0 } },
  // 들판 떼 전용 (#173, src/game/swarm.js): 구역 3 까마귀(하늘에서 내려와 쪼고 올라감), 구역 5 외계인 드론(작은 비행 접시, 약한 광선). 표의 값은 '보통 적' 기준이고 떼는 SWARM.mob 비율로 낮춤
  crow: { name: '까마귀', hp: 16, walk: 3.4, chase: 7, rush: 10, rest: 2.2, flee: 12, dmg: 20, reward: { gyul: 40, rare: 0.03 }, sight: 30, lose: 44, life: 180, rootEvery: [1e9, 1e9], rootT: 1, rootTrash: [0, 0], rootR: 14, size: 0.75, fly: 2.8 },
  drone: { name: '외계인 드론', hp: 100, walk: 3.2, chase: 5.5, flee: 12, dmg: 30, reward: { gyul: 360, rare: 0.06 }, sight: 30, lose: 44, life: 200, rootEvery: [1e9, 1e9], rootT: 1, rootTrash: [0, 0], rootR: 16, size: 0.8, ranged: { keep: 10, range: 18, every: 2.4, speed: 13, r: 0.8 } },
};
export const ENEMY_DROP = { max: 12 }; // 쫓아낸 적이 흩뿌리는 귤 알갱이 수 상한 (귤은 나눠 담음, #137)
export const ENEMY_SPAWN = {
  every: 120, first: 120, // 2분마다 한 무리 (들어온 뒤 첫 무리도 2분 뒤). 남송이는 연출 감독(#89 PACE.battle)이 부르고, 이 값은 쓰레기 없는 맵에서만
  group: [2, 3], // 한 무리 마릿수
  r: [26, 60], // 플레이어에서 이 거리 사이, 플레이어가 있는 구역 안 (없으면 가까운 곳 near)
  near: [12, 26],
  max: 4, // 동시에 최대
  byZone: { 1: 'piglet', 2: 'dog', 3: 'boar', 4: 'rabid', 5: 'alien' }, // 구역별 몹 (#48). 들머리(0)·다 핀 구역에는 안 나옴
  kinds: ['boar'], // 구역이 없는 맵에서 나올 수 있는 종류
  warnT: 3, // 나타날 때 화면 가장자리 경고 표시 시간(초)
  goneD: 90, // 도망·떠나는 적이 이만큼 멀어지면 사라짐
};
// 적 무리 (#146, src/enemypack.js): 적끼리 겹치지 않기 · 같은 무리는 플레이어 둘레로 벌려 에워쌈
export const ENEMY_PACK = {
  push: 10, pad: 0.3, // 밀어내는 세기: 몸 원(BOAR.bodyR × 크기) 합 + pad 안으로 들어온 만큼을 1초에 이 비율로 풂. 몸 원끼리 겹친 만큼은 바로 풂
  look: 0.6, yieldT: 0.3, // 앞에 다른 적이 이만큼 안에 있으면 yieldT 초 동안 걸음을 늦춤 (줄지어 기다림)
  jamT: 0.5, detourT: 1.2, // 밀린 쪽이 돌담·나무·오름 밖에 막힌 채 jamT 초면 detourT 초 동안 옆으로 돌아감
  close: 3, // 한 무리에서 가까이(COMBAT.ringR 안) 붙는 수. 실제로 한 번에 덤비는 수는 COMBAT.attackers (난이도는 그대로)
  closeR: 4.6, backR: 3.5, // 붙는 적은 이 둘레까지 다가가고(COMBAT.windD 안), 나머지는 ringR + backR 둘레에서 맴돌다 자리가 나면 들어옴
  spread: 1.1, arc: 4.4, // 무리 안 이웃 자리 사이 각(rad, 약 63°), 무리 전체가 벌리는 각 상한(rad, 약 250°)
  lead: 4, arcStep: 0.6, // 멀리서는 자기 자리 방향으로 lead m 씩 다가가고, 둘레로는 한 번에 arcStep rad 앞까지만 보며 돌아감
  drift: 0.3, driftW: 0.5, // 뒤에서 기다리는 적은 자리를 ±drift rad 만큼 천천히 옮기며 맴돎
  gather: 0.5, gatherD: 9, // 무리 가운데에서 gatherD m 넘게 떨어지면 가운데로 끌리는 세기
  vary: 0.12, // 빠르기를 저마다 ±이 비율로 다르게 (같은 걸음으로 겹쳐 보이지 않게)
  orbit: 0.4, // 멀리서 쏘는 적(외계인)이 제 자리에 닿으면 무리가 함께 한쪽으로 도는 빠르기(× walk)
  every: 0.25, // 자리를 다시 나누는 간격(초)
  spawnGap: 0.4, // 처음 놓을 때 몸 원 사이 여유(m)
};
// 무기 (#38, 3~6단계 #123): 전투 오름에서만. 상점 무기 탭에서 순서 없이 삼(#111). 저장은 save.equip.weapon = 가진 가장 높은 단계(1 = 손), save.weaponUse = 골라 쓰는 단계
// dmg 한 발 피해(dps 면 초당 피해), range 자동 조준 사거리(수평 m), speed 탄 속도(m/s), grav 탄에 걸리는 중력, perGyul 귤 하나로 쏘는 발 수 (활 1: 한 발에 귤 하나 #178)
// cd 다음 발까지(초), rate 누르고 있으면 초당 발 수(머신건), spread 퍼짐(rad), gyulPerSec 레이저가 쓰는 귤(초당), tick 레이저 피해를 나눠 주는 간격(초)
// r 폭탄 반경(m), cost 폭탄 한 번에 쓰는 귤. 값은 성장 곡선(GROWTH.price). 피해는 notes/growth-loop.md 4절 (총 7 · 머신건 초당 16 · 레이저 초당 40 · 폭탄 광역 90)
export const WEAPONS = [
  { tier: 1, id: 'hand', name: '손', dmg: 1, range: 24, price: 0 },
  { tier: 2, id: 'bow', name: '귤 활', dmg: 3, range: 32, speed: 40, grav: 5, perGyul: 1, price: GROWTH.price[2] }, // 활은 한 발에 귤 1개 (#178, 손보다 세니까)
  { tier: 3, id: 'gun', name: '귤 총', dmg: 7, range: 40, speed: 80, grav: 1.5, perGyul: 8, cd: 0.7, price: GROWTH.price[3] },
  { tier: 4, id: 'mg', name: '귤 머신건', dmg: 16, dps: true, range: 35, speed: 70, grav: 1.5, perGyul: 30, rate: 6, spread: 0.035, price: GROWTH.price[4] },
  { tier: 5, id: 'laser', name: '귤즙 레이저', dmg: 40, dps: true, range: 45, gyulPerSec: 0.5, tick: 0.2, price: GROWTH.price[5] },
  { tier: 6, id: 'bomb', name: '귤 폭탄', dmg: 90, range: 30, r: 6, cd: 2, cost: 2, price: GROWTH.price[6] },
];
// 무기 3~6단계 연출 (#123, src/weaponfx.js·src/game/arms.js)
// aimT 총을 겨눈 채로 있는 시간(초), kick 반동 시간, life 탄이 아무것도 안 맞고 날아가는 최대 시간은 range / speed
// laser: w 줄기 굵기, wet 맞은 적이 젖어 보이는 시간(초), drip 초당 떨어지는 방울 수
// bomb: grav 포물선 중력, vMin·vMax 수평 속도, k 위로 던지는 비율, boom 터지는 빛 시간(초), fuse 땅에 닿고 터지기까지(초)
// low: 저사양 단계에서 효과를 이 비율로
export const WEAPON_FX = {
  aimT: 0.55, kick: 0.09,
  splash: 6, splashLow: 3, // 총알이 맞으면 튀는 즙 방울 수
  laser: { w: 0.07, wet: 1.6, drip: 14 },
  bomb: { grav: 22, vMin: 6, vMax: 22, k: 0.75, boom: 0.5, fuse: 0.12, splashN: 3 },
  low: 0.5,
  peerSeq: 1.5, // 다른 사람에게 보내는 한 발 사건을 이 초 동안 실어 둠 (그 뒤 빼서 보내는 양을 줄임)
};
// 귤 활 연출 (#38)
export const BOW = {
  release: 0.3, total: 0.62, // 당겨서 놓는 순간·동작 전체 (초)
  splash: 14, splashLow: 7, // 맞으면 튀는 즙 방울 수
  life: 1.6, // 화살이 아무것도 안 맞고 날아가는 최대 시간(초)
};
// 눈 깜빡임 (#74)
export const BLINK = {
  gapMin: 3, gapMax: 6, // 다음 깜빡임까지 (초, 무작위)
  close: 0.05, hold: 0.02, open: 0.05, // 한 번 깜빡임 ≈ 0.12초
  twice: 0.1, twiceGap: 0.08, // 두 번 연달아 깜빡일 확률·사이 간격
  wide: 0.22, // 놀람·받힘: 눈 둘레를 이만큼 키움
  far: 30, // 카메라에서 이보다 먼 캐릭터는 깜빡이지 않음 (m)
};
// 귤 피해 (#37): 손으로 던지기. 무기 표의 손과 같음
export const THROW_DMG = { hand: WEAPONS[0].dmg };

// 귤 모양 (#63): 던지는 귤·떨어진 귤·흩어지는 귤·튜토리얼 귤이 같이 씀. 크기·색·빛 한곳
export const TANGERINE = {
  scale: 1.5, // 예전 크기에 곱함
  color: '#ffa530', emissive: '#a24a00', emissiveI: 0.8, // 더 밝은 귤색 + 스스로 조금 빛남 (밤에도 보임)
  hover: 0.12, bob: 0.05, bobSpeed: 2.2, spin: 0.9, // 바닥에 놓인 귤: 뜨는 높이·위아래 흔들림·돌기(rad/s)
  glowColor: '#ffbe5a', glowOpacity: 0.32, glowR: 0.55, // 아래 빛 원
  trailN: 5, trailEvery: 0.025, trailOpacity: 0.45, // 던진 귤 꼬리 점 수·찍는 간격(초)·시작 투명도
};

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
  walkD: 14, runD: 30, // 걷기·달리기 원 자리 (#62: 단계 사이는 걸어서 5초 안)
  ringR: 2.4, // 원에 이만큼 들어오면 도착
  gyulD: [35.5, 37.5, 39.5], gyulR: 1.7, // #62 바닥에 놓인 귤 3개 (길 양옆 번갈아). #151 부터는 GYUL_PICK 범위 안에 들면 저절로 모임
  targetD: 44, targetLat: 2.2, targetH: 1.25, targetR: 1.1, hits: 3, // #62 과녁: 자리·길에서 옆으로·판 가운데 높이·맞는 반지름, 맞힐 횟수 (#100: 귤 줍는 곳 바로 앞, 크게)
  streamD: 58, streamW: 6.6, // 개울 가운데 자리, 길 방향 반폭 (돌다리로 건넘)
  trashD: [69, 72.5, 76], // (예전) 쓰레기 3개 자리 (#100)
  heapD: 72.5, heapLat: 1.2, heapN: 3, // #151 튜토리얼 전용 작은 더미: 자리(길 따라·옆), 쓰레기 수(예전 낱개 3개와 같게). 저장·멀티·구역·업적에 안 들어감
  heapLookT: 1.5, // 더미를 다 치우면 카메라가 더미 쪽을 보는 시간(초)
  shopGateR: 4, // #151 가게 거리 쪽 정낭에 이만큼 다가가면 안내 한 번
  // #100 단계마다 격리된 칸: 들머리 마당을 낮은 돌담으로 나눈 우리. to = 칸 끝(다음 칸과의 정낭) 자리, steps = 이 칸에서 하는 단계(다 하면 정낭이 열림)
  // l·r = 길 가운데에서 왼쪽·오른쪽 담까지. 마지막 칸 끝은 들머리·오름 사이 정낭(gateD). 왼쪽 4칸 담이 가게 골목(SHOP_ST.d) 입구를 막음
  cellBack: -4, // 첫 칸 뒷담 (시작 지점 뒤)
  cells: [
    { to: 33, steps: ['walk', 'zoom', 'run'], l: 7, r: 7 },
    { to: 46.5, steps: ['gyul', 'throw'], l: 7, r: 7 },
    { to: 80, steps: ['pick'], l: 7, r: 7 },
    { to: 112, steps: ['dump', 'bonus', 'tongs', 'bag'], l: 6, r: 22 },
  ],
  penH: 0.6, // 칸 돌담 높이 배율 (바깥 돌담 WALL.height 의 이만큼 = 무릎~허리)
  laneLen: [6, 9], laneW: 1.3, laneT: 10, // 정낭이 열리면 정낭 앞뒤로 빛나는 길 (m, 반폭, 이 초 뒤 사라짐)
  // #100 쉽게: 진행이 없으면 손가락(초), 더 없으면 토스트를 흔들고 더 쉬운 말로(초). 잘했어요 토스트 시간(초)
  fingerT: 10, easyT: 30, okT: 1.1,
  zoomK: 0.15, zoomSkipT: 8, // #151 확대·축소 단계: 카메라 거리가 이 비율 넘게 바뀌면 통과, 이 초 뒤 '건너뛰기'
  cleanD: 94, // 클린하우스(길 오른쪽 7.5)
  gateD: 112, // 안쪽 돌담·정낭
  firstBonus: GROWTH.price[2] + GROWTH.price[1], // 클린하우스에 처음 버릴 때 귤이 이만큼이 되도록 채워 줌 (집게 + 배낭, #137)
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
  species: [{ id: 'ayu', name: '은어' }, { id: 'carp', name: '붕어' }, { id: 'crab', name: '참게' }, { id: 'dageum', name: '다금바리' }, { id: 'okdom', name: '황금 옥돔' }, { id: 'gcarp', name: '귤색 잉어' }],
  // 잭팟 (#55): 찌가 들어가는 순간 이 확률로 큰 것이 걸림. species 3~5 번이 잭팟 물고기 (도감 '개울' 칸). 기본 species 0~2 는 평소 물고기
  // 처음 임의값은 1/150·귤 300 이었으나 tools/econ.js 로 재 보니 시간당 벌이가 오름 1일차의 절반을 넘어 1/500·귤 60 으로 낮춤
  jackpot: { p: 1 / 500, gyul: 60, first: 3, bigT: 1.6, burst: 36 }, // first: 잭팟 물고기 첫 species 번호, bigT: 잭팟은 놓치기 전까지 더 길게(초), burst: 터지는 귤 알 수
};

// 귤 던지기 자동 조준 (#34): 사거리 안 가장 가까운 대상(적·하르방)을 겨눔. 손으로 던지기는 무료
// 줍기 버튼으로 가까운 쓰레기까지 걸어가기 (#104): range 안에서 가장 가까운 쓰레기(낱개·더미)를 찾아 감. stand: 도착 자리(가장자리에서 도구 반경의 이 비율)
export const PICK_SEEK = { range: 25, stand: 0.5, color: '#4fe3c1', retry: 0.3 };
// 꽃 피는 동안 자동 줍기 이어가기를 쉬는 시간(초, 임의값) (#110): 더미 하나 · 구역 전체
export const BLOOM_HOLD = { heap: 2.5, zone: 4 };
export const THROW_AIM = {
  range: 24, // 이 거리(수평) 안 대상을 겨눔 (#148: 16 → 24)
  power: 11, runBonus: 3, // 대상이 없을 때 보는 방향으로 던지는 힘 (달리면 더)
  k: 0.55, kMax: 1.4, // 위로 던지는 비율(수직/수평 속도). 높은 곳을 겨눌 땐 kMax 까지 올림
  vMin: 4, vMax: 24, // 겨눌 때 수평 속도 범위
  lead: 0.8, // 움직이는 대상은 날아가는 동안 갈 곳을 이만큼 미리 겨눔
  mark: 0.9, // 대상 발밑 표시 반지름(대상 크기 배율)
  edgeRange: 40, // 화면 밖 적을 가장자리 방향 표시로 알려 주는 거리(m)
};

// 전투 손맛 (#148, 모두 임의값). 타겟 고정은 game/throw.js, 유도는 src/homing.js, 적 돌진·물러남은 src/enemies.js
// 귤 모으는 범위 (#151): 떨어진 귤(적·더미·흩어진 귤, 튜토리얼 귤)은 이 안에 들면 저절로 빨려 와 모임.
// 배낭 단계마다 perBag 씩 넓어짐 (1단계 3.5m → 5단계 5.5m). 계산은 gearscore.js gyulPickR 하나 (#140 전리품 장비도 거기에 더함)
// 싸우는 중엔 COMBAT.autoPick 과 견줘 큰 쪽. suckT: 빨려 오는 시간(초)
export const GYUL_PICK = { r: 3.5, perBag: 0.5, suckT: 0.3 };

export const COMBAT = {
  detectHand: 28, detectPad: 8, losePad: 6, // 타겟을 잡는 거리: 손은 28m, 무기는 사거리 + detectPad. 잡은 타겟은 이만큼 더 멀어지면 놓음
  pickPx: 70, // 화면에서 적을 누를 때 이 픽셀 안이면 그 적으로 바꿈
  homeRate: Math.PI, homeT: 1.6, // 유도: 탄이 초당 도는 각(rad, 180°), 날아가는 동안 유도하는 시간 상한(초)
  homeRateBow: Math.PI * 1.5, // 활·총·머신건은 빨라서 조금 더 세게 돌림
  knockDist: 1.2, // 받혀 밀려나는 거리 (BOAR.knockSpeed ÷ knockDrag 로 맞춤)
  iframe: 2, blinkT: 1, // 받힌 뒤 다시 안 맞는 시간(초): 적이 몇 마리든 이 초에 한 번까지만 맞음 (#149). 깜빡임은 앞 blinkT 초만
  backT: 0.6, // 받은 적이 한 걸음 물러나는 시간(초, walk × 1.6 빠르기)
  windT: 0.7, windD: 5.5, // 돌진 조짐: 이 거리 안에서 멈춰 몸을 낮추는 시간(초)
  dashK: 1.5, dashT: 0.7, dashMin: 8, // 돌진: rush(없으면 chase) × dashK (최소 dashMin m/s), 최대 시간(초)
  staggerT: 1, crit: 2, // 비껴가면 비틀거림(초), 그때 맞히면 피해 × crit (급소)
  attackers: 2, ringR: 7, // 한 번에 덤비는 적 수. 나머지는 이 둘레에서 기다리며 돎 (#146 이 같은 값을 씀)
  flinchT: 0.35, flinchDist: 1.5, // 맞은 적이 멈칫하는 시간(초)·뒤로 밀리는 거리(m, ÷ 크기)
  lowHp: 0.3, holdT: 2, // 기운이 이 비율 아래면 적이 잠깐 머뭇거림(초, 한 싸움에 한 번)
  stuckT: 2, // 적에게 막혀 이 초 넘게 못 빠져나오면 적 사이로 지나갈 수 있음
  autoPick: 3.2, // 싸우는 중에는 이 거리 안 떨어진 귤을 자동으로 주움 (평소는 GYUL_PICK, 둘 중 큰 쪽 #151)
};

// 모아 쏘기 (#129): 던지기 버튼(F)을 길게 눌렀다 놓으면 더 센 한 방. 손·활·총·폭탄은 놓을 때 쏨(짧게 누르면 예전 한 발과 같음),
// 머신건·레이저는 누르는 동안 예전처럼 쏘고 놓는 순간 마무리(집중 연사·굵은 줄기). k = 모은 정도 0~1 (start 초부터 full 초까지)
// 피해·사거리·밀어내기는 1 에서 dmg·range·push 배로, 드는 양은 손 귤 0 → cost 개, 무기 한 발 몫 1 → cost 배 (모자라면 있는 만큼만 모임)
export const CHARGE = {
  start: 0.4, full: 1.2, // 이만큼 누르면 모으기 시작·가득 (초)
  dmg: 3, range: 1.3, push: 2.5, cost: 3,
  slow: 0.6, // 모으는 동안 이동 빠르기
  size: 1.9, // 가득 모은 탄 크기 배수 (손 귤·화살·총알·폭탄)
  mg: { n: 12, rate: 16, spread: 0.012 }, // 머신건 마무리: 가득이면 n 발을 초당 rate 로 (모은 만큼 n 이 줄어듦). 한 발 피해 × dmg 배, 탄은 한 발마다 드는 양 그대로 × cost 배
  laser: { t: 1, w: 3.2 }, // 레이저 마무리: 굵은 줄기 t 초(모은 만큼), 굵기 배수. 피해 × dmg 배, 귤은 그동안 gyulPerSec × cost 배
  bombR: 1.4, // 폭탄 반경 배수
  shakeT: 0.28, shake: 0.22, // 가득 모은 샷이 맞으면 화면 흔들림 (초·m)
  burst: 3, // 가득 모은 샷이 맞으면 즙 튀기를 이만큼 더 (저사양은 1)
  peerMs: 1500, // 다른 사람에게 보내는 센 샷 사건을 이 동안 실어 둠
};

// HP·쓰러짐·들것 귀환 (#36). 전투 오름에서만
export const HP = {
  max: 100,
  regenDelay: 5, regen: 5, // 이 초 동안 안 맞으면 초당 regen 씩 회복 (#148: 8 → 5)
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
// sec: 버프 시간(없으면 buffSec). 모든 메뉴는 늘 살 수 있음 (#98: 깨끗한 오름이 없어져 battle 갈래를 뺌)
export const STONE = {
  buffSec: 600,
  menu: [
    { id: 'pasta', ko: '시그니처 매콤 크림 파스타', en: 'Signature Spicy Cream Sauce Pasta', price: 190, buff: 'speed', v: 0.2, food: '#f2a65a' },
    { id: 'gnocchi', ko: '시그니처 새우 비스큐 뇨끼', en: 'Signature King Prawn Bisque Gnocchi', price: 200, buff: 'bag', v: 0.3, food: '#e0703c' },
    { id: 'steak', ko: '시그니처 포크 스테이크', en: 'Signature Pork Steak', price: 290, buff: 'dmg', v: 0.5, food: '#7a4a2c' },
    { id: 'pizza', ko: '마르게리따', en: 'Pizza Margherita', price: 180, buff: 'pick', v: 0.25, food: '#e8b04a' },
    { id: 'salad', ko: '하우스 리코타 샐러드', en: 'House Ricotta Salad', price: 100, buff: 'regen', v: 2, food: '#7fb65a' },
    { id: 'ade', ko: '플럼 에이드', en: 'Plum Ade', price: 50, buff: 'speed', v: 0.1, sec: 300, food: '#c2416b', drink: true },
    { id: 'vin', ko: '귤 뱅쇼', en: 'Gyul Vin Chaud', price: 80, buff: 'regen', v: 2, food: '#a8323a', drink: true, season: 'xmas', glow: true }, // 크리스마스 한정 (#180): 철 기간에만 메뉴에 나옴. glow = 화면 가장자리 따뜻한 빛
  ],
  // 자리: 가게 거리(#57) 터 SHOPS 의 lot. 앞(테라스)이 골목 너머 개울·바다(서쪽)를 봄
  s: 8, // Tripo 모델 배율 (#71). 모델 안 자리는 stone.js M
  W: 7.2, D: 7.8, // 테라스까지 넣은 폭·깊이 (모델 크기 × s)
  r: 7, // 테라스 가운데에서 이 거리 안이면 상호작용이 '식사'
  eatT: 4.5, // 먹는 연출 (건너뛸 수 있음)
  walkMax: 3, // 자리까지 걸어가다 이 초가 넘으면 바로 앉힘
};

// 만족한상회 (#167): 가게 거리 6번 터(골목 끝)의 갈치 식당. 스톤과 같은 '식사 → 버프' (식당 공통 틀, 버프는 한 번에 하나). 메뉴·값·버프 모두 임의
// buff: guard 받는 피해 줄이는 비율 · gyulR 귤 모이는 범위 더하는 m. also: 같이 붙는 버프 { 종류: v }. 건물은 코드로 만든 임시 모양 src/manjok.js
export const MANJOK = {
  name: '만족한상회', tag: '갈치는 뼈가 없고, 당신은 귤이 없다',
  buffSec: 600,
  menu: [
    { id: 'manjok', ko: '만족한상', en: '순살 은갈치 조림', price: 260, buff: 'guard', v: 0.2, food: '#c8452c' },
    { id: 'tonggalchi', ko: '통갈치한상', en: '통갈치 조림 한상', price: 320, buff: 'dmg', v: 0.3, also: { speed: 0.1 }, food: '#b83a26' },
    { id: 'galchigui', ko: '갈치구이', en: '은갈치 구이', price: 180, buff: 'pick', v: 0.2, food: '#d9c9a8' },
    { id: 'godeungeo', ko: '고등어구이', en: '고등어 구이', price: 150, buff: 'regen', v: 2, food: '#8a7a5a' },
    { id: 'hwanggae', ko: '제주 황게장', en: '간장 게장', price: 220, buff: 'gyulR', v: 1, food: '#e0902c' },
  ],
  W: 6.6, D: 4.4, H: 2.5, // 돌집 폭·깊이·처마 높이 (m)
  fore: 3.4, // 터 앞에서 집 앞벽까지 (평상 자리)
  r: 6.5, // 평상 가운데에서 이 거리 안이면 상호작용이 '식사'
  eatT: 4.5, walkMax: 3,
};
export const MEALS = [...STONE.menu.map((m) => ({ ...m, shop: 'stone' })), ...MANJOK.menu.map((m) => ({ ...m, shop: 'manjok' }))]; // 모든 식당 메뉴 (버프 찾기, id 는 겹치지 않게)

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
    { s: 23, side: -1, w: 10, d: 9 }, // 4 장비점 (#128)
    { s: 37, side: 1, w: 17, d: 11 }, // 5 스톤 (앞에 아무것도 없어 개울이 보임)
    { s: 51.1, side: 0, w: 10, d: 9 }, // 6 만족한상회 (#167, 골목 끝)
  ],
  clearPad: 3, // 터·골목 둘레 이만큼 더 나무·바위를 비움
  bound: 12, // 바깥 돌담이 터 둘레 이만큼 바깥으로 돌아감
  keepPad: 22, // 거리 둘레 이만큼 몹이 나오지 않음 (쓰레기 더미는 오름에만이라 원래 없음)
  // 골목 가장자리 꾸밈 [s, 쪽(1 오름 쪽 / -1 시작 쪽)]: 터 앞을 막지 않는 틈에만
  lamps: [[3, 1], [30, -1], [44, -1]],
  benches: [[33.5, -1], [39.5, -1]],
  planters: [[4.5, -1], [17, 1], [17, -1], [28.2, -1]],
  markFar: 160, markNear: 16, // 화면 가장자리 가게 아이콘: 이 거리 사이, 가장 가까운 가게 하나만
  // 지붕 위 큰 아이콘 간판 (#128·#182): 자리는 건물(모델 경계 상자) 가운데 위, 높이는 건물 꼭대기 + 간판 반지름 + roofGap(m). 크기 roofSize(m). 살 수 있는 새 물건이 있으면 귤색 점
  roofSize: 2.3, roofGap: 0.6, roofPole: 0.07, // roofPole: 간판을 받치는 현무암 기둥 반지름
  roofMinPx: 28, roofMaxK: 2.6, // 화면에서 최소 이 px 로 보이게 멀수록 키움 (최대 roofSize × roofMaxK)
  roofSee: [8, 16, 28], roofSeeH: 3.5, roofNear: 30, roofFade: 0.82, roofTopNear: 12, roofTopFar: 70, // 둘레 이 거리(m)·눈높이에서 가려지면 그 간판만 맨 위에 그림(roofTopNear~roofTopFar 사이만: 가게 바로 앞에선 앞 간판을 덮지 않게), roofNear 안에선 roofFade 만큼 투명
  roofGlow: 0.5, // 밤 간판 뒤 따뜻한 빛 세기
  dirR: 3.4, // 들머리 '가게 안내도' 판 앞 이 거리 안이면 상호작용 '가게 안내'
  cartHintR: 9, // 정상·능선 클린하우스 이 거리 안에서 버리고 나면 '가게 거리 가는 마차' 안내 (세션에 한 번)
};
// 장비점 (#128): 가게 거리 4번 터의 철물점 (임시 모양 src/hardware.js). 도구·배낭·무기를 판다. 이름은 실제 가게가 정해지면 바꿈
export const GEAR_SHOP = { name: '장비점', W: 7.4, D: 5.8, fore: 0.6, r: 6.5 };
// 가게 목록: 한 줄 = 가게 하나. lot = 위 SHOP_ST.lots 번호(1부터). act = 상호작용 이름, ic = 상호작용 아이콘, pop = 여는 팝업
// 건물 모양은 src/shops.js SHOP_BUILD[id], 가장자리 아이콘은 SHOP_ICON[id]. 줄이 없는 터는 빈 터('준비 중' 팻말)
// sells = 가게 안내(#128)에 보이는 파는 것
export const SHOPS = [
  { id: 'gear', name: GEAR_SHOP.name, lot: 4, act: '장비', ic: 'gear', pop: 'gear', sells: '집게·배낭·무기' }, // #128 (임시 모양)
  { id: 'leap', name: 'LEAP', lot: 2, act: '옷', ic: 'wear', pop: 'leap', sells: '옷·신발' },
  { id: 'salon', name: '루이네 미장원', lot: 1, act: '머리', ic: 'cut', pop: 'salon', sells: '머리 모양' },
  { id: 'ride', name: '탈것 가게', lot: 3, act: '탈것', ic: 'ride', pop: 'ride', sells: '탈것' }, // #69 (임시 모양)
  { id: 'stone', name: 'Stone', lot: 5, act: '식사', ic: 'eat', pop: 'stone', sells: '식사·버프' },
  { id: 'manjok', name: '만족한상회', lot: 6, act: '식사', ic: 'eat', pop: 'manjok', sells: '갈치 식사·버프' }, // #167 (코드로 만든 임시 모양)
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
  s: 4.8, // Tripo 모델 배율 (#71). 모델 안 자리는 salon.js M
  W: 4.3, D: 4.7, fore: 0.3, // 드럼통까지 넣은 폭·깊이 (모델 × s), 터 앞에서 모델 앞끝까지
  r: 6, // 문 앞에서 이 거리 안이면 상호작용이 '머리'
  walkMax: 4, // 문 앞까지 걸어가다 이 초가 넘으면 바로 앉힘
  cutT: 3, // 가위질 연출 (건너뛸 수 있음)
  snipHz: 3.2, // 초당 가위질
};

// LEAP (#59): 가게 거리 2번 터의 러닝 편집숍. 옷(WEAR·CLOTHES)과 신발(SHOES)을 귤로 삼. 가판대에는 도구·배낭·무기만
export const LEAP = {
  s: 6.2, // Tripo 모델 배율 (#71). 모델 안 자리는 leap.js M
  W: 6.1, D: 6.1, fore: 0.3, // 앞 디딤판까지 넣은 폭·깊이 (모델 × s), 터 앞에서 모델 앞끝까지
  r: 6, // 문 앞에서 이 거리 안이면 상호작용이 '옷'
  slots: ['shoes', 'hat', 'top', 'bottom', 'vest', 'jacket', 'socks'], // 팝업 칸 순서 (신발이 맨 앞)
};

// 옷 (#52): 입는 것마다 능력치. 겉모습과 능력치가 묶여 있음 (입은 것이 곧 능력). 도구·배낭·신발·무기는 위 표 그대로
// 칸마다 0(없음)~5단계. 같은 단계 옷은 능력이 같고 모양만 다름. #179 부터 능력은 칸마다 가진 옷 중 가장 좋은 것, 겉모습은 가진 옷 아무거나 (wear)
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
  price: GROWTH.price.slice(0, 6).map((p, t) => t < 2 ? 0 : Math.round(p * GROWTH.wearK)), // 단계별 값 (#137: 장비와 같은 곡선 × wearK). 모자·티셔츠·바지 1단계는 처음부터 가짐
  priceNone1: Math.round(GROWTH.price[1] * GROWTH.wearK), // 없음에서 시작하는 칸(베스트·잠바·양말)의 1단계
  tierColor: ['#7b7b80', '#9a9a94', '#5aa55a', '#4a86c8', '#9a6ad0', '#f29a2e'], // 단계 색: 없음·회색·초록·파랑·보라·귤색
  styleColor: '#e07aa0', // 겉모습 옷(#179, 능력 없음) 테두리 색
};
// 옷 목록: 한 줄이 옷 한 벌. 단계마다 옷을 늘리려면 여기에 줄만 더하면 됨 (같은 단계 = 같은 능력, 모양은 look)
// look 은 src/clothes.js 가 읽는 모양 값: kind 모양 종류, main 바탕색, acc 포인트색, 그 밖은 종류마다 (stripe 줄무늬색 등)
export const CLOTHES = [
  // 모자: 머리 위에 같이 씀
  { id: 'hat:w-cap', slot: 'hat', tier: 1, name: '기본 모자', look: { kind: 'cap', main: '#5c9a3c', acc: '#4a8030' } },
  { id: 'hat:w-straw', slot: 'hat', tier: 2, name: '밀짚모자', look: { kind: 'straw', main: '#e3c77d', acc: '#b5482f' } },
  { id: 'hat:w-bucket', slot: 'hat', tier: 3, name: '버킷햇', look: { kind: 'bucket', main: '#3f78c0', acc: '#f2efe6' } },
  { id: 'hat:w-hike', slot: 'hat', tier: 4, name: '챙 넓은 등산 모자', look: { kind: 'boonie', main: '#6f7f4a', acc: '#9a6ad0', cord: '#2b2b33' } },
  { id: 'hat:p-box', slot: 'hat', tier: 3, name: '감귤 박스 헬멧', guard: 0.05, desc: '머리는 차갑게, 귤은 따뜻하게', look: { kind: 'box', main: '#c89a5e', acc: '#f29a2e', ink: '#6a4a2a' } }, // 오름펑크 (#164): 모자 3단계 능력 + 받는 피해 -5%, 쓰면 박스 시야
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
  // 겨울 옷 (#180 크리스마스): season 이 있으면 그 철 기간에만 LEAP 겨울 진열대에 나옴 (가진 것은 언제든 입음). 일부는 접속 달력·산타 투기꾼 선물 (SEASON.xmas)
  { id: 'hat:x-santa', slot: 'hat', tier: 2, name: '산타 모자', season: 'xmas', look: { kind: 'santa', main: '#c8333a', acc: '#f6f2ea' } },
  { id: 'hat:x-rudolph', slot: 'hat', tier: 2, name: '루돌프 머리띠', season: 'xmas', look: { kind: 'antler', main: '#8a5a36', acc: '#c8333a' } },
  { id: 'top:x-ugly', slot: 'top', tier: 3, name: '못생긴 스웨터', season: 'xmas', look: { kind: 'tee', long: true, main: '#b5333a', acc: '#2f7a4a', stripes: 2, gyul: '#f29a2e', collar: '#f6f2ea' } },
  { id: 'socks:x-boots', slot: 'socks', tier: 3, name: '빨간 장화', season: 'xmas', look: { kind: 'socks', main: '#c8333a', acc: '#f6f2ea', h: 0.2, thick: true } },
  { id: 'vest:x-scarf', slot: 'vest', tier: 2, name: '목도리', season: 'xmas', look: { kind: 'scarf', main: '#c8333a', acc: '#f6f2ea' } },
];
// 겉모습 옷 (#179): 능력 없는 옷(tier 0). 값은 price 로 따로. 능력은 칸마다 가진 옷 중 가장 좋은 것이 정하고(gearscore.js abilityCloth), 겉모습은 가진 옷 아무거나(save.clothes.wear)
// set: 한 벌 맞춤 묶음(OUTFIT_SETS), tint: 색 바꾸기 가능(LOOK_COLORS.style, 저장 save.clothes.tint = { id: 번호 }), fresh: LEAP '새로 들어온 것' 탭에 나오는 날
// 얼굴(선글라스)은 모자 칸, 등(귤 바구니)은 베스트 칸에 넣음 (칸을 늘리지 않음). 모양 새 kind 는 src/clothes2.js, 그림은 clothicons.js
export const STYLE_CLOTHES = [
  // 모자 11 (선글라스 포함)
  { id: 'hat:s-goggle', slot: 'hat', price: 300, name: '해녀 물안경', set: 'haenyeo', desc: '이마에 걸면 숨이 길어지는 기분', look: { kind: 'goggle', main: '#2b2f3a', acc: '#8fd0e8' } },
  { id: 'hat:s-beanie', slot: 'hat', price: 250, name: '감귤 꼭지 비니', set: 'farmer', tint: true, desc: '머리 위에 귤 꼭지 하나', look: { kind: 'beanie', main: '#f29a2e', acc: '#3f9a5a' } },
  { id: 'hat:s-harubang', slot: 'hat', price: 600, name: '돌하르방 모자', desc: '쓰면 표정이 근엄해짐 (기분 탓)', look: { kind: 'harubang', main: '#6b6a66', acc: '#4f4e4a' } },
  { id: 'hat:s-halfgyul', slot: 'hat', price: 450, name: '귤 반쪽 헬멧', desc: '속은 비었어요. 먹은 게 아니에요', look: { kind: 'halfgyul', main: '#f29a2e', acc: '#fff4e0' } },
  { id: 'hat:s-gat', slot: 'hat', price: 900, name: '말총 갓', desc: '제주 말총으로 엮은 선비 갓', look: { kind: 'gat', main: '#1d1d22', acc: '#3a3a40' } },
  { id: 'hat:s-chef', slot: 'hat', price: 350, name: '요리사 모자', desc: '스톤 주방장 몰래 빌려 옴', look: { kind: 'chef', main: '#f6f4ee', acc: '#e4e0d6' } },
  { id: 'hat:s-hard', slot: 'hat', price: 300, name: '안전모', set: 'clean', tint: true, desc: '쓰레기 산 앞에서는 안전 제일', look: { kind: 'hardhat', main: '#f2c94c', acc: '#e8ecef' } },
  { id: 'hat:s-lamp', slot: 'hat', price: 400, name: '캠핑 헤드랜턴', desc: '불은 안 켜져요. 마음이 밝아짐', look: { kind: 'lamp', main: '#2b2f3a', acc: '#fff3a0' } },
  { id: 'hat:s-antenna', slot: 'hat', price: 500, name: '외계인 더듬이', set: 'alien', desc: '귤 신호를 잡는 중', look: { kind: 'antenna', main: '#7ad65a', acc: '#c8f26a' } },
  { id: 'hat:s-paperbag', slot: 'hat', price: 150, name: '종이봉투', desc: '오늘은 아무도 날 못 알아봄', look: { kind: 'paperbag', main: '#c9a86a', acc: '#1c1712' } },
  { id: 'hat:s-shades', slot: 'hat', price: 300, name: '선글라스', set: 'tourist', tint: true, desc: '모자 칸에 쓰는 얼굴 장식', look: { kind: 'shades', main: '#1d1d22', acc: '#f29a2e' } },
  // 티 8
  { id: 'top:s-unpaid', slot: 'top', price: 250, name: "'오늘도 무급' 티", tint: true, desc: '오름지기 자원봉사 공식 티', look: { kind: 'tee2', main: '#ece6d8', acc: '#3a3a40', print: '#3a3a40' } },
  { id: 'top:s-aloha', slot: 'top', price: 450, name: '하와이안 셔츠', set: 'tourist', desc: '제주에서 하와이 느낌', look: { kind: 'tee2', main: '#3fa8b8', acc: '#f6efe0', flowers: '#f6efe0', collar: '#f6efe0' } },
  { id: 'top:s-hallabong', slot: 'top', price: 350, name: '한라봉 무늬 티', desc: '꼭지까지 그려 넣음', look: { kind: 'tee', main: '#fff4e0', acc: '#f29a2e', gyul: '#f29a2e' } },
  { id: 'top:s-tank', slot: 'top', price: 200, name: '멜빵 러닝', tint: true, desc: '팔이 시원해요', look: { kind: 'tank', main: '#f6f4ee', acc: '#c4513f' } },
  { id: 'top:s-haenyeo', slot: 'top', price: 500, name: '줄무늬 해녀복 상의', set: 'haenyeo', desc: '고무옷에 주황 줄', look: { kind: 'tee', long: true, main: '#1d1d22', acc: '#f2722c', stripes: 3, collar: '#f2722c' } },
  { id: 'top:s-tour', slot: 'top', price: 200, name: '관광버스 단체 티', desc: '3호차 놓치지 마세요', look: { kind: 'tee2', main: '#f2d83a', acc: '#2f62b8', print: '#2f62b8', num: true } },
  { id: 'top:s-neonrun', slot: 'top', price: 400, name: '형광 러닝복', tint: true, desc: '밤에도 보여요', look: { kind: 'tee', main: '#c8f24a', acc: '#2b2f3a', panel: true } },
  { id: 'top:s-ilove', slot: 'top', price: 300, name: "'I ♥ 쓰레기 줍기' 티", set: 'clean', desc: '진심입니다', look: { kind: 'tee2', main: '#f6f4ee', acc: '#c8333a', heart: '#c8333a', print: '#3a3a40' } },
  // 바지 6
  { id: 'bottom:s-mombbe', slot: 'bottom', price: 350, name: '꽃무늬 몸뻬', set: 'farmer', tint: true, desc: '귤밭 일등 작업복', look: { kind: 'mombbe', main: '#8a4fa0', acc: '#6e3a82', dots: '#f6c0d8' } },
  { id: 'bottom:s-rubber', slot: 'bottom', price: 400, name: '해녀 고무 바지', set: 'haenyeo', desc: '물에 들어가도 끄떡없음', look: { kind: 'long', main: '#1d1d22', acc: '#f2722c', belt: true } },
  { id: 'bottom:s-ripped', slot: 'bottom', price: 450, name: '찢어진 청바지', set: 'punk', desc: '돌담에 걸린 게 아니에요', look: { kind: 'long', main: '#4a6fa8', acc: '#3a5a8a', rips: '#dfe6ef' } },
  { id: 'bottom:s-leggings', slot: 'bottom', price: 300, name: '형광 레깅스', set: 'alien', tint: true, desc: '우주복 아래 입는 것', look: { kind: 'long', main: '#7ad65a', acc: '#5cb840', tight: true } },
  { id: 'bottom:s-check', slot: 'bottom', price: 300, name: '체크 반바지', set: 'tourist', desc: '공항에서 바로 갈아입음', look: { kind: 'shorts', main: '#c4513f', acc: '#f2efe6', check: true } },
  { id: 'bottom:s-overall', slot: 'bottom', price: 500, name: '멜빵 작업 바지', desc: '주머니에 집게 하나 꽂고', look: { kind: 'long', main: '#4a5a78', acc: '#e0b23a', bib: true, pockets: true } },
  // 베스트·잠바 9 (귤 바구니는 등에 메는 것이라 베스트 칸)
  { id: 'vest:s-safety', slot: 'vest', price: 300, name: '형광 안전 조끼', set: 'clean', desc: '멀리서도 줍깅 중인 게 보임', look: { kind: 'vest', main: '#ff7a1f', acc: '#e8ecef', bands: true } },
  { id: 'vest:s-photo', slot: 'vest', price: 500, name: '주머니 12개 사진 조끼', desc: '주머니마다 귤 하나씩', look: { kind: 'vest', main: '#b8a878', acc: '#8d7d50', pockets: 12 } },
  { id: 'vest:s-padding', slot: 'vest', price: 450, name: '패딩 조끼', tint: true, desc: '한라산 바람 막이', look: { kind: 'vest', main: '#2b2f3a', acc: '#4a4e58', puff: true } },
  { id: 'vest:s-punk', slot: 'vest', price: 600, name: '가죽 펑크 조끼', set: 'punk', desc: '징이 박힌 오름펑크 조끼', look: { kind: 'vest', main: '#1d1d22', acc: '#c9ccd2', studs: true } },
  { id: 'jacket:s-raincoat', slot: 'jacket', price: 400, name: '노랑 우비', desc: '제주 날씨는 모르는 거니까', look: { kind: 'jacket', main: '#f2d03a', acc: '#d8b020', hood: true, cuffs: true, hem: true } },
  { id: 'jacket:s-durumagi', slot: 'jacket', price: 900, name: '한복 두루마기', desc: '오름에 마실 나온 선비', look: { kind: 'jacket', main: '#e8e2d0', acc: '#3f5a8a', hem: true, goreum: true } },
  { id: 'jacket:s-glow', slot: 'jacket', price: 600, name: '야광 러닝 자켓', set: 'alien', desc: '어두우면 더 빛나는 기분', look: { kind: 'jacket', main: '#b8f04a', acc: '#2b2f3a', bands: true, cuffs: true } },
  { id: 'vest:s-boxarmor', slot: 'vest', price: 350, name: '귤 상자 갑옷', desc: '골판지 두 겹, 방어력은 기분', look: { kind: 'boxarmor', main: '#c89a5e', acc: '#f29a2e', ink: '#6a4a2a' } },
  { id: 'vest:s-basket', slot: 'vest', price: 450, name: '등에 멘 귤 바구니', set: 'farmer', desc: '등에 메는 장식 (베스트 칸)', look: { kind: 'basket', main: '#b8915a', acc: '#f29a2e' } },
  // 양말·신발 6 (신발은 신발 칸 그대로, 이건 양말 칸 겉모습)
  { id: 'socks:s-toe', slot: 'socks', price: 150, name: '발가락 양말', desc: '발가락마다 다른 색', look: { kind: 'socks', main: '#f6f4ee', acc: '#e090a8', h: 0.11, toes: true } },
  { id: 'socks:s-odd', slot: 'socks', price: 200, name: '짝짝이 양말', set: 'punk', desc: '일부러 그런 거예요', look: { kind: 'oddsocks', main: '#c4513f', acc: '#2f62b8', h: 0.15 } },
  { id: 'socks:s-rainbow', slot: 'socks', price: 250, name: '무지개 양말', desc: '비 온 뒤 오름처럼', look: { kind: 'socks', main: '#c4513f', acc: '#3a3a40', h: 0.17, rainbow: true } },
  { id: 'socks:s-gomusin', slot: 'socks', price: 350, name: '고무신', desc: '신발 위에 신는 마음의 고무신', look: { kind: 'socks', main: '#f6f4ee', acc: '#d8d4ca', h: 0.06, rim: true } },
  { id: 'socks:s-slipsock', slot: 'socks', price: 150, name: '쓰레빠엔 흰 양말', desc: '제주 동네 패션의 완성', look: { kind: 'socks', main: '#f6f4ee', acc: '#3f78c0', h: 0.15, stripes: 2 } },
  { id: 'socks:s-furboot', slot: 'socks', price: 600, name: '털 장화', desc: '눈 오는 오름 필수', look: { kind: 'socks', main: '#8a6a3c', acc: '#f2ece0', h: 0.17, thick: true, fur: true } },
].map((c) => ({ tier: 0, style: true, fresh: '2026-11-21', ...c }));
CLOTHES.push(...STYLE_CLOTHES);
// 한 벌 맞춤 (#179): 같은 묶음 3벌을 겉모습으로 입으면 캐릭터 둘레 작은 효과(src/game/outfitset.js) + 칭호(#165 에서 씀). 능력은 없음
export const OUTFIT_SETS = [
  { id: 'haenyeo', name: '해녀', title: '물질 장인', fx: '#8fd0e8', items: ['hat:s-goggle', 'top:s-haenyeo', 'bottom:s-rubber'] },
  { id: 'punk', name: '오름펑크', title: '오름펑크', fx: '#d0d3d8', items: ['vest:s-punk', 'bottom:s-ripped', 'socks:s-odd'] },
  { id: 'clean', name: '환경미화', title: '줍깅 반장', fx: '#ff8a2a', items: ['hat:s-hard', 'top:s-ilove', 'vest:s-safety'] },
  { id: 'tourist', name: '관광객', title: '혼저옵서예', fx: '#5ad0e0', items: ['hat:s-shades', 'top:s-aloha', 'bottom:s-check'] },
  { id: 'alien', name: '외계인', title: '지구 견학 중', fx: '#9af06a', items: ['hat:s-antenna', 'bottom:s-leggings', 'jacket:s-glow'] },
  { id: 'farmer', name: '귤 농부', title: '귤밭 주인', fx: '#ffb347', items: ['hat:s-beanie', 'bottom:s-mombbe', 'vest:s-basket'] },
];
export const SET_FX = { n: 8, lowN: 5, r: 0.75, y: 0.8, spin: 0.9, bob: 0.12, size: 0.16, step: 0.6 }; // 둘레 효과: 점 수(저사양), 반지름·높이(m), 도는 빠르기(rad/s), 위아래, 점 크기, 번갈아 높이
export const WEAR_START = { hat: 'hat:w-cap', top: 'top:w-tee', bottom: 'bottom:w-shorts' }; // 처음 차림 (신발 1단계 쓰레빠는 SHOES)
export const wearPrice = (c) => c.price != null ? c.price : c.tier === 1 && WEAR.slots.find((s) => s.k === c.slot)?.none ? WEAR.priceNone1 : WEAR.price[c.tier];

// 배경 음악 (#64). 코드로 만드는 소리(music.js). gain 은 효과음(1)에 견준 음악 버스 크기
export const MUSIC = {
  gain: 0.6,         // 크기 100% 일 때 음악 버스 (효과음보다 작게). 크기 슬라이더는 제곱으로 들어감
  tense: 1.6,        // 긴장 음악 층 크기 (평소 층 1 에 견줘)
  vol: 0.6,          // 처음 크기 (0~1)
  fadeIn: 2.5,       // 적이 다가오면 긴장 음악으로 바뀌는 시간(초)
  holdOut: 5,        // 적이 사라지고 원래 음악으로 돌아가기까지 기다리는 시간(초)
  fadeOut: 4,        // 원래 음악으로 돌아가는 시간(초)
  near: 30,          // 이 거리 안의 몹·멧돼지·투기꾼·트럭이면 '적 근처'
  duck: 0.45,        // 가게 안 식사·머리 손질 중 음악 배율
  nightK: 0.35,      // setDaylight 값이 이보다 작으면 밤 분위기
  chord: { day: 9, night: 12 },        // 화음 하나 길이(초)
  note: { day: [2.5, 6], night: [4, 9] }, // 드문드문 음 사이 간격(초)
  bpm: 92,           // 긴장 음악 빠르기
};

// 연출 감독 (#89, src/pacing.js): 힐링 시간(줍기·꽃·낚시)이 바탕이고 공격 시간(투기꾼·트럭·몹)은 짧고 또렷한 사건
// 한 번 공격 = 조짐(omen 초: 방향 표시·음악·새가 날아오름) → 긴장(나타나서 쫓아낼 때까지, attack 초 안) → 쉼(rest 초 동안 새 적 없음)
// gap: 공격 시작에서 다음 공격 시작까지(초) [최소, 최대]. 꽃이 피면 bloomQuiet 초 동안 적이 끼어들지 않음
// battle: 전투 오름(몹 물결, dumpEvery 번째마다 투기꾼도 같이). 구역이 깊을수록 무리가 큼(group). 깨끗한 오름(clean)은 #98 에서 없앰
// 첫 공격: 튜토리얼 뒤 더미를 한 번 치워 꽃을 피운 다음 firstDelay 초 뒤, 약한 투기꾼 하나
// 보상: 다 쫓아내면 귤 bonus(나머지는 그 1/3), 그리고 rest 초 쉼
// 지루함: calmMax 초 넘게 아무 일이 없으면 작은 즐거움 하나 (드문 쓰레기 반짝임·노루가 지나감·반딧불이 떼·잭팟 조짐)
// 전환(tension 0~1): riseT 초에 걸쳐 오르고 fallT 초에 걸쳐 내려감. 화면 가장자리 색 edge, 카메라 거리 camIn 만큼 가까이, 하늘 sky 만큼 어둡게
export const PACE = {
  omen: 3,
  attack: [30, 90],
  rest: 90,
  bloomQuiet: 10,
  calmMax: 180,
  firstDelay: 25,
  battle: { gap: [180, 240], bonus: 9, dumpEvery: 2, group: { 1: [1, 2], 2: [2, 2], 3: [2, 3], 4: [2, 3], 5: [3, 3] } },
  truckMax: 140, // 트럭 한 번에 쌓는 최대 (방금 치운 보람을 지우지 않게. 투기꾼이 두 번에 한 번이라 시간당 양이 줄고 몹이 헤집는 쓰레기가 더해짐)
  near: 140, // 투기꾼이 노릴 더미: 플레이어에서 이 거리 안을 먼저 (보이는 곳에서 사건이 일어나게)
  protect: 600, // 방금(이 초 안에) 다 치운 더미에는 투기꾼이 다시 쌓지 않음
  busyWait: 20, // 낚시·가게·마차·튜토리얼 중이면 공격을 이 초씩 미룸
  riseT: 3, fallT: 5,
  edge: 0.6, camIn: 0.1, sky: 0.12,
  hitStop: 0.06, hitStopK: 0.08, // 맞혔을 때 짧은 멈춤(초)·그동안 시간 배율
  combo: { gap: 1.6, max: 10 }, // 줍기 콤보: 이 초 안에 이어 주우면 음이 한 칸씩 올라감 (최대 칸)
  bloomLayer: { heap: 14, zone: 32 }, // 꽃이 피면 음악에 한 겹 더해지는 시간(초)
  delight: { luckyT: 60, luckyMul: 8, deerT: 45, flyT: 40 },
};

// 탐방로 선 모양 (#67). 길이는 실제 m. trailshape.js 가 이 값으로 nsPaths 를 만든다
export const TRAIL = {
  step: 4,      // 내보내는 선의 점 간격 (곡선도 이 간격이면 매끈하게 보임)
  sigma: 9,     // 꺾인 곳 둥글리기 정도 (가우스 너비). 클수록 큰 곡선 (90° 꺾임이 반지름 약 12m 곡선)
  yStem: 24,    // 굼부리 가는 길 갈림길: 둘레에서 이만큼 앞에서 두 갈래로 갈라짐 (북쪽 길은 첫 조절점에서)
  yAng: 26,     // 두 갈래가 둘레에 붙는 자리 (갈림점 쪽 둘레 점에서 ± 중심각, 도)
  yPull: 0.42,  // 갈래 곡선 휨 (두 끝 사이 거리에 대한 비율)
  uR: 9,        // 능선 북쪽 끝 되돌아 나오는 U 자 머리 반지름
};

// 첫 화면 (#72): 정상 표지석을 가운데 두고 천천히 도는 카메라
// 카메라 위아래 범위 (#170). 걸을 때와 탈 때(노루·탈것·마차) 같은 범위로 올려다보고, 탈 때만 조금 더 내려다봄
export const CAM = {
  pitchMin: -0.6, pitchMax: 1.25, // 끌어서 돌리는 위아래 각도(라디안). -0.6 이면 평지에서 화면 위 대부분이 하늘
  ridePitchMax: 1.4, // 탈 때만 더 내려다봄
  rideDist: 1.15, // 탈 때 카메라 거리 배율 (노루가 화면을 덜 가림). 내리면 1 로 서서히
  rideDistK: 3, // 거리 배율이 바뀌는 빠르기 (1/초)
};
export const TITLE = {
  r: 650,       // 표지석에서 카메라까지 수평 거리(m)
  up: 30,       // 표지석보다 이만큼 높이
  lookUp: -40,  // 바라보는 곳 높이 (표지석 기준)
  spin: 0.035,  // 도는 빠르기 (rad/초)
  notes: 3,     // 첫 화면에 보이는 최근 릴리스 노트 줄 수
};
// 첫 화면 UFO (#150): 시작 전 하늘을 가로지르는 비행접시. 시작하면 사라짐
export const UFO = {
  first: 2,       // 첫 화면이 뜨고 처음 나타나기까지(초)
  cross: 6,       // 화면을 가로지르는 시간(초)
  gap: [20, 30],  // 그 뒤 다시 지나가는 간격(초, 이 사이 아무 값)
  dist: 120,      // 카메라에서 떨어진 거리(m). 장면 안 하늘에 떠 보이게
  size: 0.14,     // 접시 지름 = 화면 높이의 이 비율
  sizeW: 0.3,     // 다만 화면 폭의 이 비율을 넘지 않게 (폰 세로)
  bob: 0.12,      // 위아래 흔들림(지름 배율)
};

// 사진사 NPC (#70): 정상 표지석 근처에 삼각대를 세워 두고, 상호작용하면 사진을 찍어 줌. 무료
export const PHOTOG = {
  name: '즈랭',   // 이름표 (임시)
  dist: 8.5,      // 표지석·사진 자리 가운데에서 삼각대까지 (바깥쪽, 수평)
  side: 0.5,      // 삼각대를 옆으로 조금 비킴
  camH: 2.1,      // 삼각대 카메라 높이 (땅에서)
  minH: 1.6,      // 카메라는 표지석 쪽 땅보다 적어도 이만큼 위 (내리막이면 삼각대 다리가 길어짐)
  maxLeg: 3.6,    // 삼각대 다리 최대 길이
  stand: 1.4,     // 사진사는 삼각대 옆 이만큼에 섬
  r: 7,           // 이 안에 오면 상호작용이 '사진'
  beckon: 1.6,    // 손짓하는 시간(초)
  walkMax: 6,     // 사진 자리까지 걸어가는 최대 시간(초). 넘거나 막히면 바로 자리에 섬
  greetR: 12,     // 이 안에 오면 가끔 손 흔들며 한마디
  greetCd: 35,    // 한마디 간격(초, 무작위 더함)
  animR: 90,      // 이보다 멀면 움직임 계산을 쉼 (저사양)
  count: 0.9,     // 3·2·1 한 칸 시간(초)
  lines: ['사진 찍어 드릴까요?', '여기 빛이 제일 좋아요!', '오늘 오름 진짜 예쁘다', '웃어요~ 김치!'],
};

// 탈것 (#69): 귤로 사고 버튼 하나로 타고 내림. 속도 = base(달리기) × 배율 (신발·식사 버프는 곱하지 않음). 값은 임의
// up 0 = 오르막은 못 탐 (옆구리에 들고 걷기 carry 속도). glide = 관성(손을 떼도 미끄러짐, 천천히 붙고 천천히 멎음)
export const RIDES = {
  list: [
    { id: 'skate', name: '스케이트보드', price: 1500, flat: 1.3, up: 0, down: 2.0, glide: true },
    { id: 'scoot', name: '스쿠터', price: 4000, flat: 1.6, up: 1.3, down: 1.8 },
    { id: 'horse', name: '조랑말', price: 8000, flat: 1.9, up: 1.7, down: 1.9 },
  ],
  base: 10,       // 달리기 속도 (main.js)
  off: 0.7,       // 길(탐방로·들머리 길·가게 골목) 밖 풀밭·숲
  grade: 0.08,    // 이 기울기(높이/거리)에서 오르막·내리막 배율을 다 씀 (그 사이는 섞음)
  carryIn: 0.07, carryOut: 0.04, // 스케이트보드: 이 기울기 넘으면 들고 걷고, 이 아래로 내려오면 다시 탐
  carry: 5,       // 들고 걷는 속도 (걷기)
  accel: 5,       // 속도가 따라붙는 빠르기
  glideAccel: 1.6, glideStop: 0.35, // 스케이트보드: 붙는 빠르기, 손 뗐을 때 멎는 빠르기 (내리막은 거의 안 멎음)
  holdT: 0.45,    // 버튼을 이만큼 누르고 있으면 고르기 창
  clearT: 0.8,    // 자동으로 내린 뒤 그 자리를 벗어나 이만큼 지나면 다시 탐
  size: { skate: 1.45, scoot: 1.4, horse: 1.25 }, // 모양 배율 (캐릭터 키 약 2.45)
  lift: { skate: 0.23, scoot: 0.21, horse: 1.67 }, // 몸을 이만큼 올림 (판 윗면·안장 윗면)
  sitDrop: 0.1,   // 앉은 자리(안장·마차 벤치)에 이만큼 묻혀 앉음
};

// 가로등 방향 (#174, lampaim.js): fork m 안에 지나는 길은 같이 봄(갈림길은 가운데), 길 가운데에서 far m 넘게 먼 것은 pull m 로 당김
export const LAMP_AIM = { fork: 6, far: 4, pull: 3.4 };

// 마차 (#69): 조랑말이 끄는 마차가 들머리 ↔ 능선 ↔ 정상 아래를 탐방로 따라 오감. 위치는 시각에서 계산 (모두 같은 자리에 보임)
export const CART = {
  lap: 240,       // 한 바퀴(갔다 오기) 초
  dwell: 10,      // 정류장마다 서 있는 초
  ramp: 0.15,     // 구간마다 앞뒤 이 비율 동안 서서히 빨라지고 느려짐
  // 정류장: 길 이름·거리(m). 위 순서로 감 (들머리 → 능선 남쪽 끝 → 능선 중간 → 정상 아래)
  stops: [
    { name: '들머리', path: 'approach', d: 160 },
    { name: '능선 입구', path: 'approach', d: 600 },
    { name: '능선', path: 'rim', d: 745 },
    { name: '정상 아래', path: 'rim', d: 585 },
  ],
  side: 4.6,      // 정류장 팻말·벤치는 길 가운데에서 이만큼 옆
  r: 7,           // 정류장(팻말)에서 이 안이고 마차가 서 있으면 '마차 타기'
  cartR: 6,       // 마차가 이 안에 서 있어도 탈 수 있음
  seats: 4,       // 자리 수 (모양만. 여러 사람이 같은 자리에 앉아도 됨)
  // 타는 자리 (#174, 지나가는 마차 타기 #120 도 씀): 수레 기준 [옆 x, 엉덩이 y, 앞 z] (배율 적용 전). 양옆 긴 의자 위, 앞을 보고 앉음
  seatPos: [[0.38, 1.22, 0.42], [-0.38, 1.22, 0.42], [0.38, 1.22, -0.5], [-0.38, 1.22, -0.5]],
  driverPos: [0, 1.3, 1.0], // 마부 자리 (앞 콘테나 위 널빤지)
  soundR: 30,     // 말발굽·방울 소리가 들리는 거리
  driverR: 45,    // 마부(사람 모델)는 이 안에서만 그림 (저사양은 0.6배)
  markFar: 260, markNear: 18, // 화면 가장자리 마차 표시: 이 거리 사이
  ringR: 60,      // 정류장 남은 시간 고리는 이 안에서만 그림
  jumpOff: 3,     // 뛰어내리면 마차 옆 이만큼에서 점프
  scale: 1.4,     // 마차 모양 배율
  // 부딪힘 (#117): 마차 기준 [옆 x, 앞 z, 반지름] (m, 배율 적용 뒤). 수레 셋 · 끌채 · 조랑말 셋. 타고 있는 동안은 꺼짐
  block: [[0, -0.8, 1.25], [0, 0, 1.25], [0, 0.8, 1.25], [0, 1.9, 0.7], [0, 2.6, 0.55], [0, 3.4, 0.55], [0, 4.2, 0.55]],
};

// 동작(이모트) (#76): 채팅 없이 뜻을 전하는 동작. 목록·아이콘은 emotes.js
export const EMOTE = {
  bubble: 2,       // 머리 위 아이콘 말풍선 초
  bubbleY: 3.25,   // 말풍선 높이 (채팅 말풍선 3.4 보다 조금 아래)
  mark: 5,         // 가리키기·도와줘·쓰레기 많아 표시가 남는 초
  markCd: 3,       // 표시 남기는 동작은 이 초에 한 번 (연타 막기)
  pointDist: 12,   // 가리키기: 바라보는 쪽 이 거리에 표시
  trashR: 60,      // 쓰레기 많아: 이 안의 가장 가까운 더미를 가리킴 (없으면 바라보는 쪽)
  fiveR: 2.6,      // 하이파이브: 이 안의 사람 쪽으로 돌아섬
  fiveWin: 1.6,    // 둘이 이 초 안에 같이 하면 손이 맞음
  edgeFar: 8,      // 도와줘 화면 가장자리 표시: 이보다 멀 때만
  hold: 400,       // 칸을 이 ms 누르고 있으면 안쪽 고정 칸 바꾸기
  favDefault: ['wave', 'thumb', 'point', 'heart'],
};

// 먼 풍경 한라산 (#81): 남송이오름에서 본 동북동 하늘 아래. halla.js 가 납작한 메시 3겹(앞 능선·본 산·뒤 구름띠)으로 그림
// 거리·높이·폭은 게임 단위. follow: 카메라를 따라가는 정도(1 이면 하늘처럼 고정, 작을수록 움직일 때 더 어긋나 보임)
export const HALLA = {
  bearing: 40,      // 북에서 시계 방향 각도(도). 고도 자료의 정상 쪽은 약 75° 지만 들머리에서 남송이오름 몸체에 가리지 않게 북동쪽으로 당김
  base: -260,       // 메시 아래 끝 높이 (바다 높이보다 조금 아래)
  seg: 160,         // 실루엣 가로 점 개수 (LOW 는 절반)
  main: { d: 72000, w: 44000, h: 14000, follow: 0.75 },   // 본 산: w 반폭, h 정상 높이(백록담 봉우리 포함)
  front: { d: 60000, w: 44000, h: 3400, follow: 0.62 },  // 앞 능선: 기슭 오름들
  cloud: { d: 84000, w: 60000, h: 6200, follow: 0.85 },  // 뒤 구름띠: 산 허리 높이의 구름 층
  fade: [0.0, 0.26], // 아래에서 이 비율(높이/h) 사이에서 안개(지평선 색)로 녹아듦
  hazeTop: 0.12,     // 정상 쪽을 지평선 색으로 이만큼 덜 덮음(위로 갈수록 또렷)
  demCap: 420,       // 먼 땅 고도 자료에서 이 높이(m) 위는 줄여 한라산 원경과 겹치지 않게
  demKeep: 0.18,     // 줄일 때 남기는 비율
};

// 기기 성능 단계 (#79): 0 낮음 · 1 보통 · 2 높음. 자동이면 기기로 고르고(폰·코어 4개 이하 → 보통, 약한 GPU·코어 2개 이하·메모리 2GB 이하 → 낮음, 그 밖 높음), 메뉴에서 바꿀 수 있음
export const PERF = {
  names: ['낮음', '보통', '높음'],
  pr: [1, 1.25, 1.75],          // 픽셀 배율 상한 (높음이면서 폭 700 아래는 prNarrow)
  prNarrow: 1.6,
  shadow: [1024, 1024, 0],      // 그림자 지도 크기 (0 = 맵 기본값)
  // 멀리 있는 작은 물체(여러 메시로 된 하르방·NPC·동물·가게 소품·다른 사람) 감추는 거리. 단계마다 곱함, 크기(반지름)만큼 더 멀리까지
  cull: { r: 170, perRadius: 10, mul: [0.7, 1, 1.4], every: 0.2, hyst: 8, shadowR: [30, 45, 70] }, // shadowR: 이 거리 밖이면 그림자만 끔(그림자 영역이 넓어 작은 물체 그림자 패스가 많음)
  peerAnimR: [40, 60, 90],      // 다른 사람 동작(뼈대) 갱신은 이 거리 안만, 그 밖은 자리만 옮김
  peerShadowR: [0, 18, 35],     // 다른 사람 그림자는 이 거리 안만 (사람마다 메시 15개라 그림자 패스가 크게 늚)
  weakGpu: /swiftshader|llvmpipe|softpipe|mali-4|mali-t[0-7]|adreno \(tm\) [2-4]\d\d|powervr sgx|intel.*hd graphics [2-5]\d\d0?\b/i,
  // 자동일 때 느리면 한 칸씩 내림: 프레임이 slowDt 넘게 slowT 초 이어지면 (픽셀 배율 → 그림자 끔), fastDt 아래로 fastT 초면 되돌림
  slowDt: 0.045, slowT: 2.5, fastDt: 0.02, fastT: 20,
};

// 멀티플레이 (#7): 서버 주소가 비어 있으면 지금처럼 혼자 하기 (claude.ai 아티팩트에서는 room 캐퍼빌리티)
// server: Cloudflare Worker 주소 (예 'https://oreumoreum.<계정>.workers.dev'). 주소창 ?server=… 로 바꿔 끼워 볼 수 있음 (탭 세션 동안)
// 노루 (#92): 타고 가는 빠르기(걷기·달리기, 신발 영향 없음), 멀티에서 노루 무리를 방장이 알리는 간격·귤 먹이 요청
export const DEER = {
  rideWalk: 9, rideRun: 15,
  netMs: 330,        // 방장이 노루 자리를 방에 알리는 간격 (초당 3번). 받는 쪽은 부드럽게 이음
  feedR: 30,         // 방장이 아닌 사람이 던진 귤: 이 거리 안 노루에게 먹으러 오라고 방장에게 부탁
  feedRetry: 8,      // 부탁한 노루가 이 초 안에 안 오면 다시 부탁할 수 있음
};

// 이름 (#162): 처음 지을 때·바꿀 때 글자 수. 바꾸기 값은 처음 한 번 무료, 그다음 price 부터 grow 배씩 (cap 에서 멈춤). 하루 perDay 번 (한국 날)
export const NICK = { min: 2, max: 12, price: 2000, grow: 1.5, cap: 20000, perDay: 1 };
export const NET = {
  server: 'https://oreumoreum.spacehwi.workers.dev',
  googleClientId: '185091365310-fae1ordhatv7quuj3g6ah7cts129d1l2.apps.googleusercontent.com', // 공개 값 (승인된 원본 https://spacehwi.github.io)
  sendMs: 100,        // 내 위치·동작 보내는 간격 (초당 10번 안쪽)
  identMs: 10000,     // 옷·닉네임은 바뀔 때만 보내되, 이 간격마다 한 번 더 (#115: 서버가 버린 메시지에 실렸을 때 대비)
  tickMs: 100,        // 방이 모아 보내는 간격
  farR: 150,          // 이 거리 밖 사람은 farEvery 틱마다 한 번만 받음
  farEvery: 5,
  roomCap: 30,        // 방 하나 정원. 넘으면 같은 오름 다음 방(채널)으로. tools/loadtest.js 로 잰 값 (#7 코멘트)
  maxCh: 20,          // 채널 수 상한
  presenceMax: 1500,  // 한 번에 보내는 내 상태 크기 상한 (바이트)
  msgPerSec: 15,      // 한 사람이 1초에 보낼 수 있는 메시지 (넘으면 버림)
  hitPerSec: 3, hitRange: 45, // 귤·활 맞힘 알림: 1초에 몇 번, 맞힌 사람과 거리 상한(m)
  putPerMin: 120, putBurst: 1500, // 다시 쌓기(투기꾼·트럭, 방장만): 1분에 넣는 수, 한꺼번에(접속 안 한 동안 쌓인 몫) 넣을 수 있는 수
  // 저장 확인: 클라이언트가 보낸 귤·장비를 그대로 믿지 않음
  // 귤이 늘 수 있는 몫 (#144): ① 작은 몫(토큰 통: 적·업적·낚시·보너스) + ② 번 몫(earn_bank: 방이 받아 준 줍기 × 더미 구역 값, server/src/heaps.js ZONE_GYUL)
  //   클린하우스에 버린 귤은 ② 에서 먼저 씀. #137 의 고정 큰 몫(earnBurst 100000, earnPerSec 80)은 한 번에 10만 귤 부풀리기를 받아 줘서 되돌림
  earnPerSec: 15,     // ① 이 빠르기로 참 (지난 저장 뒤 지난 시간 × 이 값). 5구역 외계인 무리(3마리 × 400, 3~4분마다)가 초당 약 6
  swarmPerSec: 45,    // ③ 들판 떼 (#173): 저장에 적힌 떼 귤(save.swarm.earn 누적)이 늘어난 몫은 지난 저장 뒤 지난 시간 × 이 값까지 더 받아 줌 (모아 두지 않음). 구역 5 들판 1초 약 40 (tools/econ.js)
  earnBurst: 20000,   // ① 한꺼번에 받는 몫: 업적·뱃지 몰아 받기, 첫 보너스, 지키기 보너스, 작은 배낭 한 번(종류 운 여유). 긴급(2026-11-21): 4000 → 20000. 전리품 팔기(#140, 5~6단계 전설 7,800~18,000)·퀘스트·보물·우두머리 보상이 4000 을 넘어 사용자 귤이 깎여 사라졌음. 제대로 된 셈(서버가 판 전리품·보상을 아는 것)은 후속 이슈
  earnPickSlack: 1.5, // ② 줍기 하나의 값 = 구역 평균 귤 × 이 여유 × gv × 베스트. 종류는 주울 때 운이라 평균보다 비싼 것이 많이 나올 수 있음
  earnBankMax: 60000, // ② 쌓이는 상한: 정상 구역에서 가장 큰 배낭(부피 540, 보통 쓰레기 330개 안팎 × 줍기 값 123 ≈ 4만)을 채운 몫에 여유
  earnFlushMs: 1000,  // 방이 번 몫을 계정에 넘기는 간격 (버리기 직전에 주운 것도 저장 전에 넘어가게)
  earnWindow: 3600,   // 지난 시간은 이 초까지만 셈 (오래 꺼 뒀다고 귤이 쌓이지 않게)
  // 서버가 아는 큰 귤 (#188, server/src/earn.js): 저장의 기록(판 장비·퀘스트·우두머리·소굴·보물·볼거리)으로 몫을 인정해 ② 에 더함
  //   fresh: 지난 저장에 없던(새로 떨어져 바로 판) 장비 수 통 — 초당 freshPerSec 씩 차고 freshBurst 에서 멈춤 (적 1.2%·소굴 12%·보물 35%·우두머리 60% 를 넉넉히)
  //   legend: 그중 전설 (우두머리·보물 4구역부터만 떨어짐). bossGap·denGap: 같은 우두머리·소굴을 다시 인정하기까지 초 (ZONE_GUARD.holdSec 1800·FIELD.den.reopen 1800 보다 조금 짧게)
  earnRec: { freshPerSec: 1 / 30, freshBurst: 30, legendPerSec: 1 / 1200, legendBurst: 3, bossGap: 1500, denGap: 1500, questPerSave: 6, soldMax: 64 },
  clampKeepDays: 30,  // 귤 맞춤 기록(#188 GET /admin/clamps)·운영자 귤 보내기 기록 보관 날짜
  grantMax: 1000000,  // 어드민이 한 번에 보내는 귤 상한 (#188 POST /admin/grant)
  pickPerSec: 40, pickBurst: 1000, // 치운 양(누적)이 늘 수 있는 빠르기 (#137 흡입기 초당 32개. 예전 15·400)
  migrateCoinsMax: 30000, // 기기 기록을 계정으로 옮길 때 받아 주는 귤 상한
  saveMax: 200000,    // 저장 크기 상한 (바이트)
  saveDebounce: 15000, // 바뀐 뒤 이만큼 모아서 서버에 저장 (ms). 나갈 때(탭 숨김·닫기)는 바로
  keepDays: 7,        // 베타: 마지막 접속 뒤 이 날짜가 지나면 기록 지움 (서버 Cron)
  // 지금 접속 (#186): 방이 사람 수를 계정 객체에 알림(들어올 때·나갈 때·onlineEveryMs 마다). onlineStaleMs 동안 소식이 없는 방은 빼고 셈. 어드민 창은 onlinePollMs 마다(열려 있을 때만)
  onlineEveryMs: 60000, onlineStaleMs: 180000, onlinePollMs: 30000, onlinePeakDays: 30,
  // 보안 (#84): 이동·줍기·폭주·요청 수 제한. 모두 서버(roomcore·index)가 봄
  rooms: ['namsongi', 'gate', 'darangswi', 'donnaeko'], // 방 이름은 'oreum-<이 중 하나>-battle' 만 (#98: 서버는 전투 오름 하나. 예전 'oreum-<이름>' 접속은 battle 방으로 보냄). 그 밖은 거절 (방 만들기 폭주 막기)
  maxSpeed: Math.max(32, DEER.rideRun * 2), // 초당 m 상한: 조랑말(달리기 10 × 1.9) · 노루 타고 달리기(DEER.rideRun) · 받혀 튕김(28) 위로 여유. 넘으면 앞 자리로 되돌림
  moveSlack: 8,       // 이동 판정 여유 (m, 끊김·점프)
  warpGap: 10,        // 들것 귀환·자리 앉기 같은 순간 이동은 이 초에 한 번까지 받아 줌
  takePerSec: 40,     // 더미 줍기: 1초에 몇 개 (한꺼번에도 이만큼. #137 흡입기 초당 32개. 예전 6)
  takeMax: 16,        // 한 메시지에 묶어 보내는 줍기 수 상한 (#137). 클라이언트는 이보다 많으면 나눠 보냄
  takeAsk: 64,        // 한 메시지에 적힌 수는 여기까지 셈: takeMax 를 넘은 몫도 '되돌려라'(no)로 알림 (#144, 화면의 되돌리기 상한과 같음)
  strikeMax: 8, strikeWin: 30, // 되돌리기·버린 메시지가 strikeWin 초 안에 strikeMax 번을 넘으면 끊음
  dropKick: 60,       // 버린 메시지가 strikeWin 초 안에 이만큼이면 끊음 (폭주)
  banSec: 60,         // 끊긴 사람(계정·주소)은 이 초 동안 다시 못 들어옴
  reqPerMin: 120,     // 한 주소(IP)에서 1분에 받는 HTTP 요청 (로그인·저장·의견 모두)
  loginPerMin: 10,    // 한 주소에서 1분에 받는 로그인
  wsPerMin: 30,       // 한 주소에서 1분에 여는 방 연결
  sessionDays: 14,    // 세션 토큰 수명. /me 를 부를 때 남은 날이 sessionRenew 아래면 새 토큰
  sessionRenew: 7,
  nickMax: 16, sayMax: 60, // 닉네임·말풍선 글자 수
  deerMax: 4000,      // 방장이 보내는 노루 무리 메시지 크기 상한 (바이트, #92)
  deerPerSec: 5,      // 노루 메시지(무리·타기·먹이 부탁)는 따로 1초에 이만큼
  // 구역 우두머리 (#139): 방장이 {t:'bs'} 로 자리·기운·패턴을 알리고, 다른 사람은 맞힌 피해를 방장에게 {t:'bh'}, 쫓아내면 방장이 {t:'bd'} (방이 돌하르방을 세움)
  bossPerSec: 8,      // 우두머리 메시지는 따로 1초에 이만큼 (방장 알림 5번 + 여유)
  bossMax: 700,       // 우두머리 메시지 크기 상한 (바이트)
  bossHitMax: 300,    // 한 번에 알리는 피해 상한 (귤 폭탄 90 × 무리 + 모아 쏘기 여유)
};

// 랭킹 (#11): 치운 쓰레기 수. 오늘(한국 자정)·이번 주(한국 월요일 0시부터)·전체. 서버는 전투 오름 하나 (#98, 예전 깨끗한 오름 기록은 합침)
export const RANK = {
  top: 50,            // 서버가 돌려주는 위 몇 명
  cacheMs: 10000,     // 서버: 같은 순위표는 이만큼 메모리에 두고 다시 셈 (계정 DO 부하)
  dayKeep: 9,         // 서버: 날마다 쌓는 기록은 이 날만큼 둠 (이번 주 + 하루)
  medals: 3,          // 1~3위는 귤색 메달
  checkGapMs: 4000,   // 버린 뒤 내 순위 다시 보기 간격 (연달아 버려도 이만큼은 쉼)
};

// 의견 보내기 (#77): 게임 안 글 → 서버 /feedback → 개발자 메일 (받는 주소는 서버 시크릿 FEEDBACK_TO)
export const FEEDBACK = {
  max: 500,           // 글자 수 상한
  gapMs: 60000,       // 연달아 보내기 막기: 이만큼 지나야 다음 글
  keep: 30,           // 서버가 없을 때 기기에 모아 두는 글 수 상한 (넘으면 오래된 것부터 버림)
  batch: 10,          // 한 번에 서버로 보내는 글 수
  ipPerHour: 20,      // 서버: 한 주소(IP)에서 1시간에 받는 글 수
  dbKeep: 2000,       // 서버: 저장해 두는 글 수 상한
};

// 오류 알림·안전장치 (#108): src/crash.js · update.js(매 프레임 오류에도 계속) · scene.js(WebGL 화면 잃음)
export const CRASH = {
  perDay: 3,          // 같은 오류는 기기당 하루 이만큼만 서버로
  perRun: 5,          // 한 번 켤 때 보내는 오류 수 상한
  acts: 6,            // '마지막 한 일' 기억하는 수
  glWait: 6000,       // WebGL 화면을 잃은 뒤 이만큼(ms) 안에 돌아오지 않으면 '다시 불러오기' 안내
};

// 오류 알림 묶어 보기 (#122): 서버 GET /crashes?days= (로그인 없이). server/src/crashes.js
export const CRASHES = {
  days: 3,            // 기본으로 보는 날 수
  maxDays: 7,         // 최근 이만큼까지만
  groups: 50,         // 많은 순 이만큼 묶음까지
  rows: 2000,         // 묶기 전에 읽는 오류 알림 수 상한
  textMax: 300,       // 오류 글 길이 상한
  acts: 3,            // '마지막 한 일' 내보내는 수
  cacheMs: 60000,     // 같은 days 결과를 이만큼 다시 씀
};

// 노루·돌하르방·가로등 Tripo 모델 (#2). 모델 좌표는 바닥 y=0·키 약 0.98, 크기는 배율로
export const LIFE_MODELS = {
  deer: { scale: 1.9, near: 140, seatY: 1.0, seatZ: -0.62 }, // 키 약 1.86m. near: 이 거리 안에 노루가 오면 모델을 받음. 탈 때 러너를 등 높이·뒤쪽으로
  hareubang: { scale: 3.2 },                     // 키 약 3.1m (예전 임시 모양과 같음)
  lamp: { scale: 4.0, glow: 0.8, colR: 0.3 },     // 키 약 3.9m, 귤 등은 땅에서 약 2.6m. glow: 밤에 귤 등이 빛나는 세기, colR: 기둥 충돌 반지름
};

// 화면 방향 (#105): 낮은 가로 화면(폰을 가로로)에서는 세로 화각을 넓혀 캐릭터가 너무 크게 보이지 않게
export const SCREEN = {
  fov: 50,       // 기본 세로 화각(도)
  fovLow: 62,    // 낮은 가로 화면 세로 화각
  lowH: 500,     // 이 높이(px) 이하이면서 가로가 더 길면 낮은 가로 화면 (page.html 의 같은 media query 와 맞춤)
};

// 내 가방 (#166, src/game/bag.js): 창 옆 캐릭터 미리보기 카메라 (update.js cam.mode 'wardrobe')
// charH 캐릭터 키(m, 모자 포함 어림), fillW·fillN 창이 덮지 않은 자리 높이에서 캐릭터가 차지할 비율(데스크톱·폰), topBar 위 한 줄 높이(px), lift 카메라를 시점보다 얼마나 위에(m)
export const BAG = { charH: 2.3, fillW: 0.55, fillN: 0.78, topBar: 56, lift: 0.4 };

// 감독 (#176, src/director.js · game/director.js): 말을 거는 것을 한 번에 하나씩, 유저 저니 순서대로 (notes/journey.md). 시간·횟수는 모두 임의값
// prio 우선순위(앞이 높음): danger 쓰러짐·위험 알림 > story 이야기 이벤트 예고 > quest 퀘스트 받기·끝내기 창 > level 레벨업 고르기 > intro 새 시스템 소개 > tip 팁 > mate 동료 대사 > mutter 혼잣말 > radio 오름 방송
// gap 낮은 것은 높은 것이 끝나고 이 초 뒤, quick 같거나 높은 것은 이 초 뒤, preempt 이것보다 앞(=danger)은 지금 나가는 낮은 것을 끊음, fightMax 싸우는 중엔 앞 몇 개만(danger·story·quest)
// sec 한 번 보이는 기본 시간, ttl 기다릴 수 있는 기본 시간(넘으면 버림), introTtl 문 소개가 기다릴 수 있는 시간, gateSec 문 조건 보는 간격
// perDay 하루에 새로 소개하는 시스템(count: 1 인 문: 레벨·첫 투기꾼·들판 떼·오늘의 할 일·전리품) 수. 퀘스트·동료·이야기는 안 셈, idleSec 이만큼 한가하면 다음 실마리(60초 안에 나오게 조금 앞), idleBack 실마리를 줘도 그대로면 두 배씩 늘리는 횟수, retry 실마리를 못 냈을 때 다시 볼 때까지(초)
// doors 문 순서 (notes/journey.md 2절 표). id 는 저장에 쓰므로 바꾸지 않는다. need {사실: 최소}, after 앞 문(없으면 표에서 바로 앞의 등록된 문, null 이면 앞 문 없음), count 1 이면 하루 개수에 셈
//   사실(facts): tut 튜토리얼 끝 · jeong 정낭을 나섬 · picked 치운 수 · dumps 버린 수 · bloomed 꽃을 피움 · attacked 첫 공격을 겪음 · zonesDone 끝낸 구역 수 · zone 가 본 가장 높은 구역 번호 · days 놀아 본 날 · night 밤
//   뒤 이슈가 사실을 더하면 game/director.js FACTS 에 한 줄. 등록하지 않은 문(아직 없는 시스템)은 건너뜀
export const JOURNEY = {
  prio: ['danger', 'story', 'quest', 'level', 'intro', 'tip', 'mate', 'mutter', 'radio'],
  gap: 4, quick: 0.6, preempt: 1, fightMax: 3,
  sec: 3, ttl: 20, introTtl: 600, gateSec: 1,
  perDay: 3, idleSec: 55, idleBack: 3, retry: 8,
  doors: [
    { id: 'name', need: {}, after: null }, // #162 이름 짓기
    { id: 'color', need: {} }, // #155 기본 옷 색
    { id: 'tutorial', need: {} }, // #151
    { id: 'tips', need: { tut: 1 }, after: null }, // #66 상황 팁 (튜토리얼 뒤)
    { id: 'mateSunja', need: { jeong: 1 } }, // #172 순자 삼춘 (정낭을 나서면)
    { id: 'quest', need: { jeong: 1 } }, // #158 오름지기 첫 퀘스트
    { id: 'heapNear', need: { jeong: 1 } }, // #160 들머리 더미
    { id: 'shopQuest', need: { dumps: 1 } }, // #158 장비점 주인 퀘스트 (첫 버리기 뒤)
    { id: 'level', need: { attacked: 1 }, count: 1 }, // #159 첫 레벨업과 증강
    { id: 'dumper', need: { tut: 1, bloomed: 1 }, after: 'tips', count: 1 }, // #135 첫 투기꾼 안내 (꽃 한 번 뒤 첫 공격)
    { id: 'storyMom', need: { babies: 5 }, after: 'level' }, // #168 '엄마가 왔다' (첫 레벨업 뒤, 새끼 5마리째)
    { id: 'field', need: { fieldQuest: 1 }, count: 1 }, // #173 들판 떼 본격 (퀘스트 '들판 탐사' 뒤, 그 전엔 물결 1단계까지)
    { id: 'boss', need: { tut: 1 }, after: 'tips' }, // #139 구역 우두머리 (구역 80%, 나올 때 위험 알림)
    { id: 'zoneDone', need: { tut: 1 }, after: 'tips' }, // #139 #119 구역 완료·하르방
    { id: 'mateMinsu', need: { zonesDone: 1 } }, // #172 민수 (구역 1 우두머리 뒤)
    { id: 'nightLight', need: { night: 1, picked: 30 } }, // #168 '수상한 불빛' (첫날 밤)
    { id: 'radio', need: { zonesDone: 1 } }, // #165 오름 방송
    { id: 'shopQuests', need: {} }, // #158 #167 가게 NPC 퀘스트 (2일째거나 구역 2 에 들어서면: game/quest.js gate)
    { id: 'daily', need: { days: 2 }, count: 1 }, // #125 오늘의 할 일
    { id: 'mateJenny', need: { zone: 2 } }, // #172 제니 (구역 2 에서)
    { id: 'tourist', need: { zone: 2 } }, // #163 관광객
    { id: 'loot', need: { zone: 3 }, count: 1 }, // #140 전리품·강화 (구역 3)
    { id: 'crow', need: { zone: 3 } }, // #163 까마귀 도둑
    { id: 'title', need: { zone: 3 } }, // #165 칭호
    { id: 'gift', need: { zone: 3 } }, // #175 귤 주기 (멀티)
    { id: 'aliens', need: { zone: 4 } }, // #168 '미친 개 주의'·'불법 주차 단속'·엔딩 (구역 4·5)
  ],
};

// 이야기 이벤트 (#168, src/game/story.js · 글은 src/punktext.js): 한 일의 결과로 다음 일이 벌어짐. 사람마다 한 번씩, 한 번에 하나, 하루에 새로 시작하는 것은 perDay 개까지
// 이벤트 하나 = 조건 → 예고(omen 초 안, 카메라가 잠깐 그쪽, 건너뛸 수 있음) → 벌어지는 일 → 끝(보상·다음 이벤트). 싸우는 중·튜토리얼·창이 열려 있으면 예고를 미룸
// 조건은 그 일이 '일어날 때' 봄 (옛 저장: 이미 한참 넘긴 사람도 다음 번 그 일이 한 번 더 일어날 때 시작). 셈은 업적 평생 기록(save.ach.life)
// list 순서가 유저 저니 순서. door: 감독(#176) 문(그 문이 열려야 시작, 등록 안 된 문은 없는 것으로). gyul 끝 보상
// 모두 임의값. 보상 합은 5일 전체 벌이의 5% 아래 (tools/econ.js 가 봄), 엄마 멧돼지는 권장 장비로 서서 던질 때 잃는 기운 40% 아래 (tools/fight.js)
export const STORY = {
  perDay: 4, omen: 2.6, look: 2.2, safeSec: 3, retry: 60, checkSec: 1,
  list: [
    { id: 'mom', zone: 1, door: 'storyMom', need: { ev: 'enemy-repel-piglet', n: 5 }, gyul: 60 },
    { id: 'pair', zone: 1, need: { ev: 'dumper-repel', n: 3 }, gyul: 40 },
    { id: 'night', zone: 1, door: 'nightLight', need: { boss: 1, night: 1 }, gyul: 0 },
    { id: 'howl', zone: 2, need: { pack: 'dog' }, gyul: 0 },
    { id: 'truck', zone: 2, need: { clean: 0.5 }, gyul: 0 },
    { id: 'meet', zone: 3, need: { ev: 'enemy-repel-boar', n: 10 }, gyul: 80 },
    { id: 'tour', zone: 3, need: { boss: 3 }, gyul: 0 }, // 관광객(#163) 이 없으면 조용히 건너뜀
    { id: 'sign', zone: 4, door: 'aliens', need: { enter: 4 }, gyul: 0 },
    { id: 'ufo', zone: 5, door: 'aliens', need: { ev: 'enemy-repel-alien', n: 3 }, gyul: 0 },
    { id: 'end', zone: 5, door: 'aliens', need: { boss: 5 }, gyul: 300 },
  ],
  // 엄마가 왔다: 엄마(멧돼지 모양 k 배, 아기 멧돼지보다 기운 3배)와 새끼 kids 마리. 숲 가장자리 r m 쯤에서 나옴. 보상 귤은 끝에 한 번(엄마는 흩뿌리지 않음)
  mom: { kind: 'boar', k: 1.3, hp: 9, dmg: 10, kids: 2, r: [20, 28], life: 240 },
  // 투기꾼의 복수: 다음 투기꾼은 둘(한 명이 망봄). 망보는 사람 whistle m 안에 오면 휘파람 → 다른 한 명이 서둘러 버림
  pair: { whistle: 25 },
  // 수상한 불빛: UFO 가 능선 위를 지나며(지름 k 배, 높이 y, 지나는 시간 t 초) 외계 캔 cans 개와 쓰레기 trash 개를 떨어뜨림. 캔은 다가가면(pickR) 주움
  night: { k: 3.2, y: 34, t: 9, cans: 3, trash: 8, pickR: 1.8, d: [30, 45] },
  // 들개 대장의 소집: 무리 하나를 다 쫓은 뒤 긴 울음, wait 초 뒤 n 마리가 반원(r m)으로 다가옴
  howl: { n: 5, wait: [18, 30], r: 26 },
  // 멧돼지 가족회의: 능선 빈터(구역 3 우두머리 빈터에서 off m)에 n 마리. calmR 안에 오면 흩어지고 귤 상자
  meet: { n: 4, off: 14, calmR: 7 },
  // 미친 개 주의: 구역 4 에 처음 들어선 곳 앞 ahead m 에 쓰러진 표지판. 세우면 뒤 back m 에서 광견병 들개
  sign: { ahead: 9, r: 2.6, back: 14 },
  // 불법 주차 단속: UFO 가 플레이어 앞 d m 에 내려와(높이 y) 쓰레기 trash 개를 쏟음
  ufo: { k: 3.6, y: 14, d: 22, t: 7, trash: 14 },
  // 엔딩 (사용자 결정 2026-11-21): 같은 방 모두가 함께 강제로 보는 시네마틱 len 초. 시작 lead 초 전 알림, 이미 본 사람은 skipAfter 초 뒤 건너뛰기
  // 방(서버)은 하루 한 번까지만 모두에게 틀고, 그날 두 번째부터는 끝낸 사람만 (나머지는 방송 한 줄)
  end: { len: 48, lead: 3, skipAfter: 10, ufos: 7 },
};

// 처음 고르는 기본 옷 색 (#155, src/lookcolors.js): 기본 모자·반팔·반바지·쓰레빠에만. 줄마다 [색, 이름] 8개, 0번이 지금 기본색
// 포인트색은 고른 색 × dark(0.82). 저장은 save.look.colors = { hat, top, bottom, shoes } 색 번호. 0 이 아니면 장비 id 뒤에 ~번호 (멀티도 이 id 로 봄)
export const LOOK_COLORS = {
  ids: { hat: 'hat:w-cap', top: 'top:w-tee', bottom: 'bottom:w-shorts', shoes: 'shoes:slip' },
  names: { hat: '모자', top: '티', bottom: '바지', shoes: '신발', style: '옷' },
  dark: 0.82,
  hat: [['#5c9a3c', '초록'], ['#e8913a', '귤색'], ['#c4513f', '빨강'], ['#4a78b8', '파랑'], ['#e3c24a', '노랑'], ['#e090a8', '분홍'], ['#ece6d8', '흰색'], ['#3a3a40', '먹색']],
  top: [['#e8dfc8', '흰색'], ['#5c9a3c', '초록'], ['#e8913a', '귤색'], ['#c4513f', '빨강'], ['#4a78b8', '파랑'], ['#e3c24a', '노랑'], ['#e090a8', '분홍'], ['#3a3a40', '먹색']],
  bottom: [['#8a6a3c', '갈색'], ['#5c9a3c', '초록'], ['#e8913a', '귤색'], ['#c4513f', '빨강'], ['#4a78b8', '파랑'], ['#e090a8', '분홍'], ['#ece6d8', '흰색'], ['#3a3a40', '먹색']],
  shoes: [['#3c8fd0', '파랑'], ['#5c9a3c', '초록'], ['#e8913a', '귤색'], ['#c4513f', '빨강'], ['#e3c24a', '노랑'], ['#e090a8', '분홍'], ['#ece6d8', '흰색'], ['#3a3a40', '먹색']],
  style: [['', '원래 색'], ['#5c9a3c', '초록'], ['#e8913a', '귤색'], ['#c4513f', '빨강'], ['#4a78b8', '파랑'], ['#e3c24a', '노랑'], ['#e090a8', '분홍'], ['#3a3a40', '먹색']], // 겉모습 옷 색 (#179, tint: true 인 옷). 0번 = 옷 원래 색
};
// 전리품·재료·강화·장비 등급 (#140, notes/growth-loop.md 5절). 셈은 src/loot.js(순수 함수, 서버 validate.js·tools 도 씀), 게임은 src/game/loot.js·forge.js
// mats[구역-1]: 그 구역 재료(적·소굴·보물) id·이름·색 + 우두머리가 반드시 주는 귀한 재료(rare, 이름은 ZONE_BOSS.list mat). 재료 주머니 save.mats = { id: 수 } (가방과 따로, 무게 없음)
// enemy: 적 하나를 쫓아내면 mat 확률로 재료 1, gear 확률로 장비 하나. den: 소굴을 닫으면 재료 mats[구역]개 + gear 확률 장비. treasure: 보물 재료·장비 확률. boss: 귀한 재료 1(반드시) + 재료 mats[구역] + gear 확률 장비
// grade[어디서] = 등급 확률 [보통, 좋은, 귀한, 전설]. 전설은 legendZ 구역부터의 우두머리·보물에서만 (그 밖이면 귀한으로)
// 떨어지는 장비: 그 구역 단계(구역 n = n단계, 정상 무기는 6단계도)와 지금 그 칸 단계 중 낮은 쪽, 칸 10개 중 하나. 지금 것보다 높은 단계는 나오지 않음(서버 값 확인과 맞게: 값을 내지 않은 단계를 얻지 않음)
// gradeK 등급이 더하는 능력(GROWTH.grade 와 같음), enh 강화: 한 번에 능력 + GROWTH.enh(12%), +GROWTH.enhMax(5)까지, 실패 없음
//   enh.mats[지금 강화] 그 단계 구역 재료 수, enh.rare[지금 강화] 귀한 재료 수, enh.gyul[지금 강화] × GROWTH.price[단계] 귤
//   능력 배율 = (1 + 등급) × (1 + 0.12 × 강화). 도구(줍는 빠르기)·배낭(용량)·무기(피해)는 그대로, 신발·옷은 '기본보다 나은 몫' 에 statK 만큼만 (빠르기·HP 가 너무 뛰지 않게)
// sell: 귤로 바꾸기 = 그 단계 값(GROWTH.price) × sell[등급] × (1 + sellEnh × 강화). spareMax: 안 쓰는 장비 칸 수 (넘으면 가장 낮은 것부터 귤로)
// fx 전설 효과 (칸 묶음마다 하나): reach 줍는 칸(도구·배낭·신발·모자·바지·베스트) = 줍는 거리 × k, split 무기 = 맞히면 가까운 다른 적(r m 안)에게 피해 × k 로 갈라짐, extra 싸우는 옷(티셔츠·잠바·양말) = 쫓아낸 적 귤 × k
// drop 떨어지는 연출: up 튀는 빠르기, spread 퍼짐, magnetR 이 안이면 빨려 듦(magnetT 초 뒤부터), autoT 초가 지나면 어디 있든 주머니로, pillar 등급별 빛기둥 높이(보통은 없음)
export const LOOT = {
  mats: [
    { z: 1, id: 'm1', name: '멧돼지 털', color: '#c79a62', rare: 'r1' },
    { z: 2, id: 'm2', name: '들개 이빨', color: '#efe6cf', rare: 'r2' },
    { z: 3, id: 'm3', name: '멧돼지 엄니', color: '#f4ead2', rare: 'r3' },
    { z: 4, id: 'm4', name: '붉은 발톱', color: '#d9473a', rare: 'r4' },
    { z: 5, id: 'm5', name: '외계 부품', color: '#8fe0d8', rare: 'r5' },
  ],
  enemy: { mat: 0.6, gear: 0.012 },
  den: { mats: [0, 3, 3, 4, 4, 5], gear: 0.12 },
  treasure: { mats: [0, 1, 1, 2, 2, 3], gear: 0.35 },
  boss: { mats: [0, 3, 4, 5, 6, 8], gear: 0.6 },
  grade: { enemy: [0.45, 0.4, 0.15, 0], den: [0.35, 0.45, 0.2, 0], treasure: [0.15, 0.45, 0.3, 0.1], boss: [0, 0.5, 0.38, 0.12] },
  legendZ: 4,
  gradeName: ['보통', '좋은', '귀한', '전설'], gradeColor: ['#e8e4d8', '#5fd36a', '#4fa3ff', '#ff9a2e'],
  enh: { mats: [2, 3, 5, 8, 12], rare: [0, 0, 0, 0, 1], gyul: [0.05, 0.08, 0.12, 0.18, 0.25] },
  statK: { tool: 1, bag: 1, weapon: 1, shoes: 0.35, hat: 0.5, top: 0.5, bottom: 0.5, vest: 0.5, jacket: 0.5, socks: 0.5 },
  sell: [0.06, 0.15, 0.3, 0.6], sellEnh: 0.25, spareMax: 30,
  fx: {
    reach: { name: '줍는 거리 넓어짐', k: 1.5, slots: ['tool', 'bag', 'shoes', 'hat', 'bottom', 'vest'] },
    split: { name: '귤이 둘로 갈라짐', k: 0.5, r: 7, slots: ['weapon'] },
    extra: { name: '쫓아낸 적이 귤을 더 떨굼', k: 1.3, slots: ['top', 'jacket', 'socks'] },
  },
  drop: { up: [5, 8], spread: [1.5, 3.2], grav: 16, magnetR: 6, magnetT: 0.7, fly: 14, autoT: 16, pillar: [0, 2.6, 4.2, 7], low: 0.5 },
  popT: 9, // 장비를 얻으면 견주는 창이 떠 있는 초 (안 누르면 가방에 남음)
};

// 퀘스트 (#158, src/quest.js · game/quest.js · 확인 node tools/questrun.js): 유저 저니를 따라가는 줄기 퀘스트 + 곁가지·가게 주인 퀘스트. 이름·말·보상은 모두 임의
// 줄거리(notes/journey.md 0절): 장마다 물음 하나를 풀고 새 물음 하나. 4장(굼부리) 전에는 외계인과 클린하우스를 잇는 말을 하지 않는다
// givers 주는 사람: at 'sign' 들머리 안내판 옆(오름지기), board 그 클린하우스(CH id) 옆 표지판, shop 그 가게 앞 주인(가게가 없으면 그 사람 퀘스트는 건너뜀)
// 퀘스트: id(저장에 쓰므로 바꾸지 않음) · z 구역 · giver 주는 사람 · to 돌려줄 사람(없으면 giver) · name · say 받기 창 말(2~3줄) · task 할 일 한 줄 · fin 끝내기 말
//   ask { k 셈 이름, n, ever: 받기 전에 한 것도 셈(다시 못 하는 것) } · go 추적 화살표가 가리킬 곳(주는 사람 id·shop:가게·ch 클린하우스·cairn 돌탑·heapRoad·heapField·heap@z·den@z·boss@z) · reward { gyul, coupon: [가게, 수], item: 옷 id } · need 있어야 하는 것(없으면 건너뜀)
//   셈 이름(k): trash 쓰레기 · heapRoad 길가 더미 · heapField 들판 더미 · heap@z 구역 z 더미 · recycle 버리기 · repel 적 · repel:<종류> · repelBuff 식사 버프 중 쫓은 적 · dumper 투기꾼
//     den@z 구역 z 소굴 · boss@z 구역 z 우두머리(ever) · zone 가 본 가장 높은 구역(ever) · gearTB 도구+배낭 단계 · gearAll 도구+배낭+무기 · tool · bag · weapon 무기 단계-1(ever)
//     fish 낚시 · stone 돌탑 · meal 식사 · haircut 머리 · clothes 옷 사기 · photo 사진 · emote 동작 · browse 미장원·LEAP 앞에 가 봄
// side 곁가지(흰 느낌표): door 감독(JOURNEY.doors) 문이 열려야 · after 이 줄기 퀘스트를 끝낸 뒤
// coupon 할인권: gear·leap 은 다음 물건 off 비율, salon 다음 머리 반값, ade 스톤 플럼 에이드 한 잔 (game/quest.js coupon)
// dayCap 첫날(구역 1) 줄기 보상 합이 첫날 귤 벌이에서 넘지 않을 비율 (tools/econ.js 가 봄)
export const QUESTS = {
  r: 3.4, near: 40, dayCap: 0.15, coopR: 40, // r 상호작용 거리, near 이 안이면 주는 사람이 움직임, coopR 남이 치운 더미도 이 안이면 셈
  coupon: { gear: 0.1, leap: 0.1, salon: 0.5 },
  givers: {
    jigi: { name: '오름지기', at: 'sign', side: 2.6, fwd: 0.9, look: { shirt: '#7d8f52', pants: '#5a4a36', shoes: '#3a3229' }, hello: ['오름은 늘 할 일이 있어요', '천천히 둘러봐요', '귤은 아껴 던져요'] },
    'b:slope': { name: '남쪽 사면 표지판', board: 'slope' },
    'b:rest': { name: '능선 쉼터 표지판', board: 'rest' },
    'b:crater': { name: '굼부리 표지판', board: 'crater' },
    'shop:gear': { name: '철물 삼춘', shop: 'gear', look: { shirt: '#4c5a6e', pants: '#3b3b40', shoes: '#26262b', hat: 'hat:straw' }, hello: ['집게는 손목으로 쓰는 거여', '연장이 좋아야 일이 즐겁지'] },
    'shop:leap': { name: 'LEAP 점원', shop: 'leap', look: { shirt: '#f2f2f2', pants: '#24262c', shoes: '#f2f2f2' }, hello: ['오늘 핏 좋네요', '오름도 패션이에요'] },
    'shop:salon': { name: '루이네 원장', shop: 'salon', look: { shirt: '#c9879b', pants: '#3a2f3a', shoes: '#2a222a' }, hello: ['바람에 머리가 다 날렸네', '앞머리 다듬어 줄까요?'] },
    'shop:stone': { name: '스톤 셰프', shop: 'stone', look: { shirt: '#f6f4ee', pants: '#2b2b30', shoes: '#26262b' }, hello: ['배고프면 싸움도 못 해요', '오늘 파스타 잘 나왔어요'] },
    'shop:satis': { name: '만족한상회 사장', shop: 'satis', look: { shirt: '#3a6ea8', pants: '#33333a', shoes: '#26262b' }, hello: ['갈치 드실래요?'] },
  },
  main: [
    // ----- 1장 숲길 '이상한 쓰레기' (첫날) -----
    { id: 'can', z: 1, giver: 'jigi', name: '이상한 쓰레기', say: ['정낭을 넘었네요. 오름은 처음이죠?', '요즘 쓰레기 사이에 처음 보는 게 섞여 나와요. 뭔지 알면 나한테도 좀 알려 줘요.'], task: '쓰레기 10개 줍기', ask: { k: 'trash', n: 10 }, go: 'heapRoad', fin: ['…이 캔, 글자가 어느 나라 말도 아니네요.', '일단 내가 맡아 둘게요. 소문내지 말고요.'], got: '이상한 캔을 주웠어요', reward: { gyul: 10 } },
    { id: 'heap1', z: 1, giver: 'jigi', name: '첫 청소', say: ['길가에 쌓인 더미 하나만 깨끗이 치워 봐요.', '다 치우면 꽃이 펴요. 오름은 은혜를 꽃으로 갚거든요.'], task: '길가 더미 1곳 다 치우기', ask: { k: 'heapRoad', n: 1 }, go: 'heapRoad', fin: ['봐요, 꽃 폈죠?', '근데 내일 와 보면 또 쌓여 있을 거예요. 누가 자꾸 갖다 놓는지 원.'], reward: { gyul: 20 } },
    { id: 'dump2', z: 1, giver: 'jigi', name: '클린하우스 단골', say: ['배낭이 무거우면 클린하우스에 비워요.', '분리만 잘 하면 귤로 바꿔 줘요. 세상에 이런 장사가 없죠.'], task: '클린하우스에 2번 버리기', ask: { k: 'recycle', n: 2 }, go: 'ch', fin: ['단골 됐네요. 클린하우스 아저씨가 웃는 거 처음 봤어요.'], reward: { gyul: 20 } },
    { id: 'piglet3', z: 1, giver: 'jigi', name: '귤은 던지라고 있는 것', say: ['아기 멧돼지들이 길을 헤집고 다녀요.', '귤 하나 맞으면 놀라서 도망가요. 다치게 하는 건 아니에요, 그냥 귤이 싫은 거예요.'], task: '아기 멧돼지 3마리 쫓아내기', ask: { k: 'repel:piglet', n: 3 }, go: 'den@1', fin: ['던지는 폼이 좋던데요? 귤 농사 지어 본 손이에요.'], reward: { gyul: 30 } },
    { id: 'gear1', z: 1, giver: 'jigi', name: '장비가 사람을 만든다', say: ['맨날 손으로만 줍다간 허리 나가요.', '가게 거리 장비점에서 집게든 배낭이든 한 칸 올려 봐요.'], task: '집게나 배낭 한 칸 올리기', ask: { k: 'gearTB', n: 1 }, go: 'shop:gear', fin: ['오, 장비 반짝반짝하네요. 사람이 달라 보여요.'], reward: { gyul: 30 }, need: 'shop:gear' },
    { id: 'dumper1', z: 1, giver: 'jigi', name: '불청객', say: ['가끔 봉투 들고 몰래 오는 사람들이 있어요. 무단 투기꾼.', '버리기 전에 귤을 맞히면 줄행랑쳐요. 다음에 오면 꼭 혼내 줘요.'], task: '무단 투기꾼 1명 쫓아내기', ask: { k: 'dumper', n: 1 }, fin: ['도망가는 거 봤어요? 봉투도 안 놓고 가더라고요. 그 봉투 안엔 뭐가 들었을까요.'], reward: { gyul: 20 } },
    { id: 'field1', z: 1, giver: 'jigi', name: '들판 탐사', say: ['길만 다니면 오름의 반도 못 본 거예요.', '들판 깊숙이 큰 더미가 있어요. 대신 길 밖엔 짐승이 많으니 조심하고요.'], task: '들판 더미 1곳 치우기', ask: { k: 'heapField', n: 1 }, go: 'heapField', fin: ['들판까지 다녀오다니. 이상한 캔, 거기서도 나왔죠? 역시…'], reward: { gyul: 40 } },
    { id: 'den1', z: 1, giver: 'jigi', name: '소굴 정리', say: ['멧돼지들이 모이는 굴이 숲길에 있어요.', '굴 앞에서 한바탕 쫓아내면 한동안 조용해요.'], task: '숲길 적 소굴 1곳 닫기', ask: { k: 'den@1', n: 1 }, go: 'den@1', fin: ['굴이 조용해졌어요. 그런데 그 큰 녀석은 아직 안 나왔죠?'], reward: { gyul: 50 } },
    { id: 'boss1', z: 1, giver: 'jigi', name: '구역의 주인', say: ['숲길이 거의 깨끗해지면 그 녀석이 나와요. 왕관 쓴 멧돼지.', '쫓아내면 이 구역은 당신 거예요. 하르방도 세워 줄 거고요.'], task: '숲길 우두머리 쫓아내기', ask: { k: 'boss@1', n: 1, ever: true }, go: 'boss@1', fin: ['해냈네요! 숲길 지킴이예요.', '하르방은 꼭 치운 자리에만 솟는다니까. 신기하죠.'], reward: { gyul: 100 } },
    { id: 'z2', z: 1, giver: 'jigi', to: 'b:slope', name: '다음 오름 자락으로', say: ['그 캔 말인데요, 숲길 위쪽에서 더 많이 나온대요.', '남쪽 사면 클린하우스 옆 표지판까지 가 봐요. 거기서부턴 표지판이 내 말을 대신해요.'], task: '남쪽 사면 표지판 읽기', ask: { k: 'zone', n: 2, ever: true }, go: 'b:slope', fin: ['[표지판] 남쪽 사면. 여기까지 왔으면 반은 오름 사람.', '— 오름지기. 추신: 투기꾼 봉투 조심.'], reward: { gyul: 20 } },
    // ----- 2장 남쪽 사면 '누가 시켰나' (둘째 날) -----
    { id: 'note', z: 2, giver: 'b:slope', name: '떨어진 쪽지', say: ['[표지판] 투기꾼들이 요즘 바빠 보임.', '하나 붙잡으면, 아니 쫓아 보면 뭔가 떨어뜨릴지도.'], task: '투기꾼 1명 쫓아내기', ask: { k: 'dumper', n: 1 }, fin: ['투기꾼이 쪽지를 떨어뜨렸어요: \'굼부리로 가져오면 귤로 쳐 줌\'', '누군가 쓰레기를 모으고 있어요. 대체 누가, 왜?'], got: '구겨진 쪽지를 주웠어요', reward: { gyul: 30 } },
    { id: 'heap2', z: 2, giver: 'b:slope', name: '사면 대청소', say: ['[표지판] 남쪽 사면 더미 현황: 많음.', '치우는 사람 구함. 보수: 귤.'], task: '남쪽 사면 더미 3곳 치우기', ask: { k: 'heap@2', n: 3 }, go: 'heap@2', fin: ['[표지판] 더미 현황: 조금 덜 많음. 고마움.'], reward: { gyul: 60 } },
    { id: 'dog5', z: 2, giver: 'b:slope', name: '들개 주의', say: ['[표지판] 들개 출몰. 귤을 싫어함.', '귤을 아주 싫어함.'], task: '들개 5마리 쫓아내기', ask: { k: 'repel:dog', n: 5 }, go: 'den@2', fin: ['[표지판] 들개 출몰 → 들개 가끔 출몰. 고쳐 씀.'], reward: { gyul: 80 } },
    { id: 'gear2', z: 2, giver: 'b:slope', name: '한 단계 위로', say: ['[표지판] 이 위로는 장비 점검 권장.', '장비점에서 두 칸 올리고 오시오.'], task: '장비 두 칸 올리기', ask: { k: 'gearAll', n: 2 }, go: 'shop:gear', fin: ['[표지판] 장비 점검 끝. 든든함.'], reward: { gyul: 80 }, need: 'shop:gear' },
    { id: 'den2', z: 2, giver: 'b:slope', name: '들개 무리 터', say: ['[표지판] 들개들이 모이는 터가 사면에 있음.', '터를 정리하면 사면이 한결 조용해짐.'], task: '남쪽 사면 소굴 1곳 닫기', ask: { k: 'den@2', n: 1 }, go: 'den@2', fin: ['[표지판] 터 정리 끝. 이제 그 큰 놈만 남음.'], reward: { gyul: 100 } },
    { id: 'boss2', z: 2, giver: 'b:slope', name: '사면의 주인', say: ['[표지판] 사면이 깨끗해지면 우두머리 들개가 나옴.', '쫓아내면 사면도 당신 차지.'], task: '남쪽 사면 우두머리 쫓아내기', ask: { k: 'boss@2', n: 1, ever: true }, go: 'boss@2', fin: ['[표지판] 사면의 주인이 바뀜. 축하함.'], reward: { gyul: 200 } },
    { id: 'z3', z: 2, giver: 'b:slope', to: 'b:rest', name: '밤의 불빛', say: ['[표지판] 밤마다 능선 위에 불빛이 뜬다는 소문.', '능선 쉼터 표지판에 가 보시오. 해 지기 전에.'], task: '능선 쉼터 표지판 읽기', ask: { k: 'zone', n: 3, ever: true }, go: 'b:rest', fin: ['[표지판] 능선. 밤에 하늘을 보면 뭔가 지나감.', '그것은 비행기가 아님. 아마도.'], reward: { gyul: 40 } },
    // ----- 3장 능선 '밤의 불빛' -----
    { id: 'heap3', z: 3, giver: 'b:rest', name: '내려놓고 간 것', say: ['[표지판] 불빛이 지나간 자리에 더미가 생김.', '멧돼지가 사나워진 것도 그 더미 탓이라는 말이 있음.'], task: '능선 더미 3곳 치우기', ask: { k: 'heap@3', n: 3 }, go: 'heap@3', fin: ['[표지판] 더미 속에 그 캔이 잔뜩. 누가 하늘에서 버리고 감.', '그럼 그 쪽지의 \'굼부리\'는?'], reward: { gyul: 150 } },
    { id: 'den3', z: 3, giver: 'b:rest', name: '사나운 굴', say: ['[표지판] 능선 멧돼지 굴 주의.', '캔 냄새를 맡고 모여든다고 함.'], task: '능선 소굴 1곳 닫기', ask: { k: 'den@3', n: 1 }, go: 'den@3', fin: ['[표지판] 굴이 잠잠해짐. 냄새도 덜 남.'], reward: { gyul: 200 } },
    { id: 'boss3', z: 3, giver: 'b:rest', name: '능선의 주인', say: ['[표지판] 능선의 큰 멧돼지가 길을 막고 있음.', '이 녀석만 지나면 굼부리가 보임.'], task: '능선 우두머리 쫓아내기', ask: { k: 'boss@3', n: 1, ever: true }, go: 'boss@3', fin: ['[표지판] 능선이 열림. 굼부리로 가는 길도.'], reward: { gyul: 500 } },
    { id: 'z4', z: 3, giver: 'b:rest', to: 'b:crater', name: '굼부리로', say: ['[표지판] 쪽지가 말한 곳, 굼부리.', '굼부리 들머리 표지판에서 기다리겠음.'], task: '굼부리 표지판 읽기', ask: { k: 'zone', n: 4, ever: true }, go: 'b:crater', fin: ['[표지판] 굼부리 바닥에 낯선 표지판이 하나 더 있다고 함.', '누가 세웠는지 아무도 모름.'], reward: { gyul: 80 } },
    // ----- 4장 굼부리 '클린하우스' -----
    { id: 'heap4', z: 4, giver: 'b:crater', name: '굼부리 바닥', say: ['[표지판] 굼부리 바닥은 쓰레기로 덮여 있음.', '치우다 보면 그 낯선 표지판이 보일 것.'], task: '굼부리 더미 3곳 치우기', ask: { k: 'heap@4', n: 3 }, go: 'heap@4', fin: ['낯선 표지판을 찾았어요. 우리 클린하우스와 똑같은 모양이에요.', '거기 적힌 이름은… \'지구\'. 지구와 오름이 통째로 외계인의 클린하우스였어요.'], reward: { gyul: 400 } },
    { id: 'den4', z: 4, giver: 'b:crater', name: '착륙 자국', say: ['[표지판] 우리가 귤로 바꿔 주던 클린하우스도 원래 그들이 세운 것.', '굼부리의 굴부터 닫아 버리시오.'], task: '굼부리 소굴 1곳 닫기', ask: { k: 'den@4', n: 1 }, go: 'den@4', fin: ['[표지판] 굴 하나 닫힘. 그들이 알아챘을 것.'], reward: { gyul: 500 } },
    { id: 'boss4', z: 4, giver: 'b:crater', name: '굼부리의 주인', say: ['[표지판] 굼부리를 지키는 녀석이 있음.', '이걸 넘으면 정상. 그들이 기다리는 곳.'], task: '굼부리 우두머리 쫓아내기', ask: { k: 'boss@4', n: 1, ever: true }, go: 'boss@4', fin: ['[표지판] 정상으로 가는 길이 열림. 오름 사람들이 귤을 챙기는 중.'], reward: { gyul: 1200 } },
    { id: 'z5', z: 4, giver: 'b:crater', to: 'b:rest', name: '저항', say: ['[표지판] 오름지기, 가게 주인들, 동료들 모두 정상으로 감.', '능선 쉼터 표지판에서 모이기로 함.'], task: '정상 구역에 들어서기', ask: { k: 'zone', n: 5, ever: true }, go: 'b:rest', fin: ['[표지판] 모두 모였음. 귤 장전 완료.'], reward: { gyul: 200 } },
    // ----- 5장 정상 '저항' → 끝 '사과' -----
    { id: 'heap5', z: 5, giver: 'b:rest', name: '규정대로 버렸을 뿐', say: ['외계인들이 말해요: \'우리는 규정대로 버렸을 뿐.\'', '규정이 틀렸다는 걸 보여 줘요. 정상부터 치워요.'], task: '정상 더미 3곳 치우기', ask: { k: 'heap@5', n: 3 }, go: 'heap@5', fin: ['외계인들이 웅성거려요. 깨끗한 클린하우스는 처음 봤대요.'], reward: { gyul: 1000 } },
    { id: 'den5', z: 5, giver: 'b:rest', name: '착륙장 봉쇄', say: ['정상에 그들의 착륙 자국이 있어요.', '거길 막으면 더는 못 내려와요.'], task: '정상 소굴 1곳 닫기', ask: { k: 'den@5', n: 1 }, go: 'den@5', fin: ['착륙장이 막혔어요. 이제 남은 건 대장뿐.'], reward: { gyul: 1200 } },
    { id: 'boss5', z: 5, giver: 'b:rest', name: '불편을 줘서', say: ['외계인 대장이 내려와요.', '오름 사람 모두가 당신 뒤에 있어요. 귤을 던져요!'], task: '정상 우두머리 쫓아내기', ask: { k: 'boss@5', n: 1, ever: true }, go: 'boss@5', fin: ['외계인이 자기들 쓰레기를 도로 싣고, 안내서의 \'지구: 클린하우스\' 를 지웠어요.', '그래도 사람들이 버린 쓰레기는 남았어요. 청소는 계속돼요. 다른 오름에도 같은 표지판이 있다는데…'], reward: { gyul: 3000 }, ending: '불편을 줘서 죄송합니다.' },
  ],
  side: [
    // 오름지기 곁가지 (첫 청소 뒤)
    { id: 'x-fish', giver: 'jigi', after: 'heap1', name: '물멍', say: ['들머리 개울에서 낚시 한 번 해 봐요.', '쓰레기가 낚여도 그건 그거대로 좋은 일이에요.'], task: '낚시 한 번', ask: { k: 'fish', n: 1 }, fin: ['뭐가 낚였든 개울은 조금 더 맑아졌어요.'], reward: { gyul: 10 } },
    { id: 'x-stone', giver: 'jigi', after: 'heap1', name: '돌 하나', say: ['돌탑에 돌 하나 올려 봐요. 소원은 공짜예요.'], task: '돌탑에 돌 하나', ask: { k: 'stone', n: 1 }, go: 'cairn', fin: ['무슨 소원 빌었어요? 아니, 말하지 마요.'], reward: { gyul: 5 } },
    { id: 'x-meal', giver: 'jigi', after: 'dump2', name: '밥은 먹고 다녀요', say: ['가게 거리 스톤에서 한 끼 먹고 와요. 든든해야 오래 줍죠.'], task: '스톤에서 식사 한 번', ask: { k: 'meal', n: 1 }, go: 'shop:stone', fin: ['얼굴이 폈네요.'], reward: { gyul: 10 }, need: 'shop:stone' },
    { id: 'x-browse', giver: 'jigi', after: 'dump2', name: '마을 구경', say: ['가게 거리에 미장원이랑 옷 가게도 있어요.', '사지 않아도 구경은 공짜.'], task: '루이네미장원이나 LEAP 구경', ask: { k: 'browse', n: 1 }, go: 'shop:salon', fin: ['구경 잘 했어요? 다음엔 지갑도 데려가요.'], reward: { gyul: 5 }, need: 'shop:salon' },
    // 장비점 주인 (첫 버리기 뒤, 감독 문 shopQuest)
    { id: 'g-tool', giver: 'shop:gear', door: 'shopQuest', name: '손에 맞는 집게', say: ['그 집게, 손에 안 맞지? 딱 보면 알아.', '한 단계 위 걸로 바꿔 봐. 줍는 게 달라져.'], task: '도구 한 단계 올리기', ask: { k: 'tool', n: 1 }, go: 'shop:gear', fin: ['거봐, 손목이 안 아프지?'], reward: { coupon: ['gear', 1] } },
    { id: 'g-bag', giver: 'shop:gear', door: 'shopQuest', after: 'g-tool', name: '배낭은 클수록 좋다', say: ['배낭 작으면 클린하우스만 들락날락해.', '큰 걸로 하나 장만해.'], task: '배낭 한 단계 올리기', ask: { k: 'bag', n: 1 }, go: 'shop:gear', fin: ['이제 좀 오름 사람 같네.'], reward: { coupon: ['gear', 1] } },
    { id: 'g-arm', giver: 'shop:gear', door: 'shopQuest', after: 'g-bag', name: '귤도 도구다', say: ['맨손으로 귤 던지는 거, 그거 팔 빠져.', '무기 하나 들여놔.'], task: '무기 하나 사기', ask: { k: 'weapon', n: 1, ever: true }, go: 'shop:gear', fin: ['귤이 날아가는 소리부터 다르지?'], reward: { coupon: ['gear', 1] } },
    { id: 'g-up', giver: 'shop:gear', door: 'shopQuest', after: 'g-arm', name: '강화 한 번 해 보기', say: ['재료 모아 왔으면 한 번 올려 봐.'], task: '장비 강화 한 번', ask: { k: 'upgrade', n: 1 }, go: 'shop:gear', fin: ['반짝반짝하구먼.'], reward: { coupon: ['gear', 1] }, need: 'loot' },
    // LEAP 점원 (2일·구역 2, 문 shopQuests)
    { id: 'l-wear', giver: 'shop:leap', door: 'shopQuests', name: '옷이 날개', say: ['오름도 런웨이예요.', '옷 한 벌 골라 입어 봐요.'], task: 'LEAP 에서 옷 한 벌 사기', ask: { k: 'clothes', n: 1 }, go: 'shop:leap', fin: ['완벽해요. 사진 찍고 싶다.'], reward: { coupon: ['leap', 1] }, need: 'shop:leap' },
    { id: 'l-codi', giver: 'shop:leap', door: 'shopQuests', after: 'l-wear', name: '오늘의 코디', say: ['모자·티·바지 색 맞춰 입고', '정상 사진사한테 한 장 찍혀 와요.'], task: '사진사에게 사진 찍기', ask: { k: 'photo', n: 1 }, fin: ['이거 매장에 걸어도 돼요? 선물이에요, 양말.'], reward: { item: 'socks:w-stripe' }, need: 'shop:leap' },
    // 루이네미장원 원장
    { id: 's-cut', giver: 'shop:salon', door: 'shopQuests', name: '기분 전환', say: ['바람에 머리가 다 날렸네.', '한 번 바꿔 봐요. 기분이 달라져요.'], task: '머리 한 번 바꾸기', ask: { k: 'haircut', n: 1 }, go: 'shop:salon', fin: ['어머, 잘 어울려.'], reward: { coupon: ['salon', 1] }, need: 'shop:salon' },
    { id: 's-hi', giver: 'shop:salon', door: 'shopQuests', after: 's-cut', name: '소문 좀 내 줘요', say: ['우리 가게 소문 좀 내 줘요.', '만나는 사람한테 인사 세 번만.'], task: '동작으로 인사 3번', ask: { k: 'emote', n: 3 }, fin: ['손님이 늘었어요. 다음 머리는 반값!'], reward: { coupon: ['salon', 1] }, need: 'shop:salon' },
    // 스톤 셰프
    { id: 'c-meal', giver: 'shop:stone', door: 'shopQuests', name: '첫 끼', say: ['오름 사람은 밥심이에요.', '아무거나 한 그릇 먹고 가요.'], task: '스톤에서 식사 한 번', ask: { k: 'meal', n: 1 }, go: 'shop:stone', fin: ['잘 먹었죠? 에이드는 서비스.'], reward: { coupon: ['ade', 1] }, need: 'shop:stone' },
    { id: 'c-fish', giver: 'shop:stone', door: 'shopQuests', after: 'c-meal', name: '재료 구해 오기', say: ['오늘 생선이 똑 떨어졌어요.', '개울에서 두 번만 낚아 와 줘요.'], task: '낚시 2번', ask: { k: 'fish', n: 2 }, fin: ['신선하네요! 에이드 한 잔 더.'], reward: { coupon: ['ade', 1] }, need: 'shop:stone' },
    { id: 'c-full', giver: 'shop:stone', door: 'shopQuests', after: 'c-fish', name: '든든하게 한 판', say: ['밥 먹었으면 힘 써야죠.', '식사 버프가 있을 때 적 10마리.'], task: '식사 버프 중 적 10마리 쫓기', ask: { k: 'repelBuff', n: 10 }, fin: ['역시 밥심! 에이드는 내가 쏠게요.'], reward: { coupon: ['ade', 1] }, need: 'shop:stone' },
    // 만족한상회 사장 (#167 가게가 들어오면)
    { id: 'm-eat', giver: 'shop:satis', door: 'shopQuests', name: '갈치는 뼈가 없다', say: ['우리 갈치 먹어 봤어요?'], task: '만족한상 먹기', ask: { k: 'satisMeal', n: 1 }, go: 'shop:satis', fin: ['그쵸? 뼈가 없죠?'], reward: { coupon: ['satis', 1] }, need: 'shop:satis' },
    // ----- 이야기 이벤트 뒤 (#168): '오름지기에게 이야기하기'. 이벤트를 끝냈으면(need·ask 'story:id') 오름지기가 실마리를 한 줄 -----
    { id: 'st-mom', giver: 'jigi', name: '엄마 멧돼지', say: ['엄마 멧돼지를 만났다면서요?', '멧돼지들이 요즘 왜 이렇게 사나운지 저도 궁금해요.'], task: '오름지기에게 이야기하기', ask: { k: 'story:mom', n: 1, ever: true }, fin: ['…밤에 능선 쪽을 한번 봐요. 말은 거기까지.'], reward: { gyul: 5 }, need: 'story:mom' },
    { id: 'st-pair', giver: 'jigi', name: '둘이 다니는 투기꾼', say: ['투기꾼들이 둘씩 다닌다고요?', '누가 그 사람들한테 귤을 주는 걸까요.'], task: '오름지기에게 이야기하기', ask: { k: 'story:pair', n: 1, ever: true }, fin: ['쪽지 같은 걸 흘리면 꼭 주워 와요.'], reward: { gyul: 5 }, need: 'story:pair' },
    { id: 'st-night', giver: 'jigi', name: '어디서 온 걸까?', say: ['그 캔, 어디서 났어요?', '…하늘에서요?'], task: '오름지기에게 이야기하기', ask: { k: 'story:night', n: 1, ever: true }, fin: ['오름 쓰레기는 다 사람이 버린 줄 알았는데.'], reward: { gyul: 5 }, need: 'story:night' },
    { id: 'st-howl', giver: 'jigi', name: '긴 울음', say: ['들개 대장 울음 들었어요?'], task: '오름지기에게 이야기하기', ask: { k: 'story:howl', n: 1, ever: true }, fin: ['무리를 부르는 건 지킬 게 있다는 뜻이에요.'], reward: { gyul: 5 }, need: 'story:howl' },
    { id: 'st-meet', giver: 'jigi', name: '멧돼지 가족회의', say: ['멧돼지들이 모여서 회의를 했다고요?', '다들 하늘을 보고 있었다니.'], task: '오름지기에게 이야기하기', ask: { k: 'story:meet', n: 1, ever: true }, fin: ['밤에 능선 위로 뭔가 내려온 뒤부터예요. 걔들이 사나워진 게.'], reward: { gyul: 5 }, need: 'story:meet' },
    { id: 'st-sign', giver: 'jigi', name: '쓰러진 표지판', say: ['광견병 주의 표지판, 누가 쓰러뜨렸을까요.'], task: '오름지기에게 이야기하기', ask: { k: 'story:sign', n: 1, ever: true }, fin: ['굼부리 바닥엔 오래된 표지판이 하나 더 있대요. 처음 보는 글씨로.'], reward: { gyul: 5 }, need: 'story:sign' },
    { id: 'st-ufo', giver: 'jigi', name: '불법 주차', say: ['UFO 가 쓰레기를 쏟고 굼부리로 갔다고요?'], task: '오름지기에게 이야기하기', ask: { k: 'story:ufo', n: 1, ever: true }, fin: ['이제 다 같이 맞설 때예요. 귤 챙겨요.'], reward: { gyul: 5 }, need: 'story:ufo' },
  ],
};

// 다음 할 일 (#142, src/game/nexthint.js): 퀘스트 추적 줄을 잠깐 바꾸는 안내와, 줄기 퀘스트가 끝난 사람에게 이어 줄 것
// hpLow 이 비율 밑이면(싸우는 중 tension 이 calm 넘으면 빼고) '스톤에서 식사', hpOk 까지 차거나 hpT 초 지나면 끝
// shopT 귤이 새로 다음 장비 값에 닿으면 이만큼 '장비점으로' (장비점 창을 열거나 문 shopR m 안에 오면 끝, 같은 장비로 다시 권하지 않음)
// bagRoom 배낭 남은 칸이 이보다 작으면 '클린하우스로'
// after: 줄기 퀘스트가 끝난 뒤 차례 (강화 → 전설 우두머리 → 오늘의 업적 → 다시 쌓인 더미 → 소굴 → 돌탑). 모두 임의값
export const NEXT_HINT = { hpLow: 0.35, hpOk: 0.7, hpT: 60, calm: 0.5, shopT: 45, shopR: 6, bagRoom: 1, after: ['forge', 'legend', 'daily', 'heap', 'den', 'cairn'] };

// 철 이벤트 (#180): 기간 안에만 켜짐(한국 시각). 꾸밈·연결은 src/season.js(모양)·src/seasoncal.js(날짜·달력·트리, 서버와 같이 씀)·src/game/season.js(게임)
// 다음 철(설·여름)은 여기 한 묶음을 더하고 season.js 에 모양을 더하면 됨. 기간이 끝나도 얻은 옷은 남고, 눈덩이는 기간에만 던짐
// 값은 모두 임의(이슈 #180). 이벤트로 얻는 귤은 기간 평균 하루 벌이의 10% 안 (tools/econ.js 가 셈)
export const SEASON = {
  xmas: {
    from: [12, 1], to: [12, 31], // 12월 1일 00:00 ~ 12월 31일 23:59 (KST)
    snowZones: [4, 5], // 눈이 쌓이는 구역 (굼부리·정상). 눈덩이도 여기서만
    snow: 0.85, // 쌓인 눈 짙기 (땅·풀)
    bulbs: { lamp: 12, lampLow: 6, eave: 14, eaveLow: 7, blink: 1.3 }, // 가로등 하나·가게 처마 하나에 꼬마전구 수, 깜빡임 빠르기
    tree: { step: 3000, stages: 10, gift: 300, poll: 120, at: [-9, 12] }, // 트리: 모두가 주운 쓰레기 step 개마다 한 단계, 마지막 단계는 꼭대기 귤 별. 다 채우면 선물 귤, 서버 다시 묻기(초). at = 들머리 출발점에서 [옆(오른쪽 +), 앞] m
    cal: { days: 25, miss: 50, coins: [30, 100], every: 5 }, // 접속 달력 12월 1~25일: 귤 30~100, every 일마다 겨울 옷(25일은 눈덩이), 놓친 날은 귤 miss 로 열기
    calCloth: { 5: 'hat:x-santa', 10: 'vest:x-scarf', 15: 'hat:x-rudolph', 20: 'socks:x-boots' }, // 달력 옷 (25일 = 눈덩이)
    santa: { p: 1 / 3, gift: 0.1, coins: [20, 60], dayMax: 4, giftMax: 2 }, // 투기꾼 3명 중 1명이 산타. 쫓으면 선물 상자: 귤 또는 (gift 확률) 겨울 옷. 하루 dayMax 개까지, 옷은 모두 giftMax 벌까지
    snowball: { slow: 0.2, slowT: 1.5, color: '#f4f8ff' }, // 눈덩이: 피해는 손과 같고 맞은 적이 slowT 초 동안 slow 만큼 느려짐. 귤을 쓰지 않음
    music: { gain: 0.5, bell: [2, 5] }, // 겨울 판 배경음: 종·방울 한 겹 (크기, 방울 사이 초)
    radio: { every: [150, 300] }, // 성탄 인사 사이(초)
    lines: [
      '산타는 굴뚝으로, 쓰레기는 클린하우스로',
      '루돌프 코가 빨간 건 추워서입니다. 멧돼지 코가 빨간 건 저희도 모릅니다',
      '올해 착한 일 목록: 쓰레기 줍기. 나쁜 일 목록: 쓰레기 버리기',
      '선물 포장지는 종이류입니다. 리본은 아닙니다',
      '오늘 밤 하늘에 썰매가 보여도 놀라지 마세요. 아마 그냥 UFO 입니다',
      '눈사람은 굼부리에서. 눈덩이는 멧돼지에게',
      '트리에 귤이 달릴수록 오름이 따뜻해집니다',
      '메리 크리스마스. 귤 뱅쇼는 스톤에서',
      '산타 옷을 입은 투기꾼을 보면 신고 대신 귤을 던져 주세요',
      '올겨울 가장 좋은 선물은 깨끗한 오름입니다',
    ],
  },
};

// 오름펑크 세계 (#165): 오름 방송·읽을 수 있는 쪽지·칭호. 글은 src/punktext.js, 게임 연결은 game/punkworld.js
// radio.every 방송 사이 [최소, 최대] 초 · sec 자막 띠가 흐르는 초 · r 스피커 기둥에서 이 m 안에서만 들림 · first 문(JOURNEY 'radio')이 열린 뒤 첫 방송까지 초
//   situ 상황 방송이 생기면 다음 방송을 이 초 안으로 당김 · situTtl 상황 방송이 기다리는 최대 초 · spots 스피커 자리 [들머리 길 approach 거리(정낭 TUT.gateD 에서), 쪽, 옆 m], 가게 거리 골목 [s, 쪽]
// note.p 쓰레기 하나 주울 때 쪽지가 나올 확률 (쓰레기 수·귤은 보통 쓰레기와 같음)
// stare 멧돼지와 눈싸움: 멧돼지(아기 포함)가 r m 안에서 sec 초 동안 안 맞음 · unpaid 하루 쓰레기 수 (칭호 '오늘도 무급')
export const PUNK = {
  radio: { every: [480, 900], sec: 6, r: 60, first: 20, situ: 8, situTtl: 600, trail: [18, -1, 4.6], street: [5.4, 1], poleH: 5.2 },
  note: { p: 0.02 },
  stare: { r: 8, sec: 10, kinds: ['boar', 'piglet'] },
  unpaid: 500,
};

// 레벨과 증강 (#159, src/augments.js·src/game/level.js). 값은 모두 임의 (tools/econ.js 로 맞춤)
// 경험치: 쓰레기 하나 trash, 더미를 다 치우면 heap(쓰레기 산 mt), 적을 쫓아내면 그 적 귤 보상 × enemyK, 우두머리 boss, 투기꾼 dumper, 퀘스트 quest[최소, 최대] (#158 이 값을 골라 줌)
// 레벨 L → L+1 에 round(base × L^pow), 최고 max. 레벨업마다 증강 하나를 고름 (고를 수 = 레벨 - 1)
// reroll: 다시 뽑기 한 번 값(귤). safe: 싸움이 끝나고 이 초 뒤에 고르기 창을 엶. guard: 멀티에서 창을 연 동안 받지 않는 시간(초)
// glow: 레벨업 빛 시간(초)·반지름(m), barMs: 경험치 띠가 차오르는 시간
export const LEVEL = {
  base: 70, pow: 1.6, max: 30,
  xp: { trash: 1, heap: 10, mt: 40, enemyK: 0.2, enemyMin: 1, boss: 100, dumper: 5, quest: [20, 60] },
  reroll: 50, safe: 1.5, guard: 2,
  glow: { t: 1.4, r: 2.2 }, barMs: 600,
};
// 증강 12종 (세 갈래 × 4). v = 한 번 고를 때 더하는 값, 최대 max 번 겹침. 수치는 작게: 3번 겹쳐도 장비 한 단계(#137, 2배 넘는 도약)보다 훨씬 작게
// 셈은 src/augments.js augV(save, id) = 겹친 수 × v. 장비·식사 능력치에 더해짐(곱하지 않음). 장비 점수(gearscore.js)에는 넣지 않음
// text: 카드 한 줄 ({v} 자리에 1번 값), sec·r: 지속 초·반지름
export const AUGMENTS = {
  max: 3,
  branches: [{ id: 'clean', name: '청소', color: '#5aa55a' }, { id: 'fight', name: '전투', color: '#e0583c' }, { id: 'live', name: '생존', color: '#4a86c8' }],
  list: [
    { id: 'bighand', br: 'clean', name: '큰손', v: 0.15, text: '{v}% 확률로 쓰레기 1개 더' },
    { id: 'magnet', br: 'clean', name: '자석 귤', v: 0.4, text: '귤 모이는 범위 +{v}m' },
    { id: 'flower', br: 'clean', name: '꽃길', v: 0.08, sec: 8, text: '더미를 치우면 8초 이동 +{v}%' },
    { id: 'recycle', br: 'clean', name: '분리수거 달인', v: 0.03, text: '클린하우스 귤 +{v}%' },
    { id: 'twin', br: 'fight', name: '쌍귤', v: 0.04, text: '{v}% 확률로 한 발 더 (귤은 그대로)' },
    { id: 'burst', br: 'fight', name: '터지는 귤', v: 0.04, r: 1.5, text: '맞은 둘레 1.5m 에 피해 {v}%' },
    { id: 'sour', br: 'fight', name: '신 귤', v: 0.1, sec: 1.5, text: '맞은 적 1.5초 {v}% 느려짐' },
    { id: 'quick', br: 'fight', name: '빠른 손', v: 0.08, text: '모아 쏘기 시간 -{v}%' },
    { id: 'bite', br: 'live', name: '귤 한 입', v: 2, text: '적을 쫓아내면 기운 +{v}' },
    { id: 'light', br: 'live', name: '가벼운 발', v: 0.02, text: '이동 +{v}%' },
    { id: 'jacket', br: 'live', name: '두꺼운 잠바', v: 0.03, text: '받는 피해 -{v}%' },
    { id: 'deer', br: 'live', name: '노루 친구', v: 0.04, text: '탈것 속도 +{v}%' },
  ],
};
// 배낭 겉모습 (#164 오름펑크): 배낭 능력 단계는 그대로, 모양만 바꿈. 장비점에서 사고 내 가방 배낭 탭에서 고름
// 저장 save.backs = { own: { id: 1 }, cur: id | null }. need = 이 배낭 단계 이상일 때 고를 수 있음. 서버 validate.js 가 값 확인
export const BACK_LOOKS = [
  { id: 'tewak', name: '해녀 테왁 배낭', price: 800, need: 3, desc: '물에 빠지면 둥둥 떠요. 숨비소리는 덤', float: true },
];
// 테왁으로 물에 뜨기 (#164): 개울에서 빠지지 않고 떠서 지나감
export const TEWAK = {
  speed: 0.7, // 물 위 이동 빠르기 배수
  sink: 0.62, // 물낯에서 몸이 잠기는 깊이 (m)
  bob: 0.06, bobHz: 1.6, // 둥둥 흔들림
  ringEvery: 0.7, // 물결 고리 간격(초)
  fill: [0.34, 0.67], // 망사리 불룩 단계: 배낭이 이만큼 차면 1·2단계
};
// 박스 시야 (#164): 감귤 박스 헬멧을 쓰면 화면 가장자리 테두리. 화면 폭 비율 (폰 600px 이하 phone)
export const BOX_VIEW = { desk: 0.06, phone: 0.04 };


// 동료 캐릭터 3명 (#172, game/buddies.js). 게임이 움직이는 캐릭터(외부 AI 호출 없음), 내 화면에만. 대사는 src/buddylines.js
// list: id·이름·문(JOURNEY.doors)·성격(pick 줍는 빠르기 배수, fight 'chase' 달려가 던짐 | 'flee' 물러남, photo 경치 찍으며 멈추는 몫)·옷(outfit.gear)·피부·몸
// near/far: 플레이어에서 이 거리 안에 머묾(m), 너무 멀면(far 넘으면) 플레이어 쪽으로. greet: 이 거리 안에 오면 돌아보고 손 흔듦(한 번 지나간 뒤 다시 다가와야 또)
// share: 셋이 합쳐 플레이어가 줍는 속도의 몫까지만 실제 더미를 줄임(플레이어가 하나 주우면 share 만큼 몫이 생김, 몫은 bank 까지 모임)
// keep: 더미의 마지막 이만큼(비율)은 남김(다 치우는 연출·보상은 플레이어 몫. 서버도 같은 값으로 거름)
// peers: 방에 사람이 [a] 명 넘으면 1명, [b] 명 넘으면 0명. low: 저사양(TIER 0) 최대 명 수
// follow: '같이 가요' 시간(초)·뒤 거리(m). throw: 민수 던지기 간격(초)·사거리(m)·달려오는 거리(m). hurt: 맞으면 물러나는 시간(초)
export const BUDDIES = {
  list: [
    { id: 'sunja', name: '순자 삼춘', door: 'mateSunja', pick: 1.4, fight: 'flee', photo: 0, body: 'f', skin: 1,
      gear: { hair: 'hat:bun', hat: 'hat:w-straw', top: 'top:w-stripe', bottom: 'bottom:w-gal', shoes: 'shoes:slip', hand: 'hand:tongs', back: 'back:none' } },
    { id: 'minsu', name: '펑크 민수', door: 'mateMinsu', pick: 0.9, fight: 'chase', photo: 0, body: 'm', skin: 0,
      gear: { hair: 'hat:short', hat: 'hat:w-cap', top: 'top:w-tee~7', bottom: 'bottom:w-long', vest: 'vest:w-old', shoes: 'shoes:s3', hand: 'hand:none', back: 'back:none' } },
    { id: 'jenny', name: '관광객 제니', door: 'mateJenny', pick: 0.5, fight: 'flee', photo: 0.35, body: 'f', skin: 0,
      gear: { hair: 'hat:bob', hat: 'hat:w-bucket', top: 'top:w-tee~5', bottom: 'bottom:w-cargo', face: 'face:sunglass', shoes: 'shoes:s2', hand: 'hand:none', back: 'back:round' } },
  ],
  near: 20, far: 120, roam: [25, 90], greet: 6, greetGap: 25,
  walk: 2.2, run: 5.2, pickTime: 1.6, pickR: 1.4, seekR: 60,
  share: 0.3, bank: 6, keep: 0.2,
  peers: [4, 8], low: 1,
  follow: { sec: 600, d: 8 },
  throw: { every: 1, range: 16, rush: 40, speed: 16 },
  hurt: 3, hitR: 1.6,
  cheerR: 150, worryR: 80, ambient: [70, 150], talkR: 3,
  avoid: { player: 1.4, door: 4, npc: 7 }, // npc: 오름지기(들머리 안내판)·사진사 둘레
};

// 게임 안 촬영 모드 (#185, game/rec.js). 캔버스만 녹화해 UI 없는 영상(릴스). 값은 임의
// size: 세로 9:16 영상 크기 단계(큰 것부터). 폰·저사양(TIER 0)은 1단계(720×1280)부터. 녹화 중 fps 가 dropFps 아래로 dropSec 초 이어지면 한 단계 낮춤
// bps: 단계별 비트레이트. fps: 영상 프레임. maxSec: 한 번에 최대 길이(메모리 보호). marks: 이 초에 진동·작은 소리(릴스 길이 가늠, 소리는 영상에 안 담김)
// types: MediaRecorder 형식 고르는 순서(mp4 → webm). buf: '방금 30초' 길이(초), 두 녹화기를 buf/2 씩 엇갈려 돌림(PC 만)
export const REC = {
  size: [[1080, 1920], [720, 1280], [540, 960]],
  bps: [8e6, 5e6, 3e6],
  fps: 30, maxSec: 180, marks: [30, 60],
  dropFps: 20, dropSec: 3,
  buf: 30,
  types: ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1,opus', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'],
  tag: '#오름오름',
};

// 아이콘 글자 라벨 (#184): 처음 보는 사람용. 처음 days 일 동안 보이고, 그 뒤엔 튜토리얼을 마치고 taps 번 넘게 눌렀으면 사라짐
export const ICON_LABEL = { days: 3, taps: 10 };
// 지금 있는 곳 이름 (#153, src/game/where.js): 위쪽 칸에 좌표 대신. r = 그 자리에서 이 거리(m) 안이면 그 이름 (임의 15~25)
// 여러 곳이 겹치면 (거리 ÷ r) 가 가장 작은 곳. 없으면 구역 이름, 구역 문턱이면 '○○ 들머리' (아래 구역에서 edge m 안)
export const PLACE = { every: 0.3, street: 4, shop: 8, ch: 16, mini: 18, summit: 24, cairn: 14, stream: 18, gate: 12, sign: 14, edge: 14 };

// 캐릭터 혼잣말 (#169, src/game/mutter.js · 글은 src/punktext.js MUTTER_TEXT): 내 캐릭터 머리 위에 가끔 실마리 말풍선. 내 화면에만
// sec 보이는 시간 · gap 혼잣말 사이 최소(초) · wait 그 뒤 더 기다리는 시간(0~wait 고르게, 평균 gap + wait/2 ≈ 3분 15초) · retry 할 말이 없으면 다시 볼 때(초)
// max 같은 줄 최대 횟수(풀리면 그 전에 안 나옴) · idleAfter 실마리 조건이 이만큼(초) 하나도 없을 때만 한가한 혼잣말 · evTtl 일이 일어난 뒤 이 안에만 그 일 줄(초)
// near: 조건 거리(m) · bagFull 배낭 비율 · hand 손으로 던진 수 · walk 탈것 없이 걸은 거리(m) · hpLow HP 비율 · boss 이 깨끗함부터 우두머리 실마리(우두머리는 ZONE_BOSS.appear)
export const MUTTER = {
  sec: 3.5, gap: 90, wait: 210, retry: 10, max: 3, idleAfter: 300, evTtl: 20, checkSec: 1,
  near: { heap: 25, den: 30, hareubang: 8, cairn: 10, stream: 8 },
  bagFull: 0.8, hand: 10, walk: 300, hpLow: 0.5, boss: 0.65, piglets: 4, fieldPicked: 120, nightZone: 3,
  y: 3.4, // 말풍선 높이 (채팅 말풍선과 같음)
};
