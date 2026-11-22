// 동료 캐릭터 3명 (#172): 오름을 돌아다니며 줍고·적을 쫓고·인사하는 게임 캐릭터 (외부 AI 호출 없음, 정해진 행동·대사). 파일 순서는 boss 뒤 (src/modules.js)
// - 누가·수치: balance.js BUDDIES, 대사: src/buddylines.js. 나오는 때는 감독 문(JOURNEY.doors mateSunja·mateMinsu·mateJenny)
// - 내 화면에만: 서버로 보내지 않고 방 정원·사람 수·순위에 안 들어감. 방에 사람이 많으면 줄고(BUDDIES.peers), 저사양은 BUDDIES.low 명, 메뉴 설정 '동료' 로 끔(save.mates.off)
// - 줍기: 더미를 실제로 줄이되(trash.buddyTake → 방에는 btake, 번 몫에 안 셈) 셋이 합쳐 내가 줍는 속도의 BUDDIES.share 까지, 마지막 BUDDIES.keep 은 남김
// - 싸움: 민수만 달려와 손 귤을 던짐(피해는 손 귤 값, 쫓아낸 보상은 내 것). 다른 둘은 물러남. 동료는 안 다치고 맞으면 '아야' 하고 물러남. 우두머리전은 응원만
// - 말: 말풍선은 감독(kind 'mate')을 거쳐 한 번에 하나. 상호작용(F) '말 걸기' → 상황 대사 창·'같이 가요'(한 명, BUDDIES.follow.sec)
// dev: __oreum.buddies.list()·come(id)·talk(id)·follow(id)·state()
import * as THREE from 'three';
import { TEXCS } from '../boot.js';
import { BUDDIES as B, PERF, THROW_DMG } from '../balance.js';
import { TIER } from '../quality.js';
import { buildRunner, DEFAULT_OUTFIT, SKIN_TONES } from '../runner.js';
import { EMOTE_BY, isEmote } from '../emotes.js';
import { groundAt } from '../world.js';
import { nsPaths } from '../namsongi.js';
import { buildTrailGraph, trailRoute } from '../autowalk.js';
import { LINES } from '../buddylines.js';
import { state, late } from './state.js';
import { $, save, persist } from './save.js';
import { scene, spots, wx, sunState } from './scene.js';
import { player, trash, life, col, hp, benchPos, CH, CHS, GEARB, LEAPB, SAL, STN, NS_TUT } from './place.js';
import { closePanels } from './hud.js';
import { director } from './director.js';
import { net, social } from './room.js';
import { interactables } from './stores.js';

const ON = !!(B.on !== false && trash && NS_TUT && col); // #190 BUDDIES.on 으로 통째로 끔
const M = save.mates = (save.mates && typeof save.mates === 'object' && !Array.isArray(save.mates)) ? save.mates : {};
M.off = M.off ? 1 : 0;
const DEF = new Map(B.list.map((d) => [d.id, d]));
const AGGRO = new Set(['charge', 'wind', 'dash', 'back', 'stagger']);
const nowS = () => performance.now() / 1000;
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const G = ON ? buildTrailGraph(nsPaths, 6) : null;
// 서 있으면 안 되는 문 앞: 가게·클린하우스
const DOORS = ON ? [GEARB?.door, LEAPB?.door, SAL?.door, STN?.terrace, CH?.shopFront, ...CHS.map((c) => c.front)].filter(Boolean) : [];
const SHOP_DOORS = ON ? [GEARB?.door, LEAPB?.door, SAL?.door, STN?.terrace].filter(Boolean) : [];
const NPCS = ON ? [spots.sign?.npc || spots.sign?.pos, spots.photo?.stone].filter(Boolean) : []; // 오름지기(들머리 안내판 옆, #158 #213 실제 선 자리)·사진사와 겹치지 않게
const nearDoor = (x, z, r = B.avoid.door) => DOORS.some((d) => Math.hypot(d.x - x, d.z - z) < r) || NPCS.some((d) => Math.hypot(d.x - x, d.z - z) < B.avoid.npc);
const passable = (x, z) => !col.blocked(x, z, 0.45) && !nearDoor(x, z);
const inField = (x, z) => passable(x, z) && (trash.ok ? trash.ok(x, z) : true); // 들판으로 나갈 때는 오름 안만

