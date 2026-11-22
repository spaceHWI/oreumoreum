// 미스터리 장치 2 (#212): 흔적과 뒤돌아보면. 숫자·금고는 game/mystery.js
// - 발자국: 사람·노루 것과 다른 작은 세 발가락 자국이 더미 → 더미 → 다음 쪽으로 가다 뚝 끊김(위로 떠난 듯). 밤(MYST.foot.from 시~)에 생기고 아침에 서서히 지워짐
//   밤마다 자리가 바뀜(밤 번호로 씨앗, 다시 열어도 같음). 가 본 구역(save.journey.maxZ)마다 한 줄, 저사양은 줄·걸음 수를 줄임. 길 안내 표시는 없음
// - 크롭서클(단계 MYST.crop.stage 부터): 구역 2~3 의 평평한 풀밭에 풀이 둥글게 눌린 무늬(분리수거 화살표 셋을 닮음). drape 로 땅을 따라 그림
//   땅에서는 흐리게, 카메라가 높거나(정상·전망) 망원경(#208, 좁은 시야)으로 보면 또렷이. days 일마다 자리가 바뀜. 가운데 서면 혼잣말 한 번(자리마다)
// - 뒤돌아보면(단계 MYST.back.stage 부터): 카메라를 빠르게 돌린 직후 낮은 확률로 먼 곳에 실루엣이 0.5초. 한 번 뒤 cool 초 쉼. 소리 없음
//   멈춰서 한곳을 오래 보면 그 쪽 먼 더미 하나에서 '방금 생긴 것처럼' 먼지(mystery.js 의 먼지)
// - 도감 '흔적' 칸(late.dexExtra 를 감쌈): 발자국·눌린 풀·뒤돌아보면·4:04. 본 것은 save.myst.tr = { fp, crop, back } (mystery.js mystSave)
// - 내 화면에만 (멀티로 보내지 않음). 촬영 모드에서도 나옴. dev: __oreum.traces
import * as THREE from 'three';
import { MYST, SWARM } from '../balance.js';
import { MYST_TEXT as T } from '../punktext.js';
import { cropTex } from '../croptex.js'; /* 무늬 그림 (#246 사건 1 과 같이 씀) */
import { height } from '../world.js';
import { drape } from '../drape.js';
import { LOW } from '../gfx2.js';
import { kstDayN } from '../daily.js';
import { revealStage } from '../ufoveil.js';
import { BADGE_ICONS, iconSvg } from '../badgeicons.js';
import { state, late } from './state.js';
import { save, persist, MAP_ID } from './save.js';
import { scene, camera, spots } from './scene.js';
import { player, trash } from './place.js';
import { panelOpen } from './hud.js';
import { mystSave } from './mystery.js';

const F = MYST.foot, CR = MYST.crop, BK = MYST.back, ST = MYST.stare;
const ON = MAP_ID === 'namsongi' && !!trash?.heaps?.length;
const G = new THREE.Group(); G.name = 'traces'; G.userData.noCull = true; scene.add(G);
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const inB = (x, z) => !spots.inBounds || spots.inBounds(x, z);
function mark(k) { const m = mystSave(); if (m.tr[k]) return false; m.tr[k] = 1; persist(); late.mystDex?.(); return true; }

/* ---------- 게임 시각 (실제 한국 시각, 어드민 시간대 바꾸기 따름) ---------- */
function hourNow() {
  if (state.todOverride != null) return state.todOverride % 24;
  const k = new Date(Date.now() + 9 * 3600000); return k.getUTCHours() + k.getUTCMinutes() / 60;
}
const nightNo = () => Math.floor((kstDayN() * 24 + hourNow() - F.from) / 24);
function footOp() {
  const h = hourNow();
  if (h >= F.from || h < F.fadeFrom) return 1;
  if (h < F.fadeTo) return 1 - (h - F.fadeFrom) / (F.fadeTo - F.fadeFrom);
  return 0;
}

