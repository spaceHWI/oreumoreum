// 들머리 튜토리얼 (#31). 글자 없이 그림 힌트 카드(숫자·키 이름만)와 바닥의 빛나는 원으로 이끈다.
// 걷기 → 달리기 → (돌다리를 건너) 쓰레기 6개 줍기(호주머니) → 클린하우스에 버리기 → 첫 보너스 귤 → 집게 → 배낭 → 정낭 지나 오름으로
// UI 는 쓸 차례에 하나씩(data-tut). 건너뛰기 버튼을 누르면 정낭이 열리고 UI 가 전부 나온다. 저장 save.tut (main.js 의 save.nsV3 에서 초기화)
// #44: 점프 단계를 뺌(점프 버튼은 달리기 단계에 같이 나옴). 예전 저장(save.tut.v 없음)의 단계 번호는 하나씩 당김
import * as THREE from 'three';
import { TUT } from './balance.js';

// 그림 (viewBox 140×85). 흰 선 + 귤색 하나
const O = '#ff8a1f', SW = 'stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
const key = (x, y, w, label, fs = 15) => `<rect x="${x}" y="${y}" width="${w}" height="26" rx="6" fill="rgba(255,255,255,.16)" ${SW}/><text x="${x + w / 2}" y="${y + 18.5}" fill="#fff" font-family="'Gothic A1', sans-serif" font-weight="800" font-size="${fs}" text-anchor="middle">${label}</text>`;
const btn = (cx, cy, inner) => `<circle cx="${cx}" cy="${cy}" r="17" fill="rgba(255,255,255,.16)" ${SW}/><g transform="translate(${cx - 12} ${cy - 12})" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`;
const num = (x, y, n, fs = 20) => `<text x="${x}" y="${y}" fill="#fff" font-family="'Gothic A1', sans-serif" font-weight="800" font-size="${fs}" text-anchor="middle">${n}</text>`;
const gyul = (cx, cy, r = 9) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${O}" stroke="#fff" stroke-width="2.5"/><path d="M${cx} ${cy - r} q3 -5 8 -4" fill="none" stroke="#7fae5a" stroke-width="3" stroke-linecap="round"/>`;
const walker = (x, y) => `<g transform="translate(${x} ${y})" fill="none" ${SW}><circle cx="0" cy="-30" r="6" fill="rgba(255,255,255,.16)"/><path d="M0 -24 v13 M0 -11 l-6 11 M0 -11 l6 11 M-7 -19 l7 -3 7 3"/></g>`;
const runner = (x, y) => `<g transform="translate(${x} ${y})" fill="none" ${SW}><circle cx="4" cy="-31" r="6" fill="rgba(255,255,255,.16)"/><path d="M2 -25 l-3 13 M-1 -12 l-9 8 l-4 -3 M-1 -12 l8 5 l1 8 M1 -22 l-9 4 M1 -22 l8 6"/><path d="M-22 -22 h-8 M-20 -14 h-12 M-22 -6 h-7" stroke-width="2.4"/></g>`;
const RUNI = '<circle cx="14" cy="4.5" r="1.8"/><path d="M6 21l3.5-5 3 2 1-5.5L17 15h3M9 11l2.5-3.5 4 1.5 2 3M5 12l3-1"/>';
const HAND = '<path d="M8 13V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v7c0 4-2 7-6 7s-6-3-6-6l-1-3a1.4 1.4 0 0 1 2.5-1L8 13"/>';
const can = (x, y) => `<rect x="${x}" y="${y}" width="16" height="22" rx="4" fill="#d9eef5" ${SW}/><path d="M${x + 3} ${y + 7} h10" stroke="#3c7fc9" stroke-width="3"/>`;
const house = (x, y) => `<g transform="translate(${x} ${y})"><path d="M0 34 v-22 l20 -12 l20 12 v22z" fill="#3c7fc9" ${SW}/><rect x="6" y="18" width="8" height="16" fill="#c9473d" stroke="#fff" stroke-width="2"/><rect x="16" y="18" width="8" height="16" fill="#e8c13a" stroke="#fff" stroke-width="2"/><rect x="26" y="18" width="8" height="16" fill="#3f9a5a" stroke="#fff" stroke-width="2"/></g>`;
const pocket = (x, y, full) => `<g transform="translate(${x} ${y})"><path d="M0 0 h30 v20 q0 14 -15 14 q-15 0 -15 -14z" fill="rgba(255,255,255,.16)" ${SW}/><path d="M0 7 h30" ${SW} fill="none"/>${full ? `<rect x="6" y="-8" width="7" height="12" rx="2" fill="#d9eef5" stroke="#fff" stroke-width="2"/><rect x="16" y="-10" width="7" height="13" rx="2" fill="#a8d0f0" stroke="#fff" stroke-width="2"/>` : ''}</g>`;
const arrow = (x, y, cls = 'bob-x') => `<path class="${cls}" d="M${x} ${y} h20 M${x + 12} ${y - 8} l8 8 -8 8" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;
const stall = (x, y) => `<g transform="translate(${x} ${y})"><rect x="0" y="16" width="40" height="22" rx="3" fill="rgba(255,255,255,.16)" ${SW}/><path d="M-4 16 l6 -14 h36 l6 14z" fill="${O}" ${SW}/>${gyul(20, 27, 6)}</g>`;
const tongs = (x, y) => `<g transform="translate(${x} ${y})" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"><path d="M0 0 l10 34 M8 0 l2 34"/><rect x="-2" y="-4" width="12" height="9" rx="3" fill="#3f9a5a" stroke="#fff" stroke-width="2.5"/></g>`;
const backpack = (x, y) => `<g transform="translate(${x} ${y})"><path d="M8 6 a10 10 0 0 1 20 0" fill="none" ${SW}/><rect x="2" y="6" width="32" height="34" rx="8" fill="#3e6b8a" ${SW}/><rect x="9" y="22" width="18" height="11" rx="3" fill="#f2c94c" stroke="#fff" stroke-width="2.5"/></g>`;
const price = (x, y, n) => `${gyul(x, y, 7)}${num(x + 10 + String(n).length * 6, y + 6, n, 17)}`;
const jeong = `<path d="M44 24 q26 -22 52 0" fill="rgba(127,174,90,.5)" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/><rect x="28" y="26" width="13" height="48" rx="3" fill="#55555c" ${SW}/><rect x="99" y="26" width="13" height="48" rx="3" fill="#55555c" ${SW}/><circle cx="34.5" cy="38" r="2.3" fill="#fff"/><circle cx="34.5" cy="52" r="2.3" fill="#fff"/><circle cx="105.5" cy="38" r="2.3" fill="#fff"/><circle cx="105.5" cy="52" r="2.3" fill="#fff"/><path d="M30 70 L2 78 M32 74 L6 82" stroke="#a7825a" stroke-width="5" stroke-linecap="round"/><path class="bob-y" d="M70 72 V40 M60 50 l10 -10 10 10" fill="none" stroke="${O}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;

const ICON = {
  keys: `${key(52, 6, 30, 'W')}${key(18, 40, 30, 'A')}${key(52, 40, 30, 'S')}${key(86, 40, 30, 'D')}`,
  joy: `<circle cx="70" cy="44" r="32" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="6 5"/><g class="bob-y"><circle cx="70" cy="34" r="14" fill="${O}" stroke="#fff" stroke-width="3"/><path d="M74 62 v-20 a5 5 0 0 1 10 0 v8 l6 1 q6 2 5 8 l-2 14 h-16 l-8 -9 a4 4 0 0 1 5 -6z" fill="rgba(255,255,255,.3)" ${SW}/></g>`,
  runKey: `${key(8, 30, 52, 'Shift', 14)}${runner(104, 78)}`,
  runBtn: `${btn(40, 44, RUNI)}${runner(104, 78)}`,
  pickKey: `${can(14, 52)}<g class="bob-y" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(8 14) scale(1.2)">${HAND}</g>${key(56, 30, 30, 'E')}${num(116, 52, 6, 26)}`,
  pickBtn: `${can(14, 52)}<g class="bob-y" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(8 14) scale(1.2)">${HAND}</g>${btn(72, 43, HAND)}${num(116, 52, 6, 26)}`,
  dump: `${pocket(12, 30, true)}${arrow(56, 50)}${house(92, 30)}`,
  bonus: `${can(16, 32)}${arrow(48, 44)}<g class="spark">${gyul(102, 46, 14)}</g><path class="spark" d="M124 18 v8 M120 22 h8 M80 20 v6 M77 23 h6 M126 64 v6 M123 67 h6" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`,
  tongs: `${stall(10, 20)}${arrow(56, 48)}${tongs(92, 14)}${price(96, 70, 100)}`,
  bag: `${stall(10, 20)}${arrow(56, 48)}${backpack(90, 6)}${price(96, 70, 80)}`,
  gate: jeong,
};
const svg = (inner) => `<svg viewBox="0 0 140 85" aria-hidden="true">${inner}</svg>`;
export const TUT_ICONS = ICON; // 확인용

