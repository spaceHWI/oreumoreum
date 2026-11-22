// 사건 2 '흰 옷 귀신' (#233, notes/case-files.md 3절 사건 2). 남쪽 사면, 서바이벌 터를 버틴 밤에 흰 옷을 따라감
// 데이터만 (그림·DOM·three 없음: 서버도 balance.js 를 거쳐 읽음). 틀·필드 설명은 src/cases/index.js 맨 위, 게임 연결은 src/game/cases.js·casechase.js
// 흰 옷(오름지기 모델에 흰 작업복·밀짚모자·집게)은 밤에만: 실제 밤(해가 진 뒤)이나 사건 장면 동안 화면이 밤빛일 때. 자리(at)는 남송이오름 좌표 [x, z]
export default {
  id: 'c2', n: 2, zone: 2, lv: 6, name: '흰 옷 귀신', giver: 'b:slope',
  // 목격: 돌담 조각 너머로 흰 것이 스윽 지나감 (ghost: 그 자리에서 잠깐 밤빛 + 흰 옷이 미끄러져 사라짐. 실제 밤이면 사건이 열린 동안 그 돌담을 오감)
  see: { at: [-480, 60], r: 14, prop: 'wall', ghost: true, say: '방금… 돌담 너머로 흰 게?' },
  ev: [
    { id: 'k2a', kind: 'photo', at: [-530, 128], prop: 'gone', label: '사진 찍기', note: 'k2a' },
    { id: 'k2b', kind: 'trace', at: [-420, 150], prop: 'rag', label: '살펴보기', note: 'k2b' },
    { id: 'k2c', kind: 'note', at: [-458, 104], prop: 'line', label: '메모 보기', note: 'k2c' },
  ],
  // 대면: 그 구역 서바이벌 터를 버팀(arena) → 그 밤 터 가장자리에 흰 옷이 나옴 → follow.path 를 따라 앞서 가다(near m 안에 들면 다음 자리로)
  // 끝자리 더미 곁에서 쪼그려 줍고 있음 → end m 안에 들면 장면(len 초): 일어나 돌아봄·사진 한 장. 끝나면 doc (증거 사진)
  face: { kind: 'arena', follow: { path: [[-338, 84], [-358, 80], [-382, 82], [-406, 84], [-432.5, 85.5]], near: 12, end: 5, speed: 4.2, len: 9 },
    lines: ['흰 옷이 멈췄다. 집게 소리.', '"…들켰네."', '"낮에 치우면 밤에 또 쌓여서."'] },
  doc: 'k2d',
  notes: [
    { id: 'k2a', paper: 'photo', t: '줄어든 더미', from: '남쪽 사면 들판', b: '어제 사진엔 더미가 넷.\n오늘은 셋. 빈자리가 반듯하다.\n귀신이 쓰레기를 가져가나?' },
    { id: 'k2b', paper: 'notebook', t: '돌담의 흰 천', from: '돌담 틈', b: '돌담에 걸린 흰 천 조각.\n무명이다. 땀 냄새가 난다.\n귀신도 땀을 흘리나?' },
    { id: 'k2c', paper: 'crumple', t: '빨랫줄 메모', from: '표지판 뒤 빨랫줄', b: '흰 작업복 — 밤 근무용.\n무릎 기울 것. 집게 주머니 터짐.\n(낯익은 글씨다)' },
    { id: 'k2d', paper: 'photo', t: '흰 옷과 집게', from: '남쪽 사면, 밤', b: '흰 옷이 돌아본 순간.\n밀짚모자, 집게, 봉지 하나.\n귀신 아님. 야간 근무.' },
  ],
  quests: [
    { id: 'k2-ev', z: 2, giver: 'b:slope', need: 'case:c2', name: '흰 옷 귀신', say: ['[표지판] 밤마다 돌담 사이로 흰 옷이 떠다닌다는 제보 있음.', '귀신인지 확인할 것. 증거 셋. 무서우면 낮에 찾을 것.'], task: '흰 옷의 흔적 셋 찾기', ask: { k: 'case:c2:ev', n: 3, ever: true }, go: 'case:c2', fin: ['[표지판] 줄어든 더미, 흰 천, 빨랫줄. 귀신치고 살림이 있음.', '서바이벌 터를 버틴 밤에 또 나온다 함. 끝까지 따라갈 것.'], reward: { gyul: 30 } },
    { id: 'k2-face', z: 2, giver: 'b:slope', need: 'case:c2', after: 'k2-ev', name: '돌아보는 귀신', say: ['[표지판] 서바이벌 터 징을 울리고 끝까지 버틸 것.', '그 밤 흰 옷이 나오면 놓치지 말 것. 귀신은 대개 느림.'], task: '터를 버티고 흰 옷 따라가기', ask: { k: 'case:c2:face', n: 1, ever: true }, go: 'case:c2:face', fin: ['[표지판] 귀신 소동, 본인이 자수함.', '흰 옷은 밤 근무복임. 마주치면 인사할 것. — 오름지기'], reward: { gyul: 80, item: 'jacket:i-coat', mats: { m3: 3 } } },
  ],
  // 종결 뒤 오름지기 인사에 더하는 말 (game/quest.js greet, #210 오름지기 과거와 이음)
  hello: { jigi: ['밤에 본 건 비밀이에요. 귀신 소문이 편했거든요', '젊을 땐 굴까지, 요즘은 밤 돌담까지만 가요'] },
  cloth: { id: 'jacket:i-coat', slot: 'jacket', name: '조사관 코트', desc: '밤 들판에서도 눈에 덜 띄어요. 귀신을 따라가기 좋아요', look: { kind: 'jacket', main: '#8a7550', acc: '#5e4e34', hem: true, cuffs: true } },
  title: '밤 근무 동기',
  badge: { id: 'b-case-c2', color: '#e8e6dc', desc: '사건 \'흰 옷 귀신\' 을 종결했어요', reward: 10 },
};
