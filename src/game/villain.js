// 투기꾼 다시 그리기 (#291): 걷는 투기꾼(dumpers.js walker)을 한눈에 '얄미운 악당' 으로. 새 모델 없이 지금 캐릭터(buildRunner)에 옷·소품·동작 (오름지기 #282 와 같은 방식)
// - 안 셋 (DUMP.look.style): A 만화 도둑(검은 비니·눈 복면·줄무늬 긴팔·어깨에 멘 쓰레기 자루) · B 후드·선글라스·흰 마스크(손에 검은 봉투) · C 중절모·트렌치코트·검은 봉지 여럿
//   실제 직업(환경미화원·택배 등)을 떠올리게 하는 차림은 쓰지 않음. 무섭기보다 얄밉게
// - 동작(dumpers.js 가 d.anim 으로 부름): 살금살금(숙이고 두리번) → 더미 앞에서 크게 두리번 → 자루를 휙 던짐(날아가는 자루) → 돌아감
//   맞으면 화들짝(두 손 번쩍, 눈 크게) → 자루를 떨구고 줄행랑(뛰기) → 사라지며 주먹을 흔듦. 밤에는 손전등을 손으로 가리고 다님(새는 빛만 조금)
// - 이야기 '망보는 짝'(d.lookout)은 모자·줄무늬 색만 다르게. 트럭은 그대로. 흡연자(#156)·관광객(#163)은 예전 상자 모양(buildWalker) 그대로
// - 산타 투기꾼(#180, game/season.js dress): d.villain.santa() 가 산타 모자·빨간 외투·바지·선물 자루로
// 바꾸는 법: src/balance.js DUMP.look.style 를 'A'·'B'·'C' 중 하나로 ('' 면 예전 상자 모양). dev: __oreum.villain (set('B')·style·lineup()·clear()·spawn()·state())
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { DUMP } from '../balance.js';
import { ACCESSORIES } from '../gear.js';
import { CLOTH_BUILD, COVER, HC } from '../clothes.js';
import { gradHard } from '../toon.js';
import { LOW } from '../gfx2.js';
import { buildRunner, DEFAULT_OUTFIT } from '../runner.js';
import { glowSprite } from '../propmodel.js';
import { height } from '../world.js';
import { late } from './state.js';
import { scene, sunState } from './scene.js';
import { player } from './place.js';

const L = DUMP.look;
const M = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
const G = (...ms) => { const g = new THREE.Group(); ms.flat(3).forEach((m) => m && g.add(m)); return g; };
const toon = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: gradHard });

/* ---------- 안 ---------- */
const STYLE = {
  A: { name: '만화 도둑', top: '#2a2f3a', stripe: '#eeeae0', stripes: 4, pants: '#30343c', shoes: '#22242a', hat: 'beanie', hatC: '#1d1f24', mask: 'eye', bag: 'sack', sackC: '#8f7a55', lookC: '#a8323a' },
  B: { name: '후드', top: '#3d4552', stripe: '#3d4552', stripes: 0, hood: true, pants: '#2c3038', shoes: '#22242a', hat: 'none', mask: 'mouth', glasses: true, bag: 'hand', lookC: '#5a3f7a' },
  C: { name: '트렌치코트', top: '#c9b48a', stripe: '#8a7552', stripes: 0, coat: true, pants: '#3a3a40', shoes: '#2a2420', hat: 'fedora', hatC: '#3b3530', mask: 'none', glasses: true, bag: 'many', lookC: '#6a2f2f' },
};
let style = STYLE[L.style] ? L.style : '';
const S = () => STYLE[style];

