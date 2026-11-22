// 사건 파일 모양 (#232): 사건 데이터(src/cases/c*.js)의 prop 이름 → 로우폴리 임시 모양. 지금 그림체(toon 재질), 재질마다 한 덩어리로 합쳐 draw call 을 줄임
// 이 파일은 읽기만 해서는 아무것도 하지 않음 (game/cases.js 가 buildProp 으로 씀). 새 사건에 새 모양이 필요하면 여기 B 에 하나 더한다
// - row: 캔은 캔끼리·병은 병끼리 줄 선 더미 (맨 끝 한 칸은 빈자리) · peel: 귤 껍질 세 조각 · nest: 나무 위 둥지와 병뚜껑 · paper: 돌에 눌린 쪽지 · bush: 숨을 수풀 · gyul: 귤 세 개
// - (사건 4, #235) neck: 안개 속 긴 목 그림자(원통 몇 개, 솟았다 내려감) · rings: 같은 크기 둥근 자국들 · post: 둘레의 관찰 말뚝 · log: 초소 일지(받침에 얹은 공책)
// 모양의 root.userData.tick(t, dt) 가 있으면 보이는 동안 game/cases.js 가 매 프레임 부름. 대면 장면은 아래 SCENES (game/cases.js 가 face.scene 이름으로 씀)
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gradHard } from '../toon.js';
import { LOW } from '../gfx2.js';

