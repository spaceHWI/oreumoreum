// 동굴 카메라 두 안 해 보기 (#214): 'a' 내려다보기·천장 없음 / 'b' 넓은 굴·천장 높음(어깨 뒤) / 'c' 지금
// - 바꾸기: 어드민 메뉴 '동굴 카메라' 버튼 셋, 동굴 안 왼쪽 위 어드민 전용 칩(누를 때마다 a → b → c). 고른 값은 이 기기에 (cave.js CAM_KEY)
//   동굴 안에서 바꾸면 밖(입구)으로 돌려보냄 (층 모양이 안마다 달라서). 다시 들어가면 새 안
// - 카메라·모양 자체는 cave.js(applyView·caveFrame)와 cavegen.js(caveK·caveMesh cut). 여기는 버튼·캐릭터 반투명(b)·가장자리 어둠(a)·키 화면 기준(a)
// dev: __oreum.cave.cam('a'|'b'|'c') · __oreum.cave.camInfo()
import { CAVE } from '../balance.js';
import { state, late } from './state.js';
import { $ } from './save.js';
import { camera, renderer } from './scene.js';
import { cam, followCam } from './camera.js';
import { player, runner } from './place.js';
import { toast } from './hud.js';
import { devOn } from './menu.js';
import { exitCave, CAM_KEY } from './cave.js';

const NAME = { a: '내려다보기', b: '넓은 굴', c: '지금' };
const ORDER = ['a', 'b', 'c'];

export function setCaveCam(m) {
  if (!NAME[m]) return false;
  const was = state.caveCam; state.caveCam = m;
  try { localStorage.setItem(CAM_KEY, m); } catch (e) { /* 이 기기에만 */ }
  paint();
  if (state.cave && was !== m) { exitCave(true); toast(`동굴 카메라: ${NAME[m]} · 다시 들어가 보세요`); } else toast(`동굴 카메라: ${NAME[m]}`);
  return true;
}

// ---------- 버튼 ----------
function paint() {
  document.querySelectorAll('[data-cavecam]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cavecam === state.caveCam)));
  if (chip) chip.textContent = state.caveCam === 'c' ? '지금' : state.caveCam.toUpperCase();
}
document.querySelectorAll('[data-cavecam]').forEach((b) => b.addEventListener('click', () => setCaveCam(b.dataset.cavecam)));
let chip = null;
{
  chip = document.createElement('button'); chip.type = 'button'; chip.id = 'cave-cam'; chip.className = 'btn small'; chip.hidden = true;
  chip.setAttribute('aria-label', '동굴 카메라 바꾸기 (어드민)');
  chip.addEventListener('click', () => setCaveCam(ORDER[(ORDER.indexOf(state.caveCam) + 1) % ORDER.length]));
  document.body.appendChild(chip);
}
const ring = document.createElement('div'); ring.id = 'cave-ring'; ring.hidden = true; $('view').after(ring); /* 캔버스 바로 뒤: 화면 위 버튼·글자보다 아래 */
paint();

// ---------- 캐릭터 반투명 (b): 카메라가 머리에 fadeD m 보다 가까우면 ----------
const orig = new Map();
let fadeK = 1;
function setFade(k) {
  if (Math.abs(k - fadeK) < 0.01) return; fadeK = k;
  runner.root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!orig.has(m)) orig.set(m, { t: m.transparent, o: m.opacity, d: m.depthWrite });
      const s = orig.get(m);
      if (k >= 0.999) { m.transparent = s.t; m.opacity = s.o; m.depthWrite = s.d; } else { m.transparent = true; m.opacity = s.o * k; m.depthWrite = false; }
      m.needsUpdate = true;
    }
  });
  if (k >= 0.999) orig.clear();
}

// ---------- 매 프레임 (동굴 안에서 cave.js caveFrame 이 부름) ----------
function caveCamTick() {
  const m = state.caveCam;
  if (m === 'b') { const d = camera.position.distanceTo(player.pos) - 1.0, D = CAVE.view.b.fadeD; setFade(d >= D ? 1 : Math.max(0.2, d / D)); } else setFade(1);
  ring.hidden = m !== 'a';
}
// 동굴 밖·안 바뀜: 칩·어둠·반투명 (밖에서는 매 프레임 일하지 않게 짧게)
{ let was = null; const loop = () => { requestAnimationFrame(loop); const on = !!state.cave; if (on === was) return; was = on; chip.hidden = !(on && devOn); if (!on) { ring.hidden = true; setFade(1); } }; requestAnimationFrame(loop); }
// 키도 화면 기준 (a): update.js 가 물어봄. 내려다볼 때 위 = 화면 위
const camScreenMove = () => !!state.cave && state.caveCam === 'a';

Object.assign(late, { caveCamTick, camScreenMove });
Object.assign(late.caveApi || (late.caveApi = {}), {
  cam: setCaveCam,
  /* 비교 그림용 자리 (tools/caverun.js --live): 'corr' 첫 통로 1/4 쯤(가운데는 무너지는 바닥)에서 통로를 따라 봄 · 'mob' 가장 가까운 동굴 적 5m 앞에서 그쪽을 봄 */
  pose: (what) => {
    const c = state.cave; if (!c) return null; const F = c.F; let x, z, h;
    if (what === 'corr') { const k = c.F.corr[0], pts = k.pts, i = Math.max(1, Math.floor(pts.length / 4)), p = pts[i], q = pts[i + 1] || pts[i - 1]; x = F.ox + p[0]; z = F.oz + p[1]; h = Math.atan2(q[0] - p[0], q[1] - p[1]); }
    else { const ms = late.caveApi.mobs?.() || []; let e = null, best = 1e9; for (const m of ms) { const d = Math.hypot(m.x - player.pos.x, m.z - player.pos.z); if (m.walk && d < best) { best = d; e = m; } } if (!e) return null;
      for (let a = 0; a < 6.28 && x === undefined; a += 0.4) for (const r of [5, 4, 3, 6]) { const px = e.x + Math.sin(a) * r, pz = e.z + Math.cos(a) * r; if (F.walk(px, pz)) { x = px; z = pz; h = Math.atan2(e.x - px, e.z - pz); break; } } if (x === undefined) return null; }
    if (!F.walk(x, z)) return null;
    player.pos.set(x, F.floorY(x, z), z); player.visY = player.pos.y; player.prevX = x; player.prevZ = z; player.heading = h; player.target = null;
    cam.yaw = h + Math.PI; followCam(0, true); return { x: +x.toFixed(1), z: +z.toFixed(1) };
  },
  draw: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles }),
  camInfo: () => ({ mode: state.caveCam, name: NAME[state.caveCam], dist: +camera.position.distanceTo(player.pos).toFixed(2), fade: +fadeK.toFixed(2), ring: !ring.hidden, chip: !chip.hidden, K: state.cave?.K?.mode || 'c' }),
});
