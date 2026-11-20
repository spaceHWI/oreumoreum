// 들머리 튜토리얼 (#31 → #62 → #100). 위쪽 토스트 한 줄로 할 일을 알려 주고, 바닥의 빛나는 원으로 이끈다.
// 걷기 → 달리기 → 귤 3개 줍기 → 과녁에 귤 3번 맞히기 → (돌다리를 건너) 쓰레기 3개 줍기(호주머니) → 클린하우스에 버리기 → 첫 보너스 귤 → 집게 → 배낭 → 정낭 지나 오름으로
// #100 단계마다 격리된 칸: 들머리 마당을 낮은 돌담(stonewall.js createPens)으로 4칸으로 나눔(TUT.cells). 칸의 단계를 다 하면 다음 칸 정낭이 열리고 길이 빛남.
// 단계마다 그 행동을 해야 넘어감: 다음 단계 UI 는 그때 나옴(data-tut). 지금 눌러야 할 화면 버튼·상점 칸엔 귤색 맥박 고리(#tut-focus), 나머지 UI 는 살짝 어둡게(body.tut-dim).
// 진행이 없으면 TUT.fingerT 초 뒤 손가락이 누를 곳을 가리키고, TUT.easyT 초 뒤 토스트를 흔들고 더 쉬운 말로 바꿈. 실패 상태 없음(손 던지기는 귤이 줄지 않음, 살 귤은 모자라면 채움)
// 건너뛰기는 개발자 버튼(?hwi=1)에만 (menu.js dev-tut → skipAll). 저장 save.tut {step, done, v, gyul[], hits}
// #44: 점프 단계를 뺌. 예전 저장(save.tut.v 없음)의 단계 번호는 하나씩 당김. #62: v2 → v3 는 귤·과녁 두 단계가 끼어 2 이상이면 둘 밀기
import * as THREE from 'three';
import { TUT, TANGERINE as TG, TOOLS, BAGS, WALL } from './balance.js';
import { nsAlong } from './namsongi.js';
import { createPens } from './stonewall.js';

