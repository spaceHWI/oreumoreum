// 소리, 동물·적·투기꾼 후크, 받혀 구르기, 귤 효과, 긴장 음악 (#86 에서 main.js 를 나눔. 파일 순서는 src/main.js, 규칙은 notes/prototype-v1.md 코드 구조)
import { nsPaths } from '../namsongi.js';
import { DEX_LIST } from '../trash.js';
import { TUT, BOAR, SCATTER, ENEMY_SPAWN, ENEMIES, DUMP, MUSIC } from '../balance.js';
import { RIDE_BY } from '../rides.js';
import * as THREE from 'three';
import { height } from '../world.js';
import { LOW } from '../gfx2.js';
import { Sound } from '../audio.js';
import { createDumpers } from '../dumpers.js';
import * as NSB from '../nsbound.js';
import { state, late } from './state.js';
import { $, save, wearV, persist, MAP_ID } from './save.js';
import { scene, camera } from './scene.js';
import { life, NS_TUT, trash, runner, player, hp } from './place.js';
import { topFit, toast, tips, updateStats, ach, onDexGet } from './hud.js';
import { marker } from './input.js';
import { dismountRide } from './ride.js';
import { dismountDeer } from './moves.js';
import { net } from './room.js';

Object.assign(late, { gyulShower, coinFx, setSoundUI }); // 앞 파일에서 부르는 함수

