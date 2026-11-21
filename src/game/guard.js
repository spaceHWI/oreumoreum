// 구역 지킴이 돌하르방 (#119). 한 구역(balance.js ZONES)의 쓰레기 더미를 모두 치우면 그 구역 자리에 돌하르방이 솟아오르고, ZONE_GUARD.holdSec 뒤 가라앉는다
// - 세운 시각: 멀티 서버가 있으면 방(server/src/roomcore.js)이 기억해 {t:'hi'}.zg·{t:'zg'} 로 알려 줌 → 같은 방 모두 같은 하르방·메시지, 새로 들어온 사람은 서 있는 모습만
//   방이 zg 를 모르면(옛 서버)·혼자 하기면 기기에서 셈: 구역이 꽃밭이 된 순간(bloom 'zone-bloom') save.zg[구역] = 지금
// - 서 있는 동안 쓰레기가 다시 쌓여도 남음(시간으로만). 가라앉은 뒤 구역을 다시 다 치우면 다시 섬
// - 연출: 꽃 피는 연출이 먼저(afterBloom), 이어서 땅에서 솟아오르며 흙먼지·빛 기둥·꽃잎, 가까우면 카메라가 잠깐 그쪽을 봄. 저사양(단계 0)은 빛 기둥 없이 조금만
// - 자리: 구역 길 위쪽 반의 길 옆(fieldplan.js placeSide, 고정 seed). 정상은 지금 있는 하르방에서 ZONE_GUARD.keep 밖
// 이번엔 보상·적 막기 없음. 우두머리·구역 완료(#139)가 이 자리를 이어 씀 (late.guard.spots)
// (파일 순서는 src/modules.js: field 뒤)
import * as THREE from 'three';
import { ZONE_GUARD as G, ZONES, BLOOM } from '../balance.js';
import { buildHareubang } from '../lifemodels.js';
import { placeSide } from '../fieldplan.js';
import { HEAP_SIG } from '../trash.js';
import { height } from '../world.js';
import { state, late } from './state.js';
import { save, persist } from './save.js';
import { scene, spots, quality } from './scene.js';
import { trash, bloom, bfx, col, player, CHS } from './place.js';
import { toast } from './hud.js';
import { field } from './field.js';
import { cam } from './camera.js';

