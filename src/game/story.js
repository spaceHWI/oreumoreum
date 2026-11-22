// 이야기 이벤트 (#168): 플레이어가 한 일의 결과로 다음 일이 벌어진다. 수치는 balance.js STORY, 글은 src/punktext.js, 설계는 notes/growth-loop.md '이야기 이벤트'
// - 이벤트 하나 = 조건(그 일이 일어날 때 봄) → 예고(감독 #176 'story' 차례로 한 줄 + 카메라가 잠깐 그쪽) → 벌어지는 일 → 끝(보상·다음 이벤트)
// - 사람마다 한 번씩. 한 번에 하나만 돌고, 조건이 맞은 것은 기다림 줄(save.story.wait)에 서서 안전할 때(싸움·튜토리얼·창·쓰러짐이 아닐 때 safeSec 초) 시작
//   하루에 새로 시작하는 것은 STORY.perDay 개. 감독 문(door)이 있는 이벤트는 그 문이 열려야 시작
// - 옛 저장: 셈은 업적 평생 기록(save.ach.life)이라 이미 한참 넘긴 사람도 다음 번 그 일이 한 번 더 일어날 때 줄에 섬
// - 저장 save.story = { done: [id], wait: [id], day, n, cans: [[x,z]] 안 주운 외계 캔, box: [x,z] 안 주운 귤 상자 }
// - 멀티: 이벤트는 각자. 나타난 적·투기꾼은 지금 적·투기꾼처럼 각자 화면(#181 전까지). 엔딩만 방 전체(game/ending.js)
// - 아직 없는 기능(#163 관광객, #165 칭호, #158 오름지기 곁가지)은 late.* 가 있으면 부르고 없으면 건너뜀
// dev: __oreum.story.play('mom') · ids · state() · reset()
import * as THREE from 'three';
import { STORY } from '../balance.js';
import { josaIGa } from '../zonelook.js';
import { STORY_TEXT as T, STORY_DEX } from '../punktext.js';
import { DEX_LIST } from '../trash.js';
import { height } from '../world.js';
import { state, late } from './state.js';
import { save, persist } from './save.js';
import { scene, spots, sunState } from './scene.js';
import { life, trash, player, hp, bfx } from './place.js';
import { cam } from './camera.js';
import { toast, panelOpen, addCoins, onDexGet } from './hud.js';
import { say, director } from './director.js';
import { sound, dumpers } from './hooks.js';
const sfx = (k, ...a) => { try { if (sound.on) sound[k]?.(...a); } catch { /* 소리가 꺼져 있음 */ } };
import { interactables } from './stores.js';
import { field } from './field.js';
import { isDone } from './zonedone.js';
import { startEnding, makeUfo as makeUfo0 } from './ending.js';
import { veilOn, veiled } from '../ufoveil.js';

const DEF = Object.fromEntries(STORY.list.map((d) => [d.id, d]));
const IDS = STORY.list.map((d) => d.id);
const dayOf = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ON = !!trash; // 쓰레기(구역)가 있는 맵에서만

// ---------- 저장 ----------
const S = (() => {
  let s = save.story;
  if (!s || typeof s !== 'object' || Array.isArray(s)) s = save.story = {};
  s.done = Array.isArray(s.done) ? s.done.filter((id) => DEF[id]) : [];
  s.wait = Array.isArray(s.wait) ? s.wait.filter((id) => DEF[id] && !s.done.includes(id)) : [];
  if (typeof s.day !== 'string') s.day = ''; s.n = s.n | 0;
  s.cans = Array.isArray(s.cans) ? s.cans.filter((c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1])).slice(0, 8) : [];
  if (!(Array.isArray(s.box) && Number.isFinite(s.box[0]) && Number.isFinite(s.box[1]))) s.box = null;
  return s;
})();
const life0 = (ev) => save.ach?.life?.[ev] || 0;
const isDoneId = (id) => S.done.includes(id);

// ---------- 감독 문 (#176): 이 이벤트들이 여정 순서대로 열리게 ----------
director.register({ id: 'storyMom' }); director.register({ id: 'nightLight' }); director.register({ id: 'aliens' });
const doorOk = (d) => !d.door || director.isOpen(d.door);

