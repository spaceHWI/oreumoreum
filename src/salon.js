// 루이네 미장원 (#58): 가게 거리 1번 터의 작은 동네 미장원. 건물은 Tripo 모델(#71, model-salon.js) + SVG 간판 글자
// 실제 가게(서귀포 법환로 11): 밝은 회색 돌 타일 벽의 네모난 단층, 입구 위 흰 간판에 빨강·파랑 사선 줄무늬 테두리, 어두운 틀의 넓은 유리창,
// 벽에 삼색 회전 기둥, 문 앞에 빨강·흰·파랑 드럼통 둘, 안은 따뜻한 나무 선반과 거울
// 로컬 좌표: +Z = 앞(골목 쪽), 원점 = 모델 가운데 · 안 바닥. 의자는 큰 창 안쪽에서 뒷벽 거울을 봄 → 밖에서 창 너머로 머리 깎는 모습이 보임
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gradHard } from './toon.js';
import { SALON } from './balance.js';
import { propMesh, svgTexture } from './propmodel.js';

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
// 간판 글자 (SVG): 모델 간판(흰 판 + 빨강·파랑 사선 줄무늬 테두리)의 흰 칸 위에 '루이네 미장원'
const SIGN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="336" viewBox="0 0 1024 336">'
  + '<text x="512" y="182" text-anchor="middle" dominant-baseline="middle" textLength="880" lengthAdjust="spacingAndGlyphs" fill="#1f2b4a" font-weight="800" font-size="190" font-family="Pretendard, Apple SD Gothic Neo, Noto Sans KR, Malgun Gothic, sans-serif">루이네 미장원</text></svg>';

// 모델 좌표(Tripo shop-salon, 크기 약 1, 앞 = +z) 로 잰 자리. 로컬(m) = 모델 × SALON.s, 안 바닥이 로컬 y=0
const M = {
  floor: 0.059,
  house: { x: 0.452, z0: -0.49, z1: 0.347 }, // 건물 (반폭, 뒤·앞벽)
  drums: [[-0.3, 0.42], [-0.14, 0.42]], drumR: 0.068, pole: [0.38, 0.42],
  seat: [-0.115, 0.12], seatTop: 0.18, // 창 안쪽 미용 의자 (뒷벽 거울을 봄), 앉는 판 높이
  door: [0.07, 0.3, 0.53], // 문 (x0, x1, 위)
  win: [-0.39, -0.02, 0.17, 0.55], glassZ: 0.33, // 큰 창 (x0, x1, y0, y1), 유리 자리
  sign: [-0.285, 0.285, 0.668, 0.852, 0.392], // 간판 흰 칸 (x0, x1, y0, y1, 앞면 z)
  cut: 0.6, top: 0.887, // 안에 앉으면 이 높이 위를 잘라 위에서 보이게
};

