// 크리스마스 철 이벤트 확인 (#180). node tools/xmas.js [--shot]
//   어드민 미리 보기로 켜서: 꾸밈 수·트리 단계·달력 열기(오늘 무료·지난 날 귤)·선물 상자·산타 투기꾼·눈덩이(느려짐)·옛 저장·끄면 그대로인지
//   --shot: 낮·밤 트리(들머리)·가게 거리 전구·정상 눈을 dist/xmas-*.jpg 로 (작게)
const { chromium } = require('playwright');
const SHOT = process.argv.includes('--shot');
const LA = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch({ args: LA });
  const p = await b.newPage({ viewport: { width: 640, height: 400 } }); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  await p.addInitScript(() => { try { localStorage.setItem('oreumoreum.hwi.season', 'on'); } catch (e) {} });
  await p.goto('file://' + process.cwd() + '/dist/test.html#namsongi'); await p.waitForTimeout(5000);
  await p.click('#enter').catch(() => {}); await p.waitForTimeout(2500);
  await p.evaluate(() => { const o = window.__oreum; o.tut.skipAll?.(); o.save.tut = { ...(o.save.tut || {}), done: true }; if (!o.save.look) o.look.close?.(); });
  await p.waitForTimeout(1500);
  let s = await p.evaluate(() => window.__oreum.season.state());
  ok(s.on, '켜짐 (어드민 미리 보기)');
  ok(s.decoN && s.decoN.bulbs > 50 && s.decoN.wreaths >= 3 && s.decoN.hats >= 1, `꾸밈 전구 ${s.decoN?.bulbs} · 리스 ${s.decoN?.wreaths} · 하르방 모자 ${s.decoN?.hats}`);
  ok(s.snow && s.snow[4] > 0.5 && s.snow[5] > 0.5 && s.snow[1] === 0, '굼부리·정상에만 눈 ' + JSON.stringify(s.snow?.map((v) => +v.toFixed(2))));
  // 트리 단계
  const st = await p.evaluate(() => { const S = window.__oreum.season; S.total(3000 * 4 + 10); return S.state().stage; });
  ok(st === 4, '트리 4단계 (합계 12,010)');
  // 달력: 오늘은 무료, 지난 날은 귤 50
  const r = await p.evaluate(() => { const o = window.__oreum, S = o.season, d = S.state().calDay; o.save.coins = 100; const c0 = o.save.coins; const a = S.day(d); const c1 = o.save.coins; const b2 = d > 1 ? S.day(d - 1) : null; const c2 = o.save.coins; const again = S.day(d); return { d, a, b2, again, c0, c1, c2, days: S.state().xs.days }; });
  ok(r.a && !r.again && r.days.includes(r.d), `달력 오늘(${r.d}일) 열기 → 귤 ${r.c0}→${r.c1}, 다시 못 엶`);
  if (r.d > 1) ok(r.b2 && r.days.includes(r.d - 1), `지난 날(${r.d - 1}일) 귤 50 으로 열기 → ${r.c1}→${r.c2}`);
  const fut = await p.evaluate(() => { const S = window.__oreum.season; return S.day(Math.min(25, S.state().calDay + 1)); });
  ok(!fut, '앞날은 못 엶');
  // 선물 상자: 줍기
  const g = await p.evaluate(async () => { const o = window.__oreum, S = o.season, c0 = o.save.coins; S.gift(o.player.pos.x + 0.5, o.player.pos.z); await new Promise((r) => setTimeout(r, 600)); return { left: S.state().gifts, gain: o.save.coins - c0, gn: S.state().xs.gn, gift: S.state().xs.gift }; });
  ok(g.left === 0 && (g.gain >= 20 || g.gift.length === 1) && g.gn === 1, `선물 상자 열림 (귤 +${g.gain}, 옷 ${g.gift.join(',') || '-'})`);
  // 산타 투기꾼
  const sa = await p.evaluate(async () => { const o = window.__oreum; o.dumpers.clear(); const spawned = !!o.dumpers.api.come('walker', { heap: 0 }); o.season.santa(); const santa = o.dumpers.api.list.some((d) => d.santa); const g0 = o.season.state().gifts; o.dumpers.hit(0); return { spawned, santa, gifts: o.season.state().gifts - g0 }; });
  ok(!sa.spawned || (sa.santa && sa.gifts === 1), `산타 투기꾼 차림·쫓으면 선물 상자 (나옴 ${sa.spawned}, 상자 ${sa.gifts})`);
  // 눈덩이: 25일을 열고 정상에서 손 던지기
  const sn = await p.evaluate(async () => {
    const o = window.__oreum, xs = o.save.season.xmas; if (!xs.days.includes(25)) xs.days.push(25); xs.snow = 1; o.weapon.use(1);
    const sp = o.spots.photo.stone; o.player.pos.set(sp.x + 3, o.height(sp.x + 3, sp.z), sp.z); await new Promise((r) => setTimeout(r, 300));
    const ready = o.season.state().snowReady; const n0 = o.life.tangerines.length; o.aim.throw(); await new Promise((r) => setTimeout(r, 900));
    const tg = o.life.tangerines.slice(n0); return { ready, snowFlying: tg.some((t) => t.snow), n: tg.length };
  });
  ok(sn.ready, '정상에서 눈덩이 준비됨');
  const slow = await p.evaluate(() => { const o = window.__oreum; const e = { slowT: 0 }; o.life.hooks.snowHit(e, o.player.pos.clone()); return e.slowT > 1 && e.slowK > 0.1; });
  ok(slow, '눈덩이 맞으면 느려짐 값');
  // 끄기 → 꾸밈 숨김
  const off = await p.evaluate(() => { const S = window.__oreum.season; S.mode('off'); const s = S.state(); return { on: s.on, vis: window.__oreum.scene.getObjectByName('xmas')?.visible, menu: document.getElementById('menu-xmas').hidden }; });
  ok(!off.on && off.vis === false && off.menu, '끄면 꾸밈·메뉴 숨김');
  if (process.argv.includes('--perf')) { // 꾸밈 그룹을 껐다 켜며 같은 자리에서 draw call·삼각형 (맑은 밤, 프레임 8개씩 4번 중 가운데 값)
    await p.evaluate(() => { const o = window.__oreum; o.season.mode('on'); o.setWeather('clear'); });
    for (const [name, fn] of [['들머리 트리', `{ const t = o.season.treePos(); o.season.total(30000); o.player.pos.set(t.x + 9, o.height(t.x + 9, t.z + 3), t.z + 3); }`], ['가게 거리', `o.street.go(0, 4)`], ['정상', `{ const sp = o.spots.photo.stone; o.player.pos.set(sp.x + 6, o.height(sp.x + 6, sp.z + 4), sp.z + 4); }`]]) {
      await p.evaluate((f) => { const o = window.__oreum; document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; }); o.setTod(22); eval(f); o.snap(); }, fn);
      await p.waitForTimeout(2500);
      const m = { off: [], on: [] };
      for (let k = 0; k < 8; k++) {
        const vis = k % 2 === 1;
        const r = await p.evaluate(async (v) => { const o = window.__oreum; o.scene.getObjectByName('xmas').visible = v; const r = o.renderer.info.render; let c = 0, t = 0; for (let i = 0; i < 8; i++) { await new Promise((q) => requestAnimationFrame(q)); c = Math.max(c, r.calls); t = Math.max(t, r.triangles); } return { c, t }; }, vis);
        m[vis ? 'on' : 'off'].push(r);
      }
      const med = (a, k) => a.map((x) => x[k]).sort((x, y) => x - y)[a.length >> 1];
      console.log(`perf ${name}: draw call ${med(m.off, 'c')} → ${med(m.on, 'c')}, 삼각형 ${med(m.off, 't')} → ${med(m.on, 't')}`);
    }
  }
  if (SHOT) {
    await p.evaluate(() => window.__oreum.season.mode('on'));
    const go = async (name, tod, fn) => { await p.evaluate(([t, f]) => { const o = window.__oreum; document.querySelectorAll('.overlay').forEach((e) => { e.hidden = true; }); o.setTod(t); eval(f); o.snap(); }, [tod, fn]); await p.waitForTimeout(2500); await p.screenshot({ path: `dist/xmas-${name}.jpg`, type: 'jpeg', quality: 70 }); };
    const tree = `{ const t = o.season.treePos(); o.season.total(30000); o.player.pos.set(t.x + 9, o.height(t.x + 9, t.z + 3), t.z + 3); o.player.heading = Math.atan2(t.x - o.player.pos.x, t.z - o.player.pos.z); }`;
    await go('tree-day', 13, tree); await go('tree-night', 22, tree);
    await go('street-night', 22, `{ o.street.go(0, 4); o.cam.dist = 7; }`);
    await go('summit', 13, `{ const sp = o.spots.photo.stone; o.player.pos.set(sp.x + 6, o.height(sp.x + 6, sp.z + 4), sp.z + 4); }`);
  }
  const bad = errs.filter((e) => !/GSI_LOGGER|Failed to load resource|WebSocket|CORS/.test(e)); // file:// 의 구글 로그인·서버 요청 실패는 빼고
  ok(!bad.length, '페이지 오류 없음' + (bad.length ? ': ' + bad.slice(0, 3).join(' | ') : ''));
  await b.close();
})();
