// 엔딩 시네마틱 (#168, 사용자 결정 2026-11-21): 구역 5 우두머리를 쫓은 뒤 외계인의 사과 '불편을 줘서 죄송합니다.' 를 같은 방 모두가 함께 강제로 본다
// - 길이 STORY.end.len 초. 위아래 검은 띠·조작 잠금(update.js)·모두 무적(hooks.js enemyHit)·적·투기꾼 멈춤. 창(가게·가방)은 닫고 끝나면 열려 있던 창을 되돌림
// - 카메라: 굼부리 → 하늘의 UFO 떼 → 하늘에 큰 글씨 → 쓰레기를 싣고 떠나는 UFO → 오름 전경 + '○○ 님이 오름의 비밀을 밝혔습니다' 와 그때 방에 있던 사람들
// - 시작 STORY.end.lead 초 전 화면 위 알림과 소리. 건너뛰기는 없음 (이미 본 사람은 skipAfter 초 뒤 건너뛰기)
// - 멀티: 끝낸 사람이 {t:'end'} → 방(server/src/roomcore.js)이 시작 시각 at 을 정해 모두에게 {t:'end', at, by, names}. 화면마다 그 시각에 맞춰 같은 장면(도중에 들어온 사람은 hi.end 로 남은 부분부터)
//   방에서 하루 한 번만 모두에게. 그날 두 번째부터는 끝낸 사람만 보고({solo:1}) 나머지는 오름 방송 한 줄({t:'endr', by})
// - 혼자 하기·손님(방 없음)은 자기만. 남의 화면으로 먼저 본 사람도 자기 줄거리는 그대로 이어 가고, 자기가 끝냈을 때 다시 본다
// (파일 순서는 src/modules.js: boss 뒤, story 앞)
import * as THREE from 'three';
import { STORY } from '../balance.js';
import { STORY_TEXT } from '../punktext.js';
import { height } from '../world.js';
import { buildEnemyModel } from '../enemymodels.js';
import { veilModel } from '../ufoveil.js';
import { nsPaths, nsSummit } from '../namsongi.js';
import { state, late } from './state.js';
import { $, save, persist } from './save.js';
import { scene } from './scene.js';
import { life, player } from './place.js';
import { cam, camTarget, ease, followCam } from './camera.js';
import { PANELS, closePanels } from './hud.js';
import { say } from './director.js';
import { sound, dumpers } from './hooks.js';
const sfx = (k, ...a) => { try { if (sound.on) sound[k]?.(...a); } catch { /* 소리가 꺼져 있음 */ } };

const E = STORY.end, T = STORY_TEXT.end;
const G = new THREE.Group(); scene.add(G);