// ---------- 모양 ----------
function outfitOf(d) {
  const o = structuredClone(DEFAULT_OUTFIT);
  o.skin = { color: SKIN_TONES[d.skin] || SKIN_TONES[0] }; o.body = d.body; o.gear = { ...d.gear };
  return o;
}
// 이름표: 이름 + 옆에 작은 로봇 아이콘 (사람 플레이어와 구분)
function makeLabel(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = 'rgba(36,37,31,.55)'; g.fillRect(0, 0, 256, 64);
  g.font = '700 26px "Noto Sans KR", sans-serif'; g.textBaseline = 'middle';
  const tw = Math.min(190, g.measureText(text).width), x0 = 128 - (tw + 38) / 2;
  // 로봇: 둥근 머리·안테나·두 눈
  const rx = x0, ry = 18; g.fillStyle = '#9fd3ff'; g.strokeStyle = '#9fd3ff'; g.lineWidth = 3;
  g.beginPath(); g.roundRect ? g.roundRect(rx, ry + 6, 28, 22, 6) : g.rect(rx, ry + 6, 28, 22); g.fill();
  g.beginPath(); g.moveTo(rx + 14, ry + 6); g.lineTo(rx + 14, ry - 1); g.stroke(); g.beginPath(); g.arc(rx + 14, ry - 3, 3, 0, 7); g.fill();
  g.fillStyle = '#24251f'; g.fillRect(rx + 6, ry + 13, 5, 5); g.fillRect(rx + 17, ry + 13, 5, 5); g.fillRect(rx + 9, ry + 22, 10, 2);
  g.fillStyle = '#fbf6e6'; g.textAlign = 'left'; g.fillText(text, x0 + 38, 34, 190);
  const t = new THREE.CanvasTexture(c); t.colorSpace = TEXCS;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0 }));
  sp.scale.set(3.2, 0.8, 1); sp.position.y = 2.75;
  return sp;
}
// 던지는 귤 (민수): 작은 공 몇 개를 돌려 씀
const gyulMat = new THREE.MeshToonMaterial({ color: '#ff9a1f' }), gyulGeo = new THREE.SphereGeometry(0.13, 10, 8);
const shots = [];
function shoot(m, e) {
  let s = shots.find((x) => !x.on);
  if (!s) { if (shots.length >= 4) return; s = { mesh: new THREE.Mesh(gyulGeo, gyulMat), on: false }; s.mesh.visible = false; scene.add(s.mesh); shots.push(s); }
  const a = m.pos.clone(); a.y += 1.5; const b = e.pos.clone(); b.y += 0.6 * (e.def?.size || 1);
  s.on = true; s.a = a; s.b = b; s.e = e; s.t = 0; s.T = Math.max(0.2, a.distanceTo(b) / B.throw.speed); s.mesh.visible = true; s.mesh.position.copy(a);
}
function tickShots(dt) {
  for (const s of shots) {
    if (!s.on) continue;
    s.t += dt; const k = Math.min(1, s.t / s.T);
    s.mesh.position.lerpVectors(s.a, s.b, k); s.mesh.position.y += Math.sin(k * Math.PI) * 1.2;
    if (k < 1) continue;
    s.on = false; s.mesh.visible = false;
    const e = s.e; if (!e || !life.enemies.list.includes(e) || e.state === 'flee' || e.state === 'leave' || e.boss) continue;
    if (flat(e.pos, s.b) < 3) life.enemies.hurt(e, THROW_DMG.hand, false);
  }
}

// ---------- 대사 고르기 ----------
let lastPick = -1e9, lastFight = -1e9, lastBloom = -1e9;
function ctx() {
  const t = nowS(), z = trash.zoneAt(player.pos.x, player.pos.z) || 0, c = save.journey?.maxZ || 0, k = wx?.kind || '', tags = new Set(['']);
  if (z) tags.add('z' + z);
  for (let i = 2; i <= c; i++) tags.add('c' + i);
  if (k === 'rain') tags.add('rain'); if (k === 'snow') tags.add('snow');
  tags.add((sunState?.el ?? 30) < -4 ? 'night' : 'day');
  if (t - lastPick < 40) tags.add('pick'); if (t - lastFight < 40) tags.add('fight'); if (t - lastBloom < 40) tags.add('bloom');
  if (SHOP_DOORS.some((d) => flat(d, player.pos) < 40)) tags.add('street');
  return tags;
}
function lineFor(m) {
  const L = LINES[m.def.id]?.talk || [], tags = ctx(), pool = [];
  L.forEach(([w, txt], i) => { const need = w.split(' ').filter(Boolean); if (need.every((x) => tags.has(x)) && !m.said.includes(i)) for (let k = need.length ? 3 : 1; k > 0; k--) pool.push(i); });
  if (!pool.length) { m.said.length = 0; return L[0]?.[1] || ''; }
  const i = pool[Math.floor(Math.random() * pool.length)];
  m.said.push(i); if (m.said.length > 8) m.said.shift();
  return L[i][1];
}
const one = (a) => (Array.isArray(a) ? a[Math.floor(Math.random() * a.length)] : a);
// 말풍선: 감독(kind 'mate')을 거쳐 한 번에 하나. queue 면 줄에 섬
function speak(m, text, { queue = false, sec = 4, id = 'mate:' + m.def.id } = {}) {
  if (!text || !m.r.root.visible) return false;
  return director.ask('mate', id, () => { social.showBubble('mate:' + m.def.id, m.r.root, text, 3.4); m.lastSay = nowS(); }, { sec, queue, ttl: 8 });
}

