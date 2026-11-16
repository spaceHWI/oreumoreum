// 들머리 튜토리얼 (#31 → #62). 글자 없이 그림 힌트 카드(숫자·키 이름만)와 바닥의 빛나는 원으로 이끈다.
// 걷기 → 달리기 → 귤 3개 줍기 → 과녁에 귤 3번 맞히기 → (돌다리를 건너) 쓰레기 6개 줍기(호주머니) → 클린하우스에 버리기 → 첫 보너스 귤 → 집게 → 배낭 → 정낭 지나 오름으로
// 단계마다 그 행동을 해야 넘어감: 다음 단계 UI 는 그때 나오고(data-tut), 다음 구역 길은 보이지 않는 벽(TUT.walls)으로 막힘.
// 지금 눌러야 할 화면 버튼·상점 칸엔 귤색 맥박 고리 + 손가락(#tut-focus), 나머지 UI 는 살짝 어둡게(body.tut-dim). 땅의 목표엔 빛나는 원 + 위아래로 움직이는 화살표.
// 건너뛰기는 개발자 버튼(?hwi=1)에만 (main.js dev-tut → skipAll). 저장 save.tut {step, done, v, gyul[], hits}
// #44: 점프 단계를 뺌. 예전 저장(save.tut.v 없음)의 단계 번호는 하나씩 당김. #62: v2 → v3 는 귤·과녁 두 단계가 끼어 2 이상이면 둘 밀기
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

const target = (cx, cy, r = 20) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" ${SW}/><circle cx="${cx}" cy="${cy}" r="${r * 0.68}" fill="#c9473d"/><circle cx="${cx}" cy="${cy}" r="${r * 0.4}" fill="#fff"/><circle cx="${cx}" cy="${cy}" r="${r * 0.17}" fill="${O}"/>`;
const THROWI = '<circle cx="17" cy="7" r="3.2"/><path d="M4 20c2-7 6-11 12-11"/><path d="M12 7l4 2-2 4"/>';
const ICON = {
  keys: `${key(52, 6, 30, 'W')}${key(18, 40, 30, 'A')}${key(52, 40, 30, 'S')}${key(86, 40, 30, 'D')}`,
  joy: `<circle cx="70" cy="44" r="32" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="6 5"/><g class="bob-y"><circle cx="70" cy="34" r="14" fill="${O}" stroke="#fff" stroke-width="3"/><path d="M74 62 v-20 a5 5 0 0 1 10 0 v8 l6 1 q6 2 5 8 l-2 14 h-16 l-8 -9 a4 4 0 0 1 5 -6z" fill="rgba(255,255,255,.3)" ${SW}/></g>`,
  runKey: `${key(8, 30, 52, 'Shift', 14)}${runner(104, 78)}`,
  runBtn: `${btn(40, 44, RUNI)}${runner(104, 78)}`,
  pickKey: `${can(14, 52)}<g class="bob-y" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(8 14) scale(1.2)">${HAND}</g>${key(56, 30, 30, 'E')}${num(116, 52, 6, 26)}`,
  pickBtn: `${can(14, 52)}<g class="bob-y" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(8 14) scale(1.2)">${HAND}</g>${btn(72, 43, HAND)}${num(116, 52, 6, 26)}`,
  // #62 귤 3개 줍기 · 과녁 3번 맞히기
  gyulKey: `${gyul(18, 66, 8)}${gyul(40, 70, 8)}<g class="bob-y" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(14 18) scale(1.2)">${HAND}</g>${key(62, 30, 30, 'E')}${num(118, 52, 3, 26)}`,
  gyulBtn: `${gyul(18, 66, 8)}${gyul(40, 70, 8)}<g class="bob-y" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(14 18) scale(1.2)">${HAND}</g>${btn(78, 43, HAND)}${num(122, 52, 3, 26)}`,
  throwKey: `${key(8, 34, 30, 'F')}<path class="bob-x" d="M44 52 q22 -30 46 -6" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="4 5" stroke-linecap="round"/>${gyul(66, 32, 6)}${target(104, 50, 19)}${num(130, 22, 3, 20)}`,
  throwBtn: `${btn(24, 48, THROWI)}<path class="bob-x" d="M44 52 q22 -30 46 -6" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="4 5" stroke-linecap="round"/>${gyul(66, 32, 6)}${target(104, 50, 19)}${num(130, 22, 3, 20)}`,
  dump: `${pocket(12, 30, true)}${arrow(56, 50)}${house(92, 30)}`,
  bonus: `${can(16, 32)}${arrow(48, 44)}<g class="spark">${gyul(102, 46, 14)}</g><path class="spark" d="M124 18 v8 M120 22 h8 M80 20 v6 M77 23 h6 M126 64 v6 M123 67 h6" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`,
  tongs: `${stall(10, 20)}${arrow(56, 48)}${tongs(92, 14)}${price(96, 70, 100)}`,
  bag: `${stall(10, 20)}${arrow(56, 48)}${backpack(90, 6)}${price(96, 70, 80)}`,
  gate: jeong,
};
const svg = (inner) => `<svg viewBox="0 0 140 85" aria-hidden="true">${inner}</svg>`;
export const TUT_ICONS = ICON; // 확인용

