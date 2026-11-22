// 카메라, 첫 화면 궤도 (#86 에서 main.js 를 나눔. 파일 순서는 src/main.js, 규칙은 notes/prototype-v1.md 코드 구조)
import { BLOOM_FX, PACE, TITLE, CHARGE, CAM } from '../balance.js';
import * as THREE from 'three';
import { height } from '../world.js';
import { state, late } from './state.js';
import { camera } from './scene.js';
import { P, player } from './place.js';

// ---------- 카메라 ----------
export const cam = { yaw: player.heading + Math.PI, pitch: 0.32, dist: 13, mode: 'follow', look: new THREE.Vector3(), pos: new THREE.Vector3() };
export const camTarget = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
export const camFx = { dist: 1, pitch: 0 }; // 전투 때 거리 배율·위로 더 내려다보는 각 (#216, game/fightcam.js 가 정함)
state.camPullT = -1; // 꽃밭 카메라 (#65): 0 부터 camT 초 동안. 조작은 막지 않음
function camPullK() { const T = BLOOM_FX.zone.camT; if (state.camPullT < 0 || state.camPullT >= T) return 0; const u = state.camPullT / T, sm = (x) => x * x * (3 - 2 * x); return u < 0.35 ? sm(u / 0.35) : u > 0.6 ? sm((1 - u) / 0.4) : 1; }
// 탈 때(노루·탈것·마차) 카메라 (#170): 위아래 상한만 조금 넓히고 거리를 조금 늘림. 위아래 범위는 걸을 때와 같음
export const camRiding = () => !!(player.riding || player.ride || player.cart);
export const camPitchMax = () => (camRiding() ? CAM.ridePitchMax : CAM.pitchMax);
export const camPitchMin = () => (camRiding() ? CAM.ridePitchMin : CAM.pitchMin);
/* 탈 때 올려다보기 (#213): 위로 볼수록 카메라를 당기고 바라보는 점을 올림. 바라보는 점은 탈것 높이만큼 기준을 올림 */
const rideLookH = () => { const L = CAM.rideLook; return player.riding ? L.deer : player.cart ? L.cart : player.ride ? (L[player.ride] ?? 0) : 0; };
let rideK = 1, upK = 0;
export function followCam(dt, snap) {
  const pMax = camPitchMax(), pMin = camPitchMin();
  if (cam.mode === 'follow') { if (cam.pitch > pMax) cam.pitch = pMax; if (cam.pitch < pMin) cam.pitch = pMin; } // 내리면 탈 때만 되던 각도에서 돌아옴
  const up = camRiding() && cam.pitch < 0 ? Math.min(1, cam.pitch / CAM.ridePitchMin) : 0;
  upK = snap ? up : upK + (up - upK) * Math.min(1, dt * 10);
  const look = player.pos.clone(); look.y = player.visY + 1.6 + rideLookH() + upK * CAM.rideUpLift;
  const rk = camRiding() ? CAM.rideDist * (1 - upK * (1 - CAM.rideUpDist)) : 1; rideK = snap ? rk : rideK + (rk - rideK) * Math.min(1, dt * CAM.rideDistK);
  const pk = camPullK(), pitch = Math.max(pMin, Math.min(pMax, cam.pitch + pk * BLOOM_FX.zone.camPitch + camFx.pitch)), cp = Math.cos(pitch); // 꽃밭이 될 때 잠깐 물러남 (#65)
  const off = new THREE.Vector3(Math.sin(cam.yaw) * cp, Math.sin(pitch), Math.cos(cam.yaw) * cp).multiplyScalar(cam.dist * camFx.dist * rideK * (1 + pk * BLOOM_FX.zone.camDist) * (1 - PACE.camIn * (state.tension || 0))); // 긴장 때 조금 가까이 (#89)
  const p = look.clone().add(off);
  const gh = height(p.x, p.z) + 1.2;
  if (p.y < gh) { look.y += (gh - p.y) * 0.8; p.y = gh; }
  let lift = 0;
  for (let i = 1; i <= 8; i++) { const t = i / 9; const sx = p.x + (look.x - p.x) * t, sz = p.z + (look.z - p.z) * t; const need = height(sx, sz) + 1.0 - (p.y + (look.y - p.y) * t); if (need > 0) lift = Math.max(lift, need); }
  if (lift > 0) { p.y += lift; look.y += lift * 0.9; }
  const g = state.glance; // #135 첫 투기꾼이 나타나면 카메라가 잠깐 그쪽을 봄 (조작은 막지 않음)
  if (g) { g.t += dt; if (g.t >= g.T) state.glance = null; else { const k = Math.sin(g.t / g.T * Math.PI); look.x += (g.x - look.x) * 0.5 * k; look.z += (g.z - look.z) * 0.5 * k; } }
  const fx = player.pos.x + Math.sin(player.heading) * 6, fz = player.pos.z + Math.cos(player.heading) * 6;
  const rise = height(fx, fz) - player.pos.y;
  if (rise > 0) look.y += Math.min(6, rise * 0.9);
  camTarget.pos.copy(p); camTarget.look.copy(look);
  ease(dt, snap, 8);
}
// 첫 화면 (#72): 정상 표지석 둘레를 천천히 돎. 시작하면 캐릭터 뒤로 바로 옮김
let titleT = 0;
export function titleCam(dt) {
  titleT += dt;
  const c = P.stone, a = player.heading + Math.PI + titleT * TITLE.spin;
  camTarget.look.set(c.x, c.y + TITLE.lookUp, c.z);
  camTarget.pos.set(c.x + Math.sin(a) * TITLE.r, 0, c.z + Math.cos(a) * TITLE.r);
  camTarget.pos.y = Math.max(c.y + TITLE.up, height(camTarget.pos.x, camTarget.pos.z) + 8);
  ease(dt, titleT === dt, 3);
}
export function endTitleCam() { if (cam.mode !== 'title') return; cam.mode = 'follow'; followCam(0, true); }
export function ease(dt, snap, k) {
  const a = snap ? 1 : 1 - Math.exp(-dt * k);
  cam.pos.lerp(camTarget.pos, a); cam.look.lerp(camTarget.look, a);
  camera.position.copy(cam.pos); camera.lookAt(cam.look);
  if (state.shake > 0 && cam.mode === 'follow' && !late.feel?.calm) { const a = CHARGE.shake * state.shake / CHARGE.shakeT; camera.position.x += (Math.random() - 0.5) * 2 * a; camera.position.y += (Math.random() - 0.5) * 2 * a; } // 가득 모은 샷이 맞음 (#129, game/charge.js 가 줄임)
}