// ---------- 동료 하나 ----------
const mates = [];
function make(d) {
  const r = buildRunner(); r.apply(outfitOf(d)); r.root.visible = false; scene.add(r.root);
  const label = makeLabel(d.name); r.root.add(label);
  const m = { def: d, r, label, pos: new THREE.Vector3(), heading: 0, speed: 0, run: false, on: false, placed: false, culled: false, shadow: null,
    mode: 'roam', route: null, wp: 0, goal: null, wait: 0, pose: 'move', poseT: 0, task: null, hurtT: 0, hurtFrom: null,
    heap: -1, pickT: 0, picks: 0, picked: 0, throwT: 0, greetAt: -1e9, inGreet: false, lastSay: -1e9, said: [], stuck: 0, lastP: new THREE.Vector3(), emo: null, sit: false };
  m.act = { label: '말 걸기', ic: 'hand', pos: m.pos, r: B.talkR, mate: d.id, when: () => m.on && r.root.visible && !talkS.m && !hp.isDown, act: () => openTalk(m) };
  interactables.push(m.act);
  mates.push(m);
  return m;
}
if (ON) B.list.forEach(make);
const byId = (id) => mates.find((m) => m.def.id === id);
const opened = (m) => director.isOpen(m.def.door);

// 플레이어 둘레 길 위 한 점 (from 에서 가까운 쪽, d0~d1 m). 못 찾으면 null
function trailSpot(d0, d1, near = null, tries = 40) {
  const N = G.nodes; let best = null, bd = 1e9;
  for (let i = 0; i < tries; i++) {
    const n = N[Math.floor(Math.random() * N.length)], d = Math.hypot(n.x - player.pos.x, n.z - player.pos.z);
    if (d < d0 || d > d1 || !passable(n.x, n.z)) continue;
    const s = near ? Math.hypot(n.x - near.x, n.z - near.z) : Math.random() * 100;
    if (s < bd) { bd = s; best = n; }
  }
  if (!best) for (const n of N) { const d = Math.hypot(n.x - player.pos.x, n.z - player.pos.z); if (d >= d0 && d <= d1 && passable(n.x, n.z)) { best = n; break; } }
  return best && { x: best.x, z: best.z };
}
function place(m, x, z) {
  m.pos.set(x, groundAt(x, z), z); m.route = null; m.goal = null; m.task = null; m.heap = -1; m.wait = 0.5;
  m.heading = Math.atan2(player.pos.x - x, player.pos.z - z); m.placed = true; m.lastP.copy(m.pos); m.stuck = 0;
}
// 플레이어 앞 d m 쯤 (들머리 정낭을 나설 때 손 흔들기)
function placeAhead(m, d = 9) {
  for (const a of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, Math.PI]) {
    const h = player.heading + a, x = player.pos.x + Math.sin(h) * d, z = player.pos.z + Math.cos(h) * d;
    if (passable(x, z)) { place(m, x, z); return true; }
  }
  const s = trailSpot(6, 30); if (s) { place(m, s.x, s.z); return true; } return false;
}
function go(m, x, z, run = false) {
  const r = trailRoute(G, m.pos, { x, z }); m.route = r.length ? r : [{ x, z }]; m.wp = 0; m.goal = { x, z }; m.run = run; m.stuck = 0;
}
function goDirect(m, x, z, run = false) { m.route = [{ x, z }]; m.wp = 0; m.goal = { x, z }; m.run = run; }
// 길 따라 한 걸음. 다 왔으면 true
function step(m, dt) {
  if (!m.route) { m.speed = 0; return true; }
  const p = m.route[m.wp]; if (!p) { m.route = null; m.speed = 0; return true; }
  const dx = p.x - m.pos.x, dz = p.z - m.pos.z, L = Math.hypot(dx, dz), last = m.wp >= m.route.length - 1;
  if (L < (last ? 0.6 : 1.4)) { m.wp++; if (m.wp >= m.route.length) { m.route = null; m.speed = 0; return true; } return false; }
  const sp = m.run ? B.run : B.walk, want = Math.atan2(dx, dz);
  m.heading += wrapA(want - m.heading) * Math.min(1, dt * 8);
  const k = Math.min(L, sp * dt), nx = m.pos.x + dx / L * k, nz = m.pos.z + dz / L * k;
  const r = col.move(m.pos.x, m.pos.z, nx, nz, 0.4); m.pos.x = r.x; m.pos.z = r.z; m.pos.y = groundAt(m.pos.x, m.pos.z);
  m.speed = sp;
  return false;
}
const face = (m, x, z, dt, k = 8) => { m.heading += wrapA(Math.atan2(x - m.pos.x, z - m.pos.z) - m.heading) * Math.min(1, dt * k); };
const setPose = (m, p) => { if (m.pose !== p) { m.pose = p; m.poseT = 0; } };

