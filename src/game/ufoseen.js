// UFO 드러남 단계 (#207): 초반엔 흔적만, 진행(끝낸 구역)에 따라 먼 불빛 → 실루엣 → 한 번 가까이 → 또렷이. 값은 balance.js UFO.reveal
// - 단계 셈을 src/ufoveil.js 에 건다 (외계인·드론·우두머리 빛 덩이, 쪽지·방송·혼잣말 낱말 거르기는 그쪽)
// - 하늘에 스치는 것: far(단계 0, 밤하늘 먼 불빛) · ridge(단계 1·2, 능선 너머 실루엣 + 먼 빛기둥) · close(단계 2, 한 번 머리 위, 그림자) · clear(단계 3 처음, 또렷이 한 번)
// - 아침의 흔적(단계 0·1): 하루 한 곳 풀이 둥글게 눌린 자리. 가까이 가면 혼잣말 '어제는 없던 쓰레긴데…' (mutter.js oddTrash)
// - 내 화면에만 (멀티로 보내지 않음). 저장 save.ufo = { close, clear, trace: { d, x, z, said } }
// dev: __oreum.ufoSeen.stage() · set(n) (null 이면 진행대로) · play('far'|'ridge'|'close'|'clear') · state() · trace()
import * as THREE from 'three';
import { UFO } from '../balance.js';
import { kstDate } from '../daily.js';
import { height } from '../world.js';
import { drape } from '../drape.js';
import { LOW } from '../gfx2.js';
import { setRevealStage, revealStage, glowSpr } from '../ufoveil.js';
import { state, late } from './state.js';
import { save, persist } from './save.js';
import { scene, camera, spots, sunState } from './scene.js';
import { player, trash } from './place.js';
import { sound } from './hooks.js';
import { makeUfo } from './ending.js';

const R = UFO.reveal, ON = !!trash;
const S = (() => {
  let s = save.ufo;
  if (!s || typeof s !== 'object' || Array.isArray(s)) s = save.ufo = {};
  s.close = s.close ? 1 : 0; s.clear = s.clear ? 1 : 0;
  const t = s.trace;
  s.trace = t && typeof t === 'object' && typeof t.d === 'string' && Number.isFinite(t.x) && Number.isFinite(t.z) ? { d: t.d, x: t.x, z: t.z, said: t.said ? 1 : 0 } : null;
  return s;
})();
let force = null;
const zonesDone = () => Object.values(save.boss?.done || {}).filter((n) => n > 0).length;
function stageNow() { if (force != null) return force; if (!ON) return 3; const b = R.byDone; return b[Math.min(b.length - 1, zonesDone())]; }
setRevealStage(stageNow);
if (Array.isArray(save.story?.done) && save.story.done.includes('ufo')) S.clear = 1; /* 불법 주차 단속에서 이미 또렷이 봄 */

const rr = ([a, b]) => a + Math.random() * (b - a);
const G = new THREE.Group(); G.userData.noCull = true; scene.add(G);
const night = () => (sunState?.el ?? 30) < -4;
const okTime = () => ON && state.sessionOn && !!save.tut?.done && !late.tut?.active && !state.cave && !state.cine;
const fwd = new THREE.Vector3();
function lookDir(spread) { camera.getWorldDirection(fwd); return Math.atan2(fwd.x, fwd.z) + (Math.random() - 0.5) * 2 * spread; }

