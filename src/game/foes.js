// 적 역할 섞기 (#296): 잽싼 놈·묵직한 놈·던지는 놈(썩은 귤·빅풋 돌)을 길가 무리에도, 정상엔 눈 던지는 설인
// - 길가 무리 (enemies.js spawnPlan → life.hooks.roleFor·roleLook): 한 마리마다 ENEMY_SPAWN.role[구역] 에서 역할 하나(아니면 보통). 값·조종·그림은 swarmpat.js 와 같음
//   튜토리얼 뒤 첫 싸움(save.pace.first 전)·우두머리/레이드가 부르는 무리(quiet·forceKind)는 섞지 않음. 던지는 놈은 한 화면에 SWARM.pat.throwMax 까지
// - 설인 (ENEMIES.yeti, 모양은 사건 5 의 caseModel('yeti')): 정상(구역 5)에서 멀리서 눈덩이를 SWARM.pat.snow 대로 셋씩. 맞으면 잠깐 느려짐(state.swarmSlow)
//   쓰러뜨리지 않음: 귤을 맞으면 고개를 갸웃하고 물러나고(shyT), 두 번째엔 눈보라 속으로 사라짐. 다가가도(near) 물러나 사라짐. 한 화면에 하나
//   사건 5 를 종결하면(late.cases.isClosed('c5')) 오해가 풀려 더는 나오지 않음 (종결 장면 한 줄: src/cases/c5.js face.lines). 사건이 열리기 전에도 나옴 (소문 '설인이 쓰레기를 버린다' 와 맞물림)
//   들판 떼 판·우두머리·이야기·사건 장면·엔딩 동안은 나오지 않음. 길(탐방로) 위 플레이어에겐 던지지 않음(#298 길 안전, 길가 무리는 e.wild 로 같음). 수치 balance.js FOES
// - 처음 던지는 놈을 만나면 한 줄 안내 (save.hints.ring)
// 확인 __oreum.foes (state·yeti·role·why), node tools/foes.js
import { ENEMIES, ENEMY_SPAWN, SWARM, FOES } from '../balance.js';
import { state, late } from './state.js';
import { save, persist } from './save.js';
import { trash, life, player, hp } from './place.js';
import { spots } from './scene.js';
import { toast } from './hud.js';
import { patOver, patLook, throwN, throwMax, lobSnow, THROWS, patState, patTest } from './swarmpat.js';

const E = life.enemies, P = SWARM.pat, F = FOES;
const rnd = (a, b) => a + Math.random() * (b - a);
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const turn = (e, h, k) => { e.heading += wrapA(h - e.heading) * k; };
const zoneOf = (x, z) => (trash ? trash.zoneAt(x, z) || 0 : 0);
const live = (e) => e.state !== 'flee' && e.state !== 'leave';

/* ---------- 길가 무리 역할 ---------- */
life.hooks.roleFor = (kind, zone, i) => {
  if (!save.pace?.first) return null; /* 튜토리얼 뒤 첫 적은 쉬움 그대로 */
  const L = ENEMY_SPAWN.role[zone]; if (!L) return null;
  let x = Math.random(), pat = null; for (const [p, w] of L) { x -= w; if (x < 0) { pat = p; break; } }
  if (!pat || (THROWS.has(pat) && throwN(E.list) >= throwMax())) return null;
  const B = ENEMIES[kind]; if (!B) return null;
  const k2 = pat === 'rock' ? 'bigfoot' : kind, over = { hp: B.hp, dmg: B.dmg, reward: { ...B.reward } };
  const k = patOver(pat, B, over);
  over.size = k ? B.size * k : ENEMIES[k2].size; if (k) over.rk = k; /* 모양 크기 배 (roleLook) */
  return { kind: k2, over, pat };
};
life.hooks.roleLook = (e, pat) => {
  patLook(e, pat);
  if (e.def.rk) { e.root.scale.setScalar(e.def.rk); e.h *= e.def.rk; }
};

