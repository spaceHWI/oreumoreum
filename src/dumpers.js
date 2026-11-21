// 쓰레기 투기꾼·투기 트럭 (#47): 자정 리셋 대신 주기적으로 와서 더미를 다시 쌓는다
// 돌담 바깥에서 나타나 노린 더미 자리로 감(투기꾼은 곧장, 트럭은 탐방로를 따라) → DUMP.dumpT 초 동안 버림 → 왔던 길로 돌아가 사라짐
// 버리기 전에 귤(손 던지기·무기)을 맞히면 놀라 도망가고 쓰레기는 쌓이지 않는다. 플레이어를 공격하지 않음
// 쌓는 양·주기는 balance.js DUMP. 접속하지 않은 동안 쌓인 양은 catchUp 이 한꺼번에 (마지막 접속 시각은 trash 저장소의 seen)
// 쓰레기 상태를 바꾸는 곳은 trash.refill 하나 (멀티가 붙으면 서버가 맡을 부분)
import * as THREE from 'three';
import { gradHard } from './toon.js';
import { DUMP, ZONES } from './balance.js';
import { HEAP_TOTAL } from './trash.js';
import { buildTrailGraph } from './autowalk.js';
import { crowdGap, offlineAdds } from './refill.js';

const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// 한 번 올 때 쌓는 양: 한 명 기준 한 시간 양 ÷ 한 시간에 오는 횟수. 트럭 양은 평균이 맞도록 계산
export const DUMP_PER_HOUR = HEAP_TOTAL * DUMP.hourFrac;
const PER_VISIT = DUMP_PER_HOUR / (3600 / DUMP.every);
export const DUMP_AMT = { walker: DUMP.walker.amt, truck: Math.max(DUMP.walker.amt, Math.round((PER_VISIT - (1 - DUMP.truckP) * DUMP.walker.amt) / DUMP.truckP)) };

/* ---------- 모양 (로우폴리 임시) ---------- */
const matCache = new Map();
const tm = (c) => { let m = matCache.get(c); if (!m) { m = new THREE.MeshToonMaterial({ color: c, gradientMap: gradHard }); matCache.set(c, m); } return m; };
const mesh = (g, c, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(g, tm(c)); m.position.set(x, y, z); m.castShadow = true; return m; };
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// 투기꾼: 어두운 점퍼·모자·흰 마스크, 손에 검은 쓰레기봉투 (키 약 2.2, 캐릭터와 비슷)
// c: 색 바꾸기 leg·shoe·top(jacket)·face·hat·mask·withBag — 흡연자(#156)는 점퍼 색만·봉투 없이, 관광객(#163)은 색·마스크 없이
export function buildWalker(c = {}) {
  const C = { leg: '#3b3f48', shoe: '#25262b', top: c.jacket || '#4c5560', face: '#e8c6a4', hat: '#2c2f36', ...c };
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const legs = [-0.17, 0.17].map((x) => { const p = new THREE.Group(); p.position.set(x, 0.85, 0); p.add(mesh(box(0.24, 0.85, 0.26), C.leg, 0, -0.42, 0), mesh(box(0.26, 0.14, 0.36), C.shoe, 0, -0.82, 0.05)); body.add(p); return p; });
  body.add(mesh(box(0.66, 0.8, 0.42), C.top, 0, 1.25, 0)); // 점퍼
  body.add(mesh(new THREE.SphereGeometry(0.3, 8, 6), C.face, 0, 1.88, 0)); // 얼굴
  if (C.mask !== false) body.add(mesh(box(0.42, 0.16, 0.08), '#f4f4f0', 0, 1.8, 0.27)); // 마스크
  body.add(mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.2, 8), C.hat, 0, 2.08, 0)); // 모자
  body.add(mesh(box(0.5, 0.06, 0.3), C.hat, 0, 2.0, 0.24)); // 챙
  const arms = [-0.42, 0.42].map((x) => { const p = new THREE.Group(); p.position.set(x, 1.58, 0); p.add(mesh(box(0.18, 0.66, 0.2), C.top, 0, -0.32, 0)); body.add(p); return p; });
  const bag = new THREE.Group(); bag.position.set(0, -0.72, 0.05); arms[1].add(bag); bag.visible = C.withBag !== false; // 오른손 봉투
  const bg = new THREE.IcosahedronGeometry(0.38, 0); bg.scale(1, 1.15, 0.9);
  bag.add(mesh(bg, '#26262c', 0, -0.32, 0), mesh(new THREE.ConeGeometry(0.1, 0.2, 5), '#26262c', 0, 0.08, 0));
  return { root, body, legs, arms, bag, h: 2.2 };
}
// 투기 트럭: 작은 1톤 트럭, 짐칸에 쓰레기 (길이 약 4.4)
function buildTruck() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  body.add(mesh(box(2.0, 0.3, 4.2), '#3a3c42', 0, 0.62, 0)); // 차대
  body.add(mesh(box(1.95, 1.2, 1.35), '#e9e6dc', 0, 1.35, 1.35)); // 운전석
  body.add(mesh(box(1.8, 0.55, 0.06), '#6f8fa8', 0, 1.6, 2.04)); // 앞유리
  body.add(mesh(box(2.0, 0.22, 0.1), '#2a2b30', 0, 0.85, 2.1)); // 범퍼
  const bed = new THREE.Group(); bed.position.set(0, 0.8, -2.05); body.add(bed); // 짐칸 (뒤 끝을 축으로 기울임)
  bed.add(mesh(box(2.0, 0.12, 2.7), '#4e7b5a', 0, 0, 1.35));
  [[-0.95, 0], [0.95, 0]].forEach(([x]) => bed.add(mesh(box(0.1, 0.55, 2.7), '#5f8e6a', x, 0.3, 1.35)));
  bed.add(mesh(box(2.0, 0.55, 0.1), '#5f8e6a', 0, 0.3, 2.65));
  const load = new THREE.Group(); bed.add(load);
  const C = ['#26262c', '#3b5ea8', '#e8e4d8', '#b8915a', '#26262c', '#f4f4ee', '#2e2e34'];
  for (let i = 0; i < 9; i++) { const g = i % 3 === 1 ? box(0.6, 0.45, 0.5) : new THREE.IcosahedronGeometry(0.36, 0); const m = mesh(g, C[i % C.length], -0.6 + (i % 3) * 0.6, 0.38 + (i > 5 ? 0.4 : 0), 0.45 + Math.floor(i / 3) % 2 * 0.9 + (i > 5 ? 0.4 : 0)); m.rotation.set(i * 0.7, i * 1.3, 0); load.add(m); }
  const wheels = [];
  const wg = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10); wg.rotateZ(Math.PI / 2);
  [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.3], [0.95, -1.3]].forEach(([x, z]) => { const w = mesh(wg, '#1e1f23', x, 0.42, z); body.add(w); wheels.push(w); });
  return { root, body, bed, load, wheels, h: 2.0 };
}

