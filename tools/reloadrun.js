// 탄창·재장전 확인 (#274): node tools/reloadrun.js [d|m]  (d PC 800×450, m 폰 390×700, 없으면 둘 다)
// dist/test.html 남송이 전투 오름에서 귤 총을 들고
// 1) 탄창(8)을 다 쏨 → 저절로 재장전 → 그동안 못 쏨·귤이 줄지 않음·고리(#reload)가 보임 → 다 채우면 다시 쏨
// 2) 손 재장전: 3발 쏘고 PC 는 R, 폰은 #btn-reload 단추(가득이 아니면 보임) → 재장전 → 가득
// 3) 무기 바꾸기: 재장전 중 머신건으로 바꾸면 끊기고, 다시 총으로 오면 남은 탄 그대로
// 4) 머신건: 누른 채 30발 → 재장전 2.2초쯤 · 레이저는 고리가 #heat 만(재장전 고리 없음)
const { chromium } = require('playwright');
const MODE = process.argv[2] || 'dm';
async function one(b, vp, tag, mobile) {
  const p = await b.newPage({ viewport: vp, ...(mobile ? { hasTouch: true, isMobile: true } : {}) });
  const errs = []; p.on('pageerror', (e) => { errs.push(e.message); console.log('ERR', e.message.slice(0, 300)); });
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.evaluate(() => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1 }); const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
  await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.click('#enter', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1500);
  await p.evaluate(() => { const o = window.__oreum; o.pace.pacing.test.first.done = true; o.pace.pacing.test.first.bloomed = true; o.setTod(13); o.setWeather('clear'); o.enemies.test.clear(); document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; });
    o.save.equip.weapon = 5; o.weapon.use(3); o.weapon.magReset(); o.save.coins = 500; o.save.ammo = { gun: 0, mg: 0, laser: 0 }; const x = -60, z = 40; o.player.pos.set(x, o.groundAt(x, z), z); o.player.heading = Math.PI / 2;
    const e = o.enemies.test.spawn('boar', 12, 0); e.def = { ...e.def, hp: 1e6, walk: 0, chase: 0, flee: 9, rootEvery: [999, 999] }; e.hp = 1e6; e.shotT = 999; window.__home = e.pos.clone(); });
  const S = () => p.evaluate(() => { const o = window.__oreum, e = o.enemies.list[0]; if (e && window.__home) e.pos.copy(window.__home); const m = o.weapon.mag(); return { t: o.weapon.t(), m, coins: o.save.coins, w: o.weapon.now(), ring: !document.getElementById('reload').hidden, heat: !document.getElementById('heat').hidden, btn: getComputedStyle(document.getElementById('btn-reload')).display !== 'none' && !document.getElementById('btn-reload').hidden, ammo: document.getElementById('ammo').className, can: o.weapon.canShoot() }; });
  const gwait = async (sec) => { const a = await p.evaluate(() => window.__oreum.weapon.t()); while ((await p.evaluate(() => window.__oreum.weapon.t())) - a < sec) await p.waitForTimeout(40); };
  const fire = () => p.evaluate(() => window.__oreum.weapon.fire());
  const log = [], bad = [];
  const need = (c, msg) => { if (!c) bad.push(msg); };
  // 1) 다 쏨 → 저절로 재장전
  let r = await S(); need(r.m && r.m.n === 8 && r.m.mag === 8, '처음 탄창 8');
  let shots = 0, tEmpty = null, coinsEmpty = null;
  for (let i = 0; i < 400 && tEmpty == null; i++) { const a = r.m.n; await fire(); r = await S(); if (r.m.n < a) shots++; if (r.m.t > 0) { tEmpty = r.t; coinsEmpty = r.coins; } await p.waitForTimeout(30); }
  need(shots === 8, `8발 뒤 재장전 (쏜 수 ${shots})`); need(r.ring, '재장전 고리 보임'); need(!r.can, '재장전 중 못 쏨');
  need(/load/.test(r.ammo), '탄 표시 재장전 색');
  await fire(); await fire(); const mid = await S(); need(mid.m.n === 0 && mid.coins === coinsEmpty, '재장전 중 눌러도 안 나가고 귤 그대로');
  let tDone = null; for (let i = 0; i < 300 && tDone == null; i++) { r = await S(); if (r.m.t <= 0 && r.m.n === 8) tDone = r.t; else await p.waitForTimeout(30); }
  const autoSec = tDone - tEmpty; log.push(`총 저절로 재장전 ${autoSec.toFixed(2)}초`); need(autoSec > 0.9 && autoSec < 1.6, '총 재장전 1.2초쯤'); need(!r.ring, '다 채우면 고리 꺼짐');
  await gwait(0.8); await fire(); r = await S(); need(r.m.n === 7, '다시 쏨');
  // 2) 손 재장전
  for (let i = 0; i < 60 && r.m.n > 5; i++) { await fire(); r = await S(); await p.waitForTimeout(30); }
  need(r.m.n === 5, `5발 남김 (${r.m.n})`);
  if (mobile) { need(r.btn, '폰 재장전 단추 보임'); await p.tap('#btn-reload'); }
  else { need(!r.btn, 'PC 엔 단추 없음'); await p.keyboard.press('r'); }
  r = await S(); need(r.m.t > 0, '손 재장전 시작');
  await gwait(1.5); r = await S(); need(r.m.n === 8 && r.m.t <= 0, '손 재장전 가득'); if (mobile) need(!r.btn, '가득이면 단추 숨음');
  if (!mobile) { const sp0 = await p.evaluate(() => window.__oreum.player.gait); await p.keyboard.press('r'); const sp1 = await p.evaluate(() => window.__oreum.player.gait); need(sp0 === sp1, '총 들고 R 은 달리기를 안 바꿈'); r = await S(); need(r.m.t <= 0, '가득이면 R 해도 재장전 안 함'); }
  // 3) 무기 바꾸기
  for (let i = 0; i < 60 && r.m.n > 6; i++) { await fire(); r = await S(); await p.waitForTimeout(30); }
  await p.evaluate(() => window.__oreum.weapon.reload()); r = await S(); need(r.m.t > 0 && r.m.n === 6, '바꾸기 전 재장전 중');
  await p.evaluate(() => window.__oreum.weapon.use(4)); await gwait(0.2); r = await S(); need(r.w === 'mg' && r.m.n === 30 && r.m.t <= 0, '머신건 탄창 30 가득');
  await p.evaluate(() => window.__oreum.weapon.use(3)); await gwait(0.2); r = await S(); need(r.w === 'gun' && r.m.n === 6 && r.m.t <= 0, `돌아오면 남은 탄 그대로·재장전 끊김 (${r.m.n}, ${r.m.t})`);
  // 4) 머신건 누른 채
  await p.evaluate(() => window.__oreum.weapon.use(4)); await gwait(0.2);
  await p.keyboard.down('f'); let mt0 = null, mt1 = null;
  for (let i = 0; i < 500 && mt1 == null; i++) { r = await S(); if (mt0 == null && r.m.t > 0) mt0 = r.t; if (mt0 != null && r.m.t <= 0) mt1 = r.t; if (mt0 == null) await fire(); await p.waitForTimeout(30); }
  await p.keyboard.up('f');
  const mgSec = mt1 - mt0; log.push(`머신건 재장전 ${mgSec ? mgSec.toFixed(2) : '?'}초`); need(mgSec > 1.8 && mgSec < 2.8, '머신건 재장전 2.2초쯤');
  await p.evaluate(() => window.__oreum.weapon.use(5)); await gwait(0.2); r = await S(); need(!r.m && !r.ring, '레이저는 탄창 없음');
  const ok = !bad.length && !errs.length;
  console.log(tag, log.join(' | '), bad.length ? '| 실패: ' + bad.join(', ') : '', ok ? '통과' : '실패');
  await p.close(); return ok;
}
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  let ok = true;
  if (MODE.includes('d')) ok = (await one(b, { width: 800, height: 450 }, 'pc', false)) && ok;
  if (MODE.includes('m')) ok = (await one(b, { width: 390, height: 700 }, 'phone', true)) && ok;
  await b.close(); console.log(ok ? '모두 통과' : '실패'); process.exit(ok ? 0 : 1);
})();
