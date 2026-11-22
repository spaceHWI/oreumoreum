// 사건 3 '맨 인 블랙' (#234, notes/case-files.md 3절). 능선, 대면은 능선 우두머리 뒤
// 데이터만 (그림·DOM·three 없음: 서버도 balance.js 를 거쳐 읽음). 틀·필드 설명은 src/cases/index.js 맨 위, 게임 연결은 src/game/cases.js, 대면 장면의 검은 양복은 src/game/casesuit.js
// 반전(입막음이 아니라 사과하러 온 쪽, 말이 서툴러 그 말밖에 못 함)은 글이 아니라 대면 장면으로: 깊이 숙인 인사·맨발. 사과 문장은 끝까지 말하지 않는다(엔딩 사과의 복선)
// 자리(at)는 남송이오름 좌표 [x, z] (임의): 목격·발자국 능선 서쪽 · 수첩 능선 동쪽 · 귤 상자 능선 북쪽 · 대면 능선 우두머리 터 곁
export default {
  id: 'c3', n: 3, zone: 3, lv: 8, name: '맨 인 블랙', giver: 'b:rest',
  rumor: '능선에 검은 양복이 서 있었대요', /* 앞 구역을 끝냈을 때 구역 완료 창의 실마리 한 줄 (#256) */
  // 목격: 능선 서쪽에 검은 양복 둘. 다가가면 혼잣말, 사건이 열린 뒤 화면에서 눈을 떼면 사라짐 (blink: 뒤돌아보면 없다)
  see: { at: [-251, 52], r: 16, prop: 'suits', blink: true, say: '"아무것도 못 봤습니다." …뭘요?' },
  ev: [
    { id: 'k3a', kind: 'trace', at: [-249.5, 53.5], prop: 'prints', label: '살펴보기', note: 'k3a' },
    { id: 'k3b', kind: 'note', at: [52, -160], prop: 'notebook', label: '수첩 줍기', note: 'k3b' },
    { id: 'k3c', kind: 'photo', at: [-152, -334], prop: 'gyulbox', label: '사진 찍기', note: 'k3c' },
  ],
  // 대면: 능선 우두머리를 쫓아낸 뒤 at 에 검은 양복이 서 있음 → 다가가면 장면 (actor 'suit', game/casesuit.js). len 초, lines 자막(28자, 따옴표 둘이 대사)
  face: { kind: 'boss', at: [-66, 67], prop: 'suit', label: '다가가기', actor: 'suit', len: 11,
    lines: ['"아무것도 못 봤습니다."', '"…불편… 불편을…"', '고개를 깊이 숙인다. 맨발이다.', '눈을 떼자, 아무도 없다.'] },
  doc: 'k3d',
  // 증거 사진 (수사 보드·쪽지 창 위, 100×75 SVG 안쪽): 검은 바지 끝과 맨발, 발가락 넷
  photo: '<rect width="100" height="75" fill="#7f9a52"/><path d="M0 52Q50 46 100 54V75H0z" fill="#6c8746"/><rect x="24" y="0" width="20" height="46" fill="#1c1e22"/><rect x="56" y="0" width="20" height="46" fill="#1c1e22"/><ellipse cx="34" cy="53" rx="12" ry="7" fill="#f1dcc2"/><ellipse cx="66" cy="53" rx="12" ry="7" fill="#f1dcc2"/><g fill="#e2c6a6"><circle cx="25" cy="60" r="3"/><circle cx="31" cy="62" r="3"/><circle cx="37" cy="62" r="3"/><circle cx="43" cy="60" r="3"/><circle cx="57" cy="60" r="3"/><circle cx="63" cy="62" r="3"/><circle cx="69" cy="62" r="3"/><circle cx="75" cy="60" r="3"/></g><ellipse cx="50" cy="68" rx="38" ry="3" fill="#000" opacity=".18"/>',
  notes: [
    { id: 'k3a', paper: 'notebook', t: '신발 없는 발자국', from: '능선 서쪽', b: '구두 자국이 아니다. 발가락이 넷.\n두 사람이 꼭 같은 자리에 섰다.\n오래, 아주 공손하게.' },
    { id: 'k3b', paper: 'notebook', t: '연습한 수첩', from: '능선 동쪽 풀숲', b: '아무것도 못 봤습니다. (열두 번)\n불편을 ㄷ… (박박 지움)\n아무것도 못 봤습니다.' },
    { id: 'k3c', paper: 'photo', t: '작은 성의', from: '능선 북쪽 바위 곁', b: '귤 한 상자. 쪽지 한 장: 작은 성의.\n받는 사람 칸이 비어 있다.' },
    { id: 'k3d', paper: 'photo', t: '맨발의 인사', from: '능선 우두머리 터 곁', b: '양복은 반듯했다. 구두는 없었다.\n아주 깊이 숙인 인사.' },
  ],
  quests: [
    { id: 'k3-ev', z: 3, giver: 'b:rest', need: 'case:c3', name: '검은 양복', say: ['능선에 검은 양복 둘. 다들 같은 말을 들었대요. "아무것도 못 봤습니다."', '본 건 우리 쪽인데요. 흔적이 셋쯤 남았을 거예요.'], task: '능선 검은 양복 흔적 3개 찾기', ask: { k: 'case:c3:ev', n: 3, ever: true }, go: 'case:c3', fin: ['맨발 자국, 연습한 수첩, 귤 한 상자라…', '입막음치고는 너무 공손해요. 큰 멧돼지를 쫓아내면 또 올 거예요.'], reward: { gyul: 40 } },
    { id: 'k3-face', z: 3, giver: 'b:rest', need: 'case:c3', after: 'k3-ev', name: '불편을…', say: ['능선 큰 멧돼지를 쫓아내 봐요. 시끄러운 일 뒤엔 꼭 와요.', '이번엔 끝까지 들어 봐요. 무슨 말을 하려는지.'], task: '능선 우두머리 뒤 양복 만나기', ask: { k: 'case:c3:face', n: 1, ever: true }, go: 'case:c3:face', fin: ['또 "불편을…" 에서 끊겼다고요?', '입막음이 아니었네요. 무언가 말하러 왔는데, 아직 그 말을 못 배운 거예요.'], reward: { gyul: 150, item: 'jacket:i-trench', mats: { m4: 4 } } },
  ],
  cloth: { id: 'jacket:i-trench', slot: 'jacket', name: '조사관 외투', desc: '깃을 세우면 아무도 못 알아봐요', look: { kind: 'jacket', main: '#9a8660', acc: '#5a4a32', hem: true, cuffs: true } },
  title: '못 본 걸로 한 사람',
  badge: { id: 'b-case-c3', color: '#1a1d20', desc: '사건 \'맨 인 블랙\' 을 종결했어요', reward: 10 },
};