// 머리 위 기운 막대 (트럭만, 적과 같은 모양)
const barBgMat = new THREE.SpriteMaterial({ color: '#1d1a17', transparent: true, opacity: 0.75, depthTest: false });
function makeBar() {
  const g = new THREE.Group();
  const bg = new THREE.Sprite(barBgMat); bg.center.set(0, 0.5); bg.scale.set(1.24, 0.2, 1); bg.position.x = -0.62; bg.renderOrder = 10;
  const fill = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#ff8a3c', depthTest: false })); fill.center.set(0, 0.5); fill.scale.set(1.12, 0.12, 1); fill.position.set(-0.56, 0, 0.001); fill.renderOrder = 11;
  g.add(bg, fill);
  return { g, fill };
}

/* ---------- 투기꾼·트럭 ---------- */
// trash: createTrash 결과, bound: { line 돌담 선, insideBy, center }, paths: 탐방로 선(nsPaths)
// hooks: canSpawn() 지금 와도 되나(튜토리얼 중엔 안 옴), appear(d) 나타남, dumped(d, n) 쌓음, repel(kind, pos, def, d) 쫓아냄, offline(n, sec) 접속 안 한 동안 쌓인 양
// avoid(x, z): 트럭이 지나지 않을 곳 (들머리 튜토리얼 쪽)
// 연출 감독(#89)이 있으면 hooks.paced = true 로 스스로 오지 않고 come() 으로만 옴. hooks.heapW(i) 더미 고르는 무게 배율(0 이면 뺌), hit(pos, dead) 맞음
export function createDumpers({ scene, trash, height, bound, paths, hooks = {}, avoid = null, rnd = Math.random }) {
  const group = new THREE.Group(); scene.add(group);
  const list = [];
  let players = DUMP.players, timer = Math.min(60, DUMP.every), sound = null, player = null;
  const period = () => Math.max(20, DUMP.every * crowdGap(players)); // 쓰레기 없는 맵 등 감독 없이 올 때만 (#131: 사람이 많으면 간격을 늘림)

  // 트럭 길: 탐방로 그래프 (튜토리얼 쪽 점은 뺌)
  const G = buildTrailGraph(paths, 6);
  const nodeOk = G.nodes.map((n) => !(avoid && avoid(n.x, n.z)));
  const wallD = G.nodes.map((n) => bound.insideBy(n.x, n.z)); // 돌담까지 거리 (+ 안쪽)
  const outward = (x, z) => { const dx = x - bound.center.x, dz = z - bound.center.z, l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; };
  // 돌담 밖 점: (x, z) 에서 바깥쪽으로 돌담을 지나 DUMP.outside 만큼
  const outsideOf = (x, z) => { const [ux, uz] = outward(x, z); const ib = bound.insideBy(x, z); const d = Math.max(0, ib) + DUMP.outside; return [x + ux * d, z + uz * d]; };
  function nearestNode(x, z) { let b = -1, bd = 1e18; G.nodes.forEach((n, i) => { if (!nodeOk[i]) return; const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; b = i; } }); return b; }
  // 노린 더미에서 길을 거꾸로 따라 돌담 쪽으로 (다익스트라). 길 점 n 으로 들어오는 비용 = 길 거리 + 돌담에서 그 점까지 거리 × offRoad
  // (돌담 가까운 길 점이면 거의 바로 길에 오르고, 아니면 돌담에서 가장 가까운 길로 잠깐 들판을 지나 올라탐)
  function truckRoute(h) {
    const t = nearestNode(h.x, h.z); if (t < 0) return null;
    const N = G.nodes.length, dist = new Float64Array(N).fill(1e12), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N);
    dist[t] = 0;
    for (let it = 0; it < N; it++) {
      let u = -1, ud = 1e12; for (let i = 0; i < N; i++) if (!done[i] && dist[i] < ud) { ud = dist[i]; u = i; }
      if (u < 0) break; done[u] = 1;
      for (const [v, w] of G.adj[u]) if (nodeOk[v] && dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; }
    }
    let e = -1, ed = 1e12;
    for (let i = 0; i < N; i++) { if (dist[i] >= 1e12 || wallD[i] > DUMP.entryIn) continue; const c = dist[i] + Math.max(0, wallD[i]) * DUMP.offRoad; if (c < ed) { ed = c; e = i; } }
    // 길로 돌아가는 게 너무 멀면 돌담에서 곧장 (들판 거리 × offRoad 로 비교)
    const w = wallNear(h.x, h.z);
    if (w && (e < 0 || Math.hypot(w[0] - h.x, w[1] - h.z) * DUMP.offRoad < ed)) return [outsideOf(w[0], w[1])];
    if (e < 0) return null;
    const out = []; const en = G.nodes[e]; out.push(outsideOf(en.x, en.z));
    for (let i = e; i >= 0; i = prev[i]) out.push([G.nodes[i].x, G.nodes[i].z]);
    return out;
  }
  // 돌담 위에서 (x, z) 와 가장 가까운 점 (튜토리얼 쪽은 뺌)
  function wallNear(x, z) { let b = null, bd = 1e18; for (const p of bound.line) { if (avoid && avoid(p[0], p[1])) continue; const d = (p[0] - x) ** 2 + (p[1] - z) ** 2; if (d < bd) { bd = d; b = p; } } return b; }
  // 더미 가장자리에서 서는 자리 (from 쪽)
  const edgeOf = (h, fx, fz, pad) => { const a = Math.atan2(fx - h.x, fz - h.z), d = h.r + pad; return [h.x + Math.sin(a) * d, h.z + Math.cos(a) * d]; };

  // 노릴 더미: 깨끗한 구역일수록 자주 (무게 zoneBase + 깨끗한 정도), 구역 안에선 비어 있을수록 자주. 다른 투기꾼이 노린 더미는 뺌
  function pickHeap(kind) {
    const taken = new Set(list.map((d) => d.heap));
    const room = (i) => trash.heaps[i].n - trash.store.left(i);
    const hw = (i) => (hooks.heapW ? hooks.heapW(i) : 1);
    const zs = ZONES.map((Z) => ({ z: Z.id, w: DUMP.zoneBase + trash.zoneClean(Z.id) })).filter((o) => trash.heaps.some((h, i) => h.zone === o.z && !taken.has(i) && room(i) > 0 && hw(i) > 0));
    if (!zs.length) return -1;
    let x = rnd() * zs.reduce((s, o) => s + o.w, 0), zone = zs[zs.length - 1].z; for (const o of zs) { x -= o.w; if (x <= 0) { zone = o.z; break; } }
    let cand = trash.heaps.map((h, i) => i).filter((i) => trash.heaps[i].zone === zone && !taken.has(i) && room(i) > 0 && hw(i) > 0);
    if (kind === 'truck') { const big = cand.filter((i) => trash.heaps[i].k !== 's'); if (big.length) cand = big; } else { const sm = cand.filter((i) => trash.heaps[i].k === 's'); if (sm.length) cand = sm; }
    const w = cand.map((i) => (1 + 2 * room(i) / trash.heaps[i].n) * hw(i)); let y = rnd() * w.reduce((a, b) => a + b, 0);
    for (let k = 0; k < cand.length; k++) { y -= w[k]; if (y <= 0) return cand[k]; }
    return cand[cand.length - 1];
  }

  // opts: start [x,z] 걷는 투기꾼이 시작할 자리(없으면 돌담 밖), amt 쌓을 양(없으면 DUMP_AMT), hold 이 초 동안 숨어 있다가 나타남(감독의 조짐 #89)
  function spawn(kind, heapI = -1, opts = {}) {
    if (list.length >= DUMP.max) return null;
    const hi = heapI >= 0 ? heapI : pickHeap(kind); if (hi < 0 || !trash.heaps[hi]) return null;
    const h = trash.heaps[hi], def = DUMP[kind];
    let route;
    if (kind === 'truck') { route = truckRoute(h); if (!route) return null; const last = route[route.length - 1]; route.push(edgeOf(h, last[0], last[1], 2.6)); }
    else { // 돌담에서 더미와 가장 가까운 곳 바깥에서 곧장
      let s = opts.start; // #135 첫 투기꾼: 시야 안 정한 자리에서 시작
      if (!s) { const b = wallNear(h.x, h.z); if (!b) return null; s = outsideOf(b[0], b[1]); }
      route = [s, edgeOf(h, s[0], s[1], 1.0)];
    }
    const m = kind === 'truck' ? buildTruck() : buildWalker();
    const [sx, sz] = route[0];
    const d = { ...m, kind, def, heap: hi, amt: opts.amt ?? DUMP_AMT[kind], hold: opts.hold || 0, route, ri: 1, wpT: 0, pos: new THREE.Vector3(sx, height(sx, sz), sz), heading: 0, speed: 0, state: 'come', st: 0, hp: def.hp, flash: 0, phase: rnd() * 6, pitch: 0, roll: 0, bar: null };
    d.heading = Math.atan2(route[1][0] - sx, route[1][1] - sz);
    if (def.hp > 1) { d.bar = makeBar(); d.bar.g.position.set(0, m.h + 0.8, 0); d.bar.g.visible = false; d.root.add(d.bar.g); }
    hooks.dress?.(d); // 철 이벤트 차림 (#180 산타 투기꾼)
    d.root.position.copy(d.pos); group.add(d.root);
    list.push(d);
    if (d.hold > 0) d.root.visible = false; else hooks.appear?.(d);
    return d;
  }
  function remove(d) { const i = list.indexOf(d); if (i >= 0) list.splice(i, 1); group.remove(d.root); d.bar?.fill.material.dispose(); }
  // 왔던 길을 거꾸로 (지금 자리부터)
  function goBack(d) { const back = [[d.pos.x, d.pos.z]]; for (let i = Math.min(d.ri, d.route.length) - 2; i >= 0; i--) back.push(d.route[i]); d.route = back; d.ri = 1; d.wpT = 0; }

  // 한 번 오기: 트럭 또는 투기꾼. 화면에 못 나오면(자리·길 없음) 그냥 넘어감
  function visit() { return spawn(rnd() < DUMP.truckP ? 'truck' : 'walker'); }

  // 귤 맞음 (life.js 가 귤·화살 날아가는 중에 부름). 맞혔으면 true
  function hitTest(p, tg, dmg, quiet = false) { // quiet (#123): 잦은 맞힘은 소리·멈칫을 쫓아낼 때만
    for (const d of list) {
      if (d.state !== 'come' && d.state !== 'dump') continue;
      // 귤은 한 프레임에 멀리 가므로 지난 0.1초 동안 지나온 선분으로 봄 (화살은 vel 0, 이미 잘게 나눠 옴)
      const vx = tg.vel.x * 0.1, vz = tg.vel.z * 0.1, vl = vx * vx + vz * vz;
      let u = vl > 1e-6 ? ((d.pos.x - (p.x - vx)) * vx + (d.pos.z - (p.z - vz)) * vz) / vl : 1; u = u < 0 ? 0 : u > 1 ? 1 : u;
      if (Math.hypot(p.x - vx * (1 - u) - d.pos.x, p.z - vz * (1 - u) - d.pos.z) >= d.def.hitR || p.y > d.pos.y + d.h + 0.1 || p.y < d.pos.y - 0.3) continue;
      d.hp = Math.max(0, d.hp - dmg); d.flash = 0.25; if (d.bar) d.bar.t = 3; /* 막대는 맞힌 뒤 3초만 (#201) */
      tg.vel.set(-tg.vel.x * 0.3, 2.5, -tg.vel.z * 0.3);
      if (d.hp <= 0) repel(d); else { d.flinch = 0.3; if (!quiet) sound?.beep?.(false); }
      if (!quiet || d.hp <= 0) hooks.hit?.(d.pos, d.hp <= 0);
      return true;
    }
    return false;
  }
  // 맞고 쫓겨남 (#68): 깜짝 놀람(펄쩍·덜컹) → 봉투 떨굼 → 뒤돌아 도망 → 멀어지면 서서히 사라짐
  function repel(d) {
    d.state = 'startle'; d.st = 0; d.fleeD = 0; d.puffT = 0; if (d.bar) d.bar.g.visible = false;
    if (d.kind === 'walker') { dropBag(d); d.arms[1].rotation.x = 0; }
    goBack(d);
    hooks.repel?.(d.kind, d.pos.clone(), d.def, d);
  }
  // 떨어진 봉투: 땅에 잠깐 보이고, 주울 수 있는 쓰레기 DUMP.bagDrop 개가 근처 더미에 쌓임
  const drops = [];
  function dropBag(d) {
    d.bag.visible = false;
    const m = new THREE.Group(); m.add(...d.bag.children.map((c) => c.clone())); m.position.set(d.pos.x + Math.sin(d.heading) * 0.5, height(d.pos.x, d.pos.z) + 0.38, d.pos.z + Math.cos(d.heading) * 0.5); m.rotation.z = 1.3; m.scale.setScalar(1.1);
    group.add(m); drops.push({ m, t: DUMP.bagStay });
    const n = DUMP.bagDrop; if (!trash.drop(d.pos.x, d.pos.z, n, 40)) trash.refill(d.heap, n);
    trash.store.commit();
  }
  // 도망 중 먼지·땀방울 (작은 공 풀)
  const puffs = [], puffG = new THREE.SphereGeometry(0.16, 6, 4);
  function puff(x, y, z, color, vy, life) {
    let p = puffs.find((q) => q.t <= 0);
    if (!p) { if (puffs.length >= 24) return; const mesh = new THREE.Mesh(puffG, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false })); group.add(mesh); p = { mesh, t: 0, life: 1, vy: 0 }; puffs.push(p); }
    p.mesh.material.color.set(color); p.mesh.position.set(x, y, z); p.t = p.life = life; p.vy = vy; p.mesh.visible = true;
  }
  function fx(dt) {
    for (const p of puffs) { if (p.t <= 0) continue; p.t -= dt; if (p.t <= 0) { p.mesh.visible = false; continue; } p.mesh.position.y += p.vy * dt; const k = p.t / p.life; p.mesh.material.opacity = 0.7 * k; p.mesh.scale.setScalar(1.6 - k * 0.8); }
    for (let i = drops.length - 1; i >= 0; i--) { const o = drops[i]; o.t -= dt; if (o.t <= 0) { group.remove(o.m); drops.splice(i, 1); } }
  }
  // 서서히 사라짐 시작 (재질은 공유라 이 몹만 복제해 투명하게)
  function beginFade(d) {
    if (d.fade != null) return; d.fade = 1;
    d.root.traverse((o) => { if (o.isMesh && o.material && !o.userData.sprite) { o.material = o.material.clone(); o.material.transparent = true; } });
  }

  const tmpV = new THREE.Vector3();
  function tick(d, dt, time) {
    d.st += dt;
    let want = 0;
    if (d.state === 'startle') {
      // 깜짝: 투기꾼은 펄쩍 뛰며 팔을 듦, 트럭은 덜컹. 끝나면 도망
      want = 0; const u = Math.min(1, d.st / DUMP.startleT);
      if (d.kind === 'walker') { d.hop = Math.sin(u * Math.PI) * 0.9; d.arms[0].rotation.x = d.arms[1].rotation.x = -2.4 * Math.sin(u * Math.PI); }
      else d.hop = Math.sin(u * Math.PI * 4) * 0.12 * (1 - u);
      if (d.st >= DUMP.startleT) { d.state = 'flee'; d.st = 0; d.hop = 0; if (d.kind === 'walker') { d.arms[0].rotation.x = d.arms[1].rotation.x = 0; } }
    } else if (d.state === 'dump') {
      want = 0; const h = trash.heaps[d.heap]; d.heading += wrapA(Math.atan2(h.x - d.pos.x, h.z - d.pos.z) + (d.kind === 'truck' ? Math.PI : 0) - d.heading) * Math.min(1, dt * 4); // 트럭은 짐칸을 더미 쪽으로
      const u = Math.min(1, d.st / DUMP.dumpT);
      if (d.kind === 'truck') d.bed.rotation.x = -Math.sin(Math.min(1, u * 1.6) * Math.PI / 2) * 0.7 * (u > 0.85 ? (1 - u) / 0.15 : 1);
      else { d.arms[1].rotation.x = -1.2 * Math.sin(Math.min(1, u * 2) * Math.PI / 2); d.bag.position.y = -0.72 - Math.max(0, u - 0.6) * 1.6; }
      if (d.st >= DUMP.dumpT) {
        const h2 = trash.heaps[d.heap], far = !h2 || Math.hypot(h2.x - d.pos.x, h2.z - d.pos.z) > h2.r + 6; // 서둘러 버리면(#89) 그 자리 가까운 더미에
        const got = (d.hurried && far && trash.drop(d.pos.x, d.pos.z, d.amt, 40)) || trash.refill(d.heap, d.amt); trash.store.commit();
        hooks.dumped?.(d, got);
        d.state = 'leave'; d.st = 0; if (d.bar) d.bar.g.visible = false;
        if (d.kind === 'walker') { d.bag.visible = false; d.arms[1].rotation.x = 0; } else { d.load.visible = false; d.bed.rotation.x = 0; }
        goBack(d);
      }
    } else {
      want = d.state === 'flee' ? d.def.flee : d.def.speed;
      const tgt = d.route[d.ri];
      if (d.state === 'flee') {
        d.fleeD += d.speed * dt;
        if (d.st > DUMP.fleeT || d.fleeD > DUMP.fleeDist || !tgt) beginFade(d);
        d.puffT -= dt;
        if (d.puffT <= 0 && d.speed > 1) {
          d.puffT = d.kind === 'truck' ? 0.1 : 0.14;
          puff(d.pos.x - Math.sin(d.heading) * 0.4, d.pos.y + 0.15, d.pos.z - Math.cos(d.heading) * 0.4, '#b59a78', 0.9, 0.7);
          if (d.kind === 'walker') { puff(d.pos.x + (rnd() - 0.5) * 0.5, d.pos.y + d.h - 0.1, d.pos.z + (rnd() - 0.5) * 0.5, '#9fd3f2', -0.4, 0.5); sound?.beep?.(false); }
        }
      }
      if (!tgt && d.state !== 'flee') { if (d.state === 'come') { d.state = 'dump'; d.st = 0; } else { remove(d); return; } }
      else if (!tgt) { want = d.def.flee; }
      else {
        const dx = tgt[0] - d.pos.x, dz = tgt[1] - d.pos.z, dist = Math.hypot(dx, dz), last = d.ri >= d.route.length - 1;
        const diff = wrapA(Math.atan2(dx, dz) - d.heading);
        d.wpT += dt;
        // 길 점은 넉넉히 지나침 (빙빙 돌지 않게). 한 점에 너무 오래 걸려도 다음으로
        if (dist < (last ? 0.8 : d.kind === 'truck' ? 3.2 : 1.2) || (!last && d.wpT > 12)) { d.ri++; d.wpT = 0; }
        d.heading += diff * Math.min(1, dt * (d.kind === 'truck' ? 2.5 : 6));
        want *= Math.max(0.25, Math.cos(Math.min(Math.PI / 2, Math.abs(diff)))); // 크게 돌 땐 느리게
        if (d.state === 'come' && last && dist < 6) want = Math.min(want, 1.2 + dist * 0.5); // 더미 앞에서 천천히
      }
    }
    d.speed += (want - d.speed) * Math.min(1, dt * 3);
    const nx = d.pos.x + Math.sin(d.heading) * d.speed * dt, nz = d.pos.z + Math.cos(d.heading) * d.speed * dt;
    d.pos.set(nx, height(nx, nz), nz);
    d.phase += dt * d.speed * (d.kind === 'truck' ? 2.4 : 3.2);
    // 그리기
    if (d.fade != null) { d.fade -= dt / DUMP.fadeT; if (d.fade <= 0) { remove(d); return; } d.root.traverse((o) => { if (o.isMesh && o.material && o.material.transparent) o.material.opacity = d.fade; }); }
    d.flinch = Math.max(0, (d.flinch || 0) - dt);
    d.root.position.copy(d.pos); d.root.position.y += (d.hop || 0) + (d.flinch > 0 ? Math.sin(d.flinch / 0.3 * Math.PI) * 0.25 : 0); d.root.rotation.order = 'YXZ'; d.root.rotation.y = d.heading;
    if (d.kind === 'truck') {
      const L = 1.6, W = 0.9, sh = Math.sin(d.heading), ch = Math.cos(d.heading), px = d.pos.x, pz = d.pos.z;
      const tp = Math.atan2(height(px - sh * L, pz - ch * L) - height(px + sh * L, pz + ch * L), 2 * L);
      const tr = Math.atan2(height(px + ch * W, pz - sh * W) - height(px - ch * W, pz + sh * W), 2 * W);
      const k = Math.min(1, dt * 5), lim = 0.5;
      d.pitch += (Math.max(-lim, Math.min(lim, tp)) - d.pitch) * k; d.roll += (Math.max(-lim, Math.min(lim, tr)) - d.roll) * k;
      d.root.rotation.x = d.pitch; d.root.rotation.z = d.roll;
      d.wheels.forEach((w) => { w.rotation.x = d.phase; });
      d.body.position.y = Math.sin(time * 18 + d.phase) * 0.02 * Math.min(1, d.speed / 4);
    } else {
      const a = Math.min(0.8, d.speed * 0.25), s = Math.sin(d.phase);
      d.legs[0].rotation.x = s * a; d.legs[1].rotation.x = -s * a;
      if (d.state !== 'startle') d.arms[0].rotation.x = -s * a * 0.8; if (d.state !== 'dump' && d.state !== 'startle') d.arms[1].rotation.x = d.state === 'flee' ? -s * a : 0.15;
      d.body.position.y = Math.abs(Math.cos(d.phase)) * 0.06 * Math.min(1, d.speed);
    }
    if (d.bar) { d.bar.t = Math.max(0, (d.bar.t || 0) - dt); const sh = d.bar.t > 0 && d.state !== 'startle' && d.state !== 'leave' && d.state !== 'flee'; if (d.bar.g.visible !== sh) d.bar.g.visible = sh; }
    if (d.bar && d.bar.g.visible) {
      d.flash = Math.max(0, d.flash - dt);
      const f = d.hp / d.def.hp; d.bar.fill.scale.x = 1.12 * Math.max(0.001, f);
      d.bar.fill.material.color.set(d.flash > 0 ? '#ffffff' : f <= 0.34 ? '#ff4a3a' : '#ff8a3c');
    }
    // 너무 오래 걸리면 (길이 막힘 등) 조용히 사라짐
    if (d.st > DUMP.maxTrip) remove(d);
  }

  // 아무도 없던 동안 (sec 초, #131 src/refill.js): 구역마다 빈자리를 30분 절반·90분 가득 곡선으로 채움 (구역 1·2 먼저). 쌓은 수
  function catchUp(sec) {
    if (!(sec > 0)) return 0;
    const H = trash.heaps, left = H.map((h, i) => trash.store.left(i)), adds = offlineAdds(left, H.map((h) => h.n), H.map((h) => h.zone), sec);
    let got = 0;
    for (const [i, n] of adds) got += trash.refill(i, n, true) || 0;
    if (got) { trash.relayout(); trash.store.commit(); }
    return got;
  }
  let wallT = 0;
  function start(now = Date.now()) {
    const seen = trash.store.seen();
    trash.store.setSeen(now);
    if (seen > 0 && now - seen > DUMP.offlineMin * 1000) { const sec = (now - seen) / 1000, n = catchUp(sec); if (n) hooks.offline?.(n, sec); return n; }
    return 0;
  }

  function update(dt, time) {
    // 마지막 접속 시각 (탭이 오래 숨어 있었으면 그동안 몫을 한꺼번에)
    wallT += dt;
    if (wallT > 5) { wallT = 0; const now = Date.now(), seen = trash.store.seen(); if (seen > 0 && now - seen > DUMP.offlineMin * 1000 && !trash.store.roomLive?.()) { const n = catchUp((now - seen) / 1000); if (n) hooks.offline?.(n, (now - seen) / 1000); } trash.store.setSeen(now); }
    timer -= dt;
    if (timer <= 0) { timer = period(); if (!hooks.paced && (!hooks.canSpawn || hooks.canSpawn())) visit(); }
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i]; if (!d) continue;
      if (d.hold > 0) { d.hold -= dt; if (d.hold <= 0) { d.root.visible = true; hooks.appear?.(d); } continue; } // 조짐 동안 돌담 밖에 숨어 있음
      tick(d, dt, time);
    }
    fx(dt);
  }

  // 귤로 맞힐 대상 (#34 자동 조준)
  const aims = new Map();
  function aimTargets(out) {
    for (const d of list) {
      if (d.state !== 'come' && d.state !== 'dump') continue;
      let a = aims.get(d); if (!a) { a = { kind: d.kind, pos: d.pos, h: d.h * 0.55, size: d.def.hitR, vel: new THREE.Vector3(), ok: () => list.includes(d) && (d.state === 'come' || d.state === 'dump') }; aims.set(d, a); }
      a.vel.set(Math.sin(d.heading) * d.speed, 0, Math.cos(d.heading) * d.speed); out.push(a);
    }
    if (aims.size > list.length * 2 + 8) for (const k of aims.keys()) if (!list.includes(k)) aims.delete(k);
  }

  return {
    bind(p, s) { player = p; sound = s; },
    start, update, hitTest, aimTargets, list, catchUp,
    offlineMsg: (n) => hooks.offline?.(n, 0), // 방이 빈 동안 몫을 채웠을 때 (#131, room.js 의 hi.fill)
    // 감독(#89): kind 하나 부르기 (opts: amt·hold·heap), 살아 있는(오는 중·버리는 중·숨은) 수, 시간이 다 되면 오는 중인 것은 그 자리에서 서둘러 버리고 떠남
    come: (kind, opts = {}) => spawn(kind, opts.heap ?? -1, opts),
    activeN: () => list.filter((d) => d.state === 'come' || d.state === 'dump').length,
    hurryAll() { for (const d of list) if (d.state === 'come') { d.state = 'dump'; d.st = DUMP.dumpT * 0.5; d.hurried = true; if (d.hold > 0) { d.hold = 0; d.root.visible = true; } } },
    routeLen: (d) => { let L = 0; for (let i = 1; i < d.route.length; i++) L += Math.hypot(d.route[i][0] - d.route[i - 1][0], d.route[i][1] - d.route[i - 1][1]); return L; },
    get players() { return players; }, setPlayers(n) { players = Math.max(1, Math.floor(n) || 1); timer = Math.min(timer, period()); },
    period,
    // 확인용
    test: {
      spawn: (kind = 'walker', heap = -1) => !!spawn(kind, heap),
      visit, clear: () => { for (const d of list.slice()) remove(d); },
      // 맞은 것처럼 쫓아내기 (확인용)
      hit: (i = 0) => { const d = list[i]; if (!d) return false; d.hp = 0; repel(d); return true; },
      dropped: () => drops.length,
      get timer() { return timer; }, set timer(v) { timer = v; },
      state: () => list.map((d) => ({ kind: d.kind, state: d.state, fade: d.fade ?? null, hp: d.hp, heap: d.heap, ri: d.ri, n: d.route.length, x: Math.round(d.pos.x), z: Math.round(d.pos.z), st: +d.st.toFixed(1) })),
      amt: DUMP_AMT, perHour: Math.round(DUMP_PER_HOUR),
      // 플레이어 앞 dist 만큼에 (더미로 가는 중인) 투기꾼을 바로 데려옴
      near(kind = 'walker', dist = 8) { const d = spawn(kind); if (!d || !player) return null; const x = player.pos.x + Math.sin(player.heading) * dist, z = player.pos.z + Math.cos(player.heading) * dist; d.pos.set(x, height(x, z), z); const h = trash.heaps[d.heap]; d.route = [[x - Math.sin(player.heading) * 60, z - Math.cos(player.heading) * 60], [x, z], edgeOf(h, x, z, d.kind === 'truck' ? 2.6 : 1)]; d.ri = 2; return d; },
    },
  };
}
