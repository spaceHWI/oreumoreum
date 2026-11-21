// 첫 화면 UFO (#150): 시작 전, 뒤 풍경 하늘로 비행접시가 로고 뒤를 스치며 가로지름. 시작하면 사라짐
// 카메라 앞 UFO.dist 거리에 두고 화면 좌표로 움직임(첫 화면 카메라가 오름을 돌아도 늘 화면 안을 지나감). 게임 안 구역 5 외계인과는 따로
// 모양은 코드로: 납작한 접시 + 둥근 덮개(안에 초록 외계인) + 테두리 불빛
// 빛기둥 (#192): 로고 아래 오름 능선·정상 위를 지나며 땅까지 닿는 옅은 초록 원뿔(위 진하고 아래 옅게). 접시는 화면 크기를 지키며
//   카메라에서 능선까지 거리(ufoDepth)에 놓고, 빛기둥은 세상 기준 수직으로 땅 높이까지(조금 땅속으로). 닿은 자리에 빛 웅덩이(drape)·빛 조각. 저사양은 빛기둥만
import * as THREE from 'three';
import { UFO } from '../balance.js';
import { height } from '../world.js';
import { drape } from '../drape.js';
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
  g.visible = false; g.frustumCulled = false; g.traverse((o) => { o.frustumCulled = false; });
  return { g, body, lights };
}

const U = build(); U.g.userData.noCull = true; scene.add(U.g); // 멀리 감추기(farCull)에서 빼기: 카메라 앞을 따라다님

