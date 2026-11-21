// 전리품 (#140, notes/growth-loop.md 5절): 적·소굴·보물·우두머리가 재료와 장비를 떨굼 → 분수처럼 튀고 등급 색 빛기둥 → 가까이 가면 빨려 듦(자동 줍기)
// 셈(확률·강화 값·입기·귤로 바꾸기)은 src/loot.js, 강화 창은 forge.js. 저장: save.mats·gearUp·clothes.up·loot·lootAuto (src/loot.js 머리말)
// 얻는 순간 저장에 넣고(창을 닫아도 남게), 떨어진 조각이 날아와 닿을 때 토스트·견주는 창(#loot-pop)을 띄움
import * as THREE from 'three';
import { LOOT, ENEMY_SPAWN, ZONE_BOSS, WEAR } from '../balance.js';
import { LOW } from '../gfx2.js';
import { gradHard } from '../toon.js';
import { height } from '../world.js';
import { clothSvg } from '../clothicons.js';
import { rollDrop, MAT, MATS, itemName, itemPts, gradeColor, gradeName, diffPts, canEquip, sellValue, addSpare, tidySpare, equipSpare, sellSpare, tierUp, legendOn, fxOf, clothId, WEAR_K, GEAR4 } from '../loot.js';
import { CLOTHES } from '../balance.js';
import { state, late } from './state.js';
import { $, save, persist, syncEquipGear } from './save.js';
import { scene } from './scene.js';
import { life, player, runner, trash } from './place.js';
import { toast, updateStats } from './hud.js';
import { net } from './room.js';
import { updateTrashUI } from './pickup.js';
import { gdBadge, scoreChip } from './shop.js';
import { director } from './director.js';
import { ic } from '../icons.js';

const D = LOOT.drop, ZONE_OF = Object.fromEntries(Object.entries(ENEMY_SPAWN.byZone).map(([z, k]) => [k, +z]));
const CLOTH = Object.fromEntries(CLOTHES.map((c) => [c.id, c]));
const SVG = (p) => `${late.SVG_A || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"'}>${p}</svg>`;
// 재료 그림 (로우폴리 임시): 털·이빨·엄니·발톱·부품, 귀한 재료는 같은 그림에 별
export const MAT_ART = {
  m1: ic('m1'),
  m2: ic('m2'),
  m3: ic('m3'),
  m4: ic('m4'),
  m5: ic('m5'),
};
export const matSvg = (id) => { const M = MAT[id]; if (!M) return ''; const base = MAT_ART[M.kind === 'rare' ? `m${M.z}` : id]; return SVG(base + (M.kind === 'rare' ? '<path d="M19 2l.9 2 2.1.3-1.5 1.5.4 2.2-1.9-1-1.9 1 .4-2.2L16 4.3l2.1-.3z" fill="currentColor"/>' : '')); };
// 장비 그림: 도구·배낭·신발·무기는 장비점 그림, 옷은 옷 그림
export function itemSvg(it) {
  if (WEAR_K.includes(it.s)) { const c = CLOTH[clothId(it.s, it.t)]; return c ? clothSvg(c) : ''; }
  const A = late.TIER_ART?.[it.s]; if (!A) return '';
  const i = Math.max(0, Math.min(A.length - 1, it.t - 1));
  return late.itemArt ? late.itemArt(it.s, i, '') : SVG(A[i]);
}

/* ---------- 저장: 예전 우두머리 귀한 재료(save.boss.mats, 이름)를 재료 주머니로 한 번 옮김 ---------- */
if (!save.lootV) {
  const bm = save.boss?.mats;
  if (bm && typeof bm === 'object') for (const M of MATS) { const n = Math.floor(Number(bm[ZONE_BOSS.list[M.z]?.mat])) || 0; if (n > 0) save.mats[M.rare] = (save.mats[M.rare] || 0) + n; }
  save.lootV = 1; persist();
}
{ const sold = tidySpare(save); if (sold.length) persist(); } // 들어올 때 정리 (예전 저장·설정 바뀜)

