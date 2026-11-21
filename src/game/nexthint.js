// 다음 할 일 (#142, notes/growth-loop.md 7절): 퀘스트 추적 줄(game/quest.js #quest-track)에 얹는 안내. 파일 순서는 quest 뒤 (src/modules.js)
// (나) 잠깐 바뀌는 안내 (퀘스트보다 먼저, 주황 !): HP 가 낮으면 '스톤에서 식사' → 배낭이 차면 '클린하우스로' → 귤이 새로 다음 장비 값에 닿으면 '장비점으로'(그 전엔 권하지 않음)
// (가) 줄기 퀘스트가 끝난 사람(또는 받을 퀘스트가 없을 때)에게 이어 줄 것 (흰 ›): 강화 → 전설 우두머리 → 오늘의 업적 → 다시 쌓인 더미 → 소굴 → 돌탑. 할 일이 없다는 줄은 없다
// 안내 하나 = { k, text, prog, mark: 'tmp'|'next', pos() 갈 곳, arrive() 도착하면, tap() 누르면 (갈 곳 없이 창만), near }. 누르면 dump.js startAutoGo 로 걸어감 (quest.js trackGo)
// 수치는 balance.js NEXT_HINT. dev: __oreum.quest.next (why()·after()·reset())
import * as THREE from 'three';
import { NEXT_HINT as N, LOOT, ZONES } from '../balance.js';
import { height } from '../world.js';
import { state, late } from './state.js';
import { $, save } from './save.js';
import { player, trash, CHS, cairns, hp, shopsBuilt, GEARB, buff } from './place.js';
import { ach, openAch } from './hud.js';
import { bagRoom } from './pickup.js';
import { shopPopNow } from './stores.js';
import { canBuyGear } from './shop.js';

const v3 = (p) => (p ? new THREE.Vector3(p.x, height(p.x, p.z), p.z) : null);
const dist = (p) => Math.hypot(p.x - player.pos.x, p.z - player.pos.z);
function nearest(list) { let b = null, bd = 1e12; for (const o of list) { const d = dist(o); if (d < bd) { bd = d; b = o; } } return b; }
const shop = (id) => shopsBuilt.find((sh) => sh.id === id) || null;
const zname = (z) => ZONES.find((q) => q.id === z)?.name || `구역 ${z}`;
const openGear = (forge) => () => { if (forge && late.forgeApi) late.forgeApi.open(); else late.openShopPop?.('gear'); };

/* ---------- (나) 잠깐 바뀌는 안내 ---------- */
let hpUntil = 0, shopUntil = 0, shopSig = '', why = '', off = false;
const now = () => performance.now() / 1000;
function hpLow() {
  const st = shop('stone'); if (!st || !(hp.max > 0) || hp.isDown || hp.pending) { hpUntil = 0; return null; }
  const k = hp.hp / hp.max, t = now();
  if (hpUntil && (k >= N.hpOk || t > hpUntil || buff.now()?.item?.buff === 'regen')) hpUntil = 0;
  if (!hpUntil && k < N.hpLow && (state.tension || 0) <= N.calm) hpUntil = t + N.hpT;
  if (!hpUntil || (state.tension || 0) > N.calm) return null; // 싸우는 중엔 그대로 (적부터)
  return { k: 'hp', text: '스톤에서 식사하기', prog: '', mark: 'tmp', pos: () => st.door.clone(), near: Math.max(1.5, (st.r || 3) * 0.6), arrive: () => late.openShopPop?.('stone') };
}
function bagFull() {
  if (!trash || !CHS.length || bagRoom() >= N.bagRoom) return null;
  return { k: 'bag', text: '배낭이 찼어요 · 클린하우스로', prog: '', mark: 'tmp', pos: () => { const c = nearest(CHS.map((q) => q.front)); return c ? c.clone() : null; } }; // 곧은 거리로 가장 가까운 곳 (걸을 땐 길 찾기)
}
function gearAfford() {
  const can = trash ? canBuyGear() : [], sig = can.map((k) => k + (save.equip[k] | 0)).join(','), t = now();
  if (!can.length) { shopUntil = 0; shopSig = ''; return null; }
  if (sig !== shopSig) { if (!shopSig || !sig.split(',').every((x) => shopSig.split(',').includes(x))) shopUntil = t + N.shopT; shopSig = sig; } // 새로 닿은 장비가 있을 때만
  const door = GEARB?.door || null;
  if (shopUntil && (t > shopUntil || (!$('shoppop').hidden && shopPopNow === 'gear') || (door && dist(door) < N.shopR))) shopUntil = 0;
  if (!shopUntil) return null;
  return { k: 'shop', text: '귤이 모였어요 · 장비점으로', prog: '', mark: 'tmp', pos: () => (door ? door.clone() : null), near: GEARB ? Math.max(1.5, GEARB.r * 0.6) : 3, arrive: openGear(false) };
}

