// 귀한 귤 (#130): 쫓아낸 적·투기꾼이 흩뿌리는 귤 알갱이 하나가 가끔 한라봉·천혜향·레드향·황금향으로 바뀜
// 셈(확률·값)은 src/raregyul.js, 값·모양은 balance.js RARE_GYUL. hooks.js 의 적·투기꾼 쫓아냄이 late.rareDrop 을 부름
// 멀티: 적·투기꾼 귤처럼 쫓아낸 사람 화면에만 떨어지고 그 사람이 주움. 가진 귤·던지는 귤은 종류 없이 개수 하나 (save.coins)
// 처음 주운 종류는 도감 '귀한 귤' 칸 (trash.js DEX_LIST 'gyul:id'), 넷 다 모으면 업적 b-rare-gyul (사건 gyul-kind)
import * as THREE from 'three';
import { RARE_GYUL, TANGERINE as TG } from '../balance.js';
import { splitRare, rgDexId } from '../raregyul.js';
import { LOW } from '../gfx2.js';
import { height } from '../world.js';
import { DEX_LIST } from '../trash.js';
import { late } from './state.js';
import { save, persist } from './save.js';
import { scene } from './scene.js';
import { life, player, trash } from './place.js';
import { updateStats, pickMsg, onDexGet, ach } from './hud.js';
import { coinFx } from './hooks.js';

const F = RARE_GYUL.fly, TR = 0.16 * TG.scale;
const group = new THREE.Group(); group.name = 'raregyul'; scene.add(group);
const ball = new THREE.SphereGeometry(TR, 10, 8), knobG = new THREE.SphereGeometry(TR * 0.5, 8, 6);
const leafG = new THREE.PlaneGeometry(0.14 * TG.scale, 0.08 * TG.scale), leafM = new THREE.MeshLambertMaterial({ color: '#4f8a3a', side: THREE.DoubleSide });
const glowG = new THREE.CircleGeometry(TG.glowR, 16).rotateX(-Math.PI / 2);
const sparkG = new THREE.OctahedronGeometry(0.07, 0);
const pillarG = new THREE.CylinderGeometry(0.08, 0.3, 1, 10, 1, true); pillarG.translate(0, 0.5, 0);
const ringG = new THREE.RingGeometry(0.5, 0.7, 24).rotateX(-Math.PI / 2);
const add = (c, op) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
const LOOK = Object.fromEntries(RARE_GYUL.kinds.map((K) => [K.id, {
  body: new THREE.MeshLambertMaterial({ color: K.color, emissive: K.emissive, emissiveIntensity: K.emissiveI }),
  glow: new THREE.MeshBasicMaterial({ color: K.color, transparent: true, opacity: TG.glowOpacity * 1.3, depthWrite: false }),
  spark: add('#fff6c8', 0.95), pillar: add(K.color, LOW ? 0.26 : 0.38), ring: add(K.color, 0.8),
}]));

// 한 알: 몸(납작함·꼭지 혹)·잎·아래 빛 원·반짝이·빛기둥
function build(K) {
  const L = LOOK[K.id], o = new THREE.Group(), body = new THREE.Group(); o.add(body);
  const m = new THREE.Mesh(ball, L.body); m.scale.set(K.k, K.k * K.flatY, K.k); m.castShadow = !LOW; body.add(m);
  const top = TR * K.k * K.flatY;
  if (K.knob) { const kn = new THREE.Mesh(knobG, L.body); kn.scale.setScalar(K.k * K.knob * 1.6); kn.position.y = top * 0.92; body.add(kn); }
  const lf = new THREE.Mesh(leafG, leafM); lf.position.y = top + (K.knob ? TR * K.k * K.knob * 0.7 : 0) + 0.01; lf.rotation.x = -1; body.add(lf);
  const glow = new THREE.Mesh(glowG, L.glow); glow.scale.setScalar(K.glow); glow.renderOrder = 1; glow.visible = false; o.add(glow);
  const sparks = []; for (let i = 0; i < (LOW ? Math.min(2, K.sparkle) : K.sparkle); i++) { const sp = new THREE.Mesh(sparkG, L.spark); sp.renderOrder = 4; o.add(sp); sparks.push(sp); }
  let pillar = null; if (K.pillar) { pillar = new THREE.Mesh(pillarG, L.pillar); pillar.scale.set(1, K.pillar, 1); pillar.renderOrder = 4; pillar.visible = false; o.add(pillar); }
  return { o, body, glow, sparks, pillar };
}

