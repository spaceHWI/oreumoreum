// 사건 3 '맨 인 블랙' 대면 장면의 배우 (#234): 우두머리를 쫓아낸 뒤 능선에 선 검은 양복에게 다가가면 (game/cases.js beginHide → late.caseActors.suit)
// 멀리서는 뒤돌아보면 실루엣(caseprops.js suit), 가까이서는 지금 NPC 몸(runner.js)에 검은 양복. 구두 대신 맨발
// 흐름(장면 길이 T, 자막은 c3.js face.lines): 0~50% 마주 서서 말함 → 50~75% 깊이 숙인 인사, 카메라가 발치로 내려가 맨발을 보여 줌 → 75% 카메라가 나를 보는 사이 사라짐 → 빈자리
// 새 모델 없음. 장면 동안만 만들고 끝나면 치움. 내 화면에서만
import * as THREE from 'three';
import { buildRunner, DEFAULT_OUTFIT } from '../runner.js';
import { ACCESSORIES } from '../gear.js';
import { clothAcc } from '../clothes.js';
import { height } from '../world.js';
import { late } from './state.js';
import { scene } from './scene.js';
import { player } from './place.js';

const SUIT = { shirt: '#f2efe6', coat: '#1c1e22', pants: '#1c1e22', feet: '#f1dcc2', gap: 2.6, bow: [0.5, 0.75], gone: 0.75 };
/* 이 장면에만 쓰는 겉모습 (npc: 옷장·멀티 목록에 없음): 검은 양복 윗옷 · 발 색(양말 칸, 거의 안 보이는 높이) · 신발 없음 */
ACCESSORIES['jacket:x-mib'] = { ...clothAcc({ slot: 'jacket', name: '검은 양복', tier: 0 }, { kind: 'jacket', main: SUIT.coat, acc: '#2a2c31', cuffs: true }), npc: true };
ACCESSORIES['socks:x-mib'] = { ...clothAcc({ slot: 'socks', name: '맨발', tier: 0 }, { kind: 'socks', main: SUIT.feet, acc: SUIT.feet, h: 0.01 }), npc: true };
ACCESSORIES['shoes:x-bare'] = { slot: 'shoes', label: '맨발', skin: true, npc: true, build: () => new THREE.Group() };
const v = new THREE.Vector3();
const actor = {
  begin(run, sp) {
    const at = sp.face, o = DEFAULT_OUTFIT, r = buildRunner();
    r.apply({ ...o, shirt: { ...o.shirt, color: SUIT.shirt }, pants: { ...o.pants, type: 'long', color: SUIT.pants }, gear: { hair: 'hat:short', hat: 'hat:none', top: 'top:base', bottom: 'bottom:long', jacket: 'jacket:x-mib', socks: 'socks:x-mib', shoes: 'shoes:x-bare', back: 'back:none', hand: 'hand:none' } });
    /* 내가 설 자리: 검은 양복과 우두머리 터(목격 자리 쪽이 아닌 지금 내가 온 쪽) 사이 */
    let dx = player.pos.x - at.x, dz = player.pos.z - at.z, L = Math.hypot(dx, dz);
    if (L < 0.5) { dx = 0; dz = 1; L = 1; }
    dx /= L; dz /= L;
    const px = at.x + dx * SUIT.gap, pz = at.z + dz * SUIT.gap;
    player.pos.set(px, height(px, pz), pz); player.visY = player.pos.y; player.heading = Math.atan2(at.x - px, at.z - pz);
    r.root.position.copy(at); r.root.rotation.y = Math.atan2(px - at.x, pz - at.z); scene.add(r.root);
    run.suit = { r, at: at.clone(), dx, dz };
  },
  tick(run, dt) {
    const s = run.suit; if (!s) return;
    const u = run.u / run.len, b = SUIT.bow;
    s.r.root.visible = u < SUIT.gone;
    const over = u >= b[0] ? { id: 'insa', t: Math.min(0.8, (u - b[0]) * run.len * 0.9), dur: 1.6 } : null; /* 숙인 채 멈춤 (일어나지 않음) */
    s.r.animate(dt, { speed: 0, running: false, pose: 'move', t: run.u, air: false, jumpV: 0, over });
  },
  cam(run, dt, { camTarget, ease, height: h }) {
    const s = run.suit; if (!s) return;
    const u = run.u / run.len, a = s.at, sx = -s.dz, sz = s.dx; /* 옆 방향 */
    if (u < SUIT.bow[0]) { /* 옆에서 둘을 함께 */
      const cx = a.x + s.dx * 1.3 + sx * 4.2, cz = a.z + s.dz * 1.3 + sz * 4.2;
      camTarget.pos.set(cx, h(cx, cz) + 1.7, cz); camTarget.look.set(a.x + s.dx * 0.9, a.y + 1.3, a.z + s.dz * 0.9);
    } else if (u < SUIT.gone) { /* 발치: 구두가 없다 */
      const cx = a.x + s.dx * 1.2 + sx * 1.1, cz = a.z + s.dz * 1.2 + sz * 1.1; /* 위에서 내려다봐 풀에 가리지 않게 */
      camTarget.pos.set(cx, Math.max(h(cx, cz), a.y) + 1.25, cz); camTarget.look.set(a.x + s.dx * 0.15, a.y + 0.05, a.z + s.dz * 0.15);
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
    scene.remove(s.r.root); /* 몸 모양은 다른 사람과 같이 쓰므로 버리지 않음 */
  },
};
late.caseActors = { ...(late.caseActors || {}), suit: actor };