/* ---------- 설인 ---------- */
const Y = { e: null, cd: F.yeti.first, chk: 0, why: '', hit: false, shyMsg: false };
const yetiBlock = () => {
  if (!state.sessionOn || document.hidden) return 'session';
  if (!save.tut?.done) return 'tut';
  if (late.cases?.isClosed?.('c5')) return 'closed';
  if (state.cine || state.cave || hp.isDown || hp.pending || player.cart || player.rescue) return 'busy';
  if (late.swarmOn?.() || late.story?.busy || late.cases?.still?.()) return 'event';
  if (E.list.some((e) => e.boss && live(e))) return 'boss';
  if (zoneOf(player.pos.x, player.pos.z) !== 5) return 'zone';
  return '';
};
function yetiSpot() {
  for (let k = 0; k < 24; k++) {
    const a = Math.random() * 6.283, r = rnd(F.yeti.at[0], F.yeti.at[1]), x = player.pos.x + Math.sin(a) * r, z = player.pos.z + Math.cos(a) * r;
    if (zoneOf(x, z) !== 5 || (spots.enemyOk && !spots.enemyOk(x, z)) || (life.hooks.enemyPass && !life.hooks.enemyPass(x, z, 1))) continue;
    return [x, z];
  }
  return null;
}
function spawnYeti() {
  const at = yetiSpot(); if (!at) return null;
  const e = E.spawnSwarm('yeti', at[0], at[1], { ctl: yetiCtl }, null, 1);
  e.state = 'shy'; e.st = 0; e.bar.g.visible = false; e.thrower = true; e.yLife = F.yeti.life; e.shyN = 0; e.nearT = 0; e.pat = 'snow';
  return e;
}
/* 설인 조종 (enemies.js 'shy' 상태에서 부름): 거리를 두고 눈덩이 셋, 가까우면·맞으면 물러남 */
function yetiCtl(e, dt, time, d, to) {
  const c = P.snow, d0 = e.def, face = Math.atan2(to.x, to.z);
  if (!e.ps) e.ps = { cd: rnd(1.2, 2.4), aim: 0, n: 0, gapT: 0, side: Math.random() < 0.5 ? 1 : -1 };
  const s = e.ps;
  if ((e.yLife -= dt) <= 0 || player.down) { gone(e); return 0; }
  if (e.shyT > 0) { e.shyT -= dt; s.aim = 0; s.n = 0; turn(e, face + Math.PI, Math.min(1, dt * 3)); return e.shyT > F.yeti.tilt ? 0 : d0.walk; } /* 갸웃(잠깐 멈춤) → 물러남 */
  if (s.n > 0) { turn(e, face, Math.min(1, dt * 8)); if ((s.gapT -= dt) <= 0) { lobSnow(e, c.n - s.n); s.n--; s.gapT = c.gap; } return 0; }
  if (s.aim > 0) { turn(e, face, Math.min(1, dt * 8)); if ((s.aim -= dt) <= 0) { s.n = c.n; s.gapT = 0; } return 0; }
  if (d < c.near) { e.nearT += dt; if (e.nearT > F.yeti.vanish) { gone(e); return 0; } turn(e, face + Math.PI, Math.min(1, dt * 4)); return d0.chase; } /* 다가오면 눈보라 속으로 */
  e.nearT = Math.max(0, e.nearT - dt);
  if ((s.cd -= dt) <= 0 && d < c.keep[1] + 6 && !player.down && !life.hooks.trailSafe?.()) { s.aim = c.aim; /* 길 위(탐방로)에 있으면 던지지 않음 (#298 길 안전) */ s.cd = rnd(c.every[0], c.every[1]); return 0; }
  if (d > c.keep[1]) { turn(e, face, Math.min(1, dt * 3)); return d0.walk; }
  if (d < c.keep[0]) { turn(e, face + Math.PI, Math.min(1, dt * 3)); return d0.walk; }
  turn(e, face + s.side * Math.PI / 2, Math.min(1, dt * 2)); return d0.walk * 0.5;
}
function gone(e) { if (e.state === 'leave') return; e.state = 'leave'; e.st = 0; e.vanish = F.yeti.fade; }
life.hooks.shyHit = (e) => { /* enemies.js hurt: 설인은 피해 없이 갸웃하고 물러남, 두 번째엔 사라짐 */
  e.shyN = (e.shyN || 0) + 1; e.shyT = F.yeti.shyT;
  if (!Y.shyMsg) { Y.shyMsg = true; toast(F.text.shy, 2.4); }
  if (e.shyN >= F.yeti.hits) gone(e);
};
late.snowHit = () => { if (!Y.hit) { Y.hit = true; toast(F.text.snow, 2); } };

/* ---------- 매 프레임 ---------- */
late.tickFoes = (dt) => {
  const e = Y.e;
  if (e) {
    if (!E.list.includes(e)) Y.e = null;
    else if (e.state === 'leave') { e.vanish = (e.vanish ?? F.yeti.fade) - dt; e.root.scale.setScalar(Math.max(0.01, e.vanish / F.yeti.fade)); if (e.vanish <= 0) { E.remove(e); Y.e = null; Y.cd = rnd(F.yeti.again[0], F.yeti.again[1]); } }
    else { const w = yetiBlock(); if ((w && w !== 'zone') || (w === 'zone' && Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z) > F.yeti.away)) gone(e); } /* 일이 생기거나 정상을 멀리 떠나면 사라짐 */
  } else if ((Y.chk -= dt) <= 0) {
    Y.chk = 1; Y.why = yetiBlock();
    if (!Y.why && (Y.cd -= 1) <= 0 && throwN(E.list) < throwMax()) { Y.e = spawnYeti(); if (!Y.e) Y.cd = 3; }
  }
  if (!save.hints?.ring && patState().balls > 0) { save.hints = save.hints && typeof save.hints === 'object' ? save.hints : {}; save.hints.ring = 1; persist(); toast(F.text.ring, 3); } /* 처음 던지는 놈 */
};

late.foesApi = {
  state: () => ({ yeti: Y.e && { state: Y.e.state, x: +Y.e.pos.x.toFixed(1), z: +Y.e.pos.z.toFixed(1), shyN: Y.e.shyN, life: +Y.e.yLife.toFixed(1) }, cd: +Y.cd.toFixed(1), why: Y.why || yetiBlock(), throwers: throwN(E.list), max: throwMax(), slow: +(state.swarmSlow || 0).toFixed(2), pats: E.list.filter(live).map((x) => x.pat || 'base') }),
  yeti: () => { if (Y.e) return Y.e; Y.e = spawnYeti(); return Y.e; },
  cd: (v) => { Y.cd = v; Y.chk = 0; },
  role: (kind, zone) => life.hooks.roleFor(kind, zone, 0),
  why: () => yetiBlock(),
  pat: patTest,
};