// ---------- 작은 도구 ----------
const fxG = new THREE.Group(); scene.add(fxG);
const okAt = (x, z) => (!spots.inBounds || spots.inBounds(x, z)) && (!spots.enemyOk || spots.enemyOk(x, z));
const zoneOf = (x, z) => (trash ? trash.zoneAt(x, z) || 0 : 0);
// 플레이어 둘레 r 안 한 점 (앞쪽 먼저). zone 을 주면 그 구역 안, ok 는 자리 검사
function spotNear([r0, r1], { zone = null, ok = okAt, ahead = 0.6 } = {}) {
  for (let k = 0; k < 40; k++) {
    const a = player.heading + (k < 16 ? (Math.random() - 0.5) * 2 * ahead * Math.PI : Math.random() * Math.PI * 2), r = r0 + Math.random() * (r1 - r0);
    const x = player.pos.x + Math.sin(a) * r, z = player.pos.z + Math.cos(a) * r;
    if (!ok(x, z)) continue; if (zone != null && zoneOf(x, z) !== zone) continue;
    return { x, z };
  }
  return null;
}
const makeUfo = (k) => makeUfo0(k, fxG, veilOn()); /* #207 단계 3 전엔 빛 덩이 */
const glance = (x, z, T0 = STORY.look) => { state.glance = { x, z, t: 0, T: T0 }; };
// 예고: 감독의 'story' 차례로 한 줄 (지금 안 되면 줄에 섬). 카메라가 잠깐 그쪽
function omen(id, text, at, sec = STORY.omen) {
  say('story', 'story:' + id, text, sec, { ttl: 12 });
  if (at) glance(at.x, at.z);
}
const line = (id, text, sec = 3) => !veiled(text) && say('story', 'story:' + id + ':' + text.length, text, sec, { ttl: 10 });
// 머리 위 말풍선 (캔버스 글자 스프라이트). 다 쓰면 지움
const bubbles = [];
function bubble(root, text, y, sec = 3) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d');
  g.font = '700 34px sans-serif'; const w = Math.min(248, g.measureText(text).width + 40);
  g.fillStyle = 'rgba(255,255,255,0.94)'; g.strokeStyle = '#2b2622'; g.lineWidth = 4;
  const x0 = (256 - w) / 2; g.beginPath(); g.roundRect(x0, 8, w, 60, 22); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(118, 66); g.lineTo(128, 86); g.lineTo(138, 66); g.fill();
  g.fillStyle = '#2b2622'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 39, 230);
  const tex = new THREE.CanvasTexture(c), sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set(2.6, 0.98, 1); sp.renderOrder = 21; sp.position.set(0, y, 0); root.add(sp);
  bubbles.push({ sp, root, t: sec, tex });
  return sp;
}
function tickBubbles(dt) {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i]; b.t -= dt;
    if (b.t <= 0 || !b.root.parent) { b.root.remove(b.sp); b.sp.material.dispose(); b.tex.dispose(); bubbles.splice(i, 1); }
    else b.sp.material.opacity = Math.min(1, b.t * 2);
  }
}
// 주울 것 (외계 캔·귤 상자): 땅에 놓고 다가가면(r) take()
const canGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.42, 10), canMat = new THREE.MeshLambertMaterial({ color: '#9fe8c8', emissive: '#2f8f6a', emissiveIntensity: 0.6 });
const boxGeo = new THREE.BoxGeometry(0.9, 0.6, 0.7), boxMat = new THREE.MeshLambertMaterial({ color: '#c98a3c' }), lidMat = new THREE.MeshLambertMaterial({ color: '#ff9a2c' });
const loot = []; // { m, x, z, r, take }
function putLoot(kind, x, z, take) {
  let m;
  if (kind === 'can') { m = new THREE.Mesh(canGeo, canMat); m.rotation.z = 1.4; m.position.set(x, height(x, z) + 0.17, z); }
  else { m = new THREE.Group(); const b = new THREE.Mesh(boxGeo, boxMat), l = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.12, 0.76), lidMat); l.position.y = 0.36; m.add(b, l); m.position.set(x, height(x, z) + 0.3, z); }
  fxG.add(m); const o = { m, x, z, r: kind === 'can' ? STORY.night.pickR : 1.9, take, kind }; loot.push(o); return o;
}
function tickLoot(dt, time) {
  for (let i = loot.length - 1; i >= 0; i--) {
    const o = loot[i]; o.m.rotation.y += dt * (o.kind === 'can' ? 1.6 : 0.4); if (o.kind === 'can') o.m.position.y = height(o.x, o.z) + 0.2 + Math.sin(time * 3 + i) * 0.06;
    if (!hp.isDown && Math.hypot(o.x - player.pos.x, o.z - player.pos.z) < o.r) { fxG.remove(o.m); loot.splice(i, 1); o.take(); }
  }
}