/* ---------- 떨어지는 조각 ---------- */
const group = new THREE.Group(); group.name = 'loot'; scene.add(group);
const geo = { mat: new THREE.DodecahedronGeometry(0.2, 0), rare: new THREE.OctahedronGeometry(0.26, 0), gear: new THREE.OctahedronGeometry(0.34, 0) };
const pillarGeo = new THREE.CylinderGeometry(0.1, 0.32, 1, 10, 1, true); pillarGeo.translate(0, 0.5, 0);
const ringGeo = new THREE.RingGeometry(0.42, 0.6, 24); ringGeo.rotateX(-Math.PI / 2);
const matCache = new Map();
const toonOf = (c) => { let m = matCache.get(c); if (!m) { m = new THREE.MeshToonMaterial({ color: c, gradientMap: gradHard, emissive: c, emissiveIntensity: 0.35 }); matCache.set(c, m); } return m; };
const glowOf = (c, op) => { const k = c + op; let m = matCache.get(k); if (!m) { m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }); matCache.set(k, m); } return m; };
const drops = [];
const lowK = () => (LOW ? D.low : 1);
// 한 조각: kind 'mat'|'rare'|'gear', give = 닿았을 때 (토스트·창)
function spawn(pos, kind, color, grade, give) {
  const o = new THREE.Group(), gem = new THREE.Mesh(geo[kind], toonOf(color)); o.add(gem);
  const ph = kind === 'rare' ? D.pillar[2] : kind === 'gear' ? D.pillar[grade] : 0;
  let pillar = null, ring = null;
  if (ph > 0) { pillar = new THREE.Mesh(pillarGeo, glowOf(color, LOW ? 0.28 : 0.4)); pillar.scale.set(1, ph, 1); pillar.renderOrder = 4; o.add(pillar); }
  if (kind === 'gear' && grade > 0) { ring = new THREE.Mesh(ringGeo, glowOf(color, 0.55)); ring.renderOrder = 4; o.add(ring); }
  o.position.copy(pos); group.add(o);
  const a = Math.random() * Math.PI * 2, sp = D.spread[0] + Math.random() * (D.spread[1] - D.spread[0]);
  drops.push({ o, gem, pillar, ring, kind, give, t: 0, v: new THREE.Vector3(Math.sin(a) * sp, D.up[0] + Math.random() * (D.up[1] - D.up[0]), Math.cos(a) * sp), ground: false, fly: false, spin: Math.random() * 6 });
}
const toP = new THREE.Vector3();
export function tickLoot(dt) {
  if (!drops.length) return;
  const P = player.pos;
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i], o = d.o; d.t += dt; d.spin += dt * 3;
    d.gem.rotation.set(0.4, d.spin, 0); d.gem.position.y = d.ground && !d.fly ? 0.35 + Math.sin(d.t * 3) * 0.08 : 0;
    toP.set(P.x - o.position.x, P.y + 1 - o.position.y, P.z - o.position.z); const dist = toP.length();
    if (!d.fly && d.t > D.magnetT && (dist < D.magnetR || d.t > D.autoT)) d.fly = true;
    if (d.fly) {
      const sp = D.fly * Math.min(3, 0.6 + d.t * 0.5) * (d.t > D.autoT ? 2.5 : 1);
      if (dist < 0.7 || dist < sp * dt) { group.remove(o); drops.splice(i, 1); d.give(); continue; }
      o.position.addScaledVector(toP, Math.min(1, sp * dt / dist));
      if (d.pillar) d.pillar.scale.y = Math.max(0.01, d.pillar.scale.y * (1 - dt * 6));
      continue;
    }
    if (!d.ground) {
      d.v.y -= D.grav * dt; o.position.addScaledVector(d.v, dt);
      const gy = height(o.position.x, o.position.z) + 0.05;
      if (o.position.y <= gy && d.v.y < 0) { o.position.y = gy; if (Math.abs(d.v.y) > 3) { d.v.y *= -0.32; d.v.x *= 0.5; d.v.z *= 0.5; } else d.ground = true; }
    }
    if (d.ring) d.ring.material.opacity = 0.35 + 0.25 * Math.sin(d.t * 4);
  }
}
late.tickLoot = tickLoot;