/* ---------- 장비 칸 것 (모델 좌표, 키 0.98. 머리 가운데 HC) ---------- */
function hatMesh(mat, st, kind) {
  const C = mat('main', kind === 'look' ? st.lookC : st.hatC || '#1d1f24');
  if (st.hat === 'beanie') { /* 니트 비니: 머리를 덮는 반구 + 접은 단 */
    const d = M(new THREE.SphereGeometry(0.262, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), C, 0, HC.y - 0.015, HC.z); d.scale.set(1, 0.9, 1.07);
    const cuff = M(new THREE.CylinderGeometry(0.268, 0.268, 0.07, 20, 1, true), mat('cuff', new THREE.Color(st.hatC).multiplyScalar(1.4).getStyle()), 0, HC.y + 0.005, HC.z); cuff.scale.z = 1.07;
    return G(d, cuff);
  }
  if (st.hat === 'fedora') { /* 중절모: 높은 통(가운데 눌림) + 넓은 챙 + 띠 */
    const crown = M(new THREE.CylinderGeometry(0.2, 0.235, 0.2, 18), C, 0, HC.y + 0.16, HC.z); crown.scale.z = 1.08;
    const dent = M(new THREE.BoxGeometry(0.05, 0.03, 0.3), mat('dent', '#2a2622'), 0, HC.y + 0.262, HC.z);
    const brim = M(new THREE.CylinderGeometry(0.36, 0.36, 0.025, 22), C, 0, HC.y + 0.065, HC.z + 0.01); brim.scale.z = 1.1; brim.rotation.x = 0.08;
    const band = M(new THREE.CylinderGeometry(0.237, 0.237, 0.045, 18, 1, true), mat('band', '#1a1714'), 0, HC.y + 0.09, HC.z); band.scale.z = 1.08;
    return G(crown, dent, brim, band);
  }
  return new THREE.Group();
}
function faceMesh(mat, st) {
  const out = [];
  if (st.mask === 'eye') { /* 만화 도둑 눈 복면: 눈가를 가로지르는 검은 띠 + 하얀 눈 + 뒤 매듭 */
    const B = mat('mask', '#15161a'), W = mat('eyeW', '#ffffff'), K = mat('eyeK', '#15161a');
    const band = M(new THREE.CylinderGeometry(0.262, 0.262, 0.085, 22, 1, true), B, 0, 0.718, HC.z); band.scale.z = 1.1; out.push(band);
    for (const s of [-1, 1]) { const e = M(new THREE.SphereGeometry(0.036, 10, 8), W, s * 0.085, 0.72, 0.29); e.scale.set(1.15, 0.85, 0.4); out.push(e, M(new THREE.SphereGeometry(0.016, 8, 6), K, s * 0.08, 0.715, 0.305)); }
    const knot = M(new THREE.SphereGeometry(0.035, 8, 6), B, 0, 0.72, HC.z - 0.29); out.push(knot);
    for (const s of [-1, 1]) { const t = M(new THREE.BoxGeometry(0.03, 0.11, 0.012), B, s * 0.03, 0.66, HC.z - 0.3); t.rotation.z = s * 0.35; out.push(t); }
  }
  if (st.mask === 'mouth') { const m = M(new RoundedBoxGeometry(0.22, 0.11, 0.05, 2, 0.02), mat('mask', '#f2f2ee'), 0, 0.63, 0.265); out.push(m); }
  if (st.glasses) { const lens = mat('lens', '#15171c'); for (const s of [-1, 1]) { const g = M(new RoundedBoxGeometry(0.14, 0.075, 0.03, 3, 0.025), lens, s * 0.09, 0.718, 0.275); g.rotation.y = s * 0.28; out.push(g); } out.push(M(new THREE.BoxGeometry(0.06, 0.016, 0.02), lens, 0, 0.73, 0.29)); }
  return G(out);
}
// 트렌치코트 자락 (엉덩이 아래로 퍼짐) + 허리띠
function coatSkirt(mat, st) {
  const C = mat('main', st.top), K = mat('acc', st.stripe);
  const sk = M(new THREE.CylinderGeometry(0.19, 0.25, 0.2, 16, 1, true), C, 0, 0.24, 0.0); sk.material.side = THREE.DoubleSide; sk.scale.z = 0.9;
  const belt = M(new THREE.CylinderGeometry(0.185, 0.185, 0.035, 16, 1, true), K, 0, 0.345, 0.0); belt.scale.z = 0.92;
  return G(sk, belt);
}
function define(st, sk) {
  const k = 'vil' + sk;
  ACCESSORIES['top:' + k] = { slot: 'top', label: '악당 긴팔', skin: true, covers: COVER.teeLong, npc: true, build: (mat) => CLOTH_BUILD.tee(mat, { long: true, main: st.top, acc: st.stripe, stripes: st.stripes }) };
  ACCESSORIES['top:' + k + 'L'] = { ...ACCESSORIES['top:' + k], build: (mat) => CLOTH_BUILD.tee(mat, { long: true, main: st.top, acc: st.lookC, stripes: st.stripes }) }; /* 망보는 짝 */
  ACCESSORIES['bottom:' + k] = { slot: 'bottom', label: '악당 바지', skin: true, covers: COVER.long, npc: true, build: (mat) => CLOTH_BUILD.long(mat, { kind: 'long', main: st.pants, acc: st.pants }) };
  ACCESSORIES['shoes:' + k] = { slot: 'shoes', label: '악당 신발', skin: true, covers: COVER.boots, npc: true, build: (mat) => CLOTH_BUILD.boots(mat, { kind: 'boots', main: st.shoes, acc: '#15161a' }) };
  ACCESSORIES['hat:' + k] = { slot: 'hat', label: '악당 모자', bone: 'head', clip: 0.97, hide: ['hat'], npc: true, build: (mat) => hatMesh(mat, st) };
  ACCESSORIES['hat:' + k + 'L'] = { ...ACCESSORIES['hat:' + k], build: (mat) => hatMesh(mat, st, 'look') };
  ACCESSORIES['face:' + k] = { slot: 'face', label: '악당 얼굴', bone: 'head', npc: true, build: (mat) => faceMesh(mat, st) };
  ACCESSORIES['jacket:' + k] = st.hood || st.coat ? { slot: 'jacket', label: st.coat ? '트렌치코트' : '후드', skin: true, covers: COVER.jacket, npc: true, build: (mat) => { const g = CLOTH_BUILD.jacket(mat, { main: st.top, acc: st.stripe, hood: !!st.hood, cuffs: !!st.coat }); if (st.coat) g.add(coatSkirt(mat, st)); return g; } } : ACCESSORIES['jacket:none'];
  return (look) => ({ hair: 'hair:base', hat: st.hat === 'none' ? 'hat:none' : 'hat:' + k + (look ? 'L' : ''), face: 'face:' + k, back: 'back:none', top: 'top:' + k + (look ? 'L' : ''), bottom: 'bottom:' + k, vest: 'vest:none', jacket: st.hood || st.coat ? 'jacket:' + k : 'jacket:none', socks: 'socks:none', shoes: 'shoes:' + k, hand: 'hand:none' });
}
const GEAR = Object.fromEntries(Object.entries(STYLE).map(([k, st]) => [k, define(st, k)]));

