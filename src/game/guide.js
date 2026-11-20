// 첫 투기꾼 안내 (#135): 튜토리얼을 마친 뒤 처음 오는 투기꾼을 보이는 곳에서 만나게 하고, 쫓아내는 법을 한 번 알려 준다 (파일 순서는 src/modules.js, 규칙은 notes/prototype-v1.md)
// 저장 save.pace.hint = { w, t }: w 0 안 봄 · 1 한 번 봄 · 2 놓쳐서 한 번 더 · 3 끝 / t 트럭 팁을 봄. 어드민 '들어오기 다시' 가 지움
// 투기꾼이 나타나면(appear) 카메라가 1.5초 그쪽을 보고, 머리 위 표시·토스트·던지기 버튼 빛남. 쫓아내면 칭찬, 버리고 가면(첫 안내 때만) 다음 투기꾼 때 한 번 더
import * as THREE from 'three';

const SPOT = { min: 25, max: 35, view: 0.75, far: 75, look: 1.5 }; // 시작 자리: 플레이어에서 25~35m, 카메라 앞 약 40° 안, 노릴 더미는 35~75m
const TXT = {
  come: '무단투기꾼이에요! 귤을 던져 쫓아내요',
  good: '잘했어요! 떨어진 귤을 주워요',
  miss: '쓰레기를 버리고 갔어요. 다음엔 귤로 쫓아내요',
  truck: '투기 트럭이 와요! 트럭은 여러 번 맞혀야 해요',
};
let markTex = null;
function mark() {
  if (!markTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    g.fillStyle = '#ff8a1f'; g.beginPath(); g.arc(32, 32, 28, 0, 6.283); g.fill(); g.fillStyle = '#fff'; g.font = '800 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 32, 35);
    markTex = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: markTex, depthTest: false, transparent: true })); s.scale.set(0.9, 0.9, 1); s.renderOrder = 20; return s;
}

export function createGuide({ dumpers, trash, player, cam, spots, save, persist, toast, state, height, rnd = Math.random }) {
  const H = () => { const p = (save.pace ||= {}); if (!p.hint || typeof p.hint !== 'object') p.hint = { w: 0, t: 0 }; return p.hint; };
  let cur = null, ctx = null, bob = 0; // cur: 지금 안내 중인 투기꾼
  const lit = (on) => { ctx ||= document.getElementById('btn-ctx'); ctx?.classList.toggle('lit', on); };
  function clear() { if (!cur) return; if (cur.mk) { cur.root.remove(cur.mk); cur.mk.material.dispose(); } cur = null; lit(false); }
  return {
    // 첫 투기꾼 자리: 카메라 앞쪽 35~75m 의 더미 하나와, 그 쪽으로 25~35m 떨어진 시작점. 없으면 null (평소처럼)
    spot() {
      if (!dumpers || !trash) return null;
      const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), taken = new Set(dumpers.list.map((d) => d.heap)), c = [];
      trash.heaps.forEach((h, i) => {
        if (taken.has(i) || !(h.n - trash.store.left(i) > 0)) return;
        const dx = h.x - player.pos.x, dz = h.z - player.pos.z, D = Math.hypot(dx, dz);
        if (D < SPOT.max + 4 || D > SPOT.far || (dx * fx + dz * fz) / D < SPOT.view) return;
        const r = SPOT.min + rnd() * (SPOT.max - SPOT.min), x = player.pos.x + dx / D * r, z = player.pos.z + dz / D * r;
        if (spots.inBounds && !spots.inBounds(x, z)) return;
        c.push({ heap: i, start: [x, z] });
      });
      return c.length ? c[Math.floor(rnd() * c.length)] : null;
    },
    // 투기꾼이 나타남. 안내했으면 true (기본 토스트는 건너뜀)
    appear(d) {
      const h = H();
      if (d.kind === 'truck') { if (h.t) return false; h.t = 1; persist(); toast(TXT.truck); return true; }
      if (h.w !== 0 && h.w !== 2) return false;
      d.guideN = h.w === 0 ? 1 : 2; h.w = h.w === 0 ? 1 : 3; persist();
      clear(); cur = d; d.mk = mark(); d.mk.position.set(0, (d.h || 2) + 1.1, 0); d.root.add(d.mk);
      state.glance = { x: d.pos.x, z: d.pos.z, t: 0, T: SPOT.look };
      lit(true); toast(TXT.come); return true;
    },
    repel(d) { if (!d || d !== cur) return false; toast(TXT.good); clear(); return true; },
    dumped(d) { if (!d || d !== cur) return false; if (d.guideN === 1) { H().w = 2; persist(); toast(TXT.miss); } clear(); return true; },
    tick(dt) {
      if (!cur) return;
      if (!dumpers.list.includes(cur)) { clear(); return; }
      if (cur.state !== 'come' && cur.state !== 'dump') lit(false);
      bob += dt; if (cur.mk) cur.mk.position.y = (cur.h || 2) + 1.1 + Math.sin(bob * 5) * 0.12;
    },
    get active() { return !!cur; },
  };
}
