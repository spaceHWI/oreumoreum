// 서바이벌 터 (#231): 구역마다 한 곳(balance.js SWARM.arena.at). 낮은 현무암 돌 고리 + 가운데 징. 징을 울려야(상호작용) 떼 한 판이 시작됨 (판 자체는 game/swarm.js)
// - 그리기: 터마다 메시 하나(돌 고리·징을 정점 색으로 합침, toon 재질). 멀면 안 그림 → 화면에 1~2개, 터마다 그리기 1번
// - 징 위 글(#arena-tag): 가까우면 '서바이벌 시작 · 권장 레벨 · 버티는 시간', 쉬는 시간엔 남은 시간. 상호작용 버튼 글도 같음
// - 알림: 그 구역에 처음 들어가면 한 번 터 쪽(카메라 기준 앞·오른쪽·뒤·왼쪽)과 거리 한 줄 (save.swarm.hint). 가장자리 표시(#arena-arrow)는 near~hintR m 일 때만, 다른 길 안내가 있으면 쉼 (#201)
// - 지도: 큰 지도·미니맵에 터 아이콘(귤색 고리) (field.js drawIcons 가 late.arenaIcons 를 부름)
// - 멀티: 같은 터 안에 있는 사람이 판 중(presence sw)이면 나도 판에 듦 (떼는 사람마다 따로, swarm.js)
// (파일 순서는 src/modules.js: swarm 뒤. update.js 가 late.tickArena 를 부름)
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SWARM, ZONES } from '../balance.js';
import { SWARM_TEXT } from '../punktext.js';
import { zoneRecLv, myLv } from '../gearscore.js';
import { gradHard } from '../toon.js';
import { height } from '../world.js';
import { LOW } from '../gfx2.js';
import { icon } from '../icons.js';
import { state, late } from './state.js';
import { save, persist } from './save.js';
import { scene, camera } from './scene.js';
import { trash, player } from './place.js';
import { toast, panelOpen } from './hud.js';
import { interactables } from './stores.js';
import { placeArrow } from './dump.js';
import { cam } from './camera.js';

const A = SWARM.arena, T = SWARM_TEXT;
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
const SW = () => late.swarmArena; // swarm.js 가 먼저 붙임
const zoneOf = (x, z) => (trash ? trash.zoneAt(x, z) || 0 : 0);

