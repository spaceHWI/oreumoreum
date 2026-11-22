// 사건 파일 모양 (#232, #246): 사건 데이터(src/cases/c*.js)의 prop 이름 → 로우폴리 임시 모양. 지금 그림체(toon 재질), 재질마다 한 덩어리로 합쳐 draw call 을 줄임
// 이 파일은 읽기만 해서는 아무것도 하지 않음 (game/cases.js 가 buildProp 으로 씀). 새 사건에 새 모양이 필요하면 여기 B 에 하나 더한다
// - crop: 풀이 둥글게 누운 무늬(#212 크롭서클 그림, 땅을 따라 휨. userData.place(x, z) 로 놓음) · dent: 무늬 가운데 눌린 자국 · rock: 올라서서 찍는 바위
// - paper: 돌에 눌린 쪽지 · bush: 숨을 수풀 · heap: 떨어지는 더미(자루·캔)
// 사건 2 (#233): wall 돌담 조각 · rag 흰 천이 걸린 낮은 돌담 · gone 더미가 있던 반듯한 빈자리 · line 빨랫줄의 흰 작업복과 메모
// - 사건 5: print 큰 발자국 · fur 흰 털 뭉치 · knots 묶인 봉지 셋 · yeti 앉아 봉지를 묶는 설인(userData.anim, Tripo 모델 #262)
// - (사건 4, #235) neck: 안개 속 긴 목 그림자(Tripo 호스 모델 #262, 솟았다 내려감·꿈틀) · rings: 같은 크기 둥근 자국들 · post: 둘레의 관찰 말뚝 · log: 초소 일지(받침에 얹은 공책)
// - (사건 3, #234) suits: 능선에 선 검은 양복 둘(MYST.back 실루엣, 뒤돌아보면 없다는 game/casesuit.js PROP_HOOK) · suit: 대면 자리 하나(Tripo mib 모델, mibBody) · prints: 발가락 넷 맨발 자국 두 쌍 · notebook: 떨어진 검은 수첩 · gyulbox: 두고 간 귤 상자와 쪽지
// 모양의 root.userData.tick(t, dt) 가 있으면 보이는 동안 game/cases.js 가 매 프레임 부름. 대면 장면은 아래 SCENES (game/cases.js 가 face.scene 이름으로 씀)
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gradHard } from '../toon.js';
import { LOW } from '../gfx2.js';
import { CASE, MYST } from '../balance.js';
import { height, groundAt } from '../world.js';
import { drape } from '../drape.js';
import { cropTex } from '../croptex.js';
import { caseModel } from '../casemodels.js';

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
// 검은 양복 실루엣 (#234, 뒤돌아보면 figure 와 같은 모양·색, 칼라만 흰 V)
let SIL = null;
function silh(x) {
  const H = MYST.back.h, g = new THREE.Group();
  const gs = [[new THREE.CylinderGeometry(0.16, 0.3, H * 0.62, 7), 0, H * 0.31, 0], [new THREE.SphereGeometry(0.34, 10, 8), 0, H * 0.62 + 0.36, 0, 0, 0, 0, 1, 1.25, 0.9],
    [new THREE.CylinderGeometry(0.05, 0.04, H * 0.5, 5), -0.26, H * 0.38, 0, 0, 0, -0.12], [new THREE.CylinderGeometry(0.05, 0.04, H * 0.5, 5), 0.26, H * 0.38, 0, 0, 0, 0.12]];
  const body = lump(gs, '#1a1d20'); body.material = (SIL ||= new THREE.MeshBasicMaterial({ color: '#1a1d20' })); body.castShadow = false; g.add(body);
  g.add(lump([[new THREE.ConeGeometry(0.07, 0.2, 3), 0, H * 0.56, 0.2, Math.PI, 0, 0]], '#f2efe6'));
  g.position.x = x; return g;
}
// 검은 양복 Tripo 모델 (#262 mib, 바짓단 아래 신발 없는 맨발). 대면 자리 모양과 game/casesuit.js 장면이 씀
export const MIB_LIFT = 0.12; // 길 띠·풀에 발이 묻히지 않게 띄움 (발이 반전이라 보여야 함)
export function mibBody() { const M = caseModel('mib'); M.play('stand'); M.update(0); return M; }
export const PROP_HOOK = {}; // 모양 이름 → (root, t, dt) 매 프레임 (다른 파일이 채움: game/casesuit.js suits)
const B = {
  crop() { // 무늬: 지름 2 판을 CASE.crop.r 로 키워 땅을 따라 휨 (흐린 풀빛, 그림자 없음)
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, LOW ? 10 : 16, LOW ? 10 : 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: cropTex(), transparent: true, opacity: CASE.crop.op, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    m.renderOrder = 1; m.name = 'case-crop';
    const put = drape(m, height, 0.07); m.userData.place = (x, z) => put(x, z, CASE.crop.r, CASE.crop.rot);
    return m;
  },
  dent() { // 가운데 눌린 자국: 납작하게 누운 풀 덩이 다섯 (자루를 내려놓은 모양)
    return lump([[0, 0, 0.5], [0.55, 0.2, 0.36], [-0.45, 0.3, 0.38], [0.15, -0.5, 0.34], [-0.3, -0.4, 0.3]].map(([x, z, r]) => [new THREE.CylinderGeometry(r, r * 1.1, 0.05, 8), x, 0.03, z]), '#a7ac5c');
  },
  rock() { // 올라서서 내려다보는 현무암 바위 둘
    return lump([[new THREE.DodecahedronGeometry(0.7, 0), 0, 0.35, 0, 0, 0.4, 0, 1.3, 0.6, 1], [new THREE.DodecahedronGeometry(0.4, 0), 0.8, 0.22, 0.3, 0, 1, 0, 1, 0.6, 1]], '#4a4744');
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
  wall() { // 사건 2 목격: 사람 허리 높이 돌담 조각 (가로 3.2m, 현무암 덩이 두 단). 흰 옷이 그 너머로 지나감
    const st = [];
    for (let i = 0; i < 8; i++) st.push([new THREE.DodecahedronGeometry(0.26, 0), -1.4 + i * 0.4, 0.22, (i % 2) * 0.06, i, i * 0.7, 0, 1.05, 0.85, 0.9]);
    for (let i = 0; i < 7; i++) st.push([new THREE.DodecahedronGeometry(0.23, 0), -1.2 + i * 0.4, 0.6, 0.02, i * 0.4, i, 0.3, 1, 0.8, 0.85]);
    return lump(st, '#3d3b3a');
  },
  rag() { // 사건 2 증거: 낮은 돌담에 걸린 흰 천 조각 (천은 두 장, 바람에 젖혀진 각)
    const g = new THREE.Group(), st = [];
    for (let i = 0; i < 4; i++) st.push([new THREE.DodecahedronGeometry(0.25, 0), -0.6 + i * 0.4, 0.2, 0, i, i * 0.9, 0, 1, 0.8, 0.9]);
    for (let i = 0; i < 3; i++) st.push([new THREE.DodecahedronGeometry(0.22, 0), -0.4 + i * 0.4, 0.56, 0, i * 0.5, i, 0.2, 1, 0.8, 0.85]);
    g.add(lump(st, '#3d3b3a'));
    const cloth = lump([[new THREE.PlaneGeometry(0.34, 0.42), 0.18, 0.62, 0.2, 0.1, 0.3, 0.25], [new THREE.PlaneGeometry(0.2, 0.26), 0.36, 0.5, 0.22, 0.25, 0.5, -0.4]], '#f4f3ee');
    cloth.material = cloth.material.clone(); cloth.material.side = THREE.DoubleSide; g.add(cloth);
    return g;
  },
  gone() { // 사건 2 증거: 더미가 있던 자리 (눌린 흙 동그라미 + 테두리에 남은 봉지 끈 하나·캔 하나)
    const g = new THREE.Group();
    g.add(lump([[new THREE.CircleGeometry(1.3, 12), 0, 0.03, 0, -Math.PI / 2, 0, 0]], '#7a6a50'));
    g.add(lump([[new THREE.TorusGeometry(1.3, 0.06, 4, 16), 0, 0.04, 0, Math.PI / 2, 0, 0, 1, 1, 0.4]], '#5a4e3a'));
    g.add(lump([[new THREE.CylinderGeometry(0.07, 0.07, 0.2, 7), 1.15, 0.07, 0.4, Math.PI / 2, 0, 0.6]], '#b9c0c6'));
    return g;
  },
  line() { // 사건 2 증거: 말뚝 둘 사이 빨랫줄 + 흰 작업복(윗옷·바지) + 집게 하나 기대 놓음 + 줄에 꽂힌 메모
    const g = new THREE.Group();
    g.add(lump([[new THREE.CylinderGeometry(0.05, 0.06, 1.9, 5), -1.2, 0.95, 0], [new THREE.CylinderGeometry(0.05, 0.06, 1.9, 5), 1.2, 0.95, 0]], '#6b5237'));
    g.add(lump([[new THREE.CylinderGeometry(0.008, 0.008, 2.4, 3), 0, 1.78, 0, 0, 0, Math.PI / 2]], '#d8d2c0'));
    g.add(lump([[new THREE.BoxGeometry(0.62, 0.66, 0.05), -0.45, 1.42, 0], [new THREE.BoxGeometry(0.2, 0.42, 0.05), -0.86, 1.52, 0, 0, 0, -0.5], [new THREE.BoxGeometry(0.2, 0.42, 0.05), -0.04, 1.52, 0, 0, 0, 0.5],
      [new THREE.BoxGeometry(0.22, 0.86, 0.05), 0.38, 1.33, 0], [new THREE.BoxGeometry(0.22, 0.86, 0.05), 0.66, 1.33, 0]], '#f4f3ee'));
    g.add(lump([[new THREE.BoxGeometry(0.12, 0.14, 0.012), 0.95, 1.7, 0.03]], '#efe6cf'));
    g.add(lump([[new THREE.CylinderGeometry(0.015, 0.015, 0.9, 4), 1.05, 0.45, 0.15, 0, 0, 0.25], [new THREE.CylinderGeometry(0.015, 0.015, 0.9, 4), 1.11, 0.45, 0.15, 0, 0, 0.18]], '#8a8f96'));
    return g;
  },
  suits() { // 사건 3 목격: 검은 양복 둘, 1.4m 떨어져 나란히. 한 번 본 뒤 화면 밖으로 나가면 사라짐 (PROP_HOOK.suits)
    const g = new THREE.Group(), body = new THREE.Group(); body.add(silh(-0.7), silh(0.7)); g.add(body);
    g.userData.body = body; g.userData.tick = (t, dt) => PROP_HOOK.suits?.(g, t, dt); return g;
  },
  suit() { // 사건 3 대면 자리: 검은 양복 하나 (Tripo 모델 mib, 바짓단 아래 신발 없는 발)
    const g = new THREE.Group(), M = mibBody(); g.add(M.root); g.userData.mib = M; g.userData.tick = (t, dt) => { if (!g.userData.y0) { g.userData.y0 = 1; g.position.y = groundAt(g.position.x, g.position.z) + MIB_LIFT; } M.update(dt); }; return g; /* 길의 디딤판 등 밟는 높이 위에 (groundAt) */
  },
  prints() { // 사건 3: 두 사람이 꼭 같은 자리에 선 맨발 자국 두 쌍 (구두 자국이 아님, 발가락 넷)
    const parts = [];
    for (const px of [-0.7, 0.7]) for (const k of [-1, 1]) {
      const x = px + k * 0.13;
      parts.push([new THREE.CircleGeometry(0.1, 9), x, 0.03, 0, -Math.PI / 2, 0, 0, 0.8, 1.45, 1]);
      for (let t = 0; t < 4; t++) parts.push([new THREE.CircleGeometry(0.03, 6), x + (t - 1.5) * 0.045, 0.031, -0.19 + Math.abs(t - 1.5) * 0.012, -Math.PI / 2, 0, 0]);
    }
    return lump(parts, '#3b3328');
  },
  notebook() { // 사건 3: 떨어진 검은 수첩 (펼쳐짐)
    const g = new THREE.Group(), c = Math.cos(0.5) * 0.07, s = Math.sin(0.5) * 0.07;
    g.add(lump([[new THREE.BoxGeometry(0.34, 0.025, 0.22), 0, 0.02, 0, 0, 0.5, 0]], '#1c1e22'));
    g.add(lump([[new THREE.PlaneGeometry(0.15, 0.2), -c, 0.035, s, -Math.PI / 2, 0, 0.5], [new THREE.PlaneGeometry(0.15, 0.2), c, 0.035, -s, -Math.PI / 2, 0, 0.5]], '#efe6cf'));
    return g;
  },
  gyulbox() { // 사건 3: 바위 곁에 두고 간 귤 상자 (위에 귤, 앞에 쪽지)
    const g = new THREE.Group();
    g.add(lump([[new THREE.BoxGeometry(0.6, 0.32, 0.42), 0, 0.16, 0]], '#c89a5e'));
    g.add(lump([0, 1, 2, 3, 4, 5].map((i) => [new THREE.IcosahedronGeometry(0.075, 1), -0.2 + (i % 3) * 0.2, 0.36, (i < 3 ? -0.09 : 0.09)]), '#f29a2e'));
    g.add(lump([[new THREE.PlaneGeometry(0.2, 0.13), 0, 0.17, 0.215, 0, 0, 0.06]], '#f4ecd8'));
    g.add(lump([[new THREE.DodecahedronGeometry(0.42, 0), -0.62, 0.25, -0.1, 0, 0, 0, 1, 0.8, 1]], '#4a4744'));
    return g;
  },
  heap() { // 더미: 흰 자루 셋·푸른 자루 하나·빨간 캔 둘
    const g = new THREE.Group();
    g.add(lump([[0, 0, 0.42], [0.5, 0.2, 0.34], [-0.4, 0.3, 0.32]].map(([x, z, r]) => [new THREE.IcosahedronGeometry(r, 0), x, r * 0.8, z, 0, x, 0, 1, 0.85, 1]), '#eceff1'));
    g.add(lump([[new THREE.IcosahedronGeometry(0.33, 0), 0.05, 0.55, -0.4, 0, 0, 0, 1, 0.9, 1]], '#8fa9bd'));
    g.add(lump([[new THREE.CylinderGeometry(0.07, 0.07, 0.2, 7), -0.7, 0.07, -0.1, Math.PI / 2, 0, 0.4], [new THREE.CylinderGeometry(0.07, 0.07, 0.2, 7), 0.75, 0.1, -0.2, 0, 0, 0]], '#c0453a'));
    return g;
  },
  print() { // 사건 5: 땅에 눌린 큰 발자국 하나 (뒤꿈치 + 발가락 셋, traces.js 발자국 모양을 크게). 앞(+z)이 발끝
    return lump([[new THREE.SphereGeometry(0.34, 8, 3), 0, 0.01, -0.12, 0, 0, 0, 1, 0.12, 1.25], ...[-0.5, 0, 0.5].map((a) => [new THREE.SphereGeometry(0.12, 6, 3), Math.sin(a) * 0.48, 0.01, 0.3 + Math.cos(a) * 0.12, 0, a, 0, 1, 0.12, 1.9])], '#8c8678');
  },
  fur() { // 사건 5: 돌 틈에 걸린 흰 털 한 줌 (+ 붙은 귤 껍질 한 조각)
    const g = new THREE.Group();
    g.add(lump([[new THREE.DodecahedronGeometry(0.42, 0), -0.35, 0.28, 0, 0, 0.4, 0, 1, 0.7, 1], [new THREE.DodecahedronGeometry(0.34, 0), 0.38, 0.22, 0.05, 0, 1.1, 0, 1, 0.65, 1]], '#4a4744'));
    g.add(lump([[0, 0.5, 0.18], [0.12, 0.6, 0.1], [-0.1, 0.56, 0.13], [0.03, 0.42, 0.22]].map(([x, y, r]) => [new THREE.IcosahedronGeometry(r, 0), x, y, 0.05, x * 4, y * 3, 0, 1.3, 0.8, 1]), '#f3f1ea'));
    g.add(lump([[new THREE.SphereGeometry(0.07, 6, 3, 0, Math.PI * 1.2, 0, Math.PI / 2), 0.1, 0.66, 0.16, 0.5, 0.3, 0, 1, 0.35, 1]], '#f29a2e'));
    return g;
  },
  knots() { // 사건 5: 꽁꽁 묶인 봉지 셋 (매듭이 주먹만 함)
    const at = [[-0.45, 0.42, 0], [0.4, 0.4, -0.1], [-0.02, 0.36, 0.45]];
    return lump(at.flatMap(([x, s, z]) => [[new THREE.IcosahedronGeometry(s, 1), x, s * 0.85, z, 0, x, 0, 1, 0.9, 1], [new THREE.IcosahedronGeometry(0.13, 0), x, s * 1.75, z], [new THREE.ConeGeometry(0.08, 0.22, 5), x + 0.1, s * 1.92, z, 0, 0, -0.9], [new THREE.ConeGeometry(0.08, 0.22, 5), x - 0.1, s * 1.92, z, 0, 0, 0.9]]), '#9fabb3');
  },
  yeti() { // 사건 5 대면: 더미 앞에 앉아 봉지를 묶는 흰 털 덩어리. 등(+z)이 다가오는 쪽, 앞(-z)에 작은 더미·묶는 봉지, 옆(-x)에 묶은 봉지 무더기
    // userData.anim(u): 0~1 장면 진행 (설인 모델이 앉아 묶고(sit+tie), 더미 조각이 하나씩 없어지고, 봉지가 하나씩 쌓이고, 끝에 한 손을 듦). 장면 밖에서는 anim(1) 로 끝 모습
    const g = new THREE.Group();
    const Y = caseModel('yeti'); Y.root.rotation.y = Math.PI; Y.play('sit+breathe'); Y.update(0); g.add(Y.root); /* Tripo 설인 (#262, casemodels.js). 모델 앞(+z)이 더미 쪽(-z)을 보게 */
    const tying = lump([[new THREE.IcosahedronGeometry(0.42, 1), 0, 0.42, -1.25, 0, 0, 0, 1, 0.9, 1], [new THREE.IcosahedronGeometry(0.12, 0), 0, 0.92, -1.25]], '#9fabb3'); g.add(tying);
    const junk = [[-0.5, -1.9, '#b9c0c6', 0], [0.1, -2.05, '#4f9a6a', 1], [0.55, -1.75, '#c89a5e', 2], [-0.15, -1.6, '#d0453a', 0], [0.35, -2.25, '#b9c0c6', 1], [-0.6, -2.3, '#3a78c0', 2]].map(([x, z, c, k]) => {
      const geo = k === 0 ? new THREE.CylinderGeometry(0.09, 0.09, 0.24, 7) : k === 1 ? new THREE.CylinderGeometry(0.08, 0.1, 0.34, 7) : new THREE.BoxGeometry(0.3, 0.2, 0.24);
      const m = lump([[geo, x, 0.12, z, k === 1 ? Math.PI / 2 : 0, x * 3, 0]], c); g.add(m); return m;
    });
    const pile = lump([[0, 0], [0.75, 0.1], [0.35, 0.7], [1.1, 0.75]].flatMap(([dx, dz], i) => [[new THREE.IcosahedronGeometry(0.42, 1), -1.9 - dx, 0.38 + (i === 3 ? 0.62 : 0), -0.4 + dz, 0, i, 0, 1, 0.9, 1], [new THREE.IcosahedronGeometry(0.12, 0), -1.9 - dx, 0.85 + (i === 3 ? 0.62 : 0), -0.4 + dz]]), '#9fabb3'); g.add(pile);
    const bags = [[-1.55, 0.95, 0.6], [-2.3, 1.0, 0.55], [-1.95, 1.62, 0.15]].map(([x, y, z]) => { const m = lump([[new THREE.IcosahedronGeometry(0.4, 1), 0, 0, 0, 0, x, 0, 1, 0.9, 1], [new THREE.IcosahedronGeometry(0.12, 0), 0, 0.44, 0]], '#9fabb3'); m.position.set(x, y - 0.6, z - 0.4); g.add(m); return m; });
    const sm = (a, b, u) => { const t = Math.max(0, Math.min(1, (u - a) / (b - a))); return t * t * (3 - 2 * t); };
    let lastT = 0;
    g.userData.anim = (u, t = 0) => {
      const tie = sm(0.08, 0.14, u) * (1 - sm(0.78, 0.84, u)), wave = sm(0.86, 0.92, u) * (u < 1 ? 1 : 0); /* 끝에 뒤돌아보지 않고 한 손만 듦 */
      Y.near(u < 1); Y.play(wave > 0.5 ? 'sit+wave' : tie > 0.5 ? 'sit+tie' : 'sit+breathe');
      const dt = Math.min(0.1, Math.max(0, t - lastT)); lastT = t; Y.update(u < 1 ? dt : 1);
      junk.forEach((m, i) => { m.visible = u < 0.2 + i * 0.09; });
      bags.forEach((m, i) => { const k = sm(0.3 + i * 0.16, 0.38 + i * 0.16, u); m.visible = k > 0; m.position.y = [0.95, 1.0, 1.62][i] - 0.6 + (1 - k) * 0.5; });
      tying.visible = u < 0.8;
    };
    g.userData.anim(1);
    return g;
  },
};
/* ---------- 사건 4 '굼부리 괴물' (#235) ---------- */
const fogMat = () => (MATS.fog ||= new THREE.MeshBasicMaterial({ color: '#e9ecef', transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide }));
const NECK_S = 26; // 호스 모델(높이 0.86) → 약 22m
B.neck = () => {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  /* #262: 긴 목 = Tripo 호스(casemodels.js 'hose', 아치 끝 나팔 입이 '머리'). 크게 키워 약 22m, 꿈틀거림. 그림자는 안 드리움(안개 속 실루엣) */
  const H = caseModel('hose', { shadow: false }); H.root.scale.setScalar(NECK_S); H.play('wriggle'); body.add(H.root);
  // 안개: 낮게 깔린 얇은 원판 셋 (투명 한 덩어리). 사건 장면에서 걷힘 (userData.fog)
  const fog = new THREE.Mesh(mergeGeometries([[16, 1.2], [12, 3.4], [9, 6.2]].map(([r, y]) => { const c = new THREE.CircleGeometry(r, 28); c.rotateX(-Math.PI / 2); c.translate(0, y, 0); return c; })), fogMat());
  fog.renderOrder = 2; g.add(fog);
  g.userData.body = body; g.userData.fog = fog; g.userData.model = H;
  // 솟았다 내려감: 주기 14초 중 6초는 위(목이 안개 위로), 나머지는 안개 아래로 가라앉음. 위에 있는 동안 꿈틀
  let last = 0;
  g.userData.tick = (t) => { const k = (t % 14) / 14, up = k < 0.43 ? Math.sin(Math.min(1, k / 0.43) * Math.PI) : 0; body.position.y = -22 + 22 * Math.min(1, up * 1.6);
    const dt = Math.min(0.1, Math.max(0, t - last)); last = t; if (body.position.y > -21.5) H.update(dt); };
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
  const heap = new THREE.Group(); /* 새 더미: 검은 봉지 무더기 + 캔·병 (셋 덩어리) */
  heap.add(lump([[new THREE.DodecahedronGeometry(0.9, 0), 0, 0.5, 0, 0, 0, 0, 1, 0.8, 1], [new THREE.DodecahedronGeometry(0.7, 0), 1.1, 0.4, 0.4, 0.4, 0, 0], [new THREE.DodecahedronGeometry(0.6, 0), -0.9, 0.35, 0.6, 0, 0.7, 0], [new THREE.DodecahedronGeometry(0.55, 0), 0.2, 0.3, -1.0]], '#34363b'));
  heap.add(lump([[new THREE.CylinderGeometry(0.14, 0.14, 0.4, 7), 0.6, 1.1, 0.2, 1.2, 0, 0.4], [new THREE.CylinderGeometry(0.14, 0.14, 0.4, 7), -0.4, 0.9, -0.5, 0.2, 0, 1.3], [new THREE.CylinderGeometry(0.14, 0.14, 0.4, 7), 1.4, 0.7, -0.2, 0, 0, 1.5]], '#b9c0c6'));
  heap.add(lump([[new THREE.CylinderGeometry(0.13, 0.16, 0.55, 7), -0.2, 1.25, 0.3, 0.9, 0.3, 0], [new THREE.CylinderGeometry(0.13, 0.16, 0.55, 7), 0.9, 0.9, 0.9, 0, 0, 1.2]], '#4f9a6a'));
  heap.scale.setScalar(0.001); g.add(heap);
  g.userData = { pour, heap, base };
  return g;
};
export const propKinds = Object.keys(B);
export function buildProp(kind) { const f = B[kind]; return f ? f() : null; }

/* ---------- 대면 장면 (face.scene, game/cases.js 의 숨어 보기 틀을 빌려 씀) ---------- */
// begin(ctx) → st · tick(st, u, T, ctx) · cam(st, u, T, ctx) → { pos, look } (없으면 숨어 보기 카메라) · end(st, ctx)
// ctx = { scene, see: 목격 자리 Vector3, face: 대면 자리 Vector3, seeRoot: 목격 모양 root, blocked(x, z, r), groundAt(x, z) }
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
      /* 카메라 자리: 가운데에서 대면 자리 쪽으로 D m. 그 줄에 나무·바위가 있으면 둘레로 돌려 빈 쪽 (ctx.blocked) */
      const D = 14, a0 = Math.atan2(ctx.face.x - ctx.see.x, ctx.face.z - ctx.see.z); let cp = null;
      for (let i = 0; i < 12 && !cp; i++) { const an = a0 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.5, dx = Math.sin(an), dz = Math.cos(an); let okRay = true; for (let d = 2; d <= D + 2; d += 1.5) if (ctx.blocked?.(ctx.see.x + dx * d, ctx.see.z + dz * d, d > D - 3 ? 5 : 2.2)) { okRay = false; break; } /* 카메라 둘레는 넓게 (나뭇가지에 가림) */ if (okRay) cp = [ctx.see.x + dx * D, ctx.see.z + dz * D]; }
      if (!cp) cp = [ctx.see.x + Math.sin(a0) * D, ctx.see.z + Math.cos(a0) * D];
      return { cp, root: ctx.seeRoot, h, fog, body, op: fog?.material.opacity ?? 0.5, by: body?.position.y ?? 0 };
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
      const s = ctx.see, up = sm(cl((u - T * 0.3) / (T * 0.18))) * (1 - sm(cl((u - T * 0.55) / (T * 0.12))));
      const [px, pz] = st.cp, gy = ctx.groundAt ? ctx.groundAt(px, pz) : s.y;
      return { pos: new THREE.Vector3(px, Math.max(gy, s.y) + 4 + up * 45, pz), /* 호스를 따라 카메라도 올라감 (나뭇가지 위로) */ look: new THREE.Vector3(s.x, s.y + 3 + up * 110, s.z) };
    },
    end(st, ctx) {
      ctx.scene.remove(st.h); st.h.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
      if (st.fog) st.fog.material.opacity = st.op;
      if (st.body) st.body.position.y = st.by;
      if (st.root) st.root.userData.hold = false;
    },
  },
};
