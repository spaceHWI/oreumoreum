// 레벨과 증강 (#159): 경험치 받기·레벨업 연출·위 줄 레벨 칸·증강 고르기 창·싸움 증강(터지는 귤·신 귤)·귤 한 입·꽃길
// 셈(레벨 곡선·뽑기·옛 저장 경험치·서버 확인)은 src/augments.js, 수치는 balance.js LEVEL·AUGMENTS. 파일 순서는 boss 뒤 (적·우두머리 후크를 감쌈)
// - 경험치 = 번 귤 (#202): save.coins 가 늘어난 만큼을 매 프레임 셈. 번 귤이 아닌 것(운영자·받은 귤·판 귤·환불·철 선물·개발자 버튼)은 더하기 바로 전에 late.notEarned(n)
//   레벨 띠는 귤이 귤 칸에 닿을 때(hud.js gyulLand → late.lvLand) 작은 귤이 띠로 날아가 차오름. 레벨업 빛도 띠가 찰 때
// - 문 'level'(balance.js JOURNEY, 감독 #176): 열리기 전에도 경험치는 쌓이고, 열리면 위 줄에 레벨 칸이 보이고 첫 증강 고르기
// - 고르기 창: 레벨업 때 고를 것이 하나뿐이면 안전할 때(싸움·탈것·창이 없을 때 LEVEL.safe 초 뒤) 감독 차례로 엶. 밀린 것(옛 저장·'나중에')은 레벨 칸 배지만, 누르면 엶
//   창이 떠 있는 동안 혼자면 게임이 멈추고(state.augPause → update.js), 다른 사람이 있으면 LEVEL.guard 초 무적만
// - 사건: 고르면 ach.emit('augment-pick') (가이드 퀘스트 #158 이 '첫 증강 고르기' 를 셀 수 있게), late.onJourney?.('augment-pick', { id })
// dev: __oreum.level.state()·gain(n)·set({ id: n })·open()·pick(i)·reroll()·close()
import * as THREE from 'three';
import { LEVEL, AUGMENTS } from '../balance.js';
import { AUG_BY, trimAug, lvSave, levelOf, pendingPicks, augN, augV, rollDraw, augText, migrateLv, needXp } from '../augments.js';
import { state, late } from './state.js';
import { $, save, persist } from './save.js';
import { scene } from './scene.js';
import { trash, life, player, hp } from './place.js';
import { LOW } from '../gfx2.js';
import { soldHook } from '../loot.js';
import { toast, updateStats, panelOpen, topFit, ach } from './hud.js';
import { say, director } from './director.js';
import { cam } from './camera.js';
import { ic } from '../icons.js';

// ---------- 저장 ----------
const fresh = !save.lv || typeof save.lv !== 'object';
const L = lvSave(save);
if (migrateLv(save) || fresh) persist(); /* 옛 저장(#202 앞): 기록으로 번 귤을 어림, 옛 레벨보다 내려가지 않게 */
if (trimAug(save)) persist(); // 레벨보다 많은 증강(깨진 저장)은 덜어 냄
let lvShown = levelOf(L.xp).lv;
let saveT = 0; const persistSoon = () => { if (!saveT) saveT = setTimeout(() => { saveT = 0; persist(); }, 1500); };

// ---------- 아이콘 (24 칸, 선) ----------
const SV = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const OWN = { // 세트에 없는 것 (#194, 같은 24 칸·굵기)
  fork: '<path d="M12 21v-8"/><path d="M12 13l-6 -7"/><path d="M12 13l6 -7"/><path d="M6 10v-4h4"/><path d="M18 10v-4h-4"/>',
  back: '<path d="M9 14l-4 -4l4 -4"/><path d="M5 10h11a4 4 0 0 1 0 8h-1"/>',
  pierce: '<circle cx="12" cy="12" r="4"/><path d="M3 12h18"/><path d="M18 9l3 3l-3 3"/>',
  orbit: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><circle cx="20" cy="12" r="2" fill="currentColor"/>',
  shove: '<path d="M3 12h7"/><path d="M7 9l3 3l-3 3"/><path d="M15 5v14"/><path d="M19 8v8"/>',
};
export const AUG_ICON = Object.fromEntries(AUGMENTS.list.map((a) => [a.id, SV(OWN[a.ic] || ic(a.ic))]));
const augSay = (a) => a.say.replace(/\*\*(.+?)\*\*/, '<b>$1</b>'); // 쉬운 한 줄 (#194): **굵게** 한 곳

