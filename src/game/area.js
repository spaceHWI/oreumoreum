// 구역 구분 (#136): 초보(1~2)·중수(3)·고수(4~5). 문턱·분위기 소품은 src/zonelook.js, 여기는 게임 연결
// - 구역이 바뀌면(pickup.js tickZone → late.zoneEnter): 화면 가운데 구역 이름 배너(권장 Lv), 권장 레벨보다 2 낮으면 한 번 경고 토스트·레벨은 됐는데 장비가 많이 모자라면 '장비점에 들러요',
//   튜토리얼 뒤 처음 초보→중수(정낭)를 지나면 팁 '위로 갈수록 어려워져요', 구역 소리(바람·억새·음악)·안개
// - 오름 지도: 위 구역 칸을 누르면 구역을 세 묶음 색으로 칠한 지도와 구역별 적·권장 점수
// (파일 순서는 src/modules.js: pickup 뒤. 규칙은 notes/prototype-v1.md 코드 구조)
import { ZONE_LOOK as ZL, ZONES } from '../balance.js';
import { createZoneLook, tierOf, tierName, tierColor, zoneShort, zoneEnemy, enemyName, enemySvg, josaIGa } from '../zonelook.js';
import { gearScore, zoneRecLv, myLv, zoneToneLv, gearShort } from '../gearscore.js';
import { ZONE_BOX } from '../zones.js';
import { nsPaths } from '../namsongi.js';
import { height, surfaceAt } from '../world.js';
import { LOW } from '../gfx2.js';
import { state, late } from './state.js';
import { $, save } from './save.js';
import { scene, NSW, spots, setZoneFog } from './scene.js';
import { trash, bloom, col, player, CHS } from './place.js';
import { toast, closePanels } from './hud.js';
import { say } from './director.js'; // #176

export const zoneLook = trash && NSW ? createZoneLook({ scene, height, zoneAt: trash.zoneAt, paths: nsPaths, heaps: trash.heaps, col, low: LOW, onPath: (x, z) => surfaceAt(x, z) !== 0, isBloomed: (z) => !!bloom?.isBloomed(z), ns: NSW, avoid: spots.lamps || [] }) : null;
if (zoneLook && bloom) bloom.on((ev) => { if (ev === 'zone-bloom' || ev === 'zone-wilt') { zoneLook.dirty(); ambTo(curZ); } }); // 다 피면 그을린 자국·까마귀가 사라지고 안개가 걷힘

