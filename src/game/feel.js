// 손맛 (#141, notes/growth-loop.md 8절): 줍기 콤보 숫자·보너스 단계, 더미 무너짐 흙먼지, 마지막 하나 느린 화면,
// 피해 숫자(급소는 크고 노랗게), 쫓아낸 적 구르기·이어 쫓아내기 'n연속!', 맞음 가장자리 붉은빛, HP 낮음 심장 소리·맥박, 폰 진동.
// 설정: save.vib (0 이면 진동 끔), save.calmFx (1 이면 화면 흔들림·멈칫·느린 화면 없음. 고른 적 없으면 '움직임 줄이기' 설정을 따름)
// 수치는 balance.js FEEL. 귤 보너스: 콤보는 pickup.js 가 trash.take 에 비율을 넘겨 bag.xv 에, 연속은 쫓아낸 자리에 귤을 흩뿌림
import * as THREE from 'three';
import { FEEL, ENEMY_DROP } from '../balance.js';
import { LOW } from '../gfx2.js';
import { state, late } from './state.js';
import { $, save, persist, isTouch } from './save.js';
import { scene, camera } from './scene.js';
import { life, trash, player, hp } from './place.js';
import { toast } from './hud.js';
import { comboBonus } from './pickup.js';

const sound = () => late.sound;
const canVib = 'vibrate' in navigator && isTouch;
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const calmNow = () => (save.calmFx === 0 || save.calmFx === 1 ? save.calmFx === 1 : reduced());
const vibAt = {};
export function vib(k) { // 잦은 것(줍기·쫓아냄)은 0.25초에 한 번
  if (!canVib || save.vib === 0) return; const p = FEEL.vib[k]; if (!p) return;
  const now = performance.now(); if ((k === 'pick' || k === 'repel') && now - (vibAt[k] || 0) < 250) return; vibAt[k] = now;
  try { navigator.vibrate(p); } catch { /* 진동 막힘 */ }
}

// ---------- 소리 (audio.js 가 40KB 를 넘어 여기서 만듦) ----------
function tone(f0, f1, dur, vol, type = 'sine', at = 0) {
  const s = sound(); if (!s?.on || !s.sfxOn || !s.ctx) return;
  const c = s.ctx, t = c.currentTime + at, o = c.createOscillator(), g = c.createGain(); o.type = type;
  o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(s.sfx); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, freq) {
  const s = sound(); if (!s?.on || !s.sfxOn || !s.ctx) return;
  const c = s.ctx, t = c.currentTime, n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = c.createBufferSource(); src.buffer = buf; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = c.createGain(); g.gain.value = vol; src.connect(f); f.connect(g); g.connect(s.sfx); src.start(t);
}
const snd = {
  step(tier) { [0, 4, 7].forEach((m, i) => tone(523.25 * Math.pow(2, (m + tier * 2) / 12), 523.25 * Math.pow(2, (m + tier * 2) / 12), 0.22, 0.05, 'triangle', i * 0.06)); }, // 콤보 단계: 올라가는 세 음
  crumble() { noise(0.28, 0.16, 700); tone(140, 60, 0.2, 0.08); }, // 더미가 한 단계 무너짐
  beat() { tone(70, 45, 0.12, 0.2); tone(64, 40, 0.12, 0.14, 'sine', 0.2); }, // 심장 쿵쿵
  streak(n) { tone(660 + n * 80, 990 + n * 80, 0.16, 0.06, 'square'); },
};

// ---------- 화면에 뜨는 숫자 (피해·연속) ----------
const POOL = LOW ? FEEL.dmg.poolLow : FEEL.dmg.pool;
const pops = []; // { el, p: Vector3, t, dur, e?, n, at }
const _v = new THREE.Vector3();
function pop(text, pos, cls, dur = FEEL.dmg.t, e = null) {
  if (pops.length >= POOL) { const o = pops.shift(); o.el.remove(); }
  const el = document.createElement('div'); el.className = 'fx-dmg ' + cls; el.textContent = text; document.body.appendChild(el);
  const o = { el, p: pos.clone(), t: 0, dur, e, n: 0 }; pops.push(o); place(o); return o;
}
function place(o) {
  _v.copy(o.p).project(camera); const u = o.t / o.dur;
  if (_v.z > 1) { o.el.style.visibility = 'hidden'; return; }
  o.el.style.visibility = ''; o.el.style.left = ((_v.x * 0.5 + 0.5) * innerWidth) + 'px'; o.el.style.top = ((-_v.y * 0.5 + 0.5) * innerHeight - u * FEEL.dmg.rise) + 'px';
  o.el.style.opacity = String(u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4);
}
// 맞음 (enemies.js hurt): 잦은 맞힘(머신건·레이저)은 같은 적 숫자에 더해 한 장만
life.hooks.dmgNum = (e, dmg, stag, ch = 0) => {
  if (!(dmg > 0) || !e?.pos) return;
  const crit = stag || ch >= FEEL.dmg.fullCh, head = _v.set(e.pos.x, e.pos.y + (e.h || 1) + 0.3, e.pos.z);
  const last = pops.findLast?.((o) => o.e === e && o.t < 0.18 && !o.crit);
  if (last && !crit) { last.n += dmg; last.el.textContent = String(Math.round(last.n)); return; }
  const o = pop(String(Math.round(dmg)), head.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5)), crit ? 'crit' : '', crit ? FEEL.dmg.t * 1.3 : FEEL.dmg.t, e);
  o.n = dmg; o.crit = crit;
};

