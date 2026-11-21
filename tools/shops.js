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
    if (await E(() => { const f = document.getElementById('fs-tip'); return f && !f.hidden; })) { await p.click('#fs-tip-x').catch(() => {}); await W(400); } /* 폰: 전체 화면 안내(#189)가 처음 한 번 뜨며 화면을 덮음 (#193) */
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
    // 점: 귤을 채워도 지붕·귤 칸에 점이 없음 (#201, 받을 것이 있을 때만)
    await E(() => { document.getElementById('shoppop').hidden = true; const o = window.__oreum; o.save.coins = 99999; o.updateStats?.(); });
    const d1 = await E(() => window.__oreum.street.dots());
    ok(!Object.values(d1).some(Boolean) && !(await E(() => window.__oreum.street.pillDot())), `새 물건은 점을 띄우지 않음 #201 (지붕 ${JSON.stringify(d1)})`);
    await E(() => window.__oreum.street.open('gear')); await W(400);
    // 무기 사기 → 장착
    if (mode === 'm') await p.click('#shoppop-tabs [data-tab="weapon"]'); await W(300);
    /* 누르고 바로 카드 글을 읽음: '장착했어요' 는 1.7초만 보이는데, 느린 화면(소프트웨어 GL)에선 한 프레임이 1초 넘게 걸려 W(500) 뒤면 이미 지나감 (#193) */
    const justTxt = await E(() => { const q = () => document.querySelector('#shoppop .buy-group[data-k="weapon"] .buy-card[data-i="1"]'); q().querySelector('.buy-btn').click(); return q()?.textContent || ''; }); await W(500);
    ok(await E(() => window.__oreum.save.equip.weapon === 2 && window.__oreum.save.weaponUse === 2), '무기 사면 바로 장착');
    ok(/장착했어요/.test(justTxt), "카드에 '장착했어요'");
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
    // 지붕 간판 (#182): 들머리·골목 가운데·골목 끝(오름 쪽에서 돌아봄) 세 자리에서 다섯 간판이 화면 안에 있고 가려지지 않음(또는 맨 위에 그림)
    for (const [n, st, back] of [['4-street', 2, 0], ['5-mid', 24, 0], ['6-end', 47, 1]]) {
      await E(([st, back]) => { const o = window.__oreum, L = o.street.layout; o.street.go(0, st); o.player.heading = Math.atan2(L.ax, L.az) + (back ? Math.PI : 0); o.cam.yaw = o.player.heading + Math.PI; o.cam.pitch = 0.32; o.snap(); }, [st, back]); await W(1500);
      const v = await E(() => { const o = window.__oreum, R = o.street.roof, c = o.camObj, out = {}; c.updateMatrixWorld(); const seen = R.seen(c.position.clone());
        for (const [k, s] of Object.entries(R.signs)) { const q = s.pos.clone().project(c), inView = Math.abs(q.x) < 1 && Math.abs(q.y) < 1 && q.z < 1; out[k] = inView && (seen[k] || s.onTop) ? 'ok' : inView ? '가림' : '화면밖'; } return out; });
      const bad = Object.entries(v).filter(([k, r]) => r === '가림' || (mode === 'd' && r === '화면밖' && (n === '4-street' || (n === '6-end' && k !== 'stone')))); // 골목 가운데에선 앞 두 집이, 골목 끝에선 스톤이 등 뒤. 폰 세로 화면은 좁아 가림만 봄
      ok(!bad.length, `${n} 지붕 간판 보임 ${JSON.stringify(v)}`);
      await shot(n);
    }
    const R = await E(() => Object.fromEntries(Object.entries(window.__oreum.street.roof.signs).map(([k, s]) => [k, { y: +(s.pos.y - window.__oreum.height(s.x, s.z)).toFixed(2), top: +(s.top - window.__oreum.height(s.x, s.z)).toFixed(2), onTop: s.onTop }])));
    console.log('   지붕 간판 높이(땅에서 m)', JSON.stringify(R));
    ok(Object.values(R).every((r) => r.y - r.top >= 0.6 + 1.1), '지붕 간판이 건물 꼭대기 + 반지름 + 0.6m 위');
    ok(errs === 0, `${mode} 페이지 오류 ${errs}`);
    await ctx.close();
  }
  console.log(fails ? `FAIL ${fails}` : 'ALL OK'); await b.close(); process.exit(fails ? 1 : 0);
})();
