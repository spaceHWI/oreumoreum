// 사건 3 '맨 인 블랙' 대면 장면의 배우 (#234): 우두머리를 쫓아낸 뒤 능선에 선 검은 양복에게 다가가면 (game/cases.js beginActor → late.caseActors.suit)
// 모양은 Tripo 검은 양복 모델 caseModel('mib') (#264, 예전엔 NPC 몸 runner.js 에 검은 양복 옷). 맨발: 모델의 구두 부분(모델 y 0.072 아래)을 셰이더에서 살색으로 칠함(casemodels.js BARE). 구두의 주름이 발가락처럼 읽혀 따로 붙이지 않음
// 흐름(장면 길이 T, 자막은 c3.js face.lines): 0~50% 마주 서서 말함(talk, 고개는 나) → 50% 깊이 숙인 인사(bow, 허리에서만), 카메라가 발치로 내려가 맨발을 보여 줌
//   → 숙인 채 종종걸음으로 조금 물러남(bow+walk) → 75% 카메라가 나를 보는 사이 사라짐 → 빈자리
// 장면 동안만 만들고 끝나면 치움. 내 화면에서만
import * as THREE from 'three';
import { caseModel } from '../casemodels.js';
import { groundLift } from './caseprops.js';
import { height } from '../world.js';
import { late } from './state.js';
import { scene } from './scene.js';
import { player } from './place.js';

const SUIT = { gap: 2.6, bow: [0.5, 0.75], back: 0.66, backM: 0.45, gone: 0.75 }; /* back: 이때부터 숙인 채 backM m 물러남 */
const v = new THREE.Vector3();
const actor = {
  begin(run, sp) {
    const at = sp.face, m = caseModel('mib'); m.near(true); m.play('talk');
    /* 내가 설 자리: 검은 양복과 우두머리 터(목격 자리 쪽이 아닌 지금 내가 온 쪽) 사이 */
    let dx = player.pos.x - at.x, dz = player.pos.z - at.z, L = Math.hypot(dx, dz);
    if (L < 0.5) { dx = 0; dz = 1; L = 1; }
    dx /= L; dz /= L;
    const px = at.x + dx * SUIT.gap, pz = at.z + dz * SUIT.gap;
    player.pos.set(px, height(px, pz), pz); player.visY = player.pos.y; player.heading = Math.atan2(at.x - px, at.z - pz);
    m.root.position.copy(at); m.root.rotation.y = Math.atan2(px - at.x, pz - at.z); m.update(0); scene.add(m.root);
    run.suit = { m, at: at.clone(), dx, dz, lift: groundLift(at.x, at.z, at.y) }; /* 그려진 땅에 발이 묻히지 않게 */
  },
  tick(run, dt) {
    const s = run.suit; if (!s) return;
    const u = run.u / run.len, m = s.m;
    m.root.visible = u < SUIT.gone;
    if (u < SUIT.bow[0]) { m.play('talk'); m.lookAt(player.pos); }
    else { m.lookAt(null); m.play(u < SUIT.back ? 'bow' : 'bow+walk'); }
    const k = Math.max(0, Math.min(1, (u - SUIT.back) / (SUIT.gone - SUIT.back))) * SUIT.backM, x = s.at.x - s.dx * k, z = s.at.z - s.dz * k; /* 숙인 채 뒷걸음 */
    m.root.position.set(x, height(x, z) + s.lift, z);
    m.update(dt);
  },
  cam(run, dt, { camTarget, ease, height: h }) {
    const s = run.suit; if (!s) return;
    const u = run.u / run.len, a = s.at, sx = -s.dz, sz = s.dx; /* 옆 방향 */
    if (u < SUIT.bow[0]) { /* 옆에서 둘을 함께 */
      const cx = a.x + s.dx * 1.3 + sx * 4.2, cz = a.z + s.dz * 1.3 + sz * 4.2;
      camTarget.pos.set(cx, h(cx, cz) + 1.7, cz); camTarget.look.set(a.x + s.dx * 0.9, a.y + 1.5, a.z + s.dz * 0.9);
    } else if (u < SUIT.gone) { /* 발치: 구두가 없다 */
      const cx = a.x + s.dx * 1.2 + sx * 1.1, cz = a.z + s.dz * 1.2 + sz * 1.1; /* 위에서 내려다봐 풀에 가리지 않게 */
      camTarget.pos.set(cx, Math.max(h(cx, cz), a.y) + 1.25, cz); camTarget.look.set(a.x + s.dx * 0.3, a.y + s.lift + 0.1, a.z + s.dz * 0.3);
    } else { /* 내 얼굴 쪽에서 → 빈자리 */
      v.set(player.pos.x - s.dx * 1.7 + sx * 0.9, 0, player.pos.z - s.dz * 1.7 + sz * 0.9); /* 둘 사이에서 내 얼굴 (검은 양복은 카메라 뒤) */
      const back = u > SUIT.gone + 0.1;
      if (back) { const cx = player.pos.x + s.dx * 3.6 + sx * 1.4, cz = player.pos.z + s.dz * 3.6 + sz * 1.4; camTarget.pos.set(cx, h(cx, cz) + 2.4, cz); camTarget.look.set(a.x, a.y + 1, a.z); }
      else { camTarget.pos.set(v.x, h(v.x, v.z) + 1.6, v.z); camTarget.look.set(player.pos.x, player.pos.y + 1.4, player.pos.z); }
    }
    const k = u < SUIT.bow[0] ? 0 : u < SUIT.gone ? 1 : u < SUIT.gone + 0.1 ? 2 : 3, cut = run.cut !== k; run.cut = k; /* 장면이 바뀌면 끊어 붙임 */
    ease(dt, cut, 3);
  },
  end(run) {
    const s = run.suit; if (!s) return; run.suit = null;
    s.m.dispose(); /* 모델 자료(geometry·재질)는 사건 모델끼리 같이 쓰므로 버리지 않음 */
  },
};
late.caseActors = { ...(late.caseActors || {}), suit: actor };
