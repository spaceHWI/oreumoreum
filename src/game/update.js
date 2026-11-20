// 매 프레임 갱신(updatePlayer·frame), 해돋이 보기, 멀리 있는 작은 물체 감추기 (#86 에서 main.js 를 나눔. 파일 순서는 src/main.js, 규칙은 notes/prototype-v1.md 코드 구조)
import { PERF, SHOES, COLLIDE, BOAR, BOW, BLOOM_FX, HAIR, PACE, DEER } from '../balance.js';
import { PERF_LOCK, createFarCull } from '../quality.js';
import { startAssets, onAnyAsset } from '../assets.js';
import { onestore } from '../onestore.js';
import * as THREE from 'three';
import { height, groundAt, surfaceAt } from '../world.js';
import { G } from '../gfx2.js';
import { THROW } from '../runner.js';
import { sunDir } from '../sun.js';
import { kstDate } from '../achievements.js';
import { isEmote, EMOTE_BY } from '../emotes.js';
import { state, late } from './state.js';
import { $, wrapA, save, lookS, ab, persist, MAP_ID } from './save.js';
import { renderer, quality, retro, post, scene, NSW, camera, resize, sun, applyQuality, fill, rim, SUN_DIR, clouds, wx, eoksaeMat, grass, motes, prints, spots, lamps, sunState, lampNight, applySky, sunEvent } from './scene.js';
import { benchPos, benchOut, life, cairns, layoutCairn, stepCairn, fillCairn, tickCairnLod, col, wallPl, wall, stream, jeongReady, jeong, openJeong, shopsBuilt, STN, SAL, LEAPB, buff, trash, CH, CHS, bloom, bfx, cart, runner, rig, player, hp } from './place.js';
import { cam, camTarget, followCam, titleCam, ease } from './camera.js';
import { ui, topFit, toast, tickTips, updateStats, busy, ach, tickBanner, refreshAchUI } from './hud.js';
import { keys, ptrs, joy, marker, setGait } from './input.js';
import { bowReady, setHoldBow, aimHeading, releaseTangerine, releaseArrow, tickAimMark, tickEdgeAim } from './throw.js';
import { dismountRide, rideWant, tickRideZone, tickCartRide, tickCartMark } from './ride.js';
import { tickJump, photoPose, tickQueue, tickPhoto, capture } from './moves.js';
import { net, social, photog, tmp, alertMark } from './room.js';
import { mealS, tickMeal, cutS, tickCut, tickLeap, updateBuffUI, tickShopMark } from './stores.js';
import { toolNow, tickPick, tickFly, tickZone } from './pickup.js';
import { tickDump, tickAutoGo, tickChArrow, updateContext } from './dump.js';
import { leaving, leaveTo } from './look.js';
import { sound, tickKnock, _kq, _ka, enemyWarn, dumpWarn, dumpers, threatNear } from './hooks.js';
import { tickPace, pace } from './pace.js';
import { deerNet } from './deernet.js';

Object.assign(late, { checkViewpoint, placeRunner }); // 앞 파일에서 부르는 함수