// 토스트 아이콘 (viewBox 24, 선)
const IC = {
  walk: '<path d="M8 20c-2 0-2.5-2-2-4l1-4c.5-2 3-2 3 0l-.5 4c-.2 2-.5 4-1.5 4zM16 12c-2 0-2.5-2-2-4l1-4c.5-2 3-2 3 0l-.5 4c-.2 2-.5 4-1.5 4z"/>',
  run: '<circle cx="14" cy="4.5" r="1.8"/><path d="M6 21l3.5-5 3 2 1-5.5L17 15h3M9 11l2.5-3.5 4 1.5 2 3M5 12l3-1"/>',
  hand: '<path d="M8 13V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v7c0 4-2 7-6 7s-6-3-6-6l-1-3a1.4 1.4 0 0 1 2.5-1L8 13"/>',
  throw: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  dump: '<path d="M4 20V10l8-6 8 6v10z"/><path d="M8 20v-6h3v6M13 20v-6h3v6"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M12 9v11M4 13h16M12 9c-1-3-5-5-6-2s4 2 6 2c2 0 7 1 6-2s-5-1-6 2"/>',
  tongs: '<path d="M8 3l3 18M13 3l-2 18"/><rect x="6.5" y="2" width="8" height="4" rx="1.5"/>',
  bag: '<path d="M9 6a3 3 0 0 1 6 0"/><rect x="5" y="6" width="14" height="15" rx="4"/><rect x="9" y="13" width="6" height="4" rx="1"/>',
  gate: '<path d="M5 21V5M19 21V5M3 9h18M3 14h18"/>',
  ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
};
// 할 일 한 줄: [보통, 더 쉬운 말]. PC 는 키 이름, 폰은 화면 버튼. 함수면 지금 상태로 고름
const SAY = {
  walk: { pc: ['WASD 키로 걸어 봐요', 'W 키를 꾹 눌러요'], touch: ['화면을 눌러 걸어 봐요', '빛나는 동그라미를 눌러요'], ic: 'walk' },
  run: { pc: (r) => (r ? ['빛나는 곳까지 달려요', '빛나는 곳으로 가요'] : ['Shift 키로 달려 봐요', 'Shift 키를 한 번 눌러요']),
    touch: (r) => (r ? ['빛나는 곳까지 달려요', '빛나는 곳으로 가요'] : ['달리기 버튼을 눌러요', '빛나는 버튼을 눌러요']), ic: 'run' },
  gyul: { pc: ['E 키로 귤을 주워요', '귤 옆에서 E 키를 눌러요'], touch: ['귤 3개를 주워요', '귤 옆에서 손 버튼'], ic: 'hand' },
  throw: { pc: ['F 키로 과녁에 던져요', 'F 키만 누르면 맞아요'], touch: ['과녁에 귤을 던져요', '빛나는 버튼만 눌러요'], ic: 'throw' },
  pick: { pc: ['E 키로 쓰레기를 주워요', '쓰레기 옆에서 E 키'], touch: ['쓰레기 3개를 주워요', '쓰레기 옆에서 손 버튼'], ic: 'hand' },
  dump: { pc: ['클린하우스에 버려요', '파란 집 앞에서 F 키'], touch: ['클린하우스에 버려요', '파란 집 앞에서 버튼'], ic: 'dump' },
  bonus: { pc: ['보너스 귤을 받아요!', '보너스 귤을 받아요!'], touch: ['보너스 귤을 받아요!', '보너스 귤을 받아요!'], ic: 'gift' },
  tongs: { pc: ['가게에서 집게를 사요', '가게 앞에서 F 키'], touch: ['가게에서 집게를 사요', '빛나는 곳을 눌러요'], ic: 'tongs' },
  bag: { pc: ['이제 배낭을 사요', '빛나는 칸을 눌러요'], touch: ['이제 배낭을 사요', '빛나는 칸을 눌러요'], ic: 'bag' },
  gate: { pc: ['정낭을 지나 오름으로!', '빛나는 길을 따라가요'], touch: ['정낭을 지나 오름으로!', '빛나는 길을 따라가요'], ic: 'gate' },
};
export const TUT_SAY = SAY; // 확인용

const FINGER = '<svg viewBox="0 0 40 46" aria-hidden="true"><path d="M14 30V8a4 4 0 0 1 8 0v13l9 2a5 5 0 0 1 4 6l-2 10a5 5 0 0 1-5 4H19a5 5 0 0 1-4-2l-8-10a3.5 3.5 0 0 1 5-5z" fill="#fff" stroke="#3b3a33" stroke-width="2.6" stroke-linejoin="round"/></svg>';

// 정낭이 열리면 빛나는 길: 앞으로 흐르는 갈매기 무늬
let laneTex = null;
function laneTexture() {
  if (laneTex) return laneTex;
  const c = document.createElement('canvas'); c.width = 32; c.height = 32; const g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,214,130,1)'; g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(5, 24); g.lineTo(16, 10); g.lineTo(27, 24); g.stroke();
  laneTex = new THREE.CanvasTexture(c); laneTex.wrapS = laneTex.wrapT = THREE.RepeatWrapping; return laneTex;
}

// 들머리 길(곧은 탐방로)의 (거리 d, 옆 lat: + 오른쪽) → [x, z]. 시작보다 뒤(d < 0)는 첫 마디 방향으로 늘임
function P(d, lat = 0) {
  if (d >= 0) { const q = nsAlong('approach', d, 1, lat); return [q.x, q.z]; }
  const a = nsAlong('approach', 0, 1, lat), b = nsAlong('approach', 1, 1, lat); return [a.x + (a.x - b.x) * -d, a.z + (a.z - b.z) * -d];
}

