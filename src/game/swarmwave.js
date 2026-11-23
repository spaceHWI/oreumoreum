// 서바이벌 터 한 판의 나오는 텀 (#273, balance.js SWARM.run · pace). swarm.js tickWaves 가 부름
// - 물결 하나 = 몫 n 마리(세기 si 는 판 시간으로: 물결을 당겨 불러도 세기 곡선은 그대로). 첫머리에 (1 - trickle) 몫을 gap 초 간격으로 한꺼번에(burst), 나머지는 2~3초마다 2~3마리씩 졸졸(trick)
// - 당겨 부르기: 첫머리를 다 낸 뒤 살아 있는 몹이 바닥값(floor) 아래면 pull 초 뒤 다음 물결 (남은 졸졸 몫은 버림). 물결 시간(T / waves)이 다 되면 그대로 다음 물결,
//   몹이 바닥값 이상 남아 있을 때만 breath 초 숨 고르기. 물결 번호(r.wave)는 판 끝까지 늘어남 (적어도 waves 번)
// - 몰려옴: surge.every 초마다(물결 한가운데: 15·45·75… 초)(마지막 큰 물결 전까지) 한쪽에서 물결 몫 × surge.k 가 한꺼번에(졸졸 몫에서 먼저 뗌) + 화면 가장자리에 방향 화살표 한 번
// - 동시 상한(CAP)에 걸려 못 나온 몹은 줄(r.wq)에 남아 자리가 나는 대로 나옴. 저사양은 졸졸 간격 × lowK
// - 남은 몹이 few 마리 아래면 포위·던지기 몹도 곧장 다가옴(patMode.few, swarmpat.js), 그동안 stuck 초 넘게 제자리면 물러나고 줄로 돌려 다시 나옴
// 시간은 모두 dt(초) 기준이라 30fps 에서도 같음
import * as THREE from 'three';
import { SWARM } from '../balance.js';
import { LOW } from '../gfx2.js';
import { camera } from './scene.js';
import { patMode } from './swarmpat.js';
import { toast } from './hud.js';
import { SWARM_TEXT } from '../punktext.js';

const R = SWARM.run, P = R.pace;
export const waveN = (z, i) => Math.max(1, Math.round((R.n[0] + (R.n[1] - R.n[0]) * i / Math.max(1, R.waves - 1)) * (1 + R.deep * Math.max(0, z - 1))));
const rnd = (a, b) => a + Math.random() * (b - a);

export function paceStart(r) {
  Object.assign(r, { wave: -1, wq: 0, trick: 0, wT: 0, trickT: 0, pullT: -1, breathT: 0, surgeN: 0, bigW: false, wN: 0, lowT: 0 });
}
/* 새 물결: n 마리 몫을 첫머리·졸졸로 나눔 */
function newWave(r, n) {
  r.wave++; r.wT = 0; r.pullT = -1; r.breathT = 0; r.wN = n;
  const b = Math.max(1, Math.round(n * (1 - P.trickle)));
  r.wq += b; r.trick = n - b; r.trickT = rnd(P.trickEvery[0], P.trickEvery[1]);
  r.waves[r.wave] = r.waves[r.wave] || 0;
}
const floorOf = (r, cap) => Math.min(Math.floor(cap * 0.5), Math.max(P.floorMin, Math.round(r.wN * P.floor)));

/* io: { n() 살아 있는 떼 수, cap, spawn(type, all, dir) 나온 수, list() 살아 있는 떼 몹, leave(e) 물러나게, slow 초보 보호 배, big 마지막 큰 물결, n0 지금 세기의 물결 몫 } */
export function paceTick(r, dt, io) {
  const T = r.T, wLen = T / R.waves, alive = io.n();
  r.wT += dt;
  if (r.wave < 0) { if ((r.spawnT -= dt) > 0) return; newWave(r, io.n0); r.spawnT = 0; } /* 징 뒤 firstT 초에 첫 물결 */
  if (io.big && !r.bigW) { r.bigW = true; r.wq = 0; newWave(r, io.n0); } /* 마지막 큰 물결은 바로 (사방에서) */
  /* 몰려옴 (마지막 큰 물결 전까지) */
  if (!io.big && r.t >= (r.surgeN + 0.5) * P.surge.every && r.t < T - R.bigT) { r.surgeN++; surge(r, io); }
  /* 물결 바꾸기: 당겨 부르기 · 시간 · 숨 고르기 */
  const fl = floorOf(r, io.cap);
  if (r.breathT > 0) { if ((r.breathT -= dt) <= 0) newWave(r, io.n0); }
  else if (r.pullT >= 0) { if ((r.pullT -= dt) <= 0) newWave(r, io.n0); }
  else if (r.wq <= 0 && alive < fl) r.pullT = P.pull;
  else if (r.wT >= wLen) { r.trick = 0; r.breathT = R.breath; }
  /* 내보내기: 줄(첫머리·몰려옴 남은 몫) 먼저 gap 간격, 다음 졸졸 */
  if ((r.spawnT -= dt) > 0) return;
  if (r.wq > 0) {
    const got = alive < io.cap ? io.spawn('mob', io.big) : 0;
    if (got) { r.wq -= got; r.waves[r.wave] += got; r.spawnT = SWARM.gap / io.slow; } else r.spawnT = 0.2; /* 자리를 못 찾았거나 꽉 찼으면 곧 다시 */
    return;
  }
  if (r.trick > 0 && r.breathT <= 0 && (r.trickT -= dt) <= 0) { /* 졸졸 (spawnT 가 0 아래인 동안 매 프레임 dt 씩) */
    let k = Math.min(r.trick, Math.round(rnd(P.trickN[0], P.trickN[1]))), got = 0;
    while (k-- > 0 && alive + got < io.cap) { const g = io.spawn('mob', io.big); if (!g) break; got += g; }
    r.trick -= got; r.waves[r.wave] += got;
    r.trickT = got ? rnd(P.trickEvery[0], P.trickEvery[1]) * (LOW ? P.lowK : 1) / io.slow : 0.2;
  }
}

