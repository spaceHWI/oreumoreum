// 가게를 퀘스트 순서대로 하나씩 열기 (#206): src/shopgate.js(어느 가게가 열렸나)를 게임에 붙인다. 파일 순서는 wish 뒤·start 앞 (src/modules.js)
// - 표는 balance.js SHOP_ST.unlock (장비점 → 만족한상회 → 스톤 → 루이네미장원·LEAP → 탈것 가게·마차)
// - 닫힌 가게: 건물은 그대로, 문 앞에 셔터가 내려가 있고 지붕 간판은 꺼짐(shops.js roofSigns.off), 가게 주인 NPC 없음(game/quest.js), 지도엔 회색 점(game/shop.js)
//   가까이 가면 '준비 중 — ○○ 열려요' 한 줄. 상호작용·가장자리 표시·가게 안내·퀘스트(need shop:)는 stores.js SHOP_POP when 으로 막힘. ride 는 마차 타기도(dump.js)
// - 열릴 때: 조건을 채우면 감독(#176) 차례를 받아 한 번 알림 + 길 안내 표시 하나(tipMark) + 셔터가 올라가고 주인이 손 흔듦. 싸우는 중·창이 열린 중이면 미룸
// - 옛 저장: 처음 볼 때 조건을 넘겼거나 그 가게를 쓴 적이 있으면 처음부터 열림(알림 없이)
// - 어드민 '가게 모두 열기'(이 기기만)·촬영 모드(#185)에서는 모두 열린 모습. 멀티: 사람마다 내 화면에서만 (서버는 기존대로)
// dev: __oreum.shopGate (state·isOpen(id)·why(id)·open(id)·check()·force(on)·shut(id))
import * as THREE from 'three';
import { createShopGate } from '../shopgate.js';
import { SHOP_ST } from '../balance.js';
import { STREET } from '../streetlayout.js';
import { levelOf } from '../augments.js';
import { height } from '../world.js';
import { gradHard } from '../toon.js';
import { TEXCS } from '../boot.js';
import { state, late } from './state.js';
import { $, save, persist } from './save.js';
import { scene } from './scene.js';
import { shopsBuilt, roofSigns, trash, player, NS_TUT } from './place.js';
import { toast, tipMark } from './hud.js';
import { say } from './director.js';
import { bagCap } from './pickup.js';

const G = SHOP_ST.gate, DEFS = SHOP_ST.unlock || [];
const life = () => save.ach?.life || {};
const FORCE_KEY = 'oreumoreum.hwi.shops';
let forceOn = false; try { forceOn = localStorage.getItem(FORCE_KEY) === '1'; } catch (e) { /* 무시 */ }
const gs = () => save.shopGate || {};
const FACTS = {
  jeong: () => (!NS_TUT || save.jeong ? 1 : 0),
  fullDump: () => (gs().fd ? 1 : 0),
  zd1: () => (save.boss?.done?.[1] > 0 ? 1 : 0),
  zd2: () => (save.boss?.done?.[2] > 0 ? 1 : 0),
  zone: () => save.journey?.maxZ || 0,
  lv: () => levelOf(save.lv?.xp || 0).lv,
  dumps: () => save.recycle?.visits || 0,
};
// 그 가게를 쓴 적이 있나 (옛 저장)
const USED = {
  gear: () => (save.equip?.tool | 0) > 2 || (save.equip?.bag | 0) > 1,
  manjok: () => (life()['meal-manjok'] || 0) > 0,
  stone: () => (life().meal || 0) - (life()['meal-manjok'] || 0) > 0,
  salon: () => (life().haircut || 0) > 0,
  leap: () => (life()['clothes-buy'] || 0) > 0,
  ride: () => Array.isArray(save.rides?.own) && save.rides.own.length > 0,
};
export const gate = createShopGate({
  save, persist, defs: DEFS,
  hooks: {
    facts: () => Object.fromEntries(Object.entries(FACTS).map(([k, f]) => { let v = 0; try { v = f(); } catch { v = 0; } return [k, v]; })),
    used: (id) => !!USED[id]?.(),
    force: () => forceOn || !!state.rec?.on,
  },
});
late.shopOpen = (id) => gate.isOpen(id);
late.shopWhy = (id) => gate.why(id);
gate.check(); // 옛 저장: 처음 볼 때 조용히 엶