/* ---------- 얻기 ---------- */
let matToast = null; // 잇따라 얻는 재료는 한 토스트로 모음
function gotMat(id, n) {
  const M = MAT[id]; if (!M) return;
  if (M.kind === 'rare') { toast(`귀한 재료 · ${M.name}`, 3); late.sound?.fanfare?.(); return; }
  if (matToast && performance.now() - matToast.t < 1500 && matToast.id === id) matToast.n += n; else matToast = { id, n };
  matToast.t = performance.now(); toast(`${M.name} +${matToast.n}`, 1.6); late.sound?.coin?.();
}
// 떨굼: src 'enemy'|'den'|'treasure'|'boss', z 구역, pos 떨어지는 자리
export function dropLoot(src, z, pos, opt = {}) {
  const r = opt.roll || rollDrop(save, src, z);
  const top = pos.clone(); top.y = Math.max(top.y, height(top.x, top.z)) + 0.9;
  for (const [id, n] of Object.entries(r.mats)) {
    save.mats[id] = (save.mats[id] || 0) + n;
    const M = MAT[id], k = Math.max(1, Math.min(Math.round(n), Math.round((M.kind === 'rare' ? 1 : 6) * lowK())));
    for (let i = 0; i < k; i++) spawn(top, M.kind === 'rare' ? 'rare' : 'mat', M.kind === 'rare' ? '#ffd27a' : M.color, 0, i === 0 ? () => gotMat(id, n) : () => {});
  }
  if (r.gear) {
    const it = r.gear; addSpare(save, it);
    spawn(top, 'gear', gradeColor(it.g), it.g, () => gotGear(it));
    if (it.g === 3) { toast(`전설 장비가 떨어졌어요!`, 2.4); save.legend ||= {}; save.legend[`${it.s}:${it.t}`] = 1; }
  }
  persist();
  return r;
}
// 장비가 닿음: 자동 정리 뒤 남았으면 견주는 창, 귤로 바뀌었으면 토스트
function gotGear(it) {
  const before = save.coins, sold = tidySpare(save); persist();
  const mine = sold.find(([x]) => x.s === it.s && x.t === it.t && x.g === it.g && x.e === it.e);
  for (const [x, v] of sold) if (x !== mine?.[0]) toast(`${itemName(x)} → 귤 ${v}`, 2);
  if (mine) { toast(`${gradeName(it.g)} ${itemName({ ...it, g: 0 })} · 지금 것이 더 좋아 귤 ${mine[1]}로 바꿨어요`, 2.8); late.sound?.coin?.(); }
  if (save.coins !== before) { updateStats(); late.shopCoinsChanged?.(); }
  if (!mine) showPop(it);
  late.forgeRefresh?.();
}

