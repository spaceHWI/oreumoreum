import * as THREE from 'three';
import { TEXCS } from './boot.js';
import { buildRunner } from './runner.js';
import { cleanGear } from './gear.js';
import { height, groundAt } from './world.js';

// room 캐퍼빌리티로 같은 오름에 있는 사람 보기 + 손잡기
// 손잡기는 presence 필드로만 주고받음 (요청 req → 수락 with)
export function createNet({ scene, player, save, onToast, onPeersChanged, extra, roomName, rideHook }) { // rideHook(e, dt) → { pose, lift, still } | null: 탈것 (#69)
  const peersById = new Map(); // peer -> { peer, runner, label, pos, heading, data }
  let room = null, myPeer = null, ready = false;
  let lastSent = 0, lastKey = '';
  const hand = { with: null, req: null, pendingFrom: null, declinedBy: null, hitBy: null };
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
  const safeNick = (n) => (typeof n === 'string' ? n.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 16) : '') || '러너';

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
      scene.add(r.root);
      e = { peer: pr.peer, runner: r, label: null, nick: '', outfitKey: '', pos: new THREE.Vector3(), tpos: new THREE.Vector3(), heading: 0, theading: 0, data: {}, speed: 0, lastPos: new THREE.Vector3(), lastT: 0, poseT: 0 };
      peersById.set(pr.peer, e);
    }
    return e;
  }
  function applyPeer(pr) {
    const d = pr.presence || {};
    if (typeof d.x !== 'number' || typeof d.z !== 'number') return;
    const e = ensurePeer(pr);
    e.data = d;
    const nick = safeNick(d.nick);
    if (nick !== e.nick) { e.nick = nick; if (e.label) e.runner.root.remove(e.label); e.label = makeLabel(nick); e.runner.root.add(e.label); }
    const ok = JSON.stringify(d.o || null);
    if (ok !== e.outfitKey) { e.outfitKey = ok; const o = expandOutfit(d.o); if (o) e.runner.apply(o); }
    const x = Math.max(-600, Math.min(600, d.x)), z = Math.max(-600, Math.min(600, d.z));
    if (!e.runner.root.visible) { e.pos.set(x, height(x, z), z); e.runner.root.visible = true; }
    e.tpos.set(x, groundAt(x, z), z);
    e.theading = typeof d.h === 'number' ? d.h : e.theading;
  }
  function removePeer(id) {
    const e = peersById.get(id); if (!e) return;
    scene.remove(e.runner.root); peersById.delete(id);
    if (hand.with === id) { hand.with = null; onToast('손을 놓았어요'); }
    if (hand.req === id) hand.req = null;
    if (hand.pendingFrom === id) hand.pendingFrom = null;
  }

  async function start() {
    if (!window.claude?.use) return;
    let lobby = null;
    try { lobby = await window.claude.use('room'); } catch (e) { lobby = null; }
    if (!lobby) return;
    // 오름마다 따로 모이는 방 (서버 하나에 오름 하나)
    try { room = lobby.join ? await lobby.join((typeof roomName === 'function' ? roomName() : roomName) || 'oreum') : lobby; } catch (e) { room = lobby; }
    room.onPeers((ch) => {
      for (const pr of ch.peers) if (pr.sameTab) myPeer = pr.peer;
      for (const pr of ch.left) removePeer(pr.peer);
      for (const pr of [...ch.joined, ...ch.updated]) {
        if (pr.isMe || pr.kind !== 'viewer') continue;
        applyPeer(pr);
      }
      // 귤 맞음: 누가 나를 맞혔다고 알려오면
      for (const e of peersById.values()) { const ht = e.data.ht; if (ht && typeof ht === 'object' && ht.p === myPeer && typeof ht.at === 'number' && Date.now() - ht.at < 5000) { if (!hand.hitBy || hand.hitBy.at !== ht.at) hand.hitBy = { at: ht.at, nick: e.nick, from: e.peer }; } }
      // 손잡기 핸드셰이크
      const partner = hand.with && peersById.get(hand.with);
      if (hand.with && !partner) hand.with = null;
      if (partner) {
        const pw = partner.data.hw;
        if (pw !== myPeer) { hand.with = null; onToast(`${partner.nick}이(가) 손을 놓았어요`); }
      }
      if (hand.req) {
        const t = peersById.get(hand.req);
        if (!t) hand.req = null;
        else if (t.data.hw === myPeer) { hand.with = hand.req; hand.req = null; onToast(`${t.nick}과(와) 손을 잡았어요`); }
        else if (t.data.hd === myPeer) { hand.req = null; hand.declinedBy = t.peer; onToast(`${t.nick}이(가) 지금은 괜찮대요`); }
      }
      if (!hand.with && !hand.req) {
        let from = null;
        for (const e of peersById.values()) if (e.data.hr === myPeer && e.tpos.distanceTo(player.pos) < 10) { from = e.peer; break; }
        hand.pendingFrom = from;
      } else hand.pendingFrom = null;
      ready = true;
      onPeersChanged(peersById.size, hand);
      send(true);
    }, () => { ready = false; onPeersChanged(0, hand); });
  }

  function send(force) {
    if (!room || !myPeer) return;
    const now = performance.now();
    if (!force && now - lastSent < 90) return;
    const p = player;
    const obj = {
      nick: save.nick, o: compactOutfit(save.outfit),
      x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), h: +p.heading.toFixed(3),
      run: p.running, pose: p.pose, jy: +p.jumpY.toFixed(2), spd: +p.speed.toFixed(1),
      hr: hand.req, hw: hand.with, hd: hand.declinedTo || null, drv: p.driving ? Date.now() : 0,
      ht: hitOut, yl: p.yellowUntil > Date.now() ? 1 : 0,
      ...(extra ? extra() : {}),
    };
    const key = JSON.stringify(obj);
    if (!force && key === lastKey) return;
    lastKey = key; lastSent = now;
    room.presence(obj).catch(() => {});
  }

  function update(dt) {
    for (const e of peersById.values()) {
      const k = Math.min(1, dt * 10);
      const prev = e.pos.clone();
      e.pos.lerp(e.tpos, k);
      let dh = e.theading - e.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); e.heading += dh * k;
      const sp = typeof e.data.spd === 'number' ? e.data.spd : prev.distanceTo(e.pos) / Math.max(dt, 1e-3);
      e.speed += (sp - e.speed) * k;
      e.poseT += dt;
      const r = e.runner;
      const rh = rideHook ? rideHook(e, dt) : null;
      r.root.position.copy(e.pos); r.root.position.y += (typeof e.data.jy === 'number' ? e.data.jy : 0) + (rh?.lift || 0);
      r.root.rotation.y = e.heading;
      if (e.label) { const d = e.pos.distanceTo(player.pos); const op = d < 10 ? 1 : d < 18 ? 1 - (d - 10) / 8 : 0; e.label.material.opacity = op; e.label.visible = op > 0.02; }
      const pose = typeof e.data.pose === 'string' ? e.data.pose : 'move';
      r.setTint(!!e.data.yl);
      r.animate(dt, { speed: rh?.still ? 0 : e.speed, running: !!e.data.run, pose: rh?.pose || (pose === 'photo-wait' ? 'move' : pose), t: e.poseT, breath: 0, air: (e.data.jy || 0) > 0.05, jumpV: 0 });
    }
  }

  function nearestPeer(maxD) {
    let best = null, bd = maxD;
    for (const e of peersById.values()) { const d = e.pos.distanceTo(player.pos); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  function request(peerId) { hand.req = peerId; hand.declinedBy = null; send(true); onToast('손잡기를 신청했어요'); }
  function accept() { if (!hand.pendingFrom) return; hand.with = hand.pendingFrom; hand.pendingFrom = null; send(true); const e = peersById.get(hand.with); onToast(`${e ? e.nick : '러너'}과(와) 손을 잡았어요`); }
  function decline() { if (!hand.pendingFrom) return; hand.declinedTo = hand.pendingFrom; hand.pendingFrom = null; send(true); setTimeout(() => { hand.declinedTo = null; send(true); }, 3000); }
  function release() { if (!hand.with) return; hand.with = null; send(true); onToast('손을 놓았어요'); }
  function cancelRequest() { hand.req = null; send(true); }
  function hitPeer(peerId) { hitOut = { p: peerId, at: Date.now() }; send(true); setTimeout(() => { if (hitOut && hitOut.p === peerId) { hitOut = null; send(true); } }, 4000); }

  return { start, send, update, nearestPeer, request, accept, decline, release, cancelRequest, hitPeer, hand, peersById, get myPeer() { return myPeer; }, get ready() { return ready; }, get count() { return peersById.size; } };
}
