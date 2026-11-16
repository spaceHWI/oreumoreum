// 식사 버프 (#50): 한 번에 하나. 저장 save.buff = { id: 메뉴 id, left: 남은 초 }. 노는 동안만 줄어듦(게임을 끈 동안은 그대로)
import { STONE } from './balance.js';

export function createBuff({ save, persist, onEnd }) {
  const item = () => (save.buff && STONE.menu.find((m) => m.id === save.buff.id)) || null;
  if (save.buff && (!item() || !(save.buff.left > 0))) delete save.buff; // 예전·깨진 저장
  let saveT = 0, last = 0;
  function give(m) { save.buff = { id: m.id, left: m.sec || STONE.buffSec }; persist(); }
  // 실제 흐른 시간으로 줄임 (프레임이 느려도 10분은 10분). 탭이 숨었다 돌아오는 등 1초 넘게 끊긴 동안은 빼고 셈
  function tick() {
    const t = performance.now(), dt = last ? Math.min(1, (t - last) / 1000) : 0; last = t;
    if (!save.buff) return;
    save.buff.left -= dt; saveT += dt;
    if (save.buff.left <= 0) { const m = item(); delete save.buff; persist(); onEnd?.(m); return; }
    if (saveT > 5) { saveT = 0; persist(); }
  }
  // kind: speed·bag·dmg·pick 은 1 + v, regen 은 v 배. 해당 없으면 1
  function mul(kind) { const m = save.buff && item(); if (!m || m.buff !== kind) return 1; return kind === 'regen' ? m.v : 1 + m.v; }
  const now = () => { const m = save.buff && item(); return m ? { item: m, left: save.buff.left, total: m.sec || STONE.buffSec } : null; };
  return { give, tick, mul, now, clear: () => { delete save.buff; persist(); } };
}