const list = [];
const v = new THREE.Vector3();
// 떨굼: pos 자리에서 튀어 오름
function spawn(K, val, pos) {
  const b = build(K); b.o.position.set(pos.x, pos.y + 1, pos.z); group.add(b.o);
  const a = Math.random() * Math.PI * 2, sp = F.spread[0] + Math.random() * (F.spread[1] - F.spread[0]);
  list.push({ ...b, K, val, t: 0, ph: Math.random() * 6.28, vel: new THREE.Vector3(Math.sin(a) * sp, F.up[0] + Math.random() * (F.up[1] - F.up[0]), Math.cos(a) * sp), ground: false, fly: false, gy: 0 });
  if (K.coins >= 4) late.sound?.coin?.(); // 레드향·황금향은 떨어질 때도 '짤랑'
}
// 주움: 귤 + 효과·소리(귀할수록 큼) + 줍기 줄 + 도감·업적
const pops = [];
function give(d) {
  const { K, val } = d, at = d.o.position.clone();
  save.coins += val; persist(); updateStats(); coinFx(at, val);
  for (let i = 0; i < K.coins; i++) setTimeout(() => late.sound?.coin?.(), i * 85);
  if (K.coins >= 3 && !LOW) { const r = new THREE.Mesh(ringG, LOOK[K.id].ring.clone()); r.position.set(player.pos.x, player.pos.y + 0.08, player.pos.z); r.renderOrder = 4; group.add(r); pops.push({ r, t: 0, s: 1 + K.coins * 0.35 }); }
  pickMsg(K.name, `${K.name}! 귤 +${val.toLocaleString('ko-KR')}`);
  if (trash) {
    const id = rgDexId(K.id), dx = DEX_LIST.find((x) => x.id === id), isNew = trash.store.dexAdd(id); trash.store.commit();
    if (isNew && dx) { onDexGet(dx, true); ach.emit('gyul-kind'); }
  }
  late.rareGot?.(K, val);
}
function drop(i) { const d = list[i]; group.remove(d.o); list.splice(i, 1); }

export function tickRare(dt) {
  for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.t += dt; const k = p.t / 0.5; p.r.scale.setScalar(1 + k * p.s); p.r.material.opacity = 0.8 * (1 - k); if (k >= 1) { group.remove(p.r); p.r.material.dispose(); pops.splice(i, 1); } } // 주울 때 퍼지는 링
  if (!list.length) return;
  const P = player.pos, R2 = life.hooks.pickR2?.() || 1.6;
  for (let i = list.length - 1; i >= 0; i--) {
    const d = list[i], o = d.o; d.t += dt;
    if (d.t > F.life) { drop(i); continue; }
    d.body.rotation.y += TG.spin * 1.4 * dt;
    d.sparks.forEach((s, k) => { const a = d.t * 2.2 + k * 6.283 / d.sparks.length; s.position.set(Math.sin(a) * 0.42, 0.3 + Math.sin(d.t * 3 + k) * 0.15, Math.cos(a) * 0.42); s.scale.setScalar(0.6 + 0.6 * Math.abs(Math.sin(d.t * 5 + k * 2))); s.rotation.y = d.t * 4; });
    const dx = P.x - o.position.x, dz = P.z - o.position.z;
    if (!d.fly && d.t > F.magnetT && (dx * dx + dz * dz < R2 || d.t > F.autoT)) { d.fly = true; d.glow.visible = false; if (d.pillar) d.pillar.visible = false; }
    if (d.fly) {
      v.set(P.x - o.position.x, P.y + 1 - o.position.y, P.z - o.position.z); const L = v.length();
      const sp = F.fly * Math.min(3, 0.6 + d.t * 0.5) * (d.t > F.autoT ? 2.5 : 1);
      if (L < 0.5 || L < sp * dt) { drop(i); give(d); continue; }
      o.position.addScaledVector(v, Math.min(1, sp * dt / L)); continue;
    }
    if (!d.ground) {
      d.vel.y -= F.grav * dt; o.position.addScaledVector(d.vel, dt);
      const gy = height(o.position.x, o.position.z) + TR * d.K.k * d.K.flatY;
      if (o.position.y <= gy && d.vel.y < 0) { o.position.y = gy; d.gy = gy; d.ground = true; d.glow.visible = true; if (d.pillar) d.pillar.visible = true; }
      continue;
    }
    d.body.position.y = TG.hover + Math.sin(d.t * TG.bobSpeed + d.ph) * TG.bob * 1.5;
    d.glow.position.y = -TR * d.K.k * d.K.flatY + 0.03;
    if (d.pillar) { d.pillar.position.y = d.glow.position.y; d.pillar.material.opacity = (LOW ? 0.26 : 0.38) * (0.75 + 0.25 * Math.sin(d.t * 3)); }
  }
}

// 쫓아낸 귤 reward 를 나눠 귀한 귤이 나오면 떨구고, 보통으로 흩뿌릴 귤 수를 돌려줌 (hooks.js)
export function rareDrop(who, pos, reward, maxN = Infinity) {
  const s = splitRare(who, reward, maxN); if (!s.kind) return reward;
  spawn(s.kind, s.v, pos); return s.rest;
}
late.rareDrop = rareDrop; late.tickRare = tickRare;
// 정해진 값에 가장 가까운 귀한 귤 하나를 그 자리에 (#163 까마귀가 떨어뜨리는 반짝이는 것). 떨궜으면 true
late.rareGive = (pos, v = 20) => { const K = RARE_GYUL.kinds.reduce((b, k) => (Math.abs(k.m - v) < Math.abs(b.m - v) ? k : b)); spawn(K, K.m, pos); return true; };
// 확인용 (window.__oreum.rare): 바로 떨굼·떨어진 것 보기
late.rareDev = { drop: (id = 'hwanggeum', val) => { const K = RARE_GYUL.kinds.find((k) => k.id === id) || RARE_GYUL.kinds[0]; spawn(K, val ?? K.m, player.pos.clone().add(new THREE.Vector3(2, 0, 0))); return list.length; }, list: () => list.map((d) => ({ id: d.K.id, val: d.val, ground: d.ground, fly: d.fly, t: +d.t.toFixed(2) })) };
