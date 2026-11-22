// 사건 파일: 흰 옷 따라가기 (#233 사건 2 '흰 옷 귀신'). game/cases.js 가 makeChase 로 만들어 씀 (이 파일만 읽어서는 아무것도 하지 않음)
// - 흰 옷 = Tripo 흰 후드 작업복 모델(casemodels.js 'ghost-keeper', #262: 미끄러지듯 걷기·집게질·돌아보기). 밤에만 보임: 실제 밤(해 고도 < -4°)이거나 사건 장면 동안 화면이 밤빛(#case-night)일 때
// - 목격 스침(glimpse): see.ghost 사건이 열리는 순간 돌담 너머로 흰 옷이 미끄러져 사라지고 그동안 화면이 잠깐 밤빛
// - 실제 밤: 레벨이 되고 종결 전이면 목격 돌담 너머를 오감. 가까이 가면(CASE.chase.vanish m) 사라짐
// - 따라가기(follow): 그 구역 서바이벌 터를 버틴 뒤(cases.js 가 save.cases[id].a = 1) 터 가장자리 path[0] 에 나옴 → near m 안에 들면 다음 자리로 미끄러짐
//   → 끝자리에서 쪼그려 줍는 중 → end m 안에 들면 장면(조작 잠금, 건너뛰기): 일어나 돌아봄·대사·사진 → 대면 끝(done) → 잠깐 뒤 사라짐
// 수치는 balance.js CASE.chase. 저장은 cases.js 의 save.cases (a 터를 버팀). 다시 들어와도 a 이면 path[0] 부터 다시
import * as THREE from 'three';
import { CASE } from '../balance.js';
import { height } from '../world.js';
import { caseModel } from '../casemodels.js';
import { state, late } from './state.js';
import { scene, camera, sunState } from './scene.js';
import { player } from './place.js';
import { cam, camTarget, ease, followCam } from './camera.js';
import { panelOpen } from './hud.js';
import { director, say } from './director.js';