/* ---------- 손에 든 것·어깨 자루 (뼈에 바로 붙임) ---------- */
const HAND_R = [-0.43, 0.505, 0.045], HAND_L = [0.43, 0.505, 0.045];
function jointOf(bone) { const j = new THREE.Vector3(); for (let b = bone; b && b.isBone; b = b.parent) j.add(b.position); return j; }
function attach(bone, at, rz = 0) { const p = new THREE.Group(); if (!bone) return p; const j = jointOf(bone); p.position.set(at[0] - j.x, at[1] - j.y, at[2] - j.z); p.rotation.z = rz; bone.add(p); return p; }
function bagMats(st) {
  return { body: toon(st.bag === 'sack' ? st.sackC : '#202126'), tie: toon(st.bag === 'sack' ? '#5e4d33' : '#2e2f35'), patch: toon('#c9b98a') };
}
// 모델 좌표 자루 (어깨 멘 것: 크고 울퉁불퉁 + 묶은 목 + 덧댄 천)
function sackModel(m, r = 0.2) {
  const g = new THREE.IcosahedronGeometry(r, 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + Math.sin(i * 12.9898) * 0.08; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 1.1, p.getZ(i) * k * 0.9); } g.computeVertexNormals();
  const body = M(g, m.body), neck = M(new THREE.CylinderGeometry(r * 0.22, r * 0.35, r * 0.4, 7), m.tie, 0, r * 1.15, 0), patch = M(new RoundedBoxGeometry(r * 0.5, r * 0.4, r * 0.06, 2, r * 0.05), m.patch, r * 0.2, -r * 0.1, r * 0.86);
  return G(body, neck, patch);
}
function plasticBag(m, r = 0.13) { const g = new THREE.IcosahedronGeometry(r, 0); g.scale(1, 1.15, 0.9); return G(M(g, m.body), M(new THREE.ConeGeometry(r * 0.3, r * 0.6, 5), m.body, 0, r * 1.2, 0)); }
function flashlight() {
  const body = M(new THREE.CylinderGeometry(0.022, 0.03, 0.14, 8), toon('#2b2d33')); body.rotation.x = Math.PI / 2;
  const lens = M(new THREE.CircleGeometry(0.03, 10), new THREE.MeshBasicMaterial({ color: '#fff4c8' }), 0, 0, 0.071);
  const glow = glowSprite('#ffe9a8', 0.5); glow.position.z = 0.09; glow.userData.sprite = true;
  return { g: G(body, lens, glow), glow };
}

