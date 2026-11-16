// LEAP (#59): 가게 거리 2번 터의 러닝·트레일 러닝 편집숍. 귤로 옷·신발을 삼. 로우폴리 임시 모양 (나중에 Tripo 모델·실제 로고로 바꿈)
// 실제 가게(제주시 서부두길 14): 노출 콘크리트 벽에 굵은 검정 기울임 글자 'LEAP', 바닥부터 천장까지 유리 진열창,
// 안에는 러닝화가 줄지어 놓인 선반 벽과 옷걸이, 밖에 검은 A자 입간판
// 로컬 좌표: +Z = 앞(골목 쪽), 원점 = 건물 가운데 바닥
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gradHard } from './toon.js';
import { LEAP } from './balance.js';

function piece(g, color, jit = 0, seed = 1) {
  g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); g.computeVertexNormals();
  const c = new THREE.Color(color); if (jit) c.multiplyScalar(1 + ((((Math.sin(seed * 12.9898) * 43758.5453) % 1) + 1) % 1 - 0.5) * jit);
  const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

// 간판 그림: 콘크리트 회색 판(거푸집 이음·폼타이 구멍) + 굵은 검정 기울임 'LEAP'
export function drawLeapSign(g, w, h, { ties = true } = {}) {
  g.fillStyle = '#b4b5b1'; g.fillRect(0, 0, w, h);
  let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '40,40,40'},${0.04 + rnd() * 0.05})`; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 6 + rnd() * h * 0.25, 4 + rnd() * h * 0.12, rnd() * 3, 0, Math.PI * 2); g.fill(); }
  if (ties) {
    g.strokeStyle = 'rgba(60,60,60,.18)'; g.lineWidth = Math.max(1, h * 0.012);
    for (let x = w / 3; x < w - 1; x += w / 3) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    g.fillStyle = 'rgba(50,50,50,.35)';
    for (let x = w / 6; x < w; x += w / 3) for (const y of [h * 0.14, h * 0.86]) { g.beginPath(); g.arc(x, y, h * 0.025, 0, Math.PI * 2); g.fill(); }
  }
  g.save(); g.translate(w / 2, h / 2); g.transform(1, 0, -0.22, 1, 0, 0);
  g.fillStyle = '#111214'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 ${Math.round(h * 0.62)}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  g.fillText('LEAP', 0, h * 0.04, w * 0.8);
  g.restore();
}
// 팝업 위 로고 (간판과 같은 그림)
let logoUrl = '';
export function leapLogo() {
  if (logoUrl) return logoUrl;
  const c = document.createElement('canvas'); c.width = 480; c.height = 128; drawLeapSign(c.getContext('2d'), 480, 128, { ties: false });
  return (logoUrl = c.toDataURL('image/png'));
}
function signTexture(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; drawLeapSign(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function createLeap({ scene, height, site, low, col }) {
  const { x, z, rot } = site, W = LEAP.W, D = LEAP.D, H = LEAP.H;
  const fw = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot)), rt = new THREE.Vector3(Math.cos(rot), 0, -Math.sin(rot));
  const wpt = (lx, lz) => [x + rt.x * lx + fw.x * lz, z + rt.z * lx + fw.z * lz];
  let yHi = -1e9, yLo = 1e9;
  for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) { const [px, pz] = wpt(a * W / 2, b < 0 ? -D / 2 : b > 0 ? D / 2 + LEAP.fore : 0); const h = height(px, pz); yHi = Math.max(yHi, h); yLo = Math.min(yLo, h); }
  const y0 = yHi + 0.15;
  const root = new THREE.Group(); root.position.set(x, y0, z); root.rotation.y = rot;
  const shell = [], inner = []; let seed = 3;

  // 받침 + 앞 디딤판
  const plH = y0 - yLo + 0.5;
  shell.push(piece(box(W + 0.3, plH, D + 0.3, 0, -plH / 2 + 0.04, 0), '#5d605f'));
  shell.push(piece(box(W + 0.3, plH, 1.2, 0, -plH / 2, D / 2 + 0.7), '#6c6f6d'));
  // 노출 콘크리트 벽: 큰 판(1.2 × H/3)마다 색 조금씩 + 판 사이 얕은 줄눈
  const CON = '#aeafab', th = 0.32, rows = 3, ph = H / rows;
  const panel = (w, h, d, px, py, pz) => shell.push(piece(box(w, h, d, px, py, pz), CON, 0.07, seed++));
  for (let r = 0; r < rows; r++) {
    const yc = r * ph + ph / 2;
    for (let u = 0; u < W - 0.01; u += 1.2) { const w = Math.min(1.2, W - u); panel(w - 0.03, ph - 0.03, th, -W / 2 + u + w / 2, yc, -D / 2 + th / 2); }
    for (const sd of [-1, 1]) for (let u = 0; u < D - th - 0.01; u += 1.2) { const w = Math.min(1.2, D - th - u); panel(th, ph - 0.03, w - 0.03, sd * (W / 2 - th / 2), yc, -D / 2 + th + u + w / 2); }
  }
  // 앞: 오른쪽 끝 콘크리트 기둥 벽, 그 왼쪽은 바닥부터 처마까지 유리. 위 띠(간판 자리)도 콘크리트
  const band = 0.95, gTop = H - band, pillar = 1.1, fz = D / 2 - th / 2;
  for (let r = 0; r < 3; r++) panel(pillar - 0.03, gTop / 3 - 0.03, th, W / 2 - pillar / 2, r * gTop / 3 + gTop / 6, fz);
  panel(W, band - 0.03, th + 0.06, 0, gTop + band / 2, fz + 0.03);
  // 검은 얇은 창살 (유리 나눔) + 문
  const FRAME = '#17181a', gw = W - pillar, gx0 = -W / 2;
  const doorU = [gw - 1.5, gw - 0.1]; // 문: 유리 오른쪽 끝 (기둥 옆)
  for (const u of [0.05, gw * 0.3, gw * 0.6, doorU[0], doorU[1]]) shell.push(piece(box(0.07, gTop, 0.12, gx0 + u, gTop / 2, fz + 0.02), FRAME));
  shell.push(piece(box(gw, 0.08, 0.14, gx0 + gw / 2, 0.04, fz + 0.02), FRAME), piece(box(gw, 0.07, 0.12, gx0 + gw / 2, gTop - 0.035, fz + 0.02), FRAME));
  shell.push(piece(box(0.04, 0.9, 0.06, gx0 + doorU[0] + 0.2, 1.1, fz + 0.12), '#c8c8c8'));
  // 지붕: 얇은 콘크리트 판 + 검은 갓돌
  const roof = [];
  roof.push(piece(box(W + 0.2, 0.22, D + 0.2, 0, H + 0.11, 0), '#9a9b97'), piece(box(W + 0.26, 0.08, D + 0.26, 0, H + 0.26, 0), '#2a2b2d'));

  // 안: 밝은 콘크리트 바닥, 뒷벽 러닝화 선반(네 단), 왼쪽 옷걸이, 오른쪽 계산대
  inner.push(piece(box(W - th * 2, 0.05, D - th * 2, 0, 0.025, 0), '#cfcfca'));
  const SHOE = ['#ff6a2a', '#f2f2ee', '#2a2b2e', '#3f78c0', '#c7e04a', '#e94a7a', '#7fd3c8', '#f29a2e'];
  const shelfW = W - th * 2 - 0.4, bz = -D / 2 + th + 0.22;
  inner.push(piece(box(shelfW + 0.2, H - 0.3, 0.06, 0, (H - 0.3) / 2 + 0.05, -D / 2 + th + 0.03), '#d9d6ce'));
  for (let k = 0; k < 4; k++) {
    const yy = 0.55 + k * 0.62; inner.push(piece(box(shelfW, 0.04, 0.34, 0, yy, bz), '#e8e6df'));
    for (let i = 0, n = Math.floor(shelfW / 0.42); i < n; i++) {
      const sx = -shelfW / 2 + 0.21 + i * 0.42, c = SHOE[(i * 3 + k * 5) % SHOE.length];
      inner.push(piece(box(0.3, 0.1, 0.16, sx, yy + 0.07, bz + 0.02), c), piece(box(0.12, 0.06, 0.15, sx - 0.06, yy + 0.15, bz + 0.02), c), piece(box(0.31, 0.025, 0.17, sx, yy + 0.03, bz + 0.02), '#f6f5f0'));
    }
  }
  // 옷걸이: 왼쪽 앞쪽(유리 너머 잘 보임) 검은 봉 + 걸린 옷들
  const rx = -W / 2 + th + 1.6, rz = 0.5, rw = 2.2;
  for (const s of [-1, 1]) inner.push(piece(box(0.05, 1.5, 0.05, rx + s * rw / 2, 0.75, rz), FRAME));
  inner.push(piece(box(rw + 0.1, 0.04, 0.04, rx, 1.48, rz), FRAME));
  const TEE = ['#3d4a78', '#f29a2e', '#e8e6df', '#2c2d30', '#3f9a6a', '#9fb4c4', '#c9473d'];
  for (let i = 0; i < 7; i++) { const hx = rx - rw / 2 + 0.2 + i * (rw - 0.4) / 6, c = TEE[i % TEE.length]; inner.push(piece(box(0.06, 0.72, 0.5, hx, 1.06, rz), c, 0.06, i + 20), piece(box(0.03, 0.06, 0.03, hx, 1.45, rz), '#aaaaaa')); }
  // 마네킹 (유리 앞쪽 가운데): 검은 받침 + 몸통에 저지
  const mx = gx0 + gw * 0.5, mz = D / 2 - th - 0.75;
  inner.push(piece(new THREE.CylinderGeometry(0.22, 0.25, 0.05, 10).translate(mx, 0.08, mz), FRAME), piece(box(0.04, 0.85, 0.04, mx, 0.5, mz), FRAME));
  inner.push(piece(box(0.46, 0.6, 0.24, mx, 1.22, mz), '#f29a2e'), piece(box(0.32, 0.18, 0.2, mx, 0.86, mz), '#2a2b2e'), piece(new THREE.SphereGeometry(0.13, 8, 6).translate(mx, 1.68, mz), '#e8e6df'));
  // 계산대
  const cx = W / 2 - th - 1.1, cz = -0.2;
  inner.push(piece(box(1.4, 0.95, 0.6, cx, 0.5, cz), '#2a2b2d'), piece(box(1.5, 0.05, 0.7, cx, 1.0, cz), '#d9d6ce'));
  // 천장 등 줄
  for (const lxp of [-W / 4, W / 4]) inner.push(piece(box(W * 0.35, 0.04, 0.12, lxp, H - 0.08, 0.2), '#fbf7ea'));

  // 밖: 검은 A자 입간판 (문 옆) + 작은 화분
  const ax = W / 2 - pillar - 0.3, az = D / 2 + 1.0;
  const sandwich = [];
  for (const s of [-1, 1]) sandwich.push(piece(box(0.62, 0.95, 0.04, 0, 0.47, 0).rotateX(s * 0.2).translate(0, 0, s * 0.1), '#141517'));
  sandwich.push(piece(box(0.46, 0.14, 0.01, 0, 0.72, 0).rotateX(0.2).translate(0, 0, 0.125), '#f3f3ef'));
  sandwich.push(piece(box(0.38, 0.03, 0.01, 0, 0.5, 0).rotateX(0.2).translate(0, 0, 0.17), '#f3f3ef'), piece(box(0.3, 0.03, 0.01, 0, 0.42, 0).rotateX(0.2).translate(0, 0, 0.185), '#f3f3ef'));
  const asg = mergeGeometries(sandwich); asg.rotateY(-0.35); asg.translate(ax, 0, az); shell.push(asg);
  const potX = -W / 2 + 0.5, potZ = D / 2 + 0.55;
  shell.push(piece(new THREE.CylinderGeometry(0.28, 0.24, 0.55, 8).translate(potX, 0.28, potZ), '#3a3b3d'), piece(new THREE.IcosahedronGeometry(0.42, 0).scale(1, 1.4, 1).translate(potX, 0.95, potZ), '#4f8a4a'));

  const mat = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradHard });
  const shellMesh = new THREE.Mesh(mergeGeometries(shell), mat); shellMesh.castShadow = !low; shellMesh.receiveShadow = !low; root.add(shellMesh);
  const roofMesh = new THREE.Mesh(mergeGeometries(roof), mat); roofMesh.castShadow = !low; root.add(roofMesh);
  const innerMesh = new THREE.Mesh(mergeGeometries(inner), mat); root.add(innerMesh);
  // 유리: 바닥부터 띠 아래까지. 밤엔 안이 따뜻하게 밝음
  const glassMat = new THREE.MeshLambertMaterial({ color: '#a9c8d6', transparent: true, opacity: 0.2, depthWrite: false, emissive: '#ffd98a', emissiveIntensity: 0 });
  const glass = new THREE.Mesh(box(gw - 0.1, gTop - 0.1, 0.03, gx0 + gw / 2, gTop / 2, fz), glassMat); glass.renderOrder = 3; root.add(glass);
  // 간판: 위 콘크리트 띠 가득 (LEAP 검정 기울임)
  const signW = W - 0.2, signH = band - 0.12;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(signW, signH), new THREE.MeshBasicMaterial({ map: signTexture(1024, Math.round(1024 * signH / signW)) }));
  sign.position.set(0, gTop + band / 2, D / 2 + 0.07); root.add(sign);

  scene.add(root); root.updateMatrixWorld(true);
  const toWorld = (a, b, c) => new THREE.Vector3(a, b, c).applyMatrix4(root.matrixWorld);
  if (col) {
    col.addBox(x, z, rot, W / 2 + 0.15, D / 2 + 0.15);
    { const [px, pz] = wpt(ax, az); col.add(px, pz, 0.4); }
    { const [px, pz] = wpt(potX, potZ); col.add(px, pz, 0.35); }
  }
  // 자리: 문 앞(상호작용·옷 입어 보는 곳). 입어 볼 때는 골목 쪽(+Z)을 봄 → 카메라가 골목에서 가게를 등진 캐릭터를 봄
  const doorX = gx0 + (doorU[0] + doorU[1]) / 2;
  const door = toWorld(doorX - 0.6, 0, D / 2 + 1.5); door.y = height(door.x, door.z);
  const front = toWorld(0, 0, D / 2 + LEAP.fore); front.y = height(front.x, front.z);
  const signPos = toWorld(0, H + 0.4, D / 2);
  const center = toWorld(0, 0, 0);

  let night = 0;
  function update(dt, n) { night = n; glassMat.emissiveIntensity = n * 0.55; glassMat.opacity = 0.2 + n * 0.2; }
  return { root, center, front, door, face: rot, signPos, update, y0, get night() { return night; } };
}
