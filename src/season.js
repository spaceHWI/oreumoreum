// 철 이벤트 꾸밈 (#180): 크리스마스 모양만 모음 (게임 연결은 src/game/season.js, 날짜·달력은 src/seasoncal.js)
// 다음 철(설·여름)은 이 파일 옆에 같은 모양 함수를 두고 game/season.js 가 고르면 됨. 수치는 balance.js SEASON
// 모두 로우폴리 툰 재질(toon.js). 많이 놓이는 것(꼬마전구·트리 장식)은 InstancedMesh 하나씩
// - 꼬마전구: 가로등 기둥을 감는 나선 + 가게 처마 줄. 밤에만 켜지고 깜빡임(셰이더, 전구마다 위상)
// - 리스: 가게 문·클린하우스(+ 빨간 리본)
// - 들머리 큰 트리: 세 층 원뿔 + 장식(귤·빨강·금 공)이 단계마다 늘고, 마지막 단계는 꼭대기 귤 별
// - 하르방 산타 모자, 멧돼지 루돌프 코·뿔 머리띠, 산타 투기꾼 차림, 선물 상자, 눈덩이
import * as THREE from 'three';
import { gradHard } from './toon.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SEASON } from './balance.js';
import { santaGeo } from './clothes.js';

const X = SEASON.xmas;
const mats = new Map();
export const toonMat = (c) => { let m = mats.get(c); if (!m) { m = new THREE.MeshToonMaterial({ color: c, gradientMap: gradHard }); mats.set(c, m); } return m; };
const mesh = (g, c, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(g, typeof c === 'string' ? toonMat(c) : c); m.position.set(x, y, z); return m; };
const RED = '#c8333a', WHITE = '#f6f2ea', GREEN = '#2f7a4a', GOLD = '#e8b84a', GYUL = '#f29a2e', DKGREEN = '#24603a';
const BULB_C = ['#ff5a4a', '#ffd25a', '#5ad27a', '#5aa8ff', '#ff9a3c'];

