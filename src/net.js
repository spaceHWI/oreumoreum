import * as THREE from 'three';
import { TEXCS } from './boot.js';
import { buildRunner } from './runner.js';
import { cleanGear } from './gear.js';
import { height, groundAt } from './world.js';
import { EMOTE_BY } from './emotes.js';
import { NET } from './balance.js';
import { cleanText } from './safetext.js';

// room 캐퍼빌리티로 같은 오름에 있는 사람 보기 + 손잡기
// 손잡기는 presence 필드로만 주고받음 (요청 req → 수락 with)
export function createNet({ scene, player, save, onToast, onPeersChanged, extra, roomName, rideHook, overHook, cull = null, animR = 1e9, shadowR = 1e9, lobby: wsLobby = null, onRoom = null }) { // wsLobby: 멀티 서버 로비 (#7, online.js). 있으면 room 캐퍼빌리티 대신
 // cull: 멀리 있는 사람 감추기, animR: 이 거리 밖은 동작 갱신 생략 (#79) // rideHook(e, dt) → { pose, lift, still, fwd } | null: 탈것 (#69)·노루 (#92)
  const peersById = new Map(); // peer -> { peer, runner, label, pos, heading, data }
  let room = null, myPeer = null, ready = false;
  let lastSent = 0, lastKey = '';
  const hand = { hitBy: null }; // 누가 나를 귤로 맞혔나 (손잡기는 #86 에서 뺌)
  let hitOut = null;

  function compactOutfit(o) {
    return { hr: o.hair?.type, hrc: o.hair?.color, sk: o.skin?.color, h: o.hat.type, hc: o.hat.color, hb: o.hat.back ? 1 : 0, g: o.glasses.type, v: o.vest.type, vc: o.vest.color, s: o.shirt.color, st: o.shirt.type, p: o.pants.type, pc: o.pants.color, sh: o.shoes.color, sht: o.shoes.type, gr: o.gear };
  }
  function expandOutfit(c) {
    if (!c || typeof c !== 'object') return null;
    const col = (v, d) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : d);
    const str = (v, ok, d) => (ok.includes(v) ? v : d);
    return {
      hair: { type: str(c.hr, ['bun', 'twin', 'low', 'half', 'top'], 'bun'), color: col(c.hrc, '#2a221c') }, skin: { color: col(c.sk, '#ffdcbf') },
      hat: { type: str(c.h, ['none', 'cap', 'visor', 'bucket', 'beanie', 'straw', 'headband'], 'cap'), color: col(c.hc, '#2b2b33'), back: c.hb === 1 },
      glasses: { type: str(c.g, ['none', 'black', 'mirror', 'sport', 'round'], 'none') },
      vest: { type: str(c.v, ['none', 'on'], 'on'), color: col(c.vc, '#e2683c') },
      shirt: { type: str(c.st, ['tee', 'singlet', 'long'], 'tee'), color: col(c.s, '#e9e4d6') },
      pants: { type: str(c.p, ['shorts', 'tights', 'half'], 'shorts'), color: col(c.pc, '#2b2b33') },
      shoes: { type: str(c.sht, ['road', 'trail', 'sandal'], 'road'), color: col(c.sh, '#e2683c') },
      gear: cleanGear(c.gr),
    };
  }
  const safeNick = (n) => cleanText(n, NET.nickMax) || '러너'; // 남이 보낸 이름은 다듬어서 캔버스 글자로만 (#84)

  function makeLabel(text) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.font = '700 28px "Noto Sans KR", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(36,37,31,.55)'; g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#fbf6e6'; g.fillText(text, 128, 34);
    const t = new THREE.CanvasTexture(c); t.colorSpace = TEXCS;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0 }));
    sp.scale.set(3.2, 0.8, 1); sp.position.y = 2.75;
    return sp;
  }

  function ensurePeer(pr) {
    let e = peersById.get(pr.peer);
    if (!e) {
      const r = buildRunner();
      r.root.visible = false;
      scene.add(r.root); cull?.()?.add(r.root, { dynamic: true, shadow: false }); // 그림자는 아래 update 에서 따로
      e = { peer: pr.peer, runner: r, label: null, nick: '', outfitKey: '', pos: new THREE.Vector3(), tpos: new THREE.Vector3(), heading: 0, theading: 0, data: {}, speed: 0, lastPos: new THREE.Vector3(), lastT: 0, poseT: 0 };
      peersById.set(pr.peer, e);
    }
    return e;
  }
  function applyPeer(pr) {
    const d = pr.presence || {};
    if (typeof d.x !== 'number' || typeof d.z !== 'number') return;
    const e = ensurePeer(pr);
    if (d.pose !== e.data.pose) e.poseT = 0; // 동작이 바뀌면 처음부터 (#76)
    e.data = d;
    const nick = safeNick(d.nick);
    if (nick !== e.nick) { e.nick = nick; if (e.label) e.runner.root.remove(e.label); e.label = makeLabel(nick); e.runner.root.add(e.label); }
    const ok = JSON.stringify(d.o || null);
    if (ok !== e.outfitKey) { e.outfitKey = ok; const o = expandOutfit(d.o); if (o) { e.runner.apply(o); e.shadow = null; } }
    const x = Math.max(-2000, Math.min(2000, d.x)), z = Math.max(-2000, Math.min(2000, d.z)); // 남송이는 들머리가 x -860 쯤이라 ±600 이면 잘렸음 (#79)
    if (!e.runner.root.visible) { e.pos.set(x, height(x, z), z); e.runner.root.visible = true; }
    e.tpos.set(x, groundAt(x, z), z);
    e.theading = typeof d.h === 'number' ? d.h : e.theading;
  }
  function removePeer(id) {
    const e = peersById.get(id); if (!e) return;
    scene.remove(e.runner.root); cull?.()?.remove(e.runner.root); peersById.delete(id);
  }

  async function start() {
    let lobby = wsLobby;
    if (!lobby) {
      if (!window.claude?.use) return;
      try { lobby = await window.claude.use('room'); } catch (e) { lobby = null; }
    }
    if (!lobby) return;
    // 오름마다 따로 모이는 방 (서버 하나에 오름 하나)
    try { room = lobby.join ? await lobby.join((typeof roomName === 'function' ? roomName() : roomName) || 'oreum') : lobby; } catch (e) { room = lobby; }
    onRoom?.(room);
    room.onPeers((ch) => {
      for (const pr of ch.peers) if (pr.sameTab) myPeer = pr.peer;
      for (const pr of ch.left) removePeer(pr.peer);
      for (const pr of [...ch.joined, ...ch.updated]) {
        if (pr.isMe || pr.kind !== 'viewer') continue;
        applyPeer(pr);
      }
      // 귤 맞음: 누가 나를 맞혔다고 알려오면
      for (const e of peersById.values()) { const ht = e.data.ht; if (ht && typeof ht === 'object' && ht.p === myPeer && typeof ht.at === 'number' && Date.now() - ht.at < 5000) { if (!hand.hitBy || hand.hitBy.at !== ht.at) hand.hitBy = { at: ht.at, nick: e.nick, from: e.peer }; } }
      ready = true;
      onPeersChanged?.(peersById.size);
      send(!wsLobby); // 서버 방은 새로 온 사람에게 방이 내 마지막 상태를 대신 보내 줌 (#7)
    }, () => { ready = false; onPeersChanged?.(0); });
  }

  function send(force) {
    if (!room || !myPeer) return;
    const now = performance.now();
    if (!force && now - lastSent < NET.sendMs) return; // 초당 10번 안쪽 (#7)
    const p = player;
    const obj = {
      nick: save.nick, o: compactOutfit(save.outfit),
      x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), h: +p.heading.toFixed(3),
      run: p.running, pose: p.pose, jy: +p.jumpY.toFixed(2), spd: +p.speed.toFixed(1),
      ht: hitOut, yl: p.yellowUntil > Date.now() ? 1 : 0,
      ...(extra ? extra() : {}),
    };
    const key = JSON.stringify(obj);
    if (!force && key === lastKey) return;
    lastKey = key; lastSent = now;
    room.presence(obj).catch(() => {});
  }

  const prevP = new THREE.Vector3();
  function update(dt) {
    for (const e of peersById.values()) {
      const k = Math.min(1, dt * 10);
      const prev = prevP.copy(e.pos);
      e.pos.lerp(e.tpos, k);
      let dh = e.theading - e.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); e.heading += dh * k;
      const sp = typeof e.data.spd === 'number' ? e.data.spd : prev.distanceTo(e.pos) / Math.max(dt, 1e-3);
      e.speed += (sp - e.speed) * k;
      e.poseT += dt;
      const r = e.runner;
      const rh = rideHook ? rideHook(e, dt) : null;
      r.root.position.copy(e.pos); r.root.position.y += (typeof e.data.jy === 'number' ? e.data.jy : 0) + (rh?.lift || 0);
      if (rh?.fwd) { r.root.position.x += Math.sin(e.heading) * rh.fwd; r.root.position.z += Math.cos(e.heading) * rh.fwd; } // 노루 등 (#92)
      r.root.rotation.y = e.heading;
      const d0 = e.pos.distanceTo(player.pos);
      if (e.label) { const d = d0; const op = d < 10 ? 1 : d < 18 ? 1 - (d - 10) / 8 : 0; e.label.material.opacity = op; e.label.visible = op > 0.02; }
      const sh = d0 < shadowR; if (sh !== e.shadow) { e.shadow = sh; r.root.traverse((c) => { if (c.isMesh) c.castShadow = sh; }); } // 가까운 사람만 그림자 (#79)
      if (d0 > animR && !rh) continue; // 멀면 자리만 옮김 (#79)
      const pose = typeof e.data.pose === 'string' ? e.data.pose : 'move';
      r.setTint(!!e.data.yl);
      const ov = rh && overHook ? overHook(e) : null; // 탈것 위 손동작 (#76)
      r.animate(dt, { speed: rh?.still ? 0 : e.speed, running: !!e.data.run, pose: rh?.pose || (pose === 'photo-wait' ? 'move' : pose), t: e.poseT, air: (e.data.jy || 0) > 0.05, jumpV: 0, edur: EMOTE_BY[pose]?.dur || 2, over: ov && { ...ov, dur: EMOTE_BY[ov.id].dur } });
    }
  }

  function nearestPeer(maxD) {
    let best = null, bd = maxD;
    for (const e of peersById.values()) { const d = e.pos.distanceTo(player.pos); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  function hitPeer(peerId) { hitOut = { p: peerId, at: Date.now() }; send(true); setTimeout(() => { if (hitOut && hitOut.p === peerId) { hitOut = null; send(true); } }, 4000); }

  return { start, send, update, nearestPeer, hitPeer, hand, peersById, test: { fake: applyPeer, drop: removePeer }, // test: 가짜 사람 넣기·빼기 (#79 성능 재기)
     get myPeer() { return myPeer; }, get ready() { return ready; }, get count() { return peersById.size; } };
}
