// 사건 1 '크롭서클' (#246, notes/case-files.md 3절). 오름 자락 숲길 풀밭, 싸움 없음
// 미스터리: 밤사이 풀밭에 커다란 무늬. 누가 보낸 메시지라는데 → 반전(장면으로): 새벽에 무늬 한가운데 더미가 '툭'. 메시지가 아니라 '여기 놓으세요' 표시
// 데이터만 (그림·DOM·three 없음: 서버도 balance.js 를 거쳐 읽음). 틀·필드 설명은 src/cases/index.js 맨 위, 게임 연결은 src/game/cases.js
// 자리(at)는 남송이오름 좌표 [x, z]. 막혀 있으면 게임이 둘레에서 빈 자리를 찾음 (CASE.free)
export default {
  id: 'c1', n: 1, zone: 1, lv: 3, name: '크롭서클', giver: 'jigi',
  // v: 사건 내용 판. 저장의 판과 다르면 진행을 처음으로 (받은 귤·옷은 그대로). drop: 옛 판 쪽지 id (주운 쪽지에서 뺌)
  v: 2, drop: ['k1a', 'k1b', 'k1c', 'k1d'],
  // 목격: 레벨 lv 이상이면 풀밭에 무늬(crop, 반지름 CASE.crop.r)가 보이고, see.r m 안에 들면 혼잣말 → 사건 파일에 '미해결'. 혼잣말은 #212 cropMid 와 같은 글
  see: { at: [-510, -90], r: 7, prop: 'crop', say: '풀이 누웠네. 바람이 둥글게 불었나?' },
  // 증거 셋 (순서 자유). view: 찍을 때 무늬를 위에서 내려다보는 짧은 장면. 상호작용하면 note 쪽지가 사건 파일에 들어감
  ev: [
    { id: 'c1a', kind: 'photo', at: [-482.4, -78.3], prop: 'rock', label: '위에서 찍기', note: 'c1a', view: true },
    { id: 'c1b', kind: 'trace', at: [-510, -90], prop: 'dent', label: '살펴보기', note: 'c1b' },
    { id: 'c1c', kind: 'note', at: [-604, 141], prop: 'paper', label: '쪽지 줍기', note: 'c1c' },
  ],
  // 대면: hide 숨어 보기. drop: 장면 중 무늬 가운데로 떨어지는 모양. dawn: 새벽빛(실제 시각은 기다리지 않음). 끝나면 doc 증거 사진
  face: { kind: 'hide', at: [-502, -97], prop: 'bush', label: '숨어 보기', len: 9, drop: 'heap', dawn: true,
    lines: ['새벽 네 시. 무늬 곁에 숨는다.', '위에서 바람 소리.', '툭.'] },
  doc: 'c1d',
  // 증거 사진 (수사 보드에 꽂히는 그림): 100×75 SVG 안쪽. 위에서 본 무늬와 가운데 더미
  photo: '<rect width="100" height="75" fill="#6f9a45"/><circle cx="50" cy="38" r="30" fill="none" stroke="#d6e096" stroke-width="3.2"/><circle cx="50" cy="38" r="26" fill="none" stroke="#d6e096" stroke-width="1.2"/>'
    + '<path d="M50 20 L66 47 L34 47 Z" fill="none" stroke="#d6e096" stroke-width="4" stroke-linejoin="round"/>'
    + '<circle cx="47" cy="38" r="5" fill="#e9eef2"/><circle cx="54" cy="36" r="4.2" fill="#9db4c6"/><circle cx="51" cy="42" r="4" fill="#f2f2f2"/><rect x="43" y="40" width="3" height="5" rx="1" fill="#c0453a"/>',
  // 사건 파일 쪽지 (punktext.js NOTES 뒤에 붙음, z 'case'). 쪽지 3줄 이내
  notes: [
    { id: 'c1a', paper: 'photo', t: '위에서 본 무늬', from: '숲길 바위 위', b: '위에서 보니 화살표 셋이 서로를 쫓는다.\n어디서 본 모양인데.' },
    { id: 'c1b', paper: 'notebook', t: '가운데 눌린 자국', from: '무늬 한가운데', b: '가운데만 풀이 납작하다.\n무거운 자루를 내려놓은 모양.' },
    { id: 'c1c', paper: 'crumple', t: '주민 쪽지', from: '숲길 끝 돌 밑', b: '무늬 생긴 다음 날은\n꼭 쓰레기가 있음.\n우연인가?' },
    { id: 'c1d', paper: 'photo', t: '증거 사진 1', from: '새벽 네 시, 무늬 곁', b: '무늬 한가운데에 더미 하나.\n메시지가 아니었다.\n"여기 놓으세요."' },
  ],
  // 진행은 퀘스트 엔진 (balance.js QUESTS.side 뒤에 붙음). 셈 'case:c1:ev' 증거 수 · 'case:c1:face' 대면을 끝냄 (ever: 받기 전 것도 셈)
  quests: [
    { id: 'c1-ev', z: 1, giver: 'jigi', need: 'case:c1', name: '크롭서클', say: ['풀밭에 커다란 무늬가요? 누가 보낸 메시지라던데요.', '해독하려면 증거가 있어야죠. 세 가지쯤.'], task: '무늬의 증거 셋 찾기', ask: { k: 'case:c1:ev', n: 3, ever: true }, go: 'case:c1', fin: ['화살표 셋, 눌린 자국, 다음 날 쓰레기라…', '새벽에 무늬 곁에 숨어 봐요. 메시지는 새벽에 온대요.'], reward: { gyul: 20 } },
    { id: 'c1-face', z: 1, giver: 'jigi', need: 'case:c1', after: 'c1-ev', name: '새벽 네 시', say: ['무늬 옆 수풀에 숨어 있어 봐요.', '뭐가 와도 소리 내지 말고요.'], task: '무늬 곁에 숨어 보기', ask: { k: 'case:c1:face', n: 1, ever: true }, go: 'case:c1:face', fin: ['툭, 이요? 한가운데에?', '해독 끝이네요. 그거 메시지 아니에요. 그냥 \'여기 놓으세요\' 예요.'], reward: { gyul: 60, item: 'vest:i-pocket' } },
  ],
  // 보상: 옷(겉모습, 값 0: 가게에 없음) · 칭호(punktext.js TITLES 에 같은 글로 한 줄) · 업적(achievements.js 에 붙음)
  cloth: { id: 'vest:i-pocket', slot: 'vest', name: '조사관 조끼', desc: '주머니가 많아요. 증거가 들어가요', look: { kind: 'vest', main: '#6b5a40', acc: '#e8dcc0', pockets: 3 } },
  title: '표지판 해독가',
  badge: { id: 'b-case-c1', color: '#3a3a40', desc: '사건 \'크롭서클\' 을 종결했어요', reward: 10 },
};