// ---------- 이벤트마다 벌어지는 일 ----------
// run(id) → { tick(dt, time) → 'done' | 'fail' | 'skip' | null, stop() }. null 을 돌려주면 지금은 못 함(조금 뒤 다시)
let packSeq = 9000; // 이야기 적 무리 id (enemies.js 무리 #146 은 같은 pack 끼리)
function spawnMom(at) { // 엄마 멧돼지 + 새끼 (tools/fight.js 도 씀)
  const M = STORY.mom, pk = ++packSeq;
  const momE = life.enemies.spawnStory(M.kind, at.x, at.z, { id: 'mom', k: M.k, pack: pk, over: { name: '엄마 멧돼지', hp: M.hp, dmg: M.dmg, reward: { gyul: 0, rare: 0 }, life: M.life } });
  momE.mom = true; const list = [momE];
  for (let i = 0; i < M.kids; i++) { const a = i * 2.4 + 1, e = life.enemies.spawnStory('piglet', at.x + Math.sin(a) * 2.2, at.z + Math.cos(a) * 2.2, { id: 'mom', pack: pk }); list.push(e); }
  for (const e of list) { e.state = 'charge'; e.st = 0; e.heading = Math.atan2(player.pos.x - e.pos.x, player.pos.z - e.pos.z); }
  return list;
}
const RUN = {
  mom() {
    const at = spotNear(STORY.mom.r, { zone: zoneOf(player.pos.x, player.pos.z) === 1 ? 1 : null }); if (!at) return null;
    let t = 0, list = null, momE = null; const M = STORY.mom;
    omen('mom', T.mom.omen, at); sfx('boar');
    return {
      tick(dt) {
        t += dt;
        if (!list && t >= STORY.omen) {
          state.shake = Math.max(state.shake || 0, 0.5);
          list = spawnMom(at); momE = list[0];
          bubble(momE.root, '꿀!!', momE.h / M.k + 0.9, 2); line('mom', T.mom.go, 2.6);
          if (bfx) bfx.ring(at.x, at.z, 5, 0.8, '#b8a07c', 0, 1);
        }
        if (!list) return null;
        if (momE.state === 'flee' && !momE.said) { momE.said = true; bubble(momE.root, T.mom.say, momE.h / M.k + 0.9, 3.2); }
        const gone = list.every((e) => !life.enemies.list.includes(e) || e.state === 'flee' || e.state === 'leave');
        if (!gone) return null;
        return momE.said ? 'done' : 'fail';
      },
      stop() { for (const e of list || []) if (life.enemies.list.includes(e) && e.state !== 'flee') { e.state = 'leave'; e.st = 0; } },
    };
  },
  pair() {
    if (!dumpers) return { tick: () => 'skip', stop() {} };
    const a = dumpers.come('walker', { hold: STORY.omen }); if (!a) return null;
    const s0 = a.route[0], side = [s0[0] + Math.cos(a.heading) * 2.4, s0[1] - Math.sin(a.heading) * 2.4];
    const b = dumpers.come('walker', { hold: STORY.omen, heap: a.heap, start: side }); b && (b.lookout = true);
    const two = [a, b].filter(Boolean), rep = new Set(); let whistled = false, t = 0;
    omen('pair', T.pair.omen, { x: s0[0], z: s0[1] });
    return {
      tick(dt) {
        t += dt;
        for (const d of two) if (d.state === 'startle') rep.add(d);
        if (b && !whistled && b.state === 'come' && !b.hold && b.pos.distanceTo(player.pos) < STORY.pair.whistle) { // 망보는 사람이 휘파람 → 다른 한 명이 서둘러 버림
          whistled = true; bubble(b.root, '휘익!', 2.9, 2); line('pairW', T.pair.whistle, 2.4); sfx('beep', true);
          if (a.state === 'come' && !rep.has(a)) { a.state = 'dump'; a.st = 0; a.hurried = true; }
        }
        const left = two.filter((d) => dumpers.list.includes(d) && (d.state === 'come' || d.state === 'dump' || d.hold > 0));
        if (left.length && t < 240) return null;
        if (rep.size >= two.length) return 'done';
        line('pairM', T.pair.miss, 2.6); return 'skip'; // 놓쳤으면 보상 없이 끝 (한 번만)
      },
      stop() {},
    };
  },
  night() {
    const N = STORY.night, at = spotNear(N.d, { ok: (x, z) => !spots.inBounds || spots.inBounds(x, z), ahead: 0.4 }); if (!at) return null;
    const ufo = makeUfo(N.k), dir = Math.random() * Math.PI * 2, L = 110, y0 = height(at.x, at.z) + N.y;
    const from = [at.x - Math.sin(dir) * L, at.z - Math.cos(dir) * L], to = [at.x + Math.sin(dir) * L, at.z + Math.cos(dir) * L];
    let t = 0, dropped = false; omen('night', T.night.omen, at, 3);
    ufo.root.position.set(from[0], y0, from[1]);
    return {
      tick(dt) {
        t += dt; const u = Math.min(1, t / N.t), sm = u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u), mid = Math.max(0, 1 - Math.abs(u - 0.5) * 6);
        ufo.root.position.set(from[0] + (to[0] - from[0]) * sm, y0 + Math.sin(t * 2) * 0.6, from[1] + (to[1] - from[1]) * sm); ufo.root.rotation.y += dt * 1.4;
        { const q = ufo.root.position; ufo.setBeam(q.y - height(q.x, q.z) + 1, 0.45 * mid); } // 빛기둥은 지나는 자리 땅까지 (#192)
        if (!dropped && u >= 0.5) {
          dropped = true; trash?.drop(at.x, at.z, N.trash, 40); trash?.store.commit();
          for (let i = 0; i < N.cans; i++) { const a = i / N.cans * 6.283, x = at.x + Math.sin(a) * 1.4, z = at.z + Math.cos(a) * 1.4; S.cans.push([x, z]); addCan(x, z); }
          persist(); line('night', T.night.go, 2.6); if (bfx) bfx.ring(at.x, at.z, 4, 1, '#c9ffb8', 0, 1.2);
        }
        if (u >= 1) { ufo.dispose(); return 'done'; }
        return null;
      },
      stop() { ufo.dispose(); },
    };
  },
  howl() {
    const H = STORY.howl; let t = 0, list = null; const wait = H.wait[0] + Math.random() * (H.wait[1] - H.wait[0]);
    omen('howl', T.howl.omen, null, 3); sfx('crow');
    return {
      tick(dt) {
        t += dt;
        if (!list) {
          if (t < wait) return null;
          if (zoneOf(player.pos.x, player.pos.z) !== 2 || !okAt(player.pos.x, player.pos.z)) { if (t > 600) return 'fail'; return null; } // 구역 2 로 돌아오면
          const pk = ++packSeq, face = player.heading; list = [];
          for (let i = 0; i < H.n; i++) { const a = face + (i - (H.n - 1) / 2) * 0.55, x = player.pos.x + Math.sin(a) * H.r, z = player.pos.z + Math.cos(a) * H.r; if (!okAt(x, z)) continue; const e = life.enemies.spawnStory('dog', x, z, { id: 'howl', pack: pk }); e.state = 'charge'; e.st = 0; e.heading = Math.atan2(player.pos.x - x, player.pos.z - z); list.push(e); }
          if (!list.length) { list = null; return null; }
          line('howlGo', T.howl.go, 2.8); glance(list[0].pos.x, list[0].pos.z, 1.6);
        }
        return list.every((e) => !life.enemies.list.includes(e) || e.state === 'flee' || e.state === 'leave') ? 'done' : null;
      },
      stop() { for (const e of list || []) if (life.enemies.list.includes(e) && e.state !== 'flee') { e.state = 'leave'; e.st = 0; } },
    };
  },
  truck() {
    if (!dumpers) return { tick: () => 'skip', stop() {} };
    const cand = trash.heaps.map((h, i) => i).filter((i) => trash.heaps[i].zone === 2 && trash.heaps[i].k !== 's' && trash.heaps[i].n - trash.store.left(i) > 0);
    truckFree = true; const d = dumpers.come('truck', { hold: STORY.omen, heap: cand.length ? cand[Math.floor(Math.random() * cand.length)] : -1 }); truckFree = false;
    if (!d) return null;
    omen('truck', T.truck.omen, { x: d.pos.x, z: d.pos.z }, 3); sfx('beep', false);
    let t = 0, said = false;
    return { tick(dt) { t += dt; if (!said && t > STORY.omen) { said = true; line('truckGo', T.truck.go, 2.6); glance(d.pos.x, d.pos.z, 1.6); } return t > STORY.omen + 1 ? 'done' : null; }, stop() {} };
  },
  meet() {
    const a = field?.bosses?.find((b) => b.zone === 3); if (!a) return { tick: () => 'skip', stop() {} };
    let c = null; for (let k = 0; k < 12 && !c; k++) { const g = k / 12 * 6.283, x = a.x + Math.sin(g) * STORY.meet.off, z = a.z + Math.cos(g) * STORY.meet.off; if (okAt(x, z)) c = { x, z }; }
    if (!c) return { tick: () => 'skip', stop() {} };
    const list = [];
    for (let i = 0; i < STORY.meet.n; i++) { const g = i / STORY.meet.n * 6.283, x = c.x + Math.sin(g) * 2.3, z = c.z + Math.cos(g) * 2.3; const e = life.enemies.spawnStory('boar', x, z, { id: 'meet', calm: true, calmR: STORY.meet.calmR }); e.heading = Math.atan2(c.x - x, c.z - z); list.push(e); }
    omen('meet', T.meet.omen, c, 3);
    let talkT = 1, scattered = false;
    return {
      tick(dt) {
        if (!scattered && list.some((e) => e.state !== 'calm')) { // 하나가 흩어지면 모두
          scattered = true; for (const e of list) if (e.state === 'calm') life.enemies.hurt(e, 0, true);
          S.box = [c.x, c.z]; persist(); addBox(c.x, c.z); line('meetGo', T.meet.go, 2.8);
        }
        if (scattered) return 'done';
        if ((talkT -= dt) <= 0) { talkT = 1.6 + Math.random() * 1.4; const e = list[Math.floor(Math.random() * list.length)]; if (life.enemies.list.includes(e) && e.pos.distanceTo(player.pos) < 60) bubble(e.root, T.meet.say[Math.floor(Math.random() * T.meet.say.length)], e.h + 0.8, 1.6); }
        return null;
      },
      stop() { for (const e of list) if (life.enemies.list.includes(e)) life.enemies.remove(e); },
    };
  },
  tour() { // 관광객 (#163) 이 생기면 late.tourists.bus(n) 로 부름
    if (!late.tourists?.bus) return { tick: () => 'skip', stop() {} };
    omen('tour', T.tour.omen, null); late.tourists.bus(5);
    return { tick: () => 'done', stop() {} };
  },
  sign() {
    const SG = STORY.sign, fx = Math.sin(player.heading), fz = Math.cos(player.heading);
    let x = player.pos.x + fx * SG.ahead, z = player.pos.z + fz * SG.ahead; if (spots.inBounds && !spots.inBounds(x, z)) { x = player.pos.x; z = player.pos.z; }
    const g = new THREE.Group(), post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12), new THREE.MeshLambertMaterial({ color: '#7a5a3c' })), board = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.06), new THREE.MeshLambertMaterial({ map: signTex() }));
    post.position.y = 0.8; board.position.y = 1.45; const tilt = new THREE.Group(); tilt.add(post, board); g.add(tilt); tilt.rotation.x = -1.45;
    g.position.set(x, height(x, z), z); g.rotation.y = Math.atan2(player.pos.x - x, player.pos.z - z); fxG.add(g);
    let up = 0, dog = null, t = 0;
    const act = { label: T.sign.act, ic: 'sign', pos: new THREE.Vector3(x, height(x, z), z), r: SG.r, when: () => up === 0, act: () => { up = 1; } };
    interactables.push(act);
    omen('sign', T.sign.omen, { x, z });
    const off = () => { const i = interactables.indexOf(act); if (i >= 0) interactables.splice(i, 1); };
    return {
      tick(dt) {
        if (up === 0) return null;
        if (up === 1) { t += dt; tilt.rotation.x = -1.45 * Math.max(0, 1 - t / 0.6); if (t >= 0.6) { up = 2; off(); line('signGo', T.sign.go, 2.6); sfx('beep', false); } return null; }
        if (!dog) { // 뒤에서 첫 광견병 들개
          const bx = player.pos.x - Math.sin(player.heading) * SG.back, bz = player.pos.z - Math.cos(player.heading) * SG.back;
          const p = okAt(bx, bz) ? { x: bx, z: bz } : spotNear([10, 18]); if (!p) return 'done';
          dog = life.enemies.spawnStory('rabid', p.x, p.z, { id: 'sign' }); dog.state = 'charge'; dog.st = 0; glance(p.x, p.z, 1.4);
        }
        return !life.enemies.list.includes(dog) || dog.state === 'flee' || dog.state === 'leave' ? 'done' : null;
      },
      stop() { off(); if (up < 2) fxG.remove(g); }, // 세운 표지판은 그 자리에 남김 (다시 들어오면 없음)
    };
  },
  ufo() {
    const U = STORY.ufo, at = spotNear([U.d * 0.8, U.d * 1.2], { ok: (x, z) => !spots.inBounds || spots.inBounds(x, z) }); if (!at) return null;
    const ufo = makeUfo(U.k), gy = height(at.x, at.z), arena = field?.bosses?.find((b) => b.zone === 5);
    let t = 0, poured = 0; omen('ufo', T.ufo.omen, at, 3);
    ufo.root.position.set(at.x, gy + 60, at.z);
    return {
      tick(dt) {
        t += dt; const T0 = U.t;
        const down = Math.min(1, t / 2.2), leave = Math.max(0, (t - T0) / 3);
        ufo.root.position.y = gy + U.y + (60 - U.y) * (1 - down) * (1 - down) + leave * leave * 50; ufo.root.rotation.y += dt * 1.2;
        if (arena && leave > 0) { ufo.root.position.x += (arena.x - ufo.root.position.x) * Math.min(1, dt * 0.6); ufo.root.position.z += (arena.z - ufo.root.position.z) * Math.min(1, dt * 0.6); }
        const pour = t > 2.2 && t < T0; ufo.setBeam(ufo.root.position.y - gy, pour ? 0.5 : 0);
        if (pour && poured < U.trash && t - 2.2 > poured * ((T0 - 2.4) / U.trash)) { poured++; trash?.drop(at.x + (Math.random() - 0.5) * 6, at.z + (Math.random() - 0.5) * 6, 1, 40); if (poured === 1) line('ufoGo', T.ufo.go, 2.8); if (poured === U.trash) trash?.store.commit(); }
        if (leave >= 1) { ufo.dispose(); line('ufoDone', T.ufo.done, 2.8); if (arena) glance(arena.x, arena.z, 2); return 'done'; }
        return null;
      },
      stop() { ufo.dispose(); },
    };
  },
  end() { // 엔딩 (game/ending.js): 방 전체 시네마틱. 끝나면 보상
    let fin = false;
    startEnding({ mine: true, onEnd: () => { fin = true; } });
    return { tick: () => (fin ? 'done' : null), stop() {} };
  },
};
let signTexC = null;
function signTex() {
  if (signTexC) return signTexC;
  const c = document.createElement('canvas'); c.width = 128; c.height = 84; const g = c.getContext('2d');
  g.fillStyle = '#f4d23a'; g.fillRect(0, 0, 128, 84); g.strokeStyle = '#2b2622'; g.lineWidth = 6; g.strokeRect(3, 3, 122, 78);
  g.fillStyle = '#2b2622'; g.font = '900 22px sans-serif'; g.textAlign = 'center'; g.fillText('광견병', 64, 36); g.fillText('주의', 64, 64);
  return (signTexC = new THREE.CanvasTexture(c));
}
function addCan(x, z) {
  putLoot('can', x, z, () => {
    const i = S.cans.findIndex((c) => Math.hypot(c[0] - x, c[1] - z) < 0.05); if (i >= 0) S.cans.splice(i, 1);
    sfx('coin');
    if (trash) { const isNew = trash.store.dexAdd(STORY_DEX.id); trash.store.commit(); const d = DEX_LIST.find((q) => q.id === STORY_DEX.id); if (isNew) line('can', T.night.can, 3.2); else if (d) onDexGet(d, false); }
    persist();
  });
}
function addBox(x, z) { putLoot('box', x, z, () => { S.box = null; addCoins(DEF.meet.gyul, '귤 상자'); persist(); }); }
for (const c of S.cans) addCan(c[0], c[1]);
if (S.box) addBox(S.box[0], S.box[1]);

