// 사건 3 '맨 인 블랙' (#234): 대면 장면 'suit' (caseprops.js SCENES 에 더함) · 목격 모양 'suits' 의 '뒤돌아보면 없다'
// 대면: 능선 우두머리를 쫓아낸 뒤 face 자리에 검은 양복(멀리선 MYST.back 실루엣, caseprops.js suit)이 서고, 다가가 F → 이 장면
//   가까이서는 Tripo 검은 양복 모델(#262 casemodels.js 'mib') (바짓단 아래 신발 없는 맨발, caseprops.js mibBody). 장면 동안만 만들고 끝나면 치움. 내 화면에서만
//   흐름(장면 길이 T, 자막 c3.js face.lines): 0~50% 마주 서서 말함 → 50~75% 깊이 숙인 인사, 카메라가 발치로 내려가 맨발 → 75% 내 얼굴 쪽으로 돌리는 사이 사라짐 → 빈자리
// 목격: 능선에 선 검은 양복 둘은 한 번 화면에 들어온 뒤 화면 밖으로 나가면(SUIT.lookAway 초) 사라짐. SUIT.reset m 넘게 멀어지면 다시 섬
// 파일 순서는 game/cases.js 뒤 (src/modules.js)
import * as THREE from 'three';
import { camera } from './scene.js';
import { player } from './place.js';
import { groundAt } from '../world.js';
import { SCENES, PROP_HOOK, mibBody, MIB_LIFT } from './caseprops.js';

const SUIT = { gap: 2.6, bowX: 0.85, bow: [0.5, 0.75], gone: 0.75, lookAway: 0.6, reset: 70, seeR: 40 };

/* ---------- 목격: 뒤돌아보면 없다 ---------- */
const fr = new THREE.Frustum(), pm = new THREE.Matrix4(), box = new THREE.Box3();
function onScreen(o) { pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); fr.setFromProjectionMatrix(pm); box.setFromObject(o); return fr.intersectsBox(box); }
PROP_HOOK.suits = (g, t, dt) => {
  const u = g.userData, d = Math.hypot(player.pos.x - g.position.x, player.pos.z - g.position.z);
  if (d > SUIT.reset) { u.gone = false; u.seen = false; u.off = 0; }
  const body = u.body; if (!body) return;
  body.visible = !u.gone;
  if (u.gone) return;
  const vis = onScreen(body);
  if (vis && d < SUIT.seeR) { u.seen = true; u.off = 0; } else if (u.seen && !vis) { u.off = (u.off || 0) + dt; if (u.off > SUIT.lookAway) u.gone = true; }
};

/* ---------- 대면 장면 ---------- */
const sm = (a) => a * a * (3 - 2 * a);
SCENES.suit = {
  begin(ctx) {
    const at = ctx.face, M = mibBody(); M.near(true); M.play('talk');
    /* 내가 설 자리: 검은 양복 앞, 지금 내가 온 쪽 */
    let dx = player.pos.x - at.x, dz = player.pos.z - at.z, L = Math.hypot(dx, dz);
    if (L < 0.5) { dx = 0; dz = 1; L = 1; }
    dx /= L; dz /= L;
    M.root.position.set(at.x, groundAt(at.x, at.z) + MIB_LIFT, at.z); /* 밟는 높이 (길의 디딤판 등) */ M.root.rotation.y = Math.atan2(dx, dz); ctx.scene.add(M.root);
    if (ctx.faceRoot) { ctx.faceRoot.userData.hold = true; ctx.faceRoot.visible = false; } /* 대면 자리 모양은 장면 동안 숨김 */
    return { M, h: M.root, at: M.root.position.clone(), dx, dz, placed: false };
  },
  tick(st, u, T, ctx) {
    const at = st.at, k = u / T, b = SUIT.bow;
    if (!st.placed) { /* 숨어 보기 틀이 나를 수풀 곁에 쪼그려 앉힌 뒤라, 첫 프레임에 마주 세움 */
      const px = at.x + st.dx * SUIT.gap, pz = at.z + st.dz * SUIT.gap, py = groundAt(px, pz);
      player.pos.set(px, py, pz); player.visY = py; player.heading = Math.atan2(at.x - px, at.z - pz); player.pose = 'move'; st.placed = true;
    }
    st.h.visible = k < SUIT.gone;
    const dt = Math.min(0.1, Math.max(0.001, u - (st.u0 ?? u - 1 / 60))); st.u0 = u;
    if (k >= b[0]) st.M.play('stand');
    st.M.update(dt);
    const bow = sm(Math.min(1, Math.max(0, (k - b[0]) * T / 0.9))); /* 깊이 숙인 인사 (일어나지 않음) */
    if (bow > 0) { const B = st.M.bones; B.chest.rotation.x += bow * SUIT.bowX; B.head.rotation.x += bow * 0.3; }
  },
  cam(st, u, T, ctx) {
    const k = u / T, a = st.at, sx = -st.dz, sz = st.dx, h = ctx.groundAt, p = player.pos; /* sx·sz 옆 방향 */
    if (k < SUIT.bow[0]) { /* 옆에서 둘을 함께 */
      const cx = a.x + st.dx * 1.3 + sx * 4.2, cz = a.z + st.dz * 1.3 + sz * 4.2;
      return { pos: new THREE.Vector3(cx, h(cx, cz) + 1.7, cz), look: new THREE.Vector3(a.x + st.dx * 0.9, a.y + 1.3, a.z + st.dz * 0.9) };
    }
    if (k < SUIT.gone) { /* 발치: 구두가 없다 (위에서 내려다봐 풀에 가리지 않게) */
      const cx = a.x + st.dx * 1.2 + sx * 1.1, cz = a.z + st.dz * 1.2 + sz * 1.1;
      return { pos: new THREE.Vector3(cx, Math.max(h(cx, cz), a.y) + 1.25, cz), look: new THREE.Vector3(a.x + st.dx * 0.15, a.y + 0.05, a.z + st.dz * 0.15) };
    }
    const e = sm(Math.min(1, (k - SUIT.gone) / 0.12)); /* 내 얼굴 쪽에서 → 등 뒤로 물러나 빈자리 */
    const fx = p.x - st.dx * 1.7 + sx * 0.9, fz = p.z - st.dz * 1.7 + sz * 0.9, bx = p.x + st.dx * 3.6 + sx * 1.4, bz = p.z + st.dz * 3.6 + sz * 1.4;
    const cx = fx + (bx - fx) * e, cz = fz + (bz - fz) * e;
    const look = new THREE.Vector3(p.x + (a.x - p.x) * e, p.y + 1.4 - 0.4 * e, p.z + (a.z - p.z) * e);
    return { pos: new THREE.Vector3(cx, h(cx, cz) + 1.6 + 0.8 * e, cz), look };
  },
  end(st, ctx) {
    st.M.dispose(); /* 모델 자료는 다른 것과 같이 씀 */
    if (ctx.faceRoot) ctx.faceRoot.userData.hold = false;
  },
};
