// 전체 검수 (#16): 첫 화면부터 끝까지 한 바퀴. 단계마다 화면을 찍고 콘솔 오류·UI 겹침·글자 넘침을 모은다
//   node tools/audit.js [d|m] [clean|battle]   → dist/audit/<d|m>-<srv>-<nn>-<이름>.jpg, 끝에 요약
//   d = 데스크톱 1440×900, m = 폰 390×844 터치. 튜토리얼은 tools/tutrun.js 가 따로 돈다 (여기선 건너뜀)
const { chromium } = require('playwright');
const fs = require('fs');
const mode = process.argv[2] || 'd', srv = process.argv[3] || 'clean';
const OUT = 'dist/audit'; fs.mkdirSync(OUT, { recursive: true });
// 겹침을 볼 HUD 요소 (보일 때만)
const HUD = ['topbar', 'toast', 'tip', 'banner', 'tut-hint', 'ch-arrow', 'shop-arrow', 'cart-mark', 'shop-mark', 'joy', 'btn-ctx', 'btn-pick', 'btn-jump', 'btn-ride', 'btn-speed', 'btn-actions', 'btn-chat', 'btn-ach', 'btn-menu', 'hp-bar', 'buff-pill', 'zone-pill', 'bloom-banner', 'sitbar', 'ammo', 'ride-pick', 'countdown', 'hp-wait', 'btn-cancelreq', 'emo-wheel'];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext(mode === 'm' ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage(); const errs = [], notes = []; let n = 0, step = '';
  p.on('pageerror', (e) => { errs.push(`[${step}] ${e.message.slice(0, 200)}`); console.log('ERR', step, e.message.slice(0, 200)); });
  p.on('console', (m) => { if (m.type() === 'error' && !/429|open-meteo|Failed to load resource/.test(m.text())) { errs.push(`[${step}] con ${m.text().slice(0, 200)}`); console.log('CON', step, m.text().slice(0, 200)); } });
  const W = (ms) => p.waitForTimeout(ms);
  const O = (fn, arg) => p.evaluate(fn, arg).catch((e) => { notes.push(`[${step}] eval 실패 ${e.message.slice(0, 120)}`); return null; });
  // 보이는 HUD 요소끼리 겹침, 화면 밖, 글자 넘침
  const ui = () => p.evaluate((HUD) => {
    const vis = (el) => { if (!el || el.hidden) return false; for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (e.hidden || s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; } const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
    const els = HUD.map((id) => [id, document.getElementById(id)]).filter(([, e]) => vis(e)), out = [];
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const [a, ea] = els[i], [c, ec] = els[j]; if (ea.contains(ec) || ec.contains(ea)) continue;
      const A = ea.getBoundingClientRect(), C = ec.getBoundingClientRect(); const ox = Math.min(A.right, C.right) - Math.max(A.left, C.left), oy = Math.min(A.bottom, C.bottom) - Math.max(A.top, C.top);
      if (ox > 4 && oy > 4) out.push(`겹침 ${a}×${c} ${Math.round(ox)}×${Math.round(oy)}`);
    }
    for (const [id, e] of els) { const r = e.getBoundingClientRect(); if (r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1 || r.top < -1) out.push(`화면 밖 ${id} (${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)})`); }
    // 글자 넘침: 보이는 창·HUD 안의 글자 요소
    document.querySelectorAll('button, .pill, h2, h3, p, span, b, label').forEach((e) => { if (!vis(e) || !e.textContent.trim() || e.children.length > 2) return; const s = getComputedStyle(e); if (s.overflow === 'visible' && s.textOverflow !== 'ellipsis' && e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0 && s.whiteSpace === 'nowrap') out.push(`글자 넘침 ${e.id || e.className || e.tagName}: ${e.textContent.trim().slice(0, 20)}`); });
    return out;
  }, HUD).catch(() => []);
  const shot = async (name) => {
    const f = `${OUT}/${mode}-${srv}-${String(++n).padStart(2, '0')}-${name}.jpg`;
    await p.screenshot({ path: f, type: 'jpeg', quality: 55, timeout: 180000 }).catch((e) => notes.push(`[${name}] 화면 실패 ${e.message.slice(0, 60)}`));
    const u = await ui(); u.forEach((x) => notes.push(`[${name}] ${x}`)); console.log('shot', name, u.join(' | '));
  };
  const S = async (name, fn) => { step = name; try { await fn(); } catch (e) { notes.push(`[${name}] 실패 ${e.message.slice(0, 160)}`); console.log('FAIL', name, e.message.slice(0, 160)); } };
  const tap = async (sel) => { if (mode === 'm') await p.tap(sel, { timeout: 30000 }); else await p.click(sel, { timeout: 30000 }); };
  const key = async (k, ms = 90) => { await p.keyboard.down(k); await W(ms); await p.keyboard.up(k); };
  const closeAll = () => O(() => { ['shop', 'sign', 'wishes', 'chat', 'actions', 'menu', 'ach', 'dex', 'feedback', 'notes', 'server', 'shoppop', 'photo', 'wardrobe'].forEach((id) => { const e = document.getElementById(id); if (e) e.hidden = true; }); });
  const until = async (fn, ms = 8000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await W(250); } return false; };

  await S('title', async () => { await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await W(7000); await shot('title'); });
  await S('server', async () => { await tap('#enter'); await W(1200); await shot('server'); await tap(`#intro-srv [data-srv="${srv}"]`); await W(500); await tap('#srv-go'); await W(5000); });
  await S('look', async () => { if (await O(() => !document.getElementById('look').hidden)) { await shot('look'); await tap('#look-ok'); await W(1500); } else notes.push('[look] 캐릭터 고르기 창이 안 뜸'); });
  await S('skip-tut', async () => { await O(() => { const o = window.__oreum; o.tut.skipAll(); o.setTod(14); o.save.coins += 30000; o.persist?.(); }); await W(2500); await shot('start'); });

  // 3. 더미 치우기 → 배낭 가득 → 가까운 클린하우스 → 귤
  await S('heap', async () => {
    const hi = await O(() => { const o = window.__oreum, l = o.trash.heaps(); const h = l.find((x) => x.zone === 1 && x.left > 0); o.trash.goHeap(h.i); o.snap(); return h.i; });
    await W(1500); await shot('heap');
    await p.keyboard.down('e'); await until(() => { const s = window.__oreum.trash.state(); return s.vol >= s.cap; }, 25000); await p.keyboard.up('e'); await W(800);
    const st = await O(() => window.__oreum.trash.state()); notes.push(`[heap] 주운 뒤 배낭 ${st.vol}/${st.cap}`); await shot('bag-full');
    const near = await O(() => window.__oreum.cleanhouse.route()); notes.push(`[heap] 가까운 클린하우스 ${JSON.stringify(near)}`);
  });
  await S('dump', async () => {
    await O(() => { const o = window.__oreum, r = o.cleanhouse.route(); const i = o.cleanhouse.minis().findIndex((c) => c.id === r?.id); if (i >= 0) o.cleanhouse.goMini(i); else o.cleanhouse.go(); o.snap(); });
    await W(1500); await until(() => window.__oreum.aim.ctx() === 'dump', 15000); // 헤드리스는 초당 몇 프레임이라 상호작용 대상이 늦게 잡힘 (#90)
    const c0 = await O(() => window.__oreum.save.coins); await key('f'); await until((c) => window.__oreum.save.coins > c, 20000, c0);
    const c1 = await O(() => window.__oreum.save.coins); notes.push(`[dump] 귤 ${c0} → ${c1}`); if (!(c1 > c0)) notes.push('[dump] 버려도 귤이 늘지 않음'); await shot('dump');
  });
  // 4. 가게
  await S('stall', async () => { await O(() => window.__oreum.cleanhouse.openShop('tool')); await W(1200); await shot('shop-tool'); for (const t of ['bag', 'shoes', 'weapon']) { await O((t) => document.querySelector(`#shop-tabs [data-tab="${t}"]`)?.click(), t); await W(500); } await shot('shop-last-tab'); await closeAll(); });
  for (const [id, f] of [['leap', 'leap'], ['salon', 'salon'], ['stone', 'stone'], ['ride', 'rides']]) {
    await S('shop-' + id, async () => { await O((f) => { const o = window.__oreum; if (f === 'rides') { o.street.go(1); o.rides.open(); } else { o[f].go?.(); o[f].open(); } o.snap(); }, f); await W(2200); await shot('pop-' + id); await O(() => document.getElementById('shoppop-close')?.click()); await W(600); await closeAll(); });
  }
  await S('street', async () => { await O(() => { const o = window.__oreum; o.street.go(0, 0.5); o.snap(); }); await W(1800); await shot('street'); });
  // 5. 탈것·마차·낚시·사진사·돌탑·동작
  await S('ride', async () => { await O(() => { const o = window.__oreum; o.cleanhouse.go(); o.rides.give('horse'); o.rides.mount('horse'); o.snap(); }); await W(1800); await shot('ride-horse'); const s = await O(() => window.__oreum.rides.state()); notes.push(`[ride] ${JSON.stringify({ ride: s?.ride, zone: s?.zone })}`); await O(() => window.__oreum.rides.off()); await W(800); });
  await S('cart', async () => { const ok = await O(() => { const o = window.__oreum; if (!o.rides.cart) return 'no cart'; o.rides.cart.at(0); o.rides.cart.goStop(0); o.snap(); return 'ok'; }); await W(1500); await O(() => window.__oreum.rides.cart?.board()); await W(2000); await shot('cart'); notes.push(`[cart] ${ok} ${JSON.stringify(await O(() => window.__oreum.rides.cart?.state()))}`.slice(0, 200)); await O(() => window.__oreum.rides.cart?.leave(true)); await W(800); });
  await S('fish', async () => { await O(() => { const o = window.__oreum; o.fish.go(-1, 3); o.snap(); }); const can = await until(() => window.__oreum.fish.can(), 20000); /* 마차에서 뛰어내린 직후라 땅에 닿을 때까지 기다림 */ if (!can) notes.push('[fish] 개울 옆인데 낚시 불가'); await O(() => { const o = window.__oreum; o.fish.wait(1); o.fish.press(); }); await W(2500); await shot('fish'); await O(() => window.__oreum.fish.api.stop()); await W(1000); });
  await S('photo', async () => { await O(() => { const o = window.__oreum, g = o.photo.photog; if (g?.pos) { o.player.pos.set(g.pos.x + 2, o.groundAt(g.pos.x + 2, g.pos.z), g.pos.z); o.snap(); } o.photo.start(); }); await W(6000); await shot('photo'); await O(() => window.__oreum.photo.close()); await W(500); await closeAll(); });
  await S('cairn', async () => { await O(() => { const o = window.__oreum, c = o.cairns[0]; o.player.pos.set(c.pos.x + 1.6, o.groundAt(c.pos.x + 1.6, c.pos.z), c.pos.z); o.player.heading = -Math.PI / 2; o.snap(); }); await W(1200); await key('f'); await W(1200); await shot('cairn'); await closeAll(); });
  await S('emote', async () => { await tap('#btn-actions'); await W(900); await shot('emote-wheel'); await closeAll(); await O(() => window.__oreum.doEmote?.('wave')); await W(1200); });
  // 6. 투기꾼·전투
  await S('dumper', async () => { await O(() => { const o = window.__oreum; o.cleanhouse.go(); const h = o.trash.heaps().find((x) => x.zone === 1); o.dumpers?.spawn('walker', h.i); o.trash.goHeap(h.i); o.snap(); }); await W(3000); await shot('dumper'); const st = await O(() => window.__oreum.dumpers?.state()); notes.push(`[dumper] ${JSON.stringify(st)}`.slice(0, 200)); await O(() => window.__oreum.dumpers?.hit(0)); await W(2000); await shot('dumper-hit'); await O(() => window.__oreum.dumpers?.clear()); });
  if (srv === 'battle') {
    await S('mob', async () => { await O(() => { const o = window.__oreum; const h = o.trash.heaps().find((x) => x.zone === 2); o.trash.goHeap(h.i); o.snap(); o.enemies.test.spawn('boar', 7, 7); o.enemies.test.spawn('dog', -40, 5); }); await W(2500); await shot('mob-target'); await key('f'); await W(1500); await shot('mob-throw'); notes.push(`[mob] ${JSON.stringify(await O(() => window.__oreum.enemies.test.state()))}`.slice(0, 220)); });
    await S('bow', async () => { await O(() => { const o = window.__oreum; o.weapon.set(2); }); await W(300); await key('f'); await W(1500); await shot('bow'); });
    await S('hp', async () => { await O(() => window.__oreum.hp.set(Math.ceil(window.__oreum.hp.max * 0.3))); await W(800); await shot('hp-low'); await O(() => window.__oreum.hp.kill()); await W(4000); await shot('down'); await until(() => !window.__oreum.hp.isDown, 30000); await W(1500); await shot('after-down'); await O(() => window.__oreum.enemies.test.clear()); });
  }
  // 7. 구역 꽃밭·정상·한라산
  await S('bloom', async () => { await O(() => { const o = window.__oreum; o.trash.clearZone(1); }); await W(1500); await O(() => { const o = window.__oreum; o.bloom?.finish?.(); const h = o.trash.heaps().find((x) => x.zone === 1); o.trash.goHeap(h.i); o.snap(); }); await W(3000); await shot('bloom'); });
  await S('summit', async () => { await O(() => { const o = window.__oreum, h = o.trash.heaps().filter((x) => x.zone === 5)[0]; o.trash.goHeap(h.i); o.snap(); }); await W(2500); await shot('summit'); });
  await S('halla', async () => { await O(() => { const o = window.__oreum, h = o.trash.heaps().filter((x) => x.zone === 5)[0]; o.tp(h.x, h.z, Math.PI * 0.75, 0.05, 10); }); await W(2500); await shot('halla'); });
  // 8. 메뉴의 모든 창·어드민·의견
  await S('menu', async () => {
    await closeAll(); await O(() => { window.__oreum.cleanhouse.go(); window.__oreum.snap(); }); await W(800);
    await tap('#btn-menu'); await W(900); await shot('menu');
    const ids = await O(() => [...document.querySelectorAll('#menu button[id^="menu-"]')].filter((e) => !e.hidden && e.offsetParent).map((e) => e.id));
    for (const id of ids || []) {
      if (['menu-reset'].includes(id)) continue;
      await O(() => { document.getElementById('menu').hidden = false; }); await O((id) => document.getElementById(id).click(), id); await W(700);
      const open = await O(() => ['shop', 'sign', 'wishes', 'chat', 'ach', 'dex', 'feedback', 'notes', 'server', 'shoppop', 'wardrobe', 'intro'].filter((k) => { const e = document.getElementById(k); return e && !e.hidden; }));
      notes.push(`[menu] ${id} → ${(open || []).join(',') || '-'}`);
      if (['menu-feedback', 'menu-dex', 'menu-wardrobe', 'menu-ach', 'menu-notes'].includes(id)) await shot(id);
      const u = await ui(); u.forEach((x) => notes.push(`[${id}] ${x}`));
      await O(() => { ['shop-close', 'sign-close', 'ach-close', 'dex-close', 'feedback-close', 'notes-close', 'server-close', 'shoppop-close', 'wardrobe-done'].forEach((c) => { const e = document.getElementById(c); if (e && e.offsetParent) e.click(); }); if (!document.getElementById('intro').hidden) document.getElementById('enter').click(); });
      await W(400); await closeAll();
    }
  });
  await S('admin', async () => { await O(() => { document.getElementById('menu').hidden = false; const t = document.getElementById('adm-toggle'); if (t && document.getElementById('adm-body').hidden) t.click(); }); await W(600); await shot('admin'); await O(() => document.querySelector('#adm-body [data-h]')?.click()); await W(600); await closeAll(); });
  // 9. 새로 고침 뒤 이어 하기, 예전 저장
  await S('reload', async () => {
    const before = await O(() => ({ coins: window.__oreum.save.coins, tut: window.__oreum.save.tut.done }));
    await p.reload(); await W(7000); await shot('reload-title'); await tap('#enter').catch(() => {}); await W(5000);
    const after = await O(() => ({ coins: window.__oreum.save.coins, tut: window.__oreum.save.tut.done, look: !document.getElementById('look').hidden, srv: !document.getElementById('intro-step')?.hidden }));
    notes.push(`[reload] 전 ${JSON.stringify(before)} 뒤 ${JSON.stringify(after)}`); await shot('reload-in');
  });
  await S('old-save', async () => {
    // 아주 예전 저장 (#31 이전 꼴): 튜토리얼 버전·배낭·옷·탈것 필드가 없음
    await O(() => { for (const k of Object.keys(localStorage)) if (/oreum/.test(k) && /^\{/.test(localStorage.getItem(k) || '')) { const old = { nick: '예전 사람', coins: 321, equip: { tool: 3 }, outfit: { hat: { type: 'cap', color: '#222222' } }, owned: { 'shirt:tee:#ff0000': 1 }, totalSteps: 999, nsV1: 1, ach: { done: {} }, server: 'clean' }; localStorage.setItem(k, JSON.stringify(old)); } });
    await p.reload(); await W(7000); await tap('#enter').catch(() => {}); await W(1000); await O(() => document.querySelector('#intro-srv [data-srv]')?.click()); await tap('#srv-go').catch(() => {}); await W(5000);
    if (await O(() => !document.getElementById('look').hidden)) { await tap('#look-ok'); await W(1500); }
    notes.push(`[old-save] ${JSON.stringify(await O(() => { const s = window.__oreum.save; return { coins: s.coins, equip: s.equip, tut: s.tut, wear: s.clothes?.wear }; }))}`); await shot('old-save');
  });
  console.log('\n== 오류 =='); errs.forEach((e) => console.log(e));
  console.log('== 메모 =='); notes.forEach((e) => console.log(e));
  fs.writeFileSync(`${OUT}/${mode}-${srv}.json`, JSON.stringify({ errs, notes }, null, 1));
  await b.close();
})();