// ---------- 쫓아냄: 구르기·이어 쫓아내기 ----------
const streak = { n: 0, at: -1e9 };
{ const prev = life.hooks.enemyRepel;
  life.hooks.enemyRepel = (kind, pos, def, e) => {
    prev?.(kind, pos, def, e); onRepel(pos, def, e);
  };
}
function onRepel(pos, def, e) { // 구르기·연속 (#141)
    if (e && !e.boss) { e.rollT = e.rollD = FEEL.roll.t; e.rollS = Math.random() < 0.5 ? 1 : -1; e.rollH = FEEL.roll.hop; }
    const now = performance.now() / 1000; streak.n = now - streak.at < FEEL.streak.gap ? streak.n + 1 : 1; streak.at = now;
    vib('repel');
    if (streak.n < 2) return;
    const k = Math.min(FEEL.streak.max, (streak.n - 1) * FEEL.streak.bonus), g = Math.round((def?.reward?.gyul || 0) * k);
    if (g > 0) life.scatterTangerines(pos, g, ENEMY_DROP.max);
    pop(`${streak.n}연속!`, _v.set(pos.x, pos.y + 2.4, pos.z), 'streak', 1.1); snd.streak(streak.n); vib('streak');
}

// ---------- 줍기 콤보 ----------
const comboEl = document.createElement('div'); comboEl.id = 'combo'; comboEl.hidden = true; comboEl.innerHTML = '<b></b><small></small>'; document.body.appendChild(comboEl);
let comboShown = 0, comboTier = 0;
function onCombo(n) {
  vib('pick');
  const tier = Math.floor(n / FEEL.combo.step);
  if (n >= 3) {
    comboEl.hidden = false; comboEl.querySelector('b').textContent = String(n);
    const b = comboBonus(n); comboEl.querySelector('small').textContent = b > 0 ? `+${Math.round(b * 100)}%` : '';
    comboEl.style.setProperty('--cc', FEEL.combo.cols[Math.min(FEEL.combo.cols.length - 1, tier)]);
    comboEl.classList.remove('hit'); void comboEl.offsetWidth; comboEl.classList.add('hit');
    comboShown = FEEL.combo.gap;
  }
  if (tier > comboTier && tier > 0) { snd.step(tier); vib('step'); comboEl.classList.remove('up'); void comboEl.offsetWidth; comboEl.classList.add('up'); }
  comboTier = tier;
}

// ---------- 더미: 무너짐·마지막 하나 ----------
const DUST_N = LOW ? FEEL.crumble.nLow : FEEL.crumble.n, DUST_MAX = DUST_N * 3;
const dustMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshBasicMaterial({ color: '#a08a6a', transparent: true, opacity: 0.85, depthWrite: false }), DUST_MAX);
dustMesh.count = 0; dustMesh.frustumCulled = false; scene.add(dustMesh);
const dust = []; const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
function crumble(h) {
  for (let i = 0; i < DUST_N; i++) {
    if (dust.length >= DUST_MAX) dust.shift();
    const a = Math.random() * 6.28, r = h.r * (0.4 + Math.random() * 0.5), v = 1.5 + Math.random() * 2;
    dust.push({ p: new THREE.Vector3(h.x + Math.cos(a) * r, (h.y || 0) + 0.3, h.z + Math.sin(a) * r), v: new THREE.Vector3(Math.cos(a) * v, 2 + Math.random() * 2.5, Math.sin(a) * v), t: 0, s: 0.6 + Math.random() * 0.8 });
  }
  snd.crumble();
}
if (trash) trash.on((ev, d) => {
  if (ev === 'heap-stage' && d.took) { const h = trash.heaps[d.h]; if (h && Math.hypot(h.x - player.pos.x, h.z - player.pos.z) < 40) crumble(h); }
  else if (ev === 'heap-clear' && !d.by) { if (!calmNow() && !(state.slowMo > 0)) { state.slowMo = FEEL.heapSlow.t; state.slowK = FEEL.heapSlow.k; } }
});

