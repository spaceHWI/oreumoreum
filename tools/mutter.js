// 캐릭터 혼잣말 확인 (#169)
//   node tools/mutter.js          (먼저 node build.mjs)
// 글 30줄 넘음·say(id) 로 내 머리 위 말풍선·조건(비)이 맞으면 gap 뒤 저절로·같은 줄 최대 3번·풀리면 안 나옴·설정 끔·튜토리얼 중엔 안 나옴·저장
const path = require('path');
const ok = (c, m) => { console.log((c ? '통과 ' : '실패 ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const { MUTTER_TEXT } = await import('../src/punktext.js');
  const { MUTTER } = await import('../src/balance.js');
  const n = Object.keys(MUTTER_TEXT).length;
  ok(n >= 30, `글: ${n}줄`);
  ok(!Object.values(MUTTER_TEXT).some((t) => /외계|UFO/.test(t)), '글: 답(외계인)을 직접 말하지 않음');

  const { chromium } = require('playwright');
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 480, height: 300 } }); const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message.slice(0, 300)));
  const url = 'file://' + path.join(__dirname, '../dist/test.html') + '#namsongi';
  await pg.goto(url); await pg.waitForTimeout(6000);
  // 튜토리얼 중: 저절로 안 나옴
  await pg.click('#enter').catch(() => {}); await pg.waitForTimeout(3000);
  const tut = await pg.evaluate(async () => { const o = window.__oreum, m = o.mutter; o.wx?.set?.('rain'); m.time(9999); await new Promise((r) => setTimeout(r, 2500)); return { active: !!o.tut?.active, b: m.bubble(), st: m.state() }; });
  ok(!tut.b && !tut.st.ready, `튜토리얼 중(${tut.active})엔 혼잣말 없음`);

  await pg.evaluate(() => { const o = window.__oreum; o.save.entered = 1; o.save.look = { sex: 'm', skin: 0 }; o.save.tut = { step: 99, done: true, v: 3 }; o.save.jeong = 1; o.save.soundOff = 1; o.save.equip.tool = 2; o.save.equip.bag = 1; o.save.mutter = { seen: { rain: 2 } }; o.save.journey = { step: 0, seen: { tips: '2026-01-01' }, day: '', n: 0, days: 1 }; o.persist?.(); });
  await pg.reload(); await pg.waitForTimeout(6000);
  await pg.click('#enter').catch(() => {}); await pg.waitForTimeout(4000);
  await pg.evaluate(() => { const o = window.__oreum; if (o.tut?.active) o.tut.skipAll(); o.cam.mode = 'follow'; for (const id of ['tut-toast', 'intro-help', 'intro']) { const e = document.getElementById(id); if (e) e.hidden = true; } });
  const r = await pg.evaluate(async () => {
    const o = window.__oreum, m = o.mutter, W = (ms) => new Promise((r) => setTimeout(r, ms));
    const gone = async () => { for (let i = 0; i < 120 && m.bubble(); i++) await W(250); }; // 느린 화면(헤드리스)은 게임 시간이 느림
    const out = { lines: m.lines.length };
    out.say = m.say('bigHeap'); out.b1 = m.bubble();
    await gone(); out.b2 = m.bubble();
    // 비: 조건이 맞으면 gap 이 지난 뒤 저절로 (저장에 2번 → 이번이 3번째, 그 뒤로는 안 나옴)
    o.save.mutter.seen.rain = 2; o.wx.set('rain'); m.time(9999); out.now = m.now();
    let got = null; for (let i = 0; i < 240 && !got; i++) { await W(250); m.time(30); const bb = m.bubble(); if (bb) got = bb; }
    out.auto = got; out.st1 = m.state(); out.dir = o.director.state().cur;
    await gone(); m.time(9999); await W(4000); out.after3 = m.state(); out.now3 = m.now();
    // 풀림: 낚시 1번 → stream 줄은 살아 있지 않음
    o.save.ach.life.fish = 1; out.aliveStream = m.state().alive.includes('stream');
    // 설정 끔
    document.getElementById('menu-mutter')?.click(); out.off = m.state().off; m.time(9999); await W(2500); out.offB = m.bubble();
    document.getElementById('menu-mutter')?.click();
    out.saved = JSON.parse(JSON.stringify(o.save.mutter));
    return out;
  });
  console.log(JSON.stringify(r, null, 0).slice(0, 1500));
  ok(r.lines >= 30, `줄 ${r.lines}개`);
  ok(r.say && r.b1 && r.b1.onMe && /큰 쓰레기 더미/.test(r.b1.text), 'say(bigHeap): 내 머리 위 말풍선');
  ok(!r.b2, `${MUTTER.sec}초(게임 시간) 뒤 사라짐`);
  ok(r.now.includes('rain') && r.auto && /비 오는 날/.test(r.auto.text), `비 조건 → 저절로 (${r.auto?.text})`);
  ok(r.after3.seen.rain === 3 && !r.now3.includes('rain') && !r.after3.alive.includes('rain'), `같은 줄 최대 ${MUTTER.max}번 (${r.after3.seen.rain})`);
  ok(!r.aliveStream, '풀린 줄(낚시를 함 → 개울 줄)은 안 나옴');
  ok(r.off && !r.offB, '설정 끔이면 안 나옴');
  ok(r.saved.seen && r.saved.seen.bigHeap === 1, '저장 save.mutter.seen');
  ok(!errs.length, '페이지 오류 없음' + (errs.length ? ' ' + errs.join(' | ') : ''));
  await b.close();
})();
