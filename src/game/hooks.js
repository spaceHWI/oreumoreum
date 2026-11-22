// 소리, 동물·적·투기꾼 후크, 받혀 구르기, 귤 효과, 긴장 음악 (#86 에서 main.js 를 나눔. 파일 순서는 src/main.js, 규칙은 notes/prototype-v1.md 코드 구조)
import { nsPaths } from '../namsongi.js';
import { DEX_LIST } from '../trash.js';
import { gyulPickR } from '../gearscore.js';
import { TUT, BOAR, SCATTER, ENEMY_SPAWN, ENEMIES, ENEMY_DROP, DUMP, DUMPER_Q, MUSIC, COMBAT } from '../balance.js';
import { RIDE_BY } from '../rides.js';
import { augV } from '../augments.js';
import { flinchK } from '../bodytilt.js';
import * as THREE from 'three';
import { height } from '../world.js';
import { LOW } from '../gfx2.js';
import { Sound } from '../audio.js';
import { createDumpers } from '../dumpers.js';
import * as NSB from '../nsbound.js';
import { state, late } from './state.js';
import { $, save, wearV, persist, MAP_ID, CLOTH, CL } from './save.js';
import { scene, camera } from './scene.js';
import { life, NS_TUT, trash, runner, player, hp, buff } from './place.js';
import { topFit, toast, tips, updateStats, ach, onDexGet, gyulFx, gyulLand } from './hud.js';
import { say } from './director.js'; // 위험 알림은 감독을 거침 (#176)
import { marker } from './input.js';
import { dismountRide } from './ride.js';
import { dismountDeer } from './moves.js';
import { net } from './room.js';

Object.assign(late, { gyulShower, coinFx, gyulFly, setSoundUI }); // 앞 파일에서 부르는 함수

