// 전투 때 카메라 멀어지기 (#216): 적이 나를 노리기 시작하거나 내가 맞히면 카메라가 부드럽게 물러나 위에서 조금 내려다봄
// - 거리 배율은 cam.dist 를 바꾸지 않고 camFx.dist 로 곱함 (camera.js followCam). 사람이 정한 거리·튜토리얼 확대 단계(cam.zoomed)는 그대로
// - 적 하나 → CAM.fight.one, 셋 넘게 → many, 들판 떼 → swarm, 우두머리·레이드 → boss. 가장 먼 적까지는 fit 만큼 맞춰 물러남 (상한 max·maxDist)
// - 전투가 끝나고 holdT 초 뒤 천천히 돌아옴. 전투 중 사람이 확대·축소하면 지금 보이는 거리를 cam.dist 에 넣고 그 전투 동안 자동을 멈춤
// - 탈것·동굴·촬영 모드·시네마틱·첫 화면 연출(awe) 중에는 하지 않음. 설정 '전투 때 멀어지기' (save.fightCam === 0 이면 끔)
import { CAM } from '../balance.js';
import { state, late } from './state.js';
import { save, persist } from './save.js';
import { cam, camFx, camRiding } from './camera.js';
import { player, life } from './place.js';
import { toast } from './hud.js';

const F = CAM.fight;
const CHASE = new Set(['charge', 'wind', 'dash', 'back', 'stagger']);
const S = { k: 1, p: 0, hold: 0, user: false, on: false, n: 0, far: 0, why: '' };
const off = () => save.fightCam === 0;
function blocked() {
  if (off()) return 'off';
  if (cam.mode !== 'follow') return 'mode';
  if (camRiding()) return 'ride';
  if (state.cave) return 'cave';
  if (save.rec?.on) return 'rec';
  if (state.cine || state.awe > 0 || state.aweBack > 0) return 'cine';
  return '';
}
function scan() {
  let n = 0, far = 0; const p = player.pos, list = life.enemies?.list || [];
  for (const e of list) {
    if (!CHASE.has(e.state)) continue;
    const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z); if (d > F.near) continue;
    n++; if (d > far) far = d;
  }
  return { n, far };
}
function want() {
  const { n, far } = scan(); S.n = n; S.far = far;
  const boss = !!(late.bossFight?.() || late.raidFight?.()), swarm = !!late.swarmOn?.();
  if (!n && !boss) return 0;
  let k = boss ? F.boss : swarm ? F.swarm : n >= F.manyN ? F.many : F.one;
  if (cam.dist > 0) k = Math.max(k, far * F.fit / cam.dist);
  k = Math.min(k, F.max); if (cam.dist > 0) k = Math.min(k, Math.max(1, F.maxDist / cam.dist));
  return k;
}
export function tickFightCam(dt) {
  state.ticks.fightCam++;
  const why = blocked(); S.why = why;
  let tk = 1, tp = 0;
  if (!why) {
    const k = want(), fight = k > 0;
    if (fight) S.hold = F.holdT; else if (S.hold > 0) S.hold -= dt;
    if (S.on && !fight && S.hold <= 0) S.user = false; /* 전투가 끝나면 다음 전투부터 다시 자동 */
    S.on = fight || S.hold > 0;
    if (S.on && !S.user) { tk = fight ? k : S.k; tp = fight ? F.pitch : S.p; }
  } else { S.on = false; S.hold = 0; S.user = false; }
  const T = tk > S.k ? F.inT : F.outT, a = 1 - Math.exp(-dt / T);
  if (why === 'ride' || why === 'cave' || why === 'mode' || why === 'cine') { S.k = 1; S.p = 0; } /* 다른 카메라 규칙이 맡음: 바로 놓음 */
  else { S.k += (tk - S.k) * a; S.p += (tp - S.p) * a; if (Math.abs(S.k - 1) < 1e-3 && tk === 1) S.k = 1; }
  camFx.dist = S.k; camFx.pitch = S.p;
}
// 사람이 확대·축소함 (input.js userZoom 이 먼저 부름): 지금 보이는 거리를 cam.dist 에 넣고 이 전투 동안 자동을 멈춤
late.fightZoomUser = () => {
  if (S.k === 1 && !S.on) return;
  cam.dist = Math.min(40, cam.dist * S.k); S.k = 1; S.p = 0; camFx.dist = 1; camFx.pitch = 0;
  if (S.on) S.user = true;
};
late.tickFightCam = tickFightCam;

// ---------- 설정: 전투 때 멀어지기 (#201 스위치 모양은 optui.js) ----------
{
  const more = document.querySelector('#menu .m-more') || document.querySelector('.m-more');
  if (more) {
    const b = document.createElement('button'); b.type = 'button'; b.id = 'menu-fightcam';
    const sync = () => { b.textContent = `전투 때 멀어지기: ${off() ? '끔' : '켬'}`; b.setAttribute('aria-pressed', String(!off())); };
    sync(); b.addEventListener('click', () => { save.fightCam = off() ? 1 : 0; persist(); sync(); toast(off() ? '전투 때 카메라를 그대로 둬요' : '전투 때 카메라가 조금 멀어져요'); });
    more.appendChild(b);
  }
}

late.fightCam = { step: (dt = 0.1, n = 10) => { for (let i = 0; i < n; i++) tickFightCam(dt); return late.fightCam.state(); }, state: () => ({ k: +S.k.toFixed(3), p: +S.p.toFixed(3), on: S.on, user: S.user, hold: +S.hold.toFixed(2), n: S.n, far: +S.far.toFixed(1), why: S.why, dist: +cam.dist.toFixed(2) }) };
