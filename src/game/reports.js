// 매일 미확인 제보 (#238, 기획 notes/case-files.md 5절). 데이터 src/cases/reports.js, 수치 balance.js REPORT
// 1. 하루(한국 날짜)에 하나: 레벨 REPORT.lv 부터, 튜토리얼 뒤. 날짜로 정해진 난수로 고르고(reportOf) 가 본 구역(journey.maxZ)까지만.
//    큰 사건의 실마리(case) 제보는 그 사건이 열린 사람에게만 (late.caseOpen)
// 2. 쪽지 한 장: 들어오고 조금 뒤 감독 한 줄로 알림. 오늘의 할 일 창(hud.js late.reportRow)과 사건 파일 창(cases.js late.reportBoard)의 '제보' 칸에서 읽음
// 3. 가서 보면 흔적 하나: 그 구역 길가 더미 곁(날짜로 고름, case 는 사건 목격 자리 곁)에 흔적 모양과 바닥 표시. 다가가 '살펴보기' → 한 줄(find) + 귤 REPORT.gyul
//    헛소문(hoax)은 흔적 없이 바닥 표시만, '둘러보기' → 한 줄 웃음 + 같은 귤. 다음 할 일(nexthint.js AFTER.report)에도 줄이 뜸
// 4. 서버: 저장 save.report.got 이 오늘(또는 어제) 날짜면 earn.js 가 하루 한 번 그 귤을 인정
// 저장 save.report = { d 날짜, id 제보, got 끝냄 1, said 알렸으면 1 }. 멀티: 내 화면에서만. dev: __oreum.reports
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { REPORT } from '../balance.js';
import { REPORTS, REPORT_BY, reportOf, dayRand } from '../cases/reports.js';
import { kstDate } from '../daily.js';
import { levelOf } from '../augments.js';
import { zoneName } from '../zonelook.js';
import { height } from '../world.js';
import { gradHard } from '../toon.js';
import { LOW } from '../gfx2.js';
import { icon } from '../icons.js';
import { state, late } from './state.js';
import { save, persist, MAP_ID } from './save.js';
import { scene } from './scene.js';
import { player, col, trash } from './place.js';
import { toast, addCoins, closePanels, panelOpen, PANELS } from './hud.js';
import { say } from './director.js';
import { interactables } from './stores.js';
import { startAutoGo } from './dump.js';

const ON = MAP_ID === 'namsongi';
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let dateOv = (/[?&]rdate=(\d{4}-\d\d-\d\d)/.exec(location.search) || [])[1] || null; // 확인용 날짜 바꾸기 (tools/reportrun.js: 주소 ?rdate= 또는 __oreum.reports.date)
const today = () => dateOv || kstDate();

/* ---------- 저장 (로그인 뒤 저장이 바뀌어도 맞게 매번 봄) ---------- */
function S() {
  let s = save.report;
  if (!isObj(s)) s = save.report = { d: '', id: '', got: 0, said: 0 };
  s.d = typeof s.d === 'string' ? s.d.slice(0, 10) : ''; s.id = REPORT_BY[s.id] ? s.id : '';
  s.got = s.got && s.id ? 1 : 0; s.said = s.said ? 1 : 0;
  return s;
}
S();
const lv = () => { try { return levelOf(save.lv?.xp || 0).lv; } catch { return 1; } };
const maxZ = () => Math.max(1, Math.min(5, Math.floor(+save.journey?.maxZ) || 1));
const can = () => ON && !!save.tut?.done && !late.tut?.active && lv() >= REPORT.lv;
const ok = (r) => r.z <= maxZ() && (!r.case || !!late.caseOpen?.(r.case));
// 오늘의 제보 (없으면 null). 날이 바뀌면 새로 고름 (그날 안에는 그대로)
function cur() {
  if (!can()) return null;
  const s = S(), d = today();
  if (s.d !== d || !s.id) { const r = reportOf(d, ok); if (!r) return null; Object.assign(s, { d, id: r.id, got: 0, said: 0 }); persist(); spotKey = ''; }
  return REPORT_BY[s.id] || null;
}

