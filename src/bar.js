// Bar 소설 (#316): 가게 거리 8번 터의 책 읽는 바. 새 모델 파일 없이 코드로 만든 로우폴리 임시 모양 (실제 로고·사진은 쓰지 않음, 이름 글자만)
// 겉: 어두운 색 작은 단층, 짙은 남색 둥근 간판에 흰 명조풍 '소설'. 앞은 큰 유리창 둘 + 문, 안으로 따뜻한 등불·책장이 비침(밤에 더 밝음)
// 안: 벽 가득 책장(책은 무늬·색만), 긴 나무 바·높은 의자 둘, 병이 늘어선 뒤 선반, 촛불 잔, 책 세워 두는 받침
// 앞 툇마루에 작은 입간판: 닫힌 때(낮) '저녁에 열어요', 연 때는 감춤. 간판 옆 작은 등은 밤에만
// 로컬 좌표: +Z = 앞(골목 쪽), 원점 = 터 앞 가운데 바닥. 그리는 수: 몸체 1 + 유리 1 + 불빛 1 + 간판 1 + 입간판 1 (밤엔 등·빛웅덩이 더함)
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gradHard } from './toon.js';
import { BAR } from './balance.js';
import { glowSprite } from './propmodel.js';

const M4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
function piece(g, color, m) {
  g = g.index ? g.toNonIndexed() : g; if (g.attributes.uv) g.deleteAttribute('uv'); if (m) g.applyMatrix4(m); g.computeVertexNormals();
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
const box = (w, h, d, c, m) => piece(new THREE.BoxGeometry(w, h, d), c, m);
const cyl = (rt, rb, h, c, m, seg = 7) => piece(new THREE.CylinderGeometry(rt, rb, h, seg), c, m);
// 책등 색 (무늬·색만, 제목 없음)
const SPINE = ['#7a3b34', '#2f4f6e', '#b08d4a', '#3f6a4f', '#6b4f7a', '#c9b48a', '#8a5a3a', '#405060', '#a0473c', '#d8cfb8'];
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// 둥근 간판: 짙은 남색 판에 흰 명조풍 '소설' (글자만)
const SIGN_FONT = '"Noto Serif KR", "Nanum Myeongjo", "Batang", serif';
function signTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#1d2a4a'; g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fill();
  g.lineWidth = 6; g.strokeStyle = '#e9e4d6'; g.beginPath(); g.arc(128, 128, 108, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#f6f2e8'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 92px ${SIGN_FONT}`; g.fillText(BAR.short, 128, 134, 200);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// 입간판 글: '저녁에 열어요'
function boardTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 320; const g = c.getContext('2d');
  g.fillStyle = '#23272e'; g.fillRect(0, 0, 256, 320); g.strokeStyle = '#8a6a44'; g.lineWidth = 14; g.strokeRect(7, 7, 242, 306);
  g.fillStyle = '#f3ecdc'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `700 50px ${SIGN_FONT}`; g.fillText('저녁에', 128, 120, 220); g.fillText('열어요', 128, 186, 220);
  g.fillStyle = '#ffcf7a'; g.beginPath(); g.arc(128, 262, 16, 0, Math.PI * 2); g.fill(); g.fillStyle = '#23272e'; g.beginPath(); g.arc(136, 256, 14, 0, Math.PI * 2); g.fill(); // 초승달
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// 가게 창 위 칸 로고 (stores.js SHOP_POP bar): 둥근 간판과 같은 모양
export const barLogo = () => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96"><circle cx="48" cy="48" r="47" fill="#1d2a4a"/><circle cx="48" cy="48" r="40" fill="none" stroke="#e9e4d6" stroke-width="2.4"/><text x="48" y="50" text-anchor="middle" dominant-baseline="middle" font-family='${SIGN_FONT}' font-weight="700" font-size="34" fill="#f6f2e8">${BAR.short}</text></svg>`);

export function createBar({ scene, height, site, low = false, col = null }) {
  const { W, D, H, fore } = BAR;
  const fw = new THREE.Vector3(Math.sin(site.rot), 0, Math.cos(site.rot)), rt = new THREE.Vector3(Math.cos(site.rot), 0, -Math.sin(site.rot));
  const wpt = (lx, lz) => [site.x + rt.x * lx + fw.x * lz, site.z + rt.z * lx + fw.z * lz];
  const zF = -fore, zB = -fore - D, zC = -fore - D / 2;
  let yHi = -1e9, yLo = 1e9; for (const a of [-1, -0.5, 0, 0.5, 1]) for (const b of [0, zF, zC, zB]) { const [px, pz] = wpt(a * W / 2, b); const h = height(px, pz); yHi = Math.max(yHi, h); yLo = Math.min(yLo, h); }
  const y0 = yHi + 0.15;
  const root = new THREE.Group(); root.position.set(site.x, y0, site.z); root.rotation.y = site.rot; scene.add(root);
  const WALL = '#2c3138', WALL2 = '#23272d', TRIM = '#6b4a2e', WD = '#8a5e36', WD2 = '#5c3d22', IN = '#3a2f28', P = [];
  // 받침(현무암) + 툇마루(나무 판)
  const plH = y0 - yLo + 0.5;
  P.push(box(W + 0.8, plH, D + fore + 0.3, '#3b4044', M4(0, 0.02 - plH / 2, -(D + fore) / 2)));
  P.push(box(W + 0.6, 0.08, fore - 0.1, WD2, M4(0, 0.05, -fore / 2)));
  for (let i = -6; i <= 6; i++) P.push(box(0.03, 0.09, fore - 0.15, '#4a3220', M4(i * (W + 0.4) / 13, 0.055, -fore / 2))); // 툇마루 판 줄
  // 빈 상자: 바닥·뒷벽·옆벽·천장, 앞벽은 창 둘 + 문 자리만 남김
  P.push(box(W, 0.12, D, '#4a3a2c', M4(0, 0.06, zC))); // 나무 바닥
  P.push(box(W, H, 0.24, WALL, M4(0, H / 2, zB + 0.12))); // 뒷벽
  for (const s of [-1, 1]) P.push(box(0.26, H, D, WALL, M4(s * (W / 2 - 0.13), H / 2, zC))); // 옆벽
  P.push(box(W + 0.6, 0.26, D + 0.7, WALL2, M4(0, H + 0.13, zC + 0.2))); // 지붕 판 (앞으로 조금 나온 처마)
  P.push(box(W + 0.6, 0.38, 0.12, TRIM, M4(0, H + 0.08, zF + 0.55))); // 처마 앞 나무 띠
  // 앞벽: 아래 띠·위 띠·창 사이 기둥, 가운데 문(짙은 나무 + 작은 창)
  const winW = (W - 1.6) / 2 - 0.35, winH = 1.75, winY = 0.75 + winH / 2, doorW = 1.1;
  P.push(box(W, 0.75, 0.2, WALL, M4(0, 0.375, zF - 0.1)), box(W, H - 0.75 - winH, 0.2, WALL, M4(0, 0.75 + winH + (H - 0.75 - winH) / 2, zF - 0.1)));
  for (const x of [-W / 2 + 0.2, -doorW / 2 - 0.12, doorW / 2 + 0.12, W / 2 - 0.2]) P.push(box(0.4 + (Math.abs(x) < 1 ? -0.16 : 0), winH, 0.2, WALL, M4(x, winY, zF - 0.1)));
  P.push(box(doorW, 0.75, 0.22, WALL, M4(0, 0.375, zF - 0.1))); // 문 아래는 벽 (문은 위에 덧댐)
  P.push(box(doorW, 2.25, 0.1, WD2, M4(0, 1.125 + 0.06, zF + 0.02)), box(0.5, 0.6, 0.02, '#d9b26a', M4(0, 1.75, zF + 0.08)), box(0.06, 0.06, 0.12, '#c9a24a', M4(0.4, 1.1, zF + 0.1))); // 문·작은 창·손잡이
  for (const s of [-1, 1]) { const x = s * (doorW / 2 + 0.35 + winW / 2); P.push(box(winW + 0.16, 0.1, 0.3, TRIM, M4(x, 0.75, zF + 0.02)), box(winW + 0.16, 0.08, 0.24, TRIM, M4(x, 0.75 + winH, zF)), box(0.06, winH, 0.16, TRIM, M4(x, winY, zF))); } // 창틀·가운데 살
  // 안: 옆벽·뒷벽 왼쪽 책장(책 색 띠)
  const shelf = (cx, cz, ry, w, h) => {
    const rot = (x, z) => [cx + Math.cos(ry) * x + Math.sin(ry) * z, cz - Math.sin(ry) * x + Math.cos(ry) * z];
    P.push(box(w, h, 0.36, WD, M4(cx, h / 2 + 0.12, cz, 0, ry)));
    const rows = Math.floor(h / 0.42);
    for (let r = 0; r < rows; r++) {
      const y = 0.2 + r * 0.42; let x = -w / 2 + 0.06;
      { const [px, pz] = rot(0, 0.05); P.push(box(w - 0.04, 0.035, 0.32, WD2, M4(px, y + 0.12, pz, 0, ry))); }
      while (x < w / 2 - 0.12) { const bw = 0.05 + rnd() * 0.07, bh = 0.24 + rnd() * 0.12, [px, pz] = rot(x + bw / 2, 0.08); P.push(box(bw, bh, 0.22, SPINE[Math.floor(rnd() * SPINE.length)], M4(px, y + 0.14 + bh / 2, pz, 0, ry, rnd() < 0.08 ? 0.25 : 0))); x += bw + 0.012; }
    }
  };
  for (const s of [-1, 1]) shelf(s * (W / 2 - 0.45), zC + 0.25, s * -Math.PI / 2, D - 1.1, H - 0.45);
  shelf(-W / 2 + 1.6, zB + 0.42, 0, 2.2, H - 0.45);
  // 긴 나무 바(가운데·뒤쪽), 바 뒤 선반에 병, 바 위 촛불 잔·책 받침
  const barZ = zB + 1.75, barX = 1.3, barW = 3.2; // 바는 오른쪽 창 뒤 (앉은 사람이 창 밖에서 보이게)
  P.push(box(barW, 1.0, 0.5, WD2, M4(barX, 0.5 + 0.12, barZ)), box(barW + 0.2, 0.08, 0.68, '#a8774a', M4(barX, 1.14, barZ + 0.04)));
  for (const k of [0, 1, 2]) { P.push(box(2.3, 0.04, 0.26, WD, M4(barX + 0.55, 1.25 + k * 0.48, zB + 0.38))); for (let i = 0; i < 8; i++) { const c = ['#7aa56a', '#c08a3e', '#5a3a2a', '#d8c79a', '#4a6a5a'][(i + k) % 5], x = barX + 0.55 - 1.0 + i * 0.285, h = 0.22 + ((i * 7 + k * 3) % 4) * 0.03; P.push(cyl(0.05, 0.06, h, c, M4(x, 1.27 + k * 0.48 + h / 2, zB + 0.38)), cyl(0.018, 0.022, 0.08, c, M4(x, 1.27 + k * 0.48 + h + 0.04, zB + 0.38))); } }
  P.push(box(0.36, 0.04, 0.2, '#6b4a2e', M4(barX - 1.2, 1.2, barZ + 0.1)), box(0.32, 0.4, 0.03, '#c9b48a', M4(barX - 1.2, 1.4, barZ + 0.05, -0.25)), box(0.3, 0.38, 0.02, '#e9e1cc', M4(barX - 1.2, 1.4, barZ + 0.07, -0.25))); // 책 세워 두는 받침
  const candles = [[barX - 0.45, barZ + 0.12], [barX + 1.3, barZ + 0.08]];
  for (const [x, z] of candles) P.push(cyl(0.07, 0.06, 0.1, '#c9a24a', M4(x, 1.23, z)), cyl(0.035, 0.035, 0.07, '#efe6cf', M4(x, 1.3, z)));
  // 높은 의자 둘 (앉는 자리)
  const seatX = [barX - 0.1, barX + 0.95], seatZ = barZ + 0.78; // 둘 다 오른쪽 창(0.9~3.45) 뒤
  for (const x of seatX) P.push(cyl(0.24, 0.24, 0.08, '#3a2a20', M4(x, 0.78, seatZ), 9), cyl(0.04, 0.05, 0.66, '#2a2a2e', M4(x, 0.42, seatZ)), cyl(0.2, 0.22, 0.04, '#2a2a2e', M4(x, 0.14, seatZ), 9));
  // 펜던트 등 줄 셋 (천장)
  const pend = [[-1.6, zC + 0.6], [barX - 0.1, barZ + 0.3], [barX + 1.05, barZ + 0.3]];
  for (const [x, z] of pend) P.push(box(0.02, 0.7, 0.02, '#1a1a1a', M4(x, H - 0.35, z)), cyl(0.06, 0.2, 0.16, '#2b2b2b', M4(x, H - 0.78, z)));
  // 창가 작은 화분·우산꽂이 (밖)
  P.push(box(0.5, 0.5, 0.5, '#3f4448', M4(-W / 2 + 0.5, 0.33, -0.6)), piece(new THREE.IcosahedronGeometry(0.42, 0), '#4f7f42', M4(-W / 2 + 0.5, 0.85, -0.6, 0, 0.6, 0, 1, 1.2, 1)));
  const mat = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradHard });
  const body = new THREE.Mesh(mergeGeometries(P), mat); body.castShadow = !low; body.receiveShadow = !low; root.add(body);
  // 유리 (창 둘 + 문 작은 창은 몸체): 반투명, 안이 보임
  const glassMat = new THREE.MeshBasicMaterial({ color: '#9db3bd', transparent: true, opacity: 0.22, depthWrite: false });
  const G = [-1, 1].map((s) => new THREE.PlaneGeometry(winW, winH).translate(s * (doorW / 2 + 0.35 + winW / 2), winY, zF + 0.01));
  const glass = new THREE.Mesh(mergeGeometries(G), glassMat); glass.renderOrder = 1; root.add(glass);
  // 불빛 (안 벽에 비친 따뜻한 등빛·촛불·창 안쪽 빛): 한 장 재질, 낮엔 은은히, 밤엔 밝게
  const L = [];
  for (const [x, z] of pend) L.push(new THREE.CircleGeometry(0.17, 8).rotateX(Math.PI / 2).translate(x, H - 0.87, z));
  for (const [x, z] of candles) L.push(new THREE.PlaneGeometry(0.06, 0.1).translate(x, 1.39, z + 0.02));
  const strip = (g) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); g.deleteAttribute('normal'); return g; };
  const lightGeo = mergeGeometries(L.map(strip));
  const lightMat = new THREE.MeshBasicMaterial({ color: '#ffd28a', transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const lights = new THREE.Mesh(lightGeo, lightMat); lights.renderOrder = 2; root.add(lights);
  // 등빛 번짐 (뒷벽 + 창 안쪽): 밖에서 볼 때만 따뜻하게. 안에 앉아 읽는 동안은 감춤(setReading)
  const washGeo = mergeGeometries([new THREE.PlaneGeometry(W - 0.6, H - 0.5).translate(0, H / 2 + 0.1, zB + 0.25), ...[-1, 1].map((s) => new THREE.PlaneGeometry(winW - 0.05, winH - 0.05).translate(s * (doorW / 2 + 0.35 + winW / 2), winY, zF - 0.06))].map(strip));
  const washMat = new THREE.MeshBasicMaterial({ color: '#ffb760', transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending });
  const wash = new THREE.Mesh(washGeo, washMat); wash.renderOrder = 2; root.add(wash);
  // 둥근 간판: 문 위 처마 띠 앞 (밤엔 작은 등이 비춤)
  const sign = new THREE.Mesh(new THREE.CircleGeometry(0.62, 24), new THREE.MeshBasicMaterial({ map: signTexture(), transparent: true }));
  sign.position.set(0, H - 0.12, zF + 0.66); root.add(sign);
  const signLamp = glowSprite('#ffd79a', 0.9); signLamp.position.set(0, H - 0.12, zF + 0.9); root.add(signLamp);
  // 입간판 '저녁에 열어요' (닫힌 때만)
  const bx = doorW / 2 + 0.9, bz = -0.55;
  const board = new THREE.Group(); board.position.set(bx, 0.1, bz); board.rotation.y = -0.25; root.add(board);
  { const legs = new THREE.Mesh(mergeGeometries([box(0.05, 0.9, 0.05, '#4a3220', M4(-0.3, 0.45, -0.12, 0.18)), box(0.05, 0.9, 0.05, '#4a3220', M4(0.3, 0.45, -0.12, 0.18)), box(0.05, 0.9, 0.05, '#4a3220', M4(-0.3, 0.45, 0.12, -0.18)), box(0.05, 0.9, 0.05, '#4a3220', M4(0.3, 0.45, 0.12, -0.18))]), mat); board.add(legs); }
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.82), new THREE.MeshToonMaterial({ map: boardTexture(), gradientMap: gradHard })); face.position.set(0, 0.62, 0.11); face.rotation.x = -0.18; board.add(face);
  // 밤: 툇마루 빛웅덩이 (광원은 더하지 않음)
  const poolTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(255,205,140,1)'); gr.addColorStop(0.5, 'rgba(255,190,120,0.4)'); gr.addColorStop(1, 'rgba(255,180,100,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(W, fore + 2.4).rotateX(-Math.PI / 2), poolMat); pool.position.set(0, 0.1, -fore / 2 + 0.4); pool.renderOrder = 2; root.add(pool);
  root.updateMatrixWorld(true);
  const toWorld = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyMatrix4(root.matrixWorld);

  // 충돌: 건물·화분·입간판
  if (col) {
    { const [cx, cz] = wpt(0, zC); col.addBox(cx, cz, site.rot, W / 2 + 0.1, D / 2 + 0.1); }
    { const [px, pz] = wpt(-W / 2 + 0.5, -0.6); col.add(px, pz, 0.4); }
    { const [px, pz] = wpt(bx, bz); col.add(px, pz, 0.35); }
  }
  const door = toWorld(0, 0.05, -fore / 2 + 0.2); // 상호작용 자리: 툇마루 가운데
  const center = toWorld(0, 0, zC);
  const signPos = toWorld(0, H + 1.0, zC);
  // 앉는 자리: 높은 의자 위, 바(뒤)를 봄. out = 일어나면 서는 자리(툇마루)
  const face0 = site.rot + Math.PI; // 뒤를 보는 방향
  const seats = seatX.map((x, i) => ({ pos: toWorld(x, 0, seatZ), y: y0 + 0.82 - 0.5 + 0.06 /* 높은 의자 위 (불멍 의자와 같은 셈) */, h: face0, out: toWorld(i ? 0.6 : -0.6, 0.05, -fore / 2) }));
  let lit = -1, open = true;
  function setOpen(on) { open = !!on; board.visible = !open; }
  function setReading(on) { wash.visible = !on; }
  function update(dt, night) {
    const on = night > 0.01 ? 1 : 0;
    if (on !== lit) { lit = on; pool.visible = !!on; signLamp.visible = !!on; }
    // 열려 있으면 안이 밝음(낮에도 조금), 닫혀 있으면 촛불·등도 끔에 가깝게
    lightMat.opacity = open ? 0.45 + 0.5 * night : 0.08 + 0.08 * night;
    washMat.opacity = open ? 0.06 + 0.3 * night : 0.02;
    if (!on) return;
    signLamp.material.opacity = night * (open ? 1 : 0.5);
    poolMat.opacity = night * (open ? 0.5 : 0.12);
  }
  return { root, center, door, signPos, seats, update, setOpen, setReading, y0, rot: site.rot, board, lights };
}
