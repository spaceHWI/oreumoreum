// 적 무리 (#146): 적끼리 겹치지 않기 · 무리 지어 에워싸기. enemies.js 가 부름, 수치는 balance.js ENEMY_PACK
// - 무리 묶음: 같이 나온 적은 e.pack 이 같음 (spawnPlan 한 번 = 무리 하나, #139 '무리 부르기' 도 이 id 를 씀)
// - assign(): ENEMY_PACK.every 초마다 무리마다 플레이어 둘레 자리(e.slotA, 플레이어에서 본 방향 rad)를 나누고,
//   가까이 붙을 적(e.close, 무리마다 ENEMY_PACK.close 마리)과 무리 가운데(e.gx, e.gz)를 정함. 도망·떠난 적은 빠지고 남은 적끼리 다시 나눔
// - separate(dt): 모든 쌍을 보고 몸 원(BOAR.bodyR × 크기)이 겹치면 부드럽게 밀어냄. 무거운(큰) 쪽이 덜 밀림.
//   땅 헤집는(root)·우두머리·멀티 받는 쪽 적은 밀리지 않음(다른 적이 비켜 감). 도망·떠남은 빼고 봄.
//   밀린 자리가 오름 밖·사물(hooks.enemyPass)이면 그 축만 막고, 계속 막히면 e.jam → enemies.js 가 옆으로 돌아감(e.detour)
//   앞에 다른 적이 붙어 있으면 e.yieldT 동안 걸음을 늦춰 뒤에서 기다림 (좁은 길목에서 서로 밀며 떨지 않게)
// 멀티: 보통 적은 저마다 자기 화면에서 굴리고(방에 보내지 않음), 우두머리는 방장이 굴림(받는 쪽은 e.puppet → 밀지 않음). 보내는 양은 그대로
import { height } from './world.js';
import { BOAR, ENEMY_PACK as P } from './balance.js';

const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const TAU = Math.PI * 2;
export const bodyR = (e) => BOAR.bodyR * e.def.size;
const out = (e) => e.state === 'flee' || e.state === 'leave';
const fixed = (e) => e.state === 'root' || e.state === 'boss' || e.boss || e.puppet;

