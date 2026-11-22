// 철 이벤트 (#180 크리스마스) 게임 연결. 모양은 src/season.js, 날짜·달력·트리 셈은 src/seasoncal.js, 수치는 balance.js SEASON
// - 켜짐: 서버 날짜(GET /season, 없으면 기기 시계)가 기간 안이면. 어드민 설정 '철 이벤트' 로 기간 밖에서도 켜고 끔(이 기기만, localStorage)
// - 꺼지면 꾸밈은 모두 숨고 예전 모습 그대로. 얻은 옷은 남음, 눈덩이는 기간에만
// - 저장 save.season.xmas (seasoncal.js cleanXmas). 서버가 달력 날짜·트리 선물·선물 옷을 확인 (server/src/validate.js)
// - late.season: isOn(kind) · dress(d) 투기꾼 · repel(d, pos) · snowThrow(tg) · tick(dt, t) · fixed() 서버가 바로잡음 · test
import { veiled } from '../ufoveil.js';
import * as THREE from 'three';
import { SEASON, CLOTHES } from '../balance.js';
import { xmasDay, kst, calReward, calCost, calOpenable, treeStage, cleanXmas, XMAS_CLOTHES } from '../seasoncal.js';
import { buildTree, buildWreath, santaHat, rudolph, dressSanta, giftBox, makeBulbs, lampSpiral, eaveLine, snowMat, bake } from '../season.js';
import { STREET } from '../streetlayout.js';
import { getSeason } from '../online.js';
import { height } from '../world.js';
import { LOW } from '../gfx2.js';
import { state, late } from './state.js';
import { $, save, persist, CL } from './save.js';
import { scene, NSW, spots, lamps, lampNight } from './scene.js';
import { life, player, trash, CHS, shopsBuilt, col } from './place.js';
import { toast, updateStats, closePanels, panelOpen } from './hud.js';
import { say } from './director.js';
import { gyulShower, sound } from './hooks.js';
import { weaponNow } from './throw.js';

const X = SEASON.xmas;
const CN = Object.fromEntries(CLOTHES.map((c) => [c.id, c]));
const SK = 'oreumoreum.hwi.season'; // 어드민 미리 보기: '' 기간대로 · 'on' · 'off' (이 기기만)
let mode = ''; try { mode = localStorage.getItem(SK) || ''; } catch (e) { mode = ''; }
const srv = { now: 0, at: 0, total: -1, day: 0 }; // 서버 날짜·트리 합계 (받은 때 at = performance.now)
const nowMs = () => (srv.now ? srv.now + (performance.now() - srv.at) : Date.now());
const realDay = () => xmasDay(nowMs());
export const xmasOn = () => (mode === 'on' ? true : mode === 'off' ? false : realDay() > 0);
const calDay = () => Math.min(X.cal.days + 6, realDay() || (mode === 'on' ? Math.min(X.cal.days, Math.max(1, kst(nowMs()).d)) : 0)); // 미리 보기는 이 달 며칠을 그날로
const XS = () => { if (!save.season || typeof save.season !== 'object') save.season = {}; if (!save.season.xmas || !Array.isArray(save.season.xmas.days)) save.season.xmas = cleanXmas(save.season.xmas); return save.season.xmas; };

