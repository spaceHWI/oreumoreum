// 숙소 오피스제주 O-Peace (#270): 가게 거리 7번 터의 2층 워케이션 호텔. 새 모델 파일 없이 코드로 만든 로우폴리 임시 모양 (실제 로고·사진은 쓰지 않음, 간판 글자만)
// 1층은 유리 너머 공유오피스(책상·노트북 불빛), 2층은 객실 창 여섯 칸(밤엔 몇 칸만 불), 평평한 지붕. 앞마당에 야외 업무 책상(수사 보드 자리)·화분
// 로컬 좌표: +Z = 앞(골목 쪽), 원점 = 터 앞 가운데 바닥. 그리는 수는 가게 하나 수준: 몸체 1 + 유리 1 + 불빛 1 + 간판 1 (밤엔 빛웅덩이·전등 더함)
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gradHard } from './toon.js';
import { INN } from './balance.js';
import { glowSprite } from './propmodel.js';

const M4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
function piece(g, color, m) {
  g = g.index ? g.toNonIndexed() : g; if (g.attributes.uv) g.deleteAttribute('uv'); if (m) g.applyMatrix4(m); g.computeVertexNormals();
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
const box = (w, h, d, c, m) => piece(new THREE.BoxGeometry(w, h, d), c, m);

// 간판: 흰 판에 짙은 글자 '오피스제주 O-Peace' + 작은 줄 (실제 로고 대신 글자만)
function signTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 160; const g = c.getContext('2d');
  g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, 1024, 160);
  g.fillStyle = '#23303a'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '800 74px "Gothic A1", "Noto Sans KR", sans-serif'; g.fillText(INN.name, 512, 66, 960);
  g.fillStyle = '#6a7680'; g.font = '600 26px "Gothic A1", "Noto Sans KR", sans-serif'; g.fillText(INN.tag, 512, 128, 900);
  g.fillStyle = '#ff8a1f'; g.fillRect(0, 150, 1024, 10);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function createInn({ scene, height, site, low = false, col = null }) {
  const { W, D, H1, H2, fore } = INN;
  const fw = new THREE.Vector3(Math.sin(site.rot), 0, Math.cos(site.rot)), rt = new THREE.Vector3(Math.cos(site.rot), 0, -Math.sin(site.rot));
  const wpt = (lx, lz) => [site.x + rt.x * lx + fw.x * lz, site.z + rt.z * lx + fw.z * lz];
  const zF = -fore, zB = -fore - D, zC = -fore - D / 2, H = H1 + H2; // 앞벽·뒷벽·가운데 (로컬 z), 처마 높이
  let yHi = -1e9, yLo = 1e9; for (const a of [-1, -0.5, 0, 0.5, 1]) for (const b of [0, zF, zC, zB]) { const [px, pz] = wpt(a * W / 2, b); const h = height(px, pz); yHi = Math.max(yHi, h); yLo = Math.min(yLo, h); }
  const y0 = yHi + 0.15;
  const root = new THREE.Group(); root.position.set(site.x, y0, site.z); root.rotation.y = site.rot; scene.add(root);
  const WALL = '#efece6', WALL2 = '#dcd8cf', CON = '#9a9c98', DARK = '#2f3a42', WD = '#a57a4c', P = [];
  // 받침(현무암 판석 마당): 비탈에서 뜨지 않게, 앞마당까지
  const plH = y0 - yLo + 0.5;
  P.push(box(W + 1.4, plH, D + fore + 0.4, '#3b4044', M4(0, 0.02 - plH / 2, -(D + fore) / 2)));
  P.push(box(W + 1.2, 0.05, fore - 0.2, '#8d8f8a', M4(0, 0.03, -fore / 2))); // 앞마당 판석
  for (let i = -5; i <= 5; i++) P.push(box(0.03, 0.06, fore - 0.3, '#6f716d', M4(i * (W + 1) / 11, 0.035, -fore / 2))); // 판석 줄눈
  // 1층: 비어 있는 상자(뒷벽·옆벽·바닥·천장), 앞은 유리. 안에 책상·노트북
  P.push(box(W, 0.12, D, '#b8b2a6', M4(0, 0.06, zC))); // 바닥
  P.push(box(W, H1, 0.24, WALL, M4(0, H1 / 2, zB + 0.12))); // 뒷벽
  for (const s of [-1, 1]) P.push(box(0.3, H1, D, WALL, M4(s * (W / 2 - 0.15), H1 / 2, zC))); // 옆벽
  P.push(box(W + 0.5, 0.34, D + 0.5, CON, M4(0, H1 + 0.02, zC + 0.1))); // 2층 바닥 판 (앞으로 조금 나온 처마)
  // 1층 앞 유리틀: 세로 살 여섯·가로 띠, 가운데 문
  for (let i = 0; i <= 6; i++) { const x = -W / 2 + 0.3 + i * (W - 0.6) / 6; P.push(box(0.12, H1 - 0.1, 0.14, DARK, M4(x, H1 / 2, zF - 0.05))); }
  P.push(box(W - 0.4, 0.12, 0.14, DARK, M4(0, 0.2, zF - 0.05)), box(W - 0.4, 0.1, 0.14, DARK, M4(0, H1 - 0.12, zF - 0.05)));
  // 안: 공유오피스 책상 셋(가로로 긴 책상, 노트북 둘씩)·의자, 안쪽 벽 책장
  const desks = [[-3.6, zC + 0.6], [0, zC - 1.4], [3.6, zC + 0.6]], laptops = [];
  for (const [dx, dz] of desks) {
    P.push(box(2.6, 0.06, 0.9, '#c9a77a', M4(dx, 0.76, dz)));
    for (const a of [-1, 1]) P.push(box(0.06, 0.74, 0.8, '#3a3e42', M4(dx + a * 1.2, 0.38, dz)));
    for (const a of [-0.65, 0.65]) {
      P.push(box(0.42, 0.03, 0.3, '#5b6066', M4(dx + a, 0.8, dz + 0.05))); // 노트북 바닥
      P.push(box(0.42, 0.3, 0.03, '#4a4f55', M4(dx + a, 0.95, dz - 0.12, -0.25))); // 노트북 화면 뒤판
      laptops.push([dx + a, 0.95, dz - 0.1]);
      P.push(box(0.46, 0.08, 0.44, '#44494f', M4(dx + a, 0.48, dz + 0.75)), box(0.44, 0.48, 0.07, '#44494f', M4(dx + a, 0.76, dz + 0.98))); // 의자
    }
  }
  for (let i = 0; i < 4; i++) { const x = -W / 2 + 1.6 + i * (W - 3.2) / 3; P.push(box(1.6, 1.9, 0.36, WD, M4(x, 0.95 + 0.06, zB + 0.42))); for (let k = 1; k < 4; k++) P.push(box(1.5, 0.04, 0.3, '#7a5a38', M4(x, 0.06 + k * 0.5, zB + 0.45))); }
  // 2층: 꽉 찬 상자 + 앞면 객실 창 여섯(틀·작은 난간), 지붕 판·난간벽
  P.push(box(W, H2, D, WALL, M4(0, H1 + H2 / 2 + 0.15, zC)));
  P.push(box(W + 0.3, 0.26, D + 0.3, CON, M4(0, H + 0.28, zC))); // 지붕 판
  P.push(box(W + 0.3, 0.5, 0.16, WALL2, M4(0, H + 0.6, zF + 0.07)), box(W + 0.3, 0.5, 0.16, WALL2, M4(0, H + 0.6, zB - 0.07)));
  for (const s of [-1, 1]) P.push(box(0.16, 0.5, D + 0.3, WALL2, M4(s * (W / 2 + 0.07), H + 0.6, zC)));
  P.push(box(2.2, 1.2, 1.8, WALL2, M4(W / 2 - 2.2, H + 0.95, zB + 1.4))); // 옥상 계단실
  const winX = (i) => -W / 2 + 1.25 + i * (W - 2.5) / 5, winY = H1 + 0.25 + H2 / 2, ww = 1.3, wh = 1.5;
  for (let i = 0; i < 6; i++) {
    const x = winX(i);
    P.push(box(ww + 0.2, wh + 0.2, 0.08, DARK, M4(x, winY, zF + 0.02)));
    P.push(box(ww + 0.3, 0.06, 0.5, '#5d6870', M4(x, winY - wh / 2 - 0.1, zF + 0.25)), box(ww + 0.3, 0.05, 0.05, '#5d6870', M4(x, winY - wh / 2 + 0.38, zF + 0.48))); // 작은 난간
    for (const a of [-1, 0, 1]) P.push(box(0.04, 0.48, 0.04, '#5d6870', M4(x + a * (ww / 2 + 0.1), winY - wh / 2 + 0.14, zF + 0.48)));
  }
  // 문 위 차양 + 기둥 둘
  P.push(box(3.2, 0.12, 1.6, DARK, M4(0, H1 - 0.35, zF + 0.8)));
  for (const s of [-1, 1]) P.push(box(0.1, H1 - 0.4, 0.1, DARK, M4(s * 1.5, (H1 - 0.4) / 2, zF + 1.5)));
  // 앞마당: 야외 업무 책상(수사 보드를 여는 '로비 책상'), 화분 둘, 벤치
  const dk = [-W / 2 + 2.0, -fore + 1.3];
  P.push(box(1.6, 0.06, 0.7, '#c9a77a', M4(dk[0], 1.02, dk[1])), box(0.1, 1.0, 0.1, '#3a3e42', M4(dk[0] - 0.7, 0.5, dk[1])), box(0.1, 1.0, 0.1, '#3a3e42', M4(dk[0] + 0.7, 0.5, dk[1])));
  P.push(box(0.4, 0.03, 0.3, '#5b6066', M4(dk[0] + 0.3, 1.06, dk[1] + 0.05)), box(0.4, 0.28, 0.03, '#4a4f55', M4(dk[0] + 0.3, 1.2, dk[1] - 0.1, -0.25)));
  P.push(box(0.9, 0.6, 0.04, '#b98a5a', M4(dk[0] - 0.35, 1.38, dk[1] - 0.3, -0.2))); // 작은 코르크판 (수사 보드)
  for (const s of [-1, 1]) { const x = s * (W / 2 - 0.4); P.push(box(0.7, 0.6, 0.7, '#4b5054', M4(x, 0.3, -0.7)), piece(new THREE.IcosahedronGeometry(0.55, 0), '#5f8f4a', M4(x, 0.95, -0.7, 0, s, 0, 1, 1.2, 1))); }
  P.push(box(1.8, 0.08, 0.5, WD, M4(W / 2 - 2.6, 0.45, -fore + 0.6)), box(0.08, 0.45, 0.4, '#3a3e42', M4(W / 2 - 3.3, 0.22, -fore + 0.6)), box(0.08, 0.45, 0.4, '#3a3e42', M4(W / 2 - 1.9, 0.22, -fore + 0.6)));
  const mat = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradHard });
  const body = new THREE.Mesh(mergeGeometries(P), mat); body.castShadow = !low; body.receiveShadow = !low; root.add(body);
  // 유리 (1층 앞 한 장 + 2층 창): 반투명, 1층은 안이 보임
  const glassMat = new THREE.MeshBasicMaterial({ color: '#8fb3c4', transparent: true, opacity: 0.28, depthWrite: false });
  const G = [new THREE.PlaneGeometry(W - 0.5, H1 - 0.3).translate(0, H1 / 2, zF - 0.02)];
  const glass = new THREE.Mesh(mergeGeometries(G), glassMat); glass.renderOrder = 1; root.add(glass);
  const room = new THREE.Mesh(mergeGeometries(Array.from({ length: 6 }, (_, i) => box(ww, wh, 0.04, '#3c4a55', M4(winX(i), winY, zF + 0.07)))), new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradHard }));
  root.add(room);
  // 불빛 (노트북 화면 + 불 켜진 객실 창): 한 장의 재질, 밤에 밝아짐. 낮에도 화면은 은은히
  const L = [];
  for (const [x, y, z] of laptops) L.push(new THREE.PlaneGeometry(0.36, 0.24).rotateX(-0.25).translate(x, y, z));
  L.push(new THREE.PlaneGeometry(0.34, 0.22).rotateX(-0.25).translate(dk[0] + 0.3, 1.2, dk[1] - 0.08));
  const nScreen = L.length;
  for (const i of INN.litRooms) L.push(new THREE.PlaneGeometry(ww - 0.1, wh - 0.1).translate(winX(i), winY, zF + 0.1));
  const lightGeo = mergeGeometries(L.map((g) => g.index ? g.toNonIndexed() : g));
  { const n = lightGeo.attributes.position.count, a = new Float32Array(n * 3), per = 6; for (let v = 0; v < n; v++) { const k = Math.floor(v / per), c = new THREE.Color(k < nScreen ? '#9fd4ff' : '#ffcf86'); a[v * 3] = c.r; a[v * 3 + 1] = c.g; a[v * 3 + 2] = c.b; } lightGeo.setAttribute('color', new THREE.BufferAttribute(a, 3)); }
  const lightMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55 });
  const lights = new THREE.Mesh(lightGeo, lightMat); root.add(lights);
  const roomLit = lightGeo.attributes.position.count / 6 - nScreen; // 객실 창 수 (낮엔 끔)
  lightGeo.setDrawRange(0, nScreen * 6);
  // 간판: 2층 바닥 판 앞면, 문 위
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.0), new THREE.MeshBasicMaterial({ map: signTexture() }));
  sign.position.set(0, H1 + 0.02, zF + 0.4); root.add(sign);
  // 밤: 문 위 전등 둘 + 앞마당 빛웅덩이 (광원은 더하지 않음)
  const bulbs = [-1, 1].map((s) => { const sp = glowSprite('#ffd79a', 0.6); sp.position.set(s * 1.3, H1 - 0.5, zF + 1.4); root.add(sp); return sp; });
  const poolTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(255,215,150,1)'); gr.addColorStop(0.5, 'rgba(255,200,130,0.4)'); gr.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(W + 2, fore + 3).rotateX(-Math.PI / 2), poolMat); pool.position.set(0, 0.07, -fore / 2); pool.renderOrder = 2; root.add(pool);
  root.updateMatrixWorld(true);
  const toWorld = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyMatrix4(root.matrixWorld);

  // 충돌: 건물·차양 기둥·화분·야외 책상·벤치
  if (col) {
    { const [cx, cz] = wpt(0, zC); col.addBox(cx, cz, site.rot, W / 2 + 0.1, D / 2 + 0.1); }
    for (const s of [-1, 1]) { const [px, pz] = wpt(s * 1.5, zF + 1.5); col.add(px, pz, 0.2); }
    for (const s of [-1, 1]) { const [px, pz] = wpt(s * (W / 2 - 0.4), -0.7); col.add(px, pz, 0.5); }
    { const [px, pz] = wpt(dk[0], dk[1]); col.addBox(px, pz, site.rot, 0.85, 0.4); }
  }
  const door = toWorld(0, 0.05, -fore / 2 + 0.3); // 상호작용 자리: 앞마당 가운데
  const inside = toWorld(0, 0.05, zF - 1.0); // 묵는 동안 서 있는 자리(문 안쪽, 남에게는 안 보임)
  const desk = toWorld(dk[0], 0.05, dk[1] + 0.9); // 야외 업무 책상 앞 ('수사 보드')
  const wait = toWorld(W / 2 - 1.2, 0.05, -0.6); // 노루가 기다리는 자리 (앞마당 오른쪽 끝)
  const center = toWorld(0, 0, zC);
  const signPos = toWorld(0, H + 1.0, zC);
  let lit = -1;
  function update(dt, night) {
    const on = night > 0.01 ? 1 : 0;
    if (on !== lit) { lit = on; pool.visible = !!on; for (const b of bulbs) b.visible = !!on; lightGeo.setDrawRange(0, (nScreen + (on ? roomLit : 0)) * 6); }
    lightMat.opacity = 0.5 + 0.5 * night;
    if (!on) return;
    for (const b of bulbs) b.material.opacity = night;
    poolMat.opacity = night * 0.45;
  }
  return { root, center, door, inside, desk, wait, signPos, update, y0, rot: site.rot };
}
