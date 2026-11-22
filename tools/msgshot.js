// 메시지 줄 확인 (#252)
//   node tools/msgshot.js          (먼저 node build.mjs) → 그림 tools/out/msg-<폭>x<높이>.png
// 폰 세로(360×640, 390×844)·PC(1280×720): 메시지 6개를 0.3초 간격으로 → 보이는 줄 ≤ MSG.max, 줄끼리·버튼·조이스틱·퀘스트 줄·위쪽 줄과 겹치지 않음, 같은 높이,
// 오래된 것부터 사라짐, 같은 글은 ×N 으로 합침, 고정 한 줄(터 밖)은 로그 위, 증강 창이 뜨면 감추고 닫히면 최근 3개
const path = require('path'), fs = require('fs');
const ok = (c, m) => { console.log((c ? '통과 ' : '실패 ') + m); if (!c) process.exitCode = 1; };
const SIZES = [[360, 640, true], [390, 844, true], [1280, 720, false]];
(async () => {
  const { chromium } = require('playwright');
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const outDir = path.join(__dirname, 'out'); fs.mkdirSync(outDir, { recursive: true });
  for (const [w, h, touch] of SIZES) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
    await pg.goto('file://' + path.join(__dirname, '../dist/test.html') + '#namsongi'); await pg.waitForTimeout(6000);
    await pg.evaluate(() => { const o = window.__oreum; o.save.entered = 1; o.save.look = { sex: 'm', skin: 0 }; o.save.nick = '메시지'; o.save.nickSet = 1; o.save.nsV1 = 1; o.save.nsV2 = 1; o.save.nsV3 = 1; o.save.tut = { step: 99, done: true, v: 4 }; o.save.jeong = 1; o.save.soundOff = 1; o.persist?.(); });
    await pg.reload(); await pg.waitForTimeout(6000);
    await pg.click('#enter').catch(() => {}); await pg.waitForTimeout(3500);
    await pg.evaluate(() => { const o = window.__oreum; if (!document.getElementById('look').hidden) o.look?.close?.(); if (o.tut?.active) o.tut.skipAll(); o.cam.mode = 'follow'; for (const id of ['tut-toast', 'intro-help', 'intro']) { const e = document.getElementById(id); if (e) e.hidden = true; } o.msglog.clear(); });
    const tag = `${w}×${h}`;
    const r = await pg.evaluate(async () => {
      const o = window.__oreum, W = (ms) => new Promise((res) => setTimeout(res, ms));
      const texts = ['귤 +3', '빈 캔을 주웠어요', '뱃지 · 첫 줍기', '들판 북쪽 · 중수 구역', '누군가 들어왔어요', '조금 긴 안내 글이 한 줄을 넘어가면 끝을 줄여서 보여 줘요 어떻게 보이나'];
      const kinds = ['get', 'get', 'get', 'info', 'multi', 'warn'];
      const seen = [];
      for (let i = 0; i < 6; i++) { o.msg(kinds[i], texts[i]); await W(300); seen.push(o.msglog.state().lines.map((l) => l.text)); }
      await W(200); /* 자리 다시 잡기(0.1초마다) */
      const rects = [...document.querySelectorAll('#msg-log .msg-l:not(.out)')].map((e) => { const q = e.getBoundingClientRect(); return [q.left, q.top, q.right, q.bottom]; });
      const others = ['topbar', 'quest-track', 'joy', 'btn-ctx', 'btn-pick', 'btn-jump', 'btn-speed', 'btn-ride', 'actions', 'radio-strip'].map((id) => { const e = document.getElementById(id); if (!e || e.hidden || getComputedStyle(e).display === 'none' || getComputedStyle(e).visibility === 'hidden') return null; const q = e.getBoundingClientRect(); return q.width ? [id, q.left, q.top, q.right, q.bottom] : null; }).filter(Boolean);
      return { seen, rects, others, now: o.msglog.state() };
    });
    await pg.screenshot({ path: path.join(outDir, `msg-${w}x${h}.png`) });
    const hit = (a, c) => a[0] < c[2] - 0.5 && c[0] < a[2] - 0.5 && a[1] < c[3] - 0.5 && c[1] < a[3] - 0.5;
    ok(r.rects.length <= 3 && r.rects.length >= 2, `${tag}: 보이는 줄 ${r.rects.length} (최대 3)`);
    ok(r.rects.every((a, i) => r.rects.every((c, j) => i === j || !hit(a, c))), `${tag}: 줄끼리 안 겹침`);
    ok(new Set(r.rects.map((a) => Math.round(a[3] - a[1]))).size === 1, `${tag}: 같은 높이 ${r.rects.map((a) => Math.round(a[3] - a[1]))}`);
    const bad = r.others.filter((o) => r.rects.some((a) => hit(a, o.slice(1)))).map((o) => o[0]);
    ok(!bad.length, `${tag}: 버튼·위쪽 줄과 안 겹침 ${bad.join(',')}`);
    ok(r.seen[5][0] !== '귤 +3' && r.seen[5].slice(-1)[0].startsWith('조금 긴'), `${tag}: 새 것은 아래, 넘치면 오래된 것부터 빠짐`);
    const r2 = await pg.evaluate(async () => {
      const o = window.__oreum, W = (ms) => new Promise((res) => setTimeout(res, ms)); o.msglog.clear(); await W(500);
      o.msg('info', '하나'); await W(200); o.msg('info', '둘'); await W(200); o.msg('get', '빈 캔', { key: 'pick:캔', fmt: (n) => `빈 캔 ×${n}` }); o.msg('get', '빈 캔', { key: 'pick:캔', fmt: (n) => `빈 캔 ×${n}` }); o.msg('info', '같은 글'); o.msg('info', '같은 글'); o.msg('info', '같은 글');
      const a = o.msglog.state().lines.map((l) => l.text);
      const order = []; let last = a.slice();
      for (let i = 0; i < 60 && last.length; i++) { await W(150); const now = o.msglog.state().lines.map((l) => l.text); for (const t of last) if (!now.includes(t) && a.includes(t)) order.push(t); last = now.filter((t) => a.includes(t)); }
      o.msg('warn', '터 밖이에요 5', { pin: true, key: 'leave', sec: 3 }); o.msg('info', '로그 한 줄');
      const pin = document.querySelector('#msg-pin .msg-l')?.getBoundingClientRect(), lg = document.querySelector('#msg-log .msg-l')?.getBoundingClientRect();
      const sheet = document.getElementById('aug-pick'); sheet.hidden = false; await W(300); const hid = document.getElementById('msg-log').hidden;
      for (let i = 0; i < 5; i++) o.msg('info', '밀린 ' + i); sheet.hidden = true; await W(300);
      return { a, order, pinAbove: !!pin && !!lg && pin.bottom <= lg.top + 0.5, hid, back: o.msglog.state().lines.map((l) => l.text) };
    });
    ok(r2.a.length === 3 && r2.a[1] === '빈 캔 ×2' && /×3$/.test(r2.a[2]), `${tag}: 같은 글 합침 ${JSON.stringify(r2.a)}`);
    ok(r2.order.join('|') === r2.a.join('|'), `${tag}: 순서대로 사라짐 ${r2.order.join(' → ')}`);
    ok(r2.pinAbove, `${tag}: 고정 한 줄이 로그 위`);
    ok(r2.hid && r2.back.length === 3 && r2.back[2] === '밀린 4', `${tag}: 증강 창 동안 감추고 뒤에 최근 3개 ${JSON.stringify(r2.back)}`);
    ok(!errs.length, `${tag}: 페이지 오류 없음 ${errs.join(' / ')}`);
    await ctx.close();
  }
  await b.close();
})();
