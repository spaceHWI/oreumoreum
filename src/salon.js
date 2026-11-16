// 루이네 미장원 (#58): 가게 거리 1번 터의 작은 동네 미장원. 로우폴리 임시 모양 (나중에 Tripo 모델·실제 로고로 바꿈)
// 실제 가게(서귀포 법환로 11): 밝은 회색 돌 타일 벽의 네모난 단층, 입구 위 흰 간판에 빨강·파랑 사선 줄무늬 테두리, 어두운 틀의 넓은 유리창,
// 벽에 삼색 회전 기둥, 문 앞에 빨강·흰·파랑 드럼통 둘, 안은 따뜻한 나무 선반과 거울
// 로컬 좌표: +Z = 앞(골목 쪽), 원점 = 건물 가운데 바닥. 의자는 큰 창 안쪽에서 뒷벽 거울을 봄 → 밖에서 창 너머로 머리 깎는 모습이 보임
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gradHard } from './toon.js';
import { SALON } from './balance.js';

function piece(g, color, jit = 0, seed = 1) {
  g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); g.computeVertexNormals();
  const c = new THREE.Color(color); if (jit) c.multiplyScalar(1 + ((((Math.sin(seed * 12.9898) * 43758.5453) % 1) + 1) % 1 - 0.5) * jit);
  const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

// 간판 그림: 흰 판 + 항공 우편 봉투 같은 빨강·파랑 사선 줄무늬 테두리 + '루이네 미장원'
export function drawSalonSign(g, w, h) {
  const b = Math.round(h * 0.13);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  g.save(); g.beginPath(); g.rect(0, 0, w, h); g.rect(b, b, w - b * 2, h - b * 2); g.clip('evenodd');
  const st = b * 1.6; for (let x = -h, i = 0; x < w + h; x += st, i++) { g.fillStyle = ['#d23a32', '#ffffff', '#2c5aa8', '#ffffff'][i % 4]; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + st, 0); g.lineTo(x + st - h, h); g.lineTo(x - h, h); g.closePath(); g.fill(); }
  g.restore();
  g.fillStyle = '#1f2b4a'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `800 ${Math.round(h * 0.48)}px "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`; g.fillText('루이네 미장원', w / 2, h / 2 + h * 0.03, w - b * 4);
}
// 팝업 위 로고 (간판 모양)
let logoUrl = '';
export function salonLogo() {
  if (logoUrl) return logoUrl;
  const c = document.createElement('canvas'); c.width = 480; c.height = 128; drawSalonSign(c.getContext('2d'), 480, 128);
  return (logoUrl = c.toDataURL('image/png'));
}
function signTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 144; drawSalonSign(c.getContext('2d'), 1024, 144);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// 삼색 기둥 무늬: 빨강·흰·파랑 사선 (offset 을 움직여 돌아가 보이게)
function poleTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 128);
  const cols = ['#d23a32', '#ffffff', '#2c5aa8', '#ffffff'];
  for (let i = -4; i < 12; i++) { g.fillStyle = cols[((i % 4) + 4) % 4]; g.beginPath(); g.moveTo(0, i * 16); g.lineTo(64, i * 16 - 32); g.lineTo(64, i * 16 - 16); g.lineTo(0, i * 16 + 16); g.closePath(); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 2); return t;
}

