// 징표 (#255): 서바이벌 터에서만 얻는 재화와, 징표로만 사는 전투 특화 무기·옷. 셈은 src/token.js, 수치 balance.js TOKEN, 서버 server/src/token.js
// - 얻기: 한 판이 끝나면(swarm.js late.swarmEnd) 버팀 = 구역 × 3 · 대장 쫓아냄 +2 · 한 번도 안 쓰러짐 +1, 못 버티면 버틴 물결 수 × 0.5 (2 까지). save.tok.rec[구역] 에 기록(서버가 인정)
// - 보임: 위쪽 줄에 늘 있지 않고 터 근처('지금 있는 곳' 옆 작은 칸)·징표 좌판·내 가방 아래에서만
// - 징표 좌판: 구역마다 터 문 옆(터 자리 기준, #253 으로 옮겨도 따라감). 좌판은 터마다 그리기 1번, 주인 '터지기'는 가까운 좌판 하나에만(러너 하나)
//   창은 가게 팝업 틀(stores.js SHOP_POP.tok), 값은 징표. 깊은 구역일수록 좋은 것 (src/token.js stallArms·stallCloth)
// - 무기: 연발(머신건 방식)·관통(총 + 뚫음)·폭발(폭탄 방식) × 단계 3. 들면 throw.js weaponNow 가 이 값(late.tokArm). 귤 무기를 고르면 내려놓음
// - 옷: 입은 칸은 그 칸 능력이 싸움 값으로 바뀜(save.js wearV ← state.tokWearV): 기운·회복·받는 피해는 더 큰 쪽, 줍기·벌이(모자·바지·베스트)는 0 대신 피해 +%
//   여섯 칸을 다 입으면 판 중 쓰러질 때 한 번 일어남(hp.hit 감쌈), 쉬는 시간 뒤 다시 참
// - 차림 묶음: 내 가방 아래 [줍기 차림]·[싸움 차림] 저장·입기. 징을 칠 때 싸움 차림이 있고 지금 다르면 한 번 묻기
// - 퀘스트 셈 'token'(late.questEv), 업적 ev 'token'·오늘의 할 일 ev 'arena-win'
// (파일 순서는 src/modules.js: arena 뒤. 매 프레임 일은 arena.js late.tickArena 를 감싸서)
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TOKEN, WEAPONS, SWARM } from '../balance.js';
import { clothSvg } from '../clothicons.js';
import { normTok, runTokens, TOK_ARMS, TOK_ARM, TOK_CLOTHES, TOK_CLOTH, armDef, armPrice, stallArms, stallCloth, LV_MAX } from '../token.js';
import { gradHard } from '../toon.js';
import { height } from '../world.js';
import { LOW } from '../gfx2.js';
import { caseModel } from '../casemodels.js';
import { state, late } from './state.js';
import { $, save, persist, CL, WSLOT, syncEquipGear, wearV } from './save.js';
import { scene } from './scene.js';
import { player, runner, life, hp, buff } from './place.js';
import { toast, ach } from './hud.js';
import { interactables, SHOP_POP, openShopPop, refreshShopPop } from './stores.js';

const T = TOKEN, A = SWARM.arena;
normTok(save);
const TK = () => save.tok;

