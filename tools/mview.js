// 어드민 '모바일 화면으로 보기'·어드민 창 탭 검사 (#220): node tools/mview.js [shot폴더]  (먼저 node build.mjs)
// dist 를 http 로 띄우고(틀이 같은 곳이어야 함), 서버 /me 를 흉내 내 어드민·보통 계정을 만든다
// - 보통 계정: ?m=1 도, 남아 있던 어드민 표시도 먹지 않음 (틀이 걷히고 표시가 지워짐)
// - 손님: ?m=1 먹지 않음
// - 어드민: 메뉴 '어드민 설정' → 창 하나, 탭 5개, 탭마다 1280×720 안에 들어감(창 안 스크롤 없음). 폰 세로에서도 탭마다 찍음
//   '폰 틀로 보기' 를 켜면 바깥은 틀만, 틀 안은 폰(390×844·터치 판정·떠다니는 스틱·모바일 튜토리얼 말). 마우스로 끌어 걷기 단계를 마침. 가로·끄기
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium, devices } = require('playwright');
const SHOT = process.argv[2] || '';
let fails = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
const DIST = path.resolve('dist'), SRV = 'https://oreumoreum.spacehwi.workers.dev';
const srv = http.createServer((q, r) => { const f = path.join(DIST, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
const tok = (sub) => 'x.' + Buffer.from(JSON.stringify({ s: sub })).toString('base64url') + '.y';
(async () => {
  await new Promise((res) => srv.listen(0, '127.0.0.1', res));
  const BASE = `http://127.0.0.1:${srv.address().port}/test.html`;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const mk = async (admin, opt = {}) => {
    const ctx = await b.newContext(opt.phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } });
    await ctx.route(SRV + '/**', (rt) => {
      const u = new URL(rt.request().url()), h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
      if (rt.request().method() === 'OPTIONS') return rt.fulfill({ status: 204, headers: h });
      if (u.pathname === '/me') return rt.fulfill({ status: 200, headers: h, contentType: 'application/json', body: JSON.stringify({ admin: admin === 'admin', keepUntil: Date.now() + 864e6, save: { coins: 50 }, rev: 0 }) });
      if (u.pathname === '/admin/online') return rt.fulfill({ status: 200, headers: h, contentType: 'application/json', body: JSON.stringify({ n: 1, login: 1, guest: 0, rooms: [] }) });
      return rt.fulfill({ status: 200, headers: h, contentType: 'application/json', body: '{}' });
    });
    const sess = admin ? JSON.stringify({ t: tok('fake-' + admin), exp: Date.now() + 864e5, srv: SRV, sub: 'fake-' + admin }) : null;
    await ctx.addInitScript(([s, pre]) => { if (sessionStorage.getItem('t.init')) return; sessionStorage.setItem('t.init', '1'); for (const k of ['oreumoreum.dev.sess', 'oreumoreum.v1.sess']) { if (s) localStorage.setItem(k, s); else localStorage.removeItem(k); } for (const [k, v] of Object.entries(pre || {})) localStorage.setItem(k, v); }, [sess, opt.pre || null]);
    const p = await ctx.newPage(); p.errs = 0;
    p.on('pageerror', (e) => { p.errs++; console.log('ERR', e.message.slice(0, 300)); });
    return { ctx, p };
  };
  const W = (p, ms) => p.waitForTimeout(ms);
  const until = async (fr, fn, ms, arg) => { const t1 = Date.now(); while (Date.now() - t1 < ms) { if (await fr.evaluate(fn, arg).catch(() => false)) return true; await new Promise((r) => setTimeout(r, 150)); } return false; };
  const ready = (fr, ms = 40000) => until(fr, () => !!window.__oreum?.ticks, ms);

  // ---- 손님: ?m=1 먹지 않음 ----
  { const { ctx, p } = await mk(null); await p.goto(BASE + '?m=1#namsongi'); await ready(p);
    ok(await p.evaluate(() => !document.getElementById('mview') && !document.body.classList.contains('touch') && localStorage.getItem('oreumoreum.mview') !== '1'), '손님: ?m=1 이 먹지 않음 (틀 없음·데스크톱 판정)');
    ok(p.errs === 0, '손님: 페이지 오류 없음'); await ctx.close(); }
  // ---- 보통 계정: 남은 어드민 표시가 있어도 /me 가 어드민 아님이면 걷힘 ----
  { const { ctx, p } = await mk('user', { pre: { 'oreumoreum.adm': '1', 'oreumoreum.mview': '1' } }); await p.goto(BASE + '?m=1#namsongi');
    ok(await until(p, () => !document.getElementById('mview') && !!window.__oreum?.ticks, 60000), '보통 계정: 남아 있던 표시로 틀이 떠도 어드민 아님이 확인되면 걷힘');
    ok(await p.evaluate(() => localStorage.getItem('oreumoreum.adm') === null && localStorage.getItem('oreumoreum.mview') === null && !document.body.classList.contains('touch') && document.getElementById('m-dev').hidden), '보통 계정: 표시 지워짐·데스크톱·어드민 메뉴 없음');
    await p.goto(BASE + '?m=1#namsongi'); await ready(p);
    ok(await p.evaluate(() => !document.getElementById('mview')), '보통 계정: 다시 ?m=1 해도 틀 없음'); await ctx.close(); }
  // ---- 어드민 ----
  const { ctx, p } = await mk('admin');
  await p.goto(BASE + '#namsongi'); await ready(p);
  ok(await until(p, () => !document.getElementById('m-dev').hidden && localStorage.getItem('oreumoreum.adm') === '1', 15000), '어드민: 메뉴에 어드민 설정·이 기기에 어드민 표시');
  await p.click('#enter').catch(() => {}); await W(p, 2500);
  if (await p.evaluate(() => !document.getElementById('look').hidden)) { await p.click('#look-ok').catch(() => {}); await W(p, 800); }
  const tabsCheck = async (pg, tag) => {
    await pg.evaluate(() => { document.getElementById('btn-menu').click(); }); await W(pg, 300);
    await pg.evaluate(() => document.getElementById('adm-toggle').click()); await W(pg, 400);
    ok(await pg.evaluate(() => !document.getElementById('admwin').hidden && document.getElementById('menu').hidden), `${tag} 어드민 설정 → 어드민 창 하나`);
    const tabs = await pg.evaluate(() => [...document.querySelectorAll('#admwin [data-tab]')].map((b) => b.dataset.tab));
    ok(tabs.length === 5, `${tag} 탭 5개 (${tabs.join(' ')})`);
    for (const t of tabs) {
      await pg.evaluate((t) => document.querySelector(`#admwin [data-tab="${t}"]`).click(), t); await W(pg, 250);
      const m = await pg.evaluate(() => { const pop = document.querySelector('#admwin .pop').getBoundingClientRect(), body = document.getElementById('adm-body'); const vis = [...document.querySelectorAll('#admwin [data-pane]')].filter((x) => !x.hidden).length; return { top: pop.top, bot: pop.bottom, h: innerHeight, sc: body.scrollHeight - body.clientHeight, vis }; });
      ok(m.vis === 1 && m.top >= 0 && m.bot <= m.h, `${tag} [${t}] 창이 화면 높이 안 (${Math.round(m.top)}~${Math.round(m.bot)} / ${m.h})`);
      ok(m.sc <= 2, `${tag} [${t}] 창 안 스크롤 없음 (넘친 ${m.sc}px)`);
      if (SHOT) await pg.screenshot({ path: `${SHOT}/admwin-${tag.replace(/\W/g, '')}-${t}.png` });
    }
    ok(await pg.evaluate(() => localStorage.getItem('oreumoreum.hwi.tab') === 'etc'), `${tag} 마지막 탭 기억`);
    ok(await pg.evaluate(() => { const r = document.getElementById('dev-reset'); const d = r.closest('.adm-sec'); return d.classList.contains('adm-dz') && d === d.parentElement.lastElementChild; }), `${tag} 위험(모두 리셋)은 맨 끝 붉은 칸`);
  };
  await tabsCheck(p, 'PC');
  await p.evaluate(() => document.querySelector('#admwin [data-tab="state"]').click()); await W(p, 1500);
  ok(await p.evaluate(() => { const b = document.getElementById('adm-onl'); return b.offsetHeight > 20 && /지금 접속/.test(b.textContent) && /1/.test(document.getElementById('adm-onl-n').textContent); }), 'PC [state] 지금 접속 줄이 보이고 수가 참');
  await p.evaluate(() => document.querySelector('#admwin [data-tab="gyul"]').click());
  ok(await p.evaluate(() => { const b = document.getElementById('adm-sub'); const hid = !/fake-admin/.test(b.textContent); b.click(); return hid && /fake-admin/.test(b.textContent); }), 'PC 계정 번호는 가려 두고 누르면 보임');
  // 폰 세로에서도 어드민 창 (진짜 폰 판정: 틀 스위치는 꺼져 있음)
  { const ph = await mk('admin', { phone: true }); await ph.p.goto(BASE + '#namsongi'); await ready(ph.p);
    await until(ph.p, () => !document.getElementById('m-dev').hidden, 15000);
    await ph.p.click('#enter').catch(() => {}); await W(ph.p, 2500);
    if (await ph.p.evaluate(() => !document.getElementById('look').hidden)) { await ph.p.click('#look-ok').catch(() => {}); await W(ph.p, 800); }
    if (await ph.p.evaluate(() => { const f = document.getElementById('fs-tip'); return f && !f.hidden; })) { await ph.p.click('#fs-tip-x').catch(() => {}); await W(ph.p, 300); }
    await tabsCheck(ph.p, '폰');
    ok(await ph.p.evaluate(() => document.getElementById('adm-mview').disabled), '폰: 진짜 터치 기기에서는 틀 스위치 꺼 둠');
    await ph.ctx.close(); }
  // 틀 켜기
  await p.evaluate(() => document.querySelector('#admwin [data-tab="try"]').click());
  await Promise.all([p.waitForEvent('load', { timeout: 30000 }).catch(() => {}), p.evaluate(() => document.getElementById('adm-mview').click())]);
  ok(await until(p, () => !!document.getElementById('mview-frame'), 15000), '스위치를 켜면 새로 고쳐 폰 틀');
  ok(await p.evaluate(() => !window.__oreum && getComputedStyle(document.getElementById('view') || document.body).display !== 'block'), '바깥 창은 게임을 돌리지 않음');
  const fr = () => p.frame({ url: /mframe=1/ });
  ok(!!fr() && await ready(fr()), '틀 안 게임이 읽힘');
  const inner = await fr().evaluate(() => ({ w: innerWidth, h: innerHeight, touch: document.body.classList.contains('touch'), st: getComputedStyle(document.documentElement).getPropertyValue('--safe-t').trim() }));
  ok(inner.w === 390 && inner.h === 844 && inner.touch, `틀 안은 폰 세로 390×844·터치 판정 (${inner.w}×${inner.h})`);
  ok(inner.st === '47px', `안전 영역 흉내 (--safe-t ${inner.st})`);
  await fr().click('#enter').catch(() => {}); await W(p, 2500);
  if (await fr().evaluate(() => !document.getElementById('look').hidden)) { await fr().click('#look-ok').catch(() => {}); await W(p, 1000); }
  if (await fr().evaluate(() => { const f = document.getElementById('fs-tip'); return f && !f.hidden; })) { await fr().click('#fs-tip-x').catch(() => {}); await W(p, 300); }
  ok(await until(fr(), () => window.__oreum.tut.step === 'walk', 15000), '틀 안 튜토리얼 걷기 단계');
  const say = await fr().evaluate(() => { const t = window.__oreum.tut.toast(); return t ? t.text : ''; });
  ok(/왼쪽 아래|끌어|스틱/.test(say) && !/WASD/.test(say), `모바일 튜토리얼 말 ("${say}")`);
  ok(await fr().evaluate(() => document.body.classList.contains('stick-float')), '떠다니는 스틱');
  if (SHOT) await p.screenshot({ path: `${SHOT}/mview-port.png` });
  // 마우스로 왼쪽 아래를 눌러 끌기 (틀 위치 + 틀 안 좌표)
  const box = await p.evaluate(() => { const r = document.getElementById('mview-frame').getBoundingClientRect(); return { x: r.left, y: r.top, k: r.width / 390 }; });
  const p0 = await fr().evaluate(() => [window.__oreum.player.pos.x, window.__oreum.player.pos.z]);
  ok(box.k > 0.7 && box.k < 0.9, `창(720)이 낮아 처음엔 80% (${box.k.toFixed(2)})`);
  const sx = box.x + 90 * box.k, sy = box.y + 700 * box.k;
  await p.mouse.move(sx, sy); await p.mouse.down(); await p.mouse.move(sx, sy - 40 * box.k, { steps: 4 });
  await W(p, 300);
  const joyOn = await fr().evaluate(() => document.getElementById('joy').classList.contains('float') && window.__oreum.joy?.active !== false);
  await p.mouse.move(sx, sy - 70 * box.k, { steps: 3 }); await W(p, 2500);
  const mid = await fr().evaluate(() => window.__oreum.tut.step);
  await W(p, 2500); await p.mouse.up(); await W(p, 600);
  const p1 = await fr().evaluate(() => [window.__oreum.player.pos.x, window.__oreum.player.pos.z]);
  ok(joyOn, '마우스 누른 자리에 스틱 바탕');
  ok(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 2, `마우스로 끌어 걸음 (${Math.hypot(p1[0] - p0[0], p1[1] - p0[1]).toFixed(1)}m)`);
  ok(await until(fr(), () => window.__oreum.tut.step !== 'walk', 8000) || mid !== 'walk', `걷기 단계를 마침 (지금 ${await fr().evaluate(() => window.__oreum.tut.step)})`);
  // 가로·80%
  await p.click('#mview [data-k="land"]'); await W(p, 1200);
  const land = await fr().evaluate(() => [innerWidth, innerHeight, getComputedStyle(document.documentElement).getPropertyValue('--safe-l').trim()]);
  ok(land[0] === 844 && land[1] === 390 && land[2] === '47px', `가로 844×390·안전 영역 왼쪽 (${land.join(' ')})`);
  await p.click('#mview [data-k="small"]'); await W(p, 400);
  ok(await p.evaluate(() => Math.round(document.getElementById('mview-ph').getBoundingClientRect().width) === 844), '80% 끄면 100% (844)');
  await p.click('#mview [data-k="small"]'); await W(p, 400);
  ok(await p.evaluate(() => Math.abs(document.getElementById('mview-ph').getBoundingClientRect().width - 844 * 0.8) < 2), '다시 80%');
  if (SHOT) await p.screenshot({ path: `${SHOT}/mview-land.png` });
  // 새로 고쳐도 유지 → 끄기
  await p.reload(); ok(await until(p, () => !!document.getElementById('mview-frame'), 15000), '새로 고쳐도 틀 유지');
  await Promise.all([p.waitForEvent('load', { timeout: 30000 }).catch(() => {}), p.click('#mview [data-k="off"]')]);
  ok(await ready(p) && await p.evaluate(() => !document.getElementById('mview') && !document.body.classList.contains('touch')), '끄기: 원래 데스크톱으로');
  ok(p.errs === 0, '어드민: 페이지 오류 없음');
  await b.close(); srv.close();
  console.log(fails ? `FAIL ${fails}` : 'ALL OK'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