/* ---------- 크롭서클 ---------- */
const crop = { mesh: null, place: null, id: null, x: 0, z: 0, ok: false };
function cropSpot(id) {
  const r = rng(0x9e37 + id * 7919), pool = trash.heaps.filter((h) => CR.zones.includes(h.zone) && !h.field);
  if (!pool.length) return null;
  for (let k = 0; k < 60; k++) {
    const h = pool[Math.floor(r() * pool.length)], a = r() * Math.PI * 2, d = 16 + r() * 30, x = h.x + Math.sin(a) * d, z = h.z + Math.cos(a) * d;
    if (!CR.zones.includes(trash.zoneAt(x, z)) || !inB(x, z)) continue;
    if (trash.trail?.dist && trash.trail.dist(x, z, CR.trail + 1) < CR.trail) continue;
    if (trash.heaps.some((o) => Math.hypot(o.x - x, o.z - z) < CR.r + (o.r || 1) + 1)) continue;
    if (SWARM.arena.at.some((c) => c && Math.hypot(c[0] - x, c[1] - z) < SWARM.arena.r + SWARM.arena.spawn[1] + CR.r)) continue; /* 서바이벌 터 밖 (#253) */
    const y = height(x, z), q = CR.r; let bad = 0;
    for (const [sx, sz] of [[q, 0], [-q, 0], [0, q], [0, -q], [q * 0.7, q * 0.7], [-q * 0.7, -q * 0.7]]) bad = Math.max(bad, Math.abs(height(x + sx, z + sz) - y));
    if (bad > CR.flat * (1 + k / 30)) continue;
    return { x, z, rot: r() * Math.PI * 2 };
  }
  return null;
}
function tickCrop() {
  const on = ON && revealStage() >= CR.stage && trash.heaps.some((h) => CR.zones.includes(h.zone));
  if (!on) { if (crop.mesh) crop.mesh.visible = false; crop.ok = false; return; }
  const id = Math.floor(kstDayN() / CR.days);
  if (id !== crop.id) {
    crop.id = id; const s = cropSpot(id);
    if (!s) { crop.ok = false; if (crop.mesh) crop.mesh.visible = false; return; }
    if (!crop.mesh) {
      crop.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, LOW ? 10 : 18, LOW ? 10 : 18).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: cropTex(), transparent: true, opacity: CR.op[0], depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
      crop.mesh.renderOrder = 1; crop.mesh.name = 'crop'; G.add(crop.mesh); crop.place = drape(crop.mesh, height, 0.07);
    }
    crop.place(s.x, s.z, CR.r, s.rot); crop.x = s.x; crop.z = s.z; crop.ok = true;
  }
  crop.mesh.visible = crop.ok;
}
const cv = new THREE.Vector3();
function cropView(dt) { /* 카메라가 높을수록·망원경일수록 또렷이 */
  if (!crop.mesh?.visible) return;
  camera.getWorldPosition(cv);
  const up = cv.y - height(cv.x, cv.z), k = Math.max(camera.fov < 20 ? 1 : 0, Math.min(1, Math.max(0, (up - 4) / (CR.high - 4))));
  const want = CR.op[0] + (CR.op[1] - CR.op[0]) * k, m = crop.mesh.material; m.opacity += (want - m.opacity) * Math.min(1, dt * 2);
}
function cropMid() {
  if (!crop.ok || !crop.mesh?.visible) return;
  if (Math.hypot(crop.x - player.pos.x, crop.z - player.pos.z) > CR.mid) return;
  mark('crop');
  const m = mystSave(); if (m.crop === crop.id) return;
  m.crop = crop.id; persist(); late.mutterEv?.('cropMid');
}

