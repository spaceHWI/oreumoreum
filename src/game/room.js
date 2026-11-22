// 함께(net·social), 이모트 연결, 사진사 NPC, 입장 세션 (#86 에서 main.js 를 나눔. 파일 순서는 src/main.js, 규칙은 notes/prototype-v1.md 코드 구조)
import { PERF, NET, DAILY } from '../balance.js';
import { TIER } from '../quality.js';
import { createPhotographer } from '../photographer.js';
import * as THREE from 'three';
import { height, groundAt } from '../world.js';
import { LOW } from '../gfx2.js';
import { buildRunner, DEFAULT_OUTFIT } from '../runner.js';
import { createNet } from '../net.js';
import { createSocial } from '../social.js';
import { roomFor } from '../server.js';
import { createEmotes } from '../emotes.js';
import { createWsLobby, linkTrash } from '../online.js';
import { state, late } from './state.js';
import { $, save, ab, persist, MAP_ID } from './save.js';
import { scene, camera, spots } from './scene.js';
import { P, summitOut, summitTan, photoSpot, cairns, layoutCairn, col, trash, runner, player, hp, NS_TUT } from './place.js';
import { toast, nearestHeapPos, ach } from './hud.js';
import { emoRiding, emoCan, doEmote } from './menu.js';
import { rideCode, peerRide } from './ride.js';

// ---------- 함께 (room) ----------
export const net = createNet({
  scene, player, save, roomName: () => roomFor('oreum-' + MAP_ID), // 서버별 방 (#35)
  lobby: createWsLobby({ token: () => state.account?.token }), onRoom: (room) => { // 멀티 서버 (#7)
    if (!room.on) return;
    late.mpRoom = room; // 지금 접속 (#186): 내 방 채널 (admonline.js)
    if (trash) linkTrash(trash, room);
    // 같이 있는 사람 수 (#131): 방이 센 '움직이는 사람' 수 → 투기꾼·몹 간격과 양 (game/pace.js, dumpers.js). 끊기면 혼자
    state.crowd = 1;
    const setCrowd = (n) => { state.crowd = Number.isFinite(n) && n >= 1 ? Math.min(NET.roomCap, n) : 1; late.dumpers?.setPlayers(state.crowd); };
    room.on('hi', (m) => { setCrowd(m.np); if (m.fill > 0) late.dumpers?.offlineMsg?.(m.fill); }); // fill: 빈 방이던 동안 방이 채운 수
    room.on('np', (m) => setCrowd(m.n));
    room.on('close', () => setCrowd(1));
    late.deerNet?.link(room); // 노루 무리·노루 타기 (#92, deernet.js)
    late.guardNet?.link(room); // 구역 지킴이 돌하르방 세운 시각 (#119, guard.js)
    late.bossNet?.link(room); // 구역 우두머리 (#139, boss.js)
    late.raidNet?.link(room); // 오름 레이드 (#181, raid.js)
    late.caveNet?.link(room); // 동굴 적 같이 보기 (#205, caveshare.js)
    late.endNet?.link(room); // 엔딩 시네마틱 (#168, ending.js)
    late.giveNet?.link(room); // 귤 주기 (#175, give.js)
    // 서버가 이동을 되돌림 (#84): 너무 빠르거나 순간 이동이 잦으면 마지막으로 받아 준 자리로
    room.on('pos', (m) => { if (!Number.isFinite(m.x) || !Number.isFinite(m.z) || hp?.isDown) return; player.pos.set(m.x, height(m.x, m.z), m.z); player.visY = player.pos.y; player.speed = 0; if (player.riding) { player.riding.pos.copy(player.pos); player.riding.speed = 0; } late.placeRunner(); });
    room.on('kick', () => toast('연결이 잠시 끊겼어요. 조금 뒤에 다시 이어져요'));
  },
  extra: () => ({ ...(late.idleBeat?.() ? { a: 1 } : {}), ...(NS_TUT && !save.tut?.done ? { tu: 1 } : {}), ...social.presenceExtra(), rd: rideCode(), ...(player.cart ? { cs: player.cart.seat } : {}), dr: player.riding?.id || '', ...(state.emo ? state.emo.presence() : {}), ...(late.armsPresence ? late.armsPresence() : {}), ...(late.chargePresence ? late.chargePresence() : {}), ...(late.giveExtra ? late.giveExtra() : {}), ...(late.swarmExtra ? late.swarmExtra() : {}) }), /* tu = 튜토리얼 중(방이 사람 수에서 뺌, #131), wf = 무기 사건 (#123), rd = 탈것 (#69), cs = 마차 자리 (#120), dr = 탄 노루 (#92), em = 동작 (#76) */
  rideHook: (e, dt) => peerRide(e, dt),
  overHook: (e) => state.emo?.overlayPeer(e),
  cull: () => state.farCull, animR: PERF.peerAnimR[TIER], shadowR: PERF.peerShadowR[TIER], // 멀리 있는 사람 (#79)
  onToast: (m) => toast(m),
  solo: () => !!late.tut?.active, // #100 튜토리얼 중엔 혼자: 남이 안 보이고 내 모습도 안 보냄
}); late.net = net;
export const social = createSocial({ scene, net, save, onToast: (m) => toast(m), mapId: MAP_ID }); late.social = social;
state.emo = createEmotes({
  scene, player, save, persist, net, toast, sound: () => late.sound, camera, placeArrow: (el, wp, lift) => late.placeArrow(el, wp, lift), ui: document.body,
  can: emoCan, riding: emoRiding, heapPos: () => nearestHeapPos(), groundAt, myRoot: () => runner.root,
  faceTo: (x, z) => { player.heading = Math.atan2(x - player.pos.x, z - player.pos.z); },
  onEmote: () => { ach.emit('emote'); if (emoteMeet()) ach.emit('emote-meet'); }, // #125 오늘의 할 일 '다른 사람에게 인사': 가까이 사람이 있을 때(방에 아무도 없으면 그냥 인사도)
});
state.emo.onChoose = (id) => doEmote(id);
function emoteMeet() { const ps = [...net.peersById.values()]; return !ps.length || ps.some((e) => e.pos.distanceTo(player.pos) <= DAILY.meetR); }
state.emo.bindWheel($('emo-wheel'));
social.listeners.stones.push(() => cairns.forEach(layoutCairn));
social.start();
// 사진사 NPC (#70): 표지석 근처, 삼각대 옆
export const photog = spots.tutorial ? null : createPhotographer({ scene, social, P, out: summitOut, tan: summitTan, spot: photoSpot, height, buildRunner, outfit: DEFAULT_OUTFIT, col, low: LOW }); late.photog = photog;
// 입장할 때 한 번: 방 접속(서버가 정해진 뒤)·서버별 접속 기록
state.sessionOn = false;
export function startSession() { if (state.sessionOn) return; state.sessionOn = true; net.start(); ab.visit(); }
addEventListener('pagehide', () => ab.flush());
document.addEventListener('visibilitychange', () => { if (document.hidden) ab.flush(); });
export const tmp = new THREE.Vector3();
/* 내 머리 위 빨간 느낌표는 없앰 (#201): 위험은 화면 가장자리 붉은빛(#141)·적 방향 표시로 충분 */
