// 가게 거리로 모은 사는 곳 확인 (#128): node tools/shops.js [--shot]
// 장비점 창(세 묶음·사기·장착)·가게 안내(목록·길 안내·도착하면 창)·지붕 간판 점·귤 칸 점·옛 상점 자리(메뉴·귤 칸·옷장·클린하우스 옆)
const { chromium, devices } = require('playwright');
const SHOT = process.argv.includes('--shot');
let fails = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const mode of ['d', 'm']) {
    const ctx = await b.newContext(mode === 'm' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } });
    const p = await ctx.newPage(); let errs = 0; p.on('pageerror', (e) => { errs++; console.log('ERR', e.message.slice(0, 300)); });
    const W = (ms) => p.waitForTimeout(ms), E = (f, a) => p.evaluate(f, a);
    const shot = (n) => SHOT && p.screenshot({ path: `dist/shop-${mode}-${n}.jpg`, type: 'jpeg', quality: 60, timeout: 150000 });
    await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await W(5000);
    await E(() => { const o = window.__oreum; Object.assign(o.save, { entered: 1, look: o.save.look || { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1 }); try { localStorage.removeItem('oreumoreum.shopSeen'); } catch (_) {} const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum.v')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); });
    await p.reload(); await W(5000); await p.click('#enter').catch(() => {}); await W(5000);
    if (await E(() => !document.getElementById('look').hidden)) { await p.click('#look-ok'); await W(1500); }
    await E(() => { const o = window.__oreum; o.setTod(14); o.save.coins = 50; o.save.equip.tool = 1; o.save.equip.bag = 0; o.save.equip.weapon = 1; o.save.weaponUse = 1; });
    const S = await E(() => { const o = window.__oreum; return { shops: o.street.shops.map((s) => s.id), tut: o.tut.active, ctx: o.interactables.filter((i) => i.label === '장비점' || i.label === '가게 안내').map((i) => i.label) }; });
    ok(S.shops.includes('gear'), `가게 거리에 장비점 (${S.shops.join(',')})`);
    ok(S.ctx.includes('가게 안내'), '안내도 상호작용');
    // 옛 자리 1: 클린하우스 옆 가판대는 튜토리얼 뒤 없음
    await E(() => window.__oreum.cleanhouse.go()); await E(() => { const o = window.__oreum, c = o.cleanhouse.api.shopFront; o.player.pos.set(c.x, o.groundAt(c.x, c.z), c.z); }); await W(800);
    ok(await E(() => window.__oreum.aim.ctx() !== 'shop'), `클린하우스 옆 가판대 없음 (상호작용 ${await E(() => window.__oreum.aim.ctx())})`);
    ok(await E(() => !window.__oreum.cleanhouse.api.mark.visible), '가판대 위 귤 표시 감춤');
    // 옛 자리 2: 귤 칸 → 가게 안내
    await p.click('#gyul-pill'); await W(700);
    ok(await E(() => window.__oreum.street.popNow() === 'dir'), '귤 칸 → 가게 안내');
    const dir = await E(() => [...document.querySelectorAll('#shoppop-cards .dir-card')].map((c) => c.dataset.shop + ':' + c.innerText.replace(/\s+/g, ' ')));
    console.log('  ', dir.join(' | ')); ok(dir.length >= 5, `안내 목록 ${dir.length}곳`);
    await shot('1-dir');
    // 고르면 장비점으로 걸어감 → 도착하면 장비점 창
    await p.click('#shoppop-cards .dir-card[data-shop="gear"]'); await W(500);
    ok(await E(() => !!window.__oreum.cleanhouse.autoState()), '장비점 골라 자동 걷기 시작');
    let arrived = false; for (let i = 0; i < 90 && !arrived; i++) { await W(1000); arrived = await E(() => window.__oreum.street.popNow() === 'gear'); }
    ok(arrived, '도착하면 장비점 창');
    // 옛 자리 3: 메뉴의 상점
    await E(() => { document.getElementById('shoppop').hidden = true; }); await p.click('#btn-menu'); await W(500); await p.click('#menu-shop'); await W(500);
    ok(await E(() => window.__oreum.street.popNow() === 'dir'), '메뉴 상점 → 가게 안내');
    // 가게 앞이면 바로 그 가게 창
    await p.click('#shoppop-cards .dir-card[data-shop="gear"]'); await W(500);
    ok(await E(() => window.__oreum.street.popNow() === 'gear'), '가게 앞에서 고르면 바로 창');
    const g = await E(() => ({ groups: [...document.querySelectorAll('#shoppop .buy-group')].map((x) => x.dataset.k), vis: [...document.querySelectorAll('#shoppop .buy-group')].filter((x) => x.getBoundingClientRect().width > 0).map((x) => x.dataset.k), tabs: !!document.querySelector('#shoppop-tabs button') && document.getElementById('shoppop-tabs').getBoundingClientRect().height > 0 }));
    ok(g.groups.join() === 'tool,bag,weapon', `세 묶음 ${g.groups}`);
    ok(mode === 'd' ? g.vis.length === 3 && !g.tabs : g.vis.length === 1 && g.tabs, `${mode === 'd' ? '데스크톱 나란히' : '폰 탭 하나씩'} (보임 ${g.vis}, 탭 ${g.tabs})`);
    ok(await E(() => /귤 더 필요/.test(document.querySelector('#shoppop .buy-group[data-k="weapon"] .buy-btn')?.textContent || '')), '모자라면 ○○귤 더 필요');
    await shot('2-gear');
    // 점: 귤을 채우면 장비점 지붕·귤 칸에 점, 창을 열면 지워짐
    await E(() => { document.getElementById('shoppop').hidden = true; const o = window.__oreum; o.save.coins = 99999; o.updateStats?.(); });
    const d1 = await E(() => window.__oreum.street.dots());
    ok(d1.gear && await E(() => window.__oreum.street.pillDot()), `새 물건 점 (지붕 ${JSON.stringify(d1)})`);
    await E(() => window.__oreum.street.open('gear')); await W(400);
    ok(!(await E(() => window.__oreum.street.dots())).gear, '장비점을 열면 점이 지워짐');
    // 무기 사기 → 장착
    if (mode === 'm') await p.click('#shoppop-tabs [data-tab="weapon"]'); await W(300);
    await p.click('#shoppop .buy-group[data-k="weapon"] .buy-card[data-i="1"] .buy-btn'); await W(500);
    ok(await E(() => window.__oreum.save.equip.weapon === 2 && window.__oreum.save.weaponUse === 2), '무기 사면 바로 장착');
    ok(await E(() => /장착했어요/.test(document.querySelector('#shoppop .buy-group[data-k="weapon"] .buy-card[data-i="1"]')?.textContent || '')), "카드에 '장착했어요'");
    await shot('3-bought');
    // 옛 자리 4: 내 가방 무기 탭의 안 가진 무기 → 장비점 길 안내 / 옷장 사러 가기 → LEAP
    await E(() => { document.getElementById('shoppop').hidden = true; window.__oreum.street.go(0, 2); }); await W(300);
    await E(() => window.__oreum.weapon.open()); await W(300); await p.click('#bag-cards .bag-card.lock .go'); await W(500);
    ok(await E(() => !!window.__oreum.cleanhouse.autoState()), '내 가방 무기 탭 안 가진 무기 [사러 가기] → 장비점으로 걸어감');
    await E(() => window.__oreum.cleanhouse.autoStop());
    await E(() => window.__oreum.street.goShop('leap')); await W(400);
    ok(await E(() => !!window.__oreum.cleanhouse.autoState()), 'LEAP 길 안내');
    await E(() => window.__oreum.cleanhouse.autoStop());
    // 지붕 간판 수
    ok(await E(() => Object.keys(window.__oreum.street.roof.signs).length) >= 5, '지붕 간판 5개');
    if (SHOT) { await E(() => { const o = window.__oreum; o.street.go(0, 2); o.player.heading = Math.atan2(o.street.layout.ax, o.street.layout.az); o.snap(); }); await W(2500); await shot('4-street'); }
    ok(errs === 0, `${mode} 페이지 오류 ${errs}`);
    await ctx.close();
  }
  console.log(fails ? `FAIL ${fails}` : 'ALL OK'); await b.close(); process.exit(fails ? 1 : 0);
})();