/* ---------- 한 사람 만들기 (dumpers.js makeWalker) ---------- */
export function makeVillain(sk = style) {
  const st = STYLE[sk]; if (!st) return null;
  const run = buildRunner(), root = new THREE.Group(); root.add(run.root);
  run.apply({ ...DEFAULT_OUTFIT, hat: { type: 'none', color: '#000' }, glasses: { type: 'none' }, shirt: { type: 'long', color: st.top }, pants: { type: 'long', color: st.pants }, gear: GEAR[sk](false) });
  const B = (n) => run.root.getObjectByName(n);
  const m = bagMats(st);
  const chest = B('chest'), handR = attach(B('armR'), HAND_R, -Math.PI / 2), handL = attach(B('armL'), HAND_L, Math.PI / 2);
  // 던질 자루(= dumpers 의 bag): A 는 등 뒤 오른 어깨(손으로 잡고), B 는 오른손, C 는 오른손 + 왼손·등에 더
  const bag = new THREE.Group(), extra = [];
  if (st.bag === 'sack') { const sk2 = sackModel(m, 0.2); sk2.rotation.z = 0.5; bag.add(sk2); if (chest) { const j = jointOf(chest); bag.position.set(-j.x - 0.15, -j.y + 0.66, -j.z - 0.2); chest.add(bag); } } /* 오른 어깨 뒤에 멘 자루 (손은 자루 목을 잡음) */
  else { bag.add(plasticBag(m, 0.13)); bag.position.set(0, -0.12, 0.02); handR.add(bag); }
  if (st.bag === 'many') {
    const l = plasticBag(m, 0.11); l.position.set(0, -0.11, 0.02); handL.add(l); extra.push(l);
    if (chest) { const j = jointOf(chest), b2 = plasticBag(m, 0.12); b2.position.set(-j.x + 0.05, -j.y + 0.47, -j.z - 0.22); chest.add(b2); extra.push(b2); }
  }
  const fl = flashlight(); fl.g.position.set(0, -0.02, 0.05); fl.g.rotation.set(-0.3, 0, 0); handL.add(fl.g); fl.g.visible = false;
  run.root.traverse((x) => { if (x.isMesh && !x.material.blending) x.castShadow = !LOW; });
  const v = { st, sk, run, handR, handL, bag, extra, fl, t: Math.random() * 10, threw: false, fist: 0, look: false, santaOn: false };
  const d = { root, body: run.root, legs: [], arms: [], bag, h: 2.45, villain: null, dropMesh: () => dropMesh(st), anim: null };
  d.villain = { ...v, santa: (D) => santa(D || d), get style() { return sk; } }; /* dumpers.js 가 d 를 펼쳐 새 객체로 쓰므로 그 d 를 받음 */
  d.anim = (dt, time, D) => anim(D || d, dt, time);
  return d;
}
// 떨군 자루 (세상 크기)
function dropMesh(st) {
  const m = bagMats(st), g = st.bag === 'sack' ? sackModel(m, 0.2) : plasticBag(m, 0.13); g.scale.setScalar(2.5); return G(g);
}
function santa(d) {
  const r = d.villain.run, gear = { ...GEAR[d.villain.sk](false), hat: 'hat:x-santa', jacket: 'jacket:p-santa', bottom: 'bottom:p-santa', face: 'face:none' };
  r.apply({ ...DEFAULT_OUTFIT, shirt: { type: 'long', color: '#c8333a' }, pants: { type: 'long', color: '#b5333a' }, gear });
  const red = toon('#c8333a'), gold = toon('#f2c14e');
  d.bag.traverse((o) => { if (o.isMesh) o.material = o.geometry.type === 'CylinderGeometry' || o.geometry.type === 'ConeGeometry' ? gold : red; }); /* 선물 자루: 빨강 + 금빛 묶음 */
  d.villain.santaOn = true; d.santa = true;
}

