// 캐릭터 혼잣말 (#169): 내 캐릭터 머리 위에 가끔 실마리 말풍선. 다음에 할 만한 일·숨은 재미를 넌지시 (답은 말하지 않음)
// - 한 번에 한 줄 MUTTER.sec 초. 혼잣말 사이 MUTTER.gap 초 + 0~wait 초. 나가는 차례는 감독(#176, kind 'mutter': 싸움·창·튜토리얼·다른 안내 중엔 안 나감)
// - 줄마다 when(지금 말할 만함)·solved(그 일을 했음 → 다시 안 나옴)·need(그 기능이 있을 때만). 같은 줄은 MUTTER.max 번까지
// - 일 줄(ev): 그 일이 일어난 뒤 MUTTER.evTtl 초 안에만 (기다리는 시간 없이, gap 만 지키면 바로)
// - 한가한 혼잣말(idle*): 실마리 조건이 MUTTER.idleAfter 초 넘게 하나도 없을 때만
// - 내 화면에만 (멀티로 보내지 않음). 메뉴 설정 '혼잣말' 로 끔 (save.mutter.off)
// 저장 save.mutter = { seen: {id: n}, off, hand 손으로 던진 수, charge 모아 쏘기를 써 봄, street 가게 거리에 가 봄, summit 정상에 가 봄 }
// 파일 순서는 swarm 뒤 (이야기·우두머리·들판이 다 있음). dev: __oreum.mutter.say(id)·state()·lines
import * as THREE from 'three';
import { MUTTER as M, ZONE_BOSS } from '../balance.js';
import { MUTTER_TEXT as T } from '../punktext.js';
import { TEXCS } from '../boot.js';
import { bubbleCanvas, bubbleScale, bubbleLines, bubblePages } from '../bubble.js';
import { state, late } from './state.js';
import { save, persist, MAP_ID } from './save.js';
import { spots, sunState, wx } from './scene.js';
import { player, runner, trash, life, cairns, stream, hp, shopsBuilt } from './place.js';
import { ach } from './hud.js';
import { director } from './director.js';
import { onRoad } from './ride.js';
import { weaponNow } from './throw.js';
import { chargeState } from './charge.js';
import { bagCap } from './pickup.js';
import { field } from './field.js';
import { STREET } from '../streetlayout.js';
import { veilOn } from '../ufoveil.js';

const S = (() => {
  let s = save.mutter;
  if (!s || typeof s !== 'object' || Array.isArray(s)) s = save.mutter = {};
  if (!s.seen || typeof s.seen !== 'object' || Array.isArray(s.seen)) s.seen = {};
  s.hand = Math.max(0, s.hand | 0);
  return s;
})();
const life0 = (k) => save.ach?.life?.[k] || 0;
const storyDone = (id) => Array.isArray(save.story?.done) && save.story.done.includes(id);
const pp = () => player.pos;
const dist = (x, z) => Math.hypot(x - pp().x, z - pp().z);
const zoneNow = () => (trash ? trash.zoneAt(pp().x, pp().z) || 0 : 0);
const todayStr = () => new Date().toDateString();
const hasSatis = shopsBuilt.some((sh) => sh.id === 'manjok'); /* #279 만족한상회 가게 id */

// 큰 더미(xl·쓰레기 산) 근처
function nearBig() { if (!trash) return false; for (const h of trash.heaps) if ((h.k === 'xl' || h.k === 'mt') && h.st >= 0 && dist(h.x, h.z) < M.near.heap + (h.r || 0)) return true; return false; }
const bigCleared = () => !!trash && trash.heaps.some((h) => (h.k === 'xl' || h.k === 'mt') && h.st < 0);
const zoneLeftHeaps = (z) => (trash ? trash.heaps.filter((h) => h.zone === z && h.st >= 0).length : 0);
const fieldCleared = () => !!trash && trash.heaps.some((h) => h.field && h.st < 0);
const denClosedAny = () => Object.keys(save.field?.den || {}).length > 0;
function streamNear() {
  if (!stream || state.fishing?.busy || stream.onBridge?.(pp().x, pp().z)) return false;
  const [, lat] = stream.local(pp().x, pp().z); const [x, z] = stream.at(stream.centerOff(lat), Math.max(-20, Math.min(20, lat)));
  return dist(x, z) < M.near.stream;
}
const stoneToday = () => Object.values(save.wishes || {}).some((w) => w && new Date(w.at).toDateString() === todayStr());