/* ---------- 견주는 창: ▲/▼ · [바로 입기] · [귤로 바꾸기] ---------- */
const pop = document.createElement('div'); pop.id = 'loot-pop'; pop.hidden = true; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', '새 장비'); document.body.append(pop);
let popQ = [], popT = 0, popIt = null;
function showPop(it) { popQ.push(it); if (!popIt) nextPop(); }
function nextPop() {
  popIt = popQ.shift() || null; if (!popIt) { pop.hidden = true; return; }
  const it = popIt, i = save.loot.findIndex((x) => x.s === it.s && x.t === it.t && x.g === it.g && x.e === it.e);
  if (i < 0) { nextPop(); return; }
  const d = diffPts(save, it), ok = canEquip(save, it), fx = it.g === 3 ? LOOT.fx[fxOf(it.s)] : null;
  pop.style.setProperty('--gc', gradeColor(it.g)); pop.dataset.g = it.g;
  pop.innerHTML = `<span class="lp-art">${itemSvg(it)}</span><span class="lp-bn"><small>${gradeName(it.g)}${it.g === 3 ? ' · 전설' : ''}</small><b>${itemName({ ...it, g: 0 })}</b>${scoreChip(itemPts(it), d)}${fx ? `<em class="lp-fx">${fx.name}</em>` : ''}</span>`
    + `<span class="lp-ba"><button type="button" class="btn primary lp-wear"${ok ? '' : ' disabled'}>${ok ? '바로 입기' : '입을 수 없어요'}</button><button type="button" class="btn small lp-sell"><i class="g"></i>${sellValue(it)}로 바꾸기</button></span><button type="button" class="lp-x" aria-label="나중에">×</button>`;
  pop.querySelector('.lp-wear').addEventListener('click', () => { const j = save.loot.indexOf(save.loot.find((x) => x.s === it.s && x.t === it.t && x.g === it.g && x.e === it.e)); if (wearSpare(j)) toast(`${itemName(it)} · 입었어요`); nextPop(); });
  pop.querySelector('.lp-sell').addEventListener('click', () => { const j = save.loot.findIndex((x) => x.s === it.s && x.t === it.t && x.g === it.g && x.e === it.e); const v = sellAt(j); if (v) toast(`귤 ${v}개로 바꿨어요`); nextPop(); });
  pop.querySelector('.lp-x').addEventListener('click', () => nextPop());
  pop.hidden = false; pop.classList.remove('in'); void pop.offsetWidth; pop.classList.add('in'); popT = LOOT.popT;
  if (it.g >= 2) late.sound?.fanfare?.(); else late.sound?.coin?.();
}
setInterval(() => { if (!popIt || pop.matches(':hover')) return; if ((popT -= 0.5) <= 0) nextPop(); }, 500); // 안 누르면 가방(안 쓰는 장비)에 남음
// 입기·귤로 바꾸기 (강화 창도 씀)
export function wearSpare(i) {
  const it = save.loot[i]; if (!it || !equipSpare(save, i)) return false;
  tidySpare(save); syncEquipGear(); runner.apply(save.outfit); persist(); updateStats(); updateTrashUI(true); net.send(true);
  if (it.s === 'weapon') late.armsChanged?.();
  late.sound?.coin?.(); late.forgeRefresh?.(); late.bagRefresh?.();
  return true;
}
export function sellAt(i) { const v = sellSpare(save, i); if (!v) return 0; persist(); updateStats(); late.shopCoinsChanged?.(); late.sound?.coin?.(); late.forgeRefresh?.(); return v; }
// 장비 단계를 새로 샀을 때 (shop.js buyGear)
late.tierUpLoot = (k) => tierUp(save, k); // 값을 바꾸기 전에 (예전 단계 장비를 안 쓰는 장비로)
late.lootTidy = () => { const sold = tidySpare(save); for (const [x, v] of sold) toast(`${itemName(x)} → 귤 ${v}`, 2.2); if (sold.length) late.forgeRefresh?.(); }; // 값을 바꾼 뒤 (자동이면 귤로)

/* ---------- 떨구는 곳 ---------- */
{ const base = life.hooks.enemyRepel; // 쫓아낸 적: 재료 60%·드문 장비. 전설(싸우는 옷)이면 귤을 더
  life.hooks.enemyRepel = (kind, pos, def) => {
    const d2 = legendOn(save, 'extra') ? { ...def, reward: { ...def.reward, gyul: Math.round(def.reward.gyul * LOOT.fx.extra.k) } } : def;
    base?.(kind, pos, d2);
    if (def.swarm === 'mob') return; // 들판 떼 보통 적(#173)은 떨구지 않음 (잦아서). 정예는 떨굼, 대장은 보물 상자(swarm.js)
    dropLoot('enemy', Math.max(1, Math.min(5, ZONE_OF[kind] || trash?.zoneAt?.(pos.x, pos.z) || 1)), pos);
  }; }
late.denLoot = (d) => dropLoot('den', d.zone, new THREE.Vector3(d.x, d.y ?? height(d.x, d.z), d.z));
late.treasureLoot = (t, at) => dropLoot('treasure', t.zone, at ? at.clone() : new THREE.Vector3(t.x, t.y, t.z));
late.bossLoot = (z, pos) => dropLoot('boss', z, pos);
// 전설 무기: 맞힌 적 옆(LOOT.fx.split.r 안) 다른 적에게 피해 × k 로 갈라짐
let splitting = false;
life.hooks.afterHurt = (e, dmg) => {
  if (splitting || !legendOn(save, 'split')) return;
  const F = LOOT.fx.split; let best = null, bd = F.r;
  for (const o of life.enemies.list) { if (o === e || o.state === 'flee' || o.state === 'leave') continue; const dd = o.pos.distanceTo(e.pos); if (dd < bd) { bd = dd; best = o; } }
  if (!best) return;
  splitting = true; try { life.enemies.hurt(best, dmg * F.k, true); life.juiceSplash?.(best.pos); } finally { splitting = false; }
};

