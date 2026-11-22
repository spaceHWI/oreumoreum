// 사건 1 '정리하는 자' (#232, notes/case-files.md 3절). 오름 자락 숲길, 싸움 없음
// 데이터만 (그림·DOM·three 없음: 서버도 balance.js 를 거쳐 읽음). 틀·필드 설명은 src/cases/index.js 맨 위, 게임 연결은 src/game/cases.js
// 자리(at)는 남송이오름 좌표 [x, z]. 막혀 있으면 게임이 둘레에서 빈 자리를 찾음 (CASE.free)
export default {
  id: 'c1', n: 1, zone: 1, lv: 3, name: '정리하는 자', giver: 'jigi',
  // 목격: 레벨 lv 이상으로 see.at 에서 see.r m 안에 들어오면 혼잣말 한 줄 → 사건 파일에 '미해결'
  see: { at: [-649, 149], r: 14, prop: 'row', say: '누가 치운 게 아니라… 정리했네.' },
  // 증거 셋 (순서 자유). kind: photo 사진 · trace 흔적 · note 쪽지 · act 행동 n번(k 셈, n). 상호작용하면 note 쪽지가 사건 파일에 들어감
  ev: [
    { id: 'k1a', kind: 'photo', at: [-647.4, 149.6], prop: 'peel', label: '사진 찍기', note: 'k1a' },
    { id: 'k1b', kind: 'trace', at: [-622, 95], prop: 'nest', label: '살펴보기', note: 'k1b' },
    { id: 'k1c', kind: 'note', at: [-604, 141], prop: 'paper', label: '쪽지 줍기', note: 'k1c' },
  ],
  // 대면: none 없음 · hide 숨어 보기(이 사건) · arena 그 구역 서바이벌 터를 버팀 · boss 그 구역 우두머리. 끝나면 doc 서류 쪽지
  face: { kind: 'hide', at: [-651.5, 151.5], prop: 'bush', label: '숨어 보기', len: 9,
    lines: ['해가 진다. 숨죽이고 기다린다.', '까마귀다. 하나, 둘, 셋.', '빈자리에 귤 세 개. 종이 한 장.'] },
  doc: 'k1d',
  // 사건 파일 쪽지 (punktext.js NOTES 뒤에 붙음, z 'case'). cz = 사건 구역 (tools/storytext.mjs 가 단계 3 전 글로 봄)
  notes: [
    { id: 'k1a', paper: 'photo', t: '귤 껍질 세 조각', from: '줄 선 더미 끝', b: '캔 줄 맨 끝에 귤 껍질 세 조각.\n가지런히, 한 줄로.\n먹은 게 아니라 받은 것 같다.' },
    { id: 'k1b', paper: 'notebook', t: '둥지의 병뚜껑', from: '숲길 나무 위', b: '둥지에 병뚜껑이 수북하다.\n색깔별로 나눠 쌓았다.\n둥지 주인은 깔끔한 편이다.' },
    { id: 'k1c', paper: 'crumple', t: '발톱 자국 쪽지', from: '모름', b: '한 봉지 = 귤 3개.\n깎지 말 것.\n(가장자리에 발톱 자국)' },
    { id: 'k1d', paper: 'form', t: '단가표', from: '줄 선 더미 빈자리', b: '캔·병 한 봉지 ··· 귤 3\n반짝이는 것 한 줌 ··· 귤 3\n일꾼(사람) 귤 3 · 일꾼(까마귀) 귤 3\n▇▇▇▇▇▇ ··· (지워짐)' },
  ],
  // 진행은 퀘스트 엔진 (balance.js QUESTS.side 뒤에 붙음). 셈 'case:c1:ev' 증거 수 · 'case:c1:face' 대면을 끝냄 (ever: 받기 전 것도 셈)
  quests: [
    { id: 'k1-ev', z: 1, giver: 'jigi', need: 'case:c1', name: '정리하는 자', say: ['숲길 더미가 줄을 서 있었다고요? 캔은 캔끼리, 병은 병끼리.', '사람 솜씨는 아니네요. 일을 했으면 흔적이 남아요. 세 가지쯤.'], task: '정리한 흔적 셋 찾기', ask: { k: 'case:c1:ev', n: 3, ever: true }, go: 'case:c1', fin: ['귤 껍질, 병뚜껑, 발톱 자국 쪽지라…', '해 질 녘에 그 더미 곁에 숨어 봐요. 일꾼은 대개 퇴근 전에 와요.'], reward: { gyul: 20 } },
    { id: 'k1-face', z: 1, giver: 'jigi', need: 'case:c1', after: 'k1-ev', name: '퇴근 시간', say: ['줄 선 더미 옆 수풀에 숨어 있어 봐요.', '조용히요. 일하는 중엔 다들 예민하거든요.'], task: '줄 선 더미 곁에 숨어 보기', ask: { k: 'case:c1:face', n: 1, ever: true }, go: 'case:c1:face', fin: ['까마귀였군요. 그리고 단가표.', '보세요. 당신 값이랑 까마귀 값이 같아요. 한 봉지에 귤 셋.', '같은 급이에요. 하청끼리 사이좋게 지내요.'], reward: { gyul: 60, item: 'vest:i-pocket' } },
  ],
  // 보상: 옷(겉모습, 값 0: 가게에 없음) · 칭호(punktext.js TITLES 에 같은 글로 한 줄) · 업적(achievements.js 에 붙음)
  cloth: { id: 'vest:i-pocket', slot: 'vest', name: '조사관 조끼', desc: '주머니가 많아요. 증거가 들어가요', look: { kind: 'vest', main: '#6b5a40', acc: '#e8dcc0', pockets: 3 } },
  title: '까마귀와 같은 급',
  badge: { id: 'b-case-c1', color: '#3a3a40', desc: '사건 \'정리하는 자\' 를 종결했어요', reward: 10 },
};
