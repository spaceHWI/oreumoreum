// 이야기 글 검사·목록 (#210). node tools/storytext.mjs [--md]
//   플레이어에게 보이는 이야기 글(쪽지·혼잣말·방송·대사·퀘스트·이야기 알림·안내판·하르방 말)을 모아
//   1) 금지 낱말: UFO 드러남 단계 3 전에 나올 수 있는 글에 '외계'·'UFO'·'우주선'·'은하' 가 없는지, '클린하우스' 가 하늘·캔 실마리와 한 줄에 붙지 않는지 (4장 반전)
//   2) 길이: 혼잣말 22자·말풍선 28자·방송 64자·대사 한 장 56자·퀘스트 할 일 20자·쪽지 4줄(빈 줄 빼고)
//   --md 면 notes/story-text.md 의 '목록' 표(id · 어디서 · 글)를 찍음
import fs from 'fs';
const { STORY_TEXT, MUTTER_TEXT, RADIO, RADIO_SITU, NOTES, CLUE_TEXT } = await import('../src/punktext.js');
const { QUESTS, MEET, CAVE, SEASON } = await import('../src/balance.js');
const { TASKS } = await import('../src/daily.js');

const rows = []; /* { id, where, t, pre: 단계 3 전에도 나올 수 있음, max: 글자 수 한도, lines: 줄 수 한도 } */
const add = (id, where, t, o = {}) => { if (typeof t === 'string' && t) rows.push({ id, where, t, pre: true, ...o }); };

for (const [k, t] of Object.entries(MUTTER_TEXT)) add(`mutter.${k}`, '혼잣말 (머리 위 말풍선)', t, { max: 22 });
const AFTER3 = new Set(['ufo', 'end']); /* 단계 3(구역 3 끝) 뒤에만 */
for (const [ev, o] of Object.entries(STORY_TEXT)) for (const [k, t] of Object.entries(o)) {
  if (typeof t === 'function') continue;
  const list = Array.isArray(t) ? t : [t];
  list.forEach((s, i) => add(`story.${ev}.${k}${Array.isArray(t) ? '.' + i : ''}`, k === 'say' ? '이야기 이벤트 말풍선' : '이야기 이벤트 알림 (감독)', s, { pre: !AFTER3.has(ev), max: k === 'say' ? 28 : 64 }));
}
RADIO.forEach((r, i) => add(`radio.${i}`, `오름 방송${r.z ? ` (구역 ${r.z} 뒤)` : ''}`, r.t, { pre: !r.z || r.z <= 3, max: 64 }));
for (const [k, t] of Object.entries(RADIO_SITU)) add(`radio.situ.${k}`, '상황 방송', t, { max: 64 });
for (const n of NOTES) {
  const pre = n.z === 'top' || (typeof n.z === 'number' && n.z <= 3);
  add(`note.${n.id}.t`, `쪽지 제목 (${n.z})`, n.t, { pre, max: 14 });
  add(`note.${n.id}.b`, `쪽지 (${n.z} · ${n.from})`, n.b, { pre, lines: 4 });
}
for (const [k, t] of Object.entries(CLUE_TEXT)) {
  if (typeof t === 'object') { for (const [d, s] of Object.entries(t)) add(`clue.${k}.${d}`, '정상 실마리 · 감독 한 줄', s, { max: 64 }); continue; }
  add(`clue.${k}`, '정상 실마리', t);
}
const zoneOf = (q) => q.z || 0;
for (const [kind, list] of [['main', QUESTS.main], ['side', QUESTS.side]]) for (const q of list) {
  const after3 = zoneOf(q) >= 4 || ['story:ufo'].includes(q.need) || (q.after === 'boss4');
  const pre = !after3;
  const where = `퀘스트 ${kind === 'main' ? '줄기' : '곁가지'} (${QUESTS.givers[q.giver]?.name || q.giver})`;
  add(`quest.${q.id}.name`, where + ' 이름', q.name, { pre, max: 14 });
  add(`quest.${q.id}.task`, where + ' 할 일', q.task, { pre, max: 20 });
  (q.say || []).forEach((s, i) => add(`quest.${q.id}.say.${i}`, where + ' 말', s, { pre, max: 56 }));
  (q.fin || []).forEach((s, i) => add(`quest.${q.id}.fin.${i}`, where + ' 끝 말', s, { pre, max: 56 }));
  add(`quest.${q.id}.got`, where + ' 얻음 알림', q.got, { pre });
  add(`quest.${q.id}.ending`, '엔딩 하늘 글', q.ending, { pre: false });
}
(QUESTS.quip || []).forEach((s, i) => add(`quest.quip.${i}`, '퀘스트 보상 줄 한 마디 (#223)', s, { max: 18 }));
add('quest.took', '퀘스트 받을 때 알림 앞말 (#223)', QUESTS.took, { max: 8 });
for (const t of TASKS) { add(`daily.${t.id}.name`, '오늘의 할 일', t.name, { max: 28 }); add(`daily.${t.id}.q`, '오늘의 할 일 한 마디 (#223)', t.q, { max: 22 }); }
for (const [id, g] of Object.entries(QUESTS.givers)) (g.hello || []).forEach((s, i) => add(`npc.${id}.hello.${i}`, `${g.name} 인사 말풍선`, s, { max: 28 }));
MEET.hb.lines.forEach((s, i) => add(`hareubang.${i}`, '하르방 하이파이브 말풍선', s, { max: 28 }));
for (const k of ['lines', 'thanks', 'sorry']) MEET.tourist[k].forEach((s, i) => add(`tourist.${k}.${i}`, '관광객 말풍선', s, { max: 28 }));
for (const [k, s] of Object.entries(CAVE.lines)) add(`cave.${k}`, '동굴 알림', s, { pre: false });
SEASON.xmas.lines.forEach((s, i) => add(`xmas.${i}`, '성탄 방송 (단계 3 전엔 UFO 줄 건너뜀)', s, { pre: false, max: 64 }));
const sign = fs.readFileSync(new URL('../src/namsongi.js', import.meta.url), 'utf8').match(/NS_SIGN_TEXT = `([\s\S]*?)`/)[1];
[...sign.matchAll(/<(p|li|h2)[^>]*>([\s\S]*?)<\/\1>/g)].forEach((m, i) => add(`sign.${i}`, '들머리 탐방 안내판', m[2].replace(/<[^>]+>/g, '').trim()));