// ---------- 모양 ----------
// 아래에서 본 원반 (덮개·조종석 없음): 납작한 몸 + 배 빛 + 테두리 불빛. dark 면 실루엣(흐린 한 색)
function disc(k, { dark = false, op = 1 } = {}) {
  const root = new THREE.Group(), mats = [];
  const mat = (o) => { const m = new THREE.MeshBasicMaterial({ transparent: op < 1, opacity: op, depthWrite: op >= 1, ...o }); mats.push(m); return m; };
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 8), mat({ color: dark ? '#39404a' : '#5d6863' })); body.scale.set(1, 0.2, 1); root.add(body);
  const belly = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 0.07, 14), mat({ color: dark ? '#2e343c' : '#46504c' })); belly.position.y = -0.1; root.add(belly);
  if (!dark) for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, l = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), mat({ color: '#ffe27a', fog: false })); l.position.set(Math.cos(a) * 0.43, -0.02, Math.sin(a) * 0.43); root.add(l); }
  const halo = glowSpr(dark ? '#d8f0ff' : '#b8ffd8', dark ? 1.9 : 0.9, dark ? 0.22 : 0.5); halo.position.y = dark ? 0 : -0.14; root.add(halo); mats.push(halo.material);
  root.scale.setScalar(k);
  return { root, halo, fade(a) { for (const m of mats) { m.userData.op0 ??= m.opacity; m.opacity = m.userData.op0 * a; } }, dispose() { root.traverse((o) => { o.geometry?.dispose(); }); for (const m of mats) m.dispose(); } };
}
const beamMat = new THREE.MeshBasicMaterial({ color: '#c9ffb8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
const beamGeo = new THREE.ConeGeometry(1, 1, 12, 1, true).translate(0, -0.5, 0);

// ---------- 지나가는 것 하나 ----------
let run = null; /* 지금 지나가는 것: kind·t·T·tick·stop */
function pathAt(a, d, side) { return { x: player.pos.x + Math.sin(a) * d, z: player.pos.z + Math.cos(a) * d, tx: Math.cos(a) * side, tz: -Math.sin(a) * side }; }
const PLAY = {
  far() { // 밤하늘 먼 불빛: 빛 하나가 천천히 옆으로
    const F = R.far, a = lookDir(0.8), p = pathAt(a, rr(F.dist), Math.random() < 0.5 ? 1 : -1), y = player.pos.y + rr(F.up), T = rr(F.sec), L = 70;
    const s = glowSpr('#fff3c8', F.size, 0); s.material.fog = false; G.add(s);
    return { T, tick(u) { s.position.set(p.x + p.tx * L * (u - 0.5), y + u * 6, p.z + p.tz * L * (u - 0.5)); s.material.opacity = Math.sin(Math.PI * u) * 0.9; }, stop() { G.remove(s); s.material.dispose(); } };
  },
  ridge() { // 능선 너머 실루엣: 흐린 원반이 옆으로 스치고, 가운데쯤 먼 땅에 빛기둥이 잠깐
    const Rg = R.ridge, a = lookDir(0.6), d = Math.max(Rg.min, rr(Rg.dist)), p = pathAt(a, d, Math.random() < 0.5 ? 1 : -1), T = rr(Rg.sec), L = 90;
    const top = Math.max(height(p.x, p.z), player.pos.y) + rr(Rg.up), u0 = disc(Rg.k, { dark: true, op: Rg.op }); G.add(u0.root);
    const beam = new THREE.Mesh(beamGeo, beamMat.clone()); beam.visible = false; G.add(beam);
    let gone = 1; sound.ufo?.();
    return {
      T,
      tick(u, dt) {
        const x = p.x + p.tx * L * (u - 0.5), z = p.z + p.tz * L * (u - 0.5); u0.root.position.set(x, top + Math.sin(u * 9) * 0.6, z);
        const near = Math.hypot(x - player.pos.x, z - player.pos.z) < Rg.gone; gone = Math.max(0, Math.min(1, gone + (near ? -dt * 2 : dt))); /* 다가가면 사라짐 */
        u0.fade(Math.min(1, Math.sin(Math.PI * u) * 2.2) * gone);
        const mid = Rg.beam / T / 2, bk = Math.max(0, 1 - Math.abs(u - 0.5) / mid);
        const gy = height(x, z), len = Math.max(1, top - gy);
        beam.visible = bk > 0.01 && gone > 0.05; beam.position.set(x, top, z); beam.scale.set(Rg.k * 0.35, len, Rg.k * 0.35); beam.material.opacity = 0.22 * bk * gone;
      },
      stop() { G.remove(u0.root); u0.dispose(); G.remove(beam); beam.material.dispose(); },
    };
  },
  close() { // 한 번 머리 위로: 아래에서 본 원반과 빛만, 땅에 큰 그림자가 지나감
    const C = R.close, a = lookDir(0.2) + Math.PI, T = C.sec, side = 0;
    const from = pathAt(a, C.len / 2, side), to = pathAt(a + Math.PI, C.len / 2, side), u0 = disc(C.k); G.add(u0.root);
    const sh = new THREE.Mesh(new THREE.CircleGeometry(C.k * 0.5, 28, 0).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#0d1410', transparent: true, opacity: 0, depthWrite: false })); sh.renderOrder = 1; G.add(sh);
    const place = LOW ? null : drape(sh, height, 0.1); sound.ufo?.();
    return {
      T,
      tick(u) {
        const sm = u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u), x = from.x + (to.x - from.x) * sm, z = from.z + (to.z - from.z) * sm;
        u0.root.position.set(x, height(x, z) + C.up, z); u0.root.rotation.y += 0.01;
        if (place) place(x, z); else sh.position.set(x, height(x, z) + 0.15, z);
        sh.material.opacity = C.shadow * Math.min(1, Math.sin(Math.PI * u) * 3);
        if (Math.abs(u - 0.5) < 0.02) sound.ufo?.();
      },
      stop() { G.remove(u0.root); u0.dispose(); G.remove(sh); sh.geometry.dispose(); sh.material.dispose(); },
    };
  },
  clear() { // 단계 3 처음: 지금의 비행접시를 또렷이 (낮게 지나가며 빛기둥 한 번)
    const C = R.clear, a = lookDir(0.15), c = pathAt(a, C.ahead, 0), T = C.sec, px = Math.cos(a) * C.len / 2, pz = -Math.sin(a) * C.len / 2; /* 앞쪽 ahead m 을 옆으로 가로지름 */
    const from = { x: c.x - px, z: c.z - pz }, to = { x: c.x + px, z: c.z + pz }, f = makeUfo(C.k, G, false); sound.ufo?.();
    return {
      T,
      tick(u) {
        const x = from.x + (to.x - from.x) * u, z = from.z + (to.z - from.z) * u, gy = height(x, z);
        f.root.position.set(x, gy + C.up + Math.sin(u * 12) * 0.5, z); f.root.rotation.y += 0.02;
        f.setBeam(C.up, C.beam * Math.max(0, 1 - Math.abs(u - 0.5) * 5));
      },
      stop() { f.dispose(); },
    };
  },
};
function start(kind) { if (run) { run.stop(); run = null; } const r = PLAY[kind]?.(); if (!r) return false; run = { kind, t: 0, ...r }; return true; }

// ---------- 차례 ----------
const wait = { far: rr(R.far.first), ridge: rr(R.ridge.first), close: null, clear: null };
let chk = 0, last = -1;
function schedule(st) {
  if (st !== last) { last = st; wait.close = rr(R.close.after); wait.clear = rr(R.clear.after); } /* 단계에 든 뒤 after 초 */
}
function pick(st, dt) {
  const due = (k) => (wait[k] -= dt) <= 0;
  if (R.clear.stages.includes(st) && !S.clear && due('clear')) { S.clear = 1; persist(); return 'clear'; }
  if (R.close.stages.includes(st) && !S.close && due('close')) { S.close = 1; persist(); return 'close'; }
  if (R.ridge.stages.includes(st) && due('ridge')) { wait.ridge = rr(R.ridge.every); return 'ridge'; }
  if (R.far.stages.includes(st) && (!R.far.night || night()) && due('far')) { wait.far = rr(R.far.every); return 'far'; }
  return null;
}

// ---------- 아침의 흔적 ----------
let ring = null, ringAt = null;
function ringMesh() {
  const g = new THREE.Group();
  const m1 = new THREE.Mesh(new THREE.RingGeometry(0.62, 1, 32, 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#6a7a36', transparent: true, opacity: 0.62, depthWrite: false }));
  const m2 = new THREE.Mesh(new THREE.CircleGeometry(0.62, 28, 0).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#a6b06a', transparent: true, opacity: 0.35, depthWrite: false }));
  m1.renderOrder = m2.renderOrder = 1; g.add(m1, m2);
  return { g, p1: drape(m1, height, 0.05), p2: drape(m2, height, 0.04) };
}
function showTrace() {
  const t = S.trace, on = !!t && t.d === kstDate() && R.trace.stages.includes(stageNow());
  if (!on) { if (ring) ring.g.visible = false; return; }
  if (!ring) { ring = ringMesh(); G.add(ring.g); }
  ring.g.visible = true;
  if (ringAt !== t) { ringAt = t; ring.p1(t.x, t.z, R.trace.r); ring.p2(t.x, t.z, R.trace.r); }
}
function placeTrace() {
  if (!R.trace.stages.includes(stageNow()) || (S.trace && S.trace.d === kstDate())) return;
  const zp = trash.zoneAt(player.pos.x, player.pos.z) || 0, list = trash.heaps.filter((h) => h.st >= 0 && !h.field && h.zone >= 1 && (!zp || h.zone === zp));
  for (let k = 0; k < 12 && list.length; k++) {
    const h = list[Math.floor(Math.random() * list.length)], a = Math.random() * Math.PI * 2, d = (h.r || 0) + rr(R.trace.off), x = h.x + Math.sin(a) * d, z = h.z + Math.cos(a) * d;
    if (spots.inBounds && !spots.inBounds(x, z)) continue;
    S.trace = { d: kstDate(), x: +x.toFixed(1), z: +z.toFixed(1), said: 0 }; persist(); return;
  }
}
function nearTrace() {
  const t = S.trace; if (!t || t.said || t.d !== kstDate() || !R.trace.stages.includes(stageNow())) return;
  if (Math.hypot(t.x - player.pos.x, t.z - player.pos.z) < R.trace.near) { t.said = 1; persist(); late.mutterEv?.('oddTrash'); }
}

late.tickUfoSeen = (dt) => {
  state.ticks.ufoseen++;
  if (run) {
    run.t += dt; const u = Math.min(1, run.t / run.T);
    if (!okTime() && !run.dev) { run.stop(); run = null; } else { run.tick(u, dt); if (u >= 1) { run.stop(); run = null; } }
  }
  if ((chk -= dt) > 0) return; chk = R.checkSec;
  if (!ON) return;
  const st = stageNow(); schedule(st);
  if (okTime()) { placeTrace(); nearTrace(); if (!run) { const k = pick(st, R.checkSec); if (k) start(k); } }
  showTrace();
};

late.ufoSeenApi = {
  stage: stageNow, veil: () => revealStage() < 3,
  set(n) { force = n == null ? null : Math.max(0, Math.min(3, n | 0)); return stageNow(); },
  play(k) { const ok = start(k); if (ok) run.dev = true; return ok; },
  state: () => ({ stage: stageNow(), done: zonesDone(), run: run && { kind: run.kind, t: +run.t.toFixed(1), T: +run.T.toFixed(1) }, wait: Object.fromEntries(Object.entries(wait).map(([k, v]) => [k, v == null ? null : +v.toFixed(1)])), close: S.close, clear: S.clear, trace: S.trace && { ...S.trace }, ring: !!ring?.g.visible }),
  trace(x, z) { S.trace = { d: kstDate(), x: x ?? +(player.pos.x + 4).toFixed(1), z: z ?? +player.pos.z.toFixed(1), said: 0 }; persist(); ringAt = null; showTrace(); return { ...S.trace }; },
  reset() { S.close = S.clear = 0; S.trace = null; force = null; last = -1; persist(); },
};
