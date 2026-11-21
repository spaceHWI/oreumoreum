// 오름펑크 아이템 (#164): 감귤 박스 헬멧(박스 시야·'퉁' 소리, 능력은 balance.js CLOTHES guard)과 해녀 테왁 배낭(배낭 겉모습 BACK_LOOKS, 물에 뜸)
// - 배낭 겉모습: save.backs = { own: { id: 1 }, cur }. 장비점 배낭 묶음에서 사고(shop.js → late.backCards), 내 가방 배낭 탭에서 고름(bag.js → late.backLookRow)
//   겉모습은 save.js syncEquipGear 가 'back:tewak0~2' 장비로 바꿈(망사리가 찬 정도 state.backFill). 멀티는 옷 묶음(gr)에 실려 감
// - 물에 뜸: stream.js hooks.float 가 빠지지 않게 하고, 여기 tickSwim 이 물낯 높이·흔들림·물결·숨비소리. 이동은 update.js 가 TEWAK.speed 배
//   맵 밖은 update.js 의 spots.clamp(돌담 선)가 그대로 막음 (개울 수문 구멍으로도 못 나감)
import { BACK_LOOKS, TEWAK, BOX_VIEW, BAGS } from '../balance.js';
import { state, late } from './state.js';
import { $, save, persist, syncEquipGear, CLOTH, CL, BACK_BY } from './save.js';
import { stream, player, runner, trash } from './place.js';
import { toast, updateStats } from './hud.js';
import { bagCap } from './pickup.js';
import { sound } from './hooks.js';

const B = () => save.backs || (save.backs = { own: {}, cur: null });
const backOn = (id) => { const b = BACK_BY[id]; return !!b && !!save.backs?.own?.[id] && save.backs.cur === id && (save.equip.bag || 0) >= b.need; };
const floats = () => BACK_LOOKS.some((b) => b.float && backOn(b.id));
const refreshLook = () => { syncEquipGear(); runner.apply(save.outfit); late.net?.send(true); };

/* ---------- 소리 (합성) ---------- */
function thud() { // 박스 '퉁': 낮은 북 + 골판지 바스락
  const c = sound.ctx; if (!c || !sound.on || !sound.sfxOn) return; const t = c.currentTime, out = sound.sfx;
  const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.16);
  const g = c.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.24);
  if (sound.noise) { const n = c.createBufferSource(); n.buffer = sound.noise; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8; const ng = c.createGain(); ng.gain.setValueAtTime(0.25, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12); n.connect(bp); bp.connect(ng); ng.connect(out); n.start(t, Math.random()); n.stop(t + 0.13); }
}
function hoi() { // 숨비소리 '호오이': 숨을 내쉬는 휘파람 (높게 올라갔다 길게 내려옴) + 바람 소리
  const c = sound.ctx; if (!c || !sound.on || !sound.sfxOn) return; const t = c.currentTime, out = sound.sfx;
  const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(900, t); o.frequency.linearRampToValueAtTime(1500, t + 0.25); o.frequency.exponentialRampToValueAtTime(1050, t + 1.1);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.13, t + 0.12); g.gain.setValueAtTime(0.11, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.25);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + 1.3);
  if (sound.noise) { const n = c.createBufferSource(); n.buffer = sound.noise; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 2; const ng = c.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(0.05, t + 0.15); ng.gain.exponentialRampToValueAtTime(0.0001, t + 1.2); n.connect(bp); bp.connect(ng); ng.connect(out); n.start(t, Math.random()); n.stop(t + 1.25); }
}
late.boxThud = thud;

/* ---------- 물에 뜸 ---------- */
if (stream) stream.hooks.float = () => floats();
let swimT = 0, ringT = 0, wasSwim = false, hoiDone = false;
late.tickSwim = (dt) => {
  const p = player, on = !!stream && floats() && !p.air && !p.riding && !p.rescue && stream.inWater(p.pos.x, p.pos.z);
  state.swim = on;
  if (!on) { wasSwim = false; return; }
  swimT += dt;
  if (!wasSwim) { wasSwim = true; stream.splash(p.pos.x, stream.waterY(p.pos.x, p.pos.z), p.pos.z, 0.6); if (!hoiDone) { hoiDone = true; hoi(); } } // 물에 들 때 첨벙, 숨비소리는 세션에 한 번
  p.pos.y = stream.waterY(p.pos.x, p.pos.z) - TEWAK.sink + Math.sin(swimT * Math.PI * 2 * TEWAK.bobHz) * TEWAK.bob;
  if ((ringT -= dt) <= 0) { ringT = TEWAK.ringEvery * (p.speed > 0.3 ? 1 : 2.2); stream.ring(p.pos.x, stream.waterY(p.pos.x, p.pos.z) + 0.01, p.pos.z); if (p.speed > 0.3 && Math.random() < 0.35) sound.splash?.(); }
};

/* ---------- 망사리 불룩 (배낭이 찬 정도) ---------- */
let fillT = 0;
function tickFill(dt) {
  if ((fillT -= dt) > 0) return; fillT = 0.5;
  if (!save.backs?.cur) return;
  const k = trash ? trash.bagVol() / Math.max(1, bagCap()) : 0, lv = k >= TEWAK.fill[1] ? 2 : k >= TEWAK.fill[0] ? 1 : 0;
  if (lv !== (state.backFill || 0)) { state.backFill = lv; if (backOn(save.backs.cur)) refreshLook(); }
}