export function createTutorial({ save, persist, player, isTouch, pts, scene, height, camera, placeArrow, stream, jeong, openJeong, bagVol, bagCap, tutTrashLeft, tutTrashNext, ch, onDone }) {
  const S = (save.tut ||= { step: 0, done: false, v: 2 });
  if (!S.v) { if (S.step > 2) S.step--; S.v = 2; persist(); } // 예전 순서(점프가 3번째)의 저장 → 새 순서
  const none = { update() {}, notify() {}, skipAll() {}, active: false };
  if (!pts || !pts.walk || !stream || !jeong) { return none; }
  const steps = ['walk', 'run', 'pick', 'dump', 'bonus', 'tongs', 'bag', 'gate'];
  // 단계마다 새로 나오는 UI. 줍기 버튼(E)은 pick, 상호작용 버튼(F)은 클린하우스에 버릴 때(dump)부터 (#34)
  const UNLOCK = { walk: ['move'], run: ['speed', 'jump'], pick: ['pick', 'bag', 'clean'], dump: ['interact'], bonus: ['gyul'] }; // 위쪽 줄 (#75): 귤·배낭·깨끗한 정도는 차례에, 구역·좌표·업적(hud)은 끝나면
  const card = document.createElement('div'); card.id = 'tut-hint'; card.hidden = true; document.body.append(card);
  const arrowEl = document.createElement('div'); arrowEl.id = 'tut-arrow'; arrowEl.className = 'panel round'; arrowEl.hidden = true; arrowEl.innerHTML = '<i class="dot"></i><i class="tip"></i>'; document.body.append(arrowEl);
  const skip = document.createElement('button'); skip.type = 'button'; skip.id = 'tut-skip'; skip.className = 'panel round'; skip.title = '튜토리얼 건너뛰기'; skip.setAttribute('aria-label', '튜토리얼 건너뛰기');
  skip.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5l8 7-8 7zM13 5l8 7-8 7z"/></svg>';
  skip.hidden = S.done; document.body.append(skip);
  skip.addEventListener('click', () => skipAll());

  // 바닥의 빛나는 원
  const ring = new THREE.Group(); ring.visible = false; scene.add(ring);
  const glowMat = new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
  const edgeMat = new THREE.MeshBasicMaterial({ color: '#fff3c9', transparent: true, opacity: 0.9, depthWrite: false });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), glowMat); ring.add(disc);
  const edge = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40).rotateX(-Math.PI / 2), edgeMat); edge.position.y = 0.01; ring.add(edge);
  const pulse = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 40).rotateX(-Math.PI / 2), edgeMat.clone()); pulse.position.y = 0.02; ring.add(pulse);
  ring.renderOrder = 3;

  let cur = null, timer = 0, tgt = null, tgtR = TUT.ringR, clock = 0;
  const counters = { dump: 0, bonus: 0 };
  const phone = () => isTouch;
  const show = (icon) => { card.innerHTML = svg(ICON[icon]); card.hidden = false; card.classList.remove('tut-in'); void card.offsetWidth; card.classList.add('tut-in'); };
  const hide = () => { card.hidden = true; };
  const unlock = (name) => { document.querySelectorAll(`[data-tut="${name}"]`).forEach((el) => { if (el.classList.contains('tut-on')) return; el.classList.add('tut-on', 'tut-pop'); setTimeout(() => el.classList.remove('tut-pop'), 900); }); };
  const target = (v, r = TUT.ringR) => { tgt = v ? new THREE.Vector3(v.x, 0, v.z) : null; tgtR = r; if (tgt) tgt.y = height(tgt.x, tgt.z); };
  const fwd = new THREE.Vector3(Math.sin(pts.gate.dir), 0, Math.cos(pts.gate.dir));
  const pastGate = () => (player.pos.x - pts.gate.x) * fwd.x + (player.pos.z - pts.gate.z) * fwd.z > 1.5;
  const near = (v, r) => Math.hypot(player.pos.x - v.x, player.pos.z - v.z) < r;
  const shopFront = () => ch?.shopFront || ch?.front;
  const begin = (name) => {
    cur = name; timer = 0;
    // 이 단계까지 나와야 할 UI (중간에 다시 들어와도 앞 단계 UI 가 보이게)
    for (const st of steps.slice(0, steps.indexOf(name) + 1)) for (const u of UNLOCK[st] || []) unlock(u);
    if (name === 'walk') { show(phone() ? 'joy' : 'keys'); target(pts.walk); }
    if (name === 'run') { show(phone() ? 'runBtn' : 'runKey'); target(pts.run); }
    if (name === 'pick') { show(phone() ? 'pickBtn' : 'pickKey'); target(tutTrashNext(), 1.2); }
    if (name === 'dump') { show('dump'); target(ch?.front, 2.4); }
    if (name === 'bonus') { show('bonus'); target(null); }
    if (name === 'tongs') { show('tongs'); target(shopFront(), 1.8); }
    if (name === 'bag') { show('bag'); target(shopFront(), 1.8); }
    if (name === 'gate') { openJeong(); show('gate'); target(pts.beyond, 2.4); }
  };
  // 각 단계의 끝나는 조건
  const doneWhen = {
    walk: () => near(pts.walk, TUT.ringR),
    run: () => near(pts.run, TUT.ringR) && player.running,
    pick: () => tutTrashLeft() === 0 || bagVol() >= bagCap(),
    dump: () => counters.dump > 0,
    bonus: () => timer > (counters.bonus ? 3.6 : 0.4),
    tongs: () => save.equip.tool >= 2,
    bag: () => save.equip.bag >= 1,
    gate: () => pastGate(),
  };
  const finish = () => { hide(); S.step = steps.indexOf(cur) + 1; persist(); cur = null; target(null); };
  function update(dt) {
    if (S.done) return;
    timer += dt; clock += dt;
    if (cur) { if (doneWhen[cur]()) finish(); }
    if (!cur) {
      let next = steps[S.step];
      while (next && next !== 'gate' && doneWhen[next]() && (next === 'tongs' || next === 'bag')) { S.step++; next = steps[S.step]; } // 이미 집게·배낭이 있으면 건너뜀
      if (!next) { complete(); return; }
      begin(next);
    }
    if (cur === 'pick') { const n = tutTrashNext(); if (n && (!tgt || Math.hypot(n.x - tgt.x, n.z - tgt.z) > 0.1)) target(n, 1.2); }
    // 원과 가장자리 화살표
    if (tgt) {
      ring.visible = true; ring.position.copy(tgt); ring.position.y += 0.05; ring.scale.setScalar(tgtR);
      const k = (clock * 0.8) % 1; pulse.scale.setScalar(1 + k * 0.5); pulse.material.opacity = 0.8 * (1 - k); disc.material.opacity = 0.25 + Math.sin(clock * 4) * 0.08;
      const d = Math.hypot(player.pos.x - tgt.x, player.pos.z - tgt.z);
      const v = tgt.clone(); v.y += 1; const ndc = v.project(camera); const off = ndc.z > 1 || Math.abs(ndc.x) > 0.9 || Math.abs(ndc.y) > 0.85;
      if ((off || d > TUT.arrowFar) && !player.rescue) { arrowEl.hidden = false; placeArrow(arrowEl, tgt, 1.6); } else arrowEl.hidden = true;
    } else { ring.visible = false; arrowEl.hidden = true; }
  }
  function notify(k, n = 1) { if (k in counters) counters[k] += n; }
  function endUI() { S.done = true; persist(); hide(); target(null); ring.visible = false; arrowEl.hidden = true; skip.hidden = true; document.body.classList.remove('tut'); document.querySelectorAll('[data-tut]').forEach((el) => el.classList.add('tut-on')); onDone?.(); }
  function complete() { endUI(); }
  // 건너뛰기: 정낭이 열리고 UI 가 전부 나옴 (첫 보너스는 나중에 처음 버릴 때 그대로)
  function skipAll() { if (S.done) return; openJeong(); endUI(); }
  return { update, notify, skipAll, get active() { return !S.done; }, get step() { return cur; } };
}