/* ---------- 꾸밈 (처음 켤 때 한 번 만듦) ---------- */
let deco = null;
function buildDeco() {
  const g = new THREE.Group(); g.name = 'xmas'; scene.add(g);
  const bulbPts = [];
  (lamps.points || []).forEach((p) => bulbPts.push(...lampSpiral(p, LOW ? X.bulbs.lampLow : X.bulbs.lamp)));
  const wreaths = [];
  for (const sh of shopsBuilt) { // 가게 처마 줄 + 문 리스
    const L = STREET.lot(sh.lot); if (!L) continue;
    const fx = Math.sin(L.rot), fz = Math.cos(L.rot), rx = Math.cos(L.rot), rz = -Math.sin(L.rot), hw = Math.min(3.2, (L.w || 6) * 0.3), ins = -0.2;
    const cx = L.front.x - fx * ins, cz = L.front.z - fz * ins, y = height(cx, cz) + 3.1;
    bulbPts.push(...eaveLine(new THREE.Vector3(cx - rx * hw, y, cz - rz * hw), new THREE.Vector3(cx + rx * hw, y, cz + rz * hw), LOW ? X.bulbs.eaveLow : X.bulbs.eave));
    const w = buildWreath(0.42); w.position.set(cx, y - 0.9, cz); w.rotation.y = L.rot; wreaths.push(w);
  }
  for (const c of CHS) { // 클린하우스 리스 + 빨간 리본
    const dx = c.front.x - c.center.x, dz = c.front.z - c.center.z, L = Math.hypot(dx, dz) || 1, x = c.center.x + dx / L * Math.min(L, 1.6), z = c.center.z + dz / L * Math.min(L, 1.6);
    const w = buildWreath(0.5, true); w.position.set(x, height(x, z) + 2.4, z); w.rotation.y = Math.atan2(dx, dz); wreaths.push(w);
  }
  const wg = new THREE.Group(); wreaths.forEach((w) => wg.add(w)); g.add(bake(wg)); // 리스는 모두 한 메시
  const bulbs = makeBulbs(bulbPts); g.add(bulbs.mesh);
  const hats = life.hareubangs.map((hb) => { const h = santaHat(0.42); h.position.set(0, 2.95, 0.05); h.userData.y0 = 2.95; (hb.head || hb.root).add(h); if (hb.head) hb.head.userData.hat = h; return h; }); /* 몸통(흔들리는 그룹)에 씌움 (#216) */
  // 들머리 큰 트리
  const tree = buildTree({ low: LOW }), s0 = spots.start, hd = spots.startHeading || 0;
  const tx = s0.x - Math.cos(hd) * X.tree.at[0] + Math.sin(hd) * X.tree.at[1], tz = s0.z + Math.sin(hd) * X.tree.at[0] + Math.cos(hd) * X.tree.at[1];
  tree.root.position.set(tx, height(tx, tz) - 0.05, tz); g.add(tree.root);
  if (col) col.add(tx, tz, tree.r * 0.55);
  deco = { g, bulbs, hats, tree, wreaths, pos: new THREE.Vector3(tx, height(tx, tz), tz) };
}