export function createTutorial({ save, persist, player, isTouch, pts, scene, height, camera, placeArrow, stream, jeong, openJeong, bagVol, bagCap, tutTrashLeft, tutTrashNext, ch, col, low, addTargets, sound, juice, ctxIc, shopTab, onTop, onCoins, onDone }) {
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
  // 위쪽 토스트 (#60·#66 과 같은 모양): 아이콘 + 한 줄 + 남은 수
  const tEl = document.createElement('div'); tEl.id = 'tut-toast'; tEl.className = 'tip-toast panel'; tEl.setAttribute('role', 'status'); tEl.hidden = true; document.body.append(tEl);
  const arrowEl = document.createElement('div'); arrowEl.id = 'tut-arrow'; arrowEl.className = 'panel round'; arrowEl.hidden = true; arrowEl.innerHTML = '<i class="dot"></i><i class="tip"></i>'; document.body.append(arrowEl);
  // 지금 눌러야 할 곳: 귤색 고리가 퍼지는 맥박. 진행이 없으면 손가락(.idle)
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
  const GR = 0.26 * TG.scale; // 튜토리얼 귤도 같은 크기·색 (#63)
  const gyulGeo = new THREE.SphereGeometry(GR, 12, 9), gyulMat = new THREE.MeshLambertMaterial({ color: TG.color, emissive: TG.emissive, emissiveIntensity: TG.emissiveI });
  const gGlowGeo = new THREE.CircleGeometry(TG.glowR * 1.2, 14).rotateX(-Math.PI / 2), gGlowMat = new THREE.MeshBasicMaterial({ color: TG.glowColor, transparent: true, opacity: TG.glowOpacity, depthWrite: false });
  const gLeafGeo = new THREE.PlaneGeometry(0.2 * TG.scale, 0.11 * TG.scale), gLeafMat = new THREE.MeshLambertMaterial({ color: '#4f8a3a', side: THREE.DoubleSide });
  const gyuls = (pts.gyul || []).map((p, i) => {
    const m = new THREE.Mesh(gyulGeo, gyulMat); m.castShadow = true;
    const lf = new THREE.Mesh(gLeafGeo, gLeafMat); lf.position.y = GR + 0.01; lf.rotation.x = -1; m.add(lf);
    const gl = new THREE.Mesh(gGlowGeo, gGlowMat); gl.renderOrder = 1; m.add(gl);
    const y = height(p.x, p.z) + GR; m.position.set(p.x, y, p.z); gl.position.y = -TG.hover + 0.03; m.visible = !S.done && !S.gyul.includes(i); scene.add(m);
    return { i, x: p.x, z: p.z, y: y + TG.hover, m, gl, ph: i * 2.1 };
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
        if (q.distanceTo(c3) > TUT.targetR + 0.6) return false; // 자동 조준이라 넉넉히 (버튼만 누르면 맞게)
        const dir = tg.vel.clone().setY(0).normalize();
        tg.vel.set(-tg.vel.x * 0.18, 2.2, -tg.vel.z * 0.18);
        S.hits = Math.min(TUT.hits, S.hits + 1); persist(); wob = 1;
        sound?.splat?.(); juice?.(q, dir); countPop();
        return true;
      },
    });
  }

  // ---------- #100 단계마다 격리된 칸 (낮은 돌담 + 정낭) ----------
  const cells = TUT.cells, cellOf = {};
  cells.forEach((c, i) => c.steps.forEach((s) => { cellOf[s] = i; }));
  const cellFrom = (i) => (i ? cells[i - 1].to : TUT.cellBack);
  const cellDone = (i) => idx(cells[i].steps[cells[i].steps.length - 1]) < S.step;
  const latDir = (d) => { const a = P(d, 0), b = P(d, 1); return { c: { x: a[0], z: a[1] }, ux: b[0] - a[0], uz: b[1] - a[1] }; };
  let pens = null;
  const penGate = []; // 칸 i 끝 정낭 (마지막 칸은 들머리·오름 사이 정낭 jeong)
  if (col && !S.done) {
    const runs = [], gates = [], wet = [TUT.streamD - TUT.streamW + 0.5, TUT.streamD + TUT.streamW - 0.5]; // 개울 위엔 담 없음 (물에 빠지면 낚시꾼이 칸 안으로 건져 줌)
    const line = (d0, d1, lat) => { // 길 따라 담 한 줄 (물 위는 끊음)
      const parts = d1 <= wet[0] || d0 >= wet[1] ? [[d0, d1]] : [[d0, wet[0]], [wet[1], d1]].filter(([a, b]) => b - a > 0.5);
      for (const [a, b] of parts) { const n = Math.max(1, Math.ceil((b - a) / 6)), pl = []; for (let k = 0; k <= n; k++) pl.push(P(a + (b - a) * k / n, lat)); runs.push(pl); }
    };
    const across = (d, l, r, gate) => { // 길을 가로지르는 담 (가운데 정낭)
      const g = gate ? WALL.gateW + 0.35 : 0;
      if (gate) { runs.push([P(d, -l), P(d, -g)], [P(d, g), P(d, r)]); } else runs.push([P(d, -l), P(d, 0), P(d, r)]);
    };
    cells.forEach((c, i) => {
      const d0 = cellFrom(i);
      line(d0, c.to, -c.l); line(d0, c.to, c.r);
      if (!i) across(d0, c.l, c.r, false);
      if (i < cells.length - 1) { const n = cells[i + 1]; across(c.to, Math.max(c.l, n.l), Math.max(c.r, n.r), true); gates.push({ ...latDir(c.to), open: cellDone(i) }); }
    });
    pens = createPens({ scene, height, runs, gates, low, col, hk: TUT.penH });
    pens.gates.forEach((J, i) => { penGate[i] = J; });
  }

  // 정낭이 열리면 앞뒤로 빛나는 길
  const lanes = [];
  function addLane(d) {
    const [a, b] = TUT.laneLen, W = TUT.laneW, n = Math.ceil(a + b), pos = new Float32Array((n + 1) * 6), uv = new Float32Array((n + 1) * 4), ix = [];
    for (let k = 0; k <= n; k++) {
      const dd = d - a + (a + b) * k / n, L = P(dd, -W), R = P(dd, W);
      pos.set([L[0], height(L[0], L[1]) + 0.07, L[1], R[0], height(R[0], R[1]) + 0.07, R[1]], k * 6); uv.set([0, (dd - d + a) / (2 * W), 1, (dd - d + a) / (2 * W)], k * 4);
      if (k < n) { const q = k * 2; ix.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(ix);
    const tex = laneTexture().clone(); tex.needsUpdate = true;
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.renderOrder = 3; scene.add(m); lanes.push({ m, t: 0 });
  }
  function tickLanes(dt) {
    for (let i = lanes.length - 1; i >= 0; i--) {
      const L = lanes[i]; L.t += dt; L.m.material.map.offset.y -= dt * 0.9;
      const k = Math.min(1, L.t / 0.4) * Math.min(1, Math.max(0, (TUT.laneT - L.t) / 1.2));
      L.m.material.opacity = k * (0.75 + Math.sin(L.t * 5) * 0.15);
      if (L.t > TUT.laneT) { scene.remove(L.m); L.m.geometry.dispose(); L.m.material.map.dispose(); L.m.material.dispose(); lanes.splice(i, 1); }
    }
  }
  function openCell(i) { // 칸 i 를 다 함 → 끝 정낭이 열리고 길이 빛남
    const J = penGate[i]; if (!J || J.isOpen) return;
    J.open(); addLane(cells[i].to); sound?.beep?.(true);
  }

  let cur = null, timer = 0, tgt = null, tgtR = TUT.ringR, ringOn = true, clock = 0, gap = 0;
  const counters = { dump: 0, bonus: 0 };
  const phone = () => isTouch;
  // 토스트: 단계가 시작될 때 할 일 한 줄. 단계가 끝날 때까지 남고, 끝나면 '잘했어요' 뒤 다음 단계로
  let easy = false, sayKey = '';
  function countText() {
    if (cur === 'gyul') return `${gyuls.length - gyulLeft().length}/${gyuls.length}`;
    if (cur === 'throw') return `${S.hits}/${TUT.hits}`;
    if (cur === 'pick') { const n = (pts.trash || []).length; return `${n - tutTrashLeft()}/${n}`; }
    return '';
  }
  function say(name) {
    let text, ic;
    if (name === 'ok') { text = '잘했어요!'; ic = 'ok'; } else {
      const s = SAY[name]; let v = phone() ? s.touch : s.pc; if (typeof v === 'function') v = v(player.running);
      text = v[easy ? 1 : 0]; ic = s.ic;
    }
    const n = name === 'ok' ? '' : countText(), key = `${name}|${text}|${n}`;
    if (key === sayKey && !tEl.hidden) return;
    const fresh = !sayKey.startsWith(name + '|') || tEl.hidden; sayKey = key;
    tEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[ic] || ''}</svg><span>${text}</span>${n ? `<b class="n">${n}</b>` : ''}`;
    tEl.classList.toggle('ok', name === 'ok'); tEl.hidden = false;
    if (fresh) { tEl.classList.remove('in'); void tEl.offsetWidth; tEl.classList.add('in'); }
    onTop?.();
  }
  function countPop() { const b = tEl.querySelector('.n'); if (!b) return; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
  function shake() { tEl.classList.remove('shake'); void tEl.offsetWidth; tEl.classList.add('shake'); }
  const hideToast = () => { tEl.hidden = true; sayKey = ''; onTop?.(); };

  const unlock = (name) => { document.querySelectorAll(`[data-tut="${name}"]`).forEach((el) => { if (el.classList.contains('tut-on')) return; el.classList.add('tut-on', 'tut-pop'); setTimeout(() => el.classList.remove('tut-pop'), 900); }); };
  const target = (v, r = TUT.ringR, on = true) => { tgt = v ? new THREE.Vector3(v.x, 0, v.z) : null; tgtR = r; ringOn = on; if (tgt) tgt.y = height(tgt.x, tgt.z); };
  const fwd = new THREE.Vector3(Math.sin(pts.gate.dir), 0, Math.cos(pts.gate.dir));
  const pastGate = () => (player.pos.x - pts.gate.x) * fwd.x + (player.pos.z - pts.gate.z) * fwd.z > 1.5;
  const near = (v, r) => Math.hypot(player.pos.x - v.x, player.pos.z - v.z) < r;
  const shopFront = () => ch?.shopFront || ch?.front;
  const nearestGyul = () => { let b = null, bd = 1e9; for (const g of gyulLeft()) { const d = Math.hypot(g.x - player.pos.x, g.z - player.pos.z); if (d < bd) { bd = d; b = g; } } return b; };
  // 살 것은 귤이 모자랄 일이 없게: 집게·배낭 값이 모자라면 채움 (보통은 첫 보너스로 충분)
  function topUp() {
    const need = (save.equip.tool < 2 ? TOOLS[1].price : 0) + (save.equip.bag < 1 ? BAGS[0].price : 0);
    if (save.coins < need) { save.coins = need; persist(); onCoins?.(); }
  }
  const begin = (name) => {
    cur = name; timer = 0; easy = false; idle = 0; best = 1e9; progKey = '';
    // 이 단계까지 나와야 할 UI (중간에 다시 들어와도 앞 단계 UI 가 보이게)
    for (const st of steps.slice(0, idx(name) + 1)) for (const u of UNLOCK[st] || []) unlock(u);
    if (name === 'walk') target(pts.walk);
    if (name === 'run') target(pts.run);
    if (name === 'gyul') target(nearestGyul(), 1.1);
    if (name === 'throw') target(tgt0, 1.2, false);
    if (name === 'pick') target(tutTrashNext(), 1.2);
    if (name === 'dump') target(ch?.front, 2.4);
    if (name === 'bonus') target(null);
    if (name === 'tongs' || name === 'bag') { topUp(); target(shopFront(), 1.8); }
    if (name === 'gate') { const was = jeong.isOpen; openJeong(); if (!was) addLane(TUT.gateD); target(pts.beyond, 2.4); }
    say(name);
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
  const finish = () => {
    const c = cellOf[cur]; S.step = idx(cur) + 1; persist(); cur = null; target(null);
    if (c != null && cellDone(c)) openCell(c);
    say('ok'); gap = TUT.okT; setFocus(null);
  };
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
    const r = el.getBoundingClientRect(), round = Math.abs(r.width - r.height) < 6, w = (round ? Math.max(r.width, r.height) : r.width) + 12, h = (round ? w - 12 : r.height) + 12; // 둥근 버튼은 원, 넓은 칸은 둥근 사각
    focusEl.hidden = false; focusEl.style.left = (r.left + r.width / 2) + 'px'; focusEl.style.top = (r.top + r.height / 2) + 'px'; focusEl.style.setProperty('--w', w + 'px'); focusEl.style.setProperty('--h', h + 'px');
  }
  // 진행이 없는 시간: 목표에 1.5m 더 가까워지거나, 줍기·맞히기·누를 곳이 바뀌면 0으로
  let idle = 0, best = 1e9, progKey = '';
  function tickIdle(dt) {
    const k = `${S.gyul.length}|${S.hits}|${tutTrashLeft()}|${shopTab?.() || ''}|${ctxIc?.() || ''}|${player.running ? 1 : 0}|${counters.dump}`;
    let moved = false;
    if (tgt) { const d = Math.hypot(player.pos.x - tgt.x, player.pos.z - tgt.z); if (d < best - 1.5) { best = d; moved = true; } }
    if (k !== progKey || moved) { progKey = k; idle = 0; } else idle += dt;
    if (idle >= TUT.easyT && !easy) { easy = true; sayKey = ''; say(cur); shake(); }
  }
  function update(dt) {
    if (S.done) return;
    timer += dt; clock += dt;
    for (const g of gyuls) if (g.m.visible) { g.m.rotation.y += TG.spin * dt; const b = Math.sin(clock * TG.bobSpeed + g.ph) * TG.bob; g.m.position.y = g.y + b; g.gl.position.y = -TG.hover - b + 0.03; } // 떠서 돌기 (#63)
    if (pens) pens.update(dt, player.pos);
    tickLanes(dt);
    if (cur) { if (doneWhen[cur]()) finish(); }
    if (!cur) {
      if (gap > 0) { gap -= dt; ring.visible = false; bob.visible = false; arrowEl.hidden = true; return; } // '잘했어요' 동안
      let next = steps[S.step];
      while (next && (next === 'tongs' || next === 'bag') && doneWhen[next]()) { S.step++; next = steps[S.step]; } // 이미 집게·배낭이 있으면 건너뜀
      if (!next) { complete(); return; }
      cells.forEach((c, i) => { if (cellDone(i)) penGate[i]?.open(false); });
      begin(next);
    }
    if (cur === 'pick') { const n = tutTrashNext(); if (n && (!tgt || Math.hypot(n.x - tgt.x, n.z - tgt.z) > 0.1)) target(n, 1.2); }
    if (cur === 'gyul') { const n = nearestGyul(); if (n && (!tgt || Math.hypot(n.x - tgt.x, n.z - tgt.z) > 0.1)) target(n, 1.1); }
    tickIdle(dt);
    say(cur); // 남은 수·달리는 중에 따라 바뀐 한 줄
    // 과녁 흔들림
    if (wob > 0) { wob = Math.max(0, wob - dt * 2.2); board.rotation.x = Math.sin(wob * 22) * 0.25 * wob; }
    // 원과 가장자리 화살표 (진행이 없으면 화살표도)
    if (tgt) {
      ring.visible = ringOn; ring.position.copy(tgt); ring.position.y += 0.05; ring.scale.setScalar(tgtR);
      const k = (clock * 0.8) % 1; pulse.scale.setScalar(1 + k * 0.5); pulse.material.opacity = 0.8 * (1 - k); disc.material.opacity = 0.25 + Math.sin(clock * 4) * 0.08;
      bob.visible = ringOn; bob.position.set(tgt.x, tgt.y + 1.5 + Math.abs(Math.sin(clock * 3.2)) * 0.5, tgt.z); bob.rotation.y = clock * 1.6;
      const d = Math.hypot(player.pos.x - tgt.x, player.pos.z - tgt.z);
      const v = tgt.clone(); v.y += 1; const ndc = v.project(camera); const off = ndc.z > 1 || Math.abs(ndc.x) > 0.9 || Math.abs(ndc.y) > 0.85;
      if ((off || d > TUT.arrowFar || (idle >= TUT.fingerT && d > 3)) && !player.rescue) { arrowEl.hidden = false; placeArrow(arrowEl, tgt, 1.6); } else arrowEl.hidden = true;
    } else { ring.visible = false; bob.visible = false; arrowEl.hidden = true; }
    setFocus(focusTarget());
    focusEl.classList.toggle('idle', idle >= TUT.fingerT); // 손가락은 진행이 없을 때만
  }
  function notify(k, n = 1) { if (k in counters) counters[k] += n; }
  function endUI(quiet) {
    S.done = true; persist(); target(null); ring.visible = false; bob.visible = false; arrowEl.hidden = true; setFocus(null);
    S.step = steps.length; cur = null;
    if (pens) { pens.remove(); pens = null; } // 칸 돌담·정낭은 튜토리얼 동안만
    for (const L of lanes) { scene.remove(L.m); L.m.geometry.dispose(); } lanes.length = 0;
    gyuls.forEach((g) => { g.m.visible = false; }); stand.visible = false;
    if (quiet) hideToast(); else { say('ok'); setTimeout(hideToast, TUT.okT * 1000 + 400); }
    document.body.classList.remove('tut', 'tut-dim'); document.querySelectorAll('[data-tut]').forEach((el) => el.classList.add('tut-on')); onDone?.();
  }
  function complete() { endUI(false); }
  // 건너뛰기(개발자 버튼): 정낭이 열리고 UI 가 전부 나옴 (첫 보너스는 나중에 처음 버릴 때 그대로)
  function skipAll() { if (S.done) return; openJeong(); endUI(true); }
  return { update, notify, skipAll, gyulNear, takeGyul, get active() { return !S.done; }, get step() { return cur; }, get hits() { return S.hits; }, gyuls, board: stand, focus: () => focused,
    toast: () => (tEl.hidden ? null : { text: tEl.querySelector('span')?.textContent || '', n: tEl.querySelector('.n')?.textContent || '', easy, shake: tEl.classList.contains('shake') }),
    idle: () => idle, setIdle: (v) => { idle = v; }, finger: () => !focusEl.hidden && focusEl.classList.contains('idle'),
    cells: () => cells.map((c, i) => ({ from: cellFrom(i), to: c.to, l: c.l, r: c.r, steps: c.steps, open: i < cells.length - 1 ? !!penGate[i]?.isOpen : !!jeong.isOpen })), pens: () => pens,
    local: (x, z) => { const a = P(0), b = P(1), fx = b[0] - a[0], fz = b[1] - a[1], dx = x - a[0], dz = z - a[1]; return { d: dx * fx + dz * fz, lat: dx * -fz + dz * fx }; }, // 들머리 길 좌표 (곧은 길)
  };
}
