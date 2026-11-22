// 사건 5 '설인' (#236, notes/case-files.md 3절). 정상, 대면은 정상 우두머리 뒤 (설인은 싸우지 않음)
// 데이터만 (그림·DOM·three 없음). 틀·필드 설명은 src/cases/index.js 맨 위, 게임 연결은 src/game/cases.js
// 자리(at)는 남송이오름 좌표 [x, z]. 정상 더미는 (0, 0) 둘레 30 m 안, 우두머리 빈터는 (60, -12)
export default {
  id: 'c5', n: 5, zone: 5, lv: 18, name: '설인', giver: 'jigi',
  // 목격: 큰 발자국. trail 은 발자국 한 줄의 꺾이는 점 (MYST.foot 모양을 크게, game/traces.js late.caseFoot). 더미 곁 → 더미 곁 → 대면 자리
  see: { at: [-16, -3], r: 14, prop: 'print', say: '발자국이… 내 발 세 개만 하다.' },
  trail: { pts: [[-16, -3], [-10.5, -11], [0.5, -23], [-5, -36], [-12, -48]], size: 1.3, step: 1.6 },
  // 증거 셋 (서로 다른 세 쪽): 남쪽 발자국 한가운데 · 북쪽 돌 틈 털 · 동쪽 묶어 둔 봉지
  ev: [
    { id: 'k5a', kind: 'photo', at: [0, -21.5], prop: 'print', label: '사진 찍기', note: 'k5a' },
    { id: 'k5b', kind: 'trace', at: [2, 24], prop: 'fur', label: '살펴보기', note: 'k5b' },
    { id: 'k5c', kind: 'trace', at: [35, 1], prop: 'knots', label: '살펴보기', note: 'k5c' },
  ],
  // 대면: 정상 우두머리를 쫓아낸 뒤(boss) 발자국 끝에 설인이 앉아 있음 → 다가가 보기(watch 장면, len 초). 끝나면 doc 증거 사진
  face: { kind: 'boss', at: [-12.5, -50], prop: 'yeti', label: '다가가 보기', len: 10, watch: true,
    lines: ['발자국 끝. 더미 앞에 흰 등이 앉아 있다.', '부스럭. 꽉. 또 부스럭.', '…'] },
  doc: 'k5d',
  notes: [
    { id: 'k5a', paper: 'photo', t: '큰 발자국', from: '정상 더미 사이', b: '더미에서 멈췄다가, 다음 더미로.\n멈춘 자리마다 더미가 작아졌다.' },
    { id: 'k5b', paper: 'notebook', t: '흰 털 뭉치', from: '정상 북쪽 돌 틈', b: '돌 틈에 흰 털이 한 줌.\n털에 귤 껍질이 붙어 있다.\n간식은 귤로 하는 편.' },
    { id: 'k5c', paper: 'photo', t: '묶어 둔 봉지', from: '정상 동쪽', b: '봉지 셋이 꽁꽁 묶여 있다.\n매듭이 주먹만 하다.\n솜씨는 없는데 꼼꼼하다.' },
    { id: 'k5d', paper: 'photo', t: '봉지를 든 뒷모습', from: '발자국 끝', b: '흰 등, 큰 봉지 하나, 묶은 봉지 한 무더기.\n(사진 뒤에 연필로) 선배' },
  ],
  quests: [
    { id: 'k5-ev', z: 5, giver: 'jigi', need: 'case:c5', name: '설인', say: ['정상에 큰 발자국이요? 설인이 쓰레기를 버린다는 소문이 있죠.', '소문은 소문이고요. 흔적 세 가지만 모아 와요.'], task: '설인의 흔적 셋 찾기', ask: { k: 'case:c5:ev', n: 3, ever: true }, go: 'case:c5', fin: ['발자국, 털, 봉지라…', '정상 우두머리부터 쫓아내요. 그다음 발자국 끝까지 따라가 봐요.'], reward: { gyul: 120 } },
    { id: 'k5-face', z: 5, giver: 'jigi', need: 'case:c5', after: 'k5-ev', name: '발자국 끝', say: ['우두머리가 정상에 버티는 동안은 그쪽도 안 나와요.', '쫓아낸 다음, 발자국 끝에 가서 조용히 다가가 봐요.'], task: '발자국 끝까지 가 보기', ask: { k: 'case:c5:face', n: 1, ever: true }, go: 'case:c5:face', fin: ['그 매듭, 알아요. 제가 처음 왔을 때도 묶여 있었거든요.', '버리는 걸 본 사람은 없어요. 본 건 늘 치우는 쪽이었죠.'], reward: { gyul: 400, item: 'jacket:i-trench' } },
  ],
  // 다음 구역 장비 재료 (정상이 마지막이라 정상 재료, game/loot.js save.mats) · 종결 때 받음
  mats: { m5: 6 },
  cloth: { id: 'jacket:i-trench', slot: 'jacket', name: '조사관 코트', desc: '깃을 세우면 눈바람도 의심도 막아요', look: { kind: 'jacket', main: '#b39a6c', acc: '#7c6644', cuffs: true, hem: true } },
  title: '설인의 후배',
  badge: { id: 'b-case-c5', color: '#e8ecef', desc: '사건 \'설인\' 을 종결했어요', reward: 10 },
};