// ---------- 차례 ----------
let cur = null, safeT = 0, retryT = 0, checkT = 0, lastZone = -1, wasNight = false, truckFree = false;
const hasTruckOk = () => isDoneId('truck') || cur?.id === 'truck' || !!save.pace?.hint?.t; // 트럭의 첫 등장은 '트럭이 온다' (옛 저장에서 트럭을 이미 본 사람은 그대로)
function fire(id) { // 조건이 맞음 → 줄에 섬
  if (!ON || !DEF[id] || isDoneId(id) || S.wait.includes(id) || cur?.id === id) return false;
  S.wait.push(id); S.wait.sort((a, b) => IDS.indexOf(a) - IDS.indexOf(b)); persist(); return true;
}
function safe() {
  return state.sessionOn && !document.hidden && !late.tut?.active && !panelOpen() && cam.mode === 'follow' && !hp.isDown && !hp.pending && !player.down && !player.cart && !player.rescue
    && !late.bossFight?.() && !(late.pace?.threat?.()) && (state.tension || 0) < 0.3 && !life.enemies.near(player.pos, 35) && !state.cine && !state.photoState && !state.fishing?.active;
}
function finish(why) {
  const id = cur.id, d = DEF[id]; const r = cur.r; cur = null; retryT = 0;
  if (why === 'fail') { r.stop(); if (!S.wait.includes(id)) S.wait.unshift(id); retryT = STORY.retry; persist(); return; } // 놓쳤으면 조금 뒤 다시
  r.stop?.();
  if (!S.done.includes(id)) S.done.push(id); persist();
  if (why === 'done') {
    if (d.gyul > 0 && id !== 'meet') addCoins(d.gyul, T[id]?.done || '이야기'); // 가족회의는 귤 상자가 보상
    else if (T[id]?.done && id !== 'night' && id !== 'pair' && id !== 'ufo') line(id + 'Done', T[id].done, 2.8);
    late.sound?.fanfare?.();
    // 가이드 퀘스트 (#158): balance.js QUESTS.side 'st-<id>' 가 이 이벤트를 끝냈는지(save.story.done) 보고 '오름지기에게 이야기하기' 를 엶
    if (id === 'end') late.titles?.give?.('은하 환경미화원'); // 칭호 (#165) 가 있으면
  }
}
function begin(id, force = false) {
  const r = RUN[id]?.(); if (!r) { retryT = 8; return false; }
  const i = S.wait.indexOf(id); if (i >= 0) S.wait.splice(i, 1);
  if (!force) { const d = dayOf(); if (S.day !== d) { S.day = d; S.n = 0; } S.n++; }
  cur = { id, r, t: 0 }; persist(); return true;
}
function tickStory(dt, time) {
  if (!ON) return;
  tickBubbles(dt); tickLoot(dt, time);
  if (cur) { cur.t += dt; let res = null; try { res = cur.r.tick(dt, time); } catch (e) { res = 'skip'; } if (res) finish(res); }
  if ((checkT -= dt) <= 0) { checkT = STORY.checkSec; poll(); }
  if (cur || !S.wait.length) { safeT = 0; return; }
  if ((retryT -= dt) > 0) return;
  safeT = safe() ? safeT + dt : 0;
  if (safeT < STORY.safeSec) return;
  const d = dayOf(); if (S.day !== d) { S.day = d; S.n = 0; }
  const next = S.wait.find((id) => doorOk(DEF[id]) && (id === 'end' || S.n < STORY.perDay)); // 엔딩은 하루 개수와 상관없이
  if (next && director.can('story')) { safeT = 0; begin(next); }
}
// 상태로 보는 조건 (1초마다): 밤의 불빛, 구역 4 에 들어섬, 구역 2 절반
function poll() {
  if (!state.sessionOn || late.tut?.active) return;
  const night = (sunState?.el ?? 30) < -4;
  if (night && !wasNight && isDone(1)) fire('night'); // 구역 1 우두머리를 쫓은 뒤 밤이 오면
  if (night && isDone(1) && !isDoneId('night')) fire('night');
  wasNight = night;
  const z = zoneOf(player.pos.x, player.pos.z);
  if (z === 4 && lastZone !== 4 && lastZone !== -1) fire('sign'); // 구역 4 에 들어서는 순간
  lastZone = z;
}