// ---------- 소리·후크 ----------
export const sound = new Sound(); late.sound = sound;
sound.forest = MAP_ID === 'donnaeko';
if (!save.music || typeof save.music !== 'object') save.music = { on: 1, vol: MUSIC.vol }; // 예전 저장엔 없음 (#64)
save.music.vol = Math.max(0, Math.min(1, Number.isFinite(+save.music.vol) ? +save.music.vol : MUSIC.vol));
sound.setMusic(save.music.on); sound.setMusicVol(save.music.vol); setSoundUI();
life.bind(player, sound);
life.hooks.enemyHit = (dir, def) => {
  if (player.air && player.jumpV > 0) return;
  if (hp.isDown || hp.pending) return;
  if (player.cart) return; // 마차 위는 안전 (#69)
  if (player.riding) dismountDeer();
  if (player.ride) { dismountRide(); player.rideAuto = null; toast(`${RIDE_BY[save.rides.cur]?.name || '탈것'}에서 떨어졌어요`); } // 받히면 떨어짐 (#69)
  player.kb.copy(dir).multiplyScalar(BOAR.knockSpeed); player.air = true; player.jumpV = BOAR.knockV; player.jumpY = 0.01;
  player.target = null; marker.visible = false; player.pose = 'move';
  player.knock = { t: 0, land: -1, ang: 0, spin: 0, ax: -dir.z, az: dir.x };
  // 가진 귤의 일부가 주변에 흩어짐 (#32): 가진 귤의 10%(3~15개), 가진 것보다 많이는 안 흩어짐
  const n = Math.min(save.coins, Math.max(SCATTER.min, Math.min(SCATTER.max, Math.round(save.coins * SCATTER.frac))));
  if (n > 0) { save.coins -= n; persist(); updateStats(); life.scatterTangerines(player.pos, n); }
  const downed = hp.hit(def.dmg * (1 - wearV('jacket'))); // 잠바(#52): 받는 피해 줄임
  // 전투 오름만 (#36), 피해는 적 표(ENEMIES). 0 이 되면 넉백이 끝난 뒤 쓰러짐
  sound.stone(); if (downed) return; toast(n > 0 ? `${def.name}에 받혔어요! 귤 ${n}개가 흩어졌어요` : `${def.name}에 받혔어요! 귤을 던지면 도망가요`);
};
// 받혀 날아가 구르고 일어나는 동안(#32) 조작 잠금. 날 때 뒤로 눕고 → 착지 뒤 구르고 → 일어남
export function tickKnock(dt) {
  const k = player.knock; if (!k) return;
  k.t += dt;
  if (player.air) { k.ang = Math.min(1.45, k.ang + dt * 5); }
  else {
    if (k.land < 0) k.land = k.t;
    const g = k.t - k.land;
    if (g < BOAR.rollT) { k.ang = 1.45; k.spin = (g / BOAR.rollT) * Math.PI * 2; }
    else if (g < BOAR.rollT + BOAR.getUpT) { const u = (g - BOAR.rollT) / BOAR.getUpT; k.ang = 1.45 * (1 - u * u * (3 - 2 * u)); k.spin = 0; }
    else player.knock = null;
  }
}
const _kq = new THREE.Quaternion(), _ka = new THREE.Vector3(); export { _kq }; export { _ka };
// 적 (#37): 나타남(경고) · 스스로 떠남 · 쫓아냄(귤 흩뿌림·드문 쓰레기) · 땅 헤집기(쓰레기 흘림)
const ENEMY_NAME = (k) => ENEMIES[k]?.name || '적';
const iga = (w) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return w + (c >= 0 && c < 11172 && c % 28 ? '이' : '가'); };
life.hooks.enemyWave = (w) => { toast(`${ENEMY_NAME(w.kind)} ${w.n}마리가 나타났어요! 귤을 맞히면 도망가요`); enemyWarn.start(w); };
life.hooks.enemyGone = (kind) => { if (!life.enemies.list.length) toast(`${iga(ENEMY_NAME(kind))} 숲으로 돌아갔어요`); };
life.hooks.enemyRepel = (kind, pos, def) => {
  life.scatterTangerines(pos, def.reward.gyul);
  if (trash && Math.random() < def.reward.rare) { const rares = DEX_LIST.filter((d) => d.rare), dx = rares[Math.floor(Math.random() * rares.length)]; const isNew = trash.store.dexAdd(dx.id); trash.store.commit(); onDexGet(dx, isNew); }
  ach.emit('enemy-repel'); ach.emit('enemy-repel-' + kind);
  if (kind === 'boar') ach.emit('boar-repel');
};
life.hooks.enemyRoot = (kind, pos, n) => { if (trash) trash.drop(pos.x, pos.z, n, ENEMIES[kind]?.rootR || 14); };
// 나타날 때 화면 가장자리 방향 표시 (적: 빨간 느낌표, 투기꾼 #47: 봉투 아이콘)
function makeEdgeWarn(id, html, dur) {
  const el = document.createElement('div'); el.id = id; el.hidden = true; el.setAttribute('aria-hidden', 'true'); el.innerHTML = html; document.body.appendChild(el);
  let t = 0; const at = new THREE.Vector3(), v = new THREE.Vector3();
  return {
    start(w) { at.set(w.x, height(w.x, w.z) + 1, w.z); t = dur; el.hidden = false; },
    update(dt) {
      if (t <= 0) return; t -= dt; if (t <= 0) { el.hidden = true; return; }
      v.copy(at).project(camera); let x = v.x, y = v.y;
      if (v.z > 1) { x = -x; y = -y; } // 뒤쪽이면 뒤집음
      const W = innerWidth, H = innerHeight, m = 34;
      { const k = 1 / Math.max(Math.abs(x), Math.abs(y), 1e-3); x *= k; y *= k; } // 늘 가장자리, 무리 쪽 방향
      const px = Math.min(W - m, Math.max(m, (x * 0.5 + 0.5) * W)), py = Math.min(H - m, Math.max(topFit.bottom + 72, (-y * 0.5 + 0.5) * H));
      el.style.transform = `translate(${px - 22}px, ${py - 22}px)`; el.style.opacity = String(Math.min(1, t * 2) * (0.75 + 0.25 * Math.abs(Math.sin(t * 9))));
    },
    get t() { return t; },
  };
}
export const enemyWarn = makeEdgeWarn('enemy-warn', '!', ENEMY_SPAWN.warnT);
// 쓰레기 투기꾼·투기 트럭 (#47): 주기적으로 와서 더미를 다시 쌓음. 버리기 전에 귤을 맞히면 도망. 깨끗한 오름·전투 오름 둘 다
const DUMP_IC = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M9 3h6l-1.2 3.2c3 1.2 5.2 4.3 5.2 7.8 0 4-3.1 7-7 7s-7-3-7-7c0-3.5 2.2-6.6 5.2-7.8z"/></svg>'; late.DUMP_IC = DUMP_IC;
export const dumpWarn = makeEdgeWarn('dump-warn', DUMP_IC, DUMP.warnT);
state.introToast = null; // 첫 화면이 떠 있을 때 온 알림은 들어간 뒤 보여 줌 (#16)
export const dumpers = trash ? createDumpers({
  scene, trash, height, paths: nsPaths,
  bound: { line: NSB.boundLine, insideBy: NSB.insideBy, center: NSB.BOUND_CENTER },
  avoid: NS_TUT ? (() => { const L = NSB.crossLine(TUT.gateD); return (x, z) => (x - L.c.x) * L.fx + (z - L.c.z) * L.fz < 6 && Math.hypot(x - L.c.x, z - L.c.z) < 260; })() : null, // 들머리 튜토리얼 쪽 길은 트럭이 안 지남
  hooks: {
    canSpawn: () => !NS_TUT || !!save.jeong || !!save.tut?.done, // 튜토리얼 중엔 안 옴
    appear: (d) => { tips.event('dumper'); dumpWarn.start({ x: d.pos.x, z: d.pos.z }); toast(d.kind === 'truck' ? '투기 트럭이 와요! 귤을 맞혀 쫓아내요' : '무단투기꾼이 와요! 귤을 맞혀 쫓아내요'); },
    dumped: (d, n) => { if (n && d.pos.distanceTo(player.pos) < 120) toast(`${iga(d.def.name)} 쓰레기 ${n}개를 버리고 갔어요`); },
    repel: (kind, pos, def) => {
      life.scatterTangerines(pos, def.reward);
      sound.beep?.(true); toast(`${iga(def.name)} 놀라 도망가요`);
      ach.emit('dumper-repel'); ach.emit('dumper-repel-' + kind);
    },
    offline: (n) => { const m = `자리를 비운 사이 쓰레기 ${n}개가 다시 쌓였어요`; if (!$('intro').hidden) state.introToast = m; else toast(m); },
  },
}) : null; late.dumpers = dumpers;
if (dumpers) { dumpers.bind(player, sound); life.addTargets(dumpers); dumpers.start(); }
life.hooks.hareubang = () => { ach.emit('hareubang'); late.tut.notify('hareubang'); };
life.hooks.pickup = (n) => { late.tut.notify('pickup'); save.coins += n; persist(); updateStats(); sound.coin?.(); ach.emit('pickup', n); };
// 귤 줍는 효과: 그 자리에서 +1이 떠오르고 귤이 왼쪽 위 귤 칸으로 날아감
life.hooks.pickupAt = (wp) => coinFx(wp, 1);
life.hooks.reclaim = (wp) => { save.coins += 1; persist(); updateStats(); sound.coin?.(); coinFx(wp, 1); };
// 귤이 화면 위에서 쏟아져 귤 알약으로 들어감 (첫 보너스 #31)
export function gyulShower(n) {
  updateStats(); const pill = $('gyul-pill'), r0 = pill.querySelector('i').getBoundingClientRect(), tgt = r0.width > 0 ? r0 : { left: 24, top: 24 }, k = LOW ? 14 : 28;
  for (let i = 0; i < k; i++) setTimeout(() => {
    const dot = document.createElement('div'); dot.className = 'fx-gyul'; const sx = innerWidth * (0.3 + Math.random() * 0.4), sy = -20 - Math.random() * 30;
    dot.style.left = sx + 'px'; dot.style.top = sy + 'px'; document.body.append(dot);
    const mx = sx + (Math.random() - 0.5) * 160, my = innerHeight * (0.35 + Math.random() * 0.2);
    dot.style.transition = 'transform .45s cubic-bezier(.4,0,.9,.6)'; requestAnimationFrame(() => requestAnimationFrame(() => { dot.style.transform = `translate(${mx - sx}px, ${my - sy}px)`; }));
    setTimeout(() => { dot.style.transition = 'transform .5s cubic-bezier(.5,-0.2,.6,1), opacity .5s'; dot.style.transform = `translate(${tgt.left + 8 - sx}px, ${tgt.top + 8 - sy}px) scale(.6)`; }, 470);
    setTimeout(() => { dot.remove(); pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump'); if (i % 4 === 0) sound.coin?.(); }, 1000);
  }, i * 45);
  const plus = document.createElement('div'); plus.className = 'fx-plus'; plus.textContent = `+${n}`; plus.style.left = (tgt.left + 40) + 'px'; plus.style.top = (tgt.top + 34) + 'px';
  setTimeout(() => { document.body.append(plus); setTimeout(() => plus.remove(), 1000); }, k * 45 + 900);
}
export function coinFx(wp, n) {
  const v = wp.clone(); v.y += 0.6; v.project(camera);
  if (v.z > 1) return;
  const sx = (v.x * 0.5 + 0.5) * innerWidth, sy = (-v.y * 0.5 + 0.5) * innerHeight;
  const plus = document.createElement('div'); plus.className = 'fx-plus'; plus.textContent = `+${n}`;
  plus.style.left = sx + 'px'; plus.style.top = sy + 'px'; document.body.append(plus);
  const dot = document.createElement('div'); dot.className = 'fx-gyul';
  dot.style.left = sx + 'px'; dot.style.top = sy + 'px'; document.body.append(dot);
  const tgt = document.querySelector('.gyul i').getBoundingClientRect();
  requestAnimationFrame(() => { dot.style.transform = `translate(${tgt.left + 8 - sx}px, ${tgt.top + 8 - sy}px) scale(.6)`; dot.style.opacity = '0.9'; });
  setTimeout(() => { dot.remove(); const g = document.querySelector('.gyul'); g.classList.remove('bump'); void g.offsetWidth; g.classList.add('bump'); }, 620);
  setTimeout(() => plus.remove(), 900);
}
life.hooks.fed = () => { ach.emit('feed'); ach.emit('follower'); };
life.hooks.hitRunner = (who) => {
  if (who === 'me') { player.yellowUntil = Date.now() + 6000; net.send(true); }
  else net.hitPeer(who);
};
runner.setTint(false);
export function setSoundUI() {
  $('menu-sound').setAttribute('aria-pressed', String(sound.on));
  $('menu-music').setAttribute('aria-pressed', String(!!(sound.on && save.music.on)));
  $('music-vol').value = String(Math.round(save.music.vol * 100));
}
// 적 근처면 긴장 음악 (#64): 몹·멧돼지(enemies) + 투기꾼·투기 트럭(dumpers)
export function threatNear() {
  if (life.enemies.near(player.pos, MUSIC.near)) return true;
  return !!dumpers && dumpers.list.some((d) => d.state !== 'flee' && d.state !== 'startle' && d.state !== 'leave' && Math.hypot(d.pos.x - player.pos.x, d.pos.z - player.pos.z) < MUSIC.near);
}
