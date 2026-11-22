// 대사 연출 (#224): 타자 효과(src/typer.js)를 게임에 붙이고, 화자 이름 옆 프로필 그림을 굽는다. 파일 순서는 hud 뒤 (src/modules.js)
// - 쓰는 곳: 퀘스트 받기·끝내기 창(game/quest.js), 동료 말 걸기 창(game/buddies.js), 감독의 한 줄 중 이야기·퀘스트 안내(game/director.js say → late.talk.toast)
//   쓰지 않는 곳: 버튼·설정·숫자 알림·보통 토스트, 머리 위 말풍선, 쪽지(종이는 한 번에), 오름 방송 띠(흐르는 자막이라 그대로, 스피커 그림이 화자)
// - 설정 › 화면 '대사 타자 효과' (save.typeFx: 1 켬·0 끔·없으면 켬, 단 '움직임 줄이기' 면 끔). 소리를 끄면 '톡' 도 안 남
// - 프로필: 그 캐릭터의 3D 모델을 화면 캔버스 구석에 한 번 그려 96×96 으로 떠 옴(굽기). 게임 그리기 바로 앞(update.js late.tickTalk)에서 하므로
//   이어 그리는 화면이 덮어씀. 같은 장면·같은 조명이라 셰이더를 새로 만들지 않음. 한 프레임에 한 장, 화자마다 캐시(TALK.face.max), 옷·모자가 바뀌면 다시
//   가장 낮은 성능 단계·굽기 실패·모델 없는 화자는 색 원 + 첫 글자 또는 아이콘(TALK.who ic)
// dev: __oreum.talk (state()·face(id)·bakeAll()·gallery()·on(v))
import * as THREE from 'three';
import { TALK } from '../balance.js';
import { createTyper } from '../typer.js';
import { icon } from '../icons.js';
import { state, late } from './state.js';
import { $, save, persist } from './save.js';
import { renderer, scene, quality } from './scene.js';
import { runner as meRunner } from './place.js';

const F = TALK.face, WHO = TALK.who;
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const typeOn = () => (save.typeFx === 0 ? false : save.typeFx === 1 ? true : !reduced());

/* ---------- 타자 ---------- */
function blip(p = 1) {
  const s = late.sound; if (!s?.on || !s.sfxOn || !s.ctx || !s.sfx) return;
  const c = s.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
  o.type = 'triangle'; o.frequency.value = 520 * p * (1 + (Math.random() - 0.5) * 0.06);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.03, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  o.connect(g); g.connect(s.sfx); o.start(t); o.stop(t + 0.06);
}
export const typer = createTyper({ speed: TALK.type, on: typeOn, blip });
const pitchOf = (id) => (WHO[id] || WHO[String(id).split(':')[0]] || {}).p || 1;

/* ---------- 프로필 ---------- */
const STYLE = `
.pf { flex: none; position: relative; display: inline-grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; overflow: hidden; background: var(--pf-bg, #ddd); box-shadow: 0 0 0 2px rgba(255,255,255,.85), 0 2px 6px rgba(0,0,0,.35); color: #2b2a26; font: 900 20px/1 var(--body); }
.pf img { width: 100%; height: 100%; display: block; object-fit: cover; }
.pf svg { width: 58%; height: 58%; }
.pf.hid { color: #9a9ca6; }
.pf.ty-talk { animation: pfnod .26s steps(2, jump-none) infinite; box-shadow: 0 0 0 2px #ffd23f, 0 0 10px rgba(255,210,63,.65); }
@keyframes pfnod { 0% { transform: translateY(0) rotate(0); } 100% { transform: translateY(-1.5px) rotate(-2deg); } }
.talk .pop-head h2.pf-h { display: flex; align-items: center; gap: 10px; }
.talk .pop-head h2.pf-h .pf-n { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.talk .talk-say, .talk .mt-line { cursor: pointer; }
.ty-h { opacity: 0; }
#toast.pf-t { display: flex; align-items: center; gap: 8px; text-align: left; }
#toast.pf-t .pf { width: 28px; height: 28px; font-size: 13px; box-shadow: 0 0 0 1.5px rgba(255,255,255,.8); }
#toast.pf-t .pf.ty-talk { box-shadow: 0 0 0 1.5px #ffd23f; }
@media (max-width: 600px) { .pf { width: 44px; height: 44px; font-size: 18px; } }
@media (prefers-reduced-motion: reduce) { .pf.ty-talk { animation: none; } }
`;
{ const st = document.createElement('style'); st.textContent = STYLE; document.head.appendChild(st); }