// ---------- 갱신 ----------
function updatePlayer(dt) {
  const p = player;
  p.poseT += dt;
  if (hp.isDown) { marker.visible = false; placeRunner(dt); return; } // 쓰러져 들것에 실려 가는 중 (#36)
  if (stream && stream.update(dt, p)) { marker.visible = false; placeRunner(dt); return; } // 개울에 빠져 건져 올려지는 중 (#31)
  if (p.cart) { tickCartRide(dt); return; } // 마차에 앉아 실려 가는 중 (#69)
  if (p.ride || p.rideAuto) tickRideZone(dt); // 개울·밟는 구조물·가게 안이면 내리고, 벗어나면 다시 탐 (#69)
  state.emo?.tick(dt); // 동작 시간·말풍선·방향 표시 (#76)
  const aiming = (p.pose === 'throw' || p.pose === 'bow') && !!state.throwAim;
  if (aiming) p.heading += wrapA(aimHeading(state.throwAim) - p.heading) * Math.min(1, dt * 18); // 겨눈 대상 쪽으로 몸을 돌림
  if (p.pose === 'throw') { if (state.throwPending && p.poseT >= THROW.release) releaseTangerine(); if (p.poseT >= THROW.total) p.pose = 'move'; }
  else if (state.throwPending) { state.throwPending = false; state.throwAim = null; }
  if (p.pose === 'bow') { if (state.bowPending && p.poseT >= BOW.release) releaseArrow(); if (p.poseT >= BOW.total) p.pose = 'move'; } // 귤 활 (#38)
  else if (state.bowPending) { state.bowPending = false; state.throwAim = null; }
  if (state.holdBow && !bowReady()) setHoldBow(false); // 깨끗한 오름으로 바꾸면 활을 내려놓음
  if (state.cheerQ > 0) { state.cheerQ -= dt; if (p.pose === 'move' && !p.air && !busy()) { state.cheerQ = 0; p.pose = 'cheer'; p.poseT = 0; } } // 더미를 다 치우면 기뻐함 (#65), 줍던 동작이 끝난 뒤
  if (p.pose === 'cheer' && p.poseT > BLOOM_FX.cheerT) p.pose = 'move';
  if (p.pose === 'crouch' && p.poseT > 1.0) p.pose = 'move';

  let dir = null;
  if (!busy() && !p.knock && p.pose !== 'photo-wait') {
    let fx = 0, fz = 0;
    if (keys.has('w') || keys.has('arrowup')) fz -= 1;
    if (keys.has('s') || keys.has('arrowdown')) fz += 1;
    if (keys.has('a') || keys.has('arrowleft')) fx -= 1;
    if (keys.has('d') || keys.has('arrowright')) fx += 1;
    if ((fx || fz || (joy.active && Math.hypot(joy.x, joy.y) > 0.15) || p.target) && (isEmote(p.pose) || p.pose === 'wave' || p.pose === 'cheer')) p.pose = 'move'; // 걷기 시작하면 동작이 끊김 (#76, 앉기·눕기 포함)
    const jm = Math.hypot(joy.x, joy.y);
    if (joy.active && jm > 0.15) {
      // 조이스틱: 화면 기준 방향 (카메라가 보는 쪽이 위)
      p.target = null; p.onArrive = null; marker.visible = false;
      const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
      dir = new THREE.Vector3(joy.x * c + joy.y * s, 0, -joy.x * s + joy.y * c).normalize();
      p.joyMag = jm;
      if (!p.riding && !aiming) { let dh = wrapA(Math.atan2(dir.x, dir.z) - p.heading); p.heading += dh * Math.min(1, dt * 10); }
      if (ptrs.size === 0 && state.camHold <= 0) { const dy = wrapA((p.heading + Math.PI) - cam.yaw); cam.yaw += dy * Math.min(1, dt * 0.8); }
    } else if (fx || fz) {
      p.target = null; p.onArrive = null; marker.visible = false; p.joyMag = 1;
      if (fx) { if (p.riding) p.riding.heading -= fx * dt * 2.6; else if (!aiming) p.heading -= fx * dt * 2.6; }
      const hh = p.riding ? p.riding.heading : p.heading;
      if (fz) dir = new THREE.Vector3(Math.sin(hh), 0, Math.cos(hh)).multiplyScalar(-fz);
      const dy = wrapA((hh + Math.PI) - cam.yaw);
      if (ptrs.size === 0 && state.camHold <= 0) cam.yaw += dy * Math.min(1, dt * (fz ? 3 : 1.5));
    } else if (p.target) {
      p.joyMag = 1;
      tmp.copy(p.target).sub(p.pos).setY(0);
      const d = tmp.length();
      if (d < (p.onArrive ? 0.35 : 0.8)) { p.target = null; marker.visible = false; const cb = p.onArrive; p.onArrive = null; if (cb) cb(); }
      else dir = tmp.normalize();
    }
  }
  p.driving = !!dir;
  if (dir && state.fishing?.active) state.fishing.stop(); // 움직이면 낚시를 그만둠 (#44)
  if (p.riding) {
    const d = p.riding;
    const want = dir ? (p.running ? DEER.rideRun : DEER.rideWalk) * (p.joyMag > 0.75 || !joy.active ? 1 : 0.6) : 0;
    d.speed += (want - d.speed) * Math.min(1, dt * 5);
    if (dir && (joy.active || p.target)) d.heading += wrapA(Math.atan2(dir.x, dir.z) - d.heading) * Math.min(1, dt * 6);
    if (d.speed > 0.05) {
      let nx = d.pos.x + Math.sin(d.heading) * d.speed * dt, nz = d.pos.z + Math.cos(d.heading) * d.speed * dt;
      const cl = spots.clamp(nx, nz); if (cl) { nx = cl.x; nz = cl.z; }
      if (col) { const r = col.move(d.pos.x, d.pos.z, nx, nz, 0.9); nx = r.x; nz = r.z; }
      const moved = Math.hypot(nx - d.pos.x, nz - d.pos.z);
      d.pos.set(nx, height(nx, nz), nz);
      d.phase += dt * d.speed * 1.4;
      p.hoofAcc = (p.hoofAcc || 0) + d.speed * dt; if (p.hoofAcc > 1.6) { p.hoofAcc = 0; sound.step(surfaceAt(nx, nz), true); }
      p.rideAcc = (p.rideAcc || 0) + moved * 1.9; if (p.rideAcc >= 10) { ach.emit('ride-dist', Math.floor(p.rideAcc)); p.rideAcc %= 1; p.rideAcc = 0; }
    }
    p.heading = d.heading; p.speed = d.speed;
    p.pos.copy(d.pos);
    checkViewpoint();
    runner.root.position.copy(p.pos); runner.root.position.y += (d.seatY ?? 0.95) + (d.speed > 4 ? Math.abs(Math.sin(d.phase * 0.5)) * 0.25 : 0);
    if (d.seatZ) { runner.root.position.x += Math.sin(d.heading) * d.seatZ; runner.root.position.z += Math.cos(d.heading) * d.seatZ; } // 노루 등 (#2)
    runner.root.rotation.y = p.heading;
    followLight(); return;
  }
  const slow = joy.active && p.joyMag < 0.6;
  let want, acc = 8;
  if (p.ride) { const r = rideWant(dt, dir, slow); want = r.want; acc = r.acc; if (!dir && r.coast) dir = r.coast; } // 탈것 (#69): 신발·버프 없이 탈것 속도만
  else want = dir ? (slow ? 4 : p.running ? 10 : 5) * SHOES[save.equip.shoes - 1].speed * buff.mul('speed') : 0; // 신발 단계만큼 빨라짐
  p.speed += (want - p.speed) * Math.min(1, dt * acc);
  if (dir) {
    if (p.target) p.heading += wrapA(Math.atan2(dir.x, dir.z) - p.heading) * Math.min(1, dt * 12);
    let x = p.pos.x + dir.x * p.speed * dt, z = p.pos.z + dir.z * p.speed * dt;
    const cl = spots.clamp(x, z);
    if (cl) { x = cl.x; z = cl.z; if (cl.hit && (!p.wallToast || performance.now() - p.wallToast > 8000)) { p.wallToast = performance.now(); toast(cl.hit); } }
    { const g = spots.gateHint; if (g && Math.hypot(x - g.x, z - g.z) < g.r && (!p.wallToast || performance.now() - p.wallToast > 8000)) { p.wallToast = performance.now(); toast(g.line); } }
    if (col && p.pose !== 'sit') { const want = p.speed * dt, r = col.move(p.pos.x, p.pos.z, x, z); x = r.x; z = r.z;
      // 탭 이동 중 사물에 막혀 못 나아가면 멈춤 (도착 콜백이 있고 거의 다 왔으면 도착으로 침)
      if (p.target && want > 0.01 && Math.hypot(x - p.pos.x, z - p.pos.z) < want * 0.3) { p.stuckT = (p.stuckT || 0) + dt;
        if (p.stuckT > COLLIDE.stuckT) { p.stuckT = 0; const cb = p.onArrive, near = Math.hypot(p.target.x - p.pos.x, p.target.z - p.pos.z) < 3; p.target = null; p.onArrive = null; marker.visible = false; if (cb && near) cb(); }
      } else p.stuckT = 0; }
    const moved = Math.hypot(x - p.pos.x, z - p.pos.z);
    if (spots.exits && !leaving) for (const ex of spots.exits) if (Math.hypot(x - ex.pos.x, z - ex.pos.z) < ex.r) { leaveTo(ex.id); break; }
    const gy = groundAt(x, z);
    // 계단 단 차이는 살짝 부드럽게 오르내림
    p.pos.set(x, gy, z);
    countSteps(moved);
    checkViewpoint();
  } else if (p.pose !== 'sit') p.pos.y = groundAt(p.pos.x, p.pos.z);
  if (p.pose === 'sit') p.pos.y = mealS.on ? STN.seat.y : cutS.on ? SAL.seat.y : benchPos.y;
  if (p.kb.lengthSq() > 0.01) {
    let nx = p.pos.x + p.kb.x * dt, nz = p.pos.z + p.kb.z * dt;
    const cl = spots.clamp(nx, nz); if (cl) { nx = cl.x; nz = cl.z; }
    if (col) { const r = col.move(p.pos.x, p.pos.z, nx, nz); nx = r.x; nz = r.z; }
    p.pos.set(nx, height(nx, nz), nz);
    p.kb.multiplyScalar(Math.max(0, 1 - dt * 2.2));
  }
  tickJump(dt); placeRunner(dt);
}
function countSteps(moved) {
  const p = player;
  if (p.ride && !p.rideC) { // 탈것 (#69): 걸음·발자국 대신 말은 발굽 소리
    if (p.ride === 'horse') { p.hoofAcc = (p.hoofAcc || 0) + moved; if (p.hoofAcc > 1.6) { p.hoofAcc = 0; sound.step(surfaceAt(p.pos.x, p.pos.z), true); } }
    return;
  }
  p.strideAcc += moved;
  const stride = p.running ? 1.7 : 1.1;
  let n = 0;
  while (p.strideAcc >= stride) { p.strideAcc -= stride; p.steps++; save.totalSteps++; n++; sound.step(surfaceAt(p.pos.x, p.pos.z), p.running); if (!p.air && !p.riding) prints.stamp(p.pos.x, p.pos.z, p.heading, p.running ? 1 : 0); }
  if (n) ach.emit('steps', n);
}
function checkViewpoint() {
  if (player.viewSeen || !spots.isViewpoint(player.pos)) return;
  player.viewSeen = true; state.awe = 4; toast(spots.viewpointLine);
  ach.emit('view-' + MAP_ID);
}
export function placeRunner(dt = 1) {
  // 계단·턱: 논리 위치는 땅에 딱 붙이고, 보이는 높이만 부드럽게 따라가 덜그럭거림을 없앰 (큰 낙차는 바로 반영)
  // 비탈처럼 걸음에 비례해 이어지는 높이 변화는 바로 따라가고(늦게 따라가면 오르막에서 하반신이 땅에 묻힘), 계단처럼 툭 끊기는 변화만 부드럽게.
  // 남은 차이는 땅보다 낮을 때 더 빨리 메움
  { const p = player, run = Math.hypot(p.pos.x - (p.prevX ?? p.pos.x), p.pos.z - (p.prevZ ?? p.pos.z)), dyG = p.pos.y - (p.prevY ?? p.pos.y);
    p.prevX = p.pos.x; p.prevY = p.pos.y; p.prevZ = p.pos.z;
    if (Math.abs(dyG) <= run * 1.4 + 0.004) p.visY += dyG;
    const dy = p.pos.y - p.visY; p.visY = Math.abs(dy) > 1.6 || p.riding || p.cart || p.air ? p.pos.y : p.visY + dy * Math.min(1, dt * (dy > 0 ? 18 : 9)); }
  runner.root.position.copy(player.pos); runner.root.position.y = player.visY + player.jumpY + rig.lift(); // 탈것 판·안장 높이 (#69)
  runner.root.rotation.y = player.heading;
  { const k = player.knock; if (k && k.ang > 0.001) { runner.root.rotation.y = player.heading + k.spin; _ka.set(k.ax, 0, k.az).normalize(); _kq.setFromAxisAngle(_ka, k.ang); runner.root.quaternion.premultiply(_kq); } }
  { const L = hp.lie; if (L.ang > 0.001) { const h = player.heading; _ka.set(-Math.cos(h), 0, Math.sin(h)); _kq.setFromAxisAngle(_ka, L.ang); runner.root.quaternion.premultiply(_kq); runner.root.position.y += L.y; } } // 뒤로 누움 (#36)
  followLight();
}
const shadowFocus = new THREE.Vector3(), camFwd = new THREE.Vector3();
function followLight() {
  // 그림자 영역을 카메라가 보는 쪽으로 밀어 해상도를 아낌 (뒤쪽은 어차피 안 보임)
  if (NSW) { NSW.followLight(sun, player.pos, SUN_DIR); return; }
  camera.getWorldDirection(camFwd); camFwd.y = 0; if (camFwd.lengthSq() > 0.01) camFwd.normalize();
  shadowFocus.copy(player.pos).addScaledVector(camFwd, 22);
  sun.target.position.copy(shadowFocus); sun.position.copy(shadowFocus).addScaledVector(SUN_DIR, 600);
  fill.target.position.copy(player.pos); fill.position.copy(sun.position);
  rim.target.position.copy(player.pos); rim.position.copy(player.pos).addScaledVector(new THREE.Vector3(-SUN_DIR.x, 0.35, -SUN_DIR.z).normalize(), 300);
}

