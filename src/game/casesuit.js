// 사건 3 '맨 인 블랙' (#234): 대면 장면 'suit' (caseprops.js SCENES 에 더함) · 목격 모양 'suits' 의 '뒤돌아보면 없다'
// 대면: 능선 우두머리를 쫓아낸 뒤 face 자리에 검은 양복(멀리선 MYST.back 실루엣, caseprops.js suit)이 서고, 다가가 F → 이 장면
//   가까이서는 지금 NPC 몸(runner.js)에 검은 양복. 구두 대신 맨발. 새 모델 없음, 장면 동안만 만들고 끝나면 치움. 내 화면에서만
//   흐름(장면 길이 T, 자막 c3.js face.lines): 0~50% 마주 서서 말함 → 50~75% 깊이 숙인 인사, 카메라가 발치로 내려가 맨발 → 75% 내 얼굴 쪽으로 돌리는 사이 사라짐 → 빈자리
// 목격: 능선에 선 검은 양복 둘은 한 번 화면에 들어온 뒤 화면 밖으로 나가면(SUIT.lookAway 초) 사라짐. SUIT.reset m 넘게 멀어지면 다시 섬
// 파일 순서는 game/cases.js 뒤 (src/modules.js)
import * as THREE from 'three';
import { buildRunner, DEFAULT_OUTFIT } from '../runner.js';
import { ACCESSORIES } from '../gear.js';
import { clothAcc } from '../clothes.js';
import { camera } from './scene.js';
import { player } from './place.js';
import { SCENES, PROP_HOOK } from './caseprops.js';

const SUIT = { shirt: '#f2efe6', coat: '#1c1e22', pants: '#1c1e22', feet: '#f1dcc2', gap: 2.6, bow: [0.5, 0.75], gone: 0.75, lookAway: 0.6, reset: 70, seeR: 40 };
/* 이 장면에만 쓰는 겉모습 (npc: 옷장·멀티 목록에 없음): 검은 양복 윗옷 · 발 색(양말 칸, 거의 안 보이는 높이) · 신발 없음 */
ACCESSORIES['jacket:x-mib'] = { ...clothAcc({ slot: 'jacket', name: '검은 양복', tier: 0 }, { kind: 'jacket', main: SUIT.coat, acc: '#2a2c31', cuffs: true }), npc: true };
ACCESSORIES['socks:x-mib'] = { ...clothAcc({ slot: 'socks', name: '맨발', tier: 0 }, { kind: 'socks', main: SUIT.feet, acc: SUIT.feet, h: 0.01 }), npc: true };
ACCESSORIES['shoes:x-bare'] = { slot: 'shoes', label: '맨발', skin: true, npc: true, build: () => new THREE.Group() };

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
    const at = ctx.face, o = DEFAULT_OUTFIT, r = buildRunner();
    r.apply({ ...o, hat: { ...o.hat, type: 'none' }, shirt: { ...o.shirt, color: SUIT.shirt }, pants: { ...o.pants, type: 'long', color: SUIT.pants },
      gear: { hair: 'hat:short', hat: 'hat:none', top: 'top:base', bottom: 'bottom:long', jacket: 'jacket:x-mib', socks: 'socks:x-mib', shoes: 'shoes:x-bare', back: 'back:none', hand: 'hand:none' } });
    /* 내가 설 자리: 검은 양복 앞, 지금 내가 온 쪽 */
    let dx = player.pos.x - at.x, dz = player.pos.z - at.z, L = Math.hypot(dx, dz);
    if (L < 0.5) { dx = 0; dz = 1; L = 1; }
    dx /= L; dz /= L;
    r.root.position.copy(at); r.root.rotation.y = Math.atan2(dx, dz); ctx.scene.add(r.root);
    if (ctx.faceRoot) { ctx.faceRoot.userData.hold = true; ctx.faceRoot.visible = false; } /* 실루엣은 장면 동안 숨김 */
    return { r, h: r.root, at: at.clone(), dx, dz, placed: false };
  },
  tick(st, u, T, ctx) {
    const at = st.at, k = u / T, b = SUIT.bow;
    if (!st.placed) { /* 숨어 보기 틀이 나를 수풀 곁에 쪼그려 앉힌 뒤라, 첫 프레임에 마주 세움 */
      const px = at.x + st.dx * SUIT.gap, pz = at.z + st.dz * SUIT.gap, py = ctx.groundAt(px, pz);
      player.pos.set(px, py, pz); player.visY = py; player.heading = Math.atan2(at.x - px, at.z - pz); player.pose = 'move'; st.placed = true;
    }
    st.h.visible = k < SUIT.gone;
    const over = k >= b[0] ? { id: 'insa', t: Math.min(0.8, (k - b[0]) * T * 0.9), dur: 1.6 } : null; /* 숙인 채 멈춤 (일어나지 않음) */
    const dt = Math.min(0.1, Math.max(0.001, u - (st.u0 ?? u - 1 / 60))); st.u0 = u;
    st.r.animate(dt, { speed: 0, running: false, pose: 'move', t: u, air: false, jumpV: 0, over });
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
    ctx.scene.remove(st.r.root); /* 몸 모양은 다른 사람과 같이 쓰므로 버리지 않음 */
    if (ctx.faceRoot) ctx.faceRoot.userData.hold = false;
  },
};
