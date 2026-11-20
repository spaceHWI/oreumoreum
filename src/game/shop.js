// 상점 팝업(장비 탭)·사는 연출, 옷 (#86 에서 main.js 를 나눔. 파일 순서는 src/main.js, 규칙은 notes/prototype-v1.md 코드 구조)
import { TOOLS, BAGS, POCKET, SHOES, WEAPONS, WEAR, CLOTHES, wearPrice } from '../balance.js';
import { LOW } from '../gfx2.js';
import { clothSvg, WEAR_STAT_ICON, wearStatText } from '../clothicons.js';
import { state, late } from './state.js';
import { $, save, CLOTH, CL, wearV, syncEquipGear, persist } from './save.js';
import { LEAPB, runner, player } from './place.js';
import { cam } from './camera.js';
import { toast, updateStats, closePanels, ach } from './hud.js';
import { net } from './room.js';
import { updateTrashUI } from './pickup.js';

Object.assign(late, { openShop, spendFx, buyGear, wearCloth, buyCloth }); // 앞 파일에서 부르는 함수

// ---------- 상점·옷장 ----------
// 상점 팝업 (#26): 탭 도구·배낭·신발·옷. 장비 탭은 5단계 한 줄(가진 것 체크·다음 것 값·그 뒤 잠금)
const GEAR_ROWS = { tool: { k: 'tool', list: TOOLS }, bag: { k: 'bag', list: BAGS }, shoes: { k: 'shoes', list: SHOES }, weapon: { k: 'weapon', list: WEAPONS } };
const gearKeys = () => Object.keys(GEAR_ROWS).filter((k) => !(k === 'shoes' && LEAPB)); // 신발은 LEAP 이 있으면 거기서 (#59)
const SVG_A = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"'; late.SVG_A = SVG_A;
// 단계마다 그림 (로우폴리 임시 아이콘)
const TIER_ART = {
  tool: ['<path d="M8 21v-7l-2-3V6a1 1 0 0 1 2 0v4M10 10V4a1 1 0 0 1 2 0v6M12 10V5a1 1 0 0 1 2 0v5M14 10V6a1 1 0 0 1 2 0v6l-2 9"/>', // 맨손
    '<path d="M10 3l1 18M14 3l-1 18M9 8h6"/>', // 집게
    '<path d="M12 3v11M6 21l2-7h8l2 7M10 14v7M14 14v7"/>', // 갈퀴
    '<path d="M12 2v11M4 21l2-8h12l2 8M8 13v8M12 13v8M16 13v8"/>', // 큰 갈퀴
    '<path d="M9 3h6v6H9zM12 9v6M7 15h10l-2 6H9zM17 5h3M17 7h2"/>'], // 흡입기
  bag: ['<path d="M8 10h8v10H8zM10 10V8a2 2 0 0 1 4 0v2"/>',
    '<path d="M7 9h10v11H7zM9.5 9V7a2.5 2.5 0 0 1 5 0v2M9 14h6"/>',
    '<path d="M6 8h12v13H6zM9 8V6a3 3 0 0 1 6 0v2M9 13h6v4H9z"/>',
    '<path d="M5 7h14v14H5zM8.5 7V5a3.5 3.5 0 0 1 7 0v2M8 12h8v5H8zM5 10H3v6h2M19 10h2v6h-2"/>',
    '<path d="M5 6h14v15H5zM8.5 6V4.5a3.5 3.5 0 0 1 7 0V6M8 11h8v6H8zM5 9H3v8h2M19 9h2v8h-2M7 3h10"/>'],
  shoes: ['<path d="M4 16h14a2 2 0 0 0-2-3h-3l-2-3H6l-2 3zM4 16v2h14v-2"/>',
    '<path d="M3 16h16a2 2 0 0 0-2-3h-3l-3-4H5l-2 4zM3 16v2h16v-2M8 9l1 2"/>',
    '<path d="M3 16h17a2 2 0 0 0-2-3h-3l-3-4H5l-2 4zM3 16v2h17v-2M6 18v1M10 18v1M14 18v1M18 18v1"/>',
    '<path d="M4 16h16a2 2 0 0 0-2-3h-3l-2-6H6v6l-2 0zM4 16v3h16v-3M7 9h5M7 11h5"/>',
    '<path d="M3 15h17a2 2 0 0 0-2-3h-3l-3-4H5l-2 4zM3 15v2h17v-2M1 9h4M2 12h3M20 7l2-2M21 10h2"/>'],
  weapon: ['<circle cx="9" cy="15" r="5"/><path d="M9 10c0-2 1-3 3-4M15 8l4-4M17 11h4"/>', // 손 (귤 던지기)
    '<path d="M6 3c7 2 11 8 9 18M6 3l9 18M10 12l10-6M20 6l-3-.5M20 6l-.5 3"/><circle cx="19" cy="6" r="1.6"/>', // 귤 활
    '<path d="M3 9h13l2 2v3H9l-1 5H5l1-5H3zM18 11h3M12 14v2"/><circle cx="20" cy="9" r="1.5"/>', // 귤 총
    '<path d="M2 9h15l2 2v3H9l-1 5H5l1-5H2zM19 10h3M19 12h3M19 14h3M8 9V6h5v3"/>', // 귤 머신건
    '<path d="M3 10h9v4H3zM12 11h2v2h-2M14 12h8M5 14l-1 5h3l1-5M7 7c1-2 3-2 4 0"/>', // 귤즙 레이저
    '<circle cx="11" cy="14" r="7"/><path d="M14 7l2-3M16 4l3 1M18 2v2M9 12c0-1 1-2 2-2"/>'], // 귤 폭탄
}; late.TIER_ART = TIER_ART;
const STAT_ICON = {
  per: '<circle cx="6" cy="16" r="2.5"/><circle cx="12" cy="8" r="2.5"/><circle cx="18" cy="16" r="2.5"/>', // 한 번에 몇 개
  rate: '<path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/>', // 초당
  r: '<path d="M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3"/>', // 닿는 거리
  cap: '<path d="M7 8h10v12H7zM9.5 8V6a2.5 2.5 0 0 1 5 0v2"/>', // 배낭 칸
  speed: '<path d="M4 17l6-6 4 4 6-8M14 7h6v6"/>', // 빠르기
  dmg: '<path d="M12 3l2.5 6 6.5.5-5 4 1.5 6.5L12 16l-5.5 4L8 13.5l-5-4 6.5-.5z"/>', // 피해
}; late.STAT_ICON = STAT_ICON;
const tierStats = (k, t) => t.soon ? [] : k === 'weapon' ? [['dmg', String(t.dmg)], ['r', `${t.range}m`]] : k === 'tool' ? [t.rate ? ['rate', `${t.rate}/s`] : ['per', `×${t.per}`], ['r', `${t.r}m`]]
  : k === 'bag' ? [['cap', String(t.cap)]] : [['speed', `×${String(t.speed.toFixed(2)).replace(/0$/, '')}`]];