const cache = new Map(); // id → { url, sig, ms, fail }
const jobs = []; // 구울 것 { id, root, sig, els: Set }
const stats = { baked: 0, ms: [], fail: 0 };
const LAYER = 7, pcam = new THREE.PerspectiveCamera(F.fov, 1, 0.05, 30); pcam.layers.set(LAYER);
const cv = document.createElement('canvas'); cv.width = cv.height = F.px;
const cx2 = cv.getContext('2d', { willReadFrequently: true });
const box = new THREE.Box3(), bb = new THREE.Box3(), v = new THREE.Vector3(), fw = new THREE.Vector3(), q = new THREE.Quaternion(), cc = new THREE.Color();
let forceBake = false; /* 확인용: 낮은 단계에서도 굽기 */
const canBake = () => (quality.tier > 0 || forceBake) && !!renderer?.domElement;
// 겉모습이 바뀌었는지: 보이는 메시 수 + 재질 색
function sigOf(root) {
  let n = 0, s = 0;
  root.traverseVisible((o) => { if (o.isMesh && !o.isSprite) { n++; const m = Array.isArray(o.material) ? o.material[0] : o.material; if (m?.color) s = (s * 31 + m.color.getHex()) % 1e9; } });
  return n + ':' + s;
}
function letter(name) { const g = [...String(name || '?').trim()]; return g[0] || '?'; }
// 프로필 한 칸 HTML. id: 화자 키, o: { root, name, hidden }
function faceHtml(id, o = {}) {
  const w = WHO[id] || WHO[String(id).split(':')[0]] || {}, bg = w.bg || '#d9d4c4';
  if (o.hidden) return `<i class="pf hid" style="--pf-bg:${WHO.hidden.bg}" data-pf="hidden" aria-hidden="true"><b>?</b></i>`;
  if (w.ic && !o.root) return `<i class="pf" style="--pf-bg:${bg}" data-pf="${esc(id)}" aria-hidden="true">${icon(w.ic)}</i>`;
  const c = cache.get(id);
  if (o.root && canBake()) {
    const sig = sigOf(o.root);
    if (!c || (c.sig !== sig && !c.fail)) want(id, o.root, sig);
  }
  const inner = c?.url ? `<img src="${c.url}" alt="">` : `<b>${esc(letter(o.name))}</b>`;
  return `<i class="pf" style="--pf-bg:${bg}" data-pf="${esc(id)}" aria-hidden="true">${inner}</i>`;
}
function want(id, root, sig) {
  const j = jobs.find((x) => x.id === id); if (j) { j.root = root; j.sig = sig; return; }
  jobs.push({ id, root, sig });
}
// 다 구우면 보이는 같은 화자 칸을 그림으로 바꿈
function fill(id) {
  const c = cache.get(id); if (!c?.url) return;
  for (const el of document.querySelectorAll(`.pf[data-pf="${CSS.escape ? CSS.escape(id) : id}"]`)) el.innerHTML = `<img src="${c.url}" alt="">`;
}
function trim() { // 캐시 상한: 오래된 사람 얼굴부터
  if (cache.size <= F.max) return;
  for (const k of cache.keys()) { if (cache.size <= F.max) break; if (k !== 'me' && !k.startsWith('shop:') && k !== 'jigi') cache.delete(k); }
}
function bake(j) {
  const t0 = performance.now(), id = j.id, root = j.root, w = WHO[id] || WHO[String(id).split(':')[0]] || {};
  const meshes = [], lights = [];
  let ok = false;
  const pv = new THREE.Vector4(), ps = new THREE.Vector4(); renderer.getViewport(pv); renderer.getScissor(ps);
  const sTest = renderer.getScissorTest(), cc0 = renderer.getClearColor(new THREE.Color()), ca0 = renderer.getClearAlpha(), bg0 = scene.background, au0 = renderer.shadowMap.autoUpdate, vis0 = root.visible;
  try {
    root.visible = true; root.updateWorldMatrix(true, true); box.makeEmpty();
    root.traverseVisible((o) => {
      if (!o.isMesh || o.isSprite) return;
      const g = o.geometry; if (!g) return; if (!g.boundingBox) g.computeBoundingBox();
      bb.copy(g.boundingBox).applyMatrix4(o.matrixWorld); box.union(bb); meshes.push(o);
    });
    if (box.isEmpty() || !meshes.length) throw new Error('빈 모델');
    const c = box.getCenter(new THREE.Vector3()), hb = root.getObjectByName('head'), foot = root.getWorldPosition(v);
    let ty, half;
    if (hb) { const n = hb.getWorldPosition(new THREE.Vector3()), H = Math.max(0.3, n.y - foot.y); c.x = n.x; c.z = n.z; ty = n.y + H * F.up; half = H * F.half; } /* 목뼈 기준: 머리 가운데·어깨 위 */
    else { const h = box.max.y - box.min.y; ty = box.max.y - h * 0.2; half = h * 0.2; }
    const d = half / Math.tan(THREE.MathUtils.degToRad(F.fov / 2));
    root.getWorldQuaternion(q); fw.set(Math.sin(F.side), 0, Math.cos(F.side)).applyQuaternion(q).setY(0).normalize();
    pcam.position.set(c.x + fw.x * d, ty + half * 0.15, c.z + fw.z * d); pcam.lookAt(c.x, ty, c.z); pcam.updateMatrixWorld();
    for (const m of meshes) m.layers.enable(LAYER);
    scene.traverse((o) => { if (o.isLight) { o.layers.enable(LAYER); lights.push(o); } });
    const pr = renderer.getPixelRatio(), cw = F.px / pr;
    renderer.shadowMap.autoUpdate = false; scene.background = null;
    renderer.setClearColor(cc.set(w.bg || '#d9d4c4'), 1);
    renderer.setViewport(0, 0, cw, cw); renderer.setScissor(0, 0, cw, cw); renderer.setScissorTest(true);
    renderer.setRenderTarget(null); renderer.clear(true, true, false); renderer.render(scene, pcam);
    const src = renderer.domElement, S = Math.floor(cw * pr);
    cx2.clearRect(0, 0, F.px, F.px); cx2.drawImage(src, 0, src.height - S, S, S, 0, 0, F.px, F.px);
    const px = cx2.getImageData(F.px / 4, F.px / 4, F.px / 2, F.px / 2).data; let a = 0, b2 = 0, n = 0;
    for (let i = 0; i < px.length; i += 16) { const l = px[i] + px[i + 1] + px[i + 2]; a += l; b2 += l * l; n++; }
    const varc = b2 / n - (a / n) ** 2; ok = varc > 40; /* 바탕만 찍혔으면(모델이 안 보임) 실패 */
    if (ok) cache.set(id, { url: cv.toDataURL('image/png'), sig: j.sig, ms: 0 });
  } catch (e) { ok = false; }
  finally {
    for (const m of meshes) m.layers.disable(LAYER); for (const l of lights) l.layers.disable(LAYER);
    renderer.setScissorTest(sTest); renderer.setViewport(pv); renderer.setScissor(ps); renderer.setClearColor(cc0, ca0);
    renderer.shadowMap.autoUpdate = au0; scene.background = bg0; root.visible = vis0;
  }
  const ms = performance.now() - t0; stats.ms.push(+ms.toFixed(1)); if (stats.ms.length > 40) stats.ms.shift();
  if (ok) { stats.baked++; cache.get(id).ms = +ms.toFixed(1); trim(); fill(id); } else { stats.fail++; cache.set(id, { url: '', sig: j.sig, fail: true, ms }); }
}
// 게임 그리기 바로 앞에서 한 프레임에 한 장 (update.js)
late.tickTalk = () => {
  state.ticks.talk = (state.ticks.talk || 0) + 1;
  if (!jobs.length || state.cave) return;
  const j = jobs.shift(); if (!j.root || !canBake()) return;
  bake(j);
};