// 해돋이·해넘이 보기: 정상 근처에서 해 쪽을 8초 바라보면 인정
let sunWatchT = 0;
function tickSunWatch(dt) {
  const ev = sunEvent(); if (!ev) { sunWatchT = 0; return; }
  if (player.pos.distanceTo(spots.sunWatch.pos) > spots.sunWatch.r && !spots.isViewpoint(player.pos)) { sunWatchT = 0; return; }
  const look = new THREE.Vector3(); camera.getWorldDirection(look); look.y = 0; look.normalize();
  const sd = sunDir(Math.max(0, sunState.el), sunState.az).setY(0).normalize();
  if (look.dot(sd) > 0.75) sunWatchT += dt; else sunWatchT = Math.max(0, sunWatchT - dt * 0.5);
  const key = ev + '-' + kstDate();
  if (sunWatchT > 8 && save.sunSeen !== key) {
    save.sunSeen = key; persist();
    toast(ev === 'sunrise' ? '오늘의 해돋이를 봤어요' : '오늘의 해넘이를 봤어요');
    ach.emit(ev); ach.emit('sun-watch');
  }
}

let last = performance.now(); let saveT = 0; state.awe = 0; state.aweBack = 0; let skyT = 0;
let slowT = 0, fastT = 0;
function adaptQuality(dt) { // 자동일 때만: 느리면 한 단계씩 내리고(픽셀 배율 → 그림자 끔), 오래 빠르면 시작 단계까지 되돌림
  if (!quality.auto || PERF_LOCK || document.hidden) { slowT = fastT = 0; return; }
  if (dt >= PERF.slowDt) { slowT += dt; fastT = 0; } else if (dt < PERF.fastDt) { fastT += dt; slowT = 0; }
  if (slowT > PERF.slowT && quality.level > 0) { quality.level--; slowT = 0; applyQuality(); }
  if (fastT > PERF.fastT && quality.level < quality.tier) { quality.level++; fastT = 0; applyQuality(); }
}
applyQuality();

