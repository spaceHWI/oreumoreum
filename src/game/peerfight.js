// 옆 사람이 싸우는 중 표시 (#181): 보통 적은 각자 화면에만 있어서(전송량을 재 보고 공유하지 않기로 함, notes/history.md #181)
// 대신 다른 사람이 던지기·활·무기·모아 쏘기·맞음 움찔을 하면 머리 위에 작은 '전투 중' 표시. 이미 받는 presence(pose·wf·cg·kn)만 보고, 보내는 것은 없음
import * as THREE from 'three';
import { TEXCS } from '../boot.js';
import { late } from './state.js';
import { player } from './place.js';

const HOLD = 4, FAR = 45; // 마지막 싸움 동작 뒤 이 초 동안 · 이 거리 안 사람만
const FIGHT = new Set(['throw', 'bow', 'aim']);
const tex = (() => {
  const c = document.createElement('canvas'); c.width = 128; c.height = 48; const g = c.getContext('2d');
  g.fillStyle = 'rgba(190,52,38,.88)'; g.beginPath(); g.roundRect(4, 4, 120, 40, 18); g.fill();
  g.fillStyle = '#fff6e4'; g.font = '800 22px "Noto Sans KR", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('전투 중', 64, 25);
  const t = new THREE.CanvasTexture(c); t.colorSpace = TEXCS; return t;
})();
const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
const nowS = () => performance.now() / 1000;

late.tickPeerFight = () => {
  const net = late.net; if (!net?.peersById?.size) return;
  const t = nowS();
  for (const e of net.peersById.values()) {
    const d = e.data || {}, kn = Array.isArray(d.kn) ? d.kn[0] : 0;
    if (FIGHT.has(d.pose) || d.wf || d.cg || (kn && kn !== e.fKn)) e.fightT = t;
    e.fKn = kn;
    const on = t - (e.fightT ?? -99) < HOLD && e.pos.distanceTo(player.pos) < FAR && e.runner.root.visible;
    if (on && !e.fightMark) { const s = new THREE.Sprite(mat); s.scale.set(1.5, 0.56, 1); s.position.y = 3.35; s.renderOrder = 10; e.runner.root.add(s); e.fightMark = s; }
    if (e.fightMark) e.fightMark.visible = on;
  }
};
late.peerFight = () => [...(late.net?.peersById?.values() || [])].map((e) => ({ id: e.peer, on: !!e.fightMark?.visible })); // 확인용
