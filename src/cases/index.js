// 사건 파일 (#232, 기획 notes/case-files.md): 사건 데이터 모음. 데이터만 (three·DOM 없음: balance.js·punktext.js·achievements.js·서버가 읽음)
// 사건 하나 = 파일 하나 (src/cases/c<번호>.js, export default). 뒤 사건(#233~#236)은 그 파일만 채우고 아래 LIST 에 이미 있는 줄은 그대로 둔다
// 사건 모양:
//   id 'c<번호>' · n 번호(서류 칸 자리, 1~5) · zone 구역 · lv 열림 레벨 · name 제목 · giver 의뢰 NPC (balance.js QUESTS.givers id)
//   see { at [x,z], r, prop, say } 목격: 레벨 lv 이상으로 at 의 r m 안에 들면 혼잣말 say → 사건 파일 '미해결'
//   ev [{ id, kind 'photo'|'trace'|'note'|'act', at, prop, label, note, k?, n? }] 증거 (셋). act 는 at 없이 퀘스트 셈 k 가 사건을 연 뒤 n 번 오르면
//   face { kind 'none'|'hide'|'arena'|'boss', at?, prop?, label?, len?, lines? } 대면. arena 는 그 구역 서바이벌 한 판을 버팀, boss 는 그 구역 우두머리를 쫓아냄 (사건을 연 뒤)
//     arena·boss 에 follow { path [[x,z]…], near, end, speed, len } 를 주면 끝난 뒤 흰 옷을 따라가 장면까지 봐야 대면 끝 (#233, game/casechase.js). see.ghost 는 목격 때 흰 옷이 스침
//   hello { <NPC id>: [말] } 종결 뒤 그 NPC 인사에 더하는 말 (#233)
//   see.gone true 면 사건이 열린 뒤 화면에서 눈을 떼면 목격 모양이 사라짐 · face.actor + lines 가 있는 arena·boss 는 끝난 뒤 at 에서 '다가가기' 장면 (actor 는 late.caseActors, 예 game/casesuit.js)
//     arena·boss 에 watch: true 면 조건 뒤 at 에 모양이 나타나고 다가가 보기 장면 (#236, 모양 userData.anim) · trail { pts, size, step } 발자국 한 줄
//   doc 서류 쪽지 id (대면을 끝내면 받음) · notes [NOTES 모양] 증거·서류 쪽지 · quests [QUESTS.side 모양] 진행
//   cloth 보상 옷(겉모습, 값 0) · title 칭호 글(punktext.js TITLES 에 같은 글로 한 줄 더함) · badge { id, color, desc, reward } 업적
// prop(모양)은 src/game/caseprops.js 의 이름 (row·peel·nest·paper·bush·wall·rag·gone·line). 새 모양이 필요하면 거기에 더한다
import c1 from './c1.js';
import c2 from './c2.js';
import c3 from './c3.js';
import c5 from './c5.js';

const LIST = [c1, c2, c3, c5].filter(Boolean);
export const CASES = LIST;
export const CASE_BY = Object.fromEntries(LIST.map((c) => [c.id, c]));
export const CASE_DOCS = 5; // 사건 파일 맨 위 서류 칸 수 (단가표·수거 시간표·인수인계서·투입구 규격서·분실물 접수증)
// 다른 표에 붙는 것
export const CASE_QUESTS = LIST.flatMap((c) => c.quests || []);
export const CASE_NOTES = LIST.flatMap((c) => (c.notes || []).map((n) => ({ ...n, z: 'case', case: c.id, cz: c.zone })));
export const CASE_CLOTHES = LIST.filter((c) => c.cloth).map((c) => ({ tier: 0, style: true, case: c.id, price: 0, ...c.cloth }));
export const CASE_BADGES = LIST.filter((c) => c.badge && c.title).map((c) => ({ id: c.badge.id, ev: 'case-' + c.id, goal: 1, name: c.title, desc: c.badge.desc, color: c.badge.color, reward: c.badge.reward || 0 }));
// 사건이 끝났는가 (마지막 퀘스트를 끝냄) · 셈 이름
// 종결 뒤 NPC 인사 (game/quest.js greet): 그 NPC 몫 (닫힌 사건만은 게임 쪽이 고름)
export const caseHello = (c, gid) => (c.hello && c.hello[gid]) || [];
export const caseLastQuest = (c) => (c.quests || [])[(c.quests || []).length - 1]?.id || null;