/* ---------- 발자국 ---------- */
function footTex(col = 'rgba(150,140,118,1)') {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = col; /* 밤에도 보이게 흐린 흙빛 */
  g.beginPath(); g.ellipse(32, 44, 9, 11, 0, 0, Math.PI * 2); g.fill(); /* 뒤꿈치 */
  for (const a of [-0.55, 0, 0.55]) { g.save(); g.translate(32, 38); g.rotate(a); g.beginPath(); g.ellipse(0, -18, 4, 11, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
  return new THREE.CanvasTexture(c);
}
const FMAX = 360;
const fp = { im: null, n: 0, night: null, pts: [], mat: null };
function footBuild() {
  if (!fp.im) {
    fp.mat = new THREE.MeshBasicMaterial({ map: footTex(), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    fp.im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), fp.mat, FMAX); fp.im.frustumCulled = false; fp.im.renderOrder = 2; fp.im.name = 'footprints3'; G.add(fp.im);
  }
  const r = rng(0x51f3 + fp.night * 104729), maxZ = Math.max(1, Math.min(5, save.journey?.maxZ || 1)), lines = LOW ? F.maxLow : F.max, step = LOW ? F.stepLow : F.step;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(F.size, 1, F.size), p = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  let n = 0; fp.pts = [];
  const put = (x, z, a) => { if (n >= FMAX) return; p.set(x, height(x, z) + 0.035, z); q.setFromAxisAngle(Y, a); m4.compose(p, q, s); fp.im.setMatrixAt(n++, m4); fp.pts.push([x, z]); };
  const walk = (ax, az, bx, bz, cut = 1) => {
    const L = Math.hypot(bx - ax, bz - az), a = Math.atan2(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
    for (let d = 0, i = 0; d < L * cut; d += step, i++) { const sd = i % 2 ? 0.13 : -0.13; put(ax + ux * d + uz * sd, az + uz * d - ux * sd, a); }
  };
  const zones = []; for (let z = 1; z <= maxZ; z++) zones.push(z);
  zones.sort(() => r() - 0.5);
  for (const z of zones.slice(0, lines)) {
    const hs = trash.heaps.filter((h) => h.zone === z && !h.field); if (hs.length < 2) continue;
    const A = hs[Math.floor(r() * hs.length)];
    const near = hs.filter((h) => h !== A).map((h) => [h, Math.hypot(h.x - A.x, h.z - A.z)]).filter(([, d]) => d > 12 && d < 70).sort((a, b) => a[1] - b[1]);
    if (!near.length) continue;
    const B = near[0][0];
    let C = null;
    if (crop.ok && CR.zones.includes(z) && Math.hypot(crop.x - B.x, crop.z - B.z) < 120) C = { x: crop.x, z: crop.z };
    else { const o = near.find(([h]) => h !== B && Math.hypot(h.x - B.x, h.z - B.z) > 12); C = o ? o[0] : { x: B.x + (r() - 0.5) * 60, z: B.z + (r() - 0.5) * 60 }; }
    const off = (h, t) => { const L = Math.hypot(t.x - h.x, t.z - h.z) || 1, k = ((h.r || 1) + 0.8) / L; return [h.x + (t.x - h.x) * k, h.z + (t.z - h.z) * k]; };
    const [a1, b1] = off(A, B), [a2, b2] = off(B, A), [a3, b3] = off(B, C);
    if (!inB(a1, b1) || !inB(a3, b3)) continue;
    walk(a1, b1, a2, b2); walk(a3, b3, C.x, C.z, F.cut[0] + r() * (F.cut[1] - F.cut[0]));
  }
  fp.n = n; fp.im.count = n; fp.im.instanceMatrix.needsUpdate = true;
}
function tickFoot() {
  if (!ON) return;
  const nn = nightNo(); if (nn !== fp.night) { fp.night = nn; footBuild(); }
  const op = footOp(); fp.mat.opacity = 0.85 * op; fp.im.visible = op > 0.01 && !state.cave;
  if (op > 0.3 && fp.pts.some(([x, z]) => Math.hypot(x - player.pos.x, z - player.pos.z) < F.seen)) mark('fp');
}

/* 사건용 발자국 한 줄 (#236 사건 5 '설인'): 위 발자국 모양을 size 배로, pts 꺾은선을 따라 step m 마다. 밤낮 없이 늘 보임(보일지는 부른 쪽이 visible 로 정함) */
late.caseFoot = (pts, size = 1, step = F.step) => {
  const L = []; for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i], d = Math.hypot(bx - ax, bz - az); for (let s = i === 1 ? 0 : step * 0.5; s < d; s += step) L.push([ax + (bx - ax) * s / d, az + (bz - az) * s / d, Math.atan2(bx - ax, bz - az)]); }
  const n = Math.min(L.length, 120), mat = new THREE.MeshBasicMaterial({ map: footTex('rgba(84,78,66,1)'), transparent: true, opacity: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat, Math.max(1, n)); im.frustumCulled = false; im.renderOrder = 2; im.name = 'casefoot';
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(F.size * size, 1, F.size * size * 1.3), p = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) { const [x, z, a] = L[i], sd = (i % 2 ? 0.22 : -0.22) * size; p.set(x + Math.cos(a) * sd, height(x, z) + 0.04, z - Math.sin(a) * sd); q.setFromAxisAngle(Y, a); m4.compose(p, q, sc); im.setMatrixAt(i, m4); }
  im.count = n; im.instanceMatrix.needsUpdate = true; im.visible = false; G.add(im);
  return im;
};

/* ---------- 뒤돌아보면 ---------- */
const fwd = new THREE.Vector3();
const yawNow = () => { camera.getWorldDirection(fwd); return Math.atan2(fwd.x, fwd.z); };
const hist = []; let yawU = 0, yawP = null, coolBack = 0, coolStare = 0, stillT = 0, stillYaw = 0, clock = 0, standAt = new THREE.Vector3();
let fig = null, figT = 0;
function figure() {
  const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: '#1a1d20' });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, BK.h * 0.62, 7), mat); body.position.y = BK.h * 0.31; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), mat); head.scale.set(1, 1.25, 0.9); head.position.y = BK.h * 0.62 + 0.36; g.add(head);
  for (const k of [-1, 1]) { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, BK.h * 0.5, 5), mat); a.position.set(k * 0.26, BK.h * 0.38, 0); a.rotation.z = k * 0.12; g.add(a); }
  g.name = 'glance'; g.visible = false; G.add(g); return g;
}
function showFigure(dist) {
  fig ||= figure();
  const a = yawNow() + (Math.random() - 0.5) * 0.5;
  for (let k = 0; k < 8; k++) {
    const d = dist ?? (BK.dist[0] + Math.random() * (BK.dist[1] - BK.dist[0])), x = player.pos.x + Math.sin(a) * d, z = player.pos.z + Math.cos(a) * d;
    if (!inB(x, z) && k < 7) continue;
    fig.position.set(x, height(x, z), z); fig.rotation.y = Math.atan2(player.pos.x - x, player.pos.z - z); fig.scale.setScalar(1);
    fig.visible = true; figT = BK.show; mark('back'); return true;
  }
  return false;
}
const quiet = () => ON && state.sessionOn && !state.cine && !state.cave && !late.tut?.active && !panelOpen();
function tickBack(dt) {
  if (fig?.visible && (figT -= dt) <= 0) fig.visible = false;
  coolBack -= dt; coolStare -= dt;
  const y = yawNow(); if (yawP == null) yawP = y;
  let dy = y - yawP; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
  yawP = y; yawU += dy; hist.push([clock, yawU]); while (hist.length && clock - hist[0][0] > BK.turn) hist.shift();
  const st = revealStage();
  if (!quiet() || st < BK.stage) return;
  if (coolBack <= 0 && hist.length > 1 && Math.abs(yawU - hist[0][1]) > BK.deg * Math.PI / 180) {
    hist.length = 0;
    if (Math.random() < (st >= 3 ? BK.pLate : BK.p)) { coolBack = BK.cool; showFigure(); } else coolBack = 2;
  }
  /* 멈춰서 한곳을 오래 봄 */
  const moved = player.pos.distanceTo(standAt) > 0.3, turned = Math.abs(yawU - stillYaw) > ST.still * Math.PI / 180;
  if (moved || turned) { standAt.copy(player.pos); stillYaw = yawU; stillT = 0; return; }
  if ((stillT += dt) < ST.sec || coolStare > 0 || st < ST.stage) return;
  stillT = -1e9; coolStare = ST.cool;
  const cone = ST.cone * Math.PI / 180;
  const pick = trash.heaps.filter((h) => h.st >= 0).map((h) => { const dx = h.x - player.pos.x, dz = h.z - player.pos.z, d = Math.hypot(dx, dz); let da = Math.atan2(dx, dz) - y; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; return { h, d, da: Math.abs(da) }; })
    .filter((o) => o.d > ST.dist[0] && o.d < ST.dist[1] && o.da < cone).sort((a, b) => a.da - b.da)[0];
  if (pick) late.mystPuff?.(pick.h.x, pick.h.z, 1.3);
}