function mulberry(seed) { let s = seed >>> 0; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- 자리 ---------- */
function pickSpots() {
  if (!trash || !field || !trash.loops) return [];
  const loops = trash.loops, rnd = mulberry(G.seed), out = [];
  const taken = [
    ...trash.heaps.map((h) => ({ x: h.x, z: h.z, r: h.r + 1 })),
    ...[...field.dens, ...field.treasures, ...field.sights].map((o) => ({ x: o.x, z: o.z, r: 3.5 })),
    ...field.bosses.map((b) => ({ x: b.x, z: b.z, r: b.r * 0.5 })),
    ...CHS.map((c) => ({ x: c.front.x, z: c.front.z, r: 5 })),
    ...(spots.hareubangs || []).map((h) => ({ x: h.pos.x, z: h.pos.z, r: G.keep })),
  ];
  for (const k of Object.keys(loops).map(Number).sort((a, b) => a - b)) {
    const L = loops[k], args = { side: 0, d: G.d, R: G.r, rnd, zone: k, zoneAt: trash.zoneAt, ok: trash.ok, height, trailDist: trash.trail.dist, taken, gap: 2 };
    const q = (L.upper?.length && placeSide({ ...args, pool: L.upper, flat: 0.5 })) || placeSide({ ...args, pool: L.all, flat: 0.9 }) || (L.edge && placeSide({ ...args, pool: L.all, d: [G.d[0], G.d[1] * 4], flat: 1.2 }));
    if (!q) continue;
    taken.push({ x: q.x, z: q.z, r: G.keep });
    out.push({ zone: k, x: q.x, z: q.z, y: Math.min(q.y, height(q.x, q.z)), rot: Math.atan2(q.fromX - q.x, q.fromZ - q.z) });
  }
  return out;
}
const SPOTS = pickSpots();

/* ---------- 모양 ---------- */
// 빛 기둥: 위로 갈수록 옅어지는 열린 원기둥 (더해 그리기). 구역마다 하나, 연출 때만 보임
const pillarGeo = (() => {
  const g = new THREE.CylinderGeometry(G.pillar.r * 0.7, G.pillar.r, G.pillar.h, 14, 6, true).translate(0, G.pillar.h / 2, 0);
  const p = g.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const u = p.getY(i) / G.pillar.h, b = (1 - u) ** 1.6; c[i * 3] = b; c[i * 3 + 1] = b * 0.92; c[i * 3 + 2] = b * 0.7; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
})();
const guards = new Map(); // 구역 → { s 자리, hb 모양, colIds, k 솟은 정도 0~1, mode 'up'|'down'|null, t, wait, pillar, pt }
for (const s of SPOTS) {
  const hb = buildHareubang(); hb.root.position.set(s.x, s.y - G.depth, s.z); hb.root.rotation.y = s.rot; hb.root.visible = false; scene.add(hb.root);
  const ids = col ? [col.add(s.x, s.z, 0.75)] : []; if (col) col.setOff(ids, true);
  const pillar = new THREE.Mesh(pillarGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  pillar.position.set(s.x, s.y - 0.2, s.z); pillar.visible = false; pillar.frustumCulled = false; pillar.renderOrder = 4; scene.add(pillar);
  guards.set(s.zone, { s, hb, ids, k: 0, mode: null, t: 0, wait: 0, pillar, pt: -1 });
}
const lite = () => quality.level === 0;
const why = new Map(); // 구역 → 'boss' (우두머리를 쫓아내 선 것, #139 메시지)
const zoneName = (z) => ZONES[z - 1]?.name || `${z}구역`;

/* ---------- 세운 시각 ---------- */
// 기기: save.zg = { 구역: ms }. 방: srv = Map(구역 → 기기 시각으로 바꾼 ms), off = 방 시각 - 기기 시각
if (!save.zg || typeof save.zg !== 'object' || Array.isArray(save.zg)) save.zg = {};
for (const k in save.zg) if (!(Number(save.zg[k]) > 0) || !guards.has(+k)) delete save.zg[k];
let srv = null, holdSec = G.holdSec;
const atOf = (z) => (srv ? srv.get(z) || 0 : Number(save.zg[z]) || 0);
const standing = (z, now = Date.now()) => { const at = atOf(z); return at > 0 && now - at < holdSec * 1000 && now - at > -60000; };

function link(r) {
  if (!r.on) return;
  r.on('hi', (m) => {
    if (m.sig !== HEAP_SIG || !Array.isArray(m.zg)) { srv = null; return; } // 옛 서버·더미 구성이 다른 서버 → 기기에서 셈
    const off = (Number(m.now) || Date.now()) - Date.now();
    srv = new Map(); for (const a of m.zg) if (Array.isArray(a) && guards.has(a[0]) && Number(a[1]) > 0) srv.set(a[0], a[1] - off);
    srv.off = off; sync(false);
  });
  r.on('zg', (m) => { if (!srv || !guards.has(m.z) || !(Number(m.at) > 0)) return; srv.set(m.z, m.at - srv.off); sync(true); });
  r.on('close', () => { if (!srv) return; for (const [z, at] of srv) if (at > (Number(save.zg[z]) || 0)) save.zg[z] = at; srv = null; persist(); }); // 끊기면 본 것을 기기에 이어 셈
}
late.guardNet = { link };

// 혼자 하기: 구역이 꽃밭이 된 순간 = 더미가 모두 0
if (bloom) bloom.on((ev, d) => {
  if (ev !== 'zone-bloom' || srv || !guards.has(d.zone) || late.tut?.active) return;
  if (standing(d.zone)) return;
  save.zg[d.zone] = Date.now(); persist(); sync(true);
});

/* ---------- 솟기·가라앉기 ---------- */
// fresh: 방금 선 것(메시지·연출). 아니면 들어올 때 이미 서 있던 것 → 바로 세움
function sync(fresh) {
  const now = Date.now();
  for (const [z, g] of guards) {
    const want = standing(z, now), up = g.mode === 'up' || (g.k >= 1 && g.mode !== 'down');
    if (want && !up) {
      const age = (now - atOf(z)) / 1000;
      if (fresh && age < G.fresh) rise(g, Math.max(0, G.afterBloom - age));
      else { g.mode = null; g.k = 1; place(g); }
    } else if (!want && up) sink(g);
  }
}
function rise(g, wait) { g.mode = 'up'; g.t = 0; g.wait = wait; g.k = 0; g.started = false; }
function sink(g) { g.mode = 'down'; g.t = 0; g.wait = 0; }
function place(g) {
  const { hb, s } = g, k = g.k, e = k * k * (3 - 2 * k), shake = g.mode === 'up' && k < 1 ? Math.sin(g.t * 47) * 0.04 * (1 - k) : 0;
  hb.root.position.set(s.x + shake, s.y - G.depth * (1 - e), s.z + shake * 0.6); hb.root.visible = k > 0.001;
  if (col) col.setOff(g.ids, k < 0.6);
}
function startFx(g) {
  const { s } = g, z = g.s.zone, color = BLOOM.zones[z]?.color || '#ffffff', far = Math.hypot(s.x - player.pos.x, s.z - player.pos.z), sm = lite();
  toast(why.get(z) === 'boss' ? `${zoneName(z)} 구역 완료! 돌하르방이 지켜 줄 거예요` : `${zoneName(z)} 구역을 다 치웠어요! 돌하르방이 지켜 줄 거예요`, 3.6); why.delete(z);
  late.sound?.stone?.(); late.sound?.heapClear?.(2, Math.max(0.2, 1 - far / 120));
  if (bfx && far < 160) {
    bfx.ring(s.x, s.z, 5.5, 1.1, '#e9d2a6', 0, 1.2); // 흙먼지 고리
    bfx.burst(s.x, s.y + 0.2, s.z, { petals: sm ? 12 : G.dust * 0.4, sparks: 0, up: 2.2, spread: 1.4, color: '#b8a07c' }); // 흙먼지
    bfx.burst(s.x, s.y + 0.4, s.z, { petals: sm ? 24 : G.petals, sparks: sm ? 8 : G.sparks, up: 6.5, spread: 1.2, color, delay: G.riseT * 0.75 }); // 다 솟으면 꽃잎
    if (!sm) bfx.ring(s.x, s.z, 9, 1.4, '#fff3b0', G.riseT * 0.8, 1.6);
  }
  if (!sm) { g.pt = 0; g.pillar.visible = true; }
  if (cam.mode === 'follow' && far < G.lookR && far > 4) state.glance = { x: s.x, z: s.z, t: 0, T: G.lookT };
}
function tickGuard(dt) {
  for (const g of guards.values()) {
    if (g.pt >= 0) { // 빛 기둥: 빨리 밝아졌다 천천히 옅어짐
      g.pt += dt; const u = g.pt / G.pillar.t;
      if (u >= 1) { g.pt = -1; g.pillar.visible = false; } else { g.pillar.material.opacity = (u < 0.12 ? u / 0.12 : (1 - u) / 0.88) * 0.85; g.pillar.scale.set(1 + u * 0.4, 0.6 + Math.min(1, u * 3) * 0.4, 1 + u * 0.4); }
    }
    if (!g.mode) continue;
    if (g.wait > 0) { g.wait -= dt; continue; }
    if (g.mode === 'up' && !g.started) { g.started = true; startFx(g); }
    g.t += dt;
    if (g.mode === 'up') { g.k = Math.min(1, g.t / G.riseT); if (g.k >= 1) { g.mode = null; late.sound?.stone?.(); } }
    else { g.k = Math.max(0, 1 - g.t / G.sinkT); if (g.k <= 0) g.mode = null; }
    place(g);
  }
}
let checkT = 0;
late.tickGuard = (dt) => { if (!guards.size) return; tickGuard(dt); if ((checkT -= dt) <= 0) { checkT = 1; sync(false); } }; // 시간이 다 되면 가라앉음
sync(false);

/* ---------- 확인용 (window.__oreum.guard) ---------- */
// spots(): 구역마다 자리 · state(): 서 있나·남은 초 · hold(초): 서 있는 시간 바꾸기(이 기기만, 확인용) · stand(z): 그 구역을 세운 것으로(혼자 하기 저장) · clear(z): 그 구역 더미를 모두 비움(실제 흐름)
late.guard = guards.size ? {
  spots: () => SPOTS.map((s) => ({ zone: s.zone, x: +s.x.toFixed(1), z: +s.z.toFixed(1), trail: +trash.trail.dist(s.x, s.z, 30).toFixed(1) })),
  state: () => [...guards].map(([z, g]) => ({ zone: z, standing: standing(z), k: +g.k.toFixed(2), mode: g.mode, left: atOf(z) ? Math.max(0, Math.round(holdSec - (Date.now() - atOf(z)) / 1000)) : 0, server: !!srv })),
  hold(sec) { holdSec = Math.max(1, +sec || G.holdSec); sync(false); return holdSec; },
  stand(z) { if (!guards.has(z)) return false; save.zg[z] = Date.now(); persist(); sync(true); return true; },
  standing: (z) => standing(z), server: () => !!srv,
  // 우두머리를 쫓아냄 (#139, boss.js): 방이 zg 를 알면 방장이 보낸 {t:'bd'} 뒤 방이 알려 줌(여기선 메시지만 정함), 아니면 기기에서 바로 세움
  raise(z, local) { if (!guards.has(z)) return false; why.set(z, 'boss'); if (srv && !local) return true; if (standing(z)) return false; save.zg[z] = Date.now(); persist(); sync(true); return true; },
  clear(z) { return trash.test.clearZone(z); },
  go(z) { const g = guards.get(z); if (!g) return null; const { s } = g, x = s.x + Math.sin(s.rot) * 7, zz = s.z + Math.cos(s.rot) * 7; player.pos.set(x, height(x, zz), zz); player.visY = player.pos.y; player.heading = s.rot + Math.PI; cam.yaw = s.rot; return { x: +x.toFixed(1), z: +zz.toFixed(1) }; },
  guards,
} : null;
