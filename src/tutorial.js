// 들머리 튜토리얼 (#31 → #62 → #100). 위쪽 토스트 한 줄로 할 일을 알려 주고, 바닥의 빛나는 원으로 이끈다.
// 걷기 → 확대·축소(#151) → 달리기 → 귤 3개(지나가면 모임 #151) → 과녁에 귤 3번 맞히기 → (돌다리를 건너) 작은 더미 치우기·꽃(#151, 호주머니) → 클린하우스에 버리기 → 첫 보너스 귤 → 집게 → 배낭 → 정낭 지나 오름으로
// #221 집게·배낭은 가게 거리의 진짜 장비점에서: 그 단계가 되면 가게 쪽 정낭이 열리고 장비점 셔터가 올라감. 길 안내(원·가장자리 화살표)는 정낭 → 장비점 문 앞, 골목에 귤 두 개. 들머리 좌판은 없앰
// #100 단계마다 격리된 칸: 들머리 마당을 낮은 돌담(stonewall.js createPens)으로 4칸으로 나눔(TUT.cells). 칸의 단계를 다 하면 다음 칸 정낭이 열리고 길이 빛남.
// 단계마다 그 행동을 해야 넘어감: 다음 단계 UI 는 그때 나옴(data-tut). 지금 눌러야 할 화면 버튼·상점 칸엔 귤색 맥박 고리(#tut-focus), 나머지 UI 는 살짝 어둡게(body.tut-dim).
// 진행이 없으면 TUT.fingerT 초 뒤 손가락이 누를 곳을 가리키고, TUT.easyT 초 뒤 토스트를 흔들고 더 쉬운 말로 바꿈. 실패 상태 없음(손 던지기는 귤이 줄지 않음, 살 귤은 모자라면 채움)
// 건너뛰기는 개발자 버튼(?hwi=1)에만 (menu.js dev-tut → skipAll). 저장 save.tut {step, done, v, gyul[], hits}
// #44: 점프 단계를 뺌. 예전 저장(save.tut.v 없음)의 단계 번호는 하나씩 당김. #62: v2 → v3 는 귤·과녁 두 단계가 끼어 2 이상이면 둘 밀기. #151: v3 → v4 는 확대 단계가 걷기 뒤에 끼어 1 이상이면 하나 밀기
// #151 가게 거리 쪽 길목(SHOP_ST.d)은 돌담 대신 닫힌 정낭. 튜토리얼이 끝나면 다른 칸 담과 함께 사라짐
import * as THREE from 'three';
import { TUT, TANGERINE as TG, TOOLS, BAGS, WALL, SHOP_ST, GYUL_PICK } from './balance.js';
import { nsAlong } from './namsongi.js';
import { createPens } from './stonewall.js';
import { drape } from './drape.js';
import { ic } from './icons.js';