/* ---------- 도감 '흔적' 칸 ---------- */
{ const prev = late.dexExtra;
  late.dexExtra = (g) => {
    prev?.(g);
    const m = mystSave(), n404 = m.seen.length, cells = [[T.foot, T.footS, m.tr.fp, 'b-eye'], [T.crop, T.cropS, m.tr.crop, 'b-eye'], [T.back, T.backS, m.tr.back, 'b-eye'], [T.num, T.numS.replace('{n}', n404), n404 >= 1, 'b-eye']];
    const h = document.createElement('div'); h.className = 'dex-sec'; h.textContent = `${T.dex} ${cells.filter((c) => c[2]).length}/${cells.length}`; g.append(h);
    for (const [t, s, got, b] of cells) {
      const c = document.createElement('div'); c.className = 'dex-cell' + (got ? '' : ' locked');
      c.innerHTML = `<span class="dex-ic">${iconSvg(BADGE_ICONS[b] || '')}</span><b></b><small></small>`;
      c.querySelector('b').textContent = got ? t : '???'; c.querySelector('small').textContent = got ? s : '';
      g.append(c);
    }
  };
  late.mystDex = () => late.dexRebuild?.();
}

/* ---------- 매 프레임 ---------- */
let chk = 0;
let peekT = 0; /* 확인용: 크롭서클을 위에서 본 카메라 (dev traces.peek) */
late.tickTraces = (dt) => {
  state.ticks.traces++;
  clock += dt;
  if (!ON) return;
  if (peekT > 0 && crop.ok) { peekT -= dt; camera.position.set(crop.x + 26, height(crop.x, crop.z) + 34, crop.z + 26); camera.lookAt(crop.x, height(crop.x, crop.z), crop.z); }
  tickBack(dt); cropView(dt);
  if ((chk -= dt) > 0) return; chk = 1;
  tickCrop(); tickFoot();
  if (state.sessionOn) cropMid();
};