const MATS = {};
const tm = (c) => (MATS[c] ||= new THREE.MeshToonMaterial({ color: c, gradientMap: gradHard }));
// 조각 [geometry, x, y, z, rx, ry, rz, sx?, sy?, sz?] 을 한 덩어리로
function lump(parts, color) {
  const gs = parts.map(([g, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1]) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
    const n = g.index ? g.toNonIndexed() : g.clone(); n.applyMatrix4(m); g.dispose(); return n;
  });
  const mesh = new THREE.Mesh(mergeGeometries(gs), tm(color)); gs.forEach((g) => g.dispose());
  mesh.castShadow = !LOW; mesh.receiveShadow = true; return mesh;
}
const B = {
  row() { // 2줄: 앞줄 캔 7, 뒷줄 병 5. 가로 2.2m, 앞줄 맨 끝(+x) 한 칸은 빈자리(대면 뒤 귤·종이가 놓임)
    const cans = [], bottles = [], caps = [];
    for (let i = 0; i < 7; i++) cans.push([new THREE.CylinderGeometry(0.07, 0.07, 0.2, 7), -1 + i * 0.28, 0.1, 0.18]);
    for (let i = 0; i < 5; i++) { bottles.push([new THREE.CylinderGeometry(0.075, 0.085, 0.3, 7), -0.95 + i * 0.36, 0.15, -0.2]); caps.push([new THREE.CylinderGeometry(0.035, 0.035, 0.12, 6), -0.95 + i * 0.36, 0.36, -0.2]); }
    const g = new THREE.Group(); g.add(lump(cans, '#b9c0c6'), lump(bottles, '#4f9a6a'), lump(caps, '#3f7f56'));
    return g;
  },
  peel() { // 줄 맨 끝(row 의 빈자리 옆) 땅에 귤 껍질 세 조각
    return lump([0, 1, 2].map((i) => [new THREE.SphereGeometry(0.09, 6, 3, 0, Math.PI * 1.2, 0, Math.PI / 2), i * 0.2, 0.02, 0, Math.PI, i * 0.9, 0, 1, 0.35, 1]), '#f29a2e');
  },
  nest() { // 마른 나무 (줄기·가지) + 가지 위 둥지 + 둥지 위 병뚜껑 (색 둘)
    const g = new THREE.Group();
    g.add(lump([[new THREE.CylinderGeometry(0.16, 0.24, 3.2, 6), 0, 1.6, 0], [new THREE.CylinderGeometry(0.06, 0.1, 1.4, 5), 0.45, 2.5, 0, 0, 0, -0.9], [new THREE.CylinderGeometry(0.05, 0.08, 1.1, 5), -0.38, 2.9, 0.1, 0.2, 0, 0.8]], '#6b5237'));
    g.add(lump([[new THREE.TorusGeometry(0.28, 0.12, 5, 9), 0.85, 2.92, 0, Math.PI / 2, 0, 0], [new THREE.CircleGeometry(0.26, 9), 0.85, 2.88, 0, -Math.PI / 2, 0, 0]], '#8a6a44'));
    const caps = (c, k) => lump([0, 1, 2, 3].map((i) => [new THREE.CylinderGeometry(0.05, 0.05, 0.03, 7), 0.78 + (i % 2) * 0.12 + k * 0.05, 2.98 + Math.floor(i / 2) * 0.035, -0.06 + k * 0.1, 0, 0, 0]), c);
    g.add(caps('#d0453a', 0), caps('#3a78c0', 1));
    return g;
  },
  paper() { // 돌에 눌린 종이 한 장
    const g = new THREE.Group();
    g.add(lump([[new THREE.PlaneGeometry(0.42, 0.56), 0, 0.05, 0, -Math.PI / 2 + 0.15, 0, 0.4]], '#efe6cf'));
    g.add(lump([[new THREE.DodecahedronGeometry(0.12, 0), 0.1, 0.08, -0.12, 0, 0, 0, 1, 0.7, 1]], '#4a4744'));
    return g;
  },
  bush() { // 사람이 쪼그려 숨을 만한 낮은 수풀
    return lump([[0, 0, 0, 0.55], [0.5, 0.1, 0.4, 0.45], [-0.5, 0.25, -0.1, 0.45], [0.1, -0.45, 0.2, 0.4]].map(([x, z, dy, r]) => [new THREE.DodecahedronGeometry(r, 0), x, r * 0.8 + dy * 0.2, z, 0, x * 3, 0, 1.2, 0.85, 1.1]), '#5f8a3a');
  },
  gyul() { // 귤 세 개 (대면 뒤 빈자리)
    return lump([0, 1, 2].map((i) => [new THREE.IcosahedronGeometry(0.08, 1), (i - 1) * 0.12, 0.08, (i % 2) * 0.05]), '#f29a2e');
  },
};
/* ---------- 사건 4 '굼부리 괴물' (#235) ---------- */
const fogMat = () => (MATS.fog ||= new THREE.MeshBasicMaterial({ color: '#e9ecef', transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide }));
// 목: 아래가 굵고 위로 가늘어지는 원통 마디(조금씩 휨) + 끝에 비스듬한 '머리'(실은 호스 주둥이). 한 덩어리, 색은 안개에 묻히는 짙은 회색
function neckParts(n, seg, r0, r1, bend) {
  const parts = []; let x = 0, y = 0, a = 0;
  for (let i = 0; i < n; i++) { const r = r0 + (r1 - r0) * (i / n), da = bend * (i / n); a = da; parts.push([new THREE.CylinderGeometry(r * 0.94, r, seg, 8, 1, true), x, y + seg / 2, 0, 0, 0, -a]); x += Math.sin(a) * seg; y += Math.cos(a) * seg; }
  return { parts, top: [x, y, a] };
}
B.neck = () => {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const { parts, top } = neckParts(9, 2.6, 1.15, 0.9, 0.5);
  parts.push([new THREE.CylinderGeometry(1.5, 1.0, 2.2, 8), top[0] + 0.9, top[1] + 0.2, 0, 0, 0, -top[2] - 1.0]);
  const m = lump(parts, '#3d4247'); m.castShadow = false; body.add(m);
  // 안개: 낮게 깔린 얇은 원판 셋 (투명 한 덩어리). 사건 장면에서 걷힘 (userData.fog)
  const fog = new THREE.Mesh(mergeGeometries([[16, 1.2], [12, 3.4], [9, 6.2]].map(([r, y]) => { const c = new THREE.CircleGeometry(r, 28); c.rotateX(-Math.PI / 2); c.translate(0, y, 0); return c; })), fogMat());
  fog.renderOrder = 2; g.add(fog);
  g.userData.body = body; g.userData.fog = fog;
  // 솟았다 내려감: 주기 14초 중 6초는 위(목이 안개 위로), 나머지는 안개 아래로 가라앉음
  g.userData.tick = (t) => { const k = (t % 14) / 14, up = k < 0.43 ? Math.sin(Math.min(1, k / 0.43) * Math.PI) : 0; body.position.y = -22 + 22 * Math.min(1, up * 1.6); };
  return g;
};
B.rings = () => { // 굼부리 바닥의 같은 크기 둥근 자국 다섯 (눌린 흙빛 고리 + 가운데 조금 짙음)
  const at = [[0, 0], [3.1, 1.2], [-2.6, 2.0], [1.0, -3.0], [-1.8, -2.4]];
  const g = new THREE.Group();
  g.add(lump(at.map(([x, z]) => [new THREE.TorusGeometry(0.9, 0.12, 4, 16), x, 0.04, z, Math.PI / 2, 0, 0, 1, 1, 0.4]), '#5a4a38'));
  g.add(lump(at.map(([x, z]) => [new THREE.CircleGeometry(0.85, 14), x, 0.025, z, -Math.PI / 2, 0, 0]), '#6d5c45'));
  return g;
};
B.post = () => lump([[new THREE.CylinderGeometry(0.07, 0.09, 1.3, 6), 0, 0.65, 0], [new THREE.BoxGeometry(0.5, 0.3, 0.05), 0, 1.25, 0.06, -0.3, 0, 0]], '#7a5d3d'); // 둘레의 관찰 말뚝
B.log = () => { // 초소 곁 받침 위 공책 (일지)
  const g = new THREE.Group();
  g.add(lump([[new THREE.BoxGeometry(0.5, 0.9, 0.4), 0, 0.45, 0]], '#8a8070'));
  g.add(lump([[new THREE.BoxGeometry(0.36, 0.04, 0.26), 0, 0.92, 0, 0, 0.3, 0]], '#2f5a7a'));
  g.add(lump([[new THREE.PlaneGeometry(0.3, 0.22), 0.0, 0.945, 0, -Math.PI / 2, 0, 0.3]], '#efe6cf'));
  return g;
};
// 호스: 하늘에서 내려와 굼부리 바닥 위 4m 에서 끝나는 주름 관 (주름 고리까지 한 덩어리) + 주둥이. 쏟는 쓰레기(한 덩어리, 아래로 흘러내리며 되풀이) + 새 더미
B.hose = () => {
  const g = new THREE.Group(), H = 170, base = 4;
  const ring = []; for (let y = base + 2; y < H; y += 3.2) ring.push([new THREE.TorusGeometry(1.08, 0.12, 4, 12), 0, y, 0, Math.PI / 2, 0, 0]);
  g.add(lump([[new THREE.CylinderGeometry(1.0, 1.0, H - base, 10, 1, true), 0, base + (H - base) / 2, 0], ...ring], '#5d646b'));
  g.add(lump([[new THREE.CylinderGeometry(1.0, 1.5, 1.6, 10, 1, true), 0, base - 0.2, 0]], '#3d4247'));
  const bits = [], cols = ['#b9c0c6', '#4f9a6a', '#e8e4da'];
  for (let i = 0; i < 10; i++) bits.push([new THREE.BoxGeometry(0.55, 0.4, 0.45), Math.sin(i * 2.3) * 0.5, -i * 0.42, Math.cos(i * 1.7) * 0.5, i, i * 0.5, 0]); /* 주둥이 아래 4m 기둥 */
  const pour = new THREE.Group(), p1 = lump(bits, cols[0]); p1.castShadow = false; pour.add(p1); pour.position.y = base; pour.visible = false; g.add(pour);
  const heap = lump([[new THREE.DodecahedronGeometry(1.6, 0), 0, 0.4, 0, 0, 0, 0, 1.3, 0.6, 1.2], [new THREE.BoxGeometry(0.5, 0.4, 0.4), 1.2, 0.9, 0.3, 0.3, 0.6, 0], [new THREE.CylinderGeometry(0.12, 0.12, 0.4, 6), -1.0, 0.95, 0.5, 1.2, 0, 0]], '#8a8478');
  heap.scale.setScalar(0.001); g.add(heap);
  g.userData = { pour, heap, base };
  return g;
};
export const propKinds = Object.keys(B);
export function buildProp(kind) { const f = B[kind]; return f ? f() : null; }