// 토스트 아이콘 (viewBox 24, 선)
const IC = {
  zoom: ic('zoom'),
  walk: ic('walk'),
  run: ic('run'),
  hand: ic('pick'),
  throw: ic('target'),
  dump: ic('cleanhouse'),
  gift: ic('gift'),
  tongs: ic('tongs'),
  bag: ic('bag'),
  gate: ic('gate'),
  ok: ic('check'),
};
// 할 일 한 줄: [보통, 더 쉬운 말]. PC 는 키 이름, 폰은 화면 버튼. 함수면 지금 상태로 고름
const SAY = {
  walk: { pc: ['WASD 키로 걸어 봐요', 'W 키를 꾹 눌러요'], touch: () => (document.body.classList.contains('stick-float') ? ['왼쪽 아래 아무 데나 누른 채 끌어 보세요', '왼쪽 아래를 누른 채 끌어요'] : ['화면을 눌러 걸어 봐요', '빛나는 동그라미를 눌러요']), ic: 'walk' }, /* 떠다니는 스틱 (#211) */
  run: { pc: ({ r }) => (r ? ['빛나는 곳까지 달려요', '빛나는 곳으로 가요'] : ['Shift 키로 달려 봐요', 'Shift 키를 한 번 눌러요']),
    touch: ({ r }) => (r ? ['빛나는 곳까지 달려요', '빛나는 곳으로 가요'] : ['달리기 버튼을 눌러요', '빛나는 버튼을 눌러요']), ic: 'run' },
  zoom: { pc: ['마우스 휠을 굴려 화면을 당겨 봐요', '휠을 위아래로 굴려요'], touch: ['두 손가락을 벌리거나 오므려 봐요', '두 손가락으로 화면을 벌려요'], ic: 'zoom' }, // #151
  gyul: { pc: ['귤 쪽으로 걸어가 봐요', '귤 옆을 지나가요'], touch: ['귤 쪽으로 걸어가 봐요', '귤 옆을 지나가요'], ic: 'walk' }, // #151 지나가면 모임
  throw: { pc: ['F 키로 과녁에 던져요', 'F 키만 누르면 맞아요'], touch: ['과녁에 귤을 던져요', '빛나는 버튼만 눌러요'], ic: 'throw' },
  pick: { pc: ['E 키로 쓰레기 더미를 치워요', '더미 옆에서 E 키'], touch: ['쓰레기 더미를 치워요', '더미 옆에서 손 버튼'], ic: 'hand' }, // #151 작은 더미
  dump: { pc: ['클린하우스에 버려요', '파란 집 앞에서 F 키'], touch: ['클린하우스에 버려요', '파란 집 앞에서 버튼'], ic: 'dump' },
  bonus: { pc: ['보너스 귤을 받아요!', '보너스 귤을 받아요!'], touch: ['보너스 귤을 받아요!', '보너스 귤을 받아요!'], ic: 'gift' },
  /* #221 진짜 장비점: c.shop = 창이 열림, c.door = 문 앞 */
  tongs: { pc: (c) => (c.shop ? ['집게를 사요', '빛나는 버튼을 눌러요'] : c.door ? ['F 키로 장비점에 들어가요', '문 앞에서 F 키'] : ['가게 거리 장비점에서 집게를 사요', '빛나는 곳을 따라가요']),
    touch: (c) => (c.shop ? ['집게를 사요', '빛나는 버튼을 눌러요'] : c.door ? ['버튼을 눌러 장비점에 들어가요', '빛나는 버튼을 눌러요'] : ['가게 거리 장비점에서 집게를 사요', '빛나는 곳을 따라가요']), ic: 'tongs' },
  bag: { pc: (c) => (c.shop ? ['이제 배낭을 사요', '빛나는 칸을 눌러요'] : c.door ? ['F 키로 장비점에 들어가요', '문 앞에서 F 키'] : ['장비점에서 배낭을 사요', '빛나는 곳을 따라가요']),
    touch: (c) => (c.shop ? ['이제 배낭을 사요', '빛나는 칸을 눌러요'] : c.door ? ['버튼을 눌러 장비점에 들어가요', '빛나는 버튼을 눌러요'] : ['장비점에서 배낭을 사요', '빛나는 곳을 따라가요']), ic: 'bag' },
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

export function createTutorial({ save, persist, player, isTouch, camDist, gyulR, onGyul, toast, pts, scene, height, camera, placeArrow, stream, jeong, openJeong, bagVol, bagCap, tutTrashLeft, tutTrashNext, ch, col, low, addTargets, sound, juice, ctxIc, shopTab, onTop, onCoins, onDone, gear, openGear }) {
  const S = (save.tut ||= { step: 0, done: false, v: 5 });
  if (!S.v) { if (S.step > 2) S.step--; S.v = 2; } // 예전 순서(점프가 3번째)의 저장 → v2
  if (S.v === 2) { if (S.step >= 2) S.step += 2; S.v = 3; persist(); } // #62: 귤·과녁 단계가 달리기 뒤에 끼어듦 (이미 지난 사람은 건너뜀)
  if (S.v === 3) { if (S.step >= 1) S.step += 1; S.v = 4; persist(); } // #151: 확대 단계가 걷기 뒤에 끼어듦
  if (S.v === 4) { if (!S.done && S.step === 9) S.step = 8; S.v = 5; persist(); } /* #221 좌판 배낭 단계에 멈춘 저장 → 장비점 가기 처음(집게가 있으면 배낭으로 바로 넘어감) */
  if (!Array.isArray(S.gyul)) S.gyul = [];
  S.hits ||= 0;
  const none = { update() {}, notify() {}, skipAll() {}, gyulNear: () => -1, takeGyul() {}, active: false };
  if (!pts || !pts.walk || !stream || !jeong) { return none; }
  const steps = ['walk', 'zoom', 'run', 'gyul', 'throw', 'pick', 'dump', 'bonus', 'tongs', 'bag', 'gate'];
  // 단계마다 새로 나오는 UI. 줍기 버튼(E)은 쓰레기 줍기부터(#151, 귤은 지나가면 모임), 상호작용 버튼(F)은 과녁 던지기부터 (#62)
  const UNLOCK = { walk: ['move'], run: ['speed', 'jump'], gyul: ['gyul'], throw: ['interact'], pick: ['pick', 'bag', 'clean'] }; // 위쪽 줄 (#75): 구역·좌표·업적(hud)은 끝나면
  const idx = (name) => steps.indexOf(name);
  // 위쪽 토스트 (#60·#66 과 같은 모양): 아이콘 + 한 줄 + 남은 수
  const tEl = document.createElement('div'); tEl.id = 'tut-toast'; tEl.className = 'tip-toast panel'; tEl.setAttribute('role', 'status'); tEl.hidden = true; document.body.append(tEl);
  tEl.addEventListener('click', (e) => { if (cur === 'zoom' && e.target.closest('.tut-pass')) counters.zoom = 1; });
  // #151 폰 확대 단계: 화면 가운데 두 손가락이 벌어졌다 오므려지는 그림 (#tut-focus 손가락 그림체)
  const pinchEl = document.createElement('div'); pinchEl.id = 'tut-pinch'; pinchEl.hidden = true; pinchEl.setAttribute('aria-hidden', 'true'); pinchEl.innerHTML = `<b class="f1">${FINGER}</b><b class="f2">${FINGER}</b>`; document.body.append(pinchEl);
  const arrowEl = document.createElement('div'); arrowEl.id = 'tut-arrow'; arrowEl.className = 'panel round'; arrowEl.hidden = true; arrowEl.innerHTML = '<i class="dot"></i><i class="tip"></i>'; document.body.append(arrowEl);
  // 지금 눌러야 할 곳: 귤색 고리가 퍼지는 맥박. 진행이 없으면 손가락(.idle)
  const focusEl = document.createElement('div'); focusEl.id = 'tut-focus'; focusEl.hidden = true; focusEl.innerHTML = `<i class="ring"></i><i class="ring r2"></i><b class="finger">${FINGER}</b>`; document.body.append(focusEl);

  // 바닥의 빛나는 원 + 위아래로 움직이는 화살표
  const ring = new THREE.Group(); ring.visible = false; scene.add(ring);
  const glowMat = new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
  const edgeMat = new THREE.MeshBasicMaterial({ color: '#fff3c9', transparent: true, opacity: 0.9, depthWrite: false });
  // #151 원이 비탈에서 땅에 묻히지 않게: 점마다 땅 높이를 따라 휨 (drape.js). 겹쳐 그릴 때 깜빡이지 않게 조금씩 더 띄움
  const disc = new THREE.Mesh(new THREE.RingGeometry(0, 1, 32, 4).rotateX(-Math.PI / 2), glowMat); ring.add(disc);
  const edge = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40).rotateX(-Math.PI / 2), edgeMat); ring.add(edge);
  const pulse = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 40).rotateX(-Math.PI / 2), edgeMat.clone()); ring.add(pulse);
  for (const m of [disc, edge, pulse]) m.renderOrder = 3;
  const dDisc = drape(disc, height), dEdge = drape(edge, height), dPulse = drape(pulse, height);
  const bob = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.6, 4).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: '#ffb347', depthTest: false, transparent: true }));
  bob.renderOrder = 9; bob.visible = false; scene.add(bob);

  // ---------- #62 귤 3개 ----------
  const GR = 0.26 * TG.scale; // 튜토리얼 귤도 같은 크기·색 (#63)
  const gyulGeo = new THREE.SphereGeometry(GR, 12, 9), gyulMat = new THREE.MeshLambertMaterial({ color: TG.color, emissive: TG.emissive, emissiveIntensity: TG.emissiveI });
  const gGlowGeo = new THREE.CircleGeometry(TG.glowR * 1.2, 14).rotateX(-Math.PI / 2), gGlowMat = new THREE.MeshBasicMaterial({ color: TG.glowColor, transparent: true, opacity: TG.glowOpacity, depthWrite: false });
  const gLeafGeo = new THREE.PlaneGeometry(0.2 * TG.scale, 0.11 * TG.scale), gLeafMat = new THREE.MeshLambertMaterial({ color: '#4f8a3a', side: THREE.DoubleSide });
  const makeGyul = (p, i, at) => {
    const m = new THREE.Mesh(gyulGeo, gyulMat); m.castShadow = true;
    const lf = new THREE.Mesh(gLeafGeo, gLeafMat); lf.position.y = GR + 0.01; lf.rotation.x = -1; m.add(lf);
    const gl = new THREE.Mesh(gGlowGeo, gGlowMat); gl.renderOrder = 1; m.add(gl);
    const y = height(p.x, p.z) + GR; m.position.set(p.x, y, p.z); gl.position.y = -TG.hover + 0.03; m.visible = !S.done && !S.gyul.includes(i); scene.add(m);
    return { i, at, x: p.x, z: p.z, y: y + TG.hover, m, gl, ph: i * 2.1 };
  };
  const gyuls = (pts.gyul || []).map((p, i) => makeGyul(p, i, 'gyul')); /* #221 뒤에 장비점 가는 골목 귤(at: 'shop')이 붙음 */
  const gyulLeft = () => gyuls.filter((g) => g.at === 'gyul' && g.m.visible);
  const gyulNear = () => -1; // #151 줍기 버튼으로 줍지 않음 (지나가면 모임)
  function takeGyul(i) { const g = gyuls[i]; if (!g || !g.m.visible) return null; g.m.visible = false; g.fly = null; if (!S.gyul.includes(i)) S.gyul.push(i); persist(); return g.m.position.clone(); }
  // #151 귤 모으는 범위(gyulR, 본게임과 같은 값) 안에 들면 GYUL_PICK.suckT 초 동안 캐릭터로 빨려 와 +1
  function tickGyulPull(dt) {
    const R = gyulR?.() ?? GYUL_PICK.r;
    for (const g of gyuls) {
      if (!g.m.visible) continue;
      if (!g.fly) { if ((g.at === 'gyul' ? cur === 'gyul' : shopStep()) && Math.hypot(g.x - player.pos.x, g.z - player.pos.z) < R) g.fly = { t: 0, from: g.m.position.clone() }; continue; }
      const f = g.fly; f.t += dt; const k = Math.min(1, f.t / GYUL_PICK.suckT), e = k * k;
      g.m.position.set(f.from.x + (player.pos.x - f.from.x) * e, f.from.y + (player.pos.y + 1 - f.from.y) * e + Math.sin(k * Math.PI) * 0.6, f.from.z + (player.pos.z - f.from.z) * e);
      g.gl.visible = false;
      if (k >= 1) { const at = takeGyul(g.i); if (at) { onGyul?.(at); countPop(); } }
    }
  }

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
  let shopGate = null, shopJ = null, shopSaid = false; // #151 가게 거리 쪽 닫힌 정낭 {c, ux, uz}, 다가가면 안내 한 번
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
    // #151 가게 거리 쪽 길목: 그 칸 왼쪽 담을 끊고 닫힌 정낭 (튜토리얼 동안 열리지 않음)
    const sd = SHOP_ST.d, sg = WALL.gateW + 0.35, sCell = cells.findIndex((c, i) => cellFrom(i) < sd - sg && c.to > sd + sg);
    cells.forEach((c, i) => {
      const d0 = cellFrom(i);
      if (i === sCell) { line(d0, sd - sg, -c.l); line(sd + sg, c.to, -c.l); } else line(d0, c.to, -c.l);
      line(d0, c.to, c.r);
      if (!i) across(d0, c.l, c.r, false);
      if (i < cells.length - 1) { const n = cells[i + 1]; across(c.to, Math.max(c.l, n.l), Math.max(c.r, n.r), true); gates.push({ ...latDir(c.to), open: cellDone(i) }); }
    });
    if (sCell >= 0) { const a = P(sd, -cells[sCell].l), b = P(sd + 1, -cells[sCell].l); shopGate = { c: { x: a[0], z: a[1] }, ux: b[0] - a[0], uz: b[1] - a[1], open: false }; gates.push(shopGate); }
    pens = createPens({ scene, height, runs, gates, low, col, hk: TUT.penH });
    pens.gates.forEach((J, i) => { if (gates[i] !== shopGate) penGate[i] = J; else shopJ = J; });
  }
  if (shopGate && gear?.way) for (const p of gear.way) gyuls.push(makeGyul(p, gyuls.length, 'shop')); /* #221 골목 귤 */

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
  const counters = { dump: 0, bonus: 0, zoom: 0 }; let zoom0 = 0;
  const phone = () => isTouch;
  // 토스트: 단계가 시작될 때 할 일 한 줄. 단계가 끝날 때까지 남고, 끝나면 '잘했어요' 뒤 다음 단계로
  let easy = false, sayKey = '';
  function countText() {
    if (cur === 'gyul') { const n = gyuls.filter((g) => g.at === 'gyul').length; return `${n - gyulLeft().length}/${n}`; }
    if (cur === 'throw') return `${S.hits}/${TUT.hits}`;
    if (cur === 'pick') { const n = (pts.trash || []).length; return `${n - tutTrashLeft()}/${n}`; }
    return '';
  }
  function say(name, okText) {
    let text, ic;
    if (name === 'ok') { text = okText || '잘했어요!'; ic = 'ok'; } else {
      const s = SAY[name]; let v = phone() ? s.touch : s.pc; if (typeof v === 'function') v = v({ r: player.running, shop: !!shopTab?.(), door: atDoor() });
      text = v[easy ? 1 : 0]; ic = s.ic;
    }
    const n = name === 'ok' ? '' : countText(), skip = name === 'zoom' && timer > TUT.zoomSkipT, key = `${name}|${text}|${n}|${skip}`; // #151 확대는 8초 뒤 건너뛰기
    if (key === sayKey && !tEl.hidden) return;
    const fresh = !sayKey.startsWith(name + '|') || tEl.hidden; sayKey = key;
    tEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[ic] || ''}</svg><span>${text}</span>${n ? `<b class="n">${n}</b>` : ''}${skip ? '<button type="button" class="tut-pass">건너뛰기</button>' : ''}`;
    tEl.classList.toggle('ok', name === 'ok'); tEl.classList.toggle('go', skip); tEl.hidden = false;
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
  const shopStep = () => cur === 'tongs' || cur === 'bag';
  const shopDoor = () => gear?.door || shopFront(); /* #221 가게 거리 장비점 문 앞 (거리가 없는 맵만 예전 좌판) */
  const atDoor = () => { const d = shopDoor(); return !!d && near(d, gear?.r || 3); };
  // #221 정낭 너머가 목표면 가게 쪽 정낭을 먼저 가리킴 (담을 돌아가지 않게). 정낭 줄의 양쪽으로 나눔
  function via(dest) {
    if (!shopGate || !dest || !shopGate.open) return dest;
    const g = shopGate, l = Math.hypot(g.ux, g.uz) || 1, nx = -g.uz / l, nz = g.ux / l, side = (q) => (q.x - g.c.x) * nx + (q.z - g.c.z) * nz;
    const sp = side(player.pos), sd = side(dest); if (Math.sign(sp) === Math.sign(sd) && Math.abs(sp) > 0.9) return dest;
    const k = Math.sign(sd) || 1; return { x: g.c.x + nx * k * 1.6, z: g.c.z + nz * k * 1.6, via: true };
  }
  function openShopSide(anim = true) { /* #221 가게 쪽 정낭 + 장비점 셔터 */
    if (!gear) return;
    if (shopGate && !shopGate.open) { shopGate.open = true; shopJ?.open(anim); if (anim) sound?.beep?.(true); }
    openGear?.();
  }
  const nearestGyul = () => { let b = null, bd = 1e9; for (const g of gyulLeft()) { const d = Math.hypot(g.x - player.pos.x, g.z - player.pos.z); if (d < bd) { bd = d; b = g; } } return b; };
  // 살 것은 귤이 모자랄 일이 없게: 집게·배낭 값이 모자라면 채움 (보통은 첫 보너스로 충분)
  function topUp() {
    const need = (save.equip.tool < 2 ? TOOLS[1].price : 0) + (save.equip.bag < 1 ? BAGS[0].price : 0);
    if (save.coins < need) { const gap = need - save.coins; save.coins = need; persist(); onCoins?.(gap); } /* 채운 귤은 번 귤이 아님 (#202 레벨) */
  }
  const begin = (name) => {
    cur = name; timer = 0; easy = false; idle = 0; best = 1e9; progKey = '';
    // 이 단계까지 나와야 할 UI (중간에 다시 들어와도 앞 단계 UI 가 보이게)
    for (const st of steps.slice(0, idx(name) + 1)) for (const u of UNLOCK[st] || []) unlock(u);
    if (name === 'walk') target(pts.walk);
    if (name === 'zoom') { target(null); zoom0 = camDist?.() ?? 0; }
    if (name === 'run') target(pts.run);
    if (name === 'gyul') target(nearestGyul(), 1.1);
    if (name === 'throw') target(tgt0, 1.2, false);
    if (name === 'pick') target(pts.heap || tutTrashNext(), pts.heap ? 1.6 : 1.2); // #151 작은 더미
    if (name === 'dump') target(ch?.front, 2.4);
    if (name === 'bonus') target(null);
    if (name === 'tongs' || name === 'bag') { topUp(); openShopSide(); target(via(shopDoor()), 1.8); }
    if (name === 'gate') { const was = jeong.isOpen; openJeong(); if (!was) addLane(TUT.gateD); target(via(pts.beyond), 2.4); }
    say(name);
  };
  // 각 단계의 끝나는 조건
  const doneWhen = {
    walk: () => near(pts.walk, TUT.ringR),
    zoom: () => counters.zoom > 0 || !camDist || Math.abs(camDist() - zoom0) > zoom0 * TUT.zoomK, // #151 손으로 바꾼 카메라 거리(cam.zoomed)가 시작 값에서 15% 넘게 바뀌면
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
  const OK_SAY = { tongs: '집게를 손에 들었어요!', bag: '배낭을 멨어요! 이제 오름으로' }; /* #221 장착 안내 */
  const finish = () => {
    const c = cellOf[cur], was = cur; S.step = idx(cur) + 1; persist(); cur = null; target(null);
    if (c != null && cellDone(c)) openCell(c);
    say('ok', OK_SAY[was]); gap = TUT.okT * (OK_SAY[was] ? 1.6 : 1); setFocus(null);
  };
  // 지금 눌러야 할 화면 요소 (없으면 null: 땅의 원만)
  const vis = (sel) => { const el = typeof sel === 'string' ? document.querySelector(sel) : sel; if (!el || el.hidden) return null; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? el : null; };
  function focusTarget() {
    if (cur === 'walk') return phone() && !player.speed ? vis('#joy') : null;
    if (cur === 'run') return player.running ? null : vis('#btn-speed');
    if (cur === 'gyul') return null; // #151 지나가면 모임
    if (cur === 'throw') return ctxIc?.() === 'throw' && tAim && Math.hypot(tAim.pos.x - player.pos.x, tAim.pos.z - player.pos.z) < 15 ? vis('#btn-ctx') : null;
    if (cur === 'pick') { const n = tutTrashNext(); return n && Math.hypot(n.x - player.pos.x, n.z - player.pos.z) < 2.2 ? vis('#btn-pick') : null; }
    if (cur === 'dump') return ctxIc?.() === 'dump' ? vis('#btn-ctx') : null;
    if (cur === 'tongs' || cur === 'bag') {
      const want = cur === 'tongs' ? 'tool' : 'bag', tab = shopTab?.(); // 장비점 창 (#128): 데스크톱은 묶음이 나란히, 폰은 위 탭
      if (tab) return vis(`#shoppop .buy-group[data-k="${want}"] .buy-card.next .buy-btn`) || vis(`#shoppop-tabs [data-tab="${want}"]`);
      return ctxIc?.() === 'shop' || ctxIc?.() === 'gear' ? vis('#btn-ctx') : null;
    }
    return null;
  }
  let focused = null, shopWas = false;
  function setFocus(el) {
    if (el !== focused) { focused?.classList.remove('tut-focus'); focused = el; el?.classList.add('tut-focus'); document.body.classList.toggle('tut-dim', !!el); }
    focusEl.classList.toggle('drag', el?.id === 'joy' && document.body.classList.contains('stick-float')); /* 누른 채 끄는 손가락 (#211) */
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
    tickGyulPull(dt);
    for (const g of gyuls) if (g.m.visible && !g.fly) { g.m.rotation.y += TG.spin * dt; const b = Math.sin(clock * TG.bobSpeed + g.ph) * TG.bob; g.m.position.y = g.y + b; g.gl.position.y = -TG.hover - b + 0.03; } // 떠서 돌기 (#63)
    if (pens) pens.update(dt, player.pos);
    if (shopGate && pens && !shopSaid && !shopGate.open && Math.hypot(player.pos.x - shopGate.c.x, player.pos.z - shopGate.c.z) < TUT.shopGateR) { shopSaid = true; toast?.('튜토리얼을 마치면 가게 거리가 열려요'); }
    tickLanes(dt);
    if (cur) { if (doneWhen[cur]()) finish(); }
    if (!cur) {
      if (gap > 0) { gap -= dt; ring.visible = false; bob.visible = false; arrowEl.hidden = true; pinchEl.hidden = true; return; } // '잘했어요' 동안
      let next = steps[S.step];
      while (next && (next === 'tongs' || next === 'bag') && doneWhen[next]()) { S.step++; next = steps[S.step]; } // 이미 집게·배낭이 있으면 건너뜀
      if (!next) { complete(); return; }
      cells.forEach((c, i) => { if (cellDone(i)) penGate[i]?.open(false); });
      if (S.step > idx('tongs')) openShopSide(false); /* #221 이어 하기: 가게 쪽 정낭은 열린 채 */
      begin(next);
    }
    if (cur === 'pick' && !pts.heap) { const n = tutTrashNext(); if (n && (!tgt || Math.hypot(n.x - tgt.x, n.z - tgt.z) > 0.1)) target(n, 1.2); }
    if (shopStep() || cur === 'gate') { const dst = via(cur === 'gate' ? pts.beyond : shopDoor()), dr = dst?.via ? 1.4 : cur === 'gate' ? 2.4 : 1.8; if (dst && (!tgt || tgtR !== dr || Math.hypot(dst.x - tgt.x, dst.z - tgt.z) > 0.1)) target(dst, dr); }
    { const sh = !!shopTab?.(); if (shopStep() && shopWas && !sh) { easy = false; sayKey = ''; shake(); } shopWas = sh; } /* #221 장비점 창을 닫아 버리면 다시 안내 */
    if (cur === 'gyul') { const n = nearestGyul(); if (n && (!tgt || Math.hypot(n.x - tgt.x, n.z - tgt.z) > 0.1)) target(n, 1.1); }
    tickIdle(dt);
    say(cur); // 남은 수·달리는 중에 따라 바뀐 한 줄
    // 과녁 흔들림
    if (wob > 0) { wob = Math.max(0, wob - dt * 2.2); board.rotation.x = Math.sin(wob * 22) * 0.25 * wob; }
    // 원과 가장자리 화살표 (진행이 없으면 화살표도)
    if (tgt) {
      ring.visible = ringOn;
      const k = (clock * 0.8) % 1;
      if (ringOn) { dDisc(tgt.x, tgt.z, tgtR); dEdge(tgt.x, tgt.z, tgtR, 0, 0.01); dPulse(tgt.x, tgt.z, tgtR * (1 + Math.round(k * 20) / 40), 0, 0.02); } // 퍼지는 고리는 20단계로만 다시 휨 (저사양)
      pulse.material.opacity = 0.8 * (1 - k); disc.material.opacity = 0.25 + Math.sin(clock * 4) * 0.08;
      bob.visible = ringOn; bob.position.set(tgt.x, tgt.y + 1.5 + Math.abs(Math.sin(clock * 3.2)) * 0.5, tgt.z); bob.rotation.y = clock * 1.6;
      const d = Math.hypot(player.pos.x - tgt.x, player.pos.z - tgt.z);
      const v = tgt.clone(); v.y += 1; const ndc = v.project(camera); const off = ndc.z > 1 || Math.abs(ndc.x) > 0.9 || Math.abs(ndc.y) > 0.85;
      if ((off || d > TUT.arrowFar || (idle >= TUT.fingerT && d > 3)) && !player.rescue) { arrowEl.hidden = false; placeArrow(arrowEl, tgt, 1.6); } else arrowEl.hidden = true;
    } else { ring.visible = false; bob.visible = false; arrowEl.hidden = true; }
    setFocus(focusTarget());
    pinchEl.hidden = !(cur === 'zoom' && phone());
    focusEl.classList.toggle('idle', idle >= TUT.fingerT); // 손가락은 진행이 없을 때만
  }
  function notify(k, n = 1) { if (k in counters) counters[k] += n; }
  function endUI(quiet) {
    S.done = true; persist(); target(null); ring.visible = false; bob.visible = false; arrowEl.hidden = true; pinchEl.hidden = true; setFocus(null);
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
    shopGate: () => shopGate && { x: shopGate.c.x, z: shopGate.c.z, ux: shopGate.ux, uz: shopGate.uz, said: shopSaid, open: !!shopGate.open }, target: () => tgt && { x: tgt.x, z: tgt.z, r: tgtR },
    cells: () => cells.map((c, i) => ({ from: cellFrom(i), to: c.to, l: c.l, r: c.r, steps: c.steps, open: i < cells.length - 1 ? !!penGate[i]?.isOpen : !!jeong.isOpen })), pens: () => pens,
    local: (x, z) => { const a = P(0), b = P(1), fx = b[0] - a[0], fz = b[1] - a[1], dx = x - a[0], dz = z - a[1]; return { d: dx * fx + dz * fz, lat: dx * -fz + dz * fx }; }, // 들머리 길 좌표 (곧은 길)
  };
}