// ---------- 소리·후크 ----------
export const sound = new Sound(); late.sound = sound;
sound.forest = MAP_ID === 'donnaeko';
if (!save.music || typeof save.music !== 'object') save.music = { on: 1, vol: MUSIC.vol }; // 예전 저장엔 없음 (#64)
save.music.vol = Math.max(0, Math.min(1, Number.isFinite(+save.music.vol) ? +save.music.vol : MUSIC.vol));
sound.setMusic(save.music.on); sound.setMusicVol(save.music.vol); setSoundUI();
life.bind(player, sound);
life.hooks.enemyHit = (dir, def) => {
  if (state.cine) return; // 엔딩 시네마틱 동안은 모두 무적 (#168)
  if (player.air && player.jumpV > 0) return;
  if (hp.isDown || hp.pending) return;
  if (player.cart) return; // 마차 위는 안전 (#69)
  if (player.iframe > 0) return; // 받힌 뒤 잠깐은 다시 안 맞음 (#148, 그동안 깜빡임은 update.js placeRunner)
  player.iframe = COMBAT.iframe;
  late.closeBag?.(); // 받히면 내 가방 창이 닫힘 (#166)
  if (player.riding) dismountDeer();
  if (player.ride) { dismountRide(); player.rideAuto = null; toast(`${RIDE_BY[save.rides.cur]?.name || '탈것'}에서 떨어졌어요`); } // 받히면 떨어짐 (#69)
  player.kb.copy(dir).multiplyScalar(BOAR.knockSpeed); player.air = true; player.jumpV = BOAR.knockV; player.jumpY = 0.01;
  player.target = null; marker.visible = false; player.pose = 'move';
  player.knockN = (player.knockN || 0) + 1; player.knock = { t: 0, land: -1, ang: 0, ax: -dir.z, az: dir.x, id: player.knockN }; // 연달아 맞으면 처음부터 다시 (남는 값 없음). id 는 멀티로 보냄
  // 가진 귤의 일부가 주변에 흩어짐 (#32): 가진 귤의 10%(3~15개), 가진 것보다 많이는 안 흩어짐
  const n = Math.min(save.coins, Math.max(SCATTER.min, Math.min(SCATTER.max, Math.round(save.coins * SCATTER.frac))));
  if (n > 0) { save.coins -= n; persist(); updateStats(); life.scatterTangerines(player.pos, n); }
  const hatG = CLOTH[CL.wear.hat]?.guard || 0; // 감귤 박스 헬멧 (#164): 받는 피해 더 줄임
  const downed = hp.hit(def.dmg * Math.max(0, 1 - wearV('jacket') - augV(save, 'jacket')) * (1 - hatG) * (1 - buff.add('guard'))); // 잠바(#52)·두꺼운 잠바 증강(#159, 더함): 받는 피해 줄임, 만족한상 버프(#167)
  late.feel?.hurt(); // 가장자리 붉은빛·진동 (#141)
  // 전투 오름만 (#36), 피해는 적 표(ENEMIES). 0 이 되면 넉백이 끝난 뒤 쓰러짐
  if (hatG) late.boxThud?.(); else sound.stone(); if (downed) return; // 박스를 쓰면 '퉁'
  if (hp.hp < hp.max * COMBAT.lowHp && life.enemies.hesitate()) { say('danger', 'lowHp', '기운이 얼마 없어요. 물러나서 숨 돌리기', 2.8, { ttl: 3 }); return; } // #148 한 싸움에 한 번
  toast(n > 0 ? `${def.name}에 받혔어요! 귤 ${n}개가 흩어졌어요` : `${def.name}에 받혔어요! 귤을 던지면 도망가요`);
};
// 맞음 움찔 (#107): 짧게 뒤로 밀리고 움찔한 뒤 BOAR.flinchT 안에 바로 섬. 그동안 조작 잠금. 기울기는 bodytilt.js flinchK 가 시간으로만 정함
// (예전 #32 는 날아가 눕고 구르다 일어났는데, 기울기가 Euler 에 남아 누운 채로 남는 일이 있었다)
export function tickKnock(dt) {
  const k = player.knock; if (!k) return;
  k.t += dt; k.ang = BOAR.flinchAng * flinchK(k.t);
  if (!player.air && k.land < 0) k.land = k.t;
  if (k.t >= BOAR.flinchT) player.knock = null;
}
// 적 (#37): 나타남(경고) · 스스로 떠남 · 쫓아냄(귤 흩뿌림·드문 쓰레기) · 땅 헤집기(쓰레기 흘림)
const ENEMY_NAME = (k) => ENEMIES[k]?.name || '적';
const iga = (w) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return w + (c >= 0 && c < 11172 && c % 28 ? '이' : '가'); };
life.hooks.enemyWave = (w) => { say('danger', 'wave', `${ENEMY_NAME(w.kind)} ${w.n}마리가 나타났어요! 귤을 맞히면 도망가요`, 2.8, { ttl: 4 }); enemyWarn.start(w); };
life.hooks.enemyGone = (kind) => { if (!life.enemies.list.length) toast(`${iga(ENEMY_NAME(kind))} 숲으로 돌아갔어요`); };
life.hooks.enemyRepel = (kind, pos, def) => {
  life.scatterTangerines(pos, def.swarm ? def.reward.gyul : late.rareDrop?.(kind, pos, def.reward.gyul, ENEMY_DROP.max) ?? def.reward.gyul, ENEMY_DROP.max); // 귀한 귤 (#130, game/raregyul.js): 알갱이 하나가 가끔 한라봉·천혜향…
  if (trash && Math.random() < def.reward.rare) { const rares = DEX_LIST.filter((d) => d.rare), dx = rares[Math.floor(Math.random() * rares.length)]; const isNew = trash.store.dexAdd(dx.id); trash.store.commit(); onDexGet(dx, isNew); }
  ach.emit('enemy-repel'); ach.emit('enemy-repel-' + kind); late.pace?.note('repel'); tips.event('charge'); // 첫 적을 쫓아낸 뒤 모아 쏘기 팁 (#129)
  if (kind === 'boar') ach.emit('boar-repel');
};
life.hooks.pickR2 = () => Math.max(gyulPickR(save) + augV(save, 'magnet') + buff.add('gyulR') + (late.punkPickR?.() || 0), life.enemies.active() ? COMBAT.autoPick : 0) ** 2; // 귤 모으는 범위 (#151, 배낭 단계마다 넓어짐) + 자석 귤 증강 (#159, 더함) + 하르방 기운 (#163). 싸우는 중엔 #148 값과 큰 쪽
life.hooks.throwR2 = () => (life.enemies.active() ? COMBAT.autoPick ** 2 : 1.6); // 내가 던진 귤은 예전 범위 (노루가 먹으러 올 틈), 싸우는 중엔 넓게 (#148)
life.hooks.paced = !!trash; life.hooks.hit = (p, dead) => late.pace?.hit(p, dead); // 몹도 연출 감독이 부름 (#89). 쓰레기 없는 맵은 예전대로
life.hooks.enemyRoot = (kind, pos, n) => { if (trash) trash.drop(pos.x, pos.z, n, ENEMIES[kind]?.rootR || 14); };
// 나타날 때 화면 가장자리 방향 표시 (적: 빨간 느낌표, 투기꾼 #47: 봉투 아이콘)
export function makeEdgeWarn(id, html, dur) { // 흡연자(#156)도 씀
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
// 쓰레기 투기꾼·투기 트럭 (#47): 주기적으로 와서 더미를 다시 쌓음. 버리기 전에 귤을 맞히면 도망
const DUMP_IC = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M9 3h6l-1.2 3.2c3 1.2 5.2 4.3 5.2 7.8 0 4-3.1 7-7 7s-7-3-7-7c0-3.5 2.2-6.6 5.2-7.8z"/></svg>'; late.DUMP_IC = DUMP_IC;
export const dumpWarn = makeEdgeWarn('dump-warn', DUMP_IC, DUMP.warnT);
late.edgeWarnOn = () => enemyWarn.t > 0 || dumpWarn.t > 0; // 같은 뜻(적 방향) 표시는 한 번에 하나 (#201, throw.js tickEdgeAim)
state.introToast = null; // 첫 화면이 떠 있을 때 온 알림은 들어간 뒤 보여 줌 (#16)
export const dumpers = trash ? createDumpers({
  scene, trash, height, paths: nsPaths,
  bound: { line: NSB.boundLine, insideBy: NSB.insideBy, center: NSB.BOUND_CENTER },
  avoid: NS_TUT ? (() => { const L = NSB.crossLine(TUT.gateD); return (x, z) => (x - L.c.x) * L.fx + (z - L.c.z) * L.fz < 6 && Math.hypot(x - L.c.x, z - L.c.z) < 260; })() : null, // 들머리 튜토리얼 쪽 길은 트럭이 안 지남
  hooks: {
    canSpawn: () => !NS_TUT || !!save.tut?.done, // 튜토리얼 중엔 안 옴 (#100: 마지막 정낭 단계도)
    paced: true, heapW: (i) => late.pace?.heapW(i) ?? 1, hit: (p, dead) => late.pace?.hit(p, dead), // 연출 감독이 부름 (#89, game/pace.js)
    appear: (d) => { dumpWarn.start({ x: d.pos.x, z: d.pos.z }); if (late.pace?.guide.appear(d)) return; tips.event('dumper'); say('danger', 'dumperCome', d.quest ? DUMPER_Q.msg : d.kind === 'truck' ? '투기 트럭이 와요! 귤을 맞혀 쫓아내요' : '무단투기꾼이 와요! 귤을 맞혀 쫓아내요', 2.8, { ttl: 6 }); }, // #260 퀘스트용이면 한 줄
    dumped: (d, n) => { late.mutterDumped?.(d, n); if (late.pace?.guide.dumped(d)) return; if (n && d.pos.distanceTo(player.pos) < 120) toast(`${iga(d.def.name)} 쓰레기 ${n}개를 버리고 갔어요`); },
    dress: (d) => late.season?.dress(d), // 산타 투기꾼 (#180)
    repel: (kind, pos, def, d) => {
      life.scatterTangerines(pos, late.rareDrop?.(kind, pos, def.reward) ?? def.reward); late.season?.repel(d, pos); // 귀한 귤 낮은 확률 (#130) // 산타면 선물 상자 (#180)
      sound.beep?.(true); if (!late.pace?.guide.repel(d)) toast(`${iga(def.name)} 놀라 도망가요`);
      ach.emit('dumper-repel'); ach.emit('dumper-repel-' + kind); late.pace?.note('repel'); late.story?.dumperRepel?.(); late.dumperQRepel?.(); // 이야기 이벤트 (#168)·퀘스트 투기꾼 간격 (#260)
    },
    offline: (n) => { const m = `자리를 비운 사이 쓰레기 ${n}개가 다시 쌓였어요`; if (!$('intro').hidden) state.introToast = m; else toast(m); },
  },
}) : null; late.dumpers = dumpers;
if (dumpers) { dumpers.bind(player, sound); life.addTargets(dumpers); dumpers.start(); }
life.hooks.hareubang = () => { ach.emit('hareubang'); late.tut.notify('hareubang'); };
life.hooks.pickup = (n) => { late.tut.notify('pickup'); save.coins += n; persist(); updateStats(); sound.coin?.(); ach.emit('pickup', n); };
// 귤 줍는 효과: 그 자리에서 +1이 떠오르고 귤이 왼쪽 위 귤 칸으로 날아감
life.hooks.pickupAt = (wp) => coinFx(wp, 1);
life.hooks.reclaim = (wp, v = 1) => { save.coins += v; persist(); updateStats(); sound.coin?.(); coinFx(wp, v); }; // v: 알갱이 하나에 담긴 귤 (#137 적 귤)
// 귤이 화면 위에서 쏟아져 귤 알약으로 들어감 (첫 보너스 #31)
let dotsLive = 0;
export function gyulShower(n) {
  updateStats(); const pill = $('gyul-pill'), r0 = pill.querySelector('i').getBoundingClientRect(), tgt = r0.width > 0 ? r0 : { left: 24, top: 24 }, k = LOW ? 0 : Math.max(0, Math.min(12, 12 - dotsLive)); gyulFx(n); // 알갱이는 한 화면에 12개까지, 저사양은 숫자 세기만 (#133)
  dotsLive += k;
  for (let i = 0; i < k; i++) setTimeout(() => {
    const dot = document.createElement('div'); dot.className = 'fx-gyul'; const sx = innerWidth * (0.3 + Math.random() * 0.4), sy = -20 - Math.random() * 30;
    dot.style.left = sx + 'px'; dot.style.top = sy + 'px'; document.body.append(dot);
    const mx = sx + (Math.random() - 0.5) * 160, my = innerHeight * (0.35 + Math.random() * 0.2);
    dot.style.transition = 'transform .45s cubic-bezier(.4,0,.9,.6)'; requestAnimationFrame(() => requestAnimationFrame(() => { dot.style.transform = `translate(${mx - sx}px, ${my - sy}px)`; }));
    setTimeout(() => { dot.style.transition = 'transform .5s cubic-bezier(.5,-0.2,.6,1), opacity .5s'; dot.style.transform = `translate(${tgt.left + 8 - sx}px, ${tgt.top + 8 - sy}px) scale(.6)`; }, 470);
    setTimeout(() => { dot.remove(); dotsLive--; pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump'); if (i % 4 === 0) sound.coin?.(); }, 1000);
  }, i * 45);
  setTimeout(() => gyulLand(n, false), (k ? (k - 1) * 45 + 1000 : 900)); // 숫자는 마지막 알갱이가 닿을 때 올라감
  const plus = document.createElement('div'); plus.className = 'fx-plus'; plus.textContent = `+${n}`; plus.style.left = (tgt.left + 40) + 'px'; plus.style.top = (tgt.top + 34) + 'px';
  setTimeout(() => { document.body.append(plus); setTimeout(() => plus.remove(), 1000); }, (k ? k * 45 : 0) + 900);
}
export function coinFx(wp, n) {
  gyulFx(n); const v = wp.clone(); v.y += 0.6; v.project(camera);
  if (v.z > 1 || LOW || dotsLive >= 12) { setTimeout(() => gyulLand(n, false), 400); return; } // 화면 밖·저사양·알갱이가 많으면 날리지 않고 숫자만
  dotsLive++;
  const sx = (v.x * 0.5 + 0.5) * innerWidth, sy = (-v.y * 0.5 + 0.5) * innerHeight;
  const plus = document.createElement('div'); plus.className = 'fx-plus'; plus.textContent = `+${n}`;
  plus.style.left = sx + 'px'; plus.style.top = sy + 'px'; document.body.append(plus);
  const dot = document.createElement('div'); dot.className = 'fx-gyul';
  dot.style.left = sx + 'px'; dot.style.top = sy + 'px'; document.body.append(dot);
  const tgt = document.querySelector('.gyul i').getBoundingClientRect();
  requestAnimationFrame(() => { dot.style.transform = `translate(${tgt.left + 8 - sx}px, ${tgt.top + 8 - sy}px) scale(.6)`; dot.style.opacity = '0.9'; });
  setTimeout(() => { dot.remove(); dotsLive--; gyulLand(n, false); }, 620);
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

// 어디서 얻었는지 알려 주지 않은 귤(업적·보너스 등): 화면 가운데에서 위쪽 귤 표시로 날려 보냄 (#133)
export function gyulFly(n) {
  if (LOW || dotsLive >= 12) { setTimeout(() => gyulLand(n, true), 300); return; }
  const tgt = document.querySelector('.gyul i').getBoundingClientRect(), sx = innerWidth / 2, sy = innerHeight * 0.55, k = Math.min(5, Math.max(1, n));
  dotsLive += k;
  for (let i = 0; i < k; i++) {
    const dot = document.createElement('div'); dot.className = 'fx-gyul'; dot.style.left = sx + (i - (k - 1) / 2) * 14 + 'px'; dot.style.top = sy + 'px'; document.body.append(dot);
    setTimeout(() => requestAnimationFrame(() => { dot.style.transform = `translate(${tgt.left + 8 - sx}px, ${tgt.top + 8 - sy}px) scale(.6)`; dot.style.opacity = '0.9'; }), i * 40);
    setTimeout(() => { dot.remove(); dotsLive--; }, 700 + i * 40);
  }
  setTimeout(() => gyulLand(n, true), 680 + (k - 1) * 40);
}
