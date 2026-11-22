// 사건 3 '맨 인 블랙' (#234, notes/case-files.md 3절). 능선, 대면은 능선 우두머리(큰 멧돼지) 뒤
// 데이터만 (그림·DOM·three 없음). 틀·필드 설명은 src/cases/index.js 맨 위, 게임 연결은 src/game/cases.js, 대면 장면·뒤돌아보면 없다는 src/game/casesuit.js
// 반전(입막음이 아니라 사과하러 온 쪽, 말이 서툴러 그 말밖에 못 함)은 글이 아니라 장면으로: 깊이 숙인 인사·맨발. 사과 문장은 끝까지 말하지 않는다(엔딩 사과의 복선)
// 자리(at)는 남송이오름 좌표 [x, z] (임의): 목격·발자국 능선 서쪽 · 수첩 능선 동쪽 · 귤 상자 능선 북쪽 · 대면 능선 서바이벌 터(-116, 28) 곁
export default {
  id: 'c3', n: 3, zone: 3, lv: 10, name: '맨 인 블랙', giver: 'b:rest',
  // 목격: 능선 서쪽에 검은 양복 둘. 한 번 본 뒤 화면에서 눈을 떼면 사라짐 (casesuit.js). gone: 대면을 끝내면 다시 나오지 않음
  see: { at: [-251, 52], r: 16, prop: 'suits', gone: true, say: '"아무것도 못 봤습니다." …뭘요?' },
  ev: [
    { id: 'k3a', kind: 'trace', at: [-249.5, 53.5], prop: 'prints', label: '살펴보기', note: 'k3a' },
    { id: 'k3b', kind: 'note', at: [80, -160], prop: 'notebook', label: '수첩 줍기', note: 'k3b' },
    { id: 'k3c', kind: 'photo', at: [-140, -350], prop: 'gyulbox', label: '사진 찍기', note: 'k3c' },
  ],
  // 대면: 능선 우두머리를 쫓아낸 뒤(boss) at 에 검은 양복이 섬(wait) → 다가가 F → 장면 'suit' (game/casesuit.js). len 초, lines 자막(28자)
  face: { kind: 'boss', scene: 'suit', wait: true, at: [-95, 47], prop: 'suit', label: '다가가기', len: 11,
    lines: ['"아무것도 못 봤습니다."', '"…불편… 불편을…"', '고개를 깊이 숙인다. 맨발이다.', '눈을 떼자, 아무도 없다.'] },
  doc: 'k3d',
  // 증거 사진 (#246 수사 보드): 반듯한 검은 바짓단 아래 신발 없는 맨발 (Tripo 모델 mib 의 발 색)
  photo: '<rect width="100" height="75" fill="#7f9a52"/><path d="M0 52Q50 46 100 54V75H0z" fill="#6c8746"/>'
    + '<rect x="22" y="0" width="22" height="46" fill="#1c1e22"/><rect x="56" y="0" width="22" height="46" fill="#1c1e22"/>'
    + '<ellipse cx="33" cy="54" rx="13" ry="7" fill="#9bb35a"/><ellipse cx="67" cy="54" rx="13" ry="7" fill="#9bb35a"/>'
    + '<g fill="#86a04a"><circle cx="24" cy="61" r="3"/><circle cx="30" cy="62.5" r="3"/><circle cx="36" cy="62.5" r="3"/><circle cx="42" cy="61" r="3"/><circle cx="58" cy="61" r="3"/><circle cx="64" cy="62.5" r="3"/><circle cx="70" cy="62.5" r="3"/><circle cx="76" cy="61" r="3"/></g>'
    + '<ellipse cx="50" cy="69" rx="40" ry="3" fill="#000" opacity=".18"/>',
  notes: [
    { id: 'k3a', paper: 'notebook', t: '신발 없는 발자국', from: '능선 서쪽', b: '구두 자국이 아니다. 발가락이 넷.\n두 사람이 꼭 같은 자리에 섰다.\n오래, 아주 공손하게.' },
    { id: 'k3b', paper: 'notebook', t: '연습한 수첩', from: '능선 동쪽 풀숲', b: '아무것도 못 봤습니다. (열두 번)\n불편을 ㄷ… (박박 지움)\n아무것도 못 봤습니다.' },
    { id: 'k3c', paper: 'photo', t: '작은 성의', from: '능선 북쪽 바위 곁', b: '귤 한 상자. 쪽지 한 장: 작은 성의.\n받는 사람 칸이 비어 있다.' },
    { id: 'k3d', paper: 'photo', t: '검은 양복의 발', from: '능선 터 곁', b: '양복은 반듯했다. 구두는 없었다.\n아주 깊이 숙인 인사.' },
  ],
  quests: [
    { id: 'k3-ev', z: 3, giver: 'b:rest', need: 'case:c3', name: '맨 인 블랙', say: ['[표지판] 능선에 검은 양복 둘. 본 사람마다 같은 말을 들음: "아무것도 못 봤습니다."', '[표지판] 본 건 우리 쪽임. 흔적 셋: 능선 서쪽 발자국, 동쪽 풀숲, 북쪽 바위 곁.'], task: '능선 검은 양복 흔적 3개 찾기', ask: { k: 'case:c3:ev', n: 3, ever: true }, go: 'case:c3', fin: ['[표지판] 맨발 자국, 연습한 수첩, 귤 한 상자. 접수.', '[표지판] 입막음치고는 너무 공손함. 큰 멧돼지를 쫓아내면 또 나타남.'], reward: { gyul: 60 } },
    { id: 'k3-face', z: 3, giver: 'b:rest', need: 'case:c3', after: 'k3-ev', name: '불편을…', say: ['[표지판] 능선 큰 멧돼지를 쫓아낼 것(레벨 10 권장). 시끄러운 일 뒤엔 꼭 옴.', '[표지판] 이번엔 끝까지 들을 것. 무슨 말을 하려는지.'], task: '능선 멧돼지 쫓고 검은 양복 만나기', ask: { k: 'case:c3:face', n: 1, ever: true }, go: 'case:c3:face', fin: ['[표지판] 또 "불편을…" 에서 끊김. 기록함.', '[표지판] 입막음 아님. 할 말이 있는데 아직 못 배움.'], reward: { gyul: 250, item: 'bottom:i-slacks', mats: { m4: 3 } } },
  ],
  // 보상 재료는 마지막 퀘스트 reward.mats (다음 구역 굼부리 재료 m4) · 옷은 '조사관' 한 벌의 바지 칸 (조끼 c1·코트 c2·모자 c4·c5)
  cloth: { id: 'bottom:i-slacks', slot: 'bottom', name: '조사관 바지', desc: '주름이 반듯해요. 맨발에도 어울려요', look: { kind: 'long', main: '#5e5644', acc: '#3e392d' } },
  title: '못 본 걸로 한 사람',
  badge: { id: 'b-case-c3', color: '#1a1d20', desc: '사건 \'맨 인 블랙\' 을 종결했어요', reward: 10 },
};