const BR = Object.fromEntries(AUGMENTS.branches.map((b) => [b.id, b]));
const brColor = (id) => BR[AUG_BY[id].br]?.color || '#ff8a1f';
const stars = (n) => '<i>' + '★'.repeat(n) + '</i>' + '☆'.repeat(Math.max(0, AUGMENTS.max - n));
const FIELD_TAG = `<span class="fd" title="들판에서만">${SV(ic('field'))}들판</span>`; // 들판에서만 작동 (#194)

// ---------- 위 줄 레벨 칸 ----------
const pill = $('lv-pill'), lvN = $('lv-n'), lvBar = $('lv-xp'), lvPend = $('lv-pend');
const doorOpen = () => director.isOpen('level');
function paintHud() {
  const on = doorOpen() && !!trash; if (pill.hidden === on) { pill.hidden = !on; topFit.dirty(); }
  if (!on) return;
  const s = levelOf(shown);
  if (lvN.textContent !== String(s.lv)) { lvN.textContent = String(s.lv); topFit.dirty(); }
  lvBar.style.width = (Math.min(1, s.k) * 100).toFixed(1) + '%';
  const p = pendingPicks(save); lvPend.hidden = !p; if (p) lvPend.textContent = '+' + p;
  pill.title = s.need ? `레벨 ${s.lv} · 경험치 ${s.into}/${s.need}${p ? ` · 고를 증강 ${p}` : ''}` : `최고 레벨 ${s.lv}`;
}
pill.addEventListener('click', () => {
  if (pendingPicks(save) > 0) { openPick(true); return; }
  if (late.openBag?.('stat')) return; // 능력 탭 (#202)
  const s = levelOf(L.xp); toast(s.need ? `레벨 ${s.lv} · 다음 레벨까지 귤 ${(s.need - s.into).toLocaleString()}` : `최고 레벨 ${s.lv}이에요`);
});
pill.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pill.click(); } });

// ---------- 레벨업 빛 (캐릭터 둘레 고리 + 빛 기둥) ----------
const glowMat = new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 40).rotateX(-Math.PI / 2), glowMat);
const colMat = glowMat.clone();
const column = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 3.2, 24, 1, true).translate(0, 1.6, 0), colMat);
const glow = new THREE.Group(); glow.add(ring, column); glow.visible = false; glow.renderOrder = 5; scene.add(glow);
let glowT = 0;
function levelFx(lv) {
  glowT = LEVEL.glow.t; glow.visible = true;
  pill.classList.remove('up'); void pill.offsetWidth; pill.classList.add('up');
  late.sound?.fanfare?.();
  say('level', 'lvUp', `레벨 ${lv}!`, 2.4, { ttl: 8 });
}
function tickGlow(dt) {
  if (!glow.visible) return;
  glowT -= dt; if (glowT <= 0) { glow.visible = false; return; }
  const k = 1 - glowT / LEVEL.glow.t; // 0 → 1
  glow.position.copy(player.pos); glow.position.y = (player.visY ?? player.pos.y) + 0.05;
  ring.scale.setScalar(0.4 + k * LEVEL.glow.r); glowMat.opacity = 0.85 * (1 - k);
  column.scale.set(1 - k * 0.5, 0.6 + k * 0.6, 1 - k * 0.5); colMat.opacity = 0.35 * Math.sin(Math.PI * Math.min(1, k * 1.4));
}