{ const base = late.shopOpened; late.shopOpened = (key, ...r) => { if (key === 'gear') shopUntil = 0; return base?.(key, ...r); }; } // 장비점 창을 열면 끝 (stores.js openShopPop 이 부름)

/* ---------- (가) 퀘스트가 끝난 사람에게 이어 줄 것 ---------- */
const AFTER = {
  forge() {
    const n = late.forgeApi?.ready?.().length || 0; if (!n || !GEARB) return null;
    return { text: '장비 강화하기', prog: n > 1 ? `${n}칸` : '', pos: () => GEARB.door.clone(), near: Math.max(1.5, GEARB.r * 0.6), arrive: openGear(true) };
  },
  legend() { // 전설은 LOOT.legendZ 구역부터 우두머리에게서: 끝낸 구역 중 지금 나올 수 있는 우두머리
    const B = late.boss; if (!B?.can) return null; const done = save.boss?.done || {};
    for (let z = 5; z >= LOOT.legendZ; z--) { if (!(done[z] > 0) || !B.can(z)) continue; const a = B.arena(z); if (a) return { text: `${zname(z)} 우두머리 · 전설을 노려요`, prog: '', pos: () => v3(a) }; }
    return null;
  },
  daily() {
    const d = ach.ensureDaily?.(); if (!d) return null;
    const claim = d.items.find((x) => x.done && !x.claimed); if (claim) return { text: `오늘의 업적 보상 받기 · ${ach.defD(claim.id)?.name || ''}`, prog: '', tap: openAch };
    const it = d.items.find((x) => !x.done); if (!it) return null; const def = ach.defD(it.id); if (!def) return null;
    return { text: `오늘의 업적 · ${def.name}`, prog: def.goal > 1 ? `${Math.min(it.prog, def.goal)}/${def.goal}` : '', tap: openAch };
  },
  heap() {
    if (!trash) return null; const hs = []; trash.heaps.forEach((h, i) => { if (trash.store.left(i) > 0) hs.push(h); });
    const h = nearest(hs); if (!h) return null;
    return { text: `다시 쌓인 더미 치우기 · ${zname(h.zone || trash.zoneAt(h.x, h.z) || 1)}`, prog: hs.length > 1 ? `${hs.length}곳` : '', pos: () => v3(h) };
  },
  den() {
    const F = late.field; if (!F?.dens) return null; const d = nearest(F.dens().filter((q) => q.open)); if (!d) return null;
    return { text: `소굴 닫기 · ${zname(d.zone)}`, prog: '', pos: () => v3(d) };
  },
  cairn() { // 마지막: 늘 있음 (돌탑이 없는 맵이면 정상 쪽으로)
    const c = nearest(cairns.map((q) => q.pos)); if (c) return { text: '돌탑에 돌 하나 얹기', prog: '', pos: () => v3(c) };
    return { text: '오름 한 바퀴 둘러보기', prog: '', tap: () => late.openMap?.() };
  },
};
function after() { for (const k of N.after) { const h = AFTER[k]?.(); if (h) return { k: 'after:' + k, mark: 'next', ...h }; } return null; }

/* ---------- 추적 줄에 얹기 (game/quest.js trackInfo 가 0.5초마다 부름) ---------- */
// base = 퀘스트 줄(없으면 null). ctx.open 감독 문 quest(정낭을 나섬)
late.nextHint = (base, ctx = {}) => {
  if (late.tut?.active || !save.tut?.done) { why = 'tut'; return null; }
  const tmp = off ? null : hpLow() || bagFull() || (base?.ready ? null : gearAfford()); // 보상 받으러 돌아가는 중엔 장비점을 끼우지 않음
  if (tmp) { why = tmp.k; return tmp; }
  if (base) { why = 'quest'; return null; }
  if (!ctx.open) { why = 'closed'; return null; } // 정낭을 나서기 전 (감독이 이끄는 동안)
  const a = after(); why = a ? a.k : 'none'; return a;
};

late.nextDebug = { why: () => why, off(v = true) { off = !!v; }, // off: 잠깐 바뀌는 안내 끄기 (tools/questrun.js 가 퀘스트 줄만 볼 때)
  after: () => after(), reset() { hpUntil = 0; shopUntil = 0; shopSig = ''; }, shopUntil: () => shopUntil, hpUntil: () => hpUntil };
