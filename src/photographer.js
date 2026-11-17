// 사진사 NPC (#70): 정상 표지석 근처 전망 좋은 곳에 삼각대를 세워 두고 서 있음
// - 차림(본인 동의, 이슈 코멘트): 뒤로 묶은 긴 머리, 흰 선바이저, 파란 바람막이 위 검은 러닝 조끼(등에 작은 배낭), 검은 레깅스, 러닝화,
//   한 손에 짐벌 카메라, 목에도 카메라. 비 오는 날에는 노란 우비. 얼굴·몸은 우리 캐릭터 그대로(옷만 입힘)
// - 사진은 삼각대 카메라 자리에서 찍음 (main.js 가 camPos·camLook 으로 카메라를 옮김)
// - 수치는 balance.js PHOTOG
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { TEXCS } from './boot.js';
import { gradHard } from './toon.js';
import { ACCESSORIES } from './gear.js';
import { CLOTH_BUILD } from './clothes.js';
import { PHOTOG } from './balance.js';

// ---- 사진사 전용 장비 (npc: true → 옷장·상점 목록에 안 나옴). 좌표는 모델 기본 자세(키 0.98) 기준 ----
const M = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
const G = (...ms) => { const g = new THREE.Group(); ms.flat(3).forEach((m) => m && g.add(m)); return g; };
const HAND = [-0.43, 0.505, 0.045]; // 오른손 (gear.js 와 같음)
const smallCam = (mat, s = 1) => { // 작은 카메라: 몸통 + 렌즈(+z)
  const body = mat('cam', '#26272c'), lens = mat('lens', '#3d4250'), glass = mat('glass', '#7fb8e8');
  const l = M(new THREE.CylinderGeometry(0.022 * s, 0.024 * s, 0.03 * s, 12), lens, 0, 0, 0.032 * s); l.rotation.x = Math.PI / 2;
  const gl = M(new THREE.CircleGeometry(0.017 * s, 12), glass, 0, 0, 0.048 * s);
  return G(M(new RoundedBoxGeometry(0.075 * s, 0.05 * s, 0.04 * s, 2, 0.01 * s), body), l, gl, M(new THREE.BoxGeometry(0.02 * s, 0.012 * s, 0.02 * s), body, -0.02 * s, 0.03 * s, 0));
};
Object.assign(ACCESSORIES, {
  // 흰 선바이저 + 뒤로 묶은 머리(머리끈·꼬리). 머리는 '짧은 머리'(hat:short) 위에 얹음
  'hat:z-visor': { slot: 'hat', label: '선바이저', bone: 'head', hide: ['hat'], npc: true,
    build: (mat) => { const W = mat('main', '#f6f4ee'), H = mat('hair', '#2a221c'), T = mat('tie', '#e2683c');
      const band = M(new THREE.CylinderGeometry(0.262, 0.262, 0.05, 26, 1, true), W, 0, 0.82, 0.04); band.material.side = THREE.DoubleSide;
      const brim = M(new THREE.CylinderGeometry(0.22, 0.22, 0.022, 20, 1, false, -Math.PI / 2, Math.PI), W, 0, 0.815, 0.2); brim.rotation.x = 0.16; brim.scale.z = 0.9;
      const tie = M(new THREE.SphereGeometry(0.04, 10, 8), T, 0, 0.8, -0.245);
      const tail = M(new THREE.CapsuleGeometry(0.055, 0.2, 4, 10), H, 0, 0.66, -0.27); tail.rotation.x = -0.35; tail.scale.set(1, 1, 0.8);
      const tip = M(new THREE.SphereGeometry(0.045, 10, 8), H, 0, 0.53, -0.31);
      return G(band, brim, tie, tail, tip); } },
  'top:z-tee': { slot: 'top', label: '긴팔', skin: true, hide: ['body'], npc: true, build: (mat) => CLOTH_BUILD.tee(mat, { long: true, main: '#3a78c8', acc: '#2b5c9e' }) },
  'bottom:z-tights': { slot: 'bottom', label: '레깅스', skin: true, hide: ['body'], npc: true, build: (mat) => CLOTH_BUILD.long(mat, { kind: 'long', main: '#24262c', acc: '#3a3d45' }) },
  'jacket:z-wind': { slot: 'jacket', label: '파란 바람막이', skin: true, npc: true, build: (mat) => CLOTH_BUILD.jacket(mat, { main: '#3a78c8', acc: '#f2f2f2' }) },
  'jacket:z-rain': { slot: 'jacket', label: '노란 우비', skin: true, npc: true, build: (mat) => CLOTH_BUILD.jacket(mat, { main: '#f4cf3c', acc: '#e0a92a', hood: true, cuffs: true, puff: true }) },
  // 검은 러닝 조끼 + 등에 작은 배낭 + 목에 건 카메라
  'vest:z-run': { slot: 'vest', label: '러닝 조끼', skin: true, npc: true,
    build: (mat) => { const v = CLOTH_BUILD.vest(mat, { main: '#22242a', acc: '#3a3d45', pockets: 2 });
      const pack = M(new RoundedBoxGeometry(0.24, 0.25, 0.09, 2, 0.035), mat('pack', '#2e3138'), 0, 0.42, -0.19);
      const strap = M(new THREE.TorusGeometry(0.13, 0.008, 4, 20), mat('strap', '#1c1d22'), 0, 0.53, 0.06); strap.rotation.x = Math.PI / 2 - 0.5;
      const cam = smallCam(mat, 1.15); cam.position.set(0, 0.43, 0.26);
      return G(v, pack, strap, cam); } },
  // 오른손 짐벌: 손잡이(+y 위로) 끝에 작은 카메라
  'hand:z-gimbal': { slot: 'hand', label: '짐벌 카메라', bone: 'armR', npc: true,
    build: (mat) => { const grip = mat('grip', '#2b2d33'), arm = mat('arm', '#9aa0a8');
      const handle = M(new THREE.CylinderGeometry(0.018, 0.02, 0.13, 10), grip, 0, 0.04, 0);
      const yoke = M(new THREE.BoxGeometry(0.012, 0.06, 0.012), arm, 0.03, 0.13, 0);
      const cam = smallCam(mat, 0.85); cam.position.set(0, 0.16, 0.02);
      const inner = G(handle, yoke, cam); inner.rotation.x = 0.25;
      const outer = G(inner); outer.rotation.z = -Math.PI / 2; outer.position.set(...HAND); return outer; } },
});
const GEAR = (rain) => ({ hair: 'hat:short', hat: 'hat:z-visor', face: 'face:none', back: 'back:empty', top: 'top:z-tee', bottom: 'bottom:z-tights', vest: rain ? 'vest:none' : 'vest:z-run', jacket: rain ? 'jacket:z-rain' : 'jacket:z-wind', socks: 'socks:none', shoes: 'shoes:s2', hand: 'hand:z-gimbal' });