/* ---------- 셔터 (닫힌 가게 문 앞) ---------- */
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = TEXCS; return t; }
const slatTex = canvasTex(64, 256, (g) => { // 가로 골이 진 회색 셔터
  g.fillStyle = '#b9bdbf'; g.fillRect(0, 0, 64, 256);
  for (let y = 0; y < 256; y += 16) { g.fillStyle = '#8f9496'; g.fillRect(0, y, 64, 3); g.fillStyle = '#d3d6d7'; g.fillRect(0, y + 3, 64, 2); }
  g.fillStyle = '#6d7275'; g.fillRect(0, 244, 64, 12);
});
const soonTex = canvasTex(128, 72, (g) => { // 작은 팻말: 귤색 판에 고깔 + 점 세 개 (글자 없이)
  g.fillStyle = '#2f3336'; g.fillRect(0, 0, 128, 72); g.strokeStyle = '#ff8a1f'; g.lineWidth = 6; g.strokeRect(3, 3, 122, 66);
  g.fillStyle = '#ff8a1f'; g.beginPath(); g.moveTo(34, 14); g.lineTo(46, 14); g.lineTo(58, 58); g.lineTo(22, 58); g.closePath(); g.fill();
  g.fillStyle = '#fff'; g.fillRect(31, 28, 18, 6);
  g.fillStyle = '#f3ecdc'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(76 + i * 16, 38, 5, 0, 7); g.fill(); }
});
const tm = (c, map) => new THREE.MeshToonMaterial({ color: c, gradientMap: gradHard, ...(map ? { map } : {}) });
const MAT = { post: tm('#4b5054'), box: tm('#3b4044'), slat: Object.assign(tm('#ffffff', slatTex), { side: THREE.DoubleSide }), sign: new THREE.MeshBasicMaterial({ map: soonTex, side: THREE.DoubleSide }) };
const shut = new Map(); // 가게 id → { g, panel, sign, up: 올라간 정도 0..1, anim }
for (const sh of shopsBuilt) {
  if (!gate.def(sh.id) || !sh.door) continue; const L = STREET.lot(sh.lot); if (!L) continue;
  const bl = Math.hypot(L.back.x, L.back.z) || 1, x = sh.door.x + (L.back.x / bl) * G.shutIn, z = sh.door.z + (L.back.z / bl) * G.shutIn, W = G.shutW, H = G.shutH;
  const g = new THREE.Group(); g.position.set(x, height(x, z) - 0.05, z); g.rotation.y = L.rot;
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, H + 0.4, 0.16), MAT.post); p.position.set(s * (W / 2 + 0.08), (H + 0.4) / 2, 0); g.add(p); }
  const box = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 0.36, 0.42), MAT.box); box.position.y = H + 0.22; g.add(box);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(W, H).translate(0, -H / 2, 0), MAT.slat); panel.position.set(0, H + 0.04, 0.02); g.add(panel); // 위 끝이 원점: scale.y 로 말려 올라감
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.45), MAT.sign); sign.position.set(0, 1.45, 0.05); g.add(sign);
  g.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; } });
  scene.add(g);
  shut.set(sh.id, { sh, g, panel, sign, up: 0, anim: false });
}
function setShut(id, closed) { // 바로 (애니메이션 없이)
  const s = shut.get(id); if (!s) { roofSigns?.off(id, closed); return; }
  s.anim = false; s.up = closed ? 0 : 1; s.g.visible = closed; s.panel.scale.y = 1; s.sign.visible = true;
  roofSigns?.off(id, closed);
}
function raise(id) { const s = shut.get(id); roofSigns?.off(id, false); if (!s || !s.g.visible) return; s.anim = true; s.up = 0; s.sign.visible = false; late.sound?.cartBell?.(0.4); }
function tickShut(dt) {
  for (const s of shut.values()) {
    if (!s.anim) continue;
    s.up = Math.min(1, s.up + dt / G.upT); s.panel.scale.y = Math.max(0.02, 1 - s.up);
    if (s.up >= 1) { s.anim = false; s.g.visible = false; s.panel.scale.y = 1; }
  }
}
const shown = new Map(); // 가게 id → 지금 그린 상태(열림 true)
function sync() {
  for (const sh of shopsBuilt) {
    if (!gate.def(sh.id)) continue; const o = gate.isOpen(sh.id);
    if (shown.get(sh.id) === o) continue; shown.set(sh.id, o);
    const s = shut.get(sh.id); if (o && s?.anim) continue;
    setShut(sh.id, !o);
  }
}
sync();