// 조건 → 대사. ev: 일이 일어날 때만(아래 evNow). need: 그 기능이 있을 때만
const LINES = [
  { id: 'bigHeap', ev: true, solved: bigCleared },
  { id: 'zoneTwo', when: () => { const z = zoneNow(); return z > 0 && zoneLeftHeaps(z) === 2; }, solved: () => life0('zone-clear') > 0 },
  { id: 'bossQuiet', need: () => !!late.bossFight, when: () => { const z = zoneNow(); if (!z || save.boss?.done?.[z] > 0) return false; const c = trash.zoneClean(z); return c >= M.boss && c < ZONE_BOSS.appear; }, solved: () => Object.values(save.boss?.done || {}).some((n) => n > 0) },
  { id: 'bagHeavy', when: () => !!trash && trash.bagVol() / Math.max(1, bagCap()) >= M.bagFull, solved: () => life0('recycle') >= 3 },
  { id: 'canBuy', when: () => (late.canBuyGear?.() || []).length > 0, solved: () => life0('gear-buy') > 0 },
  { id: 'handOnly', when: () => S.hand >= M.hand && weaponNow().id === 'hand', solved: () => life0('weapon-buy') > 0 },
  { id: 'charge', when: () => life0('enemy-repel') >= 3, solved: () => !!S.charge },
  { id: 'roadOnly', need: () => !!field, when: () => !!save.jeong && (save.trash?.total || 0) >= M.fieldPicked && onRoad(pp().x, pp().z), solved: fieldCleared },
  { id: 'den', need: () => !!field, when: () => field.dens.some((d) => !save.field?.den?.[d.id] && dist(d.x, d.z) < M.near.den), solved: denClosedAny },
  { id: 'hareubang', when: () => (life.hareubangs || []).some((h) => dist(h.pos.x, h.pos.z) < M.near.hareubang), solved: () => life0('hareubang') > 0 },
  { id: 'cairn', when: () => !stoneToday() && cairns.some((c) => dist(c.pos.x, c.pos.z) < M.near.cairn), solved: () => life0('stone') > 0 },
  { id: 'stream', need: () => !!stream, when: streamNear, solved: () => life0('fish') > 0 },
  { id: 'nightLight', when: () => (sunState?.el ?? 30) < -4 && zoneNow() >= M.nightZone, solved: () => storyDone('night') },
  { id: 'rain', when: () => wx.kind === 'rain' },
  { id: 'piglets', need: () => !!late.storyApi, when: () => life0('enemy-repel-piglet') >= M.piglets, solved: () => storyDone('mom') },
  { id: 'dumped', ev: true, solved: () => life0('dumper-repel') >= 3 },
  { id: 'street', ev: true, text: () => (hasSatis ? T.street : T.streetAlt) },
  { id: 'hungry', when: () => !save.buff && hp.hp / hp.max < M.hpLow && !hp.isDown, solved: () => life0('meal') > 0 },
  { id: 'legs', when: () => !(save.rides?.own?.length) && walked >= M.walk, solved: () => (save.rides?.own?.length || 0) > 0 },
  { id: 'summit', ev: true },
  { id: 'oddTrash', ev: true, need: () => veilOn() }, /* #207 아침의 흔적 곁 (ufoseen.js 가 late.mutterEv) */
  { id: 'glint', ev: true }, // #208 정상 첫 장면 끝에 game/summit.js 가 say('glint') 로 부름
  { id: 'num404', ev: true }, /* #212 4:04 를 여러 곳에서 본 뒤 (game/mystery.js 가 late.mutterEv) */
  { id: 'cropMid', ev: true }, /* #212 크롭서클 가운데 (game/traces.js) */
  { id: 'cave', need: () => !!late.caveApi, when: () => !state.cave && zoneNow() === 4 && late.caveApi.can()[0], solved: () => !!save.cave?.runs?.d }, /* #195 바람 새는 굴 (들어가 보면 끝) */
];
for (let i = 1; T['idle' + i]; i++) LINES.push({ id: 'idle' + i, idle: true });
const BY = Object.fromEntries(LINES.map((l) => [l.id, l]));
const textOf = (l) => (l.text ? l.text() : T[l.id]) || '';
const spent = (l) => (S.seen[l.id] | 0) >= M.max;
const alive = (l) => { if (spent(l)) return false; try { if (l.need && !l.need()) return false; if (l.solved && l.solved()) return false; } catch { return false; } return true; };