// 빛기둥·웅덩이·빛 조각: 세상 기준(접시처럼 기울지 않음). 높이 1 짜리 원뿔대를 위 끝이 0 에 오게 두고 길이만큼 늘림
const glow = (top, bot, n) => { const c = new Float32Array(n * 3); return { c, set(i, k) { const v = bot + (top - bot) * k; c[i * 3] = 0.62 * v; c[i * 3 + 1] = v; c[i * 3 + 2] = 0.6 * v; } }; };
function buildBeam() {
  const g = new THREE.Group(); g.userData.noCull = true; g.visible = false; g.frustumCulled = false;
  const bg = new THREE.CylinderGeometry(UFO.beam.top, 1, 1, 20, 6, true).translate(0, -0.5, 0), bp = bg.attributes.position, bc = glow(UFO.beam.hi, UFO.beam.lo, bp.count);
  for (let i = 0; i < bp.count; i++) bc.set(i, Math.pow(1 + bp.getY(i), 1.4)); // 위(y=0) 진하게 → 아래(y=-1) 옅게
  bg.setAttribute('color', new THREE.BufferAttribute(bc.c, 3));
  const add = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, vertexColors: true };
  const beam = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ ...add, side: THREE.DoubleSide })); beam.renderOrder = 1; beam.frustumCulled = false; g.add(beam);
  let pool = null, place = null, sparks = null;
  if (!LOW) {
    const pg = new THREE.RingGeometry(0, 1, 28, 4).rotateX(-Math.PI / 2), pp = pg.attributes.position, pc = glow(UFO.pool.hi, 0, pp.count);
    for (let i = 0; i < pp.count; i++) pc.set(i, 1 - Math.hypot(pp.getX(i), pp.getZ(i))); // 가운데 밝고 가장자리 0
    pg.setAttribute('color', new THREE.BufferAttribute(pc.c, 3));
    pool = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ ...add })); pool.renderOrder = 1; pool.frustumCulled = false; g.add(pool);
    place = drape(pool, height, 0.15);
    const n = UFO.sparks, sp = new Float32Array(n * 3);
    sparks = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(sp, 3)), new THREE.PointsMaterial({ color: '#d8ffc8', size: 3, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    sparks.frustumCulled = false; sparks.seed = Array.from({ length: n }, () => [Math.random() * 6.283, Math.random(), 0.4 + Math.random() * 0.6]); g.add(sparks);
  }
  scene.add(g);
  return { g, beam, pool, place, sparks };
}
const B = buildBeam();
// 화면 점(ndcX, ndcY)을 지나는 시선 위에서 접시를 둘 거리: 시선이 땅에 hover 만큼 가까워지는 첫 자리, 못 미치면 땅에 가장 가까운 자리(능선 위)
const ray = new THREE.Vector3(), rp = new THREE.Vector3();
function ufoDepth(nx, ny, hoverK) {
  ray.set(nx, ny, 0.5).unproject(camera).sub(camera.position).normalize();
  const tn = Math.tan(camera.fov * Math.PI / 360), far = Math.min(UFO.reach, camera.far * 0.9);
  let best = UFO.dist, bestC = Infinity;
  for (let d = UFO.near; d < far; d += Math.max(2, d * 0.025)) {
    rp.copy(camera.position).addScaledVector(ray, d);
    const c = rp.y - height(rp.x, rp.z);
    if (c <= hoverK * d * tn) return d; // 시선이 땅에 부딪히기 전: 땅 위 hover 높이
    if (c < bestC) { bestC = c; best = d; }
  }
  return best;
}
let wait = UFO.first, t = -1, dir = 1, y0 = 0.5, done = false, D = 0;
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tilt = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
const introOn = () => !$('intro').hidden && !state.sessionOn;
// 접시가 지나는 높이를 화면 좌표(-1~1)로 (#192): 로고 아랫선보다 조금 아래(오름 능선·정상 위), 로고를 가리지 않게. 로고가 안 보이면(도움말) 화면 위쪽 1/3
function logoY() {
  const el = $('intro-logo'), r = el?.getBoundingClientRect();
  if (!r || !r.height) return 0.35;
  if (r.bottom > innerHeight * 0.5) return 1 - 2 * Math.max(innerHeight * 0.12, r.top - innerHeight * UFO.size * 0.7) / innerHeight; // 폰 가로처럼 로고가 화면 가운데면 로고 위로(아래는 카드)
  return 1 - 2 * (r.bottom + innerHeight * UFO.below) / innerHeight;
}
function end() { done = true; U.g.visible = false; B.g.visible = false; for (const o of [U.g, B.g]) { scene.remove(o); o.traverse((m) => { m.geometry?.dispose(); }); } }
export function tickUfo(dt) {
  if (done) return;
  if (!introOn()) { if (state.sessionOn) end(); else U.g.visible = B.g.visible = false; return; } // 시작을 누르면 사라짐
  if (t < 0) { wait -= dt; if (wait > 0) { U.g.visible = B.g.visible = false; return; } t = 0; D = 0; dir = Math.random() < 0.5 ? 1 : -1; y0 = logoY(); sound.ufo?.(); }
  t += dt; const u = t / UFO.cross;
  if (u >= 1) { t = -1; wait = UFO.gap[0] + Math.random() * (UFO.gap[1] - UFO.gap[0]); U.g.visible = B.g.visible = false; return; }
  // 화면 크기·자리는 화면 비율로 정하고(거리와 무관), 거리 D 는 그 화면 자리 뒤 오름 능선까지 (#192)
  const tn = Math.tan(camera.fov * Math.PI / 360), fh = Math.min(UFO.size, camera.aspect * UFO.sizeW); // 지름 / 화면 높이
  const sm = u * u * (3 - 2 * u) * 0.35 + u * 0.65; // 들어올 때·나갈 때 살짝 느리게
  const ex = 1 + 2 * fh / camera.aspect, nx = dir * (-ex + sm * 2 * ex), ny = y0 + Math.sin(t * 2.6) * fh * 2 * UFO.bob;
  const want = ufoDepth(nx, ny - fh * 0.3, UFO.hover); D = D ? D + (want - D) * Math.min(1, dt * 3) : want; // 처음은 바로, 그 뒤 부드럽게
  const hh = D * tn, hw = hh * camera.aspect, diam = 2 * hh * fh, s = diam / 2, x = nx * hw, y = ny * hh;
  camera.getWorldDirection(fwd); right.set(1, 0, 0).applyQuaternion(camera.quaternion); up.set(0, 1, 0).applyQuaternion(camera.quaternion);
  U.g.position.copy(camera.position).addScaledVector(fwd, D).addScaledVector(right, x).addScaledVector(up, y);
  U.g.quaternion.copy(camera.quaternion); // 화면과 같은 방향으로 세운 뒤 윗면이 조금 보이게 숙이고, 가는 쪽으로 기우뚱
  tilt.setFromAxisAngle(X, 0.32); U.g.quaternion.multiply(tilt);
  tmpQ.setFromAxisAngle(Z, -dir * 0.14 + Math.sin(t * 3.1) * 0.07); U.g.quaternion.multiply(tmpQ);
  U.g.scale.setScalar(s);
  const blink = Math.floor(t * 8);
  for (let i = 0; i < 8; i++) U.lights.setColorAt(i, (i + blink) % 2 ? ON : OFF);
  U.lights.instanceColor.needsUpdate = true;
  U.g.visible = true;
  tickBeam(s, u);
}
// 빛기둥: 접시 바닥에서 바로 아래 땅까지(조금 땅속으로), 아래로 갈수록 살짝 넓게. 들어오고 나갈 때 흐리게
function tickBeam(s, u) {
  const p = U.g.position, top = p.y - s * 0.2, gy = height(p.x, p.z), L = Math.max(0.5, top - gy + UFO.beam.sink);
  const rb = s * UFO.beam.w + L * UFO.beam.spread, fade = Math.min(1, u * 6, (1 - u) * 6), flick = 0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 2.3);
  B.beam.position.set(p.x, top, p.z); B.beam.scale.set(rb, L, rb); B.beam.material.opacity = fade * flick;
  if (B.pool) {
    B.place(p.x, p.z, rb * 1.25); B.pool.material.opacity = fade * (0.8 + 0.2 * Math.sin(t * 5));
    const a = B.sparks.geometry.attributes.position, hgt = Math.min(L * 0.5, rb * 3);
    B.sparks.seed.forEach(([ph, r, sp], i) => { const k = (t * sp * 0.5 + r) % 1, aa = ph + t * sp; a.setXYZ(i, p.x + Math.cos(aa) * rb * (0.25 + 0.6 * r), gy + 0.3 + k * hgt, p.z + Math.sin(aa) * rb * (0.25 + 0.6 * r)); });
    a.needsUpdate = true; B.sparks.material.opacity = fade * 0.85;
  }
  B.g.visible = true; B.ground = { x: +p.x.toFixed(1), y: +gy.toFixed(1), z: +p.z.toFixed(1), L: +L.toFixed(1), D: +D.toFixed(0) };
}
late.tickUfo = tickUfo;
// 확인용 (#150): window.__oreum.ufo() 로 바로 지나가게
late.ufoNow = () => { if (!done) { t = -1; wait = 0; } };
const pv = new THREE.Vector3();
late.ufoInfo = () => ({ on: U.g.visible, t, wait: +wait.toFixed(1), done, x: U.g.visible ? +pv.copy(U.g.position).project(camera).x.toFixed(2) : null, y: U.g.visible ? +pv.copy(U.g.position).project(camera).y.toFixed(2) : null, beam: B.g.visible, ground: B.ground || null, pool: !!B.pool });