/* ---------- 그림: 망고 ---------- */
const GONG = '<path d="M12 5c5.5-.5 9 3.6 8 9-1 4.6-5 6.5-9 5.8C6.7 19 3.5 15.5 4.5 10.8 5.3 7.3 8.3 5.2 12 5z"/><path d="M12 5c0-1.800 1-3 3-3.300"/>';
const gsvg = (cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">${GONG}</svg>`;
const LOGO = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 56"><rect x="6" y="4" width="4" height="48" rx="2" fill="#5a4126"/><rect x="54" y="4" width="4" height="48" rx="2" fill="#5a4126"/><rect x="4" y="6" width="56" height="5" rx="2" fill="#5a4126"/><circle cx="32" cy="30" r="17" fill="#d8a63c" stroke="#8a6420" stroke-width="3"/><circle cx="32" cy="30" r="7" fill="none" stroke="#8a6420" stroke-width="2.5"/><rect x="14" y="48" width="36" height="5" rx="2" fill="#f08a24"/></svg>`);

const st = document.createElement('style');
st.textContent = `
.tok-n { display: inline-flex; align-items: center; gap: 4px; font-family: var(--display); font-weight: 800; color: #ffcf7a; }
.tok-n svg { width: 14px; height: 14px; color: #ffcf7a; }
#where-tok { display: inline-flex; align-items: center; gap: 3px; margin-left: 6px; font-weight: 800; color: #ffcf7a; }
#where-tok svg { width: 13px; height: 13px; }
#where-tok[hidden] { display: none; }
#shoppop.tok .coins-pill i { background: transparent; border: 2px solid #ffcf7a; box-sizing: border-box; box-shadow: none; }
.menu-card .price.tok i { background: transparent; border: 2px solid #ffcf7a; box-sizing: border-box; box-shadow: none; }
.menu-card .price.tok { color: #ffcf7a; }
.tok-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin-top: 6px; font-size: 12px; }
.tok-foot .chip { padding: 4px 9px; font-size: 12px; }
.tok-foot .lose { color: #ff9a8a; }
.tok-foot .fight { color: #9be28a; }
#tok-ask { position: fixed; left: 50%; top: 38%; transform: translate(-50%, -50%); z-index: 60; background: var(--panel, rgba(30,31,36,.94)); color: #fff; border-radius: 16px; padding: 14px 16px; display: grid; gap: 10px; width: min(320px, calc(100vw - 32px)); box-sizing: border-box; box-shadow: 0 10px 30px rgba(0,0,0,.35); text-align: center; }
#tok-ask[hidden] { display: none; }
#tok-ask .row { display: flex; gap: 8px; justify-content: center; }
.tok-sub { color: #ffcf7a; }
`;
document.head.append(st);

/* ---------- 무기 ---------- */
const armNow = () => { const t = TK(); if (!t.arm || !t.own[t.arm]) return null; return armDef(t.arm, t.own[t.arm], WEAPONS); };
let armC = null, armK = '';
late.tokArm = () => { const t = TK(), k = t.arm && t.own[t.arm] ? t.arm + t.own[t.arm] : ''; if (k !== armK) { armK = k; armC = k ? armNow() : null; } return armC; };
state.tokArmNow = late.tokArm;
function holdArm(id) {
  const t = TK(); if (id && !t.own[id]) return;
  t.arm = id || null; persist(); late.armsChanged?.(); syncEquipGear(); runner.apply(save.outfit); late.net?.send(true);
}
const armLine = (d) => (d.dps ? `초당 ${d.dmg} · ${d.range}m` : d.r ? `${d.dmg} · 반경 ${d.r}m` : `${d.dmg}${d.pierce ? ` · ${d.pierce}마리 관통` : ''} · ${d.range}m`);

/* ---------- 옷: 입은 칸은 싸움 값 ---------- */
const FIGHT_STAT = { hp: 'hp', regen: 'regen', guard: 'guard' };
const wornTok = (k) => { const id = CL.wear[k], c = TOK_CLOTH[id]; return c && CL.own[id] ? c : null; };
state.tokWearV = (k, raw) => {
  const c = wornTok(k); if (!c) return null;
  const W = WSLOT[k]; if (!W) return null;
  const f = FIGHT_STAT[W.stat];
  if (f) { const base = raw(); return Math.max(base, c.tokStat[f] ?? base); } // 싸움 값은 더 큰 쪽
  return W.v[0]; // 줍기·벌이 칸은 없음 값
};
const suitDmg = () => { let d = 0; for (const c of TOK_CLOTHES) if (CL.wear[c.slot] === c.id && CL.own[c.id]) d += c.tokStat.dmg || 0; return d; };
const suitFull = () => TOK_CLOTHES.every((c) => CL.wear[c.slot] === c.id && CL.own[c.id]);
{ const m0 = buff.mul; buff.mul = (k) => (k === 'dmg' ? m0(k) * (1 + suitDmg()) : m0(k)); } // 두건·바지·띠: 피해 +%
// 줍기 몫이 줄어든 칸 (내 가방에 보임)
const lostSlots = () => TOK_CLOTHES.filter((c) => wornTok(c.slot) && !FIGHT_STAT[WSLOT[c.slot]?.stat]).map((c) => WSLOT[c.slot].name);

/* ---------- 한 벌 덤: 판 중 쓰러질 때 한 번 일어남 ---------- */
let reviveUsed = false, wasDown = false;
const reviveReady = () => suitFull() && !reviveUsed && Date.now() >= (TK().rv || 0) && !!late.swarm?.state?.();
{ const h0 = hp.hit; hp.hit = (d) => {
  if (reviveReady() && hp.hp - d <= 0 && !hp.isDown && !hp.pending) {
    reviveUsed = true; wasDown = true; TK().rv = Date.now() + SWARM.run.rest * 1000; persist();
    hp.set(hp.max * T.suit.hp); late.sound?.fanfare?.(); late.feel?.vib?.([30, 40, 30]);
    toast('한 벌 덤 · 다시 일어났어요', 2.4); return false;
  }
  return h0(d);
}; }

/* ---------- 얻기 ---------- */
let leaderOut = false, curRun = null;
{ const prev = life.hooks.enemyRepel; life.hooks.enemyRepel = (kind, pos, def, e) => { prev?.(kind, pos, def, e); if (def?.swarm === 'leader') leaderOut = true; }; }
function give(n, z, win, why) {
  const t = TK(); if (n <= 0) return 0;
  t.n += n; t.got += n; t.rec[z] = { at: Date.now(), n, win: win ? 1 : 0 };
  ach.emit('token', n); late.questEv?.('token', n);
  if (!t.seen) { t.seen = 1; setTimeout(() => toast(`처음 얻은 ${T.name} · 터 문 옆 좌판에서 ${T.name}로만 사요`, 4), 2600); }
  persist(); tagT = 0; late.bagRefresh?.();
  if (late.tokApi) late.tokApi.last = { n, z, win: !!win, why };
  return n;
}
{ const prev = late.swarmEnd; late.swarmEnd = (r) => {
  prev?.(r);
  const L = late.swarm?.last || {}, win = L.why === 'win';
  const n = runTokens({ zone: r.zone, win, leader: leaderOut, clean: !wasDown, waves: r.maxStage });
  if (win) ach.emit('arena-win');
  const got = give(n, r.zone, win, L.why);
  if (got) setTimeout(() => toast(`${T.name} +${got}${win ? (leaderOut ? ' · 대장 덤' : '') + (!wasDown ? ' · 안 쓰러짐 덤' : '') : ''} · 모두 ${TK().n}`, 3), win ? 5200 : 4400);
  curRun = null;
}; }

/* ---------- 차림 묶음 ---------- */
const kitNow = () => ({ wear: { ...CL.wear }, arm: TK().arm || null, use: save.weaponUse || 1 });
const sameKit = (k) => !!k && Object.keys(k.wear).every((s) => !CL.own[k.wear[s]] || CL.wear[s] === k.wear[s]) && (k.arm || null) === (TK().arm || null);
function saveKit(name) { TK().kit[name] = kitNow(); persist(); toast(name === 'fight' ? '싸움 차림을 저장했어요' : '줍기 차림을 저장했어요', 1.8); late.bagRefresh?.(); }
function wearKit(name) {
  const k = TK().kit[name]; if (!k) return false;
  for (const [s, id] of Object.entries(k.wear)) if (WSLOT[s] && (CL.own[id] || id === `${s}:none`)) CL.wear[s] = id;
  const t = TK(); t.arm = k.arm && t.own[k.arm] ? k.arm : null; save.weaponUse = Math.max(1, Math.min(save.equip.weapon || 1, k.use || 1));
  persist(); late.armsChanged?.(); syncEquipGear(); runner.apply(save.outfit); late.net?.send(true); late.bagRefresh?.();
  toast(name === 'fight' ? '싸움 차림으로 갈아입었어요' : '줍기 차림으로 갈아입었어요', 1.8);
  return true;
}
document.addEventListener('click', (e) => {
  const b = e.target.closest?.('[data-tokkit]'); if (!b) return;
  e.stopPropagation(); const [op, name] = b.dataset.tokkit.split(':');
  if (op === 'save') saveKit(name); else wearKit(name);
});
// 내 가방 아래 한 줄 (bag.js fillFoot)
late.tokFoot = () => {
  const t = TK(), lost = lostSlots(), d = suitDmg(), K = t.kit;
  const b = (op, name, txt) => `<button type="button" class="chip" data-tokkit="${op}:${name}">${txt}</button>`;
  return `<div class="tok-foot"><span class="tok-n" title="${T.name}">${gsvg()}${t.n}</span>`
    + (lost.length ? `<span class="lose">줍기 ▼ ${lost.join('·')}</span>` : '') + (d ? `<span class="fight">피해 +${Math.round(d * 100)}%</span>` : '') + (suitFull() ? '<span class="fight">한 벌 덤</span>' : '')
    + (K.pick ? b('wear', 'pick', '줍기 차림') : '') + (K.fight ? b('wear', 'fight', '싸움 차림') : '')
    + b('save', 'pick', K.pick ? '줍기 차림 ↻' : '지금을 줍기 차림으로') + b('save', 'fight', K.fight ? '싸움 차림 ↻' : '지금을 싸움 차림으로') + '</div>';
};
// 내 가방 무기 탭 (bag.js fillArm): 가진 징표 무기
late.tokArmRows = (g, card, rebuild) => {
  const t = TK();
  for (const a of TOK_ARMS) {
    const l = t.own[a.id] || 0, d = armDef(a.id, Math.max(1, l), WEAPONS);
    if (!l) { g.append(card({ icon: gsvg('food'), name: a.name, sub: `${a.desc}<br><span class="tok-sub">${T.name} 좌판 · ${T.name} ${armPrice(a.id, 1)}</span>`, on: false, own: false })); continue; }
    g.append(card({ icon: gsvg('food'), name: `${a.name} ${l}단계`, sub: `${armLine(d)} · 싸움 전용`, on: t.arm === a.id, own: true, click: () => { holdArm(a.id); rebuild?.(); } }));
  }
};

/* ---------- 좌판: 터 문 옆 ---------- */
function paint(g, hex) {
  g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k); g.computeVertexNormals();
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
function stallGeo() {
  const G = [];
  G.push(paint(new THREE.BoxGeometry(1.9, 0.12, 0.8).translate(0, 0.86, 0), '#6a4b2c')); // 판
  G.push(paint(new THREE.BoxGeometry(1.8, 0.75, 0.7).translate(0, 0.42, 0), '#45464b')); // 아래 현무암 칸
  for (const s of [-1, 1]) G.push(paint(new THREE.CylinderGeometry(0.05, 0.06, 2.2, 5).translate(s * 0.9, 1.1, -0.35), '#5a4126'));
  G.push(paint(new THREE.BoxGeometry(2.1, 0.06, 1.2).rotateX(0.3).translate(0, 2.15, -0.05), '#f08a24')); // 귤색 차양
  G.push(paint(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 12).rotateX(Math.PI / 2).translate(0.55, 1.15, 0.05), '#d8a63c')); // 작은 징
  G.push(paint(new THREE.BoxGeometry(0.34, 0.08, 0.24).translate(-0.45, 0.96, 0.1), '#c8333a'));
  G.push(paint(new THREE.BoxGeometry(0.3, 0.12, 0.22).translate(-0.05, 0.98, 0.12), '#3a6fc0'));
  return mergeGeometries(G);
}
const mat = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradHard });
const geo = stallGeo();
const stalls = []; // { zone, x, z, rot, mesh, front: Vector3, npc: Vector3 }
function placeStalls() {
  for (const s of stalls) { scene.remove(s.mesh); const i = interactables.indexOf(s.act); if (i >= 0) interactables.splice(i, 1); }
  stalls.length = 0;
  for (const a of late.arenaApi?.list?.() || []) {
    const f = [Math.sin(a.face), Math.cos(a.face)], tg = [Math.cos(a.face), -Math.sin(a.face)], R = A.r + T.stall.out;
    const x = a.x + f[0] * R + tg[0] * T.stall.side, z = a.z + f[1] * R + tg[1] * T.stall.side, y = height(x, z);
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); mesh.rotation.y = a.face; mesh.castShadow = false; mesh.receiveShadow = !LOW; mesh.visible = false; mesh.matrixAutoUpdate = false; mesh.updateMatrix(); scene.add(mesh);
    const fx = x + f[0] * 1.3, fz = z + f[1] * 1.3, nx = x - f[0] * 0.75, nz = z - f[1] * 0.75;
    const s = { zone: a.zone, x, z, rot: a.face, mesh, front: new THREE.Vector3(fx, height(fx, fz), fz), npc: new THREE.Vector3(nx, height(nx, nz), nz) };
    s.act = { ic: 'shop', pos: s.front, r: T.stall.r, label: `${T.stall.npc} · ${T.name} 좌판`, when: () => !late.swarm?.state?.() && !state.cave && !late.tut?.active, act: () => openStall(s.zone) };
    interactables.push(s.act); stalls.push(s);
  }
}
placeStalls();
let keeper = null;
function npc() {
  if (keeper) return keeper;
  keeper = caseModel('arena-keeper'); /* Tripo 망고 좌판 주인 (#262): 손 흔들기·징 채·망고 내밀기 */
  keeper.root.visible = false; scene.add(keeper.root); return keeper;
}

