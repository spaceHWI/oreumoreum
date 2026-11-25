// 두 길 (#298): 줍기만 해도, 싸움만 해도 깰 수 있고, 둘 다 하면 더 좋게 · 길은 평소 안전하게. 수치는 balance.js TWO_PATHS
// - 구역 점수 = 깨끗함(오름 전체, trash.zoneClean) + 싸움 몫(사람마다 save.zfight[구역] ÷ fight.need). 우두머리는 구역 점수가 ZONE_BOSS.appear 이면 나옴 (boss.js canSpawn)
//   싸움 몫: 그 구역에서 쫓아낸 적 하나마다 fight.pts (들판 떼는 적게, 떼 대장·정예는 많이). 우두머리를 끝내면 그 구역 몫은 0 으로
// - 달래는 길: 구역 깨끗함이 calm.clean(100%) 이면 우두머리는 덤비지 않고(boss.js late.bossCalmy), 빈터 calmR 안에 calmT 초 머물면 스스로 떠남(late.bossCalm, 쫓아낸 것과 같은 끝·보상). 때리면 보통 싸움
// - 길 안전: 탐방로(길 반폭 + path.side) 위에 있으면 보통 들판 적(enemies.js e.wild: 감독이 부른 무리)이 생기지 않고 쫓지 않음(돌아감·으르렁). 먼저 때린 적은 path.provokeT 초 동안 쫓음
//   이벤트(이야기 적·우두머리·부하·레이드·사건·소굴·들판 떼·서바이벌 터)는 wild 가 아니라 그대로
// - 균형: 그날(한국 시간) 줍기 balance.pick 개 + 쫓아내기 balance.fight 마리를 둘 다 하면 balance.sec 초(놀이 시간) 동안 줍는 힘·싸우는 힘 +bonus (inn.js late.innMul 을 감쌈)
// 저장: save.zfight = {구역: 점수}, save.tp = { day, pick, fight, left(균형 남은 초), got(받은 날) }. 확인 window.__oreum.twopaths (파일 순서: inn 뒤)
import { TWO_PATHS as TP, ZONES, ZONE_BOSS } from '../balance.js';
import { kstDay } from '../rankday.js';
import { state, late } from './state.js';
import { save, persist } from './save.js';
import { NSW } from './scene.js';
import { trash, player, life } from './place.js';
import { toast, ach } from './hud.js';

const ON = !!trash;
const ZID = new Set(ZONES.map((z) => z.id));
if (!save.zfight || typeof save.zfight !== 'object') save.zfight = {};
if (!save.tp || typeof save.tp !== 'object') save.tp = { day: 0, pick: 0, fight: 0, left: 0, got: 0 };
const T = save.tp;
const today = () => { const d = kstDay(); if (T.day !== d) { T.day = d; T.pick = 0; T.fight = 0; } return d; };

/* ---------- 구역 점수 ---------- */
const need = (z) => TP.fight.need[z] || 1e9;
export const fightShare = (z) => Math.min(1, (save.zfight[z] || 0) / need(z));
// 그 구역 점수의 두 몫: 깨끗함 clean + 싸움 fight (합은 1 을 넘지 않게 싸움 몫을 자름)
export function zoneParts(z) { const c = ON ? trash.zoneClean(z) : 0, f = Math.max(0, Math.min(1 - c, fightShare(z))); return { clean: c, fight: f, total: c + f }; }
if (ON) { late.zoneScore = (z) => zoneParts(z).total; late.zoneParts = zoneParts; }
const ptsOf = (def, e) => { const P = TP.fight.pts; if (e?.story) return 0; if (def?.swarm === 'leader') return P.leader; if (def?.elite) return P.elite; if (def?.swarm) return P.swarm; return P.mob; };