const tmpDir = new THREE.Vector3(); const compassDial = $('xy-north'), xyX = $('xy-x'), xyZ = $('xy-z'); let compassRot = null, xyTxt = '', xyDk = '';
function frame(now) {
  if (state.osPaused) { last = now; requestAnimationFrame(frame); return; } // 원스토어 앱이 멈춤(pause)을 보냄 (#97): 그리지도 움직이지도 않음
  const rawDt = (now - last) / 1000; const dt = Math.min(0.05, rawDt) * (state.hitStop > 0 ? PACE.hitStopK : 1); last = now; // 맞힌 순간 짧은 멈춤 (#89)
  tickPace(Math.min(0.05, rawDt), now / 1000);
  state.camHold = Math.max(0, state.camHold - dt);
  hp.tryBegin(player, BOAR.rollT); hp.update(dt, player); player.down = hp.isDown || hp.pending;
  if (cart) cart.update(dt, Date.now() / 1000 + state.cartShift, camera.position); // 마차 (#69): 앉은 사람이 따라가게 먼저
  tickAutoGo(); updatePlayer(dt); tickKnock(dt); if (trash) { trash.update(dt, player.pos); tickPick(dt); tickFly(dt); tickZone(dt); } if (bloom) bloom.update(dt, player.pos, now / 1000); if (bfx) { bfx.update(dt, now / 1000); if (state.camPullT >= 0) { state.camPullT += dt; if (state.camPullT > BLOOM_FX.zone.camT) state.camPullT = -1; } } if (CH) { CHS.forEach((c) => c.update(dt, lampNight)); tickDump(dt); tickChArrow(); } shopsBuilt.forEach((sh) => sh.update?.(dt, lampNight)); tickCartMark(); if (STN) tickMeal(dt); if (SAL) tickCut(dt); if (LEAPB) tickLeap(); if (shopsBuilt.length) tickShopMark(); buff.tick(); updateBuffUI(); late.devLabels.update(dt); if (!lookS.open) late.tut.update(dt); if (jeong) { jeong.update(dt); if (!jeong.isOpen && jeongReady()) openJeong(); } lamps.update(player.pos, lampNight); state.farCull?.update(dt);
  net.update(dt); net.send(false);
  if (state.sessionOn && !document.hidden) ab.tick(rawDt); // 서버별 플레이 시간 (#35)
  deerNet.tick(dt); // 멀티 노루 (#92)
  life.update(dt, now / 1000); dumpers?.update(dt, now / 1000);
  social.tickBubbles(); tickQueue(); tickSunWatch(dt); tickBanner(dt);
  if (state.awe > 0) { state.awe -= dt; cam.dist += (24 - cam.dist) * Math.min(1, dt * 1.5); cam.pitch += (0.12 - cam.pitch) * Math.min(1, dt * 1.5); cam.yaw += dt * 0.35; if (state.awe <= 0) state.aweBack = 2; }
  if (state.aweBack > 0 && !ptrs.size) { state.aweBack -= dt; cam.dist += (13 - cam.dist) * Math.min(1, dt * 2); cam.pitch += (0.32 - cam.pitch) * Math.min(1, dt * 2); }
  adaptQuality(rawDt);
  tickPhoto(dt);
  if (photog) { photog.setRain(wx.kind === 'rain'); photog.update(dt, player, { shooting: !!state.photoState }); } // 사진사 (#70): 비 오면 노란 우비
  runner.setTint(Date.now() < player.yellowUntil);
  if (net.hand.hitBy && net.hand.hitBy.at > (player.lastHitAt || 0)) { player.lastHitAt = net.hand.hitBy.at; player.yellowUntil = Date.now() + 6000; toast(`${net.hand.hitBy.nick}이(가) 던진 귤에 맞았어요`); net.send(true); }
  if (player.ride && (player.pose === 'sit' || mealS.on || cutS.on || state.photoState || state.fishing?.active || cam.mode === 'leap' || hp.isDown || player.rescue || player.knock)) dismountRide(); // 다른 일을 시작하면 내림 (#69)
  const pose = player.flail ? 'flail' : player.riding ? 'ride' : player.cart ? 'sit' : player.ride ? rig.pose() || 'move' : player.knock && !player.air ? 'crouch' : player.pose === 'photo-wait' ? 'move' : player.pose === 'photo' ? photoPose : player.pose;
  const fx = Math.sin(player.heading) * 0.6, fz = Math.cos(player.heading) * 0.6; // 진행 방향 비탈 (오르막 +)
  const slope = (groundAt(player.pos.x + fx, player.pos.z + fz) - groundAt(player.pos.x - fx, player.pos.z - fz)) / 1.2;
  const rideStill = !!player.cart || rig.still(); rig.tick(dt, player.speed); // 탈것 (#69)
  runner.animate(dt, { speed: rideStill ? 0 : player.speed, running: player.running, pose, t: player.poseT, edur: EMOTE_BY[player.pose]?.dur || 2, over: state.emo.overlay() && { ...state.emo.overlay(), dur: EMOTE_BY[state.emo.overlay().id].dur }, air: player.air && !rideStill, jumpV: player.jumpV, slope: player.riding || rideStill ? 0 : Math.max(-1, Math.min(1, slope)), tool: save.equip.tool, dur: toolNow().time, rod: state.fishing ? state.fishing.elev : 0.4, face: hp.isDown ? 'shut' : player.knock ? 'wide' : null });
  state.fishing?.update(dt); // 낚싯대·찌는 손 위치를 따라감 (#44)
  marker.rotation.z += dt;
  tickCairnLod(dt);
  cairns.forEach((c) => { if (c.anim > 0) { stepCairn(c, dt); fillCairn(c, c.want || 1); } if (c.drop > 0) { c.drop = Math.max(0, c.drop - dt * 4); c.im.position.y = c.drop * c.drop; } });
  clouds.rotation.y += dt * 0.012;
  { // 좌표 (#75, 나침반 대신): X·Z 정수 + 화면이 보는 방향 기준 북쪽(-z) 화살표
    camera.getWorldDirection(tmpDir); const ang = Math.atan2(tmpDir.x, -tmpDir.z) * 180 / Math.PI;
    const r = Math.round(-ang); if (r !== compassRot) { compassRot = r; compassDial.setAttribute('transform', `rotate(${r})`); }
    const X = Math.round(player.pos.x), Z = Math.round(player.pos.z), xs = X + ',' + Z;
    if (xs !== xyTxt) { const dk = `${String(X).length},${String(Z).length}`; if (dk !== xyDk) { xyDk = dk; topFit.dirty(); } xyTxt = xs; xyX.textContent = X; xyZ.textContent = Z; } // 자릿수가 바뀔 때만 폭 다시 잼
  }
  topFit.tick(dt);
  G.uT.value = now / 1000; G.uP.value.copy(player.pos); if (player.air) G.uP.value.y = 1e6;
  wx.update(dt, player.pos, wx.cur.wind); sound.setRain?.(wx.cur.snd); state.wxT -= dt; if (state.wxT <= 0 && !wx.settled) { state.wxT = 0.25; applySky(); }
  prints.update(dt); grass.update(player.pos, camera.position); if (save.gfx !== 'lite') motes.update(player.pos, now / 1000, dt, lampNight);
  if (eoksaeMat) eoksaeMat.userData.wind.value = now / 1000;
  if (eoksaeMat?.userData.push) {
    const arr = eoksaeMat.userData.push.value; let n = 0;
    const add = (pos, w) => { if (n < 8 && Math.abs(pos.x - player.pos.x) < 45 && Math.abs(pos.z - player.pos.z) < 45) arr[n++].set(pos.x, pos.z, w, 0); };
    add(player.pos, player.air ? 0.3 : 1);
    for (const e of net.peersById.values()) add(e.pos, 1);
    for (const d of life.deer) if (d.speed > 0.3) add(d.pos, 0.8);
    for (const h of life.horses || []) if (h.speed > 0.3) add(h.pos, 1);
    for (; n < 8; n++) arr[n].z = 0;
  }
  skyT -= dt; if (skyT <= 0) { skyT = 20; applySky(); }

  if (cam.mode === 'free') { /* 디버그 */ }
  else if (cam.mode === 'follow') followCam(dt, false);
  else if (cam.mode === 'title') titleCam(dt);
  else if (cam.mode === 'leap') { // LEAP 입어 보기 (#59): 골목 쪽 가까이에서(맞은편 가게에 안 묻히게). 폰은 아래 시트 위로 캐릭터가 오게 내려다봄
    const narrow = innerWidth <= 600, yaw = player.heading, look = player.pos.clone();
    if (narrow) look.y -= 0.35; else { look.y += 1.1; look.add(new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(1.5)); }
    const d = narrow ? 7 : 5.5;
    camTarget.look.copy(look); camTarget.pos.set(look.x + Math.sin(yaw) * d, player.pos.y + (narrow ? 1.5 : 1.6), look.z + Math.cos(yaw) * d);
    ease(dt, false, 6);
  } else if (cam.mode === 'wardrobe') {
    const narrow = innerWidth <= 600;
    const look = player.pos.clone(); look.y += narrow ? -1.6 : 1.25;
    const yaw = player.heading;
    if (!narrow) look.add(new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(-1.4));
    camTarget.look.copy(look);
    const d = narrow ? 10 : 4.6;
    camTarget.pos.set(look.x + Math.sin(yaw) * d, look.y + (narrow ? 2.2 : 0.5), look.z + Math.cos(yaw) * d);
    ease(dt, false, 6);
  } else if (cam.mode === 'look') { // 캐릭터 고르기 (#51): 캐릭터 둘레를 천천히 돎. 아래 카드에 가리지 않게 캐릭터를 화면 가운데 조금 위에
    lookS.t += dt;
    const narrow = innerWidth <= 600, look = player.pos.clone(); look.y += narrow ? 0.75 : 1.0;
    const yaw = player.heading + lookS.t * HAIR.spin, d = narrow ? 7.2 : 6.2;
    camTarget.look.copy(look); camTarget.pos.set(look.x + Math.sin(yaw) * d, look.y + 0.9, look.z + Math.cos(yaw) * d);
    ease(dt, false, 6);
  } else if (cam.mode === 'sit') {
    const tan = new THREE.Vector3(-benchOut.z, 0, benchOut.x);
    const look = player.pos.clone().addScaledVector(benchOut, 22).addScaledVector(tan, -16); look.y -= 7;
    camTarget.look.copy(look);
    camTarget.pos.copy(player.pos).addScaledVector(tan, 6.5).addScaledVector(benchOut, -1.5);
    camTarget.pos.y = Math.max(player.pos.y + 3.4, height(camTarget.pos.x, camTarget.pos.z) + 2);
    ease(dt, false, 1.5);
  } else if (cam.mode === 'photo') ease(dt, false, 4);

  updateContext(); tickAimMark(now / 1000); tickEdgeAim();
  if (state.toastT > 0) { state.toastT -= dt; if (state.toastT <= 0) ui.toast.hidden = true; }
  tickTips(dt);
  if (sound.music) { sound.setThreat(threatNear() || pace.threat()); sound.setDuck(mealS.on || cutS.on); } // 배경 음악 (#64)
  enemyWarn.update(dt); dumpWarn.update(dt); alertMark.visible = life.enemies.near(player.pos, 40); if (alertMark.visible) alertMark.position.y = 3.0 + Math.abs(Math.sin(now / 150)) * 0.3;
  updateStats();
  saveT += dt; if (saveT > 5) { saveT = 0; persist(); }
  if (NSW) { NSW.update(dt, player.pos, camera); wallPl.value.copy(player.pos); wall.update(player.pos); jeong?.lod(player.pos); renderer.render(scene, camera); }
  else if (save.gfx === 'smooth' && post.ok) post.render(scene, camera); else retro.render(scene, camera);
  if (state.captureNext) { state.captureNext = false; capture(); }
  if (!warmed) { warmed = true; setTimeout(warm, 30); }
  requestAnimationFrame(frame);
}