// ---------- 일어나는 일 (후크) ----------
if (ON) {
  const prev = life.hooks.enemyRepel;
  life.hooks.enemyRepel = (kind, pos, def, e) => {
    prev?.(kind, pos, def, e);
    if (e?.story) return; // 이야기 적은 조건을 다시 세지 않음
    if (kind === 'piglet' && life0('enemy-repel-piglet') >= DEF.mom.need.n) fire('mom');
    if (kind === 'boar' && life0('enemy-repel-boar') >= DEF.meet.need.n) fire('meet');
    if (kind === 'alien' && life0('enemy-repel-alien') >= DEF.ufo.need.n && !veilOn()) fire('ufo'); /* #207 불법 주차 단속은 단계 3 부터 */
    if (kind === 'dog' && e && e.pack > 0 && !life.enemies.list.some((o) => o !== e && o.pack === e.pack && o.state !== 'flee' && o.state !== 'leave')) fire('howl'); // 들개 무리 하나를 다 쫓음
  };
  if (dumpers) {
    const come0 = dumpers.come;
    dumpers.come = (kind, opts = {}) => { // 트럭의 첫 등장은 '트럭이 온다' 가 엶
      if (kind === 'truck' && !truckFree && !hasTruckOk()) { const { amt, ...o } = opts; return come0('walker', o); }
      return come0(kind, opts);
    };
  }
  trash.on((ev) => { if (ev !== 'trash' || !state.sessionOn || late.tut?.active) return; if (zoneOf(player.pos.x, player.pos.z) === 2 && trash.zoneClean(2) >= DEF.truck.need.clean) fire('truck'); });
}
// 투기꾼을 쫓아냄 (hooks.js dumpers repel 이 업적 'dumper-repel' 을 올린 뒤 부름). 3명째부터
function onDumperRepel() { if (life0('dumper-repel') >= DEF.pair.need.n) fire('pair'); }
// 구역 우두머리 (#139 boss.js 가 부름): 나타남·쫓아냄
late.story = {
  bossCome(z, name) {
    if (z === 3 && isDoneId('meet')) line('meetHost', `${name} · ${T.meet.host}`, 3);
    if (z === 5 && isDoneId('ufo')) line('ufoHost', `${name}${josaIGa(name)} UFO 에서 내렸어요!`, 3);
  },
  bossBeat(z) { if (z === 3) fire('tour'); if (z === 5) fire('end'); if (z === 1 && (sunState?.el ?? 30) < -4) fire('night'); },
  dumperRepel: onDumperRepel,
  get busy() { return !!cur; },
};

