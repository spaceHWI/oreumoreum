// 내 가방 확인 (#166): node tools/bag.js [shot]
// dist/test.html 남송이에서 배낭 칸·B 키·메뉴·옛 입구(무기 ▾·탈것 ▾)가 내 가방의 어느 탭을 여는지, 탭마다 카드, 고르면 바로 장착, 받히면 닫힘, 옛 저장
// shot 을 주면 탭 5개를 폰 세로(390×844)·PC(1280×720)로 /tmp/claude-0/shots/bag-*.png 에
const { chromium } = require('playwright');
const SHOT = process.argv[2] === 'shot', OUT = process.env.SHOTS || '/tmp/claude-0/shots/';
if (SHOT) require('fs').mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
async function run(b, vp, tag, old) {
  const p = await b.newPage({ viewport: vp, hasTouch: tag === 'm', isMobile: tag === 'm' });
  const errs = []; p.on('pageerror', (e) => { errs.push(e.message); console.log('ERR', e.message.slice(0, 300)); });
  const E = (f, a) => p.evaluate(f, a), W = (t) => p.waitForTimeout(t);
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await E((old) => { const o = window.__oreum; Object.assign(o.save, { server: 'battle', entered: 1, look: { sex: 'm', skin: 0 }, tut: { step: 99, done: true, v: 3 }, jeong: 1, soundOff: 1 });
    if (old) { delete o.save.weaponUse; o.save.rides = { own: ['skate'], cur: 'skate' }; o.save.equip = { tool: 2, bag: 1, shoes: 1, weapon: 3 }; delete o.save.hairs; } // 옛 저장 비슷하게
    else { o.save.equip = { tool: 3, bag: 2, shoes: 2, weapon: 3 }; o.save.weaponUse = 3; o.save.rides = { own: ['skate', 'scooter'], cur: 'skate', walk: 0 }; }
    const k = Object.keys(localStorage).find((k) => k.startsWith('oreumoreum')) || 'oreumoreum.v1'; localStorage.setItem(k, JSON.stringify(o.save)); }, old);
  await p.reload(); await p.waitForFunction(() => window.__oreum && window.__oreum.renderer.info.render.frame > 2, null, { timeout: 120000 });
  await p.click('#enter', { timeout: 20000 }).catch(() => {}); await W(2500);
  await E(() => { const o = window.__oreum; try { o.pace.pacing.test.first.done = true; o.pace.pacing.test.first.bloomed = true; } catch (_) { /* 없음 */ } o.setTod?.(13); o.setWeather?.('clear'); document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; }); });
  const S = () => E(() => ({ ...window.__oreum.bag.s(), hidden: document.getElementById('wardrobe').hidden }));
  // 1. 배낭 칸
  await E(() => document.getElementById('bag-pill').click()); await W(400);
  let s = await S(); ok(s.open && !s.hidden, `${tag} 배낭 칸 → 내 가방 열림 (탭 ${s.tab})`);
  const tabs = await E(() => [...document.querySelectorAll('#bag-tabs button')].map((b) => [b.dataset.tab, Math.round(b.getBoundingClientRect().height)]));
  ok(tabs.length === 5 && tabs.every(([, h]) => h >= 44), `${tag} 탭 5개 높이 ${tabs.map((t) => t[1]).join(',')}`);
  // 2. 탭마다
  for (const t of ['wear', 'arm', 'tool', 'bag', 'ride']) {
    await E((t) => document.querySelector(`#bag-tabs [data-tab="${t}"]`).click(), t); await W(300);
    const n = await E(() => ({ cards: document.querySelectorAll('#bag-cards .bag-card').length, lock: document.querySelectorAll('#bag-cards .bag-card.lock, #wardrobe-body .wear-item.lock').length, wear: document.querySelectorAll('#wardrobe-body .wear-row').length, foot: document.querySelectorAll('#bag-foot .bs').length }));
    ok((t === 'wear' ? n.wear >= 7 : n.cards >= 2) && n.foot === 4, `${tag} ${t} 탭: 카드 ${n.cards} 옷 줄 ${n.wear} 잠김 ${n.lock} 능력 ${n.foot}`);
    if (SHOT) { await W(900); await p.screenshot({ path: `${OUT}bag-${tag}-${t}.png` }); }
  }
  // 3. 무기 고르기
  await E(() => document.querySelector('#bag-tabs [data-tab="arm"]').click()); await W(200);
  await E(() => document.querySelectorAll('#bag-cards button.bag-card')[0]?.click()); await W(200);
  ok(await E(() => window.__oreum.save.weaponUse === 1 && /손/.test(document.querySelector('#bag-cards .bag-card.on b')?.textContent || '')), `${tag} 무기 카드 → 바로 장착 (손)`);
  // 4. 탈것 고르기
  await E(() => document.querySelector('#bag-tabs [data-tab="ride"]').click()); await W(200);
  await E(() => document.querySelector('#bag-cards button.bag-card')?.click()); await W(200); // 걸어 다니기 말고 다른 가진 것
  ok(await E(() => document.querySelectorAll('#bag-cards .bag-card.on').length === 1), `${tag} 탈것 카드 → 고름 (${await E(() => window.__oreum.save.rides.cur + '/' + window.__oreum.save.rides.walk)})`);
  // 5. 잠긴 것 [사러 가기] → 창 닫고 가게로
  await E(() => document.querySelector('#bag-tabs [data-tab="tool"]').click()); await W(200);
  await E(() => document.querySelector('#bag-cards .bag-card.lock .go')?.click()); await W(400);
  s = await S(); ok(!s.open && s.hidden, `${tag} 잠긴 도구 [사러 가기] → 창 닫힘 (자동 걷기 ${await E(() => !!window.__oreum.cleanhouse?.autoState?.())})`);
  await E(() => window.__oreum.cleanhouse?.autoStop?.());
  // 6. B 키·옛 입구
  if (tag === 'p') { await p.keyboard.press('b'); await W(300); s = await S(); ok(s.open, 'B → 열림'); await p.keyboard.press('b'); await W(300); s = await S(); ok(!s.open, 'B → 닫힘'); }
  await E(() => window.__oreum.weapon?.open?.() ?? document.getElementById('arm-more').click()); await W(300); s = await S(); ok(s.open && s.tab === 'arm', `${tag} 무기 ▾ → 무기 탭`);
  await E(() => window.__oreum.bag.close()); await W(200);
  await E(() => document.getElementById('ride-more').click()); await W(300); s = await S(); ok(s.open && s.tab === 'ride', `${tag} 탈것 ▾ → 탈것 탭`);
  await E(() => window.__oreum.bag.close()); await W(200);
  await E(() => { document.getElementById('menu-wardrobe').click(); }); await W(300); s = await S(); ok(s.open && s.tab === 'wear', `${tag} 메뉴 내 가방 → 옷 탭`);
  await E(() => window.__oreum.bag.close()); await W(200);
  await E(() => document.getElementById('menu-ride').click()); await W(300); s = await S(); ok(s.open && s.tab === 'ride', `${tag} 메뉴 탈것 → 탈것 탭`);
  // 7. 받히면 닫힘
  await E(() => { const o = window.__oreum; o.player.iframe = 0; o.life.hooks.enemyHit(new o.THREE.Vector3(1, 0, 0), {}); }).catch(async () => { await E(() => window.__oreum.life?.hooks?.enemyHit?.({ x: 1, y: 0, z: 0, clone() { return this; } }, {})); });
  await W(300); s = await S(); ok(!s.open && s.hidden && s.mode !== 'wardrobe', `${tag} 받히면 닫힘 (카메라 ${s.mode})`);
  ok(errs.length === 0, `${tag}${old ? ' 옛 저장' : ''} 페이지 오류 ${errs.length}`);
  await p.close();
}
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  await run(b, SHOT ? { width: 1280, height: 720 } : { width: 800, height: 500 }, 'p', false);
  await run(b, { width: 390, height: 844 }, 'm', false);
  if (!SHOT) await run(b, { width: 800, height: 500 }, 'p', true);
  console.log(fails ? `실패 ${fails}` : '모두 통과');
  await b.close(); process.exit(fails ? 1 : 0);
})();
