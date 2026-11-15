import * as THREE from 'three';
import { TEXCS } from './boot.js';
import { buildRunner } from './runner.js';
import { height, groundAt } from './world.js';

// NPC 러너: 탐방로를 오르내리고 굼부리를 돌며, 가까이 오면 인사하고 한마디 함
export const NPCS = [
  { id: 'rui', name: '루이', opts: { hair: 'bob', hairColor: '#2a221c' }, outfit: { hat: { type: 'none', color: '#2b2b33' }, glasses: { type: 'none' }, vest: { type: 'none' }, shirt: { type: 'tee', color: '#2f6db5' }, pants: { type: 'shorts', color: '#2b2b33' }, shoes: { type: 'trail', color: '#f2f2f2' } }, speed: 1.0, lines: ['오늘 바람 좋다', '정상까지 같이 갈래?', '송이길이 발에 착 감기지'] },
  { id: 'ultra', name: '울트라걸', opts: { hair: 'perm', hairColor: '#4a2e1c', skin: '#e6b48f' }, outfit: { hat: { type: 'visor', color: '#e9719a', back: false }, glasses: { type: 'sport' }, vest: { type: 'on', color: '#e9719a' }, shirt: { type: 'singlet', color: '#f2f2f2' }, pants: { type: 'tights', color: '#2b2b33' }, shoes: { type: 'trail', color: '#e9719a' } }, speed: 1.35, lines: ['한 바퀴 더!', '오름은 매일 달라', '내리막에서 힘 빼기'] },
  { id: 'bear', name: '곰돌', opts: { hair: 'bald', beard: true, hairColor: '#8a6a3a', skin: '#f6dcc4', scaleW: 1.3, scaleH: 1.15 }, outfit: { hat: { type: 'none', color: '#2b2b33' }, glasses: { type: 'black' }, vest: { type: 'on', color: '#2b2b33' }, shirt: { type: 'tee', color: '#3e8f5a' }, pants: { type: 'shorts', color: '#4a5a78' }, shoes: { type: 'trail', color: '#2b2b33' } }, speed: 0.75, lines: ['천천히 가도 정상은 같아', '허허, 숨 좀 고르자', '돌탑에 돌 하나 얹었나?'] },
  { id: 'turtle', name: '거북 선생', opts: { turtle: true, hair: 'bald', book: true, scaleW: 1.05, scaleH: 0.9 }, outfit: { hat: { type: 'none', color: '#2b2b33' }, glasses: { type: 'round' }, vest: { type: 'none' }, shirt: { type: 'tee', color: '#d9c98a' }, pants: { type: 'shorts', color: '#4e6b3a' }, shoes: { type: 'sandal', color: '#7a6a55' } }, speed: 0.35, lines: ['급할 것 없어요', '이 책에 오름 이야기가 있어요', '다랑쉬는 달이 뜨는 봉우리래요'] },
  { id: 'tall', name: '장다리', opts: { hair: 'short', skin: '#8d5a3c', tattoo: true, scaleW: 0.85, scaleH: 1.28 }, outfit: { hat: { type: 'cap', color: '#2b2b33', back: true }, glasses: { type: 'none' }, vest: { type: 'on', color: '#f2c94c' }, shirt: { type: 'singlet', color: '#2b2b33' }, pants: { type: 'half', color: '#2b2b33' }, shoes: { type: 'trail', color: '#c4e04a' } }, speed: 1.2, lines: ['보폭 줄이고 케이던스 올려', '여기 능선이 제일 좋아', '팔 문신? 오름 지도야'] },
  { id: 'soon', name: '순둥', opts: { hair: 'short', hairColor: '#5a3a22', kind: true, skin: '#f3cfae' }, outfit: { hat: { type: 'bucket', color: '#e9e4d6' }, glasses: { type: 'none' }, vest: { type: 'none' }, shirt: { type: 'long', color: '#7fb8e8' }, pants: { type: 'shorts', color: '#7a6a55' }, shoes: { type: 'road', color: '#f2f2f2' } }, speed: 0.85, lines: ['안녕하세요! 좋은 하루예요', '노루 봤어요? 너무 귀여워요', '같이 걸어요'] },
];