/* ---------- 구역이 바뀔 때 ---------- */
let curZ = 0, shownZ = -1, shownAt = -1e9, leftZ = -1, leftAt = -1e9, zoneT = 0;
const warned = new Set();
const now = () => performance.now() / 1000;
function showTitle(z) { /* #252: 큰 구역 이름 대신 메시지 줄 한 줄 (왼쪽 점이 구역 등급 색). #251 권장 레벨 */
  const rl = zoneRecLv(z), ml = myLv(save);
  toast(`${zoneShort(z)} · ${tierName(z)} 구역 · 권장 Lv ${rl}${ml < rl ? ` (지금 Lv ${ml})` : ''}`, ZL.banner.sec, ml < rl ? 'warn' : 'info', { icon: `<b style="width:12px;height:12px;border-radius:50%;background:${tierColor(z)};box-shadow:0 0 0 2px rgba(255,255,255,.5)"></b>` });
  shownZ = z; shownAt = now();
}
// 구역 소리·안개 목표 (다 핀 구역은 안개가 걷힘)
const fog = { n: 1, f: 1, tn: 1, tf: 1 };
function ambTo(z) {
  late.sound?.setZoneAmb?.(ZL.wind[z] ?? 1, ZL.reed[z] ?? 1, ZL.music[z] ?? 1, ZL.lp[z] ?? 1);
  const F = bloom?.isBloomed(z) ? [1, 1] : (ZL.fog[z] || [1, 1]); fog.tn = F[0]; fog.tf = F[1];
}
late.zoneEnter = (z, prev) => {
  curZ = z;
  for (const el of [$('zone-pill'), $('xy-pill')]) { if (tierOf(z)) el.dataset.tier = tierOf(z); else delete el.dataset.tier; }
  ambTo(z);
  if (!state.sessionOn || late.tut?.active) { leftZ = prev; leftAt = now(); return; }
  const t = now();
  if (z && z !== shownZ && t - shownAt > ZL.banner.cool && !(z === leftZ && t - leftAt < ZL.banner.back)) showTitle(z);
  else if (z && z !== shownZ && z !== leftZ) shownZ = -1; // 너무 빨리 바뀌면 이번엔 건너뜀
  // 위 묶음으로 올라섰는데 레벨이 권장보다 낮음 (빨강, #251): 구역마다 한 번
  if (z && tierOf(z) >= 2 && tierOf(z) > tierOf(prev) && !warned.has(z) && zoneToneLv(save, z) === 'r') {
    warned.add(z); const en = enemyName(zoneEnemy(z));
    setTimeout(() => say('danger', 'zoneWarn:' + z, `이 위는 ${en}${josaIGa(en)} 나와요. 권장 Lv ${zoneRecLv(z)} (지금 Lv ${myLv(save)})`, 4, { ttl: 10 }), 900);
  }
  /* 레벨은 됐는데 장비가 많이 모자람 (#251, GROWTH.gearLow): 구역마다 한 번 */
  if (z && z > 1 && !warned.has('g' + z) && gearShort(save, z, gearScore(save).total)) {
    warned.add('g' + z);
    setTimeout(() => say('tip', 'gearLow:' + z, '장비가 모자라요. 장비점에 들러요', 4, { ttl: 10 }), 1400);
  }
  if (tierOf(prev) === 1 && tierOf(z) === 2) late.tips?.event('zoneUp'); // 튜토리얼 뒤 처음 정낭을 지날 때 (#66 팁은 한 번)
  leftZ = prev; leftAt = t;
};

