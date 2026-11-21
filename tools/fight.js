// 구역별 한 무리 싸움 (#148): node tools/fight.js [zone...] [--move]
// dist/test.html 남송이 전투 오름에서 구역마다 그 구역 몹 한 무리(3마리)를 18m 둘레에 부르고, 권장 장비(칸 10개가 구역 번호 단계:
// 무기·티셔츠·잠바·양말)로 F 를 눌러 쫓아냄. 시간은 게임 시간. 기록: 쫓아낸 시간·누른 수·쏜 탄·맞힌 수·잃은 기운(최대의 %)·쓰러짐
// --move: 서 있지 않고 적에게서 뒤로 물러나며 던짐 (조이스틱 흉내)
// mom: 이야기 이벤트 '엄마가 왔다' (#168) 엄마 멧돼지 + 새끼 둘을 구역 1 권장 장비로 (잃은 기운 40% 아래여야 함)
const { chromium } = require('playwright');
const args = process.argv.slice(2), MOVE = args.includes('--move');
const ZONES = args.filter((a) => /^\d$/.test(a)).map(Number); if (args.includes('mom')) ZONES.push('mom'); if (!ZONES.length) ZONES.push(1, 2, 3, 4, 5, 'mom');
const KIND = { 1: 'piglet', 2: 'dog', 3: 'boar', 4: 'rabid', 5: 'alien', mom: 'mom' }, N = 3, LIMIT = 90;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 400 } });
  const errs = []; p.on('pageerror', (e) => { errs.push(e.message); console.log('ERR', e.message.slice(0, 300)); });
  const url = 'file://' + process.cwd() + '/dist/test.html#namsongi';
  await p.goto(url); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1 }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.click('#enter', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1500);
  await p.evaluate(() => {
    const o = window.__oreum; o.pace.pacing.test.first.done = true; o.pace.pacing.test.first.bloomed = true; o.setTod(13); o.setWeather('clear');
    // 셈: 쏜 탄(귤·화살·총알), 적 기운이 준 횟수, 플레이어가 잃은 기운
    const L = o.life, F = o.weapon.fx, C = (window.__c = { shots: 0, hits: 0, lost: 0, down: 0 });
    for (const [obj, k] of [[L, 'throwTangerine'], [L, 'shootArrow'], [F, 'shoot'], [F, 'lob']]) { const f = obj[k]; if (f) obj[k] = function (...a) { if (k !== 'throwTangerine' || !a[3]?.drop) C.shots++; return f.apply(this, a); }; }
    const seen = new Map(); let last = o.hp.hp, wasDown = false;
    const loop = () => { for (const e of o.enemies.list) { const h = seen.get(e); if (h != null && e.hp < h - 1e-6) C.hits++; seen.set(e, e.hp); } const v = o.hp.hp; if (v < last - 1e-6) C.lost += last - v; last = v; if (o.hp.isDown && !wasDown) C.down++; wasDown = o.hp.isDown; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
  const wearIds = require('fs').readFileSync('src/balance.js', 'utf8').match(/id: '(top|jacket|socks):[^']+', slot: '\w+', tier: \d/g).map((s) => { const m = s.match(/id: '([^']+)', slot: '(\w+)', tier: (\d)/); return { id: m[1], slot: m[2], tier: +m[3] }; });
  const res = [];
  for (const zn0 of ZONES) {
    const zn = zn0 === 'mom' ? 1 : zn0, kind = KIND[zn0], wear = wearIds.filter((w) => w.tier === zn);
    await p.evaluate(({ zn, kind, N, wear }) => {
      const o = window.__oreum; o.enemies.test.clear(); document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; });
      o.pace.pacing.test.soon(1e6);
      o.save.equip.weapon = Math.max(1, zn); o.weapon.use(zn); o.save.coins = 5000; o.save.bowAmmo = 0; o.save.ammo = { gun: 0, mg: 0, laser: 0 };
      for (const w of wear) { o.clothes.give(w.id); o.clothes.wear(w.slot, w.id); }
      const x = -60, z = 40; o.player.pos.set(x, o.groundAt(x, z), z); o.player.heading = Math.PI / 2; o.player.knock = null; o.hp.set(o.hp.max);
      if (kind === 'mom') o.story.mom(18, 0); // #168 엄마 + 새끼 둘
      else for (let i = 0; i < N; i++) { const a = Math.PI / 2 + (i - 1) * 0.5; const e = o.enemies.test.spawn(kind, Math.sin(a) * 18, Math.cos(a) * 18); e.state = 'charge'; e.st = 0; }
      Object.assign(window.__c, { shots: 0, hits: 0, lost: 0, down: 0 }); window.__t0 = o.weapon.t(); window.__hpMax = o.hp.max;
    }, { zn, kind, N, wear });
    const hold = zn === 4 || zn === 5, gap = { 1: 650, 2: 650, 3: 720 }[zn] || 650;
    let done = null, fired = 0, next = 0;
    if (hold) await p.keyboard.down('f');
    if (MOVE) await p.keyboard.down('s');
    for (let i = 0; i < 3000 && !done; i++) {
      const now = await p.evaluate(() => window.__oreum.weapon.t() - window.__t0);
      if (now > LIMIT) break;
      if (!hold && now >= next) { await p.keyboard.press('f'); fired++; next = now + gap / 1000; }
      await p.waitForTimeout(50);
      done = await p.evaluate(() => { const o = window.__oreum; if (o.hp.hp <= 0 || o.hp.pending || o.hp.isDown) { window.__c.down = 1; return -1; } return o.enemies.list.every((e) => e.state === 'flee') ? o.weapon.t() - window.__t0 : null; });
    }
    if (hold) await p.keyboard.up('f');
    if (MOVE) await p.keyboard.up('s');
    const c = await p.evaluate(() => ({ ...window.__c, max: window.__hpMax, left: window.__oreum.enemies.list.filter((e) => e.state !== 'flee' && e.state !== 'leave').length, hp: window.__oreum.hp.hp }));
    const row = { 구역: zn0, 적: kind === 'mom' ? '엄마+새끼2' : kind + '×' + N, 무기: zn, '쫓아냄(초)': done === -1 ? '쓰러짐' : done != null ? +done.toFixed(1) : `못 함(남 ${c.left})`, 누름: hold ? '계속' : fired, 탄: c.shots, 맞힘: c.hits, '맞힘%': c.shots ? Math.round(100 * Math.min(c.hits, c.shots) / c.shots) : '-', '잃은 기운%': Math.round(100 * c.lost / c.max), 쓰러짐: c.down };
    console.log(JSON.stringify(row)); res.push(row);
    await p.evaluate(() => { const o = window.__oreum; o.enemies.test.clear(); });
    await p.waitForFunction(() => { const h = window.__oreum.hp; return !h.isDown && !h.pending && h.hp > 0; }, null, { timeout: 120000, polling: 500 }).catch(() => {});
    await p.waitForTimeout(500);
  }
  console.table(res);
  const mom = res.find((r) => r.구역 === 'mom'); if (mom) { const ok = mom.쓰러짐 === 0 && typeof mom['잃은 기운%'] === 'number' && mom['잃은 기운%'] < 40; console.log(`엄마 멧돼지 (#168): 잃은 기운 ${mom['잃은 기운%']}% → 40% 아래 ${ok ? '통과' : '실패'}`); if (!ok) errs.push('mom'); }
  console.log(errs.length ? `오류 ${errs.length}` : '오류 없음');
  await b.close(); process.exit(errs.length ? 1 : 0);
})();