export function createPack({ list, spots, hooks }) {
  let t = 0;
  const packs = new Map(); // 다시 씀 (pack id → [적])
  const pool = [];
  // 자리 나누기
  function assign(dt, player, aggro) {
    if ((t -= dt) > 0) return; t = P.every;
    for (const a of packs.values()) { a.length = 0; pool.push(a); }
    packs.clear();
    for (const e of list) {
      e.close = false;
      if (out(e) || e.boss || e.pack == null || !aggro.has(e.state)) { e.slotA = null; continue; }
      let a = packs.get(e.pack); if (!a) { a = pool.pop() || []; packs.set(e.pack, a); }
      e._b = Math.atan2(e.pos.x - player.pos.x, e.pos.z - player.pos.z); e._d = Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z);
      a.push(e);
    }
    for (const a of packs.values()) {
      let sx = 0, sz = 0, gx = 0, gz = 0;
      for (const e of a) { sx += Math.sin(e._b); sz += Math.cos(e._b); gx += e.pos.x; gz += e.pos.z; }
      const n = a.length, c = Math.atan2(sx, sz); gx /= n; gz /= n;
      for (const e of a) { e._r = wrapA(e._b - c); e.gx = gx; e.gz = gz; }
      a.sort((p, q) => p._r - q._r); // 지금 있는 방향 순서대로 자리를 줘 서로 엇갈려 지나가지 않게
      const step = n > 1 ? Math.min(P.spread, P.arc / (n - 1), TAU / n) : 0;
      a.forEach((e, k) => { e.slotA = c + (k - (n - 1) / 2) * step; });
      // 가까이 붙는 적: 지금 덤비는 적부터, 그다음 가까운 순 (쉬는 적·멀리서 쏘는 적은 빼고)
      a.sort((p, q) => p._d - q._d);
      let m = 0;
      for (const e of a) if (!e.def.ranged && (e.state === 'wind' || e.state === 'dash' || e.state === 'back')) { e.close = true; m++; }
      for (const e of a) if (m < P.close && !e.close && !e.def.ranged && !(e.rest > 0)) { e.close = true; m++; }
    }
  }

  // 밀어내기
  const pass = (e, x, z) => spots.inBounds(x, z) && hooks.enemyPass?.(x, z, bodyR(e) * 0.8) !== false;
  function separate(dt) {
    const n = list.length, k = Math.min(1, dt * P.push);
    for (let i = 0; i < n; i++) { const e = list[i]; e._sx = 0; e._sz = 0; }
    for (let i = 0; i < n; i++) {
      const a = list[i]; if (out(a)) continue;
      const ra = bodyR(a), fa = fixed(a);
      for (let j = i + 1; j < n; j++) {
        const b = list[j]; if (out(b)) continue;
        const fb = fixed(b); if (fa && fb) continue;
        let dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const rr = ra + bodyR(b), m = rr + P.pad, d2 = dx * dx + dz * dz;
        if (d2 >= (m + P.look) * (m + P.look)) continue;
        let d = Math.sqrt(d2);
        if (d < 1e-4) { const g = (i * 2.399 + j) % TAU; dx = Math.sin(g); dz = Math.cos(g); d = 1; } else { dx /= d; dz /= d; }
        // 앞에 붙은 적이 있으면 걸음을 늦춤 (줄지어 기다림)
        // 같은 쪽으로 가는 앞 적이 있을 때만 (마주 오거나 엇갈리면 밀어내기만): 뒤에 있는 쪽 하나만 기다림
        if (Math.cos(a.heading - b.heading) > 0.3) {
          if (Math.sin(a.heading) * dx + Math.cos(a.heading) * dz > 0.55 && a.speed > 0.5) a.yieldT = P.yieldT;
          else if (Math.sin(b.heading) * -dx + Math.cos(b.heading) * -dz > 0.55 && b.speed > 0.5) b.yieldT = P.yieldT;
        }
        if (d >= m) continue;
        const ma = a.def.size * a.def.size, mb = b.def.size * b.def.size;
        const wa = fa ? 0 : fb ? 1 : mb / (ma + mb), wb = 1 - wa;
        const ov = (m - d) * k + Math.max(0, rr - d); // 여유 안쪽은 천천히, 몸 원끼리 겹친 만큼은 바로 풂
        a._sx -= dx * ov * wa; a._sz -= dz * ov * wa; b._sx += dx * ov * wb; b._sz += dz * ov * wb;
      }
    }
    for (let i = 0; i < n; i++) {
      const e = list[i], sx = e._sx, sz = e._sz;
      if (e.yieldT > 0) e.yieldT -= dt;
      if (!sx && !sz) { if (e.jam > 0) e.jam = Math.max(0, e.jam - dt); continue; }
      const x = e.pos.x, z = e.pos.z, here = pass(e, x, z); // 이미 사물 안이면(쫓다가 들어감) 막지 않음
      let nx = x + sx, nz = z + sz, ok = !here || pass(e, nx, nz);
      if (!ok) { if (pass(e, x + sx, z)) { nz = z; ok = true; } else if (pass(e, x, z + sz)) { nx = x; ok = true; } }
      if (ok) e.pos.set(nx, height(nx, nz), nz);
      if (!ok || Math.abs(nx - x - sx) + Math.abs(nz - z - sz) > 1e-6) e.jam = (e.jam || 0) + dt; else if (e.jam > 0) e.jam = Math.max(0, e.jam - dt);
      if (e.jam > P.jamT && !(e.detour > 0)) { e.detour = P.detourT; e.detourS = (e.slotA != null && e._r < 0) || (e.slotA == null && e.phase % 2 < 1) ? -1 : 1; e.jam = 0; }
    }
  }
  return { assign, separate, reset: () => { t = 0; } };
}

// 쫓을 때 가 닿을 곳 (enemies.js charge·ranged): 플레이어 둘레 a 방향(자기 자리), 거리 R 쪽으로 돌아 다가감. 반환 [방향, 남은 거리] (다시 씀)
const res = [0, 0];
export function slotGoal(e, player, R, a) {
  const px = player.pos.x, pz = player.pos.z, d = Math.hypot(e.pos.x - px, e.pos.z - pz);
  const r = Math.max(R, d - P.lead), b = Math.atan2(e.pos.x - px, e.pos.z - pz);
  a = b + Math.max(-P.arcStep, Math.min(P.arcStep, wrapA(a - b))); // 자리가 멀면 둘레를 따라 조금씩 돌아감 (플레이어 앞을 가로지르지 않게)
  let gx = px + Math.sin(a) * r, gz = pz + Math.cos(a) * r;
  if (e.gx != null && d > R + P.lead * 2) { const cx = e.gx - e.pos.x, cz = e.gz - e.pos.z, cd = Math.hypot(cx, cz); if (cd > P.gatherD) { const w = P.gather * (1 - P.gatherD / cd); gx += cx * w; gz += cz * w; } } // 다가오는 동안 무리에서 너무 떨어지면 가운데로 살짝 (자리에 닿으면 자리대로)
  const dx = gx - e.pos.x, dz = gz - e.pos.z;
  res[0] = Math.atan2(dx, dz); res[1] = Math.hypot(dx, dz);
  return res;
}