export function createPhotographer({ scene, social, P, out, tan, spot, height, buildRunner, outfit, col, low, rnd = Math.random }) {
  const mid = P.stone.clone().lerp(spot, 0.5); mid.y = height(mid.x, mid.z);
  const look = mid.clone(); look.y += 1.7; // 사진 가운데 (표지석과 사진 자리 사이, 가슴 높이)
  // 삼각대: 바깥쪽으로 dist, 옆으로 side. 카메라 높이는 땅 + camH, 표지석 쪽보다 너무 낮으면 다리를 늘림
  const tp = mid.clone().addScaledVector(out, PHOTOG.dist).addScaledVector(tan, PHOTOG.side); tp.y = height(tp.x, tp.z);
  const leg = Math.min(PHOTOG.maxLeg, Math.max(PHOTOG.camH, mid.y + PHOTOG.minH - tp.y));
  const head = new THREE.Vector3(tp.x, tp.y + leg, tp.z);
  const dir = look.clone().sub(head).normalize();
  const camPos = head.clone().addScaledVector(dir, 0.45); // 렌즈 앞 (삼각대 자체는 안 찍힘)
  const tm = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: gradHard });
  const tripod = new THREE.Group(); tripod.position.copy(tp); tripod.rotation.y = Math.atan2(dir.x, dir.z); scene.add(tripod);
  { const legM = tm('#3a3c42'), body = tm('#26272c'), lensM = tm('#3d4250');
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + Math.PI, fx = Math.sin(a) * 0.55, fz = Math.cos(a) * 0.55, fy = height(tp.x + fx, tp.z + fz) - tp.y;
      const from = new THREE.Vector3(0, leg - 0.12, 0), to = new THREE.Vector3(fx, fy, fz), d = to.clone().sub(from), L = d.length();
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, L, 5), legM); m.position.copy(from).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); tripod.add(m); }
    const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.12, 8), legM); hd.position.y = leg - 0.08; tripod.add(hd);
    const cb = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.32, 0.26, 2, 0.05), body); cb.position.y = leg + 0.1; tripod.add(cb);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.26, 12), lensM); lens.rotation.x = Math.PI / 2; lens.position.set(0, leg + 0.1, 0.24); tripod.add(lens);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.1), body); top.position.set(-0.1, leg + 0.29, 0); tripod.add(top);
    tripod.traverse((o) => { if (o.isMesh) { o.castShadow = !low; o.receiveShadow = true; } }); }
  // 사진사: 삼각대 옆, 사진 자리를 봄
  const pos = tp.clone().addScaledVector(tan, PHOTOG.stand); pos.y = height(pos.x, pos.z);
  const run = buildRunner();
  let rain = false;
  const dress = () => run.apply({ ...outfit, shoes: { ...outfit.shoes, color: '#f2f2f2' }, gear: GEAR(rain) });
  dress(); run.root.position.copy(pos); scene.add(run.root);
  const faceTo = (p) => Math.atan2(p.x - pos.x, p.z - pos.z);
  let heading = faceTo(spot); run.root.rotation.y = heading;
  if (col) { col.add(pos.x, pos.z, 0.6); col.add(tp.x, tp.z, 0.5); }
  // 이름표
  const label = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
    g.font = '700 28px "Noto Sans KR", sans-serif'; g.fillStyle = 'rgba(51,64,42,.6)'; g.fillRect(0, 0, 256, 64); g.fillStyle = '#fbf6e6'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(PHOTOG.name, 128, 34);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = TEXCS;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, opacity: 0 })); s.scale.set(3.2, 0.8, 1); s.position.y = 2.85; run.root.add(s); return s; })();
  const st = { pose: 'move', t: 0, greetCd: 6, beckon: 0 };
  const say = (text) => social?.showBubble('npc-photog', run.root, text, 3.5);
  function beckon() { st.beckon = PHOTOG.beckon; st.pose = 'wave'; st.t = 0; say('여기 서 보세요!'); }
  function setRain(on) { on = !!on; if (on === rain) return; rain = on; dress(); }
  function update(dt, player, { shooting = false, hide = false } = {}) {
    const d = player.pos.distanceTo(pos);
    run.root.visible = !hide; label.visible = !hide && d < 18;
    if (d > PHOTOG.animR && !shooting) return;
    st.t += dt; st.greetCd -= dt;
    const op = d < 10 ? 1 : d < 18 ? 1 - (d - 10) / 8 : 0; label.material.opacity = op;
    if (st.beckon > 0) { st.beckon -= dt; if (st.beckon <= 0) { st.pose = 'move'; st.t = 0; } }
    else if (!shooting && d < PHOTOG.greetR && st.greetCd <= 0) { st.greetCd = PHOTOG.greetCd + rnd() * PHOTOG.greetCd; st.pose = 'wave'; st.t = 0; st.beckon = 2.2; say(PHOTOG.lines[Math.floor(rnd() * PHOTOG.lines.length)]); }
    // 찍는 동안엔 사진 자리를, 아니면 가까이 온 사람을 봄
    const want = shooting ? faceTo(spot) : d < PHOTOG.greetR ? faceTo(player.pos) : faceTo(spot);
    let dh = want - heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); heading += dh * Math.min(1, dt * 5); run.root.rotation.y = heading;
    run.animate(dt, { speed: 0, running: false, pose: st.pose, t: st.t, breath: 0 });
  }
  return { pos, camPos, camLook: look, tripod, runner: run, beckon, setRain, update, get rain() { return rain; }, state: st };
}