/* ---------- 모양: 돌 고리 + 징 ---------- */
function rnd0(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function paint(g, hex, r = null, v = 0) {
  g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k); g.computeVertexNormals();
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 3) { const k = r ? 1 - v / 2 + r() * v : 1; for (let j = 0; j < 3 && i + j < n; j++) { a[(i + j) * 3] = c.r * k; a[(i + j) * 3 + 1] = c.g * k; a[(i + j) * 3 + 2] = c.b * k; } }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
// 징 앞(길 쪽): 터 둘레 16곳 중 길에 가장 가까운 쪽 → 그쪽 돌 고리는 비워 들어오는 문
function faceOf(c) {
  let best = 0, bd = 1e9;
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, d = trash ? trash.trail.dist(c[0] + Math.sin(a) * A.r, c[1] + Math.cos(a) * A.r, 80) : 0; if (d < bd) { bd = d; best = a; } }
  return best;
}
// 구역 분위기 (#253): 고리 돌 색만 다름 (숲길 이끼·사면·능선 밝은 돌·굼부리 붉은 송이·정상 눈 덮인 돌). 메시 수는 같음
const STONE = [null, ['#47514a', '#3f4a40'], ['#45464b', '#505157'], ['#5b5c60', '#66676a'], ['#5a4038', '#4d3a35'], ['#5f6266', '#8a8e93']];
function arenaGeo(zone, c, face) {
  const r = rnd0(2310 + zone * 97), out = [], n = Math.round(Math.PI * 2 * A.r / 1.7), sc = STONE[zone] || STONE[2];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2; let da = Math.atan2(Math.sin(a - face), Math.cos(a - face)); if (Math.abs(da) < 0.12) continue; // 문
    const x = c[0] + Math.sin(a) * A.r, z = c[1] + Math.cos(a) * A.r, R = 0.32 + r() * 0.16;
    const g = new THREE.IcosahedronGeometry(R, 0).scale(1.3 + r() * 0.4, 0.75 + r() * 0.3, 1).rotateY(r() * 6.28).translate(x, height(x, z) + R * 0.45, z);
    out.push(paint(g, r() < 0.5 ? sc[0] : sc[1], r, 0.18));
  }
  // 문 양옆 돌 깃대 (귤색 천)
  for (const s of [-1, 1]) {
    const a = face + s * 0.15, x = c[0] + Math.sin(a) * A.r, z = c[1] + Math.cos(a) * A.r, y = height(x, z);
    out.push(paint(new THREE.CylinderGeometry(0.06, 0.08, 2.6, 5).translate(x, y + 1.3, z), '#5a4126'));
    out.push(paint(new THREE.BoxGeometry(0.04, 0.5, 0.8).translate(0, 0, 0.4).rotateY(a + s * 1.2).translate(x, y + 2.25, z), '#f08a24'));
  }
  // 징: 두 기둥 + 가로대 + 둥근 놋쇠판 (길 쪽을 봄)
  const y0 = height(c[0], c[1]), G = [];
  for (const s of [-1, 1]) G.push(paint(new THREE.CylinderGeometry(0.1, 0.13, 3.1, 6).translate(s * 1.05, 0.95, 0), '#6b4a2a', r, 0.1)); // 기둥 밑은 땅에 묻힘 (비탈, #253)
  G.push(paint(new THREE.BoxGeometry(2.5, 0.16, 0.18).translate(0, 2.45, 0), '#5a3d22'));
  G.push(paint(new THREE.CylinderGeometry(0.72, 0.72, 0.09, 18).rotateX(Math.PI / 2).translate(0, 1.45, 0), '#c9a24a'));
  G.push(paint(new THREE.CylinderGeometry(0.26, 0.26, 0.14, 12).rotateX(Math.PI / 2).translate(0, 1.45, 0.02), '#e2bf62'));
  for (const s of [-1, 1]) G.push(paint(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 3).translate(s * 0.45, 2.15, 0), '#2b2218'));
  const gong = mergeGeometries(G).rotateY(face).translate(c[0], y0, c[1]);
  out.push(gong);
  // 밟힌 흙 바닥: 땅 높이를 따름 (비탈에서 뜨거나 묻히지 않게, #253)
  const fl = new THREE.CylinderGeometry(1.6, 1.8, 0.12, 10).translate(c[0], 0.02, c[1]), fp = fl.attributes.position;
  for (let i = 0; i < fp.count; i++) fp.setY(i, fp.getY(i) + height(fp.getX(i), fp.getZ(i)));
  out.push(paint(fl, '#6d6a52', r, 0.08));
  return mergeGeometries(out);
}

const mat = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradHard });
const arenas = []; // { zone, c, face, mesh, gong: Vector3 }
if (trash) for (let z = 1; z < A.at.length; z++) {
  const c = A.at[z]; if (!c) continue;
  const face = faceOf(c), mesh = new THREE.Mesh(arenaGeo(z, c, face), mat);
  mesh.castShadow = false; mesh.receiveShadow = !LOW; mesh.visible = false; mesh.matrixAutoUpdate = false; mesh.updateMatrix(); scene.add(mesh);
  arenas.push({ zone: z, c, face, mesh, gong: new THREE.Vector3(c[0], height(c[0], c[1]), c[1]) });
}
const DRAW = LOW ? 170 : 240;

/* ---------- 징 상호작용 ---------- */
const restOf = (z) => SW()?.rest(z) || 0;
const tagText = (z) => { const l = restOf(z); return l > 0 ? `${T.restTag} ${mmss(l)}` : T.gong; };
for (const a of arenas) {
  interactables.push({
    ic: 'field', pos: a.gong, r: A.gongR,
    get label() { return tagText(a.zone); },
    when: () => !!SW() && !SW().zone() && !state.cave && !late.tut?.active,
    act: () => {
      const w = SW().start(a.zone); if (!w) return;
      if (w === 'rest') toast(`${T.restTag} · ${mmss(restOf(a.zone))} 뒤에 다시`, 2.2);
      else toast(T.why[w] || T.why.off, 2);
    },
  });
}