// ---------- 몫 (셋이 합쳐 내 줍기의 share) ----------
let bank = 0;
function nearHeap(m, R = B.seekR) {
  let best = -1, bd = R;
  trash.heaps.forEach((h, i) => {
    if (h.tut || trash.store.left(i) <= Math.ceil(trash.store.full(i) * B.keep)) return;
    const d = Math.hypot(h.x - m.pos.x, h.z - m.pos.z) - h.r; if (d > bd || Math.hypot(h.x - player.pos.x, h.z - player.pos.z) > B.far) return;
    if (mates.some((o) => o !== m && o.heap === i)) return; // 한 더미에 한 명
    bd = d; best = i;
  });
  return best;
}

// ---------- 상황 반응 ----------
function cheerAll(kind) {
  const L = (m) => LINES[m.def.id] || {};
  if (kind === 'zone') {
    mates.filter((m) => m.on && flat(m.pos, player.pos) < B.cheerR).forEach((m, i) => {
      const a = player.heading + Math.PI + (i - 1) * 0.7, x = player.pos.x + Math.sin(a) * 4, z = player.pos.z + Math.cos(a) * 4;
      m.task = { k: 'cheer', x, z, t: 0, T: 6 }; go(m, x, z, true);
    });
    const m = mates.find((o) => o.task?.k === 'cheer'); if (m) speak(m, L(m).cheer, { queue: true, id: 'mate:cheer' });
  } else if (kind === 'heap') {
    const m = mates.filter((o) => o.on && !o.task && flat(o.pos, player.pos) < 30).sort((a, b) => flat(a.pos, player.pos) - flat(b.pos, player.pos))[0];
    if (m) { m.task = { k: 'clap', t: 0, T: 2.4 }; m.route = null; speak(m, L(m).clap); }
  }
}
if (ON) trash.on((ev, d) => {
  if (!state.sessionOn || late.tut?.active) return;
  if (ev === 'trash') bank = Math.min(B.bank, bank + B.share); // 내가 하나 주우면 동료 몫 share
  if (ev === 'trash') lastPick = nowS();
  else if (ev === 'heap-clear' && !d?.by) { lastBloom = nowS(); cheerAll('heap'); }
  else if (ev === 'zone-clear' && !d?.by) cheerAll('zone');
});

// ---------- 말 걸기 창 ----------
const talkS = { m: null };
const TW = ON ? $('mate-talk') : null;
function openTalk(m) {
  if (!TW) return;
  closePanels(); talkS.m = m; m.route = null; m.task = null; m.heap = -1; setPose(m, 'move');
  const L = LINES[m.def.id];
  TW.querySelector('.mt-name').textContent = m.def.name;
  TW.querySelector('.mt-line').textContent = m.def.id === 'jenny' && Math.random() < m.def.photo ? one(L.ask) : lineFor(m);
  syncTalk(); TW.hidden = false;
}
function syncTalk() {
  const m = talkS.m; if (!m) return;
  const f = $('mt-follow'), on = followS.m === m;
  f.textContent = on ? '그만 같이 가기' : '같이 가요'; f.setAttribute('aria-pressed', String(on));
}
function closeTalk() { if (TW) TW.hidden = true; talkS.m = null; }
late.mateTalkNow = () => talkS.m; // 말 걸기 창의 동료 (#175 귤 주기)
late.mateSay = (m, text) => social.showBubble('mate:' + m.def.id, m.r.root, text, 3.4);
// ---------- 함께 가기 (한 번에 한 명) ----------
const followS = { m: null, until: 0 };
function follow(m, on = true) {
  const L = (x) => LINES[x.def.id] || {};
  if (!on || followS.m === m) { if (followS.m) { const o = followS.m; followS.m = null; social.showBubble('mate:' + o.def.id, o.r.root, L(o).followOff, 3.4); } return false; }
  if (followS.m) social.showBubble('mate:' + followS.m.def.id, followS.m.r.root, L(followS.m).followOff, 3.4);
  followS.m = m; followS.until = nowS() + B.follow.sec; m.task = null; m.route = null;
  social.showBubble('mate:' + m.def.id, m.r.root, L(m).followOn, 3.4);
  return true;
}
if (TW) {
  $('mt-close').addEventListener('click', closeTalk);
  $('mt-follow').addEventListener('click', () => { const m = talkS.m; if (!m) return; follow(m, followS.m !== m); closeTalk(); });
  $('mt-more').addEventListener('click', () => { const m = talkS.m; if (m) TW.querySelector('.mt-line').textContent = lineFor(m); });
}
// 메뉴 설정: 동료 켜기/끄기
{ const b = $('menu-mates'); if (b) { const sync = () => { b.setAttribute('aria-pressed', String(!M.off)); b.textContent = M.off ? '동료: 끔' : '동료: 켬'; }; sync(); b.hidden = !ON;
  b.addEventListener('click', () => { M.off = M.off ? 0 : 1; persist(); sync(); }); } }