export function createSalon({ scene, height, site, low, col }) {
  const { x, z, rot } = site, W = SALON.W, D = SALON.D, H = SALON.H;
  const fw = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot)), rt = new THREE.Vector3(Math.cos(rot), 0, -Math.sin(rot));
  const wpt = (lx, lz) => [x + rt.x * lx + fw.x * lz, z + rt.z * lx + fw.z * lz];
  // 바닥 높이: 건물과 앞마당 귀퉁이 중 가장 높은 곳 + 조금
  let yHi = -1e9, yLo = 1e9;
  for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) { const [px, pz] = wpt(a * W / 2, b < 0 ? -D / 2 : b > 0 ? D / 2 + SALON.fore : 0); const h = height(px, pz); yHi = Math.max(yHi, h); yLo = Math.min(yLo, h); }
  const y0 = yHi + 0.15;
  const root = new THREE.Group(); root.position.set(x, y0, z); root.rotation.y = rot;
  const shell = [], inner = []; let seed = 1;

  // 받침(현무암 밑단) + 앞 계단참
  const plH = y0 - yLo + 0.5;
  shell.push(piece(box(W + 0.3, plH, D + 0.3, 0, -plH / 2 + 0.04, 0), '#3b4044'));
  shell.push(piece(box(W + 0.3, plH, 1.3, 0, -plH / 2 + 0.0, D / 2 + 0.75), '#4b5054'));
  // 벽: 밝은 회색 돌 타일 (줄마다 엇갈림, 색 조금씩)
  const TILE = ['#c9cbc7', '#bfc2be', '#d2d3cf', '#c4c6c2'];
  const th = 0.3;
  function wall(len, place, holes = []) { // place(u, y, w, hh)
    const rows = Math.round(H / 0.45), rh = H / rows;
    for (let r = 0; r < rows; r++) {
      let u = (r % 2) * -0.3;
      while (u < len) {
        const w = 0.6, u0 = Math.max(0, u), u1 = Math.min(len, u + w), yc = r * rh + rh / 2; u += w;
        if (u1 - u0 < 0.08) continue;
        const cut = holes.find((o) => yc > o.y0 && yc < o.y1 && u1 > o.u0 && u0 < o.u1);
        if (cut) { if (u0 < cut.u0) place(u0, yc, cut.u0 - u0, rh); if (u1 > cut.u1) place(cut.u1, yc, u1 - cut.u1, rh); continue; }
        place(u0, yc, u1 - u0, rh);
      }
    }
  }
  const tile = (geo) => shell.push(piece(geo, TILE[(seed++) % 4], 0.05, seed));
  wall(W, (u, y, w, hh) => tile(box(w - 0.025, hh - 0.025, th, -W / 2 + u + w / 2, y, -D / 2 + th / 2)));
  const side = [{ u0: 1.6, u1: 3.4, y0: 1.2, y1: 2.3 }];
  for (const s of [-1, 1]) wall(D - th * 2, (u, y, w, hh) => tile(box(th, hh - 0.025, w - 0.025, s * (W / 2 - th / 2), y, -D / 2 + th + u + w / 2)), side);
  // 앞벽: 넓은 창(왼쪽) + 기둥 자리 + 유리문(오른쪽)
  const win = { u0: 0.35, u1: 4.35, y0: 0.4, y1: 2.6 }, door = { u0: 4.95, u1: 6.35, y0: -1, y1: 2.55 };
  wall(W, (u, y, w, hh) => tile(box(w - 0.025, hh - 0.025, th, -W / 2 + u + w / 2, y, D / 2 - th / 2)), [win, door]);
  const lx = (u) => -W / 2 + u;
  // 어두운 창틀·문틀
  const FRAME = '#262a2e', fz = D / 2 - 0.05;
  { const cx = lx((win.u0 + win.u1) / 2), w = win.u1 - win.u0, hh = win.y1 - win.y0, cy = (win.y0 + win.y1) / 2;
    shell.push(piece(box(w + 0.14, 0.12, 0.42, cx, win.y0, fz - 0.1), FRAME), piece(box(w + 0.14, 0.12, 0.36, cx, win.y1, fz - 0.1), FRAME));
    for (const u of [win.u0, win.u0 + w / 2, win.u1]) shell.push(piece(box(0.1, hh, 0.36, lx(u), cy, fz - 0.1), FRAME)); }
  { const cx = lx((door.u0 + door.u1) / 2), w = door.u1 - door.u0;
    shell.push(piece(box(w + 0.14, 0.12, 0.36, cx, door.y1, fz - 0.1), FRAME));
    for (const u of [door.u0, door.u1]) shell.push(piece(box(0.1, door.y1, 0.36, lx(u), door.y1 / 2, fz - 0.1), FRAME));
    shell.push(piece(box(w - 0.1, 0.1, 0.08, cx, 1.05, fz - 0.06), FRAME), piece(box(0.05, 0.5, 0.06, cx + w / 2 - 0.25, 1.15, fz + 0.02), '#c8c8c8')); }
  for (const s of [-1, 1]) { const zc = -D / 2 + th + (side[0].u0 + side[0].u1) / 2; shell.push(piece(box(0.38, 0.1, side[0].u1 - side[0].u0 + 0.1, s * (W / 2 - th / 2), side[0].y0, zc), FRAME), piece(box(0.38, 0.1, side[0].u1 - side[0].u0 + 0.1, s * (W / 2 - th / 2), side[0].y1, zc), FRAME)); }
  // 문 앞 드럼통 둘: 빨강·흰·파랑 띠
  const drums = [lx(4.3) - 0.75, lx(door.u1) + 0.25].map((dx) => [Math.min(W / 2 - 0.2, dx), D / 2 + 0.75]);
  for (const [dx, dz] of drums) {
    ['#d23a32', '#f2f0ea', '#2c5aa8'].forEach((c, i) => shell.push(piece(new THREE.CylinderGeometry(0.3, 0.3, 0.3, 12).translate(dx, 0.15 + i * 0.3, dz), c)));
    for (const yy of [0.02, 0.45, 0.9]) shell.push(piece(new THREE.CylinderGeometry(0.315, 0.315, 0.04, 12).translate(dx, yy, dz), '#3b3f44'));
  }
  // 평지붕 (안에 들어가면 감춤)
  const roof = [];
  roof.push(piece(box(W + 0.5, 0.28, D + 0.5, 0, H + 0.14, 0), '#8f938f'));
  roof.push(piece(box(W + 0.56, 0.12, D + 0.56, 0, H + 0.3, 0), '#e9e9e5'));
  roof.push(piece(box(W - 0.6, 0.06, D - 0.6, 0, H + 0.35, 0), '#6f7370'));

  // 안: 나무 바닥·뒷벽 나무 판·선반·거울·의자·카운터 (그림자 안 받게 따로 = 지붕 그늘로 어둡지 않게)
  const WOOD = ['#b07a48', '#a36f40', '#bc8752'];
  for (let i = 0; i < 9; i++) { const pw = (W - th * 2) / 9; inner.push(piece(box(pw - 0.03, 0.06, D - th * 2, -W / 2 + th + pw * (i + 0.5), 0.03, 0), WOOD[i % 3], 0.08, i + 2)); }
  inner.push(piece(box(W - th * 2, H - 0.1, 0.05, 0, H / 2, -D / 2 + th + 0.03), '#c99a68'));
  const chairX = lx((win.u0 + win.u1) / 2), chairZ = D / 2 - 1.95;
  // 거울 (의자 앞) + 나무 틀 + 아래 카운터
  inner.push(piece(box(1.3, 1.25, 0.06, chairX, 1.55, -D / 2 + th + 0.08), '#5c3b22'));
  const mirror = box(1.12, 1.07, 0.02, chairX, 1.55, -D / 2 + th + 0.12);
  inner.push(piece(box(1.8, 0.08, 0.5, chairX, 0.86, -D / 2 + th + 0.28), '#8a5a36'), piece(box(1.7, 0.8, 0.44, chairX, 0.44, -D / 2 + th + 0.26), '#6b4a32'));
  // 선반: 거울 양옆 세 단, 병·수건
  const BOT = ['#e9e3d6', '#2c5aa8', '#d23a32', '#f2c14a', '#7fb65a'];
  for (const sx of [chairX - 1.6, chairX + 1.6]) for (let k = 0; k < 3; k++) {
    const yy = 0.95 + k * 0.6; inner.push(piece(box(1.1, 0.06, 0.32, sx, yy, -D / 2 + th + 0.19), '#7a5232'));
    for (let b = 0; b < 4; b++) { const bx = sx - 0.38 + b * 0.25, c = BOT[(b + k * 2 + (sx > chairX ? 1 : 0)) % 5]; inner.push(piece(new THREE.CylinderGeometry(0.05, 0.06, 0.18 + (b % 2) * 0.08, 6).translate(bx, yy + 0.12 + (b % 2) * 0.04, -D / 2 + th + 0.2), c)); }
  }
  // 오른쪽 안: 기다리는 의자 + 화분
  inner.push(piece(box(0.5, 0.08, 1.4, W / 2 - th - 0.35, 0.45, -0.3), '#8a5a36'), piece(box(0.4, 0.42, 1.3, W / 2 - th - 0.35, 0.22, -0.3), '#5c3b22'));
  inner.push(piece(new THREE.CylinderGeometry(0.2, 0.16, 0.36, 8).translate(W / 2 - th - 0.4, 0.18, D / 2 - th - 0.45), '#4b5054'), piece(new THREE.IcosahedronGeometry(0.34, 0).scale(1, 1.3, 1).translate(W / 2 - th - 0.4, 0.7, D / 2 - th - 0.45), '#4f9a4a'));
  // 미용 의자: 기둥 받침 + 빨간 좌석·등받이(창 쪽)·팔걸이·발판. 앉으면 거울(-Z)을 봄
  inner.push(piece(new THREE.CylinderGeometry(0.3, 0.34, 0.06, 12).translate(chairX, 0.07, chairZ), '#9a9da0'), piece(new THREE.CylinderGeometry(0.07, 0.09, 0.32, 8).translate(chairX, 0.24, chairZ), '#b9bcbf'));
  inner.push(piece(box(0.58, 0.14, 0.52, chairX, 0.46, chairZ), '#8e2b2b'));
  inner.push(piece(box(0.56, 0.62, 0.12, chairX, 0.84, chairZ + 0.28), '#8e2b2b'), piece(box(0.3, 0.16, 0.1, chairX, 1.25, chairZ + 0.3), '#8e2b2b'));
  for (const s of [-1, 1]) inner.push(piece(box(0.08, 0.06, 0.46, chairX + s * 0.3, 0.68, chairZ), '#3b3f44'), piece(box(0.05, 0.18, 0.05, chairX + s * 0.3, 0.58, chairZ - 0.18), '#b9bcbf'));
  inner.push(piece(box(0.46, 0.04, 0.2, chairX, 0.16, chairZ - 0.62), '#b9bcbf'), piece(box(0.04, 0.3, 0.04, chairX, 0.27, chairZ - 0.45).rotateX(0.5), '#b9bcbf'));
  // 천장 등 (밤에 빛남은 유리로)
  inner.push(piece(box(1.2, 0.05, 0.2, chairX, H - 0.06, chairZ - 0.4), '#f6f1e2'));

  const mat = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradHard });
  const shellMesh = new THREE.Mesh(mergeGeometries(shell), mat); shellMesh.castShadow = !low; shellMesh.receiveShadow = !low; root.add(shellMesh);
  const roofMesh = new THREE.Mesh(mergeGeometries(roof), mat); roofMesh.castShadow = !low; roofMesh.receiveShadow = !low; root.add(roofMesh);
  const innerMesh = new THREE.Mesh(mergeGeometries(inner), mat); root.add(innerMesh);
  const mirrorMat = new THREE.MeshLambertMaterial({ color: '#cfe2ea', emissive: '#9fbccb', emissiveIntensity: 0.35 });
  root.add(new THREE.Mesh(mirror, mirrorMat));
  // 유리: 창·문은 비침, 옆창은 어둡게. 밤엔 따뜻하게
  const glassMat = new THREE.MeshLambertMaterial({ color: '#9fc4d6', transparent: true, opacity: 0.22, depthWrite: false, emissive: '#ffc46a', emissiveIntensity: 0 });
  const gl = [box(win.u1 - win.u0, win.y1 - win.y0, 0.03, lx((win.u0 + win.u1) / 2), (win.y0 + win.y1) / 2, fz - 0.1), box(door.u1 - door.u0 - 0.1, door.y1 - 0.06, 0.03, lx((door.u0 + door.u1) / 2), door.y1 / 2, fz - 0.1)];
  const glass = new THREE.Mesh(mergeGeometries(gl), glassMat); glass.renderOrder = 3; root.add(glass);
  const sideMat = new THREE.MeshLambertMaterial({ color: '#2a3a44', emissive: '#ffc46a', emissiveIntensity: 0 });
  const sg = []; for (const s of [-1, 1]) sg.push(box(0.04, side[0].y1 - side[0].y0, side[0].u1 - side[0].u0, s * (W / 2 - th / 2), (side[0].y0 + side[0].y1) / 2, -D / 2 + th + (side[0].u0 + side[0].u1) / 2));
  root.add(new THREE.Mesh(mergeGeometries(sg), sideMat));
  // 간판: 창·문 위 앞벽 가득
  const signW = W - 0.5, signY = (door.y1 + H) / 2 + 0.05, signH = Math.min(0.78, H - door.y1 - 0.2);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(signW, signH), new THREE.MeshBasicMaterial({ map: signTexture() }));
  sign.position.set(0, signY, D / 2 + 0.06); root.add(sign);
  const signBack = new THREE.Mesh(piece(box(signW + 0.1, signH + 0.1, 0.08, 0, signY, D / 2 + 0.01), '#f4f4f2'), mat); root.add(signBack);
  // 삼색 회전 기둥: 창과 문 사이 벽
  const poleTex = poleTexture(), poleX = lx((win.u1 + door.u0) / 2), poleZ = D / 2 + 0.2;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.85, 12, 1, true), new THREE.MeshBasicMaterial({ map: poleTex }));
  pole.position.set(poleX, 1.75, poleZ); root.add(pole);
  const capMat = new THREE.MeshToonMaterial({ color: '#e8e9ea', gradientMap: gradHard });
  const caps = mergeGeometries([new THREE.CylinderGeometry(0.13, 0.13, 0.08, 12).translate(0, 0.46, 0), new THREE.SphereGeometry(0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.5, 0), new THREE.CylinderGeometry(0.13, 0.11, 0.12, 12).translate(0, -0.48, 0),
    box(0.04, 0.04, 0.22, 0, 0.42, -0.12), box(0.04, 0.04, 0.22, 0, -0.42, -0.12)].map((g) => (g.index ? g.toNonIndexed() : g)));
  const capMesh = new THREE.Mesh(caps, capMat); capMesh.position.copy(pole.position); root.add(capMesh);

  scene.add(root); root.updateMatrixWorld(true);
  const toWorld = (a, b, c) => new THREE.Vector3(a, b, c).applyMatrix4(root.matrixWorld);

  // 충돌: 건물 상자, 드럼통, 기둥
  if (col) {
    col.addBox(x, z, rot, W / 2 + 0.15, D / 2 + 0.15);
    for (const [dx, dz] of drums) { const [px, pz] = wpt(dx, dz); col.add(px, pz, 0.36); }
  }

  // 자리: 의자(거울을 봄), 문 앞(상호작용·걸어갈 곳·다 깎고 나오는 곳)
  const seat = toWorld(chairX, 0.12, chairZ + 0.04);
  const doorX = lx((door.u0 + door.u1) / 2), doorOut = toWorld(doorX, 0, D / 2 + 1.25); doorOut.y = height(doorOut.x, doorOut.z);
  const front = toWorld(0, 0, D / 2 + SALON.fore); front.y = height(front.x, front.z);
  const signPos = toWorld(0, H + 0.4, D / 2);
  const seatHeading = rot + Math.PI; // 거울(-Z) 쪽
  const center = toWorld(0, 0, 0);

  // 가위질 연출: 머리 둘레를 도는 가위 + 떨어지는 머리카락
  const fx = new THREE.Group(); fx.visible = false; scene.add(fx);
  const metal = new THREE.MeshToonMaterial({ color: '#d8dde2', gradientMap: gradHard }), handle = new THREE.MeshToonMaterial({ color: '#ff8a1f', gradientMap: gradHard });
  const blade = () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.2).translate(0, 0, 0.1), metal); const r = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 4, 8).rotateX(Math.PI / 2).translate(0, 0, -0.05), handle); g.add(b, r); return g; };
  const scissors = new THREE.Group(), bA = blade(), bB = blade(); scissors.add(bA, bB); fx.add(scissors);
  const bits = [], bitMat = new THREE.MeshBasicMaterial({ color: '#2b2724' }), bitGeo = new THREE.BoxGeometry(0.06, 0.012, 0.012);
  for (let i = 0; i < (low ? 10 : 22); i++) { const m = new THREE.Mesh(bitGeo, bitMat); m.visible = false; fx.add(m); bits.push({ m, v: new THREE.Vector3(), life: 0 }); }
  let fxT = 0, lastSnip = -1, head = new THREE.Vector3();
  const cut = {
    start(at) { head.copy(at); fx.visible = true; fxT = 0; lastSnip = -1; bits.forEach((b) => { b.life = 0; b.m.visible = false; }); },
    stop() { fx.visible = false; },
    // 반환: 이번 프레임에 가위질했으면 true (소리)
    update(dt) {
      if (!fx.visible) return false;
      fxT += dt;
      const a = fxT * 1.6, rr = 0.36;
      scissors.position.set(head.x + Math.sin(a) * rr, head.y + 0.05 + Math.sin(fxT * 2.3) * 0.08, head.z + Math.cos(a) * rr);
      scissors.lookAt(head.x, head.y + 0.02, head.z);
      const ph = (fxT * SALON.snipHz) % 1, open = ph < 0.6 ? 0.42 * (ph / 0.6) : 0.42 * (1 - (ph - 0.6) / 0.4);
      bA.rotation.y = open; bB.rotation.y = -open;
      const k = Math.floor(fxT * SALON.snipHz); let snip = false;
      if (k !== lastSnip) { lastSnip = k; snip = true;
        for (let n = 0; n < 3; n++) { const b = bits.find((q) => q.life <= 0); if (!b) break; b.life = 1.2; b.m.visible = true; b.m.position.copy(scissors.position); b.m.rotation.set(Math.random() * 3, Math.random() * 3, 0); b.v.set((Math.random() - 0.5) * 0.6, Math.random() * 0.3, (Math.random() - 0.5) * 0.6); } }
      for (const b of bits) { if (b.life <= 0) continue; b.life -= dt; b.v.y -= 2.2 * dt; b.m.position.addScaledVector(b.v, dt); b.m.rotation.x += dt * 4; if (b.m.position.y < seat.y - 0.05) { b.m.position.y = seat.y - 0.05; b.v.set(0, 0, 0); } if (b.life <= 0) b.m.visible = false; }
      return snip;
    },
  };

  let night = 0;
  function update(dt, n) {
    night = n; poleTex.offset.y = (poleTex.offset.y + dt * 0.45) % 1;
    glassMat.emissiveIntensity = n * 0.5; glassMat.opacity = 0.22 + n * 0.18; sideMat.emissiveIntensity = n * 0.9;
  }
  // 안에 들어가 앉았을 때 지붕을 감춰 위에서 보이게
  const inside = (on) => { roofMesh.visible = !on; };
  return { root, center, front, door: doorOut, seat, seatHeading, signPos, update, inside, cut, y0, get night() { return night; } };
}