/* ---------- 자리 ---------- */
const v3 = (x, z) => new THREE.Vector3(x, height(x, z), z);
const free = (x, z) => !col || !col.blocked(x, z, 0.6);
let spotKey = '', spot = null;
function where(r) {
  const key = today() + r.id; if (key === spotKey && spot) return spot;
  const R = dayRand(today(), 7); let base = null;
  if (r.case) { const sp = late.cases?.spots?.(r.case)?.see; if (sp) base = { x: sp[0], z: sp[1], r: 3 }; }
  if (!base && trash) {
    const hs = trash.heaps.filter((h) => !h.field && h.zone === r.z), all = hs.length ? hs : trash.heaps.filter((h) => h.zone === r.z);
    const h = all[Math.floor(R() * all.length)]; if (h) base = { x: h.x, z: h.z, r: h.r || 2 };
  }
  if (!base) base = { x: player.pos.x + 6, z: player.pos.z, r: 0 };
  let p = null; const a0 = R() * Math.PI * 2;
  for (let k = 0; k < 24 && !p; k++) { const a = a0 + k * 0.9, d = base.r + REPORT.off[0] + (REPORT.off[1] - REPORT.off[0]) * ((k % 4) / 3), x = base.x + Math.cos(a) * d, z = base.z + Math.sin(a) * d; if (free(x, z)) p = v3(x, z); }
  spot = p || v3(base.x + base.r + REPORT.off[0], base.z); spotKey = key; build(r);
  return spot;
}

/* ---------- 모양: 흔적(제보마다 prop) + 바닥 표시 ---------- */
const MATS = {};
const tm = (c) => (MATS[c] ||= new THREE.MeshToonMaterial({ color: c, gradientMap: gradHard }));
function lump(parts, color) { // [geometry, x, y, z, ry?, sx?, sy?, sz?] → 한 덩어리
  const gs = parts.map(([g, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1]) => { const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz)); const n = g.index ? g.toNonIndexed() : g.clone(); n.applyMatrix4(m); g.dispose(); return n; });
  const mesh = new THREE.Mesh(mergeGeometries(gs), tm(color)); gs.forEach((g) => g.dispose()); mesh.castShadow = !LOW; mesh.receiveShadow = true; return mesh;
}
const PROPS = {
  prints: () => lump([0, 1, 2, 3, 4].map((i) => [new THREE.CircleGeometry(0.13, 7).rotateX(-Math.PI / 2), (i % 2 ? 0.16 : -0.16), 0.02, i * 0.42 - 0.8, 0, 0.75, 1, 1.4]), '#4a3a2c'),
  cans: () => lump([0, 1, 2, 3, 4].map((i) => [new THREE.CylinderGeometry(0.07, 0.07, 0.12 + i * 0.04, 7), i * 0.2 - 0.4, 0.06 + i * 0.02, 0]), '#b9c0c6'),
  ring: () => lump([0, 1, 2, 3, 4, 5, 6].map((i) => [new THREE.DodecahedronGeometry(0.14, 0), Math.cos(i / 7 * 6.283) * 0.7, 0.06, Math.sin(i / 7 * 6.283) * 0.7, i]), '#5b5550'),
  bag: () => { const g = new THREE.Group(); g.add(lump([[new THREE.SphereGeometry(0.28, 7, 5), 0, 0.24, 0, 0, 1, 0.9, 1]], '#3d4a55'), lump([[new THREE.TorusGeometry(0.08, 0.025, 4, 8), -0.07, 0.52, 0, 0.5], [new THREE.TorusGeometry(0.08, 0.025, 4, 8), 0.07, 0.52, 0, -0.5]], '#2f3a43')); return g; },
  glove: () => lump([[new THREE.BoxGeometry(0.2, 0.05, 0.22), 0, 0.03, 0], ...[0, 1, 2, 3].map((i) => [new THREE.BoxGeometry(0.04, 0.04, 0.12), -0.075 + i * 0.05, 0.03, -0.16]), [new THREE.BoxGeometry(0.05, 0.04, 0.1), 0.13, 0.03, -0.02, -0.6]], '#e9e3d2'),
  peel: () => lump([0, 1, 2].map((i) => [new THREE.SphereGeometry(0.09, 6, 3, 0, Math.PI * 1.2, 0, Math.PI / 2), i * 0.22 - 0.22, 0.02, 0, i * 0.9, 1, 0.35, 1]), '#f29a2e'),
  cloth: () => lump([[new THREE.PlaneGeometry(0.5, 0.36, 2, 1).rotateX(-Math.PI / 2 + 0.25), 0, 0.12, 0, 0.4]], '#f4f1ea'),
  flat: () => { const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.5, 18).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#c9d68a', transparent: true, opacity: 0.55, depthWrite: false })); m.position.y = 0.04; return m; },
};
let prop = null, ring = null;
function build(r) {
  if (prop) { scene.remove(prop); prop.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); prop = null; }
  if (!ring) { ring = new THREE.Mesh(new THREE.RingGeometry(REPORT.ring * 0.82, REPORT.ring, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.5, depthWrite: false })); ring.renderOrder = 2; ring.visible = false; scene.add(ring); }
  ring.position.set(spot.x, spot.y + 0.06, spot.z);
  const f = !r.hoax && PROPS[r.prop]; if (!f) return;
  prop = f(); prop.position.copy(spot); prop.rotation.y = dayRand(today(), 3)() * 6.28; prop.visible = false; scene.add(prop);
}