// UFO (#71 외계인 비행접시를 k 배로) + 아래 빛기둥. 이야기 이벤트(story.js)도 씀
const beamMat = new THREE.MeshBasicMaterial({ color: '#c9ffb8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
const beamGeo = new THREE.ConeGeometry(1, 1, 14, 1, true).translate(0, -0.5, 0);
export function makeUfo(k, parent = G, glow = false) { /* glow: 단계 3 전(#207) 모양 대신 흐린 빛 덩이 */
  const m = buildEnemyModel('alien'); m.root.scale.setScalar(k); if (glow) veilModel(m);
  const beam = new THREE.Mesh(beamGeo, beamMat.clone()); beam.visible = false; m.root.add(beam);
  parent.add(m.root);
  return {
    root: m.root, beam, k,
    setBeam(len, op) { beam.visible = op > 0.01; beam.scale.set(1.6, Math.max(0.01, len / k), 1.6); beam.material.opacity = op; },
    dispose() { parent.remove(m.root); beam.material.dispose(); },
  };
}

// 굼부리 가운데 (둘레 선의 평균)
const C = (() => { const L = nsPaths?.crater || []; if (!L.length) return { x: nsSummit.x, z: nsSummit.z, y: nsSummit.y }; let x = 0, z = 0; for (const p of L) { x += p[0]; z += p[1]; } x /= L.length; z /= L.length; return { x, z, y: height(x, z) }; })();

// ---------- 화면 ----------
const css = document.createElement('style');
css.textContent = `#cine{position:fixed;inset:0;z-index:60;pointer-events:auto;touch-action:none}
#cine .cb{position:absolute;left:0;right:0;height:0;background:#000;transition:height .8s ease}
#cine .cb.t{top:0}#cine .cb.b{bottom:0}#cine.on .cb{height:11vh}
#cine .big{position:absolute;left:6%;right:6%;top:30%;text-align:center;font-family:var(--display);font-weight:800;font-size:clamp(26px,6vw,64px);color:#fff;text-shadow:0 3px 0 #1d1a17,0 0 24px rgba(160,255,200,.7);opacity:0;transition:opacity 1.4s}
#cine .cr{position:absolute;left:6%;right:6%;bottom:14vh;text-align:center;color:#fff;font-family:var(--body);opacity:0;transition:opacity 1.2s}
#cine .cr b{display:block;font-family:var(--display);font-weight:800;font-size:clamp(16px,3.4vw,26px);margin-bottom:6px;text-shadow:0 2px 0 #1d1a17}
#cine .cr small{font-size:13px;opacity:.85;text-shadow:0 1px 0 #1d1a17}
#cine .sk{position:absolute;right:16px;bottom:calc(11vh + 12px);padding:8px 14px;border-radius:999px;border:2px solid #fff;background:rgba(0,0,0,.35);color:#fff;font-weight:700;font-family:var(--body)}
body.cine>*:not(#view):not(#cine):not(#cine-soon){visibility:hidden!important}
#cine-soon{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:61;padding:8px 16px;border-radius:999px;background:#1d1a17;color:#c9ffb8;font-weight:800;font-family:var(--display)}`;
document.head.append(css);
const el = document.createElement('div'); el.id = 'cine'; el.hidden = true;
el.innerHTML = '<div class="cb t"></div><div class="cb b"></div><div class="big"></div><div class="cr"><b></b><small></small></div><button class="sk" hidden></button>';
document.body.append(el);
const soon = document.createElement('div'); soon.id = 'cine-soon'; soon.hidden = true; document.body.append(soon);
const big = el.querySelector('.big'), cr = el.querySelector('.cr'), sk = el.querySelector('.sk');
big.textContent = T.big; sk.textContent = T.skip;
sk.addEventListener('click', () => stop());
for (const ev of ['pointerdown', 'pointermove', 'wheel', 'touchstart']) el.addEventListener(ev, (e) => { if (e.target !== sk) e.preventDefault(); }, { passive: false }); // 아래 화면 조작을 막음

// ---------- 차례 ----------
let run = null; // { at 시작 시각(이 기기 ms), by, names, mine, onEnd, fleet, wasOpen, prev }
let pend = null; // 시작 전 (lead 동안) 같은 꼴
// 적·투기꾼 멈춤 (시네마틱 동안)
{ const u0 = life.enemies.update; life.enemies.update = (dt, t) => { if (!state.cine) u0(dt, t); }; }
if (dumpers) { const u1 = dumpers.update; dumpers.update = (dt, t) => { if (!state.cine) u1(dt, t); }; }

function schedule(o) {
  if (run) { if (o.mine && !run.mine) { run.mine = true; run.onEnd = o.onEnd; } return; } // 이미 보는 중이면 그것으로 (끝낸 사람이면 끝에 보상)
  pend = o;
  if (o.at - Date.now() > 300) { soon.textContent = T.soon; soon.hidden = false; sfx('crow'); late.closeBag?.(); }
}
function begin(o) {
  pend = null; soon.hidden = true;
  const wasOpen = PANELS.filter((id) => $(id) && !$(id).hidden); closePanels(); late.closeBag?.();
  run = { ...o, fleet: [], wasOpen, prev: cam.mode === 'cine' ? 'follow' : cam.mode, u0: Math.max(0, (Date.now() - o.at) / 1000) };
  state.cine = run; cam.mode = 'cine'; player.target = null;
  for (let i = 0; i < E.ufos; i++) { const f = makeUfo(i === 0 ? 4.6 : 2.6 + (i % 3) * 0.5); f.a = i / E.ufos * 6.283; f.r = i === 0 ? 0 : 26 + (i % 2) * 8; f.h = i === 0 ? 62 : 70 + (i % 3) * 5; run.fleet.push(f); }
  cr.querySelector('b').textContent = T.by(o.by || save.nick || '누군가');
  cr.querySelector('small').textContent = (o.names || []).filter(Boolean).slice(0, 12).join(' · ');
  el.hidden = false; document.body.classList.add('cine'); requestAnimationFrame(() => el.classList.add('on'));
  big.style.opacity = '0'; cr.style.opacity = '0'; sk.hidden = true;
  late.sound?.fanfare?.();
}
function stop() {
  if (!run) return;
  const r = run; run = null; state.cine = null;
  for (const f of r.fleet) f.dispose();
  el.classList.remove('on'); el.hidden = true; document.body.classList.remove('cine');
  cam.mode = r.prev && r.prev !== 'title' ? r.prev : 'follow'; if (cam.mode === 'follow') followCam(0, true);
  for (const id of r.wasOpen) if ($(id)) $(id).hidden = false; // 열려 있던 창으로 되돌아옴
  save.story ||= {}; save.story.seen = 1; persist();
  if (r.mine) r.onEnd?.(); else say('radio', 'endSeen', T.clue, 3, { ttl: 8 });
}
// 시네마틱 카메라 (update.js 가 cam.mode 'cine' 일 때 부름)
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
late.cineCam = (dt) => {
  if (!run) { cam.mode = 'follow'; return; }
  const u = run.u, sky = C.y + 66, fleetGo = smooth(31, 40, u);
  // 0~9 굼부리 둘레, 9~19 하늘로 고개, 19~31 UFO 떼와 큰 글씨, 31~40 떠나는 UFO, 40~ 오름 전경
  const a = 0.6 + u * 0.035, r = 72 - smooth(0, 9, u) * 18, up = smooth(8, 18, u);
  const px = C.x + Math.sin(a) * r, pz = C.z + Math.cos(a) * r, py = Math.max(height(px, pz) + 22, C.y + 48 - up * 10); // 굼부리 둘레 능선·나무보다 위에서
  const lx = C.x, lz = C.z, ly = C.y + up * (sky - C.y) + fleetGo * 30;
  const pan = smooth(39, 44, u), pa = 2.2 + u * 0.03, pr = 230;
  const qx = nsSummit.x + Math.sin(pa) * pr, qz = nsSummit.z + Math.cos(pa) * pr, qy = Math.max(height(qx, qz) + 20, nsSummit.y + 70);
  camTarget.pos.set(px + (qx - px) * pan, py + (qy - py) * pan, pz + (qz - pz) * pan);
  camTarget.look.set(lx + (nsSummit.x - lx) * pan, ly + (nsSummit.y - ly) * pan, lz + (nsSummit.z - lz) * pan);
  ease(dt, run.snap !== false && (run.snap = false, true), 1.6);
};
function tickEnding(dt) {
  if (pend && !run && Date.now() >= pend.at) begin(pend);
  if (!run) return;
  run.u = Math.max(run.u0, (Date.now() - run.at) / 1000);
  const u = run.u, sky = C.y + 66, go = smooth(31, 41, u), show = smooth(6, 14, u);
  for (const f of run.fleet) { // 하늘에 떼로 내려와 둥글게 돎 → 빛기둥으로 쓰레기를 싣고 → 하늘로 떠남
    f.a += dt * 0.22; const rr = f.r * (1 + go * 3), hh = sky + (f.h - 66) + (1 - show) * 140 + go * go * 160; // 높은 하늘에서 내려옴
    f.root.position.set(C.x + Math.sin(f.a) * rr, hh, C.z + Math.cos(f.a) * rr); f.root.rotation.y += dt * 0.8;
    const lift = u > 29 && u < 35 ? Math.sin((u - 29) / 6 * Math.PI) : 0; f.setBeam(hh - C.y, 0.4 * lift);
  }
  big.style.opacity = u > 19 && u < 30 ? '1' : '0';
  cr.style.opacity = u > 41 ? '1' : '0';
  sk.hidden = !(save.story?.seen && u > E.skipAfter);
  if (u >= E.len) stop();
}
late.tickEnding = tickEnding;

// ---------- 시작 ----------
let room = null, live = false, off = 0, offRtt = Infinity, mineWait = null, mineT = 0;
function sync(n) { for (let i = 0; i < n; i++) setTimeout(() => { if (live) room?.send?.({ t: 'ping', c: ['end', Date.now()] }); }, 1500 + i * 1200); } // 들어온 뒤 몇 번 (방 시각에 맞춰 같은 장면을 돌리려고)
// mine: 내가 끝냄 (onEnd 에서 보상). 방이 있으면 방에 알려 같은 시각에, 없으면 혼자
export function startEnding({ mine = true, onEnd = null } = {}) {
  if (live && room?.send?.({ t: 'end' })) { mineWait = { onEnd }; mineT = Date.now(); setTimeout(() => { if (mineWait && mineT && Date.now() - mineT >= 1900) { const w = mineWait; mineWait = null; schedule({ at: Date.now() + E.lead * 1000, by: save.nick, names: [save.nick], mine: true, onEnd: w.onEnd }); } }, 2000); return; } /* 방이 답이 없으면 혼자 */
  schedule({ at: Date.now() + E.lead * 1000, by: save.nick, names: [save.nick], mine, onEnd });
}
late.endNet = {
  link(r) {
    if (!r.on) return; room = r;
    r.on('hi', (m) => { live = true; if (Number.isFinite(m.now)) { off = m.now - Date.now(); offRtt = Infinity; } sync(3); if (Array.isArray(m.end) && Number.isFinite(m.end[0])) schedule({ at: m.end[0] - off, by: m.end[1], names: m.end[2], mine: false }); });
    r.on('close', () => { live = false; });
    r.on('pong', (m) => { // 시계 맞추기: 왕복이 가장 짧았던 것으로 (방 시각 - 이 기기 시각)
      if (!Array.isArray(m.c) || m.c[0] !== 'end' || !Number.isFinite(m.c[1]) || !Number.isFinite(m.s)) return;
      const now = Date.now(), rtt = now - m.c[1]; if (rtt < 0 || rtt >= offRtt) return;
      offRtt = rtt; off = m.s - (m.c[1] + now) / 2;
    });
    r.on('end', (m) => {
      if (!Number.isFinite(m.at)) return;
      const w = mineWait; mineWait = null;
      if (m.solo && !w) return;
      schedule({ at: m.at - off, by: typeof m.by === 'string' ? m.by : '', names: Array.isArray(m.names) ? m.names.filter((v) => typeof v === 'string') : [], mine: !!w, onEnd: w?.onEnd });
    });
    r.on('endr', (m) => { if (typeof m.by === 'string') say('radio', 'endRadio', T.radio(m.by), 3.2, { ttl: 20 }); }); // 그날 두 번째부터: 오름 방송 한 줄
  },
};
export const endingApi = {
  play: (o = {}) => schedule({ at: Date.now() + (o.lead ?? E.lead) * 1000, by: o.by || save.nick, names: o.names || [save.nick], mine: false }),
  stop, state: () => (run ? { u: +run.u.toFixed(1), mine: run.mine, ufos: run.fleet.length, cam: cam.mode, big: big.style.opacity, cine: !!state.cine } : pend ? { pend: true, mine: !!pend.mine, in: +((pend.at - Date.now()) / 1000).toFixed(1) } : null),
  jump: (u) => { if (run) run.at = Date.now() - u * 1000; },
  crater: C, summit: nsSummit, cam: () => ({ pos: cam.pos.toArray().map(Math.round), look: cam.look.toArray().map(Math.round), tgt: camTarget.pos.toArray().map(Math.round) }),
};
late.endingApi = endingApi;