/* ---------- 좌판 창 ---------- */
let stallZ = 1;
const priceTag = (n, poor) => `<span class="price tok${poor ? ' poor' : ''}"><i></i>${n}</span>`;
function cardEl({ art, name, sub, right, cls = '', click }) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'menu-card ' + cls;
  b.innerHTML = `${art}<span class="mn"><b>${name}</b><small>${sub}</small></span><span class="mv">${right}</span>`;
  if (click) b.addEventListener('click', click); return b;
}
function fillStall(grid) {
  const t = TK(); $('shoppop-coins').textContent = String(t.n);
  for (const { a, lv } of stallArms(stallZ)) {
    const have = t.own[a.id] || 0, next = have + 1, can = next <= lv, d = armDef(a.id, Math.min(LV_MAX, can ? next : Math.max(1, have)), WEAPONS), p = can ? armPrice(a.id, next) : 0;
    const right = can ? priceTag(p, t.n < p) : `<span class="bf">${have >= LV_MAX ? '끝 단계' : '더 깊은 터에서'}</span>`;
    const c = cardEl({ art: gsvg('food'), name: `${a.name} ${can ? next : have}단계`, sub: `${armLine(d)} · ${a.desc}${have ? ` · 가진 것 ${have}단계` : ''}`, right, cls: !can ? 'have' : t.n < p ? 'poor' : '', click: can ? () => buyArm(a.id) : have ? () => { holdArm(a.id); toast(`${a.name} 들었어요`, 1.4); } : null });
    c.dataset.id = a.id; grid.append(c);
  }
  for (const cl of stallCloth(stallZ)) {
    const own = !!CL.own[cl.id], p = cl.tokPrice, s = cl.tokStat, W = WSLOT[cl.slot];
    const sub = (s.hp ? `기운 ×${s.hp}` : s.regen ? `회복 ×${s.regen}` : s.guard ? `받는 피해 -${Math.round(s.guard * 100)}%` : `피해 +${Math.round((s.dmg || 0) * 100)}% · ${W?.name} 줍기 몫 없음`) + ' · 여섯 칸 = 한 번 일어남';
    const c = cardEl({ art: clothSvg(cl, 'food'), name: cl.name, sub, right: own ? `<span class="bf">${CL.wear[cl.slot] === cl.id ? '입음' : '가짐'}</span>` : priceTag(p, t.n < p), cls: own ? 'have' : t.n < p ? 'poor' : '', click: own ? () => wearTok(cl) : () => buyCloth(cl) });
    c.dataset.id = cl.id; grid.append(c);
  }
}
SHOP_POP.tok = { head: { logo: LOGO, name: `${T.stall.npc}의 ${T.name} 좌판`, tag: `${T.name}로만 · 귤은 안 받아요`, cls: 'tok' }, fill: fillStall, can: () => !late.swarm?.state?.() };
function openStall(z) { stallZ = Math.max(1, Math.min(5, z | 0)); openShopPop('tok'); }
function spend(n) { const t = TK(); if (t.n < n) { toast(`${T.name}가 ${n - t.n}개 모자라요 · 터에서 버티면 얻어요`, 2.2); return false; } t.n -= n; late.sound?.coin?.(); return true; }
function buyArm(id) {
  const t = TK(), l = (t.own[id] || 0) + 1, a = TOK_ARM[id];
  if (!a || l > LV_MAX || a.lv[l - 1].z > stallZ) return false;
  if (!spend(armPrice(id, l))) return false;
  t.own[id] = l; t.arm = id; persist(); holdArm(id); refreshShopPop(); late.bagRefresh?.();
  toast(l === 1 ? `${a.name} · 들었어요 (내 가방 무기 탭에서 바꿔요)` : `${a.name} ${l}단계`, 2.4); return true;
}
function wearTok(cl) { if (!CL.own[cl.id]) return false; CL.wear[cl.slot] = cl.id; persist(); syncEquipGear(); runner.apply(save.outfit); late.net?.send(true); refreshShopPop(); late.bagRefresh?.(); return true; }
function buyCloth(cl) {
  if (CL.own[cl.id] || cl.tokZ > stallZ) return false;
  if (!spend(cl.tokPrice)) return false;
  CL.own[cl.id] = 1; wearTok(cl); toast(suitFull() ? '한 벌을 다 갖췄어요 · 판 중 한 번 다시 일어나요' : `${cl.name} · 입었어요`, 2.4); return true;
}