/* ---------- 이름표·대사 줄에 붙이기 ---------- */
// h2 에 프로필 + 이름. 돌려주는 것: 프로필 element (타자 중 끄덕임)
function head(h2, id, name, o = {}) {
  if (!h2) return null;
  h2.classList.add('pf-h'); h2.innerHTML = faceHtml(id, { ...o, name }) + `<span class="pf-n">${esc(name)}</span>`;
  return h2.querySelector('.pf');
}
// 감독의 한 줄 (이야기·퀘스트 안내): 안내서 목소리, 타자로
function sayToast(text, sec, who = 'guide', fx = '') { /* #252: 메시지 줄 한 줄, 왼쪽 아이콘이 화자 얼굴 */
  const sp = late.msg?.('info', text, { sec: sec + typer.dur(text), long: true, own: true, fx, icon: faceHtml(who) }); if (!sp) return false;
  const pf = sp.parentElement.querySelector('.pf');
  typer.type(sp, text, { tag: '', pitch: pitchOf(who), talker: pf });
  return true;
}

/* ---------- 설정 ---------- */
{
  const more = document.querySelector('#menu .m-more') || document.querySelector('.m-more');
  if (more) {
    const b = document.createElement('button'); b.type = 'button'; b.id = 'menu-typing'; b.title = '대사를 한 글자씩 (누르면 바로 전체)';
    const sync = () => { b.textContent = `대사 타자 효과: ${typeOn() ? '켬' : '끔'}`; b.setAttribute('aria-pressed', String(typeOn())); };
    sync(); b.addEventListener('click', () => { save.typeFx = typeOn() ? 0 : 1; persist(); sync(); });
    more.appendChild(b);
  }
}

