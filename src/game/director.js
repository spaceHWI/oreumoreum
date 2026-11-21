// 감독 연결 (#176): src/director.js(차례만 셈)를 게임에 붙인다. 파일 순서는 hud 바로 뒤 (src/modules.js, 규칙은 notes/prototype-v1.md)
// - say(kind, id, text, sec): 감독을 거쳐 토스트 한 줄. 지금 안 되면 줄에 섰다가 차례가 오면 (ttl 안에)
// - 팁(hud.js tickTips)·첫 투기꾼 안내(guide.js, pace.js 가 say 로 넘김)·구역 우두머리(boss.js)·구역 완료(guard.js 토스트, zonedone.js 요약 창)·권장 점수 경고(area.js)가 여기를 거친다
// - 문: 지금 있는 것(tips·dumper·boss·zoneDone)을 등록. 뒤 이슈는 director.register({ id, gate, intro, kind, clue }) 로 자기 줄을 건다 (문 순서·조건은 balance.js JOURNEY)
// - 실마리: 한가하면(JOURNEY.idleSec) 가까운 더미 쪽 표시 (예전 팁 'idle' 을 옮김)
// - 바깥 토스트(주웠어요·샀어요 같은 바로 그 자리 반응)는 감독을 거치지 않지만, 보이는 동안 감독은 기다린다 (busy)
// dev: __oreum.director.state()·open(id)·log
import * as THREE from 'three';
import { createDirector } from '../director.js';
import { JOURNEY } from '../balance.js';
import { levelOf, augCount } from '../augments.js';
import { groundAt } from '../world.js';
import { state, late } from './state.js';
import { $, save, persist } from './save.js';
import { player, trash, life } from './place.js';
import { cam } from './camera.js';
import { toast, panelOpen, tipMark, nearestHeapPos } from './hud.js';
import { sunState } from './scene.js';

let mine = ''; // 감독이 띄운 토스트 글 (바깥 토스트와 구별)
const ownToast = () => { const el = $('toast'); return !el.hidden && el.textContent === mine; };
const J = () => save.journey || {};
// 사실 값 (JOURNEY.doors need). 뒤 이슈는 여기에 한 줄 더함
const FACTS = {
  tut: () => (save.tut?.done ? 1 : 0),
  jeong: () => (save.jeong ? 1 : 0),
  picked: () => save.trash?.total || 0,
  dumps: () => save.recycle?.visits || 0,
  bloomed: () => (save.pace?.bloomed ? 1 : 0),
  attacked: () => (save.pace?.first ? 1 : 0),
  zonesDone: () => Object.values(save.boss?.done || {}).filter((n) => n > 0).length,
  zone: () => J().maxZ || 0,
  night: () => ((sunState?.el ?? 30) < -4 ? 1 : 0),
  fieldQuest: () => (save.quest?.done?.includes('field1') ? 1 : 0), // #158 퀘스트 '들판 탐사' 를 끝냄
  lv: () => levelOf(save.lv?.xp || 0).lv, // #159 레벨
  augs: () => augCount(save), // #159 고른 증강 수
};

export const director = createDirector({
  save, persist,
  hooks: {
    facts: () => Object.fromEntries(Object.entries(FACTS).map(([k, f]) => { let v = 0; try { v = f(); } catch { v = 0; } return [k, v]; })),
    busy: () => !state.sessionOn || document.hidden || !!late.tut?.active || panelOpen() || cam.mode === 'wardrobe' || !!late.mealS?.on || !!late.cutS?.on
      || (!$('toast').hidden && !ownToast()) || !$('banner').hidden || !!state.photoState,
    fight: () => !!player.down || !!late.pace?.threat?.() || (state.tension || 0) > 0.3 || !!late.bossFight?.() || !!life?.enemies?.near?.(player.pos, 25),
  },
});
late.director = director;

// 토스트 한 줄을 감독을 거쳐
export function say(kind, id, text, sec = JOURNEY.sec, opt = {}) {
  return director.ask(kind, id, () => { mine = text; toast(text, sec); }, { sec, ...opt });
}

// ---------- 지금 있는 것 등록 ----------
director.register({ id: 'tips' }); // 상황 팁 (#66): 튜토리얼 뒤. 팁마다 때는 tips.js, 나가는 차례는 감독
director.register({ id: 'dumper' }); // 첫 투기꾼 안내 (#135): 문이 열리기 전에 온 투기꾼은 안내 없이 (guide.js appear 가 봄)
director.register({ id: 'boss' }); // 구역 우두머리 (#139)
director.register({ id: 'zoneDone' }); // 구역 완료·하르방 (#139 #119)
// 실마리: 가까운 더미 쪽 표시 (혼잣말 자리. #169 가 들어오면 그 앞에 대사가 줄을 섬)
director.register({
  id: 'heapHint', kind: 'mutter',
  clue: () => {
    if (!trash || !director.isOpen('tips') || late.tips?.isOff?.()) return false;
    const p = nearestHeapPos(); if (!p || !director.can('mutter')) return false;
    tipMark(new THREE.Vector3(p.x, groundAt(p.x, p.z), p.z));
    return say('mutter', 'heapHint', '가까운 쓰레기 더미는 이쪽이에요', 3.2, { queue: false });
  },
});

// 끝을 모르는 창(구역 완료 요약 등): 감독 차례로 열고, 창이 닫히면 끝
const wins = new Map(); // id → 창 element id
export function holdWin(kind, id, el) { director.begin(kind, id, Infinity); wins.set(id, el); }

// ---------- 매 프레임 ----------
let lastPicked = -1, zT = 0;
export function tickDirector(dt) {
  if (!state.sessionOn) return;
  // 한가함: 줍기·싸움·이동 목표(자동 걷기·눌러 간 곳)·창을 쓰면 바쁨
  const picked = trash ? trash.store.pickedCount() : 0;
  if (picked !== lastPicked) { lastPicked = picked; director.note('act'); }
  if (player.target || state.fishing?.busy || (state.tension || 0) > 0.2 || panelOpen()) director.note('act');
  if ((zT -= dt) <= 0) { zT = 1; const z = trash ? trash.zoneAt(player.pos.x, player.pos.z) || 0 : 0, j = J(); if (z > (j.maxZ || 0)) { j.maxZ = z; persist(); } }
  for (const [id, el] of wins) if ($(el)?.hidden !== false) { wins.delete(id); director.end(id); }
  director.tick(dt);
}