/* ---------- 징을 칠 때: 싸움 차림으로 갈아입을까요? ---------- */
const ask = document.createElement('div'); ask.id = 'tok-ask'; ask.hidden = true; ask.setAttribute('role', 'dialog');
ask.innerHTML = '<b>싸움 차림으로 갈아입을까요?</b><div class="row"><button type="button" class="btn" data-a="y">갈아입기</button><button type="button" class="btn ghost" data-a="n">그대로</button></div>';
document.body.append(ask);
let askZ = 0;
ask.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  ask.hidden = true; if (b.dataset.a === 'y') wearKit('fight');
  const z = askZ; askZ = 0; if (z) { const w = startRaw(z); if (w) toast(SWARM_TEXT_WHY(w), 2); }
});
const SWARM_TEXT_WHY = (w) => (w === 'rest' ? '아직 쉬는 시간이에요' : '지금은 시작할 수 없어요');
let startRaw = (z) => 'off';
{ const S = late.swarmArena; if (S) { const s0 = S.start.bind(S); startRaw = s0; S.start = (z) => {
  const k = TK().kit.fight, w = S.can(z);
  if (!w && k && !sameKit(k) && !askZ) { askZ = z; ask.hidden = false; return ''; } // 묻는 동안은 판을 열지 않음 (고르면 시작)
  return s0(z);
}; } }