function surge(r, io) {
  const m = Math.max(3, Math.round(r.wN * P.surge.k)), a = Math.random() * 6.283;
  const take = Math.min(r.trick, m); r.trick -= take;
  let got = 0; for (let i = 0; i < m && io.n() < io.cap; i++) { const g = io.spawn('mob', true, a); if (!g) break; got += g; }
  r.wq += Math.max(0, m - got); r.waves[r.wave] += got; /* 상한에 걸린 몫은 줄로 */
  arrow(a); toast(SWARM_TEXT.surge, 2);
}

/* 몹이 적을 때 (few): 포위·던지기도 다가옴, 끼어 제자리인 몹은 물러나 다시 나옴 */
export function paceFew(r, dt, io) {
  const a = io.n(), few = a > 0 && a < P.few;
  patMode.few = few;
  if (!few) { r.lowT = 0; return; }
  if ((r.lowT += dt) < 0.5) return; const step = r.lowT; r.lowT = 0;
  for (const e of io.list()) {
    const s = e.pst || (e.pst = { x: e.pos.x, z: e.pos.z, t: 0 });
    if (Math.hypot(e.pos.x - s.x, e.pos.z - s.z) > 0.6) { s.x = e.pos.x; s.z = e.pos.z; s.t = 0; continue; }
    if ((s.t += step) > P.stuck && e.def.swarm === 'mob') { io.leave(e); r.wq++; }
  }
}

/* ---------- 몰려옴 방향 화살표 (화면 가장자리, 한 번) ---------- */
const st = document.createElement('style');
st.textContent = `#swarm-surge { position: fixed; z-index: 6; left: 50%; top: 50%; width: 44px; height: 44px; margin: -22px 0 0 -22px; pointer-events: none; opacity: 0; transition: opacity .25s; color: #ff5a4a; filter: drop-shadow(0 2px 4px rgba(0,0,0,.5)); }
#swarm-surge.on { opacity: 1; animation: sw-surge .5s ease-in-out infinite alternate; }
@keyframes sw-surge { to { scale: 1.2; } }
@media (max-width: 600px) { #swarm-surge { width: 34px; height: 34px; margin: -17px 0 0 -17px; } }`;
document.head.appendChild(st);
const el = document.createElement('div'); el.id = 'swarm-surge'; el.setAttribute('aria-hidden', 'true');
el.innerHTML = '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 2 L22 20 L12 15 L2 20 Z" fill="currentColor" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
document.body.appendChild(el);
const _f = new THREE.Vector3();
let hideT = 0;
function arrow(a) {
  camera.getWorldDirection(_f);
  const rel = a - Math.atan2(_f.x, _f.z), sx = -Math.sin(rel), sy = -Math.cos(rel); /* 화면: 위 = 카메라 앞, 오른쪽 = 카메라 오른쪽 */
  const W = innerWidth / 2 - 40, H = innerHeight / 2 - 60, k = Math.min(W / (Math.abs(sx) || 1e-6), H / (Math.abs(sy) || 1e-6));
  el.style.transform = `translate(${(sx * k).toFixed(0)}px, ${(sy * k).toFixed(0)}px) rotate(${Math.atan2(sx, -sy)}rad)`;
  el.classList.add('on'); clearTimeout(hideT); hideT = setTimeout(() => el.classList.remove('on'), P.surge.show * 1000);
}
export const surgeOn = () => el.classList.contains('on');