// ---------- 경험치 = 번 귤 (#202) ----------
let auto = false; // 레벨업으로 고를 것이 생겼고, 안전해지면 창을 열지
let seen = Math.max(0, save.coins | 0), skip = 0, shown = L.xp, pendT = 0;
late.notEarned = (n) => { skip += Math.max(0, Math.floor(+n) || 0); }; // save.coins 에 더하기 바로 전에 (다음 프레임에 지움)
soldHook.fn = (v) => late.notEarned(v); // 장비 판 귤 (#140 sell)
late.coinsSync = () => { seen = Math.max(0, save.coins | 0); skip = 0; };
function watchCoins() {
  const c = Math.max(0, save.coins | 0), d = c - seen; seen = c;
  const e = Math.max(0, d - skip); skip = 0;
  if (e > 0) gain(e);
}
function gain(n) {
  const x = Math.max(0, Math.round(n)); if (!x) return 0;
  L.xp = Math.min(L.xp + x, 1e12); persistSoon();
  if (!trash) shown = L.xp;
  return x;
}
// 띠가 차오름: 귤이 귤 칸에 닿을 때 (hud.js gyulLand), 1.5초 안에 안 닿으면 그냥
function land(n) {
  if (shown >= L.xp) return;
  shown = Math.min(L.xp, shown + Math.max(1, n)); pendT = 0;
  if (!LOW && doorOpen() && !pill.hidden) flyDot();
  paintHud();
}
late.lvLand = (n) => land(n);
function flyDot() {
  const a = document.querySelector('.gyul i')?.getBoundingClientRect(), b = lvBar.getBoundingClientRect(); if (!a || !b.width) return;
  const dot = document.createElement('div'); dot.className = 'fx-gyul'; dot.style.left = a.left + 'px'; dot.style.top = a.top + 'px'; dot.style.transform = 'scale(.5)'; document.body.append(dot);
  requestAnimationFrame(() => { dot.style.transition = 'transform .35s ease-in, opacity .35s'; dot.style.transform = `translate(${b.left + b.width * Math.min(1, levelOf(shown).k) - a.left}px, ${b.top - a.top - 4}px) scale(.35)`; dot.style.opacity = '0.6'; });
  setTimeout(() => dot.remove(), 380);
}
function tickShown(dt) {
  if (shown < L.xp) { if ((pendT += dt) > 1.5) { shown = L.xp; pendT = 0; paintHud(); } } else { pendT = 0; if (shown > L.xp) { shown = L.xp; paintHud(); } }
  const now = levelOf(shown).lv;
  if (now > lvShown) {
    const ups = now - lvShown; lvShown = now; persist();
    if (doorOpen()) { levelFx(now); if (pendingPicks(save) <= ups) auto = true; } // 밀린 게 없을 때만 저절로 (#159: 창이 연달아 뜨지 않게)
    paintHud();
  } else if (now < lvShown) lvShown = now;
}
late.lvGain = () => 0; // #202 앞의 경험치 길 (지금은 번 귤로만 셈)
// 서버가 경험치를 줄였을 때 (online.js fix.lv: 보낸 값에서 cut 만큼)
late.lvFix = (f) => { const cut = Math.max(0, +f?.cut || 0); if (!cut) return; L.xp = Math.max(0, L.xp - cut); shown = Math.min(shown, L.xp); trimAug(save); persist(); paintHud(); late.bagRefresh?.(); };

// 쓰레기·더미: 꽃길 (내가 치운 것만: heap-clear 의 d.by 는 남이 치움)
if (trash) trash.on((ev, d) => {
  if (ev === 'heap-clear' && !d.by) { const f = AUG_BY.flower; if (augN(save, 'flower')) state.flowerT = f.sec; } // 꽃길: 몇 초 빠르게 (update.js late.augSpeed)
});
// 적: 쫓아내면 귤 한 입
{ const prev = life.hooks.enemyRepel;
  life.hooks.enemyRepel = (kind, pos, def) => {
    prev?.(kind, pos, def);
    const b = augV(save, 'bite'); if (b > 0 && !hp.isDown && !hp.pending) hp.set(hp.hp + b);
  }; }
// 싸움 증강 (enemies.js hurt 뒤 hooks.afterHurt): 터지는 귤(둘레 피해), 신 귤(느려짐)
let splashing = false;
const prevHurt = life.hooks.afterHurt; // #140 전설 무기 갈라짐 (loot.js) 을 감쌈
life.hooks.afterHurt = (e, dmg, quiet) => {
  prevHurt?.(e, dmg, quiet);
  if (splashing) return;
  const sr = augV(save, 'sour');
  if (sr > 0 && !e.boss && e.hp > 0) { e.sour = AUG_BY.sour.sec; e.sourK = 1 - sr; }
  const bk = augV(save, 'burst');
  if (bk > 0 && dmg > 0) {
    splashing = true;
    try { for (const o of life.enemies.list.slice()) { if (o === e || o.state === 'flee' || o.state === 'leave') continue; if (Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) <= AUG_BY.burst.r) life.enemies.hurt(o, dmg * bk, true); } }
    finally { splashing = false; }
  }
};
// 이동 (update.js): 가벼운 발 + 꽃길. 식사 버프·장비와 곱하지 않고 더함
late.augSpeed = () => augV(save, 'light') + (state.flowerT > 0 ? augV(save, 'flower') : 0);
state.flowerT = 0;