/* ---------- 끝내기 ---------- */
function finish() {
  const r = cur(), s = S(); if (!r || s.got) return false;
  s.got = 1; persist(); late.sound?.snip?.();
  if (prop) prop.visible = false; if (ring) ring.visible = false;
  addCoins(REPORT.gyul, r.find); // 한 줄 + 귤 (서버는 earn.js 가 하루 한 번)
  late.questTrackDirty?.(true); refreshUi();
  return true;
}
const near = () => !!spot && Math.hypot(spot.x - player.pos.x, spot.z - player.pos.z) < REPORT.r;
const act = { pos: new THREE.Vector3(0, -999, 0), r: REPORT.r, ic: 'eye', act: () => finish(),
  get label() { return REPORT_BY[S().id]?.hoax ? '둘러보기' : '살펴보기'; },
  when: () => { const r = cur(); return !!r && !S().got && !state.cave && !state.cine && !late.tut?.active; } };
if (ON) interactables.push(act);
function goThere() { const r = cur(); if (!r || S().got) return false; const p = where(r); closePanels(); closeNote(); return startAutoGo({ pos: p.clone(), near: REPORT.r * 0.7 }); }

/* ---------- 쪽지 보기 ---------- */
const css = document.createElement('style');
css.textContent = `
#report-note { z-index: 30; }
#report-note .rn-paper { position: relative; box-sizing: border-box; width: min(340px, calc(100vw - 40px)); margin: auto; padding: 18px 18px 14px; border-radius: 4px; background: #f4ecd8; color: #33302a; box-shadow: 0 10px 30px rgba(0,0,0,.35); transform: rotate(-1.2deg); }
#report-note .rn-paper::after { content: ''; position: absolute; left: 50%; top: -9px; width: 64px; height: 18px; transform: translateX(-50%) rotate(2deg); background: rgba(230,214,160,.85); }
#report-note .rn-kind { margin: 0 0 2px; font: 800 11px var(--body); letter-spacing: .06em; color: #b0583f; }
#report-note .rn-from { margin: 0 0 6px; font-size: 12px; color: #7a7262; }
#report-note h2 { margin: 0 0 8px; font: 800 18px var(--display); color: #33302a; }
#report-note .rn-b { margin: 0 0 12px; white-space: pre-line; font-size: 15px; line-height: 1.6; }
#report-note .rn-row { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
#report-note .rn-row .btn { min-height: 40px; background: #3a342c; color: #f4ecd8; border-color: transparent; }
#report-note .rn-row #report-go { background: #b0583f; }
#report-note .rn-got { margin: 0 0 12px; padding: 6px 8px; border-left: 3px solid #b0583f; background: rgba(176,88,63,.08); font-size: 13px; }
.ach-cat.c-report { background: #8a5a9e; }
.ach-item.report b { cursor: pointer; }
#case-file .cf-rep { display: flex; align-items: center; gap: 8px; width: 100%; margin: 0 0 12px; padding: 8px 10px; border-radius: 10px; border: 1px dashed var(--hair); background: rgba(255,255,255,.05); color: var(--ink); font: 600 13px var(--body); text-align: left; cursor: pointer; }
#case-file .cf-rep svg { width: 18px; height: 18px; flex: none; opacity: .8; }
#case-file .cf-rep small { margin-left: auto; color: var(--ink-soft); font-size: 11px; white-space: nowrap; }
`;
document.head.append(css);
const note = document.createElement('div'); note.className = 'overlay dim'; note.id = 'report-note'; note.hidden = true;
note.innerHTML = '<div class="rn-paper" role="dialog" aria-modal="true" aria-labelledby="report-note-h"><p class="rn-kind">미확인 제보</p><p class="rn-from"></p><h2 id="report-note-h"></h2><p class="rn-b"></p><p class="rn-got" hidden></p><div class="rn-row"><button type="button" class="btn small" id="report-go">가 보기</button><button type="button" class="btn small" id="report-close">닫기</button></div></div>';
document.body.append(note); PANELS.push('report-note');
const nq = (s) => note.querySelector(s);
function closeNote() { note.hidden = true; }
function openNote() {
  const r = cur(); if (!r) return false; closePanels();
  const s = S(); nq('.rn-from').textContent = `${r.from} · ${zoneName(r.z)}`; nq('h2').textContent = r.t; nq('.rn-b').textContent = r.b;
  const g = nq('.rn-got'); g.hidden = !s.got; g.textContent = s.got ? r.find : '';
  nq('#report-go').hidden = !!s.got; note.hidden = false; return true;
}
nq('#report-close').addEventListener('click', closeNote);
nq('#report-go').addEventListener('click', () => goThere());
note.addEventListener('pointerdown', (e) => { if (e.target === note) closeNote(); });

