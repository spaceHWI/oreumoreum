// 들판 떼 자동 판 (#173): node tools/swarm.js [zone...] [--sec 300] [--speed 3] [--still]
// dist/test.html 남송이 전투 오름에서 구역마다 권장 장비(칸 10개가 구역 번호 단계)로 들판에 서서 __oreum.swarm.start(구역) → 직접 던지며 버팀 (#194 자동 던지기 없음)
// 던지기: 구역 1~3(손·활·총)은 게임 시간 --tap 초마다 한 번 누름(기본 1초), 4·5(머신건·레이저)는 F 를 누른 채. --lv N: 레벨 N 에서 시작(경험치를 그 레벨 처음으로)
// 터 밖으로 밀리면 가운데 쪽으로 달리며 뛰어넘음. --fast: 그리지 않음(셈만, 빠름). --runs N: 구역마다 N 판 (버틴 비율), --down N: 장비를 구역보다 N 단계 낮게 (#254). 기본 상한 --cap 36 (PC)
// --t0 N: 물결 시간 N 초에서 시작 (예: 170 이면 3분 단계부터, 130초 뒤 떼 대장)
// 움직임: 0.4초마다 적이 적고 귤 조각이 있는 쪽(서바이벌 터 안 #231·지나갈 수 있는 곳)으로 달림 (조이스틱 흉내, W 누른 채 방향만 바꿈). --still: 서 있음
// 증강은 레벨업 창이 뜨면 첫 카드. 기록: 버틴 시간(게임 초)·쫓아낸 수·최고 물결·잃은 기운(최대의 %)·번 귤·조각·레벨업 횟수·대장. 목표: 권장 장비로 3분은 무난히, 5분 대장은 아슬아슬
const { chromium } = require('playwright');
const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : +args[i + 1]; };
const ZONES = args.filter((a, i) => /^\d$/.test(a) && !/^--/.test(args[i - 1] || '')).map(Number); if (!ZONES.length) ZONES.push(1, 2, 3, 4, 5);
const SEC = arg('--sec', 300), SPEED = arg('--speed', 3), STILL = args.includes('--still'), CAP = arg('--cap', 36), RUNS = arg('--runs', 1), DOWN = arg('--down', 0), FAST = args.includes('--fast'), LV = arg('--lv', 6), TAP = arg('--tap', 1), T0 = arg('--t0', 0), TRACE = args.includes('--trace'), MIX = arg('--mix', 0); /* --cap: 동시 마릿수 (기본 PC 24, 헤드리스는 저사양이라 바꿔 둠). --tap: 누르는 간격(게임 초), 기본 1초는 움직이며 누르니 fight.js(0.65초)보다 느리게 */
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 400 } });
  const errs = []; p.on('pageerror', (e) => { errs.push(e.message); console.log('ERR', e.message.slice(0, 300)); });
  const url = 'file://' + process.cwd() + '/dist/test.html#namsongi';
  await p.goto(url); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1, recycle: { visits: 3 }, swarm: { seen: 1, best: {} } }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.click('#enter', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1500);
  await p.evaluate(() => { const o = window.__oreum; o.pace.pacing.test.first.done = true; o.pace.pacing.test.first.bloomed = true; o.setTod(13); o.setWeather('clear'); o.director.open('field'); o.director.open('level'); });
  const wearIds = require('fs').readFileSync('src/balance.js', 'utf8').match(/id: '(top|jacket|socks|hat|bottom|vest):[^']+', slot: '\w+', tier: \d/g).map((s) => { const m = s.match(/id: '([^']+)', slot: '(\w+)', tier: (\d)/); return { id: m[1], slot: m[2], tier: +m[3] }; });
  const res = [];
  for (const zn of ZONES) for (let run = 0; run < RUNS; run++) {
    const gt = Math.max(1, zn - DOWN), wear0 = wearIds.filter((w) => w.tier === gt), slots = [...new Set(wear0.map((w) => w.slot))];
    /* --mix N (#243): 옷 N 칸만 한 단계 낮게 (장비 점수 80% 쯤 = 옷 3칸) */
    const wear = slots.map((sl, i) => (i < MIX && gt > 1 && wearIds.find((w) => w.slot === sl && w.tier === gt - 1)) || wear0.find((w) => w.slot === sl));
    const ok = await p.evaluate(({ zn, gt, wear, SPEED, CAP, LV, TAP, T0, FAST }) => {
      const o = window.__oreum; o.enemies.test.clear(); document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; });
      o.pace.pacing.test.soon(1e6);
      Object.assign(o.save.equip, { tool: gt, bag: gt, shoes: gt }); o.save.equip.weapon = Math.max(1, gt); o.weapon.use(gt); o.save.coins = 3000; o.save.bowAmmo = 0; o.save.ammo = { gun: 0, mg: 0, laser: 0 };
      for (const w of wear) { o.clothes.give(w.id); o.clothes.wear(w.slot, w.id); }
      o.player.knock = null; o.hp.set(o.hp.max);
      o.level.setXp(0); for (let k = 0; k < 40 && o.level.state().lv < LV; k++) o.level.setXp(o.level.state().xp + o.level.state().need); // 레벨 LV 처음
      o.level.set(Object.fromEntries(['jacket', 'light', 'twin', 'magnet', 'bite', 'sour', 'quick', 'burst', 'bighand', 'flower', 'recycle', 'deer'].slice(0, Math.max(0, LV - 1)).map((k) => [k, 1]))); /* 고를 것 없이: 영구 증강 1씩 */
      const hold = gt >= 4;
      if (FAST && !o.__noDraw) { o.__noDraw = o.renderer.render; o.renderer.render = () => {}; } /* --fast: 그리지 않고 셈만 (소프트웨어 GL 에서 판을 여러 번 잴 때, #254) */
      const at = o.swarm.start(zn); if (!at) return false; window.__zn = zn;
      o.swarm.speed(SPEED); o.swarm.setCap(CAP); if (T0) o.swarm.t(T0);
      const C = (window.__c = { lost: 0, down: 0, last: o.hp.hp, t0: o.weapon.t(), coins0: o.save.coins, max: o.hp.max, peak: 0, augs: 0, leader: 0, lv0: o.level.state().lv, next: 0, taps: 0 });
      const loop = () => {
        const gt = o.weapon.t() - C.t0; if (!hold && gt >= C.next) { o.weapon.fire(); C.taps++; C.next = gt + TAP; } /* 손으로 누름: charge.js 를 거치지 않는 짧은 누름과 같음 */
        const v = o.hp.hp; if (v < C.last - 1e-6) C.lost += C.last - v; C.last = v; if (o.hp.isDown || o.hp.pending) C.down = 1; const s = o.swarm.state(); if (s && s.zone === window.__zn) { C.s = s; C.peak = Math.max(C.peak, s.n); if (s.leader) C.leader = 1; } if (o.swarm.picking()) { o.swarm.pick(0); C.augs++; } requestAnimationFrame(loop); };
      requestAnimationFrame(loop); return hold ? 'hold' : true;
    }, { zn, gt, wear, SPEED, CAP, LV, TAP, T0, FAST });
    if (!ok) { console.log('구역', zn, '들판 자리를 못 찾음'); continue; }
    if (!STILL) await p.keyboard.down('w');
    if (ok === 'hold') await p.keyboard.down('f');
    let t = 0;
    for (let i = 0; i < 20000; i++) {
      const r = await p.evaluate(({ STILL }) => {
        const o = window.__oreum, P = o.player, tr = o.trash.api.trail, za = o.trash.api.zoneAt, z0 = o.swarm.state()?.zone;
        if (!STILL && z0) { // 적이 적은 쪽으로
          let best = P.heading, bs = -1e9;
          for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283, x = P.pos.x + Math.sin(a) * 4, z = P.pos.z + Math.cos(a) * 4;
            const c = o.swarm.at(z0), R = o.arena.list()[0].r; if (Math.hypot(x - c[0], z - c[1]) > R - 3 || (o.life.hooks.enemyPass && !o.life.hooks.enemyPass(x, z, 0.6)) || (o.spots.clamp && o.spots.clamp(x, z))) continue; /* 서바이벌 터 안에서만 (#231) */
            let sc = 0; for (const e of o.enemies.list) { if (e.state === 'flee' || e.state === 'leave') continue; const d = Math.hypot(e.pos.x - x, e.pos.z - z); sc -= 30 / Math.max(1.5, d); }
            sc -= Math.abs(Math.atan2(Math.sin(a - P.heading), Math.cos(a - P.heading))) * 0.4; for (const [qx, qz] of o.swarm.shardsAt()) sc += 4 / Math.max(2, Math.hypot(qx - x, qz - z)); if (sc > bs) { bs = sc; best = a; } }
          P.heading = best;
          { const c = o.swarm.at(z0), R = o.arena.list()[0].r, dc = Math.hypot(P.pos.x - c[0], P.pos.z - c[1]); if (dc > R - 4) P.heading = Math.atan2(c[0] - P.pos.x, c[1] - P.pos.z); o.cam.yaw = P.heading + Math.PI; } /* W 는 카메라 앞으로 가므로 카메라도 같은 쪽 */ /* 터 가장자리면 가운데로 (#254: 밀려 나가 '터 밖' 으로 끝나지 않게) */
        }
        const st = o.swarm.state(), c0 = z0 && o.swarm.at(z0); return { t: o.weapon.t() - window.__c.t0, on: !!st && st.zone === window.__zn, down: window.__c.down, out: !!st && !st.inside, dc: c0 ? +Math.hypot(P.pos.x - c0[0], P.pos.z - c0[1]).toFixed(1) : null, y: +P.pos.y.toFixed(1), n: st?.n };
      }, { STILL });
      if (TRACE && (i % 25 === 0 || r.out)) console.log('  trace', JSON.stringify({ t: +r.t.toFixed(1), dc: r.dc, y: r.y, out: r.out, n: r.n })); /* --trace: 터 가운데에서 거리 (#243) */
      if (r.out && !STILL) await p.keyboard.press(' '); /* 터 밖으로 밀렸으면 떼를 뛰어넘어 돌아옴 (#254) */
      t = r.t; if (t >= SEC || !r.on || r.down) break;
      await p.waitForTimeout(120);
    }
    if (!STILL) await p.keyboard.up('w');
    if (ok === 'hold') await p.keyboard.up('f');
    const c = await p.evaluate(() => { const o = window.__oreum, C = window.__c; o.swarm.speed(1); return { ...C, coins: o.save.coins - C.coins0, lvUp: o.level.state().lv - C.lv0, sc: o.gearScore?.()?.total ?? null }; });
    const s = c.s || {};
    const why = await p.evaluate(() => window.__oreum.swarm.last?.why || (window.__oreum.swarm.state() ? '시간' : '-'));
    const row = { 구역: zn, 점수: c.sc, 끝: why, '버틴(초)': Math.round(t), 쓰러짐: c.down, 쫓아냄: s.kills, 물결: s.stage, '최대 마릿수': c.peak, '잃은 기운%': Math.round(100 * c.lost / c.max), '번 귤(판)': s.gyul, '귤 차이': Math.round(c.coins), 조각: s.shards, 레벨업: c.lvUp, 고른: c.augs, 대장: c.leader };
    console.log(JSON.stringify(row)); res.push(row);
    await p.evaluate(() => { const o = window.__oreum; o.swarm.stop(); o.enemies.test.clear(); });
    await p.waitForFunction(() => { const h = window.__oreum.hp; return !h.isDown && !h.pending && h.hp > 0; }, null, { timeout: 120000, polling: 500 }).catch(() => {});
    await p.waitForTimeout(500);
  }
  console.table(res);
  for (const zn of ZONES) { const R = res.filter((r) => r.구역 === zn); if (R.length > 1) console.log(`구역 ${zn}: ${R.length}판 중 버팀 ${R.filter((r) => r.끝 === 'win').length} (${Math.round(100 * R.filter((r) => r.끝 === 'win').length / R.length)}%), 번 귤 평균 ${Math.round(R.reduce((a, r) => a + (r['번 귤(판)'] || 0), 0) / R.length)}, 최대 마릿수 ${Math.max(...R.map((r) => r['최대 마릿수'] || 0))}`); }
  console.log(errs.length ? `페이지 오류 ${errs.length}` : '페이지 오류 없음');
  await b.close();
})();