// ---------- 말풍선 (보통 말풍선과 같은 실선 테두리, 글자만 조금 옅게. 점선·기울임은 #226 에서 뺌) ----------
let bub = null; // { sp, t }
function makeBubble(text, L) { // 그림은 src/bubble.js 한 틀 (#190). L: 이번 장 줄들
  const b = bubbleCanvas(text, { L, ink: '#5d6650' });
  const tx = new THREE.CanvasTexture(b.canvas); tx.colorSpace = TEXCS;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, depthTest: false, opacity: 0 }));
  const [sx, sy] = bubbleScale(b); sp.scale.set(sx, sy, 1); sp.center.set(0.5, 0); sp.renderOrder = 10; sp.position.y = M.y - 0.42; sp.name = 'mutter';
  return sp;
}
function clearBubble() { if (!bub) return; bub.sp.parent?.remove(bub.sp); bub.sp.material.map.dispose(); bub.sp.material.dispose(); bub = null; }
// 긴 줄은 두 장으로 (#190): 장마다 M.sec 초, 두 번째 장은 그림만 바꿈(페이드 없이)
function showBubble(text) { clearBubble(); const P = bubblePages(text), sp = makeBubble(text, P[0]); runner.root.add(sp); bub = { sp, t: M.sec * P.length, T: M.sec * P.length, text, next: P[1] || null }; }
function flipBubble() { const sp = makeBubble(bub.text, bub.next); sp.material.opacity = bub.sp.material.opacity; runner.root.add(sp); bub.sp.parent?.remove(bub.sp); bub.sp.material.map.dispose(); bub.sp.material.dispose(); bub.sp = sp; bub.next = null; }

// ---------- 차례 ----------
const gapK = () => late.barMul?.('mutter') ?? 1; /* #316 Bar 소설 '여운': 혼잣말 사이가 짧아짐 */
let lastP = null, clock = 0, lastSay = -1e9, nextAt = M.gap * 0.5 + Math.random() * M.wait, lastClue = 0, chkT = 0, walked = 0, handPose = false, inBig = false, inStreet = false, inTop = false;
const evAt = {}; // id → 일이 일어난 clock
const evNow = (id) => clock - (evAt[id] ?? -1e9) < M.evTtl;
const isOff = () => !!S.off;

function speak(l, force = false) {
  const text = textOf(l); if (!text) return false;
  const fn = () => { showBubble(text); S.seen[l.id] = (S.seen[l.id] | 0) + 1; persist(); lastSay = clock; nextAt = clock + (M.gap + Math.random() * M.wait) * gapK(); delete evAt[l.id]; if (l.id === 'legs') walked = 0; };
  const sec = M.sec * bubblePages(text).length; // 두 장이면 그만큼 (#190)
  if (force) { director.begin('mutter', 'mutter:' + l.id, sec); fn(); return true; }
  return director.ask('mutter', 'mutter:' + l.id, fn, { sec, queue: false });
}
// 지금 말할 줄들 (일 줄 먼저, 그다음 덜 말한 줄, 같으면 아무거나)
function candidates() {
  const out = [], idle = [];
  let clue = false;
  for (const l of LINES) {
    if (!alive(l)) continue;
    if (l.idle) { idle.push(l); continue; }
    let ok = false; try { ok = l.ev ? evNow(l.id) : !!l.when?.(); } catch { ok = false; }
    if (ok) { out.push(l); clue = true; }
  }
  if (clue) lastClue = clock;
  const order = (a, b) => (b.ev ? 1 : 0) - (a.ev ? 1 : 0) || (S.seen[a.id] | 0) - (S.seen[b.id] | 0) || Math.random() - 0.5;
  out.sort(order);
  if (!out.length && clock - lastClue >= M.idleAfter) idle.sort(order).forEach((l) => out.push(l));
  return out;
}
const ready = () => state.sessionOn && !isOff() && !!save.tut?.done && !late.tut?.active && director.isOpen('tips') && !hp.isDown && !state.cine;

// ---------- 일 (ev) ----------
// 투기꾼이 버리고 감 (hooks.js dumpers dumped 가 부름)
late.mutterEv = (id) => { if (BY[id]) evAt[id] = clock; }; // #207 다른 파일이 일 줄을 부름
late.mutterDumped = (d, n) => { if (n && d?.pos && dist(d.pos.x, d.pos.z) < 60) evAt.dumped = clock; };

