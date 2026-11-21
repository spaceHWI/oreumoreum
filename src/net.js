import * as THREE from 'three';
import { TEXCS } from './boot.js';
import { buildRunner } from './runner.js';
import { cleanGear } from './gear.js';
import { height, groundAt } from './world.js';
import { EMOTE_BY } from './emotes.js';
import { NET, BOAR } from './balance.js';
import { orientBody, flinchK } from './bodytilt.js';
import { cleanText } from './safetext.js';
import { gearScore } from './gearscore.js';
import { topGrade, gradeColor } from './loot.js';

// room 캐퍼빌리티로 같은 오름에 있는 사람 보기 + 손잡기
// 손잡기는 presence 필드로만 주고받음 (요청 req → 수락 with)
export function createNet({ scene, player, save, onToast, onPeersChanged, extra, roomName, rideHook, overHook, cull = null, animR = 1e9, shadowR = 1e9, lobby: wsLobby = null, onRoom = null, solo = null }) { // wsLobby: 멀티 서버 로비 (#7, online.js). 있으면 room 캐퍼빌리티 대신
 // solo(): 참이면 혼자 (#100 튜토리얼 중: 남이 안 보이고 내 모습도 안 보냄). cull: 멀리 있는 사람 감추기, animR: 이 거리 밖은 동작 갱신 생략 (#79) // rideHook(e, dt) → { pose, lift, still, fwd } | null: 탈것 (#69)·노루 (#92)
  const peersById = new Map(); // peer -> { peer, runner, label, pos, heading, data }
  let room = null, myPeer = null, ready = false;
  let lastSent = 0, lastKey = '';
  let idKey = '', idT = -1e9; // 옷·닉네임을 마지막으로 실어 보낸 값·때 (#115). '' 이면 다음에 꼭 실음 (처음·다시 붙음)
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

  // 이름표: 닉네임 + 옆에 작은 장비 점수 (#137, gs 가 있을 때만)
  function makeLabel(text, gs, gg = 0) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.font = '700 28px "Noto Sans KR", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(36,37,31,.55)'; g.fillRect(0, 0, 256, 64);
    if (gg > 0) { g.fillStyle = gradeColor(gg); g.fillRect(0, 58, 256, 6); g.strokeStyle = gradeColor(gg); g.lineWidth = 3; g.strokeRect(1.5, 1.5, 253, 61); } // 등급 색 테두리 (#140)
    const sc = gs > 0 ? String(gs) : '';
    g.font = '800 19px "Noto Sans KR", sans-serif'; const sw = sc ? g.measureText(sc).width + 10 : 0;
    g.font = '700 28px "Noto Sans KR", sans-serif'; const nw = Math.min(236 - sw, g.measureText(text).width), x0 = 128 - (nw + sw) / 2;
    g.fillStyle = '#fbf6e6'; g.fillText(text, x0 + nw / 2, 34, 236 - sw);
    if (sc) { g.font = '800 19px "Noto Sans KR", sans-serif'; g.fillStyle = gg > 0 ? gradeColor(gg) : '#ffb347'; g.textAlign = 'left'; g.fillText(sc, x0 + nw + 10, 36); }
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
    // 맞음 움찔 (#107): 새 번호가 오면 받은 때부터 같은 움찔. 처음 보는 사람의 지난 번호는 무시
    { const kn = Array.isArray(d.kn) && d.kn.length === 3 && d.kn.every(Number.isFinite) ? d.kn : null;
      if (e.knId === undefined) e.knId = kn ? kn[0] : 0;
      else if (kn && kn[0] !== e.knId) { e.knId = kn[0]; e.knT = 0; e.knAx = kn[1]; e.knAz = kn[2]; } }
    e.data = d;
    const nick = safeNick(d.nick), gs = Number.isFinite(d.gs) ? Math.max(0, Math.min(9999, Math.floor(d.gs))) : 0, gg = Number.isFinite(d.gg) ? Math.max(0, Math.min(3, Math.floor(d.gg))) : 0; // gg 입은 것 중 가장 높은 등급 (#140)
    if (nick !== e.nick || gs !== e.gs || gg !== e.gg) { e.nick = nick; e.gs = gs; e.gg = gg; if (e.label) e.runner.root.remove(e.label); e.label = makeLabel(nick, gs, gg); e.runner.root.add(e.label); }
    const ok = JSON.stringify(d.o || null);
    if (ok !== e.outfitKey) { e.outfitKey = ok; const o = expandOutfit(d.o); if (o) { e.runner.apply(o); e.shadow = null; } }
    const x = Math.max(-2000, Math.min(2000, d.x)), z = Math.max(-2000, Math.min(2000, d.z)); // 남송이는 들머리가 x -860 쯤이라 ±600 이면 잘렸음 (#79)
    if (!e.runner.root.visible) { e.pos.set(x, height(x, z), z); e.runner.root.visible = !solo?.(); }
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
      for (const pr of ch.peers) if (pr.sameTab) { if (pr.peer !== myPeer) idKey = ''; myPeer = pr.peer; } // 새로(다시) 붙으면 옷·닉네임부터 (#115)
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
    }, () => { ready = false; idKey = ''; onPeersChanged?.(0); });
  }

  function send(force) {
    if (!room || !myPeer || solo?.()) return;
    const now = performance.now();
    if (!force && now - lastSent < NET.sendMs) return; // 초당 10번 안쪽 (#7)
    const p = player;
    // 옷·닉네임은 처음·바뀜·다시 붙음 때만 (#115). 서버(roomcore)가 없으면 앞 값을 씀. 받아 주지 않은 메시지에 실렸을 수 있어 identMs 마다 한 번 더.
    // room 캐퍼빌리티(서버 없음)는 presence 를 통째로 바꾸므로 늘 실음
    const id = { nick: save.nick, o: compactOutfit(save.outfit), gs: gearScore(save).total, gg: topGrade(save) }, ik = JSON.stringify(id); // gs 장비 점수 (#137, 이름표 옆)
    const withId = !wsLobby || ik !== idKey || now - idT > NET.identMs;
    const obj = {
      ...(withId ? id : {}),
      x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), h: +p.heading.toFixed(3),
      run: p.running, pose: p.pose, jy: +p.jumpY.toFixed(2), spd: +p.speed.toFixed(1),
      ...(p.knock ? { kn: [p.knock.id, +p.knock.ax.toFixed(2), +p.knock.az.toFixed(2)] } : {}), // 맞음 움찔 (#107)
      ht: hitOut, yl: p.yellowUntil > Date.now() ? 1 : 0,
      ...(extra ? extra() : {}),
    };
    const key = JSON.stringify(obj);
    if (!force && key === lastKey) return;
    lastKey = key; lastSent = now;
    if (withId) { idKey = ik; idT = now; }
    room.presence(obj).catch(() => {});
  }

  const prevP = new THREE.Vector3();
  const _tk = [0, 0, 0], _tks = [_tk];
  function update(dt) {
    const alone = !!solo?.();
    for (const e of peersById.values()) {
      if (alone) { e.runner.root.visible = false; if (e.label) e.label.visible = false; continue; } // #100 튜토리얼 중엔 혼자
      if (!e.runner.root.visible) { e.pos.copy(e.tpos); e.runner.root.visible = true; }
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
      if (e.knT != null) { e.knT += dt; if (e.knT >= 1) e.knT = null; }
      const fk = e.knT != null ? flinchK(e.knT) : 0;
      _tk[0] = e.knAx || 0; _tk[1] = e.knAz || 0; _tk[2] = BOAR.flinchAng * fk;
      orientBody(r.root, e.heading, fk > 0 ? _tks : null); // 몸 방향은 매번 처음부터, 맞음 움찔만 얹음 (#107)
      const d0 = e.pos.distanceTo(player.pos);
      if (e.label) { const d = d0; const op = d < 10 ? 1 : d < 18 ? 1 - (d - 10) / 8 : 0; e.label.material.opacity = op; e.label.visible = op > 0.02; }
      const sh = d0 < shadowR; if (sh !== e.shadow) { e.shadow = sh; r.root.traverse((c) => { if (c.isMesh) c.castShadow = sh; }); } // 가까운 사람만 그림자 (#79)
      if (d0 > animR && !rh) continue; // 멀면 자리만 옮김 (#79)
      const pose = typeof e.data.pose === 'string' ? e.data.pose : 'move';
      r.setTint(!!e.data.yl);
      const ov = rh && overHook ? overHook(e) : null; // 탈것 위 손동작 (#76)
      r.animate(dt, { speed: rh?.still ? 0 : e.speed, running: !!e.data.run, pose: rh?.pose || (pose === 'photo-wait' ? 'move' : pose), t: e.poseT, air: (e.data.jy || 0) > 0.05, jumpV: 0, face: fk > 0 ? 'wide' : null, edur: EMOTE_BY[pose]?.dur || 2, over: ov && { ...ov, dur: EMOTE_BY[ov.id].dur } });
    }
  }

  function nearestPeer(maxD) {
    let best = null, bd = maxD; if (solo?.()) return null;
    for (const e of peersById.values()) { const d = e.pos.distanceTo(player.pos); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  function hitPeer(peerId) { hitOut = { p: peerId, at: Date.now() }; send(true); setTimeout(() => { if (hitOut && hitOut.p === peerId) { hitOut = null; send(true); } }, 4000); }

  return { start, send, update, nearestPeer, hitPeer, hand, peersById, test: { fake: applyPeer, drop: removePeer }, // test: 가짜 사람 넣기·빼기 (#79 성능 재기)
     get myPeer() { return myPeer; }, get solo() { return !!solo?.(); }, get ready() { return ready; }, get count() { return peersById.size; } };
}
