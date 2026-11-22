// 사건 4 '굼부리 괴물' (#235, notes/case-files.md 3절). 굼부리(북쪽 원형 분화구), 대면은 굼부리 서바이벌 터(#231)를 버틴 뒤 둘레에서 안개 지켜보기
// 데이터만 (그림·DOM·three 없음). 틀·필드 설명은 src/cases/index.js 맨 위, 게임 연결은 src/game/cases.js, 모양·장면은 src/game/caseprops.js (neck·rings·post·log·hose)
// 자리(at)는 남송이오름 좌표 [x, z] (임의값). 굼부리 바닥 가운데 약 [48, -420], 서바이벌 터 [84, -440] (#253). 초소 일지는 굼부리 관리 초소(금고 0404, game/mystery.js) 곁이라 구역 5 (z: 5)
export default {
  id: 'c4', n: 4, zone: 4, lv: 11, name: '굼부리 괴물', giver: 'b:crater',
  rumor: '안개 낀 날 굼부리에서 뭔가 솟는대요', /* 앞 구역을 끝냈을 때 구역 완료 창의 실마리 한 줄 (#256) */
  // 목격: 안개 속 긴 목 그림자가 솟았다 내려감. gone: 대면을 끝내면 치움
  see: { at: [48, -420], r: 52, prop: 'neck', say: '방금… 뭐가 솟았다 들어갔지?', gone: true },
  ev: [
    { id: 'k4a', kind: 'photo', at: [8, -446], prop: 'post', label: '사진 찍기', note: 'k4a' },
    { id: 'k4b', kind: 'trace', at: [52, -379], prop: 'rings', label: '살펴보기', note: 'k4b' },
    { id: 'k4c', kind: 'note', at: [23.6, -21.8], z: 5, prop: 'log', label: '일지 읽기', note: 'k4c' },
  ],
  // 대면: 굼부리 서바이벌 터 한 판을 버틴 뒤, 둘레 말뚝에서 장면 'hose' (안개가 걷히며 목이 하늘까지 이어진 호스로 보임, 주둥이에서 쓰레기가 쏟아짐)
  face: { kind: 'arena', scene: 'hose', tint: 'mist', at: [14, -398], prop: 'post', label: '안개 지켜보기', len: 12,
    lines: ['안개가 걷힌다.', '목이… 끝나지 않는다.', '…뱉고 있다.'] },
  doc: 'k4d',
  // 증거 사진 (#246 수사 보드): 안개 위로, 구름 위로 끝까지 이어진 호스
  photo: '<rect width="100" height="75" fill="#aebccb"/><rect y="0" width="100" height="22" fill="#8fa0b4"/><ellipse cx="30" cy="20" rx="26" ry="7" fill="#d9e0e8"/><ellipse cx="74" cy="16" rx="22" ry="6" fill="#d9e0e8"/>'
    + '<path d="M50 -2 C46 20 58 34 52 48 C48 58 50 64 50 70" fill="none" stroke="#5c6470" stroke-width="7" stroke-linecap="round"/><path d="M50 -2 C46 20 58 34 52 48 C48 58 50 64 50 70" fill="none" stroke="#7d8794" stroke-width="2" stroke-dasharray="2 5"/>'
    + '<rect y="48" width="100" height="27" fill="#e6eaee" opacity=".85"/><ellipse cx="50" cy="70" rx="30" ry="5" fill="#6f7d5a"/>',
  notes: [
    { id: 'k4a', paper: 'photo', t: '안개 속 그림자', from: '굼부리 서쪽 둘레', b: '안개 위로 목 같은 것이 솟았다.\n셔터를 누르자 내려갔다.\n사진엔 흐린 줄 하나.' },
    { id: 'k4b', paper: 'notebook', t: '둥근 자국들', from: '굼부리 바닥', b: '바닥에 둥근 자국이 다섯.\n크기가 다 똑같다.\n발자국치고는 너무 둥글다.' },
    { id: 'k4c', paper: 'notebook', t: '초소 일지', from: '굼부리 관리 초소', b: '오늘도 나옴.\n뭘 먹는지는 모름.\n뭘 뱉는지는 앎.' },
    { id: 'k4d', paper: 'photo', t: '안개 위의 호스', from: '굼부리 둘레', b: '안개 위로, 구름 위로, 끝까지.\n목이 아니었다.\n바닥엔 새 더미 하나.' },
  ],
  quests: [
    { id: 'k4-ev', z: 4, giver: 'b:crater', need: 'case:c4', name: '굼부리 괴물', say: ['[표지판] 안개 낀 날 굼부리 출입 자제. 목이 긴 것이 나옴.', '[표지판] 증거 셋: 서쪽 둘레 그림자, 바닥 자국, 관리 초소 일지.'], task: '굼부리 괴물 증거 3개 찾기', ask: { k: 'case:c4:ev', n: 3, ever: true }, go: 'case:c4', fin: ['[표지판] 증거 접수. 괴물 맞음(아마도).', '[표지판] 안개를 걷으려면 굼부리 터에서 한 판 버틸 것.'], reward: { gyul: 150 } },
    { id: 'k4-face', z: 4, giver: 'b:crater', need: 'case:c4', after: 'k4-ev', name: '안개가 걷히면', say: ['[표지판] 굼부리 터에서 끝까지 버틸 것.', '[표지판] 끝나면 둘레 말뚝에서 안개를 지켜볼 것. 눈 깜빡이지 말 것.'], task: '굼부리 터 버티고 안개 보기', ask: { k: 'case:c4:face', n: 1, ever: true }, go: 'case:c4:face', fin: ['[표지판] 정정: 괴물 아님. 호스임.', '[표지판] 빨아 가는 게 아니라 쏟아 놓는 중. 이건 정정 안 됨.'], reward: { gyul: 500, item: 'hat:i-brim', mats: { m5: 3 } } },
  ],
  cloth: { id: 'hat:i-brim', slot: 'hat', name: '조사관 모자', desc: '챙이 비를 막아요. 안개는 못 막아요', look: { kind: 'bucket', main: '#6b5a40', acc: '#e8dcc0' } },
  title: '호스를 본 사람',
  badge: { id: 'b-case-c4', color: '#5d646b', desc: '사건 \'굼부리 괴물\' 을 종결했어요', reward: 10 },
};
