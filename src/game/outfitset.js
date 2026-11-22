// 한 벌 맞춤 (#179): 같은 묶음(balance.js OUTFIT_SETS) 3벌을 겉모습으로 입으면 캐릭터 둘레에 작은 빛 점이 돌고, 처음 맞추면 칭호 토스트
// 능력은 없음. 칭호는 punktext.js TITLES 의 set 줄(#165 칭호 창, punkworld.js): 세 벌을 다 가지면 열림. 저장하지 않고 가진 옷으로 셈 (titles)
// 점은 한 번 그리기(Points 하나), 저사양은 점 수를 줄임. 다른 사람 캐릭터에는 아직 안 붙임
import * as THREE from 'three';
import { OUTFIT_SETS, SET_FX } from '../balance.js';
import { late } from './state.js';
import { save } from './save.js';
import { scene } from './scene.js';
import { player } from './place.js';
import { toast } from './hud.js';
import { LOW } from '../gfx2.js';

export const wornSet = (s = save) => OUTFIT_SETS.find((t) => t.items.every((id) => Object.values(s?.clothes?.wear || {}).includes(id))) || null;
export const setTitles = (s = save) => OUTFIT_SETS.filter((t) => !t.badge && t.items.every((id) => s?.clothes?.own?.[id])).map((t) => ({ id: t.id, title: t.title }));

const N = LOW ? SET_FX.lowN : SET_FX.n;
const dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
const pos = new Float32Array(N * 3), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
const mat = new THREE.PointsMaterial({ size: SET_FX.size, map: dot, transparent: true, depthWrite: false, color: '#ffffff' });
const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.visible = false; pts.renderOrder = 3; scene.add(pts);
let cur = null, t = 0;

function check(fromWear) {
  const s = wornSet();
  if (s?.id === cur?.id) return;
  cur = s; pts.visible = !!s; if (s) mat.color.set(s.fx);
  if (s && fromWear) { const t = !s.badge || save.ach?.badges?.[s.badge]; toast(`한 벌 맞춤 · ${s.name}${t ? ` · 칭호 '${s.title}' 를 달 수 있어요` : ''}`, 3); late.sound?.fanfare?.(); } /* badge: 칭호는 그 업적으로 열림 (#237) */
}
function tick(dt) {
  if (!cur) return;
  t += dt; const p = player.pos, hide = !!player.riding || !!player.rescue; // 탈것·들것 중에는 감춤
  pts.visible = !hide; if (hide) return;
  for (let i = 0; i < N; i++) { const a = t * SET_FX.spin + (i / N) * Math.PI * 2, y = SET_FX.y + Math.sin(t * 2 + i * 1.7) * SET_FX.bob + (i % 2) * SET_FX.step;
    pos[i * 3] = p.x + Math.cos(a) * SET_FX.r; pos[i * 3 + 1] = p.y + y; pos[i * 3 + 2] = p.z + Math.sin(a) * SET_FX.r; }
  geo.attributes.position.needsUpdate = true;
}
check(false);
late.outfitSet = { check, tick, worn: () => cur?.id || null, titles: () => setTitles(), visible: () => pts.visible };