/* ---------- 동작 ---------- */
const ss = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const mix = (o, w, x, y, z) => { o.rotation.x += (x - o.rotation.x) * w; o.rotation.y += (y - o.rotation.y) * w; o.rotation.z += (z - o.rotation.z) * w; };
const flying = [];
function throwSack(d) {
  const v = d.villain, h = d.heapPos; if (!h) return;
  const from = new THREE.Vector3(); v.bag.getWorldPosition(from);
  const g = dropMesh(v.st); g.position.copy(from); scene.add(g);
  const to = new THREE.Vector3(h.x, height(h.x, h.z) + 0.4, h.z);
  flying.push({ g, from, to, t: 0, T: 0.55 });
}
function tickFlying(dt) {
  for (let i = flying.length - 1; i >= 0; i--) {
    const f = flying[i]; f.t += dt; const u = Math.min(1, f.t / f.T);
    f.g.position.lerpVectors(f.from, f.to, u); f.g.position.y += Math.sin(u * Math.PI) * 2.2; f.g.rotation.x += dt * 9; f.g.rotation.z += dt * 5;
    if (u >= 1) { scene.remove(f.g); flying.splice(i, 1); }
  }
}
function anim(d, dt, time) {
  const v = d.villain; v.t += dt;
  if (d.lookout && !v.look && !v.santaOn) { v.look = true; v.run.apply({ ...DEFAULT_OUTFIT, shirt: { type: 'long', color: v.st.top }, pants: { type: 'long', color: v.st.pants }, gear: GEAR[v.sk](true) }); }
  const night = (sunState?.el ?? 30) < L.night, carrying = d.bag.visible;
  v.fl.g.visible = night && d.state !== 'startle'; if (v.fl.g.visible) v.fl.glow.material.opacity = 0.35 + Math.sin(v.t * 7) * 0.06;
  const st = d.state, u = st === 'dump' ? Math.min(1, d.st / DUMP.dumpT) : 0;
  if (st === 'dump' && !v.threw && u >= L.throwAt) { v.threw = true; throwSack(d); d.bag.visible = false; v.extra.forEach((x) => { x.visible = false; }); }
  if (st === 'come') v.threw = false;
  if (d.fade != null) v.fist = Math.min(1, v.fist + dt * 4);
  const running = st === 'flee', face = st === 'startle' ? 'wide' : null;
  v.run.animate(dt, { speed: d.speed, running, pose: 'move', t: v.t, air: false, jumpV: 0, face, post: (p) => pose(p, d, v, { u, night, carrying }) }); /* 자리·방향은 dumpers.js 가 d.root 에 */
}
function pose(p, d, v, { u, night, carrying }) {
  const { armL, armR, head, torso, hips } = p, t = v.t, st = d.state;
  // 어깨 자루를 오른손으로 받쳐 듦 (A), 봉투는 그냥 늘어뜨림
  if (carrying && v.st.bag === 'sack' && st !== 'startle') mix(armR, 1, -2.5, 0, 0.55);
  if (st === 'come') { /* 살금살금: 숙이고 무릎 굽히고 두리번, 왼손은 앞으로 (밤엔 손전등을 가림) */
    torso.rotation.x += L.sneak; hips.position.y -= 0.04; head.rotation.y = Math.sin(t * 1.6) * L.look * 0.6; head.rotation.x -= 0.1;
    mix(armL, 0.8, night ? -1.25 : -0.55, 0, night ? -0.35 : 0.1);
  } else if (st === 'dump') {
    if (u < 0.5) { head.rotation.y = Math.sin(t * 5) * L.look; torso.rotation.y = Math.sin(t * 5 + 0.6) * 0.2; torso.rotation.x += 0.1; }
    else if (u < L.throwAt) { const k = ss(0.5, L.throwAt, u); mix(armR, k, -3.1, 0, 0.3); torso.rotation.x -= 0.25 * k; torso.rotation.y += 0.35 * k; }
    else { const k = ss(L.throwAt, L.throwAt + 0.1, u) * (1 - ss(0.9, 1, u)); mix(armR, k, -1.1, 0, -0.2); torso.rotation.x += 0.35 * k; torso.rotation.y -= 0.3 * k; }
  } else if (st === 'startle') { /* 화들짝: 두 손 번쩍 */
    mix(armL, 1, -2.8, 0, -0.5); mix(armR, 1, -2.8, 0, 0.5); head.rotation.x = -0.25;
  } else if (st === 'flee' && d.fade == null) { torso.rotation.x += 0.2; head.rotation.y = Math.sin(t * 3) * 0.4; /* 뒤돌아보며 줄행랑 */ }
  if (v.fist > 0) { /* 멀리서 주먹을 흔듦 */ mix(armR, v.fist, -2.6 + Math.sin(t * 18) * 0.3, 0, 0.35); head.rotation.y += 0.6 * v.fist; }
}
late.villainTick = (dt) => { tickFlying(dt); for (const d of line) d.anim(dt, 0); }; /* 날아가는 자루·그림 찍기용 줄 (game/update.js) */