/* ---------- 서버가 맞춘 징표 ---------- */
late.tokFix = (tk) => { save.tok = tk; normTok(save); armK = '?'; persist(); late.bagRefresh?.(); if (shopOpen()) refreshShopPop(); toast(`${T.name}를 서버 기록에 맞췄어요`, 2); };
const shopOpen = () => !$('shoppop').hidden && $('shoppop').classList.contains('tok');

/* ---------- 매 프레임 (arena.js late.tickArena 를 감쌈) ---------- */
const pill = document.createElement('span'); pill.id = 'where-tok'; pill.hidden = true; pill.title = T.name; pill.innerHTML = gsvg() + '<i></i>';
$('xy-pill')?.appendChild(pill);
let tagT = 0, lastN = -1, shown = false, nearS = null;
function tick(dt) {
  if (window.__oreum && !window.__oreum.tok) window.__oreum.tok = api;
  if (keeper?.root.visible) { const d = Math.hypot(keeper.root.position.x - player.pos.x, keeper.root.position.z - player.pos.z); keeper.play(d < T.stall.r + 1.5 ? 'offer' : d < 14 ? 'wave' : 'idle'); keeper.lookAt(d < 14 ? player.pos : null); keeper.update(dt); } /* 다가오면 손 흔들고, 좌판 앞이면 망고를 내밂 */
  const run = late.swarm?.state?.();
  if (run && !curRun) { curRun = run.zone; leaderOut = false; wasDown = false; reviveUsed = false; }
  if (!run && curRun) curRun = null;
  if ((tagT -= dt) > 0) return; tagT = 0.4;
  const px = player.pos.x, pz = player.pos.z; let bd = 1e18, best = null;
  for (const s of stalls) { const d = (s.x - px) ** 2 + (s.z - pz) ** 2; if (d < bd) { bd = d; best = s; } }
  const D = Math.sqrt(bd), drawR = LOW ? 150 : 220;
  for (const s of stalls) s.mesh.visible = (s.x - px) ** 2 + (s.z - pz) ** 2 < drawR * drawR;
  const k = best && D < T.stall.near ? npc() : keeper;
  if (k) { k.root.visible = !!best && D < T.stall.near; if (k.root.visible && nearS !== best) { nearS = best; k.root.position.copy(best.npc); k.root.rotation.y = best.rot; } }
  const show = !!best && D < A.tagR + 10 && !state.cave;
  if (show !== shown || TK().n !== lastN) { shown = show; lastN = TK().n; pill.hidden = !show; pill.lastChild.textContent = String(lastN); pill.setAttribute('aria-label', `${T.name} ${lastN}개`); }
}
{ const t0 = late.tickArena; late.tickArena = (dt) => { t0?.(dt); tick(dt); }; }