const FINGER = '<svg viewBox="0 0 40 46" aria-hidden="true"><path d="M14 30V8a4 4 0 0 1 8 0v13l9 2a5 5 0 0 1 4 6l-2 10a5 5 0 0 1-5 4H19a5 5 0 0 1-4-2l-8-10a3.5 3.5 0 0 1 5-5z" fill="#fff" stroke="#3b3a33" stroke-width="2.6" stroke-linejoin="round"/></svg>';

// 길을 가로막는 벽의 빛 띠: 아래가 진하고 위로 사라지는 결
let wallTex = null;
function wallTexture() {
  if (wallTex) return wallTex;
  const c = document.createElement('canvas'); c.width = 4; c.height = 64; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(255,210,122,0)'); gr.addColorStop(0.7, 'rgba(255,190,90,.55)'); gr.addColorStop(1, 'rgba(255,170,60,.9)');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 64); wallTex = new THREE.CanvasTexture(c); return wallTex;
}

export function createTutorial({ save, persist, player, isTouch, pts, scene, height, camera, placeArrow, stream, jeong, openJeong, bagVol, bagCap, tutTrashLeft, tutTrashNext, ch, col, crossLine, addTargets, sound, juice, ctxIc, shopTab, onDone }) {
  const S = (save.tut ||= { step: 0, done: false, v: 3 });
  if (!S.v) { if (S.step > 2) S.step--; S.v = 2; } // 예전 순서(점프가 3번째)의 저장 → v2
  if (S.v === 2) { if (S.step >= 2) S.step += 2; S.v = 3; persist(); } // #62: 귤·과녁 단계가 달리기 뒤에 끼어듦 (이미 지난 사람은 건너뜀)
  if (!Array.isArray(S.gyul)) S.gyul = [];
  S.hits ||= 0;
  const none = { update() {}, notify() {}, skipAll() {}, gyulNear: () => -1, takeGyul() {}, active: false };
  if (!pts || !pts.walk || !stream || !jeong) { return none; }
  const steps = ['walk', 'run', 'gyul', 'throw', 'pick', 'dump', 'bonus', 'tongs', 'bag', 'gate'];
  // 단계마다 새로 나오는 UI. 줍기 버튼(E)은 귤 줍기부터, 상호작용 버튼(F)은 과녁 던지기부터 (#62)
  const UNLOCK = { walk: ['move'], run: ['speed', 'jump'], gyul: ['pick', 'gyul'], throw: ['interact'], pick: ['bag', 'clean'] }; // 위쪽 줄 (#75): 구역·좌표·업적(hud)은 끝나면
  const idx = (name) => steps.indexOf(name);
  const card = document.createElement('div'); card.id = 'tut-hint'; card.hidden = true; document.body.append(card);
  const arrowEl = document.createElement('div'); arrowEl.id = 'tut-arrow'; arrowEl.className = 'panel round'; arrowEl.hidden = true; arrowEl.innerHTML = '<i class="dot"></i><i class="tip"></i>'; document.body.append(arrowEl);
  // 지금 눌러야 할 곳: 귤색 고리가 퍼지는 맥박 + 손가락
  const focusEl = document.createElement('div'); focusEl.id = 'tut-focus'; focusEl.hidden = true; focusEl.innerHTML = `<i class="ring"></i><i class="ring r2"></i><b class="finger">${FINGER}</b>`; document.body.append(focusEl);

  // 바닥의 빛나는 원 + 위아래로 움직이는 화살표
  const ring = new THREE.Group(); ring.visible = false; scene.add(ring);
  const glowMat = new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
  const edgeMat = new THREE.MeshBasicMaterial({ color: '#fff3c9', transparent: true, opacity: 0.9, depthWrite: false });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), glowMat); ring.add(disc);
  const edge = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40).rotateX(-Math.PI / 2), edgeMat); edge.position.y = 0.01; ring.add(edge);
  const pulse = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 40).rotateX(-Math.PI / 2), edgeMat.clone()); pulse.position.y = 0.02; ring.add(pulse);
  ring.renderOrder = 3;
  const bob = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.6, 4).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: '#ffb347', depthTest: false, transparent: true }));
  bob.renderOrder = 9; bob.visible = false; scene.add(bob);

  // ---------- #62 귤 3개 ----------
  const gyulGeo = new THREE.SphereGeometry(0.26, 12, 9), gyulMat = new THREE.MeshLambertMaterial({ color: '#ff9a2a', emissive: '#5a2a00' });
  const gLeafGeo = new THREE.PlaneGeometry(0.2, 0.11), gLeafMat = new THREE.MeshLambertMaterial({ color: '#4f8a3a', side: THREE.DoubleSide });
  const gyuls = (pts.gyul || []).map((p, i) => {
    const m = new THREE.Mesh(gyulGeo, gyulMat); m.castShadow = true;
    const lf = new THREE.Mesh(gLeafGeo, gLeafMat); lf.position.y = 0.27; lf.rotation.x = -1; m.add(lf);
    const y = height(p.x, p.z) + 0.26; m.position.set(p.x, y, p.z); m.visible = !S.done && !S.gyul.includes(i); scene.add(m);
    return { i, x: p.x, z: p.z, y, m };
  });
  const gyulLeft = () => gyuls.filter((g) => g.m.visible);
  function gyulNear(pos) {
    if (S.done || cur !== 'gyul') return -1;
    let b = -1, bd = TUT.gyulR; for (const g of gyulLeft()) { const d = Math.hypot(g.x - pos.x, g.z - pos.z); if (d < bd) { bd = d; b = g.i; } }
    return b;
  }
  function takeGyul(i) { const g = gyuls[i]; if (!g || !g.m.visible) return null; g.m.visible = false; if (!S.gyul.includes(i)) S.gyul.push(i); persist(); return g.m.position.clone(); }

  // ---------- #62 과녁 ----------
  const tgt0 = pts.target;
  const board = new THREE.Group(), stand = new THREE.Group(); stand.add(board); scene.add(stand);
  let wob = 0, tAim = null;
  if (tgt0) {
    const H = TUT.targetH, R = TUT.targetR + 0.15, wood = new THREE.MeshLambertMaterial({ color: '#a7825a' });
    stand.position.set(tgt0.x, height(tgt0.x, tgt0.z), tgt0.z); stand.rotation.y = (tgt0.dir || 0) + Math.PI; // 앞(판 얼굴)이 시작 쪽
    for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, H + 0.2, 0.12), wood); leg.position.set(s * R * 0.55, (H + 0.2) / 2 - 0.1, -0.18); leg.rotation.z = s * 0.12; leg.castShadow = true; stand.add(leg); }
    board.position.y = H;
    const cols = ['#f3f0e4', '#c9473d', '#f3f0e4', '#ff8a1f'];
    cols.forEach((c, k) => { const r = R * (1 - k * 0.24); const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.08 + k * 0.012, 28).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: c })); d.position.z = k * 0.006; d.castShadow = k === 0; board.add(d); });
    stand.visible = !S.done;
    tAim = { kind: 'target', pos: new THREE.Vector3(tgt0.x, stand.position.y, tgt0.z), h: H, size: 0.9, vel: null };
    const c3 = new THREE.Vector3(), seg = new THREE.Vector3(), q = new THREE.Vector3();
    addTargets?.({
      aimTargets(out) { if (cur === 'throw') out.push(tAim); },
      hitTest(p, tg) {
        if (cur !== 'throw') return false;
        c3.set(tAim.pos.x, tAim.pos.y + H, tAim.pos.z);
        // 귤은 한 프레임에 멀리 가므로 지난 0.1초 동안 지나온 선분에서 가장 가까운 점으로 봄
        seg.copy(tg.vel).multiplyScalar(-0.1); const l2 = seg.lengthSq();
        let u = l2 > 1e-6 ? ((c3.x - p.x) * seg.x + (c3.y - p.y) * seg.y + (c3.z - p.z) * seg.z) / l2 : 0; u = u < 0 ? 0 : u > 1 ? 1 : u;
        q.copy(p).addScaledVector(seg, u);
        if (q.distanceTo(c3) > TUT.targetR + 0.3) return false;
        const dir = tg.vel.clone().setY(0).normalize();
        tg.vel.set(-tg.vel.x * 0.18, 2.2, -tg.vel.z * 0.18);
        S.hits = Math.min(TUT.hits, S.hits + 1); persist(); wob = 1;
        sound?.splat?.(); juice?.(q, dir); counterPop();
        return true;
      },
    });
  }
  const counter = document.createElement('div'); counter.id = 'tut-count'; counter.hidden = true; document.body.append(counter);
  function counterPop() { counter.classList.remove('pop'); void counter.offsetWidth; counter.classList.add('pop'); }

  // ---------- #62 단계 사이 보이지 않는 벽 ----------
  const walls = [];
  if (col && crossLine) for (const [d, st] of TUT.walls) {
    if (S.done || idx(st) < S.step) continue; // 이미 지난 단계
    const L = crossLine(d), [ax, az] = L.a, [bx, bz] = L.b, dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
    const ids = col.addBox((ax + bx) / 2, (az + bz) / 2, Math.atan2(-dz, dx), len / 2, 0.5);
    // 빛 띠: 땅을 따라 1m 마다
    const n = Math.max(2, Math.ceil(len)), pos = new Float32Array((n + 1) * 2 * 3), uv = new Float32Array((n + 1) * 2 * 2), ix = [];
    for (let k = 0; k <= n; k++) { const t = k / n, x = ax + dx * t, z = az + dz * t, y = height(x, z); pos.set([x, y - 0.05, z, x, y + 0.9, z], k * 6); uv.set([t, 1, t, 0], k * 4); if (k < n) { const a = k * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(ix);
    const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: wallTexture(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    mesh.visible = false; mesh.renderOrder = 4; scene.add(mesh);
    walls.push({ d, st, ids, mesh, L, open: false });
  }
  function openWalls() { for (const w of walls) if (!w.open && idx(w.st) < S.step) { w.open = true; col.setOff(w.ids, true); scene.remove(w.mesh); w.mesh.geometry.dispose(); } }

  let cur = null, timer = 0, tgt = null, tgtR = TUT.ringR, ringOn = true, clock = 0;
  const counters = { dump: 0, bonus: 0 };
  const phone = () => isTouch;
  const show = (icon) => { card.innerHTML = svg(ICON[icon]); card.hidden = false; card.classList.remove('tut-in'); void card.offsetWidth; card.classList.add('tut-in'); };
  const hide = () => { card.hidden = true; counter.hidden = true; };
  const unlock = (name) => { document.querySelectorAll(`[data-tut="${name}"]`).forEach((el) => { if (el.classList.contains('tut-on')) return; el.classList.add('tut-on', 'tut-pop'); setTimeout(() => el.classList.remove('tut-pop'), 900); }); };
  const target = (v, r = TUT.ringR, on = true) => { tgt = v ? new THREE.Vector3(v.x, 0, v.z) : null; tgtR = r; ringOn = on; if (tgt) tgt.y = height(tgt.x, tgt.z); };
  const fwd = new THREE.Vector3(Math.sin(pts.gate.dir), 0, Math.cos(pts.gate.dir));
  const pastGate = () => (player.pos.x - pts.gate.x) * fwd.x + (player.pos.z - pts.gate.z) * fwd.z > 1.5;
  const near = (v, r) => Math.hypot(player.pos.x - v.x, player.pos.z - v.z) < r;
  const shopFront = () => ch?.shopFront || ch?.front;
  const nearestGyul = () => { let b = null, bd = 1e9; for (const g of gyulLeft()) { const d = Math.hypot(g.x - player.pos.x, g.z - player.pos.z); if (d < bd) { bd = d; b = g; } } return b; };
  const begin = (name) => {
    cur = name; timer = 0;
    // 이 단계까지 나와야 할 UI (중간에 다시 들어와도 앞 단계 UI 가 보이게)
    for (const st of steps.slice(0, idx(name) + 1)) for (const u of UNLOCK[st] || []) unlock(u);
    if (name === 'walk') { show(phone() ? 'joy' : 'keys'); target(pts.walk); }
    if (name === 'run') { show(phone() ? 'runBtn' : 'runKey'); target(pts.run); }
    if (name === 'gyul') { show(phone() ? 'gyulBtn' : 'gyulKey'); target(nearestGyul(), 1.1); }
    if (name === 'throw') { show(phone() ? 'throwBtn' : 'throwKey'); target(tgt0, 1.2, false); }
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
    gyul: () => !gyulLeft().length,
    throw: () => !tgt0 || S.hits >= TUT.hits,
    pick: () => tutTrashLeft() === 0 || bagVol() >= bagCap(),
    dump: () => counters.dump > 0,
    bonus: () => timer > (counters.bonus ? 3.6 : 0.4),
    tongs: () => save.equip.tool >= 2,
    bag: () => save.equip.bag >= 1,
    gate: () => pastGate(),
  };
  const finish = () => { hide(); S.step = idx(cur) + 1; persist(); cur = null; target(null); openWalls(); };
  // 지금 눌러야 할 화면 요소 (없으면 null: 땅의 원만)
  const vis = (sel) => { const el = typeof sel === 'string' ? document.querySelector(sel) : sel; if (!el || el.hidden) return null; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? el : null; };
  function focusTarget() {
    if (cur === 'walk') return phone() && !player.speed ? vis('#joy') : null;
    if (cur === 'run') return player.running ? null : vis('#btn-speed');
    if (cur === 'gyul') return gyulNear(player.pos) >= 0 ? vis('#btn-pick') : null;
    if (cur === 'throw') return ctxIc?.() === 'throw' && tAim && Math.hypot(tAim.pos.x - player.pos.x, tAim.pos.z - player.pos.z) < 15 ? vis('#btn-ctx') : null;
    if (cur === 'pick') { const n = tutTrashNext(); return n && Math.hypot(n.x - player.pos.x, n.z - player.pos.z) < 2.2 ? vis('#btn-pick') : null; }
    if (cur === 'dump') return ctxIc?.() === 'dump' ? vis('#btn-ctx') : null;
    if (cur === 'tongs' || cur === 'bag') {
      const want = cur === 'tongs' ? 'tool' : 'bag', tab = shopTab?.();
      if (tab) return tab !== want ? vis(`#shop-tabs [data-tab="${want}"]`) : vis('#shop-body .tier-buy:not([disabled])');
      return ctxIc?.() === 'shop' ? vis('#btn-ctx') : null;
    }
    return null;
  }
  let focused = null;
  function setFocus(el) {
    if (el !== focused) { focused?.classList.remove('tut-focus'); focused = el; el?.classList.add('tut-focus'); document.body.classList.toggle('tut-dim', !!el); }
    if (!el) { focusEl.hidden = true; return; }
    const r = el.getBoundingClientRect(), sz = Math.max(r.width, r.height) + 14;
    focusEl.hidden = false; focusEl.style.left = (r.left + r.width / 2) + 'px'; focusEl.style.top = (r.top + r.height / 2) + 'px'; focusEl.style.setProperty('--s', sz + 'px');
  }
  function update(dt) {
    if (S.done) return;
    timer += dt; clock += dt;
    if (cur) { if (doneWhen[cur]()) finish(); }
    if (!cur) {
      let next = steps[S.step];
      while (next && (next === 'tongs' || next === 'bag') && doneWhen[next]()) { S.step++; next = steps[S.step]; } // 이미 집게·배낭이 있으면 건너뜀
      if (!next) { complete(); return; }
      openWalls(); begin(next);
    }
    if (cur === 'pick') { const n = tutTrashNext(); if (n && (!tgt || Math.hypot(n.x - tgt.x, n.z - tgt.z) > 0.1)) target(n, 1.2); }
    if (cur === 'gyul') { const n = nearestGyul(); if (n && (!tgt || Math.hypot(n.x - tgt.x, n.z - tgt.z) > 0.1)) target(n, 1.1); }
    // 남은 수: 귤·과녁·쓰레기
    const cnt = cur === 'gyul' ? `${gyuls.length - gyulLeft().length}/${gyuls.length}` : cur === 'throw' ? `${S.hits}/${TUT.hits}` : null;
    if (cnt) { counter.hidden = card.hidden; if (counter.textContent !== cnt) { counter.textContent = cnt; } } else counter.hidden = true;
    // 과녁 흔들림
    if (wob > 0) { wob = Math.max(0, wob - dt * 2.2); board.rotation.x = Math.sin(wob * 22) * 0.25 * wob; }
    // 벽: 가까우면 빛 띠, 목표가 뒤에 있으면 화살표로 되돌려 보냄
    let pushBack = false;
    for (const w of walls) {
      if (w.open) continue;
      const along = (player.pos.x - w.L.c.x) * w.L.fx + (player.pos.z - w.L.c.z) * w.L.fz, k = Math.max(0, 1 - Math.abs(along) / TUT.wallNear);
      w.mesh.visible = k > 0.01; w.mesh.material.opacity = k * (0.55 + Math.sin(clock * 5) * 0.15);
      if (k > 0.3 && along < 0 && tgt && (tgt.x - w.L.c.x) * w.L.fx + (tgt.z - w.L.c.z) * w.L.fz < along - 1) pushBack = true;
    }
    // 원과 가장자리 화살표
    if (tgt) {
      ring.visible = ringOn; ring.position.copy(tgt); ring.position.y += 0.05; ring.scale.setScalar(tgtR);
      const k = (clock * 0.8) % 1; pulse.scale.setScalar(1 + k * 0.5); pulse.material.opacity = 0.8 * (1 - k); disc.material.opacity = 0.25 + Math.sin(clock * 4) * 0.08;
      bob.visible = ringOn; bob.position.set(tgt.x, tgt.y + 1.5 + Math.abs(Math.sin(clock * 3.2)) * 0.5, tgt.z); bob.rotation.y = clock * 1.6;
      const d = Math.hypot(player.pos.x - tgt.x, player.pos.z - tgt.z);
      const v = tgt.clone(); v.y += 1; const ndc = v.project(camera); const off = ndc.z > 1 || Math.abs(ndc.x) > 0.9 || Math.abs(ndc.y) > 0.85;
      if ((off || d > TUT.arrowFar || pushBack) && !player.rescue) { arrowEl.hidden = false; placeArrow(arrowEl, tgt, 1.6); } else arrowEl.hidden = true;
    } else { ring.visible = false; bob.visible = false; arrowEl.hidden = true; }
    setFocus(card.hidden ? null : focusTarget());
  }
  function notify(k, n = 1) { if (k in counters) counters[k] += n; }
  function endUI() {
    S.done = true; persist(); hide(); target(null); ring.visible = false; bob.visible = false; arrowEl.hidden = true; setFocus(null);
    S.step = steps.length; openWalls(); for (const w of walls) w.mesh.visible = false;
    gyuls.forEach((g) => { g.m.visible = false; }); stand.visible = false;
    document.body.classList.remove('tut', 'tut-dim'); document.querySelectorAll('[data-tut]').forEach((el) => el.classList.add('tut-on')); onDone?.();
  }
  function complete() { endUI(); }
  // 건너뛰기(개발자 버튼): 정낭이 열리고 UI 가 전부 나옴 (첫 보너스는 나중에 처음 버릴 때 그대로)
  function skipAll() { if (S.done) return; openJeong(); endUI(); }
  return { update, notify, skipAll, gyulNear, takeGyul, get active() { return !S.done; }, get step() { return cur; }, get hits() { return S.hits; }, gyuls, walls, board: stand, focus: () => focused };
}