export function createSalon({ scene, height, site, low, col }) {
  const { x, z, rot } = site, S = SALON.s;
  const L = (v) => v * S, LY = (v) => (v - M.floor) * S;
  const fw = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot)), rt = new THREE.Vector3(Math.cos(rot), 0, -Math.sin(rot));
  const wpt = (lx, lz) => [x + rt.x * lx + fw.x * lz, z + rt.z * lx + fw.z * lz];
  const hw = L(0.452), zb = L(-0.49), zf = L(0.49);
  // 바닥 높이: 건물과 앞마당 귀퉁이 중 가장 높은 곳 + 조금
  let yHi = -1e9, yLo = 1e9;
  for (const a of [-1, 0, 1]) for (const b of [zb, 0, zf]) { const [px, pz] = wpt(a * hw, b); const h = height(px, pz); yHi = Math.max(yHi, h); yLo = Math.min(yLo, h); }
  const y0 = yHi + 0.15;
  const root = new THREE.Group(); root.position.set(x, y0, z); root.rotation.y = rot;
  // 건물 (Tripo 모델): 회색 돌 벽·줄무늬 테두리 간판·삼색 기둥·드럼통·안의 거울·의자까지. 안에 앉으면 cut 위를 잘라냄
  const model = propMesh('salon', S, { floor: M.floor, low, glow: 0.12, clip: true }); root.add(model);
  // 받침(현무암 밑단): 비탈에서 모델 밑이 뜨지 않게
  const plH = y0 - yLo + 0.5;
  const plinth = new THREE.Mesh(piece(box(hw * 2 - 0.1, plH, zf - zb - 0.1, 0, LY(0) + 0.05 - plH / 2, (zf + zb) / 2), '#3b4044'), new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradHard }));
  plinth.receiveShadow = !low; root.add(plinth);
  // 유리: 창·문은 비침. 밤엔 따뜻하게
  const glassMat = new THREE.MeshLambertMaterial({ color: '#9fc4d6', transparent: true, opacity: 0.18, depthWrite: false, emissive: '#ffc46a', emissiveIntensity: 0 });
  const gz = L(M.glassZ), [wx0, wx1, wy0, wy1] = M.win, [dx0, dx1, dy1] = M.door;
  const gl = [box(L(wx1 - wx0), L(wy1 - wy0), 0.03, L((wx0 + wx1) / 2), LY((wy0 + wy1) / 2), gz), box(L(dx1 - dx0) - 0.1, LY(dy1) - 0.04, 0.03, L((dx0 + dx1) / 2), LY(dy1) / 2, gz)];
  const glass = new THREE.Mesh(mergeGeometries(gl), glassMat); glass.renderOrder = 3; root.add(glass);
  // 간판 글자 (SVG)
  const [sx0, sx1, sy0, sy1, sz] = M.sign;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(L(sx1 - sx0), L(sy1 - sy0)), new THREE.MeshBasicMaterial({ map: svgTexture(SIGN_SVG, 1024, 336), transparent: true, depthWrite: false }));
  sign.position.set(L((sx0 + sx1) / 2), LY((sy0 + sy1) / 2), L(sz) + 0.04); root.add(sign);

  scene.add(root); root.updateMatrixWorld(true);
  const toWorld = (a, b, c) => new THREE.Vector3(a, b, c).applyMatrix4(root.matrixWorld);

  // 충돌: 건물 상자, 드럼통, 기둥
  if (col) {
    { const [cx, cz] = wpt(0, L((M.house.z0 + M.house.z1) / 2)); col.addBox(cx, cz, rot, L(M.house.x) + 0.1, L((M.house.z1 - M.house.z0) / 2) + 0.1); }
    for (const [ax, az] of M.drums) { const [px, pz] = wpt(L(ax), L(az)); col.add(px, pz, L(M.drumR) + 0.04); }
    { const [px, pz] = wpt(L(M.pole[0]), L(M.pole[1]) - 0.3); col.add(px, pz, 0.25); }
  }

  // 자리: 의자(거울을 봄), 문 앞(상호작용·걸어갈 곳·다 깎고 나오는 곳)
  const seat = toWorld(L(M.seat[0]), LY(M.seatTop) - 0.47, L(M.seat[1]));
  const doorX = L((dx0 + dx1) / 2), doorOut = toWorld(doorX, 0, L(M.house.z1) + 1.25); doorOut.y = height(doorOut.x, doorOut.z);
  const front = toWorld(0, 0, SALON.D / 2 + SALON.fore); front.y = height(front.x, front.z);
  const signPos = toWorld(0, LY(M.top) + 0.4, L(M.house.z1));
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
    night = n;
    glassMat.emissiveIntensity = n * 0.7; glassMat.opacity = 0.18 + n * 0.3;
  }
  // 안에 들어가 앉았을 때 창 위(간판·지붕)를 잘라 위에서 보이게
  const cutU = model.userData.real.userData.cut;
  const inside = (on) => { cutU.value = on ? M.cut : 1e9; sign.visible = !on; };
  return { root, center, front, door: doorOut, seat, seatHeading, signPos, update, inside, cut, y0, get night() { return night; } };
}