// 여러 조각(툰 재질 색)을 정점 색 한 메시로 굽기 (그리기 1번). root 기준 자리. 빛나는 재질(MeshBasic)은 그대로 둠
const bakedMat = new THREE.MeshToonMaterial({ color: '#ffffff', vertexColors: true, gradientMap: gradHard });
export function bake(root, extra = []) {
  root.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), geos = [], keep = [], m = new THREE.Matrix4();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh) return;
    if (!(o.material?.isMeshToonMaterial)) { keep.push(o); return; }
    const pre = o.material === bakedMat; // 이미 구운 것(정점 색)도 다시 합침
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', ...(pre ? ['color'] : [])].includes(k)) g.deleteAttribute(k);
    g.applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld));
    if (!pre) { const c = o.material.color, n = g.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
    geos.push(g);
  });
  const out = new THREE.Group(); out.position.copy(root.position); out.quaternion.copy(root.quaternion); out.scale.copy(root.scale);
  if (geos.length) { const mm = new THREE.Mesh(mergeGeometries(geos), bakedMat); mm.castShadow = true; out.add(mm); }
  for (const o of [...keep, ...extra]) { o.updateMatrixWorld(true); const k = o; const w = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld); k.removeFromParent(); w.decompose(k.position, k.quaternion, k.scale); out.add(k); }
  return out;
}
// 꼬마전구: 전구 자리 목록 → InstancedMesh 하나. 밤 세기(night 0~1)·시간은 셰이더 값으로
function makeBulbs(points) {
  const n = points.length, geo = new THREE.SphereGeometry(0.1, 6, 4);
  const ph = new Float32Array(n); for (let i = 0; i < n; i++) ph[i] = (i * 2.399) % 6.283;
  geo.setAttribute('aPh', new THREE.InstancedBufferAttribute(ph, 1));
  const U = { uNight: { value: 0 }, uTime: { value: 0 } };
  const mat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    s.vertexShader = 'attribute float aPh;\nvarying float vPh;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPh = aPh;');
    s.fragmentShader = `uniform float uNight; uniform float uTime; varying float vPh;\n` + s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float bl = 0.55 + 0.45 * step(0.0, sin(uTime * ${X.bulbs.blink.toFixed(2)} * 3.0 + vPh * 2.0)) ; // 깜빡임 (전구마다 위상)
      diffuseColor.rgb *= mix(0.42, 1.0 + 0.9 * bl, uNight);`);
  };
  mat.customProgramCacheKey = () => 'xmasbulb';
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, n)); im.count = n;
  const m4 = new THREE.Matrix4(), c = new THREE.Color();
  points.forEach((p, i) => { m4.makeTranslation(p.x, p.y, p.z); im.setMatrixAt(i, m4); im.setColorAt(i, c.set(BULB_C[i % BULB_C.length])); });
  if (n) { im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; }
  im.computeBoundingSphere(); im.frustumCulled = n > 0;
  return { mesh: im, U };
}
// 가로등 기둥을 감는 나선 (기둥 원점 p, 키 h)
export function lampSpiral(p, k, h = 3.0, r = 0.34) { const out = []; for (let i = 0; i < k; i++) { const t = i / Math.max(1, k - 1), a = t * Math.PI * 2 * 3; out.push(new THREE.Vector3(p.x + Math.cos(a) * r, p.y + 0.4 + t * (h - 0.6), p.z + Math.sin(a) * r)); } return out; }
// 두 점 사이 처진 줄 (a, b: Vector3)
export function eaveLine(a, b, k, sag = 0.35) { const out = []; for (let i = 0; i < k; i++) { const t = (i + 0.5) / k; const v = a.clone().lerp(b, t); v.y -= Math.sin(t * Math.PI) * sag; out.push(v); } return out; }

// 리스: 초록 고리 + 귤·빨간 열매 + 아래 리본. 앞(+z)을 봄
export function buildWreath(r = 0.45, ribbon = true) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.TorusGeometry(r, r * 0.28, 6, 14), DKGREEN));
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + 0.3; g.add(mesh(new THREE.SphereGeometry(r * 0.12, 6, 4), i % 2 ? RED : GYUL, Math.cos(a) * r, Math.sin(a) * r, r * 0.2)); }
  if (ribbon) { const bw = new THREE.Group(); bw.position.set(0, -r, r * 0.22); g.add(bw); [-1, 1].forEach((s) => { const l = mesh(new THREE.ConeGeometry(r * 0.22, r * 0.45, 4), RED, s * r * 0.2, 0, 0); l.rotation.z = s * Math.PI / 2; bw.add(l); const t = mesh(new THREE.BoxGeometry(r * 0.1, r * 0.55, r * 0.05), RED, s * r * 0.12, -r * 0.3, 0); t.rotation.z = s * 0.25; bw.add(t); }); bw.add(mesh(new THREE.SphereGeometry(r * 0.1, 6, 4), RED)); }
  return bake(g);
}

// 들머리 큰 트리 (키 약 7m). stages 단계까지 장식 per 개씩, 마지막 단계에 귤 별
export function buildTree({ low = false } = {}) {
  const root = new THREE.Group(), body = new THREE.Group(), st = new THREE.Group(); body.scale.setScalar(1.3); root.add(body);
  st.add(mesh(new THREE.CylinderGeometry(0.28, 0.36, 1.2, 7), '#6b4a2e', 0, 0.6, 0));
  const tiers = [[2.6, 2.6, 1.0], [2.0, 2.3, 2.6], [1.35, 2.0, 4.0]]; // [밑 반지름, 높이, 밑 높이]
  tiers.forEach(([r, h, y]) => st.add(mesh(new THREE.ConeGeometry(r, h, 9), GREEN, 0, y + h / 2, 0)));
  // 눈 살짝 (층 끝)
  tiers.forEach(([r, , y]) => { const s = mesh(new THREE.TorusGeometry(r * 0.92, 0.12, 4, 9), WHITE, 0, y + 0.12, 0); s.rotation.x = Math.PI / 2; s.scale.z = 0.5; st.add(s); });
  const stb = bake(st); stb.children[0].castShadow = !low; body.add(stb); // 줄기·층·눈 테는 한 메시
  // 장식 자리: 층 겉면에 나선으로 (아래에서 위로 차례대로 채움)
  const per = Math.ceil((low ? 48 : 80) / X.tree.stages), total = per * X.tree.stages, spots = [];
  for (let i = 0; i < total; i++) {
    const t = i / total, tier = tiers[Math.min(2, Math.floor(t * 3))], lt = (t * 3) % 1, a = i * 2.399;
    const y = tier[2] + 0.25 + lt * tier[1] * 0.75, r = tier[0] * (1 - (y - tier[2]) / tier[1]) + 0.08;
    spots.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  const om = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: gradHard }), total);
  const m4 = new THREE.Matrix4(), col = new THREE.Color(), OC = [GYUL, RED, GOLD, GYUL, '#4a86c8'];
  spots.forEach((p, i) => { m4.makeTranslation(p.x, p.y, p.z); om.setMatrixAt(i, m4); om.setColorAt(i, col.set(OC[i % OC.length])); });
  om.instanceMatrix.needsUpdate = true; om.instanceColor.needsUpdate = true; om.count = 0; body.add(om);
  // 꼭대기 귤 별
  const shape = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i / 10) * Math.PI * 2, r = i % 2 ? 0.28 : 0.62; if (i) shape.lineTo(Math.cos(a) * r, Math.sin(a) * r); else shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const starG = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: false }); starG.translate(0, 0, -0.09);
  const star = new THREE.Mesh(starG, new THREE.MeshBasicMaterial({ color: '#ffb347' })); star.position.y = 6.95; star.visible = false; body.add(star);
  const leaf = mesh(new THREE.SphereGeometry(0.13, 6, 4), '#3f9a5a', 0.18, 7.55, 0); leaf.scale.set(1.6, 0.6, 0.8); leaf.visible = false; body.add(leaf);
  const glowM = new THREE.MeshBasicMaterial({ color: '#ffb050', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), glowM); halo.position.y = 6.95; halo.visible = false; body.add(halo);
  // 트리 전구 (늘 켬)
  const bp = []; for (let i = 0; i < (low ? 24 : 44); i++) { const t = i / (low ? 24 : 44), a = t * Math.PI * 2 * 5, y = 1.2 + t * 5.4, r = 2.55 * (1 - t * 0.82) + 0.05; bp.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)); }
  const bulbs = makeBulbs(bp); body.add(bulbs.mesh);
  let stage = -1;
  function setStage(n) {
    n = Math.max(0, Math.min(X.tree.stages, n | 0)); if (n === stage) return; stage = n;
    om.count = Math.min(total, n * per); const top = n >= X.tree.stages; star.visible = leaf.visible = halo.visible = top;
  }
  setStage(0);
  return { root, setStage, get stage() { return stage; }, update(dt, time, night) { star.rotation.y = time * 0.8; glowM.opacity = (0.18 + 0.12 * Math.sin(time * 2)) * (0.4 + night * 0.6); bulbs.U.uTime.value = time; bulbs.U.uNight.value = 0.6 + night * 0.4; }, r: 2.7 * 1.3 };
}

// 산타 모자 (하르방·투기꾼). 밑 반지름 r
export function santaHat(r = 0.4) {
  const g = new THREE.Group();
  const rim = mesh(new THREE.TorusGeometry(r, r * 0.22, 6, 16), WHITE); rim.rotation.x = Math.PI / 2; g.add(rim);
  // 몸통: 밑단 수평, 위로 갈수록 뒤로 꺾임 (#198: 고깔째 기울이면 앞이 들려 틈)
  const body = santaGeo(r * 0.99, r * 0.55, r * 1.9); g.add(mesh(body.geo, RED, 0, -r * 0.05, 0));
  g.add(mesh(new THREE.SphereGeometry(r * 0.24, 8, 6), WHITE, 0, body.tip[1] - r * 0.05, body.tip[2]));
  return bake(g);
}
// 멧돼지 루돌프 꾸밈: 머리 뼈(모델 좌표, 키 0.77) 기준 코·뿔 머리띠
export function rudolph() {
  const g = new THREE.Group();
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshToonMaterial({ color: '#ff3a3a', emissive: '#a01010', gradientMap: gradHard })); nose.position.set(0, -0.05, 0.31); g.add(nose);
  const band = mesh(new THREE.TorusGeometry(0.075, 0.008, 4, 12, Math.PI), RED, 0, 0.1, 0.04); g.add(band);
  [-1, 1].forEach((s) => { const a = new THREE.Group(); a.position.set(s * 0.06, 0.16, 0.04); a.rotation.z = -s * 0.4; g.add(a); a.add(mesh(new THREE.CylinderGeometry(0.007, 0.01, 0.09, 5), '#8a5a36', 0, 0.045, 0)); const b = mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.045, 5), '#8a5a36', s * 0.014, 0.06, 0); b.rotation.z = -s * 0.9; a.add(b); });
  return bake(g);
}
// 산타 투기꾼 차림: dumpers.js 걷는 투기꾼(키 2.2) 위에 빨간 외투·흰 털·수염·산타 모자, 봉투는 선물 포장지 색
export function dressSanta(d) {
  const b = d.body;
  b.add(mesh(new THREE.BoxGeometry(0.7, 0.84, 0.46), RED, 0, 1.25, 0)); // 외투
  b.add(mesh(new THREE.BoxGeometry(0.72, 0.1, 0.48), WHITE, 0, 0.86, 0)); // 밑단 털
  b.add(mesh(new THREE.BoxGeometry(0.72, 0.08, 0.48), '#2b2b30', 0, 1.1, 0)); // 허리띠
  const beard = mesh(new THREE.SphereGeometry(0.24, 8, 6), WHITE, 0, 1.72, 0.18); beard.scale.set(1, 1.1, 0.6); b.add(beard);
  b.children.filter((c) => c.geometry?.type === 'CylinderGeometry' || (c.geometry?.type === 'BoxGeometry' && Math.abs(c.position.y - 2.0) < 0.05)).forEach((c) => { c.visible = false; }); // 원래 모자·챙
  const h = santaHat(0.3); h.position.set(0, 2.06, 0); b.add(h);
  d.arms.forEach((a) => a.add(mesh(new THREE.BoxGeometry(0.2, 0.66, 0.22), RED, 0, -0.32, 0)));
  d.bag.children.forEach((c, i) => { c.material = toonMat(i ? GOLD : RED); }); // 선물 포장지 봉투
  const rib = mesh(new THREE.TorusGeometry(0.3, 0.035, 4, 10), GOLD, 0, -0.32, 0); rib.rotation.y = Math.PI / 2; d.bag.add(rib);
  d.santa = true;
}
// 선물 상자 (빨강 + 금 리본)
export function giftBox() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.7, 0.55, 0.7), RED, 0, 0.28, 0));
  g.add(mesh(new THREE.BoxGeometry(0.74, 0.12, 0.74), RED, 0, 0.58, 0));
  g.add(mesh(new THREE.BoxGeometry(0.14, 0.66, 0.76), GOLD, 0, 0.31, 0), mesh(new THREE.BoxGeometry(0.76, 0.66, 0.14), GOLD, 0, 0.31, 0));
  [-1, 1].forEach((s) => { const l = mesh(new THREE.TorusGeometry(0.13, 0.04, 4, 8), GOLD, s * 0.12, 0.72, 0); l.rotation.y = Math.PI / 2; l.rotation.z = s * 0.6; g.add(l); });
  return bake(g);
}
// 눈덩이 재질·부서질 때 가루
export const snowMat = new THREE.MeshToonMaterial({ color: X.snowball.color, gradientMap: gradHard });
export { makeBulbs };
