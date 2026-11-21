// 개발용 라벨: 화면 UI와 월드 요소에 번호표를 붙여 "UI-07", "W-12"처럼 짚어 말할 수 있게
import * as THREE from 'three';

export const UI_LABELS = [
  ['UI-01', '귤', '#gyul-pill'],
  ['UI-02', '배낭', '#bag-pill'],
  ['UI-03', '지금 구역 깨끗한 정도', '#where-c'],
  ['UI-04', 'HP', '#hp-bar'],
  ['UI-05', '버프', '#buff-pill'],
  ['UI-06', '구역', '#zone-pill'],
  ['UI-07', '지금 있는 곳·방위', '#xy-pill'],
  ['UI-08', '오늘의 할 일', '#ach-chip'],
  ['UI-09', '소리 (메뉴 안)', '#menu-sound'],
  ['UI-10', '알림 토스트', '#toast'],
  ['UI-11', '업적 달성 배너', '#banner'],
  ['UI-12', '이동 조이스틱', '#joy'],
  ['UI-13', '상호작용 버튼', '#btn-ctx'],
  ['UI-14', '점프 버튼', '#btn-jump'],
  ['UI-15', '줍기 버튼', '#btn-pick'],
  ['UI-16', '속도 버튼', '#btn-speed'],
  ['UI-17', '하단 메뉴 바', '.dock'],
  ['UI-18', '동작', '#btn-actions'],
  ['UI-19', '말(채팅)', '#btn-chat'],
  ['UI-20', '업적', '#btn-ach'],
  ['UI-21', '메뉴', '#btn-menu'],
  ['UI-23', '배경 음악 (메뉴 안)', '#menu-music'],
];

export function createDevLabels({ camera, world }) {
  const layer = document.createElement('div');
  layer.id = 'dev-labels';
  layer.hidden = true;
  document.body.append(layer);
  let on = false, uiT = 0;
  const uiTags = UI_LABELS.map(([code, name, sel]) => {
    const t = document.createElement('div'); t.className = 'dl-tag dl-ui'; t.textContent = `${code} ${name}`; layer.append(t);
    return { t, sel };
  });
  let worldTags = [];
  function buildWorld() {
    worldTags.forEach((w) => w.t.remove());
    worldTags = world().map(([code, name, getPos]) => {
      const t = document.createElement('div'); t.className = 'dl-tag dl-world'; t.textContent = `${code} ${name}`; layer.append(t);
      return { t, getPos };
    });
  }
  function placeUI() {
    for (const u of uiTags) {
      const el = document.querySelector(u.sel);
      const r = el && !el.hidden && el.offsetParent !== null ? el.getBoundingClientRect() : null;
      if (!r || r.width === 0) { u.t.style.display = 'none'; continue; }
      u.t.style.display = '';
      u.t.style.left = Math.max(2, Math.min(innerWidth - u.t.offsetWidth - 2, r.left)) + 'px';
      const inside = r.top < 20; u.t.style.top = (inside ? r.bottom + 2 : r.top - 2) + 'px'; u.t.style.transform = inside ? 'none' : '';
      el.classList.add('dl-outline');
    }
  }
  const v = new THREE.Vector3();
  function update(dt) {
    if (!on) return;
    uiT -= dt; if (uiT <= 0) { uiT = 0.5; placeUI(); }
    for (const w of worldTags) {
      const p = w.getPos(); if (!p) { w.t.style.display = 'none'; continue; }
      v.copy(p); const dist = v.distanceTo(camera.position); v.project(camera);
      if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) { w.t.style.display = 'none'; continue; }
      w.t.style.display = '';
      w.t.style.transform = `translate(${(v.x * 0.5 + 0.5) * innerWidth}px, ${(-v.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -100%)`;
      w.t.style.opacity = dist > 400 ? 0.75 : 1;
    }
  }
  function set(v2) {
    on = v2; layer.hidden = !on;
    document.querySelectorAll('.dl-outline').forEach((e) => e.classList.remove('dl-outline'));
    if (on) { buildWorld(); uiT = 0; update(0); }
  }
  return { update, set, toggle: () => set(!on), get on() { return on; } };
}
