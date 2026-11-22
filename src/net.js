import * as THREE from 'three';
import { TEXCS } from './boot.js';
import { buildRunner } from './runner.js';
import { cleanGear } from './gear.js';
import { height, groundAt } from './world.js';
import { EMOTE_BY } from './emotes.js';
import { NET, BOAR, LEVEL } from './balance.js';
const LV_MAX = LEVEL.max;
import { orientBody, flinchK } from './bodytilt.js';
import { cleanText, nickBad } from './safetext.js';
import { gearScore } from './gearscore.js';
import { topGrade, gradeColor } from './loot.js';
import { levelOf } from './augments.js';
import { titleText } from './punktext.js';

// room 캐퍼빌리티로 같은 오름에 있는 사람 보기 + 손잡기
// 손잡기는 presence 필드로만 주고받음 (요청 req → 수락 with)
// 동굴 (#195, game/cave.js 가 채움): at = 동굴 안이면 보낼 입구 자리 {x, z}, fi 층(0~), day 오늘의 동굴 날짜, scene 동굴 장면
// 같이 들어가기 (4번 조각): 같은 날·같은 층에 있는 사람끼리만 보임(동굴 자리 cx·cz). 오름 사람에게 동굴 사람은, 동굴 사람에게 오름 사람은 안 보임
//   서버(roomcore)도 칸(cv·cd)이 다르면 칸이 바뀔 때 한 번만 보냄 (전송량 절약)
export const netCave = { at: null, fi: 0, day: '', scene: null };
const caveKey = (d) => (Number.isInteger(d?.cv) && d.cv > 0 ? d.cv + ':' + (d.cd || '') : '');
const myCaveKey = () => (netCave.at ? netCave.fi + 1 + ':' + netCave.day : '');
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
  const safeNick = (n) => { const s = cleanText(n, NET.nickMax); return s && !nickBad(s) ? s : '러너'; }; // 남이 보낸 이름은 다듬어서 캔버스 글자로만 (#84). 걸리는 이름은 '러너' (#162, 옛 서버·P2P 대비)

  // 이름표: (작은 레벨 #159, lv 가 있을 때만) 닉네임. 장비 점수(gs)는 #251 부터 안 그림
  // 칭호 (#165): 있으면 이름표 위에 작은 글 한 줄 (목록에 있는 글만, punktext.js TITLES)
  function makeLabel(text, gs, gg = 0, lv = 0, title = '') {
    const TH = title ? 30 : 0, c = document.createElement('canvas'); c.width = 256; c.height = 64 + TH;
    const g = c.getContext('2d');
    if (title) { g.font = '700 19px "Noto Sans KR", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; const w = Math.min(244, g.measureText(title).width + 20); g.fillStyle = 'rgba(36,37,31,.45)'; g.fillRect(128 - w / 2, 2, w, TH - 4); g.fillStyle = '#ffd27a'; g.fillText(title, 128, TH / 2 + 1, 236); g.translate(0, TH); }
    g.font = '700 28px "Noto Sans KR", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(36,37,31,.55)'; g.fillRect(0, 0, 256, 64);
    if (gg > 0) { g.fillStyle = gradeColor(gg); g.fillRect(0, 58, 256, 6); g.strokeStyle = gradeColor(gg); g.lineWidth = 3; g.strokeRect(1.5, 1.5, 253, 61); } // 등급 색 테두리 (#140)
    const sc = ''; void gs; /* #251 장비 점수는 이름표에 안 보임 (레벨만). gs 는 등급 테두리 등 다른 쓰임을 위해 그대로 받음 */
    const lt = lv > 0 ? 'Lv' + lv : '';
    g.font = '800 19px "Noto Sans KR", sans-serif'; const sw = sc ? g.measureText(sc).width + 10 : 0, lw = lt ? g.measureText(lt).width + 8 : 0;
    g.font = '700 28px "Noto Sans KR", sans-serif'; const nw = Math.min(236 - sw - lw, g.measureText(text).width), x0 = 128 - (nw + sw + lw) / 2 + lw;
    g.fillStyle = '#fbf6e6'; g.fillText(text, x0 + nw / 2, 34, 236 - sw - lw);
    if (sc) { g.font = '800 19px "Noto Sans KR", sans-serif'; g.fillStyle = gg > 0 ? gradeColor(gg) : '#ffb347'; g.textAlign = 'left'; g.fillText(sc, x0 + nw + 10, 36); }
    if (lt) { g.font = '800 19px "Noto Sans KR", sans-serif'; g.fillStyle = '#ffd27a'; g.textAlign = 'right'; g.fillText(lt, x0 - 8, 36); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = TEXCS;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0 }));
    sp.scale.set(3.2, 0.8 * (64 + TH) / 64, 1); sp.position.y = 2.75 + 0.4 * TH / 64;
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
    const nick = safeNick(d.nick), gs = Number.isFinite(d.gs) ? Math.max(0, Math.min(9999, Math.floor(d.gs))) : 0, gg = Number.isFinite(d.gg) ? Math.max(0, Math.min(3, Math.floor(d.gg))) : 0, lv = Number.isFinite(d.lv) ? Math.max(0, Math.min(LV_MAX, Math.floor(d.lv))) : 0; /* gg 입은 것 중 가장 높은 등급 (#140), lv 레벨 (#159) */
    const title = titleText(d.tt); // 칭호 번호 (#165): 범위 밖·모르는 번호는 안 닮
    if (nick !== e.nick || gs !== e.gs || gg !== e.gg || lv !== e.lv || title !== e.title) { e.nick = nick; e.gs = gs; e.gg = gg; e.lv = lv; e.title = title; if (e.label) { e.runner.root.remove(e.label); e.label.material.map?.dispose(); e.label.material.dispose(); } e.label = makeLabel(nick, gs, gg, lv, title); e.runner.root.add(e.label); }
    const ok = JSON.stringify(d.o || null);
    if (ok !== e.outfitKey) { e.outfitKey = ok; const o = expandOutfit(d.o); if (o) { e.runner.apply(o); e.shadow = null; } }
    e.ck = caveKey(d); // 동굴 칸 (#195): 내 칸과 다르면 update 가 숨김
    const inCv = !!e.ck && Number.isFinite(d.cx) && Number.isFinite(d.cz);
    const x = inCv ? d.cx : Math.max(-2000, Math.min(2000, d.x)), z = inCv ? d.cz : Math.max(-2000, Math.min(2000, d.z)); // 남송이는 들머리가 x -860 쯤이라 ±600 이면 잘렸음 (#79)
    if (e.ck !== myCaveKey()) { e.waitPr = pr; return; } // 다른 칸: 내가 그 칸에 들어가면 update 가 다시 놓음
    e.waitPr = null;
    if (!e.runner.root.visible) { e.pos.set(x, height(x, z), z); e.runner.root.visible = !solo?.(); }
    e.tpos.set(x, groundAt(x, z), z);
    e.theading = typeof d.h === 'number' ? d.h : e.theading;
  }
  function removePeer(id) {
    const e = peersById.get(id); if (!e) return;
    e.runner.root.parent?.remove(e.runner.root); cull?.()?.remove(e.runner.root); peersById.delete(id);
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
    if (!room || !myPeer || solo?.() || room.open === false) return; // 서버 방이 닫힌 동안(다시 붙는 중·쉬는 중 #157)엔 만들지도 않음 (조작 표시를 버리지 않게)
    const now = performance.now();
    if (!force && now - lastSent < NET.sendMs) return; // 초당 10번 안쪽 (#7)
    const p = player;
    // 옷·닉네임은 처음·바뀜·다시 붙음 때만 (#115). 서버(roomcore)가 없으면 앞 값을 씀. 받아 주지 않은 메시지에 실렸을 수 있어 identMs 마다 한 번 더.
    // room 캐퍼빌리티(서버 없음)는 presence 를 통째로 바꾸므로 늘 실음
    const id = { nick: save.nick, o: compactOutfit(save.outfit), gs: gearScore(save).total, gg: topGrade(save), lv: save.journey?.seen?.level ? levelOf(save.lv?.xp || 0).lv : 0, tt: save.punk?.title ?? -1 }, ik = JSON.stringify(id); // gs 장비 점수 (#137, 이름표 옆), lv 레벨 (#159, 문이 열린 뒤. 바뀔 때만 감)
    const withId = !wsLobby || ik !== idKey || now - idT > NET.identMs;
    const obj = {
      ...(withId ? id : {}),
      x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), h: +p.heading.toFixed(3),
      run: p.running, pose: p.pose, jy: +p.jumpY.toFixed(2), spd: +p.speed.toFixed(1),
      ...(p.knock ? { kn: [p.knock.id, +p.knock.ax.toFixed(2), +p.knock.az.toFixed(2)] } : {}), // 맞음 움찔 (#107)
      ht: hitOut, yl: p.yellowUntil > Date.now() ? 1 : 0,
      ...(extra ? extra() : {}),
    };
    // 동굴 (#195): 동굴 안에서는 진짜 자리 대신 입구 자리에 서 있는 것으로 (서버 이동 판정·자리 한도에 걸리지 않게). cv = 동굴 안
    // 같이 들어가기 (4번 조각): 진짜 동굴 자리는 cx·cz, 층 cv(1~), 오늘의 동굴 cd. 걷기·동작은 그대로 (같은 칸 사람에게만 감)
    if (netCave.at) { obj.cx = obj.x; obj.cz = obj.z; obj.x = netCave.at.x; obj.z = netCave.at.z; obj.cv = netCave.fi + 1; obj.cd = netCave.day; }
    const key = JSON.stringify(obj);
    if (!force && key === lastKey) return;
    lastKey = key; lastSent = now;
    if (withId) { idKey = ik; idT = now; }
    room.presence(obj).catch(() => {});
  }

  const prevP = new THREE.Vector3();
  const _tk = [0, 0, 0], _tks = [_tk];
  function update(dt) {
    const alone = !!solo?.(), mk = myCaveKey(), par = netCave.at && netCave.scene ? netCave.scene : scene;
    for (const e of peersById.values()) {
      if ((e.ck || '') !== mk) { e.runner.root.visible = false; if (e.label) e.label.visible = false; continue; } // 다른 칸(동굴·오름, 다른 층) 사람은 안 보임 (#195)
      if (e.waitPr) { e.runner.root.visible = false; applyPeer(e.waitPr); } // 칸이 막 같아짐: 받아 둔 마지막 상태로 다시 놓음
      if (e.runner.root.parent !== par) { par.add(e.runner.root); if (par === scene) cull?.()?.add(e.runner.root, { dynamic: true, shadow: false }); else cull?.()?.remove(e.runner.root); } // 동굴 안이면 동굴 장면에 그림 (멀리 감추기는 오름에서만)
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
    const mk = myCaveKey();
    for (const e of peersById.values()) { if ((e.ck || '') !== mk) continue; const d = e.pos.distanceTo(player.pos); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  function hitPeer(peerId) { hitOut = { p: peerId, at: Date.now() }; send(true); setTimeout(() => { if (hitOut && hitOut.p === peerId) { hitOut = null; send(true); } }, 4000); }

  // 쉬러 가기 (#157): 서버 방이면 나갔다가 다시 들어옴 (방 핸들러·더미 잇기는 그대로, hi 로 다시 맞춤). 서버가 없으면 아무 일 없음
  function rest() { if (room?.sleep) { room.sleep(); for (const id of [...peersById.keys()]) removePeer(id); } }
  function wake() { if (room?.wake) { idKey = ''; room.wake(); } }

  return { start, send, update, rest, wake, get room() { return room; }, nearestPeer, hitPeer, hand, peersById, test: { fake: applyPeer, drop: removePeer }, // test: 가짜 사람 넣기·빼기 (#79 성능 재기)
     get myPeer() { return myPeer; }, get solo() { return !!solo?.(); }, get ready() { return ready; }, get count() { return peersById.size; } };
}
