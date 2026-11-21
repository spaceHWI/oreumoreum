// 만족한상회 (#167): 가게 거리 골목 끝 터의 갈치 식당. 새 모델 파일 없이 코드로 만든 로우폴리 임시 모양 (실제 가게 로고·사진은 쓰지 않음, 간판 글자만)
// 낮은 제주 돌집(현무암 벽)에 파란 함석 지붕, 처마에 말리는 갈치, 앞마당에 평상 둘. 수치는 balance.js MANJOK
// 로컬 좌표: +Z = 앞(골목 쪽), 원점 = 터 앞 가운데 바닥. 반환은 스톤(stone.js)과 같은 꼴이라 식당 공통 틀(game/stores.js)이 그대로 씀
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gradHard } from './toon.js';
import { MANJOK } from './balance.js';
import { glowSprite } from './propmodel.js';

// 지붕 간판·가장자리 표시 아이콘 (24×24 선 그림): 숟가락과 젓가락
export const SPOON = '<path d="M8 3c-2 0-3 2-3 4.5S6.5 12 8 12s3-2 3-4.5S10 3 8 3zM8 12v9M15 3l1 18M19 3l-1 18"/>';

const M4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
function piece(g, color, m) {
  g = g.index ? g.toNonIndexed() : g; if (g.attributes.uv) g.deleteAttribute('uv'); if (m) g.applyMatrix4(m); g.computeVertexNormals();
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
const box = (w, h, d, c, m) => piece(new THREE.BoxGeometry(w, h, d), c, m);

// 간판: 나무판에 붓글씨풍 '만족한상회'
function signTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#e9dcc0'; g.fillRect(0, 0, 512, 128); g.strokeStyle = '#5a3a22'; g.lineWidth = 10; g.strokeRect(5, 5, 502, 118);
  g.fillStyle = '#2a1d14'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 78px "Nanum Brush Script", "Gungsuh", "Batang", "Noto Serif KR", serif';
  g.save(); g.translate(256, 66); g.transform(1, 0, -0.12, 1, 0, 0); g.fillText(MANJOK.name, 0, 0, 470); g.restore();
  g.fillStyle = '#c8452c'; g.fillRect(452, 82, 34, 34); g.fillStyle = '#e9dcc0'; g.font = '700 20px serif'; g.fillText('印', 469, 100); // 낙관 (붉은 도장)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function createManjok({ scene, height, site, low = false, col = null, addWalkable = null }) {
  const { W, D, H, fore } = MANJOK;
  const fw = new THREE.Vector3(Math.sin(site.rot), 0, Math.cos(site.rot)), rt = new THREE.Vector3(Math.cos(site.rot), 0, -Math.sin(site.rot));
  const wpt = (lx, lz) => [site.x + rt.x * lx + fw.x * lz, site.z + rt.z * lx + fw.z * lz];
  const zH = -fore - D / 2; // 집 가운데 (로컬 z)
  let yHi = -1e9, yLo = 1e9; for (const a of [-1, 0, 1]) for (const b of [0, -fore, -fore - D]) { const [px, pz] = wpt(a * W / 2, b); const h = height(px, pz); yHi = Math.max(yHi, h); yLo = Math.min(yLo, h); }
  const y0 = yHi + 0.15;
  const root = new THREE.Group(); root.position.set(site.x, y0, site.z); root.rotation.y = site.rot; scene.add(root);
  const BS = ['#43474b', '#4d5155', '#3a3e42', '#565a5e'], TIN = '#3f6f9a', TIN2 = '#335d84', WD = '#8a6440', WD2 = '#a57a4c';
  const P = [];
  // 받침(현무암 마당): 비탈에서 뜨지 않게, 집과 평상 마당까지
  const plH = y0 - yLo + 0.5;
  P.push(box(W + 1.2, plH, D + fore + 0.4, '#3b4044', M4(0, 0.02 - plH / 2, -(D + fore) / 2)));
  P.push(box(W + 1.0, 0.05, fore - 0.2, '#8f8a7c', M4(0, 0.03, -fore / 2))); // 마당 흙
  // 돌 벽: 바탕 상자 + 앞면에 울퉁불퉁한 돌 몇 개
  P.push(box(W, H, D, BS[0], M4(0, H / 2, zH)));
  for (let i = 0; i < 26; i++) { const r = (i * 0.618) % 1, q = (i * 0.371) % 1, x = (r - 0.5) * (W - 0.4), y = 0.2 + q * (H - 0.4);
    if (Math.abs(x) < 0.7 && y < 2.0) continue; // 문 자리
    if (Math.abs(Math.abs(x) - 2.0) < 0.55 && y > 0.9 && y < 1.8) continue; // 창 자리
    P.push(piece(new THREE.DodecahedronGeometry(0.22 + q * 0.08, 0), BS[i % 4], M4(x, y, zH + D / 2 + 0.02, i, i * 2, 0, 1.2, 0.8, 0.35))); }
  // 문(나무 미닫이)·창(나무 살)
  P.push(box(1.2, 1.95, 0.08, WD, M4(0, 0.98, zH + D / 2 + 0.03)), box(0.06, 1.95, 0.1, '#5a3a22', M4(0, 0.98, zH + D / 2 + 0.06)));
  for (const s of [-1, 1]) { P.push(box(1.0, 0.85, 0.06, '#f1e6cc', M4(s * 2.0, 1.35, zH + D / 2 + 0.03))); for (const k of [-1, 0, 1]) P.push(box(0.04, 0.85, 0.08, WD, M4(s * 2.0 + k * 0.33, 1.35, zH + D / 2 + 0.06))); P.push(box(1.0, 0.04, 0.08, WD, M4(s * 2.0, 1.35, zH + D / 2 + 0.06))); }
  // 파란 함석 지붕: 앞뒤로 기운 두 판 + 골 줄 + 용마루
  const rise = 0.9, half = D / 2 + 0.7, slope = Math.atan2(rise, half), len = Math.hypot(rise, half) + 0.1;
  for (const s of [-1, 1]) {
    P.push(box(W + 0.9, 0.1, len, s > 0 ? TIN : TIN2, M4(0, H + rise / 2, zH + s * half / 2, s * slope)));
    for (let k = -6; k <= 6; k++) P.push(box(0.05, 0.05, len, s > 0 ? TIN2 : '#2b4d70', M4(k * (W + 0.8) / 13, H + rise / 2 + 0.07, zH + s * half / 2, s * slope)));
  }
  P.push(box(W + 1.0, 0.16, 0.24, '#2b4d70', M4(0, H + rise + 0.03, zH)));
  // 처마 받침 기둥 + 빨랫줄에 말리는 갈치
  const eZ = zH + D / 2 + 0.55;
  for (const s of [-1, 1]) P.push(box(0.14, H + 0.1, 0.14, WD, M4(s * (W / 2 + 0.25), (H + 0.1) / 2, eZ)));
  P.push(box(W + 0.4, 0.03, 0.03, '#d6d0c2', M4(0, H - 0.25, eZ)));
  for (let i = 0; i < 9; i++) { const x = -W / 2 + 0.4 + i * (W - 0.8) / 8; if (Math.abs(x) < 1.75) continue; // 가운데는 간판 자리
    P.push(piece(new THREE.ConeGeometry(0.1, 1.2, 4), '#e4e9ee', M4(x, H - 0.88, eZ, 0, 0.5, Math.PI, 1, 1, 0.3))); // 은빛 몸 (머리가 위, 꼬리로 가늘게)
    P.push(box(0.05, 0.1, 0.04, '#9aa3aa', M4(x, H - 0.24, eZ))); }
  // 평상 둘 (나무, 다리 넷) + 그 위 작은 상
  const bedY = 0.45, beds = [[-1.7, -1.55], [1.7, -1.55]], bedW = 2.0, bedD = 1.3;
  for (const [bx, bz] of beds) {
    P.push(box(bedW, 0.1, bedD, WD2, M4(bx, bedY - 0.05, bz)));
    for (let k = -3; k <= 3; k++) P.push(box(0.02, 0.012, bedD - 0.05, '#7a5a38', M4(bx + k * bedW / 7, bedY + 0.006, bz)));
    for (const a of [-1, 1]) for (const b of [-1, 1]) P.push(box(0.1, bedY - 0.1, 0.1, '#6b4a2a', M4(bx + a * (bedW / 2 - 0.1), (bedY - 0.1) / 2, bz + b * (bedD / 2 - 0.1))));
    P.push(box(0.7, 0.05, 0.5, '#5a3a22', M4(bx + 0.2, bedY + 0.25, bz)));
    for (const a of [-1, 1]) for (const b of [-1, 1]) P.push(box(0.04, 0.22, 0.04, '#5a3a22', M4(bx + 0.2 + a * 0.3, bedY + 0.11, bz + b * 0.2)));
  }
  // 물 항아리 (옹기)
  P.push(piece(new THREE.SphereGeometry(0.38, 8, 6), '#6b4630', M4(W / 2 + 0.2, 0.36, -fore + 0.3, 0, 0, 0, 1, 1.1, 1)));
  const mat = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradHard });
  const P2 = [];
  const body = new THREE.Mesh(mergeGeometries(P), mat); body.castShadow = !low; body.receiveShadow = !low; root.add(body);
  // 간판 (처마 밑, 문 위)
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: signTexture() }));
  sign.position.set(0, H - 0.5, eZ + 0.08); root.add(sign);
  P2.push(box(3.36, 0.94, 0.06, '#5a3a22', M4(0, H - 0.5, eZ + 0.03))); // 간판 테두리 나무
  P2.push(box(0.04, 0.3, 0.04, '#3a2a1e', M4(-1.3, H - 0.1, eZ + 0.03)), box(0.04, 0.3, 0.04, '#3a2a1e', M4(1.3, H - 0.1, eZ + 0.03))); // 매단 끈
  // 밤: 창·문 창호지가 따뜻하게 빛남, 처마 백열등 둘
  const winMat = new THREE.MeshBasicMaterial({ color: '#ffb85a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  root.add(new THREE.Mesh(mergeGeometries([-1, 1].map((s) => new THREE.PlaneGeometry(1.0, 0.85).translate(s * 2.0, 1.35, zH + D / 2 + 0.1)).concat([new THREE.PlaneGeometry(1.1, 1.8).translate(0, 0.98, zH + D / 2 + 0.1)])), winMat));
  const bulbs = [-1, 1].map((s) => { const sp = glowSprite('#ffcf7a', 0.7); sp.position.set(s * 1.5, H - 0.1, eZ - 0.1); root.add(sp); return sp; });
  // 밤 빛웅덩이 (광원은 더하지 않음: 점광원 하나가 모든 재질의 그리기 값을 늘림)
  const poolTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(255,210,140,1)'); gr.addColorStop(0.5, 'rgba(255,195,120,0.4)'); gr.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(W + 2, fore + 2).rotateX(-Math.PI / 2), poolMat); pool.position.set(0, 0.06, -fore / 2); pool.renderOrder = 2; root.add(pool);
  { const m2 = new THREE.Mesh(mergeGeometries(P2), mat); m2.castShadow = !low; root.add(m2); }
  root.updateMatrixWorld(true);
  const toWorld = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyMatrix4(root.matrixWorld);

  // 충돌: 집은 막고, 평상은 올라섬(앉는 자리). 기둥·항아리
  if (col) {
    { const [cx, cz] = wpt(0, zH); col.addBox(cx, cz, site.rot, W / 2 + 0.1, D / 2 + 0.1); }
    for (const s of [-1, 1]) { const [px, pz] = wpt(s * (W / 2 + 0.25), eZ); col.add(px, pz, 0.25); }
    { const [px, pz] = wpt(W / 2 + 0.2, -fore + 0.3); col.add(px, pz, 0.45); }
  }
  if (addWalkable) for (const [bx, bz] of beds) { const [cx, cz] = wpt(bx, bz); addWalkable(cx, cz, site.rot, bedW / 2, bedD / 2, y0 + bedY); }

  // 자리: 왼쪽 평상 바깥쪽 끝에 앉아 상을 봄
  const [bx, bz] = beds[0], tableL = [bx + 0.2, bz], seatL = [bx - 0.6, bz + 0.1];
  const seat = toWorld(seatL[0], bedY, seatL[1]);
  const seatGo = toWorld(seatL[0] - 0.2, 0.05, seatL[1] + bedD / 2 + 0.5); // 평상 앞에서 올라앉음
  const table = toWorld(tableL[0], bedY + 0.28, tableL[1]);
  const terrace = toWorld(0, 0.05, -fore / 2);
  const center = toWorld(0, 0, zH);
  const signPos = toWorld(0, H + rise + 0.5, zH);
  const seatHeading = site.rot + Math.atan2(tableL[0] - seatL[0], tableL[1] - seatL[1]);

  // 상 위 음식: 접시 + 음식 덩이 (먹으면 줄어듦)
  const plate = new THREE.Group(); plate.visible = false; scene.add(plate);
  const plateMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.04, 10), new THREE.MeshToonMaterial({ color: '#3a3330', gradientMap: gradHard }));
  const foodMat = new THREE.MeshToonMaterial({ color: '#c8452c', gradientMap: gradHard });
  const food = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 1).scale(1.4, 0.4, 0.6), foodMat); food.position.y = 0.05;
  plate.add(plateMesh, food);
  plate.position.copy(table); plate.position.y += 0.02; plate.rotation.y = seatHeading;
  function serve(item) { plate.visible = !!item; if (!item) return; foodMat.color.set(item.food); setLeft(1); }
  function setLeft(k) { food.scale.setScalar(Math.max(0.05, k)); }

  function update(dt, night) {
    winMat.opacity = night * 0.7; for (const b of bulbs) b.material.opacity = night;
    poolMat.opacity = night * 0.45;
  }
  return { root, center, terrace, seat, seatGo, seatHeading, table, signPos, update, serve, setLeft, y0 };
}