// ---------- 확인용 ----------
export const storyApi = {
  ids: IDS,
  // play(id): 조건·문·하루 개수와 상관없이 지금 바로 (이미 끝낸 것도 다시)
  play(id) { if (!RUN[id]) return false; if (cur) finish('skip'); const i = S.done.indexOf(id); if (i >= 0) S.done.splice(i, 1); return begin(id, true); },
  fire, state: () => ({ cur: cur?.id || null, t: cur ? +cur.t.toFixed(1) : 0, done: [...S.done], wait: [...S.wait], day: S.day, n: S.n, cans: S.cans.length, box: !!S.box, safe: safe(), loot: loot.length }),
  reset() { if (cur) { cur.r.stop(); cur = null; } S.done = []; S.wait = []; S.n = 0; S.cans = []; S.box = null; for (const o of loot.splice(0)) fxG.remove(o.m); persist(); },
  end: () => cur?.id && finish('done'),
  safe, enemies: () => life.enemies.list.filter((e) => e.story).map((e) => ({ id: e.story, kind: e.kind, name: e.def.name, hp: e.hp, state: e.state })),
  truckOk: hasTruckOk,
  mom: (dx = 0, dz = 18) => spawnMom({ x: player.pos.x + dx, z: player.pos.z + dz }), // tools/fight.js
};
late.tickStory = tickStory; late.storyApi = storyApi;