// ---------- 검사 ----------
let fail = 0;
const bad = (m) => { console.log('실패 ' + m); fail++; };
const BAN = /외계|UFO|우주선|은하/;
const CH_NEAR = /지구|하늘|불빛|그들|동그라미/;
for (const r of rows) {
  if (r.pre && BAN.test(r.t)) bad(`금지 낱말 (단계 3 전): ${r.id} · ${r.t}`);
  if (r.pre && r.t.includes('클린하우스') && CH_NEAR.test(r.t)) bad(`'클린하우스' 가 실마리와 붙음 (4장 반전 전): ${r.id} · ${r.t}`);
  if (r.max && [...r.t].length > r.max) bad(`길이 ${[...r.t].length} > ${r.max}: ${r.id} · ${r.t}`);
  if (r.lines && r.t.split('\n').filter((l) => l.trim()).length > r.lines) bad(`쪽지 ${r.t.split('\n').filter((l) => l.trim()).length}줄 > ${r.lines}: ${r.id}`);
}
if (!QUESTS.main.find((q) => q.id === 'boss5' && q.ending === '불편을 줘서 죄송합니다.') || STORY_TEXT.end.big !== '불편을 줘서 죄송합니다.') bad('엔딩 사과 한 줄이 바뀜');
console.log(`${fail ? '실패' : '통과'} 이야기 글 ${rows.length}줄 · 단계 3 전 ${rows.filter((r) => r.pre).length}줄 · 금지 낱말·길이 검사`);
if (process.argv.includes('--md')) {
  const esc = (s) => s.replace(/\|/g, '\\|').replace(/\n/g, ' / ');
  console.log('\n| id | 어디서 | 글 |\n|---|---|---|');
  for (const r of rows) console.log(`| ${r.id} | ${r.where} | ${esc(r.t)} |`);
}
process.exitCode = fail ? 1 : 0;