/* ---------- 오름 지도 ---------- */
const MAP_N = 220; // 구역 칠하기 격자
let mapBase = null;
export const mapXY = (x, z, W) => [(x - ZONE_BOX.x0) / ZONE_BOX.size * W, (z - ZONE_BOX.z0) / ZONE_BOX.size * W]; // 위 = 북쪽(-z)
export function buildMapBase(W, labels = true) { // labels: 구역 번호 (#138 미니맵은 뺌)
  const c = document.createElement('canvas'); c.width = c.height = W; const x = c.getContext('2d');
  const img = x.createImageData(MAP_N, MAP_N), cs = ZONE_BOX.size / MAP_N, rgb = [null, ...ZL.tiers.slice(1).map((t) => [1, 3, 5].map((i) => parseInt(t.color.slice(i, i + 2), 16)))];
  const grid = new Uint8Array(MAP_N * MAP_N);
  for (let j = 0; j < MAP_N; j++) for (let i = 0; i < MAP_N; i++) {
    const wx = ZONE_BOX.x0 + (i + 0.5) * cs, wz = ZONE_BOX.z0 + (j + 0.5) * cs, z = trash.zoneAt(wx, wz), t = tierOf(z), k = (j * MAP_N + i) * 4;
    grid[j * MAP_N + i] = z;
    const C = t ? rgb[t] : [40, 44, 36], a = t ? (z === 2 || z === 5 ? 200 : 165) : 0; // 같은 묶음 안의 두 구역은 진하기로 나눔
    img.data[k] = C[0]; img.data[k + 1] = C[1]; img.data[k + 2] = C[2]; img.data[k + 3] = a;
  }
  const t = document.createElement('canvas'); t.width = t.height = MAP_N; t.getContext('2d').putImageData(img, 0, 0);
  x.imageSmoothingEnabled = true; x.drawImage(t, 0, 0, W, W);
  // 탐방로
  x.strokeStyle = 'rgba(255,248,230,.85)'; x.lineWidth = W / 160; x.lineJoin = x.lineCap = 'round';
  for (const P of Object.values(nsPaths)) { x.beginPath(); P.forEach((p, i) => { const [u, v] = mapXY(p[0], p[1], W); i ? x.lineTo(u, v) : x.moveTo(u, v); }); x.stroke(); }
  // 문턱: 정낭(두 막대)·바위 문(세모)
  for (const G of zoneLook?.gates || []) { const [u, v] = mapXY(G.x, G.z, W), s = W / 55; x.save(); x.translate(u, v); x.fillStyle = '#20180c'; x.strokeStyle = '#fff'; x.lineWidth = W / 220;
    if (G.kind === 'rock') { x.beginPath(); x.moveTo(0, -s); x.lineTo(s, s * 0.8); x.lineTo(-s, s * 0.8); x.closePath(); x.fill(); x.stroke(); }
    else { x.rotate(Math.atan2(G.uz, G.ux)); x.fillRect(-s, -s * 0.5, s * 0.5, s); x.fillRect(s * 0.5, -s * 0.5, s * 0.5, s); x.strokeRect(-s, -s * 0.5, s * 0.5, s); x.strokeRect(s * 0.5, -s * 0.5, s * 0.5, s); }
    x.restore(); }
  // 클린하우스
  for (const h of CHS) { const [u, v] = mapXY(h.front.x, h.front.z, W); x.fillStyle = '#fff'; x.strokeStyle = '#20180c'; x.lineWidth = W / 220; x.beginPath(); x.rect(u - W / 110, v - W / 110, W / 55, W / 55); x.fill(); x.stroke(); }
  if (!labels) return c;
  // 구역 번호
  x.font = `800 ${Math.round(W / 15)}px "Gothic A1", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  // 구역 번호는 그 구역 안 가장 깊은 칸(둘레 R 칸이 모두 같은 구역)에. 없으면 가장 많이 같은 칸
  const at = (i, j) => (i < 0 || j < 0 || i >= MAP_N || j >= MAP_N ? 0 : grid[j * MAP_N + i]), lab = {};
  const cen = {}; for (let j = 0; j < MAP_N; j++) for (let i = 0; i < MAP_N; i++) { const z = at(i, j); if (z) { const c = cen[z] ||= [0, 0, 0]; c[0] += i; c[1] += j; c[2]++; } }
  for (let j = 0; j < MAP_N; j += 2) for (let i = 0; i < MAP_N; i += 2) { const z = at(i, j); if (!z) continue; let n = 0; for (let b = -8; b <= 8; b += 2) for (let a = -8; a <= 8; a += 2) if (at(i + a, j + b) === z) n++;
    const c = cen[z], d = Math.hypot(i - c[0] / c[2], j - c[1] / c[2]); if (!lab[z] || n > lab[z][2] || (n === lab[z][2] && d < lab[z][3])) lab[z] = [i, j, n, d]; }
  for (const z in lab) { const u = (lab[z][0] + 0.5) / MAP_N * W, v = (lab[z][1] + 0.5) / MAP_N * W; x.lineWidth = W / 90; x.strokeStyle = 'rgba(0,0,0,.55)'; x.strokeText(z, u, v); x.fillStyle = '#fff'; x.fillText(z, u, v); }
  return c;
}
function drawMap() {
  const cv = $('omap-c'), W = cv.width, x = cv.getContext('2d');
  if (!mapBase) mapBase = buildMapBase(W);
  x.clearRect(0, 0, W, W); x.drawImage(mapBase, 0, 0);
  late.fieldMap?.(x, W); // #138 가 본 곳·더미·소굴·보물·볼거리 아이콘
  // 나: 귤색 화살표
  const [u, v] = mapXY(player.pos.x, player.pos.z, W), h = player.heading, s = W / 30;
  x.save(); x.translate(u, v); x.rotate(Math.atan2(Math.sin(h), Math.cos(h)) * -1 + Math.PI); x.beginPath(); x.moveTo(0, -s); x.lineTo(s * 0.62, s * 0.7); x.lineTo(0, s * 0.35); x.lineTo(-s * 0.62, s * 0.7); x.closePath();
  x.fillStyle = '#ff8a1f'; x.fill(); x.lineWidth = W / 160; x.strokeStyle = '#fff'; x.stroke(); x.restore();
}
const TONE = { r: '버거워요', y: '알맞아요', g: '넉넉해요' }, TONE_C = { r: '#ff5a4a', y: '#ffd23f', g: '#5fd36a' };
function fillMapText() {
  const lv = myLv(save), z = curZ;
  const zc = z ? Math.floor(trash.zoneClean(z) * 100) : 0, tn = z ? zoneToneLv(save, z) : '';
  const all = Math.floor(trash.clean() * 100); // 오름 전체 깨끗한 정도 (#196: 위쪽 줄은 지금 구역 값만)
  $('omap-now').innerHTML = (z ? `<b style="color:${tierColor(z)}">${z} ${zoneShort(z)}</b><i>${tierName(z)} 구역</i><i>깨끗한 정도 ${zc}%</i><i><span class="tone" style="background:${TONE_C[tn] || '#fff'}"></span> 권장 Lv ${zoneRecLv(z)} (지금 Lv ${lv}) ${TONE[tn] || ''}</i><i>좌표 ${Math.round(player.pos.x)}, ${Math.round(player.pos.z)}</i>`
    : `<b>들머리</b><i>지금 Lv ${lv}</i>`) + `<i>오름 전체 깨끗함 ${all}%</i>`;
  $('omap-rows').innerHTML = ZONES.map((Z) => { const c = Math.floor((late.zoneScore ? late.zoneScore(Z.id) : trash.zoneClean(Z.id)) * 100 + 1e-6); return `<div class="${Z.id === z ? 'now' : ''}"><span class="sw" style="background:${tierColor(Z.id)}"></span><b>${Z.id}</b><span>${zoneShort(Z.id)} · ${tierName(Z.id)}${late.swarmRestTxt?.(Z.id) || ''}</span>${enemySvg(zoneEnemy(Z.id))}<span class="pc${c >= 100 ? ' done' : ''}" title="구역 점수 (줍기 + 싸움)">${c}%</span><span class="rec" data-tone="${zoneToneLv(save, Z.id)}" title="권장 레벨">Lv ${zoneRecLv(Z.id)}</span></div>`; }).join('');
}
let mapT = 0;
function openMap() { if (!zoneLook) return; closePanels(); fillMapText(); drawMap(); $('omap').hidden = false; mapT = 0.25; }
late.openMap = openMap;
for (const id of ['zone-pill', 'xy-pill']) $(id).addEventListener('click', () => { if (id === 'xy-pill' && !($('topbar').dataset.fit !== '0' && $('xy-pill').classList.contains('inzone'))) return; openMap(); });

/* ---------- 매 프레임 ---------- */
export function tickArea(dt) {
  if (!zoneLook) return;
  zoneLook.update(dt, player.pos);
  if (zoneT > 0 && (zoneT -= dt) <= 0) $('zone-title').hidden = true;
  const k = Math.min(1, dt * 0.6); // 안개는 천천히
  if (Math.abs(fog.n - fog.tn) > 0.002 || Math.abs(fog.f - fog.tf) > 0.002) { fog.n += (fog.tn - fog.n) * k; fog.f += (fog.tf - fog.f) * k; setZoneFog(fog.n, fog.f); }
  if (!$('omap').hidden && (mapT -= dt) <= 0) { mapT = 0.25; drawMap(); }
}
