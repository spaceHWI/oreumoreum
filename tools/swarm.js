// 들판 떼 자동 판 (#173): node tools/swarm.js [zone...] [--sec 300] [--speed 3] [--still]
// dist/test.html 남송이 전투 오름에서 구역마다 권장 장비(칸 10개가 구역 번호 단계)로 들판에 서서 __oreum.swarm.start(구역) → 자동 던지기만으로 버팀
// 움직임: 0.4초마다 적이 적고 귤 조각이 있는 쪽(길에서 14m 넘게·같은 구역·지나갈 수 있는 곳)으로 달림 (조이스틱 흉내, W 누른 채 방향만 바꿈). --still: 서 있음
// 증강은 뜨면 첫 카드. 기록: 버틴 시간(게임 초)·쫓아낸 수·최고 물결·잃은 기운(최대의 %)·번 귤·조각·증강 수·대장. 목표: 권장 장비로 3분은 무난히, 5분 대장은 아슬아슬
const { chromium } = require('playwright');
const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : +args[i + 1]; };
const ZONES = args.filter((a) => /^\d$/.test(a)).map(Number); if (!ZONES.length) ZONES.push(1, 2, 3, 4, 5);
const SEC = arg('--sec', 300), SPEED = arg('--speed', 3), STILL = args.includes('--still'), CAP = arg('--cap', 24); // --cap: 동시 마릿수 (기본 PC 24, 헤드리스는 저사양이라 바꿔 둠)
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 400 } });
  const errs = []; p.on('pageerror', (e) => { errs.push(e.message); console.log('ERR', e.message.slice(0, 300)); });
  const url = 'file://' + process.cwd() + '/dist/test.html#namsongi';
  await p.goto(url); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1, recycle: { visits: 3 }, swarm: { auto: 1, seen: 1, best: {} } }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.click('#enter', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1500);
  await p.evaluate(() => { const o = window.__oreum; o.pace.pacing.test.first.done = true; o.pace.pacing.test.first.bloomed = true; o.setTod(13); o.setWeather('clear'); o.director.open('field'); });
  const wearIds = require('fs').readFileSync('src/balance.js', 'utf8').match(/id: '(top|jacket|socks|hat|bottom|vest):[^']+', slot: '\w+', tier: \d/g).map((s) => { const m = s.match(/id: '([^']+)', slot: '(\w+)', tier: (\d)/); return { id: m[1], slot: m[2], tier: +m[3] }; });
  const res = [];
  for (const zn of ZONES) {
    const wear = wearIds.filter((w) => w.tier === zn);
    const ok = await p.evaluate(({ zn, wear, SPEED, CAP }) => {
      const o = window.__oreum; o.enemies.test.clear(); document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; });
      o.pace.pacing.test.soon(1e6);
      Object.assign(o.save.equip, { tool: zn, bag: zn, shoes: zn }); o.save.equip.weapon = Math.max(1, zn); o.weapon.use(zn); o.save.coins = 3000; o.save.bowAmmo = 0; o.save.ammo = { gun: 0, mg: 0, laser: 0 };
      for (const w of wear) { o.clothes.give(w.id); o.clothes.wear(w.slot, w.id); }
      o.player.knock = null; o.hp.set(o.hp.max);
      const at = o.swarm.start(zn); if (!at) return false;
      o.swarm.speed(SPEED); o.swarm.setCap(CAP);
      const C = (window.__c = { lost: 0, down: 0, last: o.hp.hp, t0: o.weapon.t(), coins0: o.save.coins, max: o.hp.max, peak: 0, augs: 0, leader: 0 });
      const loop = () => { const v = o.hp.hp; if (v < C.last - 1e-6) C.lost += C.last - v; C.last = v; if (o.hp.isDown || o.hp.pending) C.down = 1; const s = o.swarm.state(); if (s) { C.s = s; C.peak = Math.max(C.peak, s.n); if (s.leader) C.leader = 1; } if (o.swarm.picking()) { o.swarm.pick(0); C.augs++; } requestAnimationFrame(loop); };
      requestAnimationFrame(loop); return true;
    }, { zn, wear, SPEED, CAP });
    if (!ok) { console.log('구역', zn, '들판 자리를 못 찾음'); continue; }
    if (!STILL) await p.keyboard.down('w');
    let t = 0;
    for (let i = 0; i < 20000; i++) {
      const r = await p.evaluate(({ STILL }) => {
        const o = window.__oreum, P = o.player, tr = o.trash.api.trail, za = o.trash.api.zoneAt, z0 = o.swarm.state()?.zone;
        if (!STILL && z0) { // 적이 적은 쪽으로
          let best = P.heading, bs = -1e9;
          for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283, x = P.pos.x + Math.sin(a) * 4, z = P.pos.z + Math.cos(a) * 4;
            if (za(x, z) !== z0 || tr.dist(x, z, 30) < 15 || (o.life.hooks.enemyPass && !o.life.hooks.enemyPass(x, z, 0.6)) || (o.spots.clamp && o.spots.clamp(x, z))) continue;
            let sc = 0; for (const e of o.enemies.list) { if (e.state === 'flee' || e.state === 'leave') continue; const d = Math.hypot(e.pos.x - x, e.pos.z - z); sc -= 30 / Math.max(1.5, d); }
            sc -= Math.abs(Math.atan2(Math.sin(a - P.heading), Math.cos(a - P.heading))) * 0.4; sc += Math.min(30, tr.dist(x, z, 30)) * 0.15; for (const [qx, qz] of o.swarm.shardsAt()) sc += 4 / Math.max(2, Math.hypot(qx - x, qz - z)); if (sc > bs) { bs = sc; best = a; } }
          P.heading = best;
        }
        return { t: o.weapon.t() - window.__c.t0, on: !!o.swarm.state(), down: window.__c.down };
      }, { STILL });
      t = r.t; if (t >= SEC || !r.on || r.down) break;
      await p.waitForTimeout(120);
    }
    if (!STILL) await p.keyboard.up('w');
    const c = await p.evaluate(() => { const o = window.__oreum, C = window.__c; o.swarm.speed(1); return { ...C, coins: o.save.coins - C.coins0 }; });
    const s = c.s || {};
    const why = await p.evaluate(() => window.__oreum.swarm.last?.why || (window.__oreum.swarm.state() ? '시간' : '-'));
    const row = { 구역: zn, 끝: why, '버틴(초)': Math.round(t), 쓰러짐: c.down, 쫓아냄: s.kills, 물결: s.stage, '최대 마릿수': c.peak, '잃은 기운%': Math.round(100 * c.lost / c.max), '번 귤(판)': s.gyul, '귤 차이': Math.round(c.coins), 조각: s.shards, 증강: Object.entries(s.aug || {}).map(([k, v]) => k + v).join(' ') || '-', 대장: c.leader };
    console.log(JSON.stringify(row)); res.push(row);
    await p.evaluate(() => { const o = window.__oreum; o.swarm.stop(); o.enemies.test.clear(); });
    await p.waitForFunction(() => { const h = window.__oreum.hp; return !h.isDown && !h.pending && h.hp > 0; }, null, { timeout: 120000, polling: 500 }).catch(() => {});
    await p.waitForTimeout(500);
  }
  console.table(res);
  console.log(errs.length ? `페이지 오류 ${errs.length}` : '페이지 오류 없음');
  await b.close();
})();