function watch(dt) {
  // 걸은 거리 (탈것·노루·마차 없이)
  if (!player.ride && !player.riding && !player.cart && lastP) walked += Math.min(5, Math.hypot(pp().x - lastP.x, pp().z - lastP.z));
  lastP ? lastP.copy(pp()) : (lastP = pp().clone());
  // 손으로 던짐 (던지기 동작이 시작될 때 하나)
  const th = player.pose === 'throw'; if (th && !handPose && weaponNow().id === 'hand') { S.hand++; if (S.hand % 5 === 0) persist(); } handPose = th;
  // 모아 쏘기를 써 봄
  if (!S.charge) { const c = chargeState?.(); if (c && c.on && c.k >= 0.5) { S.charge = 1; persist(); } }
  if ((chkT -= dt) > 0) return false; chkT = M.checkSec;
  // 큰 더미에 들어섬 · 가게 거리 처음 · 정상 처음
  const big = nearBig(); if (big && !inBig) evAt.bigHeap = clock; inBig = big;
  const st = !!STREET?.center && dist(STREET.center.x, STREET.center.z) < (STREET.radius || 30); if (st && !inStreet && !S.street) { S.street = 1; persist(); evAt.street = clock; } inStreet = st;
  const top = !!spots.isViewpoint?.(pp()); if (top && !inTop && !S.summit) { S.summit = 1; persist(); if (life0('view-' + MAP_ID) <= 1) evAt.summit = clock; } inTop = top;
  return true;
}

export function tickMutter(dt) {
  clock += dt;
  if (bub) { bub.t -= dt; if (bub.next && bub.t <= bub.T - M.sec) flipBubble(); bub.sp.material.opacity = Math.min(1, (bub.T - bub.t) * 4, bub.t * 2.5); if (bub.t <= 0 || isOff()) clearBubble(); }
  if (!trash || !state.sessionOn) return;
  if (!watch(dt) || !ready() || bub) return; // 조건은 checkSec 마다 한 번
  if (clock - lastSay < M.gap * gapK()) return;
  const list = candidates(); if (!list.length) { if (clock >= nextAt) nextAt = clock + M.retry; return; }
  const hasEv = list[0].ev;
  if (!hasEv && clock < nextAt) return;
  for (const l of list) { if (speak(l)) return; if (!director.can('mutter')) break; }
  if (!hasEv) nextAt = clock + M.retry; // 감독이 지금 안 됨 → 조금 뒤
}
late.tickMutter = tickMutter;

// ---------- 설정: 혼잣말 ----------
{
  const more = document.querySelector('#menu .m-more') || document.querySelector('.m-more');
  if (more) {
    const b = document.createElement('button'); b.type = 'button'; b.id = 'menu-mutter';
    const sync = () => { b.textContent = `혼잣말: ${S.off ? '끔' : '켬'}`; b.setAttribute('aria-pressed', String(!S.off)); };
    sync(); b.addEventListener('click', () => { S.off = S.off ? 0 : 1; if (S.off) clearBubble(); persist(); sync(); });
    more.insertBefore(b, more.children[1] || null);
  }
}

// dev
late.mutterApi = {
  lines: LINES.map((l) => l.id),
  wrap: (t) => bubbleLines(t), // 말풍선 줄 나눔 (#190, src/bubble.js)
  say: (id) => { const l = BY[id]; if (!l) return false; return speak(l, true); },
  hush: () => clearBubble(), /* 말풍선을 바로 지움 (#232 장면 시작) */
  line: (id, text) => (isOff() || !text ? false : speak({ id, text: () => text }, true)), /* 다른 기능의 한 줄 (#232 사건 목격). 혼잣말을 껐으면 false */
  ev: (id) => { evAt[id] = clock; },
  now: () => candidates().map((l) => l.id),
  bubble: () => (bub ? { text: bub.text, t: +bub.t.toFixed(2), opacity: +bub.sp.material.opacity.toFixed(2), onMe: bub.sp.parent === runner.root } : null),
  state: () => ({ seen: { ...S.seen }, off: !!S.off, hand: S.hand, charge: !!S.charge, walked: Math.round(walked), sinceSay: +(clock - lastSay).toFixed(1), next: +(nextAt - clock).toFixed(1), idleIn: +(M.idleAfter - (clock - lastClue)).toFixed(1), ready: ready(), alive: LINES.filter(alive).map((l) => l.id) }),
  time: (sec) => { lastSay -= sec; nextAt -= sec; lastClue -= sec; }, // 시간을 당김 (확인용)
};