// ---------- 고르기 창 ----------
const sheet = $('aug-pick'), cards = $('ap-cards'), rrBtn = $('ap-reroll');
let open = false, safeT = 0;
const multi = () => (late.net?.peersById?.size || 0) > 0;
function safe() {
  return state.sessionOn && !late.tut?.active && !player.riding && !player.ride && !player.cart && !player.knock && !hp.isDown && !hp.pending
    && cam.mode === 'follow' && !panelOpen() && !document.hidden && (!(state.tension > 0.2) || !!late.swarmOn?.()) && !late.bossFight?.(); // 들판 떼(#194)는 싸움이 끝나지 않으니 빛이 지나면 엶 (혼자면 멈춤)
}
function render() {
  if (!L.draw) { L.draw = rollDraw(save); L.rr = 0; persist(); }
  const s = levelOf(L.xp), p = pendingPicks(save);
  $('ap-lv').textContent = String(Math.min(s.lv, augCountNow() + 2)); // 이 증강을 얻은 레벨
  $('ap-left').textContent = p > 1 ? `고를 증강 ${p}` : '';
  cards.innerHTML = '';
  (L.draw || []).forEach((id, i) => {
    const a = AUG_BY[id], n = augN(save, id), b = document.createElement('button');
    b.type = 'button'; b.className = 'ap-card'; b.style.setProperty('--br', brColor(id)); b.style.setProperty('--i', i); b.dataset.id = id;
    b.title = `${a.name}: ${augText(a)}${a.field ? ' · 들판에서만' : ''}`; // 숫자는 뒷면에만 (#194): ⓘ·길게 누르기·마우스 올리기
    b.innerHTML = `<span class="ic">${AUG_ICON[id] || ''}</span><b>${a.name}</b><em>${augSay(a)}</em><span class="st" aria-label="${n}/${AUGMENTS.max}">${stars(n)}</span>${a.field ? FIELD_TAG : ''}`
      + `<span class="bk">${augText(a)}${a.field ? '<br>들판에서만' : ''}</span><span class="nf" aria-hidden="true">i</span>`;
    let lp = 0, held = false;
    b.addEventListener('pointerdown', () => { held = false; clearTimeout(lp); lp = setTimeout(() => { held = true; b.classList.add('flip'); }, 450); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => clearTimeout(lp));
    b.addEventListener('click', (e) => {
      if (e.target.closest('.nf')) { b.classList.toggle('flip'); return; } // 뒷면 (숫자)
      if (held) { held = false; return; } // 길게 눌러 뒷면만 봄
      pick(i);
    });
    cards.append(b);
  });
  $('ap-rr-n').textContent = String(LEVEL.reroll);
  rrBtn.disabled = !!L.rr || save.coins < LEVEL.reroll;
}
const augCountNow = () => Object.values(L.aug).reduce((s, n) => s + n, 0);
function show() {
  if (!pendingPicks(save)) return;
  open = true; sheet.hidden = false; sheet.classList.remove('gift'); void sheet.offsetWidth; sheet.classList.add('gift'); render(); // 선물 상자가 열리듯 (#194, page.html .gift)
  if (multi()) player.iframe = Math.max(player.iframe || 0, LEVEL.guard); else state.augPause = true;
  player.target = null; player.onArrive = null;
  setTimeout(() => cards.querySelector('button')?.focus({ preventScroll: true }), 50);
}
function openPick(byHand = false) {
  if (open || !pendingPicks(save)) return false;
  if (byHand) { auto = false; director.begin('level', 'augPick', Infinity); show(); return true; }
  const ok = director.ask('level', 'augPick', show, { sec: Infinity, ttl: 30, queue: false }); if (ok) auto = false; // 안 되면 조금 뒤 다시
  return ok;
}
function close() {
  if (!open) return; open = false; sheet.hidden = true; state.augPause = false; director.end('augPick'); paintHud();
}
function pick(i) {
  const id = L.draw?.[i]; if (!open || !id || augN(save, id) >= AUGMENTS.max || !pendingPicks(save)) return;
  L.aug[id] = augN(save, id) + 1; L.draw = null; L.rr = 0; persist();
  late.sound?.coin?.(); ach.emit('augment-pick'); late.onJourney?.('augment-pick', { id }); late.bagRefresh?.();
  toast(`${AUG_BY[id].name} ${'★'.repeat(L.aug[id])}`);
  if (pendingPicks(save) > 0) render(); else close(); // 밀린 것은 같은 창에서 하나씩 차례로
  paintHud();
}
function reroll() {
  if (!open || L.rr || save.coins < LEVEL.reroll) return;
  save.coins -= LEVEL.reroll; updateStats(); L.draw = rollDraw(save, Math.random, L.draw || []); L.rr = 1; persist(); render();
}
rrBtn.addEventListener('click', reroll);
$('ap-later').addEventListener('click', () => { close(); toast('위 레벨 칸을 누르면 다시 골라요'); });
sheet.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } else if (/^[123]$/.test(e.key)) { e.stopPropagation(); pick(+e.key - 1); } });