const nextGear = (k) => { const n = GEAR_ROWS[k].list[save.equip[k]]; return n && !n.soon ? n : null; };
export const canBuyGear = () => gearKeys().filter((k) => { const n = nextGear(k); return n && save.coins >= n.price; }); late.canBuyGear = canBuyGear;
let shopTab = 'tool', shopPick = null; export { shopTab }; // shopPick: 장비 탭에서 고른 단계(없으면 다음 단계)
export function openShop(tab) {
  if (cam.mode === 'wardrobe' || player.pose === 'sit') return; closePanels();
  if (LEAPB && (tab === 'wear' || tab === 'shoes')) tab = 'gear'; // 옷·신발 탭은 LEAP 으로 옮김 (#59)
  if (tab === 'gear' || !tab) { const ok = canBuyGear(); shopTab = ok[0] || (shopTab === 'wear' || !gearKeys().includes(shopTab) ? 'tool' : shopTab); } else shopTab = tab;
  if (GEAR_ROWS[shopTab] && !gearKeys().includes(shopTab)) shopTab = 'tool';
  shopPick = null; wearPick = null; state.shopHintUntil = 0; buildShop(); $('shop').hidden = false;
}
document.querySelectorAll('#shop-tabs [data-tab]').forEach((b) => b.addEventListener('click', () => { shopTab = b.dataset.tab; shopPick = null; wearPick = null; buildShop(); }));
export function checkGearBadges() { // 장비 최고 단계 뱃지 (#13)
  const m = ['tool', 'bag', 'shoes'].map((k) => save.equip[k] >= 5);
  if (m.some(Boolean) && !ach.state.badges['b-gear-one']) ach.emit('gear-max-one');
  if (m.every(Boolean) && !ach.state.badges['b-gear-all']) ach.emit('gear-max-all');
}
// 사는 연출: 귤이 위 귤 칸에서 빠져나가 산 물건 쪽으로 날아가 사라지고, 숫자가 줄어든다
function spendFx(toEl, price, from, pill = document.querySelector('#shop .shop-coins'), num = $('shop-coins')) {
  pill.classList.remove('drain'); void pill.offsetWidth; pill.classList.add('drain');
  const a = pill.querySelector('i').getBoundingClientRect(), b = toEl.getBoundingClientRect();
  const sx = a.left + a.width / 2, sy = a.top + a.height / 2, tx = b.left + b.width / 2, ty = b.top + b.height / 2;
  const n = Math.min(LOW ? 5 : 9, Math.max(3, Math.round(Math.log2(price + 1))));
  for (let i = 0; i < n; i++) setTimeout(() => {
    const d = document.createElement('div'); d.className = 'fx-spend'; d.style.left = sx + 'px'; d.style.top = sy + 'px'; document.body.append(d);
    requestAnimationFrame(() => requestAnimationFrame(() => { d.style.transform = `translate(${tx - sx + (Math.random() - 0.5) * 24}px, ${ty - sy + (Math.random() - 0.5) * 12}px) scale(.4)`; d.style.opacity = '0'; }));
    setTimeout(() => d.remove(), 600);
  }, i * 45);
  const to = save.coins, t0 = performance.now(), dur = 500;
  const step = (t) => { const k = Math.min(1, (t - t0) / dur); num.textContent = String(Math.round(from + (to - from) * k)); if (k < 1 && save.coins === to) requestAnimationFrame(step); else num.textContent = String(save.coins); };
  requestAnimationFrame(step);
}
export function buyGear(k) {
  const row = GEAR_ROWS[k], cur = save.equip[k], next = nextGear(k); if (!next) return;
  if (save.coins < next.price) { toast(`귤이 ${next.price - save.coins}개 모자라요`); return; }
  const from = save.coins;
  save.coins -= next.price; save.equip[k] = cur + 1;
  syncEquipGear(); runner.apply(save.outfit); persist(); updateStats(); updateTrashUI(true); net.send(true);
  if (k === 'weapon') { late.sound.coin?.(); ach.emit('weapon-buy'); ach.emit('weapon-buy-' + next.id); } // 무기 (#38)
  else { late.sound.coin?.(); ach.emit('gear-buy'); ach.emit('gear-buy-' + k); checkGearBadges(); }
  toast(`${next.name} · 바로 착용했어요`);
  shopPick = null; buildShop();
  const cell = document.querySelector(`#shop-body .tier[data-i="${cur}"]`);
  if (cell) { cell.classList.add('tier-pop'); spendFx(cell, next.price, from); }
}
function buildGearShop(body, k) {
  const row = GEAR_ROWS[k], cur = save.equip[k], pick = shopPick ?? (row.list[cur]?.soon ? cur - 1 : Math.min(cur, row.list.length - 1));
  const tiers = document.createElement('div'); tiers.className = 'tiers' + (row.list.length > 5 ? ' t6' : '');
  const CHECK = `${SVG_A} stroke-width="3"><path d="M5 12l5 5 9-10"/></svg>`, LOCK = `${SVG_A} stroke-width="2.5"><path d="M7 11h10v9H7zM9 11V8a3 3 0 0 1 6 0v3"/></svg>`;
  row.list.forEach((t, i) => {
    const own = i < cur, isNext = i === cur && !t.soon, lock = i > cur || !!t.soon;
    const c = document.createElement('button'); c.type = 'button'; c.dataset.i = i;
    c.className = 'tier' + (own ? ' own' : '') + (i === cur - 1 ? ' cur' : '') + (isNext ? ' next' : '') + (lock ? ' lock' : '') + (t.soon ? ' soon' : '');
    c.setAttribute('aria-pressed', String(i === pick)); c.setAttribute('aria-label', t.soon ? '준비 중' : `${t.name} ${i + 1}단계`);
    c.innerHTML = `<i class="st">${own ? CHECK : lock ? LOCK : `${SVG_A} stroke-width="3"><path d="M12 19V6M6 11l6-6 6 6"/></svg>`}</i>`
      + `${SVG_A.replace('<svg', '<svg class="art"')}>${TIER_ART[k][i]}</svg>`
      + (t.soon ? '' : `<span class="n">${tierStats(k, t)[0][1]}</span>`)
      + (own || t.soon ? '' : `<span class="pr"><i class="g"></i>${t.price.toLocaleString()}</span>`);
    c.addEventListener('click', () => { shopPick = i; buildShop(); });
    tiers.append(c);
  });
  const t = row.list[pick], now = cur ? row.list[cur - 1] : POCKET;
  if (t.soon) { // 아직 없는 무기: 잠긴 그림만
    const det = document.createElement('div'); det.className = 'tier-detail';
    const info = document.createElement('div'); info.innerHTML = `${SVG_A.replace('<svg', '<svg class="soon-art"')}>${TIER_ART[k][pick]}</svg>`;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tier-buy'; b.disabled = true; b.innerHTML = LOCK; b.setAttribute('aria-label', '준비 중');
    det.append(info, b); body.append(tiers, det); return;
  }
  const det = document.createElement('div'); det.className = 'tier-detail';
  const info = document.createElement('div');
  const stats = tierStats(k, t), was = pick === cur ? tierStats(k, now) : null;
  info.innerHTML = `<h3>${t.name}</h3><div class="tier-stats">${stats.map(([ic, v], j) => `<span>${SVG_A}>${STAT_ICON[ic]}</svg>${was && was[j] && was[j][1] !== v ? `<s>${was[j][1]}</s>→<em>${v}</em>` : v}</span>`).join('')}</div>`;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'tier-buy';
  if (pick < cur) { b.disabled = true; b.innerHTML = CHECK; b.setAttribute('aria-label', '가짐'); }
  else if (pick > cur) { b.disabled = true; b.innerHTML = `${LOCK}<span>${t.price.toLocaleString()}</span>`; b.setAttribute('aria-label', '앞 단계를 먼저 사요'); }
  else { b.innerHTML = `<i class="g"></i>${t.price.toLocaleString()}`; b.classList.toggle('short', save.coins < t.price); b.setAttribute('aria-label', `${t.name} 사기`); b.addEventListener('click', () => buyGear(k)); }
  det.append(info, b);
  body.append(tiers, det);
}
function buildShop() {
  const body = $('shop-body'); body.innerHTML = '';
  $('shop-coins').textContent = String(save.coins);
  document.querySelectorAll('#shop-tabs [data-tab]').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.tab === shopTab)); if (b.dataset.tab === 'shoes' || b.dataset.tab === 'wear') b.hidden = !!LEAPB; }); // 옷·신발은 LEAP (#59)
  if (GEAR_ROWS[shopTab]) { buildGearShop(body, shopTab); return; }
  buildWearRows(body, true);
}
// ---------- 옷 (#52): 칸마다 한 줄. 옷 그림·단계 색·입은 것 체크·없는 것은 값. 가진 옷은 눌러서 바로 갈아입음 ----------
let wearPick = null; // 상점에서 고른 안 가진 옷 (아래에 능력치 지금 → 바뀔 값과 사기)
export function wearCloth(slot, id) {
  if (id) CL.wear[slot] = id; else delete CL.wear[slot];
  syncEquipGear(); runner.apply(save.outfit); persist(); updateStats(); updateTrashUI(true); net.send(true);
}
export function buyCloth(id) {
  const c = CLOTH[id]; if (!c || CL.own[id]) return false; const price = wearPrice(c);
  if (save.coins < price) { toast(`귤이 ${price - save.coins}개 모자라요`); return false; }
  const from = save.coins; save.coins -= price; CL.own[id] = 1; late.sound.coin?.(); ach.emit('clothes-buy'); ach.emit('clothes-buy-' + c.slot); // 업적 이벤트 (#59)
  wearPick = null; wearCloth(c.slot, id);
  if (!$('shop').hidden) { buildShop(); const cell = document.querySelector(`#shop-body .wear-item[data-id="${id}"]`); if (cell) { cell.classList.add('tier-pop'); spendFx(cell, price, from); } }
  toast(`${c.name} · 바로 입었어요`);
  return true;
}
export function buildWearRows(body, shop) {
  const CHECK = `${SVG_A} stroke-width="3"><path d="M5 12l5 5 9-10"/></svg>`;
  WEAR.slots.forEach((w) => {
    const list = CLOTHES.filter((c) => c.slot === w.k && (shop || CL.own[c.id])).sort((a, b) => a.tier - b.tier);
    const row = document.createElement('div'); row.className = 'w-row wear-row';
    const cur = wearV(w.k), head = document.createElement('div'); head.className = 'wear-head';
    head.innerHTML = `<span class="wear-name">${w.name}</span><span class="wear-stat">${SVG_A}>${WEAR_STAT_ICON[w.stat]}</svg>${wearStatText(w.stat, cur)}</span>`;
    const grid = document.createElement('div'); grid.className = 'wear-grid';
    const cell = (c) => {
      const id = c?.id || '', has = !c || !!CL.own[id], on = c ? CL.wear[w.k] === id : !CL.wear[w.k], tier = c ? c.tier : 0, price = c ? wearPrice(c) : 0;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'wear-item' + (on ? ' on' : '') + (has ? ' has' : '') + (c ? '' : ' none'); b.dataset.id = id;
      b.style.setProperty('--tc', WEAR.tierColor[tier]); b.title = c ? `${c.name} · ${tier}단계` : '없음';
      b.setAttribute('aria-label', c ? `${c.name} ${tier}단계${has ? '' : ` 귤 ${price}`}` : `${w.name} 벗기`); b.setAttribute('aria-pressed', String(on));
      if (shop && !has) b.setAttribute('aria-expanded', String(wearPick === id));
      b.innerHTML = clothSvg(c) + (on ? `<i class="st">${CHECK}</i>` : '') + (has ? '' : `<span class="pr${save.coins < price ? ' short' : ''}"><i class="g"></i>${price.toLocaleString()}</span>`);
      b.addEventListener('click', () => { if (has) { wearPick = null; if (!on) wearCloth(w.k, id); if (shop) buildShop(); else late.buildWardrobe(); } else { wearPick = wearPick === id ? null : id; buildShop(); } });
      grid.append(b);
    };
    if (w.none) cell(null);
    list.forEach(cell);
    row.append(head, grid);
    const pc = shop && wearPick && CLOTH[wearPick]?.slot === w.k ? CLOTH[wearPick] : null;
    if (pc) { // 고른 옷: 능력치 지금 → 바뀔 값, 값
      const det = document.createElement('div'); det.className = 'tier-detail wear-detail';
      const nv = w.v[pc.tier], price = wearPrice(pc);
      det.innerHTML = `<div><h3><i class="tdot" style="background:${WEAR.tierColor[pc.tier]}"></i>${pc.name}</h3><div class="tier-stats"><span>${SVG_A}>${WEAR_STAT_ICON[w.stat]}</svg>${nv !== cur ? `<s>${wearStatText(w.stat, cur)}</s>→<em>${wearStatText(w.stat, nv)}</em>` : wearStatText(w.stat, nv)}</span></div></div>`;
      const bb = document.createElement('button'); bb.type = 'button'; bb.className = 'tier-buy' + (save.coins < price ? ' short' : ''); bb.innerHTML = `<i class="g"></i>${price.toLocaleString()}`; bb.setAttribute('aria-label', `${pc.name} 사기`);
      bb.addEventListener('click', () => buyCloth(pc.id)); det.append(bb); row.append(det);
    }
    body.append(row);
  });
}