/* ---------- 징 위 글 · 가장자리 표시 ---------- */
const st = document.createElement('style');
st.textContent = `
#arena-tag { position: fixed; left: 0; top: 0; z-index: 4; pointer-events: none; padding: 5px 12px; border-radius: 12px; font-family: var(--display); font-weight: 800; font-size: 14px; text-align: center; white-space: nowrap; transform: translate(-50%, -100%); }
#arena-tag[hidden] { display: none; }
#arena-tag b { display: block; color: var(--gyul, #ff9a1f); font-size: 15px; }
#arena-tag small { display: inline-flex; gap: 8px; font-size: 12px; opacity: .9; }
#arena-tag.rest b { color: #cfc8b4; }
#arena-arrow { position: fixed; left: 0; top: 0; z-index: 15; width: 40px; height: 40px; margin: -20px 0 0 -20px; display: flex; align-items: center; justify-content: center; pointer-events: none; padding: 0; }
#arena-arrow[hidden] { display: none; }
#arena-arrow svg { width: 20px; height: 20px; color: var(--gyul, #ff9a1f); }
#arena-arrow .tip { position: absolute; left: 50%; top: 50%; width: 0; height: 0; border-top: 7px solid transparent; border-bottom: 7px solid transparent; border-left: 10px solid var(--acc); transform: translate(-50%, -50%) rotate(var(--a, 0rad)) translateX(28px); }
#arena-arrow small { position: absolute; top: 100%; left: 50%; transform: translateX(-50%); font-size: 11px; font-weight: 800; white-space: nowrap; text-shadow: 0 1px 2px rgba(0,0,0,.6); }
body.looking #arena-tag, body.looking #arena-arrow, body.hp-down #arena-arrow, body.simple.win:not(.tut) #arena-arrow { display: none !important; }
@media (max-width: 600px) { #arena-tag { font-size: 12px; padding: 4px 9px; } #arena-tag b { font-size: 13px; } }
`;
document.head.appendChild(st);
const tag = document.createElement('div'); tag.id = 'arena-tag'; tag.className = 'panel'; tag.hidden = true; tag.setAttribute('aria-hidden', 'true');
tag.innerHTML = '<b></b><small></small>'; document.body.appendChild(tag);
const arrow = document.createElement('div'); arrow.id = 'arena-arrow'; arrow.className = 'panel round'; arrow.hidden = true; arrow.setAttribute('aria-hidden', 'true');
arrow.innerHTML = icon('field') + '<i class="tip"></i><small></small>'; document.body.appendChild(arrow);
const pv = new THREE.Vector3();
let tagKey = '';
function showTag(a, d) {
  if (d > A.tagR || SW()?.zone() || panelOpen() || cam.mode !== 'follow' || state.cine) { if (!tag.hidden) tag.hidden = true; return; }
  pv.copy(a.gong); pv.y += 3.1; pv.project(camera);
  if (pv.z > 1 || Math.abs(pv.x) > 1.05 || Math.abs(pv.y) > 1.05) { if (!tag.hidden) tag.hidden = true; return; }
  const l = restOf(a.zone), key = l > 0 ? 'r' + Math.ceil(l) : 'g' + a.zone + ':' + myLv(save);
  if (key !== tagKey) {
    tagKey = key; tag.classList.toggle('rest', l > 0);
    tag.firstChild.textContent = l > 0 ? `${T.restTag} ${mmss(l)}` : T.gong;
    const rec = zoneRecLv(a.zone), my = myLv(save), tt = SW()?.runT(a.zone) || 0;
    tag.lastChild.innerHTML = l > 0 ? '' : `<span title="권장 레벨">권장 Lv ${rec}${my < rec ? ` (지금 Lv ${my})` : ''}</span><span title="버티는 시간">${mmss(tt)} 버티기</span>`;
  }
  tag.hidden = false; tag.style.transform = `translate(${((pv.x * 0.5 + 0.5) * innerWidth).toFixed(1)}px, ${((-pv.y * 0.5 + 0.5) * innerHeight).toFixed(1)}px) translate(-50%, -100%)`;
}
function showArrow(a, d) {
  const on = !!a && d > A.near && d < A.hintR && !SW()?.zone() && restOf(a.zone) <= 0 && !panelOpen() && cam.mode === 'follow' && !late.tut?.active && !state.cave && !state.cine && !late.guideBusy?.() && !late.bossFight?.();
  if (!on) { if (!arrow.hidden) arrow.hidden = true; return; }
  arrow.hidden = false; placeArrow(arrow, a.gong, 3);
  const t = Math.round(d) + 'm', sm = arrow.lastChild; if (sm.textContent !== t) sm.textContent = t;
}