const K = CASE.chase;
const v3 = (x, z) => new THREE.Vector3(x, height(x, z), z);
const isNight = () => (sunState?.el ?? 30) < -4;
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function makeChase({ S, closed, lv, spot, done, fightNow }) {
  /* ---------- 흰 옷 (처음 쓸 때 만듦) ---------- */
  let G = null; // { r, pos, heading, pose, t, speed }
  function ghost() {
    if (G) return G;
    const m = caseModel('ghost-keeper', { glow: K.glow }); /* Tripo 흰 후드 작업복 (#262). glow: 밤빛 위에서도 흰 옷이 뜸 */
    const r = { root: m.root, model: m, animate: (dt, o) => { m.play(o.pose === 'crouch' ? 'pinch' : o.pose === 'look' ? 'lookback' : o.speed > 0.05 ? 'glide' : 'idle'); m.update(dt); } };
    r.root.visible = false; scene.add(r.root);
    G = { r, pos: new THREE.Vector3(), heading: 0, pose: 'move', t: 0, speed: 0 };
    return G;
  }
  const show = (on) => { if (G && G.r.root.visible !== on) G.r.root.visible = on; };
  function setAt(p, heading) { const g = ghost(); g.pos.set(p.x, height(p.x, p.z), p.z); if (heading != null) g.heading = heading; }

  /* ---------- 밤빛 화면 · 장면 틀 ---------- */
  const css = document.createElement('style');
  css.textContent = `
#case-night { position: fixed; inset: 0; z-index: 1; pointer-events: none; opacity: 0; transition: opacity 1.4s; background: radial-gradient(ellipse at 50% 55%, rgba(18,26,66,.38) 0%, rgba(12,16,46,.62) 60%, rgba(6,8,24,.86) 100%); }
#case-night.on { opacity: 1; }
#case-night.flash { transition: none; background: #fff; opacity: .9; }
body.case-chase>*:not(#view):not(#case-night):not(#case-chase){visibility:hidden!important}
#case-chase { position: fixed; inset: 0; z-index: 12; pointer-events: auto; }
#case-chase::before, #case-chase::after { content: ''; position: absolute; left: 0; right: 0; height: 9vh; background: #000; transition: transform .5s; }
#case-chase::before { top: 0; transform: translateY(-100%); } #case-chase::after { bottom: 0; transform: translateY(100%); }
#case-chase.on::before, #case-chase.on::after { transform: none; }
#case-chase .cc-sk { position: absolute; right: max(16px, env(safe-area-inset-right)); bottom: calc(9vh + 12px); min-width: 44px; height: 40px; padding: 0 16px; border-radius: 999px; border: 1px solid var(--hair); background: var(--glass-2, rgba(20,20,24,.6)); color: var(--ink); font: 700 14px var(--body); cursor: pointer; }
#case-chase .cc-line { position: absolute; left: 50%; bottom: max(24px, env(safe-area-inset-bottom)); transform: translateX(-50%); max-width: calc(100vw - 140px); color: #fff; font: 600 15px var(--body); text-align: center; text-shadow: 0 1px 3px #000; opacity: 0; transition: opacity .5s; word-break: keep-all; }
#case-chase .cc-line.on { opacity: 1; }
`;
  document.head.append(css);
  const night = document.createElement('div'); night.id = 'case-night';
  { const v = document.getElementById('view'); if (v) v.after(night); else document.body.append(night); } /* 캔버스 바로 위, HUD 아래 */
  const box = document.createElement('div'); box.id = 'case-chase'; box.hidden = true;
  box.innerHTML = '<div class="cc-line"></div><button type="button" class="cc-sk">건너뛰기</button>';
  document.body.append(box);
  const lineEl = box.querySelector('.cc-line'), skBtn = box.querySelector('.cc-sk');
  skBtn.addEventListener('click', (e) => { e.stopPropagation(); stop(); });
  for (const ev of ['pointerdown', 'pointermove', 'wheel', 'touchstart']) box.addEventListener(ev, (e) => { if (e.target !== skBtn) e.preventDefault(); }, { passive: false });
  addEventListener('keydown', (e) => { if (cine && e.key === 'Escape') { e.preventDefault(); stop(); } });
  let nightOn = false;
  const setNight = (on) => { if (on !== nightOn) { nightOn = on; night.classList.toggle('on', on); } };

  /* ---------- 목격 스침 ---------- */
  let glim = null; // { u, from, to }
  function glimpse(c) {
    if (!c.see?.ghost || ch || cine) return;
    const w = spot(c.id).see, dx = w.x - player.pos.x, dz = w.z - player.pos.z, L = Math.hypot(dx, dz) || 1, nx = dx / L, nz = dz / L, sx = -nz, sz = nx;
    const bx = w.x + nx * K.behind, bz = w.z + nz * K.behind;
    glim = { u: 0, from: v3(bx - sx * K.glide, bz - sz * K.glide), to: v3(bx + sx * K.glide, bz + sz * K.glide) };
    setAt(glim.from, Math.atan2(sx, sz)); G.pose = 'move';
  }
  function tickGlim(dt) {
    glim.u += dt; const a = Math.min(1, glim.u / K.glimT);
    G.pos.lerpVectors(glim.from, glim.to, a); G.pos.y = height(G.pos.x, G.pos.z); G.speed = (K.glide * 2) / K.glimT;
    show(a < 1); setNight(glim.u < K.glimT + 0.6);
    if (glim.u > K.glimT + 0.6) { glim = null; G.speed = 0; }
  }

  /* ---------- 따라가기 ---------- */
  let ch = null; // { c, i, mode 'wait'|'go'|'pick'|'after', u, path [V3] }
  function start(c, quiet = false) {
    const F = c.face?.follow; if (!F?.path?.length || ch?.c === c) return false;
    glim = null;
    const path = F.path.map(([x, z]) => spot(c.id).free([x, z]));
    ch = { c, F, i: 0, mode: 'wait', u: 0, path };
    setAt(path[0], Math.atan2(path[1 % path.length].x - path[0].x, path[1 % path.length].z - path[0].z)); G.pose = 'move'; G.speed = 0;
    if (!quiet) say('quest', 'case-ghost:' + c.id, '터 가장자리에 흰 옷이… 놓치지 말고 따라가 봐요', 4, { ttl: 60 });
    late.questTrackDirty?.(true);
    return true;
  }
  function tickChase(dt) {
    const r = ch, F = r.F, g = G, last = r.path.length - 1;
    r.u += dt; g.speed = 0;
    const d = flat(g.pos, player.pos);
    if (r.mode === 'wait') {
      g.pose = 'move'; g.heading = turn(g.heading, Math.atan2(r.path[Math.min(last, r.i + 1)].x - g.pos.x, r.path[Math.min(last, r.i + 1)].z - g.pos.z), dt);
      if (d < F.near) { if (r.i >= last) r.mode = 'pick'; else { r.i++; r.mode = 'go'; } }
    } else if (r.mode === 'go') {
      const to = r.path[r.i], dx = to.x - g.pos.x, dz = to.z - g.pos.z, L = Math.hypot(dx, dz), step = (F.speed || 4) * dt * (d > F.near * 2.2 ? 0.45 : 1); /* 뒤처지면 천천히 */
      g.heading = turn(g.heading, Math.atan2(dx, dz), dt * 2);
      if (L <= step) { g.pos.copy(to); r.mode = r.i >= last ? 'pick' : 'wait'; }
      else { g.pos.x += dx / L * step; g.pos.z += dz / L * step; g.speed = step / Math.max(dt, 1e-3); }
      g.pos.y = height(g.pos.x, g.pos.z);
    } else if (r.mode === 'pick') {
      g.pose = 'crouch';
      if (d < F.end && !state.cine && !panelOpen() && !fightNow() && !late.tut?.active) begin(r.c);
    } else if (r.mode === 'after') {
      if (r.u > K.afterT) { show(false); ch = null; setNight(false); return; }
      if (r.u > K.afterT * 0.4) g.pose = 'crouch';
    }
    show(true);
    setNight(d < K.nightR || r.mode === 'after');
  }
  const turn = (a, b, dt) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * Math.min(1, dt * 4); };

  /* ---------- 장면: 돌아봄 ---------- */
  let cine = null; // { c, u, len, prev, li, snap }
  function begin(c) {
    if (state.cine || cine || !ch) return false;
    late.mutterApi?.hush?.();
    cine = { c, u: 0, len: c.face.follow.len || 9, prev: cam.mode, li: -1, snap: true, shot: false };
    state.cine = cine; cam.mode = 'cine'; player.target = null; player.speed = 0;
    player.heading = Math.atan2(G.pos.x - player.pos.x, G.pos.z - player.pos.z);
    box.hidden = false; skBtn.hidden = true; lineEl.classList.remove('on'); lineEl.textContent = '';
    document.body.classList.add('case-chase'); requestAnimationFrame(() => box.classList.add('on'));
    setNight(true);
    director.begin('story', 'case:' + c.id, Infinity);
    return true;
  }
  function stop() {
    if (!cine) return;
    const r = cine; cine = null; if (state.cine === r) state.cine = null;
    box.classList.remove('on'); box.hidden = true; document.body.classList.remove('case-chase'); night.classList.remove('flash');
    cam.mode = r.prev && r.prev !== 'cine' && r.prev !== 'title' ? r.prev : 'follow'; if (cam.mode === 'follow') followCam(0, true);
    director.end('case:' + r.c.id);
    if (ch) { ch.mode = 'after'; ch.u = 0; G.heading = Math.atan2(player.pos.x - G.pos.x, player.pos.z - G.pos.z); G.pose = 'move'; }
    done(r.c); /* 건너뛰어도 끝난 것으로 */
  }
  function tickCine(dt) {
    const r = cine;
    if (state.cine !== r) { cine = null; box.hidden = true; document.body.classList.remove('case-chase'); director.end('case:' + r.c.id); return; }
    r.u += dt; const u = r.u, T = r.len, L = r.c.face.lines || [];
    skBtn.hidden = u < CASE.face.skipAfter;
    const li = Math.min(L.length - 1, Math.floor(u / (T * 0.8 / Math.max(1, L.length))));
    if (li !== r.li && L[li]) { r.li = li; lineEl.classList.remove('on'); void lineEl.offsetWidth; lineEl.textContent = L[li]; lineEl.classList.add('on'); }
    const toMe = Math.atan2(player.pos.x - G.pos.x, player.pos.z - G.pos.z);
    if (u < T * 0.28) G.pose = 'crouch'; else { G.pose = 'move'; G.heading = turn(G.heading, toMe, dt * 0.9); }
    if (u > T * 0.82 && !r.shot) { r.shot = true; try { late.sound?.shutter?.(); } catch { /* 소리 없음 */ } night.classList.add('flash'); setTimeout(() => night.classList.remove('flash'), 120); }
    if (u >= T) stop();
  }
  { const prev = late.cineCam; late.cineCam = (dt) => { if (cine && state.cine === cine) cineCam(dt); else prev?.(dt); }; }
  function cineCam(dt) { // 내 어깨 뒤에서 흰 옷을 봄 → 돌아보면 흰 옷 앞쪽(얼굴)으로 다가감
    const g = G.pos, p = player.pos, dx = g.x - p.x, dz = g.z - p.z, L = Math.hypot(dx, dz) || 1, nx = dx / L, nz = dz / L, sx = -nz, sz = nx;
    const k0 = Math.min(1, Math.max(0, (cine.u / cine.len - 0.3) / 0.35)), k = k0 * k0 * (3 - 2 * k0);
    const ax = p.x - nx * K.camBack + sx * K.camSide, az = p.z - nz * K.camBack + sz * K.camSide, ay = Math.max(height(ax, az), p.y) + K.camUp;
    const bx = g.x - nx * K.faceD + sx * K.faceSide, bz = g.z - nz * K.faceD + sz * K.faceSide, by = Math.max(height(bx, bz) + 0.6, g.y + K.faceUp);
    camTarget.pos.set(ax + (bx - ax) * k, ay + (by - ay) * k, az + (bz - az) * k);
    camTarget.look.set(g.x, g.y + 0.8 + k * 0.6, g.z);
    ease(dt, cine.snap && !(cine.snap = false), 2.2);
  }

  /* ---------- 실제 밤: 목격 돌담 너머를 오감 ---------- */
  let amb = null; // { c, u }
  function tickAmb(dt, list) {
    if (!isNight()) { if (amb) { amb = null; show(false); } return; }
    const c = list.find((x) => x.see?.ghost && lv() >= x.lv && !closed(x) && flat(spot(x.id).see, player.pos) < K.ambR);
    if (!c) { if (amb) { amb = null; show(false); } return; }
    if (!amb || amb.c !== c) amb = { c, u: Math.random() * 10 };
    amb.u += dt; const w = spot(c.id).see, s = Math.sin(amb.u * K.ambW);
    setAt({ x: w.x + s * K.glide, z: w.z - K.behind }, Math.cos(amb.u * K.ambW) > 0 ? Math.PI / 2 : -Math.PI / 2); G.speed = Math.abs(Math.cos(amb.u * K.ambW)) * K.glide * K.ambW; G.pose = 'move';
    show(flat(G.pos, player.pos) > K.vanish);
  }

  /* ---------- 매 프레임 (cases.js tickCases 가 부름) ---------- */
  function tick(dt, list) {
    if (cine) tickCine(dt);
    if (!ch) for (const c of list) { const s = S(c.id); if (c.face?.follow && s.a && !s.f) { start(c, true); break; } }
    if (glim && G) tickGlim(dt);
    else if (ch && G) tickChase(dt);
    else { tickAmb(dt, list); if (!amb) setNight(false); }
    if (G && G.r.root.visible) {
      G.t += dt; G.r.root.position.copy(G.pos); G.r.root.rotation.y = G.heading;
      G.r.animate(dt, { speed: G.speed, running: false, pose: G.pose, t: G.t, air: false, jumpV: 0 });
    }
  }
  return {
    glimpse, start, tick,
    pos: (c) => (ch?.c === c && G ? G.pos.clone() : null),
    state: () => ({ ghost: !!G?.r.root.visible, at: G && [+G.pos.x.toFixed(1), +G.pos.z.toFixed(1)], night: nightOn, glim: !!glim, amb: !!amb, chase: ch && { id: ch.c.id, i: ch.i, mode: ch.mode }, cine: cine && { u: +cine.u.toFixed(1), len: cine.len } }),
    jump: (u) => { if (cine) cine.u = u; }, stop,
    next: () => { if (ch?.mode === 'go') { G.pos.copy(ch.path[ch.i]); ch.mode = ch.i >= ch.path.length - 1 ? 'pick' : 'wait'; } }, /* 확인용: 지금 가는 자리에 바로 */
  };
}