/* ---------- 박스 시야 ---------- */
const boxWorn = () => !!CLOTH[CL.wear.hat]?.guard && CLOTH[CL.wear.hat]?.look?.kind === 'box';
const bv = $('box-view'), bvBtn = $('menu-boxview');
function tickBox() {
  const ownBox = Object.keys(CL.own).some((id) => CLOTH[id]?.look?.kind === 'box');
  bvBtn.hidden = !ownBox;
  const show = boxWorn() && save.boxView !== 0 && !!state.sessionOn;
  if (bv.hidden === show) bv.hidden = !show;
  if (show) bv.style.setProperty('--bw', `${Math.round(Math.min(innerWidth, innerHeight * 1.8) * (innerWidth <= 600 ? BOX_VIEW.phone : BOX_VIEW.desk))}px`);
}
function boxBtnText() { const on = save.boxView !== 0; bvBtn.textContent = `박스 시야: ${on ? '켬' : '끔'}`; bvBtn.setAttribute('aria-pressed', String(on)); }
bvBtn.addEventListener('click', () => { save.boxView = save.boxView === 0 ? 1 : 0; persist(); boxBtnText(); tickBox(); });
boxBtnText();

/* ---------- 사기·고르기 ---------- */
const TEWAK_SVG = '<circle cx="12" cy="8" r="5"/><path d="M7.5 8h9M8 13c-1 3 0 7 4 8 4-1 5-5 4-8M9 16h6M9.5 19h5"/>';
function buyBack(id) {
  const b = BACK_BY[id]; if (!b || B().own[id]) return false;
  if (save.coins < b.price) { toast(`귤이 ${b.price - save.coins}개 모자라요`); return false; }
  save.coins -= b.price; B().own[id] = 1; if ((save.equip.bag || 0) >= b.need) B().cur = id;
  persist(); updateStats(); refreshLook(); sound.coin?.();
  toast((save.equip.bag || 0) >= b.need ? `${b.name} · 메고 있어요` : `${b.name} · ${BAGS[b.need - 1].name}부터 멜 수 있어요`, 3);
  late.refreshShopPop?.(); late.bagRefresh?.('bag');
  return true;
}
function pickBack(id) { const b = id && BACK_BY[id]; if (id && (!b || !B().own[id] || (save.equip.bag || 0) < b.need)) return false; B().cur = id || null; persist(); refreshLook(); late.bagRefresh?.('bag'); return true; }
// 장비점 배낭 묶음 끝에 겉모습 카드
late.backCards = (g) => {
  for (const b of BACK_LOOKS) {
    const own = !!save.backs?.own?.[b.id], on = backOn(b.id), poor = !own && save.coins < b.price;
    const c = document.createElement('div'); c.className = 'buy-card' + (own ? ' own' : '') + (on ? ' on' : '') + (poor ? ' poor' : ''); c.dataset.k = 'back'; c.dataset.id = b.id;
    c.innerHTML = `<span class="art">${late.SVG_A}>${TEWAK_SVG}</svg></span><span class="bn"><b>${b.name}</b><small class="tier-stats">겉모습 · ${BAGS[b.need - 1].name}부터 · ${b.desc}</small></span>`;
    const act = document.createElement('span'); act.className = 'ba';
    if (own) act.innerHTML = `<span class="have${on ? '' : ' dim'}">${on ? '메는 중' : '가짐'}</span>`;
    else { const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'tier-buy buy-btn' + (poor ? ' short' : ''); btn.innerHTML = poor ? `${(b.price - save.coins).toLocaleString()}귤 더 필요` : `<i class="g"></i>${b.price.toLocaleString()} 사기`; btn.setAttribute('aria-label', `${b.name} 사기 · 귤 ${b.price}`); btn.addEventListener('click', () => buyBack(b.id)); act.append(btn); }
    c.append(act); g.append(c);
  }
};
// 내 가방 배낭 탭: '배낭 모양' 한 줄 (기본 / 가진 겉모습)
late.backLookRow = (g, card) => {
  g.append(card({ icon: '<path d="M7 9a5 5 0 0 1 10 0v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9z"/>', name: '배낭 모양 · 기본', sub: '단계 배낭 그대로', on: !save.backs?.cur, own: true, click: () => pickBack(null) }));
  for (const b of BACK_LOOKS) {
    const own = !!save.backs?.own?.[b.id], ok = (save.equip.bag || 0) >= b.need;
    g.append(card({ icon: TEWAK_SVG, name: `배낭 모양 · ${b.name}`, sub: ok ? b.desc : `${BAGS[b.need - 1].name}부터 멜 수 있어요`, on: backOn(b.id), own: own && ok, lock: own ? null : { shop: 'gear', price: b.price }, click: () => pickBack(b.id) }));
  }
};

late.tickPunk = (dt) => { tickFill(dt); tickBox(); };
late.punk = { fill: () => state.backFill, buy: buyBack, pick: pickBack, floats, swim: () => !!state.swim, boxView: () => !bv.hidden, thud, hoi };