/* ---------- 도감: 재료·전설 장비 칸 (hud.js buildDex 끝에서) ---------- */
late.dexExtra = (g) => {
  const sec = (t) => { const h = document.createElement('div'); h.className = 'dex-sec'; h.textContent = t; g.append(h); };
  const cell = (html, name, small, got, cls = '') => { const el = document.createElement('div'); el.className = 'dex-cell ' + cls + (got ? '' : ' locked'); el.innerHTML = `<span class="dex-ic">${html}</span><b></b><small></small>`; el.querySelector('b').textContent = got ? name : '???'; el.querySelector('small').textContent = small; g.append(el); };
  sec('재료');
  for (const M of MATS) for (const id of [M.id, M.rare]) { const n = save.mats[id] || 0, seen = n > 0 || (save.matSeen?.[id]); cell(`<i style="color:${MAT[id].kind === 'rare' ? '#ffd27a' : M.color}">${matSvg(id)}</i>`, MAT[id].name, seen ? `${n}개` : (MAT[id].kind === 'rare' ? '우두머리' : `구역 ${M.z}`), seen, MAT[id].kind === 'rare' ? 'rare' : ''); }
  sec('전설 장비');
  const L = save.legend || {};
  for (const k of [...GEAR4, ...WEAR.slots.map((w) => w.k)]) { // 칸마다 한 칸: 얻은 것 가운데 가장 높은 단계
    const ts = Object.keys(L).filter((x) => x.startsWith(k + ':')).map((x) => +x.split(':')[1]).sort((a, b) => b - a), t = ts[0] || (k === 'weapon' ? 6 : 5), it = { s: k, t, g: 3, e: 0 };
    cell(`<i style="color:${gradeColor(3)}">${itemSvg(it)}</i>`, itemName(it), ts.length ? LOOT.fx[fxOf(k)]?.name || '' : '구역 4~5 우두머리·보물', ts.length > 0, 'rare legend'); }
};
// 한 번이라도 가진 재료는 도감에 남김
{ const seenUp = () => { save.matSeen ||= {}; let ch = false; for (const id in save.mats) if (!save.matSeen[id]) { save.matSeen[id] = 1; ch = true; } if (ch) persist(); }; setInterval(seenUp, 3000); }

/* ---------- 감독 문 (#176 JOURNEY 'loot', 구역 3): 전리품·강화 소개 한 줄. 떨어지는 것은 문과 상관없이 늘 ---------- */
director.register({ id: 'loot', sec: 4.5, intro: () => toast('적·소굴·보물에서 재료와 장비가 떨어져요. 장비점 [강화] 에서 장비를 올려요', 4.5) });

/* ---------- 확인용 (__oreum.loot) ---------- */
late.lootApi = {
  roll: (src = 'enemy', z = 1) => rollDrop(save, src, z),
  drop: (src = 'enemy', z = 1, opt) => dropLoot(src, z, player.pos.clone().add(new THREE.Vector3(1, 0, 1)), opt),
  give: (it) => { const g = { s: it.s, t: it.t, g: it.g | 0, e: it.e | 0 }; dropLoot('enemy', 1, player.pos.clone().add(new THREE.Vector3(1, 0, 1)), { roll: { mats: {}, gear: g } }); return g; },
  mats: () => ({ ...save.mats }), spare: () => save.loot.map((x) => ({ ...x, name: itemName(x), pts: itemPts(x), d: diffPts(save, x), ok: canEquip(save, x) })),
  up: () => ({ gear: { ...save.gearUp }, clothes: { ...save.clothes.up } }),
  wear: (i) => wearSpare(i), sell: (i) => sellAt(i), auto: (v) => { if (v != null) { save.lootAuto = v ? 1 : 0; persist(); } return save.lootAuto; },
  drops: () => drops.length, pop: () => (!pop.hidden && popIt ? { ...popIt } : null), legendOn: (f) => legendOn(save, f),
  addMats: (o) => { for (const [k, v] of Object.entries(o)) if (MAT[k]) save.mats[k] = (save.mats[k] || 0) + v; persist(); },
};
void state;