late.tracesApi = {
  state: () => ({ stage: revealStage(), night: fp.night, prints: fp.n, near: +Math.min(1e9, ...fp.pts.map(([x, z]) => Math.hypot(x - player.pos.x, z - player.pos.z))).toFixed(1), footOp: +footOp().toFixed(2), crop: crop.ok && { id: crop.id, x: +crop.x.toFixed(1), z: +crop.z.toFixed(1), op: +crop.mesh.material.opacity.toFixed(2) }, fig: !!fig?.visible, coolBack: +coolBack.toFixed(1), tr: { ...mystSave().tr } }),
  crop: () => { crop.id = null; tickCrop(); return crop.ok && { x: crop.x, z: crop.z }; },
  cropAt: (id) => { const q = cropSpot(id); return q && { x: q.x, z: q.z, r: CR.r }; }, /* 그날의 자리 (tools/arenacheck.js #253) */
  goCrop: (k = 0) => { if (!crop.ok) return null; const x = crop.x + k, z = crop.z + k; player.pos.set(x, height(x, z), z); player.visY = player.pos.y; return { x, z }; },
  goFoot: () => { if (nightNo() !== fp.night) { fp.night = nightNo(); footBuild(); } const p = fp.pts[Math.floor(fp.pts.length / 3)]; if (!p) return null; player.pos.set(p[0] + 2, height(p[0] + 2, p[1]), p[1]); player.visY = player.pos.y; return { x: p[0], z: p[1] }; },
  foot: () => { fp.night = null; tickFoot(); return fp.n; },
  back: (d) => { coolBack = 0; return showFigure(d); }, figure: () => fig && { x: +fig.position.x.toFixed(1), z: +fig.position.z.toFixed(1), on: fig.visible },
  peek: (sec = 3) => { peekT = sec; return crop.ok; },
  stare: () => { coolStare = 0; stillT = ST.sec; standAt.copy(player.pos); stillYaw = yawU; return true; },
};
/* 노루 친구 (#247, deerpal.js): 내 노루가 멈춰 바라볼 것 (읽기만). 보이는 크롭서클 자리·밤 발자국 자리 */
late.tracesOdd = () => ({ crop: crop.ok && crop.mesh.material.opacity > 0.05 ? [crop.x, crop.z] : null, foot: footOp() > 0.05 ? fp.pts : null });