/* ---------- 구역에 처음 들어가면 한 줄 ---------- */
const H = (() => { const o = save.swarm && typeof save.swarm === 'object' ? save.swarm : (save.swarm = {}); if (!o.hint || typeof o.hint !== 'object' || Array.isArray(o.hint)) o.hint = {}; return o.hint; })();
const _f = new THREE.Vector3();
function dirWord(a) { // 카메라가 보는 쪽 기준
  camera.getWorldDirection(_f); const fa = Math.atan2(_f.x, _f.z), ta = Math.atan2(a.c[0] - player.pos.x, a.c[1] - player.pos.z);
  const d = Math.atan2(Math.sin(ta - fa), Math.cos(ta - fa));
  return Math.abs(d) < Math.PI / 4 ? '앞쪽' : Math.abs(d) > Math.PI * 3 / 4 ? '뒤쪽' : d < 0 ? '오른쪽' : '왼쪽';
}
function hintZone(z) {
  const a = arenas.find((q) => q.zone === z); if (!a || H[z]) return;
  H[z] = 1; persist();
  const d = Math.round(Math.hypot(a.c[0] - player.pos.x, a.c[1] - player.pos.z));
  toast(T.hint.replace('{zone}', ZONES[z - 1]?.name || `구역 ${z}`).replace('{dir}', dirWord(a)).replace('{m}', d), 4.2);
}

/* ---------- 같이 버티기 (멀티) ---------- */
function tryJoin(a) {
  const net = late.net; if (!net || net.solo || !net.peersById?.size || SW().can(a.zone)) return;
  for (const e of net.peersById.values()) {
    if (e.data?.sw !== a.zone || Math.hypot(e.pos.x - a.c[0], e.pos.z - a.c[1]) > A.r) continue;
    if (!SW().start(a.zone)) toast(T.joined, 2.6);
    return;
  }
}

/* ---------- 지도 아이콘 (field.js drawIcons) ---------- */
late.arenaIcons = (x, uv, s, inC) => {
  for (const a of arenas) {
    const [u, v] = uv(a.c[0], a.c[1]); if (!inC(u, v)) continue; const rest = restOf(a.zone) > 0;
    x.lineWidth = Math.max(1.5, s / 5); x.strokeStyle = rest ? '#b9b2a0' : '#ff9a1f'; x.fillStyle = 'rgba(32,24,12,.55)';
    x.beginPath(); x.arc(u, v, s * 0.6, 0, 7); x.fill(); x.stroke();
    x.fillStyle = rest ? '#b9b2a0' : '#e2bf62'; x.beginPath(); x.arc(u, v, s * 0.24, 0, 7); x.fill();
  }
};

/* ---------- 매 프레임 (update.js) ---------- */
let chkT = 0, near = null, nearD = 1e9, lastZone = -1;
late.tickArena = (dt) => {
  if (!arenas.length || !SW()) return;
  if ((chkT -= dt) <= 0) {
    chkT = 0.25; near = null; nearD = 1e9;
    for (const a of arenas) { const d = Math.hypot(a.c[0] - player.pos.x, a.c[1] - player.pos.z); a.mesh.visible = d < DRAW && !state.cave; if (d < nearD) { nearD = d; near = a; } }
    const z = state.sessionOn && !late.tut?.active && !state.cave && !state.cine ? zoneOf(player.pos.x, player.pos.z) : 0;
    if (z && z !== lastZone) hintZone(z);
    if (z) lastZone = z;
    if (near && nearD <= A.r && !SW().zone()) tryJoin(near);
  }
  if (near) { const d = Math.hypot(near.c[0] - player.pos.x, near.c[1] - player.pos.z); showTag(near, d); showArrow(near, d); }
};

/* ---------- 확인용 (window.__oreum.arena) ---------- */
// list(): 터 자리·문 방향, near(): 가장 가까운 터와 거리, ui(): 징 위 글·가장자리 표시가 떠 있는지, hint(): 처음 안내를 받은 구역
late.arenaApi = {
  list: () => arenas.map((a) => ({ zone: a.zone, x: a.c[0], z: a.c[1], r: A.r, face: +a.face.toFixed(2), gong: { x: +a.gong.x.toFixed(1), y: +a.gong.y.toFixed(1), z: +a.gong.z.toFixed(1) }, drawn: a.mesh.visible })),
  near: () => near && { zone: near.zone, d: +nearD.toFixed(1) },
  ui: () => ({ tag: !tag.hidden && tag.textContent, arrow: !arrow.hidden }),
  hint: () => ({ ...H }), clearHint() { for (const k of Object.keys(H)) delete H[k]; lastZone = -1; },
  meshes: () => arenas.map((a) => a.mesh), /* tools/arenacheck.js (#253) */
  act: (z) => interactables.find((i) => i.pos === arenas.find((a) => a.zone === z)?.gong),
};