// ---------- 맞음·HP 낮음: 가장자리 붉은빛 ----------
const edge = document.createElement('div'); edge.id = 'feel-edge'; document.body.appendChild(edge);
let hurtT = 0, beatT = 0, sinceHurt = 99, edgeA = -1;
function onHurt() { hurtT = FEEL.hurt.t; sinceHurt = 0; vib('hurt'); }
function lowNow() { return hp && !hp.isDown && !hp.pending && hp.hp > 0 && hp.hp < hp.max * FEEL.low.hp && (sinceHurt < 8 || life.enemies?.active?.()); }

export function tickFeel(dt) {
  sinceHurt += dt;
  for (let i = pops.length - 1; i >= 0; i--) { const o = pops[i]; o.t += dt; if (o.t >= o.dur) { o.el.remove(); pops.splice(i, 1); } else place(o); }
  if (comboShown > 0) { comboShown -= dt; if (comboShown <= 0) { comboEl.hidden = true; comboTier = 0; } }
  if (dust.length) {
    let n = 0;
    for (let i = dust.length - 1; i >= 0; i--) { const q = dust[i]; q.t += dt; if (q.t >= FEEL.crumble.t) { dust.splice(i, 1); continue; } q.v.y -= 9 * dt; q.p.addScaledVector(q.v, dt); }
    for (const q of dust) { const k = q.s * (1 - q.t / FEEL.crumble.t); _e.set(q.t * 5, q.t * 7, 0); _q.setFromEuler(_e); _s.setScalar(k); _m.compose(q.p, _q, _s); dustMesh.setMatrixAt(n++, _m); }
    dustMesh.count = n; dustMesh.instanceMatrix.needsUpdate = true;
  } else if (dustMesh.count) dustMesh.count = 0;
  let a = 0;
  if (hurtT > 0) { hurtT -= dt; a = FEEL.hurt.a * Math.max(0, hurtT / FEEL.hurt.t); }
  if (lowNow()) {
    beatT -= dt; if (beatT <= 0) { beatT = FEEL.low.beat; snd.beat(); }
    const u = (FEEL.low.beat - beatT) / FEEL.low.beat; a = Math.max(a, FEEL.low.a * (u < 0.15 ? u / 0.15 : Math.max(0, 1 - (u - 0.15) / 0.6)));
  } else beatT = 0;
  a = Math.round(a * 50) / 50; if (a !== edgeA) { edgeA = a; edge.style.opacity = String(a); }
}

// ---------- 설정 ----------
function setUI() {
  const v = $('menu-vib'); if (v) { v.hidden = !canVib; v.textContent = `진동: ${save.vib === 0 ? '끔' : '켬'}`; v.setAttribute('aria-pressed', String(save.vib !== 0)); }
  const c = $('menu-calmfx'); if (c) { c.textContent = `화면 효과: ${calmNow() ? '줄임' : '보통'}`; c.setAttribute('aria-pressed', String(calmNow())); }
}
$('menu-vib')?.addEventListener('click', () => { save.vib = save.vib === 0 ? 1 : 0; persist(); setUI(); vib('step'); toast(save.vib ? '진동을 켰어요' : '진동을 껐어요'); });
$('menu-calmfx')?.addEventListener('click', () => { save.calmFx = calmNow() ? 0 : 1; persist(); setUI(); toast(save.calmFx ? '화면 흔들림·멈춤을 줄였어요' : '화면 효과를 보통으로'); });
setUI();

export const feel = {
  combo: onCombo, hurt: onHurt, vib, get calm() { return calmNow(); },
  test: { // __oreum.feel.test
    dmg(n = 37, crit = false) { const e = life.enemies?.list?.[0]; const p = e ? e : { pos: player.pos.clone().add(new THREE.Vector3(0, 0, 3)), h: 1 }; life.hooks.dmgNum(p, n, crit); return pops.length; },
    streak(n = 3) { const p = player.pos.clone().add(new THREE.Vector3(0, 0, 3)); for (let i = 0; i < n; i++) onRepel(p, { reward: { gyul: 0 } }, null); return streak.n; },
    combo(n = 25) { for (let i = 1; i <= n; i++) onCombo(i); return { n, bonus: comboBonus(n), shown: !comboEl.hidden }; },
    hurt: onHurt, crumble: () => { const h = trash?.heaps?.[0]; if (h) crumble(h); return dust.length; },
    s: () => ({ pops: pops.length, dust: dust.length, combo: comboEl.hidden ? 0 : +comboEl.querySelector('b').textContent, edge: edgeA, calm: calmNow(), vib: save.vib !== 0, streak: streak.n }),
  },
};
late.feel = feel; late.tickFeel = tickFeel;