/* ---------- 확인용 (window.__oreum.tok) ---------- */
const api = late.tokApi = {
  last: null,
  state: () => ({ ...JSON.parse(JSON.stringify(TK())), arming: late.tokArm()?.tok || null, weapon: late.weaponNow?.()?.id, dmg: late.weaponNow?.()?.dmg, suit: suitFull(), suitDmg: suitDmg(), revive: reviveReady() }),
  stalls: () => stalls.map((s) => ({ zone: s.zone, x: +s.x.toFixed(1), z: +s.z.toFixed(1), fx: +s.front.x.toFixed(1), fz: +s.front.z.toFixed(1), drawn: s.mesh.visible })),
  open: (z = 1) => openStall(z), shopOpen, cards: () => [...document.querySelectorAll('#shoppop-cards .menu-card')].map((c) => ({ id: c.dataset.id, cls: c.className, text: c.textContent })),
  buyArm: (id, z) => { if (z) stallZ = z; return buyArm(id); }, buyCloth: (id, z) => { if (z) stallZ = z; return TOK_CLOTH[id] ? buyCloth(TOK_CLOTH[id]) : false; },
  hold: (id) => holdArm(id), wear: (id) => (TOK_CLOTH[id] ? wearTok(TOK_CLOTH[id]) : false),
  give: (n, z = 1, win = false) => give(n, z, win, 'test'), /* 확인용: 판 없이 징표 (서버는 rec 상한·통으로 깎음) */
  runTokens, saveKit, wearKit, kit: () => JSON.parse(JSON.stringify(TK().kit)), asking: () => !ask.hidden, answer: (y) => ask.querySelector(`[data-a="${y ? 'y' : 'n'}"]`).click(),
  wearV: (k) => wearV(k), lost: lostSlots, go: (z = 1) => { const s = stalls.find((q) => q.zone === z); if (!s) return null; player.pos.copy(s.front); player.target = null; player.heading = s.rot + Math.PI; return { x: s.front.x, z: s.front.z }; },
  place: placeStalls, fix: (tk) => late.tokFix(tk),
};