/* ---------- 적·우두머리 후크 ---------- */
if (ON) {
  const prevRepel = life.hooks.enemyRepel;
  life.hooks.enemyRepel = (kind, pos, def, e) => {
    prevRepel?.(kind, pos, def, e);
    const z = trash.zoneAt(pos.x, pos.z), p = ptsOf(def, e);
    if (p > 0 && ZID.has(z)) save.zfight[z] = Math.min(need(z), (save.zfight[z] || 0) + p);
    today(); T.fight++; checkBalance(); persist();
  };
  const prevBoss = life.hooks.bossRepel;
  life.hooks.bossRepel = (e) => {
    const z = late.bossNow?.()?.z; prevBoss?.(e); if (z == null) return;
    /* 업적 둘 (#298): 달래서 끝냄 = 줍기만으로 · 싸움 몫만으로 우두머리를 부름 = 싸움만으로 */
    if (calming) ach.emit('zone-pick-only'); else if (fightShare(z) >= ZONE_BOSS.appear - 1e-9) ach.emit('zone-fight-only');
    calming = false; if (save.zfight[z]) { save.zfight[z] = 0; persist(); } // 우두머리를 끝내면 싸움 몫은 다시 처음부터
  };
  trash.on((ev) => { if (ev !== 'trash' || late.tut?.active) return; today(); T.pick++; if (T.pick === TP.balance.pick) { checkBalance(); persist(); } });
}

/* ---------- 균형 보너스 ---------- */
function checkBalance() {
  const d = today(), B = TP.balance; if (T.got === d || T.pick < B.pick || T.fight < B.fight) return;
  T.got = d; T.left = B.sec; persist();
  toast(`줍기도 싸움도 했어요 · 균형 보너스 ${Math.round(B.sec / 60)}분 동안 줍는 힘·싸우는 힘 +${Math.round(B.bonus * 100)}%`, 4);
  late.sound?.coin?.();
}
const prevMul = late.innMul;
late.innMul = (k) => (prevMul ? prevMul(k) : 1) * (T.left > 0 && (k === 'pick' || k === 'dmg') ? 1 + TP.balance.bonus : 1);

/* ---------- 길 안전 ---------- */
let safeT = 0, safeNow = false, growlT = 0, growlN = 0;
const onTrail = (x, z) => { const n = NSW?.pathIdx?.nearest(x, z); return !!n && n.gap < TP.path.side; };
function calcSafe() { return !!NSW && state.sessionOn && !player.cart && onTrail(player.pos.x, player.pos.z); }
if (NSW) {
  life.hooks.trailSafe = () => safeNow;
  life.hooks.trailGrowl = () => {
    if (growlT > 0) return; growlT = TP.path.growlT; late.sound?.boar?.();
    if (growlN++ < 2) toast('길 위에서는 들판 적이 쫓아오지 않아요', 2.4);
  };
}

/* ---------- 달래는 길 ---------- */
let calmT = 0, calming = false;
late.bossCalmy = (c) => ON && !c.puppet && trash.zoneClean(c.z) >= TP.calm.clean - 1e-9 && c.e.hp >= c.max - 1e-6;
function tickCalm(dt) {
  const c = late.bossNow?.(); if (!c || c.fight || !late.bossCalmy(c)) { calmT = 0; return; }
  const a = late.boss?.arena?.(c.z); if (!a) return;
  if (Math.hypot(player.pos.x - a.x, player.pos.z - a.z) > a.r + TP.calm.calmR) { calmT = 0; return; }
  if (calmT === 0) toast('깨끗해진 구역을 둘러보는 중… 잠깐 곁에 있어 줘요', 2.6);
  calmT += dt;
  if (calmT >= TP.calm.calmT) { calmT = 0; calming = true; const ok = late.bossCalm?.(); calming = false; if (ok) toast('우두머리가 깨끗해진 구역을 보고 조용히 떠났어요', 3.2); }
}

late.tickTwoPaths = (dt) => {
  if ((safeT -= dt) <= 0) { safeT = 0.2; safeNow = calcSafe(); }
  if (growlT > 0) growlT -= dt;
  if (T.left > 0 && state.sessionOn) { T.left -= dt; if (T.left <= 0) { T.left = 0; toast('균형 보너스가 끝났어요'); persist(); } }
  if (ON) tickCalm(dt);
};

/* ---------- 확인용 (window.__oreum.twopaths) ---------- */
late.twopaths = {
  parts: (z) => zoneParts(z), score: (z) => zoneParts(z).total,
  fight: (z, v) => { if (v != null) { save.zfight[z] = v; persist(); } return save.zfight[z] || 0; },
  day: () => ({ ...T }), safe: () => safeNow, onTrail: (x = player.pos.x, z = player.pos.z) => onTrail(x, z), calmT: () => calmT,
  setDay: (pick, fight) => { today(); T.pick = pick; T.fight = fight; checkBalance(); return { ...T }; }, mul: (k) => late.innMul(k),
};
