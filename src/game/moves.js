// 노루 타기, 점프, 벤치에 앉기, 돌탑 소원, 사진사 사진 (#86 에서 main.js 를 나눔. 파일 순서는 src/main.js, 규칙은 notes/prototype-v1.md 코드 구조)
import { PHOTOG } from '../balance.js';
import { logoSvg, svgUrl } from '../logo.js';
import * as THREE from 'three';
import { height, groundAt, surfaceAt } from '../world.js';
import { kstDate } from '../achievements.js';
import { state, late } from './state.js';
import { $, save } from './save.js';
import { renderer, spots } from './scene.js';
import { P, summitOut, summitTan, photoSpot, benchPos, benchOut, life, player } from './place.js';
import { cam, camTarget } from './camera.js';
import { toast, busy, closePanels, ach } from './hud.js';
import { pressBtn, marker, setTarget } from './input.js';
import { dismountRide, jumpOffCart } from './ride.js';

Object.assign(late, { dismountDeer, doJump, standUp }); // 앞 파일에서 부르는 함수

// 노루 타기. 멀티(서버 방)면 방에 먼저 물어 한 마리에 한 사람만 (#92, deernet.js). 방이 허락하면 now=true 로 다시 불림
export function mountDeer(d, now = false) {
  if (busy() || player.riding || player.cart) return;
  if (!now && late.deerNet?.claim(d)) return;
  if (player.ride) dismountRide();
  life.mount(d); player.riding = d; player.target = null; marker.visible = false;
  d.heading = player.heading; d.pos.y = height(d.pos.x, d.pos.z);
  toast('노루 등에 올라탔어요. 점프 버튼으로 내려요');
  ach.emit('ride');
}
export function dismountDeer() {
  const d = player.riding; if (!d) return;
  life.dismount(d); player.riding = null; late.deerNet?.release(d);
  player.pos.copy(d.pos).add(new THREE.Vector3(Math.cos(d.heading), 0, -Math.sin(d.heading)).multiplyScalar(1.2)); player.pos.y = height(player.pos.x, player.pos.z);
  player.speed = 0;
}

// 점프
const GRAV = 26;
function doJump() {
  const p = player;
  if (p.riding) { dismountDeer(); return; }
  if (p.cart) { jumpOffCart(); return; } // 마차에서 뛰어내림 (#69)
  if (busy() || p.air || p.knock) return; // 받혀 구르는 중엔 못 뜀 (#80: 기울어진 채 뜀)
  state.emo?.stop(); // 동작 중이면 끊고 뜀 (#76)
  p.air = true; p.jumpV = 8.5; p.jumpY = 0;
  late.sound.step(surfaceAt(p.pos.x, p.pos.z), true);
  ach.emit('jump'); late.tut.notify('jump');
}
pressBtn($('btn-jump'), () => doJump());
export function tickJump(dt) {
  const p = player; if (!p.air) { p.airOff = null; return; }
  // 공중에서 발밑 디딤판(징검돌·계단) 높이가 바뀌어도 몸 높이는 그대로 (#41: 돌에서 물 위로 뛸 때 툭 내려가던 것)
  const off = groundAt(p.pos.x, p.pos.z) - height(p.pos.x, p.pos.z);
  if (p.airOff != null) p.jumpY += p.airOff - off;
  p.airOff = off;
  p.jumpV -= GRAV * dt; p.jumpY += p.jumpV * dt;
  if (p.jumpY <= 0) { p.jumpY = 0; p.jumpV = 0; p.air = false; p.airOff = null; late.sound.step(surfaceAt(p.pos.x, p.pos.z), true); }
}

// 앉아 쉬기
export function sitDown() {
  setTarget(benchPos.clone().addScaledVector(benchOut, 0.9), () => {
    player.pos.copy(benchPos).addScaledVector(benchOut, 0.05);
    player.heading = Math.atan2(benchOut.x, benchOut.z);
    player.pose = 'sit'; player.poseT = 0; cam.mode = 'sit';
    $('sit-line').textContent = spots.bench.line;
    $('sitbar').hidden = false; document.body.classList.add('sitting');
    ach.emit('sit');
  });
}
export function standUp() {
  if (late.mealS.on) { late.finishMeal(); return; } // 식사 중이면 건너뛰기 (#50)
  if (late.cutS.on) { late.finishCut(); return; } // 머리 깎는 중이면 건너뛰기 (#58)
  player.pose = 'move'; cam.mode = 'follow';
  player.pos.addScaledVector(benchOut, 0.9); player.pos.y = height(player.pos.x, player.pos.z);
  $('sitbar').hidden = true; document.body.classList.remove('sitting');
}
$('btn-stand').addEventListener('click', standUp);