export function createNpcs({ scene, social, rnd, route, hooks = {}, spots }) {
  const total = route.length;

  const list = NPCS.slice(0, spots?.npcCount || NPCS.length).map((n, i) => {
    const run = buildRunner(n.opts);
    run.apply(n.outfit);
    scene.add(run.root);
    // 이름표
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
    g.font = '700 28px "Noto Sans KR", sans-serif'; g.fillStyle = 'rgba(51,64,42,.6)'; g.fillRect(0, 0, 256, 64); g.fillStyle = '#fbf6e6'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n.name, 128, 34);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = TEXCS;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, opacity: 0 })); label.scale.set(3.2, 0.8, 1); label.position.y = 2.75 * (n.opts.scaleH || 1) + 0.1; run.root.add(label);
    return { ...n, run, label, idx: Math.floor(rnd() * total), dir: 1, pos: new THREE.Vector3(), heading: 0, poseT: 0, pose: 'move', speed: 0, running: n.speed > 1, pauseT: 0, greetCd: 0, lineCd: 20 + rnd() * 30 };
  });
  list.forEach((n) => { n.pos.copy(route[n.idx]); });

  function update(dt, player, time) {
    for (const n of list) {
      n.poseT += dt;
      const d = n.pos.distanceTo(player.pos);
      // 이름표: 가까우면 표시
      const op = d < 10 ? 1 : d < 18 ? 1 - (d - 10) / 8 : 0; n.label.material.opacity = op; n.label.visible = op > 0.02;
      n.greetCd -= dt; n.lineCd -= dt;
      if (n.pose === 'wave') { if (n.poseT > 2.2) { n.pose = 'move'; } n.run.animate(dt, { speed: 0, running: false, pose: 'wave', t: n.poseT, breath: 0 }); n.run.root.position.copy(n.pos); n.run.root.rotation.y = n.heading; continue; }
      if (n.pauseT > 0) { n.pauseT -= dt; n.speed += (0 - n.speed) * Math.min(1, dt * 6); n.run.animate(dt, { speed: n.speed, running: false, pose: 'breath', t: n.poseT, breath: Math.sin(n.poseT * 1.2) * 0.5 + 0.5 }); n.run.root.position.copy(n.pos); n.run.root.rotation.y = n.heading; continue; }
      // 가까이 오면 인사하고 한마디
      if (d < 6 && n.greetCd <= 0) {
        n.greetCd = 40 + rnd() * 40; n.pose = 'wave'; n.poseT = 0;
        n.heading = Math.atan2(player.pos.x - n.pos.x, player.pos.z - n.pos.z);
        social.showBubble('npc-' + n.id, n.run.root, n.lines[Math.floor(rnd() * n.lines.length)], 3.4 * (n.opts.scaleH || 1));
        if (!n.greeted) { n.greeted = true; hooks.greet?.(n); }
        continue;
      }
      if (n.lineCd <= 0 && d < 25) { n.lineCd = 40 + rnd() * 40; social.showBubble('npc-' + n.id, n.run.root, n.lines[Math.floor(rnd() * n.lines.length)], 3.4 * (n.opts.scaleH || 1)); }
      // 경로 따라 이동
      const target = route[n.idx];
      const to = target.clone().sub(n.pos).setY(0); const dist = to.length();
      if (dist < 0.6) {
        n.idx += n.dir;
        if (n.idx >= total) { n.idx = total - 1; n.dir = -1; n.pauseT = 6 + rnd() * 8; }
        if (n.idx < 0) { n.idx = 0; n.dir = 1; n.pauseT = 8 + rnd() * 10; }
        if (rnd() < 0.015) n.pauseT = 3 + rnd() * 5;
        continue;
      }
      const want = (n.running ? 7.5 : 4.2) * n.speed;
      n.speed += (want - n.speed) * Math.min(1, dt * 4);
      const h = Math.atan2(to.x, to.z); let dh = h - n.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); n.heading += dh * Math.min(1, dt * 8);
      n.pos.addScaledVector(to.normalize(), Math.min(dist, n.speed * dt)); n.pos.y = groundAt(n.pos.x, n.pos.z);
      n.run.root.position.copy(n.pos); n.run.root.rotation.y = n.heading;
      n.run.animate(dt, { speed: n.speed, running: n.running, pose: 'move', t: n.poseT, breath: 0 });
    }
  }
  return { list, update, positions: () => list.map((n) => ({ id: 'npc-' + n.id, pos: n.pos, npc: n })) };
}