// ---------- 감독 문: 동료가 처음 나옴 ----------
for (const m of mates) {
  director.register({
    id: m.def.door, kind: 'mate', sec: 5,
    intro: () => { if (!allowed().includes(m)) return; show(m, true); placeAhead(m, m.def.id === 'sunja' ? 9 : 12); m.task = { k: 'hello', t: 0, T: 2.6 }; m.greetAt = nowS(); m.inGreet = true; social.showBubble('mate:' + m.def.id, m.r.root, LINES[m.def.id].intro, 3.4); },
    // 한가할 때 실마리: 가까이 있는 동료가 상황 대사 한 줄
    clue: () => { const o = mates.find((x) => x.on && x.r.root.visible && flat(x.pos, player.pos) < 22 && !x.task); return o ? speak(o, lineFor(o)) : false; },
  });
}

// 지금 나와도 되는 동료 (문이 열림·설정·사람 수·저사양)
function allowed() {
  if (!ON || M.off || !state.sessionOn || late.tut?.active) return [];
  const n = net.count || 0; let k = n > B.peers[1] ? 0 : n > B.peers[0] ? 1 : 3;
  if (TIER === 0) k = Math.min(k, B.low);
  const list = mates.filter(opened);
  if (followS.m && list.includes(followS.m)) { list.splice(list.indexOf(followS.m), 1); list.unshift(followS.m); }
  return list.slice(0, k);
}
function show(m, v) {
  if (m.on === v) return; m.on = v; m.r.root.visible = v;
  if (!v) { m.route = null; m.task = null; m.heap = -1; if (followS.m === m) followS.m = null; if (talkS.m === m) closeTalk(); if (m.culled) { state.farCull?.remove(m.r.root); m.culled = false; } return; }
  if (!m.placed || flat(m.pos, player.pos) > B.far * 1.5) { const s = trailSpot(B.roam[0], B.roam[1]); if (s) place(m, s.x, s.z); else placeAhead(m, 20); }
  if (!m.culled && state.farCull) { state.farCull.add(m.r.root, { dynamic: true, shadow: false }); m.culled = true; }
}

