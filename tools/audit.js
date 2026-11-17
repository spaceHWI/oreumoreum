// 전체 검수 (#16): 처음부터 끝까지 한 바퀴. node tools/audit.js [d|m] [step...]  → dist/audit/<d|m>-<n>.jpg + 줄마다 결과
//   d = 데스크톱 1440×900, m = 폰 390×844 터치. 단계 이름을 주면 그 단계만 (예: node tools/audit.js m shops)
//   단계마다: 페이지 오류·콘솔 오류, 화면 밖으로 나간 UI, 겹친 UI(위 한 줄·토스트·팁·힌트·가장자리 표시·버튼), 넘친 글자를 센다
//   튜토리얼은 tools/tutrun.js 가 따로 돈다
const { chromium } = require('playwright');
const fs = require('fs');
const mode = process.argv[2] || 'd';
const only = process.argv.slice(3);
fs.mkdirSync('dist/audit', { recursive: true });
const URL = 'file://' + process.cwd() + '/dist/test.html?tier=1&hwi=1#namsongi';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext(mode === 'm'
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }
    : { viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errs = []; let step = 'boot';
  p.on('pageerror', (e) => { errs.push(step + ': ' + e.message.slice(0, 200)); console.log('ERR', step, e.message.slice(0, 300)); });
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|net::ERR|Failed to load resource|open-meteo|accounts.google/i.test(m.text())) { errs.push(step + ' (console): ' + m.text().slice(0, 200)); console.log('CON', step, m.text().slice(0, 300)); } });
  const W = (ms) => p.waitForTimeout(ms);
  const E = (fn, arg) => p.evaluate(fn, arg);
  const until = async (fn, ms = 8000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await W(250); } return false; };
  let shotN = 0;
  const ui = () => E(() => {
    const IDS = ['topbar', 'toast', 'tip', 'tut-hint', 'ch-arrow', 'shop-arrow', 'cart-mark', 'shop-mark', 'banner', 'btn-ctx', 'btn-pick', 'btn-jump', 'btn-ride', 'ride-pick', 'btn-speed', 'btn-actions', 'btn-chat', 'btn-ach', 'btn-menu', 'joy', 'ammo', 'bloom-banner', 'sitbar', 'btn-release', 'btn-cancelreq', 'hp-wait'];
    const vis = (el) => { if (!el || el.hidden) return null; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return null; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return null; let a = el.parentElement; while (a && a !== document.body) { const c = getComputedStyle(a); if (a.hidden || c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05) return null; a = a.parentElement; } return r; };
    const on = IDS.map((id) => [id, vis(document.getElementById(id))]).filter((x) => x[1]);
    const over = [];
    for (let i = 0; i < on.length; i++) for (let j = i + 1; j < on.length; j++) {
      const [a, ra] = on[i], [c, rc] = on[j];
      const ea = document.getElementById(a), ec = document.getElementById(c); if (ea.contains(ec) || ec.contains(ea)) continue;
      const w = Math.min(ra.right, rc.right) - Math.max(ra.left, rc.left), h = Math.min(ra.bottom, rc.bottom) - Math.max(ra.top, rc.top);
      if (w > 4 && h > 4) over.push(`${a}×${c}`);
    }
    const W = innerWidth, H = innerHeight;
    const out = on.filter(([, r]) => r.left < -2 || r.top < -2 || r.right > W + 2 || r.bottom > H + 2).map(([id]) => id);
    // 넘친 글자: 보이는 패널·버튼 안에서 한 줄 글자가 칸보다 넓은 것
    const spill = [];
    document.querySelectorAll('button, .pill, h2, b, span, label').forEach((el) => {
      if (spill.length > 8) return; const r = vis(el); if (!r) return; if (!el.textContent.trim() || el.children.length > 2) return;
      const cs = getComputedStyle(el); if (cs.overflow === 'visible' && cs.whiteSpace !== 'nowrap') return;
      if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) spill.push((el.id || el.className || el.tagName) + ':' + el.textContent.trim().slice(0, 14));
    });
    const panels = [...document.querySelectorAll('.overlay, .panel, nav, #shoppop')].filter((el) => vis(el)).map((el) => el.id).filter(Boolean);
    const panOut = panels.filter((id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.right > W + 2 || r.left < -2; });
    return { on: on.map((x) => x[0]), over, out, spill, panels, panOut };
  }).catch((e) => ({ err: String(e).slice(0, 80) }));
  const report = [];
  const shot = async (name) => {
    const u = await ui();
    const n = String(++shotN).padStart(2, '0');
    await p.screenshot({ path: `dist/audit/${mode}-${n}-${name}.jpg`, type: 'jpeg', quality: 55, timeout: 180000 }).catch((e) => console.log('shot fail', e.message.slice(0, 80)));
    const line = { step, shot: `${mode}-${n}-${name}`, over: u.over, out: u.out, spill: u.spill, panels: u.panels, panOut: u.panOut };
    report.push(line); console.log('SHOT', JSON.stringify(line));
  };
  const tap = async (sel) => { const el = await p.$(sel); if (!el) return false; try { if (mode === 'm') await el.tap({ timeout: 3000 }); else await el.click({ force: true, timeout: 3000 }); } catch { await el.evaluate((e) => e.click()).catch(() => {}); } return true; };
  const press = async (k, ms = 80) => { await p.keyboard.down(k); await W(ms); await p.keyboard.up(k); };
  const close = () => E(() => { if (document.body.classList.contains('intro-help-on')) document.getElementById('enter').click(); ['shop', 'sign', 'wishes', 'chat', 'actions', 'menu', 'ach', 'dex', 'maps', 'feedback', 'notes', 'server', 'shoppop', 'wardrobe', 'photo'].forEach((id) => { const e = document.getElementById(id); if (e && !e.hidden) { const c = document.getElementById(id + '-close'); if (c) c.click(); else e.hidden = true; } }); });
  const want = (s) => !only.length || only.includes(s);
  const run = async (s, fn) => { if (!want(s) && s !== 'enter') return; step = s; const t0 = Date.now(); try { await fn(); } catch (e) { errs.push(s + ' (script): ' + e.message.slice(0, 160)); console.log('FAIL', s, e.message.slice(0, 300)); } console.log('done', s, ((Date.now() - t0) / 1000).toFixed(0) + 's'); };

  await p.goto(URL); await W(6000);
  await run('enter', async () => {
    await shot('intro');
    await tap('#enter'); await W(1200); await shot('server');
    await tap('#intro-srv button'); await W(400); await tap('#srv-go'); await W(4000);
    if (await E(() => !document.getElementById('look').hidden)) { await shot('look'); await tap('#look-ok'); await W(1500); }
    await E(() => window.__oreum.setTod(14));
    await W(1500); await shot('tut-start');
    // 튜토리얼은 tutrun.js 가 본다. 여기서는 어드민 버튼으로 건너뜀
    await E(() => document.getElementById('dev-tut').click()); await W(1500);
    await E(() => document.getElementById('dev-gyul').click()); await W(500);
    await close(); await W(800); await shot('after-tut');
  });
  await run('heap', async () => {
    await E(() => { const o = window.__oreum; o.trash.goHeap(0); o.snap(); }); await W(1500); await shot('heap');
    if (mode === 'm') { const r = await p.$('#btn-pick'); const bb = r && await r.boundingBox(); if (bb) { await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); } }
    else { await p.keyboard.down('e'); await W(3000); await p.keyboard.up('e'); }
    await W(1200);
    console.log('bag', JSON.stringify(await E(() => window.__oreum.trash.state())));
    await E(() => { const o = window.__oreum; o.trash.fillBag(o.trash.state().cap); }); await W(1200); await shot('bag-full');
    const r = await E(() => window.__oreum.cleanhouse.route()); console.log('route', JSON.stringify(r));
    await E(() => window.__oreum.cleanhouse.autoGo()); await W(2500); await shot('autogo');
    await E(() => window.__oreum.cleanhouse.autoStop());
    const c0 = await E(() => window.__oreum.save.coins);
    await E(() => { const o = window.__oreum; o.cleanhouse.go(); o.snap(); }); await W(1500); await shot('cleanhouse');
    await E(() => window.__oreum.cleanhouse.dump()); await W(2500);
    console.log('dump coins', c0, '->', await E(() => window.__oreum.save.coins)); await shot('dumped');
  });
  await run('shops', async () => {
    await E(() => window.__oreum.cleanhouse.openShop()); await W(1500); await shot('stall-shop');
    for (const t of ['bag', 'weapon']) { if (await tap(`#shop-tabs [data-tab="${t}"]`)) { await W(600); if (t === 'weapon') await shot('stall-' + t); } }
    await close(); await W(500);
    for (const [k, go] of [['leap', 'leap'], ['salon', 'salon'], ['stone', 'stone'], ['ride', null]]) {
      if (go) await E((g) => { const o = window.__oreum; o[g]?.go(); o.snap(); }, go); else await E(() => { const o = window.__oreum; const s = o.rides.shop; if (s) { o.player.pos.set(s.front?.x ?? o.player.pos.x, o.player.pos.y, s.front?.z ?? o.player.pos.z); } });
      await W(1200);
      await E((k) => { const o = window.__oreum; if (k === 'leap') o.leap.open(); else if (k === 'salon') o.salon.open(); else if (k === 'stone') o.stone.open(); else o.rides.open(); }, k); await W(1500); await shot('shop-' + k);
      await close(); await W(600);
    }
    // 가게 문·충돌: 문 앞에서 들어가는 쪽으로 막히는지
    console.log('street', JSON.stringify(await E(() => { const o = window.__oreum; return o.street ? o.street.shops.map((s) => ({ id: s.id, door: s.door && [+s.door.x.toFixed(1), +s.door.z.toFixed(1)], blocked: s.door ? o.col.blocked(s.door.x, s.door.z, 0.3) : null })) : null; })));
  });
  await run('rides', async () => {
    await E(() => { const o = window.__oreum; o.cleanhouse.go(); o.rides.give('skate'); o.rides.mount('skate'); o.snap(); }); await W(1500);
    console.log('ride', JSON.stringify(await E(() => window.__oreum.rides.state()))); await shot('ride-on');
    await E(() => window.__oreum.rides.off()); await W(800);
    const t = await E(() => window.__oreum.rides.cart?.at(0)); console.log('cart at', t);
    await E(() => { const o = window.__oreum; o.rides.cart?.goStop(0); o.snap(); }); await W(1500);
    await E(() => window.__oreum.rides.cart?.board()); await W(2500); console.log('cart', JSON.stringify(await E(() => window.__oreum.rides.cart?.state()))); await shot('cart');
    await E(() => window.__oreum.rides.cart?.leave(true)); await W(1000);
  });
  await run('fish', async () => {
    await E(() => { const o = window.__oreum; o.fish.go(); o.snap(); }); await W(1200); console.log('can fish', await E(() => window.__oreum.fish.can()));
    await E(() => { const o = window.__oreum; o.fish.press(); o.fish.wait(0.5); }); await W(2500); await shot('fish');
    await E(() => window.__oreum.fish.press()); await W(2000); console.log('fish state', JSON.stringify(await E(() => window.__oreum.fish.state())));
  });
  await run('photo', async () => {
    await E(() => { const o = window.__oreum, g = o.photo.photog; const P = g?.pos || g?.group?.position; if (P) { o.player.pos.set(P.x + 2, o.groundAt(P.x + 2, P.z), P.z); o.snap(); } }); await W(1000);
    await E(() => window.__oreum.photo.start()); await W(6000); console.log('photo', JSON.stringify(await E(() => window.__oreum.photo.state()))); await shot('photo');
    await E(() => window.__oreum.photo.open() && window.__oreum.photo.close()); await W(800);
  });
  await run('cairn', async () => {
    await E(() => { const o = window.__oreum, c = o.cairns[0]; const P = c.pos || c.group?.position || c; o.player.pos.set(P.x + 2.2, o.groundAt(P.x + 2.2, P.z), P.z); o.player.heading = -Math.PI / 2; o.snap(); }); await W(1500); await shot('cairn');
    if (mode === 'd') await press('f'); else await tap('#btn-ctx'); await W(1500); await shot('cairn-wish');
    if (await E(() => !document.getElementById('wishes').hidden)) { await tap('#wish-submit'); await W(1500); }
    await close();
  });
  await run('emote', async () => {
    await tap('#btn-actions'); await W(1000); await shot('emote-wheel');
    await tap('#emo-wheel button'); await W(2000); await shot('emote');
    await close();
  });
  await run('dumper', async () => {
    await E(() => { const o = window.__oreum; o.trash.goHeap(3); o.snap(); o.dumpers.near('walker', 9); }); await W(2000); await shot('dumper');
    for (let i = 0; i < 4; i++) { if (mode === 'd') await press('f'); else await tap('#btn-ctx'); await W(1800); }
    console.log('dumpers', JSON.stringify(await E(() => window.__oreum.dumpers.state()))); await shot('dumper-hit');
  });
  await run('bloom', async () => {
    await E(() => { const o = window.__oreum; o.trash.clearZone(1); o.trash.goHeap(o.trash.heaps().findIndex((h) => h.zone === 1)); o.snap(); }); await W(4000); await shot('bloom');
    await E(() => window.__oreum.bloom.finish?.()); await W(1500); await shot('bloom-done');
  });
  await run('summit', async () => {
    await E(() => { const o = window.__oreum, v = o.spots.photo.stone, out = o.spots.photo.out; o.tp(v.x - out.x * 6, v.z - out.z * 6, Math.PI - 40 * Math.PI / 180, 0.02, 6, 0.25); }); await W(2500); await shot('summit-halla');
  });
  await run('menu', async () => {
    await close(); await tap('#btn-menu'); await W(1000); await shot('menu');
    for (const id of ['menu-ach', 'menu-dex', 'menu-wardrobe', 'menu-shop', 'menu-sign', 'menu-server', 'menu-help', 'menu-feedback', 'menu-notes']) {
      await E(() => { const m = document.getElementById('menu'); if (m.hidden) document.getElementById('btn-menu').click(); });
      await W(300); await E((id) => { const m = document.getElementById('menu-more'); const b = document.getElementById(id); if (b && b.offsetParent === null && m) m.click(); }, id); await W(200);
      await E((id) => document.getElementById(id)?.click(), id); await W(1200);
      const open = await E(() => [...document.querySelectorAll('.overlay, .panel, nav, #wardrobe, #look')].filter((e) => !e.hidden && getComputedStyle(e).display !== 'none' && e.id && !['topbar'].includes(e.id)).map((e) => e.id));
      console.log('open', id, JSON.stringify(open));
      if (['menu-ach', 'menu-wardrobe', 'menu-feedback', 'menu-help'].includes(id)) await shot(id);
      else { const u = await ui(); if (u.over?.length || u.spill?.length || u.panOut?.length) console.log('UI', id, JSON.stringify(u)); }
      await close(); await E(() => { const w = document.getElementById('wardrobe-done'); if (w && !document.getElementById('wardrobe').hidden) w.click(); }); await W(500);
    }
    // 어드민 설정
    await E(() => { document.getElementById('btn-menu').click(); }); await W(400);
    await E(() => { const m = document.getElementById('m-dev'); m.hidden = false; document.getElementById('adm-toggle').click(); }); await W(500); await shot('admin');
    await E(() => document.querySelector('#adm-body [data-h="18.3"]').click()); await W(1500); await close(); await W(800); await shot('admin-dusk');
    await E(() => document.getElementById('adm-real').click());
  });
  await run('reload', async () => {
    const before = await E(() => { const o = window.__oreum; return { coins: o.save.coins, tool: o.save.equip.tool, tut: o.save.tut.done }; });
    await E(() => window.__oreum.save && window.dispatchEvent(new Event('pagehide')));
    await p.reload(); await W(6000); await tap('#enter'); await W(800); await tap('#srv-go'); await W(4000);
    const after = await E(() => { const o = window.__oreum; return { coins: o.save.coins, tool: o.save.equip.tool, tut: o.save.tut.done }; });
    console.log('reload', JSON.stringify(before), '->', JSON.stringify(after)); await shot('reload');
  });
  await run('oldsave', async () => {
    // 예전 저장(#8 무렵 모양): 귤·장비 몇 개만 있는 저장으로 들어오기
    await E(() => { const KEY = 'oreumoreum.v1'; localStorage.setItem(KEY, JSON.stringify({ coins: 321, steps: 1000, equip: { tool: 2, bag: 1 }, outfit: { hat: 'cap', shirt: 'tee' }, tut: { step: 9, done: true }, visits: 3, wishes: {}, achDone: {}, ach: {} })); });
    await p.reload(); await W(6000); await tap('#enter'); await W(1000); await tap('#intro-srv button'); await W(300); await tap('#srv-go'); await W(4000);
    if (await E(() => !document.getElementById('look').hidden)) await tap('#look-ok');
    await W(1500); console.log('old', JSON.stringify(await E(() => { const o = window.__oreum; return { coins: o.save.coins, equip: o.save.equip, tut: o.save.tut }; }))); await shot('oldsave');
  });
  await run('battle', async () => {
    await E(() => { const o = window.__oreum; o.save.server = 'battle'; o.save.srvSwitch = 1; localStorage.setItem('oreumoreum.v1', JSON.stringify(o.save)); });
    await p.reload(); await W(6000); await tap('#enter'); await W(800); await tap('#srv-go'); await W(4000);
    await E(() => { document.getElementById('dev-tut').click(); document.getElementById('dev-gyul').click(); }); await W(800); await close();
    console.log('battle?', await E(() => window.__oreum.server.isBattle()));
    await E(() => { const o = window.__oreum; o.trash.goHeap(2); o.snap(); o.enemies?.test.spawn('boar', 7, 7); }); await W(2500); await shot('battle-boar');
    for (let i = 0; i < 3; i++) { if (mode === 'd') await press('f'); else await tap('#btn-ctx'); await W(1500); }
    console.log('enemies', JSON.stringify(await E(() => window.__oreum.enemies?.test.state()))); await shot('battle-hit');
    await E(() => { const o = window.__oreum; o.enemies?.test.spawn('dog', -40, -40); }); await W(1500); await shot('battle-offscreen');
    await E(() => { const o = window.__oreum; o.weapon.set(2); }); await W(500); await shot('battle-bow');
    await E(() => window.__oreum.hp.kill()); await W(4000); await shot('hp-down');
    await until(() => !window.__oreum.hp.isDown, 60000); await W(1500); await shot('hp-back');
  });
  console.log('REPORT', JSON.stringify({ mode, errs, report }));
  fs.writeFileSync(`dist/audit/report-${mode}.json`, JSON.stringify({ mode, errs, report }, null, 1));
  await b.close();
})();
