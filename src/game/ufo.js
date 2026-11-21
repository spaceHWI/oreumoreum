// 첫 화면 UFO (#150): 시작 전, 뒤 풍경 하늘로 비행접시가 로고 뒤를 스치며 가로지름. 시작하면 사라짐
// 카메라 앞 UFO.dist 거리에 두고 화면 좌표로 움직임(첫 화면 카메라가 오름을 돌아도 늘 화면 안을 지나감). 게임 안 구역 5 외계인과는 따로
// 모양은 코드로: 납작한 접시 + 둥근 덮개(안에 초록 외계인) + 테두리 불빛, 아래 옅은 초록 빛기둥(저사양은 빼고 접시만)
import * as THREE from 'three';
import { UFO } from '../balance.js';
import { LOW } from '../gfx2.js';
import { gradHard } from '../toon.js';
import { state, late } from './state.js';
import { $ } from './save.js';
import { scene, camera } from './scene.js';
import { sound } from './hooks.js';

const ON = new THREE.Color('#ffd23f'), OFF = new THREE.Color('#8a7a3a');
const toon = (color) => new THREE.MeshToonMaterial({ color, gradientMap: gradHard, fog: false, emissive: color, emissiveIntensity: 0.35 }); // 밤에도 하늘에서 보이게 조금 스스로 빛남
function build() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const disc = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 10), toon('#b9c6c1')); disc.scale.set(1, 0.24, 1); body.add(disc);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.07, 6, 28), toon('#6f7f79')); rim.rotation.x = Math.PI / 2; body.add(rim);
  const belly = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.14, 16), toon('#7d8c86')); belly.position.y = -0.2; body.add(belly);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.46, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshToonMaterial({ color: '#bdf0e2', gradientMap: gradHard, fog: false, transparent: true, opacity: 0.55, depthWrite: false }));
  dome.position.y = 0.14; dome.renderOrder = 2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), toon('#8fd06a')); head.position.y = 0.3; body.add(head); body.add(dome);
  const eyeM = new THREE.MeshBasicMaterial({ color: '#1c1c22', fog: false });
  for (const k of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), eyeM); e.scale.set(0.8, 1.3, 0.5); e.position.set(k * 0.085, 0.31, 0.17); e.rotation.z = -k * 0.4; body.add(e); }
  // 테두리 불빛 8개: 한 번에 그리기(InstancedMesh), 번갈아 깜빡임은 색으로
  const lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false }), 8), m4 = new THREE.Matrix4();
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; lights.setMatrixAt(i, m4.makeTranslation(Math.cos(a) * 0.82, 0.02, Math.sin(a) * 0.82)); lights.setColorAt(i, ON); }
  body.add(lights);
  let beam = null;
  if (!LOW) { // 빛기둥: 위가 좁고 아래가 넓은 옅은 초록 원뿔
    beam = new THREE.Mesh(new THREE.ConeGeometry(0.75, 2.6, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#9dff9a', transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
    beam.position.y = -1.5; beam.renderOrder = 1; g.add(beam);
  }
  g.visible = false; g.frustumCulled = false; g.traverse((o) => { o.frustumCulled = false; });
  return { g, body, lights, beam };
}

const U = build(); U.g.userData.noCull = true; scene.add(U.g); // 멀리 감추기(farCull)에서 빼기: 카메라 앞을 따라다님
let wait = UFO.first, t = -1, dir = 1, y0 = 0.5, done = false;
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tilt = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
const introOn = () => !$('intro').hidden && !state.sessionOn;
// 로고 윗선 높이를 화면 좌표(-1~1)로: 접시가 글자 윗부분 뒤를 스치고 덮개·빛기둥은 보이게. 로고가 안 보이면(도움말) 화면 위쪽 1/4
function logoY() {
  const el = $('intro-logo'), r = el?.getBoundingClientRect();
  if (!r || !r.height) return 0.5;
  return 1 - 2 * (r.top + r.height * 0.08) / innerHeight;
}
function end() { done = true; U.g.visible = false; scene.remove(U.g); U.g.traverse((o) => { o.geometry?.dispose(); }); }
export function tickUfo(dt) {
  if (done) return;
  if (!introOn()) { if (state.sessionOn) end(); else U.g.visible = false; return; } // 시작을 누르면 사라짐
  if (t < 0) { wait -= dt; if (wait > 0) { U.g.visible = false; return; } t = 0; dir = Math.random() < 0.5 ? 1 : -1; y0 = logoY(); sound.ufo?.(); }
  t += dt; const u = t / UFO.cross;
  if (u >= 1) { t = -1; wait = UFO.gap[0] + Math.random() * (UFO.gap[1] - UFO.gap[0]); U.g.visible = false; return; }
  const D = UFO.dist, hh = D * Math.tan(camera.fov * Math.PI / 360), hw = hh * camera.aspect;
  const diam = Math.min(2 * hh * UFO.size, 2 * hw * UFO.sizeW), s = diam / 2;
  const sm = u * u * (3 - 2 * u) * 0.35 + u * 0.65; // 들어올 때·나갈 때 살짝 느리게
  const x = dir * (-(hw + diam) + sm * 2 * (hw + diam)), y = y0 * hh + Math.sin(t * 2.6) * diam * UFO.bob;
  camera.getWorldDirection(fwd); right.set(1, 0, 0).applyQuaternion(camera.quaternion); up.set(0, 1, 0).applyQuaternion(camera.quaternion);
  U.g.position.copy(camera.position).addScaledVector(fwd, D).addScaledVector(right, x).addScaledVector(up, y);
  U.g.quaternion.copy(camera.quaternion); // 화면과 같은 방향으로 세운 뒤 윗면이 조금 보이게 숙이고, 가는 쪽으로 기우뚱
  tilt.setFromAxisAngle(X, 0.32); U.g.quaternion.multiply(tilt);
  tmpQ.setFromAxisAngle(Z, -dir * 0.14 + Math.sin(t * 3.1) * 0.07); U.g.quaternion.multiply(tmpQ);
  U.g.scale.setScalar(s);
  const blink = Math.floor(t * 8);
  for (let i = 0; i < 8; i++) U.lights.setColorAt(i, (i + blink) % 2 ? ON : OFF);
  U.lights.instanceColor.needsUpdate = true;
  if (U.beam) U.beam.material.opacity = 0.14 + 0.08 * Math.sin(t * 9) * Math.sin(t * 2.3);
  U.g.visible = true;
}
late.tickUfo = tickUfo;
// 확인용 (#150): window.__oreum.ufo() 로 바로 지나가게
late.ufoNow = () => { if (!done) { t = -1; wait = 0; } };
const pv = new THREE.Vector3();
late.ufoInfo = () => ({ on: U.g.visible, t, wait: +wait.toFixed(1), done, x: U.g.visible ? +pv.copy(U.g.position).project(camera).x.toFixed(2) : null, y: U.g.visible ? +pv.copy(U.g.position).project(camera).y.toFixed(2) : null, beam: !!U.beam });