// 소원 돌탑: 창·쓰기·기도·신고는 wish.js (#127). 앞 파일(stores.js)이 부르는 자리만 여기
export function openWishes(c) { late.openWishes?.(c); }

// 표지석 인증샷 (줄서기) → 사진사 NPC (#70): 사진사에게 가서 '사진' → 손짓 → 사진 자리에 서서 포즈(3종 무작위, 다시 누르면 바뀜) → 3·2·1 → 찰칵
// 사진은 사진사 삼각대 카메라 자리에서 찍음(UI 없이). 가까이 있는 다른 사람도 그대로 함께 찍힘
state.photoState = null; let photoWaiting = false; state.captureNext = false; let photoBlob = null; let photoUrl = ''; let photoGo = 0; export { photoBlob };
const PHOTO_POSES = ['photo', 'photo-v', 'photo-point'];
export let photoPose = 'photo';
const nextPhotoPose = () => { const l = PHOTO_POSES.filter((k) => k !== photoPose); photoPose = l[Math.floor(Math.random() * l.length)]; return photoPose; };
const logoImg = new Image(); logoImg.src = svgUrl(logoSvg()); // 사진 틀에 넣을 로고 (#72·#87)
export function startPhoto() {
  late.social.joinQueue();
  late.photog?.beckon();
  const spot = photoSpot.clone().addScaledVector(summitOut, 2.5).addScaledVector(summitTan, -2);
  photoGo = PHOTOG.walkMax;
  setTarget(late.social.queueAhead() > 0 ? spot : photoSpot, () => {
    photoGo = 0;
    if (late.social.queueAhead() > 0) { photoWaiting = true; player.pose = 'photo-wait'; player.poseT = 0; $('queue').hidden = false; return; }
    beginPhoto();
  });
}
export function beginPhoto() {
  photoWaiting = false; $('queue').hidden = true;
  player.pos.copy(photoSpot);
  player.heading = late.photog ? Math.atan2(late.photog.camPos.x - photoSpot.x, late.photog.camPos.z - photoSpot.z) : Math.atan2(summitOut.x, summitOut.z);
  nextPhotoPose(); player.pose = 'photo'; player.poseT = 0;
  cam.mode = 'photo';
  if (late.photog) { camTarget.pos.copy(late.photog.camPos); camTarget.look.copy(late.photog.camLook); }
  else {
    const mid = P.stone.clone().lerp(photoSpot, 0.5);
    camTarget.look.copy(mid).setY(mid.y + 1.7);
    camTarget.pos.copy(mid).addScaledVector(summitOut, 8.5).addScaledVector(summitTan, 0.5);
    camTarget.pos.y = Math.max(mid.y + 2.6, height(camTarget.pos.x, camTarget.pos.z) + 1.5);
  }
  state.photoState = { t: 0, n: 3 };
  $('countdown').hidden = false; $('countdown').textContent = '3';
  late.sound.beep(false);
}
// 찍기 전에 다시 누르면 포즈가 바뀜
export const rePoseAct = { label: '포즈 바꾸기', ic: 'photo', act: () => { if (state.photoState && !state.photoState.shot) { nextPhotoPose(); player.poseT = 0; } } };
$('queue-cancel').addEventListener('click', () => { photoWaiting = false; late.social.leaveQueue(); $('queue').hidden = true; player.pose = 'move'; });
export function tickQueue() {
  if (!photoWaiting) return;
  const n = late.social.queueAhead();
  $('queue-n').textContent = n > 0 ? `앞에 ${n}명이 있어요 · 차례가 되면 다가가요` : '차례예요';
  if (n === 0) beginPhoto();
}
export function tickPhoto(dt) {
  // 사진 자리로 걸어가다 사진사·삼각대에 막히면(또는 너무 오래 걸리면) 바로 자리에 세움. 멀리 걸어가 버렸으면 그만둠
  if (photoGo > 0) { photoGo -= dt; const lost = !player.onArrive; if (lost || photoGo <= 0) { photoGo = 0; player.target = null; player.onArrive = null;
    if (!state.photoState && !photoWaiting && player.pos.distanceTo(photoSpot) < PHOTOG.r + 8) beginPhoto(); else late.social.leaveQueue(); } }
  if (!state.photoState) return;
  state.photoState.t += dt;
  const C = PHOTOG.count, n = 3 - Math.floor(state.photoState.t / C);
  if (n !== state.photoState.n && n > 0) { state.photoState.n = n; $('countdown').textContent = String(n); late.sound.beep(false); }
  if (state.photoState.t >= C * 3 && !state.photoState.shot) { state.photoState.shot = true; $('countdown').hidden = true; state.captureNext = true; }
}
export function capture() {
  late.sound.shutter();
  const flash = $('flash'); flash.hidden = false; flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
  const W = 960, src = renderer.domElement;
  const ph = Math.round(W * Math.min(1.25, src.height / src.width));
  const pad = 28, band = 150;
  const out = document.createElement('canvas'); out.width = W + pad * 2; out.height = ph + pad + band;
  const g = out.getContext('2d');
  g.fillStyle = '#fbf6e6'; g.fillRect(0, 0, out.width, out.height);
  const sw = src.width, sh = src.height, targetR = W / ph;
  let cw = sw, ch = sw / targetR; if (ch > sh) { ch = sh; cw = sh * targetR; }
  g.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, pad, pad, W, ph);
  g.strokeStyle = '#33402a'; g.lineWidth = 4; g.strokeRect(pad, pad, W, ph);
  g.fillStyle = '#33402a'; g.font = '700 46px "Noto Sans KR", sans-serif'; g.textBaseline = 'alphabetic';
  g.fillText(P.title, pad, ph + pad + 70);
  g.font = '500 26px "Noto Sans KR", sans-serif';
  const ds = kstDate().replace(/-/g, '.');
  const badges = Object.keys(ach.state.badges).length;
  g.fillText(`${save.nick} · ${ds} · ${player.steps.toLocaleString('ko-KR')}걸음 · 뱃지 ${badges}개`, pad, ph + pad + 116);
  if (logoImg.complete && logoImg.naturalWidth) { const lw = 280, lh = lw * logoImg.naturalHeight / logoImg.naturalWidth; g.drawImage(logoImg, W + pad - lw, ph + pad + 22 + (92 - lh) / 2, lw, lh); } // 사진 틀 로고 (#72), 폭 고정 (#209 가로로 길어진 로고)
  else { g.textAlign = 'right'; g.fillStyle = '#9c4a33'; g.font = '700 30px "Noto Sans KR", sans-serif'; g.fillText('오름오름', W + pad, ph + pad + 70); }
  out.toBlob((blob) => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoBlob = blob; photoUrl = URL.createObjectURL(blob); $('photo-img').src = photoUrl;
    $('photo-share').hidden = !canSharePhoto();
    setTimeout(() => { $('photo').hidden = false; }, 350);
  }, 'image/png');
  ach.emit('photo');
}
const photoName = () => `oreumoreum-${kstDate().replace(/-/g, '')}.png`;
const photoFile = () => photoBlob && new File([photoBlob], photoName(), { type: 'image/png' });
export function canSharePhoto() { try { const f = photoFile(); return !!(f && navigator.canShare && navigator.canShare({ files: [f] })); } catch (_) { return false; } }
$('photo-save').addEventListener('click', () => { if (!photoUrl) return; const a = document.createElement('a'); a.href = photoUrl; a.download = photoName(); document.body.append(a); a.click(); a.remove(); });
$('photo-share').addEventListener('click', async () => { const f = photoFile(); if (!f) return; try { await navigator.share({ files: [f], title: P.title }); } catch (_) { /* 취소 */ } });
$('photo-close').addEventListener('click', () => {
  $('photo').hidden = true; state.photoState = null; late.social.leaveQueue();
  player.pose = 'move'; cam.mode = 'follow';
  cam.yaw = Math.atan2(summitOut.x, summitOut.z);
});
