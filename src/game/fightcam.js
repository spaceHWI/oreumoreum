// 전투 때 카메라 멀어지기 (#216): 나를 노리는 적이 가까이 있으면(맞히면 적이 쫓아오므로 '내가 맞힘' 도 여기 듦) 카메라가 부드럽게 멀어지고 조금 내려다봄
// - 적 1 → CAM.fight.one, 여럿 → many, 들판 떼 → swarm, 우두머리 → boss. 가장 먼 적이 화면에 들어오게 그 거리에 맞추되 상한(max 배·maxDist m)
// - 전투가 끝나고 hold 초 뒤 천천히 돌아옴. 전투 중 사용자가 확대·축소하면(cam.zoomed 가 바뀜) 지금 보이는 거리를 cam.dist 에 굳히고 그 전투 동안 멈춤
// - 탈것·동굴·촬영 녹화 중·카메라가 follow 가 아닐 때(시네마틱·가방·사진 …)는 하지 않음. 설정 '전투 때 멀어지기'(save.fightCam, 0 이면 끔, 기본 켬)
// camera.js followCam 이 매 프레임 late.fightCam(dt, base) 를 불러 { k 거리 배율, pitch 더할 각 } 을 받는다. 벽·땅 처리는 followCam 의 것을 그대로 탐
import { CAM } from '../balance.js';
import { AGGRO } from '../enemies.js';
import { state, late } from './state.js';
import { save, persist } from './save.js';
import { life, player } from './place.js';
import { cam } from './camera.js';

const F = CAM.fight;
const S = { k: 1, pitch: 0, tgt: 1, on: false, calmT: 0, user: false, zoomed: cam.zoomed || 1, n: 0, far: 0, why: '' };
const off = () => save.fightCam === 0;
const skip = () => off() || cam.mode !== 'follow' || !!state.cave || !!state.cine || !!state.rec?.recording || !!(player.riding || player.ride || player.cart);

// 나를 노리는 적: 쫓는 중(AGGRO)이거나, 우두머리는 싸움이 붙었을 때(late.bossFight) 또는 내가 맞힌 적
function scan() {
  let n = 0, far = 0, boss = false, swarm = 0;
  const L = life.enemies?.list; if (!L) return { n, far, boss, swarm };
  const px = player.pos.x, pz = player.pos.z;
  for (const e of L) {
    if (e.state === 'flee' || e.state === 'leave' || !(e.hp > 0)) continue;
    const d = Math.hypot(e.pos.x - px, e.pos.z - pz); if (d > F.r) continue;
    if (e.boss) { if (!(late.bossFight?.() || e.hitByMe || AGGRO.has(e.state))) continue; boss = true; }
    else if (!AGGRO.has(e.state)) continue;
    n++; if (e.def?.swarm) swarm++; if (d > far) far = d;
  }
  return { n, far, boss, swarm };
}

function tick(dt, base) {
  if (skip()) { S.on = false; S.user = false; S.tgt = 1; S.why = 'skip'; }
  else {
    const r = scan(); S.n = r.n; S.far = r.far;
    if (r.n > 0) {
      if (!S.on) { S.on = true; S.user = false; S.zoomed = cam.zoomed; }
      S.calmT = 0;
      if (cam.zoomed !== S.zoomed) { /* 사용자가 손으로 바꿈: 지금 보이는 거리를 그대로 두고 이 전투 동안 자동을 멈춤 */
        if (!S.user && S.k !== 1) { cam.dist = Math.min(40, cam.dist * S.k); S.k = 1; }
        S.user = true; S.zoomed = cam.zoomed;
      }
      const lvl = r.boss ? F.boss : r.swarm >= F.swarmN ? F.swarm : r.n > 1 ? F.many : F.one;
      const fitK = base > 0 ? (r.far * F.fit) / base : 1;
      S.tgt = S.user ? 1 : Math.max(1, Math.min(F.max, Math.max(lvl, fitK), base > 0 ? F.maxDist / base : F.max));
      S.why = r.boss ? 'boss' : r.swarm >= F.swarmN ? 'swarm' : r.n > 1 ? 'many' : 'one';
    } else if (S.on) { S.calmT += dt; if (S.calmT >= F.hold) { S.on = false; S.user = false; } }
    if (!S.on) S.tgt = 1;
  }
  const goOut = S.tgt > S.k, T = goOut ? F.inT : F.outT;
  S.k += (S.tgt - S.k) * Math.min(1, dt * (3 / T)); /* 약 T 초에 95% */
  if (Math.abs(S.k - S.tgt) < 0.002) S.k = S.tgt;
  const span = Math.max(0.01, F.one - 1);
  S.pitch = F.pitch * Math.min(1, Math.max(0, (S.k - 1) / span));
  return S;
}
late.fightCam = tick;

// ---------- 설정: 전투 때 멀어지기 ----------
{
  const more = document.querySelector('#menu .m-more') || document.querySelector('.m-more');
  if (more) {
    const b = document.createElement('button'); b.type = 'button'; b.id = 'menu-fightcam';
    const sync = () => { b.textContent = `전투 때 멀어지기: ${off() ? '끔' : '켬'}`; b.setAttribute('aria-pressed', String(!off())); };
    sync(); b.addEventListener('click', () => { save.fightCam = off() ? 1 : 0; persist(); sync(); });
    more.appendChild(b);
  }
}

// 확인용 (__oreum.fightCam)
late.fightCamApi = { s: () => ({ k: +S.k.toFixed(3), tgt: +S.tgt.toFixed(3), pitch: +S.pitch.toFixed(3), on: S.on, user: S.user, n: S.n, far: +S.far.toFixed(1), why: S.why, calmT: +S.calmT.toFixed(2), dist: +cam.dist.toFixed(2), off: off() }) };