/* ---------- 켜고 끄기 ---------- */
let applied = null, snowK = 0;
function apply() {
  const on = xmasOn();
  if (on && !deco && NSW) buildDeco();
  if (deco) { deco.g.visible = on; deco.hats.forEach((h) => { h.visible = on; }); }
  for (const e of life.enemies.list) if (e.xmasDeco) e.xmasDeco.visible = on;
  sound.setWinter?.(on);
  $('menu-xmas').hidden = !on;
  applied = on; refreshDot(); late.tips?.refresh?.();
  const v = $('adm-season-v'); if (v) v.textContent = mode === 'on' ? '켬' : mode === 'off' ? '끔' : `기간대로 (${realDay() ? '켜짐' : '꺼짐'})`;
  document.querySelectorAll('[data-season]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.season === mode))); // #153 고른 것은 눌린 모양
}
function setMode(m) { mode = m === 'on' || m === 'off' ? m : ''; try { if (mode) localStorage.setItem(SK, mode); else localStorage.removeItem(SK); } catch (e) { /* 무시 */ } apply(); }
document.querySelectorAll('[data-season]').forEach((b) => b.addEventListener('click', () => { setMode(b.dataset.season); toast('철 이벤트: ' + (mode === 'on' ? '켬' : mode === 'off' ? '끔' : '기간대로')); }));

// 첫 화면 로고는 철 이벤트에도 그대로 둔다 (#192: 로고 위 눈 덩이가 구름처럼 보여 뺌)

/* ---------- 트리 (모두 함께) ---------- */
let pollT = 2, lastPicked = -1;
const treeTotal = () => (srv.total >= 0 ? srv.total : XS().lp);
async function poll() {
  if (!getSeason) return;
  try { const r = await getSeason(); if (r && Number.isFinite(r.now)) { srv.now = r.now; srv.at = performance.now(); srv.total = Math.max(0, r.total | 0); srv.day = r.day | 0; if (applied !== xmasOn()) apply(); } } catch (e) { /* 다음에 다시 */ }
}
function tickTree(dt) {
  const xs = XS(), st = treeStage(treeTotal());
  deco?.tree.setStage(st);
  if (st > xs.seen && state.sessionOn) {
    const top = st >= X.tree.stages;
    if (say('quest', 'xmasTree', top ? '모두의 트리에 귤 별이 떴어요!' : `모두가 주운 쓰레기로 트리 장식이 늘었어요 (${st}/${X.tree.stages})`, 3.6)) { xs.seen = st; persist(); }
  }
  if (st >= X.tree.stages && !xs.tree && state.sessionOn && realDay()) { // 다 채우면 접속한 모두에게 선물 (서버가 합계로 확인)
    xs.tree = 1; late.notEarned?.(X.tree.gift); save.coins += X.tree.gift; persist(); gyulShower(X.tree.gift); toast(`트리 선물 · 귤 +${X.tree.gift}`, 3.5);
  }
}

/* ---------- 접속 달력 ---------- */
function refreshDot() { const d = calDay(), xs = save.season?.xmas; $('xmas-dot').hidden = !(xmasOn() && d >= 1 && d <= X.cal.days && !(xs?.days || []).includes(d)); }
function rewardText(r) { return r.coins ? `귤 ${r.coins}` : r.cloth ? CN[r.cloth]?.name || '겨울 옷' : '눈덩이'; }
function buildCal() {
  const xs = XS(), today = calDay(), box = $('xmas-cal'); box.innerHTML = '';
  for (let d = 1; d <= X.cal.days; d++) {
    const b = document.createElement('button'); b.type = 'button'; const done = xs.days.includes(d), r = calReward(d), can = calOpenable(d, today);
    b.className = done ? 'done' : d === today ? 'today' : can ? 'miss' : 'lock'; if (!r.coins) b.classList.add('gift');
    b.innerHTML = `${d}<small>${done ? '받음' : d === today ? '열기' : can ? `귤 ${X.cal.miss}` : ''}</small>`;
    b.setAttribute('aria-label', `12월 ${d}일 · ${rewardText(r)} · ${done ? '받음' : d === today ? '오늘 열기' : can ? `귤 ${X.cal.miss}로 열기` : '아직'}`);
    b.disabled = done || !can; b.addEventListener('click', () => openDay(d));
    box.append(b);
  }
  const st = treeStage(treeTotal()); $('xmas-bar').style.width = `${(st / X.tree.stages) * 100}%`; $('xmas-stage').textContent = `${st}/${X.tree.stages}`;
  const own = xs.days.includes(X.cal.days); $('xmas-snowrow').hidden = !own; $('xmas-snow').setAttribute('aria-pressed', String(!!xs.snow)); $('xmas-snow').textContent = xs.snow ? '눈덩이 쓰는 중' : '눈덩이 쓰기';
}
function openCal() { if (!xmasOn()) return; closePanels(); buildCal(); $('xmas').hidden = false; }
function openDay(d) {
  const xs = XS(), today = calDay();
  if (xs.days.includes(d) || !calOpenable(d, today)) return false;
  const cost = calCost(d, today);
  if (cost && save.coins < cost) { toast(`귤이 ${cost - save.coins}개 더 필요해요`); return false; }
  save.coins -= cost; xs.days.push(d); xs.days.sort((a, b) => a - b);
  const r = calReward(d);
  if (r.coins) { late.notEarned?.(r.coins); save.coins += r.coins; gyulShower(r.coins); }
  if (r.cloth && CN[r.cloth]) { CL.own[r.cloth] = 1; toast(`${CN[r.cloth].name}을(를) 받았어요 · 내 가방에서 입어요`, 3.4); }
  if (r.snow) { xs.snow = 1; toast('눈덩이를 받았어요 · 굼부리·정상에서 손으로 던지면 눈덩이', 3.6); }
  persist(); updateStats(); sound.coin?.(); buildCal(); refreshDot();
  return true;
}
$('menu-xmas').addEventListener('click', openCal);
$('xmas-snow').addEventListener('click', () => { const xs = XS(); if (!xs.days.includes(X.cal.days)) return; xs.snow = xs.snow ? 0 : 1; persist(); buildCal(); });
let calAsked = false;
function tickCal() {
  if (calAsked || !state.sessionOn || !save.tut?.done || panelOpen()) return;
  const d = calDay(); if (!(d >= 1 && d <= X.cal.days) || XS().days.includes(d)) return;
  calAsked = true; late.director?.ask('quest', 'xmasCal', () => openCal(), { sec: 6, ttl: 600 }); // 그날 처음 들어오면 달력 (감독 차례로)
}

/* ---------- 산타 투기꾼·선물 상자 ---------- */
const gifts = [];
function dress(d) { if (!xmasOn() || d.kind !== 'walker' || Math.random() >= X.santa.p) return; try { dressSanta(d); } catch (e) { /* 모양만 */ } }
function repel(d, pos) {
  if (!d?.santa) return;
  const xs = XS(), day = calDay() || kst(nowMs()).d; if (xs.gd !== day) { xs.gd = day; xs.gn = 0; }
  if (xs.gn >= X.santa.dayMax) return; // 하루 상한 (#180 귤 벌이 10% 안)
  const m = giftBox(); m.position.set(pos.x, height(pos.x, pos.z), pos.z); m.rotation.y = Math.random() * 6; scene.add(m);
  gifts.push({ m, t: 30, y0: m.position.y });
  toast('산타 투기꾼이 선물 상자를 떨궜어요', 2.6);
}
function openGift(gf) {
  const xs = XS(); xs.gn++;
  const left = XMAS_CLOTHES.filter((id) => !CL.own[id]);
  if (Math.random() < X.santa.gift && left.length && xs.gift.length < X.santa.giftMax) {
    const id = left[Math.floor(Math.random() * left.length)]; CL.own[id] = 1; xs.gift.push(id); toast(`선물 상자: ${CN[id].name}!`, 3.2);
  } else { const [a, b] = X.santa.coins, n = a + Math.floor(Math.random() * (b - a + 1)); late.notEarned?.(n); save.coins += n; gyulShower(n); toast(`선물 상자 · 귤 +${n}`, 2.6); }
  persist(); updateStats(); sound.coin?.();
  scene.remove(gf.m);
}
function tickGifts(dt, t) {
  for (let i = gifts.length - 1; i >= 0; i--) {
    const gf = gifts[i]; gf.t -= dt; gf.m.rotation.y += dt; gf.m.position.y = gf.y0 + 0.15 + Math.sin(t * 3 + i) * 0.08;
    if (Math.hypot(gf.m.position.x - player.pos.x, gf.m.position.z - player.pos.z) < 2.2 && !player.down) { gifts.splice(i, 1); openGift(gf); continue; }
    if (gf.t <= 0) { scene.remove(gf.m); gifts.splice(i, 1); }
  }
}

/* ---------- 눈덩이 ---------- */
const inSnow = (p) => !!trash && X.snowZones.includes(trash.zoneAt(p.x, p.z));
const snowReady = () => xmasOn() && !!save.season?.xmas?.snow && (save.season.xmas.days || []).includes(X.cal.days) && weaponNow().id === 'hand' && inSnow(player.pos);
function snowThrow(tg) {
  if (!tg || !snowReady()) return;
  tg.snow = true; tg.mesh.material = snowMat; tg.mesh.children.forEach((c) => { c.visible = false; }); tg.mesh.scale.multiplyScalar(1.15);
}
const puffs = []; const puffG = new THREE.SphereGeometry(0.12, 5, 4);
function puff(p, n = 6) {
  for (let k = 0; k < n; k++) {
    let q = puffs.find((o) => o.t <= 0); if (!q) { if (puffs.length > 30) return; q = { m: new THREE.Mesh(puffG, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false })), t: 0, v: new THREE.Vector3() }; scene.add(q.m); puffs.push(q); }
    q.m.position.copy(p); q.v.set((Math.random() - 0.5) * 3, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 3); q.t = 0.6; q.m.visible = true;
  }
}
function tickPuffs(dt) { for (const q of puffs) { if (q.t <= 0) continue; q.t -= dt; q.v.y -= 9 * dt; q.m.position.addScaledVector(q.v, dt); q.m.material.opacity = Math.max(0, q.t / 0.6); if (q.t <= 0) q.m.visible = false; } }
life.hooks.snowHit = (e, p) => { e.slowT = X.snowball.slowT; e.slowK = X.snowball.slow; puff(p, 8); };
life.hooks.snowLand = (p) => puff(p, 5);

