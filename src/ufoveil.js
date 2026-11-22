// UFO·외계인 드러남 단계 (#207): 끝낸 구역 수로 0(흔적만)·1(먼 실루엣)·2(한 번 가까이)·3(또렷이). 값은 balance.js UFO.reveal
// 게임 밖 파일(enemies.js·ending.js)도 쓰므로 game/ 밖에 둠. 단계 셈은 game/ufoseen.js 가 setRevealStage 로 건다 (안 걸면 늘 3: 다른 맵·도구)
// - veilModel: 단계 3 전, 외계인·드론·우두머리·UFO 모양을 흐린 빛 덩이로 (먼 빛과 소리만, 멀티에서 남이 싸우는 것도 내 화면에선 이렇게)
// - veiled(text): 단계 3 전에는 '외계인'·'UFO' 가 든 글(쪽지·방송·혼잣말·알림)을 내보내지 않음
import * as THREE from 'three';
import { UFO } from './balance.js';

const R = UFO.reveal;
let stageFn = () => 3;
export function setRevealStage(fn) { stageFn = fn; }
export function revealStage() { try { const s = stageFn(); return Number.isFinite(s) ? s : 3; } catch { return 3; } }
export const veilOn = () => revealStage() < 3;
export const veilKind = (kind) => R.kinds.includes(kind);
export const veiled = (text) => veilOn() && typeof text === 'string' && R.words.some((w) => text.includes(w));
export const veilName = (name, kind) => (veilOn() && (veilKind(kind) || veiled(name)) ? R.veilName : name);

// 둥근 번짐 그림 하나를 나눠 씀
let tex = null;
export function glowTex() {
  if (tex) return tex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.75)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  tex = new THREE.CanvasTexture(c); return tex;
}
export function glowSpr(color, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size); return s;
}

// 모양 m({ root, fx }) 의 그림을 다 감추고 빛 덩이(바깥 번짐 + 안쪽 심)를 띄움. size: 덩이 지름(m, 모양 배율 전), y: 높이
export function veilModel(m, { size = R.blob.size, y = R.blob.y } = {}) {
  m.root.traverse((o) => { if (o.isMesh || o.isSprite || o.isPoints) o.visible = false; });
  const g = new THREE.Group(); g.position.y = y; g.name = 'veil';
  const halo = glowSpr(R.blob.halo, size, 0.55), core = glowSpr(R.blob.core, size * 0.38, 0.95);
  g.add(halo, core); m.root.add(g);
  const fx0 = m.fx;
  m.veil = true;
  m.fx = (dt, time, e) => {
    fx0?.(dt, time, e);
    const k = 0.8 + Math.sin(time * 3.1 + (e?.phase || 0)) * 0.2;
    halo.material.opacity = 0.45 * k; core.material.opacity = 0.8 + 0.2 * k; g.position.y = y + Math.sin(time * 1.7 + (e?.phase || 0)) * 0.2;
  };
  return m;
}