/* ---------- 확인용 ---------- */
const giverRoots = () => late.questGivers?.() || [];
late.talk = {
  F, typer, pitchOf, faceHtml, head, toast: sayToast, on: typeOn,
  state: () => ({ on: typeOn(), jobs: jobs.length, cache: [...cache].map(([k, c]) => ({ id: k, ok: !!c.url, ms: c.ms })), ...stats, busy: typer.busy() }),
  force: (v = true) => { forceBake = !!v; cache.clear(); },
  set: (v) => { save.typeFx = v ? 1 : 0; persist(); },
  me: () => faceHtml('me', { root: meRunner.root, name: save.nick || '나' }),
  // 굽기를 바로 (프레임을 기다리지 않음, 확인용)
  bakeAll: () => { for (const g of giverRoots()) faceHtml(g.id, { root: g.root, name: g.name }); faceHtml('me', { root: meRunner.root, name: '나' }); for (const m of late.mateRoots?.() || []) faceHtml('mate:' + m.id, { root: m.root, name: m.name }); const n = jobs.length; while (jobs.length) bake(jobs.shift()); return n; },
  // 화자별 그림 모음: 화면 가운데 한 줄로 (그림 찍기용)
  gallery: (on = true) => {
    let g = document.getElementById('pf-gallery'); if (!on) { g?.remove(); return; }
    if (!g) { g = document.createElement('div'); g.id = 'pf-gallery'; g.style.cssText = 'position:fixed;z-index:99;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;flex-wrap:wrap;gap:14px;max-width:92vw;padding:16px;border-radius:16px;background:rgba(20,20,24,.85);color:#fff;font:600 12px/1.2 sans-serif;justify-content:center'; document.body.appendChild(g); }
    const L = [...giverRoots().map((x) => [x.id, x.name, { root: x.root }]), ['me', '나', { root: meRunner.root }], ...(late.mateRoots?.() || []).map((m) => ['mate:' + m.id, m.name, { root: m.root }]), ['guide', '안내서', {}], ['radio', '이장 방송', {}], ['hidden', '그쪽', { hidden: true }]];
    g.innerHTML = L.map(([id, n, o]) => `<div style="display:grid;justify-items:center;gap:6px;width:64px;text-align:center">${faceHtml(id, { ...o, name: n })}<span>${esc(n)}</span></div>`).join('');
  },
};