/* ---------- 오늘의 할 일 한 줄 (hud.js buildAch) · 사건 파일 '제보' 칸 (cases.js build) ---------- */
const status = (r, s) => (s.got ? (r.hoax ? '헛소문이었어요' : '확인함') : '아직 안 가 봄');
late.reportRow = (list) => {
  const r = cur(); if (!r || !list) return;
  const s = S(), row = document.createElement('div'); row.className = 'ach-item report' + (s.got ? ' done' : '');
  const t = document.createElement('div');
  const tag = document.createElement('i'); tag.className = 'ach-cat c-report'; tag.textContent = '제보';
  const nm = document.createElement('b'); nm.textContent = `미확인 제보 · ${r.t}`; nm.addEventListener('click', openNote);
  const sm = document.createElement('small'); sm.textContent = ` ${status(r, s)}`;
  t.append(tag, nm, sm);
  const right = document.createElement('div');
  if (s.got) { right.className = 'muted'; right.style.fontSize = '12px'; right.textContent = '받음'; }
  else { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small'; b.textContent = `가 보기 · 귤 ${REPORT.gyul}`; b.addEventListener('click', goThere); right.append(b); }
  row.append(t, right); list.append(row);
};
late.reportBoard = (el) => {
  const r = cur(); if (!r || !el) return;
  const s = S(), b = document.createElement('button'); b.type = 'button'; b.className = 'cf-rep'; b.id = 'cf-report';
  b.innerHTML = `${icon('notes')}<span>오늘의 제보 · ${esc(r.t)}</span><small>${esc(status(r, s))}</small>`;
  b.addEventListener('click', openNote);
  const head = document.createElement('p'); head.className = 'cf-h'; head.textContent = '제보';
  el.prepend(head, b);
};
late.reportOn = () => !!cur(); // 사건 파일 창 버튼을 제보만 있어도 보일 때 (cases.js)
function refreshUi() { if (!document.getElementById('ach')?.hidden) late.buildAch?.(); if (!note.hidden) openNote(); }
// 다음 할 일 (nexthint.js AFTER.report): 오늘 제보를 아직 안 봤으면
late.reportHint = () => {
  const r = cur(); if (!r || S().got) return null;
  return { text: `미확인 제보 · ${r.t}`, prog: zoneName(r.z), pos: () => where(r).clone(), near: REPORT.r * 0.7 };
};

/* ---------- 매 프레임 ---------- */
let chkT = 0, t0 = -1;
function tickReports(dt) {
  state.ticks.reports++;
  if (!ON || (chkT -= dt) > 0) return; chkT = 0.5;
  const r = cur();
  if (!r) { if (prop) prop.visible = false; if (ring) ring.visible = false; return; }
  const p = where(r), s = S(), far = Math.hypot(p.x - player.pos.x, p.z - player.pos.z) > REPORT.far, show = !s.got && !far && !state.cave;
  if (prop && prop.visible !== show) prop.visible = show; if (ring && ring.visible !== show) ring.visible = show;
  act.pos.copy(p);
  if (s.said || !state.sessionOn || panelOpen()) return;
  if (t0 < 0) t0 = performance.now() / 1000;
  if (performance.now() / 1000 - t0 < REPORT.delay) return;
  if (say('quest', 'report:' + s.d, `미확인 제보 한 장 · '${r.t}' · 오늘의 할 일에서 읽어요`, 3.6, { ttl: 120 })) { s.said = 1; persist(); }
}
late.tickReports = tickReports;

/* ---------- 확인용 (window.__oreum.reports) ---------- */
late.reports = {
  list: REPORTS.map((r) => r.id), on: ON,
  date(d) { dateOv = d || null; spotKey = ''; return today(); },
  pick: (d, all = false) => reportOf(d || today(), all ? () => true : ok)?.id || null,
  state: () => { const r = cur(), s = S(); return { ...s, today: today(), on: !!r, hoax: !!r?.hoax, z: r?.z || 0, case: r?.case || null, spot: spot && r ? [+spot.x.toFixed(1), +spot.z.toFixed(1)] : null, near: near(), prop: !!prop?.visible, ring: !!ring?.visible, act: !!act.when() }; },
  where: () => { const r = cur(); if (!r) return null; const p = where(r); return [+p.x.toFixed(1), +p.z.toFixed(1)]; },
  finish, note: openNote, closeNote, noteOpen: () => !note.hidden, go: goThere,
  reset() { delete save.report; S(); spotKey = ''; persist(); },
};