/* ---------- 대면 장면 (face.scene, game/cases.js 의 숨어 보기 틀을 빌려 씀) ---------- */
// begin(ctx) → st · tick(st, u, T, ctx) · cam(st, u, T, ctx) → { pos, look } (없으면 숨어 보기 카메라) · end(st, ctx)
// ctx = { scene, see: 목격 자리 Vector3, face: 대면 자리 Vector3, seeRoot: 목격 모양 root }
const sm = (a) => a * a * (3 - 2 * a);
const cl = (x) => Math.max(0, Math.min(1, x));
export const SCENES = {
  // 사건 4 (#235): 안개가 걷히면 긴 목은 하늘까지 이어진 호스. 카메라가 호스를 따라 하늘로 올라갔다 내려오면 주둥이에서 쓰레기가 쏟아져 새 더미가 됨
  hose: {
    begin(ctx) {
      const h = buildProp('hose'); h.position.copy(ctx.see); h.visible = false; ctx.scene.add(h);
      const fog = ctx.seeRoot?.userData.fog, body = ctx.seeRoot?.userData.body;
      if (ctx.seeRoot) { ctx.seeRoot.userData.hold = true; ctx.seeRoot.visible = true; }
      if (body) body.position.y = 0;
      return { root: ctx.seeRoot, h, fog, body, op: fog?.material.opacity ?? 0.5, by: body?.position.y ?? 0 };
    },
    tick(st, u, T) {
      const clear = cl((u - T * 0.18) / (T * 0.22));
      if (st.fog) st.fog.material.opacity = st.op * (1 - clear);
      if (st.body) { st.body.position.y = clear < 0.5 ? 0 : -999; }
      st.h.visible = clear >= 0.5;
      const pour = st.h.userData.pour, heap = st.h.userData.heap, pk = cl((u - T * 0.62) / (T * 0.2));
      pour.visible = pk > 0 && pk < 1; pour.position.y = st.h.userData.base - ((u * 6) % 1.7);
      heap.scale.setScalar(Math.max(0.001, sm(cl((u - T * 0.66) / (T * 0.22)))));
    },
    cam(st, u, T, ctx) {
      const s = ctx.see, f = ctx.face, up = sm(cl((u - T * 0.3) / (T * 0.18))) * (1 - sm(cl((u - T * 0.55) / (T * 0.12))));
      const k = 0.45, px = f.x + (s.x - f.x) * k, pz = f.z + (s.z - f.z) * k; /* 둘레에서 가운데 쪽으로 반쯤 (나무에 덜 가림) */
      return { pos: new THREE.Vector3(px, Math.max(f.y, s.y) + 7, pz), look: new THREE.Vector3(s.x, s.y + 3 + up * 110, s.z) };
    },
    end(st, ctx) {
      ctx.scene.remove(st.h); st.h.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
      if (st.fog) st.fog.material.opacity = st.op;
      if (st.body) st.body.position.y = st.by;
      if (st.root) st.root.userData.hold = false;
    },
  },
};