// ---------- 매 프레임 ----------
let seenFlee = new Set(), lastEmo = '', allowT = 0, cur = [];
function enemyNear(p, r, chasing = true) {
  let best = null, bd = r;
  for (const e of life.enemies.list) { if (e.boss || e.state === 'flee' || e.state === 'leave') continue; if (chasing && !AGGRO.has(e.state)) continue; const d = flat(e.pos, p); if (d < bd) { bd = d; best = e; } }
  return best;
}
function tickMate(m, dt, t) {
  const L = LINES[m.def.id], dP = flat(m.pos, player.pos), boss = !!late.bossFight?.();
  m.poseT += dt;
  // 맞음: 아야 → hurt 초 물러남
  if (m.hurtT > 0) {
    m.hurtT -= dt; setPose(m, 'move');
    if (!m.route && m.hurtFrom) { const a = Math.atan2(m.pos.x - m.hurtFrom.x, m.pos.z - m.hurtFrom.z), x = m.pos.x + Math.sin(a) * 8, z = m.pos.z + Math.cos(a) * 8; goDirect(m, x, z, true); }
    step(m, dt); return;
  }
  for (const e of life.enemies.list) if (e.state === 'dash' && flat(e.pos, m.pos) < B.hitR * (e.def?.size || 1)) {
    m.hurtT = B.hurt; m.hurtFrom = e.pos.clone(); m.route = null; m.task = null; m.heap = -1; social.showBubble('mate:' + m.def.id, m.r.root, L.hurt, 3.4); return;
  }
  // 말 거는 중: 멈춰서 나를 봄
  if (talkS.m === m) { m.speed = 0; face(m, player.pos.x, player.pos.z, dt); setPose(m, 'move'); return; }
  // 감정 표현 따라 하기
  if (m.emo) { m.emo.t += dt; if (m.emo.t >= 0) { face(m, player.pos.x, player.pos.z, dt); m.speed = 0; if (m.pose !== m.emo.id) { m.pose = m.emo.id; m.poseT = m.emo.t; } if (m.emo.t > m.emo.T) { m.emo = null; setPose(m, 'move'); } } return; }
  // 할 일 (박수·환호·인사·걱정)
  if (m.task) {
    const k = m.task;
    if (k.k === 'cheer' || k.k === 'worry') { if (m.route) { step(m, dt); setPose(m, 'move'); return; } }
    k.t += dt; m.speed = 0; face(m, player.pos.x, player.pos.z, dt);
    setPose(m, k.k === 'clap' ? 'clap' : k.k === 'cheer' ? 'cheer' : k.k === 'worry' ? 'sad' : k.k === 'watch' ? 'cheer' : 'wave');
    if (k.t > k.T || (k.k === 'worry' && !hp.isDown)) { m.task = null; setPose(m, 'move'); }
    return;
  }
  // 내가 쓰러짐: 달려와 걱정
  if (hp.isDown && dP < B.worryR) { const a = Math.random() * 6.28; m.task = { k: 'worry', t: 0, T: 30 }; go(m, player.pos.x + Math.sin(a) * 2.5, player.pos.z + Math.cos(a) * 2.5, true); if (m === mates.find((o) => o.on)) speak(m, L.worry, { queue: true }); return; }
  // 우두머리전: 조금 떨어져 응원
  if (boss) {
    if (dP > 26 || dP < 14) { if (!m.route) { const a = Math.atan2(m.pos.x - player.pos.x, m.pos.z - player.pos.z), x = player.pos.x + Math.sin(a) * 18, z = player.pos.z + Math.cos(a) * 18; goDirect(m, x, z, true); } step(m, dt); setPose(m, 'move'); return; }
    m.route = null; m.speed = 0; face(m, player.pos.x, player.pos.z, dt); setPose(m, 'cheer'); if (t - m.lastSay > 20) speak(m, L.watch); return;
  }
  // 싸움
  const e = enemyNear(player.pos, 30);
  if (e) {
    if (m.def.fight === 'chase' && flat(e.pos, m.pos) < B.throw.rush) {
      const d = flat(e.pos, m.pos);
      if (d > B.throw.range * 0.8) { if (!m.route || (m.goal && flat(m.goal, e.pos) > 4)) goDirect(m, e.pos.x, e.pos.z, true); step(m, dt); setPose(m, 'move'); return; }
      m.route = null; m.speed = 0; face(m, e.pos.x, e.pos.z, dt, 14);
      m.throwT -= dt; if (m.throwT <= 0) { m.throwT = B.throw.every; m.pose = 'throw'; m.poseT = 0; shoot(m, e); }
      if (m.pose === 'throw' && m.poseT > 1) setPose(m, 'move');
      return;
    }
    if (m.def.fight === 'flee') {
      const d = flat(e.pos, m.pos);
      if (d < 15) { if (!m.route) { const a = Math.atan2(m.pos.x - e.pos.x, m.pos.z - e.pos.z), x = m.pos.x + Math.sin(a) * 12, z = m.pos.z + Math.cos(a) * 12; goDirect(m, x, z, true); } step(m, dt); setPose(m, 'move'); return; }
    }
  }
  if (m.pose === 'throw') setPose(m, 'move');
  // 인사: 6m 안에 오면 돌아보고 손 흔듦 (멀어졌다가 다시 와야 또)
  if (dP < B.greet && !m.inGreet && t - m.greetAt > B.greetGap && !m.sit) { m.inGreet = true; m.greetAt = t; m.task = { k: 'hello', t: 0, T: 2.2 }; m.route = null; m.heap = -1; speak(m, one(L.greet)); return; }
  if (dP > B.greet * 2) m.inGreet = false;
  // 겹치면 비켜남
  if (dP < B.avoid.player && !m.route) { const a = Math.atan2(m.pos.x - player.pos.x, m.pos.z - player.pos.z) + 0.6, x = m.pos.x + Math.sin(a) * 2.5, z = m.pos.z + Math.cos(a) * 2.5; if (!col.blocked(x, z, 0.4)) goDirect(m, x, z); }
  // 함께 가기: 8m 뒤에서 따라오며 가까운 더미를 같이 주움
  const fol = followS.m === m;
  if (fol && t > followS.until) follow(m, false);
  // 밤: 들머리 평상에서 쉼
  const night = (sunState?.el ?? 30) < -4;
  if (night && !fol && benchPos) {
    const i = mates.indexOf(m), a = i * 1.2 + 0.4, x = benchPos.x + Math.sin(a) * 2.2, z = benchPos.z + Math.cos(a) * 2.2;
    if (Math.hypot(m.pos.x - x, m.pos.z - z) > 1) { m.sit = false; if (dP > 40 && Math.hypot(m.pos.x - x, m.pos.z - z) > 80) { place(m, x, z); return; } if (!m.route || (m.goal && Math.hypot(m.goal.x - x, m.goal.z - z) > 1)) go(m, x, z); step(m, dt); setPose(m, 'move'); return; }
    m.sit = true; m.speed = 0; face(m, benchPos.x, benchPos.z, dt, 2); setPose(m, 'sitg'); m.poseT = Math.min(m.poseT, 1); return;
  }
  m.sit = false;
  // 줍는 중
  if (m.heap >= 0) {
    const h = trash.heaps[m.heap];
    if (!h || trash.store.left(m.heap) <= Math.ceil(trash.store.full(m.heap) * B.keep) || (fol && dP > B.follow.d * 2.5)) { m.heap = -1; setPose(m, 'move'); }
    else if (m.route) { step(m, dt); setPose(m, 'move'); return; }
    else {
      m.speed = 0; face(m, h.x, h.z, dt); setPose(m, 'crouch'); m.pickT += dt;
      if (m.pickT >= B.pickTime / m.def.pick) {
        m.pickT = 0; m.poseT = 0;
        if (bank >= 1 && trash.buddyTake(m.heap)) { bank -= 1; m.picked++; m.picks--; } else m.picks = 0;
        if (m.picks <= 0) { m.heap = -1; setPose(m, 'move'); m.wait = 1 + Math.random() * 2; }
      }
      return;
    }
  }
  if (fol) {
    const bx = player.pos.x - Math.sin(player.heading) * B.follow.d, bz = player.pos.z - Math.cos(player.heading) * B.follow.d;
    if (bank >= 1 && player.speed < 0.5) { const h = nearHeap(m, 10); if (h >= 0) return startPick(m, h); }
    if (Math.hypot(m.pos.x - bx, m.pos.z - bz) > 2.5) { if (!m.route || t - (m.reT || 0) > 1.5) { m.reT = t; go(m, bx, bz, dP > B.follow.d * 1.6); } step(m, dt); setPose(m, 'move'); return; }
    m.route = null; m.speed = 0; face(m, player.pos.x, player.pos.z, dt, 3); setPose(m, 'move'); return;
  }
  // 너무 멀면 내 쪽으로
  if (dP > B.far && (!m.goal || flat(m.goal, player.pos) > B.far * 0.8)) { const s = trailSpot(B.near, B.roam[0] + 10, m.pos); if (s) go(m, s.x, s.z, dP > B.far * 1.3); }
  if (m.route) { step(m, dt); setPose(m, 'move');
    m.stuck = flat(m.lastP, m.pos) < 0.02 ? m.stuck + dt : 0; m.lastP.copy(m.pos); if (m.stuck > 2) { m.route = null; m.wait = 0.5; } return; }
  // 서 있음 → 다음 할 일
  m.speed = 0;
  if (nearDoor(m.pos.x, m.pos.z)) { const s = trailSpot(B.near, B.roam[1]); if (s) { go(m, s.x, s.z); return; } }
  if ((m.wait -= dt) > 0) { if (m.pose === 'photo') face(m, m.photoX, m.photoZ, dt, 2); return; }
  setPose(m, 'move');
  if (bank >= 1) { const h = nearHeap(m); if (h >= 0) return startPick(m, h); }
  if (m.def.photo && Math.random() < m.def.photo) { const a = Math.random() * 6.28; m.photoX = m.pos.x + Math.sin(a) * 10; m.photoZ = m.pos.z + Math.cos(a) * 10; m.pose = 'photo'; m.poseT = 0; m.wait = 4 + Math.random() * 3; return; }
  // 돌아다니기: 길 위 한 점 (가끔 들판으로 조금)
  const s = trailSpot(B.near, B.roam[1]);
  if (s) { let { x, z } = s; if (Math.random() < 0.25) { const a = Math.random() * 6.28, r = 8 + Math.random() * 14, fx = x + Math.sin(a) * r, fz = z + Math.cos(a) * r; if (inField(fx, fz)) { x = fx; z = fz; } } go(m, x, z); }
  m.wait = 2 + Math.random() * 5;
}
function startPick(m, h) {
  const H = trash.heaps[h], a = Math.atan2(m.pos.x - H.x, m.pos.z - H.z), R = H.r * 0.9 + B.pickR, x = H.x + Math.sin(a) * R, z = H.z + Math.cos(a) * R;
  m.heap = h; m.pickT = 0; m.picks = 2 + Math.floor(Math.random() * 4); go(m, x, z);
}
function draw(m, dt) {
  const r = m.r, d0 = flat(m.pos, player.pos);
  r.root.position.copy(m.pos); r.root.rotation.set(0, m.heading, 0);
  m.act.pos.copy(m.pos);
  const op = d0 < 10 ? 1 : d0 < 18 ? 1 - (d0 - 10) / 8 : 0; m.label.material.opacity = op; m.label.visible = op > 0.02;
  const sh = d0 < PERF.peerShadowR[TIER]; if (sh !== m.shadow) { m.shadow = sh; r.root.traverse((c) => { if (c.isMesh) c.castShadow = sh; }); }
  if (d0 > PERF.peerAnimR[TIER]) return; // 멀면 자리만 (다른 사람 그리기와 같게)
  const p = m.pose, E = EMOTE_BY[p];
  r.animate(dt, { speed: m.speed, running: m.run && m.speed > 3, pose: p === 'clap' || p === 'sad' || p === 'sitg' || isEmote(p) || ['move', 'crouch', 'throw', 'cheer', 'wave', 'photo', 'dance'].includes(p) ? p : 'move', t: m.poseT, air: false, jumpV: 0, edur: E?.dur || 2, tool: 1, dur: B.pickTime / m.def.pick });
}
export function tickBuddies(dt) {
  if (!ON) return;
  const t = nowS();
  if ((allowT -= dt) <= 0) { allowT = 0.5; cur = allowed(); for (const m of mates) show(m, cur.includes(m)); }
  // 내가 감정 표현을 하면 가까운 동료가 따라 함
  const ep = isEmote(player.pose) ? player.pose : '';
  if (ep && ep !== lastEmo && player.poseT < 0.4) {
    const E = EMOTE_BY[ep]; mates.filter((m) => m.on && !m.task && !m.emo && m.hurtT <= 0 && flat(m.pos, player.pos) < 15).forEach((m, i) => { m.emo = { id: ep === 'five' ? 'wave' : ep, t: -0.4 - i * 0.25, T: E.dur || 4 }; m.route = null; });
  }
  lastEmo = ep;
  // 적을 쫓아냄 (실마리 대사 'fight')
  for (const e of life.enemies.list) if (e.state === 'flee' && !seenFlee.has(e)) { seenFlee.add(e); lastFight = t; }
  if (seenFlee.size > 60) seenFlee = new Set([...seenFlee].filter((e) => life.enemies.list.includes(e)));
  for (const m of cur) { tickMate(m, dt, t); draw(m, dt); }
  tickShots(dt);
  if (talkS.m && (TW.hidden || flat(talkS.m.pos, player.pos) > B.talkR * 3)) closeTalk();
  // 한가하면 가끔 혼잣말 (감독이 다른 말과 겹치지 않게)
  for (const m of cur) if (m.r.root.visible && t - m.lastSay > (m.nextSay ??= B.ambient[0] + Math.random() * (B.ambient[1] - B.ambient[0])) && flat(m.pos, player.pos) < 18 && !m.task) { m.nextSay = B.ambient[0] + Math.random() * (B.ambient[1] - B.ambient[0]); if (!speak(m, lineFor(m))) m.lastSay = t - m.nextSay + 10; }
}

