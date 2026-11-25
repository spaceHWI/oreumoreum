// 두 길 (#298) 확인: 구역 점수(줍기 + 싸움)·우두머리 부르기·달래는 길·길 안전·무기 열리는 레벨·균형 보너스. node tools/twopaths.js (먼저 node build.mjs)
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
(async () => {
  // 0) 둘 중 하나 목표 (src/quest.js ask.or): 그림 없이 node 에서
  { const { createQuests } = await import('../src/quest.js'); const save = {}, c = {};
    const defs = { main: [{ id: 'a', giver: 'g', ask: { k: 'trash', n: 10, or: { k: 'repel', n: 3 } } }, { id: 'b', giver: 'g', ask: { k: 'heap', n: 1, or: { k: 'repel', n: 5 } } }], side: [] };
    const Q = createQuests({ save, defs, hooks: { val: (k) => c[k] || 0, open: () => true } }); Q.accept('a');
    const st = () => { const it = Q.list().on[0]; return it ? { p: it.p, st: it.ready ? 'ready' : 'on' } : {}; }; c.trash = 4; const p1 = st().p; c.repel = 2; const p2 = st().p; c.repel = 3; const r1 = st().st;
    Q.complete('a'); Q.accept('b'); c.repel = 7; const p3 = st().p, r3 = st().st; c.repel = 8; const r4 = st().st;
    ok(p1 === 4 && p2 === 6 && r1 === 'ready', `둘 중 하나: 줍기 4/10 → 싸움 2/3 이면 6/10 → 싸움 3/3 이면 끝 (${p1} ${p2} ${r1})`);
    ok(p3 === 0 && r3 === 'on' && r4 === 'ready', `받은 뒤부터 셈 (받을 때 싸움 3 → 7 은 4/5, 8 이면 끝: ${r3} ${r4})`); }
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 600 } }); let errs = 0;
  p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
  const W = (ms) => p.waitForTimeout(ms), E = (f, a) => p.evaluate(f, a);
  const until = async (fn, ms, arg) => { const t = Date.now(); while (Date.now() - t < ms) { if (await E(fn, arg).catch(() => false)) return true; await W(100); } return false; };
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await until(() => !!window.__oreum?.ticks, 30000);
  await E(() => { const o = window.__oreum; Object.assign(o.save, { entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 4 }, jeong: 1, soundOff: 1 }); const k = ['oreumoreum.v1', 'oreumoreum.dev'].find((k) => localStorage.getItem(k)) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await until(() => !!window.__oreum?.ticks, 30000); await p.click('#enter').catch(() => {}); await W(2500);
  if (await E(() => !document.getElementById('look').hidden)) { await p.click('#look-ok').catch(() => {}); await W(800); }
  const T = await E(() => !!window.__oreum.twopaths); ok(T, 'window.__oreum.twopaths 있음'); if (!T) process.exit(1);
  // 1) 구역 점수
  const s1 = await E(() => { const o = window.__oreum, tp = o.twopaths; o.trash.fillZone(1); tp.fight(1, 0); const a = tp.parts(1); tp.fight(1, 15); const b = tp.parts(1); o.trash.clearZone(1); const c = tp.parts(1); o.trash.fillZone(1); tp.fight(1, 30); const d = tp.parts(1); tp.fight(1, 0); return { a, b, c, d }; });
  ok(s1.a.total < 0.01 && Math.abs(s1.b.fight - 0.5) < 0.01, `싸움 몫: 0 → 15점이면 50% (${s1.b.fight.toFixed(2)})`);
  ok(s1.c.clean > 0.99 && s1.c.total <= 1, `줍기만 100% (${s1.c.total.toFixed(2)})`);
  ok(s1.d.total > 0.99 && s1.d.clean < 0.01, `싸움만 100% (${s1.d.total.toFixed(2)})`);
  // 싸움 몫으로 우두머리가 나올 수 있음
  const bc = await E(() => { const o = window.__oreum; o.trash.fillZone(1); o.twopaths.fight(1, 0); const no = o.boss.can(1); o.twopaths.fight(1, 25); const yes = o.boss.can(1); o.twopaths.fight(1, 0); return { no, yes }; });
  ok(!bc.no && bc.yes, `싸움만 80% 면 우두머리가 나올 수 있음 (${JSON.stringify(bc)})`);
  // 적을 쫓아내면 몫이 늚
  const kill = await E(async () => { const o = window.__oreum, en = o.enemies; o.trash.fillZone(1); o.twopaths.fight(1, 0); const sp = o.boss.spots().find((s) => s.zone === 1); o.boss.go(1, 40); await new Promise((r) => setTimeout(r, 300)); const e = en.test.spawn('piglet', 5, 0); en.hurt(e, 999); await new Promise((r) => setTimeout(r, 200)); return { f: o.twopaths.fight(1), zone: o.trash.state().zone, sp: !!sp }; });
  ok(kill.f >= 1, `구역 1 에서 적 하나 쫓아내면 싸움 점수 +1 (${JSON.stringify(kill)})`);
  // 2) 달래는 길
  const calm = await E(async () => { const o = window.__oreum, wt = (ms) => new Promise((r) => setTimeout(r, ms)); o.enemies.test.clear(); o.boss.setDone(1, 0); o.trash.clearZone(1); o.boss.go(1, 60); await wt(400); const sp = o.boss.spawn(1) || !!o.boss.state(); /* 가까이 가면 스스로 나와 있을 수 있음 */ await wt(200); o.boss.go(1, 6); const t = Date.now(); while (Date.now() - t < 30000) { await wt(200); if (!o.boss.state()) break; } const a = o.boss.arena(1); return { sp, st: o.boss.state(), done: o.boss.done().done[1] || 0, clean: o.trash.state ? o.trash.api.zoneClean(1) : null, calmT: o.twopaths.calmT(), d: a && Math.hypot(o.player.pos.x - a.x, o.player.pos.z - a.z), r: a && a.r }; });
  ok(calm.sp && !calm.st && calm.done > 0, `100% 깨끗하면 빈터 곁에 머물러 우두머리를 달래 보냄 (${JSON.stringify(calm)})`);
  await E(() => { const o = window.__oreum; o.boss.setDone(1, 0); o.trash.fillZone(1); });
  // 3) 길 안전
  const path = await E(async () => { const o = window.__oreum, wt = (ms) => new Promise((r) => setTimeout(r, ms)), en = o.enemies; en.test.clear();
    const seg = o.pathClear.idx.segs.find((s) => s.walk && o.trash.api.zoneAt((s.ax + s.bx) / 2, (s.az + s.bz) / 2) === 1);
    const x = (seg.ax + seg.bx) / 2, z = (seg.az + seg.bz) / 2; o.player.pos.set(x, o.groundAt(x, z), z); for (let i = 0; i < 50 && !o.twopaths.safe(); i++) await wt(100);
    const safe = o.twopaths.safe(), wave = en.planWave(false);
    /* 보통 무리(wild)를 길 곁에 놓아 봄 */
    const P = { kind: 'piglet', n: 2, x: x + 12, z: z + 0, zone: 1, wild: true }; en.spawnPlan(P, true); const L = en.list.filter((e) => e.wild); L.forEach((e) => { e.state = 'charge'; e.st = 0; });
    await wt(1500); const st1 = L.map((e) => e.state);
    /* 길에서 먼저 때리면 그 적만 쫓음 */
    en.hurt(L[0], 0.01, true); await wt(300); const st2 = L[0].state;
    /* 길 밖으로 나가면 쫓음 */
    let off = null; for (let r = 14; r < 60 && !off; r += 3) for (let a = 0; a < 6.28 && !off; a += 0.5) { const xx = x + Math.sin(a) * r, zz = z + Math.cos(a) * r; if (!o.twopaths.onTrail(xx, zz) && o.trash.api.zoneAt(xx, zz) === 1) off = [xx, zz]; }
    o.player.pos.set(off[0], o.groundAt(off[0], off[1]), off[1]); for (let i = 0; i < 50 && o.twopaths.safe(); i++) await wt(100); const safe2 = o.twopaths.safe(); const L2 = en.list.filter((e) => e.wild && e !== L[0]); L2.forEach((e) => { e.pos.set(off[0] + 6, e.pos.y, off[1]); }); await wt(1500);
    return { safe, wave: !!wave, st1, st2, safe2, st3: L2.map((e) => e.state) }; });
  ok(path.safe && !path.wave, `길 위에선 보통 무리가 생기지 않음 (safe ${path.safe}, wave ${path.wave})`);
  ok(path.st1.every((s) => s === 'wander' || s === 'root'), `길 위 플레이어를 보통 적이 쫓지 않음 (${path.st1})`);
  ok(path.st2 === 'charge' || ['wind', 'dash', 'back', 'stagger'].includes(path.st2), `길에서 먼저 때린 적은 쫓음 (${path.st2})`);
  ok(!path.safe2 && path.st3.some((s) => s !== 'wander' && s !== 'root'), `길 밖에선 그대로 덤빔 (${path.st3}, safe ${path.safe2})`);
  await E(() => window.__oreum.enemies.test.clear());
  // 4) 무기 열리는 레벨
  const arm = await E(() => { const o = window.__oreum; o.save.coins = 1e6; o.save.lv = { xp: 0 }; const before = o.save.equip.weapon; o.street?.go?.(); window.__oreum.cleanhouse?.api; o.save.equip.weapon = Math.max(2, o.save.equip.weapon || 1); const late = o; return { before, w: o.save.equip.weapon }; });
  const gate = await E(() => { const o = window.__oreum; o.street.open('gear'); const btn = [...document.querySelectorAll('#shoppop-cards .buy-card[data-k="weapon"] .tier-buy')].map((b) => b.textContent.trim()); return btn; });
  ok(gate.some((t) => /Lv \d+부터/.test(t)), `장비점 무기 카드에 'Lv N부터' (${gate.join(' | ')})`);
  // 5) 균형 보너스
  const bal = await E(() => { const o = window.__oreum, a = o.twopaths.mul('pick'); const d = o.twopaths.setDay(60, 15); return { a, b: o.twopaths.mul('pick'), left: d.left }; });
  ok(bal.b > bal.a && bal.left > 0, `줍기·싸움 둘 다 하면 균형 보너스 (${JSON.stringify(bal)})`);
  ok(!errs, `페이지 오류 없음 (${errs})`);
  await b.close(); console.log(fails ? `실패 ${fails}` : '모두 통과'); process.exit(fails ? 1 : 0);
})();