/* ---------- 멧돼지 루돌프·오름 방송·식사 빛 ---------- */
function tickEnemies() {
  const on = xmasOn();
  for (const e of life.enemies.list) {
    if (e.xmasDeco || !on || (e.kind !== 'boar' && e.kind !== 'piglet') || !e.head) continue;
    e.xmasDeco = rudolph(); e.head.add(e.xmasDeco);
  }
}
let radioT = 90, lineI = Math.floor(Math.random() * X.lines.length);
function tickRadio(dt) {
  if (!state.sessionOn || !save.tut?.done) return;
  if ((radioT -= dt) > 0) return;
  const [a, b] = X.radio.every; radioT = a + Math.random() * (b - a);
  let t = X.lines[lineI++ % X.lines.length]; if (veiled(t)) t = X.lines[lineI++ % X.lines.length]; /* #207 단계 3 전엔 UFO 줄 건너뜀 */
  say('radio', 'xmasRadio', '오름 방송 · ' + t, 4.2, { queue: false });
}

/* ---------- 매 프레임 ---------- */
let slowT = 0;
function tick(dt, t) {
  if ((pollT -= dt) <= 0) { pollT = X.tree.poll; poll(); }
  const on = xmasOn();
  if (on !== applied) apply();
  // 쌓인 눈: 켜고 끌 때 천천히
  snowK += ((on ? X.snow : 0) - snowK) * Math.min(1, dt * 1.5);
  if (NSW?.zoneSnow) for (const z of X.snowZones) NSW.zoneSnow[z] = snowK < 0.002 ? 0 : snowK;
  $('xmas-glow').classList.toggle('on', on && !!save.buff && save.buff.id === 'vin');
  if (!on) { if (gifts.length) tickGifts(dt, t); tickPuffs(dt); return; }
  if (deco) { deco.bulbs.U.uTime.value = t; deco.bulbs.U.uNight.value = lampNight; deco.tree.update(dt, t, lampNight); }
  if (trash && realDay()) { const pc = trash.store.pickedCount(); if (lastPicked >= 0 && pc > lastPicked) XS().lp += pc - lastPicked; lastPicked = pc; } // 서버 없이 할 때 내 몫으로 트리
  if ((slowT -= dt) <= 0) { slowT = 0.5; tickEnemies(); tickTree(); tickCal(); refreshDot(); }
  tickGifts(dt, t); tickPuffs(dt); tickRadio(dt);
}

late.season = {
  isOn: (kind) => kind === 'xmas' && xmasOn(), dress, repel, snowThrow, tick,
  fixed: () => { if (!$('xmas').hidden) buildCal(); refreshDot(); },
  test: {
    state: () => ({ on: xmasOn(), mode, realDay: realDay(), calDay: calDay(), srv: { ...srv }, xs: structuredClone(save.season?.xmas || null), stage: deco?.tree.stage ?? -1, gifts: gifts.length, decoN: deco ? { bulbs: deco.bulbs.mesh.count, wreaths: deco.wreaths.length, hats: deco.hats.length } : null, snow: NSW?.zoneSnow ? [...NSW.zoneSnow] : null, snowReady: snowReady() }),
    mode: setMode, open: openCal, day: openDay, total: (n) => { srv.total = n; tickTree(); }, gift: (x = player.pos.x + 3, z = player.pos.z) => repel({ santa: true }, new THREE.Vector3(x, 0, z)),
    santa: () => { const d = late.dumpers?.list.find((v) => v.kind === 'walker' && !v.santa); if (d) dressSanta(d); return !!d; }, treePos: () => deco?.pos.clone(), puff,
  },
};
apply();