// ---------- 확인용 ----------
late.buddies = ON ? {
  list: () => mates.map((m) => ({ id: m.def.id, name: m.def.name, open: opened(m), on: m.on, visible: m.r.root.visible, mode: talkS.m === m ? 'talk' : followS.m === m ? 'follow' : m.task?.k || (m.heap >= 0 ? 'pick' : m.hurtT > 0 ? 'hurt' : m.sit ? 'rest' : m.route ? 'walk' : 'idle'),
    pose: m.pose, x: +m.pos.x.toFixed(1), z: +m.pos.z.toFixed(1), d: +flat(m.pos, player.pos).toFixed(1), picked: m.picked })),
  // id 동료를 바로 내 옆으로 (문이 안 열렸으면 조용히 엶)
  come(id) { const m = byId(id); if (!m) return null; if (!opened(m)) director.open(m.def.door, { quiet: true }); allowT = 0; cur = allowed(); show(m, cur.includes(m)); if (!m.on) return false; placeAhead(m, 4); m.inGreet = false; m.greetAt = -1e9; return true; },
  talk(id) { const m = byId(id); if (m?.on) openTalk(m); return !!talkS.m; },
  line: (id) => { const m = byId(id); return m ? lineFor(m) : null; },
  follow(id, on = true) { const m = byId(id); return m?.on ? follow(m, on) : false; },
  hurt(id) { const m = byId(id); if (!m) return; m.hurtT = B.hurt; m.hurtFrom = player.pos.clone(); social.showBubble('mate:' + id, m.r.root, LINES[id].hurt, 3.4); },
  sim(sec = 1) { for (let t = 0; t < sec; t += 0.05) tickBuddies(0.05); }, // 확인용: 동료만 sec 초 앞당겨 돌림 (느린 화면에서 시험)
  get bank() { return bank; }, set bank(v) { bank = v; },
  state: () => ({ off: M.off, allowed: allowed().map((m) => m.def.id), bank: +bank.toFixed(2), follow: followS.m?.def.id || null, talk: talkS.m?.def.id || null, ctx: [...ctx()].filter(Boolean) }),
  mates, lines: LINES,
} : null;