/* ---------- dumpers.js 가 부름 ---------- */
late.makeVillain = () => (style ? makeVillain(style) : null);

/* ---------- 확인용 (window.__oreum.villain) ---------- */
let line = [];
late.villainApi = {
  styles: Object.fromEntries(Object.entries(STYLE).map(([k, s]) => [k, s.name])),
  get style() { return style; },
  set: (k) => { style = STYLE[k] ? k : ''; return style; },
  /* 플레이어 앞에 셋을 나란히 (그림 찍기): state 'come'|'dump'|'startle'|'flee' 동작으로 */
  lineup: (state = 'come', keys = Object.keys(STYLE), gap = 2.4) => {
    late.villainApi.clear();
    const h = player.heading, fx = Math.sin(h), fz = Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h);
    keys.forEach((k, i) => {
      const d = makeVillain(k); const o = (i - (keys.length - 1) / 2) * gap, x = player.pos.x + fx * 6 + rx * o, z = player.pos.z + fz * 6 + rz * o;
      Object.assign(d, { kind: 'walker', state, st: state === 'dump' ? DUMP.dumpT * 0.62 : 0, speed: state === 'flee' ? 6 : state === 'come' ? 1.6 : 0, heapPos: { x: player.pos.x, z: player.pos.z } });
      d.pos = new THREE.Vector3(x, height(x, z), z); d.root.position.copy(d.pos); d.root.rotation.y = h + Math.PI; scene.add(d.root); line.push(d);
    });
    return line.length;
  },
  pose: (state, st = 0) => { for (const d of line) { d.state = state; d.st = st; d.speed = state === 'flee' ? 6 : state === 'come' ? 1.6 : 0; d.fade = state === 'fist' ? 1 : null; if (state === 'fist') d.state = 'flee'; } },
  tick: (dt = 1 / 30, n = 1) => { for (let i = 0; i < n; i++) for (const d of line) d.anim(dt, 0); },
  clear: () => { for (const d of line) scene.remove(d.root); line = []; },
  spawn: (k = style, opts = { heap: 0 }) => { const s = style; style = k; const d = late.dumpers?.come?.('walker', opts); style = s; return !!d; }, /* 더미가 가득이면 고를 곳이 없어 heap 을 줌 */
  state: () => ({ style, line: line.length, flying: flying.length, live: (late.dumpers?.list || []).filter((d) => d.villain).map((d) => ({ style: d.villain.style, state: d.state, bag: d.bag.visible, santa: !!d.santa })) }),
};