// 첫 화면 (#85): 첫 프레임이 그려지면 로고 화면이 떠 있는 동안 셰이더를 미리 준비(compileAsync)해 시작 버튼 뒤 멈칫함을 없애고,
// 따로 받는 모델(assets.js)을 받기 시작한다. 모델이 와서 갈아 끼울 때마다 새 재질도 미리 준비
let warmed = false;
function warm() {
  const prep = () => renderer.compileAsync(scene, camera).catch(() => {});
  prep().then(() => { state.shadersReady = true; onestore.ready(); }); // 첫 화면 준비 끝 → 원스토어 startGameAsync (#97)
  setTimeout(() => onestore.ready(), 3000); // 셰이더 준비가 늦어도 앱 로딩 화면이 오래 남지 않게
  startAssets();
  let t = 0; onAnyAsset(() => { clearTimeout(t); t = setTimeout(prep, 250); });
}

addEventListener('resize', resize);
resize();
cairns.forEach(layoutCairn);
applySky();
refreshAchUI();
setGait(0);
followCam(0, true);
// 멀리 있는 작은 물체 감추기 (#79): 여러 메시로 된 작은 무리(하르방·NPC·가게 소품·동물 등). 지형·나무·돌담 같은 큰 것과 InstancedMesh 는 제 LOD 가 따로 있음
state.farCull = createFarCull(camera, quality.tier);
{
  const lifeG = life.deer[0]?.root.parent || null;
  const draws = (o) => { let n = 0; o.traverse((c) => { if ((c.isMesh && !c.isInstancedMesh) || c.isSprite) n++; }); return n; };
  for (const o of scene.children) {
    if (o === runner.root || o === lifeG || o.isMesh || o.isPoints || o.isSprite || o.isLight || o.name === 'halla') continue;
    if (draws(o) < 3) continue;
    state.farCull.add(o);
  }
  if (lifeG) for (const c of lifeG.children) if (draws(c) >= 2) state.farCull.add(c, { dynamic: true });
}
requestAnimationFrame(frame);
