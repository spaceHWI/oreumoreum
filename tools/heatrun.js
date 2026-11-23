// 레이저 과열 확인 (#200): node tools/heatrun.js [shot]
// dist/test.html 남송이 전투 오름에서 레이저를 들고 F 를 계속 누름 → 열이 차서 과열 → 못 쏘는 동안 귤이 줄지 않음 → 다 식으면 다시 쏨
// 열 고리(#heat)의 색·떨림·과열 표시도 봄. shot 을 주면 과열 순간 PC(800×450)·폰(390×700) 화면을 /tmp/claude-0/shots/heat-*.png 로
const { chromium } = require('playwright');
const SHOT = process.argv[2] === 'shot', OUT = process.env.SHOTS || '/tmp/claude-0/shots/';
if (SHOT) require('fs').mkdirSync(OUT, { recursive: true });
async function one(b, vp, tag, mobile) {
  const p = await b.newPage({ viewport: vp, ...(mobile ? { hasTouch: true, isMobile: true } : {}) });
  const errs = []; p.on('pageerror', (e) => { errs.push(e.message); console.log('ERR', e.message.slice(0, 300)); });
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1 }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.click('#enter', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1500);
  await p.evaluate(() => { const o = window.__oreum; o.pace.pacing.test.first.done = true; o.pace.pacing.test.first.bloomed = true; o.setTod(13); o.setWeather('clear'); o.enemies.test.clear(); document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; });
    o.save.equip.weapon = 6; o.weapon.use(5); o.save.coins = 500; o.save.ammo = { gun: 0, mg: 0, laser: 0 }; const x = -60, z = 40; o.player.pos.set(x, o.groundAt(x, z), z); o.player.heading = Math.PI / 2;
    const e = o.enemies.test.spawn('boar', 12, 0); e.def = { ...e.def, hp: 1e6, walk: 0, chase: 0, flee: 9, rootEvery: [999, 999] }; e.hp = 1e6; e.shotT = 999; window.__home = e.pos.clone(); });
  const log = []; let over = null, ready = null, refire = null, coinsAtOver = null, coinsLockEnd = null, sawShake = false, sawToast = false, sawColors = new Set(), shotDone = false;
  await p.keyboard.down('f');
  const t0 = await p.evaluate(() => window.__oreum.weapon.t());
  for (let i = 0; i < 400; i++) {
    const r = await p.evaluate(() => { const o = window.__oreum, h = o.weapon.heat(), el = document.getElementById('heat'), e = o.enemies.list[0]; if (e && window.__home) e.pos.copy(window.__home); return { t: o.weapon.t(), k: h.k, lock: h.lock, coins: o.save.coins, ring: !el.hidden, c: el.style.getPropertyValue('--c'), shake: el.classList.contains('shake'), over: el.classList.contains('over'), beams: o.weapon.fx.beams.filter((b) => b.on).length, toast: document.getElementById('msg-log').hidden ? '' : document.getElementById('msg-log').textContent }; });
    const t = r.t - t0; if (/과열/.test(r.toast)) sawToast = true; if (r.ring) sawColors.add(r.c); if (r.shake) sawShake = true;
    if (over == null && r.lock > 0) { over = t; coinsAtOver = r.coins; log.push(`과열 ${t.toFixed(2)}초 · 고리 over=${r.over} · 빔 ${r.beams} · 알림 '${r.toast}'`); if (SHOT && !shotDone) { shotDone = true; await p.waitForTimeout(120); await p.screenshot({ path: `${OUT}heat-${tag}.png` }); } }
    if (over != null && ready == null && r.lock <= 0) { ready = t; coinsLockEnd = r.coins; log.push(`다 식음 ${t.toFixed(2)}초 · 과열 동안 귤 ${coinsAtOver - coinsLockEnd}개 씀`); }
    if (ready != null && refire == null && r.beams > 0 && r.k > 0) { refire = t; log.push(`다시 쏨 ${t.toFixed(2)}초`); }
    if (refire != null || t > 15) break;
    await p.waitForTimeout(50);
  }
  await p.keyboard.up('f'); await p.evaluate(() => window.__oreum.enemies.test.clear()); /* 들판 자동 쏘기가 쏘지 않게 적을 치움 */
  // 놓으면 식음: 0.5초 뒤부터
  const gwait = async (sec) => { const a = await p.evaluate(() => window.__oreum.weapon.t()); while ((await p.evaluate(() => window.__oreum.weapon.t())) - a < sec) await p.waitForTimeout(50); }; /* 게임 시간으로 기다림 (느린 헤드리스) */
  await gwait(1.5); const k1 = await p.evaluate(() => window.__oreum.weapon.heat().k); await gwait(1.5); const k2 = await p.evaluate(() => window.__oreum.weapon.heat().k);
  log.push(`놓고(모아 쏜 줄기 1초 뒤) 1.5초 → 3초: 열 ${(k1 * 100).toFixed(0)}% → ${(k2 * 100).toFixed(0)}%`);
  const pres = await p.evaluate(() => JSON.stringify(window.__oreum.weapon.heat()));
  const ok = over != null && over > 4 && over < 6.5 && ready != null && coinsAtOver === coinsLockEnd && refire != null && sawToast && k2 < k1 && sawShake && sawColors.size >= 3;
  console.log(tag, log.join(' | '), '| 색', [...sawColors].join(','), '| 떨림', sawShake, '| 과열! 알림', sawToast, '|', pres, ok ? '통과' : '실패');
  await p.close(); return ok && !errs.length;
}
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const a = await one(b, { width: 800, height: 450 }, 'pc', false);
  const m = await one(b, { width: 390, height: 700 }, 'phone', true);
  await b.close(); console.log(a && m ? '모두 통과' : '실패'); process.exit(a && m ? 0 : 1);
})();