// ---------- 감독 문 ----------
director.register({
  id: 'level', kind: 'level',
  intro: () => { paintHud(); levelFx(levelOf(L.xp).lv); if (pendingPicks(save)) auto = true; },
  onOpen: () => paintHud(),
});

// ---------- 매 프레임 (update.js) ----------
export function tickLevel(dt) {
  if (state.flowerT > 0) state.flowerT -= dt;
  watchCoins(); tickShown(dt);
  tickGlow(dt);
  if (open) { if (!pendingPicks(save) || hp.isDown || sheet.hidden) { sheet.hidden = false; close(); } else if (multi()) { state.augPause = false; player.iframe = Math.max(player.iframe || 0, 0.2); } return; }
  if (auto && doorOpen() && pendingPicks(save)) {
    const ok = safe(); safeT = ok || late.swarmOn?.() ? safeT + dt : 0; /* 들판 판(#194)은 받혀 넘어져도 세던 시간을 지우지 않음: 빛이 지난 뒤 처음 안전한 때 엶 */
    if (ok && safeT >= LEVEL.safe) { safeT = 0; openPick(!!late.swarmOn?.()); } /* 들판은 싸움이 이어져 감독 줄(싸우는 중엔 앞 몇 개만)을 기다리지 않고 바로 엶 */
  }
}
paintHud();
late.tickLevel = tickLevel;
late.lvShown = () => doorOpen() && !!trash; // 레벨이 보이는지 (내 가방 줄)
// 내 가방 아래 줄 (bag.js fillFoot)
late.augFoot = () => {
  const s = levelOf(L.xp), list = AUGMENTS.list.filter((a) => augN(save, a.id));
  const chips = list.map((a) => `<span class="ag" style="--br:${brColor(a.id)}" title="${a.name}: ${augText(a, augN(save, a.id))}">${AUG_ICON[a.id]}${a.name}<i>${'★'.repeat(augN(save, a.id))}</i></span>`).join('');
  const p = pendingPicks(save);
  return `<div class="bag-aug"><span class="lvb">레벨 ${s.lv}</span>${chips || '<span>증강 없음</span>'}${p ? `<span>고를 증강 ${p}</span>` : ''}</div>`;
};
// 능력 탭 (#202, bag.js): 레벨·번 귤 띠·고른 증강 (누르면 뒷면에 숫자)
{ const st = document.createElement('style'); st.textContent = `
.lv-tab { display: grid; gap: 10px; }
.lv-tab .lt-h { display: flex; align-items: baseline; gap: 8px; font-family: var(--display); } .lv-tab .lt-h b { font-size: 22px; } .lv-tab .lt-h small { opacity: .75; font-size: 12px; }
.lv-tab .lt-bar { height: 8px; border-radius: 6px; background: rgba(255,255,255,.16); overflow: hidden; } .lv-tab .lt-bar i { display: block; height: 100%; background: var(--gyul, #ff9a1f); border-radius: 6px; }
.lv-tab .lt-go { justify-self: start; }
.lv-tab .lt-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
.lv-tab .lt-a { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 6px 8px; border-radius: 14px; border: 2px solid var(--br); background: var(--paper-2); color: #fff; font-family: var(--display); cursor: pointer; position: relative; min-height: 112px; text-align: center; }
.lv-tab .lt-a .ic { width: 40px; height: 40px; border-radius: 13px; display: grid; place-items: center; background: var(--br); } .lv-tab .lt-a .ic svg { width: 24px; height: 24px; }
.lv-tab .lt-a b { font-size: 14px; } .lv-tab .lt-a i { font-style: normal; color: #ffc14d; font-size: 12px; letter-spacing: 1px; }
.lv-tab .lt-a .bk { display: none; font-size: 12px; line-height: 1.35; font-family: inherit; } .lv-tab .lt-a.flip .bk { display: block; } .lv-tab .lt-a.flip .ic, .lv-tab .lt-a.flip i { display: none; }
.lv-tab .lt-a .fd { font-size: 10px; opacity: .8; display: inline-flex; gap: 2px; align-items: center; } .lv-tab .lt-a .fd svg { width: 11px; height: 11px; }
.lv-tab .lt-none { opacity: .7; font-size: 13px; grid-column: 1 / -1; }`; document.head.appendChild(st); }
late.augTab = (el) => {
  const s = levelOf(L.xp), p = pendingPicks(save), list = AUGMENTS.list.filter((a) => augN(save, a.id));
  const box = document.createElement('div'); box.className = 'lv-tab';
  box.innerHTML = `<div class="lt-h"><b>레벨 ${s.lv}</b><small>${s.need ? `번 귤 ${s.into.toLocaleString()} / ${s.need.toLocaleString()}` : '최고 레벨'}</small></div>`
    + `<div class="lt-bar" title="번 귤로 차요"><i style="width:${(Math.min(1, s.k) * 100).toFixed(1)}%"></i></div>`
    + (p ? `<button type="button" class="btn small lt-go">증강 고르기 +${p}</button>` : '')
    + `<div class="lt-list">${list.map((a) => { const n = augN(save, a.id); return `<button type="button" class="lt-a" style="--br:${brColor(a.id)}" title="${a.name}: ${augText(a, n)}"><span class="ic">${AUG_ICON[a.id] || ''}</span><b>${a.name}</b><i>${stars(n)}</i><span class="bk">${augText(a, n)}</span>${a.field ? FIELD_TAG : ''}</button>`; }).join('') || '<span class="lt-none">아직 고른 증강이 없어요. 레벨이 오르면 골라요</span>'}</div>`;
  box.querySelector('.lt-go')?.addEventListener('click', () => { late.closeBag?.(); openPick(true); });
  for (const b of box.querySelectorAll('.lt-a')) b.addEventListener('click', () => b.classList.toggle('flip'));
  el.append(box);
};
late.level = {
  state: () => ({ xp: L.xp, ...levelOf(L.xp), aug: { ...L.aug }, pend: pendingPicks(save), draw: L.draw && [...L.draw], rr: L.rr, open, auto, paused: !!state.augPause, door: doorOpen(), shown: lvShown, need: needXp(levelOf(L.xp).lv) }),
  gain: (n) => { save.coins += Math.max(0, n | 0); updateStats(); watchCoins(); return n; }, /* 귤 n 을 번 것처럼 */
  shown: () => shown, notEarned: (n) => late.notEarned(n),
  set: (aug) => { L.aug = {}; for (const [k, n] of Object.entries(aug || {})) if (AUG_BY[k]) L.aug[k] = Math.max(0, Math.min(AUGMENTS.max, n | 0)); persist(); paintHud(); late.bagRefresh?.(); },
  setXp: (x) => { L.xp = shown = Math.max(0, +x || 0); lvShown = levelOf(L.xp).lv; persist(); paintHud(); },
  open: () => openPick(true), pick, reroll, close, safe: () => safe(), safeT: () => safeT, paint: paintHud, v: (id) => augV(save, id),
};