/* ---------- 열릴 때 ---------- */
const nameOf = (id) => shopsBuilt.find((s) => s.id === id)?.name || id;
const wait = new Map(); // 가게 id → 기다린 초
function opening(id) { // 셔터가 올라가고 주인이 손 흔듦, 길 안내 표시 하나 (#201)
  if (!gate.open(id)) return;
  wait.delete(id); shown.set(id, true); raise(id); late.questWave?.(id);
  const sh = shopsBuilt.find((s) => s.id === id); if (sh && !gate.def(id)?.quiet) tipMark(sh.signPos || sh.door);
}
function tickOpen(dt) {
  for (const id of gate.check()) {
    const d = gate.def(id), w = (wait.get(id) || 0) + dt; wait.set(id, w);
    if (late.tut?.active) continue;
    if (d?.quiet) { wait.delete(id); gate.open(id); continue; } /* sync 가 셔터를 바로 치움 */
    if (w > G.waitMax) { wait.delete(id); gate.open(id); continue; } /* 오래 차례를 못 받으면 알림 없이 */
    say('intro', 'shop-' + id, d.say || `${nameOf(id)}이 문을 열었어요`, G.sec, { ttl: 30, then: () => opening(id) }); /* 감독 줄에 섬 (싸움·창·다른 말이 끝나면 차례) */
  }
}
/* ---------- 닫힌 가게 앞 '준비 중' ---------- */
let nearAt = null;
function tickNear() {
  if (late.tut?.active) return;
  let hit = null;
  for (const sh of shopsBuilt) {
    if (!sh.door || gate.isOpen(sh.id)) continue;
    const d = Math.hypot(player.pos.x - sh.door.x, player.pos.z - sh.door.z);
    if (d < (sh.r || 5) + G.nearR) { hit = sh; break; }
  }
  if (hit && nearAt !== hit.id) { nearAt = hit.id; toast(`준비 중 — ${gate.why(hit.id)} 열려요`, 3.2); }
  else if (!hit && nearAt) { const sh = shopsBuilt.find((s) => s.id === nearAt); if (!sh || Math.hypot(player.pos.x - sh.door.x, player.pos.z - sh.door.z) > (sh.r || 5) + G.nearOff) nearAt = null; }
}

/* ---------- 첫 배낭이 가득 → 버림 (만족한상회 조건) ---------- */
function tickFull() {
  const g = save.shopGate; if (!g || g.fd || !trash) return;
  const visits = save.recycle?.visits || 0;
  if (!g.full) {
    if (save.tut?.done && (save.equip?.bag | 0) >= 1 && bagCap() - trash.bagVol() < G.fullRoom) { g.full = 1; g.dumps = visits; persist(); }
  } else if (visits > (g.dumps | 0)) { g.fd = 1; persist(); }
}

/* ---------- 어드민 '가게 모두 열기' (이 기기만) ---------- */
function setForce(on) {
  forceOn = !!on; try { if (on) localStorage.setItem(FORCE_KEY, '1'); else localStorage.removeItem(FORCE_KEY); } catch (e) { /* 무시 */ }
  $('dev-shops')?.setAttribute('aria-pressed', String(forceOn)); sync();
}
{ const b = $('dev-shops'); if (b) { b.setAttribute('aria-pressed', String(forceOn)); b.addEventListener('click', () => { setForce(!forceOn); toast(forceOn ? '가게 모두 열기: 켬' : '가게 모두 열기: 끔'); }); } }

/* ---------- 매 프레임 ---------- */
let t = 0;
late.tickShopGate = (dt) => {
  tickShut(dt);
  if ((t -= dt) > 0) return; t = 0.5;
  tickFull(); sync(); tickOpen(0.5); tickNear();
};

late.shopGateDebug = {
  api: gate, state: () => gate.state(), isOpen: (id) => gate.isOpen(id), why: (id) => gate.why(id), check: () => gate.check(),
  open: (id) => opening(id), force: (on) => setForce(on), shut: (id) => { const g = save.shopGate; if (g?.open) delete g.open[id]; shown.delete(id); sync(); },
  shutter: (id) => { const s = shut.get(id); return s && { visible: s.g.visible, up: +s.up.toFixed(2), x: +s.g.position.x.toFixed(1), z: +s.g.position.z.toFixed(1) }; },
  facts: () => Object.fromEntries(Object.entries(FACTS).map(([k, f]) => [k, f()])),
};
